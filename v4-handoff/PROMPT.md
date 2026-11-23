# BASSAR PLAY — chat v4 prompt

Paste everything below the line into a new chat, working directory `/Users/jelv/BASSAAR/bassar`.
Written 2026-11-22 at the end of the v2/v3 work, **updated after the production deploy**. Repo: `dr-p1n/bassar-play-ARCADE`, branch `arcade` (everything deployed is committed and pushed).

---

You are continuing BASSAR PLAY, a free arcade of three horror games (VOID//DRIFT, RECOVERED RECORDS, TRANSCRIPT) live at https://bassarplay.com. The owner (Julio) is officially a **videogame designer**. Brand thesis: **a place for the terrific sublime** (Burke: terror, vastness; zero gore). Reply in the language the owner writes in (they mix English and Spanish).

Read first, in this order: `v2-handoff/DESIGN-LANGUAGE.md` (the design rules), `docs/BRAND.md` (the brand sheet, approved as written), `v2-handoff/V2-KICKOFF.md`, `v2-handoff/CONTACT-EMAIL-PROPOSAL.md`, `v2-handoff/ERROR-LOGGING.md`, `copy-export/bassarplay-site-copy.md`.

## How to work with this owner
- Do the steps in the order given and **stop after each for review** when they ask. Don't touch the events work (migration `0002`, `/events`) until they approve the five queries in `v2-handoff/queries-draft.sql`.
- Confirm before anything outward-facing: deploys, migrations on production, DNS, email, deletes. Deployments need their explicit word each time. The 2026-11-22 deploy was approved with "deploy".
- Never wipe the production database (real plays and signups exist). Never delete anything on their Cloudflare account without asking.
- They react fast to visuals. Their taste so far: they love the pixelated, abstract, cosmic-horror smoke (the fog); they dislike boxes behind text, cursor tracking, apparitions, gimmicks and "AI slop" tells. Show screenshots before deploying.

## State at handoff
**DEPLOYED to production on 2026-11-22** (bassarplay.com, capture worker `bassar-capture`):
- Landing: centred headline, fog flows through it (no mask), new PLAY plate (same height as the lowercase wordmark, 5x7 arcade letters, static and poltergeist bursts via `site/plate.js`). Removed: `03:14`, the "heat" line, cursor-following light, apparitions. Share-preview description: "The currency is dread. Free horror game arcade."
- `/record/` (leaderboard): top 5 per file, the rest in a drop-down, seeded entries kept. `GET /leaderboard` on the capture worker (names and scores only, cached 60 s).
- `/contact/` and `POST /api/contact`; production D1 got `0004_messages.sql` (before it, a backup of the production database was taken to the session scratchpad: 116 rows, 3 tables). Site nav `FILES · THE RECORD · CONTACT` on every page via `build.py`.
- Verified live: all pages 200, `noindex` still on, www and http redirect to https, a real contact message stored (`notified = 0`) and then deleted. Production holds 3 real records and 0 messages.
- Staging is local only: worker `--env staging --local`, `python3 build.py --staging --endpoint http://localhost:8787`.
- **Side effect to know about:** the rebuilt games now try to send gameplay events and error reports to `/events` and `/errors`. Production has no `events`/`errors` tables (`0002`/`0003` were deliberately not applied), so those requests fail with a 500 and are dropped silently; players see nothing and no data is stored. The moment `0002`/`0003` are applied, collection starts, so apply them only after the owner approves the queries.
- `copy-export/` old variants (fonts, old index files, screenshots, 11 MB) are deliberately **uncommitted**; decide to delete or ignore.

## What was done in the deploy (for reference; nothing left to run)
`python3 build.py` -> production D1 backup -> `0004_messages.sql` on production -> `wrangler deploy` in `worker/` -> `wrangler deploy` at the repo root -> live smoke test. Do **not** run `0002_events` / `0003_errors` on production unless the owner approves them.

## My recommendations (everything I recommended, in priority order)
**Infrastructure**
1. **Real staging database.** The Cloudflare account is at the 10-database D1 limit, so `bassar-capture-staging` was never created. Either the owner frees a slot (`panama-treasures-enquiries` and `datrum-platform` are 12 KB each; verify before deleting) or upgrades to Workers Paid. Then: create it, paste the id into `[env.staging]` in `worker/wrangler.toml`, apply `schema.sql` and the migrations remotely, set staging `STATS_TOKEN` and `IP_SALT`, deploy `--env staging`, and deploy the staging arcade with `wrangler.staging.jsonc`. Run every future migration on staging first.
2. **Email for the Contact page.** Today messages are stored but nobody is told (`notified = 0`). Recommended: Cloudflare Email Service with a `send_email` binding. Needs: Workers Paid, onboarding `bassarplay.com` for Email Sending, a sender address on the domain, and the owner typing the recipient into `wrangler secret put CONTACT_TO` (staging, then production). It adds DNS records and a DMARC record if none exists, so do it in the same sitting as the open DNS email-protection job (null MX / SPF / DMARC). Details and the fallback (a provider such as Resend) are in `CONTACT-EMAIL-PROPOSAL.md`. Check the live docs first; the product is new.
3. **DNS email protection** for the domain (dashboard job) is still open.
4. **Tighten `ALLOWED_ORIGINS`** in `worker/wrangler.toml` once bassarplay.com is the only home (it is empty, meaning any origin, because of itch.io).
5. Delete the stray `the-bassar` worker noted in `DEPLOY.md`; leave `ptytropicsadvisors.com` untouched.
6. **`DEPLOY.md` is stale** (still describes `ptytropicsadvisors.com`). Rewrite it from the deployment checklist above.

**Product decisions awaiting the owner**
7. **VOID//DRIFT has no name field** on its end screen, so its leaderboard rows all read "anon". Either add one (changes the game's own UI; the design rule says leave game UI alone for now) or accept it.
8. **"Time walked" is not stored per run** for RECOVERED RECORDS; the board shows distance instead. Either accept, or store per-run time in `detail` (a small game change).
9. **VOID//DRIFT board has no seeded entries** (the other two do). It shows "Nothing filed yet." until real filings arrive. Seed it in the same voice, or leave it.
10. Future "endings found" column on `/record/` comes with the events work; the grid already has room.

**Art direction**
11. **Brand sheet vs. the actual site.** `docs/BRAND.md` says black background, no other colours, no gradients, one mint element per view, one type family, centred layout. The site really uses a purple fog palette, several mint elements per view, two families (Archivo + Instrument Sans), and left-aligned content below the hero. Decide whether to edit the sheet to match the site or change the site. Don't silently do either.
12. Game pages repeat their instruction twice (in the frame and again below it); cut one. TRANSCRIPT's "THE FILE" repeats the in-frame text almost word for word.
13. Footer "BASSAR" (soot colour) is near-invisible on mobile.
14. Share-preview description is now **"The currency is dread. Free horror game arcade."** (owner's wording; applied to `meta description` and `og:description` in `site/index.html`, deployed; social scrapers may cache the old preview for a while). The on-page headline is unchanged. The "terrific sublime" thesis wording is still not used in public copy.
15. If the PLAY plate strokes look weak at header size on a real phone, thicken to 2-module strokes on a 4x6 grid (`brand/make-playblock.py`).
16. Posters still lift 6 px on hover and the game names glitch on hover. They react to the cursor but don't track it; the owner hasn't said whether they want those gone.
17. Any "scale cue" for the sublime must now be static and part of the page, not an effect.

**Process**
18. Real-device pass: a real phone, Safari, a slow connection. So far everything was checked in headless Chrome only.
19. Intake: create the Google Sheet and run `sheets/Code.gs` `setUp` (the owner pastes the stats token into the prompt; it never goes in a cell). Weekly triage, the tag set and the reply rule are in `V2-KICKOFF.md`. Add a one-line "how this is used / how to leave" under the forms before any outbound email.
20. Regenerate `copy-export/bassarplay-site-copy.md`: it lacks the nav, `/record/` and `/contact/` text.
21. Remove `noindex, nofollow` (`site/_headers`) only at the real launch.

## Gotchas learned the hard way
- In `worker/`, wrangler picks up the repo-root `wrangler.jsonc`. Always pass `--config wrangler.toml` there.
- Use `/opt/homebrew/bin/wrangler`, not `npx wrangler` (wrong-arch `workerd`).
- `python3 build.py` (no flag) rewrites real files; `--staging` writes to `.staging/` only.
- Migrations: `0003` was already taken, so Contact is `0004`. Number the next one `0005`.
- Be careful with `re.sub` on CSS: it replaces **every** match. A greedy-looking cleanup once deleted a closing brace in `landing.css` and silently broke the mobile block. Brace-balance CSS after scripted edits.
- The built-in browser pane draws the WebGL fog very slowly, so captures often show black for 10+ seconds, and canvas readback returns zeros. Wait, or judge in a normal browser.
- `field.js` is shared by every page. The headline fog zone is a soft swell (`uSoft`), not a mask; don't reintroduce a hard box.

## First moves for v4
1. Resolve the staging-database blocker (recommendation 1).
2. Work through the open decisions (7 to 11, 16) with the owner, one batch at a time.
3. Then email (2 and 3), then the real-device pass (18).
