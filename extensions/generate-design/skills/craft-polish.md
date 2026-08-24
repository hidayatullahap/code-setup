---
schemaVersion: 1
name: craft-polish
description: >
  Final interaction and detail pass before finishing: working controls,
  three-state feedback (hover/press/focus), surplus details, motion rules,
  empty/error states. Run before declaring done on every artifact.
aliases: [polish, final-pass, craft-pass]
---

## Interactive minimum

Every clickable element must do something: change state, open/close a panel,
switch a tab, reveal content, copy, dismiss, or show a toast. Pure hover does
not count. Static one-pagers only need visible controls to work; decorative
links may be inert when clearly not the point of the page.

Include for app/tool surfaces:

- At least 3 observable state changes.
- Animated transitions for tabs or navigation.
- One empty-state variant for a list, grid, table, or chart.
- Active navigation indicator using shape/weight, not color alone.

## Three-state feedback

Hover, press, AND focus styling on every action. Each state changes at least
two cues: surface, border, shadow, icon, text weight, or transform. Focus
rings must be visible during keyboard navigation.

No card, button, tab, or row changes size on hover.

## Craft surplus

Add at least 3 small details where the surface supports them:

- Stateful badge or counter with a small animation.
- Keyboard shortcut chip.
- Copy-to-clipboard feedback.
- Dismissible toast/banner.
- Tooltip with directional arrow.
- Segmented control, accordion, or drawer.
- Deliberate visual rhythm break.

## Motion

- Under 300ms, usually 120–200ms.
- Animate `transform` and `opacity` only; nothing that triggers layout jank.
- Gate looping or large movement behind `prefers-reduced-motion`.
- One orchestrated staggered page-load beats scattered micro-interactions.

## Empty / loading / error

Operational surfaces get non-happy-path states:

- Empty: explain what is missing plus one next action; no sad blank panels.
- Loading: skeletons matching the final layout, not generic gray bars.
- Error: human-readable cause plus retry or fallback.

## Cleanup

Zero debug labels, TODOs, placeholder copy, lorem, fake filenames, generic
names ("User", "Item 1"). Audit every link target and script reference.
