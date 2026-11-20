// THE LIBRARY IN THE RUN (lib-1; the owner, 2026-11-16: "the library is massive and the home builder has tons of
// stuff, I want all of that in the game"). Every piece of the city's cast to wear and every piece of the home kit that
// can stand in the trailer is a thing the player can own, beside the named things of config `things`. Cosmetic only:
// no piece changes any number but the cash it costs.
//
//   A PIECE'S KEY is what the game draws: '<cast slot>:<id>' (hat, eyewear, top, bottom, shoes, acc) or 'kit:<id>'.
//   Owning one is `state.things[key] = true`, wearing one `state.worn[slot] = key`, exactly as a named thing (whose key
//   is a plain word): no new field, so the save's version stays 8. A named thing IS its piece (config `piece`): that
//   piece is not offered a second time.
//   TIERS are plain numbers (0 the commonest; config library.tiers.labels names them), from the library's own tier
//   words, else from the id's hash. PRICES are each tier's band (MOCK, config), the place in it fixed by the id.
//   THE SHELVES: each seller of things to wear or for the trailer shows a few pieces a day, drawn from the run's seed
//   and the day: nothing is stored. `seen`: on any shelf on any day so far.
//
//   libraryOf(cfg)                  { pieces, byKey, sellers, out }: every piece of the run, and what was left out and why
//   thingOf(cfg, key)               a named thing or a piece, in the shape of a config thing (label, kind, slot, price…)
//   shelvesOn(cfg, seed, day)       every seller's shelf that day · shelvesHere(cfg, state): those where you stand
//   seenBy(cfg, state)              the keys seen so far
//   dressOf(cfg, worn, tried)       { cast slot: id } of what is worn, with what is tried on laid over it
//   tryOn(cfg, state, keys)         what the figure shows trying `keys` on: changes nothing (the state is read only)
//   libraryView(cfg, state)         what the wardrobe, the tray and the catalog need (view.library)
import { hash32, rng } from '../rng.mjs';
import { WEAR, HOME, NOFIT } from './library-data.mjs';

/** Home pieces that cannot work in the trailer, by rule (the rest of the kit's floor and table pieces can). */
const STRUCTURE = new Set(['door-front', 'window', 'ac-window', 'radiator', 'wall-panelling']);
/** The home pieces the city drew for crafting (trunk 9cfd6788, interiors/home/craft.js): their rules are not built yet. */
const CRAFTED = new Set(['tool-bench', 'door-can', 'door-gun', 'porch-lamp']);
/** Why a home piece is left out by rule (null: it may stand in the trailer, if it fits: NOFIT, measured). */
export function homeRuleOut(o) {
  if (CRAFTED.has(o.id)) return 'drawn for crafting: its rule (how it is made and what it does) is not built yet';
  // (part D: wall pieces hang on the trailer's three walls, demo/stage/set/walls.js; the ceiling stays bare: with the
  // roof cut away for the view, a ceiling piece would hang in front of the room)
  if (o.place === 'ceiling') return 'a ceiling piece: with the roof cut away for the view, it would hang in front of the room';
  if (STRUCTURE.has(o.id)) return 'structure of a home (a door, a window, a radiator, the wall panelling)';
  if (o.cat === 'beds') return 'a bed: the trailer\'s one bed is the run\'s own (the mattress, or the real bed from the crib)';
  if (o.id === 'stash-floorboard') return 'the trailer\'s own floorboard is where the cash goes: a second would be a second stash';
  if (o.id === 'kitchenette') return 'the trailer\'s kitchen is built in';
  return null;
}
/** Why a home piece is left out: by rule, or because it fits nowhere in the starter trailer (demo/tools/library-catalog.mjs --fit). */
function homeOut(o) {
  return homeRuleOut(o) ?? NOFIT.find(([id]) => id === o.id)?.[1] ?? null;
}

