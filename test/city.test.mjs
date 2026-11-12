import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../src/config.mjs';
import { CITY } from '../src/map.mjs';
import { countGood, netWorth } from '../src/state.mjs';
import { rentOn, cookUnits, cookQuality } from '../src/market.mjs';
import { checkBooks } from '../src/ledger.mjs';
import { hourContext } from '../src/resolve.mjs';
import { drawForecast, startDay } from '../src/npc.mjs';
import { runNight, finalBell, bracketOf } from '../src/night.mjs';
import { KINDS, ACTIONS, rolesOf, buildStage } from '../src/stage.mjs';
import { ACTION_CLIPS, NATIVE } from '../src/clips.mjs';
import { playBotSeason } from '../src/season.mjs';
import { LINES, SITUATIONS } from '../src/lines.mjs';
import { newSeason, play, seat, addGood, viewOf, fund, pinPolice, QUIET } from './helpers.mjs';

const cfg = QUIET;

function scene({ police = null } = {}) {
  const game = newSeason({ seed: 1, police, cfg });
  const { state } = game;
  for (const id of state.order) {
    state.agents[id].goods = { chems: 0, parts: 0, product: {}, guns: {} };
    for (const skill of Object.keys(state.agents[id].skills)) state.agents[id].skills[skill] = 0;
  }
  return { game, state };
}

// ---------------------------------------------------------------------------------------------------------------
// work

test('work means each class’s job, here', () => {
  const { game, state } = scene();
  const smuggler = seat(state, 'smuggler');
  const cook = seat(state, 'cook');
  const dealer = seat(state, 'dealer');
  const gunrunner = seat(state, 'gunrunner');
  const robber = seat(state, 'robber');
  const muscle = seat(state, 'muscle');
  const informant = seat(state, 'informant');

  // not here: a smuggler can't run from the projects, a dealer has no buyers there
  let line = play(game, { [smuggler.id]: { move: { verb: 'work' } }, [dealer.id]: { move: { verb: 'work' } } });
  assert.equal(line.agents[smuggler.id].ok, false);
  assert.equal(line.agents[dealer.id].ok, false);

  smuggler.block = 'docks';
  addGood(cook, 'chems', 3);
  addGood(dealer, 'product', 5, 2);
  dealer.block = 'corner';
  addGood(gunrunner, 'parts', 3);
  muscle.block = 'bar';
  robber.block = 'corner';
  informant.block = 'corner';
  state.rig = { chances: [99, 99, 99] };
  line = play(game, {
    [smuggler.id]: { move: { verb: 'work', option: 'parts' } }, [cook.id]: { move: { verb: 'work' } }, [dealer.id]: { move: { verb: 'work' } },
    [gunrunner.id]: { move: { verb: 'work' } }, [robber.id]: { move: { verb: 'work' } }, [muscle.id]: { move: { verb: 'work' } }, [informant.id]: { move: { verb: 'work' } },
  });
  assert.equal(smuggler.goods.parts, cfg.docks.unitsPerRun);
  assert.equal(countGood(cook, 'product', cookQuality(cfg, 0)), cookUnits(cfg, 0));
  assert.equal(countGood(dealer, 'product'), 5 - cfg.street.unitsPerHour);
  assert.ok(dealer.cash > cfg.start.cash);
  assert.equal(countGood(gunrunner, 'gun', 1), 1);
  assert.equal(robber.cased.block, 'corner');
  assert.equal(muscle.cash, cfg.start.cash + cfg.floors.patrolPay);
  assert.ok(state.tips.some(tip => tip.madeBy === informant.id));
  // the robber who cased sees exactly what the dealer carries
  assert.equal(viewOf(game, robber).here.others.find(o => o.id === dealer.id).cash, robber.cased.seen[dealer.id].cash);
  // every sale was to a named regular, who walked up
  const deal = line.events.find(e => e.kind === 'work:deal');
  assert.equal(deal.lists.buyers.length, cfg.street.unitsPerHour);
  assert.ok(deal.lists.buyers.every(id => state.npcs[id].role === 'buyer'));
  assert.ok(checkBooks(state).ok);
});

