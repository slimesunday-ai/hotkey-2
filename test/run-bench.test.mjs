// THE BENCH AND THE BOTTLE (bench-1, RUN.md "The bench and the bottle (bench-1)"): build step 2 of crafting, rules only.
// A workbench from Mr. Pruitt on the trailer's floor spot; dog spray and blue paint from your own street; an hour packs
// three bottles (each, both in one, or a bag from the kitchen); one rides on your belt and is thrown first in any fight of
// several (two who jump you, a crew at your door, the Sixes' two on the kerb), never a one-on-one; dog spray blinds them,
// paint makes them blue for a week, a bag does its own thing lightly; a cloud where the police are about is news. A blue man
// who took something from you is a card where he is: "Take it back off the blue man". The dye pack in your floor safe tags
// whoever gets into it. The page's config has none of it until its screens exist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RUN_CONFIG, BENCH_CONFIG, withRunConfig, newRun, view, step, checkRunBooks, RUN_STATE_VERSION, saveRun, loadRun } from '../src/run/index.mjs';
import { danger, crewOdds, jumpOf, crewOf, bluesAt, placeHeat } from '../src/run/rules.mjs';
import { productById, effectLines, bookOf, shelfOf, smellOf, bottleOn, floorOf, stationOf } from '../src/run/make.mjs';
import { clockOf } from '../src/run/effects.mjs';
import { homeWorth } from '../src/run/raid.mjs';
import { deferTallies } from '../src/run/odds.mjs';

const cfg = BENCH_CONFIG;
function at(place, extra = {}, seed = 1) {
  const s = newRun({ seed, cfg });
  return { ...s, place, energy: 6, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) }, home: { ...s.home, ...(extra.home ?? {}) } };
}
const pack = ins => ({ do: 'cook', maker: 'bench', carrier: 'bottle', with: ins });
const choice = (v, t) => v.choices.find(c => t(c.choice));
const effectLinesOf = id => effectLines(cfg, productById(cfg, id));
/** The crib with the workbench and these at home. */
const benchHome = (stash = { spraycan: 1 }, extra = {}) => at('crib', { things: { workbench: true }, stash, ...extra });
/** At the market with a bottle on the belt, carrying cash (in the books), a jump forced by the rig's next chance. */
function jumpedWith(good, carried = 100, extra = {}) {
  const s = at('market', { belt: good ? { good, n: 1 } : null, hoursThere: 2, ...extra });
  return { ...s, carried, books: { ...s.books, earned: s.books.earned + carried }, rig: { chances: [0] } };
}

test('off on the page: the page plays a config with none of the bench in it, and nothing of it is listed there', () => {
  assert.equal(RUN_CONFIG.bench, false);
  assert.equal(RUN_CONFIG.make.makers.bench, undefined);
  assert.equal(RUN_CONFIG.things.workbench, undefined);
  assert.equal(RUN_CONFIG.things.dyepack, undefined);
  assert.ok(!Object.values(RUN_CONFIG.goods).some(g => g.kind === 'bottle' || g.kind === 'filling'));
  const s = { ...newRun({ cfg: RUN_CONFIG }), place: 'park', carried: 200 };
  const v = view(RUN_CONFIG, s);
  assert.equal(v.making, undefined);
  assert.equal(v.blue, undefined);
  assert.ok(!v.choices.some(c => /workbench|dog spray|blue paint|dye pack/i.test(c.label)));
  // and with it in, the bench is one more maker, its fillings one more kind, its bottle one more kind the belt takes
  assert.equal(cfg.bench, true);
  assert.deepEqual(Object.keys(cfg.make.makers), ['kitchen', 'bench']);
  assert.deepEqual(cfg.make.belt.takes, ['bag', 'bottle']);
  const C = cfg.make.makers.bench.carriers.bottle;
  assert.deepEqual([C.takes, C.slots, C.alone, C.gives, C.n, C.hours], [['filling', 'bag'], 2, ['bag'], 'bottle', 3, 1]);
});

