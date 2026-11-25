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

Pixel **BASSAR** plus a solid mint **PLAY** plate with the letters knocked out in black (ink). **Revised in v2:** the plate is the same height as the wordmark's lowercase body (top of the `a` to the baseline), not a small tag, and PLAY is set in a 5x7 arcade bitmap face (gamer-culture, not the old 3x5). It is one SVG drawn as rects, so there is still no typeface at runtime. Regenerate with `python3 brand/make-playblock.py` (rewrites the lockup in `site/index.html`; CSS width is scaled in `landing.css` so BASSAR stays the same size). Never separate them, never recolour the plate.

## Layout

- The headline has **no mask and no box**. The pixel fog flows straight through it; it is only eased down ~40% by a very wide (~420px), soft swell (`uSoft` in `field.js`) so there is no edge to see. The fog itself was approved as-is ("the pixelated smoke / lava-lamp feel was perfect"): don't dim it further. Other text blocks still use the old rectangular mask.
- Left-aligned, asymmetric. One idea per screen.
- Landing (v4): hero (wordmark top-left, centred headline, one line of what we do, solid mint CTA "See the games" → `/games/`) → "We make horror games" + three facts (Free / In the browser / No gore) → **carousel of the three games** (metaphorical cover + the lore behind each, no autoplay, swipe/arrows/dots) with an "All games" link → "Add yourself to it." with the form. Section gaps are deliberately tight (about 45-70px). `/games/` lists the same three with controls and a button each.
- Covers (`site/covers.js`) are 2:3 canvases (crop to 4:3 on phones), one metaphor per file, rolled per visit and nearly still: VOID//DRIFT two photographs of one treeline (the second closer), RECOVERED RECORDS a table set for four with one plate untouched, TRANSCRIPT a tape of marks with a listening gap. They replace the old posters.
- Game pages: back link + file label, the game in its black frame, one-line instruction, "the file" copy, the access form, the other two files. Same fog, calmer and darker.
- Forms: underline inputs only, mint outline button that fills on hover, sentence-case labels.
- Responsive floor: 500px. Gutter `clamp(20px, 5vw, 56px)`.

## Motion

- **Headlines** decode left-to-right out of the TRANSCRIPT glyph key (mint, dim), then at random: a few letters scramble or drop out, a mint/purple split, or the whole line phases out. A glitching letter keeps its measured width, so lines never reflow.
- **Fog** flows slowly (domain-warped noise). **No apparitions** (the slit / aperture / monolith) — removed in v2: the owner likes the pixelated, abstract, cosmic-horror smoke on its own, so nothing draws over it. Occasionally a band of rows tears sideways for a split second.
- **Posters** are generators: an endless run of torn columns with the drifter threading each gap; a corridor whose walls disagree about where it ends, with a figure slowly approaching; rings of irregular marks where any mark crossing the line is struck and the centre answers.
- **The PLAY plate is haunted** (`site/plate.js`): a few specks of static flicker on its half-module grid at all times; every 4-12s a poltergeist burst tears rows of the letters sideways, slips a violet ghost out from behind the plate, drops a letter, and inverts the plate for a frame. It stutters bad/clean/bad, then settles. Rolled per visit, never keyed. BASSAR itself never moves.
- Reduced motion: one still frame, no glitch, no flow.
- Ease slowly. No bounce, no spring, no staggered fade-up reveals.

## Voice

Quiet, specific, in-world. The site speaks as the archive: "files", "the record", "filed", "recovered". New copy should come from the lore already written (the fragments, the endings) rather than being invented. Failure messages say what happened and what to do, in the same voice.

## Don'ts

- **Nothing follows the cursor.** The fog's pointer light was removed in v2 as a gimmick. No cursor-tracking, no cursor-triggered effects on the wordmark.
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
| `site/field.js` | shared fog (WebGL), layout-aware masking |
| `site/landing.js` | headline glitch |
| `site/covers.js`, `site/gallery.js`, `site/gallery.css` | cover art generators, the landing carousel, shared cover/button styles |
| `site/games/index.html` | the `/games/` page (the game files themselves sit beside it) |
| `site/landing.css`, `site/bassar.css` | landing / game-page styles |
| `site/games/*.html` | the games themselves (untouched) |
| `src/index.js`, `wrangler.jsonc` | Worker: redirects workers.dev, `www` and http to `https://bassarplay.com` |
| `build.py` | regenerates share tags and the shared capture client — run before deploy |
| `worker/` | the capture API (separate Worker, D1) |

Deploy: `python3 build.py && /opt/homebrew/bin/wrangler deploy` (the local `npx wrangler` is broken — wrong-architecture `workerd`). Cloudflare login must be the julioernestolv account.

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
| `05`–`07` | (historical) the three apparitions, since removed |
| `08`–`10` | the three game pages, desktop |
| `11`–`12` | game pages on mobile |
