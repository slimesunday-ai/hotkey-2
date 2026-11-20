// DARLENE · a woman, 60s, small and upright; runs the trailer park's office. The sheet's navy pleated skirt and tights are now
// trousers (the owner, 2026-11-18: no skirts or dresses): navy pressed slacks with a crease, over the same navy pumps.
import { shade, lerpHex, rnd, two, shell, sleeves, collarWings, FRONT, placket, hair, hairShell, hairline, at, grip, crows, allFx, lips, skin, twoTone } from '../kit.js';

const LILAC = 0xa784cc, WHITE = 0xf3f0ea, SILVER = 0xcbc4dc, NAVY = 0x2f3550, PINK = 0xe0559a;

export default {
  key: 'darlene', name: 'Darlene', aka: [], place: 'park', scale: 0.93,
  who: 'A woman, 60s, small and upright. Runs the park office.',
  signature: LILAC,
  palette: { cardigan: LILAC, collar: WHITE, slacks: NAVY, perm: SILVER },
  line: 'A tight silver perm, half-moon readers on a beaded chain and a lilac cardigan with pearl buttons; the office keys on a pink coil.',
  changed: "Lost the navy pleated skirt and tights: navy pressed slacks with a crease down the front, the navy pumps kept. The perm is set higher and carries a lilac rinse, so it is not the crowd's grey set curls. Drawn 0.93 times.",
  pieces: {
    skin: skin('Darlene · fair', 0xefcfba, 0xb3aea8, { lash: 0x241a1c }),
    eyes: { name: 'Darlene · lashed, arched brow', rows: ['kkkk.', '.WPP.', '.WPP.', '.....'], brow: ['.BBB.', 'B...B', '.....'], palette: { k: [0x241a1c, 0, 8] }, fx: allFx(crows(.8, [23, 25, 26])) },
    mouth: { name: 'Darlene · brick lipstick', draw(H) { lips(H, 0x9a3b34); } },
    // a tight perm set high and round (a bouffant: three deep on top, two at the temples), silver with the lilac rinse of a weekly set:
    // a lilac-silver nobody else has (the crowd's grandmothers wear a flat, warm grey set)
    hair: { name: 'Darlene · tight silver perm', draw(H) { const A = hair(H);
      A.grow(hairShell(hairline(at(31), pz => pz >= 3 ? 27 : 25, at(24)), (px, py, pz) => (py >= 33 ? 3 : py >= 29 ? 2 : 1) + (rnd(px, py, pz, 5) < .45 ? 1 : 0)),
        (x, y, z) => { const r = rnd(x, y, z, 2); return r < .28 ? 0xa79dbd : r < .46 ? 0xe2deec : SILVER; }); A.commit(); } },
    // half-moon readers low on the nose, lilac frames, a beaded chain from the arms down behind the jaw
    eyewear: { name: 'Darlene · readers on a beaded chain', draw(H) { const F = 0x6b4c7a, B = [0xe2c84a, 0x5aa0c8, 0xd0607a];
      for (let x = -7; x <= 6; x++) { if (x === -2 || x === 1) continue; H.set(x, 23, 8, F); } for (const x of [-7, -3, 2, 6]) H.set(x, 24, 8, F); H.set(-2, 24, 8, F); H.set(1, 24, 8, F);
      for (const x of [-9, 8]) for (let z = 3; z <= 7; z++) H.set(x, 24, z, F);
      for (const x of [-9, 8]) { let k = 0; for (let y = 23; y >= 19; y--) H.set(x, y, 3, B[k++ % 3]); } } },
    // a lilac cardigan buttoned over a white blouse, its collar out; pearl buttons in the finer blocks
    top: { name: 'Darlene · lilac cardigan, white collar', neckline: 'collar', draw(B, ctx) {
      shell(B, (x, y, z) => placket(x, z) ? shade(LILAC, .88) : y === 9 ? shade(LILAC, .86) : LILAC, { neck: false });
      collarWings(B, WHITE, FRONT); sleeves(ctx, (lx, ly) => ly === 1 ? shade(LILAC, .84) : LILAC, { y0: 10 }); },
      fine(P) { for (const y of [10, 12, 14, 16]) P.halfBox(-1, 2 * y + 1, 8, 1, 2 * y + 2, 9, 0xf4f0e8, 1); } },
    // navy pressed slacks, a crease down the front of each leg
    bottom: { name: 'Darlene · navy pressed slacks', form: 'straight', color: NAVY, paint: q => q.z === q.z1 && q.u === 1 ? 0x3c4364 : undefined },
    shoes: { name: 'Darlene · navy pumps', last: 'lowline', paint: twoTone(0x232a44, 0x15151a, 1) },
    held: { name: 'Darlene · office keys on a pink coil', pose: 'down', draw(G, ctx) { const Br = 0xc9a24e;
      grip(G, ctx, PINK); for (const [y, z] of [[7, 2], [6, 2], [5, 2], [5, 3], [4, 3], [4, 2], [3, 2]]) G.set(6, y, z, PINK);
      for (const [y, z] of [[2, 1], [2, 2], [2, 3], [3, 3]]) G.set(6, y, z, Br, 1); G.set(7, 2, 1, Br, 1); G.set(7, 3, 2, Br, 1); G.set(6, 3, 1, 0x5aa0c8); } },
  },
};
