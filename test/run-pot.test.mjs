// THE POT (pot-1, RUN.md "The pot (pot-1)"): build step 1 of crafting, rules only. You buy night tea or rave sticks on
// your own street, cook them at your crib on the hot plate (an hour, up to two in the pot, six bags), sell the bags
// through the selling jobs that exist, and the buyer is under its effect until an hour; a batch comes out clean, dirty
// or with something else in it, the odds known before; the smell of cooking is a level on HOME, the fan takes one off.
// And the six things the addition locks into step 1 (a carrier takes kinds of thing; an effect does not care where it
// came from; a made thing can be on you without being for sale; the save keeps the shelf and the book by maker; every
// made thing is a row in what your home is worth).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RUN_CONFIG, withRunConfig, newRun, view, step, checkRunBooks, RUN_STATE_VERSION, saveRun, loadRun } from '../src/run/index.mjs';
import { tellRisk, danger, placeHeat, pressureOf, goodsFor, shownGoods, deal } from '../src/run/rules.mjs';
import { productOf, cookOdds, smellOf, liftsAt, bookOf, shelfOf, productName } from '../src/run/make.mjs';
import { clockOf, underNow, placeEffects } from '../src/run/effects.mjs';
import { homeWorth } from '../src/run/raid.mjs';

const cfg = RUN_CONFIG;
const X = cfg.make;
function at(place, extra = {}, seed = 1) {
  const s = newRun({ seed, cfg });
  return { ...s, place, energy: 6, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) }, home: { ...s.home, ...(extra.home ?? {}) } };
}
const carrying = (s, n) => ({ ...s, carried: s.carried + n, books: { ...s.books, earned: s.books.earned + n } });
const cook = ins => ({ do: 'cook', maker: 'kitchen', carrier: 'pot', with: ins });
const choice = (v, test) => v.choices.find(c => test(c.choice));
/** A crib with the hot plate and these makings at home, every making seen (so something else can get in). */
const kitchen = (stash = { tea: 1 }, extra = {}) => at('crib', { things: { hotplate: true }, stash, make: { kitchen: { seen: { tea: true, sticks: true }, book: { tried: {}, found: {}, names: {} }, known: {}, cooked: {} } }, ...extra });

test('the pot is data: a carrier takes kinds of thing; every set it can take makes a drawn product', () => {
  const C = X.makers.kitchen.carriers.pot;
  assert.deepEqual([C.takes, C.slots, C.gives, C.n, C.hours], [['ingredient'], 2, 'bag', 6, 1]);
  assert.equal(cfg.things[X.makers.kitchen.station].station, 'kitchen');
  // each making does one thing, and its seller is a person of your own street
  for (const [k, m] of Object.entries(X.makings)) {
    assert.ok(X.effects[m.effect], `${k} does one thing`);
    assert.equal(m.at, 'park');
    assert.ok(cfg.places.park.people.some(p => p.id === m.keeper), `${k} is sold by somebody of the trailer park`);
    assert.equal(cfg.goods[k].making, true);
  }
  // every set the pot could take is a product of the art's (demo/stage/props/craft.js PRODUCTS: `prop:bag-<id>`)
  const art = readFileSync(new URL('../demo/stage/props/craft.js', import.meta.url), 'utf8');
  const sets = [['tea'], ['sticks'], ['tea', 'sticks']];
  for (const s of sets) {
    const p = productOf(cfg, s);
    assert.ok(!p.id.startsWith('mix:'), `${s} is tabled`);
    assert.match(art, new RegExp(`'?${p.id}'?: \\{ name:`), `${p.id} is drawn`);
    assert.equal(cfg.goods[p.id].piece, `prop:bag-${p.id}`);
  }
  assert.deepEqual(sets.map(s => productOf(cfg, s).name), ['Zonked', 'Disco Rash', 'Disco Coma']);
});

