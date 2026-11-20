// The run's rules as plain functions of (config, state). The view and the engine both call these, so the odds a
// player is shown and the odds the engine rolls can't disagree (the house rule from src/contest.mjs).
// No rule names a place: each reads the place's entry in the config (config.mjs, `places`).

import { rng, pick, shuffle } from '../rng.mjs';
import { bandOf, chances } from '../contest.mjs';
import { runDuel } from '../fight/duel.mjs';
import { tallied, bandOfJump } from './odds.mjs';
import { RIVALS, rivalFoe, EARL_WAYS } from '../fight/data.mjs';
import { heatFromRows, placeEffects, smellLevel, clockOf, rowOn } from './effects.mjs';
// (bench-1: the bottle on your belt, thrown first in a fight of several: make.mjs; the two import each other, functions only)
import { bottleOn, withBottle } from './make.mjs';

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
export const storedHeat = (state, id) => state.placeHeat?.[id] ?? 0;
/**
 * A place's heat now: what was done there, and (pot-1) one hotter while anyone there is under an effect that heats a
 * place (Disco Rash: "the place is one hotter" while they dance), never over the top (effects.mjs heatFromRows).
 */
export function placeHeat(state, id) {
  const h = storedHeat(state, id);
  if (!state.under) return h;
  const e = heatFromRows(state, id);
  return e.n ? Math.min(h + e.n, Math.max(h, e.top)) : h;
}

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
  state.placeHeat = { ...(state.placeHeat ?? {}), [id]: clamp(storedHeat(state, id) + n, 0, cfg.heat.max) };
  return placeHeat(state, id);
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
/** What one sale of a good cost you: the pack's price over its sales (whole dollars; pot-1: a made good or a making, exact). */
export const perSale = (cfg, g) => (cfg.goods[g].made || cfg.goods[g].making ? cfg.goods[g].price / cfg.goods[g].sales : Math.round(cfg.goods[g].price / cfg.goods[g].sales));
/** What goods are worth, at their price a sale: a map of good → sales. */
export const goodsWorth = (cfg, goods = {}) => Object.entries(goods).reduce((a, [g, n]) => a + n * (cfg.goods[g] ? perSale(cfg, g) : 0), 0);
/** Only the goods with something in them: { good: sales }. */
export const someGoods = goods => Object.fromEntries(Object.entries(goods ?? {}).filter(([, n]) => n > 0));

// ── (pot-1) goods that were made (RUN.md "The pot (pot-1)"; config.mjs madeGoods) ─────────────────────────────────────
/** A product's bags (`made`), a making that goes in (`making`), or a good bought from a connect. */
export const isMade = (cfg, g) => !!cfg.goods?.[g]?.made;
export const isMaking = (cfg, g) => !!cfg.goods?.[g]?.making;
export const isBought = (cfg, g) => !!cfg.goods?.[g] && !cfg.goods[g].made && !cfg.goods[g].making;
/** A dirty batch found out (its first bag taken, state.make[maker].known): from then it shows as itself. */
export const knownDirty = (cfg, state, g) => !!cfg.goods?.[g]?.dirty && !!state?.make?.[cfg.goods[g].maker]?.known?.[g];
/** The good a good shows as: a dirty batch not yet found out shows as its product (nobody can tell them apart). */
export const shownAs = (cfg, state, g) => (cfg.goods?.[g]?.dirty && !knownDirty(cfg, state, g) ? cfg.goods[g].clean : g);
/** The goods behind a good as it shows: itself, and every dirty batch of it not yet found out. */
export const behind = (cfg, state, g) => [g, ...Object.keys(cfg.goods ?? {}).filter(k => cfg.goods[k].clean === g && !knownDirty(cfg, state, k))];
/** A map of goods as it shows: { good as it shows: how many }. */
export function shownGoods(cfg, state, goods) {
  const out = {};
  for (const [g, n] of Object.entries(someGoods(goods))) out[shownAs(cfg, state, g)] = (out[shownAs(cfg, state, g)] ?? 0) + n;
  return out;
}
/** A good's name for the player: a product by the name the player gave it, a dirty batch found out said so. */
export function goodLabel(cfg, state, g) {
  const G = cfg.goods?.[g];
  if (!G) return g;
  // (bench-1: a bag from the kitchen in a bottle, by the bag's name: "Swamp Bedtime in a bottle")
  if (G.bag && cfg.goods[G.bag]) return `${goodLabel(cfg, state, G.bag)} in a ${G.unit ?? 'bottle'}`;
  const named = G.product ? state?.make?.[G.maker]?.book?.names?.[G.product] : null;
  const base = named ?? G.label;
  return G.dirty && knownDirty(cfg, state, g) ? `${base}, dirty` : base;
}
const plural = u => (/(x|s|ch|sh)$/.test(u) ? `${u}es` : `${u}s`);
/** "3 sales of loose cigarettes and 1 of bootleg films on disc"; (pot-1) "2 bags of Zonked", "1 tin of night tea" */
export function goodsText(cfg, goods, state = null) {
  const sums = new Map();
  for (const [g, n] of Object.entries(someGoods(goods))) {
    const G = cfg.goods[g];
    const label = state && G ? goodLabel(cfg, state, shownAs(cfg, state, g)) : G?.label ?? g;
    const unit = G?.unit ?? 'sale';
    const k = `${unit}|${label}`;
    sums.set(k, { unit, label, n: (sums.get(k)?.n ?? 0) + n });
  }
  const parts = [...sums.values()].map(x => `${x.n} ${x.n > 1 ? plural(x.unit) : x.unit} of ${x.label}`);
  return parts.length ? parts.join(' and ') : 'nothing';
}
/**
 * The goods a selling job takes that you carry, each with what it pays there and what a sale of it cost you, the
 * best margin first (pay less its cost a sale). Empty: the job takes no goods, or you carry none it takes.
 * (pot-1: as they show: a dirty batch not yet found out is counted in its product's, named as the player named it)
 */
export function goodsFor(cfg, state, job) {
  if (!job.goods) return [];
  return Object.keys(job.goods).filter(g => cfg.goods[g] && shownAs(cfg, state, g) === g)
    .map(g => [g, behind(cfg, state, g).reduce((a, k) => a + goodsOn(state, k), 0)]).filter(([, n]) => n > 0)
    .map(([g, n]) => ({ good: g, label: goodLabel(cfg, state, g), pay: job.goodsPay?.[g] ?? job.pay, cost: perSale(cfg, g), carried: n, ...(isMade(cfg, g) ? { made: true } : {}) }))
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
  // (pot-1: a made thing sold: its name, for a job that says it, `madeNamed`)
  return use ? { ...job, good: use.good, pay: use.pay, goodsHere: all, ...(use.made ? { madeLabel: use.label } : {}) } : job;
}

/** The place a person belongs to (each person belongs to one). */
export const homeOfPerson = (cfg, id) => Object.keys(cfg.places).find(pl => (cfg.places[pl].people ?? []).some(p => p.id === id)) ?? null;

/** A person as the view and the events name them: { id, name, role }. */
export const whoOf = p => ({ id: p.id, name: p.name, role: p.role });

