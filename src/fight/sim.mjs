// THE FIGHT AS A SIMULATION: plain data and a step function, seeded, no browser (the page, demo/fight/, draws it; an
// AI player or the balance table runs it headless with a movement policy, policies.mjs).
//
//   const F = createFight({ build, level, seed })   build: { weapon, gear: [...], ally, earl }; level: 'easy' | 'real' |
//                                                   'hard', or a street fight's (data.mjs STREET: 'jumped', ...)
//   step(F, { x, y })                               one TICK; the move is the player's hands (-1..1 each way, arena frame)
//   F.over                                          null, or { result: 'won' | 'lost' | 'left' | 'timeout', t }
//   F.events                                        everything that happened, in order (the page plays them)
//   runFight({ build, level, seed, policy })        to the end, headless → F
//   createFight({ duel, seed, arena })              A ONE-ON-ONE (the run's fights, duel.mjs): you and one of them, no
//                                                   waves, both moving by the brawl (brawl.mjs); `duel.cap` seconds at
//                                                   most, and at the cap the one with more health left wins; never
//                                                   a gun (fight-3: a one-on-one is a street fight)
//
// (fight-3) THE DOORMAN's shell takes everyone in its cone (blast); THE LONG-EYE shoots worse with one of them on top
// of it; a blow can HOLD (the throw puts them down, the grab holds you both); a one-on-one's foe brings a style
// (data.mjs RIVALS: `reel`, `heft`, `soak`, `slip`); COUSIN EARL fights the way he is told (data.mjs EARL_WAYS, earlsWay).
// What was there before plays as it did, tick for tick (but "built", whose numbers changed).
//
// The player's hands only MOVE them: whoever is up attacks by themselves, the nearest in reach or in range. The same
// seed and the same moves give the same fight: every roll comes from F.rs, a number kept in the fight itself.
import { hash32 } from '../rng.mjs';
import { TICK, CAP, BODY, ARENA, YARD, WEAPONS, GEAR, YOU, ALLY, EARL_WAYS, FOES, THINGS, POCKET, levelOf } from './data.mjs';
import { brawlMove, BRAWL } from './brawl.mjs';

