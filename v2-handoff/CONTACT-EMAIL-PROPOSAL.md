# Contact page: how the owner gets notified (DECIDED: Resend, 2026-11-22)

Decision: **Resend** (free tier), not Cloudflare Email Service, so no Workers Paid plan is needed.
`notifyContact()` in `worker/src/index.js` now calls the Resend API. It is **dormant until three
things exist**; any missing one leaves the message stored with `notified = 0` (the backlog).

## What the owner does
1. Create a Resend account (free). Check the current free limits on resend.com/pricing.
2. In Resend, add the domain `bassarplay.com` (a sending subdomain such as `send.bassarplay.com`
   is fine). Resend shows DNS records (SPF, DKIM, a return-path MX).
3. Add those records in the Cloudflare DNS dashboard (or ask me to, with your go-ahead; DNS is
   outward-facing). Do this in the same sitting as the open DNS job: SPF and DMARC for the root
   domain, and a null MX if the domain receives no mail. Resend's records live on their own
   subdomain, so they don't clash with the root; check there is only ONE SPF record per name.
4. Create a Resend API key with **sending access only**.
5. Type the secrets yourself so I never see them (staging first, then production):
   `wrangler secret put RESEND_API_KEY --config wrangler.toml [--env staging]`
   `wrangler secret put CONTACT_TO      --config wrangler.toml [--env staging]`
6. Pick the sender and set the var `CONTACT_FROM` in `worker/wrangler.toml`, e.g.
   `BASSAR PLAY <contact@bassarplay.com>` (the address needn't be a real mailbox; its domain must
   be the verified one).

## What it sends
Plain text, one email per message, to `CONTACT_TO`. Subject `[BASSAR] message from <audience>`
(audience comes from a fixed list, so nothing a visitor typed reaches the subject). Body has
audience, name, contact, the message, the id. `reply_to` is set to the sender when they gave an
email, so Reply answers them. Failure never fails the request: the row is already in D1.

## Backlog
Messages sent before this is live stay `notified = 0`. A one-off send for those is a separate
step (ask first). Read them any time with:
`wrangler d1 execute bassar-capture --config wrangler.toml --remote --command "select ts,audience,name,contact,body from messages order by ts desc"`

## Privacy
Resend becomes a processor of the message text and the sender's contact. Mention it in the one-line
"how this is used" note under the Contact form before this goes live.

## Not yet done
Nothing deployed. Code tested with a stubbed `fetch` only; no real email has been sent.
