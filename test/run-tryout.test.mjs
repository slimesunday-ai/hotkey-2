// THE TRY-OUT STOP (join-1, demo/run/tryout.js): a stop for the dead mall on the run's Travel list wherever Travel is
// offered, and nowhere else; a page's side trip, never a choice of the rules': its key is none of theirs, it changes
// nothing else on the dock, and nothing of the rules' state is in it. Checked over every choice point of a few scripted
// players. (The trip itself, and that the run's state and save are byte for byte the same after it, win or lose:
// demo/tools/run-tryout.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, newRun, view, step } from '../src/run/index.mjs';
import { POLICIES, decide } from '../src/run/policies.mjs';
import { dockOf } from '../demo/run/dock.js';
import { TRYOUT, TRYOUT_CHOICE, isTryout, withTryout, tryoutOffered, tryoutRow, tryoutGo, tryoutWhy } from '../demo/run/tryout.js';
import { SITES } from '../demo/fight/sites.js';

const cfg = RUN_CONFIG;
const PLAYERS = [POLICIES.park, { ...POLICIES.mixed(120), buy: true }, POLICIES.dealer(120, 4), POLICIES.walker(90, 'play'), POLICIES.reckless];

function* points(policy, seed, days = 3) {
  let state = newRun({ seed, cfg });
  for (let n = 0; state.day <= days && n < 1500; n++) {
    yield state;
    state = step(cfg, state, decide(cfg, state, policy)).state;
  }
}

test('the try-out is on Travel\'s list exactly where Travel is offered, last, and nothing else on the dock changes', () => {
  const seen = { offered: 0, not: 0, crib: 0, held: 0 };
  for (const policy of PLAYERS) {
    for (const seed of [1, 4]) {
      for (const state of points(policy, seed)) {
        const v = view(cfg, state);
        const d = dockOf({ cfg, v });
        const T = withTryout(d);
        const travel = d.verbs.find(x => x.id === 'travel');
        const t2 = T.verbs.find(x => x.id === 'travel');
        assert.deepEqual(T.cards, d.cards);
        assert.deepEqual(T.verbs.filter(x => x.id !== 'travel'), d.verbs.filter(x => x.id !== 'travel'));
        if (travel.keys.length) {
          seen.offered += 1;
          assert.ok(tryoutOffered(d));
          assert.deepEqual(t2.keys, [...travel.keys, TRYOUT.key]);
          assert.equal(t2.why, travel.why);
        } else {
          seen.not += 1;
          assert.deepEqual(T, d);
          assert.ok(!t2.keys.includes(TRYOUT.key));
        }
        if (v.place === 'crib') {
          seen.crib += 1;
          assert.ok(!tryoutOffered(d), 'not at home: step out first, as Travel says');
        }
        if (v.place === 'jail' || v.place === 'clinic') {
          seen.held += 1;
          assert.ok(!tryoutOffered(d), 'not while held');
        }
        // (never one of the rules' own keys)
        assert.ok(!v.choices.some(c => isTryout(c.key)));
      }
    }
  }
  assert.ok(seen.offered > 50 && seen.not > 20 && seen.crib > 10, JSON.stringify(seen));
});

test('it is the page\'s, never the rules\': its own key and its own kind of move, free, at the fight\'s own site', () => {
  assert.equal(TRYOUT_CHOICE.key, TRYOUT.key);
  assert.equal(TRYOUT_CHOICE.choice.do, 'tryout');
  assert.ok(!/^\d+$/.test(TRYOUT.key));
  assert.equal(TRYOUT_CHOICE.price, 0);
  assert.equal(TRYOUT_CHOICE.available, true);
  // (no move of that kind among the rules' anywhere above, and the rules refuse it as a step)
  const s = newRun({ seed: 2, cfg });
  assert.throws(() => step(cfg, s, TRYOUT_CHOICE.choice));
  // (at the fight's dead mall, its own middle)
  assert.ok(SITES[TRYOUT.site]);
  assert.deepEqual([...TRYOUT.at], SITES[TRYOUT.site].center);
  assert.equal(TRYOUT.name, SITES[TRYOUT.site].place);
});

test('its words: marked a try-out, nothing counts, and it costs nothing', () => {
  const r = tryoutRow();
  assert.equal(r.mark, 'TRY-OUT');
  assert.match(r.small, /nothing here counts/);
  assert.match(r.small, /no hour, no energy, no heat/);
  assert.equal(r.price, 0);
  assert.match(tryoutGo(), /^Try-out: behind the dead mall · free$/);
  const s = newRun({ seed: 1, cfg });
  const atHome = dockOf({ cfg, v: view(cfg, s) });
  assert.match(tryoutWhy({ dock: atHome, phase: 'choose' }), /step out first/);
  assert.match(tryoutWhy({ dock: atHome, phase: 'playing' }), /not while something plays/);
});
