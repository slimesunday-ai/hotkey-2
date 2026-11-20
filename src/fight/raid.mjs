// THE RAID ON YOUR HOME, HEADLESS (raid-1, RUN.md "The raid on your home"): the Sixes come through your door, three to
// five of them, and you meet them with what you chose to hold. It is the crew's door fight made bigger (duel.mjs, the
// fight of several on the one-on-one's terms: a blow lands `hit` of the time, the brawl), with what the raid adds, all of
// it opt-in in sim.mjs so every older fight is the same tick for tick:
//   a gun in your hands (`duel.guns`), its rounds what you own of them (`you.rounds`), run dry you fight on with what you
//   fight with (`you.dry`); the Doorman holds its fire until they are close (`you.holdFire`); the stab vest
//   (`you.cut`); the pepper fogger (`duel.blind`: they come in blind for a few seconds); the door bar (`firstHurt`);
//   Cousin Earl beside you (`ally`, told his way).
// They come across your yard from where they stand (`arena.around`, [metres, degrees]): a gun gets its shots before they
// reach you, the Doorman waits for them at the door.
//
//   startRaid(inputs, seed)     set up, not yet stepped (the page steps it: step(F, raidMove(F)))
//   runRaid(inputs, seed)       to the end → F (F.over.result 'won' | 'lost'; F.spent the rounds fired)
//   raidMove(F)                 your move this tick: with a loaded gun you hold your door; with fists, the brawl
import { createFight, step, you, foes } from './sim.mjs';
import { WEAPONS } from './data.mjs';
import { brawl } from './policies.mjs';
import { duelArena } from './duel.mjs';

/** A raid, set up and not yet stepped. */
export function startRaid(inputs, seed) {
  const duel = {
    you: inputs.you, foe: inputs.foes[0], foes: inputs.foes, guns: true,
    ...(inputs.ally ? { ally: inputs.ally } : {}), ...(inputs.firstHurt ? { firstHurt: inputs.firstHurt } : {}), ...(inputs.blind ? { blind: inputs.blind } : {}),
    cap: inputs.cap, hit: inputs.hit, brawl: inputs.brawl,
  };
  return createFight({ duel, seed, arena: duelArena(inputs.arena) });
}

/**
 * Your move: a gun with rounds in it or to reload from, stand in your door and let it work while any of them who hit
 * with their hands is up; once only those who hang back and shoot are left, go at the nearest (to its range). Else the
 * brawl.
 */
export function raidMove(F) {
  const me = you(F);
  const W = WEAPONS[me.arm];
  if (W?.kind !== 'gun') return brawl(F);
  const up = foes(F).filter(f => !f.down);
  if (up.some(f => WEAPONS[f.arm].kind !== 'gun')) return { x: 0, y: 0 };
  const t = up.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
  if (!t) return { x: 0, y: 0 };
  const d = Math.hypot(t.x - me.x, t.y - me.y);
  const want = Math.min(W.range, me.holdFire ?? W.range) - 0.5;
  return d > want ? { x: (t.x - me.x) / d, y: (t.y - me.y) / d } : { x: 0, y: 0 };
}

/** How many raids this process has run to their end (for measuring what they cost). */
export const RAID_RUNS = { n: 0 };

/** A raid to its end, headless. `F.spent`: the rounds you fired. */
export function runRaid(inputs, seed) {
  RAID_RUNS.n += 1;
  const F = startRaid(inputs, seed);
  const me = you(F);
  const had = me.gun ? me.mag + me.rounds : 0;
  while (!F.over) step(F, raidMove(F));
  F.spent = me.gun ? had - me.mag - (me.rounds === Infinity ? 0 : me.rounds) : 0;
  return F;
}
