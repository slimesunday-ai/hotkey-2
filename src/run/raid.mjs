// THE RAID ON YOUR HOME (raid-1, RUN.md "The raid on your home (raid-1)"): the rules of it, as plain functions of
// (config, state), the view and the engine both reading them. The fight itself is src/fight/raid.mjs (the crew's door
// fight made bigger: a gun in your hands, Earl beside you, each piece its job).
//
//   gunsOf(cfg, state)              the guns you own: [{ item, label, gun, rounds, loud, ... }]
//   holdsOf(cfg, state)             what you could hold at your door: each gun you own with rounds, and what you fight with
//   holdOf(cfg, state)              what you hold: the standing choice (state.holdWith) while it is still yours, else the
//                                   first gun you own with rounds (sixshot, doorman, chopper, longeye), else your fists
//   stakeOf(cfg, state)             what is at stake at your crib: banked, the goods there at cost, what the hiding places keep
//   raidSize(cfg, stake)            0, 1 or 2: how big a crew the stake brings (config sixesRaid.steps)
//   raidCrew(cfg, state, day)       which of the four crews the dice send for the raid warned on `day`
//   raidOf(cfg, state, opts)        who brings what: you, them, Earl, the pieces; `inputs` the fight's own
//   raidChance(cfg, state, opts)    the share of sixesRaid.sample fights at these inputs you win (kept by the inputs):
//                                   what the loadout card says. A count of src/run/odds.mjs (`raid`): on the page it is
//                                   worked out in the background, NaN until then
//   raidOut(cfg, state, keys)       the raid itself: one fight, its seed from the run's dice
//   raidOdds(cfg, state)            the card's odds: now, with each other thing you could hold, with Earl, each piece
//   gunHeat(cfg, state, item, fired) the heat a night of firing puts on you and on your street (the scanner halves it)
//   hiddenOf(cfg, state)            what the hiding places keep from anyone who gets in: { cash, goods }
import { rng } from '../rng.mjs';
import { runRaid } from '../fight/raid.mjs';
import { tallied } from './odds.mjs';
import { EARL_WAYS, WEAPONS } from '../fight/data.mjs';
import { armOf, armLabel, armsOf, morningEnergy, duelHealth, guardOf, earlWayOf, earlWayWords, defVal, dogOf, goodsWorth, clamp, isBought, isMade, isMaking } from './rules.mjs';
import { sellsFor } from './make.mjs';

/** The order a gun is held in when nothing is chosen (the cheapest first). */
export const GUN_ORDER = Object.freeze(['sixshot', 'doorman', 'chopper', 'longeye']);

/** Rounds of a gun you own (a version-11 state: none). */
export const roundsOf = (state, item) => state.ammo?.[item] ?? 0;
/** The guns of the config: [item, thing]. */
export const gunThings = cfg => Object.entries(cfg.things ?? {}).filter(([, t]) => t.gun);
/** The guns you own, with their rounds. */
export function gunsOf(cfg, state) {
  return gunThings(cfg).filter(([k]) => state.things?.[k]).map(([item, t]) => ({ item, label: t.label, gun: t.gun, rounds: roundsOf(state, item), loud: t.loud ?? 0, holdFire: t.holdFire ?? null, ammo: t.ammo }));
}
/** What you could hold at your door: each gun you own with a round for it, and what you fight with (armOf). */
export function holdsOf(cfg, state) {
  return [...gunsOf(cfg, state).filter(g => g.rounds > 0).map(g => g.item), ...armsOf(cfg, state)];
}
/** What you hold: the standing choice while it is yours to hold, else the first gun you own with rounds, else your fists. */
export function holdOf(cfg, state) {
  const h = state.holdWith;
  const can = holdsOf(cfg, state);
  if (h && can.includes(h)) return h;
  return GUN_ORDER.find(g => can.includes(g)) ?? armOf(cfg, state);
}
/** A hold in words. */
export const holdLabel = (cfg, h) => cfg.things?.[h]?.gun ? cfg.things[h].label : armLabel(cfg, h);

