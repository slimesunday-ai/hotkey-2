// THE FOUR GUNS, HELD BY HAND (anim-1; demo/fight/puppet/guns.js): the hands are on the gun, the line is where it is
// asked, each gun kicks its own way, and a body a round kills ends on the ground.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pose0 } from '../demo/fight/puppet/rig.js';
import { gunPoseSided, solveArms, gunInBody, GUNS, SHOT, DROPS, dropFor, keepApart, KICK } from '../demo/fight/puppet/guns.js';

const posed = S => {
  const P = pose0();
  // (a gun in both hands is at the shoulder of the side it points to: guns.js gunPoseSided)
  const G = gunPoseSided(P, { t: 1.3, v: 0, reload: -1, since: 9, up: 1, aim: 0, ...S }, S.flip ?? ((S.aim ?? 0) > 0.3 ? 1 : 0));
  solveArms(P);
  return { P, G, B: gunInBody(P, G) };
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const KINDS = Object.keys(GUNS);

test('both hands are ON the gun: the trigger hand on its grip, the front hand on its hold, wherever it points', () => {
  for (const kind of KINDS) {
    for (const aim of [-2.4, -1.2, -0.4, 0, 0.4, 1.2, 2.4]) for (const up of [0, 1]) for (const since of [9, 0.0, 0.05, 0.25]) {
      const { B } = posed({ kind, aim, up, since, heat: 3 });
      assert.ok(dist(B.trigger, B.at) < 0.04, `${kind} aim ${aim} up ${up} ${since} s after a shot: the trigger hand is ${(dist(B.trigger, B.at) * 100).toFixed(1)} cm off the grip`);
      if (B.fore) assert.ok(dist(B.front, B.fore) < 0.04, `${kind} aim ${aim} up ${up} ${since} s after a shot: the front hand is ${(dist(B.front, B.fore) * 100).toFixed(1)} cm off its hold`);
    }
  }
});

test('raised, the barrel lies on the line asked for, as far round as the chest and the arms turn', () => {
  for (const kind of KINDS) {
    for (const aim of [-2.0, -1.0, -0.5, 0, 0.5, 1.0, 2.0]) {
      // (the six-shot is one hand's: round to its own side and across the chest, not behind the other shoulder)
      if (kind === 'pistol' && aim < -1.5) continue;
      const { B } = posed({ kind, aim });
      const yaw = Math.atan2(B.dir[0], B.dir[2]);
      assert.ok(Math.abs(yaw - aim) < 0.04, `${kind} asked ${aim}: the barrel is at ${yaw.toFixed(2)}`);
      assert.ok(Math.abs(B.dir[1]) < 0.09, `${kind}: level`);
      // (the muzzle is ahead of the grip along that line: the flash leaves from the barrel's end)
      const along = (B.muzzle[0] - B.at[0]) * B.dir[0] + (B.muzzle[1] - B.at[1]) * B.dir[1] + (B.muzzle[2] - B.at[2]) * B.dir[2];
      assert.ok(Math.abs(along - GUNS[kind].muzzle[2]) < 0.01, `${kind}: the muzzle is the barrel's end`);
    }
  }
});

test('each gun kicks its own way', () => {
  const climb = (kind, since) => posed({ kind, since }).B.dir[1] - posed({ kind }).B.dir[1];
  const lean = (kind, since) => posed({ kind, since }).P.tx - posed({ kind }).P.tx;
  // the six-shot: all of it goes up, more than any other's, and it is back within a third of a second
  KICK.doorman = 1;
  assert.ok(climb('pistol', 0.04) > 0.45 && climb('pistol', 0.04) > climb('doorman', 0.05) + 0.15);
  assert.ok(Math.abs(climb('pistol', 0.32)) < 0.03);
  // the chopper: a small shake a round, and the muzzle walks up with the burst
  assert.ok(climb('chopper', 0.02) < 0.3);
  assert.ok(posed({ kind: 'chopper', heat: 5 }).B.dir[1] > posed({ kind: 'chopper', heat: 0 }).B.dir[1] + 0.1);
  // the Doorman: the body is shoved back (the chest rocks further than the six-shot's four times over), then the pump
  assert.ok(lean('doorman', 0.05) < -0.18 && lean('doorman', 0.05) < 3 * lean('pistol', 0.04));
  // (THE KICK IS ONE NUMBER, KICK.doorman: at half, the body takes half of it and the gun the rest: the muzzle
  // goes higher than it did, and it is still the hardest shove of the four)
  const [lean1, climb1] = [lean('doorman', 0.05), climb('doorman', 0.05)];
  KICK.doorman = 0.5;
  assert.ok(lean('doorman', 0.05) > lean1 * 0.6 && lean('doorman', 0.05) < -0.08 && lean('doorman', 0.05) < 1.5 * lean('pistol', 0.04));
  assert.ok(climb('doorman', 0.05) > climb1 + 0.05);
  assert.equal(posed({ kind: 'doorman', since: 0.05 }).G.slide, 0);
  assert.ok(posed({ kind: 'doorman', since: 0.36 }).G.slide > 0.9, 'the pump is back');
  assert.equal(posed({ kind: 'doorman', since: 0.6 }).G.slide, 0);
  // (the front hand goes back with it)
  assert.ok(dist(posed({ kind: 'doorman', since: 0.36 }).B.fistL, posed({ kind: 'doorman', since: 0.36 }).B.at) < dist(posed({ kind: 'doorman' }).B.fistL, posed({ kind: 'doorman' }).B.at) - 0.08);
  // the Long-eye: the longest of them; the muzzle is still high half a second on, and the trigger hand is off the grip at the bolt
  assert.ok(climb('longeye', 0.5) > 0.15 && Math.abs(climb('pistol', 0.5)) < 0.02);
  const L = posed({ kind: 'longeye', since: 0.58 });
  assert.ok(dist(L.B.fistR, L.B.at) > 0.06, 'the hand is on the bolt');
  assert.ok(Math.abs(climb('longeye', 1.0)) < 0.03, 'and it is down again a second on');
});

test('a long gun at rest is carried across the body, muzzle up; the six-shot hangs at the thigh', () => {
  for (const kind of ['doorman', 'longeye']) {
    const { B } = posed({ kind, up: 0 });
    assert.ok(B.dir[1] > 0.4, `${kind} points up at rest`);
    assert.ok(B.muzzle[1] > 0.9, `${kind}'s muzzle is above the shoulders`);
    assert.ok(dist(B.fistL, B.fore) < 0.04, `${kind}: carried in both hands`);
    const W = posed({ kind, up: 0, v: 3 });
    assert.ok(dist(W.B.fistL, W.B.fore) < 0.04, `${kind}: and walking`);
  }
  assert.ok(posed({ kind: 'pistol', up: 0 }).B.dir[1] < -0.8);
});

test('a reload brings the gun in and takes the other hand off it and back', () => {
  for (const kind of KINDS) {
    const mid = posed({ kind, reload: 0.5 });
    assert.ok(mid.B.at[2] < posed({ kind }).B.at[2] + 0.05, `${kind}: the gun is in at the chest`);
    for (const r of [0, 0.2, 0.5, 0.8, 1]) for (const v of Object.values(posed({ kind, reload: r }).P.aL)) assert.ok(Number.isFinite(v));
  }
});

test('a round does its own thing to whoever it hits, and a body it kills ends on the ground and stays', () => {
  for (const [kind, D] of Object.entries(SHOT)) {
    const P = pose0();
    D.pose(P, 0.05, { from: 0.8, front: true });
    assert.ok(Math.abs(P.ty) + Math.abs(P.tx) > 0.1, `${kind} moves the chest`);
    const Q = pose0();
    D.pose(Q, D.dur + 0.6, { from: 0.8, front: true });
    assert.ok(Math.abs(Q.ty) + Math.abs(Q.tx) < 0.05, `${kind}: and it is over`);
  }
  assert.equal(dropFor('doorman', 0), 'blown');
  assert.equal(dropFor('longeye', 0.5), 'dropped');
  assert.equal(dropFor('chopper', 1), 'stitched');
  assert.equal(dropFor('pistol', 0), 'crumple');
  assert.equal(dropFor('pistol', 3.5), 'running');
  for (const [name, D] of Object.entries(DROPS)) {
    const at = s => {
      const P = pose0();
      D.pose(P, s, { from: 0.3, v: 3.5, w: 1 });
      solveArms(P);
      return P;
    };
    const end = at(D.dur + 1);
    assert.ok(Math.abs(end.rx) > 1.15, `${name}: lying`);
    assert.equal(Math.sign(end.rx), D.face, `${name}: on its ${D.face > 0 ? 'front' : 'back'}`);
    const later = at(D.dur + 3);
    for (const k of ['rx', 'ry', 'mz', 'my']) assert.ok(Math.abs(end[k] - later[k]) < 1e-6, `${name}: still`);
    for (let s = 0; s < D.dur + 1; s += 0.02) for (const v of [...at(s).aL, ...at(s).aR, at(s).rx, at(s).mz]) assert.ok(Number.isFinite(v), `${name} at ${s}`);
  }
  // (the Doorman carries it back a metre and more; mid-run it goes on forward)
  const B = pose0();
  DROPS.blown.pose(B, 2, { from: 0, v: 0, w: 1 });
  assert.ok(B.mz < -1);
  const R = pose0();
  DROPS.running.pose(R, 2, { from: 0, v: 3.5, w: 1 });
  assert.ok(R.mz > 0.6);
});

test('nobody stands in anybody: whoever reaches you is drawn at arm\'s length, and you are never moved', () => {
  const KEEP = { foe: 1.25, same: 1.05 };
  // (three of theirs on your own spot and one a step off, and an ally at your shoulder: the rules allow all of it)
  const live = [{ id: 'you', side: 'you' }, { id: 'f1', side: 'foe' }, { id: 'f2', side: 'foe' }, { id: 'f3', side: 'foe' }, { id: 'f4', side: 'foe' }, { id: 'ally', side: 'ally' }];
  const at = new Map([['you', [5, 5]], ['f1', [5, 5]], ['f2', [5.02, 5]], ['f3', [5, 4.9]], ['f4', [5.6, 5.3]], ['ally', [5.3, 5]]]);
  const moved = keepApart(live, at, KEEP, (a, b) => (a.length + b.length) * 1.7);
  assert.deepEqual(at.get('you'), [5, 5]);
  assert.ok(!moved.has('you'));
  const d = (a, b) => Math.hypot(at.get(a)[0] - at.get(b)[0], at.get(a)[1] - at.get(b)[1]);
  for (const f of ['f1', 'f2', 'f3', 'f4']) assert.ok(d('you', f) >= KEEP.foe - 0.02, `${f} is drawn ${d('you', f).toFixed(2)} m from you`);
  assert.ok(d('you', 'ally') >= KEEP.foe - 0.02);
  // (and whoever was already clear of everybody is left where the rules have them)
  const far = new Map([['you', [0, 0]], ['f1', [3, 0]], ['f2', [0, 4]]]);
  assert.equal(keepApart(live.slice(0, 3), far, KEEP).size, 0);
  assert.deepEqual(far.get('f1'), [3, 0]);
});

test('a body killed at arm\'s length of its killer does not dive on: it falls by what hit it', () => {
  // (gunner.js: within 3.2 m the speed it was running at is not what chooses the fall)
  assert.equal(dropFor('doorman', 0), 'blown');
  assert.equal(dropFor('doorman', 4), 'running');
  assert.equal(DROPS.blown.face, -1);
  assert.equal(DROPS.running.face, 1);
});

// (anim-2) THE DOORMAN'S LEAN: the first take was seen to tip its holder 30 degrees. Most of that was never the pose
// (the walker's own roll into a turn, a stance of the wrong sign: gunner.js ownTurns, stanceOff; measured in the page by
// demo/tools/gun-lean.mjs). What the pose itself does is held here: nobody is tipped over by their own gun.
test('no gun tips its own holder over: the spine stays near upright through a shot, at the stance it is fired from', async () => {
  const { fk } = await import('../demo/fight/puppet/rig.js');
  const most = { pistol: 8, chopper: 15, doorman: 9, longeye: 12 };
  for (const kind of KINDS) {
    const aim = (GUNS[kind].hands ?? 1) === 2 ? -0.6 : 0;
    let worst = 0;
    for (const since of [9, 0, 0.02, 0.045, 0.08, 0.15, 0.3, 0.5, 0.8]) {
      const { P } = posed({ kind, aim, up: 1, since, heat: 4 });
      const f = fk(P);
      const s = [f.neck[0] - f.hip[0], f.neck[1] - f.hip[1], f.neck[2] - f.hip[2]];
      worst = Math.max(worst, (Math.acos(s[1] / Math.hypot(...s)) * 180) / Math.PI);
    }
    assert.ok(worst <= most[kind], `${kind}: the spine is ${worst.toFixed(1)} degrees off upright through a shot (over ${most[kind]})`);
  }
});

test('the Doorman kicks harder into the gun and the shoulder than into the body, and the body takes more of it as KICK goes up', () => {
  const was = KICK.doorman;
  try {
    const at = K => {
      KICK.doorman = K;
      const rest = posed({ kind: 'doorman', aim: -0.6, up: 1, since: 9 });
      const kick = posed({ kind: 'doorman', aim: -0.6, up: 1, since: 0.045 });
      return { lean: Math.hypot(kick.P.tx - rest.P.tx, kick.P.tz - rest.P.tz), twist: kick.P.ty - rest.P.ty, climb: kick.B.dir[1] - rest.B.dir[1] };
    };
    const [a, b] = [at(0.5), at(1)];
    assert.ok(a.twist > 0.12, `the gun's shoulder goes back round the spine at the shot (${a.twist.toFixed(2)} rad)`);
    assert.ok(a.climb > 0.2, `the muzzle is thrown up (${a.climb.toFixed(2)})`);
    assert.ok(a.lean > 0.08 && a.lean < 0.16 && b.lean > a.lean * 1.6, `the chest is shoved back ${a.lean.toFixed(2)} rad at 0.5 and ${b.lean.toFixed(2)} at 1`);
  } finally {
    KICK.doorman = was;
  }
});
