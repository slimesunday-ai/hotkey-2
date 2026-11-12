// WHO STANDS WHERE at the game's places: every person has a standing spot of their own. PURE (no three, no page).
//
// The spots are data, the place table's (demo/stage/places.json through citymap.js STANDS): the city's own published
// stand spots for each place and its own stand-spot rules run round ours (demo/tools/place-table.mjs says how). Each is clear of the walkers' lanes, of the kerb-wait rows and the zebra
// approaches, of everything the block's build left on the sidewalk and of the next spot (1.3 m), and comes with its
// ENTRY: the lane point it is walked to and from over a clear straight step. Nobody is ever stood on a roadway.
//
//   const stands = createStands({ map, data, fit });
//   stands.claim(personId, block, spot, { through, beside, fresh, seat }) → { x, z, ry, entry, kind, lean?, sit?, pace?, beat? }
//                                                                          a place nobody else has
//   stands.release(personId)
//
// How a place is chosen:
//   'street'              the block's free spot nearest its own `street` point, or nearest `beside` (the person
//                         they have come to see, when the caller says who). A full block spills on to the nearest
//                         free spot of the blocks next to it. `seat`: someone with an hour to hang about takes the
//                         block's free spot that has something to lean on or sit on, when it has one (the city's
//                         spot kinds: a wall's `lean` point, a ledge's `sit`, a bench seat). Most have none
//   a named spot          (a counter, the desk, the pier) its first taker stands ON it, made fit to stand on by `fit`
//                         (off the lane's line, see actors.js fitSpot); the next ones take the free spots nearest it
//   a door, a held        asked for with `through` (whoever walks there goes on through it: director.js enter):
//   place's exit          the point itself, shared. A door somebody is to STAND at (a pickup, a break-in) is a
//                         named spot like any other: one person beside it, the rest on the spots nearest it
// With no data (the file is missing) everyone stands at the map's own points, a body's width apart in a row: the
// stage still plays, and says so once.

