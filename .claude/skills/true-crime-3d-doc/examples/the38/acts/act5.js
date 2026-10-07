// Chapter V — WHAT REALLY HAPPENED
import { THREE, createStage, run, only, buildStreet, captureEnv, canvasTex, sm, ease, lerp, V, lerpV, shake, makePerson, pose } from "./stage.js";
import { loadPeople } from "./people.js";
import { theaterSet, Builder } from "./sets.js";
import { createOverlay } from "./ov.js";

const ACTS = await (await fetch("assets/acts.json")).json();
const A = ACTS.a5, C = A.cues.map((c) => c.s), DUR = A.dur;
const ov = createOverlay(DUR);
ov.chapter("CHAPTER FIVE", "WHAT REALLY HAPPENED", 0.6, 4.6);
ov.stamp("3:19 A.M. · MARCH · WINDOWS CLOSED", C[1] + 0.8, C[2] - 0.5, {});
ov.src("Manning, Levine & Collins (2007), American Psychologist", C[4] + 0.5, C[5] - 0.5);
ov.src("The New York Times, 2016", C[5] + 0.5, C[6] - 0.5);
ov.lower("BILL GENOVESE", "Kitty's younger brother · The Witness (2015)", C[6] + 3, C[6] + 9.5);

// world-anchored labels (positioned every frame by projecting 3D points)
const labels = [];
function wlabel(text, p, t0, t1) {
  const d = document.createElement("div"); d.className = "ov label3"; d.textContent = text; document.getElementById("root").appendChild(d);
  ov.tl.fromTo(d, { opacity: 0 }, { opacity: 1, duration: 0.6 }, t0); ov.tl.to(d, { opacity: 0, duration: 0.6 }, t1 - 0.6);
  labels.push({ d, p });
}
wlabel("AUSTIN STREET", V(-2, 0, 0), C[0] + 0.5, C[1] + 1);
wlabel("THE MOWBRAY", V(0, 22, -10), C[0] + 1.2, C[2] - 0.4);
wlabel("82-70 AUSTIN ST.", V(-6, 10, 16), C[0] + 1.8, C[3] + 6);
wlabel("FIRST ATTACK", V(19, 0.5, 8.3), C[1] + 0.6, C[2] + 2);
wlabel("SECOND ATTACK · REAR VESTIBULE", V(24.5, 2.5, 22.4), C[2] + 0.6, C[3] + 6);
wlabel("A NEIGHBOR SHOUTED", V(-3, 18.5, -9.8), C[3] + 0.8, C[4] - 0.4);
wlabel("1–2 CALLS TO POLICE", V(10, 9, 9.9), C[3] + 3.5, C[4] - 0.4);
wlabel("SOPHIA FARRAR WENT DOWN", V(24.5, 0.5, 23.4), C[3] + 7.5, C[4] - 0.4);

