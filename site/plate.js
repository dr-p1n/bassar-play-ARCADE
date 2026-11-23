/* BASSAR — the PLAY plate is haunted.
   Two layers, both rolled fresh every visit (nothing keyed):
     static       a few specks flicker on the plate's half-module grid, always
     poltergeist  rarely: rows of the letters tear sideways, a violet ghost slips
                  out from behind the plate, a letter drops out, the plate
                  inverts for a frame. It stutters on-off-on, then settles clean.
   Reduced motion: one still frame, nothing runs. */
(function () {
  "use strict";
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var svg = document.querySelector(".wordmark .mark"), plate = svg && svg.querySelector(".plate"), ko = svg && svg.querySelector(".ko");
  if (!plate || !ko) return;
  var NS = "http://www.w3.org/2000/svg", MINT = "#72ffc2", INK = "#0a0414", VIOLET = "#4b2585", Q = 13;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.random() * a.length | 0]; }
  function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }

  var X = +plate.getAttribute("x"), Y = +plate.getAttribute("y"), W = +plate.getAttribute("width"), H = +plate.getAttribute("height");
  var cols = Math.floor(W / Q), rows = Math.floor(H / Q);
  var bits = [].slice.call(ko.querySelectorAll("rect"));

  /* the ghost: a violet copy of the plate, parked behind it, shown only in a burst */
  var ghost = el("rect", { x: X, y: Y, width: W, height: H, fill: VIOLET, opacity: 0 });
  plate.parentNode.insertBefore(ghost, plate);

  /* static: a small pool of specks, clipped to the plate, re-rolled in place */
  var noise = el("g", { "clip-path": "url(#plateClip)", "pointer-events": "none" });
  var specks = [];
  for (var i = 0; i < 56; i++) { var s = el("rect", { width: Q, height: Q, opacity: 0 }); noise.appendChild(s); specks.push(s); }
  svg.appendChild(noise);

  var heavy = 0;                                       // 0 = quiet, 1 = burst
  function speckle() {
    var live = heavy ? specks.length : 3 + (Math.random() * 4 | 0);
    for (var i = 0; i < specks.length; i++) {
      var s = specks[i];
      if (i >= live || Math.random() < .25) { s.setAttribute("opacity", 0); continue; }
      s.setAttribute("x", X + (Math.random() * cols | 0) * Q);
      s.setAttribute("y", Y + (Math.random() * rows | 0) * Q);
      s.setAttribute("fill", Math.random() < .5 ? INK : MINT);
      s.setAttribute("opacity", heavy ? rnd(.55, .95) : rnd(.18, .4));
    }
  }
  (function tick() {
    if (!document.hidden) speckle();
    setTimeout(tick, heavy ? rnd(40, 80) : rnd(110, 260));
  })();

  /* poltergeist frames */
  function tear() {
    var shifts = [];
    for (var r = 0; r < 7; r++) shifts[r] = Math.random() < .55 ? pick([-1, 1]) * Q * (1 + (Math.random() * 3 | 0)) : 0;
    var gone = Math.random() < .6 ? Math.random() * 4 | 0 : -1;
    bits.forEach(function (b) {
      var l = +b.getAttribute("data-l");
      b.setAttribute("transform", "translate(" + shifts[+b.getAttribute("data-r")] + " 0)");
      b.style.opacity = l === gone ? 0 : "";
    });
    ghost.setAttribute("transform", "translate(" + pick([-1, 1]) * rnd(18, 44) + " " + pick([-1, 0, 1]) * Q + ")");
    ghost.setAttribute("opacity", rnd(.6, 1));
  }
  function invert(on) {
    plate.style.fill = on ? INK : "";
    bits.forEach(function (b) { b.style.fill = on ? MINT : ""; });
  }
  function clean() {
    heavy = 0; invert(false);
    bits.forEach(function (b) { b.removeAttribute("transform"); b.style.opacity = ""; });
    ghost.setAttribute("opacity", 0); ghost.removeAttribute("transform");
    speckle();
  }
  var busy = false;
  function haunt(power) {
    if (busy) return; busy = true;
    var n = 3 + Math.round(power * (2 + Math.random() * 4)), i = 0;
    (function frame() {
      if (i >= n) { clean(); busy = false; return; }
      var bad = i % 2 === 0 || Math.random() < .3;      // on-off-on: bad frames break up with clean ones
      if (bad) { heavy = 1; tear(); invert(Math.random() < .14); speckle(); } else clean();
      i++; setTimeout(frame, rnd(40, 120));
    })();
  }

  /* rare, irregular, never cursor-driven. Sometimes it comes twice. The first one waits so the headline lands first. */
  setTimeout(function loop() {
    if (!document.hidden) { haunt(Math.random()); if (Math.random() < .25) setTimeout(function () { haunt(.5); }, rnd(500, 1100)); }
    setTimeout(loop, rnd(4500, 12000));
  }, rnd(3500, 6500));
})();
