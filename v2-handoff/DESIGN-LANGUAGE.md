# BASSAR PLAY — design language (end of chat v1)

Live at **https://bassarplay.com** · screens in `screens/` · written 2026-11-22.
Use this to start chat v2. Everything below is a decision already made — don't reopen it unless the owner does.

## What this is

A free arcade of three horror games, presented as recovered files: **VOID//DRIFT**, **RECOVERED RECORDS**, **TRANSCRIPT**. Each is whole on its own. The page collects an optional contact ("the record"). The studio's thesis applies: art-house horror, elegant, **zero gore**, dread built from light, sound, distance and composition. The site is the first release and the marketing surface for the studio.

## The seven rules

1. **Content wins. The background never competes.** The fog is noise, so it reads the page layout and fades to near-black under every block of text, headline, poster, form and game frame. Light effects never draw over content. If something fights the text, the background loses.
2. **Mint is the only light.** Everything that glows or can be acted on is acid mint. Nothing else is bright, and nothing is warm.
3. **One pixel layer.** The dithered fog behind the page, plus the BASSAR wordmark. Everything else is smooth vector or type. Pixel treatments must not stack.
4. **Generated, never fixed.** No hand-keyed animation. Every visit rolls its own seed, tint, timings, shapes and speeds. The code makes the art; we set the rules it plays by.
5. **Dread through precision, not mess.** Lovecraft's geometry drawn with Apple's discipline: clean edges, slow eased motion, lots of empty space, one idea per screen. Restraint is the scare.
6. **Things arrive wrong, then settle.** Light never fades in cleanly. It stutters on-off-on, holds, then decays. Text decodes out of glyphs. Motion is rare, so it lands.
7. **The games keep their own UI.** The first release stayed black-and-white inside the frame on purpose. Only the page *around* each game is in this language.

## Palette (no other colours)

| Token | Hex | Use |
|---|---|---|
| void | `#05020a` | page base, behind everything |
| ink | `#0a0414` | poster and panel base |
| line | `#2c1a47` | hairlines, poster borders |
| line-hi | `#6a4ba3` | input underlines, raised borders |
| soot | `#5d4a82` | quietest text (footer) — never body copy |
| ash | `#b3a8cc` | secondary text, labels |
| bone | `#e9e4f5` | body text |
| flash | `#fbf9ff` | headlines, wordmark |
| **mint** | `#72ffc2` | light, links, hover, focus, the PLAY block |
| violet | `#4b2585` | torn slabs, large poster shapes |
| lavender | `#b79be3` | rings and fine poster lines |

Fog ramp (dithered, 4 steps): near-black purple → deep violet → violet → orchid, with a per-visit blue/magenta tint. Never white. Greys are not used anywhere on the landing. No warm tints (cream, beige, amber) — they clash with the fog.

## Type

- **Archivo, width 125 (expanded)** for display. Headlines are weight **300**, sentence case, tracking **-0.03em**, tight leading (~1.06). Titles and names are weight **500**, uppercase, tracking **+0.1em**.
- **Instrument Sans** for everything else (body, labels, forms).
- No serif (tried Bodoni, rejected). No monospace on the landing. Italics are not used.
- Self-hosted in `site/fonts/` (latin subset). No third-party font requests.
- Body copy is always `bone` or `ash`, with a faint dark halo (`text-shadow`) as a safety net over the fog.

## The wordmark

Pixel **BASSAR** plus a solid mint **PLAY** block with the letters knocked out, set on the wordmark's baseline. It is one SVG on a 20px module with a 3×5 pixel font for the P-L-A-Y glyphs. Never separate them, never recolour the block, never set PLAY in a typeface. The `03:14` stamp (blinking mint colon) sits top-right; it comes from the VOID//DRIFT fragment "03:14 — the treeline is closer in the second photograph."

## Layout

