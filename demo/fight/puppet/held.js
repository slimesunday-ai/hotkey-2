// WHAT IS IN A HAND (anim-1): the box cutter, a knife, a runner's shiv, drawn in the fist that holds it so a blade
// LOOKS like a blade from the game's camera: a bright sliver past the fist, along the forearm. A few boxes in the
// city's own blocky look, one small mesh a holder, placed each frame from the body's own fist and elbow (rig.js fk).
//
//   const held = createHeld(city)
//   held.show(key, kind, fist, elbow)   kind 'blade' | 'shiv' | 'pipe'; fist and elbow world points [x, y, z]
//   held.hide(key) · held.clear()
const KINDS = {
  // [length past the fist (m), width, colour of the steel, colour of the grip]
  blade: [0.2, 0.05, 0xe8eef2, 0xffc21a],
  shiv: [0.16, 0.035, 0xd9dde0, 0x3a3a40],
  // (Cousin Earl's tire iron: a dark bar as long as a forearm and a half)
  pipe: [0.46, 0.05, 0x4a4d55, 0x2a2a2e],
};

export function createHeld(city) {
  const THREE = city.THREE;
  const live = new Map();
  const up = new THREE.Vector3(0, 0, 1);
  const d = new THREE.Vector3();
  function make(kind) {
    const [len, w, steel, grip] = KINDS[kind] ?? KINDS.blade;
    const g = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, w, len), new THREE.MeshLambertMaterial({ color: steel, emissive: steel, emissiveIntensity: 0.35 }));
    blade.position.z = 0.05 + len / 2;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, w * 1.1, 0.1), new THREE.MeshLambertMaterial({ color: grip }));
    g.add(blade, handle);
    blade.castShadow = true;
    g.name = `hk2:held:${kind}`;
    city.scene.add(g);
    return g;
  }
  return {
    show(key, kind, fist, elbow) {
      let M = live.get(key);
      if (!M || M.kind !== kind) {
        if (M) city.scene.remove(M.g);
        M = { kind, g: make(kind) };
        live.set(key, M);
      }
      M.g.visible = true;
      M.g.position.set(fist[0], fist[1], fist[2]);
      // (along the forearm, past the fist, and tipped up a little: held to cut, not to point at the ground)
      d.set(fist[0] - elbow[0], fist[1] - elbow[1] + 0.06, fist[2] - elbow[2]).normalize();
      M.g.quaternion.setFromUnitVectors(up, d);
    },
    hide(key) {
      const M = live.get(key);
      if (M) M.g.visible = false;
    },
    clear() {
      for (const M of live.values()) city.scene.remove(M.g);
      live.clear();
    },
  };
}
