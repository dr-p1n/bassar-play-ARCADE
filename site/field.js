/* BASSAR field — the fog behind every page.
   Generated, not drawn: each visit rolls its own noise seed and tint, and the
   dithered smoke flows on its own. Rendered small and scaled up so the
   pixels stay hard. Shared by the landing and the three game pages. */
(function () {
  "use strict";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* bassar.js hides the inputs once filed; the labels should go with them */
  document.querySelectorAll("form[data-bassar-surface]").forEach(function (f) {
    var i = f.querySelector("input[name=contact]"); if (!i) return;
    new MutationObserver(function () {
      if (i.style.display === "none") f.querySelectorAll("label").forEach(function (l) { l.style.display = "none"; });
    }).observe(i, { attributes: true, attributeFilter: ["style"] });
  });

  var cv = document.getElementById("field");
  var gl = cv && cv.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "low-power" });
  var calm = cv && cv.getAttribute("data-calm") === "1";   // game pages: darker, rarer, so the frame stays the subject
  var prog = null;
  if (gl) {
    var VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
    var FS = [
      "precision highp float;",
      "uniform vec2 uRes,uSeed,uView;",
      "uniform vec4 uRects[20], uSoft; uniform float uRectN;",
      "uniform float uT,uScroll,uTear,uHue,uDim;",
      "float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
      "float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
      " return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}",
      "float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(17.1,9.7);a*=.5;}return v;}",
      "float b2(vec2 a){a=floor(a);return fract(a.x/2.+a.y*a.y*.75);}",
      "float b4(vec2 a){return b2(.5*a)*.25+b2(a);}",
      "float b8(vec2 a){return b4(.5*a)*.25+b2(a);}",
      "void main(){",
      " vec2 fc=gl_FragCoord.xy; vec2 uv=fc/uRes; float asp=uRes.x/uRes.y;",
      " vec2 st=vec2(fc.x,uRes.y-fc.y);",
      " float band=step(abs(uv.y-fract(uT*.037)),.035)*uTear;",
      " uv.x+=band*.04*(hash(vec2(floor(uv.y*60.),floor(uT*8.)))-.5)*4.;",
      " vec2 p=(uv-.5)*vec2(asp,1.)*2.3+uSeed; p.y+=uScroll*.4;",
      " float t=uT*.028;",
      " vec2 q=vec2(fbm(p+vec2(0.,t)),fbm(p+vec2(5.2,1.3)-t));",
      " vec2 r=vec2(fbm(p+3.*q+vec2(1.7,9.2)+.6*t),fbm(p+3.*q+vec2(8.3,2.8)-.5*t));",
      " float f=fbm(p+3.*r);",
      " float L=pow(f,3.2)*2.1;",
      " float vig=1.-smoothstep(.2,.9,length((uv-.5)*vec2(1.,1.2)));",
      " L*=mix(.1,1.,vig); L*=mix(.3,1.,smoothstep(.08,.55,uv.y)); L*=uDim;",
      " float away=smoothstep(.0,.8,uScroll); L*=mix(1.,.2,away);",
      " float Lm=0.;",
      " vec2 cp=vec2(fc.x/uRes.x*uView.x,(1.-fc.y/uRes.y)*uView.y); float mask=0.;",
      " for(int i=0;i<20;i++){ if(float(i)>=uRectN) break; vec4 rc=uRects[i]; vec2 cc=(rc.xy+rc.zw)*.5, hh_=(rc.zw-rc.xy)*.5;",
      "  mask=max(mask,1.-smoothstep(0.,64.,length(max(abs(cp-cc)-hh_,0.)))); }",
      " L*=mix(1.,.07,mask); Lm*=1.-mask;",
      /* the headline: the fog keeps flowing right through it, only eased down a little by a very wide, soft swell (no edge, no box) */
      " vec2 zc=(uSoft.xy+uSoft.zw)*.5, zh=(uSoft.zw-uSoft.xy)*.5;",
      " float zone=uSoft.z>uSoft.x?1.-smoothstep(0.,420.,length(max(abs(cp-zc)-zh,0.))):0.;",
      " L*=1.-zone*.42; Lm*=1.-zone;",
      " float dth=b8(st);",
      " float vp=floor(clamp(L,0.,1.)*4.+dth)/4.;",
      " float vm=floor(clamp(Lm,0.,1.)*3.+dth)/3.;",
      " vec3 c1=vec3(.11,.045,.2),c2=mix(vec3(.24,.1,.41),vec3(.17,.1,.46),uHue);",
      " vec3 c3=mix(vec3(.4,.21,.64),vec3(.27,.21,.72),uHue),c4=mix(vec3(.58,.42,.84),vec3(.46,.44,.9),uHue);",
      " vec3 c=vec3(.02,.008,.04);",
      " c=mix(c,c1,step(.12,vp)); c=mix(c,c2,step(.37,vp)); c=mix(c,c3,step(.62,vp)); c=mix(c,c4,step(.87,vp));",
      " c=mix(c,vec3(.45,1.,.76),clamp(vm,0.,1.));",
      " gl_FragColor=vec4(c,1.);",
      "}"
    ].join("\n");
    var sh = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; }
  }

  /* what this visit's room looks like */
  var look = { seed: [rnd(0, 80), rnd(0, 80)], hue: Math.random(), t0: rnd(0, 400) };

  /* the content is the subject: the fog reads the layout and gives way to it */
  var TEXT_SEL = ".intro, .record h2, .record .sub";
  var ELEM_SEL = ".hero-top h1, .file a, .record form, .bar, .stage, .wrap > .tag, .wrap .wrap";
  var rectArr = new Float32Array(80), softArr = new Float32Array(4), rectN = 0, range = document.createRange();
  function collect() {
    var n = 0, i, els, r;
    function add(r) {
      if (n >= 20 || r.width < 4 || r.height < 4 || r.bottom < -90 || r.top > innerHeight + 90) return;
      rectArr[n * 4] = r.left - 14; rectArr[n * 4 + 1] = r.top - 14; rectArr[n * 4 + 2] = r.right + 14; rectArr[n * 4 + 3] = r.bottom + 14; n++;
    }
    els = document.querySelectorAll(ELEM_SEL); for (i = 0; i < els.length; i++) add(els[i].getBoundingClientRect());
    els = document.querySelectorAll(TEXT_SEL);
    for (i = 0; i < els.length; i++) { range.selectNodeContents(els[i]); add(range.getBoundingClientRect()); }   // tight to the words, not the column
    rectN = n;
    var lede = document.querySelector(".lede"); softArr.fill(0);
    if (lede) { range.selectNodeContents(lede); var z = range.getBoundingClientRect(); if (z.width > 4) { softArr[0] = z.left - 30; softArr[1] = z.top - 30; softArr[2] = z.right + 30; softArr[3] = z.bottom + 30; } }
  }

  var U = {}, tear = 0, lastW = 0, lastH = 0;
  if (gl) {
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ["uRes", "uSeed", "uView", "uRects", "uSoft", "uRectN", "uT", "uScroll", "uTear", "uHue", "uDim"]
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  } else if (cv) {
    document.documentElement.classList.add("nogl");
  }

  function sizeField(force) {
    if (!gl) return;
    var ps = innerWidth < 700 ? 3 : 4, w = Math.ceil(innerWidth / ps), h = Math.ceil(innerHeight / ps);
    if (!force && w === lastW && Math.abs(h - lastH) * ps < 140) return; // phone toolbars resize constantly
    lastW = w; lastH = h; cv.width = w; cv.height = h; gl.viewport(0, 0, w, h);
  }
  var T0 = performance.now(), frozenT = 61;
  function draw(now) {
    if (!gl) return;
    var t = (reduce ? frozenT : (now - T0) / 1000) + look.t0;
    gl.uniform2f(U.uRes, cv.width, cv.height);
    collect();
    gl.uniform2f(U.uView, innerWidth, innerHeight); gl.uniform4fv(U.uRects, rectArr); gl.uniform4fv(U.uSoft, softArr); gl.uniform1f(U.uRectN, rectN);
    gl.uniform2f(U.uSeed, look.seed[0], look.seed[1]);
    gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uScroll, Math.min(3, (window.scrollY || 0) / innerHeight));
    gl.uniform1f(U.uTear, reduce ? 0 : tear);
    gl.uniform1f(U.uHue, look.hue); gl.uniform1f(U.uDim, calm ? .6 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  var rt = null;
  addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { sizeField(false); draw(performance.now()); }, 140); });
  sizeField(true);

  async function tears() {
    for (;;) {
      await sleep(7000 + Math.random() * 12000);
      tear = 1; await sleep(90 + Math.random() * 120); tear = 0;
    }
  }
  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden || now - last < 1000 / 24) return;
    last = now; draw(now);
  }
  if (gl) {
    if (reduce) { draw(0); addEventListener("scroll", function () { draw(0); }, { passive: true }); }
    else { requestAnimationFrame(frame); tears(); }
  }
})();
