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
/** A place's entry (or a stop's on a route: config.mjs `stops`). */
export const placeOf = (cfg, id) => cfg.places[id] ?? cfg.stops?.[id] ?? {};
/** A stop on a route (not a place: it is passed on the way between two). */
export const isStop = (cfg, id) => !!cfg.stops?.[id];
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
/** Every place and stop with a supply: [id, entry]. */
export const supplied = cfg => [...Object.entries(cfg.places), ...Object.entries(cfg.stops ?? {})].filter(([, p]) => p.supply);
/** Every place's supplies full, as a new run starts (a stop's reads as full until it is drawn on: supplyLeft). */
export const fullSupply = cfg => Object.fromEntries(Object.entries(cfg.places).filter(([, p]) => p.supply)
  .map(([id, p]) => [id, Object.fromEntries(Object.entries(p.supply).map(([k, s]) => [k, s.max]))]));

// ── goods: what a selling job sells, bought by the pack from a place's connect (config.mjs `goods`, `connect`) ─────
/** Sales of a good on you, and at the crib (0 for a good you have none of, or an older saved state). */
export const goodsOn = (state, g) => state.goods?.[g] ?? 0;
export const goodsHome = (state, g) => state.stash?.[g] ?? 0;
/** What one sale of a good cost you: the pack's price over its sales (whole dollars). */
export const perSale = (cfg, g) => Math.round(cfg.goods[g].price / cfg.goods[g].sales);
/** What goods are worth, at their price a sale: a map of good → sales. */
export const goodsWorth = (cfg, goods = {}) => Object.entries(goods).reduce((a, [g, n]) => a + n * (cfg.goods[g] ? perSale(cfg, g) : 0), 0);
/** Only the goods with something in them: { good: sales }. */
export const someGoods = goods => Object.fromEntries(Object.entries(goods ?? {}).filter(([, n]) => n > 0));
/** "3 sales of loose cigarettes and 1 of bootleg films on disc" */
export function goodsText(cfg, goods) {
  const parts = Object.entries(someGoods(goods)).map(([g, n]) => `${n} sale${n > 1 ? 's' : ''} of ${cfg.goods[g]?.label ?? g}`);
  return parts.length ? parts.join(' and ') : 'nothing';
}
/**
 * The goods a selling job takes that you carry, each with what it pays there and what a sale of it cost you, the
 * best margin first (pay less its cost a sale). Empty: the job takes no goods, or you carry none it takes.
 */
export function goodsFor(cfg, state, job) {
  if (!job.goods) return [];
  return Object.keys(job.goods).filter(g => cfg.goods[g] && goodsOn(state, g) > 0)
    .map(g => ({ good: g, label: cfg.goods[g].label, pay: job.goodsPay?.[g] ?? job.pay, cost: perSale(cfg, g), carried: goodsOn(state, g) }))
    .sort((a, b) => (b.pay[0] + b.pay[1]) / 2 - b.cost - ((a.pay[0] + a.pay[1]) / 2 - a.cost));
}
/** The good a place's connect sells (null: none, or no connect). */
export const goodAt = (cfg, place) => Object.keys(cfg.goods ?? {}).find(g => cfg.goods[g].at === place) ?? null;
/** Where a good is bought: the place, and its connect's entry in that place's people. */
export function connectFor(cfg, g) {
  const place = cfg.goods[g]?.at;
  const c = placeOf(cfg, place).connect;
  const who = c ? (placeOf(cfg, place).people ?? []).find(p => p.id === c.who) : null;
  return { place, who: who ? whoOf(who) : null, spot: c?.spot ?? null };
}
/**
 * A place's connect as you find them now: who, where they sell, their good and its pack (what it costs you now: less
 * with you), how many packs they will still sell you today, and whether they will sell, with why not.
 */