test('street buyers pay less with each sale and two dealers on a block both sell at 80%', () => {
  const { game, state } = scene();
  const a = seat(state, 'dealer');
  const b = seat(state, 'dealer', 1);
  addGood(a, 'product', 2, 3);
  a.block = 'uptown';
  play(game, { [a.id]: { move: { verb: 'work' } } });
  const alone = a.cash - cfg.start.cash;
  const full = Math.floor((cfg.street.price.uptown * 120) / 100);
  assert.equal(alone, full + Math.floor((cfg.street.price.uptown * 120 * 930) / 100000));

  const s2 = scene();
  const c = seat(s2.state, 'dealer');
  const d = seat(s2.state, 'dealer', 1);
  for (const x of [c, d]) {
    addGood(x, 'product', 1, 3);
    x.block = 'uptown';
  }
  play(s2.game, { [c.id]: { move: { verb: 'work' } }, [d.id]: { move: { verb: 'work' } } });
  assert.ok(c.cash - cfg.start.cash < full && d.cash - cfg.start.cash < full, 'both at a discount');
});

test('a dealer can claim a block as turf: the other one sells at half there until midnight', () => {
  const { game, state } = scene();
  const a = seat(state, 'dealer');
  const b = seat(state, 'dealer', 1);
  a.block = 'corner';
  b.block = 'corner';
  addGood(b, 'product', 1, 3);
  play(game, { [a.id]: { move: { verb: 'work', option: 'claim' } } });
  assert.equal(state.blocks.corner.turf, a.id);
  play(game, { [b.id]: { move: { verb: 'work' } } });
  assert.equal(b.cash - cfg.start.cash, Math.floor((cfg.street.price.corner * 120 * cfg.street.turfOtherPct) / 10000));
});

// ---------------------------------------------------------------------------------------------------------------
// NPC trouble

test('the forecast is drawn by seed, and one police unit is uptown until 18:00', () => {
  const { state } = newSeason({ seed: 9 });
  const again = drawForecast(CONFIG, CITY, state, 1);
  assert.deepEqual(again, state.forecast);
  assert.ok(state.forecast.police[0].slice(0, CONFIG.police.uptownUntil).every(b => b === 'uptown'));
  assert.ok(state.forecast.police.every(unit => unit.slice(CITY.blocks.park.noPoliceFrom).every(b => b !== 'park')), 'no police in the park after 20:00');
  assert.equal(state.forecast.rival, null, 'the rival crew starts on day 2');
  assert.deepEqual(state.forecast.robbers.blocks, ['park']);
});

test('three stars and the police on your block is an arrest: jail, a fine, product and guns seized', () => {
  const { game, state } = scene({ police: ['corner', 'corner'] });
  const dealer = seat(state, 'dealer');
  dealer.block = 'corner';
  dealer.heat = 4;
  addGood(dealer, 'product', 3, 2);
  addGood(dealer, 'gun', 1, 1);
  const line = play(game, { [dealer.id]: { move: { verb: 'work' } } });
  assert.equal(dealer.state, 'jail');
  assert.equal(dealer.until, 0 + 1 + cfg.arrest.baseHours + 1);
  assert.equal(dealer.cash, cfg.start.cash - (cfg.start.cash * cfg.arrest.finePct) / 100);
  assert.equal(countGood(dealer, 'product') + countGood(dealer, 'gun'), 0);
  assert.equal(dealer.heat, 0);
  assert.match(line.agents[dealer.id].text, /jail/);
  assert.equal(viewOf(game, dealer).menu.length, 0, 'no moves from a cell');
  // resting only cools you off where the police aren't
  const s2 = scene({ police: ['corner', 'corner'] });
  const r = seat(s2.state, 'robber');
  r.heat = 2;
  r.block = 'corner';
  play(s2.game, { [r.id]: { move: { verb: 'rest' } } });
  assert.equal(r.heat, 2);
  r.block = 'bar';
  play(s2.game, { [r.id]: { move: { verb: 'rest' } } });
  assert.equal(r.heat, Math.max(0, 2 - cfg.heat.restDrop));
});

