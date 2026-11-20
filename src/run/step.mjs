// Apply one choice: step(cfg, state, choice) → { state, events }. Pure: the input state is never changed, and the
// same state and choice always give the same result. Every event says what happened, to whom, where, the roll, the
// money moved, and a `scene` hint from RUN.md's "Plays as" table so the stage needs to derive nothing.
// No rule here names a place: each reads the place's entry (config.mjs, `places`).

import { rng, pick } from '../rng.mjs';
import { rollChance } from '../contest.mjs';
import { copyRun } from './state.mjs';
import { thingOf } from './library.mjs';
import { listChoices } from './view.mjs';
import {
  danger, deal, jobOdds, jobPay, jumpBand, jumpContest, jumpTakes, morningEnergy, ownsAll, clamp, namedLabel, whoOf, cap,
  placeOf, tierOf, homeId, streetOf, heatPlace, drawSupply, supplyLeft, robOdds, binsFinds, shopOf, fullEnergy,
  soldTo, doorChance, regularsOf, grudgeLeft, countToday, trustOf, trustAfter, trustBand, offDays, tellRisk, jobTrust,
  homeOfPerson, placeHeat, isHot, streetPlaces, canHeat, foodToday, isFood,
  goodsOn, goodsHome, withGood, connectOf, goodsTakes, someGoods, goodsText, connectFor,
  supplied, routesFrom, dealHand, cardOf, wayHours,
  homeStreet, atHome, pressureOf, warnChance, restUntil, defencesOf, raidTakes, doorContest, guardOf, raidCast, peopleOf,
  fightsOnFail, doorFights, fightOut, duelBand,
  markOn, fears, fightsNow, markWords, pronouns as pronounsOf,
  jumpsFight, jumpOut, sentFor, armOf, armLabel, armsOf, taughtAt,
  personOf, defVal, defBy, dogOf, raidKind, earlWayOf, earlWayWords, crewOut, sixesOf, sixesStateOf, sixesGround, sixesJob, taxOf, taxPctOf, pctWords, jumpOf,
} from './rules.mjs';
import { earn, lose, spend, bank, withdraw, burgle } from './ledger.mjs';
import { raidOut, raidCrew, crewFoes, raidSize, raidAtOf, stakeOf, holdOf, holdLabel, gunHeat, shareTaken, hiddenOf, roundsOf, thingsAtRisk, thingsToKnock } from './raid.mjs';

/** A roll 0–99: the rig's next chance roll if a test set one, else the seeded dice. */
const d100 = (state, keys) => (state.rig?.chances?.length ? state.rig.chances.shift() : Math.floor(rng(state.seed, ...keys)() * 100));
/** A contest roll 0–99: the rig's next contest roll if a test set one, else the seeded dice. */
const contestRoll = (state, keys) => (state.rig?.rolls?.length ? state.rig.rolls.shift() : Math.floor(rng(state.seed, ...keys)() * 100));
const payIn = (state, [lo, hi], keys) => lo + Math.floor(rng(state.seed, ...keys)() * (hi - lo + 1));

// What a thing bought on the street does: each key of an item's `gives` (config.mjs, a place's `shop`).
const GIVES = {
  energy: (cfg, state, n) => { state.energy = Math.min(fullEnergy(cfg, state), state.energy + n); return `energy +${n}`; },
};

export function step(cfg, input, choice) {
  const legal = listChoices(cfg, input).find(c => sameChoice(c.choice, choice));
  if (!legal) throw new Error(`not a choice here: ${JSON.stringify(choice)}`);
  if (!legal.available) throw new Error(`${legal.label}: ${legal.why}`);
  const state = copyRun(input);
  const events = [];
  // (on a route, every event says which: the stage plays it on the way, and the measures count what is lost on foot)
  const at = (extra = {}) => ({ day: state.day, hour: state.hour, place: state.place, block: placeOf(cfg, state.place).block ?? null, to: 'you', ...(state.route ? { route: state.route.id, way: state.route.way } : {}), ...extra });
  const push = e => events.push(e);

  // a way along a route (config.mjs `ways`: its `do` is the choice)
  const way = Object.keys(cfg.ways ?? {}).find(w => cfg.ways[w].do === choice.do);
  // (sixes-1: leaving the Sixes' ground, they may be waiting by the steps: Dutch for the tax, or two of them)
  const stopped = (!!way || choice.do === 'subway') && sixesStop(cfg, state, at, push);
  if (stopped) { /* (you are still where you were: choose again) */ }
  else if (way) setOut(cfg, state, way, choice, at, push);
  else act(cfg, state, choice, at, push);
  // an attempt on your crib due today: it starts once you are away, from its hour on, and is met or settled (home-1)
  homeWatch(cfg, state, at, push);
  // whoever comes to your door tomorrow says so this evening (memory-1)
  if (cfg.memory && state.hour >= cfg.memory.due.warnHour) warnDue(cfg, state, at, push);
  return { state, events };
}

function act(cfg, state, choice, at, push) {
  switch (choice.do) {
    case 'card': anHour(cfg, state, at, push, () => playCard(cfg, state, choice.id, at, push)); break;
    case 'onward': onward(cfg, state, at, push); break;
    case 'job': anHour(cfg, state, at, push, () => work(cfg, state, choice, at, push)); break;
    case 'rob': anHour(cfg, state, at, push, () => rob(cfg, state, at, push)); break;
    case 'bins': anHour(cfg, state, at, push, () => bins(cfg, state, at, push)); break;
    case 'shop': buyHere(cfg, state, choice.item, at, push); break;
    case 'pack': buyPack(cfg, state, at, push); break;
    case 'get': getThing(cfg, state, choice.item, at, push); break;
    case 'wear': case 'unwear': wear(cfg, state, choice, at, push); break;
    case 'rough': sleepRough(cfg, state, at, push); break;
    case 'give': give(cfg, state, at, push); break;
    case 'refuse': refuse(cfg, state, at, push, 'shut'); break;
    case 'inside': {
      const amount = state.carried;
      // goods come in with you and stay at the crib, safe, until you step out with them
      const stashed = someGoods(state.goods);
      for (const [g, n] of Object.entries(stashed)) state.stash[g] = goodsHome(state, g) + n;
      state.goods = {};
      const left = Object.keys(stashed).length ? { stashed, home: someGoods(state.stash) } : {};
      const also = left.stashed ? ` You left ${goodsText(cfg, stashed)} at home.` : '';
      if (amount > 0) push(at({ type: 'bank', by: 'you', text: `You went inside and banked $${amount}.${also}`, money: [bank(state, amount)], ...left, scene: { action: 'stash', spot: 'pad' } }));
      else push(at({ type: 'inside', by: 'you', text: `You went inside.${also}`, ...left, scene: { action: 'walk', spot: 'door' } }));
      state.place = placeOf(cfg, state.place).door;
      break;
    }
    case 'out': {
      const take = choice.take ?? 0;
      if (!Number.isInteger(take) || take < 0 || take > state.banked) throw new Error(`can't take $${take} out with $${state.banked} banked`);
      if (state.door) refuse(cfg, state, at, push, 'past');
      const moved = take ? [withdraw(state, take)] : [];
      // goods at the crib: all of them come out with you unless the choice says how many of each (`goods`)
      const want = choice.goods ?? Object.fromEntries(Object.keys(someGoods(state.stash)).map(g => [g, goodsHome(state, g)]));
      const took = {};
      for (const [g, n] of Object.entries(want)) {
        if (!Number.isInteger(n) || n < 0 || n > goodsHome(state, g)) throw new Error(`can't take ${n} of ${g} out with ${goodsHome(state, g)} at home`);
        if (!n) continue;
        state.stash[g] = goodsHome(state, g) - n;
        if (!state.stash[g]) delete state.stash[g];
        state.goods[g] = goodsOn(state, g) + n;
        took[g] = n;
      }
      const carry = Object.keys(took).length ? { tookGoods: took, home: someGoods(state.stash) } : {};
      const words = [take ? `$${take}` : null, carry.tookGoods ? goodsText(cfg, took) : null].filter(Boolean).join(' and ');
      push(at({ type: 'out', by: 'you', text: words ? `You stepped out with ${words}.` : 'You stepped out.', money: moved, ...carry, scene: { action: 'walk', spot: 'door' } }));
      state.place = placeOf(cfg, state.place).inside;
      break;
    }
    case 'subway': ride(cfg, state, choice, at, push); break;
    case 'buy': {
      const it = cfg.shop[choice.item];
      push(at({ type: 'buy', by: 'you', item: choice.item, text: `You bought ${it.label.toLowerCase()} for $${it.price}.`, money: [spend(state, it.price)], scene: { notice: true } }));
      state.owned[choice.item] = true;
      if (ownsAll(state) && state.doneDay === null) {
        state.doneDay = state.day;
        push(at({ type: 'done', by: 'you', text: `You own all three: done in ${state.day} day${state.day > 1 ? 's' : ''}.`, days: state.day, scene: { notice: true } }));
      }
      break;
    }
    case 'sleep': {
      if (state.door) refuse(cfg, state, at, push, 'shut');
      push(at({ type: 'sleep', by: 'you', text: 'You slept.', scene: { kind: 'night:sleep' } }));
      morning(cfg, state, 'home', push);
      break;
    }
    case 'morning': {
      const night = placeOf(cfg, state.place).held ?? state.place;
      morning(cfg, state, night, push);
      break;
    }
    case 'guard': setGuard(cfg, state, choice.on, at, push); break;
    case 'learn': learn(cfg, state, choice.style, at, push); break;
    case 'fightWith': fightWith(cfg, state, choice.with, at, push); break;
    case 'earlWay': tellEarl(cfg, state, choice.way, at, push); break;
    case 'tax': answerTax(cfg, state, !!choice.pay, at, push); break;
    case 'ammo': buyAmmo(cfg, state, choice.item, at, push); break;
    case 'holdWith': holdWith(cfg, state, choice.with, at, push); break;
    default: throw new Error(`unknown choice ${choice.do}`);
  }
}

function sameChoice(a, b) {
  if (!b || a.do !== b.do) return false;
  if (a.do === 'job') return a.id === b.id; // and `who`, if given, one of its targets (checked in work)
  if (a.do === 'subway') return a.to === b.to && !!a.hop === !!b.hop;
  if (a.do === 'card') return a.id === b.id;
  if (a.to !== undefined && a.do !== 'out') return a.to === b.to; // a way along a route
  if (a.do === 'buy' || a.do === 'shop' || a.do === 'get' || a.do === 'wear' || a.do === 'unwear') return a.item === b.item;
  if (a.do === 'pack') return a.good === b.good;
  if (a.do === 'guard') return !!a.on === !!b.on;
  if (a.do === 'learn') return a.style === b.style;
  if (a.do === 'fightWith') return a.with === b.with;
  if (a.do === 'earlWay') return a.way === b.way;
  if (a.do === 'tax') return !!a.pay === !!b.pay;
  if (a.do === 'ammo') return a.item === b.item;
  if (a.do === 'holdWith') return a.with === b.with;
  return true; // inside, out (any amount, checked in step), sleep, morning, rob, bins, rough, give, refuse
}

/**
 * One hour's work where you stand: the act, then, where something can act on you, the place notices you. The
 * chances are this hour's as the view showed them at its start.
 */
function anHour(cfg, state, at, push, act) {
  const place = state.place;
  const risk = danger(cfg, state);
  const tell = tellRisk(cfg, state, place); // who here is against you and about, as the view showed it
  const seen = act(); // true: it could heat the place (a crime, whichever way it went), or it was low (the bins)
  if (seen && tell.pct) witness(cfg, state, tell, at, push);
  const hour = state.hour;
  state.hour += 1;
  if (tierOf(cfg, place)?.jump) state.hoursThere += 1;
  if (risk.here) notice(cfg, state, risk, hour, at, push);
}

/** A dealt job, done to or with one person (the dealt one, or one of its targets named in the choice), whose mood it sets. */
function work(cfg, state, choice, at, push) {
  const place = state.place;
  const dealt = deal(cfg, state).find(j => j.id === choice.id);
  let job = dealt;
  if (choice.who != null && choice.who !== dealt.who?.id) {
    const target = dealt.targets.find(p => p.id === choice.who);
    if (!target) throw new Error(`${namedLabel(dealt)}: not ${choice.who} this hour (${dealt.targets.map(p => p.id).join(', ')})`);
    job = { ...dealt, who: target };
  }
  // a selling job: the good named in the choice (one you carry that it takes), else the one dealt
  if (job.goods && choice.good != null && choice.good !== job.good) {
    if (!job.goodsHere.some(x => x.good === choice.good)) throw new Error(`${namedLabel(job)}: you carry no ${choice.good} it takes (${job.goodsHere.map(x => x.good).join(', ')})`);
    job = withGood(cfg, state, job, choice.good);
  }
  const odds = jobOdds(cfg, state, job); // before acting: tired is energy 2 or less now
  const pay0 = jobPay(cfg, state, job); // before acting: with you or not
  const energy0 = state.energy; // before acting: what you bring to a fight
  const keys = ['run-job', state.day, state.hour, place, job.id];
  const r = odds.pct >= 100 ? { hit: true, roll: null, chance: 100 } : rollChance(state, odds.pct, keys);
  const scenes = job.scene ?? {};
  const label = namedLabel(job);
  const who = job.who ? whoOf(job.who) : null;
  // a sale uses one of the good, win or lose (one that goes wrong is lost)
  let sold = null;
  if (job.good) {
    state.goods[job.good] = goodsOn(state, job.good) - 1;
    if (!state.goods[job.good]) delete state.goods[job.good];
    sold = { good: job.good, label: cfg.goods[job.good].label, used: 1, left: goodsOn(state, job.good), home: goodsHome(state, job.good) };
  }
  const base = at({ type: 'job', job: job.id, label, by: 'you', with: job.with ?? null, who, roll: r.roll, chance: r.chance, ...(job.who !== dealt.who ? { picked: true } : {}), ...(sold ? { goods: sold } : {}) });
  const leftText = sold ? ` ${sold.left ? `${sold.left} left` : `No ${sold.label} left`} on you.` : '';
  state.energy = Math.max(0, state.energy - cfg.energy.perHour);
  // the person: their mood after it, and out for the rest of the day unless it was the safe job (that one goes round)
  const mood = who ? (r.hit ? job.mood?.win : job.mood?.fail) ?? null : null;
  const out = !!who && !job.safe;
  if (who) state.people[who.id] = { mood, out, job: job.id };
  if (job.safe) state.shifts[place] = (state.shifts[place] ?? 0) + 1;
  let after = mood ? ` ${cap(who.name)} ${cfg.moods[mood]}${out ? '; not again today' : ''}.` : '';
  if (r.hit) {
    const pay = payIn(state, pay0, ['run-pay', ...keys.slice(1)]);
    const moved = earn(state, pay);
    state.heat = clamp(state.heat + (job.winHeat ?? 0), 0, cfg.heat.max);
    const heatNow = heatPlace(cfg, state, place, job.winHeat ?? 0);
    const extra = {};
    if (job.who?.regular) {
      // a regular keeps count, and the place's custom is drawn on
      const sold = soldTo(state, who.id) + 1;
      state.regulars[who.id] = sold;
      drawSupply(cfg, state, place, 'custom');
      extra.regular = { sold, doorFrom: cfg.regulars.doorAt };
      after += ` ${cap(who.name)} has had ${sold} from you${sold >= cfg.regulars.doorAt ? ' and may come to your door for more' : ''}.`;
    }
    const trust = who ? moveTrust(cfg, state, who, jobTrust(job).win, 'job', moodWhy(cfg, mood)) : null;
    const pressure = press(cfg, state, place, job.pressure?.win, job.id, `${label} (day ${state.day})`, who);
    // (memory-1: taken off them to their face, a week's mark, unless they hold one already; paid up out of fear, said)
    const mark = job.mark?.win && who ? markPerson(cfg, state, who, job.mark.win, place) : null;
    const six = sixesWork(cfg, state, place, job, pay, label);
    const feared = !!odds.feared;
    const scared = feared ? ` ${cap(who.name)} fears you and paid up without a fight.` : '';
    push({ ...base, outcome: 'win', pay, heat: job.winHeat ?? 0, placeHeat: heatNow, mood, outToday: out, ...extra, ...(trust ? { trust } : {}), ...(pressure ? { pressure } : {}), ...(mark ? { mark } : {}), ...(feared ? { fear: true } : {}), ...(six.note ? { sixes: six.note } : {}),
      text: `${label}: +$${pay}${job.winHeat ? `, heat +${job.winHeat}` : ''}.${scared}${after}${leftText}`, money: [moved], scene: scenes.win ?? { action: 'idle' } });
    for (const e of six.then) push(at(e));
    return canHeat(job); // a job that can heat the place can be seen, whichever way it went
  } else {
    // (duel-1: gone wrong to their face, they fight you, and the fight decides it: rules.mjs fightOut)
    // (memory-1: a job that says `feared` is no fight with somebody who fears you: rules.mjs fightsNow)
    const duel = who && fightsNow(cfg, state, job, who) ? fightOut(cfg, state, who, keys, energy0) : null;
    const gaveWay = !!who && !duel && fightsOnFail(cfg, job);
    const won = duel?.result === 'won';
    const energyLost = duel ? cfg.duel.cost[won ? 'win' : 'lose'] : job.failEnergy ?? 0; // (the fight's cost replaces failEnergy)
    let pay = 0;
    let moved = null;
    if (won) {
      // won: the job pays as a win; the rest (their trust, the heat, the pressure at home) is a failure's
      pay = payIn(state, pay0, ['run-pay', ...keys.slice(1)]);
      moved = earn(state, pay);
    }
    // (bigman-1: a job's `wonHeat`, the heat when it went wrong and you won the fight; else its failHeat)
    const heat = (won ? job.wonHeat : null) ?? job.failHeat ?? 0;
    state.heat = clamp(state.heat + heat, 0, cfg.heat.max);
    const heatNow = heatPlace(cfg, state, place, heat);
    state.energy = Math.max(0, state.energy - energyLost);
    const cost = [heat ? `heat +${heat}` : null, energyLost ? `energy −${energyLost}` : null].filter(Boolean).join(', ');
    const trust = who ? moveTrust(cfg, state, who, jobTrust(job).fail, 'job', moodWhy(cfg, mood)) : null;
    const pressure = press(cfg, state, place, job.pressure?.fail, job.id, `${label}, and it went wrong (day ${state.day})`, who);
    const fought = duel ? ` ${cap(who.name)} came at you: ${won ? `you beat them${pay ? ` and took it: +$${pay}` : ''}` : 'they beat you'}${cost ? ` (${cost})` : ''}.` : '';
    // (memory-1: a fight leaves a mark either way: you beat them, they fear you a week; they beat you, every fear you
    // hold at this place ends at once, and they will not give way to you for the week)
    const ended = duel && !won ? breakFears(cfg, state, place, who.id) : [];
    const mark = duel ? markPerson(cfg, state, who, won ? 'beat' : 'beaten', place, { force: true }) : null;
    const six = sixesWork(cfg, state, place, job, pay, label);
    const gave = gaveWay ? ` ${cap(who.name)} fears you: no fight.` : '';
    const text = duel ? `${label}: it went wrong.${fought}${sold ? ` The ${sold.label} went with it.` : ''}${after}${leftText}`
      : `${label}: it went wrong${cost ? ` (${cost})` : ''}${sold ? `, and the ${sold.label} went with it` : ''}.${gave}${after}${leftText}`;
    push({ ...base, outcome: 'fail', heat, placeHeat: heatNow, energyLost, mood, outToday: out, ...(duel ? { duel, pay } : {}), ...(trust ? { trust } : {}), ...(pressure ? { pressure } : {}), ...(mark ? { mark } : {}), ...(gaveWay ? { gaveWay: true } : {}), ...(six.note ? { sixes: six.note } : {}), text, money: moved ? [moved] : [], scene: scenes.fail ?? scenes.win ?? { action: 'idle' } });
    for (const e of ended) push(at(e));
    for (const e of six.then) push(at(e));
    return canHeat(job);
  }
}

