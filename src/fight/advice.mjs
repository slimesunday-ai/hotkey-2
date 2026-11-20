// WHAT WOULD HAVE SAVED YOU: one plain line, worked out from the fight. The same line goes on the page's losing card
// and, as words, to an AI player (report.mjs).
//
//   advise(F) → { key, consider, line, rates }   (null for a fight that was won)
//
// HOW IT IS WORKED OUT. Every one thing the build could have had more of, or other (a gun, another gun: each has a
// job of its own, fight-3; the vest, more strength, faster shoes, Cousin Earl, or Earl told another way) is tried on
// this very stop: the same level, this fight's seed and the next
// few, played by a player who backs away while firing (policies.mjs kite). The one that wins the most of them is the
// one named. The line then says why in this fight's own numbers: what they did to you, and what that one thing
// would have done about it (for a gun: how many it would have dropped before they reached you, this same seed).
import { WEAPONS, GEAR, ALLY, EARL_WAYS, WAYS_OFFERED } from './data.mjs';
import { runFight, foes } from './sim.mjs';
import { kite } from './policies.mjs';

const NUM = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = n => (n < 10 ? NUM[n] : String(n));
/** A player who moved less than this on average (m/s) stood still. */
const MOVED = 0.5;

/** The guns a player may carry, in the order a tie goes: what each one is, said on the card. */
const GUNS = { pistol: 'consider a gun', chopper: 'consider the chopper', doorman: 'consider the Doorman', longeye: 'consider the Long-eye' };
/**
 * The one-thing-more (or one-thing-other) builds of a build: [{ key, build, consider }], in the order a tie goes. With
 * no gun: a gun (the six-shot), the Doorman, the Long-eye. With one: each other gun (fight-3: a job of its own, not a
 * step up). Then the gear not worn, then Cousin Earl: brought, or with him, told each other way of WAYS_OFFERED (keys
 * `earl-front`, `earl-hunt`, `earl-block`).
 */
