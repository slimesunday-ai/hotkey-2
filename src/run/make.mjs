// MAKING THINGS (pot-1, RUN.md "The pot (pot-1)"): the crafting plan's one mechanic, as plain functions of (config,
// state). The view and the engine both read them. Config make (config.mjs): makers, kinds, makings, products, effects,
// outcomes, dirty, smell, lift, names. The goods making brings are config goods (config.mjs madeGoods); who is under what
// is effects.mjs.
//
//   makerOf(cfg, item)                  the maker a making, a good or a station is of
//   stationOf(cfg, state, maker)        the maker's station: owned, and working (a raid can knock it out)
//   productOf(cfg, makings)             what a set of makings makes, by the mixing rule: its id, its default name, its
//                                       effects in turn (B3: same part of the body, they take turns, the downer last),
//                                       its rarity (its rarest making's), its families (the chips)
//   productName(cfg, state, id)         the name it goes by: the player's, else the default
//   effectLines(cfg, product)           the label's numbered lines ("Rainbow, dancing: 2 hours", "then asleep: 3 hours")
//   cookOdds(cfg, state, maker, ins)    the odds a batch comes out clean, dirty or with something else in it, and why
//   cookOptions(cfg, state, maker)      every set of makings the carrier could take now from what is at the crib, each with
//                                       what it would make, the odds, the bags, what it costs, tried before or not
//   smellOf(cfg, state, day)            the smell: a level on HOME (the most cooks on today or yesterday, less the fan)
//   shelfOf(cfg, state, maker)          the shelf: the makings and the made things, on you and at the crib, as they show
//   bookOf(cfg, state, maker)           the book: what was tried, what was found, the names given
//   liftsAt(cfg, state, place)          the sleepers at a place whose wallet can be lifted, and what it pays
//   madeWords(cfg, state, good)         a made good in a selling card's words ("Zonked: she'll sleep 3 h")
import { rng } from '../rng.mjs';
import { placeOf, personOf, whoOf, cap, isTired, isOut, goodsOn, goodsHome, shownAs, knownDirty, goodLabel, behind, scale, tierOf, pronouns, shownGoods, isMade } from './rules.mjs';
import { clockOf, clockAt, underNow, smellLevel } from './effects.mjs';

const M = cfg => cfg.make ?? null;
const sum = (o = {}) => Object.values(o).reduce((a, n) => a + n, 0);

// ── what is what ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The maker a making, a good, a carrier's kind or a station is of (null: none). */
export function makerOf(cfg, item) {
  const X = M(cfg);
  if (!X) return null;
  if (X.makings?.[item]) return X.makings[item].maker;
  if (cfg.goods?.[item]?.maker) return cfg.goods[item].maker;
  if (cfg.things?.[item]?.station) return cfg.things[item].station;
  return null;
}
/** The makers of the config: [id]. */
export const makersOf = cfg => Object.keys(M(cfg)?.makers ?? {});
/**
 * A maker's station, as you have it: { item, label, owned, out (knocked out: its last day), works }. (bench-1: a station
 * that stands on the floor spot works only while it is the one standing there: `floor`, `stands`)
 */
export function stationOf(cfg, state, maker) {
  const item = M(cfg)?.makers?.[maker]?.station;
  if (!item) return null;
  const owned = !!state.things?.[item];
  const out = isOut(state, item) ? state.home.out[item] : null;
  const floor = !!cfg.things[item]?.floor;
  const stands = !floor || floorOf(cfg, state).standing === item;
  return { item, label: cfg.things[item]?.label ?? item, owned, out, works: owned && !out && stands, floor, stands: owned && stands, price: cfg.things[item]?.price ?? null, at: cfg.things[item]?.at ?? null, keeper: cfg.things[item]?.keeper ?? null };
}

// ── (bench-1) the floor spot: one piece stands on it (approved decision 8) ───────────────────────────────────────────
/**
 * THE FLOOR SPOT of the trailer: the pieces you own that stand on it (config things with `floor`), and the one standing
 * (`state.floor` while it is yours, else the first of them you own). Changing them over is an hour at your crib.
 * { pieces: [item], standing: item | null }
 */