/** The next roll of the fight's own stream, 0 to 1 (mulberry32 on F.rs). */
function roll(F) {
  F.rs = (F.rs + 0x6d2b79f5) | 0;
  let t = Math.imul(F.rs ^ (F.rs >>> 15), 1 | F.rs);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (F, [lo, hi]) => lo + Math.floor(roll(F) * (hi - lo + 1));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = v => Math.round(v * 10) / 10;

/** A person of the fight. */
function person(id, side, kind, name, x, y, hp, speed, weapon) {
  const W = WEAPONS[weapon];
  return {
    id, side, kind, name, x, y, face: 0, vx: 0, vy: 0, hp, max: hp, speed,
    arm: weapon, gun: W.kind === 'gun' ? weapon : null, mag: W.mag ?? 0, rounds: W.rounds ?? 0,
    reload: 0, reloadOf: 0, cd: 0.3, reel: 0, pin: 0, free: 0, down: false, downAt: null, in: true, cut: 0, hits: 1, target: null,
  };
}

/**
 * A new fight. `arena` is the level's own ground (ARENA; the yard for the Sixes' fights) unless the page or a test
 * gives another. `waves`: a test's own, under a level name of its own (the balance study's one kind at a time).
 */
export function createFight({ build, level = 'real', seed = 1, arena = null, duel = null, waves = null }) {
  if (duel) return createDuelFight({ duel, seed, arena: arena ?? ARENA });
  const L = waves ? { waves } : levelOf(level);
  if (!L) throw new Error(`fight: no level ${level}`);
  arena ??= L.ground === 'yard' ? YARD : ARENA;
  if (!WEAPONS[build.weapon]) throw new Error(`fight: no weapon ${build.weapon}`);
  if (build.earl && !EARL_WAYS[build.earl]) throw new Error(`fight: Earl has no way ${build.earl}`);
  const gear = new Set(build.gear ?? []);
  const me = person('you', 'you', 'you', YOU.name, arena.start[0], arena.start[1], YOU.hp + (gear.has('strength') ? GEAR.strength.health : 0), YOU.speed * (gear.has('shoes') ? GEAR.shoes.speed : 1), build.weapon);
  me.cut = gear.has('vest') ? GEAR.vest.cut : 0;
  me.hits = gear.has('strength') ? GEAR.strength.hits : 1;
  me.face = -Math.PI / 2;
  const people = [me];
  if (build.ally) {
    const E = person(ALLY.id, 'ally', 'ally', ALLY.name, arena.start[0] - 1.4, arena.start[1] + 0.6, ALLY.hp, ALLY.speed, ALLY.weapon);
    people.push(E);
  }
  const F = {
    // (Earl's way kept only when he is there and told other than his old one: an old build's fight is the same object)
    t: 0, tick: 0, seed, level, waves: L.waves, build: { weapon: build.weapon, gear: [...gear], ally: !!build.ally, ...(build.ally && build.earl && build.earl !== 'side' ? { earl: build.earl } : {}) }, arena,
    rs: hash32(`fight|${level}|${seed}`) | 0,
    people, loot: [], events: [], over: null, armed: false, wave: 0, nextId: 1, lootId: 1,
    stats: {
      dmgTaken: 0, dmgShot: 0, dmgMelee: 0, dmgReloading: 0, dmgBeforeDrop: 0, firstDropT: null, firstHitT: null, firstMeleeT: null,
      drops: [], dealt: 0, shots: 0, shotsHit: 0, swings: 0, swingsHit: 0, mostAtOnce: 0, reloadTime: 0,
      allyDown: false, dryT: null, picked: { cash: 0, rounds: 0, things: [] }, foes: L.waves.length, moved: 0,
    },
  };
  return F;
}

/**
 * A ONE-ON-ONE: you (`duel.you`: weapon, hp, max, hits) and one of them (`duel.foe`: id, name, weapon, hp, speed, hits,
 * and a style's reel, heft, soak, slip: data.mjs RIVALS), each where the arena says (`start`, `foeStart`), facing each
 * other; nobody comes in, nothing is dropped, and nobody leaves. `duel.brawl` the brawl's numbers (brawl.mjs BRAWL),
 * `duel.cap` the most seconds it lasts. A street fight: hands, a blade, knuckles; a gun on either side is refused.
 */
function createDuelFight({ duel, seed, arena }) {
  const Y = duel.you;
  // (styles-1: `duel.foes`, SEVERAL OF THEM on the one-on-one's terms: getting jumped in the run, two at once. Each is
  // a foe as `duel.foe` is, at the arena's `foeStarts[i]`; all brawl at you. One foe plays exactly as before)
  const list = duel.foes ?? [duel.foe];
  const starts = duel.foes ? arena.foeStarts : [arena.foeStart];
  for (const T of list) if (!WEAPONS[T.weapon]) throw new Error(`fight: no weapon ${T.weapon}`);
  if (!WEAPONS[Y.weapon]) throw new Error(`fight: no weapon ${Y.weapon}`);
  // (raid-1: `duel.guns`, the raid on your home: a gun in YOUR hands only; theirs never)
  // (raid-1: and a shooter of theirs, who hangs back and shoots as the stop's shooters do: FOES.shooter's `keep`)
  if (!duel.guns && (WEAPONS[Y.weapon].kind === 'gun' || list.some(T => WEAPONS[T.weapon].kind === 'gun'))) throw new Error('fight: no gun in a one-on-one');
  const me = person('you', 'you', 'you', YOU.name, arena.start[0], arena.start[1], Y.hp, Y.speed ?? YOU.speed, Y.weapon);
  me.max = Y.max ?? YOU.hp;
  me.hits = Y.hits ?? 1;
  // (raid-1: a gun's rounds are what you own of them, `you.rounds`, all of it: a magazine's worth in it, the rest to
  // reload from; run dry, you fight on with `you.dry` (what you fight with, at `hits`), not bare hands. `you.cut`: the
  // share of every hit on you taken off (the stab vest). `you.holdFire`: a gun holds its fire until the nearest of them
  // is this close (m: the Doorman waits for them to bunch at the door). Left out, nothing changes)
  if (me.gun && Y.rounds !== undefined) {
    me.mag = Math.min(WEAPONS[me.gun].mag, Y.rounds);
    me.rounds = Y.rounds - me.mag;
  }
  if (Y.dry) me.dryArm = Y.dry;
  if (Y.cut) me.cut = Y.cut;
  if (Y.holdFire) me.holdFire = Y.holdFire;
  const them = list.map((T, i) => {
    const [fx, fy] = starts[i] ?? starts[starts.length - 1];
    const foe = person(T.id ?? (i ? `f${i + 1}` : 'f1'), 'foe', T.kind ?? 'heavy', T.name ?? 'them', fx, fy, T.hp, T.speed ?? FOES.heavy.speed, T.weapon);
    foe.max = T.max ?? T.hp;
    foe.hits = T.hits ?? 1;
    // (their style's, when the run gives one: how long a blow of yours staggers them, how much of its throw they take,
    // the points they soak off it, the share of a hold they take)
    if (T.reel !== undefined) foe.stagger = T.reel;
    if (T.heft !== undefined) foe.heft = T.heft;
    if (T.soak !== undefined) foe.soak = T.soak;
    if (T.slip !== undefined) foe.slip = T.slip;
    foe.in = true;
    return foe;
  });
  const foe = them[0];
  me.face = Math.atan2(foe.y - me.y, foe.x - me.x);
  for (const q of them) q.face = Math.atan2(me.y - q.y, me.x - q.x);
  // (sixes-1: `duel.ally`, COUSIN EARL AT YOUR DOOR: { hp, weapon, way, hits, speed }, beside you at the arena's
  // `allyStart`, told his way (EARL_WAYS); he fights as the study's Earl does, his blows on the one-on-one's terms.
  // Last in the list, so a fight without him is the same fight tick for tick)
  const al = duel.ally ?? null;
  if (al && !EARL_WAYS[al.way ?? 'side']) throw new Error(`fight: Earl has no way ${al.way}`);
  const E = al ? person(ALLY.id, 'ally', 'ally', ALLY.name, ...(arena.allyStart ?? [arena.start[0] - 1.2, arena.start[1]]), al.hp ?? ALLY.hp, al.speed ?? ALLY.speed, al.weapon ?? ALLY.weapon) : null;
  if (E) {
    E.hits = al.hits ?? 1;
    E.face = me.face;
  }
  const F = {
    t: 0, tick: 0, seed, level: 'duel', build: { weapon: Y.weapon, gear: [], ally: !!E, ...(E && al.way && al.way !== 'side' ? { earl: al.way } : {}) }, arena,
    duel: { cap: duel.cap ?? CAP, hit: duel.hit ?? null, brawl: { ...BRAWL, ...(duel.brawl ?? {}) }, foe: foe.id, ...(duel.foes ? { foes: them.map(q => q.id) } : {}) },
    rs: hash32(`fight|duel|${seed}`) | 0,
    people: [me, ...them, ...(E ? [E] : [])], loot: [], events: [], over: null, armed: false, wave: 0, nextId: 1, lootId: 1,
    stats: {
      dmgTaken: 0, dmgShot: 0, dmgMelee: 0, dmgReloading: 0, dmgBeforeDrop: 0, firstDropT: null, firstHitT: null, firstMeleeT: null,
      drops: [], dealt: 0, shots: 0, shotsHit: 0, swings: 0, swingsHit: 0, mostAtOnce: 0, reloadTime: 0,
      allyDown: false, dryT: null, picked: { cash: 0, rounds: 0, things: [] }, foes: them.length, moved: 0,
    },
  };
  // (each squares up a beat before the first blow can come)
  me.cd = 0.3 + roll(F) * 0.3;
  for (const q of them) q.cd = 0.3 + roll(F) * 0.3;
  if (E) E.cd = 0.3 + roll(F) * 0.3;
  // (sixes-1: the door bar, `duel.firstHurt`: the first of them through a barred door is hurt breaking it)
  if (duel.firstHurt) {
    const q = them[0];
    q.hp = Math.max(1, q.hp - duel.firstHurt);
  }
  // (raid-1: the pepper fogger, `duel.blind`: every one of them comes in blind for that many seconds, slowed and unable
  // to hit; left out, nothing changes)
  if (duel.blind) for (const q of them) q.reel = Math.max(q.reel, duel.blind);
  // (bench-1: a bottle thrown first. `duel.asleep` { n, s, at }: the first n of them asleep from `at` for s seconds (no
  // step, no blow); `duel.slow` { s, by, at }: every one of them at `by` of their speed, from `at` for s seconds (they
  // dance). Left out, nothing changes: no field is set, and the fight is the same tick for tick)
  if (duel.asleep) for (const q of them.slice(0, duel.asleep.n ?? 1)) q.sleep = [duel.asleep.at ?? 0, (duel.asleep.at ?? 0) + duel.asleep.s];
  if (duel.slow) for (const q of them) q.slow = [duel.slow.at ?? 0, (duel.slow.at ?? 0) + duel.slow.s, duel.slow.by];
  return F;
}

const you = F => F.people[0];
const allyOf = F => F.people.find(p => p.side === 'ally') ?? null;
const foes = F => F.people.filter(p => p.side === 'foe');
const up = p => !p.down;
const hostile = (a, b) => (a.side === 'foe') !== (b.side === 'foe');
const say = (F, type, o = {}) => F.events.push({ t: Math.round(F.t * 100) / 100, type, ...o });

/** One TICK of the fight, with the player's move { x, y } (arena frame, each -1..1). */
export function step(F, move = { x: 0, y: 0 }) {
  if (F.over) return F;
  const dt = TICK;
  F.t = +(F.t + dt).toFixed(6);
  F.tick += 1;
  if (!F.duel) spawn(F);
  const me = you(F);
  // ── who goes where ──
  for (const p of F.people) {
    if (p.down) {
      p.vx = p.vy = 0;
      continue;
    }
    p.reel = Math.max(0, p.reel - dt);
    p.pin = Math.max(0, p.pin - dt);
    p.free = Math.max(0, p.free - dt);
    p.cd -= dt;
    if (p.reload > 0) {
      p.reload -= dt;
      if (p === me) F.stats.reloadTime += dt;
      if (p.reload <= 0) finishReload(F, p);
    }
    let [mx, my] = p === me ? [move.x ?? 0, move.y ?? 0] : round(F, p, think(F, p));
    const n = Math.hypot(mx, my);
    if (n > 1) [mx, my] = [mx / n, my / n];
    // (one held, or holding on, does not move)
    let v = p.pin > 0 ? 0 : p.speed * (p.reel > 0 ? 0.45 : 1);
    // (bench-1: asleep on a bottle's bag, no step; dancing, slowed. Only on one a bottle reached)
    if (p.sleep && F.t >= p.sleep[0] && F.t < p.sleep[1]) v = 0;
    else if (p.slow && F.t >= p.slow[0] && F.t < p.slow[1]) v *= p.slow[2];
    p.vx = mx * v;
    p.vy = my * v;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (n > 0.05) p.face = Math.atan2(my, mx);
    if (p === me) F.stats.moved += Math.hypot(p.vx, p.vy) * dt;
  }
  apart(F);
  // ── the stairs: walked back onto, the fight is left ──
  const [ex, ey] = F.arena.exit;
  const atExit = Math.hypot(me.x - ex, me.y - ey) < F.arena.exitR;
  if (!atExit && Math.hypot(me.x - ex, me.y - ey) > F.arena.exitR + 0.6) F.armed = true;
  if (atExit && F.armed && !me.down) return end(F, 'left');
  // ── who hits whom ──
  for (const p of F.people) if (!p.down && !F.over) act(F, p);
  if (F.over) return F;
  // ── what lies on the ground is picked up by walking over it ──
  for (const L of [...F.loot]) {
    if (Math.hypot(me.x - L.x, me.y - L.y) > 0.85) continue;
    F.loot.splice(F.loot.indexOf(L), 1);
    pickUp(F, me, L);
  }
  // (how many were on you at once: foes up within a step of their reach)
  const close = foes(F).filter(f => up(f) && f.in && dist(f, me) - 2 * BODY <= (WEAPONS[f.arm].reach ?? 0) + 0.35).length;
  F.stats.mostAtOnce = Math.max(F.stats.mostAtOnce, close);
  // ── the end ──
  if (F.duel) {
    if (foes(F).every(f => f.down)) return end(F, 'won');
    if (F.t >= F.duel.cap - 1e-9) return capped(F);
    return F;
  }
  if (F.wave >= F.waves.length && foes(F).every(f => f.down)) return end(F, 'won');
  if (F.t >= CAP - 1e-9) return end(F, 'timeout');
  return F;
}

/** They come in, on the level's clock. */
function spawn(F) {
  const waves = F.waves;
  while (F.wave < waves.length && waves[F.wave][0] <= F.t + 1e-9) {
    const [, kind, entry] = waves[F.wave];
    const K = FOES[kind];
    const [x, y] = F.arena.entries[entry % F.arena.entries.length];
    const id = `f${F.nextId++}`;
    const p = person(id, 'foe', kind, K.name, x, y, K.hp, K.speed * (0.94 + roll(F) * 0.12), K.weapon);
    p.in = false;
    p.cd = 0.4 + roll(F) * 0.4;
    F.people.push(p);
    F.wave += 1;
    say(F, 'arrive', { id, kind, name: K.name });
  }
}

/** How a foe or the ally means to move this tick: [mx, my]. */
function think(F, p) {
  p.goal = null;
  const me = you(F);
  const W = WEAPONS[p.arm];
  if (p.side === 'ally') {
    const way = F.build.earl ?? 'side';
    if (way !== 'side') return earlsWay(F, p, me, W, way);
    // EARL: the nearest of them near you, else at your shoulder (his old way, `side`)
    const near = foes(F).filter(f => up(f) && f.in && dist(f, me) < ALLY.leash + 1.5).sort((a, b) => dist(a, p) - dist(b, p))[0];
    p.target = near?.id ?? null;
    if (near) return toward(p, near, W.reach + 2 * BODY - 0.05);
    const d = dist(p, me);
    return d > 1.8 ? toward(p, me, 1.6) : [0, 0];
  }
  // A ONE-ON-ONE: they brawl, as you do (brawl.mjs). (raid-1: one of theirs with a gun keeps back and shoots, below)
  if (F.duel && WEAPONS[p.arm].kind !== 'gun') {
    p.target = me.id;
    return brawlMove(F, p, me, F.duel.brawl);
  }
  // THEM: whoever of you two they want most (you, by their bias)
  const K = FOES[p.kind];
  const pool = F.people.filter(q => q.side !== 'foe' && up(q));
  if (!pool.length) return [0, 0];
  const T = pool.sort((a, b) => dist(p, a) / (a.side === 'you' ? K.bias : 1) - dist(p, b) / (b.side === 'you' ? K.bias : 1))[0];
  p.target = T.id;
  if (W.kind === 'gun') {
    const d = dist(p, T);
    const [lo, hi] = K.keep;
    if (!p.in) return toward(p, { x: clamp(p.x, 1, F.arena.w - 1), y: clamp(p.y, 1, F.arena.h - 1) }, 0);
    if (d < lo) {
      // backs off, and along the wall when the wall is behind
      let [ax, ay] = [(p.x - T.x) / (d || 1), (p.y - T.y) / (d || 1)];
      if ((p.x < 1.2 && ax < 0) || (p.x > F.arena.w - 1.2 && ax > 0)) ax = 0;
      if ((p.y < 1.2 && ay < 0) || (p.y > F.arena.h - 1.2 && ay > 0)) ay = 0;
      if (Math.hypot(ax, ay) < 0.3) return [-(T.y - p.y) / (d || 1), (T.x - p.x) / (d || 1)];
      return [ax, ay];
    }
    if (d > Math.min(hi, W.range - 0.5)) return toward(p, T, hi - 0.5);
    return [0, 0];
  }
  // (a runner comes in a little off the straight line: from the side)
  return toward(p, T, W.reach + 2 * BODY - 0.05);
}

/**
 * COUSIN EARL TOLD ANOTHER WAY (data.mjs EARL_WAYS): `front`, `hunt` or `block`. → his move this tick. `p.target` is
 * whom he goes for and `p.goal` where he means to stand (the page shows both).
 */
function earlsWay(F, p, me, W, way) {
  const reach = W.reach + 2 * BODY - 0.05;
  const them = foes(F).filter(f => up(f) && f.in);
  const hitters = them.filter(f => WEAPONS[f.arm].kind !== 'gun');
  const byMe = (a, b) => dist(a, me) - dist(b, me);
  const shoulder = () => (dist(p, me) > 1.8 ? toward(p, me, 1.6) : [0, 0]);
  /** To a spot `out` m from you toward q, and stand there. */
  const stepOut = (q, out) => {
    const d = dist(q, me) || 1;
    const spot = { x: me.x + ((q.x - me.x) / d) * out, y: me.y + ((q.y - me.y) / d) * out };
    return toward(p, spot, 0.15);
  };
  if (way === 'front') {
    // OUT IN FRONT: a step in front of you toward the nearest who hits; one already on him or on you he fights there
    const t = hitters.slice().sort(byMe)[0];
    p.target = t?.id ?? null;
    if (!t) return shoulder();
    if (dist(t, p) <= reach + 0.1 || dist(t, me) < 1.4) return toward(p, t, reach);
    return stepOut(t, 1.2);
  }
  if (way === 'hunt') {
    // GOES HUNTING: the ones who shoot, the nearest to him first, wherever they are; else the one furthest from you
    const guns = them.filter(f => WEAPONS[f.arm].kind === 'gun').sort((a, b) => dist(a, p) - dist(b, p));
    const t = guns[0] ?? them.slice().sort(byMe).reverse()[0];
    p.target = t?.id ?? null;
    return t ? toward(p, t, reach) : shoulder();
  }
  // ONE AT A TIME: with two or more who hit on their way to you, he stands a step and a half out between you and the
  // second nearest and fights him when he comes; one alone, or none who hit, the nearest near you
  const coming = hitters.filter(f => dist(f, me) < ALLY.leash + 4).sort(byMe);
  const t = coming.length >= 2 ? coming[1] : coming[0] ?? them.filter(f => dist(f, me) < ALLY.leash + 1.5).sort(byMe)[0];
  p.target = t?.id ?? null;
  if (!t) return shoulder();
  if (coming.length < 2 || dist(t, p) <= reach + 0.1) return toward(p, t, reach);
  return stepOut(t, 1.5);
}
/** Does the segment a→b pass through the box (x0, y0, x1, y1)? (slab test) */
function crosses(ax, ay, bx, by, [x0, y0, x1, y1]) {
  let [t0, t1] = [0, 1];
  for (const [p, d, lo, hi] of [[ax, bx - ax, x0, x1], [ay, by - ay, y0, y1]]) {
    if (Math.abs(d) < 1e-9) {
      if (p <= lo || p >= hi) return false;
      continue;
    }
    let [u, v] = [(lo - p) / d, (hi - p) / d];
    if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u);
    t1 = Math.min(t1, v);
    if (t0 >= t1) return false;
  }
  return true;
}
/**
 * A move whose way to its goal runs through a post goes round it: to the corner of the post (with a body's room
 * round it) that makes the way shortest and can be walked to straight.
 */
