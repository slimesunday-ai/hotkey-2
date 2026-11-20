// THE LIBRARY'S LISTS AND WORDS (ui-3 leg 3, demo/run/catalog.js): every piece that exists is in it whatever was seen;
// its filters cover every piece (each slot, each category), sort as they say, and count as they show; the Buy button is
// pressed only through the rules' own choice, and says why in plain words when it cannot be; Put on / Take off at home
// only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, newRun, view } from '../src/run/index.mjs';
import { shelvesHere } from '../src/run/library.mjs';
import { pick, order, countLine, buyOf, wearOf, soldLine, fitLine, marksOf, marksWords, catsOf, slotsOf, catOf, onWall, onSaleToday, money, nameOf, CATS, SLOTS, FILTER0, ON_WALL } from '../demo/run/catalog.js';

const cfg = RUN_CONFIG;
function at(place, extra = {}, seed = 1) {
  const s = newRun({ seed, cfg });
  return { ...s, place, energy: 6, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) }, books: { ...s.books, ...(extra.books ?? {}) } };
}
const carrying = (state, amount) => ({ ...state, carried: amount, books: { ...state.books, earned: state.books.earned + amount } });
const F = (o = {}) => ({ ...FILTER0, ...o });

test('everything that exists: all of a kind whatever was seen; the slots and the categories cover every piece; the count says so', () => {
  const v = view(cfg, at('crib'));
  const P = v.library.pieces;
  const wear = pick(P, F({ kind: 'wear' }));
  const home = pick(P, F({ kind: 'home' }));
  const ride = pick(P, F({ kind: 'ride' }));
  assert.equal(wear.length + home.length + ride.length, P.length);
  assert.equal(wear.length, v.library.counts.wear.all);
  assert.equal(home.length, v.library.counts.home.all);
  assert.ok(wear.some(p => !p.seen) && home.some(p => !p.seen), 'pieces never seen are listed');
  assert.equal(countLine(wear, P, F({ kind: 'wear' })), `${wear.length} of ${wear.length}`);
  // each slot: its own pieces only, and together every piece to wear
  let n = 0;
  for (const s of SLOTS) {
    const got = pick(P, F({ kind: 'wear', slot: s.id }));
    assert.ok(got.every(p => p.slot === s.id));
    n += got.length;
  }
  assert.equal(n, wear.length);
  assert.deepEqual(slotsOf(P).map(s => s.n), SLOTS.map(s => pick(P, F({ kind: 'wear', slot: s.id })).length));
  // each category: together every home piece, named things included (by their piece's category)
  assert.ok(home.every(p => CATS.some(c => c.id === catOf(p))), `no category: ${home.filter(p => !CATS.some(c => c.id === catOf(p))).map(p => p.key)}`);
  assert.equal(CATS.reduce((a, c) => a + pick(P, F({ kind: 'home', cat: c.id })).length, 0), home.length);
  // on a wall: every piece that hangs, whatever its category (the deadbolt's locks too), and only those
  const wall = pick(P, F({ kind: 'home', cat: ON_WALL }));
  assert.ok(wall.length >= 30 && wall.every(onWall));
  assert.ok(wall.some(p => p.key === 'deadbolt'));
  assert.equal(catsOf(P)[0].id, ON_WALL);
  assert.equal(catsOf(P)[0].n, wall.length);
  assert.equal(countLine(wall, P, F({ kind: 'home', cat: ON_WALL })), `${wall.length} of ${home.length}`);
});

test('rarity, on sale today and owned', () => {
  const s = { ...at('market', { day: 2 }), things: { 'kit:boombox': true, visor: true }, worn: { head: 'visor' } };
  const v = view(cfg, s);
  const P = v.library.pieces;
  for (const t of [0, 1, 2, 3]) {
    const got = pick(P, F({ kind: 'wear', tier: t }));
    assert.ok(got.length && got.every(p => p.tier === t));
  }
  assert.equal([0, 1, 2, 3].reduce((a, t) => a + pick(P, F({ kind: 'home', tier: String(t) })).length, 0), pick(P, F({ kind: 'home' })).length);
  // on sale today: every shelf's pieces, and the named things sold every day where it is open (not the corner's)
  const today = pick(P, F({ kind: 'wear', show: 'today' }));
  const shelf = v.library.shelves.filter(x => x.kind === 'wear').flatMap(x => x.items);
  assert.ok(shelf.every(k => today.some(p => p.key === k)));
  assert.ok(today.some(p => p.key === 'visor') && !today.some(p => p.key === 'overcoat'));
  assert.ok(today.every(onSaleToday));
  // owned
  assert.deepEqual(pick(P, F({ kind: 'home', show: 'owned' })).map(p => p.key), ['kit:boombox']);
  assert.deepEqual(pick(P, F({ kind: 'wear', show: 'owned' })).map(p => p.key), ['visor']);
  const m = marksOf(P.find(p => p.key === 'visor'), v);
  assert.ok(m.owned && m.worn && m.today && m.here);
  assert.equal(marksWords(m), 'wearing');
  const shelfKey = v.library.shelves.find(x => x.here && x.kind === 'wear').items[0];
  assert.equal(marksWords(marksOf(P.find(p => p.key === shelfKey), v)), 'on sale here');
});