export function floorOf(cfg, state) {
  const pieces = Object.keys(cfg.things ?? {}).filter(k => cfg.things[k].floor && state.things?.[k]);
  const standing = pieces.includes(state.floor) ? state.floor : pieces[0] ?? null;
  return { pieces, standing };
}
/** The carrier of a maker that takes this kind of thing (the pot: makings of kind 'ingredient'). */
export const carrierOf = (cfg, maker, id = null) => {
  const C = M(cfg)?.makers?.[maker]?.carriers ?? {};
  const key = id ?? Object.keys(C)[0];
  return C[key] ? { id: key, ...C[key] } : null;
};
/** The maker's own state (an older saved state, or a maker never used: nothing seen, tried, found or named). */
export const makeState = (state, maker) => ({ seen: {}, book: { tried: {}, found: {}, names: {} }, known: {}, cooked: {}, ...(state.make?.[maker] ?? {}) });

// ── the mixing rule (B3) ─────────────────────────────────────────────────────────────────────────────────────────────
/**
 * WHAT A SET OF MAKINGS MAKES: every making does its one thing; you get all of them. Two that want the same part of the
 * body take turns, the downer last (each part's effects one after the other; different parts at once). A pair that
 * reacts (config make.reactions: none in slice 1) is something new instead. Its id is the art's (config make.products)
 * where the set is drawn, else `mix:<a>+<b>`; its rarity its rarest making's (a reaction one rarer).
 */
export function productOf(cfg, makings) {
  const X = M(cfg);
  const ins = [...new Set(makings)].sort();
  const key = ins.join('+');
  const tabled = Object.entries(X.products ?? {}).find(([, p]) => [...p.from].sort().join('+') === key);
  const reaction = X.reactions?.[key] ?? null;
  const E = X.effects;
  const byPart = new Map();
  for (const k of ins) {
    const e = X.makings[k].effect;
    if (!e) continue;
    const part = E[e].part ?? e;
    byPart.set(part, [...(byPart.get(part) ?? []), { effect: e, making: k, family: X.makings[k].family, last: X.makings[k].family === 'downer' }]);
  }
  const effects = [];
  for (const list of byPart.values()) {
    let at = 0;
    for (const x of [...list.filter(y => !y.last), ...list.filter(y => y.last)]) {
      effects.push({ effect: x.effect, at, hours: E[x.effect].hours, from: x.making });
      at += E[x.effect].hours;
    }
  }
  effects.sort((a, b) => a.at - b.at);
  const rank = r => (X.rarities ?? []).indexOf(r);
  const rarity = ins.map(k => X.makings[k].rarity).reduce((a, b) => (rank(b) > rank(a) ? b : a));
  const turns = effects.some(e => e.at > 0);
  const maker = X.makings[ins[0]].maker;
  // (bench-1: what its carrier gives: a bag, or a bottle)
  const kind = Object.values(X.makers[maker]?.carriers ?? {}).find(c => c.takes.includes(X.makings[ins[0]].kind))?.gives ?? null;
  return {
    id: reaction?.product ?? tabled?.[0] ?? `mix:${key}`, makings: ins, key, name: reaction?.name ?? tabled?.[1].name ?? ins.map(k => X.makings[k].label).join(' and '),
    effects, rarity: reaction ? X.rarities[Math.min(X.rarities.length - 1, rank(rarity) + 1)] : rarity, families: [...new Set(ins.map(k => X.makings[k].family))],
    reacts: !!reaction, turns, names: ins.length > 1, maker, kind,
  };
}
/**
 * (bench-1) A BAG FROM THE KITCHEN IN A BOTTLE (config make.products with `bag`): the bag's effects, in their turns, at the
 * fixed sizes of a fight; named after the bag; never named by the player (the bag is).
 */
