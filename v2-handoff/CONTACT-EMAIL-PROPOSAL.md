# Contact page: how the owner gets notified (PROPOSAL, nothing set up)

State today: `POST /api/contact` stores every message in the `messages` table (`notified = 0`).
`notifyContact()` in `worker/src/index.js` is a deliberate no-op until this is approved. The
recipient will be the Worker **secret** `CONTACT_TO`, never in code, the repo or any page.

## Recommended: Cloudflare Email Service, `send_email` binding
Sent straight from the Worker. No API key, no third party. Source: Cloudflare docs
(email-service: Workers API, limits, pricing), read 2026-11-22. Re-check before building;
the product is new and moving.

What it needs from the owner:
1. **Workers Paid plan** (docs list it as required for outbound sending). 3,000 emails a month
   are included, then $0.35 per 1,000. Sends to verified destination addresses don't count.
2. **Onboard `bassarplay.com` for Email Sending** (Dashboard > Email Service > Email Sending >
   Onboard Domain). Cloudflare adds SPF/DKIM/MX records on a `cf-bounce.` subdomain, and a
   `_dmarc` record **only if none exists** (default policy `p=reject`). Root MX is unchanged
   (it changes only if Email Routing is turned on). This overlaps the open DNS job (null MX /
   SPF / DMARC): do both in one sitting.
3. **A sender address** on the domain, e.g. `contact@bassarplay.com` (a name only; it needn't
   be a real mailbox).
4. **The recipient**, typed by the owner into `wrangler secret put CONTACT_TO` (staging first,
   then production). I never see it.
5. Approval for me to add `[[send_email]]` to `worker/wrangler.toml`, fill in `notifyContact()`,
   and send one test message to staging.

Then: messages with `notified = 0` are the backlog; a one-off send marks them 1.

## Alternative: an email provider (Resend, Postmark, ...)
Also fine, but more moving parts: an account, an API key stored as a secret, the provider's own
DNS records, and a third party reading every message. Pick only if Workers Paid is unwanted.

## Until one is chosen
Messages are safe in D1 but nobody is told. Read them with:
`wrangler d1 execute bassar-capture --config wrangler.toml --remote --command "select ts,audience,name,contact,body from messages order by ts desc"`
