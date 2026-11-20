// Home pressure (RUN.md, "Home pressure (home-1)"): what you do on the street your crib opens onto builds a pressure;
// high enough, somebody is seen casing your crib, and the next day they try it while you are out. A notice reaches you;
// home in time, you meet them at the door; otherwise a guard on your step, a deadbolt and a floor safe decide it.
// The three conditions are tested by name: (1) the bank stays the point: warned the day before, a share and never
// all, and a choice can stop it; (2) pressure is what you DO there, never what you have; (3) it comes in waves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, ACTIONS } from '../src/stage.mjs';
import { CITY } from '../src/map.mjs';
import { rng, pick } from '../src/rng.mjs';
import { RUN_CONFIG, withRunConfig, newRun, view, step, deal, checkRunBooks, RUN_STATE_VERSION } from '../src/run/index.mjs';
import { pressureOf, warnChance, raidTakes, defencesOf, guardOf, raidCast, homeStreet, atHome } from '../src/run/rules.mjs';
import { POLICIES, playSeason } from '../src/run/policies.mjs';
import { measureHome, judgeHome, homeText } from '../src/run/marks.mjs';

const cfg = RUN_CONFIG;
const P = cfg.pressure;
// nobody jumps you and the police never stop you: an hour's own result, with nothing after it
const CALM = withRunConfig({ jump: { basePct: 0, perHourPct: 0, perStepPct: 0 }, police: { perHeat: 0 } });
const DEE = 'npc:buyer:projects:1';
const BENNY = 'npc:debtor';
const EARL = 'npc:connect:projects';
const ALVAREZ = 'npc:neighbour';

function at(place, extra = {}, seed = 1, c = cfg) {
  const s = newRun({ seed, cfg: c });
  return { ...s, place, energy: 6, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) }, home: { ...s.home, ...(extra.home ?? {}) } };
}
/** What you did at home, `n` points of it, on `day`. */
const marks = (n, day = 1) => [{ why: 'wallet', text: 'You lifted a wallet', n, day }];
/** An attempt due on `day` from `hour`, not yet started. */
const due = (day, hour = 13, who = { ...P.stranger }) => ({ who: { id: who.id, name: who.name, role: who.role }, why: 'stranger', day, hour, warned: day - 1, started: null });
/** A state at `place` whose hour deals job `id`. */
function dealtAt(c, place, id, extra = {}, seed = 1) {
  for (let hour = 12; hour < 200; hour++) {
    const s = at(place, { ...extra, hour }, seed, c);
    if (deal(c, s).some(j => j.id === id)) return s;
  }
  throw new Error(`${id} never dealt at ${place}`);
}
function run(c, state, choices) {
  const events = [];
  for (const ch of choices) {
    const r = step(c, state, typeof ch === 'function' ? ch(view(c, state)) : ch);
    events.push(...r.events);
    state = r.state;
  }
  return { state, events };
}
const banked = (state, n) => ({ ...state, banked: n, books: { ...state.books, start: state.books.start + n - state.banked } });

test('home: the home is whatever the config says: the crib and the street its door opens onto', () => {
  assert.equal(homeStreet(cfg), cfg.places.crib.inside);
  assert.ok(atHome(cfg, at('crib')) && atHome(cfg, at('park')));
  assert.ok(!atHome(cfg, at('market')) && !atHome(cfg, at('jail')));
  // move the crib's door to the Jay St night market, and home is the Jay St night market (no rule names a place)
  const moved = withRunConfig({ places: { crib: { inside: 'market' }, market: { door: 'crib' }, park: { door: null } } }, CALM);
  assert.equal(homeStreet(moved), 'market');
  const s = dealtAt(moved, 'market', 'wallet');
  const ev = step(moved, { ...s, rig: { chances: [0] } }, { do: 'job', id: 'wallet' }).events.find(e => e.type === 'job');
  assert.equal(ev.pressure.n, cfg.places.market.jobs.wallet.pressure.win);
  const p = dealtAt(moved, 'park', 'wallet');
  assert.equal(step(moved, { ...p, rig: { chances: [0] } }, { do: 'job', id: 'wallet' }).events.find(e => e.type === 'job').pressure, undefined);
});

