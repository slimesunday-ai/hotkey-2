// THE FIGHT'S MOVES, KEYED BY HAND (anim-1). Every stance, blow, cover, stagger, fall and getting up of a fight the page
// plays is written here as a pose over time on the rig's own joints (rig.js), for a body that leads with its L side
// (a southpaw is the mirror, fighter.js). choreo.js decides who does which when and where the bodies are; this file is
// what each looks like.
//
// WHAT THE CAMERA ALLOWS. The game looks down from high up and a head is half the figure, 1 m wide over shoulders half
// that: a fist at the chest is under the head's own roof. What does show: the head itself (where it goes, how it tips:
// a head knocked back shows its face to the sky), the whole body's lean and turn, the feet, and an arm only when it is
// LONG and OUT: swung wide of the head on the side the camera is, held low at the hip, raised beside the head, or
// driven out past the face. So each one's STRONG hand is kept on the camera's side (choreo.js picks who is the
// southpaw), it is carried where it can be seen, blows are thrown with the whole body behind a long arm, and every
// blow that lands is answered by the other's head and feet.
//
// HOW A BLOW IS KEYED. Time runs on `s`, seconds from CONTACT (the tick the rules land it: s < 0 before). Four parts,
// each with its own easing: the WIND-UP (weight back onto the rear foot, the chest coiled away, the fist drawn back:
// slow out, held a beat), the THROW (weight driven forward, the chest unwinding first, the arm a beat behind it and
// straightening last, fastest at contact), the FOLLOW-THROUGH (what the arm and chest do with the speed they still
// have: through and across on a miss, checked short on a hit), the RECOVERY (back under the guard, the weight to the
// middle). The fist is keyed as a POINT of the chest's frame (shoulders at x ±0.25, y 0.825; the head's box over them
// from y 0.9, x ±0.5, z −0.35 to 0.45); on a hit it is put on the very place of the other it strikes (body.js reach).
import { E, ramp } from './plan.js';

const TAU = Math.PI * 2;
const m3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
/** A point along a curve from a to b that bows through c. */
const bow = (a, c, b, k) => m3(m3(a, c, k), m3(c, b, k), k);
const set3 = (o, v) => { o[0] = v[0]; o[1] = v[1]; o[2] = v[2]; };
const to3 = (o, v, k) => { o[0] += (v[0] - o[0]) * k; o[1] += (v[1] - o[1]) * k; o[2] += (v[2] - o[2]) * k; };
const c01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);

// ── THE GUARDS: how each stands when nothing is happening to them ────────────────────────────────────────────────────
// tx the lean, ty the chest bladed (the lead shoulder forward), drop the knees, hx the chin; the two fists and where
// their elbows point; `bob` the bounce [s, m], `sway` the weight going side to side [s, m], `life` how much the hands
// drift. split / blade: the feet (fighter.js). gap: how far off they like to stand (m, hips to hips). strong: which
// hand is theirs to hit with ('R' the rear one, 'L' the lead one: a blade is carried in front).
// blows: what they throw, with how often ([name, share]); big: what they throw when it is going to hurt.
export const GUARDS = {
  // YOU, bare hands: a street boxer. Upright enough to see, the lead fist out as a feeler, the right cocked wide.
  hands: { tx: 0.13, ty: 0.3, drop: 0.03, hx: 0.1, hL: [-0.15, 0.8, 0.4], pL: [-1, -0.8, 0.1], hR: [0.44, 0.7, 0.14], pR: [1, -0.3, -0.5], bob: [0.62, 0.014], sway: [2.2, 0.014], life: 1, split: 0.26, blade: 0.2, gap: 1.58,
    blows: [['cross', 40], ['hook', 30], ['jab', 18], ['rip', 12]], big: 'hook' },
  // YOU, quick hands: up on the toes, both hands high and close, the lead one flicking.
  jab: { tx: 0.1, ty: 0.42, drop: 0.035, hx: 0.12, hL: [-0.13, 0.83, 0.42], pL: [-1, -0.9, 0], hR: [0.3, 0.8, 0.24], pR: [1, -0.8, -0.2], bob: [0.4, 0.02], sway: [1.4, 0.02], life: 1.6, split: 0.3, blade: 0.3, gap: 1.62,
    blows: [['jab', 60], ['cross', 40]], big: 'cross', combo: true },
  // YOU, the haymaker: sat back on the rear leg, the right hanging low and far back like a weight on a rope.
  haymaker: { tx: 0.1, ty: 0.5, drop: 0.045, hx: 0.08, hL: [-0.12, 0.78, 0.42], pL: [-1, -0.7, 0.1], hR: [0.48, 0.5, -0.04], pR: [1, 0.1, -0.7], bob: [0.9, 0.012], sway: [2.6, 0.02], life: 0.7, split: 0.3, blade: 0.22, gap: 1.64, sz: -0.04,
    blows: [['hay', 100]], big: 'hay' },
  // YOU, the throw: square and low, both hands open in front to take hold.
  throw: { tx: 0.24, ty: 0.08, drop: 0.06, hx: -0.02, hL: [-0.3, 0.7, 0.36], pL: [-1, -0.5, -0.2], hR: [0.32, 0.68, 0.34], pR: [1, -0.5, -0.2], bob: [0.8, 0.012], sway: [1.7, 0.026], life: 1.1, split: 0.14, blade: 0.06, gap: 1.52,
    blows: [['throw', 100]], big: 'throw' },
  // A BLADE (your box cutter, the knife's knife): low, the blade hand out in front and down, the other up to cover.
  blade: { tx: 0.24, ty: 0.34, drop: 0.07, hx: 0, hL: [-0.3, 0.52, 0.44], pL: [-1, -0.5, -0.5], hR: [0.24, 0.8, 0.24], pR: [1, -0.8, -0.1], bob: [0.7, 0.012], sway: [1.5, 0.03], life: 1.5, split: 0.3, blade: 0.3, gap: 1.68, strong: 'L', held: 'blade',
    blows: [['slash', 45], ['backslash', 25], ['stab', 30]], big: 'slash' },
  // THE BRAWLER: a plain puncher, heavier and squarer than you, chin down behind his shoulders.
  fists: { tx: 0.18, ty: 0.24, drop: 0.04, hx: 0.16, hL: [-0.2, 0.78, 0.36], pL: [-1, -0.6, 0], hR: [0.46, 0.68, 0.1], pR: [1, -0.2, -0.6], bob: [0.75, 0.012], sway: [2.4, 0.018], life: 0.8, split: 0.24, blade: 0.16, gap: 1.58,
    blows: [['hook', 42], ['cross', 33], ['rip', 25]], big: 'hook' },
  // THE BIG MAN: upright, square, arms hanging wide off a barrel chest; he does not bounce, he breathes.
  mauler: { tx: 0.04, ty: 0.06, drop: 0.0, hx: 0.06, hL: [-0.5, 0.5, 0.1], pL: [-1, 0, -0.5], hR: [0.5, 0.48, 0.06], pR: [1, 0, -0.5], bob: [1.7, 0.012], sway: [3.4, 0.03], life: 0.3, split: 0.1, blade: 0.04, gap: 1.62, heavy: true,
    blows: [['club', 62], ['shove', 38]], big: 'club' },
  // THE QUICK ONE: never still. High on the toes, hands up by the face, the whole body bobbing.
  quickfists: { tx: 0.08, ty: 0.46, drop: 0.03, hx: 0.1, hL: [-0.12, 0.84, 0.4], pL: [-1, -0.9, 0], hR: [0.26, 0.82, 0.26], pR: [1, -0.9, -0.1], bob: [0.34, 0.026], sway: [0.95, 0.032], life: 2, split: 0.3, blade: 0.34, gap: 1.78, darts: true,
    blows: [['jab', 64], ['cross', 36]], big: 'cross' },
  // THE GRABBER: a wrestler's crouch, bent at the waist, both arms open and reaching.
  grab: { tx: 0.34, ty: 0.02, drop: 0.07, hx: -0.14, hL: [-0.4, 0.64, 0.34], pL: [-1, -0.3, -0.3], hR: [0.42, 0.62, 0.32], pR: [1, -0.3, -0.3], bob: [1.1, 0.014], sway: [1.5, 0.04], life: 1.3, split: 0.08, blade: 0.0, gap: 1.50,
    blows: [['clinch', 100]], big: 'clinch' },
  // A RUNNER'S SHIV: the quick one with a point: side on, the point low and forward.
  shiv: { tx: 0.2, ty: 0.4, drop: 0.05, hx: 0.04, hL: [-0.28, 0.54, 0.44], pL: [-1, -0.6, -0.4], hR: [0.24, 0.8, 0.22], pR: [1, -0.8, -0.1], bob: [0.38, 0.022], sway: [1.0, 0.03], life: 1.8, split: 0.3, blade: 0.34, gap: 1.72, strong: 'L', held: 'shiv', darts: true,
    blows: [['stab', 70], ['slash', 30]], big: 'stab' },
};
// COUSIN EARL'S TIRE IRON: carried low at his side in the strong hand, the other out in front to fend; he swings it.
GUARDS.pipe = { tx: 0.14, ty: 0.34, drop: 0.035, hx: 0.1, hL: [-0.2, 0.78, 0.38], pL: [-1, -0.7, 0.1], hR: [0.5, 0.52, 0.08], pR: [1, 0, -0.7], bob: [0.8, 0.012], sway: [2.3, 0.02], life: 0.8, split: 0.26, blade: 0.2, gap: 1.72, held: 'pipe',
  blows: [['hook', 55], ['club', 45]], big: 'club' };
