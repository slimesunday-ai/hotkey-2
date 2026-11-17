// WHERE THE FIGHT IS, AS DATA: each site is the arena laid on the city, the camera, the ways in, what stands in the
// arena and the cover put there for the fight. The page reads the site named by ?site= (default: the dead mall); the
// rules (src/fight/) are the same everywhere, only the arena's `posts` (what stands in it, walked round) are the site's.
//
//   center, bearing   the arena (src/fight/data.mjs ARENA: 20 m across the picture, 12 m into it) laid with its middle
//                     there, the camera's bearing from the player (camera.js: 90, from the east; the Lock's own) setting
//                     its axes: x across the picture (left to right), y down it (toward the camera)
//   camera            the Lock's angle at this site (camera.js HIGH, DOWN, BEARING, LENS): the fight's existing camera
//   stairs            a station whose stairs bring you up at the start the first time (null: you are there)
//   exit              what you walk onto to leave (the arena's exit point), in words for the mark
//   posts             what stands in the arena, as boxes in its own frame [x0, y0, x1, y1] (the rules walk round them;
//                     they do not stop a shot: the rules never have): the city's own things measured off the city, and
//                     the cover below
//   cover             things of the city's own kit put on the lot for the fight (cover.js): { kit, v, at: [x, z] world,
//                     yaw (rad), post: [x0, y0, x1, y1] its box in the arena's frame }
//   ways              the ways in (ways.js): { entry, from, path }, world [x, z] from the far end to the last turn; the
//                     entry (ARENA.entries[entry]) is added on the page. Every far end is out of every picture the
//                     camera can show with the player anywhere in the arena (test/fight-ways.test.mjs)
//   quiet             metres round every picture the city's crowd is kept off (frame.js quietBox)
//
// Measured off the pinned city 2026-11-17 (the scout's run57 for the dead mall: scout-sites.json `mallback`, its
// pictures at eye level and from the game camera; then the fight page itself).

/**
 * THE DEAD MALL: the back lot of the Millennium Mall ruins, next door to Sunny Acres (the owner's pick, 2026-11-17).
 * The lot runs x −287 … −192, z 69 … 98: the mall's blank back wall along its north side (z ≈ 68.5), the service lane
 * behind the food court coming in from Elm St between that wall and the orange construction fence (z 68.5 … 71, the
 * fence's corner at x −216.5), the fenced dig east of the arena (x −216.5 … −192, the excavator, rubble), Jackson St
 * along the south (its north sidewalk z ≈ 102 … 104, the road 104 … 110). The scout's rectangle (z 68.5 … 88.5) put the
 * rules' two north entries inside the mall's wall, so the arena sits 2 m further south: its north entries are on the
 * service lane's own line, its north edge 2 m off the wall. The camera sees all of it (the scout: all four corners clear).
 */
