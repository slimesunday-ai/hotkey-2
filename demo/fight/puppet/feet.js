// FEET THAT PLANT (anim-1). A fighter's body is carried by its plan (where the hips are, which way the feet stand: both
// plain functions of the fight's clock, plan.js); this file gives it feet that stand on the GROUND while the body moves
// over them, and step when the body has gone, or is about to go, further than a planted foot can follow. Because the
// whole fight is written before it plays, a step is taken with the future in hand: a foot lifts a moment BEFORE a
// lunge and lands where the lunge will end; a knock back is caught by two or three quick steps going back, each put
// down where the body will be.
//
// THE RIG'S LEGS HANG A FIXED WIDTH APART across the body's own heading (walk2.js: the hips, 0.25 m). So two planted
// feet say which way the legs face: a foot can be put down anywhere, but the legs' heading then is whatever makes that
// place 0.25 m to the side of the other foot. Each step is laid with the heading it will land in; while both feet are
// down the heading is fixed (nothing slides, nothing turns); while one swings, the body pivots on the planted one from
// the old heading to the new, eased. The legs never turn any other way. (The chest is turned on the legs to face where
// the fight says: body.js.)
//
//   bakeFeet({ t0, t1, home, yaw, start, rooted, quick })   the steps of one body over [t0, t1]:
//       home(t, side, out) → [x, z]   where that foot would stand under the body at t (the stance: side −1 L, +1 R;
//                                  side 0: the hips themselves)
//       yaw(t)                     the heading the legs would stand to at t
//       rooted [{ t0, t1, enter(L, R, yaw, t), land() → { L, R, yaw } }]   stretches when the body is off its feet
//                                  (down, thrown): no steps; `enter` is told how the feet stood as it left them,
//                                  `land` says how they stand when it is up again
//       quick(t) → 0..1            how hurried the body is at t (a stagger steps sooner, shorter and lower)
//     → { at(t, out) → out { L: [x, z, lift, pitch], R: [...], yaw, pin (−1 | 1: the foot that is down) }, steps }
import { RIG } from './rig.js';
import { E, wrap } from './plan.js';

// (named-1: every length here is the shared body's, times the size of the body whose feet are baked: set at the start
// of each bakeFeet, which runs to its end at once)
let H2 = RIG.hipX * 2;
/** A planted foot this far from where it would stand (m) steps; and so far ahead the page looks for that (s). */
let TRIG = 0.105;
const LOOK = 0.15;
/** Two feet are never nearer than the hips are wide, nor wider than the legs reach; no step longer than a leg can take. */
let NEAR = H2 + 0.004;
let FAR = 0.56;
let LONGEST = 0.42;
function sized(k) {
  H2 = RIG.hipX * 2 * k;
  TRIG = 0.105 * k;
  NEAR = H2 + 0.004;
  FAR = 0.56 * k;
  LONGEST = 0.42 * k;
}
/** How far a step may land the legs off the heading they would stand to (rad): the waddle a sideways step needs. */
const WADDLE = 0.42;
/** How far one step may turn the legs (rad): they pivot on the planted foot while the other swings. */
const PIVOT = 0.5;
const STEP = 1 / 120;

/** The heading of the legs with the R foot at L + D: the R foot `sign` ahead of or behind the L along it. */
function yawOf(Dx, Dz, sign) {
  const d = Math.max(Math.hypot(Dx, Dz), H2);
  return Math.atan2(-Dz, Dx) + Math.atan2(Math.sqrt(Math.max(d * d - H2 * H2, 0)) * sign, H2);
}

