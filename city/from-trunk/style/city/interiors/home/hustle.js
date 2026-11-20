// Home objects · the hustle (2026-11-17): the pieces THE RUN plays with that had no model: the desktop PC you sell from at night, the
// disc burner, the big cook station, the paperwork (the loan book, the protection book, the lawyer's card file), the lock-up, the
// stab vest, the scanner, the box cutter, the jacket lining. Invented shapes and names: no brand, logo, product design or operating
// system's artwork; the era's look only. Every piece has a fine pass (../fine.js) where the detail is finer than a voxel.
import { def, K, pick, cyl, cylZ, cylX, line, LIT, shade, mix, rng, hash, frect, fdisc, fline, ftxt, hbox, fsurf, fcolour, billTex } from './lib.js';
import { g, flex, brick } from './bits.js';

// ── THE DESKTOP PC (late 1990s): a cream mini tower, a deep CRT, two little speakers, a chunky keyboard, a ball mouse on its pad, an
// external modem on the tower. The screen is the era's desktop: teal, a column of icons, a grey taskbar, two grey windows with navy
// title bars (no logo, no real interface). It stands where the gaming rig stood: the piece for selling from home at night.
const TEAL = 0x13898a, WIN = 0xc3c3c3, WIND = 0x7d7d7d, TITLE = 0x1d2f86;
export const pcDesk = def({ id: 'computer-desktop', name: 'Desktop PC', cat: 'electronics', place: 'surface', foot: [6, 3], h: 0.65,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['computer', '90s', 'crt', 'hustle'], variants: 2, vnames: ['cream', 'putty'],
  game: g('gear', 'rare', 'store', { heatDecay: 1.2 }),
  build(V, { variant = 0 } = {}) {
    const c = pick([0xe4d8b8, 0xcdbd92], variant), d = shade(c, .8), e = shade(c, .9);
    // the tower (right): a cream box, its front a step forward, two drive bays, the floppy, a vent; the modem on top
    V.box(24, 0, 1, 30, 11, 13, c); V.box(24, 0, 13, 30, 11, 14, e);
    V.box(25, 8, 13, 29, 9, 14, d); V.box(25, 6, 13, 29, 7, 14, d);
    V.box(24, 11, 3, 30, 12, 11, 0x3a3c44); V.box(24, 11, 11, 30, 12, 12, 0x1e1f24, LIT);
    // the monitor: a deep CRT on a swivel foot, the tube's back tapering, a thick bezel round the lit screen
    V.box(11, 0, 4, 18, 1, 10, d); V.box(12, 1, 5, 17, 2, 9, e);
    V.box(8, 2, 5, 21, 12, 12, c); V.box(10, 3, 1, 19, 11, 5, e); V.box(11, 4, 0, 18, 10, 1, d);
    V.box(9, 4, 12, 20, 11, 13, TEAL, LIT); V.box(8, 2, 12, 21, 4, 13, e); V.box(8, 11, 12, 21, 12, 13, e); V.box(8, 4, 12, 9, 11, 13, e); V.box(20, 4, 12, 21, 11, 13, e);
    // the speakers, either side of the monitor, set back
    for (const x of [4, 21]) V.box(x, 0, 7, x + 3, 6, 11, c);
    // the keyboard (chunky, a step at the back), the mouse on its pad
    V.box(7, 0, 12, 21, 1, 15, c);
    V.set(22, 0, 12, c); V.set(22, 0, 13, c);
  },
  fine(P, { variant = 0 } = {}) {
    const c = pick([0xe4d8b8, 0xcdbd92], variant), d = shade(c, .8), dk = shade(c, .62);
    // THE SCREEN (x 9..20, y 4..11 on the front, 44 × 28 texels): teal desktop, icons, a taskbar, two windows
    const S = (qa, qb) => {
      const u = qa - 36, v = qb - 16;
      if (v < 3) { if (u >= 1 && u < 8 && v >= 0 && v < 3) return v === 0 || u === 7 ? WIND : u === 1 || v === 2 ? 0xffffff : WIN; if (u >= 35 && u < 43) return v === 2 ? WIND : 0xb0b0b0; return v === 2 ? 0xffffff : WIN; }
      for (const iy of [24, 19, 14]) if (u >= 2 && u < 5 && v >= iy && v < iy + 3) return iy === 24 ? 0xffe23a : iy === 19 ? 0xffffff : 0x9fd8ff;
      const win = (x0, y0, x1, y1, body) => { if (u < x0 || u >= x1 || v < y0 || v >= y1) return null; if (v >= y1 - 3) return u >= x1 - 4 && u < x1 - 1 && v === y1 - 2 ? WIN : TITLE; if (u === x0 || v === y0 || u === x1 - 1) return WIND; return body(u - x0, v - y0); };
      const back = win(8, 10, 30, 27, (i, j) => j > 1 && j < 13 && i > 1 && i < 20 && j % 3 === 1 && i < 6 + (hash(j, 3, 9) * 12 | 0) ? WIND : 0xffffff);
      const front = win(18, 4, 42, 19, (i, j) => j === 10 ? WIND : j > 1 && j < 10 && i > 1 && i < 22 ? ((i % 7 === 0) ? WIND : j % 2 === 0 && i % 7 < 5 ? (i < 7 ? 0x2a9d4a : 0x5a5a5a) : 0xffffff) : WIN);
      return front ?? back ?? TEAL;
    };
    P.rect('+z', 36, 16, 80, 44, S);
    // the bezel: a darker seam round the glass, the power button and its green light under it
    frect(P, '+z', 8.75, 3.75, 20.25, 4, d); frect(P, '+z', 18, 2.5, 19, 3.25, dk); P.half(39, 5, 26, 0x6cff4a, LIT);
    // THE TOWER: the bays' eject buttons, the floppy's slot and its button, power, the two drive lights, a vent; a seam round the top
    frect(P, '+z', 27.5, 8.25, 28.5, 8.5, dk); frect(P, '+z', 27.5, 6.25, 28.5, 6.5, dk);
    frect(P, '+z', 25.5, 4.5, 28.5, 4.75, 0x1e1f24); frect(P, '+z', 27.75, 4, 28.5, 4.25, dk);
    hbox(P, 25.5, 2.5, 14, 26.5, 3.5, 14.5, d); P.half(55, 5, 28, 0x6cff4a, LIT); P.half(57, 5, 28, 0xffb21a, LIT);
    for (let k = 0; k < 3; k++) frect(P, '+z', 25.5, .5 + k * .5, 28.5, .75 + k * .5, dk);
    fline(P, '+x', 1.25, 10.5, 12.75, 10.5, d);
    // the modem's lights along its front
    for (let k = 0; k < 6; k++) frect(P, '+z', 24.5 + k * .875, 11.25, 24.75 + k * .875, 11.5, k === 1 || k === 4 ? 0xff4a3a : 0x6cff4a);
    // THE SPEAKERS: a dark grille of dots, a small knob
    for (const x of [4, 21]) { frect(P, '+z', x + .5, 2, x + 2.5, 5, (qa, qb) => (qa + qb) % 2 ? dk : 0x3a3a40); hbox(P, x + 1, .5, 11, x + 2, 1.5, 11.5, dk); }
    // THE KEYBOARD (14 × 3 on top: 56 × 12 texels, the back row first): the function row, three rows of letters, the long space bar,
    // the number pad to the right; light caps on the darker frame
    const cap = 0xf6eedc;
    P.rect('+y', 28, 48, 84, 60, (qa, qb) => {
      const i = qa - 28, j = qb - 48;
      if (i < 1 || i > 54 || j < 1 || j > 10 || j % 2 === 0 || i === 42 || i === 43) return d;
      if (j === 9 && i < 42) return i >= 12 && i < 33 ? cap : (i - 1) % 4 < 3 ? cap : d;
      if (j === 1 && i < 42) return (i - 1) % 3 < 2 && i !== 4 && i !== 16 && i !== 28 ? cap : d;
      return (i - 1 + (j >> 1)) % 3 < 2 ? cap : d;
    });
    // THE MOUSE on its pad: two buttons and the seam between them (the far end), the pad round it (fine voxels), the cord to the tower
    fline(P, '+y', 22.5, 12, 22.5, 12.75, d); frect(P, '+y', 22, 12.75, 23, 13, d);
    for (const [x0, z0, x1, z1] of [[21.5, 11.5, 22, 14.5], [23, 11.5, 23.5, 14.5], [22, 11.5, 23, 12], [22, 14, 23, 14.5]]) hbox(P, x0, 0, z0, x1, .5, z1, 0x23306e);
    hbox(P, 22, 0, 11, 22.5, .5, 11.5, dk); hbox(P, 22.5, 0, 11, 24, .5, 11.5, dk);
  } });

