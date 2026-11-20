// A FIGHT'S MOTION AS A SCORE (anim-1): everything a body does in a fight the page plays is written down before its
// first frame (the rules' fight is seeded and nobody steers: the whole of it is known), as TRACKS that are plain
// functions of the fight's clock. A track is a row of moves, each "from where I am at t0, to there by t1, eased so";
// a later move takes over from wherever the earlier one had got to, so a stagger can cut a lunge short with no jump.
// Nothing here remembers a frame: any moment of a fight can be asked for (the picture tools ask for single moments,
// the skip asks for the end).
//
//   E.*                    the easings: how a move spends its time (slow out of a pose, fast into a hit, past and back)
//   track(v0)              a number's track · .to(t0, t1, v, ease) · .at(t)
//   track2([x, z])         a ground point's track, the same · .by(t0, t1, [dx, dz], ease): relative to where it will be
//   angleTrack(a0)         a heading's: turns the short way round
const c01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
export const E = Object.freeze({
  lin: x => c01(x),
  /** eased at both ends: a move that starts and stops by itself */
  s: x => { x = c01(x); return x * x * (3 - 2 * x); },
  /** softer still at both ends (weight: a heavy thing getting going and settling) */
  s5: x => { x = c01(x); return x * x * x * (x * (6 * x - 15) + 10); },
  /** fast out of the start, soft stop: thrown, knocked, a snap */
  out: x => { x = c01(x); return 1 - (1 - x) * (1 - x); },
  out3: x => { x = c01(x); return 1 - (1 - x) ** 3; },
  out5: x => { x = c01(x); return 1 - (1 - x) ** 5; },
  /** slow start, hard stop: a blow arriving */
  in: x => { x = c01(x); return x * x; },
  in3: x => { x = c01(x); return x * x * x; },
  /** past the end by about a tenth and back: something stopped by its own weight */
  back: x => { x = c01(x) - 1; return 1 + x * x * (2.7 * x + 1.7); },
  /** past it by more, and a small swing back through: loose things */
  spring: x => { x = c01(x); return 1 - Math.exp(-6.5 * x) * Math.cos(11 * x) * (1 - x); },
  /** 0 → 1 → 0 */
  bump: x => Math.sin(Math.PI * c01(x)),
  /** 0 → 1 fast, → 0 slow (a hit: the snap and the long coming back) */
  hit: (x, peak = 0.18) => { x = c01(x); return x < peak ? E.out(x / peak) : 1 - E.s((x - peak) / (1 - peak)); },
});
/** 0 → 1 over [a, b] of t, by an easing. */
export const ramp = (t, a, b, ease = E.s) => ease((t - a) / (b - a || 1e-9));
/** 0 → 1 → 0: up over [a, b], held, down over [c, d]. */
export const span = (t, a, b, c, d, up = E.s, down = E.s) => Math.min(up((t - a) / (b - a || 1e-9)), 1 - down((t - c) / (d - c || 1e-9)));
export const lerp = (a, b, k) => a + (b - a) * k;
export const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

function find(segs, t) {
  // the last move begun at or before t
  let lo = 0, hi = segs.length - 1, at = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (segs[m].t0 <= t) {
      at = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return at;
}
function add(segs, seg) {
  // (a move written for a moment before one already there takes its place: what was to come after is not come to)
  while (segs.length && segs[segs.length - 1].t0 >= seg.t0 - 1e-9) segs.pop();
  segs.push(seg);
}

export function track(v0 = 0) {
  const segs = [];
  const T = {
    at(t) {
      const k = find(segs, t);
      if (k < 0) return v0;
      const s = segs[k];
      return s.from + (s.to - s.from) * s.ease((t - s.t0) / (s.t1 - s.t0 || 1e-9));
    },
    /** from wherever it is at t0, to v by t1 */
    to(t0, t1, v, ease = E.s) {
      add(segs, { t0, t1, from: T.at(t0), to: v, ease });
      return T;
    },
    by(t0, t1, dv, ease = E.s) {
      // (relative to where the track was GOING at t0: a move on top of the one before, not of where it had got to)
      const k = find(segs, t0);
      const goal = k < 0 ? v0 : segs[k].to;
      return T.to(t0, t1, goal + dv, ease);
    },
    get end() {
      return segs.length ? segs[segs.length - 1].to : v0;
    },
    get last() {
      return segs.length ? segs[segs.length - 1].t1 : -Infinity;
    },
    segs,
  };
  return T;
}

export function angleTrack(a0 = 0) {
  const T0 = track(a0);
  return {
    at: t => T0.at(t),
    to(t0, t1, a, ease = E.s) {
      const from = T0.at(t0);
      T0.to(t0, t1, from + wrap(a - from), ease);
      return this;
    },
    by(t0, t1, da, ease = E.s) {
      T0.by(t0, t1, da, ease);
      return this;
    },
    get end() {
      return T0.end;
    },
  };
}

export function track2(p0 = [0, 0]) {
  const segs = [];
  const T = {
    at(t, out = [0, 0]) {
      const k = find(segs, t);
      if (k < 0) {
        out[0] = p0[0];
        out[1] = p0[1];
        return out;
      }
      const s = segs[k];
      const e = s.ease((t - s.t0) / (s.t1 - s.t0 || 1e-9));
      out[0] = s.from[0] + (s.to[0] - s.from[0]) * e;
      out[1] = s.from[1] + (s.to[1] - s.from[1]) * e;
      return out;
    },
    to(t0, t1, p, ease = E.s) {
      add(segs, { t0, t1, from: T.at(t0), to: [p[0], p[1]], ease });
      return T;
    },
    /** where it is headed once every move written so far is done */
    get end() {
      return segs.length ? segs[segs.length - 1].to : p0;
    },
    by(t0, t1, d, ease = E.s) {
      const g = T.goalAt(t0);
      return T.to(t0, t1, [g[0] + d[0], g[1] + d[1]], ease);
    },
    /** where the move in hand at t is going */
    goalAt(t) {
      const k = find(segs, t);
      return k < 0 ? p0 : segs[k].to;
    },
    segs,
  };
  return T;
}
