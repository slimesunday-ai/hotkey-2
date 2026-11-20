// THE GUARD DOG (assets-1). The owner, 2026-11-17: "I also think guard dog exists in the crafter game and has animations, we could
// pull some stuff from there as well". This is that dog, brought across from the older game (its src/home/dog-look.js, read only
// there): the chain dog's body, a big red-nose pit mutt in the trunk's voxel hand at 3.5 cm (a fawn coat, a darker saddle, a black mask,
// a white blaze and socks, a red studded collar, rose ears, the left one notched, amber eyes) or the ditch patch's black and tan, in
// parts that move: the body, the head, the jaw, the tail, four legs and the eyes, each a voxel list meshed with the city's own vox.js.
// The poses are the older game's, unchanged: stand · walk · lie · sleep · sit · happy · growl · bark · hold · cower. Nobody hurts a
// dog in that game and nobody does here: no pose for it. No rules: what he does in a break-in is not decided here.
//
// No three at the top level (the run's props take it: props/goods.js): THREE, the city's vox.js and glue.js are handed in.
//   const dog = createDog(THREE, VOX, GLUE, { coat: 'fawn' | 'black-tan', mode: 'sit', size: SIZE })
//   dog.root (a Group, nose to +z, standing on y 0) · dog.setMode(name) · dog.mode · dog.tick(dt) (each frame: the pose eases, the
//   bark snaps) · dog.settle() (straight to the pose, for a still) · dog.dispose()
export const DS = 0.035;
/**
 * HIS SIZE (second art pass, 2026-11-17: the owner, "he is too big for his bed"): the whole rig drawn at SIZE, so the older game's
 * 3.5 cm dog (a 0.6 m shoulder, about 1 m nose to tail lying down) becomes a 0.43 m shoulder, 0.72 m lying: he lies inside the kit's
 * dog bed (security.js 'dog-bed': a 0.75 m ring) instead of over it. The poses are unchanged: they are all inside the scaled rig.
 */
export const SIZE = 0.72;
export const MODES = ['stand', 'walk', 'lie', 'sleep', 'sit', 'happy', 'growl', 'bark', 'hold', 'cower'];

const FAWN = { coat: 0xb87c46, coatL: 0xc98c52, coatD: 0x96602f, saddle: 0x86542a, white: 0xf2ece0, whiteD: 0xdcd2c2, mask: 0x4a2e1e, nose: 0x6a3a2e, eye: 0xd9962a, pupil: 0x141214,
  brow: 0x7a4a26, ear: 0x8a5630, collar: 0xb81e24, stud: 0xd8dde4, tongue: 0xd85a6a, mouth: 0x3a1418, pad: 0x3a2a26, nail: 0x2a2224, lid: 0x9a6a3e };
const BLACK_TAN = { ...FAWN, coat: 0x1e1c1a, coatL: 0x2a2724, coatD: 0x141312, saddle: 0x181614, white: 0x9a5a2a, whiteD: 0x84491f, mask: 0xa8683a, nose: 0x101010, eye: 0x6a3c18,
  brow: 0xb07040, ear: 0x161412, lid: 0x24201c, blaze: 0x1e1c1a, muzzle: 0xa8683a, cheek: 0x9a5a2a, stripe: 0x141312 };
export const COATS = { fawn: FAWN, 'black-tan': BLACK_TAN };

