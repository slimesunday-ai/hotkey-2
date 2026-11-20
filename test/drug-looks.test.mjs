// THE DRUG LOOKS' BODIES, MEASURED (looks-1; demo/stage/looks/poses.js): no browser. What the owner has complained of
// in the game's animation, held as numbers: feet that slide, heads that whip round, bodies in the ground or floating
// over it, an arm through the big head, and a body that is not itself again when a look is taken off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lookPose, lowest, MOVES } from '../demo/stage/looks/poses.js';
import { fk, RIG, V } from '../demo/fight/puppet/rig.js';

const DT = 1 / 60;
/** the root's transform of a body-frame point (the rig's own, poses.js root) */
const root = (P, p) => {
  const piv = [P.px, P.py, P.pz];
  return V.add(V.add(piv, V.rY(P.ry, V.rX(P.rx, V.rZ(P.rz, V.sub(p, piv))))), [P.mx, P.my, P.mz]);
};
const footAt = (P, f, sx) => root(P, [sx * RIG.hipX, f[1], f[0]]);
/** the head's facing on the ground (its yaw), from its front */
const headYaw = P => {
  const F = fk(P);
  return Math.atan2(F.fwd[0], F.fwd[2]);
};
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/** Every frame of a look: on for `hold` s after its start, then taken off (null: it ends by itself). */
function frames(name, K, hold) {
  const M = MOVES[name];
  const out = [];
  const total = M.once ?? M.enter + hold;
  let t = 0;
  for (; t < total; t += DT) out.push({ t, end: null, P: lookPose(name, t, null, K) });
  if (M.once) {
    for (let e = 0; e <= (M.exit ?? 0) + DT; e += DT) out.push({ t: t + e, end: e, P: lookPose(name, t + e, e, K) });
  } else {
    for (let e = 0; e <= M.exit + DT; e += DT) out.push({ t: t + e, end: e, P: lookPose(name, t + e, e, K) });
  }
  return out;
}

const CASES = [
  ['zonk', { side: -1, phase: 0.2 }, 10],
  ['zonk', { side: 1, phase: 0.7 }, 10],
  ['disco', { phase: 0.1, beat: 0.52, hand: 1, order: ['groove', 'roof', 'point', 'wave'] }, 20],
  ['disco', { phase: 0.63, beat: 0.5, hand: -1, order: ['point', 'wave', 'groove', 'roof'] }, 20],
  ['pukes', {}, 0],
  ['cooked', { phase: 0.4 }, 9],
];

for (const [name, K, hold] of CASES) {
  test(`${name} (${JSON.stringify(K).slice(0, 40)}): feet planted, head calm, on the ground, arms clear of the head, itself after`, () => {
    const F = frames(name, K, hold);
    let slide = 0;
    let yawRate = 0;
    let under = 0;
    let through = 0;
    for (let k = 1; k < F.length; k++) {
      const [a, b] = [F[k - 1].P, F[k].P];
      // a foot down (no lift, on a standing body) moves not at all from one frame to the next
      if (Math.abs(b.rz) < 1e-3 && Math.abs(a.rz) < 1e-3) {
        for (const [fa, fb, sx] of [[a.fL, b.fL, -1], [a.fR, b.fR, 1]]) {
          if (fa[1] > 0.002 || fb[1] > 0.002) continue;
          const [pa, pb] = [footAt(a, fa, sx), footAt(b, fb, sx)];
          slide = Math.max(slide, Math.hypot(pa[0] - pb[0], pa[2] - pb[2]));
        }
      }
      yawRate = Math.max(yawRate, Math.abs(wrap(headYaw(b) - headYaw(a))) / DT);
      under = Math.min(under, lowest(b));
      // a fist's middle never inside the head's box (less a fist's width)
      const H = fk(b);
      for (const fist of [H.fistL, H.fistR]) {
        // (the head's frame: from the neck, its own turn undone, by the head's up and front)
        const d = V.sub(fist, H.neck);
        const up = H.up;
        const fw = H.fwd;
        const rt = V.cross(up, fw);
        const [x, y, z] = [V.dot(d, rt), V.dot(d, up) + RIG.neck, V.dot(d, fw)];
        const R = RIG.head;
        if (Math.abs(x) < R.x - 0.06 && y > R.y0 + 0.06 && y < R.y1 - 0.06 && z > R.z0 + 0.06 && z < R.z1 - 0.06) through++;
      }
    }
    assert.ok(slide < 0.004, `a planted foot slid ${slide.toFixed(4)} m in a frame`);
    // (the owner: "the head motion is crazy / very intense when turning": no head turns faster than 2.5 rad/s)
    assert.ok(yawRate < 2.5, `the head turned ${yawRate.toFixed(2)} rad/s`);
    assert.ok(under > -0.005, `a point of the body ${(-under).toFixed(3)} m under the ground`);
    assert.equal(through, 0, `a fist inside the head on ${through} frames`);
    // itself again at the end: the stand
    const last = F[F.length - 1].P;
    for (const k of ['tx', 'ty', 'tz', 'drop', 'bx', 'rz', 'rx', 'mz', 'my']) assert.ok(Math.abs(last[k]) < 0.01, `${k} is ${last[k]} at the end`);
  });
}

test('zonk: asleep on the ground, not standing and not floating', () => {
  for (const side of [-1, 1]) {
    const P = lookPose('zonk', 9, null, { side, phase: 0 });
    const H = fk(P);
    assert.ok(Math.abs(lowest(P)) < 0.01, 'its lowest point is on the ground');
    assert.ok(H.headC[1] < 0.8, `the head is down (${H.headC[1].toFixed(2)} m)`);
    assert.ok(Math.abs(P.rz) > 1, 'it lies on its side');
  }
});

test('disco: two dancers with their own numbers never strike the same pose', () => {
  let same = 0;
  for (let t = 2; t < 20; t += 0.1) {
    const a = lookPose('disco', t, null, CASES[2][1]);
    const b = lookPose('disco', t, null, CASES[3][1]);
    if (Math.abs(a.hR[1] - b.hR[1]) < 0.02 && Math.abs(a.bx - b.bx) < 0.01) same++;
  }
  assert.ok(same < 10, `${same} moments alike`);
});
