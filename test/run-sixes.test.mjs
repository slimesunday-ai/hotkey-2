// THE FIRST SLICE (sixes-1, RUN.md "The Sixes and a home that scales: the first slice"): a crew at HOME 7 (a door
// fight you watch, Earl beside you told his way), six pieces each with one job, and the Sixes' meter with its first
// three steps (Dutch's word, the tax, two of them by the steps), held at 8.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, ACTIONS } from '../src/stage.mjs';
import { RUN_CONFIG, withRunConfig, newRun, view, step, deal, checkRunBooks, RUN_STATE_VERSION, saveRun, loadRun } from '../src/run/index.mjs';
import { crewOf, crewChance, crewOdds, sixesOf, taxOf, dogOf, defVal, raidKind, earlWayOf, guardOf } from '../src/run/rules.mjs';
import { runDuel } from '../src/fight/duel.mjs';
import { POLICIES, playSeason, decide } from '../src/run/policies.mjs';

const cfg = RUN_CONFIG;
const P = cfg.pressure;
const C = cfg.crew;
const X = cfg.sixes;
// nobody jumps you and the police never stop you: an hour's own result, with nothing after it
const CALM = withRunConfig({ jump: { basePct: 0, perHourPct: 0, perStepPct: 0 }, police: { perHeat: 0 } });
const SLICE = ['deadbolt', 'floorsafe', 'doorbar', 'dog', 'camera', 'dogsign'];
const owns = list => Object.fromEntries(list.map(k => [k, true]));

function at(place, extra = {}, seed = 1, c = cfg) {
  const s = newRun({ seed, cfg: c });
  return { ...s, place, energy: 6, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) }, home: { ...s.home, ...(extra.home ?? {}) } };
}
const banked = (s, n) => ({ ...s, banked: s.banked + n, books: { ...s.books, earned: s.books.earned + n } });
const carrying = (s, n) => ({ ...s, carried: s.carried + n, books: { ...s.books, earned: s.books.earned + n } });
const marks = (n, day = 1) => [{ why: 'wallet', text: 'You lifted a wallet', n, day }];
const crewDue = (day, who = { ...P.stranger }) => ({ who: { id: who.id, name: who.name, role: who.role }, why: 'stranger', day, hour: 13, warned: day - 1, started: null, kind: 'crew' });
const sixes = (n, day, more = {}) => ({ marks: n ? [{ why: 'sell', text: 'sold there', n, day: day - 1 }] : [], did: null, word: n >= X.word ? day - 1 : null, made: 0, madeDay: null, taxDay: null, tax: null, jump: null, jumps: [], ...more });

test('a crew: from crew.at the warning is of a crew, warned the day before; a sneak below it; the dog sign only puts off a sneak', () => {
  assert.equal(raidKind(cfg, C.at - 1), 'sneak');
  assert.equal(raidKind(cfg, C.at), 'crew');
  const s = banked(at('crib', { home: { marks: marks(C.at + 1) } }), 400);
  const r = step(cfg, { ...s, rig: { chances: [0] } }, { do: 'sleep' });
  const c = r.events.find(e => e.type === 'casing');
  assert.equal(c.kind, 'crew');
  assert.equal(c.raidDay, r.state.day + 1);
  assert.equal(r.state.home.raid.kind, 'crew');
  assert.match(c.text, /a crew of two, coming tomorrow night/);
  // what a crew is warned of: only the pieces with a job against a crew
  assert.deepEqual(c.could.filter(x => x.what === 'thing').map(x => x.item).sort(), Object.keys(cfg.things).filter(k => cfg.things[k].against?.includes('crew')).sort());
  // the dog sign: 10 points off a sneak's chance, nothing off a crew's
  // (the morning's fade takes one off what you did that day before the roll: at warnAt + 1 then)
  const sneakP = P.warnAt + 2;
  const base = Math.min(P.capPct, P.warnPct + P.perPoint);
  const signed = at('crib', { things: owns(['dogsign']), home: { marks: marks(sneakP) } });
  const roll = step(cfg, { ...signed, rig: { chances: [base - cfg.things.dogsign.defends.warn] } }, { do: 'sleep' });
  assert.ok(!roll.events.some(e => e.type === 'casing'), 'a sneak put off by the sign');
  const unsigned = step(cfg, { ...at('crib', { home: { marks: marks(sneakP) } }), rig: { chances: [base - cfg.things.dogsign.defends.warn] } }, { do: 'sleep' });
  assert.ok(unsigned.events.some(e => e.type === 'casing'), 'the same roll cases it without the sign');
});

