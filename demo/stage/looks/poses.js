// WHAT EACH DRUG LOOK DOES TO A BODY (looks-1). PURE: no page, no three. Each look's body is written here as a pose
// over time on the fight's own rig (demo/fight/puppet/rig.js: chest, head, two arms reaching for a fist's point, two
// feet on the ground, the pelvis, and a root that turns and moves the whole body), the way the fight's moves are, and
// the page sends it to the shader every frame (clip.js). Measured headless: test/drug-looks.test.mjs.
//
// WHAT THE GAME'S CAMERA ALLOWS (it looks 64 degrees down from 24 m; a person is about 70 pixels tall and a head is a
// metre wide over shoulders half that): the head itself (where it goes, how it tips), the whole body's lean and drop,
// what the body does on the ground, and an arm only when it is OUT past the head's edge (x beyond ±0.5 m): beside the
// head, flung wide, pointing up and out. So every look is told with the head, the hips and the arms out wide; hands in
// front of the chest are bonus for a low camera.
//
// THE OWNER'S STANDING NOTES, kept here: weight (a dip on the beat, the hips over the foot that is down, a body that
// settles when it lands), planted feet (a foot on the ground never slides: it moves only with a lift, along an arc),
// calm heads (no whip: every turn of the head is small and eased; on a body whose chest sways, the head is held nearer
// level than the chest).
//
//   MOVES[name] = { enter, exit, loop?, once?, pose(A, t, end, K), events? }
//     pose     writes the AUTHORED pose A (rig.js pose0's fields; the head told from level, each fist a point of the
//              chest's frame) for t seconds into the look, `end` seconds since it was taken off (null while on); K the
//              body's own numbers (phase, variant, beat), so no two bodies under one look move together
//     enter / exit   how long its start and its end take (s); `once`: it ends by itself after that many seconds
//   finish(A, out)  the authored pose → the rig's (the arms reached, the head on the chest)
//   ground(P)       a body off its feet set down on the ground: no point of it under, none floating
import { RIG, pose0, copyPose, armTo, chestTarget, fk, V } from '../../fight/puppet/rig.js';
import { E, ramp } from '../../fight/puppet/plan.js';

const TAU = Math.PI * 2;
const c01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, k) => a + (b - a) * k;
const to3 = (o, v, k) => {
  if (k <= 0) return;
  o[0] += (v[0] - o[0]) * k;
  o[1] += (v[1] - o[1]) * k;
  o[2] += (v[2] - o[2]) * k;
};
const set3 = (o, v) => {
  o[0] = v[0];
  o[1] = v[1];
  o[2] = v[2];
};
/** 0 → 1 → 0 over [a, b] */
const bump = (t, a, b) => E.bump((t - a) / (b - a));
/** A foot's way from one ground spot to another over [a, b]: z eased, lifted along an arc (`h` m at the top). */
function step(t, a, b, z0, z1, h = 0.06) {
  const k = ramp(t, a, b, E.s);
  return [lerp(z0, z1, k), h * E.bump((t - a) / (b - a)) * (Math.abs(z1 - z0) > 1e-4 ? 1 : 0)];
}

/** The plain stand, authored (pose0, the head from level). */
export function stand(A = pose0()) {
  const P = pose0();
  copyPose(P, A);
  return A;
}

/** The authored pose → the rig's, in `out`: the head from level put on the chest, each arm reached to its fist. */
export function finish(A, out = pose0()) {
  copyPose(A, out);
  out.hx = A.hx - A.tx;
  out.hy = A.hy - A.ty;
  out.hz = A.hz - A.tz;
  const L = armTo(A.hL, -1, A.pL, 1.95);
  const R = armTo(A.hR, 1, A.pR, 1.95);
  for (let i = 0; i < 5; i++) {
    out.aL[i] = L[i];
    out.aR[i] = R[i];
  }
  return out;
}

