// THE FIGHT AS A SIMULATION: plain data and a step function, seeded, no browser (the page, demo/fight/, draws it; an
// AI player or the balance table runs it headless with a movement policy, policies.mjs).
//
//   const F = createFight({ build, level, seed })   build: { weapon, gear: [...], ally }; level: 'easy' | 'real' | 'hard'
//   step(F, { x, y })                               one TICK; the move is the player's hands (-1..1 each way, arena frame)
//   F.over                                          null, or { result: 'won' | 'lost' | 'left' | 'timeout', t }
//   F.events                                        everything that happened, in order (the page plays them)
//   runFight({ build, level, seed, policy })        to the end, headless → F
//
// The player's hands only MOVE them: whoever is up attacks by themselves, the nearest in reach or in range. The same
// seed and the same moves give the same fight: every roll comes from F.rs, a number kept in the fight itself.
import { hash32 } from '../rng.mjs';
import { TICK, CAP, BODY, ARENA, WEAPONS, GEAR, YOU, ALLY, FOES, LEVELS, THINGS, POCKET } from './data.mjs';

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
    reload: 0, reloadOf: 0, cd: 0.3, reel: 0, down: false, downAt: null, in: true, cut: 0, hits: 1, target: null,
  };
}

/** A new fight. `arena` is ARENA unless a test gives another. */
export function createFight({ build, level = 'real', seed = 1, arena = ARENA }) {
  const L = LEVELS[level];
  if (!L) throw new Error(`fight: no level ${level}`);
  if (!WEAPONS[build.weapon]) throw new Error(`fight: no weapon ${build.weapon}`);
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
    t: 0, tick: 0, seed, level, build: { weapon: build.weapon, gear: [...gear], ally: !!build.ally }, arena,
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
  spawn(F);
  const me = you(F);
  // ── who goes where ──
  for (const p of F.people) {
    if (p.down) {
      p.vx = p.vy = 0;
      continue;
    }
    p.reel = Math.max(0, p.reel - dt);
    p.cd -= dt;
    if (p.reload > 0) {
      p.reload -= dt;
      if (p === me) F.stats.reloadTime += dt;
      if (p.reload <= 0) finishReload(F, p);
    }
    let [mx, my] = p === me ? [move.x ?? 0, move.y ?? 0] : round(F, p, think(F, p));
    const n = Math.hypot(mx, my);
    if (n > 1) [mx, my] = [mx / n, my / n];
    const v = p.speed * (p.reel > 0 ? 0.45 : 1);
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
  if (F.wave >= LEVELS[F.level].waves.length && foes(F).every(f => f.down)) return end(F, 'won');
  if (F.t >= CAP - 1e-9) return end(F, 'timeout');
  return F;
}

/** They come in, on the level's clock. */
function spawn(F) {
  const waves = LEVELS[F.level].waves;
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
    // EARL: the nearest of them near you, else at your shoulder
    const near = foes(F).filter(f => up(f) && f.in && dist(f, me) < ALLY.leash + 1.5).sort((a, b) => dist(a, p) - dist(b, p))[0];
    p.target = near?.id ?? null;
    if (near) return toward(p, near, W.reach + 2 * BODY - 0.05);
    const d = dist(p, me);
    return d > 1.8 ? toward(p, me, 1.6) : [0, 0];
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
  // (one with no rounds left at all fights on with the fists)
  if (W.kind === 'gun' && p.mag <= 0) {
    if (p.rounds > 0) return startReload(F, p);
    if (p.side === 'you') {
      p.arm = 'hands';
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
  p.cd = (1 / W.rate) * (0.92 + roll(F) * 0.16);
  p.face = Math.atan2(best.y - p.y, best.x - p.x);
  const me = you(F);
  if (W.kind === 'gun') {
    p.mag -= 1;
    const moving = Math.hypot(p.vx, p.vy) > 0.5 ? 0.85 : 1;
    const dodging = Math.hypot(best.vx, best.vy) > 2.5 ? 0.85 : 1;
    const chance = (W.acc + (W.accFar - W.acc) * clamp(bestD / W.range, 0, 1)) * moving * dodging;
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
  const hit = roll(F) < (Math.hypot(best.vx, best.vy) > 3 ? 0.6 : 0.93);
  if (p === me && hit) F.stats.swingsHit += 1;
  say(F, 'swing', { id: p.id, to: best.id, hit, arm: p.arm });
  if (hit) wound(F, p, best, W, 'melee');
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

/** A blow or a shot lands on q, from p. */
function wound(F, p, q, W, how) {
  const me = you(F);
  const mult = W.kind === 'gun' ? 1 : p.hits;
  const dmg = Math.max(1, Math.round(between(F, W.dmg) * mult * (1 - q.cut)));
  q.hp = Math.max(0, q.hp - dmg);
  // (thrown back, the way the blow went; a leader barely)
  const d = dist(p, q) || 1;
  const knock = W.knock * (q.kind === 'boss' ? 0.3 : 1);
  q.x += ((q.x - p.x) / d) * knock;
  q.y += ((q.y - p.y) / d) * knock;
  q.reel = q.side === 'foe' ? FOES[q.kind].reel : 0.28;
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
  drop(F, q);
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
    P.rounds += L.amount;
    if (me.gun) {
      me.rounds += L.amount;
      // (back to the gun from the fists)
      if (me.arm !== me.gun && me.mag <= 0) startReload(F, me);
      text = `+${L.amount} rounds`;
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

function end(F, result) {
  if (F.over) return F;
  const me = you(F);
  F.over = { result, t: r1(F.t), hp: me.hp, max: me.max };
  say(F, 'end', { result });
  return F;
}

/** To the end, headless: `policy(F)` → the move each tick (policies.mjs), or `moves`, one per tick (then still). */
export function runFight({ build, level = 'real', seed = 1, policy = null, moves = null, arena = ARENA }) {
  const F = createFight({ build, level, seed, arena });
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
