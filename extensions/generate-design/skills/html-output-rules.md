---
schemaVersion: 1
name: html-output-rules
description: >
  Hard output contract for generated index.html pages: self-contained file,
  tokenized visual values, semantic markup, responsive behavior, real content.
  Load as a system-prompt section for every run.
aliases: [output-rules, contract]
---

## Output contract

- One file: `index.html`. Self-contained: inline CSS and JS. No external
  scripts or stylesheets unless the user names one explicitly.
- No external API calls. Inline all mock data.
- No hotlinked images from any host. Use inline SVG, CSS shapes, gradients,
  or data URIs.
- Content must be domain-specific and plausible: no lorem ipsum, "John Doe",
  "Acme Corp", round-number filler stats ("100%", "1,234"), stale dates.
- Semantic landmarks (`header`, `nav`, `main`, `footer`), exactly one
  `<h1>`, a clean heading hierarchy, alt text on every image, visible focus
  states on interactive elements.
- Links navigate to real targets. Anything without a destination renders as
  a button with hover/press feedback, not a dead `href`.
- Every color, spacing, radius, and font value comes from a `:root` custom
  property. No one-off inline values for load-bearing visuals.
- Responsive: `box-sizing: border-box` globally, `clamp()` for display type
  with conservative bounds, `max-width: 100%`, no horizontal clipping at a
  360px viewport. Never scale body text directly with viewport width.
