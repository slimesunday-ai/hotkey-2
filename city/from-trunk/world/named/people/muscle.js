// MUSCLE · a hire of the Sixes (a type, not a named person: every hired heavy wears this). Written only on the sheet: "the Sixes'
// kit: a green tank under an open black work shirt. Wants the big body."
import { shade, lerpHex, rnd, two, shell, sleeves, FRONT, hair, hairShell, hairline, at, mouthLine, skin } from '../kit.js';

const GREEN = 0x2f8a4a, SHIRT = 0x404044, SHIRT_D = shade(0x404044, .8), TROUSER = 0x2e3034;

export default {
  key: 'muscle', name: 'Muscle', aka: ['muscle', 'a Sixes heavy'], place: 'corner', scale: 1.12,
  who: 'A hire: muscle. A type.',
  signature: SHIRT,
  palette: { shirt: SHIRT, tank: GREEN, trousers: TROUSER },
  line: 'A short mohawk dyed the Sixes\' green down a shaved head; a green tank under an open charcoal work shirt, the sleeves rolled on big arms.',
  changed: 'Written only on the sheet, so the rest is new: the crown is a green-dyed mohawk on a shaved head (the crew\'s colour worn as a stripe, apart from Big Moss\'s band and the lookout\'s cap); drawn 1.12 times, big but not Big Moss\'s size.',
  pieces: {
    skin: skin('Muscle · dark brown', 0x5a3a28, 0x120e0c),
    eyes: { name: 'Muscle · flat, heavy', rows: ['.....', 'LLLL.', '.WPP.', '.....'], brow: ['.....', 'BBBBB', '.....'] },
    mouth: { name: 'Muscle · a set line', draw(H, ctx) { mouthLine(H, ctx, 20, -3, 2); } },
    // the head shaved to a dark shadow, a short mohawk down the middle dyed the Sixes' green
    hair: { name: 'Muscle · green mohawk', draw(H) { const A = hair(H);
      for (let z = -7; z <= 7; z++) for (let x = -2; x <= 1; x++) { A.put(x, 34, z, rnd(x, 34, z, 3) < .3 ? shade(GREEN, .82) : GREEN); if (x >= -1 && x <= 0 && z >= -5 && z <= 6) A.put(x, 35, z, shade(GREEN, 1.08)); }
      for (let x = -2; x <= 1; x++) { A.put(x, 33, 8, GREEN); for (let y = 29; y <= 33; y++) A.put(x, y, -8, shade(GREEN, .85)); } A.commit(); } },
    mark: { name: 'Muscle · shaved sides', draw(H, ctx) { for (let x = -8; x <= 7; x++) for (let z = -7; z <= 7; z++) for (let y = 28; y <= 33; y++) { const s = (x === -8 || x === 7 || z === -7 || (z === 7 && y >= 30) || y === 33); if (s && H.has(x, y, z)) H.set(x, y, z, lerpHex(ctx.sk.c(x, y, z), 0x0c0a08, .3)); } } },
    // a green tank under an open charcoal work shirt, its short sleeves rolled
    top: { name: 'Muscle · open work shirt, green tank', flank: 1, neckline: 'collar', draw(B, ctx) {
      shell(B, (x, y, z) => z >= FRONT && x >= -2 && x <= 1 ? (y >= 17 ? GREEN : shade(GREEN, (x + y) & 1 ? 1 : .92)) : y === 9 ? SHIRT_D : SHIRT, { neck: false,
        skip: (x, y, z) => y === 18 && x >= -1 && x <= 0 && z >= 1 });
      for (const x of [-4, -3, 2, 3]) B.set(x, 18, FRONT + 1, SHIRT_D);
      sleeves(ctx, (lx, ly) => ly === 4 ? SHIRT_D : SHIRT, { y0: 13 }); } },
    bottom: { name: 'Muscle · dark work trousers', form: 'baggy', color: TROUSER },
    shoes: { name: 'Muscle · black high-tops', last: 'tongue', paint: q => q.region === 'outsole' ? [0x111113, 0] : q.region === 'midsole' ? [0xe8e4dc, 0] : [0x18181a, 0] },
  },
};
