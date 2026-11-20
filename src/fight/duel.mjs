// A ONE-ON-ONE, HEADLESS: the run's fights (src/run/: a debt that turns ugly, a lift that is caught, the regular at
// your door who swings). The fight's own simulation (sim.mjs createFight with `duel`), both sides moving by the brawl
// (brawl.mjs); the run says who brings what (src/run/rules.mjs duelOf). The page plays the very same fight on its stage
// (demo/run/duel.js): the same inputs and the same seed are the same fight, tick for tick.
//
//   duelArena({ w, h, gap })        the ground: w by h metres, the two of them gap metres apart across its middle
//   runDuel(inputs, seed)           to the end → F (F.over.result 'won' | 'lost')
//   duelOdds(inputs, n)             the share you win of n fights at these inputs, seeds of their own (cached): what
//                                   the run's cards say before you choose
//
// inputs: { you: { weapon, hp, max, hits }, foe: { id, name, weapon, hp, speed, hits, reel, heft, soak, slip }, cap, hit,
//          brawl, arena: { w, h, gap } }
// (styles-1: `foes` [foe, ...] instead of `foe`, and `arena.around`, for several at once: getting jumped in the run)
// (sixes-1: `ally` { hp, weapon, way, hits }, Cousin Earl beside you, at `arena.ally` [metres, degrees]; `firstHurt`,
// the health the first of them has lost breaking a barred door: the crew at your door)
// (bench-1: a bottle thrown first, in a fight of several only: `blind` seconds, every one of them (the pepper fogger's
// field); `asleep` { n, s, at }, the first n of them asleep s seconds from `at`; `slow` { s, by, at }, every one of them at
// `by` of their speed for s seconds from `at`. src/run/make.mjs bottleFight says which)
// (fight-3: never a gun on either side, the sim refuses one; a foe's `reel`, `heft`, `soak` and `slip` are a style's,
// data.mjs RIVALS and rivalFoe(): left out, they fight as the run's opponents always have. A punch style of yours is
// just your `weapon`: 'jab', 'haymaker' or 'throw', at bare hands' `hits`)
import { createFight, step } from './sim.mjs';
import { brawl } from './policies.mjs';

/**
 * The ground of a one-on-one, as the rules' arena: nobody comes in and there is no way out. (styles-1) `around`: the
 * places of several of them, each [metres, degrees] from you at the middle (0° the way the first one stands; getting
 * jumped: one in front, one at your side).
 */
export function duelArena({ w = 8, h = 6, gap = 1.8, around = null, ally = null } = {}) {
  if (around) {
    const [cx, cy] = [w / 2, h / 2];
    const foeStarts = around.map(([r, deg]) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)]);
    // (sixes-1: `ally`, [metres, degrees] from you: where Earl stands at your side when he is in the fight)
    const allyStart = ally ? [cx + ally[0] * Math.cos((ally[1] * Math.PI) / 180), cy + ally[0] * Math.sin((ally[1] * Math.PI) / 180)] : undefined;
    return Object.freeze({ w, h, exit: [-99, -99], exitR: 0.01, start: [cx, cy], foeStart: foeStarts[0], foeStarts, entries: [], posts: [], ...(allyStart ? { allyStart } : {}) });
  }
  return Object.freeze({
    w, h, exit: [-99, -99], exitR: 0.01,
    start: [w / 2 - gap / 2, h / 2], foeStart: [w / 2 + gap / 2, h / 2],
    entries: [], posts: [],
  });
}

/** A one-on-one, set up and not yet stepped (the page steps it itself, a tick at a time). */
export function startDuel(inputs, seed) {
  // (bench-1: a bottle thrown first in a fight of several: `blind` (the raid's field), `asleep`, `slow`; left out, nothing changes)
  const bottle = { ...(inputs.blind ? { blind: inputs.blind } : {}), ...(inputs.asleep ? { asleep: inputs.asleep } : {}), ...(inputs.slow ? { slow: inputs.slow } : {}) };
  return createFight({ duel: { you: inputs.you, foe: inputs.foe, ...(inputs.foes ? { foes: inputs.foes } : {}), ...(inputs.ally ? { ally: inputs.ally } : {}), ...(inputs.firstHurt ? { firstHurt: inputs.firstHurt } : {}), ...bottle, cap: inputs.cap, hit: inputs.hit, brawl: inputs.brawl }, seed, arena: duelArena(inputs.arena) });
}

/** How many one-on-ones this process has run to their end (for measuring what the run's fights cost). */
export const DUEL_RUNS = { n: 0 };

/** A one-on-one to its end, headless. The page's ticks are these ticks: step(F, brawl(F)). */
export function runDuel(inputs, seed) {
  DUEL_RUNS.n += 1;
  const F = startDuel(inputs, seed);
  while (!F.over) step(F, brawl(F));
  return F;
}

const ODDS = new Map();
/**
 * The share of `n` one-on-ones at these inputs that you win, each with a seed of its own (1 to n: never the seed the
 * run will fight with), cached by the inputs: { won, n, pct, in10 }.
 */
export function duelOdds(inputs, n = 200) {
  const key = `${n}|${JSON.stringify(inputs)}`;
  const kept = ODDS.get(key);
  if (kept) return kept;
  let won = 0;
  for (let s = 1; s <= n; s++) if (runDuel(inputs, 0x5eed0000 + s).over.result === 'won') won += 1;
  const out = Object.freeze({ won, n, pct: Math.round((won / n) * 100), in10: Math.round((won / n) * 10) });
  if (ODDS.size > 500) ODDS.clear();
  ODDS.set(key, out);
  return out;
}
