// Home objects · catalogue v2 · the crime shelf: a gun rack and a wall of pieces, a gold knife in a case, brass knuckles on velvet,
// a money counter, cash stacks, a duffel, scales, a rolling tray, product in baggies, a burner drawer, a counterfeit press.
// Guns are toon odds items (OUTLINE §0.9): chunky invented shapes in candy colours, no real model, part or detail. The product is
// fictional (SUDO, TEMP, HALLU, §1.9): coloured crystals in baggies, no real drug and no real-world process.
import { def, K, pick, cyl, cylZ, line, LIT, shade, mix, rng, hash, txt, M3, frect, fdisc, fline, ftxt, hbox, fsurf, fcolour, billTex, ball, lathe, cylX, txtTop } from './lib.js';
import { flex, g, pistol, rifle, cushion, vitrine, brick } from './bits.js';

const PIECES = [[K.gold, K.ink], [K.chrome, K.pink], [K.lime, K.ink], [K.pink, K.white], [K.ink, K.gold], [K.cyan, K.ink], [K.orange, K.ink], [K.purple, K.gold]];

export const gunRack = def({ id: 'gun-rack', name: 'Gun rack', cat: 'security', place: 'wall', foot: [8, 5], h: 0.25, mount: 1.0,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['guns', 'rack', 'crime'], variants: 3, vnames: ['walnut + chrome', 'black + gold', 'pink + lime'], far: true,
  game: flex('rare', 15),
  grain: 0.025, shaped: 'a gun rack: three long guns in profile (stocks, grips, receivers, barrels, a scope), on pegs',
  build(V, { variant = 0 } = {}) {
    // THIRD PASS · at the half grain, so the guns stand beside the run's own: a board with its frame, three long guns lying on pairs of
    // pegs (a pump gun, a scoped rifle, a carbine with its magazine), each in profile: the stock and its grip, the receiver and trigger
    // guard, the barrel, the fore-end; a shelf below with two boxes of rounds
    const [board, peg] = pick([[K.walnut, K.chrome], [0x1f1f24, K.gold], [K.pink, K.lime]], variant);
    const P = pick([[[K.chrome, K.walnut], [K.gold, K.ink], [K.ink, K.woodD]], [[K.gold, K.ink], [K.gold, K.oxblood], [K.chrome, K.ink]], [[K.lime, K.ink], [K.cyan, K.pink], [K.yellow, K.purple]]], variant);
    V.box(0, 0, 0, 80, 50, 2, board); for (const [x0, y0, x1, y1] of [[0, 0, 80, 2], [0, 48, 80, 50], [0, 0, 2, 50], [78, 0, 80, 50]]) V.box(x0, y0, 2, x1, y1, 3, shade(board, .8));   // the board, its frame
    const gun = (y, [m, wd], kind) => { const z0 = 3, z1 = 5;
      for (let x = 6; x < 22; x++) { const t = (x - 6) / 16, top = y + 1.5 - t * .5, bot = y - 3 + t * 2.4; for (let yy = Math.floor(bot); yy < top; yy++) V.box(x, yy, z0, x + 1, yy + 1, z1, x < 8 ? shade(wd, .7) : wd); }   // the stock, its butt pad
      V.box(20, y - 3.5, z0, 23, y, z1, shade(wd, .85));                                                                // the grip
      V.box(22, y - 1, z0, 34, y + 2, z1, m, 2);                                                                        // the receiver
      for (let x = 23; x < 29; x++) for (let yy = y - 3; yy < y - 1; yy++) if (x === 23 || x === 28 || yy === y - 3) V.box(x, yy, z0 + .5, x + 1, yy + 1, z1 - .5, m, 2);   // the trigger guard
      V.box(25, y - 2, z0 + .5, 26, y - 1, z1 - .5, K.ink);                                                            // the trigger
      const end = kind === 1 ? 74 : 70; V.box(34, y, z0, end, y + 1, z1, shade(m, .82), 2); V.box(end - 1, y + 1, z0 + .5, end, y + 1.5, z1 - .5, m, 2);   // the barrel, its sight
      if (kind === 0) { V.box(34, y - 1, z0, 60, y, z1, shade(m, .7), 2); V.box(38, y - 2, z0 - .5, 48, y + .5, z1 + .5, wd); for (let x = 39; x < 48; x += 2) V.box(x, y - 2, z1 + .5, x + 1, y + .5, z1 + 1, shade(wd, .8)); }   // pump: the tube, the slide, its grooves
      if (kind === 1) { V.box(34, y - 1, z0, 54, y, z1, wd); cylX(V, y + 4, (z0 + z1) / 2, 1.1, 23, 37, K.ink, 1); cylX(V, y + 4, (z0 + z1) / 2, 1.6, 23, 26, K.ink, 1); cylX(V, y + 4, (z0 + z1) / 2, 1.6, 34, 37, K.ink, 1);   // rifle: the fore-end, the scope and its bells
        V.box(26, y + 2, z0, 27, y + 3, z1, K.ink); V.box(33, y + 2, z0, 34, y + 3, z1, K.ink); V.box(30, y + 1, z1, 32, y + 2, z1 + 1.5, m, 2); }   // its rings, the bolt
      if (kind === 2) { V.box(34, y - 1, z0, 50, y + .5, z1, wd); for (let k = 0; k < 5; k++) V.box(28 + k * .6, y - 2 - k, z0, 31.5 + k * .6, y - 1 - k, z1, K.ink); }   // carbine: the fore-end, the curved magazine
      for (const px of [14, 54]) { V.box(px, y - 4.5, 2, px + 2, y - 3.5, 7, peg, 2); V.box(px, y - 3.5, 6, px + 2, y - 1, 7, peg, 2); } };   // the two pegs
    gun(39, P[0], 0); gun(27, P[1], 1); gun(15, P[2], 2);
    V.box(6, 3, 2, 74, 4, 9, peg, 2);                                                                                   // the shelf
    for (const [x, c] of [[10, K.ink], [20, 0x4a5a2a]]) { V.box(x, 4, 3, x + 7, 8, 8, c); V.box(x, 6, 8 - .5, x + 7, 7, 8, K.yellow); }   // boxes of rounds
  } });

