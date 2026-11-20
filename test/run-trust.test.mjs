// Trust (RUN.md, "Trust"): one number per person, kept across nights, in three bands. It moves both ways and drifts
// back; against you, a person is off your table and may call in what you do at their place; with you, they see
// nothing and a job with them pays more; it is local to the place they belong to; an older save loads neutral.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, withRunConfig, newRun, view, step, deal, checkRunBooks } from '../src/run/index.mjs';
import { isAround, offDays, tellRisk, trustOf } from '../src/run/rules.mjs';
import { POLICIES, playSeason } from '../src/run/policies.mjs';
import { viewText } from '../src/run/text.mjs';

const cfg = RUN_CONFIG;
const T = cfg.trust;
// nobody jumps you and the police never stop you: an hour's own result, with nothing after it
const CALM = withRunConfig({ jump: { basePct: 0, perHourPct: 0, perStepPct: 0 }, police: { perHeat: 0 } });
const OKAFOR = 'npc:stallholder:2';
const ALVAREZ = 'npc:neighbour';
const DEE = 'npc:buyer:projects:1';

function at(place, extra = {}, seed = 1, c = cfg) {
  const s = newRun({ seed, cfg: c });
  return { ...s, place, energy: 6, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) } };
}
/** A state at `place` whose hour deals job `id` (and passes `ok`, if given). */
function dealtAt(c, place, id, extra = {}, ok = () => true, seed = 1) {
  for (let hour = 12; hour < 200; hour++) {
    const s = at(place, { ...extra, hour }, seed, c);
    if (deal(c, s).some(j => j.id === id) && ok(s)) return s;
  }
  throw new Error(`${id} never dealt at ${place}`);
}
const everyone = (v, id) => v.trust.find(p => p.id === id);

