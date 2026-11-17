// HEADS OVER EACH OTHER IN THE PICTURE (demo/stage/heads.js): the audit's measure and the stage's rule for where a
// person stands for a scene, checked here with a camera of the stage's own Lock (24 m up, 64 degrees down, from the
// east, a 42-degree lens) and no browser. The page half (who stands still, the city's camera) is in actors.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { headRect, headShare, headSpell, clearPlace, HEADS_SHARE, HEADS_SECS } from '../demo/stage/heads.js';

/** The figures' typical head with its hat (actors.js HEAD_TYPICAL). */
const H = { hw: 0.5, hd: 0.45, y0: 0.9, y1: 1.8 };

/** A pinhole camera locked on (tx, tz) as the stage's Lock is: `high` m up, `down` degrees down, from the bearing. */
function lockCamera(tx, tz, { high = 24, down = 64, bearing = 90, lens = 42 } = {}) {
  const b = (bearing * Math.PI) / 180;
  const back = high / Math.tan((down * Math.PI) / 180);
  // (bearing 0 is due south of the person, +z; 90 due east, +x)
  const cam = [tx + Math.sin(b) * back, high, tz + Math.cos(b) * back];
  const f = norm([tx - cam[0], -high, tz - cam[2]]);
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const k = 1 / Math.tan(((lens / 2) * Math.PI) / 180);
  return (x, y, z) => {
    const p = [x - cam[0], y - cam[1], z - cam[2]];
    const d = dot(p, f);
    return [(k * dot(p, r)) / d, (k * dot(p, u)) / d];
  };
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => a.map(v => v / Math.hypot(...a));

/** The share two people standing at p and q (facing yaw 0) have on the picture of a camera locked on p. */
const shareOf = (p, q, project = lockCamera(p[0], p[1])) => headShare(headRect(H, p[0], 0, p[1], 0, project), headRect(H, q[0], 0, q[1], 0, project));

test('the share of two boxes on the picture: apart, one in the other, half over', () => {
  assert.equal(headShare([0, 0, 1, 1], [2, 2, 3, 3]), 0);
  assert.equal(headShare([0, 0, 1, 1], [0, 0, 1, 1]), 1);
  assert.equal(headShare([0, 0, 1, 1], [0.5, 0, 1.5, 1]), 0.5);
  // (of the smaller: a small head wholly in a big one is wholly over it)
  assert.equal(headShare([0, 0, 4, 4], [1, 1, 2, 2]), 1);
});

test('heads a metre across: closer than about 1.2 m, or lined up toward the camera, one is over the other', () => {
  // the player at Mrs. Kowalski's elbow behind her stall: 0.73 m apart (guard seed 8: 45% in the audit)
  assert.ok(shareOf([-47.7, 50.6], [-47.3, 50.0]) > HEADS_SHARE);
  // the same 0.73 m across the picture (north and south of each other, the Lock looking west); a metre across: clear
  assert.ok(shareOf([0, 0], [0, 0.73]) > HEADS_SHARE);
  assert.equal(shareOf([0, 0], [0, 1.0]), 0);
  // 1.2 m along the camera's bearing (east and west of each other) is still one head over the other; 1.6 m is clear
  assert.ok(shareOf([0, 0], [-1.2, 0]) > HEADS_SHARE, 'lined up toward the camera, the nearer head is drawn over the farther');
  assert.equal(shareOf([0, 0], [-1.6, 0]), 0);
});

test('a spell is counted on the game\'s own clock: the same at 1x and 4x and at any frame rate, and fired once', () => {
  const run = (frames, dt) => {
    let t = 0;
    let fired = 0;
    let at = null;
    for (let k = 0; k < frames; k++) {
      const r = headSpell(t, dt, true);
      t = r.t;
      if (r.fired) {
        fired += 1;
        at ??= t;
      }
    }
    return { fired, at };
  };
  // one second of the game: 60 frames at 1x, 15 frames at 4x (each 1/15 s of the game), 6 slow frames of 1/6 s
  const at1 = run(60, 1 / 60);
  const at4 = run(15, 4 / 60);
  const slow = run(6, 1 / 6);
  for (const r of [at1, at4, slow]) assert.equal(r.fired, 1);
  for (const r of [at1, at4, slow]) assert.ok(r.at > HEADS_SECS && r.at < HEADS_SECS + 0.2, `fired at ${r.at} s of the game`);
  // NOT MORE LENIENT THAN THE WALL CLOCK WAS: at 4x a spell of 0.6 s of the game (0.15 s of the wall) fires
  assert.equal(run(9, 4 / 60).fired, 1);
  // a frame apart starts it again; and a still stage (speed 0) adds nothing
  assert.deepEqual(headSpell(0.4, 1 / 60, false), { t: 0, fired: false });
  assert.deepEqual(headSpell(0.4, 0, true), { t: 0.4, fired: false });
});

test('the nearest clear place round the partner: the scene\'s own spot when clear, else the nearest step whose head is clear', () => {
  const project = lockCamera(0, 0);
  const partner = [0, 0];
  const third = [0.2, 1.0];
  const share = (x, z) => headShare(headRect(H, x, 0, z, 0, project), headRect(H, third[0], 0, third[1], 0, project));
  // the intended spot, north of the partner at 1.15 m, is in the third person's head; the place found is not
  const want = [0, 1.15];
  assert.ok(share(...want) > HEADS_SHARE);
  const to = clearPlace({ ox: partner[0], oz: partner[1], a0: Math.atan2(want[0], want[1]), rings: [1.15], from: want, share });
  assert.ok(to, 'a place is found');
  assert.ok(share(...to) <= HEADS_SHARE / 2, `clear of the third person (${share(...to).toFixed(2)})`);
  assert.ok(Math.abs(Math.hypot(to[0], to[1]) - 1.15) < 1e-9, 'at the step\'s own reach from the partner');
  // a spot already clear is kept
  const clear = clearPlace({ ox: 0, oz: 0, a0: Math.PI, rings: [1.15], from: [0, -1.15], share });
  assert.ok(Math.hypot(clear[0] - 0, clear[1] + 1.15) < 1e-9);
  // the ground's say: refused everywhere east of the partner (a stall), the place is west
  const west = clearPlace({ ox: 0, oz: 0, a0: 0, rings: [1.15], from: want, share, ground: x => x <= 0.01 });
  assert.ok(west[0] <= 0.01 && share(...west) <= HEADS_SHARE / 2);
  // nothing to stand on: none
  assert.equal(clearPlace({ ox: 0, oz: 0, a0: 0, rings: [1.15], from: want, share, ground: () => false }), null);
});
