// ANIM LAB · idles: short loops a standing walker blends into, all in the vertex shader (walk.js composes them into the pose).
// Per walker (the animation texture, walk.js ROWS): the variant, the idle weight (blends in when a walker stops, out when it moves),
// its own idle clock (a random start, so nobody is in step) and a look direction (the crossing's signal, relative to the body).
// Variants (IDLE ids):
//   0 weight shift          the hips drift from leg to leg, the free knee softens, the head tilts against it
//   1 look around           the head turns left, holds, turns right, holds; the shoulders follow a little
//   2 check phone           the whole right arm comes up forward, the phone under the face, the head drops to it; now and then a glance up
//   3 pockets + foot tap    hands at the pockets, the right toe taps in bursts (heel planted)
//   4 hands behind the back (was arms crossed: a one-piece arm can't fold) both arms back and in, palms turned back, chest out, slow looks
//   5 stretch / neck roll   a slow neck roll, later both arms up and out in a V on tiptoe, then down
//   6 nod to music          the head nods on the beat, the knees bounce, the shoulders sway at half time
//   7 hands on hips         straight arms angled out from the hips (akimbo, without elbows)
// SIMPLE ARMS (2026-09-30): the arm is one piece from the shoulder (no elbow). Its pose is four angles per side (Pose armP · armR · ayaw ·
// atw: pitch forward, roll out, yaw in across the body, twist in about its own length; aArmRot), and every idle keeps each arm clear
// of the chest and the head (the big head is wider than the shoulders: a raised arm stays under the chin or outside the ears).
//   8 waiting at a crossing weight shift + a glance at the light every few seconds (+ now and then an impatient lean); K3-IDLES: a walker
//                           with its own seed waits in its own style instead (IDLE_WAIT, seeded), the glance at the light over it
// K3-IDLES (2026-11-19) · eight more, made for the game's camera (24 m up, 64° down, the person ~70 px: the big head covers nearly all of
// the body, so what reads is the head's turn and tilt, the body's lean and turn, and an arm only where it goes out past the head):
//   9 phone call            the +x arm up and out beside the head (the hand at the jaw's side: a straight arm can't reach the ear past
//                           the big head), the other arm hanging; small nods talking; pacing in place: the body turns slowly
//  10 look up               the face tips up at the buildings (the camera sees it), the body leans back, a slow scan along the tops
//  11 wave                  the +x arm comes up out to the side and waves, the head lifts toward whoever it is; then down, a wait
//  12 check the watch       the +x arm up in front, the wrist turned up, the head bows to it; then a look down the street
//  13 shrug                 the weight on one hip; now and then both arms flick out, palms up, the head tips
//  14 yawn + side stretch   the head tips back, the +x arm goes up and over as the body bends away
//  15 cold                  hunched, the arms pulled in to the belly, stamping from foot to foot in bursts
//  16 talk with the hands   the +x hand up and out moving with the words, the other now and then; nods; the body turns a little
// PER PERSON (K3-IDLES): the same idle never looks the same on two people. Each walker's seed (0–999: stepIdle takes it from the idle
// clock's random start, which pedsim.js draws from the walker's id) gives it its own tempo (× 0.82–1.18), size of movement (× 0.75–1.2:
// body and head; the arms half that, never past the authored pose) and side (half the people mirror every idle; one-armed idles move
// to the free arm of a walker holding something). It rides the idle slot of the animation texture as a fraction (walk2.js writeGait2:
// idle + .05 + seed / 2500; the shader rounds the id as before), so no new texel, attribute or uniform. No seed (−1): today's idles.
// Every idle breathes (the chest and shoulders rise, hardening pass: visibly) and keeps the feet planted: the legs are solved by the walk's IK from the pose's
// ankles, so a hip that sways or drops bends the knees instead of sliding the feet.
// K3-IDLES · THE ELBOW ROUND (2026-11-19). slime on the clip of 9–16: "The one at 1:30 is broken, let's drop that one, agree on the other
// weak ones. And yeah why aren't we using the elbow … it will make them more realistic and yes we need turning to talk". Out of the pool:
// 9 phone call (a straight arm can't reach the ear), 11 wave, 13 shrug, 16 talk with the hands (their code stays for the ids, unpicked).
// The arm has an elbow (the cast's, 2026-10-08: Pose.elb, + brings the forearm forward in the arm's own plane, the twist atw turns which
// way it folds; elbow/ELBOW.md in ai-city-fresh). The bent idles (aIdMore, aIdArm sets an arm as clips' cArm does, elbow and all):
//  12 check the watch      (rewritten) the forearm up in front at the chest, the wrist toward the face, the head bows to it; a look down
//                          the street
//  15 cold                 (rewritten) hunched, the hands deep in the pockets, stamping in bursts, a shiver
//  17 phone to the ear     the elbow out and down, the hand at the ear, the free arm eased; small nods, the body turns slowly
//  18 talking (a pair)     two people standing face to face (pedsim.js turns them): the one talking moves both forearms with the words,
//                          the one listening nods and tilts the head, arms easy; the look slot carries who talks (1) and who listens (0),
//                          eased by pedsim.js, so they swap smoothly
//  19 check phone          (the elbow version of 2) the upper arm at the side, the forearm up, the phone out in front, the head bowed
//  20 hands in pockets     (of 3) the elbows bent and a little out, the hands at the front pockets; the toe taps in bursts
//  21 hands behind the back (of 4) the upper arms back, the forearms in behind, the hands at the small of the back
//  22 hands on hips        (of 7) akimbo: the elbows out, the hands on the hips
//  23 stretch / neck roll  (of 5) the neck roll as 5; the stretch's arms up and out in a V, a little bent, clear of the big head (5's
//                          straight arms passed through its sides: 173 crossings on two looks in idlecheck.mjs elbow)
// Every arm pose here was searched on the city's own body (idlebody.js fit) for its hand and elbow targets with nothing passing through
// the body, and is checked through each loop on the looks the crowd wears (idlecheck.mjs elbow). Not made: ARMS CROSSED and arms wrapped
// against the cold. The forearm is as thick as the chest is deep in front of the shoulder line (0.2 m; a puffer's 0.3): every fold across
// the front put the forearm through the shirt (the search, given the hands at the middle of the chest, kept them apart instead).
// The crowd plays 19–23 instead of 2, 3, 4, 7 and 5 (whose straight-arm code stays as it was, for the cast's other walkers: anim/cast/idle.js
// IDLE_POOL, the subway's riders and the mainland's). The lab draws no elbow (walk.js / walk2.js carry Pose.elb and ignore it): the city's
// body is idlebody.html.
export const IDLE = { shift: 0, look: 1, phone: 2, pockets: 3, crossed: 4, stretch: 5, music: 6, hips: 7, crossing: 8,
  call: 9, up: 10, wave: 11, watch: 12, shrug: 13, yawn: 14, cold: 15, talk: 16,
  ear: 17, chat: 18, phone2: 19, pockets2: 20, back2: 21, hips2: 22, stretch2: 23 };
