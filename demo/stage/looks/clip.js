// A LOOK'S BODY, POSED BY HAND FROM THE PAGE (looks-1): one clip, `look_body`, played by any walker under a look, a
// named person of ours or a stranger of the city's crowd, whose GLSL reads the whole pose (the fight's rig, rig.js:
// chest, head, arms, elbows, feet, pelvis, root) from a row of a small float texture the page writes every frame. The
// row is the walker's own (its gait state's `g.look`, as the fight you steer does it: puppet/clip.js POSE_CLIP), so any
// number of bodies share the one clip and each dances, sleeps or doubles over in its own time.
//
// It is the fight's hand-posed clip with a texture of its own, so a fight and a look never take each other's rows. It
// is added to the cast's registry and to the walkers' shader the way the fight's clips are (fight/clips/index.js): the
// near batch's material and its shadow pass, through the material's own onBeforeCompile, ONCE, when the page loads.
//
//   installLookClip({ CLIPS, mats, THREE })   → the clip's name
//   takeRow() → n | null · freeRow(n) · writeRow(n, pose)   (rig.js packPose; ROWS rows)
import { TEXELS, packPose } from '../../fight/puppet/rig.js';

export const LOOK_CLIP = 'look_body';
/** Rows: 12 named people under a look and 24 strangers dressed in one (the plan's budget), and room to spare. */
export const ROWS = 48;

const GLSL = /* glsl */`
uniform highp sampler2D uLookPose;
void lookBody(inout Pose P) {
  int n = int(cLook + .5);
  vec4 a = texelFetch(uLookPose, ivec2(0, n), 0), b = texelFetch(uLookPose, ivec2(1, n), 0), c = texelFetch(uLookPose, ivec2(2, n), 0), d = texelFetch(uLookPose, ivec2(3, n), 0);
  vec4 e = texelFetch(uLookPose, ivec2(4, n), 0), f = texelFetch(uLookPose, ivec2(5, n), 0), g = texelFetch(uLookPose, ivec2(6, n), 0);
  vec4 h = texelFetch(uLookPose, ivec2(7, n), 0), i = texelFetch(uLookPose, ivec2(8, n), 0), j = texelFetch(uLookPose, ivec2(9, n), 0);
  cFoot(P, 0, a.x, a.y, a.z); cFoot(P, 1, a.w, b.x, b.y);
  P.drop = b.z; P.bodyX = b.w; P.pRoll = c.x; P.torso = c.yzw; P.head = d.xyz;
  cArm(P, 0, e, g.x, 1.); cArm(P, 1, f, g.y, 1.);
  cRot = h.xyz; cPiv = i.xyz; cMov = j.xyz;
}`;

const ENTRY = {
  name: LOOK_CLIP, dur: 3600, loop: true, hold: false, next: null, blendIn: 0.12, blendOut: 0.25, moving: false, speed: 0, stride: 1, shift: null, pair: null,
  note: 'a drug look on a body (demo/stage/looks/): the whole pose from the page every frame, from the walker\'s own row (g.look)',
  glsl: '  lookBody(P);',
};

let tex = null;
let data = null;
const used = new Set();
function uniform(THREE) {
  if (!tex) {
    data = new Float32Array(TEXELS * ROWS * 4);
    tex = new THREE.DataTexture(data, TEXELS, ROWS, THREE.RGBAFormat, THREE.FloatType);
    tex.needsUpdate = true;
  }
  return { value: tex };
}
export function takeRow() {
  for (let n = 0; n < ROWS; n++) {
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
  }
  return null;
}
export function freeRow(n) {
  used.delete(n);
}
export function writeRow(n, pose) {
  if (!data) return;
  packPose(pose, data, n * TEXELS * 4);
  tex.needsUpdate = true;
}

/** Adds `look_body` to the cast's registry and to the walkers' shader (near batch and its shadow). Safe to call twice. */
export function installLookClip({ CLIPS, mats, THREE }) {
  if (CLIPS.CLIP[LOOK_CLIP]) return LOOK_CLIP;
  const id = CLIPS.CLIPS.length;
  const e = { ...ENTRY, group: 'looks', family: 'events', id };
  CLIPS.CLIPS.push(e);
  CLIPS.CLIP[LOOK_CLIP] = e;
  const fn = `void clip_${LOOK_CLIP}(inout Pose P, float t, float u, float w) {   // looks: the whole body from the page\n  const float D = 3600.;\n${ENTRY.glsl}\n}\n`;
  const count = id + 1;
  for (const m of mats.filter(Boolean)) {
    if (m.userData?.lookClip) continue;
    const prev = m.onBeforeCompile;
    const key = m.customProgramCacheKey?.bind(m);
    m.onBeforeCompile = (sh, r) => {
      prev?.call(m, sh, r);
      sh.uniforms.uLookPose = uniform(THREE);
      const before = sh.vertexShader;
      // (the count of clips the dispatcher takes is the larger of what is there and this one's: the fight's clips may
      // be added before or after this, and each sets it to its own last id + 1)
      sh.vertexShader = sh.vertexShader
        .replace('void clipPose(', `${GLSL}\n${fn}void clipPose(`)
        .replace(/c >= (\d+) \|\| W < \.001/, (all, n) => `c >= ${Math.max(Number(n), count)} || W < .001`)
        .replace('switch (c) {', `switch (c) {\n  case ${id}: clip_${LOOK_CLIP}(Q, mod(max(t, 0.), 3600.), u, w); break;`);
      if (sh.vertexShader === before || !sh.vertexShader.includes(`case ${id}:`)) console.warn('[looks] the walkers\' shader did not take the look clip');
    };
    m.customProgramCacheKey = () => `${key ? key() : ''}|looks-clip-${id}`;
    m.userData = { ...(m.userData ?? {}), lookClip: true };
    m.needsUpdate = true;
  }
  return LOOK_CLIP;
}
