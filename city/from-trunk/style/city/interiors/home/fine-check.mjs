// AI City · home and shop kits · THE FINE-PASS CHECK (2026-11-17). Every kit piece with a fine pass (../fine.js: the traits' paint
// and fine voxels on a kit piece), in every variant and state, built as the game builds it (buildObject, then vox.js meshVol):
//   budget     at most FINE.faces painted faces and FINE.voxels fine voxels (../fine.js states the numbers and why)
//   clean      no paint that lands on no voxel (miss), no fine voxel inside a voxel (buried), every fine voxel inside the piece's own
//              box (its footprint and height: a fine pass never grows a piece) and joined, face to face through fine voxels, to a
//              voxel (nothing floats)
//   hidden     painted faces that end up covered (a neighbour voxel on them): reported, not failed
//   far        a piece with a far tier builds it, the paint folded into its voxels
//   mesh       the near mesh builds, and the fine pass adds triangles (else it drew nothing)
// and every piece built at a FINE GRAIN (`grain`, lib.js SMALL: a small thing's whole volume at half or a quarter of the block):
//   grain      one of SMALL.grains, and its Vol built at it (volFor)
//   small      a footprint of at most SMALL.cells cells and at most SMALL.h m tall: the grain is for small things
//   triangles  its near mesh, fine pass and all, at most SMALL.tris in every variant and state
//   view       a piece's tile camera (`view`): only 'top' (a thing lying flat, pictured from high up) on a surface piece
// and every piece past SMALL built at the half grain (`shaped`: why; lib.js SHAPED, third art pass):
//   shaped     a reason given, the half grain only, filling at most SHAPED.vol cell-metres (cells × m) and SHAPED.h m tall, at most
//              SHAPED.tris triangles in every variant and state
//   node style/city/interiors/home/fine-check.mjs [id …] [--cost]
//     --cost   also what it costs: per piece, triangles and build-and-mesh time with the pass and without (FINE.on false); per
//              preset room (assemblies/*.json, owned), every item built and meshed, the same two numbers
// Exit code 1 on any failure. Pure node: three is stubbed by sim2/node-hooks.mjs (as check.mjs).
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../../..');
register(pathToFileURL(path.join(ROOT, 'sim2/node-hooks.mjs')).href);
const H = await import('./index.js'), S = await import('../store/index.js'), { FINE } = await import('../fine.js'), VX = await import('../../vox.js'), { SMALL, SHAPED } = H;
const { hd, hk, cellOf } = await import('../../../../world/cast/fit/fine.js');
const args = process.argv.slice(2), COST = args.includes('--cost'), only = args.filter(a => !a.startsWith('--'));
const NB = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const kits = [['home', H.OBJECTS, (o, opt) => H.buildObject(o, opt)], ['store', S.OBJECTS, (o, opt) => S.buildObject(o, opt)]];
const tris = V => { const b = new VX.Bank(true); VX.meshVol(V, b); return b.tris(); };
let fails = 0, pieces = 0, builds = 0;
const fail = (id, why) => { console.log(`FAIL ${id}: ${why}`); fails++; };
const rows = [], rowsSmall = [], rowsShaped = [];
let small = 0, shaped = 0;
for (const [kit, LIST, build] of kits) for (const o of LIST) {
  if ((typeof o.fine !== 'function' && o.grain === undefined && o.view === undefined) || (only.length && !only.includes(o.id))) continue;
  // the fine grain and the tile camera: what the piece says about itself
  if (o.view !== undefined && (o.view !== 'top' || o.place !== 'surface')) fail(o.id, `view '${o.view}': only 'top', on a surface piece`);
  if (o.grain !== undefined) { const cells = o.foot[0] * o.foot[1], sh = o.shaped !== undefined, lim = sh ? SHAPED : SMALL; sh ? shaped++ : small++;
    if (sh) {   // past SMALL: the half grain, a reason, SHAPED's limits (lib.js)
      if (typeof o.shaped !== 'string' || o.shaped.length < 8) fail(o.id, '`shaped` must say why the piece needs the half grain');
      if (o.grain !== SHAPED.grain) fail(o.id, `a shaped piece at grain ${o.grain} (only ${SHAPED.grain})`);
      if (cells * o.h > SHAPED.vol + 1e-9) fail(o.id, `a shaped piece filling ${(cells * o.h).toFixed(1)} cell-metres (at most ${SHAPED.vol})`);
      if (o.h > SHAPED.h + 1e-9) fail(o.id, `a shaped piece ${o.h} m tall (at most ${SHAPED.h})`);
      if (cells <= SMALL.cells && o.h <= SMALL.h + 1e-9) fail(o.id, 'small enough for SMALL: drop `shaped`');
    } else {
      if (!SMALL.grains.includes(o.grain)) fail(o.id, `grain ${o.grain}: one of ${SMALL.grains.join(', ')}`);
      if (cells > SMALL.cells) fail(o.id, `a fine-grain piece on ${o.foot[0]} × ${o.foot[1]} cells (at most ${SMALL.cells}; past it, say \`shaped\`)`);
      if (o.h > SMALL.h + 1e-9) fail(o.id, `a fine-grain piece ${o.h} m tall (at most ${SMALL.h}; past it, say \`shaped\`)`);
    }
    for (let variant = 0; variant < (o.variants || 1); variant++) for (const state of o.states ?? [undefined]) {
      const V = build(o, { variant, seed: 1, state }), t = tris(V), tag = `${o.id} v${variant}${state ? ' ' + state : ''}`;
      if (Math.abs(V.s - o.grain) > 1e-9) fail(tag, `built at ${V.s} m, not its grain ${o.grain}`);
      if (t > lim.tris) fail(tag, `${t} triangles at the fine grain (at most ${lim.tris})`);
      if (!variant && (!state || state === o.states?.[0])) (sh ? rowsShaped : rowsSmall).push({ id: o.id, grain: o.grain, foot: o.foot, h: o.h, tris: t }); } }
  if (typeof o.fine !== 'function') continue;
  pieces++; let worst = { faces: 0, voxels: 0 }, hiddenN = 0, plain = 0, fine = 0;
  for (let variant = 0; variant < (o.variants || 1); variant++) for (const state of o.states ?? [undefined]) {
    const tag = `${o.id} v${variant}${state ? ' ' + state : ''}`; builds++;
    FINE.on = true; const V = build(o, { variant, seed: 1, state }), L = V.fineLog;
    if (!L) { fail(tag, 'the pass did not run'); continue; }
    worst = { faces: Math.max(worst.faces, L.faces), voxels: Math.max(worst.voxels, L.voxels) };
    if (L.faces > FINE.faces) fail(tag, `${L.faces} painted faces (budget ${FINE.faces})`);
    if (L.voxels > FINE.voxels) fail(tag, `${L.voxels} fine voxels (budget ${FINE.voxels})`);
    if (L.miss) fail(tag, `${L.miss} texels landed on no voxel`);
    if (L.buried) fail(tag, `${L.buried} fine voxels inside a voxel`);
    // fine voxels: inside the piece's box, and joined to a voxel
    const keys = [...V.hv.keys()], set = new Set(keys), reach = new Set();
    for (const k of keys) { const [x, y, z] = hd(k);
      if (x < 0 || y < 0 || z < 0 || x >= V.nx * 2 || y >= V.ny * 2 || z >= V.nz * 2) fail(tag, `a fine voxel outside the piece's box at half (${x}, ${y}, ${z})`);
      if (V.has(...cellOf(x, y, z))) fail(tag, `a fine voxel inside a voxel at half (${x}, ${y}, ${z})`);
      if (NB.some(([a, b, c]) => V.has(...cellOf(x + a, y + b, z + c)))) reach.add(k); }
    const st = [...reach]; while (st.length) { const [x, y, z] = hd(st.pop()); for (const [a, b, c] of NB) { const n = hk(x + a, y + b, z + c); if (set.has(n) && !reach.has(n)) { reach.add(n); st.push(n); } } }
    const loose = keys.filter(k => !reach.has(k)); if (loose.length) fail(tag, `${loose.length} fine voxels float (first at half ${hd(loose[0]).join(', ')})`);
    for (const [k, arr] of V.fp) { const x = (k >> 18) - 256, y = ((k >> 9) & 511) - 256, z = (k & 511) - 256; arr.forEach((e, f) => { if (e && V.has(x + NB[f][0], y + NB[f][1], z + NB[f][2])) hiddenN++; }); }
    const t1 = tris(V); FINE.on = false; const t0 = tris(build(o, { variant, seed: 1, state })); FINE.on = true;
    if (variant === 0 && !state || state === o.states?.[0] && variant === 0) { plain = t0; fine = t1; }
    if (t1 <= t0) fail(tag, `the fine pass drew nothing (${t0} → ${t1} triangles)`);
    if (o.far && kit === 'home') { try { const F = build(o, { variant, seed: 1, state, far: true }); if (!F || F.fp || F.hv) fail(tag, 'the far tier kept its fine data'); } catch (e) { fail(tag, 'far tier: ' + e.message); } }
  }
  rows.push({ id: o.id, kit, faces: worst.faces, voxels: worst.voxels, hidden: hiddenN, plain, fine });
}
for (const r of rows) console.log(`${r.kit === 'store' ? 'store ' : ''}${r.id.padEnd(24)} faces ${String(r.faces).padStart(3)}  fine voxels ${String(r.voxels).padStart(2)}  triangles ${r.plain} → ${r.fine}${r.hidden ? `  (${r.hidden} painted faces covered)` : ''}`);
console.log(`${pieces} pieces with a fine pass, ${builds} builds; budget ${FINE.faces} faces, ${FINE.voxels} fine voxels`);
for (const r of rowsSmall) console.log(`small ${r.id.padEnd(24)} grain ${r.grain} m  ${r.foot.join(' × ')} cells, ${r.h} m  ${r.tris} triangles`);
console.log(`${small} pieces at a fine grain (${SMALL.grains.join(' or ')} m): at most ${SMALL.cells} cells, ${SMALL.h} m tall, ${SMALL.tris} triangles`);
for (const r of rowsShaped) console.log(`shaped ${r.id.padEnd(23)} grain ${r.grain} m  ${r.foot.join(' × ')} cells, ${r.h} m  ${r.tris} triangles`);
console.log(`${shaped} shaped pieces at the half grain: at most ${SHAPED.vol} cell-metres, ${SHAPED.h} m tall, ${SHAPED.tris} triangles`);

