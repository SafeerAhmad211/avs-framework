// Chapter I — KITTY
import { THREE, createStage, run, only, buildStreet, captureEnv, makeCar, CARS, makePerson, makePath, carAt, pose, walker, sm, ease, lerp, V, lerpV, shake, dist } from "./stage.js";
import { loadPeople } from "./people.js";
import { barSet, apartmentSet } from "./sets.js";
import { createOverlay } from "./ov.js";

const ACTS = await (await fetch("assets/acts.json")).json();
const A = ACTS.a1, C = A.cues.map((c) => c.s), DUR = A.dur;
const ov = createOverlay(DUR);
ov.chapter("CHAPTER ONE", "KITTY", 0.6, 4.6);
ov.stamp("NEW YORK CITY · 1950s", C[0] + 0.5, C[1] + 6, {});
ov.lower("EV'S ELEVENTH HOUR", "Hollis, Queens", C[3] + 1.2, C[3] + 7.5);
ov.lower("MARY ANN ZIELONKO", "Kitty's partner", C[4] + 1.5, C[4] + 8);
ov.stamp("MARCH 13, 1964 · 2:30 A.M.", C[5] + 0.6, C[6] - 0.5, {});
ov.tag("DRAMATIZED RECONSTRUCTION", 0.5, 6);

const st = createStage();
const S = {};
run(st, async () => {
  S.street = await buildStreet(st);
  S.bar = barSet(st.scene);
  S.apt = apartmentSet(st.scene);
  st.sets = { bar: S.bar, apt: S.apt };
  const lib = await loadPeople(["Business_Female_03", "Male_Adult_12", "Male_Adult_02", "Female_Adult_14", "Female_Adult_11", "Business_Male_01"]);
  const mk = (n, k, h) => makePerson(st.scene, lib, n, k, h, 0);
  S.K = mk("Business_Female_03", "f", 1.65);
  S.KD = mk("Business_Female_03", "f", 1.65); // driving
  S.M = mk("Male_Adult_12", "m", 1.78);
  S.P1 = mk("Male_Adult_02", "m", 1.8); S.P2 = mk("Female_Adult_14", "f", 1.68); S.P3 = mk("Business_Male_01", "m", 1.8);
  S.MA = mk("Female_Adult_11", "f", 1.66);
  S.fiat = makeCar(CARS.fiat600); S.corv = makeCar(CARS.corvair);
  S.family = makeCar({ ...CARS.sedan, color: 0x3a4a5a, roofColor: 0xd8d2c2, plate: "2G 4471" });
  st.scene.add(S.fiat.group, S.corv.group, S.family.group);
  for (const car of [S.fiat, S.corv, S.family]) car.beams.forEach((b) => (b.intensity = 0));
  // traffic signal on the south corner
  const sig = new THREE.Group(); sig.position.set(-4, 0.15, -6.6); st.scene.add(sig);
  const pm = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.5, metalness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 12), pm); pole.position.y = 2.1; sig.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3.4), pm); arm.position.set(0, 4.1, 1.7); sig.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.95, 0.3), new THREE.MeshStandardMaterial({ color: 0x1e2a1e, roughness: 0.5 })); head.position.set(0, 3.55, 3.3); sig.add(head);
  S.sigLamps = ["red", "amber", "green"].map((c, i) => {
    const m = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), m); s.rotation.y = Math.PI / 2; s.position.set(0.18, 3.85 - i * 0.29, 3.3); sig.add(s); return m;
  });
  S.sigLight = new THREE.PointLight(0xff2010, 0, 14, 1.5); S.sigLight.position.set(1.0, 3.6, -3.3); st.scene.add(S.sigLight);
  S.fiatDome = new THREE.PointLight(0xffd9a0, 0, 3.0, 1.5); st.scene.add(S.fiatDome);
  // paths
  S.pWalk = makePath([[-12, 8.0], [-2, 8.1], [12, 8.0]]);
  S.pPass = makePath([[14, 7.3], [-30, 7.4]]);
  S.pFam = makePath([[-14, 3.0], [-14, 1.6], [-30, 1.5], [-80, 1.5]]);
  S.pFiat = makePath([[70, -1.6], [-1.5, -1.6], [-90, -1.6]]); // westbound through the light
  S.pCorv = makePath([[95, -1.6], [5.5, -1.6], [-90, -1.6]]);
  S.pBarOut = makePath([[0.5, -3.0], [4.5, -3.0], [4.8, -1.0], [-2, 0.8], [-5.5, 3.3]]);
  captureEnv(st, V(30, 1.3, 4), [S.K, S.KD, S.M, S.P1, S.P2, S.P3, S.MA].map((c) => c.holder).concat([S.fiat.group, S.corv.group, S.family.group]));
}, frame);