// ── the parts, each a voxel list in its own pivot's frame (the older game's, line for line; C is the coat being built)
function parts(C) {
  // (second pass: the coat calmed into a few clear shapes, one coat colour and one darker saddle down the back, with no speckle: the
  // owner, "a little noisy". The white chest, blaze and socks, the black mask and the red collar stay the shapes they were)
  const coat = (x, y, z) => y > 15.5 && Math.abs(x) < 2.5 && z < 8 ? C.saddle : C.coat;
  const L = () => { const out = []; const f = { out, set(x, y, z, c, l = 0) { out.push([Math.round(x), Math.round(y), Math.round(z), c, l]); return f; } }; return f; };
  const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
  function slab(f, z0, z1, sec, col) { for (let z = z0; z <= z1; z++) { const s = sec(z); if (!s) continue; const { w, y0, y1 } = s, yc = (y0 + y1) / 2, hh = (y1 - y0) / 2;
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = -Math.ceil(w); x <= Math.ceil(w); x++) { const u = Math.abs(x) / (w + .35), v = Math.abs(y + .5 - yc) / (hh + .35); if (u ** 3 + v ** 3 > 1) continue; f.set(x, y, z, col(x, y, z)); } } }
  function torso() { const f = L();
    slab(f, -10, 10, z => { const chest = z >= 3, waist = z > -5 && z < 3; return { w: chest ? 4.1 : waist ? 3.4 : 4, y0: chest ? lerp(9, 6.8, (z - 3) / 3) : waist ? lerp(9.4, 10.6, (z + 4) / 3) : lerp(9.6, 9, (z + 10) / 4), y1: chest ? 17 : waist ? 16.2 : lerp(16.4, 17, (z + 10) / 4) }; },
      (x, y, z) => (z >= 7 && y < 15 && Math.abs(x) < 3.2 - (15 - y) * .05) || (y < 8.2 && z > 2 && Math.abs(x) < 2) ? C.white : coat(x, y, z));
    slab(f, 7, 12, z => ({ w: 3.3, y0: lerp(13, 16, (z - 7) / 5), y1: lerp(18, 21, (z - 7) / 5) }), (x, y, z) => z >= 10 && y < 18 && Math.abs(x) < 2.5 ? C.white : coat(x, y, z));
    for (let a = 0; a < 28; a++) { const t = a / 28 * Math.PI * 2, x = Math.cos(t) * 3.9, y = 18.6 + Math.sin(t) * 3.2; f.set(x, y, 9.4 + Math.sin(t) * .8, C.collar).set(x, y - 1, 9.4 + Math.sin(t) * .8, C.collar); if (a % 4 === 1) f.set(x * 1.18, y + Math.sin(t) * .3, 9.4 + Math.sin(t) * .8, C.stud, 2); }
    return f.out; }
  function head(closed = false) { const f = L();
    slab(f, -1, 5, z => ({ w: z < 1 ? 3.6 : 4.2, y0: 0, y1: z > 3 ? 5.8 : 6.4 }), (x, y, z) => Math.abs(x) < 1 && y > 3 && z > 2 ? C.blaze ?? C.white : y > 6 && z < 2 ? C.saddle : coat(x, y, z + 3));
    for (const sx of [-1, 1]) for (let z = 1; z <= 4; z++) for (let y = 1; y <= 2; y++) f.set(sx * 5, y, z, C.cheek ?? C.coat);
    slab(f, 5, 8, z => ({ w: lerp(3, 2.6, (z - 5) / 3), y0: .4, y1: lerp(4, 3.4, (z - 5) / 3) }), (x, y, z) => Math.abs(x) < 1 && y > 2 && z < 7 ? C.blaze ?? C.white : z > 6 || y < 1 ? C.mask : C.muzzle ?? C.coat);
    f.set(-1, 3, 9, C.nose, 1).set(0, 3, 9, C.nose, 1).set(1, 3, 9, C.nose, 1).set(0, 2, 9, C.nose, 1);
    for (const sx of [-1, 1]) { f.set(sx * 2, 5, 5, C.brow).set(sx * 3, 5, 5, C.brow); if (closed) f.set(sx * 2, 4, 6, C.lid).set(sx * 3, 4, 6, C.lid); }
    for (const sx of [-1, 1]) for (const [x, y, z] of [[3, 6, 2], [4, 6, 2], [4, 7, 1], [3, 7, 1], [5, 6, 1], [4, 5, 3], [3, 7, 0], [4, 6, 0]]) { if (sx < 0 && x === 5) continue; f.set(sx * x, y, z, C.ear); }
    return f.out; }
  const eyes = () => { const f = L(); for (const s of [-1, 1]) f.set(s * 2, 4, 6, C.pupil, 1).set(s * 3, 4, 6, C.eye, 1); return f.out; };
  function jaw() { const f = L();
    slab(f, 0, 7, z => ({ w: lerp(2.8, 2.1, z / 7), y0: -1.4, y1: .2 }), (x, y, z) => y > -.5 && Math.abs(x) < 1.4 && z > 1 ? (z < 6 ? C.tongue : C.mouth) : z > 5 ? C.mask : y < -.5 && Math.abs(x) < 1.2 && z > 3 ? C.whiteD : coat(x, y, z));
    for (const s of [-1, 1]) f.set(s * 2, 1, 6, C.white);
    return f.out; }
  const tongueOut = () => { const f = L(); for (let z = 0; z < 4; z++) f.set(0, -z * .7, z, C.tongue).set(1, -z * .7, z, C.tongue); return f.out; };
  const tail = () => { const f = L(); for (let k = 0; k < 9; k++) { const r = k < 3 ? 1 : 0, y = k * .35, z = -k; for (let x = -r; x <= 0; x++) for (let dy = -r; dy <= 0; dy++) f.set(x, y + dy, z, k > 6 ? C.stripe ?? coat(x, Math.round(y), z) : coat(x, Math.round(y), z)); } return f.out; };
  function frontLeg() { const f = L(); for (let y = -11; y <= 0; y++) { const w = y > -4 ? 2 : 1.5, sock = y < -9; for (let x = -Math.round(w); x <= Math.round(w) - 1 + (w < 2 ? 1 : 0); x++) for (let z = -1; z <= 1; z++) f.set(x, y, z, sock ? C.white : coat(x, y + 11, z + 6)); }
    for (let x = -2; x < 2; x++) for (let z = -1; z < 3; z++) f.set(x, -11, z, C.white); for (const x of [-2, -1, 0, 1]) f.set(x, -11, 3, C.nail);
    return f.out; }
  function backLeg() { const f = L(), seg = (a, b, w) => { const n = 12; for (let k = 0; k <= n; k++) { const t = k / n, y = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, r = w(t);
      for (let x = -Math.round(r); x < Math.round(r); x++) for (let dz = -1; dz <= 1; dz++) f.set(x, y, z + dz * (r > 1.5 ? 1 : .6), coat(x, Math.round(y) + 12, Math.round(z) - 7)); } };
    seg([1, 0], [-6, 1.5], t => lerp(2.6, 1.9, t)); seg([-6, 1.5], [-9.5, -1.2], () => 1.6); seg([-9.5, -1.2], [-11.5, -.6], () => 1.5);
    for (let x = -2; x < 2; x++) for (let z = -1; z < 3; z++) f.set(x, -12, z, z === 2 ? C.nail : C.coatD);
    return f.out; }
  return { torso: torso(), skullOpen: head(false), skullShut: head(true), eyes: eyes(), jaw: jaw(), tongue: tongueOut(), tail: tail(), frontLeg: frontLeg(), backLeg: backLeg() };
}

