// LOLA · a woman, 30s, curvy; a buyer in the night market's crowd. The sheet's black tights (under a raincoat) are now trousers (the
// owner, 2026-11-18): black cigarette trousers under the leopard raincoat.
import { shade, lerpHex, rnd, hash3, shell, sleeves, collarWings, FRONT, hair, hairShell, hairline, at, bx, grip, hangers, lips, skin, twoTone } from '../kit.js';

const MAGENTA = 0xc23a7a, TAN = 0xd09a4e, SPOT = 0x2e2216, RIM = 0x8a5a2a, BELT = 0x1a1a1c, DARK = 0x3a2418, CARAMEL = 0xa8743e;
const leopard = (x, y, z) => { const h = hash3(x >> 1, y >> 1, z >> 1) % 4; if (h) return TAN; return ((x + y + z) & 1) ? SPOT : RIM; };
const curls = (x, y, z) => { const r = rnd(x, y, z, 9); return r < .16 ? CARAMEL : r < .4 ? lerpHex(DARK, CARAMEL, .3) : DARK; };

export default {
  key: 'lola', name: 'Lola', aka: [], place: 'market', scale: 0.98,
  who: 'A woman, 30s, curvy.',
  signature: MAGENTA,
  palette: { coat: TAN, trousers: 0x1a1a1e, flats: 0xb8303c, bag: MAGENTA },
  line: 'Big curly hair piled up high, a magenta scarf wrapped round the pile; red lipstick; a belted leopard-print raincoat; a big magenta shopping bag.',
  changed: 'Lost the black tights: black cigarette trousers under the raincoat, the red flats kept. A magenta scarf (her bag\'s colour) is wrapped round the pile, so from above it is not Slim\'s curls or Teo\'s top-knot.',
  pieces: {
    skin: skin('Lola · warm brown', 0xb98058, 0x241612, { lash: 0x1a100c }),
    eyes: { name: 'Lola · lashed, bright', rows: ['kk...', '.WPP.', '.WPP.', '.....'], brow: ['.BBB.', 'B...B', '.....'], palette: { k: [0x1a100c, 0, 8] } },
    mouth: { name: 'Lola · red lipstick', draw(H) { const L = 0xc23040; lips(H, L); for (const x of [-3, 2]) H.set(x, 21, 7, shade(L, .9)); } },
    // the curls piled up high: a curly shell and a big pile on top, pinned
    hair: { name: 'Lola · curls piled up', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(31), pz => pz >= 3 ? 26 : 24, at(23)), (px, py, pz) => 1 + (rnd(px, py, pz, 5) < .5 ? 1 : 0)), curls);
      A.ball(-.5, 37.2, -1.2, 4.6, 3.4, 4.4, curls, 0, 1.2);
      // a magenta silk scarf wrapped round the base of the pile, knotted at the front
      for (let x = -5; x <= 4; x++) for (let z = -5; z <= 4; z++) { const e = ((x + .5) / 5.2) ** 2 + ((z + 1.2) / 5) ** 2; if (e <= 1 && e > .45) A.put(x, 35, z, (x + z) & 1 ? MAGENTA : shade(MAGENTA, .86)); }
      A.put(-1, 35, 4, shade(MAGENTA, 1.1)); A.put(0, 35, 4, shade(MAGENTA, 1.1)); A.put(-1, 36, 5, MAGENTA); A.commit(); } },
    // a belted leopard raincoat, its collar open
    top: { name: 'Lola · leopard raincoat, belted', flank: 2, neckline: 'collar', draw(B, ctx) {
      shell(B, (x, y, z) => y === 11 ? BELT : z >= FRONT && (x === -1 || x === 0) && y === 11 ? 0xc9a24e : leopard(x, y, z), { fl: 2, neck: false });
      collarWings(B, TAN, FRONT, { open: true }); B.set(-1, 11, FRONT + 1, 0x8a7a48, 1); B.set(0, 11, FRONT + 1, 0x8a7a48, 1);
      sleeves(ctx, (lx, ly, z) => ly === 1 ? shade(TAN, .8) : leopard(lx + 20, ly, z), { y0: 10, out: 1, fl: 2 }); } },
    bottom: { name: 'Lola · the raincoat, black trousers', form: 'slim', color: 0x1a1a1e, paint: q => q.y >= 6 ? leopard(q.x, q.y, q.z) : undefined },
    shoes: { name: 'Lola · red flats', last: 'lowline', paint: twoTone(0xb8303c, 0x2a1a1a, 1) },
    held: { name: 'Lola · a big magenta shopping bag', pose: 'down', draw(G, ctx) {
      bx(G, 5, 8, 2, 5, -3, 2, (x, y) => y === 5 ? shade(MAGENTA, .8) : MAGENTA); hangers(G, 0x1a1a1a); grip(G, ctx, 0x1a1a1a); } },
  },
};
