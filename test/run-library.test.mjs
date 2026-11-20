// THE LIBRARY IN THE RUN (lib-1, src/run/library.mjs): every wearable piece of the city's cast and every home-kit piece
// that can stand in the trailer is a thing the player can own. The shelf rule (a few pieces a seller a day, from the
// seed and the day: nothing stored), the tiers and the mock prices, owning and wearing a piece, the save (version 8,
// unchanged), trying on (nothing changes), and that no piece changes a number of the game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, newRun, view, step, checkRunBooks, saveRun, loadRun, RUN_STATE_VERSION, danger } from '../src/run/index.mjs';
import { libraryOf, shelvesOn, shelvesHere, seenBy, thingOf, tryOn, dressOf, homeRuleOut } from '../src/run/library.mjs';
import { WEAR, HOME, OUT, NOFIT } from '../src/run/library-data.mjs';
import { REG, NPC_REG } from '../city/from-trunk/world/cast/fresh/index.js';
import CURATION from '../city/from-trunk/world/cast/curation.js';

const cfg = RUN_CONFIG;
const L = cfg.library;
function at(place, extra = {}, seed = 1) {
  const s = newRun({ seed, cfg });
  return { ...s, place, energy: 6, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) }, books: { ...s.books, ...(extra.books ?? {}) } };
}
const carrying = (state, amount) => ({ ...state, carried: amount, books: { ...state.books, earned: state.books.earned + amount } });
const lib = libraryOf(cfg);

test('library: the data file is the cast as node reads it (a cast re-sync without demo/tools/library-catalog.mjs fails here)', () => {
  const killed = new Set(Object.entries(CURATION.traits ?? {}).filter(([, e]) => e?.status === 'kill').map(([k]) => k));
  const want = [];
  for (const slot of Object.keys(L.slots)) for (const R of [REG, NPC_REG]) for (const t of Object.values(R[slot] ?? {})) if (!killed.has(t.key) && !t.uniform) want.push(`${slot}:${t.id}`);
  assert.deepEqual(WEAR.map(([slot, id]) => `${slot}:${id}`).sort(), want.sort());
  assert.ok(OUT.length > 0 && OUT.every(([piece, why]) => piece.includes(':') && why));
});

test('library: every piece of the six slots and every home piece that can stand in the trailer is in; what is out says why', () => {
  const wear = lib.pieces.filter(p => p.kind === 'wear');
  const home = lib.pieces.filter(p => p.kind === 'home');
  assert.equal(wear.length, WEAR.length, 'every wearable piece (the named things are their pieces, not a second copy)');
  assert.equal(home.length + lib.out.length, HOME.length);
  assert.ok(lib.out.every(o => o.why));
  for (const [id, why] of NOFIT) assert.ok(lib.out.some(o => o.key === `kit:${id}` && o.why === why));
  assert.ok(lib.out.some(o => o.key === 'kit:door-front') && lib.byKey.has('kit:art-print'));
  assert.ok(home.filter(p => !p.named).every(p => ['floor', 'surface', 'wall'].includes(p.place)));
  assert.ok(home.filter(p => !p.named).every(p => !homeRuleOut(p)));
  // the slots the run lacked are there; the neck went with the chains
  assert.deepEqual(new Set(wear.map(p => p.slot)), new Set(['head', 'eyewear', 'top', 'bottom', 'feet', 'acc']));
  assert.ok(!Object.values(cfg.things).some(t => t.slot === 'neck') && !cfg.things.chain && !cfg.things.realchain);
});

test('library: tiers are plain numbers from the library\'s own words; prices in their tier\'s band, the same every run, steep', () => {
  for (const p of lib.pieces.filter(q => !q.named)) {
    assert.ok(Number.isInteger(p.tier) && p.tier >= 0 && p.tier < L.tiers.price.length, p.key);
    const [lo, hi] = L.tiers.price[p.tier];
    assert.ok(p.price >= lo * 0.97 && p.price <= hi * 1.03, `${p.key} $${p.price} in tier ${p.tier}`);
  }
  // from the library's word: a grail piece of the cast is tier 3
  const grail = WEAR.find(w => w[4] === 'grail');
  assert.equal(lib.byKey.get(`${grail[0]}:${grail[1]}`).tier, 3);
  // few at the top, the curve steep: the commonest within a day's money, the top beyond a whole run's
  const n = t => lib.pieces.filter(p => p.tier === t).length;
  assert.ok(n(0) > n(1) && n(1) > n(3));
  assert.ok(L.tiers.price[0][1] < 100 && L.tiers.price[3][0] >= 100000);
  assert.deepEqual(libraryOf(cfg).byKey.get('top:old_hoodie')?.price, lib.byKey.get('top:old_hoodie')?.price);
});

