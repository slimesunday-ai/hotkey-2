// THE RUN'S OPENABLE PANELS (demo/run/index.js opens them, one at a time, beside the dock): the character sheet, every
// move that exists, the stuff that can be bought, and the map. Each is drawn from the run's own config, view and state
// (src/run/): no number here is typed by hand, so none of them can drift from the rules. They show. Two things act
// (rules-2): a street move's "now" tag in the All moves panel PICKS it on the bar (the numbers and Enter still choose
// there), and the place's shop in the Stuff panel is bought with one click. The three things stay the crib card's.
//
//   characterBody(ctx) · movesBody(ctx) · stuffBody(ctx) · the map's words: lineNote(ctx), stopFlag(ctx, stop), stopBody(ctx, stop)
//   hookedShort(cfg, regular) · hookedText(cfg, regular): how hooked a regular is, in words
//   trustMark(t) · trustMeter(cfg, n) · trustTitle(t) · tellEl(tell) · signedT(n): trust (trust-1), wherever a person
//   is named (the bar's cards use them too), and the chance of being told on, drawn as the odds are
//   ctx: { cfg, v, state, dayStart, choosing, pick(key), go(key) }
// The kit's own pieces (city/from-trunk/style/city/ui/kit.js: statRow, the k-stats rows, k-card) wherever one fits.

import { h, barEl } from '../hud/dom.js';
import { statRow } from '../../city/from-trunk/style/city/ui/kit.js';
import { RUN_CONFIG, jobOdds, danger as dangerAt } from '../../src/run/index.mjs';
// (the street's numbers for a place you are not at: the rules' own functions, read only)
import { robOdds, binsFinds, tierOf, placeOf, fullEnergy, doorChance } from '../../src/run/rules.mjs';
// (where each thing for the trailer stands in the crib, by arrangement: the stage's own table, read only)
import { THINGS as TRAILER } from '../stage/set/starter.js';
// (ui-3, leg 3: the wardrobe's tiles and words: the run's icons, the catalog's names, slots, rarity and buttons)
import { icon } from './icons.js';
import { SLOTS, nameOf as pieceName, tierWord, wearOf } from './catalog.js';

// ── GOODS AND THINGS, IN WORDS (goods-1) ───────────────────────────────────────────────────────────────────────────
/** A good's short word, one or many (the view's labels are long: "loose cigarettes", "bootleg films on disc"). */
const GOOD_WORD = { smokes: ['cigarette', 'cigarettes'], discs: ['disc', 'discs'], pills: ['pill', 'pills'] };
export const goodWord = (cfg, g, n = 2) => (GOOD_WORD[g] ? GOOD_WORD[g][n === 1 ? 0 : 1] : cfg.goods?.[g]?.label ?? g);
/** Goods { good: n } as "5 cigarettes · 2 discs" (empty: ''). */
export const goodsWords = (cfg, goods, sep = ' · ') => Object.entries(goods ?? {}).filter(([, n]) => n > 0).map(([g, n]) => `${n} ${goodWord(cfg, g, n)}`).join(sep);
/** A pack in one word: "carton", "stack". */
export const packWord = (cfg, g) => (cfg.goods?.[g]?.pack ?? 'a pack').replace(/^an? /, '').split(' ')[0];
/** A thing's name without its article: "casino visor". */
export const thingWord = label => String(label ?? '').replace(/^an? /i, '');
/**
 * THE THINGS TO WEAR, ON THE FIGURE: each is a piece of the city's cast (config `things` `piece`, lib-1), and the stage
 * dresses the player in it (stage/actors.js dress). Kept for what reads it by name: { slot, id, name, fit }.
 */
export const WEAR_LOOK = Object.fromEntries(Object.entries(RUN_CONFIG.things).filter(([, t]) => t.kind === 'wear' && t.piece)
  .map(([item, t]) => [item, { slot: t.piece.split(':')[0], id: t.piece.split(':')[1], name: thingWord(t.label), fit: t.desc }]));
const CRIB = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('crib') === 'b') ? 'b' : 'a';
/** Where a thing for the trailer stands in the crib (null: nowhere, it is listed only). */
export const trailerWhere = item => TRAILER[CRIB]?.[item]?.where ?? null;

const money = n => `$${n}`;
const range = ([lo, hi]) => (lo === hi ? money(lo) : `$${lo}–${hi}`);
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const signed = n => (n > 0 ? `+${n}` : `−${-n}`);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const kbd = key => h('kbd', null, key);
const ROLE = { neighbour: 'neighbour', buyer: 'buyer', mark: 'mark', debtor: 'debtor', shopkeeper: 'shopkeeper', stallholder: 'stallholder' };
const PLACE_ORDER = ['park', 'market'];
const placeName = (cfg, p) => cap(cfg.places[p].label);

/** A section of a panel: a heading in the kit's sign face and its body. */
const sec = (title, ...kids) => h('section', { class: 'rn-sec' }, h('h3', { class: 'rn-sec-h' }, title), ...kids);

/** The ledger of a stretch of the run, from two copies of the books: what came in and what went out. */
function ledgerRows(cfg, from, to, banked) {
  return [
    ['Earned', to.earned - from.earned, 'good'], ['Taken', to.jumped - from.jumped, 'bad'], ['Seized', to.seized - from.seized, 'bad'],
    ['Fares', to.fares - from.fares, ''], ['Spent', to.spent - from.spent, ''], ['Banked now', banked, 'good'],
  ];
}
const ledgerEl = rows => h('div', { class: 'hk-ledger rn-ledger' }, rows.map(([label, n, tone]) => h('div', { class: n && tone ? `is-${tone}` : '' }, h('span', null, label), h('b', null, money(n)))));

/** A mood as a small plate in its colour (the same words the cards use). */
const moodEl = (cfg, mood) => h('em', { class: `rn-mood is-${mood}` }, mood === 'calm' ? 'calm' : cfg.moods[mood].replace(/^is /, ''));

// ── TRUST (RUN.md "Trust"): one number per person, kept across nights; its band is a mark by their name wherever they
// are named. ▼ AGAINST YOU on red (off your table, and about at their place they may call in what you do there);
// ▲ WITH YOU on ink (they see nothing, a job with them pays more). Neutral is quiet: no mark on a card, a grey word in
// the People tab. Never by colour alone: the arrow and the word say it too. All of it is the view's (`trust`,
// `trustHere`, an option's `trust`, `withPay`, `tellRisk`).
const GLYPH = { against: '▼', with: '▲', neutral: '·' };
export const signedT = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
/** A person's trust in words, for a tooltip: the number, the band, and what it means. */
export function trustTitle(t) {
  if (!t) return '';
  const days = t.offDays ? `; won't deal with you, ${plural(t.offDays, 'day')}` : '';
  const means = t.band === 'with' ? ': they see nothing, and a job with them pays more' : t.band === 'against' ? `${days}; about at their place, they may call the police on what you do there` : '';
  return `${t.name ? `${cap(t.name)}: ` : ''}trust ${signedT(t.trust ?? 0)} (${t.bandText ?? t.band ?? 'neutral'})${means}`;
}
/** The mark by a name: ▲ with you (and, on a card, the extra a job with them pays), ▼ against you; neutral only when asked. */
export function trustMark(t, { pay = 0, short = false, quiet = true } = {}) {
  if (!t) return null;
  const band = t.band ?? 'neutral';
  if (band === 'neutral' && quiet) return null;
  const word = band === 'with' ? 'with you' : band === 'against' ? (short ? 'against' : 'against you') : 'neutral';
  return h('span', { class: `rn-trust is-${band}`, title: `${trustTitle(t)}${pay ? `. With them it pays ${money(pay)} more.` : ''}` },
    h('i', { 'aria-hidden': 'true' }, GLYPH[band]), word, pay ? h('b', null, `+${money(pay)}`) : null);
}
/** The number as a small meter, −3 to +3 from the middle out: red to the left, green to the right; the bands' cells ringed. */
export function trustMeter(cfg, n) {
  const T = cfg.trust;
  const cells = [];
  for (let k = T.min; k <= T.max; k++) {
    if (!k) {
      cells.push(h('b'));
      continue;
    }
    const on = k < 0 ? n <= k : n >= k;
    cells.push(h('i', { class: `${k < 0 ? 'is-neg' : 'is-pos'}${on ? ' is-on' : ''}${k <= T.against || k >= T.with ? ' is-zone' : ''}` }));
  }
  return h('span', { class: 'rn-tmeter', role: 'img', 'aria-label': `trust ${signedT(n)} of ${signedT(T.min)} to ${signedT(T.max)}` }, ...cells, h('em', null, signedT(n)));
}
/**
 * The chance of being told on, as the odds are shown (a small bar and its number), and who would tell. null: nobody
 * would. `short` (a card's small line): someone nameless by their first words, "a man at the bus stop" as "a man"
 * (a place's nameless people differ in those), their whole name in the tooltip.
 */
