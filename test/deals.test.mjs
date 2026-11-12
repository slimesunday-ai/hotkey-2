import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.mjs';
import { countGood, lastDueHour } from '../src/state.mjs';
import { courierFee, fenceBuys, fenceSells, bailFor } from '../src/market.mjs';
import { checkBooks } from '../src/ledger.mjs';
import { newSeason, play, seat, addGood, viewOf, fund, QUIET } from './helpers.mjs';

const cfg = QUIET;

/** A quiet city: no police, and the two people we care about, cleaned of their starting kit. */
function scene(a = 'cook', b = 'dealer') {
  const game = newSeason({ seed: 1, police: null, cfg });
  const { state } = game;
  for (const id of state.order) state.agents[id].goods = { chems: 0, parts: 0, product: {}, guns: {} };
  return { game, state, A: seat(state, a), B: seat(state, b) };
}

test('saying yes is free: an accept rides along with any move and costs no hour', () => {
  const { game, state, A, B } = scene();
  addGood(A, 'product', 6, 3);
  play(game, { [A.id]: { move: { verb: 'offer', to: B.id, terms: { kind: 'sell', good: 'product', q: 3, n: 6, each: 10 } } } });
  const offer = state.offers.find(o => o.from === A.id);
  assert.equal(offer.visibleAt, 1, 'it reaches the other side next hour');
  // B accepts and works its own move in the same hour
  const line = play(game, { [B.id]: { move: { verb: 'rest' }, accept: [offer.id] } });
  assert.equal(line.agents[B.id].text, 'rested');
  assert.match(line.agents[B.id].accepts[0], /closed with/);
  // both are home on the same block, so the swap happens at once
  assert.equal(countGood(B, 'product', 3), 6);
  assert.equal(A.cash, cfg.start.cash + 60);
  assert.equal(B.cash, cfg.start.cash - 60);
  assert.equal(B.stats.handoffs, 1);
});