// ── THE DISC BURNER: three drives stacked, the middle one's tray out with a blank on it; a spindle of blanks beside them
export const discBurner = def({ id: 'disc-burner', name: 'Disc burner', cat: 'electronics', place: 'surface', foot: [3, 2], h: 0.45,
  tiers: ['trailer', 'apartment', 'house'], tags: ['discs', 'bootleg', 'hustle'], variants: 2, vnames: ['black drives', 'beige drives'],
  game: flex('common', 6, 'store'),
  build(V, { variant = 0 } = {}) {
    const c = pick([0x2a2a31, 0xe4d8b8], variant), f = variant ? shade(c, .86) : 0x3a3a44;
    for (let k = 0; k < 3; k++) { const y = k * 2; V.box(0, y, 0, 9, y + 2, 6, c); V.box(0, y, 6, 9, y + 2, 7, f); }
    V.box(1, 2, 7, 8, 3, 10, shade(c, .8));
    cyl(V, 12, 5, 2.4, 0, 1, K.ink); cyl(V, 12, 5, 2.2, 1, 7, 0xd8dde4, 1); cyl(V, 12, 5, .6, 7, 9, K.ink);
  },
  // fine pass: each drive's tray seam, eject button and lights (fine voxels, lit: one burning red, one done green), the blank's rainbow
  // sheen and its hub, the spindle's discs edge on, the label lines on the bezels
  fine(P, { variant = 0, V }) {
    const dk = variant ? 0x9a8e70 : 0x15151a;
    for (let k = 0; k < 3; k++) { const y = k * 2; frect(P, '+z', .75, y + 1.25, 6.5, y + 1.5, dk); frect(P, '+z', 7.25, y + .5, 8.25, y + .75, dk); frect(P, '+z', .75, y + .5, 3, y + .625, variant ? K.ink : 0x8a8a96); }
    for (const [y, c] of [[1, K.lime], [3, K.red], [5, K.lime]]) P.half(16, y * 2 + 1, 14, c, LIT);
    fdisc(P, '+y', 4.5, 8.5, 1.5, (d, th) => d < .3 ? K.ink : d < .55 ? 0xb8c0c8 : pick([0xbfe9ff, 0xffc8ec, 0xfff3b0, 0xd8dde4, 0xc8ffd8], Math.floor((th + Math.PI) / (Math.PI * 2) * 10)));
    fcolour(P, V, 0xd8dde4, ['+z', '+x', '-x', '-z'], (x, y, z, f, i, j) => j % 2 ? 0x9aa2ac : null);
    fdisc(P, '+y', 12, 5, 2.2, d => d > .7 && d < 1 ? 0x9aa2ac : null);
  } });

