// THE FIGHTER'S RIG, AS THE PAGE'S OWN ARITHMETIC (anim-1). The cast's walker is posed in its vertex shader from a
// small `Pose` (city/from-trunk/style/city/anim/cast/walk2.js: chest, head, two arms with an elbow, two ankle targets,
// the pelvis, and a root that turns and moves the whole body). The fight poses it from the page, every frame, by hand
// (clip.js sends a pose to the shader); this file is that pose as plain numbers, and the same joints worked forward in
// JS so the page knows where a fist, a shoulder or a head IS (to land a blow on a head, to plant a foot on the ground).
// Read off the rig, not off anybody's clip: the joint places and turn orders are walk2.js's and idle.js's own.
//
//   a pose      { tx ty tz   the chest: pitch forward, yaw (+: the front turns to +x), roll
//                 hx hy hz   the head, on the chest: pitch (+: looks down), yaw, roll
//                 drop bx pr the pelvis: lowered (m), swayed to +x (m), rolled
//                 sx sz      the hips shifted over the planted feet (m): to the R of where the chest faces, and ahead
//                            (the weight going onto the back foot before a blow: no step is taken for it)
//                 hL hR      each FIST, as a point [x, y, z] of the chest's own frame (the chest at rest: the shoulders
//                            at x ±0.25, y 0.825; +z ahead), and pL pR which way its elbow points (a direction, the
//                            same frame). The arm that puts the fist there is worked out (armTo): a blow is keyed as
//                            the path of a fist, not as five angles
//                 aL aR      (worked out) each arm [pitch forward, roll out, yaw in, twist in, elbow]: what the shader takes
//                 rx ry rz   the root's turn (pitch forward +, yaw, roll) about px py pz (m, body frame), then moved by
//                 mx my mz   (m, body frame, +z ahead): falling, lying, getting up
//                 fL fR      each foot [z, lift, pitch]: its ground point in the body frame (z ahead of the hip), how far
//                            it is off the ground, its pitch (−: the heel up, on the toe; +: the toe up, on the heel) }
//
// THE BODY'S FRAME: +z ahead, +y up, +x the R side. In the world a body at (X, Z) with heading `yaw` has its +z along
// (sin yaw, cos yaw) and its +x along (cos yaw, −sin yaw).
export const RIG = Object.freeze({
  hipX: 0.125, hipY: 0.5, hipZ: 0.025, leg: (0.2 + 0.175) * 0.998, ank: 0.125, heel: 0.175, toe: 0.275,
  shX: 0.25, shY: 0.825, neck: 0.95,
  /** the elbow's hinge line (y, z) and the fist's middle, in the +x arm's rest frame (the arm hanging) */
  hingeY: 0.65, hingeZ: 0.05, grip: [0.325, 0.39, 0],
  /** the head's box, from the neck's foot: x ±0.5, y 0.9 to 1.7, z −0.35 to 0.45 */
  head: { x: 0.5, y0: 0.9, y1: 1.7, z0: -0.35, z1: 0.45 },
});

export const ARM0 = Object.freeze([0, 0.04, 0, 0, 0]);
/** A fist hanging at the side, and where its elbow points then (chest frame; the L one: x mirrored). */
export const HANG = Object.freeze([0.342, 0.393, 0]);
export const POLE = Object.freeze([1, -0.4, -0.3]);
/** The plain stand: what the walker's own pose is with no clip on it. */
export function pose0() {
  return {
    tx: 0, ty: 0, tz: 0, hx: 0, hy: 0, hz: 0, drop: 0, bx: 0, pr: 0, rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0, mx: 0, my: 0, mz: 0, sx: 0, sz: 0,
    hL: [-HANG[0], HANG[1], HANG[2]], pL: [-POLE[0], POLE[1], POLE[2]], hR: [...HANG], pR: [...POLE],
    fL: [0, 0, 0], fR: [0, 0, 0], aL: [...ARM0], aR: [...ARM0],
  };
}
const SCALARS = ['tx', 'ty', 'tz', 'hx', 'hy', 'hz', 'drop', 'bx', 'pr', 'rx', 'ry', 'rz', 'px', 'py', 'pz', 'mx', 'my', 'mz', 'sx', 'sz'];
const LISTS = ['hL', 'pL', 'hR', 'pR', 'fL', 'fR'];
export function copyPose(a, out = pose0()) {
  for (const k of SCALARS) out[k] = a[k];
  for (const k of LISTS) for (let i = 0; i < 3; i++) out[k][i] = a[k][i];
  for (let i = 0; i < 5; i++) {
    out.aL[i] = a.aL[i];
    out.aR[i] = a.aR[i];
  }
  return out;
}
/** out = a toward b by k (every keyed number of the pose). */
export function mixPose(a, b, k, out = a) {
  if (k <= 0) return out === a ? a : copyPose(a, out);
  for (const key of SCALARS) out[key] = a[key] + (b[key] - a[key]) * k;
  for (const key of LISTS) for (let i = 0; i < 3; i++) out[key][i] = a[key][i] + (b[key][i] - a[key][i]) * k;
  return out;
}
const flipX = v => [-v[0], v[1], v[2]];
/** The same pose seen in a mirror (L and R swapped, every sideways turn the other way): a southpaw from an orthodox. */
export function mirrorPose(a, out = pose0()) {
  const [hL, pL, hR, pR, fL, fR] = [flipX(a.hR), flipX(a.pR), flipX(a.hL), flipX(a.pL), [...a.fR], [...a.fL]];
  copyPose(a, out);
  Object.assign(out, { ty: -a.ty, tz: -a.tz, hy: -a.hy, hz: -a.hz, bx: -a.bx, pr: -a.pr, ry: -a.ry, rz: -a.rz, px: -a.px, mx: -a.mx, sx: -a.sx, hL, pL, hR, pR, fL, fR });
  return out;
}

