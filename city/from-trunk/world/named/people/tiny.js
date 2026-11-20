// TINY · a man, 30s, very big (the name is the joke, never the body); a buyer in the night market's crowd. Written only on the sheet:
// "a small red knit cap on a big head, an extra-large burnt-orange hoodie, a plastic bag of something heavy".
import { shade, lerpHex, rnd, two, shell, sleeves, hair, hairShell, hairline, at, knit, bx, grip, hangers, mouthLine, skin, twoTone } from '../kit.js';

const RED = 0xe62846, HOOD = 0xb85a22, HOOD_D = shade(0xb85a22, .82), JOG = 0x3a3c42, BAG = 0xe6e4dc;

export default {
  key: 'tiny', name: 'Tiny', aka: [], place: 'market', scale: 1.22,
  who: 'A man, 30s, very big. (The name is the joke, never the body.)',
  signature: RED,
  palette: { hoodie: HOOD, joggers: JOG, cap: RED, bag: BAG },
  line: 'A small cherry-red knit cap perched on top of a big head, an extra-large burnt-orange hoodie, a white plastic bag of something heavy.',
  changed: 'Written only on the sheet, so all of it is new: the cap sits high and small on the head (the joke is in the cap, not the body), the hoodie\'s hood lies down behind his neck, the bag hangs heavy, cans showing through. Drawn 1.22 times: the second biggest after Big Lou.',
  pieces: {
    skin: skin('Tiny · warm brown', 0xa8724e, 0x1a1412),
    // easy eyes, an easy smile: a gentle big man
    eyes: { name: 'Tiny · easy', rows: ['.....', '.WPP.', '.WPP.', '.....'], brow: ['.....', '.BBB.', '.....'] },
    mouth: { name: 'Tiny · an easy smile', draw(H, ctx) { mouthLine(H, ctx, 20, -2, 1); for (const x of [-3, 2]) H.set(x, 21, 7, lerpHex(ctx.sk.c(x, 21, 7), ctx.sk.mouth, .55)); } },
    // close black hair, round the sides under the cap
    hair: { name: 'Tiny · close black hair', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 28 : 26, at(24)), 1), two(0x1a1614, .85)); A.commit(); } },
    // the small red knit cap, perched on the crown: its cuff only reaches the top of the head
    hat: { name: 'Tiny · small red knit cap', draw(H) { knit(H, 33, [-5, 4, -5, 4, 2], 36, RED, shade(RED, .84)); H.set(-1, 37, -1, shade(RED, .9)); H.set(0, 37, -1, shade(RED, .9)); } },
    // the extra-large hoodie: padded wide, the hood down in a roll behind the neck, a kangaroo pocket, the drawstrings
    top: { name: 'Tiny · XL burnt-orange hoodie', flank: 2, neckline: 'hood', puffy: true, draw(B, ctx) {
      shell(B, (x, y, z) => y === 9 ? HOOD_D : z >= 4 && y >= 10 && y <= 12 && x >= -3 && x <= 2 ? (y === 12 ? HOOD_D : shade(HOOD, .93)) : HOOD, { fl: 2, d: 4, neck: false });
      for (let x = -5; x <= 4; x++) for (const y of [17, 18]) B.set(x, y, -5, y === 18 ? HOOD_D : HOOD);
      for (let x = -4; x <= 3; x++) B.set(x, 18, -6, HOOD_D);
      sleeves(ctx, (lx, ly) => ly === 1 ? HOOD_D : HOOD, { y0: 10, out: 2, pad: 2, fl: 2 }); },
      fine(P) { for (const hx of [-3, 1]) P.halfBox(hx, 28, 10, hx + 1, 34, 11, 0xf0ece0); } },
    bottom: { name: 'Tiny · charcoal joggers', form: 'baggy', color: JOG, paint: q => q.y === 4 ? shade(JOG, .8) : undefined },
    shoes: { name: 'Tiny · big white sneakers', last: 'tongue', paint: q => q.region === 'outsole' ? [0x8a8680, 0] : q.region === 'midsole' ? [0xf4f2ec, 0] : q.region === 'tongue' ? [0xd8d4cc, 0] : [0xece8e0, 0] },
    // a white plastic bag, stretched by something heavy (cans, their shapes through the plastic)
    held: { name: 'Tiny · a bag of something heavy', pose: 'down', draw(G, ctx) {
      bx(G, 5, 8, 2, 5, -3, 2, (x, y, z) => y === 5 ? shade(BAG, .9) : (x === 8 && (y === 3 || y === 4) && (z === -2 || z === 1)) ? 0xb8bcc4 : BAG); hangers(G, BAG); grip(G, ctx, BAG); },
      fine(P) { for (const z of [-2, 0]) P.rect('+x', z * 4 + 1, 2 * 4 + 2, z * 4 + 7, 4 * 4 + 2, (a, b) => ((a + b) & 3) === 0 ? 0xc8ccd2 : BAG); } },
  },
};
