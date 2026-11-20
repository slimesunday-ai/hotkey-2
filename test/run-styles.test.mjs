// THE FIGHT'S NEW PARTS, IN THE RUN (styles-1, RUN.md "Fights in the run: styles and getting jumped"): everybody who can
// fight you one-on-one has a style (src/fight/data.mjs RIVALS), on their card before you choose; three punch styles,
// each taught at one place, learned once for money and kept; one standing choice of what you fight with; getting jumped
// a fight you watch, two at once, ending as the dice did; a visit from elsewhere is somebody sent; after a loss, one
// line of what would have helped; and a scripted player who uses all of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RUN_CONFIG, withRunConfig, newRun, view, step, deal, checkRunBooks, saveRun, loadRun, RUN_STATE_VERSION } from '../src/run/index.mjs';
import { duelOf, duelChance, styleOf, armOf, armsOf, jumpOf, jumpChances, jumpContest, jumpBandOf, sentFor, fightAdvice, toughnessOf, danger } from '../src/run/rules.mjs';
import { runDuel } from '../src/fight/duel.mjs';
import { RIVALS, rivalFoe } from '../src/fight/data.mjs';
import { POLICIES, playSeason } from '../src/run/policies.mjs';

const cfg = RUN_CONFIG;
// nobody jumps you and the police never stop you: an hour's own result, with nothing after it
const CALM = withRunConfig({ jump: { basePct: 0, perHourPct: 0, perStepPct: 0 }, police: { perHeat: 0 } });
const person = id => Object.values(cfg.places).flatMap(x => x.people ?? []).find(x => x.id === id);
const who = id => ({ id, name: person(id).name, role: person(id).role });
function at(place, extra = {}, seed = 1, c = cfg) {
  const s = newRun({ seed, cfg: c });
  return { ...s, place, energy: 6, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) }, home: { ...s.home, ...(extra.home ?? {}) } };
}
const carrying = (s, n) => ({ ...s, carried: s.carried + n, books: { ...s.books, earned: s.books.earned + n } });
function dealtAt(c, place, id, extra = {}, to = null, seed = 1) {
  for (let hour = 12; hour < 400; hour++) {
    const s = at(place, { ...extra, hour }, seed, c);
    if (deal(c, s).some(j => j.id === id && (!to || j.who?.id === to))) return s;
  }
  throw new Error(`${id} never dealt at ${place}`);
}

test('styles: everybody who can fight you one-on-one has a style, Benny the plain brawler; the fight is built through rivalFoe', () => {
  const fighters = Object.values(cfg.places).flatMap(p => {
    const roles = new Set(Object.values(p.jobs ?? {}).filter(j => j.fight === 'fail').map(j => j.role));
    return (p.people ?? []).filter(x => roles.has(x.role) || x.regular);
  });
  assert.ok(fighters.length >= 6);
  for (const p of fighters) assert.ok(RIVALS[p.style], `${p.name} has no style`);
  assert.equal(styleOf(cfg, who('npc:debtor')), 'brawler');
  // (bigman-1: Big Lou the docks' big man, Nadia Petrakis a plain brawler)
  assert.equal(styleOf(cfg, who('npc:driver:docks')), 'bigman');
  assert.equal(styleOf(cfg, who('npc:driver:docks:2')), 'brawler');
  assert.equal(styleOf(cfg, { id: null, name: 'nobody' }), 'brawler');
  const d = duelOf(cfg, at('docks'), who('npc:driver:docks'));
  assert.deepEqual(d.inputs.foe, rivalFoe('bigman', { id: 'them', name: 'Big Lou', hp: toughnessOf(cfg, who('npc:driver:docks')) }));
  assert.equal(d.them.says, RIVALS.bigman.says);
  assert.deepEqual(d.them.why, [RIVALS.bigman.says, d.them.tough]);
  // the plain brawler is the run's opponent as he was: the same fight, tick for tick
  const old = { ...d.inputs, foe: { id: 'them', name: 'x', weapon: 'fists', hp: 55, speed: 3.2, hits: 2.0 } };
  const now = { ...d.inputs, foe: rivalFoe('brawler', { id: 'them', name: 'x', hp: 55 }) };
  for (let seed = 1; seed <= 40; seed++) {
    const [a, b] = [runDuel(old, seed), runDuel(now, seed)];
    assert.deepEqual([a.over, a.events.length], [b.over, b.events.length]);
  }
});

