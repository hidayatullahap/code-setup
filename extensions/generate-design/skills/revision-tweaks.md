---
schemaVersion: 1
name: revision-tweaks
description: >
  How to handle follow-up natural-language edits ("make the hero darker",
  "the pricing section needs breathing room"). Minimum coherent change,
  token-first implementation, DESIGN.md kept truthful.
aliases: [revision, tweaks, edit]
---

## Revision mode

- Re-read the current `index.html` in full before editing. Never edit from
  memory of what you wrote.
- Make the minimum coherent change. Preserve everything outside the named
  section unless the request forces otherwise. No drive-by restyling.
- Locate the section the user points at by its semantic landmark, heading, or
  class names — ask only if the target is genuinely ambiguous.

## Implement through tokens

- Prefer changing an existing `:root` custom property over editing inline
  values. Add a new token only when the value will recur or the user names it
  as a persistent choice.
- If the change is section-local and one-off, scoped styles are fine; do not
  promote every tweak to a token.

## Keep the baton truthful

If a revision alters a stable visual decision — palette shift, font swap,
spacing scale change — update `DESIGN.md` in the same pass so the next page
inherits what the user actually approved, not the older system.

## Scope guard

If the request implies a full redesign ("make it pop", "new direction"),
say so, confirm the new direction in one sentence, then treat it as a fresh
run under the design-commitment rules rather than a patch.
