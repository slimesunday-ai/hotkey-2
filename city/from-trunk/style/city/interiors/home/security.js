// Home objects · security and stash (sim pieces). The safes speak the simassets language (security.js safe): a forest-green body with a
// lighter lid edge, a gold pinstripe door, a gold dial with ink ticks, a chrome spoked handle, chrome hinges, the OAK maker's plate.
// Locks use its gold deadbolts and steel. Sim pieces take a `state` beside { variant, seed }: 'closed' | 'open' (safes and stashes),
// 'armed' | 'off' (the keypad). The first entry of `states` is the default.
import { def, K, SAFE, pick, cyl, line, glow, LIT, shade, mix, rng, hash, txt, M3, cash, frect, fdisc, fline, ftxt, hbox, fsurf, fcolour, billTex, cylX, cylZ, ball } from './lib.js';
import { picture, framed } from './walls.js';

// a safe door hinged at x = hx (its left edge when shut) on the front plane z1, dw wide, rows y0..y1. Open, it has swung 90° out:
// the slab runs along +z at x = hx − 1, its outer face (dial, handle) toward −x, its bolts on the inner face toward the room.
function safeDoor(V, hx, z1, dw, y0, y1, open, big) {
  const at = (u, y, out) => open ? [hx - 1 - out, y, z1 + u] : [hx + u, y, z1 + out], set = (u, y, out, c, l = 0) => { const [x, yy, z] = at(u, y, out); V.set(x, yy, z, c, l); };
  for (let u = 0; u < dw; u++) for (let y = y0; y < y1; y++) { const e = u === 0 || u === dw - 1 || y === y0 || y === y1 - 1; set(u, y, 0, e ? K.gold : SAFE.body, e ? 2 : 0); }
  const dr = big ? 2.6 : 1.6, du = big ? dw - 5.5 : dw - 3.5, dy = big ? y0 + (y1 - y0) * .62 : y0 + (y1 - y0) * .6;
  for (let u = 0; u < dw; u++) for (let y = y0; y < y1; y++) { const d = Math.hypot(u + .5 - du, y + .5 - dy); if (d <= dr) set(u, y, 1, ((u + y) % 2 === 0 && d > dr - .9) ? K.ink : K.gold, 2); }   // the dial
  set(Math.floor(du), Math.floor(dy), 2, K.ink);
  const hu = big ? du : dw - 3, hy = big ? y0 + (y1 - y0) * .36 : y0 + 2, sp = big ? 3 : 1;                                    // the spoked handle
  set(Math.floor(hu), Math.floor(hy), 1, K.chrome, 2); for (let k = 0; k < (big ? 5 : 3); k++) { const a = k / (big ? 5 : 3) * Math.PI * 2 + .3; for (let t = 1; t <= sp; t++) set(Math.round(hu - .5 + Math.cos(a) * t), Math.round(hy - .5 + Math.sin(a) * t), 1, K.chrome, 2); }
  if (big) { const M = M3('OAK'), pu = Math.round((dw - M.w) / 2); for (let u = pu - 1; u < pu + M.w + 1; u++) for (let y = y1 - 8; y < y1 - 1; y++) set(u, y, 1, K.gold, 2);   // the maker's plate
    for (let j = 0; j < 5; j++) for (let i = 0; i < M.w; i++) if (M.at(i, j)) set(pu + i, y1 - 3 - j, 2, K.ink); }
  for (const y of [y0 + 1, y1 - 3]) { const [x, , z] = open ? [hx - 1, y, z1] : [hx - 1, y, z1]; V.box(x, y, z, x + 1, y + 2, z + 1, K.chrome, 2); }   // hinges
  if (open) for (let y = y0 + 2; y < y1 - 1; y += big ? 4 : 3) V.set(hx, y, z1 + dw - 2, K.chrome, 2);                            // bolts on the inner face
}
function safeBody(V, x0, x1, y1, z1, open, fill) {
  for (const x of [x0 + 1, x1 - 3]) for (const z of [1, z1 - 3]) V.box(x, 0, z, x + 2, 1, z + 2, K.ink);   // stubby feet
  V.box(x0, 1, 0, x1, y1, z1, SAFE.body); V.box(x0, y1 - 1, 0, x1, y1, z1, SAFE.lid);
  if (open) { V.box(x0 + 1, 2, 1, x1 - 1, y1 - 1, z1, -1); V.box(x0 + 1, 2, 0, x1 - 1, y1 - 1, 1, 0x2a2d33); V.box(x0 + 1, 1, 1, x1 - 1, 2, z1, 0x3a3c44); fill(); }   // the cavity and what's in it
}