test('styles: the card says their style before you choose, and its odds are the sample of that very fight', () => {
  const s = dealtAt(CALM, 'docks', 'lift', {}, 'npc:driver:docks');
  const o = view(CALM, s).options.find(x => x.id === 'lift');
  assert.equal(o.who.id, 'npc:driver:docks');
  assert.equal(o.fight.them.style, 'bigman');
  assert.match(o.fight.them.text, /^big, slow, hits like a truck; /);
  assert.equal(o.fight.pct, duelChance(CALM, s, o.who).pct);
  // each target has its own: Nadia Petrakis is a plain brawler
  const nadia = o.targets.find(t => t.id === 'npc:driver:docks:2');
  if (nadia) assert.equal(nadia.fight.them.style, 'brawler');
});

test('styles: a punch style is taught at one place, by one person, learned once for money and kept; no hour', () => {
  const places = Object.values(cfg.styles).map(S => S.at);
  assert.equal(new Set(places).size, places.length, 'each at a place of its own');
  for (const [st, S] of Object.entries(cfg.styles)) {
    assert.ok(person(S.keeper), `${st}: taught by somebody of the run`);
    assert.ok(cfg.places[S.at].people.some(p => p.id === S.keeper), `${st}: who teaches it is of that place`);
  }
  // quick hands at the market, from Pockets
  const s = carrying(at('market', { hour: 14 }, 1, CALM), 80);
  const v = view(CALM, s);
  const learn = v.choices.find(c => c.choice.do === 'learn');
  assert.equal(learn.choice.style, 'jab');
  assert.ok(learn.available);
  assert.equal(learn.keeperName, 'Pockets');
  assert.ok(!view(CALM, carrying(at('market'), 10)).choices.find(c => c.choice.do === 'learn').available, 'short of the price');
  assert.ok(!view(CALM, carrying(at('docks'), 200)).choices.some(c => c.choice.do === 'learn' && c.choice.style !== 'throw'), 'not taught elsewhere');
  const r = step(CALM, s, learn.choice);
  assert.equal(r.state.hour, s.hour);
  assert.ok(r.state.styles.jab);
  assert.equal(r.state.carried, s.carried - cfg.styles.jab.price);
  assert.equal(r.state.books.lessons, cfg.styles.jab.price);
  assert.ok(checkRunBooks(r.state).ok);
  assert.equal(r.events[0].type, 'lesson');
  assert.equal(r.events[0].keeper.name, 'Pockets');
  assert.equal(view(CALM, r.state).choices.find(c => c.choice.do === 'learn').why, 'you know it');
  // the Library's entry: what it does, where it is taught, the price
  const lib = view(CALM, r.state).fight.styles;
  assert.deepEqual(lib.map(x => x.style), ['jab', 'haymaker', 'throw']);
  assert.ok(lib.find(x => x.style === 'jab').known);
  assert.match(lib.find(x => x.style === 'throw').text, /Mr\. Haines teaches it on the docks, \$\d+/);
  assert.match(lib.find(x => x.style === 'haymaker').text, /Cousin Earl teaches it in the trailer park/);
});