GUARDS.knuckles = GUARDS.fists;

/** The guard of a style on a pose: G the style's numbers, `ph` the body's own phase (two bodies never bob together). */
export function guard(P, t, G, ph = 0, k = 1) {
  if (k <= 0) return;
  const [bp, ba] = G.bob;
  const [sp, sa] = G.sway;
  const b = 0.5 - 0.5 * Math.cos((TAU * (t + ph)) / bp);
  const sw = Math.sin((TAU * (t + ph * 1.7)) / sp);
  const br = Math.sin((TAU * (t + ph)) / 3.3);
  P.tx += (G.tx + 0.012 * br) * k;
  P.ty += G.ty * k;
  P.drop += (G.drop + ba * b) * k;
  P.hx += (G.hx - 0.02 * b) * k;
  P.sx += sa * sw * k;
  P.sz += (G.sz ?? 0) * k;
  P.tz += -0.5 * sa * sw * k;
  P.hz += 0.9 * sa * sw * k;
  const L = G.life;
  const d1 = Math.sin((TAU * (t + ph)) / 0.83);
  const d2 = Math.cos((TAU * (t + ph)) / 1.07);
  to3(P.hL, [G.hL[0] + 0.008 * L * d2, G.hL[1] + 0.012 * L * d1 - 0.5 * ba * b, G.hL[2] + 0.012 * L * d2], k);
  to3(P.hR, [G.hR[0] - 0.008 * L * d1, G.hR[1] + 0.01 * L * d2 - 0.5 * ba * b, G.hR[2] + 0.008 * L * d1], k);
  to3(P.pL, G.pL, k);
  to3(P.pR, G.pR, k);
}

// ── BLOWS ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Each: ant / go / fol / rec the seconds of its four parts as it likes them (choreo.js may give it less wind-up);
// lunge how far the front foot steps in for it (m: the hips go half of that, the back foot stays); hand which fist
// ('S' the strong one, 'W' the other); at where on the other it lands ('face', 'corner' the near front corner of the
// head, 'crown', 'body', 'ribs'); weight 0..1 what it does to them; cover what the other may do about one that misses.
// pose(P, s, K): K { ant, go, fol, rec, hit, G (the guard's numbers), tgt (the world point it lands on) }; S and W are
// the pose's fist and elbow of the strong and the other hand (hS, pS, hW, pW), and `x` +1 when the strong hand is R.
const part = (s, K) => {
  const a = ramp(s, -K.go - K.ant, -K.go - K.ant * 0.22, E.s);
  const g = ramp(s, -K.go, 0, E.in);
  const f = ramp(s, 0, K.fol, E.out);
  const r = ramp(s, K.fol, K.fol + K.rec, E.s);
  return { a, g, f, r, live: 1 - r };
};
/** The strong hand's and the other's fields of a pose, and the sign that turns "toward the strong side" into the body's own. */
const hands = (P, G) => {
  const R = (G.strong ?? 'R') === 'R';
  return R ? { hS: P.hR, pS: P.pR, hW: P.hL, pW: P.pL, gS: G.hR, gW: G.hL, gpS: G.pR, x: 1, reach: 'reachR', reachW: 'reachL' } : { hS: P.hL, pS: P.pL, hW: P.hR, pW: P.pR, gS: G.hL, gW: G.hR, gpS: G.pL, x: -1, reach: 'reachL', reachW: 'reachR' };
};
const X = (v, x) => [v[0] * x, v[1], v[2]];