/** A thing at risk in a raid: its `raid` ({ take: pct } carried off, or { out: days, pct } knocked out) and what it is worth. */
export const atRisk = (cfg, item) => (cfg.things?.[item]?.raid ? { ...cfg.things[item].raid, worth: cfg.things[item].worth ?? cfg.things[item].price ?? 0 } : null);
/** The things you own that a raid can carry off, the dearest first: [{ item, label, take, worth }] (what WORTH counts and a hiding place hides). */
export function thingsAtRisk(cfg, state) {
  return Object.keys(state.things ?? {}).filter(k => state.things[k] && atRisk(cfg, k)?.take != null).map(k => ({ item: k, label: cfg.things[k].label, ...atRisk(cfg, k) }))
    .sort((a, b) => b.worth - a.worth || (a.item < b.item ? -1 : 1));
}
/**
 * What the hiding places keep from anyone who gets in, by one rule over every piece's `hides`: cash (dollars never found),
 * goods (all of them, or none), things (that many of the things at risk, the dearest first, never the one in your
 * hands: `held`). → { cash, goods, things: [items] }.
 */
export function hiddenOf(cfg, state, { held = null } = {}) {
  let cash = 0, goods = false, n = 0;
  for (const [k, t] of Object.entries(cfg.things ?? {})) {
    if (!t.hides || !state.things?.[k]) continue;
    cash += t.hides.cash ?? 0;
    goods ||= !!t.hides.goods;
    n += t.hides.things ?? 0;
  }
  const things = thingsAtRisk(cfg, state).filter(x => x.item !== held).slice(0, n).map(x => x.item);
  return { cash, goods, things };
}
/** Banked cash a share is taken of: what is not in the cereal box. */
export const findable = (cfg, state, banked = state.banked) => Math.max(0, banked - hiddenOf(cfg, state).cash);
/** A share of what is banked that whoever got in takes: never what the cereal box holds, never all of it. */
export const shareTaken = (cfg, state, pct, banked = state.banked) => Math.floor((findable(cfg, state, banked) * pct) / 100);

/** Where the rules find each kind of holding at the crib (config worth.entries `of`): a later kind is one more row here. */
const only = (cfg, goods, test) => Object.fromEntries(Object.entries(goods ?? {}).filter(([g]) => test(cfg, g)));
const HOLDINGS = {
  banked: (cfg, state) => state.banked,
  // (pot-1: the goods bought from a connect, at cost; what you made and what you make it with are rows of their own)
  stash: (cfg, state) => goodsWorth(cfg, only(cfg, state.stash, isBought)),
  things: (cfg, state) => thingsAtRisk(cfg, state).reduce((a, x) => a + x.worth, 0),
  // (pot-1) what you made, kept at the crib, at what it sells for (make.mjs sellsFor: the best selling job's middle)
  // (bench-1: a bottle, which no selling job takes, at what it cost)
  made: (cfg, state) => Object.entries(state.stash ?? {}).filter(([g]) => isMade(cfg, g)).reduce((a, [g, n]) => a + n * (sellsFor(cfg, g)?.mid ?? (cfg.goods[g].price / cfg.goods[g].sales)), 0),
  // (pot-1) what you make it with, kept at the crib, at cost
  makings: (cfg, state) => goodsWorth(cfg, only(cfg, state.stash, isMaking)),
};
/**
 * WHAT YOUR HOME IS WORTH (the WORTH meter): one sum over config worth.entries, everything kept at the crib, each row's
 * value and words; the size of crew it brings (`size`, worth.steps) and the next step. Hidden or not, it all counts:
 * what they case is what they think is there.
 */
