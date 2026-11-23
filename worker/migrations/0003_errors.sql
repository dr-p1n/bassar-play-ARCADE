-- =============================================================================
-- 0003_errors — "IS IT WORKING?" LOG.  Additive only: no drops, no renames.
-- =============================================================================
-- WHY A SEPARATE TABLE FROM `events`
--   `events` answers the five behaviour questions (are players hooked?).
--   `errors` answers a different one: did the game break for someone?
--   Keeping them apart keeps both honest, and lets this one be purged sooner (30 days).
--
-- WHAT IT HOLDS:   one row per distinct crash/failure per session, max 5 per session.
-- WHAT IT NEVER HOLDS:  contact details, IP hashes, anything the player typed.
--   The worker also masks email-like and long digit strings inside messages,
--   because an error message can quote user input.
--
-- COST: ZERO secondary indexes on purpose. D1 bills rows written including index
--   rows; with no index each error is exactly 1 row written. The table is tiny
--   (capped and purged), so scans for the report are cheap.
--
-- APPLY ORDER: staging first, then production:
--   wrangler d1 execute <db> --config wrangler.toml [--env staging] --remote --file=migrations/0003_errors.sql
-- If you re-run this file, the final ALTER will report "duplicate column": that is expected and harmless (SQLite has no IF NOT EXISTS for columns).
-- See v2-handoff/ERROR-LOGGING.md for the full explanation.
-- =============================================================================
CREATE TABLE IF NOT EXISTS errors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,            -- server time, ms
  game        TEXT NOT NULL,               -- a game slug, or 'site' for the landing/game-shell pages
  session     TEXT NOT NULL,
  vid         TEXT NOT NULL,               -- visitor id only
  kind        TEXT NOT NULL,               -- js_error | promise_rejection | request_failed | slow_or_stalled | webgl_lost
  message     TEXT NOT NULL DEFAULT '',    -- sanitised, max 200 chars, no URL query strings
  source      TEXT NOT NULL DEFAULT '',    -- file:line:col (query stripped), max 120 chars
  build       TEXT NOT NULL DEFAULT '',    -- stamped by build.py: ties the error to a deploy
  device      TEXT NOT NULL DEFAULT '',    -- mobile | desktop
  fingerprint TEXT NOT NULL                -- hash of kind+message+source: groups the same crash across players
);

-- per-session error budget (max 5), enforced atomically by the worker, same pattern as plays.evn
ALTER TABLE plays ADD COLUMN errn INTEGER DEFAULT 0;
