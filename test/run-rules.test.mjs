import test from 'node:test';
import assert from 'node:assert/strict';
import { rng, pick } from '../src/rng.mjs';
import { KINDS, ACTIONS } from '../src/stage.mjs';
import { CITY } from '../src/map.mjs';
import { CONFIG } from '../src/config.mjs';
import {
  RUN_CONFIG, withRunConfig, newRun, copyRun, view, listChoices, step, checkRunBooks, danger, deal, jobOdds, morningEnergy,
} from '../src/run/index.mjs';
import { POLICIES, playSeason } from '../src/run/policies.mjs';

const cfg = RUN_CONFIG;
// RUN.md's starting numbers for the danger, pinned, so tuning the shipped config never breaks the arithmetic tested
const START = withRunConfig({
  jump: { basePct: 4, perHourPct: 4, perDollars: 20, perStepPct: 1, capPct: 45, strength: 55, cutter: 15, takePct: { clean: 100, messy: 50 }, pocketFinds: 50 },
  energy: { mattress: 6, bed: 10, tiredAt: 2, tiredOdds: 15, tiredJump: 10, clinicMorning: 3, jailMorning: 2, minMorning: 1 },
  police: { from: 3, perHeat: 15 },
  subway: { fare: 2, hopCaughtPct: 25, hopHeat: 1 },
  heat: { afterJail: 1 },
  start: { cash: 20 },
});
const bytes = x => JSON.stringify(x);

/** A run standing somewhere in a known state. */
function at(place, extra = {}, seed = 1) {
  const s = newRun({ seed, cfg });
  return { ...s, place, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) }, books: { ...s.books, ...(extra.books ?? {}) } };
}
/** Carrying money that came from pay, so the books still balance. */
const carrying = (state, amount) => ({ ...state, carried: amount, books: { ...state.books, earned: state.books.earned + amount } });

/** A monkey: random legal choices, from the view only. */
function monkey(seed, steps = 400, kit = {}) {
  let state = newRun({ seed, cfg });
  state.owned = { ...state.owned, ...kit };
  const r = rng(seed, 'monkey');
  const trail = [];
  for (let i = 0; i < steps; i++) {
    const legal = view(cfg, state).choices.filter(c => c.available);
    assert.ok(legal.length, `no legal choice at ${state.place}`);
    const c = pick(r, legal).choice;
    const choice = c.do === 'out' ? { ...c, take: Math.floor(r() * (state.banked + 1)) } : c;
    const out = step(cfg, state, choice);
    trail.push({ choice, events: out.events });
    state = out.state;
    const books = checkRunBooks(state);
    assert.ok(books.ok, `books off at step ${i}: ${bytes(books)}`);
    assert.ok(state.energy >= 0 && state.heat >= 0 && state.heat <= cfg.heat.max);
  }
  return { state, trail };
}

test('the run: same seed and same choices, same game byte for byte; another seed, another game', () => {
  const a = monkey(5);
  const b = monkey(5);
  assert.equal(bytes(a), bytes(b));
  // replaying the first game's choices on a fresh state gives the same states and events
  let state = newRun({ seed: 5, cfg });
  for (const t of a.trail) {
    const out = step(cfg, state, t.choice);
    assert.equal(bytes(out.events), bytes(t.events));
    state = out.state;
  }
  assert.equal(bytes(state), bytes(a.state));
  assert.notEqual(bytes(monkey(6).trail.map(t => t.events)), bytes(a.trail.map(t => t.events)));
});

test('the run: state is plain JSON and step never changes its input', () => {
  let state = newRun({ seed: 2, cfg });
  for (let i = 0; i < 200; i++) {
    const before = bytes(state);
    assert.deepEqual(JSON.parse(before), state);
    const c = view(cfg, state).choices.find(x => x.available);
    const out = step(cfg, state, c.choice);
    assert.equal(bytes(state), before);
    state = out.state;
  }
});

