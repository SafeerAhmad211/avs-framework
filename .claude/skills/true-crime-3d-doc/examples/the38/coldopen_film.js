// THE 38 — 3D cold open. Deterministic: every frame is a pure function of time t (seconds).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FXAAPass } from "three/addons/postprocessing/FXAAPass.js";
import { buildWorld, rng } from "./world.js";
import { makeCar, CARS } from "./cars.js";
import { loadPeople, makePerson } from "./people.js";

const W = 1920, H = 1080;
const canvas = document.getElementById("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = new URLSearchParams(location.search).get("pcf") === "1" ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.9;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1520);
scene.fog = new THREE.FogExp2(0x131b27, 0.019);
const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 500);

// ---------- environment for reflections (dark night city) ----------
{
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x05070b);
  const em = (c, x, y, z, s) => { const m = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 8), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); env.add(m); };
  for (let i = 0; i < 10; i++) em(0xffaa55, Math.cos(i) * 20, 6 + (i % 3), Math.sin(i * 1.7) * 20, 1.2);
  em(0x1b2a44, 0, 40, 0, 18);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.04).texture;
  scene.environmentIntensity = 0.6;
}

// ---------- base lighting ----------
const hemi = new THREE.HemisphereLight(0x4a6290, 0x1a130d, 1.4);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9fb4e0, 0.7);
moon.position.set(-30, 60, -20);
scene.add(moon);

const world = buildWorld(scene);

