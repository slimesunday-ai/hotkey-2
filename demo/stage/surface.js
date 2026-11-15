// THE GROUND AS IT IS DRAWN: the height of what our people stand on, read from the city's own pieces.
//
// The city's plan knows two heights, the road (0) and the sidewalk's slab (style.js SIDE, 0.2 m), and everything the
// stage had put feet on was one of the two. What is drawn is more than that: Sunny Acres' lanes and every pad's
// ground are a voxel over the slab (0.3 m: districts/trailer/park.js lanes, trailer/pads.js cover), its porches two
// more (0.5 m), a lawn, a path, a mat or a step a few centimetres over or under the plan's height. Feet put at the
// plan's height stood in them (the owner, 2026-11-14: "the agents and npcs shoes are going through surfaces and not
// perfectly on the ground").
//
// READ FROM WHAT IS DRAWN: each streamed block's tier meshes (stream.js `data.full`, else `data.mid`, else
// `data.far`: lod.js tier meshes, every one of them quads, P in centimetres from the tier's origin), the same pieces
// the city draws and its collision world (camera/world.js) is built from. Here only the UP-FACING faces low enough to
// be stood on are kept, each laid on a grid of CELL metres by whether the cell's middle is inside the face (exact,
// turned homes and slopes included: the collision world's columns are a quarter metre and conservative, so a body a
// hand's width off a porch's edge read the porch). Per cell, the lowest few heights there are.
//
//   const surface = createSurface({ city, P });
//   surface.at(x, z, limit)   the highest drawn face at (x, z) that is no higher than `limit`, or -1 when nothing
//                             of the city's is drawn there under it (the ground plane), or null when the block's
//                             pieces are not here (not streamed in yet, or dropped: nothing can be said)
//
// What is GROUND and what is a thing standing on it is the caller's (actors.js groundAt): a face is ground when it
// is within a step of the plan's own height there. A chair's seat, a table, a cooler's lid are higher than that.

/** The grid's cell, m: the city's voxel (style.js CV). */
const CELL = 0.1;
/** Faces above this (m) are nobody's ground (a stoop is 0.5, a deck with rails 1.5: its boards are 0.5). */
const TOP = 1.0;
/** Heights kept per cell: the lowest this many. */
const K = 4;
/**
 * Each block's grid reaches this far (m) past its own square: a block builds what it owns, and what it owns can
 * stand over its edge (a pad straddles two blocks, a lane's stretch ends where the frame's cell does, not the
 * block's). A point near an edge is asked of the blocks on both sides.
 */
const M = 4;