const MALL = {
  id: 'mall',
  name: 'BEHIND THE DEAD MALL',
  short: 'the dead mall',
  // (the page's words for it: the where card and the run's try-out stop. The levels as said HERE: the rules' own names,
  // src/fight/data.mjs LEVELS, are ELM ST's ("Elm St after dark"); the rules and their odds are the same at every site)
  place: 'Behind the dead mall',
  levels: { easy: 'a quiet night', real: 'the lot after dark', hard: 'a bad night' },
  center: [-227.5, 80.5],
  bearing: 90,
  camera: { high: 24, down: 64, bearing: 90, lens: 42 },
  stairs: null,
  exit: { mark: 'WAY OUT', near: 'WAY OUT: walk on to leave', left: 'You backed off across the lot' },
  // (the city's own, measured off the page's solid cells: the two concrete stubs on the lot's middle line, the lamp
  // post's base at the west edge, the white box by the north-west corner; then the cover)
  posts: [
    [11.5, 5.9, 12.5, 11.6],
    [6.1, 0, 6.9, 0.6],
    [17.9, 0.5, 18.6, 1.5],
  ],
  // THE COVER, the city's own kit (city/from-trunk/…/districts/mall/props.js, vehicles/, props.js): a dead delivery
  // van nosed against the arena's north end where ELM ST's tree and bus shelter stood (the same box, so the round
  // plays as it did: test/fight-ways.test.mjs, the odds at both sites), a burnt-out car across two bays, a shopping
  // cart on its side; and, off the arena, a dumpster against the mall's back wall. `post`: its box in the arena's
  // frame (null: dressing outside it, nobody walks there)
  cover: [
    { kit: 'van', variant: 5, at: [-227.2, 72.3], yaw: Math.PI, post: [16, 5.4, 20.4, 7.2], says: 'a dead delivery van' },
    { kit: 'mall.burntCar', v: 1, at: [-224.2, 85.6], yaw: 0, post: [2.7, 8.3, 7.1, 10.3], says: 'a burnt-out car' },
    { kit: 'mall.cart', tipped: true, at: [-230.4, 87.9], yaw: 2.2, post: [2.1, 2.6, 3.1, 3.6], says: 'a shopping cart on its side' },
    { kit: 'dumpster', c: 0x3d6b4a, at: [-238.6, 69.7], yaw: 0, post: null, says: 'a dumpster against the wall' },
  ],

  // THE WAYS IN. Out of the picture: anything east of the camera (x > −211.5 for any place of the player), west of its
  // far edge (x < −249.5), well south of it (Jackson St's sidewalk east and west of the lot). Checked at eye level (the
  // city's columns read lattice fences as open and a sealed gap as a lane):
  //   · the service lane behind the food court (the scout's A): its east end is a lattice fence on Elm St, so they set
  //     off inside it, 2 m in; out of sight behind the food court's wall and the orange fence for 30 m; the rules' two
  //     north entries are on its line, along the mall's back wall, and the east ones round the fence's corner and down
  //     the strip between the fence and the arena
  //   · the lot's south edge is a lattice fence along Jackson St with one gap (x ≈ −237.5 … −229.5): the south ways
  //     come along Jackson's north sidewalk from either end and in through it
  //   · the far west end of the lot (the scout's B), clear of its trees, to the arena's south-west corner
  //   (not: the dig's west fence has a gap, but a jersey barrier fills it; the lattice on Elm St at the lane's mouth)
  ways: [
    { entry: 5, from: 'the service lane behind the food court', path: [[-192, 69.7], [-200, 69.8], [-212, 69.7], [-217, 69.7], [-221, 69.7]] },
    { entry: 6, from: 'the service lane behind the food court', path: [[-192, 69.6], [-200, 69.7], [-212, 69.6], [-217, 69.6], [-220.4, 69.7]] },
    { entry: 4, from: 'the service lane, round the fence\'s corner', path: [[-192, 69.8], [-200, 69.9], [-212, 69.8], [-217, 69.9], [-219.4, 72]] },
    { entry: 3, from: 'the service lane, round the fence\'s corner and down its side', path: [[-192, 69.9], [-200, 70], [-212, 69.9], [-217, 70], [-219.3, 72.4], [-219.3, 79]] },
    { entry: 2, from: 'the service lane, round the fence\'s corner and down its side', path: [[-192, 69.8], [-200, 69.9], [-212, 69.8], [-217, 69.9], [-219.2, 72.6], [-219.3, 85]] },
    { entry: 1, from: 'along Jackson St from the east, in through the gap in the fence', path: [[-196, 103.2], [-228.5, 103.2], [-232.6, 100.6], [-231.9, 96.4], [-226, 93.2]] },
    { entry: 1, from: 'along Jackson St from the west, in through the gap in the fence', path: [[-262, 103.1], [-235.5, 103.1], [-233, 100.6], [-232, 96.4], [-226.2, 93.1]] },
    { entry: 0, from: 'along Jackson St from the west, in through the gap in the fence', path: [[-262, 103.3], [-236, 103.3], [-233.4, 100.6], [-232, 96], [-230.4, 93.2]] },
    { entry: 0, from: 'the far west end of the lot', path: [[-262, 79.5], [-247, 79.5], [-240, 86.5], [-233, 92.2]] },
  ],
  quiet: 3,
};

