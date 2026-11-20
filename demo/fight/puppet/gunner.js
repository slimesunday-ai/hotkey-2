// THE WAVE FIGHT ON HAND-POSED BODIES (anim-1). The fight you steer (WASD, no script) has nothing written ahead: the
// rules say where everybody is each tick and what happened on it. So here the pose system is driven LIVE: every frame
// each body's chest, head and arms are posed from what it is doing now (the gun it holds and where that is pointed,
// how long since its last shot, how far through a reload, the blow it is in, the round that just hit it), and the
// legs are left to the city's own walk. That is the whole reason it is done this way and not staged from a window
// ahead: the legs ARE the steering. A staged body's feet are planned from where it will be; a steered body's place is
// the key held this instant, and feet planned from a guess at it would slide the moment the key changed. The walk
// already puts feet under a body that goes where it is told; what was wrong with the fight was everything above the
// hips, and that is what this replaces. Nothing here moves a body or knows a key: the page puts them exactly as before.
//
// The one thing staged ahead is the one thing the rules can say ahead: a blow close up. The page steps a copy of the
// fight a few ticks on with the keys as they are (anim.js predictBlows, the rules being seeded) and the wind-up starts
// so the fist lands on the tick the rules swing.
//
// A body that is killed is taken whole (legs and root too) for its fall: guns.js DROPS, by what killed it and whether
// it was running.
//
// The same poses are plain functions of a clock (guns.js gunPose, SHOT, DROPS; moves.js): a script can drive them as
// the run's one-on-ones are driven (choreo.js), which is how the run will use them.
//
//   const G = createGunners({ actors, fx, W, city })      the same face as anim.js createAnimator:
//   G.begin() · G.predict(F, move) · G.faceOf(p) · G.event(e, F, aidOf) · G.frame(F, T, dt, aidOf) · G.stats
//   G.gunOf(simId) → { muzzle, dir, at } (world) as last drawn · G.clear()
//   (raidfight-1) `at0()` → [x, y]: the point of the fight's ground round which its handedness on the world is read,
//   again at every begin() (the raid's ground is laid afresh, maybe mirrored, for every raid: demo/run/raidlay.js);
//   left out, [0, 0] once, as before. `heads: true`: G.headOf(simId) → the head's middle as last drawn (world), for
//   the measure of bodies in one another. `shotsAhead: s` (raidfight-1, a fight nobody steers, whose copy stepped ahead
//   is the fight itself): predict() also looks that far ahead for SHOTS, and a gun is round on whoever it fires at
//   next before it fires (the six-shot dropped the heavy at the door, and its next shot was at a shooter behind it:
//   thrown round 100 degrees in one picture). `fromGrip: true` (raidfight-1): the gun is aimed from its own grip, not
//   from the body's middle, and its line is judged from its muzzle: at the door they are a metre or two off, where a
//   barrel laid beside the line from the middle sent its round out 0.4 rad across it (the tracer from the muzzle).
import { WEAPONS, step, TICK } from '../../../src/fight/index.mjs';
import { predictBlows, windAt, LOOK } from '../anim.js';
import { pose0, toWorld, fk } from './rig.js';
import { gunPoseSided, solveArms, gunInBody, SHOT, DROPS, dropFor, GUNS, GUN_OF, STANCE, BURST, keepApart } from './guns.js';
import { GUARDS, guard, BLOWS, HURT } from './moves.js';
import { POSE_CLIP, takeRow, freeRows, writeRow } from './clip.js';
import { createGunMeshes } from './gunmesh.js';
import { createHeld } from './held.js';

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** How far outside its range (m) a gun is already up and round on whoever is coming: time to come to bear. */
const AHEAD = { pistol: 1.5, chopper: 1.5, doorman: 3, longeye: 7 };
/** The furthest the chopper's holder is bent forward, chest and head (rad), whatever hits him while he is braced over it. */
const BOW = { tx: 0.34, hx: 0.3 };
/** How long before somebody walks in (s) a gun is round on their way in and up: the Long-eye is set and waiting. */
// (anim-2: the quick guns 1.2 s, were 0.7: half a turn takes a second at the pace a body turns, and the first shot of
// a fight found a six-shot's holder with its back to them: thrown round 160 degrees in one picture)
const COMING = { pistol: 1.2, chopper: 1.2, doorman: 1.2, longeye: 2.4 };
/** How near two standing bodies are drawn (m, middle to middle): one of theirs to one of yours at arm's length; two on one side shoulder to shoulder. A head is a metre wide. */
const KEEP = { foe: 1.25, same: 1.05 };
/** How fast each gun's line comes round onto somebody (rad/s): the six-shot snaps, the Long-eye is brought to bear. */
// (anim-2: the chopper 14, was 9: it fires again 0.29 s after it dropped somebody, and its line was still on the way
// to the next when it did: put there in one picture, a third of a turn)
const SWING = { pistol: 16, chopper: 14, doorman: 6.5, longeye: 4.2 };
/** How long (s) a gun stays up and on its line after its last shot, or after the last of them it was on is gone. */
const STAY = { pistol: 0.45, chopper: 0.45, doorman: 0.7, longeye: 1.0 };
/**
 * How far off the stance somebody may bear before the legs turn (rad, + to the body's R). `one`: a gun in one hand, its
 * arm's swing. `two`: a gun in both, held at the L shoulder (the R's is the mirror): the stance has them at 0.6; the
 * hold itself reaches from −0.11 to 2.51 (guns.js HOLD), and near either end of that the chest is wrung round.
 */