export function connectOf(cfg, state, place) {
  const g = goodAt(cfg, place);
  const c = placeOf(cfg, place).connect;
  if (!g || !c) return null;
  const good = cfg.goods[g];
  const p = peopleOf(cfg, state, place).find(x => x.id === c.who);
  if (!p) return null;
  const off = p.band === 'with' ? Math.round((good.price * (cfg.connect.withOffPct ?? 0)) / 100) : 0;
  const bought = doneToday(state, place, `pack:${g}`);
  const left = good.perDay ? Math.max(0, good.perDay - bought) : null;
  const why = p.offDays ? `${p.name} won't sell to you: against you, ${p.offDays} day${p.offDays > 1 ? 's' : ''}`
    : left === 0 ? `${p.name} has sold you ${good.perDay} today: come back tomorrow` : null;
  return { place, who: whoOf(p), spot: c.spot ?? null, good: g, price: good.price - off, basePrice: good.price, off, sales: good.sales, perDay: good.perDay ?? null, left, bought, sells: !why, why, trust: p.trust, band: p.band, offDays: p.offDays };
}
/** What a jump in a band would take of the goods on you: all of them (clean), or half (messy); the pocket hides only cash. */
export function goodsTakes(cfg, state, band) {
  const pct = band === 'clean' ? cfg.jump.takePct.clean : band === 'messy' ? cfg.jump.takePct.messy : 0;
  return someGoods(Object.fromEntries(Object.entries(someGoods(state.goods)).map(([g, n]) => [g, Math.round((n * pct) / 100)])));
}
/** Every thing in the city's list, with where it is sold. */
export const thingsAt = (cfg, place) => Object.entries(cfg.things ?? {}).filter(([, t]) => t.at === place).map(([item, t]) => ({ item, ...t }));

// ── jobs and people ─────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The jobs a place could deal you right now, the safe one first: what you are able to do (the stick-up needs the
 * cutter; a selling job needs goods on you that it takes).
 */
export function jobPool(cfg, state, place = state.place) {
  const jobs = placeOf(cfg, place).jobs;
  if (!jobs) return [];
  const all = Object.entries(jobs).map(([id, job]) => ({ id, ...job }));
  const able = all.filter(j => (!j.needs || state.owned[j.needs]) && (!j.goods || goodsFor(cfg, state, j).length));
  return [...able.filter(j => j.safe), ...able.filter(j => !j.safe)];
}