test('what goes in: dog spray from Cousin Earl\'s truck ($8), blue paint from Mr. Pruitt ($5); the workbench $60 from Mr. Pruitt', () => {
  let s = { ...at('park'), carried: 100, books: { ...newRun({ cfg }).books, earned: 100 } };
  const v = view(cfg, s);
  const spray = choice(v, c => c.do === 'making' && c.item === 'spraycan');
  const paint = choice(v, c => c.do === 'making' && c.item === 'painttin');
  const bench = choice(v, c => c.do === 'get' && c.item === 'workbench');
  assert.match(spray.label, /dog spray from Cousin Earl \(\$8\)/);
  assert.match(paint.label, /blue paint from Mr\. Pruitt \(\$5\)/);
  assert.match(bench.label, /a workbench \(\$60\)/);
  for (const c of [spray, paint, bench]) s = step(cfg, s, c.choice).state;
  assert.equal(s.carried, 100 - 8 - 5 - 60);
  assert.equal(s.goods.spraycan, 1);
  assert.equal(s.things.workbench, true);
  assert.ok(checkRunBooks(s).ok);
});

test('an hour at the bench packs three bottles: each filling, both in one, a bag from the kitchen; no smell, no odds; the book gets its pages', () => {
  const s0 = benchHome({ spraycan: 1, painttin: 1, zonk: 2 });
  const v = view(cfg, s0);
  const opts = v.making.bench.options;
  assert.deepEqual(opts.map(o => o.product), ['paint', 'spray-paint', 'spray', 'zonk-bottle']);
  assert.deepEqual(opts.map(o => o.odds.text), opts.map(() => 'Comes out as packed'));
  assert.match(choice(v, c => c.do === 'cook' && c.with?.[0] === 'zonk').label, /^Pack Zonked in a bottle \(a bag of Zonked\): 3 bottles, an hour/);
  let r = step(cfg, s0, pack(['painttin', 'spraycan']));
  assert.equal(r.state.stash['spray-paint'], 3);
  assert.equal(r.state.energy, 5);
  assert.equal(r.state.hour, s0.hour + 1);
  assert.equal(smellOf(cfg, r.state).level, 0, 'packing does not smell');
  assert.match(r.events[0].text, /You packed blue paint and dog spray: 3 bottles of Dog Spray and Blue Paint\. New in your book: name it what you like\./);
  assert.equal(r.events[0].scene.action, 'bench_clamp');
  assert.equal(r.events[0].scene.seconds, 3.5);
  // a pack of two is the player's to name
  r = step(cfg, r.state, { do: 'name', product: 'spray-paint', name: 'Smurf Tears' });
  assert.equal(shelfOf(cfg, r.state, 'bench').made[0].name, 'Smurf Tears');
  // a bag in a bottle: one bag, three bottles, in the book as found
  r = step(cfg, { ...r.state, energy: 5 }, pack(['zonk']));
  assert.equal(r.state.stash.zonk, 1);
  assert.equal(r.state.stash['zonk-bottle'], 3);
  const book = bookOf(cfg, r.state, 'bench');
  assert.deepEqual([book.tried, book.of], [1, 3]);
  assert.deepEqual(book.found.map(f => f.product).sort(), ['spray-paint', 'zonk-bottle']);
  assert.ok(checkRunBooks(r.state).ok);
});

