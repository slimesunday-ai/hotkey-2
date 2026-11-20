// MRS. ALVAREZ · a woman, 70s, short and round; the trailer park. The sheet's house dress to mid-calf is now trousers (the owner,
// 2026-11-18: no skirts or dresses): the flowered top and the man's grey cardigan stay, the lower half is pull-on slacks.
import { shade, lerpHex, hash3, rnd, two, shell, sleeves, FRONT, hair, hairShell, hairline, at, bx, grip, crows, bags, allFx, lips, skin, twoTone } from '../kit.js';

const CARDI = 0x7d8189, WHITE = 0xece9e3, PINK = 0xe08aa8, SKY = 0x9cc6e0;

export default {
  key: 'alvarez', name: 'Mrs. Alvarez', aka: ['Alvarez'], place: 'park', scale: 0.94,
  who: 'A woman, 70s, short and round.',
  signature: PINK,
  palette: { cardigan: CARDI, flowers: SKY, slacks: 0x6c7896, slippers: PINK, hair: WHITE },
  line: 'A white bun on top, and the folding lawn chair she carries everywhere.',
  changed: 'Lost the house dress to mid-calf and the stockings: the flowered top (a small printed flower on every face, in the finer blocks) now ends at the waist under the same grey cardigan, over soft blue-grey pull-on slacks with a pressed crease; the pink slippers stay. Drawn 0.94 times.',
  pieces: {
    skin: skin('Alvarez · warm brown', 0xbf8962, 0xd4d0c8, { lash: 0x2a1c18 }),
    eyes: { name: 'Alvarez · kind, lined', rows: ['.....', '.WPP.', '.WPP.', '.LLL.'], brow: ['.....', '.BBB.', 'B....'], fx: allFx(crows(.78, [23, 25, 26]), bags(.86, { y: 22, xs: [-6, -5] })) },
    mouth: { name: 'Alvarez · rose lipstick, smiling', draw(H) { const L = 0xb04a5c; lips(H, L, { y: 20 }); for (const x of [-3, 2]) H.set(x, 21, 7, shade(L, .9)); } },
    hair: { name: 'Alvarez · white bun on top', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 28 : 26, at(23)), 1), two(WHITE, .9));
      A.ball(-.5, 36.4, -1.5, 3.3, 2.5, 3.3, two(WHITE, .87, .4)); A.commit(); } },
    // the house dress's flowered top under a man's grey cardigan, worn open; buttons down the cardigan's edges
    top: { name: 'Alvarez · flowered top, grey cardigan', flank: 2, neckline: 'vee', draw(B, ctx) {
      shell(B, (x, y, z) => z >= FRONT && x >= -2 && x <= 1 ? SKY : y === 9 ? shade(CARDI, .85) : CARDI, { fl: 2, neck: false,
        skip: (x, y, z) => (y === 18 && x >= -2 && x <= 1 && z >= 1) || (y === 17 && x >= -1 && x <= 0 && z >= 3) });
      sleeves(ctx, (lx, ly) => ly === 1 ? shade(CARDI, .84) : CARDI, { y0: 10, out: 1, fl: 2 }); },
      // the finer blocks: the house dress's print, a small flower on every face of the strip that shows (a centre, petals, a leaf),
      // and the cardigan's buttons down both edges
      fine(P) { const PET = [0xf2d24a, 0xe58aa0, 0xf6f2ea];
        for (let x = -2; x <= 1; x++) for (let y = 10; y <= 16; y++) { const h = hash3(x, y, 5), i = 1 + (h & 1), j = 1 + ((h >> 1) & 1), a = x * 4, b = y * 4, c = PET[h % 3];
          for (const [di, dj] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) P.paint('+z', a + i + di, b + j + dj, c);
          P.paint('+z', a + i, b + j, 0xc8862a); P.paint('+z', a + ((i + 2) & 3), b + ((j + 2) & 3), 0x6f9a5a); }
        for (const y of [10, 12, 14, 16]) for (const qa of [-3 * 4 + 1, 2 * 4 + 1]) P.rect('+z', qa, y * 4 + 1, qa + 2, y * 4 + 3, 0x2e2e30); } },
    // pull-on slacks with a pressed crease (the crease a shade lighter down each shin's front)
    bottom: { name: 'Alvarez · pull-on slacks', form: 'straight', color: 0x6c7896, paint: q => q.z === q.z1 && q.u === 1 ? 0x7d89a6 : undefined },
    shoes: { name: 'Alvarez · pink house slippers', last: 'lowline', paint: q => q.region === 'sole' ? [0xf0e6e0, 0] : q.top && q.z >= 2 ? [0xf2c4d2, 0] : [0xd98fa6, 0] },
    // her folding lawn chair, flat across both arms: an aluminium frame, green and white webbing
    // her folding lawn chair, folded flat and carried across both arms: an aluminium frame round green-and-white webbing (the
    // webbing in stripes, the way the straps run), the armrests' ends standing up at the top corners
    held: { name: 'Alvarez · folding lawn chair', pose: 'both', draw(G, ctx) { const A = 0xc8ccd1, web = x => (((x + 6) >> 1) & 1) ? 0x3f8f5a : 0xf2f0ea;
      grip(G, ctx, A); bx(G, -5, 4, 4, 7, -1, 0, (x, y) => (y === 4 || x === -5 || x === 4) ? A : web(x), 1);
      for (const x of [-5, -4, 3, 4]) G.set(x, 8, -1, A, 1); } },
  },
};