export const pieceWall = def({ id: 'piece-wall', name: 'Wall of pieces', cat: 'security', place: 'wall', foot: [10, 8], h: 0.15, mount: 0.5,
  tiers: ['house', 'penthouse'], tags: ['guns', 'pegboard', 'flex'], variants: 3, vnames: ['black pegboard', 'white gallery', 'safety orange'], far: true,
  game: flex('epic', 35),
  build(V, { variant = 0, seed = 1 } = {}) {
    const bd = pick([0x1f1f24, K.white, K.orange], variant), sil = shade(bd, variant === 1 ? .88 : 1.35), r = rng(seed * 31 + 5);
    V.box(0, 0, 0, 50, 40, 1, (x, y) => (x % 3 === 1 && y % 3 === 1) ? shade(bd, .6) : bd);                                                // the pegboard, its holes
    const put = (fn, x, y, w, h) => { V.box(x - 1, y - 1, 0, x + w + 1, y + h + 1, 1, sil); for (let k = 0; k < 2; k++) V.set(x + 2 + k * (w - 5), y + h, 1, K.steelL, 2); fn(); };   // the painted outline behind every piece, two hooks
    let k = 0; for (const y of [30, 20]) { const c = PIECES[(k++ + seed) % PIECES.length]; put(() => rifle(V, 4, y, 1, c[0], c[1], 1, y === 20), 4, y - 3, 30, 10);
      const c2 = PIECES[(k++ + seed) % PIECES.length]; put(() => pistol(V, 38, y, 1, c2[0], c2[1], 1), 38, y, 10, 7); }
    for (let i = 0; i < 4; i++) { const c = PIECES[(i * 3 + seed + ((r() * 2) | 0)) % PIECES.length]; put(() => pistol(V, 3 + i * 12, 6, 1, c[0], c[1], 1, i & 1), 3 + i * 12, 6, 10, 7); }
    V.box(15, 36, 1, 35, 39, 2, 0x2a3350, 1); txt(V, M3('HEAT'), 19, 38, 2, K.red, LIT);                                                    // a little neon over it
  } });