// ---------- volumetric cone shader ----------
function coneMat(color, strength) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(color) }, strength: { value: strength } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ vY = uv.y; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 color; uniform float strength; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); float a = pow(vY, 1.7) * edge * strength; gl_FragColor = vec4(color*a, a); }`,
  });
}

// ---------- assets ----------
const loader = new GLTFLoader();
const load = (u) => new Promise((res, rej) => loader.load(u, res, undefined, rej));
const ready = (async () => {
  const [lampG, hydG, people] = await Promise.all([
    load("assets/models/street_lamp_01/street_lamp_01_1k.gltf"),
    load("assets/models/fire_hydrant/fire_hydrant_1k.gltf"),
    loadPeople(),
  ]);
  setup(lampG, hydG, people);
})();
window.__hf = window.__hf || {};
window.__hf.buildReady = window.__hf.buildReady || {};
window.__hf.buildReady["the38-world"] = ready;

const S = {}; window.__S = S; // scene state handles

function setup(lampG, hydG, people) {
  // ---- street lamps ----
  const keyShadow = { "19,7.2": 1, "38.5,14.5": 1, "9,-7.2": 1 };
  S.lamps = [];
  for (const [x, z] of world.lampSpots) {
    const m = lampG.scene.clone(true);
    m.scale.setScalar(1.15);
    m.position.set(x, 0.15, z);
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(m);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 1.3) }));
    head.position.set(x, 0.15 + 3.75, z);
    scene.add(head);
    const pl = new THREE.PointLight(0xffb25e, 45, 24, 1.5);
    pl.position.set(x, 3.6, z);
    scene.add(pl);
    let sp = null;
    if (keyShadow[`${x},${z}`]) {
      sp = new THREE.SpotLight(0xffb868, 220, 28, 1.0, 0.6, 1.4);
      sp.position.set(x, 3.75, z);
      sp.target.position.set(x, 0, z);
      sp.castShadow = true;
      sp.shadow.mapSize.set(1024, 1024);
      sp.shadow.bias = -0.0004;
      sp.shadow.radius = 4;
      scene.add(sp, sp.target);
    }
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 2.6, 3.7, 32, 1, true), coneMat(0xffa74d, 0.085));
    cone.position.set(x, 0.15 + 3.7 / 2, z);
    scene.add(cone);
    S.lamps.push({ x, z, pl, sp, cone });
  }
  // hydrant
  const hyd = hydG.scene.clone(true);
  hyd.position.set(14.5, 0.15, 6.7); hyd.scale.setScalar(1.0);
  hyd.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(hyd);

  // ---- cars ----
  S.fiat = makeCar(CARS.fiat600);
  S.corv = makeCar(CARS.corvair);
  scene.add(S.fiat.group, S.corv.group);
  const R = rng(77);
  const parked = [[-34, 3.6, 0], [-21, 3.6, 0], [-8, 3.7, 0], [6, 3.6, 0], [-28, -3.6, 1], [-12, -3.7, 1], [2, -3.6, 1], [16, -3.6, 1], [27, -3.7, 1], [58, 31, 2], [47, 31, 2], [55, 18, 2]];
  const cols = [0x22303f, 0x3b2b22, 0x1d2a22, 0x4a4a46, 0x2b2b30, 0x5a4a34, 0x1a1c22];
  for (const [x, z, side] of parked) {
    const big = R() > 0.4;
    const col = cols[Math.floor(R() * cols.length)];
    const c = big ? makeCar({ ...CARS.sedan, color: col, roofColor: R() > 0.5 ? 0xd8d2c2 : null, plate: `${Math.floor(R() * 9) + 1}${"ABCDEFGHJK"[Math.floor(R() * 10)]} ${1000 + Math.floor(R() * 8999)}` })
      : makeCar({ ...CARS.coupe, color: col, plate: `${Math.floor(R() * 9) + 1}${"LMNPRSTUVW"[Math.floor(R() * 10)]} ${1000 + Math.floor(R() * 8999)}` });
    c.group.position.set(x, 0, z);
    c.group.rotation.y = side === 0 ? -Math.PI / 2 : side === 1 ? Math.PI / 2 : 0;
    scene.add(c.group);
  }
  S.fiatPath = new THREE.CatmullRomCurve3([[64, -2.6], [50, -2.6], [41, -1.6], [38.4, 3.5], [38.6, 10], [40.0, 16.5], [40.5, 21.4]].map((p) => new THREE.Vector3(p[0], 0, p[1])), false, "centripetal");
  S.corvPath = new THREE.CatmullRomCurve3([[110, -2.7], [80, -2.7], [62, -2.2], [54, 2.6], [48, 3.6]].map((p) => new THREE.Vector3(p[0], 0, p[1])), false, "centripetal");
  S.fiatDome = new THREE.PointLight(0xffd9a0, 0, 3.2, 1.5); scene.add(S.fiatDome);
  S.corvDome = new THREE.PointLight(0xffd9a0, 0, 3.4, 1.5); scene.add(S.corvDome);
  S.headCones = [];
  for (const car of [S.fiat, S.corv]) {
    for (const b of car.beams) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 2.2, 12, 24, 1, true), coneMat(0xfff0d8, 0.035));
      c.geometry.rotateX(-Math.PI / 2); c.geometry.translate(0, 0, 6);
      c.geometry.rotateY(0); // pointing +z
      // uv.y must be 1 at the lamp: flip by rotating the cylinder so its top (uv 1) is at z=0
      c.position.copy(b.position); c.position.y -= 0.05;
      c.visible = false; S.headCones.push({ car, c });
    }
  }

  // ---- characters (Rocketbox humans, MIT licence) ----
  S.kSeat = makePerson(scene, people, "Business_Female_03", "f", 1.65, 0xd9cfc4);
  S.kWalk = makePerson(scene, people, "Business_Female_03", "f", 1.65, 0xd9cfc4);
  S.mSeat = makePerson(scene, people, "Male_Adult_12", "m", 1.78, 0x7a6a60);
  S.mWalk = makePerson(scene, people, "Male_Adult_12", "m", 1.78, 0x7a6a60);

  // ---- silhouettes for witness windows ----
  const silTex = [0, 1, 2].map((v) => {
    const c = document.createElement("canvas"); c.width = 128; c.height = 180;
    const g = c.getContext("2d"); g.fillStyle = "#000";
    if (v < 2) { const ox = v === 0 ? 64 : 48; g.beginPath(); g.ellipse(ox, 70, 19, 24, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(ox - 52, 180); g.quadraticCurveTo(ox - 48, 104, ox, 98); g.quadraticCurveTo(ox + 48, 104, ox + 52, 180); g.fill(); }
    if (v >= 1) { g.globalAlpha = 0.85; g.fillRect(0, 0, 26, 180); g.fillRect(102, 0, 26, 180); }
    const t = new THREE.CanvasTexture(c); return t;
  });
  S.sil = [];
  const pickR = rng(38);
  const mow = world.glassSlots.map((g, i) => ({ g, i })).filter((o) => o.g.kind === "mowbray");
  const order = mow.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(pickR() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  S.witness = order.slice(0, 38).map((o, k) => ({ i: o.i, t: 64.6 + 7.4 * Math.pow(k / 37, 0.85) + pickR() * 0.15 }));
  S.witness.forEach((w, k) => {
    if (k % 3 === 0 || k < 3) {
      const g = world.glassSlots[w.i];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(g.w * 0.92, g.h * 0.92), new THREE.MeshBasicMaterial({ map: silTex[k % 3], transparent: true, opacity: 0, depthWrite: false, color: 0x000000 }));
      m.position.set(g.x, g.y - 0.02, g.z + 0.015);
      scene.add(m);
      S.sil.push({ m, t: w.t + 1.2 + (k % 4) * 0.4 });
    }
  });
  // early Tudor windows above the bookstore wake at the scream
  S.tudorWake = world.glassSlots.map((g, i) => ({ g, i })).filter((o) => o.g.kind === "tudor" && o.g.x > 5 && o.g.x < 30).slice(0, 6).map((o, k) => ({ i: o.i, t: 59.7 + k * 0.5 }));

  // ---- mist sheets + dust ----
  const mistTex = (() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128; const g = c.getContext("2d");
    const r = rng(5);
    for (let i = 0; i < 70; i++) { const x = r() * 256, y = 30 + r() * 70, s = 20 + r() * 50; const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, "rgba(255,255,255,0.10)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); }
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
  })();
  S.mist = [];
  const mr = rng(9);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 9), new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, opacity: 0.16, depthWrite: false, color: 0x8a96a8, fog: true }));
    m.position.set(-30 + mr() * 90, 2.5 + mr() * 2, -12 + mr() * 46);
    m.rotation.y = (mr() - 0.5) * 0.6;
    scene.add(m); S.mist.push({ m, x0: m.position.x, v: 0.25 + mr() * 0.35 });
  }
  const dN = 600, dPos = new Float32Array(dN * 3), dr = rng(11);
  for (let i = 0; i < dN; i++) { dPos[i * 3] = 10 + dr() * 50; dPos[i * 3 + 1] = dr() * 6; dPos[i * 3 + 2] = -10 + dr() * 40; }
  const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
  S.dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ color: 0xffd7a0, size: 0.035, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  S.dust0 = dPos.slice();
  scene.add(S.dust);

  // real reflections: capture the actual street once into a cube map and use it as the environment
  const hide = [S.kSeat, S.kWalk, S.mSeat, S.mWalk].map((c) => c.holder).concat([S.fiat.group, S.corv.group, S.dust]);
  hide.forEach((o) => (o.visible = false));
  const crt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cc = new THREE.CubeCamera(0.3, 300, crt);
  cc.position.set(30, 1.3, 4);
  scene.add(cc);
  cc.update(renderer, scene);
  scene.environment = new THREE.PMREMGenerator(renderer).fromCubemap(crt.texture).texture;
  scene.environmentIntensity = 1.0;
  hide.forEach((o) => (o.visible = true));
}

// ---------- post ----------
const Q = new URLSearchParams(location.search);
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: +(Q.get("ms") ?? 0) });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 v = c.rgb;
      if (!(v.r == v.r) || !(v.g == v.g) || !(v.b == v.b)) v = vec3(0.0);
      float m = max(v.r, max(v.g, v.b)); if (m > 6.0) v *= 6.0 / m;
      gl_FragColor = vec4(v, c.a); }`,
}));
const bokeh = new BokehPass(scene, camera, { focus: 10, aperture: 0.0, maxblur: 0.009 });
composer.addPass(bokeh);
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.5, 0.86);
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.addPass(new FXAAPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: 0.55 }, grain: { value: 0.05 }, ca: { value: 0.004 }, fade: { value: 0 }, bw: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, vig, grain, ca, fade, bw; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
    void main(){
      float fr = floor(time * 24.0);
      vec2 uv = vUv + bw * vec2(sin(time * 13.0) * 0.0007 + (hash(vec2(fr, 1.0)) - 0.5) * 0.0012, sin(time * 7.0) * 0.0011 + (hash(vec2(fr, 2.0)) - 0.5) * 0.0016);
      vec2 d = uv - 0.5; float r = dot(d,d);
      vec3 col = vec3(texture2D(tDiffuse, uv - d*ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv + d*ca).b);
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(col, col*vec3(0.86,1.0,1.1), 1.0 - smoothstep(0.0, 0.45, l));
      col = mix(col, col*vec3(1.08,1.0,0.88), smoothstep(0.35, 1.0, l));
      col = (col - 0.5)*1.07 + 0.5 - 0.01;
      col *= 1.0 - vig*smoothstep(0.08, 0.7, r*1.7);
      col += (hash(uv*vec2(1920.0,1080.0) + fract(time*7.13)*vec2(311.0,173.0)) - 0.5)*grain;
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 mono = vec3(clamp((lum - 0.5) * 1.3 + 0.52, 0.0, 1.0));
      mono *= 1.0 + (hash(vec2(fr, 3.1)) - 0.5) * 0.14;
      float sx = hash(vec2(fr, 7.7)); float scr = smoothstep(0.0016, 0.0, abs(uv.x - sx)) * step(0.55, hash(vec2(fr, 1.3)));
      float sx2 = hash(vec2(floor(time * 3.0), 8.3)); scr += smoothstep(0.0009, 0.0, abs(uv.x - sx2)) * 0.6;
      mono = mix(mono, vec3(0.82), clamp(scr, 0.0, 1.0) * 0.45);
      vec2 dp = vec2(hash(vec2(fr, 5.0)), hash(vec2(fr, 9.0)));
      float dust = smoothstep(0.0045, 0.0, length((uv - dp) * vec2(1.78, 1.0))) * step(0.45, hash(vec2(fr, 2.0)));
      vec2 dp2 = vec2(hash(vec2(fr, 15.0)), hash(vec2(fr, 19.0)));
      dust += smoothstep(0.012, 0.0, abs(length((uv - dp2) * vec2(1.78, 1.0)) - 0.02)) * step(0.7, hash(vec2(fr, 4.0)));
      mono = mix(mono, vec3(0.04), clamp(dust, 0.0, 1.0));
      mono += (hash(uv * vec2(1920.0, 1080.0) * 0.5 + fract(time * 5.3) * vec2(97.0, 57.0)) - 0.5) * 0.09;
      mono *= 1.0 - 0.35 * smoothstep(0.15, 0.85, r * 1.7);
      col = mix(col, mono * vec3(1.0, 0.985, 0.95), bw);
      col *= 1.0 - fade;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
});
composer.addPass(grade);

