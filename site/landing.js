/* BASSAR landing — headlines that phase and decode.
   Nothing here is a fixed animation: every timing, count, position and speed
   is rolled at load, so no two visits are the same room. (Cover art: covers.js.) */
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

})();
