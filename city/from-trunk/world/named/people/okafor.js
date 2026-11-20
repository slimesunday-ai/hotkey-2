// MR. OKAFOR · a man, 50s, tall and lean; a stallholder at the night market (the floor safe, the skateboard).
import { shade, lerpHex, rnd, shell, sleeves, collarWings, FRONT, placket, hair, hairShell, hairline, at, crows, allFx, lipTone, mouthLine, skin, twoTone } from '../kit.js';

const COAT = 0xa88a5a, COLLAR = 0x8a6e44, SALT = 0x96928c, PEPPER = 0x7a7672, WHITE = 0xb0aca6, TROUSER = 0x4a3626;
const sp = (x, y, z) => { const r = rnd(x, y, z, 12); return r < .16 ? PEPPER : r < .3 ? WHITE : SALT; };

export default {
  key: 'okafor', name: 'Mr. Okafor', aka: ['Okafor'], place: 'market', scale: 1.04,
  who: 'A man, 50s, tall and lean. Sells the floor safe and the skateboard.',
  signature: SALT,
  palette: { coat: COAT, trousers: TROUSER, hair: SALT },
  line: 'A close salt-and-pepper crop with a razor parting, a close grey beard, half-moon glasses, three pens in the pocket of a tan work coat.',
  changed: 'The crop has a parting shaved into it, a light line across the crown, so from above it is his and not any grey head; the pens stand up out of the pocket in the finer blocks; drawn 1.04 times.',
  pieces: {
    skin: skin('Okafor · deep brown', 0x4e3222, 0x9a948c),
    eyes: { name: 'Okafor · cool, heavy lids', rows: ['.....', '.LLL.', '.WPP.', '.....'], brow: ['.....', '.BBBB', '.....'], fx: allFx(crows(.84)) },
    // a close grey beard on the jaw and chin, a moustache over the lip
    mouth: { name: 'Okafor · close grey beard', draw(H, ctx) { mouthLine(H, ctx, 20, -2, 1);
      for (let x = -6; x <= 5; x++) H.set(x, 19, 8, sp(x, 19, 8)); for (let x = -4; x <= 3; x++) H.set(x, 21, 8, sp(x, 21, 8));
      for (const x of [-6, -5, 4, 5]) { H.set(x, 20, 8, sp(x, 20, 8)); H.set(x, 21, 8, sp(x, 21, 8)); }
      for (const x of [-8, 7]) for (let y = 19; y <= 22; y++) for (let z = 2; z <= 7; z++) if (H.has(x, y, z) && z >= 7 - (22 - y) * 2) H.set(x, y, z, sp(x, y, z)); } },
    // a close crop, salt and pepper, with a parting shaved in on his left
    hair: { name: 'Okafor · close crop, a parting', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 28 : 26, at(23)), 1), sp);
      for (let z = -6; z <= 7; z++) A.cut(4, 34, z); A.commit(); } },
    eyewear: { name: 'Okafor · half-moon glasses', draw(H) { const F = 0x2a2420;
      for (let x = -7; x <= 6; x++) { if (x === -2 || x === 1) continue; H.set(x, 23, 8, F); } for (const x of [-7, -3, 2, 6]) H.set(x, 24, 8, F); H.set(-2, 24, 8, F); H.set(1, 24, 8, F);
      for (const x of [-9, 8]) for (let z = 3; z <= 7; z++) H.set(x, 24, z, F); } },
    // a tan work coat, open collar, three pens in the breast pocket
    top: { name: 'Okafor · tan work coat, pens', flank: 1, neckline: 'collar', draw(B, ctx) {
      shell(B, (x, y, z) => placket(x, z) ? shade(COAT, .82) : z >= FRONT && y === 15 && x >= 2 && x <= 4 ? shade(COAT, .86) : y === 9 ? shade(COAT, .84) : COAT, { neck: false });
      collarWings(B, COLLAR, FRONT, { open: true });
      sleeves(ctx, (lx, ly) => ly === 1 ? shade(COAT, .84) : COAT, { y0: 10 }); },
      fine(P) { for (const [hx, c] of [[4, 0x2850a8], [6, 0xc23040], [8, 0x1a1a1a]]) P.halfBox(hx, 32, 8, hx + 1, 34, 9, c); } },
    bottom: { name: 'Okafor · dark brown trousers', form: 'straight', color: TROUSER },
    shoes: { name: 'Okafor · brown shoes', last: 'lowline', paint: twoTone(0x5a3f2a, 0x2a2018, 1) },
  },
};
