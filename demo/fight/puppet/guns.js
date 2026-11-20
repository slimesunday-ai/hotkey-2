// THE FOUR GUNS, HELD BY HAND (anim-1). A gun here is a thing with a place and a line in the body's own space; the
// hands are put ON it (rig.js armTo solves each arm to the gun's grip points), never the other way round. So the muzzle,
// the flash, the shot's line and the shell all leave from where the barrel IS in the pose, and a kick that throws the
// barrel up throws the flash up with it.
//
// Each gun is its own character (the owner: "different guns should do different things"):
//   THE SIX-SHOT   one hand, the arm out along the line, the chest side-on behind it; the shot flips the muzzle UP and
//                  the hand rides it; back on the line in a quarter of a second. Rests hanging by the thigh.
//   THE CHOPPER    both hands, low at the chest, braced; it does not stop to fire: each round a short hard shake, the
//                  muzzle walking up as a burst goes on and falling back when it stops. Fires on the move.
//   THE DOORMAN    at the shoulder, both hands. The shot SHOVES the whole body back and up; then the pump: the front
//                  hand racks it back (the shell leaves there) and forward. Heavy, and slow to come back on.
//   THE LONG-EYE   set before it fires: sunk behind the glass, still. One shot: straight back hard, the muzzle high,
//                  and a long way down; the bolt worked by the trigger hand on the way.
// A long gun at rest is carried across the body, muzzle up (port arms), and walks like that.
//
// THE FRAMES. Everything here is told in the CHEST's own frame (rig.js: shoulders at x ±0.25, y 0.825; +z ahead of the
// chest): a gun's grip (where the trigger hand's fist is), its line `dir` and its own up `up`. The gun's own frame:
// origin the grip, +z along the barrel, +y up, +x to its right. `gunPoint(G, [x, y, z])` is a point of the gun in the
// chest's frame; fk(P).chestAt takes it on to the body's, and the body's place and heading to the world.
//
// THE RIG'S LIMIT, said once: an arm reaches 0.44 m and the shoulders are 0.5 m apart, so two hands meet only close in
// front of the chest; a long gun is held short and turned across the chest (the chest side-on to the line by 45°) or
// the front hand could not reach it. The head is a metre wide and starts at the shoulders: from above it covers the
// hands; the barrel is what shows, so the barrels are long.
import { RIG, fk, armTo, pose0, mirrorPose, mixPose } from './rig.js';
import { E, ramp } from './plan.js';

// (lighter than a gun is: on dark asphalt, from the game's camera, a gun-metal gun was a hair)
const STEEL = 0x7a8496, DARK = 0x2e3038, WOOD = 0xa9622a, PALE = 0xe2e7ec, GLASS = 0x86b6cc, IRON = 0x4a4d55;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, k) => a + (b - a) * k;
const mix3 = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
const norm = v => {
  const d = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / d, v[1] / d, v[2] / d];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** A sharp knock that dies away: 1 at `a` s, gone by about a + 4τ. */
const knock = (t, a, tau) => (t < 0 ? 0 : t < a ? E.out(t / a) : Math.exp(-(t - a) / tau));
/** Up and back: 0 → 1 → 0 over [t0, t1], held in the middle by `hold` of it. */
const there = (t, t0, t1, hold = 0.3) => {
  const u = (t - t0) / (t1 - t0);
  if (u <= 0 || u >= 1) return 0;
  const e = (1 - hold) / 2;
  return u < e ? E.s(u / e) : u > 1 - e ? E.s((1 - u) / e) : 1;
};

/**
 * THE GUNS. parts: boxes [x0, x1, y0, y1, z0, z1, colour] in the gun's frame (m). slide: the part that is worked (the
 * pump, the bolt): its box, and how far back it goes. muzzle: where the shot leaves. eject: where the shell does.
 * fore: where the front hand holds (on the slide, for the pump: it moves with it). raise: s to bring it up. fat: how
 * much thicker than told it is drawn, across its line (the figure's head is a metre wide and its arm 0.44 m: a gun at
 * its true size is a toothpick under that head, seen from the game's camera; the barrels are long for the same reason).
 */
