// THE BODY OVER ITS FEET (anim-1). What the plan says of a fighter at a moment (where the hips are, which way the chest
// faces, the pose of chest, head and arms, where each foot is on the ground) made into what the stage and the shader
// need: where the walker stands and its heading, and the rig's pose (rig.js). THE RIG'S LEGS HANG A FIXED WIDTH APART
// (the hips, 0.25 m, across the body's own heading: walk2.js): two feet on the ground therefore say which way the legs
// face, and the body's root is worked out FROM the feet, never the other way round. So a planted foot stays where it
// is put, whatever the hips and the chest do above it; the chest is then turned on the hips to face where the fight
// says (the rig lets the chest and pelvis turn over the legs), and the head on the chest to look where it should.
//
//   solve({ L, R, yaw, pin, pelvis, facing, pose, rooted }, out) → out { x, z, yaw, P }
//     L, R      each foot [x, z, lift, pitch] in the world, `yaw` the legs' heading and `pin` the foot that is down
//               (−1 L, +1 R): feet.js
//     pelvis    [x, z]: where the hips should be over them
//     facing    the heading the chest faces (rad, the stage's yaw)
//     pose      the authored pose (rig.js pose0's fields): ty the chest's twist ON TOP of facing; hx hy hz the head's
//               pitch, yaw and roll FROM LEVEL AND FROM FACING (so a chest that coils does not drag the eyes off them);
//               bx the hips' sway on top of where the pelvis is; hL hR each fist as a point of the chest's frame;
//               reachL / reachR { at: [x, y, z] world, k }: that fist put on a point of the world instead, by its share k
//     rooted    { x, z, yaw }: the body is off its feet (down, thrown): the root is this and the pose's own feet are used
//     size      (named-1) the body drawn this many times the shared one (the named cast: 0.9 to 1.25; 1 when not told).
//               The pose stays the shared body's (the shader poses that, the stage draws it `size` times about the
//               feet), so what is in the world is brought into it divided by the size, and what of it is put in the
//               world multiplied: the planted foot is still exactly where it was put, a fist still lands on its point
import { RIG, pose0, copyPose, armTo, chestTarget, toBody, hipOf } from './rig.js';
import { wrap } from './plan.js';

const H = RIG.hipX;
/** How far a foot's ground point may be ahead of or behind the hip (m): past it the hips are held back. */
const ZMAX = 0.31;
const BXMAX = 0.1;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function solve(S, out = { x: 0, z: 0, yaw: 0, y: 0, P: pose0() }) {
  const P = copyPose(S.pose, out.P);
  const A = S.pose;
  const k = S.size ?? 1;
  const size = k;
  let yaw;
  if (S.rooted) {
    // OFF ITS FEET: the root is where the feet left it, turned and moved by the pose (thrown, spun as it falls). The
    // turn about the upright and the move along the ground are given to the STAGE's body (its place and heading), so
    // the stage's own person is where the body is drawn, and stands up there with no jump; the rest stays the pose's
    const a = A.ry;
    const [c, sn] = [Math.cos(a), Math.sin(a)];
    const tx = A.px - (c * A.px + sn * A.pz) + A.mx;
    const tz = A.pz - (-sn * A.px + c * A.pz) + A.mz;
    const [c0, s0] = [Math.cos(S.rooted.yaw), Math.sin(S.rooted.yaw)];
    out.x = S.rooted.x + (tx * c0 + tz * s0) * k;
    out.z = S.rooted.z + (-tx * s0 + tz * c0) * k;
    yaw = S.rooted.yaw + a;
    P.ry = 0;
    P.mx = 0;
    P.mz = 0;
    P.ty = clamp(wrap(S.facing - S.rooted.yaw) + A.ty, -1.5, 1.5);
  } else {
    // THE LEGS: their heading is the steps' (feet.js); the root is hung off the foot that is down, so that foot is
    // exactly where it was put; the other is drawn where the rig has it (0.25 m across from the first)
    const { L, R } = S;
    yaw = S.yaw;
    const pin = S.pin < 0 ? L : R;
    const other = S.pin < 0 ? R : L;
    const [ex, ez] = [[Math.cos(yaw), -Math.sin(yaw)], [Math.sin(yaw), Math.cos(yaw)]];
    // the body's middle line, abreast of the planted foot
    const cx = pin[0] - ex[0] * S.pin * H * k;
    const cz = pin[1] - ex[1] * S.pin * H * k;
    // (the hips where the plan has them, shifted by the pose over the planted feet: ahead of and across the facing)
    const [fs, fc] = [Math.sin(S.facing), Math.cos(S.facing)];
    const [qx, qz] = [S.pelvis[0] + (fs * A.sz + fc * A.sx) * k - cx, S.pelvis[1] + (fc * A.sz - fs * A.sx) * k - cz];
    const sx = qx * ex[0] + qz * ex[1];
    let sz = qx * ez[0] + qz * ez[1];
    const zo = (other[0] - cx) * ez[0] + (other[1] - cz) * ez[1];
    // (a foot in the air reaches less far: it is the planted one that holds the hips)
    const lim = F => ZMAX * k + 0.6 * F[2];
    sz = clamp(sz, Math.max(-lim(pin), zo - lim(other)), Math.min(lim(pin), zo + lim(other)));
    out.x = cx + ez[0] * (sz - RIG.hipZ * k);
    out.z = cz + ez[1] * (sz - RIG.hipZ * k);
    // (the feet as the shared body's: what is metres in the world over the size)
    const zp = -sz / k;
    const zq = (zo - sz) / k;
    const [zl, zr] = S.pin < 0 ? [zp, zq] : [zq, zp];
    // a planted foot far behind the hips is up on its toe; far ahead, on its heel
    const pitch = (F, z) => F[3] + (F[2] > 0.004 ? 0 : -clamp((-z - 0.13) * 2.6, 0, 0.5) + clamp((z - 0.2) * 1.8, 0, 0.25));
    P.fL[0] = zl; P.fL[1] = L[2] / k; P.fL[2] = pitch(L, zl);
    P.fR[0] = zr; P.fR[1] = R[2] / k; P.fR[2] = pitch(R, zr);
    P.bx = clamp(sx / k + A.bx, -BXMAX, BXMAX);
    P.ty = clamp(wrap(S.facing - yaw) + A.ty, -1.5, 1.5);
  }
  // the head: told from level and from facing; the shader wants it on the chest
  P.hy = clamp(A.hy - A.ty, -1.35, 1.35);
  P.hx = A.hx - A.tx;
  P.hz = A.hz - A.tz;
  // the arms: each fist to its point of the chest's frame, or (a blow landing, a hand on somebody) to a point of the
  // world by its share; the arm that reaches it
  for (const [key, side, hand, pole, arm] of [['reachL', -1, 'hL', 'pL', 'aL'], ['reachR', 1, 'hR', 'pR', 'aR']]) {
    let h = A[hand];
    const r = A[key];
    if (r && r.k > 0 && !S.rooted) {
      const b = toBody(r.at, out.x, S.y ?? 0, out.z, yaw);
      const c = chestTarget(P, size === 1 ? b : [b[0] / size, b[1] / size, b[2] / size]);
      const k = clamp(r.k, 0, 1);
      h = [h[0] + (c[0] - h[0]) * k, h[1] + (c[1] - h[1]) * k, h[2] + (c[2] - h[2]) * k];
    }
    const a = armTo(h, side, A[pole], S.pose.eMax ?? 1.95);
    for (let i = 0; i < 5; i++) P[arm][i] = a[i];
  }
  out.yaw = yaw;
  out.hip = hipOf(P);
  return out;
}
