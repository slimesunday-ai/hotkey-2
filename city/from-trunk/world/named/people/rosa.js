// ROSA · a woman, 40s, compact and strong; runs the night shift at Low Tide Docks.
import { shade, lerpHex, two, shell, hair, hairShell, hairline, at, solid, rowsOf, ring, lips, skin } from '../kit.js';

const ORANGE = 0xe0701e, TANK = 0x3a3c41, BRACE = 0x151517, NAVY = 0x2c4a7c, BLACK = 0x1c1714;

export default {
  key: 'rosa', name: 'Rosa', aka: [], place: 'docks', scale: 0.97,
  who: 'A woman, 40s, compact and strong. Runs the night shift.',
  signature: ORANGE,
  palette: { tank: TANK, coverall: NAVY, brace: BRACE, hat: ORANGE },
  line: 'An orange hard hat over black hair in a bun, a charcoal tank and a back brace, the coverall\'s sleeves knotted at her waist; bare, strong arms.',
  changed: "The hard hat's brim is cut closer (the sheet's wide brim read as a sun hat up close); the bun shows under the back of the hat. Drawn 0.97 times.",
  pieces: {
    skin: skin('Rosa · warm brown', 0xb5815c, BLACK, { lash: 0x120c0a }),
    eyes: { name: 'Rosa · bright, a flick', rows: ['k....', '.WPP.', '.WPP.', '.....'], brow: ['.BBB.', 'B...B', '.....'], palette: { k: [0x120c0a, 0, 8] } },
    mouth: { name: 'Rosa · brick lip', draw(H) { lips(H, 0x9a3b34, { k: .8 }); } },
    // black hair pulled back into a bun low at the back, under the hat's brim
    hair: { name: 'Rosa · black, a bun', draw(H) { const A = hair(H), C = 0x1d1917;
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 28 : 26, at(22)), 1), C); A.ball(-.5, 25.5, -9.6, 2.8, 2.6, 2.2, two(C, .8)); A.commit(); } },
    hat: { name: 'Rosa · orange hard hat', draw(H) {
      ring(H, 30, [-10, 9, -9, 11, 2], [-9, 8, -8, 8], shade(ORANGE, .9));
      solid(H, { ...rowsOf(30, 33, [-9, 8, -8, 8, 2]), 34: [-8, 7, -7, 7, 2], 35: [-6, 5, -5, 5, 2] }, (x, y, z) => x >= -1 && x <= 0 && y >= 33 ? shade(ORANGE, .85) : ORANGE); } },
    // a charcoal tank, a black back brace (its straps over the shoulders, its belt round the waist), the coverall's navy sleeves
    // knotted round her waist
    top: { name: 'Rosa · tank, brace, sleeves knotted', flank: 0, neckline: 'bare', draw(B) {
      shell(B, (x, y, z) => y <= 11 ? BRACE : (Math.abs(z) >= 3 && (x === -3 || x === 2)) ? BRACE : TANK, { y0: 9, fl: 0 });
      for (let x = -5; x <= 4; x++) for (let z = -3; z <= 3; z++) if (Math.abs(z) === 3 || x === -5 || x === 4) B.set(x, 9, z, NAVY);
      for (const x of [-2, -1, 0, 1]) { B.set(x, 9, 4, NAVY); B.set(x, 10, 4, shade(NAVY, .8)); } },
      // the finer blocks: the brace's buckle on its belt, above the knot
      fine(P) { P.halfBox(-2, 22, 8, 2, 24, 9, 0x6a6c70); P.halfBox(-1, 22, 9, 1, 24, 10, 0x9a9ca0); } },
    bottom: { name: 'Rosa · navy coverall legs', form: 'baggy', color: NAVY, paint: q => q.y === 5 ? [0xd8dade, 1] : undefined },
    shoes: { name: 'Rosa · steel-toe boots', last: 'fullcourt', paint: q => q.region === 'sole' ? [0x2a2018, 0] : q.front ? [0x3a3a3c, 0] : [0xb8862f, 0] },
  },
};