export const GUNS = Object.freeze({
  pistol: {
    name: 'the six-shot', hands: 1, raise: 0.13, fat: 2.3, muzzle: [0, 0.046, 0.46], eject: null, fore: null,
    parts: [
      [-0.022, 0.022, -0.095, 0.012, -0.032, 0.02, WOOD],
      [-0.024, 0.024, 0.0, 0.062, -0.04, 0.08, STEEL],
      [-0.036, 0.036, 0.004, 0.066, 0.028, 0.094, PALE],
      [-0.015, 0.015, 0.03, 0.062, 0.08, 0.46, STEEL],
      [-0.006, 0.006, 0.062, 0.08, 0.42, 0.45, DARK],
      [-0.008, 0.008, 0.052, 0.09, -0.052, -0.03, DARK],
    ],
  },
  chopper: {
    name: 'the chopper', hands: 2, raise: 0.2, fat: 2.3, muzzle: [0, 0.04, 0.78], eject: [0.034, 0.06, 0.03], fore: [0, -0.012, 0.2],
    parts: [
      [-0.02, 0.02, -0.09, 0.01, -0.028, 0.02, DARK],
      [-0.03, 0.03, 0.0, 0.08, -0.1, 0.21, STEEL],
      [-0.017, 0.017, -0.2, 0.0, 0.07, 0.12, DARK],
      [-0.012, 0.012, 0.026, 0.054, 0.21, 0.78, DARK],
      [-0.022, 0.022, 0.008, 0.072, 0.21, 0.56, STEEL],
      [-0.014, 0.014, 0.024, 0.052, -0.24, -0.1, DARK],
      [-0.022, 0.022, -0.03, 0.075, -0.27, -0.24, DARK],
    ],
  },
  doorman: {
    name: 'the Doorman', hands: 2, raise: 0.3, fat: 2.4, muzzle: [0, 0.046, 0.96], eject: [0.034, 0.05, 0.1], fore: [0, -0.008, 0.3],
    slide: { box: [-0.028, 0.028, -0.036, 0.026, 0.22, 0.38, WOOD], travel: -0.12 },
    parts: [
      [-0.02, 0.02, -0.075, 0.012, -0.03, 0.02, WOOD],
      [-0.023, 0.023, -0.08, 0.03, -0.25, -0.03, WOOD],
      [-0.027, 0.027, -0.006, 0.066, -0.03, 0.2, STEEL],
      [-0.016, 0.016, 0.03, 0.062, 0.2, 0.96, STEEL],
      [-0.013, 0.013, -0.006, 0.022, 0.2, 0.8, DARK],
    ],
  },
  longeye: {
    name: 'the Long-eye', hands: 2, raise: 0.42, fat: 2.2, muzzle: [0, 0.036, 1.25], eject: [0.03, 0.05, 0.04], fore: [0, -0.02, 0.31],
    slide: { box: [0.024, 0.07, 0.026, 0.05, 0.0, 0.03, PALE], travel: -0.075 },
    parts: [
      [-0.02, 0.02, -0.075, 0.012, -0.03, 0.02, WOOD],
      [-0.022, 0.022, -0.085, 0.028, -0.28, -0.03, WOOD],
      [-0.024, 0.024, -0.004, 0.054, -0.03, 0.17, STEEL],
      [-0.011, 0.011, 0.022, 0.05, 0.17, 1.25, STEEL],
      [-0.02, 0.02, -0.028, 0.02, 0.1, 0.56, WOOD],
      [-0.016, 0.016, 0.072, 0.108, -0.04, 0.24, DARK],
      [-0.022, 0.022, 0.066, 0.114, 0.2, 0.27, DARK],
      [-0.012, 0.012, 0.078, 0.102, 0.268, 0.274, GLASS],
    ],
  },
  // (Cousin Earl's tire iron and the blades are not guns: held.js draws them along the forearm)
});
export const GUN_OF = Object.freeze({ pistol: 'pistol', chopper: 'chopper', doorman: 'doorman', longeye: 'longeye' });
void IRON;

/** A point of the gun, in the chest's frame. */
export function gunPoint(G, p0) {
  // (a gun is drawn fattened across its line, GUNS.fat, to read under a head a metre wide: its points with it)
  const fat = GUNS[G.kind]?.fat ?? 1;
  const p = [p0[0] * fat, p0[1] * fat, p0[2]];
  const r = cross(G.up, G.dir);
  return [G.grip[0] + r[0] * p[0] + G.up[0] * p[1] + G.dir[0] * p[2], G.grip[1] + r[1] * p[0] + G.up[1] * p[1] + G.dir[1] * p[2], G.grip[2] + r[2] * p[0] + G.up[2] * p[1] + G.dir[2] * p[2]];
}
/** The line and the up of a gun pointed `yaw` to the chest's +x and `pitch` up, rolled `cant` to its right. */
function lineOf(yaw, pitch, cant = 0) {
  const [sy, cy, sp, cp] = [Math.sin(yaw), Math.cos(yaw), Math.sin(pitch), Math.cos(pitch)];
  const dir = [sy * cp, sp, cy * cp];
  const up0 = [-sy * sp, cp, -cy * sp];
  const r0 = cross(up0, dir);
  return { dir, up: norm([up0[0] * Math.cos(cant) + r0[0] * Math.sin(cant), up0[1] * Math.cos(cant) + r0[1] * Math.sin(cant), up0[2] * Math.cos(cant) + r0[2] * Math.sin(cant)]) };
}

