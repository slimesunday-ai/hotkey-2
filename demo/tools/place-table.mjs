#!/usr/bin/env node
// Makes demo/stage/places.json: THE PLACE TABLE. Where each of the game's ten places is in the REAL city, built from
// the city's own data. The server must be running: node demo/serve.mjs
//
//   node demo/tools/place-table.mjs [--port 5470] [--out demo/stage/places.json] [--count 14] [--verbose]
//
// Nothing here is a typed coordinate. What is OURS is the small table below (SPEC): which city place each game place
// is, and which of the city's own pieces (by the id its build gives them: `group·kind`) is the counter, the desk, the
// pier, the cell, the bed, and the front the camera faces. Everything else is READ:
//   · where the place is            city/from-trunk/sim2/places.json (the city's place list)
//   · the fixtures' boxes           the city's own audit build of each block (jobs.js jobBlock, audit on): every mass
//                                   and prop it stamps, by id, with its box
//   · where people stand            the city's published stand spots for the place (simstate/stands.json), then the
//                                   city's own stand-spot maker (simstate/stands.js makeStands) asked round our points:
//                                   a spot touches nothing, is clear of the walkers' lanes and the kerb rows, 1.3 m
//                                   from the next, and carries its ENTRY on the lane; walls to lean on, ledges and
//                                   benches to sit on come with it. A bench the build stamps gets its two seats
//   · the ways in and out           world/export/world.json: the walkers' graph (the nearest sidewalk point), the
//                                   cars' lanes (the nearest kerb point), and transit.json (the nearest subway stairs)
//   · what a trip would cost        world/export/travel.mjs, the city's own trip planner, asked for every link of the
//                                   game's map (src/map.mjs) on foot, by scooter, by subway and by cab: metres and
//                                   real seconds. For whoever picks how a trip is shown (demo/stage/travel.js)
//   · the ten homes                 sim2/places.json `lots` (Sunny Acres' trailer pads: x, z is the front door), with
//                                   the frame of each from the block's own anchors (interiors/city/frame.js lotEntry)
//
// The page is a `?shot=1` page (the maker needs every block's module on the page's own thread). About two minutes.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './chrome.mjs';
import { CITY as GAME } from '../../src/map.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.resolve(opt('--out', path.join(ROOT, 'demo/stage/places.json')));
const count = Number(opt('--count', 14));
const url = `http://127.0.0.1:${opt('--port', 5470)}/demo/?shot=1&bare=1&plain=1&peds=0`;

/**
 * OUR CHOICES, as ids of the city's own things. Per game place (src/map.mjs: its `cityPlace` is `city` here):
 *   city     the id of the place in the city's place list (sim2/places.json), or null when the game place is a
 *            hero piece the list does not name: then `at` says which piece it gathers round
 *   at       'group·kind' (or 'group·kind#n', the n-th nearest; 'group·kind!', the biggest) of the piece the place gathers round, and which side of it:
 *            'S' | 'N' | 'W' | 'E' the middle of that face, a step out; 'mid' its middle
 *   spots    each named spot of the game (SPEC section 3) → the piece it is at, the same way
 *   face     the piece the camera looks AT across the place (its front); none: the play camera's own bearing
 *   from     instead of `face`: the compass side the place's front is seen from ('SE': from over the crossing the
 *            bar's corner stands on; a camera straight across a side street would stand over the roofs opposite)
 *   seats    kinds of bench the build stamps there: each gives two seats
 *   reach    how far from `at` a standing spot may be and still belong to the place (m)
 *   hole     nobody stands within this many metres of the place's own point (the plaza's is the middle of its
 *            fountain: the city stands its own people on the ring round it, 6 m out)
 *   only     'published': the place stands on the city's published spots and its bench seats alone (the island's
 *            yard is fenced: the maker's spots round it are on both sides of the fence)
 *   missing  what the game needs here that the real place does not have, for the owner
 */
