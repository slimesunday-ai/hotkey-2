// A DEAL'S QUIET ROOM (demo/stage/room.js, the hands' stage 2), driven without a browser on a stub of the city's crowd:
// a walker whose way crosses the ring is taken round it and put back on its lane; and THE BUG FOUND 2026-11-19: the
// lane found for its way back had no edge (`laneNear` → { E: null }), the room's frame hook threw on it every frame,
// and every frame hook after it (a deal's own clock) was never called again. It must not throw, and the walker must
// be let go.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.location ??= { search: '' };
const { createRoom } = await import('../demo/stage/room.js');

function stage({ edgeless = true, dog = -1 } = {}) {
  let hook = null;
  const w = { id: 1, p: [-3, 0, 0, 0], E: { len: 40, cross: false }, s: 0, vc: 1.2, v: 1.3, dog };
  const sim = {
    walkers: [w],
    bodies: [],
    // (as pedsim's own: a way ahead along the walker's lane reads that lane's length)
    ahead(x, a, P) {
      if (!x.E) throw new TypeError('no lane');
      void x.E.len;
      P[0] = x.p[0] + a;
      P[1] = 0;
      P[2] = x.p[2];
      return P;
    },
    // (as pedsim's own: off its lane a walker HAS no lane, and is drawn at its fix)
    offWalker(x, pose) {
      if (x.off) return false;
      x.fix = [...pose];
      x.off = true;
      x.E = null;
      return true;
    },
    onWalker(x) {
      x.fix = null;
      x.off = false;
      x.E = { len: 40, cross: false };
      return true;
    },
    laneNear: () => (edgeless ? { E: null, s: 0 } : { E: { len: 40 }, s: 0 }),
  };
  const actors = { onFrame: fn => (hook = fn), addSolid() {}, solidAt: () => null, offKerb: () => true, lowNear: () => false, free: () => true, all: () => [], groundAt: () => 0 };
  const room = createRoom({ actors, city: { peds: { sim }, traffic: null }, director: null });
  const frame = dt => {
    sim.bodies.length = 0;
    hook(dt);
    // (the city moves a walker on its lane; one taken off it is where the room puts it)
    if (w.fix) w.p = [w.fix[0], w.fix[1], w.fix[2], w.fix[3]];
    else w.p[0] += w.vc * dt;
    // (and draws a walker's dog ahead of it along its lane, every frame: peds.js. With no lane, that threw)
    if (w.dog >= 0) sim.ahead(w, 0.55, [0, 0, 0, 0]);
  };
  return { room, w, frame };
}

test("a deal's quiet room takes a crossing walker round it, and a way back to a lane with no edge does not throw", () => {
  const { room, w, frame } = stage({ edgeless: true });
  const R = room.open({ c: [0, 0], r: 0.8, keep: [], quiet: true });
  let least = 99;
  for (let k = 0; k < 600; k++) {
    assert.doesNotThrow(() => frame(1 / 60), `frame ${k}`);
    least = Math.min(least, Math.hypot(w.p[0], w.p[2]));
  }
  R.close();
  for (let k = 0; k < 60; k++) frame(1 / 60);
  assert.ok((room.stats.round ?? 0) >= 1, 'the walker was never taken round');
  assert.ok(least > 0.8, `the walker came ${least.toFixed(2)} m from the middle of the deal`);
  assert.equal(room.state.taken, 0, 'a walker is still held off its lane');
  assert.equal(w.fix, null, 'the walker was never put back on its lane');
});

test("hands-2: a walker with a dog is never taken off its lane by a deal's quiet room (its dog is drawn along that lane)", () => {
  const { room, w, frame } = stage({ edgeless: false, dog: 0 });
  const R = room.open({ c: [0, 0], r: 0.8, keep: [], quiet: true });
  for (let k = 0; k < 600; k++) assert.doesNotThrow(() => frame(1 / 60), `frame ${k}`);
  R.close();
  assert.equal(room.stats.round ?? 0, 0, 'a dog walker was taken round');
  assert.ok(w.E && !w.off, 'the dog walker lost its lane');
});