test('an offer cannot be accepted the hour it is made, by its maker, or after it runs out', () => {
  const { game, state, A, B } = scene();
  addGood(A, 'product', 2, 1);
  play(game, { [A.id]: { move: { verb: 'offer', to: B.id, terms: { kind: 'sell', good: 'product', q: 1, n: 2, each: 5 } } }, [B.id]: { accept: ['o1'] } });
  assert.equal(countGood(B, 'product', 1), 0, 'not visible yet');
  for (let i = 0; i < 1 + cfg.deals.offerHours; i++) play(game, {});
  const line = play(game, { [B.id]: { accept: ['o1'] } });
  assert.match(line.agents[B.id].accepts[0], /couldn't accept/);
});

test('a pick-up swaps the moment the two share a block, even if one is busy', () => {
  const { game, state, A, B } = scene('smuggler', 'cook');
  addGood(A, 'chems', 6);
  A.block = 'docks';
  play(game, { [A.id]: { move: { verb: 'offer', to: B.id, terms: { kind: 'sell', good: 'chems', n: 6, each: 10 } } } });
  play(game, { [B.id]: { accept: ['o1'] } });
  assert.equal(state.pickups.length, 1, 'closed by phone, the goods still have to walk');
  assert.equal(B.goods.chems, 0);
  const view = viewOf(game, A);
  assert.equal(view.pickups[0].with, B.id);
  assert.equal(view.pickups[0].moves, 2);
  assert.equal(view.menu[0].verb, 'move', 'the pick-up leads the menu');
  assert.match(view.menu[0].label, /pick-up/);
  play(game, { [A.id]: { move: { verb: 'move', to: 'corner' } } });
  assert.equal(B.goods.chems, 0);
  // the smuggler arrives while the cook is resting: it swaps anyway
  const line = play(game, { [A.id]: { move: { verb: 'move', to: 'projects' } }, [B.id]: { move: { verb: 'rest' } } });
  assert.equal(B.goods.chems, 6);
  assert.equal(A.cash, cfg.start.cash + 60);
  assert.equal(state.pickups.length, 0);
  assert.ok(line.events.some(e => e.kind === 'pickup' && e.stage.spot.startsWith('door:')), 'staged at the seller’s door in the projects');
});

test('a pick-up lapses after 6 hours and costs each side trust', () => {
  const { game, state, A, B } = scene('smuggler', 'cook');
  addGood(A, 'chems', 3);
  A.block = 'docks';
  play(game, { [A.id]: { move: { verb: 'offer', to: B.id, terms: { kind: 'sell', good: 'chems', n: 3, each: 10 } } } });
  play(game, { [B.id]: { accept: ['o1'] } });
  for (let i = 0; i < cfg.deals.pickupHours + 1; i++) play(game, {});
  assert.equal(state.pickups.length, 0);
  assert.equal(state.trust[A.id][B.id].score, -1);
  assert.equal(state.trust[B.id][A.id].score, -1);
});

test('coming up short at the meeting swaps what it can and marks the short side', () => {
  const { game, state, A, B } = scene('smuggler', 'cook');
  addGood(A, 'chems', 6);
  A.block = 'corner';
  play(game, { [A.id]: { move: { verb: 'offer', to: B.id, terms: { kind: 'sell', good: 'chems', n: 6, each: 10 } } } });
  play(game, { [B.id]: { accept: ['o1'] } });
  fund(state, B, { cash: 25 }); // spent it on the way
  const line = play(game, { [A.id]: { move: { verb: 'move', to: 'projects' } } });
  assert.equal(B.goods.chems, 2);
  assert.equal(B.cash, 5);
  assert.equal(state.trust[A.id][B.id].score, 0, 'a clean deal +1, came up short −1');
  assert.ok(line.events.some(e => e.kind === 'pickup:short'));
});

test('the courier skips the walk for 25%, paid by whoever asked for it, and the fee leaves the city', () => {
  const { game, state, A, B } = scene('smuggler', 'cook');
  addGood(A, 'chems', 6);
  A.block = 'docks';
  play(game, { [A.id]: { move: { verb: 'offer', to: B.id, terms: { kind: 'sell', good: 'chems', n: 6, each: 10 } } } });
  play(game, { [B.id]: { accept: [{ id: 'o1', courier: true }] } });
  const fee = courierFee(cfg, 60);
  assert.equal(fee, 15);
  assert.equal(B.goods.chems, 6);
  assert.equal(B.cash, cfg.start.cash - 60 - fee);
  assert.equal(A.cash, cfg.start.cash + 60);
  assert.equal(state.books.out.courier, fee);
  assert.equal(B.stats.couriered, 1);
  assert.equal(B.stats.handoffs, 0);
});

test('a board listing stays up until it sells, takes part orders, and a new one replaces it', () => {
  const { game, state, A, B } = scene('cook', 'dealer');
  const C = seat(state, 'dealer', 1);
  addGood(A, 'product', 10, 3);
  play(game, { [A.id]: { move: { verb: 'offer', to: 'anyone', terms: { kind: 'sell', good: 'product', q: 3, n: 10, each: 10 } } } });
  for (let i = 0; i < 6; i++) play(game, {});
  assert.equal(state.offers.find(o => o.id === 'o1').status, 'open', 'still up after 6 hours');
  play(game, { [B.id]: { accept: [{ id: 'o1', units: 4 }] } });
  assert.equal(countGood(B, 'product', 3), 4);
  assert.equal(state.offers.find(o => o.id === 'o1').terms.n, 6, 'the rest stays up');
  // a new listing for the same goods replaces the old one
  play(game, { [A.id]: { move: { verb: 'offer', to: 'anyone', terms: { kind: 'sell', good: 'product', q: 3, n: 6, each: 12 } } } });
  assert.equal(state.offers.filter(o => o.from === A.id && o.status === 'open').length, 1);
  play(game, { [C.id]: { accept: [state.offers.find(o => o.from === A.id && o.status === 'open').id] } });
  assert.equal(countGood(C, 'product', 3), 6);
  assert.equal(C.cash, cfg.start.cash - 72);
});

test('a seller can only promise what it holds free: a listing sells out', () => {
  const { game, state, A, B } = scene('cook', 'dealer');
  const C = seat(state, 'dealer', 1);
  addGood(A, 'product', 4, 3);
  B.block = 'uptown';
  C.block = 'uptown';
  play(game, { [A.id]: { move: { verb: 'offer', to: 'anyone', terms: { kind: 'sell', good: 'product', q: 3, n: 4, each: 10 } } } });
  const line = play(game, { [B.id]: { accept: ['o1'] }, [C.id]: { accept: ['o1'] } });
  const texts = [line.agents[B.id].accepts[0], line.agents[C.id].accepts[0]];
  assert.equal(texts.filter(x => /closed with/.test(x)).length, 1, 'only one of them gets it');
  assert.equal(state.pickups.reduce((sum, p) => sum + p.aGives.n, 0), 4);
});

test('on credit: the goods change hands now, income pays the seller first, and unpaid at the due hour is a betrayal', () => {
  const { game, state, A, B } = scene('cook', 'dealer');
  addGood(A, 'product', 6, 3);
  fund(state, B, { cash: 0 });
  play(game, { [B.id]: { move: { verb: 'offer', to: 'anyone', terms: { kind: 'buy', good: 'product', q: 3, n: 6, each: 50, due: 6 } } } });
  play(game, { [A.id]: { accept: ['o1'] } });
  assert.equal(countGood(B, 'product', 3), 6, 'handed over with no cash');
  const loan = state.loans[0];
  assert.deepEqual([loan.lender, loan.borrower, loan.owed, loan.due, loan.credit], [A.id, B.id, 300, 6, true]);
  // the dealer sells: every dollar goes to the cook first
  B.block = 'corner';
  const before = A.cash;
  play(game, { [B.id]: { move: { verb: 'work', option: 'sell' } } });
  const paid = 300 - loan.owed;
  assert.ok(paid > 0);
  assert.equal(A.cash, before + paid);
  assert.equal(B.cash, 0, 'nothing left for the dealer until the cook is paid');
  // the rest goes unpaid: overdue at hour 6
  B.goods.product = {};
  while (state.t <= 6) play(game, {});
  assert.equal(loan.status, 'overdue');
  assert.equal(B.stats.betrayals, 1);
  assert.equal(state.trust[A.id][B.id].score < 0, true);
  // an overdue debt keeps taking whatever the borrower carries
  fund(state, B, { cash: 50 });
  play(game, {});
  assert.equal(B.cash, 0);
  assert.equal(loan.owed, 300 - paid - 50);
  assert.ok(checkBooks(state).ok);
});

test('an order to buy is filled with the quality asked for or better', () => {
  const { game, state, A, B } = scene('cook', 'dealer');
  addGood(A, 'product', 5, 4);
  play(game, { [B.id]: { move: { verb: 'offer', to: 'anyone', terms: { kind: 'buy', good: 'product', q: 2, n: 5, each: 10 } } } });
  play(game, { [A.id]: { accept: ['o1'] } });
  assert.equal(countGood(B, 'product', 4), 5);
  // but never with worse
  const { game: g2, state: s2, A: A2, B: B2 } = scene('cook', 'dealer');
  addGood(A2, 'product', 5, 1);
  play(g2, { [B2.id]: { move: { verb: 'offer', to: 'anyone', terms: { kind: 'buy', good: 'product', q: 2, n: 5, each: 10 } } } });
  const line = play(g2, { [A2.id]: { accept: ['o1'] } });
  assert.match(line.agents[A2.id].accepts[0], /couldn't accept/);
});

test('the fence and the gun shop trade at posted prices, only on their block', () => {
  const { game, state, A } = scene('dealer');
  addGood(A, 'product', 3, 2);
  let line = play(game, { [A.id]: { move: { verb: 'offer', to: 'fence', terms: { kind: 'sell', good: 'product', q: 2, n: 3 } } } });
  assert.equal(line.agents[A.id].ok, false, 'not from the projects');
  A.block = 'market';
  play(game, { [A.id]: { move: { verb: 'offer', to: 'fence', terms: { kind: 'sell', good: 'product', q: 2, n: 3 } } } });
  assert.equal(A.cash, cfg.start.cash + 3 * fenceBuys(cfg, 'product', 2));
  assert.equal(state.books.in.fence, 3 * fenceBuys(cfg, 'product', 2));
  const cash = A.cash;
  play(game, { [A.id]: { move: { verb: 'offer', to: 'fence', terms: { kind: 'buy', good: 'product', n: 2 } } } });
  assert.equal(A.cash, cash - 2 * fenceSells(cfg, 'product'));
  assert.equal(countGood(A, 'product', 1), 2, 'the fence only has quality 1');
  fund(state, A, { cash: cfg.gunshop.price });
  play(game, { [A.id]: { move: { verb: 'offer', to: 'gunshop', terms: { kind: 'buy', good: 'gun' } } } });
  assert.equal(countGood(A, 'gun'), 1);
  assert.equal(A.cash, 0);
});

test('a loan: cash by hand now, collected by the game when due, never later than 21:00 on day 5', () => {
  const { game, state, A, B } = scene('cook', 'dealer');
  const tooLate = play(game, { [A.id]: { move: { verb: 'offer', to: B.id, terms: { kind: 'loan', amount: 50, repay: 60, due: lastDueHour(cfg) + 1 } } } });
  assert.equal(tooLate.agents[A.id].ok, false);
  play(game, { [A.id]: { move: { verb: 'offer', to: B.id, terms: { kind: 'loan', amount: 50, repay: 60, due: 5 } } } });
  play(game, { [B.id]: { accept: [state.offers[0].id] } });
  assert.equal(B.cash, cfg.start.cash + 50);
  assert.equal(A.cash, cfg.start.cash - 50);
  while (state.t <= 5) play(game, {});
  assert.equal(A.cash, cfg.start.cash + 10);
  assert.equal(B.cash, cfg.start.cash - 10);
  assert.equal(state.loans[0].status, 'repaid');
  assert.equal(state.trust[A.id][B.id].score, 2, 'a clean deal, and paid back on time');
});

test('a protection contract: the game holds the pay and releases it by the hour; a quit forfeits the rest', () => {
  const { game, state, A, B } = scene('muscle', 'dealer');
  play(game, { [A.id]: { move: { verb: 'offer', to: B.id, terms: { kind: 'protect', hours: 4, price: 40 } } } });
  play(game, { [B.id]: { accept: ['o1'] } });
  const contract = state.contracts[0];
  assert.equal(B.cash, cfg.start.cash - 40);
  assert.equal(contract.held, 40);
  // the dealer walks; the muscle goes with it
  play(game, { [B.id]: { move: { verb: 'move', to: 'corner' } }, [A.id]: { move: { verb: 'work' } } });
  assert.equal(A.block, 'corner', 'a guard on duty moves with its client');
  assert.equal(A.cash, cfg.start.cash + 10);
  play(game, { [A.id]: { move: { verb: 'work' } } });
  assert.equal(A.cash, cfg.start.cash + 20);
  const line = play(game, { [A.id]: { move: { verb: 'quit', id: contract.id } } });
  assert.equal(contract.active, false);
  assert.equal(B.cash, cfg.start.cash - 20, 'the rest came back');
  assert.equal(A.stats.betrayals, 1);
  assert.ok(line.events.some(e => e.kind === 'quit' && e.big));
  assert.ok(checkBooks(state).ok);
});

test('a paid job: anyone can post one, the game holds the pay and pays the moment the deed is done', () => {
  const { game, state, A, B } = scene('dealer', 'robber');
  const mark = seat(state, 'cook');
  play(game, { [A.id]: { move: { verb: 'offer', to: 'anyone', terms: { kind: 'job', task: { type: 'rob', agent: mark.id }, pay: 60 } } } });
  assert.equal(A.cash, cfg.start.cash - 60, 'the pay is held from the moment it is posted');
  assert.ok(checkBooks(state).ok);
  play(game, { [B.id]: { accept: ['o1'] } });
  assert.equal(state.jobs[0].worker, B.id);
  state.rig = { rolls: [0] }; // a clean robbery
  const line = play(game, { [B.id]: { move: { verb: 'attack', target: mark.id, how: 'rob' } } });
  assert.equal(state.jobs.find(j => j.id === 'j1')?.status ?? 'done', 'done');
  assert.ok(B.cash >= cfg.start.cash + 60, 'paid on the deed');
  assert.ok(line.events.some(e => e.kind === 'job:done'));
});

test('a job nobody does gives the pay back; a guard job pays by the hour', () => {
  const { game, state, A, B } = scene('dealer', 'muscle');
  play(game, { [A.id]: { move: { verb: 'offer', to: B.id, terms: { kind: 'job', task: { type: 'guard', hours: 2 }, pay: 30 } } } });
  play(game, { [B.id]: { accept: ['o1'] } });
  play(game, {});
  play(game, {});
  assert.equal(B.cash, cfg.start.cash + 30);
  assert.equal(state.jobs.filter(j => j.status === 'taken').length, 0);
  // unearned: a board job lapses at midnight
  play(game, { [A.id]: { move: { verb: 'offer', to: 'anyone', terms: { kind: 'job', task: { type: 'fight', agent: B.id }, pay: 20 } } } });
  const cash = A.cash;
  while (state.t < cfg.season.hoursPerDay) play(game, {});
  play(game, {});
  assert.equal(A.cash, cash + 20);
});

test('a delivery job is done when the goods are handed over', () => {
  const { game, state, A, B } = scene('dealer', 'smuggler');
  const cook = seat(state, 'cook');
  addGood(B, 'chems', 4);
  play(game, { [A.id]: { move: { verb: 'offer', to: B.id, terms: { kind: 'job', task: { type: 'deliver', good: 'chems', n: 4, agent: cook.id }, pay: 25 } } } });
  play(game, { [B.id]: { accept: ['o1'] } });
  play(game, { [B.id]: { move: { verb: 'offer', to: cook.id, terms: { kind: 'gift', good: 'chems', n: 4 } } } });
  assert.equal(cook.goods.chems, 4);
  assert.equal(B.cash, cfg.start.cash + 25);
});

test('bail is paid at the precinct and the prisoner walks out next hour', () => {
  const { game, state, A, B } = scene('dealer', 'robber');
  B.state = 'jail';
  B.until = 30;
  B.jailStars = 3;
  A.block = 'precinct';
  fund(state, A, { cash: 200 });
  play(game, { [A.id]: { move: { verb: 'offer', to: 'police', terms: { kind: 'bail', agent: B.id } } } });
  assert.equal(A.cash, 200 - bailFor(cfg, 3));
  assert.equal(B.state, 'free', 'released at the end of the hour, ready for the next');
  assert.equal(B.block, 'precinct');
  assert.equal(state.trust[B.id][A.id].score, 2);
});

test('gifts need no accept and are handed over when the two meet', () => {
  const { game, state, A, B } = scene('cook', 'dealer');
  B.block = 'market';
  play(game, { [A.id]: { move: { verb: 'offer', to: B.id, terms: { kind: 'gift', cash: 30 } } } });
  assert.equal(B.cash, cfg.start.cash, 'cash moves by hand too');
  play(game, { [B.id]: { move: { verb: 'move', to: 'projects' } } });
  assert.equal(B.cash, cfg.start.cash + 30);
});