const SPEC = {
  projects: {
    city: 'trailer', name: 'Sunny Acres trailer park', reach: 12,
    note: 'the swap-meet lane through the middle of the park; the ten pads are the ten trailers nearest it',
  },
  market: {
    city: null, name: 'the Jay St night market', at: ['market·picnic', 'mid'], reach: 9,
    spots: { 'counter:fence': ['market·stall#0', 'in'], 'counter:gunshop': ['market·stall#1', 'in'], 'counter:shop': ['market·stall#2', 'in'] },
    face: 'karaoke·structure',
    note: 'the picnic yard among the eight stalls, on the Jay St & Washington St lot (the city block -2,1)',
    missing: ['a gun counter (the gun dealer stands at a food stall)', 'a fence\'s counter (the fence stands at a food stall)'],
  },
  uptown: {
    city: 'plaza', name: 'Glasswall Plaza', reach: 13, hole: 5.6,
    spots: { 'counter:shop': ['plaza·bench#0', 'in'] },
    seats: ['plaza·bench'],
    note: 'the plaza\'s west and south edges, where the city stands its own people, and its four benches round the fountain',
    missing: ['a shop (uptown\'s shopkeeper stands by a plaza bench: the plaza has no kiosk or storefront of its own)'],
  },
  corner: {
    city: 'corner--1_1', name: 'Jay St & Washington St', reach: 9,
    note: 'the city\'s own dealing-corner spots: the open apron of the night market\'s lot, on the corner',
  },
  bar: {
    city: null, name: 'DEAD AIR', at: ['bar·structure', 'S'], reach: 14,
    spots: { 'counter:shop': ['bar·structure', 'S'] },
    from: 'SE',
    note: 'the bar\'s Washington St front and its Ivy St side (the city block -3,0)',
    missing: ['a way into the bar (the barkeeper stands outside at its front: the bar has no interior)'],
  },
  park: {
    city: 'park', name: 'Pleasantview Park', reach: 14,
    seats: [],
    face: 'bandstand·structure',
    note: 'the park\'s east walk, its benches and the bandstand',
  },
  docks: {
    city: 'docks', name: 'Low Tide Docks', reach: 14,
    spots: { pier: ['quay·mooring#0', 'S'] },
    note: 'the cargo ring behind the quay; the pier is the quay\'s edge at its first mooring',
  },
  precinct: {
    city: 'police', name: 'Precinct 9', at: ['precinct·structure!', 'W'], reach: 16,
    spots: { desk: ['precinct·structure!', 'W'] },
    face: 'precinct·structure!',
    note: 'the precinct\'s Central Ave wall and its Kent St front (the steps, the green lamps, the two cruisers)',
    missing: ['a desk (bail is paid and tips are sold on the front steps: the precinct has no interior)'],
  },
};
const HELD = {
  jail: {
    city: 'jail', name: 'Iron Island', at: ['yard-life·bench', 'E'], reach: 12, only: 'published',
    spots: { cell: ['yard-life·bench', 'E'] },
    seats: ['yard-life·bench'],
    face: 'cells·structure!',
    note: 'the exercise yard: the bench by the fence, the ground by the bleachers and the weights',
    missing: ['a cell (prisoners are held in the exercise yard: the cell blocks are solid buildings)'],
  },
  clinic: {
    city: 'hospital', name: 'St. Mercy', at: ['forecourt·bench', 'in'], reach: 16,
    spots: { bed: ['forecourt·bench', 'in'] },
    seats: ['forecourt·bench', 'garden·bench'],
    from: 'SW',
    note: 'the forecourt by the main entrance: its bench, the two garden benches, the wheelchair and the IV pole',
    missing: ['a bed (patients sit on the forecourt\'s benches. The one gurney the city has, 4_-2·court·gurney·0, stands in the ambulance court 32 m north of the forecourt, which the city\'s own notes put under the EMERGENCY canopy)'],
  },
};

// the game's links, both ways, and the way out of each held place (src/map.mjs)
const LINKS = [
  ...Object.entries(GAME.blocks).flatMap(([id, B]) => B.links.map(to => [id, to])),
  ...Object.entries(GAME.held).flatMap(([id, H]) => [[id, H.exit], ...Object.keys(GAME.blocks).map(from => [from, id])]),
];

