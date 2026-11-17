// HEADS OVER EACH OTHER IN THE PICTURE: the audit's measure and the stage's rule for where a person stands, as one.
// PURE (no three, no page): the camera comes in as a function that takes a world point to the picture.
//
// The city's figures have heads a metre across (with the hat: headOf in actors.js). Two people standing closer than
// about 1.2 m, or lined up one behind the other toward the camera, have one head drawn over the other. The audit's
// `heads` counts a pair of ours, both standing, whose heads' boxes on the picture share more than HEADS_SHARE of the
// smaller for more than HEADS_SECS of the game's own clock (actors.js auditHeads). The stage stands people by the
// same test (actors.js headsAt, director.js headRoom), so the rule and the check agree.
//
//   headRect(H, x, y, z, yaw, project) → [x0, y0, x1, y1] the head box's eight corners through `project`
//   headShare(a, b)                    → how much of the smaller box the two share (0 apart, 1 one inside the other)
//   clearPlace({ ... })                → the nearest place on rings round a point whose head is clear, or null
//   headSpell(t, dt, over)             → the seconds a pair has been over each other, on the game's clock

/** More than this share of the smaller head on the picture is one head over the other. */
export const HEADS_SHARE = 0.15;
/** For longer than this, of the game's own clock (seconds at 1x): the audit's `heads`. */
export const HEADS_SECS = 0.5;

/**
 * A head's box (H: { hw, hd, y0, y1 }, half its width and depth, its bottom and top over the feet) for a body standing
 * at (x, y, z) turned to `yaw` (0 faces +z), its eight corners through `project(x, y, z) → [sx, sy]`: the box on the
 * picture that holds them, [x0, y0, x1, y1].
 */
export function headRect(H, x, y, z, yaw, project) {
  const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
  const r = [Infinity, Infinity, -Infinity, -Infinity];
  for (const bx of [-H.hw, H.hw]) {
    for (const bz of [-H.hd, H.hd]) {
      for (const by of [H.y0, H.y1]) {
        const [px, py] = project(x + bx * c + bz * s, y + by, z - bx * s + bz * c);
        r[0] = Math.min(r[0], px);
        r[1] = Math.min(r[1], py);
        r[2] = Math.max(r[2], px);
        r[3] = Math.max(r[3], py);
      }
    }
  }
  return r;
}

/** How much of the smaller of two boxes on the picture the two share: 0 when apart. */
export function headShare(a, b) {
  const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
  const h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]));
}

/**
 * A pair's spell over each other, counted on the GAME'S clock: `t` the seconds so far, `dt` this frame's game seconds
 * (the stage's own clock, its speed in it: at 4x a frame of 1/60 s is 1/15 s of the game), `over` whether the two are
 * over each other this frame. → { t, fired }: the seconds now (0 once apart), and whether the spell has just passed
 * HEADS_SECS (each spell once). A spell is the same length of the game at any speed and any frame rate.
 */
export function headSpell(t, dt, over) {
  if (!over) return { t: 0, fired: false };
  const now = t + dt;
  return { t: now, fired: now > HEADS_SECS && t <= HEADS_SECS };
}

/** The bearings a search turns through from its first one: straight ahead, then either side, further each time. */
export const TURNS = [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.25, -1.25, 1.6, -1.6, 2.0, -2.0, 2.5, -2.5, Math.PI];

/**
 * THE NEAREST CLEAR PLACE: on rings of `rings` metres round (ox, oz), from the bearing `a0` (radians, sin/cos: 0 is
 * +z) turned through TURNS, a place where `ground(x, z, ux, uz)` holds (standing ground: the caller's, with the way
 * out from the middle [ux, uz]) and the head there shares no more than `limit` with anybody (`share(x, z)`). A place
 * with nobody's head in it at all (no more than `none`) is taken before one that only clears the limit; then the
 * nearest step from where the person stands (`from`). → [x, z], or null when there is none.
 */
export function clearPlace({ ox, oz, a0, rings, from, share, ground = () => true, limit = HEADS_SHARE / 2, none = 0.02 }) {
  let best = null;
  for (const r of rings) {
    for (const da of TURNS) {
      const [ux, uz] = [Math.sin(a0 + da), Math.cos(a0 + da)];
      const [x, z] = [ox + ux * r, oz + uz * r];
      if (!ground(x, z, ux, uz)) continue;
      const s = share(x, z);
      if (s > limit) continue;
      const score = (s > none ? 1000 : 0) + Math.hypot(x - from[0], z - from[1]);
      if (!best || score < best.score) best = { at: [x, z], score };
    }
  }
  return best ? best.at : null;
}
