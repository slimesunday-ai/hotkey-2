// Saving a run (RUN.md, "Saving"): saveRun(state) → text, loadRun(text) → { ok, state } or { ok: false, why }. The hard
// requirement: a run saved at ANY choice point and loaded again goes on exactly as if it had never stopped. Proved by
// cutting scripted runs (many players, many seeds) once at a random step, and a few at every step, and comparing the
// end (the state, its view, every event after the cut) with the uncut run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rng } from '../src/rng.mjs';
import { RUN_CONFIG, newRun, view, step, saveRun, loadRun, SAVE_KIND, RUN_STATE_VERSION } from '../src/run/index.mjs';
import { fullEnergy } from '../src/run/rules.mjs';
import { POLICIES, decide } from '../src/run/policies.mjs';

const cfg = RUN_CONFIG;
const DAYS = 10;

// the players: between them a warning, a notice, an attempt, Cousin Earl on the step, a debt collected, goods carried,
// a route, a regular at the door, the jail and the clinic, nights rough, and a run that has ended (all three owned)
const PLAYERS = [
  ['park', POLICIES.park, {}],
  ['mixed', POLICIES.mixed(120), {}],
  ['dealer', POLICIES.dealer(120, 4), {}],
  ['homeFirst bed', POLICIES.homeFirst(120), { bed: true }],
  ['earl', { ...POLICIES.homeFirst(120), defend: 'guard' }, { bed: true }],
  ['racer', POLICIES.racer(120), { bed: true }],
  ['walker', POLICIES.walker(90, 'play'), {}],
  ['skater', POLICIES.skater(90), { board: true }],
  ['burner', POLICIES.burner(120), {}],
  ['neighbour', POLICIES.neighbour(120), {}],
  ['reckless', POLICIES.reckless, {}],
  ['rough', { ...POLICIES.homeAt(120), rough: true }, {}],
  ['buys all three', { ...POLICIES.homeAt(90), buy: true }, {}],
  ['carrier', POLICIES.carrier(120), {}],
];

/** A fresh run with a kit owned from the start, as the marks' playSeason sets it. */
function start(seed, kit) {
  const s = newRun({ seed, cfg });
  for (const [k, on] of Object.entries(kit)) if (cfg.things?.[k]) s.things = { ...s.things, [k]: on };
  s.owned = { ...s.owned, ...Object.fromEntries(Object.entries(kit).filter(([k]) => !cfg.things?.[k])) };
  s.energy = fullEnergy(cfg, s);
  return s;
}

/** Play on with the player's own choices to the end of day DAYS: every state before a choice, and every step's events. */
function playOn(state, policy) {
  const states = [];
  const events = [];
  while (state.day <= DAYS) {
    states.push(state);
    const r = step(cfg, state, decide(cfg, state, policy));
    events.push(r.events);
    state = r.state;
    assert.ok(states.length < 3000, 'a run that never ends');
  }
  return { states, events, end: state };
}

/** Through the text and back. */
function roundTrip(state) {
  const text = saveRun(state);
  assert.equal(typeof text, 'string');
  const r = loadRun(text);
  assert.ok(r.ok, r.text);
  assert.notEqual(r.state, state);
  assert.deepEqual(r.state, state);
  return r.state;
}

/** What a cut state holds, for the coverage check. */
function holds(s) {
  const H = s.home ?? {};
  return [
    H.raid && !H.raid.started ? 'warning' : null,
    H.raid?.started ? 'notice' : null,
    H.raids?.length ? 'attempt' : null,
    H.guard?.on ? 'Earl on the step' : null,
    Object.values(s.people ?? {}).some(p => p.job === 'collect') ? 'a debt' : null,
    Object.keys(s.goods ?? {}).length ? 'goods carried' : null,
    s.doneDay !== null ? 'a run that has ended (all three owned)' : null,
    s.route ? 'on a route' : null,
    s.door ? 'a regular at the door' : null,
    s.place === 'jail' || s.place === 'clinic' ? 'held' : null,
  ].filter(Boolean);
}

test('saving: the state is plain JSON: through the text and back it is the same state, deep-equal, at every step', () => {
  for (const [name, policy, kit] of PLAYERS.slice(0, 6)) {
    const { states } = playOn(start(3, kit), policy);
    for (const s of states) assert.deepEqual(JSON.parse(JSON.stringify(s)), s, `${name}, day ${s.day} ${s.hour}:00`);
  }
});

test('saving: cut once at a random step, saved, loaded and played on, every player and many seeds end exactly as the uncut run', () => {
  const seen = new Set();
  let cuts = 0;
  for (const [name, policy, kit] of PLAYERS) {
    for (let seed = 1; seed <= 20; seed++) {
      const whole = playOn(start(seed, kit), policy);
      const at = Math.floor(rng(seed, 'save-cut', name)() * whole.states.length);
      const cut = whole.states[at];
      for (const h of holds(cut)) seen.add(h);
      const rest = playOn(roundTrip(cut), policy);
      const label = `${name}, seed ${seed}, cut at step ${at} (day ${cut.day} ${cut.hour}:00 at ${cut.place})`;
      assert.deepEqual(rest.end, whole.end, label);
      assert.deepEqual(view(cfg, rest.end), view(cfg, whole.end), label);
      assert.deepEqual(rest.events, whole.events.slice(at), label);
      cuts += 1;
    }
  }
  assert.equal(cuts, PLAYERS.length * 20);
  // (most of what a run can hold was in some cut; the every-step test below covers the rest)
  assert.ok(seen.size >= 6, [...seen].join(', '));
});

