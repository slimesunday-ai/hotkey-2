// HOW FAR A HAND-POSED BODY REACHES, AS THE SHADER DRAWS IT (streak-1). A body posed by hand (a fight's, a look's: any
// pose that goes to the walkers' shader through rig.js packPose) is drawn by the city's walk shader
// (city/from-trunk/style/city/anim/cast/walk2.js animCompute), not by rig.js: the legs are solved there from the pose's
// two ankle targets, and their cloth and the seat between them are laid there. This file is that drawing, worked in
// JS for the points that can go wrong, so the page can say, every time it hands a pose over, how far from the body any
// part of it is drawn. Nothing of a body can be further than a body reaches (the crown 1.2 m over the hips, a fist
// 0.9 m from them, a toe 0.7 m): STRETCH is the line, generous, so a point past it is a streak and nothing else.
//
// WHAT THE SHADER DOES THAT CAN STRETCH (walk2.js, the seat's midline, "if (part <= 2 && abs(position.x) < 1e-5)"):
// each thigh's middle-line vertices at the seat are slid along x onto a plane tilted by the legs' MEAN ROLL (each leg's
// roll is atan(d.x, -d.y), d its hip joint to its ankle target, across and down), by `(gap - dot(p - c, n)) / n.x`,
// n = (cos roll, sin roll, 0). When the mean roll nears a quarter turn n.x nears 0 and those vertices go off without
// bound: the trousers' seat drawn as a streak to the edge of the picture. A leg's roll nears a quarter turn when its
// ankle is as high as its hip joint (a foot thrown out past the leg's length, so the hips come down to it; a pelvis
// dropped onto the ground with the feet still on it; a foot lifted past the hips), and the MEAN when one leg's is a
// half turn (its ankle over its hip) and the other's none.
//
//   reachOf(P) → { far, at, seat, roll, ok }   P a pose as rig.js packs it (its aL / aR already worked out)
//     far   the furthest any of the checked points is from the hips (m, the shared body's; NaN counted as Infinity)
//     at    which point that is · seat the seat's midline vertex's (the streak) · roll the legs' mean roll (rad)
//   STRETCH  the line (m)
//   reachOfBlend(P)  the worst of reachOf over the pose blending in from the plain stand (the clip's own blend)
//   LOG       every pose handed to the shader once this file is loaded (rig.js packPose tells it): { poses, bad, worst,
//             last: the latest over-reaching ones [{ n, row, far, at, roll }] }; a reader keeps the `bad` it last saw
//             and reads what came since (stretchSince): the stage's audit (`stretch`) and the fight's frame check
import { RIG, V, fk, hipOf, pose0, mixPose, copyPose, HANDED, TEXELS } from './rig.js';

/** No point of a body is drawn further than this from its hips (m, the shared body's; the crown is 1.2 m over them). */
export const STRETCH = 1.5;

