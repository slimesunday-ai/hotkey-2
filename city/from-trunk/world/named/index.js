// THE NAMED CAST · the pool of the city's named people (the rules: below). Each person is one file in people/, holding every
// piece they wear (skin, face, hair, hat, top, bottoms, shoes, the thing they carry) and their scale. A piece belongs to exactly one
// person: its id is cast_<person>_<slot>, and it is worn by name only. Nobody else can be given it and it never goes on a shelf:
//   · it is not in the agents' pool or the crowd's (world/cast/fresh/index.js REG / NPC_REG list nothing of it, so no roll, outfit,
//     shelf, studio or check that walks those pools ever sees it), and style/city/cast.js wear() refuses it (not in its cast);
//   · the compositor (world/cast/chars.js compose) still finds it by id, because register() below makes each piece resolvable through
//     the registry's entry(slot, id) as a NON-ENUMERABLE property of the NPC registry's slot table: a lookup by id finds it, every
//     enumeration (Object.values, list(), the city's CAST / NPC_CAST tables) skips it. check.mjs proves both.
// This folder sits beside world/cast/, not in it: tools/sync-cast.mjs replaces world/cast/ whole (rmSync, then writes), so anything
// inside it would be deleted by the next sync.
// No three.js here: node imports it directly (check.mjs), the preview page (look.html) and, later, the city.
//
// THE RULES (the owner, 2026-11-18, on the casting sheet's four style rules, which stand):
//   1 ONE THING ON TOP that is theirs alone: the crown is what the game's camera sees (64° down, a person about 70 px tall at 1600 × 1000).
//   2 THEIR OWN PALETTE: two or three colours plus one signature colour (`signature`; check.mjs keeps every two of them apart). Flat:
//     no logos, lettering, chains, grills or chrome (the players').
//   3 AGE AND CHARACTER in the face and hair: grey and white, bald crowns, perms, moustaches, beards, lipstick, bags and lines.
//   4 SOMETHING THEY CARRY that says their trade (the held slot), where the sheet gave them one.
//   · BY NAME ONLY: a named person wears only their own pieces (`lookOf(name)`), and nobody else can wear them (above).
//   · TROUSERS ONLY: no skirts or dresses; a bottom is a colouring of an approved leg form (slim, straight, baggy, roomy), never a new
//     form, and a shoe a colouring of an approved last, so the walk's motion evidence for both carries over unchanged.
//   · SCALE: one shared body; each person's whole figure is drawn `scale` times (0.85..1.3): the big bigger, the slight slighter.
//     (Drawing it: the caller multiplies the built figure's scale; the city's walkers and two-person scenes do not honour it yet.)
//   · THE FIT: every piece keeps the registry's fitting rules (world/cast/fresh/README.md), with ONE addition for this pool: a beard may
//     hang below the chin (kit.js § A BEARD THAT HANGS). check.mjs holds the pool to all of it.
//   · TO ADD A PERSON: a file in people/ (key, name, aka, scale, signature, palette, pieces by slot), listed in FILES below; then
//     node world/named/check.mjs, and look at them (look.html, shoot.mjs).
//   · PROPS: a named person's own THING that is not worn and not in a hand: it goes about with them or stands beside them (the cart
//     man's cart). One file each in props/, listed in PROP_FILES below; § PROPS at the end of this file has its rules.
import { REG, NPC_REG, SLOTS, STRING_SLOTS, OPTIONAL, entry, list } from '../cast/fresh/index.js';
import { legForm } from '../cast/fit/leg-forms.js';
import { LASTS, footCells, envelopeProblems } from '../cast/fit/shoe.js';
import { POSES as HELD_POSES, registerHeld, HOLD, channelOf } from '../cast/fit/held.js';
import { registerTopFit } from '../cast/fit/body.js';
import { EARS_COVERED, HAT_COVER } from '../cast/fit/contract.js';
import * as KIT from '../cast/fresh/kit.js';
import alvarez from './people/alvarez.js';
import pruitt from './people/pruitt.js';
import gloria from './people/gloria.js';
import teague from './people/teague.js';
import dee from './people/dee.js';
import benny from './people/benny.js';
import earl from './people/earl.js';
import darlene from './people/darlene.js';
import dutch from './people/dutch.js';
import hook from './people/hook.js';
import pell from './people/pell.js';
import ambrose from './people/ambrose.js';
import haines from './people/haines.js';
import rosa from './people/rosa.js';
import lou from './people/lou.js';
import moss from './people/moss.js';
import tiny from './people/tiny.js';
import lookout from './people/lookout.js';
import runner from './people/runner.js';
import muscle from './people/muscle.js';
import bao from './people/bao.js';
import ferraro from './people/ferraro.js';
import okafor from './people/okafor.js';
import kowalski from './people/kowalski.js';
import lola from './people/lola.js';
import pockets from './people/pockets.js';
import cart from './people/cart.js';
import teo from './people/teo.js';
import nadia from './people/nadia.js';
import tommy from './people/tommy.js';
import vic from './people/vic.js';
import booker from './people/booker.js';
import slim from './people/slim.js';
import frankie from './people/frankie.js';
import cartProp from './props/cart.js';