export const knifeCase = def({ id: 'knife-case', name: 'Gold knife in a case', cat: 'collectibles', place: 'surface', foot: [3, 2], h: 0.4,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['knife', 'gold', 'vitrine'], variants: 3, vnames: ['gold + pearl', 'gold + ruby', 'iced'],
  game: flex('grail', 45, 'drop'),
  grain: 0.025, shaped: 'a gold knife: its blade, guard and handle, lying on velvet in a clear case',
  build(V, { variant = 0 } = {}) {
    // THIRD PASS · a walnut base with oxblood velvet, and on it a dagger: a long bright blade with its edge and spine, a gold guard,
    // a gold handle with its inlay (pearl, ruby, ice), the pommel. The case's lid is clear (bits.js vitrine)
    const [bl, hd] = pick([[K.gold, K.white], [K.gold, K.red], [K.chrome, K.cyan]], variant);
    V.box(0, 0, 0, 30, 4, 20, K.walnut); V.box(2, 4, 2, 28, 5, 18, K.oxblood); V.box(9, 1, 19, 21, 3, 20, K.gold, 2);   // base, velvet, the plate
    const cz = 10;
    for (let x = 3; x < 8; x++) V.box(x, 5, cz - 1, x + 1, 7, cz + 1, x % 2 ? K.gold : shade(K.gold, .85), 2);          // the handle, wrapped
    for (const x of [4, 6]) V.set(x, 7, cz, hd, 1);                                                                       // its inlay
    ball(V, 2.5, 6, cz, 1.5, 1.4, 1.5, K.gold, 2);                                                                        // the pommel
    V.box(8, 5, cz - 4, 10, 7, cz + 4, K.gold, 2); V.set(9, 7, cz, hd, 1);                                              // the guard
    for (let x = 10; x < 27; x++) { const w = x < 21 ? 1.6 : 1.6 * (27 - x) / 6; for (let z = Math.floor(cz - w); z < cz + w; z++) {
      const edge = z + .5 < cz - w + .9 || z + .5 > cz + w - .9; V.set(x, 5, z, edge ? shade(bl, 1.15) : bl, 2); if (!edge && x < 25) V.set(x, 6, z, shade(bl, .92), 2); } }   // the blade, its edge, the spine
    vitrine(V, 0, 0, 30, 20, 4, 16);
  } });

export const knucklesVelvet = def({ id: 'knuckles-velvet', name: 'Knuckles on velvet', cat: 'collectibles', place: 'surface', foot: [2, 2], h: 0.3,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['knuckles', 'brass', 'jewellery box'], variants: 3, vnames: ['brass', 'rose gold', 'iced'],
  game: flex('rare', 12),
  grain: 0.0125,
  build(V, { variant = 0 } = {}) {
    // THIRD PASS · at a quarter of the block: an open jewellery box (black, purple velvet, the lid up behind), and on the velvet a
    // set of knuckles lying flat: four round finger rings in a row, joined, and the curved grip under them
    const m = pick([K.gold, 0xe8a0a0, K.chrome], variant), md = shade(m, .78), ice = variant === 2;
    V.box(0, 0, 6, 40, 6, 40, K.ink); V.box(2, 2, 8, 38, 7, 38, K.purple); V.box(2, 6, 8, 38, 7, 38, (x, y, z) => ((x + z) % 7 === 0 ? shade(K.purple, .85) : K.purple));   // the box, its velvet
    V.box(0, 0, 0, 40, 22, 6, K.ink); V.box(2, 2, 4, 38, 20, 6, shade(K.purple, .9));                                  // the lid, standing open
    const rings = [[9, 20], [16.5, 20], [24, 20], [31.5, 20]];
    for (let x = 3; x < 38; x++) for (let z = 12; z < 34; z++) for (let y = 7; y < 10; y++) {
      let c = null;
      for (const [rx, rz] of rings) { const d = Math.hypot(x + .5 - rx, z + .5 - rz); if (d >= 2.1 && d <= 3.8) c = d > 3.3 ? md : m; }   // four rings
      const gz = 28.5 + Math.pow((x + .5 - 20.25) / 14, 2) * 2.5, gd = Math.abs(z + .5 - gz);
      if (gd < 2.2 && x > 5 && x < 36) c = gd > 1.5 ? md : m;                                                          // the grip, bowed
      if (z > 22 && z + .5 < gz && x > 6 && x < 35 && (x + .5 - 6) % 7.5 < 1.6) c = m;                                // the struts between
      if (c !== null && (y < 9 || !(c === md))) V.set(x, y, z, ice && hash(x, y, z) > .8 ? K.white : c, ice && hash(x, y, z) > .8 ? 1 : 2);
    }
    if (ice) for (const [rx, rz] of rings) V.set(rx, 10, rz - 3.4, K.cyan, 1);
  } });