// ── EACH GUN'S HOLDS (chest frame). rho: how far the gun's line is turned from the chest's front when it is aimed
// (the chest stands side-on to the line by that much, the other way); reach: how far the line may swing from that
// without the chest turning (the arms' own play); twist: how far the chest turns on the legs. ──
// (the arm folds no shorter than 0.31 m and reaches 0.44: every hold below keeps each fist in that band from its own
// shoulder, the pump racked back and the gun kicked back included; test/fight-guns.test.mjs measures it)
const HOLD = {
  // one hand out along the line; the chest side-on behind it, the R shoulder forward
  pistol: { rho: 0.42, reach: [-0.75, 1.0], twist: 1.3, rest: { grip: [0.335, 0.43, 0.06], yaw: 0.1, pitch: -1.25 } },
  // BOTH HANDS: SIDE-ON. The front hand can only be ahead of the trigger hand along the barrel if the barrel lies
  // across the chest: the body stands side-on to the line (the L shoulder to it, as anybody with a long gun does),
  // and the gun, pushed out as far as both arms go, shows its barrel past the head. Squarer than this the gun sat
  // tucked in under the head and nothing of it showed from above.
  chopper: { rho: -1.2, reach: [-0.06, 0.06], twist: 1.25, rest: { grip: [0.04, 0.63, 0.19], yaw: -0.9, pitch: -0.3 }, aim: { grip: [0.03, 0.68, 0.3] } },
  doorman: { rho: -1.2, reach: [-0.06, 0.06], twist: 1.25, rest: { grip: [0.14, 0.53, 0.12], yaw: -0.9, pitch: 0.62 }, aim: { grip: [0.04, 0.74, 0.28] } },
  longeye: { rho: -1.2, reach: [-0.06, 0.06], twist: 1.25, rest: { grip: [0.14, 0.53, 0.12], yaw: -0.95, pitch: 0.7 }, aim: { grip: [0.05, 0.78, 0.27] } },
};
/** How a body with this gun stands to whoever it is on, standing still (rad off square: the side-on stance's own turn). */
/**
 * How much of a gun's kick its holder's whole body takes, 0 to 1 (the rest goes into the shoulder and the gun). ONE
 * NUMBER A GUN, for the owner to pick: the Doorman at 1 is the first take (thrown back from the feet), 0.5 the
 * second. `?kick=<n>` on the page tries another without an edit.
 */
export const KICK = { doorman: 0.5 };
{
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('kick') : null;
  if (q !== null && q !== '' && Number.isFinite(Number(q))) KICK.doorman = Math.max(0, Math.min(1, Number(q)));
}
/**
 * THE CHOPPER IS AN AUTOMATIC (anim-2; the owner: "automatic is fast"). The rules give it 3.4 shots a second, half
 * again a six-shot's: to the eye, the same gun. So every shot of the rules' is DRAWN as a burst of this many rounds,
 * evenly through the time to the next (three: ten a second while it fires): each its own flash, line, shake and
 * case. The rules, the rounds counted and what a shot does are untouched: one number, for the owner to pick.
 * `?burst=<n>` on the page tries another (1: a round a shot, as the rules count them).
 */
export const BURST = { chopper: 3 };
{
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('burst') : null;
  if (q !== null && q !== '' && Number.isFinite(Number(q))) BURST.chopper = Math.max(1, Math.min(4, Math.round(Number(q))));
}
export const STANCE = Object.freeze({ pistol: 0, chopper: 0.6, doorman: 0.6, longeye: 0.6 });

/**
 * THE POSE OF A BODY WITH A GUN, and where the gun is. Writes the chest, the head and both fists of `P` (a pose0-like
 * pose; the legs are left as they are: the walk's, or whatever stands under it) and returns the gun:
 *   { kind, grip, dir, up (chest frame), slide 0..1 (the pump or bolt back), fore (the front hand's place) }
 * `S`: { kind, aim (rad: the line's bearing from the legs' heading, + to the body's R), pitch (rad, up), up 0..1 (how
 *        far it is raised), since (s since its last shot; 9 if none), heat (the chopper: rounds of the burst still
 *        felt, 0..6), reload (0..1 through a reload, or -1), v (m/s the body walks), t (a clock, for the breath) }
 */
