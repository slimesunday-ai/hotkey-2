// A BODY POSED BY HAND FROM THE PAGE, EVERY FRAME (anim-1): the fighter's "clip". The cast's clips are each a fixed
// piece of GLSL, a function of one clock; a fight is two people answering each other, a blow thrown at where the other
// IS, a stagger that starts from whatever pose the blow found, feet planted on the ground while the body turns over
// them. None of that is one clock's function. So the fight has ONE clip per body, `fight_body_<n>`, whose GLSL reads
// the whole pose (rig.js: chest, head, arms, elbows, feet, pelvis, root) from a small float texture the page writes
// each frame, and the motion itself is made on the page (fighter.js, moves.js), where it can see both bodies.
// The clip is the cast's own format (a name, a duration, a GLSL body; clips/index.js adds it to the registry and the
// walkers' shader with the fight's others); it loops, never ends by itself, and blends in from and out to the
// walker's own stand like any clip of the city's.
//
//   SLOTS            how many bodies at once (a one-on-one two, getting jumped three; the rest to spare)
//   puppetClips()    the registry entries, `fight_body_a` …
//   PUPPET_GLSL      the helper the entries call
//   puppetUniform(THREE)   { value: the texture } for the walkers' material (one for the page)
//   takeSlot() → n | null · freeSlot(n) · writeSlot(n, pose)   (rig.js packPose)
import { TEXELS, packPose } from './rig.js';

export const SLOTS = 12;
/**
 * (anim-1, the fight you steer: gunner.js) ONE CLIP FOR EVERY BODY OF IT, laid over the walk: the body's row of the
 * texture is its own look slot (the walker's number, g.look), so any number of bodies share the clip. The row's last
 * number says how much of the body is the pose's: 1 the chest, the head and the arms (the legs are the walk's: a
 * steered body walks where the keys take it), 0 all of it (a body that has been dropped: its fall is the page's).
 */
export const ROWS = 60;
export const POSE_CLIP = 'fight_pose';
/** (letters, not numbers: the fight's clips are named in words, test/fight-moves.test.mjs) */
export const clipName = n => `fight_body_${'abcdefghijkl'[n]}`;

export const PUPPET_GLSL = /* glsl */`
uniform highp sampler2D uFight;
// the fight's body n: its whole pose from the page (demo/fight/puppet/rig.js packPose), feet by the clips' own cFoot
void fBody(inout Pose P, int n) {
  vec4 a = texelFetch(uFight, ivec2(0, n), 0), b = texelFetch(uFight, ivec2(1, n), 0), c = texelFetch(uFight, ivec2(2, n), 0), d = texelFetch(uFight, ivec2(3, n), 0);
  vec4 e = texelFetch(uFight, ivec2(4, n), 0), f = texelFetch(uFight, ivec2(5, n), 0), g = texelFetch(uFight, ivec2(6, n), 0);
  vec4 h = texelFetch(uFight, ivec2(7, n), 0), i = texelFetch(uFight, ivec2(8, n), 0), j = texelFetch(uFight, ivec2(9, n), 0);
  cFoot(P, 0, a.x, a.y, a.z); cFoot(P, 1, a.w, b.x, b.y);
  P.drop = b.z; P.bodyX = b.w; P.pRoll = c.x; P.torso = c.yzw; P.head = d.xyz;
  cArm(P, 0, e, g.x, 1.); cArm(P, 1, f, g.y, 1.);
  cRot = h.xyz; cPiv = i.xyz; cMov = j.xyz;
}
void fPose(inout Pose P) {
  int n = int(cLook + .5);
  vec4 j = texelFetch(uFight, ivec2(9, n), 0);
  if (j.w < .5) { fBody(P, n); return; }
  vec4 b = texelFetch(uFight, ivec2(1, n), 0), c = texelFetch(uFight, ivec2(2, n), 0), d = texelFetch(uFight, ivec2(3, n), 0);
  vec4 e = texelFetch(uFight, ivec2(4, n), 0), f = texelFetch(uFight, ivec2(5, n), 0), g = texelFetch(uFight, ivec2(6, n), 0);
  P.drop += b.z; P.torso = c.yzw; P.head = d.xyz;
  cArm(P, 0, e, g.x, 1.); cArm(P, 1, f, g.y, 1.);
}`;

export function puppetClips() {
  return Array.from({ length: SLOTS }, (_, n) => ({
    name: clipName(n), dur: 3600, loop: true, blendIn: 0.1, blendOut: 0.22, puppet: true,
    note: `the fight's body ${n}: posed by hand from the page every frame (demo/fight/puppet/)`,
    glsl: `  fBody(P, ${n});`,
  }));
}
/** The steered fight's one clip: a walking overlay (the legs are the walk's) whose pose is the body's row. */
export function poseClip() {
  return {
    name: POSE_CLIP, dur: 3600, loop: true, moving: true, speed: 0, stride: 1, blendIn: 0.12, blendOut: 0.2,
    note: 'a walking overlay loop: the chest, the head and the arms posed by hand from the page every frame (demo/fight/puppet/gunner.js: the gun held, raised, fired, reloaded; a blow; a round taken), the legs the walk\'s; a body that is dropped is posed whole',
    glsl: '  fPose(P);',
  };
}

let tex = null;
let data = null;
const used = new Set();
/** The uniform for the walkers' material: one texture for the page, ten texels a body. */
export function puppetUniform(THREE) {
  if (!tex) {
    data = new Float32Array(TEXELS * ROWS * 4);
    tex = new THREE.DataTexture(data, TEXELS, ROWS, THREE.RGBAFormat, THREE.FloatType);
    tex.needsUpdate = true;
  }
  return { value: tex };
}
export function takeSlot() {
  for (let n = 0; n < SLOTS; n++) {
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
  }
  return null;
}
export function freeSlot(n) {
  used.delete(n);
}
export function writeSlot(n, pose) {
  if (!data) return;
  packPose(pose, data, n * TEXELS * 4);
  tex.needsUpdate = true;
}

// ── the steered fight's rows (after the lettered bodies' own) ──
const rows = new Set();
export function takeRow() {
  for (let n = SLOTS; n < ROWS; n++) {
    if (!rows.has(n)) {
      rows.add(n);
      return n;
    }
  }
  return ROWS - 1;
}
export function freeRows() {
  rows.clear();
}
/** A pose to a row: `upper` 1 the chest, the head and the arms only (the legs the walk's), 0 the whole body. */
export function writeRow(n, pose, upper = 1) {
  if (!data) return;
  const o = n * TEXELS * 4;
  packPose(pose, data, o);
  data[o + 39] = upper;
  tex.needsUpdate = true;
}
