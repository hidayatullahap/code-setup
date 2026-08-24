/**
 * Static checker for single-file HTML pages.
 * No browser, no network. Reads index.html from disk and validates
 * against html-output-rules, anti-slop, and craft-polish heuristics.
 */

export type Severity = "error" | "warn";

export type Finding = {
  ruleId: string;
  severity: Severity;
  message: string;
  excerpt?: string;
};

function excerptOf(html: string, match: RegExpExecArray | string, radius = 80): string {
  const text = typeof match === "string" ? match : match[0];
  const idx = typeof match === "string" ? html.indexOf(match) : (match.index ?? 0);
  if (idx < 0) return text.slice(0, 160);
  const start = Math.max(0, idx - radius);
  const end = Math.min(html.length, idx + text.length + radius);
  let s = html.slice(start, end).replace(/\s+/g, " ").trim();
  if (s.length > 160) s = s.slice(0, 157) + "...";
  return s;
}

function extractCss(html: string): { all: string; rootBlocks: string[]; outsideRoot: string } {
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const all = styleBlocks.join("\n");
  const rootBlocks: string[] = [...all.matchAll(/:root\s*\{[^}]*\}/gi)].map((m) => m[0]);
  let outside = all;
  for (const b of rootBlocks) outside = outside.replace(b, "");
  return { all, rootBlocks, outsideRoot: outside };
}

function countMatches(html: string, re: RegExp): number {
  return [...html.matchAll(re)].length;
}