export function gunPose(P, S) {
  const kind = GUN_OF[S.kind] ?? 'pistol';
  const D = GUNS[kind];
  const H = HOLD[kind];
  const u = E.s(clamp(S.up ?? 0, 0, 1));
  const since = S.since ?? 9;
  const v = S.v ?? 0;
  const t = S.t ?? 0;
  const walk = Math.min(1, v / 2.6);
  const breath = Math.sin((TAU * t) / 3.1);
  const sway = Math.sin(t * 7.2) * walk;
  // THE CHEST: turned so the gun's line lies where it is asked (as far as it turns), side-on to it by the gun's own
  // stance; the arms take up what is left, as far as they swing
  const want = S.aim ?? 0;
  const ty1 = clamp(want - H.rho, -H.twist, H.twist);
  const rho1 = clamp(want - ty1, H.rho + H.reach[0], H.rho + H.reach[1]);
  // (at rest the chest only looks a little toward what is coming)
  const ty0 = clamp(want * 0.25, -0.4, 0.4);
  P.ty += mix(ty0, ty1, u);
  // THE SHOT, per gun: the knock (k), how far the muzzle is thrown up (climb, rad), back along the line (back, m), and
  // the body behind it
  let [climb, back, slide, tx, drop, lift] = [0, 0, 0, 0, 0, 0];
  let bolt = 0;
  /** the line's bearing from the LEGS' heading (rad, + to the body's R): which way "back from the shot" is */
  const lineAt = mix(ty0, ty1, u) + rho1;
  if (kind === 'pistol') {
    // THE SIX-SHOT: all of it goes up. The muzzle flips, the hand rides it up and the elbow gives; back down on the
    // line with a small overshoot
    const k = knock(since, 0.035, 0.07);
    const settle = there(since, 0.1, 0.3, 0);
    climb = 0.62 * k - 0.05 * settle;
    back = 0.035 * k;
    lift = 0.07 * k;
    tx = -0.05 * k;
  } else if (kind === 'chopper') {
    // THE CHOPPER: a short hard shake a round, never time to come back; the muzzle walks up with the burst
    const k = knock(since, 0.02, 0.035);
    const heat = clamp(S.heat ?? 0, 0, 6);
    climb = 0.05 * k + 0.035 * heat;
    back = 0.028 * k;
    // (BRACED: the weight forward and low over it, more so on the move; the shake is fore and aft, a hair of roll)
    tx = (0.2 + 0.06 * walk) * u - 0.03 * k - 0.012 * heat;
    drop = (0.06 + 0.02 * walk) * u;
    P.tz += 0.012 * k * (Math.floor(t * 31) % 2 ? 1 : -1);
  } else if (kind === 'doorman') {
    // THE DOORMAN: shoved back by all of it at once, the muzzle up; then the pump, back (the shell leaves) and forward
    const k = knock(since, 0.045, 0.13);
    // (HOW MUCH OF THE KICK THE BODY TAKES: KICK.doorman, one number. At 1 the whole body is thrown back from the
    // feet: the first take. Less, and the rest of it is in the shoulder and the gun: the muzzle higher, the gun
    // driven further back.)
    // (anim-2, 2026-11-19. The 30 degrees the first take was seen to lean were never this: 17 of them were the
    // walker's own roll into a turn and the rest the body rocking between two stances (gunner.js ownTurns,
    // stanceOff). What is here was 7 degrees at 0.5 and is now told as it happens: INTO THE SHOULDER, the gun's
    // shoulder punched back round the spine at once; the chest shoved back ALONG THE LINE (the body stands side-on
    // to it, so that is as much sideways as back: it used to be straight back over the heels whatever the line);
    // then TAKEN: the knees give under it a beat late, the weight comes forward again past where it was, into the
    // pump. The head is held level and on them through it: the chest takes the kick, not the eyes.)
    const K = KICK.doorman;
    const give = there(since, 0.04, 0.44, 0.1);
    const fwd = there(since, 0.2, 0.62, 0.1);
    slide = there(since, 0.2, 0.52, 0.12);
    climb = (0.2 + 0.22 * (1 - K)) * k - 0.05 * slide;
    back = (0.035 + 0.05 * (1 - K)) * k + 0.012 * slide;
    lift = (0.03 + 0.03 * (1 - K)) * k;
    const lean = 0.24 * K * k - 0.035 * fwd;
    tx = 0.06 * u - lean * Math.cos(lineAt);
    P.tz += lean * Math.sin(lineAt);
    drop = 0.02 * u + (0.02 + 0.04 * K) * give;
    P.hx += 0.6 * lean * Math.cos(lineAt);
    P.hz += -0.6 * lean * Math.sin(lineAt);
    P.ty += (0.1 + 0.16 * K) * k;
  } else {
    // THE LONG-EYE: set first (sunk behind the glass, the head down to it); the shot comes straight back hard, the
    // muzzle goes high and takes its time coming down; the bolt is worked on the way: up, back, forward, down
    const k = knock(since, 0.04, 0.2);
    const high = there(since, 0.03, 0.95, 0.25);
    climb = 0.2 * k + 0.24 * high;
    back = 0.035 * k;
    // (anim-2: back ALONG THE LINE, as the Doorman's is, and less of it in the body: it leaned 15 degrees over
    // the heels at every shot and threw the head back 17 more, twice what the Doorman does to anybody. What says
    // Long-eye is the muzzle high and slow to come down, and the bolt; the body rocks 11 degrees and the head 7)
    const lean = 0.2 * k + 0.06 * high;
    tx = 0.13 * u - lean * Math.cos(lineAt);
    P.tz += lean * Math.sin(lineAt);
    drop = 0.035 * u;
    bolt = there(since, 0.3, 0.86, 0.2);
    slide = there(since, 0.4, 0.78, 0.1);
    P.hx += 0.1 * u - 0.12 * k - 0.05 * high;
    P.hz += -0.12 * u * (1 - high);
  }
  P.tx += tx;
  P.drop += drop;
  // WHERE THE GUN IS: at rest, and aimed; `u` between them
  // (the line is the body's, not the chest's: a chest leaned over the gun does not point it at the ground. The chest
  // leans about the body's own side-to-side, after it has turned: a line across the body is not tipped by it at all,
  // one pointing behind is tipped the other way)
  // (and a chest rolled to the side tips a line that lies across it: taken out the same way)
  const pitch = (S.pitch ?? 0) + climb + P.tx * Math.cos(lineAt) - P.tz * Math.sin(lineAt);
  const A = lineOf(rho1, pitch);
  let gripA;
  if (kind === 'pistol') {
    // (out along the line from the shoulder, the elbow giving as it kicks)
    const r = 0.405 - back - 0.05 * (1 - u);
    gripA = [0.25 + A.dir[0] * r, 0.795 + lift + A.dir[1] * r * 0.9, 0.02 + A.dir[2] * r];
  } else {
    const g0 = H.aim.grip;
    gripA = [g0[0] - A.dir[0] * back, g0[1] + lift - A.dir[1] * back, g0[2] - A.dir[2] * back];
  }
  const R0 = lineOf(H.rest.yaw, H.rest.pitch + 0.03 * breath + 0.05 * sway);
  const grip0 = [H.rest.grip[0], H.rest.grip[1] + 0.012 * sway, H.rest.grip[2] + 0.02 * sway];
  const G = { kind, grip: mix3(grip0, gripA, u), dir: norm(mix3(R0.dir, A.dir, u)), up: norm(mix3(R0.up, A.up, u)), slide, fore: null };
  // THE RELOAD: the gun comes in and down in front of the chest, tipped over; the other hand does the work
  const rel = S.reload ?? -1;
  let work = 0;
  if (rel >= 0 && rel <= 1) {
    const inn = there(rel, 0, 1, 0.7);
    const L = kind === 'pistol' ? lineOf(-0.5, 0.9, -0.5) : kind === 'chopper' ? lineOf(-0.7, 0.35, -0.6) : lineOf(-0.85, -0.3, 0.5);
    const at = kind === 'pistol' ? [0.12, 0.66, 0.24] : kind === 'chopper' ? [0.06, 0.64, 0.16] : [0.12, 0.6, 0.1];
    G.grip = mix3(G.grip, at, inn);
    G.dir = norm(mix3(G.dir, L.dir, inn));
    G.up = norm(mix3(G.up, L.up, inn));
    // (the work: two trips of the other hand, to the belt and back to the gun)
    work = inn * (0.5 - 0.5 * Math.cos(TAU * 2 * clamp((rel - 0.12) / 0.76, 0, 1)));
    P.hx += 0.22 * inn;
    P.tx += 0.07 * inn;
  }
  // THE HANDS: the trigger hand on the grip (off it to the bolt and back, the Long-eye), the other on the gun's front
  // hold (with the pump as it goes), or where a one-handed gun leaves it
  const grip = G.grip;
  if (bolt > 0) {
    const b = gunPoint(G, [0.07, 0.07, 0.0 + GUNS.longeye.slide.travel * slide]);
    P.hR = mix3(grip, b, bolt);
  } else P.hR = [...grip];
  P.pR = kind === 'pistol' ? [0.7, -0.7, -0.2] : [1, -0.75, -0.2];
  if (D.fore) {
    const f = [D.fore[0], D.fore[1], D.fore[2] + (kind === 'doorman' ? D.slide.travel * slide : 0)];
    G.fore = gunPoint(G, f);
    const belt = [-0.2, 0.47, 0.12];
    P.hL = mix3(G.fore, belt, work);
    P.pL = [-1, -0.8, -0.1];
  } else if (work > 0 || u > 0) {
    // (the six-shot's other hand: in at the chest when it is up; at the cylinder for the reload)
    const tuck = [-0.16, 0.62, 0.2];
    const cyl = gunPoint(G, [-0.05, 0.03, 0.06]);
    const base = mix3(P.hL, tuck, u * 0.85);
    P.hL = mix3(base, mix3(cyl, [-0.2, 0.47, 0.12], 0.5 - 0.5 * Math.cos(TAU * 2 * clamp((rel - 0.12) / 0.76, 0, 1))), rel >= 0 && rel <= 1 ? there(rel, 0, 1, 0.7) : 0);
    P.pL = [-1, -0.7, -0.2];
  }
  // THE HEAD: down the line (what the chest has not turned, it turns), and a look where the gun is being fed
  P.hy += clamp((want - (ty0 + (ty1 - ty0) * u)) * (0.35 + 0.6 * u), -1.3, 1.3);
  return G;
}

