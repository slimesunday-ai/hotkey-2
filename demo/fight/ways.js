// THE WAYS IN: how the people of a fight come into it, as plain data and arithmetic (no browser). Nobody is put down
// in the picture: each of them walks in, from somewhere the camera does not see, along a way that ends at the entry
// the fight's rules give them (src/fight/data.mjs ARENA.entries), and is there on the very tick the rules bring them
// in (LEVELS waves). The rules are not touched: the walk in is the page's, before the rules know them.
//
//   a WAY        { entry, from, path }: `entry` the index of ARENA.entries it ends at, `from` in words (what hides its
//                start), `path` world [x, z] points from its far end; the entry itself is its last point (waysOn adds it)
//   waysOn(...)  a place's ways laid on the city, each ending at its entry
//   pickWays     which way each of a level's people takes (seeded by the fight's own seed, never its rolls), and a
//                little to one side of it, so two who come the same way are not one clump
//   pointBack    a point on a way, s metres back from its end, and the way they walk there
//   startOn      when a walker starts and where: as late as it can, out of the picture
//
// The data for a place is in place.js (WAYS); a new place is a new list of ways, nothing else.

const hash = s => {
  let h = 2166136261;
  for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619);
  return (h >>> 0) / 4294967296;
};

/** The metres of a way. */
export function wayLength(path) {
  let L = 0;
  for (let k = 1; k < path.length; k++) L += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
  return L;
}

/** The point s metres back from a way's end (0: the end itself, its length or more: its far end): [x, z, dx, dz], (dx, dz) the way they walk there. */
export function pointBack(path, s) {
  let left = Math.max(0, s);
  for (let k = path.length - 1; k > 0; k--) {
    const [b, a] = [path[k], path[k - 1]];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const [dx, dz] = L > 1e-9 ? [(b[0] - a[0]) / L, (b[1] - a[1]) / L] : [0, 1];
    if (left <= L || k === 1) {
      const f = L > 1e-9 ? Math.min(1, left / L) : 0;
      return [b[0] - dx * L * f, b[1] - dz * L * f, dx, dz];
    }
    left -= L;
  }
  return [path[0][0], path[0][1], 0, 1];
}

/**
 * A place's ways on the city: each way's path with its entry (arena frame, `entries`) laid on the world by `world(x, y)`
 * as its last point. `side` m: the whole way but its end moved that far to its walker's right (a little apart).
 */
export function waysOn(ways, entries, world) {
  return ways.map(W => {
    const [ex, ez] = world(...entries[W.entry]);
    return { ...W, path: [...W.path.map(p => [p[0], p[1]]), [ex, ez]] };
  });
}

/** The same way, moved `side` m to the right of whoever walks it, all but its last point (the entry). */
export function aside(path, side) {
  if (!side) return path;
  const n = path.length;
  return path.map((p, k) => {
    if (k === n - 1) return p;
    const [a, b] = [path[Math.max(0, k - 1)], path[Math.min(n - 1, k + 1)]];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const [dx, dz] = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    // (the walker's right, walking (dx, dz) on the ground seen from above: (−dz, dx))
    const f = k === n - 2 ? 0.5 : 1;
    return [p[0] - dz * side * f, p[1] + dx * side * f];
  });
}

/**
 * Which way each of a level's people takes: `waves` the level's [t, kind, entry], `ways` the place's (waysOn). Of the
 * ways to an entry, a seeded pick (the fight's seed and the wave's place in the level: the rules' own rolls are never
 * drawn on), and a little to one side of it (up to `spread` m), so the two who come one way are not one clump.
 * → [{ k, id, t, kind, entry, way (index), from, path }].
 */
export function pickWays(waves, ways, seed, { spread = 0.7 } = {}) {
  const used = new Map();
  return waves.map(([t, kind, entry], k) => {
    const mine = ways.map((W, i) => [W, i]).filter(([W]) => W.entry === entry);
    if (!mine.length) throw new Error(`fight: no way in to entry ${entry}`);
    // (the same entry twice in a level: the next way to it, if there is another)
    const n = used.get(entry) ?? 0;
    used.set(entry, n + 1);
    const at = (Math.floor(hash(`way|${seed}|${entry}`) * mine.length) + n) % mine.length;
    const [W, i] = mine[at];
    const side = (hash(`side|${seed}|${k}`) * 2 - 1) * spread;
    return { k, id: `f${k + 1}`, t, kind, entry, way: i, from: W.from, path: aside(W.path, side) };
  });
}

/**
 * WHEN A WALKER STARTS, AND WHERE: `left` s until it must stand at the entry, `speed` m/s, `seen(x, z)` whether a body
 * standing there is in the picture now. As late as it can: it waits while the way `ahead` m in front of where it
 * would start is still out of the picture, and starts the frame that would no longer be so (so it comes in sight
 * walking, from out of it). Never further back than the way's far end, which is out of every picture. → null (not
 * yet), or { s, v } (start s m back from the entry, at v m/s; a little quicker when the camera came round on it).
 */
export function startOn(path, left, speed, seen, { ahead = 4 } = {}) {
  const len = wayLength(path);
  const s = speed * Math.max(0, left);
  if (s > len + 1e-6) return null;
  if (s > ahead + 1e-6 && !seen(...pointBack(path, s - ahead))) return null;
  for (let q = s; ; q = Math.min(len, q + 0.5)) {
    if (!seen(...pointBack(path, q))) return { s: q, v: q > s + 1e-6 ? q / Math.max(left, 0.05) : speed };
    if (q >= len) return { s: len, v: len / Math.max(left, 0.05), late: true };
  }
}