test('home: what you do on your own street moves the pressure, said on the event; the same at the market does nothing', () => {
  const s = dealtAt(CALM, 'park', 'wallet');
  const win = step(CALM, { ...s, rig: { chances: [0] } }, { do: 'job', id: 'wallet' });
  const ev = win.events.find(e => e.type === 'job');
  assert.deepEqual([ev.pressure.from, ev.pressure.to, ev.pressure.n, ev.pressure.why], [0, 1, 1, 'wallet']);
  assert.match(ev.pressure.text, /Pressure at home \+1 \(1 of 10\)/);
  assert.equal(pressureOf(CALM, win.state).value, 1);
  // caught: +2 (and the mark turns against you: +1 more while they are)
  const fail = step(CALM, { ...s, rig: { chances: [99] } }, { do: 'job', id: 'wallet' });
  assert.equal(fail.events.find(e => e.type === 'job').pressure.n, 2);
  // (memory-1: a fight won on the way leaves them afraid of you, and fear eases it by memory.fear.pressure)
  const scared = Object.values(fail.state.marks ?? {}).some(m => m.kind === 'beat');
  assert.equal(pressureOf(CALM, fail.state).value, 3 + (scared ? CALM.memory.fear.pressure : 0));
  assert.ok(pressureOf(CALM, fail.state).reasons.some(r => r.why === 'against' && r.n === 1));
  // the same lift at the Jay St night market: nothing at home
  const m = dealtAt(CALM, 'market', 'wallet');
  const away = step(CALM, { ...m, rig: { chances: [0] } }, { do: 'job', id: 'wallet' });
  assert.equal(away.events.find(e => e.type === 'job').pressure, undefined);
  assert.deepEqual(away.state.home.marks, []);
  // robbing somebody passing at home: +2, +3 caught
  const rob = step(CALM, { ...at('park', { owned: { cutter: true } }, 1, CALM), rig: { chances: [0] } }, { do: 'rob' });
  assert.equal(rob.events.find(e => e.type === 'rob').pressure.n, cfg.street.rob.pressure.win);
  // the odd job takes a point off what holds it up
  const o = dealtAt(CALM, 'park', 'odd', { home: { marks: marks(3) } });
  const odd = step(CALM, o, { do: 'job', id: 'odd' });
  assert.equal(odd.events.find(e => e.type === 'job').pressure.n, -1);
  assert.equal(pressureOf(CALM, odd.state).value, 2);
  // the view says it on each option at home, and not at the Jay St night market
  const v = view(CALM, s);
  assert.deepEqual(v.options.find(x => x.id === 'wallet').pressure, { ifWin: 1, ifFail: 2 });
  assert.deepEqual(v.options.find(x => x.id === 'odd').pressure, { ifWin: -1, ifFail: 0 });
  assert.equal(view(CALM, m).options.find(x => x.id === 'wallet').pressure, null);
});

test('home: shutting the door on a regular, being seen in the bins, a call to the police: all pressure; giving eases it', () => {
  const door = { id: DEE, name: 'Shaky Dee', role: 'buyer', place: 'park', wants: 8 };
  const shut = step(cfg, { ...at('crib', { door, regulars: { [DEE]: 4 } }), rig: { chances: [99] } }, { do: 'refuse' });
  assert.equal(shut.events.find(e => e.type === 'refused').pressure.n, P.refuse);
  // (and Dee is against you now: +1 more while he is)
  assert.equal(pressureOf(cfg, shut.state).value, P.refuse + P.against);
  const gave = step(cfg, at('crib', { door, regulars: { [DEE]: 4 }, home: { marks: marks(2) } }), { do: 'give' });
  assert.equal(gave.events.find(e => e.type === 'gave').pressure.n, P.give);
  assert.equal(pressureOf(cfg, gave.state).value, 1);
  // seen in the bins (rigged: the find, then seen)
  const bins = step(CALM, { ...at('park', {}, 1, CALM), rig: { chances: [0, 0] } }, { do: 'bins' });
  const be = bins.events.find(e => e.type === 'bins');
  assert.ok(be.seen && !be.lookedAway);
  assert.equal(be.pressure.n, P.bins);
});

test('home: who lives there counts: against you +1 each, with you −1 each (a regular never looks out for you), the street hot +1', () => {
  const s = at('park', { trust: { [BENNY]: -3, [ALVAREZ]: 3, [DEE]: 3 }, placeHeat: { park: 3 }, home: { marks: marks(4) } });
  const p = pressureOf(cfg, s);
  const by = why => p.reasons.filter(r => r.why === why);
  assert.equal(by('against').length, 1);
  assert.equal(by('with').length, 1); // Mrs. Alvarez; Dee is with you too, but a regular wants more from you
  assert.equal(by('with')[0].who.id, ALVAREZ);
  assert.equal(by('hot').length, 1);
  assert.equal(p.value, 4 + 1 - 1 + 1);
  for (const r of p.reasons) assert.ok(typeof r.text === 'string' && r.text.length > 0);
});

