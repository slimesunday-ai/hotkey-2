// BIG LOU IS A BIG MAN (bigman-1, RUN.md "Low Tide Docks"): the docks' driver fights as a big man, the throw's natural
// use (taught on the same pier); the careful docks player passes a lift whose fight the card says it mostly loses
// (FIGHT_MIN), lifting from the driver it beats; the docks player who learns the throw lifts from both trucks; mark P5.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, withRunConfig, newRun, view, step, deal, checkRunBooks } from '../src/run/index.mjs';
import { styleOf } from '../src/run/rules.mjs';
import { POLICIES, FIGHT_MIN, decide, playSeason } from '../src/run/policies.mjs';
import { judgePlaces, paidBackOn, THROW_MARK } from '../src/run/marks.mjs';

const cfg = RUN_CONFIG;
// nobody jumps you and the police never stop you
const CALM = withRunConfig({ jump: { basePct: 0, perHourPct: 0, perStepPct: 0 }, police: { perHeat: 0 } });
const LOU = 'npc:driver:docks';
const NADIA = 'npc:driver:docks:2';
function at(place, extra = {}, seed = 1, c = CALM) {
  const s = newRun({ seed, cfg: c });
  return { ...s, place, energy: 5, carried: 3, ...extra };
}
/** A docks hour whose lift is dealt at Big Lou. */
function louHour(extra = {}) {
  for (let hour = 12; hour < 400; hour++) {
    const s = at('docks', { ...extra, hour });
    if (deal(CALM, s).some(j => j.id === 'lift' && j.who?.id === LOU)) return s;
  }
  throw new Error('the lift never dealt at Big Lou');
}
const out = (s, id) => ({ ...s, people: { ...s.people, [id]: { ...(s.people?.[id] ?? {}), out: true } } });

test('bigman: Big Lou fights as a big man, Nadia Petrakis a plain brawler; the lift card says who, how they fight, and the odds with what you own', () => {
  assert.equal(styleOf(cfg, cfg.places.docks.people.find(p => p.id === LOU)), 'bigman');
  assert.equal(styleOf(cfg, cfg.places.docks.people.find(p => p.id === NADIA)), 'brawler');
  const s = { ...louHour(), styles: { throw: true } };
  const o = view(CALM, s).options.find(x => x.id === 'lift');
  assert.equal(o.who.id, LOU);
  assert.equal(o.fight.them.style, 'bigman');
  assert.match(o.fight.them.says, /big/);
  assert.deepEqual(Object.keys(o.fight.byArm), ['hands', 'throw']);
  assert.ok(o.fight.byArm.throw > o.fight.byArm.hands + 30, `the throw ${o.fight.byArm.throw} against bare hands ${o.fight.byArm.hands}`);
  // (the lift's own `wonHeat`: the card says both ways, won and lost)
  assert.match(o.ifFail, /^a fight: you win about \d+ in 10 \(won: paid, heat \+1, energy −1; lost: heat \+2, energy −2\)$/);
  assert.equal(o.wonHeat, 1);
  assert.equal(o.failHeat, 2);
  // the other driver is on the card too, with her own fight
  const nadia = o.targets.find(t => t.id === NADIA);
  assert.equal(nadia.fight.them.style, 'brawler');
  assert.ok(nadia.fight.byArm.hands > o.fight.byArm.hands + 20, 'bare-handed, Nadia is the truck to lift from');
});

test('bigman: the careful docks player passes a lift whose fight the card says it mostly loses, and lifts from the driver it beats', () => {
  assert.equal(POLICIES.docks(120).fightMin, FIGHT_MIN);
  assert.ok(FIGHT_MIN > 0 && FIGHT_MIN < 50);
  assert.equal(POLICIES.docksBlind(120).fightMin, undefined, 'the heat-blind one lifts blind, as built');
  const s = louHour();
  // dealt at Big Lou, bare-handed: it takes the lift from Nadia instead (the card offers her)
  assert.deepEqual(decide(CALM, s, POLICIES.docks(120)), { do: 'job', id: 'lift', who: NADIA });
  // Nadia out for the day: only Big Lou, a fight it mostly loses: the shift
  const alone = out(s, NADIA);
  const o = view(CALM, alone).options.find(x => x.id === 'lift');
  assert.ok(o.fight.pct < FIGHT_MIN, `bare hands against Big Lou ${o.fight.pct}`);
  assert.equal(decide(CALM, alone, POLICIES.docks(120)).id, 'shift');
  // read off the card only: the same hour with the card saying he can be beaten, it lifts from him
  const v = view(CALM, alone);
  const lift = v.options.find(x => x.id === 'lift');
  const easy = { ...v, options: v.options.map(x => (x === lift ? { ...x, fight: { ...x.fight, pct: 60 }, targets: x.targets.map(t => ({ ...t, fight: { ...t.fight, pct: 60 } })) } : x)) };
  assert.deepEqual(decide(CALM, alone, POLICIES.docks(120), easy), { do: 'job', id: 'lift' });
  // and never a fight that, lost, leaves no energy for the ride home (lost: the hour and energy −2)
  const late = { ...s, energy: 3 };
  assert.equal(decide(CALM, late, POLICIES.docks(120)).id, 'shift');
});

test('bigman: the docks player who knows the throw changes to it and lifts from Big Lou too', () => {
  const s = out({ ...louHour(), styles: { throw: true } }, NADIA);
  const p = POLICIES.docksThrow(120);
  assert.deepEqual(p.learn, ['throw']);
  assert.equal(p.fightMin, FIGHT_MIN);
  assert.deepEqual(decide(CALM, s, p), { do: 'fightWith', with: 'throw' });
  assert.deepEqual(decide(CALM, { ...s, fightWith: 'throw' }, p), { do: 'job', id: 'lift' });
  // the plain one in the same hour takes the shift
  assert.equal(decide(CALM, s, POLICIES.docks(120)).id, 'shift');
});

