// MRS. KOWALSKI · a woman, 60s, solid; the clothes rail at the night market. The sheet's brown skirt and dark stockings are now
// trousers (the owner, 2026-11-18: no skirts or dresses): brown slacks under the long knitted coat.
import { shade, lerpHex, rnd, shell, sleeves, FRONT, placket, hair, hairShell, hairline, at, crows, allFx, lips, skin, twoTone } from '../kit.js';

const COAT = 0x5a9664, COAT_D = shade(0x5a9664, .86), COPPER = 0xa83c28, TAPE = 0xe2c23a, PIN = 0xc8302e, SLACKS = 0x5a4232;
const curl = (x, y, z) => { const r = rnd(x, y, z, 5); return r < .3 ? shade(COPPER, .78) : r < .45 ? lerpHex(COPPER, 0xe07040, .35) : COPPER; };

export default {
  key: 'kowalski', name: 'Mrs. Kowalski', aka: ['Kowalski'], place: 'market', scale: 1.0,
  who: 'A woman, 60s, solid. The clothes rail.',
  signature: COAT,
  palette: { coat: COAT, hair: COPPER, slacks: SLACKS, tape: TAPE },
  line: 'Dyed copper-red hair set in tight curls, a long moss-green knitted coat with a yellow tape measure round her neck, a red pincushion on her wrist.',
  changed: 'Lost the brown skirt and dark stockings: brown slacks under the knitted coat, which carries on over her thighs. The copper is a deeper red than Hook\'s ginger; the pincushion now shows, its pins in the finer blocks.',
  pieces: {
    skin: skin('Kowalski · fair', 0xeac6ae, 0x9a4a2e, { lash: 0x2a1a16 }),
    eyes: { name: 'Kowalski · lashed, lined', rows: ['kkk..', '.WPP.', '.WPP.', '.....'], brow: ['.BBB.', 'B....', '.....'], palette: { k: [0x2a1a16, 0, 8] }, fx: allFx(crows(.8, [23, 25, 26])) },
    mouth: { name: 'Kowalski · coral lipstick', draw(H) { lips(H, 0xc04a40); } },
    // dyed copper-red, set in tight curls: a rough shell, two deep on top and at the sides
    hair: { name: 'Kowalski · copper-red set curls', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(31), pz => pz >= 3 ? 27 : 25, at(24)), (px, py, pz) => (py >= 32 ? 2 : 1) + (rnd(px, py, pz, 5) < .5 ? 1 : 0)), curl); A.commit(); } },
    // a long knitted coat (knit texture, a V neck, the placket darker), a yellow tape measure hung round the neck and down the front
    top: { name: 'Kowalski · knitted coat, tape measure', flank: 2, neckline: 'vee', draw(B, ctx) {
      shell(B, (x, y, z) => placket(x, z) ? COAT_D : (x + z + y) & 1 ? COAT : shade(COAT, .93), { fl: 2, neck: false,
        skip: (x, y, z) => (y === 18 && x >= -2 && x <= 1 && z >= 1) || (y === 17 && x >= -1 && x <= 0 && z >= 3) });
      for (const x of [-3, 2]) for (let y = 12; y <= 17; y++) B.set(x, y, FRONT + 1, (y & 1) ? TAPE : shade(TAPE, .88));
      for (let x = -3; x <= 2; x++) if (x < -1 || x > 0) B.set(x, 18, FRONT + 1, TAPE);
      sleeves(ctx, (lx, ly) => ly === 1 ? COAT_D : COAT, { y0: 10, out: 1, fl: 2 }); } },
    // a red pincushion strapped on her left wrist, pins stuck in it
    acc: { name: 'Kowalski · pincushion on the wrist', draw(B, ctx) { ctx.as('armL');
      for (const y of [10, 11]) for (const z of [-1, 0]) B.set(9, y, z, PIN); },
      fine(P) { for (const [hy, hz, c] of [[23, -1, 0xf0e050], [21, 1, 0x4a80d0], [22, -2, 0xf2f0ea]]) P.half(20, hy, hz, c); } },
    bottom: { name: 'Kowalski · the coat, brown slacks', form: 'straight', color: SLACKS, paint: q => q.y >= 6 ? (q.u === -1 ? COAT_D : ((q.x + q.y + q.z) & 1 ? COAT : shade(COAT, .93))) : undefined },
    shoes: { name: 'Kowalski · brown shoes', last: 'lowline', paint: twoTone(0x6a4a30, 0x2a2018, 1) },
  },
};
