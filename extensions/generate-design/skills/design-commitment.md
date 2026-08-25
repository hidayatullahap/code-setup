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

`DESIGN.md` carries the approved design plan across runs. There are no shared
components; the file IS the consistency mechanism.

The baton stores the complete design direction the user confirmed:
audience, tone, visual direction, palette, typography, content beats, and
layout approach — not just raw token values.

**Before writing:** if `DESIGN.md` exists in the workspace, read it and adopt
its direction exactly. It wins over your own taste.

**After finishing:** create or update `DESIGN.md` with frontmatter and a
record of the approved design:

```md
---
name: Project Design System
---
## Overview
(audience, tone, visual direction — one paragraph)

## Design Direction (confirmed plan)
(What the user confirmed in Phase 2: audience, direction, beats, layout)

## Colors
(tokens with values)

## Typography
(display + body faces, size ladder)

## Spacing & Radius
(scale values)
```

Add any new stable decision made this run (a new token, a component pattern
that worked). Reuse existing token names; never rename silently.

If a user tweak shifts a stable visual decision — palette shift, font swap,
spacing scale change — update `DESIGN.md` in the same pass so the next page
inherits what the user actually approved, not the older system.

## Plan phase (fresh runs)

On a fresh run, the confirmed plan lives in DESIGN.md once the user approves
it. The plan itself (as Markdown) is the reference the model reads on tweak
turns, so the baton is always grounded in an approved direction, not a draft.