// ── THE COOK STATION: the cook rig's bigger brother, from the older game's cook table: a flask on a heating mantle running through a
// condenser into a receiver that glows, a controller with its readout and a gauge, a rack of lit test tubes, beakers, a gas mask; under
// the bench a gas bottle, a blue drum and jugs; tape on the bench and a white crust where something boiled over. No labels, no process.
export const cookStation = def({ id: 'cook-station', name: 'Cook station', cat: 'kitchen', place: 'floor', foot: [8, 3], h: 1.6, tops: [0.7],
  tiers: ['trailer', 'apartment', 'house'], tags: ['cook', 'rig', 'gear', 'lab'], variants: 2, vnames: ['steel bench', 'plywood bench'], far: true,
  game: g('gear', 'epic', 'craft', { cook: 'rig' }),
  build(V, { variant = 0 } = {}) {
    const top = variant ? K.ply : K.steelL, l = variant ? 0 : 2;
    for (const x of [1, 37]) for (const z of [1, 12]) V.box(x, 0, z, x + 2, 14, z + 2, K.steelD, 2);
    V.box(0, 13, 0, 40, 14, 15, top, l); V.box(1, 3, 1, 39, 4, 14, K.steelD, 2);
    // under the bench: a blue drum, the gas bottle, two jugs
    cyl(V, 7, 7.5, 3.4, 4, 12, 0x1f5fb0, 1); cyl(V, 7, 7.5, 3.4, 11, 12, 0x184a8a, 1);
    cyl(V, 16, 8.5, 2.2, 4, 10, K.red, 1); cyl(V, 16, 8.5, 1.4, 10, 11, K.red, 1); cyl(V, 16, 8.5, .8, 11, 12, K.gold, 2);
    for (const x of [22, 28]) { V.box(x, 4, 3, x + 4, 10, 8, K.white, 1); V.box(x + 1, 10, 4, x + 3, 11, 6, K.orange); }
    // the mantle, the round flask on it, its neck; the clamp stand
    cyl(V, 6, 7.5, 3, 14, 16, K.orange, 1); cyl(V, 6, 7.5, 2.7, 16, 20, K.glass, 1); cyl(V, 6, 7.5, .9, 20, 25, K.glass, 1);
    V.box(11, 14, 2, 12, 29, 3, K.steelD, 2); V.box(6, 26, 2, 12, 27, 3, K.steelD, 2); V.box(9, 14, 1, 14, 15, 4, K.steelD, 2);
    // the condenser: a glass tube down from the flask's neck to the receiver (its water jacket's rings: the fine pass)
    for (let t = 0; t <= 1; t += .02) { const x = 7 + t * 12, y = 24 - t * 6; V.box(Math.round(x), Math.round(y), 7, Math.round(x) + 1, Math.round(y) + 2, 9, K.glass, 1); }
    // the receiver: a cone flask
    for (let y = 14; y < 20; y++) cyl(V, 20, 8, 2.6 - (y - 14) * .32, y, y + 1, K.glass, 1); cyl(V, 20, 8, .8, 20, 22, K.glass, 1);
    // the controller and its gauge, at the front left
    V.box(1, 14, 10, 5, 18, 14, 0x1f1f24); V.box(1.5, 16, 14, 4.5, 17.5, 15, 0x2a2410, LIT);
    V.box(6, 14, 11, 9, 17, 13, K.steelL, 2); V.box(6.5, 14.5, 13, 8.5, 16.5, 14, K.white);
    // the test-tube rack and its tubes
    V.box(24, 14, 3, 32, 15, 6, K.woodL); V.box(24, 17, 3, 32, 18, 6, K.woodL); for (const x of [24, 31]) V.box(x, 14, 3, x + 1, 18, 6, K.woodL);
    for (let k = 0; k < 5; k++) V.box(25 + k * 1.2, 15, 4, 26 + k * 1.2, 20, 5, K.glass, 1);
    // two beakers, a gas mask laid on the bench
    cyl(V, 30, 10.5, 1.7, 14, 18, K.glass, 1); cyl(V, 35, 6, 1.5, 14, 17, K.glass, 1);
    V.box(33, 14, 9, 39, 16, 14, 0x26262c); cyl(V, 34, 12, 1, 16, 17, 0x26262c); cyl(V, 38, 12, 1, 16, 17, 0x26262c); cylZ(V, 36, 15, 1.2, 14, 15, K.lime, 1);
  },
  // fine pass: the fills seen through the glass (pink in the flask, amber in the receiver, a colour a tube, amber and cyan beakers: lit
  // where the glass is), the condenser's water jacket rings and its hoses (fine voxels), the controller's readout and the gauge's
  // needle, tape across the bench and a white crust where it boiled over, the mask's eye lenses
  fine(P, { V }) {
    const level = (x0, y0, z0, x1, y1, z1, lvl, c) => { for (const f of ['+z', '+y']) fsurf(P, V, f, x0, y0, z0, x1, y1, z1, (x, y, z, i, j) => {
      if (f === '+y') return y + 1 <= lvl ? c : null; return y + j / 4 < lvl ? (y + (j + 1) / 4 >= lvl ? shade(c, 1.3) : c) : null; }); };
    level(3, 16, 4, 9, 20, 11, 18.4, K.pink); level(17, 14, 5, 23, 20, 11, 16.5, K.amber);
    level(28, 14, 8, 32, 18, 13, 16.2, K.amber); level(33, 14, 4, 37, 17, 8, 15.6, K.cyan);
    [K.pink, K.lime, K.cyan, K.amber, K.pink].forEach((c, k) => level(25 + Math.round(k * 1.2), 15, 4, 26 + Math.round(k * 1.2), 20, 5, 17.5 + (k % 2), c));
    fcolour(P, V, K.glass, ['+z'], (x, y, z, f, i, j) => x > 8 && x < 18 && (x === 10 || x === 15) ? 0x2a6fd8 : null, [8, 17, 0, 19, 26, 15]);
    ftxt(P, '+z', '85', 2, 17.5, K.yellow);
    fdisc(P, '+z', 7.5, 15.5, 1, (d, th) => Math.abs(th - .7) < .2 && d < .85 ? K.red : d > .8 ? K.ink : null);
    for (const [x, z] of [[2, 3], [26, 11]]) frect(P, '+y', x, z, x + 3, z + .75, 0xc8c0a8);
    fdisc(P, '+y', 14, 9, 1.4, (d, th) => d < 1.1 + .3 * Math.sin(th * 5) ? 0xf4f2ea : null);
    for (const x of [34, 38]) fdisc(P, '+y', x, 12, .8, d => d < .5 ? 0x3a5a7a : null);
  } });

