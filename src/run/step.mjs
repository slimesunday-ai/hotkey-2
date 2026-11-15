// Apply one choice: step(cfg, state, choice) → { state, events }. Pure: the input state is never changed, and the
// same state and choice always give the same result. Every event says what happened, to whom, where, the roll, the
// money moved, and a `scene` hint from RUN.md's "Plays as" table so the stage needs to derive nothing.
// No rule here names a place: each reads the place's entry (config.mjs, `places`).

import { rng, pick } from '../rng.mjs';
import { rollChance } from '../contest.mjs';
import { copyRun } from './state.mjs';
import { listChoices } from './view.mjs';
import {
  danger, deal, jobOdds, jobPay, jumpBand, jumpContest, jumpTakes, morningEnergy, ownsAll, clamp, namedLabel, whoOf, cap,
  placeOf, tierOf, homeId, streetOf, heatPlace, drawSupply, supplyLeft, robOdds, binsFinds, shopOf, fullEnergy,
  soldTo, doorChance, regularsOf, grudgeLeft, countToday, trustOf, trustAfter, trustBand, offDays, tellRisk, jobTrust,
  homeOfPerson, placeHeat, isHot, streetPlaces, canHeat,
} from './rules.mjs';
import { earn, lose, spend, bank, withdraw } from './ledger.mjs';

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
  const at = (extra = {}) => ({ day: state.day, hour: state.hour, place: state.place, block: placeOf(cfg, state.place).block ?? null, to: 'you', ...extra });
  const push = e => events.push(e);

  switch (choice.do) {
    case 'job': anHour(cfg, state, at, push, () => work(cfg, state, choice, at, push)); break;
    case 'rob': anHour(cfg, state, at, push, () => rob(cfg, state, at, push)); break;
    case 'bins': anHour(cfg, state, at, push, () => bins(cfg, state, at, push)); break;
    case 'shop': buyHere(cfg, state, choice.item, at, push); break;
    case 'rough': sleepRough(cfg, state, at, push); break;
    case 'give': give(cfg, state, at, push); break;
    case 'refuse': refuse(cfg, state, at, push, 'shut'); break;
    case 'inside': {
      const amount = state.carried;
      if (amount > 0) push(at({ type: 'bank', by: 'you', text: `You went inside and banked $${amount}.`, money: [bank(state, amount)], scene: { action: 'stash', spot: 'pad' } }));
      else push(at({ type: 'inside', by: 'you', text: 'You went inside.', scene: { action: 'walk', spot: 'door' } }));
      state.place = placeOf(cfg, state.place).door;
      break;
    }
    case 'out': {
      const take = choice.take ?? 0;
      if (!Number.isInteger(take) || take < 0 || take > state.banked) throw new Error(`can't take $${take} out with $${state.banked} banked`);
      if (state.door) refuse(cfg, state, at, push, 'past');
      const moved = take ? [withdraw(state, take)] : [];
      push(at({ type: 'out', by: 'you', text: take ? `You stepped out with $${take}.` : 'You stepped out.', money: moved, scene: { action: 'walk', spot: 'door' } }));
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
    default: throw new Error(`unknown choice ${choice.do}`);
  }
  return { state, events };
}

