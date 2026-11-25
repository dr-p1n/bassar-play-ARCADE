/* The landing carousel: native scroll-snap does the swiping, this only wires the
   buttons, the dots and the keyboard. No autoplay: motion here is rare on purpose. */
(function () {
  "use strict";
  var root = document.querySelector("[data-carousel]"); if (!root) return;
  var track = root.querySelector(".slides"), slides = [].slice.call(track.children);
  var dots = [].slice.call(root.querySelectorAll(".dots button")), count = root.querySelector(".count"), cur = 0;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function show(i) {
    cur = i;
    slides.forEach(function (s, k) { if ("inert" in s) s.inert = k !== i; s.setAttribute("aria-hidden", k === i ? "false" : "true"); });
    dots.forEach(function (d, k) { d.setAttribute("aria-selected", k === i ? "true" : "false"); });
    if (count) count.textContent = "0" + (i + 1) + " / 0" + slides.length;
  }
  function go(i, instant) {
    i = (i + slides.length) % slides.length;
    track.scrollTo({ left: i * track.clientWidth, behavior: instant || reduce ? "auto" : "smooth" });
    show(i);
  }
  var t = null;
  track.addEventListener("scroll", function () {
    clearTimeout(t);
    t = setTimeout(function () { var i = Math.round(track.scrollLeft / track.clientWidth); if (i !== cur && i >= 0 && i < slides.length) show(i); }, 80);
  }, { passive: true });
  root.querySelector(".prev").addEventListener("click", function () { go(cur - 1); });
  root.querySelector(".next").addEventListener("click", function () { go(cur + 1); });
  dots.forEach(function (d, k) { d.addEventListener("click", function () { go(k); }); });
  root.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); }
  });
  addEventListener("resize", function () { go(cur, true); });
  show(0);
})();
