// Chapter IV — THIRTY-EIGHT (black & white)
import { THREE, createStage, run, only, makePerson, pose, sm, ease, lerp, V, lerpV, shake } from "./stage.js";
import { loadPeople } from "./people.js";
import { newsroomSet, frontPage, labSet } from "./sets.js";
import { createOverlay } from "./ov.js";

const ACTS = await (await fetch("assets/acts.json")).json();
const A = ACTS.a4, C = A.cues.map((c) => c.s), DUR = A.dur;
const ov = createOverlay(DUR);
ov.chapter("CHAPTER FOUR", "THIRTY-EIGHT", 0.6, 4.6);
ov.stamp("TWO WEEKS LATER", C[0] + 0.4, C[0] + 5, {});
ov.lower("A. M. ROSENTHAL", "City editor, The New York Times", C[0] + 5.2, C[0] + 12.5);
ov.src("The New York Times · March 27, 1964 · front page (reconstruction)", C[1] + 0.5, C[3] - 1);
ov.stamp("NEW YORK · 1968", C[4] + 0.4, C[4] + 5, {});
ov.lower("JOHN DARLEY & BIBB LATANÉ", "Social psychologists", C[4] + 5.5, C[4] + 12.5);
ov.stats([["Believed they were the only listener", 85], ["Believed four others could hear", 31]], C[5] + 0.2, C[6] - 0.5);
ov.src("Darley & Latané (1968), Journal of Personality and Social Psychology", C[5] + 0.5, C[6] - 0.5);
ov.quote("The bystander effect", "", C[6] + 0.6, DUR - 1.0);

const st = createStage();
const S = {};
run(st, async () => {
  st.scene.fog = null; st.scene.background = new THREE.Color(0x050505);
  S.news = newsroomSet(st.scene);
  S.booths = [];
  for (let i = 0; i < 6; i++) { const b = labSet(st.scene); b.group.position.x = 660 + (i % 3) * 3.3; b.group.position.z = Math.floor(i / 3) * 2.9; b.o.copy(b.group.position); S.booths.push(b); }
  st.sets = { news: S.news, lab: { group: new THREE.Group() } };
  S.labGroup = new THREE.Group(); st.scene.add(S.labGroup); S.booths.forEach((b) => S.labGroup.add(b.group)); st.sets.lab.group = S.labGroup;
  // remove booth ceilings for the crane-up reveal
  S.booths.forEach((b) => { const ceil = b.group.children[1]; ceil.visible = true; b.ceil = ceil; });
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.5 });
  S.news.box(wood, 1.4, 0.06, 1.0, 6.8, 0.76, 4.6); for (const [dx, dz] of [[-0.62, -0.42], [0.62, -0.42], [-0.62, 0.42], [0.62, 0.42]]) S.news.box(wood, 0.05, 0.76, 0.05, 6.8 + dx, 0.38, 4.6 + dz);
  S.page = frontPage(S.news, 6.8, 0.795, 4.6);
  S.deskLamp = S.news.light(0xfff0d0, 3, 3, 7.4, 1.6, 4.2, true);
  const lib = await loadPeople(["Business_Male_05", "Business_Male_03", "Business_Male_02", "Male_Adult_03", "Female_Adult_04", "Male_Adult_02"]);
  const mk = (n, k, h) => makePerson(st.scene, lib, n, k, h, 0);
  S.R = mk("Business_Male_05", "m", 1.8);
  S.rep = [mk("Business_Male_03", "m", 1.8), mk("Male_Adult_03", "m", 1.76), mk("Business_Male_02", "m", 1.82)];
  S.stud = [mk("Female_Adult_04", "f", 1.68), mk("Male_Adult_02", "m", 1.8), mk("Female_Adult_04", "f", 1.68), mk("Male_Adult_03", "m", 1.76), mk("Male_Adult_02", "m", 1.8), mk("Female_Adult_04", "f", 1.68)];
}, frame);

