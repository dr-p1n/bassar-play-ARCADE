/* ------------------------------------------------------------------
   BASSAR — capture worker
   Four routes:
     POST /play        one row per visitor per game. This is the denominator.
     POST /record      name + contact from the end screen. The numerator.
     GET  /stats       capture rate, sliced. Token required.
     GET  /export.csv  the list, off-platform, yours. Token required.

   Nothing here is game-specific. All three games post the same shape.
------------------------------------------------------------------ */

const RL_WINDOW_MS = 10 * 60 * 1000;   // rate limit window
const RL_MAX_PLAYS = 40;               // plays per IP per window
const RL_MAX_RECS  = 8;                // records per IP per window

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") || "";

    if (req.method === "OPTIONS") return preflight(origin, env);

    try {
      switch (url.pathname) {
        case "/play":       return cors(await handlePlay(req, env), origin, env);
        case "/record":     return cors(await handleRecord(req, env), origin, env);
        case "/leaderboard": return cors(await handleLeaderboard(req, env, url), origin, env);
        case "/api/contact": return cors(await handleContact(req, env), origin, env);
        case "/events":     return cors(await handleEvents(req, env), origin, env);
        case "/errors":     return cors(await handleErrors(req, env), origin, env);
        case "/stats":      return cors(await handleStats(req, env, url), origin, env);
        case "/tag":        return cors(await handleTag(req, env, url), origin, env);
        case "/export.csv": return await handleExport(req, env, url);
        case "/":           return cors(json({ ok: true, service: "bassar-capture" }), origin, env);
        default:            return cors(json({ ok: false, error: "no such route" }, 404), origin, env);
      }
    } catch (err) {
      console.error("bassar", url.pathname, err && err.message);
      return cors(json({ ok: false, error: "server" }, 500), origin, env);
    }
  }
};

/* ---------- CORS ----------
   No cookies, no credentials, so "*" is safe and lets the games run from
   itch.io's randomised iframe hosts as well as BASSAR domain.
   Set ALLOWED_ORIGINS in wrangler.toml to tighten it later.            */
function allowOrigin(origin, env) {
  const list = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!list.length) return "*";
  return list.includes(origin) ? origin : list[0];
}
function corsHeaders(origin, env) {
  return {
    "Access-Control-Allow-Origin": allowOrigin(origin, env),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function preflight(origin, env) {
  return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
}
function cors(res, origin, env) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin, env))) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

/* ---------- helpers ---------- */
const str = (v, max) => (typeof v === "string" ? v : v == null ? "" : String(v)).slice(0, max || 200).trim();
const int = (v, max) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max == null ? 1e9 : max) : 0;
};

async function ipHash(req, env) {
  const ip = req.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const data = new TextEncoder().encode((env.IP_SALT || "unsalted") + "|" + ip);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].slice(0, 10).map(b => b.toString(16).padStart(2, "0")).join("");
}

function meta(req, body) {
  const ua = req.headers.get("User-Agent") || "";
  return {
    kind:     body.kind === "page" ? "page" : "game",
    surface:  ["game-end", "drop", "index"].includes(body.surface) ? body.surface : "game-end",
    game:     str(body.game, 40) || "unknown",
    session:  str(body.session, 40),
    vid:      str(body.vid, 40),
    code:     str(body.code, 12),
    refBy:    str(body.referred_by, 12),
    visits:   int(body.visits, 100000),
    durMs:    int(body.dur_ms, 24 * 3600 * 1000),   // a day is the ceiling; beyond that it's a stuck tab
    source:   str(body.source, 60),
    medium:   str(body.medium, 60),
    campaign: str(body.campaign, 60),
    referrer: str(body.referrer, 300),
    country:  str(req.headers.get("CF-IPCountry"), 4),
    device:   /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop",
    runs:     int(body.runs, 100000),
    ended:    body.ended ? 1 : 0
  };
}

/* email or phone, normalised so the same person dedupes across all three games */
function classifyContact(raw) {
  const v = str(raw, 160);
  if (!v) return { kind: "none", key: "", value: "" };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
    return { kind: "email", key: v.toLowerCase(), value: v };
  }
  const digits = v.replace(/[^\d]/g, "");
  if (digits.length >= 7 && digits.length <= 15) {
    return { kind: "phone", key: "p:" + digits, value: v };
  }
  return { kind: "none", key: "", value: v };   // kept raw, flagged unusable
}

/* Rate limit on distinct sessions, not rows. Heartbeats re-send the same
   session id all through a run, so counting rows would throttle a player for
   the crime of playing for ten minutes. */
async function overLimit(env, hash, table, max) {
  const since = Date.now() - RL_WINDOW_MS;
  const col = table === "plays" ? "DISTINCT session" : "*";
  const row = await env.DB
    .prepare(`SELECT COUNT(${col}) AS n FROM ${table} WHERE ip_hash = ? AND ts > ?`)
    .bind(hash, since).first();
  return (row && row.n) >= max;
}

