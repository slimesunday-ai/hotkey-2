// OFFICER DANA PELL · a woman, 40s, medium build; walks Glasswall Plaza.
import { shade, lerpHex, two, shell, sleeves, collarWings, FRONT, hair, hairShell, hairline, at, solid, rowsOf, ring, bx, grip, lips, skin, twoTone } from '../kit.js';

const AUBURN = 0x8e4526, COAT = 0x24304a, SHIRT = 0x9db5d6, TIE = 0x14192a, CAP = 0x1c2540, BAND = 0x111317, PALE = 0xc9ced6;

export default {
  key: 'pell', name: 'Officer Dana Pell', aka: ['Officer Pell', 'Pell', 'Dana Pell'], place: 'plaza', scale: 1.0,
  who: 'A woman, 40s, medium build. Walks the plaza.',
  signature: AUBURN,
  palette: { raincoat: COAT, shirt: SHIRT, cap: CAP, hair: AUBURN },
  line: 'Auburn hair in a low bun under a police cap of her own, a long navy raincoat over the uniform, her notebook open.',
  changed: "From above, the sheet's cap was the same navy square as the police cap players can buy: hers now wears a clear rain cover, pale and glossy, to go with the raincoat (which has a wet sheen); the bun sits low so the auburn shows.",
  pieces: {
    skin: skin('Pell · fair, freckled', 0xe8c6a8, AUBURN, { lash: 0x2a1a14 }),
    eyes: { name: 'Pell · alert', rows: ['kk...', '.WPP.', '.WPP.', '.....'], brow: ['.....', 'BBBB.', '.....'], palette: { k: [0x2a1a14, 0, 8] },
      fx(F, ctx) { for (const [x, y] of [[-6, 22], [-4, 22], [3, 22], [5, 22]]) F.set(x, y, 7, lerpHex(ctx.sk.c(x, y, 7), 0xa0603a, .18), ctx.sk.layer); } },
    mouth: { name: 'Pell · a straight mouth', draw(H) { lips(H, 0xb26a60, { k: .84 }); } },
    // auburn, pulled back into a low bun at the nape
    hair: { name: 'Pell · auburn, low bun', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 28 : 26, at(22)), 1), two(AUBURN, .86));
      A.ball(-.5, 22.6, -9.2, 3, 2.4, 2, two(AUBURN, .8)); A.commit(); } },
    // a police cap of her own, in the rain: a navy crown under a clear rain cover (pale and glossy from above), a black band, a black
    // peak, a pale badge on the front
    hat: { name: 'Pell · police cap, rain cover', draw(H) {
      const COVER = lerpHex(CAP, 0xe4eaf0, .62), EDGE = lerpHex(CAP, 0xe4eaf0, .4);
      solid(H, { ...rowsOf(30, 31, [-9, 8, -8, 8, 2]) }, BAND);
      solid(H, { 32: [-9, 8, -8, 8, 2], 33: [-9, 8, -8, 9, 2] }, CAP);
      solid(H, { 34: [-10, 9, -9, 10, 3], 35: [-10, 9, -9, 10, 3], 36: [-9, 8, -8, 9, 3] }, (x, y, z) => y === 36 ? COVER : EDGE, 1);
      solid(H, { 30: [-7, 6, 9, 12, 2] }, BAND, 1); },
      fine(P) { P.halfBox(-2, 64, 18, 0, 66, 19, PALE); } },
    // the pale-blue uniform shirt and tie under a long navy raincoat, open; the badge; the radio on the right shoulder
    top: { name: 'Pell · uniform under a navy raincoat', flank: 2, neckline: 'collar', draw(B, ctx) {
      shell(B, (x, y, z) => z >= FRONT && x >= -2 && x <= 1 ? ((x === -1 || x === 0) && y >= 11 ? TIE : SHIRT) : COAT, { fl: 2, neck: false, l: 0 });
      for (let x = -7; x <= 6; x++) for (let y = 9; y <= 18; y++) for (let z = -3; z <= 3; z++) { const c = B.get(x, y, z); if (c === COAT) B.set(x, y, z, COAT, 1); }
      collarWings(B, COAT, FRONT, { open: true }, ); bx(B, -6, -5, 16, 17, 4, 4, 0x15161a);
      sleeves(ctx, (lx, ly) => ly === 1 ? shade(COAT, .8) : COAT, { y0: 10, out: 1, fl: 2, l: 1 }); },
      fine(P) { P.halfBox(2, 29, 8, 4, 32, 9, PALE); P.halfBox(-12, 36, 8, -11, 38, 9, 0x15161a); } },
    bottom: { name: 'Pell · the raincoat, uniform trousers', form: 'straight', color: COAT, paint: q => q.y >= 5 ? [q.u === -1 ? shade(COAT, .8) : COAT, 1] : 0x1a2036 },
    shoes: { name: 'Pell · black duty shoes', last: 'lowline', paint: twoTone(0x141416, 0x0e0e10, 1) },
    held: { name: 'Pell · her notebook, open', pose: 'raised', draw(G, ctx) { const K = 0x15161a, W = 0xf2f0ea;
      grip(G, ctx, K); bx(G, 5, 8, 6, 8, 2, 2, K); bx(G, 5, 8, 6, 8, 3, 3, (x, y) => y === 7 ? 0xbfc4cc : W); },
      fine(P) { for (const y of [6, 7, 8]) P.rect('+z', 5 * 4 + 1, y * 4 + 1, 9 * 4 - 1, y * 4 + 2, 0x8a93a3); } },
  },
};
