// THE RAID'S GROUND, LAID ON YOUR DOOR (raidfight-1). The rules fight the raid on open ground with you in its middle
// (src/fight/raid.mjs on duel.mjs duelArena: 60 by 40 m, nothing standing in it), and their crews start 6 to 20 m off
// on every side, the shooters BEHIND you (sixesRaid.at.back: 170 and -165 degrees). Your door is a trailer's, its back
// to you, in a lane of trailers eight metres wide. Laid on it as they are, the shooters stood in your own trailer and
// the quick ones ran through your neighbours'. So the rules' ground is laid on the door's in two parts that join
// smoothly:
//
//   NEAR YOU (as far as the open ground round you goes that way, 1.4 to 4 m) exactly as the rules have it: turned so
//   their front (the way the rush comes) is out of your door, maybe mirrored, nothing bent. Every blow, every body
//   at arm's length, every shell of the Doorman at the door is where the rules put it.
//   FURTHER OUT bent: each of the rules' ways round you is given one of the door's ways round you in turn, the open
//   ones (along the lane, out across it) taking many of them and the shut ones (into your trailer, into the next
//   pad's shed) few, keeping their order; and drawn in, each way by its own share, so the furthest any of them goes
//   that way fits the open ground and the picture. A body that walks straight at you from 10 m comes along the lane
//   and turns in to you over the last few metres, as somebody coming round the corner of a trailer would.
//
// Who fires at whom, when, who is hit and who goes down are the rules' alone; this says only where the far ones are
// drawn. The bend is chosen once, before the first frame, from the whole fight (it is seeded: run to its end first):
// of a few places to stand at the door, both mirrors and a few turns, the one whose bodies and lines of fire stand
// least in anything solid and stay most in the picture, and bend the near ones least.
//
//   const L = layRaid({ o, frames, shots, anchors, face, open, seen })
//     o        [x, y]: you at the start, on the rules' ground
//     frames   [{ t, at: [[x, y] | null, ...] }]: everybody (the rules' order) every tenth of a second, null when down
//     shots    [{ t, from, to }]: who fired at whom (indexes into `at`), each shot and blow
//     anchors  [[x, z], ...]: where you may stand on the world, the first the door's own step
//     face     the heading out of the door (rad: the world's, from +z toward +x)
//     open(x, z) → bool    open ground a body may stand on (cached by the caller)
//     seen(x, z) → bool    in the picture of the game's camera with you at the door
//   → { W(x, y) → [wx, wz], anchor, mirror, turn, cost, figures: { solid (s of bodies stood in something), unseen,
//       blocked (lines of fire through something), bent (the most a body within 3 m of you is turned, rad) } }
const TAU = Math.PI * 2;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => {
  const u = clamp((x - a) / Math.max(1e-6, b - a), 0, 1);
  return u * u * (3 - 2 * u);
};
/** Ways round the door looked along (one every BIN degrees), and how far (m). */
const N = 72;
const FAR = 24;
/**
 * The rigid ground round you (m): everything within it is exactly as the rules have it, every way round (a close
 * fight circles you at 0.75 to 1.6 m). Beyond it the bend comes in by `out` m that way: 0.9 of the open ground there,
 * never under LO nor over HI (out in the lane: a long, gentle turn). (raidfight-2: LO was 2.6, a bend whole within
 * 0.6 m of the core behind you; a big man's blow knocked you across it and you were drawn going 0.8 m in four
 * pictures, then 1.3 m at once as you fell: a turn of the ground that sharp stretches any step across it)
 */
const CORE = 2.0;
const OUT = { share: 0.9, lo: 4.5, hi: 7.5 };

/** A table over the circle of ways (N bins), read with linear interpolation; `u` relative to the door's face. */
const binOf = u => ((((u / TAU) * N) % N) + N) % N;
function readT(T, u) {
  const b = binOf(u);
  const k = Math.floor(b);
  const f = b - k;
  return T[k % N] * (1 - f) + T[(k + 1) % N] * f;
}

