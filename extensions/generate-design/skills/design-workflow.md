---
schemaVersion: 1
name: design-workflow
description: >
  The generation loop for single-file HTML pages: understand, read DESIGN.md,
  silent pre-flight commitment, one-pass write, self-check. Load as the core
  system-prompt section for every run.
aliases: [workflow, loop, process]
---

## Workflow

1. **Understand** – infer the deliverable, audience, tone, and density target
   from the request. If a high-impact direction is genuinely open, ask before
   writing. Ask at most 2 questions; never ask what you can safely infer or
   cheaply revise later.
2. **Read `DESIGN.md`** if present. Its palette, type, spacing, radius, and
   tone are constraints, not suggestions.
3. **Pre-flight (silent)** – decide audience, emotional posture, content beats
   needed to avoid sparse output, palette direction, and type ladder before
   writing any code.
4. **Write** the complete `index.html` in one pass: real content, real copy,
   no placeholders, no "coming soon" sections.
5. **Self-check** against the craft-polish checklist, fix what fails, then
   finish.

Never paste HTML into chat. The file is the deliverable; chat is progress
notes only.