export const shortName = name => name.replace(/^(an? [a-z]+) (at|in|with) .*$/i, '$1');
export function tellEl(tell, { by = true, short = false } = {}) {
  if (!tell?.pct) return null;
  const said = tell.by.map(p => cap(short ? shortName(p.name) : p.name)).join(' and ');
  const names = tell.by.map(p => cap(p.name)).join(' and ');
  return h('span', { class: 'rn-odds rn-tell', title: `${tell.pct}% ${names} (against you, about now) ${tell.by.length > 1 ? 'call' : 'calls'} it in: heat +${tell.heat} on the place` },
    barEl([{ key: 'clean', pct: 100 - tell.pct, label: 'kept quiet' }, { key: 'disaster', pct: tell.pct, label: 'called in' }], { small: true }),
    h('b', null, `${tell.pct}% told`), by ? h('span', { class: 'rn-tell-by' }, `· ${said}`) : null);
}

// ── A REGULAR: how hooked, in words (rules-2: they keep count of what you have sold them, across days) ──────────────
/** Short, for the card's small line: "not hooked", "getting hooked, had 2", "hooked, had 4", "badly hooked, had 6", or a grudge. */
export function hookedShort(cfg, r) {
  if (!r) return null;
  if (r.grudgeDays) return `a grudge: ${plural(r.grudgeDays, 'day')}`;
  const n = r.sold;
  const word = !n ? 'not hooked' : n < r.doorFrom ? 'getting hooked' : doorChance(cfg, n) >= cfg.regulars.capPct ? 'badly hooked' : 'hooked';
  return n ? `${word}, had ${n}` : word;
}
/** In full, for the People tab and the card's tooltip: what they have had, what they pay, and the door. */
export function hookedText(cfg, r) {
  if (!r) return '';
  const R = cfg.regulars;
  const up = Math.min(R.payUpMax, R.payUp * r.sold);
  const pays = up ? ` They pay $${up} more for it now.` : '';
  if (r.grudgeDays) return `Holding a grudge: no sales to them for ${plural(r.grudgeDays, 'more day')}. Has had ${r.sold} from you.`;
  if (!r.sold) return `A regular: easy to sell to, and they keep count. Nothing from you yet. From ${R.doorAt} sales on they may come to your door in the morning wanting more.`;
  if (!r.hooked) return `${hookedShort(cfg, r)}: has had ${r.sold} from you.${pays} ${r.doorFrom - r.sold} more and they may come to your door in the morning.`;
  return `${hookedShort(cfg, r)}: has had ${r.sold} from you.${pays} ${doorChance(cfg, r.sold)}% they are at your door each morning, wanting more.`;
}

// ── THE CHARACTER SHEET ────────────────────────────────────────────────────────────────────────────────────────────
/** The stats tab: only what the run's state and its books hold. */
export function characterStats({ cfg, v, state, dayStart }) {
  const owned = v.shop.filter(s => s.owned);
  const b = state.books;
  const energyNote = `${v.energyMax} a day on ${state.owned.bed ? 'the real bed' : 'the mattress'}; tired at ${cfg.energy.tiredAt} or less (odds −${cfg.energy.tiredOdds}, easier to jump)`;
  // (rules-2: your own heat beside the heat here, the higher of yours and the place's)
  const here = (v.places ?? []).find(p => p.here);
  const heatNote = `the heat on you where you stand is the higher of your own and the place's${here ? ` (${here.label}: ${here.heat})` : ''}. Yours drops ${cfg.heat.nightDrop} a night at home (not on the street, in the clinic or in jail); a place cools ${tierOf(cfg, 'park')?.cool ?? 2} every night. Where the police are about, they can stop you from heat ${cfg.police.from}`;
  return [
    sec('Now',
      h('div', { class: 'k-stats' },
        statRow('Day and hour', `Day ${v.day} · ${v.clock}`),
        statRow('Where', cap(v.placeLabel)),
        statRow(v.place === 'market' ? 'Carried · at risk' : 'Carried', money(v.carried), true),
        statRow('Banked · safe', money(v.banked)),
        statRow('Energy', `${v.energy} / ${v.energyMax}${v.tired ? ' · tired' : ''}`),
        statRow('Heat here', `${v.heatHere ?? v.heat} / ${v.heatMax}${here?.police ? ' · police about' : ''}`),
        statRow('Your own heat', `${v.heatYours ?? v.heat} / ${v.heatMax}`)),
      here ? h('p', { class: `rn-note${here.hot ? ' is-risk' : ''}` }, here.text) : null,
      h('p', { class: 'rn-note' }, `Energy: ${energyNote}. Every hour out costs ${cfg.energy.perHour}, the subway included.`),
      h('p', { class: 'rn-note' }, `Heat: ${heatNote}.`)),
    sec('What you own',
      owned.length
        ? h('ul', { class: 'rn-owns' }, owned.map(s => h('li', null, h('b', null, s.label), h('span', null, s.does))))
        : h('p', { class: 'rn-empty' }, 'Nothing yet: a mattress on the floor.')),
    sec('Today', ledgerEl(ledgerRows(cfg, dayStart, b, state.banked)),
      h('p', { class: 'rn-note' }, 'The night\'s report shows the same numbers when the day ends.')),
    sec('The run so far',
      h('div', { class: 'k-stats' },
        statRow('Days', state.day > 1 ? `day ${state.day}, ${plural(state.day - 1, 'day')} behind you` : 'day 1, the first'),
        statRow('Started with', money(b.start)),
        statRow('Earned in all', money(b.earned)),
        statRow('Taken by whoever jumped you', money(b.jumped)),
        statRow('Seized by the police', money(b.seized)),
        statRow('Fares', money(b.fares)),
        statRow('Spent on stuff', money(b.spent)),
        statRow('All three owned', state.doneDay ? `done in ${plural(state.doneDay, 'day')}` : `${owned.length} of ${v.shop.length} so far`))),
  ];
}

/**
 * The wearing tab: what the figure in the picture is made of, slot by slot, from the stage's own look of the player
 * (the spec the portrait is fed), each piece by the name the city's catalogue gives it (world/cast/fresh/). The list
 * is the section's first column; a skin picker, when there is one, goes in a column beside it (`.rn-wear`).
 */
export function characterWearing({ wearing, honest, cfg, v, choosing, go, tile, tryOn, takeOff, tried, library }) {
  const [wearSec, homeSec] = cfg && v ? boughtEl({ cfg, v, choosing, go }) : [];
  // (leg 3: the wardrobe in the place of the old list of things to wear, when the page gives the tiles)
  const bought = [...(tile && v?.library ? wardrobeEl({ v, choosing, go, tile, tryOn, takeOff, tried, library }) : [wearSec]), homeSec].filter(Boolean);
  if (!wearing) return [...bought, sec('Wearing', h('p', { class: 'rn-empty' }, 'Not ready yet: the figure is still being looked up.'))];
  return [...bought,
    sec('Wearing',
      // (ui-3 QUICK FIX: the player's words only: no internal names, no notes on what is still to come)
      h('p', { class: 'rn-note' }, `What you have on${honest ? ' (the figure turning above)' : ''}, part by part.`),
      h('div', { class: 'rn-wear' },
        h('ul', { class: 'rn-wear-list' }, wearing.map(w => h('li', { class: !w.id || w.id === 'none' ? 'is-none' : '' },
          h('span', { class: 'rn-role' }, w.label),
          h('b', null, !w.id || w.id === 'none' ? 'nothing' : w.id === 'base' ? 'your own' : w.name ?? 'your own')))))),
  ];
}

/**
 * THE WARDROBE (ui-3, leg 3): the six slots, each with the tile of what you have on in it ("your own": nothing bought
 * on), and every piece to wear you own as a tile. At home each is put on or taken off through the rules' own choice (no
 * hour); elsewhere it says "change at home", and Try on shows it on you there and then. Everything else to wear is in
 * the Library (L).
 */