test('shelves: a few pieces a seller a day, from the seed and the day; the same seed and day the same shelves; none stored', () => {
  const day1 = shelvesOn(cfg, 1, 1);
  assert.deepEqual(day1.map(s => [s.place, s.keeper, s.kind]), [['market', 'npc:stallholder:3', 'wear'], ['park', 'npc:neighbour:2', 'home'], ['market', 'npc:stallholder:2', 'home']]);
  for (const s of day1) {
    assert.equal(s.items.length, L.shelf[s.kind]);
    assert.equal(new Set(s.items).size, s.items.length);
    assert.ok(s.items.every(k => lib.byKey.get(k).kind === s.kind && !lib.byKey.get(k).named));
  }
  assert.deepEqual(shelvesOn(cfg, 1, 1), day1);
  assert.notDeepEqual(shelvesOn(cfg, 1, 2).map(s => s.items), day1.map(s => s.items));
  assert.notDeepEqual(shelvesOn(cfg, 2, 1).map(s => s.items), day1.map(s => s.items));
  // where you stand: the market's two sellers; on the corner (locked) none
  assert.equal(shelvesHere(cfg, at('market')).length, 2);
  assert.equal(shelvesHere(cfg, at('corner')).length, 0);
  // the view: today's shelves, and nothing of the state changed by looking
  const s = at('market', { day: 3 });
  const before = JSON.stringify(s);
  const v = view(cfg, s);
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(v.library.shelves.map(x => x.items), shelvesOn(cfg, s.seed, 3).map(x => x.items));
  // seen: on any shelf on any day so far
  const seen = seenBy(cfg, s);
  for (let d = 1; d <= 3; d++) for (const x of shelvesOn(cfg, s.seed, d)) for (const k of x.items) assert.ok(seen.has(k));
  assert.ok(v.library.pieces.filter(p => p.seen).length === seen.size);
  assert.ok(!v.library.pieces.find(p => p.key === shelvesOn(cfg, s.seed, 4)[0].items.find(k => !seen.has(k)))?.seen);
});

test('owning: a piece off today\'s shelf for its price and no hour; clothes go on if the slot is free; on and off at the crib', () => {
  const s0 = at('market', { day: 2 });
  const key = shelvesHere(cfg, s0).find(x => x.kind === 'wear').items.find(k => lib.byKey.get(k).tier === 0) ?? shelvesHere(cfg, s0)[0].items[0];
  const t = thingOf(cfg, key);
  const s = carrying(s0, t.price + 5);
  const all = view(cfg, s).choices;
  const c = all.find(x => x.choice.do === 'get' && x.choice.item === key);
  // (after every older move: their keys are as they were)
  // (styles-1: the lessons and the fight-with choices come after the shelves, after everything older)
  assert.ok(c.available && c.shelf && +c.key > Math.max(...all.filter(x => !x.shelf && x.choice.do !== 'learn' && x.choice.do !== 'fightWith' && !(x.choice.do === 'get' && cfg.things[x.choice.item]?.late) && x.choice.do !== 'earlWay' && x.choice.do !== 'tax').map(x => +x.key))); // (sixes-1: and the slice's pieces, how Earl fights and the tax, after them)
  const r = step(cfg, s, c.choice);
  assert.deepEqual([r.state.hour, r.state.carried, r.state.things[key], r.state.worn[t.slot]], [s.hour, 5, true, key]);
  assert.equal(r.events[0].type, 'thing');
  assert.equal(r.events[0].keeper.name, 'Mrs. Kowalski');
  assert.ok(checkRunBooks(r.state).ok);
  assert.equal(r.state.books.things, t.price);
  assert.equal(view(cfg, r.state).choices.find(x => x.choice.item === key).why, 'owned');
  // not on a shelf here today: not a choice
  const other = lib.pieces.find(p => p.kind === 'wear' && !p.named && !shelvesHere(cfg, s).some(x => x.items.includes(p.key)));
  assert.throws(() => step(cfg, carrying(s0, 1e6), { do: 'get', item: other.key }), /not a choice here/);
  // at the crib: off and on again, for nothing; the view lists it owned and worn
  const home = { ...r.state, place: 'crib', carried: 0, banked: r.state.banked + r.state.carried };
  const off = step(cfg, home, { do: 'unwear', item: key });
  assert.deepEqual(off.state.worn, {});
  const on = step(cfg, off.state, { do: 'wear', item: key });
  assert.deepEqual(on.state.worn, { [t.slot]: key });
  const v = view(cfg, on.state);
  assert.ok(v.things.owned.some(o => o.item === key && o.worn && o.library));
  assert.ok(v.library.pieces.find(p => p.key === key).owned && v.library.pieces.find(p => p.key === key).worn);
  assert.deepEqual(dressOf(cfg, on.state.worn), { [key.split(':')[0]]: key.split(':')[1] });
  // a home piece: owned, nothing worn
  const p0 = at('park', { day: 2 });
  const hk = shelvesHere(cfg, p0)[0].items[0];
  const h = step(cfg, carrying(p0, thingOf(cfg, hk).price), { do: 'get', item: hk });
  assert.ok(h.state.things[hk] && !Object.values(h.state.worn).includes(hk));
});

