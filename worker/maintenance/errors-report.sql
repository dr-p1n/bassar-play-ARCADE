-- =============================================================================
-- ERRORS REPORT — what is breaking, and for how many players.   (read-only)
-- Run:  wrangler d1 execute <db> --config wrangler.toml [--env staging] --remote --file=maintenance/errors-report.sql
-- Params are baked in below: edit the 7 (days) to widen/narrow the window.
-- =============================================================================

-- 1. WORST FIRST: the same crash grouped across players (fingerprint), by how many distinct players hit it.
SELECT game, kind, message, source,
       COUNT(*)                 AS occurrences,
       COUNT(DISTINCT vid)      AS players,
       COUNT(DISTINCT session)  AS sessions,
       GROUP_CONCAT(DISTINCT build)  AS builds,
       SUM(device='mobile')     AS on_mobile,
       SUM(device='desktop')    AS on_desktop,
       datetime(MIN(ts)/1000,'unixepoch') AS first_seen,
       datetime(MAX(ts)/1000,'unixepoch') AS last_seen
FROM errors
WHERE ts >= (CAST(strftime('%s','now') AS INTEGER) - 7*86400) * 1000
GROUP BY fingerprint
ORDER BY players DESC, occurrences DESC
LIMIT 50;

-- 2. PER GAME HEALTH: what share of sessions hit at least one error?
-- (sessions with errors) / (sessions that played) in the same window.
SELECT p.game,
       COUNT(DISTINCT p.session)                                  AS sessions,
       COUNT(DISTINCT e.session)                                  AS sessions_with_error,
       ROUND(100.0*COUNT(DISTINCT e.session)/COUNT(DISTINCT p.session),1) AS pct_with_error
FROM plays p LEFT JOIN errors e ON e.session=p.session AND e.game=p.game
WHERE p.kind='game' AND p.ts >= (CAST(strftime('%s','now') AS INTEGER) - 7*86400) * 1000
GROUP BY p.game;

-- 3. IS IT NEW? errors that first appeared on the latest build (compare after each deploy).
SELECT build, COUNT(*) AS errors, COUNT(DISTINCT fingerprint) AS distinct_crashes
FROM errors GROUP BY build ORDER BY MAX(ts) DESC LIMIT 10;