function wardrobeEl({ v, choosing, go, tile, tryOn, takeOff, tried, library }) {
  const L = v.library;
  const byKey = new Map(L.pieces.map(p => [p.key, p]));
  const home = v.place === 'crib';
  const slots = h('div', { class: 'u-wardrobe' }, L.slots.map(s => {
    const p = s.worn ? byKey.get(s.worn) : null;
    const label = SLOTS.find(x => x.id === s.slot)?.label ?? s.slot;
    return h('div', { class: `u-ward-slot${p ? '' : ' is-empty'}`, title: p ? `${label}: ${pieceName(p)}` : `${label}: your own, nothing bought on` },
      h('span', { class: 'u-ward-label' }, label),
      p ? tile(p.piece ?? p.key, { label: pieceName(p) }) : h('span', { class: 'u-tile u-ward-none', 'aria-hidden': 'true' }),
      h('b', { class: 'u-ward-name' }, p ? pieceName(p) : 'your own'));
  }));
  const mine = L.pieces.filter(p => p.kind === 'wear' && p.owned);
  const cells = mine.map(p => {
    const w = wearOf(p, { v, choosing });
    const isTried = tried?.[p.slot] === p.key;
    const slot = SLOTS.find(x => x.id === p.slot)?.label ?? '';
    return h('div', { class: `u-ward-cell${p.worn ? ' is-worn' : ''}` },
      h('span', { class: 'u-lib-pic' }, tile(p.piece ?? p.key, { label: pieceName(p) }),
        p.worn ? h('span', { class: 'u-marks' }, h('span', { class: 'u-mark is-worn', title: 'You are wearing it' }, icon('person'))) : null),
      h('b', { class: 'u-lib-name' }, pieceName(p)),
      h('span', { class: 'u-lib-meta' }, h('span', { class: `u-tier is-t${p.tier}` }, tierWord(p.tier)), h('span', { class: 'u-lib-price' }, p.worn ? `on · ${slot}` : slot)),
      w?.can ? h('button', { type: 'button', class: 'u-btn is-quiet u-ward-act', title: `${w.label}: no hour`, onclick: () => go?.(w.key) }, w.label)
        : h('span', { class: 'u-ward-why' }, w?.why ?? (home ? '' : 'change at home')),
      !home && tryOn && !p.worn ? h('button', { type: 'button', class: `u-btn is-quiet u-shelf-try${isTried ? ' is-on' : ''}`, 'aria-pressed': String(isTried), title: isTried ? 'Take it off' : 'See it on you here: you put it on for real at home', onclick: () => (isTried ? takeOff?.(p.key) : tryOn(p.key)) }, icon('person'), isTried ? 'Take off' : 'Try on') : null);
  });
  return [
    sec('Wardrobe', h('p', { class: 'rn-note' }, home ? 'What you have on, slot by slot. Put on and take off here, at home, for nothing.' : 'What you have on, slot by slot. You change at home.'), slots),
    sec(`Yours to wear · ${mine.length}`,
      mine.length ? h('div', { class: 'u-ward-grid' }, cells) : h('p', { class: 'rn-empty' }, 'Nothing bought to wear yet.'),
      library ? h('p', { class: 'rn-note u-ward-more' }, 'Everything there is to wear, and where it is sold today: ', h('button', { type: 'button', class: 'u-btn is-quiet', onclick: () => library() }, icon('library'), 'Library', h('kbd', { class: 'u-key' }, 'L'))) : null),
  ];
}

/**
 * WHAT YOU BOUGHT (goods-1): the things to wear, each with the piece the figure wears for it (or none: listed only),
 * on or off, and at the crib Put on / Take off (no hour); the things for the trailer, where each stands in it.
 */
function boughtEl({ cfg, v, choosing, go }) {
  const owned = v.things?.owned ?? [];
  // (lib-1: the named things, then what you own of the library: never the whole library, which is view.library's)
  const lib = kind => owned.filter(o => o.library && o.kind === kind).map(o => [o.item, { ...o, at: null, library: true }]);
  const wear = [...Object.entries(cfg.things ?? {}).filter(([, t]) => t.kind === 'wear' && !(t.at && cfg.places[t.at]?.locked)), ...lib('wear')];
  const home = [...Object.entries(cfg.things ?? {}).filter(([, t]) => t.kind === 'home' && !(t.at && cfg.places[t.at]?.locked)), ...lib('home')];
  const ownedOf = item => owned.find(o => o.item === item);
  const switchOf = item => (v.moves ?? []).find(m => (m.choice.do === 'wear' || m.choice.do === 'unwear') && m.choice.item === item);
  const sold = t => (v.errands ?? []).find(e => e.item === t);
  return [
    sec(`Bought to wear · ${wear.filter(([k]) => ownedOf(k)).length} of ${wear.length}`,
      h('p', { class: 'rn-note' }, `${v.things?.text ?? ''} Bought from ${cap(sold(wear[0]?.[0])?.keeper?.name ?? 'the rail')} ${cfg.places[wear[0]?.[1].at]?.where ?? ''}; put on and taken off at the crib for nothing. Looks only: no number changes.`),
      h('ul', { class: 'rn-stuff' }, wear.map(([item, t]) => {
        const o = ownedOf(item);
        const m = switchOf(item);
        const act = o && m && choosing ? h('button', { type: 'button', class: 'k-btn rn-buy', onclick: () => go?.(m.key) }, o.worn ? 'Take off' : 'Put on') : null;
        return h('li', { class: `rn-thing${o ? ' is-owned' : ''}` },
          h('div', { class: 'rn-job-head' }, h('b', null, cap(thingWord(t.label))), h('span', { class: 'rn-pay' }, o ? (o.worn ? 'on' : 'owned') : money(t.price))),
          h('p', { class: 'rn-thing-does' }, `${cap(t.desc)}.`),
          h('div', { class: 'rn-job-odds' }, h('span', { class: 'hk-tag' }, t.slot), o ? (o.worn ? h('span', { class: 'hk-tag is-yours' }, 'wearing it') : h('span', { class: 'hk-tag' }, 'at the crib')) : h('span', { class: 'rn-gap' }, `not yours · ${cfg.places[t.at]?.label ?? ''}`), act));
      }))),
    sec(`In the trailer · ${home.filter(([k]) => ownedOf(k)).length} of ${home.length}`,
      h('ul', { class: 'rn-stuff' }, home.map(([item, t]) => {
        const o = ownedOf(item);
        const where = trailerWhere(item) ?? (t.library || (o && !t.defends) ? 'wherever you put it (Arrange)' : null);
        return h('li', { class: `rn-thing${o ? ' is-owned' : ''}` },
          h('div', { class: 'rn-job-head' }, h('b', null, cap(thingWord(t.label))), h('span', { class: 'rn-pay' }, o ? 'owned' : money(t.price))),
          h('p', { class: 'rn-thing-does' }, `${cap(t.desc)}.${t.defends ? ` ${t.does}.` : ''} ${where ? `In the crib ${where}${o ? '' : ', once bought'}.` : t.inTrailer === 'door' ? 'On the trailer\'s door.' : ''}`.trim()),
          h('div', { class: 'rn-job-odds' }, o ? h('span', { class: 'hk-tag is-yours' }, 'in the trailer') : h('span', { class: 'rn-gap' }, `not yours · ${cfg.places[t.at]?.label ?? ''}`)));
      }))),
  ];
}

/**
 * The people tab: everybody at the two places, their role, today's mood, whether they are out for the day, and
 * (trust-1) their trust in you: the band's mark, the number as a meter, the days they won't deal with you. The place
 * you are in comes first, with who is about there this hour (only someone about can see what you do) and the view's
 * own sentence of who would tell.
 */
export function characterPeople({ cfg, v }) {
  const T = cfg.trust;
  const at = v.trustHere?.place ?? (v.trust ?? []).find(t => t.here)?.place ?? null;
  const order = PLACE_ORDER.slice().sort((a, b) => Number(b === at) - Number(a === at));
  const pay = Math.round(T.withPay * (tierOf(cfg, 'park')?.pay ?? 1));
  const payMarket = Math.round(T.withPay * (tierOf(cfg, 'market')?.pay ?? 1));
  return [
    ...order.map(place => {
      const all = v.people.filter(p => p.place === place);
      const trust = new Map((v.trust ?? []).filter(t => t.place === place).map(t => [t.id, t]));
      const here = place === at;
      const left = all.filter(p => !p.outToday).length;
      // (where you are, first: the chance a crime or the bins is told on this hour, as the odds are shown; the view's
      // own sentence of it in the tooltip)
      const th = here ? v.trustHere : null;
      const told = th ? tellEl({ ...th.tellRisk, text: th.text }) : null;
      return sec(`${placeName(cfg, place)}${here ? ' · you are here' : ''}`,
        th ? h('p', { class: `rn-note rn-told-here${told ? ' is-risk' : ''}`, title: th.text }, told ? [h('span', null, 'A crime or the bins here this hour: '), told] : 'Nobody here against you is about: nothing you do here is called in this hour.') : null,
        h('ul', { class: 'rn-people' }, all.map(p => {
          const t = trust.get(p.id);
          const band = t?.band ?? 'neutral';
          return h('li', { class: `${p.outToday ? 'is-out' : ''}${p.regular ? ' is-regular' : ''} is-${band}` },
            h('b', null, cap(p.name)),
            h('span', { class: 'rn-role' }, ROLE[p.role] ?? p.role),
            moodEl(cfg, p.mood),
            p.outToday ? h('span', { class: 'hk-tag is-why' }, 'out today') : null,
            // (their trust, under the row: the band, the meter, about now or not where you are, the days off your table)
            t ? h('div', { class: 'rn-trust-line', title: trustTitle(t) },
              trustMark(t, { quiet: false }), trustMeter(cfg, t.trust),
              here ? h('span', { class: `rn-about${t.around ? ' is-on' : ''}` }, t.around ? 'about now' : 'not about') : null,
              t.offDays ? h('span', { class: 'rn-off' }, t.offText) : null) : null,
            // (a regular: how hooked, in words, under the row)
            p.regular ? h('p', { class: `rn-hooked-line${p.regular.hooked ? ' is-hooked' : ''}` }, hookedText(cfg, p.regular)) : null);
        })),
        h('p', { class: 'rn-note' }, `${plural(left, 'person', 'people')} left to work today of ${all.length}. Whoever you work (not the safe job) is out for the rest of the day; everyone is calm again in the morning.`));
    }),
    h('p', { class: 'rn-note rn-trust-key' }, 'Trust runs ', h('b', null, `${signedT(T.min)} to ${signedT(T.max)}`), ', lasts across nights and drifts back to 0; each place\'s people are its own. ',
      trustMark({ band: 'against', trust: T.against, bandText: T.bands.against }), ` at ${signedT(T.against)} or less: won't deal with you; about at their place, ${T.tellPct}% each to call in a crime or the bins there (heat +${T.tellHeat}). `,
      trustMark({ band: 'with', trust: T.with, bandText: T.bands.with }), ` at ${signedT(T.with)} or more: they look away, and a job with them pays ${money(pay)} more (${money(payMarket)} at the market).`),
  ];
}

