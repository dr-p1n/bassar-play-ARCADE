-- =============================================================================
-- 0004_messages — the Contact page.  Additive only: no drops, no renames.
-- =============================================================================
-- (Numbered 0004: 0003 is already taken by 0003_errors.sql.)
--
-- WHAT IT HOLDS:  one row per message sent through /contact/. This is the ONLY place a
--   contact detail from the Contact page is stored. Same rule as `records`: contact details
--   never appear on a public page and are never returned by any public endpoint.
--
-- COLUMNS BEYOND THE BRIEF (both needed, both additive):
--   ip_hash   salted hash of the sender's IP. Exists only so the worker can rate-limit per
--             IP without a separate store. Never exported, never shown.
--   notified  0 until the email notification (CONTACT_TO) has been sent. While email is not
--             configured, every message stays 0: that is the backlog to send once it is.
--
-- APPLY ORDER: staging first, then production:
--   wrangler d1 execute <db> --config wrangler.toml [--env staging] --remote --file=migrations/0004_messages.sql
-- Safe to re-run (IF NOT EXISTS everywhere).
-- =============================================================================
CREATE TABLE IF NOT EXISTS messages (
  id        TEXT PRIMARY KEY,
  ts        INTEGER NOT NULL,            -- server time, ms
  vid       TEXT DEFAULT '',             -- → visitors.vid, if they came through the site
  audience  TEXT NOT NULL,               -- player | developer | press | partners | producers
  name      TEXT DEFAULT '',             -- optional, as typed
  contact   TEXT NOT NULL,               -- email or phone, as typed
  body      TEXT NOT NULL,               -- max 2000 chars
  source    TEXT DEFAULT '',
  medium    TEXT DEFAULT '',
  campaign  TEXT DEFAULT '',
  ip_hash   TEXT,
  notified  INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_messages_iphash ON messages(ip_hash, ts);
