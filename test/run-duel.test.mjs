// THE FIGHTS IN THE RUN (duel-1, RUN.md "Fights"): a debt or a lift gone wrong to somebody's face, and the regular at
// your door who swings, are a one-on-one of the fight's own simulation, and that fight is the outcome.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, withRunConfig, newRun, view, step, checkRunBooks, deal, saveRun, loadRun } from '../src/run/index.mjs';
import { duelHealth, duelOf, duelChance, toughnessOf, fightOut } from '../src/run/rules.mjs';
import { runDuel, startDuel, duelOdds, step as fightStep, brawl } from '../src/fight/index.mjs';

const cfg = RUN_CONFIG;
const OFF = withRunConfig({ duel: null });
const BENNY = 'npc:debtor';

function at(place, extra = {}, seed = 1, c = cfg) {
  const s = newRun({ seed, cfg: c });
  return { ...s, place, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) } };
}
/** A state in the trailer park whose hour deals job `id`, the job's roll rigged to fail. */
function failing(id, extra = {}, seed = 1, c = cfg) {
  for (let hour = 12; hour < 80; hour++) {
    const s = at('park', { energy: 6, ...extra, hour }, seed, c);
    if (deal(c, s).some(j => j.id === id)) return { ...s, rig: { chances: [99] } };
  }
  throw new Error(`${id} never dealt`);
}
/** The first run seed whose failed `id` is a fight that ends `result`. */
function fightEnding(id, result, extra = {}) {
  for (let seed = 1; seed < 400; seed++) {
    const s = failing(id, extra, seed);
    const r = step(cfg, s, { do: 'job', id });
    const e = r.events.find(x => x.type === 'job');
    if (e.duel?.result === result) return { s, r, e };
  }
  throw new Error(`no ${result} fight for ${id}`);
}

test('duel: the same seed and inputs are the same fight, headless, stepped as the page steps it, and as the event says', () => {
  const d = duelOf(cfg, at('park', { energy: 4 }), { id: BENNY, name: 'Benny Two-Coats', role: 'debtor' });
  for (const seed of [1, 2, 99, 123456]) {
    const A = runDuel(d.inputs, seed);
    const B = runDuel(d.inputs, seed);
    assert.deepEqual(A.events, B.events);
    // (the page: a tick at a time, the brawl's move each tick; and a copy stepped ahead does not change it)
    const P = startDuel(d.inputs, seed);
    while (!P.over) {
      structuredClone(P);
      fightStep(P, brawl(P));
    }
    assert.deepEqual(P.events, A.events);
    assert.deepEqual(P.over, A.over);
    assert.ok(A.over.t <= cfg.duel.cap + 1e-9, 'never past the cap');
  }
  // the event's own fight, run again from what it carries, ends the same; and the same choice from the same state is
  // the same event (with pictures, without, skipped: the page plays this seed, it never rolls its own)
  const { s, e } = fightEnding('collect', 'won');
  const again = runDuel(e.duel.inputs, e.duel.seed);
  assert.equal(again.over.result, e.duel.result);
  assert.equal(again.over.t, e.duel.seconds);
  assert.deepEqual(step(cfg, s, { do: 'job', id: 'collect' }).events, step(cfg, s, { do: 'job', id: 'collect' }).events);
});

test('duel: the energy slope: full energy at the bed\'s 10 is a full bar, none about half, a straight line between', () => {
  assert.equal(duelHealth(cfg, 10), 100);
  assert.equal(duelHealth(cfg, 0), 50);
  assert.equal(duelHealth(cfg, 6), 80, 'fresh on the mattress');
  assert.equal(duelHealth(cfg, 2), 60, 'tired');
  for (let e = 0; e < 10; e++) assert.ok(duelHealth(cfg, e + 1) > duelHealth(cfg, e));
  assert.equal(duelHealth(cfg, 14), 100, 'never over a full bar');
  const tired = duelOf(cfg, at('park', { energy: 2 }), { id: BENNY, role: 'debtor', name: 'Benny Two-Coats' });
  assert.equal(tired.you.hp, 60);
  assert.match(tired.you.text, /^bare hands; tired: you start at 60%$/);
  const cutter = duelOf(cfg, at('park', { energy: 10, owned: { cutter: true } }), { id: BENNY, role: 'debtor', name: 'Benny Two-Coats' });
  assert.equal(cutter.inputs.you.weapon, 'blade');
  assert.match(cutter.you.text, /^box cutter; rested/);
  // the same person is always as tough; a person's toughness is their role's base, give or take the spread
  const benny = { id: BENNY, role: 'debtor' };
  assert.equal(toughnessOf(cfg, benny), toughnessOf(cfg, benny));
  for (const p of cfg.places.park.people) {
    const t = toughnessOf(cfg, p);
    const base = cfg.duel.foe.base[p.role] ?? cfg.duel.foe.ordinary;
    assert.ok(Math.abs(t - base) <= cfg.duel.foe.spread, `${p.name}: ${t} from ${base}`);
  }
});

