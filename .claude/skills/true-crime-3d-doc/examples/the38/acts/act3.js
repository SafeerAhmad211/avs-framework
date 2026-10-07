// Chapter III — THE HUNT (black & white)
import { THREE, createStage, run, only, buildStreet, captureEnv, makeCar, CARS, makePerson, makePath, carAt, pose, walker, sm, ease, lerp, V, lerpV, shake, dist } from "./stage.js";
import { loadPeople } from "./people.js";
import { interrogationSet } from "./sets.js";
import { createOverlay } from "./ov.js";

const ACTS = await (await fetch("assets/acts.json")).json();
const A = ACTS.a3, C = A.cues.map((c) => c.s), DUR = A.dur;
const ov = createOverlay(DUR);
ov.chapter("CHAPTER THREE", "THE HUNT", 0.6, 4.6);
ov.stamp("CORONA, QUEENS · FIVE DAYS LATER", C[0] + 0.5, C[1] + 2, {});
ov.lower("RAOUL CLEARY", "Resident, Corona, Queens", C[0] + 5.5, C[0] + 11);
ov.lower("JACK BROWN", "Neighbor", C[1] + 6.2, C[1] + 10.4);
ov.label("ANNIE MAE JOHNSON", C[3] + 7.4, C[4] - 0.4, 1240, 380);
ov.label("BARBARA KRALIK", C[3] + 9.0, C[4] - 0.4, 1240, 440);
ov.lower("WINSTON MOSELEY", "29 · Business-machine operator", C[4] + 0.6, C[4] + 7);

const st = createStage();
const S = {};
run(st, async () => {
  S.street = await buildStreet(st);
  S.int = interrogationSet(st.scene);
  st.sets = { int: S.int };
  const lib = await loadPeople(["Male_Adult_12", "Male_Adult_03", "Male_Adult_02", "Business_Male_02", "Business_Male_03"]);
  const mk = (n, k, h) => makePerson(st.scene, lib, n, k, h, 0);
  S.M = mk("Male_Adult_12", "m", 1.78); S.Cl = mk("Male_Adult_03", "m", 1.76); S.JB = mk("Male_Adult_02", "m", 1.8);
  S.D1 = mk("Business_Male_02", "m", 1.82); S.D2 = mk("Business_Male_03", "m", 1.8);
  S.corv = makeCar(CARS.corvair); S.police = makeCar({ ...CARS.sedan, color: 0x1f4a32, roofColor: 0xe8e6de, plate: "NYPD 117" });
  st.scene.add(S.corv.group, S.police.group);
  for (const car of [S.corv, S.police]) car.beams.forEach((b) => (b.intensity = 0));
  S.corv.group.position.set(-22, 0, 3.6); S.corv.group.rotation.y = -Math.PI / 2;
  S.tv = new THREE.Group(); st.scene.add(S.tv);
  const tvb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.42), new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.5 })); S.tv.add(tvb);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.3), new THREE.MeshStandardMaterial({ color: 0x1a1e1c, roughness: 0.1, metalness: 0.3 })); scr.position.set(-0.04, 0.02, 0.215); S.tv.add(scr);
  S.pPolice = makePath([[-70, 1.6], [-32, 1.6], [-28.5, 2.8]]);
  S.street.setDay(true);
  captureEnv(st, V(-20, 1.5, 0), [S.M, S.Cl, S.JB, S.D1, S.D2].map((c) => c.holder).concat([S.corv.group, S.police.group]));
}, frame);

function hideAll() { for (const k of ["M", "Cl", "JB", "D1", "D2"]) S[k].holder.visible = false; }
const put = (c, x, y, z, ry) => { c.holder.position.set(x, y, z); c.holder.rotation.y = ry; c.holder.visible = true; };

