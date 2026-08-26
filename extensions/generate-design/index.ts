/**
 * generate-design — pi extension for single-file HTML design generation.
 *
 * Mode-based: off by default, explicit /design to enter.
 * Mirrors chat-only's mode pattern — status widget, persistence via custom entry,
 * before_agent_start gates on the flag, and session_tree / session_start restore.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { checkHtml, formatReport, designMdFindings } from "./checker.js";

const DESIGN_MODE_CUSTOM_TYPE = "generate-design-mode";

const FALLBACKS: Record<string, string> = {
  "design-workflow.md": `# Workflow
1. Understand — infer deliverable, audience, tone, density.
2. Read DESIGN.md if present — it is a constraint.
3. Propose — post a structured design direction in chat before writing HTML.
   Wait for user confirmation. No HTML during this phase.
4. Implement — write the complete index.html in one pass.
5. Self-check against craft-polish, fix, then finish.
Never paste HTML into chat; the file is the deliverable.`,
  "html-output-rules.md": `# Output contract
- One file: index.html. Self-contained inline CSS+JS. No external scripts/stylesheets unless user names one.
- No external API calls. Inline mock data.
- No hotlinked images. Use inline SVG, CSS shapes, gradients, or data URIs.
- Semantic landmarks (header/nav/main/footer), one <h1>, heading hierarchy, alt on images, focus states.
- Every color/spacing/radius/font via :root custom properties.
- Responsive: box-sizing border-box, clamp() for display type, max-width 100%, no clipping at 360px.`,
  "anti-slop.md": `# Anti-slop
Bans + substitutions: no Inter/Roboto/Arial/Helvetica/Space Grotesk primary; no purple-on-white gradients or Tailwind blue/grays as whole scale; no symmetric 3-col card grids as only idea; no solid white/flat gray, no gray rectangles as images, no emoji as icons; no lorem/John Doe/Acme, no hotlinked stock photos.`,
  "design-commitment.md": `# Commit to ONE direction + DESIGN.md baton
Pick one direction (minimal/editorial, bold/campaign, dense/professional, etc.) and execute it fully. Few strong tokens beat many weak ones. DESIGN.md carries the approved design plan across runs: read it before writing, create/update it after with frontmatter + Overview/Design Direction/Colors/Typography/Spacing & Radius.`,
  "craft-polish.md": `# Craft polish — final self-check
Interactive minimum (every control does something), three-state feedback (hover/press/focus, two cues, no size change on hover), craft surplus (3+ details), motion <300ms on transform/opacity only, empty/loading/error states, cleanup (no TODO/lorem/fake names).`,
  "revision-tweaks.md": `# Revision mode
Re-read index.html before editing. Minimum coherent change via :root tokens when persistent, scoped styles for one-offs. Keep DESIGN.md truthful when palette/type/spacing shifts. Scope guard: if a request is vague ("make it pop"), ask the user to clarify intent before proceeding.`,
};

function stripFrontmatter(md: string): string {
  if (md.startsWith("---")) {
    const end = md.indexOf("\n---", 3);
    if (end !== -1) {
      const after = md.indexOf("\n", end + 4);
      if (after !== -1) return md.slice(after + 1).trimStart();
    }
  }
  return md;
}

function getProjectRoot(): string {
  try {
    const thisDir = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      resolve(thisDir, "../../.."),
      resolve(thisDir, ".."),
      resolve(thisDir, "../.."),
      process.cwd(),
    ];
    for (const c of candidates) {
      if (
        existsSync(join(c, "skills", "design-workflow.md")) ||
        existsSync(join(c, "extensions/generate-design/skills/design-workflow.md")) ||
        existsSync(join(c, "manifest.json")) ||
        existsSync(join(c, "extensions/generate-design/manifest.json"))
      )
        return c;
    }
    return process.cwd();
  } catch {
    return process.cwd();
  }
}

function readSkill(name: string): string {
  try {
    const extensionDir = dirname(fileURLToPath(import.meta.url));
    const bundled = join(extensionDir, "skills", name);
    if (existsSync(bundled)) return stripFrontmatter(readFileSync(bundled, "utf8")).trim();
  } catch {}
  const root = getProjectRoot();
  const candidates = [join(root, "skills", name), join(root, "extensions/generate-design/skills", name)];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return stripFrontmatter(readFileSync(p, "utf8")).trim();
    } catch {}
  }
  return FALLBACKS[name] ?? "";
}

function readDesignMdHead(cwd: string, limit = 4000): string | null {
  const p = resolve(cwd, "DESIGN.md");
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, "utf8");
    if (raw.length <= limit) return raw;
    return raw.slice(0, limit) + "\n\n[DESIGN.md truncated — read the full file for remaining tokens.]";
  } catch {
    return null;
  }
}

function resolveIndexPath(cwd: string, inputPath?: string): string {
  const raw = (inputPath ?? "index.html").trim().replace(/^@/, "");
  return resolve(cwd, raw);
}

function extractTokens(html: string): Set<string> {
  const out = new Set<string>();
  const blocks = [...html.matchAll(/:root\s*\{([^}]*)\}/gi)].map((m) => m[1]);
  for (const b of blocks) {
    for (const m of b.matchAll(/--([\w-]+)\s*:/g)) out.add(m[1]);
  }
  return out;
}

const DESIGN_INTENT_RE =
  /(index\.html|design\.md|html|css|tailwind|landing\s*page|portfolio|website|web\s*app|single[-\s]?page|frontend|figma|mockup|wireframe|dashboard|hero|palette|typography)/i;

function looksLikeDesignIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.startsWith("/")) return false;
  return DESIGN_INTENT_RE.test(t);
}

export default function (pi: ExtensionAPI) {
  let designModeEnabled = false;
  let pendingPhaseOverride: "fresh" | "tweak" | null = null;
  let pendingCheckSummary: string | null = null;
  let planPhaseInjected = false;

  function validToolNames(names: string[]): string[] {
    const all = new Set(pi.getAllTools().map((t) => t.name));
    return names.filter((n) => all.has(n));
  }

  function persist() {
    pi.appendEntry(DESIGN_MODE_CUSTOM_TYPE, {
      enabled: designModeEnabled,
      pendingPhaseOverride,
      planPhaseInjected,
    });
  }

  function updateStatus(ctx: { ui: { setStatus: (k: string, v: string | undefined) => void; setWidget: (k: string, v: string[] | undefined) => void; theme: { fg: (c: string, s: string) => string } } }) {
    if (designModeEnabled) {
      ctx.ui.setStatus("generate-design", ctx.ui.theme.fg("accent", "🎨 design"));
      ctx.ui.setWidget("generate-design", [
        ctx.ui.theme.fg("muted", "Design mode — structured HTML generation. Run /design-off to exit."),
      ]);
    } else {
      ctx.ui.setStatus("generate-design", undefined);
      ctx.ui.setWidget("generate-design", undefined);
    }
  }

  function restoreFromBranch(ctx: { sessionManager: { getBranch: () => unknown[] } }): boolean {
    const branch = ctx.sessionManager.getBranch() as Array<{ type: string; customType?: string; data?: Record<string, unknown> }>;
    let last: Record<string, unknown> | undefined;
    for (const entry of branch) {
      if (entry.type === "custom" && entry.customType === DESIGN_MODE_CUSTOM_TYPE) {
        last = entry.data;
      }
    }
    if (last) {
      designModeEnabled = Boolean(last.enabled);
      pendingPhaseOverride = (last.pendingPhaseOverride as "fresh" | "tweak" | null) ?? null;
      planPhaseInjected = Boolean(last.planPhaseInjected);
      return true;
    }
    return false;
  }

  function enableDesignMode(ctx: { ui: { notify: (m: string, t?: string) => void }; cwd: string } & { ui: { setStatus: (k: string, v: string | undefined) => void; setWidget: (k: string, v: string[] | undefined) => void; theme: { fg: (c: string, s: string) => string } } }) {
    if (designModeEnabled) {
      ctx.ui.notify("Already in design mode.", "info");
      return;
    }
    designModeEnabled = true;
    planPhaseInjected = false;
    const needed = ["read", "write", "edit", "bash"];
    const active = new Set(pi.getActiveTools());
    for (const n of needed) active.add(n);
    const validated = validToolNames([...active] as string[]);
    if (validated.length > 0) pi.setActiveTools(validated);
    persist();
    updateStatus(ctx as unknown as { ui: { setStatus: (k: string, v: string | undefined) => void; setWidget: (k: string, v: string[] | undefined) => void; theme: { fg: (c: string, s: string) => string } } });
    ctx.ui.notify("Design mode enabled. Structured HTML generation is now active. Run /design-off to exit.", "info");
  }

  function disableDesignMode(ctx: { ui: { notify: (m: string, t?: string) => void } } & { ui: { setStatus: (k: string, v: string | undefined) => void; setWidget: (k: string, v: string[] | undefined) => void; theme: { fg: (c: string, s: string) => string } } }) {
    if (!designModeEnabled) {
      ctx.ui.notify("Design mode already off.", "info");
      return;
    }
    designModeEnabled = false;
    pendingPhaseOverride = null;
    persist();
    updateStatus(ctx as unknown as { ui: { setStatus: (k: string, v: string | undefined) => void; setWidget: (k: string, v: string[] | undefined) => void; theme: { fg: (c: string, s: string) => string } } });
    ctx.ui.notify("Design mode disabled. Back to normal chat.", "info");
  }

  pi.registerTool({
    name: "design_check",
    label: "Design Check",
    description:
      "Static checker for index.html against the generate-design rules (html-output-rules, anti-slop, craft-polish). No browser, no network. Use it to verify a fresh page or after a tweak turn; it also runs automatically after index.html writes when design mode is on.",
    parameters: Type.Object({
      path: Type.Optional(Type.String({ description: "Path to HTML file to check, relative to workspace. Defaults to index.html." })),
      strict: Type.Optional(Type.Boolean({ description: "If true, warnings are treated as errors in the summary. Defaults to false." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const filePath = resolveIndexPath(ctx.cwd, params.path);
      const label = params.path?.trim().replace(/^@/, "") || "index.html";
      let html: string;
      try {
        html = await readFile(filePath, "utf8");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          content: [{ type: "text", text: `design_check: could not read ${label} at ${filePath}: ${msg}` }],
          details: { findings: [{ ruleId: "io-read-failed", severity: "error", message: msg }] },
        };
      }
      const findings = checkHtml(html);
      if (basename(filePath).toLowerCase() === "index.html") {
        const designPath = resolve(ctx.cwd, "DESIGN.md");
        const designExists = existsSync(designPath);
        let dMtime: number | undefined;
        let iMtime: number | undefined;
        try {
          if (designExists) dMtime = statSync(designPath).mtimeMs;
          iMtime = statSync(filePath).mtimeMs;
        } catch {}
        const hasTokens = extractTokens(html).size > 0;
        const designFinds = designMdFindings({
          designExists,
          designMtimeMs: dMtime,
          indexMtimeMs: iMtime,
          indexTokensChanged: hasTokens,
        });
        findings.push(...designFinds);
      }
      const report = formatReport(findings, label);
      const strictNote = params.strict && findings.some((f) => f.severity === "warn") ? "\n(strict: warnings would block)" : "";
      return {
        content: [{ type: "text", text: report + strictNote }],
        details: { findings },
      };
    },
  });

  pi.registerCommand("design", {
    description: "Enter design mode (structured single-file HTML generation)",
    handler: async (_args, ctx) => {
      enableDesignMode(ctx as unknown as { ui: { notify: (m: string, t?: string) => void; setStatus: (k: string, v: string | undefined) => void; setWidget: (k: string, v: string[] | undefined) => void; theme: { fg: (c: string, s: string) => string } }; cwd: string });
    },
  });

  pi.registerCommand("design-off", {
    description: "Leave design mode",
    handler: async (_args, ctx) => {
      disableDesignMode(ctx as unknown as { ui: { notify: (m: string, t?: string) => void; setStatus: (k: string, v: string | undefined) => void; setWidget: (k: string, v: string[] | undefined) => void; theme: { fg: (c: string, s: string) => string } } });
    },
  });

  pi.registerCommand("design-status", {
    description: "Show design mode status",
    handler: async (_args, ctx) => {
      ctx.ui.notify(designModeEnabled ? "Design mode: ON — /design-off to exit." : "Design mode: OFF — /design to enter.", "info");
    },
  });

  pi.registerCommand("design-check", {
    description: "Run the static design checker on index.html (or a given path)",
    handler: async (args, ctx) => {
      const p = args?.trim()?.replace(/^@/, "") || "index.html";
      const filePath = resolve(ctx.cwd, p);
      try {
        const html = await readFile(filePath, "utf8");
        const findings = checkHtml(html);
        const report = formatReport(findings, p);
        ctx.ui.notify(report.slice(0, 800), findings.some((f) => f.severity === "error") ? "warning" : "info");
        pi.sendMessage(
          { customType: "generate-design:check", content: report, display: true },
          { triggerTurn: false },
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.ui.notify(`design-check: could not read ${p}: ${msg}`, "error");
      }
    },
  });

  pi.registerCommand("design-new", {
    description: "Force the next turn to use fresh-run composition (only in design mode)",
    handler: async (_args, ctx) => {
      if (!designModeEnabled) {
        ctx.ui.notify("Design mode is off. Run /design first, then /design-new.", "warning");
        return;
      }
      pendingPhaseOverride = "fresh";
      planPhaseInjected = false;
      persist();
      ctx.ui.notify("Next turn will use fresh-run composition with plan phase.", "info");
    },
  });

  pi.registerCommand("design-tweak", {
    description: "Force the next turn to use tweak-turn composition (only in design mode)",
    handler: async (_args, ctx) => {
      if (!designModeEnabled) {
        ctx.ui.notify("Design mode is off. Run /design first, then /design-tweak.", "warning");
        return;
      }
      pendingPhaseOverride = "tweak";
      persist();
      ctx.ui.notify("Next turn will use tweak-turn composition (revision-tweaks + output rules + anti-slop).", "info");
    },
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (!designModeEnabled) return;

    const cwd = ctx.cwd;
    const indexPath = resolve(cwd, "index.html");
    const indexExists = existsSync(indexPath);
    const autoFresh = !indexExists;
    const isFresh = pendingPhaseOverride ? pendingPhaseOverride === "fresh" : autoFresh;
    if (pendingPhaseOverride) {
      pendingPhaseOverride = null;
      persist();
    }

    const shouldInjectPlanPhase = isFresh && !planPhaseInjected;

    const workflow = readSkill("design-workflow.md");
    const outputRules = readSkill("html-output-rules.md");
    const antiSlop = readSkill("anti-slop.md");
    const commitment = readSkill("design-commitment.md");
    const polish = readSkill("craft-polish.md");
    const revision = readSkill("revision-tweaks.md");
    const designHead = readDesignMdHead(cwd);

    const injectedWarnings: string[] = [];
    if (pendingCheckSummary) {
      injectedWarnings.push(pendingCheckSummary);
      pendingCheckSummary = null;
    }

    let composed = "";
    if (isFresh) {
      composed += `\n\n# generate-design — Fresh page run (design mode ON)\n\n`;
      composed += `You are generating a single self-contained index.html page. One page at a time, no multi-screen machinery.\n\n`;
      composed += `## Design Workflow\n${workflow}\n\n`;
      composed += `## HTML Output Rules (contract)\n${outputRules}\n\n`;
      composed += `## Anti-slop (bans + substitutions)\n${antiSlop}\n\n`;
      composed += `## Design Commitment & DESIGN.md baton\n${commitment}\n\n`;
      composed += `## Craft Polish — self-check before finishing\n${polish}\n`;

      if (shouldInjectPlanPhase) {
        composed += `\n**Important — Plan first, then implement.**\n`;
        composed += `Phase 2 (Propose) of the workflow above is mandatory. Post the structured design proposal in chat before writing any HTML. Wait for the user to confirm or revise it. Do not write index.html until the plan is confirmed.\n`;
        planPhaseInjected = true;
        persist();
      } else if (planPhaseInjected) {
        composed += `\n**Plan phase note:** You have already proposed a direction. `;
        composed += `If the user has confirmed the plan, proceed to Phase 3 (implement). If the plan is still under discussion, continue refining it until confirmed.\n`;
      }

      composed += `\nTweaks on follow-up turns use freeform natural language ("make the hero warmer") — no EDITMODE blocks. After you finish writing index.html, create or update DESIGN.md with the tokens you chose so the next page inherits the system.\n`;
    } else {
      composed += `\n\n# generate-design — Tweak / revision turn (design mode ON)\n\n`;
      composed += `An index.html already exists. This is a follow-up edit turn. Do the minimum coherent change.\n\n`;
      composed += `## Revision Tweaks\n${revision}\n\n`;
      composed += `## HTML Output Rules (still enforced)\n${outputRules}\n\n`;
      composed += `## Anti-slop (still enforced — do not regress)\n${antiSlop}\n\n`;
      composed += `## Design Commitment — baton note\nIf this tweak changes a stable visual decision (palette, typeface, spacing scale, radius), update DESIGN.md in the same pass so the next page inherits what was approved.\n`;
    }

    if (designHead) {
      composed += `\n## DESIGN.md (current baton — read as constraint)\n\`\`\`md\n${designHead}\n\`\`\`\n`;
    } else {
      composed += `\n## DESIGN.md\nNo DESIGN.md found in the workspace. On a fresh run, create it after finishing index.html (see Design Commitment). On tweak turns, read it first if it exists.\n`;
    }

    if (injectedWarnings.length) {
      composed += `\n## Post-write notices from previous turn\n${injectedWarnings.join("\n\n")}\n`;
    }

    const nextPrompt = (event.systemPrompt ?? "") + composed;
    return { systemPrompt: nextPrompt };
  });

  pi.on("tool_result", async (event, _ctx) => {
    if (!designModeEnabled) return;
    const toolName = (event as unknown as { toolName: string }).toolName;
    if (toolName !== "write" && toolName !== "edit") return;
    const input = (event as unknown as { input: Record<string, unknown> }).input ?? {};
    const rawPath = (input.path as string | undefined) ?? (input.file as string | undefined);
    if (!rawPath || basename(rawPath.replace(/^@/, "")).toLowerCase() !== "index.html") return;
    const ctx = _ctx as unknown as { cwd: string };
    const cwd = ctx?.cwd ?? process.cwd();
    const filePath = resolveIndexPath(cwd, rawPath);
    if (!existsSync(filePath)) return;
    let html: string;
    try {
      html = await readFile(filePath, "utf8");
    } catch {
      return;
    }
    const findings = checkHtml(html);
    try {
      const cwd2 = (_ctx as unknown as { cwd: string })?.cwd ?? process.cwd();
      const designPath2 = resolve(cwd2, "DESIGN.md");
      const designExists2 = existsSync(designPath2);
      let dM2: number | undefined;
      let iM2: number | undefined;
      try {
        if (designExists2) dM2 = statSync(designPath2).mtimeMs;
        iM2 = statSync(resolve(cwd2, rawPath!.replace(/^@/, ""))).mtimeMs;
      } catch {}
      const hasTokens2 = extractTokens(html).size > 0;
      findings.push(...designMdFindings({ designExists: designExists2, designMtimeMs: dM2, indexMtimeMs: iM2, indexTokensChanged: hasTokens2 }));
    } catch {}
    const hasError = findings.some((f) => f.severity === "error");
    const report = formatReport(findings, rawPath ?? "index.html");
    if (hasError || findings.length > 0) {
      pendingCheckSummary = `Static design_check after last index.html write:\n\`\`\`\n${report}\n\`\`\``;
    }
    planPhaseInjected = false;
    persist();
    const patchText = `\n\n---\nStatic design_check (${rawPath}):\n${report}`;
    const existing = (event as unknown as { content: Array<{ type: string; text: string }> }).content;
    if (Array.isArray(existing) && existing.length > 0 && typeof existing[0].text === "string") {
      return {
        content: [{ type: "text" as const, text: existing[0].text + patchText }],
        details: { ...(event as unknown as { details: Record<string, unknown> }).details, designCheckFindings: findings },
      };
    }
    return {
      content: [{ type: "text" as const, text: patchText }],
      details: { designCheckFindings: findings },
    };
  });

  pi.on("input", async (event, ctx) => {
    if (designModeEnabled) return { action: "continue" as const };
    if (!ctx.hasUI) return { action: "continue" as const };
    if (ctx.mode !== "tui") return { action: "continue" as const };
    const streaming = (event as unknown as { streamingBehavior?: string }).streamingBehavior;
    if (streaming) return { action: "continue" as const };
    const text = (event as unknown as { text?: string }).text ?? "";
    if (!looksLikeDesignIntent(text)) return { action: "continue" as const };
    const ok = await ctx.ui.confirm(
      "Enable design mode?",
      "Your message looks like HTML/design work (page, landing, hero, index.html). Enable design mode for this session?",
    );
    if (ok) {
      enableDesignMode(ctx as unknown as { ui: { notify: (m: string, t?: string) => void; setStatus: (k: string, v: string | undefined) => void; setWidget: (k: string, v: string[] | undefined) => void; theme: { fg: (c: string, s: string) => string } }; cwd: string });
    }
    return { action: "continue" as const };
  });

  pi.on("session_start", async (event, ctx) => {
    let skillsOk = false;
    try {
      const extensionDir = dirname(fileURLToPath(import.meta.url));
      if (existsSync(join(extensionDir, "skills", "design-workflow.md"))) skillsOk = true;
    } catch {}
    if (!skillsOk) {
      const root = getProjectRoot();
      skillsOk =
        existsSync(join(root, "skills", "design-workflow.md")) ||
        existsSync(join(root, "extensions/generate-design/skills/design-workflow.md"));
    }
    if (!skillsOk) {
      ctx.ui.notify("generate-design: skills/ not found at expected location — using built-in fallbacks.", "warning");
    }

    const reason = (event as unknown as { reason?: string }).reason;
    if (reason === "startup" || reason === "new") {
      if (!restoreFromBranch(ctx as unknown as { sessionManager: { getBranch: () => unknown[] } })) {
        designModeEnabled = false;
        planPhaseInjected = false;
      }
      updateStatus(ctx as unknown as { ui: { setStatus: (k: string, v: string | undefined) => void; setWidget: (k: string, v: string[] | undefined) => void; theme: { fg: (c: string, s: string) => string } } });
      return;
    }
    restoreFromBranch(ctx as unknown as { sessionManager: { getBranch: () => unknown[] } });
    updateStatus(ctx as unknown as { ui: { setStatus: (k: string, v: string | undefined) => void; setWidget: (k: string, v: string[] | undefined) => void; theme: { fg: (c: string, s: string) => string } } });
  });

  pi.on("session_tree", async (_event, ctx) => {
    restoreFromBranch(ctx as unknown as { sessionManager: { getBranch: () => unknown[] } });
    updateStatus(ctx as unknown as { ui: { setStatus: (k: string, v: string | undefined) => void; setWidget: (k: string, v: string[] | undefined) => void; theme: { fg: (c: string, s: string) => string } } });
  });

  pi.on("turn_start", async () => {
    if (designModeEnabled) {
      const active = pi.getActiveTools();
      const needed = ["read", "write", "edit", "bash"];
      const missing = needed.filter((n) => !(active as string[]).includes(n));
      if (missing.length > 0) {
        const all = validToolNames([...(active as string[]), ...missing]);
        if (all.length > 0) pi.setActiveTools(all);
      }
    }
  });
}