export function homeWorth(cfg, state) {
  const W = cfg.worth;
  const entries = (W?.entries ?? []).map(e => ({ id: e.id, label: e.label, value: Math.round(HOLDINGS[e.of]?.(cfg, state) ?? 0) }));
  const total = entries.reduce((a, e) => a + e.value, 0);
  const steps = W?.steps ?? [];
  const size = steps.filter(x => total >= x).length;
  return { total, entries, size, steps: [...steps], next: steps[size] ?? null, text: `Your home is worth $${total} to the Sixes${entries.filter(e => e.value).length ? ` (${entries.filter(e => e.value).map(e => `${e.label} $${e.value}`).join(', ')})` : ''}.` };
}
/** What is at stake at your crib (the worth, and what the hiding places keep). */
export function stakeOf(cfg, state) {
  const w = homeWorth(cfg, state);
  return { banked: state.banked, goods: w.entries.find(e => e.id === 'stock')?.value ?? 0, things: w.entries.find(e => e.id === 'things')?.value ?? 0, total: w.total, size: w.size, hidden: hiddenOf(cfg, state) };
}
/** How big a crew a worth brings: 0, 1 or 2. */
export const raidSize = (cfg, stake) => (cfg.worth?.steps ?? []).filter(x => (stake.total ?? stake) >= x).length;
/** The Sixes' meter at which they come: sixes.raid, whatever your home is worth (how often follows what you do). */
export const raidAtOf = cfg => cfg.sixes.raid;
/** The things you own that a raid can knock out (bolted in, never taken): [{ item, label, out, pct }]. */
export function thingsToKnock(cfg, state) {
  return Object.keys(state.things ?? {}).filter(k => state.things[k] && atRisk(cfg, k)?.out != null).map(k => ({ item: k, label: cfg.things[k].label, out: atRisk(cfg, k).out, pct: atRisk(cfg, k).pct ?? 100 }));
}
/** Which crew the dice send for a raid warned on `day` (the run's seed): one of sixesRaid.crews. */
export function raidCrew(cfg, state, day) {
  const ids = Object.keys(cfg.sixesRaid.crews);
  return ids[Math.floor(rng(state.seed, 'run-sixes-raid-crew', day)() * ids.length)];
}
/** The crew of a raid as the fight's foes and where each stands: { crew, size, foes, around, count, says }. */
export function crewFoes(cfg, crew, size) {
  const X = cfg.sixesRaid;
  const C = X.crews[crew];
  const foes = [];
  const around = [];
  for (const [kind, ns, at] of C.foes) {
    for (let i = 0; i < ns[size]; i++) {
      foes.push({ id: `r${foes.length + 1}`, ...X.kinds[kind] });
      around.push([...X.at[at][i]]);
    }
  }
  const count = {};
  for (const f of foes) count[f.name] = (count[f.name] ?? 0) + 1;
  // (words only: "3 heavies", not "3 heavys", as RUN.md has them; raid-1's page)
  const words = Object.entries(count).map(([n, k]) => (k > 1 ? `${k} ${n.replace(/^an? /, '').replace(/(man)$/, 'men').replace(/y$/, 'ie').replace(/([^n])$/, '$1s')}` : n));
  return { crew, size, name: C.name, says: C.says, foes, around, n: foes.length, count, text: `${foes.length} of them: ${words.join(', ')}` };
}

/**
 * WHO BRINGS WHAT to the raid: what you hold (holdOf, or `hold`) and its rounds (all you own of them; run dry, you fight
 * on with what you fight with), your health after a night's sleep (`energy`), Cousin Earl beside you if he is on (or
 * `earl`), told his way (`way`); and each piece doing its job (`pieces`: { bar, blind, cut, dog }, unset: what you own).
 * `inputs` is the fight's own (src/fight/raid.mjs).
 */