export const BLOWS = {
  // THE CROSS: the strong hand straight down the middle with the hips behind it.
  cross: {
    ant: 0.17, go: 0.09, fol: 0.1, rec: 0.26, lunge: 0.26, hand: 'S', at: 'face', weight: 0.55, cover: ['slip', 'block', 'pull'],
    pose(P, s, K) {
      const { a, g, f, live } = part(s, K);
      const { r } = part(s, K);
      const G = K.G;
      const H = hands(P, G);
      const x = H.x;
      const arm = ramp(s, -K.go * 0.75, 0, E.in);
      P.sz += -0.07 * a * (1 - g) + 0.07 * g * live;
      P.drop += 0.03 * a * (1 - g) + 0.015 * g * live;
      P.ty += x * (0.4 * a * (1 - g) - (x * G.ty + 0.62) * g * live - (K.hit ? 0.05 : 0.22) * f * live);
      P.tx += 0.04 * a + 0.2 * g * live + (K.hit ? 0 : 0.1) * f * live;
      P.tz += -x * 0.06 * g * live;
      P.hx += 0.06 * a + 0.1 * g * live;
      let h = m3(H.gS, X([0.38, 0.8, -0.06], x), a);
      h = m3(h, X(K.hit ? [0.02, 0.86, 0.45] : [-0.08, 0.84, 0.45], x), arm);
      h = m3(h, H.gS, r);
      set3(H.hS, h);
      set3(H.pS, m3(m3(H.gpS, X([1, 0.1, -0.7], x), a), X([1, -0.9, 0], x), arm * live));
      if (K.hit) P[H.reach] = { at: K.tgt, k: arm * (1 - ramp(s, 0.03, K.fol, E.s)) };
      // (the other hand comes back to the chin as this one goes: one out, one home)
      to3(H.hW, X([-0.2, 0.82, 0.2], x), g * live);
    },
  },
  // THE HOOK: the strong hand swung round wide, long-armed, on the side the camera sees; the whole body turns through.
  hook: {
    ant: 0.2, go: 0.11, fol: 0.15, rec: 0.3, lunge: 0.24, hand: 'S', at: 'corner', weight: 0.8, cover: ['duck', 'block', 'pull'],
    pose(P, s, K) {
      const { a, g, f, r, live } = part(s, K);
      const G = K.G;
      const H = hands(P, G);
      const x = H.x;
      const arm = ramp(s, -K.go * 0.92, 0, E.in);
      P.sz += -0.08 * a * (1 - g) + 0.06 * g * live;
      P.sx += x * (0.03 * a * (1 - g) - 0.03 * g * live);
      P.drop += 0.045 * a * (1 - g) + 0.01 * g * live;
      // coiled right round to the back, then all the way through
      P.ty += x * (0.55 * a * (1 - g) - (x * G.ty + 0.74) * g * live - (K.hit ? 0.08 : 0.42) * f * live);
      P.tx += 0.06 * a + 0.14 * g * live + (K.hit ? 0 : 0.14) * f * live;
      P.tz += x * (0.07 * a * (1 - g) - 0.12 * g * live);
      P.hx += 0.08 * a + 0.06 * g * live;
      P.hz += -x * 0.08 * g * live;
      // the fist: dropped back and out (wide of the hip, where the camera has it) → out to the side at full length →
      // round to the front → across
      let h = m3(H.gS, X([0.52, 0.6, -0.16], x), a);
      h = bow(h, X([0.68, 0.8, 0.12], x), X([0.36, 0.86, 0.4], x), arm);
      h = m3(h, X(K.hit ? [0.18, 0.84, 0.42] : [-0.26, 0.74, 0.32], x), f);
      h = m3(h, H.gS, r);
      set3(H.hS, h);
      set3(H.pS, m3(m3(H.gpS, X([1, 0.3, -0.6], x), a), X([0.6, -0.1, -0.8], x), arm * live));
      if (K.hit) P[H.reach] = { at: K.tgt, k: ramp(s, -K.go * 0.4, 0, E.in) * (1 - ramp(s, 0.03, K.fol * 0.8, E.s)) };
      to3(H.hW, X([-0.22, 0.84, 0.18], x), (0.4 * a + 0.6 * g) * live);
    },
  },
  // THE RIP: the same swing dropped under the guard into the body, low on the camera's side.
  rip: {
    ant: 0.18, go: 0.1, fol: 0.12, rec: 0.28, lunge: 0.24, hand: 'S', at: 'ribs', weight: 0.6, cover: ['pull', 'block', 'hop'],
    pose(P, s, K) {
      const { a, g, f, r, live } = part(s, K);
      const G = K.G;
      const H = hands(P, G);
      const x = H.x;
      const arm = ramp(s, -K.go * 0.9, 0, E.in);
      P.sz += -0.06 * a * (1 - g) + 0.07 * g * live;
      P.drop += 0.07 * a * (1 - g) + 0.05 * g * live;
      P.ty += x * (0.5 * a * (1 - g) - (x * G.ty + 0.6) * g * live - (K.hit ? 0.06 : 0.3) * f * live);
      P.tx += 0.12 * a + 0.22 * g * live;
      P.tz += x * 0.14 * (a + g) * live * 0.5;
      P.hx += 0.1 * (a + g) * live;
      let h = m3(H.gS, X([0.5, 0.48, -0.14], x), a);
      h = bow(h, X([0.62, 0.5, 0.16], x), X([0.26, 0.62, 0.42], x), arm);
      h = m3(h, X(K.hit ? [0.16, 0.64, 0.42] : [-0.16, 0.7, 0.36], x), f);
      h = m3(h, H.gS, r);
      set3(H.hS, h);
      set3(H.pS, m3(H.gpS, X([1, 0.4, -0.6], x), (a + arm) * 0.5 * live));
      if (K.hit) P[H.reach] = { at: K.tgt, k: ramp(s, -K.go * 0.4, 0, E.in) * (1 - ramp(s, 0.03, K.fol * 0.8, E.s)) };
      to3(H.hW, X([-0.2, 0.86, 0.22], x), (0.5 * a + 0.5 * g) * live);
    },
  },
  // THE JAB: the other hand, no wind-up to speak of: out and back like a tongue.
  jab: {
    ant: 0.07, go: 0.06, fol: 0.05, rec: 0.15, lunge: 0.16, hand: 'W', at: 'face', weight: 0.25, cover: ['slip', 'block', 'pull'],
    pose(P, s, K) {
      const { a, g, r, live } = part(s, K);
      const G = K.G;
      const H = hands(P, G);
      const x = H.x;
      P.sz += -0.02 * a * (1 - g) + 0.08 * g * live;
      P.ty += x * (-0.1 * a * (1 - g) + 0.34 * g * live);
      P.tx += 0.1 * g * live;
      P.drop += 0.012 * g * live;
      let h = m3(H.gW, X([-0.2, 0.82, 0.26], x), a);
      h = m3(h, X([-0.1, 0.86, 0.46], x), g);
      h = m3(h, H.gW, r);
      set3(H.hW, h);
      if (K.hit) P[H.reachW] = { at: K.tgt, k: g * (1 - ramp(s, 0.02, K.fol + 0.03, E.s)) };
      to3(H.hS, X([0.28, 0.82, 0.2], x), g * live * 0.7);
    },
  },
  // THE HAYMAKER: everything he has, from the floor. The fist dropped far back and low and HELD there (you see it
  // coming), the weight all on the back leg; then the whole body thrown round after it, the arm at full length, up
  // through them and on past.
  hay: {
    ant: 0.46, go: 0.13, fol: 0.24, rec: 0.46, lunge: 0.34, hand: 'S', at: 'corner', weight: 1, cover: ['duck', 'pull', 'duck'],
    pose(P, s, K) {
      const G = K.G;
      const H = hands(P, G);
      const x = H.x;
      const a = ramp(s, -K.go - K.ant, -K.go - K.ant * 0.45, E.s);
      // (a last sink before it goes: the spring wound a notch more)
      const load = E.bump((s + K.go + K.ant * 0.4) / (K.ant * 0.4));
      const g = ramp(s, -K.go, 0, E.in);
      const f = ramp(s, 0, K.fol, E.out);
      const r = ramp(s, K.fol, K.fol + K.rec, E.s5);
      const live = 1 - r;
      const arm = ramp(s, -K.go * 0.95, 0, E.in);
      P.sz += -0.1 * a * (1 - g) - 0.02 * load + 0.09 * g * live;
      P.sx += x * (0.04 * a * (1 - g) - 0.04 * g * live);
      P.drop += 0.06 * a * (1 - g) + 0.03 * load + 0.02 * g * live;
      P.ty += x * (0.62 * a * (1 - g) + 0.08 * load - (x * G.ty + 0.95) * g * live - (K.hit ? 0.12 : 0.55) * f * live);
      P.tx += 0.04 * a + 0.06 * load + 0.2 * g * live + (K.hit ? 0.04 : 0.2) * f * live;
      P.tz += x * (0.12 * a * (1 - g) - 0.2 * g * live);
      P.hx += 0.1 * a + 0.05 * g * live;
      P.hz += -x * 0.12 * g * live;
      let h = m3(H.gS, X([0.5, 0.44, -0.22], x), a);
      h = m3(h, X([0.52, 0.4, -0.26], x), load);
      h = bow(h, X([0.69, 0.62, 0.06], x), X([0.4, 0.88, 0.4], x), arm);
      h = m3(h, X(K.hit ? [0.1, 0.98, 0.4] : [-0.38, 0.96, 0.2], x), f);
      h = m3(h, H.gS, r);
      set3(H.hS, h);
      set3(H.pS, m3(m3(H.gpS, X([1, 0.6, -0.5], x), a), X([0.7, -0.3, -0.6], x), arm * live));
      if (K.hit) P[H.reach] = { at: K.tgt, k: ramp(s, -K.go * 0.35, 0, E.in) * (1 - ramp(s, 0.04, K.fol * 0.6, E.s)) };
      // the other arm thrown out the far side for balance, then swung back in as the body comes round
      to3(H.hW, X([-0.52, 0.74, 0.2], x), a * (1 - g));
      to3(H.hW, X([-0.3, 0.8, -0.1], x), g * live);
    },
  },
  // THE CLUB (the big man): a fist raised high beside the head, where everyone can see it, and brought down like a
  // hammer on top of them. Slow to come, and it does not stop for much.
  club: {
    ant: 0.36, go: 0.13, fol: 0.2, rec: 0.44, lunge: 0.2, hand: 'S', at: 'crown', weight: 0.95, cover: ['pull', 'block', 'pull'],
    pose(P, s, K) {
      const G = K.G;
      const H = hands(P, G);
      const x = H.x;
      const a = ramp(s, -K.go - K.ant, -K.go - K.ant * 0.3, E.s5);
      const g = ramp(s, -K.go, 0, E.in);
      const f = ramp(s, 0, K.fol, E.out);
      const r = ramp(s, K.fol, K.fol + K.rec, E.s5);
      const live = 1 - r;
      P.sz += -0.05 * a * (1 - g) + 0.08 * g * live;
      P.drop += -0.0 * a + 0.07 * g * live;
      P.tx += -0.14 * a * (1 - g) + 0.36 * g * live + 0.08 * f * live;
      P.ty += x * (0.3 * a * (1 - g) - (x * G.ty + 0.3) * g * live);
      P.tz += x * 0.1 * a * (1 - g);
      P.hx += -0.08 * a * (1 - g) + 0.2 * g * live;
      let h = m3(H.gS, X([0.64, 1.12, -0.06], x), a);
      h = bow(h, X([0.56, 1.22, 0.24], x), X([0.3, 0.98, 0.42], x), g);
      h = m3(h, X([0.22, 0.6, 0.4], x), f);
      h = m3(h, H.gS, r);
      set3(H.hS, h);
      set3(H.pS, m3(H.gpS, X([1, -0.2, -0.3], x), a * live));
      if (K.hit) P[H.reach] = { at: K.tgt, k: ramp(s, -K.go * 0.3, 0, E.in) * (1 - ramp(s, 0.03, K.fol * 0.5, E.s)) };
      to3(H.hW, X([-0.5, 0.6, 0.24], x), a * live);
    },
  },
  // THE SHOVE (the big man): both hands into the chest with all his weight walking through them.
  shove: {
    ant: 0.24, go: 0.12, fol: 0.16, rec: 0.36, lunge: 0.3, hand: 'B', at: 'body', weight: 0.7, cover: ['pull', 'hop', 'block'],
    pose(P, s, K) {
      const G = K.G;
      const { a, g, f, r, live } = part(s, K);
      P.sz += -0.07 * a * (1 - g) + 0.1 * g * live;
      P.drop += 0.05 * a * (1 - g);
      P.tx += -0.06 * a * (1 - g) + 0.34 * g * live;
      P.ty += -G.ty * (a + g) * 0.5 * live;
      P.hx += 0.1 * g * live;
      for (const [h, p, gh, sx] of [[P.hL, P.pL, G.hL, -1], [P.hR, P.pR, G.hR, 1]]) {
        let q = m3(gh, [sx * 0.3, 0.74, 0.06], a);
        q = m3(q, [sx * 0.16, 0.8, 0.46], g);
        q = m3(q, gh, r);
        set3(h, q);
        to3(p, [sx, -0.3, -0.5], (a + g) * 0.5 * live);
      }
      if (K.hit) {
        const k = g * (1 - ramp(s, 0.02, K.fol * 0.6, E.s));
        P.reachL = { at: [K.tgt[0], K.tgt[1], K.tgt[2]], k: k * 0.8 };
        P.reachR = { at: K.tgt, k: k * 0.8 };
      }
    },
  },
  // THE SLASH: the blade hand (in front, low) whipped across at chest height, the body turning behind it.
  slash: {
    ant: 0.14, go: 0.08, fol: 0.15, rec: 0.22, lunge: 0.26, hand: 'S', at: 'body', weight: 0.6, cover: ['hop', 'pull', 'hop'],
    pose(P, s, K) {
      const { a, g, f, r, live } = part(s, K);
      const G = K.G;
      const H = hands(P, G);
      const x = H.x;
      P.sz += -0.05 * a * (1 - g) + 0.08 * g * live;
      P.drop += 0.03 * a + 0.02 * g * live;
      P.ty += x * (0.42 * a * (1 - g) - (x * G.ty + 0.5) * g * live - 0.3 * f * live);
      P.tx += 0.04 * a + 0.16 * g * live;
      // out wide to the side first (the blade shows), then across in front and on past the far hip
      let h = m3(H.gS, X([0.62, 0.7, 0.0], x), a);
      h = bow(h, X([0.6, 0.74, 0.34], x), X([0.14, 0.7, 0.46], x), g);
      h = m3(h, X([-0.3, 0.62, 0.3], x), f);
      h = m3(h, H.gS, r);
      set3(H.hS, h);
      set3(H.pS, m3(H.gpS, X([1, -0.1, -0.7], x), (a + g) * 0.5 * live));
      if (K.hit) P[H.reach] = { at: K.tgt, k: ramp(s, -K.go * 0.4, 0, E.in) * (1 - ramp(s, 0.01, K.fol * 0.4, E.s)) };
      to3(H.hW, X([-0.34, 0.8, 0.0], x), (a + g) * 0.5 * live);
    },
  },
  // THE BACKHAND: the blade brought back the other way, from across the body out to its own side.
  backslash: {
    ant: 0.14, go: 0.08, fol: 0.14, rec: 0.22, lunge: 0.22, hand: 'S', at: 'body', weight: 0.55, cover: ['hop', 'pull', 'block'],
    pose(P, s, K) {
      const { a, g, f, r, live } = part(s, K);
      const G = K.G;
      const H = hands(P, G);
      const x = H.x;
      P.sz += -0.04 * a * (1 - g) + 0.07 * g * live;
      P.ty += x * (-(x * G.ty + 0.46) * a * (1 - g) + 0.5 * g * live + 0.2 * f * live);
      P.tx += 0.1 * a + 0.1 * g * live;
      let h = m3(H.gS, X([-0.22, 0.72, 0.3], x), a);
      h = bow(h, X([0.2, 0.74, 0.5], x), X([0.5, 0.72, 0.36], x), g);
      h = m3(h, X([0.68, 0.74, 0.02], x), f);
      h = m3(h, H.gS, r);
      set3(H.hS, h);
      if (K.hit) P[H.reach] = { at: K.tgt, k: ramp(s, -K.go * 0.6, -K.go * 0.2, E.in) * (1 - ramp(s, -K.go * 0.15, 0.02, E.s)) };
      to3(H.hW, X([-0.3, 0.84, 0.16], x), (a + g) * 0.5 * live);
    },
  },
  // THE STAB: the point drawn back to the hip and driven in low and straight, the whole body behind it; then out.
  stab: {
    ant: 0.11, go: 0.065, fol: 0.09, rec: 0.2, lunge: 0.3, hand: 'S', at: 'body', weight: 0.5, cover: ['hop', 'pull', 'hop'],
    pose(P, s, K) {
      const { a, g, f, r, live } = part(s, K);
      const G = K.G;
      const H = hands(P, G);
      const x = H.x;
      P.sz += -0.06 * a * (1 - g) + 0.1 * g * live;
      P.drop += 0.04 * (a + g) * live;
      P.ty += x * (0.34 * a * (1 - g) - (x * G.ty + 0.5) * g * live);
      P.tx += 0.06 * a + 0.24 * g * live;
      P.hx += 0.06 * g * live;
      let h = m3(H.gS, X([0.46, 0.56, -0.06], x), a);
      h = m3(h, X([0.2, 0.6, 0.48], x), g);
      // (pulled out before it is put away)
      h = m3(h, X([0.34, 0.58, 0.2], x), f);
      h = m3(h, H.gS, r);
      set3(H.hS, h);
      set3(H.pS, m3(H.gpS, X([1, 0, -0.9], x), (a + g) * 0.5 * live));
      if (K.hit) P[H.reach] = { at: K.tgt, k: g * (1 - ramp(s, 0.02, K.fol * 0.6, E.s)) };
      to3(H.hW, X([-0.3, 0.82, 0.1], x), (a + g) * 0.5 * live);
    },
  },
};