// ── fine pass (2026-11-17): a safe's dial (ticks round its rim, the index notch over it, a ridged knob), its spoked handle's ball ends
// (fine voxels), a keyhole; on the +z face, centre (cx, cy) and radius r in voxels; z the plane in front of the dial (fine voxels go there)
function dialFine(P, cx, cy, r) {
  // a clean round dial over the voxels' checker: an ink rim, white ticks inside it, a brass face, the ink knob and its pointer
  fdisc(P, '+z', cx, cy, r, (d, th) => { const k = ((th + Math.PI) / (Math.PI * 2)) * 12; return d > r - .3 ? K.ink : d > r - .7 ? (Math.abs(k - Math.round(k)) < .18 ? K.white : 0xc99a2e) : d < .55 ? K.ink : (Math.abs(th - Math.PI / 2) < .2 && d < r - .7 ? K.ink : 0xe7bd4a); });
  frect(P, '+z', cx - .125, cy + r + .1, cx + .125, cy + r + .5, K.white);
}
function spokeEnds(P, x0, hu, hy, z, n, len) {
  for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + .3, x = x0 + Math.round(hu - .5 + Math.cos(a) * len), y = Math.round(hy - .5 + Math.sin(a) * len); hbox(P, x, y, z, x + 1, y + 1, z + .5, K.chrome, 2); }
}
const keyhole = (P, x, y) => { fdisc(P, '+z', x, y + .2, .3, K.ink); frect(P, '+z', x - .125, y - .45, x + .125, y + .2, K.ink); };

export const safeSmall = def({ id: 'safe-small', name: 'Small safe', cat: 'security', place: 'floor', foot: [2, 3], h: 0.55, sim: 'safe', states: ['closed', 'open'],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['safe', 'closet', 'cash'], variants: 1, vnames: ['OAK green'],
  build(V, { state = 'closed' } = {}) {
    const open = state === 'open';   // the front cells are the door's swing
    safeBody(V, 1, 10, 11, 7, open, () => { cash(V, 2, 2, 2, 3, 3, 2); cash(V, 5, 2, 2, 3, 3, 2); cash(V, 2, 4, 2, 3, 3, 1); V.box(6, 4, 3, 8, 5, 5, K.gold, 2); });
    safeDoor(V, 2, 7, 7, 2, 10, open, false);
  },
  fine(P, { state = 'closed', V }) {
    if (state === 'open') { fcolour(P, V, K.cash, ['+y', '+z'], billTex); return; }
    dialFine(P, 5.5, 6.8, 1.6); spokeEnds(P, 2, 4, 4, 9, 3, 1); keyhole(P, 3.5, 3.5);
    for (const y of [3, 7]) frect(P, '+z', 1.375, y, 1.625, y + 2, shade(K.chrome, .7));
  } });

export const safeBig = def({ id: 'safe-big', name: 'Big safe', cat: 'security', place: 'floor', foot: [4, 5], h: 1.6, sim: 'safe', states: ['closed', 'open'],
  tiers: ['house', 'penthouse'], tags: ['safe', 'vault', 'cash'], variants: 1, vnames: ['OAK green'], far: true,
  build(V, { state = 'closed', seed = 1 } = {}) {
    const open = state === 'open', r = rng(seed * 3 + 1);
    safeBody(V, 2, 18, 32, 11, open, () => {
      for (let x = 3; x < 14; x += 4) for (let y = 2; y < 8; y += 2) cash(V, x, y, 2, 4, 5, 2);                           // bricks of cash
      V.box(3, 15, 1, 17, 16, 10, 0x3a3c44); for (let x = 4; x < 15; x += 3) V.box(x, 16, 3, x + 2, 17, 7, K.gold, 2); V.box(5, 17, 4, 12, 18, 6, K.gold, 2);   // a shelf, gold bars
      V.box(3, 22, 1, 17, 23, 10, 0x3a3c44); V.box(4, 23, 2, 14, 28, 9, 0x2a2a31); V.box(8, 28, 3, 10, 29, 8, 0x2a2a31); V.box(4, 25, 9, 14, 26, 10, K.gold, 2);   // a second shelf, a duffel on it
    });
    safeDoor(V, 3, 11, 14, 2, 31, open, true);
  },
  fine(P, { state = 'closed', V }) {
    if (state === 'open') { fcolour(P, V, K.cash, ['+y', '+z'], billTex); fcolour(P, V, K.gold, ['+y'], (x, y, z, f, i, j) => i === j ? 0xfff0b0 : null, [3, 15, 1, 17, 19, 10]); return; }
    dialFine(P, 11.5, 19.98, 2.6); spokeEnds(P, 3, 8.5, 2 + 29 * .36, 13, 5, 3); keyhole(P, 6, 13);
    // the maker's plate: four rivets; the bolt-work's line down the door's edge
    for (const [x, y] of [[5.25, 28.5], [15.5, 28.5], [5.25, 23.25], [15.5, 23.25]]) frect(P, '+z', x, y, x + .25, y + .25, shade(K.gold, .7));
    fline(P, '+z', 15.5, 4, 15.5, 22, shade(SAFE.body, .7));
  } });