export const IDLE_MORE_NAMES = ['phone call', 'look up', 'wave', 'check the watch', 'shrug', 'yawn + side stretch', 'cold', 'talk with the hands',
  'phone to the ear', 'talking (a pair)', 'check phone (elbow)', 'hands in pockets', 'hands behind the back (elbow)', 'hands on hips (elbow)', 'stretch (elbow)'];
export const IDLE_NAMES = ['weight shift', 'look around', 'check phone', 'pockets + foot tap', 'hands behind the back', 'stretch / neck roll', 'nod to music', 'hands on hips', 'waiting at a crossing', ...IDLE_MORE_NAMES];
export const IDLE_POOL = [0, 1, 19, 20, 21, 23, 6, 22, 10, 12, 14, 15, 17];   // what a walker picks from when it stops (8 is the crossing's own; 18 is a pair's: pedsim.js)
// the crossing's waiting styles (a seeded walker's own, under the glance at the light): idles that leave the head free to glance
export const IDLE_WAIT = [0, 19, 20, 21, 6, 22, 12, 15];
// a seed's traits, the shader's own hash (aIdH) in JS: for labels and boards
const idH = (n, k) => { let x = (Math.imul(n, 0x9E3779B1) + Math.imul(k, 0x85EBCA77)) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x2C1B3C6D) >>> 0; x ^= x >>> 12; x = Math.imul(x, 0x297A2D39) >>> 0; x ^= x >>> 15; return (x >>> 8) / 16777216; };
export const idleTraits = n => n < 0 ? { tempo: 1, size: 1, mirror: false, wait: 8 } : { tempo: .82 + .36 * idH(n, 1), size: .75 + .45 * idH(n, 2), mirror: idH(n, 3) < .5, wait: IDLE_WAIT[Math.floor(idH(n, 4) * IDLE_WAIT.length)] };
// the seed in the idle slot (walk2.js writeGait2): idle + .05 + seed / 2500 (below .45: the shader's rounding of the id is unchanged)
export const idleSlot = g => g.idle + (g.idle >= 0 && g.idle < 32 && g.iseed >= 0 ? .05 + g.iseed / 2500 : 0);
// GLSL, shared by this file's idlePose and the cast's (anim/cast/idle.js): the seed's traits, the new idles, the per-person variation.
// Needs Pose, aKeys, aWin, aShift, aFootRoll and aGrip before it. aIdN: the walker's seed, set by walk2.js before idlePose
export const IDLE_VARY_GLSL = /* glsl */`
int aIdN = -1;
float aIdH(int k) { uint x = uint(aIdN) * 0x9E3779B1u + uint(k) * 0x85EBCA77u; x ^= x >> 15u; x *= 0x2C1B3C6Du; x ^= x >> 12u; x *= 0x297A2D39u; x ^= x >> 15u; return float(x >> 8u) * (1. / 16777216.); }
float aIdTempo() { return aIdN < 0 ? 1. : .82 + .36 * aIdH(1); }
const int AID_WAIT[${IDLE_WAIT.length}] = int[${IDLE_WAIT.length}](${IDLE_WAIT.join(', ')});
// the idle to play: v, or at a crossing a seeded walker's own waiting style (a busy hand never takes the hand to the face). A holder's
// check phone (19) is 2's: the phone in its hand (grip.js: the raised hold bows the head to it; a low hold, the head bows a little).
// A raised hold (4: fit/held.js HOLD.raised, a cup at the face) nods instead of the stretches, 14 and 23, as grip.js does for 5: the free
// arm going up met the head (idlecheck.mjs elbow, the crowd's two coffee holders)
int aIdSub(int v) { if (aGrip > 0 && v == 19) return 2; if (aGrip == 4 && (v == 14 || v == 23)) return 6; if (v != 8 || aIdN < 0) return v; int s = AID_WAIT[min(int(aIdH(4) * ${IDLE_WAIT.length}.), ${IDLE_WAIT.length - 1})]; return aGrip > 0 && (s == 2 || s == 19) ? 0 : s; }
// one arm (side 0: the −x arm, 1: the +x) to [pitch, roll, yaw in, twist in] and the elbow, by k: a pose, not an offset (clips/index.js
// cArm's form, elbow and all). The bent idles set their arms this way: contact poses (a hand at the ear, on the hip, on the other arm)
void aIdArm(inout Pose Q, int side, vec4 a, float e, float k) {
  if (side == 0) { Q.armP.x = mix(Q.armP.x, a.x, k); Q.armR.x = mix(Q.armR.x, a.y, k); Q.ayaw.x = mix(Q.ayaw.x, a.z, k); Q.atw.x = mix(Q.atw.x, a.w, k); Q.elb.x = mix(Q.elb.x, e, k); }
  else { Q.armP.y = mix(Q.armP.y, a.x, k); Q.armR.y = mix(Q.armR.y, a.y, k); Q.ayaw.y = mix(Q.ayaw.y, a.z, k); Q.atw.y = mix(Q.atw.y, a.w, k); Q.elb.y = mix(Q.elb.y, e, k); } }
// the bent idles' arm poses [pitch, roll, yaw in, twist in] + elbow, each searched on the city's own body (idlebody.js fit: the NPC look and
// two of THE RUN's, a thin top and a puffer) to its hand and elbow targets with no triangle through the body: easy (a free arm, a little
// bent), a hand in the front pocket, talking low and high
const vec4 AID_EASY = vec4(0., .1, .12, -.1), AID_POCKET = vec4(-.34, .48, -.3, .57), AID_TALK0 = vec4(.16, .3, 0., .2), AID_TALK1 = vec4(.18, .48, .16, -.25);
const float AID_EASY_E = .04, AID_POCKET_E = 1.17, AID_TALK0_E = .9, AID_TALK1_E = 1.52;
// the head's slow drift of the breath (idlePose), taken back by an idle whose hand is at the head
float aIdDrift(float t) { return .07 * sin(6.2832 * t / 7.3 + 1.) + .03 * sin(6.2832 * t / 3.1); }
// the new idles (the one-armed ones on the +x arm: aIdVary mirrors them per person, and onto the free arm of a holder). look: the look
// slot (18: who talks, 1, and who listens, 0)
void aIdMore(inout Pose Q, int v, float t, float look) {
  float br = sin(6.2832 * t / 3.6);
  if (v == 9) { aShift(Q, t, .45);
    float turn = aKeys(t, 14., vec4(0., .32, .05, -.28)), talk = aWin(fract(t / 5.) * 5., .6, 3.4, .4);
    Q.torso.y += turn; Q.head.y += .3 * turn; Q.head.x += .04 + .035 * sin(6.2832 * 1.3 * t) * talk;
    // (the phone arm out and up beside the head: 13° over level, the hand 15 cm outside the head, clear of its lower corner; the free
    // arm hangs and swings a little against the turn. A hand on the hip, idle 7's, measured 20 % more parts meeting: left out)
    Q.armR.y += 1.78; Q.armP.y += .22; Q.atw.y += .5; Q.armP.x -= .15 * turn; }
  else if (v == 10) { aShift(Q, t + 2., .3);
    float T = fract(t / 15.) * 15., up = aWin(T, .5, 10.5, 1.4), sc = sin(6.2832 * (T - .5) / 10.);
    Q.head.x -= .3 * up; Q.torso.x -= .07 * up; Q.head.y += .3 * sc * up; Q.torso.y += .12 * sc * up;
    // (the elbow round: the arms easy at the sides. They were turned in about their length, .5: about the shoulder, at the arm's inner
    // edge, that swung the hands into the thighs and the hips, idlecheck.mjs elbow: 46 of the crowd's 48 looks)
    aIdArm(Q, 1, AID_EASY, AID_EASY_E, 1.); aIdArm(Q, 0, AID_EASY, AID_EASY_E, 1.); }
  else if (v == 11) { aShift(Q, t, .4);
    float T = fract(t / 8.) * 8., a = aWin(T, .2, 3.6, .55), wv = sin(6.2832 * 1.7 * (T - .2)) * aWin(T, .7, 3.1, .3);
    // (the hand up past the head's side, 25° over level at the top of the wave: a straight arm higher meets the big head)
    Q.armR.y += (1.82 + .2 * wv) * a; Q.armP.y += .42 * a; Q.atw.y += .5 * a; Q.ayaw.y -= .28 * wv * a;
    Q.head.y += .22 * a; Q.head.x -= .1 * a; Q.torso.y += .12 * a; Q.torso.z -= .04 * a; }
  else if (v == 12) { aShift(Q, t, .4);
    float T = fract(t / 10.) * 10., a = aWin(T, .3, 3.6, 1.1), lk = aWin(T, 4.2, 8.2, 1.);
    // (ELBOW: the forearm up in front at the chest, the wrist toward the face, the head bowed to it; the free arm eases, a little bent.
    // Searched on the city's body (idlebody.js fit) clear of the shirt, the head and a puffer: a forearm across the chest's middle meets
    // the shirt on every look, so the watch is held out in front)
    aIdArm(Q, 1, vec4(.86 + .015 * br, .09, -.32, .58), .92, a); aIdArm(Q, 0, vec4(-.08, .28, -.5, .58), .32, 1.);
    Q.head.x += .12 * a; Q.head.y += .1 * a; Q.torso.y += .08 * a; Q.torso.x += .04 * a;
    // (the look down the street: the body turns, the head only a little: calm, and from up there the whole person turns)
    Q.head.y -= .12 * lk; Q.torso.y -= .3 * lk; }
  else if (v == 13) { aShift(Q, t, .55);
    float s = aWin(fract(t / 5.) * 5., 1.6, 3.3, .4);
    Q.armR += vec2(.85) * s; Q.armP += vec2(.42) * s; Q.atw -= vec2(.9) * s; Q.head.z += .2 * s; Q.head.x -= .07 * s; Q.torso.x -= .04 * s; Q.torso.z -= .05 * s; Q.drop -= .01 * s; }
  else if (v == 14) { float T = fract(t / 11.) * 11., a = aWin(T, .6, 5.2, 1.2), y = aWin(T, .2, 3.4, .9);
    aShift(Q, t, .35 * (1. - a));
    // (the elbow round: the +x arm up beside the head, the elbow a little bent; straight, it passed through the head's side on 46 of the
    // crowd's 48 looks: idlecheck.mjs elbow. Searched on the city's body, idlebody.js fit)
    aIdArm(Q, 1, vec4(.2, 1.48, 0., -1.54), .68, a); aIdArm(Q, 0, vec4(0., .18, .12, -.12), .04, a);
    // (a small side bend away from the raised arm, the top toward −x, and the head with it; the yawn tips it back a little. Bigger, and
    // with the hips shifted or the body leaning back, the pelvis turns off the legs and the waistband's joint slabs show: overlap-check)
    Q.torso.z += .06 * a; Q.head.z += .04 * a; Q.head.x -= .08 * y; }
  else if (v == 15) { aShift(Q, t, .25);
    // (ELBOW: hunched, the hands deep in the pockets (21's arms, the shoulders up), stamping from foot to foot in bursts, a shiver. Arms
    // wrapped round the body or hands rubbed together in front need a forearm across the chest: on this body it goes through the shirt)
    Q.torso.x += .1; Q.head.x += .08; Q.drop += .015;
    aIdArm(Q, 1, AID_POCKET, AID_POCKET_E, 1.); aIdArm(Q, 0, AID_POCKET, AID_POCKET_E, 1.);
    float st = aWin(fract(t / 4.) * 4., .2, 2.6, .3), ph = sin(6.2832 * 1.5 * t), sh = aWin(fract(t / 7.) * 7., 5.2, 6.2, .2) * sin(6.2832 * 7. * t);
    aFootRoll(Q, 0, -.26 * max(ph, 0.) * st); aFootRoll(Q, 1, -.26 * max(-ph, 0.) * st); Q.drop += .012 * abs(ph) * st; Q.bodyX += .012 * ph * st; Q.torso.z += .012 * sh; Q.head.z -= .015 * sh; }
  else if (v == 16) { aShift(Q, t, .5);
    float T = fract(t / 7.) * 7., a = aWin(T, .3, 5.4, .6), b = aWin(T, 1.6, 4.2, .5);
    float g1 = aKeys(t * 1.7, 4., vec4(0., 1., .3, .8)), g2 = aKeys(t * 1.3 + 1., 4., vec4(.7, 0., 1., .2));
    // (the hands go out past the head's sides: from up there an arm in front of the body is under the head)
    Q.armP.y += (.6 + .35 * g1) * a; Q.armR.y += (.5 + .45 * g2) * a; Q.atw.y -= .5 * a;
    Q.armP.x += (.45 + .3 * g2) * b; Q.armR.x += (.45 + .4 * g1) * b; Q.atw.x -= .4 * b;
    Q.head.x += .05 * sin(6.2832 * .9 * t) * a; Q.head.z += .07 * (g1 - .5) * a; Q.torso.y += .12 * (g2 - .5) * a; }
  else if (v == 17) { float sw = (aKeys(t, 8., vec4(1., .75, -1., -.8)) + .22 * sin(6.2832 * t / 5.3)) * .4;
    // (aShift's weight shift without its roll of the head toward the phone)
    Q.bodyX += .036 * sw; Q.pRoll += .095 * sw; Q.torso.z -= .045 * sw;
    float turn = aKeys(t, 13., vec4(0., .28, .05, -.22)), talk = aWin(fract(t / 5.) * 5., .6, 3.6, .4);
    // (the elbow out and down, the hand up at the ear, clear of the big head's side; the head keeps still on the neck (its breath's drift
    // taken back): the body turns, slowly, pacing in place, and the head nods a little as it talks; the free arm eases)
    aIdArm(Q, 1, vec4(.47, .97, -.16, -1.42), 1.31, 1.); aIdArm(Q, 0, vec4(-.14, .12, .32, -.08), .2, 1.);
    Q.head.y -= aIdDrift(t); Q.torso.y += turn; Q.head.x += .03 * sin(6.2832 * 1.2 * t) * talk; }
  else if (v == 18) { float r = clamp(look, 0., 1.), l = 1. - r;
    aShift(Q, t, .35 + .2 * l);
    // (talking: both forearms up in front, moving with the words, one then the other, between a low and a high pose searched clear of
    // the body; the head nods to its own words)
    float g1 = aKeys(t * 1.6, 4., vec4(0., 1., .35, .8)), g2 = aKeys(t * 1.25 + 1.3, 4., vec4(.6, 0., 1., .25));
    aIdArm(Q, 1, mix(AID_TALK0, AID_TALK1, g1), mix(AID_TALK0_E, AID_TALK1_E, g1), r); aIdArm(Q, 0, mix(AID_TALK0, AID_TALK1, g2), mix(AID_TALK0_E, AID_TALK1_E, g2), r);
    Q.head.x += (.04 * sin(6.2832 * 1.1 * t)) * r; Q.torso.y += .06 * (g1 - g2) * r;
    // (listening: arms easy, a slow nod now and then, the head tilted)
    float nod = aWin(fract(t / 4.5) * 4.5, 1.2, 2.6, .5) * sin(6.2832 * 1.4 * t);
    aIdArm(Q, 1, AID_EASY, AID_EASY_E, l); aIdArm(Q, 0, AID_EASY, AID_EASY_E, l);
    Q.head.x += (.05 * max(nod, 0.) + .03) * l; Q.head.z += .07 * l; }
  else if (v == 19) { aShift(Q, t, .3); float g = aKeys(t, 7., vec4(1., 1., 1., 0.));
    // (the upper arm at the side, the forearm up, the phone out in front of the chest; the head bowed to it, now and then a glance up)
    aIdArm(Q, 1, vec4(.54 + .01 * sin(t * 8.) * g, .01, -.16, .18), 1.2, 1.); aIdArm(Q, 0, AID_EASY, AID_EASY_E, 1.);
    Q.head.x += .14 * g; Q.head.y += .08 * g; }
  else if (v == 20) { aShift(Q, t, .25); Q.bodyX -= .018; Q.pRoll -= .04;
    // (the elbows bent and a little out, the hands at the front pockets; the toe taps in bursts)
    aIdArm(Q, 1, AID_POCKET + vec4(.015 * br, 0., 0., 0.), AID_POCKET_E, 1.); aIdArm(Q, 0, AID_POCKET + vec4(.015 * br, 0., 0., 0.), AID_POCKET_E, 1.);
    float burst = aWin(fract(t / 6.) * 6., .8, 4.2, .3), tap = pow(max(0., sin(6.2832 * 2.3 * t)), 2.) * burst;
    aFootRoll(Q, 1, .32 * tap); Q.head.x += .03 * tap; }
  else if (v == 21) { aShift(Q, t, .5);
    // (the upper arms back, the forearms in behind, the hands at the small of the back; chest out, slow looks)
    aIdArm(Q, 1, vec4(-1.27, .45, .28, .93), .92, 1.); aIdArm(Q, 0, vec4(-1.27, .45, .28, .93), .92, 1.);
    Q.torso.x -= .035; Q.head.y += .22 * aKeys(t + 2., 11., vec4(0., .8, 0., -.6)); }
  else if (v == 23) { float T = fract(t / 12.) * 12., e1 = aWin(T, .3, 4.6, .8), e2 = aWin(T, 5.6, 10.2, 1.1), w = 6.2832 / 2.2;
    aShift(Q, t, .3 * (1. - e2));
    // (5's neck roll; then the arms up and out in a V, the elbows a little bent, on tiptoe: searched clear of the head and the shoulders)
    Q.head.x += (.2 * sin(w * T) + .05) * e1; Q.head.z += .22 * cos(w * T) * e1;
    aIdArm(Q, 1, vec4(.43, 1.32, -.14, -1.18), .78, e2); aIdArm(Q, 0, vec4(.43, 1.32, -.14, -1.18), .78, e2); Q.torso.x -= .1 * e2; Q.head.x -= .08 * e2;
    Q.drop -= .06 * e2; aFootRoll(Q, 0, -.24 * e2); aFootRoll(Q, 1, -.24 * e2); }
  else if (v == 22) { aShift(Q, t, .6);
    // (akimbo: the elbows out to the sides, the hands on the hips)
    aIdArm(Q, 1, vec4(-.34 + .01 * br, 1.13, -.18, 1.36), 1.3, 1.); aIdArm(Q, 0, vec4(-.34 + .01 * br, 1.13, -.18, 1.36), 1.3, 1.);
    Q.head.z += .06 * sin(t * .7); }
}
// the person's own side and size of movement, on what the idle added to the pose (Q − P): mirrored left for right (half the seeded
// people; one-armed idles always, for a walker whose +x hand holds something), body and head scaled by size, the arms by half as much
// and never past the authored pose
// (the elbow round: the elbow is mirrored with the arms; an idle whose arms were searched clear of the body (10, 12, 14, 15 and
// 17–23) keeps its arms as authored, ka = 1, and only its body and head take the person's size)
void aIdVary(Pose P, inout Pose Q, int s) {
  bool one = s == 9 || s == 11 || s == 12 || s == 14 || s == 16 || s == 17 || s == 19, mir = s != 8 && (aGrip > 0 ? one : aIdN >= 0 && aIdH(3) < .5);
  if (aIdN < 0 && !mir) return;
  bool rest = s == 10 || s == 12 || s == 14 || s == 15 || s >= 17;
  float k = aIdN < 0 ? 1. : .75 + .45 * aIdH(2), ka = rest ? 1. : min(1., .5 + .5 * k);
  vec4 dA = Q.ank - P.ank; vec2 dF = Q.fp - P.fp, dP = Q.armP - P.armP, dR = Q.armR - P.armR, dY = Q.ayaw - P.ayaw, dW = Q.atw - P.atw, dE = Q.elb - P.elb;
  vec3 dT = Q.torso - P.torso, dH = Q.head - P.head; float dB = Q.bodyX - P.bodyX, dQ = Q.pRoll - P.pRoll;
  if (mir) { dA = dA.zwxy; dF = dF.yx; dP = dP.yx; dR = dR.yx; dY = dY.yx; dW = dW.yx; dE = dE.yx; dT.yz = -dT.yz; dH.yz = -dH.yz; dB = -dB; dQ = -dQ; }
  Q.ank = P.ank + k * dA; Q.fp = P.fp + k * dF; Q.drop = P.drop + k * (Q.drop - P.drop); Q.bodyX = P.bodyX + k * dB; Q.pRoll = P.pRoll + k * dQ;
  Q.torso = P.torso + k * dT; Q.head = P.head + k * dH; Q.armP = P.armP + ka * dP; Q.armR = P.armR + ka * dR; Q.ayaw = P.ayaw + ka * dY; Q.atw = P.atw + ka * dW; Q.elb = P.elb + ka * dE;
}
// a seeded walker's crossing wait, over its own style (after the variation: the light is where it is): idle 8's glance at the light
// every few seconds and, now and then, its impatient lean
void aIdGlance(inout Pose Q, float t, float look) {
  float g = aKeys(t, 5.5, vec4(0., 1., 1., 0.)), lk = clamp(look, -1.3, 1.3);
  Q.head.y += lk * .8 * g; Q.torso.y += lk * .2 * g; Q.head.x -= .05 * g; Q.torso.x += .03 * aWin(fract(t / 13.) * 13., 7., 10., .8);
  // (the elbow round: the arms ease out a little as the body turns to the light: carried round by the turn, the hands went into the
  // thighs on every look of the crowd's, idlecheck.mjs elbow)
  Q.armR += vec2(.07 * abs(lk) * g); }
`;