// ── TAKING IT ────────────────────────────────────────────────────────────────────────────────────────────────────────
// A blow that lands: s seconds from contact; K { w (0..1 how hard), from (−1: it came from their L, +1 from their R, 0
// straight on), dur }. The head goes first and furthest (it is what the camera sees), the chest after it, the arms
// last and loosest; then it all comes back in that order.
// COUSIN EARL'S TIRE IRON: his own two swings (the door, and the fight you steer). The iron is a forearm and a half
// past the fist, so it is swung from the shoulder, long, and the body goes with it; nothing of a punch in either.
// THE CHOP: carried up and back over the shoulder, the other hand out in front for balance; brought over the top and
// straight down through them, the knees giving under it, and on down to his own shin.
BLOWS.iron = {
  ant: 0.4, go: 0.14, fol: 0.22, rec: 0.46, lunge: 0.16, hand: 'S', at: 'crown', weight: 1, cover: ['pull', 'block', 'hop'],
  pose(P, s, K) {
    const G = K.G;
    const H = hands(P, G);
    const x = H.x;
    const a = ramp(s, -K.go - K.ant, -K.go - K.ant * 0.25, E.s5);
    const g = ramp(s, -K.go, 0, E.in);
    const f = ramp(s, 0, K.fol, E.out);
    const r = ramp(s, K.fol, K.fol + K.rec, E.s5);
    const live = 1 - r;
    P.sz += -0.06 * a * (1 - g) + 0.07 * g * live;
    P.drop += 0.09 * g * live;
    P.tx += -0.22 * a * (1 - g) + 0.42 * g * live + 0.1 * f * live;
    P.ty += x * (0.42 * a * (1 - g) - 0.5 * g * live);
    P.tz += x * 0.08 * a * (1 - g);
    P.hx += -0.12 * a * (1 - g) + 0.24 * g * live;
    let h = m3(H.gS, X([0.5, 1.24, -0.18], x), a);
    h = bow(h, X([0.46, 1.32, 0.2], x), X([0.2, 0.92, 0.44], x), g);
    h = m3(h, X([0.08, 0.5, 0.4], x), f);
    h = m3(h, H.gS, r);
    set3(H.hS, h);
    set3(H.pS, m3(H.gpS, X([1, 0.1, -0.5], x), a * live));
    if (K.hit && K.tgt) P[H.reach] = { at: K.tgt, k: ramp(s, -K.go * 0.3, 0, E.in) * (1 - ramp(s, 0.03, K.fol * 0.5, E.s)) };
    to3(H.hW, X([-0.34, 0.92, 0.3], x), a * (1 - g));
    to3(H.hW, X([-0.42, 0.56, 0.08], x), g * live);
  },
};
// THE SWEEP: drawn back low across his own body, the shoulders wound up after it; then flat and backhanded through
// their ribs, the whole of him unwinding, and round past them.
BLOWS.ironside = {
  ant: 0.32, go: 0.12, fol: 0.2, rec: 0.42, lunge: 0.2, hand: 'S', at: 'ribs', weight: 0.85, cover: ['hop', 'block', 'pull'],
  pose(P, s, K) {
    const G = K.G;
    const H = hands(P, G);
    const x = H.x;
    const a = ramp(s, -K.go - K.ant, -K.go - K.ant * 0.25, E.s5);
    const g = ramp(s, -K.go, 0, E.in);
    const f = ramp(s, 0, K.fol, E.out);
    const r = ramp(s, K.fol, K.fol + K.rec, E.s5);
    const live = 1 - r;
    P.sx += x * (-0.04 * a * (1 - g) + 0.05 * g * live);
    P.drop += 0.05 * a * live;
    P.tx += 0.1 * a * live;
    P.ty += x * (-0.62 * a * (1 - g) + 0.55 * g * live + 0.25 * f * live);
    P.hy += x * 0.3 * a * (1 - g);
    let h = m3(H.gS, X([-0.26, 0.62, 0.2], x), a);
    h = bow(h, X([0.2, 0.6, 0.5], x), X([0.62, 0.66, 0.26], x), g);
    h = m3(h, X([0.66, 0.72, -0.08], x), f);
    h = m3(h, H.gS, r);
    set3(H.hS, h);
    set3(H.pS, m3(H.gpS, X([0.4, -0.2, -1], x), a * live));
    if (K.hit && K.tgt) P[H.reach] = { at: K.tgt, k: ramp(s, -K.go * 0.3, 0, E.in) * (1 - ramp(s, 0.03, K.fol * 0.5, E.s)) };
    to3(H.hW, X([-0.46, 0.7, 0.16], x), a * live);
  },
};
GUARDS.pipe.blows = [['iron', 50], ['ironside', 50]];
GUARDS.pipe.big = 'iron';