function round(F, p, [mx, my]) {
  const n = Math.hypot(mx, my);
  if (n < 1e-6 || !p.goal) return [mx, my];
  for (const box of F.arena.posts ?? []) {
    let [gx, gy] = p.goal;
    // (what may not be crossed: the box and a body's room round it; the corners walked to stand a little further out)
    // (a body pushed off the box stands just outside this: apart())
    const m = BODY - 0.03;
    const B = [box[0] - m, box[1] - m, box[2] + m, box[3] + m];
    // (a goal in it, someone pressed against it this tick: the side of it they are on)
    if (gx > B[0] && gx < B[2] && gy > B[1] && gy < B[3]) {
      const out = [[gx - B[0], B[0] - 0.01, gy], [B[2] - gx, B[2] + 0.01, gy], [gy - B[1], gx, B[1] - 0.01], [B[3] - gy, gx, B[3] + 0.01]].sort((u, v) => u[0] - v[0])[0];
      [gx, gy] = [out[1], out[2]];
    }
    if (!crosses(p.x, p.y, gx, gy, B)) continue;
    const e = 0.25;
    const corners = [[B[0] - e, B[1] - e], [B[2] + e, B[1] - e], [B[2] + e, B[3] + e], [B[0] - e, B[3] + e]];
    // (the rest of the way from a corner: straight on when it is clear, else round by the next corner either way)
    const rest = k => {
      const [cx, cy] = corners[k];
      if (!crosses(cx, cy, gx, gy, B)) return Math.hypot(gx - cx, gy - cy);
      let r = Infinity;
      for (const j of [(k + 1) % 4, (k + 3) % 4]) {
        const [qx, qy] = corners[j];
        if (!crosses(qx, qy, gx, gy, B)) r = Math.min(r, Math.hypot(qx - cx, qy - cy) + Math.hypot(gx - qx, gy - qy));
      }
      return r;
    };
    let best = null;
    let bestD = Infinity;
    corners.forEach(([cx, cy], k) => {
      if (Math.hypot(cx - p.x, cy - p.y) < 0.05 || crosses(p.x, p.y, cx, cy, B)) return;
      const d = Math.hypot(cx - p.x, cy - p.y) + rest(k);
      if (d < bestD) [best, bestD] = [[cx, cy], d];
    });
    if (!best) continue;
    const d = Math.hypot(best[0] - p.x, best[1] - p.y);
    return [((best[0] - p.x) / d) * n, ((best[1] - p.y) / d) * n];
  }
  return [mx, my];
}

