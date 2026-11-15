// Where hotkey 2's map sits in the 3D city: THE REAL PLACES of the original city (the owner, 2026-11-12: "i want to go
// back to my original city … the city is already built we just need to wire our game into it").
//
// NOTHING HERE IS A TYPED COORDINATE. Every point comes from places.json, THE PLACE TABLE, which
// demo/tools/place-table.mjs makes from the city's own data: its place list, the boxes of the pieces its builds stamp,
// its stand-spot rules, its walk and road graphs, its subway stations, its trailer pads. This file only gives the
// table the shape the stage reads, and says which places load together.
//
//   projects   Sunny Acres trailer park (ten trailers are the ten pads)      market    the Jay St night market
//   uptown     Glasswall Plaza                                               corner    Jay St & Washington St
//   bar        DEAD AIR, on Fit Street's block                               park      Pleasantview Park
//   docks      Low Tide Docks                                                precinct  Precinct 9
//   jail       Iron Island (held)                                            clinic    St. Mercy (held)
//
// World frame: metres, +x east, +z south. One city block is 36 m.
//
// (the last night's 3×3 set round Fit Street: git history before the `big-city` branch, and citymap-plaza.js)
import DATA from './places.json' with { type: 'json' };

export const TABLE = DATA;
/** One city block, in metres (the city's own pitch: plan.js P). */
export const PITCH = 36;

const shape = T => ({
  place: `${T.name}: ${T.place}`, name: T.name, cityPlace: T.cityPlace, at: T.at, spots: T.spots, look: T.look ?? null, reach: T.reach,
  ways: T.ways, blocks: T.blocks, fixtures: T.fixtures, missing: T.missing,
  // (the place's own ways where the city's walkers' lanes do not go, Sunny Acres' lanes, and its homes' pads: who
  // walks from one home to another goes along the lane, director.js laneWay)
  paths: T.near?.paths ?? null, homes: T.near?.homes ?? [],
});

/**
 * Each game block: its spots as [x, z] (`street` is what its people gather round), `look` (a camera [[from], [at]]
 * that faces its front: the stage reads the direction alone), `ways` (the nearest sidewalk point, kerb point and
 * subway stairs: for whoever leaves or arrives), and `blocks`, the city blocks it stands on.
 */
export const BLOCKS = Object.fromEntries(Object.entries(DATA.places).map(([id, T]) => [id, shape(T)]));

/**
 * The two held places. They are OPEN AIR now: Iron Island's exercise yard and St. Mercy's forecourt. `at` is where
 * its people are; `pose` is the clip a held person keeps, by the kind of spot they are given (a real bench seat, or
 * open ground). Nobody walks there: whoever is taken there leaves the place they were in and arrives (travel.js).
 */
const POSE = { jail: { bench: 'sit_bench', open: 'cuffed_idle' }, clinic: { bench: 'sit_bench', open: 'winded_rest' } };
/** What a held place puts its people in while it has them: an outfit of the city's own cast (cast.js OUTFITS). The jail's is the county orange its yard's inmates wear. */
const WEAR = { jail: 'county' };
export const HELD = Object.fromEntries(Object.entries(DATA.held).map(([id, T]) => [id, { ...shape(T), exit: T.at, pose: POSE[id] ?? { bench: 'sit_bench', open: null }, wear: WEAR[id] ?? null }]));

/** The pads: one trailer of Sunny Acres per seat (agent ids a1 … a10). `home` is the city's own id for the lot. */
export const PADS = DATA.pads;

/** Where people stand (stands.js reads this): per block and per held place, the city's own kind of standing spot. */
export const STANDS = {
  blocks: Object.fromEntries(Object.entries(DATA.places).map(([id, T]) => [id, T.stands])),
  held: Object.fromEntries(Object.entries(DATA.held).map(([id, T]) => [id, T.stands])),
};

/**
 * What each trip of the game's map would cost by the city's own planner, as 'from>to' → { straight, walk, scooter,
 * subway, taxi: { seconds, metres } } (real seconds). For whoever picks how a trip is shown: travel.js `choose`.
 */
export const TRIPS = DATA.trips ?? {};

/** The game's links (src/map.mjs), for measuring the trips. */
export const LINKS = [
  ['projects', 'market'], ['projects', 'corner'], ['market', 'uptown'], ['market', 'bar'], ['uptown', 'park'],
  ['corner', 'bar'], ['corner', 'docks'], ['bar', 'park'], ['bar', 'precinct'], ['docks', 'precinct'],
];