export const HURT = {
  /** on the head: snapped back and round with the blow, the face thrown up to the sky */
  head(P, s, K) {
    const w = K.w;
    const snap = E.hit(s / K.dur, 0.16);
    const late = E.hit((s - 0.04) / K.dur, 0.2);
    const loose = E.hit((s - 0.08) / K.dur, 0.25);
    P.hx += -(0.34 + 0.5 * w) * snap;
    P.hy += -K.from * (0.22 + 0.7 * w) * snap;
    P.hz += K.from * (0.1 + 0.3 * w) * snap;
    P.tx += -(0.1 + 0.3 * w) * late;
    P.ty += -K.from * (0.12 + 0.6 * w) * late;
    P.tz += K.from * 0.12 * w * late;
    P.sz += -(0.04 + 0.06 * w) * late;
    P.drop += 0.05 * w * E.bump(s / (K.dur * 0.7));
    // the arms thrown loose off the guard, up and out
    to3(P.hL, [-0.5, 0.86, 0.14], (0.35 + 0.5 * w) * loose);
    to3(P.hR, [0.52, 0.84, 0.1], (0.35 + 0.5 * w) * loose);
  },
  /** on top of the head: driven down into the shoulders, the knees giving */
  crown(P, s, K) {
    const w = K.w;
    const snap = E.hit(s / K.dur, 0.14);
    const late = E.hit((s - 0.05) / K.dur, 0.22);
    P.hx += (0.3 + 0.3 * w) * snap;
    P.drop += (0.09 + 0.08 * w) * snap;
    P.tx += (0.14 + 0.2 * w) * late;
    P.hz += K.from * 0.2 * w * late;
    P.sz += -0.05 * late;
    to3(P.hL, [-0.56, 0.6, 0.16], 0.8 * late);
    to3(P.hR, [0.56, 0.6, 0.12], 0.8 * late);
  },
  /** in the body: folded over it, the hips shot back, the hands to it */
  body(P, s, K) {
    const w = K.w;
    const snap = E.hit(s / K.dur, 0.2);
    const late = E.hit((s - 0.05) / K.dur, 0.25);
    P.tx += (0.3 + 0.4 * w) * snap;
    P.sz += -(0.08 + 0.08 * w) * snap;
    P.hx += (0.2 + 0.3 * w) * late;
    P.drop += (0.04 + 0.06 * w) * snap;
    P.ty += -K.from * 0.3 * w * late;
    P.tz += -K.from * 0.14 * late;
    to3(P.hL, [-0.12, 0.6, 0.3], 0.9 * late);
    to3(P.hR, [0.14, 0.58, 0.3], 0.9 * late);
  },
  /** from behind (one of two who jumped them): pitched forward off it, the chin on the chest, the arms left behind */
  behind(P, s, K) {
    const w = K.w;
    const snap = E.hit(s / K.dur, 0.16);
    const late = E.hit((s - 0.05) / K.dur, 0.22);
    P.hx += (0.3 + 0.4 * w) * snap;
    P.tx += (0.2 + 0.3 * w) * late;
    P.sz += (0.05 + 0.06 * w) * late;
    P.drop += 0.05 * w * E.bump(s / (K.dur * 0.7));
    P.hz += K.from * 0.16 * w * snap;
    to3(P.hL, [-0.5, 0.7, -0.14], (0.4 + 0.5 * w) * late);
    to3(P.hR, [0.52, 0.7, -0.16], (0.4 + 0.5 * w) * late);
  },
  /**
   * staggered: on top of whichever of the above, for a blow that moves them (choreo.js sends the hips back, the feet
   * catch them): leaning back off balance, the arms out and wheeling, caught, and gathered in
   */
  stagger(P, s, K) {
    const w = K.w;
    const go = ramp(s, 0.05, 0.16, E.out) * (1 - ramp(s, K.dur * 0.55, K.dur, E.s));
    const wheel = Math.sin(s * 19) * go;
    P.tx += -0.24 * w * go;
    P.hx += 0.16 * w * go;
    P.drop += 0.04 * w * E.bump((s - K.dur * 0.5) / (K.dur * 0.4));
    P.tz += 0.08 * wheel * w;
    to3(P.hL, [-0.6, 0.8 + 0.12 * wheel, 0.14], 0.9 * w * go);
    to3(P.hR, [0.62, 0.8 - 0.12 * wheel, 0.1], 0.9 * w * go);
    to3(P.pL, [-1, 0.2, -0.2], 0.8 * go);
    to3(P.pR, [1, 0.2, -0.2], 0.8 * go);
  },
};