test('the camera: the warning comes two days ahead, and attempts come no more often', () => {
  const s = banked(at('crib', { things: owns(['camera']), home: { marks: marks(C.at + 1) } }), 400);
  const r = step(cfg, { ...s, rig: { chances: [0] } }, { do: 'sleep' });
  const c = r.events.find(e => e.type === 'casing');
  assert.equal(c.lead, 2);
  assert.equal(c.raidDay, r.state.day + 2);
  // the quiet days count from the attempt: after one on day 3, the next comes on day 6 at the soonest, camera or not
  for (const things of [{}, owns(['camera'])]) {
    let first = null;
    for (let d = 3; d < 6 && !first; d++) {
      const x = step(cfg, { ...at('crib', { day: d, things, home: { marks: marks(10, d), last: 3 } }), rig: { chances: [0, 0] } }, { do: 'sleep' });
      first = x.events.find(e => e.type === 'casing') ?? null;
    }
    assert.equal(first?.raidDay, 6, JSON.stringify(things));
  }
});

test('the door fight: home in the night, the fight of several on the run\'s terms; won, nothing taken; lost, a share, never all', () => {
  let won = null;
  let lost = null;
  for (let day = 2; day < 60 && !(won && lost); day++) {
    const s = banked(at('crib', { day, hour: 21, energy: 2, owned: { bed: true }, home: { marks: marks(9, day), raid: crewDue(day) } }), 400);
    const r = step(cfg, s, { do: 'sleep' });
    const e = r.events.find(x => x.type === 'raid');
    assert.equal(e.kind, 'crew');
    assert.ok(e.duel?.crew, 'a fight');
    assert.equal(e.duel.inputs.foes.length, 2);
    assert.ok(KINDS[e.scene.kind], e.scene.kind);
    assert.ok(checkRunBooks(r.state).ok);
    if (e.duel.result === 'won' && !won) won = { s, r, e };
    if (e.duel.result !== 'won' && !lost) lost = { s, r, e };
  }
  assert.ok(won && lost);
  assert.equal(won.e.taken, 0);
  assert.equal(won.r.state.banked, won.s.banked);
  assert.equal(lost.e.taken, Math.floor((lost.s.banked * C.share) / 100));
  assert.ok(lost.r.state.banked > 0);
  // the energy it cost comes off the morning
  assert.equal(won.r.state.energy, cfg.energy.bed - C.hurt.won);
  assert.equal(lost.r.state.energy, cfg.energy.bed - C.hurt.lost);
  // the same fight, played again from its inputs and seed, ends the same: the page plays exactly this
  assert.equal(runDuel(won.e.duel.inputs, won.e.duel.seed).over.result, 'won');
  // the safe does not help when they beat you at home: they make you open it
  const safe = banked(at('crib', { day: lost.s.day, hour: 21, energy: 2, owned: { bed: true }, things: owns(['floorsafe']), home: { marks: marks(9, lost.s.day), raid: crewDue(lost.s.day) } }), 400);
  const rs = step(cfg, safe, { do: 'sleep' }).events.find(x => x.type === 'raid');
  if (rs.duel.result !== 'won') assert.equal(rs.share, C.share);
});

test('out for the night, a crew kicks the door: the chain and locks slow it, the safe keeps most; the dog is shut in the back', () => {
  const s = banked(at('jail', { day: 3, hour: 22, home: { marks: marks(9, 3), raid: crewDue(3) } }), 400);
  const r = step(cfg, { ...s, rig: { chances: [0] } }, { do: 'morning' });
  const e = r.events.find(x => x.type === 'raid');
  assert.equal(e.how, 'away');
  assert.equal(e.chance, C.kickPct);
  assert.equal(e.taken, Math.floor((400 + 20) * C.share / 100));
  const def = banked(at('jail', { day: 3, hour: 22, things: owns(['deadbolt', 'floorsafe', 'dog']), home: { marks: marks(9, 3), raid: crewDue(3) } }), 400);
  const r2 = step(cfg, { ...def, rig: { chances: [0] } }, { do: 'morning' });
  const e2 = r2.events.find(x => x.type === 'raid');
  assert.equal(e2.chance, cfg.things.deadbolt.defends.kick);
  assert.equal(e2.share, cfg.things.floorsafe.defends.crewShare);
  assert.notEqual(e2.how, 'dog');
});