export function raidOf(cfg, state, { hold = null, way = null, energy = null, earl = null, pieces = null, crew = null, size = null } = {}) {
  const X = cfg.sixesRaid;
  const D = cfg.duel;
  const due = state.sixes?.raid ?? null;
  const c = crewFoes(cfg, crew ?? due?.crew ?? 'rush', size ?? due?.size ?? 0);
  const h = hold ?? holdOf(cfg, state);
  const T = cfg.things?.[h];
  const arm = armOf(cfg, state);
  const A = D.you[T?.gun ? arm : h] ?? D.you.hands;
  const e = energy ?? morningEnergy(cfg, state, 'home');
  const hp = duelHealth(cfg, e);
  const g = guardOf(cfg, state);
  const withEarl = earl ?? !!g?.on;
  const w = way ?? earlWayOf(cfg, state);
  const dog = dogOf(cfg, state);
  const P = pieces ?? { bar: defVal(cfg, state, 'bar') ?? 0, blind: defVal(cfg, state, 'blind') ?? 0, cut: defVal(cfg, state, 'cut') ?? 0, dog: !!dog?.works };
  const foes = c.foes.map(f => ({ ...f }));
  // (the guard dog takes one on: the last of them, the one who hangs back if any, is bitten before he is in it)
  if (P.dog && foes.length) foes[foes.length - 1].hp = Math.max(1, foes[foes.length - 1].hp - (X.dogBite ?? 0));
  const G = cfg.guard.fight;
  const rounds = T?.gun ? roundsOf(state, h) : 0;
  const you = T?.gun
    ? { weapon: T.gun, hp, max: D.hp.max, hits: A.hits, rounds, dry: A.weapon, ...(T.holdFire ? { holdFire: T.holdFire } : {}) }
    : { weapon: A.weapon, hp, max: D.hp.max, hits: A.hits };
  if (P.cut) you.cut = P.cut / 100;
  const pct = Math.round((hp / D.hp.max) * 100);
  const label = holdLabel(cfg, h);
  const why = [T?.gun ? `${label} (${rounds} round${rounds === 1 ? '' : 's'}; then ${armLabel(cfg, arm)})` : label,
    hp >= D.hp.max ? 'rested: you start at full health' : `after a night's sleep: you start at ${pct}%`,
    ...(P.bar ? [`the door bar: the first one through is ${P.bar} down`] : []), ...(P.blind ? [`the pepper fogger: they come in blind ${P.blind} s`] : []),
    ...(P.cut ? [`the stab vest: every hit on you ${P.cut}% less`] : []), ...(P.dog ? [`the dog takes one on: ${X.dogBite} down`] : []),
    ...(withEarl ? [`Cousin Earl beside you, ${EARL_WAYS[w]?.name ?? w}`] : [])];
  return {
    hold: h, gun: T?.gun ? h : null, rounds, you: { hold: h, label, weapon: you.weapon, hp, max: D.hp.max, pct, energy: e, why, text: why.join('; ') },
    them: { crew: c.crew, size: c.size, name: c.name, says: c.says, n: c.n, count: c.count, text: c.text, foes: foes.map(f => ({ id: f.id, kind: f.kind, name: f.name, hp: f.hp, weapon: f.weapon })) },
    earl: withEarl ? { ...earlWayWords(w), hp: G.hp } : null, pieces: P,
    inputs: {
      you, foes,
      ...(withEarl ? { ally: { hp: G.hp, weapon: G.weapon, hits: G.hits, way: w } } : {}),
      ...(P.bar ? { firstHurt: P.bar } : {}), ...(P.blind ? { blind: P.blind } : {}),
      cap: X.cap, hit: D.hit / 100, brawl: { ...D.brawl },
      arena: { ...X.arena, around: c.around, ...(withEarl ? { ally: [...X.ally] } : {}) },
    },
  };
}

/**
 * The chance you win the raid at these inputs: { pct, in10, hurt, spent (rounds a night), earlDown, n }. A sample of
 * sixesRaid.sample fights, seeds 0x5eed0000 + 1 to n, counted by src/run/odds.mjs (`raid`: the raid's own fight, the
 * same loop as before), so the page can have it worked out in the background (demo/run/odds.js): while it waits,
 * every figure is NaN (the page says "…"); from Node it is played at once, as always.
 */
export function raidChance(cfg, state, opts = {}) {
  const { inputs } = raidOf(cfg, state, opts);
  const n = cfg.sixesRaid.sample;
  const t = tallied(inputs, n, null, { hurtAt: cfg.sixesRaid.hurtAt });
  if (!t) return { pct: NaN, in10: NaN, hurt: NaN, spent: NaN, earlDown: inputs.ally ? NaN : null, n, text: 'you hold them about NaN in 10' };
  const pct = Math.round((100 * t.won) / n);
  return { pct, in10: Math.round(pct / 10), hurt: Math.round((100 * t.hurt) / n), spent: Math.round((10 * t.spent) / n) / 10, earlDown: inputs.ally ? Math.round((100 * t.down) / n) : null, n, text: `you hold them about ${Math.round(pct / 10)} in 10` };
}

