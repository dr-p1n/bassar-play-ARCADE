# MVP deploy — the borrowed apex

The arcade goes up on **`ptytropicsadvisors.com`** (apex) for the test week, then
moves to `bassarplay.com` when that domain is affordable. README §"Domains, and
moving between them" covers the move itself. This file covers only the things
that are true of *this* deploy and are not in the README, because they were not
true when it was written.

## Read this before you touch DNS

The apex is **not idle**. It currently serves a live Next.js site —
*"PTY Tropics Advisors | Local Roots, Global Mind"* — from **Netlify**, with
Cloudflare proxying in front of it. The apex 307-redirects to `/homepage`.

Adding `ptytropicsadvisors.com` as a Pages custom domain replaces that record.
The advisory site keeps running at its own `*.netlify.app` URL, but it stops
answering on this hostname the moment the record changes.

### The rollback record, and what this snapshot cannot tell you

As seen from outside, 2026-09-19:

| name | type | value |
|---|---|---|
| `ptytropicsadvisors.com` | A | `104.21.25.54`, `172.67.222.247` |
| `ptytropicsadvisors.com` | AAAA | `2606:4700:3035::ac43:def7`, `2606:4700:3036::6815:1936` |
| `www` | A / AAAA | identical to apex |
| apex | MX | *none* — no email on this domain, so nothing to break |
| apex | TXT | *none* |

**Those A records are Cloudflare's own anycast IPs, not Netlify's.** The record
is proxied, so the real origin is hidden behind it and cannot be recovered from
outside the dashboard. Restoring service from the table above is therefore *not*
possible.

So, first step, before anything else: open Cloudflare → DNS → Records, and copy
the existing apex and `www` entries somewhere — the real target (almost
certainly a CNAME to a `*.netlify.app` host, CNAME-flattened at the apex) only
exists there. Without it the advisory site cannot be put back.

## Order of operations

`www` is left pointing at Netlify below. If you want the arcade on `www` too,
add it as a second custom domain on the same Pages project — but then the
advisory site is fully off the domain, so decide deliberately rather than by
default.

```bash
# 1. the database
cd worker
npm install
npx wrangler login
npx wrangler d1 create bassar-capture     # → prints database_id
```

Paste that id into `worker/wrangler.toml`, replacing `PASTE_DATABASE_ID_HERE`.
Nothing deploys until this is done.

```bash
# 2. tables, secrets, ship
npm run db:init
npx wrangler secret put STATS_TOKEN       # openssl rand -hex 24
npx wrangler secret put IP_SALT           # openssl rand -hex 24
npm run deploy                            # → https://bassar-capture.<sub>.workers.dev
```

```bash
# 3. one line, one file, then rebuild
#    client/bassar-client.js:
#      const BASSAR_ENDPOINT = "https://bassar-capture.<sub>.workers.dev";
#    Leave BASSAR_SITE empty — share links then mint on whatever origin
#    serves them, which is what you want while the domain is borrowed.
python3 build.py
```

`build.py` writes the client into `ARCADE/*.html` (the standalone itch.io
copies), mirrors those into `site/games/`, and regenerates `site/bassar.js`.
It is idempotent. Never edit the client inside a game.

```bash
# 4. the site — direct upload, so nothing auto-ships on a git push
npx wrangler pages deploy site/ --project-name=the-bassar
```

5. Cloudflare → Pages → `the-bassar` → Custom domains → add
   `ptytropicsadvisors.com`. **This is the step that takes the apex off
   Netlify.** Do it after step 4, so the domain resolves to a working arcade
   rather than an empty project.

6. Send the circle links tagged `?src=circle`:
   `https://ptytropicsadvisors.com/transcript/?src=circle` — then read the real
   number out of `by_source`, not the headline. README §"Keep the test out of
   the Gate 1 number" explains why this is not optional.

```bash
# 7. read it
curl "https://bassar-capture.<sub>.workers.dev/stats?token=$STATS_TOKEN" | jq
```

## Still carrying `noindex`

`site/_headers` sends `X-Robots-Tag: noindex, nofollow` on every path. On a
borrowed advisory-firm domain that is correct and should stay: an indexed trail
of a horror arcade on this hostname outlives the test week.

Delete that block **only** at the real-domain launch — README step 7. It is the
quietest thing on the checklist to forget.

## Known-open, deliberately

`ALLOWED_ORIGINS = ""` in `worker/wrangler.toml` means any origin may POST.
That is intentional: itch.io serves HTML games from randomised hosts you cannot
enumerate. The worker rate-limits on hashed IP instead — 40 plays and 8 records
per 10-minute window, counted on distinct sessions so a real player's
heartbeats never throttle them. Adequate for a private test; tighten the origin
list once the arcade's own domain is the only home.
