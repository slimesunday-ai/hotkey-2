// WALL PIECES IN THE TRAILER (lib-1, part D: demo/stage/set/walls.js, which set/arrange.js asks): where a wall piece
// may hang on the trailer's three walls and why not (the door, the window, what hangs there, furniture in front, the
// ceiling); the 37 wall pieces of the kit as things of the run; and a hung piece kept by the arrangement's record and
// the save as they were (no new field, version 8).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RUN_CONFIG, newRun, saveRun, loadRun, view } from '../src/run/index.mjs';
import { libraryOf, shelvesOn } from '../src/run/library.mjs';
import { HOME, NOFIT } from '../src/run/library-data.mjs';
import { wallSpots, wallWhy, wallPose, hangY, isWallPose, frontOf, SIDES } from '../demo/stage/set/walls.js';

const cfg = RUN_CONFIG;
const CAT = new Map(HOME.map(([id, name, cat, place, foot, h, kind, rarity, mount]) => [id, { id, name, cat, place, foot, h, mount }]));
const byId = id => CAT.get(id) ?? null;
/** The starter trailer as the kit's layout (the kit's door kept, as set/arrange.js checks it), each piece keyed. */
function starter(file = 'trailer-starter.json') {
  const A = JSON.parse(readFileSync(new URL(`../demo/stage/set/homes/${file}`, import.meta.url), 'utf8'));
  A.items.forEach((it, k) => (it.key = `i${k}`));
  return A;
}
const ok = spots => spots.filter(s => !s.why);

test('walls: a picture may hang on the back, the right and the left wall, at its own height, wherever nothing is in the way', () => {
  const A = starter();
  const spots = wallSpots(A, byId, { id: 'art-print' });
  for (const side of SIDES) assert.ok(ok(spots).some(s => s.side === side), `somewhere on ${side}`);
  assert.ok(ok(spots).every(s => s.y === byId('art-print').mount));
  // a wide canvas: the back and the left wall; the right one is all window and door but for 1 m
  const wide = ok(wallSpots(A, byId, { id: 'art-graffiti' }));
  assert.ok(wide.some(s => s.side === 'N') && wide.some(s => s.side === 'W') && !wide.some(s => s.side === 'E'));
  // the pose: face into the room, against its wall
  const o = byId('art-graffiti');
  assert.deepEqual(wallPose(o, 'N', 2, 1, 7).box.slice(0, 3), [0.5, 1, 0]);
  assert.equal(wallPose(o, 'E', 2, 1, 7).box[3], 7);
  assert.equal(wallPose(o, 'W', 2, 1, 7).box[0], 0);
});

test('walls: never over the door, the window or what hangs there, and each refusal says so', () => {
  const A = starter();
  const door = A.items.find(it => it.id === 'door-front');
  const win = A.items.find(it => it.id === 'window');
  const print = A.items.find(it => it.id === 'art-print');
  assert.equal(wallWhy(A, byId, { id: 'poster' }, door.on.wall, door.x, null), 'the door is there');
  assert.equal(wallWhy(A, byId, { id: 'poster' }, win.on.wall, win.x, 1.0), 'the window is there');
  assert.equal(wallWhy(A, byId, { id: 'poster' }, 'N', print.x, null), 'the framed print hangs there');
  // beside the window, on its wall: fine (just before it; just after it the door begins)
  assert.equal(wallWhy(A, byId, { id: 'art-print' }, win.on.wall, win.x - byId('art-print').foot[0], null), null);
  assert.equal(wallWhy(A, byId, { id: 'art-print' }, win.on.wall, win.x + byId('window').foot[0], null), 'the door is there');
  // a piece moved along its own wall is not in its own way
  assert.equal(wallWhy(A, byId, { id: 'art-print', key: print.key }, 'N', print.x + 1, null), null);
  // off the wall, through the ceiling
  assert.match(wallWhy(A, byId, { id: 'poster' }, 'N', A.room.w - 1, null), /runs off the back wall/);
  assert.match(wallWhy(A, byId, { id: 'poster' }, 'N', 15, 2.2), /ceiling/);
});

