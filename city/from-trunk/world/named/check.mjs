// THE NAMED CAST · the pool's check (its rules: index.js). Pure node: 'three' is the studio audit's stand-in (compose only).
//   node world/named/check.mjs        exit 1 on any failure
// 1 THE WALL      every piece resolves through the registry by id and nothing lists it: not the agents' pool or the crowd's (REG,
//                 NPC_REG, list()), not the city's roll tables (style/city/cast.js CAST, NPC_CAST, UNIFORM_CAST), never in 2000 rolls
//                 of either pool or the city's named handles (LOOKS), and wear() refuses it (no outfit can put it on anyone)
// 2 BY NAME       each person wears only their own pieces, every piece is worn by its owner, and each name finds its person
// 3 THE SHAPES    trousers on an approved leg form (no skirt, no new form), shoes on an approved last, a scale in bounds
// 4 THE FIT       composed as the city composes: no top or accessory below the hem row (y 9) or in the head's box; an accessory at most two
//                 proud of the chest under it; the held piece fills its channel, keeps out of the fist, stays in its pose's envelope,
//                 is one piece through the channel and at most 120 voxels; nothing floats (each grid one piece, each foot one piece,
//                 every fine voxel joined to a voxel); fine detail within its budget (64 painted faces, 32 fine voxels a piece, none
//                 missed or buried); THE BEARD RULE (a head piece below the chin keeps in front of z 4 and off the body, within the jaw)
// 5 SIGNATURES    no two people share a signature colour (RGB distance under 40)
// 6 PROPS         (index.js § PROPS) each prop is found by every name of its owner and by nobody else's; it is drawn at the half grain
//                 at its owner's scale; one piece (nothing floats); it stands on its wheels only (what touches the ground is the wheels'
//                 contact patches, one at each stated wheel point); its handle is a straight bar through both fists of its hold, the
//                 hold's grip within half a figure voxel of the bar's middle with the owner at push.stand, and it lies behind the back
//                 wheels (forward is +z); the owner (head, body, legs and shoes, at rest and at the static walk's stride; the arms in the
//                 hold, the fists apart) is clear of it when pushing it and when it is parked; the owner's palette (its colours that are
//                 not grey) touches it in one small way (at least one cell, at most 3 %); within the city's box for a shaped piece
//                 (style/city/interiors/FORMAT.md: 24 cell-metres, 2 m tall) and at most 10,000 triangles in its near mesh, as the city
//                 meshes it (a named figure's own: 6,676 to 9,768 in the preview, look.js)
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
register(pathToFileURL(path.join(ROOT, 'style/city/studio/audit/hooks.mjs')).href);
const CH = await import('../cast/chars.js'), CITY = await import('../../style/city/cast.js'), R = await import('../cast/fresh/index.js');
const N = await import('./index.js'), HELD = await import('../cast/fit/held.js'), { legForm } = await import('../cast/fit/leg-forms.js');
const { LASTS } = await import('../cast/fit/shoe.js'), { hd, cellOf, FINE } = await import('../cast/fit/fine.js'), { BEARD_Z } = await import('./kit.js');

let fails = 0; const fail = (who, m) => { fails++; console.log(`FAIL ${who}: ${m}`); };
const dec = k => [(k >> 18) - 256, ((k >> 9) & 511) - 256, (k & 511) - 256];
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const cells = G => [...G.keys()].map(dec);
// 6-connected components of a set of [x, y, z]
function parts(list) { const key = ([x, y, z]) => `${x},${y},${z}`, all = new Set(list.map(key)), seen = new Set(), out = [];
  for (const c of list) { const k0 = key(c); if (seen.has(k0)) continue; const comp = [c]; seen.add(k0);
    for (let i = 0; i < comp.length; i++) for (const [a, b, d] of N6) { const n = [comp[i][0] + a, comp[i][1] + b, comp[i][2] + d], k = key(n); if (all.has(k) && !seen.has(k)) { seen.add(k); comp.push(n); } }
    out.push(comp); }
  return out; }

// ── 0 the pool loads clean
if (N.PROBLEMS.length) for (const p of N.PROBLEMS) fail('pool', p);
const ALL = R.SLOTS.flatMap(s => Object.values(N.NAMED_REG[s]));