test('condition 2: pressure is what you do there, never what you have banked or own', () => {
  const s = dealtAt(CALM, 'park', 'wallet');
  const poor = step(CALM, { ...banked(s, 0), rig: { chances: [0] } }, { do: 'job', id: 'wallet' }).state;
  const rich = step(CALM, { ...banked(s, 100000), owned: { pocket: true, cutter: true, bed: true }, things: { board: true, deadbolt: true, floorsafe: true }, rig: { chances: [0] } }, { do: 'job', id: 'wallet' }).state;
  assert.deepEqual(pressureOf(CALM, poor), pressureOf(CALM, rich));
  // a quiet player with a fortune banked: pressure 0, no warning, ever
  let q = banked(at('crib'), 50000);
  for (let i = 0; i < 6; i++) q = step(cfg, q, { do: 'sleep' }).state;
  assert.equal(pressureOf(cfg, q).value, 0);
  assert.equal(q.home.raid, null);
  // the quiet player measured: no attempt in 300 ten-day runs, banking all the while
  for (const pol of [POLICIES.stall, POLICIES.quiet(120)]) {
    for (let seed = 1; seed <= 150; seed++) {
      const r = playSeason(cfg, { seed, policy: pol, days: 10 });
      assert.equal(r.tally.warnings + r.tally.raids, 0, `seed ${seed}`);
    }
  }
});

test('home: what you did fades every morning: a step after a day you added to it, two after a quiet one', () => {
  const busy = step(cfg, at('crib', { day: 3, home: { marks: marks(5, 3) } }), { do: 'sleep' }).state;
  assert.equal(pressureOf(cfg, busy).value, 5 - P.fade);
  const quiet = step(cfg, at('crib', { day: 3, home: { marks: marks(5, 2) } }), { do: 'sleep' }).state;
  assert.equal(pressureOf(cfg, quiet).value, 5 - P.quietFade);
  // never past the top
  let s = dealtAt(CALM, 'park', 'wallet', { home: { marks: marks(P.max) } });
  s = step(CALM, { ...s, rig: { chances: [99] } }, { do: 'job', id: 'wallet' }).state;
  assert.equal(s.home.marks.reduce((a, m) => a + m.n, 0), P.max);
});

test('home: high enough, a morning brings a warning: who (a real person first), what is at stake, what you could do', () => {
  // under warnAt: nothing
  assert.equal(warnChance(cfg, P.warnAt - 1), 0);
  assert.equal(warnChance(cfg, P.warnAt), P.warnPct);
  const low = step(cfg, { ...at('crib', { home: { marks: marks(P.warnAt - 1, 0) } }), rig: { chances: [0] } }, { do: 'sleep' });
  assert.ok(!low.events.some(e => e.type === 'casing'));
  // high, the roll hits: Shaky Dee, with a grudge, cases your crib (preferred over Benny, who is also against you)
  // (sixes-1: under crew.at, a sneak: from 7 it is a crew, below)
  const s = banked(at('crib', { trust: { [DEE]: -3, [BENNY]: -3 }, home: { marks: marks(4) } }), 400);
  const r = step(cfg, { ...s, rig: { chances: [0] } }, { do: 'sleep' });
  const c = r.events.find(e => e.type === 'casing');
  assert.ok(c, r.events.map(e => e.type).join());
  assert.equal(c.who.id, DEE);
  assert.equal(c.why, 'grudge');
  assert.equal(c.raidDay, r.state.day + 1);
  assert.deepEqual([c.stake.banked, c.stake.share, c.stake.takes], [400, cfg.raid.share, Math.floor(400 * cfg.raid.share / 100)]);
  // (sixes-1: each piece that does a job against a sneak: the deadbolt, the floor safe, the dog, the camera, the sign)
  assert.deepEqual(c.could.map(x => x.what), [...Object.values(cfg.things).filter(t => t.defends && (!t.against || t.against.includes('sneak'))).map(() => 'thing'), 'guard', 'home', 'lay low']);
  assert.equal(c.kind, 'sneak');
  assert.match(c.text, /Shaky Dee, with a grudge against you, was seen hanging round your crib/);
  assert.match(c.text, /At stake: \$120 of the \$400/);
  assert.equal(r.state.home.raid.day, r.state.day + 1);
  assert.ok(c.scene.action && ACTIONS.includes(c.scene.action));
  // nobody against you: a hooked regular; nobody at all: a stranger
  assert.equal(raidCast(cfg, at('crib', { regulars: { [DEE]: 3 } })).id, DEE);
  assert.equal(raidCast(cfg, at('crib')).id, P.stranger.id);
  assert.equal(raidCast(cfg, at('crib', { trust: { [BENNY]: -3 } })).id, BENNY);
  // the view's meter says what it leads to
  const v = view(cfg, at('crib', { home: { marks: marks(6) } }));
  assert.equal(v.pressure.value, 6);
  assert.equal(v.pressure.level, 'high');
  assert.ok(v.pressure.leadsTo.chance > 0);
  assert.match(v.pressure.leadsTo.text, /somebody is seen casing your crib/);
  assert.ok(v.pressure.eases.length >= 2);
});

