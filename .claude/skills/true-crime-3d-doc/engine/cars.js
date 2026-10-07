// Sculpted 1960s cars: lofted superellipse body + greenhouse, chrome trim, whitewalls, interiors.
// Car-local axes: +z forward, +x = driver (left) side, +y up. Units metres.
import * as THREE from "three";

const sgn = (v) => (v < 0 ? -1 : 1);
const se = (c, n) => sgn(c) * Math.pow(Math.abs(c), 2 / n);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function loft(N, M, fn, closeEnds = true) {
  // fn(i/N-1, j/M) -> [x,y,z]
  const pos = [], idx = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) pos.push(...fn(i / (N - 1), j / M));
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + ((j + 1) % M), c = (i + 1) * M + j, d = (i + 1) * M + ((j + 1) % M);
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function plateTex(text) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#e8a23a"; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = "#111"; g.lineWidth = 6; g.strokeRect(6, 6, 244, 116);
  g.fillStyle = "#111"; g.font = "bold 62px Helvetica, Arial"; g.textAlign = "center"; g.fillText(text, 128, 90);
  g.font = "bold 18px Helvetica, Arial"; g.fillText("NEW YORK", 128, 30);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makeCar(spec) {
  const S = Object.assign({
    L: 4.6, W: 1.8, by: 0.24, belt: 0.86, hoodF: 0.84, deckR: 0.86, roofH: 1.38,
    plan: 6, sec: 4.5, tumble: 0.07, g: [-1.2, -0.8, 0.5, 0.95], wheelZ: [-1.4, 1.4], wheelR: 0.33,
    color: 0x888888, roofColor: null, grille: true, quad: false, fins: 0, beltChrome: false, plate: "4K 1964",
    noseDrop: 0.18, tailDrop: 0.14, whitewall: true, headY: null, headX: 0.33, roundHead: true,
  }, spec);
  const { L, W, by } = S;
  const grp = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: S.color, roughness: 0.32, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.4 });
  const roofPaint = S.roofColor ? paint.clone() : paint; if (S.roofColor) roofPaint.color.set(S.roofColor);
  const chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 1, envMapIntensity: 1.8 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0d1218, roughness: 0.02, metalness: 0.3, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 2.2, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.8 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.9 });
  const seatM = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.7 });

  // ---- body profile functions (u in [-1,1] along length)
  const halfW = (u) => (W / 2) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), S.plan)), 1 / S.plan);
  const archLift = (z) => {
    let lift = 0;
    for (const wz of S.wheelZ) { const d = Math.abs(z - wz), r = S.wheelR + 0.05; if (d < r) lift = Math.max(lift, Math.sqrt(r * r - d * d) * 0.85 + (S.wheelR - by) * 0.6); }
    return lift;
  };
  const top = (u) => {
    // hood (front) / belt / deck (rear) heights, rounding down at the ends
    const mid = S.belt;
    let h = u > 0 ? mid + (S.hoodF - mid) * sstep(0.25, 0.75, u) : mid + (S.deckR - mid) * sstep(0.25, 0.75, -u);
    if (u > 0) h -= S.noseDrop * Math.pow(sstep(0.7, 1.0, u), 2);
    else h -= S.tailDrop * Math.pow(sstep(0.7, 1.0, -u), 2);
    return h;
  };
  const NB = 90, MB = 56;
  const body = loft(NB, MB, (s, t) => {
    const u = -1 + 2 * s, z = u * L / 2;
    const hw = Math.max(0.004, halfW(u * 0.995));
    const yb = by + archLift(z) * (1 - sstep(0.85, 1, Math.abs(u)));
    const yt = Math.max(yb + 0.05, top(u));
    const th = t * Math.PI * 2;
    const c = Math.cos(th), sn = Math.sin(th);
    let x = hw * se(c, S.sec);
    const y = (yb + yt) / 2 + ((yt - yb) / 2) * se(sn, S.sec);
    x *= 1 - S.tumble * Math.max(0, sn);
    return [x, y, z];
  });
  const bodyMesh = new THREE.Mesh(body, paint);
  grp.add(bodyMesh);
  // dark underbody + wheel wells so the arch gaps read as wells
  const under = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.3, L * 0.9), dark); under.position.y = by + 0.18; grp.add(under);

  // ---- greenhouse
  const [g0, g1, g2, g3] = S.g;
  const beltAt = (z) => top(z / (L / 2)) - 0.005;
  const roofAt = (z) => {
    if (z < g1) return beltAt(z) + (S.roofH - beltAt(z)) * sstep(g0, g1, z) ** 0.8;
    if (z > g2) return beltAt(z) + (S.roofH - beltAt(z)) * (1 - sstep(g2, g3, z)) ** 0.8;
    return S.roofH;
  };
  const NG = 60, MG = 48;
  const gw = (z) => halfW(z / (L / 2)) * 0.9;
  const ghFn = (scale) => (s, t) => {
    const z = g0 + (g3 - g0) * s;
    const yb = beltAt(z), yt = Math.max(yb + 0.002, roofAt(z));
    const th = t * Math.PI; // only upper half (sides + roof)
    const c = Math.cos(th), sn = Math.sin(th);
    const hw = gw(z) * scale * (1 - 0.2 * sn);
    return [hw * se(c, 3.2), yb + (yt - yb) * se(sn, 3.2) * scale, z];
  };
  const gh = loft(NG, MG + 1, (s, t) => ghFn(1)(s, Math.min(1, t * (MG + 1) / MG)));
  grp.add(new THREE.Mesh(gh, glass));
  // painted roof skin over the flat part
  const roof = loft(30, 24, (s, t) => {
    const z = g1 - 0.06 + (g2 - g1 + 0.12) * s;
    const th = Math.PI * (0.22 + 0.56 * t);
    const yb = beltAt(z), yt = roofAt(z);
    const c = Math.cos(th), sn = Math.sin(th);
    const hw = gw(z) * 1.012 * (1 - 0.2 * sn);
    return [hw * se(c, 3.2), yb + (yt - yb) * se(sn, 3.2) + 0.012, z];
  });
  grp.add(new THREE.Mesh(roof, roofPaint));
  // pillars
  const pillar = (zA, zB, th, r) => {
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const z = zA + (zB - zA) * (k / 16);
      const yb = beltAt(z), yt = roofAt(z);
      const c = Math.cos(th), sn = Math.sin(th);
      const hw = gw(z) * 1.01 * (1 - 0.2 * sn);
      pts.push(new THREE.Vector3(hw * se(c, 3.2), yb + (yt - yb) * se(sn, 3.2), z));
    }
    return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 8), roofPaint);
  };
  for (const side of [0.12, 0.88]) {
    const th = Math.PI * side;
    grp.add(pillar(g0 + 0.05, g1 - 0.02, th, 0.03)); // C (thin, follows the glass)
  }
  // window sills / greenhouse frame (chrome) along both sides
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 30; k++) { const z = g0 + (g3 - g0) * (k / 30); pts.push(new THREE.Vector3(sx * gw(z) * 1.0, beltAt(z) + 0.012, z)); }
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.012, 6), chrome));
    // B pillar
    const zb = (g1 + g2) / 2 - 0.1;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, S.roofH - beltAt(zb) - 0.02, 0.07), roofPaint);
    b.position.set(sx * gw(zb) * 0.86, (S.roofH + beltAt(zb)) / 2, zb); b.rotation.z = sx * 0.12; grp.add(b);
  }

  // ---- side chrome strip + door seams + handles
  const sideX = (u, y) => {
    const z = u * L / 2, yb = by + archLift(z) * (1 - sstep(0.85, 1, Math.abs(u))), yt = Math.max(yb + 0.05, top(u));
    const v = clamp((2 * (y - (yb + yt) / 2)) / (yt - yb), -0.999, 0.999);
    const sn = sgn(v) * Math.pow(Math.abs(v), S.sec / 2);
    const c = Math.sqrt(Math.max(0, 1 - sn * sn));
    return Math.max(0.004, halfW(u * 0.995)) * Math.pow(c, 2 / S.sec) * (1 - S.tumble * Math.max(0, sn)) + 0.004;
  };
  const stripY = S.beltChrome ? S.belt - 0.06 : (by + S.belt) / 2 + 0.05;
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 40; k++) { const u = -0.9 + 1.8 * (k / 40); pts.push(new THREE.Vector3(sx * sideX(u, stripY), stripY, u * L / 2)); }
    const strip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, S.beltChrome ? 0.016 : 0.009, 6), chrome);
    grp.add(strip);
    for (const zz of [g3 - 0.08, (g1 + g2) / 2 - 0.12]) {
      const u = zz / (L / 2);
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.006, S.belt - by - 0.14, 0.008), dark);
      seam.position.set(sx * (sideX(u, (by + S.belt) / 2) + 0.001), (by + S.belt) / 2 + 0.02, zz); grp.add(seam);
    }
    const hz = (g1 + g2) / 2 - 0.22, hu = hz / (L / 2);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.14), chrome);
    handle.position.set(sx * (sideX(hu, S.belt - 0.08) + 0.008), S.belt - 0.08, hz); grp.add(handle);
  }
  // fins (late-50s sedans)
  if (S.fins > 0) for (const sx of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(1.25, 0); sh.quadraticCurveTo(1.32, S.fins * 0.6, 1.3, S.fins); sh.lineTo(0, 0);
    const fg = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 });
    fg.translate(0, 0, -0.02); fg.rotateY(Math.PI / 2); // shape x -> -z
    const fin = new THREE.Mesh(fg, paint);
    fin.position.set(sx * (sideX(-0.8, S.deckR - 0.02) - 0.05), S.deckR - 0.03, -L / 2 + 1.35);
    fin.scale.z = 1; grp.add(fin);
  }
  // ---- bumpers (wrap around the ends)
  for (const end of [1, -1]) {
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const a = -1 + 2 * (k / 24);
      const u = end * (1 - 0.12 * (1 - Math.abs(a) ** 2.5));
      const x = a * (W / 2 + 0.02);
      const z = end * (L / 2 + 0.06) - end * 0.25 * Math.pow(Math.abs(a), 6);
      pts.push(new THREE.Vector3(x, by + 0.14, z));
    }
    const bm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.07, 10), chrome);
    bm.scale.y = 0.9; grp.add(bm);
    // plate
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.16), new THREE.MeshStandardMaterial({ map: plateTex(S.plate), roughness: 0.6 }));
    pl.position.set(0, by + 0.3, end * (L / 2 + 0.03)); if (end < 0) pl.rotation.y = Math.PI; grp.add(pl);
  }
  // ---- grille
  if (S.grille) {
    const gW = W * 0.62, gH = 0.2, gz = L / 2 - 0.005, gy = by + 0.36;
    const gb = new THREE.Mesh(new THREE.BoxGeometry(gW, gH, 0.04), dark); gb.position.set(0, gy, gz - 0.03); grp.add(gb);
    for (let k = 0; k < 5; k++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(gW, 0.014, 0.03), chrome); bar.position.set(0, gy - gH / 2 + 0.02 + k * (gH - 0.04) / 4, gz); grp.add(bar); }
    for (const [w, h, x, y] of [[gW + 0.03, 0.022, 0, gy + gH / 2], [gW + 0.03, 0.022, 0, gy - gH / 2], [0.022, gH, -gW / 2, gy], [0.022, gH, gW / 2, gy]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), chrome); f.position.set(x, y, gz + 0.005); grp.add(f);
    }
  } else {
    // Fiat/Corvair style: a chrome bar / moustache across the nose
    const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, W * 0.55, 4, 8), chrome); bar.rotation.z = Math.PI / 2; bar.position.set(0, (S.headY ?? by + 0.42), L / 2 - 0.02); grp.add(bar);
  }
  // ---- head / tail lights
  const headM = new THREE.MeshStandardMaterial({ color: 0x777777, emissive: 0xfff1d6, emissiveIntensity: 0, roughness: 0.15, metalness: 0.4 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0x400404, emissive: 0xff2010, emissiveIntensity: 0, roughness: 0.3 });
  const hy = S.headY ?? by + 0.42;
  const heads = S.quad ? [-0.36, -0.25, 0.25, 0.36] : [-S.headX, S.headX];
  for (const hx of heads) {
    const x = hx * W, z = L / 2 - 0.02 - (S.plan < 4 ? 0.12 : 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(S.quad ? 0.075 : 0.09, 0.016, 8, 24), chrome); ring.position.set(x, hy, z); grp.add(ring);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(S.quad ? 0.072 : 0.087, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), headM);
    lens.rotation.x = Math.PI / 2; lens.scale.y = 0.35; lens.position.set(x, hy, z - 0.005); grp.add(lens);
  }
  for (const sx of [-1, 1]) {
    const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 20), tailM); tl.rotation.x = Math.PI / 2;
    tl.position.set(sx * W * 0.38, S.deckR - 0.12, -L / 2 + 0.03); grp.add(tl);
    const tr = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.01, 6, 20), chrome); tr.position.copy(tl.position).add(new THREE.Vector3(0, 0, -0.02)); grp.add(tr);
  }
  // ---- wheels: tyre (lathe), whitewall, hubcap
  const tyreProf = [];
  const R = S.wheelR, Wt = 0.2;
  for (let k = 0; k <= 16; k++) { const a = -Math.PI / 2 + Math.PI * (k / 16); tyreProf.push(new THREE.Vector2(R - 0.13 + 0.13 * Math.pow(Math.cos(a), 0.6), (Wt / 2) * Math.sin(a))); }
  const tyreGeo = new THREE.LatheGeometry(tyreProf, 36); tyreGeo.rotateZ(Math.PI / 2);
  const wwGeo = new THREE.RingGeometry(R * 0.66, R * 0.78, 36); wwGeo.rotateY(Math.PI / 2);
  const capProf = []; for (let k = 0; k <= 10; k++) { const r = R * 0.64 * (1 - k / 10); capProf.push(new THREE.Vector2(r, 0.03 * Math.cos((k / 10) * Math.PI / 2) + 0.005)); }
  const capGeo = new THREE.LatheGeometry(capProf.reverse(), 32); capGeo.rotateZ(-Math.PI / 2);
  const wwM = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.7 });
  const wheels = [];
  for (const sx of [-1, 1]) for (const wz of S.wheelZ) {
    const w = new THREE.Group();
    w.add(new THREE.Mesh(tyreGeo, rubber));
    if (S.whitewall) { const ww = new THREE.Mesh(wwGeo, wwM); ww.position.x = sx * (Wt / 2 + 0.002); if (sx < 0) ww.rotation.y = Math.PI; w.add(ww); }
    const cap = new THREE.Mesh(capGeo, chrome); cap.position.x = sx * (Wt / 2 - 0.02); if (sx < 0) cap.rotation.y = Math.PI; w.add(cap);
    w.position.set(sx * (W / 2 - 0.13), R, wz); grp.add(w); wheels.push(w);
  }
  // ---- interior (seen through glass)
  const zMid = (g1 + g2) / 2;
  for (const zz of [zMid + 0.15, zMid - 0.55]) {
    if (zz < g0 + 0.1) continue;
    const sw = gw(zz) * 1.55;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.12, 0.5), seatM); seat.position.set(0, by + 0.32, zz); grp.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.5, 0.1), seatM); back.position.set(0, by + 0.6, zz - 0.25); back.rotation.x = -0.15; grp.add(back);
  }
  const dash = new THREE.Mesh(new THREE.BoxGeometry(gw(g3 - 0.25) * 1.6, 0.14, 0.3), dark); dash.position.set(0, S.belt - 0.12, g3 - 0.25); grp.add(dash);
  const wheelS = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.014, 8, 28), new THREE.MeshStandardMaterial({ color: 0xd9d2c0, roughness: 0.4 }));
  wheelS.position.set(W * 0.22, S.belt + 0.02, g3 - 0.38); wheelS.rotation.x = -0.5; grp.add(wheelS);
  // mirror
  const mir = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), chrome); mir.scale.set(0.6, 0.6, 1); mir.position.set(gw(g3) + 0.06, S.belt + 0.05, g3 - 0.1); grp.add(mir);

  // ---- driver door (+x), hinged at its front edge: a painted panel overlay
  const dz0 = g3 - 0.08, dz1 = (g1 + g2) / 2 - 0.12;
  const doorPivot = new THREE.Group();
  const du = ((dz0 + dz1) / 2) / (L / 2);
  const dx = sideX(du, (by + S.belt) / 2);
  doorPivot.position.set(dx + 0.01, 0, dz0);
  const dl = dz0 - dz1;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, S.belt - by - 0.16, dl), paint);
  door.position.set(-0.02, (by + S.belt) / 2 + 0.03, -dl / 2);
  door.visible = false; // only shown when the door opens (the body already shows the closed door)
  const dwin = new THREE.Mesh(new THREE.BoxGeometry(0.02, S.roofH - S.belt - 0.12, dl * 0.85), glass);
  dwin.position.set(-0.04, (S.belt + S.roofH) / 2 - 0.02, -dl / 2); dwin.visible = false;
  doorPivot.add(door, dwin); grp.add(doorPivot);
  doorPivot.userData.panels = [door, dwin];

  grp.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const beams = [];
  for (const sx of [-1, 1]) {
    const sp = new THREE.SpotLight(0xfff0d0, 0, 45, 0.42, 0.55, 1.6);
    sp.position.set(sx * S.headX * W, hy, L / 2 + 0.35);
    sp.target.position.set(sx * S.headX * W, 0.0, L / 2 + 14);
    grp.add(sp, sp.target); beams.push(sp);
  }
  return { group: grp, wheels, headM, tailM, beams, doorPivot, paint, spec: S };
}

