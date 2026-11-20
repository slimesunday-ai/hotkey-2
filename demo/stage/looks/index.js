// THE DRUG LOOKS ON PEOPLE (looks-1): what THE RUN's cooking will one day do to a body, seen on the stage. Display
// only: nothing here is read by the rules, and with nobody under a look it does nothing at all.
//
// A look is a few channels on one body (the crafting plan, B11):
//   body / legs   what the body does: asleep, dancing, doubling over, squaring up (poses.js, played by clip.js)
//   skin          a tint over the person's own colours, still a person under it (the city's switch, peds.fx: its `mix`
//                 below 1 keeps their clothes, shading and face; `band` turns a rainbow up the body)
//   overhead      one pixel picture rising off the head: z's, notes, the vein of a temper (bits.js icons)
//   trail         what they leave: a green spray on the ground, steam off them (bits.js squares)
// (pot-3: low res's jerks are gone: the owner rejected them ("Low res is bad"), and the camera follows the player. Its
// look is now the city's tape skin, `vhs`, in the board's variant B, the owner's pick: "I like b for vhs")
//
// THE CALLS (stage.looks):
//   looks.on(who, look, opts?)      put a look on: `who` a stage person's id ('a1', the named cast's ids), a walker of
//                                   the city's crowd (its id or the walker), or the walker of anybody; look one of
//                                   LOOKS' keys. → true, or false if nobody is there. opts: { side, hand, phase, chunky,
//                                   t } (pot-3: `t` s into the look already: somebody found asleep or dancing, not
//                                   seen to start: no going down, no shiver, the skin and the pictures over them at once)
//   looks.off(who)                  take it off: it ends the way it ends (they wake and stretch; the dance winds down)
//                                   and then nothing of it is left on them. → true
//   looks.off(who, { now: true })   at once, no ending
//   looks.crowd(who, look, { n, r, ripple, placed })   the strangers of the crowd nearest `who` catch the LOOK and none
//                                   of the rule: up to n (10) within r m (16, and out to `far` (40) when fewer are near:
//                                   the crowd is thinned round the player), the nearest first, one every `ripple` s; they
//                                   walk over. `placed` (pot-3, only while the picture is black): each put on its place
//                                   at once, already dancing. → their ids
//   looks.has(who) · looks.list() · looks.stats() → { people, strangers, rows, bits, ms }
//   (pot-3) looks.bodyOf(who) → { look, t, end, head, lying, skin, crowd } what the body is doing now, for the checks
//   (pot-3) looks.pocketOf(who) → [x, y, z] the near hip pocket of a body under a look, in the world (a sleeper's wallet)
// A person under a look stays the stage's: where they stand, which way they face and who they are are untouched.
import { pose0, fk, toWorld } from '../../fight/puppet/rig.js';
import { MOVES, lookPose } from './poses.js';
import { installLookClip, LOOK_CLIP, takeRow, freeRow, writeRow } from './clip.js';
import { createBits } from './bits.js';

/** The looks: which channels each uses, and how. */
export const LOOKS = Object.freeze({
  zonk: { says: 'Zonked: asleep where they stand, z\'s over them', move: 'zonk', icon: { kind: 'z', every: 0.75, after: 5.0, color: 0xf4f6ff, size: 0.62, grow: 1.1, rise: 0.36, life: 3.0, at: 'sleep' } },
  disco: { says: 'Disco Rash: every colour, cannot stop dancing', move: 'disco', skin: { skin: 'rainbow', mix: 0.4, speed: 0.3, band: -1.1 }, icon: { kind: 'note', every: 1.15, after: 0.8, color: 0xfff27a, size: 0.5, rise: 0.6, life: 1.8 } },
  // (pot-3: THE TAPE, in place of low res's jerks and greens, which the owner rejected: the city's `vhs` skin in the
  // board's variant B, his pick ("I like b for vhs"): pink and green glitch bursts and static over the person, the
  // colour washed, the body not moved. The id is kept; its name on the screen is still open, so none is given)
  lowres: { says: 'lowres (its name is open): a worn tape of a person, pink and green bursts and static', skin: { skin: 'vhs', burst: 0.9, static: 0.6, band: 0.4, wash: 0.4, grain: 2 } },
  pukes: { says: 'The Pukes: a batch gone wrong', move: 'pukes', skin: { skin: 'flat', color: 0x8fd13a, mix: 0.3 } },
  cooked: { says: 'Cooked: red, steaming, squaring up', move: 'cooked', skin: { skin: 'flat', color: 0xff1e0e, mix: 0.68 }, steam: { rate: 30 }, icon: { kind: 'vein', every: 1.1, after: 0.6, color: 0xff2a18, size: 0.7, rise: 0.2, life: 1.0 } },
});
const PUKE = [0x8fd13a, 0x6fb52c, 0xb8d94a, 0x5c8f22, 0xc9e06a];
const STEAM = [0xf2f2ee, 0xe2e4e6, 0xd2d6da, 0xfafaf8];
const SKIN_IN = 0.6;
const SKIN_OUT = 0.8;

