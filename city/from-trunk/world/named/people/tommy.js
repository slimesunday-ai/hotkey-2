// TOMMY GAFFNEY · a man, 40s, barrel-chested; runs the quay's crew at Low Tide Docks. Written only on the sheet: "red hair going grey,
// a navy peacoat, double-breasted, collar up, a gold front tooth, grey work trousers, boots".
import { shade, lerpHex, rnd, shell, sleeves, FRONT, hair, hairShell, hairline, at, bulge, bags, crows, allFx, lipTone, stubble, skin } from '../kit.js';

const COAT = 0x1c2030, COAT_L = 0x2a3046, RED = 0x9c4a2e, GREY = 0xa8a098, TROUSER = 0x5a5c60;
const redGrey = (x, y, z) => { const side = x <= -9 || x >= 8; const r = rnd(x, y, z, 14); if (side) return y <= 31 ? lerpHex(GREY, RED, r * .3) : lerpHex(RED, GREY, .5); if (z <= -8) return lerpHex(RED, GREY, .35); return r < .12 ? lerpHex(RED, GREY, .6) : r < .3 ? shade(RED, .88) : RED; };

export default {
  key: 'tommy', name: 'Tommy Gaffney', aka: ['Tommy', 'Gaffney'], place: 'docks', scale: 1.08,
  who: 'A man, 40s, barrel-chested. Runs the quay\'s crew.',
  signature: COAT,
  palette: { peacoat: COAT, hair: RED, trousers: TROUSER },
  line: 'Thick red hair going grey, grey at the sides, over the turned-up collar of a navy peacoat, double-breasted on a barrel chest; a grin with a tooth missing.',
  changed: 'Written only on the sheet, so all of it is new. Changed: the gold front tooth is a missing tooth instead (gold teeth are the players\' grills). Drawn 1.08 times, the peacoat full over a barrel chest.',
  pieces: {
    skin: skin('Tommy · ruddy', 0xe0a888, 0xa8645a),
    eyes: { name: 'Tommy · weathered', rows: ['.....', '.WPP.', '.WPP.', '.....'], brow: ['.....', 'BBBB.', '.BBBB'], fx: allFx(bags(.84), crows(.78)) },
    // a grin: the upper lip, the teeth with the front one gone, the lower lip, the corners up
    mouth: { name: 'Tommy · a grin, a tooth missing', draw(H, ctx) {
      for (let x = -2; x <= 1; x++) { H.set(x, 21, 7, lipTone(ctx, x, 21)); H.set(x, 19, 7, lipTone(ctx, x, 19)); }
      for (const [x, c] of [[-2, 0xf0ebe0], [-1, 0x2a1414], [0, 0xf0ebe0], [1, 0xe8e2d4]]) H.set(x, 20, 7, c);
      for (const x of [-3, 2]) H.set(x, 21, 7, lipTone(ctx, x, 21)); } },
    mark: stubble('Tommy · red-grey stubble', 0x9c6a50, .26, .5),
    // thick hair combed back, red on top going grey, grey at the sides and the back
    hair: { name: 'Tommy · red going grey', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 27 : 25, at(22)), (px, py, pz, ox, oy, oz) => oy > 0 ? 2 : 1), redGrey); A.commit(); } },
    // a navy peacoat, double-breasted (two rows of buttons), broad lapels, the collar turned up; full over a barrel chest
    top: { name: 'Tommy · navy peacoat', flank: 2, neckline: 'high', puffy: true, draw(B, ctx) {
      shell(B, (x, y, z) => z >= FRONT && y >= 15 && x >= -3 && x <= 2 && Math.abs(x + .5) >= (18 - y) * 1.2 - 1 ? COAT_L : y === 9 ? shade(COAT, .8) : COAT, { fl: 2, neck: false });
      bulge(B, { 13: [-4, 3], 14: [-4, 3], 15: [-4, 3], 16: [-3, 2] }, FRONT + 1, COAT);
      for (let x = -5; x <= 4; x++) B.set(x, 18, -4, COAT_L); for (const x of [-5, -4, 3, 4]) { B.set(x, 18, 4, COAT_L); B.set(x, 17, 4, COAT_L); }
      sleeves(ctx, (lx, ly) => ly === 1 ? COAT_L : COAT, { y0: 10, out: 1, fl: 2 }); },
      // the two rows of horn buttons (on the barrel chest they sit one further out)
      fine(P) { for (const [y, hz] of [[10, 8], [12, 8], [14, 10]]) for (const hx of [-6, 4]) P.halfBox(hx, 2 * y + 1, hz, hx + 2, 2 * y + 2, hz + 1, 0x3a3020); } },
    bottom: { name: 'Tommy · grey work trousers', form: 'straight', color: TROUSER },
    shoes: { name: 'Tommy · brown work boots', last: 'fullcourt', paint: q => q.region === 'sole' ? [0x1a1410, 0] : [0x3e2a1e, 0] },
  },
};
