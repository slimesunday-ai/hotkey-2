// COUSIN EARL · a man, 40s, broad; sells cartons out of his truck in the trailer park.
import { shade, lerpHex, rnd, two, check, shell, sleeves, collarWings, FRONT, placket, hair, hairShell, hairline, at, hbox, grip, mouthLine, twoTone, skin } from '../kit.js';

const SANDY = 0xc09a5c, DENIM = 0x4f6f9a, FRAY = 0xc5d0dd, RED = 0xa8362e, CREAM = 0xe0d4bc, MAROON = 0x6a2420;
const plaid = check(RED, CREAM, MAROON, 1);

export default {
  key: 'earl', name: 'Cousin Earl', aka: ['Earl'], place: 'park', scale: 1.06,
  who: 'A man, 40s, broad.',
  signature: SANDY,
  palette: { jacket: DENIM, shirt: RED, pants: 0x5a4632, boots: 0xb08848, hair: SANDY },
  line: 'A sandy mullet and a horseshoe moustache, a toothpick, a cut-off denim jacket over red plaid; a carton of cigarettes.',
  changed: 'The toothpick is a thin pick in the finer blocks; the mullet hangs past the collar at the back; the carton is held through the fist. Drawn 1.06 times.',
  pieces: {
    skin: skin('Earl · sunburnt', 0xdc9c7c, 0x9c7a46),
    eyes: { name: 'Earl · squint', rows: ['.....', '.LLL.', '.WPP.', '.....'], brow: ['.....', 'BBBB.', '.....'] },
    // the horseshoe moustache down both sides of the mouth; a toothpick out of the left corner
    // (the pick crosses the moustache's right drop at the mouth's row, in the finer blocks: half a block thick)
    mouth: { name: 'Earl · horseshoe moustache', draw(H, ctx) { const M = 0xb08a4e;
      mouthLine(H, ctx, 20, -2, 1); for (let x = -4; x <= 3; x++) H.set(x, 21, 8, M); for (const y of [19, 20]) H.set(-4, y, 8, M); H.set(3, 19, 8, M); },
      fine(P) { P.halfBox(4, 40, 16, 11, 41, 17, 0xdcc89a); } },
    hair: { name: 'Earl · sandy mullet', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(31), pz => pz >= -1 ? 28 : 20, at(19)), (px, py, pz, ox, oy, oz) => oz < 0 && py < 28 ? 2 : 1), two(SANDY, .86)); A.commit();
      // the business at the back: down past the collar line, well behind the shoulders (z −9..−8: the body's back is z −4 at most)
      const T = hair(H, { floor: 17 });
      for (let x = -6; x <= 5; x++) for (const y of [17, 18]) for (const z of [-9, -8]) if (!(y === 17 && (x === -6 || x === 5))) T.put(x, y, z, two(SANDY, .84)(x, y, z));
      T.commit(); } },
    // a denim jacket with the sleeves cut off (frayed at the armholes) over a red plaid work shirt
    top: { name: 'Earl · cut-off denim, red plaid', neckline: 'collar', draw(B, ctx) {
      shell(B, (x, y, z) => placket(x, z) ? plaid(x + 8, y) : (x <= -6 || x >= 5) && y >= 14 ? FRAY : z >= FRONT && y >= 13 && y <= 14 && ((x >= -4 && x <= -2) || (x >= 1 && x <= 3)) ? shade(DENIM, .8) : y === 9 ? shade(DENIM, .8) : DENIM, { neck: false });
      collarWings(B, RED, FRONT, { open: true });
      sleeves(ctx, (lx, ly, z) => ly === 1 ? MAROON : plaid(lx + z + 8, ly), { y0: 10 }); },
      fine(P) { for (const [qa, qb] of [[-5 * 4, 16 * 4], [4 * 4, 16 * 4], [-5 * 4, 15 * 4], [4 * 4, 15 * 4]]) P.rect('+z', qa, qb, qa + 4, qb + 1, FRAY); } },
    bottom: { name: 'Earl · canvas work pants, buckle', form: 'baggy', color: 0x5a4632, waist: 0x2a211a,
      paint: q => q.y === 10 && q.z >= 1 && (q.u === -1 || q.u === 0) ? [0xc8a24a, 1] : undefined },
    shoes: { name: 'Earl · tan work boots', last: 'fullcourt', paint: q => q.region === 'sole' ? [0x2a2018, 0] : [0xb08848, 0] },
    // a carton of cigarettes, white with a red band, through the fist
    held: { name: 'Earl · a carton of cigarettes', pose: 'forward', draw(G, ctx) { const W = 0xf1eee6, R = 0xc23a2e;
      grip(G, ctx, W); hbox(G, ctx, 5, 8, 5, 8, -3, 4, (x, y, z) => z === 0 || z === 1 ? R : W); } },
  },
};