/** Metres between two people when there is no spot data to stand them on. */
const ROW = 1.3;
/** A named place (a counter) keeps this much round it clear of the data's spots: a little under their own 1.3 m. */
const CLEAR = 1.1;
/** Whoever keeps a door stands this far up the sidewalk from it. */
const BESIDE = 1.5;
/** And this much off the straight step from the lane to any spot it leaves in use (the city's own figure). */
const STEP = 0.8;
/** How far a point is from a spot's step: the straight line from the spot's entry on the lane to the spot. */
function offStep(s, p) {
  const [dx, dz] = [s.x - s.entry.x, s.z - s.entry.z];
  const k = Math.max(0, Math.min(1, ((p.x - s.entry.x) * dx + (p.z - s.entry.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(s.entry.x + dx * k - p.x, s.entry.z + dz * k - p.z);
}

export function createStands({ map, data = null, fit = (x, z, along = 0) => ({ x: x + along, z, entry: null }), vet = null }) {
  const HELD = map.HELD ?? {};
  const blocks = data?.blocks ?? {};
  const all = Object.entries(blocks).flatMap(([block, spots]) => spots.map(s => ({ ...s, block, by: null })));
  const near = (list, x, z) => list.slice().sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  // each block's spots in the order they are handed out: its own (nearest its street point first: the file's
  // order), then everybody else's by how far they are from that point
  // (only the places that load with it: nobody spills from the bar to Sunny Acres)
  const together = (a, b) => !map.zoneOf || map.zoneOf(a) === map.zoneOf(b);
  const pools = new Map();
  for (const [block, B] of Object.entries(map.BLOCKS)) {
    const [x, z] = B.spots.street;
    pools.set(block, [...all.filter(s => s.block === block), ...near(all.filter(s => s.block !== block && together(s.block, block)), x, z)]);
  }
  // A HELD PLACE'S OWN SPOTS (Iron Island's yard, St. Mercy's forecourt): whoever is held is given one, a real bench
  // seat while there is one free
  const heldPools = new Map(Object.keys(HELD).map(id => [id, (data?.held?.[id] ?? []).map(s => ({ ...s, block: id, by: null }))]));
  const named = new Map();
  const holds = new Map();
  let warned = false;

  /** The [x, z] a block's spot names. `door:<id>` and `pad:<id>` are that seat's own door when the set gives one. */
  function base(block, spot) {
    if (HELD[block]) return HELD[block].exit ?? HELD[block].at;
    const B = map.BLOCKS[block];
    if (!B) return null;
    const own = /^(door|pad):(.*)$/.exec(spot);
    if (own && map.PADS?.[own[2]]?.door) return map.PADS[own[2]].door;
    return B.spots[own ? own[1] : spot] ?? B.spots.street;
  }

  function release(id) {
    const S = holds.get(id);
    if (S?.by === id) S.by = S.unfit ? 'unfit' : null;
    holds.delete(id);
  }

  function claim(id, block, spot = 'street', { through = false, beside = null, fresh = false, seat = false, clear = null } = {}) {
    const at = base(block, spot);
    if (!at) return null;
    // held there ('in'): a place of the held place's own
    if (HELD[block] && spot === 'in') {
      const had = holds.get(id);
      if (had?.key === `${block}/in`) return had;
      release(id);
      const pool = heldPools.get(block) ?? [];
      const S = pool.find(s => !s.by && s.kind === 'bench') ?? pool.find(s => !s.by) ?? { x: at[0], z: at[1], ry: null, entry: null, kind: 'open', by: null, spare: `${block}/in` };
      S.by = id;
      S.key = `${block}/in`;
      holds.set(id, S);
      return S;
    }
    // a held place's door for whoever is held, or any door on the way in: a point to walk to, shared by everyone
    // who goes through it
    if (through) {
      release(id);
      return { x: at[0], z: at[1], ry: null, entry: null, way: true };
    }
    // (asked again for the place they have, a person keeps it: nobody shuffles along the kerb after every scene.
    // The key is the point, so the three seats behind one street door ask for one place)
    // (whoever KEEPS a held place, the medic at the tent, stands beside its door: a named place of its own)
    const keeper = !!HELD[block];
    const key = keeper ? `${block}@keeper` : spot === 'street' ? `${block}/street` : `${block}@${at[0]},${at[1]}`;
    const had = holds.get(id);
    // (`fresh`: they are walking off, and want any place but the one they have)
    if (!fresh && had?.key === key && (!beside || Math.hypot(had.x - beside[0], had.z - beside[1]) < 3.2)) return had;
    release(id);
    const pool = pools.get(block) ?? all;
    let S = null;
    if (keeper || spot !== 'street') {
      if (!named.has(key)) {
        const N = { ...fit(at[0], at[1], keeper ? BESIDE : 0), block, by: null, named: true };
        named.set(key, N);
        // (a spot of the data that the named place stands in, or whose step from the lane passes through it, is
        // nobody's from now on)
        for (const s of all) if (Math.hypot(s.x - N.x, s.z - N.z) < CLEAR || (s.entry && offStep(s, N) < STEP)) s.by = key;
      }
      S = named.get(key);
      if (S.by) S = near(pool.filter(s => !s.by), S.x, S.z)[0] ?? null;
    } else if (beside) {
      // someone they have business with stands on this block: the free spot nearest that person, the block's own first
      // (`clear`: [x, z, r], a ring that is being kept clear, a scene's room: no spot inside it)
      const free = pool.filter(s => !s.by && !(fresh && s === had) && !(clear && Math.hypot(s.x - clear[0], s.z - clear[1]) < clear[2]));
      const own = free.filter(s => s.block === block);
      S = near(own.length ? own : free, beside[0], beside[1])[0] ?? null;
    } else S = (seat ? pool.find(s => !s.by && s.block === block && (s.lean || s.sit || s.kind === 'bench')) : null) ?? pool.find(s => !s.by) ?? null;
    if (!S) {
      // no data, or every spot on the set is taken: the map's own point, in a row. Not checked against anything
      if (!warned) console.warn(`[stage] no standing spot left at ${block}/${spot}: people stand at the map's own point, unchecked`);
      warned = true;
      const n = [...holds.values()].filter(s => s.spare === `${block}/${spot}`).length;
      S = { x: at[0] + Math.ceil(n / 2) * (n % 2 ? 1 : -1) * ROW, z: at[1], ry: null, entry: null, spare: `${block}/${spot}`, by: null };
    }
    S.by = id;
    S.key = key;
    holds.set(id, S);
    return S;
  }

  return {
    base,
    claim,
    release,
    /** The spot a person holds now, or null. */
    of: id => holds.get(id) ?? null,
    clear() {
      for (const S of holds.values()) S.by = S.unfit ? 'unfit' : null;
      holds.clear();
    },
    /**
     * LOOKS A PLACE'S SPOTS OVER AGAINST THE GROUND AS IT STANDS (`vet(at, spot)`, the stage's: true, a body can stand
     * there and walk there from the place's own point; false, it cannot; null, the ground is not known yet). The
     * spots are the city's own rules run round our points, and at a yard, a lot or a park some come out behind what
     * stands there: in a gap between two houses, on the far side of a fence. A spot found bad is nobody's, for good.
     */
    vet(place) {
      if (!vet) return;
      const at = (map.BLOCKS[place] ?? HELD[place])?.at ?? map.BLOCKS[place]?.spots?.street;
      if (!at) return;
      const list = map.BLOCKS[place] ? all.filter(s => s.block === place) : heldPools.get(place) ?? [];
      for (const s of list) {
        if (s.vetted) continue;
        const ok = vet(at, s);
        if (ok === null) continue;
        s.vetted = true;
        if (!ok) {
          s.by = 'unfit';
          s.unfit = true;
        }
      }
    },
    /**
     * Everyone is about to be seated again (another zone has been loaded): nobody holds anything, and the named
     * places are made fit again (a counter is fitted against the sidewalk it is on, which is only known once its
     * block is built).
     */
    reset() {
      for (const S of holds.values()) S.by = null;
      holds.clear();
      for (const s of all) s.by = s.unfit ? 'unfit' : null;
      for (const pool of heldPools.values()) for (const s of pool) s.by = s.unfit ? 'unfit' : null;
      named.clear();
    },
    /** Every spot with who is on it (for the tools and for looking into a problem). */
    list: () => [...all, ...[...heldPools.values()].flat(), ...named.values()].map(s => ({ block: s.block, x: s.x, z: s.z, by: s.by ?? null, named: !!s.named })),
    /** The spots found unfit so far, by place (for the tools and the place table's account). */
    unfit: () => Object.fromEntries([...Object.keys(blocks), ...heldPools.keys()].map(id => [id, (blocks[id] ? all.filter(s => s.block === id) : heldPools.get(id)).filter(s => s.unfit).length])),
    /** How many spots each block has of its own (for the tools). */
    counts: () => Object.fromEntries(Object.entries(blocks).map(([block, spots]) => [block, spots.length])),
  };
}