// ── people remember: a mark for a week (memory-1, RUN.md "People remember"; config.mjs `memory`) ────────────────────
/** A person's entry in the config (null: nobody of the city). */
export const personOf = (cfg, id) => Object.values(cfg.places).flatMap(p => p.people ?? []).find(p => p.id === id) ?? null;
/** The live mark a person holds of you (null: none, it ran out, or an older saved state): { kind, day, place, who, left, ... }. */
export function markOn(cfg, state, id) {
  const M = cfg.memory;
  const m = M ? state.marks?.[id] : null;
  if (!m || !M.kinds[m.kind]) return null;
  const left = m.day + M.days - state.day;
  return left > 0 ? { ...m, left, ...M.kinds[m.kind] } : null;
}
/** They give way to you: a live mark of a kind that brings fear. */
export const fears = (cfg, state, id) => !!markOn(cfg, state, id)?.fear;
/** No sales to them, no work from them: a live mark of a kind that hates. */
export const hates = (cfg, state, id) => !!markOn(cfg, state, id)?.hates;
/** A job that is work or a sale (their mood on a win is friendly): never dealt with somebody who hates you. */
export const friendlyJob = job => job?.mood?.win === 'friendly';
/** The words for a person: 'he', 'she' or 'they' (the config's `pronoun`), and its forms. */
export function pronouns(cfg, id) {
  const p = personOf(cfg, id)?.pronoun ?? 'they';
  return { they: p, them: { he: 'him', she: 'her' }[p] ?? 'them', their: { he: 'his', she: 'her' }[p] ?? 'their' };
}
/** A kind's words filled in: {they} {them} {their} {Name} {name} {day} {left}. */
export function markWords(cfg, state, text, m) {
  const pr = pronouns(cfg, m.who.id);
  const left = m.left ?? 0;
  return String(text ?? '').replace(/\{they\}/g, pr.they).replace(/\{them\}/g, pr.them).replace(/\{their\}/g, pr.their)
    .replace(/\{Name\}/g, cap(m.who.name)).replace(/\{name\}/g, m.who.name).replace(/\{day\}/g, String(m.day))
    .replace(/\{left\}/g, `${left} more day${left === 1 ? '' : 's'}`);
}
/**
 * Every live mark, as the view and the People panel say them: who, their place, the kind, the day, the days left
 * (today included), whether they fear you, and the line ("you beat him on day 2 · gives way for 5 more days").
 */
export function marksOf(cfg, state) {
  if (!cfg.memory) return [];
  return Object.keys(state.marks ?? {}).map(id => markOn(cfg, state, id)).filter(Boolean).map(m => {
    const did = markWords(cfg, state, m.did, m);
    const words = markWords(cfg, state, m.words, m);
    const due = m.comesDue ? m.day + cfg.memory.days : null;
    return { who: { ...m.who }, place: m.place, kind: m.kind, day: m.day, left: m.left, until: m.day + cfg.memory.days - 1, fear: !!m.fear, hates: !!m.hates, holds: !!m.holds, due, warned: !!m.warned,
      did, words, text: `${did} · ${words}` };
  });
}

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
    // (memory-1: a mark of you that lasts the week: they fear you, or will not buy from you or work with you)
    const mark = markOn(cfg, state, p.id);
    return {
      ...whoOf(p), place, mood: today?.mood ?? (off ? 'sour' : 'calm'), out: !!today?.out || off > 0 || dry, regular: !!p.regular,
      trust, band: off ? 'against' : trustBand(cfg, trust), offDays: off, ...(around ? { around: isAround(cfg, state, p.id) } : {}),
      ...(mark ? { mark: mark.kind, fears: !!mark.fear, hates: !!mark.hates, quiet: !!mark.fear && !mark.tells } : {}),
    };
  });
}

/**
 * Who at a place would tell on a move there that heats it or is low (the bins): the people against you who are about
 * this hour, and the chance one of them calls it in (each tellPct; one roll). `pct` 0: nobody would.
 */