// ── a body off its feet, on the ground ────────────────────────────────────────────────────────────────────────────
const root = (P, p) => {
  const piv = [P.px, P.py, P.pz];
  return V.add(V.add(piv, V.rY(P.ry, V.rX(P.rx, V.rZ(P.rz, V.sub(p, piv))))), [P.mx, P.my, P.mz]);
};
const H = RIG.head;
const HEAD_PTS = [];
for (const x of [-H.x, H.x]) for (const y of [H.y0, H.y1]) for (const z of [H.z0, H.z1]) HEAD_PTS.push([x * 0.94, y, z * 0.94]);
/** The lowest point of a (finished) pose, in the body frame: the head's box, the shoulders, the hips, the feet. */
export function lowest(P) {
  const F = fk(P);
  let y = Infinity;
  for (const p of HEAD_PTS) y = Math.min(y, F.headAt(p)[1]);
  y = Math.min(y, F.shL[1], F.shR[1], F.hip[1]);
  for (const [f, sx] of [[P.fL, -1], [P.fR, 1]]) {
    for (const dz of [-0.17, 0.27]) y = Math.min(y, root(P, [sx * (RIG.hipX + 0.05), f[1], f[0] + dz])[1]);
  }
  return y;
}
/**
 * Set a body off its feet down: `k` 0..1 how much of it is lying (0: only lifted out of the ground if a point is under;
 * 1: its lowest point exactly on the ground). Writes P.my.
 */
export function ground(P, k = 1) {
  P.my = 0;
  const y = lowest(P);
  P.my = y < 0 ? -y : -y * c01(k);
  return P;
}