test('the floor spot: one piece stands there; both owned, changing them over is an hour; the hot plate is on the counter and never leaves', () => {
  // (in this build only the workbench stands on the floor spot: the stove comes in a later step)
  const s = benchHome({ spraycan: 1, tea: 1 }, { things: { workbench: true, hotplate: true } });
  assert.deepEqual(floorOf(cfg, s), { pieces: ['workbench'], standing: 'workbench' });
  assert.ok(stationOf(cfg, s, 'kitchen').works && stationOf(cfg, s, 'bench').works);
  // the rule itself, with a second floor piece (the hot plate put on the floor spot for the test)
  const c2 = withRunConfig({ things: { hotplate: { floor: true } } }, cfg);
  const s2 = { ...s, floor: 'hotplate' };
  assert.deepEqual(floorOf(c2, s2), { pieces: ['hotplate', 'workbench'], standing: 'hotplate' });
  assert.ok(!stationOf(c2, s2, 'bench').works);
  const v = view(c2, s2);
  assert.match(choice(v, c => c.do === 'cook' && c.maker === 'bench').why, /not on the floor spot/);
  assert.equal(v.making.bench.floor.standing, 'hotplate');
  const move = choice(v, c => c.do === 'floor' && c.item === 'workbench');
  assert.ok(move.available);
  const r = step(c2, s2, move.choice);
  assert.equal(r.state.floor, 'workbench');
  assert.equal(r.state.hour, s2.hour + 1);
  assert.ok(stationOf(c2, r.state, 'bench').works && !stationOf(c2, r.state, 'kitchen').works);
});

test('the belt: a bottle on it, never in your pockets; at home it counts in what your home is worth', () => {
  const s0 = benchHome({ spray: 3, smokes: 2 });
  let r = step(cfg, s0, { do: 'belt', good: 'spray' });
  assert.deepEqual(r.state.belt, { good: 'spray', n: 1 });
  assert.match(choice(view(cfg, s0), c => c.do === 'belt').label, /thrown first when several of them come at you/);
  const w = homeWorth(cfg, r.state).entries.find(e => e.id === 'made');
  assert.equal(w.value, Math.round(2 * cfg.make.makings.spraycan.price / 3));
  r = step(cfg, r.state, { do: 'out', take: 0 });
  assert.deepEqual(r.state.goods, { smokes: 2 }, 'the bottles left at home stay there');
  assert.equal(bottleOn(cfg, r.state).name, 'Dog Spray');
  assert.deepEqual(view(cfg, r.state).make.belt.bottle.fight, { blind: 3 });
});

test('the throw: dog spray, thrown in the first second at both who jump you, blind 3 s; the odds shown before had it; a cloud where the police are about is news', () => {
  const s = jumpedWith('spray');
  const d = danger(cfg, s);
  const b = d.jump.fight.bottle;
  assert.equal(b.product, 'spray');
  assert.ok(b.seeOff > b.without, `with ${b.seeOff}, without ${b.without}`);
  assert.equal(d.jump.fight.seeOff, b.seeOff);
  assert.match(d.jump.fight.text, /a bottle of Dog Spray thrown first: all of them blind 3 seconds/);
  assert.equal(jumpOf(cfg, s, 'market').inputs.blind, 3);
  assert.equal(jumpOf(cfg, s, 'market', { bottle: null }).inputs.blind, undefined);
  const heat0 = placeHeat(s, 'market');
  const r = step(cfg, s, { do: 'job', id: 'stall' });
  const e = r.events.find(x => x.type === 'jumped');
  assert.equal(e.bottle.product, 'spray');
  assert.equal(e.duel.inputs.blind, 3);
  assert.equal(r.state.belt, null, 'thrown: off your belt');
  assert.match(e.text, /^You threw a bottle of Dog Spray: blind 3 seconds\./);
  assert.deepEqual([e.scene.bottle.action, e.scene.bottle.cloud, e.scene.bottle.blind], ['throw', 'orange', 3]);
  // the market is patrolled: the cloud is news
  assert.equal(placeHeat(r.state, 'market'), heat0 + 1);
  assert.ok(checkRunBooks(r.state).ok);
});