if (COST) {
  // per piece: build + mesh time with the pass and without (median of 5, after a warm-up)
  const time = (o, build, on) => { FINE.on = on; const t = []; for (let k = 0; k < 6; k++) { const a = performance.now(); tris(build(o, { variant: 0, seed: 1 })); t.push(performance.now() - a); } FINE.on = true; t.shift(); return t.sort((p, q) => p - q)[2]; };
  for (const [, LIST, build] of kits) for (const o of LIST) if (typeof o.fine === 'function' && (!only.length || only.includes(o.id))) console.log(`cost ${o.id.padEnd(24)} ${time(o, build, false).toFixed(2)} ms → ${time(o, build, true).toFixed(2)} ms`);
  // per room: every item of each preset layout, built and meshed
  const DIR = path.join(HERE, 'assemblies');
  for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'index.json').sort()) {
    const A = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')), items = [...(A.items ?? []), ...(A.slots ?? []).map(s => ({ id: s.demo, variant: 0 }))].filter(it => H.byId.get(it.id));
    const room = on => { FINE.on = on; let t = 0; const a = performance.now(); for (const it of items) t += tris(H.buildObject(it.id, { variant: it.variant ?? 0, seed: it.seed ?? it.x ?? 1, state: it.state })); const ms = performance.now() - a; FINE.on = true; return [t, ms]; };
    room(true); const [t0, m0] = room(false), [t1, m1] = room(true), n = items.filter(it => typeof H.byId.get(it.id).fine === 'function').length;
    console.log(`room ${f.replace('.json', '').padEnd(24)} ${String(items.length).padStart(2)} items, ${n} with a fine pass: ${t0} → ${t1} triangles (+${(100 * (t1 - t0) / t0).toFixed(1)}%), ${m0.toFixed(1)} → ${m1.toFixed(1)} ms`);
  }
}
console.log(fails ? `${fails} FAILED` : 'fine-check ok');
process.exit(fails ? 1 : 0);