const cache = new WeakMap();
/** Every piece of the run (named things first, then the library), its tier and price; the sellers; what was left out. */
export function libraryOf(cfg) {
  if (cache.has(cfg)) return cache.get(cfg);
  const L = cfg.library;
  const tierOfWord = (word, key) => L.tiers.from[word] ?? tierByHash(L, key);
  const priceOf = (tier, key) => {
    const [lo, hi] = L.tiers.price[tier];
    const f = (hash32(`price|${key}`) % 10000) / 10000;
    return nice(lo + (hi - lo) * f);
  };
  const named = new Map();
  for (const [item, t] of Object.entries(cfg.things ?? {})) if (t.piece) named.set(t.piece, item);
  const pieces = [];
  const out = [];
  for (const [slot, id, name, pool, word] of WEAR) {
    const key = `${slot}:${id}`;
    if (!L.slots[slot] || named.has(key)) continue;
    const tier = tierOfWord(word, key);
    pieces.push({ key, kind: 'wear', slot: L.slots[slot], castSlot: slot, id, name: plainName(name), pool, tier, price: priceOf(tier, key) });
  }
  for (const [id, name, cat, place, foot, h, gameKind, word, mount] of HOME) {
    const key = `kit:${id}`;
    if (named.has(key)) continue;
    const why = homeOut({ id, cat, place });
    if (why) {
      out.push({ key, name, why });
      continue;
    }
    const tier = tierOfWord(word, key);
    pieces.push({ key, kind: 'home', id, name, cat, place, foot: [...foot], h, mount: mount ?? null, gameKind, tier, price: priceOf(tier, key) });
  }
  // the named things as pieces too (their own price; the tier of the piece they are)
  const wordOf = new Map([...WEAR.map(w => [`${w[0]}:${w[1]}`, w[4]]), ...HOME.map(o => [`kit:${o[0]}`, o[7]])]);
  const namedPieces = [...named].map(([piece, item]) => {
    const t = cfg.things[item];
    return { key: item, kind: t.kind, slot: t.slot ?? null, castSlot: t.kind === 'wear' ? piece.split(':')[0] : null, id: piece.split(':')[1], piece, name: t.label, named: true,
      tier: tierOfWord(wordOf.get(piece), piece), price: t.price, at: t.at, keeper: t.keeper ?? null, spot: t.spot ?? null };
  });
  const all = [...namedPieces, ...pieces];
  // the sellers: a keeper of things to wear or for the trailer at a place that is open, one shelf per kind they sell
  const sellers = [];
  for (const t of Object.values(cfg.things ?? {})) {
    // (sixes-1: a keeper of the slice's late pieces only, the defences, keeps no shelf of the library's)
    if (!t.keeper || t.late || !(t.kind === 'wear' || t.kind === 'home') || cfg.places[t.at]?.locked || !L.shelf[t.kind]) continue;
    if (sellers.some(s => s.place === t.at && s.keeper === t.keeper && s.kind === t.kind)) continue;
    sellers.push({ place: t.at, keeper: t.keeper, spot: t.spot ?? null, kind: t.kind, size: L.shelf[t.kind] });
  }
  const lib = { pieces: all, byKey: new Map(all.map(p => [p.key, p])), sellers, out, pool: { wear: pieces.filter(p => p.kind === 'wear'), home: pieces.filter(p => p.kind === 'home') } };
  cache.set(cfg, lib);
  return lib;
}
const tierByHash = (L, key) => {
  const u = hash32(`tier|${key}`) % 1000;
  let acc = 0;
  for (let t = 0; t < L.tiers.shares.length; t++) if (u < (acc += L.tiers.shares[t])) return t;
  return 0;
};
/** A price rounded the way a tag is written: $8, $35, $255, $6,450, $152,000. */
function nice(x) {
  const step = x < 100 ? 1 : x < 1000 ? 5 : x < 20000 ? 50 : 1000;
  return Math.max(1, Math.round(x / step) * step);
}
/** An NPC-pool piece's name without the pool's tag: "Civilian · trench coat" → "trench coat". */
const plainName = n => String(n).replace(/^Civilian · /, '');

/** A thing by its key, in the shape of a config thing (a named thing as it is; a piece with its name as label). */
export function thingOf(cfg, key) {
  if (cfg.things?.[key]) return { item: key, ...cfg.things[key] };
  const p = libraryOf(cfg).byKey.get(key);
  if (!p) return null;
  return { item: key, label: p.name, kind: p.kind, slot: p.slot ?? null, piece: p.key, price: p.price, tier: p.tier, library: true,
    desc: `${cfg.library.tiers.labels[p.tier]} · ${p.kind === 'wear' ? p.castSlot : p.cat}` };
}
/** The piece a thing is drawn as ('hat:lucky7_dad', 'kit:beanbag', 'board:pink'…), or null. */
export const pieceOf = (cfg, key) => (cfg.things?.[key] ? cfg.things[key].piece ?? null : libraryOf(cfg).byKey.has(key) ? key : null);

