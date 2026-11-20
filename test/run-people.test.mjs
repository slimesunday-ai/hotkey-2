// The run's people (RUN.md, "People"): each option names who it is done to; whoever you work is out for the rest of
// the day with a mood the view shows; the safe option is always dealt and goes round its people; a place worked dry
// says so and names the way on; everything resets in the morning. All of it added to the view and the events.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, withRunConfig, newRun, view, step, checkRunBooks, deal } from '../src/run/index.mjs';
import { POLICIES, decide } from '../src/run/policies.mjs';
import { viewText } from '../src/run/text.mjs';

const cfg = RUN_CONFIG;
// nobody acts on you at the market here, so a whole day of work there is never cut short by the clinic or the jail
const CALM = withRunConfig({ jump: { basePct: 0, perHourPct: 0, perStepPct: 0 }, police: { perHeat: 0 } });
const bytes = x => JSON.stringify(x);

function at(place, extra = {}, seed = 1, c = cfg) {
  const s = newRun({ seed, cfg: c });
  return { ...s, place, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) } };
}
const safeRole = (c, place) => Object.values(c.jobs[place]).find(j => j.safe).role;
// (everyone a job could work: not the safe job's people, nor a connect or anyone else no job is done to)
const toWork = (c, place) => c.people[place].filter(p => p.role !== safeRole(c, place) && Object.values(c.jobs[place]).some(j => j.role === p.role));
// goods on you, so the selling jobs are dealt (goods-1: a selling job needs goods it takes)
const STOCK = { smokes: 20, discs: 20 };

/** Work a place dry: take the first option that is not the safe one until only the safe one is dealt. */
function workDry(c, state) {
  const trail = [];
  for (let i = 0; i < 40; i++) {
    const v = view(c, state);
    const o = v.options.find(x => !x.safe && x.available);
    if (!o) break;
    const r = step(c, state, o.choice);
    trail.push({ option: o, events: r.events, view: v });
    state = r.state;
    assert.ok(checkRunBooks(state).ok);
  }
  return { state, trail };
}

test('people: a debt collected is named, the debtor is sour and out for the day, and the debt is not dealt again until morning', () => {
  // the owner's case: collect a debt, and the next hour the same debt comes round again to the same person
  let state = null;
  for (let hour = 12; !state; hour++) if (deal(cfg, at('park', { hour, energy: 6 })).some(j => j.id === 'collect')) state = at('park', { hour, energy: 6 });
  const option = view(cfg, state).options.find(o => o.id === 'collect');
  assert.deepEqual(option.who, { id: 'npc:debtor', name: 'Benny Two-Coats', role: 'debtor' });
  assert.equal(option.mood, 'calm');
  assert.equal(option.label, 'Collect a debt from Benny Two-Coats for Darlene at the office');
  const { state: after, events } = step(cfg, { ...state, rig: { chances: [0] } }, option.choice);
  const ev = events.find(e => e.type === 'job');
  assert.equal(ev.outcome, 'win');
  assert.deepEqual(ev.who, option.who);
  assert.equal(ev.mood, 'sour');
  assert.equal(ev.outToday, true);
  assert.match(ev.text, /^Collect a debt from Benny Two-Coats for Darlene at the office: \+\$\d+\. Benny Two-Coats is sour; not again today\.$/);
  const v = view(cfg, after);
  assert.ok(!v.options.some(o => o.id === 'collect'));
  // (memory-1: and he remembers it for the week: robbed to his face, he gives way)
  const { mark, ...benny } = v.people.find(p => p.id === 'npc:debtor');
  assert.deepEqual(benny, {
    id: 'npc:debtor', name: 'Benny Two-Coats', role: 'debtor', place: 'park', block: 'projects', here: true,
    mood: 'sour', moodText: 'is sour', outToday: true,
  });
  assert.deepEqual([mark.kind, mark.fear, mark.left], ['robbed', true, cfg.memory.days]);
  for (let hour = after.hour; hour < after.hour + 24; hour++) assert.ok(!deal(cfg, { ...after, hour }).some(j => j.id === 'collect'));
  assert.throws(() => step(cfg, after, { do: 'job', id: 'collect' }), /not a choice here/);
  // refused: wary, and out all the same
  const refused = step(cfg, { ...state, rig: { chances: [99] } }, option.choice).events.find(e => e.type === 'job');
  assert.equal(refused.outcome, 'fail');
  assert.equal(refused.mood, 'wary');
  assert.equal(refused.outToday, true);
  assert.match(refused.text, /Benny Two-Coats is wary of you; not again today\.$/);
});

