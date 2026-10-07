// Chapter VI — ACCOUNTABILITY
import { THREE, createStage, run, only, buildStreet, captureEnv, makePerson, makePath, pose, walker, sm, ease, lerp, V, lerpV, shake, dist, makeCar, CARS, carAt } from "./stage.js";
import { loadPeople } from "./people.js";
import { courtroomSet, cellSet } from "./sets.js";
import { createOverlay } from "./ov.js";

const ACTS = await (await fetch("assets/acts.json")).json();
const A = ACTS.a6, C = A.cues.map((c) => c.s), DUR = A.dur;
const ov = createOverlay(DUR);
ov.chapter("CHAPTER SIX", "ACCOUNTABILITY", 0.6, 4.6);
ov.stamp("QUEENS COUNTY · JUNE 1964", C[0] + 0.4, C[0] + 6, {});
ov.stamp("BUFFALO, NEW YORK · 1968", C[1] + 0.4, C[1] + 6, {});
ov.stamp("1964 — 2016", C[2] + 0.6, C[2] + 9.5, {});
ov.stamp("AUSTIN STREET · TODAY", C[3] + 0.6, C[3] + 6, {});
const endT = C[4] + C.length * 0 + 8.6;
ov.end("Catherine “Kitty” Genovese", "1935 — 1964", "If you see someone in danger, call for help.<br/>Don't assume someone else already has.", endT, DUR - 0.4);

const st = createStage();
const S = {};
run(st, async () => {
  S.street = await buildStreet(st);
  S.court = courtroomSet(st.scene); S.cell = cellSet(st.scene);
  st.sets = { court: S.court, cell: S.cell };
  const lib = await loadPeople(["Male_Adult_12", "Business_Male_06", "Business_Male_02", "Business_Male_03", "Female_Adult_11", "Male_Adult_03", "Business_Male_01", "Female_Adult_14"]);
  const mk = (n, k, h) => makePerson(st.scene, lib, n, k, h, 0);
  S.M = mk("Male_Adult_12", "m", 1.78);
  S.J = mk("Business_Male_06", "m", 1.8);
  S.L1 = mk("Business_Male_02", "m", 1.82); S.L2 = mk("Business_Male_03", "m", 1.8);
  S.sp = [mk("Female_Adult_11", "f", 1.66), mk("Male_Adult_03", "m", 1.76), mk("Business_Male_01", "m", 1.8), mk("Female_Adult_14", "f", 1.68)];
  S.police = makeCar({ ...CARS.sedan, color: 0x1f4a32, roofColor: 0xe8e6de, plate: "NYS 0368" }); st.scene.add(S.police.group);
  S.police.beams.forEach((b) => (b.intensity = 0));
  S.police.group.position.set(-40, 0, 1.8); S.police.group.rotation.y = Math.PI / 2;
  const bm = new THREE.MeshBasicMaterial({ color: 0x220000 }); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), bm); dome.position.set(0, 1.45, 0.2); S.police.group.add(dome);
  S.beacon = { m: bm, l: new THREE.PointLight(0xff2010, 0, 22, 1.4) }; S.beacon.l.position.set(0, 1.9, 0.2); S.police.group.add(S.beacon.l);
  S.pRun = makePath([[-30, 8.4], [-10, 8.3], [12, 8.3]]);
  captureEnv(st, V(30, 1.3, 4), [S.M, S.J, S.L1, S.L2, ...S.sp].map((c) => c.holder));
}, frame);

