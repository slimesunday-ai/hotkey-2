// THE GUNS, DRAWN (anim-1): each gun of guns.js as a few boxes in the city's blocky look, one group a holder, put
// each frame where the pose has it (the grip's place, the barrel's line, the gun's own up: all the world's). The part
// that is worked (the Doorman's pump, the Long-eye's bolt) is its own box and slides. And the spent cases: a small
// brass box thrown from the port, that falls and lies a moment.
//
//   const guns = createGunMeshes(city)
//   guns.show(key, kind, at, dir, up, slide)   world: the grip [x, y, z], the line and the up (unit), slide 0..1
//   guns.hide(key) · guns.clear() · guns.shell(at, dir, up, ground)   a case thrown from `at` · guns.step(dt)
import { GUNS } from './guns.js';

/**
 * WARMED: a material of a kind the city has not drawn yet makes the renderer build and link its program the first
 * time something with it is seen, in the middle of a fight (the performance probe counted one more program linked
 * at the first gun fight on these bodies than on the old ones: demo/tools/perf-probe.mjs --only wave --guns new).
 * So one speck with each such material is drawn for a few frames when the meshes are made, out of the picture.
 */
export function warmMaterials(city, materials) {
  const THREE = city.THREE;
  if (typeof requestAnimationFrame === 'undefined' || !city.scene) return;
  const geo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
  const g = new THREE.Group();
  for (const m of materials) {
    // (anim-2: a sprite's material is warmed on a sprite: the blood's mist, the city's own, gorefx.js)
    const x = m.isSpriteMaterial ? new THREE.Sprite(m) : new THREE.Mesh(geo, m);
    if (m.isSpriteMaterial) x.scale.set(0.01, 0.01, 0.01);
    x.frustumCulled = false;
    x.castShadow = !m.isSpriteMaterial;
    g.add(x);
  }
  g.position.set(0, -80, 0);
  g.name = 'hk2:warm';
  city.scene.add(g);
  let n = 0;
  const tick = () => {
    if (++n < 6) return void requestAnimationFrame(tick);
    city.scene.remove(g);
    geo.dispose();
  };
  requestAnimationFrame(tick);
}

/**
 * THE BLOOD'S MIST (anim-2): the one program that was still linked in the middle of a gun fight, found 2026-11-19
 * (demo/tools/gun-programs.mjs: "SpriteMaterial on Scene > Sprite", at the tick of the first hit). The city's own
 * blood (gorefx.js) keeps ten sprites in the scene, not drawn until somebody is hit: the first hit of the first
 * fight built their program. Warmed with the rest, whichever bodies the fight is on.
 */
export function warmBlood(city) {
  const seen = new Set();
  for (const o of city.scene?.children ?? []) if (o.isSprite && o.material?.isSpriteMaterial) seen.add(o.material);
  if (seen.size) warmMaterials(city, [...seen]);
  return seen.size;
}

export function createGunMeshes(city) {
  const THREE = city.THREE;
  const live = new Map();
  const shells = [];
  const mats = new Map();
  const mat = c => {
    if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.22 }));
    return mats.get(c);
  };
  const box = ([x0, x1, y0, y1, z0, z1, c]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat(c));
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = true;
    return m;
  };
  function make(kind) {
    const D = GUNS[kind];
    const g = new THREE.Group();
    for (const p of D.parts) g.add(box(p));
    let slide = null;
    if (D.slide) {
      slide = new THREE.Group();
      slide.add(box(D.slide.box));
      g.add(slide);
    }
    g.scale.set(D.fat ?? 1, D.fat ?? 1, 1);
    g.name = `hk2:gun:${kind}`;
    city.scene.add(g);
    return { g, slide, travel: D.slide?.travel ?? 0 };
  }
  const X = new THREE.Vector3();
  const Y = new THREE.Vector3();
  const Z = new THREE.Vector3();
  const M4 = new THREE.Matrix4();
  const brass = new THREE.MeshLambertMaterial({ color: 0xd8b03c, emissive: 0xd8b03c, emissiveIntensity: 0.4 });
  const red = new THREE.MeshLambertMaterial({ color: 0xc23a2a, emissive: 0xc23a2a, emissiveIntensity: 0.35 });
  warmMaterials(city, [brass]);
  return {
    show(key, kind, at, dir, up, slide = 0) {
      let M = live.get(key);
      if (!M || M.kind !== kind) {
        if (M) city.scene.remove(M.g);
        M = { kind, ...make(kind) };
        live.set(key, M);
      }
      M.g.visible = true;
      // (the gun's frame: +z the line, +y its up made square to it, +x to its right)
      Z.set(dir[0], dir[1], dir[2]).normalize();
      Y.set(up[0], up[1], up[2]);
      X.crossVectors(Y, Z).normalize();
      Y.crossVectors(Z, X);
      M4.makeBasis(X, Y, Z);
      M.g.quaternion.setFromRotationMatrix(M4);
      M.g.position.set(at[0], at[1], at[2]);
      if (M.slide) M.slide.position.z = M.travel * slide;
    },
    hide(key) {
      const M = live.get(key);
      if (M) M.g.visible = false;
    },
    /** A spent case from `at`, thrown to the gun's right and up (`dir`, `up` the gun's); `big`: a shotgun's, red. */
    shell(at, dir, up, ground, big = false) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(big ? 0.04 : 0.025, big ? 0.04 : 0.025, big ? 0.09 : 0.05), big ? red : brass);
      m.position.set(at[0], at[1], at[2]);
      city.scene.add(m);
      const r = [up[1] * dir[2] - up[2] * dir[1], up[2] * dir[0] - up[0] * dir[2], up[0] * dir[1] - up[1] * dir[0]];
      const k = 0.8 + 0.4 * Math.random();
      shells.push({ m, v: [r[0] * 1.5 * k - dir[0] * 0.5, 1.7 * k, r[2] * 1.5 * k - dir[2] * 0.5], w: 14 + 8 * Math.random(), t: 0, ground });
      if (shells.length > 40) city.scene.remove(shells.shift().m);
    },
    step(dt) {
      for (let i = shells.length - 1; i >= 0; i--) {
        const s = shells[i];
        s.t += dt;
        if (s.m.position.y > s.ground + 0.02 || s.v[1] > 0) {
          s.v[1] -= 9.8 * dt;
          s.m.position.x += s.v[0] * dt;
          s.m.position.y = Math.max(s.ground + 0.02, s.m.position.y + s.v[1] * dt);
          s.m.position.z += s.v[2] * dt;
          s.m.rotation.x += s.w * dt;
          s.m.rotation.z += s.w * 0.6 * dt;
          if (s.m.position.y <= s.ground + 0.021 && s.v[1] < 0) s.v = [0, 0, 0];
        }
        if (s.t > 2.6) {
          city.scene.remove(s.m);
          shells.splice(i, 1);
        }
      }
    },
    clear() {
      for (const M of live.values()) city.scene.remove(M.g);
      live.clear();
      for (const s of shells) city.scene.remove(s.m);
      shells.length = 0;
    },
    get count() {
      return [...live.values()].filter(M => M.g.visible).length;
    },
  };
}
