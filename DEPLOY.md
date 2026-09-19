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

## Current state — deployed 2026-09-19

Live and verified end to end. A play made in a browser reached D1 and came back
out of `/stats`, with the `?src=` tag intact through both the game iframe and
the redirect described below.

| | |
|---|---|
| **the arcade** | **https://bassar.julioernestolv.workers.dev** |
| the capture API | https://bassar-capture.julioernestolv.workers.dev |
| D1 database | `bassar-capture`, id `c0ff5982-2370-4150-a6cf-cd56e7ea1acf`, region ENAM |
| secrets | `STATS_TOKEN`, `IP_SALT` — set on the worker; local copy in `worker/.dev.vars` (gitignored, mode 600) |
| indexing | `noindex, nofollow` confirmed live on every path |
| database | empty — the self-test rows were deleted, so Gate 1 starts from zero |

Read the number with:

```bash
TOKEN=$(sed -n 's/STATS_TOKEN="\(.*\)"/\1/p' worker/.dev.vars)
curl -sS "https://bassar-capture.julioernestolv.workers.dev/stats?token=$TOKEN" | jq
```

### Redeploying

Cloudflare created the arcade as a **Worker with static assets**, not a legacy
Pages project. `wrangler pages deploy` therefore reports `"the-bassar" does not
exist`, which is expected and not an error to debug. The config is
`wrangler.jsonc` at the repo root, and the worker is named `bassar`.

```bash
python3 build.py                      # always first — it regenerates site/
npx wrangler deploy                   # the arcade, from the repo root
cd worker && npx wrangler deploy      # the capture API, separately
```

**One piece of litter to clear:** a first attempt created a second, redundant
worker called `the-bassar` holding an identical copy of the site. Nothing points
at it and it has no custom domain, but it should go:

```bash
npx wrangler delete --name the-bassar
```

### A redirect worth knowing about

The platform's default asset handling 307-redirects `/games/<slug>.html` to
`/games/<slug>`. The game iframes follow it and the query string survives, which
is verified — but it means each game load costs one extra hop. Setting
`html_handling` to `"none"` would remove the hop and simultaneously stop
`/transcript/` resolving to its `index.html`, which is a worse trade. Left at
the default deliberately.

## What is left: the apex

Everything above is on the workers.dev host. Moving to
`ptytropicsadvisors.com` is a Cloudflare dashboard job, and it is the step that
**takes the live PTY Tropics Advisors site off that hostname.**

1. **Cloudflare → DNS → Records. Copy the existing apex and `www` entries
   somewhere first.** The record is proxied, so the real Netlify origin exists
   only in the dashboard — the anycast IPs visible from outside are useless for
   restoring it. Without this copy the advisory site cannot be put back.
2. Cloudflare → Workers & Pages → `bassar` → Settings → Domains & Routes → add
   a custom domain → `ptytropicsadvisors.com`.
3. Change `OG_BASE` in `build.py` to `https://ptytropicsadvisors.com`, then
   `python3 build.py && npx wrangler deploy`. Until this is done, share previews
   point at the workers.dev host — they will still work, but every shared link
   advertises the wrong hostname.
4. Leave `BASSAR_SITE` empty unless you want share links minted on a domain
   that is not yet live. Empty means each link is minted on whatever origin
   served it, which is correct during a move.
5. Leave the `noindex` block alone. It stays until the real domain.

## Still carrying `noindex`

`site/_headers` sends `X-Robots-Tag: noindex, nofollow` on every path. On a
borrowed advisory-firm domain that is correct and should stay: an indexed trail
of a horror arcade on this hostname outlives the test week.

Delete that block **only** at the real-domain launch — README step 7. It is the
quietest thing on the checklist to forget.

Note the ordering trap: `noindex` is what keeps the borrowed domain out of the
index, but it does **not** stop a scraper fetching `og:image` for a link someone
pastes into a chat. Share previews work during the test week even though the
site is unindexed, which is what you want — but it also means the wordmark and
the domain travel together, so only send tagged links to people you meant to.

## Known-open, deliberately

`ALLOWED_ORIGINS = ""` in `worker/wrangler.toml` means any origin may POST.
That is intentional: itch.io serves HTML games from randomised hosts you cannot
enumerate. The worker rate-limits on hashed IP instead — 40 plays and 8 records
per 10-minute window, counted on distinct sessions so a real player's
heartbeats never throttle them. Adequate for a private test; tighten the origin
list once the arcade's own domain is the only home.
