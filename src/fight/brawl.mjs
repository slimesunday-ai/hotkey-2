// THE BRAWL: how two people move in a one-on-one on the street (the run's fights, src/fight/duel.mjs). Both sides use
// it, the same way: nobody steers. Whoever has the next blow ready steps in to throw it; whoever has just thrown one, or
// is waiting on it, gives ground to just outside the other's reach and circles. So they come together, trade, part and
// circle again, and the blows that land are the ones thrown at somebody who did not get out of the way in time: what
// decides it is health, the weapon and how hard each one is (the sim's own numbers), not who backs off best.
//
//   brawlMove(F, p, q, B)   p's move this tick, [mx, my] (arena frame, length up to 1), against q; B the duel's numbers
//
// Pure: a function of the fight's own state. The way each circles (left or right) changes every few seconds by a hash
// of the fight's seed, the person and the time, never by a roll of the fight's stream, so a copy of a fight stepped
// ahead (the page's look ahead for blows, demo/fight/anim.js) moves exactly as the fight will.
import { BODY, WEAPONS } from './data.mjs';
import { hash32 } from '../rng.mjs';

/** The brawl's own numbers (the run's config gives them: src/run/config.mjs `duel.brawl`). */
export const BRAWL = Object.freeze({
  ready: 0.16, // s: a blow this close to ready, they step in to throw it
  guard: 0.45, // m: how far outside the other's reach they stand off while waiting
  back: 0.85, // how hard they give ground (of their speed)
  circle: 0.55, // how hard they circle while standing off
  turn: 1.6, // s: how long they circle one way before the hash may turn them
  centre: 1.6, // m: further than this from the middle of the ground, they work back toward it
});

// (raid-1: a gun has no reach; whoever stands off one holding a gun stands off a fist's reach: WEAPONS.hands)
const reachOf = p => (WEAPONS[p.arm].reach ?? WEAPONS.hands.reach) + 2 * BODY;

export function brawlMove(F, p, q, B = BRAWL) {
  if (!q || q.down || p.down) return [0, 0];
  const [dx, dy] = [q.x - p.x, q.y - p.y];
  const d = Math.hypot(dx, dy) || 1e-6;
  const [ux, uy] = [dx / d, dy / d];
  let mx = 0;
  let my = 0;
  if (p.cd <= B.ready) {
    // IN: up to their reach, to throw it
    const gap = reachOf(p) - 0.12;
    if (d > gap) {
      const s = Math.min(1, (d - gap) / 0.3);
      mx = ux * s;
      my = uy * s;
    }
  } else {
    // OFF: just outside their reach, circling
    const want = reachOf(q) + B.guard;
    const r = Math.max(-1, Math.min(1, (d - want) / 0.4));
    const k = r < 0 ? B.back : 0.6;
    mx = ux * r * k;
    my = uy * r * k;
    const way = hash32(`${F.seed}|${p.id}|${Math.floor(F.t / B.turn)}`) & 1 ? 1 : -1;
    mx += -uy * way * B.circle;
    my += ux * way * B.circle;
  }
  // (kept to the middle of the ground they have: the street round them is the city's)
  const [cx, cy] = [F.arena.w / 2, F.arena.h / 2];
  const off = Math.hypot(p.x - cx, p.y - cy);
  if (off > B.centre) {
    const s = Math.min(0.8, (off - B.centre) / 1.5);
    mx += ((cx - p.x) / off) * s;
    my += ((cy - p.y) / off) * s;
  }
  const n = Math.hypot(mx, my);
  return n > 1 ? [mx / n, my / n] : [mx, my];
}