test('never in a one-on-one: a job gone wrong to their face is a fight with the bottle left on your belt', () => {
  let s = { ...at('park', { belt: { good: 'spray', n: 1 } }), rig: { chances: [99] } };
  const job = view(cfg, s).options.find(o => o.fight);
  assert.ok(job, 'a job whose going wrong is a fight');
  const r = step(cfg, s, job.choice);
  const e = r.events.find(x => x.duel);
  assert.ok(e && !e.duel.jumped && !e.bottle);
  assert.equal(e.duel.inputs.blind, undefined);
  assert.deepEqual(r.state.belt, { good: 'spray', n: 1 });
});

test('a bag in a bottle does its own thing, lightly: Zonked the first of them asleep 3 s; Disco Rash all of them dancing 4 s at half speed; Disco Coma one then the other, sharing the bag', () => {
  const inp = g => jumpOf(cfg, { ...at('market'), belt: { good: g, n: 1 } }, 'market').inputs;
  assert.deepEqual(inp('zonk-bottle').asleep, { n: 1, s: 3 });
  assert.deepEqual(inp('disco-rash-bottle').slow, { s: 4, by: 0.5 });
  assert.deepEqual([inp('disco-coma-bottle').slow, inp('disco-coma-bottle').asleep], [{ s: 2, by: 0.5 }, { n: 1, s: 1.5, at: 2 }]);
  // (a mix shares the bag between its turns, and its words say so)
  assert.deepEqual(effectLinesOf('disco-coma-bottle'), ['All of them dancing 2 seconds: half speed', 'then the first of them asleep 1.5 seconds']);
  assert.equal(inp('paint').blind, undefined, 'paint does nothing for today\'s fight');
  const zonk = danger(cfg, { ...jumpedWith('zonk-bottle') }).jump.fight.bottle;
  assert.ok(zonk.seeOff > zonk.without);
  assert.equal(productById(cfg, 'disco-coma-bottle').name, 'Disco Coma in a bottle');
});