export function createSurface({ city, P = 36 }) {
  const N = Math.round((P + 2 * M) / CELL);
  const cache = new Map();
  const keyOf = (i, j) => `${i},${j}`;
  /** The tier the block is drawn with now: its full tier (an array of layers), else its middle, else its far. */
  function partsOf(r) {
    const d = r?.data;
    if (!d) return null;
    if (Array.isArray(d.full) && d.full.some(t => t?.n)) return { tier: 'full', obj: d.full, parts: d.full.filter(t => t?.n) };
    if (d.mid?.n) return { tier: 'mid', obj: d.mid, parts: [d.mid] };
    if (d.far?.n) return { tier: 'far', obj: d.far, parts: [d.far] };
    return null;
  }
  const RANK = { far: 1, mid: 2, full: 3 };
  /** Lays a block's low up-facing faces on its grid. */
  function build(i, j, src) {
    const x0 = i * P - M;
    const z0 = j * P - M;
    const H = new Int16Array(N * N * K).fill(32767);
    const n = new Uint8Array(N * N);
    let faces = 0;
    const put = (c, y) => {
      const mm = Math.round(y * 1000);
      const at = c * K;
      const m = n[c];
      for (let k = 0; k < m; k++) if (H[at + k] === mm) return;
      if (m < K) {
        H[at + m] = mm;
        n[c] = m + 1;
      } else {
        // (full: keep the lowest K. The ground is the low end; what is dropped is the top of a stack)
        let hi = 0;
        for (let k = 1; k < K; k++) if (H[at + k] > H[at + hi]) hi = k;
        if (mm < H[at + hi]) H[at + hi] = mm;
      }
    };
    const vx = [0, 0, 0, 0];
    const vy = [0, 0, 0, 0];
    const vz = [0, 0, 0, 0];
    for (const t of src.parts) {
      const p = t.P;
      const nn = t.N;
      const [ox, oy, oz] = t.o;
      for (let q = 0; q + 3 < t.n; q += 4) {
        const v = q * 3;
        const ny = nn[v + 1];
        // (up-facing: its normal mostly up. A voxel's top is straight up; a slope's is tilted)
        if (ny <= 0 || ny < Math.abs(nn[v]) || ny < Math.abs(nn[v + 2])) continue;
        let ylo = Infinity;
        let yhi = -Infinity;
        for (let k = 0; k < 4; k++) {
          vx[k] = p[v + k * 3] * 0.01 + ox - x0;
          vy[k] = p[v + k * 3 + 1] * 0.01 + oy;
          vz[k] = p[v + k * 3 + 2] * 0.01 + oz - z0;
          ylo = Math.min(ylo, vy[k]);
          yhi = Math.max(yhi, vy[k]);
        }
        if (ylo > TOP || yhi < -0.2) continue;
        faces += 1;
        const ax = Math.min(vx[0], vx[1], vx[2], vx[3]);
        const bx = Math.max(vx[0], vx[1], vx[2], vx[3]);
        const az = Math.min(vz[0], vz[1], vz[2], vz[3]);
        const bz = Math.max(vz[0], vz[1], vz[2], vz[3]);
        const i0 = Math.max(0, Math.ceil(ax / CELL - 0.5 - 1e-6));
        const i1 = Math.min(N - 1, Math.floor(bx / CELL - 0.5 + 1e-6));
        const j0 = Math.max(0, Math.ceil(az / CELL - 0.5 - 1e-6));
        const j1 = Math.min(N - 1, Math.floor(bz / CELL - 0.5 + 1e-6));
        if (i1 < i0 || j1 < j0) continue;
        // (square to the grid and flat: every cell whose middle is inside. Turned or sloped: the point in the quad, and
        // its height there)
        const square = (Math.abs(vx[0] - vx[1]) < 1e-3 || Math.abs(vz[0] - vz[1]) < 1e-3) && (Math.abs(vx[1] - vx[2]) < 1e-3 || Math.abs(vz[1] - vz[2]) < 1e-3);
        const flat = yhi - ylo < 0.005;
        if (square && flat) {
          for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) put(jj * N + ii, ylo);
          continue;
        }
        // (the two triangles 0-1-2 and 0-2-3: the point in either, by its barycentric weights, and its height)
        for (let jj = j0; jj <= j1; jj++) {
          const pz = (jj + 0.5) * CELL;
          for (let ii = i0; ii <= i1; ii++) {
            const px = (ii + 0.5) * CELL;
            for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
              const d = (vz[b] - vz[c]) * (vx[a] - vx[c]) + (vx[c] - vx[b]) * (vz[a] - vz[c]);
              if (Math.abs(d) < 1e-9) continue;
              const wa = ((vz[b] - vz[c]) * (px - vx[c]) + (vx[c] - vx[b]) * (pz - vz[c])) / d;
              const wb = ((vz[c] - vz[a]) * (px - vx[c]) + (vx[a] - vx[c]) * (pz - vz[c])) / d;
              const wc = 1 - wa - wb;
              if (wa < -1e-4 || wb < -1e-4 || wc < -1e-4) continue;
              put(jj * N + ii, wa * vy[a] + wb * vy[b] + wc * vy[c]);
              break;
            }
          }
        }
      }
    }
    return { src: src.obj, tier: src.tier, H, n, faces };
  }
  /** The block's grid, built the first time it is asked for and again when a better tier of it arrives. */
  function gridOf(i, j) {
    const r = city.stream?.blocks?.get(keyOf(i, j));
    const src = partsOf(r);
    const had = cache.get(keyOf(i, j));
    if (!src) return had && r ? had : null;
    if (had && (had.src === src.obj || RANK[had.tier] > RANK[src.tier])) return had;
    const g = build(i, j, src);
    cache.set(keyOf(i, j), g);
    // (a page that walks the whole island keeps the blocks it has been to: the oldest go past a few dozen)
    if (cache.size > 48) cache.delete(cache.keys().next().value);
    return g;
  }
  return {
    CELL,
    at(x, z, limit = TOP) {
      const i = Math.floor(x / P);
      const j = Math.floor(z / P);
      if (!gridOf(i, j)) return null;
      const lim = Math.round(limit * 1000);
      let best = -1000;
      // (its own block, and the blocks whose grids reach over the edge it is near)
      const [fx, fz] = [x - i * P, z - j * P];
      for (let bi = fx < M ? i - 1 : i; bi <= (fx > P - M ? i + 1 : i); bi++) {
        for (let bj = fz < M ? j - 1 : j; bj <= (fz > P - M ? j + 1 : j); bj++) {
          const g = gridOf(bi, bj);
          if (!g) continue;
          const ci = Math.floor((x - bi * P + M) / CELL);
          const cj = Math.floor((z - bj * P + M) / CELL);
          if (ci < 0 || cj < 0 || ci >= N || cj >= N) continue;
          const c = cj * N + ci;
          for (let k = 0, at = c * K; k < g.n[c]; k++) if (g.H[at + k] <= lim && g.H[at + k] > best) best = g.H[at + k];
        }
      }
      return best === -1000 ? -1 : best / 1000;
    },
    /** The tier a block's grid was laid from (or null): for the tools. */
    tierAt(x, z) {
      return gridOf(Math.floor(x / P), Math.floor(z / P))?.tier ?? null;
    },
    get blocks() {
      return cache.size;
    },
  };
}
