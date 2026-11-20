// MR. AMBROSE · a man, 60s, thin and very tidy; a money man on Glasswall Plaza.
import { shade, lerpHex, shell, sleeves, collarWings, FRONT, hair, hairShell, hairline, at, hbox, grip, crows, allFx, mouthLine, skin, twoTone } from '../kit.js';

const NAVY = 0x1b2446, WHITE = 0xf4f2ee, SILVER = 0xc9ced6, TIE = 0xb6bbc4, MANILA = 0xc9a86a;

export default {
  key: 'ambrose', name: 'Mr. Ambrose', aka: ['Ambrose'], place: 'plaza', scale: 1.0,
  who: 'A man, 60s, thin and very tidy. A money man.',
  signature: SILVER,
  palette: { suit: NAVY, shirt: WHITE, tie: TIE, envelope: MANILA },
  line: 'Silver hair swept straight back, a navy three-piece with a white pocket square in points, a fat manila envelope.',
  changed: "A fine chalk stripe on the suit and the pocket square's points in the finer blocks; the silver hair is a cooler, brighter silver than the other white heads.",
  pieces: {
    skin: skin('Ambrose · tanned', 0xd9b08f, 0xb9bec6),
    eyes: { name: 'Ambrose · cool, heavy lids', rows: ['.....', '.LLL.', '.WPP.', '.....'], brow: ['.....', '.BBBB', '.....'], fx: allFx(crows(.8)) },
    mouth: { name: 'Ambrose · a thin smile', draw(H, ctx) { mouthLine(H, ctx, 20, -2, 1); H.set(2, 21, 7, lerpHex(ctx.sk.c(2, 21, 7), ctx.sk.mouth, .5)); } },
    // silver, swept straight back from a high forehead, combed lines running back
    hair: { name: 'Ambrose · silver, swept back', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(32), pz => pz >= 2 ? 27 : 25, at(22)), (px, py, pz, ox, oy, oz) => oy > 0 ? (pz < 2 ? 2 : 1) : oz < 0 ? 2 : 1), (x, y, z) => (x + 16) % 3 === 0 ? shade(SILVER, .86) : SILVER, 1); A.commit(); } },
    // a navy three-piece: jacket, the waistcoat's V, a white shirt and collar, a silver tie, a pocket square in points
    top: { name: 'Ambrose · navy three-piece', neckline: 'collar', draw(B, ctx) {
      shell(B, (x, y, z) => { if (z >= FRONT) { if ((x === -1 || x === 0) && y >= 12) return TIE; if (Math.abs(x + .5) <= (y - 9) / 2.6 && y >= 12) return WHITE; if (y >= 10 && y <= 12 && Math.abs(x + .5) < 3) return shade(NAVY, .82); } return NAVY; }, { neck: false });
      collarWings(B, WHITE, FRONT); for (const [x, y] of [[3, 16], [4, 16]]) B.set(x, y, 4, WHITE);
      sleeves(ctx, (lx, ly) => ly === 1 ? WHITE : NAVY, { y0: 10 }); },
      // the pocket square's points, and a fine chalk stripe down the jacket
      fine(P) { P.halfBox(6, 34, 8, 10, 35, 9, WHITE); P.half(6, 35, 8, WHITE); P.half(8, 35, 8, WHITE);
        for (const x of [-5, -3, 3]) P.rect('+z', x * 4 + 2, 9 * 4, x * 4 + 3, 15 * 4, 0x39436a); } },
    bottom: { name: 'Ambrose · navy trousers, pressed', form: 'slim', color: NAVY, paint: q => q.u === 1 && q.z === q.z1 ? 0x253058 : undefined },
    shoes: { name: 'Ambrose · black gloss shoes', last: 'lowline', paint: twoTone(0x141416, 0x0e0e10, 1) },
    // a fat manila envelope, a red string tie, held through the fist
    held: { name: 'Ambrose · a fat manila envelope', pose: 'forward', draw(G, ctx) {
      grip(G, ctx, MANILA); G.set(6, 7, 2, MANILA); G.set(6, 7, -3, MANILA); hbox(G, ctx, 7, 8, 5, 8, -3, 4, (x, y, z) => z === 1 && x === 8 ? 0xa83a32 : MANILA); } },
  },
};