const shelfCache = new Map();
/** Every seller's shelf on a day: [{ place, keeper, spot, kind, items: [key] }]. The same seed and day, the same shelves. */
export function shelvesOn(cfg, seed, day) {
  const lib = libraryOf(cfg);
  const k = `${seed}|${day}`;
  let per = shelfCache.get(cfg)?.get(k);
  if (per) return per;
  per = lib.sellers.map(s => {
    const pool = lib.pool[s.kind];
    const r = rng(seed, 'shelf', day, s.place, s.keeper, s.kind);
    // (the first `size` of a shuffle, drawn without shuffling the rest)
    const idx = pool.map((_, i) => i);
    const n = Math.min(s.size, pool.length);
    for (let i = 0; i < n; i++) {
      const j = i + Math.floor(r() * (idx.length - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return { ...s, items: idx.slice(0, n).map(i => pool[i].key) };
  });
  if (!shelfCache.has(cfg)) shelfCache.set(cfg, new Map());
  const m = shelfCache.get(cfg);
  if (m.size > 4000) m.clear();
  m.set(k, per);
  return per;
}
/** The shelves where you stand today (none on a route, none at a locked place). */
export function shelvesHere(cfg, state) {
  if (state.route || cfg.places[state.place]?.locked) return [];
  return shelvesOn(cfg, state.seed, state.day).filter(s => s.place === state.place);
}
/** Every key seen so far: on any shelf on any day up to today (every day's shelves are in the view), or owned. */
export function seenBy(cfg, state) {
  const seen = new Set(Object.keys(state.things ?? {}).filter(k => state.things[k]));
  for (let d = 1; d <= state.day; d++) for (const s of shelvesOn(cfg, state.seed, d)) for (const k of s.items) seen.add(k);
  return seen;
}

/** What the figure wears: { cast slot: id } of everything worn, with what is tried on laid over it (`tried`: keys). */
export function dressOf(cfg, worn = {}, tried = []) {
  const out = {};
  const put = key => {
    const piece = pieceOf(cfg, key);
    if (!piece) return;
    const [slot, id] = piece.split(':');
    if (cfg.library.slots[slot]) out[slot] = id;
  };
  for (const key of Object.values(worn ?? {})) put(key);
  for (const key of tried ?? []) put(key);
  return out;
}
/**
 * TRYING ON (the owner: "people should be able to try it on tho without buying it"): any piece to wear, owned or not,
 * on a shelf today or not. Free, no hour, and nothing of the state changes (it only reads it): the stage shows the
 * figure in `dress` until the page clears it (stage.tryOn / stage.tryOff). → { dress, slots: { run slot: key }, why }
 */
export function tryOn(cfg, state, keys = []) {
  const tried = [];
  const slots = {};
  for (const key of [].concat(keys)) {
    const t = thingOf(cfg, key);
    if (!t || t.kind !== 'wear') return { dress: dressOf(cfg, state.worn), slots: {}, why: `${key}: not a thing to wear` };
    tried.push(key);
    slots[t.slot] = key;
  }
  return { dress: dressOf(cfg, state.worn, tried), slots, why: null };
}

/**
 * THE LIBRARY IN THE VIEW (view.library; demo/run and the panels being rebuilt on ui-3 read it):
 *   slots       [{ slot, label }]: the run's slots to wear, each with what is worn in it
 *   tiers       the tier labels, by number
 *   shelves     today's shelves, every seller's: { place, keeper, spot, kind, here, items: [key] }
 *   pieces      every piece (named things too): { key, kind, slot, castSlot, piece, name, tier, price, cat, foot, place,
 *               named, owned, worn, seen, onShelf: { place, keeper } | null, soldAt: where it can be bought at all }
 *   owned       the keys owned, in the order of `pieces` · counts: { all, owned, seen } by kind
 */
export function libraryView(cfg, state) {
  const lib = libraryOf(cfg);
  const seen = seenBy(cfg, state);
  const today = shelvesOn(cfg, state.seed, state.day);
  const onShelf = new Map();
  for (const s of today) for (const k of s.items) onShelf.set(k, { place: s.place, keeper: s.keeper, spot: s.spot });
  const wornKeys = new Set(Object.values(state.worn ?? {}));
  const seller = lib.sellers;
  const pieces = lib.pieces.map(p => {
    const owned = !!state.things?.[p.key];
    return {
      key: p.key, kind: p.kind, slot: p.slot ?? null, castSlot: p.castSlot ?? null, piece: p.named ? cfg.things[p.key].piece : p.key, name: p.name, tier: p.tier, price: p.price,
      cat: p.cat ?? null, place: p.place ?? null, foot: p.foot ?? null, named: !!p.named, owned, worn: wornKeys.has(p.key), seen: owned || seen.has(p.key),
      onShelf: onShelf.get(p.key) ?? null,
      soldAt: p.named ? { place: p.at, keeper: p.keeper, spot: p.spot, every: 'day', locked: !!cfg.places[p.at]?.locked } : { shelves: seller.filter(s => s.kind === p.kind).map(s => ({ place: s.place, keeper: s.keeper })), every: 'when on the shelf' },
    };
  });
  const by = kind => ({ all: pieces.filter(p => p.kind === kind).length, owned: pieces.filter(p => p.kind === kind && p.owned).length, seen: pieces.filter(p => p.kind === kind && p.seen).length });
  return {
    slots: Object.values(cfg.library.slots).map(slot => ({ slot, worn: state.worn?.[slot] ?? null })),
    tiers: [...cfg.library.tiers.labels],
    shelves: today.map(s => ({ place: s.place, keeper: s.keeper, spot: s.spot, kind: s.kind, here: s.place === state.place && !state.route, items: [...s.items] })),
    pieces,
    owned: pieces.filter(p => p.owned).map(p => p.key),
    counts: { wear: by('wear'), home: by('home') },
  };
}
