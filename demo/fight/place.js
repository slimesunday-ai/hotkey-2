// THE ARENA ON THE CITY: the fight's own frame (src/fight/data.mjs ARENA: x 0 … w across the picture, y 0 … h down it,
// toward the camera) laid at a site (sites.js). The camera's bearing from the player sets the axes: from the east
// (bearing 90, the Lock's), the arena's x runs north (−z) and its y east (+x), so the picture shows x to the right and y
// downwards, wherever the site is.
//
// fight-1 laid it off the ELM ST stairs (its exit point 1.3 m in front of the top nosing); that is the same arena as
// ELM ST's site centre here, to the centimetre (test/fight-ways.test.mjs).
import { ARENA } from '../../src/fight/data.mjs';
import { SITES, siteOf, DEFAULT_SITE } from './sites.js';

export { SITES, siteOf, DEFAULT_SITE };

/**
 * The arena at a site: { world(x, y) → [wx, wz], local(wx, wz) → [x, y], X, Y (the arena's axes as world unit vectors),
 * corners, box: [x0, z0, x1, z1] (its world bounds) }. `center` may be given for a site whose middle is read off the
 * city at the page (a station's stairs).
 */
export function arenaOn(site, arena = ARENA, center = site.center) {
  const b = ((site.bearing ?? 90) * Math.PI) / 180;
  // (y: toward the camera, down the picture; x: the picture's right, seen from the camera)
  const Y = [Math.round(Math.sin(b) * 1e9) / 1e9, Math.round(Math.cos(b) * 1e9) / 1e9];
  const X = [Y[1], -Y[0]];
  const [cx, cz] = center;
  const [hx, hy] = [arena.w / 2, arena.h / 2];
  const world = (x, y) => [cx + (x - hx) * X[0] + (y - hy) * Y[0], cz + (x - hx) * X[1] + (y - hy) * Y[1]];
  const local = (wx, wz) => {
    const [rx, rz] = [wx - cx, wz - cz];
    return [hx + rx * X[0] + rz * X[1], hy + rx * Y[0] + rz * Y[1]];
  };
  const corners = [world(0, 0), world(arena.w, 0), world(arena.w, arena.h), world(0, arena.h)];
  const box = [Math.min(...corners.map(c => c[0])), Math.min(...corners.map(c => c[1])), Math.max(...corners.map(c => c[0])), Math.max(...corners.map(c => c[1]))];
  return { world, local, X, Y, corners, box };
}

/** A site's stairs laid the fight-1 way: the arena's middle from the flight's top nosing and its way down. */
export function centerFromStairs(top, dir, arena = ARENA) {
  // (the exit point 1.3 m in front of the top nosing, where the city's walk up the flight ends: rides/subway.js FLIGHT.out)
  const E = [top[0] - dir[0] * 1.3, top[1] - dir[1] * 1.3];
  const [ex, ey] = arena.exit;
  const [X, Y] = [[-dir[1], dir[0]], [-dir[0], -dir[1]]];
  return [E[0] + (arena.w / 2 - ex) * X[0] + (arena.h / 2 - ey) * Y[0], E[1] + (arena.w / 2 - ex) * X[1] + (arena.h / 2 - ey) * Y[1]];
}

/** The rules' arena at a site: the same arena, with what stands in it there (the city's own and the cover put there). */
export const arenaAt = (site, arena = ARENA) => Object.freeze({ ...arena, posts: [...(site.posts ?? []), ...(site.cover ?? []).filter(c => c.post).map(c => c.post)] });

/** The default site's name, for the page's words. */
export const PLACE = Object.freeze({ name: siteOf(DEFAULT_SITE).name });
