// THE RAID ON YOUR HOME (raid-1, RUN.md "The raid on your home (raid-1)"): with the Sixes' meter at their raid step
// (what you do, never what you hold) they come for your crib on the night after the word; who comes by what your home is
// worth (one sum over a table of holdings); home, the raid fight with what you hold (a gun, or what you fight with),
// each piece its job; out, your door. Guns and their rounds bought where they are sold; the push on the tax; the truce;
// things at risk and hiding places by one rule; saves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, withRunConfig, newRun, view, step, checkRunBooks, RUN_STATE_VERSION, saveRun, loadRun } from '../src/run/index.mjs';
import { sixesOf, taxOf, taxPctOf, armsOf } from '../src/run/rules.mjs';
import { homeWorth, raidOf, raidChance, raidOdds, holdOf, holdsOf, hiddenOf, thingsAtRisk, thingsToKnock, crewFoes, raidAtOf, gunHeat } from '../src/run/raid.mjs';
import { runRaid } from '../src/fight/raid.mjs';
import { runDuel } from '../src/fight/duel.mjs';
import { POLICIES, playSeason } from '../src/run/policies.mjs';

const cfg = RUN_CONFIG;
const X = cfg.sixes;
const Y = cfg.sixesRaid;
const sixes = (n, day, more = {}) => ({ marks: n ? [{ why: 'sell', text: 'sold there', n, day: day - 1 }] : [], did: day, word: day - 1, made: 0, madeDay: null, taxDay: null, tax: null, jump: null, jumps: [], streak: 0, streakDay: null, raid: null, raids: [], truce: null, raidLast: null, ...more });
function at(place, extra = {}, seed = 1) {
  const s = newRun({ seed, cfg });
  return { ...s, place, energy: 6, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) }, home: { ...s.home, ...(extra.home ?? {}) } };
}
const banked = (s, n) => ({ ...s, banked: s.banked + n, books: { ...s.books, earned: s.books.earned + n } });
const carrying = (s, n) => ({ ...s, carried: s.carried + n, books: { ...s.books, earned: s.books.earned + n } });

test('what your home is worth: one sum over the table of holdings; a new kind of holding is one more row', () => {
  const s = { ...banked(at('crib'), 480), stash: { smokes: 5 }, things: { doorman: true, deadbolt: true } };
  const w = homeWorth(cfg, s);
  assert.deepEqual(w.entries.map(e => e.id), cfg.worth.entries.map(e => e.id));
  assert.equal(w.entries.find(e => e.id === 'cash').value, 500);
  assert.equal(w.entries.find(e => e.id === 'stock').value, 10);
  assert.equal(w.entries.find(e => e.id === 'things').value, cfg.things.doorman.price); // (the deadbolt is no thing at risk)
  assert.equal(w.total, 500 + 10 + cfg.things.doorman.price);
  assert.equal(w.size, cfg.worth.steps.filter(x => w.total >= x).length);
  // the meter in the view
  assert.equal(view(cfg, s).worth.total, w.total);
  // a later holding: a row whose `of` the rules already know counts with no other change (here: cash counted twice)
  const more = withRunConfig({ worth: { entries: [...cfg.worth.entries, { id: 'again', label: 'again', of: 'banked' }] } });
  assert.equal(homeWorth(more, s).total, w.total + 500);
});

