// WHAT JUST HAPPENED, AS ONE CARD (ui-3 leg 1, demo/run/news.js): every step a player takes ends with a card in plain
// words, every change as a chip, and what to try next; the day's journal is the same cards, short. Read from the rules'
// events and the states before and after only, so it is checked here without a browser: a win, a fail, the police
// (the amount seized said in the headline), a bad one, a purchase, banking, stepping out, and a night ends with no card
// (the night's report is its card). And no card ever names an internal id.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, newRun, view, step } from '../src/run/index.mjs';
import { newsOf, chipsOf, journalOf, endsDay } from '../demo/run/news.js';

const cfg = RUN_CONFIG;

/** One step from a state with these fields (and its books kept whole), and the card it makes. */
function play(fields, choice) {
  const s0 = newRun({ seed: 3, cfg });
  const before = { ...s0, ...fields, owned: { ...s0.owned, ...(fields.owned ?? {}) } };
  before.books = { ...s0.books, earned: s0.books.earned + (before.carried + before.banked) - (s0.carried + s0.banked) };
  const v0 = view(cfg, before);
  const pick = typeof choice === 'function' ? choice(v0) : choice;
  const { state, events } = step(cfg, before, pick);
  const v1 = view(cfg, state);
  return { before, state, events, v0, v1, card: newsOf({ cfg, before, state, events, v0, v1 }) };
}
/** The first dealt option that is a roll (not the sure one). */
const risky = v => ({ do: 'job', id: (v.options.find(o => !o.sure && o.available) ?? v.options[0]).id });
const safe = v => ({ do: 'job', id: v.options.find(o => o.sure).id });
const has = (card, re) => card.chips.some(c => re.test(c.text));

test('a win: it worked, the pay in the headline, the money and the hour as chips', () => {
  const { card } = play({ place: 'market', hour: 14, hoursThere: 1, carried: 30, banked: 18, energy: 5, rig: { chances: [0, 99], rolls: [] } }, risky);
  assert.equal(card.tone, 'win');
  assert.equal(card.kicker, 'It worked');
  assert.match(card.head, /: \+\$\d+$/);
  assert.match(card.chance, /% chance · it came up/);
  assert.ok(has(card, /^\+\$\d+$/), 'the pay as a chip');
  assert.ok(has(card, /^1 hour$/));
  assert.ok(has(card, /energy/));
});

test('a fail: it did not work, what it cost said', () => {
  const { card } = play({ place: 'market', hour: 15, hoursThere: 2, carried: 40, banked: 18, energy: 4, rig: { chances: [99, 99], rolls: [] } }, risky);
  assert.equal(card.tone, 'fail');
  assert.equal(card.kicker, "It didn't work");
  assert.match(card.head, /it went wrong$/);
  assert.match(card.chance, /it missed/);
});

test('the police: arrested, the cash seized in the headline, a big card', () => {
  const { card, events } = play({ place: 'market', hour: 15, hoursThere: 2, carried: 90, banked: 18, heat: 4, energy: 4, rig: { chances: [0], rolls: [] } }, safe);
  assert.ok(events.some(e => e.type === 'stopped'));
  assert.equal(card.tone, 'loss');
  assert.equal(card.big, true);
  assert.equal(card.kicker, 'Arrested');
  const paid = events.find(e => e.type === 'job').pay;
  assert.equal(card.head, `The police took $${90 + paid}`);
  assert.ok(has(card, new RegExp(`^−\\$${90 + paid} seized$`)), 'what was seized, as a chip');
});

test('jumped, a bad one: what they took, the clinic said', () => {
  const { card } = play({ place: 'market', hour: 16, hoursThere: 3, carried: 120, banked: 18, energy: 4, rig: { chances: [0], rolls: [10] } }, safe);
  assert.equal(card.tone, 'loss');
  assert.equal(card.big, true);
  assert.equal(card.kicker, 'Jumped: a bad one');
  assert.match(card.head, /^They took \$\d+/);
  assert.match(card.body, /clinic/);
});

test('home: what came home is banked, said as one chip; stepping out says what you took', () => {
  const home = play({ place: 'park', hour: 14, carried: 33, banked: 6, energy: 4 }, v => v.choices.find(c => c.choice.do === 'inside').choice);
  assert.match(home.card.head, /^Home: banked \$33$/);
  assert.ok(has(home.card, /^banked \$33$/));
  const out = play({ place: 'crib', carried: 0, banked: 20 }, { do: 'out', take: 14 });
  assert.equal(out.card.kicker, 'Out');
  assert.ok(has(out.card, /^took \$14 out$/));
});

test('a purchase at home: the thing owned, the money banked spent', () => {
  const { card } = play({ place: 'crib', carried: 0, banked: 160 }, { do: 'buy', item: 'bed' });
  assert.equal(card.kicker, 'Bought');
  assert.match(card.head, /real bed/i);
  assert.ok(has(card, /^banked −\$150$/));
  assert.ok(has(card, /^yours: real bed$/));
});

test('the step that ends the day has no card: the night\'s report is it', () => {
  const r = play({ place: 'crib', carried: 0, banked: 20 }, { do: 'sleep' });
  assert.ok(endsDay(r.events));
  assert.equal(r.card, null);
});

test('no card or chip names an internal id, and its journal line is short', () => {
  const runs = [
    play({ place: 'market', hour: 14, hoursThere: 1, carried: 30, banked: 18, energy: 5, rig: { chances: [0, 99], rolls: [] } }, risky),
    play({ place: 'market', hour: 15, hoursThere: 2, carried: 90, banked: 18, heat: 4, energy: 4, rig: { chances: [0], rolls: [] } }, safe),
    play({ place: 'park', hour: 12, carried: 14, banked: 6 }, v => v.choices.find(c => c.choice.do === 'pack')?.choice ?? safe(v)),
  ];
  for (const { card } of runs) {
    const words = [card.head, card.body, card.kicker, card.next ?? '', ...card.chips.map(c => c.text)].join(' ');
    assert.doesNotMatch(words, /npc:|undefined|null|NaN|\[object/);
    const j = journalOf(card);
    assert.ok(j.chips.length <= 3);
    assert.match(j.at, /^\d\d:00$/);
  }
});

test('chips: a job that moved someone\'s trust says who and which way', () => {
  const { before, state, events, v0, v1 } = play({ place: 'park', hour: 12, carried: 14, banked: 6 }, safe);
  const chips = chipsOf({ cfg, before, state, events, v0, v1 });
  const trust = events.find(e => e.trust)?.trust;
  if (trust) assert.ok(chips.some(c => c.tone === 'trust' || c.tone === 'loss'));
  assert.ok(chips.some(c => /home risk −1/.test(c.text)) || !(v0.pressure?.value > 0), 'an odd job eases home risk when there is some');
});
