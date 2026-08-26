/**
 * generate-design — pi extension for single-file HTML design generation.
 *
 * Composes the system prompt from skills/ per phase (fresh vs tweak),
 * exposes a static design_check tool, auto-runs the checker after
 * index.html writes, and warns when DESIGN.md is missing or stale.
 *
 * Placement: .pi/extensions/generate-design/index.ts (project-local,
 * auto-discovered). Also mirrored at extension/index.ts for reference.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";
import { existsSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { checkHtml, formatReport, designMdFindings } from "./checker.js";

// ---------------------------------------------------------------------------
// Fallback skill bodies (used when the file cannot be read from disk)
// Keep them short; the real files are preferred. They carry the same intent
// so the extension still steers taste even if the repo layout changed.

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

// ---------------------------------------------------------------------------
// Helpers

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
      resolve(thisDir, "../../.."), // .pi/extensions/generate-design -> ~/.pi or repo root
      resolve(thisDir, ".."), // extension/ -> repo root
      resolve(thisDir, "../.."), // alternative depth
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
  // Prefer bundled skills next to the extension (for global install), then project-root variants
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

function isIndexHtmlPath(cwd: string, rawPath: string): boolean {
  const cleaned = rawPath.trim().replace(/^@/, "");
  if (!cleaned) return false;
  const abs = resolve(cwd, cleaned);
  return basename(abs).toLowerCase() === "index.html";
}

function isDesignRelevant(prompt: string | undefined, cwd: string, hasOverride: boolean): boolean {
  if (hasOverride) return true;
  const raw = (prompt ?? "").trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (/index\.html|design\.md/i.test(lower)) return true;
  if (/\/design-(check|new|tweak)/i.test(lower)) return true;
  if (/(roblox|\blua\b|\bobby\b|leaderstats|replicatedstorage|\bdatastore\b|game\.pass)/i.test(raw) && !/(html|css|\bweb\b|landing|portfolio|website)/i.test(raw)) {
    return false;
  }
  const webSignal =
    /(html|css|tailwind|javascript|\bjs\b|\bts\b|typescript|web\s*page|landing\s*page|portfolio|website|web\s*site|web\s*app|single[-\s]?page|frontend|figma|mockup|wireframe|dashboard)/i;
  if (webSignal.test(raw)) return true;
  if (/(create|build|make|generate|design)\b[^]{0,40}\b(page|site|landing|portfolio|dashboard)\b/i.test(raw)) return true;
  if (/\bdesign\b.*\b(page|landing|portfolio|system|token|palette|typography|layout)\b/i.test(raw)) return true;
  if (/\bui\b.*\b(design|page|component|layout|hero)\b/i.test(raw)) return true;
  const hasIndex = existsSync(resolve(cwd, "index.html"));
  if (hasIndex) {
    const tweakSignal =
      /(hero|header|footer|\bnav\b|card|grid|palette|color|spacing|radius|font|typography|section|layout|responsive|background|gradient|make it pop|fresh look|new direction|redo the hero)/i;
    if (tweakSignal.test(raw)) return true;
    if (/make.*\b(warmer|darker|lighter|brighter|bolder|softer|sharper|pop)\b/i.test(raw)) return true;
  }
  return false;
}

// Lightweight :root token extraction for stale detection
function extractTokens(html: string): Set<string> {
  const out = new Set<string>();
  const blocks = [...html.matchAll(/:root\s*\{([^}]*)\}/gi)].map((m) => m[1]);
  for (const b of blocks) {
    for (const m of b.matchAll(/--([\w-]+)\s*:/g)) out.add(m[1]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Extension factory

export default function (pi: ExtensionAPI) {
  let pendingPhaseOverride: "fresh" | "tweak" | null = null;
  let pendingCheckSummary: string | null = null;
  // Tracks whether Phase 2 (plan proposal) has been injected this fresh run.
  // Reset after index.html is written so the next fresh run starts clean.
  let planPhaseInjected = false;

  // --- design_check tool ---
  pi.registerTool({
    name: "design_check",
    label: "Design Check",
    description:
      "Static checker for index.html against the generate-design rules (html-output-rules, anti-slop, craft-polish). No browser, no network. Use it to verify a fresh page or after a tweak turn; it also runs automatically after index.html writes.",
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

      // DESIGN.md staleness as an extra warn (only for index.html at cwd)
      if (basename(filePath).toLowerCase() === "index.html") {
        const designPath = resolve(ctx.cwd, "DESIGN.md");
        const designExists = existsSync(designPath);
        let dMtime: number | undefined;
        let iMtime: number | undefined;
        try {
          if (designExists) dMtime = statSync(designPath).mtimeMs;
          iMtime = statSync(filePath).mtimeMs;
        } catch {
          // ignore stat errors
        }
        // Heuristic: if index has tokens but DESIGN.md predates it, warn
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
      // Honor strict: just annotate, don't change findings — the caller decides
      const strictNote = params.strict && findings.some((f) => f.severity === "warn") ? "\n(strict: warnings would block)" : "";
      return {
        content: [{ type: "text", text: report + strictNote }],
        details: { findings },
      };
    },
  });

  // --- commands ---
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
    description: "Force the next turn to use fresh-run prompt composition",
    handler: async (_args, ctx) => {
      pendingPhaseOverride = "fresh";
      planPhaseInjected = false;
      ctx.ui.notify("Next turn will use fresh-run composition with plan phase.", "info");
    },
  });

  pi.registerCommand("design-tweak", {
    description: "Force the next turn to use tweak-turn composition",
    handler: async (_args, ctx) => {
      pendingPhaseOverride = "tweak";
      ctx.ui.notify("Next turn will use tweak-turn composition (revision-tweaks + output rules + anti-slop).", "info");
    },
  });

  // --- prompt composition ---
  pi.on("before_agent_start", async (event, ctx) => {
    const cwd = ctx.cwd;
    const rawPrompt = (event as unknown as { prompt?: string; text?: string }).prompt ?? (event as unknown as { text?: string }).text ?? "";
    const hasOverride = pendingPhaseOverride !== null;
    if (!isDesignRelevant(rawPrompt, cwd, hasOverride)) {
      if (hasOverride) pendingPhaseOverride = null;
      return;
    }
    const indexPath = resolve(cwd, "index.html");
    const indexExists = existsSync(indexPath);
    const autoFresh = !indexExists;
    const isFresh = pendingPhaseOverride ? pendingPhaseOverride === "fresh" : autoFresh;
    if (pendingPhaseOverride) pendingPhaseOverride = null;

    // Only inject Phase 2 on the first fresh turn of this run.
    // Subsequent turns in the same session pick up where they left off.
    const shouldInjectPlanPhase = isFresh && !planPhaseInjected;

    const workflow = readSkill("design-workflow.md");
    const outputRules = readSkill("html-output-rules.md");
    const antiSlop = readSkill("anti-slop.md");
    const commitment = readSkill("design-commitment.md");
    const polish = readSkill("craft-polish.md");
    const revision = readSkill("revision-tweaks.md");
    const designHead = readDesignMdHead(cwd);

    // Pending check summary from previous write turn
    const injectedWarnings: string[] = [];
    if (pendingCheckSummary) {
      injectedWarnings.push(pendingCheckSummary);
      pendingCheckSummary = null;
    }

    let composed = "";
    if (isFresh) {
      composed += `\n\n# generate-design — Fresh page run\n\n`;
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
      } else if (planPhaseInjected) {
        composed += `\n**Plan phase note:** You have already proposed a direction. `;
        composed += `If the user has confirmed the plan, proceed to Phase 3 (implement). If the plan is still under discussion, continue refining it until confirmed.\n`;
      }

      composed += `\nTweaks on follow-up turns use freeform natural language ("make the hero warmer") — no EDITMODE blocks. After you finish writing index.html, create or update DESIGN.md with the tokens you chose so the next page inherits the system.\n`;
    } else {
      composed += `\n\n# generate-design — Tweak / revision turn\n\n`;
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

    // Enforce: identity/bar-setting first, bans in middle, checklist last is already satisfied by order.
    const nextPrompt = (event.systemPrompt ?? "") + composed;
    return { systemPrompt: nextPrompt };
  });

  // --- auto-run checker after index.html writes ---
  pi.on("tool_result", async (event, _ctx) => {
    const toolName = (event as unknown as { toolName: string }).toolName;
    if (toolName !== "write" && toolName !== "edit") return;

    const input = (event as unknown as { input: Record<string, unknown> }).input ?? {};
    // write: { path, content }, edit: { path, edits }
    const rawPath = (input.path as string | undefined) ?? (input.file as string | undefined);
    if (!rawPath || basename(rawPath.replace(/^@/, "")).toLowerCase() !== "index.html") return;

    // We don't have ctx.cwd on the event in all pi versions; fall back to process.cwd()
    // Try to get cwd from the tool result's ctx if available via closure? pi.on passes ctx as second arg.
    // Use the passed ctx for cwd.
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
    // Also fold in DESIGN.md baton staleness so auto-run matches manual design_check
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

    // Stash summary for the next turn's prompt injection
    if (hasError || findings.length > 0) {
      pendingCheckSummary = `Static design_check after last index.html write:\n\`\`\`\n${report}\n\`\`\``;
    }

    // Reset plan-phase gate so the next fresh run starts with Phase 2 again.
    planPhaseInjected = false;

    // Patch the tool result so the model sees the check in the same turn.
    // tool_result handlers chain; we return a partial patch.
    const patchText = `\n\n---\nStatic design_check (${rawPath}):\n${report}`;
    const existing = (event as unknown as { content: Array<{ type: string; text: string }> }).content;
    if (Array.isArray(existing) && existing.length > 0 && typeof existing[0].text === "string") {
      return {
        content: [{ type: "text" as const, text: existing[0].text + patchText }],
        details: { ...(event as unknown as { details: Record<string, unknown> }).details, designCheckFindings: findings },
      };
    }
    // Fallback if content shape is different
    return {
      content: [{ type: "text" as const, text: patchText }],
      details: { designCheckFindings: findings },
    };
  });

  pi.on("session_start", async (_event, ctx) => {
    // Health hint — check bundled location first (global install), then project-root fallbacks
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
  });
}
