// THE CATALOG'S LISTS AND WORDS (ui-3 leg 3, part C): pure, from the rules' view (view.library, view.choices,
// view.errands) and the config. The Library (library.js), the shop's shelf, the wardrobe and the home tray draw their
// pieces, their order, their marks and their buttons from here; none of them works anything out of its own. Tested in
// node: test/run-catalog.test.mjs (filters, sorting, the count, why a Buy button cannot be pressed).
//
//   pick(pieces, filter)        the pieces a filter shows (never hidden by `seen`: everything that exists)
//   order(list, sort)           sorted: by price or by rarity, then by name
//   countLine(shown, pieces, f) "38 of 299"
//   buyOf(p, ctx)               the Buy button: { can, key, label, why } (why: plain words, when it cannot be pressed)
//   wearOf(p, ctx)              Put on / Take off at home, or why not ("change at home")
//   soldLine(p, ctx)            where it is sold today, or that it is on no shelf today
//   fitLine(p)                  the slot it is worn in, or how it stands or hangs in the trailer, and its size
//   marksOf(p, v)               { owned, worn, today, here, wall }: what a tile marks
//   ctx: { cfg, v, choosing }
import { HOME } from '../../src/run/library-data.mjs';
import { RUN_CONFIG } from '../../src/run/config.mjs';