// ── loading by place ──────────────────────────────────────────────────────────────────────────────────────────────
/** Every place by id, walkable or held. */
export const PLACES = { ...BLOCKS, ...HELD };
/** Places whose gathering points are this near load together (m): a short walk apart. */
export const TOGETHER = 45;
/** How many city blocks round a place's own are built with it. Beyond that is haze. */
export const RING = 2;

/**
 * THE ZONES: what is loaded together. A zone is the places that are a short walk from one another (TOGETHER, chained),
 * named by its first place in the table's order. Only the zone the followed person is in is built.
 */
const zoneOfPlace = {};
{
  const ids = Object.keys(PLACES);
  const near = (a, b) => Math.hypot(PLACES[a].at[0] - PLACES[b].at[0], PLACES[a].at[1] - PLACES[b].at[1]) <= TOGETHER;
  for (const id of ids) {
    if (zoneOfPlace[id]) continue;
    const members = [id];
    for (let k = 0; k < members.length; k++) for (const other of ids) if (!members.includes(other) && !zoneOfPlace[other] && near(members[k], other)) members.push(other);
    for (const m of members) zoneOfPlace[m] = id;
  }
}
export const ZONES = {};
for (const [place, zone] of Object.entries(zoneOfPlace)) (ZONES[zone] ??= { id: zone, places: [] }).places.push(place);
for (const Z of Object.values(ZONES)) {
  const pts = Z.places.map(id => PLACES[id].at);
  Z.at = [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length];
  Z.core = [...new Set(Z.places.flatMap(id => PLACES[id].blocks.map(b => b.join(','))))].map(k => k.split(',').map(Number));
}
/** The zone a place loads with. */
export const zoneOf = place => zoneOfPlace[place] ?? null;
/** The city blocks a zone builds: its places' own and `ring` blocks round each, as [[i, j], …]. */
export function zoneBlocks(zone, ring = RING) {
  const out = new Set();
  for (const [bi, bj] of ZONES[zone]?.core ?? []) for (let i = bi - ring; i <= bi + ring; i++) for (let j = bj - ring; j <= bj + ring; j++) out.add(`${i},${j}`);
  return [...out].map(k => k.split(',').map(Number));
}

/** Where a season starts: everyone is home. */
export const START = 'projects';

/** A raised view of a zone's middle, for the load-in and the tools (the stage's own camera makes each place's shot). */
export function viewOf(zone) {
  const [x, z] = ZONES[zone].at;
  return { pos: [x + 26, 46, z + 30], tgt: [x, 0, z], fov: 42 };
}
export const VIEWS = { set: viewOf(zoneOf(START)) };

/**
 * WATER NOBODY STANDS IN OR WALKS THROUGH: [x0, z0, x1, z1, what]. The city's collision world keeps a body out of
 * what is at its waist; a fountain's basin, a pond and a paddling pool are below it (a step of 0.1 to 0.4 m that
 * the city's surfaces call walkable), so a robber was stood in Glasswall Plaza's fountain for a hold-up (the
 * owner's first whole season, day 2, 18:00). The city publishes none of them as a place or a piece (the plaza and
 * the park are one `placeholder·structure` each in its audit list, and its water field is the sea's), so THESE
 * THREE BOXES ARE MEASURED, 2026-11-12, and must be measured again if the pinned city moves them:
 *   · the fountain: the collision world's heights across it (paving 0.3, rim 0.8 at x 16.0 and 22.0 and at
 *     z -22.0 and -16.0, water 0.6 between). The box is the rim's own outer edge: with 0.2 m more, somebody on the
 *     paving at its corner was "in the fountain" to the audit;
 *   · the duck pond: the patch of the same shape the collision world has south-east of the bandstand (water inside
 *     a rim, x -16 to -10, z 202.5 to 208), half a metre added;
 *   · the paddling pool: its own box in the city's audit build (`-1_6·H0·kiddie-pool·0`).
 */
export const WET = [
  [16.0, -22.0, 22.0, -16.0, 'the plaza\'s fountain'],
  [-16.5, 202.0, -9.5, 208.5, 'the park\'s pond'],
  [-29.3, 231.0, -27.3, 233.0, 'a paddling pool'],
];

