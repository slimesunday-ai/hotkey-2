// ONE FIGHTER'S SCORE (anim-1): everything one body does in a fight, written before it plays (plan.js) and asked for
// by the moment.
//
//   const F = createFighter({ id, x, z, yaw, lead, style })
//     F.pos      where the hips are on the ground (a track2: .to / .by)
//     F.aim(t0, dur, who | angle)   from t0, over dur, the chest comes round to face another fighter (and stays on them
//                as they move) or a fixed heading
//     F.split, F.blade   the stance under it: how far apart the feet stand front to back (m), how far the legs are
//                turned off the chest's facing (rad), as tracks
//     F.act({ t0, t1, in, out, fn })   a piece of acting on top of the guard: fn(P, s, t) poses P (rig.js; s seconds
//                into it), blended in over `in` s and out over `out` s. Later acts go over earlier ones
//     F.down({ t0, t1 })   off its feet from t0 (the root where the feet left it) and standing again at t1, the feet
//                where the pose then has them
//     F.bake(t0, t1)   the steps of the whole score (feet.js)
//     F.at(t, out)     → { x, z, yaw, P } for the stage and the shader (body.js), and F.points(t) the body's points in
//                the world (rig.js fk): fists, head, chest
//   POSES ARE WRITTEN FOR A BODY THAT LEADS WITH ITS L SIDE (L foot and L hand in front, R the strong hand behind);
//   a fighter with lead +1 is the mirror of it.
import { pose0, copyPose, mixPose, mirrorPose, fk, toWorld, RIG } from './rig.js';
import { track, track2, E, wrap } from './plan.js';
import { bakeFeet } from './feet.js';
import { solve } from './body.js';

const H = RIG.hipX;