// ── 1 THE WALL
for (const t of ALL) {
  const w = `${t.slot}/${t.id}`;
  if (R.entry(t.slot, t.id) !== t) fail(w, 'not resolvable through the registry (entry)');
  if (R.list(t.slot, 'all').includes(t) || Object.keys(R.REG[t.slot]).includes(t.id) || Object.keys(R.NPC_REG[t.slot]).includes(t.id)) fail(w, 'listed in the agents\' or the crowd\'s pool');
  for (const [nm, T] of [['CAST', CITY.CAST], ['NPC_CAST', CITY.NPC_CAST], ['UNIFORM_CAST', CITY.UNIFORM_CAST]]) if ((T[t.slot] || []).some(e => e.id === t.id)) fail(w, `in the city's ${nm}`);
  const L = CITY.rollLook(7, { pool: 'npc' }), before = JSON.stringify(L); CITY.wear(L, { [t.slot]: t.id }); if (JSON.stringify(L) !== before) fail(w, 'wear() put it on a rolled person');
}
const ids = new Set(ALL.map(t => t.id)), inLook = L => Object.values(L).some(v => ids.has(typeof v === 'string' ? v : v && v.id));
for (let s = 0; s < 1000; s++) for (const pool of ['agent', 'npc']) if (inLook(CITY.rollLook(s * 2654435761 >>> 0, { pool }))) fail('roll', `a ${pool} roll (seed ${s}) wore a named piece`);
for (const L of CITY.LOOKS) if (inLook(L)) fail('LOOKS', `${L.handle} wears a named piece`);

// ── 2 BY NAME
for (const p of N.PEOPLE) {
  for (const n of [p.key, p.name, ...p.aka]) if (N.personOf(n) !== p) fail(p.key, `the name "${n}" does not find them`);
  const L = N.lookOf(p.name);
  for (const s of R.SLOTS) { const v = L[s], id = typeof v === 'string' ? v : v && v.id; if (!id || id === 'none' || id === 'base') continue;
    if (N.ownerOf(s, id) !== p.key) fail(p.key, `${s}: ${id} is not their own piece`); }
}
for (const t of ALL) { const p = N.personOf(t.owner), L = p && N.lookOf(p.key), v = L && L[t.slot]; if ((typeof v === 'string' ? v : v && v.id) !== t.id) fail(`${t.slot}/${t.id}`, 'not worn by its owner'); }