function bagBottle(cfg, id) {
  const X = M(cfg);
  const P = X.products[id];
  const bag = productById(cfg, P.bag);
  const [maker, C] = Object.entries(X.makers).flatMap(([m, x]) => Object.values(x.carriers).map(c => [m, c])).find(([, c]) => c.takes.includes('bag')) ?? [null, null];
  return { id, makings: [], bag: P.bag, key: P.bag, name: `${bag.name} in a ${X.kinds[C?.gives]?.unit ?? 'bottle'}`, effects: bag.effects.map(e => ({ ...e })), rarity: bag.rarity, families: [...bag.families],
    reacts: false, turns: bag.turns, names: false, maker, kind: C?.gives ?? null };
}
/** A product by its id (one of config make.products), or null. */
export function productById(cfg, id) {
  const p = M(cfg)?.products?.[id];
  return p ? (p.bag ? bagBottle(cfg, id) : productOf(cfg, p.from)) : null;
}
/** The name a product goes by: the one the player gave it, else its default. (bench-1: a bag in a bottle, by the bag's) */
export const productName = (cfg, state, id) => {
  const p = productById(cfg, id);
  if (p?.bag) return `${productName(cfg, state, p.bag)} in a ${M(cfg).kinds[p.kind]?.unit ?? 'bottle'}`;
  return (p && makeState(state, p.maker).book.names[id]) ?? p?.name ?? id;
};
/** "2 hours", "1 hour" */
const hoursText = n => `${n} hour${n === 1 ? '' : 's'}`;
/**
 * The label's lines, in the words the effect uses everywhere: ["Rainbow skin, cannot stop dancing: 2 hours", "then
 * asleep where they stand: 3 hours"]. (bench-1: a bottle's, what it does in a fight: "All of them blind 3 seconds: no
 * blow, half speed", "All of them blue for a week")
 */
export function effectLines(cfg, product) {
  const E = M(cfg).effects;
  if (product.kind && product.kind !== 'bag' && product.effects.every(e => E[e.effect].inBottle)) {
    // (a mix that takes turns shares the bag: its words say the shared seconds)
    const n = new Set(product.effects.map(e => e.at)).size;
    const say = w => (n > 1 ? w.replace(/(\d+(?:\.\d+)?) seconds/, (m, x) => `${Number(x) / n} seconds`) : w);
    return product.effects.map((e, i) => (i && e.at > 0 ? `then ${say(E[e.effect].inBottle)[0].toLowerCase()}${say(E[e.effect].inBottle).slice(1)}` : say(E[e.effect].inBottle)));
  }
  return product.effects.map((e, i) => `${i && e.at > 0 ? 'then ' : ''}${i && e.at > 0 ? E[e.effect].words : cap(E[e.effect].words)}: ${hoursText(e.hours)}`);
}
/** Short, for a selling card: "sleeps 3 h", "dances 2 h, then sleeps 3 h". (bench-1: a bottle's, its fight sizes: "blind 3 s", "blue a week") */
export const effectShort = (cfg, product) => {
  const E = M(cfg).effects;
  if (product.kind && product.kind !== 'bag') {
    const { fight: F, tags } = bottleFight(cfg, product);
    return [F.blind ? `blind ${F.blind} s` : null, F.slow ? `dancing ${F.slow.s} s` : null, F.asleep ? `one asleep ${F.asleep.s} s` : null, tags ? 'blue a week' : null].filter(Boolean).join(', ');
  }
  return product.effects.map((e, i) => `${i && e.at > 0 ? 'then ' : ''}${E[e.effect].short} ${e.hours} h`).join(', ');
};

// ── (bench-1) the bottle in a fight ──────────────────────────────────────────────────────────────────────────────────
/**
 * WHAT A BOTTLE DOES IN A FIGHT OF SEVERAL, at the plan's fixed sizes (config make.effects[e].fight): the fight's own
 * fields (src/fight/sim.mjs: `blind` seconds, every one of them; `asleep` { n, s, at }, the first n; `slow` { s, by, at },
 * every one of them at `by` of their speed), each effect of the bottle in its turn (a bag's that take turns: the second
 * starts when the first is over), and whether it tags them (`tags`: blue for a week, nothing in the fight).
 * → { fight: { blind?, asleep?, slow? }, tags, seconds }
 */
