/* ------------------------------------------------------------------
   BASSAR — capture client. ONE canonical copy.

   Do not edit this inside a game. Edit it here and run:
       python3 build.py
   which inlines it into the three games and writes site/bassar.js.
   The games must stay self-contained single files for itch.io, which is
   why it is copied rather than linked.

   Three things it tracks, in three tables on the other end:
     visitors  who, across days           (localStorage — persistent)
     plays     one session with one game  (sessionStorage — per tab)
     records   signups                    (the four doors)
------------------------------------------------------------------ */

/* ---- config. The build rewrites GAME and RETURN_LINE per file. ---- */
const BASSAR_ENDPOINT = "https://bassar-capture.julioernestolv.workers.dev";          // "https://bassar-capture.<sub>.workers.dev" — no trailing slash
const BASSAR_SITE     = "";          // "https://bassarplay.com" — where share links point. Empty = this origin.
const BASSAR_GAME     = "%GAME%";    // "" on site pages
const BASSAR_RETURN   = "%RETURN%";  // the in-world line shown to someone who has been here before
const BASSAR_BUILD    = "%BUILD%";   // stamped by build.py (<UTC time>-<hash>): ties every error report to the deploy that shipped it

const BASSAR = (() => {
  const store = k => { try { return window[k] } catch (e) { return null } };
  const LS = store("localStorage"), SS = store("sessionStorage");
  const rd = (s, k) => { try { return s && s.getItem(k) } catch (e) { return null } };
  const wr = (s, k, v) => { try { s && s.setItem(k, v) } catch (e) {} };
  const rand = n => { let s = ""; while (s.length < n) s += Math.random().toString(36).slice(2); return s.slice(0, n); };

  /* ---- the visitor: persistent, across days ---- */
  let V = null;
  try { V = JSON.parse(rd(LS, "bassar_v") || "null") } catch (e) {}
  const fresh = !V || !V.vid;
  if (fresh) V = { vid: rand(16), code: rand(6), first: Date.now(), visits: 0, walks: {}, ref: "" };
  V.walks = V.walks || {};
  V.found = V.found || {};   // { game: { endings: {id: ts}, beats: {id: ts} } } — what this visitor has found

  /* a visit is a new tab session, not a page load */
  let sid = rd(SS, "bassar_sid");
  const newSession = !sid;
  if (newSession) { sid = Date.now().toString(36) + rand(8); wr(SS, "bassar_sid", sid); V.visits = (V.visits || 0) + 1; }

  /* ---- attribution, read once and kept ---- */
  let attr = rd(SS, "bassar_attr");
  const q = new URLSearchParams(location.search);
  if (!attr) {
    attr = JSON.stringify({
      source:   (q.get("src") || q.get("utm_source") || "").slice(0, 60),
      medium:   (q.get("utm_medium") || "").slice(0, 60),
      campaign: (q.get("utm_campaign") || "").slice(0, 60),
      referrer: (document.referrer || "").slice(0, 300)
    });
    wr(SS, "bassar_attr", attr);
  }
  const A = JSON.parse(attr);

  /* ---- the referral chain. Only a brand-new visitor can be claimed. ---- */
  const ref = (q.get("ref") || "").slice(0, 12);
  if (fresh && ref && ref !== V.code) V.ref = ref;

  const save = () => wr(LS, "bassar_v", JSON.stringify(V));
  save();

  /* ---- transport ---- */
  const base = () => BASSAR_ENDPOINT.replace(/\/+$/, "");
  function post(path, extra, beacon) {
    const body = Object.assign({
      session: sid, vid: V.vid, code: V.code, referred_by: V.ref || "",
      visits: V.visits, game: BASSAR_GAME
    }, A, extra || {});
    if (!base()) { console.log("[bassar " + path + "]", body); return Promise.resolve({ ok: true, local: true }); }
    const url = base() + path, s = JSON.stringify(body);
    if (beacon && navigator.sendBeacon) {
      try { navigator.sendBeacon(url, new Blob([s], { type: "text/plain;charset=UTF-8" }));  /* text/plain is CORS-safelisted: no preflight, so the beacon survives the page closing. The worker parses the body as JSON regardless. */ return Promise.resolve({ ok: true }); } catch (e) {}
    }
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
      body: s, keepalive: true })
      .then(r => { if (!r.ok) failedRequest(path, "http " + r.status); return r.ok ? r.json() : { ok: false }; })
      .catch(() => { failedRequest(path, "network"); return { ok: false }; });
  }

  /* ---- playtime, measured rather than inferred ----
     A beat every 30s while a run is actually in progress, stopped on the end
     screen, capped at 40 beats. Sitting on a dead screen is not playtime. */
  const BEAT_MS = 30000, BEAT_CAP = 40;
  let runs = 0, ended = 0, opened = false, activeMs = 0, runStart = 0, beats = 0, timer = null;
  const dur = () => Math.round(activeMs + (runStart ? Date.now() - runStart : 0));

  /* ---- events: batched, never one request per event ----
     Queued in memory, flushed every EV_MS, at EV_MAX queued, when a run ends,
     and on pagehide / tab-hidden via sendBeacon. At most EV_CAP per session
     (the worker enforces the same cap). Games only: site pages have no game. */
  const EV_MS = 10000, EV_MAX = 20, EV_CAP = 300;
  let evq = [], evSent = 0, evTimer = null, runNo = 0, seenBeats = {};
  function ev(name, props) {
    if (!BASSAR_GAME || evSent + evq.length >= EV_CAP) return;
    evq.push({ n: name, t: Date.now(), p: props || {} });
    if (evq.length >= EV_MAX) flushEv(false);
    else if (!evTimer) evTimer = setTimeout(() => flushEv(false), EV_MS);
  }
  function flushEv(beacon) {
    if (evTimer) { clearTimeout(evTimer); evTimer = null; }
    if (!evq.length) return;
    const batch = evq; evq = []; evSent += batch.length;
    post("/events", { events: batch }, beacon).then(r => {
      // a network failure puts the batch back once; a deliberate refusal ({drop}) does not
      if (r && r.ok === false && !r.drop && !beacon) { evq = batch.concat(evq).slice(0, EV_CAP); evSent -= batch.length; }
    });
  }
  function found(kind, id) {
    const g = V.found[BASSAR_GAME] = V.found[BASSAR_GAME] || { endings: {}, beats: {} };
    if (!g[kind][id]) { g[kind][id] = Date.now(); save(); }
  }
  const cleanId = id => String(id == null ? "" : id).slice(0, 40);

  /* =========================================================================
     ERROR CAPTURE — "is it working?"            (events = "are they hooked?")
     =========================================================================
     Reports crashes and failures to POST /errors so a game that breaks on
     someone's phone leaves a trace. Full write-up: v2-handoff/ERROR-LOGGING.md

     WHAT IS CAPTURED (the `kind` column):
       js_error           an uncaught exception            (window "error")
       promise_rejection  an unhandled promise rejection   (window "unhandledrejection")
       request_failed     /play or /record failed (network or non-2xx). The signup
                          form saying "It did not take" used to be invisible.
       slow_or_stalled    the first run of a session drew fewer than ER_MIN_FRAMES
                          frames in ER_FRAMES_MS while the tab was visible
       webgl_lost         a WebGL context was lost (the fog / posters on the site)

     LIMITS, ON PURPOSE:
       - ER_CAP reports per session, identical ones sent once (the worker enforces the cap too).
       - Messages are trimmed and stripped of URL query strings here, and masked
         for emails / long digit runs again in the worker. Never the contact field.
       - The reporter must never be the thing that crashes: everything is in try/catch,
         and failures of /events and /errors themselves are never reported (no loops).

     KNOWN GAPS: a hard browser crash or a frozen main thread cannot report itself;
     errors thrown before this file loads are invisible. Both need real-device testing. */
  const ER_CAP = 5, ER_FRAMES_MS = 5000, ER_MIN_FRAMES = 10;
  let erSent = 0, erSeen = {}, erWatched = false;

  function reportErr(kind, message, source) {
    try {
      message = String(message == null ? "" : message).replace(/\?[^\s)'"]*/g, "").slice(0, 200);
      source = String(source || "").replace(/\?[^\s:)]*/g, "").slice(-120);
      const fp = kind + "|" + message + "|" + source;
      if (erSent >= ER_CAP || erSeen[fp]) return;
      erSeen[fp] = 1; erSent++;
      post("/errors", { build: BASSAR_BUILD, errors: [{ k: kind, m: message, s: source }] });
    } catch (e) { /* the reporter must never throw */ }
  }
  function failedRequest(path, why) {
    // /events and /errors are excluded: a failing error log must not report itself
    if (path === "/play" || path === "/record") reportErr("request_failed", path + " " + why, "");
  }

  addEventListener("error", e => {
    if (e && e.message) reportErr("js_error", e.message, (e.filename || "") + ":" + (e.lineno || 0) + ":" + (e.colno || 0));
  });
  addEventListener("unhandledrejection", e => {
    const r = e && e.reason;
    reportErr("promise_rejection", r && r.message ? r.message : String(r), r && r.stack ? String(r.stack).split("\n")[1] : "");
  });
  // webglcontextlost does not bubble: listen in the capture phase on the document
  document.addEventListener("webglcontextlost", () => reportErr("webgl_lost", "webgl context lost", ""), true);

  /* liveness: count real animation frames for ER_FRAMES_MS after the first run starts.
     Skipped (and retried next run) if the tab was hidden at any point, since hidden tabs stop drawing. */
  function watchFrames() {
    if (erWatched || !BASSAR_GAME) return;
    erWatched = true;
    let frames = 0, hidden = false, alive = true;
    const loop = () => { frames++; if (document.hidden) hidden = true; if (alive) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    setTimeout(() => {
      alive = false;
      if (hidden || document.hidden) { erWatched = false; return; }
      if (frames < ER_MIN_FRAMES) reportErr("slow_or_stalled", "frames=" + frames + " in " + (ER_FRAMES_MS / 1000) + "s", "");
    }, ER_FRAMES_MS);
  }
  /* ===================== end ERROR CAPTURE ===================== */
  const hp = () => { const e = document.getElementById("hp"); return e ? e.value : ""; };

  function beat(beacon) { return post("/play", { runs, ended, dur_ms: dur() }, beacon); }
  function startBeat() {
    if (timer) return;
    timer = setInterval(() => {
      if (++beats > BEAT_CAP) return stopBeat();
      beat(false);
    }, BEAT_MS);
  }
  function stopBeat() { if (timer) { clearInterval(timer); timer = null; } }

  addEventListener("pagehide", () => {
    if (runStart) {
      activeMs += Date.now() - runStart; runStart = 0;
      if (!ended) ev("run_end", { run: runNo, reason: "left", dur_ms: dur() });
    }
    flushEv(true);
    if (runs || BASSAR_GAME === "") beat(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushEv(true);   // mobile tabs often never fire pagehide
    // a backgrounded tab is not playtime
    if (document.hidden && runStart) { activeMs += Date.now() - runStart; runStart = 0; stopBeat(); }
    else if (!document.hidden && runs && !ended) { runStart = Date.now(); startBeat(); }
  });

  return {
    /* how many times this person has been here before, for the in-world line */
    returning: !fresh,
    visits: V.visits,
    walks: V.walks[BASSAR_GAME] || 0,
    code: V.code,
    referredBy: V.ref || "",

    /* a run started. First call is the play row; the rest are depth. */
    run() {
      runs++; ended = 0; runStart = Date.now(); startBeat();
      runNo++; seenBeats = {}; ev("run_start", { run: runNo });
      watchFrames();
      V.walks[BASSAR_GAME] = (V.walks[BASSAR_GAME] || 0) + 1; save();
      if (!opened) { opened = true; return post("/play", { runs, dur_ms: 0, first: 1 }); }
      return beat(false);
    },

    /* a run ended — they are looking at the capture form now */
    ended(endingId) {
      ended = 1;
      if (runStart) { activeMs += Date.now() - runStart; runStart = 0; }
      const id = cleanId(endingId) || "unknown";
      ev("ending_reached", { run: runNo, ending_id: id });
      ev("run_end", { run: runNo, reason: "ending", dur_ms: dur() });
      ev("form_shown", { surface: "game-end" });
      found("endings", id);
      flushEv(false);
      stopBeat(); return beat(false);
    },

    /* a beat was reached in the current run. hidden:true marks an optional beat
       (found, not passed). Each beat counts once per run. */
    beatReached(id, opts) {
      id = cleanId(id);
      if (!id || !runNo || seenBeats[id]) return;
      seenBeats[id] = 1;
      const p = { run: runNo, beat_id: id };
      if (opts && opts.hidden) { p.hidden = true; found("beats", id); }
      ev("beat_reached", p);
    },

    /* what this visitor has found in this game (per vid, kept in their browser):
       { endings: {id: firstFoundMs}, beats: {id: firstFoundMs} } — hidden beats only in `beats`. */
    endingsFound() {
      const g = V.found[BASSAR_GAME] || { endings: {}, beats: {} };
      return { endings: Object.assign({}, g.endings), beats: Object.assign({}, g.beats) };
    },

    /* a page view on the site. kind:"page" keeps it out of the play count. */
    view(page) { return post("/play", { kind: "page", game: "page:" + page, runs: 0 }); },

    /* a signup. surface: game-end | drop | index.
       Carries runs and playtime, so the record says how much of the thing
       they had actually done at the moment they decided to file. */
    record(f) {
      return post("/record", Object.assign(
        { surface: "game-end", website: hp(), runs, ended, dur_ms: dur() }, f))
        .then(r => { if (r && r.ok !== false) { ev("form_filed", { surface: "game-end" }); flushEv(false); } return r; });
    },
    /* the Contact page: a message to the house. Same identity and attribution as every other post. */
    contact(f) { return post("/api/contact", Object.assign({ website: hp() }, f)); },
    sign(surface, game, f) { return post("/record", Object.assign({ surface, game, kind: "page", website: hp() }, f)); },

    /* the share link. Whoever walks in on it arrives marked as yours. */
    shareUrl(slug) {
      const root = (BASSAR_SITE || location.origin).replace(/\/+$/, "");
      const path = slug ? "/" + slug + "/" : (BASSAR_GAME ? "/" + BASSAR_GAME + "/" : "/");
      return root + path + "?ref=" + V.code;
    },

    /* The in-world line on a game's title screen. Two things can be true:
       they arrived on somebody's link, and they have been here before. */
    greet() {
      const el = document.getElementById("returnLine");
      if (!el) return;
      const lines = [];
      if (this.referredBy) lines.push("You arrived on somebody else's line.");
      if (this.walks > 0) {
        lines.push(BASSAR_RETURN.replace("%N%", this.walks === 1 ? "once" : this.walks + " times"));
      }
      if (!lines.length) return;
      el.textContent = lines.join(" ");
      el.style.display = "";
    }
  };
})();