export const moneyCounter = def({ id: 'money-counter', name: 'Money counter', cat: 'collectibles', place: 'surface', foot: [2, 2], h: 0.45,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['cash', 'counter', 'dealer'], variants: 2, vnames: ['black', 'white'],
  game: flex('common', 6),
  grain: 0.025, shaped: 'a money counter: the box, a hopper of notes on top, the tray in front, the lit display',
  build(V, { variant = 0 } = {}) {
    // THIRD PASS · a counter as they are: a low box on feet, its display panel facing you (the count lit, fine), a hopper on top with
    // notes stacked in it, and a tray out front catching the counted notes; a row of buttons
    const b = pick([0x26262c, K.white], variant), d = shade(b, .8);
    for (const [x, z] of [[3, 5], [16, 5], [3, 16], [16, 16]]) V.box(x, 0, z, x + 1, 1, z + 1, K.ink);                 // feet
    V.box(2, 1, 4, 18, 9, 18, b); V.box(2, 9, 4, 18, 14, 12, b); V.box(2, 8, 17, 18, 9, 18, d);                         // the body, the upper housing
    V.box(4, 9, 12, 16, 10, 17, d); for (let k = 0; k < 4; k++) V.box(5 + k * 3, 10, 14, 7 + k * 3, 10.5, 16, [K.red, K.green, K.white, K.white][k], 1);   // the ledge, its buttons
    V.box(4, 11, 11, 16, 14, 12, K.ink);                                                                               // the display
    V.box(3, 14, 5, 17, 15, 11, d); V.box(3, 15, 5, 4, 18, 11, d); V.box(16, 15, 5, 17, 18, 11, d); V.box(3, 15, 5, 17, 18, 6, d);   // the hopper
    V.box(5, 15, 7, 15, 17, 10, K.cash); V.box(9, 15, 7, 10, 17, 10, K.white);                                         // notes in it
    V.box(4, 2, 18, 16, 3, 20, d); V.box(4, 3, 19, 16, 4, 20, d); V.box(5, 3, 18, 15, 4, 19, K.cash);                  // the tray out front, notes in it
  },
  fine(P) {
    frect(P, '+z', 4.25, 11.25, 15.75, 13.75, 0x16261a); ftxt(P, '+z', '9700', 6, 13.25, K.lime);                         // the count, lit
    frect(P, '+z', 4.75, 11.75, 5.25, 12.75, K.lime);                                                                          // the $ light
  } });

export const cashStack = def({ id: 'cash-stack', name: 'Cash stack', cat: 'collectibles', place: 'floor', foot: [3, 3], h: 0.65,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['cash', 'stack', 'flex'], variants: 2, vnames: ['pallet', 'with gold bars'], far: true,
  game: flex('epic', 30, 'loot'),
  build(V, { variant = 0 } = {}) {
    V.box(0, 0, 0, 15, 1, 15, K.oak); for (const z of [0, 7, 14]) V.box(0, 1, z, 15, 2, z + 1, K.oak); V.box(0, 2, 0, 15, 3, 15, K.ply);   // the pallet
    for (let y = 0; y < 5; y++) { const i = y, x0 = 1 + i, x1 = 14 - i; for (let x = x0; x + 4 <= x1; x += 4) for (let z = 1 + i; z + 3 <= 14 - i; z += 3) brick(V, x, 3 + y * 2, z, 4, 3, 2); }
    if (variant) for (const [x, z] of [[2, 12], [10, 12]]) { V.box(x, 3, z, x + 3, 5, z + 2, K.gold, 2); V.box(x, 5, z, x + 3, 6, z + 1, shade(K.gold, 1.1), 2); }
  },
  // fine pass: the notes' paper edges down the faces you see, the top note's face on the top tier, the pallet's plank seams
  fine(P, { V }) {
    fcolour(P, V, K.cash, ['+z', '+x'], billTex, [0, 3, 6, 15, 13, 15]);
    fcolour(P, V, K.cash, ['+y'], billTex, [0, 9, 0, 15, 13, 15]);
    fsurf(P, V, '+z', 0, 0, 14, 15, 3, 15, (x, y, z, i, j) => y === 2 && i === 0 && x % 3 === 0 ? shade(K.ply, .7) : null);
  } });

