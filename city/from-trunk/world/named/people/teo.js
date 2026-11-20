// TEO · a man, 20s, skinny; sells bootleg discs from a duffel in the night market's back row (the connect).
import { shade, lerpHex, rnd, two, shell, sleeves, FRONT, placket, hair, hairShell, hairline, at, bx, grip, hangers, stubble, mouthLine, skin } from '../kit.js';

const GREY = 0x6c7076, GREY_D = shade(0x6c7076, .8), ORANGE = 0xd06a28, OLIVE = 0x4a4e3a, DUFFEL = 0x55603e, CREAM = 0xe8e0c8, BLACK = 0x1d1a18;

export default {
  key: 'teo', name: 'Teo', aka: [], place: 'market', scale: 0.95,
  who: 'A man, 20s, skinny. Bootleg discs from a duffel.',
  signature: GREY,
  palette: { jacket: GREY, lining: ORANGE, pants: OLIVE, duffel: DUFFEL },
  line: 'Long black hair tied up in a big top-knot, a grey hooded work jacket with the hood down on its orange lining, the olive duffel he never puts down.',
  changed: 'The top-knot is bigger and tied off in orange, so his crown is not every black head; the hood lies down behind his neck showing its orange; the duffel is full size inside the hand\'s reach and rounded; drawn 0.95 times.',
  pieces: {
    skin: skin('Teo · tan', 0xc89a72, 0x1a1512),
    eyes: { name: 'Teo · narrowed', rows: ['.....', '.LLL.', '.WPP.', '.....'], brow: ['.....', 'BBBB.', '.....'] },
    mouth: { name: 'Teo · a line', draw(H, ctx) { mouthLine(H, ctx, 20, -2, 1); } },
    mark: stubble('Teo · stubble', 0x2a2420, .24, .45),
    // long black hair pulled up into a big knot on top, combed lines running up to it
    hair: { name: 'Teo · big top-knot', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 27 : 25, at(22)), 1), (x, y, z) => ((x + 16) % 3 === 0) ? shade(BLACK, 1.6) : BLACK);
      A.ball(-.5, 36.6, -1.2, 3, 2.6, 3, two(BLACK, 1.4, .3));
      // the knot tied off in the orange of his hood's lining
      for (let x = -3; x <= 2; x++) for (let z = -4; z <= 1; z++) { const e = ((x + .5) / 3.2) ** 2 + ((z + 1.5) / 3.2) ** 2; if (e <= 1 && e > .4) A.put(x, 35, z, ORANGE); } A.commit(); } },
    // a grey hooded work jacket, zipped, two chest pockets; the hood down behind the neck, its orange lining up
    top: { name: 'Teo · grey work jacket, orange hood', flank: 1, neckline: 'hood', draw(B, ctx) {
      shell(B, (x, y, z) => placket(x, z) ? GREY_D : z >= FRONT && y === 15 && ((x >= -4 && x <= -2) || (x >= 1 && x <= 3)) ? GREY_D : y === 9 ? shade(GREY, .85) : GREY, { neck: false });
      for (let x = -5; x <= 4; x++) { B.set(x, 16, -4, GREY); B.set(x, 17, -5, GREY); B.set(x, 18, -5, x === -5 || x === 4 ? GREY : ORANGE); B.set(x, 18, -4, ORANGE); B.set(x, 17, -4, ORANGE); }
      sleeves(ctx, (lx, ly) => ly === 1 ? GREY_D : GREY, { y0: 10 }); } },
    bottom: { name: 'Teo · olive work pants', form: 'straight', color: OLIVE },
    shoes: { name: 'Teo · grubby black sneakers', last: 'tongue', paint: q => q.region === 'outsole' ? [0x5a5650, 0] : q.region === 'midsole' ? [0xb8b2a6, 0] : [0x2a2a2c, 0] },
    // the duffel: long and round (its four long edges left off), a cream stripe round it, darker ends, handles up to the fist
    held: { name: 'Teo · the duffel', pose: 'down', draw(G, ctx) {
      bx(G, 5, 8, 2, 5, -4, 3, (x, y, z) => z === -4 || z === 3 ? shade(DUFFEL, .82) : y === 4 ? CREAM : DUFFEL);
      for (const x of [5, 8]) for (const y of [2, 5]) for (let z = -4; z <= 3; z++) G.del(x, y, z);
      hangers(G, shade(DUFFEL, .7)); grip(G, ctx, shade(DUFFEL, .7)); },
      fine(P) { P.rect('+y', 7 * 4 + 1, -4 * 4 + 2, 7 * 4 + 2, 3 * 4 + 2, 0x2a2e22); } },
  },
};
