// GLORIA · a woman, 40s, tall, strong arms; cooks out of the kitchen window in the trailer park.
import { shade, hash3, rnd, two, check, shell, sleeves, FRONT, hair, hairShell, hairline, at, solid, rowsOf, bx, grip, lips, skin, twoTone, hbox } from '../kit.js';

const MARIGOLD = 0xe3a12c, KNOT = 0xb83a2a, TEAL = 0x23727a, APRON = 0xeee8da, DENIM = 0x2e3d63;
const stain = (x, y, z) => { const h = hash3(x, y, z) % 17; return h === 0 ? 0xb8573a : h === 1 ? 0xa48a5a : APRON; };
const towel = check(0xc23a34, 0xf1ebe0, 0x8c2420, 1);

export default {
  key: 'gloria', name: 'Gloria', aka: [], place: 'park', scale: 1.04,
  who: 'A woman, 40s, tall, strong arms.',
  signature: MARIGOLD,
  palette: { tee: TEAL, apron: APRON, jeans: DENIM, scarf: MARIGOLD },
  line: 'A marigold headscarf tied in front, a stained white apron, a red-check towel on the shoulder, a tray of tamales.',
  changed: 'The towel lies on her shoulder and chest instead of cutting through the arm, in its own small check (finer blocks); the apron carries on down the front of her jeans. Drawn 1.04 times.',
  pieces: {
    skin: skin('Gloria · deep brown', 0x8e5f40, 0x1b1512, { lash: 0x120c0a }),
    eyes: { name: 'Gloria · bright, a flick', rows: ['k....', '.WPP.', '.WPP.', '.....'], brow: ['.BBB.', 'B...B', '.....'], palette: { k: [0x120c0a, 0, 8] } },
    mouth: { name: 'Gloria · plum lip', draw(H) { lips(H, 0x6e2f36, { k: .82 }); } },
    hair: { name: 'Gloria · black, pulled back', draw(H) { const A = hair(H), C = 0x1d1917;
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 29 : 27, at(22)), 1), C); A.ball(-.5, 25, -9.4, 2.6, 2.4, 2, two(C, .8)); A.commit(); } },
    // the marigold scarf over the crown and the back, the knot in red on top at the front
    hat: { name: 'Gloria · marigold headscarf', coversEars: true, draw(H) {
      const col = (x, y, z) => (hash3(x, y, z) % 9 === 0 ? shade(MARIGOLD, .86) : MARIGOLD);
      solid(H, { ...rowsOf(26, 30, [-9, 8, -8, 4, 1]), ...rowsOf(31, 34, [-9, 8, -8, 8, 2]), 35: [-8, 7, -7, 7, 2], 36: [-6, 5, -5, 5, 2] }, col);
      solid(H, { 36: [-3, 2, 4, 7, 1], 37: [-2, 1, 5, 7, 1], 35: [-3, 2, 8, 9, 1] }, KNOT); } },
    // a teal tee, a long white apron stained at the front (its bib and straps over the tee)
    top: { name: 'Gloria · teal tee, stained apron', neckline: 'crew', draw(B, ctx) {
      shell(B, (x, y, z) => (z >= FRONT && x >= -4 && x <= 3 && y <= 15) || (z >= FRONT && (x === -3 || x === 2) && y >= 16) ? stain(x, y, z) : y === 11 && Math.abs(z) < 3 ? APRON : TEAL);
      sleeves(ctx, (lx, ly) => ly === 4 ? shade(TEAL, .82) : TEAL, { y0: 13 }); } },
    // a red-check dish towel over the left shoulder: on the chest and the back, never on the arm
    acc: { name: 'Gloria · dish towel on the shoulder', draw(B, ctx) { ctx.as('torso');
      for (let y = 13; y <= 18; y++) for (const x of [2, 3, 4]) { const zf = ctx.chestFront(x, y) ?? 3, zb = -zf;
        B.set(x, y, zf + 1, towel(x + 4, y)); if (y >= 15) B.set(x, y, zb - 1, towel(x + 4, y + 1)); }
      for (const x of [2, 3, 4]) for (let z = -3; z <= 3; z++) if (B.has(x, 18, z)) B.set(x, 18, z, towel(x + 4, z + 8)); },
      // the finer blocks: the towel's own check, two texels a square, over its front
      fine(P) { for (let x = 2; x <= 4; x++) for (let y = 13; y <= 17; y++) P.rect('+z', x * 4, y * 4, x * 4 + 4, y * 4 + 4, (a, b) => { const u = (a >> 1) & 1, v = (b >> 1) & 1; return u && v ? 0x8c2420 : u || v ? 0xc23a34 : 0xf1ebe0; }); } },
    // dark jeans; the apron carries on down the front of the thighs
    bottom: { name: 'Gloria · dark jeans, the apron', form: 'straight', color: DENIM, waist: 0x231c18,
      paint: q => q.z === q.z1 && q.y >= 6 ? stain(q.x, q.y, q.z) : undefined },
    shoes: { name: 'Gloria · black kitchen clogs', last: 'terrace', paint: twoTone(0x2a2a2e, 0x1a1a1c) },
    held: { name: 'Gloria · a foil tray of tamales', pose: 'both', draw(G, ctx) { const F = 0xc9ccd0, H = 0xd9c48a;
      grip(G, ctx, F); hbox(G, ctx, -5, 4, 6, 7, -1, 2, F, 1);
      for (let x = -4; x <= 3; x++) for (const z of [0, 1]) G.set(x, 8, z, (x + z) & 1 ? H : shade(H, .86)); } },
  },
};