test('paint: the two who jump you are blue for a week at their usual place; the one who has what they took is a card there; all of it back, once; a splash of paint is no news', () => {
  // (the first seed on which they beat you and take something)
  let s, r, e;
  for (let seed = 1; seed < 60; seed++) {
    s = { ...jumpedWith('paint', 200), seed, energy: 2 };
    r = step(cfg, s, { do: 'job', id: 'stall' });
    e = r.events.find(x => x.type === 'jumped');
    if (e.outcome === 'clean' || e.outcome === 'messy') break;
  }
  assert.ok(e.outcome === 'clean' || e.outcome === 'messy', `they took something (${e.outcome})`);
  assert.equal(e.blue.rows.length, 2);
  assert.ok(e.blue.rows[0].took && !e.blue.rows[1].took);
  assert.equal(e.blue.rows[0].untilDay, s.day + 7);
  assert.match(e.text, /Take it back off the blue man there: all of what they took\./);
  assert.equal(e.bottle.heat, 0, 'paint alone changes no fight: no heat');
  // the next day, at the market, rested: the card
  const next = { ...r.state, place: 'market', day: r.state.day, hour: 14, energy: 6, rig: undefined };
  const v = view(cfg, next);
  const card = choice(v, c => c.do === 'takeBack');
  assert.match(card.label, /^Take it back off the blue man \(you win about \d+ in 10: \$\d+/);
  assert.equal(card.back.cash, e.taken);
  assert.deepEqual(card.back.goods, e.goodsTaken);
  assert.ok(v.blue.length === 2 && v.blue[0].here);
  assert.deepEqual(v.places.find(p => p.place === 'market').under.map(x => [x.effect, x.n]), [['tagged', 2]]);
  r = step(cfg, next, card.choice);
  const t = r.events.find(x => x.type === 'takeBack');
  assert.equal(t.duel.blue, true);
  if (t.result === 'won') assert.equal(r.state.carried, next.carried + e.taken);
  assert.equal(choice(view(cfg, r.state), c => c.do === 'takeBack'), undefined, 'once');
  assert.ok(view(cfg, r.state).blue[0].tried);
  assert.ok(checkRunBooks(r.state).ok);
  // a week on, the blue is gone
  let st = { ...r.state, place: 'crib' };
  for (let d = 0; d < 8; d++) st = step(cfg, { ...st, place: 'crib' }, { do: 'sleep' }).state;
  assert.equal(Object.values(st.under ?? {}).flat().filter(x => x.effect === 'tagged').length, 0);
});

test('a crew at your door: the bottle is thrown at them; with paint, he and his friend are blue at his usual place', () => {
  const s0 = at('crib', { belt: { good: 'spray-paint', n: 1 }, day: 3, home: { raid: { who: { id: 'npc:neighbour:2', name: 'Mr. Pruitt', role: 'neighbour' }, why: 'against', day: 3, hour: 20, warned: 2, started: null, kind: 'crew' } }, banked: 300 });
  const s = { ...s0, books: { ...s0.books, start: 300 } };
  const o = crewOdds(cfg, s);
  assert.ok(o.bottle && o.bottle.win >= o.bottle.without, `the door fight with ${o.bottle.win}, without ${o.bottle.without}`);
  assert.equal(crewOf(cfg, s).inputs.blind, 3);
  const r = step(cfg, s, { do: 'sleep' });
  const e = r.events.find(x => x.type === 'raid' && x.kind === 'crew');
  assert.equal(e.bottle.at, 'crew');
  assert.equal(e.duel.inputs.blind, 3);
  assert.equal(r.state.belt, null);
  assert.equal(e.blue.rows.length, 2);
  assert.equal(e.blue.rows[0].place, 'park');
  assert.equal(e.blue.rows[0].who.name, 'Mr. Pruitt');
  assert.ok(checkRunBooks(r.state).ok);
});

test('the Sixes\' two on the kerb: the bottle is thrown at them', () => {
  const sx = { marks: [{ why: 'refuse', n: 7, day: 2, text: 'x' }], did: 2, word: 2, made: 0, madeDay: null, taxDay: null, tax: null, jump: { day: 3, warned: 2 }, jumps: [], streak: 0, streakDay: null, raid: null, raids: [], truce: null, raidLast: null };
  const s = at('market', { day: 3, belt: { good: 'spray', n: 1 }, sixes: sx });
  const r = step(cfg, s, { do: 'subway', to: 'park', hop: true });
  const e = r.events.find(x => x.type === 'jumped' && x.sixes);
  assert.equal(e.bottle.at, 'sixes');
  assert.equal(e.duel.inputs.blind, 3);
  assert.equal(r.state.belt, null);
});

test('the dye pack: in your floor safe, whoever gets into it comes out blue, and it is spent; no bench needed', () => {
  const s0 = at('jail', { day: 3, things: { floorsafe: true, dyepack: true }, home: { raid: { who: { id: 'npc:debtor', name: 'Benny Two-Coats', role: 'debtor' }, why: 'against', day: 3, hour: 20, warned: 2, started: null, kind: 'crew' } }, banked: 400, rig: { chances: [0] } });
  const s = { ...s0, books: { ...s0.books, start: 400 } };
  const r = step(cfg, s, { do: 'morning' });
  const e = r.events.find(x => x.type === 'raid' && x.kind === 'crew');
  assert.ok(e.gotIn);
  assert.equal(e.blue.item, 'dyepack');
  assert.match(e.blue.text, /The dye pack in your safe went off/);
  assert.equal(r.state.things.dyepack, undefined, 'spent');
  assert.deepEqual(e.blue.rows.map(x => x.place), ['park', 'park']);
  assert.ok(e.blue.rows[0].took.cash > 0);
  // without the floor safe it does nothing
  const r2 = step(cfg, { ...s, things: { dyepack: true } }, { do: 'morning' });
  assert.equal(r2.events.find(x => x.type === 'raid').blue, undefined);
});

test('the throw\'s odds go through the background path: on the page a bottle\'s figure waits, never played on its thread', () => {
  const asked = [];
  // (a state no count of which is kept yet: Dog Spray against the docks' jumpers, tired, with quick hands)
  const s = { ...jumpedWith('spray'), place: 'docks', energy: 1, styles: { jab: true }, fightWith: 'jab' };
  deferTallies((key, job) => asked.push({ key, job }));
  try {
    const b = danger(cfg, s).jump.fight.bottle;
    assert.ok(Number.isNaN(b.seeOff));
    assert.ok(asked.some(a => a.job.inputs.blind === 3), 'the count with the bottle is asked for');
  } finally {
    deferTallies(null);
  }
});

test('saves: version 14; a version-13 save (made by the code before this step) loads with nothing on the floor spot chosen, and plays on', () => {
  assert.equal(RUN_STATE_VERSION, 14);
  const s = step(cfg, benchHome({ spraycan: 1 }), pack(['spraycan'])).state;
  const back = loadRun(saveRun({ ...s, floor: 'workbench' }), cfg);
  assert.ok(back.ok, back.text);
  assert.equal(back.state.floor, 'workbench');
  const text = readFileSync(new URL('./fixtures/run-save-v13.json', import.meta.url), 'utf8');
  for (const c of [RUN_CONFIG, cfg]) {
    const old = loadRun(text, c);
    assert.ok(old.ok, old.text);
    assert.deepEqual([old.state.v, old.state.floor, old.state.belt], [14, null, { good: 'disco-coma', n: 1 }]);
    let st = old.state;
    for (let i = 0; i < 40; i++) {
      const v = view(c, st);
      st = step(c, st, (v.choices.find(x => x.available && !['out', 'subway'].includes(x.choice.do)) ?? v.choices.find(x => x.available)).choice).state;
    }
    assert.ok(checkRunBooks(st).ok);
  }
});

test('in the words a player reads: no "carrier", "maker", "slice", "station", no ids', () => {
  const said = [];
  let s = { ...at('park'), carried: 120, books: { ...newRun({ cfg }).books, earned: 120 } };
  const go = c => { const r = step(cfg, s, c); s = r.state; said.push(...r.events.map(e => e.text)); };
  said.push(...view(cfg, s).choices.map(c => c.label));
  go({ do: 'get', item: 'workbench' });
  go({ do: 'making', item: 'spraycan' });
  go({ do: 'making', item: 'painttin' });
  go({ do: 'inside' });
  const v = view(cfg, s);
  said.push(...v.choices.map(c => c.label), v.making.bench.text, v.making.bench.reason.text, ...v.making.bench.options.flatMap(o => o.lines));
  go(pack(['painttin']));
  go({ do: 'belt', good: 'paint' });
  said.push(...view(cfg, s).choices.map(c => c.label));
  s = jumpedWith('paint', 150);
  go({ do: 'job', id: 'stall' });
  for (const t of said) {
    assert.ok(!/\b(carrier|maker|slice|station)s?\b/i.test(t), t);
    assert.ok(!/spraycan|painttin|spray-paint|zonk-bottle|workbench\b(?! \()|bench_clamp/.test(t.replace(/a workbench/g, '')), t);
  }
});

test('the bottle player plays a season with each fill and keeps its books', async () => {
  const { POLICIES, playSeason } = await import('../src/run/policies.mjs');
  for (const fill of [['spraycan'], ['painttin'], ['painttin', 'spraycan']]) {
    const r = playSeason(cfg, { seed: 4, policy: POLICIES.bottler(160, fill), kit: { workbench: true }, days: 8 });
    assert.ok(checkRunBooks(r.state).ok, fill.join('+'));
    assert.ok(r.tally.benchPacks >= 1, `${fill} packs`);
    assert.ok(r.tally.throws >= 1, `${fill} throws`);
  }
});
