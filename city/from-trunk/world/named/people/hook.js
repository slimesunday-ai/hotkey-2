// HOOK MAHONEY · a man, 30s, enormous ("the size of a vending machine"); works the quay at Low Tide Docks.
import { shade, lerpHex, rnd, shell, placket, grip, bags, allFx, beardBelow, mouthLine, twoTone, skin } from '../kit.js';

const RUST = 0xb0602c, RUST_D = 0x8a4520, RUST_L = 0xc87a40, OAT = 0xd8ccb0, OLIVE = 0x4a4a32;
const beardC = (x, y, z) => { const r = rnd(x, y, z, 11); return r < .26 ? RUST_D : r < .4 ? RUST_L : RUST; };

export default {
  key: 'hook', name: 'Hook Mahoney', aka: ['Hook', 'Mahoney'], place: 'docks', scale: 1.2,
  who: 'A man, 30s, enormous ("the size of a vending machine").',
  signature: RUST,
  palette: { thermal: OAT, pants: OLIVE, boots: 0x1f1f22, beard: RUST },
  line: 'A red-brown beard like a doormat, down onto his chest, on a shaved head; bare arms; a cargo hook. Drawn 1.2 times.',
  changed: "Drawn 1.2 times, as the sheet asked. The beard is ginger now, not red-brown (the red-brown was Officer Pell's auburn), with strands down it; the shaved head carries a ginger stubble so it is not Big Lou's or Mr. Pruitt's bare crown.",
  pieces: {
    skin: skin('Hook · fair', 0xe2b39a, RUST),
    eyes: { name: 'Hook · small, under a heavy brow', rows: ['.....', '.....', '.PP..', '.....'], brow: ['.....', 'BBBBB', 'BBBBB'], fx: allFx(bags(.84)) },
    // a shaved head: the stubble's ginger shadow on the crown and above the ears
    // (a ginger buzz, speckled: from above it is a rust-pink crown, not Big Lou's bare dome or Mr. Pruitt's pink one)
    mark: { name: 'Hook · shaved head', draw(H, ctx) { const S = 0xb06030, t = (x, y, z, k) => k * (.75 + .5 * rnd(x, y, z, 6));
      for (let x = -8; x <= 7; x++) for (let z = -7; z <= 7; z++) if (H.has(x, 33, z)) H.set(x, 33, z, lerpHex(ctx.sk.c(x, 33, z), S, t(x, 33, z, .42)));
      for (let y = 27; y <= 32; y++) for (let z = -7; z <= 7; z++) for (const x of [-8, 7]) if (H.has(x, y, z) && z < 4) H.set(x, y, z, lerpHex(ctx.sk.c(x, y, z), S, t(x, y, z, .34)));
      for (let y = 25; y <= 32; y++) for (let x = -8; x <= 7; x++) if (H.has(x, y, -7)) H.set(x, y, -7, lerpHex(ctx.sk.c(x, y, -7), S, t(x, y, -7, .34)));
      for (let x = -8; x <= 7; x++) for (const y of [31, 32]) if (H.has(x, y, 7)) H.set(x, y, 7, lerpHex(ctx.sk.c(x, y, 7), S, t(x, y, 7, y === 32 ? .3 : .16))); } },
    // THE BEARD: from the cheekbones down over the jaw, a moustache into it, down onto his chest (kit.js § A BEARD THAT HANGS)
    mouth: { name: 'Hook · a beard like a doormat', draw(H, ctx) {
      mouthLine(H, ctx, 20, -2, 1);
      for (let y = 19; y <= 22; y++) for (let z = 1; z <= 7; z++) for (const x of [-8, 7]) if (H.has(x, y, z)) H.set(x, y, z, beardC(x, y, z));
      for (let y = 19; y <= 22; y++) for (let x = -8; x <= 7; x++) { if (y >= 20 && x >= -2 && x <= 1) continue; if (y === 22 && x >= -3 && x <= 2) continue; if (H.has(x, y, 7)) H.set(x, y, 7, beardC(x, y, 7)); }
      for (let y = 19; y <= 22; y++) for (let z = 2; z <= 7; z++) for (const x of [-9, 8]) if (y <= 21 || z >= 4) H.set(x, y, z, beardC(x, y, z));
      for (let x = -4; x <= 3; x++) H.set(x, 21, 8, beardC(x, 21, 8));
      for (const x of [-8, -7, -6, -5, -4, -3, 2, 3, 4, 5, 6, 7]) { H.set(x, 20, 8, beardC(x, 20, 8)); if (x <= -5 || x >= 4) H.set(x, 21, 8, beardC(x, 21, 8)); }
      for (let x = -8; x <= 7; x++) { H.set(x, 19, 8, beardC(x, 19, 8)); if (x >= -6 && x <= 5) H.set(x, 19, 9, beardC(x, 19, 9)); }
      beardBelow(H, 14, (x, y) => { const w = y >= 17 ? 8 : y >= 15 ? 7 : 4; if (x < -w || x > w - 1) return null; return [y === 18 ? 4 : y >= 16 ? 5 : 6, 9]; }, beardC);
    },
    // the finer blocks: strands down the beard's front, a lighter and a darker one a face
    fine(P) { for (let y = 14; y <= 19; y++) for (let x = y === 14 ? -4 : -5; x <= (y === 14 ? 3 : 4); x++) { const s = (x + y) & 1 ? 0 : 2, a = x * 4, b = y * 4;
      P.rect('+z', a + s, b, a + s + 1, b + 3, RUST_L); P.rect('+z', a + 3 - s, b + 1, a + 4 - s, b + 4, RUST_D); } } },
    // a sleeveless oatmeal waffle thermal, a henley placket; the arms bare
    top: { name: 'Hook · sleeveless waffle thermal', flank: 0, neckline: 'crew', draw(B) {
      shell(B, (x, y, z) => placket(x, z) && y >= 15 ? shade(OAT, .82) : (x + y + z) & 1 ? OAT : shade(OAT, .92), { fl: 0 }); },
      fine(P) { for (const y of [15, 16, 17]) P.rect('+z', -2, y * 4 + 1, 2, y * 4 + 3, 0x8a7e66); } },
    bottom: { name: 'Hook · olive canvas pants', form: 'baggy', color: OLIVE, waist: 0x26241a, paint: q => q.y === 4 ? shade(OLIVE, .85) : undefined },
    shoes: { name: 'Hook · black boots', last: 'fullcourt', paint: twoTone(0x1f1f22, 0x111113) },
    // a cargo hook: a wooden T-handle through the fist, the steel shank out between the fingers and curled up to a point
    held: { name: 'Hook · a cargo hook', pose: 'down', draw(G, ctx) { const Wd = 0x8a6a42, S = 0x9aa0a6;
      grip(G, ctx, Wd); G.set(6, 7, -3, Wd); G.set(6, 7, 2, Wd);
      for (const y of [6, 5, 4, 3]) G.set(6, y, 2, S, 1); for (const z of [1, 0, -1]) G.set(6, 2, z, S, 1); G.set(6, 2, 2, S, 1); G.set(6, 3, -1, S, 1); },
      fine(P) { P.halfBox(12, 8, -2, 13, 10, -1, 0xb8bec4, 1); } },
  },
};