/** The dock's key for a rules' choice (ui-3, leg 2: 1 to 3 or a verb's letter), or nothing when it is not on the dock. */
function dockKbd(ctx, key) {
  const k = ctx.keyFor?.(key) ?? null;
  return k ? kbd(k) : null;
}

// ── EVERY MOVE THAT EXISTS ─────────────────────────────────────────────────────────────────────────────────────────
/** One job as the panel lists it: pay, odds, what failing costs, who it is done to, what it needs, and whether it is on the table. */
function jobEl(cfg, v, state, place, id, job, keyFor = null) {
  const dealt = v.place === place ? v.options.find(o => o.id === id) : null;
  const people = v.people.filter(p => p.place === place && p.role === job.role);
  const left = people.filter(p => !p.outToday);
  const needs = job.needs ? cfg.shop[job.needs] : null;
  const able = !job.needs || state.owned[job.needs];
  const now = jobOdds(cfg, state, job);
  const fails = [job.failHeat ? `heat ${signed(job.failHeat)}` : null, job.failEnergy ? `energy ${signed(-job.failEnergy)}` : null].filter(Boolean);
  const tags = [];
  if (dealt) tags.push(h('span', { class: 'rn-ontable' }, 'on the table', dockKbd({ keyFor }, dealt.key)));
  else if (!able) tags.push(h('span', { class: 'hk-tag is-why' }, `needs ${needs.label.replace(/^an? /i, 'the ').toLowerCase()}`));
  else if (!job.safe && !left.length) tags.push(h('span', { class: 'hk-tag' }, 'nobody left today'));
  else if (v.place === place) tags.push(h('span', { class: 'hk-tag' }, 'not dealt this hour'));
  const better = [];
  if (needs) better.push(`Possible only with ${needs.label.toLowerCase()} (${money(needs.price)}${state.owned[job.needs] ? ', yours' : ''}).`);
  if (!job.safe) better.push(`Tired (energy ${cfg.energy.tiredAt} or less): ${Math.max(0, job.odds - cfg.energy.tiredOdds)}%.${now.why.length ? ' You are tired now.' : ''}`);
  // (trust-1: how it moves its person's trust, and who here would tell on it; with you, a job with them pays more)
  const tw = job.trust ?? {};
  const moves = [tw.win ? `works ${signedT(tw.win)}` : job.safe ? null : 'works 0', job.safe ? null : `fails ${signedT(tw.fail ?? 0)}`].filter(Boolean);
  if (moves.length) better.push(`Their trust: ${moves.join(', ')}.`);
  const trustBy = new Map((v.trust ?? []).map(t => [t.id, t]));
  const tell = dealt?.tellRisk ?? null;
  const friend = dealt?.withPay ? h('span', { class: 'rn-trust is-with', title: `${cap(dealt.who?.name ?? '')} is with you: the pay above includes it` }, h('i', { 'aria-hidden': 'true' }, GLYPH.with), 'with you', h('b', null, `+${money(dealt.withPay)}`)) : null;
  return h('li', { class: `rn-job${dealt ? ' is-dealt' : ''}${able ? '' : ' is-locked'}${job.safe ? ' is-safe' : ''}` },
    h('div', { class: 'rn-job-head' }, h('b', null, job.label), h('span', { class: 'rn-pay' }, range(job.pay))),
    h('div', { class: 'rn-job-odds' },
      job.safe ? h('span', { class: 'hk-tag is-yours' }, 'sure') : h('span', { class: 'hk-mini' }, barEl([{ key: 'clean', pct: job.odds, label: 'works' }, { key: 'disaster', pct: 100 - job.odds, label: 'fails' }], { small: true }), h('b', null, `${job.odds}%`)),
      job.safe ? h('span', null, 'always dealt, never fails') : h('span', null, `fails: ${fails.length ? fails.join(', ') : 'nothing lost'}`),
      job.winHeat ? h('span', { class: 'hk-tag is-down' }, `heat ${signed(job.winHeat)} even when it works`) : null,
      tellEl(tell), friend,
      ...tags),
    h('p', { class: 'rn-job-who' }, h('span', null, `Done ${job.safe ? 'with' : 'to'}: `),
      people.length ? people.map((p, i) => h('span', { class: `rn-who-name${p.outToday ? ' is-out' : ''}` }, i ? ', ' : '', cap(p.name), p.mood !== 'calm' ? h('em', { class: `rn-mood is-${p.mood}` }, cfg.moods[p.mood].replace(/^is /, '')) : null, trustMark(trustBy.get(p.id), { short: true }))) : 'nobody'),
    better.length ? h('p', { class: 'rn-job-better' }, better.join(' ')) : null);
}

/**
 * THE STREET AT A PLACE (rules-2): robbing somebody passing, the bins, what its shop sells, sleeping rough, each with
 * its numbers (the rules' own: robOdds, binsFinds, the tier), and what the place has left of each today. Where you
 * stand, each says whether it can be done now, with its key; a click picks it on the bar.
 */
