// PEOPLE REMEMBER (memory-1, RUN.md "People remember"): a big act leaves a mark on a person for a week, whatever the
// daily mood and trust do. Beaten or robbed to their face, they fear you: they pay up without a fight, do not fight
// back, do not swing at your door, do not tell, never case your crib, and hate you (no sales, no work). Lose a fight at
// a place and every fear there ends. On the eighth day whoever feared you is at your door for another go, warned the
// evening before: pay them off, or the fight, them tougher. One visit a morning at your door, the earliest due first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, withRunConfig, newRun, view, step, deal, checkRunBooks, saveRun, loadRun, RUN_STATE_VERSION } from '../src/run/index.mjs';
import { markOn, fears, marksOf, tellRisk, raidCast, pressureOf, toughnessOf, jobOdds } from '../src/run/rules.mjs';
import { POLICIES, decide, playSeason } from '../src/run/policies.mjs';
import { viewText } from '../src/run/text.mjs';

const cfg = RUN_CONFIG;
const M = cfg.memory;
// nobody jumps you and the police never stop you: an hour's own result, with nothing after it
const CALM = withRunConfig({ jump: { basePct: 0, perHourPct: 0, perStepPct: 0 }, police: { perHeat: 0 } });
const BENNY = 'npc:debtor';
const DEE = 'npc:buyer:projects:1';
const MAN = 'npc:mark:projects';
const WOMAN = 'npc:mark:projects:2';
const ALVAREZ = 'npc:neighbour';
const OKAFOR = 'npc:stallholder:2';
const who = id => {
  const p = Object.values(cfg.places).flatMap(x => x.people ?? []).find(x => x.id === id);
  return { id: p.id, name: p.name, role: p.role };
};
/** A mark made on `day` at `place` (the state's own shape). */
const mark = (id, kind, day = 1, place = 'park') => ({ [id]: { kind, day, place, who: who(id) } });

function at(place, extra = {}, seed = 1, c = cfg) {
  const s = newRun({ seed, cfg: c });
  return { ...s, place, energy: 6, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) }, home: { ...s.home, ...(extra.home ?? {}) } };
}
/** A state at `place` whose hour deals job `id` to person `to` (any, if null). */
function dealtAt(c, place, id, extra = {}, to = null, seed = 1) {
  for (let hour = 12; hour < 400; hour++) {
    const s = at(place, { ...extra, hour }, seed, c);
    if (deal(c, s).some(j => j.id === id && (!to || j.who?.id === to))) return s;
  }
  throw new Error(`${id} never dealt at ${place}${to ? ` to ${to}` : ''}`);
}
/** The first seed whose failed `id` (to `to`) is a fight that ends `result`. */
function fightEnding(id, result, extra = {}, to = null) {
  for (let seed = 1; seed < 400; seed++) {
    const s = { ...dealtAt(cfg, 'park', id, extra, to, seed), rig: { chances: [99] } };
    const r = step(cfg, s, { do: 'job', id });
    const e = r.events.find(x => x.type === 'job');
    if (e.duel?.result === result) return { s, r, e };
  }
  throw new Error(`no ${result} fight for ${id}`);
}

test('memory: a debt taken to his face is a week\'s mark: he fears you, and a second one does not renew it', () => {
  const s = dealtAt(CALM, 'park', 'collect');
  const r = step(CALM, { ...s, rig: { chances: [0] } }, { do: 'job', id: 'collect' });
  const e = r.events.find(x => x.type === 'job');
  assert.equal(e.outcome, 'win');
  assert.deepEqual([e.mark.kind, e.mark.fear, e.mark.day, e.mark.until, e.mark.due], ['robbed', true, 1, M.days, 1 + M.days]);
  assert.equal(e.mark.text, `you robbed him to his face on day 1 · gives way for ${M.days} more days`);
  assert.ok(fears(CALM, r.state, BENNY));
  // the daily drift does nothing to it: a week of mornings and it holds, on the eighth it is gone
  let st = r.state;
  for (let d = 2; d <= M.days; d++) {
    st = step(CALM, { ...st, place: 'crib', door: null }, { do: 'sleep' }).state;
    assert.equal(st.day, d);
    assert.ok(fears(CALM, st, BENNY), `day ${d}`);
    assert.equal(markOn(CALM, st, BENNY).left, M.days - d + 1);
  }
  // robbed again while he fears you: the same mark (it is not renewed: only a fight makes it anew)
  const again = dealtAt(CALM, 'park', 'collect', { marks: mark(BENNY, 'robbed', 1), day: 3 });
  const r2 = step(CALM, again, { do: 'job', id: 'collect' });
  assert.equal(r2.events.find(x => x.type === 'job').mark, undefined);
  assert.equal(r2.state.marks[BENNY].day, 1);
  assert.ok(checkRunBooks(r2.state).ok);
});

