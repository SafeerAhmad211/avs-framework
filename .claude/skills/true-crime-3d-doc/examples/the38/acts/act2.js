// Chapter II — THE NIGHT
import { THREE, createStage, run, only, buildStreet, captureEnv, makeCar, CARS, makePerson, makePath, carAt, pose, walker, sm, ease, lerp, V, lerpV, shake, dist, coneMat } from "./stage.js";
import { loadPeople } from "./people.js";
import { windowRoomSet, vestibuleSet, apartmentSet } from "./sets.js";
import { createOverlay } from "./ov.js";

const ACTS = await (await fetch("assets/acts.json")).json();
const A = ACTS.a2, C = A.cues.map((c) => c.s), DUR = A.dur;
const ov = createOverlay(DUR);
ov.chapter("CHAPTER TWO", "THE NIGHT", 0.6, 4.4);
ov.lower("ROBERT MOZER", "Resident, the Mowbray apartments", C[0] + 3, C[0] + 8.3);
ov.quote("“Let that girl alone!”", "", C[1] + 0.1, C[2] - 0.2);
ov.stamp("3:19 A.M.", C[3] + 0.4, C[3] + 6, {});
ov.stamp("APPROX. 3:30 A.M.", C[5] + 0.3, C[6] + 4, {});
ov.lower("KARL ROSS", "Neighbor", C[8] + 2.5, C[8] + 7.4);
ov.quote("“I didn't want to get involved.”", "KARL ROSS", C[9] + 4.6, C[10] - 0.4);
ov.lower("SOPHIA FARRAR", "Neighbor", C[10] + 4.5, C[10] + 11.2);
ov.stamp("3:50 A.M.", C[11] + 0.4, C[12] - 0.4, {});

const st = createStage();
const S = {};
run(st, async () => {
  S.street = await buildStreet(st);
  S.room = windowRoomSet(st.scene);
  S.vest = vestibuleSet(st.scene);
  S.apt = apartmentSet(st.scene);
  st.sets = { room: S.room, vest: S.vest, apt: S.apt };
  const lib = await loadPeople(["Business_Female_03", "Male_Adult_12", "Male_Adult_02", "Female_Adult_14", "Business_Male_01"]);
  const mk = (n, k, h) => makePerson(st.scene, lib, n, k, h, 0);
  S.K = mk("Business_Female_03", "f", 1.65);
  S.M = mk("Male_Adult_12", "m", 1.78);
  S.MD = mk("Male_Adult_12", "m", 1.78);
  S.Mz = mk("Male_Adult_02", "m", 1.8);
  S.KR = mk("Business_Male_01", "m", 1.8);
  S.SF = mk("Female_Adult_14", "f", 1.66);
  S.corv = makeCar(CARS.corvair); S.fiat = makeCar(CARS.fiat600);
  S.police = makeCar({ ...CARS.sedan, color: 0x1f4a32, roofColor: 0xe8e6de, fins: 0.05, plate: "NYPD 212" });
  S.amb = makeCar({ ...CARS.sedan, L: 5.6, roofH: 1.6, color: 0xe6e2d6, fins: 0.0, grille: true, plate: "AMB 8" });
  st.scene.add(S.corv.group, S.fiat.group, S.police.group, S.amb.group);
  for (const car of [S.corv, S.fiat, S.police, S.amb]) car.beams.forEach((b) => (b.intensity = 0));
  S.fiat.group.position.set(40.5, 0, 21.4); S.fiat.group.rotation.y = 0.1;
  // roof beacons
  S.beacons = [S.police, S.amb].map((car) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0, 0) });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), m);
    dome.position.set(0, car.spec.roofH + 0.02, 0.2); car.group.add(dome);
    const l = new THREE.PointLight(0xff1a10, 0, 22, 1.4); l.position.set(0, car.spec.roofH + 0.4, 0.2); car.group.add(l);
    return { m, l };
  });
  // paths
  S.pMozRun = makePath([[22, 8.6], [31, 8.7], [37, 7.6], [46.5, 5.2]]);
  S.pCorvAway = makePath([[48, 3.6], [40, 3.0], [20, 2.0], [-60, 1.6]]);
  S.pKitty = makePath([[31.0, 8.9], [31.2, 12], [31.3, 16], [30.9, 20.5], [28.5, 23.4], [25.2, 23.3]]);
  S.pCorvBack = makePath([[95, -2.6], [60, -2.6], [46, -1.6], [43.5, 4.0], [44.0, 12.0]]);
  S.pSearch = makePath([[45.2, 12.4], [42, 16], [36, 18.5], [33, 23.6], [26.2, 23.6]]);
  S.pPolice = makePath([[95, -2.6], [50, -2.6], [36, -1.0], [32.5, 2.6]]);
  S.pAmb = makePath([[33.5, 3.4], [25, 1.7], [0, 1.6], [-90, 1.6]]);
  captureEnv(st, V(30, 1.3, 4), [S.K, S.M, S.MD, S.Mz, S.KR, S.SF].map((c) => c.holder).concat([S.corv.group, S.police.group, S.amb.group]));
}, frame);