export function bottleFight(cfg, product) {
  const E = M(cfg).effects;
  const fight = {};
  let tags = false;
  let t = 0;
  const groups = [...new Set(product.effects.map(e => e.at))].sort((a, b) => a - b);
  // (bench-1, the orchestrator's call on B1: one bag fills the bottle, so a mix whose effects take turns shares it: each
  // turn at its share of the size (Disco Coma: dancing 2 s, then the first of them asleep 1.5 s), never a stronger
  // bottle than either bag alone)
  const share = 1 / groups.length;
  for (const at of groups) {
    let longest = 0;
    for (const e of product.effects.filter(x => x.at === at)) {
      if (E[e.effect]?.person?.tagged) tags = true;
      const F = E[e.effect]?.fight;
      if (!F) continue;
      if (F.blind) { fight.blind = Math.max(fight.blind ?? 0, F.blind * share); longest = Math.max(longest, F.blind * share); }
      if (F.asleep) { fight.asleep = { n: F.asleep.n ?? 1, s: F.asleep.s * share, ...(t ? { at: t } : {}) }; longest = Math.max(longest, F.asleep.s * share); }
      if (F.slow) { fight.slow = { s: F.slow.s * share, by: F.slow.by, ...(t ? { at: t } : {}) }; longest = Math.max(longest, F.slow.s * share); }
    }
    t += longest;
  }
  return { fight, tags, seconds: t };
}
/**
 * THE BOTTLE ON YOUR BELT (null: none, or a bag is on it): the good, the product, its name and lines, what it does in a
 * fight and whether it tags, the cloud's colour (its first family's chip). Thrown first in a fight of several.
 */
export function bottleOn(cfg, state) {
  const g = state.belt?.good;
  const G = g ? cfg.goods?.[g] : null;
  if (!G || G.kind === 'bag' || !G.made || !M(cfg)?.bottle) return null;
  const p = productById(cfg, G.product);
  const f = bottleFight(cfg, p);
  const X = M(cfg);
  return { good: g, product: G.product, name: goodLabel(cfg, state, g), lines: effectLines(cfg, p), families: [...p.families], colours: p.families.map(x => X.families?.[x] ?? null), cloud: X.families?.[p.families[0]] ?? null,
    fight: f.fight, tags: f.tags, seconds: f.seconds, inFight: Object.keys(f.fight).length > 0 };
}
/** A fight's inputs with a bottle's sizes laid on (src/fight/duel.mjs startDuel passes them to the sim); none: as they are. */
export const withBottle = (inputs, b) => (b && b.inFight ? { ...inputs, ...JSON.parse(JSON.stringify(b.fight)) } : inputs);

// ── the odds of a batch (B4) ─────────────────────────────────────────────────────────────────────────────────────────
/** The makings that could get in by luck: anything ever on the maker's shelf, not in the pot already. */
export const extrasFor = (cfg, state, maker, ins) => Object.keys(makeState(state, maker).seen).filter(k => M(cfg).makings[k] && !ins.includes(k)).sort();
/**
 * THE ODDS A BATCH COMES OUT clean, dirty or with something else in it, shown before you cook: config make.outcomes; tired
 * (energy 2 or less before the hour), dirty is `tired`; with nothing that could get in, something else is 0 and clean
 * takes its share. { clean, dirty, extra, tired, could: [makings that could get in], dirtyIs: the bad thing, why }.
 */
export function cookOdds(cfg, state, maker, ins) {
  // (bench-1: a maker with no batch odds, the bench: it comes out as packed)
  if (M(cfg).makers?.[maker]?.outcomes === false) return { clean: 100, dirty: 0, extra: 0, tired: isTired(cfg, state), could: [], dirtyIs: null, why: ['it comes out as packed'], text: 'Comes out as packed', sure: true };
  const O = M(cfg).outcomes;
  const tired = isTired(cfg, state);
  const could = extrasFor(cfg, state, maker, ins);
  const dirty = tired ? O.tired : O.dirty;
  const extra = could.length ? O.extra : 0;
  const clean = 100 - dirty - extra;
  const why = [...(tired ? [`tired: dirty ${O.tired} in 100, not ${O.dirty}`] : []), ...(could.length ? [] : ['nothing else has been on your shelf to get in'])];
  return { clean, dirty, extra, tired, could, dirtyIs: Object.keys(M(cfg).dirty ?? {})[0] ?? null, why, text: `Comes out: clean ${clean} · dirty ${dirty} · something else ${extra}` };
}

// ── the smell (B9: a level, not a pile) ──────────────────────────────────────────────────────────────────────────────
/**
 * THE SMELL OF YOUR COOKING: a reason on HOME, a level and never a pile: on any day you cooked and the day after, the
 * most cooks of a day among them (`perCook` each, at most `max`), less each fan's `smellOff` (the box fan in the window).
 * { level, raw, cooks: the cooks counted, off: the fan's, by: the thing, text }. `cooking`: one cook more today (what
 * the pot's label says a cook would make it).
 */