test('the run: monkeys never crash and every dollar is accounted for, every step, in every kit', () => {
  for (const [seed, kit] of [[1, {}], [2, { pocket: true }], [3, { cutter: true }], [4, { bed: true }], [7, { pocket: true, cutter: true, bed: true }]]) {
    const { state, trail } = monkey(seed, 600, kit);
    const b = state.books;
    assert.equal(b.start + b.earned - b.jumped - b.seized - b.fares - b.spent - b.burgled, state.carried + state.banked); // (home-1: burgled, out of what was banked)
    // every dollar moved in an event adds up to the books
    const moved = { earned: 0, jumped: 0, seized: 0, fares: 0, spent: 0, burgled: 0 };
    for (const t of trail) for (const e of t.events) for (const m of e.money ?? []) {
      if (m.from === 'pay') moved.earned += m.amount;
      else if (moved[m.to] !== undefined) moved[m.to] += m.amount;
    }
    assert.deepEqual(moved, { earned: b.earned, jumped: b.jumped, seized: b.seized, fares: b.fares, spent: b.spent, burgled: b.burgled });
    assert.ok(state.day > 3, `a monkey got through only ${state.day} days`);
  }
});

test('the run: the deal is the safe job first and two drawn from what you are able to do', () => {
  const seen = { park: new Set(), market: new Set() };
  for (let hour = 12; hour < 22; hour++) for (const place of ['park', 'market']) {
    const s = at(place, { hour, goods: { smokes: 9, discs: 9 } }); // (goods on you: the selling jobs are in the pool)
    const d = deal(cfg, s);
    assert.equal(d.length, 3);
    assert.ok(d[0].safe);
    assert.equal(new Set(d.map(j => j.id)).size, 3);
    assert.ok(!d.some(j => j.id === 'stickup'), 'no stick-up without the box cutter');
    d.forEach(j => seen[place].add(j.id));
    assert.equal(bytes(deal(cfg, s)), bytes(d)); // the same hour deals the same three
  }
  assert.deepEqual([...seen.park].sort(), ['collect', 'loosies', 'odd', 'wallet']);
  assert.deepEqual([...seen.market].sort(), ['crowd', 'stall', 'till', 'wallet']);
  let stickups = 0;
  for (let hour = 12; hour < 40; hour++) if (deal(cfg, at('market', { hour, owned: { cutter: true } })).some(j => j.id === 'stickup')) stickups++;
  assert.ok(stickups > 5, 'stick-ups appear with the box cutter');
});

test('the run: the odds shown are the odds rolled, for jobs, the jumping and the police', () => {
  let checked = { job: 0, jumped: 0, stopped: 0 };
  for (let seed = 1; seed <= 300; seed++) {
    let state = carrying(at('market', { heat: 3 + (seed % 3), energy: 6 }, seed), seed % 200);
    for (let i = 0; i < 4 && state.place === 'market'; i++) {
      const v = view(cfg, state);
      const job = v.options.find(o => o.available && !o.sure && (seed + i) % 2) ?? v.options.find(o => o.available);
      if (!job) break;
      const { state: next, events } = step(cfg, state, job.choice);
      const ev = events.find(e => e.type === 'job');
      if (!job.sure) {
        assert.equal(ev.chance, job.odds);
        checked.job++;
      }
      const stop = events.find(e => e.type === 'stopped');
      if (stop) {
        assert.equal(stop.chance, v.danger.thisHour.stop.chance);
        checked.stopped++;
      }
      const jumped = events.find(e => e.type === 'jumped');
      if (jumped) {
        assert.equal(jumped.chance, v.danger.thisHour.jump.chance);
        assert.equal(jumped.contest.P, v.danger.thisHour.jump.strength);
        checked.jumped++;
      }
      state = next;
    }
  }
  assert.ok(checked.job > 100 && checked.jumped > 20 && checked.stopped > 20, bytes(checked));
});