// ── NOT TAKING IT ────────────────────────────────────────────────────────────────────────────────────────────────────
// A blow that does not land is one the other dealt with. s from the moment it would have landed; K { from, dur, w }.
export const COVER = {
  /** caught on the arms: both fists up in front, chin behind them, rocked back a little by it */
  block(P, s, K) {
    const up = ramp(s, -0.14, -0.03, E.out) * (1 - ramp(s, 0.1, K.dur, E.s));
    const jolt = E.hit(s / 0.3, 0.2);
    to3(P.hL, [-0.16, 0.87, 0.34], up);
    to3(P.hR, [0.18, 0.87, 0.32], up);
    to3(P.pL, [-1, -0.9, 0.2], up);
    to3(P.pR, [1, -0.9, 0.2], up);
    P.hx += 0.2 * up;
    P.tx += 0.06 * up - 0.1 * jolt;
    P.sz += -0.05 * jolt;
    P.drop += 0.03 * up;
    P.ty += -K.from * 0.14 * jolt;
  },
  /** slipped: the head taken off the line to one side, knees bent, and back */
  slip(P, s, K) {
    const go = ramp(s, -0.15, -0.02, E.out) * (1 - ramp(s, 0.06, K.dur, E.s));
    const d = K.from || 1;
    P.sx += d * 0.085 * go;
    P.tz += d * 0.24 * go;
    P.hz += d * 0.16 * go;
    P.drop += 0.07 * go;
    P.tx += 0.12 * go;
    P.ty += d * 0.2 * go;
  },
  /** pulled back out of reach: the chest and head leaned away, the weight on the back foot */
  pull(P, s, K) {
    const go = ramp(s, -0.16, -0.02, E.out) * (1 - ramp(s, 0.08, K.dur, E.s));
    P.sz += -0.1 * go;
    P.tx += -0.3 * go;
    P.hx += -0.12 * go;
    P.drop += 0.02 * go;
    to3(P.hL, [-0.36, 0.8, 0.26], 0.6 * go);
    to3(P.hR, [0.4, 0.8, 0.22], 0.6 * go);
  },
  /** ducked: under a wide one, bent at the knees and the waist */
  duck(P, s, K) {
    const go = ramp(s, -0.17, -0.03, E.out) * (1 - ramp(s, 0.07, K.dur, E.s));
    P.drop += 0.15 * go;
    P.tx += 0.46 * go;
    P.hx += 0.25 * go;
    P.sz += -0.12 * go;
    P.ty += (K.from || 1) * 0.25 * go;
    to3(P.hL, [-0.2, 0.84, 0.3], go);
    to3(P.hR, [0.22, 0.84, 0.28], go);
  },
  /** hopped back from a blade: the belly sucked in away from it, the hips shot back, arms thrown up clear */
  hop(P, s, K) {
    const go = ramp(s, -0.15, -0.02, E.out) * (1 - ramp(s, 0.1, K.dur, E.s));
    P.tx += 0.34 * go;
    P.sz += -0.11 * go;
    P.drop += 0.03 * go;
    P.hx += -0.1 * go;
    to3(P.hL, [-0.52, 0.9, 0.16], go);
    to3(P.hR, [0.54, 0.9, 0.14], go);
  },
};

// ── DOWN, AND UP ─────────────────────────────────────────────────────────────────────────────────────────────────────
// A body off its feet is turned as one piece by the rig's root about a point on the ground (rx, about px py pz), the
// way a body really falls: over its heels. Lying on its back the root is at LIE (the back of the big head on the
// ground, the pillow it is). The pose is told for a body whose feet are where they stood (K.feet [[z, lift, pitch] L,
// R], the rig's own terms) and whose chest was turned K.ty0 on its legs: the fall starts from exactly there.
export const LIE = -1.36;
/** Where a body's feet are in its own frame once it is down (and when it is up again): both at the back one's place. */
export const downFeet = feet => Math.min(feet[0][0], feet[1][0]);
/** the heel under an ankle (body frame z, from the foot's own ground point) */
const HEEL = -0.15;
/** The foot the body falls back over: the one further back as it stood (its ground point's z, body frame). */
const rear = K => Math.min(K.feet[0][0], K.feet[1][0]);
/** The two feet of a body going down: the back one stays where it stood, the front one is drawn back to it (k 0..1). */
const feetOf = (P, K, k = 1) => {
  const z = rear(K);
  const up = Math.sin(Math.PI * k) * 0.07;
  for (const [f, f0] of [[P.fL, K.feet[0]], [P.fR, K.feet[1]]]) {
    const front = f0[0] > z + 1e-6;
    f[0] = f0[0] + (z - f0[0]) * k;
    f[1] = f0[1] * (1 - k) + (front ? up : 0);
    f[2] = f0[2] * (1 - k);
  }
  P.pz = z + HEEL;
};
/** Lying on the back, hurt: s seconds since it lay still; `on` 0..1 how much of it. */
function lying(P, s, on = 1, K = {}) {
  const br = Math.sin((TAU * s) / 0.62);
  const roll = Math.sin((TAU * s) / 2.3);
  P.tx += (0.14 + 0.03 * br) * on;
  P.hx += (-0.06 - 0.02 * br + 0.16 * roll * roll) * on;
  P.hy += 0.34 * roll * on;
  // one hand to the head, the other flung out on the ground
  to3(P.hR, [0.5 + 0.03 * roll, 0.98, 0.12], on);
  to3(P.pR, [1, -0.4, 0.5], on);
  to3(P.hL, [-0.66, 0.7, -0.04], on);
  to3(P.pL, [-1, 0, -0.6], on);
  P.fL[1] += 0.03 * (0.5 + 0.5 * roll) * on;
  if (K.curl) {
    // (a spasm now and then: the chest and the knees come up)
    const sp = E.bump((s % 2.9) / 0.7);
    P.tx += 0.16 * sp * on;
    P.hx += 0.2 * sp * on;
    P.fR[1] += 0.06 * sp * on;
  }
}