// ── small vector arithmetic (the shader's own turns: aRX, aRY, aRZ of walk2.js) ─────────────────────────────────────
const rX = (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]; };
const rY = (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; };
const rZ = (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const V = { rX, rY, rZ, add, sub, len: a => Math.hypot(a[0], a[1], a[2]), scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };

/** A foot's ankle (z, y) for its ground point z, lift and pitch: the shader's aAnkle + lift (clips' cFoot). */
function ankle(f) {
  const [z, lift, fp] = f;
  const c = Math.cos(fp), s = Math.sin(fp);
  const r = fp >= 0 ? [RIG.heel, RIG.ank] : [-RIG.toe, RIG.ank];
  return [(fp >= 0 ? z - RIG.heel : z + RIG.toe) + r[0] * c - r[1] * s, r[0] * s + r[1] * c + lift];
}
/** The pelvis's height for a pose: as high as both ankles let it be, under its drop (walk2.js, standing). */
export function hipOf(P) {
  const L = ankle(P.fL), R = ankle(P.fR), sr = Math.sin(P.pr) * RIG.hipX, R2 = RIG.leg * RIG.leg;
  const hL = L[1] + Math.sqrt(Math.max(R2 - L[0] * L[0] - P.bx * P.bx, 0)) + sr;
  const hR = R[1] + Math.sqrt(Math.max(R2 - R[0] * R[0] - P.bx * P.bx, 0)) - sr;
  return Math.min(RIG.hipY - P.drop, hL, hR);
}

/** The chest's frame for a pose: a rest-frame point of the chest (or of anything riding it) → the body frame, before the root. */
function chest(P, hip, p) {
  let d = sub(p, [0, RIG.hipY, RIG.hipZ]);
  d = rZ(P.tz + 0.5 * P.pr, rX(P.tx, rY(P.ty, d)));
  return add([P.bx, hip, RIG.hipZ], d);
}
function chestDir(P, d) {
  return rZ(P.tz + 0.5 * P.pr, rX(P.tx, rY(P.ty, d)));
}
/** The root: the whole body turned about its pivot and moved (clips' cRot, cPiv, cMov). */
function root(P, p) {
  const piv = [P.px, P.py, P.pz];
  return add(add(piv, rY(P.ry, rX(P.rx, rZ(P.rz, sub(p, piv))))), [P.mx, P.my, P.mz]);
}
function rootDir(P, d) {
  return rY(P.ry, rX(P.rx, rZ(P.rz, d)));
}
/** An arm's turn about its shoulder (idle.js aArmRot), on a direction: side −1 the L arm, +1 the R. */
function armDir(a, sx, d) {
  d = rY(-sx * a[3], d);
  d = rX(-a[0], d);
  d = rZ(sx * a[1], d);
  return rY(-sx * a[2], d);
}
/** A rest-frame point of an arm (given for the +x arm; mirrored for the −x) → the chest's rest frame. */
function armPoint(a, sx, p) {
  // (the elbow: the forearm and fist turn about the hinge line, a point below it only)
  let q = [p[0], p[1], p[2]];
  if (q[1] < RIG.hingeY) {
    const h = [q[0], RIG.hingeY, RIG.hingeZ];
    q = add(h, rX(-a[4], sub(q, h)));
  }
  const sh = [RIG.shX, RIG.shY, 0];
  const d = armDir(a, sx, [sx * (q[0] - sh[0]), q[1] - sh[1], q[2] - sh[2]]);
  return [sx * sh[0] + d[0], sh[1] + d[1], sh[2] + d[2]];
}

/**
 * Where the body's points are for a pose, in the BODY frame (the root's turn and move included):
 * { hip, neck, headC (the head's middle), face (the middle of its front), chin, shL, shR, fistL, fistR, elbL, elbR,
 *   chestC, belly, up (the head's up), fwd (the head's front) }.
 */
export function fk(P) {
  const hip = hipOf(P);
  const C = p => root(P, chest(P, hip, p));
  const headAt = p => {
    const d = rY(P.hy, rX(P.hx, rZ(P.hz, sub(p, [0, RIG.neck, 0]))));
    return C(add([0, RIG.neck, 0], d));
  };
  const headDir = d => rootDir(P, chestDir(P, rY(P.hy, rX(P.hx, rZ(P.hz, d)))));
  const H = RIG.head;
  return {
    hipY: hip,
    hip: root(P, [P.bx, hip, RIG.hipZ]),
    neck: C([0, RIG.neck, 0]),
    headC: headAt([0, (H.y0 + H.y1) / 2, (H.z0 + H.z1) / 2]),
    face: headAt([0, 1.2, H.z1]),
    chin: headAt([0, H.y0 + 0.08, H.z1]),
    crown: headAt([0, H.y1, 0.05]),
    shL: C([-RIG.shX, RIG.shY, 0]), shR: C([RIG.shX, RIG.shY, 0]),
    fistL: C(armPoint(P.aL, -1, RIG.grip)), fistR: C(armPoint(P.aR, 1, RIG.grip)),
    elbL: C(armPoint(P.aL, -1, [RIG.grip[0], RIG.hingeY, RIG.hingeZ])), elbR: C(armPoint(P.aR, 1, [RIG.grip[0], RIG.hingeY, RIG.hingeZ])),
    chestC: C([0, 0.72, 0.1]), belly: C([0, 0.56, 0.12]),
    up: headDir([0, 1, 0]), fwd: headDir([0, 0, 1]),
    /** any head-frame point (rest frame of the head, y from the ground) */
    headAt,
    /** a chest-frame point */
    chestAt: C,
  };
}

/** A body-frame point of a body at (x, y, z) heading `yaw` → the world. */
export function toWorld(p, x, y, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [x + p[0] * c + p[2] * s, y + p[1], z - p[0] * s + p[2] * c];
}
/** A world point → the body frame of a body at (x, y, z) heading `yaw`. */
export function toBody(p, x, y, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw), dx = p[0] - x, dz = p[2] - z;
  return [dx * c - dz * s, p[1] - y, dx * s + dz * c];
}