function frame(t) {
  hideAll();
  const inside = t >= C[3] - 0.4;
  S.street.show(!inside); only(st, inside ? "int" : "");
  S.police.group.visible = t > C[2] - 1.0 && !inside;
  S.tv.visible = !inside && t > C[0] - 0.5;
  const fade = (1 - sm(0, 1.0, t)) + sm(DUR - 1.6, DUR - 0.2, t);
  if (t < C[0] - 0.5) { // chapter card: daylight street, B&W
    const pos = lerpV(V(-6, 4.0, -4.5), V(-10, 3.4, -4.0), t / 5);
    return { pos, look: V(-24, 1.5, 6), fov: 40, focus: 15, ap: 0.0008, bw: 1, exposure: 1.3, fade: fade * 0.9 + 0.35 * (1 - sm(3.5, 4.4, t)) };
  }
  if (t < C[1] - 0.4) { // he carries a TV out; Cleary watches
    const tt = t - C[0] + 0.5;
    put(S.Cl, -17.5, 0.15, -7.2, -0.9); pose(S.Cl, { look: [1, 1 + tt * 0.6] });
    const p = makeWalk(tt);
    put(S.M, p.x, 0.15, p.z, p.yaw); pose(S.M, p.walking ? { walk: [1, p.d / 1.3] } : { hold: [1, 1 + tt * 0.6] });
    placeTV();
    const pos = V(-16.0, 1.62, -8.6).add(shake(t, 0.01));
    const look = lerpV(V(-21, 1.2, 6), S.M.holder.position.clone().add(V(0, 1.2, 0)), 0.6);
    return { pos, look, fov: 30, focus: pos.distanceTo(S.M.holder.position), ap: 0.0025, bw: 1, exposure: 1.3 };
  }
  if (t < C[2] - 0.4) { // the conversation; Jack Brown disables the car
    const tt = t - C[1] + 0.4;
    put(S.M, -20.6, 0.15, 6.0, -2.2); pose(S.M, { hold: [1, 3 + tt * 0.6] }); placeTV();
    put(S.Cl, -21.6, 0.15, 4.9, 0.9); pose(S.Cl, { idle: [1, 2 + tt * 0.7] });
    put(S.JB, -24.2, 0.15, 2.6, Math.PI / 2); pose(S.JB, { crouch: [1, 1 + tt * 0.4] });
    if (tt < 5.2) { const pos = V(-18.2, 1.55, 3.2).add(shake(t, 0.01)); return { pos, look: V(-21.1, 1.45, 5.4), fov: 32, focus: 3.2, ap: 0.003, bw: 1, exposure: 1.3 }; }
    const pos = V(-25.6, 0.55, 0.9).add(shake(t, 0.008));
    return { pos, look: V(-24.1, 0.55, 2.8), fov: 34, focus: 2.2, ap: 0.004, bw: 1, exposure: 1.3 };
  }
  if (t < C[3] - 0.4) { // the police arrive
    const tt = t - C[2] + 0.4;
    put(S.M, -20.6, 0.15, 6.0, -2.6); pose(S.M, { idle: [1, 2 + tt] });
    S.tv.position.set(-20.2, 0.38, 6.6); S.tv.rotation.set(0, 0.3, 0);
    put(S.Cl, -21.6, 0.15, 4.9, 0.9); pose(S.Cl, { idle: [1, 5 + tt] });
    carAt(S.police, S.pPolice, Math.min(S.pPolice.len, S.pPolice.len - Math.max(0, 3.2 - tt) ** 2 * 1.8));
    if (tt > 3.0) { put(S.D1, -27.2 + (tt - 3) * 1.1, 0.15, 4.4, Math.PI / 2 - 0.3); pose(S.D1, { walk: [1, (tt - 3) * 0.85] }); }
    const pos = V(-15.5, 1.3, 1.0).add(shake(t, 0.012));
    return { pos, look: V(-24, 1.0, 4), fov: 36, focus: 8, ap: 0.0015, bw: 1, exposure: 1.3 };
  }
  // ---- the interrogation room ----
  const tt = t - C[3] + 0.4;
  const b = S.int;
  const at = (c, x, y, z, ry) => { c.holder.position.copy(b.world(x, y, z)); c.holder.rotation.y = ry; c.holder.visible = true; };
  at(S.M, 0, -0.02, 0.62, Math.PI); pose(S.M, { sitTable: [1, 2 + tt * 0.7] });
  at(S.D2, 0, -0.02, -0.62, 0); pose(S.D2, { sitTable2: [1, 1 + tt * 0.6] });
  at(S.D1, 1.4, 0, -1.2, -0.7); pose(S.D1, { idle: [1, 3 + tt * 0.6] });
  const sw = Math.sin(tt * 0.9) * 0.05;
  b.shade.position.x = sw; b.bulbM.position.x = sw; b.cord.rotation.z = sw * 0.5;
  const ang = 2.2 + tt * 0.045;
  const r = 2.6 - Math.min(tt, 20) * 0.03;
  const pos = b.world(Math.cos(ang) * r, 1.55 + Math.sin(tt * 0.2) * 0.05, Math.sin(ang) * r);
  const look = b.world(0, 1.1, 0.4);
  return { pos, look, fov: 34, focus: pos.distanceTo(S.M.holder.position) - 0.2, ap: 0.003, bw: 1, exposure: 1.15, fade: fade + (1 - sm(C[3] - 0.4, C[3] + 0.4, t)) };
}

let walkCache = null;
function makeWalk(tt) {
  if (!walkCache) walkCache = makePath([[-19.5, 10.4], [-19.8, 8.0], [-20.4, 6.3]]);
  const d = dist(tt - 1.0, 1.1, 0.6), s = walkCache.at(d);
  return { x: s.p.x, z: s.p.z, yaw: s.yaw, d, walking: d < walkCache.len - 0.05 && tt > 1.0 };
}
function placeTV() {
  const h = S.M.holder;
  const f = V(Math.sin(h.rotation.y), 0, Math.cos(h.rotation.y));
  S.tv.position.copy(h.position).addScaledVector(f, 0.42).add(V(0, 1.05, 0));
  S.tv.rotation.set(0, h.rotation.y, 0);
}
