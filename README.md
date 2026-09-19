# Bassar capture — deploy notes

Gate 1 is "capture rate exists." This is the thing that makes it exist.

```
bassar-capture/
  client/bassar-client.js      THE capture client. One copy. Edit only here.
  build.py                   puts it everywhere it has to live
  worker/                    the capture endpoint (Cloudflare Workers + D1)
    src/index.js
    schema.sql
    wrangler.toml
  site/                      the arcade (Cloudflare Pages) — deploy this folder
    index.html               front page + the record signup
    bassar.css                 the shared register
    bassar.js                  generated — do not edit
    _headers
    games/*.html             generated — do not edit
    void-drift/index.html    FILE 01 — game + its own drop signup
    recovered-records/       FILE 02
    transcript/              FILE 03
  games/                     the same three games, standalone for itch.io
```

## The build step

The client is now big enough that three hand-kept copies would drift. There is one canonical copy, and a script that distributes it:

```bash
python3 build.py
```

It inlines the client into each game (self-contained, so you can still zip one and upload it to itch), copies those into `site/games/`, writes `site/bassar.js`, and makes sure every page has the markup the client expects. It is idempotent — run it as often as you like.

**Edit `client/bassar-client.js`, never the copy inside a game.** A change made in a game is erased by the next build, and until then you have three clients that disagree.

---

## One deviation from the plan, stated up front

The game comments said **Worker + KV**. This uses **Worker + D1** instead.

Same price ($0), same setup time, but the number you actually need — `captures ÷ plays`, sliced by game and by source — is one SQL query in D1 and a key-listing crawl in KV. D1's free tier (100k row writes/day) is also far past anything the arcade will do. If you'd rather stay on KV, say so and I'll swap it.

---

## Deploy — about fifteen minutes, once

```bash
cd worker
npm install
npx wrangler login

# 1. create the database
npx wrangler d1 create bassar-capture
#    → prints a database_id. Paste it into wrangler.toml.

# 2. create the tables (remote = the real one; --local is a sandbox copy)
npm run db:init

# 3. two secrets. Generate them with: openssl rand -hex 24
npx wrangler secret put STATS_TOKEN   # guards /stats and /export.csv
npx wrangler secret put IP_SALT       # makes stored IP hashes unlinkable

# 4. ship it
npm run deploy
#    → prints https://bassar-capture.<your-subdomain>.workers.dev
```

Then set **one line, in one file** — `client/bassar-client.js` — and rebuild:

```js
const BASSAR_ENDPOINT = "https://bassar-capture.<your-subdomain>.workers.dev";
const BASSAR_SITE     = "https://bassarplay.com";   // optional: where share links point
```

```bash
python3 build.py
```

No trailing slash. `BASSAR_SITE` matters once the games are on itch as well as the arcade — without it, a share link generated inside an itch-hosted copy points back at itch instead of at your own site. Left empty, everything still runs and logs each event to the browser console, which is how you test locally.

## Deploy the site

```bash
cd site
npx wrangler pages deploy . --project-name=the-bassar
```

Nothing in the site hardcodes a domain — all links are root-relative — so it works on the `*.pages.dev` URL Cloudflare gives you and keeps working when you point a real domain at it. Custom domain later: Cloudflare dashboard → Pages → the-bassar → Custom domains.

The games sit in an iframe on their page, same-origin, which is what lets the page and the game share one session id. Someone who lands on the front page, walks into TRANSCRIPT and then signs up is one person on the list, not three.

---

## Three tables, three questions

| table | grain | answers |
|---|---|---|
| `visitors` | one person, across days (localStorage) | did they come back? who sent them? |
| `plays` | one session with one game (sessionStorage) | the capture-rate denominator, and playtime |
| `records` | one signup | the list |

It is three rather than two because a visitor outlives a session. "Did they come back" cannot be answered from inside a row that dies with the browser tab — which is exactly why it was invisible before.

`visitors` deliberately has no `total_runs` / `total_ms` columns. Those are derived from `plays` at read time. Running totals maintained across heartbeats are how counters quietly stop agreeing with the rows they claim to summarise.

## Persistence, and the thing it costs

VOID//DRIFT's own header says *"Every run wipes: no accounts, no persistence, no store."* Measuring whether people come back requires breaking that.