export const safePainting = def({ id: 'safe-painting', name: 'Safe behind a painting', cat: 'security', place: 'wall', foot: [3, 3], h: 0.8, mount: 1.1, sim: 'safe', states: ['closed', 'open'],
  tiers: ['house', 'penthouse'], tags: ['safe', 'hidden', 'art'], variants: 2, vnames: ['colour field', 'boat'],
  build(V, { variant = 0, seed = 1, state = 'closed' } = {}) {
    const img = picture(variant ? 'boat' : 'field', seed);   // open: the painting has swung out 90° on its left hinge (it needs 0.8 m clear)
    V.box(2, 2, 0, 13, 13, 1, K.steelD, 2); V.box(3, 3, 0, 12, 12, 1, SAFE.body);                                        // the wall safe, flush
    V.box(3, 3, 1, 12, 4, 2, K.gold, 2); V.box(3, 11, 1, 12, 12, 2, K.gold, 2); V.box(3, 3, 1, 4, 12, 2, K.gold, 2); V.box(11, 3, 1, 12, 12, 2, K.gold, 2);   // pinstripe
    for (let x = 5; x < 9; x++) for (let y = 6; y < 10; y++) if (Math.hypot(x + .5 - 7, y + .5 - 8) < 1.9) V.set(x, y, 1, (x + y) % 2 ? K.ink : K.gold, 2);   // dial
    V.box(9, 5, 1, 10, 7, 2, K.chrome, 2); V.box(8, 5, 1, 11, 6, 2, K.chrome, 2);                                          // handle
    if (state !== 'open') { framed(V, 15, 15, img, K.gold, 2, 2); V.box(0, 2, 4, 1, 4, 5, K.chrome, 2); V.box(0, 11, 4, 1, 13, 5, K.chrome, 2); return; }   // shut: the picture over it
    for (let u = 0; u < 15; u++) for (let y = 0; y < 15; y++) { const e = u === 0 || u === 14 || y === 0 || y === 14;             // swung open: we see its back
      V.set(0, y, 1 + u, e ? K.gold : img(Math.min(12, Math.max(0, u - 1)), Math.min(12, Math.max(0, y - 1)), 13, 13), e ? 2 : 0); V.set(1, y, 1 + u, e || y === 7 || u === 7 ? K.ply : K.cream); }
    V.box(0, 2, 0, 2, 4, 1, K.chrome, 2); V.box(0, 11, 0, 2, 13, 1, K.chrome, 2);                                          // hinges
  } });

