-- BASSAR — capture schema. Three tables, three questions.
--
--   visitors  who, across days      → stickiness, and the referral chain
--   plays     one session, one game → the capture-rate denominator, and playtime
--   records   signups               → the list
--
-- A visitor spans sessions. A session spans runs. That is why it is three
-- tables and not two: "did they come back" cannot be answered inside a row
-- that dies with the browser tab.

CREATE TABLE IF NOT EXISTS visitors (
  vid          TEXT PRIMARY KEY,   -- random, persistent, in the visitor's own browser
  ref_code     TEXT,               -- their share code. Appears in other people's URLs.
  referred_by  TEXT DEFAULT '',    -- the ref_code that brought them in, if any
  first_seen   INTEGER NOT NULL,
  last_seen    INTEGER NOT NULL,
  visits       INTEGER DEFAULT 1,  -- distinct browser sessions, i.e. times they came back
  -- Deliberately no total_runs / total_ms / games columns here. Those are
  -- derived from plays at read time. Maintaining running totals across
  -- heartbeats is how counters quietly drift out of agreement with the rows
  -- they claim to summarise.
  first_source TEXT DEFAULT '',
  country      TEXT DEFAULT '',
  device       TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_vis_code  ON visitors(ref_code);
CREATE INDEX IF NOT EXISTS idx_vis_refby ON visitors(referred_by);
CREATE INDEX IF NOT EXISTS idx_vis_first ON visitors(first_seen);
CREATE INDEX IF NOT EXISTS idx_vis_seen  ON visitors(last_seen);

CREATE TABLE IF NOT EXISTS plays (
  id         TEXT PRIMARY KEY,   -- session:game — one row per visitor per game per session
  ts         INTEGER NOT NULL,   -- server time, ms
  kind       TEXT DEFAULT 'game',-- game | page. Only 'game' counts toward the capture rate.
  game       TEXT NOT NULL,      -- a game slug, or page:index / page:transcript for a shell page
  session    TEXT NOT NULL,
  vid        TEXT DEFAULT '',    -- → visitors.vid
  source     TEXT DEFAULT '',    -- ?src= or utm_source — reddit, itch, discord, poster-qr...
  medium     TEXT DEFAULT '',
  campaign   TEXT DEFAULT '',
  referrer   TEXT DEFAULT '',
  country    TEXT DEFAULT '',
  device     TEXT DEFAULT '',    -- mobile | desktop
  runs       INTEGER DEFAULT 0,  -- how many times they restarted
  ended      INTEGER DEFAULT 0,  -- reached an end screen at least once (saw the capture form)
  dur_ms     INTEGER DEFAULT 0,  -- active playtime: heartbeat while a run is live, paused when hidden
  last_ts    INTEGER,
  ip_hash    TEXT
);

CREATE INDEX IF NOT EXISTS idx_plays_game    ON plays(game);
CREATE INDEX IF NOT EXISTS idx_plays_kind    ON plays(kind, ts);
CREATE INDEX IF NOT EXISTS idx_plays_ts      ON plays(ts);
CREATE INDEX IF NOT EXISTS idx_plays_source  ON plays(source);
CREATE INDEX IF NOT EXISTS idx_plays_vid     ON plays(vid);
CREATE INDEX IF NOT EXISTS idx_plays_iphash  ON plays(ip_hash, ts);

CREATE TABLE IF NOT EXISTS records (
  id           TEXT PRIMARY KEY, -- session:game:seq
  ts           INTEGER NOT NULL,
  -- which form they filled. Every surface writes to this one table, which is
  -- what makes the export a single list rather than four to reconcile.
  --   game-end  the casualty list, inside a game
  --   drop      the per-game signup on that game's page — exclusive drops/access
  --   index     the signup on the front page
  surface      TEXT DEFAULT 'game-end',
  game         TEXT NOT NULL,    -- which game's list. 'bassar' for the front page.
  session      TEXT NOT NULL,
  vid          TEXT DEFAULT '',  -- → visitors.vid
  name         TEXT DEFAULT '',  -- the in-world name on the casualty list
  contact      TEXT DEFAULT '',  -- raw, as typed
  contact_kind TEXT DEFAULT '',  -- email | phone | none
  contact_key  TEXT DEFAULT '',  -- normalised: dedupe key across all games
  source       TEXT DEFAULT '',
  medium       TEXT DEFAULT '',
  campaign     TEXT DEFAULT '',
  referrer     TEXT DEFAULT '',
  country      TEXT DEFAULT '',
  device       TEXT DEFAULT '',
  ending       TEXT DEFAULT '',  -- FOUND / STRUCK BLIND / TRANSCRIBED / SIGNAL LOST
  runs         INTEGER DEFAULT 0,
  dur_ms       INTEGER DEFAULT 0,
  detail       TEXT DEFAULT '{}',-- per-game score fields, JSON
  consent      INTEGER DEFAULT 0,-- 1 = gave a contact in response to an offer
  ip_hash      TEXT,
  -- tagging for the ladder. Nothing writes these yet; the plan says wire them now
  -- because retrofitting them later is expensive. See §5, Sept-Oct 2026.
  rung         INTEGER DEFAULT 0,-- 0 free / 1 credit / 2 recurring name / 3 EP
  tags         TEXT DEFAULT ''   -- free-form, comma separated
);

CREATE INDEX IF NOT EXISTS idx_records_key    ON records(contact_key);
CREATE INDEX IF NOT EXISTS idx_records_surf   ON records(surface);
CREATE INDEX IF NOT EXISTS idx_records_game   ON records(game);
CREATE INDEX IF NOT EXISTS idx_records_ts     ON records(ts);
CREATE INDEX IF NOT EXISTS idx_records_source ON records(source);
CREATE INDEX IF NOT EXISTS idx_records_vid    ON records(vid);
CREATE INDEX IF NOT EXISTS idx_records_rung   ON records(rung);
CREATE INDEX IF NOT EXISTS idx_records_iphash ON records(ip_hash, ts);
