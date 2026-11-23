# ERROR LOGGING — "is it working?"

Built in v2, **before launch**, because the handoff says nothing has been tested on a real phone or in Safari. This is the part of the system that tells you when a game broke for someone. It is separate from `events` (behaviour: "are they hooked?").

Status: **built and tested on local staging. Not deployed. Not applied to production.**

## 1. What it captures

| `kind` | What it means | Caught by |
|---|---|---|
| `js_error` | an uncaught exception in a game or page | `window` "error" event |
| `promise_rejection` | an unhandled promise rejection | `window` "unhandledrejection" |
| `request_failed` | `/play` or `/record` failed (no network, or non-2xx). Before this, "It did not take" on a signup left no trace. | the client's `post()` |
| `slow_or_stalled` | the first run of a session drew fewer than 10 frames in 5 s while the tab was visible (frozen loop, very slow device) | frame counter in `watchFrames()` |
| `webgl_lost` | a WebGL context was lost (the fog and posters on the site) | capture-phase `webglcontextlost` |

Every row also stores: game (or `site`), session, visitor id, a **build stamp**, device (mobile/desktop), and a **fingerprint** that groups the same crash across players.

## 2. What it never stores
Contact details, names, IP hashes, anything typed into a form. Messages are also cleaned: URL query strings removed, email-like text -> `[email]`, runs of 7+ digits -> `[digits]` (an error message can quote what a player typed). Cleaning happens in the client **and again in the worker**.

## 3. Limits (on purpose)
- **5 errors per session**, counting all games in that browser tab (a tab is one session). Enforced by the client and atomically by the worker (`plays.errn`).
- Identical errors are sent once per page load.
- Messages max 200 chars, source max 120.
- **Deleted after 30 days** (`maintenance/purge-errors.sql`, run by hand for now).
- **Cost:** no secondary index, so each error is exactly 1 row written in D1.
- A failed `/events` or `/errors` request is never reported (prevents feedback loops).

## 4. Known gaps — do not assume these are covered
- A hard browser crash, or a frozen main thread, cannot report itself.
- Errors thrown before `bassar.js` / the inlined client loads are invisible.
- The worker does not log ordinary 4xx/5xx to this table; server-side errors are in Cloudflare's Workers logs (observability is on).
- Real-device coverage (iPhone Safari, Android Chrome, slow connections) has **not** been done. This system exists to find what that testing would find.

## 5. How to read it
```bash
cd worker
/opt/homebrew/bin/wrangler d1 execute <bassar-capture | bassar-capture-staging> --config wrangler.toml [--env staging] --remote --file=maintenance/errors-report.sql
```
Three sections: (1) worst crashes first, by distinct players; (2) share of sessions with an error, per game; (3) errors per build, to compare after each deploy.
Always pass `--config wrangler.toml` inside `worker/` (the repo-root `wrangler.jsonc` otherwise wins).

## 6. Where everything lives
| Piece | File | Section label |
|---|---|---|
| Table + budget column | `worker/migrations/0003_errors.sql` (mirrored in `worker/schema.sql`) | header comment |
| Endpoint `POST /errors` | `worker/src/index.js` | `ERROR LOG — POST /errors` |
| Capture in the browser | `client/bassar-client.js` | `ERROR CAPTURE` ... `end ERROR CAPTURE` |
| Build stamp | `build.py` (`BUILD_ID`) -> `BASSAR_BUILD` in the client | |
| Report / purge | `worker/maintenance/errors-report.sql`, `purge-errors.sql` | |

After editing the client run `python3 build.py` (or `--staging`) — it is copied into all three games and `site/bassar.js`.

## 7. Tested (local staging, 2026-11-23)
Real browser against the local worker: uncaught exception, unhandled rejection, failed signup request, stalled frames, per-session cap, duplicate suppression (by line), worker rejection of unknown session / wrong visitor / unknown kind. A message quoting `alice@example.com`, a phone number and `?token=SECRET123` was stored as `[email]`, `+[digits]`, with no query string (zero leaks). The report SQL and purge SQL both ran.

## 8. Before it counts — deploy checklist
1. A free D1 slot exists, staging DB created, `0002` and `0003` applied to staging; run it with fake traffic there.
2. Apply `0002` then `0003` to **production** (additive; never wipe data).
3. Deploy the worker, **then** the site (order matters: a client that posts `/errors` to a worker without it just gets a 404, harmless but silent).
4. Open each game on a real iPhone and an Android phone; then run the report.
5. Put `purge-errors.sql` and `rollup-and-purge.sql` on a schedule or a calendar reminder.