/** The open ground and the picture each way from a point: how far a body may go that way (m), smoothed. */
function roomFrom([ax, az], face, open, seen) {
  const clear = new Float64Array(N);
  const vis = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    const h = face + (k / N) * TAU;
    const [dx, dz] = [Math.sin(h), Math.cos(h)];
    const [px, pz] = [dz, -dx];
    let c = FAR;
    for (let d = 0.25; d <= FAR; d += 0.25) {
      const [x, z] = [ax + dx * d, az + dz * d];
      // (a body's width: open on both its sides too)
      if (!open(x, z) || !open(x + px * 0.3, z + pz * 0.3) || !open(x - px * 0.3, z - pz * 0.3)) {
        c = d;
        break;
      }
    }
    clear[k] = Math.max(0.3, c - 0.4);
    let v = 0;
    for (let d = 0.5; d <= FAR; d += 0.5) if (seen(ax + dx * d, az + dz * d)) v = d;
    vis[k] = v;
  }
  // (each way no further than its neighbours' least within 10 degrees: a body crosses between two rays; then eased)
  const L = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    let m = Infinity;
    for (let j = -2; j <= 2; j++) m = Math.min(m, Math.min(clear[(k + j + N) % N], vis[(k + j + N) % N] - 1.2));
    L[k] = Math.max(0.3, m);
  }
  const S = new Float64Array(N);
  for (let k = 0; k < N; k++) S[k] = (L[(k + N - 1) % N] + 2 * L[k] + L[(k + 1) % N]) / 4;
  return { L: S, clear, vis };
}

/**
 * The bend for one place to stand, one mirror and one turn: the rules' way θ (from +x toward +y, round you) is the
 * door's way u (relative to its face) by `u = near(θ)` close in and `far(θ)` further out.
 */
function bendOf(room, mirror, turn, floor = 0.08) {
  const { L } = room;
  // (the share of the rules' ways each of the door's ways takes: the open ones many, the shut ones a few)
  // (no way takes more than 1.25 of its share or less than 0.08: a way too greedy stretches a body's walk across it)
  // (a higher floor, in a cramped yard with one way open: bends less, stretches a walk across it less)
  const w = Array.from(L, c => clamp(c / 8, floor, 1.25));
  const cdf = new Float64Array(N + 1);
  for (let k = 0; k < N; k++) cdf[k + 1] = cdf[k] + w[k];
  const tot = cdf[N];
  for (let k = 0; k <= N; k++) cdf[k] /= tot;
  // (the cumulative share at a way u, and the way at a share, both round and round the circle)
  const C = u => {
    const b = binOf(u);
    const k = Math.floor(b);
    return cdf[k] + (cdf[k + 1] - cdf[k]) * (b - k);
  };
  const Cinv = f => {
    const g = f - Math.floor(f);
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cdf[m] <= g) lo = m;
      else hi = m;
    }
    const span = cdf[lo + 1] - cdf[lo] || 1e-9;
    return ((lo + (g - cdf[lo]) / span) / N) * TAU;
  };
  const f0 = C(turn);
  const near = th => turn + mirror * wrap(th);
  const far = th => Cinv(f0 + (mirror * wrap(th)) / TAU);
  return { near, far, L };
}

/** The whole map from the rules' ground to the world's, for one choice; `reach` (the furthest drawn each way) after. */
function mapOf({ o, anchor, face, bend, reach }) {
  const [ax, az] = anchor;
  const { near, far, L } = bend;
  // (where the bend is whole, each way: the open ground that way, within limits)
  const outTo = u => clamp(OUT.share * readT(L, u), OUT.lo, OUT.hi);
  // (drawn in beyond the core, each way by its own share, so its furthest fits; never under 0.3 of the rules')
  const shrink = u => {
    if (!reach) return 1;
    const R = readT(reach, u);
    if (R <= CORE + 0.5) return 1;
    return clamp((readT(L, u) - CORE) / (R - CORE), 0.3, 1);
  };
  function ways(x, y) {
    const [dx, dy] = [x - o[0], y - o[1]];
    const r = Math.hypot(dx, dy);
    if (r < 1e-9) return { r: 0, u: near(0), s: 0 };
    const th = Math.atan2(dy, dx);
    const un = near(th);
    const s = r <= CORE ? 0 : smooth(CORE, outTo(un), r);
    const u = s > 0 ? un + s * wrap(far(th) - un) : un;
    return { r, u, s };
  }
  function W(x, y) {
    const q = ways(x, y);
    if (q.r === 0) return [ax, az];
    const rho = q.r <= CORE ? q.r : CORE + shrink(q.u) * (q.r - CORE);
    const h = face + q.u;
    return [ax + Math.sin(h) * rho, az + Math.cos(h) * rho];
  }
  return { W, ways };
}