test('styles: what you fight with is one standing choice among what you own; every card\'s odds use it; no hour', () => {
  const s0 = dealtAt(CALM, 'docks', 'lift', { owned: { cutter: true }, styles: { jab: true, throw: true } }, 'npc:driver:docks');
  assert.deepEqual(armsOf(CALM, s0), ['hands', 'jab', 'throw', 'cutter']);
  assert.equal(armOf(CALM, s0), 'cutter', 'unset: the box cutter you own');
  const v0 = view(CALM, s0);
  const o0 = v0.options.find(x => x.id === 'lift');
  assert.equal(o0.fight.you.arm, 'cutter');
  assert.deepEqual(Object.keys(o0.fight.byArm), ['hands', 'jab', 'throw', 'cutter']);
  const set = v0.choices.find(c => c.choice.do === 'fightWith' && c.choice.with === 'jab');
  assert.equal(set.kind, 'set');
  const r = step(CALM, s0, set.choice);
  assert.equal(r.state.hour, s0.hour);
  assert.equal(r.state.fightWith, 'jab');
  assert.equal(r.events[0].type, 'fightWith');
  const o1 = view(CALM, r.state).options.find(x => x.id === 'lift');
  assert.equal(o1.fight.you.arm, 'jab');
  assert.equal(o1.fight.pct, o0.fight.byArm.jab);
  // (bigman-1: Big Lou is a big man: the throw is the answer, quick hands too light)
  assert.ok(o1.fight.byArm.throw > o1.fight.byArm.hands + 15, 'against a big man, the throw is the answer');
  assert.ok(o1.fight.byArm.jab < o1.fight.byArm.hands + 5, 'quick hands are too light for a big man');
  // and the fight itself is fought with it
  const failed = step(CALM, { ...r.state, rig: { chances: [99] } }, { do: 'job', id: 'lift' });
  assert.equal(failed.events.find(e => e.type === 'job').duel.inputs.you.weapon, 'jab');
  // a choice no longer yours falls back: the box cutter if you own it, else bare hands
  assert.equal(armOf(CALM, { ...s0, fightWith: 'haymaker' }), 'cutter');
  assert.equal(armOf(CALM, { ...s0, owned: { cutter: false }, fightWith: 'cutter' }), 'hands');
  // with nothing but bare hands there is no choice to make
  assert.ok(!view(CALM, at('park')).choices.some(c => c.choice.do === 'fightWith'));
});

test('styles: getting jumped is a fight you watch, two at once: the event carries it, and it is the same fight headless', () => {
  let seen = 0;
  for (let seed = 1; seed <= 200 && seen < 12; seed++) {
    const s = { ...carrying(at('market', { hoursThere: 3 }, seed), 80), rig: { chances: [0] } };
    const v = view(cfg, s);
    const r = step(cfg, s, v.options[0].choice);
    const e = r.events.find(x => x.type === 'jumped');
    if (!e) continue;
    seen += 1;
    assert.ok(e.duel?.jumped);
    assert.equal(e.duel.inputs.foes.length, 2);
    assert.deepEqual(e.duel.inputs.foes.map(f => f.kind), ['heavy', 'runner']);
    const F = runDuel(e.duel.inputs, e.duel.seed);
    assert.equal(F.over.result, e.duel.result);
    assert.equal(jumpBandOf(cfg, F), e.outcome);
    assert.equal(e.duel.chance.bad, v.danger.thisHour.jump.bands.clean);
    if (e.outcome === 'clean') assert.equal(r.state.place, 'clinic');
    else assert.equal(r.state.place, 'market');
    const took = e.outcome === 'clean' ? 'clean' : e.outcome === 'messy' ? 'messy' : null;
    assert.equal(e.taken, took ? Math.round((s.carried + (r.events[0].pay ?? 0)) * cfg.jump.takePct[took] / 100) : 0);
  }
  assert.ok(seen >= 12);
});

