// SLIM · a man, 20s, very tall and thin; works the lunch crowd on Glasswall Plaza. Written only on the sheet: "curly hair, a cheap
// brown office suit with no tie, a newspaper folded under his arm (under the arm needs a hold of its own). Needs height to be Slim."
import { shade, lerpHex, rnd, shell, sleeves, collarWings, FRONT, hair, hairShell, hairline, at, grip, mouthLine, skin } from '../kit.js';

const SUIT = 0x966050, SUIT_D = shade(0x966050, .82), WHITE = 0xece8e0, CHESTNUT = 0x6a4428, PAPER = 0xe8e4d8;
const curl = (x, y, z) => { const r = rnd(x, y, z, 15); return r < .25 ? shade(CHESTNUT, .82) : r < .38 ? lerpHex(CHESTNUT, 0x8a5a36, .6) : CHESTNUT; };

export default {
  key: 'slim', name: 'Slim', aka: [], place: 'plaza', scale: 0.92,
  who: 'A man, 20s, very tall and thin. Works the lunch crowd.',
  signature: SUIT,
  palette: { suit: SUIT, shirt: WHITE, hair: CHESTNUT, paper: PAPER },
  line: 'A tall top of chestnut curls, a sideways look, a cheap reddish-brown office suit with no tie, a folded newspaper in his hand.',
  changed: 'Written only on the sheet, so all of it is new. Changed: the newspaper is held folded at his side (under the arm needs a hold the city does not have); drawn 0.92 times, as asked for the slight, so the height is in the tall curls and the narrow cut, not the size.',
  pieces: {
    skin: skin('Slim · fair', 0xd8ac88, 0x3a2418),
    // a sideways look (both eyes the same way: the second eye not mirrored)
    eyes: { name: 'Slim · a sideways look', mirror: false, rows: ['.....', '.LLL.', 'PPW..', '.....'], brow: ['.....', '.BBB.', '.....'] },
    mouth: { name: 'Slim · a smirk', draw(H, ctx) { mouthLine(H, ctx, 20, -2, 1); H.set(2, 21, 7, lerpHex(ctx.sk.c(2, 21, 7), ctx.sk.mouth, .55)); } },
    // a tall top of tight curls over close sides
    hair: { name: 'Slim · tall curly top', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 29 : 27, at(25)), (px, py, pz, ox, oy, oz) => oy > 0 ? 4 + (rnd(px, py, pz, 3) < .4 ? 1 : 0) : py >= 31 ? 2 : 1), curl, 0, .5); A.commit(); } },
    // a cheap brown suit, open on a white shirt with no tie, the shirt's cuffs showing
    top: { name: 'Slim · cheap brown suit, no tie', flank: 1, neckline: 'collar', draw(B, ctx) {
      shell(B, (x, y, z) => z >= FRONT && (x === -1 || x === 0) && y >= 11 ? WHITE : z >= FRONT && y === 12 && (x === -4 || x === 3) ? SUIT_D : y === 9 ? SUIT_D : SUIT, { neck: false,
        skip: (x, y, z) => y === 18 && x >= -1 && x <= 0 && z >= 1 });
      collarWings(B, WHITE, FRONT, { open: true });
      sleeves(ctx, (lx, ly) => ly === 1 ? WHITE : SUIT, { y0: 10 }); } },
    bottom: { name: 'Slim · the suit\'s trousers', form: 'slim', color: SUIT, paint: q => q.y === 4 ? SUIT_D : undefined },
    shoes: { name: 'Slim · cheap black shoes', last: 'lowline', paint: q => q.region === 'sole' ? [0x1a1a1a, 0] : q.front ? [0x4a4a4c, 0] : [0x222224, 1] },
    // a newspaper folded in half, held by its fold, hanging at his side
    held: { name: 'Slim · a folded newspaper', pose: 'down', draw(G, ctx) {
      grip(G, ctx, PAPER); for (const z of [-3, 2]) for (const y of [6, 7]) G.set(6, y, z, PAPER);
      for (let x = 6; x <= 7; x++) for (let y = 2; y <= 5; y++) for (let z = -3; z <= 2; z++) G.set(x, y, z, y === 5 ? shade(PAPER, .9) : PAPER); },
      fine(P) { for (const y of [2, 3, 4]) P.rect('+x', -3 * 4 + 1, y * 4 + 1, 3 * 4 - 1, y * 4 + 2, 0x8a8a86); P.rect('+x', -3 * 4 + 1, 4 * 4 + 3, 3 * 4 - 1, 5 * 4 + 1, 0x4a4a48); } },
  },
};