const T = { day1: C[3] - 0.6, bar1: C[4] - 0.6, apt1: C[5] - 0.6, close1: C[6] - 0.6 };
const fiatStopT = C[6] + 2.6, fiatGoT = C[6] + 9.2;
function driveDist(path, stopD, tArrive, tGo, t, vIn = 13) {
  // approach at vIn decelerating to stop at stopD by tArrive, wait, then accelerate away
  const tb = 2.6; // braking time
  if (t < tArrive - tb) return stopD - vIn * tb / 2 - vIn * (tArrive - tb - t);
  if (t < tArrive) { const x = (tArrive - t) / tb; return stopD - (vIn * tb / 2) * x * x; }
  if (t < tGo) return stopD;
  return stopD + dist(t - tGo, 9, 2.5);
}

function hideAll() { for (const k of ["K", "KD", "M", "P1", "P2", "P3", "MA"]) S[k].holder.visible = false; }
function inBar(c, x, y, z, ry) { c.holder.position.copy(S.bar.world(x, y, z)); c.holder.rotation.y = ry; c.holder.visible = true; }

function frame(t) {
  S.street.update(t);
  hideAll();
  const place = t < T.day1 ? "street" : t < T.bar1 ? "bar" : t < T.apt1 ? "apt" : t < T.close1 ? "bar" : "street";
  S.street.show(place === "street"); only(st, place);
  const bw = t < T.day1 ? 1 : 0;
  // ---------- I-A: memories (B&W daylight street) ----------
  if (t < T.day1) {
    S.street.setDay(true);
    const K = S.K; K.holder.visible = true;
    S.family.group.visible = true;
    if (t < C[2] - 0.5) {
      const d = walker(K, S.pWalk, t, 0.5, 1.15, "slow", 1.05);
      S.P1.holder.visible = true; walker(S.P1, S.pPass, t, 0.0, 1.3, "walk", 1.3);
      carAt(S.family, S.pFam, 0);
      if (t < C[1] - 0.4) { // wide dolly down the sidewalk
        const k = ease(t / (C[1] - 0.4));
        const look = K.holder.position.clone().add(V(0, 1.2, 0));
        const pos = lerpV(V(4, 2.2, 5.4), V(2.5, 1.7, 6.2), k).add(shake(t, 0.02));
        return { pos, look, fov: 34, focus: pos.distanceTo(look), ap: 0.002, bw, exposure: 1.3, fade: 1 - sm(0, 1.2, t) };
      }
      const kp = K.holder.position.clone();
      const pos = kp.clone().add(V(3.4, 1.45, -1.6)).add(shake(t, 0.02));
      return { pos, look: kp.clone().add(V(0, 1.35, 0)), fov: 30, focus: pos.distanceTo(kp.clone().add(V(0, 1.35, 0))), ap: 0.003, bw, exposure: 1.3 };
    }
    // she watches the family car leave
    const tt = t - (C[2] - 0.5);
    K.holder.position.set(-13.2, 0.15, 6.7); K.holder.rotation.y = Math.PI * 1.15; pose(K, { look: [1, 0.5 + tt * 0.8] });
    carAt(S.family, S.pFam, dist(tt - 0.6, 6, 2.0));
    S.family.tailM.emissiveIntensity = 2;
    const pos = V(-12.0, 1.65, 8.6).add(shake(t, 0.015));
    const look = lerpV(V(-15, 1.2, 2), S.family.group.position.clone().add(V(0, 0.8, 0)), 0.6);
    return { pos, look, fov: 34, focus: 6 + tt * 2, ap: 0.002, bw: 1 - sm(T.day1 - 1.6, T.day1, t), exposure: 1.3 };
  }
  S.street.setDay(false);
  S.family.group.visible = false;
  // ---------- I-B: the bar ----------
  if (t < T.bar1) {
    const tt = t - T.day1;
    inBar(S.K, -1.5, 0, -3.0, 0); pose(S.K, { idle: [1, 2 + tt * 0.8] });
    inBar(S.P1, -2.8, 0.33, -1.35, Math.PI); pose(S.P1, { sit: [1, 4 + tt] });
    inBar(S.P2, -0.6, 0.33, -1.35, Math.PI); pose(S.P2, { sit: [1, 9 + tt] });
    inBar(S.P3, 3.5, 0, 2.2, -0.4); pose(S.P3, { sit2: [1, 2 + tt] }); S.P3.holder.position.y = -0.02;
    S.bar.lamps.forEach((l) => (l.l.intensity = 9));
    const k = ease(tt / (T.bar1 - T.day1));
    const pos = S.bar.world(lerp(-6.2, -3.0, k), 1.55, lerp(-0.3, 0.2, k)).add(shake(t, 0.01));
    const look = S.bar.world(lerp(-2.6, -1.4, k), 1.4, -2.9);
    return { pos, look, fov: 34, focus: pos.distanceTo(S.K.holder.position.clone().add(V(0, 1.5, 0))), ap: 0.0035, warm: 0.4, exposure: 1.6, fade: 1 - sm(T.day1, T.day1 + 0.6, t) * 1 + 0 * t };
  }
  // ---------- I-C: the apartment ----------
  if (t < T.apt1) {
    const tt = t - T.bar1;
    S.MA.holder.visible = true; S.MA.holder.position.copy(S.apt.world(-1.3, -0.02, 0.3)); S.MA.holder.rotation.y = 0.5; pose(S.MA, { sit: [1, 6 + tt * 0.7] });
    const k = ease(tt / (T.apt1 - T.bar1));
    const pos = S.apt.world(lerp(2.2, 1.2, k), 1.5, lerp(2.2, 1.6, k)).add(shake(t, 0.008));
    const look = S.apt.world(lerp(-0.4, -0.9, k), 1.0, 0.1);
    return { pos, look, fov: 36, focus: pos.distanceTo(S.MA.holder.position.clone().add(V(0, 1.0, 0))), ap: 0.003, warm: 0.5, exposure: 1.7 };
  }
  // ---------- I-D: closing time ----------
  if (t < T.close1) {
    const tt = t - T.apt1, span = T.close1 - T.apt1;
    S.bar.lamps.forEach((l, i) => { const off = sm(1.5 + i * 0.7, 1.6 + i * 0.7, tt); l.l.intensity = 9 * (1 - off); l.bulb.material.color.setRGB(6 * (1 - off) + 0.05, 4.2 * (1 - off) + 0.04, 2.4 * (1 - off) + 0.03); });
    const K = S.K; K.holder.visible = true;
    const d = walker(K, S.pBarOut, t, T.apt1 + 3.5, 1.2, "walk", 1.3);
    K.holder.position.add(S.bar.o);
    const pos = S.bar.world(-6.4, 2.4, 3.4).add(shake(t, 0.006));
    const look = lerpV(S.bar.world(0, 1.2, -2.5), K.holder.position.clone().add(V(0, 1.2, 0)), 0.5);
    return { pos, look, fov: 40, focus: pos.distanceTo(K.holder.position), ap: 0.002, warm: 0.4, exposure: 1.6, fade: sm(T.close1 - 1.0, T.close1, t) * 0.0 };
  }
  // ---------- I-E: the drive, the light, the white car ----------
  const fd = driveDist(S.pFiat, 70 - (-1.5) + 0, fiatStopT, fiatGoT, t);
  const cd = driveDist(S.pCorv, 95 - 5.5, fiatStopT + 1.6, fiatGoT + 0.6, t, 15);
  carAt(S.fiat, S.pFiat, Math.max(0, fd)); carAt(S.corv, S.pCorv, Math.max(0, cd));
  for (const car of [S.fiat, S.corv]) { car.headM.emissiveIntensity = 1.0; car.beams.forEach((b) => (b.intensity = 110)); }
  const braking = t > fiatStopT - 2.6 && t < fiatGoT; S.fiat.tailM.emissiveIntensity = braking ? 5 : 2; S.corv.tailM.emissiveIntensity = t > fiatStopT - 1 && t < fiatGoT + 0.6 ? 5 : 2;
  const red = t < fiatGoT - 0.3;
  S.sigLamps[0].color.setRGB(red ? 6 : 0.08, red ? 0.4 : 0.02, red ? 0.3 : 0.02);
  S.sigLamps[2].color.setRGB(red ? 0.02 : 0.2, red ? 0.08 : 5, red ? 0.05 : 1.6);
  S.sigLight.color.set(red ? 0xff2010 : 0x30ff90); S.sigLight.intensity = 18;
  S.fiat.group.updateMatrixWorld(true); S.corv.group.updateMatrixWorld(true);
  S.KD.holder.visible = true; S.KD.holder.position.copy(S.fiat.group.localToWorld(V(0.3, -0.05, -0.25))); S.KD.holder.rotation.y = S.fiat.group.rotation.y; pose(S.KD, { sit: [1, 3 + t * 0.6] });
  S.M.holder.visible = true; S.M.holder.position.copy(S.corv.group.localToWorld(V(0.38, -0.05, -0.15))); S.M.holder.rotation.y = S.corv.group.rotation.y; pose(S.M, { sit: [1, 5 + t * 0.5] });
  const turn = sm(fiatStopT + 3.2, fiatStopT + 4.4, t) * (1 - sm(fiatGoT - 0.2, fiatGoT + 0.6, t)) * 0.35;
  S.M.bones.Head.rotation.y += turn;
  const fadeOut = sm(DUR - 2.0, DUR - 0.3, t);
  if (t < fiatStopT - 0.3) { // tracking alongside the Fiat
    const cp = S.fiat.group.localToWorld(V(-2.6, 1.05, 0.6));
    const look = S.fiat.group.localToWorld(V(0, 0.95, 0.1));
    return { pos: cp.add(shake(t, 0.03)), look, fov: 34, focus: 2.7, ap: 0.003 };
  }
  if (t < fiatStopT + 3.6) { // behind the Fiat at the red light; the Corvair's lights fill the frame
    const tt = t - (fiatStopT - 0.3);
    const pos = V(3.0, 1.15, 0.5).add(shake(t, 0.012));
    const look = lerpV(S.fiat.group.position.clone().add(V(0, 0.8, 0)), V(-4, 3.2, -3.3), 0.25);
    return { pos, look, fov: 30, focus: pos.distanceTo(S.fiat.group.position), ap: 0.0025, bw: 0 };
  }
  { // close on the Corvair windshield; the face in the red light
    const tt = t - (fiatStopT + 3.6);
    const head = S.M.bones.Head.getWorldPosition(V(0, 0, 0));
    const pos = S.corv.group.localToWorld(V(0.15 + tt * 0.01, 1.15, 3.6 - Math.min(tt, 6) * 0.08)).add(shake(t, 0.008));
    return { pos, look: head, fov: 26, focus: pos.distanceTo(head), ap: 0.003, fade: fadeOut };
  }
}
