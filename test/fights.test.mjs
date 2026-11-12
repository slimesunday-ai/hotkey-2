import test from 'node:test';
import assert from 'node:assert/strict';
import { countGood } from '../src/state.mjs';
import { contestOdds, bandOf, rollContest } from '../src/contest.mjs';
import { checkBooks } from '../src/ledger.mjs';
import { newSeason, play, seat, addGood, viewOf, fund, QUIET } from './helpers.mjs';

const cfg = QUIET;

function scene() {
  const game = newSeason({ seed: 1, police: null, cfg });
  const { state } = game;
  for (const id of state.order) {
    state.agents[id].goods = { chems: 0, parts: 0, product: {}, guns: {} };
    for (const skill of Object.keys(state.agents[id].skills)) state.agents[id].skills[skill] = 0;
  }
  return { game, state, R: seat(state, 'robber'), D: seat(state, 'dealer'), M: seat(state, 'muscle') };
}

test('one formula: 50, plus the attacker, minus the defender, kept between 10 and 90', () => {
  const { state, R, D, M } = scene();
  assert.equal(contestOdds(cfg, state, 'rob', R, D).P, 50);
  R.skills.ambush = 2;
  addGood(R, 'gun', 1, 1);
  D.skills.toughness = 3;
  const odds = contestOdds(cfg, state, 'rob', R, D);
  assert.equal(odds.P, 50 + 10 + 15 - 15);
  assert.deepEqual(odds.why, ['a gun +15', 'Ambush 2 +10', `${D.name}'s Toughness 3 −15`]);
  // a muscle under contract on the block adds its Bodyguard and Toughness to the client's defence
  M.skills.bodyguard = 2;
  M.skills.toughness = 1;
  state.contracts.push({ id: 'c1', muscle: M.id, client: D.id, hours: 4, price: 40, perHour: 10, held: 40, t0: 0, until: 4, active: true, paidHours: 0 });
  assert.equal(contestOdds(cfg, state, 'rob', R, D).P, 60 - 12 - 3);
  // and never outside 10 to 90
  R.skills.ambush = 5;
  R.skills.toughness = 5;
  R.skills.aim = 5;
  state.contracts = [];
  D.skills.toughness = 0;
  assert.equal(contestOdds(cfg, state, 'rob', R, D).P, 90);
});

test('outcomes come in degrees', () => {
  assert.equal(bandOf(cfg, 60, 39), 'clean');
  assert.equal(bandOf(cfg, 60, 40), 'messy');
  assert.equal(bandOf(cfg, 60, 60), 'fail');
  assert.equal(bandOf(cfg, 60, 80), 'disaster');
});

test('the menu shows the same odds the engine rolls, with the reasons', () => {
  const { game, state, R, D } = scene();
  R.skills.ambush = 2;
  const entry = viewOf(game, R).menu.find(m => m.verb === 'attack' && m.move.target === D.id && m.move.how === 'rob');
  assert.equal(entry.odds, 60);
  assert.deepEqual(entry.why, ['Ambush 2 +10']);
  assert.equal(rollContest(cfg, state, 'rob', R, D).P, 60);
});

test('a clean robbery: 50% of the cash and the biggest lot, the target to the clinic, heat on the robber', () => {
  const { game, state, R, D } = scene();
  fund(state, D, { cash: 200 });
  addGood(D, 'product', 6, 3);
  addGood(D, 'chems', 2);
  state.rig = { rolls: [0] };
  const line = play(game, { [R.id]: { move: { verb: 'attack', target: D.id, how: 'rob' } } });
  assert.equal(R.cash, cfg.start.cash + (200 * cfg.rob.cleanCashPct) / 100);
  assert.equal(countGood(R, 'product', 3), 6, 'the most valuable lot');
  assert.equal(D.goods.chems, 2);
  assert.equal(D.state, 'clinic');
  play(game, {});
  assert.equal(D.state, 'free', 'one hour in the clinic, out by the end of it');
  assert.equal(D.block, 'bar', 'a patient walks out onto the bar block');
  assert.equal(R.heat, cfg.rob.heat);
  assert.equal(R.stats.robWins, 1);
  assert.ok(line.events.some(e => e.kind === 'rob:clean' && e.big));
  assert.equal(state.trust[D.id][R.id].score, -3);
  assert.equal(D.grudges[0].against, R.id);
  assert.ok(checkBooks(state).ok);
});

