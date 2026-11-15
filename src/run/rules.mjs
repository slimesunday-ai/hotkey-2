// The run's rules as plain functions of (config, state). The view and the engine both call these, so the odds a
// player is shown and the odds the engine rolls can't disagree (the house rule from src/contest.mjs).
// No rule names a place: each reads the place's entry in the config (config.mjs, `places`).

import { rng, pick, shuffle } from '../rng.mjs';
import { bandOf, chances } from '../contest.mjs';

export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const ITEMS = Object.freeze(['pocket', 'cutter', 'bed']);
export const scale = (range, by) => range.map(x => Math.round(x * by));
export const cap = s => `${s[0].toUpperCase()}${s.slice(1)}`;

// ── places ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A place's entry. */
export const placeOf = (cfg, id) => cfg.places[id] ?? {};
/** Its danger tier (null for the crib, the clinic, the jail). */
export const tierOf = (cfg, id) => (placeOf(cfg, id).tier ? cfg.tiers[placeOf(cfg, id).tier] : null);
/** Your crib: the place that is home. */
export const homeId = cfg => Object.keys(cfg.places).find(id => cfg.places[id].home);
/** The street place whose heat and police count where you stand: the place itself, or the one the crib opens onto. */
export const streetOf = (cfg, id) => (placeOf(cfg, id).tier ? id : placeOf(cfg, id).inside ?? null);
/** A place you can work: it deals jobs, or has a supply to use, and is not locked. */
export const isStreet = (cfg, id) => !!placeOf(cfg, id).tier && !placeOf(cfg, id).locked;
export const streetPlaces = cfg => Object.keys(cfg.places).filter(id => isStreet(cfg, id));

// ── energy ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Energy 2 or less before acting. */
export const isTired = (cfg, state) => state.energy <= cfg.energy.tiredAt;

/** The day's full energy: the mattress or the bed. */
export const fullEnergy = (cfg, state) => (state.owned.bed ? cfg.energy.bed : cfg.energy.mattress);

// ── heat ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** What you did at a place: its heat (0 for a place nobody has heated, or a version-2 state). */
export const placeHeat = (state, id) => state.placeHeat?.[id] ?? 0;

/**
 * The heat on you where you stand: the higher of your own and the place's (the police there know you, or know the
 * place is hot). In the crib, the place its door opens onto counts.
 */
export function heatHere(cfg, state, place = state.place) {
  const street = streetOf(cfg, place);
  return clamp(Math.max(state.heat, street ? placeHeat(state, street) : 0), 0, cfg.heat.max);
}

/** A place is hot at heat.hotAt or more. */
export const isHot = (cfg, state, id) => placeHeat(state, id) >= cfg.heat.hotAt;

/** The police are about: the place's tier patrols it, or it is hot. */
export function policeAbout(cfg, state, id) {
  const tier = tierOf(cfg, id);
  return !!tier && (tier.patrol || isHot(cfg, state, id));
}

/** The chance of a stop this hour where you stand: police about and heat here `from` or more. */
export function stopChance(cfg, state, place = state.place) {
  const tier = tierOf(cfg, place);
  if (!tier || !policeAbout(cfg, state, place)) return 0;
  const h = heatHere(cfg, state, place);
  const p = cfg.police;
  return h >= p.from ? clamp(Math.round((h - p.from + 1) * p.perHeat * tier.police), 0, 100) : 0;
}

/** Add heat to a place (capped), and say how hot it is now. */
export function heatPlace(cfg, state, id, n) {
  if (!n) return placeHeat(state, id);
  state.placeHeat = { ...(state.placeHeat ?? {}), [id]: clamp(placeHeat(state, id) + n, 0, cfg.heat.max) };
  return state.placeHeat[id];
}

