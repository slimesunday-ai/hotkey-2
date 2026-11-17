// THE FIGHT'S INTERFACE AS DATA (demo/fight/dock.js, join-1): the dock's five loadouts and three levels, what Enter
// says, the meters while a round is on, the result card, the results side by side, and each site's own words. Pure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFight, step, runFight, report, PRESETS, LEVELS, POLICIES } from '../src/fight/index.mjs';
import { SITES } from '../demo/fight/sites.js';
import { dockOf, metersOf, cardOf, tableOf, goWords, stepLevel, stepPreset, siteWords, levelName, vestTook, lastWords, PRESET_KEYS, LEVEL_KEYS } from '../demo/fight/dock.js';

const MALL = SITES.mall;
const ELM = SITES.elm;
const pickOf = (id, level = 'real') => ({ ...PRESETS[id], gear: [...PRESETS[id].gear], level });

test('the dock offers the five loadouts on 1 to 5 and the three levels, and says exactly what Enter does', () => {
  const d = dockOf({ pick: pickOf('pistolVest'), results: {}, site: MALL });
  assert.deepEqual(d.cards.map(c => c.n), [1, 2, 3, 4, 5]);
  assert.deepEqual(d.cards.map(c => c.id), PRESET_KEYS);
  assert.deepEqual(d.cards.map(c => c.name), ['Bare hands', 'Starter', 'Handgun', 'Handgun + vest', 'Chopper + vest + Earl']);
  assert.equal(d.cards.filter(c => c.on).length, 1);
  assert.equal(d.cards.find(c => c.on).id, 'pistolVest');
  assert.equal(d.go, 'Fight · Handgun + vest · Real');
  assert.equal(goWords(pickOf('full', 'hard'), true), 'Again · Chopper + vest + Earl · Hard');
  assert.deepEqual(d.levels.map(l => l.word), ['Easy', 'Real', 'Hard']);
  assert.equal(d.levels.find(l => l.on).id, 'real');
  // (what is in each, in the fight's own names)
  assert.equal(d.cards.find(c => c.id === 'full').contents, 'chopper · stab vest · Earl');
  assert.equal(d.cards.find(c => c.id === 'hands').contents, 'bare hands');
  // (a build of your own: no loadout lit, its own words on the button)
  const own = dockOf({ pick: { weapon: 'pistol', gear: ['shoes'], ally: false, level: 'easy' }, results: {}, site: MALL });
  assert.equal(own.custom, true);
  assert.equal(own.cards.some(c => c.on), false);
  assert.equal(own.go, 'Fight · Six-shot + good sneakers · Easy');
});

test('each card says how it did the last time at the level picked', () => {
  const results = { starter: { real: { result: 'won', seconds: 41.3, hp: 22, max: 100, dropped: 9, of: 9 } }, hands: { real: { result: 'lost', seconds: 20, hp: 0, max: 100, dropped: 3, of: 9 } } };
  const d = dockOf({ pick: pickOf('starter'), results, site: MALL });
  assert.deepEqual(d.cards.find(c => c.id === 'starter').last, { tone: 'gain', text: 'won in 41 s · 22 health left' });
  assert.deepEqual(d.cards.find(c => c.id === 'hands').last, { tone: 'loss', text: 'went down · 3 of 9 dropped' });
  assert.equal(d.cards.find(c => c.id === 'pistol').last.tone, 'none');
  // (at another level, that level's: none yet)
  const e = dockOf({ pick: pickOf('starter', 'easy'), results, site: MALL });
  assert.equal(e.cards.find(c => c.id === 'starter').last.text, 'not tried on Easy');
  assert.equal(lastWords({ result: 'left', seconds: 9.2 }).text, 'left at 9 s');
});

test('the arrows step along the loadouts (round the ends) and the levels (kept at the ends)', () => {
  assert.equal(stepPreset(pickOf('hands'), 1), 'starter');
  assert.equal(stepPreset(pickOf('hands'), -1), 'full');
  assert.equal(stepPreset(pickOf('full'), 1), 'hands');
  assert.equal(stepPreset({ weapon: 'pistol', gear: ['shoes'], ally: false }, 1), 'hands');
  assert.equal(stepLevel('real', 1), 'hard');
  assert.equal(stepLevel('hard', 1), 'hard');
  assert.equal(stepLevel('easy', -1), 'easy');
  assert.deepEqual(LEVEL_KEYS, ['easy', 'real', 'hard']);
});

test("each site says its own name for its levels: the mall's real night is not Elm St's (the rules are the same)", () => {
  assert.equal(levelName(MALL, 'real'), 'the lot after dark');
  assert.equal(levelName(ELM, 'real'), 'Elm St after dark');
  assert.equal(LEVELS.real.name, 'Elm St after dark', "the rules' own data is unchanged");
  assert.ok(!/Elm St/i.test(siteWords(MALL, `You cleared ${LEVELS.real.name} in 38 s.`)));
  assert.equal(siteWords(MALL, 'You went back down the stairs at 9 s.'), 'You backed off across the lot at 9 s.');
  assert.equal(siteWords(ELM, 'You went back down the stairs at 9 s.'), 'You went back down the stairs at 9 s.');
  // (no word of the mall's card says Elm St or the stairs)
  for (const level of LEVEL_KEYS) {
    for (const id of PRESET_KEYS) {
      const F = runFight({ build: PRESETS[id], level, seed: 3, policy: POLICIES.kite });
      const c = cardOf(report(F), F, MALL, { tryout: true });
      const all = [c.kicker, c.head, c.body, c.meta, c.note, c.advice?.head, c.advice?.line, ...c.chips.map(x => x.text)].join(' ');
      assert.ok(!/Elm St|stairs/i.test(all), `${id} ${level}: ${all}`);
    }
  }
});

