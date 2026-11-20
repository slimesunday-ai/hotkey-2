// A RUNNER · a hire of the Sixes (a type, not a named person: every runner wears this). Written only on the sheet: "the Sixes' kit: a
// green bandana over the face, a black track jacket".
import { shade, lerpHex, rnd, shell, sleeves, FRONT, hbox, grip, mouthLine, skin } from '../kit.js';

const BLACK = 0x1c1c20, TEAL = 0x149696, GREEN = 0x2f8a4a, PAPER = 0xa88a5e;

export default {
  key: 'runner', name: 'A runner', aka: ['runner', 'a Sixes runner'], place: 'corner', scale: 0.96,
  who: 'A hire: a runner. A type.',
  signature: TEAL,
  palette: { jacket: BLACK, piping: TEAL, bandana: GREEN },
  line: 'A black track jacket with teal piping, its hood up with a teal stripe over the crown, the Sixes\' green bandana over the face; a small brown-paper parcel.',
  changed: 'Written only on the sheet, so the rest is new: the hood is up so the crown is the runner\'s (a black hood edged in teal with a teal stripe over the top, so it is not Teo\'s black hair; the green across the face), and he carries the parcel he runs.',
  pieces: {
    skin: skin('Runner · brown', 0x9a6440, 0x1a1210),
    eyes: { name: 'Runner · young, quick', rows: ['.....', '.WPP.', '.WPP.', '.....'], brow: ['.....', 'BBB..', '.....'] },
    mouth: { name: 'Runner · a line', draw(H, ctx) { mouthLine(H, ctx, 20, -2, 1); } },
    // the track jacket's hood up round the head (open at the face, teal on its edge), the green bandana tied over the nose and mouth
    hat: { name: 'Runner · hood up, green bandana', coversEars: true, cover: 'all', draw(H) {
      const inH = (x, y, z) => x >= -8 && x <= 7 && y >= 19 && y <= 33 && z >= -7 && z <= 7;
      for (let x = -10; x <= 9; x++) for (let y = 19; y <= 35; y++) for (let z = -10; z <= 9; z++) { if (inH(x, y, z)) continue;
        const ex = x < -9 || x > 8 ? 1 : 0, ey = y > 34 ? 1 : 0, ez = z < -8 ? 1 : 0; if (ex + ey + ez > 1) continue; if (z >= 8 && y <= 31 && x >= -7 && x <= 6) continue;
        if (z > 8) continue; if (y < 21 && z > 2) continue; H.set(x, y, z, z === 8 || (z === 7 && (x === -9 || x === 8)) || (y >= 34 && (x === -1 || x === 0)) || (z <= -9 && (x === -1 || x === 0)) ? TEAL : BLACK); }
      // the bandana: across the face from under the nose to the chin, round the sides, knotted at the back
      for (let x = -8; x <= 7; x++) for (const y of [19, 20, 21]) H.set(x, y, 8, (x + y) & 1 ? GREEN : shade(GREEN, .88));
      for (let x = -7; x <= 6; x++) H.set(x, 22, 8, shade(GREEN, .82));
      for (const y of [18]) for (let x = -5; x <= 4; x++) H.set(x, y, 7, shade(GREEN, .8)); } },
    // the black track jacket, zipped, teal piping down the sleeves and the zip
    top: { name: 'Runner · black track jacket', flank: 1, neckline: 'high', draw(B, ctx) {
      shell(B, (x, y, z) => z >= FRONT && x === -1 && y >= 10 ? TEAL : y === 9 ? shade(BLACK, .8) : BLACK, { neck: false });
      sleeves(ctx, (lx, ly, z) => ly === 1 ? shade(BLACK, .8) : lx === 0 && z >= 0 ? BLACK : (lx >= 1 && z === 0) ? TEAL : BLACK, { y0: 10, out: 1 }); } },
    bottom: { name: 'Runner · black track pants', form: 'slim', color: BLACK, paint: q => q.u === q.width - 1 && q.z === 0 ? TEAL : undefined },
    shoes: { name: 'Runner · white runners', last: 'tongue', paint: q => q.region === 'outsole' ? [0x2a2a2e, 0] : q.region === 'midsole' ? [0xf2f0ea, 0] : q.outer && q.y === 2 ? [TEAL, 0] : [0xe8e6e0, 0] },
    // a small brown-paper parcel held out front, tied with string
    held: { name: 'Runner · a parcel', pose: 'forward', draw(G, ctx) { grip(G, ctx, PAPER); hbox(G, ctx, 5, 8, 5, 8, 2, 4, (x, y, z) => (x === 6 || y === 7) ? shade(PAPER, .8) : PAPER); } },
  },
};