function streetEl(ctx, place) {
  const { cfg, v, state } = ctx;
  const p = placeOf(cfg, place);
  const pv = (v.places ?? []).find(q => q.place === place);
  const sup = pv?.supply ?? {};
  const at = v.place === place;
  const choiceOf = what => (at ? v.choices.filter(c => c.choice.do === what).sort((a, b) => Number(b.available) - Number(a.available))[0] ?? null : null);
  const tag = (c, letter) => (!c ? null : c.available
    ? h('button', { type: 'button', class: 'rn-ontable', title: 'Pick it on the dock', onclick: () => ctx.pick?.(c.key) }, 'now', dockKbd(ctx, c.key))
    : h('span', { class: 'hk-tag is-why' }, c.why));
  const left = (s, what) => (s ? h('span', { class: `rn-supply${s.left ? '' : ' is-none'}` }, `${s.left} of ${s.max} ${what} left today (+${s.refill} a morning)`) : null);
  const row = (name, pay, text, more, now) => h('li', { class: `rn-job rn-street${now?.tagName === 'BUTTON' ? ' is-dealt' : ''}` },
    h('div', { class: 'rn-job-head' }, h('b', null, name), pay ? h('span', { class: 'rn-pay' }, pay) : null),
    h('p', { class: 'rn-job-better' }, text),
    h('div', { class: 'rn-job-odds' }, more, now));
  const out = [];
  // (trust-1: where you stand, who here would tell on a robbery or the bins this hour, as the odds are shown)
  const T = cfg.trust;
  const tell = at ? tellEl(choiceOf('rob')?.tellRisk ?? choiceOf('bins')?.tellRisk ?? v.trustHere?.tellRisk) : null;
  const tellWords = `Anyone here against you who is about has ${T.tellPct}% to see it and call it in (heat +${T.tellHeat} on ${p.label})${at ? (tell ? '' : ': nobody this hour') : ''}.`;
  if (sup.strangers) {
    const o = robOdds(cfg, state, place);
    const needs = cfg.street.rob.needs;
    out.push(row('Rob somebody passing', `${o.pct}% · ${range(o.pay)}`,
      `An hour and ${cfg.energy.perHour} energy. It works: heat +${o.winHeat} on ${p.label}. It fails: heat +${o.failHeat} there, and they get away shouting. Nobody knows it was you; the place does: ${cfg.street.rob.perHeat} off the odds for each heat it has${o.why.length ? ` (now ${o.why.join(', ')})` : ''}. ${tellWords} Needs ${cfg.shop[needs].label.replace(/^an? /i, 'the ').toLowerCase()}${state.owned[needs] ? ' (yours)' : ''}.`,
      [left(sup.strangers, 'worth robbing'), tell], tag(choiceOf('rob'), 'R')));
  }
  if (sup.bins) {
    const finds = binsFinds(cfg, place);
    const seen = p.binsSeen;
    out.push(row('Dig through the bins', range([0, finds[finds.length - 1].pay[1]]),
      `An hour and ${cfg.energy.perHour} energy: ${finds.map(f => (f.pay[1] ? `${f.pct}% ${range(f.pay)}` : `${f.pct}% nothing`)).join(', ')}.${seen ? ` ${seen.pct}% a ${seen.role} sees you: one with you looks away; anyone else ${cfg.moods[seen.mood]} (trust ${signedT(T.seenBins)}, and they skip their turn at the safe job today).` : ' Nobody here minds.'} ${tellWords}`,
      [left(sup.bins, 'bins'), tell?.cloneNode(true) ?? null], tag(choiceOf('bins'), 'B')));
  }
  for (const it of p.shop ?? []) {
    const c = at ? v.choices.find(x => x.choice.do === 'shop' && x.choice.item === it.item) : null;
    const sold = at ? v.shopHere.find(s => s.item === it.item) : null;
    out.push(row(it.label, money(it.price), `${it.does}. Paid from what you carry; no hour.${it.perDay ? ` ${it.perDay} a day.` : ''} B, the shop, sells it here; the Stuff panel (O) lists everything.`,
      sold?.left !== null && sold?.left !== undefined ? h('span', { class: `rn-supply${sold.left ? '' : ' is-none'}` }, `${sold.left} of ${it.perDay} left today`) : null, tag(c, 'E')));
  }
  // (goods-1: the place's connect, P on the bar, and its things, K: as its shop, all of it in the Stuff panel too)
  const conn = (v.connects ?? []).find(c => c.place === place);
  if (conn) {
    const c = at ? v.choices.find(x => x.choice.do === 'pack') ?? null : null;
    out.push(row(`${cap(packWord(cfg, conn.good))} of ${goodWord(cfg, conn.good)} from ${cap(conn.who.name)}`, money(conn.price),
      `${conn.sales} sales of ${conn.label}: a selling job needs them. Paid from what you carry; no hour; at most ${conn.perDay} a day.${conn.off ? ` With you: ${money(conn.off)} off.` : ''}${conn.sells ? '' : ` ${conn.why}.`} B, the shop, sells it here; the Stuff panel (O) lists everything.`,
      conn.left !== null ? h('span', { class: `rn-supply${conn.left ? '' : ' is-none'}` }, `${conn.left} of ${conn.perDay} left today`) : null, tag(c, 'P')));
  }
  const things = (v.errands ?? []).filter(e => e.place === place && e.kind !== 'food');
  if (things.length) {
    const c = at ? v.choices.find(x => x.choice.do === 'get' && x.available) ?? null : null;
    const prices = things.map(t => t.price);
    out.push(row(`${things[0].keeper ? `${cap(things[0].keeper.name)}: ` : ''}things ${things[0].kind === 'home' ? 'for the trailer' : 'to wear'}`, range([Math.min(...prices), Math.max(...prices)]),
      `${things.map(t => `${thingWord(t.label)} ${money(t.price)}${t.owned ? ' (yours)' : ''}`).join(', ')}. Looks only. Paid from what you carry; no hour. B, the shop, sells them.`,
      null, tag(c, 'K')));
  }
  if (!p.door && p.tier) {
    const tier = tierOf(cfg, place);
    out.push(row('Sleep rough', `${tier.roughPct}% robbed`,
      `The day ends here, on the street. ${tier.roughPct}% they rob you in your sleep (asleep, they are ${cfg.rough.strength} stronger; the box cutter and the pocket help as ever); no clinic. You wake here at noon with energy ${Math.max(cfg.energy.minMorning, fullEnergy(cfg, state) - cfg.energy.roughMorning)}, still carrying what is left, your own heat not cooled. Out of energy away from home, it is this or a drink.`,
      null, tag(choiceOf('rough'), 'Z')));
  }
  if (sup.custom) {
    const reg = (v.people ?? []).filter(q => q.place === place && q.regular);
    out.push(h('li', { class: 'rn-job rn-street is-note' }, h('div', { class: 'rn-job-odds' },
      left(sup.custom, `sales to ${reg.map(q => cap(q.name)).join(', ') || 'a regular'}`), ...reg.map(q => h('span', { class: `rn-hooked${q.regular.hooked ? ' is-hooked' : ''}` }, hookedShort(cfg, q.regular))))));
  }
  return out.length ? h('div', { class: 'rn-street-sec' }, h('p', { class: 'rn-sub-h' }, `On the street${pv ? ` · heat ${pv.heat}${pv.police ? ', police about' : ''}` : ''}`), h('ul', { class: 'rn-jobs' }, out)) : null;
}

/** Every job by place (the corner locked), then the moves that are not jobs. */
export function movesBody(ctx) {
  const { cfg, v, state } = ctx;
  const s = cfg.subway;
  const e = cfg.energy;
  const choiceKey = test => v.choices.find(c => test(c.choice));
  const now = c => (c ? (c.available ? h('span', { class: 'rn-ontable' }, 'now', dockKbd(ctx, c.key)) : h('span', { class: 'hk-tag is-why' }, c.why)) : null);
  const move = (name, what, c, extra = null) => h('li', { class: `rn-job rn-way${c?.available ? ' is-dealt' : ''}` },
    h('div', { class: 'rn-job-head' }, h('b', null, name), extra ? h('span', { class: 'rn-pay' }, extra) : null),
    h('div', { class: 'rn-job-odds' }, h('span', null, what), now(c)));
  const jobsAt = place => Object.entries(cfg.jobs[place]);
  const count = PLACE_ORDER.reduce((n, p) => n + jobsAt(p).length, 0);
  return [
    h('p', { class: 'rn-lede' }, `${count} jobs at two places, a third place locked, and ${v.place === 'park' || v.place === 'market' ? `${v.options.length} dealt this hour` : v.route ? `${v.hand.length} card${v.hand.length === 1 ? '' : 's'} dealt at ${v.placeLabel}` : 'none dealt where you are'}. Each hour a place deals its safe job and two of the rest that still have somebody to do them to. Every job costs an hour and ${e.perHour} energy.`),
    // (routes-1: on a way, the way first: where you are and the hand)
    ...(v.route ? (v.routes ?? []).filter(r => r.id === v.route.id).map(r => routeEl(ctx, r)) : []),
    ...PLACE_ORDER.map(place => sec(`${placeName(cfg, place)}${v.place === place || (place === 'park' && v.place === 'crib') ? ' · you are here' : ''}`,
      place === 'market' ? h('p', { class: 'rn-note is-risk' }, `Pays about twice the park, and people will take it off you: every hour there can go wrong (now ${dangerAt(cfg, { ...state, place: 'market', hoursThere: state.place === 'market' ? state.hoursThere : 0 }).jump.chance}% jumped for a ${state.place === 'market' ? 'this' : 'first'} hour, more each hour and each $${cfg.jump.perDollars} on you; police from heat ${cfg.police.from}).`) : h('p', { class: 'rn-note' }, 'Safe and poor: nobody jumps you here. The police come only once the place itself is hot.'),
      (v.places ?? []).find(q => q.place === place) ? h('p', { class: `rn-note${(v.places ?? []).find(q => q.place === place).hot ? ' is-risk' : ''}` }, (v.places ?? []).find(q => q.place === place).text) : null,
      h('ul', { class: 'rn-jobs' }, jobsAt(place).map(([id, job]) => jobEl(cfg, v, state, place, id, job, ctx.keyFor))),
      streetEl(ctx, place))),
    // (routes-1: the ways on foot and on the board, their stops and the cards each can deal)
    ...(v.routes ?? []).filter(r => r.id !== v.route?.id).map(r => routeEl(ctx, r)),
    // (a regular at your door, or one who may come: the morning's two answers)
    doorEl(ctx),
    sec(`${placeName(cfg, 'corner')} · locked`,
      h('ul', { class: 'rn-jobs' }, h('li', { class: 'rn-job is-locked' },
        h('div', { class: 'rn-job-head' }, h('b', null, `${cap(cfg.places.corner.label)}: ${cfg.places.corner.locked}`)),
        h('p', { class: 'rn-job-better' }, 'On the subway map, and the next place. Nothing can be done there yet.')))),
    sec('Getting about, home and the night',
      h('ul', { class: 'rn-jobs' },
        move('Step out', `From the crib to the trailer park. No hour. Take any of your banked money with you (none unless you say). Needs ${e.perHour} energy.`, choiceKey(c => c.do === 'out')),
        move('Go inside', 'From the trailer park into the crib. No hour. Everything you carry is banked: safe. H picks it.', choiceKey(c => c.do === 'inside')),
        move('Subway to the flea market', `One hour and ${e.perHour} energy, ${money(s.fare)} fare from what you carry. You need energy ${e.rideBack + e.perHour} to get there and back.`, choiceKey(c => c.do === 'subway' && c.to === 'market' && !c.hop), money(s.fare)),
        move('Hop it', `The subway without the fare: free, ${s.hopCaughtPct}% you are seen (heat +${s.hopHeat}), and you still ride. Carrying under ${money(s.fare)}, it is the only way.`, choiceKey(c => c.do === 'subway' && c.hop), 'free'),
        move('Head home', `From the market, ${money(s.fare)} or hop it. The hour you leave is still an hour there: it can still go wrong. Home, what you carry is banked. H picks it.`, choiceKey(c => c.do === 'subway' && c.to === 'park' && !c.hop), money(s.fare)),
        move('Sleep', `At the crib. The day ends: energy back to ${state.owned.bed ? e.bed : e.mattress}, heat −${cfg.heat.nightDrop}, everyone calm again.`, choiceKey(c => c.do === 'sleep')),
        move('Buy', 'At the crib, from banked money: B, the shop at home, sells the three; the Stuff panel (O) lists it all.', v.choices.find(c => c.choice.do === 'buy' && c.available) ?? null),
        move('Morning', `Out of the clinic or the jail and home. The day after the clinic starts ${e.clinicMorning} energy lower, after jail ${e.jailMorning}.`, choiceKey(c => c.do === 'morning')))),
  ];
}