test('attacks land before movement: a target that meant to walk away is still there', () => {
  const { game, state, R, D } = scene();
  fund(state, D, { cash: 100 });
  state.rig = { rolls: [0] };
  const line = play(game, { [R.id]: { move: { verb: 'attack', target: D.id, how: 'rob' } }, [D.id]: { move: { verb: 'move', to: 'market' } } });
  assert.equal(R.stats.robWins, 1);
  assert.match(line.agents[D.id].text, /clinic/, 'the target lost its move');
  assert.notEqual(D.block, 'market');
});

test('a failed robbery puts the robber in the clinic; a disaster ends in an arrest, or a bullet if the target is armed', () => {
  let s = scene();
  s.state.rig = { rolls: [55] };
  play(s.game, { [s.R.id]: { move: { verb: 'attack', target: s.D.id, how: 'rob' } } });
  assert.equal(s.R.stats.clinicHours, cfg.rob.failClinic);
  assert.equal(s.D.cash, cfg.start.cash);

  s = scene();
  addGood(s.R, 'gun', 1, 1);
  s.state.rig = { rolls: [99] };
  let line = play(s.game, { [s.R.id]: { move: { verb: 'attack', target: s.D.id, how: 'rob' } } });
  assert.equal(s.R.state, 'jail');
  assert.equal(countGood(s.R, 'gun'), 0, 'guns are seized');
  assert.ok(line.events.some(e => e.kind === 'rob:disaster:arrest'));

  s = scene();
  addGood(s.D, 'gun', 1, 1);
  s.state.rig = { rolls: [99] };
  line = play(s.game, { [s.R.id]: { move: { verb: 'attack', target: s.D.id, how: 'rob' } } });
  assert.equal(s.R.state, 'clinic');
  assert.ok(line.events.some(e => e.kind === 'rob:disaster:shot'));
});

test('every victim gets an answer: the robber’s block, a crime tip, and 6 hours to win it back', () => {
  const { game, state, R, D } = scene();
  fund(state, D, { cash: 200 });
  addGood(D, 'product', 4, 2);
  state.rig = { rolls: [0] };
  play(game, { [R.id]: { move: { verb: 'attack', target: D.id, how: 'rob' } } });
  play(game, { [R.id]: { move: { verb: 'move', to: 'market' } } });
  let view = viewOf(game, D);
  assert.equal(view.robbed[0].robber, R.id);
  assert.equal(view.robbed[0].robberBlock, 'market');
  assert.ok(view.tips.some(tip => tip.type === 'crime' && tip.subject === R.id), 'the victim holds the crime tip');
  assert.ok(view.menu[0].answer, 'the answers lead the menu');
  assert.match(view.menu[0].label, /after/);
  // the victim catches up and wins the fight: what's left comes back
  D.block = 'market';
  view = viewOf(game, D);
  assert.match(view.menu[0].label, /take back/);
  state.rig = { rolls: [0] };
  const line = play(game, { [D.id]: { move: { verb: 'attack', target: R.id, how: 'fight' } } });
  assert.equal(countGood(D, 'product', 2), 4);
  assert.equal(D.cash, 200 - cfg.rob.cleanTargetClinic * cfg.clinic.perHour, 'all of it back, less the clinic bill');
  assert.ok(line.events.some(e => e.kind === 'loot:back'));
  assert.ok(checkBooks(state).ok);
});

test('a stash is never immune: a break-in with the owner out, and a fight at the door with the owner home', () => {
  let s = scene();
  fund(s.state, s.D, { stash: 300 });
  s.D.block = 'uptown';
  let entry = viewOf(s.game, s.R).menu.find(m => m.move.how === 'break-in' && m.move.target === s.D.id);
  assert.match(entry.label, /they are out/);
  s.state.rig = { rolls: [0] };
  let line = play(s.game, { [s.R.id]: { move: { verb: 'attack', target: s.D.id, how: 'break-in' } } });
  assert.equal(s.D.stash, 300 - (300 * cfg.breakIn.cleanStashPct) / 100);
  assert.ok(line.events.some(e => e.kind === 'breakin:clean' && e.stage.spot === `door:${s.D.id}`));
  assert.equal(viewOf(s.game, s.D).robbed.length, 0, "the owner doesn't know yet");
  s.D.block = 'market';
  play(s.game, { [s.D.id]: { move: { verb: 'move', to: 'projects' } } });
  assert.equal(viewOf(s.game, s.D).robbed.length, 1, 'it finds out when it gets home');

  // owner home: the owner's Toughness and gun count, and it knows at once
  s = scene();
  fund(s.state, s.D, { stash: 300 });
  s.D.skills.toughness = 2;
  addGood(s.D, 'gun', 1, 1);
  entry = viewOf(s.game, s.R).menu.find(m => m.move.how === 'break-in' && m.move.target === s.D.id);
  assert.match(entry.label, /fight at the door/);
  assert.equal(entry.odds, 50 - 10 - 10);
  s.state.rig = { rolls: [0] };
  line = play(s.game, { [s.R.id]: { move: { verb: 'attack', target: s.D.id, how: 'break-in' } } });
  assert.ok(line.events.some(e => e.kind === 'door:clean'));
  assert.equal(s.D.stash, 300 - (300 * cfg.breakIn.cleanStashPct) / 100);
  assert.equal(s.D.cash, cfg.start.cash - cfg.rob.cleanTargetClinic * cfg.clinic.perHour, 'a break-in takes the stash, not the pocket');
  // only a robber breaks in
  const no = play(s.game, { [s.M.id]: { move: { verb: 'attack', target: s.D.id, how: 'break-in' } } });
  assert.equal(no.agents[s.M.id].ok, false);
});

