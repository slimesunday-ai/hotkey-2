// THE FIGHT'S CLOSE-UP CLIPS: a blow with a clear wind-up and a follow-through, and a short stab. WALKING OVERLAYS
// (moving, speed 0): the chest, the head and the +x arm, and the whole body leaning into the blow about its feet; the
// legs are the walk's, so one who swings while stepping keeps stepping. The blow goes where the look slot says
// (gun.js: its bearing; anim.js points it at whoever they hit), the chest turning to it as far as it can.
//
// CONTACT is the moment the blow lands in the clip (s): anim.js starts the clip that long before the tick the rules
// apply the damage, so the hit you see and the hit the rules count are the same frame.
//
//   fight_hook   0.5 s, contact 0.2: the arm cocked back and out, the chest coiled away (0–0.14) · whipped round and
//                through them as the chest unwinds and the body lunges in a quarter metre (0.14–0.22, the hit at 0.2) · across the body
//                (follow-through, to 0.34) · back to the walk by 0.5. Fists, brass knuckles, bare hands, the box
//                cutter and the tire iron
//   fight_stab   0.34 s, contact 0.12: the fist drawn back to the hip (0–0.08) · thrust straight at them, the body
//                behind it (0.08–0.14, the hit at 0.12) · pulled back (to 0.34). The shiv
export const CONTACT = Object.freeze({ fight_hook: 0.2, fight_stab: 0.12 });

export const MELEE_GLSL = /* glsl */`
// the bearing the blow goes to, as the chest and the arm reach it (the gun side's way round when it is far behind)
float fBlowBear() { float a = fBear(); return clamp(a < -2.4 ? a + 6.2832 : a, -1.6, 2.4); }`;

export const CLIPS = [
  {
    name: 'fight_hook', dur: 0.5, moving: true, speed: 0, stride: 1, blendIn: 0.04, blendOut: 0.15,
    note: 'a blow, a walking overlay (the legs are the walk\'s): the +x arm cocked back and out, the chest coiled away 0–0.14 s · whipped round through them as the chest unwinds and the body leans in 0.14–0.22 (the hit at 0.2) · across the body 0.22–0.34 · back to the walk by 0.5',
    glsl: /* glsl */`
  float a = fBlowBear(), tw = clamp(a, -1.1, 1.1);
  float wu = cS(t, 0., .14), st = cS(t, .14, .22), fo = cS(t, .2, .34), rc = cS(t, .34, .5);
  float k = cOut(t, 0., .05) * (1. - rc);
  // the chest: coiled away (+.7) → round past them (−.45) → back
  float ty = tw + .7 * wu * (1. - st) - .45 * st * (1. - rc) * fo - .2 * st * (1. - fo);
  P.torso = mix(P.torso, vec3(.08 * wu + .14 * st * (1. - fo) + .06 * fo, ty, -.08 * wu + .06 * st), k);
  P.head.y = mix(P.head.y, clamp(a - ty, -1.1, 1.1), k);
  P.head.x = mix(P.head.x, .06 * st, k);
  // the arm: cocked (back, out, the elbow bent up) → out straight at them → across the body
  vec4 cock = vec4(-.55, 1.25, -.2, .2), hit = vec4(1.45, .3, -.15, .1), across = vec4(1.25, -.05, .95, .1);
  vec4 arm = mix(mix(cock, hit, st), across, fo);
  float el = mix(mix(1.35, .25, st), .6, fo);
  cArm(P, 1, arm, el, k);
  // the free arm comes up as a guard, then swings back as the blow goes through
  cArm(P, 0, vec4(.55 - .45 * st, .2, .25, .3), 1.1, k * .8);
  // the whole body lunges into it, toward them, and leans (from the game's camera the big head is most of what
  // shows: it is the head that has to travel)
  float ln = .28 * cBump(t, .1, .36), lu = .24 * cBump(t, .1, .38);
  cRot.x += ln * cos(a); cRot.z -= ln * .6 * sin(a);
  cMov.x += lu * sin(a); cMov.z += lu * cos(a);`,
  },
  {
    name: 'fight_stab', dur: 0.34, moving: true, speed: 0, stride: 1, blendIn: 0.03, blendOut: 0.12,
    note: 'a stab, a walking overlay: the +x fist drawn back to the hip 0–0.08 s, the chest turned away · thrust straight at them with the body behind it 0.08–0.14 (the hit at 0.12) · held a beat and pulled back by 0.34',
    glsl: /* glsl */`
  float a = fBlowBear(), tw = clamp(a, -1.1, 1.1);
  float wu = cS(t, 0., .08), th = cOut(t, .08, .13), rc = cS(t, .18, .34);
  float k = cOut(t, 0., .04) * (1. - rc);
  float ty = tw + .35 * wu * (1. - th) - .3 * th;
  P.torso = mix(P.torso, vec3(.05 * wu + .16 * th, ty, 0.), k);
  P.head.y = mix(P.head.y, clamp(a - ty, -1.1, 1.1), k);
  vec4 back = vec4(-.5, .35, 0., .3), fwd = vec4(1.5, .12, -.3, .1);
  cArm(P, 1, mix(back, fwd, th), mix(1.6, .08, th), k);
  cArm(P, 0, vec4(.5, .2, .3, .3), 1.2, k * .7);
  float ln = .24 * cBump(t, .06, .26), lu = .22 * cBump(t, .06, .28);
  cRot.x += ln * cos(a); cRot.z -= ln * .6 * sin(a);
  cMov.x += lu * sin(a); cMov.z += lu * cos(a);`,
  },
];