/** The raid itself: one run of the fight, its seed from the run's dice (`keys`); the event's `raid` fight. */
export function raidOut(cfg, state, keys, opts = {}) {
  const d = raidOf(cfg, state, opts);
  const seed = Math.floor(rng(state.seed, 'run-sixes-raid-fight', ...keys)() * 2147483647);
  const F = runRaid(d.inputs, seed);
  const me = F.people[0];
  const them = F.people.filter(p => p.side === 'foe');
  const E = F.people.find(p => p.side === 'ally') ?? null;
  const left = them.reduce((a, q) => a + q.hp, 0);
  const max = them.reduce((a, q) => a + q.max, 0);
  const won = F.over.result === 'won';
  return {
    sixesRaid: true, result: F.over.result, seed, seconds: F.over.t, capped: !!F.capped, inputs: d.inputs, hold: d.hold, gun: d.gun, spent: F.spent ?? 0,
    hurt: won && me.hp <= (cfg.sixesRaid.hurtAt * me.max) / 100,
    you: { ...d.you, left: me.hp }, them: { ...d.them, left, leftPct: max ? Math.round((left / max) * 100) : 0, each: them.map(q => ({ id: q.id, kind: q.kind, name: q.name, left: q.hp, down: q.down })) },
    earl: d.earl ? { ...d.earl, left: E.hp, down: !!E.down } : null, pieces: d.pieces,
  };
}

/**
 * The raid card's odds: now, with each other thing you could hold (each gun you own with rounds, what you fight with),
 * Earl told each way (when he is on) or hired (when he is not), and each piece of the raid you do not own (one at a
 * time: the door bar, the fogger, the vest).
 */
export function raidOdds(cfg, state) {
  if (!cfg.sixesRaid || !state.sixes?.raid) return null;
  const now = raidChance(cfg, state);
  const d = raidOf(cfg, state);
  const byHold = Object.fromEntries(holdsOf(cfg, state).map(h => [h, raidChance(cfg, state, { hold: h }).pct]));
  const byWay = d.earl ? Object.fromEntries((cfg.guard.ways ?? []).map(w => [w, raidChance(cfg, state, { way: w }).pct])) : null;
  const withEarl = !d.earl && guardOf(cfg, state) ? raidChance(cfg, state, { earl: true }).pct : null;
  const withPiece = {};
  for (const [k, t] of Object.entries(cfg.things ?? {})) {
    if (state.things?.[k]) continue;
    const key = ['bar', 'blind', 'cut'].find(x => t.defends?.[x] != null);
    if (!key) continue;
    withPiece[k] = raidChance(cfg, state, { pieces: { ...d.pieces, [key]: t.defends[key] } }).pct;
  }
  return { ...now, you: d.you, them: d.them, earl: d.earl, pieces: d.pieces, hold: d.hold, byHold, byWay, withEarl, withPiece };
}

/** The heat a night of firing `item` puts on you and on the street your crib opens onto: its `loud`, the scanner's share off. */
export function gunHeat(cfg, state, item, fired) {
  if (!fired || !cfg.things?.[item]?.gun) return 0;
  const quiet = defVal(cfg, state, 'quiet') ?? 0;
  return clamp(Math.floor(((cfg.things[item].loud ?? 0) * (100 - quiet)) / 100), 0, cfg.heat.max);
}

/** The shells of a gun in its fight's own words (for a card): the weapon's name and a box of its rounds. */
export const gunWords = (cfg, item) => {
  const t = cfg.things?.[item];
  if (!t?.gun) return null;
  const W = WEAPONS[t.gun];
  return { item, label: t.label, weapon: t.gun, name: W.name, mag: W.mag, range: W.range, box: { ...t.ammo }, loud: t.loud ?? 0, job: t.job, does: t.does };
};