// ── THE LOCK-UP: a roll-door storage unit off the road, a small set you can stand on a lot: corrugated walls, the roll door with its
// padlocked latch, the unit's number, a concrete apron; open, the door rolled up and the stock inside
export const lockup = def({ id: 'lockup', name: 'Lock-up', cat: 'storage', place: 'floor', foot: [8, 8], h: 2.3, states: ['closed', 'open'],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['storage', 'stash', 'lot'], variants: 2, vnames: ['orange door', 'blue door'], far: true,
  game: g('gear', 'epic', 'store', { stashTake: -.4 }),
  build(V, { variant = 0, state = 'closed' } = {}) {
    const door = pick([0xe2701e, 0x2f6fb8], variant), wall = 0xb8bcc4, open = state === 'open';
    V.box(0, 0, 32, 40, 1, 40, 0x9a968c);
    V.box(0, 0, 0, 40, 44, 34, (x, y, z) => (x === 0 || x === 39) ? ((z >> 1) & 1 ? shade(wall, .86) : wall) : z === 33 || z === 0 ? (((x >> 1) & 1) ? shade(wall, .86) : wall) : wall);
    V.box(0, 44, 0, 40, 46, 35, 0x8a8e96);
    if (!open) { V.box(3, 1, 33, 37, 40, 34, (x, y) => y % 2 ? door : shade(door, .82)); V.box(3, 40, 33, 37, 43, 35, shade(door, .7)); V.box(17, 2, 34, 23, 4, 35, K.steelD, 2); }
    else { V.box(3, 1, 2, 37, 40, 34, -1); V.box(3, 1, 2, 37, 2, 34, 0x8a867c); V.box(3, 38, 33, 37, 43, 36, shade(door, .7));
      for (const [x, z, w, h, c] of [[5, 4, 8, 8, K.buff], [5, 4, 8, 16, K.buff], [14, 4, 7, 6, K.buff], [24, 6, 10, 5, 0x26262c], [30, 18, 6, 4, K.cash]]) V.box(x, 2, z, x + w, 2 + h, z + 8, c);
      V.box(14, 2, 14, 22, 9, 22, 0x3a4a2a); }
  },
  // fine pass: closed, the padlock on the latch and its shackle (fine voxels), the door's pull handle, the unit's number over the door,
  // oil stains and cracks on the apron; open, the boxes' tape and the cash's paper edges
  fine(P, { variant = 0, state = 'closed', V }) {
    ftxt(P, '+z', 'B12', 18, 45.5, K.white);
    frect(P, '+y', 8, 36, 12, 37, 0x7a766c); fline(P, '+y', 24, 34, 31, 38, 0x6a665c); fdisc(P, '+y', 28, 36.5, 1.2, d => d < 1.2 ? 0x5a5650 : null);
    if (state === 'open') { fcolour(P, V, K.buff, ['+y', '+z'], (x, y, z, f, i, j) => (f === '+y' ? (z % 8 === 4 && j < 2) : (x % 8 === 0 && i < 2)) ? 0xd8c8a0 : null); fcolour(P, V, K.cash, ['+y', '+z'], billTex); return; }
    hbox(P, 19.5, 2.5, 35, 20.5, 3.5, 35.5, K.gold, 2); hbox(P, 19.5, 3.5, 35, 20, 4.5, 35.5, K.chrome, 2); hbox(P, 20, 4, 35, 20.5, 4.5, 35.5, K.chrome, 2);
    frect(P, '+z', 9, 2.25, 13, 2.75, K.ink);
  } });