// the order the people are listed in: the first fifteen (the trailer park, the market, the plaza, the docks), then the second nineteen
// (Big Moss and the Sixes' hires, Tiny and the night market, the docks, the plaza)
const FILES = [alvarez, pruitt, gloria, teague, dee, benny, earl, darlene, dutch, hook, pell, ambrose, haines, rosa, lou,
  moss, tiny, lookout, runner, muscle, bao, ferraro, okafor, kowalski, lola, pockets, cart, teo, nadia, tommy, vic, booker, slim, frankie];
export const PREFIX = 'cast_';
export const POOL = 'cast';
// the slots a person must fill (the rest may be left out: nothing worn there)
const REQUIRED = ['skin', 'eyes', 'mouth', 'top', 'bottom', 'shoes'];
const NECKLINES = ['crew', 'vee', 'hood', 'collar', 'high', 'bare'];
// scale: one shared body, the whole figure drawn bigger or smaller (the owner, 2026-11-18). The bounds keep a person a person.
export const SCALE = { min: 0.85, max: 1.3 };

export const PROBLEMS = [];
// this pool only: slot → id → entry (enumerable, for its own tools)
export const NAMED_REG = Object.fromEntries(SLOTS.map(s => [s, {}]));
const isFn = f => typeof f === 'function', isCol = c => Number.isInteger(c) && c >= 0 && c <= 0xffffff;
const grid = (rows, n, w) => Array.isArray(rows) && rows.length === n && rows.every(r => typeof r === 'string' && r.length === w);
// what each slot's piece needs (the registry's own rules, world/cast/fresh/index.js NEED, kept to the approved shapes: trousers on the
// approved leg forms only, shoes on the approved lasts only, so the motion evidence of both carries over)
const NEED = {
  skin: t => (isCol(t.c) || isFn(t.c)) ? null : 'needs c: a colour or (x, y, z) => colour',
  hair: t => isFn(t.draw) ? null : 'needs draw(H, ctx)',
  hat: t => !isFn(t.draw) ? 'needs draw(H, ctx)' : t.cover !== undefined && !['auto', 'all', 'none'].includes(t.cover) ? "cover must be 'auto', 'all' or 'none'" : null,
  eyes: t => !grid(t.rows, 4, 5) ? 'needs rows: 4 strings of 5' : !grid(t.brow, 3, 5) ? 'needs brow: 3 strings of 5' : t.right && (!grid(t.right.rows, 4, 5) || !grid(t.right.brow, 3, 5)) ? 'right: { rows, brow }' : null,
  eyewear: t => isFn(t.draw) ? null : 'needs draw(H, ctx)',
  mouth: t => t.rows !== undefined ? 'a named mouth draws on the head (draw / fine), no rows' : isFn(t.draw) || isFn(t.fine) ? null : 'needs draw(H, ctx) and / or fine(P, ctx)',
  mark: t => isFn(t.draw) ? null : 'needs draw(H, ctx)',
  ears: t => isFn(t.draw) ? null : 'needs draw(H, ctx)',
  top: t => !isFn(t.draw) ? 'needs draw(B, ctx)' : ![undefined, 0, 1, 2].includes(t.flank) ? 'flank must be 0, 1 or 2' : t.neckline !== undefined && !NECKLINES.includes(t.neckline) ? 'neckline must be one of ' + NECKLINES.join(', ') : null,
  bottom: t => t.formSpec !== undefined ? 'trousers on an approved leg form only (form), no formSpec: no skirts, no new forms' : !legForm(t.form) ? 'needs form: slim, straight, baggy, roomy, longshorts or shorts'
    : !isCol(t.color) ? 'needs color: one colour' : t.paint !== undefined && !isFn(t.paint) ? 'paint must be a function' : t.sock !== undefined && !['none', 'ankle', 'crew'].includes(t.sock) ? "sock must be 'none', 'ankle' or 'crew'" : null,
  shoes: t => { if (!t.last || !LASTS[t.last]) return 'shoes on an approved last only: ' + Object.keys(LASTS).join(', '); if (!isFn(t.paint)) return 'a last needs paint(q)';
    try { const p = envelopeProblems(footCells(t, { ...KIT })); return p.length ? 'outside the shoe envelope: ' + p.slice(0, 3).join('; ') : null; } catch (e) { return 'paint threw: ' + (e && e.message || e); } },
  acc: t => isFn(t.draw) ? null : 'needs draw(B, ctx)',
  held: t => !isFn(t.draw) ? 'needs draw(G, ctx)' : !HELD_POSES.includes(t.pose) ? 'needs pose: one of ' + HELD_POSES.join(', ') : null,
};

