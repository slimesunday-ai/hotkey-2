// NADIA PETRAKIS · a woman, 30s, lean; drives nights out of Low Tide Docks. Written only on the sheet: "dark hair cropped short, a
// burgundy quilted night-driver's jacket, a steel thermos on a strap across her chest, dark jeans, boots".
import { shade, lerpHex, rnd, two, shell, sleeves, FRONT, hair, hairShell, hairline, at, solid, rowsOf, circles, allFx, lips, skin } from '../kit.js';

const PLUM = 0x822460, PLUM_D = shade(0x822460, .82), CAP = 0x1c1c20, MESH = 0xb8bcc0, STRAP = 0x2a2a2e, STEEL = 0x9aa0a6, JEANS = 0x2a3348;

export default {
  key: 'nadia', name: 'Nadia Petrakis', aka: ['Nadia', 'Petrakis'], place: 'docks', scale: 1.0,
  who: 'A woman, 30s, lean. Drives nights.',
  signature: PLUM,
  palette: { jacket: PLUM, cap: CAP, mesh: MESH, jeans: JEANS },
  line: 'A black trucker\'s cap with a pale mesh back over dark cropped hair, a plum-burgundy quilted jacket, a steel thermos on a strap across her chest.',
  changed: 'Written only on the sheet. Added: the trucker\'s cap (black front, pale mesh back, no lettering), because dark cropped hair from above is half the city; the burgundy leans plum so it is not Mr. Booker\'s oxblood cap.',
  pieces: {
    skin: skin('Nadia · olive', 0xd0a888, 0x2a1e1a, { lash: 0x1e1614 }),
    // tired night-shift eyes: a lash flick, faint shadows under them
    eyes: { name: 'Nadia · night-tired', rows: ['k....', '.LLL.', '.WPP.', '.....'], brow: ['.....', '.BBBB', '.....'], palette: { k: [0x1e1614, 0, 8] }, fx: allFx(circles(23, .22)) },
    mouth: { name: 'Nadia · a muted lip', draw(H) { lips(H, 0x9c5a58, { k: .8 }); } },
    hair: { name: 'Nadia · dark crop', draw(H) { const A = hair(H); A.grow(hairShell(hairline(at(31), pz => pz >= 2 ? 26 : 24, at(22)), 1), two(0x2a1e1a, .8)); A.commit(); } },
    // a trucker's cap: a black foam front, a pale mesh back (checked open and shut), a curved black bill
    hat: { name: 'Nadia · trucker\'s cap', draw(H) {
      const col = (x, y, z) => z >= 1 ? CAP : ((x + y + z) & 1 ? MESH : shade(MESH, .78));
      solid(H, { ...rowsOf(30, 33, [-9, 8, -8, 8, 2]), 34: [-8, 7, -7, 7, 2], 35: [-6, 5, -6, 6, 2] }, col);
      solid(H, { 30: [-7, 6, 9, 12, 2] }, CAP); H.set(-1, 36, 0, CAP); H.set(0, 36, 0, CAP); } },
    // a quilted night-driver's jacket, padded in rows, zipped, collar up
    top: { name: 'Nadia · plum quilted jacket', flank: 1, neckline: 'high', puffy: true, draw(B, ctx) {
      shell(B, (x, y, z) => z >= 4 && x === -1 && y >= 10 ? 0x3a2a30 : (y & 1) ? PLUM : PLUM_D, { d: 4, neck: false });
      for (let x = -5; x <= 4; x++) B.set(x, 18, -5, PLUM_D);
      sleeves(ctx, (lx, ly) => ly === 1 ? PLUM_D : (ly & 1) ? PLUM : PLUM_D, { y0: 10, out: 1, pad: 2 }); } },
    // a strap across her chest from her right shoulder, a steel thermos hanging on it at her left hip
    acc: { name: 'Nadia · thermos on a strap', draw(B, ctx) { ctx.as('torso');
      for (const z of [-4, -3, -2, -1, 0, 1, 2, 3, 4]) if (B.has(-4, 18, z)) B.set(-4, 18, z, STRAP);
      const path = [[-4, 17], [-3, 16], [-2, 15], [-1, 14], [0, 13], [1, 12], [2, 12]];
      for (const [x, y] of path) { const zf = ctx.chestFront(x, y) ?? 4; B.set(x, y, zf + 1, STRAP); }
      for (let y = 9; y <= 11; y++) for (const x of [2, 3]) { const zf = ctx.chestFront(x, y) ?? 4; B.set(x, y, zf + 1, y === 11 ? 0x2a2a2e : STEEL); B.set(x, y, zf + 2, y === 11 ? 0x2a2a2e : shade(STEEL, .9)); } } },
    bottom: { name: 'Nadia · dark jeans', form: 'straight', color: JEANS },
    shoes: { name: 'Nadia · black boots', last: 'fullcourt', paint: q => q.region === 'sole' ? [0x111113, 0] : [0x262628, 0] },
  },
};