export const FALLS = {
  // KNOCKED OUT: straight back like a tree, stiff from the blow. The head has already gone; the arms are left behind
  // in the air and come down after the body; it lands flat, bounces once, and lies.
  // `spin`: how far the blow turns it as it goes (a haymaker: half round).
  out: {
    dur: 0.62, still: 0.6,
    pose(P, s, K) {
      const w = K.w ?? 0.7;
      const tip = ramp(s, 0.0, 0.46, E.in);
      const land = ramp(s, 0.44, 0.5, E.out);
      const bounce = E.bump((s - 0.47) / 0.2);
      const still = ramp(s, 0.5, 0.86, E.s);
      feetOf(P, K, ramp(s, 0, 0.3, E.s));
      P.rx = LIE * tip + 0.07 * bounce;
      P.ry = (K.spin ?? 0) * ramp(s, 0, 0.44, E.out);
      P.my = 0.02 * bounce;
      // the head: thrown back by the blow at once, then left behind (chin to chest) as the body goes, then back on the ground
      P.hx += -(0.4 + 0.3 * w) * E.hit(s / 0.3, 0.2) + 0.44 * E.bump((s - 0.16) / 0.36) - 0.2 * bounce;
      P.hy += -K.from * 0.5 * w * E.hit(s / 0.4, 0.2);
      P.tx += -0.2 * E.hit(s / 0.3, 0.3) + 0.12 * E.bump((s - 0.2) / 0.3);
      P.ty += -K.from * 0.3 * w * (1 - still) * ramp(s, 0, 0.1, E.out);
      // the arms: flung up and forward as the body leaves them, then they slap down wide a beat after the back does
      const up = ramp(s, 0.02, 0.2, E.out);
      const flop = ramp(s, 0.5, 0.68, E.out);
      for (const [h, p, sx] of [[P.hL, P.pL, -1], [P.hR, P.pR, 1]]) {
        to3(h, [sx * 0.46, 1.0, 0.36], up * (1 - flop));
        to3(h, [sx * 0.68, 0.78, -0.02], flop * (1 - still));
        to3(p, [sx, 0.4, 0.2], up * (1 - flop));
      }
      // the legs kick up as the back hits
      const kick = E.bump((s - 0.44) / 0.3);
      P.fL[1] += 0.12 * kick;
      P.fR[1] += 0.08 * kick;
      lying(P, Math.max(0, s - 0.6), still, K);
    },
  },
  // FOLDED: the legs go first. Sinks at the knees, sits down hard, and rolls onto the back: winded, spent, or cut.
  fold: {
    dur: 0.95, still: 0.9,
    pose(P, s, K) {
      const sag = ramp(s, 0, 0.3, E.in);
      const tip = ramp(s, 0.24, 0.8, E.s);
      const still = ramp(s, 0.78, 1.15, E.s);
      feetOf(P, K, ramp(s, 0, 0.35, E.s));
      P.drop += 0.2 * sag * (1 - tip);
      P.rx = LIE * tip;
      P.tx += 0.5 * sag * (1 - tip) + 0.1 * E.bump((s - 0.7) / 0.2);
      P.hx += 0.4 * sag * (1 - ramp(s, 0.5, 0.8, E.s));
      to3(P.hL, [-0.14, 0.58, 0.3], sag * (1 - tip));
      to3(P.hR, [0.16, 0.56, 0.3], sag * (1 - tip));
      const flop = ramp(s, 0.7, 0.9, E.out);
      to3(P.hL, [-0.66, 0.72, 0], flop * (1 - still));
      lying(P, Math.max(0, s - 0.9), still, K);
    },
  },
};

// GETTING UP, from the back, over the feet that never left the ground: the chest curls up off the floor (the hands
// push), the body rocks up over its heels into a deep crouch, and stands out of it with a hand on a knee. `quick`: the
// scramble of somebody thrown who is not done; else hurt, and slow about it.
export function rise(P, s, K) {
  const D = K.dur;
  const u = c01(s / D);
  const curl = ramp(u, 0, 0.3, E.s);
  const rock = ramp(u, 0.2, 0.62, E.s5);
  const stand = ramp(u, 0.56, 0.96, E.s);
  // (out of lying there: what it was doing on the ground let go as the chest comes up)
  lying(P, (K.lain ?? 0) + s, 1 - ramp(u, 0, 0.24, E.s), K);
  feetOf(P, K, 1);
  // (where the going down left the body, turned and moved: it gets up there)
  // (and as it stands up the hips come back over the feet, which do not move: the body goes back as far as the feet,
  // in its own frame, come forward under it)
  const ry = K.end?.ry ?? K.spin ?? 0;
  const z = rear(K);
  P.ry = ry;
  P.mx = (K.end?.mx ?? 0) + Math.sin(ry) * z * stand;
  P.mz = (K.end?.mz ?? 0) + Math.cos(ry) * z * stand;
  P.fL[0] = z * (1 - stand);
  P.fR[0] = z * (1 - stand);
  P.rx = LIE * (1 - rock);
  P.drop += 0.19 * rock * (1 - stand);
  P.tx += 0.5 * curl * (1 - rock) + 0.62 * rock * (1 - stand) + 0.08 * E.bump((u - 0.8) / 0.2);
  P.hx += 0.3 * curl * (1 - stand) - 0.1 * E.bump((u - 0.7) / 0.25);
  // hands: on the ground behind to push, then to the knees, then let go
  const push = ramp(u, 0.02, 0.2, E.s) * (1 - ramp(u, 0.36, 0.52, E.s));
  const knee = ramp(u, 0.44, 0.6, E.s) * (1 - ramp(u, 0.78, 0.98, E.s));
  to3(P.hL, [-0.5, 0.6, -0.26], push);
  to3(P.hR, [0.5, 0.6, -0.26], push);
  to3(P.pL, [-1, 0.3, -0.6], push);
  to3(P.pR, [1, 0.3, -0.6], push);
  to3(P.hL, [-0.3, 0.5, 0.3], knee);
  to3(P.hR, [0.3, 0.5, 0.3], knee);
  if (!K.quick) {
    // (hurt: a shake of the head as he comes up, a hand to it)
    const daze = ramp(u, 0.7, 0.8, E.s) * (1 - ramp(u, 0.9, 1, E.s));
    P.hz += 0.14 * Math.sin(u * 46) * daze;
    P.hy += 0.2 * Math.sin(u * 23) * daze;
  }
}

/** Up, hurt, and not coming back for more: bent over a little, an arm across the ribs. k 0..1 how much. */
export function beaten(P, t, k) {
  const br = Math.sin((TAU * t) / 0.9);
  P.tx += (0.24 + 0.03 * br) * k;
  P.hx += 0.22 * k;
  P.drop += 0.03 * k;
  P.tz += 0.08 * k;
  to3(P.hL, [0.06, 0.6, 0.32], k);
  to3(P.pL, [-1, -0.2, 0], k);
  to3(P.hR, [0.36, 0.5, 0.1], k);
}
/** Over them, done: the hands coming down, chest heaving, looking down at what is on the ground. k 0..1. */
export function over(P, t, k) {
  const br = Math.sin((TAU * t) / 0.7);
  P.tx += (0.1 + 0.035 * br) * k;
  P.hx += 0.3 * k;
  P.drop += 0.012 * (0.5 + 0.5 * br) * k;
  to3(P.hL, [-0.38, 0.5 + 0.012 * br, 0.14], k);
  to3(P.hR, [0.4, 0.5 + 0.012 * br, 0.12], k);
}

/** A thrown body's heels on their way round the thrower (`round` 0..1): how far it is turned and moved by then. */
function orbit(K, round) {
  const a = K.turn * round;
  const r = K.r0 * (1 - 0.22 * Math.sin(Math.PI * round)) * (1 - 0.12 * round);
  const [c0, s0] = [Math.sin(K.toward), Math.cos(K.toward)];
  // (his hips, in this body's own frame, from its heels; and the way from him to the heels, turned by a)
  const [hx, hz] = [c0 * K.r0, s0 * K.r0];
  const [ca, sa] = [Math.cos(a), Math.sin(a)];
  const [vx, vz] = [-c0 * r, -s0 * r];
  return { ry: a, mx: hx + vx * ca + vz * sa, mz: hz - vx * sa + vz * ca };
}
/** Where a throw leaves the one thrown (their root's turn and move, as the pose has them). */
export const thrownEnd = K => orbit(K, 1);