test('the run: the danger rises with hours there and money carried, and is visible', () => {
  const s = carrying(at('market', { hoursThere: 2 }), 65);
  const d = danger(START, s);
  assert.equal(d.jump.chance, 4 + 4 * 2 + 3); // 4%, +4% an hour already there, +1% for every $20
  const v = view(START, s);
  assert.equal(v.danger.thisHour.jump.chance, 15);
  assert.equal(v.danger.oneMore.jump.chance, 19);
  assert.equal(v.danger.thisHour.jump.strength, 55);
  assert.deepEqual(v.danger.thisHour.jump.bands, { clean: 35, messy: 20, fail: 20, disaster: 25 });
  assert.deepEqual(v.danger.thisHour.jump.takes, { bad: 65, scuffle: 33 });
  assert.equal(danger(START, carrying(at('market', { hoursThere: 30 }), 900)).jump.chance, 45); // at most 45%
  // the box cutter makes them weaker, being tired stronger; the contest clamp still holds
  assert.equal(danger(START, at('market', { owned: { cutter: true } })).jump.strength, 40);
  assert.equal(danger(START, at('market', { energy: 2 })).jump.strength, 65);
  assert.equal(danger(START, at('market', {}), {}).jump.strength, 55);
  const strong = withRunConfig({ jump: { strength: 200 } });
  assert.equal(danger(strong, at('market', {})).jump.strength, CONFIG.contest.max);
  // the inside pocket halves what they find
  assert.deepEqual(danger(START, carrying(at('market', { owned: { pocket: true } }), 80)).jump.takes, { bad: 40, scuffle: 20 });
  // police: none below heat 3, then (heat − 2) × 15%
  assert.deepEqual([0, 2, 3, 4, 5].map(heat => danger(START, at('market', { heat })).stop.chance), [0, 0, 15, 30, 45]);
  // nowhere else
  for (const place of ['crib', 'park']) {
    assert.equal(danger(START, carrying(at(place, { heat: 5, hoursThere: 3 }), 500)).jump.chance, 0);
    assert.equal(view(START, at(place, { heat: 5 })).danger.here, false);
  }
});

test('the run: jumped, a bad one takes it all and ends the day in the clinic; a scuffle half; the pocket hides half', () => {
  const work = (extra, rig) => {
    const s = carrying({ ...at('market', extra), rig }, 100);
    return step(START, s, { do: 'job', id: 'stall' });
  };
  // chances: the jump hits (roll 0); rolls: the contest roll. P 55: clean below 35, messy below 55.
  let { state, events } = work({}, { chances: [0], rolls: [10] });
  const pay = events.find(e => e.type === 'job').pay;
  assert.equal(events.find(e => e.type === 'jumped').taken, 100 + pay);
  assert.equal(state.carried, 0);
  assert.equal(state.place, 'clinic');
  assert.deepEqual(events.map(e => e.type), ['job', 'jumped', 'clinic']);
  assert.equal(events.find(e => e.type === 'jumped').scene.kind, 'npc:robbers:clean');
  ({ state } = step(START, state, { do: 'morning' }));
  assert.equal(state.place, 'crib');
  assert.equal(state.energy, 3); // the mattress's 6, three lower
  ({ state, events } = work({}, { chances: [0], rolls: [40] }));
  assert.equal(state.carried, (100 + pay) - Math.round((100 + pay) / 2));
  assert.equal(state.place, 'market');
  ({ state, events } = work({}, { chances: [0], rolls: [60] }));
  assert.equal(state.carried, 100 + pay);
  assert.equal(events.find(e => e.type === 'jumped').scene.kind, 'npc:robbers:fail');
  ({ state, events } = work({ owned: { pocket: true } }, { chances: [0], rolls: [10] }));
  const kept = (100 + pay) - Math.round((100 + pay) / 2);
  assert.equal(state.carried, kept);
  assert.equal(state.place, 'clinic');
  ({ state } = step(START, state, { do: 'morning' }));
  assert.equal(state.banked, START.start.cash + kept); // what the pocket kept goes home with you
  assert.ok(checkRunBooks(state).ok);
});

test('the run: stopped by the police, what you carry is seized, the day ends in jail, heat 1, tomorrow 2 lower', () => {
  const s = { ...carrying(at('market', { heat: 4 }), 70), rig: { chances: [0] } };
  let { state, events } = step(START, s, { do: 'job', id: 'stall' });
  assert.deepEqual(events.map(e => e.type), ['job', 'stopped', 'jail']);
  assert.equal(events[1].chance, 30);
  assert.equal(state.carried, 0);
  assert.equal(state.books.seized, 70 + events[0].pay);
  assert.equal(state.heat, 1);
  assert.deepEqual(view(START, state).choices.map(c => c.choice.do), ['morning']);
  ({ state, events } = step(START, state, { do: 'morning' }));
  assert.equal(state.energy, 4);
  assert.equal(state.heat, 1); // heat drops only after a night at home
  assert.equal(events[0].scene.kind, 'release:jail');
  assert.ok(checkRunBooks(state).ok);
  // the bed after jail, and the floor of 1
  assert.equal(morningEnergy(START, at('jail', { owned: { bed: true } }), 'jail'), 8);
  assert.equal(morningEnergy(withRunConfig({ energy: { clinicMorning: 9 } }), at('clinic'), 'clinic'), 1);
});