const PEOPLE_ = [];
for (const p of FILES) {
  const where = `people/${p && p.key}.js`, bad = m => PROBLEMS.push(`${where}: ${m}`);
  if (!p || !/^[a-z]{2,12}$/.test(p.key)) { bad('needs key: a-z, 2–12 letters'); continue; }
  if (PEOPLE_.some(q => q.key === p.key)) { bad('duplicate key'); continue; }
  if (typeof p.name !== 'string' || !p.name) bad('needs name');
  if (!(typeof p.scale === 'number' && p.scale >= SCALE.min && p.scale <= SCALE.max)) bad(`needs scale: a number ${SCALE.min}..${SCALE.max}`);
  if (!isCol(p.signature)) bad('needs signature: their one colour (0xRRGGBB)');
  const look = { handle: 'named:' + p.key }, ids = {};
  for (const slot of SLOTS) {
    const t = p.pieces && p.pieces[slot];
    if (!t) { if (REQUIRED.includes(slot)) bad(`needs a ${slot}: a named person wears only their own pieces`); look[slot] = STRING_SLOTS.has(slot) ? (slot === 'mark' ? 'none' : 'base') : { id: 'none' }; continue; }
    const id = `${PREFIX}${p.key}_${slot}`, w = `${where} · ${slot}`;
    if (id.length > 40) { bad(`${slot}: id ${id} longer than 40`); continue; }
    if (typeof t.name !== 'string' || !t.name.trim() || t.name.length > 40) { PROBLEMS.push(`${w}: needs name (1–40 chars)`); continue; }
    const m = NEED[slot](t); if (m) { PROBLEMS.push(`${w}: ${m}`); continue; }
    if (t.fine !== undefined && !isFn(t.fine)) { PROBLEMS.push(`${w}: fine must be a function`); continue; }
    NAMED_REG[slot][id] = Object.freeze({ ...t, id, slot, file: where, key: slot + '/' + id, origin: 'named', pool: POOL, owner: p.key });
    ids[slot] = id; look[slot] = STRING_SLOTS.has(slot) ? id : { id };
  }
  PEOPLE_.push(Object.freeze({ key: p.key, name: p.name, aka: Object.freeze([...(p.aka || [])]), who: p.who || '', place: p.place || '', scale: p.scale, signature: p.signature,
    palette: Object.freeze({ ...(p.palette || {}) }), line: p.line || '', changed: p.changed || '', look: Object.freeze(look), ids: Object.freeze(ids) }));
}
export const PEOPLE = Object.freeze(PEOPLE_);

