// THE FIGHT'S MOVES (demo/fight/clips/, anim.js): its own clips in the cast's clip format, how they reach the cast's
// walkers, and the one promise the motion makes the rules: a blow you see lands on the tick the rules apply its damage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFight, step, runFight, PRESETS, TICK, WEAPONS } from '../src/fight/index.mjs';
import { FIGHT_CLIPS, CAST_CLIPS, CONTACT, fightGlsl, installClips } from '../demo/fight/clips/index.js';
import { lookFor, lookOf, gunPose, gunMuzzle, FIRE_D } from '../demo/fight/clips/gun.js';
import { predictBlows, windAt, LOOK, BLOW, GUN_CLIPS } from '../demo/fight/anim.js';
import { longPose, longMuzzle, longHands, HOLD, LONG_GLSL, LONG_FIRE_D } from '../demo/fight/clips/long.js';

test("the fight's clips are in the cast's clip format, and every weapon of the rules has its move", () => {
  for (const c of FIGHT_CLIPS) {
    assert.match(c.name, /^fight_[a-z_]+$/);
    assert.ok(c.dur > 0 && typeof c.glsl === 'string' && c.note.length > 20, c.name);
    // (anim-1: a body posed by hand from the page, demo/fight/puppet/clip.js: it stands on its own feet, which the
    // page plants, so it is NOT a walking overlay; it loops and never ends by itself)
    if (c.puppet) {
      assert.equal(c.loop, true, `${c.name} never ends by itself`);
      assert.ok(!c.moving, `${c.name} stands on feet the page plants`);
      assert.match(c.glsl, /fBody\(P, \d+\)/);
      continue;
    }
    // (walking overlays: the legs are the walk's, so one who fights while moving keeps walking)
    assert.equal(c.moving, true, `${c.name} is a walking overlay`);
    assert.equal(c.speed, 0);
  }
  for (const [id, W] of Object.entries(WEAPONS)) if (W.kind === 'melee') assert.ok(FIGHT_CLIPS.some(c => c.name === BLOW[id]), `${id} has a blow`);
  assert.ok(CAST_CLIPS.includes('fall_back') && CAST_CLIPS.includes('death_collapse'), 'the falls are the city\'s own');
  // (each blow lands inside its clip, after a wind-up)
  for (const [name, t] of Object.entries(CONTACT)) {
    const c = FIGHT_CLIPS.find(q => q.name === name);
    assert.ok(t > 0.08 && t < c.dur / 2, `${name}: contact ${t} s of ${c.dur}`);
  }
});

test('the clips reach the walkers: the cast\'s registry gets them after its own, the shader their functions and cases', () => {
  const cast = [{ name: 'walk_a', dur: 1 }, { name: 'walk_b', dur: 2 }].map((c, id) => ({ ...c, id }));
  const CLIPS = { CLIPS: cast.slice(), CLIP: Object.fromEntries(cast.map(c => [c.name, c])) };
  const shader = 'void clipPose(inout Pose P) {\n  int c = v - 32; if (c < 0 || c >= 2 || W < .001) return;\n  switch (c) {\n  case 0: clip_walk_a(Q, t, u, w); break;\n  }\n}';
  let compiled = null;
  const mat = { onBeforeCompile: (sh) => { sh.vertexShader = shader; }, customProgramCacheKey: () => 'ped', userData: {}, needsUpdate: false };
  const names = installClips({ CLIPS, mats: [mat] });
  assert.deepEqual(names, FIGHT_CLIPS.map(c => c.name));
  assert.equal(CLIPS.CLIP.fight_gun.id, 2, 'ids after the cast\'s own');
  assert.equal(CLIPS.CLIPS.length, 2 + FIGHT_CLIPS.length);
  const sh = { vertexShader: '' };
  mat.onBeforeCompile(sh);
  compiled = sh.vertexShader;
  assert.match(compiled, new RegExp(`c >= ${2 + FIGHT_CLIPS.length} \\|\\| W`));
  for (const c of FIGHT_CLIPS) {
    assert.ok(compiled.includes(`void clip_${c.name}(inout Pose P, float t, float u, float w)`), c.name);
    assert.ok(compiled.includes(`case ${CLIPS.CLIP[c.name].id}: clip_${c.name}(Q,`), `${c.name}'s case`);
  }
  assert.match(mat.customProgramCacheKey(), /^ped\|fight-clips-/);
  assert.equal(mat.needsUpdate, true);
  // (twice is once)
  installClips({ CLIPS, mats: [mat] });
  assert.equal(CLIPS.CLIPS.length, 2 + FIGHT_CLIPS.length);
  assert.ok(fightGlsl(2).fns.includes('float fBear()'));
});

