// THE FIGHT, STAGED (anim-1). The rules' fight (src/fight/: seeded, nobody steers) is run to its end before the first
// frame and read as a SCRIPT: who throws what when, whether it lands, what it took, who goes down, who wins. This file
// stages that script for the game's camera with the moves of moves.js: where they stand (side on to the camera, so a
// blow travels ACROSS the picture and the gap between them shows), who is the southpaw (each one's strong hand on the
// camera's side), every blow's wind-up timed back from the tick the rules land it, what the other does about it (takes
// it on the head or in the body, covers, slips, ducks, hops back), where a blow knocks them, how they come back to
// their distance, how the loser goes down and what both do after. The rules' own positions are not used: they were made
// to decide the fight, not to be looked at. What is the rules' stays the rules': the tick every blow lands on, hit or
// miss, the damage, the end.
//
//   scriptOf(inputs, seed)       the rules' fight run to its end: { people, beats, over, seconds }
//   stageFight({ script, ground, cam, cast, pre, seed })   → the staged fight:
//       ground { c: [x, z], r }  the middle of the clear ground it is fought on, and how far from it they may go (m)
//       cam    [x, z]            the way to the camera from there, along the ground (a unit vector)
//       cast   { simId: { at: [x, z] } }   where each of them stands now (you take the end of the line you are nearer)
//       pre    seconds of squaring up before the rules' clock starts
//     → { fighters, byId, t0 (−pre), tOver (the rules' end), t1 (everyone standing again, the score's end), over,
//         fx [{ t, kind, at() → [x, y, z], w, by, to }], marks { simId: { at: [x, z], yaw } } (where each squares up) }
import { startDuel, step, brawl, WEAPONS } from '../../../src/fight/index.mjs';
import { createFighter } from './fighter.js';
import { pose0, fk, toWorld, toBody, RIG } from './rig.js';
import { solve } from './body.js';
import { E, track } from './plan.js';
import { GUARDS, BLOWS, HURT, COVER, FALLS, HOLDS, guard, rise, beaten, over as overPose, downFeet, thrownEnd, rifle, watchOut } from './moves.js';

/** The rules' fight, run to its end and read as a script. */
export function scriptOf(inputs, seed) {
  const F = startDuel(inputs, seed);
  // (sixes-1: Cousin Earl beside you in a door fight: side 'ally', the way he is told to fight)
  const people = F.people.map(p => ({ id: p.id, side: p.side, arm: p.arm, kind: p.kind, hp: p.hp, max: p.max, name: p.name, heft: p.heft ?? 1, slip: p.slip ?? 1, ...(p.side === 'ally' ? { way: F.build?.earl ?? 'side' } : {}) }));
  const beats = [];
  let seen = 0;
  while (!F.over) {
    const pins = F.people.map(p => p.pin);
    step(F, brawl(F));
    for (; seen < F.events.length; seen++) {
      const e = F.events[seen];
      if (e.type === 'swing') beats.push({ t: F.t, by: e.id, to: e.to, hit: e.hit, arm: e.arm, dmg: 0, hp: null, down: false, hold: 0 });
      else if (e.type === 'hit') {
        const b = beats[beats.length - 1];
        const k = F.people.findIndex(p => p.id === e.id);
        // (held by it: the throw puts them down, the grab holds both; the rules say for how long)
        Object.assign(b, { dmg: e.dmg, hp: e.hp, hold: F.people[k].pin > pins[k] + 1e-9 ? F.people[k].pin : 0 });
      } else if (e.type === 'down') {
        const b = beats[beats.length - 1];
        // (the cap's end: nobody threw it; whoever is spent goes down by themselves)
        if (b && Math.abs(b.t - F.t) < 1e-6 && b.to === e.id && b.hit) b.down = true;
        else beats.push({ t: F.t, by: e.by, to: e.id, spent: true, down: true, hit: false, arm: null, dmg: 0, hold: 0 });
      }
    }
  }
  return { people, beats, over: { ...F.over }, seconds: F.t, capped: !!F.capped };
}

const hash = (a, b) => {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x27d4eb2d, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  return (h ^ (h >>> 12)) >>> 0;
};
const unit = (x, z) => {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
};
const pick = (list, r) => {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let x = (r % 1000) / 1000 * total;
  for (const [name, w] of list) {
    x -= w;
    if (x < 0) return name;
  }
  return list[0][0];
};

/**
 * A blow as it lands, measured off its own pose on its guard (the front foot stepped in, worked forward through the
 * rig): how far in front of the hips the fist is, and the middle of the head (m). And a guard's own: how far in front
 * of the hips the head's middle is as they stand. For standing the two the right way apart: near enough for the fist
 * to arrive, never so near that the two heads (each 0.8 m deep) are in each other. Kept by style and blow.
 */
const GEOM = new Map();
function geomOf(G, name) {
  const key = `${G.tx},${G.ty},${G.hR},${G.strong ?? 'R'}|${name}`;
  let r = GEOM.get(key);
  if (r) return r;
  const B = name ? BLOWS[name] : null;
  const P = pose0();
  guard(P, 0, G, 0, 1);
  if (B) B.pose(P, 0, { ant: B.ant, go: B.go, fol: B.fol, rec: B.rec, hit: false, G, tgt: null });
  const split = G.split + (B?.lunge ?? 0);
  const S = solve({ L: [-RIG.hipX, split / 2, 0, 0], R: [RIG.hipX, -split / 2, 0, 0], yaw: 0, pin: -1, pelvis: [0, 0], facing: 0, pose: P, rooted: null, y: 0 });
  const f = fk(S.P);
  const strongR = (G.strong ?? 'R') === 'R';
  const fist = !B ? f.fistR : B.hand === 'W' ? (strongR ? f.fistL : f.fistR) : B.hand === 'B' ? [(f.fistL[0] + f.fistR[0]) / 2, 0, (f.fistL[2] + f.fistR[2]) / 2] : strongR ? f.fistR : f.fistL;
  r = { fist: toWorld(fist, S.x, 0, S.z, S.yaw)[2], head: toWorld(f.headC, S.x, 0, S.z, S.yaw)[2] };
  GEOM.set(key, r);
  return r;
}
/** How far in front of the middle of their head, toward whoever hits them, the place a blow lands on is (m). */
const OFF = { face: 0.36, corner: 0.32, crown: 0.2, body: 0.1, ribs: 0.04 };
/** Two heads' middles are never nearer than this (m): each is 0.8 m deep, front to back. */
const HEADS = 0.9;
/** How fast a body closes a distance on its feet while it fights (m/s). */
const STEP_V = 1.9;
/** How fast a body comes in from a long way off, on the average (m/s): a walk, its middle no faster than a step. */
const WALK_IN = 1.25;

export function stageFight(o) {
  // (more than once: a body that is put on the ground stands up again where its feet were, and where that is, is only
  // known once its steps are laid; and everything after it in the fight is staged from there. Each pass finds those
  // places for the next, until they no longer change: one more pass than there are bodies put down, at most)
  let fight = build(o, new Map());
  for (let k = 0; k < 9 && fight.roots.size; k++) {
    const next = build(o, fight.roots);
    const same = [...next.roots].every(([key, r]) => {
      const q = fight.roots.get(key);
      return q && Math.hypot(q.at[0] - r.at[0], q.at[1] - r.at[1]) < 1e-5 && Math.abs(q.yaw - r.yaw) < 1e-5;
    });
    // (how far the places this pass was staged from are from the ones it made: nothing once it has settled)
    next.passes = k + 2;
    next.rootsOff = Math.max(0, ...[...next.roots].map(([key, r]) => {
      const q = fight.roots.get(key);
      return q ? Math.hypot(q.at[0] - r.at[0], q.at[1] - r.at[1]) : 9;
    }));
    fight = next;
    if (same) break;
  }
  return fight;
}