/** The three kinds of thing, in the Library's order. */
// (styles-1: and the ways to fight: the punch styles and the box cutter, each with what it does and where it is had)
export const KINDS = [{ id: 'wear', label: 'Wear' }, { id: 'home', label: 'Home' }, { id: 'ride', label: 'Ride' }, { id: 'fight', label: 'Fight' }];
/** The run's six slots to wear, in plain words. */
export const SLOTS = [
  { id: 'head', label: 'Head' }, { id: 'eyewear', label: 'Eyewear' }, { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' }, { id: 'feet', label: 'Feet' }, { id: 'acc', label: 'Accessories' },
];
/** The home kit's categories, in plain words, in the order the Library offers them. */
export const CATS = [
  ['seating', 'Seats'], ['tables', 'Tables'], ['storage', 'Storage'], ['lights', 'Lights'], ['electronics', 'Electronics'],
  ['gaming', 'Games'], ['music', 'Music'], ['decor', 'Decor'], ['wall', 'Wall art'], ['rugs', 'Rugs'], ['plants', 'Plants'],
  ['kitchen', 'Kitchen'], ['bath', 'Bath'], ['collectibles', 'Collectibles'], ['trophies', 'Trophies'], ['security', 'Security'],
  ['stash', 'Stash'], ['clutter', 'Clutter'],
].map(([id, label]) => ({ id, label }));
/** "On a wall": every piece that hangs on a wall, whatever its category. */
export const ON_WALL = 'on-wall';
/** What is shown: everything, what is on sale today, what you own. */
export const SHOWS = [{ id: 'all', label: 'All' }, { id: 'today', label: 'On sale today' }, { id: 'owned', label: 'Owned' }];
/** The orders. */
export const SORTS = [
  { id: 'price', label: 'Lowest price first' }, { id: 'price-down', label: 'Highest price first' },
  { id: 'tier', label: 'Common first' }, { id: 'tier-down', label: 'Grail first' },
];
/** The filter a Library starts with. */
export const FILTER0 = { kind: 'wear', slot: 'all', cat: 'all', tier: 'all', show: 'all', sort: 'price' };

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** A price as a tag is written: $8, $255, $6,450, $152,000. */
export const money = n => `$${Number(n ?? 0).toLocaleString('en-US')}`;
/** A piece's name, without its article: "Lucky 7 Dad Cap", "Fisherman beanie". */
export const nameOf = p => cap(String(p?.name ?? p?.key ?? '').replace(/^(a pair of|an?) /i, ''));
/** A tier's word: "Common", "Rare", "Epic", "Grail". */
export const tierWord = (t, labels = ['common', 'rare', 'epic', 'grail']) => cap(labels[t] ?? labels[0]);

const homeRow = new Map(HOME.map(r => [`kit:${r[0]}`, r]));
/** A home piece's own row of the kit (a named thing's by its piece): [id, name, cat, place, foot, h, kind, rarity, mount]. */
const rowOf = p => homeRow.get(p.piece ?? p.key) ?? homeRow.get(p.key) ?? null;
/** A home piece's category (a named thing has none of its own in the view: its piece's). */
export const catOf = p => p.cat ?? rowOf(p)?.[2] ?? null;
/** How it stands: 'floor', 'surface' or 'wall'. */
export const placeOfPiece = p => p.place ?? rowOf(p)?.[3] ?? null;
const footOf = p => p.foot ?? rowOf(p)?.[4] ?? null;
/** Whether it hangs on a wall. */
export const onWall = p => p.kind === 'home' && placeOfPiece(p) === 'wall';

/** Whether it can be bought somewhere today: on a shelf today, or a named thing sold every day at an open place. */
export const onSaleToday = p => !!p.onShelf || (!!p.named && p.soldAt?.every === 'day' && !p.soldAt.locked);

/** The pieces a filter shows: of its kind, its slot or category, its rarity, and all / on sale today / owned. */
export function pick(pieces, f = FILTER0) {
  const tier = f.tier === 'all' || f.tier === null || f.tier === undefined ? null : Number(f.tier);
  return (pieces ?? []).filter(p => p.kind === f.kind
    && (f.kind !== 'wear' || !f.slot || f.slot === 'all' || p.slot === f.slot)
    && (f.kind !== 'home' || !f.cat || f.cat === 'all' || (f.cat === ON_WALL ? onWall(p) : catOf(p) === f.cat))
    && (tier === null || p.tier === tier)
    && (f.show === 'today' ? onSaleToday(p) : f.show === 'owned' ? !!p.owned : true));
}
const SORT_BY = {
  price: (a, b) => a.price - b.price,
  'price-down': (a, b) => b.price - a.price,
  tier: (a, b) => a.tier - b.tier || a.price - b.price,
  'tier-down': (a, b) => b.tier - a.tier || b.price - a.price,
};
/** Sorted (a copy): by price or rarity, then by name, then by key, so the same list is always in the same order. */
export function order(list, sort = 'price') {
  const by = SORT_BY[sort] ?? SORT_BY.price;
  return (list ?? []).slice().sort((a, b) => by(a, b) || nameOf(a).localeCompare(nameOf(b)) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
/** "38 of 299": how many the filter shows, of every piece of that kind. */
/**
 * (styles-1) THE WAYS TO FIGHT, as the Library lists them (its Fight kind): each punch style (what it does, who teaches
 * it where, its price, whether it is yours, the Learn button when it is taught here and now) and the box cutter (sold at
 * your crib); what you fight with now marked. From the view (v.fight, v.shop) alone.
 *   → [{ key, name, does, where, price, owned, chosen, learn: { key, can, why } | null }]
 */
export function fightWays(v) {
  const F = v?.fight;
  if (!F) return [];
  const cutter = (v.shop ?? []).find(s => s.item === 'cutter');
  const ways = F.styles.map(s => ({
    key: s.style, name: cap(s.label), does: s.does, price: s.price, owned: s.known, chosen: F.arm === s.style,
    where: `${s.keeper ? `${s.keeper.name} teaches it ` : 'Taught '}${s.where}`,
    learn: s.known ? null : { key: s.key, can: !!s.available, why: s.available ? null : s.why },
  }));
  if (cutter) ways.push({ key: 'cutter', name: 'Box cutter', does: `${cutter.does}. A blade in a one-on-one: the answer to a knife.`, price: cutter.price, owned: !!cutter.owned, chosen: F.arm === 'cutter', where: 'Sold at your crib (B there)', learn: null });
  return ways;
}

export function countLine(shown, pieces, f = FILTER0) {
  const all = (pieces ?? []).filter(p => p.kind === f.kind).length;
  return `${Array.isArray(shown) ? shown.length : shown} of ${all}`;
}
/** The categories of the home pieces there are, with how many each holds, "On a wall" first. */
export function catsOf(pieces) {
  const home = (pieces ?? []).filter(p => p.kind === 'home');
  const n = id => home.filter(p => catOf(p) === id).length;
  return [{ id: ON_WALL, label: 'On a wall', n: home.filter(onWall).length }, ...CATS.map(c => ({ ...c, n: n(c.id) })).filter(c => c.n)];
}
/** How many of each slot. */
export function slotsOf(pieces) {
  const wear = (pieces ?? []).filter(p => p.kind === 'wear');
  return SLOTS.map(s => ({ ...s, n: wear.filter(p => p.slot === s.id).length }));
}

// ── WHERE AND WHO ─────────────────────────────────────────────────────────────────────────────────────────────────────
const SPOT = { 'clothes-rail': 'clothes rail', 'yard-sale': 'swap meet' };
const spotWord = spot => SPOT[spot] ?? (String(spot ?? '').startsWith('stall') ? 'stall' : 'shelf');
/** A keeper's name, from the view's own errands (each names its keeper). */
function keeperName(v, id) {
  for (const e of v?.errands ?? []) if (e.keeper?.id === id) return cap(e.keeper.name);
  return null;
}
const placeLabel = (cfg, pl) => cfg.places?.[pl]?.label ?? pl;
const placeWhere = (cfg, pl) => cfg.places?.[pl]?.where ?? `at ${placeLabel(cfg, pl)}`;
/** Whether you stand where it is sold today (not on the way somewhere). */
const isHere = (p, v) => {
  const at = p.onShelf?.place ?? (p.named ? p.soldAt?.place : null);
  return !!at && at === v?.place && !v?.route;
};

/** Where it is sold today, in a sentence: whose stall, at which place, or that it is on no shelf today. */
export function soldLine(p, { cfg, v }) {
  if (p.onShelf) {
    const who = keeperName(v, p.onShelf.keeper);
    return `On sale today${who ? ` at ${who}'s ${spotWord(p.onShelf.spot)}` : ''}, ${isHere(p, v) ? 'here' : placeWhere(cfg, p.onShelf.place)}.`;
  }
  if (p.named) {
    const s = p.soldAt ?? {};
    if (s.locked) return `Sold ${placeWhere(cfg, s.place)}, which is not open yet (${cfg.places?.[s.place]?.locked ?? 'later'}).`;
    const who = keeperName(v, s.keeper);
    return `On sale every day${who ? ` at ${who}'s ${spotWord(s.spot)}` : ''}, ${isHere(p, v) ? 'here' : placeWhere(cfg, s.place)}.`;
  }
  return 'Not on any shelf today. The shelves change every day.';
}

/**
 * THE BUY BUTTON: pressed only through the rules' own choice, `{ do: 'get', item }`, when they offer it here and now.
 * Otherwise it stays where it is and says why in plain words: "on a shelf at the flea market today", "not on any shelf
 * today", "you carry $40". → { can, key (the rules' choice key, or null), label, why }
 */
export function buyOf(p, { cfg, v, choosing = true }) {
  const label = `Buy ${money(p.price)}`;
  if (p.owned) return { can: false, key: null, label: 'Yours', why: p.kind === 'wear' ? 'you own it' : 'you own it: it is in the trailer or the tray' };
  const c = (v?.choices ?? []).find(x => x.choice?.do === 'get' && x.choice.item === p.key);
  if (c && !choosing) return { can: false, key: c.key, label, why: 'when this hour is over' };
  if (c?.available) return { can: true, key: c.key, label, why: null };
  if (c) return { can: false, key: c.key, label, why: c.why ? String(c.why) : 'not now' };
  return { can: false, key: null, label, why: notHere(p, { cfg, v }) };
}
/** Why it cannot be bought where you stand: where it is, or that it is nowhere today. */
function notHere(p, { cfg, v }) {
  if (p.onShelf) return isHere(p, v) ? 'on the shelf here, but not to you now' : `on a shelf ${placeWhere(cfg, p.onShelf.place)} today`;
  if (p.named) {
    const s = p.soldAt ?? {};
    if (s.locked) return `sold ${placeWhere(cfg, s.place)}: not open yet`;
    return isHere(p, v) ? 'not sold to you now' : `sold ${placeWhere(cfg, s.place)}, every day`;
  }
  return 'not on any shelf today';
}

/** Put on or take off, at home through the rules' own choice; elsewhere "change at home". → { key, label, can, why } | null */
export function wearOf(p, { v, choosing = true }) {
  if (p.kind !== 'wear' || !p.owned) return null;
  const c = (v?.choices ?? []).find(x => (x.choice?.do === 'wear' || x.choice?.do === 'unwear') && x.choice.item === p.key);
  const label = p.worn ? 'Take off' : 'Put on';
  if (!c) return { key: null, label, can: false, why: v?.place === 'crib' ? 'not now' : 'change at home' };
  if (!choosing) return { key: c.key, label, can: false, why: 'when this hour is over' };
  return { key: c.key, label: c.choice.do === 'unwear' ? 'Take off' : 'Put on', can: !!c.available, why: c.available ? null : c.why ?? 'not now' };
}

/** What a tile marks: yours, worn, on sale today (here, or elsewhere), hangs on a wall. */
export function marksOf(p, v) {
  return { owned: !!p.owned, worn: !!p.worn, today: onSaleToday(p), here: onSaleToday(p) && isHere(p, v), wall: onWall(p) };
}
/** The marks as words, for a tile's line and its tooltip: "yours · wearing", "on sale here", "on sale today". */
export function marksWords(m) {
  return [m.worn ? 'wearing' : m.owned ? 'yours' : null, !m.owned && m.here ? 'on sale here' : !m.owned && m.today ? 'on sale today' : null, m.wall ? 'hangs on a wall' : null].filter(Boolean).join(' · ');
}

const SLOT_LINE = { head: 'Worn on the head', eyewear: 'Worn over the eyes', top: 'A top', bottom: 'Worn on the legs', feet: 'Worn on the feet', acc: 'An accessory' };
const m = cells => `${+(cells * 0.25).toFixed(2)} m`;
/** The slot it is worn in, or how it stands or hangs in the trailer and its size. */
/** (sixes-1) A piece that defends your crib: its one job and whom it is against, in a sentence; else null. */
export function jobLine(p) {
  const T = p?.named ? RUN_CONFIG.things?.[p.key] : null;
  return T?.job ? `Defends your crib${T.against ? ` against ${T.against.map(a => (a === 'crew' ? 'a crew' : 'a sneak')).join(' and ')}` : ''}: ${T.job}.` : null;
}
export function fitLine(p) {
  if (p.kind === 'wear') return SLOT_LINE[p.slot] ?? 'To wear';
  if (p.kind === 'ride') return 'A ride: faster than walking, and no energy';
  const foot = footOf(p);
  const how = placeOfPiece(p);
  const size = foot ? (how === 'wall' ? `${m(foot[0])} wide, ${m(foot[1])} tall` : `${m(foot[0])} × ${m(foot[1])}`) : null;
  const where = how === 'wall' ? 'Hangs on a wall' : how === 'surface' ? 'Stands on a table or counter' : 'Stands on the floor';
  return size ? `${where} · ${size}` : where;
}
/** The slot's or category's plain word. */
export function kindWord(p) {
  if (p.kind === 'wear') return SLOTS.find(s => s.id === p.slot)?.label ?? 'To wear';
  if (p.kind === 'ride') return 'Ride';
  return CATS.find(c => c.id === catOf(p))?.label ?? 'Home';
}
