// DUTCH · a woman, late 30s, rangy and tall; a lookout for the Sixes.
import { shade, lerpHex, rnd, two, shell, sleeves, FRONT, placket, hair, hairShell, hairline, at, grip, RING2, sq3, lips, skin, twoTone } from '../kit.js';

const BLONDE = 0xf1e6c8, BLONDE_D = 0xd2c196, COAT = 0x222327, GREEN = 0x2f8a4a, JEANS = 0x4a4d55;

export default {
  key: 'dutch', name: 'Dutch', aka: [], place: 'market', scale: 1.05,
  who: 'A woman, late 30s, rangy and tall. A lookout for the Sixes.',
  signature: BLONDE,
  palette: { coat: COAT, jeans: JEANS, hair: BLONDE, sixes: GREEN },
  line: 'White-blonde hair in one hard braid brought forward over a long black coat, tied off in the Sixes\' green.',
  changed: "The braid lies on the coat's front from the shoulder down (it rides the chest, so it never cuts the swinging arm); a centre parting and a fuller back, so the hair reads as long and pulled back. Drawn 1.05 times.",
  pieces: {
    skin: skin('Dutch · pale', 0xecd4c3, 0xd6c79a, { lash: 0x3a3030 }),
    // hard lids; the nose broken once and healed crooked (the bridge one voxel off)
    eyes: { name: 'Dutch · hard, a broken nose', rows: ['k....', 'LLLL.', '.WPP.', '.....'], brow: ['.....', '.BBBB', 'B....'], palette: { k: [0x3a3030, 0, 8] },
      fx(F, ctx) { for (const [x, y] of [[0, 23], [1, 22]]) F.set(x, y, 8, ctx.shade(ctx.sk.c(x, y, 8), .9), ctx.sk.layer); } },
    mouth: { name: 'Dutch · a hard mouth', draw(H) { lips(H, 0xa8706a, { k: .78 }); } },
    // pulled back hard, gathered behind the left ear into the braid
    // long hair dragged straight back from a centre parting (a darker line over the crown), full at the back, gathered behind the
    // left ear into the braid
    hair: { name: 'Dutch · white-blonde, pulled back', draw(H) { const A = hair(H, { ears: true });
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 28 : 25, at(21)), (px, py, pz, ox, oy, oz) => oz < 0 ? 2 : 1),
        (x, y, z) => (y >= 34 && (x === -1 || x === 0) && z >= -3) ? BLONDE_D : rnd(x, y, z, 8) < .22 ? shade(BLONDE, .9) : BLONDE);
      A.ball(8.6, 21.5, -3.2, 1.6, 2.6, 2.4, (x, y, z) => (y & 1) ? BLONDE_D : BLONDE);
      A.commit(); } },
    // THE BRAID: brought forward over her left shoulder and down the coat's front, plaited, tied off in green (it lies on the chest:
    // an accessory riding the torso, at most two proud of the coat)
    acc: { name: 'Dutch · the braid', draw(B, ctx) { ctx.as('torso');
      // a three-strand plait: each row one strand crosses (the light cell steps across), three wide over the shoulder, two lower down
      const pl = (x, y, x0) => (x - x0) === (y % 3) ? BLONDE : (x - x0 + y) % 3 === 1 ? BLONDE_D : shade(BLONDE, .94);
      for (let z = -2; z <= 3; z++) for (const x of [2, 3, 4]) if (B.has(x, 18, z)) B.set(x, 18, z, pl(x, 18 + z, 2));
      for (let y = 12; y <= 17; y++) for (const x of [2, 3, 4]) { if (y <= 13 && x === 2) continue; const zf = ctx.chestFront(x, y) ?? FRONT; B.set(x, y, zf + 1, pl(x, y, 2)); }
      for (const x of [3, 4]) { B.set(x, 11, (ctx.chestFront(x, 11) ?? FRONT) + 1, GREEN); B.set(x, 10, (ctx.chestFront(x, 10) ?? FRONT) + 1, x === 3 ? BLONDE_D : BLONDE); } } },
    // a long black work coat, collar up, the Sixes' green knotted at her throat
    top: { name: 'Dutch · long black work coat', flank: 1, neckline: 'high', draw(B, ctx) {
      shell(B, (x, y, z) => placket(x, z) && y >= 16 ? GREEN : placket(x, z) ? shade(COAT, .75) : COAT, { neck: false });
      for (let x = -5; x <= 4; x++) B.set(x, 18, -4, COAT); for (const x of [-5, -4, 3, 4]) { B.set(x, 18, 4, COAT); B.set(x, 17, 4, COAT); }
      sleeves(ctx, (lx, ly) => ly === 1 ? shade(COAT, .8) : COAT, { y0: 10 }); } },
    bottom: { name: 'Dutch · the coat, grey jeans', form: 'straight', color: COAT, paint: q => q.y >= 5 ? (q.u === -1 ? shade(COAT, .7) : COAT) : JEANS },
    shoes: { name: 'Dutch · black boots', last: 'fullcourt', paint: twoTone(0x1f1f22, 0x111113) },
    held: { name: 'Dutch · a big paper coffee', pose: 'raised', draw(G, ctx) { const W = 0xf1efe9, K = 0x1b1b1e;
      grip(G, ctx, W); for (const [x, y] of RING2) G.set(x, y, 2, GREEN); G.set(6, 7, 2, GREEN); G.set(5, 7, 2, GREEN); G.set(5, 8, 2, GREEN); G.set(6, 8, 2, GREEN); sq3(G, 3, W); sq3(G, 4, K); } },
  },
};