test('the guard dog: fed $2 a morning from banked; a sneak who hears it gives up half the time; two days unfed it guards nothing', () => {
  const s = banked(at('crib', { things: owns(['dog']) }), 50);
  const r = step(cfg, s, { do: 'sleep' });
  const fed = r.events.find(e => e.type === 'dogFed');
  assert.equal(fed.paid, cfg.dog.feed);
  assert.equal(r.state.books.dog, cfg.dog.feed);
  assert.ok(checkRunBooks(r.state).ok);
  // a sneak while you are out: the dog's roll first
  const sneak = { who: { ...P.stranger }, why: 'stranger', day: 2, hour: 13, warned: 1, started: null };
  const out = banked(at('market', { day: 2, hour: 14, things: owns(['dog']), home: { raid: sneak } }), 300);
  const gaveUp = step(CALM, { ...out, rig: { chances: [0] } }, { do: 'job', id: 'stall' });
  const raid0 = step(CALM, { ...out, rig: { chances: [0] } }, { do: 'job', id: 'stall' }).events.find(e => e.type === 'alarm');
  assert.ok(raid0 || gaveUp.events.length);
  // unfed
  const hungry = at('crib', { banked: 0, things: owns(['dog']), home: { dog: { hungry: 1 } } });
  const h = step(cfg, { ...hungry, books: { ...hungry.books, start: 0 } }, { do: 'sleep' });
  assert.equal(h.state.home.dog.hungry, 2);
  assert.equal(dogOf(cfg, h.state).works, false);
  assert.equal(dogOf(cfg, at('crib', { things: owns(['dog']) })).works, true);
});

test('the door bar and Earl in the door fight: the first one through is hurt; Earl told his way fights beside you, and down he is off one day, his stretch kept', () => {
  const s = at('crib', { owned: { bed: true }, things: owns(['doorbar']) });
  assert.equal(crewOf(cfg, s).inputs.firstHurt, cfg.things.doorbar.defends.bar);
  assert.equal(crewOf(cfg, at('crib')).inputs.firstHurt, undefined);
  // the fight starts with the first one through that much down
  const F = runDuel(crewOf(cfg, s).inputs, 7);
  assert.ok(F.over);
  // Earl: on the step, he is in it, told his way (unset: guard.way)
  const on = at('crib', { day: 3, home: { guard: { on: true, until: 5 } } });
  assert.equal(earlWayOf(cfg, on), cfg.guard.way);
  assert.equal(crewOf(cfg, on).inputs.ally.way, cfg.guard.way);
  const told = step(cfg, on, { do: 'earlWay', way: 'hunt' });
  assert.equal(told.state.earlWay, 'hunt');
  assert.equal(told.state.hour, on.hour);
  assert.equal(crewOf(cfg, told.state).inputs.ally.way, 'hunt');
  // the view: each way with its odds
  const v = view(cfg, told.state);
  assert.deepEqual(v.earl.ways.map(w => w.way), cfg.guard.ways);
  assert.ok(v.earl.ways.every(w => w.win > 0 && w.win <= 100));
  assert.ok(view(cfg, at('crib')).choices.every(c => c.choice.do !== 'earlWay'), 'only while he is on');
  // a night he goes down: off the next day, back the day after, stretch kept
  let down = null;
  for (let day = 2; day < 120 && !down; day++) {
    const x = banked(at('crib', { day, hour: 21, energy: 2, earlWay: 'front', home: { marks: marks(9, day), raid: crewDue(day), guard: { on: true, until: day + 2 } } }), 300);
    const r = step(cfg, x, { do: 'sleep' });
    const e = r.events.find(q => q.type === 'raid');
    if (e.duel?.earl?.down) down = { x, r, e };
  }
  assert.ok(down);
  assert.equal(down.e.guard.hurtDays, cfg.guard.doorHurtDays);
  assert.equal(down.r.state.home.guard.until, down.x.home.guard.until);
  assert.equal(guardOf(cfg, down.r.state).on, false);
  assert.equal(guardOf(cfg, { ...down.r.state, day: down.r.state.day + 1 }).on, true);
});