export function smellOf(cfg, state, { day = state.day, cooking = 0 } = {}) {
  const S = M(cfg)?.smell;
  if (!S) return null;
  const L = smellLevel(cfg, state, { day, cooking });
  // (bench-1: only a maker that smells: packing bottles does not)
  const days = Object.keys(makersOf(cfg).filter(m => M(cfg).makers[m].smells !== false).reduce((a, m) => ({ ...a, ...makeState(state, m).cooked }), {})).map(Number).filter(d => d <= day);
  const last = days.length ? Math.max(...days) : null;
  const until = last != null && last + (S.days ?? 2) - 1 >= day ? last + (S.days ?? 2) - 1 : cooking ? day + (S.days ?? 2) - 1 : null;
  return { ...L, by: L.fans, until,
    text: L.level ? `The smell of your cooking: HOME +${L.level}${until ? ` until day ${until} is out` : ''}${L.off ? ` (the fan takes ${L.off} off)` : ''}` : L.raw ? 'The smell of your cooking: the fan blows it down the lane' : null };
}

// ── the shelf and the book (by maker: the addition's G3.5) ───────────────────────────────────────────────────────────
/**
 * THE SHELF of a maker: its makings (on you, at the crib, who sells each, where and at what price) and its made things as
 * they show (a dirty batch not yet found out counted in its product), each with its name, chips, effects, and the two
 * counts; the belt (on you, never for sale); how many kinds there are (six a maker, the plan's most).
 */
export function shelfOf(cfg, state, maker) {
  const X = M(cfg);
  const makings = Object.entries(X.makings).filter(([, m]) => m.maker === maker).map(([k, m]) => {
    const keeper = personOf(cfg, m.keeper);
    return { item: k, label: m.label, pack: m.pack, unit: m.unit, family: m.family, colour: X.families?.[m.family] ?? null, effect: m.effect, rarity: m.rarity, price: m.price, on: goodsOn(state, k), home: goodsHome(state, k),
      at: m.at, atLabel: placeOf(cfg, m.at).label, keeper: keeper ? whoOf(keeper) : null, spot: m.spot ?? null, piece: m.piece ?? null,
      text: `${cap(m.label)}: ${goodsOn(state, k)} on you, ${goodsHome(state, k)} at home. ${cap(m.pack)} is $${m.price} from ${keeper?.name ?? 'nobody'} ${placeOf(cfg, m.at).where ?? `at ${placeOf(cfg, m.at).label}`}.` };
  });
  const shown = new Map();
  for (const [g, G] of Object.entries(cfg.goods ?? {})) {
    if (!G.made || G.maker !== maker) continue;
    const as = shownAs(cfg, state, g);
    const row = shown.get(as) ?? { good: as, on: 0, home: 0 };
    row.on += goodsOn(state, g);
    row.home += goodsHome(state, g);
    shown.set(as, row);
  }
  const made = [...shown.values()].filter(r => r.on || r.home || state.belt?.good === r.good).map(r => {
    const G = cfg.goods[r.good];
    const p = productById(cfg, G.product);
    return { good: r.good, product: G.product, name: goodLabel(cfg, state, r.good), kind: G.kind, unit: G.unit, rarity: G.rarity, families: p.families, colours: p.families.map(f => X.families?.[f] ?? null),
      lines: effectLines(cfg, p), short: effectShort(cfg, p), dirty: G.dirty && knownDirty(cfg, state, r.good) ? { is: G.dirty, label: X.effects[X.dirty[G.dirty].effect]?.label ?? G.dirty } : null,
      on: r.on, home: r.home, piece: G.piece, sellsFor: sellsFor(cfg, r.good) };
  });
  const belt = state.belt?.good && makerOf(cfg, state.belt.good) === maker ? { good: state.belt.good, name: goodLabel(cfg, state, state.belt.good), n: state.belt.n ?? 1 } : null;
  return { maker, label: X.makers[maker].label, makings, made, belt, kinds: made.length, most: 6 };
}
/** What a made good sells for: the best selling job's middle for its kind (the WORTH row's dollars), and where. */
export function sellsFor(cfg, g) {
  const G = cfg.goods[g];
  let best = null;
  for (const [pl, p] of Object.entries(cfg.places)) for (const [id, j] of Object.entries(p.jobs ?? {})) {
    const pay = j.goodsPay?.[g];
    if (!pay) continue;
    const mid = (pay[0] + pay[1]) / 2;
    if (!best || mid > best.mid) best = { place: pl, job: id, pay: [...pay], mid };
  }
  return best ? { ...best, rarity: G?.rarity ?? null } : null;
}
/**
 * THE BOOK of a maker: every set of makings tried (and the day), every product found (its name, its effects, the day),
 * the names given, and how many of the possible sets have been tried (with what is on its sellers' tables today).
 */