export function bakeFeet({ t0, t1, home, yaw: yawAt, rooted = [], quick = () => 0, size = 1 }) {
  sized(size);
  const h = [0, 0];
  const g = [0, 0];
  const first = { L: [...home(t0, -1, h)], R: [...home(t0, 1, h)], yaw: yawAt(t0) };
  const feet = { L: { side: -1, pos: [...first.L], step: null, landed: -9 }, R: { side: 1, pos: [...first.R], step: null, landed: -9 } };
  let yaw = first.yaw;
  /** every step, in the order taken: { side, t0, t1, from, to, h, yaw0, yaw1, back, cut } */
  const steps = [];
  const err = (F, t) => {
    const p = home(t, F.side, h);
    return Math.hypot(p[0] - F.pos[0], p[1] - F.pos[1]);
  };
  let still = 0;
  let settled = true;
  let ri = 0;
  // (the heading the legs would stand to, FOLLOWED ROUND as it turns, never taken the short way from where the legs
  // are: a body told to turn its back was asked for a heading half a turn off, and each step went the short way to
  // it from where that step stood, one left, the next right, for as long as it was asked)
  let ysPrev = first.yaw;
  let ysU = first.yaw;
  let chasing = false;
  for (let t = t0; t < t1 + STEP; t += STEP) {
    {
      const yn = yawAt(t);
      ysU += wrap(yn - ysPrev);
      ysPrev = yn;
    }
    // (up again: each foot where the getting up put it, the legs heading as it left them)
    while (ri < rooted.length && t >= rooted[ri].t1) {
      const S = rooted[ri].land();
      steps.push({ side: 0, t0: rooted[ri].t1, t1: rooted[ri].t1, L: [...S.L], R: [...S.R], yaw0: S.yaw, yaw1: S.yaw, cut: true });
      feet.L.pos = [...S.L];
      feet.R.pos = [...S.R];
      feet.L.step = feet.R.step = null;
      feet.L.landed = feet.R.landed = rooted[ri].t1;
      yaw = S.yaw;
      ysU = yaw + wrap(ysPrev - yaw);
      ri += 1;
    }
    for (const k of ['L', 'R']) {
      const F = feet[k];
      if (F.step && t >= F.step.t1) {
        F.pos = [...F.step.to];
        F.landed = F.step.t1;
        yaw = F.step.yaw1;
        F.step = null;
      }
    }
    if (ri < rooted.length && t >= rooted[ri].t0) {
      // (going down: a foot in the air is put down where it is; the body's root is taken from the feet as they are)
      if (!rooted[ri].entered) {
        rooted[ri].entered = true;
        for (const k of ['L', 'R']) {
          const F = feet[k];
          if (!F.step) continue;
          const u = (t - F.step.t0) / (F.step.t1 - F.step.t0);
          const e = E.s(u);
          F.step.to = [F.step.from[0] + (F.step.to[0] - F.step.from[0]) * e, F.step.from[1] + (F.step.to[1] - F.step.from[1]) * e];
          F.step.yaw1 = F.step.yaw0 + wrap(F.step.yaw1 - F.step.yaw0) * e;
          F.step.t1 = t;
          F.step.cutShort = true;
          F.pos = [...F.step.to];
          yaw = F.step.yaw1;
          F.step = null;
        }
        rooted[ri].enter?.(feet.L.pos, feet.R.pos, yaw, t);
      }
      continue;
    }
    if (feet.L.step || feet.R.step) continue;
    // how fast the body is going, and which way
    const a = home(t, 0, h);
    const [ax, az] = [a[0], a[1]];
    const b = home(t + 0.05, 0, g);
    const [vx, vz] = [(b[0] - ax) / 0.05, (b[1] - az) / 0.05];
    const v = Math.hypot(vx, vz);
    still = v < 0.12 ? still + STEP : 0;
    if (v > 0.25) settled = false;
    const q = quick(t);
    // which foot wants to step most: by how far it is, or will shortly be, from its place; the foot on the side the
    // body is going steps first (a fighter's step: the near foot reaches, the far foot follows)
    let best = null;
    let bestS = 0;
    for (const k of ['L', 'R']) {
      const F = feet[k];
      if (t - F.landed < 0.02) continue;
      const now = err(F, t);
      const soon = err(F, t + LOOK);
      let s = Math.max(now, soon * 0.92);
      const trig = settled || still < 0.22 ? TRIG * (1 - 0.3 * q) : 0.045;
      if (s < trig) continue;
      if (v > 0.2) s += 0.035 * (((F.pos[0] - ax) * vx + (F.pos[1] - az) * vz) / v > 0 ? 1 : 0);
      if (s > bestS) [best, bestS] = [F, s];
    }
    if (!best) {
      if (still > 0.3) settled = true;
      continue;
    }
    const O = best === feet.L ? feet.R : feet.L;
    const far = Math.max(err(best, t), err(best, t + LOOK));
    const dur = Math.max(0.1, Math.min(0.23, (0.11 + 0.3 * far) * (1 - 0.28 * q)));
    const tl = t + dur;
    // (put down a little ahead of where the body will be as it lands, so it is stood over, not arrived at)
    const want = [...home(tl + 0.06, best.side, h)];
    // (no longer than a leg steps)
    let [sx, sz] = [want[0] - best.pos[0], want[1] - best.pos[1]];
    const sl = Math.hypot(sx, sz);
    if (sl > LONGEST) {
      want[0] = best.pos[0] + (sx / sl) * LONGEST;
      want[1] = best.pos[1] + (sz / sl) * LONGEST;
    }
    // WHERE IT CAN LAND: 0.25 m to the side of the other foot across the heading the legs then have. From the place
    // wanted: its distance from the other foot kept (inside the legs' reach), and the heading that puts it there, held
    // within a waddle of the heading the stance asks for
    let [dx, dz] = [want[0] - O.pos[0], want[1] - O.pos[1]];
    let d = Math.hypot(dx, dz);
    if (d < 1e-6) [dx, dz, d] = [best.side, 0, 1];
    const dd = Math.max(NEAR, Math.min(FAR, d));
    [dx, dz] = [(dx / d) * dd, (dz / d) * dd];
    // (D = R − L)
    const [Dx, Dz] = best.side > 0 ? [dx, dz] : [-dx, -dz];
    let ys = yawAt(tl);
    {
      // LEFT WELL BEHIND, THE LEGS TURN TO WALK IT: half a metre and more from where the body should be, they head the
      // way they have to go (backward when that is nearer how they were asked to stand) and turn back as they arrive.
      // Asked to stand across the way they had to go, they waddled along their own heading and never got there.
      const hm = home(tl + 0.06, 0, h);
      const [ex, ez] = [hm[0] - (feet.L.pos[0] + feet.R.pos[0]) / 2, hm[1] - (feet.L.pos[1] + feet.R.pos[1]) / 2];
      const far2 = Math.hypot(ex, ez);
      // (once it has turned to walk, it walks until it is there: taken up and dropped a step at a time as the
      // distance crossed the half metre, the legs turned one way and back and got nowhere)
      if (far2 > 0.55) chasing = true;
      else if (far2 < 0.22) chasing = false;
      if (chasing) {
        let d = wrap(Math.atan2(ex, ez) - ys);
        if (d > 1.75) d -= Math.PI;
        else if (d < -1.75) d += Math.PI;
        if (Math.abs(d) > WADDLE * 0.6) ys += d;
      }
    }
    const [ya, yb] = [yawOf(Dx, Dz, 1), yawOf(Dx, Dz, -1)];
    const sign = Math.abs(wrap(ya - ys)) <= Math.abs(wrap(yb - ys)) ? 1 : -1;
    const y0 = sign > 0 ? ya : yb;
    let y1 = y0;
    let off = wrap(y1 - ys);
    if (Math.abs(off) > WADDLE) {
      off = Math.sign(off) * WADDLE;
      y1 = ys + off;
    }
    // (and no step turns the legs further than a step does: round the way the heading asked for has gone)
    const turned = ysU + wrap(ys - ysPrev) + off - yaw;
    y1 = Math.abs(turned) > PIVOT ? yaw + Math.sign(turned) * PIVOT : yaw + turned;
    let to = [O.pos[0] + dx, O.pos[1] + dz];
    if (Math.abs(wrap(y1 - y0)) > 1e-6) {
      const fz = Math.sqrt(Math.max(dd * dd - H2 * H2, 0)) * sign;
      // D in the world for that heading: 0.25 across it, fz along it
      const D2 = [Math.cos(y1) * H2 + Math.sin(y1) * fz, -Math.sin(y1) * H2 + Math.cos(y1) * fz];
      to = best.side > 0 ? [O.pos[0] + D2[0], O.pos[1] + D2[1]] : [O.pos[0] - D2[0], O.pos[1] - D2[1]];
    }
    if (Math.hypot(to[0] - best.pos[0], to[1] - best.pos[1]) > LONGEST) {
      // (where it would land is further than a leg steps: turning hard, or the foot behind coming up past the other.
      // It goes as far along as one step takes it: across the new heading from the planted foot, as ever, and along
      // that heading from where it is toward where it was wanted; at the least it pivots where it is. It used to
      // pivot only: with no turn to make that left it where it was, and a body whose feet were at their widest stood
      // there while its hips went on without it)
      const [cx, cz] = best.side > 0 ? [best.pos[0] - O.pos[0], best.pos[1] - O.pos[1]] : [O.pos[0] - best.pos[0], O.pos[1] - best.pos[1]];
      const fz0 = Math.max(-FAR, Math.min(FAR, cx * Math.sin(yaw) + cz * Math.cos(yaw)));
      const [wx, wz] = best.side > 0 ? [to[0] - O.pos[0], to[1] - O.pos[1]] : [O.pos[0] - to[0], O.pos[1] - to[1]];
      const fzW = Math.max(-FAR, Math.min(FAR, wx * Math.sin(y1) + wz * Math.cos(y1)));
      const place = fz => {
        const D2 = [Math.cos(y1) * H2 + Math.sin(y1) * fz, -Math.sin(y1) * H2 + Math.cos(y1) * fz];
        return best.side > 0 ? [O.pos[0] + D2[0], O.pos[1] + D2[1]] : [O.pos[0] - D2[0], O.pos[1] - D2[1]];
      };
      const long = q2 => Math.hypot(q2[0] - best.pos[0], q2[1] - best.pos[1]) > LONGEST;
      let share = 1;
      to = place(fzW);
      for (let n = 0; n < 7 && long(to); n++) {
        share *= 0.62;
        to = place(fz0 + (fzW - fz0) * share);
      }
      if (long(to)) to = place(fz0);
    }
    const len = Math.hypot(to[0] - best.pos[0], to[1] - best.pos[1]);
    if (len < 0.014 && Math.abs(wrap(y1 - yaw)) < 0.03) {
      // (nowhere better to put it: left where it is, looked at again shortly)
      best.landed = t + 0.05;
      continue;
    }
    const S = { side: best.side, t0: t, t1: tl, from: [...best.pos], to, h: Math.min(0.085, 0.024 + 0.16 * len) * (1 - 0.4 * q), yaw0: yaw, yaw1: y1,
      back: (to[0] - best.pos[0]) * Math.sin(yaw) + (to[1] - best.pos[1]) * Math.cos(yaw) < 0 };
    best.step = S;
    steps.push(S);
    if (still > 0.22) settled = true;
  }

  /** The feet at t. */
  function at(t, out = { L: [0, 0, 0, 0], R: [0, 0, 0, 0], yaw: 0, pin: -1 }) {
    // the last step begun at or before t, and each foot's own last
    let lo = 0, hi = steps.length - 1, k = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (steps[m].t0 <= t) {
        k = m;
        lo = m + 1;
      } else hi = m - 1;
    }
    out.yaw = first.yaw;
    out.pin = -1;
    let gotL = false, gotR = false;
    for (let j = k; j >= 0 && !(gotL && gotR); j--) {
      const S = steps[j];
      if (S.cut) {
        if (!gotL) put(out.L, S.L);
        if (!gotR) put(out.R, S.R);
        if (j === k) out.yaw = S.yaw1;
        gotL = gotR = true;
        break;
      }
      const o = S.side < 0 ? out.L : out.R;
      if (S.side < 0 ? gotL : gotR) continue;
      if (S.side < 0) gotL = true;
      else gotR = true;
      if (t >= S.t1) put(o, S.to);
      else {
        const u = (t - S.t0) / (S.t1 - S.t0);
        const e = E.s(u);
        o[0] = S.from[0] + (S.to[0] - S.from[0]) * e;
        o[1] = S.from[1] + (S.to[1] - S.from[1]) * e;
        // (off the ground quickly, across, and set down: most of the travel while it is up)
        o[2] = S.cutShort ? S.h * Math.sin(Math.PI * Math.min(1, u * 0.5)) : S.h * Math.sin(Math.PI * Math.min(1, u * 1.08)) ** 0.85;
        // (a step forward: the heel leaves last and lands first; a step back: on the toe the whole way)
        o[3] = S.back ? -0.32 * Math.sin(Math.PI * Math.min(1, u * 1.15)) : -0.34 * E.bump(u / 0.55) + 0.2 * E.bump((u - 0.55) / 0.45);
        out.pin = -S.side;
      }
      if (j === k) out.yaw = t >= S.t1 ? S.yaw1 : S.yaw0 + wrap(S.yaw1 - S.yaw0) * E.s((t - S.t0) / (S.t1 - S.t0));
    }
    if (!gotL) put(out.L, first.L);
    if (!gotR) put(out.R, first.R);
    return out;
  }
  function put(o, p) {
    o[0] = p[0];
    o[1] = p[1];
    o[2] = 0;
    o[3] = 0;
  }
  return { at, steps };
}
