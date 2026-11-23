-- 0002_events — additive only. No drops, no renames, no rewrites of existing rows.
-- Apply to STAGING first (fake traffic), then production:
--   wrangler d1 execute <db> --config wrangler.toml [--env staging] --remote --file=migrations/0002_events.sql
--
-- events: append-only behavioural log. vid only — never a contact, never an IP hash.
--   names (fixed): run_start, beat_reached, ending_reached, run_end, form_shown, form_filed
--   props (JSON, whitelisted by the worker): run, beat_id, hidden, ending_id, reason, dur_ms, surface
-- One secondary index only. D1 bills rows written INCLUDING index rows, so each
-- extra index is another write on every event. This one serves Q1/Q2 (name, game, ts).
CREATE TABLE IF NOT EXISTS events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,           -- client time, clamped by the worker to [now-1d, now+60s]
  session TEXT NOT NULL,
  vid     TEXT NOT NULL,
  game    TEXT NOT NULL,
  name    TEXT NOT NULL,
  props   TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_events_name_game_ts ON events(name, game, ts);

-- daily_rollup: what survives the 90-day purge of events (see maintenance/rollup-and-purge.sql).
CREATE TABLE IF NOT EXISTS daily_rollup (
  day    TEXT NOT NULL,               -- YYYY-MM-DD (UTC), the day the run STARTED
  game   TEXT NOT NULL,
  metric TEXT NOT NULL,               -- run_starts | runs_ended | beat_reached | beat_lost
  key    TEXT NOT NULL DEFAULT '',    -- beat_id for the beat_* metrics, else ''
  n      INTEGER NOT NULL,
  PRIMARY KEY (day, game, metric, key)
);

-- per-session event budget, enforced atomically by the worker (one UPDATE per batch).
ALTER TABLE plays ADD COLUMN evn INTEGER DEFAULT 0;