// the DUFFEL OF CASH (second pass: the shape redrawn, a soft bag, not a box): a long bag slumped on the floor, wider at its base than at
// its top and sagging in the middle where it lies open, round end panels in a darker cloth, the zip run open along the top with its two
// toothed lips folded back and its pull hanging off the end, banded bundles inside, some standing up out of the mouth, and the two carry
// handles flopped down over its front
const ZIP = 0x2a2b30;
export const duffelCash = def({ id: 'duffel-cash', name: 'Duffel of cash', cat: 'collectibles', place: 'floor', foot: [4, 2], h: 0.35,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['cash', 'duffel', 'heist'], variants: 3, vnames: ['black', 'red', 'camo'],
  game: flex('rare', 20, 'loot'),
  build(V, { variant = 0 } = {}) {
    const cloth = (x, y, z) => variant === 2 ? pick([0x4a5a2a, 0x6b7a3a, 0x3a2a1a, 0x8a8a5a], ((hash(x >> 1, (y + z) >> 1, 3) * 4) | 0)) : pick([0x34343a, 0xc8262c], variant);
    const end = variant === 2 ? 0x3a2a1a : pick([0x1e1e22, 0x8a1a1e], variant), strap = variant === 1 ? 0x1e1e22 : 0x2a2b30;
    // the bag: a cross-section wider at the floor, its height falling from the ends to the open middle; the ends rounded off
    for (let x = 0; x < 20; x++) { const t = (x + .5 - 10) / 9.6, e = 1 - t ** 6; if (e <= 0) continue;
      const H = (4.6 + 1.2 * Math.abs(t) ** 1.5) * Math.sqrt(e), W = 4.3 * Math.sqrt(e);
      for (let y = 0; y < 7; y++) for (let z = 0; z < 10; z++) { const v = (y + .5) / H; if (v > 1) continue; const w = W * (1.08 - .3 * v * v) * Math.sqrt(1 - v ** 4);
        if (Math.abs(z + .5 - 4.5) <= w) V.set(x, y, z, Math.abs(t) > .86 ? end : cloth(x, y, z)); } }
    // the open zip: the mouth along the top, its two lips folded back and standing a little proud
    for (let x = 4; x < 16; x++) { let top = 0; while (V.has(x, top, 4)) top++;
      for (let y = top - 2; y < top; y++) for (let z = 3; z < 7; z++) V.del(x, y, z);
      for (const z of [2, 7]) V.set(x, top - 1, z, ZIP, 1); }
    // inside: bundles lying in the bottom of the mouth, and four standing up out of it
    for (let x = 4; x < 16; x += 3) { let y = 0; while (V.has(x, y, 4) && y < 6) y++; V.box(x, y, 3, x + 3, y + 1, 6, K.cash); V.box(x + 1, y, 3, x + 2, y + 1, 6, K.white); }
    for (const [x, z, h] of [[5, 3, 3], [8, 4, 4], [11, 3, 3], [13, 5, 3]]) { let y = 0; while (V.has(x, y, z) && y < 6) y++; y = Math.max(y, 2);
      V.box(x, y, z, x + 2, Math.min(7, y + h), z + 1, K.cash); }
    // the handles flopped down the front: two loops of strap lying on the cloth, one cell proud
    for (const x0 of [4, 12]) { for (let x = x0; x < x0 + 4; x++) V.set(x, 2, 9, strap); for (const x of [x0, x0 + 3]) for (let y = 3; y < 5; y++) V.set(x, y, 9, strap); }
    V.box(17, 3, 8, 18, 5, 9, K.gold, 1);   // the zip's pull, hanging off the end
  },
  // fine pass: the zip's teeth along both lips, the notes' faces and paper edges, the seam where each end panel meets the bag, the
  // handles' stitching
  fine(P, { variant = 0, V }) {
    fcolour(P, V, ZIP, ['+y'], (x, y, z, f, i, j) => (z === 2 ? j >= 2 : j <= 1) ? (i % 2 ? K.gold : shade(K.gold, .6)) : null);
    fcolour(P, V, K.cash, ['+y', '+z', '+x'], (x, y, z, f, i, j) => f !== '+y' && y >= 3 && (y * 4 + j) % 8 >= 3 && (y * 4 + j) % 8 < 5 ? K.white : billTex(x, y, z, f, i, j));
    const end = variant === 2 ? 0x3a2a1a : pick([0x1e1e22, 0x8a1a1e], variant);
    fcolour(P, V, end, ['+z', '+y'], (x, y, z, f, i, j) => (x === 1 && i === 3) || (x === 18 && i === 0) ? K.cream : null);
    fcolour(P, V, variant === 1 ? 0x1e1e22 : 0x2a2b30, ['+z'], (x, y, z, f, i, j) => (y === 2 ? j === 2 : i === 2) && (i + j) % 2 ? 0x8a8a90 : null);
  } });