/**
 * EITHER SHOULDER. A gun in both hands is held across the chest, and the chest turns only so far on the legs: held
 * at the R shoulder its line comes round to the body's L and behind, and no further to the R than a hand's width. A
 * body walking one way and firing the other has them on either side, so the gun CHANGES SHOULDER: `flip` 0 the R
 * shoulder (as gunPose tells it), 1 the L (the same hold, mirrored), between them the change itself (a fifth of a
 * second: the page moves `flip`). The six-shot is one hand's and stays in it. → the gun, as gunPose's, and
 * `hand`: which fist is the trigger's ('R' | 'L').
 */
const MA = pose0();
const MB = pose0();
export function gunPoseSided(P, S, flip = 0) {
  const two = (GUNS[GUN_OF[S.kind] ?? 'pistol'].hands ?? 1) === 2;
  if (!two || flip <= 0) return { ...gunPose(P, S), hand: 'R' };
  // (the mirrored hold: told as the R one for the line mirrored, then every side of it swapped)
  const Q = pose0();
  const Gm = gunPose(Q, { ...S, aim: -(S.aim ?? 0) });
  const M = mirrorPose(Q, MB);
  const fx = v => (v ? [-v[0], v[1], v[2]] : v);
  const GL = { ...Gm, grip: fx(Gm.grip), dir: fx(Gm.dir), up: fx(Gm.up), fore: fx(Gm.fore), hand: 'L' };
  if (flip >= 1) {
    mixPose(P, M, 1);
    return GL;
  }
  const A = pose0();
  const GR = gunPose(A, S);
  const k = E.s(flip);
  mixPose(mixPose(P, A, 1, MA), M, k, P);
  return { ...GR, grip: mix3(GR.grip, GL.grip, k), dir: norm(mix3(GR.dir, GL.dir, k)), up: norm(mix3(GR.up, GL.up, k)), fore: GR.fore && GL.fore ? mix3(GR.fore, GL.fore, k) : null, slide: mix(GR.slide, GL.slide, k), hand: k < 0.5 ? 'R' : 'L', changing: true };
}

