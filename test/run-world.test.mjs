// Rules-2, the world answers (RUN.md, "The world answers"): heat that belongs to a place, robbing somebody passing,
// the bins, picking the target, regulars at your door, energy with stakes (sleeping rough, the drink), a place's shop,
// and what a place has to use up today.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, withRunConfig, newRun, view, step, checkRunBooks, deal } from '../src/run/index.mjs';
import { heatHere, supplyLeft } from '../src/run/rules.mjs';
import { choiceForKey, viewText } from '../src/run/text.mjs';

const cfg = RUN_CONFIG;
// nobody jumps you and the police never stop you: an hour's own result, with nothing after it
const CALM = withRunConfig({ jump: { basePct: 0, perHourPct: 0, perStepPct: 0 }, police: { perHeat: 0 } });

function at(place, extra = {}, seed = 1, c = cfg) {
  const s = newRun({ seed, cfg: c });
  return { ...s, place, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) }, books: { ...s.books, ...(extra.books ?? {}) } };
}
const carrying = (state, amount) => ({ ...state, carried: amount, books: { ...state.books, earned: state.books.earned + amount } });
/** A state at `place` whose hour deals job `id`. */
function dealtAt(c, place, id, extra = {}, seed = 1) {
  for (let hour = 12; hour < 80; hour++) {
    const s = at(place, { energy: 6, ...extra, hour }, seed, c);
    if (deal(c, s).some(j => j.id === id)) return s;
  }
  throw new Error(`${id} never dealt at ${place}`);
}
const move = (v, what) => v.choices.find(c => c.choice.do === what);

test('world: a job heats you and the place; heat here is the higher of the two; the view says which place is hot', () => {
  const s = { ...dealtAt(CALM, 'market', 'till'), rig: { chances: [0] } };
  const { state, events } = step(CALM, s, { do: 'job', id: 'till' });
  const ev = events.find(e => e.type === 'job');
  assert.equal(ev.outcome, 'win');
  assert.equal(state.heat, 1);
  assert.equal(state.placeHeat.market, 1);
  assert.equal(ev.placeHeat, 1);
  // a hot market and a cool you: heat here is the market's; the police are about and stop you from 3
  const hot = at('market', { heat: 0, placeHeat: { market: 4 } });
  const v = view(cfg, hot);
  assert.equal(v.heat, 4);
  assert.equal(v.heatHere, 4);
  assert.equal(v.heatYours, 0);
  assert.equal(v.danger.thisHour.stop.chance, 40);
  const market = v.places.find(p => p.place === 'market');
  assert.deepEqual([market.heat, market.hot, market.police, market.here], [4, true, true, true]);
  assert.match(market.text, /^The flea market is hot today \(heat 4\): the police are about\.$/);
  assert.match(viewText(v), /The city: .*The flea market is hot today/);
  // the market's heat stays at the market: in the trailer park only yours counts, and nobody stops you there
  const park = view(cfg, { ...hot, place: 'park' });
  assert.equal(park.heat, 0);
  assert.equal(park.danger.here, false);
  // the trailer park patrols nothing until it is hot itself: your heat 5 alone is nothing there
  assert.equal(view(cfg, at('park', { heat: 5 })).danger.here, false);
  const hotPark = view(cfg, at('park', { heat: 0, placeHeat: { park: 3 } }));
  assert.equal(hotPark.danger.here, true);
  assert.equal(hotPark.danger.thisHour.jump.chance, 0, 'nobody jumps you in the trailer park, even hot');
  assert.equal(hotPark.danger.thisHour.stop.chance, 20);
  assert.ok(hotPark.places.find(p => p.place === 'park').police);
  // in the crib, the park's heat is where you stand
  assert.equal(heatHere(cfg, at('crib', { placeHeat: { park: 2 } })), 2);
});

test('world: places cool by their tier every night, wherever you slept; your own heat only at home; a stop clears that place', () => {
  let s = at('crib', { heat: 2, placeHeat: { park: 3, market: 4 } });
  ({ state: s } = step(cfg, s, { do: 'sleep' }));
  assert.deepEqual([s.heat, s.placeHeat.park, s.placeHeat.market], [1, 3 - cfg.tiers.quiet.cool, 4 - cfg.tiers.rough.cool]);
  // a night on the street: the places cool, you do not
  const out = step(CALM, at('market', { heat: 2, energy: 0, placeHeat: { market: 4 }, rig: { chances: [99] } }), { do: 'rough' }).state;
  assert.deepEqual([out.heat, out.placeHeat.market], [2, 2]);
  // stopped at a hot market: jail, your heat 1, and the market quiet again
  const st = { ...carrying(dealtAt(cfg, 'market', 'stall', { placeHeat: { market: 4 } }), 30), rig: { chances: [0] } };
  const jailed = step(cfg, st, { do: 'job', id: 'stall' });
  assert.deepEqual(jailed.events.map(e => e.type), ['job', 'stopped', 'jail']);
  assert.equal(jailed.state.heat, cfg.heat.afterJail);
  assert.equal(jailed.state.placeHeat.market, 0);
});