test('styles: jumped, the share of bad ones and scuffles is within 3 points of the dice, each tier and kit, fresh and tired', () => {
  const tiers = Object.entries(cfg.tiers).filter(([, t]) => t.jump);
  const placeOfTier = t => Object.keys(cfg.places).find(p => cfg.places[p].tier === t) ?? Object.keys(cfg.stops).find(p => cfg.stops[p].tier === t);
  for (const [t] of tiers) {
    for (const cutter of [false, true]) {
      for (const tired of [false, true]) {
        const pl = placeOfTier(t);
        const s = at(pl, { energy: tired ? 2 : 5, owned: { cutter } });
        const dice = jumpContest(cfg, s, pl).bands;
        const b = jumpChances(cfg, s, pl);
        assert.ok(Math.abs(b.clean - dice.clean) <= 3 && Math.abs(b.messy - dice.messy) <= 3, `${t} ${cutter ? 'cutter' : 'hands'} ${tired ? 'tired' : 'fresh'}: ${b.clean}/${b.messy} against the dice's ${dice.clean}/${dice.messy}`);
      }
    }
  }
  // the bar's risk line is that sample's
  const s = carrying(at('market', { hoursThere: 2 }), 60);
  const d = danger(cfg, s);
  assert.equal(d.jump.bad, Math.round(d.jump.chance * d.jump.bands.clean / 10) / 10);
  assert.match(d.jump.fight.text, /you see them off about \d+ in 10/);
  // sleeping rough is still the dice (robbed asleep is no fight)
  const dice = withRunConfig({ jumped: { fight: false } });
  assert.deepEqual(danger(dice, s).jump.bands, jumpContest(cfg, s).bands);
});

test('styles: a visit from elsewhere is somebody sent; your own street comes itself; the same numbers', () => {
  const okafor = who('npc:stallholder:2');
  const bao = who('npc:shop:market');
  const benny = who('npc:debtor');
  const s = at('crib', { day: 9 });
  assert.equal(sentFor(cfg, s, benny), null);
  const sent = sentFor(cfg, s, okafor);
  assert.ok(RIVALS[sent.style]);
  assert.equal(sent.name, 'somebody Mr. Okafor sent');
  assert.deepEqual(sentFor(cfg, s, okafor), sent, 'the same tough every time');
  assert.ok(sentFor(cfg, s, bao), 'a shopkeeper sends somebody');
  // a robbed stallholder comes due: it is somebody sent at your door
  const marks = { [okafor.id]: { kind: 'robbed', day: 1, place: 'market', who: okafor } };
  const night = step(cfg, { ...at('crib', { day: 7, hour: 20, marks }) }, { do: 'sleep' });
  const door = night.events.find(e => e.type === 'door');
  assert.ok(door?.sent, JSON.stringify(night.events.map(e => e.type)));
  assert.match(door.text, /Mr\. Okafor sent somebody round for another go/);
  const v = view(cfg, night.state);
  const fight = v.choices.find(c => c.choice.do === 'refuse');
  assert.equal(fight.label, 'Fight him');
  assert.equal(fight.fight.them.style, sent.style);
  assert.equal(fight.fight.them.hp, toughnessOf(cfg, okafor) + cfg.memory.due.tougher);
  assert.match(v.door.text, /sent somebody round/);
  const pay = v.choices.find(c => c.choice.do === 'give');
  assert.equal(pay.amount, cfg.memory.due.price);
  const fought = step(cfg, night.state, fight.choice);
  const e = fought.events.find(x => x.type === 'fight');
  assert.equal(e.duel.inputs.foe.reel, RIVALS[sent.style].reel);
  assert.equal(e.duel.them.name, 'somebody Mr. Okafor sent');
  assert.equal(e.mark.who.id, okafor.id, 'the mark is on who sent him');
});