/** Both arms worked out from the fists (the shader takes angles): after any pose that sets hL / hR. */
export function solveArms(P) {
  const a = armTo(P.hL, -1, P.pL, 2.1);
  const b = armTo(P.hR, 1, P.pR, 2.1);
  for (let i = 0; i < 5; i++) {
    P.aL[i] = a[i];
    P.aR[i] = b[i];
  }
  return P;
}

/**
 * The gun in the BODY's frame, from a solved pose: { at (the grip), dir, up, muzzle, eject, slide }. The world's is the
 * body's place and heading on that (rig.js toWorld; directions turned by the heading alone).
 */
export function gunInBody(P, G) {
  const F = fk(P);
  const at = F.chestAt(G.grip);
  const tip = F.chestAt([G.grip[0] + G.dir[0], G.grip[1] + G.dir[1], G.grip[2] + G.dir[2]]);
  const top = F.chestAt([G.grip[0] + G.up[0], G.grip[1] + G.up[1], G.grip[2] + G.up[2]]);
  const D = GUNS[G.kind];
  const pt = p => (p ? F.chestAt(gunPoint(G, p)) : null);
  const L = G.hand === 'L';
  return { at, dir: norm([tip[0] - at[0], tip[1] - at[1], tip[2] - at[2]]), up: norm([top[0] - at[0], top[1] - at[1], top[2] - at[2]]), muzzle: pt(D.muzzle), eject: pt(D.eject), slide: G.slide, fistR: F.fistR, fistL: F.fistL, trigger: L ? F.fistL : F.fistR, front: L ? F.fistR : F.fistL, fore: G.fore ? F.chestAt(G.fore) : null };
}

// ── SHOT: what a round does to whoever it hits. By WHAT hit (each gun hits its own way) and from WHERE (`from`: the
// bearing of whoever fired, from the body's own heading, + to its R). `s` seconds since. Only the chest, the head and
// the arms: the legs go on doing what they were (the rules move the body). ──
export const SHOT = {
  // a round from the six-shot: punched. The side it hit goes back, the head a beat after
  pistol: { dur: 0.42, pose: (P, s, K) => jolt(P, s, K, 0.4, 0.14, 0.32) },
  // the chopper: stitched, a short jerk a round, never still between them
  chopper: { dur: 0.24, pose: (P, s, K) => jolt(P, s, K, 0.22, 0.06, 0.16) },
  // the Doorman: folded over it and carried back; the arms thrown forward
  doorman: {
    dur: 0.7,
    pose(P, s, K) {
      const k = knock(s, 0.05, 0.2);
      const f = K.front ? 1 : -1;
      P.tx += 0.5 * k * f;
      P.drop += 0.1 * k;
      P.hx += 0.35 * k * f;
      P.ty += -Math.sin(K.from ?? 0) * 0.4 * k;
      for (const [h, sx] of [[P.hL, -1], [P.hR, 1]]) {
        const to = [sx * 0.3, 0.66, 0.36 * f];
        for (let i = 0; i < 3; i++) h[i] += (to[i] - h[i]) * k * 0.8;
      }
    },
  },
  // the Long-eye: it goes through. The shoulder it hit is thrown round, the head whipped after it, a long sway back
  longeye: {
    dur: 0.8,
    pose(P, s, K) {
      const k = knock(s, 0.04, 0.26);
      const side = Math.sin(K.from ?? 0) >= 0 ? 1 : -1;
      const f = K.front ? 1 : -1;
      P.ty += -side * 0.85 * k * f;
      P.tz += side * 0.22 * k;
      P.tx += -0.24 * k * f;
      P.hy += -side * 0.5 * knock(s - 0.05, 0.05, 0.22) * f;
      P.hx += -0.3 * k * f;
      P.drop += 0.06 * k;
    },
  },
};
function jolt(P, s, K, twist, lean, head) {
  const k = knock(s, 0.03, K.tau ?? 0.11);
  const side = Math.sin(K.from ?? 0) >= 0 ? 1 : -1;
  const f = K.front ? 1 : -1;
  P.ty += -side * twist * k * f;
  P.tx += -lean * k * f;
  P.hx += -head * knock(s - 0.03, 0.04, 0.12) * f;
  P.hy += -side * head * 0.6 * k * f;
}