const all = () => [S.M, S.J, S.L1, S.L2, ...S.sp];
function frame(t) {
  S.street.update(t);
  all().forEach((c) => (c.holder.visible = false));
  const place = t < C[1] - 0.4 ? "court" : t < C[2] - 0.4 ? "street" : t < C[3] - 0.4 ? "cell" : "street";
  S.street.show(place === "street"); only(st, place);
  const fadeIn = 1 - sm(0, 1.0, t);
  if (place === "court") {
    const b = S.court, at = (c, x, y, z, ry, w) => { c.holder.position.copy(b.world(x, y, z)); c.holder.rotation.y = ry; c.holder.visible = true; pose(c, w); };
    at(S.J, 0, 0.62, -7.75, 0, { sitTable: [1, 1 + t * 0.5] });
    at(S.M, -2.2, 0, -2.85, Math.PI, { idle: [1, 2 + t * 0.6] });
    at(S.L1, -3.0, 0, -2.85, Math.PI, { idle: [1, 6 + t * 0.5] });
    at(S.L2, 2.6, -0.02, -2.9, Math.PI, { sitTable2: [1, 2 + t * 0.5] });
    S.sp.forEach((c, i) => at(c, (i % 2 ? 2.4 : -4.2) + (i > 1 ? 1.2 : 0), 0, 0.15 + Math.floor(i / 2) * 1.3, Math.PI, { sit: [1, 3 + i * 5 + t * 0.4] }));
    const k = ease(t / (C[1] - 0.4));
    const pos = b.world(lerp(-0.6, -1.4, k), lerp(2.2, 1.7, k), lerp(6.5, 0.4, k)).add(shake(t, 0.008));
    const look = b.world(lerp(0, -1.4, k), lerp(1.8, 1.4, k), -5.5);
    return { pos, look, fov: 36, focus: pos.distanceTo(S.M.holder.position), ap: 0.002, bw: 1, exposure: 1.2, fade: fadeIn + 0.4 * (1 - sm(3.6, 4.6, t)) };
  }
  if (place === "street" && t < C[3] - 0.4) { // 1968: the escape, a dark street in B&W
    const tt = t - C[1] + 0.4;
    S.street.setDay(false);
    S.M.holder.visible = true;
    const d = dist(tt, 4.8, 0.5), s = S.pRun.at(d); S.M.holder.position.copy(s.p); S.M.holder.rotation.y = s.yaw; pose(S.M, { run: [1, d / 5.2] });
    const blink = Math.sin(t * 9) > 0 ? 1 : 0.1; S.beacon.m.color.setRGB(6 * blink, 0.3 * blink, 0.2 * blink); S.beacon.l.intensity = 30 * blink * sm(4, 5, tt);
    const pos = V(-6 + tt * 0.6, 1.2, 4.0).add(shake(t, 0.03));
    return { pos, look: S.M.holder.position.clone().add(V(0, 1.1, 0)), fov: 36, focus: pos.distanceTo(S.M.holder.position), ap: 0.002, bw: 1, exposure: 1.6, fade: (1 - sm(C[1] - 0.4, C[1] + 0.3, t)) + sm(C[2] - 1.0, C[2] - 0.4, t) };
  }
  if (place === "cell") {
    const tt = t - C[2] + 0.4, b = S.cell;
    S.M.holder.visible = true; S.M.holder.position.copy(b.world(-1.0, 0.08, -0.2)); S.M.holder.rotation.y = Math.PI / 2; pose(S.M, { sit2: [1, 2 + tt * 0.5] });
    // time-lapse sun shaft sweeping across the cell
    const sw = (tt * 0.9) % 6;
    b.shaft.target.position.set(-1.2 + sw * 0.35, 0, 0.9 - sw * 0.1); b.shaft.target.updateMatrixWorld();
    b.shaft.intensity = 80 * (0.5 + 0.5 * Math.sin(tt * 1.6));
    b.cone.rotation.z = 0.35 - sw * 0.06;
    const k = ease(tt / (C[3] - C[2]));
    const pos = b.world(lerp(0.4, 0.2, k), lerp(1.4, 1.25, k), lerp(3.4, 2.0, k)).add(shake(t, 0.004));
    return { pos, look: b.world(-0.9, 0.95, -0.2), fov: 34, focus: pos.distanceTo(S.M.holder.position), ap: 0.0025, bw: 1, exposure: 2.4, fade: (1 - sm(C[2] - 0.4, C[2] + 0.4, t)) + sm(C[3] - 1.0, C[3] - 0.4, t) };
  }
  // ---- today: Austin Street at dawn ----
  const tt = t - C[3] + 0.4;
  S.street.setDay(false);
  const dawn = sm(0, 18, tt);
  st.scene.background.setRGB(0.06 + 0.2 * dawn, 0.09 + 0.24 * dawn, 0.16 + 0.32 * dawn);
  st.scene.fog.color.setRGB(0.1 + 0.25 * dawn, 0.13 + 0.27 * dawn, 0.2 + 0.32 * dawn);
  S.street.hemi.intensity = 1.4 + 1.2 * dawn; S.street.hemi.color.setRGB(0.35 + 0.35 * dawn, 0.45 + 0.35 * dawn, 0.7 + 0.2 * dawn);
  for (const l of S.street.lamps) { const off = sm(4, 7, tt); l.pl.intensity = 45 * (1 - off); if (l.sp) l.sp.intensity = 220 * (1 - off); l.cone.material.uniforms.strength.value = 0.085 * (1 - off); l.headMat.color.setRGB(4 - 3.4 * off, 2.6 - 2 * off, 1.3 - 0.75 * off); }
  // all windows dark, then one light comes on
  const one = sm(C[4] + 2.6, C[4] + 3.0, t);
  S.street.setWindows((g, i, on) => (g.kind === "mowbray" && i % 97 === 41 ? one * 1.4 : g.kind === "mowbray" ? 0 : on * (1 - dawn)));
  if (t < C[4] - 0.4) {
    const k = ease(tt / (C[4] - C[3]));
    const pos = lerpV(V(15, 1.0, 5.2), V(17.5, 1.1, 6.0), k).add(shake(t, 0.006));
    return { pos, look: V(22, 1.0, 9.6), fov: 34, focus: 6, ap: 0.002, exposure: 1.7, fade: 1 - sm(C[3] - 0.4, C[3] + 0.6, t) };
  }
  const t2 = t - C[4] + 0.4, k = ease(t2 / (DUR - C[4]));
  const pos = lerpV(V(14, 1.4, 6.5), V(12, 5.5, 6.0), k).add(shake(t, 0.006));
  return { pos, look: lerpV(V(4, 6, -10), V(2, 10, -10), k), fov: 40, focus: 18, ap: 0.0008, exposure: 1.7, fade: sm(endT - 0.5, endT + 1.2, t) * 0.8 };
}
