-- Run daily (by hand for now; NOT wired to a cron — see v2-handoff). Two steps, in this order.
-- :day is a UTC date 'YYYY-MM-DD' at least 1 day old. Re-running a day is safe (INSERT OR REPLACE).

-- 1. roll one day up into daily_rollup (runs attributed to the day they STARTED)
WITH s AS (SELECT game, session, json_extract(props,'$.run') AS run FROM events
           WHERE name='run_start' AND strftime('%Y-%m-%d', ts/1000, 'unixepoch') = :day)
INSERT OR REPLACE INTO daily_rollup(day, game, metric, key, n)
  SELECT :day, game, 'run_starts', '', COUNT(*) FROM s GROUP BY game;

WITH s AS (SELECT game, session, json_extract(props,'$.run') AS run FROM events
           WHERE name='run_start' AND strftime('%Y-%m-%d', ts/1000, 'unixepoch') = :day),
     e AS (SELECT DISTINCT game, session, json_extract(props,'$.run') AS run FROM events WHERE name='ending_reached')
INSERT OR REPLACE INTO daily_rollup(day, game, metric, key, n)
  SELECT :day, s.game, 'runs_ended', '', COUNT(*) FROM s JOIN e USING (game, session, run) GROUP BY s.game;

WITH s AS (SELECT game, session, json_extract(props,'$.run') AS run FROM events
           WHERE name='run_start' AND strftime('%Y-%m-%d', ts/1000, 'unixepoch') = :day),
     b AS (SELECT game, session, json_extract(props,'$.run') AS run, json_extract(props,'$.beat_id') AS beat_id
           FROM events WHERE name='beat_reached' AND COALESCE(json_extract(props,'$.hidden'),0)=0 GROUP BY 1,2,3,4)
INSERT OR REPLACE INTO daily_rollup(day, game, metric, key, n)
  SELECT :day, s.game, 'beat_reached', b.beat_id, COUNT(*) FROM s JOIN b USING (game, session, run) GROUP BY s.game, b.beat_id;

WITH s AS (SELECT game, session, json_extract(props,'$.run') AS run FROM events
           WHERE name='run_start' AND strftime('%Y-%m-%d', ts/1000, 'unixepoch') = :day),
     lb AS (SELECT game, session, json_extract(props,'$.run') AS run, json_extract(props,'$.beat_id') AS beat_id, MAX(ts) AS t
            FROM events WHERE name='beat_reached' AND COALESCE(json_extract(props,'$.hidden'),0)=0 GROUP BY 1,2,3),
     e  AS (SELECT DISTINCT game, session, json_extract(props,'$.run') AS run FROM events WHERE name='ending_reached')
INSERT OR REPLACE INTO daily_rollup(day, game, metric, key, n)
  SELECT :day, s.game, 'beat_lost', COALESCE(lb.beat_id,'(before first beat)'), COUNT(*)
  FROM s LEFT JOIN lb USING (game, session, run) LEFT JOIN e USING (game, session, run)
  WHERE e.run IS NULL GROUP BY s.game, COALESCE(lb.beat_id,'(before first beat)');

-- 2. purge raw events older than 90 days. Only after the days they cover have been rolled up.
DELETE FROM events WHERE ts < (CAST(strftime('%s','now') AS INTEGER) - 90*86400) * 1000;