// ── DROPPED: the falls of a body that a round has killed. Whole body (legs and root too: the page takes the body from
// the walk for it). `s` seconds since; K { from (the bearing of whoever fired, body's own), v (m/s it was going, along
// its own heading), w }. Each ends lying still; `face`: +1 it ends on its front, −1 on its back. ──
const LIE = -1.36;
const PRONE = 1.24;
/** Flat on the front, at rest (rad): what the fall settles to. */
const FLAT = 1.5;
/** The root turned so that "back" is away from whoever fired, eased in (a body does not snap round to fall). */
const away = (P, s, K, front, dur = 0.22) => {
  const a = front ? K.from ?? 0 : (K.from ?? 0) - Math.PI * Math.sign(K.from || 1);
  P.ry = clamp(Math.atan2(Math.sin(a), Math.cos(a)), -1.2, 1.2) * ramp(s, 0, dur, E.out);
};
const arms = (P, k, L, R) => {
  for (let i = 0; i < 3; i++) {
    P.hL[i] += (L[i] - P.hL[i]) * k;
    P.hR[i] += (R[i] - P.hR[i]) * k;
  }
};
export const DROPS = {
  // THE SIX-SHOT, standing: the legs go. A hand to where it went in, the knees fold, down onto the seat and over
  // onto the back
  crumple: {
    dur: 1.05, face: -1,
    pose(P, s, K) {
      const front = Math.cos(K.from ?? 0) >= 0;
      const hit = knock(s, 0.04, 0.12);
      const sag = ramp(s, 0.06, 0.42, E.in);
      const tip = ramp(s, 0.34, 0.92, E.s);
      const still = ramp(s, 0.9, 1.25, E.s);
      away(P, s, K, front, 0.5);
      P.drop += 0.24 * sag * (1 - tip);
      P.rx = LIE * tip;
      P.tx += -0.2 * hit + 0.5 * sag * (1 - tip) + 0.12 * still;
      P.hx += -0.3 * hit + 0.36 * sag * (1 - tip);
      arms(P, sag * (1 - still * 0.6), [-0.12, 0.62, 0.22], [0.14, 0.66, 0.2]);
      arms(P, still * 0.9, [-0.62, 0.72, -0.02], [0.3, 0.7, 0.16]);
      P.fL = [0.1 * sag * (1 - tip), 0.04 * tip, 0];
      P.fR = [-0.06 * sag * (1 - tip), 0.1 * E.bump((s - 0.6) / 0.4), 0];
    },
  },
  // THE CHOPPER: three rounds one after another, each one jerking it, going back all the while; down on the back
  stitched: {
    dur: 0.9, face: -1,
    pose(P, s, K) {
      const front = Math.cos(K.from ?? 0) >= 0;
      const j = knock(s, 0.02, 0.05) + knock(s - 0.11, 0.02, 0.05) + knock(s - 0.22, 0.02, 0.06);
      const tip = ramp(s, 0.1, 0.62, E.in);
      const land = E.bump((s - 0.6) / 0.22);
      const still = ramp(s, 0.66, 1.0, E.s);
      away(P, s, K, front, 0.3);
      P.rx = LIE * tip + 0.06 * land;
      P.mz = -0.35 * ramp(s, 0, 0.6, E.out);
      P.ty += 0.3 * j * (Math.floor(s / 0.11) % 2 ? -1 : 1);
      P.tx += -0.16 * j;
      P.hx += -0.3 * j + 0.3 * ramp(s, 0.2, 0.5, E.s) * (1 - still);
      arms(P, ramp(s, 0.02, 0.2, E.out) * (1 - still), [-0.5, 0.95, 0.3], [0.5, 0.9, 0.34]);
      arms(P, still * 0.9, [-0.66, 0.74, -0.03], [0.62, 0.78, -0.02]);
      P.fL = [0, 0.1 * land, 0];
      P.fR = [0, 0.14 * land, 0];
    },
  },
  // THE DOORMAN: taken off the feet. Folded round it, carried back through the air a metre and more, down on the back
  // and still sliding
  blown: {
    dur: 0.95, face: -1,
    pose(P, s, K) {
      const front = Math.cos(K.from ?? 0) >= 0;
      const k = knock(s, 0.04, 0.16);
      const fly = ramp(s, 0, 0.42, E.out);
      const tip = ramp(s, 0.05, 0.44, E.s);
      const land = E.bump((s - 0.4) / 0.2);
      const slide = ramp(s, 0.4, 0.85, E.out);
      const still = ramp(s, 0.6, 1.0, E.s);
      away(P, s, K, front, 0.12);
      P.rx = LIE * tip + 0.08 * land;
      P.my = 0.2 * E.bump(s / 0.42) + 0.02 * land;
      P.mz = -(1.0 * fly + 0.35 * slide) * (K.w ?? 1);
      P.tx += 0.55 * k * (1 - still);
      P.hx += 0.45 * k - 0.2 * land;
      arms(P, k, [-0.3, 0.7, 0.42], [0.3, 0.7, 0.42]);
      arms(P, still * 0.9, [-0.7, 0.78, -0.02], [0.66, 0.74, -0.03]);
      P.fL = [0.12 * fly * (1 - still), 0.22 * E.bump(s / 0.5) + 0.03 * still, 0];
      P.fR = [0.2 * fly * (1 - still), 0.3 * E.bump(s / 0.55), 0];
    },
  },
  // THE LONG-EYE: switched off. The head goes first, the body turns a quarter with it and falls like a plank; one
  // bounce, and nothing after
  dropped: {
    dur: 0.7, face: -1,
    pose(P, s, K) {
      const front = Math.cos(K.from ?? 0) >= 0;
      const side = Math.sin(K.from ?? 0) >= 0 ? 1 : -1;
      const tip = ramp(s, 0.03, 0.4, E.in);
      const land = E.bump((s - 0.38) / 0.2);
      const still = ramp(s, 0.45, 0.8, E.s);
      away(P, s, K, front, 0.1);
      P.ry += -side * 0.7 * ramp(s, 0, 0.36, E.out);
      P.rx = LIE * tip + 0.07 * land;
      P.my = 0.02 * land;
      P.hx += -0.6 * knock(s, 0.03, 0.2) + 0.2 * land;
      P.hy += -side * 0.5 * knock(s, 0.03, 0.3);
      arms(P, ramp(s, 0.05, 0.25, E.out) * (1 - still), [-0.4, 0.5, 0.1], [0.44, 0.52, 0.1]);
      arms(P, still * 0.9, [-0.6, 0.7, -0.03], [0.62, 0.72, -0.03]);
      P.fL = [0, 0.1 * land, 0];
      P.fR = [0, 0.07 * land, 0];
    },
  },
  // MID-RUN, by anything: the legs stop and the rest does not. Pitched forward over them, the arms out too late, down
  // on the front and sliding on with what speed it had
  running: {
    dur: 0.8, face: 1,
    pose(P, s, K) {
      const v = clamp(K.v ?? 3, 1.5, 5);
      const tip = ramp(s, 0.02, 0.4, E.in);
      const land = E.bump((s - 0.38) / 0.2);
      const slide = ramp(s, 0, 0.75, E.out);
      const still = ramp(s, 0.5, 0.9, E.s);
      // (FLAT at the end, and sprawled: from the game's camera a body pitched 70 degrees over with its head away
      // was a body standing; seen 2026-11-19, a heavy shot walking in. Down on its front, rolled a little onto one
      // shoulder, the face turned to the side, one arm flung up past the head and the other out, one knee out)
      P.rx = PRONE * tip - 0.06 * land + (FLAT - PRONE) * still;
      P.rz = 0.32 * still;
      P.pz = RIG.toe;
      P.mz = v * 0.3 * slide;
      P.my = -0.02 * tip;
      P.tx += 0.3 * ramp(s, 0, 0.2, E.out) * (1 - still) - 0.14 * still;
      P.hx += -0.4 * ramp(s, 0.1, 0.4, E.s);
      P.hy += 1.15 * still;
      arms(P, ramp(s, 0.08, 0.34, E.out), [-0.36, 0.98, 0.34], [0.34, 1.02, 0.36]);
      arms(P, still * 0.85, [-0.64, 0.74, 0.02], [0.28, 1.2, 0.26]);
      P.fL = [-0.14 * tip, 0.2 * E.bump((s - 0.1) / 0.5) + 0.02, -0.5 * tip];
      P.fR = [-0.3 * tip + 0.26 * still, 0.34 * E.bump((s - 0.05) / 0.55) + 0.02, -0.6 * tip + 0.22 * still];
    },
  },
};
/** Which fall for a body killed by `gun` while going at `v` m/s. */
export const dropFor = (gun, v) => (v > 2 ? 'running' : gun === 'doorman' ? 'blown' : gun === 'longeye' ? 'dropped' : gun === 'chopper' ? 'stitched' : 'crumple');

