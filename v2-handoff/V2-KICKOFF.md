# BASSAR PLAY — chat v2 kickoff

Read `DESIGN-LANGUAGE.md` first (the seven rules still stand). This file is what changed at the start of v2 and what v2 is for.

## Scope of this sprint

**In:** infrastructure (staging + production), community intake, art-direction review, domain/deploy hygiene.
**Out (deliberately, later sprints):** CMS, CRM, ecommerce. Don't build them; don't pre-wire them beyond keeping `records.rung` / `records.tags`, which already exist.

## Identity

- Julio is officially a **videogame designer**. That is the role line wherever a credit, bio, press line, itch.io profile or footer credit appears. The site has no bio today, so nothing needed changing on the pages; use this line in all new copy and credits.
- Brand thesis (new in v2): **BASSAR PLAY is a place for the terrific sublime** — Burke's sense: terror, vastness, magnitude, the thing too large to hold. Not "horror games". Zero gore stands; the existing headline ("Dread is the currency, terror the common tongue") already sits inside this. Copy not yet changed — candidates below.

## Art-direction review (against the seven rules + the sublime thesis)

Reviewed from the handoff screens only; not yet on a real device.

1. **Rule 1 breach on the landing intro.** In `02-landing-full-desktop.png` the paragraph sits in a visible dark rectangle with hard edges, i.e. a "box laid over the fog", which the don'ts forbid. The fog mask should fall off with a soft, wide feather (or follow the text's own shape) so there is no readable edge.
2. **Sublime needs scale.** The fog reads as generic purple cloud. The sublime comes from magnitude against something small. (Apparitions did this and were removed in v2 — the fog alone is the look.) Any scale cue now has to be static and part of the page, not an effect. Old note: they were rare (every 10-25s). Consider one constant human-scale cue in the hero (a tiny still figure or a single far monolith) so the void always has a measure. One idea per screen still applies.
3. **Duplicate instructions on game pages.** The in-frame screen and the line below the frame say the same thing (VOID//DRIFT "Tap, click or press SPACE..." twice; TRANSCRIPT's "THE FILE" repeats the in-frame text nearly verbatim). Cut one. The page-level copy should add lore, not repeat the rules.
4. **Frame vs page.** The black monospace game frame beside the Archivo/Instrument page is intentional (rule 7), and it holds up. Revisit only when the games' UI is redesigned; it will be the biggest remaining seam.
5. **Footer.** `soot` "BASSAR" at the page bottom is close to invisible on mobile. Fine as an easter egg, wrong if it should be the sign-off.
6. **Mobile hero.** About a quarter of the 500px page is empty fog before the headline. Good for dread; check on a real phone that the first fold still shows the headline.
7. **Logo (done this session).** PLAY plate now matches the wordmark body height, arcade 5x7 letterforms, black on mint. At small sizes its 1-module strokes are lighter than BASSAR's chunky strokes. If it looks weak at header size on a phone, thicken to 2-module strokes on a 4x6 grid.
8. **Copy candidates for the thesis** (not applied): meta/OG description "Three free games from a place for the terrific sublime."; keep the headline. Decide before launch since it also goes in `og:description` and the share card.

Open and unchanged: `noindex` still on; real-phone / Safari / slow-connection testing not done.

## Environments

| | Production | Staging |
|---|---|---|
| Capture worker | `bassar-capture` | `bassar-capture-staging` (config done, not deployed) |
| D1 database | `bassar-capture` (id `c0ff5982-...`), real data, do not wipe | `bassar-capture-staging` — **not created on Cloudflare** |
| Secrets | `STATS_TOKEN`, `IP_SALT` | separate values, same names (`--env staging`) |
| Config | top level of `worker/wrangler.toml` | `[env.staging]` in the same file |

**Blocker:** the Cloudflare account is at the **10-database D1 limit** (`wrangler d1 create` refused). Nothing was deleted. Either free a slot yourself, upgrade to Workers Paid, or stay local until then. Candidates the account lists: `panama-treasures-enquiries` and `datrum-platform` (12 KB each) — verify before deleting anything.

Done and verified: staging env in `worker/wrangler.toml` (database id is a zero-placeholder, fine for `--local`); schema applied to a local staging D1 (`visitors`, `plays`, `records`).

To finish staging once a slot exists (commands are in the comment block in `worker/wrangler.toml`): create the DB, paste its id, apply `schema.sql` with `--remote`, set the two secrets, `wrangler deploy --env staging`.

Still to do for a full staging path: the client hardcodes the production endpoint (`BASSAR_ENDPOINT` in `client/bassar-client.js`), so `build.py` needs a staging mode (swap the endpoint and write to a separate output so a staging build can never be deployed as production) plus a staging asset worker.

Gotchas:
- In `worker/`, wrangler picks up the repo-root `wrangler.jsonc`. Always pass `--config wrangler.toml` there.
- `/opt/homebrew/bin/wrangler`, not `npx wrangler` (wrong-arch `workerd`).
- `DEPLOY.md` is **stale**: it still describes `ptytropicsadvisors.com` as the host. Live host is `bassarplay.com`. Rewrite it from `DESIGN-LANGUAGE.md` "Technical map" + this file.

## Community intake (v2 process; a Google Sheet is enough)

Pipeline already built: forms on the pages and in game end screens -> D1 `records` (deduped by `contact_key`) -> `sheets/Code.gs` pulls `/export.csv` into a Sheet every 15 minutes and pushes your `rung` and `tags` edits back. Sheet wins for `rung`/`tags`; `notes` is yours alone.

Process to run on top of it:

1. **Sheet setup (needs you):** create one Sheet, paste `sheets/Code.gs` via Extensions -> Apps Script, run `setUp`, enter the worker URL and the production `STATS_TOKEN` (the token goes in the prompt, never in a cell). Make a second Sheet for staging when the staging DB exists.
2. **Weekly triage (15 minutes, fixed day):** sort `THE RECORD` by `last_seen`; for each new row set `tags`; write anything human in `notes`.
3. **Tag vocabulary (keep it this small):** `player` (played, no ask), `tester` (said yes to playtesting), `press`, `collab` (wants to work with the studio), `reply` (needs an answer from a person).
4. **Rungs** (already in schema): 0 free list, 1 credit, 2 recurring name, 3 executive producer. Only move someone up by hand.
5. **Reply rule:** anything tagged `reply` gets a human answer within 7 days, in the archive's voice.
6. **Privacy before you email anyone:** the form says what the list is for, but there is no sending address yet. Domain email records (null MX / SPF / DMARC) are still open; do those before any outbound mail, and add a one-line "how this is used / how to leave" under the form.
7. **Never wipe production D1**, and never put the stats token in the Sheet, the repo or chat.

## First moves for v2

1. Decide the D1 slot (above), then finish staging end to end.
2. Apply review items 1 and 3 (the fog feather, the duplicate instructions); decide item 8's copy.
3. Create the intake Sheet and run `setUp`.
4. Real-phone/Safari pass, then remove `noindex` at launch (`site/_headers`).
5. Commit and push: the redesign and this session's work are still uncommitted (repo `dr-p1n/bassar-play-ARCADE`, branch `arcade`).

## Update: events, staging build, status (later in v2 chat)

- **Definitions locked:** the five questions, OMTM = % of visitors back within 7 days (return = a later session 6h to 7 days after the first), spread counts arrivals after filing, "end screen" = `ending_reached`. SQL in `queries-draft.sql`.
- **Built, tested on local staging only:** `worker/migrations/0002_events.sql` (events + daily_rollup + `plays.evn` budget column), `POST /events` in the worker, batching client (flush every 10s / 20 events / run end / pagehide via text/plain beacon), `BASSAR.beatReached`, `BASSAR.endingsFound`, `ended(endingId)` call sites, `python3 build.py --staging [--endpoint URL]` (builds into `.staging/`, never touches `site/`), `wrangler.staging.jsonc`, `worker/maintenance/rollup-and-purge.sql` (manual; not on a cron).
- **Not done:** staging DB on Cloudflare (no free D1 slot), production migration, any deploy. **Deploy order when ready:** migrate the DB, deploy the worker, then deploy the site.
- **Beacon fix also helps production:** the old JSON beacon failed cross-origin; the heartbeat on page-leave now actually arrives.
- **Open, pre-existing:** `build.py` fails to add share tags to the redesigned `site/index.html` (no `bassar.css` link to anchor to); the page already carries its own tags, but the build exits non-zero.

## BEFORE LAUNCH — do not forget (checklist, in order)

1. **Free a D1 slot**, create `bassar-capture-staging`, apply migrations `0002_events` then `0003_errors` to staging, test with fake traffic.
2. **Name the real beats and endings** per game (`BEATS-PLACEHOLDER.md`), then wire them in.
3. **Error logging** is built (`ERROR-LOGGING.md`): apply `0003` to production with `0002`, deploy worker before site.
4. **Real-device pass**: iPhone Safari, Android Chrome, a slow connection. Then read the errors report.
5. **Rollup and purge schedule**: `worker/maintenance/rollup-and-purge.sql` (events, 90 days) and `purge-errors.sql` (30 days) are manual.
6. **Intake Sheet**: create it, paste `sheets/Code.gs`, run `setUp` with the production stats token; privacy line under the form; domain email records before any outbound mail.
7. **Fix `build.py` head step** for the redesigned `site/index.html` (exits non-zero; page already has its own share tags).
8. **Refresh `DEPLOY.md`** (still describes `ptytropicsadvisors.com`).
9. **Launch trigger**: remove `noindex` in `site/_headers`; decide the "terrific sublime" copy first.
10. **Commit and push** (nothing from v2 is committed).