test('styles: after a loss, one line of what would have helped, from the simulator, only from what exists in the run', () => {
  // a wallet gone wrong at the bus-stop woman (a quick one), bare-handed: quick hands win it, and it says where they are
  // taught (bigman-1: Big Lou, the quick one this was first told on, is a big man now: below)
  const lostTo = (place, job, to) => {
    for (let seed = 1; seed < 200; seed++) {
      const s = { ...dealtAt(CALM, place, job, {}, to, seed), rig: { chances: [99] } };
      const e = step(CALM, s, { do: 'job', id: job }).events.find(x => x.type === 'job');
      if (e.duel?.result === 'lost') return { s, e };
    }
    return null;
  };
  const lost = lostTo('park', 'wallet', 'npc:mark:projects:2');
  assert.ok(lost);
  const a = fightAdvice(CALM, lost.s, lost.e.duel);
  assert.equal(a.key, 'jab', a.line);
  assert.ok(a.pct >= a.was + cfg.duel.advice.margin);
  assert.match(a.line, /wins this about \d+ in 10 · /);
  assert.match(a.line, /^Quick hands wins this about \d+ in 10 · Pockets teaches it at the Jay St night market, \$\d+$/);
  assert.doesNotMatch(a.line, /gun|six-shot|Doorman|Long-eye/);
  assert.equal(fightAdvice(CALM, lost.s, { ...lost.e.duel, result: 'won' }), null);
  // (bigman-1) the lift gone wrong at Big Lou, bare-handed: a punch style that puts a big man down wins it (the throw,
  // taught on the same pier, or the haymaker: about level at his size, 61 and 54 in the duel table)
  const lou = lostTo('docks', 'lift', 'npc:driver:docks');
  const la = fightAdvice(CALM, lou.s, lou.e.duel);
  assert.ok(['throw', 'haymaker'].includes(la.key), la.line);
  assert.ok(la.pct >= la.was + 30, la.line);
  // tired, bare hands: rested is one of the things tried
  const tired = duelOf(CALM, at('park', { energy: 1 }), who('npc:mark:projects'), 1);
  const r = fightAdvice(CALM, at('park', { energy: 1 }), { result: 'lost', inputs: tired.inputs, you: tired.you });
  assert.ok(r.line.length > 10);
  // a jump lost: the advice is about the jump
  const j = jumpOf(cfg, at('market', { energy: 2 }), 'market');
  const ja = fightAdvice(cfg, at('market', { energy: 2 }), { jumped: true, result: 'lost', inputs: j.inputs, you: j.you });
  assert.match(ja.line, /sees? them off|Nothing you can get/);
});

test('styles: a version-9 save loads: no style learned, what you fight with unset, and plays on', () => {
  assert.equal(RUN_STATE_VERSION, 12); // (sixes-1: read through 10; raid-1: 12, through 11)
  const s = { ...at('market', { day: 2 }), v: 9 };
  delete s.styles;
  delete s.fightWith;
  delete s.books.lessons;
  const r = loadRun(JSON.stringify({ kind: 'the-run', v: 9, state: s }));
  assert.ok(r.ok, r.text);
  assert.equal(r.state.v, RUN_STATE_VERSION);
  assert.deepEqual([r.state.styles, r.state.fightWith], [{}, null]);
  assert.ok(step(cfg, r.state, view(cfg, r.state).options[0].choice).state);
  // and one of this version keeps what was learned and chosen
  const mine = { ...at('crib'), styles: { throw: true }, fightWith: 'throw' };
  const back = loadRun(saveRun(mine));
  assert.ok(back.ok, back.text);
  assert.deepEqual([back.state.styles, back.state.fightWith], [{ throw: true }, 'throw']);
});

test('styles: the scripted player learns a style where it is taught and fights with what the card says wins most', () => {
  let learned = 0;
  let sets = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const r = playSeason(cfg, { seed, policy: POLICIES.styled(120), days: 6 });
    learned += Object.keys(r.state.styles).length;
    if (r.state.fightWith) sets += 1;
  }
  assert.ok(learned >= 3, `learned ${learned}`); // (quick hands, at the market)
  assert.ok(sets >= 2, `set ${sets}`);
  // (and the one who learns every style where it is taught: more than one, in some run of ten days)
  const most = Math.max(...[1, 2, 3, 4].map(seed => Object.keys(playSeason(cfg, { seed, policy: POLICIES.styledAll(120), days: 10 }).state.styles).length));
  assert.ok(most >= 2, `at most ${most}`);
});
