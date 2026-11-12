// The 3D stage's pure half (demo/stage/director-plan.js): an hour of the feed turned into a plan the director plays.
// The page half (walkers, clips, the camera) is checked in a browser by demo/tools/stage-run.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSession, witnessed } from '../src/session.mjs';
import { ACTIONS, KINDS } from '../src/stage.mjs';
import { ACTION_CLIPS, NATIVE } from '../src/clips.mjs';
import { planHour, stepPlan, endsOf, routineOf, weightOf, actionsWithoutClips, IN_ORDER, REACTION, GOING, AMBIENT, LASTING, PACE, HOUR_MS } from '../demo/stage/director-plan.js';

const CITY_CLIPS = new Set(JSON.parse(readFileSync(new URL('../data/city-clips.json', import.meta.url), 'utf8')).clips);

/** A whole bot season as feed lines, played the way the page plays it. */
async function season(seed, mode = 'watch', seat = 'dealer') {
  const session = createSession({ seed, mode, seat });
  const lines = [];
  for (let n = 0; session.pending().kind !== 'over' && n < 500; n++) {
    const step = mode === 'play' && session.pending().kind === 'move' ? await session.auto() : await session.step();
    lines.push(...step.lines);
  }
  return { session, hours: lines.filter(l => l.type === 'hour') };
}
const classesOf = session => Object.fromEntries(session.game.state.order.map(id => [id, session.game.state.agents[id].cls]));

test('every action the engine can stage resolves to clips the city has', () => {
  assert.deepEqual(actionsWithoutClips([...ACTIONS]), []);
  for (const action of ACTIONS) {
    const step = stepPlan({ actor: 'a1', action }, 'x');
    assert.ok(['go', 'ambient', 'act'].includes(step.mode), action);
    if (!NATIVE.includes(action)) assert.ok(step.clips.length > 0, `${action} has no clip to play`);
    for (const clip of step.clips) {
      assert.ok(ACTION_CLIPS[action].includes(clip), `${action} plays ${clip}, which its own list does not have`);
      assert.ok(CITY_CLIPS.has(clip), `${clip} is not one of the city's clips`);
    }
  }
});

test('the director\'s own tables only name actions and clips that exist', () => {
  for (const [action, clips] of Object.entries(IN_ORDER)) {
    assert.ok(ACTIONS.includes(action), action);
    for (const clip of clips) assert.ok(ACTION_CLIPS[action].includes(clip), `${action}: ${clip}`);
  }
  for (const [action, clip] of Object.entries(REACTION)) {
    assert.ok(ACTIONS.includes(action), action);
    assert.ok(CITY_CLIPS.has(clip), clip);
  }
  for (const action of [...GOING, ...AMBIENT, ...LASTING, ...Object.keys(PACE)]) assert.ok(ACTIONS.includes(action), action);
  // every way of going has a pace
  for (const action of GOING) assert.ok(PACE[action] > 0, `${action} has no pace`);
});