// ── 3 THE SHAPES, 4 THE FIT
const report = [];
for (const p of N.PEOPLE) {
  const who = p.key, L = N.lookOf(who), E = s => { const v = L[s], id = typeof v === 'string' ? v : v && v.id; return id && id !== 'none' ? R.entry(s, id) : null; };
  if (!(p.scale >= N.SCALE.min && p.scale <= N.SCALE.max)) fail(who, `scale ${p.scale} out of bounds`);
  const bt = E('bottom'); if (!bt || bt.formSpec || !legForm(bt.form)) fail(who, 'bottoms not on an approved leg form');
  const sh = E('shoes'); if (!sh || !LASTS[sh.last]) fail(who, 'shoes not on an approved last');
  const C = CH.compose(L), { H, B, SH, HX, F, Fc, tag, htag, flog } = C;
  // tops and accessories: never below the hem row, never in the head's box
  for (const k of B.keys()) { const t = tag.get(k), [x, y, z] = dec(k);
    if (t === 'top' && y < 9) fail(who, `a top voxel below y 9 at ${x},${y},${z}`);
    if (t !== 'hands' && y >= 19 && x >= -8 && x <= 7 && z >= -7 && z <= 7) fail(who, `a body voxel (${t}) in the head's box at ${x},${y},${z}`); }
  // an accessory: at most two proud of what is under it (the look composed without it)
  if (E('acc')) { const B0 = CH.compose({ ...L, acc: { id: 'none' } }).B, front = new Map();
    for (const [x, y, z] of cells(B0)) { const k = x * 1000 + y; if (!front.has(k) || z > front.get(k)) front.set(k, z); }
    for (const k of B.keys()) { if (B0.has(...dec(k))) continue; const [x, y, z] = dec(k); if (z > 0 && z > (front.get(x * 1000 + y) ?? 2) + 2) fail(who, `the accessory stands more than two proud at ${x},${y},${z}`); } }
  // the held piece
  const hl = E('held');
  if (hl) { const pose = hl.pose, grip = HELD.gripCells(pose), has = (x, y, z) => HX.has(x, y, z), list = cells(HX);
    for (const [x, y, z] of grip) if (!has(x, y, z)) fail(who, `held: the channel cell ${x},${y},${z} is empty`);
    const inGrip = (x, y, z) => grip.some(([a, b, c]) => a === x && b === y && c === z);
    for (const [x, y, z] of list) { if (HELD.inHand(x, y, z) && !inGrip(x, y, z)) fail(who, `held: inside the fist at ${x},${y},${z}`); if (!HELD.inEnvelope(pose, x, y, z)) fail(who, `held: outside the ${pose} envelope at ${x},${y},${z}`); }
    for (const k of HX.hv.keys()) { const [x, y, z] = cellOf(...hd(k)); if (!HELD.inEnvelope(pose, x, y, z)) fail(who, `held: a fine voxel outside the envelope at ${x},${y},${z}`); }
    if (list.length > HELD.BUDGET.voxels) fail(who, `held: ${list.length} voxels (budget ${HELD.BUDGET.voxels})`);
    const ps = parts(list); if (ps.length !== 1) fail(who, `held: ${ps.length} pieces (one, through the channel)`); }
  // nothing floats: the head grid is one piece, the body one, each foot one, the face's own grid joined to the head
  const hp = parts(cells(H)); if (hp.length !== 1) fail(who, `the head grid is ${hp.length} pieces (sizes ${hp.map(c => c.length).join(', ')})`);
  const bp = parts(cells(B)); if (bp.length !== 1) fail(who, `the body grid is ${bp.length} pieces (sizes ${bp.map(c => c.length).join(', ')})`);
  const sp = parts(cells(SH)); if (sp.length !== 2) fail(who, `the shoes are ${sp.length} pieces (two feet)`);
  // every fine voxel joined (through fine voxels) to a voxel of its grid, or the head's for the face
  for (const [nm, G, also] of [['head', H, null], ['body', B, null], ['shoes', SH, null], ['held', HX, null], ['face', F, H]]) {
    const hv = new Set(G.hv.keys()); if (!hv.size) continue; const ok = new Set(), q = [];
    const touches = (hx, hy, hz) => N6.some(([a, b, c]) => { const v = cellOf(hx + a, hy + b, hz + c); return G.has(...v) || (also && also.has(...v)); });
    for (const k of hv) { if (touches(...hd(k))) { ok.add(k); q.push(k); } }
    while (q.length) { const [hx, hy, hz] = hd(q.pop()); for (const [a, b, c] of N6) for (const k of hv) { if (ok.has(k)) continue; const [x, y, z] = hd(k); if (x === hx + a && y === hy + b && z === hz + c) { ok.add(k); q.push(k); } } }
    if (ok.size !== hv.size) fail(who, `${hv.size - ok.size} fine voxel(s) on the ${nm} touch nothing`); }
  // fine budgets, per piece
  let faces = 0, fv = 0;
  for (const [slot, st] of Object.entries(flog)) { faces += st.faces.size; fv += st.voxels;
    if (st.faces.size > FINE.faces) fail(who, `${slot}: ${st.faces.size} painted faces (budget ${FINE.faces})`); if (st.voxels > FINE.voxels) fail(who, `${slot}: ${st.voxels} fine voxels (budget ${FINE.voxels})`);
    if (st.miss) fail(who, `${slot}: ${st.miss} fine paint texel(s) landed on no voxel`); if (st.buried) fail(who, `${slot}: ${st.buried} fine voxel(s) buried in a voxel`); }
  // THE BEARD RULE: a head piece below the chin (y < 19) keeps off the body: in front of z BEARD_Z, within the jaw, clear of every body
  // voxel, and in front of the body's own front in its column (hair behind the head, a mullet, keeps behind the body's back instead)
  let below = 0;
  for (const [x, y, z] of cells(H)) { if (y >= 19) continue; below++;
    if (B.has(x, y, z)) fail(who, `a head voxel below the chin on a body voxel at ${x},${y},${z}`);
    if (x < -8 || x > 7) fail(who, `a head voxel below the chin outside the jaw at ${x},${y},${z}`);
    let lo = 99, hi = -99; for (let zz = -12; zz <= 12; zz++) if (B.has(x, y, zz)) { lo = Math.min(lo, zz); hi = Math.max(hi, zz); }
    if (z > 0 && (z < BEARD_Z || z <= hi)) fail(who, `a beard voxel at ${x},${y},${z} is behind z ${BEARD_Z} or inside the body's front (${hi})`);
    if (z <= 0 && z >= lo - 1) fail(who, `hair below the chin at ${x},${y},${z} is not clear behind the body's back (${lo})`); }
  // a mouth stays at most two proud of the face (z 9), eyewear's front at z 8
  for (const k of H.keys()) { const t = htag.get(k), [x, y, z] = dec(k); if (t === 'mouth' && z > 9) fail(who, `the mouth stands past z 9 at ${x},${y},${z}`); if (t === 'eyewear' && z > 8) fail(who, `the eyewear stands past z 8 at ${x},${y},${z}`); }
  report.push(`${who.padEnd(8)} scale ${p.scale.toFixed(2)} · ${Object.keys(p.ids).length} pieces · head ${H.keys ? [...H.keys()].length : 0} body ${[...B.keys()].length} held ${[...HX.keys()].length} voxels · fine ${faces} faces, ${fv} half voxels · ${below} below the chin`);
}

