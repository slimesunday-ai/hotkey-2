// LOADING BY PLACE: only the zone the followed person is in is built (citymap.js ZONES: a place's own city blocks and a
// ring round them, places a short walk apart together), with the haze beyond it. The owner, 2026-11-12: "do we have to
// load the whole city at once, what if for distant places the cut scenes act as loading scenes but it doesnt feel like
// it? so we just load what's needed for the location youre at?"
//
//   const loader = createLoader({ city, CITY, map });
//   loader.prepare(zone) → promise   STARTS BUILDING a zone while the picture is still somewhere else (a departure
//                                    is playing): its blocks are built in the city's own workers and put in the
//                                    city's own block cache, so the cut finds them there
//   await loader.enter(zone, view)   the zone becomes all there is: the city's stream is given its blocks (it frees
//                                    every block that is not among them), the camera is cut to `view`, and the
//                                    promise resolves when the zone stands: every block near the camera drawn at
//                                    the tier it wants and the sidewalks of the zone's own blocks known to the
//                                    walkers. → { seconds, built, cached, blocks }
//   loader.zone · loader.log        what is loaded now · every load so far, with its seconds
//
// HOW A ZONE IS BUILT AHEAD OF THE CUT. The city's stream builds what its camera is near, and there is one camera. So
// prepare() does what the stream's own build does, for blocks the camera is nowhere near: the same job on the same
// worker pool (stream.js build(): { type: 'block', i, j, night, audit, flags }), and the result split into the same
// cache records under the same keys (stream.js store(): far, mid, full and cm). That is eight lines of the pinned
// city's stream repeated here, kept beside the pin: city/API-NOTES.md, "Loading by place". When the camera cuts over,
// the stream finds every block in its cache and has only to read and upload them.
export function createLoader({ city, CITY, map }) {
  const Q = new URLSearchParams(location.search);
  const night = Q.get('tod') === 'night';
  // (the flags the city's page gives its own builds: main.js FLAGS)
  const flags = { neutral: Q.get('neutral') !== '0' && Q.get('pass2') !== '0', pass2: Q.get('pass2') !== '0', faces: Q.get('faces') !== '0', letters: Q.get('letters') === 'classic' ? 'classic' : 'new' };
  const RING = Number(Q.get('ring')) || map.RING;
  const WHOLE = Q.has('oldstage');
  const key = (t, i, j) => `${night ? 'n' : 'd'}:${t}:${i},${j}`;
  const log = [];
  let zone = null;
  let mods = null;
  // (main.js is the city's own page module, already running: the same URL gives the same instance. Its worldBlocks()
  // is every block the city has: a ring round a place on the shore reaches out over open sea, which is no block)
  const modules = () => (mods ??= Promise.all([import(`${CITY}modules.js`), import(`${CITY}lod.js`), import(`${CITY}main.js`).then(M => new Set(M.worldBlocks().map(([i, j]) => `${i},${j}`)))]));
  const preparing = new Map();
  // what the last build ahead of each zone did, for the log
  const prepared = new Map();
  // blocks this page has put in the cache, or found there
  const have = new Set();

  /** The zone's blocks as the stream wants its universe: [i, j, buildable]. */
  async function universe(z) {
    const [{ buildsBlock }, , world] = await modules();
    return map.zoneBlocks(z, RING).filter(([i, j]) => world.has(`${i},${j}`)).map(([i, j]) => [i, j, buildsBlock(i, j)]);
  }

  /**
   * Builds a zone's blocks ahead, into the city's block cache. Blocks the stream holds already, and blocks the cache
   * has from an earlier visit (or an earlier day: the cache is the browser's), are left alone.
   */
  function prepare(z) {
    if (!map.ZONES[z] || z === zone || WHOLE) return Promise.resolve({ zone: z, built: 0, cached: 0 });
    if (preparing.has(z)) return preparing.get(z);
    const t0 = performance.now();
    const job = (async () => {
      const [, { tierBytes }] = await modules();
      const cache = city.cache();
      const pool = city.pool;
      const list = (await universe(z)).filter(([, , buildable]) => buildable);
      const out = { zone: z, built: 0, cached: 0, blocks: list.length, seconds: 0 };
      // (the nearest the zone's middle first: they are what the cut shows)
      const [cx, cz] = map.ZONES[z].at;
      list.sort((a, b) => Math.hypot((a[0] + 0.5) * map.PITCH - cx, (a[1] + 0.5) * map.PITCH - cz) - Math.hypot((b[0] + 0.5) * map.PITCH - cx, (b[1] + 0.5) * map.PITCH - cz));
      if (!cache?.on || !pool) return out;
      await Promise.all(list.map(async ([i, j]) => {
        // (a block whose sidewalks the page knows was built or read this session: the stream stored it then)
        if (city.stream.blocks.get(`${i},${j}`)?.data?.mid || city.LANES.has(`${i},${j}`) || have.has(`${i},${j}`)) {
          out.cached += 1;
          return;
        }
        have.add(`${i},${j}`);
        if (await cache.get(key('mid', i, j))) {
          out.cached += 1;
          return;
        }
        const res = await pool.exec({ type: 'block', i, j, night, audit: false, flags });
        // (stream.js store(), as it is)
        if (res.far !== undefined) await cache.put(key('far', i, j), { far: res.far, maxH: res.maxH }, tierBytes(res.far));
        if (res.mid) {
          await cache.put(key('mid', i, j), { mid: res.mid, maxH: res.maxH, stats: res.stats, trisMid: res.trisMid, pieces: res.pieces, anchors: res.anchors || null, lanes: res.lanes || null }, tierBytes(res.mid));
          await cache.put(key('full', i, j), { full: res.full, tris: res.tris }, tierBytes(res.full));
        }
        if (res.chars) {
          const c = res.chars;
          await cache.put(key('cm', i, j), { cm: { mid: c.mid, far: c.far, count: c.count, centres: c.centres, n: c.n } }, tierBytes(c.mid) + c.far.byteLength);
        }
        out.built += 1;
      }));
      out.seconds = +((performance.now() - t0) / 1000).toFixed(2);
      return out;
    })().catch(err => {
      console.warn('[stage] a zone could not be built ahead:', z, err);
      return { zone: z, built: 0, cached: 0, failed: String(err) };
    });
    preparing.set(z, job);
    job.then(out => {
      preparing.delete(z);
      prepared.set(z, out);
    });
    return job;
  }

  /**
   * Is the zone standing: every block drawn at the tier the camera wants of it, and its own blocks' sidewalks known?
   * (Not the stream's own settled(): that also waits for the full bodies of the city's standing figures, the roof
   * party and the yard's lifters, which are re-baked in a worker on every visit: 0.7 s at the night market. They
   * come in a moment after the cut, the way the city brings them in when it is flown.)
   */
  function standing(z) {
    const lanes = city.peds?.sim?.lanes ?? city.LANES;
    const core = map.ZONES[z].core;
    const blocks = city.stream.blocks;
    // (the zone's own blocks: wanted by now, drawn at the tier wanted, their sidewalks known. Asked first, so that a
    // stream that has not chosen anything yet is never taken for one that has nothing left to do)
    for (const [i, j] of core) {
      const r = blocks.get(`${i},${j}`);
      if (!r) return false;
      if (r.buildable && !(r.want && r.shown === r.want && lanes.has(r.key))) return false;
    }
    for (const r of blocks.values()) {
      if (!r.want || r.shown === r.want || r.failed || (r.want === 'far' && (r.shown === 'mid' || r.emptyFar))) continue;
      return false;
    }
    return true;
  }
  /**
   * And is it SOLID: does the city's collision world hold the real columns of the zone's own blocks (camera/world.js
   * builds them a block at a time, in a worker, after the block itself)? Until it does, nothing knows where a wall
   * is: a walk planned then goes through the night market's stalls. The cut waits for it too, a little.
   */
  function solid(z) {
    const W = city.cam?.world;
    if (!W?.ready) return true;
    return map.ZONES[z].core.every(([i, j]) => city.stream.blocks.has(`${i},${j}`) && (!city.stream.blocks.get(`${i},${j}`).buildable || W.ready((i + 0.5) * map.PITCH, (j + 0.5) * map.PITCH)));
  }

  /**
   * The zone becomes all there is. `view` ({ pos, tgt, fov }) is where the camera is cut to first (the stage's own
   * camera takes over a moment later); without one, the zone's raised view.
   */
  // (one at a time: a trip's cut and a jump asked for by the viewer can come together, and each must find the
  // stream as the one before left it. The zone that stands at the end is the one asked for last)
  let cutter = null;
  let entering = Promise.resolve();
  function enter(z, view = null, opts = {}) {
    const next = entering.catch(() => {}).then(() => enter1(z, view, opts));
    entering = next;
    return next;
  }
  async function enter1(z, view = null, { timeout = 30000 } = {}) {
    if (!map.ZONES[z]) throw new Error(`no such zone: ${z}`);
    const t0 = performance.now();
    const ahead = (await (preparing.get(z) ?? null)) ?? prepared.get(z) ?? null;
    prepared.delete(z);
    const waited = (performance.now() - t0) / 1000;
    const before = city.stream.memory?.() ?? null;
    const list = await universe(z);
    // (?oldstage=1 keeps the whole city loaded, to measure against: the cut only moves the camera)
    if (!WHOLE) {
      city.stream.setUniverse(list, 'section');
      // the haze: everything past the ring is gone into it
      city.R.draw = map.PITCH * (RING + 2.2);
    }
    const v = view ?? map.viewOf(z);
    // (the stage's camera makes the cut when there is one: it keeps account of what the picture is on, and a cut
    // made behind its back reads to it as the viewer's hand)
    if (cutter) cutter({ pos: v.pos, tgt: v.tgt, fov: v.fov ?? 42 });
    else {
      city.VIEWS.hk2 = { pos: v.pos, tgt: v.tgt, fov: v.fov ?? 42, sh: [(v.pos[0] + v.tgt[0]) / 2, (v.pos[2] + v.tgt[2]) / 2, Math.max(16, Math.hypot(v.pos[0] - v.tgt[0], v.pos[2] - v.tgt[2]) * 0.8)] };
      city.cam?.toOrbit({ instant: true });
      city.setView('hk2');
    }
    const from = zone;
    zone = z;
    // THE PICTURE IS BLACK WHILE THIS WAITS, so nothing has to be spread over frames: the stream's upload budget (2 M
    // vertices and 6 ms a frame) and the collision world's copy budget (8,000 quads a frame to its worker: a block
    // of the night market is dozens of frames of that) are lifted until the zone stands, and put back.
    // ?slowcut=1 leaves them be, to measure against.
    const W = city.cam?.world;
    const budget = { uploadVerts: city.R.uploadVerts, uploadMs: city.R.uploadMs, copyQuads: W?.cfg?.copyQuads };
    if (!Q.has('slowcut')) {
      Object.assign(city.R, { uploadVerts: 1e9, uploadMs: 1e9 });
      if (W?.cfg) W.cfg.copyQuads = 1e9;
    }
    let stoodAfter = null;
    let solidAfter = null;
    try {
      // (two frames first: the stream chooses what it wants on its own frame)
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      while (!standing(z) && performance.now() - t0 < timeout) await new Promise(r => setTimeout(r, 20));
      stoodAfter = +((performance.now() - t0) / 1000).toFixed(2);
      // (the collision world: three seconds more at most)
      const t1 = performance.now();
      while (!solid(z) && performance.now() - t1 < 3000) await new Promise(r => setTimeout(r, 20));
      solidAfter = +((performance.now() - t1) / 1000).toFixed(2);
    } finally {
      Object.assign(city.R, { uploadVerts: budget.uploadVerts, uploadMs: budget.uploadMs });
      if (W?.cfg && budget.copyQuads !== undefined) W.cfg.copyQuads = budget.copyQuads;
    }
    const entry = {
      zone: z, from, seconds: +((performance.now() - t0) / 1000).toFixed(2), waitedAhead: +waited.toFixed(2), ahead: ahead ? { built: ahead.built, cached: ahead.cached, seconds: ahead.seconds } : null,
      blocks: list.length, stood: standing(z), stoodAfter, solid: solid(z), solidAfter, memory: memoryNow(), before: before ? { cpu: Math.round(before.cpu / 1e6), gpu: Math.round(before.gpu / 1e6) } : null,
    };
    log.push(entry);
    if (!entry.stood) console.warn(`[stage] the zone ${z} was not whole after ${entry.seconds} s: the cut went ahead`);
    return entry;
  }

  /** What the city holds now, in MB (its stream's own count), and the page's heap when the browser says. */
  function memoryNow() {
    const m = city.stream.memory?.();
    return { cpu: m ? Math.round(m.cpu / 1e6) : null, gpu: m ? Math.round(m.gpu / 1e6) : null, shown: m?.shown ?? null, held: city.stream.blocks.size, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null };
  }

  return {
    prepare,
    enter,
    standing,
    solid,
    memory: memoryNow,
    log,
    ring: RING,
    get zone() {
      return zone;
    },
    /** The stage's camera, once there is one: enter() cuts the picture through it (camera.js cutTo). */
    setCut(fn) {
      cutter = fn;
    },
    /** For boot.js: the first zone is the one the page was started on (its universe is set there). */
    adopt(z) {
      zone = z;
    },
  };
}