function frame(t) {
  const lab = t >= C[4] - 0.4;
  only(st, lab ? "lab" : "news");
  for (const c of [S.R, ...S.rep]) c.holder.visible = !lab;
  for (const c of S.stud) c.holder.visible = lab;
  const fadeEnds = (1 - sm(0, 1.0, t)) + sm(DUR - 1.4, DUR - 0.2, t);
  if (!lab) {
    const n = S.news;
    const at = (c, x, y, z, ry, w) => { c.holder.position.copy(n.world(x, y, z)); c.holder.rotation.y = ry; pose(c, w); };
    at(S.R, 0, -0.02, -0.25, Math.PI, { sitTable: [1, 1 + t * 0.6] });
    at(S.rep[0], -3, -0.02, -0.25, Math.PI, { sitTable2: [1, 3 + t * 0.6] });
    at(S.rep[1], 3, -0.02, 2.35, Math.PI, { sitTable: [1, 7 + t * 0.5] });
    at(S.rep[2], -1.5 + Math.sin(t * 0.2) * 0.2, 0, 1.0, 0.6, { docs: [1, 2 + t * 0.6] });
    if (t < C[1] - 0.4) { // newsroom dolly
      const k = ease(t / (C[1] - 0.4));
      const pos = n.world(lerp(-5.5, -1.6, k), lerp(2.6, 1.7, k), lerp(4.8, 1.6, k)).add(shake(t, 0.01));
      const look = n.world(lerp(-1, 0, k), 1.0, lerp(-1, -0.6, k));
      return { pos, look, fov: 36, focus: pos.distanceTo(S.R.holder.position) - 0.4, ap: 0.002, bw: 1, exposure: 0.95, fade: fadeEnds * 0.9 + 0.4 * (1 - sm(3.6, 4.6, t)) };
    }
    if (t < C[3] - 0.4) { // the front page
      const tt = t - C[1] + 0.4, span = C[3] - C[1];
      const k = ease(tt / span);
      const hl = n.world(6.8 - 0.14, 0.8, 4.6 - 0.27);
      const pos = n.world(lerp(6.85, 6.75, k), lerp(1.45, 1.08, k), lerp(5.05, 4.62, k)).add(shake(t, 0.004));
      const look = lerpV(hl, n.world(6.8, 0.8, 4.6 + 0.08 * k), sm(span * 0.45, span, tt));
      return { pos, look, fov: lerp(48, 36, k), focus: pos.distanceTo(hl), ap: 0.0025, bw: 1, exposure: 0.95 };
    }
    // the story spreads: gliding low over desk after desk
    const tt = t - C[3] + 0.4;
    const pos = n.world(-6 + tt * 0.75, 1.25, -2.8 + Math.sin(tt * 0.3) * 0.2).add(shake(t, 0.01));
    return { pos, look: pos.clone().add(V(1.2, -0.45, 1.6)), fov: 40, focus: 1.8, ap: 0.0035, bw: 1, exposure: 0.95, fade: sm(C[4] - 1.2, C[4] - 0.4, t) };
  }
  // ---- the intercom booths ----
  S.stud.forEach((c, i) => {
    const b = S.booths[i];
    c.holder.position.copy(b.world(0, -0.02, -0.25)); c.holder.rotation.y = Math.PI; pose(c, { sit: [1, 2 + i * 3 + t * 0.6] });
    b.ind.material.color.setRGB(Math.sin(t * 6 + i) > 0 ? 6 : 0.3, 0.3, 0.2);
  });
  const b0 = S.booths[1];
  if (t < C[6] - 0.4) {
    const tt = t - C[4] + 0.4;
    const k = ease(tt / (C[6] - C[4]));
    const pos = b0.world(lerp(1.1, 0.6, k), lerp(1.5, 1.3, k), lerp(0.9, 0.2, k)).add(shake(t, 0.005));
    const look = b0.world(lerp(0.0, 0.2, k), 1.0, -0.8);
    return { pos, look, fov: 38, focus: pos.distanceTo(look), ap: 0.003, bw: 1, exposure: 1.2, fade: 1 - sm(C[4] - 0.4, C[4] + 0.6, t) };
  }
  // crane up: six people, six booths, each alone
  const tt = t - C[6] + 0.4;
  S.booths.forEach((b) => (b.ceil.visible = false));
  const k = ease(tt / (DUR - C[6]));
  const ctr = S.booths[4].world(0, 0, -1.45);
  const pos = ctr.clone().add(V(lerp(0.5, 0.0, k), lerp(2.3, 9.5, k), lerp(1.5, 0.6, k)));
  return { pos, look: ctr.clone().add(V(0, 0, 0)), fov: 46, focus: pos.distanceTo(ctr), ap: 0.001, bw: 1, exposure: 1.25, fade: fadeEnds };
}