Rather than hide the contradiction, the arcade owns it. A returning visitor is told:

> You have been here before. The record has two visits against you.

And on a game's title screen, in that game's voice — *"You have walked this site before. It walked back."* Someone who arrived on a share link is told that too, on the page and inside the game.

So the tracking is the horror, not something concealed behind it. That was a choice; it is reversible by deleting the `#returnLine` markup and leaving the measurement silent, but the silent version is the one that's actually dishonest.

What is stored: a random id and a share code in the visitor's own browser, and a count of visits. No name, no cross-site anything, no third parties.

## The house

| | | |
|---|---|---|
| `bassarlabs.com` | LABS | make the strange — the games studio |
| `bassarplay.com` | PLAY | play the strange — this arcade |
| `bassarfm.com` | FM | broadcast the strange — the film side |

*Dread is the currency, terror the common tongue.*

The arcade's wordmark is **BASSAR PLAY**; everything signs off **BASSAR**. The code namespace is `BASSAR_*` / `bassar_*` throughout — renamed before launch deliberately, because renaming the `localStorage` keys afterwards orphans every visitor id and resets everyone's visit count to one.

**One note for when Labs and FM go up.** Separate domains are separate origins, and browser storage belongs to one origin. The visitor id, visit count and share code on `bassarplay.com` do not exist on `bassarfm.com` — someone recognised on one is a stranger on the other. The *list* is unaffected, because it lives in D1 behind a shared endpoint. Only the "you have been here before" line stops crossing. If the three sites should ever recognise one person that needs a deliberate identity hop between origins, and it is not worth building until there is a second site to hop to.

## Domains, and moving between them

Nothing in the site hardcodes a host — every link is root-relative, the worker doesn't care what origin calls it, and CORS is open. So pointing a second domain at the same Pages project is a DNS change and nothing else. **The database does not move, does not care, and keeps everything.**

Two things are not domain-agnostic, and both are worth knowing before the test week rather than after.

**1. Browser storage is per-origin, so everyone forgets you.** Visitor ids, share codes and visit counts live in `localStorage`, which belongs to one origin. Move from the borrowed domain to the real one and every tester becomes a stranger again — `visits` resets to 1 and nobody is greeted. For an inner-circle test that is fine, arguably good: the real launch starts from a clean slate. Just don't read the return rate across the move, because it is measuring two different populations.

**2. Share links are minted with the origin they were generated on.** A link someone shares during the test week points at the borrowed domain forever. Two options:

- Leave `BASSAR_SITE` empty during the test and accept that test-week links die at migration. Right if the circle isn't sharing outward.
- Set `BASSAR_SITE = "https://bassarplay.com"` now, so every link points at the final domain from day one. They will 404 until that domain is live — so only do this if the test week is genuinely private and nobody clicks their own link.

A redirect from the old domain to the new one after migration fixes both cases retroactively, and costs nothing. Set one up — Cloudflare does it as a bulk redirect rule.

### Keep the test out of the Gate 1 number

This matters more than the domain question. Friends convert at rates strangers never will. If inner-circle plays land in the same bucket as a reddit launch, the capture rate that decides your calendar is inflated by people who were always going to sign up.

So tag every link you send the circle:

```
https://ptytropicsadvisors.com/transcript/?src=circle
```

Then read the real number from `by_source` rather than the headline, and when the reddit launch happens compare `src=reddit` against `src=circle` directly. If you would rather start clean, wipe instead:

```bash
npx wrangler d1 execute bassar-capture --remote \
  --command "DELETE FROM records; DELETE FROM plays; DELETE FROM visitors;"
```

Tagging is better than wiping. The circle's numbers are the only comparison you will ever have for what a warm audience does, and you get it for free.

### The list is not affected by any of this

Worth saying plainly because it's easy to assume otherwise: the list lives in D1, attached to the Worker. It has no relationship to the domain. Point ten domains at the site and every row stays exactly where it is.

### The migration, in order