test('the look slot carries the bearing of whoever they fight and how far the gun is up, in one number', () => {
  for (const b of [-3.1, -2, -0.4, 0, 0.7, 1.9, 3.1]) for (const up of [0, 0.25, 0.5, 1]) {
    const [b2, u2] = lookOf(lookFor(b, up));
    assert.ok(Math.abs(b2 - b) < 1e-9, `${b} → ${b2}`);
    assert.ok(Math.abs(u2 - up) < 1 / 32, `${up} → ${u2}`);
  }
  // (more than half a turn is the other way round)
  assert.ok(Math.abs(lookOf(lookFor(4, 1))[0] - (4 - 2 * Math.PI)) < 1e-9);
});

test('the gun is in the hand where the clip puts it: up and on them, out in front at shoulder height; ready, low', () => {
  const up = gunMuzzle(lookFor(0, 1));
  assert.ok(up.p[2] > 0.45, `the muzzle ${up.p[2].toFixed(2)} m ahead, past the big head's front`);
  assert.ok(up.p[1] > 0.6 && up.p[1] < 1.1, `at ${up.p[1].toFixed(2)} m up`);
  assert.ok(up.d[2] > 0.85, 'pointing ahead');
  const low = gunMuzzle(lookFor(0, 0));
  assert.ok(low.p[1] < up.p[1] - 0.1 && low.d[1] < -0.3, 'ready: lower, pointing down ahead');
  // (on someone off to the +x side, the chest and the arm turn to them)
  const side = gunMuzzle(lookFor(1.2, 1));
  assert.ok(side.d[0] > 0.6, `turned to +x: ${side.d.map(v => v.toFixed(2))}`);
  // (the kick lifts the barrel)
  assert.ok(gunMuzzle(lookFor(0, 1), 1).d[1] > up.d[1] + 0.2);
  assert.equal(gunPose(lookFor(0, 1)).R.length, 9);
  assert.ok(FIRE_D < 1 / 3.4 + 0.01, 'a kick is done before the chopper\'s next shot');
});

test("the blows the page sees coming are the ones the rules swing, on the same ticks (the fight itself untouched)", () => {
  // (standing a while, then a few steps now and then: the blows come thick)
  const moves = Array.from({ length: 2000 }, (_, k) => (k % 90 < 70 ? { x: 0, y: 0 } : { x: Math.sin(k / 40) * 0.6, y: 0.5 }));
  const F = createFight({ build: PRESETS.starter, level: 'real', seed: 4 });
  let seen = 0;
  let matched = 0;
  const pending = [];
  while (!F.over && F.tick < 1500) {
    const before = JSON.stringify({ t: F.t, rs: F.rs, people: F.people, n: F.events.length });
    const P = predictBlows(F, moves[F.tick], LOOK);
    assert.equal(JSON.stringify({ t: F.t, rs: F.rs, people: F.people, n: F.events.length }), before, 'looking ahead does not touch the fight');
    pending.push(...P);
    const n0 = F.events.length;
    step(F, moves[F.tick]);
    for (const e of F.events.slice(n0)) {
      if (e.type !== 'swing') continue;
      seen += 1;
      // (with the keys held as they were, every blow was seen coming at least a tick ahead, on its very tick: the
      // fight's clock, F.t, as the page's is; an event's own t is rounded to the hundredth)
      if (pending.some(p => p.id === e.id && Math.abs(p.t - F.t) < 1e-6)) matched += 1;
    }
  }
  assert.ok(seen > 10, `${seen} blows`);
  assert.equal(matched, seen, `${matched} of ${seen} seen coming on their tick`);
  // (and the same seed and moves are the same fight with or without the page looking ahead)
  const A = runFight({ build: PRESETS.starter, level: 'real', seed: 4, moves });
  assert.deepEqual(A.events.slice(0, F.events.length), F.events);
});