test('trust: it moves up for work and sales, down for taking from people, and rides on the event that moved it', () => {
  // the stall: +1 for the shopkeeper you worked for
  const s = dealtAt(CALM, 'market', 'stall');
  const stall = step(CALM, s, { do: 'job', id: 'stall' });
  const ev = stall.events.find(e => e.type === 'job');
  assert.equal(ev.trust.change, 1);
  assert.deepEqual([ev.trust.from, ev.trust.to, ev.trust.band, ev.trust.at, ev.trust.cause], [0, 1, 'neutral', 'market', 'job']);
  assert.equal(trustOf(stall.state, ev.who.id), 1);
  assert.match(ev.trust.text, /trusts you more \(trust \+1\)/);
  // a till grabbed to their face: down to the bottom, against you, off your table two days
  const t = { ...dealtAt(CALM, 'market', 'till'), rig: { chances: [0] } };
  const till = step(CALM, t, { do: 'job', id: 'till' });
  const te = till.events.find(e => e.type === 'job');
  assert.deepEqual([te.trust.to, te.trust.band, te.trust.bandWas, te.trust.offDays], [T.min, 'against', 'neutral', 2]);
  assert.match(te.trust.text, /is against you now \(trust −3\).*Won't deal with you, 2 days/);
  const v = view(CALM, till.state);
  assert.deepEqual(['against', -3, 2, "won't deal with you, 2 days"], ['band', 'trust', 'offDays', 'offText'].map(k => everyone(v, te.who.id)[k]));
  assert.ok(v.trustHere.offTable.some(p => p.id === te.who.id && p.days === 2));
  assert.match(viewText(v), /Won't deal with you at the Jay St night market: .*\(2 days\)/);
  // a sale that went wrong moves nothing; a wallet lifted clean moves nothing (they do not know yet)
  const crowd = step(CALM, { ...dealtAt(CALM, 'market', 'crowd', { goods: { discs: 4 } }), rig: { chances: [99] } }, { do: 'job', id: 'crowd' });
  assert.equal(crowd.events.find(e => e.type === 'job').trust, undefined);
  // giving at your door: +1
  const crib = at('crib');
  const door = { ...crib, banked: 50, books: { ...crib.books, start: 50 }, door: { id: DEE, name: 'Shaky Dee', role: 'buyer', place: 'park', wants: 8 } };
  const gave = step(cfg, door, { do: 'give' });
  assert.equal(gave.events[0].trust.change, T.give);
  assert.ok(checkRunBooks(gave.state).ok);
});

test('trust: every morning it drifts a step back toward neutral, said in one event', () => {
  const s = at('crib', { trust: { [ALVAREZ]: 2, [OKAFOR]: -3, [DEE]: 1 } });
  const { state, events } = step(cfg, s, { do: 'sleep' });
  assert.deepEqual(state.trust, { [ALVAREZ]: 1, [OKAFOR]: -2 });
  const drift = events.find(e => e.type === 'drift');
  assert.equal(drift.changes.length, 3);
  assert.deepEqual(drift.changes.map(c => [c.who.id, c.from, c.to]).sort(), [[ALVAREZ, 2, 1], [DEE, 1, 0], [OKAFOR, -3, -2]].sort());
  assert.match(drift.text, /Mrs\. Alvarez is no longer with you/);
  assert.equal(events.findIndex(e => e.type === 'morning'), 1, 'the morning first, then the drift');
  // good will holds while you keep it up: someone with you, dealt with today, is still with you tomorrow
  const fr = dealtAt(CALM, 'market', 'stall', { trust: { 'npc:shop:market': 2, 'npc:shop:market:2': 2 } });
  const worked = step(CALM, fr, { do: 'job', id: 'stall' });
  const id = worked.events[0].who.id;
  const other = id === 'npc:shop:market' ? 'npc:shop:market:2' : 'npc:shop:market';
  const after = step(CALM, { ...worked.state, place: 'crib' }, { do: 'sleep' }).state;
  assert.deepEqual([trustOf(after, id), trustOf(after, other)], [3, 1], 'kept up: holds (and +1 for the shift); not seen: fades');
  // two more nights and the stallholder will deal with you again
  const next = step(cfg, step(cfg, state, { do: 'sleep' }).state, { do: 'sleep' });
  assert.equal(trustOf(next.state, OKAFOR), 0);
  assert.equal(offDays(cfg, next.state, OKAFOR), 0);
});

test('trust: against you, a person is never dealt: not as the person, not as a target, never a card that is then refused', () => {
  const c = CALM;
  const s0 = at('market', { owned: { cutter: true }, trust: { [OKAFOR]: -3 } }, 1, c);
  let tills = 0;
  for (let hour = 12; hour < 120; hour++) {
    const v = view(c, { ...s0, hour });
    for (const o of v.options) {
      assert.notEqual(o.who?.id, OKAFOR);
      assert.ok(!o.targets.some(t => t.id === OKAFOR));
      if (o.id === 'till' || o.id === 'stickup') tills++;
      assert.ok(o.available);
    }
    // naming him anyway is not a choice
    const till = v.options.find(o => o.id === 'till');
    if (till) assert.throws(() => step(c, { ...s0, hour }, { do: 'job', id: 'till', who: OKAFOR }), /not npc:stallholder:2 this hour/);
  }
  assert.ok(tills > 10, 'the other stallholders are still dealt');
  // everyone of the safe job's role against you: the stall is still dealt, unnamed, and pays
  const both = at('market', { trust: { 'npc:shop:market': -3, 'npc:shop:market:2': -3 } }, 1, c);
  const safe = view(c, both).options[0];
  assert.deepEqual([safe.id, safe.who, safe.label], ['stall', null, 'Work a stall for the shopkeeper']);
  const r = step(c, both, safe.choice);
  assert.equal(r.events[0].outcome, 'win');
  assert.equal(r.events[0].trust, undefined);
  // one of them against you: the rota passes them over
  const one = at('market', { trust: { 'npc:shop:market': -3 } }, 1, c);
  for (let i = 0; i < 4; i++) assert.equal(deal(c, { ...one, shifts: { market: i } })[0].who.id, 'npc:shop:market:2');
});

test('trust: someone against you who is about may call in a crime done at their place: the heat lands on that place only', () => {
  const c = CALM;
  const around = s => isAround(c, s, OKAFOR);
  const s = dealtAt(c, 'market', 'wallet', { trust: { [OKAFOR]: -3 } }, around);
  const v = view(c, s);
  const o = v.options.find(x => x.id === 'wallet');
  assert.equal(o.tellRisk.pct, T.tellPct);
  assert.deepEqual(o.tellRisk.by.map(p => p.id), [OKAFOR]);
  assert.equal(v.trustHere.tellRisk.pct, T.tellPct);
  assert.equal(everyone(v, OKAFOR).around, true);
  assert.equal(v.options[0].tellRisk, null, 'the stall cannot be told on');
  // the lift works (roll 0) and he calls it in (roll 0): no heat from the lift, tellHeat on the market from the call
  const { state, events } = step(c, { ...s, placeHeat: { park: 1 }, rig: { chances: [0, 0] } }, o.choice);
  const w = events.find(e => e.type === 'witness');
  assert.deepEqual([w.called, w.who.id, w.at, w.heat, w.chance], [true, OKAFOR, 'market', T.tellHeat, o.tellRisk.pct]);
  assert.match(w.text, /saw it and called the police: heat \+2 at the Jay St night market\./);
  assert.equal(state.placeHeat.market, T.tellHeat);
  assert.equal(state.placeHeat.park, 1, 'the park is untouched');
  assert.equal(state.heat, 0, 'your own heat is untouched: a call heats the place');
  assert.equal(w.notice, undefined, 'you are standing there: no notice');
  // he keeps quiet (roll 99): said, and nothing heated
  const quiet = step(c, { ...s, rig: { chances: [0, 99] } }, o.choice);
  const q = quiet.events.find(e => e.type === 'witness');
  assert.deepEqual([q.called, q.heat, quiet.state.placeHeat.market ?? 0], [false, 0, 0]);
  // not about this hour: no risk shown, no roll
  const away = dealtAt(c, 'market', 'wallet', { trust: { [OKAFOR]: -3 } }, x => !around(x));
  const ov = view(c, away).options.find(x => x.id === 'wallet');
  assert.equal(ov.tellRisk.pct, 0);
  assert.ok(!step(c, { ...away, rig: { chances: [0] } }, ov.choice).events.some(e => e.type === 'witness'));
  // the bins are low: seen and called the same way
  const bins = dealtAt(c, 'market', 'stall', { trust: { [OKAFOR]: -3 } }, around);
  const b = step(c, { ...bins, rig: { chances: [0, 0] } }, { do: 'bins' });
  assert.ok(b.events.some(e => e.type === 'witness' && e.called));
});

test('trust: with you, a witness sees nothing, and a job with them pays more', () => {
  // the bins seen (roll 0) by a neighbour who is with you: they look away; no mood, no trust lost, no call
  const all = { [ALVAREZ]: 3, 'npc:neighbour:2': 3, 'npc:neighbour:3': 3 };
  const s = { ...at('park', { trust: all }), rig: { chances: [99, 0] } };
  const { state, events } = step(cfg, s, { do: 'bins' });
  const e = events[0];
  assert.equal(e.lookedAway, true);
  assert.equal(e.mood, null);
  assert.equal(e.trust, undefined);
  assert.match(e.text, /saw you and looked away: they are with you\.$/);
  assert.deepEqual(state.trust, all);
  assert.ok(!events.some(x => x.type === 'witness'));
  // the same, neutral: thinks less of you, trust −1
  const n = step(cfg, { ...at('park'), rig: { chances: [99, 0] } }, { do: 'bins' }).events[0];
  assert.deepEqual([n.mood, n.trust.change, n.lookedAway], ['cold', T.seenBins, false]);
  // a stall for a shopkeeper with you pays withPay × the tier's pay more
  const fr = dealtAt(CALM, 'market', 'stall', { trust: { 'npc:shop:market': 3, 'npc:shop:market:2': 3 } });
  const o = view(CALM, fr).options[0];
  const up = T.withPay * cfg.tiers.rough.pay;
  assert.equal(o.withPay, up);
  assert.deepEqual(o.pay, cfg.jobs.market.stall.pay.map(x => x + up));
  const pay = step(CALM, fr, o.choice).events[0].pay;
  assert.ok(pay >= o.pay[0] && pay <= o.pay[1]);
});

test('trust: the grudge is a refusal that leaves a regular against you; refused when they were with you, no grudge', () => {
  const door = extra => ({ ...at('crib', extra), banked: 50, regulars: { [DEE]: 3 }, door: { id: DEE, name: 'Shaky Dee', role: 'buyer', place: 'park', wants: 8 } });
  // neutral, refused, no swing (roll 99): against you, off the table two days, the police round the park
  const g = step(cfg, { ...door(), rig: { chances: [99] } }, { do: 'refuse' });
  assert.deepEqual(g.events.map(e => e.type), ['refused', 'grudge']);
  const [refused, grudge] = g.events;
  assert.deepEqual([refused.trust.to, refused.trust.band, refused.trust.offDays], [T.min, 'against', 2]);
  // (memory-1: the door shut on him is remembered for the week: no sales to him while it lasts)
  assert.deepEqual([grudge.days, grudge.at, grudge.heat, grudge.called], [cfg.memory.days, 'park', cfg.regulars.grudgeHeat, true]);
  assert.equal(g.state.placeHeat.park, cfg.regulars.grudgeHeat);
  assert.equal(view(cfg, g.state).people.find(p => p.id === DEE).regular.grudgeDays, 2);
  // a call at a place you are not standing in: a notice, with what to do
  assert.equal(grudge.notice.place, 'park');
  assert.match(grudge.notice.text, /^The trailer park is at heat 2: 1 more and the police are about there\. Keep it clean there today, or work the Jay St night market\.$/);
  assert.equal(grudge.notice.suggest.place, 'market');
  // he is not at the door while he holds it
  const morning = step(cfg, { ...g.state, rig: { chances: [0] } }, { do: 'sleep' });
  assert.ok(!morning.events.some(e => e.type === 'door'));
  // with you (+3) before you refused: sore, no grudge, no heat
  const s = step(cfg, { ...door({ trust: { [DEE]: 3 } }), rig: { chances: [99] } }, { do: 'refuse' });
  assert.deepEqual(s.events.map(e => e.type), ['refused', 'sore']);
  assert.equal(s.state.placeHeat.park ?? 0, 0);
  assert.equal(trustOf(s.state, DEE), 3 + T.refuse);
  assert.equal(offDays(cfg, s.state, DEE), 0);
});

test('trust: it is local: liked or hated in the trailer park changes nothing at the Jay St night market', () => {
  const park = id => cfg.places.park.people.map(p => p.id).filter(x => x !== DEE).map(x => [x, id]);
  for (const t of [3, -3]) {
    const trust = Object.fromEntries(park(t).map(([x]) => [x, t]));
    for (let hour = 12; hour < 40; hour++) {
      const plain = at('market', { hour }, 1, CALM);
      const marked = at('market', { hour, trust }, 1, CALM);
      const a = view(CALM, plain);
      const b = view(CALM, marked);
      assert.deepEqual(b.options, a.options, `${t} at the park: the market's cards are the same`);
      assert.deepEqual(b.trustHere, a.trustHere);
      assert.equal(tellRisk(CALM, marked, 'market').pct, 0);
    }
  }
  // and the other way: everyone at the market against you, the park deals as ever
  const market = Object.fromEntries(cfg.places.market.people.map(p => [p.id, -3]));
  for (let hour = 12; hour < 40; hour++) {
    assert.deepEqual(view(cfg, at('park', { hour, trust: market })).options, view(cfg, at('park', { hour })).options);
  }
});

test('trust: an older saved state loads with everyone neutral (and an old grudge runs out as it would have)', () => {
  const v3 = { ...at('park'), v: 3 };
  delete v3.trust;
  const v = view(cfg, v3);
  assert.ok(v.trust.every(p => p.trust === 0 && p.band === 'neutral' && p.offDays === 0));
  assert.equal(v.options.length, 3);
  const r = step(cfg, v3, v.options[0].choice);
  assert.equal(trustOf(r.state, r.events[0].who.id), 1);
  // a version-3 save holding a grudge: off the table until it runs out
  const old = { ...at('crib'), v: 3, grudges: { [DEE]: 2 } };
  delete old.trust;
  assert.equal(offDays(cfg, old, DEE), 2);
  const a = step(cfg, old, { do: 'sleep' }).state;
  assert.equal(offDays(cfg, a, DEE), 1);
  assert.equal(offDays(cfg, step(cfg, a, { do: 'sleep' }).state, DEE), 0);
});

test('trust: same seed, same run, for the good neighbour and the burner', () => {
  for (const policy of [POLICIES.neighbour(120), POLICIES.burner(120), POLICIES.farm(120)]) {
    const a = playSeason(cfg, { seed: 11, policy, kit: { cutter: true } });
    const b = playSeason(cfg, { seed: 11, policy, kit: { cutter: true } });
    assert.deepEqual(a.state, b.state);
    assert.deepEqual(a.takes, b.takes);
    assert.ok(checkRunBooks(a.state).ok);
    assert.ok(Object.keys(a.state.trust).length > 0, 'trust moved over the season');
  }
});