test('the crew is a step up: rested and alone, about 50 / 70 / 80 with bare hands, the door bar, the box cutter (mark S4, a sample)', () => {
  const big = withRunConfig({ crew: { ...C, sample: 1200 } });
  const s0 = at('crib', { owned: { bed: true } });
  const e = cfg.energy.bed;
  const near = (got, want) => assert.ok(Math.abs(got - want) <= 6, `${got} against ${want}`);
  near(crewChance(big, s0, { arm: 'hands', bar: 0, energy: e, earl: false }).pct, 50);
  near(crewChance(big, s0, { arm: 'hands', bar: cfg.things.doorbar.defends.bar, energy: e, earl: false }).pct, 70);
  near(crewChance(big, { ...s0, owned: { ...s0.owned, cutter: true } }, { arm: 'cutter', bar: 0, energy: e, earl: false }).pct, 80);
  const o = crewOdds(cfg, s0);
  assert.ok(o.withBar > o.pct);
});

test('each piece has one job: no piece does a job against both a sneak and a crew by the same key, and every piece is sold somewhere by someone', () => {
  for (const k of SLICE) {
    const t = cfg.things[k];
    assert.ok(t.defends && t.against?.length && t.job && t.at && t.keeper && t.spot, k);
    const keeper = cfg.places[t.at].people.find(p => p.id === t.keeper);
    assert.ok(keeper, `${k}: its keeper is of ${t.at}`);
  }
  // sold where they are: the new four after every older move
  const park = view(cfg, carrying(at('park'), 200));
  const keys = park.choices.map(c => c.choice.do === 'get' ? c.choice.item : null);
  assert.ok(keys.indexOf('dog') > keys.indexOf('deadbolt'));
  const r = step(cfg, carrying(at('docks'), 60), { do: 'get', item: 'doorbar' });
  assert.ok(r.state.things.doorbar);
  assert.equal(r.events[0].keeper.name, 'Mr. Haines');
});

test('the Sixes: a sale on their ground once a day +1, a grab +2; Dutch\'s word at 3, once a climb; nothing for the stall or anywhere else', () => {
  const s = { ...carrying(at('market', { day: 2, hour: 14 }), 10), goods: { discs: 3 }, sixes: sixes(2, 2) };
  let x = null;
  for (let hour = 13; hour < 30 && !x; hour++) if (deal(CALM, { ...s, hour }).some(j => j.id === 'crowd')) x = { ...s, hour };
  const r = step(CALM, x, { do: 'job', id: 'crowd' });
  const job = r.events.find(e => e.type === 'job');
  assert.equal(job.sixes.n, X.raise.sell);
  assert.equal(sixesOf(cfg, r.state).value, 3);
  const w = r.events.find(e => e.type === 'sixes' && e.what === 'word');
  assert.ok(w && w.who.name === 'Dutch');
  assert.ok(ACTIONS.includes(w.scene.action));
  // a second sale that day adds nothing, and she has said her word
  let y = null;
  for (let hour = r.state.hour; hour < r.state.hour + 30 && !y; hour++) if (deal(CALM, { ...r.state, hour, people: {} }).some(j => j.id === 'crowd')) y = { ...r.state, hour, people: {} };
  if (y) {
    const r2 = step(CALM, y, { do: 'job', id: 'crowd' });
    assert.equal(sixesOf(cfg, r2.state).value, 3);
    assert.ok(!r2.events.some(e => e.type === 'sixes' && e.what === 'word'));
  }
  // the stall: nothing; the trailer park: nothing
  const stall = step(CALM, at('market', { day: 2, hour: 14 }), { do: 'job', id: 'stall' });
  assert.equal(sixesOf(cfg, stall.state).value, 0);
  const quiet = playSeason(cfg, { seed: 4, policy: POLICIES.stall, days: 8 });
  assert.equal(sixesOf(cfg, quiet.state).value, 0);
});