// ── a STAB VEST on a hanger on the wall: the panels, the side straps, a radio pocket, a blank patch
export const stabVest = def({ id: 'stab-vest', name: 'Stab vest', cat: 'security', place: 'wall', foot: [3, 4], h: 0.2, mount: 1.0,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['vest', 'armour', 'muscle'], variants: 2, vnames: ['black', 'navy'],
  game: g('gear', 'rare', 'store', null),
  build(V, { variant = 0 } = {}) {
    const c = pick([0x26262c, 0x23306e], variant);
    V.box(7, 18, 0, 8, 20, 1, K.chrome, 2); V.box(3, 17, 1, 12, 18, 2, K.steelD, 2);
    for (let y = 2; y < 17; y++) for (let x = 2; x < 13; x++) { const arm = y > 11 && (x < 4 || x > 10), neck = y > 13 && x > 5 && x < 9; if (!arm && !neck) V.box(x, y, 1, x + 1, y + 1, 3, c); }
    V.box(2, 4, 3, 4, 8, 4, 0x6a6e78); V.box(11, 4, 3, 13, 8, 4, 0x6a6e78); V.box(8, 7, 3, 11, 11, 4, shade(c, 1.25));
  },
  // fine pass: the panel's quilted stitching, the straps' velcro texture, the pocket's flap, a blank reflective patch across the chest
  fine(P, { variant = 0, V }) {
    const c = pick([0x26262c, 0x23306e], variant), st = shade(c, 1.6);
    fsurf(P, V, '+z', 2, 2, 1, 13, 17, 3, (x, y, z, i, j) => { const qa = x * 4 + i, qb = y * 4 + j; return (qa + qb) % 8 === 0 || (qa - qb + 200) % 8 === 0 ? st : null; });
    for (const x of [2, 11]) frect(P, '+z', x, 4, x + 2, 8, (qa, qb) => (qa + qb) % 2 ? 0x55585f : null);
    frect(P, '+z', 8, 10, 11, 10.25, K.ink); frect(P, '+z', 4.5, 12.5, 7.5, 13.25, 0xd8dce4);
  } });