/** A unit move toward q, to stop `gap` metres from its middle. */
function toward(p, q, gap) {
  p.goal = [q.x, q.y];
  const [dx, dy] = [q.x - p.x, q.y - p.y];
  const d = Math.hypot(dx, dy);
  if (d <= gap) return [0, 0];
  const s = Math.min(1, (d - gap) / 0.4);
  return [(dx / d) * s, (dy / d) * s];
}

/** Bodies keep apart, out of the posts, and inside the arena once in it. */
function apart(F) {
  const { w, h, posts } = F.arena;
  const live = F.people.filter(up);
  for (let k = 0; k < live.length; k++) {
    for (let j = k + 1; j < live.length; j++) {
      const [a, b] = [live[k], live[j]];
      const d = dist(a, b);
      const min = 2 * BODY;
      if (d >= min) continue;
      const [ux, uy] = d > 1e-6 ? [(b.x - a.x) / d, (b.y - a.y) / d] : [1, 0];
      const push = (min - d) / 2;
      // (the player gives way least: the hands that move them are the player's)
      const [wa, wb] = a.side === 'you' ? [0.25, 1.75] : b.side === 'you' ? [1.75, 0.25] : [1, 1];
      a.x -= ux * push * wa;
      a.y -= uy * push * wa;
      b.x += ux * push * wb;
      b.y += uy * push * wb;
    }
  }
  for (const p of live) {
    for (const [x0, y0, x1, y1] of posts ?? []) {
      // (out of the box and a body's room round it, the shortest way)
      const [a0, b0, a1, b1] = [x0 - BODY, y0 - BODY, x1 + BODY, y1 + BODY];
      if (p.x <= a0 || p.x >= a1 || p.y <= b0 || p.y >= b1) continue;
      const out = [[p.x - a0, a0, null], [a1 - p.x, a1, null], [p.y - b0, null, b0], [b1 - p.y, null, b1]].sort((u, v) => u[0] - v[0])[0];
      if (out[1] !== null) p.x = out[1];
      else p.y = out[2];
    }
    if (!p.in && p.x > BODY && p.x < w - BODY && p.y > BODY && p.y < h - BODY) p.in = true;
    if (p.in) {
      p.x = clamp(p.x, BODY, w - BODY);
      p.y = clamp(p.y, BODY, h - BODY);
    }
  }
}