// ── an arm that reaches a point ─────────────────────────────────────────────────────────────────────────────────────
// The fist's middle is 0.435 m under the shoulder and 0.075 m out; the elbow's hinge 0.175 m under it. Bent by e, the
// fist is `reachOf(e)` from the shoulder.
const G = [RIG.grip[0] - RIG.shX, RIG.grip[1] - RIG.shY, RIG.grip[2]];
const HG = [G[0], RIG.hingeY - RIG.shY, RIG.hingeZ];
function fistRest(e) {
  // the fist in the +x arm's shoulder frame, the arm hanging, the elbow bent e
  const d = rX(-e, sub(G, HG));
  return add(HG, d);
}
export const reachOf = e => V.len(fistRest(e));
export const REACH = Object.freeze({ max: reachOf(0), min: reachOf(2.2) });
/**
 * The arm's five angles that put the fist's middle on `target` (CHEST REST FRAME: use `chestTarget` for a body-frame
 * point), the elbow pointing as near `pole` (a direction, chest frame) as it can; `side` −1 the L arm, +1 the R.
 * A target out of reach is reached toward (the arm straight). The yaw-in is left 0: three turns are enough.
 */
export function armTo(target, side, pole = [side, -0.4, -0.3], eMax = 2.2) {
  const sx = side;
  const T = [sx * (target[0] - sx * RIG.shX), target[1] - RIG.shY, target[2]];
  // (worked in the +x arm's frame: a L arm's target is mirrored into it)
  const Pm = [sx * pole[0], pole[1], pole[2]];
  const r = Math.max(REACH.min, Math.min(REACH.max - 1e-4, V.len(T)));
  // the elbow for that reach (bisection: the reach falls as the elbow bends)
  let lo = 0, hi = eMax;
  for (let k = 0; k < 22; k++) {
    const m = (lo + hi) / 2;
    if (reachOf(m) > r) lo = m;
    else hi = m;
  }
  const e = (lo + hi) / 2;
  const f0 = fistRest(e);
  // a frame on the bent rest arm (toward the fist, then toward its elbow) turned onto (toward the target, toward the pole)
  const e1 = V.norm(f0);
  const k0 = sub(HG, V.scale(e1, V.dot(HG, e1)));
  const e2 = V.norm(V.len(k0) > 1e-5 ? k0 : [0, 0, -1]);
  const e3 = V.cross(e1, e2);
  const f1 = V.norm(T);
  const p0 = sub(Pm, V.scale(f1, V.dot(Pm, f1)));
  const f2 = V.norm(V.len(p0) > 1e-5 ? p0 : [1, 0, 0]);
  const f3 = V.cross(f1, f2);
  // R = [f1 f2 f3] [e1 e2 e3]^T, as rows
  const R = [0, 1, 2].map(i => [0, 1, 2].map(j => f1[i] * e1[j] + f2[i] * e2[j] + f3[i] * e3[j]));
  // R = RZ(roll) RX(−pitch) RY(−twist) for the +x arm (yaw 0): read the three off it
  // RZ(r) RX(q) RY(w), q = −pitch, w = −twist:  R[2] = [−cq·sw... ] worked out below
  //   RX(q) RY(w) = [[cw, 0, sw], [sq·sw, cq, −sq·cw], [−cq·sw, sq, cq·cw]]
  //   then RZ(r) mixes rows 0 and 1; row 2 is [−cq·sw, sq, cq·cw]
  const sq = Math.max(-1, Math.min(1, R[2][1]));
  const q = Math.asin(sq);
  const w = Math.atan2(-R[2][0], R[2][2]);
  // rows 0, 1: [c·cw − s·sq·sw, −s·cq, c·sw + s·sq·cw], [s·cw + c·sq·sw, c·cq, s·sw − c·sq·cw]
  const rr = Math.atan2(-R[0][1], R[1][1]);
  return [-q, rr, 0, -w, e];
}
/** A body-frame point (root not turned: a standing body) → the chest's rest frame, for armTo. */
export function chestTarget(P, p) {
  const hip = hipOf(P);
  let d = sub(p, [P.bx, hip, RIG.hipZ]);
  d = rY(-P.ty, rX(-P.tx, rZ(-(P.tz + 0.5 * P.pr), d)));
  return add([0, RIG.hipY, RIG.hipZ], d);
}

