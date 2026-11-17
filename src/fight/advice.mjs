// WHAT WOULD HAVE SAVED YOU: one plain line, worked out from the fight. The same line goes on the page's losing card
// and, as words, to an AI player (report.mjs).
//
//   advise(F) → { key, consider, line, rates }   (null for a fight that was won)
//
// HOW IT IS WORKED OUT. Every one thing the build could have had more of (a gun, a stronger gun, the vest, more
// strength, faster shoes, Cousin Earl) is tried on this very stop: the same level, this fight's seed and the next
// few, played by a player who backs away while firing (policies.mjs kite). The one that wins the most of them is the
// one named. The line then says why in this fight's own numbers: what they did to you, and what that one thing
// would have done about it (for a gun: how many it would have dropped before they reached you, this same seed).
import { WEAPONS, GEAR, ALLY, LEVELS } from './data.mjs';
import { runFight, foes } from './sim.mjs';
import { kite } from './policies.mjs';

const NUM = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = n => (n < 10 ? NUM[n] : String(n));
/** A player who moved less than this on average (m/s) stood still. */
const MOVED = 0.5;

/** The one-thing-more builds of a build: [{ key, build, consider }], in the order a tie goes. */
export function upgrades(build) {
  const out = [];
  const gear = build.gear ?? [];
  const W = WEAPONS[build.weapon];
  if (W.kind !== 'gun') out.push({ key: 'pistol', build: { ...build, weapon: 'pistol' }, consider: 'consider a gun' });
  else if (build.weapon === 'pistol') out.push({ key: 'chopper', build: { ...build, weapon: 'chopper' }, consider: 'consider a stronger gun' });
  for (const g of ['vest', 'strength', 'shoes']) {
    if (!gear.includes(g)) out.push({ key: g, build: { ...build, gear: [...gear, g] }, consider: { vest: 'consider a vest', strength: 'consider more strength', shoes: 'consider faster shoes' }[g] });
  }
  if (!build.ally) out.push({ key: 'ally', build: { ...build, ally: true }, consider: `consider bringing ${ALLY.name}` });
  return out;
}

/**
 * How well a build does on this stop, over `seeds` seeds from `seed`, backing away while firing: a win counts 1 and
 * half the health share kept, a loss the share of them dropped (so a near thing tells from a rout). → { score, wins }
 */
function trial(build, level, seed, seeds, arena = undefined) {
  let score = 0;
  let wins = 0;
  for (let k = 0; k < seeds; k++) {
    const F = runFight({ build, level, seed: seed + k * 7919, policy: kite, arena });
    const me = F.people[0];
    if (F.over.result === 'won') {
      wins += 1;
      score += 1 + (0.5 * me.hp) / me.max;
    } else score += (0.8 * F.stats.drops.length) / F.stats.foes;
  }
  return { score: score / seeds, wins };
}

/** Their health still standing (up, or not come yet) when it ended. */
function leftOf(F) {
  return foes(F).filter(f => !f.down).reduce((s, f) => s + f.hp, 0);
}

export function advise(F, { seeds = 30 } = {}) {
  if (!F.over || F.over.result === 'won') return null;
  const S = F.stats;
  // (back down the stairs before anything happened: nothing to say)
  if (F.over.result === 'left' && !S.dmgTaken && !S.drops.length) return null;
  // STOOD STILL: when the player hardly moved and the same build, backing away while it fires, wins half of these or
  // more, that is what would have helped most: nothing to buy
  const pace = S.moved / Math.max(1, F.t);
  if (pace < MOVED) {
    const T = trial(F.build, F.level, F.seed, seeds, F.arena);
    if (T.wins * 2 >= seeds) {
      const gun = WEAPONS[F.build.weapon].kind === 'gun';
      return {
        key: 'move', consider: 'keep moving', rates: { move: T.wins }, scores: { move: T.score }, seeds,
        line: `You stood your ground and they walked up to you. ${gun ? 'Backing away while you fire' : 'Stepping in and out'} wins ${T.wins} of ${seeds} like it with what you have.`,
      };
    }
  }
  const list = upgrades(F.build);
  if (!list.length) return { key: null, consider: 'leave sooner', rates: {}, line: `You had everything and they still had ${leftOf(F)} health standing. On a night like this, walk back down the stairs early.` };
  const rates = {};
  const scores = {};
  for (const U of list) {
    const T = trial(U.build, F.level, F.seed, seeds, F.arena);
    rates[U.key] = T.wins;
    scores[U.key] = T.score;
  }
  // (the best; a tie goes to the first in the list)
  const best = list.reduce((a, b) => (scores[b.key] > scores[a.key] + 1e-9 ? b : a));
  const taken = S.dmgTaken;
  let fact;
  let help;
  switch (best.key) {
    case 'pistol': {
      fact = S.firstDropT === null ? `They landed ${taken} on you and you never dropped one.` : `They landed ${S.dmgBeforeDrop} on you before you dropped one.`;
      // (this very seed, with the gun: how many went down before the first blow reached you)
      const G = runFight({ build: best.build, level: F.level, seed: F.seed, policy: kite, arena: F.arena });
      const reached = G.stats.firstMeleeT ?? Infinity;
      const n = G.stats.drops.filter(d => d.t <= reached).length;
      help = n ? `A handgun would have dropped ${word(n)} before they reached you.` : `With a handgun you would have won ${rates.pistol} of ${seeds} like it.`;
      break;
    }
    case 'chopper': {
      const up = foes(F).filter(f => !f.down).length + (LEVELS[F.level].waves.length - F.wave);
      fact = S.dmgReloading >= taken * 0.25 ? `${S.dmgReloading} of the ${taken} they put in you landed while you reloaded.` : S.dryT !== null ? `Your ${WEAPONS[F.build.weapon].name} ran dry with ${word(up)} of them still up.` : `You dropped ${word(S.drops.length)} of ${word(S.foes)} before they dropped you.`;
      help = `The ${WEAPONS.chopper.name} holds ${WEAPONS.chopper.mag} and fires half again as fast.`;
      break;
    }
    case 'vest':
      fact = S.dmgShot >= taken * 0.3 ? `Their shooter put ${S.dmgShot} of the ${taken} in you from across the street.` : `They put ${taken} into you.`;
      help = `A ${GEAR.vest.name} would have taken ${Math.round(taken * GEAR.vest.cut)} of it off.`;
      break;
    case 'strength':
      fact = `It took ${taken} to drop you${S.drops.length ? `, and you dropped ${word(S.drops.length)}` : ''}.`;
      help = `Built, you would have had ${GEAR.strength.health} more health to give and hit a fifth harder.`;
      break;
    case 'shoes':
      fact = `${S.mostAtOnce > 1 ? `${word(S.mostAtOnce)[0].toUpperCase()}${word(S.mostAtOnce).slice(1)} of them` : 'They'} caught up with you.`;
      help = `${GEAR.shoes.name[0].toUpperCase()}${GEAR.shoes.name.slice(1)} would have kept you out of reach.`;
      break;
    default:
      fact = S.mostAtOnce > 1 ? `${word(S.mostAtOnce)[0].toUpperCase()}${word(S.mostAtOnce).slice(1)} of them were on you at once.` : `You took all ${taken} of it alone.`;
      help = `${ALLY.name} would have taken some of them off you.`;
  }
  return { key: best.key, consider: best.consider, line: `${fact} ${help}`, rates, scores, seeds };
}