/** Why a job moved its person's trust, in words: what the mood it left them in means (config.mjs, trust.why). */
const moodWhy = (cfg, mood) => cfg.trust.why?.[mood] ?? mood ?? 'the job';

const signedT = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/**
 * Move a person's trust by `change` (within min and max), and say it: who, their place, from, to, the band before and
 * after, the days they are off your table, why, and plain text. null when nothing moved. Rides on the event that
 * caused it as its `trust` field (the morning's drift is its own event).
 */
function moveTrust(cfg, state, who, change, cause, why) {
  if (!who || !change) return null;
  const from = trustOf(state, who.id);
  const to = trustAfter(cfg, state, who.id, change);
  if (to === from) return null;
  state.trust = { ...(state.trust ?? {}), [who.id]: to };
  if (!to) delete state.trust[who.id];
  return trustNote(cfg, state, who, from, to, cause, why);
}

function trustNote(cfg, state, who, from, to, cause, why) {
  const T = cfg.trust;
  const place = homeOfPerson(cfg, who.id);
  const band = trustBand(cfg, to);
  const bandWas = trustBand(cfg, from);
  const off = offDays(cfg, state, who.id);
  const name = cap(who.name);
  const where = placeOf(cfg, place).where ?? `at ${placeOf(cfg, place).label}`;
  const verb = band !== bandWas ? (band === 'neutral' ? `is ${bandWas === 'with' ? 'no longer with you' : 'over it'}` : `is ${T.bands[band]} now`) : `trusts you ${to > from ? 'more' : 'less'}`;
  const more = band === 'against' ? ` Won't deal with you, ${off} day${off > 1 ? 's' : ''}; may call the police on what you do ${where}.`
    : band === 'with' && bandWas !== 'with' ? ' They see nothing, and a job with them pays more.' : '';
  return { who: { id: who.id, name: who.name, role: who.role }, at: place, from, to, change: to - from, band, bandWas, offDays: off, cause, why,
    text: `${name} ${verb} (trust ${signedT(to)}): ${why}.${more}` };
}

/**
 * Someone against you, about here this hour, may see what you just did (it heated the place, or it was low) and call it
 * in: one roll at the chance the view showed; a call heats the place. Said either way.
 */
function witness(cfg, state, tell, at, push) {
  const place = state.place;
  const keys = [state.day, state.hour, place];
  const r = rollChance(state, tell.pct, ['run-tell', ...keys]);
  const watchers = tell.by.map(w => ({ ...w }));
  const names = watchers.map(w => w.name).join(' and ');
  if (!r.hit) {
    push(at({ type: 'witness', by: watchers[0].id, who: null, watchers, called: false, roll: r.roll, chance: r.chance, at: place, heat: 0, placeHeat: placeHeat(state, place),
      text: `${cap(names)} ${watchers.length > 1 ? 'were' : 'was'} watching, against you, but kept quiet this time.`, scene: { action: 'idle' } }));
    return;
  }
  const who = pick(rng(state.seed, 'run-tell-who', ...keys), watchers);
  const heatNow = heatPlace(cfg, state, place, tell.heat);
  const pressure = press(cfg, state, place, cfg.pressure?.witness, 'witness', `${cap(who.name)} called the police on you (day ${state.day})`, who);
  push(at({ type: 'witness', by: who.id, who, watchers, called: true, roll: r.roll, chance: r.chance, at: place, heat: tell.heat, placeHeat: heatNow, ...(pressure ? { pressure } : {}),
    text: `${cap(who.name)} saw it and called the police: heat +${tell.heat} ${placeOf(cfg, place).where ?? `at ${placeOf(cfg, place).label}`}.`,
    scene: { kind: 'say' } }));
}

/**
 * A call to the police at a place you are not standing in: a notice, with what to do about it (a cooler place to work,
 * or what one more call there would do).
 */
function callNotice(cfg, state, place) {
  const heat = placeHeat(state, place);
  const hot = isHot(cfg, state, place);
  const alt = streetPlaces(cfg).find(id => id !== place && placeOf(cfg, id).jobs && !isHot(cfg, state, id)) ?? null;
  const name = cap(placeOf(cfg, place).label);
  const altLabel = alt ? placeOf(cfg, alt).label : null;
  const left = cfg.heat.hotAt - heat;
  const text = hot ? `${name} is hot (heat ${heat}): the police are about there. ${alt ? `Work ${altLabel} today.` : 'Stay in today.'}`
    : `${name} is at heat ${heat}: ${left} more and the police are about there. ${alt ? `Keep it clean there today, or work ${altLabel}.` : 'Keep it clean there today.'}`;
  return { place, heat, hot, text, suggest: alt ? { place: alt, label: altLabel, text: `work ${altLabel} today` } : { place: null, label: null, text: 'keep it clean there today' } };
}

/** Robbing somebody passing: nobody you know, nobody remembers it, but the place heats up sharply. */
function rob(cfg, state, at, push) {
  const place = state.place;
  const o = robOdds(cfg, state);
  const keys = ['run-rob', state.day, state.hour, place];
  const r = rollChance(state, o.pct, keys);
  state.energy = Math.max(0, state.energy - cfg.energy.perHour);
  const left = drawSupply(cfg, state, place, cfg.street.rob.draws);
  countToday(state, place, 'rob');
  const base = at({ type: 'rob', by: 'you', who: null, roll: r.roll, chance: r.chance, left });
  const P = cfg.street.rob.pressure ?? {};
  if (r.hit) {
    const pay = payIn(state, o.pay, ['run-rob-pay', ...keys.slice(1)]);
    const moved = earn(state, pay);
    const heatNow = heatPlace(cfg, state, place, o.winHeat);
    const pressure = press(cfg, state, place, P.win, 'rob', `You robbed somebody passing (day ${state.day})`);
    push({ ...base, outcome: 'win', pay, heat: o.winHeat, placeHeat: heatNow, ...(pressure ? { pressure } : {}), text: `You robbed somebody passing: +$${pay}, heat +${o.winHeat} here.`, money: [moved], scene: { kind: 'rob:clean' } });
  } else {
    const heatNow = heatPlace(cfg, state, place, o.failHeat);
    const pressure = press(cfg, state, place, P.fail, 'rob', `You tried to rob somebody passing, and they got away shouting (day ${state.day})`);
    push({ ...base, outcome: 'fail', heat: o.failHeat, placeHeat: heatNow, ...(pressure ? { pressure } : {}), text: `You tried to rob somebody passing and they got away shouting: heat +${o.failHeat} here.`, money: [], scene: { kind: 'rob:fail' } });
  }
  return true; // it heats the place either way
}

/** Digging through the bins: usually nothing or a few dollars, rarely a real find; somebody may see you. */
function bins(cfg, state, at, push, card = {}) {
  const place = state.place;
  const keys = [state.day, state.hour, place];
  state.energy = Math.max(0, state.energy - cfg.energy.perHour);
  const left = drawSupply(cfg, state, place, cfg.street.bins.draws);
  countToday(state, place, 'bins');
  const finds = binsFinds(cfg, place);
  const roll = d100(state, ['run-bins', ...keys]);
  let i = 0;
  for (let acc = 0; i < finds.length - 1; i++) if (roll < (acc += finds[i].pct)) break;
  const pay = payIn(state, finds[i].pay, ['run-bins-pay', ...keys]);
  const find = !pay ? 'nothing' : i === finds.length - 1 ? 'find' : 'little';
  const moved = pay ? [earn(state, pay)] : [];
  // seen: a person of the place's binsSeen role who is there takes it badly (their mood for the day, and their trust);
  // one who is with you looks away
  const s = placeOf(cfg, place).binsSeen;
  let seen = null;
  let away = false;
  let trust = null;
  if (s && d100(state, ['run-bins-seen', ...keys]) < s.pct) {
    const cast = (placeOf(cfg, place).people ?? []).filter(p => p.role === s.role);
    if (cast.length) {
      seen = whoOf(pick(rng(state.seed, 'run-bins-who', ...keys), cast));
      away = trustBand(cfg, trustOf(state, seen.id)) === 'with';
      if (!away) {
        state.people[seen.id] = { out: false, job: null, ...(state.people[seen.id] ?? {}), mood: s.mood };
        trust = moveTrust(cfg, state, seen, cfg.trust.seenBins, 'bins', 'they saw you in the bins');
      }
    }
  }
  const said = !seen ? '' : away ? ` ${cap(seen.name)} saw you and looked away: they are with you.` : ` ${cap(seen.name)} saw you and ${cfg.moods[s.mood]} today.`;
  const pressure = seen && !away ? press(cfg, state, place, cfg.pressure?.bins, 'bins', `${cap(seen.name)} saw you in the bins (day ${state.day})`, seen) : null;
  push(at({ type: 'bins', by: 'you', ...card, roll, find, pay, left, seen, mood: seen && !away ? s.mood : null, ...(seen ? { lookedAway: away } : {}), ...(trust ? { trust } : {}), ...(pressure ? { pressure } : {}), text: `You dug through the bins: ${pay ? `+$${pay}${find === 'find' ? ', a real find' : ''}` : 'nothing'}.${said}`, money: moved, scene: { action: 'rummage' } }));
  return true; // low: anyone against you about here may tell
}

/** Something from the place's shop, paid from what you carry; no hour. */
function buyHere(cfg, state, item, at, push) {
  const place = state.place;
  const it = shopOf(cfg, state).find(x => x.item === item);
  const moved = spend(state, it.price, { from: 'carried', on: 'street' });
  countToday(state, place, item);
  const did = Object.entries(it.gives ?? {}).map(([k, n]) => {
    if (!GIVES[k]) throw new Error(`${it.label}: nothing knows how to give ${k}`);
    return GIVES[k](cfg, state, n);
  });
  const keeper = keeperOf(cfg, place, it.keeper);
  const left = it.perDay ? Math.max(0, it.perDay - (it.bought + 1)) : null;
  // (the day's one count across every food and drink: config `food`)
  const food = isFood(it) ? foodToday(cfg, state) : null;
  const dayText = food?.full ? ` ${cap(cfg.food.full)}.` : '';
  push(at({ type: 'shop', by: 'you', item, price: it.price, gives: { ...(it.gives ?? {}) }, kind: it.kind ?? 'food', keeper, spot: it.spot ?? null, perDay: it.perDay ?? null, left, used: true,
    ...(food ? { food: { eaten: food.eaten, perDay: food.perDay, left: food.left, full: food.full } } : {}),
    text: `You bought ${it.label.toLowerCase()} for $${it.price}${keeper ? ` from ${keeper.name}` : ''}${did.length ? `: ${did.join(', ')}` : ''}.${left !== null ? ` ${left ? `${left} more` : 'No more'} today.` : ''}${dayText}`, money: [moved], scene: { action: 'hand_off' } }));
}

/** The person of a place who keeps an errand (null: nobody named). */
function keeperOf(cfg, place, id) {
  const p = id ? (placeOf(cfg, place).people ?? []).find(x => x.id === id) : null;
  return p ? whoOf(p) : null;
}

/** What a jump (or a night robbed) in a band takes of the goods on you; they are gone. */
function takeGoods(cfg, state, band) {
  const taken = goodsTakes(cfg, state, band);
  for (const [g, n] of Object.entries(taken)) {
    state.goods[g] = goodsOn(state, g) - n;
    if (!state.goods[g]) delete state.goods[g];
  }
  return taken;
}

/** A pack from the connect where you stand, from what you carry; no hour. Dealing with them: their trust moves. */
function buyPack(cfg, state, at, push) {
  const place = state.place;
  const c = connectOf(cfg, state, place);
  const good = cfg.goods[c.good];
  const moved = spend(state, c.price, { from: 'carried', on: 'goods' });
  countToday(state, place, `pack:${c.good}`);
  state.goods[c.good] = goodsOn(state, c.good) + good.sales;
  state.people[c.who.id] = { out: false, job: null, ...(state.people[c.who.id] ?? {}), mood: 'friendly' };
  const trust = moveTrust(cfg, state, c.who, cfg.connect.buy, 'bought', 'you bought from them');
  const left = c.perDay ? c.perDay - c.bought - 1 : null;
  push(at({ type: 'pack', by: 'you', who: c.who, at: place, spot: c.spot, good: c.good, label: good.label, pack: good.pack, price: c.price, basePrice: c.basePrice, off: c.off, sales: good.sales,
    carried: goodsOn(state, c.good), home: goodsHome(state, c.good), left, ...(trust ? { trust } : {}),
    text: `You bought ${good.pack} from ${c.who.name} for $${c.price}${c.off ? ` ($${c.off} off: with you)` : ''}: ${good.sales} sales of ${good.label}. ${goodsOn(state, c.good)} on you.`,
    money: [moved], scene: { action: 'hand_off' } }));
}

