// MR. TEAGUE · a man, 70s, thin; keeps pigeons on the roof across the avenue.
import { shade, lerpHex, hash3, rnd, two, fleck, shell, sleeves, collarWings, FRONT, placket, hair, solid, rowsOf, bags, crows, allFx, mouthLine, coatOver, twoTone, skin } from '../kit.js';

const TWEED = 0x6e5f48, WAX = 0x4e4c34, CORD = 0x6e4a30, WHITE = 0xe0ddd6;
const DOVE = 0x9aa4b2, WING = 0x4c5464, NECK = 0x4f8a6a, PURP = 0x8a5a9a, BEAK = 0x2e2a2a, FEET = 0xc9605a;

export default {
  key: 'teague', name: 'Mr. Teague', aka: ['Teague'], place: 'park', scale: 1.0,
  who: 'A man, 70s, thin. Keeps pigeons on the roof across the avenue.',
  signature: DOVE,
  palette: { coat: WAX, cap: TWEED, trousers: 0x55565a, pigeon: DOVE },
  line: 'One of his pigeons riding on his tweed cap.',
  changed: 'The pigeon is plumper and easier to see: pale body, barred wings, a green-and-purple neck, a beak and eyes in the finer blocks.',
  pieces: {
    skin: skin('Teague · fair, weathered', 0xdfb299, 0xcfcac2),
    eyes: { name: 'Teague · heavy brows, bags', rows: ['.....', '.WPP.', '.WPP.', '.....'], brow: ['.....', 'BBBB.', '.BBBB'], fx: allFx(bags(.8), crows(.78)) },
    mouth: { name: 'Teague · a line', draw(H, ctx) { mouthLine(H, ctx); for (const x of [-3, 2]) H.set(x, 19, 7, lerpHex(ctx.sk.c(x, 19, 7), 0x3a2a24, .25)); } },
    mark: { name: 'Teague · white stubble', draw(H, ctx) {
      for (let x = -8; x <= 7; x++) for (let y = 19; y <= 22; y++) for (let z = 1; z <= 7; z++) {
        const face = z === 7, side = (x === -8 || x === 7) && z <= 6; if (!face && !side) continue;
        if (face && y >= 20 && x >= -3 && x <= 2) continue; if (!H.has(x, y, z) || rnd(x, y, z, 4) > .5) continue;
        H.set(x, y, z, lerpHex(ctx.sk.c(x, y, z), 0xf2f0ea, .4), ctx.sk.layer || 0); } } },
    hair: { name: 'Teague · white fringe', draw(H) { const A = hair(H);
      A.grow((px, py, pz, ox, oy, oz) => oy > 0 ? 0 : py >= 22 && py <= 29 && (ox !== 0 || oz < 0) ? 1 : 0, two(WHITE, .88)); A.commit(); } },
    // a tweed flat cap; a pigeon riding it, its tail over the back
    hat: { name: 'Teague · flat cap, a pigeon on it', draw(H) {
      solid(H, { ...rowsOf(30, 32, [-9, 8, -8, 8, 2]), 33: [-8, 7, -7, 9, 3] }, fleck(TWEED, 0x7d6d55, .25)); solid(H, { 30: [-8, 7, 9, 11, 2] }, shade(TWEED, .85));
      // the bird, facing forward on the crown: a plump pale body, folded wings with two black bars, the tail back over the cap's rear,
      // the neck's green and purple sheen, a darker head
      const BAR = 0x2a2e38, HEAD = 0x7a8494, TIP = 0x3a3e48;
      const body = { 34: [-4, 2, -4, 2, 2], 35: [-3, 1, -3, 2, 1], 36: [-2, 0, -2, 1, 0] };
      solid(H, body, (x, y, z) => (x === -4 || x === 2 || (y === 35 && (x === -3 || x === 1))) ? ((z === -1 || z === -3) ? BAR : WING) : DOVE);
      for (let z = -7; z <= -5; z++) for (let x = -2; x <= 0; x++) H.set(x, 34, z, z === -7 ? TIP : WING);
      for (let x = -2; x <= 0; x++) { H.set(x, 36, 2, x === -1 ? NECK : PURP); H.set(x, 37, 2, HEAD); H.set(x, 37, 3, HEAD); H.set(x, 36, 3, x === -1 ? NECK : HEAD); } },
      // the finer blocks: a dark beak with its pale cere, the orange eyes
      fine(P) { P.halfBox(-2, 74, 8, 0, 75, 10, BEAK); P.half(-2, 75, 8, 0xe2d6c4); P.half(-1, 75, 8, 0xe2d6c4);
        P.rect('+x', 3 * 4 + 1, 37 * 4 + 1, 3 * 4 + 3, 37 * 4 + 3, 0xd07a2a); P.rect('-x', 3 * 4 + 1, 37 * 4 + 1, 3 * 4 + 3, 37 * 4 + 3, 0xd07a2a); } },
    // a waxed olive coat, worn long, a brown corduroy collar
    top: { name: 'Teague · waxed coat, cord collar', flank: 2, neckline: 'collar', draw(B, ctx) {
      shell(B, (x, y, z) => placket(x, z) ? shade(WAX, .8) : z >= FRONT && y >= 10 && y <= 12 && ((x >= -5 && x <= -3) || (x >= 2 && x <= 4)) ? shade(WAX, .78) : WAX, { fl: 2, neck: false });
      collarWings(B, CORD, FRONT, { open: true }); for (let x = -5; x <= 4; x++) B.set(x, 18, -4, CORD);
      sleeves(ctx, (lx, ly) => ly === 1 ? shade(WAX, .8) : WAX, { y0: 10, out: 1, fl: 2 }); } },
    bottom: { name: 'Teague · the coat, grey trousers', form: 'straight', color: WAX, paint: q => q.y >= 6 ? (q.u === -1 ? shade(WAX, .8) : WAX) : 0x55565a },
    shoes: { name: 'Teague · black boots', last: 'fullcourt', paint: twoTone(0x1f1f22, 0x111113) },
  },
};
