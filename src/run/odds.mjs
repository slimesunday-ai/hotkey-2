// THE SAMPLED ODDS, IN ONE PLACE (smooth-1, docs/perf/2026-11-18-audit.md fix 1). Every figure the run prints from a
// sample of fights (getting jumped's bands and each arm's, a card's "you win about 6 in 10", the door fight's, the
// advice after a loss, the Ahead screen's tables) is a count over `n` runs of the same fight at the same inputs, seeds
// 0x5eed0000 + 1 to n. The rules (rules.mjs jumpChances, duelChance, crewChance, fightAdvice) ask for that count here
// and turn it into their figures as before; nothing else about them changed.
//
// A COUNT IS KEPT BY EVERYTHING IT DEPENDS ON (`tallyKey`): the number of fights, the scrape thresholds that sort a
// jump's ending into a band (config jumped.scrape; none for a one-on-one or the door fight), and the fight's inputs
// as JSON (src/fight/duel.mjs runDuel(inputs, seed) reads nothing else: the same inputs and seed are the same fight).
//
// From Node (the tests, the scripts, the scripted players) a count not kept is played at once, as always. THE PAGE
// may say it wants counts in the background (`deferTallies(want)`): then a count not kept is not played here but asked
// for (`want(key, job)`), and the rules' figure built on it is NaN until it is kept (`keepTally`, from a worker that
// plays the same `tallyFights`), never a guess. The rules' own step is always worked out here and now (`exactly`).
//
//   tallyKey(inputs, n, scrape, raid) the key
//   tallyFights({ inputs, n, scrape, raid }) → { n, won, down, clean?, messy?, fail?, hurt?, spent? }   (pure: the worker plays this)
//   tallied(inputs, n, scrape, raid)  → the count (kept, or played now), or null while the page waits for it
// (raid-1, put on this path by the raid's page: `raid` { hurtAt }, the raid on your home's fight (src/fight/raid.mjs
// runRaid, the very loop raid.mjs raidChance played itself, the same seeds), counting besides the fights held only
// just (`hurt`: your health at hurtAt percent or less) and the rounds fired (`spent`). Without it, nothing changes)
//   keepTally(key, count)             keep a count worked out elsewhere
//   deferTallies(want | null)         the page's switch; exactly(fn) runs fn with it off; collecting(fn) → { value, missing }
import { runDuel } from '../fight/duel.mjs';
import { runRaid } from '../fight/raid.mjs';

/** The seed of the s-th fight of a sample (never the seed the run itself fights with). */
export const SAMPLE_SEED = 0x5eed0000;

/**
 * How a jump that was a fight ends, as the contest's band, by the scrape thresholds (rules.mjs jumpBandOf, which is
 * this with the config's): lost, the bad one ('clean'), unless they are left with `lost` percent of their health or
 * less together ('messy'); won with your health at `won` percent or less, the scuffle too ('messy'); won, 'fail'.
 */
export function bandOfJump(scrape, F) {
  const S = scrape ?? {};
  if (F.over.result !== 'won') {
    const them = F.people.slice(1);
    const left = (100 * them.reduce((a, q) => a + q.hp, 0)) / them.reduce((a, q) => a + q.max, 0);
    return left <= (S.lost ?? -1) ? 'messy' : 'clean';
  }
  const me = F.people[0];
  return (100 * me.hp) / me.max <= (S.won ?? -1) ? 'messy' : 'fail';
}

/** The key a count is kept under: the number of fights, the scrape thresholds (or none), the inputs. */
export function tallyKey(inputs, n, scrape = null, raid = null) {
  const s = scrape ? `${scrape.won ?? -1}/${scrape.lost ?? -1}` : '-';
  return `${raid ? `raid:${raid.hurtAt}|` : ''}${n}|${s}|${JSON.stringify(inputs)}`;
}

/** Fights `from` to `to` of a sample (1-based, inclusive) added into `acc`. The one loop every count is made by. */
export function tallyRange({ inputs, scrape = null, raid = null }, from, to, acc) {
  for (let s = from; s <= to; s++) {
    const F = raid ? runRaid(inputs, SAMPLE_SEED + s) : runDuel(inputs, SAMPLE_SEED + s);
    const won = F.over.result === 'won';
    if (won) acc.won += 1;
    if (F.stats?.allyDown) acc.down += 1;
    if (scrape) acc[bandOfJump(scrape, F)] += 1;
    if (raid) {
      if (won && F.over.hp <= (raid.hurtAt * F.over.max) / 100) acc.hurt += 1;
      acc.spent += F.spent;
    }
  }
  return acc;
}
/** An empty count for a sample of `n`. */
export const emptyTally = (n, scrape = null, raid = null) => ({ n, won: 0, down: 0, ...(scrape ? { clean: 0, messy: 0, fail: 0 } : {}), ...(raid ? { hurt: 0, spent: 0 } : {}) });

/** A whole sample: { n, won, down } and, with `scrape`, the fights ending in each band; with `raid`, hurt and spent. Pure. */
export function tallyFights(job) {
  return tallyRange(job, 1, job.n, emptyTally(job.n, job.scrape ?? null, job.raid ?? null));
}

// ── what is kept, and the page's switch ─────────────────────────────────────────────────────────────────────────────
const KEPT = new Map();
const KEEP_MAX = 20000;
let want = null;

/** Keep a count (worked out here or in a worker). */
export function keepTally(key, count) {
  if (KEPT.size >= KEEP_MAX) KEPT.delete(KEPT.keys().next().value);
  KEPT.set(key, Object.freeze({ ...count }));
}
/** Is this count kept? */
export const hasTally = key => KEPT.has(key);

/**
 * The count of `n` fights at `inputs` (with `scrape`: by band too): kept, or played now; while the page has said it
 * wants counts in the background, null (and asked for) when it is not kept yet.
 */
export function tallied(inputs, n, scrape = null, raid = null) {
  const key = tallyKey(inputs, n, scrape, raid);
  const kept = KEPT.get(key);
  if (kept) return kept;
  const R = raid ? { raid: { hurtAt: raid.hurtAt } } : {};
  if (want) {
    want(key, { inputs, n, scrape: scrape ? { won: scrape.won ?? -1, lost: scrape.lost ?? -1 } : null, ...R });
    return null;
  }
  keepTally(key, tallyFights({ inputs, n, scrape, ...R }));
  return KEPT.get(key);
}

/** The page's switch: `fn(key, job)` is told of each count asked for and not kept (null: play them here, as Node does). */
export function deferTallies(fn) {
  want = fn ?? null;
}
/** `fn()` with every count played here and now (the rules' step: exact, whatever the page has switched). */
export function exactly(fn) {
  const was = want;
  want = null;
  try {
    return fn();
  } finally {
    want = was;
  }
}
/**
 * `fn()` and the counts it asked for that were not kept: { value, missing: [key] }. With the page's switch off this
 * plays them (missing is empty); on, `value` has NaN for every figure built on a missing count.
 */
export function collecting(fn) {
  const was = want;
  if (!was) return { value: fn(), missing: [] };
  const missing = new Set();
  want = (key, job) => {
    missing.add(key);
    was(key, job);
  };
  try {
    return { value: fn(), missing: [...missing] };
  } finally {
    want = was;
  }
}
