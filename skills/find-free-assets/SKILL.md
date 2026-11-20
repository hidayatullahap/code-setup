---
name: find-free-assets
description: Use this BEFORE you create any asset from scratch. Trigger it whenever a task needs a new image, photo, icon, logo, sprite, texture, background, illustration, sound effect, music track, video clip, 3D model, animation or font, whether you would generate it, draw it, write it as SVG or canvas code, record it, or model it. Search the internet first for a free, open-source asset that allows commercial use. Also use it when the user asks for an asset or a placeholder asset.
---

# Find free assets

Before you make a new asset, look for one that already exists and is free to use in a commercial product. Make your own only when the search finds nothing that fits, or when the user asks you to.

## When to use

Run this skill first, before you start making the asset, when any of these is true:

- The task needs an image, photo, icon, logo, sprite, texture, background or illustration that the project does not have yet.
- You are about to draw an image yourself, for example as SVG, canvas code, CSS shapes or pixel art.
- You are about to generate an image, sound, music track, video or 3D model with a tool or a model.
- The task needs a sound effect, music track, video clip, 3D model, animation or font.
- The user asks for an asset, or for a placeholder until the real asset is ready.

Skip it only when the user gives you the asset, names the exact file to use, or tells you to make it from scratch.

## Steps

1. Write down what you need: the type (image, sound, music, video, 3D model, font, icon), the style, the size or length, and the file format the project uses. Read the project first to find its style, its asset folders and its file formats.
2. Search the sources in the table below with your web search tool. Search more than one source.
3. Open the page of each asset you find. Read the license on that page, not on a search result or a list site. Each asset on a site can have its own license.
4. Keep only assets whose license passes the check below. Collect 3–6 candidates.
5. Show the candidates to the user with the `asset-options-page` skill. Wait for the user to pick.
6. Download the picked assets into the project's asset folder. Put each archive in a new, empty folder before you unpack it. Never run a script or program that came in a download.
7. Record every asset in the project's credits file. Use the file the project already has. If it has none, create `CREDITS.md` at the project root. Record the asset name, author, source page link, license, and any change you made.
8. If nothing fits, tell the user what you searched and why the results did not fit. Ask before you make a new asset.

## License check

Accept:

- CC0 and public domain. No credit needed.
- CC BY (any version). Allowed, but you must credit the author.
- CC BY-SA. Allowed, but you must credit the author, and any changed version must use the same license. Tell the user about this rule before they pick.
- SIL Open Font License (OFL) and Apache 2.0 for fonts.
- MIT, ISC and Apache 2.0 for icons and code-based assets.
- A site's own free license (for example the Unsplash, Pexels, Pixabay or Mixkit license) when it allows commercial use. Read it and note its limits.

Reject:

- Any "NC" (non-commercial) license, such as CC BY-NC.
- Any "ND" (no derivatives, meaning no changes allowed) license when you need to edit, crop, mix or re-time the asset.
- "Free for personal use", "editorial use only", or "demo" licenses.
- Assets with no license, or with a license you cannot find.
- "Royalty-free" assets that still need payment. Royalty-free means no fee per use. It does not mean free.

## Sources

| Type | Sources | License |
|---|---|---|
| Game art (2D, 3D, UI, audio) | kenney.nl | CC0 |
| Game art (mixed) | opengameart.org, itch.io (free game assets) | Each asset has its own license |
| 3D models | quaternius.com | CC0 |
| 3D models | poly.pizza | CC0 or CC BY per model |
| 3D models | sketchfab.com (filter: downloadable, Creative Commons) | Each model has its own license |
| Textures, HDRIs, 3D models | polyhaven.com | CC0 |
| Textures and materials | ambientcg.com | CC0 |
| Photos and images | openverse.org (filter: commercial use), commons.wikimedia.org | Each image has its own license |
| Photos and images | unsplash.com, pexels.com, pixabay.com | Site license |
| Icons | lucide.dev, heroicons.com, tabler.io/icons, fonts.google.com/icons | ISC, MIT or Apache 2.0 |
| Game icons | game-icons.net | CC BY 3.0 |
| Fonts | fonts.google.com, fontsource.org | OFL or Apache 2.0 |
| Sound effects | freesound.org (filter license: CC0 or Attribution) | Each sound has its own license |
| Sound effects | sonniss.com (free GDC audio bundles), pixabay.com/sound-effects | Site license |
| Music | incompetech.com | CC BY 4.0 |
| Music | freemusicarchive.org (filter license), pixabay.com/music, ccmixter.org | Each track has its own license |
| Video | pexels.com/videos, pixabay.com/videos, mixkit.co, coverr.co | Site license |

Licenses on these sites can change. Always confirm the license on the asset page at the time you download it.
