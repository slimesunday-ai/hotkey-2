// MR. PRUITT'S WORKBENCH (notes-2, the owner 2026-11-19: "We should give him a work bench"). His yard work is the city's
// bench_hammer loop (demo/run/scenes.js: 'npc:neighbour:2' in the yard at 12 and 16), and that clip is posed against a
// bench and an anvil in front of him (anim/cast/clips/bench.md "What the city must stage"); nothing stood there, so he
// hammered the air. This puts the city's own bench in his yard, built as the city's stage builds it for its Gunrunner
// (style/city/stage/record.js buildSet): the bench with its anvil (anim/cast/clips/bench-props.js benchSetGeometry, the
// numbers the clip was solved against: the hammer's face lands flat on the anvil's top), the vise (stage/setprops.js
// viseGeometry, ported from slime's crafter game) and its lamp (lampGeometry, unlit). Nothing new is drawn.
//
// It stands in the walker's body frame of the place he works from (WORK: his spot, the clip, where he stands and the
// way he faces), at HIS size (actors.sizeOf: he is drawn 1.05 times the standard figure, the clip's every point with
// him, so the bench is too and the hammer still meets the anvil). It is always there while his block stands (it is his
// yard's, not a prop of the hour); a solid to anybody of ours (actors.addSolid: nobody is walked through it, the audit
// counts anybody found in it) and to the city's crowd (two discs in its body map, as props/along.js does the cart).
//
//   workAt(spot, clip) → [x, z, ry] or null   where somebody at that spot plays that clip from (director.js lifeStep)
//   await createWorkbenches({ city, CITY, actors })
//     .state() → [{ spot, who, shown, at, y, size }]   for the tools
//     .anvilTop(spot) → the anvil's top in the world (y), or null

/**
 * The places somebody works at a bench of ours, in the world (m): his spot, the clip, and where he stands for it,
 * facing the bench. Mr. Pruitt's yard point (places.json home:a3:yard) has his things against it on the west and the
 * south (measured 2026-11-19: solid within 0.25 m of it there), and open ground to the east, toward the game's camera
 * over the park and clear of the way up to his step (1.8 m east): he faces east, the bench in front of him.
 */
export const WORK = [{ spot: 'home:a3:yard', who: 'npc:neighbour:2', clip: 'bench_hammer', at: [-242.7, -49.1, Math.PI / 2] }];

export const workAt = (spot, clip) => WORK.find(w => w.spot === spot && w.clip === clip)?.at ?? null;

export async function createWorkbenches({ city, CITY, actors }) {
  const THREE = city.THREE;
  const [BP, SP] = await Promise.all([import(`${CITY}anim/cast/clips/bench-props.js`), import(`${CITY}stage/setprops.js`)]);
  const B = BP.BENCH;
  // (the city stage's own materials for its sets: record.js vc() and benchM)
  const mat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  // the bench's footprint in its body frame (m): x across, z ahead; the lamp's foot and the vise are on it
  const FOOT = { x0: -B.HALF, x1: B.HALF, z0: B.FRONT, z1: B.BACK };
  const benches = WORK.map(w => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(BP.benchSetGeometry(THREE), mat()), new THREE.Mesh(SP.viseGeometry(THREE), mat()), new THREE.Mesh(SP.lampGeometry(THREE), mat()));
    for (const m of g.children) m.castShadow = m.receiveShadow = true;
    g.name = `hk2:workbench:${w.spot}`;
    g.visible = false;
    city.scene.add(g);
    return { ...w, g, size: 1, y: 0, shown: false };
  });
  /** A body-frame point of a bench → the world ([x, z]). */
  const toW = (b, bx, bz) => {
    const [x, z, ry] = b.at;
    const [c, s] = [Math.cos(ry), Math.sin(ry)];
    return [x + (bx * c + bz * s) * b.size, z + (-bx * s + bz * c) * b.size];
  };
  /** A world point → the bench's body frame (its own size taken out). */
  const toB = (b, x, z) => {
    const [dx, dz] = [(x - b.at[0]) / b.size, (z - b.at[1]) / b.size];
    const [c, s] = [Math.cos(b.at[2]), Math.sin(b.at[2])];
    return [dx * c - dz * s, dx * s + dz * c];
  };
  const inFoot = (b, x, z) => {
    const [bx, bz] = toB(b, x, z);
    return bx > FOOT.x0 && bx < FOOT.x1 && bz > FOOT.z0 && bz < FOOT.z1;
  };
  // A SOLID to anybody of ours: no way is laid through it, nobody is stood in it, the audit counts anybody in it
  actors.addSolid?.((x, z) => (benches.some(b => b.shown && inFoot(b, x, z)) ? 'a workbench' : null));
  let since = 1;
  actors.onFrame(dt => {
    since += dt;
    for (const b of benches) {
      // (looked at twice a second: his block's ground is there, and his size once he is on stage)
      if (since > 0.5) {
        const known = !!actors.solidKnown?.(b.at[0], b.at[1]);
        const size = actors.has(b.who) ? actors.sizeOf?.(b.who) ?? 1 : b.size;
        if (known && (!b.shown || size !== b.size)) {
          b.size = size;
          b.y = actors.groundAt(b.at[0], b.at[1]);
          b.g.position.set(b.at[0], b.y, b.at[1]);
          b.g.rotation.set(0, b.at[2], 0);
          b.g.scale.setScalar(size);
        }
        b.shown = known;
        b.g.visible = known;
      }
      if (!b.shown) continue;
      // the city's crowd steps round it (two discs along it, in the body map our people are published in)
      const sim = city.peds?.sim;
      if (sim?.bodies) for (const bx of [-0.33, 0.33]) {
        const [x, z] = toW(b, bx, (FOOT.z0 + FOOT.z1) / 2);
        sim.bodies.push({ x, z, r: 0.45 * b.size, w: null, room: 0 });
      }
    }
    if (since > 0.5) since = 0;
  });
  return {
    state: () => benches.map(b => ({ spot: b.spot, who: b.who, shown: b.shown, at: b.at, y: b.y, size: b.size })),
    anvilTop(spot) {
      const b = benches.find(q => q.spot === spot);
      return b?.shown ? b.y + B.anvil.top * b.size : null;
    },
  };
}