// ── supply: what a place has to use up today ────────────────────────────────────────────────────────────────────────
/** What is left of one of a place's supplies today (a place nobody has drawn on is full). null: it has none. */
export function supplyLeft(cfg, state, id, what) {
  const s = placeOf(cfg, id).supply?.[what];
  if (!s) return null;
  return state.supply?.[id]?.[what] ?? s.max;
}
export function drawSupply(cfg, state, id, what, n = 1) {
  const left = supplyLeft(cfg, state, id, what);
  if (left === null) return null;
  state.supply = { ...(state.supply ?? {}), [id]: { ...(state.supply?.[id] ?? {}), [what]: Math.max(0, left - n) } };
  return state.supply[id][what];
}
/** Every place's supplies full, as a new run starts. */
export const fullSupply = cfg => Object.fromEntries(Object.entries(cfg.places).filter(([, p]) => p.supply)
  .map(([id, p]) => [id, Object.fromEntries(Object.entries(p.supply).map(([k, s]) => [k, s.max]))]));

// ── jobs and people ─────────────────────────────────────────────────────────────────────────────────────────────────
/** The jobs a place could deal you right now, the safe one first: what you are able to do (the stick-up needs the cutter). */
export function jobPool(cfg, state, place = state.place) {
  const jobs = placeOf(cfg, place).jobs;
  if (!jobs) return [];
  const all = Object.entries(jobs).map(([id, job]) => ({ id, ...job }));
  const able = all.filter(j => !j.needs || state.owned[j.needs]);
  return [...able.filter(j => j.safe), ...able.filter(j => !j.safe)];
}

/** The place a person belongs to (each person belongs to one). */
export const homeOfPerson = (cfg, id) => Object.keys(cfg.places).find(pl => (cfg.places[pl].people ?? []).some(p => p.id === id)) ?? null;

/** A person as the view and the events name them: { id, name, role }. */
export const whoOf = p => ({ id: p.id, name: p.name, role: p.role });

/** Days an old save's grudge has left (0: none). Since trust, a grudge is a person against you: offDays. */
export const grudgeLeft = (state, id) => Math.max(0, (state.grudges?.[id] ?? 0) - state.day + 1);

// ── trust: one number per person, kept across nights (config.mjs, `trust`) ──────────────────────────────────────────
/** A person's trust in you (0 for anyone you have not moved, or an older saved state). */
export const trustOf = (state, id) => state.trust?.[id] ?? 0;
/** Its band: 'against', 'neutral' or 'with'. */
export const trustBand = (cfg, n) => (n <= cfg.trust.against ? 'against' : n >= cfg.trust.with ? 'with' : 'neutral');
/**
 * Days a person will not deal with you, today included (0: they will): against you until the nightly drift brings them
 * back to neutral (or an old save's grudge still running).
 */
export function offDays(cfg, state, id) {
  const T = cfg.trust;
  const t = trustOf(state, id);
  const days = t <= T.against ? Math.floor((T.against - t) / Math.max(1, T.drift)) + 1 : 0;
  return Math.max(days, grudgeLeft(state, id));
}
/** The trust a change leaves (within min and max). */
export const trustAfter = (cfg, state, id, change) => clamp(trustOf(state, id) + change, cfg.trust.min, cfg.trust.max);
/** Whether a person is about at their place this hour (seeded on the day and the hour: the view shows it). */
export const isAround = (cfg, state, id) => rng(state.seed, 'run-around', state.day, state.hour, id)() * 100 < cfg.trust.aroundPct;
/** "won't deal with you, 2 days" */
export const offText = days => (days ? `won't deal with you, ${days} day${days > 1 ? 's' : ''}` : null);

/**
 * The people of a place with today's mood and whether they are out for the day (a version-1 state: nobody yet), and
 * their trust: the number, its band, the days they are off your table, and (asked for) whether they are about this hour. Out:
 * worked today, against you (off your table), or a regular with nothing of the place's custom left today.
 */
export function peopleOf(cfg, state, place, { around = false } = {}) {
  const custom = supplyLeft(cfg, state, place, 'custom');
  return (placeOf(cfg, place).people ?? []).map(p => {
    const today = state.people?.[p.id];
    const off = offDays(cfg, state, p.id);
    const dry = !!p.regular && custom !== null && custom <= 0;
    const trust = trustOf(state, p.id);
    return {
      ...whoOf(p), place, mood: today?.mood ?? (off ? 'sour' : 'calm'), out: !!today?.out || off > 0 || dry, regular: !!p.regular,
      trust, band: off ? 'against' : trustBand(cfg, trust), offDays: off, ...(around ? { around: isAround(cfg, state, p.id) } : {}),
    };
  });
}