/** A thing to wear or for the trailer, from what you carry; no hour. Something to wear goes on if its slot is free. */
function getThing(cfg, state, item, at, push) {
  // (a named thing, or a piece of the library off today's shelf: lib-1, the shelf's keeper selling it)
  const t = thingOf(cfg, item);
  const shelf = t.library ? listChoices(cfg, state).find(c => c.choice.do === 'get' && c.choice.item === item) : null;
  if (shelf) Object.assign(t, { keeper: shelf.keeper, spot: shelf.spot });
  const moved = spend(state, t.price, { from: 'carried', on: 'things' });
  state.things[item] = true;
  const on = t.kind === 'wear' && !state.worn[t.slot];
  if (on) state.worn[t.slot] = item;
  const keeper = keeperOf(cfg, state.place, t.keeper);
  push(at({ type: 'thing', by: 'you', item, label: t.label, kind: t.kind, slot: t.slot ?? null, inTrailer: t.inTrailer ?? null, price: t.price, keeper, spot: t.spot ?? null, worn: on,
    text: `You bought ${t.label} for $${t.price}${keeper ? ` from ${keeper.name}` : ''}${on ? ', and put it on' : t.kind === 'home' ? ': it goes in the trailer' : t.kind === 'ride' ? ': yours to ride' : ''}.`, money: [moved], scene: { action: 'hand_off' } }));
}

/** Put on or take off something you own (at the crib, for nothing). Putting on swaps out what was in the slot. */
function wear(cfg, state, choice, at, push) {
  const t = thingOf(cfg, choice.item);
  const was = state.worn[t.slot] ?? null;
  if (choice.do === 'wear') state.worn[t.slot] = choice.item;
  else delete state.worn[t.slot];
  const off = choice.do === 'wear' && was && was !== choice.item ? was : null;
  push(at({ type: choice.do, by: 'you', item: choice.item, label: t.label, slot: t.slot, replaced: off, worn: { ...state.worn },
    text: choice.do === 'wear' ? `You put on ${t.label}${off ? ` instead of ${thingOf(cfg, off)?.label ?? off}` : ''}.` : `You took off ${t.label}.`, scene: { notice: true } }));
}

/** A night on the street where you stand: much likelier to be robbed than an hour awake, and the next day starts there, low. */
function sleepRough(cfg, state, at, push) {
  const place = state.place;
  const tier = tierOf(cfg, place);
  push(at({ type: 'rough', by: 'you', text: `You slept rough ${placeOf(cfg, place).where ?? `at ${placeOf(cfg, place).label}`}.`, scene: { kind: 'night:sleep' } }));
  const r = rollChance(state, tier.roughPct, ['run-rough', state.day, place]);
  if (r.hit) {
    const contest = jumpContest(cfg, state, place, { asleep: true });
    const roll = contestRoll(state, ['run-rough-contest', state.day, place]);
    const outcome = jumpBand(cfg, contest.P, roll);
    const takes = jumpTakes(cfg, state, state.carried)[outcome];
    const moved = takes ? [lose(state, takes, 'jumped')] : [];
    const goodsTaken = takeGoods(cfg, state, outcome);
    const what = [takes ? `$${takes}` : null, Object.keys(goodsTaken).length ? goodsText(cfg, goodsTaken) : null].filter(Boolean).join(' and ');
    const text = !what && (outcome === 'clean' || outcome === 'messy') ? 'In the night somebody went through your pockets and found nothing.'
      : outcome === 'clean' ? `In the night they robbed you: they took ${what}.`
        : outcome === 'messy' ? `In the night somebody went through your pockets: ${what} gone.`
          : 'Somebody tried your pockets in the night and you woke in time.';
    push(at({ type: 'robbed', by: 'robbers', roll: r.roll, chance: r.chance, contest: { P: contest.P, roll, outcome }, outcome, taken: takes, goodsTaken, goodsLeft: someGoods(state.goods), text, money: moved, scene: { kind: 'night:robbed' } }));
  }
  morning(cfg, state, 'street', push);
}

/** Give the regular at your door what they ask, from banked: they go, friendly, and will be back. */
function give(cfg, state, at, push) {
  const d = state.door;
  if (d.kind === 'due') return payOff(cfg, state, at, push);
  const moved = spend(state, d.wants, { on: 'door' });
  const sold = Math.max(0, soldTo(state, d.id) - cfg.regulars.giveEases);
  state.regulars[d.id] = sold;
  state.people[d.id] = { mood: 'friendly', out: false, job: null };
  state.door = null;
  const who = { id: d.id, name: d.name, role: d.role };
  const trust = moveTrust(cfg, state, who, cfg.trust.give, 'gave', 'you gave them what they asked at your door');
  const pressure = press(cfg, state, homeStreet(cfg), cfg.pressure?.give, 'give', `You gave ${d.name} what they asked at your door`, who);
  push(at({ type: 'gave', by: 'you', who, amount: d.wants, sold, ...(trust ? { trust } : {}), ...(pressure ? { pressure } : {}), text: `You gave ${d.name} $${d.wants}; they go, friendly. They will be back.`, money: [moved], scene: { action: 'hand_off' } }));
}

/** Refuse the regular at your door (shut it, or walk out past them): a fight, or their grudge. Their count starts over. */
function refuse(cfg, state, at, push, how) {
  const d = state.door;
  if (d.kind === 'due') return fightDue(cfg, state, at, push, how);
  const R = cfg.regulars;
  const who = { id: d.id, name: d.name, role: d.role };
  state.door = null;
  state.regulars[d.id] = Math.max(0, soldTo(state, d.id) - (R.refuseEases ?? soldTo(state, d.id)));
  // the refusal is what moves their trust: from neutral, to the bottom (against you); from with you, only to neutral
  const trust = moveTrust(cfg, state, who, cfg.trust.refuse, 'refused', 'you refused them at your door');
  const pressure = press(cfg, state, homeStreet(cfg), cfg.pressure?.refuse, 'refuse', `You shut the door on ${d.name} (day ${state.day})`, who);
  push(at({ type: 'refused', by: 'you', who, how, ...(trust ? { trust } : {}), ...(pressure ? { pressure } : {}), text: how === 'past' ? `You walked out past ${d.name}.` : `You shut the door on ${d.name}.`, scene: how === 'past' ? { action: 'walk', spot: 'door' } : { action: 'shove' } }));
  const r0 = rollChance(state, R.fightPct, ['run-door-fight', state.day, d.id]);
  // (memory-1: one who fears you does not swing at your door)
  const scared = fears(cfg, state, d.id);
  const r = scared ? { ...r0, hit: false } : r0;
  if (r.hit && doorFights(cfg)) {
    // THE FIGHT AT YOUR DOOR (duel-1): a one-on-one, and it decides it. Lost is their win as the contest had it (their
    // clean win while they have more than doorClean percent of their health left, else the scuffle); won, their losing
    const duel = fightOut(cfg, state, who, [state.day, d.id, how]);
    const outcome = duelBand(cfg, duel);
    const hurt = R.hurt[outcome] ?? 0;
    state.energy = Math.max(0, state.energy - hurt);
    state.people[d.id] = { mood: 'sour', out: true, job: null };
    // (memory-1: the fight leaves its mark; lost, every fear you hold on your own street ends)
    const street = homeStreet(cfg);
    const ended = duel.result === 'won' ? [] : breakFears(cfg, state, street, d.id);
    const mark = markPerson(cfg, state, who, duel.result === 'won' ? 'beat' : 'beaten', street, { force: true });
    const text = outcome === 'clean' ? `${cap(d.name)} would not take no and laid into you: energy −${hurt}.`
      : outcome === 'messy' ? `${cap(d.name)} swung at you, a scuffle at your door, and they had the better of it: energy −${hurt}.`
        : `${cap(d.name)} swung at you and you saw them off.`;
    push(at({ type: 'fight', by: d.id, who, roll: r.roll, chance: r.chance, duel, outcome, energyLost: hurt, ...(mark ? { mark } : {}), text, scene: { kind: `fight:${outcome}` } }));
    for (const e of ended) push(at(e));
  } else if (r.hit) {
    // the fight at your door (rules.mjs doorContest: the same one an attempt on your crib is met with)
    const { P } = doorContest(cfg, state, R.strength);
    const roll = contestRoll(state, ['run-door-contest', state.day, d.id]);
    const outcome = jumpBand(cfg, P, roll);
    const hurt = R.hurt[outcome] ?? 0;
    state.energy = Math.max(0, state.energy - hurt);
    state.people[d.id] = { mood: 'sour', out: true, job: null };
    const text = outcome === 'clean' ? `${cap(d.name)} would not take no and laid into you: energy −${hurt}.`
      : outcome === 'messy' ? `${cap(d.name)} swung at you, a scuffle at your door: energy −${hurt}.`
        : `${cap(d.name)} swung at you and you saw them off.`;
    push(at({ type: 'fight', by: d.id, who, roll: r.roll, chance: r.chance, contest: { P, roll, outcome }, outcome, energyLost: hurt, text, scene: { kind: `fight:${outcome}` } }));
  } else if (trustBand(cfg, trustOf(state, d.id)) === 'against') {
    // the grudge: against you (off your table while it lasts), and they call the police on where they live
    const heatNow = heatPlace(cfg, state, d.place, R.grudgeHeat);
    state.people[d.id] = { mood: 'sour', out: true, job: null };
    // (memory-1: the door shut on them is remembered for the week: no sales to them while it lasts)
    const mark = markPerson(cfg, state, who, 'shut', d.place);
    const days = Math.max(offDays(cfg, state, d.id), markOn(cfg, state, d.id)?.kind === 'shut' ? markOn(cfg, state, d.id).left : 0);
    push(at({ type: 'grudge', by: d.id, who, roll: r.roll, chance: r.chance, days, at: d.place, heat: R.grudgeHeat, placeHeat: heatNow, called: true, ...(mark ? { mark } : {}), ...(scared ? { scared: true } : {}),
      ...(state.place === d.place ? {} : { notice: callNotice(cfg, state, d.place) }), // (from your door: you are not standing there)
      text: `${cap(d.name)} ${scared ? 'fears you too much to swing, and ' : ''}goes off cursing you: no sales to them for ${days} day${days > 1 ? 's' : ''}, and the police come round ${placeOf(cfg, d.place).where ?? placeOf(cfg, d.place).label} (heat +${R.grudgeHeat} there).`, scene: { kind: 'say' } }));
  } else {
    // with you before you refused them: sore, no grudge (they go back far enough with you)
    state.people[d.id] = { mood: 'sour', out: true, job: null };
    push(at({ type: 'sore', by: d.id, who, roll: r.roll, chance: r.chance, at: d.place, trustNow: trustOf(state, d.id),
      text: `${cap(d.name)} goes off sore, but holds no grudge: you go back far enough. Not again today.`, scene: { kind: 'say' } }));
  }
}

/** The place notices you: first the police stop (police about, heat here 3 or more), then whoever jumps you. Ends the day if it goes bad. */
function notice(cfg, state, risk, hour, at, push) {
  const where = { hour };
  if (risk.stop.chance > 0) {
    const r = rollChance(state, risk.stop.chance, ['run-stop', state.day, hour]);
    if (r.hit) {
      const seized = state.carried;
      const moved = seized ? [lose(state, seized, 'seized')] : [];
      // every good on you is taken; your heat after jail is higher, and whoever sold you them wants nothing to do with you
      const goodsSeized = someGoods(state.goods);
      state.goods = {};
      const pinched = Object.keys(goodsSeized).length > 0;
      const trusts = pinched ? Object.keys(goodsSeized).map(g => connectFor(cfg, g).who).filter(Boolean)
        .map(who => moveTrust(cfg, state, who, cfg.connect.pinched, 'pinched', 'you were stopped with their goods on you')).filter(Boolean) : [];
      const heatAfter = cfg.heat.afterJail + (pinched ? cfg.connect.stopHeat : 0);
      const took = [seized ? `$${seized}` : null, pinched ? goodsText(cfg, goodsSeized) : null].filter(Boolean).join(' and ');
      push(at({ ...where, type: 'stopped', by: 'police', roll: r.roll, chance: r.chance, seized, goodsSeized, heatAfter, ...(trusts.length ? { trust: trusts[0], trusts } : {}),
        text: `The police stopped you${took ? ` and seized ${took}` : ''}.${pinched ? ` Carrying: your heat after jail is ${heatAfter}.` : ''}`, money: moved, scene: { kind: 'arrest' } }));
      state.heat = heatAfter;
      // they got who they came for: the place they stopped you in is quiet again
      const street = streetOf(cfg, state.place);
      if (street) state.placeHeat = { ...state.placeHeat, [street]: 0 };
      endDay(cfg, state, 'jail', at, push);
      return true;
    }
  }
  if (!risk.jump.chance) return false;
  const r = rollChance(state, risk.jump.chance, ['run-jump', state.day, hour]);
  if (!r.hit) return false;
  // (styles-1) GETTING JUMPED IS A FIGHT YOU WATCH: two at once, what you fight with, fresh or tired as at the start of
  // the hour (the odds shown are the odds fought); the fight decides it: lost, the bad one; won only just, the
  // scuffle; won, nothing. (A test that rigs a contest roll still gets the dice: their bands are the same shares.)
  const fought = jumpsFight(cfg) && !state.rig?.rolls?.length;
  const duel = fought ? jumpOut(cfg, state, state.place, [state.day, hour], { tired: risk.jump.tired ?? null, arm: risk.jump.fight?.arm ?? null }) : null;
  const roll = fought ? null : contestRoll(state, ['run-jump-contest', state.day, hour]);
  const outcome = fought ? duel.band : jumpBand(cfg, risk.jump.strength, roll);
  const takes = jumpTakes(cfg, state, state.carried)[outcome]; // from what you carry now, this hour's pay included
  const moved = takes ? [lose(state, takes, 'jumped')] : [];
  const goodsTaken = takeGoods(cfg, state, outcome);
  const what = [takes ? `$${takes}` : null, Object.keys(goodsTaken).length ? goodsText(cfg, goodsTaken) : null].filter(Boolean).join(' and ');
  const took = what ? `they took ${what}` : 'they found nothing to take';
  const text = fought ? (outcome === 'clean' ? `Two of them jumped you and beat you: ${took}.`
    : outcome === 'messy' ? (duel.result === 'won' ? `Two of them jumped you; you saw them off, only just: ${took}.` : `Two of them jumped you and had the better of it, but you hurt them: ${took} and ran.`)
      : 'Two of them jumped you and you saw them off.')
    : outcome === 'clean' ? `You were jumped, a bad one: ${took}.`
      : outcome === 'messy' ? `You were jumped, a scuffle: ${took}.`
        : 'Somebody tried to jump you and got nothing.';
  push(at({ ...where, type: 'jumped', by: 'jumpers', roll: r.roll, chance: r.chance, ...(fought ? { duel } : { contest: { P: risk.jump.strength, roll, outcome } }), outcome, taken: takes, goodsTaken, goodsLeft: someGoods(state.goods), text, money: moved, scene: { kind: `npc:robbers:${outcome === 'disaster' ? 'fail' : outcome}` } }));
  if (outcome === 'clean') {
    endDay(cfg, state, 'clinic', at, push);
    return true;
  }
  return false;
}

/** A ride on one of the place's links: its hour and energy, the fare from what you carry or the turnstile hopped. */
function ride(cfg, state, choice, at, push) {
  const s = cfg.subway;
  const from = state.place;
  const link = placeOf(cfg, from).links[choice.to];
  const hour = state.hour;
  // the hour you leave is still an hour where you were
  const risk = danger(cfg, state);
  state.energy = Math.max(0, state.energy - (link.energy ?? cfg.energy.perHour));
  state.hour += link.hours ?? s.hours ?? 1;
  if (risk.here && notice(cfg, state, risk, hour, at, push)) return;
  const pay = at({ hour, from, toPlace: choice.to });
  const fare = link.fare ?? s.fare;
  // jumped on the way out and left short of the fare: you can only hop
  const forced = !choice.hop && state.carried < fare;
  if (choice.hop || forced) {
    const r = rollChance(state, s.hopCaughtPct, ['run-hop', state.day, hour]);
    if (r.hit) state.heat = clamp(state.heat + s.hopHeat, 0, cfg.heat.max);
    const said = r.hit ? `hopped the turnstile and were seen: heat +${s.hopHeat}.` : 'hopped the turnstile.';
    push({ ...pay, type: 'hop', by: 'you', roll: r.roll, chance: r.chance, caught: r.hit, heat: r.hit ? s.hopHeat : 0, ...(forced ? { forced: true } : {}),
      text: forced ? `Left with $${state.carried}, short of the fare, you ${said}` : `You ${said}`,
      scene: { ride: 'subway', action: 'run', later: 'turnstile_hop' } });
  } else {
    push({ ...pay, type: 'fare', by: 'you', text: `You paid the $${fare} fare.`, money: [lose(state, fare, 'fares')], scene: { ride: 'subway' } });
  }
  state.place = choice.to;
  state.hoursThere = 0;
  push(at({ type: 'ride', by: 'you', hour, from, text: `You rode the subway to ${placeOf(cfg, choice.to).label}.`, scene: { ride: 'subway' } }));
}