test('the tax: at 5, leaving with money made there on a day you sold or grabbed, Dutch is waiting: pay a fifth (at least $10) or refuse', () => {
  assert.equal(taxOf(cfg, 30), X.taxMin);
  assert.equal(taxOf(cfg, 200), 40);
  const day = 5;
  const s = { ...carrying(at('market', { day, hour: 18 }), 80), sixes: sixes(5, day, { did: day, made: 60, madeDay: day }) };
  const stop = step(cfg, s, { do: 'subway', to: 'park', hop: false });
  assert.equal(stop.state.place, 'market', 'you are still there');
  assert.equal(stop.state.sixes.tax.wants, 12);
  const v = view(cfg, stop.state);
  assert.ok(v.choices.filter(c => c.available).every(c => c.choice.do === 'tax'), 'nothing else until it is answered');
  assert.equal(v.sixes.tax.wants, 12);
  const paid = step(cfg, stop.state, { do: 'tax', pay: true });
  assert.equal(paid.state.carried, 80 - 12);
  assert.equal(paid.state.books.sixes, 12);
  assert.ok(checkRunBooks(paid.state).ok);
  assert.equal(sixesOf(cfg, paid.state).value, 5 - X.pay);
  // and then the way home is open, no second stop that day
  const home = step(cfg, paid.state, { do: 'subway', to: 'park', hop: false });
  assert.equal(home.state.place, 'park');
  const no = step(cfg, stop.state, { do: 'tax', pay: false });
  assert.equal(sixesOf(cfg, no.state).value, 5 + X.raise.refuse);
  assert.equal(no.state.carried, 80);
  // no stop with nothing done there today, or under 5
  assert.equal(step(cfg, { ...s, sixes: sixes(5, day, { did: day - 1, made: 60, madeDay: day }) }, { do: 'subway', to: 'park', hop: false }).state.place, 'park');
  assert.equal(step(cfg, { ...s, sixes: sixes(4, day, { did: day, made: 60, madeDay: day }) }, { do: 'subway', to: 'park', hop: false }).state.place, 'park');
});

test('at 7, warned the morning before; the day after, two of them by the steps: won, keep it all, they fear you a week, +2; lost, the meter to 6; held at 8', () => {
  const night = step(cfg, at('crib', { day: 6, hour: 21, sixes: sixes(7, 6, { did: 6 }) }), { do: 'sleep' });
  const warned = night.events.find(e => e.type === 'sixes' && e.what === 'jumpWarned');
  assert.ok(warned);
  assert.equal(night.state.sixes.jump.day, night.state.day + 1);
  let won = null;
  let lost = null;
  for (let k = 1; k < 60 && !(won && lost); k++) {
    const d = 7 + k;
    const s = carrying({ ...at('market', { day: d, hour: 17, energy: 6 }), sixes: { ...sixes(7, d, { did: d - 1 }), jump: { day: d, warned: d - 1 } } }, 50);
    const r = step(cfg, s, { do: 'subway', to: 'park', hop: false });
    const e = r.events.find(x => x.type === 'jumped' && x.sixes);
    assert.ok(e, 'they were waiting');
    assert.equal(r.state.sixes.jump, null);
    if (e.duel.result === 'won' && e.outcome === 'fail' && !won) won = r;
    if (e.duel.result !== 'won' && !lost) lost = r;
  }
  assert.ok(won && lost);
  assert.equal(won.state.carried, 50);
  assert.equal(sixesOf(cfg, won.state).value, Math.min(X.cap, 7 + X.raise.beat));
  assert.ok(X.jumpers.every(id => won.state.marks[id]?.kind === 'seenOff'));
  assert.equal(sixesOf(cfg, lost.state).value, X.afterJump);
  // while they fear you, nobody waits for you: no warning at 8
  const after = step(cfg, { ...won.state, place: 'crib', hour: 22, banked: won.state.banked + won.state.carried, carried: 0 }, { do: 'sleep' });
  assert.ok(!after.events.some(e => e.type === 'sixes' && e.what === 'jumpWarned'));
  // the cap: nothing raises it past 8
  const top = { ...carrying(at('market', { day: 9, hour: 18 }), 80), sixes: sixes(8, 9, { did: 9, made: 60, madeDay: 9 }) };
  const t = step(cfg, step(cfg, top, { do: 'subway', to: 'park', hop: false }).state, { do: 'tax', pay: false });
  assert.equal(sixesOf(cfg, t.state).value, X.cap);
});