// ── ZONKED: asleep where they stand ───────────────────────────────────────────────────────────────────────────────
// Drowsy first: the body sways in a slow circle on its feet and the head lolls from side to side (side to side is
// what the game's camera sees best), drooping, jerked up once, drooping again. Then the knees give: down into a deep
// crouch, a beat there with a hand out to the ground, and over onto their side, slowly, curling up as they go, an arm
// under the head: settling down to sleep, not a fall. Asleep they breathe (the top shoulder rises and falls) and a
// foot twitches now and then. Taken off: they stir, push up to a crouch with the hand on the ground, stand, stretch
// both arms out wide past the head with the head back (the yawn), shake the head, and are themselves.
/** How far over they lie (rad, the root's roll about the outer edge of the foot they go down on). */
const ZONK_ROLL = 1.12;
const ZONK = {
  enter: 5.6,
  exit: 4.6,
  pose(A, t, end, K) {
    const side = K.side ?? -1; // (−1: down on the L side, +1 the R)
    const s = side < 0 ? 1 : -1;
    const ph = (K.phase ?? 0) * TAU;
    // drowsy: a sway that grows, the head drooping; a startle at 1.3 s
    const drowse = ramp(t, 0, 1.0, E.s) * (1 - ramp(t, 2.4, 3.0, E.s));
    const startle = E.hit((t - 1.3) / 0.6, 0.25);
    const droop = ramp(t, 0.1, 1.2, E.s) * (1 - startle) + ramp(t, 1.7, 2.6, E.s) * 0.4;
    const swayA = Math.sin((TAU * t) / 1.7 + ph);
    const swayB = Math.sin((TAU * t) / 1.7 + ph - 1.1);
    const crouch = ramp(t, 2.4, 3.2, E.s);
    const reach = ramp(t, 2.9, 3.5, E.s);
    const tip = ramp(t, 3.55, 5.05, E.s);
    const land = bump(t, 4.9, 5.5);
    const curl = ramp(t, 3.7, 5.4, E.s);
    // the wake (end: seconds since it was taken off)
    const e = end ?? -1;
    const stir = ramp(e, 0, 0.8, E.s);
    const up = ramp(e, 0.6, 2.4, E.s);
    const rise = ramp(e, 2.2, 3.0, E.s);
    const yawn = ramp(e, 2.8, 3.3, E.s) * (1 - ramp(e, 3.9, 4.3, E.s));
    const shake = ramp(e, 3.8, 4.1, E.s) * (1 - ramp(e, 4.3, 4.6, E.s));
    const down = tip * (1 - up);
    const knees = crouch * (1 - rise);
    const lying = curl * (1 - up);
    // asleep: the breath, slow, and a twitch of a foot every so often
    const ts = Math.max(0, t - 5.4);
    const br = Math.sin((TAU * ts) / 3.4 + ph) * c01(ts / 1.5) * (1 - stir);
    const tw = E.bump(((ts + (K.phase ?? 0) * 7) % 7.3) / 0.45) * (ts > 3 ? 1 : 0) * (1 - stir);
    // ── the body: swaying on its feet, then low, then lying curled
    A.bx = 0.07 * swayA * drowse;
    A.pr = 0.1 * swayA * drowse;
    A.tz = -0.2 * swayB * drowse;
    A.drop = 0.04 * drowse + 0.3 * knees - 0.06 * lying + 0.12 * lying;
    A.tx = 0.12 * droop * drowse + 0.35 * knees * (1 - tip) + 0.42 * lying + 0.025 * br - 0.08 * yawn;
    // the head: lolling side to side and drooping; tucked in asleep; up and back for the yawn, a shake after
    A.hz = 0.3 * swayB * drowse * (0.4 + droop) + 0.12 * s * lying;
    A.hx = 0.5 * droop * (1 - knees) + 0.3 * knees * (1 - tip) + 0.32 * lying - 0.42 * yawn + 0.03 * br - 0.15 * startle;
    A.hy = 0.16 * Math.sin((e - 3.8) * 12) * shake;
    // the arms: hanging heavy and swinging with the sway; one out to the ground at the crouch, folded under the head
    // asleep; the other over the body
    const heavy = drowse * (1 - crouch);
    const [near, nearP, far, farP] = side < 0 ? [A.hL, A.pL, A.hR, A.pR] : [A.hR, A.pR, A.hL, A.pL];
    to3(A.hL, [-0.3 + 0.06 * swayA, 0.42, 0.06], heavy);
    to3(A.hR, [0.3 + 0.06 * swayA, 0.42, 0.06], heavy);
    to3(near, [side * 0.64, 0.4, 0.26], reach * (1 - curl));
    to3(nearP, [side, 0, -0.6], reach * (1 - curl));
    to3(far, [-side * 0.2, 0.5, 0.32], crouch * (1 - curl));
    to3(near, [side * 0.36, 0.98, 0.42], lying * (1 - stir));
    to3(nearP, [side, -0.6, -0.4], lying * (1 - stir));
    to3(far, [side * 0.1, 0.62, 0.36], lying * (1 - stir));
    to3(farP, [-side, 0.3, -0.4], lying * (1 - stir));
    // (pushing up off the ground with the near hand)
    const push = bump(e, 0.4, 2.6);
    to3(near, [side * 0.64, 0.42, 0.18], push);
    to3(nearP, [side, 0.2, -0.6], push);
    // the yawn: both arms out wide and up, past the head
    to3(A.hL, [-0.66, 1.06, 0.02], yawn);
    to3(A.hR, [0.66, 1.06, 0.02], yawn);
    to3(A.pL, [-1, -0.2, -0.5], yawn);
    to3(A.pR, [1, -0.2, -0.5], yawn);
    // the feet: drawn up under them as they curl (a foot lifted only while it moves); a twitch
    const fz = 0.16 * lying;
    A.fL[0] = fz;
    A.fR[0] = fz + 0.06 * lying;
    A.fR[1] = 0.04 * tw * down;
    A.fR[2] = -0.4 * lying - 0.3 * tw * down;
    A.fL[2] = -0.4 * lying - 0.25 * knees * (1 - tip);
    // the root: over onto the near side about the outer edge of that foot, on the ground
    A.px = side * (RIG.hipX + 0.06);
    A.py = 0;
    A.pz = 0.05;
    A.rz = -side * (ZONK_ROLL * down + 0.05 * land * (1 - up) + 0.012 * br);
    A.rx = 0.08 * down;
  },
  /** after finish: on the ground, by how much they are down */
  after(P, t, end) {
    const tip = ramp(t, 3.55, 5.05, E.s);
    const up = ramp(end ?? -1, 0.6, 2.4, E.s);
    ground(P, tip * (1 - up));
  },
};

