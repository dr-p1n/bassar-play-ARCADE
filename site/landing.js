/* BASSAR landing — headlines that phase and decode, posters that generate.
   Nothing here is a fixed animation: every timing, count, position and speed
   is rolled at load, so no two visits are the same room. */
(function () {
  "use strict";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.random() * a.length | 0]; }
  var MINT = "#72ffc2";

  /* ======================================================================
     1. HEADLINES: decode in, then phase / glitch at random
     ====================================================================== */
  var POOL = ("ΛϘ⌐╪ϟ⋔Ͱ⊓ϡ⌑ϞΞ⋏Ͳϗ⊔ϙ⌇ϖ⊻Ϡ⌾ϣ⊞Ϥ⌁" + "/\\|<>+=*#%").split("");
  var SPLIT = "-.045em 0 rgba(114,255,194,.9), .045em 0 rgba(170,92,255,.9)";

  function prep(el) {
    var plain = el.textContent.replace(/\s+/g, " ").trim(), chars = [];
    var sr = document.createElement("span"); sr.className = "sr"; sr.textContent = plain;
    var gl = document.createElement("span"); gl.className = "gl pending"; gl.setAttribute("aria-hidden", "true");
    [].slice.call(el.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function (tok) {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { gl.appendChild(document.createTextNode(" ")); return; }
          var w = document.createElement("span"); w.className = "w";
          tok.split("").forEach(function (ch) {
            var c = document.createElement("span"); c.className = "c"; c.textContent = ch; c._o = ch; w.appendChild(c); chars.push(c);
          });
          gl.appendChild(w);
        });
      } else if (n.nodeName === "BR") gl.appendChild(document.createElement("br"));
    });
    el.textContent = ""; el.appendChild(sr); el.appendChild(gl);
    return { el: el, gl: gl, chars: chars, visible: false, decoded: false, mode: el.getAttribute("data-glitch") };
  }
  // a glitching character keeps its measured width, so the line never reflows
  function fix(c) { if (c._w == null) c._w = c.getBoundingClientRect().width; c.style.display = "inline-block"; c.style.width = c._w + "px"; c.style.textAlign = "center"; }
  function unfix(c) { c.style.cssText = ""; c.textContent = c._o; c._w = null; }
  function state(c, kind) {
    fix(c);
    c.textContent = c._o; c.style.color = ""; c.style.opacity = ""; c.style.textShadow = ""; c.style.transform = "";
    if (kind === "scr") { c.textContent = pick(POOL); c.style.color = MINT; c.style.opacity = ".9"; }
    else if (kind === "drop") { c.style.opacity = ".06"; }
    else if (kind === "chr") { c.style.textShadow = SPLIT; c.style.transform = "translateX(" + rnd(-.06, .06) + "em)"; }
  }
  function flick(c) {
    var steps = 2 + (Math.random() * 3 | 0), i = 0, kinds = ["scr", "scr", "drop", "chr"];
    (function step() { if (i++ >= steps) { unfix(c); return; } state(c, pick(kinds)); setTimeout(step, 45 + Math.random() * 90); })();
  }
  function burst(h, power) {
    var n = Math.max(1, Math.round(h.chars.length * power * Math.random() + .5)), used = {};
    for (var k = 0; k < n; k++) { var i = Math.random() * h.chars.length | 0; if (used[i]) continue; used[i] = 1; flick(h.chars[i]); }
  }
  function chroma(h) { h.gl.classList.add("chroma"); setTimeout(function () { h.gl.classList.remove("chroma"); }, 90 + Math.random() * 120); }
  function phase(h) {
    var seq = [.06, 1, .15, 1, .03, 1, .5, 1], i = 0;
    (function s() { if (i >= seq.length) { h.el.style.opacity = ""; return; } h.el.style.opacity = seq[i++]; setTimeout(s, 40 + Math.random() * 110); })();
  }
  function decode(h, dur) {
    var n = h.chars.length, t0 = performance.now();
    var rev = h.chars.map(function (_, i) { return (i / n) * dur * .8 + Math.random() * dur * .25; });
    h.chars.forEach(function (c) { fix(c); c.style.opacity = "0"; });
    h.gl.classList.remove("pending");
    var iv = setInterval(function () {
      var t = performance.now() - t0, all = true;
      h.chars.forEach(function (c, i) {
        if (c._r) return;
        if (t >= rev[i]) {
          c._r = 1; c.textContent = c._o; c.style.color = ""; c.style.opacity = ""; c.style.textShadow = SPLIT;
          setTimeout(function () { unfix(c); c._r = 0; }, 140);
        } else { all = false; c.textContent = pick(POOL); c.style.color = MINT; c.style.opacity = t > rev[i] * .4 ? ".55" : ".18"; }
      });
      if (all) clearInterval(iv);
    }, 55);
  }
  function idle(h) {
    setTimeout(function loop() {
      if (h.visible && !document.hidden) {
        var r = Math.random();
        if (r < .6) burst(h, .16);
        else if (r < .9) { burst(h, .5); chroma(h); }
        else { phase(h); burst(h, .8); chroma(h); }
      }
      setTimeout(loop, 2200 + Math.random() * 7500);
    }, 2200 + Math.random() * 4000);
  }

  if (!reduce) {
    var heads = [].slice.call(document.querySelectorAll("[data-glitch]")).map(prep);
    heads.forEach(function (h) {
      if (h.mode === "hover") {
        h.gl.classList.remove("pending");
        var a = h.el.closest("a"); if (a) a.addEventListener("mouseenter", function () { burst(h, .9); chroma(h); });
      }
    });
    var live = heads.filter(function (h) { return h.mode !== "hover"; });
    live.forEach(function (h) { var r = h.el.getBoundingClientRect(); h.inView = r.top < innerHeight * .92 && r.bottom > 0; });
    var begin = function (h) { if (h.decoded) return; h.decoded = true; h.visible = true; decode(h, 1000 + Math.random() * 600); idle(h); };
    var started = false;
    var start = function () {
      if (started) return; started = true;
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var h = live.filter(function (x) { return x.el === e.target; })[0]; if (!h) return;
          h.visible = e.isIntersecting;
          if (h.visible) begin(h);
        });
      }, { threshold: .4 });
      live.forEach(function (h) {
        if (h.inView) begin(h); else h.gl.classList.remove("pending");   // below the fold stays readable until it is reached
        io.observe(h.el);
      });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
    setTimeout(start, 900);                                              // never leave a headline hidden on a slow font
  }

  /* ======================================================================
     2. POSTERS: three generators, each re-rolled per visit
     ====================================================================== */
  function hh(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vn(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf);
    var a = hh(xi, yi), b = hh(xi + 1, yi), c = hh(xi, yi + 1), d = hh(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }
  var grainTile = (function () {
    var c = document.createElement("canvas"); c.width = c.height = 160;
    var x = c.getContext("2d"), d = x.createImageData(160, 160);
    for (var i = 0; i < d.data.length; i += 4) { var v = Math.random() * 255 | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); return c;
  })();

  /* VOID//DRIFT — an endless run: columns are generated as they arrive, and the
     drifter threads whichever gap comes next. */
  function driftGen() {
    var cols = [], speed = rnd(20, 30), trail = [], dy = 300, sinceTrail = 0;
    function mk(x) {
      var n = 7, jt = [], jb = [];
      for (var i = 0; i <= n; i++) { jt.push(rnd(-7, 7)); jb.push(rnd(-7, 7)); }
      return { x: x, w: rnd(80, 128), gy: rnd(200, 400), gh: rnd(126, 178), ph: rnd(0, 6.28), amp: rnd(0, 36), f: rnd(.15, .5), jt: jt, jb: jb, n: n };
    }
    var x = -90; while (x < 480) { var c = mk(x); cols.push(c); x += c.w + rnd(58, 110); }
    function gap(c, t) { var cy = c.gy + c.amp * Math.sin(t * c.f + c.ph); return [cy - c.gh / 2, cy + c.gh / 2, cy]; }
    return function (g, t, dt) {
      var i, c, gp, gt, gb, k;
      for (i = 0; i < cols.length; i++) cols[i].x -= speed * dt;
      if (cols[0].x + cols[0].w < -30) { cols.shift(); var l = cols[cols.length - 1]; cols.push(mk(l.x + l.w + rnd(58, 110))); }
      for (i = 0; i < cols.length; i++) {
        c = cols[i]; gp = gap(c, t); gt = gp[0]; gb = gp[1];
        g.fillStyle = "#4b2585"; g.strokeStyle = "rgba(190,150,255,.38)"; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(c.x, -30); g.lineTo(c.x + c.w, -30); g.lineTo(c.x + c.w, gt + c.jt[c.n]);
        for (k = c.n; k >= 0; k--) g.lineTo(c.x + c.w * k / c.n, gt + c.jt[k]);
        g.closePath(); g.fill();
        g.beginPath(); for (k = 0; k <= c.n; k++) { var px = c.x + c.w * k / c.n, py = gt + c.jt[k]; if (k) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke();
        g.beginPath(); g.moveTo(c.x, gb + c.jb[0]);
        for (k = 1; k <= c.n; k++) g.lineTo(c.x + c.w * k / c.n, gb + c.jb[k]);
        g.lineTo(c.x + c.w, 630); g.lineTo(c.x, 630); g.closePath(); g.fill();
        g.beginPath(); for (k = 0; k <= c.n; k++) { var qx = c.x + c.w * k / c.n, qy = gb + c.jb[k]; if (k) g.lineTo(qx, qy); else g.moveTo(qx, qy); } g.stroke();
      }
      // the drifter: eases toward the centre of the next gap
      var X = 112, next = cols[0];
      for (i = 0; i < cols.length; i++) if (cols[i].x + cols[i].w > X - 14) { next = cols[i]; break; }
      var target = gap(next, t)[2];
      dy += (target - dy) * (1 - Math.exp(-dt * 2.6));
      var Y = dy + Math.sin(t * 3.1) * 3;
      sinceTrail += dt; if (sinceTrail > .07) { sinceTrail = 0; trail.push({ x: X, y: Y, a: 1 }); if (trail.length > 12) trail.shift(); }
      var rg = g.createRadialGradient(X, Y, 0, X, Y, 90); rg.addColorStop(0, "rgba(114,255,194,.3)"); rg.addColorStop(1, "rgba(114,255,194,0)");
      g.fillStyle = rg; g.fillRect(X - 90, Y - 90, 180, 180);
      g.strokeStyle = MINT;
      for (i = 0; i < trail.length; i++) {
        var p = trail[i]; p.x -= speed * dt; p.a -= dt * .9; if (p.a <= 0) continue;
        g.globalAlpha = p.a * .6; g.lineWidth = 1.4; var s = 4 + p.a * 8; g.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
      }
      g.globalAlpha = 1; g.lineWidth = 2; g.save(); g.translate(X, Y); g.rotate((target - dy) * .004); g.strokeRect(-11, -11, 22, 22); g.restore();
    };
  }

  /* RECOVERED RECORDS — a corridor whose two walls disagree about where it ends.
     You are walking, slowly. Something stands in the light and comes closer. */
  function corridorGen() {
    var vx = rnd(178, 222), vy = rnd(250, 296), dw = rnd(46, 72), dh = rnd(206, 252), tilt = rnd(10, 28) * (Math.random() < .5 ? -1 : 1);
    var seams = [], fig = { d: rnd(.12, .3), off: rnd(-46, 46), a: 0, hide: 0 }, walk = rnd(.025, .045), i;
    for (i = 0; i < 6; i++) seams.push(i / 6);
    return function (g, t, dt) {
      var lx = vx - dw / 2, rx = vx + dw / 2, lyT = vy - dh / 2 - tilt, ryT = vy - dh / 2 + tilt, yB = vy + dh / 2;
      g.fillStyle = "#0b0415"; g.fillRect(0, 0, 400, 600);
      var wl = g.createLinearGradient(0, 0, lx, 0); wl.addColorStop(0, "#08030f"); wl.addColorStop(1, "#22103d");
      g.fillStyle = wl; g.beginPath(); g.moveTo(0, 0); g.lineTo(lx, lyT); g.lineTo(lx, yB); g.lineTo(0, 600); g.closePath(); g.fill();
      var wr = g.createLinearGradient(400, 0, rx, 0); wr.addColorStop(0, "#08030f"); wr.addColorStop(1, "#1a0b30");
      g.fillStyle = wr; g.beginPath(); g.moveTo(400, 0); g.lineTo(rx, ryT); g.lineTo(rx, yB); g.lineTo(400, 600); g.closePath(); g.fill();
      g.fillStyle = "#070310"; g.beginPath(); g.moveTo(0, 0); g.lineTo(400, 0); g.lineTo(rx, ryT); g.lineTo(lx, lyT); g.closePath(); g.fill();
      // walking: seams slide toward you
      g.lineWidth = 1.2; g.strokeStyle = "rgba(130,90,210,.34)";
      for (i = 0; i < seams.length; i++) {
        seams[i] = (seams[i] + walk * dt) % 1; var d = seams[i] * seams[i];
        g.globalAlpha = Math.min(1, seams[i] * 2.5);
        g.beginPath(); g.moveTo(lx - lx * d, lyT - lyT * d); g.lineTo(lx - lx * d, yB + (600 - yB) * d); g.stroke();
        g.beginPath(); g.moveTo(rx + (400 - rx) * d, ryT - ryT * d); g.lineTo(rx + (400 - rx) * d, yB + (600 - yB) * d); g.stroke();
      }
      g.globalAlpha = 1;
      var flick = .84 + .16 * vn(t * 3.2, 4.1) + (Math.random() < .004 ? -.5 : 0);
      var fl = g.createLinearGradient(0, yB, 0, 600); fl.addColorStop(0, "rgba(114,255,194," + (.82 * flick) + ")"); fl.addColorStop(1, "rgba(114,255,194,.03)");
      g.fillStyle = fl; g.beginPath(); g.moveTo(lx, yB); g.lineTo(rx, yB); g.lineTo(vx + dw * 3.2, 600); g.lineTo(vx - dw * 3.2, 600); g.closePath(); g.fill();
      var rg = g.createRadialGradient(vx, vy, 0, vx, vy, 230); rg.addColorStop(0, "rgba(114,255,194," + (.5 * flick) + ")"); rg.addColorStop(1, "rgba(114,255,194,0)");
      g.fillStyle = rg; g.fillRect(0, 0, 400, 600);
      g.save(); g.shadowColor = MINT; g.shadowBlur = 40 * (g._S || 1); g.fillStyle = "#d9fff0";
      g.beginPath(); g.moveTo(lx, lyT); g.lineTo(rx, ryT); g.lineTo(rx, yB); g.lineTo(lx, yB); g.closePath(); g.fill(); g.restore();
      // the figure
      fig.d += dt * .0085;
      if (fig.d > .66) { fig.a -= dt * .8; if (fig.a <= 0) { fig.d = rnd(.1, .26); fig.off = rnd(-50, 50); } } else fig.a = Math.min(1, fig.a + dt * .6);
      if (Math.random() < .003) fig.hide = rnd(.15, .5);
      if (fig.hide > 0) fig.hide -= dt;
      else {
        var fd = fig.d, fy = yB + (600 - yB) * fd, h = 30 + 170 * fd * fd, fx = vx + fig.off * fd, w = h * .24;
        g.globalAlpha = fig.a; g.fillStyle = "#07020c";
        g.beginPath(); g.arc(fx, fy - h * .9, h * .075, 0, 6.2832); g.fill();
        g.beginPath(); g.moveTo(fx - w * .55, fy - h * .8); g.lineTo(fx + w * .55, fy - h * .8); g.lineTo(fx + w * .42, fy - h * .38); g.lineTo(fx + w * .3, fy); g.lineTo(fx + w * .06, fy); g.lineTo(fx, fy - h * .34); g.lineTo(fx - w * .06, fy); g.lineTo(fx - w * .3, fy); g.lineTo(fx - w * .42, fy - h * .38); g.closePath(); g.fill();
        g.globalAlpha = 1;
      }
    };
  }

  /* TRANSCRIPT — rings of marks at irregular intervals; any mark that crosses
     the line is struck, and the centre answers. */
  function ringsGen() {
    var n = 7 + (Math.random() * 4 | 0), rings = [], i, ripples = [], cx = 200, cy = 318, prevAny = false;
    for (i = 0; i < n; i++) {
      var r = 34 + i * rnd(21, 27), C = 6.2832 * r, segs = [], pos = rnd(0, 20);
      while (pos < C - 6) {
        var dash = Math.exp(rnd(1.1, 3.3)) * (i % 2 ? .75 : 1), gap = Math.exp(rnd(1.7, 3.6));
        if (pos + dash > C) break; segs.push({ p: pos, d: dash, f: 0 }); pos += dash + gap;
      }
      rings.push({ r: r, segs: segs, th: rnd(0, 6.28), w: (Math.random() < .5 ? -1 : 1) * rnd(.02, .13) * 34 / r * 2.2, lw: i % 2 ? 2.2 : 3.4, op: Math.random() < .35 ? .95 : rnd(.4, .65) });
    }
    return function (g, t, dt) {
      g.fillStyle = "#0b0414"; g.fillRect(0, 0, 400, 600);
      var rg = g.createRadialGradient(cx, cy, 0, cx, cy, 140); rg.addColorStop(0, "rgba(114,255,194,.22)"); rg.addColorStop(1, "rgba(114,255,194,0)");
      g.fillStyle = rg; g.fillRect(0, 0, 400, 600);
      var any = false, top = -Math.PI / 2;
      for (i = 0; i < rings.length; i++) {
        var R = rings[i]; R.th += R.w * dt * .5;
        for (var k = 0; k < R.segs.length; k++) {
          var s = R.segs[k], a0 = s.p / R.r + R.th, span = s.d / R.r;
          var rel = (((top - a0) % 6.2832) + 6.2832) % 6.2832, hit = rel < span;
          if (hit) { any = true; s.f = 1; } else s.f = Math.max(0, s.f - dt * 2.4);
          g.lineWidth = R.lw + s.f * 1.6; g.lineCap = "butt";
          g.strokeStyle = s.f > .02 ? "rgba(114,255,194," + (.35 + .65 * s.f) + ")" : "rgba(183,155,227," + R.op + ")";
          g.beginPath(); g.arc(cx, cy, R.r, a0, a0 + span); g.stroke();
        }
      }
      if (any && !prevAny) ripples.push({ r: 12, a: .7 });
      prevAny = any;
      g.strokeStyle = MINT; g.lineWidth = 1.2;
      for (i = ripples.length - 1; i >= 0; i--) { var rp = ripples[i]; rp.r += dt * 95; rp.a -= dt * .6; if (rp.a <= 0) { ripples.splice(i, 1); continue; } g.globalAlpha = rp.a; g.beginPath(); g.arc(cx, cy, rp.r, 0, 6.2832); g.stroke(); }
      g.globalAlpha = .9; g.beginPath(); g.moveTo(cx, 40); g.lineTo(cx, cy); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = MINT; g.beginPath(); g.arc(cx, cy, 9 + Math.sin(t * 2) * 1.2 + (any ? 2.5 : 0), 0, 6.2832); g.fill();
      g.globalAlpha = .5; g.beginPath(); g.arc(cx, cy, 22, 0, 6.2832); g.stroke(); g.globalAlpha = 1;
    };
  }

  var GENS = { drift: driftGen, records: corridorGen, transcript: ringsGen };
  var arts = [].slice.call(document.querySelectorAll("canvas.art")).map(function (c) {
    return { c: c, g: c.getContext("2d"), gen: GENS[c.dataset.art](), vis: true, t: 0, W: 0, H: 0, S: 1, ox: 0, oy: 0 };
  });
  function sizeArt(o) {
    var r = o.c.getBoundingClientRect(); if (r.width < 2) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    o.W = Math.round(r.width * dpr); o.H = Math.round(r.height * dpr); o.c.width = o.W; o.c.height = o.H;
    o.S = Math.max(o.W / 400, o.H / 600); o.ox = (o.W - 400 * o.S) / 2; o.oy = (o.H - 600 * o.S) / 2; o.g._S = o.S;
  }
  function drawArt(o, dt) {
    if (!o.W) return;
    var g = o.g; o.t += dt;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = "#0a0414"; g.fillRect(0, 0, o.W, o.H);
    g.setTransform(o.S, 0, 0, o.S, o.ox, o.oy);
    o.gen(g, o.t, dt);
    g.setTransform(1, 0, 0, 1, Math.random() * 160 | 0, Math.random() * 160 | 0);
    g.globalCompositeOperation = "overlay"; g.globalAlpha = .2; g.fillStyle = g.createPattern(grainTile, "repeat");
    g.fillRect(-160, -160, o.W + 320, o.H + 320);
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.setTransform(1, 0, 0, 1, 0, 0);
  }
  arts.forEach(sizeArt);
  var rs = null; addEventListener("resize", function () { clearTimeout(rs); rs = setTimeout(function () { arts.forEach(sizeArt); }, 160); });
  if ("IntersectionObserver" in window) {
    var io2 = new IntersectionObserver(function (es) { es.forEach(function (e) { arts.forEach(function (o) { if (o.c === e.target) o.vis = e.isIntersecting; }); }); });
    arts.forEach(function (o) { io2.observe(o.c); });
  }
  if (reduce) { arts.forEach(function (o) { for (var i = 0; i < 40; i++) drawArt(o, .05); }); }
  else {
    var lastF = 0;
    (function loop(now) {
      requestAnimationFrame(loop);
      if (document.hidden || now - lastF < 1000 / 30) return;
      var dt = Math.min(.08, (now - lastF) / 1000); lastF = now;
      arts.forEach(function (o) { if (o.vis) drawArt(o, dt); });
    })(0);
    arts.forEach(function (o) { drawArt(o, .016); });   // warm the first frame so nothing pops in empty
  }
})();