// ---------- helpers ----------
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerpV = (a, b, k) => a.clone().lerp(b, k);
function shake(t, amp) {
  return V(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 3.9 + 1) * 0.3 + Math.sin(t * 7.3) * 0.1, Math.sin(t * 2.3 + 2) * 0.5 + Math.sin(t * 5.1) * 0.2, Math.sin(t * 1.3 + 4) * 0.4).multiplyScalar(amp);
}
function dist(t, v, ramp) { if (t <= 0) return 0; return t < ramp ? (v * t * t) / (2 * ramp) : v * (t - ramp / 2); }
function makePath(pts) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p.clone().setY(0) : V(p[0], 0, p[1]))), false, "centripetal");
  const len = c.getLength();
  return { len, at(d) { const u = clamp(d / len, 0, 1); const p = c.getPointAt(u); const tg = c.getTangentAt(u); return { p, yaw: Math.atan2(tg.x, tg.z) }; } };
}
function carAt(car, curve, u, yawOverride) {
  u = clamp(u, 0, 1);
  const p = curve.getPointAt(u), tg = curve.getTangentAt(u);
  car.group.position.copy(p);
  car.group.rotation.y = yawOverride ?? Math.atan2(tg.x, tg.z);
  const d = u * curve.getLength();
  for (const w of car.wheels) w.rotation.x = d / 0.31;
}
function pose(c, w) {
  for (const k in c.actions) {
    const a = c.actions[k], v = w[k];
    if (v && v[0] > 0) { a.setEffectiveWeight(v[0]); a.time = ((v[1] % a.getClip().duration) + a.getClip().duration) % a.getClip().duration; }
    else a.setEffectiveWeight(0);
  }
  c.mixer.update(0);
}
function seated(c) {
  const b = c.bones;
  for (const s of ["Left", "Right"]) {
    b[s + "UpLeg"].rotation.x -= 1.45;
    b[s + "Leg"].rotation.x += 1.5;
    b[s + "Arm"].rotation.x += 0.9;
    b[s + "ForeArm"].rotation.x -= 0.2;
  }
}