/**
 * NOBODY STANDS IN ANYBODY (gunner.js apart): `at`, a Map of id → [x, y] (m, the fight's own ground), is changed in
 * place so that no two of `live` ([{ id, side }], standing) are nearer than `keep.foe` (one of theirs and one of
 * yours) or `keep.same` (two on one side). `you` is never moved; an ally gives way only to you; two of theirs share
 * it. `angleOf(a, b)`: the line two on one spot part along, the same every frame. → the ids that were moved.
 */
export function keepApart(live, at, keep, angleOf = () => 0) {
  const moved = new Set();
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const [a, b] = [live[i], live[j]];
      const [pa, pb] = [at.get(a.id), at.get(b.id)];
      const need = a.side === b.side ? keep.same : keep.foe;
      let [dx, dy] = [pb[0] - pa[0], pb[1] - pa[1]];
      let d = Math.hypot(dx, dy);
      if (d >= need) continue;
      if (d < 1e-3) {
        const ang = angleOf(a.id, b.id);
        [dx, dy, d] = [Math.cos(ang) * 1e-3, Math.sin(ang) * 1e-3, 1e-3];
      }
      const push = need - d;
      const wb = a.side === 'you' ? 1 : b.side === 'you' ? 0 : 0.5;
      const [ux, uy] = [dx / d, dy / d];
      pa[0] -= ux * push * (1 - wb);
      pa[1] -= uy * push * (1 - wb);
      pb[0] += ux * push * wb;
      pb[1] += uy * push * wb;
      if (wb < 1) moved.add(a.id);
      if (wb > 0) moved.add(b.id);
    }
  }
  return moved;
}