// the straight-arm idle poses [pitch fwd, roll out, yaw in, twist in] (rad), each checked clear of the chest and the head
// (phone: the phone holder's hold too, grip.js; back: pitch BACK, yaw OUT as written; hips: pitch back)
export const ARMPOSE = { phone: [1.5, 0, .3, 0], phoneHead: [.06, -.1], back: [.55, -.1, .3, 0], stretch: [.35, 1.6, 0, .6], hips: [.1, .4, 0, .3] };
const v4 = a => `vec4(${[0, 1, 2, 3].map(i => (+(a[i] ?? 0)).toFixed(4)).join(', ')})`;
// GLSL: needs walk.js's Pose, aFootRoll and A_PI (walk.js puts this after them)
export const IDLE_GLSL = /* glsl */`
const vec4 PH = ${v4(ARMPOSE.phone)}, BK = ${v4(ARMPOSE.back)}, ST = ${v4(ARMPOSE.stretch)}, HP = ${v4(ARMPOSE.hips)};
const vec2 PHH = vec2(${ARMPOSE.phoneHead.map(v => v.toFixed(4)).join(', ')});
int aGrip = 0;   // the held item's hold (grip.js; walk2.js sets it per vertex): check phone uses the actual phone
float aKeys(float t, float period, vec4 v) {   // four keys round a loop: hold 60 %, ease 40 % to the next
  float x = fract(t / period) * 4.; int i = int(x); float f = smoothstep(.6, 1., fract(x));
  float a = i == 0 ? v.x : i == 1 ? v.y : i == 2 ? v.z : v.w, b = i == 0 ? v.y : i == 1 ? v.z : i == 2 ? v.w : v.x; return mix(a, b, f); }
float aWin(float t, float a, float b, float e) { return smoothstep(a, a + e, t) * (1. - smoothstep(b - e, b, t)); }   // a soft window [a, b]
mat3 aArmRot(Pose P, float sx) { bool l = sx < 0.;   // the arm's rotation about its shoulder (walk v1 and v2)
  return aRY(-sx * (l ? P.ayaw.x : P.ayaw.y)) * aRZ(sx * (l ? P.armR.x : P.armR.y)) * aRX(-(l ? P.armP.x : P.armP.y)) * aRY(-sx * (l ? P.atw.x : P.atw.y)); }
void aShift(inout Pose P, float t, float k) {   // weight shift, k = how much (hardening pass: bigger, and the holds drift: it read as frozen)
  float s = (aKeys(t, 8., vec4(1., .75, -1., -.8)) + .22 * sin(6.2832 * t / 5.3)) * k;
  P.bodyX += .036 * s; P.pRoll += .095 * s; P.torso.z -= .045 * s; P.head.z += .055 * s;
  P.armR += vec2(.03, .03) + vec2(-.025, .025) * s; }
${IDLE_VARY_GLSL}
void idlePose(inout Pose P, int v0, float t, float W, float look) {
  if (W < .001) return;
  Pose Q = P;   // work on a copy, blend by W at the end
  // (K3-IDLES: the idle to play, the crossing's seeded waiting style; the walker's own tempo)
  int v = aIdSub(v0); t *= aIdTempo();
  // breathing (hardening pass: was 0.012 rad, invisible at street distance: a standing walker looked frozen): the chest rises and
  // settles every 3.6 s, the shoulders with it, the body dips a few mm on the out-breath; the head drifts slowly (a look that never
  // quite becomes one). Calm: nothing faster than the breath, nothing bigger than a hand's width
  float br = sin(6.2832 * t / 3.6);
  Q.torso.x += .03 * br; Q.head.x -= .012 * br; Q.armR += vec2(.03) * sin(6.2832 * t / 3.6 + .6); Q.drop += .005 * (.5 - .5 * br);
  Q.head.y += .07 * sin(6.2832 * t / 7.3 + 1.) + .03 * sin(6.2832 * t / 3.1); Q.head.x += .02 * sin(6.2832 * t / 5.1 + 2.);
  if (v == 0) { aShift(Q, t, 1.); Q.armP += vec2(.04, -.03) * sin(t * .9); }
  else if (v == 1) { aShift(Q, t + 3., .4); float y = aKeys(t, 9., vec4(0., .8, 0., -.75)); Q.head.y += y; Q.head.x -= .09 * abs(y); Q.torso.y += .22 * y; }
  else if (v == 2) { aShift(Q, t, .3); float g = aKeys(t, 7., vec4(1., 1., 1., 0.));   // (the whole arm up forward: the hand under the chin, the head bowed to it)
    Q.armP.y += PH.x + .03 * sin(t * 8.) * g; Q.armR.y += PH.y; Q.ayaw.y += PH.z; Q.atw.y += PH.w; Q.head.x += PHH.x * g; Q.head.y += PHH.y * g; Q.armP.x -= .04; }
  else if (v == 3) { aShift(Q, t, .25); Q.bodyX -= .018; Q.pRoll -= .04;
    Q.armP -= vec2(.1); Q.armR -= vec2(.02); Q.atw += vec2(.5);   // (straight arms, the hands turned in at the hip pockets)
    float burst = aWin(fract(t / 6.) * 6., .8, 4.2, .3), tap = pow(max(0., sin(6.2832 * 2.3 * t)), 2.) * burst;
    aFootRoll(Q, 1, .32 * tap); Q.head.x += .03 * tap; }
  else if (v == 4) { aShift(Q, t, .5); Q.armP -= BK.xx; Q.armR += BK.yy; Q.ayaw -= BK.zz; Q.atw += BK.ww;   // hands behind the back: back and in, palms back
    Q.torso.x -= .035; Q.head.y += .22 * aKeys(t + 2., 11., vec4(0., .8, 0., -.6)); }
  else if (v == 5) { float T = fract(t / 12.) * 12., e1 = aWin(T, .3, 4.6, .8), e2 = aWin(T, 5.6, 10.2, 1.1), w = 6.2832 / 2.2;
    aShift(Q, t, .3 * (1. - e2));
    Q.head.x += (.2 * sin(w * T) + .05) * e1; Q.head.z += .22 * cos(w * T) * e1;
    Q.armP += ST.xx * e2; Q.armR += ST.yy * e2; Q.atw += ST.ww * e2; Q.torso.x -= .1 * e2; Q.head.x -= .16 * e2;   // (a V overhead, out past the ears: straight up, the arms vanish inside the head)
    Q.drop -= .06 * e2; aFootRoll(Q, 0, -.24 * e2); aFootRoll(Q, 1, -.24 * e2); }
  else if (v == 6) { float f = 1.8, b = sin(6.2832 * f * t), h = sin(3.1416 * f * t);
    Q.head.x += .05 + .1 * pow(max(b, 0.), 1.5); Q.drop += .012 * (.5 + .5 * b); Q.torso.z += .045 * h; Q.head.z += .05 * h; Q.bodyX += .01 * h;
    Q.armP += vec2(.1, -.1) * h; Q.armR += vec2(.04); }
  else if (v == 7) { aShift(Q, t, .6); Q.armR += HP.yy; Q.armP -= HP.xx; Q.atw += HP.ww; Q.head.z += .06 * sin(t * .7); }   // (straight arms angled out, the palms turned back to the hips)
  else if (v == 8) { aShift(Q, t, .6); float g = aKeys(t, 5.5, vec4(0., 1., 1., 0.)), lk = clamp(look, -1.3, 1.3);
    Q.head.y += lk * .8 * g; Q.torso.y += lk * .2 * g; Q.head.x -= .05 * g; Q.torso.x += .03 * aWin(fract(t / 13.) * 13., 7., 10., .8); }
  else aIdMore(Q, v, t, look);
  aIdVary(P, Q, v); if (v0 == 8 && v != 8) aIdGlance(Q, t, look);
  P.ank = mix(P.ank, Q.ank, W); P.fp = mix(P.fp, Q.fp, W); P.drop = mix(P.drop, Q.drop, W); P.bodyX = mix(P.bodyX, Q.bodyX, W); P.pRoll = mix(P.pRoll, Q.pRoll, W);
  P.torso = mix(P.torso, Q.torso, W); P.head = mix(P.head, Q.head, W); P.armP = mix(P.armP, Q.armP, W); P.armR = mix(P.armR, Q.armR, W); P.ayaw = mix(P.ayaw, Q.ayaw, W); P.atw = mix(P.atw, Q.atw, W); P.elb = mix(P.elb, Q.elb, W);
}`;

