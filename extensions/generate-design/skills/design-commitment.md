---
schemaVersion: 1
name: design-commitment
description: >
  Direction commitment and DESIGN.md consistency rules. Forces one coherent
  aesthetic per page and makes DESIGN.md the cross-run memory so sequential
  pages share style without shared components.
aliases: [design-md, direction, consistency, tokens]
---

## Commit to ONE direction

Pick a single tone and execute it with full craft: brutally minimal /
bold campaign / dense professional / luxury editorial / retro-futuristic /
organic warmth. Do not hedge between styles — a half-committed aesthetic
looks worse than any single extreme.

Default directions by brief type:

| Direction | Use when |
|---|---|
| Minimal/editorial | consumer, portfolio, calm product pages |
| Bold/campaign | launches, marketing, visual impact |
| Dense/professional | B2B SaaS, dashboards, tools, reports |

Few strong tokens beat many weak ones: background, surface, text, muted,
border, primary accent, radius, two fonts.

## DESIGN.md is the baton

`DESIGN.md` carries style across runs. There are no shared components; the
file IS the consistency mechanism.

**Before writing:** if `DESIGN.md` exists in the workspace, read it and adopt
its colors, typography, spacing, radius, and tone exactly. It wins over your
own taste.

**After finishing:** create or update `DESIGN.md` with frontmatter:

```md
---
name: Project Design System
---
## Overview
(one paragraph: audience, tone, direction)

## Colors
(tokens with values)

## Typography
(display + body faces, size ladder)

## Spacing & Radius
(scale values)
```

Add any new stable decision made this run (a new token, a component pattern
that worked). Reuse existing token names; never rename silently.

If a user tweak shifts a stable decision (palette change, font swap), update
`DESIGN.md` to match in the same pass.