test('walls: furniture in front: a tall piece against the wall hides that stretch; a low one under a picture does not', () => {
  const A = starter();
  // a bookshelf (1.8 m) against the left wall, at z 4..8; a coffee table (0.35 m) against it further on
  A.items.push({ id: 'bookshelf', x: 0, z: 4, rot: 90, variant: 0, on: 'floor', key: 't1' });
  A.items.push({ id: 'table-coffee', x: 0, z: 9, rot: 90, variant: 0, on: 'floor', key: 't2' });
  const f = frontOf(A, byId, 'W');
  assert.ok(f.some(q => q.id === 'bookshelf' && q.a0 === 4 && q.a1 === 8 && q.top >= 1.8));
  assert.equal(wallWhy(A, byId, { id: 'poster' }, 'W', 5, null), 'the bookshelf stands in front of it');
  assert.equal(wallWhy(A, byId, { id: 'poster' }, 'W', 9, null), null, 'over the low table: fine');
  // what stands on a piece counts: the lamp on the nightstand
  const night = A.items.find(it => it.id === 'table-end');
  const lamp = frontOf(A, byId, night.x <= 1 ? 'W' : 'N').find(q => q.id === 'table-end');
  if (lamp) assert.ok(lamp.top > byId('table-end').h);
});

test('walls: a piece too tall for the trailer\'s 2.45 m at its own height hangs lower; one too tall at any height is left out, saying why', () => {
  const A = starter();
  const neon = byId('neon-shape');
  assert.ok(neon.mount + neon.foot[1] * 0.25 > A.room.h);
  const y = hangY(A, neon);
  assert.ok(y < neon.mount && y + neon.foot[1] * 0.25 <= A.room.h + 1e-9);
  assert.ok(ok(wallSpots(A, byId, { id: 'neon-shape' })).length > 0);
  assert.ok(NOFIT.every(([id, why]) => CAT.has(id) && /too big for the trailer/.test(why)));
});

test('the library: the kit\'s wall pieces are things of the run (tiers, prices, the catalog, the shelves); the structure stays out', () => {
  const lib = libraryOf(cfg);
  const wall = lib.pieces.filter(p => p.kind === 'home' && p.place === 'wall');
  const kitWall = HOME.filter(h => h[3] === 'wall');
  assert.equal(kitWall.length, 45); // 38 before the asset pass: + stab vest, jacket lining, door bar, pepper fogger, dog sign, panic button, false wall
  const out = ['door-front', 'window', 'ac-window', 'wall-panelling'];
  for (const id of out) assert.ok(lib.out.some(o => o.key === `kit:${id}` && /structure/.test(o.why)), id);
  // in: every wall piece but the structure, the deadbolt's locks (the named deadbolt, on the door) and what fits nowhere
  // (sixes-1: and the slice's named wall pieces, the door bar, the camera and the dog sign, each a thing of its own)
  const named = Object.values(cfg.things).filter(t => t.piece?.startsWith('kit:') && byId(t.piece.slice(4))?.place === 'wall').length;
  assert.equal(named, 7); // (raid-1: and the pepper fogger, the stab vest, the false wall)
  assert.equal(wall.length, kitWall.length - out.length - named - NOFIT.filter(([id]) => byId(id)?.place === 'wall').length);
  assert.ok(wall.every(p => Number.isInteger(p.tier) && p.price > 0 && p.mount !== null));
  // the catalog lists them; the home shelves draw on them
  const v = view(cfg, { ...newRun({ seed: 1 }), place: 'park' });
  assert.ok(v.library.pieces.filter(p => p.place === 'wall').length === wall.length);
  const onShelves = new Set();
  for (let d = 1; d <= 40; d++) for (const s of shelvesOn(cfg, 1, d)) for (const k of s.items) onShelves.add(k);
  assert.ok(wall.some(p => onShelves.has(p.key)));
  // the ceiling stays bare
  assert.ok(lib.out.some(o => o.key === 'kit:disco-ball' && /ceiling/.test(o.why)));
});

test('the save: a hung piece is a pose like any other in the arrangement\'s record; owning one is the rules\' save, version 8', () => {
  const rec = { v: 1, of: 'a:abc', poses: { 'L:kit:art-graffiti': { wall: 'W', x: 3, y: 1.2 }, i8: { wall: 'N', x: 14, y: 1.18 }, 'L:kit:speaker': { x: 0, z: 8, rot: 0, seed: 1 }, i9: 'away' } };
  const back = JSON.parse(JSON.stringify(rec));
  assert.deepEqual(back, rec);
  assert.ok(isWallPose(back.poses['L:kit:art-graffiti']) && isWallPose(back.poses.i8));
  assert.ok(!isWallPose(back.poses['L:kit:speaker']) && !isWallPose({ wall: 'S', x: 1 }) && !isWallPose({ wall: 'N', x: 1.5 }));
  const s = { ...newRun({ seed: 1 }), place: 'crib', things: { 'kit:art-graffiti': true, 'kit:neon-sign': true } };
  const r = loadRun(saveRun(s));
  assert.ok(r.ok, r.text);
  assert.deepEqual(r.state.things, s.things);
});