test('memory: a fight won is "beat" and a fight lost is "beaten"; losing ends every fear at that place, at once', () => {
  const won = fightEnding('wallet', 'won');
  assert.equal(won.e.mark.kind, 'beat');
  assert.ok(fears(cfg, won.r.state, won.e.who.id));
  // two people afraid of you in the park and one at the market; a debt fight lost to Benny
  const held = { ...mark(MAN, 'beat'), ...mark(WOMAN, 'robbed'), ...mark(OKAFOR, 'robbed', 1, 'market') };
  const lost = fightEnding('collect', 'lost', { marks: held });
  assert.equal(lost.e.mark.kind, 'beaten');
  assert.equal(lost.e.mark.text, `he beat you on day 1 · won't give way to you for ${M.days} more days`);
  const ended = lost.r.events.filter(x => x.type === 'markEnd');
  assert.deepEqual(ended.map(x => x.who.id).sort(), [MAN, WOMAN].sort());
  assert.ok(ended.every(x => x.why === 'broken' && /isn't scared of you any more/.test(x.text)));
  assert.ok(!fears(cfg, lost.r.state, MAN) && !fears(cfg, lost.r.state, WOMAN));
  assert.ok(fears(cfg, lost.r.state, OKAFOR), 'the market is another place');
  // he will not give way: no fear of you from him, whatever you take off him this week
  const after = dealtAt(CALM, 'park', 'collect', { marks: lost.r.state.marks, day: 2 });
  const r = step(CALM, { ...after, rig: { chances: [0] } }, { do: 'job', id: 'collect' });
  assert.equal(r.state.marks[BENNY].kind, 'beaten');
  assert.ok(!fears(CALM, r.state, BENNY));
});

test('memory: fear: a debt from him is sure, a lift gone wrong is no fight, the card says so', () => {
  const s = dealtAt(cfg, 'park', 'collect', { marks: mark(BENNY, 'beat') });
  const o = view(cfg, s).options.find(x => x.id === 'collect');
  assert.deepEqual([o.sure, o.odds, o.fear.text, o.fight], [true, 100, 'fears you: pays up', null]);
  assert.deepEqual(o.oddsWhy, ['fears you: pays up']);
  // sure even tired, and no fight: he pays
  const tired = { ...s, energy: 1 };
  assert.equal(jobOdds(cfg, tired, { ...cfg.places.park.jobs.collect, who: who(BENNY) }).pct, 100);
  const e = step(cfg, s, { do: 'job', id: 'collect' }).events.find(x => x.type === 'job');
  assert.deepEqual([e.outcome, e.fear, e.duel], ['win', true, undefined]);
  assert.match(e.text, /fears you and paid up without a fight/);
  // a lift off somebody who fears you that goes wrong: still a fight (only a job that says `feared` is not)
  const l = { ...dealtAt(cfg, 'park', 'wallet', { marks: mark(MAN, 'beat') }, MAN), rig: { chances: [99] } };
  const lo = view(cfg, l).options.find(x => x.id === 'wallet');
  assert.equal(lo.fear.text, 'fears you');
  assert.ok(lo.fight);
  const le = step(cfg, l, { do: 'job', id: 'wallet' }).events.find(x => x.type === 'job');
  assert.ok(le.duel && !le.gaveWay);
});

test('memory: fear: no swing at your door, nobody tells, never the one casing; hate: no sales, no work', () => {
  // the regular at your door who fears you: refused, he does not swing (the roll that would have been a swing)
  const door = { id: DEE, name: 'Shaky Dee', role: 'buyer', place: 'park', wants: 8 };
  const shut = step(cfg, { ...at('crib', { door, banked: 50, regulars: { [DEE]: 4 }, marks: mark(DEE, 'beat') }), rig: { chances: [0] } }, { do: 'refuse' });
  assert.ok(!shut.events.some(e => e.type === 'fight'));
  assert.ok(shut.events.some(e => e.type === 'grudge' && e.scared));
  assert.equal(view(cfg, at('crib', { door, banked: 50, marks: mark(DEE, 'beat') })).moves.find(m => m.choice.do === 'refuse').fight, undefined);
  // telling: against you and about, but afraid of you: nobody calls it in
  for (let hour = 12; hour < 60; hour++) {
    const s = at('park', { hour, trust: { [BENNY]: -3 } });
    if (!tellRisk(cfg, s).pct) continue;
    assert.equal(tellRisk(cfg, { ...s, marks: mark(BENNY, 'beat') }).pct, 0);
    // (robbed to his face, he gives way but still talks: `tells`)
    assert.equal(tellRisk(cfg, { ...s, marks: mark(BENNY, 'robbed') }).pct, tellRisk(cfg, s).pct);
    break;
  }
  // casing: the one most against you, unless they fear you
  const against = at('park', { trust: { [BENNY]: -3, [MAN]: -2 } });
  assert.equal(raidCast(cfg, against).id, BENNY);
  assert.equal(raidCast(cfg, { ...against, marks: mark(BENNY, 'beat') }).id, MAN);
  assert.equal(raidCast(cfg, { ...against, marks: { ...mark(BENNY, 'beat'), ...mark(MAN, 'robbed') } }).why, 'stranger');
  // hate: Dee afraid of you is never dealt a sale; a neighbour who hates you never works with you
  const goods = { goods: { smokes: 3 } };
  const sells = dealtAt(cfg, 'park', 'loosies', goods);
  assert.ok(deal(cfg, sells).some(j => j.id === 'loosies'));
  assert.ok(!deal(cfg, { ...sells, marks: mark(DEE, 'beat') }).some(j => j.id === 'loosies'));
  for (let hour = 12; hour < 40; hour++) {
    const s = at('park', { hour, marks: mark(ALVAREZ, 'shut') });
    assert.notEqual(deal(cfg, s)[0].who?.id, ALVAREZ);
  }
  // the door shut on a regular is the week's grudge: no sales to him while it lasts
  const g = step(cfg, { ...at('crib', { door, banked: 50, regulars: { [DEE]: 4 } }), rig: { chances: [99] } }, { do: 'refuse' });
  assert.equal(g.state.marks[DEE].kind, 'shut');
  assert.equal(marksOf(cfg, g.state)[0].text, `you shut the door on him on day 1 · won't buy from you for ${M.days} more days`);
  assert.ok(!deal(cfg, { ...dealtAt(cfg, 'park', 'loosies', goods), marks: g.state.marks, day: 5 }).some(j => j.id === 'loosies'));
});

test('memory: fear eases the pressure at home by memory.fear.pressure, and still counts them against you', () => {
  const s = at('park', { trust: { [BENNY]: -3 } });
  const before = pressureOf(cfg, s).value;
  const after = pressureOf(cfg, { ...s, marks: mark(BENNY, 'beat') });
  assert.equal(after.value, Math.max(0, before + M.fear.pressure));
  assert.ok(after.reasons.some(r => r.why === 'against' && r.who.id === BENNY));
  if (M.fear.pressure) assert.ok(after.reasons.some(r => r.why === 'fears' && r.n === M.fear.pressure));
});

test('memory: it comes due: warned the evening before, at your door on the eighth day; paid off, or fought, him tougher', () => {
  // beaten on day 1: the evening of day 7 he says he is coming
  const d7 = at('park', { day: M.days, hour: M.due.warnHour - 1, marks: mark(BENNY, 'beat'), banked: 100 });
  const odd = view(cfg, d7).options.find(o => o.safe);
  const ev = step(cfg, d7, odd.choice);
  const coming = ev.events.filter(e => e.type === 'coming');
  assert.equal(coming.length, 1);
  assert.equal(coming[0].on, M.days + 1);
  assert.match(coming[0].text, /^Benny Two-Coats says he is coming by tomorrow: another go at your door, unless you pay him \$\d+ to call it square\.$/);
  assert.ok(view(cfg, ev.state).coming.some(c => c.who.id === BENNY && /tomorrow/.test(c.text)));
  // said once; and to bed earlier, it is said in the night
  const odd2 = view(cfg, ev.state).options.find(o => o.safe);
  if (odd2) assert.ok(!step(cfg, ev.state, odd2.choice).events.some(e => e.type === 'coming'));
  const early = step(cfg, at('crib', { day: M.days, hour: 14, marks: mark(BENNY, 'beat'), banked: 100 }), { do: 'sleep' });
  assert.ok(early.events.some(e => e.type === 'coming'));
  // the eighth morning: the fear is gone, said, and he is at your door
  const m8 = early.state;
  assert.equal(m8.day, M.days + 1);
  assert.ok(!fears(cfg, m8, BENNY));
  assert.ok(early.events.some(e => e.type === 'markEnd' && e.who.id === BENNY && e.comesDue && e.text === "Benny Two-Coats isn't scared of you any more."));
  const door = early.events.find(e => e.type === 'door');
  assert.deepEqual([door.due, door.who.id, door.wants], [true, BENNY, M.due.price]);
  const v = view(cfg, m8);
  assert.equal(v.door.due, true);
  const pay = v.moves.find(m => m.choice.do === 'give');
  const fight = v.moves.find(m => m.choice.do === 'refuse');
  assert.equal(pay.label, `Pay Benny Two-Coats $${M.due.price} to call it square`);
  assert.equal(fight.label, 'Fight him');
  assert.equal(fight.fight.them.hp, toughnessOf(cfg, who(BENNY)) + M.due.tougher);
  assert.match(viewText(v), /Benny Two-Coats is at your door for another go/);
  // paid off: from banked, no fight, nobody marked
  const paid = step(cfg, m8, { do: 'give' });
  assert.deepEqual(paid.events.map(e => e.type), ['gave']);
  assert.equal(paid.state.banked, m8.banked - M.due.price);
  assert.equal(paid.state.door, null);
  assert.equal(markOn(cfg, paid.state, BENNY), null);
  assert.equal(paid.state.books.door, m8.books.door + M.due.price);
  // fought: the one-on-one at his toughness + tougher, and the mark it leaves (won: another week; lost: he holds it)
  const fought = step(cfg, m8, { do: 'refuse' });
  const f = fought.events.find(e => e.type === 'fight');
  assert.ok(f.due && f.duel);
  assert.equal(f.duel.inputs.foe.hp, toughnessOf(cfg, who(BENNY)) + M.due.tougher);
  assert.equal(fought.state.marks[BENNY].kind, f.duel.result === 'won' ? 'beat' : 'beaten');
  assert.equal(fought.state.marks[BENNY].day, M.days + 1);
  // and stepping out past him is the fight too
  const past = step(cfg, m8, { do: 'out', take: 0 });
  assert.ok(past.events.some(e => e.type === 'fight' && e.due && e.how === 'past'));
});

test('memory: one visit a morning: the earliest due first, the others wait a day and say so', () => {
  // Benny comes due this morning and Dee rolls to come too: Benny (warned, due first) is at the door; Dee waits
  const night = at('crib', { day: M.days, hour: 20, marks: mark(BENNY, 'robbed'), regulars: { [DEE]: 6 }, banked: 100, rig: { chances: [0] } });
  const r = step(cfg, night, { do: 'sleep' });
  assert.equal(r.state.door.id, BENNY);
  assert.equal(r.state.door.kind, 'due');
  const waited = r.events.find(e => e.type === 'coming' && e.waited);
  assert.equal(waited.who.id, DEE);
  assert.match(waited.text, /^Shaky Dee came by your door too, but Benny Two-Coats was there first: back tomorrow wanting more\.$/);
  assert.deepEqual(r.state.visits.map(x => [x.kind, x.id]), [['regular', DEE]]);
  // answered, and the next morning Dee comes with what he wanted (no new roll)
  const wants = r.state.visits[0].wants;
  const paid = step(cfg, r.state, { do: 'give' });
  const next = step(cfg, { ...paid.state, rig: { chances: [99] } }, { do: 'sleep' });
  assert.equal(next.state.door.id, DEE);
  assert.equal(next.state.door.wants, wants);
  assert.deepEqual(next.state.visits, []);
  // two due the same morning: the earlier first (one waiting from yesterday before one due today)
  const two = at('crib', { day: 9, hour: 20, marks: mark(BENNY, 'beat', 2), visits: [{ kind: 'due', id: MAN, name: 'a man at the bus stop', role: 'mark', place: 'park', due: 9 }], banked: 100 });
  const t = step(cfg, two, { do: 'sleep' });
  assert.equal(t.state.door.id, MAN);
  assert.deepEqual(t.state.visits.map(x => x.id), [BENNY]);
  // an attempt on your crib is not a visit: one due today still comes, whoever is at the door
  assert.ok(t.events.some(e => e.type === 'coming' && e.who.id === BENNY));
});

test('memory: the People view says what each one remembers and for how long', () => {
  const s = at('park', { day: 3, marks: { ...mark(BENNY, 'beat', 2), ...mark(WOMAN, 'beaten', 3) } });
  const v = view(cfg, s);
  const by = id => v.marks.find(m => m.who.id === id);
  assert.equal(by(BENNY).text, 'you beat him on day 2 · gives way for 6 more days');
  assert.equal(by(WOMAN).text, `she beat you on day 3 · won't give way to you for ${M.days} more days`);
  assert.equal(v.people.find(p => p.id === BENNY).mark.text, by(BENNY).text);
  assert.match(viewText(v), /They remember: Benny Two-Coats: you beat him on day 2/);
});

test('memory: a version-8 save loads: nobody marked, nobody coming, and plays on', () => {
  assert.equal(RUN_STATE_VERSION, 14); // (styles-1: 10; sixes-1: 11; raid-1: 12; pot-1: 13; bench-1: 14; a version-8 save is still read, through 9 and 10)
  const s = { ...at('park', { day: 3 }), v: 8 };
  delete s.marks;
  delete s.visits;
  const r = loadRun(JSON.stringify({ kind: 'the-run', v: 8, state: s }));
  assert.ok(r.ok, r.text);
  assert.equal(r.state.v, RUN_STATE_VERSION);
  assert.deepEqual([r.state.marks, r.state.visits], [{}, []]);
  const o = view(cfg, r.state).options[0];
  assert.ok(step(cfg, r.state, o.choice).state);
  // and the rules read an older state handed to them directly, as nobody marked
  assert.deepEqual(view(cfg, s).marks, []);
  // a save of this version goes through and back with its marks and visits
  const m = { ...at('crib', { marks: mark(BENNY, 'beat'), visits: [{ kind: 'due', id: MAN, name: 'a man at the bus stop', role: 'mark', place: 'park', due: 3 }] }) };
  assert.deepEqual(loadRun(saveRun(m)).state, m);
});

test('memory: the shark that leans on its own street uses fear: sure debts, and it is cased less than the shark that does not', () => {
  let sure = 0;
  let casedFear = 0;
  let casedOld = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const a = playSeason(cfg, { seed, policy: POLICIES.shark(120), days: 10 });
    const b = playSeason(cfg, { seed, policy: { ...POLICIES.burner(120), parkFirst: true }, days: 10 });
    casedFear += a.tally.warnings;
    casedOld += b.tally.warnings;
    sure += a.state.books.earned > 0 ? 1 : 0;
  }
  assert.ok(sure > 0);
  assert.ok(casedFear < casedOld * 0.75, `cased ${casedFear} against ${casedOld}`);
  // at the door, somebody come due is paid off when the fight is a poor bet, fought when it is a good one
  const v = view(cfg, at('crib', { door: { kind: 'due', id: BENNY, name: 'Benny Two-Coats', role: 'debtor', place: 'park', wants: M.due.price, tougher: M.due.tougher }, banked: 100 }));
  const c = decide(cfg, at('crib', { door: v.door, banked: 100 }), POLICIES.shark(120), v);
  assert.equal(c.do, v.door.fight.pct >= 55 ? 'refuse' : 'give');
});
