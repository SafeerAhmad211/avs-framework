// Shared engine for every chapter of THE 38: renderer, post pipeline (DOF, bloom, film grade, B&W archival),
// helpers, the Austin Street set (night/day), and the deterministic seek loop.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
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

export { THREE, rng, makeCar, CARS, makePerson };

// ---------------- helpers ----------------
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const ease = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const lerp = (a, b, k) => a + (b - a) * k;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const lerpV = (a, b, k) => a.clone().lerp(b, k);
export function shake(t, amp) {
  return V(Math.sin(t * 1.7) * 0.6 + Math.sin(t * 3.9 + 1) * 0.3 + Math.sin(t * 7.3) * 0.1, Math.sin(t * 2.3 + 2) * 0.5 + Math.sin(t * 5.1) * 0.2, Math.sin(t * 1.3 + 4) * 0.4).multiplyScalar(amp);
}
export function dist(t, v, ramp) { if (t <= 0) return 0; return t < ramp ? (v * t * t) / (2 * ramp) : v * (t - ramp / 2); }
export function makePath(pts) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p.clone().setY(0) : V(p[0], 0, p[1]))), false, "centripetal");
  const len = c.getLength();
  return { len, curve: c, at(d) { const u = clamp(d / len, 0, 1); const p = c.getPointAt(u); const tg = c.getTangentAt(u); return { p, yaw: Math.atan2(tg.x, tg.z) }; } };
}
export function carAt(car, path, d) {
  const s = path.at(d);
  car.group.position.copy(s.p); car.group.rotation.y = s.yaw;
  for (const w of car.wheels) w.rotation.x = d / 0.31;
}
export function pose(c, w) {
  for (const k in c.actions) {
    const a = c.actions[k], v = w[k];
    if (v && v[0] > 0) { a.setEffectiveWeight(v[0]); const D = a.getClip().duration; a.time = ((v[1] % D) + D) % D; }
    else a.setEffectiveWeight(0);
  }
  c.mixer.update(0);
}
// walk a character along a path: returns position on path; handles idle->walk blend
export function walker(c, path, t, t0, speed, clip = "walk", cadence = 1.3, idleClip = "idle") {
  const tw = t - t0, d = dist(tw, speed, 0.6), s = path.at(d);
  c.holder.position.copy(s.p); c.holder.rotation.y = s.yaw;
  const wk = sm(-0.2, 0.4, tw);
  const w = {}; w[idleClip] = [1 - wk, t * 0.6]; w[clip] = [wk, d / cadence];
  pose(c, w);
  return d;
}
export function coneMat(color, strength) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { color: { value: new THREE.Color(color) }, strength: { value: strength } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ vY = uv.y; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 color; uniform float strength; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); float a = pow(vY, 1.7) * edge * strength; gl_FragColor = vec4(color*a, a); }`,
  });
}
export function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---------------- stage ----------------
export function createStage() {
  const Q = new URLSearchParams(location.search);
  const W = 1920, H = 1080;
  const canvas = document.getElementById("gl");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.9;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1520);
  scene.fog = new THREE.FogExp2(0x131b27, 0.019);
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.05, 600);
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
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: 0.55 }, grain: { value: 0.05 }, ca: { value: 0.004 }, fade: { value: 0 }, bw: { value: 0 }, warm: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time, vig, grain, ca, fade, bw, warm; varying vec2 vUv;
      float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      void main(){
        float fr = floor(time * 24.0);
        vec2 uv = vUv + bw * vec2(sin(time * 13.0) * 0.0007 + (hash(vec2(fr, 1.0)) - 0.5) * 0.0012, sin(time * 7.0) * 0.0011 + (hash(vec2(fr, 2.0)) - 0.5) * 0.0016);
        vec2 d = uv - 0.5; float r = dot(d,d);
        vec3 col = vec3(texture2D(tDiffuse, uv - d*ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv + d*ca).b);
        float l = dot(col, vec3(0.299,0.587,0.114));
        col = mix(col, col*vec3(0.86,1.0,1.1), (1.0 - smoothstep(0.0, 0.45, l)) * (1.0 - warm));
        col = mix(col, col*vec3(1.08,1.0,0.88), smoothstep(0.35, 1.0, l) + warm * 0.4);
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
  const st = { THREE, renderer, scene, camera, composer, bokeh, bloom, grade, W, H, sets: {} };
  const gl = new GLTFLoader();
  st.loadGLTF = (u) => new Promise((res, rej) => gl.load(u, res, undefined, rej));
  return st;
}

// ---------------- the loop ----------------
// frame(t) must return { pos, look, fov, focus, ap, bw?, fade?, warm?, exposure? }
export function run(st, setupFn, frameFn) {
  const ready = (async () => { await setupFn(st); })();
  window.__hf = window.__hf || {};
  window.__hf.buildReady = window.__hf.buildReady || {};
  window.__hf.buildReady["world"] = ready;
  let ok = false;
  ready.then(() => { ok = true; render(window.__hfThreeTime || 0); });
  function render(t) {
    if (!ok) return;
    const s = frameFn(t);
    const { camera, bokeh, grade, renderer } = st;
    camera.position.copy(s.pos); camera.fov = s.fov ?? 35; camera.updateProjectionMatrix(); camera.lookAt(s.look);
    if (s.roll) camera.rotateZ(s.roll);
    bokeh.uniforms.focus.value = s.focus ?? 10; bokeh.uniforms.aperture.value = s.ap ?? 0; bokeh.enabled = (s.ap ?? 0) > 0;
    grade.uniforms.time.value = t; grade.uniforms.bw.value = s.bw ?? 0; grade.uniforms.fade.value = s.fade ?? 0; grade.uniforms.warm.value = s.warm ?? 0;
    renderer.toneMappingExposure = s.exposure ?? 1.9;
    st.composer.render();
  }
  window.addEventListener("hf-seek", (e) => render(e.detail.time));
}

// ---------------- Austin Street (night or day) ----------------
export async function buildStreet(st, opts = {}) {
  const { scene, renderer } = st;
  const S = {};
  const before = new Set(scene.children);
  const hemi = new THREE.HemisphereLight(0x4a6290, 0x1a130d, 1.4); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x9fb4e0, 0.7); moon.position.set(-30, 60, -20); scene.add(moon);
  const sun = new THREE.DirectionalLight(0xfff2dc, 0); sun.position.set(40, 70, -60); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 220 }); sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);
  S.hemi = hemi; S.moon = moon; S.sun = sun;
  const world = buildWorld(scene); S.world = world;
  const [lampG, hydG] = await Promise.all([st.loadGLTF("assets/models/street_lamp_01/street_lamp_01_1k.gltf"), st.loadGLTF("assets/models/fire_hydrant/fire_hydrant_1k.gltf")]);
  const keyShadow = { "19,7.2": 1, "38.5,14.5": 1, "9,-7.2": 1 };
  S.lamps = [];
  for (const [x, z] of world.lampSpots) {
    const m = lampG.scene.clone(true); m.scale.setScalar(1.15); m.position.set(x, 0.15, z);
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(m);
    const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 1.3) });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), headMat); head.position.set(x, 3.9, z); scene.add(head);
    const pl = new THREE.PointLight(0xffb25e, 45, 24, 1.5); pl.position.set(x, 3.6, z); scene.add(pl);
    let sp = null;
    if (keyShadow[`${x},${z}`]) {
      sp = new THREE.SpotLight(0xffb868, 220, 28, 1.0, 0.6, 1.4); sp.position.set(x, 3.75, z); sp.target.position.set(x, 0, z);
      sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0004; sp.shadow.radius = 4; scene.add(sp, sp.target);
    }
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 2.6, 3.7, 32, 1, true), coneMat(0xffa74d, 0.085));
    cone.position.set(x, 0.15 + 3.7 / 2, z); scene.add(cone);
    S.lamps.push({ x, z, pl, sp, cone, headMat });
  }
  const hyd = hydG.scene.clone(true); hyd.position.set(14.5, 0.15, 6.7); hyd.traverse((o) => { if (o.isMesh) o.castShadow = true; }); scene.add(hyd);
  // parked cars
  const R = rng(77);
  const parked = opts.parked ?? [[-34, 3.6, 0], [-21, 3.6, 0], [-8, 3.7, 0], [6, 3.6, 0], [-28, -3.6, 1], [-12, -3.7, 1], [2, -3.6, 1], [16, -3.6, 1], [27, -3.7, 1], [58, 31, 2], [47, 31, 2], [55, 18, 2]];
  const cols = [0x22303f, 0x3b2b22, 0x1d2a22, 0x4a4a46, 0x2b2b30, 0x5a4a34, 0x1a1c22];
  S.parked = [];
  for (const [x, z, side] of parked) {
    const big = R() > 0.4, col = cols[Math.floor(R() * cols.length)];
    const c = big ? makeCar({ ...CARS.sedan, color: col, roofColor: R() > 0.5 ? 0xd8d2c2 : null, plate: `${Math.floor(R() * 9) + 1}${"ABCDEFGHJK"[Math.floor(R() * 10)]} ${1000 + Math.floor(R() * 8999)}` })
      : makeCar({ ...CARS.coupe, color: col, plate: `${Math.floor(R() * 9) + 1}${"LMNPRSTUVW"[Math.floor(R() * 10)]} ${1000 + Math.floor(R() * 8999)}` });
    c.group.position.set(x, 0, z); c.group.rotation.y = side === 0 ? -Math.PI / 2 : side === 1 ? Math.PI / 2 : 0;
    scene.add(c.group); S.parked.push(c);
  }
  // mist + dust
  const mistTex = canvasTex(256, 128, (g) => {
    const r = rng(5);
    for (let i = 0; i < 70; i++) { const x = r() * 256, y = 30 + r() * 70, s = 20 + r() * 50; const gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, "rgba(255,255,255,0.10)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); }
  });
  mistTex.wrapS = THREE.RepeatWrapping;
  S.mist = [];
  const mr = rng(9);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 9), new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, opacity: 0.16, depthWrite: false, color: 0x8a96a8, fog: true }));
    m.position.set(-30 + mr() * 90, 2.5 + mr() * 2, -12 + mr() * 46); m.rotation.y = (mr() - 0.5) * 0.6;
    scene.add(m); S.mist.push({ m, x0: m.position.x, v: 0.25 + mr() * 0.35 });
  }
  S.update = (t) => { for (const m of S.mist) m.m.position.x = m.x0 + t * m.v; };
  // glass window glow control
  S.setWindows = (fn) => {
    const tmp = new THREE.Color();
    world.glassSlots.forEach((g, i) => { const lv = fn(g, i, g.base.on); tmp.copy(g.base.col).multiplyScalar(lv * 1.55 + 0.015); world.glass.setColorAt(i, tmp); });
    world.glass.instanceColor.needsUpdate = true;
  };
  S.setWindows((g, i, on) => on);
  // gather everything the street added into one group so it can be switched off for interior shots
  S.group = new THREE.Group(); scene.add(S.group);
  for (const o of scene.children.slice()) if (!before.has(o) && o !== S.group) S.group.add(o);
  S.show = (v) => { S.group.visible = v; };
  // night/day switch
  S.setDay = (day) => {
    sun.intensity = day ? 3.2 : 0; moon.intensity = day ? 0 : 0.7;
    hemi.color.set(day ? 0xc8d6ea : 0x4a6290); hemi.groundColor.set(day ? 0x5a4c3c : 0x1a130d); hemi.intensity = day ? 1.6 : 1.4;
    scene.background.set(day ? 0xb8c4d0 : 0x0e1520);
    scene.fog.color.set(day ? 0xb2bcc6 : 0x131b27); scene.fog.density = day ? 0.008 : 0.019;
    for (const l of S.lamps) { l.pl.visible = !day; if (l.sp) l.sp.visible = !day; l.cone.visible = !day; l.headMat.color.setRGB(day ? 0.6 : 4, day ? 0.6 : 2.6, day ? 0.55 : 1.3); }
    for (const m of S.mist) m.m.visible = !day;
  };
  return S;
}

// capture the current scene into a cube map and use it for reflections
export function captureEnv(st, pos, hide = []) {
  hide.forEach((o) => (o.visible = false));
  const crt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cc = new THREE.CubeCamera(0.3, 300, crt); cc.position.copy(pos); st.scene.add(cc); cc.update(st.renderer, st.scene);
  st.scene.environment = new THREE.PMREMGenerator(st.renderer).fromCubemap(crt.texture).texture;
  st.scene.environmentIntensity = 1.0;
  hide.forEach((o) => (o.visible = true));
}

export function only(st, active) { for (const k in st.sets) st.sets[k].group.visible = k === active; }
export async function people(st, list) {
  const lib = await loadPeople(list);
  return (name, kind, h) => makePerson(st.scene, lib, name, kind, h, 0);
}