test('NPC robbers come from 20:00 for whoever carries the most on their block; a patrol can scare them off', () => {
  const { game, state } = scene();
  const rich = seat(state, 'dealer');
  const poor = seat(state, 'cook');
  rich.block = 'park';
  poor.block = 'park';
  fund(state, rich, { cash: 300 });
  state.t = cfg.npcRobbers.fromHour;
  state.rig = { rolls: [0] };
  let line = play(game, {});
  assert.equal(rich.cash, 300 - (300 * cfg.npcRobbers.cleanCashPct) / 100 - cfg.clinic.perHour);
  assert.equal(poor.cash, cfg.start.cash);
  assert.ok(line.events.some(e => e.kind === 'npc:robbers:clean' && e.who.robber1 === 'npc:robber1'));
  assert.equal(state.books.out['npc robbers'], (300 * cfg.npcRobbers.cleanCashPct) / 100);

  // a muscle with Intimidate on patrol there
  const s2 = scene();
  const target = seat(s2.state, 'dealer');
  const muscle = seat(s2.state, 'muscle');
  target.block = 'park';
  muscle.block = 'park';
  muscle.skills.intimidate = 5;
  fund(s2.state, target, { cash: 300 });
  s2.state.t = cfg.npcRobbers.fromHour;
  let scared = false;
  for (let i = 0; i < 4 && !scared; i++) {
    line = play(s2.game, { [muscle.id]: { move: { verb: 'work' } } });
    scared = line.events.some(e => e.kind === 'npc:robbers:scared');
    if (target.state !== 'free') break;
  }
  assert.ok(scared || target.cash < 300, 'they came');
});

test('the rival crew pushes onto a block: pay the toll, or fight; a turf holder fights for the corner', () => {
  const { game, state } = scene();
  const dealer = seat(state, 'dealer');
  const smuggler = seat(state, 'smuggler');
  const cook = seat(state, 'cook');
  for (const a of [dealer, smuggler, cook]) a.block = 'corner';
  state.blocks.corner.turf = dealer.id;
  state.forecast.rival = { hour: 0, block: 'corner' };
  state.rig = { rolls: [0] }; // the holder loses
  const line = play(game, {});
  assert.equal(smuggler.cash, cfg.start.cash - cfg.rivalCrew.toll);
  assert.equal(cook.cash, cfg.start.cash, 'only dealers and smugglers are leaned on');
  assert.equal(state.blocks.corner.turf, 'rival');
  assert.ok(line.events.some(e => e.kind === 'npc:rival:lose' && e.who.agent === dealer.id));
});

test('the street never goes quiet: after 2 hours with no big beat, trouble is announced and lands next hour', () => {
  const game = newSeason({ seed: 1, police: null });
  const { state } = game;
  const rich = seat(state, 'cook');
  fund(state, rich, { cash: 400 });
  let line;
  let announced = null;
  for (let i = 0; i < 8 && announced === null; i++) {
    line = play(game, {});
    if (line.events.some(e => e.kind === 'forecast:early')) announced = line.t;
  }
  assert.ok(announced !== null && announced <= CONFIG.quietFromHour + CONFIG.quietHours);
  assert.match(viewOf(game, rich).forecast.early, /early/, 'everyone sees it coming');
  line = play(game, {});
  assert.ok(line.events.some(e => e.kind.startsWith('npc:robbers:') && e.who.target === rich.id), 'it comes for the most cash');
});

test('the snitch: pay $20 by saying yes, or he sells the crime to the police that night', () => {
  const { game, state } = scene();
  const robber = seat(state, 'robber');
  const dealer = seat(state, 'dealer');
  state.rig = { rolls: [0] };
  play(game, { [robber.id]: { move: { verb: 'attack', target: dealer.id, how: 'rob' } } });
  const offer = state.offers.find(o => o.terms.kind === 'snitch' && o.to === robber.id);
  assert.ok(offer);
  const heat = robber.heat;
  // ignored: sold at night
  const ctx = hourContext({ cfg, map: game.map, state, t: 11 });
  const night = runNight(ctx, 1);
  assert.equal(night.snitch.length, 1);
  assert.equal(robber.heat, Math.min(cfg.heat.max, heat + cfg.snitch.heat) - cfg.heat.nightDrop);

  const s2 = scene();
  const r2 = seat(s2.state, 'robber');
  const d2 = seat(s2.state, 'dealer');
  s2.state.rig = { rolls: [0] };
  play(s2.game, { [r2.id]: { move: { verb: 'attack', target: d2.id, how: 'rob' } } });
  const o2 = s2.state.offers.find(o => o.terms.kind === 'snitch');
  const cash = r2.cash;
  play(s2.game, { [r2.id]: { accept: [o2.id] } });
  assert.equal(r2.cash, cash - cfg.snitch.price);
  assert.equal(runNight(hourContext({ cfg, map: s2.game.map, state: s2.state, t: 11 }), 1).snitch.length, 0);
});