function build({ script, ground, cam = [1, 0], cast = {}, pre = 1.1, seed = 1, firstHurt = 0 }, known) {
  const roots = new Map();
  const you = script.people[0];
  // (sixes-1: theirs, and whoever is on your side: Cousin Earl at your door)
  const them = script.people.filter(p => p.side === 'foe');
  const c = ground.c;
  const R = ground.r ?? 2.2;
  const fx = [];
  const many = script.people.length > 2;
  // THE LINE OF IT: across the camera's view. You take the end you are nearer.
  let u = [-cam[1], cam[0]];
  const yAt = cast[you.id]?.at ?? [c[0] + u[0], c[1] + u[1]];
  const tAt = cast[them[0].id]?.at ?? [c[0] - u[0], c[1] - u[1]];
  if ((yAt[0] - tAt[0]) * u[0] + (yAt[1] - tAt[1]) * u[1] < 0) u = [-u[0], -u[1]];
  const Gof = p => GUARDS[p.arm] ?? GUARDS.fists;
  // (named-1: SIZES. Each body is drawn its own size (cast[id].size: the named cast's 0.9 to 1.25, else 1); every
  // length of a body here is the shared body's times its own: its reach, its head's depth, its stance)
  const sizeOf = p => cast[p.id]?.size ?? 1;
  const gap0 = (Gof(you).gap * sizeOf(you) + Gof(them[0]).gap * sizeOf(them[0])) / 2;
  /** which side of a body heading `yaw` the camera is on: +1 its R, −1 its L */
  const camSide = yaw => (Math.cos(yaw) * cam[0] - Math.sin(yaw) * cam[1] > 0 ? 1 : -1);
  const fighters = script.people.map((p, k0) => {
    const G = Gof(p);
    // (ONE-ON-ONE: the two ends of the line. SEVERAL: two sides, facing each other across the camera's view, every one
    // of them a step from anybody they will hit. You, and whoever is on your side beyond you from the camera (Cousin
    // Earl, where he covers nobody: out in front, half a step ahead of you; hunting, wide of you; one at a time, level;
    // else a little behind your shoulder); theirs across from you, the first across from you and the next beyond.
    // It was you in the middle with one of them each side: whoever was behind you hit the far side of your head, and
    // whoever had to come round you to somebody else never got there)
    const ally = p.side === 'ally';
    const j = them.indexOf(p);
    const k = ally ? -1 : !k0 ? 0 : j + 1;
    const s = k === 0 ? 1 : k === 1 ? -1 : 1;
    const row = gap0 / 2;
    const WING = many && script.people.length > 3 ? 0.95 : 0.7;
    const mine = script.people.some(q => q.side === 'ally');
    const way = { front: [0.3, 0], hunt: [0.15, 0.35], block: [0, 0], side: [-0.2, 0] }[p.way ?? 'side'] ?? [-0.2, 0];
    const spot = (along, across) => [c[0] + u[0] * along + cam[0] * across, c[1] + u[1] * along + cam[1] * across];
    const at = !many ? spot(k === 0 ? row : -row, 0)
      : ally ? spot(row - way[0], -WING - way[1])
      : k === 0 ? spot(row, mine ? WING : 0)
      : j < 2 ? spot(-row, j === 0 ? WING : -WING) : spot(-row - 1.15, 0);
    const mark0 = many && mine ? spot(row, WING) : spot(many ? row : row, 0);
    const toward = ally || k === 0 ? [-u[0], -u[1]] : unit(mark0[0] - at[0], mark0[1] - at[1]);
    const yaw = Math.atan2(toward[0], toward[1]);
    // (the strong hand on the camera's side: a body that leads L has its R hand strong, unless its style's is the lead)
    const strongR = (G.strong ?? 'R') === 'R';
    const lead = (camSide(yaw) > 0) === strongR ? -1 : 1;
    const F = createFighter({ id: p.id, x: at[0], z: at[1], yaw, lead, size: sizeOf(p) });
    Object.assign(F, { G, person: p, k: k0, ally, ph: (hash(seed, k0 + 91) % 1000) / 1000, up: track(0), free: -pre, n: 0, mark: { at, yaw }, hurt: track(0), calm: track(0), rifle: track(0), watch: track(0), s });
    // (the camera's side of this body, in the terms its poses are told in: a body that leads L is as told)
    F.cam = camSide(yaw) * (lead === -1 ? 1 : -1);
    F.guard = (P, t) => {
      guard(P, t, G, F.ph, F.up.at(t));
      const h = F.hurt.at(t);
      if (h > 0) beaten(P, t, h);
      const o = F.calm.at(t);
      if (o > 0) overPose(P, t, o);
      const r = F.rifle.at(t);
      if (r > 0) rifle(P, t, r);
      const w = F.watch.at(t);
      if (w > 0) watchOut(P, t, w);
    };
    return F;
  });
  const byId = Object.fromEntries(fighters.map(F => [F.id, F]));
  const me = fighters[0];
  const t0 = -pre;

  // ── SQUARING UP: out of the plain stand, the feet set, the hands come up (not both on the same beat) ──
  fighters.forEach((F, k) => {
    // (each to whoever is across from them)
    const foes = fighters.filter(q => q !== me && !q.ally);
    const friend = fighters.find(q => q.ally);
    F.aim(t0, 0.3, k === 0 ? foes[0] : F.ally ? foes[1] ?? foes[0] : friend && foes.indexOf(F) === 1 ? friend : me);
    const d = 0.1 * k + 0.12 * F.ph;
    // (the door bar: the first of them through it comes in hurt, and shakes it off as they square up)
    if (firstHurt && k === 1) {
      F.hurt.to(t0 - 0.01, t0, 0.8, E.lin);
      F.hurt.to(t0 + 0.5, t0 + pre + 0.4, 0, E.s);
    }
    F.up.to(t0 + d, t0 + d + 0.5, 1, E.s);
    F.split.to(t0 + d + 0.05, t0 + d + 0.4, F.G.split, E.s);
    F.blade.to(t0 + d + 0.05, t0 + d + 0.4, F.G.blade, E.s);
  });

  const tmp = [0, 0];
  const at = (F, t) => [...F.pos.at(t, tmp)];
  /**
   * A point kept on the fight's ground. `q`: whoever it is kept at its distance from (the other of the two): a point
   * that would be off the ground is swung round them onto it, the distance between the two kept, so one knocked back at
   * the ground's edge goes along the edge, never into the other. With no `q`, pulled straight back in.
   */
  const inside = (p, q = null) => {
    const off = (x, z) => Math.hypot(x - c[0], z - c[1]);
    if (off(p[0], p[1]) <= R) return p;
    if (q) {
      const [vx, vz] = [p[0] - q[0], p[1] - q[1]];
      // (no further round than a body is seen to go in a step or two: a sixth of a turn. Past that it is pulled
      // straight back in: swung half way round the other in a fifth of a second, the hips went and the feet did not)
      for (let a = 0.08; a <= 1.05; a += 0.08) {
        let best = null;
        for (const sg of [1, -1]) {
          const [cs, sn] = [Math.cos(a * sg), Math.sin(a * sg)];
          const [x, z] = [q[0] + vx * cs + vz * sn, q[1] - vx * sn + vz * cs];
          if (off(x, z) <= R && (!best || off(x, z) < off(best[0], best[1]))) best = [x, z];
        }
        if (best) return best;
      }
    }
    const d = off(p[0], p[1]);
    return [c[0] + ((p[0] - c[0]) / d) * R, c[1] + ((p[1] - c[1]) / d) * R];
  };
  /**
   * The way one stands off from another after a blow: the way they stood (`dir`, from the other to them), brought a
   * little back toward the line across the camera's view, so a fight that has swung round comes back side on.
   */
  const settle = dir => {
    const sg = dir[0] * u[0] + dir[1] * u[1] >= 0 ? 1 : -1;
    return unit(dir[0] + sg * u[0] * 0.3, dir[1] + sg * u[1] * 0.3);
  };
  /**
   * SEVERAL: whoever throws it comes at them clear of everybody else. Where they would stand to throw it (`dir` from
   * the one it is for, at `pv`) is nearer than a head and a bit to somebody who is not the one it is for: they come
   * round the one it is for, away from that body, by as much as clears it and no more than a sixth of a turn. Nothing
   * kept two on the same side apart, and some two heads were in each other for 62% of a door fight; with this, 35%.
   */
  /** Where everybody but `skip` stands at t (and, for whoever is on your side, the place between you and the camera: never stood in). */
  const othersAt = (t, A, ...skip) => {
    const out = [];
    for (const F of fighters) {
      if (F === A || skip.includes(F) || (F.out && F.out.t < t)) continue;
      out.push(at(F, t));
    }
    if (A?.ally) {
      const m = at(me, t);
      out.push([m[0] + cam[0] * 1.05, m[1] + cam[1] * 1.05]);
    }
    return out;
  };
  /**
   * SEVERAL: a place somebody is sent to (knocked back to, stepped out to) kept a head and a bit off everybody else's
   * at that moment: moved straight away from whoever it is too near, by what clears them. Nothing kept two on the same
   * side apart once a blow had sent one of them into the other.
   */
  const apart = (P, F, t, ...skip) => {
    if (!many) return P;
    let Q = P;
    for (let n = 0; n < 3; n++) {
      let moved = false;
      for (const q of othersAt(t, F, ...skip)) {
        const [dx, dz] = [Q[0] - q[0], Q[1] - q[1]];
        const d = Math.hypot(dx, dz);
        if (d >= 1.15) continue;
        const k = d > 0.05 ? (1.15 - d) / d : 0;
        Q = d > 0.05 ? [Q[0] + dx * k, Q[1] + dz * k] : [Q[0] + u[1] * 1.15, Q[1] - u[0] * 1.15];
        moved = true;
      }
      if (!moved) break;
    }
    return Q;
  };
  // (two who lean in on the same one from 1.15 m apart have their heads in each other: 1.4 m keeps the heads clear)
  const CLEAR = 1.4;
  const clearOf = (A, V, tc, pv, dir) => {
    if (!many) return dir;
    for (let n = 0; n < 3; n++) {
      const P = [pv[0] + dir[0] * 1.3, pv[1] + dir[1] * 1.3];
      let worst = null;
      for (const q of othersAt(tc, A, V)) {
        const d = Math.hypot(P[0] - q[0], P[1] - q[1]);
        if (d < CLEAR && (!worst || d < worst.d)) worst = { d, q };
      }
      if (!worst) break;
      // (which way round: the side of the line from the one it is for that the other body is not on)
      const cross = dir[0] * (worst.q[1] - pv[1]) - dir[1] * (worst.q[0] - pv[0]);
      const a = Math.min(0.45, (CLEAR - worst.d) / 1.3 + 0.05) * (cross > 0 ? 1 : -1);
      dir = [dir[0] * Math.cos(a) + dir[1] * Math.sin(a), -dir[0] * Math.sin(a) + dir[1] * Math.cos(a)];
    }
    return dir;
  };
  let busy = false;
  /** Where on V a blow lands (world), worked out when first asked for: V's own score says where V is then. */
  const targetOn = (V, tc, where, side, A = null) => {
    let got = null;
    return () => {
      // (asked for from inside another's pose being worked out, the one it lands on throwing their own: not now)
      if (got || !V.feet || busy) return got;
      busy = true;
      const pts = V.points(tc - 1e-3);
      busy = false;
      const s = side * (V.lead === -1 ? 1 : -1);
      if (A) {
        // (thrown from their side or from behind them, in a fight of several: it lands on the side of the head, or of
        // the body, that is toward whoever throws it, never on a face turned the other way)
        const hc = pts.headC;
        const fd = unit(pts.face[0] - hc[0], pts.face[2] - hc[2]);
        const pa = A.pos.at(tc);
        const ad = unit(pa[0] - hc[0], pa[1] - hc[2]);
        if (fd[0] * ad[0] + fd[1] * ad[1] < 0.3) {
          const low = where === 'ribs' || where === 'body' || where === 'belly';
          const o = low ? pts.chestC : hc;
          const r = low ? 0.2 : 0.43;
          got = [o[0] + ad[0] * r, where === 'crown' ? hc[1] + 0.36 : low ? o[1] : hc[1] - 0.1, o[2] + ad[1] * r];
          return got;
        }
      }
      got = where === 'face' ? pts.headAt([0.1 * s, 1.18, 0.45]) : where === 'corner' ? pts.headAt([0.42 * s, 1.12, 0.41]) : where === 'crown' ? pts.headAt([0.2 * s, 1.7, 0.28]) : where === 'ribs' ? pts.chestAt([0.2 * s, 0.62, 0.1]) : pts.chestAt([0.06 * s, 0.62, 0.17]);
      return got;
    };
  };

  // ── EVERY BLOW OF THE SCRIPT ──
  script.beats.forEach((b, i) => {
    const A = byId[b.by];
    const V = byId[b.to];
    if (!A || !V || b.spent || V.out || A.out) return;
    const tc = b.t;
    const G = A.G;
    // (ON THE GROUND, thrown and not up yet: nothing is staged for them. It was: the lunge of a blow thrown while they
    // lay there was written into their place before the getting up, which then never put the plan where they stood up,
    // and everything after it was thrown at where they had been. What the rules have it land all the same shows on
    // the other: the number, and a flinch)
    if ((A.downUntil ?? -9) > tc - 0.3) {
      b.staged = 'on the ground';
      if (b.hit && !V.out && (V.downUntil ?? -9) < tc) {
        fx.push({ t: tc, kind: 'hit', by: A.id, to: V.id, w: 0.35, at: () => (V.feet ? V.points(tc - 1e-3).chestC : null), dmg: b.dmg });
        V.act({ t0: tc, t1: tc + 0.42, in: 0.012, out: 0.14, fn: (P, s) => HURT.body(P, s, { w: 0.35, from: 0.4, dur: 0.4 }) });
        if (b.down) fall(V, A, tc, { how: 'fold', w: 0.4 });
      }
      return;
    }
    const r = hash(seed, i * 7 + A.k * 131 + 3);
    let name = b.hit && b.dmg >= 15 ? G.big : pick(G.blows, r);
    // (the last blow of the fight is the one they are known for; two the same in a row only when it is all they have)
    if (b.down) name = G.big;
    else if (A.lastBlow === name && G.blows.length > 1 && !G.combo) name = pick(G.blows.filter(([n]) => n !== name), r >>> 3);
    A.lastBlow = name;
    A.lastT = tc;
    A.n += 1;
    b.staged = name;
    if (name === 'throw' || name === 'clinch') {
      // (a hold needs its time and the rules' hold: with neither, it is a shove that takes them off balance)
      // (covering a blow does not stop them going in after it; being hit does, and their own last one)
      const room = tc - Math.max(A.hitFree ?? -9, A.ownFree ?? -9);
      const vUp = (V.downUntil ?? -9) < tc - 0.62;
      if (name === 'throw' && vUp && room > 0.5 && (!b.hit || b.hold > 0 || b.down)) return throwBeat(A, V, b, i);
      if (name === 'clinch' && vUp && room > 0.3 && (!b.hit || b.hold > 0)) return clinchBeat(A, V, b, i);
      name = 'shove';
      b.staged = `${b.staged} (a shove)`;
    }
    const B = BLOWS[name] ?? BLOWS.cross;
    // (what wind-up there is time for: from when they are free of the last thing)
    const ant = Math.max(0.05, Math.min(B.ant, tc - B.go - A.free));
    const ta = tc - B.go - ant;
    if (many && A.facingAt !== V) {
      // (between two: round to the one this is for, the head and chest first, the feet after; never whipped round)
      const tt = Math.max(A.free, ta - 0.4);
      const [pA, pV] = [at(A, tt), at(V, tt)];
      const turn = Math.abs(Math.atan2(Math.sin(Math.atan2(pV[0] - pA[0], pV[1] - pA[1]) - A.facing(tt)), Math.cos(Math.atan2(pV[0] - pA[0], pV[1] - pA[1]) - A.facing(tt))));
      A.aim(tt, Math.max(0.22, turn / 5.5), V);
      A.facingAt = V;
    }
    // (somebody on the ground: nothing moves them, and it is thrown down at where they lie)
    const vDown = (V.downUntil ?? -9) > tc;
    // WHERE THEY ARE: the other where their own score has them at contact; the one who throws it at its distance
    const pv = vDown ? [...V.lieAt] : at(V, tc);
    const pa = at(A, Math.max(ta, A.free));
    const dir = clearOf(A, V, tc, pv, unit(pa[0] - pv[0], pa[1] - pv[1]));
    // (how near: the fist on its place, measured from each one's own head; and the two heads clear of each other. The
    // other in the middle of a blow of their own is leaning in as far as this one is)
    const gA = geomOf(G, name);
    const busyV = V.free > tc - 0.12 && V.lastT !== undefined && Math.abs(V.lastT - tc) < 0.3;
    const [sA, sV] = [A.size, V.size];
    const hV = (busyV ? geomOf(V.G, V.lastBlow).head : geomOf(V.G, null).head) * sV;
    const dc = Math.max(gA.fist * sA + hV + OFF[B.at] * sV, (HEADS * (sA + sV)) / 2 + gA.head * sA + hV);
    // (the whole of the lunge is the hips': they stand off by it, and close it as the blow goes)
    const half = B.lunge * sA;
    const sep = Math.hypot(pa[0] - pv[0], pa[1] - pv[1]);
    const stand = dc + half;
    // (and where they go back out to after it: their own distance)
    // (two on one: whoever is not hitting stands well off, so it is one at a time on you and never a knot of three)
    const out = Math.max(stand, (G.gap * sA + V.G.gap * sV) / 2) + (many && A !== me && !A.ally ? 0.35 : 0);
    // (too far or too near to throw it from: stepped to the distance while winding up)
    // (A LONG WAY TO COME, in a fight of several to somebody else, or back from where a blow sent them: they set out
    // as soon as they are free of the last thing, at a walk, and are there for the wind-up. Setting out 0.3 s before
    // it, as two who stand at their distance do, they threw it from wherever they had got to: at nobody)
    const tLunge = tc - B.go - 0.035;
    const tStep = Math.max(A.free, Math.min(ta - 0.3, tLunge - 0.12 - Math.max(0, sep - stand) / WALK_IN));
    let far = Math.max(0, sep - stand);
    if (Math.abs(sep - stand) > 0.05 && tLunge - tStep > 0.06) {
      // (no faster than a body steps: what is left of the distance, the other comes in to meet)
      const t1s = Math.max(tStep + 0.1, tLunge - 0.02);
      // (a quick shuffle of two steps, and after it no faster than a walk: what the feet can do, or the hips go on
      // without them)
      const can = Math.min(STEP_V * (t1s - tStep), 0.57 + WALK_IN * 1.15 * Math.max(0, t1s - tStep - 0.3));
      const short = Math.min(can, Math.max(0, sep - stand - can));
      // (the other comes in to meet only when free to: not out of a blow of their own, nor off the ground)
      if (short > 0.02 && !vDown && V.free <= tStep + 0.05) {
        pv[0] += dir[0] * short;
        pv[1] += dir[1] * short;
        V.pos.to(tStep, t1s, [pv[0], pv[1]], E.s);
      }
      // (still too far: thrown from where they have got to; it is the lunge that is longer, never the feet faster)
      const got = Math.max(stand, Math.hypot(pa[0] - pv[0], pa[1] - pv[1]) - can);
      A.pos.to(tStep, t1s, inside([pv[0] + dir[0] * got, pv[1] + dir[1] * got], pv), E.s);
      far = got - stand;
    }
    // THE LUNGE: the front foot steps in (the stance opens by it), the hips go half that; the back foot stays where it is
    // (from too far it is a longer lunge by a foot's length at the most: past that it lands short, and the hips are
    // never sent where no step can take them)
    const past = (b.hit ? 0 : 0.05) - Math.max(0, far - 0.28);
    A.pos.to(tLunge, tc - 0.006, inside([pv[0] + dir[0] * (dc - past), pv[1] + dir[1] * (dc - past)], pv), E.s);
    A.split.to(tLunge - 0.02, tc - 0.01, Math.min(0.52, G.split + B.lunge * 0.8), E.s);
    // (which side of the one it lands on that is: the camera's for a strong hand, both strong hands being on its side)
    const vSide = B.hand === 'W' ? -V.cam : V.cam;
    const target = targetOn(V, tc, B.at, vSide * (V.lead === -1 ? 1 : -1), many ? A : null);
    const K = { ant, go: B.go, fol: B.fol, rec: B.rec, hit: b.hit, G, tgt: null };
    A.act({ t0: ta, t1: tc + B.fol + B.rec, in: Math.min(0.09, ant * 0.6), out: B.rec * 0.7, fn(P, s) {
      K.tgt = target();
      K.hit = b.hit && !!K.tgt;
      const ty = P.ty;
      B.pose(P, s - (tc - ta), K);
      // (the head goes some of the way round with the shoulders: from above it is the head that says a blow is coming)
      P.hy += 0.42 * (P.ty - ty);
    } });
    A.free = tc + B.fol * 0.7;
    A.ownFree = A.free;
    const from = vSide * (B.at === 'face' || B.at === 'body' ? 0.4 : 1);
    if (b.hit) {
      const W = WEAPONS[b.arm] ?? WEAPONS.hands;
      const w = Math.max(0.15, Math.min(1, (b.dmg / 24) * 0.55 + B.weight * 0.45));
      // (how far it moves them: the rules' own throw back for the weapon and their heft, and a little that any blow does)
      // (and no further than they have the time to come back from: one who throws their own next blow soon after is
      // not sent a metre off first)
      const nextV = script.beats.find(x => x.by === V.id && x.t > tc + 1e-6)?.t ?? 1e9;
      const knock = Math.min(1.15, 0.1 + (W.knock ?? 0.25) * (V.person.heft ?? 1), Math.max(0.16, 0.95 * (nextV - tc - 0.42)));
      const hold = 0.03 + 0.06 * w;
      A.stop(tc, hold);
      V.stop(tc, hold);
      fx.push({ t: tc, kind: 'hit', by: A.id, to: V.id, w, at: target, dmg: b.dmg, blow: name, held: A.G.held ?? null });
      const back = inside(apart([pv[0] - dir[0] * knock, pv[1] - dir[1] * knock], V, tc + 0.3, A), [pv[0] + dir[0] * dc, pv[1] + dir[1] * dc]);
      if (vDown) {
        // (hit where they lie: the star and the number are all of it)
      } else if (b.down) {
        // THE LAST ONE: they go down where it leaves them
        fall(V, A, tc, { how: name === 'hay' ? 'spin' : B.at === 'body' || B.at === 'ribs' ? 'fold' : 'out', w, from });
      } else {
        const dur = 0.36 + 0.3 * w + (knock > 0.5 ? 0.25 : 0);
        // (from behind, one of two: they are not facing whoever threw it)
        const toA = Math.atan2(pa[0] - pv[0], pa[1] - pv[1]);
        const behind = many && Math.abs(Math.atan2(Math.sin(toA - V.facing(tc)), Math.cos(toA - V.facing(tc)))) > 1.9;
        const kind = behind ? HURT.behind : B.at === 'body' || B.at === 'ribs' ? HURT.body : B.at === 'crown' ? HURT.crown : HURT.head;
        V.act({ t0: tc, t1: tc + dur + 0.05, in: 0.012, out: 0.12, fn: (P, s) => {
          kind(P, s, { w, from, dur });
          if (knock > 0.4) HURT.stagger(P, s, { w: Math.min(1, knock), dur: dur + 0.05 });
        } });
        // knocked back: fast off the blow and slowing, the feet catching up under them
        V.pos.to(tc, tc + 0.2 + 0.34 * Math.min(1, knock), back, E.out3);
        V.split.to(tc, tc + 0.2, V.G.split, E.s);
        V.free = Math.max(V.free, tc + 0.16 + 0.14 * w + (knock > 0.5 ? 0.2 : 0));
        V.hitFree = V.free;
      }
      // the one who threw it: checked a beat on them, then back onto both feet where the lunge began
      const vAt = vDown || b.down ? pv : back;
      const sd = settle(unit(pv[0] + dir[0] * dc - vAt[0], pv[1] + dir[1] * dc - vAt[1]));
      A.pos.to(tc + B.fol * 0.8 + hold, tc + B.fol + hold + B.rec * 0.7, inside(apart([vAt[0] + sd[0] * out, vAt[1] + sd[1] * out], A, tc + B.fol + hold + B.rec * 0.7, V), vAt), E.s);
      A.split.to(tc + B.fol * 0.8 + hold, tc + B.fol + hold + B.rec * 0.6, G.split, E.s);
    } else {
      const cover = B.cover[(hash(seed, i * 13 + 5) >>> 4) % B.cover.length];
      const sgn = hash(seed, i * 5 + 1) & 1 ? 1 : -1;
      const dur = 0.34;
      // (in the middle of their own blow they do not cover: it simply does not find them)
      const own = V.free > tc - 0.05 || vDown;
      if (!own) {
        V.act({ t0: tc - 0.2, t1: tc + dur, in: 0.05, out: 0.12, fn: (P, s) => COVER[cover](P, s - 0.2, { from: cover === 'slip' ? sgn : from, dur, w: B.weight }) });
        if (cover === 'pull' || cover === 'hop') {
          const d = cover === 'hop' ? 0.26 : 0.12;
          V.pos.to(tc - 0.15, tc - 0.01, inside([pv[0] - dir[0] * d, pv[1] - dir[1] * d], [pv[0] + dir[0] * dc, pv[1] + dir[1] * dc]), E.out);
        }
        V.free = Math.max(V.free, tc + 0.06);
      }
      fx.push({ t: tc, kind: own ? 'miss' : cover, by: A.id, to: V.id, at: target, blow: name });
      // (thrown at nothing, it carries them a little past; then back)
      const sd = settle(dir);
      A.pos.to(tc + B.fol * 0.9, tc + B.fol + B.rec * 0.75, inside(apart([pv[0] + sd[0] * out, pv[1] + sd[1] * out], A, tc + B.fol + B.rec * 0.75, V), pv), E.s);
      A.split.to(tc + B.fol * 0.9, tc + B.fol + B.rec * 0.6, G.split, E.s);
    }
  });

  // ── THE END ──
  const tOver = script.over.t ?? script.seconds;
  /**
   * `V` is off their feet from `t`: `pose(P, s, K)` the going down (s from t) and lying after; the root where the feet
   * left them. → the record of it (getUp stands them again). `key`: its name in the fight, for the second pass.
   */
  function layDown(V, t, key, pose, K) {
    const rec = { t, K, key, up: undefined };
    V.aim(t - 0.01, 0.01, V.facing(t - 0.01));
    // (where the going down leaves the body: its root turned and moved by the pose's own end, K.end, told L-leading)
    const m = V.lead === -1 ? 1 : -1;
    const stood = Dn => {
      const e = K.end ?? { ry: K.spin ?? 0, mx: 0, mz: 0 };
      const z = downFeet(Dn.feet0);
      const ry = e.ry * m;
      const [c, sn] = [Math.cos(ry), Math.sin(ry)];
      // (stood up, the hips are over the feet: the body has gone back by as much as the feet were behind it)
      const [mx, mz, pz] = [e.mx * m + sn * z, e.mz + c * z, z - 0.15];
      // a ground point of the body, turned about its heels and moved, in the world
      const P = (x, zz) => {
        const [dx, dz] = [x, zz - pz];
        return toWorld([(c * dx + sn * dz + mx) * V.size, 0, (pz - sn * dx + c * dz + mz) * V.size], Dn.root.x, 0, Dn.root.z, Dn.root.yaw);
      };
      const [L, Rr, H] = [P(-RIG.hipX, RIG.hipZ), P(RIG.hipX, RIG.hipZ), P(0, RIG.hipZ)];
      return { L: [L[0], L[2]], R: [Rr[0], Rr[2]], yaw: Dn.root.yaw + ry, at: [H[0], H[2]] };
    };
    const D = { t0: t, t1: 1e9, land: Dn => stood(Dn), entered: Dn => {
      K.feet = Dn.feet0;
      rec.entered?.(Dn);
      roots.set(key, stood(Dn));
    } };
    rec.D = D;
    V.down(D);
    V.act({ t0: t, t1: 1e9, in: 0.012, out: 0, fn: (P, s) => {
      // (on their feet again: nothing of it is left on the pose)
      if (rec.up !== undefined && s >= rec.up - t + rec.upDur) return undefined;
      if (rec.up !== undefined && s >= rec.up - t) return rise(P, s - (rec.up - t), { ...K, dur: rec.upDur, quick: rec.quick, lain: rec.up - t - (rec.still ?? 0.6) });
      return pose(P, s, K);
    } });
    return rec;
  }
  /** `V` goes down at `t` for good, put there by `A`: the fall, then lying where it leaves them. */
  function fall(V, A, t, { how = 'out', w = 0.7, from = 0 } = {}) {
    const Fm = how === 'fold' ? FALLS.fold : FALLS.out;
    const K = { w, from, feet: [[0, 0, 0], [0, 0, 0]], spin: how === 'spin' ? from * -0.9 : from * -0.25 * w, curl: true };
    K.end = { ry: K.spin, mx: 0, mz: 0 };
    V.out = layDown(V, t, `out:${V.id}`, Fm.pose, K);
    V.out.still = Fm.still;
    V.fallen = { t, A };
  }
  /** Where a body put down under `key` stands when it is up again (its hips, the world), once that is known. */
  function upAt(key) {
    const r = known.get(key);
    return r ? { at: r.at, yaw: r.yaw } : null;
  }
  /** They get up again from `t`, over `dur` s: back on the feet they went down over; the score has them there from then. */
  function getUp(V, rec, t, dur, quick = false) {
    Object.assign(rec, { up: t, upDur: dur, quick });
    rec.D.t1 = t + dur;
    const tr = t + dur;
    const U = upAt(rec.key);
    const here = U?.at ?? at(V, rec.t);
    V.pos.put(tr - 0.03, tr - 0.01, here, E.lin);
    V.split.to(tr - 0.03, tr - 0.01, 0, E.lin);
    V.blade.to(tr - 0.03, tr - 0.01, 0, E.lin);
    if (U) V.aim(tr - Math.min(0.5, dur * 0.5), Math.min(0.4, dur * 0.4), U.yaw);
    return { at: here, t: tr };
  }

  // ── THE THROW: taken hold of, turned over the hip, put on the ground on the far side ──
  function throwBeat(A, V, b, i) {
    const tc = b.t;
    const G = A.G;
    const pv = at(V, tc - 0.6);
    const pa = at(A, Math.max(tc - 0.7, A.free));
    const dir = clearOf(A, V, tc, pv, unit(pa[0] - pv[0], pa[1] - pv[1]));
    const gV = geomOf(V.G, null);
    const dT = (HEADS * (A.size + V.size)) / 2 + 0.34 * A.size + gV.head * V.size;
    const key = `throw:${i}`;
    A.pos.to(Math.max(A.free, tc - 0.74), tc - 0.44, [pv[0] + dir[0] * dT, pv[1] + dir[1] * dT], E.s);
    A.split.to(tc - 0.7, tc - 0.45, 0.2, E.s);
    const grip = (() => {
      let last = null;
      return () => {
        if (busy || !V.feet) return last;
        busy = true;
        last = V.points(A.clock(A.tNow ?? tc)).headAt([0, 0.98, 0.4]);
        busy = false;
        return last;
      };
    })();
    const full = b.hit;
    A.act({ t0: tc - 0.66, t1: tc + (full ? 0.8 : 0.45), in: 0.08, out: 0.3, fn: (P, s, t) => {
      A.tNow = t;
      HOLDS.throwA(P, s - 0.66, { G, hit: full, grip });
    } });
    if (!full) {
      // HE CANNOT TURN THEM: they sit back against it; he lets go and both step out
      V.act({ t0: tc - 0.6, t1: tc + 0.35, in: 0.08, out: 0.2, fn: (P, s) => HOLDS.sprawl(P, s - 0.6, {}) });
      V.free = Math.max(V.free, tc + 0.1);
      A.free = tc + 0.2;
      A.ownFree = A.free;
      const out = (G.gap * A.size + V.G.gap * V.size) / 2;
      A.pos.to(tc + 0.05, tc + 0.4, [pv[0] + dir[0] * out, pv[1] + dir[1] * out], E.s);
      A.split.to(tc + 0.05, tc + 0.35, G.split, E.s);
      fx.push({ t: tc - 0.02, kind: 'block', by: A.id, to: V.id, at: grip });
      return;
    }
    // (round him on the camera's side, where it is seen: the way that swings them toward it)
    const v = [-dir[0], -dir[1]];
    const sgn = v[1] * cam[0] - v[0] * cam[1] > 0 ? 1 : -1;
    const turn = sgn * 2.75;
    const m = V.lead === -1 ? 1 : -1;
    const K = { w: 0.8, from: 0, feet: [[0, 0, 0], [0, 0, 0]], spin: 0, turn: turn * m, r0: dT, toward: 0, curl: !b.down };
    const t0 = tc - 0.34;
    const rec = layDown(V, t0, key, (P, s) => HOLDS.thrownV(P, s - 0.34, K), K);
    rec.still = 0.34 + 0.2;
    rec.entered = Dn => {
      // (where he is from their heels as it starts, in their own frame)
      const ah = [...A.pos.at(t0, tmp)];
      const hb = toBody([ah[0], 0, ah[1]], Dn.root.x, 0, Dn.root.z, Dn.root.yaw).map(v => v / V.size);
      const z = downFeet(Dn.feet0) - 0.15;
      K.r0 = Math.hypot(hb[0], hb[2] - z);
      K.toward = Math.atan2(hb[0], hb[2] - z) * m;
      K.end = thrownEnd(K);
    };
    // he turns with them and ends over them
    const f0 = A.facing(tc - 0.36);
    A.aim(tc - 0.34, 0.3, f0 + turn * 0.62);
    const hold = 0.07;
    A.stop(tc, hold);
    V.stop(tc, hold);
    const land = [pa[0], pa[1]];
    fx.push({ t: tc, kind: 'slam', by: A.id, to: V.id, w: 1, at: () => (V.feet ? V.points(tc + 0.01).chestC : null), dmg: b.dmg });
    void land;
    if (b.down) {
      V.out = rec;
      V.fallen = { t: tc, A };
      A.free = tc + 0.5;
      return;
    }
    // UP AGAIN, as the rules let them go: a scramble; and the two find their distance from where they now are
    const h = Math.max(0.35, b.hold);
    const dur = Math.max(0.36, Math.min(0.75, h * 0.6));
    const up = getUp(V, rec, tc + Math.max(0.1, h - dur), dur, true);
    V.free = up.t;
    V.downUntil = up.t;
    V.lieAt = up.at;
    V.aim(up.t - 0.25, 0.3, A);
    V.split.to(up.t, up.t + 0.25, V.G.split, E.s);
    V.blade.to(up.t, up.t + 0.25, V.G.blade, E.s);
    A.free = tc + 0.45;
    A.ownFree = A.free;
    V.hitFree = up.t;
    A.aim(tc + 0.3, 0.35, V);
    const d2 = unit(pa[0] - up.at[0], pa[1] - up.at[1]);
    const out = (G.gap * A.size + V.G.gap * V.size) / 2;
    A.pos.to(tc + 0.4, Math.max(tc + 0.8, up.t - 0.1), inside([up.at[0] + d2[0] * out, up.at[1] + d2[1] * out], up.at), E.s);
    A.split.to(tc + 0.4, tc + 0.8, G.split, E.s);
  }

  // ── THE GRAB: both hands on their head, wrenched about for as long as the rules hold the two of them, thrown off ──
  function clinchBeat(A, V, b, i) {
    const tc = b.t;
    const G = A.G;
    const pv = at(V, tc);
    const pa = at(A, Math.max(tc - 0.4, A.free));
    const dir = clearOf(A, V, tc, pv, unit(pa[0] - pv[0], pa[1] - pv[1]));
    const gV = geomOf(V.G, null);
    const dC = (HEADS * (A.size + V.size)) / 2 + 0.26 * A.size + gV.head * V.size;
    A.pos.to(Math.max(A.free, tc - 0.36), tc - 0.02, [pv[0] + dir[0] * (b.hit ? dC : dC - 0.1), pv[1] + dir[1] * (b.hit ? dC : dC - 0.1)], E.s);
    const h = b.hit ? Math.max(0.3, b.hold) : 0;
    const grip = (() => {
      let last = null;
      return () => {
        if (busy || !V.feet) return last;
        busy = true;
        const pts = V.points(A.clock(A.tNow ?? tc));
        last = [pts.headAt([-0.5, 1.12, 0.3]), pts.headAt([0.5, 1.12, 0.3])];
        // (his L hand on the side of their head that is to his L)
        if (A.lead === V.lead) last.reverse();
        busy = false;
        return last;
      };
    })();
    A.act({ t0: tc - 0.36, t1: tc + h + 0.4, in: 0.07, out: 0.25, fn: (P, s, t) => {
      A.tNow = t;
      HOLDS.clinchA(P, s - 0.36, { hit: b.hit, h, grip });
    } });
    const out = (G.gap * A.size + V.G.gap * V.size) / 2;
    if (!b.hit) {
      V.act({ t0: tc - 0.2, t1: tc + 0.34, in: 0.05, out: 0.12, fn: (P, s) => COVER.hop(P, s - 0.2, { from: 0, dur: 0.34 }) });
      V.pos.to(tc - 0.16, tc - 0.01, inside([pv[0] - dir[0] * 0.26, pv[1] - dir[1] * 0.26], pa), E.out);
      V.free = Math.max(V.free, tc + 0.06);
      A.free = tc + 0.2;
      A.pos.to(tc + 0.12, tc + 0.5, [pv[0] + dir[0] * out, pv[1] + dir[1] * out], E.s);
      fx.push({ t: tc, kind: 'hop', by: A.id, to: V.id, at: () => null });
      return;
    }
    // (the two wrenched the same way at once: told to each as their own body has it)
    V.act({ t0: tc - 0.02, t1: tc + h + 0.3, in: 0.02, out: 0.2, fn: (P, s) => HOLDS.clinchV(P, s - 0.02, { h }) });
    A.stop(tc, 0.06);
    V.stop(tc, 0.06);
    fx.push({ t: tc, kind: 'hit', by: A.id, to: V.id, w: 0.6, at: () => (V.feet ? V.points(tc - 1e-3).headAt([0, 1.2, 0.45]) : null), dmg: b.dmg });
    if (b.down) return fall(V, A, tc + 0.05, { how: 'fold', w: 0.6 });
    // thrown off at the end of it: they go back a step and a half, he comes off them
    V.pos.to(tc + h - 0.04, tc + h + 0.36, inside([pv[0] - dir[0] * 0.5, pv[1] - dir[1] * 0.5], [pv[0] + dir[0] * dC, pv[1] + dir[1] * dC]), E.out3);
    V.act({ t0: tc + h - 0.04, t1: tc + h + 0.5, in: 0.03, out: 0.15, fn: (P, s) => HURT.stagger(P, s, { w: 0.6, dur: 0.5 }) });
    A.pos.to(tc + h + 0.05, tc + h + 0.5, [pv[0] + dir[0] * out, pv[1] + dir[1] * out], E.s);
    A.free = tc + h + 0.1;
    A.ownFree = A.free;
    V.free = Math.max(V.free, tc + h + 0.12);
    V.hitFree = V.free;
  }
  // (a spent body with no last blow: it folds by itself)
  for (const b of script.beats) {
    if (!b.spent) continue;
    const V = byId[b.to];
    if (V && !V.out) fall(V, byId[b.by] ?? me, b.t, { how: 'fold', w: 0.4 });
  }
  const won = script.over.result === 'won';
  // (sixes-1: whoever is on your side is neither the last of them down nor the one who goes through your pockets)
  const mine = fighters.filter(F => F.ally);
  /**
   * A place somebody steps back to once it is over: kept within a step past the fight's own ground (the ground looked
   * for is open a metre past it), pulled straight in from further. Held to the fight's own ground, one backing off
   * from somebody lying at its edge was pulled back in onto them.
   */
  const offTo = p => {
    const d = Math.hypot(p[0] - c[0], p[1] - c[1]);
    return d <= R + 0.9 ? p : [c[0] + ((p[0] - c[0]) / d) * (R + 0.9), c[1] + ((p[1] - c[1]) / d) * (R + 0.9)];
  };
  const losers = fighters.filter(F => F.out && !F.ally);
  const winners = fighters.filter(F => !F.out && !F.ally);
  /** Cousin Earl once it is over: down, he gets up when the rest is done; up, his guard comes down where he stands. */
  const allyAfter = tEnd => {
    let end = tEnd;
    for (const F of mine) {
      if (F.out) {
        getUp(F, F.out, Math.max(F.fallen.t + 1.0, Math.min(tEnd - 1.3, tOver + 0.5)), 1.2);
        F.up.to(F.fallen.t, F.fallen.t + 0.1, 0, E.s);
        F.hurt.to(F.out.up + 0.75, F.out.up + 1.15, 1, E.s);
        F.hurt.to(Math.max(tEnd + 0.05, F.out.up + 1.3), Math.max(tEnd + 0.3, F.out.up + 1.6), 0, E.s);
        end = Math.max(end, tEnd + 0.3);
      } else {
        F.up.to(tOver + 0.8, tOver + 1.6, 0, E.s);
        F.split.to(tOver + 0.8, tOver + 1.4, 0.04, E.s);
        F.blade.to(tOver + 0.8, tOver + 1.4, 0, E.s);
      }
    }
    return end;
  };
  // (once it is over the legs go the way the body is going: fighter.js stanceYaw)
  for (const F of fighters) F.walksFrom = tOver + 0.45;
  let t1 = tOver + 1;
  if (!many && fighters.filter(F => F.out).length === 1) {
    const [Lz] = losers;
    const [Wn] = winners;
    const tf = Lz.fallen.t;
    const pl = at(Lz, tf);
    const pw = at(Wn, tf + 0.3);
    const dir = unit(pw[0] - pl[0], pw[1] - pl[1]);
    // THE WINNER: the guard comes down slowly; he walks up and stands over them, looking down, getting his breath
    Wn.up.to(tf + 0.35, tf + 0.9, 0.25, E.s);
    Wn.calm.to(tf + 0.4, tf + 1.0, 1, E.s);
    Wn.split.to(tf + 0.35, tf + 0.8, 0.08, E.s);
    Wn.blade.to(tf + 0.35, tf + 0.8, 0, E.s);
    Wn.pos.to(tf + 0.4, tf + 1.05, [pl[0] + dir[0] * 0.78, pl[1] + dir[1] * 0.78], E.s);
    if (won) {
      // YOU WON: they come round, get up slowly, hurt, and back off; you give them the room
      const tu = tf + 1.4;
      const up = getUp(Lz, Lz.out, tu, 1.25);
      void up;
      Wn.pos.to(tu + 0.05, tu + 0.7, [pl[0] + dir[0] * 1.3, pl[1] + dir[1] * 1.3], E.s);
      Wn.calm.to(tu + 0.9, tu + 1.4, 0, E.s);
      Wn.up.to(tu + 0.9, tu + 1.4, 0, E.s);
      Lz.up.to(tf, tf + 0.1, 0, E.s);
      // (up, hurt, and that is the end of it here: the backing off is the hour's own scene, where they go)
      Lz.hurt.to(tu + 0.75, tu + 1.2, 1, E.s);
      Lz.hurt.to(tu + 1.35, tu + 1.7, 0, E.s);
      t1 = tu + 1.45;
    } else {
      // YOU LOST: he looks at you a moment, turns his back and walks off; then you get up, slowly
      const tl = tf + 0.9;
      Wn.calm.to(tl, tl + 0.5, 0, E.s);
      Wn.up.to(tl, tl + 0.5, 0, E.s);
      // (his back to you, the way he goes: where the ground lets him, which is not always straight off)
      // (two steps of it are seen: control is back as he goes)
      const off = inside([pl[0] + dir[0] * 1.8, pl[1] + dir[1] * 1.8], pl);
      const from = at(Wn, tl);
      Wn.aim(tl, 1.2, Math.hypot(off[0] - from[0], off[1] - from[1]) > 0.3 ? Math.atan2(off[0] - from[0], off[1] - from[1]) : Math.atan2(dir[0], dir[1]));
      Wn.pos.to(tl + 0.35, tl + 1.9, off, E.s);
      // (he is well off before you stir)
      const tu = tf + 1.5;
      getUp(Lz, Lz.out, tu, 1.3);
      Lz.up.to(tf, tf + 0.1, 0, E.s);
      Lz.hurt.to(tu + 0.8, tu + 1.25, 1, E.s);
      Lz.hurt.to(tu + 1.4, tu + 1.7, 0, E.s);
      t1 = tu + 1.5;
    }
  } else if (many && !won && me.out) {
    // JUMPED, AND BEATEN: the nearest of them goes through your pockets where you lie while the other keeps watch;
    // they have it and back off; you get up, slowly. (They run off after: the hour's own scene, demo/run/acted.js)
    const tf = me.fallen.t;
    const pl = known.get(`out:${me.id}`)?.at ?? at(me, tf);
    // (whoever of them is on the ground themselves as you go down, thrown a moment before, gets up where they are:
    // it is the others who come over to you)
    const up = winners.filter(F => (F.downUntil ?? -9) < tf + 0.2).sort((a, b) => Math.hypot(...[0, 1].map(k => at(a, tf)[k] - pl[k])) - Math.hypot(...[0, 1].map(k => at(b, tf)[k] - pl[k])));
    const [taker, ...rest] = up;
    // (where you lie: from your feet, back along the way you fell)
    const root = known.get(`out:${me.id}`);
    const lie = root ? [pl[0] - Math.sin(root.yaw) * 0.55, pl[1] - Math.cos(root.yaw) * 0.55] : pl;
    for (const F of up) {
      F.up.to(tf + 0.3, tf + 0.9, 0.15, E.s);
      F.split.to(tf + 0.3, tf + 0.8, 0.08, E.s);
      F.blade.to(tf + 0.3, tf + 0.8, 0, E.s);
    }
    if (taker) {
      const pt = at(taker, tf + 0.4);
      const d = unit(pt[0] - lie[0], pt[1] - lie[1]);
      taker.aim(tf + 0.4, 0.4, me);
      taker.pos.to(tf + 0.35, tf + 0.9, [lie[0] + d[0] * 0.7, lie[1] + d[1] * 0.7], E.s);
      taker.rifle.to(tf + 0.8, tf + 1.05, 1, E.s);
      taker.rifle.to(tf + 1.55, tf + 1.8, 0, E.s);
      taker.pos.to(tf + 1.75, tf + 2.6, offTo([lie[0] + d[0] * 1.9, lie[1] + d[1] * 1.9]), E.s);
    }
    for (const F of rest) {
      const pt = at(F, tf + 0.4);
      const d = unit(pt[0] - lie[0], pt[1] - lie[1]);
      F.pos.to(tf + 0.4, tf + 1.0, offTo([lie[0] + d[0] * 1.5, lie[1] + d[1] * 1.5]), E.s);
      F.watch.to(tf + 0.7, tf + 1.0, 1, E.s);
      F.watch.to(tf + 1.6, tf + 1.85, 0, E.s);
      F.pos.to(tf + 1.8, tf + 2.6, offTo([lie[0] + d[0] * 2.2, lie[1] + d[1] * 2.2]), E.s);
    }
    for (const F of up) F.up.to(tf + 1.8, tf + 2.3, 0, E.s);
    const tu = tf + 1.75;
    getUp(me, me.out, tu, 1.3);
    me.up.to(tf, tf + 0.1, 0, E.s);
    me.hurt.to(tu + 0.8, tu + 1.25, 1, E.s);
    me.hurt.to(tu + 1.4, tu + 1.7, 0, E.s);
    t1 = allyAfter(tu + 1.45);
  } else if (many && won && losers.length) {
    // JUMPED, AND SEEN OFF: you stand over the last of them; they come round, get up one after the other, hurt, and
    // back off from you. (They run off after: the hour's own scene)
    const tf = Math.max(...losers.map(F => F.fallen.t));
    const lastDown = losers.find(F => F.fallen.t === tf) ?? losers[0];
    const pl = known.get(`out:${lastDown.id}`)?.at ?? at(lastDown, tf);
    const pw = at(me, tf + 0.3);
    const dir = unit(pw[0] - pl[0], pw[1] - pl[1]);
    me.aim(tf + 0.3, 0.4, pl[0] === pw[0] && pl[1] === pw[1] ? me.facing(tf) : Math.atan2(pl[0] - pw[0], pl[1] - pw[1]));
    me.up.to(tf + 0.35, tf + 0.9, 0.25, E.s);
    me.calm.to(tf + 0.4, tf + 1.0, 1, E.s);
    me.split.to(tf + 0.35, tf + 0.8, 0.08, E.s);
    me.blade.to(tf + 0.35, tf + 0.8, 0, E.s);
    // (a body and a bit off where the last of them lies: they get up there, and nobody has to step apart after)
    me.pos.to(tf + 0.4, tf + 1.0, inside([pl[0] + dir[0] * 1.25, pl[1] + dir[1] * 1.25]), E.s);
    let end = tf + 1.6;
    const gone = [];
    losers.forEach((Lz, k) => {
      // (whoever has been lying there a while is getting up as soon as it is over; the last of them down lies a
      // moment first: the fall and the body on the ground are what say it is over)
      const tu = Lz === lastDown ? tf + 1.2 : Math.max(Lz.fallen.t + 1.0, tf + 0.35 + 0.2 * k);
      const upd = getUp(Lz, Lz.out, tu, 1.2);
      Lz.up.to(Lz.fallen.t, Lz.fallen.t + 0.1, 0, E.s);
      Lz.hurt.to(tu + 0.75, tu + 1.15, 1, E.s);
      // (off you by a body and a half at the least, wherever they got up: nobody is handed back to the hour with
      // their head in yours)
      const mine2 = [pl[0] + dir[0] * 1.25, pl[1] + dir[1] * 1.25];
      let away = unit(upd.at[0] - mine2[0], upd.at[1] - mine2[1]);
      const far = Math.max(1.75, Math.hypot(upd.at[0] - mine2[0], upd.at[1] - mine2[1]) + 0.5);
      // (and off each other: two who went down side by side do not back off into the one place)
      const spot2 = () => [mine2[0] + away[0] * far, mine2[1] + away[1] * far];
      for (let n = 0; n < 8 && gone.some(q => Math.hypot(q[0] - spot2()[0], q[1] - spot2()[1]) < 1.3); n++) {
        const a = 0.4 * (k % 2 ? -1 : 1);
        away = [away[0] * Math.cos(a) + away[1] * Math.sin(a), -away[0] * Math.sin(a) + away[1] * Math.cos(a)];
      }
      gone.push(spot2());
      // (the step off is begun as control goes back: the running off is the hour's own scene)
      Lz.pos.to(tu + 1.25, tu + 2.2, spot2(), E.s);
      Lz.hurt.to(tu + 1.6, tu + 2.0, 0, E.s);
      end = Math.max(end, tu + 1.5);
    });
    me.calm.to(end - 1.2, end - 0.5, 0, E.s);
    me.up.to(end - 1.2, end - 0.5, 0, E.s);
    t1 = allyAfter(end);
  } else {
    for (const F of fighters) {
      F.up.to(tOver + 0.4, tOver + 1.0, 0, E.s);
      F.split.to(tOver + 0.4, tOver + 0.9, 0.02, E.s);
      F.blade.to(tOver + 0.4, tOver + 0.9, 0, E.s);
    }
    t1 = tOver + 1.2;
  }
  // ANYBODY STILL ON THE GROUND WITH NOTHING SAID OF THEIR GETTING UP (one of theirs put down in a fight you lost)
  // gets up as the rest of it ends: nobody is handed back to the hour lying where they fell.
  for (const F of fighters) {
    if (!F.out || F.out.up !== undefined) continue;
    getUp(F, F.out, t1 - 1.3, 1.2);
    F.up.to(F.fallen.t, F.fallen.t + 0.1, 0, E.s);
    F.hurt.to(t1 - 0.6, t1 - 0.1, 1, E.s);
    F.hurt.to(t1 + 0.1, t1 + 0.5, 0, E.s);
    t1 += 0.3;
  }
  // AND NOBODY IS HANDED BACK WITH THEIR HEAD IN ANOTHER'S: where they stand at the end they are a head and a bit
  // apart; whoever is nearer than that takes a step off as it ends (you stay where you are).
  {
    const APART = 1.2;
    const ends = fighters.map(F => at(F, t1).slice());
    const from = ends.map(e => e.slice());
    for (let pass = 0; pass < 24; pass++) {
      let moved = false;
      for (let i = 0; i < ends.length; i++) {
        for (let j = i + 1; j < ends.length; j++) {
          let [dx, dz] = [ends[j][0] - ends[i][0], ends[j][1] - ends[i][1]];
          let d = Math.hypot(dx, dz);
          if (d >= APART - 1e-3) continue;
          if (d < 1e-3) [dx, dz, d] = [u[0], u[1], 1];
          const push = APART - d;
          const [wi, wj] = fighters[i] === me ? [0, 1] : fighters[j] === me ? [1, 0] : [0.5, 0.5];
          ends[i][0] -= (dx / d) * push * wi;
          ends[i][1] -= (dz / d) * push * wi;
          ends[j][0] += (dx / d) * push * wj;
          ends[j][1] += (dz / d) * push * wj;
          moved = true;
        }
      }
      if (!moved) break;
    }
    let far = 0;
    fighters.forEach((F, k) => {
      const d = Math.hypot(ends[k][0] - from[k][0], ends[k][1] - from[k][1]);
      if (d < 0.04) return;
      far = Math.max(far, d);
      F.pos.to(t1 - 0.02, t1 + 0.25 + d / 1.3, ends[k], E.s);
    });
    if (far) t1 += 0.3 + far / 1.3;
  }
  // (and whoever is still walking to where they were sent has the time to get there: the plan is where the hips are
  // told to be, the feet are a step or two behind it)
  t1 += 0.2;
  for (const F of fighters) {
    if (F.out) continue;
    F.split.to(t1 - 0.6, t1 - 0.15, 0.0, E.s);
  }
  // (the steps are laid a while past the end, and the end is when everybody has arrived where they were sent: the
  // feet are a step or two behind the plan, more after a turn)
  for (const F of fighters) F.bake(t0, t1 + 3);
  {
    const S0 = { x: 0, z: 0, yaw: 0, P: null };
    void S0;
    // (it waits for two who are still stepping apart, or one not yet on their feet: not for whoever is walking off,
    // who goes on walking as control is handed back)
    const late = t => {
      const P = fighters.map(F => F.at(t));
      if (P.some(S => S.down)) return true;
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (Math.hypot(P[i].x - P[j].x, P[i].z - P[j].z) < 0.97) return true;
      return false;
    };
    let more = 0;
    // (never past what the page is allowed after the last blow: demo/run/duel.js PACE.close, 4 s)
    while (more < 1.2 && t1 + more - tOver < 3.7 && late(t1 + more)) more += 0.1;
    t1 += more;
  }
  // (and whatever is still to do, it is over: 3.7 s after the last blow at the most. Everybody is on their feet by
  // then; two still stepping apart go on doing it as the stage takes them back)
  t1 = Math.min(t1, tOver + 3.7);
  return { roots, fighters, byId, t0, t1, tOver, over: script.over, fx, u, gap: gap0, cam, marks: Object.fromEntries(fighters.map(F => [F.id, F.mark])), script };
}