/** ELM ST: the subway stop by Sunny Acres, where the fight began (fight-1). ?site=elm */
const ELM = {
  id: 'elm',
  name: 'ELM ST',
  short: 'ELM ST stop',
  place: 'The Elm St stop',
  levels: { easy: 'a quiet night', real: 'Elm St after dark', hard: 'a bad night' },
  // (the game's own zone of the projects: the stop is in it)
  zone: 'projects',
  center: [-183.85, -39.3],
  bearing: 90,
  camera: { high: 24, down: 64, bearing: 90, lens: 42 },
  // (the city's own flight, read at the page: rides/subway.js; the arena's exit is 1.3 m in front of its top nosing)
  stairs: { station: 'subway-elm', top: [-190.45, -41.3], dir: [-1, 0] },
  exit: { mark: 'STAIRS', near: 'STAIRS: walk on to leave', left: 'You went back down the stairs' },
  // (the street tree and the bus shelter beside it on the kerb, one box: the fight-1 arena's own)
  posts: [[16, 5.5, 20.2, 7]],
  cover: [],
  // Elm St runs north–south along the arena's east side (its roadway x −183 … −177.6, the far sidewalk to −174); the tall
  // blocks across it (x −173 … −150) stand east of where the camera ever stands, so anything over there is out of the
  // picture: the cross street between them (z −40 … −33) and the alley into the north block (z ≈ −57); the lane between
  // the house rows west of the arena (z ≈ −29.7); the avenue south of it all (z ≈ −12 … −6), the street north (z ≈ −77 … −72)
  ways: [
    { entry: 0, from: 'the lane between the houses, from the west', path: [[-213, -29.7], [-191.5, -29.7], [-188.6, -29.1]] },
    { entry: 0, from: 'up the strip from the avenue', path: [[-186.4, -5], [-186.6, -26.5]] },
    { entry: 1, from: 'up Elm St from the avenue', path: [[-184.4, -5], [-184.3, -24], [-182.2, -28]] },
    { entry: 1, from: 'the cross street, over Elm St', path: [[-151, -34.2], [-171, -34.2], [-175.5, -32.2], [-179.4, -29.4]] },
    { entry: 2, from: 'the cross street, over Elm St', path: [[-151, -35.2], [-171.5, -35.2], [-175.2, -33.4]] },
    { entry: 2, from: 'up the far sidewalk from the avenue', path: [[-175.4, -5], [-175.4, -27], [-175.9, -31]] },
    { entry: 3, from: 'the cross street, over Elm St', path: [[-151, -37], [-172, -37], [-175.4, -38]] },
    { entry: 3, from: 'out of the alley over Elm St, down the far sidewalk', path: [[-162, -58.2], [-174.4, -57.8], [-175.4, -42], [-175.6, -39.6]] },
    { entry: 4, from: 'the cross street, then up the far sidewalk', path: [[-151, -38.6], [-172.5, -38.6], [-175.2, -41], [-175.6, -43.4]] },
    { entry: 4, from: 'out of the alley over Elm St', path: [[-162, -57.6], [-174.6, -57.2], [-175.6, -47.5]] },
    { entry: 5, from: 'out of the alley over Elm St', path: [[-162, -57.8], [-175, -57.4], [-179.6, -53]] },
    { entry: 5, from: 'down Elm St from the north', path: [[-184.4, -80], [-184.3, -55], [-182.4, -51.4]] },
    { entry: 6, from: 'out of the alley over Elm St', path: [[-162, -56.8], [-174.6, -56.5], [-178, -52.4]] },
    { entry: 6, from: 'down the far sidewalk from the north', path: [[-175.4, -80], [-175.5, -55], [-177.6, -51.6]] },
  ],
  quiet: 3,
};

export const SITES = Object.freeze({ mall: MALL, elm: ELM });
export const DEFAULT_SITE = 'mall';
/** The site a page asks for (?site=), else the default. */
export const siteOf = id => SITES[id] ?? SITES[DEFAULT_SITE];
