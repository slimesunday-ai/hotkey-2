// THE NAMED CAST · a prop as the city draws one (style/city/props.js): its cells (index.js propCells) in a vox.js Vol at the prop's
// size (a half cell is 0.025 m × its owner's scale), the origin at its base's centre on the ground, its nose toward +z; meshed once and
// memoized, so the bank is a prop template like any other: stamp(bank, dst, rotQ, x, y, z) puts it in a block, packMerged(bank,
// [0, 0, 0]) gives the tier mesh a batch draws (the walkers' dogs, style/city/jobs.js jobPeds + peds.js). Worker-safe (no three).
//   propVol('the man with the shopping cart') · propBank('cart')      (a name, a name the owner goes by, or the prop's own key)
import { Vol, meshed } from '../../../style/city/vox.js';
import { propOf, propByKey, propCells, cellAt } from '../index.js';

const find = name => propByKey(name) || propOf(name);
export function propVol(name) {
  const P = find(name); if (!P) return null; const [lo, hi] = P.cells, s = P.s;
  const V = new Vol(hi[0] - lo[0] + 1, hi[1] + 1, hi[2] - lo[2] + 1, { s, org: [lo[0] * s, 0, lo[2] * s], ground: true });
  for (const [k, [c, l]] of propCells(P.src)) { const [x, y, z] = cellAt(k); V.set(x - lo[0], y, z - lo[2], c, l); }
  return V;
}
const memo = new Map();
export function propBank(name) {
  const P = find(name); if (!P) return null; let b = memo.get(P.key);
  if (!b) { memo.set(P.key, b = meshed(propVol(P.key))); b.kind = 'named-' + P.key; }
  return b;
}