// ---------- timing (seconds) ----------
const SEAT = { fiat: new THREE.Vector3(0.3, -0.05, -0.25), corv: new THREE.Vector3(0.38, -0.05, -0.15) };
const T = {
  fiat0: 10.0, fiat1: 17.0, kitOut: 47.0, kitWalk: 47.4, glance0: 54.2, kitRun: 55.15,
  corv0: 31.4, corv1: 37.0, corvLights: 37.8, mosOut: 49.4, mosWalk: 49.8, mosRun: 55.45,
  black0: 59.35, black1: 64.2, end: 86,
};

let paths = null;
function buildChasePaths() {
  // Kitty: from beside the Fiat to her door on the walkway behind the block, then she runs to Austin Street.
  const fiatEnd = S.fiatPath.getPointAt(1);
  const fiatYaw = Math.atan2(S.fiatPath.getTangentAt(1).x, S.fiatPath.getTangentAt(1).z);
  const side = V(Math.cos(fiatYaw), 0, -Math.sin(fiatYaw)); // car's +x (driver side) in world
  const kStart = fiatEnd.clone().addScaledVector(side, 1.05).add(V(0, 0, 0.15));
  const kWalk = makePath([kStart, [38.5, 23.3], [33, 23.7], [27, 23.6], [24.6, 23.0]]);
  const kWalkEnd = kWalk.at(dist(T.kitRun - T.kitWalk, 1.3, 0.6)).p;
  const kRun = makePath([kWalkEnd, [31.6, 19.5], [31.3, 13.5], [30.2, 9.3], [26.5, 8.4], [12, 8.3]]);
  // Moseley: out of the Corvair, across the lot toward her, then the chase.
  carAt(S.corv, S.corvPath, 1);
  S.corv.group.updateMatrixWorld(true);
  const mStart = S.corv.group.localToWorld(V(1.25, 0, -0.35)).setY(0);
  const mWalk = makePath([mStart, [45.5, 9.5], [42.5, 14.5], [39.5, 19]]);
  const mWalkEnd = mWalk.at(dist(T.mosRun - T.mosWalk, 1.2, 0.6)).p;
  const mRun = makePath([mWalkEnd, [35, 13.2], [31.6, 9.6], [27.5, 8.6], [12, 8.5]]);
  paths = { kStart, fiatYaw, kWalk, kRun, mStart, mWalk, mRun };
}