export function bookOf(cfg, state, maker) {
  const X = M(cfg);
  const s = makeState(state, maker);
  const C = carrierOf(cfg, maker);
  const all = Object.keys(X.makings).filter(k => X.makings[k].maker === maker).sort();
  const sets = [];
  const walk = (from, pick) => {
    if (pick.length) sets.push(pick.join('+'));
    if (pick.length >= C.slots) return;
    for (let i = from; i < all.length; i++) walk(i + 1, [...pick, all[i]]);
  };
  walk(0, []);
  const found = Object.entries(s.book.found).map(([id, day]) => {
    const p = productById(cfg, id) ?? productOf(cfg, id.replace(/^mix:/, '').split('+'));
    return { product: id, name: s.book.names[id] ?? p.name, named: !!s.book.names[id], canName: p.names, makings: p.makings, lines: effectLines(cfg, p), short: effectShort(cfg, p), reacts: p.reacts, turns: p.turns, day };
  });
  return { maker, label: X.makers[maker].label, tried: Object.keys(s.book.tried).length, of: sets.length, sets: sets.map(k => ({ key: k, makings: k.split('+'), tried: s.book.tried[k] ?? null })), found, names: { ...s.book.names },
    text: `${Object.keys(s.book.tried).length} of ${sets.length} tried · ${found.length} found` };
}

// ── what the pot could take now ──────────────────────────────────────────────────────────────────────────────────────
/**
 * EVERY SET THE CARRIER COULD TAKE NOW: one to `slots` different makings of the maker, each at the crib. Each with what
 * it would make (its name, effects, rarity, bags), the odds, what the makings cost, whether that set was tried before
 * and the smell after. Empty: nothing at the crib to cook.
 */
export function cookOptions(cfg, state, maker) {
  const X = M(cfg);
  const C = carrierOf(cfg, maker);
  // (bench-1: the makings of the kinds the carrier takes; and a made thing it takes alone, a bag from the kitchen, as it shows)
  const have = Object.keys(X.makings).filter(k => X.makings[k].maker === maker && C.takes.includes(X.makings[k].kind) && goodsHome(state, k) > 0).sort();
  const out = [];
  const walk = (from, pick) => {
    if (pick.length) out.push([...pick]);
    if (pick.length >= C.slots) return;
    for (let i = from; i < have.length; i++) walk(i + 1, [...pick, have[i]]);
  };
  walk(0, []);
  const alone = (C.alone ?? []).filter(kind => C.takes.includes(kind));
  const bagsHome = alone.length ? Object.entries(shownGoods(cfg, state, state.stash)).filter(([g]) => isMade(cfg, g) && alone.includes(cfg.goods[g].kind)).map(([g]) => g).sort() : [];
  const s = makeState(state, maker);
  const smells = X.makers[maker].smells !== false;
  const smell = smells ? smellOf(cfg, state, { cooking: 1 }) : null;
  const opt = (ins, p, cost) => ({ with: ins, key: p.key, product: p.id, name: productName(cfg, state, p.id), lines: effectLines(cfg, p), short: effectShort(cfg, p), rarity: p.rarity, families: p.families,
    bags: C.n, kind: C.gives, cost, tried: p.bag ? s.book.found[p.id] ?? null : s.book.tried[p.key] ?? null, found: s.book.found[p.id] ?? null, turns: p.turns, reacts: p.reacts,
    odds: cookOdds(cfg, state, maker, ins), smell: smell ? { level: smell.level, until: state.day + (X.smell.days ?? 2) - 1 } : null,
    ...(p.bag ? { bag: p.bag } : {}), ...(C.gives !== 'bag' ? { fight: bottleFight(cfg, p) } : {}),
    choice: { do: 'cook', maker, carrier: C.id, with: ins } });
  return [
    ...out.map(ins => opt(ins, productOf(cfg, ins), ins.reduce((a, k) => a + X.makings[k].price, 0))),
    // (a bag in a bottle: one bag, at what it cost you)
    ...bagsHome.map(g => opt([g], productById(cfg, bottleFor(cfg, cfg.goods[g].product)), cfg.goods[g].price / cfg.goods[g].sales)),
  ];
}
/** (bench-1) The product a bag of `product` makes in the bench's carrier (config make.products `bag`), or null. */
export const bottleFor = (cfg, product) => Object.keys(M(cfg)?.products ?? {}).find(id => M(cfg).products[id].bag === product) ?? null;