// ---------------------------------------------------------------------------------------------------------------
// the night

test('the night: rent from the stash then the pocket, eviction when short, heat cools, points, standings', () => {
  const { game, state } = scene();
  const rich = seat(state, 'cook');
  const broke = seat(state, 'robber');
  const hot = seat(state, 'dealer');
  fund(state, rich, { cash: 10, stash: 500 });
  fund(state, broke, { cash: 5, stash: 0 });
  hot.heat = 3;
  rich.xp = 5;
  const ctx = hourContext({ cfg, map: game.map, state, t: 11 });
  const night = runNight(ctx, 1);
  const rent = rentOn(cfg, 1);
  assert.equal(rich.stash, 500 - rent);
  assert.equal(rich.cash, 10);
  assert.equal(broke.evicted, true);
  assert.equal(broke.cash, 5, 'someone who is short pays nothing and sleeps on the street');
  assert.equal(hot.heat, 2);
  assert.equal(rich.points, Math.floor(5 / cfg.xp.perPoint));
  assert.equal(rich.xp, 5 % cfg.xp.perPoint);
  // the bottom three get a point each
  const hungry = night.points.filter(p => p.hungry).map(p => p.id);
  assert.equal(hungry.length, cfg.xp.hungrySeats);
  assert.ok(hungry.includes(broke.id));
  assert.equal(broke.points, cfg.xp.hungryPoints);
  // everyone sees rank and a rough bracket, never the number
  assert.equal(state.standings.rows[0].id, rich.id);
  assert.equal(state.standings.rows[0].bracket, bracketOf(netWorth(state, rich)));
  assert.equal(state.standings.rows[0].worth, undefined);
  assert.equal(viewOf(game, broke).race.rows.length, 10);
  assert.ok(checkBooks(state).ok);
});

test('the final bell splits the crew pot among the members still in', () => {
  const { game, state } = scene();
  const a = seat(state, 'dealer');
  const b = seat(state, 'cook');
  state.crews.k1 = { id: 'k1', name: 'the firm', boss: a.id, members: [a.id, b.id], cut: 10, pot: 101, paidIn: {} };
  a.crew = b.crew = 'k1';
  state.books.start += 101;
  finalBell(hourContext({ cfg, map: game.map, state, t: 59 }));
  assert.equal(b.stash, 50);
  assert.equal(a.stash, 51, 'the odd dollar stays with the chair');
  assert.equal(state.crews.k1.pot, 0);
  assert.ok(checkBooks(state).ok);
});

// ---------------------------------------------------------------------------------------------------------------
// tips and crews

test('tips: a cash tip adds +15 to rob its subject, dies when they stash, and the same tip can be sold twice', () => {
  const { game, state } = scene();
  const informant = seat(state, 'informant');
  const dealer = seat(state, 'dealer');
  const r1 = seat(state, 'robber');
  const r2 = seat(state, 'robber', 1);
  informant.skills.network = 2; // sells by phone with no courier fee
  for (const a of [informant, dealer]) a.block = 'corner';
  fund(state, dealer, { cash: 240 });
  play(game, { [informant.id]: { move: { verb: 'work' } } });
  const tip = state.tips.find(x => x.type === 'cash' && x.subject === dealer.id);
  assert.equal(tip.data.cash, 240);
  assert.equal(tip.expires, state.t - 1 + cfg.tips.cashHours, 'a cash tip is good for 3 hours');
  tip.expires += 3; // room in this test to sell it twice
  play(game, { [informant.id]: { move: { verb: 'offer', to: r1.id, terms: { kind: 'tip', tip: tip.id, price: 30 } } } });
  play(game, { [r1.id]: { accept: [state.offers.find(o => o.to === r1.id).id] }, [informant.id]: { move: { verb: 'offer', to: r2.id, terms: { kind: 'tip', tip: tip.id, price: 30 } } } });
  assert.equal(informant.cash, cfg.start.cash + 30);
  play(game, { [r2.id]: { accept: [state.offers.find(o => o.to === r2.id).id] } });
  assert.deepEqual(tip.soldTo, [r1.id, r2.id]);
  assert.equal(informant.stats.betrayals, 1, 'selling one tip twice is the informant’s risky play');
  // the tip shows the exact cash and adds to the odds
  r1.block = 'corner';
  const view = viewOf(game, r1);
  assert.equal(view.here.others.find(o => o.id === dealer.id).cash, 240);
  assert.ok(view.menu.find(m => m.move.how === 'rob' && m.move.target === dealer.id).why.includes(`a tip +${cfg.contest.tip}`));
  // it dies when the subject stashes
  dealer.block = 'projects';
  play(game, { [dealer.id]: { move: { verb: 'stash', amount: 200 } } });
  assert.equal(state.tips.find(x => x.id === tip.id), undefined);
});