/**
 * Every body of a staged fight at t, as the stage and the shader want them (fighter.js at), with one thing seen to
 * that no single body's score can: two heads are never in each other. Where two standing bodies' heads (each 0.8 m
 * deep) would be nearer than they can be, both sit back off it by half the difference, over their planted feet.
 */
const HEADS_MIN = 0.84;
export function stateAt(fight, t, outs = fight.fighters.map(() => undefined)) {
  const F = fight.fighters;
  const S = F.map((f, k) => f.at(t, outs[k]));
  // (named-1: each head where it is drawn, at its body's size; and two never nearer than their two half-depths)
  const head = k => toWorld(fk(S[k].P).headC.map(v => v * (F[k].size ?? 1)), S[k].x, 0, S[k].z, S[k].yaw);
  let push = null;
  for (let i = 0; i < F.length; i++) {
    for (let j = i + 1; j < F.length; j++) {
      if (S[i].down || S[j].down) continue;
      const [a, b] = [head(i), head(j)];
      const [dx, dz] = [a[0] - b[0], a[2] - b[2]];
      const d = Math.hypot(dx, dz);
      const most = (HEADS_MIN * ((F[i].size ?? 1) + (F[j].size ?? 1))) / 2;
      if (d >= most || d < 1e-4) continue;
      const k = Math.min(0.3, (most - d) / 2) / d;
      push ??= F.map(() => [0, 0]);
      push[i][0] += dx * k;
      push[i][1] += dz * k;
      push[j][0] -= dx * k;
      push[j][1] -= dz * k;
    }
  }
  if (push) F.forEach((f, k) => (push[k][0] || push[k][1]) && f.at(t, S[k], push[k]));
  return S;
}