/* ==== SITE ONLY ==== build.py strips this section out of the games. ==== */
/* The same line, on a site page. The site remembers you and says so —
   the tracking is the horror rather than something hidden behind it. */
function bassarGreetPage() {
  const el = document.getElementById("returnLine");
  if (!el) return;
  const lines = [];
  if (BASSAR.referredBy) lines.push("You arrived on somebody else's line.");
  if (BASSAR.visits > 1) {
    lines.push("You have been here before. The record has " +
      (BASSAR.visits === 2 ? "two visits" : BASSAR.visits + " visits") + " against you.");
  }
  if (!lines.length) return;
  el.textContent = lines.join(" ");
  el.style.display = "";
}

/* Wire any <form data-bassar-surface="drop" data-bassar-game="transcript">. */
function bassarBindForms() {
  document.querySelectorAll("form[data-bassar-surface]").forEach(form => {
    const msg = form.querySelector("[data-bassar-msg]"), btn = form.querySelector("button");
    const done = form.dataset.bassarDone || "Filed. You are on the record.";
    form.addEventListener("submit", e => {
      e.preventDefault();
      const val = n => ((form.querySelector("[name=" + n + "]") || {}).value || "");
      const contact = val("contact").trim();
      if (!contact) { msg.textContent = "The field is empty. Nothing was sent."; return; }
      btn.disabled = true; msg.textContent = "Filing…";
      BASSAR.sign(form.dataset.bassarSurface, form.dataset.bassarGame, {
        name: val("name").trim().slice(0, 18), contact, website: val("website"), consent: 1
      }).then(r => {
        btn.disabled = false;
        if (!r || r.ok === false) { msg.textContent = "It did not take. Try it once more."; return; }
        form.querySelectorAll("input, button").forEach(el => el.style.display = "none");
        msg.textContent = done;
      });
    });
  });
}

/* Carry ?src= / ?ref= through to the game in the iframe. */
function bassarFrame(sel) {
  const f = document.querySelector(sel);
  if (f && f.dataset.src) f.src = f.dataset.src + location.search;
}
/* ==== /SITE ONLY ==== */

/* The share control on an end screen: #shareIn (readonly input) + #shareB. */
function bassarBindShare(slug) {
  const inp = document.getElementById("shareIn"), btn = document.getElementById("shareB");
  if (!inp || !btn) return;
  inp.value = BASSAR.shareUrl(slug);
  btn.addEventListener("click", () => {
    inp.select(); inp.setSelectionRange(0, 999);
    const done = () => { btn.textContent = "COPIED. PASS IT ON."; };
    if (navigator.clipboard) navigator.clipboard.writeText(inp.value).then(done, done);
    else { try { document.execCommand("copy"); done(); } catch (e) {} }
  });
}