test('the police pay for each crime once, to whoever brings it first', () => {
  const { game, state } = scene();
  const robber = seat(state, 'robber');
  const dealer = seat(state, 'dealer');
  const informant = seat(state, 'informant');
  informant.block = 'projects';
  state.rig = { rolls: [0] };
  play(game, { [robber.id]: { move: { verb: 'attack', target: dealer.id, how: 'rob' } } });
  play(game, { [informant.id]: { move: { verb: 'work' } } });
  const mine = state.tips.find(x => x.type === 'crime' && x.madeBy === informant.id);
  const theirs = state.tips.find(x => x.type === 'crime' && x.madeBy === dealer.id);
  assert.ok(mine && theirs, 'the witness and the victim each hold the crime');
  informant.block = 'precinct';
  dealer.state = 'free';
  dealer.block = 'precinct';
  const heat = robber.heat;
  play(game, { [informant.id]: { move: { verb: 'work', option: mine.id } } });
  assert.equal(informant.cash, cfg.start.cash + cfg.floors.crimeTip);
  assert.equal(robber.heat, Math.min(cfg.heat.max, heat + cfg.snitch.heat));
  const cash = dealer.cash;
  play(game, { [dealer.id]: { move: { verb: 'offer', to: 'police', terms: { kind: 'tip', tip: theirs.id } } } });
  assert.equal(dealer.cash, cash, 'the second one is worth nothing');
});

test('crews: start, invite, join for free, the cut feeds the pot, a member can skim and walk', () => {
  const { game, state } = scene();
  const boss = seat(state, 'muscle');
  const member = seat(state, 'dealer');
  play(game, { [boss.id]: { move: { verb: 'crew', action: 'start', name: 'the firm' } } });
  const crew = Object.values(state.crews)[0];
  play(game, { [boss.id]: { move: { verb: 'crew', action: 'invite', agent: member.id } } });
  play(game, { [member.id]: { accept: [state.offers.find(o => o.terms.kind === 'crew-invite').id] }, [boss.id]: { move: { verb: 'crew', action: 'cut', pct: 20 } } });
  assert.deepEqual(crew.members, [boss.id, member.id]);
  assert.equal(crew.cut, 20);
  // the member's street income pays the cut into the pot
  addGood(member, 'product', 2, 3);
  member.block = 'uptown';
  const before = member.cash;
  play(game, { [member.id]: { move: { verb: 'work' } } });
  assert.ok(crew.pot > 0);
  assert.ok(Math.abs(crew.pot - (member.cash - before) / 4) <= 1, 'a fifth of it');
  // crewmates on the same block back each other up
  boss.block = 'uptown';
  const robber = seat(state, 'robber');
  robber.block = 'uptown';
  assert.ok(viewOf(game, robber).menu.find(m => m.move.how === 'rob' && m.move.target === member.id).why.some(w => /crew −5/.test(w)));
  // the member skims and is out
  const pot = crew.pot;
  const line = play(game, { [member.id]: { move: { verb: 'crew', action: 'skim' } } });
  assert.equal(member.crew, null);
  assert.ok(crew.pot < pot || !state.crews[crew.id]);
  assert.equal(member.stats.betrayals, 1);
  assert.ok(line.events.some(e => e.kind === 'crew:skim' && e.big));
  assert.ok(checkBooks(state).ok);
});

test('a boss can be challenged for the chair', () => {
  const { game, state } = scene();
  const boss = seat(state, 'muscle');
  const member = seat(state, 'robber');
  state.crews.k1 = { id: 'k1', name: 'the firm', boss: boss.id, members: [boss.id, member.id], cut: 10, pot: 0, paidIn: {} };
  boss.crew = member.crew = 'k1';
  state.rig = { rolls: [0] };
  const line = play(game, { [member.id]: { move: { verb: 'crew', action: 'challenge' } } });
  assert.equal(state.crews.k1.boss, member.id);
  assert.ok(line.events.some(e => e.kind === 'crew:coup:win'));
});