test('people: once a day, everyone worked is out for the rest of it and nobody is worked twice', () => {
  for (const [place, c, extra] of [['park', cfg, {}], ['market', CALM, {}], ['market', CALM, { owned: { cutter: true } }]]) {
    for (const seed of [1, 2, 3, 4]) {
      const { state, trail } = workDry(c, at(place, { energy: 40, goods: STOCK, ...extra }, seed, c));
      const worked = trail.map(t => t.option.who.id);
      assert.equal(new Set(worked).size, worked.length, 'nobody worked twice in a day');
      assert.deepEqual([...worked].sort(), toWork(c, place).map(p => p.id).sort(), 'and a place runs dry only when everyone has been worked');
      for (const t of trail) {
        const ev = t.events.find(e => e.type === 'job');
        assert.deepEqual(ev.who, t.option.who);
        assert.ok(t.option.label.includes(t.option.who.name), t.option.label);
        assert.equal(ev.label, t.option.label);
        assert.equal(ev.outToday, true);
        assert.equal(ev.mood, c.jobs[place][ev.job].mood[ev.outcome]);
        // the person worked is never dealt again that day, at any hour
        for (let hour = ev.hour + 1; hour < ev.hour + 30; hour += 3) {
          assert.ok(!deal(c, { ...state, hour }).some(j => j.who.id === ev.who.id && !j.safe));
        }
      }
      const v = view(c, state);
      for (const id of worked) {
        const p = v.people.find(x => x.id === id);
        assert.equal(p.outToday, true);
        assert.ok(['sour', 'wary', 'unaware', 'friendly'].includes(p.mood), p.mood);
      }
      assert.ok(v.people.filter(p => p.place === place && !worked.includes(p.id)).every(p => !p.outToday));
    }
  }
});

test('people: the safe option is always dealt, always with somebody, and goes round its people', () => {
  for (const [place, c] of [['park', cfg], ['market', CALM]]) {
    let { state } = workDry(c, at(place, { energy: 40 }, 5, c)); // even with the place worked dry
    const cast = c.people[place].filter(p => p.role === safeRole(c, place)).map(p => p.id);
    let last = null;
    const seen = [];
    for (let i = 0; i < cast.length * 2; i++) {
      const v = view(c, state);
      const safe = v.options[0];
      assert.ok(safe.safe && safe.available && safe.who);
      assert.notEqual(safe.who.id, last, 'not the same person twice running');
      seen.push(safe.who.id);
      last = safe.who.id;
      const { state: next, events } = step(c, state, safe.choice);
      assert.equal(events[0].mood, 'friendly');
      assert.equal(events[0].outToday, false);
      state = next;
    }
    assert.deepEqual([...new Set(seen)].sort(), [...cast].sort(), 'everyone in the safe role gets a turn');
    assert.deepEqual(view(c, state).people.filter(p => cast.includes(p.id)).map(p => p.outToday), cast.map(() => false));
  }
});

test('people: the safe option is dealt first with somebody in every state the scripted players reach, and they cope with places running dry', () => {
  const dry = { park: 0, market: 0 };
  for (const [policy, kit] of [[POLICIES.park, {}], [POLICIES.homeAt(90), {}], [POLICIES.homeAt(Infinity), { bed: true }], [POLICIES.reckless, { cutter: true, bed: true }], [POLICIES.stall, {}]]) {
    for (let seed = 1; seed <= 25; seed++) {
      let state = newRun({ seed, cfg });
      state.owned = { ...state.owned, ...kit };
      for (let i = 0; i < 400 && state.day <= 6; i++) {
        const v = view(cfg, state);
        if (v.options.length) {
          assert.ok(v.options[0].safe && v.options[0].who, `seed ${seed}: the safe option first, with somebody`);
          assert.ok(v.options.length >= 1 && v.options.length <= 3);
          assert.equal(new Set(v.options.map(o => o.who.id)).size, v.options.length, 'one person per option');
          assert.ok(v.options.every(o => !v.people.find(p => p.id === o.who.id).outToday));
        }
        if (v.dry) dry[v.dry.place]++;
        state = step(cfg, state, decide(cfg, state, policy, v)).state;
        assert.ok(checkRunBooks(state).ok, `books off: seed ${seed}`);
      }
      assert.ok(state.day > 6, `seed ${seed}: the policy got through six days`);
    }
  }
  assert.ok(dry.park > 0, bytes(dry)); // (the market, with seven to work, runs dry for these players only rarely)
});

