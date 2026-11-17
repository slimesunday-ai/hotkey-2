// The run saved by the PAGE (RUN.md "Saving", the page's side: demo/run/save.js). One slot in the browser's storage; the
// rules' text inside it with what the page keeps for itself. What can be checked without a browser: the slot over a
// storage that works and one that refuses; a run saved at a choice point and picked up goes on as the unbroken one; the
// page's own things come back and nothing else of the page is written (a choice half made never is); a save the rules
// refuse is refused, kept under its own key and said plainly; the lines on the page. The page in the browser:
// demo/tools/run-stage.mjs --reload-at.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, newRun, view, step, saveRun } from '../src/run/index.mjs';
import { POLICIES, decide } from '../src/run/policies.mjs';
import { fullEnergy } from '../src/run/rules.mjs';
import { saveSlot, packSave, unpackSave, savedMark, pickedLine, refusedLine, replaceAsk, atOf, SAVE_KEY, REFUSED_KEY, PAGE_KEYS, LOG_KEEP } from '../demo/run/save.js';

const cfg = RUN_CONFIG;

/** A storage as the browser's (getItem, setItem, removeItem), in memory. */
function memory() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
}
/** A storage that refuses everything (a private window, blocked site data). */
const refusing = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); }, removeItem() { throw new Error('SecurityError'); } };

/** A run played by a scripted player for `n` steps, every step at a choice point. */
function play(state, policy, n) {
  let s = state;
  const events = [];
  for (let k = 0; k < n; k++) {
    const r = step(cfg, s, decide(cfg, s, policy));
    s = r.state;
    events.push(r.events);
  }
  return { state: s, events };
}
function bedRun(seed) {
  const s = newRun({ seed, cfg });
  s.owned = { ...s.owned, bed: true };
  s.energy = fullEnergy(cfg, s);
  return s;
}

test('the slot: written and read back; a refusing storage never throws, and the mark says "not saving"', () => {
  const store = memory();
  const slot = saveSlot(store);
  assert.equal(slot.read(), null);
  assert.equal(slot.write('x'), true);
  assert.equal(slot.read(), 'x');
  assert.equal(store.m.get(SAVE_KEY), 'x');
  assert.equal(slot.keepRefused('old'), true);
  assert.equal(store.m.get(REFUSED_KEY), 'old');
  assert.equal(slot.read(), 'x', 'keeping a refused save does not touch the slot');
  assert.equal(slot.clear(), true);
  assert.equal(slot.read(), null);
  const no = saveSlot(refusing);
  assert.equal(no.read(), null);
  assert.equal(no.write('x'), false);
  assert.equal(no.keepRefused('x'), false);
  assert.equal(no.clear(), false);
  const none = saveSlot(null);
  assert.equal(none.read(), null);
  assert.equal(none.write('x'), false);
  assert.equal(savedMark(false), 'not saving');
});

test('picked up at a choice point, a run goes on exactly as the unbroken one (players with warnings, notices, Earl, a regular at the door)', () => {
  const players = [
    ['homeFirst bed', POLICIES.homeFirst(120), bedRun],
    ['earl', { ...POLICIES.homeFirst(120), defend: 'guard' }, bedRun],
    ['walker', POLICIES.walker(90, 'play'), seed => newRun({ seed, cfg })],
    ['lean', { ...POLICIES.park, regular: 'lean' }, seed => newRun({ seed, cfg })],
  ];
  let notices = 0;
  let earl = 0;
  let doors = 0;
  for (const [name, policy, make] of players) {
    for (const seed of [3, 8, 12]) {
      const whole = play(make(seed), policy, 150).state;
      for (const cut of [17, 63, 111]) {
        const head = play(make(seed), policy, cut).state;
        const v = view(cfg, head);
        if (v.home?.notice) notices += 1;
        if (v.home?.defences?.guard?.on) earl += 1;
        if (v.door) doors += 1;
        const text = packSave({ state: head, view: v, page: { result: { lines: [{ text: 'You did a thing.' }] } } });
        const r = unpackSave(text, cfg);
        assert.ok(r.ok, `${name} seed ${seed} cut ${cut}: ${r.why}`);
        assert.deepEqual(r.state, head);
        assert.deepEqual(play(r.state, policy, 150 - cut).state, whole, `${name} seed ${seed}: cut at step ${cut}, picked up, the end differs`);
      }
    }
  }
  // (the cuts held what the page must put back: not proof of the page, a check that the cases were met)
  assert.ok(earl > 0 && doors > 0, `cuts with Earl on ${earl}, a regular at the door ${doors}, a notice up ${notices}`);
});