test('the word: at their raid step, the morning brings it; they come the night after; who comes by worth and the dice', () => {
  const s = banked(at('crib', { day: 6, hour: 21, sixes: sixes(X.raid, 6) }), 300);
  const r = step(cfg, s, { do: 'sleep' });
  const e = r.events.find(x => x.type === 'sixes' && x.what === 'raidWarned');
  assert.ok(e, 'warned');
  assert.equal(r.state.sixes.raid.day, r.state.day + 1);
  assert.equal(e.size, homeWorth(cfg, r.state).size);
  assert.ok(Object.keys(Y.crews).includes(e.crew));
  assert.equal(e.n, crewFoes(cfg, e.crew, e.size).n);
  // under the step: no word, however rich the home (how often follows what you do; what you hold, how many come)
  assert.ok(!step(cfg, { ...s, sixes: sixes(X.raid - 1, 6) }, { do: 'sleep' }).events.some(x => x.what === 'raidWarned'));
  assert.equal(raidAtOf(cfg), X.raid);
  const rich = banked(at('crib', { day: 6, hour: 21, sixes: sixes(X.raid - 1, 6) }), cfg.worth.steps[1] + 100);
  assert.ok(!step(cfg, rich, { do: 'sleep' }).events.some(x => x.what === 'raidWarned'));
  const richer = step(cfg, { ...rich, sixes: sixes(X.raid, 6) }, { do: 'sleep' }).events.find(x => x.what === 'raidWarned');
  assert.equal(richer.size, 2);
  // the camera: a day sooner (two days to answer)
  const cam = step(cfg, { ...s, things: { camera: true } }, { do: 'sleep' });
  assert.equal(cam.state.sixes.raid.day, cam.state.day + 2);
  // nobody quiet is ever warned: the meter is what you do on their ground
  assert.ok(!step(cfg, banked(at('crib', { day: 6, hour: 21 }), 5000), { do: 'sleep' }).events.some(x => x.what === 'raidWarned'));
});

test('the night: home, the raid fight is the outcome; held, a truce and their pockets; beaten, the clinic, a share, the gun in your hands', () => {
  let won = null, lost = null;
  for (let seed = 1; seed < 80 && !(won && lost); seed++) {
    const s = { ...banked(at('crib', { day: 8, hour: 22, sixes: sixes(X.raid, 8, { raid: { day: 8, warned: 7, crew: 'rush', size: 0, n: 2, stake: 600 } }) }, seed), 580),
      things: { sixshot: true }, ammo: { sixshot: 24 }, owned: { cutter: true, pocket: false, bed: false } };
    const r = step(cfg, s, { do: 'sleep' });
    const e = r.events.find(x => x.type === 'raid' && x.kind === 'sixes');
    assert.ok(e && e.home && e.duel, 'a fight at home');
    assert.equal(r.state.sixes.raid, null);
    assert.ok(checkRunBooks(r.state).ok);
    if (e.fight.result === 'won' && !won) won = { s, r, e };
    if (e.fight.result !== 'won' && !lost) lost = { s, r, e };
  }
  assert.ok(won && lost);
  // held: nothing taken, the truce, the meter down, rounds spent, their pockets banked
  assert.equal(won.e.taken, 0);
  assert.equal(won.r.state.sixes.truce, won.s.day + Y.truce);
  assert.equal(sixesOf(cfg, won.r.state).value, Y.afterWin);
  assert.equal(won.r.state.ammo.sixshot, 24 - won.e.fight.spent);
  assert.ok(won.e.spoils >= 0);
  // beaten: the clinic, a share of what is banked (the cereal box would keep its part), the gun in your hands
  assert.ok(lost.e.taken > 0);
  assert.equal(lost.r.state.things.sixshot, undefined);
  assert.equal(lost.e.lostGun.item, 'sixshot');
  assert.equal(sixesOf(cfg, lost.r.state).value, Y.afterLoss);
  assert.match(lost.r.events.find(x => x.type === 'released')?.text ?? '', /clinic/);
  // during the truce: no tax, nobody on the kerb
  const t = { ...carrying(at('market', { day: won.r.state.day, hour: 18, sixes: { ...won.r.state.sixes, marks: [{ why: 'sell', text: 'x', n: 6, day: won.r.state.day }], did: won.r.state.day, made: 50, madeDay: won.r.state.day } }), 60) };
  assert.equal(step(cfg, t, { do: 'subway', to: 'park', hop: false }).state.place, 'park');
});