export function layRaid({ o, frames, shots = [], anchors, face, open, seen, turns = [0, -0.26, 0.26, -0.52, 0.52] }) {
  let best = null;
  // (each sample is a tenth of a second; who is in the thick of it: a shot or blow of theirs, or at them, within 1.5 s)
  const busy = frames.map(F => {
    const set = new Set();
    for (const S of shots) if (Math.abs(S.t - F.t) < 1.5) {
      set.add(S.from);
      set.add(S.to);
    }
    return set;
  });
  const dt = frames.length > 1 ? frames[1].t - frames[0].t : 0.1;
  for (const anchor of anchors) {
    const room = roomFrom(anchor, face, open, seen);
    // (the rigid ground round you should be open ground: the share of it that is not)
    let n = 0;
    let shut = 0;
    for (let dx = -CORE; dx <= CORE + 1e-6; dx += 0.4) {
      for (let dz = -CORE; dz <= CORE + 1e-6; dz += 0.4) {
        if (dx * dx + dz * dz > CORE * CORE) continue;
        n += 1;
        if (!open(anchor[0] + dx, anchor[1] + dz)) shut += 1;
      }
    }
    const core = n ? shut / n : 0;
    for (const mirror of [1, -1]) {
      for (const turn of turns) for (const floor of [0.08, 0.35]) {
        const bend = bendOf(room, mirror, turn, floor);
        // (first unshrunk, to find how far each way the fight goes; then drawn in to fit)
        const M0 = mapOf({ o, anchor, face, bend, reach: null });
        const R = new Float64Array(N);
        for (const F of frames) for (const p of F.at) {
          if (!p) continue;
          const q = M0.ways(p[0], p[1]);
          const k = Math.round(binOf(q.u)) % N;
          R[k] = Math.max(R[k], q.r);
        }
        // (the furthest each way, spread over the ways either side of it within 15 degrees, eased)
        const reach = new Float64Array(N);
        for (let k = 0; k < N; k++) {
          let m = 0;
          for (let j = -3; j <= 3; j++) m = Math.max(m, R[(k + j + N) % N]);
          reach[k] = m;
        }
        const M = mapOf({ o, anchor, face, bend, reach });
        let solid = 0;
        let unseen = 0;
        let bent = 0;
        let bentMost = 0;
        // (STRETCH: the most a body's drawn step is longer than its step on the rules' ground, over a tenth of a second:
        // a bend too sharp for a walk throws a body across the picture)
        let stretch = 1;
        let over = 0;
        const last = new Map();
        frames.forEach((F, i) => {
          F.at.forEach((p, j) => {
            if (!p) {
              last.delete(j);
              return;
            }
            const [x, z] = M.W(p[0], p[1]);
            if (!open(x, z)) solid += dt;
            if (busy[i].has(j) && !seen(x, z)) unseen += dt;
            const q = M.ways(p[0], p[1]);
            if (q.r > 0 && q.r < 3) {
              const b = Math.abs(wrap(q.u - bend.near(Math.atan2(p[1] - o[1], p[0] - o[0]))));
              bent += b * dt;
              bentMost = Math.max(bentMost, b);
            }
            const was = last.get(j);
            if (was) {
              const dr = Math.hypot(p[0] - was[0], p[1] - was[1]);
              const dw = Math.hypot(x - was[2], z - was[3]);
              if (dr > 0.12) {
                const k = dw / dr;
                stretch = Math.max(stretch, k);
                if (k > 1.5) over += (k - 1.5) * dt;
              }
            }
            last.set(j, [p[0], p[1], x, z]);
          });
        });
        let blocked = 0;
        for (const S of shots) {
          const F = frames[Math.min(frames.length - 1, Math.max(0, Math.round((S.t - frames[0].t) / dt)))];
          const [a, b] = [F.at[S.from], F.at[S.to]];
          if (!a || !b) continue;
          const [A, B] = [M.W(a[0], a[1]), M.W(b[0], b[1])];
          for (let u = 0.2; u < 0.81; u += 0.2) {
            if (!open(A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u)) {
              blocked += 1;
              break;
            }
          }
        }
        const cost = solid * 10 + unseen * 1 + blocked * 2 + bent * 0.5 + over * 8 + Math.abs(turn) * 2 + core * 8 + Math.hypot(anchor[0] - anchors[0][0], anchor[1] - anchors[0][1]) * 0.6;
        if (!best || cost < best.cost) best = { W: M.W, ways: M.ways, bend, anchor, mirror, turn, floor, cost, figures: { solid: +solid.toFixed(2), unseen: +unseen.toFixed(2), blocked, bent: +bentMost.toFixed(2), stretch: +stretch.toFixed(2), core: +core.toFixed(2) }, room };
      }
    }
  }
  // (for the record: how open each way round the door is, every 30 degrees from its face (m), and where the rules'
  // ways out at 10 m are drawn, as headings off the face (degrees))
  if (best) {
    best.room = Array.from({ length: 12 }, (_, k) => +readT(best.room.L, (k * TAU) / 12).toFixed(1));
    best.drawnWays = Object.fromEntries([0, 30, 60, 90, 120, 150, 180, -150, -120, -90, -60, -30].map(d => [d, Math.round((wrap(best.ways(o[0] + 10 * Math.cos((d * Math.PI) / 180), o[1] + 10 * Math.sin((d * Math.PI) / 180)).u) * 180) / Math.PI)]));
  }
  return best;
}
