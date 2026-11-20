// A FIGHT'S ROOM (demo/stage/room.js), driven without a browser on a stub of the city's crowd: straight lanes joined end
// to end, walkers moved along them as the city moves them (no crowd grid: the ring of footprints stops nobody here,
// so whatever keeps the ground clear is the room's own doing). The two faults of run-styles 4-jumped-lost (room-3):
//   A. a walker with a dog walked through the fight on its lane, let out of the room although its way went on across it;
//   B. a walker startled out with nowhere to go stood at the ring's edge, still, for the rest of the fight.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.location ??= { search: '' };
const { createRoom, ON } = await import('../demo/stage/room.js');

/** A straight lane from (x0, z0) to (x1, z1). */
function lane(x0, z0, x1, z1) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  return { x0, z0, ux: (x1 - x0) / len, uz: (z1 - z0) / len, len, cross: false };
}
const at = (E, s, P) => {
  P[0] = E.x0 + E.ux * s;
  P[1] = 0;
  P[2] = E.z0 + E.uz * s;
  return P;
};

function stage({ walkers, lanes, solid = () => null, offKerb = () => true, free = () => true }) {
  let hook = null;
  const sim = {
    walkers,
    bodies: [],
    // (as pedsim's own: along its edge, on to its next one, no further)
    ahead(x, a, P) {
      let E = x.E;
      let s = x.s + a;
      if (s > E.len && x.next) {
        s -= E.len;
        E = x.next;
      }
      return at(E, Math.min(s, E.len), P);
    },
    offWalker(x, pose) {
      if (x.off) return false;
      x.fix = [...pose];
      x.off = true;
      x.E = null;
      x.next = null;
      x.halt = false;
      x.vc = 0;
      return true;
    },
    onWalker(x) {
      if (!x.off || !x.fix) return false;
      const L = sim.laneNear(x.fix[0], x.fix[2]);
      if (!L) return false;
      Object.assign(x, { E: L.E, s: L.s, off: false, fix: null, halt: false, next: null });
      return true;
    },
    laneNear(x, z) {
      let best = null;
      for (const E of lanes) {
        const s = Math.max(0, Math.min(E.len, (x - E.x0) * E.ux + (z - E.z0) * E.uz));
        const d = Math.hypot(E.x0 + E.ux * s - x, E.z0 + E.uz * s - z);
        if (!best || d < best.d) best = { E, s, d };
      }
      return best;
    },
  };
  const actors = { onFrame: fn => (hook = fn), addSolid() {}, solidAt: solid, offKerb, lowNear: () => false, free, all: () => [], groundAt: () => 0 };
  const room = createRoom({ actors, city: { peds: { sim }, traffic: null }, director: null });
  const P = [0, 0, 0, 0];
  const frame = dt => {
    sim.bodies.length = 0;
    hook(dt);
    for (const w of walkers) {
      if (w.fix) {
        w.p = [w.fix[0], w.fix[1], w.fix[2], w.fix[3]];
      } else if (!w.halt) {
        // (the city: a walker takes up its own pace, along its lane and on to the next)
        w.vc = Math.min(w.v, (w.vc ?? 0) + 2 * dt);
        w.s += w.vc * dt;
        if (w.s >= w.E.len) {
          if (w.next) {
            w.s -= w.E.len;
            w.E = w.next;
            w.next = w.then?.shift() ?? null;
          } else {
            w.s = w.E.len - 0.01;
            w.vc = 0;
          }
        }
        at(w.E, w.s, P);
        w.p = [P[0], 0, P[2], 0];
      } else {
        at(w.E, w.s, P);
        w.p = [P[0], 0, P[2], 0];
      }
      // (and draws a walker's dog ahead of it along its lane, every frame: peds.js. With no lane, that threw)
      if (w.dog >= 0) sim.ahead(w, 0.55, [0, 0, 0, 0]);
      w.turn?.(w);
    }
  };
  return { room, frame, sim };
}