// ── DISCO RASH: cannot stop dancing ───────────────────────────────────────────────────────────────────────────────
// A real dance loop on the beat: the knees dip on every beat (the weight), the hips go over the foot that is down every
// two beats and the other foot taps out and back (lifted as it goes, set down where it taps), the chest leans against
// the hips. The arms change every two bars between four moves the camera can see: the groove (fists out at the hips,
// swinging), raise the roof (both fists pumped up beside the head), the disco point (up and out past the head, then
// down across), and the wave (both arms out wide, rolling). Each dancer has its own order of the moves, its own
// tempo near the others' and its own place in the beat, so a crowd that catches it never moves as one.
const DANCE_MOVES = ['groove', 'roof', 'point', 'wave'];
function danceArms(name, A, phi, f, k, side) {
  if (k <= 0) return;
  const pump = 0.5 + 0.5 * Math.cos(TAU * f);
  if (name === 'groove') {
    const sw = Math.sin(Math.PI * phi);
    to3(A.hL, [-0.46 + 0.07 * sw, 0.58 + 0.07 * pump, 0.2], k);
    to3(A.hR, [0.46 + 0.07 * sw, 0.58 + 0.07 * pump, 0.2], k);
    to3(A.pL, [-1, -0.2, -0.7], k);
    to3(A.pR, [1, -0.2, -0.7], k);
  } else if (name === 'roof') {
    const up = 0.5 + 0.5 * Math.cos(TAU * f - 0.6);
    to3(A.hL, [-0.6, 0.98 + 0.17 * up, 0.06], k);
    to3(A.hR, [0.6, 0.98 + 0.17 * up, 0.06], k);
    to3(A.pL, [-1, -0.5, -0.2], k);
    to3(A.pR, [1, -0.5, -0.2], k);
  } else if (name === 'point') {
    // (on the beat up and out past the head; on the next across and down; the other hand on the hip)
    const n = Math.floor(phi);
    const into = E.out(c01(f / 0.35));
    const hi = [side * 0.66, 1.16, 0.14];
    const lo = [-side * 0.14, 0.44, 0.3];
    const [a, b] = n % 2 === 0 ? [lo, hi] : [hi, lo];
    // (by way of out wide and low, never through the head: a straight line from across the hip to up and out goes
    // through its lower front corner)
    const c = [side * 0.74, 0.62, 0.3];
    const p = [0, 1, 2].map(i => lerp(lerp(a[i], c[i], into), lerp(c[i], b[i], into), into));
    const [h, pp, o, op] = side > 0 ? [A.hR, A.pR, A.hL, A.pL] : [A.hL, A.pL, A.hR, A.pR];
    to3(h, p, k);
    to3(pp, [side, -0.3, -0.4], k);
    to3(o, [-side * 0.38, 0.52, -0.02], k);
    to3(op, [-side, 0.1, -0.8], k);
  } else if (name === 'wave') {
    const w = Math.sin(Math.PI * phi);
    to3(A.hL, [-0.67, 0.86 + 0.2 * w, 0.06], k);
    to3(A.hR, [0.67, 0.86 - 0.2 * w, 0.06], k);
    to3(A.pL, [-1, -0.6, -0.3], k);
    to3(A.pR, [1, -0.6, -0.3], k);
  }
}
const DISCO = {
  enter: 1.4,
  exit: 1.2,
  pose(A, t, end, K) {
    const beat = K.beat ?? 0.52;
    const phi = t / beat + (K.phase ?? 0) * 4;
    const f = phi - Math.floor(phi);
    // in: a shiver, then the feet go; out: it winds down to a stand
    const amp = ramp(t, 0.25, 1.4, E.s) * (1 - ramp(end ?? -1, 0, 1.2, E.s));
    const shiver = bump(t, 0, 0.7) * Math.sin(t * 38) * (1 - ramp(end ?? -1, 0, 0.3));
    // the dip on the beat (down on it, quick; up slower), the weight from foot to foot every two beats
    const dip = Math.pow(1 - f, 2.2);
    const sw = Math.sin(Math.PI * phi);
    A.drop = (0.025 + 0.055 * dip) * amp;
    A.bx = 0.075 * sw * amp;
    A.pr = 0.13 * sw * amp;
    A.tz = (-0.1 * sw) * amp + 0.04 * shiver;
    A.tx = (0.07 + 0.03 * dip) * amp;
    A.ty = 0.16 * Math.sin(Math.PI * phi + 0.9) * amp + 0.05 * shiver;
    // the head: a nod on the beat, held nearer level than the chest, a small tilt with the groove
    A.hx = (0.04 + 0.08 * dip) * amp;
    A.hz = 0.07 * sw * amp;
    A.hy = 0.06 * Math.sin(Math.PI * phi * 0.5) * amp;
    // the feet: the one the weight is off taps out ahead and back, lifted while it moves, on its toe when out
    for (const [foot, sd] of [[A.fL, -1], [A.fR, 1]]) {
      const free = c01(-sd * sw);
      const k = E.s(free);
      foot[0] = 0.12 * k * amp;
      foot[1] = 0.04 * Math.sin(Math.PI * k) * amp;
      foot[2] = -0.32 * k * amp;
    }
    // the arms: two bars of each move, crossfaded over half a beat
    const order = K.order ?? DANCE_MOVES;
    const bars = phi / 8;
    const m = Math.floor(bars);
    const into = (bars - m) * 8;
    const cur = order[((m % order.length) + order.length) % order.length];
    const prev = order[(((m - 1) % order.length) + order.length) % order.length];
    const x = E.s(c01(into / 0.6));
    const side = K.hand ?? 1;
    // (the arms hang heavy and swing a little with the hips before the dance takes them)
    to3(A.hL, [-0.36, 0.42, 0.06], 0.4 * shiver * shiver);
    danceArms(prev, A, phi, f, amp * (1 - x), side);
    danceArms(cur, A, phi, f, amp * x, side);
  },
};