// ── the pose, as the shader reads it (clip.js: ten texels a body) ───────────────────────────────────────────────────
export const TEXELS = 10;
export function packPose(P, out, at = 0) {
  const o = at;
  out[o] = P.fL[0]; out[o + 1] = P.fL[1]; out[o + 2] = P.fL[2]; out[o + 3] = P.fR[0];
  out[o + 4] = P.fR[1]; out[o + 5] = P.fR[2]; out[o + 6] = P.drop; out[o + 7] = P.bx;
  out[o + 8] = P.pr; out[o + 9] = P.tx; out[o + 10] = P.ty; out[o + 11] = P.tz;
  out[o + 12] = P.hx; out[o + 13] = P.hy; out[o + 14] = P.hz; out[o + 15] = 0;
  out[o + 16] = P.aL[0]; out[o + 17] = P.aL[1]; out[o + 18] = P.aL[2]; out[o + 19] = P.aL[3];
  out[o + 20] = P.aR[0]; out[o + 21] = P.aR[1]; out[o + 22] = P.aR[2]; out[o + 23] = P.aR[3];
  out[o + 24] = P.aL[4]; out[o + 25] = P.aR[4]; out[o + 26] = 0; out[o + 27] = 0;
  out[o + 28] = P.rx; out[o + 29] = P.ry; out[o + 30] = P.rz; out[o + 31] = 0;
  out[o + 32] = P.px; out[o + 33] = P.py; out[o + 34] = P.pz; out[o + 35] = 0;
  out[o + 36] = P.mx; out[o + 37] = P.my; out[o + 38] = P.mz; out[o + 39] = 0;
  return out;
}