/* The visitor row: identity, return count, and the referral chain.
   A referral is only ever claimed once, on the visitor's first sighting. */
async function touchVisitor(env, m, now) {
  if (!m.vid) return;
  await env.DB.prepare(
    `INSERT INTO visitors (vid, ref_code, referred_by, first_seen, last_seen, visits, first_source, country, device)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(vid) DO UPDATE SET
       last_seen   = excluded.last_seen,
       visits      = MAX(visitors.visits, excluded.visits),
       ref_code    = COALESCE(NULLIF(visitors.ref_code, ''), excluded.ref_code),
       referred_by = CASE WHEN visitors.referred_by = '' THEN excluded.referred_by
                          ELSE visitors.referred_by END`
  ).bind(m.vid, m.code, m.refBy, now, now, Math.max(1, m.visits),
         m.source, m.country, m.device).run();
}

async function readBody(req) {
  try { return await req.json(); } catch (e) { return null; }
}

/* ---------- POST /play ----------
   Fired once per visitor per game, plus again on pagehide with the final
   run count. INSERT OR IGNORE then UPDATE, so replays never inflate the
   denominator but engagement depth is still recorded.                   */
async function handlePlay(req, env) {
  if (req.method !== "POST") return json({ ok: false }, 405);
  const body = await readBody(req);
  if (!body) return json({ ok: false, error: "bad body" }, 400);

  const m = meta(req, body);
  if (!m.session) return json({ ok: false, error: "no session" }, 400);

  const hash = await ipHash(req, env);
  if (await overLimit(env, hash, "plays", RL_MAX_PLAYS)) return json({ ok: true, throttled: true });

  const id = m.session + ":" + m.game;
  const now = Date.now();

  await touchVisitor(env, m, now);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO plays
        (id, ts, kind, game, session, vid, source, medium, campaign, referrer, country, device, runs, ended, dur_ms, last_ts, ip_hash)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, now, m.kind, m.game, m.session, m.vid, m.source, m.medium, m.campaign,
           m.referrer, m.country, m.device, m.runs, m.ended, m.durMs, now, hash),
    // heartbeats send cumulative values, so MAX is both idempotent and
    // resilient to a beat arriving out of order
    env.DB.prepare(
      `UPDATE plays
          SET runs = MAX(runs, ?), ended = MAX(ended, ?), dur_ms = MAX(dur_ms, ?),
              vid = CASE WHEN vid = '' THEN ? ELSE vid END, last_ts = ?
        WHERE id = ?`
    ).bind(m.runs, m.ended, m.durMs, m.vid, now, id)
  ]);

  return json({ ok: true });
}

/* ---------- POST /record ---------- */
async function handleRecord(req, env) {
  if (req.method !== "POST") return json({ ok: false }, 405);
  const body = await readBody(req);
  if (!body) return json({ ok: false, error: "bad body" }, 400);

  // honeypot: a field no human ever fills, because it is never shown
  if (str(body.website, 50)) return json({ ok: true });

  const m = meta(req, body);
  if (!m.session) return json({ ok: false, error: "no session" }, 400);

  const hash = await ipHash(req, env);
  if (await overLimit(env, hash, "records", RL_MAX_RECS)) {
    return json({ ok: false, error: "throttled" }, 429);
  }

  const c = classifyContact(body.contact);
  const name = str(body.name, 18);

  // everything the game scored, kept as JSON so new games need no migration
  const detail = {};
  for (const k of ["resolved", "distance", "score", "recovered", "decoded", "match", "message"]) {
    if (body[k] !== undefined) detail[k] = typeof body[k] === "string" ? str(body[k], 200) : body[k];
  }

  const id = m.session + ":" + m.game + ":" + Date.now().toString(36);

  await touchVisitor(env, m, Date.now());

  await env.DB.prepare(
    `INSERT INTO records
      (id, ts, surface, game, session, vid, name, contact, contact_kind, contact_key,
       source, medium, campaign, referrer, country, device, ending, runs, dur_ms, detail, consent, ip_hash)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, Date.now(), m.surface, m.game, m.session, m.vid, name, c.value, c.kind, c.key,
    m.source, m.medium, m.campaign, m.referrer, m.country, m.device,
    str(body.ending, 40), m.runs, m.durMs, JSON.stringify(detail), body.consent ? 1 : 0, hash
  ).run();

  // A filing from inside a game implies a play, even if /play was blocked.
  // A drop or index signup does not — those are page surfaces, and counting
  // them as plays would quietly inflate the capture rate's denominator.
  if (m.surface === "game-end" && m.kind === "game") {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO plays
        (id, ts, kind, game, session, vid, source, medium, campaign, referrer, country, device, runs, ended, dur_ms, last_ts, ip_hash)
       VALUES (?,?,'game',?,?,?,?,?,?,?,?,?,?,1,?,?,?)`
    ).bind(m.session + ":" + m.game, Date.now(), m.game, m.session, m.vid, m.source, m.medium,
           m.campaign, m.referrer, m.country, m.device, m.runs, m.durMs, Date.now(), hash).run();
  }

  return json({ ok: true, filed: true, usable: c.kind !== "none" });
}