export const stashFloorboard = def({ id: 'stash-floorboard', name: 'Loose floorboard', cat: 'stash', place: 'floor', foot: [2, 3], h: 0.1, sim: 'stash', states: ['closed', 'open'],
  tiers: ['trailer', 'apartment', 'house'], tags: ['stash', 'hidden', 'floor'], variants: 3, vnames: ['oak', 'walnut', 'grey paint'],
  build(V, { variant = 0, seed = 1, state = 'closed' } = {}) {
    const c = pick([K.oak, K.walnut, 0x8d8f98], variant), r = rng(seed * 7 + 2);
    for (let p = 0; p < 5; p++) { const j = 3 + ((r() * 9) | 0), tone = p % 2 ? c : shade(c, .92);
      for (let x = p * 2; x < p * 2 + 2; x++) for (let z = 0; z < 15; z++) V.set(x, 0, z, z === j ? shade(c, .7) : tone);
      V.set(p * 2, 0, 1, K.gun); V.set(p * 2, 0, 13, K.gun); }                                                             // nails
    if (state !== 'open') { V.box(4, 1, 11, 6, 2, 14, shade(c, .92)); V.set(4, 0, 13, shade(c, .7)); return; }             // the tell: one board proud, a nail gone
    V.box(4, 0, 2, 6, 1, 13, K.ink); V.box(4, 0, 3, 6, 1, 6, K.cash); V.box(4, 0, 4, 6, 1, 5, K.white); V.box(4, 0, 7, 6, 1, 10, K.cash); V.box(4, 0, 8, 6, 1, 9, K.white); V.set(5, 0, 11, K.gold, 2);   // cash in the gap
    V.box(6, 1, 1, 8, 2, 12, shade(c, .92)); V.box(8, 1, 12, 10, 2, 13, K.red); V.box(9, 1, 3, 10, 2, 12, K.steelD, 2);           // the board, pulled up; a pry bar
  },
  // fine pass: the seams between the boards, the grain along each, the nail heads (the voxel nails are only where they sit)
  fine(P, { variant = 0, seed = 1, state = 'closed', V }) {
    const c = pick([K.oak, K.walnut, 0x8d8f98], variant), dk = shade(c, .62), gr = shade(c, .82);
    fsurf(P, V, '+y', 0, 0, 0, 10, 2, 15, (x, y, z, i, j) => { const v = V.pal[V.d[x + z * V.nx + y * V.sxz]]; if (v === K.cash || v === K.white || v === K.ink || v === K.red || v === K.gun || v === K.steelD) return null;
      if (x % 2 === 0 && i === 0) return dk; if (variant !== 2 && i === 2 + (x & 1) - 1 && hash(x >> 1, z, seed) > .55) return gr; return null; });
    if (state !== 'open') fsurf(P, V, '+z', 4, 1, 11, 6, 2, 14, (x, y, z, i, j) => j === 0 ? dk : null);
  } });

export const stashBook = def({ id: 'stash-book', name: 'Hollow book', cat: 'stash', place: 'surface', foot: [2, 1], h: 0.2, sim: 'stash', states: ['closed', 'open'],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['stash', 'hidden', 'shelf'], variants: 3, vnames: ['red', 'cobalt', 'green'],
  build(V, { variant = 0, state = 'closed' } = {}) {
    const c = pick([K.red, K.cobalt, 0x1f6a3a], variant), book = (x0, y0, w, cov) => { V.box(x0, y0, 0, x0 + w, y0 + 2, 5, K.cream); V.box(x0, y0 + 1, 0, x0 + w, y0 + 2, 5, cov); V.box(x0, y0, 0, x0 + 1, y0 + 2, 5, cov); };
    if (state !== 'open') { book(1, 0, 8, K.navy); book(2, 2, 7, c); V.set(5, 3, 2, K.gold); return; }
    V.box(0, 0, 0, 5, 1, 5, c); V.box(0, 1, 0, 5, 2, 5, K.cream); V.box(0, 0, 0, 1, 2, 5, c); V.box(1, 1, 1, 4, 2, 4, -1); V.box(1, 0, 1, 4, 1, 4, K.ink); V.box(1, 1, 1, 4, 2, 3, K.cash); V.box(2, 1, 1, 3, 2, 3, K.white); V.box(1, 1, 3, 3, 2, 4, K.gold, 2);   // the cut-out: cash, a key
    V.box(5, 0, 0, 10, 1, 5, K.cream); V.box(9, 0, 0, 10, 1, 5, c);                                                       // the cover, flipped open
  },
  // fine pass: the page edges (fine lines on the cream), a title stamped in gold on the top cover and gold lines round it
  fine(P, { state = 'closed', V }) {
    fcolour(P, V, K.cream, ['+z', '+x'], (x, y, z, f, i, j) => j % 2 ? 0xd9ccb0 : null);
    if (state === 'open') { fcolour(P, V, K.cash, ['+y'], billTex); return; }
    frect(P, '+y', 3, .5, 8.5, .75, K.gold); frect(P, '+y', 3, 4.25, 8.5, 4.5, K.gold); ftxt(P, '+y', 'LAW', 4, 1.25, K.gold);
  } });

