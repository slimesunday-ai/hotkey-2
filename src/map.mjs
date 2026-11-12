// The city as data (SPEC section 3). The map is a graph of blocks, never code: the engine looks places up by what
// they hold (pads, a fence, buyers, the docks), so it runs on any connected map and the city can grow.
//
// Every block names the real place in the 3D city where it plays (`cityPlace`, an id from the city's place list) and
// its spots: the places on the block a scene can happen at. Those are for the renderer; no rule reads `cityPlace`.

/** The round 1 city: one district, a 3 by 3 grid. Jail and clinic are off the street: nobody walks into them. */
export const CITY = Object.freeze({
  id: 'city-1',
  blocks: {
    projects: { name: 'the projects', district: 'downtown', cityPlace: 'trailer', links: ['market', 'corner'],
      pads: true, spots: ['street', 'pad', 'door'] },
    market: { name: 'the market', district: 'downtown', cityPlace: 'mall', links: ['projects', 'uptown', 'bar'],
      fence: true, gunshop: true, shopkeeper: true, spots: ['street', 'counter:fence', 'counter:gunshop', 'counter:shop'] },
    uptown: { name: 'uptown', district: 'downtown', cityPlace: 'plaza', links: ['market', 'park'],
      buyers: { price: 'uptown', from: 0 }, shopkeeper: true, policeBias: true, spots: ['street', 'counter:shop'] },
    corner: { name: 'the corner', district: 'downtown', cityPlace: 'corner--1_1', links: ['projects', 'bar', 'docks'],
      buyers: { price: 'corner', from: 0 }, rivalTurf: true, spots: ['street'] },
    bar: { name: 'the bar', district: 'downtown', cityPlace: 'strip.no-witness', links: ['market', 'corner', 'park', 'precinct'],
      buyers: { price: 'bar', from: 0 }, gunBuyers: true, shopkeeper: true, rivalTurf: true, spots: ['street', 'counter:shop'] },
    park: { name: 'the park', district: 'downtown', cityPlace: 'park', links: ['uptown', 'bar'],
      buyers: { price: 'park', from: 6 }, gunBuyers: true, noPoliceFrom: 8, robberHome: true, spots: ['street'] },
    docks: { name: 'the docks', district: 'downtown', cityPlace: 'docks', links: ['corner', 'precinct'],
      supplier: true, rivalTurf: true, rivalHome: true, spots: ['street', 'pier'] },
    precinct: { name: 'the precinct', district: 'downtown', cityPlace: 'police', links: ['bar', 'docks'],
      police: true, spots: ['street', 'desk'] },
  },
  // Places people are held. `exit` is the block they walk out onto.
  held: {
    jail: { name: 'the jail', cityPlace: 'jail', exit: 'precinct', spots: ['cell'] },
    clinic: { name: 'the clinic', cityPlace: 'hospital', exit: 'bar', spots: ['bed'] },
  },
});

/** Ids of the walkable blocks, in the map's own order. */
export function blockIds(map) {
  return Object.keys(map.blocks);
}

export function neighbors(map, id) {
  const block = map.blocks[id];
  if (!block) throw new Error(`no such block: ${id}`);
  return block.links;
}

/** Every block that has the feature, in map order (for example `blocksWith(map, 'buyers')`). */
export function blocksWith(map, feature) {
  return blockIds(map).filter(id => map.blocks[id][feature]);
}

/** The one block with a feature the rules need exactly one of (pads, fence, supplier, police). */
export function theBlock(map, feature) {
  const found = blocksWith(map, feature);
  if (found.length !== 1) throw new Error(`the map needs exactly one block with ${feature}, found ${found.length}`);
  return found[0];
}

const distanceCache = new WeakMap();

/** Moves between two blocks (one hour each), by breadth-first search. Infinity when there's no way. */
export function distance(map, from, to) {
  let table = distanceCache.get(map);
  if (!table) distanceCache.set(map, (table = new Map()));
  if (!table.has(from)) {
    const seen = new Map([[from, 0]]);
    const queue = [from];
    while (queue.length) {
      const at = queue.shift();
      for (const next of neighbors(map, at)) {
        if (!seen.has(next)) {
          seen.set(next, seen.get(at) + 1);
          queue.push(next);
        }
      }
    }
    table.set(from, seen);
  }
  return table.get(from).get(to) ?? Infinity;
}

/** The neighbour of `from` that is one move closer to `to`. Ties go to the map's link order, so it's deterministic. */
export function stepToward(map, from, to) {
  if (from === to) return from;
  const here = distance(map, from, to);
  for (const next of neighbors(map, from)) {
    if (distance(map, next, to) === here - 1) return next;
  }
  throw new Error(`no way from ${from} to ${to}`);
}

/** Throws unless the map is usable: links both ways, everything connected, and one of each place the rules need. */
export function validateMap(map) {
  const ids = blockIds(map);
  for (const id of ids) {
    for (const link of map.blocks[id].links) {
      if (!map.blocks[link]) throw new Error(`${id} links to ${link}, which isn't a block`);
      if (!map.blocks[link].links.includes(id)) throw new Error(`${id} links to ${link} but not back`);
    }
    if (!map.blocks[id].cityPlace) throw new Error(`${id} names no place in the 3D city`);
    if (!map.blocks[id].spots?.includes('street')) throw new Error(`${id} has no street spot`);
  }
  for (const id of ids) {
    if (distance(map, ids[0], id) === Infinity) throw new Error(`${id} can't be reached from ${ids[0]}`);
  }
  for (const feature of ['pads', 'fence', 'gunshop', 'supplier', 'police']) theBlock(map, feature);
  if (!blocksWith(map, 'buyers').length) throw new Error('the map has no street buyers');
  if (!blocksWith(map, 'gunBuyers').length) throw new Error('the map has no street gun buyers');
  for (const place of ['jail', 'clinic']) {
    const held = map.held?.[place];
    if (!held || !map.blocks[held.exit]) throw new Error(`the ${place} needs an exit block`);
    if (!held.cityPlace) throw new Error(`the ${place} names no place in the 3D city`);
  }
  return map;
}
