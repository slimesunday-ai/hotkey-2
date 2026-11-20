// THE FIGHTS THE PAGE PLAYS BY ITSELF, STAGED (anim-1; demo/fight/puppet/): the rules' fight read as a script and
// staged on hand-posed bodies. What the staging promises: every blow of the rules is in it on the rules' own tick, a
// planted foot stays where it is put, every way to fight and every style has a stance and blows of its own, and the
// score is a plain function of the fight's clock (any moment can be asked for, twice, and is the same).
import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, RIVALS, runDuel } from '../src/fight/index.mjs';
import { RUN_CONFIG as cfg } from '../src/run/index.mjs';
import { scriptOf, stageFight, stateAt } from '../demo/fight/puppet/choreo.js';
import { GUARDS, BLOWS, HOLDS } from '../demo/fight/puppet/moves.js';
import { pose0, fk, armTo, chestTarget, mirrorPose } from '../demo/fight/puppet/rig.js';
import { duelInputs, jumpInputs, crewInputs, measure } from '../demo/tools/fight-score.mjs';

test('every way to fight and every style has a stance and blows of its own', () => {
  const arms = [...Object.values(cfg.duel.you).map(a => a.weapon), ...Object.values(RIVALS).map(r => r.weapon), ...cfg.jumped.foes.map(f => f.weapon)];
  for (const arm of arms) {
    const G = GUARDS[arm];
    assert.ok(G, `${arm} has a stance`);
    for (const [name] of G.blows) assert.ok(BLOWS[name] || (name === 'throw' && HOLDS.throwA) || (name === 'clinch' && HOLDS.clinchA), `${arm}'s ${name} is keyed`);
    assert.ok(G.blows.some(([n]) => n === G.big), `${arm}'s big blow is one of its blows`);
  }
  // (what makes each its own: no two of the run's five ways throw the same blows from the same stance)
  const sig = a => JSON.stringify([GUARDS[a].blows.map(b => b[0]), GUARDS[a].hR, GUARDS[a].split]);
  const five = Object.values(cfg.duel.you).map(a => a.weapon);
  assert.equal(new Set(five.map(sig)).size, five.length);
  const styles = Object.values(RIVALS).map(r => r.weapon);
  assert.equal(new Set(styles.map(sig)).size, styles.length);
  for (const id of Object.keys(WEAPONS)) if (WEAPONS[id].kind === 'melee' && !GUARDS[id]) assert.ok(GUARDS.fists, `${id} falls back on the plain stance`);
});

test("the script is the rules' fight: the same result, every blow on its own tick", () => {
  for (const [arm, style, seed] of [['hands', 'brawler', 11], ['throw', 'grabber', 12], ['cutter', 'knife', 13], ['haymaker', 'bigman', 14]]) {
    const inputs = duelInputs(arm, style);
    const F = runDuel(inputs, seed);
    const S = scriptOf(inputs, seed);
    assert.equal(S.over.result, F.over.result);
    assert.equal(S.seconds, F.t);
    const swings = F.events.filter(e => e.type === 'swing');
    assert.equal(S.beats.filter(b => !b.spent).length, swings.length);
    assert.equal(S.beats.filter(b => b.hit).length, F.events.filter(e => e.type === 'hit').length);
    const fight = stageFight({ script: S, ground: { c: [0, 0] }, cam: [1, 0], seed });
    // (every blow that lands has its place and moment on the staged fight)
    for (const b of S.beats.filter(x => x.hit)) assert.ok(fight.fx.some(e => (e.kind === 'hit' || e.kind === 'slam') && Math.abs(e.t - b.t) < 1e-9), `the blow at ${b.t} is staged`);
    assert.equal(fight.tOver, F.over.t);
    assert.ok(fight.t1 > fight.tOver, 'and something follows the end');
  }
});

test('a planted foot stays where it is put, and no pose is ever not a number', () => {
  for (const [name, inputs, seed] of [['hands v brawler', duelInputs('hands', 'brawler'), 21], ['jab v quick', duelInputs('jab', 'quick'), 22], ['throw v bigman', duelInputs('throw', 'bigman'), 23], ['haymaker v grabber', duelInputs('haymaker', 'grabber'), 24], ['jumped', jumpInputs('hands'), 25], ['the crew at the door, Earl out in front', crewInputs('hands', 'front'), 26], ['the crew at the door, Earl hunting', crewInputs('hands', 'hunt'), 27]]) {
    const fight = stageFight({ script: scriptOf(inputs, seed), ground: { c: [0, 0], r: /crew/.test(name) ? 2.4 : /jumped/.test(name) ? 2 : 1.7 }, cam: [1, 0], seed, firstHurt: inputs.firstHurt ?? 0 });
    const M = measure(fight);
    for (const m of M.bodies) {
      assert.equal(m.nan, 0, `${name}: ${m.id}`);
      assert.ok(m.slide < 0.001, `${name}: ${m.id}'s planted foot moved ${(m.slide * 1000).toFixed(2)} mm`);
      assert.ok(m.longest <= 0.43, `${name}: ${m.id} took a step of ${m.longest.toFixed(2)} m`);
      // (the feet keep up with the fight's plan: a body left metres behind it has every blow after thrown at nobody)
      assert.ok((m.behind ?? 0) <= (M.bodies.length > 3 ? 1.7 : 1.3), `${name}: ${m.id} was left ${(m.behind ?? 0).toFixed(2)} m behind its plan at ${m.behindAt?.toFixed(2)} s`);
    }
    // (and it is handed back with everybody on their feet, nobody in anybody)
    assert.equal(M.endDown, 0, `${name}: somebody is still on the ground at the end`);
    assert.ok(M.endNear >= 0.85, `${name}: two stand ${M.endNear.toFixed(2)} m apart at the end`);
  }
});

