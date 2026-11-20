// MR. PRUITT · a man, 60s, tall and stooped; the trailer park's yard sale.
import { shade, lerpHex, check, shell, sleeves, collarWings, FRONT, hair, two, bx, grip, hangers, bags, allFx, mouthLine, skin, twoTone } from '../kit.js';

const RED = 0xc0302c, BLUE = 0x6d8fbe, PALE = 0xe8ecf2, DEEP = 0x45648f, WHITE = 0xeeeae2;
const ck = check(BLUE, PALE, DEEP, 1);

export default {
  key: 'pruitt', name: 'Mr. Pruitt', aka: ['Pruitt'], place: 'park', scale: 1.05,
  who: 'A man, 60s, tall and stooped.',
  signature: RED,
  palette: { shirt: BLUE, slacks: 0xa89a78, shoes: 0x6a4a30, suspenders: RED, box: 0x4f7a5a },
  line: 'A bald pink crown with two white tufts, brown bifocals, red suspenders and the green yard-sale cash box.',
  changed: "The white tufts are fuller and stand out past the ears, so from above the crown is his and not any bald man's. Drawn 1.05 times.",
  pieces: {
    skin: skin('Pruitt · pink', 0xe9c2aa, 0xe2ded6),
    // small peering eyes under bushy white brows; bags
    eyes: { name: 'Pruitt · peering, bushy brows', rows: ['.....', '..PP.', '..PP.', '.....'], brow: ['BBBB.', 'BBBBB', '.....'], fx: allFx(bags(.84, { xs: [-6, -5, -4, -3] })) },
    mouth: { name: 'Pruitt · pursed', draw(H, ctx) { mouthLine(H, ctx, 20, -1, 0); } },
    // bald on top; white tufts over the ears, standing out past them
    hair: { name: 'Pruitt · white side tufts', coversEars: false, draw(H) { const A = hair(H, { ears: true });
      for (const s of [-1, 1]) { const x0 = s < 0 ? -9 : 8, x1 = s < 0 ? -10 : 9;
        A.ball(s < 0 ? -9.2 : 9.2, 29.2, -1.2, 1.6, 1.8, 2.6, two(WHITE, .9, .35), 0, 1.2);
        for (let y = 27; y <= 30; y++) for (let z = -5; z <= 1; z++) A.put(x0, y, z, two(WHITE, .9)(x0, y, z));
        for (let z = -5; z <= -2; z++) for (const y of [26, 27]) A.put(x0, y, z, WHITE); }
      // round the back, low
      for (let x = -8; x <= 7; x++) for (const y of [27, 28, 29]) A.put(x, y, -8, two(WHITE, .9)(x, y, -8));
      A.commit(); } },
    eyewear: { name: 'Pruitt · brown bifocals', draw(H) { const F = 0x6f5236;
      for (let x = -8; x <= 7; x++) { if (x === -2 || x === 1) continue; H.set(x, 26, 8, F); H.set(x, 22, 8, F); }
      for (const x of [-8, -3, 2, 7]) for (const y of [23, 24, 25]) H.set(x, y, 8, F);
      for (const x of [-9, 8]) for (let z = 3; z <= 7; z++) H.set(x, 25, z, F); },
      fine(P) { for (const [a0, a1] of [[-7 * 4, -3 * 4], [3 * 4, 7 * 4]]) P.rect('+z', a0, 23 * 4 + 3, a1, 24 * 4, 0x8a6a48); } },
    // a short-sleeved blue check shirt buttoned to the top, red suspenders front and back
    top: { name: 'Pruitt · check shirt, red suspenders', neckline: 'collar', draw(B, ctx) {
      shell(B, (x, y, z) => (Math.abs(z) >= FRONT && (x === -3 || x === 2) && y >= 9) ? RED : ck(x + 8, y + (z < 0 ? 1 : 0)), { neck: false });
      collarWings(B, PALE, FRONT);
      sleeves(ctx, (lx, ly, z) => ly === 4 ? DEEP : ck(lx + z + 8, ly), { y0: 13 }); },
      fine(P) { for (const x of [-3, 2]) P.rect('+z', x * 4, 9 * 4 + 1, x * 4 + 4, 9 * 4 + 3, 0xc9c3b0); } },
    // high-waisted khaki slacks, a yellow tape measure clipped on the right hip
    bottom: { name: 'Pruitt · high khaki slacks', form: 'straight', color: 0xa89a78, waist: 0x3a2a20,
      paint: q => q.side === 1 && q.u >= 2 && q.y >= 8 && q.z >= 0 ? [0xe2b72e, 1] : undefined },
    shoes: { name: 'Pruitt · brown lace-ups', last: 'lowline', paint: twoTone(0x6a4a30, 0x2a2018, 1) },
    held: { name: 'Pruitt · the yard-sale cash box', pose: 'down', draw(G, ctx) { const C = 0x4f7a5a, H = 0x2b2b2e;
      bx(G, 5, 8, 2, 5, -3, 2, (x, y, z) => y === 5 ? shade(C, .85) : C, 1); G.set(8, 3, 0, 0xc9a24e, 1); hangers(G, H); grip(G, ctx, H); } },
  },
};
