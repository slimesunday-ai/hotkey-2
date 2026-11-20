// MRS. BAO · a woman, 50s, small and brisk; a stall at the Jay St night market.
import { shade, lerpHex, rnd, two, shell, sleeves, FRONT, hair, hairShell, hairline, at, ring, solid, bx, crows, allFx, lips, skin, twoTone } from '../kit.js';

const JADE = 0x3ca082, NAVY = 0x283152, RED = 0xcc3434, BLACK = 0x1f1b1a, STREAK = 0xb8b4ae, POUCH = 0x1f1f22;

export default {
  key: 'bao', name: 'Mrs. Bao', aka: ['Bao'], place: 'market', scale: 0.92,
  who: 'A woman, 50s, small and brisk. A stall at the market.',
  signature: JADE,
  palette: { vest: JADE, longsleeve: NAVY, visor: RED, slacks: 0x24242a },
  line: 'A red visor over a black bob with one grey streak at the front; a jade quilted vest, a red lanyard down to a black cash pouch.',
  changed: 'The vest is a brighter jade (the sheet\'s darker one sat beside Big Moss\'s green); the cash pouch hangs at her front on its red lanyard; a lashed eye and a muted lip; drawn 0.92 times.',
  pieces: {
    skin: skin('Bao · warm', 0xe4c3a0, 0x1e1a18, { lash: 0x1e1a18 }),
    eyes: { name: 'Bao · narrowed, lashed', rows: ['k....', '.LLL.', '.WPP.', '.....'], brow: ['.BBB.', 'B....', '.....'], palette: { k: [0x1e1a18, 0, 8] }, fx: allFx(crows(.82)) },
    mouth: { name: 'Bao · a muted lip', draw(H) { lips(H, 0xa05a58, { k: .82 }); } },
    // a black bob to the jaw, one grey streak at the front on the left of her parting
    hair: { name: 'Bao · black bob, grey streak', coversEars: true, draw(H) { const A = hair(H, { ears: true });
      A.grow(hairShell(hairline(at(31), pz => pz >= 4 ? 28 : 21, at(21)), (px, py, pz, ox, oy, oz) => oy > 0 || ox !== 0 ? 2 : 1), two(BLACK, .8, .25));
      A.recolor((x, y, z) => x >= -7 && x <= -4 && (z >= 3 || y >= 34) ? STREAK : undefined); A.commit(); } },
    // a red visor: a band round the hair and a long bill, no crown (the bob shows through it from above)
    hat: { name: 'Bao · red visor', cover: 'none', draw(H) {
      for (const y of [30, 31]) ring(H, y, [-10, 9, -9, 8, 2], [-10, 9, -9, 8], RED);
      solid(H, { 30: [-8, 7, 9, 13, 2] }, shade(RED, .88)); } },
    // a jade quilted vest (two proud, quilted in rows) over a navy long sleeve; a red lanyard to a black cash pouch at her front
    top: { name: 'Bao · jade quilted vest, cash pouch', flank: 1, neckline: 'crew', puffy: true, draw(B, ctx) {
      shell(B, (x, y, z) => (y % 2 === 0 ? shade(JADE, .86) : JADE), { d: 4 });
      sleeves(ctx, (lx, ly) => ly === 1 ? shade(NAVY, .8) : NAVY, { y0: 10 });
      for (const [x, y] of [[-3, 18], [-3, 17], [-3, 16], [2, 18], [2, 17], [2, 16], [-2, 15], [1, 15]]) B.set(x, y, 5, RED);
      bx(B, -2, 1, 12, 14, 5, 5, POUCH); for (let x = -2; x <= 1; x++) B.set(x, 14, 5, 0x3a3a3e); },
      fine(P) { P.rect('+z', -2 * 4 + 1, 13 * 4 + 1, 2 * 4 - 1, 13 * 4 + 2, 0x5a5a60); } },
    bottom: { name: 'Bao · black slacks', form: 'slim', color: 0x24242a },
    shoes: { name: 'Bao · black canvas, white sole', last: 'lowline', paint: twoTone(0x232326, 0xe8e4dc) },
  },
};