export function createLooks({ city, actors }) {
  const THREE = city.THREE;
  const peds = city.peds;
  const sim = peds.sim;
  const CLIPS = actors.CLIPS;
  installLookClip({ CLIPS, mats: [peds.anim.mat, peds.anim.batch?.customDepthMaterial], THREE });
  const bits = createBits({ THREE, scene: city.scene, camera: city.camera });
  try {
    bits.warm(city.renderer);
  } catch {
    /* compiled on the first frame */
  }
  /** walker → its entry */
  const on = new Map();
  /** the strangers this file took off their lanes (and must walk back to them) */
  const ours = new WeakSet();
  const A0 = pose0();
  const P0 = pose0();
  const stats = { ms: 0, msMax: 0, frames: 0 };
  let clock = 0;

  const hash = n => {
    let h = (n * 2654435761) >>> 0;
    h ^= h >>> 15;
    return (h % 10007) / 10007;
  };
  function find(who) {
    if (who && typeof who === 'object') {
      const w = who.p ? who : who.w;
      return w?.p && !w.gone ? { w, A: w.hk2 ?? null } : null;
    }
    if (typeof who === 'string' && actors.has(who)) {
      const A = actors.get(who);
      return { w: A.w, A };
    }
    if (typeof who === 'number') {
      const w = sim.walkers.find(x => x.id === who && !x.gone);
      return w ? { w, A: w.hk2 ?? null } : null;
    }
    return null;
  }
  const sizeOf = E => E.A?.size ?? 1;
  const yawOf = E => E.w.yawS ?? E.w.p[3];
  /** a body-frame point of the shared body → the world, for this body (its size, place and heading) */
  function world(E, p) {
    const k = sizeOf(E);
    return toWorld([p[0] * k, p[1] * k, p[2] * k], E.w.p[0], E.w.p[1], E.w.p[2], yawOf(E));
  }

  function setSkin(E, k) {
    const S = E.L.skin;
    if (!S) return;
    if (S.skin === 'vhs') {
      // (the tape comes up and goes with its static, its band and its wash: there is no mix to it)
      if (k <= 0.01) {
        peds.fx?.clear(E.w);
        return;
      }
      peds.fx?.set(E.w, { skin: 'vhs', burst: S.burst, static: S.static * k, band: S.band * k, wash: S.wash * k, grain: S.grain, phase: E.K.phase, ...(E.chunky ? { body: 'chunky' } : {}) });
      return;
    }
    const mix = S.mix * k;
    if (mix <= 0.01) {
      peds.fx?.clear(E.w);
      return;
    }
    const spec = { skin: S.skin, color: S.color ?? 0xffffff, mix, phase: E.K.phase };
    if (S.speed !== undefined) spec.speed = S.speed * (0.85 + 0.3 * E.K.r2);
    if (S.band) spec.band = S.band;
    if (E.chunky) spec.body = 'chunky';
    peds.fx?.set(E.w, spec);
  }

  function on_(who, name, opts = {}) {
    const L = LOOKS[name];
    if (!L) throw new Error(`looks: no look '${name}' (${Object.keys(LOOKS).join(', ')})`);
    const f = find(who);
    if (!f) return false;
    const { w, A } = f;
    if (on.has(w)) off(w, { now: true });
    const r = hash(w.id + 17);
    const t0 = Math.max(0, opts.t ?? 0);
    const E = {
      who, w, A, id: A?.id ?? null, name, L, t: t0, end: null, row: null, crowd: !!opts.crowd, chunky: !!(opts.chunky ?? L.chunky),
      K: { phase: opts.phase ?? r, r2: hash(w.id + 91), side: opts.side ?? (r < 0.5 ? -1 : 1), hand: opts.hand ?? (hash(w.id + 5) < 0.5 ? -1 : 1), beat: L.move === 'disco' ? 0.52 * (opts.beat ?? 0.95 + 0.1 * hash(w.id + 3)) : 0.52, order: opts.order ?? null },
      iconAt: 0, events: 0, steam: 0, skinK: 0, fix: null, releasing: 0, done: false, face: opts.face ?? null,
      // (a stranger who caught it from across the way walks over first: `go` the place it walks to; `age` since it caught it)
      go: opts.to ? { to: opts.to, v: 0, then: 'look' } : null, age: t0,
      // (pot-3: the patch a stranger danced in, crowd() `C`)
      C: opts.C ?? null,
    };
    if (L.move === 'disco' && !E.K.order) {
      // (each dancer its own order of the moves: a rotation of the four, from its own number)
      const k = Math.floor(hash(w.id + 41) * 4);
      E.K.order = ['groove', 'roof', 'point', 'wave'].map((_, i, a) => a[(i + k) % 4]);
    }
    if (L.move) {
      E.row = takeRow();
      if (E.row === null) return false;
    }
    // a stranger of the crowd is taken off its lane and held where it is (the city's own way for one held by something)
    if (!A) {
      if (w.agent || w.dog >= 0) return false;
      if (!w.off) {
        // (`at`: put on its place in the patch at once, facing in: crowd() `placed`, under a black picture)
        const q = opts.at ? [opts.at[0], groundAt(opts.at[0], opts.at[1]), opts.at[1], opts.face ? Math.atan2(opts.face[0] - opts.at[0], opts.face[1] - opts.at[1]) : w.yawS ?? w.p[3]] : [w.p[0], w.p[1], w.p[2], w.yawS ?? w.p[3]];
        if (!sim.offWalker(w, q)) {
          if (E.row !== null) freeRow(E.row);
          return false;
        }
        ours.add(w);
        if (opts.at) for (let i = 0; i < 4; i++) w.p[i] = q[i];
      }
      // (one of ours still off its lane from a look before is ours to walk home; one the city holds off its lane is not)
      E.fix = ours.has(w);
    }
    on.set(w, E);
    if (E.chunky && !L.skin) peds.fx?.set(w, { body: 'chunky' });
    if (L.move) writeRow(E.row, lookPose(L.move, t0, null, E.K, A0, P0));
    // (found under it: the skin on at once)
    if (t0 >= SKIN_IN && L.skin) setSkin(E, (E.skinK = 1));
    return true;
  }

  function off(who, { now = false } = {}) {
    const f = typeof who === 'object' && who?.p && on.has(who) ? { w: who } : find(who);
    const E = f && on.get(f.w);
    if (!E) return false;
    if (now || !E.L.move) release(E, now);
    else if (E.end === null) E.end = 0;
    return true;
  }

  /** Everything of the look off them: the clip let go (it blends to their stand), the tint, the bits, their lane. */
  function release(E, now = false) {
    if (E.releasing) return;
    E.releasing = clock;
    E.end ??= 0;
    peds.fx?.clear(E.w);
    bits.fade(E.w, now ? 0.2 : 1.2);
    if (E.row !== null) {
      writeRow(E.row, lookPose(null, 0, null, E.K, A0, P0));
      if (E.A) actors.stop(E.A.id);
      else if (E.w.g?.clip?.name === LOOK_CLIP) CLIPS.stopClip(E.w.g);
    }
    if (now) finishRelease(E);
  }
  function finishRelease(E) {
    // (the clip is gone before the row is let go: a named person's blends out on the stage, a stranger's is dropped)
    if (E.A && E.A.clipName === LOOK_CLIP && clock - E.releasing < 1.5) return false;
    if (!E.A && E.w.g?.clip?.name === LOOK_CLIP) CLIPS.clearClip(E.w.g);
    if (E.row !== null) {
      if (E.w.g) E.w.g.look = 0;
      freeRow(E.row);
      E.row = null;
    }
    if (E.fix && !E.w.gone) {
      // A STRANGER WALKS BACK TO ITS LANE, then joins it there (pedsim.js onWalker puts it on the nearest lane point AT
      // ONCE: from where it danced that is a jump of a metre or more, so it is walked there first). When the lane there
      // is not clear it stands and is tried again, a few times a second.
      if (!E.home) {
        // its way back on: a point of the nearest lane that is clear now (nobody within a step and a half on it), not
        // where the lane ends at a corner (the crossing's queue), and not the point another of ours is walking to;
        // the nearest such to where it stands
        const L = sim.laneNear?.(E.w.fix[0], E.w.fix[2], 12);
        if (L) {
          const P4 = [0, 0, 0, 0];
          const mine = [...on.values()].filter(o => o !== E && o.homeLane === L.E).map(o => o.homeS);
          let best = null;
          // (after a few seconds of waiting, a closer gap will do)
          E.homeSince ??= clock;
          const [gb, ga] = clock - E.homeSince > 3 ? [0.9, 0.7] : [1.4, 1.2];
          for (let k = 0; k <= 20 && !best; k++) {
            const s2 = L.s + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 1.2;
            if (s2 < (gb < 1 ? 0.3 : 1.5) || s2 > L.E.len - (gb < 1 ? 0.3 : 3)) continue;
            if (mine.some(m => Math.abs(m - s2) < 1.6)) continue;
            if (sim.laneClear && !sim.laneClear(L.E, s2, gb, ga)) continue;
            sim.ahead({ E: L.E, s: s2, next: null, lat: 0, kx: 0, pE: null }, 0, P4);
            if (actors.solidAt?.(P4[0], P4[2])) continue;
            best = { s: s2, at: [P4[0], P4[2]] };
          }
          if (best) {
            E.home = best.at;
            E.homeLane = L.E;
            E.homeS = best.s;
            if (Math.hypot(best.at[0] - E.w.fix[0], best.at[1] - E.w.fix[2]) > 0.08) E.go = { to: E.home, v: 0, then: 'lane' };
          } else {
            // (nothing clear just now: it stands, and looks again in a moment)
            E.nextTry = clock + 0.5;
            return false;
          }
        } else E.home = [E.w.fix[0], E.w.fix[2]];
      }
      if (E.go) return false;
      if (clock < (E.nextTry ?? 0)) return false;
      if (!sim.onWalker(E.w)) {
        E.nextTry = clock + 0.25;
        // (not let on: another clear point is looked for)
        E.tries = (E.tries ?? 0) + 1;
        E.home = null;
        return false;
      }
    }
    ours.delete(E.w);
    on.delete(E.w);
    return true;
  }
  /** A stranger walking over (or home): turned toward the way first, then walking, easing in and out; on its own feet. */
  function walk(E, dt) {
    const f = E.w.fix;
    if (!f) {
      E.go = null;
      return;
    }
    const [tx, tz] = E.go.to;
    const dx = tx - f[0];
    const dz = tz - f[2];
    const d = Math.hypot(dx, dz);
    if (d < 0.04) {
      E.go = null;
      return;
    }
    const want = Math.atan2(dx, dz);
    const turn = Math.atan2(Math.sin(want - f[3]), Math.cos(want - f[3]));
    f[3] += Math.sign(turn) * Math.min(Math.abs(turn), 1.8 * dt);
    const goal = Math.abs(turn) < 0.7 ? Math.min(1.3, 0.25 + d * 1.6) : 0;
    E.go.v += Math.max(-3 * dt, Math.min(2.2 * dt, goal - E.go.v));
    const st = Math.min(d, Math.max(0, E.go.v) * dt);
    f[0] += (dx / d) * st;
    f[2] += (dz / d) * st;
    f[1] = groundAt(f[0], f[2]);
  }

  /**
   * THE CROWD CATCHES IT: the strangers within r m of `who` (the nearest first, none with a dog, none the city or the
   * stage holds) are given places round them, a body's width and more apart on open ground (not in anything, not on the
   * road, on their level), each the place nearest it that it can walk to in a straight line; they catch the colour at
   * once, one after another (`ripple` s apart), walk over and dance there, facing in. While `who` has the look, a
   * stranger who passes within `pass` m catches it too, until there are n: the patch fills as people go by. → the
   * walker ids of the first ones.
   * (pot-3) THE CROWD ROUND THE PLAYER IS THINNED on the street (actors.js THIN: 40 in 100 within 30 m), so fewer than n
   * are near: whoever is short is looked for further out, to `far` m (at the start and every second while it is short), on
   * a straight way clear of anything solid and of the roadway, and walks over from there (out of the picture,
   * most of them: nobody appears or vanishes in it). `placed`: only under a black picture (the place entered with
   * somebody already dancing there): each is put on its place at once, a few seconds into the dance. Asked again for the
   * same dancer, the patch before is let go (its strangers dance on until they are let go with it).
   */
  function crowd(who, name, { n = 10, r = 16, far = 60, pass = 9, ripple = 0.3, rings = [1.6, 2.75, 3.9, 5.0, 6.2, 7.4], placed = false } = {}) {
    const f = find(who);
    if (!f) return [];
    for (let k = catchers.length - 1; k >= 0; k--) {
      if (catchers[k].src !== f.w) continue;
      for (let i = pending.length - 1; i >= 0; i--) if (pending[i].C === catchers[k]) pending.splice(i, 1);
      catchers.splice(k, 1);
    }
    const [cx, cy, cz] = [f.w.p[0], f.w.p[1], f.w.p[2]];
    const open = (x, z) => !actors.solidAt?.(x, z) && !(actors.inRoad?.(x, z)) && Math.abs(groundAt(x, z) - cy) < 0.1 && !actors.lowNear?.(x, z, 0.35);
    // (whoever else stands there now: the stage's people and anybody held)
    const standing = sim.walkers.filter(w => !w.gone && !w.hide && (w.fix || w.hk2) && w !== f.w).map(w => [w.p[0], w.p[2]]);
    const spots = [];
    for (const rr of rings) {
      const m = Math.max(4, Math.round((2 * Math.PI * rr) / 1.4));
      const off = hash(Math.round(rr * 10) + f.w.id) * 6.28;
      for (let k = 0; k < m; k++) {
        const a = off + (k / m) * 2 * Math.PI;
        const [x, z] = [cx + Math.sin(a) * rr, cz + Math.cos(a) * rr];
        if (!open(x, z)) continue;
        if ([...standing, ...spots].some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 1.35)) continue;
        spots.push([x, z]);
      }
    }
    const C = { src: f.w, name, n, pass, far, ripple, spots, c: [cx, cz], ids: [], next: 0, nextFar: 0, placed };
    // (strangers still dancing round them from the patch before stay, and count)
    for (const E of on.values()) if (E.C?.src === f.w && !E.releasing && E.end === null) E.C = C;
    catchers.push(C);
    catchFrom(C, r);
    if (liveOf(C) < n) catchFrom(C, far);
    C.placed = false;
    return C.ids.slice();
  }
  const catchers = [];
  /** How many strangers a patch has now: dancing, walking over, or about to catch it. */
  const liveOf = C => {
    let k = 0;
    for (const E of on.values()) if (E.C === C && !E.releasing && E.end === null) k++;
    for (const q of pending) if (q.C === C) k++;
    return k;
  };
  const clearWay = (ax, az, bx, bz) => {
    const d = Math.hypot(bx - ax, bz - az);
    const step = d > 12 ? 0.5 : 0.35;
    for (let s2 = step; s2 < d; s2 += step) {
      const [x, z] = [ax + ((bx - ax) * s2) / d, az + ((bz - az) * s2) / d];
      // (pot-3: nor over a roadway: one fetched from across the street walked straight through the traffic)
      if (actors.solidAt?.(x, z) || actors.lowNear?.(x, z, 0.25) || actors.inRoad?.(x, z)) return false;
    }
    return true;
  };
  const free = w => !w.gone && !w.hide && !w.agent && !w.hk2 && w.dog < 0 && !w.off && !w.fix && !w.gore && !w.cleaner && !w.stagePose && w.p && !on.has(w) && !pending.some(q => q.w === w);
  /**
   * Strangers within r of the patch's middle catch it, the nearest first, while it has places and wants more. (pot-3:
   * a few of them a call, each tried on its three nearest places only: looked for out to 60 m, every stranger on every
   * place was a frame of 116 ms)
   */
  function catchFrom(C, r) {
    const [cx, cz] = C.c;
    const near = sim.walkers.filter(free).map(w => [w, Math.hypot(w.p[0] - cx, w.p[2] - cz)]).filter(([, d]) => d <= r).sort((a, b) => a[1] - b[1]);
    let k = 0;
    let tried = 0;
    C.no ??= new WeakMap();
    for (const [w] of near) {
      if (liveOf(C) >= C.n || !C.spots.length || (!C.placed && tried >= 10)) break;
      // (one with no clear way over a moment ago is not asked again for a few seconds: the next ones are)
      if (!C.placed && (C.no.get(w) ?? -1) > clock) continue;
      tried++;
      const order = C.spots.map((p, i) => [i, Math.hypot(p[0] - w.p[0], p[1] - w.p[2])]).sort((a, b) => a[1] - b[1]).slice(0, 3);
      const pick = C.placed ? order[0] : order.find(([i]) => clearWay(w.p[0], w.p[2], C.spots[i][0], C.spots[i][1]));
      if (!pick) {
        C.no.set(w, clock + 4);
        continue;
      }
      const [to] = C.spots.splice(pick[0], 1);
      if (C.placed) {
        // (under the black: on its place now, facing in, some seconds into the dance)
        if (on_(w, C.name, { crowd: true, face: C.c, at: to, t: 3 + 5 * hash(w.id + 7), C })) C.ids.push(w.id);
        continue;
      }
      pending.push({ at: clock + k * C.ripple + 0.12 * hash(w.id), w, name: C.name, face: C.c, to, C });
      C.ids.push(w.id);
      k++;
    }
  }
  const pending = [];

  // ── the frame: after the stage has placed everybody, before the city draws ───────────────────────────────────
  actors.onFrame(dt => {
    clock += dt;
    if (!on.size && !pending.length && !catchers.length) {
      bits.update(dt, groundAt);
      return;
    }
    const T0 = performance.now();
    // (a patch that is still on and short of strangers takes whoever passes near it)
    for (let k = catchers.length - 1; k >= 0; k--) {
      const C = catchers[k];
      const S = on.get(C.src);
      if (!S || S.end !== null || C.src.gone) {
        // (its look is going: nobody still waiting to catch it does)
        catchers.splice(k, 1);
        for (let i = pending.length - 1; i >= 0; i--) if (pending[i].C === C) pending.splice(i, 1);
        continue;
      }
      if (clock >= C.next && !C.src.hide && liveOf(C) < C.n) {
        C.next = clock + 0.5;
        catchFrom(C, C.pass);
        // (pot-3: still short, the crowd thinned round the player: whoever has come within `far` since, now and then)
        if (clock >= C.nextFar && liveOf(C) < C.n) {
          C.nextFar = clock + 1;
          catchFrom(C, C.far);
        }
      }
    }
    for (let k = pending.length - 1; k >= 0; k--) {
      const q = pending[k];
      if (clock < q.at) continue;
      pending.splice(k, 1);
      if (!q.w.gone && !q.w.off) on_(q.w, q.name, { crowd: true, face: q.face, to: q.to, C: q.C });
    }
    for (const E of [...on.values()]) {
      const { w, L } = E;
      if (w.gone) {
        if (E.row !== null) freeRow(E.row);
        on.delete(w);
        continue;
      }
      if (E.go) walk(E, dt);
      if (E.releasing) {
        // (the clip blends out to the stand, then the row is let go and a stranger walks home and on)
        if (clock - E.releasing > 0.35) finishRelease(E);
        continue;
      }
      E.age += dt;
      if (E.go) {
        // (the colour is caught at once; the dance when it gets there)
        if (L.skin && E.skinK < 1) setSkin(E, (E.skinK = Math.min(1, E.age / SKIN_IN)));
        continue;
      }
      E.t += dt;
      if (E.end !== null) E.end += dt;
      const M = L.move ? MOVES[L.move] : null;
      if (M?.once && E.t >= M.once && E.end === null) E.end = 0;
      if (E.end !== null && E.end >= (M?.exit ?? 0)) {
        release(E);
        continue;
      }
      // the skin, in over SKIN_IN s and out over the ending
      if (L.skin) {
        const k = Math.min(1, E.age / SKIN_IN) * (E.end === null ? 1 : Math.max(0, 1 - E.end / Math.min(SKIN_OUT, M?.exit || SKIN_OUT)));
        if (Math.abs(k - E.skinK) > 0.02 || (k === 1 && E.skinK !== 1) || (k === 0 && E.skinK !== 0)) {
          E.skinK = k;
          setSkin(E, k);
        }
      }
      // a stranger turns, slowly, toward the one they caught it from (a third of the way round at most)
      if (E.crowd && E.face && w.fix && E.end === null) {
        const want = Math.atan2(E.face[0] - w.fix[0], E.face[1] - w.fix[2]);
        const d = Math.atan2(Math.sin(want - w.fix[3]), Math.cos(want - w.fix[3]));
        if (Math.abs(d) > 0.6) w.fix[3] += Math.sign(d) * Math.min(Math.abs(d) - 0.6, 0.9 * dt);
      }
      // the body
      if (M) {
        const P = lookPose(L.move, E.t, E.end, E.K, A0, P0);
        writeRow(E.row, P);
        if (E.A && E.A.want?.name !== LOOK_CLIP && !E.releasing) actors.play(E.A.id, LOOK_CLIP, { loop: true }).catch(() => {});
        // what comes off the body: the spray of a heave
        if (M.events) {
          while (E.events < M.events.length && E.t >= M.events[E.events].at) {
            const ev = M.events[E.events++];
            if (ev.kind === 'puke') {
              const F = fk(P);
              const at = world(E, F.chin);
              const fwd = world(E, [F.chin[0] + F.fwd[0], F.chin[1] + F.fwd[1], F.chin[2] + F.fwd[2]]);
              // (thrown out ahead and down, never straight into the ground at the feet: an arc a camera sees)
              const dir = [fwd[0] - at[0], Math.max(fwd[1] - at[1], -0.12), fwd[2] - at[2]];
              const l = Math.hypot(...dir) || 1;
              bits.throw(ev.n, at, [dir[0] / l, dir[1] / l, dir[2] / l], { speed: ev.speed, cone: 0.7, size: [0.08, 0.15], life: [14, 20], colors: PUKE, grav: 9, drag: 0.6, flat: true, owner: w, spread: 0.06 });
            }
          }
        }
        // steam off the head and shoulders while it is on
        if (L.steam && E.end === null && E.t > 0.3) {
          E.steam += dt * L.steam.rate * Math.min(1, (E.t - 0.3) / 0.6);
          if (E.steam >= 1) {
            const n = Math.floor(E.steam);
            E.steam -= n;
            const F = fk(P);
            // (off the top of the head and out past its sides, rising, spreading and swelling as it goes: a plume the
            // game's camera sees beside the head, not a scatter on it)
            for (let i = 0; i < n; i++) {
              const sd = Math.random() < 0.5 ? -1 : 1;
              const top = Math.random() < 0.35;
              const p = top ? [F.crown[0] + (Math.random() - 0.5) * 0.6, F.crown[1] + 0.05, F.crown[2] + (Math.random() - 0.5) * 0.4] : F.headAt([sd * 0.56, 1.25 + Math.random() * 0.4, (Math.random() - 0.5) * 0.5]);
              const at = world(E, p);
              const out = world(E, [p[0] + sd * (top ? 0.2 : 0.6), p[1], p[2]]);
              const dir = [out[0] - at[0], 1.6, out[2] - at[2]];
              const l = Math.hypot(...dir);
              bits.throw(1, at, [dir[0] / l, dir[1] / l, dir[2] / l], { glow: true, speed: 1.3, cone: 0.35, size: [0.07, 0.12], life: [1.1, 1.8], colors: STEAM, grav: -0.5, drag: 0.7, grow: 1.5, owner: w, spin: 1.5 });
            }
          }
        }
      }
      // over the head
      if (L.icon && E.end === null && E.t >= (L.icon.after ?? 0) && clock >= E.iconAt) {
        // (a stranger's picture a third as often: the named one's is the one that matters)
        E.iconAt = clock + L.icon.every * (0.85 + 0.3 * Math.random()) * (E.crowd ? 3 : 1);
        const k = sizeOf(E);
        let at;
        if (L.icon.at === 'sleep' && M) {
          // (off the sleeper's head where it lies on the ground)
          const F = fk(P0);
          const c = world(E, F.headC);
          at = [c[0], c[1] + 0.55 * k, c[2]];
        } else {
          const F = M ? fk(P0) : null;
          const c = F ? world(E, F.crown) : [w.p[0], w.p[1] + 1.8 * k, w.p[2]];
          at = [c[0], c[1] + 0.3 * k, c[2]];
        }
        // (z's go up and off to the picture's right, as a sleeper's do in a comic: the camera's own right)
        let vel = null;
        if (L.icon.at === 'sleep') {
          const m = city.camera.matrixWorld.elements;
          const rl = Math.hypot(m[0], m[2]) || 1;
          vel = [(m[0] / rl) * 0.3, L.icon.rise, (m[2] / rl) * 0.3];
        }
        bits.icon(L.icon.kind, at, { rise: L.icon.rise, size: L.icon.size * Math.sqrt(k), life: L.icon.life, color: L.icon.color, owner: w, drift: vel ? 0.08 : 0.22, vel, grow: L.icon.grow ?? 0.6 });
      }
    }
    bits.update(dt, groundAt);
    const ms = performance.now() - T0;
    stats.ms = ms;
    stats.msMax = Math.max(stats.msMax, ms);
    stats.frames++;
  });
  const groundAt = (x, z) => actors.groundAt(x, z);

  // ── the walker's gait step: the look's row and clip on a stranger, the head held calm ─────────────────────
  const animate0 = sim.animate;
  sim.animate = (w, dt, G, fresh) => {
    const E = on.size ? on.get(w) : null;
    const g = animate0(w, dt, G, fresh);
    if (!g || !E || E.row === null || (E.go && !E.releasing)) return g;
    g.look = E.row;
    // (a body posed by hand has no head springs and no lead into a turn of the city's: the look keys its head)
    g.hp = 0;
    g.hv = 0;
    g.hr = 0;
    g.hrv = 0;
    g.omega = 0;
    if (!E.A) {
      if (!E.releasing && (g.clip?.name !== LOOK_CLIP || g.clip.out)) CLIPS.playClip(g, LOOK_CLIP, { t: 0, loop: true });
      if (g.clip) CLIPS.stepClip(g, dt);
      g.w = 0;
    }
    return g;
  };

  /**
   * (pot-3) Is a dance within r m of (x, z) catching the crowd, or danced round by it? (The stage keeps the crowd there
   * at its own number for as long: actors.js THIN, `thinHold`.)
   */
  function crowdNear(x, z, r) {
    for (const C of catchers) if (!C.src.hide && Math.hypot(C.c[0] - x, C.c[1] - z) <= r) return true;
    for (const E of on.values()) if (E.C && !E.releasing && Math.hypot(E.C.c[0] - x, E.C.c[1] - z) <= r) return true;
    return false;
  }
  /** (pot-3) The strangers who caught a look from `who` let go with them: they wind down and walk back to their lanes. */
  function offCrowd(who, { now = false } = {}) {
    const f = find(who);
    if (!f) return 0;
    let k = 0;
    for (let i = catchers.length - 1; i >= 0; i--) {
      if (catchers[i].src !== f.w) continue;
      for (let j = pending.length - 1; j >= 0; j--) if (pending[j].C === catchers[i]) pending.splice(j, 1);
      catchers.splice(i, 1);
    }
    for (const E of [...on.values()]) if (E.C?.src === f.w && E.end === null && !E.releasing) k += off(E.w, { now }) ? 1 : 0;
    return k;
  }
  /** (pot-3) What a body under a look is doing now, for the checks: the look, how far into it, its head off the ground (m). */
  function bodyOf(who) {
    const f = find(who);
    const E = f && on.get(f.w);
    if (!E) return null;
    const k = sizeOf(E);
    let head = null;
    if (E.L.move) {
      const F = fk(lookPose(E.L.move, E.t, E.end, E.K, A0, pose0()));
      head = world(E, F.headC)[1] - groundAt(E.w.p[0], E.w.p[2]);
    }
    let crowdN = 0;
    for (const Q of on.values()) if (Q.C?.src === E.w && !Q.releasing && Q.end === null) crowdN++;
    return { look: E.name, t: +E.t.toFixed(2), end: E.end === null ? null : +E.end.toFixed(2), head: head === null ? null : +head.toFixed(3), lying: head !== null && head < 0.75 * k, skin: !!peds.fx?.get?.(E.w), crowd: crowdN, going: !!E.go, releasing: !!E.releasing, size: k, at: [+E.w.p[0].toFixed(2), +E.w.p[2].toFixed(2)] };
  }
  /**
   * (pot-3) The pocket of a body under a look, in the world: on a sleeper, the top of the hip that is up. → { at, across }:
   * `across` the level way through the body there (its front: a sleeper lies along their own side-to-side), to stand by.
   */
  function pocketOf(who) {
    const f = find(who);
    const E = f && on.get(f.w);
    if (!E || !E.L.move) return null;
    const F = fk(lookPose(E.L.move, E.t, E.end, E.K, A0, pose0()));
    const p = world(E, F.hip);
    const y = yawOf(E);
    return { at: [p[0], p[1] + 0.1 * sizeOf(E), p[2]], across: [Math.sin(y), Math.cos(y)] };
  }

  return {
    LOOKS,
    bodyOf,
    pocketOf,
    offCrowd,
    crowdNear,
    on: on_,
    off,
    crowd,
    has: who => {
      const f = find(who);
      return !!(f && on.has(f.w));
    },
    list: () => [...on.values()].map(E => ({ who: E.id ?? E.w.id, look: E.name, t: +E.t.toFixed(2), end: E.end === null ? null : +E.end.toFixed(2), crowd: E.crowd, row: E.row, going: !!E.go, releasing: !!E.releasing, tries: E.tries ?? 0, moves: E.moves ?? 0, fix: E.fix, off: E.w.off, home: E.home ? E.home.map(v => +v.toFixed(2)) : null, at: [+E.w.p[0].toFixed(2), +E.w.p[2].toFixed(2)] })),
    stats: () => ({ people: [...on.values()].filter(E => !E.crowd).length, strangers: [...on.values()].filter(E => E.crowd).length, pending: pending.length, bits: bits.stats(), ms: +stats.ms.toFixed(3), msMax: +stats.msMax.toFixed(3) }),
    bits,
  };
}