// ── a POLICE SCANNER on a desk: the black box, its lit frequency, the keys, the speaker slots, a rubber antenna
export const policeScanner = def({ id: 'police-scanner', name: 'Police scanner', cat: 'electronics', place: 'surface', foot: [2, 1], h: 0.3,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['radio', 'scanner', 'heat'], variants: 1, vnames: ['black'],
  game: g('gear', 'rare', 'store', { heatDecay: 1.1 }),
  build(V) {
    V.box(0, 0, 0, 8, 3, 4, 0x26262c); V.box(1, 1, 3, 5, 3, 4, 0x1a2a1a, LIT); V.box(7, 3, 1, 8, 6, 2, K.ink);
  },
  // fine pass: the frequency on its screen, the scan light (lit red), the keypad's keys, the speaker's slots, the antenna's tip
  fine(P) {
    ftxt(P, '+z', '460.25', 1.125, 2.75, K.lime);
    frect(P, '+z', 5.5, 2, 7.5, 2.75, (qa, qb) => qa % 2 && qb % 2 ? 0x9aa0aa : null); P.half(13, 2, 8, K.red, LIT);
    for (let k = 0; k < 4; k++) frect(P, '+y', .75 + k * .75, .5, 1.25 + k * .75, 3, K.ink);
    frect(P, '+y', 7, 1, 8, 2, 0xffb21a);
  } });

// ── the LOAN BOOK: a worn brown ledger, a red rubber band round it with a pencil under it, the corner dog-eared
export const loanBook = def({ id: 'loan-book', name: 'Loan book', cat: 'collectibles', place: 'surface', foot: [2, 2], h: 0.15,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['ledger', 'loans', 'paper'], variants: 1, vnames: ['worn brown'],
  game: flex('common', 4, 'store'),
  build(V) { V.box(1, 0, 1, 9, 2, 9, 0xf0e4c8); V.box(1, 1, 1, 9, 2, 9, 0x7a4a24); V.box(1, 0, 1, 2, 2, 9, 0x5a3418); },
  // fine pass: the band across both ways, the pencil under it (fine voxels), the pages' edges, a scuffed spot and a taped spine, a
  // written-on label
  fine(P) {
    frect(P, '+y', 1, 4.5, 9, 4.875, K.red); frect(P, '+z', 1, 1.5, 9, 1.875, K.red); frect(P, '+z', 2, .25, 9, .75, 0xc8b898);
    hbox(P, 3, 2, 5.5, 8, 2.5, 6, K.yellow); P.half(16, 4, 11, 0xff8aa0); P.half(5, 4, 11, 0x3a3a3a);
    frect(P, '+y', 3, 2, 7, 3.5, 0xe8dcc0); for (const z of [2.5, 3]) frect(P, '+y', 3.25, z, 6.5, z + .125, 0x3a3a8a);
    fdisc(P, '+y', 7.5, 7.5, .8, d => d < .8 ? 0x8a5a34 : null); frect(P, '+y', 1, 1, 2, 9, 0xc8c0b0);
  } });

// ── the PROTECTION BOOK: a black spiral notebook, coloured tabs for every shop on the block, a gold pen clipped on, WEEKLY on its cover
export const protectionBook = def({ id: 'protection-book', name: 'Protection book', cat: 'collectibles', place: 'surface', foot: [2, 1], h: 0.15,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['ledger', 'protection', 'paper'], variants: 1, vnames: ['black spiral'],
  game: flex('rare', 8, 'store'),
  build(V) { V.box(0, 0, 1, 8, 1, 5, K.white); V.box(0, 1, 1, 8, 2, 5, 0x1a1a1f); },
  // fine pass: the spiral's rings along the top (fine voxels), the tabs out of the right side, WEEKLY in white, the gold pen
  fine(P) {
    for (let x = 0; x < 16; x += 2) P.half(x + 1, 3, 1, K.chrome, 2);
    [[0, K.red], [1, K.yellow], [2, K.green], [3, K.sky]].forEach(([k, c]) => P.half(16, 1, 2 + k * 2, c, 1));
    ftxt(P, '+y', 'WEEKLY', .75, 1.25, K.white);
    hbox(P, 1, 2, 3.5, 7, 2.5, 4, K.gold, 2);
  } });