test('a step picks one clip of several by who plays it, and the same one every time', () => {
  const a = stepPlan({ actor: 'a1', action: 'talk' }, '5/2');
  const b = stepPlan({ actor: 'a1', action: 'talk' }, '5/2');
  assert.deepEqual(a.clips, b.clips);
  assert.equal(a.clips.length, 1);
  const picks = new Set(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'].map(actor => stepPlan({ actor, action: 'talk' }, '5/2').clips[0]));
  assert.ok(picks.size > 1, 'eight people talking all picked the same gesture');
  // a stash is played in order: the board up, then down
  assert.deepEqual(stepPlan({ actor: 'a1', action: 'stash' }).clips, ['floorboard_lift', 'floorboard_close']);
  assert.throws(() => stepPlan({ actor: 'a1', action: 'moonwalk' }), /no clips/);
});

test('an hour becomes scenes in feed order, each no earlier than the one before', async () => {
  const { session, hours } = await season(4);
  assert.equal(hours.length, 60);
  let scenes = 0;
  for (const line of hours) {
    const plan = planHour(line, { classes: classesOf(session) });
    const staged = line.events.filter(e => e.stage?.steps?.length && (e.block || /^held:/.test(e.kind)));
    assert.equal(plan.scenes.length, staged.length, `hour ${line.t}`);
    plan.scenes.forEach((scene, i) => {
      assert.equal(scene.kind, staged[i].kind, `hour ${line.t}: scene ${i} out of feed order`);
      assert.equal(scene.steps.length, staged[i].stage.steps.length);
      assert.ok(scene.block, `hour ${line.t}: ${scene.kind} has no block`);
      if (i) assert.ok(scene.at >= plan.scenes[i - 1].at, `hour ${line.t}: scene ${i} starts before the one ahead of it`);
      assert.ok(scene.at >= 0 && scene.at <= HOUR_MS, `hour ${line.t}: ${scene.kind} starts at ${scene.at}`);
      // the people a scene waits for are exactly the ones its steps move (bystanders film without holding it up)
      for (const id of scene.actors) assert.ok(scene.everyone.includes(id));
    });
    for (const rate of Object.values(plan.rate)) assert.ok(rate >= 1 && rate <= 3);
    // a scene is paced to be over by the end of the hour, within what can still be read (3× at most)
    for (const scene of plan.scenes) assert.ok(scene.rate >= 1 && scene.rate <= 3, `hour ${line.t}: ${scene.kind} at rate ${scene.rate}`);
    scenes += plan.scenes.length;
  }
  assert.ok(scenes > 400, `only ${scenes} scenes in a season`);
});

test('a held hour plays in its room and a move holds nothing up', async () => {
  const { session, hours } = await season(4);
  const plans = hours.map(line => planHour(line, { classes: classesOf(session) }));
  const all = plans.flatMap(p => p.scenes);
  const jail = all.filter(s => s.kind === 'held:jail');
  const clinic = all.filter(s => s.kind === 'held:clinic');
  assert.ok(jail.length && clinic.length, 'the season should hold somebody in both places');
  assert.ok(jail.every(s => s.block === 'jail' && s.passive));
  assert.ok(clinic.every(s => s.block === 'clinic' && s.passive));
  const moves = all.filter(s => s.kind === 'move');
  assert.ok(moves.length > 50 && moves.every(s => s.passive));
  // a passive scene never makes its block hurry, and never counts as "has a scene" for the routine
  const quiet = plans.find(p => p.scenes.every(s => s.passive || !s.actors.includes('a1')) && p.routines.a1);
  if (quiet) assert.equal(quiet.routines.a1.hasScene, false);
});

test('everyone ends the hour where the line says, and held when the season holds them', async () => {
  const session = createSession({ seed: 4, mode: 'watch' });
  let ends = {};
  let byEvents = {};
  let held = 0;
  let missed = 0;
  for (let n = 0; session.pending().kind !== 'over' && n < 500; n++) {
    const { lines } = await session.step();
    for (const line of lines.filter(l => l.type === 'hour')) {
      // the page's way: the season's own state, which stands at the end of this hour, says who is held
      const truth = Object.fromEntries(session.game.state.order.map(id => [id, session.game.state.agents[id].state === 'free' ? null : session.game.state.agents[id].state]));
      ends = endsOf(line, ends, truth);
      byEvents = endsOf(line, byEvents);
      for (const [id, entry] of Object.entries(line.agents)) {
        // (a held agent's line block is the place itself; the plan keeps the block they were taken from)
        if (!truth[id]) assert.equal(ends[id].block, entry.block, `hour ${line.t}: ${id}`);
        else assert.ok(ends[id].block !== 'jail' && ends[id].block !== 'clinic', `hour ${line.t}: ${id} has no street block to come back to`);
        assert.equal(ends[id].held, truth[id], `hour ${line.t}: ${id}`);
        // the line says it too, now: the plan needs nobody's state to know
        assert.equal(byEvents[id].held, truth[id], `hour ${line.t}: ${id}, from the line alone`);
        assert.ok(ends[id].spot, `hour ${line.t}: ${id} has no spot`);
        if (truth[id]) held += 1;
        // without the state the events are all there is, and they lag an hour for a hold no step shows
        if (byEvents[id].held !== truth[id]) missed += 1;
      }
    }
  }
  assert.ok(held > 20, 'the season should hold people for a fair few hours');
  assert.ok(missed < held, `reading holds off the events alone was wrong ${missed} times of ${held}`);
});

test('a sealed event keeps only the actor\'s own steps, and a seat\'s plan holds nothing it did not witness', async () => {
  const { session, hours } = await season(4, 'play', 'dealer');
  const you = session.you;
  let sealed = 0;
  for (const line of hours) {
    const seen = witnessed(line, you);
    const plan = planHour(line, { seen, classes: classesOf(session) });
    assert.ok(plan.scenes.length <= seen.length);
    for (const scene of plan.scenes.filter(s => s.sealed)) {
      sealed += 1;
      const actors = new Set(scene.steps.map(s => s.actor));
      assert.equal(actors.size, 1, `a sealed ${scene.kind} shows ${[...actors].join(' and ')}`);
      assert.ok(scene.steps.every(s => !s.target && !s.say), `a sealed ${scene.kind} names its other party or its words`);
      assert.equal(scene.big, false);
    }
    // where everyone ends is the whole line's, whatever this seat saw
    assert.deepEqual(Object.keys(plan.ends).sort(), Object.keys(line.agents).sort());
    for (const [id, entry] of Object.entries(line.agents)) if (entry.state === 'free') assert.equal(plan.ends[id].block, entry.block);
  }
  assert.ok(sealed > 5, `only ${sealed} sealed scenes reached the player in a season`);
});

test('routines suit the class, the move and the place', () => {
  assert.equal(routineOf('cook', { move: { verb: 'work' }, ok: true }), 'cook');
  assert.equal(routineOf('muscle', { move: { verb: 'work' }, ok: true }), 'guard');
  assert.equal(routineOf('informant', { move: { verb: 'work' }, ok: true }), 'watch');
  assert.equal(routineOf('dealer', { move: { verb: 'work' }, ok: true }), 'pace');
  assert.equal(routineOf('dealer', { move: { verb: 'work' }, ok: false }), 'idle');
  assert.equal(routineOf('dealer', { move: { verb: 'rest' } }), 'rest');
  assert.equal(routineOf('robber', { move: { verb: 'move', to: 'bar' } }), 'lean');
  assert.equal(routineOf('cook', { move: { verb: 'work' } }, 'jail'), 'sit_cell');
  assert.equal(routineOf('cook', { move: { verb: 'rest' } }, 'clinic'), 'lie_hurt');
  // whatever comes out is an action with a clip behind it
  for (const cls of ['smuggler', 'cook', 'dealer', 'gunrunner', 'robber', 'muscle', 'informant']) {
    for (const verb of ['move', 'work', 'attack', 'offer', 'stash', 'rest', 'crew', 'quit']) {
      for (const held of [null, 'jail', 'clinic']) assert.ok(ACTIONS.includes(routineOf(cls, { move: { verb }, ok: true }, held)), `${cls} ${verb}`);
    }
  }
});

test('the plan keeps the ticker\'s clock: a roll holds the floor longest and a quiet hour is short', () => {
  assert.ok(weightOf({ kind: 'rob:clean', big: true, data: { roll: { P: 60 } } }) > weightOf({ kind: 'arrest', big: true, data: {} }));
  assert.ok(weightOf({ kind: 'arrest', big: true }) > weightOf({ kind: 'say' }));
  assert.ok(weightOf({ kind: 'say' }) > weightOf({ kind: 'pickup' }));
  assert.equal(weightOf({ kind: 'move' }), 0);
  for (const kind of Object.keys(KINDS)) assert.ok(weightOf({ kind }) >= 0);
});

test('named NPCs are placed for the hour from the line', async () => {
  const { session, hours } = await season(4);
  const plan = planHour(hours[10], { classes: classesOf(session) });
  const police = Object.entries(plan.npcs).filter(([, n]) => n.role === 'police');
  assert.equal(police.length, 2);
  for (const [, n] of police) assert.ok(hours[10].police.includes(n.block));
  assert.equal(plan.npcs['npc:fence'].spot, 'counter:fence');
  for (const n of Object.values(plan.npcs)) assert.ok(ACTIONS.includes(n.action), n.action);
});