const st = createStage();
const S = {};
run(st, async () => {
  S.street = await buildStreet(st);
  S.th = theaterSet(st.scene);
  // documents desk
  S.docs = new Builder(st.scene, 900, 0);
  const dw = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.55 });
  S.docs.box(dw, 3, 0.08, 1.8, 0, 0.74, 0);
  S.docs.box(new THREE.MeshStandardMaterial({ color: 0x111111 }), 12, 0.02, 12, 0, 0, 0, 0, false);
  S.docs.light(0xfff2dc, 4, 8, 0, 2.6, 0.9, true);
  S.docs.hemi = new THREE.HemisphereLight(0x8a8a90, 0x202020, 0.4); S.docs.group.add(S.docs.hemi);
  const doc = (title, lines, x, z, ry) => {
    const t = canvasTex(900, 1200, (g, W, H) => {
      g.fillStyle = "#ece7da"; g.fillRect(0, 0, W, H); g.fillStyle = "#151210";
      let y = 90; for (const [txt, font, gap] of title) { g.font = font; wrap(g, txt, 70, y, W - 140, gap); y += gap * Math.ceil(g.measureText(txt).width / (W - 140) + 0.001) + 18; }
      g.fillRect(70, y, W - 140, 3); y += 40;
      for (let i = 0; i < lines; i++) { g.fillStyle = "rgba(20,18,16,0.42)"; g.fillRect(70, y + i * 26, (i % 7 === 6 ? 0.55 : 0.97) * (W - 140), 11); }
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
    m.rotation.set(-Math.PI / 2, 0, ry); m.position.copy(S.docs.world(x, 0.785, z)); st.scene.add(m); return m;
  };
  S.d1 = doc([["AMERICAN PSYCHOLOGIST · 2007", "bold 26px Helvetica", 34], ["The Kitty Genovese Murder and the Social Psychology of Helping", "bold 44px Georgia", 54], ["The Parable of the 38 Witnesses", "italic 36px Georgia", 46], ["Rachel Manning · Mark Levine · Alan Collins", "28px Georgia", 36]], 28, -0.55, 0, 0.08);
  S.d2 = doc([["THE NEW YORK TIMES · 2016", "bold 26px Helvetica", 34], ["The Times later acknowledged that its 1964 article “grossly exaggerated” the number of witnesses and what they had perceived.", "40px Georgia", 52]], 30, 0.55, 0.05, -0.06);
  st.sets = { th: S.th, docs: S.docs };
  // sight lines from Mowbray windows (38) to the two attack sites
  const mw = S.street.world.glassSlots.filter((g) => g.kind === "mowbray");
  const r = (i) => ((i * 2654435761) >>> 0) / 4294967296;
  const pick = mw.filter((g, i) => r(i) < 0.42).slice(0, 38);
  const first = V(19, 1.0, 8.3), vest = V(24.5, 1.0, 22.2);
  const mk = (from, to, color) => {
    const dir = to.clone().sub(from), len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
    m.position.copy(from).addScaledVector(dir, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize()); st.scene.add(m); return m;
  };
  S.lines1 = pick.map((g) => mk(V(g.x, g.y, g.z + 0.2), first, new THREE.Color(2.2, 2.0, 1.6)));
  // to the vestibule: the line stops where it hits the Tudor block (front face z=10)
  S.lines2 = pick.map((g) => { const from = V(g.x, g.y, g.z + 0.2); const k = (10 - from.z) / (vest.z - from.z); const hit = from.clone().lerp(vest, k); return mk(from, hit, new THREE.Color(2.6, 0.25, 0.2)); });
  const ring = (p, c) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 48), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.copy(p).setY(0.2); st.scene.add(m); return m; };
  S.ring1 = ring(first, new THREE.Color(3, 2.4, 1.6)); S.ring2 = ring(V(24.5, 0, 23.0), new THREE.Color(3, 0.4, 0.3));
  S.mozWin = mw[Math.floor(mw.length * 0.62)];
  const lib = await loadPeople(["Male_Adult_03", "Female_Adult_11", "Business_Male_01"]);
  S.aud = [makePerson(st.scene, lib, "Male_Adult_03", "m", 1.76, 0), makePerson(st.scene, lib, "Female_Adult_11", "f", 1.66, 0), makePerson(st.scene, lib, "Business_Male_01", "m", 1.8, 0)];
  captureEnv(st, V(30, 1.3, 4), S.aud.map((c) => c.holder));
}, frame);

function wrap(g, text, x, y, w, lh) { const words = text.split(" "); let line = ""; for (const wd of words) { const tst = line + wd + " "; if (g.measureText(tst).width > w && line) { g.fillText(line, x, y); line = wd + " "; y += lh; } else line = tst; } g.fillText(line, x, y); }

