---
name: asset-options-page
description: Build a simple HTML page that shows media options side by side, so the user can see, play or turn each one, pick one or more, and copy a ready-made text to paste back into the chat. Use this whenever you offer the user two or more choices of an image, icon, sprite, texture, sound effect, music track, video clip, 3D model, font, animation or visual effect.
---

# Asset options page

When the user must choose between assets, do not describe them in chat. Build a page that lets the user see or hear each option. The page gives the user a text to copy and paste back to you.

Write a new page each time. Options differ from task to task, so shape the page to fit them.

## Steps

1. Gather the options. Give each one a number, a short name, a one-line note on how it differs, its source page link, its license, and the file link or local path you will use.
2. Write one self-contained HTML file. Save it in your scratch or temporary folder, unless the user names a place. Do not save it in the project.
3. Open the page in the browser: `open <file>` on Mac, `xdg-open <file>` on Linux, `start "" <file>` on Windows.
4. Tell the user the full path of the page. Ask them to pick and paste the copied text back.
5. When the user pastes the text, act on the picked options.

## Page layout

- A title that names the choice, for example "Hit sound options".
- One short line under the title: "Press Pick on the options you like, then press Copy and paste the text into the chat."
- A grid of cards, one per option. It must work at phone width.
- A copy panel fixed to the bottom of the screen.
- A footer that lists every source and license on the page.

## Each card

- The heading `Option N: <name>`.
- A preview that fits the asset type:
  - Image, icon, sprite or texture: `<img>`. Show textures as a tiled background as well, so the user sees the seams.
  - Sound effect or music: `<audio controls preload="none">`.
  - Video: `<video controls muted loop playsinline preload="metadata">`.
  - 3D model (`.glb` or `.gltf`): `<model-viewer camera-controls auto-rotate>`. Load it with `<script type="module" src="https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js"></script>`. For other 3D formats, show the source page's preview image and a link.
  - Font: a sample line written in that font, loaded from its source.
  - Animation or visual effect: draw it on a `<canvas>` and loop it.
- When it helps, show the asset in its real place, for example the sprite on the game's background, or the effect on the real character.
- The one-line note on how it differs from the others.
- The license, and whether it needs credit.
- A link to the source page.
- A **Pick** button that toggles the option on and off. Show the picked state clearly, and set `aria-pressed`.

If a remote file does not load in the page (some sites block it), download a preview copy next to the page and use a relative path.

## Copy panel

- Show the text that will be copied in a read-only text box. Update it each time the user picks or unpicks an option.
- Disable the **Copy** button until at least one option is picked.
- Copy with `navigator.clipboard.writeText`. If that fails, put the text in a text box, select it, and call `document.execCommand("copy")`. Log the first error with `console.warn`.
- After a copy, change the button text to "Copied" for about 1.5 seconds.

The copied text must hold all you need to act without the page. Use this format:

```
From "<page title>" I picked:
- Option 2: <name>
  File: <direct file link or local path>
  Source: <source page link>
  License: <license>, <credit needed or not>
- Option 5: <name>
  ...
```

## Code

- No build step and no libraries, except `model-viewer` for 3D models.
- Keep the option data in one `OPTIONS` array in the script. Build the cards and the copy text from it.
- Use plain, readable colors with good contrast.
