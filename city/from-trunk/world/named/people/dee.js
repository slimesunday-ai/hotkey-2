// SHAKY DEE · a man, 40s, slight and bony; buys his cigarettes one at a time at the bus stop.
import { shade, lerpHex, rnd, two, shell, sleeves, hair, hairShell, hairline, at, circles, furrow, allFx, mouthLine, skin } from '../kit.js';

const HOSP = 0x84b2d2, HOSP_D = shade(HOSP, .82), ZIP = 0xeef2f4;

export default {
  key: 'dee', name: 'Shaky Dee', aka: ['Dee'], place: 'park', scale: 0.9,
  who: 'A man, 40s, slight and bony.',
  signature: HOSP,
  palette: { windbreaker: HOSP, sweats: 0x3c3c41, sneakers: 0xbdb8ad },
  line: 'A pale hospital-blue windbreaker two sizes too big, the hood up, on the smallest man on the street.',
  changed: 'Drawn 0.9 times: the slight one is now smaller than the people round him.',
  pieces: {
    skin: skin('Dee · sallow', 0xcdae90, 0x2c241f),
    // worried brows, dark circles, a furrowed brow
    eyes: { name: 'Dee · worried, dark circles', rows: ['.....', '.WPP.', '.WPP.', '.....'], brow: ['...BB', '.BB..', '.....'], fx: allFx(circles(23, .45), furrow(.84)) },
    mouth: { name: 'Dee · a tight frown', draw(H, ctx) { mouthLine(H, ctx, 20, -2, 1); for (const x of [-3, 2]) H.set(x, 19, 7, lerpHex(ctx.sk.c(x, 19, 7), ctx.sk.mouth, .5)); } },
    mark: { name: 'Dee · stubble', draw(H, ctx) {
      for (let x = -8; x <= 7; x++) for (let y = 19; y <= 22; y++) for (let z = 1; z <= 7; z++) {
        const face = z === 7, side = (x === -8 || x === 7) && z <= 6; if (!face && !side) continue;
        if (face && y >= 20 && x >= -3 && x <= 2) continue; if (!H.has(x, y, z) || rnd(x, y, z, 4) > .45) continue;
        H.set(x, y, z, lerpHex(ctx.sk.c(x, y, z), 0x3a332e, .22), ctx.sk.layer || 0); } } },
    // lank dark hair to the jaw (most of it under the hood; a hank shows on the forehead)
    hair: { name: 'Dee · lank, to the jaw', coversEars: true, draw(H) { const A = hair(H, { ears: true }), C = 0x3b3129;
      A.grow(hairShell(hairline(at(30), () => 20, at(19)), 1), two(C, .82, .35));
      A.box(-7, 30, 8, -2, 31, 8, C); A.box(-6, 29, 8, -4, 29, 8, C); A.commit(); } },
    // the windbreaker's hood, up: a loose shell round the head, open at the face, the drawstrings hanging
    hat: { name: 'Dee · the hood, up', coversEars: true, draw(H) {
      const inH = (x, y, z) => x >= -8 && x <= 7 && y >= 19 && y <= 33 && z >= -7 && z <= 7;
      for (let x = -10; x <= 9; x++) for (let y = 19; y <= 35; y++) for (let z = -10; z <= 9; z++) { if (inH(x, y, z)) continue;
        const ex = x < -9 || x > 8 ? 1 : 0, ey = y > 34 ? 1 : 0, ez = z < -8 ? 1 : 0; if (ex + ey + ez > 1) continue; if (z >= 8 && y <= 31 && x >= -7 && x <= 6) continue;
        if (z > 8) continue; if (y < 21 && z > 2) continue; H.set(x, y, z, z === 8 || (z === 7 && (x === -9 || x === 8)) ? HOSP_D : HOSP); } },
      fine(P) { for (const hx of [-6, 4]) P.halfBox(hx, 38, 16, hx + 1, 42, 17, ZIP); } },
    // two sizes too big: the padded shell and sleeves (two proud), the zip down the front
    top: { name: 'Dee · oversized windbreaker', flank: 2, neckline: 'collar', puffy: true, draw(B, ctx) {
      shell(B, (x, y, z) => z >= 4 && x === -1 && y >= 10 ? ZIP : y === 9 ? HOSP_D : HOSP, { fl: 2, d: 4, neck: false });
      for (let x = -4; x <= 3; x++) for (const y of [17, 18]) B.set(x, y, -5, shade(HOSP, .86));
      sleeves(ctx, (lx, ly) => ly === 1 ? HOSP_D : ly === 2 ? shade(HOSP, .92) : HOSP, { y0: 10, out: 1, pad: 2, fl: 2 }); } },
    bottom: { name: 'Dee · faded black sweats', form: 'slim', color: 0x3c3c41, paint: q => (q.y === 6 || q.y === 7) && q.z >= 1 ? 0x56565c : q.y === 4 ? 0x2e2e33 : undefined },
    shoes: { name: 'Dee · grubby sneakers', last: 'tongue', paint: q => q.region === 'outsole' ? [0x77736c, 0] : q.region === 'midsole' ? [0xc9c4b8, 0] : [0xbdb8ad, 0] },
  },
};
