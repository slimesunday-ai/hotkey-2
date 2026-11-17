// THE COVER PUT ON THE LOT FOR THE FIGHT: things of the city's own kit (the mall's burnt cars, barriers and carts, the
// city's dumpster: city/from-trunk/…/districts/mall/props.js and props.js, read, never changed), built from their own
// voxel templates into meshes of the page's own and stood where the site says (sites.js `cover`). Stage-level
// additions for the fight only: the pinned city is not touched, and they go with the page.
//
// They block movement and nothing else (the rules have no line of fire): each has its box among the rules' posts (the
// site's `post`, the arena's frame), and the stage's walkers are kept out of them too (actors.addSolid). Like the
// city's own buildings, a piece between the camera and anyone of the fight goes see-through (fade()).
const KITS = {
  dumpster: (P, c) => P.city.dumpster(c.c ?? 0x3d6b4a),
  'mall.burntCar': (P, c) => P.mall.burntCar(c.v ?? 0),
  'mall.jersey': (P, c) => P.mall.jersey(c.c ?? 0xb8b3a8),
  'mall.cart': (P, c) => P.mall.cart(!!c.tipped),
  'mall.rubble': (P, c) => P.mall.rubble(c.v ?? 0, c.n ?? 2),
  van: (P, c) => P.veh.vehicleProp('van', { variant: c.variant ?? 0 }),
};

/** A template's bank (vox.js: four layers, matte, gloss, metal, lit) as meshes, in metres, its origin at its base's middle. */
function meshesOf(THREE, bank) {
  const out = [];
  bank.L.forEach((L, k) => {
    if (!L.v) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(L.P.a.slice(0, L.v * 3), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(Float32Array.from(L.N.a.subarray(0, L.v * 3), n => Math.sign(n)), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(L.C.a.slice(0, L.v * 3), 3));
    g.setIndex(new THREE.BufferAttribute(L.I.a.slice(0, L.I.n), 1));
    g.computeBoundingSphere();
    const mat = k === 3
      ? new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true })
      : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: k === 1 ? 0.35 : k === 2 ? 0.4 : 0.85, metalness: k === 2 ? 0.55 : 0, transparent: true });
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    out.push(m);
  });
  return out;
}

/**
 * Stands a site's cover on the city: → { group, list: [{ says, box: world [x0, z0, x1, z1] }], remove() }. The kits
 * load from the pinned city's own modules.
 */
export async function placeCover({ city, CITY, actors, site }) {
  const THREE = city.THREE;
  const group = new THREE.Group();
  group.name = 'fight:cover';
  const list = [];
  if (!site.cover?.length) return { group, list, fade() {}, remove() {} };
  const [city0, mall, veh] = await Promise.all([import(`${CITY}props.js`), import(`${CITY}districts/mall/props.js`), import(`${CITY}vehicles/index.js`)]);
  const P = { city: city0, mall, veh };
  for (const c of site.cover) {
    const make = KITS[c.kit];
    if (!make) {
      console.warn(`[fight] no kit ${c.kit} for the cover`);
      continue;
    }
    const bank = make(P, c);
    const piece = new THREE.Group();
    for (const m of meshesOf(THREE, bank)) piece.add(m);
    const [x, z] = c.at;
    piece.position.set(x, actors.groundAt(x, z), z);
    piece.rotation.y = c.yaw ?? 0;
    piece.name = `fight:cover:${c.kit}`;
    group.add(piece);
    // (its footprint on the ground, from its own mesh, for the stage's walkers)
    piece.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(piece);
    list.push({ says: c.says ?? c.kit, box: [b.min.x, b.min.z, b.max.x, b.max.z], top: b.max.y, post: !!c.post, piece, B: b.clone(), fade: 1 });
  }
  city.scene.add(group);
  actors.addSolid?.((x, z) => {
    for (const q of list) if (q.post && x > q.box[0] - 0.1 && x < q.box[2] + 0.1 && z > q.box[1] - 0.1 && z < q.box[3] + 0.1) return q.says;
    return null;
  });
  // SEE-THROUGH, AS THE CITY'S BUILDINGS ARE (seethrough.js): a piece between the camera and anyone of the fight
  // fades, so nobody fights hidden behind a van; it comes back when the line is clear
  const ray = new THREE.Ray();
  const hit = new THREE.Vector3();
  const to = new THREE.Vector3();
  function fade(points, dt = 1 / 60) {
    const eye = city.camera.position;
    for (const q of list) {
      let behind = false;
      for (const [x, y, z] of points) {
        to.set(x, y, z);
        const d = to.distanceTo(eye);
        ray.set(eye, to.sub(eye).normalize());
        if (ray.intersectBox(q.B, hit) && hit.distanceTo(eye) < d - 0.3) {
          behind = true;
          break;
        }
      }
      const want = behind ? 0.3 : 1;
      q.fade += (want - q.fade) * Math.min(1, dt / 0.12);
      if (Math.abs(q.fade - want) < 0.01) q.fade = want;
      q.piece.traverse(m => {
        if (!m.material) return;
        m.material.opacity = q.fade;
        m.material.depthWrite = q.fade > 0.99;
      });
    }
  }
  return {
    group,
    list: list.map(q => ({ says: q.says, box: q.box, top: q.top, post: q.post })),
    fade,
    remove() {
      group.removeFromParent();
    },
  };
}