test('saving: cut at EVERY step of a few runs, each played on to the end, every one ends as the uncut run', () => {
  const seen = new Set();
  for (const [name, policy, kit, seed] of [
    ['earl', { ...POLICIES.homeFirst(120), defend: 'guard', race: true, buy: true }, { bed: true }, 2],
    ['dealer', { ...POLICIES.dealer(120, 4), parkFirst: true, buy: true }, {}, 7],
    ['reckless', { ...POLICIES.reckless, buy: true }, {}, 4],
    ['walker', { ...POLICIES.walker(90, 'play'), buy: true }, {}, 3],
  ]) {
    const whole = playOn(start(seed, kit), policy);
    const endView = view(cfg, whole.end);
    for (let at = 0; at < whole.states.length; at++) {
      const cut = whole.states[at];
      for (const h of holds(cut)) seen.add(h);
      const rest = playOn(roundTrip(cut), policy);
      const label = `${name}, seed ${seed}, cut at step ${at} of ${whole.states.length}`;
      assert.deepEqual(rest.end, whole.end, label);
      assert.deepEqual(view(cfg, rest.end), endView, label);
      assert.deepEqual(rest.events, whole.events.slice(at), label);
    }
    // and a save made at the very end (the run over its ten days) loads as it is
    assert.deepEqual(roundTrip(whole.end), whole.end);
  }
  for (const h of ['warning', 'notice', 'attempt', 'Earl on the step', 'a debt', 'goods carried', 'a run that has ended (all three owned)', 'on a route', 'a regular at the door', 'held']) {
    assert.ok(seen.has(h), `no cut held ${h}: ${[...seen].join(', ')}`);
  }
});

test('saving: a random player (every legal choice) saved at every step plays on as if never stopped', () => {
  let s = start(11, { cutter: true });
  s.home = { ...s.home, marks: [{ why: 'wallet', text: 'You lifted a wallet', n: 10, day: 1 }] };
  s.banked = 400;
  s.books = { ...s.books, start: 400 };
  const r = rng(11, 'save-monkey');
  for (let i = 0; i < 600; i++) {
    const legal = view(cfg, s).choices.filter(c => c.available);
    let c = legal[Math.floor(r() * legal.length)].choice;
    if (c.do === 'out') c = { ...c, take: Math.min(s.banked, 20) };
    const a = step(cfg, s, c);
    const b = step(cfg, roundTrip(s), c);
    assert.deepEqual(b, a, `step ${i}: ${JSON.stringify(c)}`);
    s = a.state;
  }
});

test('saving: loadRun never throws: another version says `version`, anything else `broken`', () => {
  const s = playOn(start(5, {}), POLICIES.mixed(120)).states[40];
  const text = saveRun(s);
  assert.equal(JSON.parse(text).kind, SAVE_KIND);
  assert.equal(JSON.parse(text).v, RUN_STATE_VERSION);
  // another state version: no migration (memory-1: but version 8 is read: run-memory.test.mjs; styles-1: and 9,
  // run-styles.test.mjs)
  // (sixes-1: and 10; so 7 is the newest refused)
  for (const v of [7, RUN_STATE_VERSION + 1, 1]) {
    const old = JSON.stringify({ kind: SAVE_KIND, v, state: { ...s, v } });
    const r = loadRun(old);
    assert.deepEqual([r.ok, r.why, r.found, r.wants], [false, 'version', v, RUN_STATE_VERSION]);
    assert.match(r.text, /another version/);
  }
  // broken: not JSON, not a save, a field gone or wrong, books that do not add up, a place that is not one
  const broken = [
    '', 'null', '{', '[]', '42', '"text"', JSON.stringify({ hello: 1 }), JSON.stringify({ kind: SAVE_KIND, v: RUN_STATE_VERSION }),
    JSON.stringify({ kind: 'another', v: RUN_STATE_VERSION, state: s }),
    JSON.stringify({ kind: SAVE_KIND, v: RUN_STATE_VERSION, state: [] }),
    JSON.stringify({ kind: SAVE_KIND, v: RUN_STATE_VERSION, state: { ...s, banked: s.banked + 1 } }),
    JSON.stringify({ kind: SAVE_KIND, v: RUN_STATE_VERSION, state: { ...s, place: 'the moon' } }),
    JSON.stringify({ kind: SAVE_KIND, v: RUN_STATE_VERSION, state: { ...s, home: null } }),
    JSON.stringify({ kind: SAVE_KIND, v: RUN_STATE_VERSION, state: { ...s, energy: 'lots' } }),
    JSON.stringify({ kind: SAVE_KIND, v: RUN_STATE_VERSION, state: { ...s, books: { ...s.books, earned: 1.5 } } }),
  ];
  for (const t of broken) {
    const r = loadRun(t);
    assert.deepEqual([r.ok, r.why], [false, 'broken'], t.slice(0, 80));
    assert.equal(typeof r.text, 'string');
  }
  // every field taken out in turn, and every cut of the text short: broken, never a throw
  for (const k of Object.keys(s)) {
    if (k === 'v') continue;
    const { [k]: _, ...less } = s;
    assert.equal(loadRun(JSON.stringify({ kind: SAVE_KIND, v: RUN_STATE_VERSION, state: less })).why, 'broken', k);
  }
  for (let n = 0; n < text.length; n += 7) assert.equal(loadRun(text.slice(0, n)).ok, false);
  assert.equal(loadRun(undefined).why, 'broken');
  assert.equal(loadRun({ not: 'text' }).why, 'broken');
  // and the whole text loads
  assert.ok(loadRun(text).ok);
});

test('saving: a ten-day save is small', () => {
  const sizes = PLAYERS.map(([, policy, kit]) => Buffer.byteLength(saveRun(playOn(start(1, kit), policy).end)));
  for (const n of sizes) assert.ok(n < 16000, `${n} bytes`);
});
