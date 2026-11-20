// THE FIGHT'S LONG GUNS IN BOTH HANDS (fight-3): the Doorman (a short double barrel) and the Long-eye (a scoped rifle).
// Nothing in the game held a long gun before (the city's clips have the pistol only, gun-prop.js; the paused craft
// game's long-gun loads were left out of its port, game-port.md), so these are drawn new, for the fight only. Like
// gun.js's, they are WALKING OVERLAYS (moving, speed 0: the legs are the walk's) and read the same look slot (gun.js:
// the bearing of whoever they fight and how far the gun is up).
//
//   THE HOLD   the +x hand on the grip behind the trigger, the −x hand out along the fore-end, the stock in to the
//              chest; the chest bladed a little (the −x shoulder forward) so the gun points where the hands put it.
//              Ready (up 0): low and across the body, pointing down ahead. Up (up 1): at the shoulder, on them
//   THE KICK   heavier than the pistol's: both arms ride up, the chest rocks back; the Doorman's a hard shove, the
//              Long-eye's a slower, longer one (its shots are slow)
//
// THE GUN is a model of our own (toon blocks, no real make, model or part), posed between the two hands: its grip at
// the +x hand, its barrel through the −x hand. The hands come from the same arm angles the shader sets (the forward
// kinematics of gun.js, for both arms: the −x arm is the +x one mirrored), so it sits in both hands whatever the pose.
//
//   fight_doorman, fight_doorman_fire   the Doorman held (a loop, 1.2 s) and its shot (0.34 s)
//   fight_longeye, fight_longeye_fire   the Long-eye held (a loop, 1.2 s) and its shot (0.5 s)

export const LONG_D = 1.2;
export const LONG_FIRE_D = Object.freeze({ doorman: 0.34, longeye: 0.5 });
const f = v => (+v).toFixed(4);

// THE POSE'S NUMBERS (solved once, by search over the forward kinematics below, for the hands to hold the gun: aimed,
// the +x hand at (0.06, 0.76, 0.22) and the −x at (0.04, 0.78, 0.44) m in the body frame, the barrel straight ahead at
// the chest; ready, (0.10, 0.59, 0.18) and (−0.02, 0.53, 0.34), down across the body. Arms [pitch fwd, roll out, yaw in, twist in, elbow],
// rad, as the cast's cArm takes them; R the +x arm, L the −x one). `blade` the chest's turn (+: the −x shoulder
// forward), `tx` its lean.
export const HOLD = Object.freeze({
  aim: { R: [0.23, -0.22, 0.82, 0.25, 1.9], L: [1.43, 0.06, 0.5, 0.2, 0.04], blade: 0.34, tx: 0.03 },
  ready: { R: [-0.3, -0.1, 0.62, 0.28, 1.9], L: [0.58, 0.06, 0.64, 0.22, 0.5], blade: 0.22, tx: 0.06 },
});
/** The kick at its height: added to both arms' pitch and elbows, and the chest's lean back. */
const KICK = { pitch: 0.32, elbow: 0.25, lean: -0.1 };

// ── the GLSL (gun.js's fGunBear and the cast's helpers): the pose for a bearing, how far it is up and a kick ───────
const vec = (a, b) => `mix(vec4(${f(a[0])}, ${f(a[1])}, ${f(a[2])}, ${f(a[3])}), vec4(${f(b[0])}, ${f(b[1])}, ${f(b[2])}, ${f(b[3])}), up)`;
const el = (a, b) => `mix(${f(a)}, ${f(b)}, up)`;
export const LONG_GLSL = /* glsl */`
// THE LONG GUN IN BOTH HANDS (clips/long.js HOLD): up 0 ready, low across the body · up 1 at the shoulder, on them;
// the chest turns to them, up to 72° (a two-hand gun turns with the chest), both arms a little more
void fLong(inout Pose P, float up, float kick, float k) {
  float a = fGunBear();
  float ty = clamp(a, -1.25, 1.25);
  float ra = clamp(a - ty, -.3, .3);
  float bl = ${el(HOLD.ready.blade, HOLD.aim.blade)};
  P.torso = mix(P.torso, vec3(${el(HOLD.ready.tx, HOLD.aim.tx)} + ${f(KICK.lean)} * kick, ty + bl, -.02 * up), k);
  P.head.y = mix(P.head.y, clamp(a - ty - bl, -1.2, 1.2), k);
  P.head.x = mix(P.head.x, .06 * up - .1 * kick, k);
  vec4 r = ${vec(HOLD.ready.R, HOLD.aim.R)}, l = ${vec(HOLD.ready.L, HOLD.aim.L)};
  cArm(P, 1, r + vec4(${f(KICK.pitch)} * kick, 0., -ra, 0.), ${el(HOLD.ready.R[4], HOLD.aim.R[4])} + ${f(KICK.elbow)} * kick, k);
  cArm(P, 0, l + vec4(${f(KICK.pitch)} * kick, 0., ra, 0.), ${el(HOLD.ready.L[4], HOLD.aim.L[4])} + ${f(KICK.elbow)} * kick, k);
}`;