// ── THE PUKES: a batch gone wrong ─────────────────────────────────────────────────────────────────────────────────
// A gulp (a hand to the belly, the head jerks), doubled over with the hands on the knees, three heaves (each one the
// whole body contracting, and a green spray off the mouth onto the ground in front: `events`), up slowly with a wipe
// of the mouth and the head turned away, then a sour stagger: a step back, the arms out for balance, a step back with
// the other foot, and back again to where they stood, a hand on the belly. 6.4 s, then themselves.
const HEAVES = [1.05, 1.75, 2.55];
const PUKES = {
  enter: 0,
  exit: 0.6,
  once: 6.4,
  events: [
    { at: HEAVES[0] + 0.06, kind: 'puke', n: 50, speed: 3.8 },
    { at: HEAVES[1] + 0.06, kind: 'puke', n: 70, speed: 4.4 },
    { at: HEAVES[2] + 0.06, kind: 'puke', n: 26, speed: 2.6 },
  ],
  pose(A, t, end) {
    const gulp = bump(t, 0.0, 0.45);
    const over = ramp(t, 0.35, 0.95, E.s) * (1 - ramp(t, 2.95, 3.8, E.s));
    const half = ramp(t, 2.95, 3.8, E.s) * (1 - ramp(t, 5.4, 6.4, E.s));
    let heave = 0;
    for (const h of HEAVES) heave = Math.max(heave, E.hit((t - h) / 0.5, 0.22));
    const wipe = bump(t, 3.0, 3.9);
    // (the stagger: R back, L back, R home, L home)
    const [zR1, lR1] = step(t, 3.85, 4.2, 0, -0.26, 0.07);
    const [zL1, lL1] = step(t, 4.2, 4.58, 0, -0.2, 0.07);
    const [zR2, lR2] = step(t, 4.75, 5.1, -0.26, 0, 0.06);
    const [zL2, lL2] = step(t, 5.1, 5.45, -0.2, 0, 0.05);
    const gR = t < 4.75 ? zR1 : zR2;
    const gL = t < 5.1 ? zL1 : zL2;
    // (the hips go back with the feet: over the middle of the two, as they stand)
    const mz = (gR + gL) / 2;
    const wob = ramp(t, 3.85, 4.1) * (1 - ramp(t, 5.3, 5.9));
    const out = ramp(end ?? -1, 0, 0.6, E.s);
    const k = 1 - out;
    A.mz = mz * k;
    A.fR[0] = (gR - mz) * k;
    A.fR[1] = (t < 4.75 ? lR1 : lR2) * k;
    A.fL[0] = (gL - mz) * k;
    A.fL[1] = (t < 5.1 ? lL1 : lL2) * k;
    // the body
    A.tx = (0.12 * gulp + 0.78 * over + 0.16 * heave * over + 0.24 * half + 0.05 * wob) * k;
    A.drop = (0.1 * over + 0.05 * heave * over + 0.05 * half + 0.03 * wob) * k;
    A.tz = 0.16 * Math.sin((t - 3.85) * 5.2) * wob * k;
    A.pr = -0.08 * Math.sin((t - 3.85) * 5.2) * wob * k;
    // the head: jerked, then hung over the ground; each heave thrusts it forward and down; turned away for the wipe
    A.hx = (0.28 * gulp + 0.72 * over + 0.22 * heave * over + 0.3 * half) * k;
    A.hy = (-0.22 * wipe + 0.1 * Math.sin((t - 3.85) * 3.1) * wob) * k;
    A.hz = 0.08 * Math.sin((t - 3.85) * 4.1) * wob * k;
    // the arms: belly and mouth at the gulp; on the knees doubled over; the wipe; out wide in the stagger; the belly
    to3(A.hR, [0.08, 0.56, 0.3], gulp * k);
    to3(A.hL, [-0.12, 0.8, 0.34], gulp * k);
    if (over > 0) {
      const kn = chestTarget(A, [0.17, 0.33, 0.2]);
      const knL = chestTarget(A, [-0.17, 0.33, 0.2]);
      to3(A.hR, kn, over * k);
      to3(A.hL, knL, over * k);
      to3(A.pR, [1, 0.2, -0.6], over * k);
      to3(A.pL, [-1, 0.2, -0.6], over * k);
    }
    to3(A.hR, [-0.12 + 0.3 * (1 - ramp(t, 3.0, 3.9)), 0.84, 0.4], wipe * k);
    to3(A.hL, [-0.66, 0.84, 0.04], wob * k);
    to3(A.hR, [0.64, 0.8, 0.02], wob * (1 - wipe) * k);
    to3(A.pL, [-1, -0.5, -0.3], wob * k);
    to3(A.pR, [1, -0.5, -0.3], wob * k);
    to3(A.hR, [0.06, 0.56, 0.3], half * (1 - wob) * k);
  },
};