/** Whoever is up and ready attacks: the nearest of the other side in reach or in range. */
function act(F, p) {
  const W = WEAPONS[p.arm];
  if (p.reel > 0 || p.reload > 0) return;
  // (bench-1: asleep on a bottle's bag: no blow)
  if (p.sleep && F.t >= p.sleep[0] && F.t < p.sleep[1]) return;
  // (one with no rounds left at all fights on with the fists)
  if (W.kind === 'gun' && p.mag <= 0) {
    if (p.rounds > 0) return startReload(F, p);
    if (p.side === 'you') {
      p.arm = p.dryArm ?? 'hands';
      F.stats.dryT ??= F.t;
      say(F, 'dry', { id: p.id });
    }
    return;
  }
  const others = F.people.filter(q => up(q) && hostile(p, q) && (q.side !== 'foe' || q.in || W.kind === 'gun'));
  let best = null;
  let bestD = Infinity;
  for (const q of others) {
    const d = dist(p, q);
    const ok = W.kind === 'gun' ? d <= W.range : d - 2 * BODY <= W.reach;
    if (ok && d < bestD) [best, bestD] = [q, d];
  }
  if (!best) {
    // (a fist or a blade comes up as they close from afar: a beat between stepping in and the first blow. A step out
    // of reach and back is no fresh start: the blow that was coming still comes)
    const far = others.every(q => dist(p, q) - 2 * BODY > (W.reach ?? 0) + 2);
    if (W.kind !== 'gun' && far) p.cd = Math.max(p.cd, p.side === 'you' ? 0.12 : 0.28);
    return;
  }
  if (p.cd > 0) return;
  // (raid-1: a gun told to hold its fire until they are this close: `you.holdFire`)
  if (W.kind === 'gun' && p.holdFire && bestD > p.holdFire) return;
  p.cd = (1 / W.rate) * (0.92 + roll(F) * 0.16);
  p.face = Math.atan2(best.y - p.y, best.x - p.x);
  const me = you(F);
  if (W.kind === 'gun') {
    p.mag -= 1;
    const moving = Math.hypot(p.vx, p.vy) > 0.5 ? 0.85 : 1;
    // (the Doorman: everyone in its cone)
    if (W.cone) return blast(F, p, best, others, W, moving);
    const dodging = Math.hypot(best.vx, best.vy) > 2.5 ? 0.85 : 1;
    // (the Long-eye with one of them on top of it)
    const close = W.close && others.some(q => dist(p, q) - 2 * BODY <= W.close.r) ? W.close.acc : 1;
    const chance = (W.acc + (W.accFar - W.acc) * clamp(bestD / W.range, 0, 1)) * moving * dodging * close;
    const hit = roll(F) < chance;
    const side = (roll(F) < 0.5 ? -1 : 1) * (0.5 + roll(F) * 0.7);
    const [ux, uy] = [(best.x - p.x) / (bestD || 1), (best.y - p.y) / (bestD || 1)];
    const at = hit ? [r1(best.x), r1(best.y)] : [r1(best.x - uy * side + ux * 1.5), r1(best.y + ux * side + uy * 1.5)];
    if (p === me) {
      F.stats.shots += 1;
      if (hit) F.stats.shotsHit += 1;
    }
    say(F, 'shot', { id: p.id, to: best.id, hit, at, mag: p.mag });
    if (hit) wound(F, p, best, W, 'shot');
    if (p.mag <= 0 && p.rounds > 0) startReload(F, p);
    return;
  }
  if (p === me) F.stats.swings += 1;
  // (a blow at someone already backing out of reach, fast, can miss)
  // (in a one-on-one, `duel.hit` of the blows thrown land, two thirds of that on one backing off fast: a brawl)
  // (`land`: a blow's own share of that: a haymaker is seen coming)
  const fast = Math.hypot(best.vx, best.vy) > 3;
  const hit = roll(F) < (F.duel?.hit ? F.duel.hit * (fast ? 0.65 : 1) : fast ? 0.6 : 0.93) * (W.land ?? 1);
  if (p === me && hit) F.stats.swingsHit += 1;
  say(F, 'swing', { id: p.id, to: best.id, hit, arm: p.arm });
  if (hit) wound(F, p, best, W, 'melee');
}