export const scaleDigital = def({ id: 'scale-digital', name: 'Digital scale', cat: 'collectibles', place: 'surface', foot: [2, 2], h: 0.15,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['scale', 'dealer', 'product'], variants: 3, vnames: ['black', 'pink', 'gold'],
  game: flex('common', 3),
  grain: 0.0125, view: 'top',
  build(V, { variant = 0 } = {}) {
    // THIRD PASS · at a quarter of the block, seen from above: the pocket scale (its lid open behind), the steel plate with its bevel,
    // the display lit 28.0, two buttons; on the plate a zip bag with the product in it, a real lump
    const b = pick([0x26262c, K.pink, K.gold], variant), l = variant === 2 ? 2 : 1;
    V.box(4, 0, 6, 36, 3, 37, b, l); for (const [x, z] of [[4, 6], [35, 6], [4, 36], [35, 36]]) V.box(x, 0, z, x + 1, 3, z + 1, -1);   // the body
    V.box(4, 3, 4, 36, 11, 6, 0x30333b, 1);                                                                            // the lid, open behind
    V.box(8, 3, 9, 32, 4, 27, shade(K.steelL, .85), 2); V.box(9, 3, 10, 31, 4.5, 26, K.steelL, 2);                     // the plate, its bevel
    V.box(10, 3, 29, 26, 3.5, 35, 0x16261a); txtTop(V, M3('28.0'), 11, 30, 3, K.lime, LIT);                            // the display
    for (const x of [28.5, 32.5]) cyl(V, x, 32, 1.4, 3, 4, K.ink, 1);                                                  // ON, TARE
    const BAG = 0xd8eef8; V.box(12, 5, 12, 28, 6, 24, BAG, 1); V.box(12, 5, 12, 28, 7, 13, K.red);                      // the bag, its zip
    ball(V, 20, 6, 18.5, 5.5, 2, 4.5, (x, y, z) => (y >= 6 ? (hash(x, y, z) > .85 ? 0xd8f4ff : K.white) : null), 1);    // the product in it
  } });

export const rollingTray = def({ id: 'rolling-tray', name: 'Rolling tray', cat: 'collectibles', place: 'surface', foot: [3, 2], h: 0.2,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['papers', 'tray', 'stoner'], variants: 3, vnames: ['flame', 'checker', 'gold'],
  game: flex('common', 4),
  grain: 0.025, shaped: 'a rolling tray: the papers, a grinder, a lighter and a rolled one, each small and clear', view: 'top',
  build(V, { variant = 0 } = {}) {
    // THIRD PASS · a metal tray with a rolled rim and its print (flames, a checker, gold), and on it, each its own shape: a booklet of
    // papers with one sheet out, a two-part grinder, a lighter, a rolled one with its twist and its tip, a few crumbs
    const art = (x, z) => variant === 0 ? (z > 13 - Math.abs(Math.sin(x * .55)) * 7 - (x % 5) ? (z > 16 - Math.abs(Math.sin(x * .55)) * 3 ? K.yellow : K.orange) : K.ink) : variant === 1 ? ((((x >> 1) + (z >> 1)) & 1) ? K.pink : K.white) : K.gold;
    V.box(1, 0, 1, 29, 1, 19, (x, y, z) => art(x, z), variant === 2 ? 2 : 1);
    for (const [x0, z0, x1, z1] of [[1, 0, 29, 1], [1, 19, 29, 20], [0, 1, 1, 19], [29, 1, 30, 19]]) V.box(x0, 0, z0, x1, 2, z1, K.ink, 1);   // the rim
    V.box(3, 1, 3, 10, 2, 8, K.cobalt); V.box(3, 1, 4, 10, 2, 5, K.orange); V.box(4, 2, 4, 9, 3, 7, K.white);       // the papers, a sheet out
    lathe(V, 22, 6, 1, 3, () => 2.6, (x, y, z, d, th) => (Math.cos(th * 8) > .3 ? K.steelL : K.chrome), 2); lathe(V, 22, 6, 3, 4, () => 2.6, K.lime, 1);   // the grinder, its lid
    V.box(23, 1, 12, 26, 2, 18, K.red, 1); V.box(23, 1, 12, 26, 2, 13, K.steelL, 2);                                 // the lighter
    for (let x = 6; x < 18; x++) { const rr = .55 + (x - 6) * .045; for (let z = 12; z < 16; z++) for (let y = 1; y < 3; y++) if (Math.hypot(y + .5 - 1.5, z + .5 - 13.5) <= rr + .45) V.set(x, y, z, x < 8 ? K.buff : K.white); }   // the rolled one
    V.set(18, 1, 13, K.white); V.set(18, 1, 14, K.white);                                                               // its twist
    for (const [x, z] of [[17, 7], [18, 9], [15, 6]]) V.set(x, 1, z, 0x3a8a3a);                                         // crumbs
  } });