export const stashVent = def({ id: 'stash-vent', name: 'Vent stash', cat: 'stash', place: 'wall', foot: [2, 1], h: 0.3, mount: 0.25, sim: 'stash', states: ['closed', 'open'],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['stash', 'hidden', 'vent'], variants: 2, vnames: ['white', 'brass'],
  grain: 0.0125,
  grain: 0.0125,
  build(V, { variant = 0, state = 'closed' } = {}) {
    // THIRD PASS · at a quarter of the block, a real wall register: the frame, and in it a row of louvres, each slat tilted, the dark
    // duct showing between them; a screw each side. Open: the grille down on its bottom edge, a bundle of notes in the duct
    const c = pick([K.white, K.gold], variant), l = variant ? 2 : 0, DUCT = 0x2a2a31;
    const grille = (put) => { for (let x = 1; x < 39; x++) for (let y = 1; y < 19; y++) { const fr = x < 4 || x > 35 || y < 3 || y > 16; if (fr) put(x, y, 0, 2, c); }
      for (let k = 0; k < 6; k++) for (let x = 4; x < 36; x++) for (let d = 0; d < 3; d++) put(x, 4 + k * 2.2 + d * .7, d, d + 1, d === 2 ? shade(c, 1.06) : d === 0 ? shade(c, .82) : c); };   // the slats
    V.box(3, 2, 0, 37, 17, 1, DUCT);                                                                                    // the duct behind
    if (state !== 'open') { grille((x, y, z0, z1, col) => V.box(x, y, z0 + 1, x + 1, y + 1, z1 + 1, col, l)); for (const x of [2, 37]) V.box(x, 9, 3, x + 1, 10, 4, K.steelD, 2); return; }
    V.box(8, 4, 1, 30, 8, 5, K.cash); V.box(18, 4, 1, 20, 8, 5, K.white);                                               // the bundle in the duct
    grille((x, y, z0, z1, col) => V.box(x, 0, Math.min(23, 2 + (19 - y)), x + 1, 1 + (z1 - z0 > 1 ? 1 : 0), Math.min(24, 3 + (19 - y)), col, l));   // the grille, down flat
  },
  fine(P, { state = 'closed', V }) { if (state === 'open') { fcolour(P, V, K.cash, ['+z', '+y'], billTex); return; }
    for (const x of [2, 37]) frect(P, '+z', x + .375, 9.25, x + .625, 9.75, K.ink); } });   // the screws' slots

export const stashShoebox = def({ id: 'stash-shoebox', name: 'Shoebox of cash', cat: 'stash', place: 'floor', foot: [2, 1], h: 0.25, sim: 'stash', states: ['closed', 'open'],
  tiers: ['trailer', 'apartment', 'house'], tags: ['stash', 'sneakers', 'cash'], variants: 3, vnames: ['orange + white', 'black + red', 'cobalt + white'],
  build(V, { variant = 0, state = 'closed' } = {}) {
    const [b, l] = pick([[K.orange, K.white], [K.ink, K.red], [K.cobalt, K.white]], variant);
    V.box(0, 0, 0, 10, 3, 5, b); V.box(6, 1, 4, 9, 2, 5, K.white);
    if (state !== 'open') { V.box(0, 3, 0, 10, 4, 5, l); return; }
    V.box(1, 1, 1, 9, 3, 4, -1); V.box(1, 1, 1, 5, 2, 4, K.white); for (const x of [1, 3]) { V.box(x, 2, 1, x + 2, 3, 4, K.cash); V.set(x + 1, 2, 2, K.white); }   // tissue, bricks of cash
    V.box(5, 3, 0, 10, 4, 5, l); V.box(4, 4, 0, 6, 5, 5, l);                                                             // the lid, pushed half off
  },
  // fine pass: an invented mark on the lid (a lightning bolt), its edge line; the size label's print; open, the notes' faces
  fine(P, { variant = 0, state = 'closed', V }) {
    const [b, l] = pick([[K.orange, K.white], [K.ink, K.red], [K.cobalt, K.white]], variant), m = l === K.white ? b : K.white;
    frect(P, '+z', 6.25, 1.25, 8.75, 1.5, K.ink); frect(P, '+z', 6.25, 1.625, 7.75, 1.75, K.ink);
    if (state === 'open') { fcolour(P, V, K.cash, ['+y', '+z'], billTex); return; }
    P.bmp('+y', ['....##', '...##.', '..##..', '.#####', '...##.', '..##..', '.##...', '##....'], { '#': m }, 12, 4);
    frect(P, '+z', 0, 3, 10, 3.25, shade(l, .8));
  } });