// ── registration: each piece resolvable by id through the registry (world/cast/fresh/index.js entry), invisible to every listing; and
// the fitting tables chars.js fills for the registry's own pieces at load (a top's flank and neckline, a hat's cover and ears, a held
// piece's hold pose), filled here for ours.
let registered = false;
export function register() {
  if (registered) return; registered = true;
  for (const slot of SLOTS) for (const [id, t] of Object.entries(NAMED_REG[slot])) {
    if (REG[slot][id] || NPC_REG[slot][id]) { PROBLEMS.push(`${t.file}: id ${id} is taken in the registry`); continue; }
    Object.defineProperty(NPC_REG[slot], id, { value: t, enumerable: false, writable: false, configurable: false });
    if (slot === 'top') registerTopFit(id, t);
    if (slot === 'hat') { if (t.coversEars) EARS_COVERED.add('hat/' + id); if (t.cover && t.cover !== 'auto') HAT_COVER.set('hat/' + id, t.cover); }
    if (slot === 'hair' && t.coversEars) EARS_COVERED.add('hair/' + id);
    if (slot === 'held') registerHeld(id, t.pose);
  }
}
register();
if (PROBLEMS.length && typeof console !== 'undefined') console.warn(`named cast: ${PROBLEMS.length} problem(s)\n` + PROBLEMS.join('\n'));

// ── by name
const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const BY = new Map(); for (const p of PEOPLE) for (const n of [p.key, p.name, ...p.aka]) BY.set(norm(n), p);
/** The person a name (or key, or a name they go by) names, or null. */
export const personOf = name => BY.get(norm(name)) || null;
/** A named person's look, every slot filled with their own pieces (a fresh copy: the compositor may be handed it as it is). */
export function lookOf(name) { const p = personOf(name); if (!p) return null; return JSON.parse(JSON.stringify(p.look)); }
/** A named person's scale: the whole figure drawn this many times the shared body (1 for anyone not in the pool). */
export const scaleOf = name => personOf(name)?.scale ?? 1;
/** Is this piece one of the named cast's own, and whose? */
export const ownerOf = (slot, id) => NAMED_REG[slot]?.[id]?.owner ?? null;
export const isNamedPiece = (slot, id) => !!ownerOf(slot, id);
// (a sanity line for the console: the pool resolves through the registry and the registry lists none of it)
export const selfCheck = () => { const out = []; for (const slot of SLOTS) for (const [id, t] of Object.entries(NAMED_REG[slot])) {
  if (entry(slot, id) !== t) out.push(`${slot}/${id}: not resolvable`); if (list(slot, 'all').includes(t)) out.push(`${slot}/${id}: listed in a pool`); } return out; };
export { OPTIONAL };