test('world: robbing somebody passing needs the box cutter, pays, heats only the place, and gets harder there', () => {
  const v0 = view(cfg, at('market'));
  const rob0 = move(v0, 'rob');
  assert.equal(rob0.available, false);
  assert.match(rob0.why, /the box cutter/);
  assert.throws(() => step(cfg, at('market'), { do: 'rob' }), /box cutter/);
  const s = { ...at('market', { owned: { cutter: true } }, 1, CALM), rig: { chances: [0] } };
  const v = view(CALM, s);
  const rob = move(v, 'rob');
  assert.equal(rob.available, true);
  assert.deepEqual([rob.what, rob.odds, rob.pay, rob.winHeat, rob.failHeat, rob.left], ['rob', 70, [50, 80], 1, 2, 3]);
  let { state, events } = step(CALM, s, { do: 'rob' });
  const ev = events.find(e => e.type === 'rob');
  assert.equal(ev.outcome, 'win');
  assert.ok(ev.pay >= 50 && ev.pay <= 80);
  assert.equal(ev.who, null, 'nobody you know');
  assert.equal(ev.scene.kind, 'rob:clean');
  assert.deepEqual([state.heat, state.placeHeat.market, state.energy, state.hour], [0, 1, 5, s.hour + 1]);
  assert.equal(supplyLeft(CALM, state, 'market', 'strangers'), 2);
  assert.equal(move(view(CALM, state), 'rob').odds, 60, 'a hot street has fewer worth trying: −10 for each heat');
  assert.ok(checkRunBooks(state).ok);
  // in the quiet trailer park a robbery is news: +2, and a failure +3 makes it hot with the police about
  const p = step(cfg, { ...at('park', { owned: { cutter: true } }), rig: { chances: [99] } }, { do: 'rob' });
  assert.equal(p.events[0].outcome, 'fail');
  assert.equal(p.state.placeHeat.park, 3);
  assert.equal(p.events[0].scene.kind, 'rob:fail');
  assert.ok(view(cfg, p.state).places.find(x => x.place === 'park').hot);
});

test('world: what a place has to use up is the place\'s, drawn down and refilled each morning at its own rate', () => {
  const s0 = newRun({ seed: 3, cfg });
  assert.deepEqual(s0.supply, { park: { strangers: 2, bins: 3, custom: 2 }, market: { strangers: 3, bins: 4 } });
  let s = at('park', { energy: 9, owned: { cutter: true } }, 1, CALM);
  for (let i = 0; i < 2; i++) s = step(CALM, { ...s, placeHeat: {} }, { do: 'rob' }).state;
  const v = view(CALM, { ...s, placeHeat: {} });
  assert.equal(move(v, 'rob').available, false);
  assert.match(move(v, 'rob').why, /nobody worth robbing/);
  assert.deepEqual(v.places.find(p => p.place === 'park').supply.strangers, { left: 0, max: 2, refill: 1 });
  s = step(CALM, { ...s, place: 'crib' }, { do: 'sleep' }).state;
  assert.equal(s.supply.park.strangers, 1, 'one more a morning, not all of them');
  s = step(CALM, s, { do: 'sleep' }).state;
  assert.equal(s.supply.park.strangers, 2);
  s = step(CALM, s, { do: 'sleep' }).state;
  assert.equal(s.supply.park.strangers, 2, 'never above the place\'s max');
});