/**
 * Setting out along a route (RUN.md, "Routes"): no fare. The way's energy is paid now; the hour you set out is still
 * an hour where you were (its danger rolls, as the subway's leaving hour does); then the first stop, or the end.
 */
function setOut(cfg, state, way, choice, at, push) {
  const w = cfg.ways[way];
  const from = state.place;
  const r = routesFrom(cfg, from).find(x => x.to === choice.to);
  const hour = state.hour;
  const risk = danger(cfg, state);
  state.energy = Math.max(0, state.energy - w.energy);
  state.hour += w.hours;
  if (risk.here && notice(cfg, state, risk, hour, at, push)) return;
  const by = r.stops.length ? ` by ${r.stops.map(s => placeOf(cfg, s).label).join(', then ')}` : '';
  push(at({ type: 'walk', by: 'you', hour, way, route: r.id, from, toPlace: r.to, via: [...r.stops], energy: w.energy, hours: wayHours(cfg, way, r.stops.length),
    text: `You set out ${w.how} for ${placeOf(cfg, r.to).label}${by}${w.energy ? `: energy −${w.energy}` : ''}.`,
    scene: { ...w.scene, from: placeOf(cfg, from).block ?? null, toward: placeOf(cfg, r.stops[0] ?? r.to).block ?? null } }));
  state.route = { id: r.id, from, to: r.to, way, stops: [...r.stops], at: -1, hand: [] };
  reach(cfg, state, 0, at, push);
}

/** Arrive at the i-th stop of the way (dealt its hand), or, past the last, at the end of it. */
function reach(cfg, state, i, at, push) {
  const R = state.route;
  const w = cfg.ways[R.way];
  const came = placeOf(cfg, i ? R.stops[i - 1] : R.from).block ?? null;
  state.hoursThere = 0;
  if (i < R.stops.length) {
    const stop = R.stops[i];
    const s = placeOf(cfg, stop);
    state.place = stop;
    R.at = i;
    R.hand = dealHand(cfg, state, stop);
    const cards = R.hand.map(id => cardOf(cfg, state, stop, id));
    const next = R.stops[i + 1] ?? R.to;
    push(at({ type: 'stop', by: 'you', stop, spot: s.spot ?? null, hand: [...R.hand], next, toPlace: R.to,
      text: `${cap(s.label)}.${cards.length ? ` Here: ${cards.map(c => c.label.toLowerCase()).join('; ')}.` : ' Nothing for you here today.'} Play one, or go on to ${placeOf(cfg, next).label}.`,
      scene: { ...w.scene, from: came, spot: s.spot ?? 'street' } }));
    return;
  }
  state.place = R.to;
  state.route = null;
  push(at({ type: 'arrive', by: 'you', way: R.way, route: R.id, from: R.from, text: `You ${w.verb} to ${placeOf(cfg, R.to).label}.`, scene: { ...w.scene, from: came } }));
}

/** Go on from a stop: on foot an hour on its ground (its danger rolls, your time there included); on the board no hour. */
function onward(cfg, state, at, push) {
  const R = state.route;
  const w = cfg.ways[R.way];
  const next = R.stops[R.at + 1] ?? R.to;
  const passed = R.hand.map(id => cardOf(cfg, state, state.place, id).label.toLowerCase());
  const hour = state.hour;
  const risk = w.legHours ? danger(cfg, state) : null;
  state.hour += w.legHours;
  push(at({ type: 'onward', by: 'you', hour, passed: [...R.hand], next, hours: w.legHours,
    text: `You went on toward ${placeOf(cfg, next).label}${passed.length ? `, passing by: ${passed.join('; ')}` : ''}.`,
    scene: { ...w.scene, toward: placeOf(cfg, next).block ?? null } }));
  if (risk?.here && notice(cfg, state, risk, hour, at, push)) return;
  reach(cfg, state, R.at + 1, at, push);
}

/** A card from the stop's hand: a job without a person (or the street's bins), an hour and an energy. */
function playCard(cfg, state, id, at, push) {
  const stop = state.place;
  const R = state.route;
  const card = cardOf(cfg, state, stop, id);
  R.hand = R.hand.filter(x => x !== id);
  countToday(state, stop, `card:${id}`);
  if (card.street === 'bins') return bins(cfg, state, at, push, { card: id, label: card.label });
  const odds = jobOdds(cfg, state, card);
  const keys = ['run-card', state.day, state.hour, stop, id];
  const r = odds.pct >= 100 ? { hit: true, roll: null, chance: 100 } : rollChance(state, odds.pct, keys);
  state.energy = Math.max(0, state.energy - cfg.energy.perHour);
  let sold = null;
  if (card.good) {
    state.goods[card.good] = goodsOn(state, card.good) - 1;
    if (!state.goods[card.good]) delete state.goods[card.good];
    sold = { good: card.good, label: cfg.goods[card.good].label, used: 1, left: goodsOn(state, card.good), home: goodsHome(state, card.good) };
  }
  const leftText = sold ? ` ${sold.left ? `${sold.left} left` : `No ${sold.label} left`} on you.` : '';
  const scenes = card.scene ?? {};
  const base = at({ type: 'card', card: id, stop, label: card.label, by: 'you', with: card.with ?? null, roll: r.roll, chance: r.chance, ...(sold ? { goods: sold } : {}) });
  const heat = r.hit ? card.winHeat ?? 0 : card.failHeat ?? 0;
  state.heat = clamp(state.heat + heat, 0, cfg.heat.max);
  const heatNow = heatPlace(cfg, state, stop, heat);
  if (r.hit) {
    const pay = payIn(state, card.pay, ['run-card-pay', ...keys.slice(1)]);
    // (batch-1: a card may pay nothing and cool you, the barber: "heat −1", never "heat +-1")
    const heatWords = heat ? `heat ${heat > 0 ? '+' : '−'}${Math.abs(heat)}` : '';
    push({ ...base, outcome: 'win', pay, heat, placeHeat: heatNow, text: `${card.label}: ${[pay ? `+$${pay}` : null, heatWords || null].filter(Boolean).join(', ') || 'done'}.${leftText}`, money: pay ? [earn(state, pay)] : [], scene: scenes.win ?? { action: 'idle' } });
  } else {
    state.energy = Math.max(0, state.energy - (card.failEnergy ?? 0));
    const cost = [heat ? `heat +${heat}` : null, card.failEnergy ? `energy −${card.failEnergy}` : null].filter(Boolean).join(', ');
    push({ ...base, outcome: 'fail', heat, placeHeat: heatNow, energyLost: card.failEnergy ?? 0, text: `${card.label}: it went wrong${cost ? ` (${cost})` : ''}${sold ? `, and the ${sold.label} went with it` : ''}.${leftText}`, money: [], scene: scenes.fail ?? scenes.win ?? { action: 'idle' } });
  }
  return canHeat(card);
}

/** The day ends somewhere other than home: the clinic or the jail. */
function endDay(cfg, state, where, at, push) {
  push(at({ type: where, by: where === 'jail' ? 'police' : 'jumpers', text: where === 'jail' ? 'The day ends in jail.' : 'You wake in the clinic.', scene: { kind: `held:${where}` } }));
  state.place = Object.keys(cfg.places).find(id => cfg.places[id].held === where) ?? where;
  state.hoursThere = 0;
  state.route = null;
}

/**
 * The next morning: at the crib after home, the clinic or the jail; where you lay after a night on the street. Your
 * own heat cools only after a night at home; every place cools every night. Everyone is calm again, every place's
 * supply refills, and a regular may be at your door.
 */
function morning(cfg, state, night, push) {
  // an attempt due today that has not come yet (or not been settled) comes in the night: home, you meet it at the
  // door; anywhere else, your defences settle it (home-1)
  // (raid-1: the Sixes come for your crib in the night: settled first; lost at home, you wake in the clinic)
  const sx = cfg.sixesRaid ? sixesRaidNight(cfg, state, night, push) : null;
  if (sx?.clinic) night = 'clinic';
  const raid = state.home?.raid;
  let hurtNight = 0;
  if (raid && raid.day === state.day) {
    const dayAt = (extra = {}) => ({ day: state.day, hour: state.hour, place: state.place, block: placeOf(cfg, state.place).block ?? null, to: 'you', ...extra });
    hurtNight = raid.kind === 'crew' ? resolveCrew(cfg, state, night === 'home' ? 'door' : 'away', dayAt, push, { night: true, held: night !== 'home' && night !== 'street' })
      : resolveRaid(cfg, state, night === 'home' ? 'door' : 'away', dayAt, push, { night: true });
  } else if (raid && raid.day < state.day) state.home.raid = null;
  // (memory-1: whoever comes to your door tomorrow has said so by the end of today)
  if (cfg.memory) warnDue(cfg, state, (extra = {}) => ({ day: state.day, hour: state.hour, place: state.place, block: placeOf(cfg, state.place).block ?? null, to: 'you', ...extra }), push);
  const pressed = (state.home?.marks ?? []).some(m => m.day === state.day && m.n > 0);
  if (night === 'home') state.heat = Math.max(0, state.heat - cfg.heat.nightDrop);
  for (const id of Object.keys(state.placeHeat)) state.placeHeat[id] = Math.max(0, state.placeHeat[id] - (tierOf(cfg, id)?.cool ?? 1));
  // (raid-1: a night of gunfire at your door: the heat lands after the night's cooling, on you and on your street)
  if (sx?.heat) {
    state.heat = Math.min(cfg.heat.max, state.heat + sx.heat);
    heatPlace(cfg, state, homeStreet(cfg), sx.heat);
  }
  state.energy = morningEnergy(cfg, state, night);
  state.day += 1;
  state.hour = cfg.start.hour;
  state.hoursThere = 0;
  // a new day: everyone you dealt with yesterday is calm again and nobody is out
  const settled = Object.keys(state.people ?? {});
  state.people = {};
  // trust drifts back toward neutral, so nothing is permanent: bad blood fades a step every night; good will holds
  // while you keep dealing with them, and fades a step after a day you did not
  const drift = [];
  const holds = new Set(settled);
  for (const [id, t] of Object.entries(state.trust ?? {})) {
    if (t > 0 && holds.has(id)) continue;
    const to = t > 0 ? Math.max(0, t - cfg.trust.drift) : Math.min(0, t + cfg.trust.drift);
    if (to) state.trust[id] = to;
    else delete state.trust[id];
    if (to !== t) drift.push({ id, from: t, to });
  }
  state.shifts = Object.fromEntries(Object.keys(cfg.jobs).map(id => [id, 0]));
  state.route = null;
  for (const [id, p] of supplied(cfg)) for (const [what, s] of Object.entries(p.supply ?? {})) {
    state.supply[id] = { ...(state.supply[id] ?? {}), [what]: Math.min(s.max, supplyLeft(cfg, state, id, what) + s.refill) };
  }
  state.today = {};
  for (const id of Object.keys(state.grudges)) if (!grudgeLeft(state, id)) delete state.grudges[id];
  const street = night === 'street';
  const kept = street ? 0 : state.carried;
  const moved = kept ? [bank(state, kept)] : [];
  if (!street) state.place = homeId(cfg);
  const base = { day: state.day, hour: state.hour, place: state.place, block: placeOf(cfg, state.place).block ?? null, to: 'you', by: 'you', night, settled };
  if (night === 'home') push({ ...base, type: 'morning', text: `Day ${state.day}. You wake at the crib with energy ${state.energy}.`, money: moved, scene: { notice: true } });
  else if (street) push({ ...base, type: 'morning', text: `Day ${state.day}. You wake on the street ${placeOf(cfg, state.place).where ?? ''}, energy ${state.energy}${state.carried ? `, carrying $${state.carried}` : ''}.`.replace(' ,', ','), money: [], scene: { notice: true } });
  else push({ ...base, type: 'released', text: `Day ${state.day}. Out of the ${night} and home${kept ? ` with $${kept}, banked` : ''}, energy ${state.energy}.`, money: moved, scene: { kind: `release:${night}` } });
  if (drift.length) pushDrift(cfg, state, base, drift, push);
  // (memory-1: a week's marks that ran out overnight; whoever feared you is due at your door this morning)
  if (cfg.memory) expireMarks(cfg, state, base, push);
  if (!street) atTheDoor(cfg, state, base, push);
  if (hurtNight) state.energy = Math.max(cfg.energy.minMorning, state.energy - hurtNight);
  if (sx?.hurt) state.energy = Math.max(cfg.energy.minMorning, state.energy - sx.hurt);
  homeMorning(cfg, state, base, push, pressed);
  if (cfg.sixes && !cfg.sixes.rest) sixesMorning(cfg, state, base, push);
  if (cfg.sixesRaid && cfg.sixes && !cfg.sixes.rest) sixesRaidMorning(cfg, state, base, push);
}

// ── home pressure (RUN.md, "Home pressure (home-1)") ────────────────────────────────────────────────────────────────
const signedP = n => (n > 0 ? `+${n}` : `−${-n}`);

/**
 * What you did on the home's street moves its pressure: `n` points (below 0: points off the oldest still holding it
 * up). Only on the street your crib opens onto; null elsewhere, or when nothing moved. The note rides on the event that
 * caused it: the meter before and after, the change, why, in words.
 */
function press(cfg, state, place, n, why, text, who = null) {
  const P = cfg.pressure;
  if (!P || !n || place == null || place !== homeStreet(cfg)) return null;
  const from = pressureOf(cfg, state).value;
  const had = (state.home.marks ?? []).reduce((a, m) => a + m.n, 0);
  if (n > 0) {
    state.home.marks = [...(state.home.marks ?? []), { why, text, n, day: state.day, ...(who ? { who: { id: who.id, name: who.name, role: who.role } } : {}) }];
    fadeMarks(state, Math.max(0, had + n - P.max)); // never more held up than the meter's top: the oldest go first
  } else if (!fadeMarks(state, -n)) return null; // (nothing was holding it up)
  const to = pressureOf(cfg, state).value;
  return { from, to, change: to - from, n, why, value: to, max: P.max, warnAt: P.warnAt,
    text: n > 0 ? `Pressure at home ${signedP(n)} (${to} of ${P.max}).` : `Pressure at home ${signedP(n)}: it eases (${to} of ${P.max}).` };
}

/** Take `n` points off the oldest of what you did at home (the night's fade). */
function fadeMarks(state, n) {
  const marks = (state.home.marks ?? []).map(m => ({ ...m }));
  let off = n;
  while (off > 0 && marks.length) {
    const cut = Math.min(off, marks[0].n);
    marks[0].n -= cut;
    off -= cut;
    if (!marks[0].n) marks.shift();
  }
  state.home.marks = marks;
  return n - off;
}

/** What could stop an attempt, as a warning lists it: each thing that defends, the guard, being home. */
function couldDo(cfg, state, kind = 'sneak') {
  const out = [];
  for (const [item, t] of Object.entries(cfg.things ?? {})) {
    if (!t.defends) continue;
    // (sixes-1: only what does a job against this visitor)
    if (t.against && !t.against.includes(kind)) continue;
    const keeper = (placeOf(cfg, t.at).people ?? []).find(p => p.id === t.keeper);
    out.push({ what: 'thing', item, label: t.label, price: t.price, at: t.at, spot: t.spot ?? null, keeper: keeper ? whoOf(keeper) : null, does: t.does, owned: !!state.things?.[item],
      text: state.things?.[item] ? `${cap(t.label)}: yours` : `${cap(t.label)} ($${t.price}${keeper ? `, ${keeper.name}` : ''} ${placeOf(cfg, t.at).where ?? `at ${placeOf(cfg, t.at).label}`}): ${t.does.toLowerCase()}` });
  }
  const g = guardOf(cfg, state);
  if (g) out.push({ what: 'guard', who: g.who, wage: g.wage, price: g.price, days: g.days, until: g.until, on: g.on, available: g.available, why: g.why,
    text: g.on ? `${cap(g.who.name)} is on your step (through day ${g.until})` : g.available ? `Hire ${g.who.name} to ${g.label ?? 'watch your door'}: $${g.price} for ${g.days} days, paid up front (at the crib)` : g.why });
  out.push({ what: 'home', text: kind === 'crew' ? 'Be home that night: you meet them at your door, in a fight' : 'Be home when they come: you meet them at the door' });
  const low = cfg.pressure.warnAt - (cfg.pressure.callOff ?? 1);
  out.push({ what: 'lay low', to: low, text: `Lay low: with the pressure down to ${low} by tomorrow morning, they think better of it` });
  return out;
}