test('home: the attempt waits until you are away, a notice reaches you with the ways home, and home in time you meet it at the door', () => {
  // the raid day: at the crib and in the trailer park nothing starts, whatever the hour
  let s = banked(at('crib', { day: 2, hour: 12, home: { raid: due(2, 13) } }, 1, CALM), 300);
  let r = run(CALM, s, [{ do: 'out', take: 10 }]);
  assert.ok(!r.events.some(e => e.type === 'alarm'));
  // the subway to the Jay St night market: away, past its hour: the notice
  r = run(CALM, r.state, [{ do: 'subway', to: 'market', hop: false }]);
  const alarm = r.events.find(e => e.type === 'alarm');
  assert.ok(alarm);
  assert.equal(alarm.until, alarm.startedAt + cfg.raid.window);
  const sub = alarm.ways.find(w => w.choice.do === 'subway' && !w.choice.hop);
  const walk = alarm.ways.find(w => w.choice.do === 'walk');
  assert.deepEqual([sub.hours, sub.inTime, walk.hours, walk.inTime], [1, true, 2, true]);
  assert.match(alarm.text, /at your crib's door\. Home within 2 hours/);
  // the view's notice: the hours left, each way with its key
  const v = view(CALM, r.state);
  assert.equal(v.home.notice.hoursLeft, cfg.raid.window);
  assert.ok(v.home.notice.ways.every(w => w.key));
  // home on the subway inside the window: met at the door (rigged: you see them off)
  const met = step(CALM, { ...r.state, rig: { rolls: [99] } }, sub.choice);
  const raid = met.events.find(e => e.type === 'raid');
  assert.deepEqual([raid.how, raid.outcome, raid.taken, raid.fight.outcome], ['door', 'held', 0, 'disaster']);
  assert.equal(met.state.home.raid, null);
  assert.equal(met.state.home.last, 2);
  // or rigged their clean win: they get in past you, take the share, and you are hurt
  const lost = step(CALM, { ...r.state, rig: { rolls: [0] } }, sub.choice);
  const le = lost.events.find(e => e.type === 'raid');
  assert.deepEqual([le.outcome, le.taken, le.fight.energyLost], ['taken', Math.floor(r.state.banked * cfg.raid.share / 100), cfg.raid.hurt.clean]);
  assert.ok(checkRunBooks(lost.state).ok);
  assert.equal(lost.state.books.burgled, le.taken);
  for (const e of [...r.events, ...met.events, ...lost.events]) if (e.scene.kind) assert.ok(KINDS[e.scene.kind], e.scene.kind);
});

test('home: stay out past the window and your defences settle it: the door, a deadbolt, a floor safe', () => {
  const start = banked(at('market', { day: 2, hour: 13, home: { raid: { ...due(2, 13), started: { at: 13, by: 15 } } } }, 1, CALM), 1000);
  const work = s => run(CALM, s, [{ do: 'job', id: deal(CALM, s)[0].id }, st => ({ do: 'job', id: st.options[0].id })]);
  // two hours of the stall: at 15:00 it is settled; rigged in (60 < 75): 30% of the bank
  let r = work({ ...start, rig: { chances: [60] } });
  let e = r.events.find(x => x.type === 'raid');
  assert.deepEqual([e.how, e.outcome, e.taken, e.chance], ['away', 'taken', 300, cfg.raid.pct]);
  // the deadbolt: the same roll does not get in (60 is not under 50)
  r = work({ ...start, things: { deadbolt: true }, rig: { chances: [60] } });
  e = r.events.find(x => x.type === 'raid');
  assert.deepEqual([e.outcome, e.taken, e.chance, e.defences.pctBy], ['held', 0, cfg.things.deadbolt.defends.pct, 'deadbolt']);
  assert.match(e.text, /a deadbolt held/);
  // the floor safe: in, but they find much less
  r = work({ ...start, things: { floorsafe: true }, rig: { chances: [0] } });
  e = r.events.find(x => x.type === 'raid');
  assert.deepEqual([e.outcome, e.taken, e.share], ['taken', 80, cfg.things.floorsafe.defends.share]);
  assert.match(e.text, /the rest was in a floor safe/);
  // the view says how it would go, before
  const v = view(CALM, { ...start, things: { deadbolt: true, floorsafe: true } });
  assert.deepEqual([v.home.odds.away.pct, v.home.odds.away.share, v.home.odds.stake.takes], [50, 8, 80]);
  assert.match(v.home.notice.ifYouStay.text, /a deadbolt and a floor safe decide it/);
});

test('home: home all day, they come in the night and you meet them at the door; held in the jail, your defences settle it', () => {
  const s = banked(at('crib', { day: 2, home: { raid: due(2, 13) } }), 200);
  const night = step(cfg, { ...s, rig: { rolls: [0] } }, { do: 'sleep' });
  const e = night.events.find(x => x.type === 'raid');
  assert.deepEqual([e.how, e.night, e.outcome, e.taken], ['door', true, 'taken', 60]);
  assert.equal(night.state.energy, Math.max(cfg.energy.minMorning, cfg.energy.mattress - cfg.raid.hurt.clean));
  // in jail on the day: settled at once by the door
  const jail = step(cfg, { ...banked(at('jail', { day: 2, home: { raid: due(2, 13) } }), 200), rig: { chances: [99] } }, { do: 'morning' });
  const je = jail.events.find(x => x.type === 'raid');
  assert.deepEqual([je.how, je.outcome], ['away', 'held']);
});

test('condition 1: an attempt takes a share and never all of what is banked, never goods or things', () => {
  for (const b of [0, 1, 3, 7, 10, 999, 100000]) {
    const t = raidTakes(cfg, banked(at('crib'), b));
    assert.ok(t.takes < b || b === 0, `takes ${t.takes} of ${b}`);
    assert.ok(t.takes <= Math.floor(b * cfg.raid.share / 100));
  }
  assert.ok(cfg.raid.share < 100 && Object.values(cfg.things).every(t => !t.defends?.share || t.defends.share < cfg.raid.share));
  const s = banked(at('market', { day: 2, hour: 15, stash: { smokes: 5 }, things: { lavalamp: true }, home: { raid: { ...due(2, 13), started: { at: 13, by: 15 } } } }, 1, CALM), 7);
  const r = step(CALM, { ...s, rig: { chances: [0] } }, { do: 'job', id: deal(CALM, s)[0].id });
  const e = r.events.find(x => x.type === 'raid');
  assert.equal(e.taken, 2);
  assert.ok(r.state.banked > 0);
  assert.deepEqual([r.state.stash, r.state.things], [{ smokes: 5 }, { lavalamp: true }]);
});

test('condition 1: never an attempt without its warning the day before, measured', () => {
  for (const [pol, kit] of [[POLICIES.homeFirst(120), { bed: true }], [POLICIES.park, {}], [POLICIES.dealer(120), {}]]) {
    for (let seed = 1; seed <= 40; seed++) {
      const r = playSeason(cfg, { seed, policy: pol, kit, days: 10 });
      for (const d of r.tally.raidDays) assert.ok(r.tally.warnDays.includes(d - 1), `seed ${seed}: an attempt on day ${d} unwarned`);
    }
  }
});

test('condition 1: a choice stops it: somebody on your step (unless they beat him), being home, or laying low', () => {
  const s = banked(at('crib', { day: 2, home: { raid: due(2, 13) } }), 500);
  // the guard: hired at the crib for a stretch, paid up front from banked
  const g = view(cfg, s).choices.find(c => c.choice.do === 'guard');
  assert.ok(g.available, g.why);
  assert.match(g.label, /Hire Cousin Earl for your step, three days \(\$75, paid now\)/);
  const on = step(cfg, s, g.choice);
  assert.equal(on.state.banked, 500 - cfg.guard.price);
  assert.equal(on.state.books.guard, cfg.guard.price);
  assert.ok(guardOf(cfg, on.state).on);
  // away past the window, the guard holds (rigged: his fight goes their way only on a clean win)
  const away = { ...on.state, place: 'market', hour: 15, home: { ...on.state.home, raid: { ...due(2, 13), started: { at: 13, by: 15 } } } };
  const held = step(CALM, { ...away, rig: { rolls: [99] } }, { do: 'job', id: deal(CALM, away)[0].id });
  const he = held.events.find(e => e.type === 'raid');
  assert.deepEqual([he.how, he.outcome, he.taken, he.guard.beaten], ['guard', 'held', 0, false]);
  // beaten (their clean win): he is hurt and off for days, and the door decides it
  const beat = step(CALM, { ...away, rig: { rolls: [0], chances: [0] } }, { do: 'job', id: deal(CALM, away)[0].id });
  const be = beat.events.find(e => e.type === 'raid');
  assert.deepEqual([be.guard.beaten, be.guard.hurtDays, be.how, be.outcome], [true, cfg.guard.hurtDays, 'away', 'taken']);
  const hurt = guardOf(cfg, beat.state);
  assert.ok(!hurt.available && /hurt/.test(hurt.why));
  assert.equal(guardOf(cfg, { ...beat.state, day: 2 + cfg.guard.hurtDays + 1 }).available, true);
  // he will not work for you against you
  assert.match(guardOf(cfg, at('crib', { trust: { [EARL]: -3 } })).why, /won't work for you/);
  // laying low on the warning's day: down to warnAt − callOff by the morning, and they think better of it
  const low = step(cfg, at('crib', { day: 1, home: { raid: due(2, 13), marks: marks(1, 0) } }), { do: 'sleep' });
  const off = low.events.find(e => e.type === 'calledOff');
  assert.ok(off);
  assert.equal(low.state.home.raid, null);
});

test('home: Cousin Earl is hired by the stretch: $75 at once, three days, no refund; his last day said; kept on with no gap, or gone', () => {
  const G = cfg.guard;
  assert.deepEqual([G.price, G.days], [75, 3]);
  const s = banked(at('crib', { day: 4 }), 200);
  const hire = view(cfg, s).choices.find(c => c.choice.do === 'guard');
  assert.equal(hire.key, String(view(cfg, s).choices.length)); // (still the last move at the crib: older keys unchanged)
  assert.deepEqual([hire.price, hire.days, hire.wage, hire.on, hire.keep], [75, 3, 25, false, false]);
  const r = step(cfg, s, hire.choice);
  const e = r.events.find(x => x.type === 'guard');
  assert.deepEqual([e.on, e.kept, e.paid, e.price, e.until, e.daysLeft], [true, false, 75, 75, 6, 3]);
  assert.equal(r.state.banked, 200 - 75);
  assert.equal(r.state.home.guard.until, 6);
  assert.ok(checkRunBooks(r.state).ok);
  // on: the view carries the days left and the price; the move is still listed (same key), not yet available
  let v = view(cfg, r.state);
  assert.deepEqual([v.home.defences.guard.on, v.home.defences.guard.daysLeft, v.home.defences.guard.until, v.home.defences.guard.price, v.home.defences.guard.lastDay], [true, 3, 6, 75, false]);
  const keep0 = v.choices.find(c => c.choice.do === 'guard');
  assert.equal(keep0.key, hire.key);
  assert.ok(!keep0.available && /through day 6/.test(keep0.why), keep0.why);
  // no sending him off for money back: there is no such choice
  assert.ok(!v.choices.some(c => c.choice.do === 'guard' && !c.choice.on));
  assert.throws(() => step(cfg, r.state, { do: 'guard', on: false }), /not a choice/);
  // the next morning: nothing paid, two days left
  const d5 = step(cfg, r.state, { do: 'sleep' });
  assert.equal(d5.state.banked, 125);
  assert.ok(!d5.events.some(x => x.type === 'guard'));
  assert.equal(guardOf(cfg, d5.state).daysLeft, 2);
  // the morning of his last day: a notice that says so, and the move keeps him on
  const d6 = step(cfg, d5.state, { do: 'sleep' });
  const last = d6.events.find(x => x.type === 'guard');
  assert.deepEqual([last.on, last.lastDay, last.paid, last.daysLeft, last.canKeep, last.scene.notice], [true, true, 0, 1, true, true]);
  assert.match(last.text, /Cousin Earl's last day on your step: keep him 3 more days for \$75/);
  v = view(cfg, d6.state);
  assert.ok(v.home.defences.guard.lastDay && v.home.defences.guard.on);
  const keep = v.choices.find(c => c.choice.do === 'guard');
  assert.ok(keep.available, keep.why);
  assert.match(keep.label, /Keep Cousin Earl on your step three more days \(\$75, paid now\): through day 9/);
  const kept = step(cfg, d6.state, keep.choice);
  const ke = kept.events.find(x => x.type === 'guard');
  assert.deepEqual([ke.kept, ke.paid, ke.until], [true, 75, 9]);
  assert.equal(kept.state.banked, 50);
  // kept: on with no gap the morning after
  const d7 = step(cfg, kept.state, { do: 'sleep' });
  assert.ok(guardOf(cfg, d7.state).on);
  assert.equal(guardOf(cfg, d7.state).until, 9);
  // not kept: gone the next morning, said
  const d7b = step(cfg, d6.state, { do: 'sleep' });
  const gone = d7b.events.find(x => x.type === 'guard');
  assert.deepEqual([gone.on, gone.why, gone.paid], [false, 'done', 0]);
  assert.equal(guardOf(cfg, d7b.state).on, false);
  assert.ok(view(cfg, banked(d7b.state, 200)).choices.find(c => c.choice.do === 'guard').available);
  // short of his price: not hired
  assert.match(view(cfg, banked(at('crib'), 74)).choices.find(c => c.choice.do === 'guard').why, /you have \$74 banked/);
});

test('home: Earl beaten at the door: hurt three days, and what was left of his stretch is lost', () => {
  const s = banked(at('crib', { day: 2, home: { raid: due(2, 13) } }), 500);
  const on = step(cfg, s, { do: 'guard', on: true }).state;
  assert.equal(on.home.guard.until, 4);
  const away = { ...on, place: 'market', hour: 15, home: { ...on.home, raid: { ...due(2, 13), started: { at: 13, by: 15 } } } };
  const beat = step(CALM, { ...away, rig: { rolls: [0], chances: [99] } }, { do: 'job', id: deal(CALM, away)[0].id });
  const be = beat.events.find(e => e.type === 'raid');
  assert.deepEqual([be.guard.beaten, be.guard.hurtDays, be.guard.lostDays], [true, cfg.guard.hurtDays, 2]);
  assert.match(be.text, /the 2 days left of his stretch are lost/);
  assert.deepEqual([beat.state.home.guard.on, beat.state.home.guard.until], [false, null]);
  const g = guardOf(cfg, { ...beat.state, day: 3 });
  assert.ok(!g.on && !g.available && /hurt/.test(g.why));
  // no money back, and not on again when the stretch would have run
  assert.equal(beat.state.books.guard, cfg.guard.price);
  assert.equal(guardOf(cfg, { ...beat.state, day: 4 }).on, false);
  assert.ok(guardOf(cfg, { ...beat.state, day: 2 + cfg.guard.hurtDays + 1 }).available);
});

test('home: against you, Earl will not take the job; turned against you during a stretch, he finishes it and takes no other', () => {
  const against = banked(at('crib', { trust: { [EARL]: -3 } }), 200);
  const c = view(cfg, against).choices.find(x => x.choice.do === 'guard');
  assert.ok(!c.available && /won't work for you/.test(c.why));
  // hired, then against you (a police stop took his cartons): still on, still fights at your step
  const on = step(cfg, banked(at('crib', { day: 2 }), 200), { do: 'guard', on: true }).state;
  const sour = { ...on, trust: { [EARL]: -3 } };
  assert.ok(guardOf(cfg, sour).on);
  const away = { ...sour, place: 'market', hour: 15, home: { ...sour.home, raid: { ...due(2, 13), started: { at: 13, by: 15 } } } };
  const held = step(CALM, { ...away, rig: { rolls: [99] } }, { do: 'job', id: deal(CALM, away)[0].id });
  assert.equal(held.events.find(e => e.type === 'raid').how, 'guard');
  // on his last day: said, and he will not be kept on
  const last = { ...sour, day: 4, trust: { [EARL]: -3 } };
  assert.ok(guardOf(cfg, last).lastDay);
  const keep = view(cfg, last).choices.find(x => x.choice.do === 'guard');
  assert.ok(!keep.available && /won't take another stretch/.test(keep.why), keep.why);
  const morning = step(cfg, { ...sour, day: 3, trust: { [EARL]: -3 } }, { do: 'sleep' });
  const e = morning.events.find(x => x.type === 'guard');
  assert.ok(e.lastDay && e.canKeep === false && /won't take another stretch/.test(e.text), e?.text);
});

test('home: a version-7 state with Earl on by the day reads as him paid through that day', () => {
  const s = banked(at('crib', { day: 3, home: { guard: { on: true } } }), 100);
  assert.deepEqual([guardOf(cfg, s).on, guardOf(cfg, s).until], [true, 3]);
  const r = step(cfg, s, { do: 'sleep' });
  assert.equal(guardOf(cfg, r.state).on, false);
  assert.equal(r.state.banked, 100);
  assert.ok(r.events.some(e => e.type === 'guard' && e.why === 'done'));
});

test('home: the deadbolt and the floor safe are bought on the street like the things for the trailer, listed after every older move', () => {
  const park = view(cfg, { ...at('park'), carried: 30, books: { ...at('park').books, earned: 30 } });
  const bolt = park.choices.find(c => c.choice.do === 'get' && c.choice.item === 'deadbolt');
  assert.ok(bolt.available);
  assert.equal(bolt.key, String(park.choices.filter(c => !c.shelf && !(c.choice.do === 'subway' && cfg.places.park.links[c.choice.to]?.late) && c.choice.do !== 'learn' && c.choice.do !== 'fightWith' && c.choice.do !== 'making' && !(c.choice.do === 'get' && cfg.things[c.choice.item]?.late)).length)); // (pot-1: and the makings sold here) last of all but today's shelves (lib-1), the rides added after (batch-1) and the lessons and fight-with (styles-1)
  // (sixes-1: and its job against a crew kicking the door while you are out, `kick`)
  assert.deepEqual(bolt.defends, { pct: cfg.things.deadbolt.defends.pct, kick: cfg.things.deadbolt.defends.kick });
  const got = step(cfg, { ...at('park'), carried: 30, books: { ...at('park').books, earned: 30 } }, bolt.choice);
  assert.ok(got.state.things.deadbolt);
  assert.equal(got.events[0].inTrailer, 'door');
  assert.equal(defencesOf(cfg, got.state).pct, cfg.things.deadbolt.defends.pct);
  const market = view(cfg, { ...at('market'), carried: 120, books: { ...at('market').books, earned: 120 } });
  assert.ok(market.choices.find(c => c.choice.do === 'get' && c.choice.item === 'floorsafe').available);
  assert.equal(market.home.defences.things.find(t => t.item === 'floorsafe').inTrailer, 'under-the-counter');
});

test('condition 3: waves: never two days running, and two quiet days at least after every attempt', () => {
  // the morning after an attempt, with the pressure at the top: no warning
  const after = { home: { last: 2, marks: marks(10, 2) } };
  const d3 = step(cfg, { ...at('crib', { day: 2, ...after }), rig: { chances: [0, 0, 0] } }, { do: 'sleep' });
  assert.ok(!d3.events.some(e => e.type === 'casing'));
  assert.ok(view(cfg, at('crib', { day: 2, ...after })).pressure.leadsTo.resting); // (the view said so the evening before)
  // the morning after that, it may (an attempt on day 5: days 3 and 4 were quiet)
  const d4 = step(cfg, { ...d3.state, home: { ...d3.state.home, marks: marks(10, 3) }, rig: { chances: [0, 0, 0] } }, { do: 'sleep' });
  const c = d4.events.find(e => e.type === 'casing');
  assert.ok(c);
  assert.equal(c.raidDay - 2, 3);
  // and never while one is due
  const twice = step(cfg, { ...at('crib', { day: 1, home: { raid: due(3, 13), marks: marks(10, 1) } }), rig: { chances: [0] } }, { do: 'sleep' });
  assert.ok(!twice.events.some(e => e.type === 'casing'));
  // measured
  for (let seed = 1; seed <= 40; seed++) {
    const r = playSeason(cfg, { seed, policy: POLICIES.homeFirst(120), kit: { bed: true }, days: 12 });
    const d = r.tally.raidDays;
    for (let i = 1; i < d.length; i++) assert.ok(d[i] - d[i - 1] >= 3, `seed ${seed}: attempts on days ${d[i - 1]} and ${d[i]}`);
  }
});

test('home: an older saved state (version 6) loads calm, with nothing due and nobody on the step, and plays on', () => {
  assert.equal(RUN_STATE_VERSION, 14); // (pot-1: 13, reading 12; bench-1: 14)
  const v6 = { ...at('park'), v: 6 };
  delete v6.home;
  delete v6.books.burgled;
  delete v6.books.guard;
  const v = view(cfg, v6);
  assert.equal(v.pressure.value, 0);
  assert.equal(v.home.warning, null);
  assert.equal(v.home.defences.guard.on, false);
  const s = dealtAt(CALM, 'park', 'wallet');
  const old = { ...s, v: 6 };
  delete old.home;
  const lifted = step(CALM, { ...old, rig: { chances: [0] } }, { do: 'job', id: 'wallet' }).state;
  assert.equal(lifted.home.marks.length, 1);
  const r = run(CALM, lifted, [{ do: 'inside' }, { do: 'sleep' }]);
  assert.ok(checkRunBooks(r.state).ok);
});

test('home: monkeys under pressure never crash, every dollar is accounted for, every event has a scene the stage has', () => {
  const seen = new Set();
  for (const [seed, kit] of [[1, {}], [2, { cutter: true }], [3, { bed: true }], [4, { bed: true, cutter: true }]]) {
    let s = newRun({ seed, cfg });
    s.owned = { ...s.owned, ...kit };
    s.home = { ...s.home, marks: marks(10, 1) };
    const r = rng(seed, 'home-monkey');
    for (let i = 0; i < 700; i++) {
      const v = view(cfg, s);
      const legal = v.choices.filter(c => c.available);
      assert.ok(legal.length, `no legal choice at ${s.place}`);
      // keep the pressure up: lean to crime at home, and keep some money banked
      const crime = legal.find(c => c.choice.do === 'job' && ['wallet', 'collect'].includes(c.choice.id));
      const c = crime && r() < 0.5 ? crime.choice : pick(r, legal).choice;
      const choice = c.do === 'out' ? { ...c, take: Math.min(s.banked, 2) } : c;
      const out = step(cfg, s, choice);
      for (const e of out.events) {
        seen.add(e.type);
        assert.ok(e.scene && (e.scene.kind || e.scene.action || e.scene.ride || e.scene.notice), `${e.type}: a scene`);
        if (e.scene.kind) assert.ok(KINDS[e.scene.kind], `unknown kind ${e.scene.kind}`);
        if (e.scene.action) assert.ok(ACTIONS.includes(e.scene.action), `unknown action ${e.scene.action}`);
        if (e.block) assert.ok(CITY.blocks[e.block], `unknown block ${e.block}`);
      }
      s = out.state;
      assert.ok(checkRunBooks(s).ok, `books off at step ${i}`);
    }
  }
  for (const type of ['casing', 'raid']) assert.ok(seen.has(type), `no ${type}: ${[...seen]}`);
});

test('home: the marks measure, and the players are the same for the same seed', () => {
  const a = playSeason(cfg, { seed: 5, policy: POLICIES.racer(120), kit: { bed: true }, days: 10 });
  const b = playSeason(cfg, { seed: 5, policy: POLICIES.racer(120), kit: { bed: true }, days: 10 });
  assert.deepEqual(a.takes, b.takes);
  const h = measureHome(cfg, { seeds: 3 });
  const m = judgeHome(h);
  assert.deepEqual(m.map(x => x.n), ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8']);
  assert.match(homeText(m), /^Marks of home pressure/);
});