/**
 * Who at a place would tell on a move there that heats it or is low (the bins): the people against you who are about
 * this hour, and the chance one of them calls it in (each tellPct; one roll). `pct` 0: nobody would.
 */
export function tellRisk(cfg, state, place = state.place) {
  const T = cfg.trust;
  const by = peopleOf(cfg, state, place).filter(p => p.band === 'against' && isAround(cfg, state, p.id));
  const pct = by.length ? clamp(Math.round(100 * (1 - (1 - T.tellPct / 100) ** by.length)), 0, 100) : 0;
  return { pct, by: by.map(whoOf), heat: pct ? T.tellHeat : 0 };
}

/**
 * Whose turn the safe job is: the place's people in its role in turn, from a seeded start each day, one along per
 * shift; anyone off your table (against you) is never dealt, and anyone whose mood skips the rota today (seen in the
 * bins) is passed over while anyone else is left. Everyone of the role against you: nobody (the job is dealt unnamed).
 */
export function safePerson(cfg, state, job, place = state.place) {
  const all = peopleOf(cfg, state, place).filter(p => p.role === job.role);
  const dealable = all.filter(p => !p.offDays);
  const willing = dealable.filter(p => !(cfg.rotaSkips ?? []).includes(p.mood));
  const cast = willing.length ? willing : dealable;
  if (!cast.length) return null;
  const start = Math.floor(rng(state.seed, 'run-rota', state.day, place)() * all.length);
  return cast[(start + (state.shifts?.[place] ?? 0)) % cast.length];
}

/**
 * The options dealt this hour: the safe one, then two drawn by the seeded dice from the rest, each with somebody of
 * its role who is not out today (an option with nobody left is not dealt). Same state, same deal. Each job comes with
 * `who`, the person it is done to or with, and `targets`: who it could be done to (the dealt one first, then anyone
 * else of its role who is free and not in another option this hour). The safe job's person is whose turn it is.
 */
export function deal(cfg, state, place = state.place) {
  const pool = jobPool(cfg, state, place);
  if (!pool.length) return [];
  const [safe, ...rest] = pool;
  const free = peopleOf(cfg, state, place).filter(p => !p.out);
  const taken = new Set();
  const drawn = new Map();
  for (const job of shuffle(rng(state.seed, 'run-deal', state.day, state.hour, place), rest)) {
    if (drawn.size === 2) break;
    const left = free.filter(p => p.role === job.role && !taken.has(p.id));
    if (!left.length) continue;
    const who = pick(rng(state.seed, 'run-who', state.day, state.hour, place, job.id), left);
    taken.add(who.id);
    drawn.set(job.id, who);
  }
  const spare = role => free.filter(p => p.role === role && !taken.has(p.id));
  const safeWho = safePerson(cfg, state, safe, place);
  // keep the drawn ones in the config's order, so the list reads the same way every hour
  return [
    { ...safe, who: safeWho, targets: safeWho ? [safeWho] : [] },
    ...rest.filter(j => drawn.has(j.id)).map(j => ({ ...j, who: drawn.get(j.id), targets: [drawn.get(j.id), ...spare(j.role)] })),
  ];
}

/** Nothing left at a place but the safe job: everybody else there has been worked today. */
export const isDry = (cfg, state, place = state.place) => !!placeOf(cfg, place).jobs && deal(cfg, state, place).length === 1;

/** What being with you adds to a job's pay at a place: withPay base dollars × the tier's pay (0 for anyone else). */
export const withUp = (cfg, place, who) => (who && trustBand(cfg, who.trust ?? 0) === 'with' ? Math.round((cfg.trust.withPay ?? 0) * (tierOf(cfg, place)?.pay ?? 1)) : 0);

/**
 * What a job pays done to its person: a regular pays payUp more for every sale they have had, up to payUpMax more;
 * someone with you pays withUp more.
 */
export function jobPay(cfg, state, job, place = state.place) {
  const friend = withUp(cfg, place, job.who);
  if (!job.who?.regular) return job.pay.map(x => x + friend);
  const r = cfg.regulars;
  const up = Math.min(r.payUpMax ?? 0, (r.payUp ?? 0) * (state.regulars?.[job.who.id] ?? 0));
  return job.pay.map(x => x + up + friend);
}