export const doorLocks = def({ id: 'door-locks', name: 'Door chain and locks', cat: 'security', place: 'wall', foot: [1, 3], h: 0.1, mount: 0.9, sim: 'lock',
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['lock', 'door', 'chain'], variants: 3, vnames: ['chain + deadbolt', 'chain + three deadbolts', 'chain + keypad bolt'],
  grain: 0.0125,
  grain: 0.0125,
  build(V, { variant = 0 } = {}) {
    // THIRD PASS · at a quarter of the block: up top a deadbolt (its housing, the bolt run out into its keeper, a thumb-turn on a round
    // rose; three of them, or a keypad bolt); the chain guard (a mount, real links hanging in a sag, the knob in its slotted track);
    // and the knob lock below (a rose, a round knob)
    const S = K.steelL, SD = K.steelD, B = K.gold;
    const bolt = (y0, pad) => { V.box(5, y0, 0, 15, y0 + 8, 3, S, 2); V.box(15, y0 + 2, 0, 19, y0 + 6, 2, SD, 2);    // the housing, the keeper
      cylX(V, y0 + 4, 1.5, 1.4, 13, 17, K.chrome, 2);                                                                  // the bolt, thrown
      if (pad) { V.box(6, y0 + 1, 3, 14, y0 + 7, 4, K.ink); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) V.box(7 + i * 2.5, y0 + 2 + j * 2.5, 4, 8.5 + i * 2.5, y0 + 3.5 + j * 2.5, 5, K.pale, 1); return; }
      cylZ(V, 10, y0 + 4, 3.4, 3, 4, B, 2); V.box(9.3, y0 + 1, 4, 10.7, y0 + 7, 7, B, 2); };                          // the rose, the thumb-turn
    if (variant === 1) { bolt(50, false); bolt(41, false); bolt(32, false); } else bolt(46, variant === 2);
    // the chain guard: a mount at the left, the slotted track at the right, the links between in a sag
    const cy = variant === 1 ? 24 : 32;
    V.box(1, cy - 1, 0, 5, cy + 4, 2, S, 2); V.box(14, cy - 3, 0, 19, cy + 3, 1, S, 2); V.box(15, cy - 2, 1, 18, cy - 1.5, 2, K.ink);   // mount, track, its slot
    ball(V, 16.5, cy - 1, 2.5, 1.4, 1.4, 1.4, K.chrome, 2);                                                            // the knob in the slot
    const N = 5; for (let k = 0; k < N; k++) { const t = (k + .5) / N, x = 5 + t * 10, y = cy + 1 - Math.sin(t * Math.PI) * 5 - t * 2;   // five big links, each a ring
      for (let a = -2.5; a <= 2.5; a++) for (let b = -2; b <= 2; b++) { const e = (a / 2.6) ** 2 + (b / 2) ** 2; if (e <= 1 && e > .32) V.set(x + a, y + b, 1 + (k % 2), k % 2 ? SD : S, 2); } }
    // the knob lock
    cylZ(V, 10, 10, 4.2, 0, 1, S, 2); cylZ(V, 10, 10, 2, 1, 3, S, 2); ball(V, 10, 10, 5, 3.4, 3.4, 2.4, B, 2); V.box(9.5, 9, 7, 10.5, 11, 8, K.ink);   // rose, neck, knob, keyway
  } });

