// BIG LOU · a man, 50s, very large; drives a semi off Low Tide Docks and sleeps in his cab.
// The owner's call on the mock-up (2026-11-18: "looks like there's an error or something off"): drop the neck pillow; bald; a proper
// grey beard on the chin; the blue-and-black trucker's flannel; big jeans; tan boots; drawn bigger than everyone else.
import { shade, lerpHex, rnd, check, shell, sleeves, collarWings, FRONT, bags, crows, allFx, both, beardBelow, mouthLine, twoTone, skin } from '../kit.js';

// the buffalo check: blue ground, black bars, black where they cross
const BLUE = 0x2b54a0, MID = 0x1f3466, BLACK = 0x111318;
const plaid = check(MID, BLUE, BLACK);
// the beard
const GREY = 0xa9a49b, GREY_D = 0x86817a, GREY_L = 0xcac5bc;
const beardC = (x, y, z) => { const r = rnd(x, y, z, 9); return r < .24 ? GREY_D : r < .40 ? GREY_L : GREY; };
const SKIN = 0xd3a07f;

export default {
  key: 'lou', name: 'Big Lou', aka: ['Lou'], place: 'docks', scale: 1.25,
  who: 'A man, 50s, very large. Sleeps in his cab.',
  signature: BLUE,
  palette: { flannel: BLUE, black: BLACK, denim: 0x3f5582, boots: 0x8f5f36, beard: GREY },
  line: 'The biggest man in the city: a bald, tanned dome, a short grey beard and a blue-and-black buffalo-check flannel.',
  changed: 'As you asked: no neck pillow; bald; the grey block under the nose is now a full short beard round the chin and jaw, hanging a little below it; the flannel, big jeans and tan boots; drawn 1.25 times, bigger than anyone.',
  pieces: {
    skin: skin('Lou · weathered', SKIN, 0x8f8a84, { mouth: 0x5a3328 }),
    // small eyes under a heavy grey brow; bags, crow's feet; a ruddy nose and cheeks from the road
    eyes: { name: 'Lou · small, heavy-browed', rows: ['.....', '.LLL.', '.WPP.', '.....'], brow: ['.....', 'BBBBB', '.BBBB'],
      fx: allFx(bags(.8), crows(.78), both((F, ctx, m) => { for (const [x, y] of [[-7, 22], [-6, 22], [-6, 21]]) F.set(m(x), y, 7, lerpHex(ctx.sk.c(m(x), y, 7), 0xc0604a, .22), ctx.sk.layer); })) },
    // bald: the dome tanned by the cab's side window and polished (gloss), a shade browner than his face; from above a big tan dome,
    // not Mr. Pruitt's pale pink crown or Hook's ginger buzz (a recolour: no relief)
    mark: { name: 'Lou · the bald dome', draw(H, ctx) { const TAN = 0xb27a52;
      for (let x = -8; x <= 7; x++) for (let z = -7; z <= 7; z++) if (H.has(x, 33, z)) H.set(x, 33, z, lerpHex(ctx.sk.c(x, 33, z), TAN, .3), 1);
      for (let y = 30; y <= 32; y++) for (let z = -7; z <= 6; z++) for (const x of [-8, 7]) if (H.has(x, y, z)) H.set(x, y, z, ctx.sk.c(x, y, z), 1);
      for (let y = 30; y <= 32; y++) for (let x = -8; x <= 7; x++) for (const z of [-7, 7]) if (H.has(x, y, z)) H.set(x, y, z, ctx.sk.c(x, y, z), 1);
    } },
    // THE BEARD: a full short grey beard over the chin and the jaw, a moustache meeting it, the mouth a dark line between; it hangs two
    // rows below the chin (the named cast's beard rule, kit.js § A BEARD THAT HANGS)
    mouth: { name: 'Lou · short grey beard', draw(H, ctx) {
      mouthLine(H, ctx, 20, -2, 1);
      // the jaw's sides, recoloured (no relief): the beard wraps round to the ear's line
      for (let y = 19; y <= 22; y++) for (let z = 1; z <= 7; z++) for (const x of [-8, 7]) { if (y === 22 && z < 5) continue; if (H.has(x, y, z)) H.set(x, y, z, beardC(x, y, z)); }
      for (let y = 19; y <= 21; y++) for (let x = -8; x <= 7; x++) { if (y >= 20 && x >= -3 && x <= 2) continue; if (H.has(x, y, 7)) H.set(x, y, 7, beardC(x, y, 7)); }
      // one proud: the moustache and the beard's front
      for (let x = -4; x <= 3; x++) H.set(x, 21, 8, beardC(x, 21, 8));
      for (const x of [-7, -6, -5, 4, 5, 6]) { H.set(x, 21, 8, beardC(x, 21, 8)); H.set(x, 20, 8, beardC(x, 20, 8)); }
      for (const x of [-4, -3, 2, 3]) H.set(x, 20, 8, beardC(x, 20, 8));
      for (let x = -7; x <= 6; x++) H.set(x, 19, 8, beardC(x, 19, 8));
      // below the chin: three rows, rounding in to a short point
      beardBelow(H, 16, (x, y) => y === 18 ? (x >= -7 && x <= 6 ? [4, 8] : null) : y === 17 ? (x >= -6 && x <= 5 ? [5, 8] : null) : (x >= -3 && x <= 2 ? [6, 8] : null), beardC);
    },
    // the finer blocks: the beard's strands, a lighter and a darker one running down each face of its front
    fine(P) { const rows = { 19: [-7, 6], 18: [-7, 6], 17: [-6, 5], 16: [-3, 2] };
      for (const [ys, [x0, x1]] of Object.entries(rows)) { const y = +ys; for (let x = x0; x <= x1; x++) { const s = (x + y) & 1 ? 0 : 2, a = x * 4, b = y * 4;
        P.rect('+z', a + s, b, a + s + 1, b + 3, GREY_L); P.rect('+z', a + 3 - s, b + 1, a + 4 - s, b + 4, GREY_D); } } } },
    // the trucker's flannel: a blue-and-black buffalo check, buttoned, a collar, long sleeves; worn loose over the jeans
    top: { name: 'Lou · blue buffalo flannel', flank: 2, neckline: 'collar', draw(B, ctx) {
      shell(B, (x, y, z) => y === 9 ? shade(plaid(x + z + 9, y), .86) : plaid(x + z + 9, y), { fl: 2, neck: false });
      collarWings(B, MID, FRONT);
      sleeves(ctx, (lx, ly, z) => ly === 1 ? BLACK : plaid(lx + z + 9, ly + 1), { y0: 10, out: 1, fl: 2 });
    },
    fine(P) { for (const y of [11, 13, 15]) P.rect('+z', 0, y * 4 + 1, 2, y * 4 + 3, 0xd8d4c8); } },
    // big jeans: the baggy leg, a mid denim faded on the thighs
    bottom: { name: 'Lou · big jeans', form: 'baggy', color: 0x3f5582, waist: 0x2a241e,
      paint: q => q.y === 4 ? 0x33466c : q.z === q.z1 && q.u >= 1 && q.u <= 2 && q.y >= 6 && q.y <= 8 ? 0x52689a : undefined },
    shoes: { name: 'Lou · tan work boots', last: 'fullcourt', paint: q => q.region === 'sole' ? [0x2a2018, 0] : q.y === 3 && q.z >= 1 ? [0x6a4426, 0] : [0x8f5f36, 0] },
  },
};