// ── the LAWYER'S CARD in a card file: a rotary file, its cards fanned, one card stood up out of the rest with the lawyer's name on it
export const cardFile = def({ id: 'card-file', name: "Lawyer's card file", cat: 'collectibles', place: 'surface', foot: [2, 2], h: 0.25,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['cards', 'lawyer', 'paper'], variants: 1, vnames: ['oak box'],
  game: flex('rare', 6, 'store'),
  build(V) {
    V.box(1, 0, 1, 9, 3, 9, K.oak); V.box(2, 1, 2, 8, 3, 8, -1); V.box(2, 1, 2, 8, 2, 8, K.woodD);
    for (let z = 2; z < 8; z++) V.box(2, 2, z, 8, 4, z + 1, z === 4 ? K.red : z === 6 ? K.sky : (z & 1) ? K.cream : 0xece2c8);
    V.box(3, 2, 7, 7, 5, 8, K.white);
  },
  // fine pass: the lawyer's card stood up at the front (ESQ and a number on its face), the cards' tops, the dividers' tabs, the box's grain
  fine(P) {
    ftxt(P, '+z', 'ESQ', 3.5, 4.75, K.ink); frect(P, '+z', 3.25, 3.25, 6.75, 3.5, 0x3a3a8a);
    for (let z = 2; z < 7; z++) frect(P, '+y', 2, z + .75, 8, z + 1, 0xb8ae98);
    frect(P, '+z', 1, 1.25, 9, 1.5, K.woodD); frect(P, '+z', 4, .5, 6, 1, K.chrome);
  } });

// ── the BOX CUTTER: at the fine grain (lib.js SMALL), lying on its side: a yellow handle with black rubber grips and a rounded end, the
// slider standing up off its top edge, and the snap-off blade out of its nose, its point slanting back to the cutting edge
export const boxCutter = def({ id: 'box-cutter', name: 'Box cutter', cat: 'security', place: 'surface', foot: [2, 1], h: 0.1, grain: 0.025, view: 'top',
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['blade', 'tool', 'weapon'], variants: 1, vnames: ['yellow'],
  game: flex('common', 2, 'store'),
  build(V) {
    const rows = [
      '..........ss........',
      '..........ss........',
      '.HHHHHHHHHHHHHN.....',
      'HHHHHHHHHHHHHHNbbb..',
      'HHHHHHHHHHHHHHNbbbbb',
      '.HHHHHHHHHHHHHN.....',
    ];
    const key = { s: [K.ink, 0, 0, 3], H: [K.yellow, 1, 0, 3], N: [0x2a2b30, 0, 0, 3], b: [0xd4d6d8, 1, 1, 2] };
    rows.forEach((r, k) => { const z = k + 2; for (let x = 0; x < r.length; x++) { const q = key[r[x]]; if (q) V.box(x, q[2], z, x + 1, q[3], z + 1, q[0], q[1]); } });
  },
  // fine pass: the black rubber grips down the handle, the slider's ridges, the blade's snap lines (slanting, as its point) and the edge's
  // bright line, the screw at the back
  fine(P) {
    frect(P, '+y', 2, 5, 11, 6.5, (qa, qb) => (qa + qb) % 3 === 0 ? 0x3a3a40 : K.ink);
    for (let k = 0; k < 4; k++) frect(P, '+y', 10.125 + k * .5, 2, 10.375 + k * .5, 4, 0x55575e);
    for (const x of [15.5, 16.75]) fline(P, '+y', x, 6.75, x + 1, 5, 0x8a909a);
    frect(P, '+y', 15, 6.75, 20, 7, K.white);
    fdisc(P, '+y', 1.5, 5.5, .4, 0x8a8e96);
  } });

