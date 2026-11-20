// FRANKIE · a woman, 20s, short and quick; works the lunch crowd with Slim on Glasswall Plaza. Written only on the sheet: "a bleached
// pixie cut, a beige office trench, belted, a blue lanyard with a badge that isn't hers, black flats".
import { shade, lerpHex, rnd, shell, sleeves, collarWings, FRONT, placket, hair, hairShell, hairline, at, lips, skin, twoTone } from '../kit.js';

const BLEACH = 0xeedc98, ROOT = 0x6a5440, TRENCH = 0xc8b48c, TRENCH_D = shade(0xc8b48c, .82), BLUE = 0x1e6edc, CARD = 0xf2f0ea;
const bleach = (x, y, z) => y >= 35 ? lerpHex(BLEACH, 0xfaf0c8, .5) : (x <= -9 || x >= 8 || z <= -8) && y <= 30 ? lerpHex(BLEACH, ROOT, .45) : rnd(x, y, z, 16) < .25 ? lerpHex(BLEACH, 0xd8b860, .5) : BLEACH;

export default {
  key: 'frankie', name: 'Frankie', aka: [], place: 'plaza', scale: 0.9,
  who: 'A woman, 20s, short and quick. Works the lunch crowd with Slim.',
  signature: BLUE,
  palette: { trench: TRENCH, hair: BLEACH, lanyard: BLUE, trousers: 0x1c1c20 },
  line: 'A bleached pixie, spiky, growing out darker at the sides; a belted beige office trench; a blue lanyard with somebody else\'s badge.',
  changed: 'Written only on the sheet, so all of it is new. The bleach is brassy and spiked, growing out darker at the sides, so from above it is not Dutch\'s smooth white-blonde; black trousers under the trench (no bare legs); drawn 0.9 times, the smallest of the thirty-four.',
  pieces: {
    skin: skin('Frankie · fair', 0xe2b898, 0x3a2a20, { lash: 0x241a16 }),
    eyes: { name: 'Frankie · quick, lashed', rows: ['kk...', '.WPP.', '.WPP.', '.....'], brow: ['.....', '.BBB.', 'B....'], palette: { k: [0x241a16, 0, 8] } },
    mouth: { name: 'Frankie · a pink lip', draw(H) { lips(H, 0xc06878, { k: .82 }); } },
    // a bleached pixie: short, spiked on top, the roots dark
    hair: { name: 'Frankie · bleached pixie', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 27 : 25, at(23)), (px, py, pz, ox, oy, oz) => oy > 0 ? 1 + (rnd(px, py, pz, 7) < .45 ? 1 : 0) : 1), bleach); A.commit(); } },
    // a beige office trench, belted, double-breasted, its collar open
    top: { name: 'Frankie · beige trench, belted', flank: 2, neckline: 'collar', draw(B, ctx) {
      shell(B, (x, y, z) => y === 11 ? TRENCH_D : placket(x, z) ? shade(TRENCH, .9) : y === 9 ? TRENCH_D : TRENCH, { fl: 2, neck: false });
      collarWings(B, TRENCH, FRONT, { open: true }); B.set(-1, 11, FRONT + 1, 0x8a7a50, 1);
      sleeves(ctx, (lx, ly) => ly === 2 ? TRENCH_D : TRENCH, { y0: 10, out: 1, fl: 2 }); },
      fine(P) { for (const y of [13, 15]) for (const hx of [-5, 3]) P.halfBox(hx, 2 * y + 1, 8, hx + 2, 2 * y + 2, 9, 0x6a5a3a); } },
    // the blue lanyard round her neck down to a badge on her chest that is not hers
    acc: { name: 'Frankie · a lanyard, someone\'s badge', draw(B, ctx) { ctx.as('torso');
      for (const x of [-3, 2]) for (let z = -2; z <= 2; z++) if (B.has(x, 18, z)) B.set(x, 18, z, BLUE);
      for (const [x, y] of [[-3, 17], [-2, 16], [-2, 15], [2, 17], [1, 16], [1, 15]]) B.set(x, y, (ctx.chestFront(x, y) ?? FRONT) + 1, BLUE);
      for (const x of [-2, -1, 0, 1]) for (const y of [12, 13, 14]) B.set(x, y, (ctx.chestFront(x, y) ?? FRONT) + 1, y === 14 ? BLUE : CARD); },
      fine(P) { P.rect('+z', -2 * 4 + 1, 12 * 4 + 1, -1 * 4 + 2, 13 * 4 + 3, 0x5a4a40); for (const qb of [12 * 4 + 1, 12 * 4 + 3]) P.rect('+z', -1 * 4 + 3, qb, 1 * 4 + 3, qb + 1, 0x9a9ca0); } },
    bottom: { name: 'Frankie · the trench, black trousers', form: 'slim', color: 0x1c1c20, paint: q => q.y >= 6 ? (q.u === -1 ? TRENCH_D : TRENCH) : undefined },
    shoes: { name: 'Frankie · black flats', last: 'lowline', paint: twoTone(0x1a1a1c, 0x101012, 1) },
  },
};
