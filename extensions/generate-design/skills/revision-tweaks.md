---
schemaVersion: 1
name: revision-tweaks
description: >
  How to handle follow-up natural-language edits ("make the hero darker",
  "the pricing section needs breathing room"). Minimum coherent change,
  token-first implementation, DESIGN.md kept truthful, and how to handle
  vague requests that need intent clarification.
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

## Vague requests — ask for intent

If a tweak request is vague enough that the scope is unclear, do not guess.
Ask the user to clarify:

> "Should this be a small targeted change, or are you looking for a full
> redesign?"

Do not proceed until the user answers. If they say redesign, treat it as a
fresh run — go through the Phase 2 proposal step again with the new direction.
If they say targeted, make the smallest coherent change that addresses their
words.

Examples of vague requests that need this check:
- "make it pop"
- "redo the hero"
- "new direction"
- "fresh look"
- any request where you cannot identify the specific section or change
  without guessing intent

## Scope guard

If the request explicitly implies a full redesign, say so and confirm the
new direction in one sentence, then treat it as a fresh run under the
design-commitment rules rather than a patch.
