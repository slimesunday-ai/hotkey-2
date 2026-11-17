// THE FIGHT'S BODIES IN MOTION: which clip each of them is in, frame by frame, from what the rules say (sim events)
// and are about to say (a look a few ticks ahead). The clips are clips/ (the fight's own) and the cast's falls.
//
//   a gun      held ready, raised on whoever is in range (fight_gun, the look slot's up), the kick of each shot on the
//              tick the rules fire it (fight_fire), and the shot itself on the same frame (fx.js: a flash at the
//              muzzle, a tracer, a puff where it lands)
//   close up   a blow whose wind-up starts BEFORE the rules swing: the page looks LOOK ticks ahead (a copy of the fight
//              stepped with the keys held now: the rules are seeded, so the copy swings when the fight will), and starts
//              the clip CONTACT s before that tick, so the blow lands on the frame the rules apply the damage. A swing
//              nobody saw coming (the keys changed) starts at its contact, on time, without its wind-up (counted: late)
//   hit        fight_flinch (it hurts) or fight_vest (your stab vest took a share of it), rocked away from the blow
//   down       the city's own falls: you and Earl fall_back → lie_hurt; they death_collapse → lie_still, and stay
//   facing     standing, a body faces whoever it is fighting; walking, it faces the way it walks (the legs cannot walk
//              backwards) and the chest, the head and the arm turn to them (the clips' bearing, the look slot)
//
// Nothing here changes the rules: the copy is a copy, its rolls are its own.
import { step, TICK, WEAPONS, FOES } from '../../src/fight/index.mjs';
import { CONTACT } from './clips/index.js';
import { FIRE_D, lookFor, gunMuzzle } from './clips/gun.js';

/** Ticks the page looks ahead for blows (the longest wind-up, and a tick to spare). */
export const LOOK = Math.ceil(Math.max(...Object.values(CONTACT)) / TICK) + 2;
/** The blow each close-up weapon throws. */
export const BLOW = Object.freeze({ hands: 'fight_hook', fists: 'fight_hook', knuckles: 'fight_hook', blade: 'fight_hook', pipe: 'fight_hook', shiv: 'fight_stab' });
const DUR = { fight_hook: 0.5, fight_stab: 0.34, fight_fire: FIRE_D, fight_flinch: 0.42, fight_vest: 0.36 };
/** A body this fast or more runs (the city's run over the walk): index.js RUN_V. */
const RUN_V = 2.9;

/**
 * The blows of the next `ticks` ticks if the keys stay as they are: [{ id, to, t, hit }] (t: the tick the rules swing,
 * the damage moment). A copy of the fight is stepped; the fight itself is not touched.
 */
export function predictBlows(F, move, ticks = LOOK) {
  if (F.over) return [];
  const G = structuredClone({ ...F, events: [] });
  const out = [];
  for (let k = 0; k < ticks && !G.over; k++) {
    step(G, move);
    for (const e of G.events) if (e.type === 'swing') out.push({ id: e.id, to: e.to, t: G.t, hit: e.hit });
    G.events.length = 0;
  }
  return out;
}
/**
 * Where a blow's clip starts so that it lands on the damage tick: `tHit` the rules' swing (fight clock), `now` the
 * fight's clock this frame. → the clip's clock to start at (≥ 0), or null (not yet: the wind-up starts later).
 */
export function windAt(tHit, now, contact) {
  const lead = tHit - now;
  if (lead > contact + 1e-6) return null;
  return Math.max(0, contact - lead);
}

/** The muzzle of the gun in a body's hand, in the world (the clip's own pose of it: clips/gun.js), for a look slot. */
export function muzzleOf(A, look) {
  const m = gunMuzzle(look, 0, A.w.g?.py ?? 0.5);
  const yaw = A.w.yawS ?? A.ry;
  const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
  return [A.w.p[0] + m.p[0] * c + m.p[2] * s, A.w.p[1] + m.p[1], A.w.p[2] - m.p[0] * s + m.p[2] * c];
}