test('duel: a debt gone wrong is a fight; lost, today\'s failure with the fight\'s cost in place of failEnergy', () => {
  const { s, r, e } = fightEnding('collect', 'lost');
  const off = step(OFF, s, { do: 'job', id: 'collect' });
  const o = off.events.find(x => x.type === 'job');
  assert.equal(e.outcome, 'fail');
  assert.equal(e.duel.result, 'lost');
  assert.equal(e.pay, 0);
  assert.deepEqual(e.money, []);
  // the energy: the hour and the fight's 2 (never the debt's own failEnergy as well)
  assert.equal(r.state.energy, s.energy - cfg.energy.perHour - cfg.duel.cost.lose);
  assert.equal(e.energyLost, cfg.duel.cost.lose);
  assert.equal(off.state.energy, s.energy - cfg.energy.perHour - cfg.jobs.park.collect.failEnergy);
  // the rest is today's failure exactly: heat, trust, the pressure at home, the mood; never the clinic
  assert.deepEqual([r.state.heat, r.state.placeHeat, r.state.trust, r.state.home.marks, r.state.people[BENNY]], [off.state.heat, off.state.placeHeat, off.state.trust, off.state.home.marks, off.state.people[BENNY]]);
  assert.equal(r.state.place, 'park');
  assert.deepEqual(e.trust, o.trust);
  assert.match(e.text, /Benny Two-Coats came at you: they beat you \(energy −2\)\./);
  assert.ok(checkRunBooks(r.state).ok);
});

test('duel: won, the job pays as a win, but their trust, the heat and the pressure move as a failure\'s', () => {
  const { s, r, e } = fightEnding('wallet', 'won');
  const win = step(cfg, { ...s, rig: { chances: [0] } }, { do: 'job', id: 'wallet' }).events.find(x => x.type === 'job');
  const off = step(OFF, s, { do: 'job', id: 'wallet' });
  assert.equal(e.outcome, 'fail');
  assert.equal(e.duel.result, 'won');
  assert.equal(e.pay, win.pay, 'paid as the win would have paid');
  assert.deepEqual(e.money.map(m => m.amount), [win.pay]);
  assert.equal(r.state.carried, s.carried + win.pay);
  assert.equal(r.state.energy, s.energy - cfg.energy.perHour - cfg.duel.cost.win);
  assert.deepEqual([r.state.heat, r.state.placeHeat, r.state.trust, r.state.home.marks, r.state.people[e.who.id]], [off.state.heat, off.state.placeHeat, off.state.trust, off.state.home.marks, off.state.people[e.who.id]]);
  assert.equal(e.heat, cfg.jobs.park.wallet.failHeat);
  assert.ok(checkRunBooks(r.state).ok);
});

test('duel: only the switched-on jobs fight; the market\'s jobs, a win, and the fights switched off are as they were', () => {
  for (const id of ['wallet', 'till']) {
    for (let hour = 12; hour < 80; hour++) {
      const s = at('market', { energy: 6, hour });
      if (!deal(cfg, s).some(j => j.id === id)) continue;
      const e = step(cfg, { ...s, rig: { chances: [99] } }, { do: 'job', id }).events.find(x => x.type === 'job');
      assert.equal(e.duel, undefined, `the market's ${id} is still the dice`);
      break;
    }
  }
  const s = failing('collect');
  assert.equal(step(cfg, { ...s, rig: { chances: [0] } }, { do: 'job', id: 'collect' }).events[0].duel, undefined, 'a job that works is no fight');
  assert.equal(step(OFF, s, { do: 'job', id: 'collect' }).events[0].duel, undefined);
  // the per-job flag: switched on for a market job by data alone
  const on = withRunConfig({ places: { market: { jobs: { ...cfg.places.market.jobs, wallet: { ...cfg.places.market.jobs.wallet, fight: 'fail' } } } } });
  for (let hour = 12; hour < 80; hour++) {
    const m = at('market', { energy: 6, hour }, 1, on);
    if (!deal(on, m).some(j => j.id === 'wallet')) continue;
    assert.ok(step(on, { ...m, rig: { chances: [99] } }, { do: 'job', id: 'wallet' }).events.find(x => x.type === 'job').duel);
    break;
  }
});