test('cosmetic: owning and wearing library pieces changes no number of the game (danger, jobs, energy, defences)', () => {
  const keys = lib.pieces.filter(p => !p.named).slice(0, 40).map(p => p.key);
  for (const place of ['park', 'market']) {
    const s = at(place, { hour: 15, day: 2 });
    const rich = { ...s, things: Object.fromEntries(keys.map(k => [k, true])), worn: { head: lib.pieces.find(p => p.slot === 'head' && !p.named).key } };
    const a = view(cfg, s), b = view(cfg, rich);
    assert.deepEqual(danger(cfg, rich), danger(cfg, s));
    assert.deepEqual(b.options, a.options);
    assert.deepEqual(b.home.defences, a.home.defences);
    assert.equal(b.fullEnergy ?? null, a.fullEnergy ?? null);
  }
});

test('save: owning library pieces needs no new field; version 8 as before (9 since memory-1), a save from before loads and keeps what it owned', () => {
  assert.equal(RUN_STATE_VERSION, 12); // (sixes-1: 11; raid-1: 12)
  const key = lib.pieces.find(p => p.kind === 'wear' && !p.named).key;
  const s = { ...at('crib'), things: { visor: true, [key]: true, 'kit:boombox': true }, worn: { head: key } };
  const r = loadRun(saveRun(s));
  assert.ok(r.ok, r.text);
  assert.deepEqual([r.state.things, r.state.worn], [s.things, s.worn]);
  // a version-8 save written before lib-1 (named things only) loads as it was
  const old = { ...at('market'), v: 8, things: { visor: true, bowling: true, lavalamp: true }, worn: { head: 'visor', top: 'bowling' } };
  delete old.marks;
  delete old.visits;
  const o = loadRun(JSON.stringify({ kind: 'the-run', v: 8, state: old }));
  assert.ok(o.ok, o.text);
  assert.deepEqual([o.state.things, o.state.worn], [old.things, old.worn]);
  assert.equal(view(cfg, o.state).things.text, 'Wearing a Lucky 7 Dad Cap, a Neon Row Silk shirt.');
});

test('trying on: any piece, owned or not, on a shelf or not; free, no hour, and the state (and its save) exactly as before', () => {
  const s = { ...carrying(at('market', { day: 2 }), 30), things: { visor: true }, worn: { head: 'visor' } };
  const before = structuredClone(s);
  const text = saveRun(s);
  const notOwned = lib.pieces.filter(p => p.kind === 'wear' && !p.named && p.tier === 3)[0];
  const top = lib.pieces.find(p => p.kind === 'wear' && p.slot === 'top' && !p.named);
  const t = tryOn(cfg, s, [notOwned.key, top.key]);
  assert.equal(t.why, null);
  assert.equal(t.dress[notOwned.castSlot], notOwned.id);
  assert.equal(t.dress.top, top.id);
  if (notOwned.castSlot !== 'hat') assert.equal(t.dress.hat, 'lucky7_dad');
  assert.deepEqual(s, before);
  assert.equal(saveRun(s), text);
  assert.deepEqual(dressOf(cfg, s.worn), { hat: 'lucky7_dad' }, 'off again: what is really worn');
  assert.ok(tryOn(cfg, s, ['kit:boombox']).why);
});

test('the named things are sold as the piece drawn, under its own name; the chains are gone', () => {
  assert.equal(cfg.things.visor.piece, 'hat:lucky7_dad');
  assert.match(cfg.things.visor.label, /Lucky 7 Dad Cap/);
  assert.equal(cfg.things.hightops.piece, 'shoes:tagged_customs');
  assert.equal(cfg.things.overcoat.piece, 'top:npc_top_trench');
  assert.equal(cfg.things.homebar.piece, 'kit:bar-home');
  assert.equal(cfg.things.deadbolt.piece, 'kit:door-locks');
  assert.equal(cfg.places.park.shop.find(x => x.item === 'sandwich').piece, 'held:chopped_cheese');
  assert.ok(!['recliner', 'mattress-floor'].includes(cfg.things.recliner.piece.slice(4)));
  for (const t of Object.values(cfg.things)) if (t.piece?.match(/^(hat|top|shoes|bottom|eyewear|acc):/)) assert.ok(WEAR.some(w => `${w[0]}:${w[1]}` === t.piece), t.piece);
  for (const t of Object.values(cfg.things)) if (t.piece?.startsWith('kit:')) assert.ok(HOME.some(o => `kit:${o[0]}` === t.piece), t.piece);
});