// ── COOKED: red, steaming, squaring up ────────────────────────────────────────────────────────────────────────────
// The body tenses (the shoulders up, the fists balled), then a fighter's stance toward whoever is nearest, bouncing
// on the balls of the feet with the fists up, and every couple of seconds a "come on then": a step in with the arms
// flung wide and the chest pushed out, and back. (The red is the skin; the steam and the vein over the head are bits.)
const COME = 2.6;
const COOKED = {
  enter: 1.0,
  exit: 1.0,
  pose(A, t, end, K) {
    const ph = (K.phase ?? 0) * 3;
    // the come-on, every COME s once it is on: step in with the lead foot, arms wide, chest out; and back. One begun when
    // it is taken off is finished first (the way out starts after it)
    const cyc = tt => (tt - 1.0 - ph >= 0 ? (tt - 1.0 - ph) % COME : -1);
    const tOff = end === null ? Infinity : t - end;
    const c0 = cyc(tOff);
    const late = c0 >= 1.1 && c0 < 1.95 ? 1.95 - c0 : 0;
    const e = end === null ? -1 : end - late;
    const live = end === null || e < 0;
    const tense = ramp(t, 0, 0.5, E.out) * (1 - ramp(e, 0, 0.6));
    const on = ramp(t, 0.4, 1.0, E.s) * (1 - ramp(e, 0, 1.0, E.s));
    const k = Math.max(tense, on);
    const bob = 0.5 - 0.5 * Math.cos((TAU * (t + ph)) / 0.62);
    // the feet: into the stance a foot at a time (each lifted while it moves), out of it the same way
    let [gL, lL] = step(t, 0.3, 0.6, 0, 0.14, 0.05);
    let [gR, lR] = step(t, 0.55, 0.85, 0, -0.12, 0.05);
    if (!live) {
      [gR, lR] = step(e, 0, 0.3, -0.12, 0, 0.05);
      [gL, lL] = step(e, 0.3, 0.6, 0.14, 0, 0.05);
    }
    const c = live ? cyc(t) : -1;
    let come = 0;
    if (c >= 0) {
      [gL, lL] = c < 1.55 ? step(c, 1.1, 1.4, 0.14, 0.34, 0.06) : step(c, 1.6, 1.95, 0.34, 0.14, 0.05);
      come = E.bump((c - 1.1) / 0.85);
    }
    // (the hips over the middle of the two feet)
    A.mz = (gL + gR) / 2;
    A.fL[0] = gL - A.mz;
    A.fL[1] = lL;
    A.fR[0] = gR - A.mz;
    A.fR[1] = lR;
    A.fR[2] = -0.25 * bob * on * (lR > 0 ? 0 : 1);
    A.fL[2] = -0.15 * bob * on * (lL > 0 ? 0 : 1);
    A.drop = (0.05 + 0.03 * bob) * k;
    A.tx = (0.16 - 0.3 * come) * k;
    A.ty = 0.3 * k * (1 - come);
    A.hx = (0.22 - 0.25 * come) * k;
    A.hy = -0.1 * k * (1 - come);
    // the guard: lead fist out, rear one cocked; shoulders up at the tensing
    to3(A.hL, [-0.17, 0.8, 0.4], k);
    to3(A.hR, [0.46, 0.72, 0.14], k);
    to3(A.pL, [-1, -0.8, 0.1], k);
    to3(A.pR, [1, -0.3, -0.5], k);
    to3(A.hL, [-0.68, 0.78, 0.12], come);
    to3(A.hR, [0.68, 0.78, 0.12], come);
    to3(A.pL, [-1, -0.4, -0.4], come);
    to3(A.pR, [1, -0.4, -0.4], come);
  },
};

export const MOVES = { zonk: ZONK, disco: DISCO, pukes: PUKES, cooked: COOKED };
export const DANCES = DANCE_MOVES;

/** A body's pose for a look now: authored, finished, set down. `A`, `P`: scratch poses (rig.js pose0). → P */
export function lookPose(name, t, end, K = {}, A = pose0(), P = pose0()) {
  const M = MOVES[name];
  stand(A);
  if (M) M.pose(A, t, end, K);
  finish(A, P);
  if (M?.after) M.after(P, t, end, K);
  else ground(P, 0);
  return P;
}