export function createFighter({ id, x, z, yaw = 0, lead = -1, style = null, y = 0, size = 1 }) {
  const pos = track2([x, z]);
  // NO PLAN FASTER THAN FEET. Where the hips are told to be is what everything after it is staged from: the next blow
  // is thrown at where the plan has the other. A move written further than a body covers in its time (a slip swung
  // half way round the other in a tenth of a second) left the feet behind, and the blows after it were thrown at a
  // place nobody stood. So every move is as long as its time allows, and no longer. WHILE THE FIGHT IS ON the legs
  // stand to the other, and the rig's legs go along their heading and hardly across it (feet.js): a lean's worth at
  // once and 2.6 m/s after along the heading (a quick step is 0.4 m in 0.15 s); across it, what pivoting on a planted
  // foot gives, 0.6 m/s. ONCE IT IS OVER the legs turn to walk where the body goes (stanceYaw below): any way, at a
  // walk. `put` is the one that is not a move: the plan set down where a body has got up.
  pos.put = pos.to;
  pos.to = (t0, t1, p, ease) => {
    const from = pos.at(t0);
    let [dx, dz] = [p[0] - from[0], p[1] - from[1]];
    const dt = Math.max(0, t1 - t0);
    if (t0 < (F.walksFrom ?? Infinity)) {
      const a = F.facing(t0) - lead * blade.at(t0);
      const [sn, cs] = [Math.sin(a), Math.cos(a)];
      // (TURNING TO SOMEBODY ELSE, in a fight of several: the legs come round a step at a time, well after the chest;
      // until they have, "along the heading" is not where the feet can go, and the body only shuffles)
      const turning = Math.abs(wrap(F.facing(t0) - F.facing(t0 - 0.7))) > 0.5 || Math.abs(wrap(F.facing(Math.max(t1, t0 + 0.5)) - F.facing(t0))) > 0.5;
      const [mAl, mAc] = turning ? [0.1 + 0.9 * dt, 0.05 + 0.32 * dt] : [0.12 + 2.6 * dt, 0.05 + 0.32 * dt];
      const al = Math.max(-mAl, Math.min(mAl, dx * sn + dz * cs));
      const ac = Math.max(-mAc, Math.min(mAc, dx * cs - dz * sn));
      [dx, dz] = [al * sn + ac * cs, al * cs - ac * sn];
    } else {
      const d = Math.hypot(dx, dz);
      const most = 0.12 + 1.3 * dt;
      if (d > most) [dx, dz] = [(dx / d) * most, (dz / d) * most];
    }
    return pos.put(t0, t1, [from[0] + dx, from[1] + dz], ease);
  };
  const split = track(0);
  const blade = track(0);
  /** the hips' height off the ground the stage gives (the street's own, set every frame by whoever plays it) */
  const F = { id, lead, style, pos, split, blade, acts: [], aims: [{ t0: -1e9, dur: 1e-3, angle: yaw }], downs: [], feet: null, y, hitstops: [], size };
  const tmp = [0, 0];
  const tmp2 = [0, 0];
  const A0 = pose0();
  const M0 = pose0();

  // ── the clock a body lives on: held a few frames on a hard hit, then caught up (hit-stop) ──
  F.stop = (t, hold, catchUp = 0.34) => {
    // (one hold at a time, and the clock never runs back: a hold that comes while the last is still being made up
    // cuts that short; one right on top of the last is not taken)
    const last = F.hitstops[F.hitstops.length - 1];
    if (last && t < last.t + last.hold + 0.1) return;
    if (last && t < last.t + last.hold + last.catchUp) last.catchUp = t - last.t - last.hold;
    F.hitstops.push({ t, hold, catchUp });
  };
  F.clock = t => {
    for (const h of F.hitstops) {
      if (t <= h.t) break;
      const end = h.t + h.hold + h.catchUp;
      if (t >= end) continue;
      // held for `hold`, then the lost time made up over `catchUp`
      // (made up gently: out of the hold at the clock's own pace, a little faster in the middle, back to it at the end)
      const u = (t - h.t - h.hold) / h.catchUp;
      return t < h.t + h.hold ? h.t : h.t + h.catchUp * u + h.hold * E.s(u);
    }
    return t;
  };

  // ── which way the chest faces ──
  F.aim = (t0, dur, to) => {
    F.aims.push(typeof to === 'number' ? { t0, dur: Math.max(dur, 1e-3), angle: to } : { t0, dur: Math.max(dur, 1e-3), who: to });
    F.aims.sort((a, b) => a.t0 - b.t0);
    return F;
  };
  F.facing = t => {
    let a = 0;
    let first = true;
    for (const A of F.aims) {
      if (A.t0 > t) break;
      let want = A.angle;
      if (A.who) {
        const p = pos.at(t, tmp);
        const q = A.who.pos.at(t, tmp2);
        const [dx, dz] = [q[0] - p[0], q[1] - p[1]];
        want = Math.hypot(dx, dz) > 0.05 ? Math.atan2(dx, dz) : a;
      }
      if (first) a = want;
      else a += wrap(want - a) * E.s((t - A.t0) / A.dur);
      first = false;
    }
    return a;
  };

  // ── the stance: where each foot would stand under the body ──
  // THE LEGS GO THE WAY THE BODY IS GOING. The rig's legs hang side by side across their heading (feet.js): a body
  // travels along that heading, forward or back, and no other way; asked to go sideways its feet waddled along the
  // heading instead and the hips went on without them (one getting up and backing off at a slant ended a metre and a
  // half from where the fight had them, in the winner's lap). So while the body is going somewhere at more than a
  // shuffle, across its heading by more than a waddle makes up, the legs turn to walk it: forward when that is
  // within a little over a quarter turn of where they face, backward else; the chest stays on whoever it is aimed at
  // (body.js turns it on the legs).
  const V0 = [0, 0];
  const V1 = [0, 0];
  F.stanceYaw = t => {
    const b = F.facing(t) - lead * blade.at(t);
    // (once the fight is over, and only then: while it is on they stand to each other, and what they travel is along
    // the line between them)
    if (t < (F.walksFrom ?? Infinity)) return b;
    const p0 = pos.at(t - 0.06, V0);
    const p1 = pos.at(t + 0.24, V1);
    const [vx, vz] = [(p1[0] - p0[0]) / 0.3, (p1[1] - p0[1]) / 0.3];
    const v = Math.hypot(vx, vz);
    if (v < 0.45) return b;
    let d = wrap(Math.atan2(vx, vz) - b);
    if (d > 1.75) d -= Math.PI;
    else if (d < -1.75) d += Math.PI;
    const across = Math.min(1, Math.max(0, (Math.abs(d) - 0.2) / 0.3));
    return b + d * across * E.s(Math.min(1, (v - 0.45) / 0.5));
  };
  F.home = (t, side, out = [0, 0]) => {
    const p = pos.at(t, out);
    if (!side) return p;
    const a = F.stanceYaw(t);
    const zo = (side === lead ? 0.5 : -0.5) * split.at(t) * size;
    const [px, pz] = [p[0], p[1]];
    // (named-1: the hips as wide as the body is drawn)
    out[0] = px + Math.cos(a) * side * H * size + Math.sin(a) * zo;
    out[1] = pz - Math.sin(a) * side * H * size + Math.cos(a) * zo;
    return out;
  };

  F.act = A => {
    F.acts.push({ in: 0.08, out: 0.15, ...A });
    return F;
  };
  F.down = D => {
    F.downs.push(D);
    F.downs.sort((a, b) => a.t0 - b.t0);
    return F;
  };

  /** The authored pose at t: the guard, then each act over it. `G(P, t)` the guard (moves.js), given by the style. */
  const P0 = pose0();
  const Q0 = pose0();
  F.pose = (t, out = pose0()) => {
    copyPose(P0, out);
    out.reachL = null;
    out.reachR = null;
    F.guard?.(out, t);
    for (const A of F.acts) {
      if (t < A.t0 || t > A.t1) continue;
      const w = Math.min(E.s((t - A.t0) / A.in), A.out > 0 ? 1 - E.s((t - (A.t1 - A.out)) / A.out) : 1);
      if (w <= 0) continue;
      const Q = copyPose(out, Q0);
      Q.reachL = out.reachL;
      Q.reachR = out.reachR;
      A.fn(Q, t - A.t0, t);
      mixPose(out, Q, w);
      // (a fist put on a point: its share fades with the act)
      for (const k of ['reachL', 'reachR']) if (Q[k] && Q[k] !== out[k]) out[k] = { ...Q[k], k: Q[k].k * w };
    }
    return out;
  };

  F.bake = (t0, t1) => {
    // (each stretch off its feet: the root where the feet left the body, worked out as the steps are laid)
    const rooted = F.downs.map(D => ({
      t0: D.t0, t1: D.t1,
      enter(L, R, yaw, t) {
        let A = F.pose(t, A0);
        if (lead > 0) A = mirrorPose(A, M0);
        const S = solve({ L: [L[0], L[1], 0, 0], R: [R[0], R[1], 0, 0], yaw, pin: -1, pelvis: pos.at(t, tmp), facing: F.facing(t), pose: A, rooted: null, y: F.y });
        D.root = { x: S.x, z: S.z, yaw: S.yaw };
        // (the feet as they were, in the body's own terms: what the fall starts from; told L-leading like every pose)
        D.feet0 = lead > 0 ? [[...S.P.fR], [...S.P.fL]] : [[...S.P.fL], [...S.P.fR]];
        D.ty0 = (S.P.ty - A.ty) * (lead > 0 ? -1 : 1);
        D.entered?.(D);
      },
      land: () => D.land(D),
    }));
    F.feet = bakeFeet({ t0, t1, home: F.home, yaw: F.stanceYaw, rooted, quick: F.quick ?? (() => 0), size });
    return F;
  };

  const FT = { L: [0, 0, 0, 0], R: [0, 0, 0, 0], yaw: 0, pin: -1 };
  /** `nudge` [dx, dz]: the hips moved that much from where the score has them (two heads kept out of each other). */
  F.at = (t0, out = { x: 0, z: 0, yaw: 0, P: pose0() }, nudge = null) => {
    const t = F.clock(t0);
    let A = F.pose(t, A0);
    if (lead > 0) {
      const [rl, rr, em] = [A.reachL, A.reachR, A.eMax];
      A = mirrorPose(A, M0);
      A.reachL = rr;
      A.reachR = rl;
      A.eMax = em;
    }
    const D = F.downs.find(d => t >= d.t0 && t < d.t1 && d.root);
    const ft = F.feet.at(t, FT);
    const pv = pos.at(t, tmp);
    if (nudge) {
      pv[0] += nudge[0];
      pv[1] += nudge[1];
    }
    const S = { L: ft.L, R: ft.R, yaw: ft.yaw, pin: ft.pin, pelvis: pv, facing: F.facing(t), pose: A, rooted: D?.root ?? null, y: F.y, size: F.size };
    solve(S, out);
    out.t = t;
    out.down = !!D;
    return out;
  };
  /** The body's points in the world at t (rig.js fk's, each [x, y, z]). */
  F.points = (t, S = F.at(t)) => {
    const f = fk(S.P);
    // (named-1: the rig's points are the shared body's; this one is drawn F.size times about its feet)
    const k = F.size;
    const W = p => toWorld(k === 1 ? p : [p[0] * k, p[1] * k, p[2] * k], S.x, F.y, S.z, S.yaw);
    const out = {};
    for (const k of ['hip', 'neck', 'headC', 'face', 'chin', 'crown', 'shL', 'shR', 'fistL', 'fistR', 'elbL', 'elbR', 'chestC', 'belly']) out[k] = W(f[k]);
    out.headAt = p => W(f.headAt(p));
    out.chestAt = p => W(f.chestAt(p));
    out.lead = lead;
    return out;
  };
  return F;
}