/**
 * A WAY ON FOOT (routes-1, RUN.md "Routes"): its two directions on foot and on the board (what each costs, whether the
 * board is yours), its stops with the cards each can deal (odds, pay, what failing costs), and, on it, where you are
 * and the hand. Each move tagged `now` with its key where it can be made; read-only, the bar makes them.
 */
function routeEl(ctx, r) {
  const { cfg, v } = ctx;
  const now = c => (c ? (c.available ? h('span', { class: 'rn-ontable' }, 'now', dockKbd(ctx, c.key)) : h('span', { class: 'hk-tag is-why' }, c.why)) : null);
  const row = (name, pay, text, more, c) => h('li', { class: `rn-job rn-way${c?.available ? ' is-dealt' : ''}` },
    h('div', { class: 'rn-job-head' }, h('b', null, name), pay ? h('span', { class: 'rn-pay' }, pay) : null),
    text ? h('p', { class: 'rn-job-better' }, text) : null,
    h('div', { class: 'rn-job-odds' }, more, now(c)));
  const [a, b] = r.between;
  const by = r.stops.map(st => st.label).join(', then ');
  const ways = r.ways.map(w => {
    const there = v.choices.find(c => c.kind === 'move' && c.what === 'route' && c.choice.do === w.choice.do) ?? null;
    const d = there?.danger;
    return row(`${w.label}: ${cfg.places[a].label} ⇄ ${cfg.places[b].label}`, w.energy ? `energy ${w.energy}` : 'no energy',
      `No fare. ${w.hours} hour${w.hours > 1 ? 's' : ''} by ${by}, ${w.label === 'Walk' ? "an hour to the stop and an hour on from it, on the stop's own ground, where its danger rolls" : 'an hour to the stop and on from it in no time: nobody catches you between the stops'}. You need ${cfg.energy.perHour} energy to set out, ${cfg.energy.rideBack + cfg.energy.perHour} going out from home.${w.needs ? ` Needs ${cfg.things[w.needs].label} (${w.owned ? 'yours' : `$${cfg.things[w.needs].price} at ${cfg.places[cfg.things[w.needs].at].label}`}).` : ''}`,
      d ? h('span', { class: d.jump.chance ? 'is-risk' : '' }, d.text) : null, there);
  });
  const stops = r.stops.map(st => {
    const at = v.route && v.place === st.stop;
    const dealt = new Map((at ? v.hand : []).map(c => [c.id, c]));
    return h('li', { class: `rn-job rn-way${at ? ' is-dealt' : ''}` },
      h('div', { class: 'rn-job-head' }, h('b', null, `${cap(st.label)}${at ? ' · you are here' : ''}`), h('span', { class: 'rn-pay' }, `heat ${st.heat}`)),
      h('p', { class: 'rn-job-better' }, `A stop on the way: it deals ${st.hand} of these each time you come by, each an hour and ${cfg.energy.perHour} energy like a job, each once a day; play one or go on. A quarter of the market's jumping, the police only once it is hot. Nobody here is a person of the game: no trust, nobody to tell on you.`),
      h('ul', { class: 'rn-jobs rn-cards' }, st.cards.map(c => {
        const d = dealt.get(c.id);
        const pay = c.finds ? money(0) + '–' + money(c.finds[c.finds.length - 1].pay[1]) : range(c.pay);
        return h('li', { class: `rn-job${d ? ' is-dealt' : ''}` },
          h('div', { class: 'rn-job-head' }, h('b', null, c.label), h('span', { class: 'rn-pay' }, pay)),
          h('div', { class: 'rn-job-odds' },
            h('span', null, c.finds ? c.finds.map(f => (f.pay[1] ? `${f.pct}% ${range(f.pay)}` : `${f.pct}% nothing`)).join(', ') : `${c.odds}%${c.failHeat ? `; fails: heat +${c.failHeat}` : ''}${c.goodsPay ? '; needs a smoke on you' : ''}`),
            d ? now(v.choices.find(x => x.key === d.key)) : null));
      })));
  });
  const on = v.route?.id === r.id ? v.choices.find(c => c.kind === 'move' && c.what === 'onward') : null;
  return sec(`${cap(r.label)}${v.route?.id === r.id ? ' · you are on it' : r.fromHere ? ' · from here' : ''}`,
    v.route?.id === r.id ? h('p', { class: 'rn-note' }, v.route.text) : null,
    h('ul', { class: 'rn-jobs' }, ...ways, ...stops,
      on ? row(on.label.replace(/ \(pass these by\)$/, ''), on.hours ? `${on.hours}h` : 'no hour', null, on.danger ? h('span', { class: on.danger.jump.chance ? 'is-risk' : '' }, on.danger.text) : null, on) : null));
}

/** The door: a regular there now (give, 1; shut the door, 2), or how one comes to be there. */
function doorEl(ctx) {
  const { cfg, v } = ctx;
  const R = cfg.regulars;
  const give = v.door ? v.choices.find(c => c.choice.do === 'give') : null;
  const shut = v.door ? v.choices.find(c => c.choice.do === 'refuse') : null;
  const tag = (c, letter) => (!c ? null : c.available
    ? h('button', { type: 'button', class: 'rn-ontable', title: 'Pick it on the dock', onclick: () => ctx.pick?.(c.key) }, 'now', dockKbd(ctx, c.key))
    : h('span', { class: 'hk-tag is-why' }, c.why));
  return sec(`At your door${v.door ? ' · now' : ''}`,
    v.door ? h('p', { class: 'rn-note is-risk' }, v.door.text) : h('p', { class: 'rn-note' }, `A regular you have sold to ${R.doorAt} times or more may be at your door in a morning (${R.doorPct}%, +${R.perSale} for each sale past ${R.doorAt}, at most ${R.capPct}%), wanting $${R.wants[0]}–${R.wants[1]} and $${R.wantsUp} more for each sale past ${R.doorAt}.`),
    h('ul', { class: 'rn-jobs' },
      h('li', { class: `rn-job rn-street${give?.available ? ' is-dealt' : ''}` }, h('div', { class: 'rn-job-head' }, h('b', null, 'Give them what they ask'), v.door ? h('span', { class: 'rn-pay' }, money(v.door.wants)) : null),
        h('p', { class: 'rn-job-better' }, `From banked. They go, friendly; their count drops by ${R.giveEases}, and they will be back.`), h('div', { class: 'rn-job-odds' }, tag(give, 'G'))),
      h('li', { class: `rn-job rn-street${shut?.available ? ' is-dealt' : ''}` }, h('div', { class: 'rn-job-head' }, h('b', null, 'Shut the door on them')),
        h('p', { class: 'rn-job-better' }, `${R.fightPct}% they swing at you (their strength ${R.strength}, less the box cutter): their clean win costs you ${R.hurt.clean} energy today, a messy one ${R.hurt.messy}. Their trust ${signedT(cfg.trust.refuse)}: from neutral that is against you, so otherwise a grudge: no sales to them for ${plural(R.grudgeDays, 'day')}, and the police come round where they live (heat +${R.grudgeHeat} there). One who was with you at ${signedT(cfg.trust.max)} only goes off sore: no grudge, no police. Giving: trust ${signedT(cfg.trust.give)}. Stepping out or sleeping past them shuts it too.`),
        h('div', { class: 'rn-job-odds' }, tag(shut, 'X')))));
}

