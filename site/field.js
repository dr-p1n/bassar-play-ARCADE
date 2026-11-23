/* BASSAR field — the fog behind every page.
   Generated, not drawn: each visit rolls its own noise seed and tint, and the
   "apparitions" (a slit of light, an aperture, a monolith) are parameterised
   and re-rolled every time they appear. Rendered small and scaled up so the
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
      "uniform vec2 uRes,uMouse,uSeed,uPos,uView;",
      "uniform vec4 uRects[20]; uniform float uRectN;",
      "uniform float uT,uScroll,uEvent,uTear,uForm,uScl,uRot,uAux,uHue,uDim;",
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
      /* the pointer is a weak light */
      " float Lm=0.; float dm=length((uv-uMouse)*vec2(asp,1.)); Lm+=.16*exp(-dm*dm*48.)*(1.-away*.6);",
      /* the apparition: one of three generated forms, re-rolled each time */
      " float sc=uScl*(.8+.2*smoothstep(0.,1.,uEvent));",
      " vec2 ap=(uv-uPos)*vec2(asp,1.); float app=0.;",
      " if(uForm<.5){",
      "  float w=.0035+.004*noise(vec2(uv.y*22.,uT*.3));",
      "  float xx=abs(ap.x+.012*(f-.5)); float yy=abs(ap.y);",
      "  float slit=(1.-smoothstep(w,w*2.4,xx))*(1.-smoothstep(.2*sc,.3*sc,yy));",
      "  float halo=exp(-pow(xx*7.,2.))*(1.-smoothstep(.2*sc,.38*sc,yy));",
      "  app=slit*1.3+halo*.3;",
      " } else if(uForm<1.5){",
      "  float R=.2*sc; float rr_=length(ap); float a=atan(ap.y,ap.x)+uRot;",
      "  float rings=0.;",
      "  for(int i=1;i<5;i++){float rad=R*float(i)/4.; rings+=1.-smoothstep(.0014,.0042,abs(rr_-rad+.004*(f-.5)));}",
      "  float sd=abs(fract(a*uAux/6.2831853+.5)-.5)*6.2831853/uAux*rr_;",
      "  float spokes=(1.-smoothstep(.0012,.0034,sd))*step(R*.3,rr_)*step(rr_,R);",
      "  float pupil=1.-smoothstep(R*.07,R*.12,rr_);",
      "  float halo=exp(-rr_*rr_*60./(sc*sc))*.2;",
      "  app=(rings*.8+spokes*.6+pupil*1.4)*(1.-smoothstep(R*1.02,R*1.15,rr_))+halo;",
      " } else {",
      "  float cs=cos(uRot*.08),sn=sin(uRot*.08); vec2 qq=mat2(cs,-sn,sn,cs)*ap;",
      "  vec2 hs=vec2(.05,.16)*sc; float rad=.03*sc;",
      "  vec2 d=abs(qq)-hs+rad; float sdf=length(max(d,0.))+min(max(d.x,d.y),0.)-rad;",
      "  float edge=1.-smoothstep(.0012,.0034,abs(sdf));",
      "  float inside=(1.-smoothstep(-.002,.0,sdf))*(.1+.12*noise(qq*40.+uT));",
      "  float pt=1.-smoothstep(.004,.009,length(qq-vec2(0.,hs.y*1.35)));",
      "  app=edge*1.1+inside+pt*1.2;",
      " }",
      " Lm+=uEvent*app;",
      " vec2 cp=vec2(fc.x/uRes.x*uView.x,(1.-fc.y/uRes.y)*uView.y); float mask=0.;",
      " for(int i=0;i<20;i++){ if(float(i)>=uRectN) break; vec4 rc=uRects[i]; vec2 cc=(rc.xy+rc.zw)*.5, hh_=(rc.zw-rc.xy)*.5;",
      "  mask=max(mask,1.-smoothstep(0.,64.,length(max(abs(cp-cc)-hh_,0.)))); }",
      " L*=mix(1.,.07,mask); Lm*=1.-mask;",
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
  var ap = { form: 0, pos: [.72, .5], scl: 1, rot: 0, aux: 8 };
  function reroll() {
    ap.form = Math.random() * 3 | 0;
    ap.scl = rnd(.75, 1.3);
    // roll a spot in the open: never under text, posters or the game frame
    collect();
    for (var tries = 0; tries < 24; tries++) {
      var px = rnd(.1, .92), py = rnd(.38, .8), X = px * innerWidth, Y = (1 - py) * innerHeight, clear = true;
      for (var k = 0; k < rectN; k++) {
        if (X > rectArr[k * 4] - 90 && X < rectArr[k * 4 + 2] + 90 && Y > rectArr[k * 4 + 1] - 90 && Y < rectArr[k * 4 + 3] + 90) { clear = false; break; }
      }
      ap.pos = [px, py]; if (clear) break;
    }
    ap.rot = rnd(0, 6.2832);
    ap.aux = 6 + (Math.random() * 7 | 0);
  }
  var q = location.search.match(/[?&]form=(\d)/);

  /* the content is the subject: the fog reads the layout and gives way to it */
  var TEXT_SEL = ".lede, .intro, .hero-note, .record h2, .record .sub";
  var ELEM_SEL = ".hero-top h1, .stamp, .file a, .record form, .bar, .stage, .wrap > .tag, .wrap .wrap";
  var rectArr = new Float32Array(80), rectN = 0, range = document.createRange();
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
  }

  var U = {}, mouse = { x: -2, y: -2, tx: -2, ty: -2 }, ev = 0, tear = 0, lastW = 0, lastH = 0;
  if (gl) {
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ["uRes", "uMouse", "uSeed", "uPos", "uView", "uRects", "uRectN", "uT", "uScroll", "uEvent", "uTear", "uForm", "uScl", "uRot", "uAux", "uHue", "uDim"]
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
    if (mouse.x < -1 && mouse.tx > -1) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
    mouse.x += (mouse.tx - mouse.x) * .05; mouse.y += (mouse.ty - mouse.y) * .05;
    gl.uniform2f(U.uRes, cv.width, cv.height);
    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    collect();
    gl.uniform2f(U.uView, innerWidth, innerHeight); gl.uniform4fv(U.uRects, rectArr); gl.uniform1f(U.uRectN, rectN);
    gl.uniform2f(U.uSeed, look.seed[0], look.seed[1]);
    gl.uniform2f(U.uPos, ap.pos[0], ap.pos[1]);
    gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uScroll, Math.min(3, (window.scrollY || 0) / innerHeight));
    gl.uniform1f(U.uEvent, reduce ? 0 : ev);
    gl.uniform1f(U.uTear, reduce ? 0 : tear);
    gl.uniform1f(U.uForm, ap.form); gl.uniform1f(U.uScl, ap.scl); gl.uniform1f(U.uRot, ap.rot);
    gl.uniform1f(U.uAux, ap.aux); gl.uniform1f(U.uHue, look.hue); gl.uniform1f(U.uDim, calm ? .6 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  addEventListener("pointermove", function (e) { mouse.tx = e.clientX / innerWidth; mouse.ty = 1 - e.clientY / innerHeight; }, { passive: true });
  var rt = null;
  addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { sizeField(false); draw(performance.now()); }, 140); });
  sizeField(true);

  /* an apparition: stutters in, holds, fades. Each one is a new roll. */
  async function appear() {
    reroll();
    var seq = [1, 0, 1, 0, 1];
    for (var i = 0; i < seq.length; i++) { ev = seq[i]; await sleep(55 + Math.random() * 60); }
    ev = 1; await sleep(1700 + Math.random() * 1700);
    for (var k = 10; k >= 0; k--) { ev = k / 10; await sleep(70); }
    ev = 0;
  }
  async function events() {
    await sleep(calm ? 9000 : 5200 + Math.random() * 3000);
    for (;;) {
      if (!document.hidden && (calm || (window.scrollY || 0) < innerHeight * .6)) await appear();
      await sleep((calm ? 22000 : 11000) + Math.random() * (calm ? 22000 : 14000));
    }
  }
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
    if (q) { ap.form = +q[1]; ev = 1; }                       // ?form=0|1|2 pins an apparition (for checking)
    else if (/[?&]event=1/.test(location.search)) { reroll(); ev = 1; }
    if (reduce) { draw(0); addEventListener("scroll", function () { draw(0); }, { passive: true }); }
    else { requestAnimationFrame(frame); events(); tears(); }
  }
})();
