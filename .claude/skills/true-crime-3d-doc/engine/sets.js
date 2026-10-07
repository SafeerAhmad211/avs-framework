// Interior sets for THE 38. Each set is built at its own far-away origin so lighting never leaks between sets.
import { THREE, canvasTex, coneMat, rng } from "./stage.js";

const TL = new THREE.TextureLoader();
const tcache = {};
function tex(name, srgb, rx = 1, ry = 1) {
  const k = name + rx + "x" + ry;
  if (tcache[k]) return tcache[k];
  const t = TL.load(`assets/tex/${name}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return (tcache[k] = t);
}
const pbr = (name, rx, ry, o = {}) => new THREE.MeshStandardMaterial({ map: tex(name + "_diff", true, rx, ry), normalMap: tex(name + "_nor", false, rx, ry), roughnessMap: tex(name + "_rough", false, rx, ry), ...o });
const flat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o });
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });

function patternTex(kind, a, b) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b;
    if (kind === "stripe") for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 10, h);
    if (kind === "damask") for (let y = 0; y < h; y += 64) for (let x = (y / 64) % 2 ? 32 : 0; x < w; x += 64) { g.beginPath(); g.ellipse(x + 16, y + 32, 9, 20, 0, 0, 7); g.fill(); }
    if (kind === "tile") { g.strokeStyle = b; g.lineWidth = 4; for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }
    if (kind === "check") for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) if (((x + y) / 64) % 2 === 0) g.fillRect(x, y, 64, 64);
    if (kind === "panel") { g.strokeStyle = b; g.lineWidth = 6; for (let x = 0; x < w; x += 128) g.strokeRect(x + 10, 10, 108, h - 20); }
  });
}
function rep(t, rx, ry) { const c = t.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(rx, ry); c.needsUpdate = true; return c; }

export class Builder {
  constructor(scene, ox, oz) { this.scene = scene; this.o = new THREE.Vector3(ox, 0, oz); this.group = new THREE.Group(); this.group.position.copy(this.o); scene.add(this.group); }
  box(mat, w, h, d, x, y, z, ry = 0, cast = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry;
    m.castShadow = cast; m.receiveShadow = true; this.group.add(m); return m;
  }
  cyl(mat, rt, rb, h, x, y, z, seg = 16) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; this.group.add(m); return m; }
  plane(mat, w, h, x, y, z, ry = 0, rx = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); this.group.add(m); return m; }
  // a room: floor, ceiling, 4 walls (thin boxes), optional openings handled by caller
  room(w, d, h, wallMat, floorMat, ceilMat, skip = {}) {
    this.box(floorMat, w, 0.1, d, 0, -0.05, 0, 0, false);
    if (!skip.ceil) this.box(ceilMat, w, 0.1, d, 0, h + 0.05, 0, 0, false);
    if (!skip.n) this.box(wallMat, w, h, 0.12, 0, h / 2, -d / 2, 0, false);
    if (!skip.s) this.box(wallMat, w, h, 0.12, 0, h / 2, d / 2, 0, false);
    if (!skip.w) this.box(wallMat, 0.12, h, d, -w / 2, h / 2, 0, 0, false);
    if (!skip.e) this.box(wallMat, 0.12, h, d, w / 2, h / 2, 0, 0, false);
  }
  light(color, intensity, dist, x, y, z, shadow = false) {
    const l = new THREE.PointLight(color, intensity, dist, 1.6); l.position.set(x, y, z);
    if (shadow) { l.castShadow = true; l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.002; l.shadow.radius = 3; }
    this.group.add(l); return l;
  }
  spot(color, intensity, x, y, z, tx, ty, tz, angle = 0.7, shadow = true) {
    const s = new THREE.SpotLight(color, intensity, 20, angle, 0.5, 1.5); s.position.set(x, y, z); s.target.position.set(tx, ty, tz);
    if (shadow) { s.castShadow = true; s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -0.0005; s.shadow.radius = 4; }
    this.group.add(s, s.target); return s;
  }
  bulb(x, y, z, r = 0.06, c = [6, 4.2, 2.4]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), glow(...c)); b.position.set(x, y, z); this.group.add(b); return b; }
  world(x, y, z) { return this.o.clone().add(new THREE.Vector3(x, y, z)); }
  text(str, w, h, x, y, z, ry, o = {}) {
    const t = canvasTex(1024, Math.round(1024 * h / w), (g, W, H) => {
      g.fillStyle = o.bg ?? "rgba(0,0,0,0)"; g.fillRect(0, 0, W, H);
      g.fillStyle = o.color ?? "#fff"; g.font = o.font ?? `bold ${Math.round(H * 0.6)}px Georgia, serif`; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(str, W / 2, H / 2);
    });
    const m = o.emissive ? new THREE.MeshBasicMaterial({ map: t, transparent: true, color: new THREE.Color(...o.emissive) }) : new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8 });
    return this.plane(m, w, h, x, y, z, ry);
  }
}

function chair(b, x, z, ry, mat) {
  b.box(mat, 0.46, 0.05, 0.46, x, 0.46, z, ry);
  for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) b.box(mat, 0.04, 0.46, 0.04, x + dx, 0.23, z + dz, ry);
  const back = b.box(mat, 0.46, 0.5, 0.05, x - Math.sin(ry) * 0.21, 0.72, z - Math.cos(ry) * 0.21, ry);
  return back;
}
function table(b, w, d, x, z, mat, h = 0.76) {
  b.box(mat, w, 0.05, d, x, h, z);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(mat, 0.05, h, 0.05, x + dx * (w / 2 - 0.06), h / 2, z + dz * (d / 2 - 0.06));
}
function typewriter(b, x, y, z, ry = 0) {
  const m = flat(0x1a1a1a, { roughness: 0.35, metalness: 0.4 });
  b.box(m, 0.42, 0.12, 0.34, x, y + 0.06, z, ry);
  b.box(m, 0.44, 0.06, 0.08, x, y + 0.16, z - 0.12, ry);
  b.cyl(flat(0x111111), 0.03, 0.03, 0.46, x, y + 0.2, z - 0.14).rotation.z = Math.PI / 2;
  b.box(flat(0xeeeadf), 0.2, 0.18, 0.005, x, y + 0.27, z - 0.12, ry);
}
function papers(b, x, y, z, n, r) {
  const m = flat(0xe9e4d6, { roughness: 0.9 });
  for (let i = 0; i < n; i++) { const p = b.box(m, 0.21, 0.004, 0.28, x + (r() - 0.5) * 0.3, y + i * 0.004, z + (r() - 0.5) * 0.25, r() * 3, false); }
}

// ======================= SETS =======================
export function barSet(scene) { // Ev's Eleventh Hour, Hollis, Queens
  const b = new Builder(scene, 300, 0);
  const r = rng(301);
  const wall = new THREE.MeshStandardMaterial({ map: rep(patternTex("stripe", "#3a2a22", "#30221b"), 6, 2), roughness: 0.85 });
  const wood = pbr("dark_wood", 4, 4, { color: 0x6a4a34, roughness: 0.6 });
  const floor = new THREE.MeshStandardMaterial({ map: rep(patternTex("check", "#2a2622", "#c9c0ad"), 10, 6), roughness: 0.5 });
  b.room(14, 8, 3.4, wall, floor, flat(0x1a1612));
  // bar counter along north wall
  b.box(wood, 9, 1.05, 0.7, -1, 0.525, -2.2);
  b.box(flat(0x2a1a12, { roughness: 0.25, metalness: 0.1 }), 9.2, 0.06, 0.85, -1, 1.08, -2.2);
  b.box(flat(0xb8a070, { metalness: 1, roughness: 0.25 }), 9, 0.05, 0.05, -1, 0.15, -1.82); // foot rail
  // back bar shelves + bottles + mirror
  b.box(wood, 9, 0.9, 0.5, -1, 0.45, -3.7);
  b.box(flat(0x101418, { roughness: 0.05, metalness: 0.9 }), 8.4, 1.3, 0.04, -1, 1.85, -3.93);
  for (const y of [1.3, 1.8, 2.3]) {
    b.box(wood, 8.6, 0.04, 0.3, -1, y, -3.75);
    for (let i = 0; i < 26; i++) {
      const c = [0x3a5a2a, 0x6a3a12, 0x2a3a5a, 0x5a1a1a, 0x8a7a40][Math.floor(r() * 5)];
      const bm = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.08, transmission: 0.0, metalness: 0.1, clearcoat: 1, emissive: c, emissiveIntensity: 0.25 });
      const h = 0.22 + r() * 0.12;
      b.cyl(bm, 0.035, 0.04, h, -5.1 + i * 0.32, y + h / 2 + 0.02, -3.75, 10);
    }
  }
  // stools
  const chrome = flat(0xd0d0d0, { metalness: 1, roughness: 0.2 });
  const vinyl = flat(0x6a1414, { roughness: 0.45 });
  for (let i = 0; i < 8; i++) { const x = -5 + i * 1.1; b.cyl(chrome, 0.03, 0.03, 0.72, x, 0.36, -1.35); b.cyl(vinyl, 0.2, 0.2, 0.08, x, 0.75, -1.35, 20); }
  // booths / tables
  for (let i = 0; i < 3; i++) { table(b, 1.0, 0.8, -4 + i * 3.2, 2.2, wood); chair(b, -4 + i * 3.2, 1.6, 0, wood); chair(b, -4 + i * 3.2, 2.8, Math.PI, wood); }
  // pendant lamps
  b.lamps = [];
  for (let i = 0; i < 4; i++) {
    const x = -4.5 + i * 2.4;
    b.cyl(flat(0x222222), 0.005, 0.005, 0.8, x, 3.0, -1.9);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.22, 20, 1, true), flat(0x8a6a2a, { side: THREE.DoubleSide, metalness: 0.6, roughness: 0.35 })); shade.position.set(x, 2.55, -1.9); b.group.add(shade);
    const bulb = b.bulb(x, 2.47, -1.9, 0.05);
    const l = b.light(0xffb870, 9, 7, x, 2.4, -1.9, i === 1);
    b.lamps.push({ l, bulb });
  }
  // neon sign (back wall above mirror)
  b.sign = b.text("EV'S ELEVENTH HOUR", 4.2, 0.55, -1, 2.95, -3.9, 0, { emissive: [4.5, 0.6, 0.5], font: "italic bold 120px Georgia, serif", color: "#ff7a6a" });
  b.signLight = b.light(0xff4a3a, 4, 6, -1, 2.8, -3.2);
  // jukebox
  b.box(flat(0x5a3a1a, { roughness: 0.4 }), 0.9, 1.5, 0.6, 5.8, 0.75, -3.4);
  b.juke = b.plane(glow(3, 1.6, 0.6), 0.6, 0.5, 5.8, 1.15, -3.09);
  b.jukeLight = b.light(0xffa040, 3, 4, 5.8, 1.2, -2.6);
  // front windows + door on south wall (street glow outside)
  b.box(flat(0x080a0e), 3, 1.6, 0.02, 3.5, 1.6, 3.93);
  b.plane(glow(0.25, 0.35, 0.55), 3, 1.6, 3.5, 1.6, 3.9, Math.PI);
  b.box(wood, 1.0, 2.2, 0.08, -5.5, 1.1, 3.9);
  b.smokeLight = b.light(0xffd0a0, 2.5, 12, 0, 3.0, 0);
  b.hemi = new THREE.HemisphereLight(0x6a5a4a, 0x1a1210, 0.35); b.group.add(b.hemi);
  b.glassOnBar = [];
  for (let i = 0; i < 5; i++) { const g = b.cyl(new THREE.MeshPhysicalMaterial({ color: 0xddeeff, roughness: 0.05, transparent: true, opacity: 0.4, clearcoat: 1 }), 0.035, 0.03, 0.1, -4.5 + i * 1.7, 1.16, -2.1, 12); b.glassOnBar.push(g); }
  return b;
}

export function apartmentSet(scene) { // Kew Gardens apartment, 1964
  const b = new Builder(scene, 360, 0);
  const wall = new THREE.MeshStandardMaterial({ map: rep(patternTex("damask", "#5b5a46", "#4d4c3a"), 5, 2), roughness: 0.9 });
  const wood = pbr("dark_wood", 3, 3, { color: 0x7a5a3e, roughness: 0.55 });
  b.room(6, 5, 2.8, wall, pbr("dark_wood", 6, 5, { color: 0x6b4a32, roughness: 0.5 }), flat(0xd8d0bf));
  // armchairs
  const fabric = flat(0x3e5a4a, { roughness: 0.95 });
  for (const [x, z, ry] of [[-1.3, 0.3, 0.5], [1.2, 0.4, -0.5]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; b.group.add(g);
    for (const [w, h, d, px, py, pz] of [[0.9, 0.45, 0.85, 0, 0.22, 0], [0.9, 0.55, 0.18, 0, 0.7, -0.35], [0.16, 0.25, 0.85, -0.42, 0.55, 0], [0.16, 0.25, 0.85, 0.42, 0.55, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fabric); m.position.set(px, py, pz); m.castShadow = m.receiveShadow = true; g.add(m);
    }
  }
  table(b, 0.6, 0.6, 0, 0.6, wood, 0.55);
  // floor lamp
  b.cyl(flat(0x2a2a2a, { metalness: 0.6 }), 0.015, 0.015, 1.5, -2.0, 0.75, -0.3);
  const shade = b.cyl(flat(0xe8d8b0, { side: THREE.DoubleSide, emissive: 0xffc070, emissiveIntensity: 0.6 }), 0.16, 0.24, 0.3, -2.0, 1.55, -0.3, 20);
  b.lamp = b.light(0xffc078, 12, 7, -2.0, 1.45, -0.3, true);
  // radio + record player on sideboard
  b.box(wood, 1.6, 0.8, 0.45, 1.8, 0.4, -2.2);
  b.box(flat(0x5a3a22, { roughness: 0.4 }), 0.5, 0.32, 0.25, 1.4, 0.96, -2.2);
  b.plane(glow(1.4, 1.0, 0.5), 0.2, 0.08, 1.4, 1.0, -2.07);
  // window with blinds on north wall
  b.box(flat(0x0a0d12), 1.4, 1.4, 0.02, -0.6, 1.5, -2.43);
  b.plane(glow(0.12, 0.17, 0.28), 1.4, 1.4, -0.6, 1.5, -2.42);
  for (let i = 0; i < 14; i++) b.box(flat(0xd8d2c0), 1.44, 0.015, 0.06, -0.6, 0.85 + i * 0.1, -2.36);
  // pictures, rug, book
  for (const [x, c] of [[1.2, 0x8a6a4a], [2.0, 0x4a5a6a]]) b.box(flat(c), 0.4, 0.5, 0.03, x, 1.8, -2.43);
  b.plane(flat(0x5a2a22, { roughness: 1 }), 2.6, 1.8, 0, 0.005, 0.5, 0, -Math.PI / 2);
  b.box(flat(0x2a3a5a), 0.2, 0.03, 0.27, 0.05, 0.6, 0.6, 0.3);
  // telephone on side table (for Karl's call)
  table(b, 0.5, 0.4, 2.4, 1.6, wood, 0.75);
  b.box(flat(0x111111, { roughness: 0.3 }), 0.22, 0.1, 0.18, 2.4, 0.82, 1.6);
  b.box(flat(0x111111, { roughness: 0.3 }), 0.24, 0.05, 0.06, 2.4, 0.9, 1.6);
  b.hemi = new THREE.HemisphereLight(0x5a5a6a, 0x1a1410, 0.4); b.group.add(b.hemi);
  return b;
}

export function windowRoomSet(scene) { // Robert Mozer's room in the Mowbray, looking out over Austin Street
  const b = new Builder(scene, 420, 0);
  const wall = new THREE.MeshStandardMaterial({ map: rep(patternTex("stripe", "#4a463e", "#423e36"), 4, 2), roughness: 0.9 });
  b.room(4.5, 4, 2.7, wall, pbr("dark_wood", 4, 4, { color: 0x5a4030 }), flat(0xcfc8b8), { n: true });
  // north wall with window opening (1.2 x 1.4)
  const ww = 1.2, wh = 1.4, wy = 1.5;
  b.box(wall, (4.5 - ww) / 2, 2.7, 0.2, -(ww / 2 + (4.5 - ww) / 4), 1.35, -2);
  b.box(wall, (4.5 - ww) / 2, 2.7, 0.2, ww / 2 + (4.5 - ww) / 4, 1.35, -2);
  b.box(wall, ww, wy - wh / 2, 0.2, 0, (wy - wh / 2) / 2, -2);
  b.box(wall, ww, 2.7 - (wy + wh / 2), 0.2, 0, (2.7 + wy + wh / 2) / 2, -2);
  b.box(flat(0xe8e2d2), ww + 0.1, 0.06, 0.35, 0, wy - wh / 2, -1.95);
  b.sash = b.box(new THREE.MeshPhysicalMaterial({ color: 0x8899aa, roughness: 0.05, transparent: true, opacity: 0.25 }), ww - 0.06, wh / 2, 0.03, 0, wy + wh / 4, -2.05);
  // outside: night street backdrop (blurry lamps and the Tudor row)
  const bd = canvasTex(1024, 512, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#05070c"); gr.addColorStop(0.6, "#0c1018"); gr.addColorStop(1, "#1a140c"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = "#0a0b0e"; g.fillRect(0, 230, W, 200);
    for (let i = 0; i < 18; i++) { g.fillStyle = i % 3 ? "#1a1408" : "#c89048"; g.fillRect(40 + i * 55, 260 + (i % 2) * 60, 24, 32); }
    for (const x of [180, 520, 860]) { const rg = g.createRadialGradient(x, 330, 0, x, 330, 90); rg.addColorStop(0, "rgba(255,190,110,1)"); rg.addColorStop(1, "rgba(255,190,110,0)"); g.fillStyle = rg; g.fillRect(x - 90, 240, 180, 180); }
  });
  b.plane(new THREE.MeshBasicMaterial({ map: bd }), 14, 7, 0, 1.0, -9, 0);
  // curtains
  b.curtains = [];
  for (const sx of [-1, 1]) { const c = b.box(flat(0x6a5a3a, { roughness: 1 }), 0.45, 1.9, 0.04, sx * 0.78, 1.55, -1.85); b.curtains.push(c); }
  b.bed = b.box(flat(0xbab2a0), 1.4, 0.45, 2.0, -1.4, 0.25, 0.8);
  b.lamp = b.light(0xffc078, 6, 6, 1.5, 1.1, 0.5);
  b.box(flat(0x3a2a1a), 0.4, 0.55, 0.4, 1.5, 0.27, 0.5);
  b.lampShade = b.cyl(flat(0xe8d8b0, { emissive: 0xffc070, emissiveIntensity: 0.5 }), 0.12, 0.18, 0.22, 1.5, 0.75, 0.5);
  b.street = b.spot(0x8aa0d0, 6, 0, 3, -6, 0, 0.5, 1.5, 0.5, true);
  b.hemi = new THREE.HemisphereLight(0x4a5470, 0x100c08, 0.25); b.group.add(b.hemi);
  return b;
}

export function vestibuleSet(scene) { // rear vestibule + stairwell of 82-70 Austin Street
  const b = new Builder(scene, 480, 0);
  const plaster = pbr("white_rough_plaster", 2, 2, { color: 0xb8ae98 });
  const tile = new THREE.MeshStandardMaterial({ map: rep(patternTex("check", "#6a5a48", "#c8bea8"), 6, 8), roughness: 0.45 });
  b.room(3, 6, 5.6, plaster, tile, flat(0xa8a090));
  // glass entrance door on south wall (x=0, z=+3)
  b.door = new THREE.Group(); b.door.position.set(-0.5, 0, 2.94); b.group.add(b.door);
  const df = flat(0x3a2a1e, { roughness: 0.6 });
  for (const [w, h, x, y] of [[1.0, 0.1, 0.5, 2.15], [1.0, 0.25, 0.5, 0.12], [0.1, 2.2, 0.05, 1.1], [0.1, 2.2, 0.95, 1.1]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), df); m.position.set(x, y, 0); b.door.add(m); }
  const dg = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.75), new THREE.MeshPhysicalMaterial({ color: 0x6a7a8a, roughness: 0.15, transparent: true, opacity: 0.35 })); dg.position.set(0.5, 1.22, 0); b.door.add(dg);
  b.plane(glow(0.15, 0.2, 0.32), 1.0, 2.2, 0, 1.1, 3.1, Math.PI);
  // mailboxes
  for (let i = 0; i < 6; i++) b.box(flat(0x9a8a5a, { metalness: 0.7, roughness: 0.35 }), 0.22, 0.32, 0.06, 1.42, 1.3 + (i % 2) * 0.36, 1.4 - Math.floor(i / 2) * 0.26, Math.PI / 2);
  // staircase going up along north part (up toward -z), landing at y=2.8
  const stairM = pbr("dark_wood", 1, 1, { color: 0x5a3a26 });
  for (let i = 0; i < 16; i++) b.box(stairM, 1.2, 0.175, 0.28, 0.75, 0.0875 + i * 0.175, 0.6 - i * 0.28);
  b.box(stairM, 3, 0.15, 1.6, 0, 2.8, -2.2);
  b.cyl(flat(0x2a1a10), 0.03, 0.03, 3.2, 0.12, 1.6, -0.6).rotation.x = 0.56;
  // Karl Ross's apartment door at top landing (north wall), opens inward
  b.kdoor = new THREE.Group(); b.kdoor.position.set(-0.45, 2.87, -2.94); b.group.add(b.kdoor);
  const kd = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.05, 0.05), flat(0x4a2e1e)); kd.position.set(0.45, 1.02, 0); kd.castShadow = true; b.kdoor.add(kd);
  b.kdoorLight = b.light(0xffc890, 0, 5, 0, 3.9, -3.6);
  b.plane(glow(1.2, 0.9, 0.55), 0.9, 2.05, 0, 3.9, -3.05);
  // bare bulb
  b.cord = b.cyl(flat(0x111111), 0.004, 0.004, 1.2, 0, 4.9, 1.4);
  b.bulbM = b.bulb(0, 4.28, 1.4, 0.05, [7, 5, 3]);
  b.bulbL = b.light(0xffd6a0, 10, 9, 0, 4.2, 1.4, true);
  b.hemi = new THREE.HemisphereLight(0x5a5a68, 0x18120c, 0.25); b.group.add(b.hemi);
  return b;
}

export function interrogationSet(scene) {
  const b = new Builder(scene, 540, 0);
  const tile = new THREE.MeshStandardMaterial({ map: rep(patternTex("tile", "#d8dad6", "#a8aaa6"), 6, 3), roughness: 0.3 });
  b.room(5, 5, 3, tile, flat(0x3a3a38, { roughness: 0.6 }), flat(0x9a9a96));
  const tm = pbr("dark_wood", 2, 2, { color: 0x5a4a3a, roughness: 0.4 });
  table(b, 1.6, 0.9, 0, 0, tm);
  chair(b, 0, 0.75, Math.PI, flat(0x2a2a2a, { metalness: 0.5 }));
  chair(b, 0, -0.75, 0, flat(0x2a2a2a, { metalness: 0.5 }));
  papers(b, 0.1, 0.8, 0.05, 6, rng(7));
  const cuffM = flat(0xb0b0b0, { metalness: 1, roughness: 0.2 });
  for (const dx of [-0.07, 0.07]) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 24), cuffM); c.rotation.x = Math.PI / 2; c.position.set(-0.35 + dx, 0.79, 0.1); b.group.add(c); }
  b.box(flat(0x777777, { metalness: 0.8 }), 0.13, 0.02, 0.13, 0.5, 0.79, -0.1); // ashtray
  // one-way mirror on east wall
  b.box(flat(0x080a0c, { roughness: 0.02, metalness: 0.95 }), 0.03, 1.1, 2.2, 2.42, 1.6, 0);
  // hanging lamp
  b.cord = b.cyl(flat(0x111111), 0.005, 0.005, 0.9, 0, 2.55, 0);
  b.shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.25, 24, 1, true), flat(0x2a3a2a, { side: THREE.DoubleSide, metalness: 0.5, roughness: 0.4 })); b.shade.position.set(0, 2.05, 0); b.group.add(b.shade);
  b.bulbM = b.bulb(0, 1.97, 0, 0.05, [3, 2.8, 2.5]);
  b.key = b.spot(0xfff2dc, 14, 0, 2.0, 0, 0, 0, 0, 0.9, true);
  b.cone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.5, 2.0, 32, 1, true), coneMat(0xfff2dc, 0.05)); b.cone.position.set(0, 1.0, 0); b.group.add(b.cone);
  b.hemi = new THREE.HemisphereLight(0x8a8a90, 0x202020, 0.35); b.group.add(b.hemi);
  return b;
}

export function newsroomSet(scene) {
  const b = new Builder(scene, 600, 0);
  const wall = pbr("white_rough_plaster", 4, 2, { color: 0xc8c0b0 });
  b.room(16, 12, 3.6, wall, new THREE.MeshStandardMaterial({ map: rep(patternTex("check", "#5a5248", "#6a6258"), 20, 16), roughness: 0.6 }), flat(0xd8d4cc));
  const desk = pbr("dark_wood", 2, 2, { color: 0x6a5038, roughness: 0.5 });
  const r = rng(61);
  b.desks = [];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
    const x = -6 + col * 3, z = -3.5 + row * 2.6;
    table(b, 1.5, 0.8, x, z, desk);
    typewriter(b, x - 0.2, 0.79, z + 0.05);
    papers(b, x + 0.45, 0.79, z, 3 + Math.floor(r() * 4), r);
    b.cyl(flat(0x2a4a2a, { metalness: 0.4, roughness: 0.3 }), 0.08, 0.12, 0.08, x + 0.6, 0.83, z - 0.25);
    chair(b, x, z + 0.65, Math.PI, flat(0x3a2a1e));
    b.desks.push([x, z]);
  }
  // tall windows on north wall: bright daylight
  for (let i = 0; i < 5; i++) { b.plane(glow(1.1, 1.1, 1.05), 1.6, 2.2, -6 + i * 3, 1.9, -5.93); for (let k = 0; k < 3; k++) b.box(flat(0x2a2a2a), 1.62, 0.04, 0.05, -6 + i * 3, 1.0 + k * 0.9, -5.9); }
  b.sun = b.spot(0xfff4e0, 35, 0, 3.5, -9, 0, 0, 2, 1.1, true);
  for (let i = 0; i < 4; i++) { b.bulb(-4.5 + i * 3, 3.3, 0, 0.12, [1.6, 1.6, 1.5]); b.light(0xfff0d8, 4, 9, -4.5 + i * 3, 3.2, 0); }
  // clock
  const ck = canvasTex(256, 256, (g) => { g.fillStyle = "#eee"; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.strokeStyle = "#111"; g.lineWidth = 8; g.stroke(); g.lineWidth = 6; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 50); g.moveTo(128, 128); g.lineTo(185, 150); g.stroke(); });
  b.plane(new THREE.MeshStandardMaterial({ map: ck }), 0.6, 0.6, 0, 3.0, 5.93, Math.PI);
  b.hemi = new THREE.HemisphereLight(0xb0b0b8, 0x40382e, 0.45); b.group.add(b.hemi);
  return b;
}

export function frontPage(b, x, y, z) { // reconstructed front page (not a copy of the real masthead)
  const t = canvasTex(1024, 1400, (g, W, H) => {
    g.fillStyle = "#e9e2cf"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#1b1712";
    g.font = "bold 22px Georgia"; g.fillText("NEW YORK, FRIDAY, MARCH 27, 1964", 40, 52); g.fillText("LATE CITY EDITION", W - 300, 52);
    g.fillRect(40, 66, W - 80, 4);
    g.font = "900 78px Georgia"; g.fillText("37 Who Saw Murder", 40, 170); g.fillText("Didn't Call the Police", 40, 255);
    g.font = "italic 38px Georgia"; g.fillText("Apathy at Stabbing of Queens Woman", 40, 320); g.fillText("Shocks Inspector", 40, 365);
    g.fillRect(40, 395, W - 80, 2);
    const r = rng(27);
    for (let c = 0; c < 4; c++) for (let l = 0; l < 44; l++) { g.fillStyle = "rgba(27,23,18,0.45)"; g.fillRect(40 + c * 240, 430 + l * 21, (l % 9 === 8 ? 0.5 : 0.92) * 220 * (0.9 + r() * 0.1), 9); }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.8), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); b.group.add(m); return m;
}

export function labSet(scene) { // 1968 intercom experiment booth
  const b = new Builder(scene, 660, 0);
  const wall = new THREE.MeshStandardMaterial({ map: rep(patternTex("panel", "#8a8a80", "#6a6a62"), 3, 1), roughness: 0.8 });
  b.room(3, 2.6, 2.6, wall, flat(0x4a4a46), flat(0xb0b0a8));
  table(b, 1.2, 0.6, 0, -0.85, flat(0x6a6a62, { roughness: 0.4 }));
  chair(b, 0, -0.2, Math.PI, flat(0x3a3a38));
  // intercom unit + mic
  b.box(flat(0x2a2a2a, { roughness: 0.4 }), 0.36, 0.22, 0.2, 0.25, 0.9, -0.95);
  for (let i = 0; i < 6; i++) b.box(flat(0x777777), 0.24, 0.01, 0.005, 0.25, 0.85 + i * 0.022, -0.849);
  b.ind = b.bulb(0.38, 0.97, -0.85, 0.012, [6, 0.4, 0.3]);
  b.cyl(flat(0x999999, { metalness: 0.8 }), 0.01, 0.01, 0.25, -0.25, 0.9, -0.85);
  b.box(flat(0x222222), 0.06, 0.08, 0.06, -0.25, 1.05, -0.85);
  b.light(0xfff2e0, 12, 6, 0, 2.4, 0, true);
  b.bulb(0, 2.55, 0, 0.1, [3, 3, 3]);
  b.hemi = new THREE.HemisphereLight(0xa0a0a8, 0x303030, 0.5); b.group.add(b.hemi);
  return b;
}

export function courtroomSet(scene) {
  const b = new Builder(scene, 720, 0);
  const panel = new THREE.MeshStandardMaterial({ map: rep(patternTex("panel", "#5a3e28", "#3e2a1a"), 8, 1), roughness: 0.55 });
  b.room(14, 18, 5, panel, pbr("dark_wood", 8, 10, { color: 0x5a3e2a, roughness: 0.4 }), flat(0xd8d0c0));
  const wood = pbr("dark_wood", 2, 2, { color: 0x6a4a30, roughness: 0.45 });
  // judge's bench (north)
  b.box(wood, 4, 1.4, 1.2, 0, 0.7, -7.2); b.box(wood, 4.2, 0.08, 1.4, 0, 1.44, -7.2); b.box(wood, 4, 0.5, 1.2, 0, 0.25, -7.2);
  b.box(wood, 0.8, 1.2, 0.9, -3.0, 0.6, -6.6); // witness stand
  // seal
  const seal = canvasTex(256, 256, (g) => { g.fillStyle = "#b8a060"; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.fillStyle = "#3a2a14"; g.beginPath(); g.arc(128, 128, 92, 0, 7); g.fill(); g.fillStyle = "#b8a060"; g.font = "bold 22px Georgia"; g.textAlign = "center"; g.fillText("SUPREME COURT", 128, 120); g.fillText("QUEENS COUNTY", 128, 150); });
  b.plane(new THREE.MeshStandardMaterial({ map: seal, metalness: 0.4, roughness: 0.4 }), 1.4, 1.4, 0, 3.4, -8.93);
  // tables
  table(b, 2.2, 0.9, -2.5, -3.5, wood); table(b, 2.2, 0.9, 2.5, -3.5, wood);
  // rail + benches
  b.box(wood, 12, 0.9, 0.12, 0, 0.45, -1.6);
  for (let r = 0; r < 6; r++) for (const sx of [-1, 1]) { b.box(wood, 5, 0.08, 0.45, sx * 3.4, 0.45, 0.3 + r * 1.3); b.box(wood, 5, 0.6, 0.06, sx * 3.4, 0.75, 0.55 + r * 1.3); }
  for (let i = 0; i < 4; i++) { b.plane(glow(2.4, 2.35, 2.2), 1.4, 3, -6.93, 2.6, -5 + i * 4, Math.PI / 2); }
  b.sun = b.spot(0xfff4e0, 120, -10, 5, -3, 0, 0, 0, 1.0, true);
  for (let i = 0; i < 3; i++) { b.bulb(0, 4.6, -5 + i * 5, 0.2, [3, 2.9, 2.6]); b.light(0xfff0d8, 10, 12, 0, 4.5, -5 + i * 5); }
  b.hemi = new THREE.HemisphereLight(0xb0a898, 0x30241a, 0.7); b.group.add(b.hemi);
  return b;
}

export function cellSet(scene) {
  const b = new Builder(scene, 780, 0);
  const conc = pbr("concrete_pavement", 2, 2, { color: 0x8a8a84 });
  b.room(3, 2.6, 2.8, conc, conc, conc, { s: true });
  const bar = flat(0x3a3a3a, { metalness: 0.8, roughness: 0.4 });
  for (let i = 0; i < 13; i++) b.cyl(bar, 0.022, 0.022, 2.8, -1.45 + i * 0.24, 1.4, 1.3, 8);
  for (const y of [0.15, 1.4, 2.65]) b.box(bar, 3, 0.05, 0.05, 0, y, 1.3);
  b.box(flat(0x6a6a5a), 0.8, 0.12, 2.0, -1.0, 0.45, -0.2); b.box(flat(0xb0aa98), 0.75, 0.1, 1.9, -1.0, 0.55, -0.2);
  // high window with light shaft
  b.plane(glow(4, 4, 3.8), 0.6, 0.35, 0.6, 2.35, -1.28);
  for (let i = 0; i < 4; i++) b.box(bar, 0.025, 0.35, 0.025, 0.42 + i * 0.12, 2.35, -1.26);
  b.shaft = b.spot(0xfff2dc, 80, 0.6, 2.35, -1.6, -0.6, 0, 0.9, 0.35, true);
  b.cone = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.9, 3.0, 24, 1, true), coneMat(0xfff2dc, 0.07));
  b.cone.position.set(0.0, 1.2, -0.35); b.cone.rotation.x = -0.6; b.cone.rotation.z = 0.35; b.group.add(b.cone);
  b.hemi = new THREE.HemisphereLight(0x9a9aa0, 0x303030, 0.9); b.group.add(b.hemi);
  b.light(0xd8dce8, 3, 6, 0.5, 2.4, 1.0);
  return b;
}

export function theaterSet(scene) { // a screening room for "The Witness" (2015)
  const b = new Builder(scene, 840, 0);
  b.room(10, 12, 4.5, flat(0x1a1210), flat(0x2a1414), flat(0x0e0a08));
  const seat = flat(0x5a1414, { roughness: 0.8 });
  for (let r = 0; r < 6; r++) for (let i = 0; i < 9; i++) { const x = -3.6 + i * 0.9, z = -1 + r * 1.1; b.box(seat, 0.6, 0.45, 0.55, x, 0.25, z); b.box(seat, 0.6, 0.6, 0.12, x, 0.7, z + 0.3); }
  const scr = canvasTex(1024, 432, (g, W, H) => { g.fillStyle = "#0c0c0c"; g.fillRect(0, 0, W, H); g.fillStyle = "#e8e4dc"; g.font = "bold 92px Georgia"; g.textAlign = "center"; g.fillText("THE WITNESS", W / 2, H / 2 + 10); g.font = "28px Georgia"; g.fillText("2015", W / 2, H / 2 + 70); });
  b.screen = b.plane(new THREE.MeshBasicMaterial({ map: scr, color: new THREE.Color(1.6, 1.6, 1.6) }), 7, 2.95, 0, 2.3, -5.9);
  b.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 2.6, 12, 24, 1, true), coneMat(0xd8e0ff, 0.05)); b.beam.rotation.x = Math.PI / 2; b.beam.position.set(0, 2.9, 0.1); b.group.add(b.beam);
  b.light(0xc8d0ff, 8, 14, 0, 2.3, -4.5);
  b.hemi = new THREE.HemisphereLight(0x303040, 0x100808, 0.3); b.group.add(b.hemi);
  return b;
}
