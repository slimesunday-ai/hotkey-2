// THE FIGHT'S OWN CLIPS, IN THE CAST'S CLIP FORMAT (anim/cast/clips/CLIPS.md: a name, a duration, a GLSL body), PLAYED
// BY THE CAST'S OWN WALKERS. The cast's registry (city/from-trunk/…/clips/index.js) is the pinned city's and is never
// edited; this file adds the fight's clips to it on the page, after the city has built its walkers:
//   · the CPU half: each clip is added to the registry's CLIPS and CLIP (the ids after the cast's own), so the cast's
//     playClip / stepClip / clipOf and the stage's actors play them like any of its own;
//   · the GPU half: the near walkers' material and its depth pass (peds.js nearMat, the shadow) get the clips'
//     functions and the dispatcher's cases, through the material's own onBeforeCompile (as installAnim2 itself does),
//     with their own program key, recompiled once.
// ONE THING THE REGISTRY CANNOT BE TOLD: the end of a one-shot is read off a table built when its module loaded
// (index.js END), so it never ends one of these by itself. The page ends them (anim.js): it knows each clip's length.
//
// The clips (each file says what they do, in words, and the lab shows them: demo/?mode=fightlab):
//   gun.js     fight_gun (ready / aimed, a loop), fight_fire (the kick of one shot)
//   melee.js   fight_hook (a blow, wind-up and follow-through), fight_stab (a short thrust)
//   react.js   fight_flinch (hit, and it hurts), fight_vest (hit, the vest takes it)
// and the cast's own, reused as they are: fall_back → lie_hurt, death_collapse → lie_still (going down), run_getaway.
import { CLIPS as GUN, GUN_GLSL } from './gun.js';
import { CLIPS as MELEE, MELEE_GLSL, CONTACT } from './melee.js';
import { CLIPS as REACT } from './react.js';

export { CONTACT };
export const FIGHT_CLIPS = [...GUN, ...MELEE, ...REACT];
/** The cast's clips the fight plays as they are. */
export const CAST_CLIPS = ['fall_back', 'lie_hurt', 'death_collapse', 'lie_still', 'run_getaway'];
/** The cast's defaults for an entry (its index.js DEF). */
const DEF = { loop: false, hold: false, next: null, blendIn: 0.1, blendOut: 0.25, moving: false, speed: 0, stride: 1, shift: null, pair: null, note: '' };
const f = v => (+v).toFixed(4);
const KEY = `fight-clips-${FIGHT_CLIPS.map(c => `${c.name}:${c.dur}`).join(',').length}`;

/** The GLSL the shader gets: the fight's helpers, one function per clip (the cast's own form), and the dispatcher's cases. */
export function fightGlsl(base) {
  const fns = FIGHT_CLIPS.map(c => `void clip_${c.name}(inout Pose P, float t, float u, float w) {   // fight: ${c.name} (${c.dur} s${c.loop ? ' loop' : ''})\n  const float D = ${f(c.dur)};\n${c.glsl}\n}`).join('\n');
  // (a one-shot's clock runs on past its end, unclamped, as the cast's: the page ends it)
  const cases = FIGHT_CLIPS.map((c, k) => `case ${base + k}: clip_${c.name}(Q, ${c.loop ? `mod(max(t, 0.), ${f(c.dur)})` : 'max(t, 0.)'}, u, w); break;`).join('\n  ');
  return { fns: `${GUN_GLSL}\n${MELEE_GLSL}\n${fns}\n`, cases };
}

/**
 * Adds the fight's clips to the cast's registry and to the walkers' shader. `CLIPS` is the cast's registry module (the
 * stage's actors.CLIPS), `mats` the materials that run the walk (the near batch's and its depth pass). Safe to call
 * twice. → the names added.
 */
export function installClips({ CLIPS, mats }) {
  if (CLIPS.CLIP.fight_gun) return FIGHT_CLIPS.map(c => c.name);
  const base = CLIPS.CLIPS.length;
  FIGHT_CLIPS.forEach((c, k) => {
    const e = { ...DEF, ...c, group: 'fight', family: 'events', id: base + k };
    CLIPS.CLIPS.push(e);
    CLIPS.CLIP[c.name] = e;
  });
  const { fns, cases } = fightGlsl(base);
  const count = base + FIGHT_CLIPS.length;
  for (const m of mats.filter(Boolean)) {
    if (m.userData?.fightClips) continue;
    const prev = m.onBeforeCompile;
    const key = m.customProgramCacheKey?.bind(m);
    m.onBeforeCompile = (sh, r) => {
      prev?.call(m, sh, r);
      const before = sh.vertexShader;
      sh.vertexShader = sh.vertexShader
        .replace('void clipPose(', `${fns}void clipPose(`)
        .replace(/c >= \d+ \|\| W < \.001/, `c >= ${count} || W < .001`)
        .replace('switch (c) {', `switch (c) {\n  ${cases}`);
      if (sh.vertexShader === before || !sh.vertexShader.includes(`case ${base}:`)) console.warn('[fight] the walkers\' shader did not take the fight\'s clips');
    };
    m.customProgramCacheKey = () => `${key ? key() : ''}|${KEY}`;
    m.userData = { ...(m.userData ?? {}), fightClips: true };
    m.needsUpdate = true;
  }
  return FIGHT_CLIPS.map(c => c.name);
}