test('world: the bins cost an hour and an energy, rarely pay, and a neighbour who sees you thinks less of you', () => {
  // the find roll 99: the rare real find; the seen roll 0: a neighbour saw it
  const s = { ...at('park', { energy: 6 }), rig: { chances: [99, 0] } };
  const v = view(cfg, s);
  const bins = move(v, 'bins');
  assert.equal(bins.available, true);
  assert.deepEqual(bins.finds.map(f => f.pct), [50, 45, 5]);
  const { state, events } = step(cfg, s, { do: 'bins' });
  const ev = events[0];
  assert.deepEqual([ev.type, ev.find, ev.scene.action], ['bins', 'find', 'rummage']);
  assert.ok(ev.pay >= 12 && ev.pay <= 20);
  assert.equal(ev.seen.role, 'neighbour');
  assert.equal(ev.mood, 'cold');
  assert.match(ev.text, /saw you and thinks less of you today\.$/);
  assert.deepEqual([state.energy, state.hour, state.supply.park.bins], [5, s.hour + 1, 2]);
  const after = view(cfg, state);
  assert.equal(after.people.find(p => p.id === ev.seen.id).mood, 'cold');
  // they skip their turn at the odd job while anyone else is left
  let t = state;
  for (let i = 0; i < 4; i++) {
    const safe = deal(cfg, t)[0];
    assert.notEqual(safe.who.id, ev.seen.id);
    t = step(cfg, { ...t, energy: 6 }, { do: 'job', id: safe.id }).state;
  }
  // at the market: the roll 0 is nothing at all, and no one there minds
  const m = step(CALM, { ...at('market', {}, 1, CALM), rig: { chances: [0] } }, { do: 'bins' });
  assert.deepEqual([m.events[0].find, m.events[0].pay, m.events[0].money.length, m.events[0].seen], ['nothing', 0, 0, null]);
  // picked clean
  const clean = view(cfg, at('park', { supply: { park: { strangers: 2, bins: 0, custom: 2 } } }));
  assert.equal(move(clean, 'bins').available, false);
  assert.match(move(clean, 'bins').why, /picked clean/);
});

test('world: a dealt job lists who it could be done to; the choice may name one, otherwise it is the one dealt', () => {
  const s = dealtAt(CALM, 'market', 'till');
  const o = view(CALM, s).options.find(x => x.id === 'till');
  assert.ok(o.targets.length >= 2, 'more than one stallholder free');
  assert.deepEqual(o.targets[0].id, o.who.id);
  const other = o.targets[1];
  const { state, events } = step(CALM, { ...s, rig: { chances: [0] } }, { do: 'job', id: 'till', who: other.id });
  const ev = events.find(e => e.type === 'job');
  assert.equal(ev.who.id, other.id);
  assert.equal(ev.picked, true);
  assert.equal(ev.chance, o.odds, 'the odds do not change with the target');
  assert.ok(ev.pay >= o.pay[0] && ev.pay <= o.pay[1], 'nor the pay');
  assert.equal(state.people[other.id].out, true);
  assert.equal(state.people[o.who.id], undefined, 'the dealt one is left alone');
  assert.throws(() => step(CALM, s, { do: 'job', id: 'till', who: 'npc:nobody' }), /not npc:nobody this hour/);
  // a target already in another option this hour is not offered twice
  const v = view(CALM, s);
  const ids = v.options.map(x => x.who.id);
  for (const x of v.options) assert.ok(x.targets.slice(1).every(t => !ids.includes(t.id)));
  // the terminal: N@T
  const key = v.options.find(x => x.id === 'till').key;
  assert.deepEqual(choiceForKey(v, `${key}@2`).choice, { do: 'job', id: 'till', who: other.id });
  assert.match(choiceForKey(v, `${key}@9`).error, /no target 9/);
});