test('bigman: the docks player who learns the throw learns it from Mr. Haines and plays whole seasons, the books whole', () => {
  let learned = 0;
  for (const seed of [1, 2, 3, 4]) {
    const r = playSeason(cfg, { seed, policy: POLICIES.docksThrow(120), days: 10 });
    assert.equal(r.takes.length, 10);
    assert.ok(checkRunBooks(r.state).ok);
    if (r.state.styles?.throw) {
      learned += 1;
      assert.equal(r.state.books.lessons, cfg.styles.throw.price);
    }
  }
  assert.ok(learned >= 3, `learned in ${learned} of 4`);
});

test('bigman: mark P5, the throw opens the docks: more a day over ten days with the lesson counted, and the lesson back in time', () => {
  // the day from which what was banked in all stays at least the plain player's
  assert.equal(paidBackOn({ byDay: [10, 10, 10, 10] }, { byDay: [-20, 20, 20, 20] }), 4);
  assert.equal(paidBackOn({ byDay: [10, 10, 10] }, { byDay: [10, 10, 10] }), 1);
  assert.equal(paidBackOn({ byDay: [10, 10, 10] }, { byDay: [30, 0, -15] }), null, 'ahead, then behind at the end: never back');
  const t = (mean, byDay) => ({ mean, byDay });
  const mark = cells => judgePlaces({ stopAt: 120, throwDays: 10, throwPrice: 50, throw: cells }).find(m => m.n === 'P5');
  const plain = t(60, Array(10).fill(60));
  const good = t(68.5, [10, ...Array(9).fill(75)]); // the lesson on day 1; back on day 5
  assert.equal(paidBackOn(plain, good), 5);
  assert.ok(mark({ mattress: { plain, throw: good }, '+bed': { plain, throw: good } }).pass);
  // not enough more
  const little = t(60 * (1 + (THROW_MARK.more - 0.5) / 100), good.byDay);
  assert.ok(!mark({ mattress: { plain, throw: little } }).pass);
  // more, but the lesson back too late
  const slow = t(64, [-200, 60, 60, 60, 60, 60, 60, 60, 60, 600]);
  assert.equal(paidBackOn(plain, slow), 10);
  assert.ok(!mark({ mattress: { plain, throw: slow } }).pass);
  assert.match(mark({ mattress: { plain, throw: good } }).got, /mattress \$69 against \$60 \(\+14\.2%; the lesson back on day 5\)/);
});

test('bigman: a lift gone wrong and the fight won heats the docks +1, lost +2: the job\'s own wonHeat, nothing else changes', () => {
  assert.equal(cfg.places.docks.jobs.lift.wonHeat, 1);
  assert.equal(cfg.places.docks.jobs.lift.failHeat, 2);
  const seen = {};
  for (let seed = 1; seed < 300 && !(seen.won && seen.lost); seed++) {
    const s0 = louHour();
    const s = { ...s0, seed, styles: { throw: true }, fightWith: 'throw', rig: { chances: [99] } };
    const r = step(CALM, s, { do: 'job', id: 'lift', who: NADIA });
    const e = r.events.find(x => x.type === 'job');
    if (!e.duel || seen[e.duel.result]) continue;
    seen[e.duel.result] = { s, r, e };
  }
  const { s: sw, r: won, e: ew } = seen.won;
  assert.equal(ew.heat, 1);
  assert.equal(won.state.heat, sw.heat + 1);
  assert.equal(won.state.placeHeat.docks ?? 0, (sw.placeHeat?.docks ?? 0) + 1);
  assert.ok(ew.pay > 0, 'won: the box is paid');
  assert.match(ew.text, /you beat them and took it: \+\$\d+ \(heat \+1, energy −1\)/);
  assert.equal(won.state.energy, sw.energy - 1 - cfg.duel.cost.win);
  const { s: sl, r: lost, e: el } = seen.lost;
  assert.equal(el.heat, 2);
  assert.equal(lost.state.heat, sl.heat + 2);
  assert.match(el.text, /they beat you \(heat \+2, energy −2\)/);
  // a fight job without wonHeat heats as ever, won or lost (the trailer park's wallet: failHeat 1 either way)
  assert.equal(cfg.places.park.jobs.wallet.wonHeat, undefined);
  for (let seed = 1; seed < 300; seed++) {
    const p0 = { ...newRun({ seed, cfg: CALM }), place: 'park', energy: 6, rig: { chances: [99] } };
    for (let hour = 12; hour < 60; hour++) {
      const ps = { ...p0, hour };
      if (!deal(CALM, ps).some(j => j.id === 'wallet')) continue;
      const e = step(CALM, ps, { do: 'job', id: 'wallet' }).events.find(x => x.type === 'job');
      if (e.duel?.result === 'won') { assert.equal(e.heat, 1); return; }
      break;
    }
  }
  assert.fail('no wallet fight won');
});

test('bigman: the careful docks player weighs a lift by its worst heat, so after a fight won (heat +1) it lifts again the next day, not the same one', () => {
  const s = { ...louHour(), heat: 1, placeHeat: { docks: 1 } };
  assert.equal(decide(CALM, s, POLICIES.docks(120)).id, 'shift', 'heat 1 and a lift that could go +2: past its limit of 2');
  assert.equal(decide(CALM, { ...s, heat: 0, placeHeat: {} }, POLICIES.docks(120)).id, 'lift');
});