test('the run: the subway is an hour and an energy, the fare from what you carry or the turnstile hopped', () => {
  let s = at('park');
  let v = view(START, s);
  const pay = v.choices.find(c => c.choice.do === 'subway' && c.choice.to === 'market' && !c.choice.hop);
  assert.equal(pay.available, false); // carrying nothing: only the hop
  assert.match(pay.why, /hop/);
  assert.throws(() => step(START, s, pay.choice), /hop/);
  // the hop: caught (roll 0 < 25) is heat +1, and the arriving hour rolls no danger
  let { state, events } = step(START, { ...s, rig: { chances: [0, 0, 0] } }, { do: 'subway', to: 'market', hop: true });
  assert.equal(state.place, 'market');
  assert.equal(state.heat, 1);
  assert.equal(state.energy, 5);
  assert.equal(state.hour, 13);
  assert.equal(state.hoursThere, 0);
  assert.deepEqual(state.rig.chances, [0, 0]); // only the hop rolled
  assert.deepEqual(events.map(e => e.type), ['hop', 'ride']);
  // paying: $2 out of what you carry
  ({ state, events } = step(START, { ...s, carried: 5, banked: 15 }, { do: 'subway', to: 'market', hop: false }));
  assert.equal(state.carried, 3);
  assert.equal(state.books.fares, 2);
  // heading home: the leaving hour is still an hour there and rolls the danger first
  const leaving = { ...carrying(at('market', { hoursThere: 2, heat: 3 }), 40), rig: { chances: [99, 0], rolls: [50] } };
  ({ state, events } = step(START, leaving, { do: 'subway', to: 'park', hop: false }));
  assert.deepEqual(events.map(e => e.type), ['jumped', 'fare', 'ride']);
  assert.equal(events[0].chance, 4 + 8 + 2);
  assert.equal(state.place, 'park');
  assert.equal(state.carried, 40 - 20 - 2); // a scuffle took half, then the fare
  assert.equal(state.hoursThere, 0);
  // the corner is on the map and locked
  v = view(START, at('park'));
  const corner = v.choices.find(c => c.choice.to === 'corner');
  assert.equal(corner.available, false);
  assert.equal(corner.why, 'held by the Sixes');
  assert.deepEqual(v.corner, { label: 'the corner', locked: true, why: 'held by the Sixes', block: 'corner' });
  assert.ok(v.subway.find(x => x.stop === 'corner').locked);
  assert.throws(() => step(START, at('park', { energy: 6 }), corner.choice), /Sixes/);
  // too tired to get there and back
  assert.equal(view(cfg, at('park', { energy: 1 })).choices.find(c => c.choice.to === 'market').available, false);
});

test('the run: tired is energy 2 or less: odds 15 lower, a sure job stays sure; at 1 in the market you may stay (rules-2), at 0 only the street', () => {
  const tired = at('market', { energy: 2 });
  const v = view(cfg, tired);
  assert.equal(v.tired, true);
  for (const o of v.options) assert.equal(o.odds, o.sure ? 100 : cfg.jobs.market[o.id].odds - cfg.energy.tiredOdds);
  assert.equal(jobOdds(cfg, at('market', { energy: 3 }), { odds: 60 }).pct, 60);
  // (the first test sent you home at energy 1 here; rules-2 lets you stay and pay for it: test/run-world.test.mjs)
  const spent = view(cfg, at('market', { energy: 1 }));
  assert.ok(spent.options.every(o => o.available));
  assert.ok(spent.choices.some(c => c.available && c.choice.do === 'subway' && c.choice.to === 'park'));
  const out = view(cfg, at('market', { energy: 0 }));
  assert.deepEqual(out.choices.filter(c => c.available).map(c => c.choice.do), ['rough']);
  assert.ok(out.options.every(o => o.why === 'no energy left'));
});