const browser = await launch({ width: 640, height: 400 });
let failed = false;
try {
  const page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.readySeconds !== null', 240000);
  const made = await page.evaluate(`(async () => {
    const { CITY } = window.__demo;
    const SPEC = ${JSON.stringify(SPEC)};
    const HELD = ${JSON.stringify(HELD)};
    const [ST, J, PLAN, FRAME] = await Promise.all([import(CITY + 'simstate/stands.js'), import(CITY + 'jobs.js'), import(CITY + 'plan.js'), import(CITY + 'interiors/city/frame.js')]);
    const json = p => fetch(new URL(p, CITY)).then(r => r.json());
    const [SIM, PUB, WORLD, PIN] = await Promise.all([json('../../sim2/places.json'), json('simstate/stands.json'), json('../../world/export/world.json'), json('../../PIN.json').catch(() => null)]);
    const P = PLAN.P;
    const CAP = 36;
    const r2 = v => +(+v).toFixed(2);
    const blockOf = (x, z) => [Math.floor(x / P), Math.floor(z / P)];
    const cityPlace = id => SIM.places.find(p => p.id === id) ?? WORLD.places.find(p => p.id === id) ?? null;

    // ── the city's own audit build of a block: every piece it stamps, by id, with its box [x0, y0, z0, x1, y1, z1]
    const built = new Map();
    const FLAGS = { neutral: true, pass2: true, faces: true };
    function block(i, j) {
      const key = i + ',' + j;
      if (!built.has(key)) {
        let res = null;
        try { res = J.jobBlock({ i, j, night: false, audit: true, chars: false, flags: FLAGS }); } catch (err) { res = null; }
        built.set(key, { i, j, items: (res?.audit?.list ?? []).map(([id, box]) => ({ id, kind: id.split('·').slice(1, 3).join('·'), box })), lots: res?.anchors?.lots ?? {} });
      }
      return built.get(key);
    }
    /** The pieces of a kind ('group·kind', or 'group·kind#n' for one of them) in the blocks round a point. */
    function pieces(name, x, z, ring = 1) {
      // ('group·kind!': the biggest of them by footprint, a building's main mass and not the sign on it)
      const big = name.endsWith('!');
      const [kind, n] = (big ? name.slice(0, -1) : name).split('#');
      const [bi, bj] = blockOf(x, z);
      const list = [];
      for (let i = bi - ring; i <= bi + ring; i++) for (let j = bj - ring; j <= bj + ring; j++) for (const it of block(i, j).items) if (it.kind === kind) list.push(it);
      const mid = it => [(it.box[0] + it.box[3]) / 2, (it.box[2] + it.box[5]) / 2];
      list.sort((a, b) => Math.hypot(mid(a)[0] - x, mid(a)[1] - z) - Math.hypot(mid(b)[0] - x, mid(b)[1] - z));
      if (big) return list.sort((a, b) => (b.box[3] - b.box[0]) * (b.box[5] - b.box[2]) - (a.box[3] - a.box[0]) * (a.box[5] - a.box[2])).slice(0, 1);
      return n === undefined ? list : list.slice(+n, +n + 1);
    }
    /** A point at a piece: a step out from the middle of one face, its middle, or ('in') a step out on the side facing (x, z). */
    function pointAt(it, how, x, z, out = 1.1) {
      const [x0, , z0, x1, , z1] = it.box;
      const [mx, mz] = [(x0 + x1) / 2, (z0 + z1) / 2];
      if (how === 'mid') return [mx, mz];
      let side = how;
      if (how === 'in') {
        // (the face nearest the point the place gathers round, measured from outside the box)
        const cand = [['W', x0 - x], ['E', x - x1], ['N', z0 - z], ['S', z - z1]].sort((a, b) => b[1] - a[1]);
        side = cand[0][0];
      }
      return side === 'W' ? [x0 - out, mz] : side === 'E' ? [x1 + out, mz] : side === 'N' ? [mx, z0 - out] : [mx, z1 + out];
    }

    // ── the walkers' graph and the cars' lanes (world.json), for the ways in and out
    const G = WORLD.graph;
    const nodeXZ = n => [G.walk.xz[n * 2], G.walk.xz[n * 2 + 1]];
    function sidewalkNear(x, z) {
      let best = null;
      for (let e = 0; e < G.walk.edges.length / 3; e++) {
        if (!G.walk.side[e]) continue;
        const [a, b] = [nodeXZ(G.walk.edges[e * 3]), nodeXZ(G.walk.edges[e * 3 + 1])];
        const [vx, vz] = [b[0] - a[0], b[1] - a[1]];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz || 1)));
        const p = [a[0] + vx * t, a[1] + vz * t];
        const d = Math.hypot(p[0] - x, p[1] - z);
        if (!best || d < best.d) best = { d, x: r2(p[0]), z: r2(p[1]), edge: e };
      }
      return best ? { x: best.x, z: best.z, metres: r2(best.d) } : null;
    }
    function kerbNear(x, z) {
      const L = G.road.lanes;
      let best = null;
      for (let n = 0; n < L.length / 6; n++) {
        if (G.road.live && !G.road.live[n]) continue;
        const [x0, z0, ux, uz, len] = [L[n * 6 + 1], L[n * 6 + 2], L[n * 6 + 3], L[n * 6 + 4], L[n * 6 + 5]];
        const s = Math.max(0, Math.min(len, (x - x0) * ux + (z - z0) * uz));
        const p = [x0 + ux * s, z0 + uz * s];
        const d = Math.hypot(p[0] - x, p[1] - z);
        if (!best || d < best.d) best = { d, p, u: [ux, uz], k: G.road.kerb ? G.road.kerb[n] : 0 };
      }
      if (!best) return null;
      // (the kerb lane is to the lane's right: world/export README, graph.road.kerb)
      const [rx, rz] = [-best.u[1], best.u[0]];
      return { x: r2(best.p[0] + rx * best.k), z: r2(best.p[1] + rz * best.k), heading: r2(Math.atan2(best.u[0], best.u[1])), metres: r2(best.d) };
    }
    function subwayNear(x, z) {
      const s = WORLD.transit.stations.filter(q => q.built !== false).map(q => ({ id: q.id, name: q.name, x: q.x, z: q.z, face: q.face ?? null, lines: q.lines, metres: r2(Math.hypot(q.x - x, q.z - z)) })).sort((a, b) => a.metres - b.metres)[0];
      return s ?? null;
    }

    // ── each place: where it is, its named spots, what the camera faces, its ways
    const table = {};
    const asks = [];
    const errors = [];
    for (const [id, S] of [...Object.entries(SPEC).map(e => [...e, false]), ...Object.entries(HELD).map(e => [...e, true])]) {
      const C = S.city ? cityPlace(S.city) : null;
      if (S.city && !C) { errors.push(id + ': the city has no place ' + S.city); continue; }
      let at = C ? [C.x, C.z] : null;
      // (a dealing corner's own point is the middle of the crossing: its people's is the middle of its published spots)
      if (C?.kind === 'corner' && PUB.places[S.city]?.spots.length) {
        const q = PUB.places[S.city].spots;
        at = [q.reduce((a, s) => a + s.x, 0) / q.length, q.reduce((a, s) => a + s.z, 0) / q.length];
      }
      // (a hero piece the place list does not name, or a place whose gathering point is one of its pieces)
      if (S.at) {
        // (where to look for the piece: the place's own point, else the city place next door)
        const from = at ?? ((() => { const q = PUB.places[id === 'bar' ? 'fitstreet' : 'corner--1_1']; return [q.x, q.z]; })());
        const list = pieces(S.at[0], from[0], from[1], 1);
        if (!list.length) { errors.push(id + ': no piece ' + S.at[0]); continue; }
        // (several of a kind, the picnic tables: the middle of them all)
        if (S.at[1] === 'mid') at = [list.reduce((q, it) => q + (it.box[0] + it.box[3]) / 2, 0) / list.length, list.reduce((q, it) => q + (it.box[2] + it.box[5]) / 2, 0) / list.length];
        else at = pointAt(list[0], S.at[1], from[0], from[1], S.at[1] === 'in' ? 2.2 : 1.6);
      }
      at = at.map(r2);
      const spots = { street: at };
      const fixtures = {};
      for (const [name, [piece, how]] of Object.entries(S.spots ?? {})) {
        const it = pieces(piece, at[0], at[1], 1)[0];
        if (!it) { errors.push(id + ': no piece ' + piece + ' for ' + name); continue; }
        spots[name] = pointAt(it, how, at[0], at[1]).map(r2);
        fixtures[name] = { id: it.id, box: it.box.map(r2) };
      }
      let look = null;
      if (S.face) {
        const it = pieces(S.face, at[0], at[1], 1)[0];
        if (it) {
          const [fx, fz] = [(it.box[0] + it.box[3]) / 2, (it.box[2] + it.box[5]) / 2];
          const d = Math.hypot(at[0] - fx, at[1] - fz) || 1;
          // (from the far side of the gathering point, looking at the piece: the stage reads the direction alone)
          look = [[r2(at[0] + ((at[0] - fx) / d) * 11), 5.5, r2(at[1] + ((at[1] - fz) / d) * 11)], [at[0], 1.6, at[1]]];
          fixtures.front = { id: it.id, box: it.box.map(r2) };
        } else errors.push(id + ': no piece ' + S.face + ' to face');
      } else if (S.from) {
        const C8 = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0], NE: [0.71, -0.71], NW: [-0.71, -0.71], SE: [0.71, 0.71], SW: [-0.71, 0.71] }[S.from];
        look = [[r2(at[0] + C8[0] * 11), 5.5, r2(at[1] + C8[1] * 11)], [at[0], 1.6, at[1]]];
      }
      // seats: each bench the build stamps there gives two (the maker's own figures for one of the city's benches:
      // 0.42 m either side of the middle, a third of a metre forward of it, the seat 0.1 m over the ground, facing
      // away from the backrest: here, the side the place gathers on)
      const seats = [];
      for (const kind of S.seats ?? []) {
        for (const it of pieces(kind, at[0], at[1], 1)) {
          const [x0, , z0, x1, , z1] = it.box;
          const ew = x1 - x0 > z1 - z0;
          const [mx, mz] = [(x0 + x1) / 2, (z0 + z1) / 2];
          const f = ew ? [0, Math.sign(at[1] - mz) || 1] : [Math.sign(at[0] - mx) || 1, 0];
          for (const o of [-0.42, 0.42]) seats.push({ x: r2(mx + (ew ? o : 0) + f[0] * 0.33), z: r2(mz + (ew ? 0 : o) + f[1] * 0.33), y: 0.3, ry: +Math.atan2(f[0], f[1]).toFixed(3), kind: 'bench', st: null, entry: null, piece: it.id });
        }
      }
      const walk = sidewalkNear(at[0], at[1]);
      table[id] = {
        held: !!S.held, cityPlace: S.city, name: S.name, place: S.note, at, spots, fixtures, look, reach: S.reach, seats, only: S.only ?? null, hole: S.hole ?? 0,
        ways: { walk, kerb: kerbNear(at[0], at[1]), subway: subwayNear(at[0], at[1]) },
        missing: S.missing ?? [],
      };
      // what the maker is asked: the place's own point, its named spots, and a ring 5 m round it
      const ask = (x, z) => asks.push({ id: 'hk2:' + id + ':' + asks.length, name: id, kind: 'hangout', x, z });
      for (const q of Object.values(spots)) ask(q[0], q[1]);
      for (const [dx, dz] of [[5, 0], [-5, 0], [0, 5], [0, -5], [9, 0], [-9, 0], [0, 9], [0, -9]]) ask(at[0] + dx, at[1] + dz);
    }
    for (const id of Object.keys(HELD)) if (table[id]) table[id].held = true;

    // ── where people stand: the city's published spots first, then its maker asked at ours
    for (const p of asks) ST.STAND.place[p.id] = ${count};
    const logs = [];
    const made = await ST.makeStands({ places: { places: asks }, flags: FLAGS, cornerKits: new Set(), log: m => logs.push(String(m)) });
    const stands = Object.fromEntries(Object.keys(table).map(id => [id, []]));
    const ids = Object.keys(table);
    const owner = s => ids.map(id => [id, Math.hypot(table[id].at[0] - s.x, table[id].at[1] - s.z)]).sort((a, b) => a[1] - b[1])[0];
    const counts = { published: 0, made: 0, seats: 0, dropped: 0 };
    // (a spot is its publisher's; a made one is the nearest place's, when it is entered from a sidewalk of one of
    // that place's own city blocks, or from none: nobody "at the bar" stands across Washington St)
    const homeBlocks = id => new Set(Object.values(table[id].spots).map(q => blockOf(q[0], q[1]).join(',')));
    const take = (s, from, src, mine = null) => {
      const [id, far] = mine ? [mine, Math.hypot(table[mine].at[0] - s.x, table[mine].at[1] - s.z)] : owner(s);
      const T = table[id];
      if (src === 'made' && (T.only === 'published' || (s.entry && !homeBlocks(id).has(s.entry.i + ',' + s.entry.j)))) { counts.dropped += 1; return; }
      if (src !== 'published' && (far > T.reach || (far < T.hole && src === 'made'))) { counts.dropped += 1; return; }
      // (a body's width and more from the next spot; two seats of one bench are the bench's own 0.84 m apart)
      if (stands[id].some(q => Math.hypot(q.x - s.x, q.z - s.z) < (s.kind === 'bench' && q.kind === 'bench' ? 0.7 : 1.25))) return;
      // (a named spot of ours is somebody's place already: the keeper of the counter)
      if (Object.entries(T.spots).some(([name, q]) => name !== 'street' && Math.hypot(q[0] - s.x, q[1] - s.z) < 1.0)) return;
      counts[src] += 1;
      // (THE LEAN POINT IS 0.3 M OFF ITS WALL, NOT THE CITY'S 0.2: the collision world is quarter-metre columns, and a
      // body's middle 0.2 m off a wall is in the wall's own column: demo/tools/set-stands.mjs found it)
      const lean = s.lean ? [r2(s.lean[0] + Math.sin(s.lean[2]) * 0.1), r2(s.lean[1] + Math.cos(s.lean[2]) * 0.1), s.lean[2]] : null;
      const jitter = from ? s.ry - Math.atan2(from.x - s.x, from.z - s.z) : 0;
      const out = { x: s.x, z: s.z, ry: s.kind === 'bench' ? s.ry : +(Math.atan2(T.at[0] - s.x, T.at[1] - s.z) + jitter).toFixed(3), st: s.st ?? null, kind: s.kind ?? 'open', entry: s.entry ?? null, far: r2(far), src };
      if (lean) out.lean = lean;
      if (s.sit) out.sit = s.sit;
      if (s.pace) out.pace = s.pace;
      if (s.beat?.length) out.beat = s.beat;
      if (s.kind === 'bench' && s.y !== undefined) out.y = s.y;
      if (s.piece) out.piece = s.piece;
      stands[id].push(out);
    };
    // (the seats of the benches named above come first: they are the place's own fixtures)
    for (const id of ids) for (const s of table[id].seats) take(s, null, 'seats', id);
    for (const id of ids) {
      const pub = table[id].cityPlace ? PUB.places[table[id].cityPlace] : null;
      for (const s of pub?.spots ?? []) take(s, pub, 'published', id);
    }
    for (const [pid, p] of Object.entries(made.places)) if (pid.startsWith('hk2:')) for (const s of p.spots) take(s, p, 'made');
    for (const id of ids) {
      stands[id].sort((a, b) => a.far - b.far);
      // (the nearest CAP, and every seat: a place's people are a couple of dozen at most)
      stands[id] = stands[id].filter((s, k) => k < CAP || s.kind === 'bench');
      delete table[id].seats;
      delete table[id].only;
      delete table[id].hole;
      // the city blocks the place stands on (its spots, its named points): what a load of the place must build
      const need = new Set([table[id].at, ...Object.values(table[id].spots), ...stands[id].map(s => [s.x, s.z])].map(q => blockOf(q[0], q[1]).join(',')));
      table[id].blocks = [...need].map(k => k.split(',').map(Number));
    }

    // ── the ten homes: the ten trailer pads of Sunny Acres nearest the lane the place gathers on
    const home = table.projects;
    const pads = {};
    if (home) {
      const lots = SIM.lots.filter(l => l.tier === 'trailer').map(l => ({ ...l, far: Math.hypot(l.x - home.at[0], l.z - home.at[1]) })).sort((a, b) => a.far - b.far);
      let n = 0;
      for (const l of lots) {
        if (n >= 10) break;
        // (its frame, from the anchors of the block it is built in: the city's own cutaway opens on this)
        const [bi, bj] = blockOf(l.x, l.z);
        let frame = null;
        for (let i = bi - 1; i <= bi + 1 && !frame; i++) for (let j = bj - 1; j <= bj + 1 && !frame; j++) {
          const A = block(i, j).lots[l.lot] ?? block(i, j).lots[l.id];
          if (A) frame = FRAME.lotEntry(l.id, A, [i, j]);
        }
        if (!frame) continue;
        n += 1;
        pads['a' + n] = { home: l.id, name: l.name, door: [r2(l.x), r2(l.z)], block: frame.block, far: r2(l.far) };
        home.blocks.push(blockOf(l.x, l.z));
        home.blocks.push(frame.block);
      }
      home.blocks = [...new Set(home.blocks.map(b => b.join(',')))].map(k => k.split(',').map(Number));
      if (n < 10) errors.push('only ' + n + ' trailer pads with a frame near Sunny Acres');
    }
    // ── what each trip of the game's map would cost, by the city's own planner
    const trips = {};
    try {
      const TR = await import(new URL('../../world/export/travel.mjs', CITY).href);
      const T = TR.createTravel(WORLD);
      for (const [a, b] of ${JSON.stringify(LINKS)}) {
        if (!table[a] || !table[b]) continue;
        const q = { straight: Math.round(Math.hypot(table[a].at[0] - table[b].at[0], table[a].at[1] - table[b].at[1])) };
        for (const mode of ['walk', 'scooter', 'subway', 'taxi']) {
          let t = null;
          try { t = T.trip(table[a].at, table[b].at, mode, { dep: 0 }); } catch (err) { t = null; }
          if (t && Number.isFinite(t.seconds)) q[mode] = { seconds: Math.round(t.seconds), metres: Math.round(t.metres) };
        }
        trips[a + '>' + b] = q;
      }
    } catch (err) { errors.push('no trip quotes: ' + (err?.message ?? err)); }
    return { table, stands, pads, trips, counts, errors, asked: asks.length, ms: made.ms, pin: PIN, lotKeys: home ? Object.keys(block(...blockOf(home.at[0], home.at[1])).lots).slice(0, 6) : [], makerErrors: (made.errors ?? []).slice(0, 10), logs: logs.filter(l => l.includes('hk2:')).slice(0, 200) };
  })()`, 900000);
  if (process.argv.includes('--verbose')) for (const line of made.logs) console.log(line);
  for (const e of made.errors) console.log(`! ${e}`);
  console.log(`asked the city's maker at ${made.asked} points (${(made.ms / 1000).toFixed(0)} s); spots kept: ${made.counts.published} published by the city, ${made.counts.made} made by its maker, ${made.counts.seats} bench seats; ${made.counts.dropped} too far from any place`);
  for (const [id, T] of Object.entries(made.table)) {
    const S = made.stands[id];
    const n = kind => S.filter(s => s.kind === kind).length;
    console.log(`${(id + (T.held ? ' (held)' : '')).padEnd(16)} ${String(T.name).padEnd(26)} at ${String(T.at).padEnd(16)} ${String(S.length).padStart(2)} spots · wall ${n('wall')} · ledge ${n('stoop')} · bench ${n('bench')} · blocks ${T.blocks.map(b => b.join(',')).join(' ')} · walk ${T.ways.walk?.metres} m · subway ${T.ways.subway?.name} ${T.ways.subway?.metres} m`);
    for (const [name, f] of Object.entries(T.fixtures)) console.log(`${''.padEnd(16)} ${name.padEnd(16)} ${f.id} [${f.box}]${T.spots[name] ? ' → stands at ' + T.spots[name] : ''}`);
  }
  console.log(`homes: ${Object.entries(made.pads).map(([seat, p]) => `${seat} ${p.name} (${p.far} m)`).join(', ') || 'NONE'}${Object.keys(made.pads).length ? '' : ' · lot keys seen: ' + made.lotKeys.join(' ')}`);
  const places = {};
  const held = {};
  for (const [id, T] of Object.entries(made.table)) {
    const { held: isHeld, ...rest } = T;
    (isHeld ? held : places)[id] = { ...rest, stands: made.stands[id] };
  }
  const file = {
    note: 'THE PLACE TABLE: where the game\'s ten places are in the real city, read from the city\'s own data. Made by demo/tools/place-table.mjs (its header says from what): re-run it when the pinned city changes. Not edited by hand.',
    generated: new Date().toISOString(),
    pin: made.pin?.commit ?? made.pin ?? null,
    places, held, pads: made.pads, trips: made.trips,
  };
  writeFileSync(out, `${JSON.stringify(file, null, 1)}\n`);
  const links = Object.entries(made.trips).filter(([k]) => !/jail|clinic/.test(k));
  const range = mode => { const v = links.map(([, q]) => q[mode]?.seconds).filter(Number.isFinite); return v.length ? `${Math.min(...v)} to ${Math.max(...v)} s` : 'none'; };
  console.log(`trips of the game's links, by the city's planner: on foot ${range('walk')}, scooter ${range('scooter')}, subway ${range('subway')}, cab ${range('taxi')}`);
  console.log(`saved ${path.relative(process.cwd(), out)}`);
  failed = made.errors.length > 0 || Object.values(made.stands).some(s => s.length < 3);
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  if (bad.length) console.log(`page errors:\n  ${[...new Set(bad)].slice(0, 8).join('\n  ').slice(0, 2000)}`);
} catch (err) {
  failed = true;
  console.error(String(err));
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
