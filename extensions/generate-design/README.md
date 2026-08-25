# generate-design extension

Pi extension that turns the `generate-design-skill` pack into an active pi extension.

## What it does

- **Plan-then-implement workflow**: every fresh run requires a design proposal in chat before HTML is written. The user confirms or revises, then the model implements. No blind implementation.
- **Phase-based prompt composition** via `before_agent_start`: fresh runs get workflow + plan-phase gate + output rules + anti-slop + commitment + polish; tweak turns (when `index.html` exists) get revision-tweaks + output rules + anti-slop.
- **Static `design_check` tool**: validates `index.html` against html-output-rules, anti-slop, and craft-polish without a browser. Auto-runs after every `write`/`edit` to `index.html` and patches the tool result so the model can self-fix in the same turn.
- **DESIGN.md baton**: inlines `DESIGN.md` head into the prompt as a constraint and warns in the next turn if `DESIGN.md` is missing or stale.
- **Commands**: `/design-check`, `/design-new` (force fresh), `/design-tweak` (force tweak).

No browser dependency. Runtime JS/layout overflow checks are out of scope for this version; add a Playwright adapter later if needed.

## Layout (inside `dev/etc/setup`)

```
dev/etc/setup/extensions/generate-design/
  index.ts      # extension factory (installed to ~/.pi/agent/extensions/generate-design/)
  checker.ts    # pure static analysis (testable, no pi imports)
  manifest.json # composition source of truth (read at startup, fallback to built-ins)
  skills/       # skill markdown — bundled next to the extension, read via join(extensionDir, "skills", name)
  README.md
```

Source skill pack still lives at `dev/etc/generate-design-skill/` (`skills/` + `manifest.json` + `extension/` mirror) for authoring; `setup/extensions/generate-design/` is the installable pi copy.

## Try it

```bash
# install (copies to ~/.pi/agent/extensions/generate-design/)
bash dev/etc/setup/setup.sh

# project-local is now via ~/.pi/agent (no per-project .pi needed)
pi

# or explicit for testing without trust
pi -e ~/.pi/agent/extensions/generate-design/index.ts
pi -e dev/etc/setup/extensions/generate-design/index.ts
```

Commands inside pi:

```
/design-check            # check ./index.html
/design-check path/to/page.html
/design-new              # force fresh-run composition next turn
/design-tweak            # force tweak-turn composition next turn
```

The model can also call the `design_check` tool directly.

## How phase detection works

- No `index.html` at `ctx.cwd` → fresh run (plan phase required).
- `index.html` exists → tweak turn (revision mode, no plan phase).
- `/design-new` / `/design-tweak` override the next turn only.

## The plan-then-implement flow

### Fresh runs (no index.html)

1. **Phase 1 — Understand**: infer deliverable, audience, tone, density. Ask up to 2 clarifying questions if genuinely open directions remain.
2. **Phase 2 — Propose**: post a structured design proposal in chat. The user confirms or revises. **No HTML is written during this phase.**
3. **Phase 3 — Implement**: write `index.html`. The confirmed plan is the contract.

The plan proposal includes:

```
## Proposed Design Direction
**Audience & Tone:** ...
**Visual Direction:** minimal/editorial | bold/campaign | ...
**Palette:** primary accent, background, surface, muted, text, border
**Typography:** display font + body font
**Content Beats:** list of sections
**Layout Approach:** one-liner
```

Confirmation words: "go", "yes", "sounds good", "confirmed", "do it", "proceed", "ship it", etc.

### Tweak runs (index.html exists)

The model makes the minimum coherent change. Vague requests ("make it pop") trigger an intent-clarification prompt first — the model asks whether this should be a small targeted change or a full redesign.

## Static checks

See `checker.ts` for the full rule list. Hard errors include missing viewport, hotlinked images, external scripts, missing single `<h1>`, missing `alt`, `lorem ipsum`/`John Doe` placeholders, `TODO`, missing `box-sizing`/`focus` styles, and missing `:root` tokens. Warnings cover taste regressions (purple gradient on white, symmetric card grids, forbidden fonts, hard-coded colors outside `:root`, missing `clamp()`).

Each finding carries `ruleId`, `severity`, and an `excerpt` for quick fixing.

## Paths

All paths are resolved relative to `ctx.cwd` (or the extension file location for skills). No absolute hard-coded paths. Inputs starting with `@` have the prefix stripped before resolving, per pi convention.