export function checkHtml(html: string): Finding[] {
  const findings: Finding[] = [];
  const css = extractCss(html);
  const lower = html.toLowerCase();

  // --- html-output-rules ---
  // viewport meta (handles quoted and unquoted attribute values)
  if (!/<meta[^>]*name\s*=\s*["']?viewport["']?[^>]*>/i.test(html)) {
    findings.push({
      ruleId: "html-viewport",
      severity: "error",
      message: "Missing <meta name=viewport> — responsive HTML needs it.",
    });
  }

  // external script/link (error unless user explicitly asked — we warn)
  const extScript = [...html.matchAll(/<script[^>]+src=["']https?:\/\/[^"']+["']/gi)];
  for (const m of extScript) {
    findings.push({
      ruleId: "html-external-script",
      severity: "error",
      message: "External <script src> with http(s) — inline JS instead (self-contained).",
      excerpt: excerptOf(html, m),
    });
  }
  const extLink = [...html.matchAll(/<link[^>]+href=["']https?:\/\/[^"']+["'][^>]*>/gi)];
  for (const m of extLink) {
    // allow Google Fonts if user explicitly wanted it? We still warn.
    findings.push({
      ruleId: "html-external-stylesheet",
      severity: "error",
      message: "External <link href> with http(s) — inline CSS instead.",
      excerpt: excerptOf(html, m),
    });
  }

  // hotlinked images
  const hotImgs = [...html.matchAll(/<img[^>]+src=["']https?:\/\/[^"']+["'][^>]*>/gi)];
  for (const m of hotImgs) {
    findings.push({
      ruleId: "html-hotlinked-image",
      severity: "error",
      message: "Hotlinked <img src> (https://) — use inline SVG, CSS shapes, gradients, or data URIs.",
      excerpt: excerptOf(html, m),
    });
  }
  // any http image src even without https
  const httpSrc = [...html.matchAll(/<img[^>]+src=["']http:\/\/[^"']+["'][^>]*>/gi)].filter(
    (m) => !hotImgs.some((h) => h[0] === m[0]),
  );
  for (const m of httpSrc) {
    findings.push({
      ruleId: "html-hotlinked-image",
      severity: "error",
      message: "Hotlinked <img src> (http://) — use inline assets.",
      excerpt: excerptOf(html, m),
    });
  }

  // external fetch
  const fetches = [...html.matchAll(/fetch\s*\(\s*["']https?:\/\/[^"']+["']/gi)];
  for (const m of fetches) {
    findings.push({
      ruleId: "html-external-fetch",
      severity: "warn",
      message: "fetch() to external host — inline mock data instead.",
      excerpt: excerptOf(html, m),
    });
  }

  // single h1
  const h1Count = countMatches(html, /<h1\b[^>]*>/gi);
  if (h1Count === 0) {
    findings.push({
      ruleId: "html-no-h1",
      severity: "error",
      message: "Missing <h1> — every page needs exactly one.",
    });
  } else if (h1Count > 1) {
    findings.push({
      ruleId: "html-multiple-h1",
      severity: "warn",
      message: `Found ${h1Count} <h1> elements — keep exactly one for a clean heading hierarchy.`,
    });
  }

  // heading hierarchy skip (h1 -> h3 without h2 etc.)
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map((m) => parseInt(m[1], 10));
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] > headings[i - 1] + 1) {
      findings.push({
        ruleId: "html-heading-skip",
        severity: "warn",
        message: `Heading hierarchy skip: h${headings[i - 1]} followed by h${headings[i]} (missing intermediate level).`,
      });
      break;
    }
  }

  // alt on images (handle > inside quoted attribute values like data URIs)
  const imgs = [...html.matchAll(/<img\b(?:[^">']|"[^"]*"|'[^']*')*>/gi)];
  for (const m of imgs) {
    if (!/\balt\s*=/i.test(m[0])) {
      findings.push({
        ruleId: "html-img-alt",
        severity: "error",
        message: "<img> missing alt attribute.",
        excerpt: excerptOf(html, m),
      });
    }
  }

  // :root custom properties
  const hasRoot = /:root\s*\{[^}]*--/i.test(css.all);
  if (!hasRoot) {
    findings.push({
      ruleId: "html-no-root-tokens",
      severity: "error",
      message: "No :root custom properties found — define colors, spacing, radius, and fonts as --* in :root.",
    });
  }

  // hard-coded colors outside :root
  if (css.outsideRoot) {
    // Look for hex/rgb/hsl/oklch literals in declaration values that are not var(--...)
    const decls = [...css.outsideRoot.matchAll(/:[^;{]*?(#[0-9a-f]{3,8}\b|oklch\s*\(|lab\s*\(|rgb(a)?\s*\(|hsl(a)?\s*\()/gi)];
    // Filter out values that contain var( nearby
    const filtered = decls.filter((m) => {
      const before = css.outsideRoot.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0));
      const after = css.outsideRoot.slice((m.index ?? 0), (m.index ?? 0) + 120);
      // If this declaration already uses var(--, the literal is a fallback or inside var — don't flag
      if (/var\s*\(\s*--/.test(after.slice(0, 60))) return false;
      // Also ignore comments
      return true;
    });
    if (filtered.length > 0) {
      const sample = filtered.slice(0, 2).map((m) => m[0].trim().slice(0, 40)).join(", ");
      findings.push({
        ruleId: "html-hardcoded-color",
        severity: "warn",
        message: `Hard-coded color value outside :root (${sample}) — move load-bearing visuals to :root custom properties and reference via var(--*).`,
        excerpt: excerptOf(css.outsideRoot, filtered[0][0]),
      });
    }
  }

  // box-sizing
  if (!/box-sizing\s*:\s*border-box/i.test(css.all)) {
    findings.push({
      ruleId: "html-box-sizing",
      severity: "error",
      message: "Missing box-sizing: border-box — add it globally (* { box-sizing: border-box }).",
    });
  }

  // clamp() for display type
  if (!/clamp\s*\(/i.test(css.all)) {
    findings.push({
      ruleId: "html-no-clamp",
      severity: "warn",
      message: "No clamp() found — use clamp() for display type with conservative bounds.",
    });
  }

  // focus states
  if (!/:focus(-visible|-within)?/i.test(css.all)) {
    findings.push({
      ruleId: "html-no-focus-ring",
      severity: "error",
      message: "No :focus or :focus-visible styles — add visible focus rings for keyboard navigation.",
    });
  }

  // semantic landmarks
  const hasHeader = /<header\b/i.test(html);
  const hasNav = /<nav\b/i.test(html);
  const hasMain = /<main\b/i.test(html);
  const hasFooter = /<footer\b/i.test(html);
  if (!hasMain) {
    findings.push({
      ruleId: "html-no-main",
      severity: "error",
      message: "Missing <main> landmark — wrap primary content in <main>.",
    });
  }
  if (!hasHeader && !hasNav && !hasFooter) {
    findings.push({
      ruleId: "html-no-landmarks",
      severity: "warn",
      message: "No semantic landmarks (header/nav/footer) found — add at least header and footer for single-page output.",
    });
  }

  // --- anti-slop ---
  if (/lorem ipsum/i.test(html)) {
    findings.push({
      ruleId: "anti-lorem",
      severity: "error",
      message: "Found 'lorem ipsum' placeholder — replace with domain-specific, plausible copy.",
      excerpt: excerptOf(html, /lorem ipsum/i.exec(html)![0]),
    });
  }
  if (/John Doe/i.test(html)) {
    findings.push({
      ruleId: "anti-john-doe",
      severity: "error",
      message: "Found 'John Doe' placeholder — use a plausible, specific name.",
      excerpt: excerptOf(html, /John Doe/.exec(html)![0]),
    });
  }
  if (/Acme Corp/i.test(html)) {
    findings.push({
      ruleId: "anti-acme",
      severity: "error",
      message: "Found 'Acme Corp' placeholder — use a specific, plausible organization name.",
      excerpt: excerptOf(html, /Acme Corp/.exec(html)![0]),
    });
  }
  if (/coming soon/i.test(html)) {
    findings.push({
      ruleId: "anti-coming-soon",
      severity: "error",
      message: "Found 'coming soon' — replace with real content; the page must be complete.",
      excerpt: excerptOf(html, /coming soon/i.exec(html)![0]),
    });
  }

  // forbidden fonts
  const fontFamilyMatches = [...css.all.matchAll(/font-family[^;]*;/gi)];
  for (const m of fontFamilyMatches) {
    const v = m[0].toLowerCase();
    const hits: string[] = [];
    if (/\binter\b/.test(v)) hits.push("Inter");
    if (/\broboto\b/.test(v)) hits.push("Roboto");
    if (/\bspace grotesk\b/.test(v)) hits.push("Space Grotesk");
    // Arial/Helvetica are common fallbacks; only flag if they are the first family before a comma
    const firstFamily = v.split(":")[1]?.split(",")[0] ?? "";
    if (/\barial\b/.test(firstFamily)) hits.push("Arial");
    if (/\bhelvetica\b/.test(firstFamily)) hits.push("Helvetica");
    if (hits.length) {
      findings.push({
        ruleId: "anti-forbidden-font",
        severity: "warn",
        message: `Forbidden primary typeface ${hits.join(", ")} — pair a characterful display font (Syne, DM Serif Display, etc.) with a refined body font.`,
        excerpt: excerptOf(css.all, m[0]),
      });
      break; // one warning is enough
    }
  }

  // purple gradient on white
  if (/linear-gradient/i.test(css.all) && /(purple|#8a2be2|#a78bfa|oklch\([^)]*30[0-9]\b)/i.test(css.all)) {
    // Check if near white background exists
    const whiteBg = /background[^;]*#fff|background[^;]*#ffffff|background[^;]*white/i.test(css.all);
    if (whiteBg || /linear-gradient[^;]*purple/i.test(lower)) {
      findings.push({
        ruleId: "anti-purple-gradient",
        severity: "warn",
        message: "Purple gradient on white detected — the most recognizable AI default. Commit to a sharper palette (e.g. deep navy + warm amber, charcoal + acid green).",
      });
    }
  }
  // Tailwind blue/gray as whole neutral scale heuristic
  if (/#3b82f6/i.test(css.all) && !hasRoot) {
    findings.push({
      ruleId: "anti-tailwind-blue",
      severity: "warn",
      message: "Tailwind blue (#3b82f6) as a primary — use oklch() and a committed palette instead.",
    });
  }

  // symmetric 3-col card grid as only layout idea
  const cardCount = countMatches(lower, /class=["'][^"']*card[^"']*["']/gi);
  const gridCols3 = /grid-template-columns[^;]*repeat\s*\(\s*3/i.test(css.all);
  if (cardCount >= 6 && gridCols3) {
    findings.push({
      ruleId: "anti-card-grid",
      severity: "warn",
      message: "Six identical card-like elements with a symmetric 3-column grid as the only layout — use asymmetry, overlap, offset columns, or grid-breaking heroes.",
    });
  }

  // solid white only background
  const hasWhiteBg = /background[^;]*#fff\b|background[^;]*#ffffff\b|background\s*:\s*white\b/i.test(css.all);
  const hasGrain = /noise|grain|radial-gradient|pattern|svg/i.test(lower);
  if (hasWhiteBg && !hasGrain && css.all.length < 2000) {
    findings.push({
      ruleId: "anti-white-bg",
      severity: "warn",
      message: "Flat white background with no grain/pattern/radial glow — add a subtle grain overlay (SVG noise ~0.04 opacity) or geometric pattern.",
    });
  }

  // --- craft-polish ---
  // TODO/debug remnants
  if (/\bTODO\b|\bFIXME\b/i.test(html)) {
    const m = /\b(TODO|FIXME)\b[^<\n]{0,40}/i.exec(html);
    findings.push({
      ruleId: "polish-todo",
      severity: "error",
      message: "Debug marker (TODO/FIXME) left in output — remove before finishing.",
      excerpt: m ? excerptOf(html, m[0]) : undefined,
    });
  }
  // generic "User" / "Item 1" / "Item 2" placeholders
  if (/>Item 1</i.test(html) || />User</.test(html) || />Item \d+</i.test(html)) {
    findings.push({
      ruleId: "polish-generic-item",
      severity: "warn",
      message: 'Generic placeholder ("Item 1", "User") found — use specific, plausible content.',
    });
  }

  // interactive elements with no state change
  const clickableCount = countMatches(html, /<(button|a\b[^>]*role=["']button["'])[^>]*>/gi);
  const hasHandler = /onclick|addEventListener|\.addEventListener|data-action|aria-pressed|role="tab"/i.test(html);
  if (clickableCount >= 3 && !hasHandler) {
    findings.push({
      ruleId: "polish-no-interaction",
      severity: "warn",
      message: "Multiple clickable elements but no observable state change (onclick/addEventListener/tab switch). Every control should do something visible.",
    });
  }

  // size change on hover
  if (/:\s*hover[^}]*\{[^}]*(width|height|font-size)\s*:/i.test(css.all)) {
    findings.push({
      ruleId: "polish-hover-size",
      severity: "warn",
      message: "Hover rule changes size (width/height/font-size) — avoid layout shift on hover; use transform/opacity instead.",
    });
  }

  return findings;
}

export function formatReport(findings: Finding[], fileLabel = "index.html"): string {
  if (findings.length === 0) return `${fileLabel}: all static checks passed.`;
  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");
  const lines: string[] = [];
  lines.push(`${fileLabel}: ${errors.length} error(s), ${warns.length} warning(s) from static design_check.`);
  for (const f of findings) {
    const icon = f.severity === "error" ? "x" : "!";
    lines.push(`[${icon} ${f.ruleId}] ${f.message}`);
    if (f.excerpt) lines.push(`  excerpt: "${f.excerpt}"`);
  }
  if (errors.length > 0) lines.push("Fix errors, then re-run design_check or re-save index.html.");
  return lines.join("\n");
}

// DESIGN.md helpers (used by extension index.ts)
export function designMdFindings(params: {
  designExists: boolean;
  designMtimeMs?: number;
  indexMtimeMs?: number;
  indexTokensChanged?: boolean;
}): Finding[] {
  const out: Finding[] = [];
  if (!params.designExists) {
    out.push({
      ruleId: "baton-missing-design-md",
      severity: "warn",
      message:
        "DESIGN.md not found — create or update it with frontmatter (name), Overview, Colors, Typography, Spacing & Radius per design-commitment.md. It is the cross-run consistency baton.",
    });
    return out;
  }
  if (
    params.indexTokensChanged &&
    params.designMtimeMs !== undefined &&
    params.indexMtimeMs !== undefined &&
    params.designMtimeMs < params.indexMtimeMs - 2000
  ) {
    out.push({
      ruleId: "baton-stale-design-md",
      severity: "warn",
      message:
        "DESIGN.md is older than index.html and tokens in :root changed — update DESIGN.md in the same pass so the next page inherits what was approved.",
    });
  }
  return out;
}