function hideAll() { for (const k of ["K", "M", "MD", "Mz", "KR", "SF"]) S[k].holder.visible = false; }
const at = (c, b, x, y, z, ry) => { c.holder.position.copy(b.world(x, y, z)); c.holder.rotation.y = ry; c.holder.visible = true; };

function frame(t) {
  S.street.update(t); hideAll();
  const place = t < C[0] - 0.3 ? "street" : t < C[1] - 0.25 ? "room" : t < C[7] - 0.3 ? "street" : t < C[9] - 0.3 ? "vest" : t < C[10] - 0.3 ? "apt" : t < C[11] - 0.3 ? "vest" : "street";
  S.street.show(place === "street"); only(st, place);
  S.police.group.visible = t > C[11] - 1; S.amb.group.visible = t > C[12] - 1.5;
  // beacons
  const blink = Math.sin(t * 9) > 0 ? 1 : 0.15;
  S.beacons.forEach((b) => { b.m.color.setRGB(6 * blink, 0.3 * blink, 0.2 * blink); b.l.intensity = 30 * blink; });
  // windows: lights coming on after the scream, then going out
  const out0 = C[4] + 1.0;
  S.street.setWindows((g, i, on) => {
    if (g.kind !== "mowbray" && g.kind !== "tudor") return on;
    const h = ((i * 2654435761) >>> 0) / 4294967296;
    const onT = 1.5 + h * 6, offT = out0 + h * 7;
    if (h < 0.45) return Math.max(on, sm(onT, onT + 0.1, t) * (1 - sm(offT, offT + 0.15, t)) * 0.9);
    return on;
  });
  // ---- chapter card over the street ----
  if (t < C[0] - 0.3) {
    const pos = lerpV(V(14, 2.2, -4), V(17, 2.0, -3.4), t / 5).add(shake(t, 0.01));
    return { pos, look: V(24, 2.5, 9), fov: 38, focus: 12, ap: 0.0015, fade: 0.55 - 0.55 * sm(3.5, 4.2, t) + (1 - sm(0, 1, t)) * 0.45 };
  }
  // ---- Mozer at his window ----
  if (t < C[1] - 0.25) {
    const tt = t - C[0];
    at(S.Mz, S.room, 0.15, 0, -1.25, Math.PI); pose(S.Mz, { look: [1, 1 + tt * 0.6] });
    S.room.sash.position.y = 1.5 + 1.4 / 4 + sm(2.5, 4.0, tt) * 0.6;
    S.room.curtains.forEach((c, i) => (c.rotation.y = Math.sin(t * 1.3 + i) * 0.06));
    const k = ease(tt / 8.5);
    const pos = S.room.world(lerp(-1.6, -0.9, k), 1.6, lerp(1.4, 0.4, k)).add(shake(t, 0.008));
    return { pos, look: S.room.world(0.1, 1.55, -1.8), fov: 36, focus: pos.distanceTo(S.Mz.holder.position) + 0.3, ap: 0.003, exposure: 1.7 };
  }
  // ---- "Let that girl alone!" — from the street, looking up ----
  if (t < C[2] - 0.2) {
    const tt = t - C[1];
    const pos = V(20.5, 0.9, 7.2).add(shake(t, 0.03));
    return { pos, look: V(10, 13 + tt * 0.2, -10), fov: 36, focus: 20, ap: 0.001 };
  }
  // ---- he runs, he drives away ----
  if (t < C[3] - 0.3) {
    const tt = t - C[2] + 0.2;
    S.M.holder.visible = tt < 3.0;
    if (tt < 3.0) { const d = dist(tt, 5.2, 0.4), s = S.pMozRun.at(d); S.M.holder.position.copy(s.p); S.M.holder.rotation.y = s.yaw; pose(S.M, { run: [1, d / 5.2] }); }
    const cd = dist(tt - 2.6, 9, 1.4);
    carAt(S.corv, S.pCorvAway, cd);
    S.corv.headM.emissiveIntensity = tt > 2.4 ? 1 : 0; S.corv.beams.forEach((b) => (b.intensity = tt > 2.4 ? 110 : 0)); S.corv.tailM.emissiveIntensity = tt > 2.4 ? 2 : 0;
    S.corv.group.updateMatrixWorld(true);
    S.MD.holder.visible = tt >= 3.0; S.MD.holder.position.copy(S.corv.group.localToWorld(V(0.38, -0.05, -0.15))); S.MD.holder.rotation.y = S.corv.group.rotation.y; pose(S.MD, { sit: [1, 4] });
    const pos = V(33.5, 1.3, -4.5).add(shake(t, 0.02));
    const look = tt < 3 ? S.M.holder.position.clone().add(V(0, 1.1, 0)) : S.corv.group.position.clone().add(V(0, 0.8, 0));
    return { pos, look: look, fov: 34, focus: pos.distanceTo(look), ap: 0.0015 };
  }
  S.corv.headM.emissiveIntensity = 0; S.corv.beams.forEach((b) => (b.intensity = 0)); S.corv.tailM.emissiveIntensity = 0;
  // ---- Kitty, wounded, along the side of the building ----
  if (t < C[4] - 0.3) {
    const tt = t - C[3] + 0.3;
    S.corv.group.position.set(0, -50, 0);
    S.K.holder.visible = true;
    const d = dist(tt, 0.75, 0.8), s = S.pKitty.at(d); S.K.holder.position.copy(s.p); S.K.holder.rotation.y = s.yaw;
    pose(S.K, { injured: [1, d / 0.75] });
    const pos = V(36.5, 0.75, 11.5 + tt * 0.5).add(shake(t, 0.012));
    const look = S.K.holder.position.clone().add(V(0, 0.9, 0));
    return { pos, look, fov: 30, focus: pos.distanceTo(look), ap: 0.003 };
  }
  // ---- the street goes quiet; windows go dark ----
  if (t < C[5] - 0.3) {
    const tt = t - C[4];
    const k = ease(tt / 11);
    const pos = lerpV(V(14, 3.0, 4), V(12, 4.5, 8), k).add(shake(t, 0.008));
    return { pos, look: V(4, 9, -10), fov: 40, focus: 20, ap: 0.0006 };
  }
  // ---- the Corvair comes back ----
  if (t < C[6] - 0.3) {
    const tt = t - C[5] + 0.3;
    const total = S.pCorvBack.len, v = 11;
    const d = Math.min(total, total - Math.max(0, (4.6 - tt)) * v * (Math.max(0, 4.6 - tt) / 4.6));
    carAt(S.corv, S.pCorvBack, Math.max(0, total - (Math.max(0, 4.6 - tt) ** 2) * (v / (2 * 4.6)) * 1.0));
    S.corv.headM.emissiveIntensity = 1; S.corv.beams.forEach((b) => (b.intensity = 120)); S.corv.tailM.emissiveIntensity = tt > 3.5 ? 5 : 2;
    const pos = V(39, 0.6, 15.5).add(shake(t, 0.015));
    const look = S.corv.group.position.clone().add(V(0, 0.7, 0));
    return { pos, look, fov: 30, focus: pos.distanceTo(look), ap: 0.002 };
  }
  // ---- he searches, and finds her door ----
  if (t < C[7] - 0.3) {
    const tt = t - C[6] + 0.3;
    carAt(S.corv, S.pCorvBack, S.pCorvBack.len);
    S.M.holder.visible = true;
    walker(S.M, S.pSearch, t, C[6] + 0.2, 1.25, "slow", 1.0);
    const kp = S.M.holder.position.clone();
    const pos = kp.clone().add(V(4.5, 1.6, -3.2).applyAxisAngle(V(0, 1, 0), S.M.holder.rotation.y * 0.3)).add(shake(t, 0.02));
    if (tt > 7.5) { const p2 = V(29.5, 1.3, 25.8).add(shake(t, 0.01)); return { pos: p2, look: V(24.5, 1.4, 22.2), fov: 34, focus: p2.distanceTo(V(25.5, 1.3, 23.4)), ap: 0.003 }; }
    return { pos, look: kp.add(V(0, 1.3, 0)), fov: 34, focus: 5.5, ap: 0.003 };
  }
  // ---- the vestibule: implied, never shown ----
  if (t < C[8] - 0.3) {
    const tt = t - C[7] + 0.3;
    const open = sm(0.6, 1.6, tt);
    S.vest.door.rotation.y = -open * 1.3;
    if (tt < 4.2) { at(S.M, S.vest, -0.1, 0, 3.4 - sm(1.2, 3.5, tt) * 1.2, Math.PI); pose(S.M, { walk: [sm(1.2, 1.6, tt), tt * 0.9], idle: [1 - sm(1.2, 1.6, tt), 1] }); }
    const sw = Math.sin(tt * 2.2) * 0.25 * (tt > 4.2 ? 1 : 0.2);
    S.vest.bulbM.position.x = Math.sin(sw) * 0.6; S.vest.bulbL.position.x = S.vest.bulbM.position.x; S.vest.cord.rotation.z = sw;
    S.vest.bulbL.intensity = 10 * (tt > 4.6 && tt < 5.0 ? 0.2 : 1);
    if (tt < 4.4) { const pos = S.vest.world(0.6, 2.6, -1.0); return { pos, look: S.vest.world(-0.3, 1.0, 2.9), fov: 40, focus: 4.2, ap: 0.002, exposure: 1.6 }; }
    const pos = S.vest.world(-0.8, 3.2, -1.2);
    return { pos, look: S.vest.world(0, 4.2, 1.4), fov: 38, focus: 2.8, ap: 0.003, exposure: 1.6, fade: sm(C[8] - 1.2, C[8] - 0.4, t) };
  }
  // ---- Karl Ross opens his door, and closes it ----
  if (t < C[9] - 0.3) {
    const tt = t - C[8] + 0.3;
    const o = sm(1.0, 2.2, tt) * (1 - sm(6.0, 7.2, tt));
    S.vest.kdoor.rotation.y = o * 1.4; S.vest.kdoorLight.intensity = 14 * o;
    at(S.KR, S.vest, 0.05, 2.87, -3.3, 0); pose(S.KR, { listen: [1, 1 + tt * 0.7] });
    S.KR.holder.visible = o > 0.05;
    const pos = S.vest.world(0.75, 2.5, 1.5).add(shake(t, 0.006));
    return { pos, look: S.vest.world(0, 3.8, -3.0), fov: 34, focus: pos.distanceTo(S.vest.world(0, 4, -3)), ap: 0.002, exposure: 1.6, fade: 1 - sm(C[8] - 0.3, C[8] + 0.6, t) };
  }
  // ---- he calls a friend ----
  if (t < C[10] - 0.3) {
    const tt = t - C[9] + 0.3;
    at(S.KR, S.apt, 2.35, 0, 1.15, Math.PI); pose(S.KR, { nervous: [1, 2 + tt * 0.8] });
    const k = ease(tt / 10);
    const pos = S.apt.world(lerp(0.2, 0.9, k), 1.55, lerp(-0.6, -0.2, k));
    return { pos, look: S.apt.world(2.4, 1.3, 1.5), fov: 32, focus: pos.distanceTo(S.KR.holder.position) + 0.2, ap: 0.003, warm: 0.3, exposure: 1.5 };
  }
  // ---- Sophia Farrar ----
  if (t < C[11] - 0.3) {
    const tt = t - C[10] + 0.3;
    at(S.K, S.vest, -1.05, -0.42, 0.9, Math.PI / 2 + 0.2); pose(S.K, { sit: [1, 6] });
    S.K.bones.Head.rotation.x += 0.35; S.K.bones.Head.rotation.z += 0.25;
    at(S.SF, S.vest, -0.55, 0, 1.05, -Math.PI / 2 - 0.2); pose(S.SF, { crouch: [1, 1 + tt * 0.5] });
    S.vest.bulbM.position.x = 0; S.vest.bulbL.position.x = 0; S.vest.cord.rotation.z = 0; S.vest.bulbL.intensity = 9;
    const k = ease(tt / 13);
    const pos = S.vest.world(lerp(0.9, 0.6, k), lerp(1.3, 1.1, k), lerp(-0.2, 0.2, k)).add(shake(t, 0.004));
    const look = S.vest.world(-0.8, 0.6, 0.95);
    return { pos, look, fov: 34, focus: pos.distanceTo(look), ap: 0.004, warm: 0.6, exposure: 1.6, fade: 1 - sm(C[10] - 0.3, C[10] + 0.8, t) };
  }
  // ---- the police arrive ----
  if (t < C[12] - 0.3) {
    const tt = t - C[11] + 0.3;
    carAt(S.police, S.pPolice, Math.min(S.pPolice.len, S.pPolice.len - Math.max(0, 3.5 - tt) ** 2 * 1.6));
    S.police.headM.emissiveIntensity = 1; S.police.beams.forEach((b) => (b.intensity = 110));
    const pos = V(28.5, 0.7, -2.5).add(shake(t, 0.02));
    return { pos, look: S.police.group.position.clone().add(V(0, 0.8, 0)), fov: 32, focus: pos.distanceTo(S.police.group.position), ap: 0.002 };
  }
  // ---- the ambulance ----
  {
    const tt = t - C[12] + 0.3;
    carAt(S.police, S.pPolice, S.pPolice.len);
    carAt(S.amb, S.pAmb, dist(tt - 0.8, 10, 2.0));
    S.amb.headM.emissiveIntensity = 1; S.amb.beams.forEach((b) => (b.intensity = 110)); S.amb.tailM.emissiveIntensity = 2;
    const pos = V(14, 1.0, -4.8).add(shake(t, 0.01));
    const look = lerpV(V(30, 1, 3), S.amb.group.position.clone().add(V(0, 0.8, 0)), sm(0, 3, tt));
    return { pos, look, fov: 36, focus: pos.distanceTo(S.amb.group.position), ap: 0.0015, fade: sm(DUR - 3.5, DUR - 0.5, t) };
  }
}
