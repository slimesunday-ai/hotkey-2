// MR. HAINES · a man, 60s, square and thick-necked; the foreman at Low Tide Docks (he teaches the throw).
import { shade, lerpHex, hash3, two, shell, sleeves, collarWings, FRONT, hair, hairShell, hairline, at, solid, rowsOf, ring, hbox, grip, bags, crows, furrow, allFx, mouthLine, skin, twoTone } from '../kit.js';

const HIVIS = 0xc8da3a, REFLECT = 0xd6d9dc, WHITE = 0xf0eee8, NAVY = 0x22305a, WOOD = 0x8a6a42;

export default {
  key: 'haines', name: 'Mr. Haines', aka: ['Haines'], place: 'docks', scale: 1.06,
  who: 'A man, 60s, square and thick-necked. The foreman.',
  signature: HIVIS,
  palette: { vest: HIVIS, shirt: WHITE, tie: NAVY, trousers: 0x2a3550 },
  line: 'A hi-vis hard hat to match his hi-vis vest, worn over a white shirt and a navy tie; a clipboard with two pencils on strings.',
  changed: "The sheet asked for his hard hat in his own colour (the crowd has the white one): it is hi-vis lime, the vest's colour, so from above the foreman is one lime shape. Drawn 1.06 times.",
  pieces: {
    skin: skin('Haines · ruddy', 0xe6bca2, 0xe0dcd4),
    eyes: { name: 'Haines · heavy, lined', rows: ['.....', '.WPP.', '.WPP.', '.....'], brow: ['.....', 'BBBB.', '.BBBB'], fx: allFx(bags(.82), crows(.8), furrow(.84)) },
    mouth: { name: 'Haines · a set frown', draw(H, ctx) { mouthLine(H, ctx); for (const x of [-3, 2]) H.set(x, 19, 7, lerpHex(ctx.sk.c(x, 19, 7), ctx.sk.mouth, .5)); } },
    hair: { name: 'Haines · white crew cut', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 28 : 25, at(22)), 1), two(0xe6e2da, .9)); A.commit(); } },
    // a hard hat in hi-vis lime, scuffed, a silver reflective band round it
    hat: { name: 'Haines · hi-vis hard hat', draw(H) {
      ring(H, 30, [-10, 9, -9, 11, 2], [-9, 8, -8, 8], shade(HIVIS, .88));
      solid(H, { ...rowsOf(30, 33, [-9, 8, -8, 8, 2]), 34: [-8, 7, -7, 7, 2], 35: [-6, 5, -5, 5, 2] }, (x, y, z) => y === 32 ? REFLECT : hash3(x, y, z) % 13 === 0 ? shade(HIVIS, .82) : HIVIS);
      solid(H, { 36: [-1, 0, -4, 4, 0] }, shade(HIVIS, .9)); } },
    // the hi-vis vest open over a white shirt and a navy tie, two reflective bands round it
    top: { name: 'Haines · hi-vis vest, shirt and tie', neckline: 'collar', draw(B, ctx) {
      shell(B, (x, y, z) => { if (z >= FRONT && (x === -1 || x === 0) && y >= 11) return NAVY; if (z >= FRONT && x >= -2 && x <= 1) return WHITE; return y === 12 || y === 15 ? REFLECT : HIVIS; }, { neck: false });
      collarWings(B, WHITE, FRONT);
      sleeves(ctx, (lx, ly) => ly === 1 ? 0xd8d6d0 : WHITE, { y0: 10 }); } },
    bottom: { name: 'Haines · navy work trousers', form: 'straight', color: 0x2a3550, waist: 0x1e1a16 },
    shoes: { name: 'Haines · tan boots', last: 'fullcourt', paint: q => q.region === 'sole' ? [0x2a2018, 0] : [0x9a6a3e, 0] },
    // a clipboard: the board through the fist, the sheet on its outside, two pencils hanging on strings
    held: { name: 'Haines · a clipboard', pose: 'forward', draw(G, ctx) {
      grip(G, ctx, WOOD); G.set(6, 7, 2, WOOD); G.set(6, 7, -3, WOOD);
      hbox(G, ctx, 7, 7, 5, 8, -3, 4, WOOD); hbox(G, ctx, 8, 8, 5, 8, -3, 4, (x, y, z) => y === 8 && (z === 0 || z === 1) ? 0x9aa0a6 : WHITE); },
      fine(P) { P.rect('+x', -2 * 4, 6 * 4 + 1, 3 * 4, 6 * 4 + 2, 0xe2b72e); P.rect('+x', -1 * 4, 7 * 4 + 2, 4 * 4, 7 * 4 + 3, 0xd0402a); } },
  },
};
