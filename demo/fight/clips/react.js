// THE FIGHT'S HIT CLIPS: taking a hit that hurts, and a hit the stab vest takes. WALKING OVERLAYS (moving, speed 0):
// one who is hit while walking keeps their legs. The look slot's bearing (gun.js) is where the hit came from: the
// body rocks away from it. The two are made to read apart from the game's camera, where the big head is most of what
// shows: hurt, the head SNAPS BACK and turns away, the arms fly up; the vest, the head goes DOWN to the chest and both
// hands come to it, the body barely moves.
//
//   fight_flinch   0.42 s: the hit 0–0.05 s (the head snapped back and away, the chest knocked back, the arms up,
//                  the whole body rocked away about the feet) · back by 0.42
//   fight_vest     0.36 s: the thud 0–0.06 s (a short push back, no snap) · the head down to the chest, both hands
//                  slapped to the vest 0.04–0.2 · back by 0.36
//   (going down is the city's own: fall_back → lie_hurt, death_collapse → lie_still; anim.js)
export const CLIPS = [
  {
    name: 'fight_flinch', dur: 0.42, moving: true, speed: 0, stride: 1, blendIn: 0.02, blendOut: 0.15,
    note: 'hit, and it hurts (a walking overlay): the head snapped back and away from the blow, the chest knocked back, the arms flung up, the whole body rocked away about the feet 0–0.05 s · back by 0.42',
    glsl: /* glsl */`
  float a = fBear(), sd = a < 0. ? -1. : 1.;
  float h = cOut(t, 0., .05) * (1. - cS(t, .1, .42));
  P.torso = mix(P.torso, vec3(-.24, -sd * .4 * (1. - abs(cos(a))) - .15 * sd, .1 * sd), h);
  P.head.x = mix(P.head.x, -.55, h);
  P.head.y = mix(P.head.y, -sd * .35, h);
  cArms(P, vec4(.7, .55, -.15, .2), 1.3, h * .85);
  // (knocked back a step's worth, away from the blow: the head is what the game's camera sees move)
  cRot.x -= .3 * h * cos(a); cRot.z += .14 * h * sin(a);
  cMov.x -= .18 * h * sin(a); cMov.z -= .18 * h * cos(a);`,
  },
  {
    name: 'fight_vest', dur: 0.36, moving: true, speed: 0, stride: 1, blendIn: 0.02, blendOut: 0.15,
    note: 'hit, and the stab vest takes it (a walking overlay): a short push back, no snap 0–0.06 s · the head down to the chest and both hands slapped to the vest 0.04–0.2 s · back by 0.36',
    glsl: /* glsl */`
  float a = fBear();
  float h = cOut(t, 0., .06) * (1. - cS(t, .16, .36));
  float hand = cOut(t, .03, .12) * (1. - cS(t, .2, .36));
  P.torso = mix(P.torso, vec3(-.07, 0., 0.), h);
  P.head.x = mix(P.head.x, .5, hand);
  P.head.y = mix(P.head.y, 0., hand);
  cArms(P, vec4(.75, -.05, .55, .35), 1.75, hand);
  cRot.x -= .09 * h * cos(a);`,
  },
];