/**
 * The morning at home's end of things: the night's fade of what you did there, the guard's day (his wage, or hurt),
 * and, with the pressure high enough and nothing due and the quiet days after the last attempt gone by, the chance
 * somebody is seen casing your crib: the attempt comes tomorrow.
 */
function homeMorning(cfg, state, base, push, pressed) {
  const P = cfg.pressure;
  if (!P || !homeStreet(cfg)) return;
  state.home = state.home ?? { marks: [], raid: null, last: null, guard: null, raids: [] };
  // what you did fades: a step after a day you added to it, two after a quiet one
  if (state.home.marks?.length) fadeMarks(state, pressed ? P.fade : P.quietFade);
  // (sixes-1) the guard dog is fed every morning from what is banked; unfed mornings in a row and it guards nothing
  const dog = dogOf(cfg, state);
  if (dog) {
    const d = { hungry: 0, ...(state.home.dog ?? {}) };
    if (state.banked >= dog.feed) {
      if (dog.feed) push({ ...base, type: 'dogFed', by: 'you', paid: dog.feed, hungryWas: d.hungry, text: `You fed the dog ($${dog.feed}).`, money: [spend(state, dog.feed, { on: 'dog' })], scene: { notice: true } });
      d.hungry = 0;
    } else {
      d.hungry += 1;
      push({ ...base, type: 'dogFed', by: 'you', paid: 0, hungry: d.hungry, text: d.hungry >= (cfg.dog?.hungryDays ?? 2) ? `Nothing banked to feed the dog: ${d.hungry} days unfed, it sulks on its bed and guards nothing.` : 'Nothing banked to feed the dog today.', money: [], scene: { notice: true } });
    }
    state.home.dog = d;
  }
  // the guard's stretch: past its last day he is gone; on its last day, a notice (keep him on at the crib, or not)
  const G = cfg.guard;
  const g0 = state.home.guard;
  if (g0?.on && G) {
    const until = g0.until ?? state.day - 1; // (a version-7 state's guard: paid through yesterday)
    const g = guardOf(cfg, state);
    const name = g?.who?.name ?? 'Your guard';
    const stretch = { wage: G.price / G.days, price: G.price, days: G.days, until };
    if (state.day > until) {
      state.home.guard = { ...g0, on: false, until: null };
      push({ ...base, type: 'guard', by: G.who, who: g?.who ?? null, on: false, ...stretch, paid: 0, why: 'done', daysLeft: 0,
        text: `${cap(name)}'s ${G.days} days on your step are up: he is back at his truck.${g?.available ? ` Hire him again at the crib ($${G.price} for ${G.days} days).` : ''}`, scene: { notice: true } });
    } else if (state.day === until && g?.on) {
      push({ ...base, type: 'guard', by: G.who, who: g.who, on: true, lastDay: true, ...stretch, paid: 0, daysLeft: 1, canKeep: g.available, why: g.why,
        text: g.available ? `${cap(name)}'s last day on your step: keep him ${G.days} more days for $${G.price} at the crib, or he is gone tomorrow morning.`
          : `${cap(name)}'s last day on your step. ${g.why}: he won't take another stretch, and is gone tomorrow morning.`, scene: { notice: true } });
    }
  }
  // an attempt due today that you laid low enough for: they think better of it
  const due = state.home.raid;
  if (due && due.day === state.day && !due.started) {
    const now = pressureOf(cfg, state);
    if (now.value <= P.warnAt - (P.callOff ?? 1)) {
      state.home.raid = null;
      push({ ...base, type: 'calledOff', by: due.who.id, who: { ...due.who }, at: homeStreet(cfg), day: due.day, pressure: { value: now.value, max: now.max, warnAt: P.warnAt },
        text: `${cap(due.who.name)} thought better of it: the pressure at home is down to ${now.value} of ${now.max}. Nobody comes for your crib today.`, scene: { notice: true } });
      return;
    }
  }
  // the warning
  if (state.home.raid) return;
  // (sixes-1: the camera, `lead`: they are seen casing it that many days sooner; the attempts come no more often, the
  // quiet days counted from the attempt as ever)
  const lead = 1 + (defVal(cfg, state, 'lead') ?? 0);
  const rest = restUntil(cfg, state);
  if (rest !== null && state.day + lead - 1 <= rest) return;
  const p = pressureOf(cfg, state);
  // (sixes-1: from crew.at it is a crew that comes, not a sneak; the dog sign puts a sneak off casing you, `warn`)
  const kind = raidKind(cfg, p.value);
  const base0 = warnChance(cfg, p.value);
  const sign = kind === 'sneak' && base0 ? defVal(cfg, state, 'warn') ?? 0 : 0;
  const chance = Math.max(0, base0 - sign);
  if (!chance) return;
  const r = rollChance(state, chance, ['run-case', state.day]);
  if (!r.hit) return;
  const who = raidCast(cfg, state);
  const R = cfg.raid;
  const raidDay = state.day + lead;
  const hour = payIn(state, R.hours, ['run-raid-hour', state.day + 1]);
  state.home.raid = { who: { id: who.id, name: who.name, role: who.role }, why: who.why, day: raidDay, hour, warned: state.day, started: null, ...(kind === 'crew' ? { kind } : {}) };
  const stake = kind === 'crew' ? crewTakes(cfg, state) : raidTakes(cfg, state);
  const could = couldDo(cfg, state, kind);
  const street = homeStreet(cfg);
  const seen = { grudge: 'with a grudge against you', against: 'who is against you', hooked: 'who wants more from you', stranger: '' }[who.why];
  const when = lead > 1 ? `in ${lead} days (day ${raidDay}: the camera caught them)` : 'tomorrow';
  const told = kind === 'crew'
    ? `${cap(who.name)}${seen ? `, ${seen},` : ''} and a friend were seen looking at your door: a crew of two, coming ${lead > 1 ? `on the night of day ${raidDay} (the camera caught them a day early)` : 'tomorrow night'}. Home, it is a fight at your door; out, they kick it in. At stake: $${stake.home.takes} of the $${stake.banked} you have banked (${stake.home.share}%) if they beat you at your door${stake.share < stake.home.share ? `; $${stake.takes} (${stake.share}%) if you are out` : ''}.`
    : `${cap(who.name)}${seen ? `, ${seen},` : ''} was seen hanging round your crib, looking at the door: they will try it ${when} while you are out. At stake: $${stake.takes} of the $${stake.banked} you have banked (${stake.share}%).`;
  push({ ...base, type: 'casing', by: who.id, who: { id: who.id, name: who.name, role: who.role }, why: who.why, at: street, day: state.day, raidDay, lead, kind, roll: r.roll, chance: r.chance, ...(sign ? { sign } : {}),
    pressure: { value: p.value, max: p.max, reasons: p.reasons.map(x => ({ ...x })) }, stake, could,
    text: `${told} You could: ${could.filter(c => !c.owned && !c.on && c.available !== false).map(c => c.text.replace(/^./, s => s.toLowerCase())).join('; ')}.`,
    scene: { action: 'watch' } });
}

/** (sixes-1) What a crew would take now: crew.share of what is banked, or the safe's crewShare while you are out. */
function crewTakes(cfg, state) {
  const C = cfg.crew;
  const share = defVal(cfg, state, 'crewShare', Math.min) ?? C.share;
  return { banked: state.banked, share, takes: shareTaken(cfg, state, share), home: { share: C.share, takes: shareTaken(cfg, state, C.share) } };
}

/**
 * Hire somebody for your step (at the crib): a stretch of guard.days days from today, guard.price now, from banked. On
 * his last day, the same choice keeps him on: guard.days more from tomorrow, no gap. No refund, no sending him off.
 */
function setGuard(cfg, state, on, at, push) {
  const g = guardOf(cfg, state);
  const G = cfg.guard;
  const was = state.home.guard ?? {};
  const kept = g.on; // (listChoices offers it only on his last day)
  const until = (kept ? g.until : state.day - 1) + G.days;
  const moved = spend(state, G.price, { on: 'guard' });
  state.home.guard = { ...was, on: true, until };
  const stretch = { wage: G.price / G.days, price: G.price, days: G.days, until, daysLeft: until - state.day + 1 };
  push(at({ type: 'guard', by: g.who.id, who: g.who, on: true, kept, ...stretch, paid: G.price, spot: G.spot ?? null,
    text: kept ? `You kept ${g.who.name} on your step ${G.days} more days for $${G.price}: through day ${until}.`
      : `You hired ${g.who.name} for your step: $${G.price} for ${G.days} days, paid now, through day ${until}. While he is there, whoever tries your door has to get past him.`,
    money: [moved], scene: kept ? { action: 'hand_off' } : { action: 'guard', spot: G.spot ?? 'door' } }));
}

/** The ways home from where you stand, as a notice offers them: each with its hours and whether it gets you there in time. */
function waysHome(cfg, state, left) {
  return listChoices(cfg, state).filter(c => c.kind === 'move' && c.home && (c.choice.do === 'subway' || c.what === 'route' || c.what === 'onward'))
    .map(c => ({ label: c.label, choice: c.choice, hours: c.hours, fare: c.fare ?? 0, available: c.available, why: c.why, inTime: c.available && c.hours <= left }));
}

/**
 * An attempt due today. They wait for you to be gone: it starts the first time, from its hour on, that you are away
 * from home (the crib, or the street it opens onto), and a notice reaches you; it is yours to meet at the door if you
 * are home inside the window; past it, or held (the jail, the clinic), your defences settle it. Home all day, they come
 * in the night and you meet them at the door (morning, above).
 */
function homeWatch(cfg, state, at, push) {
  const raid = state.home?.raid;
  if (!raid || raid.day !== state.day) return;
  const held = !!placeOf(cfg, state.place).held;
  const home = atHome(cfg, state);
  // (sixes-1: a crew comes after dark, whoever is in: settled with the night, morning() above)
  if (raid.kind === 'crew') return;
  if (!raid.started) {
    if (held) { resolveRaid(cfg, state, 'away', at, push, { held: true }); return; }
    // they wait for you to be gone: from its hour, the first time you are away from home (home all day: the night)
    if (state.hour < raid.hour || home) return;
    const window = cfg.raid.window;
    raid.started = { at: state.hour, by: state.hour + window };
    const ways = waysHome(cfg, state, window);
    const street = homeStreet(cfg);
    const teller = peopleOf(cfg, state, street).find(p => p.band === 'with' && !p.regular) ?? null;
    const stake = raidTakes(cfg, state);
    const d = defencesOf(cfg, state);
    const g = guardOf(cfg, state);
    const keep = [g?.on ? `${g.who.name} on your step` : null, d.pctBy ? cfg.things[d.pctBy].label : null, d.shareBy ? cfg.things[d.shareBy].label : null].filter(Boolean);
    const fast = ways.filter(w => w.inTime);
    push(at({ type: 'alarm', by: teller?.id ?? raid.who.id, who: { ...raid.who }, teller: teller ? whoOf(teller) : null, at: street, startedAt: state.hour, until: raid.started.by, window, ways, stake,
      defences: { guard: !!g?.on, pct: d.pct, share: d.share, pctBy: d.pctBy, shareBy: d.shareBy },
      text: `${teller ? `${cap(teller.name)} gets word to you` : 'Word reaches you'}: ${raid.who.name} is at your crib's door. Home within ${window} hour${window > 1 ? 's' : ''} and you meet them there${fast.length ? ` (${fast.map(w => `${w.label.split(' (')[0].toLowerCase()}: ${w.hours} hour${w.hours > 1 ? 's' : ''}`).join('; ')})` : ': no way home gets you there in time'}; otherwise ${keep.length ? keep.join(' and ') : 'nothing but the door'} ${keep.length > 1 ? 'decide' : 'decides'} it. At stake: $${stake.takes} of the $${stake.banked} banked.`,
      scene: { action: 'phone' } }));
    return;
  }
  if (home && state.hour <= raid.started.by) { resolveRaid(cfg, state, 'door', at, push); return; }
  if (held || state.hour >= raid.started.by) resolveRaid(cfg, state, 'away', at, push, { held });
}

/**
 * Settle an attempt on your crib. First whoever is on your step (their clean win beats him: hurt, off for days); then,
 * home, the fight at your door (their clean win: in, and you are hurt; a scuffle: half of it); away, the door (the
 * chance it works, lowered by a deadbolt). A success takes a share of what is banked, never all of it, never goods
 * or things. Returns the energy you lost at the door (for a night's attempt, taken off the morning).
 */
function resolveRaid(cfg, state, how, at, push, { night = false, held = false } = {}) {
  const H = state.home;
  const raid = H.raid;
  const R = cfg.raid;
  const who = { ...raid.who };
  const keys = [raid.day, who.id];
  const d = defencesOf(cfg, state);
  const before = state.banked;
  const street = homeStreet(cfg);
  const g = guardOf(cfg, state);
  const parts = [];
  let taken = 0, gotIn = false, by = how, guard = null, fight = null, roll = null, energyLost = 0, scene = null;
  // (sixes-1: the guard dog, home and fed: a sneak who comes while you are out and hears it gives up `sneakOff` of the time)
  const dog = dogOf(cfg, state);
  if (how === 'away' && !g?.on && dog?.works) {
    const r = rollChance(state, dog.off, ['run-raid-dog', ...keys]);
    if (r.hit) {
      H.raids = [...(H.raids ?? []), { day: raid.day, who, how: 'dog', outcome: 'held', taken: 0 }];
      H.last = raid.day;
      H.raid = null;
      push(at({ type: 'raid', by: who.id, who, why: raid.why ?? null, at: street, how: 'dog', outcome: 'held', gotIn: false, taken: 0, share: d.share, banked: before, bankedAfter: state.banked, night, held,
        hour: raid.started?.at ?? raid.hour, guard: null, fight: null, roll: r.roll, chance: r.chance, defences: { pct: d.pct, share: d.share, pctBy: d.pctBy, shareBy: d.shareBy, dog: true },
        text: `${cap(who.name)} came for your crib${night ? ' in the night' : ''}. The dog heard them and barked the lane awake: they gave up. Nothing taken.`, money: [], scene: { action: 'watch', dog: true } }));
      return 0;
    }
  }
  if (g?.on) {
    const r = contestRoll(state, ['run-raid-guard', ...keys]);
    const band = jumpBand(cfg, g.P, r);
    const beaten = band === 'clean';
    // (beaten, what was left of his stretch after today is lost)
    const lostDays = beaten ? g.until - raid.day : 0;
    guard = { who: g.who, P: g.P, roll: r, outcome: band, beaten, hurtDays: beaten ? cfg.guard.hurtDays : 0, until: g.until, lostDays };
    if (beaten) {
      H.guard = { ...(H.guard ?? {}), on: false, until: null, hurt: raid.day + cfg.guard.hurtDays };
      parts.push(`They beat ${g.who.name} on your step (he is hurt: off ${cfg.guard.hurtDays} days${lostDays ? `; the ${lostDays} day${lostDays > 1 ? 's' : ''} left of his stretch ${lostDays > 1 ? 'are' : 'is'} lost` : ''})`);
    } else {
      by = 'guard';
      parts.push(`${cap(g.who.name)} was on your step and saw them off`);
      scene = { action: 'guard', spot: cfg.guard.spot ?? 'door' };
    }
  }
  if (by !== 'guard') {
    if (how === 'door') {
      const c = doorContest(cfg, state);
      const r = contestRoll(state, ['run-raid-door', ...keys]);
      const band = jumpBand(cfg, c.P, r);
      energyLost = R.hurt[band] ?? 0;
      fight = { P: c.P, roll: r, outcome: band, energyLost, why: c.why };
      const t = raidTakes(cfg, state);
      gotIn = band === 'clean' || band === 'messy';
      taken = band === 'clean' ? t.takes : band === 'messy' ? t.scuffle : 0;
      parts.push(band === 'clean' ? `You met them at your door and they laid into you (energy −${energyLost}) and got in`
        : band === 'messy' ? `A scuffle at your door (energy −${energyLost}): they grabbed what they could and ran`
          : 'You met them at your door and saw them off');
      scene = { kind: `fight:${band}` };
    } else {
      const r = rollChance(state, d.pct, ['run-raid', ...keys]);
      roll = { roll: r.roll, chance: r.chance };
      gotIn = r.hit;
      taken = r.hit ? raidTakes(cfg, state).takes : 0;
      parts.push(r.hit ? `They got in while you were ${held ? `in ${placeOf(cfg, state.place).label}` : 'out'}`
        : `They tried the door while you were ${held ? `in ${placeOf(cfg, state.place).label}` : 'out'} and could not get in${d.pctBy ? ` (${cfg.things[d.pctBy].label} held)` : ''}`);
      scene = { kind: r.hit ? 'breakin:clean' : 'breakin:fail' };
    }
    if (how === 'door' && !night) state.energy = Math.max(0, state.energy - energyLost);
  }
  const moved = taken ? [burgle(state, taken)] : [];
  const share = d.share;
  const took = !gotIn ? 'Nothing taken.' : taken ? `They took $${taken} of the $${before} you had banked (${fight?.outcome === 'messy' ? `half of ${share}%` : `${share}%`})${d.shareBy ? `: the rest was in ${cfg.things[d.shareBy].label}` : ''}.` : 'They found nothing banked to take.';
  const outcome = taken ? 'taken' : 'held';
  H.raids = [...(H.raids ?? []), { day: raid.day, who, how: by, outcome, taken }];
  H.last = raid.day;
  H.raid = null;
  push(at({ type: 'raid', by: who.id, who, why: raid.why ?? null, at: street, how: by, outcome, gotIn, taken, share, banked: before, bankedAfter: state.banked, night, held,
    hour: raid.started?.at ?? raid.hour, guard, fight, ...(roll ? roll : {}), defences: { pct: d.pct, share: d.share, pctBy: d.pctBy, shareBy: d.shareBy },
    text: `${cap(who.name)} came for your crib${night ? ' in the night' : ''}. ${parts.join('. ')}. ${took}`, money: moved, scene }));
  return night && how === 'door' ? energyLost : 0;
}

