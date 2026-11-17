// THE FIGHT'S GUN CLIPS: the gun held ready, raised on whoever they shoot at, and the shot's kick. Both are WALKING
// OVERLAYS (moving, speed 0: CLIPS.md § Moods and reactions): they pose the chest, the head and the arms and leave the
// legs to the walk, so a shooter backing away keeps walking while the upper body turns to the target. The walk's
// legs cannot step backwards (gait2.js runs the cycle on distance, forwards only), so the body faces the way it walks
// and the chest, the head and the gun arm turn to the target as far as the rig turns: the chest a little under 50°,
// the head 70° more, the arm the rest (out to the gun side to 130°; across the chest less, the big head is in the way).
//
// THE LOOK SLOT (the cast's cLook: the gait state's g.look, read by the clip): one number carries both what the page
// says. Its fraction is the bearing of whoever they fight (rad, body frame, + to +x, −π … π) and its eighths count
// how far the gun is up (0 … 16 sixteenths): look = bearing + 8 × round(16 × up). fLook() in the shader and lookOf()
// here read it apart. The page writes it every frame (anim.js).
//
// THE GUN is the city's own pistol (anim/cast/clips/gun-prop.js, the shooter's in the robbery clips: one model
// everywhere), in the +x hand, posed on the CPU by the same arm the shader poses (the forward kinematics of
// robbery.js handFK, copied for a chest that turns over walking legs). Every gun of the fight is that one pistol: the
// fight's guns keep their names and have no looks of their own.
//
//   fight_gun    a loop (1.2 s): the gun ready (low, pointing down ahead) or up and on them, as the look slot says,
//                a small sway when up
//   fight_fire   one shot (0.26 s): the kick at t 0 (the gun flips up, the elbow gives, the chest and head rock back),
//                back on them by 0.22; its first and last pose are fight_gun's up pose, so the two switch with no pop
import { GUN, gunGeometry, gunMatrix, gunPoint, gunDir } from '../../../city/from-trunk/style/city/anim/cast/clips/gun-prop.js';

export const FIRE_D = 0.26;
export const GUN_D = 1.2;

/** The look slot apart: [bearing, up]. */
export function lookOf(look = 0) {
  const k = Math.floor((look + 4) / 8);
  return [look - 8 * k, Math.max(0, Math.min(1, k / 16))];
}
/** The look slot from a bearing (rad) and how far the gun is up (0 … 1). */
export function lookFor(bearing, up = 0) {
  const b = Math.atan2(Math.sin(bearing), Math.cos(bearing));
  return b + 8 * Math.round(16 * Math.max(0, Math.min(1, up)));
}

/** The shared GLSL: the look slot apart, and the gun arm's pose (also the JS twin below: keep the two the same). */
export const GUN_GLSL = /* glsl */`
float fBear() { float k = floor((cLook + 4.) / 8.); return cLook - 8. * k; }
float fUp() { return clamp(floor((cLook + 4.) / 8.) / 16., 0., 1.); }
// the bearing as the gun arm reaches it: from far round on the free side, the other way, over the gun side
float fGunBear() { float a = fBear(); return a < -2.4 ? a + 6.2832 : a; }
// THE GUN POSE: up 0 ready (the arm down ahead, the gun pointing at the ground in front) · up 1 aimed (the arm out at
// shoulder height on them); kick: the shot's (0 … 1); k: the clip's own weight
void fGun(inout Pose P, float up, float kick, float sway, float k) {
  float a = fGunBear();
  float ty = clamp(a * .55, -.85, .85) - .2 * up;
  float ra = clamp(a - ty, -1., 2.3);
  P.torso = mix(P.torso, vec3(.03 * up - .09 * kick + .01 * sway, ty, -.03 * up), k);
  P.head.y = mix(P.head.y, clamp(a - ty, -1.2, 1.2), k);
  P.head.x = mix(P.head.x, -.05 * up - .14 * kick, k);
  cArm(P, 1, vec4(mix(.45, 1.38, up) + .4 * kick + .02 * sway, .05, -ra * (.35 + .65 * up), .05), mix(.6, .25, up) + .45 * kick, k);
  cArm(P, 0, vec4(.3 + .15 * up, .16, .12, .3), .75, k * (.3 + .55 * up));
}`;

