// BIG MOSS · a man, 40s, very big; leads the Sixes, who hold the corner.
import { shade, lerpHex, rnd, two, shell, sleeves, FRONT, ring, grip, mouthLine, skin } from '../kit.js';

const GREEN = 0x2f8a4a, LEATHER = 0x201c1c, SHEAR = 0xe6dcc6, CARGO = 0x1e1f22, BRASS = 0x8f7a4c, SKIN = 0x6a432e, STRAP = 0x161212;

export default {
  key: 'moss', name: 'Big Moss', aka: ['Moss'], place: 'corner', scale: 1.2,
  who: 'A man, 40s, very big. Leads the Sixes.',
  signature: GREEN,
  palette: { leather: LEATHER, shearling: SHEAR, cargo: CARGO, sixes: GREEN },
  line: 'The Sixes\' green as a band round his bare head, its ends knotted behind; a scar through the brow, a chin-strap beard, a black leather coat with a cream shearling collar; brass knuckles.',
  changed: 'Drawn 1.2 times (Big Lou stays the biggest at 1.25). The scar now breaks the brow itself; the beard runs up the jaw to the ears; the coat hangs open on a green lining; the boots are laced in the green.',
  pieces: {
    skin: skin('Moss · deep brown', SKIN, 0x141010),
    // hard eyes under a heavy brow; the scar cuts the right brow (the brow's cells there left bare, the scar paler)
    eyes: { name: 'Moss · hard, a scarred brow', rows: ['.....', 'LLLL.', '.WPP.', '.....'], brow: ['.....', 'BBBBB', 'BBBB.'],
      fx(F, ctx) { const S = lerpHex(ctx.sk.c(-5, 28, 7), 0xc29a8c, .5);
        for (const y of [27, 28]) { F.del(-5, y, 8); F.set(-5, y, 7, S, ctx.sk.layer); } F.set(-4, 26, 7, S, ctx.sk.layer); } },
    mark: { name: 'Moss · the scar, above the brow', draw(H, ctx) { for (const [x, y] of [[-6, 30], [-5, 29], [-6, 31]]) if (H.has(x, y, 7)) H.set(x, y, 7, lerpHex(ctx.sk.c(x, y, 7), 0xc29a8c, .5)); } },
    // a chin-strap beard: a line along the jaw from ear to ear, under the chin one proud; the mouth a hard line
    mouth: { name: 'Moss · chin-strap beard', draw(H, ctx) {
      mouthLine(H, ctx, 20, -2, 1);
      for (let x = -7; x <= 6; x++) H.set(x, 19, 8, two(STRAP, .8)(x, 19, 8));
      for (let x = -8; x <= 7; x++) if (H.has(x, 19, 7)) H.set(x, 19, 7, STRAP);
      // up the jaw to under the ear, two cells wide
      for (const x of [-8, 7]) for (const [y, z0, z1] of [[19, 4, 7], [20, 4, 6], [21, 3, 5], [22, 2, 4], [23, 1, 2]]) for (let z = z0; z <= z1; z++) if (H.has(x, y, z)) H.set(x, y, z, STRAP); } },
    // the Sixes' green tied round the bare head above the brow, the knot behind and its two ends hanging
    hat: { name: 'Moss · the green band', cover: 'none', draw(H) { const f = two(GREEN, .82, .3), D = shade(GREEN, .8);
      for (const y of [30, 31, 32]) ring(H, y, [-9, 8, -8, 8, 2], [-9, 8, -8, 8], f);
      for (let x = -2; x <= 1; x++) for (const y of [30, 31]) H.set(x, y, -9, D);
      for (const x of [-2, 1]) { for (let y = 27; y <= 30; y++) H.set(x, y, -10, shade(GREEN, .86)); for (const y of [27, 28]) H.set(x, y, -11, shade(GREEN, .9)); } } },
    // a black leather coat hanging open on its green lining, a black tee between; the cream shearling collar and lapels, shearling cuffs
    top: { name: 'Moss · leather, shearling collar', flank: 2, neckline: 'high', puffy: true, draw(B, ctx) {
      shell(B, (x, y, z) => y >= 17 ? two(SHEAR, .9, .35)(x, y, z) : z >= 4 && (x === -2 || x === 1) ? GREEN : z >= 4 && (x === -1 || x === 0) ? 0x141416 : z >= 4 && (x === -3 || x === 2) && y >= 13 ? SHEAR : LEATHER, { fl: 2, d: 4, neck: false });
      sleeves(ctx, (lx, ly) => ly === 1 ? SHEAR : LEATHER, { y0: 10, out: 1, pad: 2, fl: 2 }); },
      fine(P) { for (const y of [11, 13, 15]) for (const x of [-4, 3]) P.rect('+z', x * 4 + 1, y * 4 + 1, x * 4 + 3, y * 4 + 3, 0x3a3434); } },
    bottom: { name: 'Moss · black cargo', form: 'baggy', color: CARGO, waist: 0x121214, paint: q => q.u >= 3 && (q.y === 6 || q.y === 7) && q.z >= 0 ? 0x2a2b2f : undefined },
    shoes: { name: 'Moss · black boots, green laces', last: 'fullcourt', paint: q => q.region === 'sole' ? [0x111113, 0] : q.y === 3 && q.z >= 1 ? [GREEN, 0] : [0x1f1f22, 0] },
    // brass knuckles over the fist (a bar across the front of the fingers, its grip through the fist)
    held: { name: 'Moss · brass knuckles', pose: 'down', draw(G, ctx) {
      grip(G, ctx, shade(BRASS, .8)); for (let x = 5; x <= 7; x++) for (const y of [6, 7, 8]) G.set(x, y, 2, y === 8 ? shade(BRASS, .85) : BRASS); },
      fine(P) { for (const y of [6, 7]) P.rect('+z', 5 * 4, y * 4 + 3, 8 * 4, y * 4 + 4, 0x5e4e30); } },
  },
};
