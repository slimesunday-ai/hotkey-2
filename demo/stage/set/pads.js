// The pads: one home of the city per seat (demo/stage/citymap.js PADS: ten trailers of Sunny Acres). Their rooms are
// the city's own (interiors/city/: a preset layout per home by its tier, built in 15 ms), opened with the city's own
// cutaway, which is ONE cut for the whole page: so one pad is open at a time, the one asked for last.
//
// The city opens a walk-up flat by taking its front wall and the storey's inside away, for a camera across the street,
// and draws its own figure in the room. Two things differ here. The set's camera is above, so the cut takes
// everything over the room instead, and the room is built without a ceiling. And the people inside are the stage's
// walkers, which the city's cut would cut away with the building: so the cut starts above their heads (HEADROOM) and
// leaves the storey below it alone.
const CITY = new URL('../../../city/from-trunk/style/city/', import.meta.url).href;

const HEADROOM = 2.2;

export async function createPads(city, PADS) {
  const [HOMES, ASSIGN, FILL, FRAME, GPU] = await Promise.all([
    import(`${CITY}interiors/city/index.js`), import(`${CITY}interiors/city/assign.js`), import(`${CITY}interiors/city/fill.js`),
    import(`${CITY}interiors/city/frame.js`), import(`${CITY}gpu.js`),
  ]);
  // the layouts of the tiers a pad can be (a trailer, a walk-up flat), read once: the homes runtime asks for a
  // room's layout without waiting
  const layouts = new Map();
  await Promise.all([...ASSIGN.LAYOUTS.trailer, ...ASSIGN.LAYOUTS.apartment].map(async name => {
    layouts.set(name, await fetch(`${CITY}interiors/home/assemblies/${name}.json`).then(r => r.json()));
  }));
  const homeOf = new Map(Object.entries(PADS).map(([seat, pad]) => [`pad:${seat}`, pad.home]));
  const seats = new Set(homeOf.values());
  const roomOf = h => {
    if (!seats.has(h.id)) return null;
    const tier = h.tier === 'trailer' ? 'trailer' : 'apartment';
    const wealth = tier === 'trailer' ? 0.1 : 0.3;
    const name = ASSIGN.layoutFor(h.id, tier);
    const A = layouts.get(name);
    if (!A) return null;
    const seed = FRAME.homeSeed(h.id);
    const fills = FILL.fillsFor(A, { tier, wealth, sec: new Set(), seed, show: false });
    return { name, A, fills, owner: h.id, wealth, key: name };
  };
  const NIGHT = new URLSearchParams(location.search).get('tod') === 'night';
  const homes = HOMES.createHomes(city, { Q: new URLSearchParams(), NIGHT, record: { roomOf } });
  const entry = key => {
    const id = homeOf.get(key);
    return id ? homes.index().get(id) ?? null : null;
  };

  // who wants which pad open, in the order they asked: the last one has the cut
  const wanted = [];
  let open = null;
  let busy = Promise.resolve();
  async function sync() {
    const key = wanted[wanted.length - 1] ?? null;
    if (key === open) return;
    const h = key ? entry(key) : null;
    if (!h) {
      if (open) homes.close({ instant: true });
      open = null;
      return;
    }
    // no ceiling, so the room is seen from above
    const ok = await homes.open({ ...h, ceiling: false }, { instant: true });
    if (!ok) return;
    open = key;
    // the city's cut, moved: everything over head height above the room goes, nothing below it does
    // (gpu.js CUT: [5] and [6] are the upper box's floor and top, [12] and [13] the storey's)
    const cut = GPU.CUT.value;
    cut[5] = h.floorY + HEADROOM;
    cut[6] = 1e5;
    cut[12] = cut[13] = 0;
  }

  return {
    homes,
    has: key => homeOf.has(key),
    /** Where the pad's tenant stands: a step inside the front wall, facing the street. Null until its block is built. */
    anchor(key) {
      const h = entry(key);
      if (!h) return null;
      const d = h.fd / 2 - 1.2;
      return [h.cx + Math.sin(h.th) * d, h.floorY + 0.02, h.cz + Math.cos(h.th) * d, h.th];
    },
    show(key, on) {
      const at = wanted.indexOf(key);
      if (at !== -1) wanted.splice(at, 1);
      if (on) wanted.push(key);
      busy = busy.then(sync, sync);
      return busy;
    },
    get open() {
      return open;
    },
  };
}