// ── HOLDS: the throw and the grab ────────────────────────────────────────────────────────────────────────────────────
// Two bodies in one move: choreo.js stands them and says when; these are the two halves. s seconds from the moment
// the rules land it (the throw: the back hitting the ground; the grab: the arms closing).
export const HOLDS = {
  // THE THROW, the one who throws: steps in under them and takes hold with both hands (s −0.58), turns his back in
  // and sinks (−0.4), heaves them over the hip as he turns right round (−0.3 → 0), follows them down bent over them,
  // lets go and straightens. K { hit, G, grip() → the world point his hands are on (their chest, wherever it is) }
  throwA(P, s, K) {
    const G = K.G;
    const take = ramp(s, -0.6, -0.44, E.out);
    const sink = ramp(s, -0.46, -0.3, E.s);
    const heave = ramp(s, -0.3, -0.02, E.in);
    const done = ramp(s, 0.02, 0.5, E.s);
    const live = 1 - ramp(s, 0.25, 0.75, E.s);
    P.drop += (0.1 * sink * (1 - heave) + 0.05 * heave) * live;
    P.tx += (0.16 * take + 0.26 * sink + 0.18 * heave) * live;
    P.ty += -G.ty * take * live;
    P.hx += 0.2 * sink * live;
    P.sz += (0.06 * take - 0.04 * heave) * live;
    for (const [h, p, sx] of [[P.hL, P.pL, -1], [P.hR, P.pR, 1]]) {
      to3(h, [sx * 0.2, 0.78, 0.44], take * live);
      to3(p, [sx, -0.5, -0.2], take * live);
    }
    if (K.hit !== 'none') {
      const g = K.grip?.();
      if (g) {
        const k = take * (1 - ramp(s, K.hit ? 0.05 : -0.14, K.hit ? 0.3 : -0.04, E.s));
        P.reachL = { at: g, k };
        P.reachR = { at: g, k };
      }
    }
    void done;
  },
  // THE THROW, the one thrown (off their feet from s −0.34: a body turned by its root): pulled forward onto him, lifted
  // round on his hip, and put down hard on their back on his far side. K { feet, turn (rad, how far round him they go,
  // signed), r0 (m, from his hips to their heels as it starts), toward (rad, body frame: the way to him as it starts) }
  thrownV(P, s, K) {
    const u = c01((s + 0.34) / 0.34);
    const round = E.s(u);
    const lift = Math.sin(Math.PI * Math.min(1, u * 1.05)) ** 0.9;
    const over = ramp(s, -0.14, 0.0, E.in);
    const bounce = E.bump(s / 0.2);
    feetOf(P, K, ramp(s, -0.34, -0.2, E.s));
    // the heels go round him: a circle about his hips, a little nearer in the middle of it
    const o = orbit(K, round);
    P.mx = o.mx;
    P.mz = o.mz;
    P.my = 0.34 * lift * (1 - over) + 0.03 * bounce;
    P.ry = o.ry;
    // bent forward over his hip going up; flat on the back coming down
    P.rx = 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.1)) * (1 - over) + LIE * over + 0.08 * bounce;
    P.tx += 0.3 * lift * (1 - over);
    P.hx += 0.3 * lift * (1 - over) - 0.3 * bounce;
    const fl = ramp(s, -0.3, -0.1, E.out);
    const flop = ramp(s, 0.02, 0.2, E.out);
    for (const [h, p, sx] of [[P.hL, P.pL, -1], [P.hR, P.pR, 1]]) {
      to3(h, [sx * 0.5, 0.9, 0.3], fl * (1 - flop));
      to3(h, [sx * 0.68, 0.78, -0.02], flop);
      to3(p, [sx, 0.3, 0.1], fl);
    }
    const kick = E.bump((s + 0.02) / 0.28);
    P.fL[1] += 0.16 * kick + 0.1 * lift * (1 - over);
    P.fR[1] += 0.1 * kick + 0.14 * lift * (1 - over);
    lying(P, Math.max(0, s - 0.2), ramp(s, 0.14, 0.45, E.s), K);
  },
  // THE THROW THAT IS NOT: they sit back against it, hips out, arms stiff on his shoulders, and he cannot turn them.
  sprawl(P, s, K) {
    const go = ramp(s, -0.5, -0.36, E.out) * (1 - ramp(s, -0.02, 0.3, E.s));
    P.sz += -0.14 * go;
    P.drop += 0.09 * go;
    P.tx += 0.34 * go;
    P.hx += -0.1 * go;
    to3(P.hL, [-0.2, 0.8, 0.44], go);
    to3(P.hR, [0.2, 0.8, 0.44], go);
    P.tz += 0.06 * Math.sin(s * 30) * go;
  },
  // THE GRAB, the one who grabs: drives in low with both arms wide (s −0.3), closes them round the other (0), squeezes
  // and wrenches them side to side for as long as the rules hold them (K.h s), then throws them off.
  clinchA(P, s, K) {
    const open = ramp(s, -0.34, -0.14, E.s) * (1 - ramp(s, -0.1, 0, E.in));
    const shut = ramp(s, -0.1, 0.0, E.in);
    const h = K.hit ? K.h : 0.12;
    const off = ramp(s, h - 0.16, h - 0.02, E.in);
    const live = 1 - ramp(s, h, h + 0.3, E.s);
    const wr = K.hit ? Math.sin((s / 0.36) * TAU) * shut * (1 - off) * Math.max(0.3, 1 - s / (h + 0.01)) : 0;
    P.tx += (0.1 * open + 0.14 * shut - 0.3 * off) * live;
    P.drop += (0.05 * open + 0.03 * shut) * live;
    P.sz += (0.08 * shut - 0.06 * off) * live;
    P.sx += 0.05 * wr;
    P.tz += 0.2 * wr;
    P.ty += 0.3 * wr;
    P.hx += -0.1 * shut * live;
    for (const [hd, p, sx] of [[P.hL, P.pL, -1], [P.hR, P.pR, 1]]) {
      to3(hd, [sx * 0.62, 0.72, 0.2], open);
      to3(hd, [sx * 0.2, 0.76, 0.46], shut * (1 - off));
      to3(hd, [sx * 0.2, 0.8, 0.5], off * live);
      to3(p, [sx, -0.2, -0.3], (open + shut) * live);
    }
    if (K.hit) {
      const g = K.grip?.();
      if (g) {
        const k = shut * (1 - off) * 0.85;
        P.reachL = { at: g[0], k };
        P.reachR = { at: g[1], k };
      }
    }
  },
  // THE GRAB, the one held: arms pinned to the sides, lifted onto the toes, head thrown about; shoved off at the end.
  clinchV(P, s, K) {
    const on = ramp(s, -0.02, 0.06, E.out) * (1 - ramp(s, K.h - 0.1, K.h + 0.05, E.s));
    const wr = Math.sin((s / 0.36) * TAU) * on * Math.max(0.3, 1 - s / (K.h + 0.01));
    const squeeze = E.hit(s / 0.4, 0.15);
    P.drop += -0.02 * on;
    P.tx += -0.14 * on - 0.1 * squeeze;
    P.sx += -0.05 * wr;
    P.tz += -0.22 * wr;
    P.hz += -0.3 * wr;
    P.hx += -0.3 * squeeze - 0.14 * on;
    P.hy += 0.4 * wr;
    to3(P.hL, [-0.36, 0.5, 0.06], on);
    to3(P.hR, [0.36, 0.5, 0.06], on);
    to3(P.pL, [-1, 0, -0.6], on);
    to3(P.pR, [1, 0, -0.6], on);
  },
};

/**
 * Going through the pockets of somebody on the ground (two who jumped you, one of them): bent right over them, both
 * hands down on them and working, a look up and round now and then. k 0..1 how much; t the clock.
 */
export function rifle(P, t, k) {
  const dig = Math.sin(t * 13);
  const look = E.bump(((t * 0.8) % 1.6) / 0.5);
  P.tx += (0.62 + 0.04 * dig) * k;
  P.drop += 0.15 * k;
  P.hx += (0.3 - 0.4 * look) * k;
  P.hy += 0.5 * look * k;
  to3(P.hL, [-0.16 + 0.03 * dig, 0.5, 0.42], k);
  to3(P.hR, [0.18 - 0.03 * dig, 0.52 + 0.03 * dig, 0.42], k);
  to3(P.pL, [-1, -0.2, -0.6], k);
  to3(P.pR, [1, -0.2, -0.6], k);
}
/** Keeping watch while the other takes it: half turned away, the head going from side to side. k 0..1. */
export function watchOut(P, t, k) {
  const look = Math.sin(t * 2.6);
  P.hy += 0.75 * look * k;
  P.ty += 0.25 * look * k;
  P.tx += 0.06 * k;
  to3(P.hL, [-0.4, 0.56, 0.16], 0.6 * k);
  to3(P.hR, [0.42, 0.56, 0.14], 0.6 * k);
}