// ── PROPS (2026-11-19, the cart man's cart). A prop is one of a named person's own things that is NOT a piece: nothing worn, nothing
// in the held slot, so it never touches the registry, the fitting rules or anyone's look. It goes about with its owner (pushed, at
// their side) or stands on the ground beside them. Each is a file in props/ (key, owner, name, line, grain, box, draw, and the points
// a placer needs, in half cells), listed in PROP_FILES; found by its owner's name (propOf) or its own key (propByKey).
//   · DRAWN AS THE CITY DRAWS A PROP (style/city/props.js): voxels about the base's centre, the ground at y 0, the nose toward +z.
//     Its grain is HALF the shared figure's block (0.025 m: the grain of a face's fine voxels, and of the home kit's shaped pieces,
//     style/city/interiors/FORMAT.md), and it is built at its OWNER'S SCALE, so it stands at their size: a half cell is
//     0.025 × scale m. props/build.js makes the vox.js Vol and its mesh (propVol, propBank): a bank like any prop template's, for the
//     city's stamp() or a batch beside the walkers (the dogs' way, style/city/peds.js). No three here: draw(C) writes to a plain grid.
//   · FOR A PLACER, in metres at the owner's scale, about the prop's origin (its base's centre), +z its forward: size, bounds,
//     handle.at (the middle of what the hands take) and handle.hold (the city's hold pose drawn for it, world/cast/fit/held.js HOLD),
//     push.stand (where the owner's feet go to push it, facing +z: found from that hold's grip, so the bar lies in both fists),
//     wheels (where each wheel meets the ground), park (where its origin goes from the owner's feet when it stands beside them).
//   · FLAT, as the pool's pieces: no logos or lettering; the owner's palette touches it in one small way. check.mjs § 6 holds it.
const PROP_FILES = [cartProp];
export const PROP_GRAIN = 0.025;
// the hold's grip: the middle of the +x hand's channel with the arm in the hold's pose, in the figure's voxels (rest frame, before
// scale). The same rotation world/cast/fit/held.js holdArm gives the arm: about the shoulder (x 5, y 16.5, z 0), Ry(−yaw) Rz(roll)
// Rx(−pitch) Ry(−twist).
const SHOULDER = [5, 16.5, 0];
const rx = (a, [x, y, z]) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const ry = (a, [x, y, z]) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
const rz = (a, [x, y, z]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
/** A rest-frame point of an arm (the +x arm, side 1, or the −x arm, side −1) with that arm in a hold's pose. */
export function holdAt(pose, pt, side = 1) { const h = HOLD[pose]; if (!h || !h.pose) return null; const [p, r, yw, tw] = h.pose, sh = [side * SHOULDER[0], SHOULDER[1], SHOULDER[2]];
  const v = ry(-side * yw, rz(side * r, rx(-p, ry(-side * tw, pt.map((u, i) => u - sh[i]))))); return v.map((u, i) => u + sh[i]); }
/** The hold's grip: the middle of the +x hand's channel, in the hold. */
export function gripOf(pose) { const h = HOLD[pose]; if (!h || !h.axis) return null; const ch = channelOf(h.axis), n = ch.length;
  return holdAt(pose, [0, 1, 2].map(i => ch.reduce((s, q) => s + q[i] + .5, 0) / n)); }

// a prop's cells: draw(C) on a plain grid, C.set / C.has / C.get / C.del in half cells (continuous: cell x spans [x, x + 1)). Memoized.
const ck = (x, y, z) => ((x + 512) << 20) | ((y + 512) << 10) | (z + 512);
export const cellAt = k => [(k >> 20) - 512, ((k >> 10) & 1023) - 512, (k & 1023) - 512];
const CELLS = new Map();
export function propCells(p) { let M = CELLS.get(p); if (M) return M; M = new Map(); const bad = [];
  const C = { set(x, y, z, c, l = 0) { if (![x, y, z].every(Number.isInteger)) { bad.push(`a cell off the grid at ${x},${y},${z}`); return; } if (!isCol(c)) { bad.push(`a colour ${c} at ${x},${y},${z}`); return; } M.set(ck(x, y, z), [c, l]); },
    del(x, y, z) { M.delete(ck(x, y, z)); }, has: (x, y, z) => M.has(ck(x, y, z)), get: (x, y, z) => M.get(ck(x, y, z)) };
  p.draw(C); M.problems = bad; CELLS.set(p, M); return M; }

const PROPS_ = [], PROBLEMS_BEFORE_PROPS = PROBLEMS.length;
for (const p of PROP_FILES) {
  const where = `props/${p && p.key}.js`, bad = m => PROBLEMS.push(`${where}: ${m}`), o = p && personOf(p.owner), n3 = a => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
  if (!p || !/^[a-z]{2,12}$/.test(p.key)) { bad('needs key: a-z, 2–12 letters'); continue; }
  if (PROPS_.some(q => q.key === p.key)) { bad('duplicate key'); continue; }
  if (!o || o.key !== p.owner) { bad('needs owner: the key of a person in the pool'); continue; }
  if (typeof p.name !== 'string' || !p.name || p.name.length > 40) { bad('needs name (1–40 chars)'); continue; }
  if (p.grain !== PROP_GRAIN) { bad(`grain must be ${PROP_GRAIN} (half the figure's block)`); continue; }
  if (typeof p.draw !== 'function') { bad('needs draw(C)'); continue; }
  if (!p.box || !['x', 'y', 'z'].every(a => Array.isArray(p.box[a]) && p.box[a].length === 2 && p.box[a].every(Number.isInteger) && p.box[a][0] < p.box[a][1]) || p.box.y[0] !== 0) { bad('needs box: { x, y, z } integer ranges, y from 0 (the ground)'); continue; }
  if (!p.handle || !n3(p.handle.at) || !Array.isArray(p.handle.span) || !HELD_POSES.includes(p.handle.hold) || !gripOf(p.handle.hold)) { bad('needs handle: { at: [x, y, z], span: [x0, x1], hold: a held pose }'); continue; }
  if (!Array.isArray(p.wheels) || !p.wheels.length || !p.wheels.every(w => n3(w) && w[1] === 0)) { bad('needs wheels: [[x, 0, z], …]'); continue; }
  if (p.park !== undefined && !n3(p.park)) { bad('park must be [x, 0, z]'); continue; }
  let M; try { M = propCells(p); } catch (e) { bad('draw threw: ' + (e && e.message || e)); continue; }
  for (const m of M.problems.slice(0, 3)) bad(m);
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], out = 0;
  for (const k of M.keys()) { const c = cellAt(k); if (c.some((v, i) => v < p.box['xyz'[i]][0] || v > p.box['xyz'[i]][1])) out++; lo = lo.map((v, i) => Math.min(v, c[i])); hi = hi.map((v, i) => Math.max(v, c[i])); }
  if (!M.size) { bad('draws nothing'); continue; } if (out) bad(`${out} cell(s) outside its box`);
  // half cells → metres at the owner's scale
  const s = PROP_GRAIN * o.scale, m = a => a.map(v => +(v * s).toFixed(4)), g = gripOf(p.handle.hold).map(v => v * 2);
  PROPS_.push(Object.freeze({ key: p.key, owner: p.owner, name: p.name, line: p.line || '', goes: p.goes || 'with', file: where, grain: PROP_GRAIN, scale: o.scale, s,
    cells: [lo, hi], size: m([hi[0] - lo[0] + 1, hi[1] + 1, hi[2] - lo[2] + 1]), bounds: { min: m(lo), max: m(hi.map(v => v + 1)) }, forward: [0, 0, 1],
    handle: Object.freeze({ at: m(p.handle.at), span: m(p.handle.span), hold: p.handle.hold }),
    push: Object.freeze({ stand: m([p.handle.at[0], 0, p.handle.at[2] - g[2]]), facing: [0, 0, 1], hands: m(g), handsOff: +((p.handle.at[1] - g[1]) * s).toFixed(4) }),
    wheels: Object.freeze(p.wheels.map(m)), park: p.park ? m(p.park) : null, half: Object.freeze({ handle: p.handle, wheels: p.wheels, park: p.park || null, box: p.box }), src: p }));
}
export const PROPS = Object.freeze(PROPS_);
/** The props of the person a name names (their name, key or a name they go by): [] for anyone with none. */
export const propsOf = name => { const o = personOf(name); return o ? PROPS.filter(q => q.owner === o.key) : []; };
/** The (first) prop of the person a name names, or null: propOf('the man with the shopping cart') → his cart. */
export const propOf = name => propsOf(name)[0] || null;
export const propByKey = key => PROPS.find(q => q.key === key) || null;
if (PROBLEMS.length > PROBLEMS_BEFORE_PROPS && typeof console !== 'undefined') console.warn('named cast: prop problem(s)\n' + PROBLEMS.slice(PROBLEMS_BEFORE_PROPS).join('\n'));