/** How a job would move its person's trust, win and fail (the job's own `trust`; 0 where it says nothing). */
export const jobTrust = job => ({ win: job.trust?.win ?? 0, fail: job.trust?.fail ?? 0 });
/** A job could be seen and told on: it can heat the place it is done in. */
export const canHeat = job => (job.winHeat ?? 0) > 0 || (job.failHeat ?? 0) > 0;

/** A job's label with its person in it. */
export const namedLabel = job => (job.who && job.named ? job.named.replace('{who}', job.who.name) : job.label);

/** A job's odds this hour, with the reasons. A sure job stays sure when you are tired. */
export function jobOdds(cfg, state, job) {
  const why = [];
  let pct = job.odds;
  if (pct < 100 && isTired(cfg, state)) {
    pct -= cfg.energy.tiredOdds;
    why.push(`tired −${cfg.energy.tiredOdds}`);
  }
  return { pct: clamp(pct, 0, 100), sure: pct >= 100, why };
}

// ── the street: robbing somebody passing, the bins, the shop ────────────────────────────────────────────────────────
/** Robbing somebody passing here: its odds (fewer worth trying on a hot street; tired), pay, and heat. */
export function robOdds(cfg, state, place = state.place) {
  const r = cfg.street.rob;
  const why = [];
  let pct = r.odds;
  const h = placeHeat(state, place);
  if (h) {
    pct -= r.perHeat * h;
    why.push(`the place's heat ${h} −${r.perHeat * h}`);
  }
  if (isTired(cfg, state)) {
    pct -= cfg.energy.tiredOdds;
    why.push(`tired −${cfg.energy.tiredOdds}`);
  }
  const tier = tierOf(cfg, place);
  // a tier may say how much a robbery heats its places (a crowd notices less than a quiet street)
  const [winHeat, failHeat] = tier?.robHeat ?? [r.winHeat, r.failHeat];
  return { pct: clamp(pct, 0, 100), why, pay: scale(r.base, tier?.pay ?? 1), winHeat, failHeat };
}

/** What the bins here can turn up: each find with its chance and its pay in dollars. */
export const binsFinds = (cfg, place) => cfg.street.bins.finds.map(f => ({ pct: f.pct, pay: scale(f.base, tierOf(cfg, place)?.pay ?? 1) }));

/** How many times you have done something at a place today: robbed there, dug its bins, bought an item from its shop. */
export const doneToday = (state, place, what) => state.today?.[place]?.[what] ?? 0;
export function countToday(state, place, what) {
  state.today = { ...(state.today ?? {}), [place]: { ...(state.today?.[place] ?? {}), [what]: doneToday(state, place, what) + 1 } };
}

/** The place's shop, with how many of each you have bought today. */
export const shopOf = (cfg, state, place = state.place) => (placeOf(cfg, place).shop ?? []).map(it => ({ ...it, bought: doneToday(state, place, it.item) }));

// ── danger ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Whoever jumps you: their strength in the contest (src/contest.mjs clamp and bands) and the chance of each band. */
export function jumpContest(cfg, state, place = state.place, { asleep = false } = {}) {
  const c = cfg.jump;
  const why = [];
  let raw = c.strength;
  const extra = tierOf(cfg, place)?.strength ?? 0;
  if (extra) {
    raw += extra;
    why.push(`a ${placeOf(cfg, place).tier} place +${extra}`);
  }
  if (asleep) {
    raw += cfg.rough.strength;
    why.push(`you are asleep +${cfg.rough.strength}`);
  }
  if (state.owned.cutter) {
    raw -= c.cutter;
    why.push(`your box cutter −${c.cutter}`);
  }
  if (!asleep && isTired(cfg, state)) {
    raw += cfg.energy.tiredJump;
    why.push(`you are tired +${cfg.energy.tiredJump}`);
  }
  const P = clamp(raw, cfg.contest.min, cfg.contest.max);
  return { P, raw, bands: chances(cfg, P), why };
}

/** What a jump in each band would take from what you carry: the inside pocket hides some from them. */
export function jumpTakes(cfg, state, carried = state.carried) {
  const c = cfg.jump;
  const finds = state.owned.pocket ? c.pocketFinds : 100;
  const take = pct => Math.round((carried * pct * finds) / 10000);
  return { clean: take(c.takePct.clean), messy: take(c.takePct.messy), fail: 0, disaster: 0 };
}