// ── the JS twin: the pose's angles, the forward kinematics of both hands (gun.js's rig, the −x arm mirrored) ────────
const mix = (x, y, t) => x + (y - x) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function lookParts(look) {
  const k = Math.floor((look + 4) / 8);
  let a = look - 8 * k;
  if (a < -2.4) a += 2 * Math.PI;
  return [a, clamp(k / 16, 0, 1)];
}
/** The pose for a look slot and a kick: { chest: { tx, ty, tz }, R: [5], L: [5] } (fLong's numbers). */
export function longAngles(look, kick = 0) {
  const [a, up] = lookParts(look);
  const ty = clamp(a, -1.25, 1.25);
  const ra = clamp(a - ty, -0.3, 0.3);
  const H = HOLD;
  const arm = (side, r) => {
    const A = H.ready[side].map((v, i) => mix(v, H.aim[side][i], up));
    A[0] += KICK.pitch * kick;
    A[2] += r;
    A[4] += KICK.elbow * kick;
    return A;
  };
  return {
    chest: { tx: mix(H.ready.tx, H.aim.tx, up) + KICK.lean * kick, ty: ty + mix(H.ready.blade, H.aim.blade, up), tz: -0.02 * up },
    R: arm('R', -ra),
    L: arm('L', ra),
  };
}
const R3 = {
  x: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]; },
  y: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; },
  z: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; },
};
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vscale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const norm = a => vscale(a, 1 / (Math.hypot(...a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const RIG = { hipY: 0.5, hipZ: 0.025, sh: [0.25, 0.825, 0], hinge: [0, 0.65, 0.05], grip: [0.325, 0.39, 0] };
/** A hand's grip point in the walker's body frame: `side` 'R' (+x) or 'L' (−x, the +x arm mirrored), `A` its five angles. */
export function handAt(side, A, chest, hip = RIG.hipY) {
  const [ap, ar, ay, at, ae] = A;
  const arm = d => R3.y(-ay, R3.z(ar, R3.x(-ap, R3.y(-at, d))));
  let q = vadd(RIG.hinge, R3.x(-ae, vsub(RIG.grip, RIG.hinge)));
  q = vadd(RIG.sh, arm(vsub(q, RIG.sh)));
  if (side === 'L') q = [-q[0], q[1], q[2]];
  const pc = [0, RIG.hipY, RIG.hipZ];
  const c = d => R3.z(chest.tz, R3.x(chest.tx, R3.y(chest.ty, d)));
  return vadd([0, hip, RIG.hipZ], c(vsub(q, pc)));
}
/** Both hands for a look slot and a kick: { R, L } (body frame). */
export function longHands(look, kick = 0, hip = RIG.hipY) {
  const P = longAngles(look, kick);
  return { R: handAt('R', P.R, P.chest, hip), L: handAt('L', P.L, P.chest, hip) };
}

// ── THE TWO GUNS: cells of GRAIN m (x across, y up, z along the barrel toward the muzzle), the origin the +x hand's
// grip point (the mitten's centre) on the grip. Toon blocks of our own, sized round the toon's big mittens. ───────
const GRAIN = 0.025;
const STEEL = 0x3a3e47, DARK = 0x26262c, WOOD = 0x6e3e19, WOODD = 0x4a2a12, BARE = 0xd5dbe2, GLASS = 0x8fb4c8;
/** [x, y, z, colour] cells of a box of cells x0..x1, y0..y1, z0..z1 (inclusive). */
function box(out, x0, x1, y0, y1, z0, z1, c) {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) out.push([x, y, z, c]);
}
export const LONG_GUNS = Object.freeze({
  // THE DOORMAN: two fat barrels side by side over a short fore-end, a block of an action, a wooden stock cut short;
  // 0.9 m from butt to muzzle (the mittens are twice a hand, and from the game's camera the big head hides all but
  // what reaches past it). Bare steel at the muzzles
  doorman: {
    cells() {
      const o = [];
      box(o, -2, 1, 2, 4, 2, 25, STEEL);          // the two barrels (side by side, 2 cells each)
      box(o, -2, 1, 2, 4, 26, 26, BARE);          // their mouths
      box(o, -1, 0, 0, 1, 6, 18, WOOD);           // the fore-end under them (where the −x hand goes)
      box(o, -2, 1, 0, 3, -1, 1, DARK);           // the action
      box(o, -1, 0, -1, 1, -3, -1, WOOD);         // the wrist (the +x hand)
      box(o, -1, 0, -3, 2, -9, -4, WOOD);         // the stock, cut short
      box(o, -1, 0, -3, 2, -10, -10, WOODD);      // its butt
      return o;
    },
    muzzle: [0, 0.08, 0.67],
  },
  // THE LONG-EYE: a long thin barrel, a wooden stock and fore-end, a scope block on top with glass at both ends;
  // 1.1 m from butt to muzzle
  longeye: {
    cells() {
      const o = [];
      box(o, -1, 0, 2, 2, 2, 30, STEEL);          // the barrel
      box(o, -1, 0, 2, 2, 31, 31, BARE);          // its mouth
      box(o, -1, 0, 0, 1, 2, 18, WOOD);           // the fore-end (the −x hand)
      box(o, -1, 0, 0, 3, -2, 1, DARK);           // the action and the bolt
      box(o, 1, 1, 3, 3, -1, -1, BARE);           // the bolt's knob
      box(o, -1, 0, 4, 5, -2, 8, DARK);           // the scope
      box(o, -1, 0, 4, 5, 9, 9, GLASS);           // its front glass
      box(o, -1, 0, 4, 5, -3, -3, GLASS);         // its back glass
      box(o, -1, 0, -1, 1, -4, -3, WOOD);         // the wrist (the +x hand)
      box(o, -1, 0, -3, 2, -12, -5, WOOD);        // the stock
      box(o, -1, 0, -3, 2, -13, -13, WOODD);      // its butt
      return o;
    },
    muzzle: [0, 0.06, 0.79],
  },
});

const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.86 }, { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.86 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1 }, { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.62 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.78 }, { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.78 },
];
const GEO = {};
/** The gun's mesh: one quad per open cell face, flat shaded by its facing, vertex colours (THREE passed in; memoised). */
export function longGeometry(THREE, kind) {
  if (GEO[kind]) return GEO[kind];
  const cells = LONG_GUNS[kind].cells();
  const has = new Set(cells.map(c => `${c[0]},${c[1]},${c[2]}`));
  const P = [];
  const N = [];
  const C = [];
  const I = [];
  const col = new THREE.Color();
  let v = 0;
  for (const [x, y, z, hex] of cells) {
    for (const F of FACES) {
      if (has.has(`${x + F.n[0]},${y + F.n[1]},${z + F.n[2]}`)) continue;
      col.setHex(hex);
      for (const c of F.c) {
        P.push((x + c[0]) * GRAIN, (y + c[1]) * GRAIN, (z + c[2]) * GRAIN);
        N.push(...F.n);
        C.push(col.r * F.s, col.g * F.s, col.b * F.s);
      }
      I.push(v, v + 1, v + 2, v, v + 2, v + 3);
      v += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setIndex(I);
  g.computeBoundingSphere();
  GEO[kind] = g;
  return g;
}

/**
 * The gun's pose in the walker's body frame, for a look slot and a kick: { p (its grip point: the +x hand), R (9
 * numbers, column-major: the gun's x, y, z axes), dir } with its barrel from the +x hand through the −x hand.
 */
export function longPose(look, kick = 0, hip = RIG.hipY) {
  const { R, L } = longHands(look, kick, hip);
  const z = norm(vsub(L, R));
  const x = norm(cross([0, 1, 0], z));
  const y = cross(z, x);
  return { p: R, R: [...x, ...y, ...z], dir: z, hands: { R, L } };
}
/** The muzzle of `kind` held so, and the barrel's way (body frame). */
export function longMuzzle(kind, look, kick = 0, hip = RIG.hipY) {
  const Q = longPose(look, kick, hip);
  const m = LONG_GUNS[kind].muzzle;
  const r = Q.R;
  return { p: [Q.p[0] + r[0] * m[0] + r[3] * m[1] + r[6] * m[2], Q.p[1] + r[1] * m[0] + r[4] * m[1] + r[7] * m[2], Q.p[2] + r[2] * m[0] + r[5] * m[1] + r[8] * m[2]], d: Q.dir };
}
/** The local → walker matrix of the gun for its pose. */
export function longMatrix(THREE, Q, out = new THREE.Matrix4()) {
  const R = Q.R;
  const p = Q.p;
  return out.set(R[0], R[3], R[6], p[0], R[1], R[4], R[7], p[1], R[2], R[5], R[8], p[2], 0, 0, 0, 1);
}

const lookUp = look => lookParts(look)[1];
/** The kick of a shot over its clip's clock (0 … 1): out fast, back slower (the Long-eye's longer). */
export const longKick = (kind, t) => {
  const D = LONG_FIRE_D[kind];
  const out = clamp(t / 0.045, 0, 1);
  const s = clamp((t - 0.06) / (D * 0.8 - 0.06), 0, 1);
  return (1 - (1 - out) * (1 - out)) * (1 - s * s * (3 - 2 * s));
};
const prop = (kind, fire) => ({
  id: `fight-${kind}`,
  geometry: THREE => longGeometry(THREE, kind),
  matrix: (THREE, t, out, g) => longMatrix(THREE, longPose(fire ? lookFor1(g?.look ?? 0) : g?.look ?? 0, fire ? longKick(kind, t) : 0, g?.py ?? RIG.hipY), out),
});
/** A look slot with the gun all the way up (a shot is always from the shoulder). */
function lookFor1(look) {
  const [a] = lookParts(look);
  const b = Math.atan2(Math.sin(a), Math.cos(a));
  return b + 8 * 16;
}

export const CLIPS = ['doorman', 'longeye'].flatMap(kind => {
  const D = LONG_FIRE_D[kind];
  const name = `fight_${kind}`;
  const what = kind === 'doorman' ? 'the Doorman (a short double barrel)' : 'the Long-eye (a scoped rifle)';
  return [
    {
      name, dur: LONG_D, loop: true, moving: true, speed: 0, stride: 1, blendIn: 0.14, blendOut: 0.2, prop: prop(kind, false),
      note: `a walking overlay loop (the legs are the walk's): ${what} in both hands, the +x on the grip and the −x out along the fore-end; low across the body when nobody is in range, at the shoulder and on them when the look slot says up`,
      glsl: /* glsl */`fLong(P, fUp(), 0., 1.);`,
    },
    {
      name: `${name}_fire`, dur: D, moving: true, speed: 0, stride: 1, blendIn: 0.02, blendOut: 0.15, prop: prop(kind, true),
      note: `one shot of ${what}, a walking overlay: the kick at 0–0.045 s, both arms ride up and the chest rocks back, back on them by ${(D * 0.8).toFixed(2)} s; the page draws the shot itself (fx.js${kind === 'doorman' ? ': a spread' : ': one long hard line'})`,
      glsl: /* glsl */`float kk = cOut(t, 0., .045) * (1. - cS(t, .06, ${f(D * 0.8)})); fLong(P, 1., kk, 1.);`,
    },
  ];
});
/** For the tests: is the gun up (the look slot's raise)? */
export const longUp = lookUp;