1. Deploy the worker and the Pages project. Add `ptytropicsadvisors.com` as a custom domain.
2. `_headers` already carries `X-Robots-Tag: noindex` — leave it while the arcade is on the borrowed domain.
3. Send the circle their links with `?src=circle`.
4. Next week: add `bassarplay.com` as a custom domain on the same project and make it primary.
5. Redirect the old domain to the new one.
6. Set `BASSAR_SITE`, run `python3 build.py`, redeploy.
7. **Delete the noindex block from `_headers`** and redeploy. Nothing else in the launch checklist is this easy to forget or this quiet when missed.

## Four doors, one list

Every signup form on the arcade writes to the same `records` table. What tells them apart is the `surface` column:

| surface | where | what it offers |
|---|---|---|
| `game-end` | the casualty list, inside a game | being on the record; the next player finds your line |
| `drop` | each game's own page | that file's exclusive drop — the rest of the key, the unrecovered fragments, the site documents |
| `index` | the front page | the list across all three files |

So the export is one deduped list with a `surfaces` column showing which doors each person came through, rather than four spreadsheets to reconcile. Someone who files in TRANSCRIPT and later signs up on the front page is **one row**, two filings, both surfaces named.

The per-game drop copy is in each page's `ACCESS` block — that's the part to rewrite as the lore develops. The plumbing doesn't care what it says.

**Page surfaces never count as plays.** A drop or index signup writes a record and nothing else; only a game actually starting writes to `plays`. This matters more than it sounds: if signups minted play rows, the capture rate would climb every time someone signed up without playing, which is exactly backwards.

## What gets recorded

**`POST /play`** — fires once per visitor per game, not per run. Someone who replays VOID//DRIFT thirty times is one play; their run count is kept separately. This is the denominator, and getting it right is the difference between a real capture rate and a flattering one.

A second `/play` fires on page close carrying the final run count and whether they ever reached an end screen.

**`POST /record`** — fires when someone files themselves. Carries name, contact, the game's own score fields, the ending they got, and the source tags.

**Source tagging.** Every event carries `source`, `medium`, `campaign` and `referrer`, read once from the URL on first load and kept for the session. So link out with:

```
https://bassarplay.com/transcript?src=reddit
https://bassarplay.com/transcript?src=itch
https://bassarplay.com/transcript?src=discord
?utm_source= and ?utm_campaign= also work
```

Untagged traffic lands in an `(untagged)` bucket rather than vanishing. The plan called this out as cheap now and expensive to retrofit — it is wired.

**Deduplication.** `r.Ortega@Example.COM` and `r.ortega@example.com` are one person. Phone numbers normalise to digits. Someone who files in all three games is one contact, three filings — the export shows which games they walked.

---

## Reading the number

```bash
curl "https://bassar-capture.<sub>.workers.dev/stats?token=$STATS_TOKEN" | jq
curl "https://bassar-capture.<sub>.workers.dev/stats?token=$STATS_TOKEN&days=30" | jq   # the Gate 1 window
```

Returns:

| field | what it is |
|---|---|
| `capture_rate_pct` | **the Gate 1 number.** Distinct contacts ÷ plays, counting all four doors |
| `in_game_capture_rate_pct` | the casualty list alone, drop forms excluded |
| `capture_rate_of_end_pct` | contacts ÷ people who actually reached an end screen |
| `email_rate_pct` | emails only, phones excluded |
| `by_surface` | filings and contacts per door — which form is doing the work |
| `by_game` | plays, reached_end, avg_runs and capture rate per game |
| `by_source` | the same, per traffic source — the number that tells you where to post next |
| `by_device`, `daily_plays` | mobile/desktop split, and the launch curve |
| `totals.page_views` | front-page and game-page views, kept separate from plays |

**`stickiness`** — `return_rate_pct`, `back_after_a_day_pct`, `back_after_a_week_pct`, `avg_session_seconds`, `avg_runs_per_session`, `session_length` buckets, and `avg_games_per_visitor` / `played_more_than_one_pct`.

That last pair is the arcade's own premise under test. Three games only beat one game if a player who finishes one walks into another. If `played_more_than_one_pct` stays near zero, you don't have an arcade — you have three separate games sharing a domain, and the density strategy in §7 of the plan isn't doing what it's supposed to.

Playtime is measured, not inferred: a heartbeat every 30s while a run is actually live, paused when the tab is hidden, stopped at the end screen. Sitting on a dead screen is not playtime.

**`referral`** — `arrived_on_a_link`, `arrived_on_a_link_pct`, `senders`, `k_factor`.