test('people: a place worked dry says so and names the way on: the park the subway to the market, the market home', () => {
  const park = workDry(cfg, at('park', { energy: 30 }));
  assert.ok(park.trail.every(t => t.view.dry === null), 'no note while somebody is left');
  const v = view(cfg, park.state);
  assert.deepEqual(v.options.map(o => o.id), ['odd']);
  assert.deepEqual({ place: v.dry.place, to: v.dry.to, way: v.dry.way }, { place: 'park', to: 'market', way: 'the subway to the Jay St night market' });
  assert.equal(v.dry.text, 'Nobody left to work in the trailer park today, only odd jobs. The way on: the subway to the Jay St night market.');
  assert.match(viewText(v), /Nobody left to work in the trailer park today, only odd jobs\. The way on: the subway to the Jay St night market\./);
  assert.ok(v.choices.some(c => c.choice.do === 'subway' && c.choice.to === 'market' && c.available), 'and the way on is open');
  assert.equal(v.dry.open, true);
  // too tired for the ride there and back: the note says so and sends you inside
  const tired = view(cfg, { ...park.state, energy: 1 });
  assert.equal(tired.dry.open, false);
  assert.equal(tired.dry.text, 'Nobody left to work in the trailer park today, only odd jobs. The way on is the subway to the Jay St night market, but you need energy 2 to get there and back: go inside for today.');
  const market = workDry(CALM, at('market', { energy: 40 }, 2, CALM));
  const m = view(CALM, market.state);
  assert.deepEqual({ place: m.dry.place, to: m.dry.to, way: m.dry.way }, { place: 'market', to: 'park', way: 'home' });
  assert.match(m.dry.text, /^Nobody left to work at the Jay St night market today, only the stall\. The way on: home\.$/);
  assert.equal(m.dry.open, true);
  assert.ok(market.trail.length > park.trail.length, 'the market has more people to work than the park, so it lasts longer');
  for (const s of [at('crib'), at('clinic'), at('jail'), at('park'), at('market')]) assert.equal(view(cfg, s).dry, null);
});

test('people: moods and who is out reset every morning, after home, the clinic or the jail', () => {
  let { state } = workDry(cfg, at('park', { energy: 30 }));
  ({ state } = step(cfg, state, view(cfg, state).options[0].choice)); // an odd job too: a shift done
  assert.equal(state.shifts.park, 1);
  const worked = Object.keys(state.people).sort();
  ({ state } = step(cfg, state, { do: 'inside' }));
  const slept = step(cfg, state, { do: 'sleep' });
  const morning = slept.events.find(e => e.type === 'morning');
  assert.deepEqual([...morning.settled].sort(), worked);
  assert.deepEqual(slept.state.people, {});
  assert.deepEqual(slept.state.shifts, Object.fromEntries(Object.keys(cfg.places).filter(p => cfg.places[p].jobs && !cfg.places[p].locked).map(p => [p, 0])));
  assert.ok(view(cfg, slept.state).people.every(p => p.mood === 'calm' && !p.outToday));
  const out = step(cfg, slept.state, { do: 'out', take: 0 }).state;
  assert.equal(view(cfg, out).options.length, 3);
  assert.equal(view(cfg, out).dry, null);
  // the day ends in jail: the morning after, the same
  const s = at('market', { heat: 4, energy: 6 });
  const o = view(cfg, s).options.find(x => !x.safe);
  const jailed = step(cfg, { ...s, rig: { chances: [0, 0] } }, o.choice); // the job works, then the police stop you
  assert.deepEqual(jailed.events.map(e => e.type), ['job', 'stopped', 'jail']);
  assert.equal(jailed.state.people[o.who.id].out, true);
  const released = step(cfg, jailed.state, { do: 'morning' });
  assert.deepEqual(released.events[0].settled, [o.who.id]);
  assert.deepEqual(released.state.people, {});
});

test('people: the same state deals the same options to the same people; same seed and choices, same game', () => {
  const { state } = workDry(cfg, at('park', { energy: 30 }, 7));
  const half = { ...at('market', { energy: 40 }, 7, CALM) };
  const mid = workDry(CALM, half).trail[3].view;
  for (const s of [state, at('park', { hour: 15 }, 7)]) assert.equal(bytes(deal(cfg, s)), bytes(deal(cfg, { ...s })));
  assert.equal(bytes(view(CALM, workDry(CALM, half).state)), bytes(view(CALM, workDry(CALM, half).state)));
  assert.equal(bytes(workDry(CALM, half).trail[3].view), bytes(mid));
});