test('a blow seen coming starts its wind-up so that its contact is the damage tick', () => {
  for (const [name, contact] of Object.entries(CONTACT)) {
    const tHit = 5;
    // (too early: wait)
    assert.equal(windAt(tHit, tHit - contact - 0.1, contact), null);
    // (any frame inside the wind-up: the clip's clock then runs with the fight's, and reads `contact` at tHit)
    for (const now of [tHit - contact, tHit - contact / 2, tHit - TICK, tHit]) {
      const t0 = windAt(tHit, now, contact);
      assert.ok(t0 !== null && Math.abs(t0 + (tHit - now) - contact) < 1e-9, `${name} at ${now}`);
    }
  }
  assert.ok(LOOK * TICK > Math.max(...Object.values(CONTACT)), 'the page looks far enough ahead for the longest wind-up');
});

test('the long guns (fight-3) sit in both hands: up, at the chest and on them; ready, low across the body; the kick lifts them', () => {
  assert.deepEqual(GUN_CLIPS, { doorman: ['fight_doorman', 'fight_doorman_fire'], longeye: ['fight_longeye', 'fight_longeye_fire'] });
  for (const names of Object.values(GUN_CLIPS)) for (const n of names) assert.ok(FIGHT_CLIPS.some(c => c.name === n && c.prop), `${n}, with the gun as its prop`);
  const up = longPose(lookFor(0, 1));
  const { R, L } = longHands(lookFor(0, 1));
  const apart = Math.hypot(L[0] - R[0], L[1] - R[1], L[2] - R[2]);
  assert.ok(apart > 0.15 && apart < 0.35, `the two hands ${apart.toFixed(2)} m apart along it`);
  assert.ok(R[1] > 0.65 && R[1] < 0.9 && L[2] > R[2] + 0.15, 'at the chest, the −x hand out in front');
  assert.ok(up.dir[2] > 0.9, `pointing ahead: ${up.dir.map(v => v.toFixed(2))}`);
  assert.ok(longMuzzle('longeye', lookFor(0, 1)).p[2] > 0.85 && longMuzzle('doorman', lookFor(0, 1)).p[2] > 0.6, 'the barrels reach out past the big head');
  const low = longPose(lookFor(0, 0));
  assert.ok(low.dir[1] < -0.15 && low.p[1] < up.p[1] - 0.1, 'ready: low, pointing down across the body');
  assert.ok(longPose(lookFor(0.8, 1)).dir[0] > 0.5, 'on someone off to the +x side, it turns to them');
  assert.ok(longPose(lookFor(0, 1), 1).dir[1] > up.dir[1] + 0.2, 'the kick lifts the barrel');
  // (the shader's numbers are the JS twin's: the hold's angles are written into its GLSL)
  for (const v of [...HOLD.aim.R, ...HOLD.aim.L, ...HOLD.ready.R]) assert.ok(LONG_GLSL.includes(v.toFixed(4)), `${v} in the shader`);
  assert.ok(fightGlsl(100).fns.includes('void fLong('));
  assert.ok(LONG_FIRE_D.longeye > LONG_FIRE_D.doorman, 'the Long-eye\'s kick is the slower');
  assert.ok(LONG_FIRE_D.doorman < 1 / 1.6 && LONG_FIRE_D.longeye < 1 / 0.75, 'each kick is done before its next shot');
});