// ── 5 SIGNATURES
const rgb = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255], dist = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
for (let i = 0; i < N.PEOPLE.length; i++) for (let j = i + 1; j < N.PEOPLE.length; j++) { const a = N.PEOPLE[i], b = N.PEOPLE[j], d = dist(a.signature, b.signature);
  if (d < 40) fail(`${a.key}/${b.key}`, `signature colours ${d.toFixed(0)} apart (under 40)`); }

// ── 6 PROPS
const { propBank } = await import('./props/build.js'), { bodyPart } = await import('../cast/fit/body.js');
const PROP_TRIS = 10000, BOX_CM = 24, BOX_H = 2.0;
const sat = c => { const [r, g, b] = rgb(c), hi = Math.max(r, g, b), lo = Math.min(r, g, b); return hi ? (hi - lo) / hi : 0; };
for (const P of N.PROPS) {
  const who = `prop ${P.key}`, o = N.personOf(P.owner), M = N.propCells(P.src), list = [...M.keys()].map(N.cellAt), key = (x, y, z) => `${x},${y},${z}`, has = new Set(list.map(c => key(...c)));
  // by name: every name of the owner finds it; nobody else's does
  for (const n of [o.key, o.name, ...o.aka]) if (!N.propsOf(n).includes(P)) fail(who, `the name "${n}" does not find it`);
  for (const q of N.PEOPLE) if (q !== o && N.propsOf(q.key).includes(P)) fail(who, `${q.key} finds it`);
  if (P.grain !== .025 || P.scale !== o.scale || Math.abs(P.s - .025 * o.scale) > 1e-9) fail(who, `not at the half grain at its owner's scale (grain ${P.grain}, scale ${P.scale})`);
  // one piece
  const ps = parts(list); if (ps.length !== 1) fail(who, `${ps.length} pieces (sizes ${ps.map(c => c.length).slice(0, 6).join(', ')}): something floats`);
  // on its wheels: the cells on the ground are the contact patches, one at each stated wheel point (the middle of its patch)
  const ground = list.filter(c => c[1] === 0), patches = parts(ground), H0 = P.half;
  if (list.some(c => c[1] < 0)) fail(who, 'below the ground');
  const mids = patches.map(c => [(Math.min(...c.map(p => p[0])) + Math.max(...c.map(p => p[0])) + 1) / 2, (Math.min(...c.map(p => p[2])) + Math.max(...c.map(p => p[2])) + 1) / 2]);
  if (patches.length !== H0.wheels.length) fail(who, `${patches.length} patches on the ground for ${H0.wheels.length} wheels`);
  for (const [x, , z] of H0.wheels) if (!mids.some(([a, b]) => a === x && b === z)) fail(who, `no wheel's contact patch is centred on ${x},0,${z} (patches at ${mids.map(m => m.join(',')).join(' ')})`);
  // the handle: a straight 2 × 2 bar along x round handle.at through each fist's channel (a figure voxel is two half cells), and the
  // stated straight span covering both
  const [hx, hy, hz] = H0.handle.at, [s0, s1] = H0.handle.span, ch = [...new Set(HELD.gripCells(H0.handle.hold).map(([x]) => x))];
  for (const cx of ch) for (const x of [2 * cx, 2 * cx + 1]) for (const y of [Math.floor(hy) - 1, Math.floor(hy)]) for (const z of [Math.floor(hz) - 1, Math.floor(hz)]) if (!has.has(key(x, y, z))) fail(who, `the handle bar is not through the fist at ${x},${y},${z}`);
  if (s0 > 2 * Math.min(...ch) || s1 < 2 * Math.max(...ch) + 2) fail(who, `the bar's straight span (x ${s0}..${s1}) does not cover both fists (x ${2 * Math.min(...ch)}..${2 * Math.max(...ch) + 2})`);
  const g = N.gripOf(H0.handle.hold).map(v => v * 2), standZ = hz - g[2];
  if (Math.abs(hy - g[1]) > 1) fail(who, `the bar's middle (y ${hy}) is ${Math.abs(hy - g[1]).toFixed(2)} half cells from the hold's grip (y ${g[1].toFixed(2)})`);
  if (Math.abs(P.push.stand[2] - standZ * P.s) > 1e-3) fail(who, `push.stand ${P.push.stand[2]} is not where the grip puts the bar (${(standZ * P.s).toFixed(4)})`);
  if (!(hz < Math.min(...H0.wheels.map(w => w[2])))) fail(who, 'the handle is not behind the back wheels (forward is +z)');
  // the owner clear of it: his figure (rest frame, voxels of 2 half cells) placed at (dx, dz) half cells from its origin; each half cell of
  // a voxel tested at its centre, after a turn (a leg's stride about the hip, an arm in the hold)
  const C = CH.compose(N.lookOf(o.key)), fig = [];
  for (const k of C.B.keys()) { const [x, y, z] = dec(k), t = C.tag.get(k) || 'base', part = bodyPart(t, x, y, z, C.fit); fig.push({ x, y, z, part: t === 'hands' ? 'hands' : part }); }
  for (const k of C.SH.keys()) { const [x, y, z] = dec(k); fig.push({ x, y, z, part: x < 0 ? 'legL' : 'legR' }); }
  for (const k of C.H.keys()) { const [x, y, z] = dec(k); fig.push({ x, y, z, part: 'head' }); }
  const inCart = (X, Y, Z) => has.has(key(Math.floor(X), Math.floor(Y), Math.floor(Z)));
  const legAt = (a, [x, y, z]) => [x, 10 + (y - 10) * Math.cos(a) - (z - .5) * Math.sin(a), .5 + (y - 10) * Math.sin(a) + (z - .5) * Math.cos(a)];
  function clear(label, dx, dz, hold) { let n = 0, at = null;
    for (const f of fig) { if (f.part === 'hands' && hold) continue;
      const turns = f.part === 'legL' || f.part === 'legR' ? [-.6, 0, .6] : [0];
      for (const a of turns) for (let i = 0; i < 8; i++) { let p = [f.x + .25 + (i & 1) * .5, f.y + .25 + (i >> 1 & 1) * .5, f.z + .25 + (i >> 2 & 1) * .5];
        if (a) p = legAt(a, p); if (hold && (f.part === 'armL' || f.part === 'armR')) p = N.holdAt(hold, p, f.part === 'armR' ? 1 : -1);
        if (inCart(2 * p[0] + dx, 2 * p[1], 2 * p[2] + dz)) { n++; at ??= `${f.part} ${f.x},${f.y},${f.z}${a ? ` at a stride of ${a}` : ''}`; } } }
    if (n) fail(who, `${label}: ${n} half cell(s) of the owner inside it (first: ${at})`); }
  clear('pushing it', 0, standZ, H0.handle.hold);
  if (H0.park) clear('parked beside him', -H0.park[0], -H0.park[2], null);
  // the owner's palette (its colours that are not grey), in one small way
  const own = [o.signature, ...Object.values(o.palette)].filter(c => sat(c) >= .25), mine = [...M.values()].filter(([c]) => own.some(q => dist(c, q) <= 30)).length;
  if (mine < 1 || mine > .03 * M.size) fail(who, `${mine} of ${M.size} cells in the owner's colours (one small touch: at least 1, at most 3 %)`);
  // the city's limits: a shaped piece's box, and a named figure's triangles
  const [w, h, d] = P.size, cm = Math.ceil(w / .25 - 1e-9) * Math.ceil(d / .25 - 1e-9) * h, tris = propBank(P.key).tris();
  if (cm > BOX_CM || h > BOX_H) fail(who, `its box is ${cm.toFixed(1)} cell-metres, ${h} m tall (at most ${BOX_CM}, ${BOX_H} m)`);
  if (tris > PROP_TRIS) fail(who, `${tris} triangles in its near mesh (at most ${PROP_TRIS})`);
  report.push(`${who.padEnd(10)} of ${o.key} · ${M.size} cells · ${P.size.map(v => v.toFixed(2)).join(' × ')} m · ${tris} triangles · handle at y ${P.handle.at[1]} m, he stands ${(-P.push.stand[2]).toFixed(3)} m behind its origin · ${mine} cells his own`);
}

console.log(report.join('\n'));
console.log(`named cast: ${N.PEOPLE.length} people, ${ALL.length} pieces, ${N.PROPS.length} prop(s) · ${fails ? `${fails} FAILURE(S)` : 'every check passes'}`);
process.exit(fails ? 1 : 0);