/**
 * A SHELL OF THE DOORMAN, aimed at the nearest (`best`): everyone of the other side inside its cone (and a body's width
 * round it) and its range, each hit rolled on its own at their distance; full damage to `full` m, less in a straight
 * line to `farDmg` of it at `range`, and thrown back by as much less. The shot's event names everyone it hit
 * (`spread`) and the cone, for the page.
 */
function blast(F, p, best, others, W, moving) {
  const me = you(F);
  const aim = Math.atan2(best.y - p.y, best.x - p.x);
  const cone = (W.cone * Math.PI) / 180;
  const struck = [];
  for (const q of others) {
    const d = dist(p, q);
    if (d > W.range) continue;
    let a = Math.abs(Math.atan2(q.y - p.y, q.x - p.x) - aim);
    if (a > Math.PI) a = 2 * Math.PI - a;
    if (q !== best && a > cone + Math.atan2(BODY, Math.max(d, 1e-6))) continue;
    const dodging = Math.hypot(q.vx, q.vy) > 2.5 ? 0.85 : 1;
    const chance = (W.acc + (W.accFar - W.acc) * clamp(d / W.range, 0, 1)) * moving * dodging;
    if (roll(F) < chance) struck.push([q, d]);
  }
  if (p === me) {
    F.stats.shots += 1;
    if (struck.length) F.stats.shotsHit += 1;
    F.stats.pellets = (F.stats.pellets ?? 0) + struck.length;
  }
  say(F, 'shot', { id: p.id, to: best.id, hit: struck.length > 0, at: [r1(best.x), r1(best.y)], mag: p.mag, spread: struck.map(([q]) => q.id), cone: W.cone });
  for (const [q, d] of struck) {
    if (q.down || F.over) continue;
    const s = d <= W.full ? 1 : 1 - (1 - W.farDmg) * clamp((d - W.full) / (W.range - W.full), 0, 1);
    wound(F, p, q, W, 'shot', s);
  }
  if (p.mag <= 0 && p.rounds > 0 && !F.over) startReload(F, p);
}

