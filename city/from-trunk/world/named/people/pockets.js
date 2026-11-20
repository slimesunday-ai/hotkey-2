// POCKETS · a man, 30s, wiry; a buyer in the night market's crowd.
import { shade, lerpHex, rnd, two, shell, sleeves, FRONT, placket, hair, hairShell, hairline, at, solid, rowsOf, ring, stubble, skin } from '../kit.js';

const VEST = 0x788246, VEST_D = shade(0x788246, .8), FLAP = 0x8f985c, HAT = 0x8c8a5a, RED = 0x9a3a32, JEANS = 0x6d84a6;

export default {
  key: 'pockets', name: 'Pockets', aka: [], place: 'market', scale: 0.95,
  who: 'A man, 30s, wiry.',
  signature: VEST,
  palette: { vest: VEST, longsleeve: RED, jeans: JEANS, hat: HAT },
  line: 'A canvas fishing hat with bright flies stuck in its band, a fishing vest with every pocket full over a red long sleeve.',
  changed: 'The flies are real flies in the finer blocks (a hook, a bright hackle) round the band; the vest\'s pockets have flaps and bulge; drawn 0.95 times.',
  pieces: {
    skin: skin('Pockets · tan', 0xd6ab84, 0x4a3a2a),
    eyes: { name: 'Pockets · squint, a grin in them', rows: ['.....', '.LLL.', '.WPP.', '.....'], brow: ['.....', 'BBBB.', '.....'] },
    mouth: { name: 'Pockets · a grin', draw(H, ctx) { for (let x = -2; x <= 1; x++) H.set(x, 20, 7, lerpHex(ctx.sk.c(x, 20, 7), ctx.sk.mouth, .55)); for (const x of [-3, 2]) H.set(x, 21, 7, lerpHex(ctx.sk.c(x, 21, 7), ctx.sk.mouth, .55)); } },
    mark: stubble('Pockets · a day\'s stubble', 0x4a3a2a, .18, .35),
    hair: { name: 'Pockets · buzzed', draw(H) { const A = hair(H); A.grow(hairShell(hairline(at(30), pz => pz >= 2 ? 28 : 26, at(23)), 1), 0x5a4a3a); A.commit(); } },
    // a canvas fishing hat: a soft crown, a brim turned down all round, flies hooked into the band
    hat: { name: 'Pockets · fishing hat, flies', draw(H) { const b = shade(HAT, .86);
      solid(H, { ...rowsOf(30, 34, [-9, 8, -8, 8, 2]), 35: [-8, 7, -7, 7, 2] }, (x, y) => y === 31 ? shade(HAT, .9) : HAT);
      ring(H, 30, [-11, 10, -10, 10, 4], [-9, 8, -8, 8], b); ring(H, 29, [-12, 11, -11, 11, 5], [-10, 9, -9, 9], b); },
      fine(P) { const F = [[0xd0402a, 0xf0d050], [0x2a8ac0, 0xf2f0ea], [0xe2b72e, 0x3aa05a], [0x3aa05a, 0xd0402a], [0xe07a2a, 0x2a2a2e]];
        // on the front (the band's face at z 9) and both sides (x 9 and x −9): a body and its hackle above
        [[-10, 18], [-2, 18], [6, 18]].forEach(([hx, hz], i) => { P.half(hx, 62, hz, F[i][0]); P.half(hx, 63, hz, F[i][1]); P.half(hx + 1, 63, hz, F[i][1]); });
        P.half(18, 62, -4, F[3][0]); P.half(18, 63, -4, F[3][1]); P.half(-19, 62, 2, F[4][0]); P.half(-19, 63, 2, F[4][1]); } },
    // the fishing vest: pockets in two rows on each side, their flaps, a red long sleeve under it
    top: { name: 'Pockets · fishing vest, pockets full', flank: 1, neckline: 'crew', draw(B, ctx) {
      shell(B, (x, y, z) => { if (z >= FRONT && (x === -1 || x === 0)) return y >= 10 ? VEST_D : VEST; if (z >= FRONT && (y === 13 || y === 16) && x !== -1 && x !== 0) return FLAP; return VEST; }, { neck: false });
      for (const y of [11, 12, 14, 15]) for (const x of [-4, -3, 2, 3]) B.set(x, y, FRONT + 1, (y === 12 || y === 15) ? shade(VEST, .9) : VEST);
      for (const y of [17, 18]) for (const x of [-1, 0]) B.set(x, y, FRONT, RED);
      sleeves(ctx, (lx, ly) => ly === 1 ? shade(RED, .8) : RED, { y0: 10 }); } },
    bottom: { name: 'Pockets · faded jeans', form: 'roomy', color: JEANS, paint: q => q.z === q.z1 && (q.y === 6 || q.y === 7) && q.u >= 1 ? 0x8a9cba : undefined },
    shoes: { name: 'Pockets · trail shoes', last: 'tongue', paint: q => q.region === 'outsole' ? [0x2a2a2a, 0] : q.region === 'midsole' ? [0xd8d4c8, 0] : [0x6a7060, 0] },
  },
};
