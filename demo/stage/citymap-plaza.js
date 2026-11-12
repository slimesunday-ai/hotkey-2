// THE FIRST PROPOSAL, kept for the record: "the plaza ring" (2026-11-11). It was set aside the same day: the owner asked
// for Fit Street, 145 m west of here. The map in use is demo/stage/citymap.js; the old pictures are in city/shots/plaza/.
//
// Where hotkey 2's map sat in the 3D city: the first proposal as data.
// World frame: metres, +x east, +z south (north is −z). One city block is 36 m; streets run on the multiples of 36.
// Sidewalk height is 0.2. Every `street` point here stands on a sidewalk or on the plaza's paving. A sidewalk runs
// from about 2.5 to 6.5 m off its street's centre line; shop doors are at about 6.6.
//
// The set is THE PLAZA RING: Glasswall Plaza in the middle and the fronts that face it. Precinct 9 on its east side,
// Glasswall Savings on its west, the Central Ave shopfronts on its south, Kent St & 1st St at its north-east corner.
// Nothing here is read by the rules: it is for the renderer, and an art call for slime.

export const STREETS = { 'Main St': { x: 0 }, 'Kent St': { x: 36 }, '1st St': { z: -36 }, 'Central Ave': { z: 0 } };

/** Each game block: the place, its spots as [x, z], and a street-level camera [[from], [at]] for looking at it. */
export const BLOCKS = {
  projects: {
    place: 'the tower on the north-west corner of Main St & 1st St (needs rooms: its flats are not in the city\'s register)',
    spots: { street: [-4.6, -40.8], door: [-6.6, -43.0], pad: [-9.5, -43.0] },
    look: [[10, 8, -26], [-8, 5, -44]],
  },
  market: {
    place: 'the shopfronts on Central Ave by Main St: SOLES, HUSH, and COLD across Main St (needs signs for the fence and the gun shop)',
    spots: { street: [11.0, 4.6], 'counter:fence': [19.0, 6.6], 'counter:gunshop': [8.0, 6.6], 'counter:shop': [-9.0, 6.6] },
    look: [[13, 7, -12], [12, 2.5, 6]],
  },
  uptown: {
    place: 'Glasswall Savings, the portico on Main St',
    spots: { street: [-4.6, -18.0], 'counter:shop': [-6.6, -18.0] },
    look: [[14, 7, -10], [-10, 5, -19]],
  },
  corner: {
    place: 'Kent St & 1st St, the plaza\'s north-east corner (the city\'s own dealing corner, corner-1_-1)',
    spots: { street: [32.8, -32.8] },
    look: [[22, 6, -22], [34, 1.5, -34]],
  },
  bar: {
    place: 'the corner shop on the south-west corner of Kent St & Central Ave (LOOPHOLE LAW today: needs our own bar sign)',
    spots: { street: [31.0, 4.6], 'counter:shop': [29.0, 6.6] },
    look: [[36, 7, -12], [28, 2.5, 6]],
  },
  park: {
    place: 'Glasswall Plaza, by the fountain',
    spots: { street: [18.0, -10.5] },
    look: [[18, 10, 4], [18, 1, -20]],
  },
  docks: {
    place: 'FRONT CORP, on the north-east corner of Kent St & 1st St (needs dressing: a truck or crates at its shutter)',
    spots: { street: [40.4, -40.6], pier: [45.0, -41.6] },
    look: [[28, 7, -28], [44, 3, -42]],
  },
  precinct: {
    place: 'Precinct 9, the steps on Kent St',
    spots: { street: [39.8, -14.0], desk: [42.4, -18.0] },
    look: [[22, 6, -6], [48, 5, -18]],
  },
};

/** The two held places: rooms you see into, never walked to. `exit` is where a freed agent appears. */
export const HELD = {
  jail: { place: 'a cell inside Precinct 9 (to be built: the precinct is a solid block today)', at: [54, -18], exit: [42.4, -18.0], look: [[30, 9, -30], [54, 6, -18]] },
  clinic: { place: 'CURE, the pharmacy on Central Ave at Linden St, as the ER front; St. Mercy (181, −37) for the establishing shot', at: [69.0, 6.6], exit: [67.0, 4.6], look: [[60, 5, -7], [66, 2.5, 6]] },
};

/** The game's links (src/map.mjs), for measuring the walks. */
export const LINKS = [
  ['projects', 'market'], ['projects', 'corner'], ['market', 'uptown'], ['market', 'bar'], ['uptown', 'park'],
  ['corner', 'bar'], ['corner', 'docks'], ['bar', 'park'], ['bar', 'precinct'], ['docks', 'precinct'],
];

/** One camera that holds the whole set (from the north, over the Hall of Justice), and one from straight above. */
export const VIEWS = {
  set: { pos: [16, 66, -92], tgt: [17, 0, -16], fov: 44 },
  overhead: { pos: [17, 112, -17.9], tgt: [17, 0, -18], fov: 46, fog: [500, 900] },
};
