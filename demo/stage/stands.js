// WHO STANDS WHERE at the game's places: every person has a standing spot of their own. PURE (no three, no page).
//
// The spots are data, the place table's (demo/stage/places.json through citymap.js STANDS): the city's own published
// stand spots for each place and its own stand-spot rules run round ours (demo/tools/place-table.mjs says how). Each is clear of the walkers' lanes, of the kerb-wait rows and the zebra
// approaches, of everything the block's build left on the sidewalk and of the next spot (1.3 m), and comes with its
// ENTRY: the lane point it is walked to and from over a clear straight step. Nobody is ever stood on a roadway.
//
//   const stands = createStands({ map, data, fit });
//   stands.claim(personId, block, spot, { through, beside, fresh, seat, apart }) → { x, z, ry, entry, kind, lean?, sit?, pace?, beat? }
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
/** Nobody's place is this near another's (two seats of one bench are 0.84 m apart; everything else is 1.25 m and more). */
const NEAR = 0.7;
/** And this much off the straight step from the lane to any spot it leaves in use (the city's own figure). */
const STEP = 0.8;
/** How far a point is from a spot's step: the straight line from the spot's entry on the lane to the spot. */
function offStep(s, p) {
  const [dx, dz] = [s.x - s.entry.x, s.z - s.entry.z];
  const k = Math.max(0, Math.min(1, ((p.x - s.entry.x) * dx + (p.z - s.entry.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(s.entry.x + dx * k - p.x, s.entry.z + dz * k - p.z);
}

export function createStands({ map, data = null, fit = (x, z, along = 0) => ({ x: x + along, z, entry: null }), vet = null, crowd = null, blocked = null, gap = null, ground = () => true }) {
  // HOW FAR APART TWO PLACES OF OURS ARE KEPT, middle to middle: `gap(a, b, p, q)`, the stage's (actors.js headGap: the
  // two people's heads and a hand between; b null, the widest head the game rolls; more when the two places, p and q,
  // lie along the camera's bearing, one head over the other in the picture), else NEAR. The city's figures have heads
  // a metre across on bodies 0.8 m wide: two places a body's width apart had their heads in each other
  const apartOf = (a, b, p = null, q = null) => Math.max(NEAR, gap?.(a, b, p, q) ?? NEAR);
  const HELD = map.HELD ?? {};
  const blocks = data?.blocks ?? {};
  const all = Object.entries(blocks).flatMap(([block, spots]) => spots.map(s => ({ ...s, block, by: null })));
  const near = (list, x, z) => list.slice().sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  // A BENCH SOMEBODY KEEPS A COUNTER AT IS NOBODY'S SEAT. Where the city has no counter the place table stands the
  // keeper at the best real piece, and at Glasswall Plaza that is a bench: the dealer was then given the seat the
  // shopkeeper stands at, and sat in him for the whole street sale (the audit's `push`, `slide` and `unseated`).
  for (const [block, B] of Object.entries(map.BLOCKS ?? {})) {
    for (const [name, at] of Object.entries(B.spots ?? {})) {
      if (name === 'street' || !Array.isArray(at)) continue;
      for (const s of all) if (s.block === block && s.kind === 'bench' && Math.hypot(s.x - at[0], s.z - at[1]) < 1.6) Object.assign(s, { by: 'unfit', unfit: true, kept: name });
    }
  }
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
  // NOBODY IS GIVEN A PLACE ONE OF THE CITY'S OWN PEOPLE HAS (`crowd(x, z)`, the stage's: figures.js). The city seats
  // and stands people of its own in its places, and the place table knows only the furniture: Iron Island's waiting
  // bench came out as two free seats, the city's two inmates sit on it, and the player was sat in one of them. Asked
  // EVERY TIME a place is given, of the people the city is drawing now: a spot one of them is at is nobody's, for good.
  const crowded = s => {
    if (!crowd?.(s.x, s.z)) return false;
    if (!s.named) Object.assign(s, { by: s.by ?? 'unfit', unfit: true, crowded: true });
    return true;
  };
  const open = s => !s.by && !crowded(s);
  /**
   * A PLACE WHEN EVERY SPOT IS TAKEN (ten held at once and eight places; a block and its neighbours full): the free
   * ground nearest the place's own point that is a body's width and more from everybody's place, from the city's own
   * people, and that the stage's `vet` does not refuse. It used to be the place's own point, for everybody held
   * there after the last spot went: all of them in one another.
   */
  function spare(block, spot, at, id = null) {
    // (from everybody's place, a head and more, and from the place's own spots, which somebody will be given again)
    const own = (heldPools.get(block) ?? all.filter(s => s.block === block)).filter(s => !s.unfit);
    const far = (x, z) => [...holds.entries()].every(([who, h]) => Math.hypot(h.x - x, h.z - z) >= Math.max(ROW, apartOf(id, who, [x, z], [h.x, h.z]))) && own.every(h => Math.hypot(h.x - x, h.z - z) >= ROW);
    // (sixes-1, second pass: ground not known yet, `blocked` 'unknown', only when no known free ground is in reach)
    let unknown = null;
    for (let r = 0; r <= ROW * 8; r += ROW * 0.5) {
      const n = r ? Math.ceil((2 * Math.PI * r) / ROW) : 1;
      for (let k = 0; k < n; k++) {
        const [x, z] = [at[0] + Math.sin((k * 2 * Math.PI) / n) * r, at[1] + Math.cos((k * 2 * Math.PI) / n) * r];
        // (`blocked`: the stage's word that something stands there, a step or a chair, whatever `vet` can say yet.
        // `ground`: and that it is standing ground, off the roadway and off the walkers' own lane)
        if (!far(x, z) || crowd?.(x, z) || !ground(x, z) || vet?.(at, { x, z, kind: 'open' }) === false) continue;
        const b = blocked?.(x, z);
        if (b === 'unknown') {
          unknown ??= { x, z };
          continue;
        }
        if (!b) return { x, z, ry: null, entry: null, kind: 'open', block, by: null, spare: `${block}/${spot}` };
      }
    }
    return unknown ? { ...unknown, ry: null, entry: null, kind: 'open', block, by: null, spare: `${block}/${spot}` } : null;
  }

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

  function claim(id, block, spot = 'street', { through = false, beside = null, fresh = false, seat = false, clear = null, apart = 0, roomy = 0 } = {}) {
    const at = base(block, spot);
    if (!at) return null;
    // NOBODY'S PLACE IS IN SOMEBODY ELSE'S, WHICHEVER LIST EACH CAME FROM. A block's spots, a held place's own and
    // the named places are three lists, each a body's width apart in itself and not from the others: St. Mercy's
    // medic stands at the forecourt's own point, which is also the first open spot of its patients (the seventh
    // patient was stood in the medic). Asked of every place before it is given.
    const clash = s => [...holds.entries()].some(([who, h]) => who !== id && h !== s && !(h.kind === 'bench' && s.kind === 'bench') && Math.hypot(h.x - s.x, h.z - s.z) < apartOf(id, who, [s.x, s.z], [h.x, h.z]));
    const free = s => open(s) && !clash(s);
    // held there ('in'): a place of the held place's own
    if (HELD[block] && spot === 'in') {
      const had = holds.get(id);
      if (had?.key === `${block}/in`) return had;
      release(id);
      const pool = heldPools.get(block) ?? [];
      const S = pool.find(s => free(s) && s.kind === 'bench') ?? pool.find(free) ?? spare(block, 'in', at, id) ?? { x: at[0], z: at[1], ry: null, entry: null, kind: 'open', by: null, spare: `${block}/in` };
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
    const pool = keeper ? heldPools.get(block) ?? [] : pools.get(block) ?? all;
    let S = null;
    if (keeper || spot !== 'street') {
      if (!named.has(key)) {
        const N = { ...fit(at[0], at[1], keeper ? BESIDE : 0), block, by: null, named: true };
        // (a named place made fit can still be in something low, a stall's crate or step at the night market's
        // counter: the nearest point a step round it that is not. `blocked(x, z, r)`, the stage's, at a body's own width)
        // (and on standing ground: the flea market's kerb and its taxi stop are points at the kerb's edge, and their
        // keepers of the day were stood in the roadway, `inRoad`)
        if (blocked?.(N.x, N.z, 0.25) || !ground(N.x, N.z)) {
          ring: for (let r = 0.3; r <= 1.51; r += 0.3) {
            for (let k = 0; k < 12; k++) {
              const [x, z] = [N.x + Math.sin((k * Math.PI) / 6) * r, N.z + Math.cos((k * Math.PI) / 6) * r];
              if (!blocked?.(x, z, 0.25) && ground(x, z) && !crowd?.(x, z)) {
                Object.assign(N, { x, z });
                break ring;
              }
            }
          }
        }
        named.set(key, N);
        // (a spot of the data that the named place stands in, or whose step from the lane passes through it, is
        // nobody's from now on)
        for (const s of all) if (Math.hypot(s.x - N.x, s.z - N.z) < CLEAR || (s.entry && offStep(s, N) < STEP)) s.by = key;
      }
      S = named.get(key);
      const N0 = S;
      // (the named place itself too: a counter one of the city's own people stands at is kept from beside them)
      if (S.by || crowded(S)) S = near(pool.filter(open), S.x, S.z)[0] ?? null;
      // (taken, and the place's nearest free spot is not near it: free ground round it, a head from everybody. Two
      // people at the bus stop fifty metres from the trailer park's own spots: the second was stood in the park)
      if (S !== N0 && (!S || Math.hypot(S.x - N0.x, S.z - N0.z) > 4)) S = spare(block, spot, [N0.x, N0.z], id) ?? S;
    } else if (beside) {
      // someone they have business with stands on this block: the free spot nearest that person, the block's own first
      // (`clear`: [x, z, r], a ring that is being kept clear, a scene's room: no spot inside it)
      const free = pool.filter(s => open(s) && !(fresh && s === had) && !(clear && Math.hypot(s.x - clear[0], s.z - clear[1]) < clear[2]));
      const own = free.filter(s => s.block === block);
      S = near(own.length ? own : free, beside[0], beside[1])[0] ?? null;
      // (THAT PERSON STANDS WHERE THE PLACE HAS NO SPOTS: the trailer park's bus stop, fifty metres from the park's own,
      // has only its three places to wait. The nearest free spot was thirty-nine metres short of it, and the walk-up
      // to the one they came to rob, made inside the scene's patience, ran out of it: eight seconds of the hour. Free
      // ground beside them instead, a head from everybody)
      if (!fresh && !clear && (!S || Math.hypot(S.x - beside[0], S.z - beside[1]) > 4)) S = spare(block, spot, beside, id) ?? S;
    } else {
      // (`apart`: somebody who keeps a place as people do a street, the run's locals: the nearest spot of the block's
      // own that is that far from everybody's place and from the place's own point, which is the player's to have.
      // Without it they stood in a knot round the player's spot)
      const spread = apart ? pool.find(s => open(s) && s.block === block && Math.hypot(s.x - at[0], s.z - at[1]) >= apart && [...holds.entries()].every(([who, h]) => who === id || Math.hypot(h.x - s.x, h.z - s.z) >= apart)) : null;
      // (`roomy`: the player's own place, that far clear of anything low: a chair at their feet reads as standing in it)
      const room = roomy ? pool.find(s => open(s) && s.block === block && !blocked?.(s.x, s.z, roomy)) : null;
      S = spread ?? room ?? (seat ? pool.find(s => open(s) && s.block === block && (s.lean || s.sit || s.kind === 'bench')) : null) ?? pool.find(open) ?? null;
    }
    if (S && clash(S)) {
      const S0 = S;
      S = near(pool.filter(free), S.x, S.z)[0] ?? null;
      if (!S || Math.hypot(S.x - S0.x, S.z - S0.z) > 4) S = spare(block, spot, [S0.x, S0.z], id) ?? S;
    }
    if (!S) {
      // no data, or every spot on the set is taken: free ground round the map's own point (spare), and only when
      // there is none of that, the point itself in a row, not checked against anything
      if (!warned) console.warn(`[stage] no standing spot left at ${block}/${spot}: people stand round the map's own point`);
      warned = true;
      const n = [...holds.values()].filter(s => s.spare === `${block}/${spot}`).length;
      S = spare(block, spot, at, id) ?? { x: at[0] + Math.ceil(n / 2) * (n % 2 ? 1 : -1) * ROW, z: at[1], ry: null, entry: null, spare: `${block}/${spot}`, by: null };
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
    /**
     * A PLACE OF THE DIRECTOR'S OWN MAKING is somebody's place too (open ground for an attack, a mark in a queue):
     * it is told here, so that nobody is given a spot in it. Open ground is one of the place's own spots by its
     * coordinates and was nobody's by the book: the robber who came for a10 at Precinct 9 was given the very spot
     * a10 had been stood on for it, and the two were pushed apart for 39 frames. Let go like any other (release).
     */
    hold(id, S) {
      release(id);
      S.by = id;
      holds.set(id, S);
      return S;
    },
    /** Is one of the city's own people at this spot now (it is then nobody's from here on)? */
    crowded: s => !!s && crowded(s),
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