function startReload(F, p) {
  const W = WEAPONS[p.gun];
  p.reload = W.reload;
  p.reloadOf = W.reload;
  if (p.arm !== p.gun) p.arm = p.gun;
  say(F, 'reload', { id: p.id, seconds: W.reload });
}
function finishReload(F, p) {
  const W = WEAPONS[p.gun];
  const take = Math.min(W.mag - p.mag, p.rounds);
  p.mag += take;
  if (p.rounds !== Infinity) p.rounds -= take;
  p.reload = 0;
  say(F, 'reloaded', { id: p.id, mag: p.mag, rounds: p.rounds === Infinity ? null : p.rounds });
}

/** A blow or a shot lands on q, from p (`scale`: the share of its damage and its throw, the Doorman's at a distance). */
function wound(F, p, q, W, how, scale = 1) {
  const me = you(F);
  const mult = W.kind === 'gun' ? 1 : p.hits;
  // (`soak`, a style's: points off every blow that lands, never below 1; a throw's slam is the ground's, unsoaked)
  const dmg = Math.max(1, Math.round(between(F, W.dmg) * mult * scale * (1 - q.cut)) - (W.slam ? 0 : q.soak ?? 0));
  q.hp = Math.max(0, q.hp - dmg);
  // (thrown back, the way the blow went; a leader barely, a style by its `heft`)
  const d = dist(p, q) || 1;
  const knock = W.knock * scale * (q.heft ?? (q.kind === 'boss' ? 0.3 : 1));
  q.x += ((q.x - p.x) / d) * knock;
  q.y += ((q.y - p.y) / d) * knock;
  q.reel = q.stagger ?? (q.side === 'foe' ? FOES[q.kind].reel : 0.28);
  // A HOLD (the throw, the grab): held, they cannot hit back or move; a leader for `holdBoss` of it, a style for its
  // `slip`. Once it is over they cannot be held again for `free` s, so nobody is held for good. The throw leaves you on
  // your feet; the grab holds the one who grabs as long
  if (W.hold && !(q.free > 0)) {
    const h = W.hold * (q.kind === 'boss' ? W.holdBoss ?? 0.4 : 1) * (q.slip ?? 1);
    q.reel = Math.max(q.reel, h);
    q.pin = Math.max(q.pin, h);
    q.free = h + (W.free ?? 0);
    if (W.holdSelf !== false) p.pin = Math.max(p.pin, h);
  }
  if (q === me) {
    const S = F.stats;
    S.dmgTaken += dmg;
    if (how === 'shot') S.dmgShot += dmg;
    else S.dmgMelee += dmg;
    if (me.reload > 0) S.dmgReloading += dmg;
    if (S.firstDropT === null) S.dmgBeforeDrop += dmg;
    if (S.firstHitT === null) S.firstHitT = F.t;
    if (how === 'melee' && S.firstMeleeT === null) S.firstMeleeT = F.t;
  }
  if (p === me || p.side === 'ally') F.stats.dealt += dmg;
  say(F, 'hit', { id: q.id, by: p.id, dmg, how, bleed: W.bleed, hp: q.hp });
  if (q.hp <= 0) fall(F, q, p, how);
}