test('the run: going inside banks everything and costs no hour; you can go out again; buying, done, and play goes on', () => {
  let state = carrying(at('park', { hour: 15, energy: 4 }), 300);
  let events;
  ({ state, events } = step(cfg, state, { do: 'inside' }));
  assert.equal(state.place, 'crib');
  assert.equal(state.hour, 15);
  assert.equal(state.energy, 4);
  assert.equal(state.banked, 320);
  assert.equal(events[0].scene.action, 'stash');
  for (const item of ['pocket', 'cutter']) ({ state } = step(cfg, state, { do: 'buy', item }));
  assert.equal(view(cfg, state).done, null);
  ({ state, events } = step(cfg, state, { do: 'buy', item: 'bed' }));
  assert.equal(state.banked, 320 - 40 - 90 - 150);
  assert.deepEqual(events.map(e => e.type), ['buy', 'done']);
  assert.equal(view(cfg, state).done.text, 'done in 1 day');
  assert.equal(view(cfg, state).energyMax, 10); // the bed counts from the next morning
  assert.throws(() => step(cfg, state, { do: 'buy', item: 'bed' }), /owned/);
  ({ state } = step(cfg, state, { do: 'out', take: 7 }));
  assert.equal(state.place, 'park');
  assert.equal(state.carried, 7);
  ({ state } = step(cfg, state, { do: 'inside' }));
  ({ state } = step(cfg, state, { do: 'sleep' }));
  assert.equal(state.day, 2);
  assert.equal(state.energy, 10);
  assert.equal(state.doneDay, 1);
  assert.ok(view(cfg, state).choices.some(c => c.available && c.choice.do === 'out'));
  assert.ok(checkRunBooks(state).ok);
});

test('the run: the view says why every choice is or is not available, and lists them all', () => {
  for (const s of [at('crib'), at('park'), at('market'), at('clinic'), at('jail'), at('park', { energy: 0 }), at('crib', { energy: 0 })]) {
    const v = view(cfg, s);
    assert.ok(v.choices.length);
    v.choices.forEach((c, i) => {
      assert.equal(c.key, String(i + 1));
      assert.ok(c.label);
      if (!c.available) assert.ok(c.why, `${c.label} needs a why`);
    });
    for (const o of v.options) {
      for (const field of ['label', 'odds', 'pay', 'energy', 'why']) assert.ok(o[field] !== undefined, field);
      assert.ok('ifFail' in o);
    }
  }
  const crib = view(cfg, at('crib'));
  assert.deepEqual(crib.shop.map(x => [x.item, x.price]), [['pocket', 40], ['cutter', 90], ['bed', 150]]);
  assert.deepEqual(view(cfg, at('crib', { energy: 0 })).choices.filter(c => c.available).map(c => c.choice.do), ['sleep']);
  assert.deepEqual(view(cfg, at('park', { energy: 0 })).choices.filter(c => c.available).map(c => c.choice.do), ['inside']);
  assert.equal(listChoices(cfg, at('market')).length, view(cfg, at('market')).choices.length);
});

test('the run: every event carries a scene the stage already has, at a block on the city map', () => {
  for (const seed of [1, 2, 3]) {
    const { trail } = monkey(seed, 500, seed === 3 ? { cutter: true } : {});
    for (const t of trail) for (const e of t.events) {
      assert.ok(e.scene, `${e.type} has no scene`);
      const s = e.scene;
      if (s.kind) assert.ok(KINDS[s.kind], `unknown scene kind ${s.kind}`);
      if (s.action) assert.ok(ACTIONS.includes(s.action), `unknown action ${s.action}`);
      if (s.ride) assert.ok(['subway', 'foot', 'skate'].includes(s.ride), `unknown ride ${s.ride}`); // (routes-1: demo/stage/rides plays all three)
      assert.ok(s.kind || s.action || s.ride || s.notice, `${e.type}: empty scene`);
      if (e.block) assert.ok(CITY.blocks[e.block], `unknown block ${e.block}`);
      for (const k of ['type', 'text', 'day', 'hour', 'place']) assert.ok(e[k] !== undefined, `${e.type} lacks ${k}`);
    }
  }
  assert.ok(CITY.blocks.corner.rivalTurf);
});

test('the run: the scripted players get through whole seasons on the real engine', () => {
  for (const policy of [POLICIES.park, POLICIES.stall, POLICIES.homeAt(90), POLICIES.reckless]) {
    const r = playSeason(cfg, { seed: 11, policy, days: 6 });
    assert.equal(r.takes.length, 6);
    assert.equal(r.state.day, 7);
    assert.ok(checkRunBooks(r.state).ok);
  }
  const buyer = playSeason(cfg, { seed: 11, policy: { ...POLICIES.homeAt(90), buy: true }, until: s => s.doneDay !== null });
  assert.ok(buyer.state.doneDay >= 2 && buyer.state.doneDay < 20);
  assert.ok(copyRun(buyer.state).owned.bed);
});