export function createDog(THREE, VOX, GLUE, o = {}) {
  const MATS = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.85 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })];
  const geos = [];
  // a voxel list → a group of meshes (one per material), through the city's own mesher
  function meshAt(list) {
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (const [x, y, z] of list) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z); x1 = Math.max(x1, x); y1 = Math.max(y1, y); z1 = Math.max(z1, z); }
    const V = new VOX.Vol(x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1, { s: DS, org: [x0 * DS, y0 * DS, z0 * DS], ground: false });
    for (const [x, y, z, c, l] of list) V.set(x - x0, y - y0, z - z0, c, l || 0);
    const b = new VOX.Bank(true); VOX.meshVol(V, b);
    const g = new THREE.Group();
    b.L.forEach((O, li) => { if (!O.v) return; const geo = GLUE.geoOf(O); geos.push(geo); const m = new THREE.Mesh(geo, MATS[li]); m.castShadow = li !== 3; m.receiveShadow = true; g.add(m); });
    return g;
  }
  const S = parts(COATS[o.coat] ?? FAWN);
  const P3 = v => new THREE.Vector3(v[0] * DS, v[1] * DS, v[2] * DS);
  // the rig: root (on the ground) → hips (pitch: sitting, lying) → body (torso, the neck's head pivot, front legs, tail) and the back legs
  const root = new THREE.Group(); root.name = 'dog';
  // (his size: the rig under the root, scaled; the root stays where the caller puts it, unscaled)
  const rig = new THREE.Group(); rig.scale.setScalar(o.size ?? SIZE); root.add(rig);
  const hips = new THREE.Group(); hips.position.copy(P3([0, 12, -7])); rig.add(hips);
  const body = new THREE.Group(); body.position.copy(P3([0, -12, 7])); hips.add(body);
  body.add(meshAt(S.torso));
  const neck = new THREE.Group(); neck.position.copy(P3([0, 17.5, 10.5])); body.add(neck);
  const headG = new THREE.Group(); neck.add(headG);
  const skullOpen = meshAt(S.skullOpen), skullShut = meshAt(S.skullShut), eyeM = meshAt(S.eyes); headG.add(skullOpen, skullShut, eyeM); skullShut.visible = false;
  headG.position.copy(P3([0, -1, -1]));
  const jawG = new THREE.Group(); jawG.position.copy(P3([0, 1, 1])); headG.add(jawG); jawG.add(meshAt(S.jaw));
  const tongue = meshAt(S.tongue); tongue.position.copy(P3([0, -.5, 6])); jawG.add(tongue); tongue.visible = false;
  const tailG = new THREE.Group(); tailG.position.copy(P3([0, 16, -10])); body.add(tailG); tailG.add(meshAt(S.tail));
  const legs = []; const fl = meshAt(S.frontLeg), bl = meshAt(S.backLeg);
  for (const [x, z, front] of [[-2.6, 6, 1], [2.6, 6, 1], [-2.6, -7, 0], [2.6, -7, 0]]) { const g = new THREE.Group(), m = (front ? fl : bl).clone(); g.add(m);
    if (front) { g.position.copy(P3([x, 11, z])); body.add(g); } else { g.position.copy(P3([x, 0, 0])); hips.add(g); } legs.push({ g, front, side: Math.sign(x) }); }
  // the pose: the older game's, unchanged (where each joint wants to be in a mode, eased toward it; the trot and the gallop; the blink)
  const k = { hipY: 0, pitch: 0, fold: 0, headP: 0, headY: 0, headR: 0, neckY: 0, jaw: 0, tailP: .6 };
  let ph = 0, wag = 0;
  function pose(st, dt) { const m = st.mode, t = st.t ?? 0, sp = st.speed ?? 0, a = 1 - Math.exp(-dt * 9);
    const W = { hipY: 0, pitch: 0, fold: 0, headP: 0, headY: 0, headR: 0, neckY: 0, jaw: 0, tailP: .55, wagA: .25, wagF: 5 };
    if (m === 'lie' || m === 'sleep') Object.assign(W, { hipY: -.235, fold: 1, headP: m === 'sleep' ? .62 : .05, neckY: m === 'sleep' ? -.13 : -.04, tailP: -.25, wagA: m === 'sleep' ? 0 : .12, wagF: 2 });
    else if (m === 'sit' || m === 'happy') Object.assign(W, { hipY: -.23, pitch: -.52, fold: -1, headP: .3, headR: m === 'happy' ? .22 * Math.sin(t * .9) : 0, tailP: -.75, wagA: m === 'happy' ? .7 : .2, wagF: m === 'happy' ? 13 : 4, jaw: m === 'happy' ? .2 : 0 });
    else if (m === 'growl') Object.assign(W, { hipY: -.05, pitch: .06, headP: .22, neckY: -.03, jaw: .1 + .04 * Math.sin(t * 40), tailP: .9, wagA: 0 });
    else if (m === 'bark') Object.assign(W, { pitch: -.04, headP: -.14, jaw: .05, tailP: .95, wagA: .05, wagF: 9 });
    else if (m === 'hold') Object.assign(W, { hipY: -.06, pitch: .1, headP: .32, headY: .38 * Math.sin(t * 17), headR: .2 * Math.sin(t * 17 + 1), jaw: .04, tailP: .7, wagA: 0 });
    else if (m === 'cower') Object.assign(W, { hipY: -.15, pitch: .12, headP: .5, neckY: -.08, headY: .15, tailP: -1.05, wagA: .04, wagF: 22 });
    for (const key of ['hipY', 'pitch', 'fold', 'headP', 'headY', 'headR', 'neckY', 'tailP']) k[key] += (W[key] - k[key]) * a;
    k.jaw += ((W.jaw + (st.bark ?? 0) * .55) - k.jaw) * Math.min(1, dt * 30);
    const moving = sp > .15 && (m === 'stand' || m === 'walk' || m === 'bark' || m === 'growl' || m === 'cower'); ph += dt * (moving ? Math.min(16, 4 + sp * 2.1) : 0);
    const gal = sp > 3, amp = moving ? Math.min(.75, .25 + sp * .09) : 0;
    wag += dt * W.wagF; const wagY = Math.sin(wag) * W.wagA;
    hips.position.y = (12 * DS) + k.hipY + (moving ? Math.abs(Math.sin(ph)) * (gal ? .045 : .02) : 0) + (m === 'sleep' ? Math.sin(t * 1.6) * .004 : 0);
    hips.rotation.x = k.pitch + (moving && gal ? Math.sin(ph * 2) * .06 : 0); body.rotation.z = m === 'cower' ? Math.sin(t * 30) * .012 : 0;
    neck.position.y = 17.5 * DS + k.neckY; headG.rotation.set(k.headP + (moving ? Math.sin(ph * 2) * .05 : 0), k.headY, k.headR);
    jawG.rotation.x = Math.max(0, k.jaw); tongue.visible = m === 'happy' || (moving && sp > 3.5);
    tailG.rotation.set(k.tailP, wagY, 0);
    const shut = m === 'sleep'; skullOpen.visible = !shut; skullShut.visible = shut; eyeM.visible = !shut && !(m === 'lie' && (t % 4.3) < .14);
    for (const L2 of legs) { const fold = k.fold, phase = L2.front ? (gal ? 0 : (L2.side > 0 ? 0 : Math.PI)) : (gal ? Math.PI * .6 : (L2.side > 0 ? Math.PI : 0)), sw = Math.sin(ph + phase + (gal ? L2.side * .25 : 0)) * amp;
      if (L2.front) L2.g.rotation.x = fold > 0 ? -1.45 * fold : -k.pitch + sw;
      else L2.g.rotation.x = fold > 0 ? -1.3 * fold : fold < 0 ? -.85 * -fold : -sw; }
    root.updateMatrixWorld(); }
  // (a bark: the jaw snaps open twice a second and falls back; the other modes hold their own pose)
  const st = { mode: MODES.includes(o.mode) ? o.mode : 'sit', t: 0, speed: 0, bark: 0 };
  for (let i = 0; i < 40; i++) pose(st, 0.1);
  return {
    root,
    get mode() { return st.mode; },
    setMode(m) { if (MODES.includes(m)) st.mode = m; return st.mode; },
    /** (anim-1, the hands: a dog that follows somebody) how fast he is going (m/s): the legs walk or run to it. */
    set speed(v) { st.speed = Math.max(0, +v || 0); },
    /** The pose straight to where the mode holds it (for a still picture). */
    settle() { for (let i = 0; i < 40; i++) this.tick(0.1); },
    tick(dt) { st.t += dt; if (st.mode === 'bark') { const c = (st.t * 2) % 1; st.bark = c < .15 ? 1 : Math.max(0, 1 - (c - .15) * 4); } else st.bark = 0; pose(st, Math.min(0.1, dt)); },
    dispose() { for (const g of geos) g.dispose(); for (const m of MATS) m.dispose(); root.removeFromParent(); },
  };
}
