// MR. FERRARO · a man, 60s, round; a stall at the Jay St night market. Written only on the sheet: "grey hair combed back, a grey
// walrus moustache, a white shirt with the sleeves rolled, a navy-and-white striped grocer's apron, a pencil behind his ear".
import { shade, lerpHex, rnd, two, shell, sleeves, FRONT, hair, hairShell, hairline, at, solid, bulge, bags, crows, allFx, lipTone, skin, twoTone } from '../kit.js';

const NAVY = 0x243460, WHITE = 0xf0eee8, GREY = 0xaaa6a0, GREY_D = 0x86827c, TROUSER = 0x45474c;
const stripe = x => ((x + 8) & 1) ? NAVY : WHITE;

export default {
  key: 'ferraro', name: 'Mr. Ferraro', aka: ['Ferraro'], place: 'market', scale: 1.05,
  who: 'A man, 60s, round. A stall at the market.',
  signature: NAVY,
  palette: { apron: NAVY, shirt: WHITE, trousers: TROUSER, hair: GREY },
  line: 'A grocer in navy-and-white stripes: a striped paper cap on grey hair combed back, a striped apron over a round belly, a grey walrus moustache, a pencil behind his ear.',
  changed: 'Written only on the sheet. Added: the striped paper grocer\'s cap, because grey hair combed back from above is Mr. Ambrose\'s crown; the cap carries his apron\'s stripes to the top of his head. Drawn 1.05 times, with a belly under the apron.',
  pieces: {
    skin: skin('Ferraro · olive', 0xd4a682, 0x8e8a84),
    eyes: { name: 'Ferraro · heavy, lined', rows: ['.....', '.WPP.', '.WPP.', '.....'], brow: ['.....', 'BBBB.', '.BBBB'], fx: allFx(bags(.84), crows(.8)) },
    // a grey walrus moustache over the whole mouth, its ends drooping past the corners
    mouth: { name: 'Ferraro · grey walrus moustache', draw(H, ctx) { const c = (x, y, z) => rnd(x, y, z, 7) < .3 ? GREY_D : GREY;
      for (let x = -1; x <= 0; x++) H.set(x, 19, 7, lipTone(ctx, x, 19));
      for (let x = -5; x <= 4; x++) H.set(x, 21, 8, c(x, 21, 8));
      for (let x = -5; x <= 4; x++) H.set(x, 20, 8, c(x, 20, 8));
      for (const x of [-5, -4, 3, 4]) H.set(x, 19, 8, c(x, 19, 8)); },
      fine(P) { for (let x = -5; x <= 4; x++) P.rect('+z', x * 4 + ((x & 1) ? 1 : 2), 20 * 4, x * 4 + ((x & 1) ? 2 : 3), 21 * 4 + 3, GREY_D); } },
    // grey hair combed straight back (the cap sits on top of it); a yellow pencil tucked over the right ear
    hair: { name: 'Ferraro · grey, combed back', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 26 : 24, at(22)), (px, py, pz, ox, oy, oz) => oz < 0 ? 2 : 1), (x, y, z) => (z & 1) && y >= 30 ? GREY_D : GREY); A.commit();
      const P = hair(H, { ears: true }); for (let z = -2; z <= 3; z++) P.put(-10, 28, z, z === -2 ? 0xd88a8a : z === 3 ? 0xe0c090 : 0xe2b72e); P.commit(); },
      fine(P) { P.half(-20, 56, 8, 0x2a2a2e); } },
    // a striped paper grocer's cap, folded, worn on top of the head (it covers the crown, not the sides)
    hat: { name: 'Ferraro · striped paper cap', draw(H) {
      solid(H, { 33: [-6, 5, -7, 7, 1], 34: [-6, 5, -7, 7, 1], 35: [-5, 4, -7, 7, 1], 36: [-3, 2, -6, 6, 1] }, (x, y) => y === 34 ? shade(stripe(x), .9) : stripe(x)); } },
    // a white shirt, the sleeves rolled to the elbow; the striped bib apron over a round belly, its straps over the shoulders
    top: { name: 'Ferraro · striped apron, white shirt', neckline: 'collar', puffy: true, draw(B, ctx) {
      shell(B, (x, y, z) => z >= FRONT && x >= -4 && x <= 3 && y <= 16 ? stripe(x) : (Math.abs(z) >= FRONT && (x === -3 || x === 2) && y >= 17) ? NAVY : y === 11 && Math.abs(z) < 3 ? NAVY : WHITE, { neck: false });
      bulge(B, { 10: [-3, 2], 11: [-3, 2], 12: [-3, 2], 13: [-2, 1] }, FRONT + 1, x => stripe(x));
      for (const x of [-4, -3, 2, 3]) B.set(x, 18, FRONT + 1, WHITE);
      sleeves(ctx, (lx, ly) => ly <= 5 ? shade(WHITE, .9) : WHITE, { y0: 13 }); } },
    // dark grey trousers; the apron on down the front of the thighs
    bottom: { name: 'Ferraro · grey trousers, the apron', form: 'straight', color: TROUSER, paint: q => q.z === q.z1 && q.y >= 6 ? stripe(q.x) : undefined },
    shoes: { name: 'Ferraro · black work shoes', last: 'lowline', paint: twoTone(0x1c1c1e, 0x111113, 1) },
  },
};