// ── THE STUFF ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** Everything that can be bought: price, what it does, owned or not, and how far banked money is from it. A list that holds many. */
export function stuffBody(ctx) {
  const { cfg, v } = ctx;
  const rows = v.shop.slice().sort((a, b) => Number(a.owned) - Number(b.owned) || a.price - b.price);
  const owned = rows.filter(s => s.owned).length;
  return [
    hereEl(ctx),
    defencesEl(ctx),
    h('p', { class: 'rn-lede' }, `${owned} of ${rows.length} owned. Bought at ${cfg.places.crib.label} from banked money, on the move card there; never lost.`),
    h('ul', { class: 'rn-stuff' }, rows.map(s => {
      const gap = s.price - v.banked;
      const status = s.owned ? h('span', { class: 'hk-tag is-yours' }, 'owned')
        : gap > 0 ? h('span', { class: 'rn-gap' }, `${money(gap)} to go`, h('em', null, ` · ${money(v.banked)} banked${v.carried ? `, ${money(v.carried)} carried` : ''}`))
          : v.place === 'crib' && s.key ? h('span', { class: 'rn-ontable' }, 'buy it now', dockKbd(ctx, s.key)) : h('span', { class: 'rn-gap is-go' }, 'banked enough: buy it at the crib');
      const bar = s.owned ? null : h('div', { class: 'rn-goal-bar' }, h('i', { class: 'is-banked', style: `width:${Math.min(100, (v.banked / s.price) * 100)}%` }),
        h('i', { class: 'is-carried', style: `width:${Math.max(0, Math.min(100 - (v.banked / s.price) * 100, (v.carried / s.price) * 100))}%` }));
      return h('li', { class: `rn-thing${s.owned ? ' is-owned' : ''}` },
        h('div', { class: 'rn-job-head' }, h('b', null, s.label), h('span', { class: 'rn-pay' }, money(s.price))),
        h('p', { class: 'rn-thing-does' }, s.does),
        h('div', { class: 'rn-job-odds' }, status), bar);
    })),
    h('p', { class: 'rn-note' }, 'More to come. These three are bought on the crib\'s card.'),
  ];
}

/**
 * WHAT DEFENDS YOUR CRIB (home-1, RUN.md "Home pressure"): the deadbolt and the floor safe, each with what it does,
 * owned or where and from whom it is sold (Buy where you stand, its key on the bar), and Cousin Earl on your step (save-1:
 * by the stretch, his price for his days paid up front, the days he has left, keeping him on from his last day) and his
 * move at the crib; then how an attempt would go now. All the view's (`home`): none of it typed here.
 */
function defencesEl(ctx) {
  const { v } = ctx;
  const d = v.home?.defences;
  if (!d) return null;
  const o = v.home.odds;
  const g = d.guard;
  const tag = (key, label, ok, why, go = true) => (ok && ctx.choosing && key
    ? h('button', { type: 'button', class: 'k-btn rn-buy', onclick: () => (go ? ctx.go : ctx.pick)?.(key) }, label, dockKbd(ctx, key))
    : h('span', { class: 'hk-tag is-why' }, why ?? 'not now'));
  const rows = d.things.map(t => h('li', { class: `rn-thing${t.owned ? ' is-owned' : ''}` },
    h('div', { class: 'rn-job-head' }, h('b', null, cap(thingWord(t.label))), h('span', { class: 'rn-pay' }, t.owned ? 'yours' : money(t.price))),
    h('p', { class: 'rn-thing-does' }, `${t.does}: ${t.defends.pct != null ? `with nobody home and nobody on your step they get in ${t.defends.pct}% of the time, not ${o.away.basePct}%` : `in, they take ${t.defends.share}% of what is banked, not ${o.away.baseShare}%`}. ${t.owned ? (trailerWhere(t.item) ? `In the crib ${trailerWhere(t.item)}.` : t.inTrailer === 'door' ? 'On the trailer\'s door.' : '') : `${cap(t.keeper?.name ?? 'Sold')} sells it ${t.atLabel ? `at ${t.atLabel}` : ''}, from what you carry.`}`),
    h('div', { class: 'rn-job-odds' }, t.owned ? h('span', { class: 'hk-tag is-yours' }, 'yours') : tag(t.key, `Buy ${money(t.price)}`, t.available, t.why))));
  if (g) rows.push(h('li', { class: `rn-thing${g.on ? ' is-owned' : ''}` },
    h('div', { class: 'rn-job-head' }, h('b', null, `${cap(g.who.name)} on your step`), h('span', { class: 'rn-pay' }, `${money(g.price)} for ${g.days} days`)),
    h('p', { class: 'rn-thing-does' }, `${cap(g.label ?? 'He watches your door')}: whoever tries your door has to get past him first (${g.beatenPct}% they beat him; beaten, he is hurt and off for days, the rest of his days are lost, and the door decides it). Hired at the crib for ${g.days} days, the day you hire him and the ${g.days - 1} after, ${money(g.price)} from banked up front, no refund. On his last day the same move keeps him ${g.days} more days. He is the man who sells cartons from his truck.`),
    h('div', { class: 'rn-job-odds' },
      g.on ? h('span', { class: 'hk-tag is-yours' }, g.lastDay ? 'his last day' : `on through day ${g.until} · ${g.daysLeft} days left`) : null,
      // (off: the hire; on his last day: keeping him on; any other day he is on, nothing to press)
      g.on && !g.lastDay ? null : g.choice ? tag(g.key, g.on ? `Keep him ${g.days} more days, ${money(g.price)}` : `Hire him, ${money(g.price)}`, g.moveAvailable, g.moveWhy) : h('span', { class: 'hk-tag is-why' }, g.why ?? g.moveWhy ?? 'at the crib'))));
  return h('section', { class: 'rn-sec rn-defences' },
    h('h3', { class: 'rn-sec-h' }, `Defending your crib · ${d.things.filter(t => t.owned).length + (g?.on ? 1 : 0)} of ${d.things.length + (g ? 1 : 0)}`),
    h('ul', { class: 'rn-stuff' }, rows),
    h('p', { class: 'rn-note' }, `If they tried it now (${money(o.stake.takes)} of ${money(o.stake.banked)} banked): with you out, ${o.away.guard ? `${100 - o.away.guard.beatenPct}% ${cap(g?.who?.name ?? 'your guard')} sees them off, else ` : ''}${o.away.pct}% they get in; home, you meet them at the door. Pressure at home ${v.pressure?.value ?? 0} of ${v.pressure?.max ?? 10}: L shows it.`));
}

/**
 * THE PLACE'S SHOPS (goods-1), where you stand: the connect's pack (its price for you, what it is good for and where
 * it sells, how many more today, the trust tag and the with-you price, and why not when they will not sell), the
 * food (price, energy, how many left today) and the things (price, owned). Buy is one click (or B, the dock's
 * shop, and Enter). Then your goods, on you and at home; and what is sold elsewhere, and by whom.
 * All of it the view's (`connects`, `errands`, `goods`): a new place's shop shows with no new code.
 */