/** The morning's drift as one event: everyone whose trust moved back toward neutral overnight, by name. */
function pushDrift(cfg, state, base, drift, push) {
  const people = Object.values(cfg.people).flat();
  const changes = drift.map(({ id, from, to }) => {
    const p = people.find(x => x.id === id) ?? { id, name: id, role: null };
    return trustNote(cfg, state, whoOf(p), from, to, 'drift', 'time passed');
  });
  const turned = changes.filter(c => c.band !== c.bandWas);
  const text = turned.length
    ? `Overnight: ${turned.map(c => `${cap(c.who.name)} ${c.bandWas === 'against' ? 'will deal with you again' : 'is no longer with you'}`).join('; ')}.`
    : `Overnight, ${changes.length === 1 ? `${changes[0].who.name}'s trust` : `${changes.length} people's trust`} drifted a step back toward neutral.`;
  push({ ...base, type: 'drift', by: 'time', changes, text, scene: { notice: true } });
}

/**
 * This morning's visit to your door (memory-1: ONE A MORNING). Who wants to come: anyone due (somebody who feared
 * you, come for another go) or still waiting from a morning the door was taken, and a regular you have leaned on, who
 * may turn up wanting more. The earliest due goes first (at a tie, whoever was due before this morning's roll); the
 * others wait a day, and say so.
 */
function atTheDoor(cfg, state, base, push) {
  const queued = (state.visits ?? []).filter(x => x.due <= state.day)
    // (a regular who has turned against you since does not come asking)
    .filter(x => x.kind !== 'regular' || !offDays(cfg, state, x.id));
  const waiting = new Set(queued.map(x => x.id));
  const rolled = [];
  for (const r of regularsOf(cfg)) {
    if (waiting.has(r.id)) continue; // (already coming)
    if (offDays(cfg, state, r.id)) continue; // against you: they do not come asking
    const sold = soldTo(state, r.id);
    const chance = doorChance(cfg, sold);
    if (!chance) continue;
    const roll = rollChance(state, chance, ['run-door', state.day, r.id]);
    if (!roll.hit) continue;
    const more = (cfg.regulars.wantsUp ?? 0) * (sold - cfg.regulars.doorAt); // the more hooked, the more they want
    const wants = payIn(state, cfg.regulars.wants.map(x => x + more), ['run-door-wants', state.day, r.id]);
    rolled.push({ kind: 'regular', id: r.id, name: r.name, role: r.role, place: r.place, wants, due: state.day, sold, roll: roll.roll, chance: roll.chance });
    break;
  }
  state.visits = (state.visits ?? []).filter(x => x.due > state.day);
  const all = [...queued.map((x, i) => ({ x, i })), ...rolled.map((x, i) => ({ x, i: queued.length + i }))].sort((a, b) => a.x.due - b.x.due || a.i - b.i).map(o => o.x);
  if (!all.length) return;
  const [first, ...later] = all;
  for (const x of later) {
    state.visits.push({ ...x });
    push({ ...base, type: 'coming', by: x.id, who: { id: x.id, name: x.name, role: x.role }, visit: x.kind, on: state.day + 1, waited: true, money: [],
      text: `${cap(x.name)} came by your door too, but ${first.name} was there first: ${x.kind === 'due' ? 'back tomorrow for another go' : 'back tomorrow wanting more'}.`, scene: { notice: true } });
  }
  const who = { id: first.id, name: first.name, role: first.role };
  if (first.kind === 'due') {
    const D = cfg.memory.due;
    // (styles-1: from somebody not of your street, or who keeps a shop or a stall, it is somebody they sent)
    const sent = sentFor(cfg, state, who);
    state.door = { kind: 'due', id: first.id, name: first.name, role: first.role, place: first.place, wants: D.price, tougher: D.tougher, since: first.since ?? null, due: first.due, ...(sent ? { sent } : {}) };
    const them = sent ? 'him' : pronounsOf(cfg, first.id).them;
    push({ ...base, type: 'door', by: first.id, who, due: true, wants: D.price, since: first.since ?? null, ...(first.due < state.day ? { waited: true } : {}), ...(sent ? { sent } : {}), money: [],
      text: sent ? `${cap(first.name)} sent somebody round for another go: ${sent.says}. Pay him $${D.price} to call it square, or fight him: rested and ready, tougher than ${first.name}.`
        : `${cap(first.name)} is at your door for another go. Pay ${them} $${D.price} to call it square, or fight ${them}: rested and ready, tougher than before.`, scene: { action: 'talk' } });
    return;
  }
  state.door = { id: first.id, name: first.name, role: first.role, place: first.place, wants: first.wants };
  push({ ...base, type: 'door', by: first.id, who, wants: first.wants, sold: first.sold ?? soldTo(state, first.id), ...(first.roll !== undefined ? { roll: first.roll, chance: first.chance } : { waited: true }), money: [],
    text: `${cap(first.name)} is at your door wanting more: they ask for $${first.wants}.`, scene: { action: 'crave' } });
}

// ── people remember (memory-1, RUN.md "People remember"; config.mjs `memory`) ───────────────────────────────────────
/**
 * A BIG act leaves a mark on a person for the week: `kind` (config memory.kinds), made today at `place`. One a person:
 * `force` (a fight, won or lost) always makes it anew; anything else only when they hold none. A visit of theirs still
 * waiting is off. Returns the note the event carries ({ who, kind, day, until, left, fear, did, words, text }), or null.
 */
function markPerson(cfg, state, who, kind, place, { force = false } = {}) {
  const M = cfg.memory;
  if (!M?.kinds?.[kind] || !who) return null;
  if (!force && markOn(cfg, state, who.id)) return null;
  state.marks = { ...(state.marks ?? {}), [who.id]: { kind, day: state.day, place, who: { id: who.id, name: who.name, role: who.role } } };
  state.visits = (state.visits ?? []).filter(x => !(x.kind === 'due' && x.id === who.id));
  return markNote(cfg, state, markOn(cfg, state, who.id));
}
function markNote(cfg, state, m) {
  const did = markWords(cfg, state, m.did, m);
  const words = markWords(cfg, state, m.words, m);
  return { who: { ...m.who }, kind: m.kind, day: m.day, until: m.day + cfg.memory.days - 1, left: m.left, fear: !!m.fear, hates: !!m.hates, holds: !!m.holds,
    ...(m.comesDue ? { due: m.day + cfg.memory.days } : {}), did, words, text: `${did} · ${words}` };
}

/** You lost a fight at `place`: every fear its people hold of you ends at once (the winner's own mark is made after). */
function breakFears(cfg, state, place, winner) {
  const out = [];
  for (const id of Object.keys(state.marks ?? {})) {
    const m = markOn(cfg, state, id);
    if (!m?.fear || m.place !== place) continue;
    delete state.marks[id];
    out.push({ type: 'markEnd', by: id, who: { ...m.who }, kind: m.kind, why: 'broken', beatBy: winner, money: [],
      text: `${markWords(cfg, state, m.gone, m)}: they saw you beaten.`, scene: { notice: true } });
  }
  return out;
}

/** Overnight: marks that ran out end (said), and whoever feared you is due at your door this morning, for another go. */
function expireMarks(cfg, state, base, push) {
  const M = cfg.memory;
  for (const [id, m] of Object.entries(state.marks ?? {})) {
    if (m.day + M.days > state.day) continue;
    delete state.marks[id];
    const k = M.kinds[m.kind] ?? {};
    const due = !!k.comesDue && !!k.fear;
    if (due) state.visits = [...(state.visits ?? []).filter(x => x.id !== id), { kind: 'due', id, name: m.who.name, role: m.who.role, place: m.place, due: state.day, since: m.day }];
    push({ ...base, type: 'markEnd', by: id, who: { ...m.who }, kind: m.kind, why: 'ran out', since: m.day, ...(due ? { comesDue: true } : {}), money: [],
      text: `${markWords(cfg, state, k.gone ?? '{Name} has let it go', { ...m, left: 0 })}.`, scene: { notice: true } });
  }
}

/** The evening before: whoever is due at your door tomorrow says so (once). */
function warnDue(cfg, state, at, push) {
  const M = cfg.memory;
  for (const [id, m] of Object.entries(state.marks ?? {})) {
    const k = M.kinds[m.kind] ?? {};
    if (!k.comesDue || !k.fear || m.warned || m.day + M.days !== state.day + 1) continue;
    state.marks[id] = { ...m, warned: true };
    const pr = pronounsOf(cfg, id);
    const sent = sentFor(cfg, state, m.who);
    push(at({ type: 'coming', by: id, who: { ...m.who }, visit: 'due', on: state.day + 1, since: m.day, price: M.due.price, ...(sent ? { sent } : {}), money: [],
      text: sent ? `${cap(m.who.name)} is sending somebody round tomorrow: another go at your door, unless you pay $${M.due.price} to call it square.`
        : `${cap(m.who.name)} says ${pr.they === 'they' ? 'they are' : `${pr.they} is`} coming by tomorrow: another go at your door, unless you pay ${pr.them} $${M.due.price} to call it square.`, scene: { notice: true } }));
  }
}

/** Pay off whoever came due at your door: from banked, no fight, no mark. */
function payOff(cfg, state, at, push) {
  const d = state.door;
  const who = { id: d.id, name: d.name, role: d.role };
  const moved = spend(state, d.wants, { on: 'door' });
  state.door = null;
  state.people[d.id] = { mood: 'sour', out: true, job: null };
  push(at({ type: 'gave', by: 'you', who, due: true, amount: d.wants, paidOff: true, ...(d.sent ? { sent: d.sent } : {}),
    text: d.sent ? `You paid the one ${d.name} sent $${d.wants} to call it square. He goes.` : `You paid ${d.name} $${d.wants} to call it square. ${cap(pronounsOf(cfg, d.id).they === 'they' ? 'they go' : `${pronounsOf(cfg, d.id).they} goes`)}.`, money: [moved], scene: { action: 'hand_off' } }));
}

/**
 * Fight whoever came due at your door (refused the pay-off, or walked out or slept past them): one-on-one, them rested
 * and ready (toughness + due.tougher). Won: they fear you another week (and come due again). Lost: their win as the
 * regular's at the door (regulars.hurt by the band), every fear you hold on your own street ends, and they hold it.
 */
function fightDue(cfg, state, at, push, how) {
  const d = state.door;
  const who = { id: d.id, name: d.name, role: d.role };
  state.door = null;
  // (styles-1: somebody they sent fights as his own style, at their toughness and the same + tougher)
  const fighter = d.sent ? { ...who, name: d.sent.name, style: d.sent.style } : who;
  const duel = fightOut(cfg, state, fighter, ['due', state.day, d.id, how], state.energy, d.tougher ?? cfg.memory.due.tougher);
  const outcome = duelBand(cfg, duel);
  const hurt = cfg.regulars.hurt[outcome] ?? 0;
  state.energy = Math.max(0, state.energy - hurt);
  state.people[d.id] = { mood: 'sour', out: true, job: null };
  const street = homeStreet(cfg);
  const won = duel.result === 'won';
  const ended = won ? [] : breakFears(cfg, state, street, d.id);
  const mark = markPerson(cfg, state, who, won ? 'beat' : 'beaten', d.place ?? street, { force: true });
  const name = d.sent ? cap(d.sent.name) : cap(d.name);
  const text = won ? `${name} came for another go and you beat ${d.sent ? 'him' : `${pronounsOf(cfg, d.id).them} again`}.`
    : outcome === 'clean' ? `${name} came for another go and laid into you: energy −${hurt}.` : `${name} came for another go and had the better of a scuffle at your door: energy −${hurt}.`;
  push(at({ type: 'fight', by: d.id, who, due: true, how, duel, outcome, energyLost: hurt, ...(d.sent ? { sent: d.sent } : {}), ...(mark ? { mark } : {}), text: `${text}${mark ? ` ${cap(mark.text)}.` : ''}`, scene: { kind: `fight:${outcome}` } }));
  for (const e of ended) push(at(e));
}

// ── styles-1: a punch style learned, and what you fight with ─────────────────────────────────────────────────────────
/** A punch style learned where it is taught, from what you carry, kept for the run; no hour. What you fight with is not changed. */
function learn(cfg, state, style, at, push) {
  const t = taughtAt(cfg, style);
  const moved = spend(state, t.price, { from: 'carried', on: 'lessons' });
  state.styles = { ...(state.styles ?? {}), [style]: true };
  push(at({ type: 'lesson', by: 'you', style, label: cfg.styles[style].label, price: t.price, keeper: t.keeper, spot: t.spot,
    text: `${t.keeper ? cap(t.keeper.name) : 'Somebody'} showed you ${cfg.styles[style].label} for $${t.price}. It's yours: fight with it from You, any time.`, money: [moved], scene: { action: 'hand_off' } }));
}

/** What you fight with, one-on-one and jumped: one of what you own (bare hands, a style you know, the box cutter); no hour. */
function fightWith(cfg, state, arm, at, push) {
  const was = armOf(cfg, state);
  state.fightWith = arm;
  push(at({ type: 'fightWith', by: 'you', arm, was, label: armLabel(cfg, arm), text: `You'll fight with ${armLabel(cfg, arm)}${was !== arm ? ` (not ${armLabel(cfg, was)})` : ''}.`, money: [], scene: { notice: true } }));
}

// ── sixes-1: the first slice (RUN.md "The Sixes and a home that scales: the first slice") ─────────────────────────
/**
 * A CREW THAT KICKS THE DOOR, in the night. Home: the door fight you watch (rules.mjs crewOut: you with what you fight
 * with, at the health a night's sleep gives; Earl beside you if he is on, told his way; the door bar's head start; the
 * dog shut in the back). Won: they run (energy crew.hurt.won off the morning). Lost: they are in (crew.hurt.lost), and
 * they make you open the safe: crew.share of what is banked. Earl down in it: off guard.doorHurtDays, his stretch goes
 * on. Away for the night: Earl on the step first (the contest at crew.strength less his), then the door: a kick,
 * crew.kickPct (the chain and locks: `kick`); in, crew.share (the safe: `crewShare`). Half the goods at the crib go
 * with them either way they get in (crew.stockPct). Never all of it. Returns the energy lost at the door.
 */