test('out for the night: the door decides it; hiding places keep cash, goods and things by one rule; things at risk can go', () => {
  const s = { ...banked(at('market', { day: 8, hour: 22, energy: 0, sixes: sixes(X.raid, 8, { raid: { day: 8, warned: 7, crew: 'rush', size: 1, n: 3, stake: 900 } }) }), 980),
    stash: { smokes: 4 }, things: { cereal: true, falsewall: true, doorman: true, sixshot: true, chopper: true }, ammo: { doorman: 6 } };
  const h = hiddenOf(cfg, s);
  assert.equal(h.cash, cfg.things.cereal.hides.cash);
  assert.equal(h.goods, true);
  assert.deepEqual(h.things, thingsAtRisk(cfg, s).slice(0, cfg.things.falsewall.hides.things).map(x => x.item)); // the dearest first
  let gotIn = null;
  for (let seed = 1; seed < 40 && !gotIn; seed++) {
    const r = step(cfg, { ...s, seed }, { do: 'rough' });
    const e = r.events.find(x => x.type === 'raid' && x.kind === 'sixes');
    assert.ok(e && !e.home && !e.duel);
    if (e.gotIn) gotIn = { r, e };
  }
  assert.ok(gotIn);
  const { r, e } = gotIn;
  assert.equal(e.taken, Math.floor(((1000 - h.cash) * Y.outShare) / 100));
  assert.deepEqual(r.state.stash, { smokes: 4 }); // behind the false wall
  for (const k of h.things) assert.ok(r.state.things[k], `${k} hidden`);
  // the one not hidden is at risk (taken half the time): whatever went is said
  for (const x of e.thingsTaken) assert.ok(!r.state.things[x.item]);
  // a piece knocked out (never taken): owned still, doing nothing until its last day out has passed
  assert.ok(thingsToKnock(cfg, { ...s, things: { doorbar: true } }).some(x => x.item === 'doorbar'));
  assert.ok(!thingsAtRisk(cfg, { ...s, things: { doorbar: true } }).length);
  const out = { ...s, things: { doorbar: true }, home: { ...s.home, out: { doorbar: s.day } } };
  assert.equal(raidOf(cfg, out).pieces.bar, 0);
  assert.equal(raidOf(cfg, { ...out, day: s.day + 1 }).pieces.bar, cfg.things.doorbar.defends.bar);
  assert.ok(checkRunBooks(r.state).ok);
});

test('guns: bought where they are sold, rounds by the box, held at your door only; each gun its numbers in the table', () => {
  // never in a one-on-one: what you fight with has no gun in it
  const s0 = { ...at('market', { hour: 15 }), things: { sixshot: true, doorman: true }, ammo: { sixshot: 0, doorman: 6 } };
  assert.ok(!armsOf(cfg, s0).some(a => cfg.things[a]?.gun));
  assert.deepEqual(holdsOf(cfg, s0).filter(h => cfg.things[h]?.gun), ['doorman']); // (no rounds, no Six-shot)
  assert.equal(holdOf(cfg, s0), 'doorman');
  // sold by Teo at the market, rounds by the box from him
  const m = carrying(at('market', { hour: 15 }), 200);
  const buy = step(cfg, m, { do: 'get', item: 'sixshot' });
  assert.ok(buy.state.things.sixshot);
  const box = step(cfg, buy.state, { do: 'ammo', item: 'sixshot' });
  assert.equal(box.state.ammo.sixshot, cfg.things.sixshot.ammo.n);
  assert.equal(box.state.books.ammo, cfg.things.sixshot.ammo.price);
  const held = step(cfg, box.state, { do: 'holdWith', with: 'hands' });
  assert.equal(held.state.holdWith, 'hands');
  // a gun's behaviour is its table fields: change `gun` or `holdFire` and the raid fight changes with no code
  const d = raidOf(cfg, { ...s0, sixes: sixes(9, 2, { raid: { day: 2, crew: 'rush', size: 1 } }) }, { hold: 'doorman' });
  assert.equal(d.inputs.you.weapon, cfg.things.doorman.gun);
  assert.equal(d.inputs.you.holdFire, cfg.things.doorman.holdFire);
  const other = withRunConfig({ things: { doorman: { gun: 'pistol', holdFire: null } } });
  assert.equal(raidOf(other, { ...s0, sixes: sixes(9, 2, { raid: { day: 2, crew: 'rush', size: 1 } }) }, { hold: 'doorman' }).inputs.you.weapon, 'pistol');
  // loud: the heat of a night of firing
  assert.equal(gunHeat(cfg, s0, 'chopper', 10), cfg.things.chopper.loud);
  assert.equal(gunHeat(cfg, s0, 'chopper', 0), 0);
});