// ---------------------------------------------------------------------------------------------------------------
// an action for everything (D61)

test('every kind of event has a scene, every scene uses known actions, and every action maps to clips the city has', () => {
  const clips = new Set(JSON.parse(readFileSync(new URL('../data/city-clips.json', import.meta.url), 'utf8')).clips);
  for (const [kind, def] of Object.entries(KINDS)) {
    if (def.notice) continue;
    assert.ok(Array.isArray(def.steps) && def.steps.length, `${kind} has a scene`);
    const walk = steps => {
      for (const step of steps) {
        if (Array.isArray(step)) assert.ok(ACTIONS.includes(step[1]), `${kind} uses an unknown action: ${step[1]}`);
        else walk(step.steps);
      }
    };
    walk(def.steps);
  }
  for (const action of ACTIONS) {
    const mapped = ACTION_CLIPS[action];
    assert.ok(mapped, `${action} has no clips entry`);
    if (!NATIVE.includes(action)) assert.ok(mapped.length > 0, `${action} needs at least one clip`);
    for (const clip of mapped) assert.ok(clips.has(clip), `${action} names a clip the city doesn't have: ${clip}`);
  }
  // the waiting states the spec names all have scenes
  for (const kind of ['rest', 'stash', 'held:jail', 'held:clinic', 'night:evicted', 'night:sleep', 'idle', 'pickup', 'message', 'say']) assert.ok(KINDS[kind]?.steps, kind);
});

test('nobody ever stands frozen: every agent has a staged beat every hour of a season, and scenes are typed', () => {
  const game = playBotSeason({ seed: 6 });
  const { state } = game;
  const spots = /^(street|pier|desk|cell|bed|counter:(fence|gunshop|shop)|(pad|door):a\d+)$/;
  for (const line of game.feed.filter(l => l.type === 'hour')) {
    const staged = new Set();
    for (const e of line.events) {
      assert.ok(KINDS[e.kind], `unknown kind ${e.kind}`);
      if (KINDS[e.kind].notice) continue;
      assert.ok(e.stage && Array.isArray(e.stage.steps), `${e.kind} has a stage record`);
      assert.match(e.stage.spot, spots, `${e.kind} names a spot the city knows`);
      for (const step of e.stage.steps) {
        assert.ok(state.agents[step.actor] || state.npcs[step.actor], `${e.kind}: actor ${step.actor} is a person`);
        assert.ok(ACTIONS.includes(step.action));
        if (step.target) assert.ok(state.agents[step.target] || state.npcs[step.target], `${e.kind}: target ${step.target} is a person`);
        if (step.spot) assert.match(step.spot, spots);
        staged.add(step.actor);
      }
      // every role the scene needs was given, apart from the ones that are sometimes absent
      const optional = ['officer', 'listener', 'shopkeeper', 'buyer', 'target', 'owner', 'to'];
      for (const role of rolesOf(e.kind).roles) if (!optional.includes(role)) assert.ok(e.who[role], `${e.kind} is missing its ${role}`);
    }
    for (const id of state.order) assert.ok(staged.has(id), `hour ${line.t}: ${id} has no beat`);
    // the NPCs on every block are named people with a spot and an action
    for (const list of Object.values(line.npcs)) for (const npc of list) {
      assert.ok(state.npcs[npc.id], npc.id);
      assert.ok(ACTIONS.includes(npc.action));
    }
  }
});

test('a spoken line names who it is for, and a private message is a text and a phone', () => {
  const { game, state } = scene();
  const a = seat(state, 'cook');
  const b = seat(state, 'dealer');
  const line = play(game, { [a.id]: { say: { text: 'You owe me.', to: b.id }, message: { to: b.id, text: 'Tonight.' }, confessional: 'I mean it.' } });
  const say = line.events.find(e => e.kind === 'say');
  assert.deepEqual(say.stage.steps[0], { actor: a.id, action: 'talk', target: b.id, say: 'You owe me.', to: b.id });
  assert.equal(say.stage.steps[1].action, 'listen');
  const msg = line.events.find(e => e.kind === 'message');
  assert.deepEqual(msg.stage.steps.map(s => s.action), ['text', 'phone']);
  // the other agent hears the line and gets the message next hour; the confessional is for viewers only
  const view = viewOf(game, b);
  assert.deepEqual(view.heard, [{ from: a.id, text: 'You owe me.', to: b.id }]);
  assert.equal(view.messages[0].text, 'Tonight.');
  assert.ok(!JSON.stringify(view).includes('I mean it.'));
  assert.deepEqual(viewOf(game, a).memory.confessionals, ['I mean it.']);
});