/** Plays `secs` of a fight at [0, 0] of radius r; → its figures, and the walkers' own nearest. */
function play(S, { r = 2, secs = 12 } = {}) {
  const R = S.room.open({ c: [0, 0], r, keep: [] });
  for (let k = 0; k < secs * 60; k++) assert.doesNotThrow(() => S.frame(1 / 60), `frame ${k}`);
  const F = R.figures();
  R.close();
  for (let k = 0; k < 300; k++) S.frame(1 / 60);
  return F;
}

/** A walker of the crowd on `E` at `s`, walking at `v`, on to `next`. */
function walker(id, E, s, { v = 1.2, dog = -1, next = null } = {}) {
  const w = { id, E, s, v, vc: v, dog, next, p: [0, 0, 0, 0], off: false, halt: false, fix: null };
  const P = at(E, s, [0, 0, 0, 0]);
  w.p = [P[0], 0, P[2], 0];
  return w;
}
const mid = w => Math.hypot(w.p[0], w.p[2]);

test('room-3 A: a walker with a dog let out of the room, whose way then turns across the fight, is stopped and backs out along its lane', () => {
  // (a sidewalk 3.35 m from the fight's middle, just inside its room (r 2 + 1.5): its way first goes on over a crossing,
  // away from the fight, and so it is let out; at the corner the crossing is shut and the city turns it along the
  // other sidewalk, straight across the fight's ground (pedsim.js: a walker with a dog never waits at a shut crossing))
  const side = lane(-12, 3.35, 0.5, 3.35);
  const crossing = lane(0.5, 3.35, 0.5, 14);
  crossing.cross = true;
  const across = lane(0.5, 3.35, 0.5, -12);
  const w = walker(1, side, 9, { v: 1.2, dog: 0, next: crossing });
  w.turn = x => {
    if (x.E === side && x.s > 11.6 && x.next === crossing) x.next = across;
  };
  const S = stage({ walkers: [w], lanes: [side, crossing, across] });
  let least = 99;
  let lost = 0;
  const R = S.room.open({ c: [0, 0], r: 2, keep: [] });
  for (let k = 0; k < 12 * 60; k++) {
    assert.doesNotThrow(() => S.frame(1 / 60), `frame ${k}`);
    least = Math.min(least, mid(w));
    if (!w.E) lost += 1;
  }
  const F = R.figures();
  R.close();
  for (let k = 0; k < 600; k++) S.frame(1 / 60);
  assert.ok(S.room.stats.letOut >= 1, 'the walker was never let out (the case is not staged)');
  assert.equal(lost, 0, 'the walker with a dog was taken off its lane');
  assert.ok(least > 2 + ON, `the walker with a dog came ${least.toFixed(2)} m from the middle (the ground: ${2 + ON})`);
  assert.ok(F.on <= 6, `somebody was on the fight's ground for ${F.on} frames`);
  assert.equal(F.lingers, 0, `${F.lingers} stayed within a step of its edge: ${JSON.stringify(F.who)}`);
});

test('room-3 B: a walker startled out with no free place outside the room is not left standing at its edge', () => {
  // (a sidewalk 0.6 m past the fight's ground, a walker on it when the fight is called; no place out to be had: in the
  // page, at the market, 65 of the 66 places looked at were in the road, the last one across the fight. Here every
  // place is: `offKerb` says no everywhere)
  const side = lane(-12, 2.6, 12, 2.6);
  const w = walker(1, side, 11.5, { v: 1.2 });
  const S = stage({ walkers: [w], lanes: [side], offKerb: () => false });
  const F = play(S, { r: 2, secs: 12 });
  assert.equal(F.lingers, 0, `${F.lingers} stayed within a step of its edge: ${JSON.stringify(F.who.map(W => ({ who: W.who, least: W.least, for: W.for, as: W.as })))}`);
  assert.ok(F.on <= 6, `somebody was on the fight's ground for ${F.on} frames`);
  assert.equal(S.room.state.taken, 0, 'a walker is still held off its lane after the fight');
  assert.equal(w.fix, null, 'the walker was never put back on its lane');
});