export const CARS = {
  fiat600: { L: 3.22, W: 1.38, by: 0.2, belt: 0.82, hoodF: 0.7, deckR: 0.8, roofH: 1.4, plan: 2.6, sec: 3.0, tumble: 0.12, g: [-1.12, -0.78, 0.22, 0.66], wheelZ: [-1.0, 1.0], wheelR: 0.27, color: 0x8a1410, grille: false, headY: 0.62, headX: 0.33, noseDrop: 0.22, tailDrop: 0.25, whitewall: false, plate: "6Y 2241" },
  corvair: { L: 4.57, W: 1.7, by: 0.22, belt: 0.82, hoodF: 0.8, deckR: 0.82, roofH: 1.33, plan: 7, sec: 5, tumble: 0.06, g: [-1.25, -0.75, 0.45, 0.95], wheelZ: [-1.35, 1.35], wheelR: 0.32, color: 0xdcd8cc, grille: false, beltChrome: true, headY: 0.6, headX: 0.34, noseDrop: 0.12, tailDrop: 0.1, plate: "1K 7708" },
  sedan: { L: 5.25, W: 1.98, by: 0.24, belt: 0.9, hoodF: 0.9, deckR: 0.94, roofH: 1.42, plan: 8, sec: 5, tumble: 0.05, g: [-1.35, -0.85, 0.55, 1.1], wheelZ: [-1.55, 1.55], wheelR: 0.34, grille: true, quad: true, fins: 0.09, noseDrop: 0.1, tailDrop: 0.06 },
  coupe: { L: 4.9, W: 1.9, by: 0.24, belt: 0.88, hoodF: 0.86, deckR: 0.88, roofH: 1.38, plan: 7, sec: 5, tumble: 0.06, g: [-1.1, -0.7, 0.35, 0.95], wheelZ: [-1.45, 1.45], wheelR: 0.33, grille: true, noseDrop: 0.12, tailDrop: 0.1 },
};