// ---------- shots ----------
function shot(t) {
  // returns { pos, look, fov, focus (m), ap }
  const P = paths;
  if (t < 10) { // A: low drone glide down Austin Street toward the lot
    const k = ease(t / 10);
    return { pos: lerpV(V(-22, 13, -1.5), V(22, 6.5, -2.5), k).add(shake(t, 0.12)), look: lerpV(V(10, 2, 8), V(40, 1.5, 14), k), fov: 42, focus: 30, ap: 0 };
  }
  if (t < 17.2) { // B: Fiat turns into the lot, low by the driveway
    const k = (t - 10) / 7.2;
    const car = S.fiat.group.position;
    const pos = lerpV(V(35.0, 0.5, 6.4), V(35.6, 0.65, 8.2), ease(k)).add(shake(t, 0.03));
    const look = car.clone().add(V(0, 0.75, 0));
    return { pos, look, fov: 32, focus: pos.distanceTo(look), ap: 0.0014 };
  }
  if (t < 24.2) { // C1: dolly toward driver window, dome light, Kitty inside
    const k = ease((t - 17.2) / 7);
    const head = S.kSeat.bones.Head.getWorldPosition(V(0, 0, 0));
    const pos = lerpV(V(45.8, 1.6, 18.2), V(43.0, 1.45, 20.4), k).add(shake(t, 0.02));
    return { pos, look: head, fov: 30, focus: pos.distanceTo(head), ap: 0.003 };
  }
  if (t < 31.5) { // C2: through the windshield
    const k = ease((t - 24.2) / 7.3);
    const head = S.kSeat.bones.Head.getWorldPosition(V(0, 0, 0));
    const pos = lerpV(V(41.6, 1.25, 26.8), V(41.0, 1.3, 25.0), k).add(shake(t, 0.02));
    return { pos, look: head, fov: 28, focus: pos.distanceTo(head), ap: 0.0035 };
  }
  if (t < 35.6) { // D1: over the Fiat roof, rack focus to the white car arriving
    const k = sm(32.6, 35.2, t);
    const pos = V(39.0, 1.95, 24.4).add(shake(t, 0.02));
    const corv = S.corv.group.position.clone().add(V(0, 0.8, 0));
    const look = lerpV(V(46, 1, 8), corv, 0.6);
    const near = 2.2, far = pos.distanceTo(corv);
    return { pos, look, fov: 30, focus: near + (far - near) * k, ap: 0.003 };
  }
  if (t < 39.3) { // D2: the Corvair at the curb, headlights die, the head turns
    const k = ease((t - 35.6) / 3.7);
    const head = S.mSeat.bones.Head.getWorldPosition(V(0, 0, 0));
    const pos = lerpV(V(43.2, 1.0, 1.4), V(44.6, 1.15, 2.4), k).add(shake(t, 0.015));
    return { pos, look: head.clone().add(V(0.3, -0.1, 0)), fov: 30, focus: pos.distanceTo(head), ap: 0.0025 };
  }
  if (t < 47.0) { // E: behind the Corvair, his silhouette in the glass, the Fiat glowing beyond. Rack focus.
    const k = ease((t - 39.3) / 7.7);
    const fiatP = V(40.6, 1.0, 21.4);
    const head = S.mSeat.bones.Head.getWorldPosition(V(0, 0, 0));
    const pos = lerpV(S.corv.group.localToWorld(V(-2.2, 1.35, -4.6)), S.corv.group.localToWorld(V(-1.5, 1.3, -3.4)), k).add(shake(t, 0.008));
    const look = lerpV(head, fiatP, 0.35);
    const fNear = pos.distanceTo(head), fFar = pos.distanceTo(fiatP);
    return { pos, look, fov: lerp(30, 24, k), focus: lerp(fNear, fFar, sm(42.5, 44.5, t)), ap: 0.003 };
  }
  if (t < 49.2) { // F1: Kitty beside the Fiat, door closing, she sets off
    const kp = S.kWalk.holder.position.clone().add(V(0, 1.2, 0));
    const pos = lerpV(V(46.2, 1.6, 26.2), V(45.4, 1.55, 25.6), ease((t - 47) / 2.2)).add(shake(t, 0.02));
    return { pos, look: kp, fov: 32, focus: pos.distanceTo(kp), ap: 0.002 };
  }
  if (t < 52.2) { // F2: the Corvair door opens
    const k = ease((t - 49.2) / 3);
    const d = S.corv.group.localToWorld(V(0.9, 0.9, -0.4));
    const pos = lerpV(V(49.6, 0.45, 8.6), V(49.3, 0.55, 7.9), k).add(shake(t, 0.02));
    const look = lerpV(d, S.mWalk.holder.position.clone().add(V(0, 1.2, 0)), sm(50.3, 51.8, t));
    return { pos, look, fov: 30, focus: pos.distanceTo(look), ap: 0.0025 };
  }
  if (t < 58.0) { // G: leading Kitty; he is the blur behind her. She looks back. She runs.
    const kp = S.kWalk.holder.position.clone();
    const yaw = S.kWalk.holder.rotation.y;
    const fwd = V(Math.sin(yaw), 0, Math.cos(yaw));
    const running = t > T.kitRun;
    const lead = running ? 4.2 : 3.0;
    const pos = kp.clone().addScaledVector(fwd, lead).add(V(0, running ? 1.35 : 1.5, 0)).add(shake(t, running ? 0.09 : 0.03));
    const her = kp.clone().add(V(0, 1.35, 0));
    const look = lerpV(her, S.mWalk.holder.position.clone().add(V(0, 1.2, 0)), 0.18);
    return { pos, look, fov: 38, focus: pos.distanceTo(her), ap: running ? 0.0025 : 0.0035 };
  }
  if (t < T.black0) { // H: high, across the street — two figures, one lamp
    const k = (t - 58) / (T.black0 - 58);
    const look = S.kWalk.holder.position.clone().add(V(0, 0.8, 0));
    const pos = lerpV(V(21.5, 8.5, -5.5), V(21.0, 8.0, -4.8), k).add(shake(t, 0.05));
    return { pos, look, fov: 34, focus: pos.distanceTo(look), ap: 0.001 };
  }
  if (t < 77.2) { // J: the Mowbray wakes. From the empty sidewalk, looking up.
    const k = ease((t - T.black1) / (77.2 - T.black1));
    const pos = lerpV(V(18.5, 1.1, 8.6), V(15.0, 1.6, 6.4), k).add(shake(t, 0.015));
    const look = lerpV(V(4, 6, -10), V(1, 10.5, -10), k);
    return { pos, look, fov: 40, focus: 20, ap: 0.0006 };
  }
  { // K: rise above the street, the block shrinking into the fog
    const k = ease((t - 77.2) / 8.8);
    const pos = lerpV(V(16, 2.5, 3), V(4, 30, -3), k);
    const look = lerpV(V(6, 6, -8), V(24, 0, 10), k);
    return { pos, look, fov: 40, focus: 30, ap: 0 };
  }
}
const lerp = (a, b, k) => a + (b - a) * k;