/** A selling job as dealt: the good it would use (the best margin you carry, or the one named) and what it pays. */
export function withGood(cfg, state, job, name = null) {
  if (!job.goods) return job;
  const all = goodsFor(cfg, state, job);
  const use = (name ? all.find(x => x.good === name) : null) ?? all[0];
  return use ? { ...job, good: use.good, pay: use.pay, goodsHere: all } : job;
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
 * its role who is not out today (an option with nobody left is not dealt). A selling job whose goods you carry is
 * always one of the two while a buyer is left (slime, 2026-11-15: a player carrying goods sold nothing in two days). Same state, same deal. Each job comes with
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
  // (a selling job you carry goods for is always one of the two: what you paid a connect for is never left to the dice)
  const order = shuffle(rng(state.seed, 'run-deal', state.day, state.hour, place), rest);
  for (const job of [...order.filter(j => j.goods), ...order.filter(j => !j.goods)]) {
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
    ...rest.filter(j => drawn.has(j.id)).map(j => withGood(cfg, state, { ...j, who: drawn.get(j.id), targets: [drawn.get(j.id), ...spare(j.role)] })),
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
  // (goods on you do not make you likelier to be jumped: what is at stake is what a jump takes, `takesGoods` below)
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
    // and of the goods on you (the pocket hides only cash)
    takesGoods: { bad: goodsTakes(cfg, state, 'clean'), scuffle: goodsTakes(cfg, state, 'messy') },
    strength: contest.P,
    bands: contest.bands,
    why: [...why, ...contest.why],
  };
  const h = heatHere(cfg, state, place);
  const street = streetOf(cfg, place);
  const stopWhy = stopPct ? [`heat here ${h} (the higher of yours, ${state.heat}, and ${placeOf(cfg, street).label}'s, ${placeHeat(state, street)})`] : [];
  const onYou = someGoods(state.goods);
  const pinched = Object.keys(onYou).length > 0;
  const stop = { chance: stopPct, seizes: carried, seizesGoods: onYou, heatAfter: cfg.heat.afterJail + (pinched ? cfg.connect.stopHeat : 0), why: stopWhy };
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

// ── routes: the ways on foot between places (config.mjs `routes`, `ways`, `stops`) ───────────────────────────────────
/** Whether you can go a way: it needs nothing, or you own the thing it needs (the skateboard). */
export const canGo = (cfg, state, way) => !cfg.ways[way].needs || !!state.things?.[cfg.ways[way].needs];

/** The routes from a place: each with the place at its other end and its stops in the order you pass them from here. */
export function routesFrom(cfg, place) {
  return Object.entries(cfg.routes ?? {}).filter(([, r]) => r.between.includes(place)).map(([id, r]) => {
    const back = r.between[0] !== place;
    return { id, label: r.label, from: place, to: back ? r.between[0] : r.between[1], stops: back ? [...r.stops].reverse() : [...r.stops] };
  });
}

/** The hours a way takes from where you stand: setting out (from a place), then a leg on from each stop still ahead. */
export const wayHours = (cfg, way, stopsAhead, { fromStop = false } = {}) => (fromStop ? 0 : cfg.ways[way].hours) + cfg.ways[way].legHours * stopsAhead;

/** Energy to set out a way to a place: at least an hour's, and away from home enough to get back. */
export const wayNeeds = (cfg, way, to) => Math.max(cfg.energy.perHour, cfg.ways[way].energy) + (placeOf(cfg, to).door ? 0 : cfg.energy.rideBack);

/**
 * The danger of the rest of a way, leg by leg, at what you carry now: the hour you set out rolls where you stand (the
 * subway's leaving hour, `hoursThere` included); each leg on from a stop rolls that stop's ground, if it takes an hour
 * (on the board it takes none: nothing rolls). `legs` [{ from, to }] are the legs still ahead, the first from here.
 * Whole: the chance of being jumped (a bad one, a scuffle) or stopped on any leg, and what each would take.
 */
export function wayDanger(cfg, state, way, legs) {
  const w = cfg.ways[way];
  const one = n => Math.round(n * 10) / 10;
  const out = legs.map((leg, i) => {
    const hours = i === 0 && !isStop(cfg, leg.from) ? w.hours : w.legHours;
    const d = hours ? danger(cfg, state, { place: leg.from, hoursThere: i === 0 ? state.hoursThere : 0 }) : null;
    return { from: leg.from, to: leg.to, hours, rolls: !!d?.here, ground: d?.here ? leg.from : null,
      jump: d?.here ? { chance: d.jump.chance, bad: d.jump.bad, scuffle: d.jump.scuffle, takes: d.jump.takes, takesGoods: d.jump.takesGoods } : { chance: 0, bad: 0, scuffle: 0 },
      stop: d?.here ? { chance: d.stop.chance, seizes: d.stop.seizes, seizesGoods: d.stop.seizesGoods } : { chance: 0 } };
  });
  const any = key => one(100 * (1 - out.reduce((p, l) => p * (1 - key(l) / 100), 1)));
  const takes = jumpTakes(cfg, state, state.carried);
  return {
    legs: out,
    hours: out.reduce((a, l) => a + l.hours, 0),
    jump: { chance: any(l => l.jump.chance), bad: any(l => l.jump.bad), scuffle: any(l => l.jump.scuffle),
      takes: { bad: takes.clean, scuffle: takes.messy }, takesGoods: { bad: goodsTakes(cfg, state, 'clean'), scuffle: goodsTakes(cfg, state, 'messy') } },
    stop: { chance: any(l => l.stop.chance), seizes: state.carried, seizesGoods: someGoods(state.goods) },
  };
}

/** The cards a stop could deal you now: not yet played there today, and able (a sale needs a good on you it takes; the bins, some left). */
export function cardPool(cfg, state, stop) {
  return Object.entries(placeOf(cfg, stop).cards ?? {}).map(([id, c]) => ({ id, ...c }))
    .filter(c => doneToday(state, stop, `card:${c.id}`) < (c.perDay ?? 1))
    .filter(c => !c.needs || state.owned[c.needs])
    .filter(c => !c.goods || goodsFor(cfg, state, c).length)
    .filter(c => c.street !== 'bins' || (supplyLeft(cfg, state, stop, cfg.street.bins.draws) ?? 0) > 0);
}

/** The hand a stop deals you on arriving: `hand` of what it could deal, drawn by the seeded dice (the day, the hour, the stop), in the config's order. */
export function dealHand(cfg, state, stop) {
  const pool = cardPool(cfg, state, stop);
  const n = placeOf(cfg, stop).hand ?? pool.length;
  const drawn = new Set(shuffle(rng(state.seed, 'run-hand', state.day, state.hour, stop), pool).slice(0, n).map(c => c.id));
  return pool.filter(c => drawn.has(c.id)).map(c => c.id);
}

/** A card as it would be played now (null: not one of the stop's): a sale with the good it would use. */
export function cardOf(cfg, state, stop, id) {
  const c = placeOf(cfg, stop).cards?.[id];
  return c ? withGood(cfg, state, { id, ...c }) : null;
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

// ── home pressure (RUN.md, "Home pressure (home-1)"; config.mjs `pressure`, `raid`, `guard`) ───────────────────────
/** The street your crib's door opens onto: the home's place (null: no crib). */
export const homeStreet = cfg => placeOf(cfg, homeId(cfg)).inside ?? null;
/** On home ground: in the crib, or on the street its door opens onto (not on a route, not held). */
export const atHome = (cfg, state, place = state.place) => !state.route && (place === homeId(cfg) || (place != null && place === homeStreet(cfg)));
/** The home's own state (an older saved state: calm, nothing due, nobody on the step). */
export const homeOf = state => ({ marks: [], raid: null, last: null, guard: null, raids: [], ...(state.home ?? {}) });
/** Points of what you did at home that still hold the pressure up. */
export const marksTotal = state => (state.home?.marks ?? []).reduce((a, m) => a + m.n, 0);

/**
 * The pressure on your home: its value (0 to max) and every reason holding it where it is, in words: what you did
 * there (fading), who lives there against you or with you, and the place being hot. Never what you banked or own.
 */
export function pressureOf(cfg, state) {
  const P = cfg.pressure;
  const street = homeStreet(cfg);
  if (!P || !street) return null;
  const where = placeOf(cfg, street).where ?? `at ${placeOf(cfg, street).label}`;
  const reasons = (state.home?.marks ?? []).map(m => ({ kind: 'did', why: m.why, n: m.n, day: m.day, who: m.who ?? null, text: m.text }));
  for (const p of peopleOf(cfg, state, street)) {
    if (p.band === 'against' && P.against) reasons.push({ kind: 'person', why: 'against', n: P.against, who: whoOf(p), text: `${cap(p.name)} is against you` });
    else if (p.band === 'with' && P.with && !p.regular) reasons.push({ kind: 'person', why: 'with', n: P.with, who: whoOf(p), text: `${cap(p.name)} is with you and looks out for your door` });
  }
  if (P.hot && isHot(cfg, state, street)) reasons.push({ kind: 'place', why: 'hot', n: P.hot, who: null, text: `${cap(placeOf(cfg, street).label)} is hot (heat ${placeHeat(state, street)}): the police are about ${where}` });
  const raw = reasons.reduce((a, r) => a + r.n, 0);
  return { value: clamp(raw, 0, P.max), raw, max: P.max, warnAt: P.warnAt, place: street, reasons };
}

/** The chance a morning brings a warning at this pressure (0 under warnAt). */
export const warnChance = (cfg, value) => (value >= cfg.pressure.warnAt ? clamp(cfg.pressure.warnPct + cfg.pressure.perPoint * (value - cfg.pressure.warnAt), 0, cfg.pressure.capPct) : 0);

/** The mornings with no warning after an attempt: through day `last + rest`. */
export const restUntil = (cfg, state) => (homeOf(state).last == null ? null : homeOf(state).last + (cfg.pressure.rest ?? 0));

/** The things you own that defend your home, and what they make of an attempt: its chance with nobody home, its share. */
export function defencesOf(cfg, state) {
  const R = cfg.raid;
  const owned = Object.entries(cfg.things ?? {}).filter(([k, t]) => t.defends && state.things?.[k]).map(([item, t]) => ({ item, label: t.label, defends: { ...t.defends } }));
  const pct = Math.min(R.pct, ...owned.map(t => t.defends.pct ?? Infinity));
  const share = Math.min(R.share, ...owned.map(t => t.defends.share ?? Infinity));
  const by = key => owned.find(t => t.defends[key] != null && t.defends[key] === (key === 'pct' ? pct : share))?.item ?? null;
  return { owned, pct, share, pctBy: pct < R.pct ? by('pct') : null, shareBy: share < R.share ? by('share') : null };
}

/** What an attempt would take now: `share` percent of what is banked (never all of it), and of a scuffle at the door. */
export function raidTakes(cfg, state, banked = state.banked) {
  const d = defencesOf(cfg, state);
  const takes = Math.floor((banked * d.share) / 100);
  return { banked, share: d.share, takes, scuffle: Math.floor((takes * cfg.raid.messyShare) / 100) };
}

/** The fight at your door, theirs against yours: the regular's strength less the box cutter (src/contest.mjs bands). */
export function doorContest(cfg, state, strength = cfg.raid.strength) {
  const why = [`${strength} theirs`];
  let raw = strength;
  if (state.owned?.cutter) {
    raw -= cfg.jump.cutter;
    why.push(`your box cutter −${cfg.jump.cutter}`);
  }
  const P = clamp(raw, cfg.contest.min, cfg.contest.max);
  return { P, bands: chances(cfg, P), why };
}

/**
 * The guard: who (a person of the home's street), whether he is on and through which day (his stretch: `until`,
 * `daysLeft`, `lastDay`), his price for a stretch of `days` days (`wage`: that a day), whether he can be hired (or kept
 * on, on his last day) and why not (hurt, against you), and the fight at your step (their clean win beats him).
 * Against you he still finishes a stretch already paid for.
 */
export function guardOf(cfg, state) {
  const G = cfg.guard;
  const street = homeStreet(cfg);
  if (!G || !street) return null;
  const p = peopleOf(cfg, state, street).find(x => x.id === G.who);
  if (!p) return null;
  const g = homeOf(state).guard ?? {};
  const hurtDays = Math.max(0, (g.hurt ?? 0) - state.day + 1);
  // (a version-7 state's guard was on by the day: paid through the day it is)
  const until = g.on ? g.until ?? state.day : null;
  const on = !!g.on && !hurtDays && state.day <= until;
  const daysLeft = on ? until - state.day + 1 : 0;
  const why = hurtDays ? `${cap(p.name)} is hurt: back in ${hurtDays} day${hurtDays > 1 ? 's' : ''}`
    : p.offDays ? `${cap(p.name)} won't work for you: against you, ${p.offDays} day${p.offDays > 1 ? 's' : ''}` : null;
  const P = clamp(cfg.raid.strength - G.strength, cfg.contest.min, cfg.contest.max);
  const bands = chances(cfg, P);
  const text = on ? `${cap(p.name)} is on your step through day ${until}${daysLeft === 1 ? ': his last day' : ` (${daysLeft} days left)`}.`
    : why ?? `${cap(p.name)} is not on your step: $${G.price} for ${G.days} day${G.days > 1 ? 's' : ''}, paid up front at the crib.`;
  return { who: whoOf(p), on, wage: G.price / G.days, price: G.price, days: G.days, until: on ? until : null, daysLeft, lastDay: on && daysLeft === 1,
    hurtDays, available: !why, why, spot: G.spot ?? null, label: G.label ?? null, P, bands, beatenPct: bands.clean, trust: p.trust, band: p.band, text };
}

/**
 * Who cases your crib: a regular of the home's street against you (the grudge), else the one there most against you,
 * else a regular you have hooked, else a stranger (config pressure.stranger).
 */
export function raidCast(cfg, state) {
  const street = homeStreet(cfg);
  const folk = peopleOf(cfg, state, street);
  const against = folk.filter(p => p.band === 'against');
  const grudge = against.find(p => p.regular);
  if (grudge) return { ...whoOf(grudge), why: 'grudge' };
  if (against.length) return { ...whoOf(against.reduce((a, b) => (b.trust < a.trust ? b : a))), why: 'against' };
  const hooked = folk.find(p => p.regular && soldTo(state, p.id) >= cfg.regulars.doorAt);
  if (hooked) return { ...whoOf(hooked), why: 'hooked' };
  return { ...cfg.pressure.stranger, why: 'stranger' };
}