// ── the JS twin of fGun's numbers, and the forward kinematics of the +x hand (robbery.js handFK, for a chest over
// walking legs: the chest turns about the pelvis at its rest height, then sits on the walk's hip)
function gunAngles(look, kick = 0, sway = 0) {
  let [a, up] = lookOf(look);
  if (a < -2.4) a += 2 * Math.PI;
  const ty = Math.max(-0.85, Math.min(0.85, a * 0.55)) - 0.2 * up;
  const ra = Math.max(-1, Math.min(2.3, a - ty));
  const mix = (x, y, f) => x + (y - x) * f;
  return {
    v: { tx: 0.03 * up - 0.09 * kick + 0.01 * sway, ty, tz: -0.03 * up },
    a: { ap: mix(0.45, 1.38, up) + 0.4 * kick + 0.02 * sway, ar: 0.05, ay: -ra * (0.35 + 0.65 * up), at: 0.05, ae: mix(0.6, 0.25, up) + 0.45 * kick },
  };
}
const R3 = {
  x: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]; },
  y: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; },
  z: (a, v) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; },
};
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const RIG = { hipY: 0.5, hipZ: 0.025, sh: [0.25, 0.825, 0], hinge: [0, 0.65, 0.05], grip: [0.325, 0.39, 0] };
const GUN_IN_HAND = [[1, 0, 0], [0, 0, 1], [0, -1, 0]];
/** The gun's pose in the walker's body frame ({ p, R }, gun-prop.js's), for a look slot, a kick and the walk's hip. */
export function gunPose(look, kick = 0, sway = 0, hip = RIG.hipY) {
  const { v, a } = gunAngles(look, kick, sway);
  const arm = d => R3.y(-a.ay, R3.z(a.ar, R3.x(-a.ap, R3.y(-a.at, d))));
  const chest = d => R3.z(v.tz, R3.x(v.tx, R3.y(v.ty, d)));
  const pc = [0, RIG.hipY, RIG.hipZ];
  let q = vadd(RIG.hinge, R3.x(-a.ae, vsub(RIG.grip, RIG.hinge)));
  q = vadd(RIG.sh, arm(vsub(q, RIG.sh)));
  const p = vadd([0, hip, RIG.hipZ], chest(vsub(q, pc)));
  return { p, R: GUN_IN_HAND.flatMap(d => chest(arm(R3.x(-a.ae, d)))) };
}
/** The muzzle and the barrel's way, body frame, for a look slot and a kick. */
export function gunMuzzle(look, kick = 0, hip = RIG.hipY) {
  const q = gunPose(look, kick, 0, hip);
  return { p: gunPoint(q, GUN.muzzle), d: gunDir(q, GUN.dir) };
}

const kickAt = t => {
  const c = x => Math.min(1, Math.max(0, x));
  const out = c(t / 0.04);
  const s = c((t - 0.05) / (0.22 - 0.05));
  return (1 - (1 - out) * (1 - out)) * (1 - s * s * (3 - 2 * s));
};
const swayAt = t => Math.sin((2 * Math.PI * t) / GUN_D);
const prop = (kicks) => ({
  id: 'fight-gun',
  geometry: THREE => gunGeometry(THREE),
  matrix: (THREE, t, out, g) => gunMatrix(THREE, gunPose(g?.look ?? 0, kicks ? kickAt(t) : 0, kicks ? 0 : swayAt(t) * lookOf(g?.look ?? 0)[1], g?.py ?? RIG.hipY), out),
});

export const CLIPS = [
  {
    name: 'fight_gun', dur: GUN_D, loop: true, moving: true, speed: 0, stride: 1, blendIn: 0.12, blendOut: 0.2, prop: prop(false),
    note: 'a walking overlay loop (the legs are the walk\'s; prop: the city\'s pistol in the +x hand): the gun ready, the arm down ahead, or up at shoulder height on them, as far as the look slot says (anim.js raises it while anyone is in range), the chest, the head and the arm turned to them; a small sway when up',
    glsl: /* glsl */`fGun(P, fUp(), 0., sin(6.2832 * t / D) * fUp(), 1.);`,
  },
  {
    name: 'fight_fire', dur: FIRE_D, moving: true, speed: 0, stride: 1, blendIn: 0.02, blendOut: 0.15, prop: prop(true),
    note: 'one shot, a walking overlay (prop: the pistol): the kick at 0–0.04 s, the gun flips up, the elbow gives, the chest and the head rock back · on them again by 0.22; the flash, the tracer and the puff are the page\'s (fx.js), at the muzzle on the same frame',
    glsl: /* glsl */`float kk = cOut(t, 0., .04) * (1. - cS(t, .05, .22)); fGun(P, 1., kk, 0., 1.);`,
  },
];
