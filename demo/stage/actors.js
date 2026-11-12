// hotkey 2's people in the 3D city: the low-level pieces a director needs, and nothing of the city's old sim.
//
// An ACTOR is one walker of the city's own pedestrian system (pedsim.js), in its own baked look, that WE drive:
//   add()      a person standing at a point, in a look rolled from a seed (plus an outfit or chosen pieces)
//   walkTo()   along the sidewalks to a point, on the city's own lane geometry: off its standing spot by the spot's
//              entry on the lane, round the corners on their arcs, down the kerb and over the crossing, off the lane
//              to the new spot. It speeds up, brakes and steps round people. Resolves with the seconds and metres
//   stepTo()   a straight walk of a few metres, for staging (up to a partner, to a counter): same starts and stops
//   face() · turn() · turned()   turning on the spot: the city eases it, turned() waits for it
//   stand() · fitSpot() · routeOf() · hurry()   where a person's spot is, a map point made fit to stand on, a walk
//              laid out without walking it, a walker told that someone is waiting
//   play()     one of the city's 140 authored clips by name; pair() plays a two-person clip in sync
//   say()      a white speech bubble that follows the head (the proof's; the panels draw the game's own)
//   screenOf() where a head is on screen · pickAt() who is under a click · portrait() a head-and-shoulders picture
//   setSpeed() the time scale of everything above (0 pauses) · remove() takes the walker out
//   audit()    counts, every frame, what would look wrong (jumps, speed steps, heading snaps, floating …)
//
// HOW THEY MOVE is the "travel" section below: it says which pieces are the city's own, called from here, and
// which had to be written here and why.
//
// How it hooks in, without touching the copied city (city/API-NOTES.md has the long version):
//   · a walker is made with the pedestrian sim's own putAgent(), so the crowd walks round it and it is drawn in the
//     same batches as everyone else;
//   · we move it each frame from `peds.driver` (the hook the city gives its sim agents: it runs before the crowd);
//   · a clip is played from a wrapper round the sim's `animate` (the city's stage does the same): the clip lives on
//     the walker's gait state, which exists only while the walker is drawn on the NEAR tier. The city gives that
//     tier to walkers within 46 m of the camera, and to PRIORITY walkers at any distance while they are in view.
//     Our people are few, so they are all priority (`far`, on by default): they animate from the set camera too.
//
// Every city module is imported by the SAME url the city uses, so the cast, the clips and three are shared instances.

// the top of a head above the feet, in metres: where a name tag sits and where the panels hang a bubble
const HEAD = 2.3;
const STEP_SPEED = 1.2;
const PROP_SHOW = 0.6;

/**
 * FURNITURE: the clips that need something under, behind or round the body, by the city's own clip notes, and what:
 * `lean` a wall 0.2 m behind the spot's lean point · `sit` a ledge at its sit point · `bench` a bench seat (the spot
 * itself) · `room` indoors (a work bench, a floorboard, a bed: the pads, the pen, the tent). The city's stand spots
 * carry the point (simstate/stands.js); its life plays these loops only there (simstate/life.js). The audit counts
 * every frame one plays anywhere else: `unseated`.
 */
export const FURNITURE = Object.freeze({
  lean_wall: 'lean', sit_stoop: 'sit', sit_bench: 'bench',
  cook_stir: 'room', cook_pour: 'room', cook_check: 'room', cook_fan: 'room', bench_assemble: 'room', bench_file: 'room', bench_fit: 'room', bench_test_gun: 'room',
  floorboard_lift: 'room', floorboard_rummage: 'room', floorboard_close: 'room', sleep: 'room',
});
/** Clips a body is down, seated or held still in. Nobody ever travels in one: a walk clears it first. */
const LOW = new Set(['lie_hurt', 'lie_still', 'fall_back', 'shove_fall', 'shot_hit', 'shot_hit_dead', 'death_collapse', 'sleep', 'sit_stoop', 'sit_bench', 'cuffed_idle', 'get_up', 'cower']);

const sleepFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

