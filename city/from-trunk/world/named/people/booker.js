// MR. BOOKER · a man, 70s, slim; shines shoes on Glasswall Plaza.
import { shade, lerpHex, rnd, two, shell, sleeves, collarWings, FRONT, hair, solid, bx, grip, hangers, bags, crows, allFx, mouthLine, skin } from '../kit.js';

const OXBLOOD = 0x6e2a2c, SEAM = 0x4e1c1e, WHITE = 0xf0eee8, VEST = 0x1f1f24, GARTER = 0xb8312f, WOOD = 0x6a4428, BRASS = 0xc9a24e, TROUSER = 0x6a6c70;

export default {
  key: 'booker', name: 'Mr. Booker', aka: ['Booker'], place: 'plaza', scale: 0.95,
  who: 'A man, 70s, slim. Shines shoes.',
  signature: OXBLOOD,
  palette: { cap: OXBLOOD, vest: VEST, shirt: WHITE, garters: GARTER },
  line: 'An oxblood newsboy cap, a white fringe and a neat white moustache, a black waistcoat, red sleeve garters, two-tone shoes, his shine box with brass corners.',
  changed: 'The flat cap is a newsboy cap now, round and panelled with a button on top, so it is not Mr. Teague\'s flat cap from above; drawn 0.95 times.',
  pieces: {
    skin: skin('Booker · deep brown', 0x5e3d2a, 0xe6e2da),
    eyes: { name: 'Booker · kind, lined', rows: ['.....', '.WPP.', '.WPP.', '.LLL.'], brow: ['.....', '.BBB.', '.....'], fx: allFx(crows(.82, [23, 25, 26]), bags(.86, { y: 22, xs: [-6, -5] })) },
    // a neat white moustache, trimmed, over a small smile
    mouth: { name: 'Booker · neat white moustache', draw(H, ctx) { mouthLine(H, ctx, 20, -2, 1); for (const x of [-3, 2]) H.set(x, 20, 7, lerpHex(ctx.sk.c(x, 20, 7), ctx.sk.mouth, .45));
      for (let x = -3; x <= 2; x++) H.set(x, 21, 8, x === -3 || x === 2 ? 0xd6d2ca : 0xe6e2da); } },
    hair: { name: 'Booker · white fringe', draw(H) { const A = hair(H);
      A.grow((px, py, pz, ox, oy, oz) => oy > 0 ? 0 : py >= 22 && py <= 29 && (ox !== 0 || oz < 0) ? 1 : 0, two(0xe6e2da, .9)); A.commit(); } },
    // a newsboy cap: a round, full crown in panels (seams running to a button on top), a short peak
    hat: { name: 'Booker · oxblood newsboy cap', draw(H) {
      const seam = (x, y, z) => (y >= 33 && (x === -1 || z === 0 || x === z - 1 || x === -z - 1)) ? SEAM : OXBLOOD;
      solid(H, { 30: [-9, 8, -8, 8, 2], 31: [-9, 8, -8, 8, 2], 32: [-10, 9, -9, 9, 3], 33: [-10, 9, -9, 9, 3], 34: [-9, 8, -8, 8, 3], 35: [-7, 6, -6, 6, 3] }, seam);
      solid(H, { 30: [-7, 6, 9, 10, 2] }, SEAM); for (const x of [-1, 0]) H.set(x, 36, 0, OXBLOOD); H.set(-1, 36, -1, OXBLOOD); H.set(0, 36, -1, OXBLOOD); } },
    // a white shirt, a black waistcoat with brass buttons, red garters on the sleeves
    top: { name: 'Booker · waistcoat, sleeve garters', neckline: 'collar', draw(B, ctx) {
      shell(B, (x, y, z) => { if (z >= FRONT && (x === -1 || x === 0) && y >= 15) return 0x1a1a1e; if (y >= 10 && y <= 16) return VEST; return WHITE; }, { neck: false });
      collarWings(B, WHITE, FRONT);
      sleeves(ctx, (lx, ly) => ly === 5 ? GARTER : ly === 1 ? 0xe2e0da : WHITE, { y0: 10 }); },
      fine(P) { for (const y of [10, 12, 14]) P.halfBox(-1, 2 * y + 1, 8, 1, 2 * y + 2, 9, BRASS, 1); } },
    bottom: { name: 'Booker · grey trousers, pressed', form: 'straight', color: TROUSER, paint: q => q.z === q.z1 && q.u === 1 ? 0x7a7c80 : undefined },
    shoes: { name: 'Booker · two-tone shoes, shined', last: 'lowline', paint: q => q.region === 'sole' ? [0x1a1a1a, 0] : q.z >= 2 ? [0xf0eee8, 1] : [0x1a1a1a, 1] },
    // the shine box: wood, brass corners, the foot rest on its lid, a strap handle up to the fist
    held: { name: 'Booker · his shine box', pose: 'down', draw(G, ctx) {
      bx(G, 5, 8, 2, 4, -4, 3, (x, y, z) => ((x === 5 || x === 8) && (z === -4 || z === 3)) ? BRASS : WOOD);
      bx(G, 6, 7, 5, 5, -2, 1, shade(WOOD, .8)); hangers(G, shade(WOOD, .7), 0, 5); grip(G, ctx, shade(WOOD, .7)); } },
  },
};