/**
 * The danger of one hour where you stand, from the state at the start of that hour: the chance whoever is about
 * jumps you (a tier with jumpers), how that fight would go, and the chance of a police stop (police about, heat here
 * 3 or more). `here` is false where nothing can act on you. `hoursThere` lets the view ask about the hour after this one.
 */
export function danger(cfg, state, { hoursThere = state.hoursThere, carried = state.carried, place = state.place } = {}) {
  const tier = tierOf(cfg, place);
  const stopPct = stopChance(cfg, state, place);
  if (!tier || (!tier.jump && !stopPct)) {
    return { here: false, jump: { chance: 0, bad: 0, scuffle: 0, why: [] }, stop: { chance: 0, why: [] } };
  }
  const j = cfg.jump;
  const steps = Math.floor(carried / j.perDollars);
  const raw = tier.jump ? Math.round((j.basePct + j.perHourPct * hoursThere + j.perStepPct * steps) * tier.jump) : 0;
  const chance = clamp(raw, 0, j.capPct);
  const why = tier.jump ? [`${j.basePct}% anyone`] : ['nobody jumps anyone here'];
  if (tier.jump && hoursThere) why.push(`${hoursThere} hour${hoursThere > 1 ? 's' : ''} here +${j.perHourPct * hoursThere}%`);
  if (tier.jump && steps) why.push(`$${carried} on you +${j.perStepPct * steps}%`);
  if (tier.jump && tier.jump !== 1) why.push(`a ${placeOf(cfg, place).tier} place ×${tier.jump}`);
  if (raw > j.capPct) why.push(`at most ${j.capPct}%`);
  const contest = jumpContest(cfg, state, place);
  const takes = jumpTakes(cfg, state, carried);
  const one = n => Math.round(n * 10) / 10;
  const jump = {
    chance,
    bad: one((chance * contest.bands.clean) / 100), // they win clean: all of it, and the clinic
    scuffle: one((chance * contest.bands.messy) / 100), // they win messy: half
    takes: { bad: takes.clean, scuffle: takes.messy },
    strength: contest.P,
    bands: contest.bands,
    why: [...why, ...contest.why],
  };
  const h = heatHere(cfg, state, place);
  const street = streetOf(cfg, place);
  const stopWhy = stopPct ? [`heat here ${h} (the higher of yours, ${state.heat}, and ${placeOf(cfg, street).label}'s, ${placeHeat(state, street)})`] : [];
  const stop = { chance: stopPct, seizes: carried, why: stopWhy };
  return { here: true, hoursThere, jump, stop };
}

/** The jumping roll's band (the city's one formula: src/contest.mjs bandOf). */
export const jumpBand = (cfg, P, roll) => bandOf(cfg, P, roll);

/** Tomorrow morning's energy after a night at home, in the clinic, in jail, or on the street. */
export function morningEnergy(cfg, state, night) {
  const e = cfg.energy;
  const less = { clinic: e.clinicMorning, jail: e.jailMorning, street: e.roughMorning }[night] ?? 0;
  return Math.max(e.minMorning, fullEnergy(cfg, state) - less);
}

/** What a fare costs and whether you can pay it from what you carry. */
export function fareFor(cfg, state, link = null) {
  const fare = link?.fare ?? cfg.subway.fare;
  return { fare, canPay: state.carried >= fare };
}

// ── regulars ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** How many times you have sold to a regular (it keeps across days). */
export const soldTo = (state, id) => state.regulars?.[id] ?? 0;

/** The chance a regular turns up at your door this morning. */
export function doorChance(cfg, sold) {
  const r = cfg.regulars;
  if (sold < r.doorAt) return 0;
  return clamp(r.doorPct + r.perSale * (sold - r.doorAt), 0, r.capPct);
}

/** Every regular in the city, with their place. */
export const regularsOf = cfg => Object.entries(cfg.places).flatMap(([place, p]) => (p.people ?? []).filter(x => x.regular).map(x => ({ ...whoOf(x), place })));

export const ownsAll = state => ITEMS.every(k => state.owned[k]);