test('people: additive to the page contract: every old field of the view, its options, moves, choices, shop and danger, and of every event, is still there', () => {
  // the fields as they were before people (run-1 at 676b80e)
  const OLD = {
    view: ['day', 'hour', 'clock', 'place', 'placeLabel', 'block', 'held', 'energy', 'energyMax', 'tired', 'heat', 'heatMax', 'carried', 'banked', 'owned', 'ownedLabels', 'done', 'hoursThere', 'options', 'moves', 'shop', 'danger', 'subway', 'corner', 'choices'],
    option: ['key', 'id', 'label', 'odds', 'sure', 'oddsWhy', 'pay', 'ifWin', 'ifFail', 'winHeat', 'failHeat', 'failEnergy', 'energy', 'safe', 'available', 'why', 'choice'],
    choice: ['key', 'label', 'choice', 'available', 'why'],
    move: ['key', 'label', 'choice', 'available', 'why', 'kind'],
    shop: ['item', 'label', 'price', 'does', 'owned', 'key', 'available', 'why'],
    event: ['day', 'hour', 'place', 'block', 'to', 'type', 'by', 'text', 'scene'],
    job: ['job', 'label', 'with', 'roll', 'chance', 'outcome', 'money'],
    win: ['pay', 'heat'],
    fail: ['heat', 'energyLost'],
    morning: ['night', 'money'],
  };
  const WITH = { odd: 'a neighbour', loosies: 'the bus stop', collect: 'Darlene at the office', stall: 'the shopkeeper', crowd: 'the crowd', wallet: 'a mark', till: 'the shopkeeper', stickup: 'a stallholder',
    shift: 'the foreman', lift: 'a driver', flyers: 'the flyers man', phone: 'an office worker' };
  const has = (obj, keys, what) => { for (const k of keys) assert.ok(k in obj, `${what} lost ${k}`); };
  const counts = { option: 0, job: 0, morning: 0 };
  for (const seed of [1, 2, 3]) {
    let state = newRun({ seed, cfg });
    state.owned.cutter = seed === 3;
    for (let i = 0; i < 300; i++) {
      const v = view(cfg, state);
      has(v, OLD.view, 'the view');
      assert.ok(Array.isArray(v.people) && 'dry' in v, 'the view adds people and dry');
      for (const o of v.options) {
        has(o, OLD.option, 'an option');
        assert.deepEqual(o.choice, { do: 'job', id: o.id }, 'a job choice keeps its shape');
        assert.ok(o.who && 'mood' in o);
        counts.option++;
      }
      for (const c of v.choices) has(c, OLD.choice, 'a choice');
      for (const m of v.moves) has(m, OLD.move, 'a move');
      for (const s of v.shop) has(s, OLD.shop, 'the shop');
      has(v.danger, v.danger.here ? ['here', 'thisHour', 'oneMore'] : ['here', 'why'], 'the danger');
      const legal = v.choices.filter(c => c.available);
      const pick = legal[(seed * 7 + i * 13) % legal.length].choice;
      // an old choice, just { do: 'job', id }, still steps
      const { state: next, events } = step(cfg, state, pick.do === 'job' ? { do: 'job', id: pick.id } : pick);
      for (const e of events) {
        has(e, OLD.event, `a ${e.type} event`);
        if (e.type === 'job') {
          has(e, [...OLD.job, ...(e.outcome === 'win' ? OLD.win : OLD.fail)], 'a job event');
          assert.equal(e.with, WITH[e.job]);
          assert.ok(e.who && e.who.id && e.who.name && e.who.role && 'mood' in e && 'outToday' in e, 'the job event adds who, mood, outToday');
          counts.job++;
        }
        if (e.type === 'morning' || e.type === 'released') {
          has(e, OLD.morning, 'a morning');
          assert.ok(Array.isArray(e.settled));
          counts.morning++;
        }
      }
      state = next;
    }
  }
  assert.ok(counts.option > 100 && counts.job > 30 && counts.morning > 3, bytes(counts));
});

test('people: a saved version-1 state (no people yet) still views and plays, as a day nobody has been dealt with', () => {
  const v1 = { ...at('park', { energy: 6 }), v: 1 };
  delete v1.people;
  delete v1.shifts;
  const v = view(cfg, v1);
  assert.equal(v.options.length, 3);
  assert.ok(v.people.every(p => p.mood === 'calm' && !p.outToday));
  const o = v.options.find(x => !x.safe);
  const { state } = step(cfg, v1, o.choice);
  assert.equal(state.people[o.who.id].out, true);
  assert.ok(checkRunBooks(state).ok);
});