test('duel: the regular at your door who swings: lost is their win as it was (clean or a scuffle), won is their losing', () => {
  const dee = 'npc:buyer:projects:1';
  const seen = new Set();
  for (let seed = 1; seed < 300 && seen.size < 3; seed++) {
    let s = { ...at('crib', { regulars: { [dee]: 3 } }, seed), rig: { chances: [0] } };
    const r = step(cfg, s, { do: 'sleep' });
    if (!r.state.door) continue;
    s = { ...r.state, rig: { chances: [0] } }; // (they swing)
    const v = view(cfg, s);
    const shut = v.choices.find(c => c.choice.do === 'refuse');
    assert.equal(shut.fight.pct, duelChance(cfg, s, { id: dee, name: 'Shaky Dee', role: 'buyer' }).pct);
    assert.match(v.door.text, /Shut, 60% they swing: a fight: you win about \d+ in 10\.$/);
    const f = step(cfg, s, { do: 'refuse' });
    const e = f.events.find(x => x.type === 'fight');
    assert.ok(e.duel);
    const want = e.duel.result === 'won' ? 'fail' : e.duel.them.leftPct > cfg.duel.doorClean ? 'clean' : 'messy';
    assert.equal(e.outcome, want);
    assert.equal(e.scene.kind, `fight:${want}`);
    const hurt = cfg.regulars.hurt[want] ?? 0;
    assert.equal(e.energyLost, hurt);
    assert.equal(f.state.energy, s.energy - hurt);
    assert.equal(runDuel(e.duel.inputs, e.duel.seed).over.result, e.duel.result);
    // (they are sour and out, against you, as after a swing before)
    assert.equal(f.state.people[dee].mood, 'sour');
    seen.add(want);
  }
  assert.ok(seen.has('fail') && (seen.has('clean') || seen.has('messy')), `both ways seen: ${[...seen]}`);
});

test('duel: the card says what going wrong means, from a sample of the very same fight', () => {
  const s = failing('collect');
  const o = view(cfg, s).options.find(x => x.id === 'collect');
  const d = duelOf(cfg, s, o.who);
  const est = duelOdds(d.inputs, cfg.duel.sample);
  assert.equal(o.fight.pct, est.pct);
  assert.equal(o.fight.in10, Math.round(est.won / est.n * 10));
  assert.equal(o.fight.text, `a fight: you win about ${o.fight.in10} in 10`);
  assert.match(o.ifFail, /^a fight: you win about \d+ in 10 \(won: paid, energy −1; lost: energy −2\)$/);
  assert.deepEqual(o.fight.you.why, ['bare hands', 'energy 6: you start at 80%']);
  assert.equal(o.failEnergy, cfg.duel.cost.lose);
  // each target its own estimate (the same neighbour is always as tough), and an odd job none
  const w = view(cfg, failing('wallet')).options.find(x => x.id === 'wallet');
  for (const t of w.targets) assert.equal(t.fight.pct, duelChance(cfg, failing('wallet'), t).pct);
  assert.equal(view(cfg, s).options.find(x => x.safe).fight, null);
  // the estimate is honest: what the run's own fights come to, over many, is near it
  let won = 0;
  const n = 300;
  for (let seed = 1; seed <= n; seed++) if (fightOut(cfg, s, o.who, ['test', seed]).result === 'won') won += 1;
  assert.ok(Math.abs((won / n) * 100 - o.fight.pct) < 10, `${(won / n) * 100}% against the card's ${o.fight.pct}%`);
});

test('duel: a save from before the fights loads, and its fights are the same before and after the save', () => {
  const { s, e } = fightEnding('collect', 'lost');
  const back = loadRun(saveRun({ ...s, rig: undefined }));
  assert.ok(back.ok, back.text);
  const e2 = step(cfg, { ...back.state, rig: { chances: [99] } }, { do: 'job', id: 'collect' }).events.find(x => x.type === 'job');
  assert.deepEqual(e2.duel, e.duel);
});