test('world: a regular keeps count and pays more; past a point they turn up at your door, and you give or refuse', () => {
  const dee = 'npc:buyer:projects:1';
  let s = { ...dealtAt(cfg, 'park', 'loosies', { goods: { smokes: 5 } }), regulars: { [dee]: 2 } };
  const o = view(cfg, s).options.find(x => x.id === 'loosies');
  assert.equal(o.who.id, dee);
  assert.deepEqual(o.pay, cfg.jobs.park.loosies.pay.map(x => x + 2 * cfg.regulars.payUp), 'a regular pays more as they get hooked');
  const sold = step(cfg, { ...s, rig: { chances: [0] } }, { do: 'job', id: 'loosies' });
  assert.equal(sold.state.regulars[dee], 3);
  assert.equal(sold.events[0].regular.sold, 3);
  assert.match(sold.events[0].text, /Shaky Dee has had 3 from you and may come to your door for more\. 4 left on you\.$/);
  assert.equal(sold.state.supply.park.custom, 1, 'the place\'s custom is drawn on');
  // the next morning, the door roll 0: Dee is at the door
  s = { ...at('crib', { regulars: { [dee]: 3 } }), rig: { chances: [0] } };
  let r = step(cfg, s, { do: 'sleep' });
  const door = r.events.find(e => e.type === 'door');
  assert.ok(door, 'at the door');
  assert.equal(door.scene.action, 'crave');
  assert.ok(door.wants >= 6 && door.wants <= 12);
  const v = view(cfg, r.state);
  assert.match(v.door.text, /^Shaky Dee is at your door wanting more/);
  assert.deepEqual(v.choices.filter(c => c.what === 'door').map(c => c.choice.do), ['give', 'refuse']);
  assert.match(viewText(v), /Shaky Dee is at your door/);
  // give: from banked, counted as spent at the door; their count drops by one; they go friendly
  const gave = step(cfg, r.state, { do: 'give' });
  assert.equal(gave.state.banked, r.state.banked - door.wants);
  assert.deepEqual([gave.state.books.spent, gave.state.books.door], [door.wants, door.wants]);
  assert.equal(gave.state.regulars[dee], 3 - cfg.regulars.giveEases);
  assert.equal(gave.state.door, null);
  assert.ok(checkRunBooks(gave.state).ok);
  // refuse, and they swing at you (the fight roll 0, the contest roll 10: a clean win of theirs)
  const fought = step(cfg, { ...r.state, rig: { chances: [0], rolls: [10] } }, { do: 'refuse' });
  assert.deepEqual(fought.events.map(e => e.type), ['refused', 'fight']);
  assert.equal(fought.events[1].scene.kind, 'fight:clean');
  assert.equal(fought.state.energy, r.state.energy - cfg.regulars.hurt.clean);
  // refuse, and they hold a grudge: out for two days, and the police come round the trailer park
  const grudge = step(cfg, { ...r.state, rig: { chances: [99] } }, { do: 'refuse' });
  assert.equal(grudge.events[1].type, 'grudge');
  assert.equal(grudge.state.placeHeat.park, cfg.regulars.grudgeHeat);
  const out = s2 => view(cfg, s2).people.find(p => p.id === dee);
  assert.equal(out(grudge.state).outToday, true);
  assert.equal(out(grudge.state).regular.grudgeDays, 2);
  const next = step(cfg, grudge.state, { do: 'sleep' }).state;
  assert.equal(out(next).outToday, true);
  assert.equal(out(step(cfg, next, { do: 'sleep' }).state).outToday, false);
  // walking out past them refuses them
  const past = step(cfg, { ...r.state, rig: { chances: [99] } }, { do: 'out', take: 0 });
  assert.deepEqual(past.events.map(e => e.type), ['refused', 'grudge', 'out']);
  assert.equal(past.events[0].how, 'past');
  // nobody comes before doorAt sales
  assert.ok(!step(cfg, { ...at('crib', { regulars: { [dee]: 2 } }), rig: { chances: [0] } }, { do: 'sleep' }).events.some(e => e.type === 'door'));
});

test('world: energy has stakes: stay out to nothing and sleep rough, likelier robbed, and wake there low', () => {
  // at 1 you may still work; at 0 away from home the day can only end there
  const one = view(CALM, at('market', { energy: 1 }, 1, CALM));
  assert.ok(one.options.every(o => o.available));
  const zero = view(CALM, at('market', { energy: 0 }, 1, CALM));
  assert.deepEqual(zero.choices.filter(c => c.available).map(c => c.choice.do), ['rough']);
  assert.match(zero.stranded.text, /^Out of energy at the flea market: sleep rough here/);
  assert.equal(move(view(cfg, at('park')), 'rough'), undefined, 'not at home\'s door: you go inside');
  // robbed in the night (the chance roll 0, the contest roll 10: asleep, they win clean and take it all)
  const s = { ...carrying(at('market', { energy: 0, placeHeat: { market: 3 }, heat: 2 }), 90), rig: { chances: [0], rolls: [10] } };
  const { state, events } = step(cfg, s, { do: 'rough' });
  assert.deepEqual(events.map(e => e.type), ['rough', 'robbed', 'morning']);
  assert.equal(events[0].scene.kind, 'night:sleep');
  assert.equal(events[1].scene.kind, 'night:robbed');
  assert.equal(events[1].chance, cfg.tiers.rough.roughPct);
  assert.equal(events[1].contest.P, cfg.jump.strength + cfg.rough.strength);
  assert.equal(events[1].taken, 90);
  assert.equal(events[2].night, 'street');
  assert.deepEqual([state.place, state.day, state.hour, state.energy, state.carried], ['market', 2, 12, cfg.energy.mattress - cfg.energy.roughMorning, 0]);
  assert.deepEqual([state.heat, state.placeHeat.market], [2, 3 - cfg.tiers.rough.cool]);
  assert.ok(checkRunBooks(state).ok);
  // not robbed: what you carry is still on you, and you must get it home
  const kept = step(cfg, { ...s, rig: { chances: [99] } }, { do: 'rough' }).state;
  assert.equal(kept.carried, 90);
  assert.ok(view(cfg, kept).choices.some(c => c.available && c.choice.do === 'subway' && c.choice.to === 'park'));
});