function fall(F, q, p, how) {
  q.down = true;
  q.downAt = F.t;
  q.reel = 0;
  q.reload = 0;
  say(F, 'down', { id: q.id, by: p.id, how });
  if (q.side === 'you') return end(F, 'lost');
  if (q.side === 'ally') {
    F.stats.allyDown = true;
    return;
  }
  const S = F.stats;
  S.drops.push({ id: q.id, kind: q.kind, t: r1(F.t), by: p.id });
  if (S.firstDropT === null) S.firstDropT = F.t;
  if (!F.duel) drop(F, q);
}

/** What the fallen leave on the ground: cash always, rounds sometimes, now and then a thing. */
function drop(F, q) {
  const K = FOES[q.kind].loot;
  const spot = () => {
    const a = roll(F) * Math.PI * 2;
    const r = 0.5 + roll(F) * 0.5;
    return [clamp(q.x + Math.cos(a) * r, 0.5, F.arena.w - 0.5), clamp(q.y + Math.sin(a) * r, 0.5, F.arena.h - 0.5)];
  };
  const put = (kind, o) => {
    const [x, y] = spot();
    const L = { id: `l${F.lootId++}`, kind, x: r1(x), y: r1(y), ...o };
    F.loot.push(L);
    say(F, 'drop', { loot: { ...L }, from: q.id });
  };
  put('cash', { amount: between(F, K.cash) });
  if (roll(F) < K.rounds) put('rounds', { amount: 4 + Math.floor(roll(F) * 5) });
  if (roll(F) < K.thing) {
    const T = THINGS[Math.floor(roll(F) * THINGS.length)];
    put('thing', { thing: T.id, name: T.name });
  }
}

function pickUp(F, me, L) {
  const P = F.stats.picked;
  let text;
  if (L.kind === 'cash') {
    P.cash += L.amount;
    text = `+$${L.amount}`;
  } else if (L.kind === 'rounds') {
    // (a long gun takes its `pick` of a pack: what fits it, its shells or its cartridges)
    const pick = me.gun ? WEAPONS[me.gun].pick : undefined;
    const n = pick ? Math.max(1, Math.round(L.amount * pick)) : L.amount;
    P.rounds += n;
    if (me.gun) {
      me.rounds += n;
      // (back to the gun from the fists)
      if (me.arm !== me.gun && me.mag <= 0) startReload(F, me);
      text = `+${n} rounds`;
    } else text = `+${L.amount} rounds (no gun)`;
  } else {
    const T = THINGS.find(t => t.id === L.thing);
    P.things.push(T.id);
    if (T.heal) {
      const was = me.hp;
      me.hp = Math.min(me.max, me.hp + T.heal);
      text = `${T.name} +${me.hp - was} health`;
    } else text = `+${T.name}`;
  }
  say(F, 'pickup', { id: me.id, loot: { ...L }, text });
}

/** A one-on-one at its cap: the one with more health left wins (a tie is theirs), and the other goes down, spent. */
function capped(F) {
  const me = you(F);
  F.capped = true;
  if (F.duel.foes) {
    // (several: you win at the cap with more health left than all of them still up together; each of them goes down,
    // or you do, by the one of them nearest you)
    const up = foes(F).filter(f => !f.down);
    const won = me.hp > up.reduce((s, f) => s + f.hp, 0);
    if (won) {
      for (const f of up) fall(F, f, me, 'spent');
    } else fall(F, me, up.sort((a, b) => dist(a, me) - dist(b, me))[0], 'spent');
    return end(F, won ? 'won' : 'lost');
  }
  const foe = foes(F)[0];
  const won = me.hp > foe.hp;
  fall(F, won ? foe : me, won ? me : foe, 'spent');
  return end(F, won ? 'won' : 'lost');
}

function end(F, result) {
  if (F.over) return F;
  const me = you(F);
  F.over = { result, t: r1(F.t), hp: me.hp, max: me.max };
  say(F, 'end', { result });
  return F;
}

/** To the end, headless: `policy(F)` → the move each tick (policies.mjs), or `moves`, one per tick (then still). */
export function runFight({ build, level = 'real', seed = 1, policy = null, moves = null, arena = null, waves = null }) {
  const F = createFight({ build, level, seed, arena, waves });
  while (!F.over) step(F, moves ? moves[F.tick] ?? { x: 0, y: 0 } : policy ? policy(F) : { x: 0, y: 0 });
  return F;
}

/** What a fight came to, for the cards (and for an AI player, as words: report.mjs). */
export function outcome(F) {
  const me = you(F);
  const S = F.stats;
  const things = S.picked.things.map(id => THINGS.find(t => t.id === id));
  const worth = things.reduce((s, T) => s + (T.worth ?? 0), 0);
  return {
    result: F.over?.result ?? null,
    seconds: F.over?.t ?? r1(F.t),
    hp: me.hp,
    max: me.max,
    dropped: S.drops.length,
    of: S.foes,
    picked: { cash: S.picked.cash, rounds: S.picked.rounds, things: things.map(T => T.name), worth },
    // (down, they take what you came with, what you picked up, and the gun)
    taken: F.over?.result === 'lost' ? { cash: POCKET + S.picked.cash + worth, gun: me.gun ? WEAPONS[me.gun].name : null } : null,
    allyDown: S.allyDown,
  };
}

export { you, allyOf, foes };