const BAND = { one: [-0.6, 0.95], two: [0.2, 1.9] };
/** How long (s) a hit takes to knock a raised gun off its aim (two fifths of the way down). */
const DIP = 0.07;
/** (fromGrip) Nearer the muzzle than this (m), a round is drawn along the barrel to their distance. */
const POINT = 2.5;
/** (shotsAhead) How far the legs go round toward whoever is fired at after this one, the gun still on this one (rad). */
const PRE = 0.55;
/** The head of a body with a gun: how far it turns off the chest (rad) and how fast it comes round (rad/s). */
const HEAD = { most: 1.2, rate: 5 };
/** What each close-up weapon throws in the fight you steer, and its biggest (the one that drops them). */
const hashOf = (s, n) => {
  let h = 2166136261 ^ n;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

/**
 * THE WALKER'S OWN LEAN INTO A TURN IS NOT THE FIGHT'S (anim-2). The cast's shader rolls a whole body about its feet
 * by how fast its heading turns times how fast it goes (walk2.js turnRoll: 0.09 × rad/s × m/s, up to 0.3 rad), and
 * turns the head ahead of the turn (up to 0.45 rad): a walker rounding a corner leans into it. A body of this fight
 * turns to FACE somebody while its legs go another way: at the city's turn rate (3.2 rad/s) and anything over a
 * walk that is the whole 17 degrees, and it changes side as the turn does. That was "the Doorman's lean", measured
 * 2026-11-19 (demo/tools/gun-lean.mjs): the spine 17 to 20 degrees off upright through every shot of a Doorman backing
 * off, 17.2 of it this roll and 5 the kick; rocked from one side to the other, 34 degrees, in a sixth of a second.
 * So for the bodies this file holds the shader is told no turn at all (as puppet.js does for the staged fights):
 * what leans a body here is its pose. The walk's nod at a stop and a start is kept, at a part of what it was.
 */
const HELD = new Set();
const NOD = 0.4;
let wrapped = null;
function ownTurns(city) {
  const sim = city?.peds?.sim;
  if (!sim || wrapped === sim) return;
  wrapped = sim;
  const animate0 = sim.animate;
  sim.animate = (w, dt, G, fresh) => {
    const held = HELD.has(w);
    if (held && !fresh && w.g?.hpTrue !== undefined) [w.g.hp, w.g.hr] = [w.g.hpTrue, w.g.hrTrue];
    const g = animate0(w, dt, G, fresh);
    if (g && held) {
      g.omega = 0;
      // (the springs go on as they were; what is drawn of them is a part)
      [g.hpTrue, g.hrTrue] = [g.hp, g.hr];
      g.hp *= NOD;
      g.hr *= NOD;
    } else if (g && g.hpTrue !== undefined) g.hpTrue = g.hrTrue = undefined;
    return g;
  };
}

/** (named-1) A point of the rig's shared body as it is drawn on a body of the named cast: times its size, about the feet. */
const sized = (pt, A) => {
  const k = A?.size ?? 1;
  return k === 1 ? pt : [pt[0] * k, pt[1] * k, pt[2] * k];
};

export function createGunners({ actors, fx, W, city, at0 = null, heads = false, shotsAhead = 0, fromGrip = false }) {
  ownTurns(city);
  /** sim id → the body's state */
  const S = new Map();
  let pred = new Map();
  /** (ahead) sim id → the next shot it fires { to, t }, as the copy stepped ahead has it */
  let nextShot = new Map();
  const stats = { blows: 0, onTime: 0, late: 0, whiffs: 0, shots: 0, flinches: 0, vests: 0, falls: 0, posed: 0 };
  // (which way round the fight's ground lies on the world: +1 when turning to the ground's left is turning to the
  // world's left, seen from above; the body's stance is told in the fight's own angles)
  const handOf = () => {
    const [x0, y0] = at0?.() ?? [0, 0];
    const [o, ex, ey] = [W(x0, y0), W(x0 + 1, y0), W(x0, y0 + 1)];
    const [ax, az, bx, bz] = [ex[0] - o[0], ex[2] - o[2], ey[0] - o[0], ey[2] - o[2]];
    // (the world's heading runs from +z toward +x; the ground's angle from +x toward +y)
    return az * bx - ax * bz > 0 ? 1 : -1;
  };
  let HAND = at0 ? 1 : handOf();
  /**
   * THE SIDE-ON STANCE: a body with a gun in both hands stands turned off whoever it is on, to the side its
   * shoulder is on: the R shoulder's hold (side 0) has its line to the body's L (guns.js HOLD: rho −1.2), so the
   * body is turned to its R of them and they bear −STANCE; the L shoulder's the mirror. → what is added to the
   * bearing to them, in the fight's own ground angles. (anim-2: this had the other sign. Stood as the R shoulder's
   * stance, they bore +0.6, which is the L shoulder's side; the hold changed shoulder, the stance followed, they
   * bore −0.6, and back: a body with a long gun rocked 60 degrees from side to side for as long as it had somebody
   * in range, a second there and back, changing shoulder at every swing. Measured 2026-11-19 from the trace:
   * demo/tools/gun-lean.mjs "changes of shoulder", 14 in a 10 s Doorman fight, now 1 or 2)
   */
  /** Whether somebody bearing `bear` (rad, + to the body's R) from where a body stands is inside what its hold takes without the legs turning. */
  const inBand = (kind, bear, side) => {
    if ((GUNS[kind].hands ?? 1) === 1) return bear >= BAND.one[0] && bear <= BAND.one[1];
    return side ? bear >= BAND.two[0] && bear <= BAND.two[1] : bear <= -BAND.two[0] && bear >= -BAND.two[1];
  };
  const stanceOff = (gunName, side) => (STANCE[GUN_OF[gunName] ?? 'pistol'] ?? 0) * (side ? -1 : 1) * HAND;
  /** where each body was last drawn on the fight's ground (apart, below) */
  const drawnAt = new Map();
  /** how far from where the rules have it each body is drawn, held off (kept when it goes down) */
  const heldBy = new Map();
  const meshes = createGunMeshes(city);
  const held = createHeld(city);
  const P = pose0();
  const fresh = () => {
    const Q = pose0();
    for (const k of Object.keys(Q)) P[k] = Q[k];
    return P;
  };
  const person = (F, id) => F.people.find(q => q.id === id);
  const yawOf = A => A.w.yawS ?? A.ry;
  /** The ground under a body (the walker's own place). */
  const floorOf = A => A.w.p?.[1] ?? A.y ?? 0;
  const stateOf = (p, aid) => {
    let B = S.get(p.id);
    if (!B) {
      B = { id: p.id, aid, row: takeRow(), up: 0, bear: 0, target: null, face: null, shot: -9, heat: 0, hurt: null, wind: null, blow: null, down: null, ph: hashOf(p.id, 7) * 5, n: 0, gun: null, lastAct: -9, yaw: 0, v: 0 };
      S.set(p.id, B);
    }
    B.aid = aid;
    if (actors.has(aid)) HELD.add(actors.get(aid).w);
    return B;
  };
  const isGun = p => !!(p.gun && p.arm === p.gun);
  /** The body's clip: the one that reads its row of the pose texture (clip.js), over the walk. */
  function hold(B, A) {
    const g = A.w.g;
    if (g) g.look = B.row;
    const now = g?.clip && !g.clip.out ? g.clip.name : null;
    if (now === POSE_CLIP && A.want?.name === POSE_CLIP) return;
    if (A.want?.name !== POSE_CLIP) actors.play(B.aid, POSE_CLIP, { loop: true }).catch(() => {});
  }
  /** The bearing of a world point from a body's own heading (+ to its R). */
  const bearTo = (A, x, z) => wrap(Math.atan2(x - A.x, z - A.z) - yawOf(A));
  /** Which blow a close-up weapon throws now. */
  function blowOf(p, B, big) {
    const G = GUARDS[p.arm] ?? GUARDS.fists;
    if (big) return G.big;
    const r = hashOf(p.id, 31 + B.n);
    const total = G.blows.reduce((a, [, w]) => a + w, 0);
    let x = r * total;
    for (const [name, w] of G.blows) {
      x -= w;
      if (x <= 0) return name;
    }
    return G.blows[0][0];
  }

  return {
    stats,
    begin() {
      // (whoever is still in the fight's clip is let out of it: you, who stay on the stage between fights)
      for (const B of S.values()) {
        if (!actors.has(B.aid)) continue;
        const A = actors.get(B.aid);
        if (A.want?.name === POSE_CLIP || A.w.g?.clip?.name === POSE_CLIP) actors.stop(B.aid);
        if (A.w.g) A.w.g.look = 0;
      }
      S.clear();
      HELD.clear();
      if (at0) HAND = handOf();
      drawnAt.clear();
      heldBy.clear();
      freeRows();
      pred = new Map();
      nextShot = new Map();
      meshes.clear();
      held.clear();
    },
    clear() {
      this.begin();
    },
    predict(F, move) {
      pred = new Map();
      if (!shotsAhead) {
        for (const b of predictBlows(F, move)) if (!pred.has(b.id)) pred.set(b.id, b);
        return;
      }
      // (the blows within the look the wave fight has; the shots as far as `shotsAhead`, each body's in order)
      nextShot = new Map();
      if (F.over) return;
      const G = structuredClone({ ...F, events: [] });
      const n = Math.max(LOOK, Math.ceil(shotsAhead / TICK));
      for (let k = 0; k < n && !G.over; k++) {
        step(G, typeof move === 'function' ? move(G) : move);
        for (const e of G.events) {
          if (e.type === 'swing' && k < LOOK && !pred.has(e.id)) pred.set(e.id, { id: e.id, to: e.to, t: G.t, hit: e.hit });
          else if (e.type === 'shot') {
            if (!nextShot.has(e.id)) nextShot.set(e.id, []);
            nextShot.get(e.id).push({ to: e.to, t: G.t });
          }
        }
        G.events.length = 0;
      }
    },
    faceOf(p) {
      return S.get(p.id)?.face ?? null;
    },
    /** The pace a body's legs go at (m/s), walking at `v`: its own, or a shuffle under a body turned to whoever it fires on. */
    paceOf(p, v) {
      return v * (S.get(p.id)?.pace ?? 1);
    },
    /**
     * HELD OFF: nobody stands in anybody. The rules let a body that has reached you stand on your own spot (their
     * reach is counted from middle to middle), and drawn there two heads a metre wide were one head for seconds
     * (the Doorman's film, 2026-11-18). So where everybody is DRAWN is eased apart: `at`, a Map of id → [x, y] on
     * the fight's own ground (m), is changed in place so that no two standing bodies are nearer than KEEP. You are
     * never moved (your place is the key held this instant); whoever has come at you is stopped at arm's length,
     * where a fist or a shove still reaches (a blow's own lean covers it), and two of them keep off each other.
     * The rules, and every number of theirs, are as they were: this is only the picture.
     * → Map of id → the speed (m/s) whoever was held is then drawn moving at (their legs go by it, not by the
     * rules' speed: held, they do not walk on the spot).
     */
    apart(F, at, dt) {
      // (whoever is down lies where they were standing when they went down, as far off as they were held: put back
      // where the rules have them, a body that died at arm's length dropped inside you)
      for (const p of F.people) {
        const off = p.down ? heldBy.get(p.id) : null;
        const q = at.get(p.id);
        if (off && q) [q[0], q[1]] = [q[0] + off[0], q[1] + off[1]];
      }
      const live = F.people.filter(p => !p.down && at.has(p.id));
      const told = new Map(live.map(p => [p.id, [...at.get(p.id)]]));
      const moved = new Set();
      for (const id of keepApart(live, at, KEEP, (a, b) => hashOf(a + b, 3) * Math.PI * 2)) moved.add(id);
      const out = new Map();
      for (const p of live) {
        const q = at.get(p.id);
        const was = drawnAt.get(p.id);
        if (moved.has(p.id) && was && dt > 0) out.set(p.id, Math.min(6, Math.hypot(q[0] - was[0], q[1] - was[1]) / dt));
        drawnAt.set(p.id, [q[0], q[1]]);
        const t = told.get(p.id);
        heldBy.set(p.id, [q[0] - t[0], q[1] - t[1]]);
      }
      return out;
    },
    /** Where a body's gun is, as last drawn (world): { at, dir, muzzle }, or null. */
    gunOf(id) {
      return S.get(id)?.gun ?? null;
    },
    /** (shotsAhead) The next shot a body fires, as the copy stepped ahead has it: { to, t }, or null. */
    nextShotOf(id) {
      return nextShot.get(id)?.[0] ?? null;
    },
    /** (raidfight-2) When a body's gun last fired, a rules' shot or a burst's round (the fight's clock), or null. */
    shotOf(id) {
      return S.get(id)?.shot ?? null;
    },
    /** (heads: true) Where a body's head is, as last drawn (world [x, y, z]), or null. */
    headOf(id) {
      return S.get(id)?.head ?? null;
    },
    event(e, F, aidOf) {
      if (e.type === 'shot') {
        const a = person(F, e.id);
        const B = stateOf(a, aidOf(e.id));
        const b = person(F, e.to);
        B.target = e.to;
        B.lastAct = F.t;
        B.up = 1;
        stats.shots += 1;
        const A = actors.has(B.aid) ? actors.get(B.aid) : null;
        // (FROM THE BARREL: where the gun was drawn this frame, before the kick this shot gives it; a body not drawn
        // yet has it worked out now)
        // (and ON THE LINE: a body the shot finds turned well off whoever it is at is round on them now, in this
        // picture: a gun does not fire across its holder's own chest. The facing above has it there already but
        // for the first shot at somebody who came from behind)
        let whipped = false;
        /** how far off the line to whoever it is at the barrel points, as posed (rad) */
        const lineOff = () => {
          if (!B.gun || !b) return 9;
          const [bx, , bz] = W(b.x, b.y, 1.0);
          // (fromGrip: from the muzzle, the way the round is drawn. Within POINT of it the round is drawn along the
          // barrel to their distance (below): the barrel is never turned in one picture for a body it already covers)
          if (fromGrip && B.gun.muzzle) {
            const [mx, mz] = [bx - B.gun.muzzle[0], bz - B.gun.muzzle[2]];
            return Math.hypot(mx, mz) < POINT ? 0 : Math.abs(wrap(Math.atan2(mx, mz) - Math.atan2(B.gun.dir[0], B.gun.dir[2])));
          }
          // (from the body's own middle: the barrel lies beside that line, a hand's width off it, and from a muzzle
          // that is nearly touching somebody the way to their middle is any way at all)
          return Math.abs(wrap(Math.atan2(bx - A.x, bz - A.z) - Math.atan2(B.gun.dir[0], B.gun.dir[2])));
        };
        if (A && b) {
          // (first by the hold itself: the chest turns on the legs and the hold changes shoulder. Only when that
          // cannot bring the barrel round is the body turned, in this picture, to where it stands settled on them:
          // off them by the gun's own stance, as the facing below has it)
          pose(F, a, B, A, F.t, 0, true);
          if (fromGrip) pose(F, a, B, A, F.t, 0, true);
          const why = { t: F.t, id: e.id, to: e.to, off: +lineOff().toFixed(2), bear: +B.bear.toFixed(2), up: +B.up.toFixed(2), side: B.side ?? null, d: +Math.hypot(b.x - a.x, b.y - a.y).toFixed(2), yaw: +yawOf(A).toFixed(2) };
          // (on the shoulder it is at; and if the barrel is still off them from there, on the other)
          for (const side of [B.side ? 1 : 0, B.side ? 0 : 1]) {
            if (lineOff() <= 0.2) break;
            const off = stanceOff(a.gun, side);
            const fa = Math.atan2(b.y - a.y, b.x - a.x) + (isGun(a) ? off : 0);
            const [o, d] = [W(a.x, a.y), W(a.x + Math.cos(fa), a.y + Math.sin(fa))];
            A.ry = Math.atan2(d[0] - o[0], d[2] - o[2]);
            if (A.w.yawS !== undefined) A.w.yawS = A.ry;
            A.w.omega = 0;
            whipped = true;
            pose(F, a, B, A, F.t, 0, true);
            if (fromGrip) pose(F, a, B, A, F.t, 0, true);
          }
          // (for the tools: each shot that had to throw its holder round, and how it stood before)
          if (whipped) {
            why.yawAfter = +yawOf(A).toFixed(2);
            (stats.whips ??= []).push(why);
            if (stats.whips.length > 8) stats.whips.shift();
          }
        } else if (A && !B.gun) pose(F, a, B, A, F.t, 0, true);
        // (for the tools: how each of the last shots left the gun: how far off the line to whoever it was at the
        // barrel pointed, rad, and how far up the gun was)
        if (A && b && B.gun) {
          const offLine = lineOff();
          (stats.shotLog ??= []).push({ id: e.id, off: +offLine.toFixed(2), up: +B.up.toFixed(2), bear: +B.bear.toFixed(2), side: B.side ?? null, whipped });
          if (stats.shotLog.length > 6) stats.shotLog.shift();
          stats.offLine = Math.max(stats.offLine ?? 0, offLine);
          stats.whipped = (stats.whipped ?? 0) + (whipped ? 1 : 0);
        }
        const from = B.gun?.muzzle ?? (A ? [A.x, floorOf(A) + 0.8, A.z] : W(a.x, a.y, 0.8));
        B.shot = F.t;
        B.heat = Math.min(6, B.heat + 1);
        let to = e.hit ? W(b.x, b.y, 1.0) : W(e.at[0], e.at[1], 0.05);
        // (fromGrip, POINT BLANK: whoever it is at is nearer the muzzle than POINT; the round goes along the barrel, to
        // their distance, into the body the barrel is on: how far that is off their middle is kept, `pointOff`)
        if (fromGrip && b && B.gun?.muzzle && e.hit) {
          const M = B.gun.muzzle;
          const d = Math.hypot(to[0] - M[0], to[2] - M[2]);
          if (d < POINT) {
            const n = Math.hypot(B.gun.dir[0], B.gun.dir[2]) || 1;
            const off = Math.abs(wrap(Math.atan2(to[0] - M[0], to[2] - M[2]) - Math.atan2(B.gun.dir[0], B.gun.dir[2])));
            stats.pointOff = Math.max(stats.pointOff ?? 0, +off.toFixed(3));
            to = [M[0] + (B.gun.dir[0] / n) * d, to[1], M[2] + (B.gun.dir[2] / n) * d];
          }
        }
        if (e.spread) {
          // (the Doorman's shell: a spread through its cone, from the muzzle)
          const aim = Math.atan2(b.y - a.y, b.x - a.x);
          const reach = Math.min(WEAPONS[a.gun].range, Math.hypot(b.x - a.x, b.y - a.y) + 1.2);
          const ends = [];
          // (fromGrip: the cone round the barrel's own line, from its muzzle, on the world: the rules' cone is the one
          // that hits, the picture's leaves the barrel)
          const M = fromGrip ? B.gun?.muzzle : null;
          const hb = M ? Math.atan2(B.gun.dir[0], B.gun.dir[2]) : 0;
          for (let k = 0; k < 7; k++) {
            const off = ((k / 6) * 2 - 1) * (e.cone * Math.PI) / 180;
            const r = reach * (0.8 + 0.2 * Math.cos(k * 2.3));
            if (M) {
              const [ex, ez] = [M[0] + Math.sin(hb + off) * r, M[2] + Math.cos(hb + off) * r];
              ends.push([ex, (W(a.x, a.y)[1] ?? M[1]) + 0.7 + 0.25 * Math.sin(k * 1.7), ez]);
            } else ends.push(W(a.x + Math.cos(aim + off) * r, a.y + Math.sin(aim + off) * r, 0.7 + 0.25 * Math.sin(k * 1.7)));
          }
          fx.blast(from, ends, e.spread.map(id => person(F, id)).filter(Boolean).map(q => W(q.x, q.y, 1.0)), a.side);
        } else fx.shot(from, to, e.hit, a.side, a.gun === 'longeye' ? 'long' : null);
        // (the case: the chopper's at once; the Doorman's and the Long-eye's when the pump or the bolt comes back)
        const kind = GUN_OF[a.gun] ?? 'pistol';
        // (THE CHOPPER'S BURST, guns.js BURST: the rounds after this one, evenly up to the rules' next shot)
        const rounds = BURST[kind] ?? 1;
        B.burst = null;
        if (rounds > 1 && b && a.mag > 0) {
          const gap = 1 / (WEAPONS[a.gun].rate * rounds);
          B.burst = Array.from({ length: rounds - 1 }, (_, k) => ({ at: F.t + gap * (k + 1), to: e.to, hit: !!e.hit, miss: e.hit ? null : e.at, side: a.side }));
        }
        if (kind === 'chopper') B.shell = F.t;
        else if (kind === 'doorman') B.shell = F.t + 0.3;
        else if (kind === 'longeye') B.shell = F.t + 0.5;
      } else if (e.type === 'swing') {
        const a = person(F, e.id);
        const B = stateOf(a, aidOf(e.id));
        B.target = e.to;
        B.lastAct = F.t;
        stats.blows += 1;
        if (B.blow && Math.abs(B.blow.t - F.t) < 0.05) stats.onTime += 1;
        else {
          // (nobody saw it coming, the keys changed: thrown from its contact, on time, without its wind-up)
          stats.late += 1;
          B.n += 1;
          B.blow = { t: F.t, name: blowOf(a, B, false), late: true };
        }
        B.blow.hit = e.hit;
        B.wind = null;
      } else if (e.type === 'hit') {
        const q = person(F, e.id);
        if (q.hp <= 0) return;
        const B = stateOf(q, aidOf(e.id));
        const by = person(F, e.by);
        const A = actors.has(B.aid) ? actors.get(B.aid) : null;
        let from = 0;
        if (A && by) {
          const [bx, , bz] = W(by.x, by.y);
          from = bearTo(A, bx, bz);
        }
        const vest = q.side === 'you' && q.cut > 0;
        if (vest) stats.vests += 1;
        else stats.flinches += 1;
        const shot = e.how === 'shot' && by?.gun;
        // (raidfight-1: one who soaks it up, a big man in a heavy jacket (`heft`, the share of a blow's throw he takes),
        // is rocked by a round by half as much: `k`)
        B.hurt = { t: F.t, kind: shot ? GUN_OF[by.gun] ?? 'pistol' : 'blow', from, vest, w: clamp((e.dmg ?? 10) / 24, 0.25, 1), k: q.heft !== undefined ? clamp(0.2 + q.heft, 0.45, 1) : 1 };
        // (KNOCKED OFF ITS AIM, NOT JUMPED OFF IT: a gun that was up dropped two fifths of the way to rest in one
        // picture and was back in three, a twitch of the hands (anim-2: the trace of a six-shot's holder hit at
        // 11.52 s, up 1 → 0.73 → 0.86 → 1). It goes down over DIP s and comes back at the gun's own raise)
        if (isGun(q)) B.dip = Math.max(B.dip ?? 0, B.up - 0.6);
        else B.up = Math.min(B.up, 0.6);
        B.wind = null;
      } else if (e.type === 'down') {
        const q = person(F, e.id);
        const B = stateOf(q, aidOf(e.id));
        const by = person(F, e.by);
        const A = actors.has(B.aid) ? actors.get(B.aid) : null;
        stats.falls += 1;
        // (how it was going when it was hit: along its own heading as it was drawn. The page then turns it to face
        // whoever dropped it; one dropped mid-run keeps the way it ran)
        const byGun = by && isGun(by) ? GUN_OF[by.gun] ?? 'pistol' : null;
        // (dropped at arm's length of whoever dropped it, it does not dive on: a body running at you killed three
        // metres off went down forward, along its own length, onto your feet and into your head. It is stopped,
        // and falls by what hit it, back from you)
        const close = !!by && Math.hypot(q.x - by.x, q.y - by.y) < 3.2;
        const went = close ? 0 : B.v;
        const kind = byGun ? dropFor(byGun, went) : went > 2 ? 'running' : by?.arm === 'blade' || by?.arm === 'shiv' ? 'crumple' : 'dropped';
        // (raidfight-1: the bearing of whoever dropped it, the body's own: the fall turns it away from them as it goes,
        // guns.js away. A page that turns a falling body to face them first, the fight page, finds it about 0)
        let from = 0;
        if (A && by) {
          const [bx, , bz] = W(by.x, by.y);
          from = bearTo(A, bx, bz);
        }
        B.down = { t: F.t, kind, yaw0: B.yaw, K: { from, v: went, w: 1 } };
        B.wind = B.blow = B.hurt = null;
        B.burst = null;
        B.up = 0;
        B.dip = 0;
        if (A?.w.g) A.w.g.look = B.row;
        meshes.hide(B.id);
        held.hide(B.id);
        B.gun = null;
      }
    },
    frame(F, T, dt, aidOf) {
      meshes.step(dt);
      stats.posed = 0;
      for (const p of F.people) {
        const aid = aidOf(p.id);
        if (!aid || !actors.has(aid)) continue;
        const B = stateOf(p, aid);
        const A = actors.get(aid);
        if (B.down) {
          // THE FALL: the whole body, from the clock of when it was dropped
          const D = DROPS[B.down.kind] ?? DROPS.crumple;
          const Q = fresh();
          const K = B.down.K;
          D.pose(Q, T - B.down.t, K);
          // (dropped mid-run: it goes on the way it ran, whichever way the page has turned it)
          if (B.down.kind === 'running') Q.ry = wrap(B.down.yaw0 - yawOf(A));
          solveArms(Q);
          writeRow(B.row, Q, 0);
          if (heads) B.head = toWorld(sized(fk(Q).headC, A), A.x, floorOf(A), A.z, yawOf(A));
          hold(B, A);
          // (for the tools: what is on a body half a second after it went down: the fall's own clip, or not)
          if (T - B.down.t > 0.5 && !B.down.seen) {
            B.down.seen = true;
            (stats.downClips ??= {})[p.id] = `${p.kind ?? ''} ${B.down.kind} clip ${A.clipName ?? 'none'} w ${(A.clipW ?? 0).toFixed(2)} want ${A.want?.name ?? 'none'} look ${A.w.g?.look ?? '?'} row ${B.row} rx ${Q.rx.toFixed(2)}`;
          }
          continue;
        }
        if (p.down) continue;
        const v = Math.hypot(p.vx, p.vy);
        B.v = v;
        B.yaw = yawOf(A);
        const gun = isGun(p);
        const Wp = WEAPONS[p.arm];
        // (as the rules choose: a gun is fired at one of theirs still on the way in, a fist is not: sim.mjs act. Left
        // out, the Long-eye stood with its back to whoever it shot at 15 m and was whipped round at every shot)
        const others = F.people.filter(q => !q.down && (q.side === 'foe') !== (p.side === 'foe') && (q.side !== 'foe' || q.in || gun));
        const near = others.map(q => [q, Math.hypot(q.x - p.x, q.y - p.y)]).sort((x, y) => x[1] - y[1])[0] ?? null;
        const coming = pred.get(p.id);
        if (gun) {
          // (up, and round on them, BEFORE they are in range: by how long the gun takes to come to bear. The Long-eye
          // is set on somebody six metres before it can reach them; without it, it stood with its back to whoever
          // was walking in and was whipped round as it fired)
          const ahead = AHEAD[GUN_OF[p.gun] ?? 'pistol'] ?? 1.5;
          // (and on whoever is about to walk in: the rules shoot one of theirs the tick they arrive, anywhere in
          // range of their way in. They are seen coming before that (the page walks them in from out of the
          // picture), so the gun is round on that way in and up before they are there: `point`)
          // (anim-2: the first of those about to come who will be in range, not only the very next: of four a
          // tenth of a second apart the first came in 14 m off, out of a six-shot's range, the second 11 m off
          // and was fired on as it arrived, with nothing pointed its way)
          B.point = null;
          if (p.side !== 'foe' && !(near && near[1] <= Wp.range + ahead)) {
            const soon = COMING[GUN_OF[p.gun] ?? 'pistol'] ?? 0.8;
            for (let k = F.wave; k < (F.waves?.length ?? 0) && F.waves[k][0] - F.t < soon; k++) {
              const gate = F.arena?.entries?.[F.waves[k][2] % F.arena.entries.length];
              if (gate && Math.hypot(gate[0] - p.x, gate[1] - p.y) <= Wp.range + ahead) {
                B.point = gate;
                break;
              }
            }
          }
          const rise = GUNS[GUN_OF[p.gun] ?? 'pistol'].raise;
          // (UP AS THE RELOAD ENDS, not after it: the rules fire the tick a gun is ready, and a gun that only then
          // began to come up was fired from the hip and thrown to the shoulder in one picture)
          const want = ((near && near[1] <= Wp.range + ahead) || B.point) && p.reload <= rise + 0.08 ? 1 : 0;
          // (and kept up a moment after its last shot with nobody left: the pump and the bolt are worked at the
          // shoulder, not on the way down)
          const stay = T - B.shot < (STAY[GUN_OF[p.gun] ?? 'pistol'] ?? 0.5) && p.reload <= 0;
          if (B.dip > 0) {
            const d = Math.min(B.dip, (0.4 * dt) / DIP);
            B.dip -= d;
            B.up = Math.max(0, B.up - d);
          } else B.up = want ? Math.min(1, B.up + dt / rise) : stay ? B.up : Math.max(0, B.up - dt / 0.45);
          // (not off whoever a burst is still going into)
          if (near && near[1] <= Wp.range + Math.max(4, ahead) && !B.burst?.length) B.target = near[0].id;
          // (round on whoever it fires at next, before it fires: the fight's own copy stepped ahead says who. A burst
          // still going into the last one is cut short a moment before a shot at somebody else: the burst is a
          // picture, the shot is the rules', and the gun needs that moment to come round)
          const nx = nextShot.get(p.id)?.[0];
          if (B.burst?.length && nx && nx.to !== B.burst[0].to && nx.t - T < 0.2) {
            stats.roundsCut = (stats.roundsCut ?? 0) + B.burst.length;
            B.burst = null;
          }
          if (nx && nx.to !== B.target && !B.burst?.length && person(F, nx.to) && !person(F, nx.to).down) {
            B.target = nx.to;
            B.point = null;
          }
        } else {
          if (coming) B.target = coming.to;
          else if (near && near[1] < 2.6) B.target = near[0].id;
          else if (T - B.lastAct > 1.2) B.target = null;
          const want = B.target && near && near[1] < 3.2 ? 1 : 0;
          B.up = want ? Math.min(1, B.up + dt / 0.25) : Math.max(0, B.up - dt / 0.5);
          // (the blow: its wind-up starts so it lands on the tick the rules swing)
          if (coming && !(B.wind && Math.abs(B.wind.t - coming.t) < 1e-6) && !(B.blow && T < B.blow.t + 0.12)) {
            const name = blowOf(p, B, false);
            const Bl = BLOWS[name] ?? BLOWS.cross;
            if (windAt(coming.t, T, Bl.go + Bl.ant) !== null) {
              B.n += 1;
              B.target = coming.to;
              B.blow = { t: coming.t, name };
              B.wind = { t: coming.t, to: coming.to };
            }
          }
          if (B.wind && T > B.wind.t + 0.1) {
            stats.whiffs += 1;
            B.wind = null;
          }
        }
        B.heat = Math.max(0, B.heat - dt * 5);
        // (facing: standing, whoever they fight; walking, the way they walk)
        // A GUN WITH SOMEBODY IN RANGE FACES THEM, WALKING OR NOT. The rules fire the moment the gun is ready,
        // whichever way the legs are going: backing off from somebody with the body turned the way it walked, the
        // shot's line left the muzzle and went back through the shooter (the Long-eye's film, 2026-11-18). The
        // legs then go under a body that is not turned their way: a shuffle (`pace`, below), not a stride
        if (!gun) B.point = null;
        const inReach = !!near && near[1] <= Wp.range + (AHEAD[GUN_OF[p.gun] ?? 'pistol'] ?? 1.5);
        // (AND THROUGH A RELOAD: it used to turn to the way it walked for the reload and back to them when it was
        // done. The rules fire the tick the reload ends, so a body backing off was caught half a turn off them at
        // every first shot and thrown round in one picture (the heading 150 degrees in a frame: gun-lean.mjs), and
        // the Doorman, two shells then 1.8 s of reload, spent the whole fight spinning. Nobody turns their back on
        // somebody ten paces off to feed a gun: it backs off facing them, the gun down in the hands)
        const armed = gun && (inReach || !!B.point) && (p.mag > 0 || p.reload > 0);
        B.pace = 1;
        if (gun && B.point && !inReach) {
          // (round on the way in of whoever is coming)
          const off = stanceOff(p.gun, B.side);
          const to = Math.atan2(B.point[1] - p.y, B.point[0] - p.x);
          B.face = to + off;
          B.onAt = T;
          if (v >= 0.4) B.pace = Math.max(0.35, Math.cos(wrap(Math.atan2(p.vy, p.vx) - to)));
        } else if ((v < 0.4 || armed) && B.target) {
          const q = person(F, B.target);
          // (a gun in both hands is fired side-on: standing, the body is turned off them by the stance's own turn, to
          // the side its shoulder is on; the fight's ground and the world turn opposite ways, hence the sign)
          const off = gun ? stanceOff(p.gun, B.side) : 0;
          const to = q ? Math.atan2(q.y - p.y, q.x - p.x) : null;
          // (THE FEET STAY WHERE THEY ARE WHILE THE HOLD REACHES, anim-2. The legs were turned to stand exactly
          // side-on to whoever the gun was on, every frame; and the rules have a quick gun fire on two of them
          // in turn, each knocked back past the other by its hit: the legs chased 120 degrees there and back
          // three times a second and never arrived. The chest turns on the legs and the arms swing: while they
          // bear inside what the hold takes without strain, the body stands as it is; outside it, the legs turn
          // to the stance)
          // (EITHER shoulder's: the hold changes shoulder by itself when they bear on its other side, and the legs
          // need not move for that. When neither takes them, the legs turn to the stance of the shoulder they
          // are on the side of; dead ahead, of the shoulder the gun is at)
          if (to === null) B.face = null;
          else if (!gun || B.face === null) B.face = to + off;
          else {
            const bear = wrap(HAND * (to - B.face));
            const kind = GUN_OF[p.gun] ?? 'pistol';
            if (!(inBand(kind, bear, 0) || inBand(kind, bear, 1))) B.face = to + stanceOff(p.gun, Math.abs(bear) < BAND.two[0] ? B.side : bear >= 0 ? 1 : 0);
          }
          // (shotsAhead) THE LEGS GO ROUND FIRST: the next shot is still at this one, the one after at somebody well
          // round: the legs turn toward that one as far as the hold can still keep the gun on this one (PRE rad), so
          // the turn left to make after the shot is one a body makes in the time the gun takes to be ready again
          const later = gun && to !== null ? (nextShot.get(p.id) ?? []).find(x => x.to !== B.target) : null;
          const lq = later && person(F, later.to);
          if (later && lq && !lq.down) {
            const d = wrap(Math.atan2(lq.y - p.y, lq.x - p.x) - to);
            const k = clamp(1 - (later.t - T) / 0.8, 0, 1);
            if (Math.abs(d) > 0.6 && k > 0) B.face = to + stanceOff(p.gun, B.side) + Math.sign(d) * Math.min(Math.abs(d) - 0.3, PRE) * k * k * (3 - 2 * k);
          }
          if (to !== null && v >= 0.4) B.pace = Math.max(0.35, Math.cos(wrap(Math.atan2(p.vy, p.vx) - to)));
          if (gun && armed && to !== null) B.onAt = T;
        } else if (gun && B.face !== null && T - (B.onAt ?? -9) < (STAY[GUN_OF[p.gun] ?? 'pistol'] ?? 0.5)) {
          // (STAYS ON THE LINE A MOMENT with nobody left on it: the last of them dropped, it turned to the way it
          // walked at once, then to the way in of the next, then to them: three headings in a third of a second)
          if (v >= 0.4) B.pace = Math.max(0.35, Math.cos(wrap(Math.atan2(p.vy, p.vx) - B.face)));
        } else B.face = v >= 0.4 ? Math.atan2(p.vy, p.vx) : null;
        pose(F, p, B, A, T, dt, false);
        stats.posed += 1;
      }
    },
  };

  /** One body's pose this frame: written to its row, its gun or what it holds put in its hands. `dry`: worked out only. */
  function pose(F, p, B, A, T, dt, dry) {
    const Q = fresh();
    const gun = isGun(p);
    const q = B.target ? person(F, B.target) : null;
    let want = 0;
    if (gun && B.point && !(q && !q.down && Math.hypot(q.x - p.x, q.y - p.y) <= (WEAPONS[p.gun]?.range ?? 0) + 8)) {
      const [qx, , qz] = W(B.point[0], B.point[1]);
      want = bearTo(A, qx, qz);
    } else if (q) {
      const [qx, , qz] = W(q.x, q.y);
      want = bearTo(A, qx, qz);
      // (fromGrip: from where the gun is held, so its line goes through them; from its middle the barrel lay a hand
      // beside that line, and a round from the muzzle crossed it)
      const g = gun && fromGrip ? B.gun?.at : null;
      if (g && Math.hypot(qx - g[0], qz - g[2]) > 0.8) want = wrap(Math.atan2(qx - g[0], qz - g[2]) - yawOf(A));
    } else if (B.hurt) want = B.hurt.from * 0.3;
    const kind = gun ? GUN_OF[p.gun] ?? 'pistol' : null;
    // (the line comes round at the gun's own pace; the short way, never through the back)
    const rate = kind ? SWING[kind] : 9;
    // (kept inside a half turn either way: left to wind up as the body turned under it, it reached 5.7 rad, the hold
    // took that for a line far round its back, and the Long-eye fired with its barrel pointing dead away from
    // whoever it hit: measured 2026-11-18, stats.offLine)
    B.bear = wrap(B.bear + clamp(wrap(want - B.bear), -rate * dt, rate * dt));
    if (dry) B.bear = want;
    let G = null;
    if (kind) {
      const Wp = WEAPONS[p.gun];
      const rel = p.reload > 0 && Wp.reload ? clamp(1 - p.reload / Wp.reload, 0, 1) : -1;
      // (which shoulder: the one whose side they are on; changed only when they are well round on the other)
      if (B.bear > 0.1) B.side = 1;
      else if (B.bear < -0.1) B.side = 0;
      B.flip = dry ? B.side ?? 0 : clamp((B.flip ?? 0) + (B.side ? 1 : -1) * dt / 0.2, 0, 1);
      G = gunPoseSided(Q, { kind, aim: B.bear, up: B.up, since: T - B.shot, heat: B.heat, reload: rel, v: B.v, t: T + B.ph }, B.flip);
      // (THE HEAD COMES ROUND AT A HEAD'S PACE and no further than a head turns: it was the whole of what the chest
      // had not turned, at once: 91 degrees off the chest and round in one picture when whoever it looked at
      // changed. The owner: "the head motion is crazy too/very intense when turning")
      if (!dry) {
        const to = clamp(Q.hy, -HEAD.most, HEAD.most);
        B.hy = B.hy === undefined ? to : B.hy + clamp(to - B.hy, -HEAD.rate * dt, HEAD.rate * dt);
        Q.hy = B.hy;
      }
    } else {
      B.hy = undefined;
      const Gd = GUARDS[p.arm] ?? GUARDS.fists;
      guard(Q, T + B.ph, Gd, B.ph, B.up);
      // (the chest to whoever it is for: standing, the body already faces them; walking, the chest turns on the legs)
      Q.ty += clamp(B.bear, -1.2, 1.2) * B.up;
      Q.hy += clamp(B.bear - clamp(B.bear, -1.2, 1.2) * B.up, -0.9, 0.9);
      if (B.blow) {
        const Bl = BLOWS[B.blow.name] ?? BLOWS.cross;
        const s = T - B.blow.t;
        if (s > Bl.fol + Bl.rec + 0.05) B.blow = null;
        else if (s >= -(Bl.go + Bl.ant) || B.blow.late) Bl.pose(Q, s, { ant: Bl.ant, go: Bl.go, fol: Bl.fol, rec: Bl.rec, hit: false, G: Gd, tgt: null });
      }
    }
    if (B.hurt) {
      const s = T - B.hurt.t;
      const H = B.hurt;
      const front = Math.cos(H.from) >= 0;
      if (H.kind !== 'blow') {
        const D = SHOT[H.kind] ?? SHOT.pistol;
        if (s > D.dur) B.hurt = null;
        else if ((H.k ?? 1) < 1) {
          // (soaked: the reaction's own pose, taken by its share)
          const was = { tx: Q.tx, ty: Q.ty, tz: Q.tz, hx: Q.hx, hy: Q.hy, hz: Q.hz, drop: Q.drop, hL: [...Q.hL], hR: [...Q.hR] };
          D.pose(Q, s, { from: H.from, front });
          for (const f of ['tx', 'ty', 'tz', 'hx', 'hy', 'hz', 'drop']) Q[f] = was[f] + (Q[f] - was[f]) * H.k;
          for (let i = 0; i < 3; i++) {
            Q.hL[i] = was.hL[i] + (Q.hL[i] - was.hL[i]) * H.k;
            Q.hR[i] = was.hR[i] + (Q.hR[i] - was.hR[i]) * H.k;
          }
        } else D.pose(Q, s, { from: H.from, front });
      } else if (s > 0.5) B.hurt = null;
      else HURT.head(Q, s, { w: H.w, from: Math.sin(H.from) >= 0 ? 1 : -1, dur: 0.42 });
      // (the stab vest took a share: the hands come in to it)
      if (H.vest && s < 0.36) {
        const k = Math.sin((Math.PI * s) / 0.36);
        for (let i = 0; i < 3; i++) Q.hL[i] += ([-0.1, 0.66, 0.22][i] - Q.hL[i]) * k * 0.7;
      }
    }
    // (THE CHOPPER, HIT MID-BURST: braced forward already, the flinch on top of it bowed him to the ground. However
    // the two add, the chest goes no further over than a brace, nor the head)
    if (kind === 'chopper') {
      Q.tx = Math.min(Q.tx, BOW.tx);
      Q.hx = Math.min(Q.hx, BOW.hx);
    }
    // (walking with nothing raised: the pose's arms are the whole arm, the walk's own swing is not under them, so
    // they are swung here, a hand's length, opposite each other at the walk's pace)
    if (!kind && B.up < 1 && B.v > 0.3) {
      const sw = Math.sin(T * (4.2 + 1.3 * Math.min(B.v, 4))) * 0.13 * Math.min(1, B.v / 2) * (1 - B.up);
      Q.hL[2] += sw;
      Q.hR[2] -= sw;
    }
    solveArms(Q);
    if (dry) {
      if (G) B.gun = gunWorld(Q, G, A);
      return;
    }
    if (globalThis.__gunTrace) traceRow(p, B, A, Q, T, kind);
    writeRow(B.row, Q, 1);
    if (heads) B.head = toWorld(sized(fk(Q).headC, A), A.x, floorOf(A), A.z, yawOf(A));
    hold(B, A);
    if (G) {
      B.gun = gunWorld(Q, G, A);
      meshes.show(B.id, kind, B.gun.at, B.gun.dir, B.gun.up, G.slide);
      held.hide(B.id);
      if (B.shell !== undefined && T >= B.shell) {
        if (B.gun.eject) meshes.shell(B.gun.eject, B.gun.dir, B.gun.up, floorOf(A), kind === 'doorman');
        B.shell = undefined;
      }
      // (a round of a burst: from the muzzle as it is drawn now, at whoever the shot was at, a hand's width off the
      // last; the gun shakes again and throws its case; whoever it is stitching jerks again. Not while reloading:
      // the gun is off its line then)
      if (B.burst?.length && T >= B.burst[0].at) {
        const r = B.burst.shift();
        const to = person(F, r.to);
        // (and only ALONG THE BARREL: a round whose line would leave the barrel by more than a fifth of a radian
        // is not fired, nor the rest of its burst)
        const [tx, , tz] = to ? W(to.x, to.y, 1.0) : [0, 0, 0];
        const off = to ? Math.abs(wrap(Math.atan2(tx - A.x, tz - A.z) - Math.atan2(B.gun.dir[0], B.gun.dir[2]))) : 9;
        if (to && B.gun.muzzle && !(p.reload > 0) && off <= 0.2) {
          B.rounds = (B.rounds ?? 0) + 1;
          const j = k => (hashOf(B.id, 97 + B.rounds * 3 + k) - 0.5) * 0.36;
          const at = r.hit ? W(to.x + j(0), to.y + j(1), 0.9 + j(2)) : W(r.miss[0] + 2 * j(0), r.miss[1] + 2 * j(1), 0.05);
          fx.shot(B.gun.muzzle, at, r.hit, r.side, null);
          stats.burstOff = Math.max(stats.burstOff ?? 0, off);
          stats.rounds = (stats.rounds ?? 0) + 1;
          B.shot = T;
          B.heat = Math.min(6, B.heat + 0.3);
          B.shell = T;
          const V = S.get(r.to);
          if (r.hit && V && !V.down && V.hurt && V.hurt.kind === 'chopper') V.hurt.t = T;
        } else {
          stats.roundsHeld = (stats.roundsHeld ?? 0) + 1 + B.burst.length;
          B.burst = null;
        }
      }
    } else {
      B.gun = null;
      meshes.hide(B.id);
      const Gd = GUARDS[p.arm] ?? GUARDS.fists;
      if (Gd.held) {
        // (what is in the hand: the blade, Cousin Earl's tire iron; along the forearm of the hand that holds it)
        const f = fk(Q);
        const L = (Gd.strong ?? 'R') === 'L';
        const w = pt => toWorld(sized(pt, A), A.x, floorOf(A), A.z, yawOf(A));
        held.show(B.id, Gd.held, w(L ? f.fistL : f.fistR), w(L ? f.elbL : f.elbR));
      } else held.hide(B.id);
    }
  }
  /**
   * FOR THE MEASURE (demo/tools/fight-film.mjs --trace): one row a body a frame of how it is DRAWN, the walker's own
   * share included (the cast's shader rolls a whole body about its feet into a turn, by how fast it turns and how
   * fast it goes: walk2.js turnRoll, up to 0.3 rad; and turns the head ahead of a turn, up to 0.45 rad). The spine's
   * tilt off upright is worked from the pose's own joints (rig.js fk: hips to neck), then that roll.
   */
  function traceRow(p, B, A, Q, T, kind) {
    const f = fk(Q);
    const g = A.w.g;
    const [om, gv] = [g?.omega ?? A.w.omega ?? 0, g?.v ?? 0];
    const roll = clamp(-0.09 * om * gv, -0.3, 0.3);
    const s = [f.neck[0] - f.hip[0], f.neck[1] - f.hip[1], f.neck[2] - f.hip[2]];
    const [c, sn] = [Math.cos(roll), Math.sin(roll)];
    const d = [c * s[0] - sn * s[1], sn * s[0] + c * s[1], s[2]];
    const L = Math.hypot(d[0], d[1], d[2]) || 1;
    const deg = r => +((r * 180) / Math.PI).toFixed(1);
    const row = {
      t: +T.toFixed(3), id: p.id, gun: kind, since: +(T - B.shot).toFixed(3), tilt: deg(Math.acos(clamp(d[1] / L, -1, 1))), side: deg(Math.asin(clamp(d[0] / L, -1, 1))), fore: deg(Math.asin(clamp(d[2] / L, -1, 1))),
      roll: deg(roll), head: deg(Q.hy + clamp(0.2 * om, -0.45, 0.45)), nod: deg(Q.hx + (g?.hp ?? 0)), om: +om.toFixed(2), v: +gv.toFixed(2), yaw: deg(yawOf(A)), to: deg(A.w.p?.[3] ?? A.ry), bear: deg(B.bear), sh: B.side ?? 0, flip: +(B.flip ?? 0).toFixed(2), up: +B.up.toFixed(2),
      tx: +Q.tx.toFixed(3), ty: +Q.ty.toFixed(3), tz: +Q.tz.toFixed(3), hurt: B.hurt ? B.hurt.kind : null,
    };
    const R = globalThis.__gunTrace;
    R.push(row);
    if (R.length > 40000) R.splice(0, 10000);
  }
  /** The gun in the world: the body's place and heading on guns.js gunInBody. */
  function gunWorld(Q, G, A) {
    const Bd = gunInBody(Q, G);
    const yaw = yawOf(A);
    const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
    const w = pt => (pt ? toWorld(sized(pt, A), A.x, floorOf(A), A.z, yaw) : null);
    const d = v => [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
    return { at: w(Bd.at), dir: d(Bd.dir), up: d(Bd.up), muzzle: w(Bd.muzzle), eject: w(Bd.eject), slide: Bd.slide, fistR: w(Bd.fistR), fistL: w(Bd.fistL), fore: w(Bd.fore) };
  }
}
