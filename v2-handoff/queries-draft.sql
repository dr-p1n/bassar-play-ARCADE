-- BASSAR v2 — the five questions as SQL. DRAFT for review; no migration has been written.
-- Params: :since / :until (ms) :gap (ms; min time before a later session counts as a return, draft 6h) :min_n (draft 30)
-- Proposed table (not yet created anywhere):
--   events(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, session TEXT NOT NULL, vid TEXT NOT NULL,
--          game TEXT NOT NULL, name TEXT NOT NULL, props TEXT NOT NULL DEFAULT '{}')   -- names: run_start, beat_reached,
--          ending_reached, run_end, form_shown, form_filed.  props: run (int, per session+game), beat_id, hidden, ending_id.
-- Tested on synthetic data (1,200 visitors) against planted answers: Q1, Q3, Q4, Q5 match exactly; Q2 sums reconcile to Q1.

-- ===== Q1 HOOK: % of run_starts that reach an end screen, per game
WITH starts AS (
  SELECT game, session, json_extract(props,'$.run') AS run
  FROM events WHERE name='run_start' AND ts >= :since AND ts < :until),
ends AS (
  SELECT DISTINCT game, session, json_extract(props,'$.run') AS run
  FROM events WHERE name='ending_reached' AND ts >= :since AND ts < :until + 86400000)
SELECT s.game,
       COUNT(*)                                         AS run_starts,
       COUNT(e.run)                                     AS reached_end,
       ROUND(100.0 * COUNT(e.run) / COUNT(*), 1)        AS pct_reached_end
FROM starts s
LEFT JOIN ends e ON e.game=s.game AND e.session=s.session AND e.run=s.run
GROUP BY s.game ORDER BY s.game;

-- ===== Q2 DREAD MAP: where each game loses runs
WITH starts AS (
  SELECT game, session, json_extract(props,'$.run') AS run
  FROM events WHERE name='run_start' AND ts >= :since AND ts < :until),
beats AS (
  SELECT game, session, json_extract(props,'$.run') AS run,
         json_extract(props,'$.beat_id') AS beat_id, MIN(ts) AS t
  FROM events
  WHERE name='beat_reached' AND ts >= :since
    AND COALESCE(json_extract(props,'$.hidden'),0)=0
  GROUP BY 1,2,3,4),
last_beat AS (            -- SQLite: bare columns come from the row holding MAX(t)
  SELECT game, session, run, beat_id, MAX(t) AS t FROM beats GROUP BY 1,2,3),
ended AS (
  SELECT DISTINCT game, session, json_extract(props,'$.run') AS run
  FROM events WHERE name='ending_reached' AND ts >= :since),
reach AS (SELECT game, beat_id, COUNT(*) AS runs_reached FROM beats GROUP BY 1,2),
lost  AS (
  SELECT s.game, COALESCE(lb.beat_id,'(before first beat)') AS beat_id, COUNT(*) AS runs_lost
  FROM starts s
  LEFT JOIN last_beat lb ON lb.game=s.game AND lb.session=s.session AND lb.run=s.run
  LEFT JOIN ended e      ON e.game=s.game  AND e.session=s.session  AND e.run=s.run
  WHERE e.run IS NULL
  GROUP BY 1,2)
SELECT COALESCE(r.game,l.game) AS game, COALESCE(r.beat_id,l.beat_id) AS beat_id,
       COALESCE(r.runs_reached,0) AS runs_reached, COALESCE(l.runs_lost,0) AS runs_lost
FROM reach r LEFT JOIN lost l ON l.game=r.game AND l.beat_id=r.beat_id
UNION
SELECT l.game, l.beat_id, 0, l.runs_lost FROM lost l
WHERE NOT EXISTS (SELECT 1 FROM reach r WHERE r.game=l.game AND r.beat_id=l.beat_id)
ORDER BY 1, 3 DESC;

-- ===== Q3 RETURN (the OMTM): % of visitors back within 7 days
WITH 
sess AS (SELECT vid, session, MIN(ts) AS t0 FROM plays WHERE vid <> '' GROUP BY vid, session),
first AS (SELECT vid, MIN(t0) AS f FROM sess GROUP BY vid),
cohort AS (SELECT vid, f FROM first WHERE f >= :since AND f <= :until - 7*86400000),
ret AS (
  SELECT c.vid, EXISTS (SELECT 1 FROM sess s WHERE s.vid=c.vid
         AND s.t0 >= c.f + :gap AND s.t0 <= c.f + 7*86400000) AS returned
  FROM cohort c)

SELECT COUNT(*) AS cohort, SUM(returned) AS returned_within_7d,
       ROUND(100.0*SUM(returned)/COUNT(*),1) AS pct_return_7d FROM ret;

-- ===== Q4 SPREAD: new visitors via referred_by per record filed
WITH filers AS (
  SELECT contact_key, vid, MIN(ts) AS filed_at FROM records
  WHERE contact_key <> '' AND vid <> '' AND ts >= :since AND ts < :until GROUP BY contact_key),
arrivals AS (
  SELECT f.contact_key, COUNT(DISTINCT n.vid) AS arrived
  FROM filers f JOIN visitors v ON v.vid=f.vid
  LEFT JOIN visitors n ON n.referred_by=v.ref_code AND v.ref_code <> ''
                      AND n.vid <> v.vid AND n.first_seen > f.filed_at
  GROUP BY f.contact_key)
SELECT COUNT(*) AS records_filed, SUM(arrived) AS new_visitors_via_referral,
       ROUND(1.0*SUM(arrived)/COUNT(*),2) AS arrivals_per_record,
       SUM(arrived>0) AS filers_who_brought_anyone FROM arrivals;

-- ===== Q5 SOURCE QUALITY: 7-day return by first-touch source/medium/campaign
WITH 
sess AS (SELECT vid, session, MIN(ts) AS t0 FROM plays WHERE vid <> '' GROUP BY vid, session),
first AS (SELECT vid, MIN(t0) AS f FROM sess GROUP BY vid),
cohort AS (SELECT vid, f FROM first WHERE f >= :since AND f <= :until - 7*86400000 AND vid IN (SELECT vid FROM plays WHERE kind='game')),
ret AS (
  SELECT c.vid, EXISTS (SELECT 1 FROM sess s WHERE s.vid=c.vid
         AND s.t0 >= c.f + :gap AND s.t0 <= c.f + 7*86400000) AS returned
  FROM cohort c)
,
touch AS (   -- bare columns come from the earliest row per visitor
  SELECT vid, COALESCE(NULLIF(source,''),'(direct)') AS source, COALESCE(NULLIF(medium,''),'-') AS medium,
         COALESCE(NULLIF(campaign,''),'-') AS campaign, MIN(ts) AS t
  FROM plays WHERE vid <> '' GROUP BY vid)
SELECT t.source, t.medium, t.campaign, COUNT(*) AS players, SUM(r.returned) AS returned,
       ROUND(100.0*SUM(r.returned)/COUNT(*),1) AS pct_return_7d,
       CASE WHEN COUNT(*) < :min_n THEN 'low n' ELSE '' END AS note
FROM ret r JOIN touch t ON t.vid=r.vid
GROUP BY 1,2,3 ORDER BY pct_return_7d DESC, players DESC;