export const baggies = def({ id: 'baggies-product', name: 'Product in baggies', cat: 'collectibles', place: 'surface', foot: [2, 2], h: 0.15,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['product', 'baggies', 'dealer'], variants: 3, vnames: ['SUDO lime', 'TEMP pink', 'HALLU cyan'],
  game: flex('common', 5, 'craft'),
  grain: 0.0125, view: 'top',
  build(V, { variant = 0, seed = 1 } = {}) {
    // THIRD PASS · at a quarter of the block, seen from above: a white enamel tray and six little zip bags in two rows, each a clear
    // bag with its red zip, the product a lump inside; one on top, the stamp on it
    const c = pick([K.lime, K.pink, K.cyan], variant), r = rng(seed * 7 + 3), BAG = 0xd8eef8;
    V.box(2, 0, 3, 38, 1, 37, K.white, 1); for (const [x0, z0, x1, z1] of [[2, 3, 38, 5], [2, 35, 38, 37], [2, 3, 4, 37], [36, 3, 38, 37]]) V.box(x0, 1, z0, x1, 3, z1, K.white, 1);   // the tray, its rim
    const bag = (x0, z0, y0) => { V.box(x0, y0, z0, x0 + 9, y0 + 1, z0 + 12, BAG, 1); V.box(x0, y0, z0, x0 + 9, y0 + 2, z0 + 2, K.red);     // the clear bag, its zip
      ball(V, x0 + 4.5 + (r() - .5), y0 + 1, z0 + 7.2, 3.4, 1.6, 3.6, (x, y) => (y >= y0 + 1 ? c : null), 0); };   // the product
    for (let k = 0; k < 6; k++) bag(5 + (k % 3) * 10.5, 6 + (k / 3 | 0) * 14, 1);
    bag(15, 12, 3); V.box(18, 4, 21, 21, 5, 23, K.ink); V.set(19, 5, 22, K.white);                                       // one on top, its stamp
  } });

export const burnerDrawer = def({ id: 'burner-drawer', name: 'Burner drawer', cat: 'storage', place: 'floor', foot: [2, 3], h: 0.55, tops: [0.55],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['burners', 'phones', 'nightstand'], variants: 3, vnames: ['oak', 'black', 'white'],
  game: flex('common', 4),
  grain: 0.025, shaped: 'a drawer of phones: each phone its own shape (a screen, keys, an antenna stub), one flipped open',
  build(V, { variant = 0, seed = 1 } = {}) {
    // THIRD PASS · at the half grain: a small cabinet, the top drawer pulled out on its runners, and in it nine burners lying face
    // up, each a phone (the body, the screen set in it, the keys, an antenna stub), one flipped open and lit; the lower drawer shut
    const c = pick([K.oak, 0x26262c, K.white], variant), r = rng(seed * 13 + 1), knob = K.gold;
    V.box(0, 0, 0, 20, 22, 22, c); V.box(1, 1, 22, 19, 10, 23, shade(c, .92)); V.box(9, 5, 23, 11, 6, 24, knob, 2);     // the cabinet, the lower drawer
    V.box(1, 12, 3, 19, 21, 22, -1);                                                                                     // the top drawer's space
    V.box(2, 12, 4, 18, 13, 29, shade(c, .85)); V.box(2, 13, 4, 3, 18, 29, shade(c, .85)); V.box(17, 13, 4, 18, 18, 29, shade(c, .85)); V.box(2, 13, 4, 18, 18, 5, shade(c, .85));   // its box, out
    V.box(1, 11, 29, 19, 21, 30, c); V.box(9, 15, 30, 11, 17, 30, knob, 2); V.set(10, 16, 29.5, knob, 2);                // its front, the knob
    const COL = [K.ink, K.red, K.cobalt, K.pink, K.lime, K.gun, K.ink, K.white, K.orange];
    for (let k = 0; k < 9; k++) { const x = 3.6 + (k % 3) * 4.6, z = 6 + ((k / 3) | 0) * 7.6, col = COL[(k + ((r() * 9) | 0)) % 9];
      if (k === 4) { V.box(x, 13, z + 3.5, x + 3, 14, z + 7, K.ink); V.box(x, 14, z + 2.5, x + 3, 18, z + 3.5, K.ink); V.box(x + .5, 14.5, z + 2.5, x + 2.5, 17.5, z + 3.5, K.cyan, LIT); continue; }   // flipped open, lit
      V.box(x, 13, z, x + 3, 14, z + 6.5, col); V.box(x + .5, 13, z + .6, x + 2.5, 14, z + 2.6, 0x1b2a33);               // the phone, its screen set in
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) V.set(x + .5 + i * 1.3, 14, z + 3.4 + j * 1, col === K.white ? K.grey : K.pale, 1);   // its keys
      V.set(x + 2.4, 14, z - .4, K.ink); }                                                                               // the antenna stub
  } });