- Left-aligned, asymmetric. One idea per screen.
- Landing: hero (wordmark, `03:14`, one line of lore, the headline bottom-left) → intro paragraph → **three posters, level, name only** → "Add yourself to it." with the form. No blurbs, numbering, or captions on the cards.
- Posters are 2:3 (crop to 4:3 on phones). They are canvases, not images.
- Game pages: back link + file label, the game in its black frame, one-line instruction, "the file" copy, the access form, the other two files. Same fog, calmer and darker.
- Forms: underline inputs only, mint outline button that fills on hover, sentence-case labels.
- Responsive floor: 500px. Gutter `clamp(20px, 5vw, 56px)`.

## Motion

- **Headlines** decode left-to-right out of the TRANSCRIPT glyph key (mint, dim), then at random: a few letters scramble or drop out, a mint/purple split, or the whole line phases out. A glitching letter keeps its measured width, so lines never reflow.
- **Fog** flows slowly (domain-warped noise). Every 10–25s an **apparition** appears and is re-rolled each time: a slit of light, an aperture (concentric rings and blades), or a monolith outline. They choose open space, never under content. Occasionally a band of rows tears sideways for a split second.
- **Posters** are generators: an endless run of torn columns with the drifter threading each gap; a corridor whose walls disagree about where it ends, with a figure slowly approaching; rings of irregular marks where any mark crossing the line is struck and the centre answers.
- Reduced motion: one still frame, no glitch, no flow.
- Ease slowly. No bounce, no spring, no staggered fade-up reveals.

## Voice

Quiet, specific, in-world. The site speaks as the archive: "files", "the record", "filed", "recovered". New copy should come from the lore already written (the fragments, the endings) rather than being invented. Failure messages say what happened and what to do, in the same voice.

## Don'ts

- No gore, no jump scares on the site, no autoplay audio, and no sound button (removed on purpose).
- No boxes or panels laid over the fog to rescue legibility — the fog yields instead.
- No second pixel treatment, no new accent colour, no warm greys.
- No fixed, hand-built animation where a generator could do it.
- Don't redesign the games' internal UI yet (see rule 7).

## Technical map

| File | Role |
|---|---|
| `site/index.html` | landing |
| `site/{void-drift,recovered-records,transcript}/index.html` | game wrapper pages |
| `site/field.js` | shared fog (WebGL), apparitions, layout-aware masking |
| `site/landing.js` | headline glitch + the three poster generators |
| `site/landing.css`, `site/bassar.css` | landing / game-page styles |
| `site/games/*.html` | the games themselves (untouched) |
| `src/index.js`, `wrangler.jsonc` | Worker: redirects workers.dev, `www` and http to `https://bassarplay.com` |
| `build.py` | regenerates share tags and the shared capture client — run before deploy |
| `worker/` | the capture API (separate Worker, D1) |

Deploy: `python3 build.py && /opt/homebrew/bin/wrangler deploy` (the local `npx wrangler` is broken — wrong-architecture `workerd`). Cloudflare login must be the julioernestolv account.
Check pins: `?form=0|1|2` fixes an apparition; `?event=1` forces one.

## State at handoff

- Live on bassarplay.com. `noindex, nofollow` is **still on** (remove at the real launch — `site/_headers`, README step 7).
- Capture API and database are unchanged; real data exists (10+ plays). Don't wipe it.
- Not committed/pushed yet: the redesign (landing, field, posters, game-page restyle, `originals/` folder). Repo: `dr-p1n/bassar-play-ARCADE`, branch `arcade`.
- Checked in headless Chrome only — not yet on a real phone, Safari, or with a slow connection.
- Open: DNS email-protection records for the domain (null MX / SPF / DMARC, dashboard job); `ptytropicsadvisors.com` returns 404 (not touched); redirect `workers.dev` once links stop circulating (already in place).

## Screens

| File | What it shows |
|---|---|
| `01-landing-hero-desktop.png` | hero with the headline resolved |
| `02-landing-full-desktop.png` | whole landing, desktop |
| `03-landing-full-mobile.png` | whole landing, 500px |
| `04-hero-decoding.png` | headline mid-decode |
| `05`–`07` | the three apparitions: slit, aperture, monolith |
| `08`–`10` | the three game pages, desktop |
| `11`–`12` | game pages on mobile |