// the shader's leg (walk2.js R2 / A_L1 / A_L2; gait2.js)
const L1 = 0.2, L2 = 0.175, KNEE = 0.3, ANK = RIG.ank, HIPY = RIG.hipY, HIPZ = RIG.hipZ, HIPX = RIG.hipX, SOCKET = 0.2;
const GAP = 0.00005;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** A foot's ankle target (z, y) from its [z, lift, pitch]: clips' cFoot (walk2.js aAnkle + lift). */
export function ankleOf(f) {
  const [z, lift, fp] = f;
  const c = Math.cos(fp), s = Math.sin(fp);
  const r = fp >= 0 ? [RIG.heel, ANK] : [-RIG.toe, ANK];
  return [(fp >= 0 ? z - RIG.heel : z + RIG.toe) + r[0] * c - r[1] * s, r[0] * s + r[1] * c + lift];
}
/** Each leg as the shader solves it, standing (no walk under it): its hip joint, roll and pitches. */
function legOf(P, hip, sx) {
  const ank = ankleOf(sx < 0 ? P.fL : P.fR);
  const fp = (sx < 0 ? P.fL : P.fR)[2];
  const hipNow = [P.bx + sx * HIPX * Math.cos(P.pr), hip + sx * HIPX * Math.sin(P.pr), HIPZ];
  const d = [sx * HIPX - hipNow[0], ank[1] - hipNow[1], HIPZ + ank[0] - hipNow[2]];
  const roll = Math.atan2(d[0], -d[1]);
  const dy = -Math.sqrt(d[1] * d[1] + d[0] * d[0]);
  const D = clamp(Math.hypot(d[2], dy), 0.05, L1 + L2 - 1e-4);
  const th = Math.atan2(d[2], -dy) + Math.acos(clamp((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
  const bend = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1));
  return { sx, hipNow, roll, th, bend, fp, gap: hipNow[1] - ank[1] };
}
/** A rest point of a thigh (part 1 / 2, x the rest x) as the shader lays it: the cloth, the hip's pitch, the roll. */
function thighPoint(leg, q) {
  const { rX, rZ, add, sub, scale, dot } = V;
  const shin = v => rX(leg.bend, v);
  const foot = v => rX(leg.bend, rX(leg.th - leg.bend - leg.fp, v));
  const kp = [0, KNEE, HIPZ], ap = [0, ANK, HIPZ], hp = [0, HIPY, HIPZ];
  const ankleNow = add(kp, shin(sub(ap, kp)));
  const up = foot([0, 1, 0]), across = foot([0, 0, 1]);
  const t = (q[1] - SOCKET) / (HIPY - SOCKET);
  const h = dot(sub(hp, ankleNow), up), bk = dot(sub(kp, ankleNow), across), bh = dot(sub(hp, ankleNow), across);
  const low = q[1] < KNEE;
  const bt = low ? (q[1] - SOCKET) / (KNEE - SOCKET) : (q[1] - KNEE) / (HIPY - KNEE);
  const lateral = low ? bk * bt : bk + (bh - bk) * bt;
  const height = SOCKET - ANK + (h - (SOCKET - ANK)) * t;
  const posed = add(add(ankleNow, scale(up, height)), scale(across, lateral + q[2] - HIPZ));
  posed[0] = q[0];
  const hipRest = [leg.sx * HIPX, HIPY, HIPZ];
  const p = add(hipRest, rX(-leg.th, sub(posed, hipRest)));
  return add(leg.hipNow, rZ(leg.roll, sub(p, hipRest)));
}
/** The ankle, the knee and the toe of a leg as the shader puts them. */
function legPoints(leg) {
  const { rX, rZ, add, sub } = V;
  const hipRest = [leg.sx * HIPX, HIPY, HIPZ];
  const at = p => add(leg.hipNow, rZ(leg.roll, rX(-leg.th, sub(p, hipRest))));
  const kp = [leg.sx * HIPX, KNEE, HIPZ];
  const ap = [leg.sx * HIPX, ANK, HIPZ];
  const ankleNow = add(kp, rX(leg.bend, sub(ap, kp)));
  const toe = add(ankleNow, rX(leg.bend, rX(leg.th - leg.bend - leg.fp, [0, -ANK, RIG.toe])));
  return { knee: at(kp), ankle: at(ankleNow), toe: at(toe) };
}
const root = (P, p) => {
  const piv = [P.px, P.py, P.pz];
  return V.add(V.add(piv, V.rY(P.ry, V.rX(P.rx, V.rZ(P.rz, V.sub(p, piv))))), [P.mx, P.my, P.mz]);
};
// (the seat's midline vertices: x 0, the seat's rows y 8..9 voxels, through the thigh's depth)
const SEAT = [[0, 0.4, -0.075], [0, 0.45, -0.075], [0, 0.4, 0.125], [0, 0.45, 0.125]];

export function reachOf(P) {
  const hip = hipOf(P);
  const legs = [legOf(P, hip, -1), legOf(P, hip, 1)];
  const roll = 0.5 * (legs[0].roll + legs[1].roll);
  const n = [Math.cos(roll), Math.sin(roll), 0];
  const mid = [P.bx, hip, HIPZ];
  const c = root(P, mid);
  const pts = {};
  let seat = 0;
  for (const leg of legs) {
    const side = leg.sx < 0 ? 'L' : 'R';
    for (const q of SEAT) {
      const p = thighPoint(leg, [q[0], q[1], q[2]]);
      p[0] += (leg.sx * GAP - V.dot(V.sub(p, mid), n)) / n[0];
      const w = root(P, p);
      const d = Math.hypot(w[0] - c[0], w[1] - c[1], w[2] - c[2]);
      if (!(d <= seat)) seat = Number.isFinite(d) ? d : Infinity;
      if (!(d <= (pts['seat' + side]?.d ?? -1))) pts['seat' + side] = { d: Number.isFinite(d) ? d : Infinity };
    }
    const lp = legPoints(leg);
    for (const k of ['knee', 'ankle', 'toe']) pts[k + side] = { p: root(P, lp[k]) };
  }
  const f = fk(P);
  for (const k of ['crown', 'headC', 'fistL', 'fistR', 'elbL', 'elbR', 'shL', 'shR', 'chestC']) pts[k] = { p: f[k] };
  let far = 0;
  let at = null;
  for (const [k, v] of Object.entries(pts)) {
    let d = v.d;
    if (d === undefined) {
      d = Math.hypot(v.p[0] - c[0], v.p[1] - c[1], v.p[2] - c[2]);
      if (!Number.isFinite(d)) d = Infinity;
    }
    if (!(d <= far)) [far, at] = [d, k];
  }
  if (!Number.isFinite(far)) far = Infinity;
  return { far, at, seat, roll, ok: far <= STRETCH, gaps: [legs[0].gap, legs[1].gap] };
}

const B0 = pose0();
const B1 = pose0();
/** The worst of reachOf as the pose blends in from the plain stand (the shader mixes a clip with the stand by its weight). */
export function reachOfBlend(P) {
  let worst = reachOf(P);
  for (const k of [0.25, 0.5, 0.75]) {
    copyPose(B0, B1);
    mixPose(B1, P, k);
    // (the root's turn and move are scaled by the weight; its pivot is not: clips/index.js clipPose)
    B1.px = P.px; B1.py = P.py; B1.pz = P.pz;
    for (let i = 0; i < 5; i++) {
      B1.aL[i] = B0.aL[i] + (P.aL[i] - B0.aL[i]) * k;
      B1.aR[i] = B0.aR[i] + (P.aR[i] - B0.aR[i]) * k;
    }
    const r = reachOf(B1);
    if (!(r.far <= worst.far)) worst = r;
  }
  return worst;
}

export const LOG = { poses: 0, bad: 0, worst: 0, last: [] };
const UPPER = pose0();
function heard(P, out, at, whole) {
  LOG.poses += 1;
  let Q = P;
  if (!whole) {
    // (the legs are the walk's: only the upper half is the page's)
    Q = copyPose(P, UPPER);
    Q.fL[0] = Q.fL[1] = Q.fL[2] = Q.fR[0] = Q.fR[1] = Q.fR[2] = 0;
  }
  const r = reachOfBlend(Q);
  if (r.ok) return;
  LOG.bad += 1;
  if (!(r.far <= LOG.worst)) LOG.worst = r.far;
  LOG.last.push({ n: LOG.bad, row: Math.round(at / (TEXELS * 4)), far: r.far, at: r.at, roll: r.roll });
  if (LOG.last.length > 32) LOG.last.shift();
}
HANDED.listen = heard;
/** The over-reaching poses handed over since a reader's last count `n` (LOG.bad then): { n, list }. */
export function stretchSince(n) {
  return { n: LOG.bad, count: LOG.bad - n, list: LOG.last.filter(e => e.n > n) };
}
