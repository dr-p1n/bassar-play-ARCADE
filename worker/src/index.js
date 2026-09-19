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