export function upgrades(build) {
  const out = [];
  const gear = build.gear ?? [];
  const W = WEAPONS[build.weapon];
  const guns = W.kind !== 'gun' ? ['pistol', 'doorman', 'longeye'] : Object.keys(GUNS).filter(g => g !== build.weapon);
  for (const g of guns) out.push({ key: g, build: { ...build, weapon: g }, consider: GUNS[g] });
  for (const g of ['vest', 'strength', 'shoes']) {
    if (!gear.includes(g)) out.push({ key: g, build: { ...build, gear: [...gear, g] }, consider: { vest: 'consider a vest', strength: 'consider more strength', shoes: 'consider faster shoes' }[g] });
  }
  if (!build.ally) out.push({ key: 'ally', build: { ...build, ally: true }, consider: `consider bringing ${ALLY.name}` });
  else for (const w of WAYS_OFFERED) if (w !== (build.earl ?? 'side')) out.push({ key: `earl-${w}`, build: { ...build, earl: w }, consider: `consider Earl ${EARL_WAYS[w].name}` });
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

/** `only`: the keys of upgrades() to choose among (a test's, to hear one line); left out, all of them. */
export function advise(F, { seeds = 30, only = null } = {}) {
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
  const list = upgrades(F.build).filter(U => !only || only.includes(U.key));
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
  const atOnce = S.mostAtOnce > 1 ? `${word(S.mostAtOnce)[0].toUpperCase()}${word(S.mostAtOnce).slice(1)} of them` : null;
  const gun = WEAPONS[F.build.weapon].kind === 'gun';
  const up = foes(F).filter(f => !f.down).length + (F.waves.length - F.wave);
  const shooter = F.waves.filter(w => w[1] === 'shooter').length > 1 ? 'Their shooters' : 'Their shooter';
  /** This very seed with the other build: how many of them went down before the first blow reached you. */
  const beforeReached = () => {
    const G = runFight({ build: best.build, level: F.level, seed: F.seed, policy: kite, arena: F.arena });
    const reached = G.stats.firstMeleeT ?? Infinity;
    return G.stats.drops.filter(d => d.t <= reached).length;
  };
  let fact;
  let help;
  switch (best.key) {
    case 'pistol': {
      if (gun) {
        fact = S.dryT !== null ? `Your ${WEAPONS[F.build.weapon].name} ran dry with ${word(up)} of them still up.` : `You dropped ${word(S.drops.length)} of ${word(S.foes)} before they dropped you.`;
        help = `The ${WEAPONS.pistol.name} does a bit of everything: ${WEAPONS.pistol.mag} in it, quick to fire, cheap on rounds.`;
        break;
      }
      fact = S.firstDropT === null ? `They landed ${taken} on you and you never dropped one.` : `They landed ${S.dmgBeforeDrop} on you before you dropped one.`;
      const n = beforeReached();
      help = n ? `A handgun would have dropped ${word(n)} before they reached you.` : `With a handgun you would have won ${rates.pistol} of ${seeds} like it.`;
      break;
    }
    case 'doorman': {
      // (THEY RUSHED YOU: the Doorman's shell takes everyone in front of you up close)
      fact = atOnce ? `They rushed you: ${atOnce.toLowerCase()} on you at once.` : `They walked up to you${S.firstDropT === null ? ' and you never dropped one' : ''}.`;
      const n = gun ? 0 : beforeReached();
      help = `A shell of the ${WEAPONS.doorman.name} hits every one of them in front of you up close${n ? `: it would have dropped ${word(n)} before they reached you` : ''}.`;
      break;
    }
    case 'longeye': {
      // (THEY HUNG BACK: the Long-eye drops one in a shot or two from across the street)
      fact = S.dmgShot >= taken * 0.3 && S.dmgShot > 0 ? `${shooter} put ${S.dmgShot} of the ${taken} in you from across the street.`
        : S.dryT !== null ? `Your ${WEAPONS[F.build.weapon].name} ran dry with ${word(up)} of them still up.`
          : `You dropped ${word(S.drops.length)} of ${word(S.foes)} before they dropped you.`;
      help = `The ${WEAPONS.longeye.name} drops one of them in a shot or two from far off, and is light on rounds.`;
      break;
    }
    case 'earl-front':
      fact = atOnce ? `${atOnce} walked up and hit you at once.` : `They walked up and put ${taken} into you.`;
      help = `Told to stand out in front, ${ALLY.name} takes the first of them himself.`;
      break;
    case 'earl-hunt':
      fact = S.dmgShot > 0 ? `${shooter} put ${S.dmgShot} of the ${taken} in you from the back.` : `The ones at the back kept you busy.`;
      help = `Told to go hunting, ${ALLY.name} goes after the ones who shoot.`;
      break;
    case 'earl-block':
      fact = atOnce ? `${atOnce} were on you at once.` : `They came at you together.`;
      help = `Told one at a time, ${ALLY.name} keeps the second one off you while you deal with the first.`;
      break;
    case 'chopper': {
      fact = S.dmgReloading >= taken * 0.25 ? `${S.dmgReloading} of the ${taken} they put in you landed while you reloaded.` : S.dryT !== null ? `Your ${WEAPONS[F.build.weapon].name} ran dry with ${word(up)} of them still up.` : `You dropped ${word(S.drops.length)} of ${word(S.foes)} before they dropped you.`;
      help = `The ${WEAPONS.chopper.name} holds ${WEAPONS.chopper.mag} and fires half again as fast.`;
      break;
    }
    case 'vest':
      fact = S.dmgShot >= taken * 0.3 ? `${shooter} put ${S.dmgShot} of the ${taken} in you from across the street.` : `They put ${taken} into you.`;
      help = `A ${GEAR.vest.name} would have taken ${Math.round(taken * GEAR.vest.cut)} of it off.`;
      break;
    case 'strength':
      fact = `It took ${taken} to drop you${S.drops.length ? `, and you dropped ${word(S.drops.length)}` : ''}.`;
      help = `Built, you would have had ${GEAR.strength.health} more health to give and hit a tenth harder.`;
      break;
    case 'shoes':
      fact = `${S.mostAtOnce > 1 ? `${word(S.mostAtOnce)[0].toUpperCase()}${word(S.mostAtOnce).slice(1)} of them` : 'They'} caught up with you.`;
      help = `${GEAR.shoes.name[0].toUpperCase()}${GEAR.shoes.name.slice(1)} would have kept you out of reach.`;
      break;
    default:
      fact = atOnce ? `${atOnce} were on you at once.` : `You took all ${taken} of it alone.`;
      help = `${ALLY.name} would have taken some of them off you.`;
  }
  return { key: best.key, consider: best.consider, line: `${fact} ${help}`, rates, scores, seeds };
}