`k_factor` is invitees per sender. Below 1.0 the arcade needs you posting; above 1.0 it grows without you. At your volumes this will be noisy for months — read it as direction, not as a number.

Three gaps worth reading rather than just the headline:

- **`capture_rate_pct` vs `in_game_capture_rate_pct`** — how much of your list the fiction earns on its own versus how much the drop forms earn. If the drops carry it, the casualty-list mechanic isn't converting and Rung 1 at $3 is a harder sell than the plan assumes.
- **`capture_rate_pct` vs `capture_rate_of_end_pct`** — if lots of plays never reach an end screen, the problem is the game, not the form.
- **`by_source`** — two sources can average to a fine rate while one of them is worthless.

Plan §6 sets the thresholds: **20% clears the bar on two games, 10% clears it at the optimistic end, 5% does not** — at 5% the goal drops or the crowdfund slips a quarter.

---

## The list, off-platform

```bash
curl "https://bassar-capture.<sub>.workers.dev/export.csv?token=$STATS_TOKEN" -o bassar-list.csv
```

One row per person, deduped, with first seen, which games, which surfaces, which sources, which campaigns, and a `rung` column that is 0 for everyone today.

It now also carries **what they actually did**: `minutes_played`, `games_played`, `visits`, `arrived_on_a_link`.

That is the column set that makes the ladder a qualification funnel rather than a mailing list. Plan §2 says Rung 2's buyers are your only EP candidates, and until Rung 2 opens in month nine you have no purchase signal at all. Playtime is the only proxy you'll have in the meantime — someone who walked three files for forty minutes across two visits is a different prospect from someone who bounced in nine seconds and left an address. Sort by `minutes_played` before you write to anybody. When Rung 1 opens at $3, set that column to 1 for the buyers; Rung 2, set it to 2. That is the qualification funnel the plan describes, and it lives in a column rather than a spreadsheet you have to reconcile.

You own this file. No ESP is wired in, deliberately — pick one when you actually need to send something, and import the CSV.

## The Google Sheet

`sheets/Code.gs` keeps a Sheet in step with D1, both ways, so the tagging happens somewhere you will actually do it.

```
  up    the rung and tags you type in the Sheet are pushed to D1
  down  the full deduped list is pulled back and rewritten
```

In that order, every sync. An edit typed thirty seconds ago is saved before the refresh overwrites the row it was typed into — that ordering is the entire design, and it is what a test asserts directly.

**D1 stays the system of record.** The Sheet is a working copy. Sheets has write quotas, no dedupe, and a failed write loses a signup — which is the one thing a capture endpoint must never do, least of all during the traffic spike you built it for. The Worker makes no outbound call at all: Apps Script pulls on a timer, so there is nothing to fail mid-capture.

**Setup** — no OAuth, no service account, no key in the Worker:

1. Make a Sheet. Extensions → Apps Script, paste in `sheets/Code.gs`, save.
2. Run `setUp`. It asks for the Worker URL and your `STATS_TOKEN`, builds the sheets, installs a 15-minute trigger, and syncs once.
3. Authorise when prompted. "Unverified app" is expected — it's your own script on your own Sheet.

**What's editable.** Three columns, shaded yellow: `rung`, `tags`, and `notes`. `rung` and `tags` travel to D1 and come back in the export. `notes` never leaves the Sheet — the sync carries it across by contact, so it survives every refresh.

Everything else is read-only. Edit it and the next sync overwrites it.

**The rule: for `rung` and `tags`, the Sheet wins.** There is no merge and no conflict to resolve, which is the only reason this stays a short endpoint and a short script. Don't set those columns via SQL as well.

**The token.** Stored in Script Properties, never in a cell. Anyone you share the Sheet with can read cells, and that token also opens `/stats` and `/export.csv`.

A `SYNC` tab logs each run with a timestamp and what moved. If a sync fails it says so there — check it before you trust the list.

---

## Abuse and privacy