test('the page\'s own things come back; nothing else of the page is written, a choice half made never', () => {
  const s = play(bedRun(8), POLICIES.homeFirst(120), 40).state;
  const v = view(cfg, s);
  const raid = { type: 'raid', day: 2, hour: 14, how: 'away', taken: 31, who: { id: 'x', name: 'somebody' }, text: 'They got in.' };
  const page = {
    result: { lines: [{ text: 'You sold a carton.', pay: 9 }], chips: [], rolls: [{ label: 'the job', chance: 70, roll: 12, hit: true }] },
    report: { day: 2, where: 'at home', rows: [['Earned', 40, 'good']], home: [{ text: 'Cousin Earl\'s days are up.', quiet: true }] },
    log: Array.from({ length: LOG_KEEP + 30 }, (_, k) => ({ day: 1 + Math.floor(k / 12), hour: 12 + (k % 12), text: `step ${k}` })),
    after: raid, raidNote: raid, notice: { head: 'Called off', day: 3, text: 'They thought better of it.' },
    dayStart: { earned: 10, banked: 30 }, rose: { park: 1 }, earl: { day: 4, text: 'gone' },
    // (the page's half-made choices and anything else: never written)
    take: 14, goodsTake: { cigs: 2 }, sel: '3', goodPick: { crowd: 1 }, targets: { odd: 1 }, dangerOpen: true,
  };
  const r = unpackSave(packSave({ state: s, view: v, page }), cfg);
  assert.ok(r.ok);
  assert.deepEqual(Object.keys(r.page).sort(), [...PAGE_KEYS].sort());
  for (const k of PAGE_KEYS.filter(k => k !== 'log')) assert.deepEqual(r.page[k], page[k], k);
  assert.equal(r.page.log.length, LOG_KEEP, 'the log keeps its last lines');
  assert.deepEqual(r.page.log.at(-1), page.log.at(-1));
  for (const k of ['take', 'goodsTake', 'sel', 'goodPick', 'targets', 'dangerOpen']) assert.ok(!(k in r.page), `${k} is not saved`);
  // (where and when, for the mark and the line on picking up)
  assert.deepEqual(r.at, { day: s.day, hour: s.hour, clock: v.clock, place: cfg.places[s.place]?.label ?? s.place, banked: s.banked, seed: s.seed });
  assert.equal(savedMark(atOf(s, v)), `saved · day ${s.day} ${v.clock}`);
});

test('a save the rules refuse is refused, never thrown: an older state version, broken text, a page record of another shape', () => {
  const s = newRun({ seed: 3, cfg });
  const v7 = JSON.parse(saveRun(s));
  v7.v = 7;
  v7.state.v = 7;
  const old = JSON.stringify({ kind: 'the-run-page', v: 1, at: {}, run: JSON.stringify(v7), page: {} });
  assert.deepEqual(unpackSave(old, cfg), { ok: false, why: 'version' });
  // (a bare rules save of an older version, too)
  assert.equal(unpackSave(JSON.stringify(v7), cfg).why, 'version');
  for (const text of ['', 'not json', '{}', '[]', 'null', JSON.stringify({ kind: 'the-run-page', v: 1 }), JSON.stringify({ kind: 'the-run-page', v: 1, run: '{"kind":"the-run"' })]) {
    const r = unpackSave(text, cfg);
    assert.equal(r.ok, false, text);
    assert.equal(r.why, 'broken', text);
  }
  assert.equal(unpackSave(JSON.stringify({ kind: 'the-run-page', v: 99, run: saveRun(s) }), cfg).why, 'version');
  // (a bare rules save of this version is a run, with nothing of the page)
  const bare = unpackSave(saveRun(s), cfg);
  assert.ok(bare.ok);
  assert.deepEqual(bare.page, {});
  assert.deepEqual(bare.state, s);
});

test('the page\'s lines: picked up, refused, NEW RUN\'s second ask, the mark', () => {
  const at = { day: 3, hour: 14, clock: '14:00', place: 'the flea market', banked: 240, seed: 8 };
  assert.equal(pickedLine(at), 'Picked up where you left off: day 3, 14:00, the flea market.');
  assert.equal(refusedLine('version'), 'Your saved run is from an older build and cannot be continued. A new run has started.');
  assert.match(refusedLine('broken'), /could not be read and cannot be continued\. A new run has started\.$/);
  assert.match(replaceAsk(at), /day 3, \$240 banked/);
  assert.equal(savedMark(at), 'saved · day 3 14:00');
});
