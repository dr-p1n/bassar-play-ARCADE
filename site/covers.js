/* BASSAR covers — one metaphor per file, never the thing itself.
   Drawn on canvas, rolled per visit (positions, counts, timings), and nearly still:
   only the slowest things move. Used by the landing carousel and the games page.
   Logical space is 400x600; the safe zone for a 4:3 crop is y 150..450.

   VOID//DRIFT        two photographs of one treeline. In the second it is closer.
   RECOVERED RECORDS  a table set for four. One plate untouched. Something comes from the side.
   TRANSCRIPT         a tape of marks. In the middle, a gap, and the gap is listening. */
(function () {
  "use strict";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MINT = "#72ffc2";
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.random() * a.length | 0]; }

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

  /* ---- VOID//DRIFT: "the treeline is closer in the second photograph. nobody moved the camera."
     One treeline is generated once. It is drawn solid, and again behind it, larger and ghosted.
     A single mint speck hangs in the sky on a plumb line to the ground. ---- */
  function driftCover() {
    var hor = rnd(404, 426), seed = rnd(0, 99), trees = [], x = -14, ph = rnd(0, 6.28);
    while (x < 414) {
      var clump = vn(x * .02, seed), h = 22 + 70 * clump * (.5 + .5 * Math.random());
      trees.push({ x: x, w: rnd(12, 24), h: h });
      x += rnd(9, 18);
    }
    var sx = rnd(150, 250), sy = rnd(236, 300);
    function line(g, k, fill, stroke) {
      g.save(); g.translate(200, hor); g.scale(k, k); g.translate(-200, -hor);
      g.beginPath(); g.moveTo(-40, hor + 2);
      for (var i = 0; i < trees.length; i++) { var t = trees[i]; g.lineTo(t.x - t.w / 2, hor); g.lineTo(t.x, hor - t.h); g.lineTo(t.x + t.w / 2, hor); }
      g.lineTo(460, hor + 2); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1 / k; g.stroke(); }
      g.restore();
    }
    return function (g, t) {
      var sky = g.createLinearGradient(0, 0, 0, hor);
      sky.addColorStop(0, "#06030d"); sky.addColorStop(.62, "#120726"); sky.addColorStop(1, "#2a1250");
      g.fillStyle = sky; g.fillRect(0, 0, 400, hor + 2);
      var gl = g.createRadialGradient(200, hor, 0, 200, hor, 260); gl.addColorStop(0, "rgba(120,80,200,.28)"); gl.addColorStop(1, "rgba(120,80,200,0)");
      g.fillStyle = gl; g.fillRect(0, 0, 400, 600);
      var k = 1.45 + .05 * Math.sin(t * .11 + ph);                         // the second photograph, creeping
      line(g, k, "rgba(86,44,150,.78)", "rgba(183,155,227,.55)");
      line(g, 1, "#05020a", null);
      g.fillStyle = "#05020a"; g.fillRect(0, hor, 400, 600 - hor);
      var by = sy + Math.sin(t * .6) * 2;
      var pl = g.createLinearGradient(0, by, 0, hor); pl.addColorStop(0, "rgba(114,255,194,.28)"); pl.addColorStop(1, "rgba(114,255,194,0)");
      g.fillStyle = pl; g.fillRect(sx - .5, by, 1, hor - by);              // the plumb line: how far down it is
      var rg = g.createRadialGradient(sx, by, 0, sx, by, 46); rg.addColorStop(0, "rgba(114,255,194,.34)"); rg.addColorStop(1, "rgba(114,255,194,0)");
      g.fillStyle = rg; g.fillRect(sx - 46, by - 46, 92, 92);
      g.fillStyle = MINT; g.fillRect(sx - 4, by - 4, 8, 8);
    };
  }

  /* ---- RECOVERED RECORDS: "the table set for four. one plate untouched."
     Seen from above. Three plates have been used; one has not, and it is the only light.
     A shadow leans in from the far side, slowly. ---- */
  function recordsCover() {
    var un = Math.random() * 4 | 0, ph = rnd(0, 6.28), jit = [], i;
    for (i = 0; i < 4; i++) jit.push([rnd(-4, 4), rnd(-4, 4)]);
    var off = [[-76, -70], [76, -70], [-76, 70], [76, 70]];
    var fromRight = (un % 2) === 0 ? 1 : -1;                               // the shadow comes from the side the lit plate is not on
    return function (g, t) {
      g.fillStyle = "#0b0415"; g.fillRect(0, 0, 400, 600);
      var flick = .86 + .14 * vn(t * 1.6, 7.3) + (Math.random() < .003 ? -.4 : 0);
      var lamp = g.createRadialGradient(200, 300, 0, 200, 300, 270); lamp.addColorStop(0, "rgba(114,255,194," + (.1 * flick) + ")"); lamp.addColorStop(1, "rgba(114,255,194,0)");
      g.fillStyle = lamp; g.fillRect(0, 0, 400, 600);
      g.lineCap = "round";
      for (i = 0; i < 4; i++) {
        var cx = 200 + off[i][0] + jit[i][0], cy = 300 + off[i][1] + jit[i][1], lit = i === un;
        g.strokeStyle = lit ? "rgba(114,255,194,.5)" : "rgba(183,155,227,.26)"; g.lineWidth = 1.4;     // knife and fork
        g.beginPath(); g.moveTo(cx - 76, cy - 38); g.lineTo(cx - 76, cy + 38); g.moveTo(cx + 76, cy - 38); g.lineTo(cx + 76, cy + 38); g.stroke();
        g.fillStyle = lit ? "rgba(114,255,194," + (.1 * flick) + ")" : "#12071f";
        g.beginPath(); g.arc(cx, cy, 54, 0, 6.2832); g.fill();
        g.strokeStyle = lit ? "rgba(114,255,194," + (.95 * flick) + ")" : "rgba(183,155,227,.5)"; g.lineWidth = lit ? 2.4 : 2;
        g.beginPath(); g.arc(cx, cy, 54, 0, 6.2832); g.stroke();
        g.strokeStyle = lit ? "rgba(114,255,194,.4)" : "rgba(183,155,227,.16)"; g.lineWidth = 1.2;
        g.beginPath(); g.arc(cx, cy, 37, 0, 6.2832); g.stroke();
        if (!lit) {                                                       // what was eaten from: an off-centre emptiness
          g.fillStyle = "rgba(5,2,10,.7)"; g.beginPath(); g.arc(cx + 11 * Math.cos(i * 2.1 + ph), cy + 11 * Math.sin(i * 2.1 + ph), 21, 0, 6.2832); g.fill();
        }
      }
      g.save(); g.translate(200, 300); g.scale(fromRight, 1); g.rotate(-.18 + .05 * Math.sin(t * .14 + ph));
      var sx = 44 + 22 * Math.sin(t * .09 + ph), sg = g.createLinearGradient(sx, 0, sx + 200, 0);
      sg.addColorStop(0, "rgba(5,2,10,0)"); sg.addColorStop(.55, "rgba(5,2,10,.9)"); sg.addColorStop(1, "rgba(5,2,10,.96)");
      g.fillStyle = sg; g.fillRect(sx, -520, 420, 1040); g.restore();
    };
  }

  /* ---- TRANSCRIPT: "the gap in the tape is not missing. it is the part that is listening."
     Rows of marks drift past. Near the middle they turn mint, and then there is a gap with
     something small in it. Past the gap the same marks are quieter: it has learned them. ---- */
  function tapeCover() {
    var R = 9, L = 640, rows = [], i, cx = 200 + rnd(-14, 14), gw = 30, pulses = [], next = rnd(1, 3);
    for (i = 0; i < R; i++) {
      var marks = [], x = rnd(0, 30);
      while (x < L) { var w = rnd(5, 26); marks.push({ x: x, w: w, h: pick([6, 8, 10, 14]), a: rnd(.3, .75) }); x += w + rnd(4, 18); }
      rows.push({ y: 156 + i * 36, v: rnd(5, 15), off: rnd(0, L), m: marks });
    }
    return function (g, t, dt) {
      g.fillStyle = "#0a0414"; g.fillRect(0, 0, 400, 600);
      var rg = g.createRadialGradient(cx, 300, 0, cx, 300, 200); rg.addColorStop(0, "rgba(114,255,194,.13)"); rg.addColorStop(1, "rgba(114,255,194,0)");
      g.fillStyle = rg; g.fillRect(0, 0, 400, 600);
      for (i = 0; i < R; i++) {
        var r = rows[i]; r.off = (r.off + r.v * dt) % L;
        for (var k = 0; k < r.m.length; k++) {
          var m = r.m[k], px = ((m.x - r.off) % L + L) % L - 120, mc = px + m.w / 2;
          if (px > 400 || px + m.w < 0) continue;
          var d = Math.abs(mc - cx);
          if (d < gw) continue;                                          // the gap
          if (d < gw + 52 && mc > cx) { var a = 1 - (d - gw) / 52; g.fillStyle = "rgba(114,255,194," + (.2 + .7 * a) + ")"; }
          else if (mc < cx) g.fillStyle = "rgba(106,75,163," + (m.a * .5) + ")";   // past the gap: quieter, learned
          else g.fillStyle = "rgba(183,155,227," + m.a + ")";
          g.fillRect(px, r.y - m.h / 2, m.w, m.h);
        }
      }
      g.fillStyle = "rgba(114,255,194,.12)"; g.fillRect(cx - gw, 128, 1, 344); g.fillRect(cx + gw, 128, 1, 344);
      next -= dt; if (next <= 0) { pulses.push({ r: 12, a: .7 }); next = rnd(4, 9); }
      g.strokeStyle = MINT; g.lineWidth = 1.2;
      for (i = pulses.length - 1; i >= 0; i--) { var p = pulses[i]; p.r += dt * 34; p.a -= dt * .22; if (p.a <= 0) { pulses.splice(i, 1); continue; } g.globalAlpha = p.a; g.beginPath(); g.arc(cx, 300, p.r, 0, 6.2832); g.stroke(); }
      g.globalAlpha = 1; g.lineWidth = 1.6; g.beginPath(); g.arc(cx, 300, 11 + Math.sin(t * 1.4) * 1.2, 0, 6.2832); g.stroke();
      g.fillStyle = MINT; g.beginPath(); g.arc(cx, 300, 3.2, 0, 6.2832); g.fill();
    };
  }

  var GENS = { drift: driftCover, records: recordsCover, transcript: tapeCover };
  var arts = [].slice.call(document.querySelectorAll("canvas.art")).filter(function (c) { return GENS[c.dataset.art]; }).map(function (c) {
    return { c: c, g: c.getContext("2d"), gen: GENS[c.dataset.art](), vis: true, t: 0, W: 0, H: 0, S: 1, ox: 0, oy: 0 };
  });
  if (!arts.length) return;

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
  var rs = null; addEventListener("resize", function () { clearTimeout(rs); rs = setTimeout(function () { arts.forEach(sizeArt); arts.forEach(function (o) { drawArt(o, 0); }); }, 160); });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { arts.forEach(function (o) { if (o.c === e.target) o.vis = e.isIntersecting; }); }); });
    arts.forEach(function (o) { io.observe(o.c); });
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
