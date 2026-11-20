// VIC AMATO · a man, 50s, paunchy; sells condos off a folding table on Glasswall Plaza (the player hands out his flyers).
// REDESIGNED (the sheet's rough mock-up did not read: "from above the pompadour is black hair like anyone's"): a pitchman. A straw
// boater with an orange band over dyed black hair, a sprayed-on tan and a showroom grin, a shiny pale-grey suit a size too big on a
// belly, an orange tie and pocket square, white loafers, a big loud fan of yellow and orange flyers.
import { shade, lerpHex, rnd, hash3, shell, sleeves, collarWings, FRONT, hair, hairShell, hairline, at, solid, rowsOf, ring, bulge, lipTone, skin } from '../kit.js';

const STRAW = 0xe2c88c, STRAW_D = 0xc8aa6a, BAND = 0xe07a2a, SUIT = 0xb4bac2, SUIT_D = shade(0xb4bac2, .84), WHITE = 0xf2f0ea, YELLOW = 0xf2d24a, BLACK = 0x121214;
const weave = (x, y, z) => ((x + z + y) & 1) ? STRAW : lerpHex(STRAW, STRAW_D, .45);

export default {
  key: 'vic', name: 'Vic Amato', aka: ['Vic', 'Amato'], place: 'plaza', scale: 1.05,
  who: 'A man, 50s, paunchy. Sells condos off a folding table.',
  signature: STRAW,
  palette: { suit: SUIT, tie: BAND, flyers: YELLOW, boater: STRAW },
  line: 'A pitchman: a straw boater with an orange band over dyed black hair, a sprayed tan and a showroom grin, a shiny grey suit a size too big over a belly, a loud fan of yellow flyers.',
  changed: 'Redesigned (the sheet marked him "does not read"): the boater is his crown now (from above, the black pompadour was anyone\'s black hair); the orange of the tie runs through the band, the pocket square and the flyers; a belly under the suit; the flyers are bigger and louder. Drawn 1.05 times.',
  pieces: {
    skin: skin('Vic · sprayed tan', 0xd08850, 0x121214),
    // eager eyes under raised black brows
    eyes: { name: 'Vic · eager, brows up', rows: ['.....', '.WPP.', '.WPP.', '.....'], brow: ['.BBB.', 'B...B', '.....'] },
    // the showroom grin: lips round a row of white teeth, the corners up
    mouth: { name: 'Vic · a showroom grin', draw(H, ctx) {
      for (let x = -3; x <= 2; x++) { H.set(x, 20, 7, 0xf6f2e8); H.set(x, 19, 7, lipTone(ctx, x, 19)); } for (let x = -2; x <= 1; x++) H.set(x, 21, 7, lipTone(ctx, x, 21));
      for (const x of [-4, 3]) H.set(x, 21, 7, lipTone(ctx, x, 21)); } },
    // dyed black hair, slicked (glossy), long sideburns; the boater sits on top of it
    hair: { name: 'Vic · dyed black, slicked', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 23 : 25, at(23)), 1), BLACK, 1); A.commit(); } },
    // a straw boater: a flat-topped crown with an orange band, a flat brim all round
    hat: { name: 'Vic · straw boater', draw(H) {
      solid(H, { ...rowsOf(32, 35, [-8, 7, -7, 7, 2]) }, (x, y, z) => y === 33 || y === 34 ? BAND : weave(x, y, z));
      solid(H, { 36: [-8, 7, -7, 7, 2] }, weave);
      ring(H, 32, [-11, 10, -10, 10, 3], [-8, 7, -7, 7], weave); } },
    // a shiny pale-grey suit a size too big (glossy, wide), a white shirt, an orange tie and pocket square, a belly
    top: { name: 'Vic · shiny grey suit, orange tie', flank: 2, neckline: 'collar', puffy: true, draw(B, ctx) {
      shell(B, (x, y, z) => { if (z >= FRONT) { if ((x === -1 || x === 0) && y >= 11) return BAND; if (Math.abs(x + .5) <= (y - 10) / 2.4 && y >= 12) return WHITE; } return y === 9 ? SUIT_D : SUIT; }, { fl: 2, neck: false, l: 1 });
      bulge(B, { 10: [-4, 3], 11: [-4, 3], 12: [-3, 2], 13: [-2, 1] }, FRONT + 1, (x, y) => (x === -1 || x === 0) && y >= 11 ? BAND : SUIT);
      collarWings(B, WHITE, FRONT); for (const [x, y] of [[3, 16], [4, 16], [4, 17]]) B.set(x, y, FRONT + 1, BAND);
      for (let x = -7; x <= 6; x++) for (let y = 9; y <= 18; y++) for (let z = -4; z <= 4; z++) if (B.get(x, y, z) === SUIT) B.set(x, y, z, SUIT, 1);
      sleeves(ctx, (lx, ly) => ly === 1 ? SUIT_D : SUIT, { y0: 10, out: 1, fl: 2, l: 1 }); },
      fine(P) { for (const x of [-5, -4, 3]) P.rect('+z', x * 4, 9 * 4, x * 4 + 4, 16 * 4, (a, b) => ((a + b) % 3) === 0 ? 0xc8ced6 : null); } },
    bottom: { name: 'Vic · the suit\'s trousers', form: 'baggy', color: SUIT, paint: q => [q.u === 1 && q.z === q.z1 ? SUIT_D : SUIT, 1] },
    shoes: { name: 'Vic · white loafers', last: 'lowline', paint: q => q.region === 'sole' ? [0x2a2622, 0] : [q.top && q.z >= 2 ? BAND : 0xeee8dc, 1] },
    // a fan of flyers held up, yellow and orange sheets fanned out round the fist (bigger and louder than the sheet's)
    held: { name: 'Vic · a fan of flyers', pose: 'raised', draw(G, ctx) {
      for (const [x, y, z] of ctx.grip.cells) G.set(x, y, z, YELLOW);
      for (let x = 5; x <= 8; x++) for (let y = 6; y <= 8; y++) for (let z = 2; z <= 4; z++) G.set(x, y, z, ((x + z + y) % 3) === 0 ? BAND : hash3(x, y, z) % 4 === 0 ? WHITE : YELLOW);
      for (let y = 6; y <= 8; y++) for (let z = -2; z <= 1; z++) G.set(8, y, z, (y + z) & 1 ? YELLOW : BAND); } },
  },
};