// ── people under it ──────────────────────────────────────────────────────────────────────────────────────────────────
/** A row in words: { effect, label, words, from, until, untilClock, hoursLeft, place, product, name, bad, look }. */
export function rowWords(cfg, state, r) {
  const E = M(cfg).effects[r.effect] ?? {};
  const t = clockOf(state);
  const u = clockAt(r.until);
  return { effect: r.effect, label: E.label ?? r.effect, words: E.words ?? null, from: r.from, until: r.until, untilDay: u.day, untilHour: u.hour, untilClock: u.clock, started: r.from <= t, hoursLeft: Math.max(0, r.until - Math.max(t, r.from)),
    place: r.place, product: r.by?.product ?? null, name: r.by?.product ? productName(cfg, state, r.by.product) : null, maker: r.by?.maker ?? null, carrier: r.by?.carrier ?? null, bad: !!E.bad, look: E.look ? { ...E.look } : null, lifted: !!r.lifted };
}
/** Who is under what, until when: every named person with a row on now or still to come today, by place. */
export function underView(cfg, state) {
  const t = clockOf(state);
  const out = [];
  for (const [id, rows] of Object.entries(state.under ?? {})) {
    const p = personOf(cfg, id);
    const live = rows.filter(r => r.until > t);
    if (!live.length) continue;
    const now = live.filter(r => r.from <= t);
    out.push({ who: p ? whoOf(p) : { id, name: id, role: null }, place: live[0].place, now: now.map(r => rowWords(cfg, state, r)), next: live.filter(r => r.from > t).map(r => rowWords(cfg, state, r)),
      text: `${cap(p?.name ?? id)}: ${now.length ? now.map(r => `${M(cfg).effects[r.effect]?.label ?? r.effect} until ${clockAt(r.until).clock}`).join(', ') : 'nothing yet'}${live.some(r => r.from > t) ? `; then ${live.filter(r => r.from > t).map(r => M(cfg).effects[r.effect]?.label ?? r.effect).join(', ')}` : ''}` });
  }
  return out;
}
/** A place's chips: how many there are under each effect now ("asleep 2 · dancing 3"). */
export function placeChips(cfg, state, place) {
  const t = clockOf(state);
  const n = {};
  for (const rows of Object.values(state.under ?? {})) for (const r of rows) if (r.place === place && r.from <= t && t < r.until) n[r.effect] = (n[r.effect] ?? 0) + 1;
  return Object.entries(n).map(([e, k]) => ({ effect: e, label: M(cfg).effects[e]?.label ?? e, n: k, text: `${M(cfg).effects[e]?.label ?? e} ${k}` }));
}

// ── a sleeper's wallet ───────────────────────────────────────────────────────────────────────────────────────────────
/** What lifting a sleeper's wallet pays at a place: its `like` job's pay (the place's wallet), in dollars. */
export function liftPay(cfg, place) {
  const L = M(cfg)?.lift;
  const j = placeOf(cfg, place).jobs?.[L?.like];
  return j?.pay ? [...j.pay] : L?.base ? scale(L.base, tierOf(cfg, place)?.pay ?? 1) : null;
}
/**
 * THE SLEEPERS AT A PLACE whose wallet can be lifted now: a person under an effect whose `person.lift` says so, not yet
 * lifted on this dose. Each with what it pays and what it costs you (he knows who sold it: config make.lift).
 */
