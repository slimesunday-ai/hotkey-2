// THE CITY'S OWN FIGURES: the people the city itself stands and seats in its places (the inmates on Iron Island's
// waiting bench, a patient on a forecourt bench, a clerk, two people talking on a sidewalk). They are baked into
// each block's build, are no walker of the pedestrian sim and are in nobody's collision world, so the stage knew
// nothing of them: the place table read "a bench, two seats" off the yard's bench, the city seats its own two
// inmates on that bench, and the player was sat in one of them (the owner, 2026-11-12: "we do cut to the jail but
// im sitting on top of an npc ... buggy stuff like that cant happen").
//
// READ, NOT TYPED, AND READ FROM WHAT IS DRAWN: every block the city has streamed in carries its people's far tier
// (stream.js `data.cm.far`, made by charbake.js bakeCast: per person up to four boxes, legs, body, head and hat,
// eleven numbers each: the box's middle x y z, its size x y z, the heading, a colour, the block's quarter). The
// boxes of one person follow one another from the feet up. A figure here is one person: the middle of its boxes,
// its feet and its top. Whatever the city draws is in here, whichever build put it there; nothing of ours is.
//
//   const figures = createFigures({ city });
//   figures.at(x, z, y, reach, now)   the figure whose body is within `reach` metres of a body's at (x, z) with its
//                                 feet at y, or null. `now`: the streamed blocks are looked over first (asked when a
//                                 place is GIVEN: a block's people arrive with its build, and a place given in the
//                                 third of a second before the next look was given blind)
//   figures.known(x, z)           has the city said who stands on the block this point is on (false: not yet)
//   figures.all()                 every figure known now · figures.count
//
// How near is too near (metres between the two middles, the figure's own body left out: a giant's is bigger):
/** A body's own half width, the pedestrian sim's (pedsim.js PED.body). */
export const BODY = 0.3;
/** Nobody is GIVEN a place (a seat, a lean, a standing spot, a mark) this near a figure: a body's width and more. */
export const SPOT = 0.6;
/** Nobody walks, and no mark of a scene is put, this near one: over the audit's own measure of two bodies in one another (0.6 m). */
export const PASS = 0.32;
/** What the audit counts (`overlaps`): the same 0.6 m between two middles as its `close` for two of ours. */
export const TOUCH = 0.3;

const CELL = 2;
const keyOf = (ix, iz) => (ix + 32768) * 65536 + (iz + 32768);

/** One block's figures, from its far tier. */
function read(far) {
  const out = [];
  let F = null;
  let lastY = 0;
  for (let k = 0; k + 10 < far.length; k += 11) {
    const [x, y, z, sx, sy, sz] = [far[k], far[k + 1], far[k + 2], far[k + 3], far[k + 4], far[k + 5]];
    // (the next person: the boxes start again at the feet, or this one is nowhere near the last)
    if (!F || y <= lastY || Math.hypot(x - F.x, z - F.z) > 0.3 + Math.max(sx, sz) * 0.5) {
      F = { x, z, n: 0, ax: 0, az: 0, y0: Infinity, y1: -Infinity, r: BODY };
      out.push(F);
    }
    F.n += 1;
    F.ax += x;
    F.az += z;
    [F.x, F.z] = [F.ax / F.n, F.az / F.n];
    F.y0 = Math.min(F.y0, y - sy / 2);
    F.y1 = Math.max(F.y1, y + sy / 2);
    lastY = y;
  }
  // (a giant's body is as much wider as it is taller: Lady Justice is four of anybody)
  for (const F of out) F.r = BODY * Math.max(1, Math.min(6, (F.y1 - F.y0) / 2.6));
  return out;
}

export function createFigures({ city }) {
  const seen = new Map();
  let list = [];
  let grid = new Map();
  let boxes = [];
  let last = -1e9;

  /**
   * Looks the streamed blocks over: a few times a second for whoever asks every step of a way (a block's people come
   * and go with its build), and at once (`force`) for whoever is about to give somebody a place.
   */
  function refresh(force = false) {
    const now = performance.now();
    if (!force && now - last < 300) return;
    last = now;
    const blocks = city.stream?.blocks;
    if (!blocks) return;
    let changed = false;
    const live = new Set();
    for (const r of blocks.values()) {
      live.add(r);
      const cm = r.data?.cm ?? null;
      const had = seen.get(r);
      if (had && had.cm === cm) continue;
      seen.set(r, { cm, figures: cm?.far?.length ? read(cm.far) : [] });
      changed = true;
    }
    for (const r of seen.keys()) {
      if (live.has(r)) continue;
      seen.delete(r);
      changed = true;
    }
    if (!changed) return;
    list = [];
    grid = new Map();
    boxes = [];
    for (const [r, S] of seen) {
      if (S.cm && Number.isFinite(r.x0)) boxes.push([r.x0, r.z0, r.x1, r.z1]);
      for (const F of S.figures) {
        list.push(F);
        // (in every cell its body and the widest reach asked of it touch: one cell is read per question)
        const m = F.r + 1.2;
        for (let ix = Math.floor((F.x - m) / CELL); ix <= Math.floor((F.x + m) / CELL); ix++) {
          for (let iz = Math.floor((F.z - m) / CELL); iz <= Math.floor((F.z + m) / CELL); iz++) {
            const key = keyOf(ix, iz);
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(F);
          }
        }
      }
    }
  }

  return {
    at(x, z, y = null, reach = PASS, now = false) {
      refresh(now);
      const cell = grid.get(keyOf(Math.floor(x / CELL), Math.floor(z / CELL)));
      if (!cell) return null;
      let best = null;
      let bestD = Infinity;
      for (const F of cell) {
        // (somebody on a roof, a fire escape or a bleacher's top plank is over nobody's head on the ground)
        if (y !== null && (F.y0 > y + 1.5 || F.y1 < y + 0.3)) continue;
        const d = Math.hypot(F.x - x, F.z - z) - F.r;
        if (d < Math.min(reach, 1.2) && d < bestD) [best, bestD] = [F, d];
      }
      return best;
    },
    known(x, z) {
      refresh(true);
      return boxes.some(b => x >= b[0] && x < b[2] && z >= b[1] && z < b[3]);
    },
    all() {
      refresh();
      return list;
    },
    get count() {
      refresh();
      return list.length;
    },
  };
}