function hereEl(ctx) {
  const { cfg, v } = ctx;
  const here = (v.errands ?? []).filter(e => e.here);
  const conn = (v.connects ?? []).find(c => c.here) ?? null;
  const away = [...(v.connects ?? []).filter(c => !c.here).map(c => ({ c })), ...(v.errands ?? []).filter(e => !e.here && e.buyable !== false && !cfg.places[e.place]?.locked).map(e => ({ e }))];
  const buy = (key, price, letter, ok, why) => (ok && ctx.choosing && key
    ? h('button', { type: 'button', class: 'k-btn rn-buy', onclick: () => ctx.go?.(key) }, `Buy ${money(price)}`, dockKbd(ctx, key))
    : h('span', { class: 'hk-tag is-why' }, why ?? 'not now'));
  const rows = [];
  if (conn) {
    const g = (v.goods ?? []).find(x => x.good === conn.good);
    const sells = (g?.sellsAt ?? []).map(x => `${x.label.replace(/^Sell /, '').replace(/^loose cigarettes /, '')} (${range(x.pay)})`).join('; ');
    rows.push(h('li', { class: `rn-thing is-here is-connect${conn.available ? '' : ' is-off'}` },
      h('div', { class: 'rn-job-head' }, h('b', null, `${cap(packWord(cfg, conn.good))} of ${goodWord(cfg, conn.good)} · ${cap(conn.who.name)}`),
        h('span', { class: 'rn-pay' }, conn.off ? h('span', null, h('s', null, money(conn.basePrice)), ' ', money(conn.price)) : money(conn.price))),
      h('p', { class: 'rn-thing-does' }, `Good for ${conn.sales} sales (each costs you ${money(Math.round(conn.basePrice / conn.sales))}); sells to ${sells || 'nobody here'}. On you, a jump takes them as it takes cash; a police stop takes them all and turns ${conn.who.name} against you. Left at the crib, safe.`),
      h('div', { class: 'rn-job-odds' },
        conn.left !== null ? h('span', { class: `rn-supply${conn.left ? '' : ' is-none'}` }, `${conn.left} of ${conn.perDay} left today`) : null,
        trustMark({ ...conn, name: conn.who.name, bandText: conn.bandText }, { short: true, quiet: false }),
        conn.off ? h('span', { class: 'hk-tag is-yours' }, `${money(conn.off)} off: with you`) : h('span', { class: 'rn-why' }, `with you: ${cfg.connect.withOffPct}% off`),
        buy(conn.key, conn.price, 'P', conn.available, conn.sells ? (conn.whyNot ?? 'not now') : conn.why))));
  }
  for (const e of here) {
    const food = e.kind === 'food';
    const gives = Object.entries(e.gives ?? {}).map(([k, n]) => `${k} +${n}`).join(', ');
    rows.push(h('li', { class: `rn-thing is-here${e.available || e.owned ? '' : ' is-off'}${e.owned ? ' is-owned' : ''}` },
      h('div', { class: 'rn-job-head' }, h('b', null, `${cap(thingWord(e.label))}${e.keeper ? ` · ${cap(e.keeper.name)}` : ''}`), h('span', { class: 'rn-pay' }, money(e.price))),
      h('p', { class: 'rn-thing-does' }, food ? `${e.does}${gives ? ` (${gives})` : ''}.` : e.kind === 'ride' ? `${cap(e.desc)}. ${cfg.things[e.item]?.does ?? ''}. Yours for the run.` : cfg.things[e.item]?.defends ? `${cap(e.desc)}. Defends your crib: ${cfg.things[e.item].does.toLowerCase()}.` : `${cap(e.desc)}.${e.kind === 'home' ? ' For the trailer' : ` To wear (${e.slot})`}; looks only.`),
      h('div', { class: 'rn-job-odds' },
        food && e.left !== null ? h('span', { class: `rn-supply${e.left ? '' : ' is-none'}` }, `${e.left} of ${e.perDay} left today`) : null,
        e.owned ? h('span', { class: 'hk-tag is-yours' }, 'owned') : buy(e.key, e.price, food ? 'E' : null, e.available, e.why))));
  }
  const mine = (v.goods ?? []).filter(g => g.carried || g.home);
  return h('section', { class: 'rn-sec rn-here' },
    rows.length ? [h('h3', { class: 'rn-sec-h' }, `Sold here, ${cfg.places[v.place]?.where ?? v.placeLabel}`), h('ul', { class: 'rn-stuff' }, rows), h('p', { class: 'rn-note' }, 'Paid from what you carry, no hour: you walk over to them.')] : null,
    h('h3', { class: 'rn-sec-h' }, 'Your goods'),
    mine.length ? h('ul', { class: 'rn-stuff' }, mine.map(g => h('li', { class: 'rn-thing' },
      h('div', { class: 'rn-job-head' }, h('b', null, cap(g.label)), h('span', { class: 'rn-pay' }, `${g.carried} on you · ${g.home} at home`)),
      h('p', { class: 'rn-thing-does' }, `A sale uses one, win or lose. Sells to ${g.sellsAt.map(x => `${cfg.places[x.place].label} (${range(x.pay)})`).join(', ')}. Bought from ${g.connect?.name ?? 'nobody'} ${cfg.places[g.at]?.where ?? ''}.`))))
      : h('p', { class: 'rn-note' }, 'None. A sale needs goods: buy a pack from a connect.'),
    away.length ? [h('h3', { class: 'rn-sec-h' }, 'Sold elsewhere'), h('ul', { class: 'rn-stuff' }, away.map(({ c, e }) => h('li', { class: 'rn-thing is-away' },
      h('div', { class: 'rn-job-head' }, h('b', null, c ? `${cap(packWord(cfg, c.good))} of ${goodWord(cfg, c.good)} · ${cap(c.who.name)}` : `${cap(thingWord(e.label))}${e.keeper ? ` · ${cap(e.keeper.name)}` : ''}`), h('span', { class: 'rn-pay' }, money(c ? c.price : e.price))),
      h('div', { class: 'rn-job-odds' }, h('span', { class: 'hk-tag' }, `at ${(c ? c.placeLabel : cfg.places[e.place].label)}`), c ? trustMark({ ...c, name: c.who.name }, { short: true }) : null,
        c && !c.sells ? h('span', { class: 'hk-tag is-why' }, c.why) : null, e?.owned ? h('span', { class: 'hk-tag is-yours' }, 'owned') : null))))] : null);
}

// ── THE MAP'S STOPS ────────────────────────────────────────────────────────────────────────────────────────────────
// The map panel is the kit's paper map of the island (demo/run/map.js); these are the words on it. Each stop's card
// (a click on the stop): what it pays, its danger in a word and a number, who is left to work there today; the corner
// locked as the next place. And the line itself in one sentence. Read-only: the moves stay on the bar.
export const STOP_NAME = { park: 'Trailer park', market: 'Flea market', corner: 'The corner' };
export const stopOf = v => (v.place === 'crib' ? 'park' : v.place === 'jail' || v.place === 'clinic' ? null : v.place);

/** Names in a sentence, each followed by its trust mark when it is not neutral. */
const named = (v, people) => {
  const trust = new Map((v.trust ?? []).map(t => [t.id, t]));
  return people.flatMap((p, i) => [i ? ', ' : '', cap(p.name), trustMark(trust.get(p.id), { short: true }) ? ' ' : '', trustMark(trust.get(p.id), { short: true })]).filter(x => x !== '' && x !== null);
};

/** The pay of the options a stop can deal you (the stick-up only with the box cutter): its range. */
function payOf(cfg, place, owned) {
  const jobs = Object.values(cfg.jobs[place] ?? {}).filter(j => !j.needs || owned[j.needs]);
  return jobs.length ? [Math.min(...jobs.map(j => j.pay[0])), Math.max(...jobs.map(j => j.pay[1]))] : null;
}
/** The market's danger: the view's own this hour when you are there; else the engine's for a first hour there now. */
const marketDanger = ({ cfg, v, state }) => (v.danger.here ? v.danger.thisHour : dangerAt(cfg, { ...state, place: 'market', hoursThere: 0 }));

/** The line in one sentence: the fare, the turnstile, the hour and the energy a ride costs. */
export const lineNote = ({ cfg }) => `The line: ${money(cfg.subway.fare)} fare, or hop the turnstile (${cfg.subway.hopCaughtPct}% seen: heat +${cfg.subway.hopHeat}) · 1 hour, ${cfg.energy.perHour} energy.`;

/** A stop's flag on the map, at a glance: its pay and its danger in a word. */
export function stopFlag(ctx, stop) {
  const { cfg, state } = ctx;
  if (stop === 'corner') return 'locked';
  const r = payOf(cfg, stop, state.owned);
  // (rules-2: a place nobody jumps you in is "safe" only while it is not hot: hot, the police are about there)
  const hot = (ctx.v.places ?? []).find(q => q.place === stop)?.hot;
  return `${r ? range(r) : '–'} · ${stop === 'market' ? `${marketDanger(ctx).jump.chance}% jumped` : hot ? 'nobody jumps you' : 'safe'}`;
}

/** A stop's card: what it pays, its danger, who is left there today (the corner: locked, the next place). */
export function stopBody(ctx, stop) {
  const { cfg, v, state } = ctx;
  const at = stopOf(v);
  const here = stop === at ? h('span', { class: 'hk-tag is-yours' }, v.place === 'crib' ? 'you are home' : 'you are here') : null;
  if (stop === 'corner') {
    return [h('p', null, h('b', null, 'Locked'), ` ${cfg.places.corner.locked}. The next place: nothing can be done there yet.`)];
  }
  const r = payOf(cfg, stop, state.owned);
  const all = v.people.filter(p => p.place === stop);
  const on = all.filter(p => !p.outToday);
  const out = all.filter(p => p.outToday);
  const mk = stop === 'market' ? marketDanger(ctx) : null;
  // (rules-2: the place's own heat and police, in the view's words, and what it has left of its street today)
  const pl = (v.places ?? []).find(q => q.place === stop);
  const sup = pl?.supply ?? {};
  const supWords = [sup.strangers ? `${sup.strangers.left} worth robbing` : null, sup.bins ? `${sup.bins.left} bins` : null, sup.custom ? `${sup.custom.left} sales to a regular` : null].filter(Boolean);
  return [
    here,
    pl ? h('p', { class: pl.hot ? 'is-hot' : pl.police ? 'is-police' : 'is-quiet' }, h('b', null, `heat ${pl.heat}`), ` ${pl.text}`) : null,
    h('p', null, 'Pays ', h('b', null, r ? range(r) : '–'), ' an hour.'),
    mk
      ? h('p', { class: 'is-risk' }, h('b', null, `${mk.jump.chance}% jumped`), v.danger.here ? ' this hour, and rising.' : ` a first hour there, rising each hour and each $${cfg.jump.perDollars} on you.`)
      : h('p', { class: 'is-safe' }, h('b', null, 'Safe'), ': nobody acts on you here.'),
    mk?.stop.chance ? h('p', { class: 'is-police' }, h('b', null, `${mk.stop.chance}% police`), ` at heat ${v.place === stop ? v.heatHere : Math.max(state.heat, pl?.heat ?? 0)} here.`) : null,
    // (each name with its trust mark when it is not neutral: trust-1)
    h('p', { class: 'rn-stop-left' }, h('span', null, on.length ? 'Left today: ' : 'Nobody left today.'), ...named(v, on),
      out.length ? h('em', null, `${on.length ? '.' : ''} Out: `, ...named(v, out), '.') : on.length ? '.' : null),
    supWords.length ? h('p', { class: 'rn-stop-left' }, h('span', null, 'On the street: '), `${supWords.join(', ')} left today.`) : null,
  ];
}
