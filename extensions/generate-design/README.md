# generate-design extension — mode-based

Pi extension that turns the `generate-design-skill` pack into a pi mode, like `/chat`.

## Mode, not trigger

- **Off by default.** No prompt scanning, no surprise injection.
- **`/design`** enters design mode for this session. Stays on until you leave. Persists across resume / reload / tree navigation via a `custom` entry (`generate-design-mode`).
- **`/design-off`** leaves design mode. `/design-status` shows current state.
- When **ON**, every turn composes the design system prompt:
  - Fresh (no `index.html`): workflow + plan-phase gate + output rules + anti-slop + commitment + polish. First fresh turn must propose a direction and wait for your “go” before writing HTML.
  - Tweak (`index.html` exists): revision-tweaks + output rules + anti-slop.
- When **OFF**, no injection. `design_check` tool and `/design-check` stay available for manual checks.
- Auto design_check after `write`/`edit` to `index.html` only runs when mode is ON, and patches the tool result so the model can self-fix in the same turn.
- Footer shows `🎨 design` + widget “Design mode — structured HTML generation. Run /design-off to exit.”

Input that looks like design work while OFF triggers a confirm dialog: “Enable design mode?” — mirrors `/chat`’s tool-intent nudge.

## What it does in mode

- **Plan-then-implement**: fresh runs require a design proposal in chat before HTML. You confirm or revise, then the model implements. No blind implementation.
- **DESIGN.md baton**: inlines `DESIGN.md` head into the prompt as a constraint and warns in the next turn if `DESIGN.md` is missing or stale.
- **Static checker**: validates `index.html` against html-output-rules, anti-slop, and craft-polish without a browser.

No browser dependency. Runtime JS/layout overflow checks are out of scope; add a Playwright adapter later if needed.

## Layout (inside `dev/etc/setup`)

```
dev/etc/setup/extensions/generate-design/
  index.ts      # mode-based extension (mirrors chat-only pattern)
  checker.ts    # pure static analysis (testable, no pi imports)
  manifest.json # activation: manual via /design
  skills/       # skill markdown — bundled next to the extension
  README.md
```

## Try it

```bash
bash dev/etc/setup/setup.sh

pi
# inside pi
/design                 # enter design mode
# ... generate or tweak pages ...
/design-off             # leave
/design-check           # check ./index.html (works even when off)
/design-check path/to/page.html
/design-new             # force fresh-run composition next turn (only when ON)
/design-tweak           # force tweak-turn composition next turn (only when ON)
/design-status
```

The model can also call the `design_check` tool directly at any time.

## How phase detection works (when ON)

- No `index.html` at `ctx.cwd` → fresh run (plan phase required).
- `index.html` exists → tweak turn (revision mode, no plan phase).
- `/design-new` / `/design-tweak` override the next turn only.

## The plan-then-implement flow

### Fresh runs (no index.html, mode ON)

1. **Phase 1 — Understand**: infer deliverable, audience, tone, density. Ask up to 2 clarifying questions if genuinely open.
2. **Phase 2 — Propose**: post a structured design proposal in chat. You confirm or revise. **No HTML is written during this phase.**
3. **Phase 3 — Implement**: write `index.html`. The confirmed plan is the contract.

Confirmation words: "go", "yes", "sounds good", "confirmed", "do it", "proceed", "ship it", etc.

### Tweak runs (index.html exists, mode ON)

Minimum coherent change. Vague requests (“make it pop”) trigger an intent-clarification prompt first.

## Static checks

See `checker.ts`. Hard errors: missing viewport, hotlinked images, external scripts, missing single `<h1>`, missing `alt`, `lorem ipsum`/`John Doe` placeholders, `TODO`, missing `box-sizing`/`focus` styles, missing `:root` tokens. Warnings: purple gradient on white, symmetric card grids, forbidden fonts, hard-coded colors outside `:root`, missing `clamp()`.

## Paths

All paths resolved relative to `ctx.cwd` (or the extension file location for skills). No absolute hard-coded paths. Inputs starting with `@` have the prefix stripped before resolving.