test('world: the market sells one energy drink a day, from what you carry: one more hour', () => {
  const s = carrying(at('market', { energy: 1 }), 12);
  const v = view(cfg, s);
  assert.deepEqual(v.shopHere.map(x => [x.item, x.price, x.perDay, x.left]), [['drink', 5, 1, 1]]);
  const { state, events } = step(cfg, s, { do: 'shop', item: 'drink' });
  assert.deepEqual([state.energy, state.carried, state.books.spent, state.books.street, state.hour], [2, 7, 5, 5, s.hour]);
  assert.equal(events[0].type, 'shop');
  assert.ok(checkRunBooks(state).ok);
  const again = view(cfg, state).shopHere[0];
  assert.deepEqual([again.available, again.left], [false, 0]);
  assert.match(again.why, /1 a day/);
  assert.match(move(view(cfg, carrying(at('market', { energy: 6 }), 12)), 'shop').why, /full/);
  assert.match(move(view(cfg, at('market', { energy: 1 })), 'shop').why, /you carry \$0/);
  // stranded at 0 with the price on you: the drink is the way home
  const stuck = view(cfg, carrying(at('market', { energy: 0 }), 9));
  // (and the errands that cost no hour: a thing off the rail you can pay for)
  assert.deepEqual(stuck.choices.filter(c => c.available && c.choice.do !== 'get').map(c => c.choice.do).sort(), ['rough', 'shop']);
  assert.equal(choiceForKey(stuck, 'd').choice.item, 'drink');
});

test('world: the scripted players use the new moves and get through whole seasons', async () => {
  const { POLICIES, playSeason } = await import('../src/run/policies.mjs');
  const h = POLICIES.homeAt(120);
  const used = {};
  for (const [name, policy, kit] of [
    ['mixed', POLICIES.mixed(120), { cutter: true }], ['rough', { ...h, rough: true }, {}], ['drink', { ...h, drink: true }, {}],
    ['bins', { ...POLICIES.park, bins: true }, {}], ['moving', { ...h, robPlan: { park: 1, market: 1 } }, { cutter: true }],
    ['lean', { ...POLICIES.park, regular: 'lean', door: 'refuse' }, {}], ['park', POLICIES.park, { cutter: true }],
  ]) {
    for (const seed of [1, 2, 3]) {
      const r = playSeason(cfg, { seed, policy, kit, days: 10 });
      assert.equal(r.takes.length, 10);
      assert.ok(checkRunBooks(r.state).ok);
      for (const [k, n] of Object.entries(r.tally)) used[`${name}:${k}`] = (used[`${name}:${k}`] ?? 0) + n;
    }
  }
  for (const k of ['mixed:robs', 'rough:rough', 'drink:drinks', 'bins:bins', 'moving:robs', 'lean:door', 'park:robs']) assert.ok(used[k] > 0, `${k} never happened`);
});

test('world: a place\'s shop is data: an item added to the list is shown, sold and limited without a rule naming it', () => {
  const c = withRunConfig({ places: { market: { shop: [...cfg.places.market.shop, { item: 'coffee', label: 'A coffee', price: 2, does: 'Energy +1', perDay: 2, gives: { energy: 1 } }] } } });
  let s = carrying(at('market', { energy: 1 }, 1, c), 20);
  assert.deepEqual(view(c, s).shopHere.map(x => x.item), ['drink', 'coffee']);
  for (let i = 0; i < 2; i++) s = step(c, { ...s, energy: 1 }, { do: 'shop', item: 'coffee' }).state;
  assert.equal(view(c, { ...s, energy: 1 }).shopHere[1].available, false);
  const bad = withRunConfig({ places: { market: { shop: [{ item: 'charm', label: 'A charm', price: 1, does: '?', gives: { luck: 1 } }] } } });
  assert.throws(() => step(bad, carrying(at('market', { energy: 1 }, 1, bad), 5), { do: 'shop', item: 'charm' }), /nothing knows how to give luck/);
});