test('the score is a plain function of the clock: any moment, asked for twice, is the same; and staged twice, the same', () => {
  const inputs = duelInputs('hands', 'brawler');
  const [a, b] = [0, 1].map(() => stageFight({ script: scriptOf(inputs, 31), ground: { c: [3, -2] }, cam: [0.6, 0.8], seed: 31 }));
  const flat = S => S.map(q => [q.x, q.z, q.yaw, q.P.tx, q.P.ty, q.P.hx, ...q.P.aL, ...q.P.aR, ...q.P.fL, ...q.P.fR].map(v => +v.toFixed(9)));
  for (const t of [-0.5, 0.4, 2.2, 5.05, a.tOver + 0.3, a.t1]) {
    const one = flat(stateAt(a, t));
    stateAt(a, t + 1.7);
    assert.deepEqual(flat(stateAt(a, t)), one, `asked twice at ${t}`);
    assert.deepEqual(flat(stateAt(b, t)), one, `staged twice at ${t}`);
  }
});

test('an arm keyed as a fist is the arm that puts the fist there, on either side', () => {
  for (let k = 0; k < 60; k++) {
    const P = pose0();
    Object.assign(P, { tx: 0.3 * Math.sin(k), ty: 0.9 * Math.cos(k * 1.3), tz: 0.2 * Math.sin(k * 0.7) });
    const side = k % 2 ? 1 : -1;
    const sh = side > 0 ? fk(P).shR : fk(P).shL;
    // (a point the arm can reach: 0.33 to 0.42 m from the shoulder, ahead of it)
    const d = [side * 0.3 + 0.4 * Math.sin(k * 2.1), -0.4 + 0.6 * Math.cos(k * 1.7), 1];
    const r = (0.33 + 0.09 * ((k * 7) % 10) / 10) / Math.hypot(...d);
    const at = [sh[0] + d[0] * r, sh[1] + d[1] * r, sh[2] + d[2] * r];
    const arm = armTo(chestTarget(P, at), side);
    P[side > 0 ? 'aR' : 'aL'] = arm;
    const got = side > 0 ? fk(P).fistR : fk(P).fistL;
    assert.ok(Math.hypot(got[0] - at[0], got[1] - at[1], got[2] - at[2]) < 1e-6);
  }
  // (and a pose seen in a mirror is the other hand's)
  const P = pose0();
  P.hR = [0.4, 0.8, 0.3];
  P.ty = 0.3;
  const M = mirrorPose(P);
  assert.deepEqual(M.hL, [-0.4, 0.8, 0.3]);
  assert.equal(M.ty, -0.3);
});

test('somebody on your side (Cousin Earl at your door) is staged as a fighter, on your side', () => {
  const inputs = crewInputs('hands', 'front');
  const S = scriptOf(inputs, 41);
  const earl = S.people.find(p => p.side === 'ally');
  assert.ok(earl && earl.way === 'front' && earl.arm === 'pipe', 'Earl is in the script, told his way, with his tire iron');
  const fight = stageFight({ script: S, ground: { c: [0, 0] }, cam: [1, 0], seed: 41, firstHurt: inputs.firstHurt });
  const E = fight.byId[earl.id];
  assert.ok(E.ally && E.G.held === 'pipe');
  // (he starts on your side of the line and they on theirs, each pair a clear step apart; no blow of the script has
  // him hit you or you him)
  const along = F => F.mark.at[0] * fight.u[0] + F.mark.at[1] * fight.u[1];
  assert.ok(along(E) > 0 && along(fight.fighters[0]) > 0, 'you and Earl on one side');
  for (const F of fight.fighters.filter(q => !q.ally && q !== fight.fighters[0])) assert.ok(along(F) < 0, 'they on the other');
  const d = (A, B) => Math.hypot(A.mark.at[0] - B.mark.at[0], A.mark.at[1] - B.mark.at[1]);
  assert.ok(d(E, fight.fighters[0]) > 1.6, 'and room between the two of you');
  for (const b of S.beats) assert.ok(!(b.by === earl.id && b.to === 'you') && !(b.by === 'you' && b.to === earl.id));
  // (every blow of his and on him is staged on its tick, like anybody's)
  for (const b of S.beats.filter(x => x.hit && (x.by === earl.id || x.to === earl.id))) assert.ok(fight.fx.some(e => Math.abs(e.t - b.t) < 1e-9 && e.by === b.by && e.to === b.to));
  // (and at the end everybody still in the picture is on their feet in the plain stand, or it would be handed back lying)
  const last = stateAt(fight, fight.t1);
  for (const q of last) assert.ok(!q.down);
});