- **Honeypot** — a hidden field no human ever sees. Anything that fills it is accepted with a cheerful `ok` and written nowhere.
- **Rate limit** — 40 plays and 8 records per IP per ten minutes.
- **IPs are never stored.** Only a salted 10-byte hash, used for rate limiting. Rotating `IP_SALT` orphans every old hash.
- **CORS is open by default** (`ALLOWED_ORIGINS = ""` → `*`). This is deliberate: itch.io serves HTML games from randomised hosts you cannot predict, so an allow-list would break the itch launch. Once BASSAR domain is the only home, put it in `wrangler.toml`.
- A name filed with no contact is stored as a name only, flagged `contact_kind = 'none'`, and never counted in the capture rate.

One decision left to you: the games say "add yourself to the record" and "leave a contact to receive the rest of the file," and the code records `consent = 1` when a contact is given. That is an opt-in by any ordinary reading, but if the list ever gets big enough to matter in the EU, the wording is where a lawyer would start.

---

## Things found while testing

**The referral had no payoff where it lands — fixed.** Someone arriving on a share link went straight to a game page and was told nothing about it. The whole point of "the next one to walk it will find your line" is that the next one knows. They are now told on the page and again inside the game.

**`/record` stopped carrying the run count — caught by a regression test.** When the client was rebuilt around heartbeats, `runs` and `ended` moved into the beat payload and quietly fell out of the signup payload. Every record would have been filed with zero runs against it, which is the single most useful thing on the row. Restored.

**The build skipped its own wiring.** `build.py` checked whether a game already contained `bassarBindShare(` before inserting the call — but the client it had just inlined *defines* that function, so the check always matched and the call was never added. Share boxes rendered empty. It now looks for the call, with the game's own slug.

**A long session looked like flooding.** The rate limiter counted rows per IP, and heartbeats are rows. A player who stayed ten minutes would have been throttled for it. It now counts distinct sessions.

**A page signup could mint a phantom play — fixed.** The worker inserts a play row behind any end-screen filing, so a record never exists without a play. When the drop and index forms were added, that fallback fired for them too, inventing plays that never happened and letting a game report a capture rate above 100%. Now gated on the filing actually coming from inside a game.



**TRANSCRIPT could not end if you did nothing — fixed.** `phraseEnd` was a single variable, and because phrases spawn 1.5s ahead of time, each new phrase overwrote the previous one's end before it elapsed. `dryPhrases` never incremented, so `SIGNAL LOST` was unreachable. A player who opened the channel and didn't strike sat in the static forever, never saw the end screen, and therefore never saw the capture form. It is now a queue (`phraseEnds`), which is what the original logic intended. Verified: doing nothing now ends in `SIGNAL LOST` after four dry phrases.

**The capture buttons used to lie.** All three said "Filed" / "Received" the instant you clicked, whether or not anything was sent. They now wait for the server and say so if it failed, in register: *"The record did not take. Try it once more."*

---

## Verification that was run

Four suites, all green. Re-run them after any change to the client or the worker.

- **Worker**, against a real SQLite database on the same schema — 61 checks: dedup, email/phone normalisation, cross-game identity, surface routing and the page/play separation, visitor upsert, return counting that never goes backwards, referral claimed once and never overwritten, playtime keeping the max against out-of-order beats, honeypot, rate limiting (including thirty heartbeats from one session not tripping it), auth on both read routes, the stats maths, CSV export, CORS preflight and an allow-listed origin, malformed input.
- **Games**, played to an end screen in headless Chromium against a live endpoint: no page errors, one play row per visit however many beats, source and campaign tags survive the URL, `/record` carries runs, playtime and the game's own scores, and the UI confirms only on a real success.
- **Site**, clicked through at 390px mobile: all three files listed, no horizontal scroll on any page, nothing for sale anywhere, each game's iframe loads and starts, the query string survives the frame boundary, all four doors file under one session id into one list.
- **The Google Sheet sync**, running the real `Code.gs` in a sandbox with the Google globals stubbed by an in-memory spreadsheet, against the real Worker: the sheet builds from an empty state, the double filer appears once, behaviour columns land in the right columns, push provably happens before pull, a typed rung and tag reach D1 and come back down intact, and a private note survives a full refresh.
- **Visitors, playtime and referrals**, across two browser profiles: the same person recognised in a new tab with the visit count risen and the in-world line shown, playtime measured from the run rather than the wall clock and frozen once the run ends, a share link carrying the right code and destination, and a second profile arriving on that link marked as referred — on the page, inside the game, and still marked after browsing on.
