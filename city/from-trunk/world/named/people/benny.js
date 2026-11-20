// BENNY TWO-COATS · a man, 50s, heavy-set; owes the park office.
import { shade, lerpHex, hash3, rnd, two, fleck, shell, sleeves, FRONT, placket, hair, bags, crows, allFx, mouthLine, twoTone, skin } from '../kit.js';

const TWEED = 0x6b4f35, TWEED_F = 0x94744e, PARKA = 0x4f7040, GREY = 0x9b968e;
const tw = fleck(TWEED, TWEED_F);

export default {
  key: 'benny', name: 'Benny Two-Coats', aka: ['Benny'], place: 'park', scale: 1.08,
  who: 'A man, 50s, heavy-set.',
  signature: PARKA,
  palette: { overcoat: TWEED, parka: PARKA, trousers: 0x45403a, shoes: 0x5a3f2a },
  line: 'Two coats at once: a brown tweed overcoat buttoned over a green parka, its collar and cuffs showing; a grey comb-over.',
  changed: 'The comb-over shows pink scalp between the grey strands, so it reads from above; three raised horn buttons on the overcoat (finer blocks). Drawn 1.08 times.',
  pieces: {
    skin: skin('Benny · ruddy', 0xd8a886, 0x8f8a84),
    eyes: { name: 'Benny · heavy-browed, bags', rows: ['.....', '.WPP.', '.WPP.', '.....'], brow: ['.....', 'BBBB.', '.BBBB'], fx: allFx(bags(.8, { z: 8 }), crows(.8)) },
    mouth: { name: 'Benny · a set frown', draw(H, ctx) { mouthLine(H, ctx); for (const x of [-3, 2]) H.set(x, 19, 7, lerpHex(ctx.sk.c(x, 19, 7), ctx.sk.mouth, .5)); } },
    mark: { name: 'Benny · stubble', draw(H, ctx) {
      for (let x = -8; x <= 7; x++) for (let y = 19; y <= 22; y++) for (let z = 1; z <= 7; z++) {
        const face = z === 7, side = (x === -8 || x === 7) && z <= 6; if (!face && !side) continue;
        if (face && y >= 20 && x >= -3 && x <= 2) continue; if (!H.has(x, y, z) || rnd(x, y, z, 4) > .45) continue;
        H.set(x, y, z, lerpHex(ctx.sk.c(x, y, z), 0x4a423c, .22), ctx.sk.layer || 0); } } },
    // a grey comb-over: the sides and back short, long strands laid across the top with the pink scalp between them
    hair: { name: 'Benny · grey comb-over', draw(H) { const A = hair(H);
      A.grow((px, py, pz, ox, oy, oz) => oy > 0 ? 0 : py >= 22 && py <= 30 && (ox !== 0 || oz < 0) ? 1 : 0, two(GREY, .88));
      for (const z of [-6, -4, -2, 0, 2, 4]) for (let x = -9; x <= 7; x++) A.put(x, 34, z, z === 4 ? shade(GREY, .9) : GREY);
      A.commit(); } },
    // tweed buttoned over a green parka: the parka's collar ring and cuffs show
    top: { name: 'Benny · two coats', flank: 2, neckline: 'high', puffy: true, draw(B, ctx) {
      shell(B, (x, y, z) => y === 18 ? PARKA : placket(x, z) && y < 18 ? shade(TWEED, .85) : tw(x, y, z), { fl: 2, d: 4, neck: false });
      for (let x = -4; x <= 3; x++) { B.set(x, 18, -5, PARKA); B.set(x, 17, -5, shade(PARKA, .85)); }
      sleeves(ctx, (lx, ly, z) => ly <= 1 ? PARKA : ly === 2 ? shade(TWEED, .78) : tw(lx, ly, z), { y0: 10, out: 2, pad: 2, fl: 2 }); },
      // the finer blocks: the overcoat's three horn buttons, raised, and one done up wrong (the top one sits a half step off)
      fine(P) { for (const [hy, hx] of [[24, -1], [30, -1], [35, 0]]) P.halfBox(hx, hy, 10, hx + 2, hy + 2, 11, 0x2a1f18); } },
    // the overcoat carried on over the legs; worn trousers under it
    bottom: { name: 'Benny · the overcoat, worn trousers', form: 'straight', color: TWEED, paint: q => q.y >= 6 ? (q.u === -1 ? shade(TWEED, .82) : tw(q.x, q.y, q.z)) : 0x45403a },
    shoes: { name: 'Benny · worn brown shoes', last: 'lowline', paint: twoTone(0x5a3f2a, 0x2a2018) },
  },
};