const proj = new THREE.Vector3();
function frame(t) {
  S.street.update(t);
  const place = t < C[4] - 0.4 ? "street" : t < C[6] - 0.4 ? "docs" : "th";
  S.street.show(place === "street"); only(st, place);
  const showLines = place === "street";
  // sight lines
  const a1 = sm(C[1] + 0.5, C[1] + 3, t) * (1 - sm(C[2] - 0.5, C[2] + 0.4, t));
  const a2 = sm(C[2] + 0.3, C[2] + 2.5, t) * (1 - sm(C[3] + 4, C[3] + 5, t));
  S.lines1.forEach((m, i) => { m.visible = showLines; m.material.opacity = a1 * (0.25 + (i % 5) * 0.08); });
  S.lines2.forEach((m, i) => { m.visible = showLines; m.material.opacity = a2 * 0.45; });
  S.ring1.material.opacity = sm(C[1] + 0.3, C[1] + 1.2, t) * (1 - sm(C[3] - 0.5, C[3], t)); S.ring1.visible = showLines;
  S.ring2.material.opacity = sm(C[2] + 0.3, C[2] + 1.2, t) * (1 - sm(C[4] - 1, C[4] - 0.4, t)); S.ring2.visible = showLines;
  S.street.setWindows((g, i, on) => (g === S.mozWin ? Math.max(on, sm(C[3], C[3] + 0.5, t) * 1.6) : on));
  S.aud.forEach((c) => (c.holder.visible = place === "th"));
  let s;
  if (place === "street") {
    if (t < C[1] - 0.4) { // crane up into the map
      const k = ease(t / (C[1] - 0.4));
      s = { pos: lerpV(V(12, 30, -2), V(16, 62, -12), k), look: lerpV(V(18, 3, 8), V(14, 0, 5), k), fov: 40, focus: 50, ap: 0, fade: (1 - sm(0, 1, t)) * 0.9 + 0.4 * (1 - sm(3.6, 4.6, t)) };
    } else if (t < C[2] - 0.4) { // the first attack: lines from the windows
      const tt = t - C[1] + 0.4, k = ease(tt / (C[2] - C[1]));
      s = { pos: lerpV(V(-4, 30, 4), V(4, 24, 2), k), look: V(14, 4, -1), fov: 44, focus: 40, ap: 0 };
    } else if (t < C[3] - 0.4) { // the vestibule: the lines hit the building
      const tt = t - C[2] + 0.4, k = ease(tt / (C[3] - C[2]));
      s = { pos: lerpV(V(48, 22, -8), V(46, 14, 34), k), look: V(22, 2, 14), fov: 42, focus: 40, ap: 0 };
    } else { // what people actually did
      const tt = t - C[3] + 0.4, k = ease(tt / (C[4] - C[3]));
      s = { pos: lerpV(V(34, 16, -6), V(36, 30, -8), k), look: V(12, 6, 8), fov: 44, focus: 40, ap: 0, fade: sm(C[4] - 1.1, C[4] - 0.4, t) };
    }
  } else if (place === "docs") {
    const tt = t - C[4] + 0.4;
    const doc2 = t > C[5] - 0.4;
    const target = (doc2 ? S.d2 : S.d1).position;
    const k = ease((doc2 ? t - C[5] + 0.4 : tt) / 11);
    const pos = target.clone().add(V(lerp(0.35, 0.1, k), lerp(0.95, 0.62, k), lerp(0.55, 0.4, k)));
    s = { pos, look: target.clone().add(V(0, 0, -0.05)), fov: 36, focus: pos.distanceTo(target), ap: 0.003, bw: 1, exposure: 1.2, fade: (1 - sm(C[4] - 0.4, C[4] + 0.5, t)) + (doc2 ? 1 - sm(C[5] - 0.4, C[5] + 0.3, t) : 0) };
  } else {
    const tt = t - C[6] + 0.4, k = ease(tt / (DUR - C[6]));
    const b = S.th;
    S.aud.forEach((c, i) => { c.holder.position.copy(b.world(-1.8 + i * 1.8, 0.0, 0.1 + (i % 2) * 1.1)); c.holder.rotation.y = Math.PI; pose(c, { sit: [1, 3 + i * 4 + tt * 0.5] }); });
    const pos = b.world(lerp(0.3, 0.0, k), lerp(2.1, 1.6, k), lerp(5.2, 2.8, k)).add(shake(t, 0.005));
    s = { pos, look: b.world(0, 2.0, -5.9), fov: 40, focus: pos.distanceTo(b.world(0, 2, -5.9)), ap: 0.002, exposure: 1.6, fade: (1 - sm(C[6] - 0.4, C[6] + 0.6, t)) + sm(DUR - 1.6, DUR - 0.2, t) };
  }
  // project labels
  const cam = st.camera;
  cam.position.copy(s.pos); cam.fov = s.fov; cam.updateProjectionMatrix(); cam.lookAt(s.look); cam.updateMatrixWorld(true);
  for (const L of labels) {
    proj.copy(L.p).project(cam);
    const vis = place === "street" && proj.z < 1;
    L.d.style.left = Math.round((proj.x * 0.5 + 0.5) * 1920) + "px"; L.d.style.top = Math.round((-proj.y * 0.5 + 0.5) * 1080) + "px";
    L.d.style.visibility = vis ? "visible" : "hidden";
  }
  return s;
}