export async function createActors({ city, CITY }) {
  const THREE = city.THREE;
  const peds = city.peds;
  if (!peds) throw new Error('actors: this page has no pedestrians (?peds=0)');
  const sim = peds.sim;
  const [CH, LOOKS, CLIPS, STYLE, PLAN, PEDSIM, TURN, MOVEMENT, CROWD, GROUNDS, CITYLIFE] = await Promise.all([
    import(`${CITY}cast.js`),
    import(`${CITY}simstate/looks.js`),
    import(`${CITY}anim/cast/clips/index.js`),
    import(`${CITY}style.js`),
    import(`${CITY}plan.js`),
    import(`${CITY}pedsim.js`),
    import(`${CITY}anim/turn.js`),
    import(`${CITY}simstate/movement.js`),
    import(`${CITY}stage/crowd.js`),
    import(`${CITY}ground.js`),
    // (the city's "nobody is a statue" plan for a standing person: only its figures and names are read here, for
    // the director, which follows its rules: demo/stage/director.js "routines")
    import(`${CITY}simstate/life.js`),
  ]);
  while (!peds.ready) await sleepFrame();
  const GROUND = STYLE.SIDE;
  // THE CITY'S OWN MOVEMENT, CALLED, NOT COPIED. Its figures: PED (a walker's acceleration and body), ARC (the corner
  // arc and the turn rate), NODE (a corner node's place), MOVE (how a mover of its own brakes behind and steps round
  // people).
  // `movement` is the module the city walks its booked trips with; we use its geometry alone: geomOf(path) lays a path
  // of sidewalk points on the walkers' lanes in either direction (corner arcs, joins, the road's height on a
  // crossing) and at(G, d) reads a point of it. Its trip runner (run) wants booked minutes, cabs and the subway and is
  // never started here, so its traffic fleet is never made: moving traffic stays off.
  const { PED, ARC, NODE } = PEDSIM;
  const MOVE = MOVEMENT.MOVE;
  const movement = MOVEMENT.createMovement({ peds });

  const actors = new Map();
  const waits = new Set();
  const hooks = new Set();
  let clock = 0;
  // the time scale: 1 is life, 2 and 4 hurry everything (walks, clips, waits), 0 holds it all still
  let scale = 1;

  /** Resolves on the first frame `test()` is true. Every wait runs off the city's own frame, so it works under tick(). */
  const until = test => new Promise(resolve => {
    const wait = { test, resolve };
    waits.add(wait);
  });
  const seconds = s => {
    const end = clock + s;
    return until(() => clock >= end);
  };

  // ── looks ───────────────────────────────────────────────────────────────────────────────────────────────────────
  // A look is the cast's spec: { skin, eyes, mouth, mark: 'id', hair, hat, top, bottom, shoes, eyewear, ears, acc,
  // held: { id } }. rollLook(seed) gives the same person for the same seed; `wear` lays chosen pieces over it;
  // `outfit` is one of the cast's named uniforms (officer, county …). Baking takes 5 to 20 ms, once per look.
  const hashOf = text => {
    let h = 2166136261;
    for (let k = 0; k < text.length; k++) h = Math.imul(h ^ text.charCodeAt(k), 16777619);
    return h >>> 0;
  };
  function lookOf({ seed, pool = 'agent', outfit = null, wear = null }) {
    const look = CH.rollLook(typeof seed === 'number' ? seed : hashOf(String(seed)) & 0xffffff, { pool });
    if (outfit) CH.wear(look, CH.OUTFITS[outfit]);
    if (wear) CH.wear(look, wear);
    return look;
  }
  function bakeLook(spec) {
    const look = lookOf(spec);
    const index = peds.addLook(LOOKS.bake(CH, look));
    if (index < 0) throw new Error('actors: the walker batches refused a look');
    return { index, look };
  }

  // ── the gait hook: clips ────────────────────────────────────────────────────────────────────────────────────────
  // Runs for a walker on the near tier, right after the city worked out its walk and idle for this frame.
  const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  const M = new THREE.Matrix4();
  const PM = new THREE.Matrix4();
  const QY = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);
  const V = new THREE.Vector3();
  const ONE = new THREE.Vector3(1, 1, 1);

  // A clip may carry a prop (a work tool, the pistol, the cook's set). Two shapes exist in the city's clips:
  // one mesh (`geometry` + `matrix`), or several parts posed apart (`partGeometry` + `partMatrices`: the cook set,
  // the bike). Both are in the walker's body frame, so the world matrix is the walker's times the prop's.
  function propMesh(A, key, makeGeometry) {
    let mesh = A.props.get(key);
    if (!mesh) {
      mesh = new THREE.Mesh(makeGeometry(), propMat);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.name = `hk2:prop:${key}`;
      city.scene.add(mesh);
      A.props.set(key, mesh);
    }
    return mesh;
  }
  function drawProp(A, g) {
    const state = g.clip;
    const prop = state?.c.prop;
    const shown = prop && state.w >= PROP_SHOW && (prop.geometry || prop.partGeometry);
    for (const mesh of A.props.values()) mesh.visible = false;
    if (!shown) return;
    const w = A.w;
    QY.setFromAxisAngle(UP, w.yawS ?? w.p[3]);
    V.set(w.p[0], w.p[1], w.p[2]);
    M.compose(V, QY, ONE);
    if (prop.partMatrices && prop.partGeometry) {
      A.parts = prop.partMatrices(THREE, state.t, A.parts?.id === prop.id ? A.parts : null);
      A.parts.id = prop.id;
      for (const [part, local] of A.parts) {
        const mesh = propMesh(A, `${prop.item ?? prop.id}:${part}`, () => prop.partGeometry(THREE, part));
        mesh.matrix.multiplyMatrices(M, local);
        mesh.visible = true;
      }
      return;
    }
    const mesh = propMesh(A, prop.id, () => prop.geometry(THREE));
    mesh.matrix.multiplyMatrices(M, prop.matrix(THREE, state.t, PM, g));
    mesh.visible = true;
  }

  // THE CITY'S SEAM AND QUEUE, FOR EVERY CLIP SWITCH OF OURS (stage/index.js applyPose: A.seam, A.next, leadsTo).
  // The registry's playClip has ONE slot, and a clip started over another takes its weight: two unrelated poses swapped
  // in the middle of a play snap. So a request (A.want) is never played the frame it is made. In this order:
  //   · nothing is on the body: it starts, and blends in from the walker's own stand or walk (the clip's blendIn);
  //   · the clip on the body is the one asked for: it plays on (a routine asked for twice is not started twice);
  //   · the clip on the body chains into it by itself (the registry's `next`: aim_draw → aim_hold, fall_back →
  //     lie_hurt): the chain is left to get there;
  //   · a DECLARED SEAM joins the two (SEAMS below: the pairs the city's clips are authored to meet at): the switch
  //     is made on the frame the playing clip's clock crosses the seam, the new clip started at the old clock mod P,
  //     exactly as applyPose does it. The request waits meanwhile, through the chain that leads to the seam's clip
  //     too (get_up asked for during fall_back waits for lie_hurt's wrap);
  //   · anything else: the playing clip blends OUT to the walker's own stand or walk (stopClip, its own blendOut),
  //     and the next starts once its weight is under SWITCH_AT. Never a cut.
  // The audit counts every switch that breaks this (`pops`), wherever it is made from: notePop() is the one door.
  /** A clip blending out may be replaced once its weight is under this (the audit's line for a pop is 0.2). */
  const SWITCH_AT = 0.08;
  /**
   * The declared seams (anim/cast/clips/CLIPS.md, stage/vignettes.js): `P` the playing clip's clock must cross a
   * multiple of (s; 0: any frame, the two are one pose family), `after` at least that long into it.
   *   lie_hurt → get_up      at lie_hurt's 2 s wrap: get_up starts on lie_hurt's first pose (vignettes.js getUp)
   *   aim_hold → aim_fire / aim_lower   at its 0.8 s seams: its pose there is their first (vignettes.js shotScene)
   *   cuffed_idle ↔ cuffed_walk → get_in_car   CUFFED is a state: "switched with playClip straight, never a
   *                          stopClip between" (vignettes.js STAGE-B, arrest.js): the arms are locked in all three
   */
  const SEAMS = [
    { from: 'lie_hurt', to: 'get_up', P: 2 },
    { from: 'aim_hold', to: 'aim_fire', P: 0.8 },
    { from: 'aim_hold', to: 'aim_lower', P: 0.8 },
    ...[['cuffed_idle', 'cuffed_walk'], ['cuffed_walk', 'cuffed_idle'], ['cuffed_idle', 'get_in_car'], ['cuffed_walk', 'get_in_car']].map(([from, to]) => ({ from, to, P: 0 })),
  ];
  /** Does a clip chain into another by itself (the city's `next` links: stage/index.js leadsTo)? */
  const leadsTo = (c, name) => {
    for (let k = 0; c && k < 6; k++, c = c.next ? CLIPS.CLIP[c.next] : null) if (c.name === name) return true;
    return false;
  };
  /** The declared seam from the clip `c` (or the clip its chain ends in) to the clip called `to`, or null. */
  const seamFor = (c, to) => SEAMS.find(q => q.to === to && leadsTo(c, q.from)) ?? null;
  /**
   * THE AUDIT'S POPS: a clip that is on the body (weight over 0.2) replaced at once by a clip it does not chain to,
   * off any declared seam (`seam`: the caller has checked this very frame is one). `to` null: dropped at once for no
   * clip at all, counted apart as `drops`. A body the city is not drawing (off screen: its clips do not run) is not
   * counted. EVERY playClip and clearClip of this file goes through here first.
   */
  function notePop(A, g, to, seam = false) {
    const s = g?.clip;
    if (!audit || seam || !s || !(s.w > 0.2) || s.name === to || (to && leadsTo(s.c, to)) || !A.drawn) return;
    audit[to ? 'pops' : 'drops'] += 1;
    const kind = to ? 'pop' : 'drop';
    audit.kinds[kind] = (audit.kinds[kind] ?? 0) + 1;
    if (audit.kinds[kind] <= 14) audit.examples.push(`${kind} ${A.id} ${s.name} (weight ${s.w.toFixed(2)}${s.out ? ', going out' : ''}, ${s.t.toFixed(2)} s in) → ${to ?? 'nothing'}`);
  }
  /** Starts the wanted clip in the slot (the slot is empty, nearly blended out, or on a seam the caller checked). */
  function startClip(A, g, W, t, seam = false) {
    notePop(A, g, W.name, seam);
    CLIPS.playClip(g, W.name, { t, loop: W.loop });
    A.asked = W;
    W.began = clock;
  }
  /** Brings the clip slot towards what is wanted (see above). Called every frame the body is drawn in full. */
  function reconcile(A, g) {
    const W = A.want;
    if (W === A.asked) return;
    const s = g.clip;
    if (!W) {
      if (s && !s.out) CLIPS.stopClip(g);
      A.asked = W;
      return;
    }
    // (NOBODY SLIDES: a clip that stands, sits or lies is not started on a body still on its way. It waits for the
    // stop; the clip a walk is made in, a limp, says so itself: W.walk)
    if (A.route && !W.walk && !CLIPS.CLIP[W.name].moving) {
      if (s && !s.out && s.name !== W.name) CLIPS.stopClip(g);
      return;
    }
    if (!s) return startClip(A, g, W, W.t ?? 0);
    if (!s.out && s.name === W.name) {
      if (W.loop !== undefined) s.loop = W.loop;
      A.asked = W;
      W.began = clock;
      return;
    }
    if (!s.out && leadsTo(s.c, W.name)) return;
    const seam = s.out ? null : seamFor(s.c, W.name);
    // (a seam at any frame: one pose family, switched straight, the weight kept)
    if (seam && !seam.P && s.name === seam.from) return startClip(A, g, W, W.t ?? 0, true);
    // (a seam on the clock: taken in pose(), after this frame's step, on the frame the clock crosses it)
    if (seam) return;
    if (!s.out) CLIPS.stopClip(g);
    if (s.w <= SWITCH_AT) startClip(A, g, W, W.t ?? 0);
  }

  /**
   * A body that comes back into view gets a NEW gait state from the city (pedsim.js animate, `fresh`), and the clip
   * it was in is gone with the old one. What it was left in is put back at full weight on that first frame, before
   * anyone has seen it without: the loop its clip chains into (someone left lying hurt lies, not stands), or the last
   * pose of a one-shot that holds. A plain one-shot is over.
   */
  function resume(A, g) {
    const W = A.asked;
    if (!W || W !== A.want || g.clip) return;
    let tail = CLIPS.CLIP[W.name];
    for (let n = 0; tail.next && CLIPS.CLIP[tail.next] && n < 6; n++) tail = CLIPS.CLIP[tail.next];
    const loops = tail.name === W.name ? W.loop ?? tail.loop : tail.loop;
    if (!loops && !tail.hold) {
      A.want = A.asked = null;
      return;
    }
    CLIPS.playClip(g, tail.name, { t: loops ? W.t ?? 0 : tail.dur, loop: loops, snap: true });
  }

  function pose(A, g, dt) {
    A.nearAt = performance.now();
    if (g !== A.gait) {
      A.gait = g;
      resume(A, g);
    }
    reconcile(A, g);
    if (!g.clip) {
      A.clipName = null;
      A.clipW = 0;
      // (asked for and gone: a one-shot that ran out while nobody was drawing it)
      if (A.want && A.asked === A.want) A.want = A.asked = null;
      drawProp(A, g);
      return;
    }
    // a standing clip poses the legs itself: the walk under it is switched off
    if (!g.clip.c.moving) g.w = 0;
    const [n0, t0] = [g.clip.name, g.clip.t];
    const state = CLIPS.stepClip(g, dt * scale * A.rate);
    if (state?.shiftNow) {
      // a clip that ends somewhere else (a lunge, a stumble back): the walker moves there on this very frame
      const yaw = A.w.yawS ?? A.w.p[3];
      const [sx, sz] = state.shiftNow;
      const dx = sx * Math.cos(yaw) + sz * Math.sin(yaw);
      const dz = -sx * Math.sin(yaw) + sz * Math.cos(yaw);
      A.x += dx;
      A.z += dz;
      A.w.p[0] += dx;
      A.w.p[2] += dz;
      if (A.w.gx !== undefined) {
        A.w.gx += dx;
        A.w.gz += dz;
      }
      A.w.fix = [A.x, A.y, A.z, A.ry];
      // (a walker on its way is placed by its route every frame: the route takes the step with it, or the body
      // would be back where it was a frame later)
      if (A.route) {
        A.route.ox += dx;
        A.route.oz += dz;
      }
      // (a stumble back off a kerb lands on the road: the step is one frame, and so is the drop)
      if (!A.room && !A.route) A.y = groundAt(A.x, A.z);
      // (the shader takes the same step off the body on this frame: nothing moves on screen)
      A.shifted = true;
    }
    // ON THE SEAM (applyPose): the wanted clip from the playing one's own pose, on the frame its clock crosses a
    // multiple of P, started at that clock mod P
    const W = A.want;
    const s = g.clip;
    if (W && W !== A.asked && s && !s.out) {
      const seam = seamFor(s.c, W.name);
      if (seam?.P && s.name === seam.from && s.t >= (W.after ?? 0) && Math.floor(s.t / seam.P) > Math.floor((n0 === seam.from ? t0 : -1e-6) / seam.P)) {
        startClip(A, g, W, s.t % seam.P, true);
        CLIPS.stepClip(g, 0);
      }
    }
    A.clipName = g.clip ? g.clip.name : null;
    A.clipT = g.clip ? g.clip.t : 0;
    A.clipW = g.clip ? g.clip.w : 0;
    // (a one-shot that has run out by itself is OVER for whoever waits for it, play(), though it is still blending
    // out: what is asked for next starts as that blend ends, with no bare stand between the two)
    if (g.clip?.out && A.want && A.asked === A.want) A.want.ended = true;
    // (a one-shot that has run out is nobody's request any more: play() reads this as its end. One still WAITING
    // for its turn, behind a clip blending out, is kept)
    if (!g.clip && A.asked === A.want) {
      A.want = null;
      A.asked = null;
    }
    drawProp(A, g);
  }

  const animate0 = sim.animate;
  sim.animate = (w, dt, G, fresh) => {
    const g = animate0(w, dt, G, fresh);
    if (g && w.hk2) pose(w.hk2, g, dt);
    return g;
  };

  // ── travel: the city's lanes under our people ───────────────────────────────────────────────────────────────────
  // A ROUTE is what a walker of ours follows: a stretch of the city's own lane geometry (movement.geomOf) with a
  // straight step on to it and off it at the ends (a standing spot's step to its entry point on the lane), or one
  // straight step by itself (staging: up to a partner, a few metres along a wall). Every frame the walker
  //   · speeds up at the city's walkers' own rate (PED.acc) and brakes (MOVE.lag.brake) for the end of its route, for
  //     a corner it would otherwise take faster than a body turns (ARC.turnRate), and for the first body it would
  //     walk into, read off the city's body map (sim.near: everyone standing or walking, ours and the crowd's);
  //   · steps sideways round whoever it cannot pass on its line, inside the sidewalk's clear strip (sim.roomSpan);
  //   · stands on the ground the city's walkers stand on: the road's surface on a crossing, the kerb at its edge.
  // Its heading is only ever a TARGET here (w.fix[3]): the city's own face(w) eases the drawn heading towards it,
  // for our walkers as for every walker (anim/turn.js turnToward, the lean into the turn, the shuffle of a body
  // turning on the spot). The gait is the city's too, driven by the distance the walker really moved.
  //
  // What is the city's and what is ours:
  //   called   movement.geomOf / at (the lanes in either direction, corner arcs, joins, crossings) · TURN.cornerPoint
  //            (the corner arc, for the corners geomOf leaves sharp: it only rounds a corner walked WITH the ring)
  //            · sim.near / sim.grid (the body map) · sim.roomSpan / laneC / sideU / sideDir (the clear strip)
  //            · sim.face (the eased heading) · sim.bodies / sim.movers (telling the crowd where we are and will be)
  //   ported   the brake behind a body and the step round it. The city's are lagStep and weave in
  //            simstate/movement.js: closures inside createMovement that work on a booked trip of the record page
  //            (its legs' minutes, its lag behind the booking) and cannot be reached from outside. Same figures
  //            (MOVE.lag, MOVE.weave), same reading of the body map, no booking.
  //            · GROUNDS.cornerPosts (the lamps and signal poles of a corner, for a step aside there)
  //            · city.cam.world (the collision world: what is solid, for the steps on and off the lanes)
  //   ours     the way from one lane point to another (wayBetween). The city's trip planner walks its sidewalk
  //            rings one way, starts and ends a walk 2.1 m or more from a corner and may cut its first and last
  //            stretch straight across a road. Our people walk either way, so the search (shortest way over the
  //            sim's own nodes and edges, both directions) is done here and the geometry is left to the city.
  //            And MAKING WAY (wayAside): the city's movers meet its crowd, which steps aside for them; two of
  //            ours meeting head-on in a corner's square are both movers, so one of them has to do the stepping.
  //   THE LIGHTS are not read: see walkTo().
  const BRAKE = MOVE.lag.brake;
  /**
   * A RUN gathers speed faster than a walk (m/s²): the city's 2.5 is its walkers', who top out at 2.6 m/s; a runner
   * of ours going to 5.2 would need 11 m to get there on it. Ours: 4, a brisk start, the same as the brake.
   */
  const RUN_ACC = 4;
  const RUNS = 3.4;
  /** No body slows harder than this (m/s²): even a sudden stop takes frames, never one. */
  const HARD = 9;
  /**
   * Held up this long (s) behind somebody it cannot get round, a walker passes on the bare body radii (no pad), for
   * the next metre and a half of its way. A WALKER NEVER WALKS THROUGH ANYBODY: still held up after that, whoever
   * stands in its way and is free to MAKES WAY (giveWay below); where they cannot (they are in a scene, sitting,
   * lying, walking themselves) it looks for another way on to its place (replan) and otherwise WAITS. A wait of more
   * than THROUGH s is counted (`waits`); `squeezes` counts the one case left where a body is ignored: two walkers
   * head-on where neither has anywhere to step, and the first on stage goes.
   */
  const STUCK = 0.7;
  const THROUGH = 2;
  const PASSING = 1.5;
  /**
   * BESIDE, NOT AHEAD. Most hold-ups are not somebody on the walker's line but somebody a hand's width inside the
   * room it keeps (measured: two people 0.58 m apart side by side, each held by the other for good, where 0.60 is
   * the bare room). Held up twice over, a walker whose way passes whoever it is at more than BRUSH metres LEANS OFF
   * them by what is missing and goes by; where there is nothing to lean into (a wall, a kerb, a parked car) it goes
   * by on that shoulder's width, which the audit counts (`brushes`). Its middle is never nearer anybody's than BRUSH.
   */
  const BRUSH = 0.45;
  const P4 = [0, 0, 0, 0];
  const Q4 = [0, 0, 0, 0];
  const L4 = [0, 0, 0, 0];
  const CP = [0, 0, 0];
  const RS = [0, 0];
  const ST = { ax: 0, az: 0, lo: 0, hi: 0, dA: 0, dB: 0, max: 0 };
  const CF = new Float32Array(12);
  const CS = new Float32Array(12);
  const FT = [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6];
  const SIDE_AXIS = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] };
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  /** The ground under a point that is on no lane: the road's surface on a carriageway, else the sidewalk's. */
  const groundAt = (x, z) => (PLAN.kerbOut(x, z) > 0 ? GROUND : 0);

  /** The point of a route `d` metres along it → out [x, y, z, heading]. */
  function poseOf(R, d, out) {
    d = Math.max(0, Math.min(R.len, d));
    let part = R.parts[R.parts.length - 1];
    for (const p of R.parts) {
      if (d <= p.c0 + p.len) {
        part = p;
        break;
      }
    }
    R.part = part;
    if (part.G) {
      movement.at(part.G, d - part.c0, out);
      R.seg = part.G.segs[part.G.k];
      R.segD = d - part.c0;
      // (a straight stretch inside the city's geometry is drawn at the sidewalk's height wherever it runs)
      if (!R.seg.E) out[1] = groundAt(out[0], out[2]);
    } else {
      const u = (d - part.c0) / part.len;
      out[0] = part.ax + (part.bx - part.ax) * u;
      out[2] = part.az + (part.bz - part.az) * u;
      out[1] = groundAt(out[0], out[2]);
      out[3] = part.h;
      R.seg = null;
    }
    for (const J of R.joins) {
      const s = d - J.d;
      if (Math.abs(s) >= J.t) continue;
      // a sharp corner: the city's own corner arc, laid over the two straight runs that meet there
      TURN.cornerPoint(J.bx, J.bz, J.u1x, J.u1z, J.u2x, J.u2z, s, J.r, CP);
      out[0] += CP[0] - (J.bx + (s < 0 ? J.u1x : J.u2x) * s);
      out[2] += CP[1] - (J.bz + (s < 0 ? J.u1z : J.u2z) * s);
      out[3] = CP[2];
      break;
    }
    return out;
  }

  /**
   * A route from its parts, in order: { line: [ax, az, bx, bz] } a straight step, { path: [[x, z], …] } points on
   * the sidewalks' node lines, laid on the lanes by the city. Null when there is nowhere to go.
   */
  function makeRoute(parts) {
    const R = { parts: [], len: 0, d: 0, m: 0, metres: 0, table: null, v: STEP_SPEED, joins: [], caps: [], X: null, Z: null, H: null, tk: 0, wx: 0, wz: 0, wvx: 0, wvz: 0, part: null, seg: null, segD: 0, held: 0, pass: 0, passAt: 0, wait: 0, blocker: null, aside: null, asideFor: null, ox: 0, oz: 0, endYaw: null, done: false, arrived: false };
    const corners = [];
    for (const part of parts) {
      if (part.line) {
        const [ax, az, bx, bz] = part.line;
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.03) continue;
        if (R.parts.length) corners.push([R.len, R.parts[R.parts.length - 1].last, len]);
        R.parts.push({ c0: R.len, len, ax, az, bx, bz, h: Math.atan2(bx - ax, bz - az), G: null, last: len });
        R.len += len;
      } else if (part.path?.length > 1) {
        const G = movement.geomOf(part.path);
        if (!G.segs.length || !(G.len > 0.03)) continue;
        if (R.parts.length) corners.push([R.len, R.parts[R.parts.length - 1].last, G.segs[0].len]);
        // (inside the city's geometry: a corner walked with the ring is rounded by the city, one walked against it
        // or on to a straight stretch is not. Each is looked at below, and rounded only where it is sharp)
        for (let k = 1; k < G.segs.length; k++) corners.push([R.len + G.segs[k].c0, G.segs[k - 1].len, G.segs[k].len]);
        R.parts.push({ c0: R.len, len: G.len, G, last: G.segs[G.segs.length - 1].len });
        R.len += G.len;
      }
    }
    if (!R.parts.length) return null;
    // the sharp corners: where the heading changes at once. The arc reaches as far as the city's own (ARC), and never
    // more than 0.45 of the run on either side of it
    const joins = [];
    for (const [d, before, after] of corners) {
      const h0 = poseOf(R, d - Math.min(0.03, before / 3), P4)[3];
      const h1 = poseOf(R, d + Math.min(0.03, after / 3), Q4)[3];
      const phi = Math.abs(wrap(h1 - h0));
      if (phi < 0.12 || phi > 2.7) continue;
      const t = Math.min(ARC.r * Math.tan(phi / 2), ARC.max, before * 0.45, after * 0.45);
      if (!(t > 0.05)) continue;
      const B = poseOf(R, d, P4);
      joins.push({ d, t, r: t / Math.tan(phi / 2), bx: B[0], bz: B[2], u1x: Math.sin(h0), u1z: Math.cos(h0), u2x: Math.sin(h1), u2z: Math.cos(h1) });
    }
    R.joins = joins;
    // THE LINE REALLY WALKED. `d` above is the geometry's own measure: along the edges, which is how the sim counts
    // its walkers. The body is drawn off that line on every corner arc and where a lane bends in to its corner, so
    // a walker moved by `d` alone slows and quickens as it goes round (measured on the city's own arcs: 0.056 m,
    // then 0.035 m, for the same 0.05 of `d`), and where two pieces of the geometry meet a centimetre or ten apart
    // it would hop. So the route is walked once here in 5 cm steps and written down: each point, with the drawn
    // metres up to it. The points are evened out over 25 cm (a seam becomes a slant, a corner stays a corner; the
    // two ends stay where they are), and the walker is then moved along THAT line by drawn metres (R.m). `d` is
    // read back from the table for everything that asks the geometry (which edge, the room across it).
    const n = Math.max(1, Math.ceil(R.len / TABLE));
    const [X, Z, H, T] = [new Float32Array(n + 1), new Float32Array(n + 1), new Float32Array(n + 1), new Float32Array(n + 1)];
    for (let k = 0; k <= n; k++) {
      const q = poseOf(R, Math.min(R.len, k * TABLE), P4);
      [X[k], Z[k], H[k]] = [q[0], q[2], q[3]];
    }
    const even = raw => {
      const out = raw.slice();
      for (let k = 1; k < n; k++) {
        const reach = Math.min(2, k, n - k);
        let sum = 0;
        for (let j = k - reach; j <= k + reach; j++) sum += raw[j];
        out[k] = sum / (2 * reach + 1);
      }
      return out;
    };
    // (the widest break in the line as the geometry gives it: routeTo() does not walk a route that is broken by
    // metres, which the city's geometry gives for a stretch walked against the ring past a dealing corner's ramps)
    for (let k = 1; k <= n; k++) R.seam = Math.max(R.seam ?? 0, Math.hypot(X[k] - X[k - 1], Z[k] - Z[k - 1]));
    // (a seam: two points of the geometry 5 cm apart along it and more than 20 cm apart on the ground. The audit
    // counts them: each is a place where the city's pieces, or ours and the city's, do not meet)
    if (audit) {
      for (let k = 1; k <= n; k++) {
        const gap = Math.hypot(X[k] - X[k - 1], Z[k] - Z[k - 1]);
        if (gap <= 0.2) continue;
        audit.seams += 1;
        if (audit.examples.length < 400) audit.examples.push(`seam ${gap.toFixed(2)} m at ${X[k].toFixed(1)}, ${Z[k].toFixed(1)} (${(k * TABLE).toFixed(1)} of ${R.len.toFixed(1)} m; parts ${R.parts.map(q => (q.G ? `lane ${q.len.toFixed(1)}` : `step ${q.len.toFixed(1)}`)).join(' + ')})`);
      }
    }
    const [XS, ZS] = [even(X), even(Z)];
    for (let k = 1; k <= n; k++) T[k] = T[k - 1] + Math.hypot(XS[k] - XS[k - 1], ZS[k] - ZS[k - 1]);
    Object.assign(R, { table: T, X: XS, Z: ZS, H, tk: 0, metres: T[n] });
    // how fast each stretch may be taken: no faster than the drawn body can turn (the city's turn rate). Kept by the
    // drawn metre the stretch is at
    for (let k = 5; k <= n; k += 5) {
      const turn = Math.abs(wrap(H[k] - H[k - 5]));
      if (turn > 0.05) R.caps.push([T[k] - 0.125, Math.max(0.9, (ARC.turnRate * 0.25) / turn)]);
    }
    return R;
  }
  /** The step of a route's table, in metres of its geometry. */
  const TABLE = 0.05;
  /**
   * The point of a route's walked line `m` drawn metres along it → out [x, , z, heading] (the height is the
   * geometry's: poseOf). Returns where that is on the geometry (`d`).
   */
  function lineAt(R, m, out) {
    const T = R.table;
    const n = T.length - 1;
    let k = Math.min(R.tk, n - 1);
    while (k > 0 && T[k] > m) k--;
    while (k < n - 1 && T[k + 1] <= m) k++;
    R.tk = k;
    const span = T[k + 1] - T[k];
    const f = span > 1e-6 ? Math.max(0, Math.min(1, (m - T[k]) / span)) : 0;
    out[0] = R.X[k] + (R.X[k + 1] - R.X[k]) * f;
    out[2] = R.Z[k] + (R.Z[k + 1] - R.Z[k]) * f;
    out[3] = R.H[k] + wrap(R.H[k + 1] - R.H[k]) * f;
    // (the last step of the table is as long as what was left of the geometry)
    return k * TABLE + f * Math.min(TABLE, R.len - k * TABLE);
  }

  /** The speed the corners ahead allow now: each capped stretch is braked for in time. */
  function cornerLimit(R) {
    let limit = Infinity;
    // (a runner leans through a corner half as fast again as a walker turns: the drawn heading trails it a moment)
    const lean = R.v > RUNS ? 1.5 : 1;
    for (const [at, cap] of R.caps) {
      const v = cap * lean;
      const gap = at - R.m;
      if (gap < -0.3) continue;
      if (gap > 14) break;
      limit = Math.min(limit, Math.sqrt(v * v + 2 * BRAKE * Math.max(0, gap)));
    }
    return limit;
  }

  /**
   * How far along its route a walker can go before it would touch somebody, from the city's body map (as of the
   * last step of the pedestrian sim). The way the city's own movers read it (movement.js lagStep): the route ahead
   * is sampled, and a body counts when the walker would come within both radii and a pad of it while closing in on
   * it. People who are not on stage (the hidden crowd, an extra in the wings) are nobody.
   */
  function bodyAhead(A, R, v) {
    const BG = sim.grid;
    R.blocker = null;
    if (!BG?.n || R.pass > 2) return Infinity;
    const C = MOVE.lag;
    const bare = R.pass > 0;
    const reach = (v * v) / (2 * BRAKE) + 0.9;
    const x0 = A.x;
    const z0 = A.z;
    let hit = Infinity;
    let who = null;
    for (let u = 0.15; u <= reach && hit === Infinity && R.d + u <= R.len + 0.3; u += 0.15) {
      const q = poseOf(R, R.d + u, Q4);
      const x = q[0] + R.wx;
      const z = q[2] + R.wz;
      const hx = Math.sin(q[3]);
      const hz = Math.cos(q[3]);
      sim.near(x, z, C.r + C.pad + 0.7, k => {
        if (hit !== Infinity) return;
        const o = BG.w[k];
        const b = BG.b[k];
        if (o === A.w || o?.hide) return;
        // (the person this walk is TO, a scene's partner it is walking up to: its mark is a reach short of them,
        // and they are where it is going, not in its way. Without this a robber stepping in from a gun's distance
        // stood and waited behind the very person he was stepping in on: 2.6 to 6.9 s a grab)
        if (o?.hk2 && (o.hk2 === A.meet || A.past?.has(o.hk2))) return;
        // (one of ours on the ground: the walker steers round the room it lies in where the sidewalk has room,
        // weave() below, and steps over its legs where it has none. It does not stand and wait for it to get up)
        if (b && o?.hk2) return;
        // (a walker of the crowd that makes way for a mover is not in the way, unless it is close by now)
        if (o && !b && !o.fix && sim.yields(o) && (BG.x[k] - x0) * hx + (BG.z[k] - z0) * hz > C.close) return;
        // (R.pass 2: by on a shoulder's width, BRUSH, when it has stood behind the bare radii too and whoever it is
        // stands BESIDE its way, not on it)
        // (one of ours walking TOWARDS it closes the gap from their side too: a third of a second of their pace more,
        // so two who meet stop a body's width apart and not chest to chest)
        const coming = !bare && o?.hk2?.route && o.hk2.vc > 0.3 && Math.sin(o.hk2.ry) * hx + Math.cos(o.hk2.ry) * hz < -0.3 ? Math.min(0.7, o.hk2.vc * 0.33) : 0;
        const rs = R.pass > 1 ? BRUSH : C.r + BG.r[k] + coming + (bare ? 0 : C.pad + (b ? b.room ?? 0 : 0));
        const d = Math.hypot(BG.x[k] - x, BG.z[k] - z);
        if (d >= rs || d >= Math.hypot(BG.x[k] - x0, BG.z[k] - z0) - 1e-3) return;
        // two of ours each in the other's way: the one who came on stage first goes (the city's rule for its
        // walkers). When they are head-on the other one makes way first (advance(): MAKING WAY) and nobody walks
        // into anybody; only when it has nowhere to step does the first one walk on regardless
        const other = o?.hk2 ?? null;
        if (other?.route?.blocker === A && A.w.id < o.id && (!headOn(A, other) || (other.route.aside === false && R.aside === false))) {
          // (head-on with nowhere for either to step: counted, once for the two of them)
          if (audit && headOn(A, other) && R.ignored !== other) {
            R.ignored = other;
            audit.squeezes += 1;
            if (audit.examples.length < 160) audit.examples.push(`squeeze ${A.id} past ${other.id} at ${A.x.toFixed(1)}, ${A.z.toFixed(1)}: head-on and nowhere for either to step`);
          }
          return;
        }
        hit = u;
        who = other ?? o ?? b;
      });
    }
    R.blocker = who;
    return hit;
  }

  /** Are two walkers of ours facing each other (within about 100 degrees of head-on)? */
  const headOn = (A, B) => Math.sin(A.ry) * Math.sin(B.ry) + Math.cos(A.ry) * Math.cos(B.ry) < -0.2;
  /**
   * MAKING WAY. Two of ours meet head-on where the lane gives no room to step aside (a corner's square, a step to
   * a spot, a crossing's end): the one who came on stage later steps off its line, to its right, or to its left
   * when its right is the road, a corner's post or somebody standing, and the other walks by. → the step as a
   * vector [x, z], or null when there is nowhere to step.
   */
  function wayAside(A, other = null) {
    const [rx, rz] = [-Math.cos(A.ry), Math.sin(A.ry)];
    const inRoad = PLAN.kerbOut(A.x, A.z) <= 0;
    wayAside.stander = null;
    // THE STEPS TO TRY. Off the line the OTHER one is walking, by a body and a pad, to the side of it this walker is
    // already on, then to its far side: two ways that cross at a slant are not cleared by a step to one's own right
    // (measured: a walker 0.74 m aside and still 0.39 m from the other's line, the two of them held for good).
    // With nobody named, or dead ahead of them: to its own right, then its left.
    const steps = [];
    if (other) {
      const [ox, oz] = [Math.sin(other.ry), Math.cos(other.ry)];
      const lat = (A.x - other.x) * oz - (A.z - other.z) * ox;
      const side = Math.abs(lat) > 0.08 ? Math.sign(lat) : Math.sign(rx * oz - rz * ox) || 1;
      for (const sd of [side, -side]) {
        const move = sd * 0.85 - lat;
        if (Math.abs(move) <= 1.5) steps.push([oz * move, -ox * move]);
      }
    }
    for (const sd of [1, -1]) steps.push([rx * sd * 0.75, rz * sd * 0.75]);
    // (on the sidewalk only, or on the road it is already crossing. A step down off the kerb was tried and taken
    // out: whoever was then held up stood in the road, and came back up through a parked car's corner)
    for (const gutter of [false]) {
      for (const [vx, vz] of steps) {
        const [x, z] = [A.x + vx, A.z + vz];
        if (!inRoad && !gutter && PLAN.kerbOut(x, z) < PED.body) continue;
        if (gutter && (inRoad || PLAN.kerbOut(x, z) > 0)) continue;
        const [i, j] = [Math.round(x / PLAN.P), Math.round(z / PLAN.P)];
        let ok = true;
        for (const [bi, bj] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) for (const [px, pz, pr] of GROUNDS.cornerPosts(bi, bj)) if (Math.hypot(px - x, pz - z) < pr + PED.body + 0.05) ok = false;
        let stander = null;
        for (const B of actors.values()) if (B !== A && !B.w.hide && B.mode === 'free' && !B.route && Math.hypot(B.x - x, B.z - z) < MOVE.weave.sep) stander = B;
        if (ok && !stander && !solidAt(x, groundAt(x, z), z)) return [R0(A).wx + vx, R0(A).wz + vz];
        if (ok && stander && !gutter) wayAside.stander ??= stander;
      }
    }
    return null;
  }
  /** (the offset a walker already has across its line: a new step aside is taken from where it is) */
  const R0 = A => A.route ?? { wx: 0, wz: 0 };

  /** Where a route ends, on the ground: [x, z]. */
  const endOf = R => [R.X[R.X.length - 1] + R.ox, R.Z[R.Z.length - 1] + R.oz];
  /**
   * MAKING WAY FOR A WALKER. `B` stands where `A` has to pass and A cannot get round. B steps off A's line, to the
   * side of it B is already on (else the other; down off the kerb only when the sidewalk has nowhere), waits there
   * until A is by, and steps back to where it stood, in what it was doing. Only someone free to: not in a scene
   * (`firm`), not half of a two-person clip, not sitting or lying, not in a room, not walking. → true when B moves.
   */
  function giveWay(B, A, ring = false) {
    if (!B || B === A || actors.get(B.id) !== B || B.yield || B.paired || B.room || B.mode !== 'free' || B.w.hide || !A.route) return false;
    // (a WALKER makes way only for the one it is itself held up by, or as the one of a RING of held-up walkers
    // chosen to break it: its walk is put by, and taken up again after)
    const walking = B.route;
    if (walking ? walking.blocker !== A && !ring : B.firm) return false;
    // (asked from inside its own step of this frame: the step it is in the middle of is finished first, and it
    // makes way at the top of the next frame, from where that leaves it. Laid now, its step aside would start a
    // frame behind the body)
    if (walking && B.stepping) {
      B.yieldTo = [A, ring];
      return true;
    }
    if (LOW.has(B.clipName) || LOW.has(B.want?.name)) return false;
    const R = A.route;
    const [hx, hz] = [Math.sin(A.ry), Math.cos(A.ry)];
    const [nx, nz] = [hz, -hx];
    const lat = (B.x - A.x) * nx + (B.z - A.z) * nz;
    const side = lat >= 0 ? 1 : -1;
    // (clear of the rest of A's way by a body and a pad, of everyone else by a body's width)
    const line = [];
    for (let u = 0; u <= 3; u += 0.3) {
      const q = poseOf(R, Math.min(R.len, R.d + u), [0, 0, 0, 0]);
      line.push([q[0] + R.ox, q[2] + R.oz]);
    }
    const ok = (x, z, gutter) => {
      if (!gutter && PLAN.kerbOut(x, z) < PED.body) return false;
      if (solidAt(x, groundAt(x, z), z) || !lineFree(B.x, B.z, x, z)) return false;
      if (line.some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 0.85)) return false;
      for (const C of actors.values()) {
        if (C === B || C === A || C.w.hide || C.room) continue;
        if (Math.hypot(C.x - x, C.z - z) < 0.7 || (C.route && Math.hypot(endOf(C.route)[0] - x, endOf(C.route)[1] - z) < 0.7)) return false;
      }
      return true;
    };
    // (on a sidewalk only, or the road it already stands on: whoever makes way stands there for seconds, and nobody
    // is stood in the road for that. A step down off the kerb is for two walkers passing: wayAside)
    // (to the side they are on first, and well to it; across the walker's way only when they stand almost on it)
    const ways = [[side, 1, 0], [side, 1.3, 0], [side, 1, 0.7], [side, 1.3, 0.7], [side, 1, -0.5]];
    if (Math.abs(lat) < 0.3) ways.push([-side, 1, 0], [-side, 1.3, 0], [-side, 1, 0.7]);
    for (const gutter of [PLAN.kerbOut(B.x, B.z) <= 0]) {
      for (const [sd, far, fwd] of ways) {
        const move = sd * far - lat;
        const [x, z] = [B.x + nx * move + hx * fwd, B.z + nz * move + hz * fwd];
        if (!ok(x, z, gutter)) continue;
        B.yield = { home: [B.x, B.z, B.ry], to: [x, z], for: A, want: walking ? null : B.want, t: 0, phase: 0, goId: B.goId, walk: walking, wv: walking ? [walking.wvx, walking.wvz] : null };
        if (walking) {
          // (a run's clip goes with the run: it steps aside at a walk. The step is laid here and now, with the
          // sideways speed it has: a frame without a route would be a frame standing still)
          if (walking.clip && walking.clipFrom && B.want?.name === walking.clip) B.want = null;
          walking.clipOn = false;
          const S = makeRoute([{ line: [B.x, B.z, x, z] }]);
          if (!S) {
            B.yield = null;
            return false;
          }
          Object.assign(S, { v: 1.3, wvx: walking.wvx, wvz: walking.wvz, pass: 2, passAt: 1e9 });
          B.route = S;
          B.yield.phase = 1;
        } else B.want = null;
        if (audit) audit.gaveWay += 1;
        return true;
      }
    }
    return false;
  }
  /** One frame of someone making way (giveWay): out of what they were doing, the step aside, the wait, the step back. */
  function stepYield(B, dt) {
    const Y = B.yield;
    if (B.goId !== Y.goId || B.w.hide || (B.firm && !Y.walk) || B.room) {
      // (another order took them, or a scene did: where they are is theirs now)
      B.yield = null;
      return;
    }
    Y.t += dt;
    const go = (x, z, yaw) => {
      const R = makeRoute([{ line: [B.x, B.z, x, z] }]);
      if (R) {
        // (a step out of the way is not held up by the bodies it is stepping away from: a shoulder's width, see BRUSH)
        Object.assign(R, { v: 1.3, endYaw: yaw, pass: 2, passAt: 1e9 });
        // (it was stepping sideways when its walk was put by: that speed is this step's to wind down)
        if (Y.wv) [R.wvx, R.wvz, Y.wv] = [Y.wv[0], Y.wv[1], null];
        setRoute(B, R);
      }
      return !!R;
    };
    if (Y.phase === 0) {
      // (what they were doing is blended out first: nobody slides aside in a standing clip)
      if (!Y.walk && B.drawn && B.w.g?.clip && B.w.g.clip.w > SWITCH_AT && Y.t < 0.7) return;
      Y.phase = go(Y.to[0], Y.to[1], null) ? 1 : 4;
    } else if (Y.phase === 1) {
      // (a step aside that cannot be finished, somebody is in the way of that too, is given up where it got to)
      if (B.route && Y.t < 3) return;
      if (B.route) {
        B.route.done = true;
        B.route = null;
        B.vc = 0;
      }
      Y.phase = 2;
      Y.t = 0;
    } else if (Y.phase === 2) {
      const A = Y.for;
      const by = !A.route || A.w.hide || (B.x - A.x) * Math.sin(A.ry) + (B.z - A.z) * Math.cos(A.ry) < -0.7 || Math.hypot(B.x - A.x, B.z - A.z) > 4;
      if (!by && Y.t < 8) return;
      if (Y.walk) {
        // on with its own walk, laid again from where it stepped to (the same route object: whoever waits for
        // its end still does)
        const W = Y.walk;
        const end = endOf(W);
        const R2 = W.goal ? routeTo(B, W.goal.x, W.goal.z, W.goal.entry) : makeRoute([{ line: [B.x, B.z, end[0], end[1]] }]);
        if (R2) {
          Object.assign(W, R2, { v: W.v, endYaw: W.endYaw, clip: W.clip, clipFrom: W.clipFrom, clipOn: false, goal: W.goal, done: false, arrived: false, pass: 0, held: 0, stood: 0, blocker: null, aside: null, asideFor: null });
          B.route = W;
        } else Object.assign(W, { done: true, arrived: Math.hypot(B.x - end[0], B.z - end[1]) < 0.3 });
        Y.phase = 4;
      } else {
        // back to where they stood, when nobody has taken it meanwhile (the walker's own place may be right there)
        const taken = [...actors.values()].some(C => C !== B && !C.w.hide && !C.room && (Math.hypot(C.x - Y.home[0], C.z - Y.home[1]) < 0.75 || (C.route && Math.hypot(endOf(C.route)[0] - Y.home[0], endOf(C.route)[1] - Y.home[1]) < 0.75)));
        if (taken && Y.t < 8) return;
        Y.phase = !taken && go(Y.home[0], Y.home[1], Y.home[2]) ? 3 : 4;
      }
    } else if (Y.phase === 3) {
      if (B.route) return;
      Y.phase = 4;
    }
    if (Y.phase === 4) {
      if (!B.want && Y.want) B.want = Y.want;
      B.yield = null;
    }
  }
  /**
   * ROUND SOMEBODY WHO CANNOT MOVE (in a scene, sitting, lying) and stands on the walker's way: it steps off its
   * line, to the side they are not on, by enough to pass a body's width from them, and comes back on to its line
   * when they are behind it. Only into free ground: a sidewalk (or the road it is already on), nothing solid, nobody
   * standing there or abeam of the one it goes round. → true when it has somewhere to step.
   */
  function stepRound(A, R, B, hx, hz, lat, over = false) {
    if ((R.aside && !over) || B.x === undefined) return false;
    const road = PLAN.kerbOut(A.x, A.z) <= 0;
    const ahead = Math.max(0, (B.x - A.x) * hx + (B.z - A.z) * hz);
    const free = (x, z) => (road || PLAN.kerbOut(x, z) >= PED.body) && !solidAt(x, groundAt(x, z), z) && ![...actors.values()].some(C => C !== A && C !== B && !C.w.hide && !C.room && !C.route && Math.hypot(C.x - x, C.z - z) < 2 * PED.body + 0.05);
    for (const side of lat >= 0 ? [-1, 1] : [1, -1]) {
      // (so far across that its line passes them at a body's width and a pad)
      const move = lat + side * (2 * PED.body + 0.12);
      const [vx, vz] = [hz * move, -hx * move];
      if (Math.abs(move) > 1.6 || !free(A.x + vx, A.z + vz) || !free(A.x + vx + hx * ahead, A.z + vz + hz * ahead)) continue;
      [R.aside, R.asideFor, R.leanAt, R.leanFor] = [[R.wx + vx, R.wz + vz], B.route !== undefined ? B : null, R.m, ahead + 1.5];
      R.pass = Math.max(R.pass, 1);
      R.passAt = R.m;
      if (audit) audit.rounds += 1;
      return true;
    }
    return false;
  }

  /**
   * ANOTHER WAY ON TO ITS PLACE: a walker held up by someone who cannot make way lays its walk again from where it
   * stands (the step off the lane to its place is chosen clear of whoever stands still now: routeTo). The route is
   * the same object, so whoever waits for its end still does. Every couple of seconds at most.
   */
  function replan(A, R) {
    if (!R.goal || clock - (R.planAt ?? -9) < 2 || (R.plans ?? 0) >= 3) return false;
    R.planAt = clock;
    const R2 = routeTo(A, R.goal.x, R.goal.z, R.goal.entry);
    if (!R2) return false;
    // (only a way that does not start by walking into the same body)
    const q = poseOf(R2, Math.min(R2.len, 0.6), Q4);
    const B = R.blocker;
    if (B?.x !== undefined && Math.hypot(q[0] - B.x, q[2] - B.z) < Math.hypot(A.x - B.x, A.z - B.z) - 0.05) return false;
    // (the sideways speed it has is the new way's to wind down, as when any new route is handed over: setRoute)
    Object.assign(R, R2, { v: R.v, endYaw: R.endYaw, clip: R.clip, clipFrom: R.clipFrom, clipOn: R.clipOn, goal: R.goal, planAt: R.planAt, plans: (R.plans ?? 0) + 1, done: false, arrived: false, wvx: R.wvx, wvz: R.wvz, pass: R.pass, passAt: 0, held: 0, stood: R.stood });
    if (audit) audit.replans += 1;
    return true;
  }

  /** The room across the route where the walker is: the axis to step along and how far each way. Null: none. */
  function stretchOf(R, v) {
    const sg = R.seg;
    const E = sg?.E;
    if (!E || E.joint || E.from.detour || E.to.detour) return null;
    const along = R.segD - sg.c0;
    const s = sg.s0 + (sg.s1 - sg.s0) * (sg.len ? along / sg.len : 0);
    ST.dA = along;
    ST.dB = sg.len - along;
    ST.max = MOVE.weave.max;
    if (E.cross) {
      // out in the road half a metre either way, and none of it near either kerb
      const m = Math.min(0.5, Math.min(s, E.len - s) - (NODE + 0.5));
      if (m <= 0) return null;
      [ST.ax, ST.az, ST.lo, ST.hi] = [E.awx, E.awz, -m, m];
      return ST;
    }
    const u = sim.sideU(E, s);
    const dir = sim.sideDir(E) * (sg.s1 >= sg.s0 ? 1 : -1);
    const c = sim.laneC(E, u);
    // the strip a body may use here without touching anything the block's build left on the sidewalk
    const room = c >= 0.15 ? sim.roomSpan(E, u - dir * 0.3, u + dir * Math.max(1.5, v * 0.8), RS) : null;
    if (!room) return null;
    [ST.ax, ST.az] = SIDE_AXIS[E.side];
    // (behind, the room is measured to the side's own corner, not to where the walker came on to the lane: a walk
    // that starts mid-side, at a standing spot's entry, may step aside from its first metre. The city's rule too)
    ST.dA = sg.s1 >= sg.s0 ? s : E.len - s;
    ST.lo = Math.min(0, room[0] + 0.02 - c);
    ST.hi = Math.max(0, room[1] - 0.02 - c);
    // (on a walk wider than the city's old 2 m the step aside may reach that much further, as the city's own does:
    // on a 3 m sidewalk there is room to pass someone who stands on the lane itself)
    if (E.sw > MOVE.band.from) ST.max += E.sw - PLAN.SWALK;
    return ST;
  }

  /**
   * One frame of a walker's step aside (the city's weave, movement.js): where each body ahead will be across the
   * route when the walker reaches it, and the nearest place across the clear strip that passes them all, taken at
   * a walker's sideways speed and acceleration. Back on the line before the stretch ends (a corner, the route's end).
   * `x, z, h` is the route's own point and heading now; the offset lives on the route as a vector (wx, wz).
   */
  function weave(A, R, x, z, h, v, dt) {
    const Wv = MOVE.weave;
    const K = Wv.walk;
    const st = v > 0.05 || R.blocker ? stretchOf(R, Math.max(v, 0.5)) : null;
    let tx = 0;
    let tz = 0;
    if (st) {
      const left = Math.max(0, Math.min(st.dB, R.len - R.d) - Wv.node);
      const cap = Math.max(0, Math.min(st.dA, st.dB, R.len - R.d) - Wv.node);
      const lo = Math.max(st.lo, -st.max, -cap);
      const hi = Math.min(st.hi, st.max, cap);
      const off = R.wx * st.ax + R.wz * st.az;
      let target = 0;
      if (hi - lo > 0.05) {
        const hx = Math.sin(h);
        const hz = Math.cos(h);
        const pace = Math.max(v, 0.5);
        const reach = Math.min(pace * Wv.look + 1.2, left + Wv.sep);
        const BG = sim.grid;
        let n = 0;
        if (BG?.n) {
          sim.near(x + hx * reach * 0.5, z + hz * reach * 0.5, reach * 0.5 + 0.8, k => {
            const o = BG.w[k];
            const b = BG.b[k];
            if (n >= 12 || o === A.w || o?.hide) return;
            const rx = BG.x[k] - x;
            const rz = BG.z[k] - z;
            const ahead = rx * hx + rz * hz;
            if (ahead < -0.5 || ahead > reach) return;
            const vc = b || !o ? 0 : o.vc || 0;
            const ovx = vc ? Math.sin(o.p[3]) * vc : 0;
            const ovz = vc ? Math.cos(o.p[3]) * vc : 0;
            const closing = pace - (ovx * hx + ovz * hz);
            const when = ahead <= 0 ? 0 : closing > 0.05 ? ahead / closing : 99;
            if (when > Wv.look) return;
            const sep = b ? Wv.body + BG.r[k] + 0.12 + (b.room ?? 0) : Wv.sep;
            const across = (rx + ovx * when) * st.ax + (rz + ovz * when) * st.az;
            if (Math.abs(across - off) < sep + 0.3) {
              CF[n] = across;
              CS[n++] = sep;
            }
          });
        }
        // SOMETHING SOLID in the way that the room table does not hold: a piece of the set (the table is the city's
        // and knows none of them), or something of the city's own that its collision world has and its table has
        // not. Where the line itself, a pace or two ahead, runs through one, the walker steps round it as round a
        // body; and no step aside for anybody is taken into one
        const inPiece = at => [0.5, 1.1].some(f => solidAt(x + hx * f + st.ax * at, GROUND, z + hz * f + st.az * at, true));
        const piece = inPiece(0);
        if (n || piece) {
          // the nearest place that clears them all; two of ours meeting head-on each keep to their own right
          const right = st.ax * -hz + st.az * hx;
          let best = null;
          let bestCost = Infinity;
          let fallback = 0;
          let fallbackRoom = -1e9;
          const tryAt = at => {
            if (at < lo - 1e-6 || at > hi + 1e-6 || inPiece(at)) return;
            let clear = Infinity;
            for (let k = 0; k < n; k++) clear = Math.min(clear, Math.abs(at - CF[k]) - CS[k]);
            const cost = Math.abs(at) + 0.6 * Math.abs(at - off) - 0.05 * at * right;
            if (clear >= -1e-6) {
              if (cost < bestCost) {
                bestCost = cost;
                best = at;
              }
            } else if (clear > fallbackRoom) {
              fallbackRoom = clear;
              fallback = at;
            }
          };
          tryAt(0);
          for (let k = 0; k < n; k++) {
            tryAt(CF[k] - CS[k]);
            tryAt(CF[k] + CS[k]);
          }
          tryAt(lo);
          tryAt(hi);
          if (piece) for (const at of [0.25, -0.25, 0.45, -0.45, 0.65, -0.65, 0.85, -0.85]) tryAt(at);
          target = best !== null ? best : fallback;
        }
        // back on the line in time for the end of the stretch
        if (left / Math.max(0.3, v) < Math.abs(off) / K.v + K.v / K.a + 0.2) target = 0;
      }
      target = Math.max(lo, Math.min(hi, target));
      tx = st.ax * target;
      tz = st.az * target;
    } else if (v <= 0.05) {
      // (held up and standing, it keeps its place across the walk: it stops moving sideways, gently)
      tx = R.wx;
      tz = R.wz;
    }
    // (making way for someone head-on: off the line by the step chosen, wherever on the route this is)
    if (R.aside) [tx, tz] = R.aside;
    let vx = (tx - R.wx) * 4;
    let vz = (tz - R.wz) * 4;
    const speed = Math.hypot(vx, vz);
    if (speed > K.v) {
      vx *= K.v / speed;
      vz *= K.v / speed;
    }
    let ax = vx - R.wvx;
    let az = vz - R.wvz;
    const push = Math.hypot(ax, az);
    if (push > K.a * dt) {
      ax *= (K.a * dt) / push;
      az *= (K.a * dt) / push;
    }
    R.wvx += ax;
    R.wvz += az;
    R.wx += R.wvx * dt;
    R.wz += R.wvz * dt;
    if (!tx && !tz && Math.hypot(R.wx, R.wz) < 2e-3 && Math.hypot(R.wvx, R.wvz) < 0.02) R.wx = R.wz = R.wvx = R.wvz = 0;
  }

  /** One frame of a walker on its route. */
  function advance(A, R, dt, drop = 0.5) {
    const w = A.w;
    const here = poseOf(R, R.d, P4);
    const left = R.metres - R.m;
    let want = Math.min(R.v, cornerLimit(R), Math.max(0.25, Math.sqrt(2 * BRAKE * left)));
    // TURN, THEN GO: a body that would set off more than a quarter turn away from the way it faces turns on the
    // spot first (a second at most; one the camera does not have in view is not being turned by the city at all)
    if (R.m < 0.2 && A.vc < 0.3 && A.drawn && !A.faceTo && R.wait < 1 && Math.abs(wrap(here[3] - (w.yawS ?? A.ry))) > 1.1) {
      want = 0;
      R.wait += dt;
    } else {
      if (R.pass && R.m - R.passAt > PASSING) R.pass = 0;
      // KEEP TO ONE SIDE, EARLY. Two of ours walking at each other each lean off the other's way by half of what two
      // bodies need, from five metres off, before either has to stop: to their own right, or to the side each is
      // already on when they are not dead in line (both read the same number, so both choose alike). Only into
      // free ground; where one of them has none, what is left is the making way below
      if (!R.aside && A.vc > 0.3 && (R.lookAt ?? -1) < clock) {
        R.lookAt = clock + 0.12;
        const [hx, hz] = [Math.sin(here[3]), Math.cos(here[3])];
        for (const B of actors.values()) {
          if (B === A || !B.route || B.w.hide || B.vc < 0.3 || B.room) continue;
          const [dx, dz] = [B.x - A.x, B.z - A.z];
          const ahead = dx * hx + dz * hz;
          if (ahead < 0.6 || ahead > 5 || Math.sin(B.ry) * hx + Math.cos(B.ry) * hz > -0.5) continue;
          const lat = dx * hz - dz * hx;
          const need = 2 * PED.body + 0.3 - Math.abs(lat);
          if (need <= 0.02) continue;
          // (`lat` + : they are on this walker's left, and it goes right)
          const sgn = lat < -0.15 ? -1 : 1;
          const [vx, vz] = [(-hz * sgn * need) / 2, (hx * sgn * need) / 2];
          const [x, z] = [A.x + vx, A.z + vz];
          const road = PLAN.kerbOut(A.x, A.z) <= 0;
          if ((!road && PLAN.kerbOut(x, z) < PED.body) || solidAt(x, groundAt(x, z), z) || solidAt(x + hx * 0.8, groundAt(x, z), z + hz * 0.8)) continue;
          if ([...actors.values()].some(C => C !== A && C !== B && !C.w.hide && !C.room && !C.route && Math.hypot(C.x - x - hx * 0.6, C.z - z - hz * 0.6) < 2 * PED.body + 0.1)) continue;
          [R.aside, R.asideFor, R.leanAt, R.leanFor] = [[R.wx + vx, R.wz + vz], B, R.m, ahead + 1];
          if (audit) audit.keptRight += 1;
          break;
        }
      }
      const hit = bodyAhead(A, R, Math.max(A.vc, 0.5));
      if (hit < Infinity) want = Math.min(want, Math.sqrt(2 * BRAKE * Math.max(0, hit - 2 * MOVE.lag.step)));
      // making way for the one it is head-on with (wayAside above): the step is kept until that one is by
      const other = R.blocker?.route ? R.blocker : null;
      if (other && R.aside === null && other.route.blocker === A && (A.w.id > other.w.id || other.route.aside === false) && headOn(A, other)) {
        R.aside = wayAside(A, other) ?? false;
        R.asideFor = other;
        // (nowhere to step only because somebody STANDS there: they are asked to make room, and it is tried again)
        if (R.aside === false && wayAside.stander && (wayAside.stander.yield || giveWay(wayAside.stander, A))) R.aside = null;
      }
      const B = R.asideFor;
      // (and given up at once where it would carry the walker on into something solid)
      // (seen from as far as the body covers while it steps back on to its line: half a second of its pace)
      if (R.aside && [0.6, 0.6 + A.vc * 0.25, 0.6 + A.vc * 0.5].some(u => solidAt(A.x + Math.sin(A.ry) * u, A.y, A.z + Math.cos(A.ry) * u))) [R.aside, R.asideFor, R.leanAt] = [null, null, undefined];
      // (kept until whoever it is for is by: behind, or well away. A step aside for a WALKER also ends when they stop
      // walking; a lean off somebody is kept past them whether they walk or stand)
      if (B && ((R.leanAt === undefined && !B.route) || (B.x - A.x) * Math.sin(A.ry) + (B.z - A.z) * Math.cos(A.ry) < -0.4 || Math.hypot(B.x - A.x, B.z - A.z) > (R.leanAt !== undefined ? 7 : 4))) [R.aside, R.asideFor, R.leanAt] = [null, null, undefined];
      // held up, standing: after a while it passes closer; then whoever is in the way makes way, or it looks for
      // another way, or it waits (see STUCK). It never walks through
      R.held = A.vc < 0.05 && R.blocker ? R.held + dt : 0;
      R.stood = A.vc < 0.05 && R.blocker ? (R.stood ?? 0) + dt : 0;
      if (R.held > STUCK) {
        const B = R.blocker;
        const [hx, hz] = [Math.sin(here[3]), Math.cos(here[3])];
        // (how far to the side of this walker's way the body it is held by is: + to its right hand's side of the map)
        const lat = B.x !== undefined ? (B.x - A.x) * hz - (B.z - A.z) * hx : 0;
        const beside = Math.abs(lat) >= BRUSH - 0.03;
        if (beside && !R.pass) {
          R.pass = 1;
          R.passAt = R.m;
          R.held = 0;
        } else if (beside && R.pass === 1) {
          // beside its way: lean off them and go by
          const need = 2 * PED.body + 0.05 - Math.abs(lat);
          const [vx, vz] = [-Math.sign(lat) * hz * need, Math.sign(lat) * hx * need];
          const [x, z] = [A.x + vx, A.z + vz];
          const road = PLAN.kerbOut(A.x, A.z) <= 0;
          if (need > 0 && !R.aside && (road || PLAN.kerbOut(x, z) >= PED.body) && !solidAt(x, groundAt(x, z), z)) {
            R.aside = [R.wx + vx, R.wz + vz];
            R.asideFor = B.route !== undefined ? B : null;
            R.leanAt = R.m;
          } else if (audit) {
            audit.brushes += 1;
            if (audit.examples.length < 160) audit.examples.push(`brush ${A.id} by ${B.id ?? 'a body'} at ${A.x.toFixed(1)}, ${A.z.toFixed(1)}: ${Math.abs(lat).toFixed(2)} m to the side, nothing to lean into`);
          }
          R.pass = 2;
          R.passAt = R.m;
          R.held = 0;
        } else if (clock - (R.askedAt ?? -9) > 0.8) {
          // ON its way (someone straight ahead is never crept up on: a queue keeps its distance). Two walkers each
          // in the other's way: the one who came on stage later steps out of it and lets the other by (giveWay,
          // its walk kept for after). A stander makes way when they are free to; one who cannot, it looks for a
          // way round
          R.askedAt = clock;
          // (a RING: A held by B held by C … held by A. Two is the plain case. Whoever in it came on stage last
          // makes way for the one they are holding up)
          const ring = [A];
          for (let X = B; X?.route && X.route.blocker && ring.length < 7; X = X.route.blocker) {
            if (X === A) break;
            if (ring.includes(X) || !(X.route.stood > 0.3)) {
              ring.length = 0;
              break;
            }
            ring.push(X);
          }
          const closed = ring.length > 1 && ring[ring.length - 1].route?.blocker === A;
          if (closed) {
            // (and where the one who should has nowhere to step that is clear of the other's whole way, a lane
            // running where they both stand, this one steps off its own line by what is missing between them:
            // measured, two walkers 0.27 m off each other's lines, each leaning a little, held for thirty seconds)
            const last = ring.reduce((p, q) => (q.w.id > p.w.id ? q : p));
            if (!giveWay(last, ring.find(X => X.route.blocker === last), true) && !stepRound(A, R, B, hx, hz, lat, true) && R.stood > 6) {
              // THE LAST RESORT, counted: a ring nothing above has opened in six seconds. One of them goes
              R.pass = 3;
              R.passAt = R.m;
              if (audit) {
                audit.squeezes += 1;
                if (audit.examples.length < 160) audit.examples.push(`squeeze ${A.id} past ${B.id} at ${A.x.toFixed(1)}, ${A.z.toFixed(1)}: a ring of ${ring.length} held for ${R.stood.toFixed(0)} s, nowhere for any of them to step`);
              }
            }
          } else if (!giveWay(B, A) && !B.route && !replan(A, R)) stepRound(A, R, B, hx, hz, lat);
        }
      }
      // (a lean with nobody to wait for, a body of the crowd's or a thing, is let go a few metres on)
      if (R.aside && !R.asideFor && R.leanAt !== undefined && R.m - R.leanAt > (R.leanFor ?? 2)) [R.aside, R.leanAt, R.leanFor] = [null, undefined, undefined];
      // SOMETHING SOLID ON THE LINE that nothing else steps round: a post inside the lane's own corner arc, a piece
      // of the set standing on the lane by a corner (where the step aside for people is switched off), the edge of
      // one on a straight step. Seen a second ahead, the walker leans off it to the nearer clear side
      if (!R.aside && A.vc > 0.3 && (R.dodgeAt ?? -1) < R.m) {
        R.dodgeAt = R.m + 0.25;
        for (const u of [0.45 + A.vc * 0.2, 0.45 + A.vc * 0.5]) {
          if (R.d + u > R.len - 0.3) break;
          const q = poseOf(R, R.d + u, Q4);
          const [qx, qz, hx, hz] = [q[0] + R.wx + R.ox, q[2] + R.wz + R.oz, Math.sin(q[3]), Math.cos(q[3])];
          // (in it, or its edge within a hand of the line: then only a small lean to the other side)
          const [inL, inC, inR] = [-0.16, 0, 0.16].map(o => !!solidAt(qx + hz * o, q[1], qz - hx * o, true));
          if (!inL && !inC && !inR) continue;
          const tries = inC ? [0.4, -0.4, 0.65, -0.65, 0.9, -0.9] : inL && !inR ? [0.3] : inR && !inL ? [-0.3] : [];
          for (const off of tries) {
            const [vx, vz] = [hz * off, -hx * off];
            if (solidAt(qx + vx, q[1], qz + vz) || solidAt(A.x + vx, A.y, A.z + vz)) continue;
            if (PLAN.kerbOut(qx, qz) > 0 && PLAN.kerbOut(qx + vx, qz + vz) < PED.body) continue;
            [R.aside, R.asideFor, R.leanAt, R.leanFor] = [[R.wx + vx, R.wz + vz], null, R.m, u + 1.2];
            if (audit) audit.dodges += 1;
            break;
          }
          break;
        }
      }
      if (R.stood > THROUGH && !R.waited && audit) {
        R.waited = true;
        audit.waits += 1;
        if (audit.examples.length < 160) audit.examples.push(`wait ${A.id} behind ${R.blocker.id ?? 'a body'} at ${A.x.toFixed(1)}, ${A.z.toFixed(1)} (${R.blocker.route ? 'who is walking' : 'who stands'} at ${R.blocker.x?.toFixed(1)}, ${R.blocker.z?.toFixed(1)}${R.blocker.clipName ? ' in ' + R.blocker.clipName : ''}${R.blocker.firm ? ', in a scene' : ''}; ${R.part?.G ? 'on the lane' : 'on a step'}, ${(R.metres - R.m).toFixed(1)} m to go)`);
      } else if (!R.stood) R.waited = false;
    }
    // (never more than half a metre a second lost in one frame, however long the frame was: `drop`)
    A.vc = want >= A.vc ? Math.min(want, A.vc + (R.v > RUNS ? RUN_ACC : PED.acc) * dt) : Math.max(want, A.vc - Math.min(HARD * dt, drop));
    // a clip that goes with a pace (a run) plays only at that pace: the walk carries the body up to it and down
    // from it, so nobody runs on the spot while they gather speed
    if (R.clip && R.clipFrom) {
      // (once it is on it stays on down to a walk: a run that brakes for a corner or for somebody in its way is still
      // a run, and its clip is not dropped and taken up again a second later)
      const on = A.vc >= R.clipFrom - (R.clipOn ? 2 : 0);
      if (on !== R.clipOn) {
        R.clipOn = on;
        if (on) A.want = { name: R.clip, loop: true, t: 0, walk: true };
        else if (A.want?.name === R.clip) A.want = null;
      }
    }
    // (a walk too short for the speed its walker came to it with, an order given to someone at a run with a pace
    // or two to go, RUNS OUT past its end, straight on, braking as hard as a body does: it is never stopped dead)
    const stride = A.vc * dt;
    if (stride > R.metres - R.m && A.vc > 0.5) R.out = (R.out ?? 0) + stride - (R.metres - R.m);
    R.m = Math.min(R.metres, R.m + stride);
    R.d = lineAt(R, R.m, L4);
    // the ground: down off a kerb a moment early and up it a moment late, never in one frame and never floating
    const aheadY = poseOf(R, Math.min(R.len, R.d + Math.max(0.25, A.vc * 0.1)), Q4)[1];
    // (the geometry is asked for the height and for where on its edges the walker is; the place and the heading are
    // the walked line's)
    const p = poseOf(R, R.d, P4);
    [p[0], p[2], p[3]] = [L4[0], L4[2], L4[3]];
    weave(A, R, p[0], p[2], p[3], A.vc, dt);
    A.x = p[0] + R.wx + R.ox + (R.out ? Math.sin(p[3]) * R.out : 0);
    A.z = p[2] + R.wz + R.oz + (R.out ? Math.cos(p[3]) * R.out : 0);
    // (a step aside may be down off the kerb: the ground is the ground under the body)
    const y = Math.min(p[1], aheadY, R.wx || R.wz ? Math.min(groundAt(A.x, A.z), groundAt(A.x + Math.sin(p[3]) * 0.3, A.z + Math.cos(p[3]) * 0.3)) : Infinity);
    A.y += Math.max(-2.4 * dt, Math.min(2.4 * dt, y - A.y));
    // it faces the way it is really going: along its route, leaning into a step aside
    if (A.vc > 0.3) A.ry = Math.atan2(Math.sin(p[3]) * A.vc + R.wvx * Wyaw, Math.cos(p[3]) * A.vc + R.wvz * Wyaw);
    else if (R.wait > 0 || R.d < 0.05) A.ry = p[3];
    // at its mark. One last thing: a step aside still under way is finished first (never dropped in a frame)
    if (R.metres - R.m < 1e-3 && A.vc > 0.5) {
      // (running out: see above)
    } else if (R.metres - R.m < 1e-3 && Math.hypot(R.wvx, R.wvz) > 0.3 && (R.settle = (R.settle ?? 0) + dt) < 1.5) {
      R.aside = null;
      A.vc = 0;
    } else if (R.metres - R.m < 1e-3) {
      A.vc = 0;
      A.route = null;
      if (R.endYaw !== null) A.ry = R.endYaw;
      R.arrived = true;
      R.done = true;
    }
  }
  const Wyaw = MOVE.weave.yaw;

  /** Hands a walker a new route (the one it was on is over, unfinished). It keeps the speed it has. */
  function setRoute(A, R) {
    if (A.route) {
      A.route.done = true;
      // (it was stepping aside: the sideways speed it has is the new route's to wind down)
      [R.wvx, R.wvz] = [A.route.wvx, A.route.wvz];
      // (a run's clip goes with the route it was a run on)
      if (A.route.clip && A.route.clipFrom && A.want?.name === A.route.clip) A.want = null;
    }
    A.route = R;
    A.room = false;
  }

  // ── per frame: move our people, keep them on the near tier, answer the waits ────────────────────────────────────
  function moveFree(A, dt) {
    const w = A.w;
    if (A.route) {
      // (a long frame is walked in steps of a fiftieth of a second: a walker brakes on to its mark over them, it
      // does not reach it in one stride at speed)
      const n = Math.max(1, Math.ceil(dt / 0.021));
      if (A.yieldTo) {
        const [F, ring] = A.yieldTo;
        A.yieldTo = null;
        if (!A.yield && F.route) giveWay(A, F, ring);
      }
      A.stepping = true;
      for (let k = 0; k < n && A.route; k++) advance(A, A.route, dt / n, 0.5 / n);
      A.stepping = false;
    } else {
      A.vc = 0;
      // (standing: on the ground it stands on. A walk that ended a step off a kerb finishes stepping down)
      if (!A.room) A.y += Math.max(-2.4 * dt, Math.min(2.4 * dt, groundAt(A.x, A.z) - A.y));
    }
    A.moving = A.vc;
    if (A.faceTo) A.ry = Math.atan2(A.faceTo[0] - A.x, A.faceTo[1] - A.z);
    // (the walker's place is written both where the sim reads it, w.fix, and where the page draws it from, w.p: the
    // city refreshes w.p from w.fix only every other frame for a body far from the camera)
    w.fix[0] = w.p[0] = A.x;
    w.fix[1] = w.p[1] = A.y;
    w.fix[2] = w.p[2] = A.z;
    w.fix[3] = w.p[3] = A.ry;
    w.vc = A.vc;
    // (the stride of a body drawn small, far away: by the distance walked, as the sim counts its own walkers')
    w.ph += A.vc * dt * 3.1;
    if (A.snap) {
      w.yawS = A.ry;
      w.omega = 0;
      A.snap = false;
    }
  }

  // ── what the city's crowd is told about us ──────────────────────────────────────────────────────────────────────
  // Everyone of ours is on the city's body map already (a walker off the lanes is, where it stands). Two things more:
  // a body on the ground takes the room it lies in (the city's own footprints, stage/crowd.js FOOT), and a walker on
  // its way is a MOVER: the crowd is told where it will be for the next 1.6 s and steps aside (pedsim.js RIDERS
  // AVOID). The city's stage does both from inside its scene runner (crowd.js createRoom), which is not ours to run.
  const ON_BACK = /^(shove_fall|fall_back|lie_hurt|shot_hit$|get_up)/;
  const ON_SIDE = /^(death_collapse|lie_still|shot_hit_dead)/;
  function publish(A) {
    const w = A.w;
    if (w.hide || A.room || A.mode !== 'free') return;
    const name = A.clipName ?? '';
    const discs = ON_BACK.test(name) ? CROWD.FOOT.back : ON_SIDE.test(name) ? CROWD.FOOT.side : null;
    if (discs) {
      const yaw = w.yawS ?? A.ry;
      const [fx, fz, rx, rz] = [Math.sin(yaw), Math.cos(yaw), Math.cos(yaw), -Math.sin(yaw)];
      for (const [l, a, r] of discs) sim.bodies.push({ x: A.x + rx * l + fx * a, z: A.z + rz * l + fz * a, r, w, room: CROWD.FOOT.room });
    }
    const R = A.route;
    if (!R || A.vc < 0.3) return;
    const M = (A.mover ??= { w, x: 0, z: 0, hx: 0, hz: 1, v: 0, n: 0, ft: Float32Array.from(FT), fx: new Float32Array(FT.length * 2) });
    [M.x, M.z, M.hx, M.hz, M.v, M.n] = [A.x, A.z, Math.sin(A.ry), Math.cos(A.ry), A.vc, FT.length];
    for (let k = 0; k < FT.length; k++) {
      const q = poseOf(R, R.d + A.vc * FT[k], Q4);
      M.fx[2 * k] = q[0] + R.wx;
      M.fx[2 * k + 1] = q[2] + R.wz;
    }
    sim.movers.push(M);
  }

  function frame(frameDt) {
    // (a stalled page, a tab that was hidden: the stage's clock takes at most a tenth of a second a frame, as the
    // pedestrian sim does, so nobody covers metres in one frame)
    const realDt = Math.min(frameDt, 0.1);
    const dt = realDt * scale;
    clock += dt;
    for (const A of actors.values()) {
      const w = A.w;
      // (did the city draw this body last frame: on stage and in the camera's view? Read before the tier is set below)
      A.drawn = !!w.tier && !w.hide;
      if (A.yield) stepYield(A, dt);
      if (A.mode === 'free') moveFree(A, dt);
      else {
        // on the lanes the city walks it: we only read where it is
        A.x = w.p[0];
        A.y = w.p[1];
        A.z = w.p[2];
        A.ry = w.yawS ?? w.p[3];
      }
      A.metres += Math.hypot(A.x - A.lastX, A.z - A.lastZ);
      A.lastX = A.x;
      A.lastZ = A.z;
      // only near walkers run the gait, so only they play clips: ours go to the head of the list (the city's stage
      // does the same for a scene's actors), and the walker the batch then has no room for is a crowd walker
      const at = sim.walkers.indexOf(w);
      if (at > 0) {
        sim.walkers.splice(at, 1);
        sim.walkers.unshift(w);
      }
      if (!w.tier) w.tier = 1;
      if (performance.now() - A.nearAt > 400) for (const mesh of A.props.values()) mesh.visible = false;
    }
    const pushed = separate(dt);
    for (const A of actors.values()) publish(A);
    hideCrowd();
    placeMarker();
    if (audit) auditFrame(realDt, dt, pushed);
    for (const hook of hooks) hook(dt, realDt);
    for (const wait of [...waits]) {
      if (!wait.test()) continue;
      waits.delete(wait);
      wait.resolve();
    }
    placeBubbles();
  }

  // ── nobody stands inside anybody: the last resort ───────────────────────────────────────────────────────────────
  // Walkers keep off each other by themselves now (above), and everyone stands on a spot of their own. This is what
  // is left for the case nothing foresaw: two STANDING bodies of ours overlapping (closer than both radii) are eased
  // apart. The audit counts the frames it moves anybody (`pushes`); it should have nothing to do.
  const BODY = 2 * PED.body;
  // (?oldstage=1 switches the fixes of the "no intersecting people" pass off, to measure what they changed)
  const OLD = new URLSearchParams(location.search).has('oldstage');
  function separate(dt) {
    if (OLD) return false;
    let pushed = false;
    // (someone lying or sitting is never nudged, nor the halves of a two-person clip, nor anyone in a room)
    const list = [...actors.values()].filter(A => !A.w.hide && A.mode === 'free' && !A.route && !A.room && !A.paired && !LOW.has(A.clipName));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const A = list[i];
        const B = list[j];
        let dx = B.x - A.x;
        let dz = B.z - A.z;
        if (Math.abs(dx) > BODY || Math.abs(dz) > BODY) continue;
        let d = Math.hypot(dx, dz);
        if (d >= BODY) continue;
        const push = Math.min(BODY - d, 0.5 * dt) / 2;
        if (d < 0.01) {
          // exactly on one point: part them along a direction that is theirs alone
          dx = Math.cos(i * 2.4 + j);
          dz = Math.sin(i * 2.4 + j);
          d = 1;
        }
        if (push > 1e-5) pushed = `${A.id}|${B.id}`;
        A.x -= (dx / d) * push;
        A.z -= (dz / d) * push;
        B.x += (dx / d) * push;
        B.z += (dz / d) * push;
        for (const C of [A, B]) {
          C.w.fix[0] = C.w.p[0] = C.x;
          C.w.fix[2] = C.w.p[2] = C.z;
        }
      }
    }
    return pushed;
  }

  // ── the city's own crowd keeps off the set ──────────────────────────────────────────────────────────────────────
  // Our cast is the life of these sidewalks. The city's generic walkers know nothing of people who stand off their
  // lanes and walk straight through them, so inside the set's box they are not drawn (the city's own mark for a
  // walker that exists but is not shown). Outside it the street has its crowd as before.
  let keepOut = null;
  let crowdTick = 0;
  function hideCrowd() {
    if (OLD || !keepOut || ++crowdTick % 6) return;
    const [x0, z0, x1, z1] = keepOut;
    for (const w of sim.walkers) {
      if (w.hk2 || w.agent) continue;
      const inside = w.p[0] > x0 && w.p[0] < x1 && w.p[2] > z0 && w.p[2] < z1;
      if (inside !== !!w.hide) w.hide = inside;
    }
  }

  // ── the player's marker ─────────────────────────────────────────────────────────────────────────────────────────
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.86, 28), new THREE.MeshBasicMaterial({ color: 0xffd21a, toneMapped: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  ring.renderOrder = 3;
  ring.name = 'hk2:player-ring';
  city.scene.add(ring);
  let marked = null;
  function placeMarker() {
    const A = marked ? actors.get(marked) : null;
    ring.visible = !!A && !A.w.hide;
    if (!ring.visible) return;
    ring.position.set(A.w.p[0], A.w.p[1] + 0.04, A.w.p[2]);
    const pulse = 1 + 0.06 * Math.sin(performance.now() / 260);
    ring.scale.set(pulse, pulse, 1);
  }

  // ── solids: what nobody on foot may walk through ────────────────────────────────────────────────────────────────
  // Two sources. The CITY'S own collision world (camera/world.js, the one its camera rig keeps out of walls with):
  // every block's full-detail boxes as 0.25 m columns, so a wall, a parked car, a tree, a post and a bench all
  // count. And whatever the page ADDS to the scene that is in no block: the set's pieces, as a test the stage hands
  // in (addSolid; demo/stage/solids.js reads their footprint off the meshes themselves). A body is a ball at waist
  // height, 0.2 m round: over a kerb or a low step, under an awning.
  const solidTests = [];
  const WAIST = { x: 0, y: 0, z: 0 };
  /**
   * The name of the solid a body standing at (x, z) with its feet at `y` is in, or null. Two strengths. For
   * PLANNING a step (the default) the ball is the body: anything it touches is in the way, and since the city's
   * columns are 0.25 m wide that errs towards keeping clear. For the AUDIT (`sure`) only the body's own middle
   * counts for the city's solids: a walker whose middle is in a column that holds something at waist height is in
   * it beyond doubt, where a brush against a quarter-metre column proves nothing.
   */
  function solidAt(x, y, z, sure = false) {
    for (const test of solidTests) {
      const name = test(x, z);
      if (name) return name;
    }
    const W = city.cam?.world;
    if (!W?.ready?.(x, z)) return null;
    [WAIST.x, WAIST.y, WAIST.z] = [x, y + 0.9, z];
    if (sure) return W.inside(WAIST, W.STATIC) ? `a city solid ${W.topAt(x, z).toFixed(1)} m high` : null;
    const hit = W.overlap(WAIST, 0.2, W.STATIC);
    return hit && hit.kind !== 'ground' && hit.depth > 0.04 ? `a city solid ${W.topAt(x, z).toFixed(1)} m high` : null;
  }
  /**
   * Where a straight step from a to b ends: at b, or 30 cm short of the first solid on the way. THE LAST STEPS TO ANY
   * PLACE NEVER CROSS A SOLID: a place that turns out to be inside one (a point of the map behind a wall, a door's
   * far side) is walked up to, not into. Getting in is a cut, by whoever owns the room (director.js enter()).
   */
  function freeEnd(ax, az, bx, bz) {
    const len = Math.hypot(bx - ax, bz - az);
    for (let d = 0.3; d <= len; d += 0.15) {
      const [x, z] = [ax + ((bx - ax) * d) / len, az + ((bz - az) * d) / len];
      if (!solidAt(x, groundAt(x, z), z)) continue;
      const keep = Math.max(0, d - 0.3) / len;
      if (audit) audit.short += 1;
      return [ax + (bx - ax) * keep, az + (bz - az) * keep];
    }
    return [bx, bz];
  }
  /** Is the straight line between two points on the ground free of solids (asked every 15 cm, the first 30 cm apart: a body may be leaving a tight place)? */
  function lineFree(ax, az, bx, bz) {
    const len = Math.hypot(bx - ax, bz - az);
    for (let d = 0.3; d <= len; d += 0.15) {
      const [x, z] = [ax + ((bx - ax) * d) / len, az + ((bz - az) * d) / len];
      if (solidAt(x, groundAt(x, z), z)) return false;
    }
    return true;
  }

  /**
   * A WAY ROUND WHAT STANDS BETWEEN TWO POINTS OFF THE LANES: the points to walk through from a to b, b last, or null
   * when there is none within reach. The city's real places are yards, plazas and lots with things standing in them
   * (the night market's stalls, the trailers of Sunny Acres, the park's bandstand) and no walkers' lanes inside: the
   * straight step from the sidewalk to a standing spot, or from one spot to the next, goes through them. This looks
   * for the way a person would take: over a 0.4 m grid of the ground between the two (and `room` metres round them),
   * a cell being ground when a body standing on it touches nothing solid; the shortest such way, then pulled
   * straight wherever the straight line is free. (A roadway costs double: across it when there is no other way.)
   */
  const CELL = 0.4;
  function findWay(ax, az, bx, bz, room = 9) {
    const [x0, z0] = [Math.min(ax, bx) - room, Math.min(az, bz) - room];
    const [nx, nz] = [Math.ceil((Math.abs(bx - ax) + 2 * room) / CELL) + 1, Math.ceil((Math.abs(bz - az) + 2 * room) / CELL) + 1];
    if (nx * nz > 40000) return null;
    const cellOf = (x, z) => [Math.round((x - x0) / CELL), Math.round((z - z0) / CELL)];
    const at = (i, j) => [x0 + i * CELL, z0 + j * CELL];
    const kind = new Int8Array(nx * nz);
    // (0: not asked yet · 1: ground · 2: a roadway · 3: solid)
    const ask = (i, j) => {
      if (i < 0 || j < 0 || i >= nx || j >= nz) return 3;
      const k = i + j * nx;
      if (!kind[k]) {
        const [x, z] = at(i, j);
        kind[k] = solidAt(x, groundAt(x, z), z) ? 3 : onRoad(x, z) ? 2 : 1;
      }
      return kind[k];
    };
    const [si, sj] = cellOf(ax, az);
    const [ti, tj] = cellOf(bx, bz);
    // (the two ends are where people stand: ground, whatever a quarter-metre column beside them says)
    for (const [i, j] of [[si, sj], [ti, tj]]) if (i >= 0 && j >= 0 && i < nx && j < nz && ask(i, j) === 3) kind[i + j * nx] = 1;
    const g = new Float32Array(nx * nz).fill(Infinity);
    const from = new Int32Array(nx * nz).fill(-1);
    const open = [[Math.hypot(ti - si, tj - sj), si + sj * nx]];
    g[si + sj * nx] = 0;
    let found = false;
    for (let guard = 0; open.length && guard < 30000; guard++) {
      // (a plain scan for the best: a few hundred cells are open at most)
      let b = 0;
      for (let k = 1; k < open.length; k++) if (open[k][0] < open[b][0]) b = k;
      const [, c] = open.splice(b, 1)[0];
      const [ci, cj] = [c % nx, Math.floor(c / nx)];
      if (ci === ti && cj === tj) {
        found = true;
        break;
      }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const [i, j] = [ci + di, cj + dj];
        const k = ask(i, j);
        if (k === 3) continue;
        // (never cutting a corner of something solid)
        if (di && dj && (ask(ci + di, cj) === 3 || ask(ci, cj + dj) === 3)) continue;
        const cost = g[c] + Math.hypot(di, dj) * (k === 2 ? 2 : 1);
        const n = i + j * nx;
        if (cost >= g[n]) continue;
        g[n] = cost;
        from[n] = c;
        open.push([cost + Math.hypot(ti - i, tj - j), n]);
      }
    }
    if (!found) return null;
    const cells = [];
    for (let c = ti + tj * nx; c !== -1; c = from[c]) cells.unshift(at(c % nx, Math.floor(c / nx)));
    cells[0] = [ax, az];
    cells[cells.length - 1] = [bx, bz];
    // pulled straight: from each point, the furthest later one the straight line to which is free (asked of the
    // grid's own cells, which are known by now: a line is free when every cell it passes over is ground)
    const gridFree = (p, q) => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      for (let d = 0.2; d < len; d += 0.2) {
        const [i, j] = cellOf(p[0] + ((q[0] - p[0]) * d) / len, p[1] + ((q[1] - p[1]) * d) / len);
        if (ask(i, j) === 3) return false;
      }
      return true;
    };
    // (and of the collision world itself along the line, as a straight step is checked (freeEnd): a lamp post or a
    // stall's pole is one quarter-metre column, and a 0.4 m cell whose middle is ground holds it. A way pulled
    // straight through one ended short at it, the walker standing a metre and a half from their spot with the post
    // between. The last 0.45 m are the spot's own: a place to lean is 0.2 m off its wall)
    const thinFree = (p, q) => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      for (let d = 0.3; d <= len - 0.45; d += 0.15) {
        const [x, z] = [p[0] + ((q[0] - p[0]) * d) / len, p[1] + ((q[1] - p[1]) * d) / len];
        if (solidAt(x, groundAt(x, z), z)) return false;
      }
      return true;
    };
    const out = [];
    for (let k = 0; k < cells.length - 1; ) {
      let far = k + 1;
      for (let m = Math.min(cells.length - 1, k + 60); m > k + 1; m--) {
        if (gridFree(cells[k], cells[m]) && thinFree(cells[k], cells[m])) {
          far = m;
          break;
        }
      }
      out.push(cells[far]);
      k = far;
    }
    return out;
  }
  /** The straight steps from a to b as parts of a route: one when the line is free, else by the way round (findWay). */
  function stepsBetween(ax, az, bx, bz) {
    if (Math.hypot(bx - ax, bz - az) < 0.6 || lineFree(ax, az, bx, bz)) return { parts: [{ line: [ax, az, bx, bz] }], end: [bx, bz] };
    const way = findWay(ax, az, bx, bz);
    if (!way) {
      const [ex, ez] = freeEnd(ax, az, bx, bz);
      return { parts: [{ line: [ax, az, ex, ez] }], end: [ex, ez] };
    }
    if (audit) audit.ways += 1;
    const parts = [];
    let [px, pz] = [ax, az];
    for (const [qx, qz] of way) {
      parts.push({ line: [px, pz, qx, qz] });
      [px, pz] = [qx, qz];
    }
    return { parts, end: [bx, bz] };
  }

  // ── the audit: what jitters, what flickers, who stands in whom ──────────────────────────────────────────────────
  // Counted every frame while it is on (demo/tools/stage-run.mjs --audit). A count means nothing without proof that
  // the thing counted still happened, so the first two are that proof:
  //   scenes  scene starts (the director reports them) · walks  walkTo() calls that arrived · steps  stepTo() the same
  //   jumps   an actor more than 0.5 m from where it was a frame ago, without having been placed there on purpose
  //           (on a long frame: further than a run at 6.5 m/s covers in it. A runner on a slow frame is not a jump)
  //   cuts    the same, on purpose (through a door, into a room, a skipped hour)
  //   shifts  the same, where a clip that ends a step away hands that step to the walker (the body stays put)
  //   flips   a second in which one actor changed clip more than twice
  //   close   a pair of actors nearer than 0.6 m for more than half a second (each spell counted once)
  //   slides  frames in which an actor moved more than 3 cm while in a lying or sitting clip
  //   speedSteps    frames in which a person's speed changed by more than 0.6 m/s (on a long frame: by more than
  //                 6 m/s² explains. The stage's own seconds)
  //   headingSnaps  frames in which a drawn person's drawn heading (the walker's yawS) turned more than 25 degrees
  //   floating      frames a person over a roadway is more than 3 cm above the road (not in a room, which has its floor)
  //   inRoad        spells of more than 2 s standing still on a roadway or a zebra (each spell counted once)
  //   pushes        frames in which separate() moved anybody
  //   squeezes      times a walker, held up for 2 s behind someone it could not get round, walked through them
  //   seams         places where a route's geometry breaks by more than 20 cm (counted when the route is made)
  //   through       frames in which somebody moving on foot is inside a solid (solidAt above). People put in a room
  //                 are not walking and do not count. `blind`: frames a walker was where the city's solids were not
  //                 loaded, so nothing could be said. `short`: straight steps cut short because a solid stood on them
  // Everyone on stage is counted, in the camera's view or not; the heading alone is counted only for a body the
  // city drew this frame and the last (its own tier: nobody else is being turned). A declared cut (place(), show())
  // excuses that frame and the next for speed and heading: the drawn heading follows a frame behind.
  /** Is this point on a carriageway or a junction box (the city's plan: 0 m off the road surface)? */
  const onRoad = (x, z) => PLAN.kerbOut(x, z) <= 0;
  const turnOf = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  let audit = null;
  function auditFrame(realDt, dt, pushed) {
    audit.frames += 1;
    const now = performance.now();
    const list = [...actors.values()].filter(A => !A.w.hide);
    const note = text => {
      // (a few of each kind: one busy kind must not crowd the others out)
      const kind = text.slice(0, text.indexOf(' '));
      audit.kinds[kind] = (audit.kinds[kind] ?? 0) + 1;
      if (audit.kinds[kind] <= 8) audit.examples.push(text);
    };
    if (pushed) {
      audit.pushes += 1;
      if (pushed !== audit.lastPush) {
        const [a, b] = pushed.split('|').map(id => actors.get(id));
        note(`push ${pushed} at ${a.x.toFixed(1)}, ${a.z.toFixed(1)}${a.clipName ? ' ' + a.clipName : ''}${b.clipName ? ' / ' + b.clipName : ''}`);
      }
    }
    audit.lastPush = pushed || audit.lastPush;
    for (const A of list) {
      // speed, ground and standing in the road: everyone on stage, in the camera's view or not. The heading: only a
      // body the city drew this frame and the last (it turns nobody else: one that comes into view takes its heading)
      const drawn = A.drawn;
      const excused = A.cut || A.shifted || A.cutLast;
      const speed = A.ax !== undefined && dt > 1e-4 ? Math.hypot(A.x - A.ax, A.z - A.az) / dt : null;
      const yaw = A.w.yawS ?? A.ry;
      if (!excused && dt > 1e-4) {
        if (speed !== null && A.aSpeed !== null && A.aSpeed !== undefined && Math.abs(speed - A.aSpeed) > Math.max(0.6, 6 * dt)) {
          audit.speedSteps += 1;
          const Rn = A.route ?? A.aRoute;
          note(`speed ${A.id} ${A.aSpeed.toFixed(1)} → ${speed.toFixed(1)} m/s (${A.route === A.aRoute ? (A.route ? 'on its way' : 'standing') : A.route ? 'a new order' : 'its way ended'}${A.clipName ? ', ' + A.clipName : ''}${Rn ? `; ${Rn.m.toFixed(2)} of ${Rn.metres.toFixed(2)} m, vc ${A.vc.toFixed(2)}, parts ${Rn.parts.map(q => (q.G ? 'lane ' : 'step ') + q.len.toFixed(1)).join('+')}, joins ${Rn.joins.length}, off ${Math.hypot(Rn.wx, Rn.wz).toFixed(2)}${Rn.aside ? ' aside' : ''}${Rn.plans ? ' replanned' : ''}${A.yield ? ' yielding' : ''}` : ''}${A.faceTo ? ', facing a point' : ''})`);
        }
        if (drawn && A.wasDrawn && A.aYaw !== undefined && turnOf(yaw, A.aYaw) > (25 * Math.PI) / 180) {
          audit.headingSnaps += 1;
          note(`turn ${A.id} ${((turnOf(yaw, A.aYaw) * 180) / Math.PI).toFixed(0)}°`);
        }
      }
      // on foot and inside something solid
      // (not the last steps to a spot's own lean point, 0.2 m off its wall by the city's own measure: the wall's
      // quarter-metre column holds that point, and the body is not in the wall)
      if (!A.room && A.mode === 'free' && speed !== null && speed > 0.1 && !excused && !(A.route?.exact && A.route.metres - A.route.m < 0.45)) {
        const name = solidAt(A.x, A.y, A.z, true);
        if (name) {
          audit.through += 1;
          if (!A.inSolid) note(`through ${A.id} in ${name} at ${A.x.toFixed(1)}, ${A.z.toFixed(1)}${A.route ? (A.route.part?.G ? ' (on the lane)' : ' (on a straight step)') : ''}`);
        } else if (city.cam?.world && !city.cam.world.ready(A.x, A.z)) audit.blind += 1;
        A.inSolid = !!name;
      } else A.inSolid = false;
      // a furniture clip on bare ground: sitting on air, leaning on nothing, a work bench that is not there
      if (FURNITURE[A.clipName] && (A.clipW ?? 0) > 0.3 && !seatedIn(A, A.clipName)) {
        audit.unseated += 1;
        if (A.unseatNoted !== A.clipName) note(`unseated ${A.id} in ${A.clipName} at ${A.x.toFixed(1)}, ${A.z.toFixed(1)}: ${FURNITURE[A.clipName] === 'room' ? 'not indoors' : A.stand ? `its spot is ${A.stand.kind}${A.stand[FURNITURE[A.clipName]] ? ', and the point is ' + Math.hypot(A.x - A.stand[FURNITURE[A.clipName]][0], A.z - A.stand[FURNITURE[A.clipName]][1]).toFixed(2) + ' m off' : ''}` : 'on no spot'}`);
        A.unseatNoted = A.clipName;
      } else A.unseatNoted = null;
      const road = !A.room && onRoad(A.x, A.z);
      if (road && A.y > 0.03 && !LOW.has(A.clipName)) {
        audit.floating += 1;
        if (!A.floatNoted) note(`float ${A.id} ${A.y.toFixed(2)} m over the road at ${A.x.toFixed(1)}, ${A.z.toFixed(1)}`);
        A.floatNoted = true;
      } else A.floatNoted = false;
      if (road && speed !== null && speed < 0.05) {
        const t = (A.roadT ?? 0) + realDt;
        if (t > 2 && (A.roadT ?? 0) <= 2) {
          audit.inRoad += 1;
          note(`road ${A.id} stands at ${A.x.toFixed(1)}, ${A.z.toFixed(1)}`);
        }
        A.roadT = t;
      } else A.roadT = 0;
      A.cutLast = A.cut;
      A.aRoute = A.route;
      A.aSpeed = excused ? null : speed;
      A.aYaw = yaw;
      A.wasDrawn = drawn;
      if (A.ax !== undefined && Math.hypot(A.x - A.ax, A.z - A.az) > Math.max(0.5, 6.5 * dt + 0.15)) {
        if (A.cut) audit.cuts += 1;
        else if (A.shifted) audit.shifts += 1;
        else {
          audit.jumps += 1;
          note(`jump ${A.id} ${Math.hypot(A.x - A.ax, A.z - A.az).toFixed(1)} m at ${A.x.toFixed(1)}, ${A.z.toFixed(1)} (${A.route === A.aRoute ? (A.route ? 'on its way' : 'standing') : A.route ? 'a new order' : 'its way ended'}${A.clipName ? ', ' + A.clipName : ''}${A.mode !== 'free' ? ', on the sim\'s lane' : ''})`);
        }
      }
      // travelling while down or seated: more than 3 cm in a frame in a lying or sitting clip
      else if (A.ax !== undefined && LOW.has(A.clipName) && Math.hypot(A.x - A.ax, A.z - A.az) > 0.03 && !A.cut && !A.shifted) {
        audit.slides += 1;
        note(`slide ${A.id} in ${A.clipName}`);
      }
      A.cut = false;
      A.shifted = false;
      A.ax = A.x;
      A.az = A.z;
      if (A.clipName !== A.auditClip) {
        A.auditClip = A.clipName;
        A.clipTimes = (A.clipTimes ?? []).filter(t => now - t < 1000);
        A.clipTimes.push(now);
        A.clipSeq = [...(A.clipSeq ?? []).slice(-5), `${A.clipName ?? 'none'}@${(now / 1000).toFixed(2)}`];
        if (A.clipTimes.length > 2 && now - (A.flipAt ?? 0) > 1000) {
          A.flipAt = now;
          audit.flips += 1;
          audit.kinds.flip = (audit.kinds.flip ?? 0) + 1;
          if (audit.kinds.flip <= 40) audit.examples.push(`flip ${A.id}: ${A.clipSeq.join(' → ')} (rate ${A.rate})`);
        }
      }
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const A = list[i];
        const B = list[j];
        // (the two halves of a two-person clip touch on purpose: a grab, a cuffing, a hand-off)
        if (Math.abs(A.y - B.y) > 0.3 || (A.paired && B.paired)) continue;
        const key = `${A.id}|${B.id}`;
        if (Math.hypot(A.x - B.x, A.z - B.z) < 0.6) {
          const t = (audit.near.get(key) ?? 0) + realDt;
          if (t > 0.5 && (audit.near.get(key) ?? 0) <= 0.5) {
            audit.close += 1;
            const how = C => `${C.clipName ?? '-'}${C.route ? ` walking ${C.vc.toFixed(1)} m/s, ${(C.route.metres - C.route.m).toFixed(1)} m to go${C.route.pass ? ', passing' : ''}${C.route.blocker ? ', blocked by ' + (C.route.blocker.id ?? 'a body') : ''}` : ' standing'}${C.firm ? ', in a scene' : ''}${C.yield ? ', making way' : ''}`;
            note(`close ${key} at ${A.x.toFixed(1)}, ${A.z.toFixed(1)}${A.room || B.room ? ' in a room' : ''}${A.route || B.route ? ' walking' : ''} ${how(A)} / ${how(B)}`);
          }
          audit.near.set(key, t);
        } else if (audit.near.has(key)) audit.near.delete(key);
      }
    }
  }

  const driver0 = peds.driver;
  peds.driver = (t, dt, ...rest) => {
    if (driver0) driver0(t, dt, ...rest);
    frame(dt);
  };

  // ── speech bubbles: page elements that follow a head (the method of the city's own record player) ───────────────
  const style = document.createElement('style');
  style.textContent = `
    .hk2-bubbles { position: fixed; inset: 0; pointer-events: none; z-index: 12; overflow: hidden; }
    .hk2-bubble { position: absolute; left: 0; top: 0; max-width: 260px; padding: 7px 11px 8px; border-radius: 12px; background: #fffdf6; color: #14161c;
      font: 600 15px/1.25 system-ui, -apple-system, sans-serif; box-shadow: 0 2px 10px rgba(0, 0, 0, .35); transform: translate(-50%, -100%); }
    .hk2-bubble::after { content: ''; position: absolute; left: 50%; bottom: -7px; margin-left: -7px; border: 7px solid transparent; border-bottom: 0; border-top-color: #fffdf6; }
    .hk2-bubble b { display: block; font: 700 11px/1.2 system-ui, sans-serif; color: #7a5a12; letter-spacing: .04em; margin-bottom: 2px; text-transform: uppercase; }
    .hk2-tag { position: absolute; left: 0; top: 0; padding: 2px 6px 1px; background: rgba(23, 23, 27, .86); color: #ffc21a;
      font: 800 11px/1.3 "Arial Black", Impact, sans-serif; text-transform: uppercase; letter-spacing: .03em; transform: translate(-50%, -100%); white-space: nowrap; }`;
  document.head.append(style);
  const layer = document.createElement('div');
  layer.className = 'hk2-bubbles';
  document.body.append(layer);
  let tagsOn = false;

  function place(el, A, lift) {
    V.set(A.w.p[0], A.w.p[1] + lift, A.w.p[2]).project(city.camera);
    const behind = V.z > 1 || Math.abs(V.x) > 1.2 || Math.abs(V.y) > 1.2;
    el.style.display = behind ? 'none' : '';
    if (behind) return;
    const x = (V.x * 0.5 + 0.5) * innerWidth;
    const y = (-V.y * 0.5 + 0.5) * innerHeight;
    el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
  function placeBubbles() {
    city.camera.updateMatrixWorld();
    for (const A of actors.values()) {
      if (A.bubble) {
        if (clock >= A.bubble.until) {
          A.bubble.el.remove();
          A.bubble = null;
        } else place(A.bubble.el, A, HEAD + 0.25);
      }
      if (A.tag) {
        const on = (tagsOn || A.tagged) && !A.bubble;
        A.tag.style.visibility = on ? '' : 'hidden';
        if (on) place(A.tag, A, HEAD);
      }
    }
  }

  // ── the api ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const get = id => {
    const A = actors.get(id);
    if (!A) throw new Error(`actors: nobody called ${id}`);
    return A;
  };

  /** The world point of a lane point { E, s } (the sim's own `where`, on a stand-in). */
  function laneXZ(L) {
    const p = sim.where({ E: L.E, s: L.s, p: [0, 0, 0, 0] });
    return [p[0], p[2]];
  }
  /** The same lane point on its sidewalk's NODE LINE, where the city's geometry looks paths up (movement.js geomOf). */
  const nodeXZ = L => [L.E.from.x + ((L.E.to.x - L.E.from.x) * L.s) / L.E.len, L.E.from.z + ((L.E.to.z - L.E.from.z) * L.s) / L.E.len];

  /**
   * A lane point { E, s } from what names one: a standing spot's entry as the city's stand-spot data writes it
   * ({ i, j, side, u }: the block, its side, the metres along it), or a lane point itself. Null when there is none.
   */
  const sideEdges = new Map();
  function lanePoint(entry) {
    if (!entry) return null;
    if (entry.E) return entry;
    if (!sideEdges.size) for (const E of sim.edges) if (!E.cross && !E.joint) sideEdges.set(`${E.i},${E.j},${E.side}`, E);
    const E = sideEdges.get(`${entry.i},${entry.j},${entry.side}`);
    if (!E || E.off) return null;
    const from = sim.sideU(E, 0);
    const s = ((entry.u - from) / (sim.sideU(E, E.len) - from)) * E.len;
    return s > 0.05 && s < E.len - 0.05 ? { E, s } : null;
  }
  /**
   * The nearest lane point to a spot: the side the pedestrian sim finds (laneNear), and the point of it straight
   * across from the spot. (laneNear's own point keeps 2.1 m from a corner, which sends a walker standing nearer the
   * corner than that back up the sidewalk before it sets off.)
   */
  function nearLane(x, z) {
    const E = sim.laneNear(x, z, 14)?.E;
    if (!E) return null;
    const along = ((x - E.from.x) * (E.to.x - E.from.x) + (z - E.from.z) * (E.to.z - E.from.z)) / E.len;
    return { E, s: Math.max(0.3, Math.min(E.len - 0.3, along)) };
  }

  /**
   * The shortest way from one lane point to another over the sim's own sidewalks and crossings, walked in either
   * direction: the points of it on the node lines, first and last included, which the city's geometry turns into
   * lanes (geomOf). Null when there is no way.
   */
  let links = null;
  function wayBetween(a, b) {
    if (!links) {
      links = new Map();
      const link = (n, m, len) => {
        if (!links.has(n)) links.set(n, []);
        links.get(n).push([m, len]);
      };
      for (const E of sim.edges) {
        if (E.off) continue;
        link(E.from, E.to, E.len);
        link(E.to, E.from, E.len);
      }
    }
    const at = n => [n.x0 ?? n.x, n.z0 ?? n.z];
    const direct = a.E === b.E ? Math.abs(a.s - b.s) : Infinity;
    // (a plain scan for the nearest open node: a walk on the set is a few corners long)
    const dist = new Map([[a.E.from, a.s], [a.E.to, a.E.len - a.s]]);
    const prev = new Map();
    const open = new Set(dist.keys());
    const done = new Set();
    const ends = [[b.E.from, b.s], [b.E.to, b.E.len - b.s]];
    let best = direct;
    let last = null;
    while (open.size) {
      let n = null;
      for (const o of open) if (!n || dist.get(o) < dist.get(n)) n = o;
      open.delete(n);
      done.add(n);
      const d = dist.get(n);
      if (d >= best || d > 400) break;
      for (const [end, more] of ends) {
        if (end === n && d + more < best) {
          best = d + more;
          last = n;
        }
      }
      for (const [m, len] of links.get(n) ?? []) {
        if (done.has(m) || d + len >= (dist.get(m) ?? Infinity)) continue;
        dist.set(m, d + len);
        prev.set(m, n);
        open.add(m);
      }
    }
    if (best === Infinity) return null;
    const mid = [];
    for (let n = last; n; n = prev.get(n)) mid.unshift(at(n));
    return { metres: best, path: [nodeXZ(a), ...mid, nodeXZ(b)] };
  }

  // the city's trip planner over its exported walk graph (1 MB of data, fetched on the first walk)
  let travelling = null;
  const travel = () => (travelling ??= Promise.all([
    import(new URL('../../world/export/travel.mjs', CITY).href),
    fetch(new URL('../../world/export/world.json', CITY)).then(r => r.json()),
  ]).then(([T, world]) => T.createTravel(world)));

  /**
   * The walk from a to b as the trip planner sees it, in whichever direction is shorter. The planner's crosswalks
   * are one-way, so the "back" way over a street can go round three crossings; a person crosses a crosswalk either
   * way, so the reverse trip walked backwards is as good a path. → { metres, seconds, path } or null.
   */
  async function tripBetween(ax, az, bx, bz) {
    const T = await travel();
    const there = T.trip([ax, az], [bx, bz], 'walk', { dep: 0 });
    const back = T.trip([bx, bz], [ax, az], 'walk', { dep: 0 });
    const pathOf = t => t?.legs?.[0]?.path ?? null;
    const pick = back && pathOf(back) && (!there || !pathOf(there) || back.metres < there.metres - 0.5) ? { trip: back, path: pathOf(back).slice().reverse() } : there && pathOf(there) ? { trip: there, path: pathOf(there) } : null;
    return pick ? { metres: pick.trip.metres, seconds: pick.trip.seconds, path: pick.path } : null;
  }

  /** Metres on the crowd's ONE-WAY lanes from one point to another (null: no way), without walking it. */
  function routeMetres(ax, az, bx, bz) {
    const from = sim.laneNear(ax, az);
    const to = sim.laneNear(bx, bz);
    const way = from && to ? sim.wayTo(from.E, from.s, to) : null;
    if (!way) return null;
    let metres = from.d + to.d;
    if (!way.length) return metres + (to.s - from.s);
    metres += from.E.len - from.s;
    for (const E of way.slice(0, -1)) metres += E.len;
    return metres + to.s;
  }

  /**
   * The route from where an actor stands to (x, z): off its spot on to the lane, along the lanes, and off them again
   * to the place. Null when no sidewalk leads there.
   *
   * THE STEP ON TO THE LANE AND OFF IT. A standing spot's ENTRY is the lane point straight across from it, checked
   * clear when the spot was made (`entry` names the one of the place it is going to; with none, the nearest lane
   * point). A person does not walk square on to a sidewalk and turn: where a slanting step to a lane point a metre
   * or two along the way is clear, that is the step taken, at each end. Clear means: nobody of ours standing on
   * it, and inside the strip of the sidewalk a body can use all the way (the city's room table). The straight one
   * is the fallback, and when somebody stands on that too the walker waits its turn on it (advance(): STUCK).
   */
  const SLANTS = [0, 1.3, -1.3, 2.6, -2.6, 3.9, -3.9];
  function routeTo(A, x, z, entry) {
    const onSpot = A.stand && Math.hypot(A.x - A.stand.x, A.z - A.stand.z) < 0.5;
    const first = (onSpot && A.stand.entry) || nearLane(A.x, A.z);
    const last = lanePoint(entry) ?? nearLane(x, z);
    if (!first || !last) return null;
    const pick = (near, px, pz, wayOf) => {
      let [best, at, way] = [Infinity, near, null];
      for (const k of SLANTS) {
        const L = k ? { E: near.E, s: near.s + k } : near;
        if (L.s < 0.4 || L.s > L.E.len - 0.4 || !stepClear(px, pz, L, !!k, A)) continue;
        const W = wayOf(L);
        const [lx, lz] = laneXZ(L);
        let total = W ? W.metres + Math.hypot(lx - px, lz - pz) : Infinity;
        // (a step that doubles back against the way the walk then goes is a hairpin on the lane: three metres' worth
        // of worse than one that goes with it)
        if (W && W.path.length > 1 && k) {
          const [a, b] = wayOf === fromWay ? [W.path[0], W.path[1]] : [W.path[W.path.length - 1], W.path[W.path.length - 2]];
          const [tx, tz, sx, sz] = [b[0] - a[0], b[1] - a[1], lx - px, lz - pz];
          if ((tx * sx + tz * sz) / ((Math.hypot(tx, tz) || 1) * (Math.hypot(sx, sz) || 1)) < -0.5) total += 3;
        }
        if (total < best) [best, at, way] = [total, L, W];
      }
      return [at, way ?? wayOf(near)];
    };
    const fromWay = L => wayBetween(L, last);
    const [from] = pick(first, A.x, A.z, fromWay);
    const [to, way] = pick(last, x, z, L => wayBetween(from, L));
    if (!way) return null;
    const [ax, az] = laneXZ(from);
    const [bx, bz] = laneXZ(to);
    // (a pace of lane between the step on to it and the step off it is a kink, not a walk: where the two places are
    // that near on one sidewalk and nothing solid stands between them, the way is the straight step)
    if (way.metres < 0.9 && Math.hypot(x - A.x, z - A.z) < 6 && lineFree(A.x, A.z, x, z)) return makeRoute([{ line: [A.x, A.z, x, z] }]);
    // (the steps on to the lane and off it go ROUND whatever stands between the lane and the place: a stall, a
    // trailer, a planter. Only when there is no way round do the last steps stop short of the solid)
    const [gx, gz] = [x, z];
    const on = stepsBetween(A.x, A.z, ax, az);
    const off = stepsBetween(bx, bz, x, z);
    [x, z] = off.end;
    let R = makeRoute([...on.parts, { path: way.metres > 0.05 ? way.path : null }, ...off.parts]);
    // (THE LANES' GEOMETRY BROKEN BY A METRE OR MORE on this stretch: not walked. The way is found over the ground
    // instead, round whatever stands on it, when the two ends are near enough for that)
    if (R && R.seam > 1 && Math.hypot(gx - A.x, gz - A.z) < 60) {
      const ground = stepsBetween(A.x, A.z, gx, gz);
      const R2 = makeRoute(ground.parts);
      if (R2 && !(R2.seam > 1)) R = R2;
    }
    // (someone standing a hair off the lane's own line: no step on to it is laid, under 3 cm, and the walk takes
    // that hair with it instead of the body hopping it in its first frame)
    if (R && Math.hypot(A.x - R.X[0], A.z - R.Z[0]) < 0.08) [R.ox, R.oz] = [A.x - R.X[0], A.z - R.Z[0]];
    return R;
  }
  /**
   * Is the straight step between a point and a lane point clear of everyone of ours who is standing (`except`
   * apart)? `strip`: and does every part of it lie inside the strip of the sidewalk a body can use (the city's room
   * table, asked every 20 cm)? A spot's own straight step was checked when the spot was made; a slanting one, or a
   * step between two places on one sidewalk, has to be asked.
   */
  function stepClear(px, pz, L, strip, except = null, bx = null, bz = null) {
    const [lx, lz] = bx === null ? laneXZ(L) : [bx, bz];
    const dx = lx - px;
    const dz = lz - pz;
    const len2 = dx * dx + dz * dz || 1e-9;
    for (const B of actors.values()) {
      if (B === except || B.w.hide || B.mode !== 'free' || B.vc > 0.3 || except?.pass === B) continue;
      const k = Math.max(0, Math.min(1, ((B.x - px) * dx + (B.z - pz) * dz) / len2));
      if (Math.hypot(px + dx * k - B.x, pz + dz * k - B.z) < MOVE.weave.sep) return false;
    }
    // (nor through anything solid: the city's, or a piece of the set, which no table of the city's knows)
    if (!lineFree(px, pz, lx, lz)) return false;
    if (!strip) return true;
    const E = L.E;
    const [ax, az] = SIDE_AXIS[E.side];
    const along = (x, z) => sim.sideU(E, Math.max(0, Math.min(E.len, ((x - E.from.x) * (E.to.x - E.from.x) + (z - E.from.z) * (E.to.z - E.from.z)) / E.len)));
    // (how far from the curb a point is: the lane's own distance there, and the point's place across from it)
    const [nx, nz] = laneXZ(L);
    const fromCurb = (x, z) => sim.laneC(E, sim.sideU(E, L.s)) + (x - nx) * ax + (z - nz) * az;
    const n = Math.max(2, Math.ceil(Math.sqrt(len2) / 0.2));
    for (let k = 1; k <= n; k++) {
      const [x, z] = [px + (dx * k) / n, pz + (dz * k) / n];
      const u = along(x, z);
      const room = sim.roomSpan(E, u, u, RS);
      if (!room) return false;
      const c = fromCurb(x, z);
      if (c < room[0] - 0.05 || c > room[1] + 0.05) return false;
    }
    return true;
  }

  /**
   * NOBODY TRAVELS ON THEIR BACK, and nobody is snapped upright either (the owner saw a man cross the street lying
   * down; the fix for that dropped the clip in one frame, which was a pop). Before a body sets off, what it is held
   * in is ended the way the city ends it:
   *   · on its back (lie_hurt, or a fall on its way there): get_up, at lie_hurt's 2 s wrap (the declared seam;
   *     stage/vignettes.js getUp), played to its end: it rises over its feet and the clip's own step forward is taken;
   *   · sitting, cowering, cuffed and standing, any standing clip: blended out to the stand (its own blendOut);
   *   · a clip that travels (a run, a limp) or the very clip the walk is made with: nothing to wait for.
   * Resolves true when the body may move, false when another order came meanwhile. A body the city is not drawing
   * has no clip running at all: it is cleared at once, unseen.
   */
  function upright(A, mine, over) {
    const g = () => A.w.g?.clip ?? null;
    // (what is on the body, one that is already blending OUT too: a clip stopped a frame ago is still all there,
    // and a body sent off that frame went with it, seated, for half a second)
    const held = g() ? g().name : A.want?.name ?? null;
    if (!held || held === over) return true;
    const c = CLIPS.CLIP[held];
    if (!c || (c.moving && !LOW.has(held))) return true;
    // (as good as gone: under the switch weight, and not one a body is down or seated in, which goes all the way)
    const faded = () => !g() || (g().out && g().w <= (LOW.has(g().name) ? 0.02 : SWITCH_AT));
    if (faded() && !A.want) return true;
    // (cuffed and standing into the cuffed walk: one pose family, switched straight)
    if (over && seamFor(c, over) && !seamFor(c, over).P) return true;
    const gone = () => A.goId !== mine || !A.drawn;
    return (async () => {
      const t0 = clock;
      if ((leadsTo(c, 'lie_hurt') && !g()?.out) || held === 'get_up') {
        // up at the seam, and on its feet when get_up has run out (it ends in the plain stand, a step ahead)
        const up = held === 'get_up' ? A.want : { name: 'get_up', t: 0, began: null };
        A.want = up;
        await until(() => gone() || A.want !== up || (g()?.name === 'get_up' && g().out) || clock - t0 > 2.4 + CLIPS.CLIP.get_up.dur + 1);
        if (A.want === up) A.want = null;
      } else {
        A.want = null;
        await until(() => gone() || faded() || clock - t0 > 1.6);
      }
      if (A.goId !== mine) return false;
      if (!A.drawn && g()) {
        // (unseen: nothing is running it, and nobody sees it go)
        CLIPS.clearClip(A.w.g);
        A.want = A.asked = null;
        A.clipName = null;
      }
      return true;
    })();
  }
  const overOf = clip => (clip && CLIPS.CLIP[clip] ? clip : null);

  /**
   * Sets an actor off along a route and waits for the end of it. The body is fit to travel by now (upright() above:
   * the callers wait for it before they lay the route). A hurt or cuffed person walks with the clip the caller names
   * for it (walk_hurt, cuffed_walk). → true on arrival, false when another order took its place.
   */
  async function follow(A, R, mine, { v, clip = null, clipFrom = 0, yaw = null, count = null }) {
    const over = overOf(clip);
    // (`clipFrom`: the clip belongs to a pace, a run, and waits for the body to reach it: advance() above)
    if (over && !clipFrom) A.want = { name: over, loop: true, t: 0, walk: true };
    Object.assign(R, { v, endYaw: yaw, clip: over, clipFrom: over ? clipFrom : 0, clipOn: false });
    setRoute(A, R);
    await until(() => A.goId !== mine || R.done);
    if (over && A.want?.name === over) A.want = null;
    const arrived = A.goId === mine && R.arrived;
    if (arrived && count) api.count(count);
    return arrived;
  }

  function clearNear(A, x, z) {
    const taken = (px, pz) => {
      for (const B of actors.values()) {
        if (B === A || B.w.hide || B.room) continue;
        if (Math.hypot(B.x - px, B.z - pz) < 0.75) return true;
        if (B.route && Math.hypot(endOf(B.route)[0] - px, endOf(B.route)[1] - pz) < 0.75) return true;
      }
      return false;
    };
    if (!taken(x, z)) return [x, z];
    const L = nearLane(x, z);
    const [ux, uz] = L ? [(L.E.to.x - L.E.from.x) / L.E.len, (L.E.to.z - L.E.from.z) / L.E.len] : [1, 0];
    for (const d of [0.9, -0.9, 1.8, -1.8, 2.7, -2.7]) {
      const [px, pz] = [x + ux * d, z + uz * d];
      if (!taken(px, pz) && PLAN.kerbOut(px, pz) >= PED.body && !solidAt(px, GROUND, pz)) return [px, pz];
    }
    return [x, z];
  }

  /** Where a furniture clip may be played by this body: on its spot's own point for it (0.3 m), or in a room. */
  function seatedIn(A, name) {
    const need = FURNITURE[name];
    if (!need || A.room) return true;
    if (need === 'room') return false;
    const at = need === 'bench' ? (A.stand?.kind === 'bench' ? [A.stand.x, A.stand.z] : null) : A.stand?.[need];
    return !!at && Math.hypot(A.x - at[0], A.z - at[1]) <= 0.3;
  }

  const api = {
    CLIPS,
    /** The city's own figures for a standing person's life (simstate/life.js): LIFE, NAMES, roleOf. */
    CITYLIFE: { LIFE: CITYLIFE.LIFE, NAMES: CITYLIFE.NAMES, roleOf: CITYLIFE.roleOf },
    FURNITURE,
    GROUND,
    get clock() {
      return clock;
    },
    until,
    seconds,
    all: () => [...actors.values()],
    get,
    routeMetres,
    /** The trip planner's walk between two points: { metres, seconds at 1.5 m/s, path } or null. */
    tripOf: tripBetween,
    /** How far a point is from the nearest sidewalk lane (m), to check a spot stands on a sidewalk. */
    laneDistance: (x, z) => sim.laneNear(x, z)?.d ?? null,
    /** Calls fn(dt) every frame of the city, before the crowd moves. Returns the function that stops it. */
    onFrame(fn) {
      hooks.add(fn);
      return () => hooks.delete(fn);
    },

    /** Puts an actor on stage or takes it off (off: it is not drawn, and nobody is kept clear of it). */
    show(id, on) {
      const A = get(id);
      A.w.hide = !on;
      A.cut = true;
      if (!on) A.tagged = false;
    },
    /** The box [x0, z0, x1, z1] inside which the city's own crowd is not drawn (null: everywhere as before). */
    setKeepOut(box) {
      keepOut = box;
      if (!box) for (const w of sim.walkers) if (!w.hk2 && w.hide) w.hide = false;
    },
    /** A ring on the ground under one actor, always: the player's own agent, findable at a glance. */
    mark(id) {
      marked = id ?? null;
    },
    /** Starts or stops the audit (the counts are listed above auditFrame); returns the counts so far. */
    audit(on) {
      if (on === true) audit = { frames: 0, scenes: 0, walks: 0, steps: 0, jumps: 0, cuts: 0, shifts: 0, flips: 0, pops: 0, drops: 0, unseated: 0, close: 0, slides: 0, speedSteps: 0, headingSnaps: 0, floating: 0, inRoad: 0, pushes: 0, squeezes: 0, brushes: 0, dodges: 0, rounds: 0, keptRight: 0, waits: 0, gaveWay: 0, replans: 0, seams: 0, through: 0, blind: 0, short: 0, ways: 0, near: new Map(), kinds: {}, examples: [] };
      const out = audit ? { ...audit, near: undefined, kinds: undefined, lastPush: undefined, examples: audit.examples.slice() } : null;
      if (on === false) audit = null;
      return out;
    },
    /**
     * Adds a test for solids the city does not know (the set's pieces): fn(x, z) → the name of what a body there
     * stands in, or null. Nobody is walked through one, and the audit counts anyone found in one (`through`).
     */
    addSolid(fn) {
      solidTests.push(fn);
    },
    /** The name of the solid a body at (x, z) would stand in, or null (the city's solids and the added ones). */
    solidAt: (x, z) => solidAt(x, groundAt(x, z), z),
    /** Says who a person is walking up to (an actor's id, or null): that person is not in their way (bodyAhead). */
    meeting(id, other = null) {
      get(id).meet = other !== null && actors.has(other) ? get(other) : null;
    },
    /** Does the city's collision world hold the real columns there (false: nothing can be said of that ground yet)? */
    solidKnown: (x, z) => !!city.cam?.world?.ready?.(x, z),
    /** The metres of the way over the ground from a to b, round what stands between (findWay), or null when there is none. */
    /**
     * Whoever `id` has been standing next to (`others`, ids) is not waited behind on its next walk: the way out of
     * a row of stalls is past a neighbour's shoulder. Null or nothing: the rule as it is.
     */
    passing(id, others = null) {
      const A = get(id);
      A.past = others?.length ? new Set(others.filter(o => actors.has(o)).map(o => get(o))) : null;
    },
    /** Whoever stands (not walking, on stage) within `r` m of a point: ids. `except`: an id left out. */
    nextTo(x, z, r = 1.6, except = null) {
      return api.all().filter(B => B.id !== except && !B.w.hide && !(B.moving > 0.1) && Math.hypot(B.x - x, B.z - z) < r).map(B => B.id);
    },
    /**
     * The points of a way over the ground from a to b round what stands between. Null: the straight line is free.
     * False: it is not, and no way round was found.
     */
    wayRound(ax, az, bx, bz) {
      return lineFree(ax, az, bx, bz) ? null : findWay(ax, az, bx, bz) || false;
    },
    groundWay(ax, az, bx, bz) {
      if (lineFree(ax, az, bx, bz)) return Math.hypot(bx - ax, bz - az);
      const way = findWay(ax, az, bx, bz, 6);
      if (!way) return null;
      let [m, px, pz] = [0, ax, az];
      for (const [qx, qz] of way) {
        m += Math.hypot(qx - px, qz - pz);
        [px, pz] = [qx, qz];
      }
      return m;
    },
    /** Adds one to a count of the audit: the director reports its scene starts here, the proof that scenes played. */
    count(name) {
      if (audit && name in audit) audit[name] += 1;
    },
    /** Sets the time scale of every walk, clip and wait here: 1, 2, 4, or 0 to hold everything still. */
    setSpeed(n) {
      scale = Math.max(0, Number(n) || 0);
    },
    get speed() {
      return scale;
    },
    has: id => actors.has(id),

    /** Puts a standing person somewhere else at once (through a door, or to settle a skipped hour). */
    place(id, x, z, ry = 0, y = null) {
      const A = get(id);
      // (a height of its own means a room's floor: a cot in the tent, a pad upstairs. The audit leaves such a body be)
      A.room = y !== null;
      // NOBODY IS PUT DOWN INSIDE ANYBODY. A door, a held place's exit and the wings are points several people are
      // cut to; two in one hour came out on top of each other. Where someone of ours stands within a body's width,
      // or is on their way to, the place is the nearest free one along the sidewalk, three steps off at most
      if (y === null) [x, z] = clearNear(A, x, z);
      y ??= GROUND;
      if (A.mode !== 'free') {
        sim.offAgent(A.w, [x, y, z, ry]);
        A.mode = 'free';
      }
      A.goId += 1;
      A.cut = true;
      if (A.route) A.route.done = true;
      Object.assign(A, { x, y, z, ry, route: null, vc: 0, stand: null, faceTo: null, snap: true, lastX: x, lastZ: z });
      A.w.fix = [x, y, z, ry];
    },
    /**
     * Says where an actor's standing spot is and which lane point it is walked to and from (its ENTRY: checked for a
     * clear straight step between the two). A walk that starts on the spot leaves by the entry.
     */
    stand(id, spot) {
      // (and what there is to lean on or sit on there, when the spot has any: the city's stand-spot kinds)
      get(id).stand = spot ? { x: spot.x, z: spot.z, entry: lanePoint(spot.entry), kind: spot.kind ?? 'open', lean: spot.lean ?? null, sit: spot.sit ?? null } : null;
    },
    /** Is an actor where a clip's furniture is (FURNITURE): within 0.3 m of its spot's own point, or indoors? */
    seated: (id, name) => seatedIn(get(id), name),
    /**
     * A point of the map made fit to stand on (a counter, a desk: set down by eye, often on the walkers' line): it
     * is moved straight across the sidewalk until it is 0.75 m off the lane's line, to the side it is already on
     * (the lot's side when it is on the line or near it), as far as the sidewalk's clear strip goes; the other side when
     * that one has no room. 0.75 m is two bodies and a hand: a walker on the lane passes without touching. The
     * city's own rule for a spot of its data is 0.95 m, which a 3 m sidewalk with the lane down its middle only
     * grants at the kerb. → { x, z, entry } (the entry: the lane point straight across).
     */
    fitSpot(x, z, clear = 0.75, along = 0) {
      const near = nearLane(x, z);
      if (!near) return { x, z, entry: null };
      // (`along`: the place is that many metres up the sidewalk from the point: someone who keeps a door stands
      // beside it, not in it)
      const L = along ? { E: near.E, s: Math.max(0.6, Math.min(near.E.len - 0.6, near.s + along)) } : near;
      if (along) {
        const [nx, nz] = laneXZ(near);
        const [mx, mz] = laneXZ(L);
        x += mx - nx;
        z += mz - nz;
      }
      const [lx, lz] = laneXZ(L);
      const [ax, az] = SIDE_AXIS[L.E.side];
      const across = (x - lx) * ax + (z - lz) * az;
      if (Math.hypot(x - lx, z - lz) >= clear) return { x, z, entry: L };
      const u = sim.sideU(L.E, L.s);
      const room = sim.roomSpan(L.E, u, u, RS);
      if (!room) return { x, z, entry: L };
      const c = sim.laneC(L.E, u);
      const lot = Math.min(room[1] - c, 0.95);
      const kerb = Math.max(room[0] - c, -0.95);
      const lotSide = across > -0.3;
      let to = lotSide ? lot : kerb;
      if (Math.abs(to) < clear && Math.abs(lotSide ? kerb : lot) > Math.abs(to)) to = lotSide ? kerb : lot;
      return { x: lx + ax * to, z: lz + az * to, entry: L };
    },
    /** The point on the walkers' lane `metres` along the sidewalk from the lane point nearest (x, z) (either way: ±). */
    laneAlong(x, z, metres, clearOf = null) {
      const L = nearLane(x, z);
      if (!L) return [x, z];
      const at = m => laneXZ({ E: L.E, s: Math.max(1.6, Math.min(L.E.len - 1.6, L.s + m)) });
      // (`clearOf`, an actor's id: not where somebody else stands. A little further, or a little short)
      if (clearOf !== null) {
        for (const more of [0, 1.3, -1.3, 2.6, -2.6]) {
          const p = at(metres + Math.sign(metres || 1) * more);
          if (api.free(p[0], p[1], 0.9, [clearOf])) return p;
        }
      }
      return at(metres);
    },
    /** The unit vector from a point to the walkers' lane beside it, or null on the lane itself. */
    laneSide(x, z) {
      const L = nearLane(x, z);
      if (!L) return null;
      const [lx, lz] = laneXZ(L);
      const d = Math.hypot(lx - x, lz - z);
      return d > 0.2 ? [(lx - x) / d, (lz - z) / d] : null;
    },
    /**
     * Can an actor walk STRAIGHT to a point: is the line clear of everyone of ours who is standing (`passing` apart:
     * the person it is walking up to), on one sidewalk, and inside the strip of it a body can use all the way? For a
     * few steps along a kerb, where going out to the lane and back would be the long way round.
     */
    clearStep(id, x, z, passing = null) {
      const A = get(id);
      const L = nearLane(x, z);
      if (!L || nearLane(A.x, A.z)?.E !== L.E || PLAN.kerbOut(x, z) <= 0 || PLAN.kerbOut(A.x, A.z) <= 0) return false;
      A.pass = passing ? actors.get(passing) ?? null : null;
      const ok = stepClear(A.x, A.z, L, true, A, x, z);
      A.pass = null;
      return ok;
    },
    /**
     * Is a point a place to stand: on a sidewalk, a body's half-width in from the kerb, in nothing solid, with nobody
     * of ours on stage within `r` metres of it (the ids listed apart)?
     */
    free(x, z, r = 0.7, except = []) {
      if (PLAN.kerbOut(x, z) < PED.body || solidAt(x, GROUND, z)) return false;
      for (const A of actors.values()) {
        if (A.w.hide || A.room || except.includes(A.id)) continue;
        if (Math.hypot(A.x - x, A.z - z) < r) return false;
        // (nor where somebody is on their way to: two people sent to one place a moment apart both found it free)
        if (A.route && Math.hypot(endOf(A.route)[0] - x, endOf(A.route)[1] - z) < r) return false;
      }
      return true;
    },
    /** Where an actor on its way is going to stand, [x, z], or null when it is not walking. */
    goalOf(id) {
      const A = actors.get(id);
      return A?.route ? endOf(A.route) : null;
    },
    /** Is a point standing ground: on a sidewalk, a body's half-width and more in from its kerb? */
    offKerb: (x, z) => PLAN.kerbOut(x, z) >= PED.body,
    /** Is a point on a roadway (a carriageway or a junction box)? */
    onRoad: (x, z) => onRoad(x, z),
    /**
     * The walkers' lane beside a point: { x, z } the lane point straight across from it and { ux, uz } the way the
     * sidewalk runs there; `d(px, pz)` is how far any point of that sidewalk is from the lane's line. Null: no lane.
     */
    laneLine(x, z) {
      const L = nearLane(x, z);
      if (!L) return null;
      const [lx, lz] = laneXZ(L);
      const [ux, uz] = [(L.E.to.x - L.E.from.x) / L.E.len, (L.E.to.z - L.E.from.z) / L.E.len];
      return { x: lx, z: lz, ux, uz, d: (px, pz) => Math.abs((px - lx) * uz - (pz - lz) * ux) };
    },
    /**
     * Someone in a scene keeps their place: they are never asked to make way for a walker (giveWay), and a walker
     * that finds them in its way waits or goes round.
     */
    firm(id, on) {
      const A = actors.get(id);
      if (A) A.firm = !!on;
    },
    /**
     * The walk between two points as walkTo() would lay it, without walking it: { metres, points: [[x, y, z,
     * heading], …] every `step` metres }, or null when no sidewalk leads there. `from` and `to` are the two ends'
     * entries (a standing spot's), when they have one. For the tools, and for staging a scene before anyone moves.
     */
    routeOf(ax, az, bx, bz, { from = null, to = null, step = 0.25 } = {}) {
      const R = routeTo({ x: ax, z: az, stand: { x: ax, z: az, entry: lanePoint(from) } }, bx, bz, to);
      if (!R) return null;
      const points = [];
      for (let d = 0; d < R.len + step; d += step) points.push(poseOf(R, Math.min(d, R.len), [0, 0, 0, 0]));
      return { metres: R.metres, points, corners: R.joins.length };
    },
    /**
     * Makes an actor that is on its way go faster (someone is waiting for it): up to `v` m/s for what is left of its
     * route, with `clip` over it from `clipFrom` m/s up when the walk has no clip of its own (a cuffed or a hurt
     * walk keeps its own and its pace). Nothing happens to a walk with only a few metres to go.
     */
    hurry(id, v, clip = null, clipFrom = 0) {
      const R = get(id).route;
      if (!R || R.metres - R.m < 6 || (R.clip && !R.clipFrom)) return;
      R.v = Math.max(R.v, v);
      if (!R.clip && clip && CLIPS.CLIP[clip]) Object.assign(R, { clip, clipFrom, clipOn: false });
    },
    /** The metres of the walk walkTo() would make from where an actor stands (null: no sidewalk leads there). */
    wayLength(id, x, z, entry = null) {
      return routeTo(get(id), x, z, entry)?.metres ?? null;
    },

    /**
     * A person standing at (x, z), facing `ry` (radians, 0 looks to +z, south).
     *   look   { seed, pool: 'agent' | 'npc', outfit: a name in the cast's OUTFITS, wear: { slot: piece id } }
     *   far    keep it on the full-detail tier at any distance while in view (default true)
     */
    add({ id, name = id, x, z, ry = 0, look = {}, far = true }) {
      if (actors.has(id)) throw new Error(`actors: ${id} is already here`);
      const baked = bakeLook({ seed: id, ...look });
      const w = sim.putAgent({ id: `hk2:${id}`, look: baked.index, fix: [x, GROUND, z, ry] });
      if (!w) throw new Error(`actors: could not place ${id}`);
      // the city's own mark for "always full detail while in view" (peds.js draws such walkers first)
      if (far) w.cleaner = 'hk2';
      // pieces asked for that the cast doesn't have are skipped by the cast without a word: keep a note of them
      const missing = Object.entries(look.wear ?? {}).filter(([slot, piece]) => piece !== 'none' && (baked.look[slot]?.id ?? baked.look[slot]) !== piece).map(([, piece]) => piece);
      const A = {
        id, name, w, look: baked.look, missing, mode: 'free',
        x, y: GROUND, z, ry, route: null, vc: 0, stand: null, room: false, moving: 0, faceTo: null, snap: true, goId: 0,
        want: null, asked: null, clipName: null, clipT: 0, nearAt: 0, rate: 1, props: new Map(),
        bubble: null, tag: null, metres: 0, lastX: x, lastZ: z, portrait: null,
      };
      w.hk2 = A;
      A.tag = document.createElement('div');
      A.tag.className = 'hk2-tag';
      A.tag.textContent = name;
      A.tag.style.visibility = 'hidden';
      layer.append(A.tag);
      actors.set(id, A);
      return A;
    },

    remove(id) {
      const A = get(id);
      A.goId += 1;
      for (const mesh of A.props.values()) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      }
      A.bubble?.el.remove();
      A.tag?.remove();
      if (!A.w.hide) notePop(A, A.w.g, null);
      CLIPS.clearClip(A.w.g);
      A.w.hk2 = null;
      sim.removeAgent(A.w.aid);
      actors.delete(id);
    },

    /** Name tags over every head (for the proof's screenshots). */
    tags(on) {
      tagsOn = !!on;
    },
    /** A name tag over one head: the director marks the people of the scene that is playing, so they can be found. */
    tag(id, on) {
      const A = actors.get(id);
      if (A) A.tagged = !!on;
    },

    /** Turn to face a point, or pass null to face the way it walks again. The turn is eased by the city. */
    face(id, x, z) {
      const A = get(id);
      A.faceTo = x === null || x === undefined ? null : [x, z];
    },
    /** Turn to a heading (radians) where it stands. */
    turn(id, ry) {
      const A = get(id);
      A.faceTo = null;
      A.ry = ry;
    },
    /**
     * Resolves when everyone listed has finished turning to where they were told to face, or after `limit` seconds.
     * A body the camera does not have in view is not being turned at all (it takes its heading when it comes into
     * view), so nobody waits for one.
     */
    turned(ids, limit = 1) {
      const end = clock + limit;
      const list = ids.map(get);
      return until(() => clock >= end || list.every(A => !A.drawn || turnOf(A.w.yawS ?? A.ry, A.faceTo ? Math.atan2(A.faceTo[0] - A.x, A.faceTo[1] - A.z) : A.ry) < 0.15));
    },

    /** Play a walker's clips faster than life (a busy hour squeezed to fit). 1 is life. */
    setRate(id, rate) {
      get(id).rate = Math.max(0.25, rate || 1);
    },

    /**
     * A straight walk to (x, z) at up to `v` m/s. For staging (up to a partner, a few metres along a wall): it does
     * not look for a sidewalk, but it starts and stops like any walk, keeps to the ground and brakes for whoever is
     * in its way. `clip` names a clip of the city's to play over the walk (a run, a limp, a creep). Resolves true
     * on arrival, false when another order replaced this one on the way.
     */
    async stepTo(id, x, z, { v = STEP_SPEED, clip = null, clipFrom = 0, yaw = null, exact = false } = {}) {
      const A = get(id);
      if (A.mode !== 'free') api.place(id, A.x, A.z, A.ry);
      const mine = ++A.goId;
      const up = upright(A, mine, overOf(clip));
      if (up !== true && !(await up)) return false;
      // (a straight step never ends in, or passes through, a solid: freeEnd. `exact`: the point is the city's own, a
      // spot's place to lean 0.2 m off its wall or to sit on its ledge, checked by its stand-spot maker with a
      // walker's discs: it is walked to as it is)
      if (!exact) [x, z] = freeEnd(A.x, A.z, x, z);
      const R = makeRoute([{ line: [A.x, A.z, x, z] }]);
      if (R && exact) R.exact = true;
      if (!R) {
        // already there. Someone still under way brakes to a stop over the next steps instead of freezing
        if (A.vc > 0.3) {
          const far = (A.vc * A.vc) / (2 * BRAKE) + 0.05;
          const halt = makeRoute([{ line: [A.x, A.z, A.x + Math.sin(A.ry) * far, A.z + Math.cos(A.ry) * far] }]);
          if (halt) return follow(A, halt, mine, { v: A.vc, yaw, count: 'steps' });
        }
        if (A.route) A.route.done = true;
        A.route = null;
        api.count('steps');
        return true;
      }
      return follow(A, R, mine, { v, clip, clipFrom, yaw, count: 'steps' });
    },

    /**
     * Straight steps through a few points in turn, the corners between them rounded (the city's corner arc): a way
     * round somebody to a mark on their far side. As stepTo otherwise.
     */
    async stepVia(id, points, { v = STEP_SPEED, clip = null, clipFrom = 0, yaw = null } = {}) {
      const A = get(id);
      if (A.mode !== 'free') api.place(id, A.x, A.z, A.ry);
      const mine = ++A.goId;
      const up = upright(A, mine, overOf(clip));
      if (up !== true && !(await up)) return false;
      const parts = [];
      let [ax, az] = [A.x, A.z];
      for (const [k, [px, pz]] of points.entries()) {
        const [bx, bz] = k === points.length - 1 ? freeEnd(ax, az, px, pz) : [px, pz];
        parts.push({ line: [ax, az, bx, bz] });
        [ax, az] = [bx, bz];
      }
      const R = makeRoute(parts);
      if (!R) {
        api.count('steps');
        return true;
      }
      return follow(A, R, mine, { v, clip, clipFrom, yaw, count: 'steps' });
    },

    /**
     * Walks to (x, z) the way a person would: along the sidewalks and over the crossings.
     *   how: 'path' (default)  on the city's own lane geometry, either way along any sidewalk and over any crossing:
     *                          off the standing spot by its entry point, round the corners on their arcs, down the
     *                          kerb and up again, and off the lane by `entry`, the lane point the place it is going to
     *                          is stepped to from (the nearest lane point when none is given). It speeds up, brakes
     *                          and steps round people as the travel section above says. It does not wait for the
     *                          lights: moving traffic is off on the game's page, so a red light would only cost the
     *                          hour its seconds. THE LIGHTS WOULD GO in advance(): hold the walker at the kerb spot
     *                          (pedsim.js STEP: 1 m on to a crossing) while sim.walkOK(crossing) is false.
     *   how: 'lane'            handed to the pedestrian sim, in the stream, waiting at the kerb for the signal. The
     *                          sim's lanes run ONE WAY round each block, so a 20 m hop against the flow becomes a walk
     *                          round the block (measured: 9 m straight was 169 m). Right for a long walk only.
     *   how: 'straight'        a straight line (across the plaza's paving, which is on no sidewalk graph).
     * `clip` plays over the walk, as in stepTo (`clipFrom`: only from that speed up, m/s: a run's clip); `yaw` is
     * the heading to turn to on arrival.
     * Resolves with { seconds, metres, how, arrived }.
     */
    async walkTo(id, x, z, { v = 1.5, how = 'path', clip = null, clipFrom = 0, entry = null, yaw = null } = {}) {
      const A = get(id);
      const t0 = clock;
      const m0 = A.metres;
      const done = (used, arrived = true) => {
        if (arrived) api.count('walks');
        return { seconds: clock - t0, metres: A.metres - m0, how: used, arrived };
      };
      if (how === 'path') {
        if (A.mode !== 'free') api.place(id, A.x, A.z, A.ry);
        const mine = ++A.goId;
        const up = upright(A, mine, overOf(clip));
        if (up !== true && !(await up)) return done('path', false);
        const R = routeTo(A, x, z, entry);
        if (R) {
          A.faceTo = null;
          R.goal = { x, z, entry };
          const arrived = await follow(A, R, mine, { v, clip, clipFrom, yaw });
          return { ...done('path', arrived), booked: R.metres / 1.5 };
        }
        how = 'straight';
      }
      const from = how === 'lane' ? sim.laneNear(A.x, A.z) : null;
      const to = from ? sim.laneNear(x, z) : null;
      const way = to ? sim.wayTo(from.E, from.s, to) : null;
      if (!way) {
        A.faceTo = null;
        // (no sidewalk leads there: straight, or by the way round what stands between)
        // (a couple of steps too, when a straight step would stop more than half a metre short of the place: with
        // a post between a walker and their spot 1.5 m away the step went nowhere and was called arrived)
        const cut = () => {
          const [ex, ez] = freeEnd(A.x, A.z, x, z);
          return Math.hypot(ex - x, ez - z) > 0.5;
        };
        const via = (Math.hypot(x - A.x, z - A.z) > 2.5 || cut()) && !lineFree(A.x, A.z, x, z) ? findWay(A.x, A.z, x, z) : null;
        const arrived = via ? await api.stepVia(id, via, { v, clip, clipFrom, yaw }) : await api.stepTo(id, x, z, { v, clip, clipFrom, yaw });
        return done('straight', arrived);
      }
      // off the spot to its lane point, onto the lane once there is a gap, and away
      const [lx, lz] = laneXZ(from);
      await api.stepTo(id, lx, lz);
      await until(() => sim.laneClear(from.E, from.s));
      A.faceTo = null;
      sim.onAgent(A.w, from.E, from.s);
      A.w.fix = null;
      A.w.v = v;
      sim.goAgent(A.w, way, to);
      A.mode = 'lane';
      await until(() => A.w.halt && A.w.E === to.E);
      // at the goal's lane point: off the lane, the last steps to the spot
      const p = A.w.p;
      sim.offAgent(A.w, [p[0], p[1], p[2], A.w.yawS ?? p[3]]);
      A.x = p[0];
      A.y = GROUND;
      A.z = p[2];
      A.ry = A.w.yawS ?? p[3];
      A.mode = 'free';
      await api.stepTo(id, x, z);
      return done('lane');
    },

    /**
     * Plays a clip by name. A one-shot resolves when it has ended; a loop, or a one-shot that holds its last pose,
     * resolves after `hold` seconds (default: one length of the clip) and keeps playing until stop().
     */
    async play(id, name, { loop, t = 0, hold = null, after = 0 } = {}) {
      const A = get(id);
      const clip = CLIPS.CLIP[name];
      if (!clip) throw new Error(`actors: the city has no clip ${name}`);
      // (`after`: at a seam on the clock, not before the playing clip is this far in. `began`: when it really
      // started, which is later than now when it waits for a seam or for the clip before it to blend out)
      const want = { name, loop, t, after, began: null };
      A.want = want;
      const stays = (loop ?? clip.loop) || clip.hold;
      const asked = clock;
      // its turn: a seam is a clip's loop away at most; a body out of view runs no clip, and nobody waits for one
      await until(() => A.want !== want || want.began !== null || clock - asked > (A.drawn ? 3.5 : 0.3));
      const started = clock;
      // ended: the gait hook cleared the request when the clip ran out, or another play() replaced it. The time
      // limit covers a walker that is out of view (no gait state there: its clip does not run)
      const over = () => A.want !== want || want.ended || clock - started > clip.dur / A.rate + 2;
      if (stays) await until(() => A.want !== want || want.ended || clock - started >= (hold ?? clip.dur) / A.rate);
      else await until(over);
      return { clip: name, seconds: clock - started, waited: started - asked };
    },

    /** Blends the playing clip out. */
    stop(id) {
      get(id).want = null;
    },
    /**
     * Ends whatever clip is on a body AT ONCE, for a cut: the person is about to be put somewhere else in the same
     * frame (out of a room by its door), and a blend would be seen on the far side of it. Not a pop: nobody sees
     * across a cut. Use it only with place().
     */
    cutClip(id) {
      const A = get(id);
      CLIPS.clearClip(A.w.g);
      A.want = A.asked = null;
      A.clipName = null;
      A.clipW = 0;
    },
    /** What is on a body now: { name, t, w } of the clip the city last drew it in (name null: none), and what is asked for. */
    clipOf(id) {
      const A = get(id);
      return { name: A.clipName, t: A.clipT, w: A.clipW ?? 0, want: A.want?.name ?? null };
    },
    /**
     * Resolves when nobody listed has a clip on the body any more (each blended out to the stand), or after `limit`
     * seconds. For two people about to start a two-person clip on one frame: both from the plain stand.
     */
    cleared(ids, limit = 0.8) {
      const end = clock + limit;
      const list = ids.map(get);
      return until(() => clock >= end || list.every(A => !A.drawn || !A.w.g?.clip || A.w.g.clip.w <= SWITCH_AT));
    },

    /**
     * A two-person clip. The lead's clip names its partner's (`pair.with`), how far apart they stand (`pair.gap`) and
     * how late the partner starts (`pair.delay`). The partner is stood in front of the lead, facing it, first
     * (`placed: true` when the caller has already stood them right: they are only turned). `hold` is the seconds
     * a looping pair plays before this resolves (default: one length of each clip).
     */
    async pair(leadId, partnerId, name, { placed = false, hold = null } = {}) {
      const lead = get(leadId);
      const partner = get(partnerId);
      const clip = CLIPS.CLIP[name];
      if (!clip?.pair) throw new Error(`actors: ${name} is not a pair clip`);
      const { gap, delay = 0, face } = clip.pair;
      // BOTH FROM THE PLAIN STAND: whatever either was in is blended out while they take their marks and turn, so the
      // two clips start in step (one of them waiting for a blend would be late by it). A clip that leads into the
      // pair's own by a seam or a chain is left alone (cuffed already, the gun already up)
      for (const [B, name2] of [[lead, name], [partner, clip.pair.with]]) {
        const on = B.w.g?.clip && !B.w.g.clip.out ? B.w.g.clip.c : null;
        if (B.want && (!on || !(on.name === name2 || leadsTo(on, name2) || seamFor(on, name2)))) B.want = null;
      }
      if (placed) {
        lead.faceTo = null;
        lead.ry = Math.atan2(partner.x - lead.x, partner.z - lead.z);
      } else {
        const px = lead.x + Math.sin(lead.ry) * gap;
        const pz = lead.z + Math.cos(lead.ry) * gap;
        if (Math.hypot(partner.x - px, partner.z - pz) > 0.05) await api.stepTo(partnerId, px, pz);
      }
      partner.faceTo = null;
      partner.ry = face === 'away' ? lead.ry : lead.ry + Math.PI;
      // both turn to their marks on the spot (the city eases it): the clip starts once they face them
      await api.turned([leadId, partnerId], 1);
      await api.cleared([leadId, partnerId], 0.6);
      await seconds(0.1);
      // `hold` is how long a looping pair (two people talking) keeps the floor; a one-shot pair runs its length
      // (a partner's half that loops, cuffed and standing, holds the two only as long as the lead's own clip runs: it
      // was a whole loop of its own, six seconds for a cuffing of two and a half)
      const other = CLIPS.CLIP[clip.pair.with];
      const rest = hold ?? ((other.loop || other.hold) && !(clip.loop || clip.hold) ? Math.max(0.3, clip.dur - delay) : null);
      const both = [api.play(leadId, name, { hold }), seconds(delay / lead.rate).then(() => api.play(partnerId, clip.pair.with, { hold: rest }))];
      lead.paired = partner.paired = true;
      await Promise.all(both);
      lead.paired = partner.paired = false;
      return { lead: name, partner: clip.pair.with, gap, delay };
    },

    /** A white speech bubble over the head for `time` seconds. */
    say(id, text, { time = 6 } = {}) {
      const A = get(id);
      A.bubble?.el.remove();
      const el = document.createElement('div');
      el.className = 'hk2-bubble';
      const who = document.createElement('b');
      who.textContent = A.name;
      el.append(who, text);
      layer.append(el);
      A.bubble = { el, until: clock + time };
      return seconds(time);
    },

    /** Where a head is on the page, in CSS pixels: { x, y, visible }. For the panels' bubbles and chips. */
    screenOf(id) {
      const A = actors.get(id);
      if (!A) return { x: 0, y: 0, visible: false };
      V.set(A.w.p[0], A.w.p[1] + HEAD, A.w.p[2]).project(city.camera);
      const visible = V.z < 1 && Math.abs(V.x) <= 1 && Math.abs(V.y) <= 1 && !A.w.hide;
      return { x: (V.x * 0.5 + 0.5) * innerWidth, y: (-V.y * 0.5 + 0.5) * innerHeight, visible };
    },

    /** The actor under a point of the page (CSS pixels), or null: the nearest body within `reach` pixels. */
    pickAt(px, py, reach = 34) {
      let best = null;
      let bestD = reach;
      for (const A of actors.values()) {
        const head = api.screenOf(A.id);
        if (!head.visible) continue;
        V.set(A.w.p[0], A.w.p[1] + 0.9, A.w.p[2]).project(city.camera);
        const bx = (V.x * 0.5 + 0.5) * innerWidth;
        const by = (-V.y * 0.5 + 0.5) * innerHeight;
        // the distance to the line from the head to the middle of the body
        const len2 = (bx - head.x) ** 2 + (by - head.y) ** 2 || 1;
        const k = Math.max(0, Math.min(1, ((px - head.x) * (bx - head.x) + (py - head.y) * (by - head.y)) / len2));
        const d = Math.hypot(px - (head.x + (bx - head.x) * k), py - (head.y + (by - head.y) * k));
        if (d < bestD) {
          bestD = d;
          best = A.id;
        }
      }
      return best;
    },

    /**
     * A head-and-shoulders picture of an actor's look, as a PNG data URL. The cast builds the figure once more as a
     * plain model, and the city's own renderer draws it into a small target of its own, off the screen.
     */
    portrait(id, size = 192) {
      const A = get(id);
      if (A.portrait) return A.portrait;
      const figure = CH.build(A.look);
      if (figure.userData.open) figure.userData.open.visible = true;
      if (figure.userData.shut) figure.userData.shut.visible = false;
      figure.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(figure);
      const tall = box.max.y - box.min.y;
      const span = tall * 0.62;
      const cx = (box.min.x + box.max.x) / 2;
      const cy = box.max.y - span * 0.46;
      const studio = new THREE.Scene();
      studio.background = new THREE.Color(0x2b2d3a);
      studio.add(figure, new THREE.HemisphereLight(0xffffff, 0x8a8fa8, 2.2));
      const key = new THREE.DirectionalLight(0xffffff, 2.4);
      key.position.set(-2, 3, 6);
      studio.add(key);
      const lens = new THREE.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, 0.1, 60);
      lens.position.set(cx + span * 0.35, cy + span * 0.12, box.max.z + 12);
      lens.lookAt(cx, cy, (box.min.z + box.max.z) / 2);
      const R = city.renderer;
      const target = new THREE.WebGLRenderTarget(size, size);
      const before = R.getRenderTarget();
      const pixels = new Uint8Array(size * size * 4);
      try {
        R.setRenderTarget(target);
        R.render(studio, lens);
        R.readRenderTargetPixels(target, 0, 0, size, size, pixels);
      } finally {
        R.setRenderTarget(before);
        target.dispose();
        figure.traverse(m => m.geometry?.dispose());
      }
      // the target holds linear light, bottom row first: to sRGB, top row first
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      const image = ctx.createImageData(size, size);
      for (let row = 0; row < size; row++) {
        for (let k = 0; k < size * 4; k++) {
          const v = pixels[(size - 1 - row) * size * 4 + k];
          image.data[row * size * 4 + k] = k % 4 === 3 ? 255 : Math.round(255 * Math.pow(v / 255, 1 / 2.2));
        }
      }
      ctx.putImageData(image, 0, 0);
      A.portrait = canvas.toDataURL('image/png');
      return A.portrait;
    },
  };
  return api;
}