test('the mixing rule: each does its one thing; two on the same part of the body take turns, the downer last', () => {
  const p = productOf(cfg, ['sticks', 'tea']);
  assert.equal(p.id, 'disco-coma');
  assert.deepEqual(p.effects.map(e => [e.effect, e.at, e.hours]), [['dancing', 0, 2], ['asleep', 2, 3]]);
  assert.equal(p.rarity, 'common');
  assert.ok(p.names, 'two in the pot: the player names it');
  assert.ok(!productOf(cfg, ['tea']).names);
  assert.deepEqual(productOf(cfg, ['tea']).effects.map(e => [e.effect, e.at, e.hours]), [['asleep', 0, 3]]);
});

test('the makings are bought on your own street, from what you carry, no hour, listed after every older move', () => {
  const s = carrying(at('park'), 20);
  const v = view(cfg, s);
  const older = v.choices.filter(c => !['making'].includes(c.choice.do) && !(c.choice.do === 'get' && cfg.things[c.choice.item]?.late === 'pot'));
  const tea = choice(v, c => c.do === 'making' && c.item === 'tea');
  assert.ok(tea.available);
  assert.ok(Number(tea.key) > Math.max(...older.map(c => Number(c.key))) - 1 || older.every(c => Number(c.key) < Number(tea.key)));
  assert.equal(tea.keeper.name, 'Mrs. Alvarez');
  assert.match(tea.label, /^Buy a tin of night tea from Mrs\. Alvarez \(\$8\): asleep where they stand, 3 hours$/);
  const r = step(cfg, s, tea.choice);
  assert.deepEqual([r.state.goods.tea, r.state.carried, r.state.hour], [1, 12, s.hour]);
  assert.equal(r.state.make.kitchen.seen.tea, true);
  assert.equal(r.events[0].type, 'making');
  assert.ok(checkRunBooks(r.state).ok);
  // the hot plate from Mr. Pruitt, $30
  const plate = choice(view(cfg, carrying(at('park'), 40)), c => c.do === 'get' && c.item === 'hotplate');
  assert.ok(plate.available);
  assert.equal(plate.keeperName, 'Mr. Pruitt');
  // against you, she will not sell
  const sour = carrying(at('park', { trust: { 'npc:neighbour': -3 } }), 20);
  assert.match(choice(view(cfg, sour), c => c.do === 'making' && c.item === 'tea').why, /won't sell to you/);
  // going inside leaves it at home; stepping out leaves it there unless asked for
  const home = step(cfg, r.state, { do: 'inside' }).state;
  assert.equal(home.stash.tea, 1);
  const out = step(cfg, home, { do: 'out', take: 0 }).state;
  assert.deepEqual([out.goods.tea ?? 0, out.stash.tea], [0, 1]);
  assert.equal(view(cfg, home).moves.find(m => m.choice.do === 'out').takeGoods.tea.default, 0);
});

test('the Cook move: at your crib, with the hot plate, an hour; six bags at home; the book and the smell', () => {
  const s = kitchen({ tea: 2, sticks: 1 });
  const v = view(cfg, s);
  assert.equal(v.pot.options.length, 3, 'tea, sticks, both');
  const both = v.pot.options.find(o => o.with.join('+') === 'sticks+tea');
  assert.equal(both.name, 'Disco Coma');
  assert.deepEqual(both.lines, ['Rainbow skin, cannot stop dancing: 2 hours', 'then asleep where they stand: 3 hours']);
  assert.equal(both.bags, 6);
  assert.deepEqual([both.odds.clean, both.odds.dirty, both.odds.extra], [88, 12, 0], 'nothing else ever on the shelf can get in');
  const one = v.pot.options.find(o => o.with.join('+') === 'tea');
  assert.deepEqual([one.odds.clean, one.odds.dirty, one.odds.extra], [84, 12, 4]);
  assert.match(v.pot.reason.text, /never put (night tea and rave sticks|rave sticks and night tea) together/);
  const r = step(cfg, { ...s, rig: { chances: [0] } }, cook(['tea']));
  const e = r.events.find(x => x.type === 'cook');
  assert.deepEqual([r.state.hour, r.state.energy, r.state.stash.zonk, r.state.stash.tea], [s.hour + 1, s.energy - 1, 6, 1]);
  assert.equal(e.name, 'Zonked');
  assert.equal(e.scene.action, 'cook');
  assert.ok(e.scene.seconds <= 4, 'the cook gives control back inside four seconds (C6)');
  assert.equal(r.state.make.kitchen.book.found.zonk, s.day);
  assert.equal(r.state.make.kitchen.cooked[s.day], 1);
  assert.equal(smellOf(cfg, r.state).level, 1);
  // tired, a dirty batch is likelier
  assert.equal(cookOdds(cfg, { ...s, energy: 2 }, 'kitchen', ['tea']).dirty, X.outcomes.tired);
  // no hot plate, no Cook move; smashed in a raid, it says until when
  assert.ok(!choice(view(cfg, { ...s, things: {} }), c => c.do === 'cook'));
  const smashed = { ...s, home: { ...s.home, out: { hotplate: s.day } } };
  assert.match(choice(view(cfg, smashed), c => c.do === 'cook').why, /smashed: no use until day 2/);
  assert.throws(() => step(cfg, { ...s, place: 'park' }, cook(['tea'])), /not a choice here/);
});

test('a batch comes out clean, dirty (the Pukes, found out when the first person takes it) or with something else in it', () => {
  const s = kitchen({ tea: 1 });
  // something else got in: one more making, free, from anything ever on the shelf
  const lucky = step(cfg, { ...s, rig: { chances: [99] } }, cook(['tea']));
  assert.equal(lucky.events[0].outcome, 'extra');
  assert.equal(lucky.events[0].extra, 'sticks');
  assert.equal(lucky.state.stash['disco-coma'], 6);
  assert.ok(lucky.state.make.kitchen.book.found['disco-coma']);
  // dirty: the batch shows as its product (nobody can tell), the event says nothing
  const dirty = step(cfg, { ...s, rig: { chances: [90] } }, cook(['tea']));
  assert.equal(dirty.events[0].outcome, 'clean');
  assert.equal(dirty.state.stash['zonk~pukes'], 6);
  assert.deepEqual(shownGoods(cfg, dirty.state, dirty.state.stash), { zonk: 6 });
  assert.deepEqual(view(cfg, dirty.state).pot.shelf.made.map(m => [m.name, m.home, m.dirty]), [['Zonked', 6, null]]);
  // sold: the buyer throws up green, sour with you, the place one hotter; the rest of the batch shows as dirty now
  let t = { ...dirty.state, place: 'park', goods: { 'zonk~pukes': 2 }, stash: { 'zonk~pukes': 4 } };
  const v = view(cfg, t);
  const sale = v.options.find(o => o.uses);
  assert.equal(sale.uses.label, 'Zonked');
  const heat0 = placeHeat(t, 'park');
  const sold = step(cfg, { ...t, rig: { chances: [0] } }, sale.choice);
  const ev = sold.events.find(x => x.type === 'job');
  assert.ok(ev.dose.dirty, 'the Pukes');
  assert.equal(ev.mood, 'sour');
  assert.equal(placeHeat(sold.state, 'park'), heat0 + 1);
  assert.deepEqual(underNow(sold.state, ev.who.id, clockOf(sold.state)).map(r => r.effect).sort(), ['asleep', 'pukes']);
  assert.match(goodsFor(cfg, sold.state, cfg.jobs.park.loosies)[0].label, /Zonked, dirty/);
  assert.deepEqual(shownGoods(cfg, sold.state, sold.state.stash), { 'zonk~pukes': 4 });
});

test('a bag sold: the buyer is under it from the end of the hour, until an hour; with $20 and a hot plate, asleep by 14:00 on day 1', () => {
  let s = { ...newRun({ seed: 2, cfg }), things: { hotplate: true } };
  const go = c => { s = step(cfg, { ...s, rig: { chances: [0, 0] } }, c).state; };
  go({ do: 'out', take: 20 });
  go({ do: 'making', item: 'tea' });
  go({ do: 'inside' });
  go(cook(['tea']));
  go({ do: 'out', take: 0 });
  const v = view(cfg, s);
  const sale = v.options.find(o => o.uses);
  assert.match(sale.label, /^Sell Zonked to Shaky Dee at the bus stop$/);
  assert.equal(sale.uses.made.text, "Zonked: he'll sleep 3 h");
  go(sale.choice);
  assert.equal(s.day, 1);
  assert.equal(s.hour, 14);
  const u = view(cfg, s).under;
  assert.equal(u.length, 1);
  assert.deepEqual([u[0].who.name, u[0].now[0].effect, u[0].now[0].untilClock, u[0].place], ['Shaky Dee', 'asleep', '17:00', 'park']);
  assert.deepEqual(view(cfg, s).places.find(p => p.place === 'park').under.map(c => c.text), ['asleep 1']);
  // the morning sweeps it
  const next = step(cfg, { ...s, place: 'crib' }, { do: 'sleep' }).state;
  assert.deepEqual(next.under, {});
  assert.ok(checkRunBooks(s).ok);
});

test('Disco Rash: while anyone dances at a place nobody there tells, you are jumped a quarter less often, the place is one hotter', () => {
  const t = clockOf(at('market'));
  const dancer = { 'npc:buyer:market:1': [{ effect: 'dancing', from: t - 1, until: t + 1, place: 'market', by: { product: 'disco-rash' }, heat: 1, heatTop: 5 }] };
  const base = at('market', { trust: { 'npc:shop:market': -3, 'npc:shop:market:2': -3 }, hoursThere: 3, placeHeat: { market: 1 } });
  const with_ = { ...base, under: dancer };
  assert.deepEqual(placeEffects(cfg, with_, 'market').noTell, ['dancing']);
  assert.equal(tellRisk(cfg, with_, 'market').pct, 0);
  const j0 = danger(cfg, base).jump.chance;
  // (bench-1: a quarter less often, not half: the orchestrator's call, the owner's "Go with your calls")
  assert.equal(danger(cfg, with_).jump.chance, Math.round((j0 * 3) / 4));
  assert.match(danger(cfg, with_).jump.why.join(' '), /dancing here: a quarter less often/);
  assert.equal(placeHeat(with_, 'market'), placeHeat(base, 'market') + 1);
  // when the dance ends, so does all of it
  const later = { ...with_, hour: with_.hour + 2 };
  assert.equal(placeHeat(later, 'market'), 1);
  assert.equal(danger(cfg, later).jump.chance, danger(cfg, { ...base, hour: base.hour + 2 }).jump.chance);
});

test("a sleeper's wallet: a sure lift that pays what the place's wallet pays; he knows who sold it, and buys no more for the week", () => {
  const t = clockOf(at('park'));
  const dee = 'npc:buyer:projects:1';
  const s = at('park', { under: { [dee]: [{ effect: 'asleep', from: t, until: t + 3, place: 'park', by: { product: 'zonk', maker: 'kitchen' } }] }, people: { [dee]: { mood: 'friendly', out: true, job: 'loosies' } } });
  const L = liftsAt(cfg, s);
  assert.equal(L.length, 1);
  assert.deepEqual(L[0].pay, cfg.jobs.park.wallet.pay);
  const m = choice(view(cfg, s), c => c.do === 'lift');
  assert.ok(m.available);
  assert.match(m.label, /^Lift the wallet off Shaky Dee while he sleeps \(sure: \$18–30; Shaky Dee will know who sold it\)$/);
  const r = step(cfg, s, m.choice);
  const e = r.events.find(x => x.type === 'lift');
  assert.ok(e.pay >= 18 && e.pay <= 30);
  assert.equal(r.state.marks[dee].kind, 'lifted');
  assert.equal(liftsAt(cfg, r.state).length, 0, 'once a dose');
  // the next day he will not buy from you
  const tomorrow = { ...r.state, day: r.state.day + 1, people: {}, goods: { zonk: 2 }, under: {} };
  assert.ok(!deal(cfg, tomorrow).some(j => j.who?.id === dee && j.goods));
  assert.ok(checkRunBooks(r.state).ok);
});

test('the smell is a level, not a pile: +1 the day you cook and the day after, +2 for two cooks, one less with the fan; on HOME', () => {
  const s = kitchen({ tea: 3 });
  const one = step(cfg, s, cook(['tea'])).state;
  assert.equal(smellOf(cfg, one).level, 1);
  assert.ok(pressureOf(cfg, one).reasons.some(r => r.kind === 'smell' && r.n === 1));
  const two = step(cfg, one, cook(['tea'])).state;
  assert.equal(smellOf(cfg, two).level, 2);
  const three = step(cfg, two, cook(['tea'])).state;
  assert.equal(smellOf(cfg, three).level, 2, 'never more than two');
  const d2 = step(cfg, three, { do: 'sleep' }).state;
  assert.equal(smellOf(cfg, d2).level, 2, 'the day after');
  const d3 = step(cfg, d2, { do: 'sleep' }).state;
  assert.equal(smellOf(cfg, d3).level, 0);
  assert.deepEqual(d3.make.kitchen.cooked, {}, 'what the smell no longer counts is not kept');
  const fan = { ...one, things: { ...one.things, boxfan: true } };
  assert.equal(smellOf(cfg, fan).level, 0);
  assert.ok(!pressureOf(cfg, fan).reasons.some(r => r.kind === 'smell'));
});

test('a made thing can be on you without being for sale: the belt; a police stop takes it', () => {
  const s = kitchen({ zonk: 3 });
  const put = choice(view(cfg, s), c => c.do === 'belt');
  assert.ok(put.available);
  const b = step(cfg, s, put.choice).state;
  assert.deepEqual([b.belt, b.stash.zonk], [{ good: 'zonk', n: 1 }, 2]);
  const out = { ...b, place: 'park', goods: {}, stash: {} };
  assert.ok(!deal(cfg, out).some(j => j.goods), 'never offered for sale');
  assert.ok(view(cfg, b).make.belt);
  const back = step(cfg, b, { do: 'unbelt' }).state;
  assert.deepEqual([back.belt, back.stash.zonk], [null, 3]);
});

test('a product of two or more is named by the player; people say it back; a name is plain words', () => {
  const s = kitchen({ tea: 1, sticks: 1 });
  const r = step(cfg, s, cook(['sticks', 'tea'])).state;
  const n = choice(view(cfg, r), c => c.do === 'name' && c.product === 'disco-coma');
  assert.ok(n);
  const named = step(cfg, r, { ...n.choice, name: 'Swamp Bedtime' }).state;
  assert.equal(productName(cfg, named, 'disco-coma'), 'Swamp Bedtime');
  assert.equal(bookOf(cfg, named, 'kitchen').found.find(f => f.product === 'disco-coma').name, 'Swamp Bedtime');
  const sell = { ...named, place: 'park', goods: { 'disco-coma': 1 } };
  assert.match(view(cfg, sell).options.find(o => o.uses).label, /^Sell Swamp Bedtime to Shaky Dee/);
  assert.throws(() => step(cfg, r, { ...n.choice, name: '' }), /a name is/);
  assert.throws(() => step(cfg, r, { ...n.choice, name: 'x'.repeat(40) }), /a name is/);
  assert.ok(!choice(view(cfg, step(cfg, kitchen(), cook(['tea'])).state), c => c.do === 'name'), 'one thing in the pot: its own name');
});

test('every made thing is a row in what your home is worth: bags at what they sell for, makings at cost', () => {
  const s = { ...at('crib'), stash: { zonk: 2, 'zonk~pukes': 1, tea: 1, smokes: 5 } };
  const w = homeWorth(cfg, s);
  const row = id => w.entries.find(e => e.id === id).value;
  assert.equal(row('stock'), 10, 'the goods bought from a connect');
  assert.equal(row('made'), 3 * 84, 'at the middle of the market crowd\'s $68–100');
  assert.equal(row('makings'), 8);
  assert.ok(view(cfg, s).worth.text.includes('what you made'));
});

test('the shelf and the book are kept by maker; a version-12 save loads with nothing made and plays on', () => {
  assert.equal(RUN_STATE_VERSION, 14); // (bench-1: 14, reading 13 and 12)
  const s = step(cfg, kitchen({ tea: 1 }), cook(['tea'])).state;
  const back = loadRun(saveRun(s));
  assert.ok(back.ok, back.text);
  assert.deepEqual(back.state.make, s.make);
  assert.deepEqual(shelfOf(cfg, back.state, 'kitchen').made.map(m => [m.good, m.home]), [['zonk', 6]]);
  // the fixture: a run saved by the code before this build step (dccd549), mid-season
  const old = loadRun(readFileSync(new URL('./fixtures/run-save-v12.json', import.meta.url), 'utf8'));
  assert.ok(old.ok, old.text);
  assert.deepEqual([old.state.v, old.state.make, old.state.under, old.state.belt, old.state.floor], [14, {}, {}, null, null]);
  let st = old.state;
  for (let i = 0; i < 6; i++) st = step(cfg, st, view(cfg, st).choices.find(c => c.available && c.choice.do !== 'out' || c.available).choice).state;
  assert.ok(checkRunBooks(st).ok);
});

test('in the words a player reads: no "carrier", "maker" or "slice"', () => {
  let s = { ...newRun({ seed: 5, cfg }), things: { hotplate: true }, banked: 60, books: { ...newRun({ cfg }).books, earned: 40, start: 20 } };
  const said = [];
  const go = c => { const r = step(cfg, s, c); s = r.state; said.push(...r.events.map(e => e.text)); };
  go({ do: 'out', take: 30 });
  go({ do: 'making', item: 'tea' });
  go({ do: 'making', item: 'sticks' });
  go({ do: 'inside' });
  const v = view(cfg, s);
  said.push(...v.choices.map(c => c.label), v.pot.text, v.pot.reason.text, ...v.pot.options.flatMap(o => o.lines));
  go(cook(['sticks', 'tea']));
  said.push(...view(cfg, s).choices.map(c => c.label));
  for (const t of said) assert.ok(!/\b(carrier|maker|slice)s?\b/i.test(t), t);
});

test('the scripted cooks play a season, cook, sell and keep their books', async () => {
  const { POLICIES, playSeason } = await import('../src/run/policies.mjs');
  const { POT_COOKS, POT_DAYS } = await import('../src/run/marks.mjs');
  for (const [name, args] of Object.entries(POT_COOKS)) {
    const r = playSeason(cfg, { seed: 7, policy: POLICIES.cook(160, ...args), kit: { hotplate: true }, days: POT_DAYS });
    assert.ok(checkRunBooks(r.state).ok, name);
    assert.ok(r.tally.cooks >= 3, `${name} cooks`);
    assert.ok(r.tally.doses >= 5, `${name} sells`);
  }
  const leaver = playSeason(cfg, { seed: 7, policy: POLICIES.cook(160, ...POT_COOKS.leaver), kit: { hotplate: true }, days: POT_DAYS });
  assert.ok(leaver.tally.cooked.zonk >= 1 && leaver.tally.cooked['disco-rash'] >= 1, 'the leaver cooks both');
});