// ── a JACKET LINING with an inside pocket (second pass: the shape redrawn): a jacket on a wooden hanger, its shoulders sloping off the
// hanger, a collar, two sleeves hanging with ribbed cuffs, a ribbed hem. One front is fastened; the other is folded back on itself, so
// its bright quilted lining faces the room, and on the lining the inside pocket, a roll of notes and a passport sticking up out of it
export const jacketLining = def({ id: 'jacket-lining', name: 'Jacket with an inside pocket', cat: 'security', place: 'wall', foot: [3, 4], h: 0.25, mount: 1.0,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['jacket', 'pocket', 'hidden'], variants: 2, vnames: ['black leather', 'olive'],
  game: g('gear', 'rare', 'craft', { stashTake: -.15 }),
  build(V, { variant = 0 } = {}) {
    const c = pick([0x34343a, 0x5a6a3a], variant), cd = shade(c, .72), lin = pick([0x8c52ff, 0xe83b5b], variant), lind = shade(lin, .6);
    // the hook and the hanger, its arms sloping with the shoulders
    V.box(7, 17, 1, 8, 20, 2, K.chrome, 2); V.set(6, 19, 1, K.chrome, 2);
    for (let x = 1; x < 14; x++) { const d = Math.abs(x + .5 - 7.5), y = d < 2 ? 16 : d < 4.5 ? 15 : 14; V.set(x, y, 1, K.woodL); }
    // the back of the jacket (its inside, the lining's darker shade where the fronts part) and its shoulders under the hanger
    for (let x = 1; x < 14; x++) { const d = Math.abs(x + .5 - 7.5), top = d < 2 ? 16 : d < 4.5 ? 15 : 14; V.box(x, 3, 0, x + 1, top, 1, c); V.box(x, 3, 1, x + 1, top, 2, x >= 6 && x < 9 ? lind : c); }
    // the collar, standing up round the hanger's neck
    V.box(5, 15, 1, 10, 17, 3, c); V.box(6, 15, 1, 9, 16, 2, lind);
    // the sleeves, hanging at the sides a little forward, ribbed cuffs
    for (const x0 of [0, 13]) { V.box(x0, 4, 1, x0 + 2, 14, 4, c); V.box(x0, 3, 1, x0 + 2, 4, 4, cd); }
    // the fastened front (the viewer's right) and its collar's lapel
    V.box(8, 3, 2, 13, 15, 3, c); V.box(8, 2, 1, 13, 3, 3, cd); V.box(8, 13, 3, 10, 15, 4, c);
    // the folded-back front (the viewer's left): its outer cloth a fold at the side, its lining facing the room, quilted, the pocket on it
    V.box(2, 3, 2, 7, 15, 3, lin); V.box(2, 3, 2, 3, 15, 4, c); V.box(2, 2, 1, 7, 3, 3, cd); V.box(5, 13, 3, 7, 15, 4, c);
    V.box(3, 8, 3, 7, 11, 4, lind);                                                               // the inside pocket, a patch in a darker shade
    V.box(4, 10, 4, 5, 13, 5, K.cash); V.set(4, 11, 4, K.red);                                    // a roll of notes, its rubber band
    V.box(5, 10, 4, 6, 12, 5, 0x7a1020);                                                          // a passport
  },
  // fine pass: the lining's quilting, the pocket's stitched welt, the roll's note edges, the passport's gold crest, the zip down the
  // fastened front, the ribs of the cuffs and the hem, the collar's seam
  fine(P, { variant = 0, V }) {
    const lin = pick([0x8c52ff, 0xe83b5b], variant), c = pick([0x34343a, 0x5a6a3a], variant);
    fcolour(P, V, lin, ['+z'], (x, y, z, f, i, j) => (x * 4 + i + y * 4 + j) % 6 === 0 || (x * 4 + i - y * 4 - j + 120) % 6 === 0 ? shade(lin, .78) : null);
    frect(P, '+z', 3, 10.75, 7, 11, K.gold); fline(P, '+z', 3, 8, 7, 8, shade(lin, 1.25));
    fcolour(P, V, K.cash, ['+z', '+y', '+x'], (x, y, z, f, i, j) => f === '+y' ? ((i + j) % 3 === 0 ? 0xd8f0c8 : null) : (i % 2 ? 0xd8f0c8 : null));
    frect(P, '+z', 5.25, 10.75, 5.75, 11.25, K.gold);
    frect(P, '+z', 8, 3, 8.25, 15, (qa, qb) => qb % 2 ? K.chrome : null);
    fcolour(P, V, shade(c, .72), ['+z'], (x, y, z, f, i, j) => i % 2 ? shade(c, .55) : null);
    frect(P, '+z', 5, 16.75, 10, 17, shade(c, .6));
  } });

export const HUSTLE = [pcDesk, discBurner, cookStation, lockup, stabVest, policeScanner, loanBook, protectionBook, cardFile, boxCutter, jacketLining];