function resolveCrew(cfg, state, how, at, push, { night = true, held = false } = {}) {
  const H = state.home;
  const raid = H.raid;
  const C = cfg.crew;
  const who = { ...raid.who };
  const keys = [raid.day, who.id];
  const before = state.banked;
  const street = homeStreet(cfg);
  const g = guardOf(cfg, state);
  let gotIn = false, by = how, duel = null, guard = null, roll = null, energyLost = 0, share = C.share, shareBy = null;
  if (how === 'door') {
    duel = crewOut(cfg, state, keys);
    gotIn = duel.result !== 'won';
    energyLost = gotIn ? C.hurt.lost : C.hurt.won;
    if (duel.earl?.down) {
      // (down in a door fight: off the next day, and his stretch goes on when he is up)
      H.guard = { ...(H.guard ?? {}), hurt: raid.day + (cfg.guard.doorHurtDays ?? 1) };
      guard = { who: g.who, beaten: true, door: true, hurtDays: cfg.guard.doorHurtDays ?? 1, until: g.until, lostDays: 0 };
    } else if (duel.earl) guard = { who: g.who, beaten: false, door: true, hurtDays: 0, until: g.until, lostDays: 0 };
  } else {
    if (g?.on) {
      const P = clamp(C.strength - cfg.guard.strength, cfg.contest.min, cfg.contest.max);
      const r = contestRoll(state, ['run-raid-guard', ...keys]);
      const band = jumpBand(cfg, P, r);
      const beaten = band === 'clean';
      const lostDays = beaten ? g.until - raid.day : 0;
      guard = { who: g.who, P, roll: r, outcome: band, beaten, hurtDays: beaten ? cfg.guard.hurtDays : 0, until: g.until, lostDays };
      if (beaten) H.guard = { ...(H.guard ?? {}), on: false, until: null, hurt: raid.day + cfg.guard.hurtDays };
      else by = 'guard';
    }
    if (by !== 'guard') {
      const pct = defVal(cfg, state, 'kick', Math.min) ?? C.kickPct;
      const r = rollChance(state, pct, ['run-raid', ...keys]);
      roll = { roll: r.roll, chance: r.chance, kickBy: defBy(cfg, state, 'kick', Math.min) };
      gotIn = r.hit;
      const safe = defVal(cfg, state, 'crewShare', Math.min);
      if (safe != null) {
        share = safe;
        shareBy = defBy(cfg, state, 'crewShare', Math.min);
      }
    }
  }
  // (raid-1: the cereal box's cash is never found; the false wall keeps the goods)
  const taken = gotIn ? shareTaken(cfg, state, share) : 0;
  const goodsTaken = {};
  if (gotIn && C.stockPct && !hiddenOf(cfg, state).goods) {
    for (const [gd, n] of Object.entries(state.stash ?? {})) {
      const k = Math.floor((n * C.stockPct) / 100);
      if (k > 0) {
        goodsTaken[gd] = k;
        state.stash[gd] = n - k;
        if (!state.stash[gd]) delete state.stash[gd];
      }
    }
  }
  const moved = taken ? [burgle(state, taken)] : [];
  const outcome = taken || Object.keys(goodsTaken).length ? 'taken' : 'held';
  H.raids = [...(H.raids ?? []), { day: raid.day, who, how: by, outcome, taken, kind: 'crew' }];
  H.last = raid.day;
  H.raid = null;
  const name = `${cap(who.name)} and a friend`;
  const parts = [];
  if (duel) {
    parts.push(duel.result === 'won' ? `You met them at your door and saw them off (energy −${energyLost})` : `They beat you at your door and got in (energy −${energyLost}); they made you open ${shareFrom(cfg, state)}`);
    if (guard?.beaten) parts.push(`${cap(g.who.name)} went down in it: off tomorrow, back on your step the day after`);
  } else if (by === 'guard') parts.push(`${cap(g.who.name)} was on your step and saw them off`);
  else {
    if (guard?.beaten) parts.push(`They beat ${g.who.name} on your step (he is hurt: off ${cfg.guard.hurtDays} days${guard.lostDays ? `; the ${guard.lostDays} day${guard.lostDays > 1 ? 's' : ''} left of his stretch ${guard.lostDays > 1 ? 'are' : 'is'} lost` : ''})`);
    parts.push(gotIn ? `They kicked your door in while you were ${held ? `in ${placeOf(cfg, state.place).label}` : 'out'}` : `They kicked at your door while you were ${held ? `in ${placeOf(cfg, state.place).label}` : 'out'} and it held${roll?.kickBy ? ` (${cfg.things[roll.kickBy].label})` : ''}`);
  }
  const gw = Object.keys(goodsTaken).length ? ` and ${goodsText(cfg, goodsTaken)}` : '';
  const took = !gotIn ? 'Nothing taken.' : taken || gw ? `They took $${taken}${gw} (${share}% of the $${before} banked${shareBy ? `: the rest was in ${cfg.things[shareBy].label}` : ''}).` : 'They found nothing banked to take.';
  push(at({ type: 'raid', by: who.id, who, why: raid.why ?? null, kind: 'crew', at: street, how: by, outcome, gotIn, taken, goodsTaken, share, shareBy, banked: before, bankedAfter: state.banked, night, held,
    guard, ...(duel ? { duel, fight: { result: duel.result, energyLost } } : { fight: null }), ...(roll ? roll : {}), energyLost,
    text: `Last night ${who.name} and a friend came for your crib. ${parts.join('. ')}. ${took}`, money: moved,
    scene: duel ? { kind: duel.result === 'won' ? 'fight:fail' : 'fight:clean', crew: true } : gotIn ? { kind: 'breakin:clean' } : { kind: 'breakin:fail' } }));
  return how === 'door' ? energyLost : 0;
}
/** Where the money comes from when they make you open it: the safe if you own one, else the floorboard. */
const shareFrom = (cfg, state) => (defBy(cfg, state, 'crewShare', Math.min) ? `your ${cfg.things[defBy(cfg, state, 'crewShare', Math.min)].label.replace(/^an? /, '')}` : 'the floorboard');

/** Tell Cousin Earl how to fight at your door (a way of guard.ways); no hour. */
function tellEarl(cfg, state, way, at, push) {
  const was = earlWayOf(cfg, state);
  state.earlWay = way;
  const W = earlWayWords(way);
  push(at({ type: 'earlWay', by: 'you', way, was, name: W.name, says: W.says, text: `You told Cousin Earl how to fight at your door: ${W.name} (${W.says}).`, money: [], scene: { action: 'talk' } }));
}

// ── the Sixes' meter ──
const signedS = n => (n > 0 ? `+${n}` : `−${-n}`);
/** The Sixes' state on the run, made if missing (an older state). */
function sixesHere(state) {
  state.sixes = sixesStateOf(state);
  state.sixes.marks = state.sixes.marks.map(m => ({ ...m }));
  return state.sixes;
}
/** `n` points on the meter for `why` (kept at its cap: the oldest go first); the note an event carries. */
function sixesRaise(cfg, state, n, why, text) {
  const X = cfg.sixes;
  const s = sixesHere(state);
  const from = sixesOf(cfg, state).value;
  s.marks.push({ why, text, n, day: state.day });
  let over = s.marks.reduce((a, m) => a + m.n, 0) - (X.cap ?? X.max);
  while (over > 0 && s.marks.length) {
    const cut = Math.min(over, s.marks[0].n);
    s.marks[0].n -= cut;
    over -= cut;
    if (!s.marks[0].n) s.marks.shift();
  }
  const to = sixesOf(cfg, state).value;
  return { from, to, change: to - from, n, why, value: to, max: X.max, cap: X.cap ?? X.max, text: `The Sixes ${signedS(n)} (${to} of ${X.max}${to >= (X.cap ?? X.max) && to < X.max ? ', as high as it goes for now' : ''}).` };
}
/** `n` points off the oldest; `alsoToday`: and today's marks of that kind. */
function sixesEase(cfg, state, n, alsoToday = null) {
  const s = sixesHere(state);
  const from = sixesOf(cfg, state).value;
  if (alsoToday) s.marks = s.marks.filter(m => !(m.why === alsoToday && m.day === state.day));
  let off = n;
  while (off > 0 && s.marks.length) {
    const cut = Math.min(off, s.marks[0].n);
    s.marks[0].n -= cut;
    off -= cut;
    if (!s.marks[0].n) s.marks.shift();
  }
  const to = sixesOf(cfg, state).value;
  return { from, to, change: to - from, value: to, max: cfg.sixes.max };
}
/**
 * A job on their ground: what it adds to the meter (a sale once a day, a grab), what you made there today, and
 * Dutch's word the first time the meter is at `word` or more. → { note, then: [events] }.
 */
function sixesWork(cfg, state, place, job, pay, label) {
  const out = { note: null, then: [] };
  if (!sixesGround(cfg, place)) return out;
  const X = cfg.sixes;
  const s = sixesHere(state);
  if (s.madeDay !== state.day) {
    s.madeDay = state.day;
    s.made = 0;
  }
  s.made += pay ?? 0;
  const n = sixesJob(cfg, state, job, place);
  if (!n) return out;
  s.did = state.day;
  const why = (X.grabs ?? []).includes(job.id) ? 'grab' : 'sell';
  out.note = sixesRaise(cfg, state, n, why, `${label} at their market (day ${state.day})`);
  const v = out.note.value;
  if (v >= X.word && !s.word) {
    s.word = state.day;
    const D = personOf(cfg, X.dutch);
    out.then.push({ type: 'sixes', what: 'word', by: X.dutch, who: D ? whoOf(D) : null, value: v, max: X.max, at: place, raised: { why, n, text: out.note.text }, next: { at: X.tax, what: 'the tax' }, money: [],
      text: `${D?.name ?? 'Dutch'} stops you by the stalls: "Nice ${why === 'grab' ? 'grab' : 'stall work'}. Shame if it turned into till work." Nothing is taken. The Sixes think this market is theirs (${v} of ${X.max}). At ${X.tax} they will want a cut of what you make here.`,
      scene: { action: 'talk' } });
  }
  return out;
}
/**
 * The morning: a day with nothing done on their ground eases it (`quietFade`); under `word` she will have a word again
 * the next time; a jump due yesterday that never came is off; and at `jump` or more (nobody of the two afraid of you),
 * the warning: they will be waiting by the subway steps at the market tomorrow.
 */
function sixesMorning(cfg, state, base, push) {
  const X = cfg.sixes;
  const s = sixesHere(state);
  const yesterday = state.day - 1;
  const was = sixesOf(cfg, state).value;
  if (s.did !== yesterday && s.marks.length) {
    const e = sixesEase(cfg, state, X.quietFade);
    if (e.change) push({ ...base, type: 'sixes', what: 'ease', by: 'time', from: was, value: e.value, max: X.max, money: [], text: `A day off their market: the Sixes ease off a step (${e.value} of ${X.max}).`, scene: { notice: true } });
  }
  const now = sixesOf(cfg, state);
  if (now.value < X.word) s.word = null;
  if (s.madeDay !== state.day) {
    s.madeDay = state.day;
    s.made = 0;
  }
  if (s.tax && s.tax.day < state.day) s.tax = null;
  if (s.jump && s.jump.day < state.day) {
    push({ ...base, type: 'sixes', what: 'jumpOff', by: 'sixes', day: s.jump.day, value: now.value, max: X.max, money: [], text: 'You stayed off their market: the two who waited for you on the kerb went home.', scene: { notice: true } });
    s.jump = null;
  }
  if (!s.jump && now.value >= X.jump && !now.fear.length && !(s.truce != null && s.truce >= state.day)) {
    s.jump = { day: state.day + 1, warned: state.day };
    push({ ...base, type: 'sixes', what: 'jumpWarned', by: X.dutch, day: state.day + 1, value: now.value, max: X.max, money: [],
      text: `Word from the market: the Sixes will be looking for you there tomorrow (${now.value} of ${X.max}). Two of them will be waiting on the kerb when you leave for the subway. Stay away, or go and win it.`, scene: { notice: true } });
  }
}
/**
 * Leaving their ground (a ride or a walk out): two of them waiting by the steps on the day they said (the jumped
 * fight, their two), else Dutch for the tax on a day you sold or grabbed there with the meter at `tax`. Either stops
 * the move: you are still at the market, and choose again. → true when it stopped you.
 */
function sixesStop(cfg, state, at, push) {
  const X = cfg.sixes;
  if (!X || !sixesGround(cfg, state.place)) return false;
  const s = sixesHere(state);
  const now = sixesOf(cfg, state);
  // (raid-1: beaten at your door, they leave you be: no tax, nobody on the kerb, while the truce lasts)
  if (s.truce != null && s.truce >= state.day) return false;
  if (s.jump && s.jump.day === state.day && !now.fear.length) {
    sixesJump(cfg, state, at, push);
    return true;
  }
  if (s.tax) return false;
  if (now.value >= X.tax && s.did === state.day && s.taxDay !== state.day && s.madeDay === state.day && s.made > 0) {
    // (raid-1, the push: the days in a row they have stopped you for it, this one counted)
    const streak = (s.streakDay === state.day - 1 ? s.streak ?? 0 : 0) + 1;
    s.streak = streak;
    s.streakDay = state.day;
    const wants = taxOf(cfg, s.made, streak);
    const D = personOf(cfg, X.dutch);
    const pct = taxPctOf(cfg, streak);
    s.tax = { wants, made: s.made, day: state.day, value: now.value, pct, streak };
    push(at({ type: 'sixes', what: 'tax', by: X.dutch, who: D ? whoOf(D) : null, wants, made: s.made, value: now.value, max: X.max, canPay: state.carried >= wants, pct, streak, money: [],
      text: `${D?.name ?? 'Dutch'} is waiting on the kerb, on your way to the subway: "${pct === X.taxPct ? 'A fifth' : `${cap(pctWords(pct))}: ${streak} days running you've worked my market. That's ${pctWords(pct)}`} of what you made here today. $${wants}." You made $${s.made} at the market today. Pay her (the Sixes −${X.pay}, and today's selling doesn't count), or refuse (the Sixes +${X.raise.refuse}${now.value + X.raise.refuse >= X.jump ? `: at ${X.jump} two of them come for you here` : ''}).`,
      scene: { action: 'talk' } }));
    return true;
  }
  return false;
}
/** The tax answered: paid from what you carry (the meter down, today's selling not counted), or refused (up). */
function answerTax(cfg, state, pay, at, push) {
  const X = cfg.sixes;
  const s = sixesHere(state);
  const t = s.tax;
  const D = personOf(cfg, X.dutch);
  const name = D?.name ?? 'Dutch';
  s.tax = null;
  s.taxDay = state.day;
  if (pay) {
    const moved = spend(state, t.wants, { from: 'carried', on: 'sixes' });
    const e = sixesEase(cfg, state, X.pay, 'sell');
    push(at({ type: 'sixes', what: 'paid', by: 'you', who: D ? whoOf(D) : null, amount: t.wants, made: t.made, from: t.value, value: e.value, max: X.max, money: [moved],
      text: `You paid ${name} $${t.wants}. She steps aside. The Sixes ease off: ${e.value} of ${X.max}.`, scene: { action: 'hand_off' } }));
    return;
  }
  const note = sixesRaise(cfg, state, X.raise.refuse, 'refuse', `you refused ${name} the tax (day ${state.day})`);
  push(at({ type: 'sixes', what: 'refused', by: 'you', who: D ? whoOf(D) : null, amount: t.wants, made: t.made, from: t.value, value: note.value, max: X.max, sixes: note, money: [],
    text: `You told ${name} no. She lets you by and says nothing. ${note.text}${note.value >= X.jump ? ' They will come for you.' : ''}`, scene: { action: 'shove' } }));
}
/**
 * TWO OF THE SIXES BY THE STEPS (the meter at `jump`, warned yesterday): the jumped fight (rules.mjs jumpOut), their
 * two. Won: you keep all you carry, they fear you for a week (`seenOff`: no more waiting for you while it lasts), the
 * meter up `raise.beat`. Lost: what a jump takes (all you carry and the clinic; a scrape, half), and the meter down to
 * `afterJump`: they made their point. No tax that day either way.
 */