export const counterfeitPress = def({ id: 'counterfeit-press', name: 'Counterfeit press', cat: 'collectibles', place: 'floor', foot: [4, 3], h: 1.1,
  tiers: ['house', 'penthouse'], tags: ['counterfeit', 'printing', 'crime'], variants: 2, vnames: ['racing green', 'fire red'], far: true,
  game: flex('rare', 15, 'craft'),
  build(V, { variant = 0 } = {}) {
    const c = pick([K.forest, K.red], variant);
    for (const x of [1, 17]) for (const z of [1, 12]) V.box(x, 0, z, x + 2, 10, z + 2, K.iron);                                           // legs
    V.box(0, 10, 0, 20, 13, 15, c); V.box(1, 13, 2, 19, 18, 12, c); V.box(0, 13, 12, 20, 14, 15, shade(c, .8));                           // body
    for (let z = 3; z < 12; z++) cylXish(V, 9, z); V.box(1, 18, 5, 19, 19, 9, K.gold, 2);                                                  // the ink roller, brass trim
    cyl(V, 15.5, 7.5, 3, 19, 20, K.chrome);                                                                                              // the crank wheel
    for (let y = 14; y < 16; y++) V.box(3, y, 13, 17, y + 1, 15, y & 1 ? K.cash : 0xffb3d0);                                                // sheets coming out
    for (let x = 4; x < 16; x += 4) { V.box(x, 16, 13, x + 3, 17, 15, K.cash); V.set(x + 1, 16, 14, K.white); }                            // cut bills
    V.box(3, 0, 3, 17, 2, 12, K.ply); for (let y = 2; y < 6; y++) V.box(4, y, 4, 16, y + 1, 11, y & 1 ? K.cash : K.cashD);                 // a stack on the shelf below
  },
  // fine pass: the notes (faces on the cut bills, paper edges down the stack), the pink sheets ruled into bills, the crank wheel's spokes
  // and hub, the roller's shine, rivets on the brass
  fine(P, { V }) {
    fcolour(P, V, K.cash, ['+y'], billTex, [0, 16, 0, 20, 17, 15]);
    for (const c of [K.cash, K.cashD]) fcolour(P, V, c, ['+z'], billTex, [0, 2, 0, 20, 6, 15]);
    fcolour(P, V, 0xffb3d0, ['+z'], (x, y, z, f, i, j) => i === 0 && x % 2 === 0 ? 0xd87aa0 : j === 3 ? 0xd87aa0 : null);
    fdisc(P, '+y', 15.5, 7.5, 3, (d, th) => d < .6 ? K.ink : d > 2.6 ? 0x8a929c : Math.abs(((th / (Math.PI * 2)) * 5 + 5) % 1 - .5) > .42 ? 0x6a727c : null);
    hbox(P, 17.5, 20, 9, 18, 21.5, 9.5, K.ink);
    fcolour(P, V, K.ink, ['+y'], (x, y, z, f, i, j) => j === 1 ? 0x4a4a55 : null, [0, 18, 0, 20, 19, 15]);
    for (const x of [1.25, 18.25]) frect(P, '+y', x, 6.75, x + .5, 7.25, shade(K.gold, .6));
  } });
function cylXish(V, x0, z) { for (let x = x0 - 6; x < x0 + 8; x++) V.set(x, 18, z, K.ink); }

export const CRIME = [gunRack, pieceWall, knifeCase, knucklesVelvet, moneyCounter, cashStack, duffelCash, scaleDigital, rollingTray, baggies, burnerDrawer, counterfeitPress];