// JS: a stopped walker's idle: which variant, when it blends in (after `delay` s standing), and its clock
export function stepIdle(g, standing, dt, pick) {
  // (K3-IDLES: the walker's own seed, once: from its idle clock's random start, pedsim.js's hash of its id; a clock that starts at 0: none)
  if (g.iseed === undefined) g.iseed = g.it > 0 ? Math.round(g.it * 25) % 1000 : -1;
  // (a stop that follows a moment's turn while the last idle still shows: the new one comes in through g.swap, never by a cut)
  if (standing) { if (!g.wasStill) { g.wasStill = true; if (pick) { const v = pick(); if (g.iw > .03 && v !== g.idle) g.swap = v; else g.idle = v; } } g.still += dt; } else { g.wasStill = false; g.still = 0; g.swap = undefined; }
  // (K3-IDLES, the elbow round: g.swap, a change of idle while standing (pedsim.js: a pair's talk begins or ends): the idle eases out over
  // a quarter second, the new one in as any idle does; nothing snaps)
  if (g.swap !== undefined && g.iw < .03) { g.idle = g.swap; g.swap = undefined; }
  const on = standing && g.still > .35 && g.idle >= 0 && g.swap === undefined;
  g.iw += ((on ? 1 : 0) - g.iw) * (1 - Math.exp(-dt / (on ? .5 : g.swap !== undefined ? .22 : .1)));
  g.it += dt;
}
