// Rocketbox (MIT) human characters, with Fern-style porcelain skin and real clothing.
import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

function managerFor(name) {
  const m = new THREE.LoadingManager();
  m.setURLModifier((url) => {
    const base = url.split(/[\\/]/).pop();
    if (/\.tga$/i.test(base)) {
      const b = base.replace(/\.tga$/i, "");
      return `assets/rb/${name}/Textures/${b}${/opacity/i.test(b) ? ".png" : ".jpg"}`;
    }
    return url;
  });
  const tl = new THREE.TextureLoader(m);
  m.addHandler(/\.tga$/i, tl);
  return m;
}
const loadFBX = (url, mgr) => new Promise((res, rej) => new FBXLoader(mgr || THREE.DefaultLoadingManager).load(url, res, undefined, rej));

// strip forward root motion (we drive position along paths ourselves)
function inPlace(clip) {
  for (const tr of clip.tracks) {
    if (/^Bip01\.position$/.test(tr.name) || /Bip01_?\.position$/.test(tr.name) && !/Pelvis/.test(tr.name)) {
      const v = tr.values, n = v.length / 3;
      const net = [0, 1, 2].map((k) => v[(n - 1) * 3 + k] - v[k]);
      const drop = [0, 1, 2].filter((k) => Math.abs(net[k]) > 5); // horizontal travel (cm)
      for (let i = 0; i < n; i++) for (const k of drop) v[i * 3 + k] = v[k];
    }
  }
  return clip;
}

function skinShader(mat, tone) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTone = { value: new THREE.Color(tone) };
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uTone;")
      .replace("#include <map_fragment>", `
        #ifdef USE_MAP
          vec4 tc = texture2D( map, vMapUv );
          vec3 c = tc.rgb;
          float mx = max(c.r, max(c.g, c.b)); float mn = min(c.r, min(c.g, c.b));
          float sat = mx > 0.001 ? (mx - mn) / mx : 0.0;
          float gr = c.g / max(c.r, 0.001); float br = c.b / max(c.r, 0.001);
          float skin = step(0.22, sat) * step(c.g, c.r) * step(c.b, c.g) * step(0.45, gr) * step(gr, 0.93) * step(br, 0.85) * step(0.035, mx);
          vec3 o = mix(c, uTone, skin);
          diffuseColor.rgb *= o; diffuseColor.a *= tc.a;
        #endif`);
  };
}

const ANIMS = ["f_walk_neutral_01", "f_run_fast_01", "f_idle_neutral_01", "f_idle_look_around_01", "f_sit_chair_idle_neutral_01",
  "m_walk_neutral_01", "m_run_fast_01", "m_idle_neutral_01", "m_sit_chair_idle_neutral_01", "m_idle_look_around_01",
  "m_sit_table_idle_neutral_01", "f_crouch_idle", "m_crouch_idle", "f_headphones_idle", "m_listen_door", "m_idle_angry_01", "m_documents_idle",
  "m_hold_bag_idle", "m_sit_table_idle_look_around", "m_idle_nervous_01", "f_idle_nervous_01", "m_sit_chair_idle_neutral_02", "f_sit_chair_idle_look_around",
  "f_walk_injured", "f_walk_slow_01", "m_walk_slow_01"];
const animCache = {};
export async function loadPeople(models = ["Business_Female_03", "Male_Adult_12", "Male_Adult_02", "Female_Adult_14"]) {
  const anims = {};
  await Promise.all(ANIMS.map(async (n) => {
    if (!animCache[n]) {
      const g = await loadFBX(`assets/rb/anim/${n}.max.fbx`);
      const clip = g.animations[0]; clip.name = n;
      animCache[n] = /walk|run/.test(n) ? inPlace(clip) : clip;
    }
    anims[n] = animCache[n];
  }));
  const out = {};
  await Promise.all(models.map(async (n) => { out[n] = await loadFBX(`assets/rb/${n}/${n}.fbx`, managerFor(n)); }));
  return { anims, models: out };
}

// make a character instance: kind "f" or "m"; tone = mannequin skin colour
export function makePerson(scene, lib, name, kind, height, tone, opts = {}) {
  const root = SkeletonUtils.clone(lib.models[name]);
  root.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map((m) => {
        const isOpacity = m.map && /opacity/i.test(m.map.image?.src || m.map.name || "") || /opacity|hair|lash/i.test(m.name);
        const nm = new THREE.MeshStandardMaterial({ map: m.map, normalMap: m.normalMap, roughness: 0.72, metalness: 0, transparent: !!m.transparent || isOpacity, alphaTest: isOpacity ? 0.4 : 0, side: isOpacity ? THREE.DoubleSide : THREE.FrontSide });
        if (nm.map) nm.map.colorSpace = THREE.SRGBColorSpace;
        if (nm.normalMap) nm.normalScale = new THREE.Vector2(0.6, 0.6);
        nm.name = m.name;
        return nm;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    }
  });
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const s = height / (box.max.y - box.min.y);
  root.scale.multiplyScalar(s);
  root.position.y = -box.min.y * s;
  const holder = new THREE.Group(); holder.add(root); scene.add(holder);
  const mixer = new THREE.AnimationMixer(root);
  const pre = kind;
  const map = { idle: `${pre}_idle_neutral_01`, look: `${pre}_idle_look_around_01`, walk: `${pre}_walk_neutral_01`, run: `${pre}_run_fast_01`, sit: `${pre}_sit_chair_idle_neutral_01`,
    crouch: `${pre}_crouch_idle`, nervous: `${pre}_idle_nervous_01`, slow: `${pre}_walk_slow_01`, sitTable: "m_sit_table_idle_neutral_01", sitTable2: "m_sit_table_idle_look_around",
    listen: "m_listen_door", angry: "m_idle_angry_01", docs: "m_documents_idle", hold: "m_hold_bag_idle", sit2: pre === "m" ? "m_sit_chair_idle_neutral_02" : "f_sit_chair_idle_look_around",
    headphones: "f_headphones_idle", injured: "f_walk_injured" };
  const actions = {};
  for (const k in map) { const clip = lib.anims[map[k]]; if (!clip) continue; const a = mixer.clipAction(clip); a.play(); a.setEffectiveWeight(0); actions[k] = a; }
  const bones = {};
  root.traverse((o) => { if (o.isBone) bones[o.name.replace(/^Bip01_?/, "").replace(/_/g, "")] = o; });
  return { holder, root, mixer, actions, bones };
}