test('the raid fight: the same inputs and seed are the same fight; what you own helps; the odds are its own sample', () => {
  const s = { ...at('crib'), owned: { cutter: true, pocket: false, bed: false }, sixes: sixes(9, 2, { raid: { day: 2, crew: 'rush', size: 1 } }) };
  const d = raidOf(cfg, s);
  const a = runRaid(d.inputs, 77);
  const b = runRaid(d.inputs, 77);
  assert.deepEqual(a.events, b.events);
  const c = raidChance(cfg, s);
  assert.equal(c.n, Y.sample);
  const more = raidChance(cfg, { ...s, things: { doorbar: true, fogger: true, vest: true } });
  assert.ok(more.pct > c.pct, `pieces help: ${more.pct} against ${c.pct}`);
  const o = raidOdds(cfg, s);
  assert.ok(o.withPiece.fogger != null && o.withEarl != null);
  // the crew's door fight (sixes-1) is the same fight it was: no gun, no fogger, nothing new in it
  const crew = { you: { weapon: 'hands', hp: 100, max: 100, hits: 1.8 }, foe: cfg.crew.foes[0], foes: cfg.crew.foes, cap: 25, hit: 0.45, brawl: { ...cfg.duel.brawl }, arena: { ...cfg.duel.arena, around: cfg.crew.around } };
  assert.deepEqual(runDuel(crew, 5).events, runDuel(crew, 5).events);
  assert.throws(() => runDuel({ ...crew, you: { ...crew.you, weapon: 'pistol' } }, 5), /no gun/);
});

test('the push: the tax climbs each day in a row they stop you, a day off starts it again', () => {
  assert.equal(taxPctOf(cfg, 1), X.taxPct);
  assert.equal(taxPctOf(cfg, 2), X.taxPct + X.push.perDay);
  assert.equal(taxPctOf(cfg, 99), X.push.maxPct);
  assert.equal(taxOf(cfg, 200, 3), Math.floor((200 * (X.taxPct + 2 * X.push.perDay)) / 100));
  const day = 6;
  const s = carrying({ ...at('market', { day, hour: 18 }), sixes: sixes(5, day, { did: day, made: 100, madeDay: day, streak: 2, streakDay: day - 1 }) }, 100);
  const r = step(cfg, s, { do: 'subway', to: 'park', hop: false });
  assert.equal(r.state.sixes.tax.streak, 3);
  assert.equal(r.state.sixes.tax.wants, taxOf(cfg, 100, 3));
  const gap = step(cfg, { ...s, sixes: { ...s.sixes, streakDay: day - 2 } }, { do: 'subway', to: 'park', hop: false });
  assert.equal(gap.state.sixes.tax.streak, 1);
});

test('saves: version 12; a version-11 save loads with no rounds, nothing held, no raid, and plays on', () => {
  assert.equal(RUN_STATE_VERSION, 14); // (pot-1: 13, reading 12; bench-1: 14)
  const s = { ...at('market', { day: 2 }), v: 11 };
  delete s.ammo;
  delete s.holdWith;
  delete s.books.ammo;
  for (const k of ['streak', 'streakDay', 'raid', 'raids', 'truce', 'raidLast']) delete s.sixes[k];
  const r = loadRun(JSON.stringify({ kind: 'the-run', v: 11, state: s }));
  assert.ok(r.ok, r.text);
  assert.equal(r.state.v, RUN_STATE_VERSION);
  assert.deepEqual(r.state.ammo, {});
  assert.equal(r.state.holdWith, null);
  assert.equal(r.state.sixes.raid, null);
  assert.ok(step(cfg, r.state, view(cfg, r.state).options[0].choice).state);
  const mine = { ...at('crib'), ammo: { doorman: 4 }, holdWith: 'doorman', things: { doorman: true } };
  const back = loadRun(saveRun(mine));
  assert.ok(back.ok, back.text);
  assert.deepEqual(back.state.ammo, { doorman: 4 });
});

test('the scripted players of the raid play a season and keep their books', () => {
  for (const [p, kit] of [[POLICIES.armed(120), { cutter: true, doorman: true, ammo: { doorman: 18 } }], [POLICIES.handsOnly(120), { cutter: true, doorbar: true, fogger: true }], [POLICIES.moved(120), {}]]) {
    const r = playSeason(cfg, { seed: 4, policy: p, kit, days: 12 });
    assert.ok(checkRunBooks(r.state).ok);
  }
});