/* ---------- auth for the read routes ---------- */
function authed(req, env, url) {
  const want = env.STATS_TOKEN || "";
  if (!want) return false;
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const given = bearer || url.searchParams.get("token") || "";
  if (given.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= given.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

/* ---------- GET /stats ----------
   The Gate 1 number and the slices that explain it.
   ?days=30 to window it.                                               */
async function handleStats(req, env, url) {
  if (!authed(req, env, url)) return json({ ok: false, error: "unauthorised" }, 401);

  const days  = Math.min(3650, Math.max(1, int(url.searchParams.get("days") || "3650", 3650)));
  const since = Date.now() - days * 86400000;
  const q = (sql, ...b) => env.DB.prepare(sql).bind(...b).all();

  const [totals, byGame, bySource, bySurface, byDevice, daily, stick, depth, spread, buckets, viral] = await Promise.all([
    env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM plays WHERE ts > ? AND kind = 'game')                AS plays,
         (SELECT COUNT(*) FROM plays WHERE ts > ? AND kind = 'page')                AS page_views,
         (SELECT COUNT(*) FROM plays WHERE ts > ? AND kind = 'game' AND ended = 1)  AS reached_end,
         (SELECT COUNT(*) FROM records WHERE ts > ?)                                AS filings,
         (SELECT COUNT(DISTINCT contact_key) FROM records
           WHERE ts > ? AND contact_key <> '')                                      AS contacts,
         (SELECT COUNT(DISTINCT contact_key) FROM records
           WHERE ts > ? AND contact_key <> '' AND surface = 'game-end')             AS contacts_in_game,
         (SELECT COUNT(DISTINCT contact_key) FROM records
           WHERE ts > ? AND contact_kind = 'email')                                 AS emails,
         (SELECT COUNT(*) FROM records WHERE ts > ? AND contact_kind = 'none')      AS name_only,
         (SELECT ROUND(AVG(runs),2) FROM plays WHERE ts > ? AND kind = 'game')      AS avg_runs`
    ).bind(since, since, since, since, since, since, since, since, since).first(),

    q(`SELECT p.game, p.plays, p.reached_end, p.avg_runs, p.avg_seconds, COALESCE(r.contacts,0) AS contacts
         FROM (SELECT game, COUNT(*) AS plays, SUM(ended) AS reached_end,
                      ROUND(AVG(runs),2) AS avg_runs,
                      ROUND(AVG(dur_ms)/1000.0,1) AS avg_seconds
                 FROM plays WHERE ts > ? AND kind = 'game' GROUP BY game) p
         LEFT JOIN (SELECT game, COUNT(DISTINCT contact_key) AS contacts
                      FROM records WHERE ts > ? AND contact_key <> '' GROUP BY game) r
           ON r.game = p.game
        ORDER BY p.plays DESC`, since, since),

    q(`SELECT p.source, p.plays, COALESCE(r.contacts,0) AS contacts
         FROM (SELECT CASE WHEN source = '' THEN '(untagged)' ELSE source END AS source,
                      COUNT(*) AS plays
                 FROM plays WHERE ts > ? AND kind = 'game' GROUP BY 1) p
         LEFT JOIN (SELECT CASE WHEN source = '' THEN '(untagged)' ELSE source END AS source,
                           COUNT(DISTINCT contact_key) AS contacts
                      FROM records WHERE ts > ? AND contact_key <> '' GROUP BY 1) r
           ON r.source = p.source
        ORDER BY p.plays DESC`, since, since),

    // which form is actually doing the work: the casualty list, the per-game
    // drop signup, or the front page. Same list, different doors.
    q(`SELECT surface, COUNT(*) AS filings,
              COUNT(DISTINCT CASE WHEN contact_key <> '' THEN contact_key END) AS contacts
         FROM records WHERE ts > ? GROUP BY surface ORDER BY filings DESC`, since),

    q(`SELECT device, COUNT(*) AS plays, SUM(ended) AS reached_end
         FROM plays WHERE ts > ? AND kind = 'game' GROUP BY device`, since),

    q(`SELECT DATE(ts/1000,'unixepoch') AS day, COUNT(*) AS plays
         FROM plays WHERE ts > ? AND kind = 'game' GROUP BY day ORDER BY day DESC LIMIT 60`, since),

    /* --- stickiness: did they come back --- */
    env.DB.prepare(
      `SELECT COUNT(*) AS visitors,
              SUM(CASE WHEN visits > 1 THEN 1 ELSE 0 END)                        AS returned,
              SUM(CASE WHEN last_seen - first_seen > 86400000  THEN 1 ELSE 0 END) AS back_after_a_day,
              SUM(CASE WHEN last_seen - first_seen > 604800000 THEN 1 ELSE 0 END) AS back_after_a_week,
              ROUND(AVG(visits), 2)                                              AS avg_visits
         FROM visitors WHERE first_seen > ?`
    ).bind(since).first(),

    /* --- depth: measured playtime, not time on page --- */
    env.DB.prepare(
      `SELECT ROUND(AVG(dur_ms) / 1000.0, 1) AS avg_seconds,
              ROUND(MAX(dur_ms) / 1000.0, 1) AS longest_seconds,
              ROUND(AVG(runs), 2)            AS avg_runs
         FROM plays WHERE ts > ? AND kind = 'game' AND dur_ms > 0`
    ).bind(since).first(),

    /* --- do they walk more than one file? the arcade's whole premise --- */
    env.DB.prepare(
      `SELECT ROUND(AVG(n), 2) AS avg_games_per_visitor,
              SUM(CASE WHEN n > 1 THEN 1 ELSE 0 END) AS played_more_than_one,
              COUNT(*) AS visitors_who_played
         FROM (SELECT vid, COUNT(DISTINCT game) AS n
                 FROM plays WHERE ts > ? AND kind = 'game' AND vid <> ''
                GROUP BY vid)`
    ).bind(since).first(),

    q(`SELECT bucket, n FROM (
         SELECT CASE WHEN dur_ms <  10000 THEN 'under 10s'
                     WHEN dur_ms <  60000 THEN '10s to 1min'
                     WHEN dur_ms < 300000 THEN '1 to 5min'
                     WHEN dur_ms < 900000 THEN '5 to 15min'
                     ELSE 'over 15min' END AS bucket,
                CASE WHEN dur_ms <  10000 THEN 1 WHEN dur_ms <  60000 THEN 2
                     WHEN dur_ms < 300000 THEN 3 WHEN dur_ms < 900000 THEN 4
                     ELSE 5 END AS ord,
                COUNT(*) AS n
           FROM plays WHERE ts > ? AND kind = 'game' GROUP BY bucket, ord
       ) ORDER BY ord`, since),

    /* --- virality: who arrived on someone else's link --- */
    env.DB.prepare(
      `SELECT COUNT(*)                     AS visitors,
              SUM(CASE WHEN referred_by <> '' THEN 1 ELSE 0 END) AS arrived_on_a_link,
              COUNT(DISTINCT CASE WHEN referred_by <> '' THEN referred_by END) AS senders
         FROM visitors WHERE first_seen > ?`
    ).bind(since).first()
  ]);

  const rate = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
  const withRate = rows => (rows.results || []).map(r => ({
    ...r, capture_rate_pct: rate(r.contacts || 0, r.plays || 0)
  }));

  return json({
    ok: true,
    window_days: days,
    generated: new Date().toISOString(),

    // Gate 1. Plan §6: 5% means two games do not clear the bar; 20% means they do.
    // Every door counts toward this — casualty list, drop signup, front page.
    capture_rate_pct:        rate(totals.contacts, totals.plays),
    // the fiction on its own, with the drop forms taken out
    in_game_capture_rate_pct: rate(totals.contacts_in_game, totals.plays),
    capture_rate_of_end_pct: rate(totals.contacts, totals.reached_end),
    email_rate_pct:          rate(totals.emails, totals.plays),

    totals,

    // do they come back
    stickiness: {
      visitors:              stick.visitors || 0,
      returned:              stick.returned || 0,
      return_rate_pct:       rate(stick.returned, stick.visitors),
      back_after_a_day_pct:  rate(stick.back_after_a_day, stick.visitors),
      back_after_a_week_pct: rate(stick.back_after_a_week, stick.visitors),
      avg_visits:            stick.avg_visits || 0,
      avg_session_seconds:   depth.avg_seconds || 0,
      longest_session_seconds: depth.longest_seconds || 0,
      avg_runs_per_session:  depth.avg_runs || 0,
      // the arcade's own premise: one file should send you to the next
      avg_games_per_visitor: spread.avg_games_per_visitor || 0,
      played_more_than_one_pct: rate(spread.played_more_than_one, spread.visitors_who_played),
      session_length: buckets.results || []
    },

    // does one player bring another
    referral: {
      new_visitors:          viral.visitors || 0,
      arrived_on_a_link:     viral.arrived_on_a_link || 0,
      arrived_on_a_link_pct: rate(viral.arrived_on_a_link, viral.visitors),
      senders:               viral.senders || 0,
      // invitees per sender. Above 1.0 and the arcade grows without you posting.
      k_factor: viral.senders ? Math.round((viral.arrived_on_a_link / viral.senders) * 100) / 100 : 0
    },

    by_game:    withRate(byGame),
    by_source:  withRate(bySource),
    by_surface: bySurface.results || [],
    by_device:  byDevice.results || [],
    daily_plays: daily.results || []
  });
}

/* ---------- POST /tag ----------
   The ladder, written back from wherever you actually do the tagging —
   in practice a Google Sheet. Takes {updates:[{contact_key, rung, tags}]}.

   Rule: for rung and tags, the caller wins. The Sheet is the working copy
   for the qualification funnel, so there is no merge and no conflict to
   resolve — which is the only reason this stays a short endpoint.        */
async function handleTag(req, env, url) {
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (!authed(req, env, url)) return json({ ok: false, error: "unauthorised" }, 401);

  const body = await readBody(req);
  const updates = body && Array.isArray(body.updates) ? body.updates : null;
  if (!updates) return json({ ok: false, error: "no updates" }, 400);
  if (updates.length > 500) return json({ ok: false, error: "batch too large" }, 413);

  const stmts = [];
  let skipped = 0;
  for (const u of updates) {
    const key = str(u && u.contact_key, 160).toLowerCase();
    if (!key) { skipped++; continue; }
    const rung = Math.min(3, int(u.rung, 3));
    const tags = str(u.tags, 200);
    // every row for this person, so MAX(rung) in the export agrees with the sheet
    stmts.push(env.DB.prepare(
      `UPDATE records SET rung = ?, tags = ? WHERE contact_key = ?`
    ).bind(rung, tags, key));
  }
  if (stmts.length) await env.DB.batch(stmts);

  return json({ ok: true, applied: stmts.length, skipped });
}

/* ---------- GET /export.csv ----------
   The list, off-platform, deduped by contact. Plan §5: own it yourself. */
async function handleExport(req, env, url) {
  if (!authed(req, env, url)) return new Response("unauthorised", { status: 401 });

  /* One row per person, with what they actually did attached — because the
     EP shortlist is not "everyone on the list", it is the people who played
     three files for forty minutes and came back twice. */
  const rows = await env.DB.prepare(
    `WITH cv AS (
       SELECT DISTINCT contact_key, vid FROM records WHERE contact_key <> '' AND vid <> ''
     ),
     pv AS (
       SELECT vid, COUNT(DISTINCT game) AS games_played, SUM(dur_ms) AS ms
         FROM plays WHERE kind = 'game' AND vid <> '' GROUP BY vid
     ),
     agg AS (
       SELECT cv.contact_key,
              SUM(COALESCE(pv.ms, 0))             AS ms,
              MAX(COALESCE(pv.games_played, 0))   AS games_played,
              MAX(COALESCE(v.visits, 1))          AS visits,
              MAX(CASE WHEN COALESCE(v.referred_by,'') <> '' THEN 1 ELSE 0 END) AS arrived_on_a_link
         FROM cv
         LEFT JOIN pv       ON pv.vid = cv.vid
         LEFT JOIN visitors v ON v.vid = cv.vid
        GROUP BY cv.contact_key
     )
     SELECT r.contact_key, r.contact_kind,
            MIN(r.ts)                          AS first_seen,
            MAX(r.ts)                          AS last_seen,
            GROUP_CONCAT(DISTINCT r.game)      AS games,
            GROUP_CONCAT(DISTINCT r.surface)   AS surfaces,
            GROUP_CONCAT(DISTINCT r.name)      AS names,
            GROUP_CONCAT(DISTINCT r.source)    AS sources,
            GROUP_CONCAT(DISTINCT r.campaign)  AS campaigns,
            COUNT(*)                           AS filings,
            ROUND(COALESCE(a.ms,0)/60000.0, 1) AS minutes_played,
            COALESCE(a.games_played, 0)        AS games_played,
            COALESCE(a.visits, 1)              AS visits,
            COALESCE(a.arrived_on_a_link, 0)   AS arrived_on_a_link,
            MAX(r.rung)                        AS rung,
            GROUP_CONCAT(DISTINCT r.tags)      AS tags,
            MAX(r.country)                     AS country
       FROM records r
       LEFT JOIN agg a ON a.contact_key = r.contact_key
      WHERE r.contact_key <> ''
      GROUP BY r.contact_key
      ORDER BY first_seen ASC`
  ).all();

  const cols = ["contact_key","contact_kind","first_seen","last_seen","games","surfaces","names",
                "sources","campaigns","filings","minutes_played","games_played","visits",
                "arrived_on_a_link","rung","tags","country"];
  const esc = v => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const iso = ms => (ms ? new Date(Number(ms)).toISOString() : "");

  const lines = [cols.join(",")];
  for (const r of (rows.results || [])) {
    lines.push(cols.map(c =>
      esc(c === "first_seen" || c === "last_seen" ? iso(r[c]) : r[c])
    ).join(","));
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bassar-list-${new Date().toISOString().slice(0,10)}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}

/* ---------- events ----------
   A batch of behavioural events from the client. vid only: no contact, no IP
   hash ever lands in this table. Fixed vocabulary, whitelisted props, and a
   per-session budget, so the table can only grow from sessions that opened a
   real play row first.                                                   */
const EVENT_NAMES = new Set(["run_start", "beat_reached", "ending_reached", "run_end", "form_shown", "form_filed"]);
const EVENT_BATCH_MAX = 50;       // events per request
const EVENT_SESSION_CAP = 400;    // events per session, across all requests
const ID_RE = /[^\w.:\-]/g;     // beat_id / ending_id: word chars, dot, colon, dash

function cleanProps(p) {
  const o = {};
  if (!p || typeof p !== "object") return "{}";
  if (p.run != null)        o.run = int(p.run, 1000);
  if (p.dur_ms != null)     o.dur_ms = int(p.dur_ms, 24 * 3600 * 1000);
  if (p.hidden === true)    o.hidden = true;
  for (const k of ["beat_id", "ending_id", "reason", "surface"]) {
    if (p[k] != null) o[k] = str(p[k], 40).replace(ID_RE, "_");
  }
  return JSON.stringify(o);
}

async function handleEvents(req, env) {
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let body; try { body = await req.json(); } catch (e) { return json({ ok: false, error: "json" }, 400); }

  const session = str(body.session, 40), vid = str(body.vid, 40), game = str(body.game, 40);
  const list = Array.isArray(body.events) ? body.events.slice(0, EVENT_BATCH_MAX) : [];
  if (!session || !vid || !game || !list.length) return json({ ok: false, drop: true, error: "shape" }, 400);

  // the play row must already exist, and belong to this visitor. /play is rate-limited
  // per IP, so this is what stops events being written for sessions that were never opened.
  const play = await env.DB.prepare("SELECT vid FROM plays WHERE id = ?").bind(session + ":" + game).first();
  if (!play || play.vid !== vid) return json({ ok: false, drop: true, error: "no_session" });

  const now = Date.now();
  const rows = [];
  for (const e of list) {
    if (!e || !EVENT_NAMES.has(e.n)) continue;
    const t = Number(e.t);
    const ts = Number.isFinite(t) && t >= now - 86400000 && t <= now + 60000 ? Math.round(t) : now;
    rows.push([ts, session, vid, game, e.n, cleanProps(e.p)]);
  }
  if (!rows.length) return json({ ok: true, n: 0 });

  // atomic budget: the UPDATE only succeeds while the session is under its cap
  const bud = await env.DB.prepare(
    "UPDATE plays SET evn = COALESCE(evn,0) + ? WHERE id = ? AND COALESCE(evn,0) + ? <= ?"
  ).bind(rows.length, session + ":" + game, rows.length, EVENT_SESSION_CAP).run();
  if (!bud.meta || !bud.meta.changes) return json({ ok: false, drop: true, error: "cap" });

  await env.DB.batch(rows.map(r =>
    env.DB.prepare("INSERT INTO events(ts, session, vid, game, name, props) VALUES(?,?,?,?,?,?)").bind(...r)));
  return json({ ok: true, n: rows.length });
}


/* =============================================================================
   ERROR LOG  —  POST /errors      ("is it working?"; the behaviour log is /events)
   =============================================================================
   Receives crash/failure reports from the client (client/bassar-client.js,
   section "ERROR CAPTURE") and stores them in the `errors` table (migration 0003).

   RULES THIS HANDLER ENFORCES — change them deliberately, not by accident:
     1. Fixed vocabulary of kinds (ERROR_KINDS). Anything else is ignored.
     2. A play row must already exist for this session AND belong to this vid.
        (/play is rate-limited per IP, so this stops error rows for sessions
        that were never opened.)
     3. At most ERROR_SESSION_CAP rows per session, enforced atomically with a
        single UPDATE on plays.errn.
     4. Messages are sanitised here too, not just in the client: URL query
        strings removed, email-like strings -> [email], digit runs of 7+ ->
        [digits], length-capped. An error message can quote what a player typed.
     5. No contact details and no IP hash are ever written to `errors`.
   Full write-up: v2-handoff/ERROR-LOGGING.md
   ============================================================================= */
const ERROR_KINDS = new Set(["js_error", "promise_rejection", "request_failed", "slow_or_stalled", "webgl_lost"]);
const ERROR_BATCH_MAX = 5;        // errors per request
const ERROR_SESSION_CAP = 5;      // errors per session, across all requests

/* mask anything that could be personal, strip query strings, cap the length */
function cleanErrText(v, max) {
  return str(v, 400)
    .replace(/\?[^\s)'"]*/g, "")                  // URL query strings
    .replace(/[^\s@]+@[^\s@]+/g, "[email]")      // email-like
    .replace(/\d[\d\s().+-]{5,}\d/g, "[digits]") // phone-like / long digit runs (7+ digits)
    .slice(0, max);
}

async function handleErrors(req, env) {
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let body; try { body = await req.json(); } catch (e) { return json({ ok: false, error: "json" }, 400); }

  const session = str(body.session, 40), vid = str(body.vid, 40);
  const game = str(body.game, 40) || "site";            // site pages have no game slug
  const build = str(body.build, 40).replace(/[^\w.:\-]/g, "_");
  const list = Array.isArray(body.errors) ? body.errors.slice(0, ERROR_BATCH_MAX) : [];
  if (!session || !vid || !list.length) return json({ ok: false, drop: true, error: "shape" }, 400);

  // the session must exist and be this visitor's. Any of the session's play rows will do
  // (a site page has a page:* row, a game has its own); idx_plays_vid keeps this lookup cheap.
  const play = await env.DB.prepare("SELECT id FROM plays WHERE vid = ? AND session = ? ORDER BY ts ASC, id ASC LIMIT 1"   /* deterministic: the budget lives on the session's first play row */)
    .bind(vid, session).first();
  if (!play) return json({ ok: false, drop: true, error: "no_session" });

  const device = /Mobi|Android|iPhone|iPad/i.test(req.headers.get("User-Agent") || "") ? "mobile" : "desktop";
  const now = Date.now();
  const rows = [];
  for (const e of list) {
    if (!e || !ERROR_KINDS.has(e.k)) continue;
    const message = cleanErrText(e.m, 200), source = cleanErrText(e.s, 120);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(e.k + "|" + message + "|" + source));
    const fingerprint = [...new Uint8Array(digest)].slice(0, 6).map(b => b.toString(16).padStart(2, "0")).join("");
    rows.push([now, game, session, vid, e.k, message, source, build, device, fingerprint]);
  }
  if (!rows.length) return json({ ok: true, n: 0 });

  // atomic per-session budget (one UPDATE; succeeds only while under the cap)
  const bud = await env.DB.prepare(
    "UPDATE plays SET errn = COALESCE(errn,0) + ? WHERE id = ? AND COALESCE(errn,0) + ? <= ?"
  ).bind(rows.length, play.id, rows.length, ERROR_SESSION_CAP).run();
  if (!bud.meta || !bud.meta.changes) return json({ ok: false, drop: true, error: "cap" });

  await env.DB.batch(rows.map(r => env.DB.prepare(
    "INSERT INTO errors(ts, game, session, vid, kind, message, source, build, device, fingerprint) VALUES(?,?,?,?,?,?,?,?,?,?)"
  ).bind(...r)));
  return json({ ok: true, n: rows.length });
}


/* ---------- GET /leaderboard ----------
   Names and scores only. Never contact details, never visitor ids. Public,
   read-only, cached about a minute at the edge and in the browser.
   One row per visitor per file (their best), top 20 per file. Rows come from
   the score fields /record already stores in `detail`; nothing is computed
   here that the games did not send.                                        */
const BOARD_TOP = 20;
const BOARD = {
  "void-drift": {
    where: "json_extract(detail,'$.recovered') IS NOT NULL",
    order: "CAST(json_extract(detail,'$.recovered') AS INTEGER) DESC, CAST(json_extract(detail,'$.score') AS INTEGER) DESC",
    pick: d => ({ recovered: int(d.recovered, 8), score: int(d.score) })
  },
  "recovered-records": {
    where: "json_extract(detail,'$.resolved') IS NOT NULL",
    order: "CAST(json_extract(detail,'$.resolved') AS INTEGER) DESC, CAST(json_extract(detail,'$.distance') AS INTEGER) DESC",
    pick: d => ({ resolved: int(d.resolved, 99), distance: int(d.distance) })
  },
  "transcript": {
    where: "json_extract(detail,'$.decoded') IS NOT NULL",
    order: "CAST(json_extract(detail,'$.decoded') AS INTEGER) DESC, CAST(json_extract(detail,'$.match') AS INTEGER) DESC",
    pick: d => ({ decoded: int(d.decoded, 999), match: int(d.match, 100) })
  }
};

// a name field is for a name. If someone typed a contact into it, it is not shown.
function publicName(raw) {
  const n = str(raw, 18);
  if (!n || /@|https?:|www\./i.test(n) || /\d[\d\s().+-]{5,}\d/.test(n)) return "anon";
  return n;
}

async function handleLeaderboard(req, env, url) {
  if (req.method !== "GET") return json({ ok: false }, 405);
  const cache = caches.default;
  const key = new Request(url.origin + "/leaderboard", { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;

  const files = {};
  for (const [game, cfg] of Object.entries(BOARD)) {
    const rows = await env.DB.prepare(
      `SELECT vid, id, name, detail FROM records
        WHERE game = ? AND surface = 'game-end' AND ${cfg.where}
        ORDER BY ${cfg.order}, ts ASC LIMIT 300`
    ).bind(game).all();
    const seen = new Set(), out = [];
    for (const r of rows.results || []) {
      const who = r.vid || r.id;                       // best row per visitor: rows arrive best-first
      if (seen.has(who)) continue;
      seen.add(who);
      let d = {}; try { d = JSON.parse(r.detail || "{}"); } catch (_) {}
      out.push(Object.assign({ name: publicName(r.name) }, cfg.pick(d)));
      if (out.length >= BOARD_TOP) break;
    }
    files[game] = out;
  }

  const res = new Response(JSON.stringify({ ok: true, files }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60, s-maxage=60" }
  });
  await cache.put(key, res.clone());
  return res;
}


/* ---------- POST /api/contact ----------
   The Contact page. Stores the message; the contact detail lives only in the
   `messages` table, same rule as `records`. No public route ever returns it.
   Rate limit: per hashed IP, counted in the table itself.               */
const AUDIENCES = new Set(["player", "developer", "press", "partners", "producers"]);
const MSG_MAX = 2000;
const MSG_RL_WINDOW_MS = 10 * 60 * 1000, MSG_RL_MAX = 3;

async function handleContact(req, env) {
  if (req.method !== "POST") return json({ ok: false }, 405);

  // a message is at most 2,000 characters; the envelope around it is small. Refuse anything bigger before parsing.
  const raw = await req.text();
  if (raw.length > 6000) return json({ ok: false, error: "too long" }, 413);
  let body = null; try { body = JSON.parse(raw); } catch (_) {}
  if (!body || typeof body !== "object") return json({ ok: false, error: "bad body" }, 400);

  // honeypot: a field no human ever fills. Answer as if it worked.
  if (str(body.website, 50)) return json({ ok: true });

  const audience = str(body.audience, 20);
  const text = typeof body.message === "string" ? body.message.trim() : "";
  const c = classifyContact(body.contact);
  if (!AUDIENCES.has(audience) || !text || c.kind === "none") return json({ ok: false, error: "empty" }, 400);
  if (text.length > MSG_MAX) return json({ ok: false, error: "too long" }, 413);

  const hash = await ipHash(req, env);
  const since = Date.now() - MSG_RL_WINDOW_MS;
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM messages WHERE ip_hash = ? AND ts > ?`).bind(hash, since).first();
  if (row && row.n >= MSG_RL_MAX) return json({ ok: false, error: "throttled" }, 429);

  const m = meta(req, body);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await env.DB.prepare(
    `INSERT INTO messages (id, ts, vid, audience, name, contact, body, source, medium, campaign, ip_hash, notified)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,0)`
  ).bind(id, Date.now(), m.vid, audience, str(body.name, 80), c.value, text, m.source, m.medium, m.campaign, hash).run();

  // Tell the owner. Never allowed to fail the request: the message is already safe in the table.
  try {
    if (await notifyContact(env, { id, audience, name: str(body.name, 80), contact: c.value, body: text })) {
      await env.DB.prepare(`UPDATE messages SET notified = 1 WHERE id = ?`).bind(id).run();
    }
  } catch (err) { console.error("bassar contact notify", err && err.message); }

  return json({ ok: true });
}

/* EMAIL NOTIFICATION — deliberately not wired yet (awaiting the owner's go-ahead on the send
   method; see the proposal in the handoff). Returns true only when a mail was actually sent.
   The recipient is the Worker secret CONTACT_TO: never in code, the repo or any page.
   Until it is configured this is a no-op and every message stays `notified = 0`. */
/* Email the owner through Resend. Needs three things, all optional until set up:
     RESEND_API_KEY  secret   (wrangler secret put RESEND_API_KEY)
     CONTACT_TO      secret   the owner's address; never in code, repo or a page
     CONTACT_FROM    var      e.g. "BASSAR PLAY <contact@bassarplay.com>", on a domain verified in Resend
   Any of them missing -> returns false and the row stays notified = 0 (the backlog). Plain text only,
   and the subject carries nothing a visitor typed, so there is nothing to inject. */
async function notifyContact(env, msg) {
  if (!env.RESEND_API_KEY || !env.CONTACT_TO || !env.CONTACT_FROM) return false;
  const lines = [
    "Audience: " + msg.audience,
    "Name: " + (msg.name || "(none)"),
    "Contact: " + msg.contact,
    "",
    msg.body,
    "",
    "id " + msg.id,
  ];
  const payload = {
    from: env.CONTACT_FROM,
    to: [env.CONTACT_TO],
    subject: "[BASSAR] message from " + msg.audience,
    text: lines.join("\n"),
  };
  if (msg.contact.includes("@")) payload.reply_to = msg.contact;   // reply goes to the sender
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) { console.error("bassar contact: resend", res.status, (await res.text()).slice(0, 200)); return false; }
  return true;
}