export function createAnimator({ actors, CLIPS, fx, W }) {
  /** sim id → { aid, cur, up, wind, lastHit, target, face } */
  const S = new Map();
  let pred = new Map();
  const stats = { blows: 0, onTime: 0, late: 0, whiffs: 0, shots: 0, flinches: 0, vests: 0, falls: 0 };
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const P = (F, id) => F.people.find(q => q.id === id);
  const yawOf = A => A.w.yawS ?? A.ry;
  const stateOf = (p, aid) => {
    let B = S.get(p.id);
    if (!B) {
      B = { aid, cur: null, up: 0, wind: null, target: null, lastAct: -9, face: null };
      S.set(p.id, B);
    }
    B.aid = aid;
    return B;
  };
  const gunOf = p => p.gun && p.arm === p.gun;
  const clock = A => A.w.g?.clip?.t ?? null;

  /** A one-shot of the fight's (or the cast's) on the body now, at its clock t: weight carried from what is on. */
  function play(B, name, t = 0) {
    if (!actors.has(B.aid)) return;
    const A = actors.get(B.aid);
    const g = A.w.g;
    const W0 = { name, loop: false, t, after: 0, began: actors.clock, walk: true };
    if (g) CLIPS.playClip(g, name, { t, loop: false });
    A.want = W0;
    A.asked = g ? W0 : null;
    B.cur = { name, one: true };
  }
  /** A loop on the body (the gun held, the run), or nothing (null): through the stage's own blend. */
  function hold(B, name) {
    if (!actors.has(B.aid)) return;
    const A = actors.get(B.aid);
    const g = A.w.g;
    const now = g?.clip && !g.clip.out ? g.clip.name : null;
    if (name === null) {
      if (B.cur || now) actors.stop(B.aid);
      B.cur = null;
      return;
    }
    if (now === name && A.want?.name === name) {
      B.cur = { name, one: false };
      return;
    }
    // (out of the shot's kick the gun pose is the same: straight on, no blend)
    if (g && now === 'fight_fire' && name === 'fight_gun') {
      const W0 = { name, loop: true, t: 0, after: 0, began: actors.clock, walk: true };
      CLIPS.playClip(g, name, { t: 0, loop: true });
      A.want = A.asked = W0;
    } else if (A.want?.name !== name) actors.play(B.aid, name, { loop: true }).catch(() => {});
    B.cur = { name, one: false };
  }
  /** Is the body's one-shot still playing (its own clock under its length)? */
  function busy(B) {
    if (!B.cur?.one) return false;
    const A = actors.has(B.aid) ? actors.get(B.aid) : null;
    if (!A) return false;
    const c = A.w.g?.clip;
    if (!c || c.name !== B.cur.name) return false;
    return c.t < (DUR[B.cur.name] ?? CLIPS.CLIP[B.cur.name]?.dur ?? 0);
  }
  /** Is the body's one-shot past what it is for (a flinch past its jolt, a blow past its hit): a new blow may take over. */
  function tail(B) {
    const c = actors.has(B.aid) ? actors.get(B.aid).w.g?.clip : null;
    if (!c || !B.cur?.one || c.name !== B.cur.name) return true;
    const D = DUR[c.name] ?? 0;
    return /flinch|vest/.test(c.name) ? c.t > D * 0.45 : CONTACT[c.name] !== undefined ? c.t > CONTACT[c.name] + 0.08 : false;
  }
  /** The look slot: the bearing (body frame) of whoever the body fights, and how far the gun is up. */
  function look(B, F, p) {
    const A = actors.has(B.aid) ? actors.get(B.aid) : null;
    if (!A?.w.g) return;
    const q = B.target ? P(F, B.target) : null;
    let bear = 0;
    if (q) {
      const [qx, , qz] = W(q.x, q.y);
      bear = wrap(Math.atan2(qx - A.x, qz - A.z) - yawOf(A));
    } else if (B.hitFrom !== undefined) bear = B.hitFrom;
    A.w.g.look = lookFor(bear, B.up);
    B.bear = bear;
  }

  return {
    stats,
    /** A new fight: nobody is in anything of the last one. */
    begin() {
      S.clear();
      pred = new Map();
    },
    /** After each tick: the blows the next few ticks will bring, with the keys as they are. */
    predict(F, move) {
      pred = new Map();
      for (const b of predictBlows(F, move)) if (!pred.has(b.id)) pred.set(b.id, b);
    },
    /** How a body faces (arena radians), or null to leave it to the rules (the way it walks). */
    faceOf(p) {
      const B = S.get(p.id);
      return B?.face ?? null;
    },
    /** One of the rules' events, on the tick it happens. `aidOf(id)` the actor of a sim id. */
    event(e, F, aidOf) {
      if (e.type === 'shot') {
        const a = P(F, e.id);
        const B = stateOf(a, aidOf(e.id));
        B.target = e.to;
        B.lastAct = F.t;
        B.up = 1;
        stats.shots += 1;
        look(B, F, a);
        play(B, 'fight_fire', 0);
        // the shot made visible: a flash at the muzzle, a short tracer to where it went, a puff there (fx.js)
        const A = actors.get(B.aid);
        const b = P(F, e.to);
        const from = muzzleOf(A, A.w.g?.look ?? lookFor(B.bear ?? 0, 1));
        const to = e.hit ? W(b.x, b.y, 1.0) : W(e.at[0], e.at[1], 0.05);
        fx.shot(from, to, e.hit, a.side);
      } else if (e.type === 'swing') {
        const a = P(F, e.id);
        const B = stateOf(a, aidOf(e.id));
        B.target = e.to;
        B.lastAct = F.t;
        stats.blows += 1;
        const name = BLOW[a.arm] ?? 'fight_hook';
        const A = actors.has(B.aid) ? actors.get(B.aid) : null;
        const t = clock(A ?? { w: {} });
        // (on time: its wind-up was started for this very tick, and its clock is at the blow now)
        if (B.wind && Math.abs(B.wind.t - F.t) < 0.05 && B.cur?.name === name && t !== null && Math.abs(t - CONTACT[name]) < 0.07) stats.onTime += 1;
        else {
          stats.late += 1;
          look(B, F, a);
          play(B, name, CONTACT[name]);
        }
        B.wind = null;
      } else if (e.type === 'hit') {
        const q = P(F, e.id);
        if (q.hp <= 0) return;
        const B = stateOf(q, aidOf(e.id));
        const by = P(F, e.by);
        const A = actors.has(B.aid) ? actors.get(B.aid) : null;
        if (A && by) {
          const [bx, , bz] = W(by.x, by.y);
          B.hitFrom = wrap(Math.atan2(bx - A.x, bz - A.z) - yawOf(A));
        }
        // (a body mid-blow takes the hit: the blow is cut short)
        const vest = q.side === 'you' && q.cut > 0;
        if (vest) stats.vests += 1;
        else stats.flinches += 1;
        const keep = B.target;
        B.target = null;
        look(B, F, q);
        B.target = keep;
        B.up = Math.min(B.up, 0.5);
        B.wind = null;
        play(B, vest ? 'fight_vest' : 'fight_flinch', 0);
      } else if (e.type === 'down') {
        const q = P(F, e.id);
        const B = stateOf(q, aidOf(e.id));
        B.down = true;
        B.wind = null;
        B.up = 0;
        stats.falls += 1;
        if (actors.has(B.aid)) actors.get(B.aid).w.g && (actors.get(B.aid).w.g.look = 0);
        play(B, q.side === 'foe' ? 'death_collapse' : 'fall_back', 0);
      }
    },
    /**
     * Every frame, after the bodies are put where the rules have them: each body's clip, the look slot, the facing.
     * `T` the fight's clock this frame, `dt` the stage's step.
     */
    frame(F, T, dt, aidOf) {
      for (const p of F.people) {
        if (p.down) continue;
        const aid = aidOf(p.id);
        if (!aid || !actors.has(aid)) continue;
        const B = stateOf(p, aid);
        const A = actors.get(aid);
        const v = Math.hypot(p.vx, p.vy);
        const gun = gunOf(p);
        const Wp = WEAPONS[p.arm];
        // WHO THEY ARE FIGHTING: the gun's, the nearest of the other side in range and a little more; a blow's, its
        // target, coming or last
        const others = F.people.filter(q => !q.down && (q.side === 'foe') !== (p.side === 'foe') && (q.side !== 'foe' || q.in));
        const near = others.map(q => [q, Math.hypot(q.x - p.x, q.y - p.y)]).sort((x, y) => x[1] - y[1])[0] ?? null;
        const coming = pred.get(p.id);
        if (gun) {
          const want = near && near[1] <= Wp.range + 1.5 && p.reload <= 0 ? 1 : 0;
          B.up = want ? Math.min(1, B.up + dt / 0.18) : Math.max(0, B.up - dt / 0.4);
          if (near && near[1] <= Wp.range + 4) B.target = near[0].id;
        } else {
          B.up = 0;
          if (coming) B.target = coming.to;
          else if (near && near[1] < 2.5) B.target = near[0].id;
          else if (T - B.lastAct > 1.2) B.target = null;
        }
        // THE BLOW COMING: its wind-up starts now if the rules swing within its contact time (over the tail of a
        // flinch or of the blow before: the rules let them swing again by then)
        if (!gun && coming && (!busy(B) || tail(B)) && !(B.wind && Math.abs(B.wind.t - coming.t) < 1e-6)) {
          const name = BLOW[p.arm] ?? 'fight_hook';
          const t0 = windAt(coming.t, T, CONTACT[name]);
          if (t0 !== null) {
            B.target = coming.to;
            look(B, F, p);
            play(B, name, t0);
            B.wind = { t: coming.t, to: coming.to };
          }
        }
        // (a wind-up the rules then did not follow with a blow: it swung at air)
        if (B.wind && T > B.wind.t + 0.1) {
          stats.whiffs += 1;
          B.wind = null;
        }
        look(B, F, p);
        // FACING: standing, to whoever they fight; walking, the way they walk (the clips turn the rest)
        if (v < 0.4 && B.target) {
          const q = P(F, B.target);
          B.face = q ? Math.atan2(q.y - p.y, q.x - p.x) : null;
        } else B.face = v >= 0.4 ? Math.atan2(p.vy, p.vx) : null;
        // THE BASE: once a one-shot is done, the gun held, the run, or the walk
        if (busy(B)) continue;
        if (gun) hold(B, 'fight_gun');
        else if (v >= RUN_V) hold(B, 'run_getaway');
        else if (B.cur || A.want) hold(B, null);
      }
    },
    /** For the tools and the lab: a body's state. */
    stateOf: id => S.get(id) ?? null,
    /** A blow winding up now that lands within `lead` s, by `who` ('you', 'foe', or anyone): { id, t, to } or null (for the tools' pictures). */
    windSoon(T, lead, who = null) {
      for (const [id, B] of S) {
        if (who === 'you' && id !== 'you') continue;
        if (who === 'foe' && !/^f\d/.test(id)) continue;
        if (B.wind && B.wind.t - T <= lead + 1e-6 && B.wind.t - T >= 0) return { id, t: B.wind.t, to: B.wind.to };
      }
      return null;
    },
  };
}