test('the view: the cast with where you last saw them, and skills are public on your block', () => {
  const { game, state } = scene();
  const a = seat(state, 'cook');
  const b = seat(state, 'dealer');
  b.skills.hustle = 2;
  play(game, {});
  b.block = 'market';
  play(game, {});
  const view = viewOf(game, a);
  const row = view.cast.find(c => c.id === b.id);
  assert.equal(row.cls, 'dealer');
  assert.deepEqual(row.lastSeen, { block: 'projects', hoursAgo: 2 });
  const here = view.here.others.find(o => o.cls === 'smuggler');
  assert.ok('skills' in here && ['broke', 'some', 'loaded'].includes(here.cash));
});

test('bots have at least 15 lines for every situation', () => {
  for (const situation of SITUATIONS) assert.ok(LINES[situation].length >= 15, situation);
});

test('the night job: the NPC robbers go for the fattest stash, and a guard at the door is in their way', () => {
  const { game, state } = scene();
  const rich = seat(state, 'cook');
  const other = seat(state, 'dealer');
  fund(state, rich, { stash: 600 });
  fund(state, other, { stash: 300 });
  state.rig = { rolls: [0] };
  const night = runNight(hourContext({ cfg, map: game.map, state, t: 11 }), 1);
  assert.equal(night.job.target, rich.id);
  const afterRent = 600 - rentOn(cfg, 1);
  assert.equal(rich.stash, afterRent - Math.floor((afterRent * cfg.nightJob.cleanStashPct) / 100));
  assert.equal(other.stash, 300 - rentOn(cfg, 1), 'only the fattest');
  assert.ok(checkBooks(state).ok);

  // with a muscle on guard as the day ended, the same roll fails
  const s2 = scene();
  const owner = seat(s2.state, 'cook');
  const muscle = seat(s2.state, 'muscle');
  muscle.skills.bodyguard = 5;
  muscle.skills.toughness = 5;
  fund(s2.state, owner, { stash: 600 });
  s2.state.nightGuards = { [owner.id]: [muscle.id] };
  s2.state.rig = { rolls: [30] };
  const guarded = runNight(hourContext({ cfg, map: s2.game.map, state: s2.state, t: 11 }), 1);
  assert.equal(guarded.job.lost, 0);
  assert.equal(owner.stash, 600 - rentOn(cfg, 1));
});

test('the loan shark stakes someone who is broke, once, and takes it back out of what they earn', () => {
  const { game, state } = scene();
  const dealer = seat(state, 'dealer');
  dealer.block = 'market';
  let line = play(game, { [dealer.id]: { move: { verb: 'offer', to: 'fence', terms: { kind: 'stake', amount: 100 } } } });
  assert.equal(line.agents[dealer.id].ok, false, 'not for someone with $100');
  fund(state, dealer, { cash: 10 });
  line = play(game, { [dealer.id]: { move: { verb: 'offer', to: 'fence', terms: { kind: 'stake', amount: 100 } } } });
  assert.equal(dealer.cash, 110);
  assert.equal(dealer.sharkDebt, Math.ceil((100 * cfg.shark.repayPct) / 100));
  assert.equal(netWorth(state, dealer), 110 - dealer.sharkDebt);
  line = play(game, { [dealer.id]: { move: { verb: 'offer', to: 'fence', terms: { kind: 'stake', amount: 50 } } } });
  assert.equal(line.agents[dealer.id].ok, false, 'one stake at a time');
  // income pays it back first
  addGood(dealer, 'product', 1, 3);
  dealer.block = 'uptown';
  const debt = dealer.sharkDebt;
  play(game, { [dealer.id]: { move: { verb: 'work' } } });
  assert.ok(dealer.sharkDebt < debt);
  assert.equal(dealer.cash, 110, 'nothing kept until the shark is paid');
  assert.ok(checkBooks(state).ok);
});