test('a day with nothing done on their ground eases them a step the next morning', () => {
  const s = at('crib', { day: 6, hour: 21, sixes: sixes(4, 6, { did: 4 }) });
  const r = step(cfg, s, { do: 'sleep' });
  assert.equal(sixesOf(cfg, r.state).value, 4 - X.quietFade);
  const busy = step(cfg, at('crib', { day: 6, hour: 21, sixes: sixes(4, 6, { did: 6 }) }), { do: 'sleep' });
  assert.equal(sixesOf(cfg, busy.state).value, 4);
});

test('saves: version 11 (12 since raid-1); a version-10 save loads as nobody known to the Sixes, Earl told nothing, and plays on', () => {
  assert.equal(RUN_STATE_VERSION, 12);
  const s = { ...at('market', { day: 2 }), v: 10 };
  delete s.sixes;
  delete s.earlWay;
  delete s.books.dog;
  delete s.books.sixes;
  const r = loadRun(JSON.stringify({ kind: 'the-run', v: 10, state: s }));
  assert.ok(r.ok, r.text);
  assert.equal(r.state.v, RUN_STATE_VERSION);
  assert.equal(sixesOf(cfg, r.state).value, 0);
  assert.equal(r.state.earlWay, null);
  assert.ok(step(cfg, r.state, view(cfg, r.state).options[0].choice).state);
  // one of this version keeps all of it
  const mine = { ...at('crib'), earlWay: 'block', sixes: sixes(4, 3) };
  const back = loadRun(saveRun(mine));
  assert.ok(back.ok, back.text);
  assert.equal(back.state.earlWay, 'block');
  assert.equal(sixesOf(cfg, back.state).value, 4);
});

test('the slice\'s scripted players: the one who lays low tells Earl and answers warnings; the tax payer pays and the refuser refuses', () => {
  const low = playSeason(cfg, { seed: 2, policy: POLICIES.layLow(120), kit: { bed: true, ...owns(SLICE) }, days: 10 });
  assert.ok(checkRunBooks(low.state).ok);
  const pay = playSeason(cfg, { seed: 5, policy: POLICIES.taxPayer(120), days: 10 });
  const no = playSeason(cfg, { seed: 5, policy: POLICIES.taxRefuser(120), days: 10 });
  assert.equal(no.state.books.sixes, 0);
  assert.ok(pay.tally.taxRefused === 0 || pay.state.books.sixes > 0);
  // the same seed, the same season
  assert.deepEqual(playSeason(cfg, { seed: 5, policy: POLICIES.taxPayer(120), days: 10 }).state, pay.state);
});

test('second pass: the Sixes at rest (a trial\'s switch) hold the meter at 0 and do nothing; the split player works two places by turns', () => {
  const rest = withRunConfig({ sixes: { rest: true } });
  const on = playSeason(cfg, { seed: 7, policy: POLICIES.taxRefuser(120), days: 8 });
  const off = playSeason(rest, { seed: 7, policy: POLICIES.taxRefuser(120), days: 8 });
  assert.ok(sixesOf(cfg, on.state).value > 0, 'with them on, the market player meets them');
  assert.equal(sixesOf(rest, off.state).value, 0);
  assert.equal(off.state.books.sixes, 0);
  assert.equal(off.tally.sixesJumps, 0);
  // (the game's own config never rests them)
  assert.ok(!cfg.sixes.rest);
  // by turns: the market on odd days, the docks on even ones
  const sp = playSeason(cfg, { seed: 3, policy: POLICIES.split(120, 'docks'), days: 4 });
  assert.ok(checkRunBooks(sp.state).ok);
  const places = new Set();
  let s = newRun({ seed: 3, cfg });
  for (let i = 0; i < 400 && s.day <= 4; i++) {
    if (['market', 'docks'].includes(s.place)) places.add(`${s.day % 2}:${s.place}`);
    s = step(cfg, s, decide(cfg, s, POLICIES.split(120, 'docks'))).state;
  }
  assert.ok([...places].every(p => p === '1:market' || p === '0:docks'), [...places].join());
});