test('the crew pot sits in the boss’s pad: a break-in there takes its share', () => {
  const { game, state, R, D, M } = scene();
  state.crews.k1 = { id: 'k1', name: 'the firm', boss: D.id, members: [D.id, M.id], cut: 10, pot: 200, paidIn: {} };
  D.crew = 'k1';
  M.crew = 'k1';
  state.books.start += 200;
  D.block = 'uptown';
  M.block = 'uptown';
  state.rig = { rolls: [0] };
  play(game, { [R.id]: { move: { verb: 'attack', target: D.id, how: 'break-in' } } });
  assert.equal(state.crews.k1.pot, 200 - (200 * cfg.breakIn.cleanStashPct) / 100);
  assert.ok(checkBooks(state).ok);
});

test('a muscle that robs its client ends the contract, forfeits the pay and is marked a betrayer', () => {
  const { game, state, D, M } = scene();
  state.contracts.push({ id: 'c1', muscle: M.id, client: D.id, hours: 4, price: 40, perHour: 10, held: 40, t0: 0, until: 4, active: true, paidHours: 0 });
  state.books.start += 40;
  state.rig = { rolls: [0] };
  play(game, { [M.id]: { move: { verb: 'attack', target: D.id, how: 'rob' } } });
  assert.equal(state.contracts.find(c => c.id === 'c1')?.active ?? false, false);
  assert.equal(M.stats.betrayals, 1);
  assert.ok(checkBooks(state).ok);
});

test('collecting an overdue debt: a muscle keeps a 20% fee and the lender gets the rest', () => {
  const { game, state, D, M } = scene();
  const lender = seat(state, 'cook');
  state.loans.push({ id: 'l1', lender: lender.id, borrower: D.id, amount: 80, owed: 80, due: 0, status: 'overdue', t: 0 });
  D.block = 'corner';
  M.block = 'corner';
  fund(state, D, { cash: 0, stash: 0 }); // the hourly sweep would take cash, so the money is in the stash
  // nothing to take on the street
  state.rig = { rolls: [0] };
  play(game, { [M.id]: { move: { verb: 'attack', target: D.id, how: 'collect' } } });
  assert.equal(state.loans[0].owed, 80);
  // at home, the stash is in reach
  D.block = 'projects';
  M.block = 'projects';
  fund(state, D, { stash: 100 });
  D.state = 'free';
  M.state = 'free';
  state.rig = { rolls: [0] };
  play(game, { [M.id]: { move: { verb: 'attack', target: D.id, how: 'collect' } } });
  assert.equal(state.loans[0].status, 'collected');
  assert.equal(D.stash, 20);
  assert.ok(M.cash >= cfg.start.cash + 16);
  assert.ok(checkBooks(state).ok);
});

test('XP comes from deals and danger: capped a day, and repeated safe work earns nothing more', () => {
  const { game, state, R, D } = scene();
  const cook = seat(state, 'cook');
  addGood(cook, 'chems', 12);
  cook.skills.steady = 5; // no blow-ups
  state.rig = { chances: [99, 99, 99, 99] };
  for (let i = 0; i < 4; i++) play(game, { [cook.id]: { move: { verb: 'work' } } });
  assert.equal(cook.xp, 1, 'the first work of the day, and nothing for the next three');
  // risks: at most cfg.xp.risksPerDay a day
  for (let i = 0; i < 4; i++) {
    R.state = 'free';
    D.state = 'free';
    R.block = D.block = 'corner';
    R.heat = 0;
    state.rig = { rolls: [55] };
    play(game, { [R.id]: { move: { verb: 'attack', target: D.id, how: 'rob' } } });
  }
  assert.equal(R.xpDay.risks, cfg.xp.risksPerDay);
  assert.equal(R.xp, cfg.xp.risksPerDay + 1, 'the risks, and one beating');
});
