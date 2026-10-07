// World construction: Kew Gardens, Austin Street, March 1964 (stylised reconstruction).
// Units are metres. Austin Street runs along X. North side (Tudor block, Kitty's building) is +Z.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const texLoader = new THREE.TextureLoader();
const texCache = {};
function tex(name, srgb) {
  if (texCache[name]) return texCache[name];
  const t = texLoader.load(`assets/tex/${name}.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache[name] = t;
  return t;
}
function pbr(name, o = {}) {
  return new THREE.MeshStandardMaterial({
    map: tex(name + "_diff", true),
    normalMap: tex(name + "_nor"),
    roughnessMap: tex(name + "_rough"),
    ...o,
  });
}

// Box with UVs scaled to world metres so one material tiles correctly at any size.
export function tiledBox(w, h, d, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
  }
  return g;
}

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function buildWorld(scene) {
  const R = rng(1964);
  const M = {
    brick: pbr("red_brick_03", { color: 0x9a8070, roughness: 1 }),
    brickDark: pbr("red_brick_03", { color: 0x6a5048, roughness: 1 }),
    plaster: pbr("white_rough_plaster", { color: 0xcfc3ad, roughness: 1 }),
    wood: pbr("dark_wood", { color: 0x4a3a2e, roughness: 0.9 }),
    slate: pbr("roof_slates_02", { color: 0x7a7a80, roughness: 0.9 }),
    asphalt: pbr("asphalt_02", { color: 0x8a8a8e, roughness: 0.55, envMapIntensity: 1.4 }),
    lot: pbr("asphalt_02", { color: 0x77777a, roughness: 0.8 }),
    concrete: pbr("concrete_pavement", { color: 0x9d9a95, roughness: 0.9 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 0.7 }),
    paint: new THREE.MeshStandardMaterial({ color: 0xbdb7a8, roughness: 0.7 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.6 }),
  };
  const world = { M, windows: [], lamps: [], cones: [], shadowLamps: [] };
  const add = (geo, mat, x, y, z, ry = 0, cast = true, recv = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.y = ry;
    m.castShadow = cast; m.receiveShadow = recv;
    scene.add(m); return m;
  };

  // ---------------- ground ----------------
  add(tiledBox(260, 0.2, 12.2, 5), M.asphalt, 0, -0.1, 0, 0, false);
  add(tiledBox(260, 0.3, 4, 2.5), M.concrete, 0, 0.0, 8.0, 0, false); // north sidewalk z 6..10
  add(tiledBox(260, 0.3, 4, 2.5), M.concrete, 0, 0.0, -8.0, 0, false); // south sidewalk
  add(tiledBox(260, 0.32, 0.25, 1), M.paint, 0, 0.0, 6.05, 0, false);
  add(tiledBox(260, 0.32, 0.25, 1), M.paint, 0, 0.0, -6.05, 0, false);
  // parking lot (east of the Tudor block, behind the sidewalk)
  add(tiledBox(34, 0.2, 30, 6), M.lot, 47, -0.02, 25, 0, false);
  add(tiledBox(32, 0.2, 30, 6), M.lot, -60, -0.02, 25, 0, false);
  const stripe = new THREE.MeshStandardMaterial({ color: 0xb8b2a0, roughness: 0.8 });
  for (let i = 0; i < 9; i++) add(new THREE.BoxGeometry(0.12, 0.01, 4.8), stripe, 37 + i * 2.8, 0.085, 31.5, 0, false);
  for (let i = 0; i < 7; i++) add(new THREE.BoxGeometry(0.12, 0.01, 4.8), stripe, 44 + i * 2.8, 0.085, 18, 0, false);
  // centre line
  for (let i = 0; i < 40; i++) add(new THREE.BoxGeometry(3, 0.01, 0.12), stripe, -110 + i * 6, 0.005, 0, 0, false);
  // driveway cut into north sidewalk
  add(tiledBox(6, 0.3, 4.2, 3), M.lot, 36, 0.0, 8.0, 0, false);
  // walkway behind the Tudor block (to Kitty's door)
  add(tiledBox(40, 0.25, 3, 2.5), M.concrete, 10, 0.0, 23.6, 0, false);

  // ---------------- window glass (instanced, per-instance glow) ----------------
  const glassGeo = new THREE.PlaneGeometry(1, 1);
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: true });
  const glassSlots = [];
  const addGlass = (x, y, z, w, h, ry, group) => {
    glassSlots.push({ x, y, z, w, h, ry, ...group });
  };

  // ---------------- north row: Tudor block, x -45..30, front z = 10 ----------------
  const bayW = 7.5, x0 = -45, nBays = 10;
  add(tiledBox(75, 3.8, 12, 2.4), M.brick, -7.5, 1.9, 16);
  add(tiledBox(75, 3.6, 12, 3), M.plaster, -7.5, 5.6, 16);
  // end wall facing the lot gets a door (Kitty's entrance is on the walkway behind)
  const signs = ["CLEANERS", "BARBER", "DELICATESSEN", "SHOES", "PHARMACY", "BAKERY", "HARDWARE", "STATIONERY", "BOOKS", "LIQUORS"];
  const awnCols = [0x1d3a2b, 0x4a1c1a, 0x1f2a3c, 0x3d3020];
  const beams = []; // matrices for instanced half-timber
  const beam = (x, y, z, sx, sy, sz, rz = 0) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)), new THREE.Vector3(sx, sy, sz));
    beams.push(m);
  };
  const shopLit = [0.0, 0.35, 0.0, 0.2, 0.0, 0.0, 0.3, 0.0, 0.55, 0.0];
  for (let i = 0; i < nBays; i++) {
    const cx = x0 + bayW * (i + 0.5);
    const zf = 10;
    // shopfront: frame, glass, door, stall riser
    add(new THREE.BoxGeometry(5.6, 2.6, 0.18), M.trim, cx - 0.6, 1.75, zf - 0.02);
    add(new THREE.BoxGeometry(5.6, 0.7, 0.3), M.wood, cx - 0.6, 0.4, zf - 0.08);
    addGlass(cx - 0.6, 1.95, zf - 0.13, 5.2, 2.0, 0, { kind: "shop", level: shopLit[i] });
    add(new THREE.BoxGeometry(1.1, 2.5, 0.12), M.wood, cx + 2.75, 1.4, zf - 0.04);
    add(new THREE.BoxGeometry(0.06, 2.0, 0.06), M.trim, cx - 0.6, 1.95, zf - 0.16);
    // awning (quarter cylinder sloping out from the wall)
    const awGeo = new THREE.CylinderGeometry(1.1, 1.1, 6.6, 20, 1, true, 0, Math.PI / 2);
    awGeo.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0, 0, 0, 1));
    const aw = new THREE.Mesh(awGeo, new THREE.MeshStandardMaterial({ color: awnCols[i % 4], roughness: 0.95, side: THREE.DoubleSide }));
    aw.position.set(cx, 2.85, zf - 0.02); aw.castShadow = true; aw.receiveShadow = true;
    scene.add(aw);
    const st = canvasTex(1024, 64, (g, w, h) => {
      g.fillStyle = "#16120e"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#e9dfc8"; g.font = "bold 46px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(signs[i], w / 2, h / 2 + 3);
    });
    add(new THREE.PlaneGeometry(6.6, 0.4), new THREE.MeshStandardMaterial({ map: st, roughness: 0.8, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.04, side: THREE.DoubleSide }), cx, 2.66, zf - 1.13, Math.PI, false, false);
    // upper floor windows
    for (let k = -1; k <= 1; k++) {
      const wx = cx + k * 2.4, wy = 5.6;
      add(new THREE.BoxGeometry(1.36, 1.76, 0.16), M.wood, wx, wy, zf - 0.05);
      addGlass(wx, wy, zf - 0.145, 1.1, 1.5, 0, { kind: "tudor" });
      add(new THREE.BoxGeometry(0.06, 1.5, 0.05), M.wood, wx, wy, zf - 0.17, 0, false);
      add(new THREE.BoxGeometry(1.1, 0.06, 0.05), M.wood, wx, wy + 0.2, zf - 0.17, 0, false);
      add(new THREE.BoxGeometry(1.5, 0.1, 0.3), M.plaster, wx, wy - 0.93, zf - 0.12, 0, false);
    }
    // half-timber on the upper floor
    for (let p = 0; p <= 6; p++) {
      const px = cx - bayW / 2 + p * (bayW / 6);
      if (Math.abs(px - (cx - 2.4)) < 0.75 || Math.abs(px - cx) < 0.75 || Math.abs(px - (cx + 2.4)) < 0.75) continue;
      beam(px, 5.6, zf - 0.06, 0.18, 3.5, 0.1);
    }
    beam(cx, 3.88, zf - 0.08, bayW, 0.22, 0.14);
    beam(cx, 7.35, zf - 0.08, bayW, 0.2, 0.14);
    beam(cx - 3.2, 5.2, zf - 0.07, 0.14, 2.0, 0.08, 0.6);
    beam(cx + 3.2, 5.2, zf - 0.07, 0.14, 2.0, 0.08, -0.6);
    // gables on alternate bays
    if (i % 2 === 0) {
      const sh = new THREE.Shape();
      sh.moveTo(-bayW / 2, 0); sh.lineTo(bayW / 2, 0); sh.lineTo(0, 3.6); sh.lineTo(-bayW / 2, 0);
      const gg = new THREE.ExtrudeGeometry(sh, { depth: 6.5, bevelEnabled: false });
      add(gg, M.plaster, cx, 7.4, zf + 6.5, Math.PI);
      beam(cx, 9.0, zf - 0.07, 0.16, 3.2, 0.1);
      beam(cx - 1.6, 8.0, zf - 0.07, 0.14, 1.9, 0.08, 1.0);
      beam(cx + 1.6, 8.0, zf - 0.07, 0.14, 1.9, 0.08, -1.0);
      addGlass(cx, 8.25, zf - 0.09, 0.8, 0.9, 0, { kind: "tudor" });
      add(new THREE.BoxGeometry(1.0, 1.1, 0.12), M.wood, cx, 8.25, zf - 0.02, 0, false);
      const slope = Math.hypot(bayW / 2 + 0.4, 3.6 + 0.3);
      const ang = Math.atan2(3.6 + 0.3, bayW / 2 + 0.4);
      for (const s of [-1, 1]) {
        const r = add(tiledBox(slope, 0.18, 7.2, 3), M.slate, cx + s * (bayW / 4), 7.4 + 1.8, zf + 2.9);
        r.rotation.z = -s * ang;
      }
    }
  }
  // main roof
  const rLen = Math.hypot(6.4, 3.4), rAng = Math.atan2(3.4, 6.4);
  for (const s of [-1, 1]) {
    const r = add(tiledBox(76, 0.2, rLen, 3), M.slate, -7.5, 7.4 + 1.7, 16 + s * 3.0);
    r.rotation.x = s * rAng;
  }
  // chimneys
  for (const cx of [-38, -22, -4, 14, 26]) add(tiledBox(0.9, 2.6, 0.9, 1.5), M.brickDark, cx, 10.2, 16.8);
  // instanced timber
  const tim = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.wood, beams.length);
  beams.forEach((m, i) => tim.setMatrixAt(i, m));
  tim.castShadow = true; tim.receiveShadow = true; scene.add(tim);
  // east end wall details + rear walkway door (Kitty's door), rear windows
  add(new THREE.BoxGeometry(1.2, 2.4, 0.14), M.wood, 24.5, 1.2, 22.05);
  add(new THREE.BoxGeometry(1.6, 0.12, 0.8), M.trim, 24.5, 2.6, 22.4);
  for (let k = 0; k < 12; k++) {
    const wx = -40 + k * 6;
    addGlass(wx, 5.6, 22.13, 1.1, 1.4, Math.PI, { kind: "rear" });
    add(new THREE.BoxGeometry(1.3, 1.6, 0.14), M.wood, wx, 5.6, 22.04);
  }

  // ---------------- south side: the Mowbray (the witnesses' building) ----------------
  const mbX = 0, mbW = 50, mbZ = -10, floors = 7, fh = 3.1;
  add(tiledBox(mbW, floors * fh + 0.6, 18, 2.4), M.brick, mbX, (floors * fh + 0.6) / 2, mbZ - 9);
  add(tiledBox(mbW + 0.6, 0.5, 0.6, 2), M.paint, mbX, floors * fh + 0.6, mbZ - 0.1);
  for (let f = 1; f < floors; f++) add(tiledBox(mbW, 0.18, 0.25, 2), M.brickDark, mbX, f * fh, mbZ + 0.02, 0, false);
  const mbCols = 16;
  for (let f = 1; f < floors; f++) for (let c = 0; c < mbCols; c++) {
    const wx = mbX - mbW / 2 + 2.0 + c * ((mbW - 4) / (mbCols - 1));
    const wy = f * fh + 1.55;
    add(new THREE.BoxGeometry(1.3, 1.75, 0.2), M.paint, wx, wy, mbZ + 0.02, 0, false);
    add(new THREE.BoxGeometry(1.45, 0.12, 0.3), M.paint, wx, wy - 0.95, mbZ + 0.05, 0, false);
    addGlass(wx, wy, mbZ + 0.13, 1.1, 1.55, Math.PI, { kind: "mowbray", f, c });
  }
  // lobby
  add(new THREE.BoxGeometry(5, 2.9, 0.2), M.trim, 0, 1.6, mbZ + 0.05);
  addGlass(0, 1.6, mbZ + 0.16, 4.4, 2.5, Math.PI, { kind: "lobby" });
  add(new THREE.BoxGeometry(6, 0.25, 2.4), M.trim, 0, 3.2, mbZ + 1.2);
  // neighbours of the Mowbray
  for (const [x, w, h] of [[-42, 30, 12], [40, 26, 15], [-80, 40, 16], [75, 36, 11]]) {
    add(tiledBox(w, h, 16, 2.4), M.brickDark, x, h / 2, mbZ - 8);
    for (let f = 1; f < h / 3.1 - 1; f++) for (let c = 0; c < w / 3.2; c++) addGlass(x - w / 2 + 1.6 + c * 3.2, f * 3.1 + 1.5, mbZ + 0.02, 1.0, 1.4, Math.PI, { kind: "bg" });
  }
  // west of the Tudor block & behind: background apartments
  for (const [x, z, w, d, h] of [[-75, 16, 50, 12, 14], [-20, 52, 40, 14, 22], [30, 58, 34, 14, 26], [80, 40, 30, 16, 18], [-70, 60, 40, 16, 30]]) {
    add(tiledBox(w, h, d, 2.4), M.brickDark, x, h / 2, z);
    for (let f = 1; f < h / 3.1 - 1; f++) for (let c = 0; c < w / 3.4; c++) addGlass(x - w / 2 + 1.7 + c * 3.4, f * 3.1 + 1.5, z - d / 2 - 0.02, 1.0, 1.4, 0, { kind: "bg" });
  }
  // LIRR station hut + sign at the back of the lot
  add(tiledBox(12, 4.2, 6, 2.4), M.brick, 55, 2.1, 37);
  add(tiledBox(12.6, 0.4, 6.6, 2), M.slate, 55, 4.4, 37);
  const lirr = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = "#0e1a26"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#8aa0b4"; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = "#d8e2ea"; g.textAlign = "center"; g.font = "bold 46px Helvetica, Arial"; g.fillText("LONG ISLAND RAIL ROAD", w / 2, 92);
    g.font = "bold 88px Helvetica, Arial"; g.fillText("KEW GARDENS", w / 2, 196);
  });
  const lirrMat = new THREE.MeshStandardMaterial({ map: lirr, emissive: 0xffffff, emissiveMap: lirr, emissiveIntensity: 0.55, roughness: 0.6 });
  add(new THREE.PlaneGeometry(6, 1.5), lirrMat, 55, 3.2, 33.9, Math.PI);
  add(new THREE.BoxGeometry(0.14, 3.2, 0.14), M.trim, 51.8, 1.6, 33.8);
  add(new THREE.BoxGeometry(0.14, 3.2, 0.14), M.trim, 58.2, 1.6, 33.8);
  addGlass(51, 1.6, 33.95, 1.8, 1.4, Math.PI, { kind: "shop", level: 0.45 });
  // chain fence along the tracks
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.6, metalness: 0.6, transparent: true, opacity: 0.55 });
  add(new THREE.BoxGeometry(34, 1.8, 0.03), fenceMat, 47, 0.9, 40.2, 0, false);
  for (let i = 0; i <= 12; i++) add(new THREE.CylinderGeometry(0.04, 0.04, 2, 6), M.trim, 30 + i * 2.85, 1, 40.2);

  // build instanced glass now that every slot is known
  const glass = new THREE.InstancedMesh(glassGeo, glassMat, glassSlots.length);
  const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  glassSlots.forEach((g, i) => {
    q.setFromEuler(new THREE.Euler(0, g.ry, 0));
    p.set(g.x, g.y, g.z); s.set(g.w, g.h, 1);
    glass.setMatrixAt(i, new THREE.Matrix4().compose(p, q, s));
    glass.setColorAt(i, new THREE.Color(0x05070a));
    g.base = baseGlow(g, R);
  });
  glass.instanceColor.needsUpdate = true;
  scene.add(glass);
  world.glass = glass; world.glassSlots = glassSlots;

  // ---------------- street lamps (positions; model added by film.js) ----------------
  world.lampSpots = [
    [-36, 7.2], [-18, 7.2], [0, 7.2], [19, 7.2], [38.5, 14.5], [52, 27], [-27, -7.2], [-9, -7.2], [9, -7.2], [27, -7.2], [62, -7.2],
  ];

  // ---------------- bare March trees on the south sidewalk ----------------
  const bark = new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 1 });
  const treeGeos = [];
  function branch(pos, dir, len, rad, depth, rr) {
    const end = pos.clone().addScaledVector(dir, len);
    const g = new THREE.CylinderGeometry(rad * 0.7, rad, len, 5, 1, true);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    g.translate(pos.x, pos.y, pos.z);
    treeGeos.push(g);
    if (depth <= 0) return;
    const n = depth > 3 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const nd = dir.clone().add(new THREE.Vector3((rr() - 0.5) * 1.3, 0.35 + rr() * 0.3, (rr() - 0.5) * 1.3)).normalize();
      branch(end, nd, len * (0.62 + rr() * 0.15), rad * 0.62, depth - 1, rr);
    }
  }
  for (const [x, z] of [[-31, -8.6], [-14, -8.6], [4, -8.6], [15, -8.6], [-46, 8.8], [-8, 8.8]]) {
    const rr = rng(Math.floor((x + 100) * 13 + z));
    branch(new THREE.Vector3(x, 0, z), new THREE.Vector3(0, 1, 0), 3.2, 0.22, 5, rr);
  }
  const trees = new THREE.Mesh(mergeGeometries(treeGeos), bark);
  trees.castShadow = true; scene.add(trees);

  // hydrant pad, mailbox, manholes
  const mh = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.4, metalness: 0.7 });
  for (const x of [-20, 6, 28]) add(new THREE.CylinderGeometry(0.4, 0.4, 0.02, 20), mh, x, 0.005, 2.5, 0, false);
  const mbox = new THREE.Group();
  const mbm = new THREE.MeshStandardMaterial({ color: 0x1f3550, roughness: 0.5, metalness: 0.3 });
  const mb1 = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.9, 0.5, 3, 0.08), mbm); mb1.position.y = 0.9; mbox.add(mb1);
  const mb2 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 16, 1, false, 0, Math.PI), mbm); mb2.rotation.z = Math.PI / 2; mb2.rotation.y = Math.PI / 2; mb2.position.y = 1.35; mbox.add(mb2);
  for (const l of [[0.05, 0.45], [-0.05, 0.45]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.4), mbm); leg.position.set(l[0] * 4, 0.225, 0); mbox.add(leg); }
  mbox.position.set(-2.5, 0.15, 6.8); mbox.traverse((o) => { o.castShadow = true; }); scene.add(mbox);

  return world;
}

function baseGlow(g, R) {
  // returns {on, col} default state for each window before any scripted change
  const warm = [new THREE.Color(1.0, 0.62, 0.3), new THREE.Color(1.0, 0.72, 0.42), new THREE.Color(0.9, 0.55, 0.28)];
  if (g.kind === "shop") return { on: g.level * 0.3, col: new THREE.Color(0.75, 0.82, 0.7) };
  if (g.kind === "lobby") return { on: 0.6, col: new THREE.Color(1.0, 0.8, 0.55) };
  if (g.kind === "bg") return { on: R() < 0.07 ? 0.5 + R() * 0.4 : 0, col: warm[Math.floor(R() * 3)] };
  if (g.kind === "tudor" || g.kind === "rear") return { on: R() < 0.08 ? 0.6 : 0, col: warm[Math.floor(R() * 3)] };
  if (g.kind === "mowbray") return { on: R() < 0.05 ? 0.55 : 0, col: warm[Math.floor(R() * 3)] };
  return { on: 0, col: warm[0] };
}

// ---------------- 1960s cars (procedural, profile-extruded) ----------------
// spec: L length, W width, xr/xf wheel centres (along length), belt heights, greenhouse g = [x0,x1,x2,x3] (base rear, roof rear, roof front, base front), roofH
export function makeCar(o) {
  const { L, W, xr, xf, beltR, beltF, g, roofH, color, nose = 0.12, tail = 0.12, fins = 0 } = o;
  const grp = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.12, metalness: 1 });
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0x0b1018, roughness: 0.03, metalness: 0.55, transparent: true, opacity: 0.72, clearcoat: 1, envMapIntensity: 2.2, side: THREE.DoubleSide });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.9 });
  const toZ = (geo, width) => { geo.translate(0, 0, -width / 2); geo.rotateY(-Math.PI / 2); return geo; };
  // lower body with wheel arches
  const r = 0.37, by = 0.27;
  const sh = new THREE.Shape();
  sh.moveTo(-L / 2 + tail, by);
  sh.lineTo(xr - r - 0.02, by); sh.absarc(xr, by, r + 0.02, Math.PI, 0, true);
  sh.lineTo(xf - r - 0.02, by); sh.absarc(xf, by, r + 0.02, Math.PI, 0, true);
  sh.lineTo(L / 2 - nose, by);
  sh.quadraticCurveTo(L / 2 + 0.02, by + 0.05, L / 2, (by + beltF) * 0.55);
  sh.quadraticCurveTo(L / 2 - 0.02, beltF - 0.02, L / 2 - nose * 2.2, beltF);
  sh.lineTo(g[3], beltF + 0.02);
  sh.lineTo(g[0], beltR + 0.02 + fins * 0.3);
  sh.lineTo(-L / 2 + tail * 2.2, beltR + fins);
  sh.quadraticCurveTo(-L / 2 - 0.02, beltR - 0.02, -L / 2, (by + beltR) * 0.55);
  sh.quadraticCurveTo(-L / 2 - 0.02, by + 0.05, -L / 2 + tail, by);
  const bw = W - 0.16;
  const body = new THREE.Mesh(toZ(new THREE.ExtrudeGeometry(sh, { depth: bw, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 5, curveSegments: 18 }), bw), paint);
  grp.add(body);
  // greenhouse (glass) + roof cap + pillars
  const gs = new THREE.Shape();
  const base = Math.max(beltR, beltF) + 0.015;
  gs.moveTo(g[0], base); gs.lineTo(g[1], roofH - 0.04); gs.lineTo(g[2], roofH - 0.04); gs.lineTo(g[3], base); gs.lineTo(g[0], base);
  const gw = W - 0.36;
  grp.add(new THREE.Mesh(toZ(new THREE.ExtrudeGeometry(gs, { depth: gw, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 }), gw), glassM));
  const rs = new THREE.Shape();
  rs.moveTo(g[1] - 0.03, roofH - 0.06); rs.lineTo(g[2] + 0.03, roofH - 0.06); rs.lineTo(g[2] - 0.02, roofH + 0.01); rs.lineTo(g[1] + 0.02, roofH + 0.01);
  const rw = W - 0.3;
  grp.add(new THREE.Mesh(toZ(new THREE.ExtrudeGeometry(rs, { depth: rw, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 4 }), rw), paint));
  const pillar = (x0, x1) => {
    const len = Math.hypot(x1 - x0, roofH - base), ang = Math.atan2(roofH - base, x1 - x0);
    for (const sz of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.07), paint);
      m.position.set(sz * (gw / 2 + 0.03), (base + roofH) / 2, (x0 + x1) / 2);
      m.rotation.set(0, 0, 0); m.rotation.x = 0;
      // orient along the profile edge in the (z,y) plane
      m.rotation.order = "YXZ"; m.rotation.y = -Math.PI / 2; m.rotation.z = ang;
      grp.add(m);
    }
  };
  pillar(g[3], g[2]); pillar(g[0], g[1]);
  const bpil = (g[1] + g[2]) / 2;
  for (const sz of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, roofH - base, 0.1), paint); m.position.set(sz * (gw / 2 + 0.03), (base + roofH) / 2, bpil); grp.add(m); }
  // bumpers
  for (const [z, s] of [[L / 2 + 0.03, 1], [-L / 2 - 0.03, -1]]) {
    const bm = new THREE.Mesh(new RoundedBoxGeometry(W * 0.98, 0.1, 0.12, 2, 0.04), chrome);
    bm.position.set(0, by + 0.12, z); grp.add(bm);
  }
  // wheels
  const wheels = [];
  for (const sx of [-1, 1]) for (const zc of [xr, xf]) {
    const w = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.19, 24), tyre); t.rotation.z = Math.PI / 2; w.add(t);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.2, 18), chrome); hub.rotation.z = Math.PI / 2; w.add(hub);
    w.position.set(sx * (W / 2 - 0.12), 0.31, zc); grp.add(w); wheels.push(w);
  }
  // lights
  const headM = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xfff1d6, emissiveIntensity: 0, roughness: 0.2 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2010, emissiveIntensity: 0 });
  const hy = (by + beltF) * 0.62;
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), headM); hl.scale.z = 0.5; hl.position.set(sx * W * 0.34, hy, L / 2 - 0.02); grp.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.05), tailM); tl.position.set(sx * W * 0.36, (by + beltR) * 0.62, -L / 2 - 0.01); grp.add(tl);
  }
  // driver door panel (left = +x), hinged at its front edge
  const dz0 = g[3] - 0.05, dz1 = (g[0] + g[1]) / 2 + 0.1;
  const doorPivot = new THREE.Group();
  doorPivot.position.set(W / 2 + 0.005, 0, dz0);
  const dl = dz0 - dz1;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, base - by - 0.1, dl), paint);
  door.position.set(0, (base + by) / 2 + 0.03, -dl / 2);
  const dwin = new THREE.Mesh(new THREE.BoxGeometry(0.02, roofH - base - 0.1, dl * 0.85), glassM);
  dwin.position.set(-0.02, (base + roofH) / 2, -dl / 2);
  doorPivot.add(door, dwin); grp.add(doorPivot);
  grp.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const beams = [];
  for (const sx of [-1, 1]) {
    const sp = new THREE.SpotLight(0xfff0d0, 0, 45, 0.42, 0.55, 1.6);
    sp.position.set(sx * W * 0.34, hy, L / 2 + 0.35);
    sp.target.position.set(sx * W * 0.34, 0.0, L / 2 + 14);
    grp.add(sp, sp.target); beams.push(sp);
  }
  return { group: grp, wheels, headM, tailM, beams, doorPivot, paint };
}
