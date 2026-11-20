// THE MAN WITH THE SHOPPING CART · a man, 60s, wiry; a buyer in the night market's crowd (the game calls him "a man with a shopping
// cart"). Written only on the sheet: "a long grey beard, layers of coats with a red collar showing, a mustard woolly hat with a bobble.
// His cart, rattling with cans, is a prop that walks with him, not something in his hand."
import { shade, lerpHex, rnd, two, shell, sleeves, FRONT, hair, at, knit, bags, crows, allFx, beardBelow, mouthLine, skin } from '../kit.js';

const MUSTARD = 0xb8962e, COAT = 0x7a6a4e, PATCH = 0x5e5440, CARDI = 0x8a8a86, RED = 0xa83030, TROUSER = 0x5a554c;
const BEARD = 0xc8c4bc, BEARD_D = 0x9a968e, NICOTINE = 0xc8bc98;
const beardC = (x, y, z) => { const r = rnd(x, y, z, 13); return r < .22 ? BEARD_D : r < .32 ? NICOTINE : BEARD; };

export default {
  key: 'cart', name: 'The man with the shopping cart', aka: ['a man with a shopping cart', 'the cart man', 'cart'], place: 'market', scale: 0.96,
  who: 'A man, 60s, wiry.',
  signature: MUSTARD,
  palette: { coat: COAT, cardigan: CARDI, collar: RED, hat: MUSTARD },
  line: 'A mustard woolly hat with a bobble, grey hair straggling from under it, a long grey beard down his coats; coats in layers, a red collar at the neck.',
  changed: 'Written only on the sheet, so all of it is new. The long beard hangs down his chest under the beard rule; the cart is a prop that walks beside him, not one of his pieces, so his hands are empty until the city gives him the cart.',
  pieces: {
    skin: skin('Cart · weathered', 0xc89070, 0xa8a49c),
    eyes: { name: 'Cart · weary, bushy brows', rows: ['.....', '.LLL.', '.WPP.', '.....'], brow: ['.....', 'BBBB.', '.BBBB'], fx: allFx(bags(.8, { z: 8 }), crows(.78)) },
    // THE BEARD: long and grey, over the jaw and down his chest to the third button (kit.js § A BEARD THAT HANGS)
    mouth: { name: 'Cart · a long grey beard', draw(H, ctx) {
      mouthLine(H, ctx, 20, -2, 1);
      for (let y = 19; y <= 22; y++) for (let z = 1; z <= 7; z++) for (const x of [-8, 7]) { if (y === 22 && z < 5) continue; if (H.has(x, y, z)) H.set(x, y, z, beardC(x, y, z)); }
      for (let y = 19; y <= 21; y++) for (let x = -8; x <= 7; x++) { if (y >= 20 && x >= -3 && x <= 2) continue; if (H.has(x, y, 7)) H.set(x, y, 7, beardC(x, y, 7)); }
      for (let x = -4; x <= 3; x++) H.set(x, 21, 8, beardC(x, 21, 8));
      for (const x of [-7, -6, -5, -4, -3, 2, 3, 4, 5, 6]) H.set(x, 20, 8, beardC(x, 20, 8));
      for (let x = -7; x <= 6; x++) H.set(x, 19, 8, beardC(x, 19, 8));
      const W = { 18: [-7, 6], 17: [-6, 5], 16: [-6, 5], 15: [-5, 4], 14: [-5, 4], 13: [-4, 3], 12: [-2, 1] };
      beardBelow(H, 12, (x, y) => (x >= W[y][0] && x <= W[y][1]) ? [y === 18 ? 5 : 6, 8] : null, beardC); },
      fine(P) { for (let y = 12; y <= 17; y++) for (let x = y === 12 ? -2 : -3; x <= (y === 12 ? 1 : 2); x++) { const s = (x + y) & 1 ? 1 : 2; P.rect('+z', x * 4 + s, y * 4, x * 4 + s + 1, y * 4 + 4, BEARD_D); } } },
    // grey hair straggling out from under the hat at the sides and the back
    hair: { name: 'Cart · grey, straggling', draw(H) { const A = hair(H);
      A.grow((px, py, pz, ox, oy, oz) => oy > 0 ? 0 : py >= 22 && py <= 29 && (ox !== 0 || oz < 0) ? (rnd(px, py, pz, 2) < .5 ? 2 : 1) : 0, two(0xb4b0a8, .86, .4)); A.commit(); } },
    // the mustard woolly hat, its cuff rolled, a bobble on top
    hat: { name: 'Cart · mustard bobble hat', draw(H) { const A = MUSTARD;
      knit(H, 29, [-9, 8, -8, 8, 2], 35, A, shade(A, .86));
      for (let x = -2; x <= 1; x++) for (let z = -2; z <= 1; z++) for (let y = 36; y <= 38; y++) { if ((x === -2 || x === 1) && (z === -2 || z === 1) && y !== 37) continue; H.set(x, y, z, rnd(x, y, z, 3) < .4 ? shade(A, .9) : lerpHex(A, 0xf0e0a0, .3)); } } },
    // coats in layers: a worn brown overcoat open on a grey cardigan, a red collar at the neck; patches
    top: { name: 'Cart · layers of coats', flank: 2, neckline: 'high', puffy: true, draw(B, ctx) {
      shell(B, (x, y, z) => { if (z >= 4 && x >= -2 && x <= 1) return y >= 17 ? RED : CARDI; if (y >= 17 && Math.abs(z) <= 3 && (x === -3 || x === 2)) return RED;
        if ((x === -6 && y >= 11 && y <= 12) || (x === 5 && y >= 14 && y <= 15 && z <= 0)) return PATCH; return rnd(x, y, z, 21) < .12 ? shade(COAT, .88) : COAT; }, { fl: 2, d: 4, neck: false });
      for (let x = -5; x <= 4; x++) B.set(x, 18, -5, shade(COAT, .86));
      sleeves(ctx, (lx, ly) => ly === 1 ? CARDI : ly === 2 ? shade(COAT, .8) : COAT, { y0: 10, out: 1, pad: 2, fl: 2 }); } },
    bottom: { name: 'Cart · patched trousers', form: 'baggy', color: TROUSER, paint: q => q.z === q.z1 && q.u >= 1 && q.u <= 2 && (q.y === 6 || q.y === 7) && q.side === -1 ? 0x6e6450 : undefined },
    shoes: { name: 'Cart · taped boots', last: 'fullcourt', paint: q => q.region === 'sole' ? [0x2a2018, 0] : q.front && q.y <= 2 ? [0xa8aaa8, 0] : [0x5a4030, 0] },
  },
};