test('sorting: by price either way, by rarity either way, then by name; the same list always in the same order', () => {
  const P = view(cfg, at('crib')).library.pieces;
  const list = pick(P, F({ kind: 'home' }));
  const up = order(list, 'price');
  for (let i = 1; i < up.length; i++) assert.ok(up[i - 1].price <= up[i].price);
  const down = order(list, 'price-down');
  for (let i = 1; i < down.length; i++) assert.ok(down[i - 1].price >= down[i].price);
  const tier = order(list, 'tier');
  for (let i = 1; i < tier.length; i++) assert.ok(tier[i - 1].tier < tier[i].tier || (tier[i - 1].tier === tier[i].tier && tier[i - 1].price <= tier[i].price));
  const grail = order(list, 'tier-down');
  assert.equal(grail[0].tier, 3);
  assert.deepEqual(order(list.slice().reverse(), 'price').map(p => p.key), up.map(p => p.key));
  assert.equal(list.length, up.length, 'sorting keeps every piece');
  assert.ok(list !== up, 'a copy');
});

test('the Buy button: pressed only through the rules\' own choice; else it says why in plain words', () => {
  // at the market with the cash: a piece on the shelf here can be bought, by the rules' own `get` choice
  const s0 = at('market', { day: 2 });
  const shelfKey = shelvesHere(cfg, s0).find(x => x.kind === 'wear').items[0];
  const rich = view(cfg, carrying(s0, 1e6));
  const p = rich.library.pieces.find(x => x.key === shelfKey);
  const b = buyOf(p, { cfg, v: rich });
  const c = rich.choices.find(x => x.key === b.key);
  assert.ok(b.can && c && c.choice.do === 'get' && c.choice.item === shelfKey);
  assert.equal(b.label, `Buy ${money(p.price)}`);
  // while an hour plays: not now
  assert.deepEqual([buyOf(p, { cfg, v: rich, choosing: false }).can, buyOf(p, { cfg, v: rich, choosing: false }).why], [false, 'when this hour is over']);
  // short of cash: what you carry
  const poor = view(cfg, carrying(s0, 3));
  const bp = buyOf(poor.library.pieces.find(x => x.key === shelfKey), { cfg, v: poor });
  assert.equal(bp.can, false);
  assert.match(bp.why, /^you carry \$3/);
  // the same piece seen from the trailer park: where it is today
  const park = view(cfg, carrying(at('park', { day: 2 }), 1e6));
  assert.equal(buyOf(park.library.pieces.find(x => x.key === shelfKey), { cfg, v: park }).why, 'on a shelf at the Jay St night market today');
  // a piece on no shelf today
  const none = park.library.pieces.find(x => x.kind === 'wear' && !x.named && !x.onShelf);
  assert.deepEqual(buyOf(none, { cfg, v: park }), { can: false, key: null, label: `Buy ${money(none.price)}`, why: 'not on any shelf today' });
  assert.match(soldLine(none, { cfg, v: park }), /^Not on any shelf today/);
  // a named thing sold every day elsewhere, and one at the corner, which is not open
  assert.equal(buyOf(park.library.pieces.find(x => x.key === 'visor'), { cfg, v: park }).why, 'sold at the Jay St night market, every day');
  assert.match(buyOf(park.library.pieces.find(x => x.key === 'overcoat'), { cfg, v: park }).why, /not open yet/);
  assert.match(soldLine(park.library.pieces.find(x => x.key === 'visor'), { cfg, v: park }), /every day at Mrs\. Kowalski's clothes rail, at the Jay St night market/);
  assert.match(soldLine(rich.library.pieces.find(x => x.key === shelfKey), { cfg, v: rich }), /^On sale today at .*, here\.$/);
  // owned: Yours
  const own = view(cfg, { ...carrying(s0, 1e6), things: { [shelfKey]: true } });
  assert.deepEqual([buyOf(own.library.pieces.find(x => x.key === shelfKey), { cfg, v: own }).can, buyOf(own.library.pieces.find(x => x.key === shelfKey), { cfg, v: own }).label], [false, 'Yours']);
});

test('Put on and Take off: at home through the rules\' own choice; elsewhere "change at home"', () => {
  const key = 'visor';
  const home = view(cfg, { ...at('crib'), things: { [key]: true }, worn: {} });
  const w = wearOf(home.library.pieces.find(p => p.key === key), { v: home });
  const c = home.choices.find(x => x.key === w.key);
  assert.ok(w.can && c.choice.do === 'wear' && c.choice.item === key && w.label === 'Put on');
  const on = view(cfg, { ...at('crib'), things: { [key]: true }, worn: { head: key } });
  assert.equal(wearOf(on.library.pieces.find(p => p.key === key), { v: on }).label, 'Take off');
  const out = view(cfg, { ...at('market'), things: { [key]: true }, worn: {} });
  assert.deepEqual(wearOf(out.library.pieces.find(p => p.key === key), { v: out }), { key: null, label: 'Put on', can: false, why: 'change at home' });
  assert.equal(wearOf(out.library.pieces.find(p => p.key === 'bowling'), { v: out }), null, 'not owned: nothing to put on');
});

test('the words: names without their article, the slot or how it stands and its size, prices as tags', () => {
  const P = view(cfg, at('crib')).library.pieces;
  assert.equal(nameOf(P.find(p => p.key === 'visor')), 'Lucky 7 Dad Cap');
  assert.equal(nameOf(P.find(p => p.key === 'hightops')), 'Tagged Customs');
  assert.equal(money(152000), '$152,000');
  assert.equal(fitLine(P.find(p => p.key === 'visor')), 'Worn on the head');
  assert.equal(fitLine(P.find(p => p.key === 'beanbag')), 'Stands on the floor · 0.75 m × 0.75 m');
  assert.match(fitLine(P.find(p => p.key === 'deadbolt')), /^Hangs on a wall · 0\.25 m wide, 0\.75 m tall$/);
  assert.match(fitLine(P.find(p => p.key === 'lavalamp')), /^Stands on a table or counter/);
});