// ---------- per-frame scene update ----------
const tmpC = new THREE.Color();
function update(t) {
  if (!paths) buildChasePaths();
  // Fiat
  const fu = 1 - Math.pow(1 - clamp((t - T.fiat0) / (T.fiat1 - T.fiat0), 0, 1), 2.2);
  carAt(S.fiat, S.fiatPath, fu);
  const fLights = t < 16.8 ? 1 : 0;
  S.fiat.headM.emissiveIntensity = fLights * 1.0;
  S.fiat.tailM.emissiveIntensity = t < 17.3 ? (t > 15.6 ? 5 : 2) : 0;
  S.fiat.beams.forEach((b) => (b.intensity = fLights * 120));
  // Corvair
  const cu = 1 - Math.pow(1 - clamp((t - T.corv0) / (T.corv1 - T.corv0), 0, 1), 2.2);
  carAt(S.corv, S.corvPath, cu);
  const cLights = t >= T.corv0 - 0.5 && t < T.corvLights ? 1 : 0;
  S.corv.headM.emissiveIntensity = cLights * 1.0;
  S.corv.tailM.emissiveIntensity = t > T.corv0 && t < T.corvLights + 0.2 ? (t > 36 ? 5 : 2) : 0;
  S.corv.beams.forEach((b) => (b.intensity = cLights * 120));
  
  S.corv.group.visible = t >= T.corv0 - 0.5;
  // doors
  const fd = sm(46.6, 47.0, t) * (1 - sm(47.7, 48.3, t));
  S.fiat.doorPivot.rotation.y = fd * 1.05;
  S.fiat.doorPivot.userData.panels.forEach((m) => (m.visible = fd > 0.01));
  const cdo = sm(49.0, 49.7, t);
  S.corv.doorPivot.rotation.y = cdo * 1.1;
  S.corv.doorPivot.userData.panels.forEach((m) => (m.visible = cdo > 0.01));
  // dome lights
  S.fiat.group.updateMatrixWorld(true); S.corv.group.updateMatrixWorld(true);
  S.fiatDome.position.copy(S.fiat.group.localToWorld(V(0.2, 1.25, -0.1)));
  S.fiatDome.intensity = t > 16.9 && t < 48.2 ? 0.18 : 0;
  S.corvDome.position.copy(S.corv.group.localToWorld(V(0.2, 1.15, -0.25)));
  S.corvDome.intensity = t > 49.05 ? 0.15 : 0;

  // Kitty seated (child-like: follow the Fiat's transform)
  S.kSeat.holder.visible = t < T.kitOut;
  S.kSeat.holder.position.copy(S.fiat.group.localToWorld(SEAT.fiat.clone()));
  S.kSeat.holder.rotation.y = S.fiat.group.rotation.y;
  pose(S.kSeat, { sit: [1, 3 + t * 0.8] });
  if (t > 28) { const a = sm(28, 29.5, t) * (1 - sm(31, 32, t)); S.kSeat.bones.Head.rotation.x += a * 0.35; }
  // Moseley seated
  S.mSeat.holder.visible = t >= T.corv0 - 0.5 && t < T.mosOut;
  S.mSeat.holder.position.copy(S.corv.group.localToWorld(SEAT.corv.clone()));
  S.mSeat.holder.rotation.y = S.corv.group.rotation.y;
  pose(S.mSeat, { sit: [1, 5 + t * 0.6] });
  const turn = sm(38.1, 39.2, t) * 0.95;
  S.mSeat.bones.Head.rotation.y += turn; S.mSeat.bones.Neck.rotation.y += turn * 0.4;

  // Kitty on foot
  const P = paths;
  S.kWalk.holder.visible = t >= T.kitOut && t < T.black0 + 0.1;
  if (t < T.kitRun) {
    const tw = t - T.kitWalk;
    const d = dist(tw, 1.3, 0.6);
    const s0 = P.kWalk.at(d);
    S.kWalk.holder.position.copy(s0.p);
    const startYaw = P.fiatYaw + Math.PI / 2;
    S.kWalk.holder.rotation.y = tw < 0.6 ? lerpAngle(startYaw, s0.yaw, sm(-0.5, 0.6, tw)) : s0.yaw;
    const wk = sm(-0.2, 0.4, tw);
    pose(S.kWalk, { idle: [1 - wk, t * 0.6], walk: [wk, d / 1.25] });
    const g = sm(T.glance0, T.glance0 + 0.35, t) * (1 - sm(T.kitRun - 0.25, T.kitRun + 0.1, t));
    S.kWalk.bones.Head.rotation.y -= g * 1.05; S.kWalk.bones.Neck.rotation.y -= g * 0.45; S.kWalk.bones.Spine1.rotation.y -= g * 0.3;
  } else {
    const tr = t - T.kitRun;
    const d = dist(tr, 4.6, 0.5);
    const s0 = P.kRun.at(d);
    S.kWalk.holder.position.copy(s0.p);
    S.kWalk.holder.rotation.y = s0.yaw;
    const rk = sm(0, 0.3, tr);
    pose(S.kWalk, { walk: [1 - rk, (P.kWalk.len) / 1.25 + tr], run: [rk, d / 4.4] });
  }
  // Moseley on foot
  S.mWalk.holder.visible = t >= T.mosOut && t < T.black0 + 0.1;
  if (t < T.mosRun) {
    const tw = t - T.mosWalk;
    const d = dist(tw, 1.2, 0.6);
    const s0 = P.mWalk.at(d);
    S.mWalk.holder.position.copy(s0.p);
    S.mWalk.holder.rotation.y = s0.yaw;
    const wk = sm(-0.2, 0.4, tw);
    pose(S.mWalk, { idle: [1 - wk, t * 0.5], walk: [wk, d / 1.3] });
  } else {
    const tr = t - T.mosRun;
    const d = dist(tr, 4.75, 0.7);
    const s0 = P.mRun.at(d);
    S.mWalk.holder.position.copy(s0.p);
    S.mWalk.holder.rotation.y = s0.yaw;
    const rk = sm(0, 0.35, tr);
    pose(S.mWalk, { walk: [1 - rk, tr], run: [rk, d / 5.2] });
  }

  // windows
  const glass = world.glass, slots = world.glassSlots;
  const lvl = new Float32Array(slots.length);
  slots.forEach((g, i) => (lvl[i] = g.base.on));
  for (const w of S.witness) lvl[w.i] = Math.max(lvl[w.i], flick(t, w.t) * 0.95);
  for (const w of S.tudorWake) lvl[w.i] = Math.max(lvl[w.i], flick(t, w.t) * 0.9);
  slots.forEach((g, i) => { tmpC.copy(g.base.col).multiplyScalar(lvl[i] * 1.55 + 0.015); glass.setColorAt(i, tmpC); });
  glass.instanceColor.needsUpdate = true;
  for (const s of S.sil) s.m.material.opacity = sm(s.t, s.t + 0.8, t) * 0.92;

  // lamp flicker (one lot lamp is failing)
  const lot = S.lamps[5];
  const f = 1 - 0.85 * (pulse(t, 8.2, 0.12) + pulse(t, 8.45, 0.08) + pulse(t, 26.0, 0.1) + pulse(t, 43.1, 0.15) + pulse(t, 43.4, 0.06));
  lot.pl.intensity = 45 * f; lot.cone.material.uniforms.strength.value = 0.085 * f;

  // mist + dust
  for (const m of S.mist) m.m.position.x = m.x0 + t * m.v;
  const pa = S.dust.geometry.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    pa.array[i * 3] = S.dust0[i * 3] + Math.sin(t * 0.3 + i) * 0.4 + t * 0.05;
    pa.array[i * 3 + 1] = S.dust0[i * 3 + 1] + Math.sin(t * 0.2 + i * 1.7) * 0.3;
  }
  pa.needsUpdate = true;
}
function bwAt(t) {
  if (t < 10.6) return 1 - sm(8.6, 10.6, t);
  if (t >= T.black1) return 1;
  return 0;
}
function flick(t, t0) { if (t < t0) return 0; const x = t - t0; return x < 0.06 ? 0.6 : x < 0.12 ? 0.15 : Math.min(1, 0.5 + x * 4); }
function pulse(t, c, w) { return Math.abs(t - c) < w ? 1 : 0; }
function lerpAngle(a, b, k) { let d = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return a + d * k; }

// ---------- render ----------
function renderAt(t) {
  if (!S.fiat) return;
  update(t);
  const s = shot(t);
  camera.position.copy(s.pos);
  camera.fov = s.fov; camera.updateProjectionMatrix();
  camera.lookAt(s.look);
  bokeh.uniforms.focus.value = s.focus;
  bokeh.uniforms.aperture.value = s.ap;
  bokeh.enabled = s.ap > 0 && Q.get("dof") !== "0";
  grade.uniforms.time.value = t;
  grade.uniforms.bw.value = bwAt(t);
  grade.uniforms.fade.value = 1;
  if (t < T.black0) grade.uniforms.fade.value = 1 - sm(0, 2.5, t);
  if (t >= T.black1) grade.uniforms.fade.value = (1 - sm(T.black1, T.black1 + 1.5, t)) + sm(84.4, 86, t);
  composer.render();
}
window.addEventListener("hf-seek", (e) => renderAt(e.detail.time));
ready.then(() => renderAt(window.__hfThreeTime || 0));