function sixesJump(cfg, state, at, push) {
  const X = cfg.sixes;
  const s = state.sixes;
  const place = state.place;
  const duel = jumpOut(cfg, state, place, ['sixes', state.day]);
  const outcome = duel.band;
  const takes = jumpTakes(cfg, state, state.carried)[outcome];
  const moved = takes ? [lose(state, takes, 'jumped')] : [];
  const goodsTaken = takeGoods(cfg, state, outcome);
  const two = X.jumpers.map(id => personOf(cfg, id)).filter(Boolean);
  const won = duel.result === 'won';
  s.jump = null;
  s.taxDay = state.day;
  s.jumps = [...(s.jumps ?? []), { day: state.day, result: duel.result, band: outcome, taken: takes }];
  const marks = won ? two.map(p => markPerson(cfg, state, whoOf(p), 'seenOff', place, { force: true })).filter(Boolean) : [];
  let note = null;
  if (won) note = sixesRaise(cfg, state, X.raise.beat, 'beat', `you saw off the two on the kerb (day ${state.day})`);
  else {
    const v = sixesOf(cfg, state).value;
    if (v > X.afterJump) sixesEase(cfg, state, v - X.afterJump);
  }
  const value = sixesOf(cfg, state).value;
  const what = [takes ? `$${takes}` : null, Object.keys(goodsTaken).length ? goodsText(cfg, goodsTaken) : null].filter(Boolean).join(' and ');
  const text = won ? `Two of the Sixes were waiting on the kerb, on your way to the subway. ${outcome === 'messy' ? `You saw them off, only just: they got $${takes} first.` : 'You saw them off and kept every dollar.'} They will keep off you for ${cfg.memory.days} days. ${note.text}`
    : `Two of the Sixes were waiting on the kerb, on your way to the subway, and beat you: they took ${what || 'nothing'}. They made their point (${value} of ${X.max}).`;
  push(at({ type: 'jumped', by: 'sixes', sixes: true, who: two.map(whoOf), duel, outcome, taken: takes, goodsTaken, goodsLeft: someGoods(state.goods), value, max: X.max, ...(marks.length ? { marks } : {}), ...(note ? { note } : {}),
    text, money: moved, scene: { kind: `npc:robbers:${outcome === 'disaster' ? 'fail' : outcome}`, sixes: true } }));
  if (outcome === 'clean') endDay(cfg, state, 'clinic', at, push);
}

// ── the raid on your home (raid-1, RUN.md "The raid on your home (raid-1)") ─────────────────────────────────────────
/** (raid-1) The truce after you beat them at your door: through day `truce`, none of theirs happens. */
const truceOn = (state, day = state.day) => state.sixes?.truce != null && state.sixes.truce >= day;

/**
 * The morning's word of a raid: with their meter at sixes.raid (and no truce, nothing due, the quiet mornings after
 * the last one gone by), the Sixes come for your crib on the night of tomorrow (the camera: a day later, so two days
 * to answer). Who comes is set now: the size by what is at stake at your crib, the crew by the dice.
 */
function sixesRaidMorning(cfg, state, base, push) {
  const X = cfg.sixes;
  const Y = cfg.sixesRaid;
  const s = sixesHere(state);
  if (s.raid || truceOn(state) || X.raid == null) return;
  if (s.raidLast != null && state.day <= s.raidLast + (Y.rest ?? 0)) return;
  const v = sixesOf(cfg, state).value;
  const stake = stakeOf(cfg, state);
  const size = stake.size;
  if (v < raidAtOf(cfg)) return;
  const lead = 1 + (defVal(cfg, state, 'lead') ?? 0);
  const crew = raidCrew(cfg, state, state.day);
  const c = crewFoes(cfg, crew, size);
  const day = state.day + lead;
  s.raid = { day, warned: state.day, crew, size, n: c.n, stake: stake.total };
  const D = personOf(cfg, X.dutch);
  const when = lead > 1 ? `on the night of day ${day} (the camera caught them looking a day early)` : 'tomorrow night';
  push({ ...base, type: 'sixes', what: 'raidWarned', by: X.dutch, who: D ? whoOf(D) : null, day, raidNight: day, lead, value: v, max: X.max, crew, size, n: c.n, count: { ...c.count }, says: c.says,
    stake: { ...stake, hidden: { ...stake.hidden } }, money: [],
    text: `Word from the market: the Sixes are coming for your crib ${when}. ${cap(c.text)} (${c.says}): they saw $${stake.total} worth at your place. Be home and meet them with what you hold, or be out and leave it to your door.`,
    scene: { notice: true, sixesRaid: true } });
}

/**
 * The night of the raid (morning(), before anything else): home, the raid fight with what you hold; out, Earl on the
 * step, then the door, and the safe's share. → { hurt: energy off the morning, heat: from gunfire, clinic: knocked out }.
 */
function sixesRaidNight(cfg, state, night, push) {
  const s = state.sixes?.raid ? sixesHere(state) : null;
  const R = s?.raid;
  if (!R || R.day !== state.day) {
    if (R && R.day < state.day) s.raid = null;
    return null;
  }
  const X = cfg.sixes;
  const Y = cfg.sixesRaid;
  const at = (extra = {}) => ({ day: state.day, hour: state.hour, place: state.place, block: placeOf(cfg, state.place).block ?? null, to: 'you', ...extra });
  const keys = [R.day, R.crew];
  const before = state.banked;
  const g = guardOf(cfg, state);
  const c = crewFoes(cfg, R.crew, R.size);
  const home = night === 'home';
  let fight = null, guard = null, roll = null, share = 0, shareBy = null, gotIn = false, lostGun = null, hurt = 0, heat = 0, clinic = false, how = home ? 'door' : 'away';
  if (home) {
    fight = raidOut(cfg, state, keys);
    gotIn = fight.result !== 'won';
    if (fight.gun && fight.spent) {
      state.ammo = { ...(state.ammo ?? {}), [fight.gun]: Math.max(0, roundsOf(state, fight.gun) - fight.spent) };
      heat = gunHeat(cfg, state, fight.gun, fight.spent);
    }
    if (fight.earl?.down) {
      state.home.guard = { ...(state.home.guard ?? {}), hurt: R.day + (cfg.guard.doorHurtDays ?? 1) };
      guard = { who: g.who, beaten: true, door: true, hurtDays: cfg.guard.doorHurtDays ?? 1, until: g.until, lostDays: 0 };
    } else if (fight.earl) guard = { who: g.who, beaten: false, door: true, hurtDays: 0, until: g.until, lostDays: 0 };
    if (gotIn) {
      // (the decoy safe: you open the wrong one)
      share = Math.round((Y.share * (100 - (defVal(cfg, state, 'decoy') ?? 0))) / 100);
      clinic = true;
      // (the gun in your hands goes with them, and what is left of its rounds)
      if (fight.gun) {
        lostGun = { item: fight.gun, label: cfg.things[fight.gun].label, rounds: roundsOf(state, fight.gun) };
        state.things = { ...state.things, [fight.gun]: false };
        delete state.things[fight.gun];
        state.ammo = { ...state.ammo, [fight.gun]: 0 };
        if (state.holdWith === fight.gun) state.holdWith = null;
      }
    } else hurt = fight.hurt ? Y.hurt.hurt : Y.hurt.won;
  } else {
    if (g?.on) {
      const P = clamp(cfg.crew.strength - cfg.guard.strength, cfg.contest.min, cfg.contest.max);
      const r = contestRoll(state, ['run-sixes-raid-guard', ...keys]);
      const band = jumpBand(cfg, P, r);
      const beaten = band === 'clean';
      const lostDays = beaten ? g.until - R.day : 0;
      guard = { who: g.who, P, roll: r, outcome: band, beaten, hurtDays: beaten ? cfg.guard.hurtDays : 0, until: g.until, lostDays };
      if (beaten) state.home.guard = { ...(state.home.guard ?? {}), on: false, until: null, hurt: R.day + cfg.guard.hurtDays };
      else how = 'guard';
    }
    if (how !== 'guard') {
      const pct = defVal(cfg, state, 'kick', Math.min) ?? cfg.crew.kickPct;
      const r = rollChance(state, pct, ['run-sixes-raid', ...keys]);
      roll = { roll: r.roll, chance: r.chance, kickBy: defBy(cfg, state, 'kick', Math.min) };
      gotIn = r.hit;
      share = defVal(cfg, state, 'crewShare', Math.min) ?? Y.outShare;
      shareBy = defBy(cfg, state, 'crewShare', Math.min);
    }
  }
  const taken = gotIn ? shareTaken(cfg, state, share) : 0;
  const hidden = hiddenOf(cfg, state, { held: lostGun?.item ?? null });
  // (things at risk, by their own `raid`, each its own roll: carried off (never what is hidden), or knocked out for days
  // (seen smashed, mended after: `home.out`, its last day out); a thing knocked out is never taken)
  const thingsTaken = [], thingsOut = [];
  if (gotIn) {
    for (const x of thingsAtRisk(cfg, state)) {
      if (hidden.things.includes(x.item) || !state.things?.[x.item]) continue;
      const r = rollChance(state, x.take, ['run-sixes-raid-thing', ...keys, x.item]);
      if (!r.hit) continue;
      thingsTaken.push({ item: x.item, label: x.label, worth: x.worth });
      state.things = { ...state.things };
      delete state.things[x.item];
      if (cfg.things[x.item]?.gun) state.ammo = { ...(state.ammo ?? {}), [x.item]: 0 };
      if (state.holdWith === x.item) state.holdWith = null;
    }
    for (const x of thingsToKnock(cfg, state)) {
      const r = rollChance(state, x.pct, ['run-sixes-raid-out', ...keys, x.item]);
      if (!r.hit) continue;
      const until = state.day + x.out;
      state.home.out = { ...(state.home.out ?? {}), [x.item]: until };
      thingsOut.push({ item: x.item, label: x.label, days: x.out, until });
    }
  }
  const goodsTaken = {};
  if (gotIn && Y.stockPct && !hidden.goods) {
    for (const [gd, n] of Object.entries(state.stash ?? {})) {
      const k = Math.floor((n * Y.stockPct) / 100);
      if (k > 0) {
        goodsTaken[gd] = k;
        state.stash[gd] = n - k;
        if (!state.stash[gd]) delete state.stash[gd];
      }
    }
  }
  const moved = taken ? [burgle(state, taken)] : [];
  // (held at your door: what was in the pockets of each of them you put down, banked)
  let spoils = 0;
  if (home && !gotIn && Y.spoils) {
    fight.them.each.forEach((q, i) => { if (q.down) spoils += payIn(state, Y.spoils, ['run-sixes-raid-spoils', ...keys, i]); });
    if (spoils) {
      moved.push(earn(state, spoils));
      moved.push(bank(state, spoils));
    }
  }
  // what it does to them: won at your door, a truce; beaten, their point made; out and in, the same; out and held, nothing
  const won = home && !gotIn;
  if (won) s.truce = state.day + Y.truce;
  const outcome = won ? (fight.hurt ? 'hurt' : 'held') : home ? 'beaten' : gotIn ? 'taken' : 'held';
  s.raid = null;
  s.raidLast = R.day;
  s.raids = [...(s.raids ?? []), { day: R.day, crew: R.crew, size: R.size, n: c.n, how, outcome, taken, hold: fight?.hold ?? null, spent: fight?.spent ?? 0, ...(fight ? { result: fight.result } : {}) }];
  // (last: easing the meter makes the Sixes' state anew)
  const v0 = sixesOf(cfg, state).value;
  const to = won ? Y.afterWin : home ? Y.afterLoss : gotIn ? Y.afterTake : null;
  if (to != null && v0 > to) sixesEase(cfg, state, v0 - to);
  const value = sixesOf(cfg, state).value;
  const gw = Object.keys(goodsTaken).length ? goodsText(cfg, goodsTaken) : null;
  const what = [taken ? `$${taken}` : null, gw, lostGun ? lostGun.label : null, ...thingsTaken.map(x => x.label)].filter(Boolean);
  const keep = [hidden.cash && gotIn ? `the $${Math.min(hidden.cash, before)} in the cereal box` : null, hidden.goods && gotIn && Object.keys(state.stash ?? {}).length ? 'the goods behind the false wall' : null,
    ...(gotIn ? hidden.things.filter(k => state.things?.[k]).map(k => `${cfg.things[k].label} behind the false wall`) : [])].filter(Boolean);
  const parts = [];
  if (fight) {
    parts.push(won ? `You met them at your door with ${fight.you.label} and held it${fight.hurt ? ', only just: hurt' : ''}${fight.spent ? ` (${fight.spent} round${fight.spent > 1 ? 's' : ''} fired)` : ''}`
      : `They beat you at your door and knocked you out${fight.spent ? ` (${fight.spent} round${fight.spent > 1 ? 's' : ''} fired)` : ''}: you woke in the clinic`);
    if (guard?.beaten) parts.push(`${cap(g.who.name)} went down in it: off tomorrow`);
  } else if (how === 'guard') parts.push(`You were out. ${cap(g.who.name)} was on your step and saw them off`);
  else {
    if (guard?.beaten) parts.push(`You were out. They beat ${g.who.name} on your step (off ${cfg.guard.hurtDays} days)`);
    parts.push(gotIn ? `They kicked your door in while you were ${night === 'street' ? 'out' : `in ${placeOf(cfg, night === 'jail' ? 'jail' : 'clinic').label}`}` : `They kicked at your door and it held${roll?.kickBy ? ` (${cfg.things[roll.kickBy].label})` : ''}`);
  }
  const took = gotIn ? `They took ${what.length ? what.join(', ') : 'nothing they could find'}${thingsOut.length ? `, and smashed ${thingsOut.map(x => `${x.label} (no use for ${x.days} day${x.days > 1 ? 's' : ''}, until it is mended)`).join(', ')}` : ''}${keep.length ? `; they never found ${keep.join(' or ')}` : ''}.` : 'Nothing taken.';
  const pockets = spoils ? ` You went through their pockets: $${spoils}, banked.` : '';
  const after = won ? `They will leave you be for ${Y.truce} days (the Sixes ${value} of ${X.max}).` : home || gotIn ? `They made their point (the Sixes ${value} of ${X.max}).` : `They will be back (the Sixes ${value} of ${X.max}).`;
  push(at({ type: 'raid', by: 'sixes', sixes: true, kind: 'sixes', who: c.foes.map(f => ({ id: f.id, name: f.name, kind: f.kind })), crew: R.crew, size: R.size, n: c.n, says: c.says, how, outcome, gotIn,
    taken, goodsTaken, lostGun, thingsTaken, thingsOut, share, shareBy, hidden: { ...hidden, things: [...hidden.things] }, banked: before, bankedAfter: state.banked, night: true, home, guard, ...(roll ? roll : {}),
    ...(fight ? { duel: fight, fight: { result: fight.result, hurt: fight.hurt, spent: fight.spent } } : { fight: null }), energyLost: hurt, heat, value, max: X.max, truce: won ? s.truce : null,
    spoils,
    text: `Last night the Sixes came for your crib: ${c.text}. ${parts.join('. ')}. ${took}${pockets} ${after}${heat ? ` The shots carried: heat +${heat}.` : ''}`,
    money: moved, scene: fight ? { kind: won ? 'fight:fail' : 'fight:clean', sixesRaid: true } : gotIn ? { kind: 'breakin:clean', sixesRaid: true } : { kind: 'breakin:fail', sixesRaid: true } }));
  return { hurt, heat, clinic };
}

/** (raid-1) A box of rounds for a gun you own, from its seller where you stand (from what you carry, no hour). */
function buyAmmo(cfg, state, item, at, push) {
  const t = cfg.things[item];
  const moved = spend(state, t.ammo.price, { from: 'carried', on: 'ammo' });
  state.ammo = { ...(state.ammo ?? {}), [item]: roundsOf(state, item) + t.ammo.n };
  const keeper = keeperOf(cfg, state.place, t.keeper);
  push(at({ type: 'ammo', by: 'you', item, label: t.ammo.label, n: t.ammo.n, rounds: state.ammo[item], price: t.ammo.price, keeper, spot: t.spot ?? null,
    text: `You bought ${t.ammo.label} for $${t.ammo.price}${keeper ? ` from ${keeper.name}` : ''}: ${state.ammo[item]} rounds for ${t.label}.`, money: [moved], scene: { action: 'hand_off' } }));
}
/** (raid-1) What you hold at your door when the Sixes come: a gun you own with rounds, or what you fight with; no hour. */
function holdWith(cfg, state, h, at, push) {
  const was = holdOf(cfg, state);
  state.holdWith = h;
  push(at({ type: 'holdWith', by: 'you', with: h, was, label: holdLabel(cfg, h), text: `If the Sixes come, you meet them at your door with ${holdLabel(cfg, h)}.`, money: [], scene: { notice: true } }));
}
