---
schemaVersion: 1
name: anti-slop
description: >
  Forbidden generic-AI patterns with concrete substitutions. Prevents the
  default "AI look": Inter font, purple gradients, symmetric card grids,
  placeholder content. Load for every design run; pair every prohibition
  with its replacement.
aliases: [anti-slop, taste, quality]
---

## You default to slop. Break it deliberately.

You tend to produce generic AI output: Inter or system fonts, purple-on-white
gradients, symmetric card grids, flat white backgrounds. Every rule below is a
ban plus the move that replaces it.

### Typography

- NEVER use Inter, Roboto, Arial, Helvetica, or Space Grotesk as the primary
  typeface.
- Instead: pair a characterful display font (Syne, DM Serif Display,
  Instrument Serif, Bebas Neue, Playfair Display) with a refined body font.

### Color

- NEVER use purple gradients on white — the single most recognizable AI
  default. Never use Tailwind blue (#3b82f6) or Tailwind grays as the whole
  neutral scale. No pure #000 text; near-black with a slight hue cast.
- Instead: commit to one palette with sharp contrast — deep navy + warm amber,
  charcoal + acid green, cream + burgundy + gold, near-black + electric cyan.
  Prefer `oklch()` over hex.

### Layout

- NO symmetric 3-column card grids as the only layout idea. No six identical
  feature cards (icon, two-word title, filler sentence). No center-aligned
  body paragraphs.
- Instead: asymmetry, overlap, offset columns, grid-breaking heroes,
  edge-bleeding elements, deliberate rhythm breaks.

### Surfaces

- NEVER solid white or flat gray backgrounds. No Bootstrap-default drop
  shadows. No placeholder gray rectangles as images. No decorative emoji as
  section icons. No logo as a soft square with one random letter.
- Instead: grain overlay (SVG noise at ~0.04 opacity), geometric SVG
  patterns, subtle radial glows, constructed wordmarks or monograms.

### Recurring clichés

- The "minimal dark AI page": near-black everywhere, one purple accent, four
  sparse stat cards.
- Gradient-blob hero with bold sans headline and floating screenshot mockup.
- Testimonials with circular avatars, name, title, five stars.
- Three-column footer with nav links plus social icon row.
- Lorem ipsum, "John Doe", "Acme Corp", hotlinked stock photos.