export function tellRisk(cfg, state, place = state.place) {
  const T = cfg.trust;
  // (pot-1: while anyone there is under an effect that says so, Disco Rash's dancing, nobody there tells on you)
  const quiet = state.under ? placeEffects(cfg, state, place).noTell : [];
  if (quiet.length) return { pct: 0, by: [], heat: 0, quietBy: quiet };
  // (memory-1: whoever fears you does not tell)
  const by = peopleOf(cfg, state, place).filter(p => p.band === 'against' && !p.quiet && isAround(cfg, state, p.id));
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
  // (memory-1: and nobody who hates you works with you)
  const dealable = all.filter(p => !p.offDays && !(p.hates && friendlyJob(job)));
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
    // (memory-1: no sales to anyone who hates you, no work from them)
    const left = free.filter(p => p.role === job.role && !taken.has(p.id) && !(p.hates && friendlyJob(job)));
    if (!left.length) continue;
    const who = pick(rng(state.seed, 'run-who', state.day, state.hour, place, job.id), left);
    taken.add(who.id);
    drawn.set(job.id, who);
  }
  const spare = job => free.filter(p => p.role === job.role && !taken.has(p.id) && !(p.hates && friendlyJob(job)));
  const safeWho = safePerson(cfg, state, safe, place);
  // keep the drawn ones in the config's order, so the list reads the same way every hour
  return [
    { ...safe, who: safeWho, targets: safeWho ? [safeWho] : [] },
    ...rest.filter(j => drawn.has(j.id)).map(j => withGood(cfg, state, { ...j, who: drawn.get(j.id), targets: [drawn.get(j.id), ...spare(j)] })),
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
export function namedLabel(job) {
  // (pot-1: selling a made thing, the job's `madeNamed`, with what it is: "Sell Zonked to Shaky Dee at the bus stop")
  const named = job.madeLabel && job.madeNamed ? job.madeNamed.replace('{what}', job.madeLabel) : job.named;
  return job.who && named ? named.replace('{who}', job.who.name) : job.madeLabel && job.madeNamed ? job.madeNamed.replace('{what}', job.madeLabel).replace(' to {who}', '') : job.label;
}

/** A job's odds this hour, with the reasons. A sure job stays sure when you are tired. */
export function jobOdds(cfg, state, job) {
  const why = [];
  let pct = job.odds;
  // (memory-1: somebody who fears you pays up: a job that says so is sure with them)
  if (pct < 100 && job.feared === 'sure' && job.who && fears(cfg, state, job.who.id)) return { pct: 100, sure: true, why: ['fears you: pays up'], feared: true };
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

/** Food: a shop entry that is food (kind 'food', or one that gives energy). */
export const isFood = it => (it.kind ?? 'food') === 'food' && !!it.gives?.energy;
/**
 * Food and drink bought today, every place and stop counted together, against the day's cap (config `food`):
 * { eaten, perDay, left, full, text }. (perDay null: no cap.)
 */
export function foodToday(cfg, state) {
  let eaten = 0;
  for (const [id, p] of [...Object.entries(cfg.places), ...Object.entries(cfg.stops ?? {})]) for (const it of p.shop ?? []) if (isFood(it)) eaten += doneToday(state, id, it.item);
  const perDay = cfg.food?.perDay ?? null;
  const left = perDay == null ? null : Math.max(0, perDay - eaten);
  const full = left === 0;
  return { eaten, perDay, left, full, text: perDay == null ? null : full ? cap(cfg.food.full ?? 'you have eaten all you can today') : `${eaten} of ${perDay} today` };
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
  // (pot-1: while anyone there dances, the jumpers watch the show: an effect's `place.jumpPct`, Disco Rash's quarter (bench-1))
  const fx = state.under && raw ? placeEffects(cfg, state, place) : null;
  const shown = fx && fx.jumpPct < 100 ? Math.round((Math.min(raw, j.capPct) * fx.jumpPct) / 100) : null;
  const chance = shown ?? clamp(raw, 0, j.capPct);
  const why = tier.jump ? [`${j.basePct}% anyone`] : ['nobody jumps anyone here'];
  if (tier.jump && hoursThere) why.push(`${hoursThere} hour${hoursThere > 1 ? 's' : ''} here +${j.perHourPct * hoursThere}%`);
  if (tier.jump && steps) why.push(`$${carried} on you +${j.perStepPct * steps}%`);
  if (tier.jump && tier.jump !== 1) why.push(`a ${placeOf(cfg, place).tier} place ×${tier.jump}`);
  if (raw > j.capPct) why.push(`at most ${j.capPct}%`);
  // (bench-1: the dance's cover is a quarter now, "a quarter less often")
  if (shown != null) why.push(`somebody is ${cfg.make.effects[fx.by[0]?.effect]?.label ?? 'under something'} here: ${{ 50: 'half as often', 75: 'a quarter less often' }[fx.jumpPct] ?? `${fx.jumpPct}% as often`}`);
  const contest = jumpContest(cfg, state, place);
  // (styles-1: getting jumped is a fight you watch, two at once: its bands are a sample of that very fight, as a card's
  // odds are; `fight` says who brings what. The dice's numbers stay for a test that rigs a roll, and for sleeping rough)
  const fightJ = tier.jump ? jumpsFight(cfg) : false;
  const bands = fightJ ? jumpChances(cfg, state, place) : contest.bands;
  const jf = fightJ ? jumpOf(cfg, state, place) : null;
  const takes = jumpTakes(cfg, state, carried);
  const one = n => Math.round(n * 10) / 10;
  const jump = {
    chance,
    bad: one((chance * bands.clean) / 100), // they win clean: all of it, and the clinic
    scuffle: one((chance * bands.messy) / 100), // they win messy: half
    takes: { bad: takes.clean, scuffle: takes.messy },
    // and of the goods on you (the pocket hides only cash)
    takesGoods: { bad: goodsTakes(cfg, state, 'clean'), scuffle: goodsTakes(cfg, state, 'messy') },
    strength: contest.P,
    bands,
    tired: isTired(cfg, state),
    ...(jf ? { fight: { you: jf.you.text, them: jf.them.text, arm: jf.you.arm, with: jf.you.label, seeOff: bands.fail, bad: bands.clean, scuffle: bands.messy,
      // (the same jump with each other thing you own to fight with: the share you see them off)
      byArm: Object.fromEntries(armsOf(cfg, state).map(a => [a, a === jf.you.arm ? bands.fail : jumpChances(cfg, state, place, { arm: a }).fail])),
      // (bench-1: a bottle on your belt, thrown first: what it is, and the share you see them off with it and without it)
      ...(jf.you.bottle ? { bottle: { ...jf.you.bottle, seeOff: bands.fail, without: jf.you.bottle.inFight ? jumpChances(cfg, state, place, { bottle: null }).fail : bands.fail } } : {}),
      text: `two at once: you see them off about ${Math.round(bands.fail / 10)} in 10 (${jf.you.text})` } } : {}),
    why: [...why, ...(jf ? [jf.them.text, `you: ${jf.you.text}`] : contest.why)],
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

/** The cards a stop could deal you now: not yet played there today, and able (a sale needs a good on you it takes; the bins, some left; the barber, heat of your own). */
export function cardPool(cfg, state, stop) {
  return Object.entries(placeOf(cfg, stop).cards ?? {}).map(([id, c]) => ({ id, ...c }))
    .filter(c => doneToday(state, stop, `card:${c.id}`) < (c.perDay ?? 1))
    .filter(c => !c.needs || state.owned[c.needs])
    // (batch-1: a card that cools your own heat is dealt only when you have some: the barber)
    .filter(c => !c.minHeat || state.heat >= c.minHeat)
    .filter(c => !c.goods || goodsFor(cfg, state, c).length)
    .filter(c => c.street !== 'bins' || (supplyLeft(cfg, state, stop, cfg.street.bins.draws) ?? 0) > 0);
}

/**
 * The hand a stop deals you on arriving: `hand` of what it could deal, drawn by the seeded dice (the day, the hour, the
 * stop), in the config's order. A shop on the walk (a card with `beside`) is no part of the draw: it stands beside the
 * hand whenever it can be used, and never takes one of the hand's places from a card that pays.
 */
export function dealHand(cfg, state, stop) {
  const pool = cardPool(cfg, state, stop);
  const dealt = pool.filter(c => !c.beside);
  const n = placeOf(cfg, stop).hand ?? dealt.length;
  const drawn = new Set(shuffle(rng(state.seed, 'run-hand', state.day, state.hour, stop), dealt).slice(0, n).map(c => c.id));
  return pool.filter(c => c.beside || drawn.has(c.id)).map(c => c.id);
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
    // (memory-1: whoever fears you, by `memory.fear.pressure`, keeps the lane off your door; they hate you all the same)
    if (p.fears && cfg.memory?.fear?.pressure) reasons.push({ kind: 'person', why: 'fears', n: cfg.memory.fear.pressure, who: whoOf(p), text: `${cap(p.name)} is scared of you` });
    if (p.band === 'against' && P.against) reasons.push({ kind: 'person', why: 'against', n: P.against, who: whoOf(p), text: `${cap(p.name)} is against you` });
    else if (p.band === 'with' && P.with && !p.regular) reasons.push({ kind: 'person', why: 'with', n: P.with, who: whoOf(p), text: `${cap(p.name)} is with you and looks out for your door` });
  }
  if (P.hot && isHot(cfg, state, street)) reasons.push({ kind: 'place', why: 'hot', n: P.hot, who: null, text: `${cap(placeOf(cfg, street).label)} is hot (heat ${placeHeat(state, street)}): the police are about ${where}` });
  // (pot-1: the smell of your cooking, a level, not a pile: effects.mjs smellLevel)
  const sm = cfg.make?.smell ? smellLevel(cfg, state) : null;
  if (sm?.level) reasons.push({ kind: 'smell', why: 'smell', n: sm.level, who: null, text: `The smell of your cooking hangs over ${placeOf(cfg, street).label}${sm.off ? ' (the fan takes the edge off)' : ''}` });
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
  // (raid-1: what the cereal box holds is never found: the share is of the rest)
  const takes = Math.floor((Math.max(0, banked - (defVal(cfg, state, 'stash') ?? 0)) * d.share) / 100);
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
  // (memory-1: whoever fears you is never the one casing it)
  const folk = peopleOf(cfg, state, street).filter(p => !p.fears);
  const against = folk.filter(p => p.band === 'against');
  const grudge = against.find(p => p.regular);
  if (grudge) return { ...whoOf(grudge), why: 'grudge' };
  if (against.length) return { ...whoOf(against.reduce((a, b) => (b.trust < a.trust ? b : a))), why: 'against' };
  const hooked = folk.find(p => p.regular && soldTo(state, p.id) >= cfg.regulars.doorAt);
  if (hooked) return { ...whoOf(hooked), why: 'hooked' };
  return { ...cfg.pressure.stranger, why: 'stranger' };
}

// ── fights (duel-1, RUN.md "Fights") ────────────────────────────────────────────────────────────────────────────────
// A job that goes wrong to somebody's face, and the regular at your door who swings, are a one-on-one of the fight's
// own simulation (src/fight/duel.mjs), seeded from the run's dice: that fight is the outcome. What each side brings is
// here; the card's estimate is a sample of the same fight at the same inputs (config.mjs `duel`).

/** A job that is a fight when it goes wrong: its entry says `fight: 'fail'`, and the config has fights. */
export const fightsOnFail = (cfg, job) => !!cfg.duel && job?.fight === 'fail';
/**
 * (memory-1) That job, done to its person now, is a fight when it goes wrong: not with somebody who fears you when the job
 * says `feared` (the debt: they pay up without a fight). A lift is still a fight: caught, even the scared fight back
 * (measured: with lifts conceded the docks paid within 3% of the market, mark P1).
 */
export const fightsNow = (cfg, state, job, who = job?.who) => fightsOnFail(cfg, job) && !(job?.feared && who && fears(cfg, state, who.id));
/** The regular at your door who swings is a fight, not the contest's roll. */
export const doorFights = cfg => !!cfg.duel?.door;

/** Your health at the start of a fight, from your energy: a full bar at the bed's full energy, floorPct of it at none. */
export function duelHealth(cfg, energy) {
  const H = cfg.duel.hp;
  const e = clamp(energy, 0, H.of);
  return Math.round((H.max * (H.floorPct + ((100 - H.floorPct) * e) / H.of)) / 100);
}

/** How tough a person is (their health in a fight): their role's base, else the ordinary, give or take spread by their id. */
export function toughnessOf(cfg, who) {
  const D = cfg.duel.foe;
  const base = D.base?.[who?.role] ?? D.ordinary;
  const s = D.spread ?? 0;
  return base + (s ? Math.floor(rng('run-duel-tough', who?.id ?? 'nobody')() * (2 * s + 1)) - s : 0);
}
/** A toughness in words, against the ordinary. */
const toughWord = (cfg, hp) => {
  const d = hp - cfg.duel.foe.ordinary;
  return d >= 5 ? 'tough' : d >= 2 ? 'tougher than most' : d <= -5 ? 'slight' : d <= -2 ? 'not much of a fighter' : 'as tough as most';
};

// ── fight with, and who fights how (styles-1, RUN.md "Fights in the run: styles and getting jumped") ──────────────
/** The punch styles you have learned (a version-9 state: none). */
export const knows = (state, s) => !!state.styles?.[s];
/** What you could fight with now: bare hands, each punch style you know, the box cutter if you own it. */
export function armsOf(cfg, state) {
  return ['hands', ...Object.keys(cfg.styles ?? {}).filter(s => knows(state, s) && cfg.duel.you[s]), ...(state.owned?.cutter ? ['cutter'] : [])];
}
/** What you fight with: the standing choice while it is still yours, else the box cutter if you own it, else bare hands. */
export function armOf(cfg, state) {
  const w = state.fightWith;
  if (w && w !== 'auto' && armsOf(cfg, state).includes(w)) return w;
  return state.owned?.cutter ? 'cutter' : 'hands';
}
/** Its words: 'bare hands', 'box cutter', 'quick hands'… */
export const armLabel = (cfg, arm) => cfg.duel?.you?.[arm]?.label ?? arm;
/** How a person fights: their `style` (config people; a sent tough's own), a key of RIVALS, else the plain brawler. */
export function styleOf(cfg, who) {
  const s = who?.style ?? (who?.id ? personOf(cfg, who.id)?.style : null);
  return RIVALS[s] ? s : 'brawler';
}
/** Where a punch style is taught: the place, who teaches it and where they stand, the price. */
export function taughtAt(cfg, s) {
  const S = cfg.styles?.[s];
  if (!S) return null;
  const p = placeOf(cfg, S.at);
  const k = (p.people ?? []).find(x => x.id === S.keeper);
  return { style: s, place: S.at, placeLabel: p.label, where: p.where ?? `at ${p.label}`, keeper: k ? whoOf(k) : null, spot: S.spot ?? null, price: S.price,
    text: `${k ? `${k.name} teaches it ` : ''}${p.where ?? `at ${p.label}`}, $${S.price}` };
}

/**
 * WHO BRINGS WHAT to a fight with `who`, at `energy` (the energy before the hour): what you fight with (styles-1: the
 * standing choice, armOf; `arm` another, for a card's comparison or the advice) and your health from your energy, each
 * with why in words; their style (styles-1: RIVALS, rivalFoe) and their toughness. `inputs` is the fight's own
 * (src/fight/duel.mjs).
 */
export function duelOf(cfg, state, who, energy = state.energy, plus = 0, { arm = null } = {}) {
  const D = cfg.duel;
  const a = arm ?? armOf(cfg, state);
  const A = D.you[a];
  const hp = duelHealth(cfg, energy);
  const max = D.hp.max;
  const pct = Math.round((hp / max) * 100);
  const tired = energy <= cfg.energy.tiredAt;
  const health = hp >= max ? 'rested: you start at full health' : `${tired ? 'tired' : `energy ${energy}`}: you start at ${pct}%`;
  const weapon = A.label ?? a;
  // (memory-1: `plus`, rested and ready: the visit that comes due at your door)
  const them = toughnessOf(cfg, who) + plus;
  const tough = `${toughWord(cfg, them)}${plus ? `, rested and ready (+${plus})` : ''}`;
  const style = styleOf(cfg, who);
  const says = RIVALS[style].says;
  return {
    you: { arm: a, weapon: A.weapon, label: weapon, hp, max, pct, energy, tired, why: [weapon, health], text: `${weapon}; ${health}` },
    them: { id: who?.id ?? null, name: who?.name ?? 'them', role: who?.role ?? null, hp: them, max: them, tough, style, says, why: [says, tough], text: `${says}; ${tough}` },
    inputs: {
      you: { weapon: A.weapon, hp, max, hits: A.hits },
      foe: rivalFoe(style, { id: 'them', name: who?.name ?? 'them', hp: them }),
      cap: D.cap, hit: D.hit / 100, brawl: { ...D.brawl }, arena: { ...D.arena },
    },
  };
}

/**
 * A fight as the contest's band, for whatever was decided by the contest's four bands before (the door now; getting
 * jumped and the attempt on your crib, once switched on): won is their losing ('fail'); lost is their clean win while
 * they have more than doorClean percent of their health left, else the scuffle ('messy').
 */
export const duelBand = (cfg, duel) => (duel.result === 'won' ? 'fail' : duel.them.leftPct > cfg.duel.doorClean ? 'clean' : 'messy');

/**
 * The chance you win a fight with `who` now, from the config's sample of the same fight: { pct, in10, n, text }. Kept
 * per config by what decides the fight's inputs (what you fight with, the energy, the person), so a view drawn every
 * hour of a headless season asks the sample once per case, not once per hour (odds.mjs keeps the sample's count: the
 * same fights, seeds and rounding as src/fight/duel.mjs duelOdds).
 */
const CHANCES = new WeakMap();
export function duelChance(cfg, state, who, energy = state.energy, plus = 0, { arm = null } = {}) {
  const kept = CHANCES.get(cfg) ?? new Map();
  CHANCES.set(cfg, kept);
  const a = arm ?? armOf(cfg, state);
  const key = `${a}|${energy}|${who?.id ?? ''}|${who?.role ?? ''}|${who?.name ?? ''}|${styleOf(cfg, who)}|${plus}`;
  let c = kept.get(key);
  if (!c) {
    const o = wonShare(duelOf(cfg, state, who, energy, plus, { arm: a }).inputs, cfg.duel.sample);
    // (smooth-1: on the page, a sample still being worked out in the background: NaN, and not kept)
    if (!o) return { pct: NaN, in10: NaN, n: cfg.duel.sample, text: 'you win about NaN in 10', pending: true };
    c = Object.freeze({ pct: o.pct, in10: o.in10, n: o.n, text: `you win about ${o.in10} in 10` });
    if (kept.size > 4000) kept.clear();
    kept.set(key, c);
  }
  return { ...c };
}
/**
 * The share of `n` one-on-ones at these inputs that you win, as src/fight/duel.mjs duelOdds has it ({ won, n, pct,
 * in10 }, the same seeds and the same rounding), from the count kept in odds.mjs; null while the page waits for it.
 */
function wonShare(inputs, n) {
  const t = tallied(inputs, n);
  if (!t) return null;
  return { won: t.won, n, pct: Math.round((t.won / n) * 100), in10: Math.round((t.won / n) * 10) };
}

/**
 * THE FIGHT ITSELF: one run of the simulation, its seed from the run's dice (`keys`), headless; the page plays the same
 * seed on its stage. → the event's `duel`: the result, the seed, the inputs, who brought what, how long it went, the
 * health each had left, and whether the cap decided it.
 */
export function fightOut(cfg, state, who, keys, energy = state.energy, plus = 0) {
  const d = duelOf(cfg, state, who, energy, plus);
  const seed = Math.floor(rng(state.seed, 'run-duel', ...keys)() * 2147483647);
  const F = runDuel(d.inputs, seed);
  const [me, foe] = F.people;
  return {
    result: F.over.result, seed, seconds: F.over.t, capped: !!F.capped, inputs: d.inputs,
    you: { ...d.you, left: me.hp }, them: { ...d.them, left: foe.hp, leftPct: Math.round((foe.hp / foe.max) * 100) },
    chance: duelChance(cfg, state, who, energy, plus),
  };
}

// ── getting jumped, a fight you watch (styles-1) ────────────────────────────────────────────────────────────────────
/** Getting jumped is a fight (config `jumped.fight`), not the contest's dice. */
export const jumpsFight = cfg => !!cfg.jumped?.fight && !!cfg.duel;

/**
 * WHO JUMPS YOU, AND WHAT YOU BRING (styles-1): two at once, a heavy and a runner, on the run's own numbers (config
 * `jumped`), each the tougher by the tier's `strength` × their `perStrength` (the docks' jumpers); you with what you fight
 * with (armOf, or `arm`), fresh or tired (`jumped.you`: an ambush gives you no time to be anything else). `inputs` is
 * the fight's own (src/fight/duel.mjs, `foes`).
 */
export function jumpOf(cfg, state, place = state.place, { arm = null, tired = null, bottle } = {}) {
  const J = cfg.jumped;
  // (bench-1: the bottle on your belt, thrown in the first second: `bottle` another, or null for none)
  const b = bottle === undefined ? bottleOn(cfg, state) : bottle;
  const D = cfg.duel;
  const a = arm ?? armOf(cfg, state);
  const A = D.you[a];
  const t = tired ?? isTired(cfg, state);
  const hp = t ? J.you.tired : J.you.fresh;
  const extra = tierOf(cfg, place)?.strength ?? 0;
  const weapon = A.label ?? a;
  const health = `${t ? 'tired' : 'fresh'}: you start at ${Math.round((hp / D.hp.max) * 100)}%`;
  const foes = J.foes.map(f => ({ id: f.id, kind: f.kind, name: f.name, weapon: f.weapon, hp: Math.round(f.hp + extra * (f.perStrength ?? 0)), hits: f.hits, speed: f.speed, ...(f.reel !== undefined ? { reel: f.reel } : {}), ...(f.soak ? { soak: f.soak } : {}) }));
  const tough = extra ? `a ${placeOf(cfg, place).tier} place: tougher (+${extra})` : null;
  const says = J.says;
  return {
    you: { arm: a, weapon: A.weapon, label: weapon, hp, max: D.hp.max, pct: Math.round((hp / D.hp.max) * 100), tired: t, why: [weapon, health, ...bottleWhy(b)], text: [`${weapon}; ${health}`, ...bottleWhy(b)].join('; '), ...(b ? { bottle: bottleNote(b) } : {}) },
    them: { name: J.name, says, foes: foes.map(f => ({ id: f.id, kind: f.kind, name: f.name, hp: f.hp })), why: [says, ...(tough ? [tough] : [])], text: `${says}${tough ? `; ${tough}` : ''}` },
    inputs: withBottle({
      you: { weapon: A.weapon, hp, max: D.hp.max, hits: A.hits },
      foe: foes[0], foes,
      cap: J.cap ?? D.cap, hit: D.hit / 100, brawl: { ...D.brawl }, arena: { ...D.arena, around: J.around.map(x => [...x]) },
    }, b),
  };
}
/** (bench-1) A bottle in a fight's words: "a bottle of Dog Spray first: all of them blind 3 seconds…" (none: nothing). */
const bottleWhy = b => (b ? [`a bottle of ${b.name} thrown first: ${b.lines.map(l => l[0].toLowerCase() + l.slice(1)).join(', ')}`] : []);
/** (bench-1) The bottle as a fight's `you` carries it: what it is and what it does there. */
const bottleNote = b => ({ good: b.good, product: b.product, name: b.name, lines: [...b.lines], cloud: b.cloud, fight: JSON.parse(JSON.stringify(b.fight)), tags: b.tags, inFight: b.inFight });

/**
 * How a jump that was a fight ends, as the contest's band: lost, the bad one ('clean'), unless they are left with
 * `scrape.lost` percent of their health or less together (you hurt them: they grab half and run, the scuffle, 'messy');
 * won with your health at `scrape.won` percent or less, the scuffle too (they had their hands in your pockets first);
 * won, nothing ('fail').
 */
export function jumpBandOf(cfg, F) {
  // (smooth-1: the lines themselves are odds.mjs bandOfJump, which the samples sort by)
  return bandOfJump(cfg.jumped.scrape ?? {}, F);
}

/**
 * The chance of each band of getting jumped now, from a sample of the same fight (config `jumped.sample` fights, seeds
 * of their own): { clean, messy, fail, disaster } in percent, as the contest's chances() has them, kept by the inputs.
 */
const JUMPS = new WeakMap();
export function jumpChances(cfg, state, place = state.place, opts = {}) {
  const kept = JUMPS.get(cfg) ?? new Map();
  JUMPS.set(cfg, kept);
  const { inputs } = jumpOf(cfg, state, place, opts);
  const key = JSON.stringify(inputs);
  let c = kept.get(key);
  if (!c) {
    const n = cfg.jumped.sample;
    // (smooth-1: the count of each band, kept in odds.mjs by everything it depends on; on the page, while it is worked
    // out in the background: NaN, and not kept)
    const count = tallied(inputs, n, cfg.jumped.scrape ?? {});
    if (!count) return { clean: NaN, messy: NaN, fail: NaN, disaster: 0, won: NaN, n, pending: true };
    const pc = k => Math.round((1000 * count[k]) / n) / 10;
    c = Object.freeze({ clean: pc('clean'), messy: pc('messy'), fail: pc('fail'), disaster: 0, won: pc('fail'), n });
    if (kept.size > 500) kept.clear();
    kept.set(key, c);
  }
  return { ...c };
}

/** The jump itself: one run of the fight, its seed from the run's dice (`keys`); the event's `duel` (as a one-on-one's, with `jumped`). */
export function jumpOut(cfg, state, place, keys, opts = {}) {
  const d = jumpOf(cfg, state, place, opts);
  const seed = Math.floor(rng(state.seed, 'run-jump-fight', ...keys)() * 2147483647);
  const F = runDuel(d.inputs, seed);
  const band = jumpBandOf(cfg, F);
  const [me, ...them] = F.people;
  const c = jumpChances(cfg, state, place, opts);
  const left = them.reduce((a, q) => a + q.hp, 0);
  const max = them.reduce((a, q) => a + q.max, 0);
  return {
    jumped: true, result: F.over.result, band, seed, seconds: F.over.t, capped: !!F.capped, inputs: d.inputs,
    you: { ...d.you, left: me.hp }, them: { ...d.them, left, leftPct: Math.round((left / max) * 100), each: them.map(q => ({ id: q.id, kind: q.kind, left: q.hp, down: q.down })) },
    chance: { pct: Math.round(c.won), in10: Math.round(c.won / 10), n: c.n, bad: c.clean, scuffle: c.messy, text: `you see them off about ${Math.round(c.won / 10)} in 10` },
  };
}

// ── somebody sent (styles-1) ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * A visit come due from somebody not of your own street, or who keeps a shop or a stall (config duel.sent.roles), is
 * a tough they sent: { style, says, name } (his style rolled from the run's seed and who sent him); null: they come
 * themselves.
 */
export function sentFor(cfg, state, who) {
  const S = cfg.duel?.sent;
  if (!S || !who) return null;
  const from = homeOfPerson(cfg, who.id);
  if (from === homeStreet(cfg) && !S.roles.includes(who.role)) return null;
  const style = pick(rng(state.seed, 'run-sent', who.id), S.styles);
  return { style, says: RIVALS[style].says, name: `somebody ${who.name} sent`, pronoun: S.pronoun ?? 'he' };
}

// ── after a loss: what would have helped (styles-1) ─────────────────────────────────────────────────────────────────
/**
 * ONE LINE OF WHAT WOULD HAVE HELPED, after a fight lost (`duel`: an event's): the same fight (its inputs, a sample of
 * seeds of its own, as the cards' odds) with each thing of the run that could change it, one at a time: each other way
 * to fight (each punch style, known or taught somewhere; the box cutter; bare hands), and rested. The one that wins it
 * most, if it clears `duel.advice.margin` points over what you had: { key, pct, in10, was, line } ("The throw wins this
 * about 6 in 10 · Mr. Haines teaches it on the docks, $80"); else a line saying nothing you can get does much better.
 * Never a gun. Not part of a step: the page and the terminal ask it (it plays a few hundred fights).
 */
export function fightAdvice(cfg, state, duel) {
  if (!duel || duel.result === 'won') return null;
  const n = cfg.duel.sample;
  const margin = cfg.duel.advice?.margin ?? 10;
  const jumped = !!duel.jumped;
  const winPct = inputs => (jumped ? 100 - lostShare(cfg, inputs, n) : wonShare(inputs, n)?.pct ?? NaN);
  const was = winPct(duel.inputs);
  const tries = [];
  const arms = ['hands', ...Object.keys(cfg.styles ?? {}).filter(s => cfg.duel.you[s]), 'cutter'];
  const cur = duel.you?.arm ?? null;
  for (const a of arms) {
    if (a === cur) continue;
    const A = cfg.duel.you[a];
    tries.push({ key: a, inputs: { ...duel.inputs, you: { ...duel.inputs.you, weapon: A.weapon, hits: A.hits } } });
  }
  // rested: the full day's energy (a one-on-one), or fresh (jumped)
  const full = jumped ? cfg.jumped.you.fresh : duelHealth(cfg, fullEnergy(cfg, state));
  if (full > duel.inputs.you.hp) tries.push({ key: 'rested', inputs: { ...duel.inputs, you: { ...duel.inputs.you, hp: full } } });
  for (const t of tries) t.pct = winPct(t.inputs);
  const best = tries.reduce((a, b) => (b.pct > a.pct ? b : a), { pct: -1 });
  const in10 = p => Math.round(p / 10);
  const verb = jumped ? 'sees them off' : 'wins this';
  if (!best.key || best.pct < was + margin) {
    return { key: null, pct: best.pct, was, in10: in10(best.pct), line: `Nothing you can get does much better here: ${in10(was)} in 10 with what you had${best.key ? `, ${in10(best.pct)} in 10 at best (${best.key === 'rested' ? 'rested' : armLabel(cfg, best.key)})` : ''}.` };
  }
  let where;
  if (best.key === 'rested') where = jumped ? 'sleep before you go out' : `full energy (${fullEnergy(cfg, state)})`;
  else if (best.key === 'cutter') where = state.owned?.cutter ? 'you own one: fight with it' : `$${cfg.shop.cutter.price} at your crib`;
  else if (best.key === 'hands') where = 'set it in Fight with';
  else where = knows(state, best.key) ? 'you know it: set it in Fight with' : taughtAt(cfg, best.key).text;
  const what = best.key === 'rested' ? 'Rested you' : best.key === 'cutter' ? 'The box cutter' : cap(armLabel(cfg, best.key));
  const line = best.key === 'rested' ? `Rested you ${jumped ? 'see them off' : 'win this'} about ${in10(best.pct)} in 10 · ${where}` : `${what} ${verb} about ${in10(best.pct)} in 10 · ${where}`;
  return { key: best.key, pct: best.pct, was, in10: in10(best.pct), line };
}
/** The share of a jump's fights lost (bad or scuffle) at these inputs, n seeds of their own. */
// (smooth-1: from the count kept in odds.mjs, so asked twice it is played once; NaN on the page while it is worked out)
function lostShare(cfg, inputs, n) {
  const t = tallied(inputs, n, cfg.jumped.scrape ?? {});
  if (!t) return NaN;
  const lost = t.clean + t.messy;
  return Math.round((100 * lost) / n);
}

// ── sixes-1: the first slice (RUN.md "The Sixes and a home that scales: the first slice") ─────────────────────────
/**
 * The best value of `key` among the things you own that defend with it (`pick`: Math.max, or Math.min for a chance
 * in), or null when nothing you own does.
 */
/** (raid-1) A thing knocked out in a raid (`state.home.out`: its last day out): it does nothing until mended. */
export const isOut = (state, k) => (state.home?.out?.[k] ?? 0) >= state.day;
export function defVal(cfg, state, key, pick = Math.max) {
  const vals = Object.entries(cfg.things ?? {}).filter(([k, t]) => t.defends?.[key] != null && state.things?.[k] && !isOut(state, k)).map(([, t]) => t.defends[key]);
  return vals.length ? pick(...vals) : null;
}
/** The thing you own that gives `key` its value (the first, if several), or null. */
export const defBy = (cfg, state, key, pick = Math.max) => {
  const v = defVal(cfg, state, key, pick);
  return v == null ? null : Object.keys(cfg.things).find(k => state.things?.[k] && !isOut(state, k) && cfg.things[k].defends?.[key] === v) ?? null;
};
/** The guard dog: owned, and fed on recent mornings (config `dog`: hungryDays unfed in a row and it guards nothing). */
export function dogOf(cfg, state) {
  const off = defVal(cfg, state, 'sneakOff');
  if (off == null) return null;
  const hungry = homeOf(state).dog?.hungry ?? 0;
  const works = hungry < (cfg.dog?.hungryDays ?? 2);
  return { owned: true, works, hungry, feed: cfg.dog?.feed ?? 0, off,
    text: works ? `The dog guards your crib: a sneak who hears it gives up ${off}% of the time` : `The dog has gone ${hungry} days unfed and sulks on its bed: it guards nothing until it is fed ($${cfg.dog?.feed ?? 0} from banked)` };
}
/** The kind an attempt warned of now would be: a crew from config crew.at, else a sneak. */
export const raidKind = (cfg, value) => (cfg.crew && value >= cfg.crew.at ? 'crew' : 'sneak');
/** How Earl is told to fight (a way of guard.ways; unset: guard.way). */
export function earlWayOf(cfg, state) {
  const w = state.earlWay;
  return w && (cfg.guard?.ways ?? []).includes(w) ? w : cfg.guard?.way ?? 'front';
}
export const earlWayWords = way => ({ way, name: EARL_WAYS[way]?.name ?? way, word: EARL_WAYS[way]?.word ?? way, says: EARL_WAYS[way]?.says ?? '' });

/**
 * THE DOOR FIGHT WITH A CREW (sixes-1): you with what you fight with (armOf, or `arm`) at the health a night's sleep
 * gives (`energy`: unset, the morning's after a night at home), Cousin Earl beside you if he is on (or `earl`: true /
 * false), told his way (`way`), and the door bar's head start (`bar`: unset, what you own) against the crew's two
 * (config `crew`). `inputs` is the fight's own (src/fight/duel.mjs: `foes`, `ally`, `firstHurt`).
 */
export function crewOf(cfg, state, { arm = null, way = null, energy = null, earl = null, bar = null, bottle } = {}) {
  const C = cfg.crew;
  // (bench-1: the bottle on your belt, thrown at them in the first second: `bottle` another, or null for none)
  const b = bottle === undefined ? bottleOn(cfg, state) : bottle;
  const D = cfg.duel;
  const a = arm ?? armOf(cfg, state);
  const A = D.you[a];
  const e = energy ?? morningEnergy(cfg, state, 'home');
  const hp = duelHealth(cfg, e);
  const g = guardOf(cfg, state);
  const withEarl = earl ?? !!g?.on;
  const w = way ?? earlWayOf(cfg, state);
  const head = bar ?? defVal(cfg, state, 'bar') ?? 0;
  const G = cfg.guard.fight;
  const foes = C.foes.map(f => ({ id: f.id, kind: f.kind, name: f.name, weapon: f.weapon, hp: f.hp, hits: f.hits, speed: f.speed, ...(f.reel !== undefined ? { reel: f.reel } : {}) }));
  const pct = Math.round((hp / D.hp.max) * 100);
  const health = hp >= D.hp.max ? 'rested: you start at full health' : `after a night's sleep: you start at ${pct}%`;
  const why = [A.label ?? a, health, ...(head ? [`the door bar: the first one through is ${head} down`] : []), ...(withEarl ? [`Cousin Earl beside you, ${EARL_WAYS[w]?.name ?? w}`] : []), ...bottleWhy(b)];
  return {
    you: { arm: a, weapon: A.weapon, label: A.label ?? a, hp, max: D.hp.max, pct, energy: e, why, text: why.join('; '), ...(b ? { bottle: bottleNote(b) } : {}) },
    them: { name: C.name, says: C.says, foes: foes.map(f => ({ id: f.id, kind: f.kind, name: f.name, hp: f.hp })), why: [C.says], text: C.says },
    earl: withEarl ? { ...earlWayWords(w), hp: G.hp } : null,
    bar: head,
    inputs: withBottle({
      you: { weapon: A.weapon, hp, max: D.hp.max, hits: A.hits },
      foe: foes[0], foes,
      ...(withEarl ? { ally: { hp: G.hp, weapon: G.weapon, hits: G.hits, way: w } } : {}),
      ...(head ? { firstHurt: head } : {}),
      cap: C.cap ?? D.cap, hit: D.hit / 100, brawl: { ...D.brawl }, arena: { ...D.arena, around: C.around.map(x => [...x]), ...(withEarl ? { ally: [...C.ally] } : {}) },
    }, b),
  };
}
/** The chance you win the door fight at these inputs: { pct, in10, earlDown, n } from crew.sample fights, kept by the inputs. */
const CREWS = new WeakMap();
export function crewChance(cfg, state, opts = {}) {
  const kept = CREWS.get(cfg) ?? new Map();
  CREWS.set(cfg, kept);
  const { inputs } = crewOf(cfg, state, opts);
  const key = JSON.stringify(inputs);
  let c = kept.get(key);
  if (!c) {
    const n = cfg.crew.sample;
    // (smooth-1: the count, kept in odds.mjs by everything it depends on; on the page, while it is worked out in the
    // background: NaN, and not kept)
    const t = tallied(inputs, n);
    if (!t) return { pct: NaN, in10: NaN, earlDown: inputs.ally ? NaN : null, n, text: 'you win about NaN in 10', pending: true };
    const { won, down } = t;
    const pct = Math.round((100 * won) / n);
    c = Object.freeze({ pct, in10: Math.round(pct / 10), earlDown: inputs.ally ? Math.round((100 * down) / n) : null, n, text: `you win about ${Math.round(pct / 10)} in 10` });
    if (kept.size > 500) kept.clear();
    kept.set(key, c);
  }
  return { ...c };
}
/** The door fight itself: one run, its seed from the run's dice (`keys`); the event's `duel` (with `crew: true`). */
export function crewOut(cfg, state, keys, opts = {}) {
  const d = crewOf(cfg, state, opts);
  const seed = Math.floor(rng(state.seed, 'run-crew-fight', ...keys)() * 2147483647);
  const F = runDuel(d.inputs, seed);
  const me = F.people[0];
  const them = F.people.filter(p => p.side === 'foe');
  const E = F.people.find(p => p.side === 'ally') ?? null;
  const left = them.reduce((a, q) => a + q.hp, 0);
  const max = them.reduce((a, q) => a + q.max, 0);
  const c = crewChance(cfg, state, opts);
  return {
    crew: true, result: F.over.result, seed, seconds: F.over.t, capped: !!F.capped, inputs: d.inputs,
    you: { ...d.you, left: me.hp }, them: { ...d.them, left, leftPct: Math.round((left / max) * 100), each: them.map(q => ({ id: q.id, kind: q.kind, left: q.hp, down: q.down })) },
    earl: d.earl ? { ...d.earl, left: E.hp, down: !!E.down } : null, bar: d.bar,
    chance: { pct: c.pct, in10: c.in10, earlDown: c.earlDown, n: c.n, text: c.text },
  };
}
/**
 * The door fight's odds as a card shows them: now, and with each other thing that changes it, one at a time: each
 * other thing you own to fight with, Earl told each other way (when he is on), the door bar (when you do not own it),
 * Earl (when he is not on).
 */
export function crewOdds(cfg, state) {
  if (!cfg.crew) return null;
  const now = crewChance(cfg, state);
  const d = crewOf(cfg, state);
  const byArm = Object.fromEntries(armsOf(cfg, state).map(a => [a, crewChance(cfg, state, { arm: a }).pct]));
  const byWay = d.earl ? Object.fromEntries((cfg.guard.ways ?? []).map(w => [w, crewChance(cfg, state, { way: w }).pct])) : null;
  const barThing = Object.keys(cfg.things).find(k => cfg.things[k].defends?.bar != null) ?? null;
  const withBar = !d.bar && barThing ? crewChance(cfg, state, { bar: cfg.things[barThing].defends.bar }).pct : null;
  const withEarl = !d.earl && guardOf(cfg, state) ? crewChance(cfg, state, { earl: true }).pct : null;
  // (bench-1: with a bottle on your belt that does something in the fight, the same fight without it)
  const b = d.you.bottle ?? null;
  const bottle = b ? { ...b, win: now.pct, without: b.inFight ? crewChance(cfg, state, { bottle: null }).pct : now.pct } : null;
  return { ...now, you: d.you, them: d.them, earl: d.earl, bar: d.bar, byArm, byWay, withBar, withEarl, ...(bottle ? { bottle } : {}) };
}

// ── (bench-1) the blue man (RUN.md "The bench and the bottle (bench-1)") ────────────────────────────────────────────
/** What taking it back gets you: `back` percent of the cash he took and of each good, rounded down. */
export function backOf(cfg, took) {
  const pct = cfg.make?.bottle?.blue?.back ?? 50;
  const goods = Object.fromEntries(Object.entries(took?.goods ?? {}).map(([g, n]) => [g, Math.floor((n * pct) / 100)]).filter(([, n]) => n > 0));
  return { cash: Math.floor(((took?.cash ?? 0) * pct) / 100), goods, pct };
}
/** Who a blue man is, for the page: a named person, or the one of them it says (`row.who`). */
export function blueWho(cfg, id, row) {
  const p = personOf(cfg, id);
  return p ? whoOf(p) : { id, name: row?.who?.name ?? 'the blue man', role: row?.who?.role ?? null };
}
/**
 * THE BLUE MEN AT A PLACE WHO TOOK SOMETHING FROM YOU (tagged, on now, `took`, not yet tried): each is a card there,
 * "Take it back off the blue man", a fight you start for what he took (config make.bottle.blue.back: all of it). [{ id, who, row, took, back }]
 */
export function bluesAt(cfg, state, place = state.place) {
  if (!cfg.make?.bottle?.blue) return [];
  const t = clockOf(state);
  const out = [];
  for (const [id, rows] of Object.entries(state.under ?? {})) {
    for (const r of rows) {
      if (r.effect !== 'tagged' || r.place !== place || !rowOn(r, t) || !r.took || r.back) continue;
      out.push({ id, who: blueWho(cfg, id, r), row: r, took: { cash: r.took.cash ?? 0, goods: { ...(r.took.goods ?? {}) } }, back: backOf(cfg, r.took) });
    }
  }
  return out;
}
/**
 * THE FIGHT TO TAKE IT BACK: a one-on-one you start, you with what you fight with at your energy's health (as a card's
 * fight), him as he fought you (`row.foe`: the fight he was in). `inputs` is the fight's own (src/fight/duel.mjs).
 */
export function blueOf(cfg, state, row, { arm = null } = {}) {
  const D = cfg.duel;
  const a = arm ?? armOf(cfg, state);
  const A = D.you[a];
  const hp = duelHealth(cfg, state.energy);
  const pct = Math.round((hp / D.hp.max) * 100);
  const health = hp >= D.hp.max ? 'rested: you start at full health' : `${state.energy <= cfg.energy.tiredAt ? 'tired' : `energy ${state.energy}`}: you start at ${pct}%`;
  const foe = { ...row.foe, id: 'them' };
  return {
    you: { arm: a, weapon: A.weapon, label: A.label ?? a, hp, max: D.hp.max, pct, why: [A.label ?? a, health], text: `${A.label ?? a}; ${health}` },
    them: { name: row.who?.name ?? 'the blue man', says: row.who?.says ?? null, hp: foe.hp, text: row.who?.says ?? 'he fights as he fought you' },
    inputs: { you: { weapon: A.weapon, hp, max: D.hp.max, hits: A.hits }, foe, cap: D.cap, hit: D.hit / 100, brawl: { ...D.brawl }, arena: { ...D.arena } },
  };
}
/** The chance you win it: { pct, in10, n, byArm, text } from duel.sample fights (the background path on the page: NaN until kept). */
export function blueChance(cfg, state, row) {
  const n = cfg.duel.sample;
  const one = arm => {
    const t = tallied(blueOf(cfg, state, row, { arm }).inputs, n);
    return t ? Math.round((100 * t.won) / n) : NaN;
  };
  const pct = one(armOf(cfg, state));
  return { pct, in10: Math.round(pct / 10), n, byArm: Object.fromEntries(armsOf(cfg, state).map(a => [a, a === armOf(cfg, state) ? pct : one(a)])), text: `you win about ${Math.round(pct / 10)} in 10`, ...(Number.isNaN(pct) ? { pending: true } : {}) };
}
/** The fight itself: one run, its seed from the run's dice (`keys`); the event's `duel`. */
export function blueOut(cfg, state, row, keys) {
  const d = blueOf(cfg, state, row);
  const seed = Math.floor(rng(state.seed, 'run-blue-fight', ...keys)() * 2147483647);
  const F = runDuel(d.inputs, seed);
  const [me, foe] = F.people;
  const c = blueChance(cfg, state, row);
  return { blue: true, result: F.over.result, seed, seconds: F.over.t, capped: !!F.capped, inputs: d.inputs,
    you: { ...d.you, left: me.hp }, them: { ...d.them, left: foe.hp, leftPct: Math.round((foe.hp / foe.max) * 100) }, chance: { pct: c.pct, in10: c.in10, n: c.n, text: c.text } };
}

/** The Sixes' own state (an older saved state: nothing done on their ground). */
export const sixesStateOf = state => ({ marks: [], did: null, word: null, made: 0, madeDay: null, taxDay: null, tax: null, jump: null, jumps: [], streak: 0, streakDay: null, raid: null, raids: [], truce: null, raidLast: null, ...(state.sixes ?? {}) });
/** Is `place` the Sixes' ground? */
/** (second pass) The Sixes at rest (`sixes.rest`: a trial's switch, never the game's): the meter stays at 0, nothing of theirs happens. */
export const sixesLive = cfg => !!cfg.sixes && !cfg.sixes.rest;
export const sixesGround = (cfg, place) => sixesLive(cfg) && (cfg.sixes.ground ?? []).includes(place);
/** The Sixes' meter: its value (0 to max, held at cap), and every reason holding it up, in words. */
export function sixesOf(cfg, state) {
  const X = cfg.sixes;
  if (!X) return null;
  const s = sixesStateOf(state);
  const reasons = s.marks.map(m => ({ why: m.why, n: m.n, day: m.day, text: m.text }));
  const raw = reasons.reduce((a, r) => a + r.n, 0);
  const value = clamp(raw, 0, X.cap ?? X.max);
  const fear = (X.jumpers ?? []).filter(id => fears(cfg, state, id));
  return { value, raw, max: X.max, cap: X.cap ?? X.max, word: X.word, tax: X.tax, jump: X.jump, reasons, fear, state: s };
}
/** What `n` points would make of the meter: { from, to } (kept to 0..cap). */
export const sixesAfter = (cfg, state, n) => {
  const v = sixesOf(cfg, state)?.value ?? 0;
  return { from: v, to: clamp(v + n, 0, cfg.sixes.cap ?? cfg.sixes.max) };
};
/** The tax on what you made on their ground today: taxPct of it, at least taxMin. (raid-1, the push: `streak`, the days
 * in a row they have stopped you for it, this one counted: push.perDay points more for each after the first, at most
 * push.maxPct) */
export const taxPctOf = (cfg, streak = 1) => Math.min(cfg.sixes.push?.maxPct ?? cfg.sixes.taxPct, cfg.sixes.taxPct + (cfg.sixes.push?.perDay ?? 0) * Math.max(0, streak - 1));
export const taxOf = (cfg, made, streak = 1) => Math.max(cfg.sixes.taxMin, Math.floor((made * taxPctOf(cfg, streak)) / 100));
/** A share in words, for Dutch: "a fifth", "three tenths", "two fifths", "half". */
export const pctWords = pct => ({ 10: 'a tenth', 20: 'a fifth', 25: 'a quarter', 30: 'three tenths', 40: 'two fifths', 50: 'half' }[pct] ?? `${pct}%`);
/** What a job done on their ground would add to the meter (0: nothing): a sale once a day, a grab every time. */
export function sixesJob(cfg, state, job, place = state.place) {
  if (!sixesGround(cfg, place) || !job) return 0;
  const X = cfg.sixes;
  if ((X.grabs ?? []).includes(job.id)) return X.raise.grab;
  if (job.goods) return sixesStateOf(state).marks.some(m => m.why === 'sell' && m.day === state.day) ? 0 : X.raise.sell;
  return 0;
}