function sameChoice(a, b) {
  if (!b || a.do !== b.do) return false;
  if (a.do === 'job') return a.id === b.id; // and `who`, if given, one of its targets (checked in work)
  if (a.do === 'subway') return a.to === b.to && !!a.hop === !!b.hop;
  if (a.do === 'buy' || a.do === 'shop') return a.item === b.item;
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
  const odds = jobOdds(cfg, state, job); // before acting: tired is energy 2 or less now
  const pay0 = jobPay(cfg, state, job); // before acting: with you or not
  const keys = ['run-job', state.day, state.hour, place, job.id];
  const r = odds.pct >= 100 ? { hit: true, roll: null, chance: 100 } : rollChance(state, odds.pct, keys);
  const scenes = job.scene ?? {};
  const label = namedLabel(job);
  const who = job.who ? whoOf(job.who) : null;
  const base = at({ type: 'job', job: job.id, label, by: 'you', with: job.with ?? null, who, roll: r.roll, chance: r.chance, ...(job !== dealt ? { picked: true } : {}) });
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
    push({ ...base, outcome: 'win', pay, heat: job.winHeat ?? 0, placeHeat: heatNow, mood, outToday: out, ...extra, ...(trust ? { trust } : {}), text: `${label}: +$${pay}${job.winHeat ? `, heat +${job.winHeat}` : ''}.${after}`, money: [moved], scene: scenes.win ?? { action: 'idle' } });
    return canHeat(job); // a job that can heat the place can be seen, whichever way it went
  } else {
    state.heat = clamp(state.heat + (job.failHeat ?? 0), 0, cfg.heat.max);
    const heatNow = heatPlace(cfg, state, place, job.failHeat ?? 0);
    state.energy = Math.max(0, state.energy - (job.failEnergy ?? 0));
    const cost = [job.failHeat ? `heat +${job.failHeat}` : null, job.failEnergy ? `energy −${job.failEnergy}` : null].filter(Boolean).join(', ');
    const trust = who ? moveTrust(cfg, state, who, jobTrust(job).fail, 'job', moodWhy(cfg, mood)) : null;
    push({ ...base, outcome: 'fail', heat: job.failHeat ?? 0, placeHeat: heatNow, energyLost: job.failEnergy ?? 0, mood, outToday: out, ...(trust ? { trust } : {}), text: `${label}: it went wrong${cost ? ` (${cost})` : ''}.${after}`, money: [], scene: scenes.fail ?? scenes.win ?? { action: 'idle' } });
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
  push(at({ type: 'witness', by: who.id, who, watchers, called: true, roll: r.roll, chance: r.chance, at: place, heat: tell.heat, placeHeat: heatNow,
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
  if (r.hit) {
    const pay = payIn(state, o.pay, ['run-rob-pay', ...keys.slice(1)]);
    const moved = earn(state, pay);
    const heatNow = heatPlace(cfg, state, place, o.winHeat);
    push({ ...base, outcome: 'win', pay, heat: o.winHeat, placeHeat: heatNow, text: `You robbed somebody passing: +$${pay}, heat +${o.winHeat} here.`, money: [moved], scene: { kind: 'rob:clean' } });
  } else {
    const heatNow = heatPlace(cfg, state, place, o.failHeat);
    push({ ...base, outcome: 'fail', heat: o.failHeat, placeHeat: heatNow, text: `You tried to rob somebody passing and they got away shouting: heat +${o.failHeat} here.`, money: [], scene: { kind: 'rob:fail' } });
  }
  return true; // it heats the place either way
}

/** Digging through the bins: usually nothing or a few dollars, rarely a real find; somebody may see you. */
function bins(cfg, state, at, push) {
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
  push(at({ type: 'bins', by: 'you', roll, find, pay, left, seen, mood: seen && !away ? s.mood : null, ...(seen ? { lookedAway: away } : {}), ...(trust ? { trust } : {}), text: `You dug through the bins: ${pay ? `+$${pay}${find === 'find' ? ', a real find' : ''}` : 'nothing'}.${said}`, money: moved, scene: { action: 'rummage' } }));
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
  push(at({ type: 'shop', by: 'you', item, price: it.price, gives: { ...(it.gives ?? {}) }, text: `You bought ${it.label.toLowerCase()} for $${it.price}${did.length ? `: ${did.join(', ')}` : ''}.`, money: [moved], scene: { action: 'hand_off' } }));
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
    const text = !takes && (outcome === 'clean' || outcome === 'messy') ? 'In the night somebody went through your pockets and found nothing.'
      : outcome === 'clean' ? `In the night they robbed you: they took $${takes}.`
        : outcome === 'messy' ? `In the night somebody went through your pockets: $${takes} gone.`
          : 'Somebody tried your pockets in the night and you woke in time.';
    push(at({ type: 'robbed', by: 'robbers', roll: r.roll, chance: r.chance, contest: { P: contest.P, roll, outcome }, outcome, taken: takes, text, money: moved, scene: { kind: 'night:robbed' } }));
  }
  morning(cfg, state, 'street', push);
}

/** Give the regular at your door what they ask, from banked: they go, friendly, and will be back. */
function give(cfg, state, at, push) {
  const d = state.door;
  const moved = spend(state, d.wants, { on: 'door' });
  const sold = Math.max(0, soldTo(state, d.id) - cfg.regulars.giveEases);
  state.regulars[d.id] = sold;
  state.people[d.id] = { mood: 'friendly', out: false, job: null };
  state.door = null;
  const who = { id: d.id, name: d.name, role: d.role };
  const trust = moveTrust(cfg, state, who, cfg.trust.give, 'gave', 'you gave them what they asked at your door');
  push(at({ type: 'gave', by: 'you', who, amount: d.wants, sold, ...(trust ? { trust } : {}), text: `You gave ${d.name} $${d.wants}; they go, friendly. They will be back.`, money: [moved], scene: { action: 'hand_off' } }));
}

/** Refuse the regular at your door (shut it, or walk out past them): a fight, or their grudge. Their count starts over. */
function refuse(cfg, state, at, push, how) {
  const d = state.door;
  const R = cfg.regulars;
  const who = { id: d.id, name: d.name, role: d.role };
  state.door = null;
  state.regulars[d.id] = Math.max(0, soldTo(state, d.id) - (R.refuseEases ?? soldTo(state, d.id)));
  // the refusal is what moves their trust: from neutral, to the bottom (against you); from with you, only to neutral
  const trust = moveTrust(cfg, state, who, cfg.trust.refuse, 'refused', 'you refused them at your door');
  push(at({ type: 'refused', by: 'you', who, how, ...(trust ? { trust } : {}), text: how === 'past' ? `You walked out past ${d.name}.` : `You shut the door on ${d.name}.`, scene: how === 'past' ? { action: 'walk', spot: 'door' } : { action: 'shove' } }));
  const r = rollChance(state, R.fightPct, ['run-door-fight', state.day, d.id]);
  if (r.hit) {
    const P = clamp(R.strength - (state.owned.cutter ? cfg.jump.cutter : 0), cfg.contest.min, cfg.contest.max);
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
    const days = offDays(cfg, state, d.id);
    const heatNow = heatPlace(cfg, state, d.place, R.grudgeHeat);
    state.people[d.id] = { mood: 'sour', out: true, job: null };
    push(at({ type: 'grudge', by: d.id, who, roll: r.roll, chance: r.chance, days, at: d.place, heat: R.grudgeHeat, placeHeat: heatNow, called: true,
      ...(state.place === d.place ? {} : { notice: callNotice(cfg, state, d.place) }), // (from your door: you are not standing there)
      text: `${cap(d.name)} goes off cursing you: no sales to them for ${days} day${days > 1 ? 's' : ''}, and the police come round ${placeOf(cfg, d.place).where ?? placeOf(cfg, d.place).label} (heat +${R.grudgeHeat} there).`, scene: { kind: 'say' } }));
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
      push(at({ ...where, type: 'stopped', by: 'police', roll: r.roll, chance: r.chance, seized, text: `The police stopped you${seized ? ` and seized $${seized}` : ''}.`, money: moved, scene: { kind: 'arrest' } }));
      state.heat = cfg.heat.afterJail;
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
  const roll = contestRoll(state, ['run-jump-contest', state.day, hour]);
  const outcome = jumpBand(cfg, risk.jump.strength, roll);
  const takes = jumpTakes(cfg, state, state.carried)[outcome]; // from what you carry now, this hour's pay included
  const moved = takes ? [lose(state, takes, 'jumped')] : [];
  const took = takes ? `they took $${takes}` : 'they found nothing to take';
  const text = outcome === 'clean' ? `You were jumped, a bad one: ${took}.`
    : outcome === 'messy' ? `You were jumped, a scuffle: ${took}.`
      : 'Somebody tried to jump you and got nothing.';
  push(at({ ...where, type: 'jumped', by: 'jumpers', roll: r.roll, chance: r.chance, contest: { P: risk.jump.strength, roll, outcome }, outcome, taken: takes, text, money: moved, scene: { kind: `npc:robbers:${outcome === 'disaster' ? 'fail' : outcome}` } }));
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
  if (choice.hop) {
    const r = rollChance(state, s.hopCaughtPct, ['run-hop', state.day, hour]);
    if (r.hit) state.heat = clamp(state.heat + s.hopHeat, 0, cfg.heat.max);
    push({ ...pay, type: 'hop', by: 'you', roll: r.roll, chance: r.chance, caught: r.hit, heat: r.hit ? s.hopHeat : 0,
      text: r.hit ? `You hopped the turnstile and were seen: heat +${s.hopHeat}.` : 'You hopped the turnstile.',
      scene: { ride: 'subway', action: 'run', later: 'turnstile_hop' } });
  } else {
    const fare = link.fare ?? s.fare;
    push({ ...pay, type: 'fare', by: 'you', text: `You paid the $${fare} fare.`, money: [lose(state, fare, 'fares')], scene: { ride: 'subway' } });
  }
  state.place = choice.to;
  state.hoursThere = 0;
  push(at({ type: 'ride', by: 'you', hour, from, text: `You rode the subway to ${placeOf(cfg, choice.to).label}.`, scene: { ride: 'subway' } }));
}

/** The day ends somewhere other than home: the clinic or the jail. */
function endDay(cfg, state, where, at, push) {
  push(at({ type: where, by: where === 'jail' ? 'police' : 'jumpers', text: where === 'jail' ? 'The day ends in jail.' : 'You wake in the clinic.', scene: { kind: `held:${where}` } }));
  state.place = Object.keys(cfg.places).find(id => cfg.places[id].held === where) ?? where;
  state.hoursThere = 0;
}

/**
 * The next morning: at the crib after home, the clinic or the jail; where you lay after a night on the street. Your
 * own heat cools only after a night at home; every place cools every night. Everyone is calm again, every place's
 * supply refills, and a regular may be at your door.
 */
function morning(cfg, state, night, push) {
  if (night === 'home') state.heat = Math.max(0, state.heat - cfg.heat.nightDrop);
  for (const id of Object.keys(state.placeHeat)) state.placeHeat[id] = Math.max(0, state.placeHeat[id] - (tierOf(cfg, id)?.cool ?? 1));
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
  for (const [id, p] of Object.entries(cfg.places)) for (const [what, s] of Object.entries(p.supply ?? {})) {
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
  if (!street) atTheDoor(cfg, state, base, push);
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

/** A regular you have leaned on may be at your door this morning, wanting more. */
function atTheDoor(cfg, state, base, push) {
  for (const r of regularsOf(cfg)) {
    if (offDays(cfg, state, r.id)) continue; // against you: they do not come asking
    const sold = soldTo(state, r.id);
    const chance = doorChance(cfg, sold);
    if (!chance) continue;
    const roll = rollChance(state, chance, ['run-door', state.day, r.id]);
    if (!roll.hit) continue;
    const more = (cfg.regulars.wantsUp ?? 0) * (sold - cfg.regulars.doorAt); // the more hooked, the more they want
    const wants = payIn(state, cfg.regulars.wants.map(x => x + more), ['run-door-wants', state.day, r.id]);
    state.door = { id: r.id, name: r.name, role: r.role, place: r.place, wants };
    push({ ...base, type: 'door', by: r.id, who: whoOf(r), wants, sold, roll: roll.roll, chance: roll.chance, money: [],
      text: `${cap(r.name)} is at your door wanting more: they ask for $${wants}.`, scene: { action: 'crave' } });
    return;
  }
}