export function liftsAt(cfg, state, place = state.place) {
  const L = M(cfg)?.lift;
  const pay = L ? liftPay(cfg, place) : null;
  if (!pay) return [];
  const E = M(cfg).effects;
  const out = [];
  for (const id of Object.keys(state.under ?? {})) {
    const row = underNow(state, id).find(r => r.place === place && E[r.effect]?.person?.lift && !r.lifted);
    if (!row) continue;
    const p = personOf(cfg, id);
    if (!p) continue;
    const pr = pronouns(cfg, id);
    out.push({ who: whoOf(p), effect: row.effect, until: row.until, untilClock: clockAt(row.until).clock, pay, label: L.label.replace('{who}', p.name).replace('{they}', pr.they),
      mark: L.mark, trust: L.trust, pressure: L.pressure?.win ?? 0, product: row.by?.product ?? null });
  }
  return out;
}

// ── a made good on a selling card ───────────────────────────────────────────────────────────────────────────────────
/** A made good in a selling card's words: { product, name, lines, short, dirty (found out), text: "Zonked: she'll sleep 3 h" }. */
export function madeWords(cfg, state, g, who = null) {
  const G = cfg.goods?.[g];
  if (!G?.made) return null;
  const p = productById(cfg, G.product);
  const pr = who ? pronouns(cfg, who.id) : { they: 'they' };
  // (after "she'll", the verb as it is: "sleep", "dance")
  const short = p.effects.map((e, i) => `${i && e.at > 0 ? 'then ' : ''}${who ? M(cfg).effects[e.effect].short.replace(/s$/, '') : M(cfg).effects[e.effect].short} ${e.hours} h`).join(', ');
  const name = goodLabel(cfg, state, g);
  return { product: G.product, name, rarity: G.rarity, families: p.families, lines: effectLines(cfg, p), short: effectShort(cfg, p), dirty: G.dirty && knownDirty(cfg, state, g) ? G.dirty : null,
    text: `${name}: ${who ? `${pr.they === 'they' ? 'they\'ll' : `${pr.they}'ll`} ` : ''}${short}` };
}

// ── which bag a sale takes ───────────────────────────────────────────────────────────────────────────────────────────
/**
 * The bag a sale of a good (as it shows) takes from what you carry: among it and a dirty batch of it not yet found out,
 * one of them as their counts weigh (nobody can tell them apart), by the run's dice (`keys`).
 */
export function pickBag(cfg, state, g, keys) {
  const all = behind(cfg, state, g).filter(k => goodsOn(state, k) > 0);
  if (all.length <= 1) return all[0] ?? g;
  const n = all.reduce((a, k) => a + goodsOn(state, k), 0);
  let r = Math.floor(rng(state.seed, 'run-bag', ...keys)() * n);
  for (const k of all) { r -= goodsOn(state, k); if (r < 0) return k; }
  return all[all.length - 1];
}
/**
 * Goods asked for as they show, as the goods behind them: n of a product with a dirty batch not yet found out at the
 * crib comes out of both, as their counts weigh (the dirty share rounded). { good: n } → { good behind: n }.
 */
export function goodsBehind(cfg, state, want, where = 'stash') {
  const out = {};
  for (const [g, n0] of Object.entries(want ?? {})) {
    const keys = behind(cfg, state, g).filter(k => (state[where]?.[k] ?? 0) > 0);
    if (keys.length <= 1) { out[keys[0] ?? g] = (out[keys[0] ?? g] ?? 0) + n0; continue; }
    const total = keys.reduce((a, k) => a + state[where][k], 0);
    let left = Math.min(n0, total);
    const dirty = keys.filter(k => k !== g);
    for (const k of dirty) {
      const take = Math.min(state[where][k], Math.round((n0 * state[where][k]) / total));
      if (take) out[k] = (out[k] ?? 0) + take;
      left -= take;
    }
    const clean = Math.min(left, state[where][g] ?? 0);
    if (clean) out[g] = (out[g] ?? 0) + clean;
    left -= clean;
    // (any rounding left over from the dirty ones)
    for (const k of dirty) { if (left <= 0) break; const more = Math.min(left, state[where][k] - (out[k] ?? 0)); if (more > 0) { out[k] = (out[k] ?? 0) + more; left -= more; } }
    if (n0 > total) out[g] = (out[g] ?? 0) + (n0 - total); // (more asked than there is: the caller's check says so)
  }
  return out;
}

/** Sum of a maker's cooks on a day (the smell's count). */
export const cooksOn = (state, maker, day) => makeState(state, maker).cooked[day] ?? 0;
export const everCooked = (state, maker) => sum(makeState(state, maker).cooked) > 0 || Object.keys(makeState(state, maker).book.tried).length > 0;