test('the meters while a round is on: health, the vest, ammo, how many are left, the time', () => {
  const F = createFight({ build: PRESETS.pistolVest, level: 'real', seed: 5 });
  let M = metersOf(F);
  assert.deepEqual(M.health, { hp: 100, max: 100, frac: 1, low: false });
  assert.deepEqual(M.vest, { cut: 30, took: 0 });
  assert.equal(M.ammo.gun, true);
  assert.equal(M.ammo.mag, 6);
  assert.equal(M.ammo.max, 6);
  assert.equal(M.left.n, 9);
  assert.equal(M.left.of, 9);
  assert.equal(M.time.text, '0:00');
  assert.equal(M.ally, null);
  // (played on: the time runs, the vest's share is the sum the page shows on each hit, the left count only falls)
  let was = M.left.n;
  for (let k = 0; k < 30 * 25 && !F.over; k++) {
    step(F, POLICIES.kite(F));
    M = metersOf(F);
    assert.ok(M.left.n <= was);
    was = M.left.n;
  }
  assert.ok(M.time.s >= 1);
  const hits = F.events.filter(e => e.type === 'hit' && e.id === 'you');
  assert.equal(vestTook(F), hits.reduce((n, e) => n + Math.round((e.dmg * 0.3) / 0.7), 0));
  assert.equal(M.vest.took, vestTook(F));
  // (bare hands: no rounds to run out of; with Earl, his health)
  const B = metersOf(createFight({ build: PRESETS.hands, level: 'easy', seed: 1 }));
  assert.equal(B.ammo.gun, false);
  assert.equal(B.ammo.name, 'bare hands');
  assert.equal(B.vest, null);
  const E = metersOf(createFight({ build: PRESETS.full, level: 'hard', seed: 1 }));
  assert.equal(E.ally.name, 'Cousin Earl');
  assert.equal(E.left.of, 11);
});

test('the result card: won or lost in plain numbers, one line of advice, the try-out said', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 40 && seen.size < 2; seed++) {
    for (const id of ['hands', 'full']) {
      const F = runFight({ build: PRESETS[id], level: id === 'hands' ? 'hard' : 'easy', seed, policy: POLICIES.kite });
      const R = report(F);
      const c = cardOf(R, F, MALL, { tryout: true });
      seen.add(R.result);
      assert.equal(c.note, 'Try-out: nothing here counts');
      assert.ok(c.chips.some(x => x.text === `${R.outcome.dropped} of ${R.outcome.of} dropped`));
      assert.ok(c.chips.some(x => x.text === `${R.outcome.hp}/${R.outcome.max} health`));
      if (R.result === 'won') {
        assert.equal(c.tone, 'win');
        assert.match(c.head, /^Cleared the lot in /);
        assert.equal(c.advice, null);
      }
      if (R.result === 'lost') {
        assert.equal(c.tone, 'loss');
        assert.match(c.head, /^Down at /);
        assert.ok(c.advice && c.advice.line.length > 10);
        // (not the rules' line of what a real loss costs: nothing is taken on a try-out)
        assert.ok(!/wake at your trailer|They took/.test(`${c.body} ${c.advice.line}`));
      }
    }
  }
  assert.ok(seen.has('won') && seen.has('lost'), [...seen].join());
  // (the test page: no try-out words)
  const F = runFight({ build: PRESETS.starter, level: 'real', seed: 2, policy: POLICIES.kite });
  assert.equal(cardOf(report(F), F, MALL).note, null);
});

test('the results side by side: every loadout a row, every level a column, your own build once fought', () => {
  const results = { pistol: { hard: { result: 'lost', seconds: 30, hp: 0, max: 100, dropped: 4, of: 11 } }, custom: { easy: { result: 'won', seconds: 25, hp: 80, max: 100, dropped: 3, of: 3 } } };
  const T = tableOf(results, pickOf('pistol', 'hard'));
  assert.deepEqual(T.levels.map(l => l.word), ['Easy', 'Real', 'Hard']);
  assert.deepEqual(T.rows.map(r => r.name), ['Bare hands', 'Starter', 'Handgun', 'Handgun + vest', 'Chopper + vest + Earl', 'Your own']);
  assert.equal(T.rows.find(r => r.id === 'pistol').on, true);
  assert.equal(T.rows.find(r => r.id === 'pistol').cells[2].short, 'down 4/11');
  assert.equal(T.rows.find(r => r.id === 'custom').cells[0].short, 'won 25 s');
  assert.equal(T.rows.find(r => r.id === 'hands').cells[0], null);
});
