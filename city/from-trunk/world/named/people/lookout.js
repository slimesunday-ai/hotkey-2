// A LOOKOUT · a hire of the Sixes (a type, not a named person: every lookout wears this). Written only on the sheet: "one of the
// Sixes' own kit: a green knit cap and a grey parka".
import { shade, lerpHex, rnd, two, shell, sleeves, FRONT, hair, hairShell, hairline, at, knit, grip, sq3, mouthLine, skin, twoTone } from '../kit.js';

const CAP = 0x6ec878, PARKA = 0x7a7e84, PARKA_D = shade(0x7a7e84, .84), FUR = 0xb8a88c, JEANS = 0x2a3346;

export default {
  key: 'lookout', name: 'A lookout', aka: ['lookout', 'a Sixes lookout'], place: 'corner', scale: 1.0,
  who: 'A hire: a lookout for the Sixes. A type, not a named person.',
  signature: CAP,
  palette: { parka: PARKA, fur: FUR, jeans: JEANS, cap: CAP },
  line: 'The Sixes\' green as a bright knit cap, a grey parka with a fur-trimmed hood down behind the neck, a walkie-talkie held up.',
  changed: 'Written only on the sheet, so the rest is new: the cap is a brighter knit green than Big Moss\'s band, so the two are not one crown; the parka\'s hood is down, its fur round the collar; the walkie-talkie is what a lookout does.',
  pieces: {
    skin: skin('Lookout · brown', 0x8a5a3c, 0x1a1210),
    // eyes cut to the side, always watching the street (both the same way: the second eye not mirrored)
    eyes: { name: 'Lookout · watching the side', mirror: false, rows: ['.....', '..LLL', '..WPP', '.....'], brow: ['.....', '.BBB.', '.....'] },
    mouth: { name: 'Lookout · a flat line', draw(H, ctx) { mouthLine(H, ctx, 20, -2, 1); } },
    hair: { name: 'Lookout · close dark hair', draw(H) { const A = hair(H); A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 28 : 26, at(24)), 1), 0x1a1412); A.commit(); } },
    // the knit cap: a ribbed cuff rolled over the ears' tops, the crown pulled down snug
    hat: { name: 'Lookout · green knit cap', draw(H) { knit(H, 29, [-9, 8, -8, 8, 2], 35, CAP, shade(CAP, .86)); } },
    // a grey parka, padded, zipped; its fur-trimmed hood lying down behind the neck
    top: { name: 'Lookout · grey parka, fur hood down', flank: 2, neckline: 'high', puffy: true, draw(B, ctx) {
      shell(B, (x, y, z) => z >= 4 && (x === -1) && y >= 10 ? 0x3a3c40 : y === 9 ? PARKA_D : (y === 12 || y === 15) ? PARKA_D : PARKA, { fl: 2, d: 4, neck: false });
      for (let x = -5; x <= 4; x++) for (const y of [16, 17, 18]) B.set(x, y, -5, y === 16 ? PARKA_D : PARKA);
      for (let x = -6; x <= 5; x++) for (const y of [17, 18]) B.set(x, y, -6, two(FUR, .85, .4)(x, y, -6));
      for (const x of [-6, 5]) for (let z = -5; z <= -3; z++) B.set(x + (x < 0 ? -1 : 1), 18, z, two(FUR, .85, .4)(x, 18, z));
      sleeves(ctx, (lx, ly) => ly === 1 ? PARKA_D : PARKA, { y0: 10, out: 1, pad: 2, fl: 2 }); } },
    bottom: { name: 'Lookout · dark jeans', form: 'straight', color: JEANS },
    shoes: { name: 'Lookout · black sneakers', last: 'tongue', paint: q => q.region === 'outsole' ? [0x1a1a1c, 0] : q.region === 'midsole' ? [0xe8e4dc, 0] : [0x222226, 0] },
    // a black walkie-talkie held up by the face, its stubby aerial
    held: { name: 'Lookout · a walkie-talkie', pose: 'raised', draw(G, ctx) { const K = 0x1c1c20;
      grip(G, ctx, K); sq3(G, 2, K); sq3(G, 3, shade(K, 1.3)); G.set(7, 8, 4, K); },
      fine(P) { P.rect('+z', 5 * 4 + 2, 6 * 4 + 1, 7 * 4 + 2, 7 * 4 + 3, 0x3a3e44); P.paint('+z', 7 * 4 + 1, 8 * 4 + 1, 0xd04030); } },
  },
};