export const alarmKeypad = def({ id: 'alarm-keypad', name: 'Alarm keypad', cat: 'security', place: 'wall', foot: [2, 2], h: 0.1, mount: 1.3, sim: 'alarm', states: ['armed', 'off'],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['alarm', 'keypad', 'door'], variants: 2, vnames: ['beige', 'black'],
  grain: 0.0125,
  build(V, { variant = 0, state = 'armed' } = {}) {
    // THIRD PASS · at a quarter of the block: the panel with rounded corners, a screen set in it showing ARMED or READY, two lights,
    // and twelve real keys standing proud of it (their numbers painted, fine)
    const p = pick([K.beige, 0x1f1f24], variant), armed = state !== 'off', key = variant ? 0x3a3c44 : K.white;
    V.box(3, 2, 0, 37, 38, 3, p); for (const [x, y] of [[3, 2], [36, 2], [3, 37], [36, 37]]) V.box(x, y, 0, x + 1, y + 1, 3, -1);   // the panel, its corners off
    V.box(6, 26, 2, 34, 35, 3, 0x1f2a24); V.box(5, 25, 2, 35, 26, 3, shade(p, .8));                                    // the screen, set in
    txt(V, M3(armed ? 'ARMED' : 'READY'), 11, 33, 2, armed ? K.red : K.lime, LIT);
    ball(V, 10, 22, 3, 1.3, 1.3, 1, armed ? K.red : 0x5a1a1a, armed ? LIT : 1); ball(V, 16, 22, 3, 1.3, 1.3, 1, armed ? 0x1a4a1a : K.lime, armed ? 1 : LIT);   // two lights
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const x = 8 + c * 9, y = 4 + r * 4.5; V.box(x, y, 3, x + 6, y + 3, 4, key, 1); }   // the keys
  },
  fine(P, { variant = 0 } = {}) {
    const ink = variant ? K.white : K.ink, L = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) ftxt(P, '+z', L[(3 - r) * 3 + c], 10.25 + c * 9, 6.6 + r * 4.5, ink);
  } });

export const dogBed = def({ id: 'dog-bed', name: 'Dog bed and bowls', cat: 'security', place: 'floor', foot: [4, 3], h: 0.25, sim: 'dog',
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['dog', 'guard dog', 'pet'], variants: 3, vnames: ['red plaid', 'cobalt', 'leopard'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const rim = (x, z) => variant === 0 ? ((((x >> 1) + (z >> 1)) & 1) ? K.red : K.oxblood) : variant === 1 ? K.cobalt : (hash(x, z, 7) > .8 ? 0x4a2a14 : K.buff);
    for (let x = 0; x < 15; x++) for (let z = 0; z < 15; z++) { const e = Math.hypot((x + .5 - 7.5) / 7.4, (z + .5 - 7.5) / 7.2); if (e > 1) continue;
      if (e > .7) V.box(x, 0, z, x + 1, z > 10 ? 3 : 4, z + 1, rim(x, z)); else V.box(x, 0, z, x + 1, 2, z + 1, K.cream); }
    V.box(5, 2, 5, 9, 3, 6, K.white); for (const x of [4, 9]) V.box(x, 2, 4, x + 1, 3, 7, K.white);                          // a chew bone
    for (const [cz, fill] of [[3.5, 0x6e3e19], [10.5, K.water]]) { cyl(V, 17.5, cz, 2.4, 0, 2, K.steelL, 2); cyl(V, 17.5, cz, 1.5, 1, 2, fill, fill === K.water ? 1 : 0); }   // food, water
    V.box(16, 0, 13, 18, 2, 15, K.red);                                                                                     // a ball
  },
  // fine pass: a real tartan on the plaid (thin light lines across the checks), the cushion's stitched edge, kibble in the bowl, a
  // shine on the water, the ball's seam
  fine(P, { variant = 0, V }) {
    if (variant === 0) for (const c of [K.red, K.oxblood]) fcolour(P, V, c, ['+y', '+z'], (x, y, z, f, i, j) => (x % 2 === 0 && i === 1) || ((f === '+y' ? z : y) % 2 === 0 && j === 1) ? ((x >> 1) & 1 ? 0xffd166 : K.cream) : null);
    if (variant === 2) fcolour(P, V, K.buff, ['+y', '+z'], (x, y, z, f, i, j) => hash(x * 4 + i, y * 4 + j, z, 3) > .88 ? 0x4a2a14 : null);
    fdisc(P, '+y', 7.5, 7.5, 5.1, (d) => d > 4.75 ? shade(K.cream, .78) : null);
    fdisc(P, '+y', 17.5, 3.5, 1.5, (d, th) => hash(Math.round(d * 8), Math.round(th * 5), 1) > .45 ? 0x8a5428 : 0x4e2a10);
    fdisc(P, '+y', 17.5, 10.5, 1.5, (d, th) => d > .6 && d < .9 && th > .5 && th < 2 ? K.white : null);
    frect(P, '+y', 16, 13.75, 18, 14, K.white);
  } });

export const SECURITY = [safeSmall, safeBig, safePainting, stashFloorboard, stashBook, stashVent, stashShoebox, doorLocks, alarmKeypad, dogBed];
