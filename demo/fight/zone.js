// THE FIGHT'S ZONE: what the city builds for a fight's site (the stage's loading by place, demo/stage/loader.js, builds
// only the zone the followed person is in). A site at one of the game's own places loads that place's zone; a site
// elsewhere (the dead mall) gets a zone of its own, registered here: the city blocks under its arena, with the
// loader's ring of blocks round them (its ways in reach that far). demo/boot.js asks for it on ?mode=fight.
import { ARENA } from '../../src/fight/data.mjs';
import { siteOf } from './sites.js';
import { arenaOn } from './place.js';

/** The zone a fight's site loads: its id in `map.ZONES` (citymap.js), registered there for a site of its own. */
export function fightZone(map, siteId) {
  const S = siteOf(siteId);
  if (S.zone) return map.ZONES[S.zone] ? S.zone : map.zoneOf(S.zone);
  const id = `fight:${S.id}`;
  if (!map.ZONES[id]) {
    const A = arenaOn(S, ARENA);
    // (one city block is map.PITCH m; block i spans [i × PITCH, (i + 1) × PITCH))
    const core = new Set(A.corners.map(([x, z]) => `${Math.floor(x / map.PITCH)},${Math.floor(z / map.PITCH)}`));
    map.ZONES[id] = { id, places: [], at: [...S.center], core: [...core].map(k => k.split(',').map(Number)) };
  }
  return id;
}
