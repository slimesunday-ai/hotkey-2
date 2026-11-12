// THE DIRECTOR: plays an hour's plan (director-plan.js) on the city's walkers (actors.js).
//
// What it keeps true:
//   · nobody is cut: every trip is walked to its end. A mover sets off at the top of the hour at a hurry and may
//     still be on the way when the hour's scenes are done;
//   · a scene that needs someone who has not arrived waits for them;
//   · a block's scenes play one after another in feed order, different blocks at the same time;
//   · whoever has no scene does a routine that suits them, so nobody stands frozen;
//   · THE PLACES ARE THE CITY'S REAL ONES, far apart, and only one ZONE of them is loaded (citymap.js ZONES, loader.js).
//     Whoever is at a place outside it is AWAY: not on stage, their hour only kept account of. A trip between places
//     is a departure, a cut and an arrival (travel.js), and only a hop of a few seconds on foot is walked in full.
//     The FOLLOWED person's trips to another zone are the stage's to start (index.js: voyage()), because the zone
//     changes with them; everyone else's just happen: they leave in view and arrive in view;
//   · held agents are taken to Iron Island's yard or St. Mercy's forecourt (a trip like any other) and kept on a
//     spot of the place's own; a freed one leaves it and arrives on the block the game lets them out on;
//   · everyone STANDS on a spot of their own (stands.js: the city's stand-spot rules run for our blocks), and gets
//     there by the sidewalks: off the old spot and on to the new one by their entry points on the walkers' lane
//     (actors.walkTo). Only a couple of steps (up to a partner, along a wall) are walked straight.
// It knows nothing about the camera or the panels: `on(fn)` reports scene starts and ends for whoever does.
import { GOING, PACE, HURRY, LASTING, HOUR_MS } from './director-plan.js';
import { ACTION_CLIPS } from '../../src/clips.mjs';
import { BACK_FP, SHOT_D, COWER, grid, placeFor, around, reactors } from './staging.js';

/** How far apart a pair stands when no clip says. */
const REACH = 1.15;
/** A clip that goes with a pace (a run) plays from this speed up, m/s: below it the body is still walking up to it. */
const RUN_FROM = 3.2;
/**
 * THE HOUR'S LENGTH: four trades the walk on the city's lanes left open, and two found on the way. Each is on or off
 * by a letter of `?trades=` (for measuring one at a time; API-NOTES has what each bought):
 *   a  nobody's hour waits for someone still walking in to do a thing ALONE (a rest, a text, a shift of work): it is
 *      played when they get there. Never the player's own
 *   b  a newcomer goes straight to the person they came to see, not to a spot of their own first (runStep: direct)
 *   c  an extra comes on from WINGS metres up the sidewalk, not from 11 to 15
 *   d  the run is 6 m/s, not 5.2
 *   e  the walk OFF at the end of a scene (the getaway, the limp home) is not waited for: the scene is over when it
 *      sets off
 *   f  a scene holds only the people who DO something in it or have it done to them on its own block. Whoever is
 *      only named in it from another block (the far end of a phone call or a text, who plays nothing there) is not
 *      kept from their own scenes by it, and theirs do not queue behind it
 *   g  the next person's walk up to someone starts while the one before them is still being served (a dealer's
 *      row of buyers): they arrive on their own side of the person as the last hand-off ends
 */
const TRADES = new Set((new URLSearchParams(globalThis.location?.search ?? '').get('trades') ?? 'abcefg').split(''));
/** The person playing is walked to where their hour leaves them in about this many seconds (at 1×), a run if need be. */
const OWN_WALK = 8;
/** A run, metres a second: what a trip is made at when a scene is waiting for whoever is on it. */
const RUN = TRADES.has('d') ? 6 : 5.2;
/** How long a looping clip holds a scene step, in seconds at 1×. */
const HOLD = 1.3;
/** A scene waits this long (seconds at 1×) for someone on their way, then plays without them. */
const PATIENCE = 8;
/** Past this many seconds (at 1×) into an hour nobody is waited for any more: the hour has to end. */
const CURFEW = 13;
/** An extra comes on (and goes off) this far up the sidewalk from its place, and up to 2 m more, by the person. */
const WINGS = TRADES.has('c') ? 6 : 11;
/** A routine is not started on someone a scene is about to take: within this many seconds of the scene's moment. */
const ROUTINE_LEAD = 2.5;
/** A scene whose first step is somebody coming to somebody starts when the two are this near (m). */
const NEARLY = 7;
/** Whoever comes AT somebody comes fast (m/s at 1×): the city's robber, stage/vignettes.js robSeen. */
const COME_AT = 3.2;
const ATTACKS = new Set(['grab', 'punch', 'haymaker', 'shove', 'scuffle']);
/** The clips of a gun that is up (the city's aim clips: they leave by a seam, aim_lower, not by a cut). */
const AIM = new Set(['aim_draw', 'aim_hold', 'aim_fire']);
/** The routines of someone with time on their hands: they take a spot with something to lean or sit on, if there is one. */
const HANGS = new Set(['rest', 'lean', 'sit', 'watch', 'smoke']);
/** The clips of a body on its back (it leaves them by get_up, at lie_hurt's seam). */
const LYING = new Set(['lie_hurt', 'fall_back', 'shove_fall', 'shot_hit']);
/** The actions that put a body on the ground: whoever has one in a scene gets the fall's footprint kept clear. */
const FALLS = new Set(['fall', 'lie_hurt', 'get_shot']);

export function createDirector({ city, actors, map, stands, travel = null, hooks = {}, rooms = null, padKey = id => `pad:${id}` }) {
  const sim = city.peds.sim;
  const CLIP = actors.CLIPS.CLIP;
  const people = new Map();
  const listeners = new Set();
  let epoch = 0;
  let running = 0;
  let hourStart = 0;
  let hourNo = 0;
  // the seat a person plays, when one does: their pad is the one that opens when they are home
  let player = null;
  // THE ZONE: the places that are loaded (everyone else is away), and the person whose trips move it
  let zone = new Set(Object.keys(map.PLACES ?? { ...map.BLOCKS, ...(map.HELD ?? {}) }));
  let zoneId = null;
  let lead = null;
  const here = place => zone.has(place);
  const placeOf = P => P.held ?? P.block;
  // for the audit: scenes that were somewhere not loaded (never staged), and trips by cut
  const tally = { offstage: 0, offstageKinds: {}, staged: 0, cuts: 0, walks: 0, away: 0 };
  // the last hours' scenes with their timings, for looking into a slow hour: { kind, block, at, waited, took }
  const log = [];
  const trips = [];

  const tell = (what, scene) => {
    for (const fn of listeners) fn(what, scene);
  };
  const at = id => actors.get(id);
  const hashOf = text => {
    let h = 2166136261;
    for (let k = 0; k < text.length; k++) h = Math.imul(h ^ text.charCodeAt(k), 16777619);
    return h >>> 0;
  };
  /** A wait that never outlives its welcome: resolves with the promise or after `s` scaled seconds. */
  const limit = (promise, s) => Promise.race([promise, actors.seconds(s).then(() => undefined)]);

  // ── places ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const HELD = map.HELD ?? {};
  /** The [x, z] a block's spot names (stands.js: `door:<id>` and `pad:<id>` are that seat's own door). */
  const base = (block, spot) => stands.base(block, spot);
  /** Which way the sidewalk runs at a point, as a unit vector. */
  function along(x, z) {
    const E = sim.laneNear(x, z, 30)?.E;
    if (!E || !E.len) return [1, 0];
    return [(E.to.x - E.from.x) / E.len, (E.to.z - E.from.z) / E.len];
  }
  /**
   * A standing spot nobody else has (stands.js): { x, z, ry, entry }. The spots are the city's own kind: clear of
   * the walkers' lanes, the kerb rows and the zebras, a body's width and more apart, each with the lane point it is
   * walked to and from. A door is a point to walk to and go through, not a place to stand.
   */
  function claim(P, block, spot, through = false, beside = null, fresh = false, clear = null) {
    // (whoever has an hour to hang about takes a spot with a wall or a ledge to it, when the block has one free)
    P.stand = stands.claim(P.id, block, spot, { through, beside, fresh, clear, seat: HANGS.has(P.routine) && !P.extra });
    return P.stand;
  }

  // ── an attack gets room ─────────────────────────────────────────────────────────────────────────────────────────
  // The owner, playing the real places (2026-11-12): "still intersections on people when im getting robbed, shouldnt
  // the crowd or other agents step back or something". On the set a hold-up was two people on an open sidewalk; at
  // the night market it was in the picnic yard, four people at arm's length round a table. So:
  //   · whoever an attack is done to stands on OPEN GROUND for it: the nearest ground of the place with nothing
  //     solid within OPEN metres, their own spot when that is open. They are there before the attacker comes
  //     (openFor / toOpen: set when the hour is planned, for whoever is there and whoever arrives);
  //   · everybody who has no part in it clears a ring round it and turns to watch (clearRoom).
  const OPEN = 2.8;
  /** Whoever stands within this of somebody (m) is their neighbour: walked past on the way out, not waited behind. */
  const NEXT_TO = 2.2;
  const ATTACK = new Set(['hold_up', 'shoot', 'grab', 'punch', 'haymaker', 'shove', 'scuffle']);
  const clearance = new Map();
  /** Metres from a point to the nearest solid (4 at most), asked on rings round it. */
  function clearAt(x, z) {
    const key = `${x.toFixed(1)},${z.toFixed(1)}`;
    if (clearance.has(key)) return clearance.get(key);
    let c = 4;
    // (a sample every 0.4 m round each ring: twelve to a ring looked straight past a lamp post three metres off,
    // and the grab that followed the gun stopped short at it)
    scan: for (let r = 0.6; r <= 4; r += 0.4) {
      const n = Math.max(12, Math.ceil((2 * Math.PI * r) / 0.4));
      for (let k = 0; k < n; k++) {
        if (actors.solidAt(x + Math.sin((k * 2 * Math.PI) / n) * r, z + Math.cos((k * 2 * Math.PI) / n) * r)) {
          c = r - 0.4;
          break scan;
        }
      }
    }
    if (actors.solidKnown(x, z)) clearance.set(key, c);
    return c;
  }
  /**
   * The open ground nearest a point: among the standing spots of the zone within 14 m of it (nobody is stood on
   * ground the place table has not looked at), the nearest with OPEN metres clear round it and a way to it over the
   * ground; else the most open of them, when that is half a metre better than the point itself. Null: the point is
   * open, or nothing better is to be had.
   */
  function openGround(x, z) {
    if (!actors.solidKnown(x, z)) return null;
    const here0 = clearAt(x, z);
    if (here0 >= OPEN) return null;
    let best = null;
    for (const s of stands.list()) {
      if (s.named || s.by === 'unfit' || !here(s.block)) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d > 14 || actors.onRoad(s.x, s.z)) continue;
      const c = clearAt(s.x, s.z);
      if (c < here0 + 0.5) continue;
      // (open enough: the nearest such, and not one whose straight way has somebody standing in it: the walk there
      // stood two seconds behind a stall keeper. Not open enough: the most open)
      // (whoever stands next to them now is walked past, toOpen: not counted)
      const inWay = d > 0.5 ? actors.all().filter(A => !A.w.hide && !(A.moving > 0.1) && Math.hypot(A.x - x, A.z - z) > NEXT_TO && between(A.x, A.z, x, z, s.x, s.z, 0.95)).length : 0;
      // (nor on the walkers' lane itself where there is other ground: whoever comes to the place walks through it,
      // and the one coming for them is routed along it, past their shoulder)
      const lane = actors.laneDistance(s.x, s.z);
      const onLane = lane !== null && lane < 1.1 ? 1 : 0;
      const score = c >= OPEN ? 100 - d - inWay * 8 - onLane * 6 : c - inWay - onLane;
      if (!best || score > best.score) best = { score, s, d, c };
    }
    if (!best) return null;
    const way = actors.groundWay(x, z, best.s.x, best.s.z);
    return way !== null && way < best.d * 2 + 6 ? [best.s.x, best.s.z] : null;
  }
  /** Is (px, pz) within `r` of the segment a → b, its two ends left out by 0.4 m? */
  function between(px, pz, ax, az, bx, bz, r) {
    const [dx, dz] = [bx - ax, bz - az];
    const L = Math.hypot(dx, dz) || 1;
    const t = ((px - ax) * dx + (pz - az) * dz) / L;
    return t > 0.4 && t < L + 0.4 && Math.abs((px - ax) * dz - (pz - az) * dx) / L < r;
  }
  /** Sets `P` walking after `T`, who is on the way to open ground: to `D` + 2 m short of where T will stand. */
  function after(P, T, D) {
    if (P.down || P.inside || P.transit || P.held || P.busy > 1) return;
    const [A, g] = [at(P.id), [T.stand.x, T.stand.z]];
    const far = Math.hypot(g[0] - A.x, g[1] - A.z);
    if (far < D + 4) return;
    const f = (far - (D + 2)) / far;
    const q = [A.x + (g[0] - A.x) * f, A.z + (g[1] - A.z) * f];
    if (actors.solidAt(q[0], q[1]) || actors.onRoad(q[0], q[1])) return;
    const ground = actors.groundWay(A.x, A.z, q[0], q[1]);
    const straight = Math.hypot(q[0] - A.x, q[1] - A.z);
    P.astray = true;
    P.tripId += 1;
    P.going = null;
    actors.walkTo(P.id, q[0], q[1], { v: 2.6, how: ground !== null && ground < straight * 1.5 + 2 ? 'straight' : 'path' });
  }
  /** Whoever the hour's attacks are done to: { id: the block it happens on }. */
  function victimsOf(scenes) {
    const out = {};
    for (const scene of scenes) {
      if (scene.passive || !scene.big) continue;
      const step = scene.steps.find(q => ATTACK.has(q.action) && q.target);
      if (step && !HELD[scene.block]) out[step.target] ??= scene.block;
    }
    return out;
  }
  /** Stands a person on open ground for what is about to be done to them, when their own spot is not: a walk there. */
  function toOpen(P) {
    if (P.off || P.away || P.transit || P.held || P.inside || P.down || P.busy || P.going) return false;
    const A = at(P.id);
    const g = openGround(A.x, A.z);
    if (!g) return false;
    stopRoutine(P);
    const mine = ++P.tripId;
    release(P);
    P.stand = { x: g[0], z: g[1], ry: null, entry: null, kind: 'open', temp: true };
    P.astray = false;
    // (the way out of a row of stalls is past a keeper's shoulder: the walk does not stand and wait behind the
    // neighbour it has been standing next to, a second and a half of the hour)
    actors.passing(P.id, actors.nextTo(A.x, A.z, NEXT_TO, P.id));
    const going = actors.walkTo(P.id, g[0], g[1], { v: HURRY, how: 'straight' }).then(out => {
      actors.passing(P.id, null);
      if (P.tripId !== mine) return false;
      P.going = null;
      if (out.arrived) actors.stand(P.id, P.stand);
      startRoutine(P);
      return out.arrived;
    });
    P.going = going;
    return true;
  }
  function release(P) {
    stands.release(P.id);
    P.stand = null;
  }
  /** Where the centre of the set is, to face it when nothing else says where to look. */
  const facing = (x, z) => {
    // (the gathering point of the place they stand at: the nearest)
    let c = null;
    for (const T of Object.values(map.PLACES ?? map.BLOCKS)) {
      const at = T.at ?? T.spots?.street;
      if (at && (!c || Math.hypot(at[0] - x, at[1] - z) < Math.hypot(c[0] - x, c[1] - z))) c = at;
    }
    return c && Math.hypot(c[0] - x, c[1] - z) > 0.6 ? Math.atan2(c[0] - x, c[1] - z) : 0;
  };

  // ── routines: nobody is a statue, and nobody sits on air ────────────────────────────────────────────────────────
  // THE CITY'S PLAN FOR A STANDING PERSON (simstate/life.js), FOLLOWED HERE. Its rules, and its figures (LIFE, NAMES,
  // read from the module itself):
  //   · a loop that needs furniture plays ONLY on a spot of that kind, the body on the spot's own point: sit_bench on
  //     a bench seat, sit_stoop on a ledge (the spot's `sit`), lean_wall at a wall (its `lean`, 0.2 m off it),
  //     deal_pace on its strip (its `pace`). The spots are the city's own (simstate/stands.js, through
  //     demo/tools/set-stands.mjs). On any other spot a person looks about (deal_lookout, the city's own stand-in),
  //     stands in the walkers' own idles, or does the thing of their hour that needs nothing: a phone, an earpiece;
  //   · by role: a dealer looks out and paces, a patrol walks its beat, whoever hangs about sits, leans, looks, idles
  //     or strolls, by the city's weights, never the same thing twice running (a sitter or a leaner may go on);
  //   · whole loops: a loop ends at its wrap, the same loop again goes on seamlessly, and out of a loop the body
  //     blends to the stand for LIFE.settle before anything else starts;
  //   · everyone starts after a wait of their own (up to LIFE.start), so a corner never moves in step.
  // The module itself is not run. Its runner moves a standing person by writing the walker's place at a fixed pace,
  // started and stopped in a frame (the walk the lanes work replaced: the audit counts each as a speed step, and it
  // sees nobody in its way), and plays its clips through the movement module's own hook, a second hand on the one
  // clip slot beside ours. What is left of it without those two is this plan.
  const { LIFE, NAMES } = actors.CITYLIFE;
  const FURNITURE = actors.FURNITURE;
  const ROLE = { pace: 'deal', deal: 'deal', lookout: 'deal', guard: 'patrol', patrol: 'patrol', cook: 'work', build: 'work' };
  const random = seed => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /** (life.js pickW) one of [[weight, what], …] by its weight. */
  const pickW = (opts, rn) => {
    let r = rn() * opts.reduce((q, o) => q + o[0], 0);
    for (const o of opts) {
      r -= o[0];
      if (r <= 0) return o[1];
    }
    return opts[opts.length - 1][1];
  };
  /**
   * May this person play this clip where they are? Null: yes, as they stand. A point [x, z, ry]: yes, THERE (their
   * spot's own point for it). False: no, there is nothing here to sit on, lean on or work at.
   */
  function seatFor(P, name) {
    const need = FURNITURE[name] ?? (name === NAMES.pace ? 'pace' : null);
    if (!need) return null;
    // (indoors: a work bench, a floorboard and a bed are a pad's; the pen's bench and the tent's cots are the set's
    // own, and whoever is held is put on them. Nobody sits or leans in the middle of their own floor)
    if (need === 'room') return P.inside ? null : false;
    if (P.inside) return HELD[P.inside] ? null : false;
    if (P.astray) return false;
    const sp = P.stand;
    const point = need === 'bench' ? (sp?.kind === 'bench' ? [sp.x, sp.z, sp.ry ?? 0] : null) : sp?.[need] ?? null;
    if (!point) return false;
    // (the spot they HOLD is not always the spot they are ON: it is theirs from the moment they set off for it.
    // Nobody crosses a street to lean on the wall of the place they are going to)
    const A = at(P.id);
    return Math.hypot(A.x - point[0], A.z - point[1]) < 3 ? point : false;
  }
  /** Whoever is held does what the place is for, on the set's own cot or bench: a patient lies, a prisoner sits. */
  function heldClip(P) {
    // (the real places are open air: a held person sits on a real bench seat when they have one, and keeps the
    // place's standing pose on open ground. Nobody lies on a forecourt or sits on air)
    const pose = HELD[P.held]?.pose;
    if (pose) {
      const name = P.stand?.kind === 'bench' ? pose.bench : pose.open;
      return name && CLIP[name] ? name : null;
    }
    const action = P.held === 'clinic' ? 'lie_hurt' : P.held === 'jail' ? 'sit_cell' : P.routine;
    const names = (ACTION_CLIPS[action] ?? []).filter(n => CLIP[n] && (CLIP[n].loop || CLIP[n].hold) && seatFor(P, n) === null);
    return names.length ? names[hashOf(P.id + P.routine) % names.length] : null;
  }
  /** The next thing a standing person does (life.js plan): { k: 'loop' | 'once' | 'idle' | 'go', … }. */
  function lifeStep(P, L) {
    const sp = P.stand ?? {};
    const rn = L.rn;
    const role = ROLE[P.routine] ?? 'hang';
    const st = sp.st ?? sp.ry ?? null;
    const facing = spread => (st === null ? null : st + (rn() - 0.5) * spread);
    const idle = (a, b, spread) => ({ k: 'idle', secs: a + b * rn(), ry: facing(spread) });
    const look = n => ({ k: 'loop', clip: NAMES.look, n, ry: facing(0.8) });
    // (a bench sitter stays sat: the loop again is seamless)
    if (sp.kind === 'bench' && !P.astray) return { k: 'loop', clip: NAMES.bench, at: [sp.x, sp.z, sp.ry ?? 0], n: 3 };
    // what their hour has them at that needs nothing under or behind it: a phone, an earpiece, a guard's stance
    const own = (ACTION_CLIPS[P.routine] ?? []).filter(n => CLIP[n] && !CLIP[n].moving && !CLIP[n].pair && n !== NAMES.look && n !== NAMES.pace && seatFor(P, n) === null && (role !== 'work' || P.inside));
    const opts = [];
    if (role === 'deal') {
      opts.push([3, 'look']);
      if (seatFor(P, NAMES.pace)) opts.push([4, 'pace']);
      if (seatFor(P, NAMES.lean)) opts.push([1.2, 'lean']);
      opts.push([1, 'idle']);
    } else if (role === 'patrol') {
      if (P.routine === 'patrol' && sp.beat?.length && !P.astray && !P.inside) opts.push([3, 'beat']);
      opts.push([1.5, 'look'], [1.5, 'idle']);
    } else if (role === 'work' && P.inside) {
      opts.push([1, 'idle']);
    } else {
      opts.push([2.2, 'look'], [1.5, 'idle']);
      if (seatFor(P, NAMES.stoop)) opts.push([4, 'stoop']);
      if (seatFor(P, NAMES.lean)) opts.push([3.5, 'lean']);
      if (sp.beat?.length && !P.astray && !P.inside) opts.push([LIFE.stroll * 4, 'stroll']);
    }
    if (own.length) opts.push([role === 'hang' ? 5 : 4, 'own']);
    const left = opts.filter(o => o[1] !== L.prev || o[1] === 'stoop' || o[1] === 'lean');
    const what = pickW(left.length ? left : opts, rn);
    L.prev = what;
    if (what === 'stoop') return { k: 'loop', clip: NAMES.stoop, at: seatFor(P, NAMES.stoop), n: 2 + Math.floor(rn() * 2) };
    if (what === 'lean') return { k: 'loop', clip: NAMES.lean, at: seatFor(P, NAMES.lean), n: 1 + Math.floor(rn() * 2) };
    if (what === 'pace') return { k: 'loop', clip: NAMES.pace, at: seatFor(P, NAMES.pace), n: 1 + (rn() < 0.4 ? 1 : 0) };
    if (what === 'look') return look(1 + (rn() < 0.3 ? 1 : 0));
    if (what === 'beat' || what === 'stroll') {
      const walk = what === 'beat' && CLIP[NAMES.patrol] ? NAMES.patrol : null;
      return { k: 'go', to: sp.beat[L.beatK++ % sp.beat.length], back: [sp.x, sp.z], clip: walk, v: walk ? CLIP[walk].speed || LIFE.walk : LIFE.walk * 0.85, secs: 1.5 + 2.5 * rn() };
    }
    if (what === 'own') {
      const name = own[Math.floor(rn() * own.length)];
      return CLIP[name].loop ? { k: 'loop', clip: name, n: CLIP[name].dur > 5 ? 1 : 1 + Math.floor(rn() * 2), ry: facing(0.6) } : { k: 'once', clip: name, ry: facing(0.6) };
    }
    return idle(3, 4, 0.8);
  }
  /** A standing person's life, until a scene, a trip or the next hour takes them (stopRoutine). */
  async function live(P, mine) {
    const on = () => P.routineId === mine && !P.busy && !P.going && !P.off && !P.away && !P.transit && !P.ambient && !P.down && !P.held && people.get(P.id) === P;
    const L = (P.life ??= { prev: null, beatK: 0, seen: false, n: 0, rn: null });
    L.rn = random(hashOf(P.id) + 7919 * ++L.n);
    // its own start: nobody on a corner moves in step
    await actors.seconds(L.seen ? 0.3 + L.rn() * 1.2 : L.rn() * LIFE.start);
    L.seen = true;
    // (the loop on the body: whatever is asked for on it now, a routine's from before the scene, is this one's to
    // end before it stands idle or starts another)
    let last = on() ? actors.clipOf(P.id).want : null;
    // (left on their back by the last hour: up first, by the city's own get_up at its seam)
    if (on() && LYING.has(actors.clipOf(P.id).name)) {
      await limit(actors.play(P.id, 'get_up'), 7);
      if (!on()) return;
      last = null;
    }
    const settle = async () => {
      if (!last) return true;
      last = null;
      actors.stop(P.id);
      await actors.seconds(LIFE.settle);
      return on();
    };
    while (on()) {
      const A = at(P.id);
      // (a scene is about to take them, or they are still walking somewhere: nothing new is started)
      if (soon(P) || A.route) {
        if (soon(P) && !(await settle())) return;
        await actors.seconds(0.4);
        continue;
      }
      const c = lifeStep(P, L);
      if (c.k === 'idle') {
        if (!(await settle())) return;
        if (c.ry !== null) actors.turn(P.id, c.ry);
        await actors.seconds(c.secs);
        continue;
      }
      if (c.k === 'go') {
        // out along the spot's beat and back: the short walk the city's stand-spot rules checked clear from it
        if (!(await settle())) return;
        if (!(await actors.stepTo(P.id, c.to[0], c.to[1], { v: c.v, clip: c.clip })) || !on()) return;
        await actors.seconds(c.secs);
        if (!on()) return;
        if (!(await actors.stepTo(P.id, c.back[0], c.back[1], { v: c.v, clip: c.clip })) || !on()) return;
        continue;
      }
      // a loop or a one-shot: at its point when it has one, facing its way
      if (c.at && Math.hypot(A.x - c.at[0], A.z - c.at[1]) > 0.03) {
        if (!(await settle())) return;
        if (!(await actors.stepTo(P.id, c.at[0], c.at[1], { v: LIFE.walk, yaw: c.at[2], exact: true })) || !on()) return;
        // (short of it, somebody stood in the way: nothing is sat on from a step away)
        if (!actors.seated(P.id, c.clip) && c.clip !== NAMES.pace) {
          await actors.seconds(1.5);
          continue;
        }
      }
      if (last && last !== c.clip && !(await settle())) return;
      const ry = c.at ? c.at[2] : c.ry ?? null;
      if (ry !== null && last !== c.clip) {
        actors.turn(P.id, ry);
        await actors.turned([P.id], 1.2);
        if (!on()) return;
      }
      const clip = CLIP[c.clip];
      last = c.clip;
      // (whole loops, on the clip's own clock from where it began: it ends at a wrap)
      await actors.play(P.id, c.clip, clip.loop ? { loop: true, hold: clip.dur * c.n } : {});
      if (!clip.loop) last = null;
    }
  }
  /**
   * Is a scene about to take this person: one of this hour's scenes they act in has not begun and its moment is
   * here, or a couple of seconds off? A routine started now would be stopped before it had been seen.
   */
  const soon = P => (P.scenes ?? []).some(sc => !sc.began && hourStart + sc.at / 1000 - actors.clock < ROUTINE_LEAD);
  function startRoutine(P) {
    if (P.busy || P.going || P.off || P.ambient || P.away || P.transit) return;
    const mine = ++P.routineId;
    actors.setRate(P.id, 1);
    if (!P.down) actors.face(P.id, null);
    if (P.held || P.down) {
      // (held, or left on the ground: the place's own loop, where the set has put them)
      const name = P.down && !P.held ? null : heldClip(P);
      if (name) actors.play(P.id, name, { loop: true, t: (hashOf(P.id) % 30) / 10 });
      else if (!P.down) actors.stop(P.id);
      return;
    }
    live(P, mine).catch(err => console.warn('[stage] a routine fell over:', P.id, err));
  }
  function stopRoutine(P) {
    P.routineId += 1;
  }

  // ── going somewhere ─────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * Sends a person to a block's spot (or into a held place) and returns at once. `P.going` is the trip's promise,
   * for a scene that has to wait for it. Short hops go straight; the rest take the city's sidewalks.
   */
  function send(P, block, spot, { held = null, v = null, clip = null, rush = false, beside = null, after = 0 } = {}) {
    // already there, or already on the way there (unless a scene walked them off their place)
    if (P.block === block && P.spot === spot && P.held === held && !P.astray) return P.going;
    const to = held ?? block;
    // (between a departure and an arrival, bound for that very place: the trip under way is the trip)
    if (P.transit && placeOf(P) === to) return P.going;
    // (an extra just brought on has no place yet: it walks in from the wings)
    if (placeOf(P) && cutBetween(P, to, block, spot)) {
      // THE FOLLOWED PERSON'S TRIP TO ANOTHER ZONE IS THE STAGE'S: the zone moves with them, between the hour's scenes
      if (P.id === lead && map.zoneOf(to) !== zoneId) return P.going;
      return trip(P, block, spot, { held, v, clip, rush, beside, after });
    }
    return walkLeg(P, block, spot, { v, clip, rush, beside, after });
  }
  /**
   * Is the way from where a person is to a place a CUT? Yes when either end is not loaded, when it is a held place,
   * and when the walk would take about a quarter of a minute or more at the city's walking pace (travel.js: the
   * city walks at 1.5 m/s). A shorter hop between two places that are loaded together is walked in full.
   */
  const WALKED = 15;
  function cutBetween(P, to, block, spot) {
    const from = placeOf(P);
    if (from === to && !P.away) return false;
    if (P.away || P.transit || !here(to) || !here(from) || HELD[to] || HELD[from]) return true;
    const q = base(block, spot);
    if (!q) return true;
    const A = at(P.id);
    const metres = actors.wayLength(P.id, q[0], q[1]) ?? Math.hypot(A.x - q[0], A.z - q[1]) * 1.3;
    return (travel?.walkSeconds(metres) ?? metres / 1.5) >= WALKED;
  }
  /**
   * A TRIP BY CUT (travel.js): they leave the place they are at, if it is on stage; then, when the place they are
   * going to is on stage, they arrive there and walk to their spot (or are put in the held place's keeping). With
   * neither end on stage it is only book-keeping. `between` is the stage's, for the followed person: awaited between
   * the departure and the arrival, while the picture is black (it loads the zone and re-seats everyone).
   */
  function trip(P, block, spot, { held = null, v = null, clip = null, rush = false, beside = null, after = 0, between = null, onArrived = null } = {}) {
    P.astray = false;
    stopRoutine(P);
    const mine = ++P.tripId;
    const to = held ?? block;
    const origin = P.away || P.transit ? null : placeOf(P);
    // (where they come from by the book, on stage or not: the ride at the other end is chosen by the whole trip)
    const cameFrom = placeOf(P);
    // (`taken`: nobody chose this trip, an arrest to the jail, a hurt person to St. Mercy: it gets no ride, the plain
    // cut. `onStage`: the moment they can be seen at the other end, for whoever waits for that and not for the walk in)
    const actor = { id: P.id, lead: P.id === lead, clip, pace: clip ? v : null, taken: !!held, cut: () => hooks.cut?.(P.id), gone: () => P.tripId !== mine || people.get(P.id) !== P, onStage: () => onArrived?.() };
    // (A TRIP CAN BE SKIPPED, skipTrip(): `skipping` resolves, the half that is playing ends at once and the rest is
    // not played: travel.js leave / arrive, the stage's carriage)
    actor.skipped = false;
    actor.skipping = new Promise(resolve => {
      actor.skip = () => {
        actor.skipped = true;
        resolve(true);
      };
    });
    P.riding = actor;
    travel?.cancel?.(P.id);
    if (origin && here(origin)) leave(P);
    else comeOut(P);
    release(P);
    actors.tag(P.id, false);
    Object.assign(P, { block, spot, held, transit: true, away: false });
    tally.cuts += 1;
    const note = { hour: hourNo, id: P.id, to: `${to}/${spot}`, from: origin, cut: true, lead: actor.lead, took: null, ended: 'replaced', at: +(actors.clock - hourStart).toFixed(1) };
    trips.push(note);
    if (trips.length > 300) trips.shift();
    const t0 = actors.clock;
    const journey = async () => {
      if (after > 0) {
        await actors.seconds(after);
        if (P.tripId !== mine) return false;
      }
      if (origin && here(origin) && travel) await travel.leave(actor, { from: origin, to });
      else {
        actors.cutClip(P.id);
        actors.show(P.id, false);
      }
      // (called off while the picture was black: it comes back)
      const off = () => {
        travel?.back(actor);
        return false;
      };
      if (actor.gone()) return off();
      if (between) await between(actor);
      if (actor.gone()) return off();
      if (!here(to) || !travel) {
        // gone somewhere that is not on stage: away
        Object.assign(P, { transit: false, away: true, going: null });
        actors.stop(P.id);
        actors.show(P.id, false);
        note.ended = 'away';
        return true;
      }
      // (in the held place's keeping before the picture comes back: nobody is seen standing at its gate first)
      if (held) {
        P.transit = false;
        P.going = null;
        actors.show(P.id, true);
        enter(P, held);
        startRoutine(P);
        if (actor.lead) {
          await actor.cut();
          travel.back(actor);
        }
        note.took = +(actors.clock - t0).toFixed(1);
        note.ended = 'arrived';
        onArrived?.();
        return true;
      }
      // (their standing place is theirs from here: the ride ends on it. Somebody an attack is about to be done to
      // here is set down on open ground: openFor)
      let S = claim(P, block, spot, spot === `pad:${P.id}`, beside);
      if (P.openFor === block && spot === 'street' && S && !S.way) {
        const g = openGround(S.x, S.z);
        if (g) {
          release(P);
          S = P.stand = { x: g[0], z: g[1], ry: null, entry: null, kind: 'open', temp: true };
        }
      }
      // (a bench seat is the bench: the ride sets them down a step in front of it, and they sit when they are there)
      const ry = S?.ry ?? 0;
      const down = !S ? null : S.kind === 'bench' ? [S.x + Math.sin(ry) * 0.75, S.z + Math.cos(ry) * 0.75] : [S.x, S.z];
      // (`rush`: a scene is waiting for them. They come in from nearer, at a run)
      await travel.arrive(actor, { at: to, from: origin ?? (cameFrom !== to ? cameFrom : null), spot: down, rush });
      onArrived?.();
      if (actor.gone()) return off();
      P.transit = false;
      if (P.riding === actor) P.riding = null;
      hooks.landed?.(P.id);
      note.took = +(actors.clock - t0).toFixed(1);
      note.ended = 'arrived';
      // (their place is asked for afresh: walkLeg below)
      P.spot = null;
      // (the picture is back as they walk in: travel.arrive saw to it)
      return walkLeg(P, block, spot, { v: clip ? v : null, clip, rush, beside, direct: true });
    };
    const run = (async () => {
      try {
        return await journey();
      } finally {
        // (however the trip ended, called off, away, arrived: a picture it turned black comes back)
        travel?.back(actor);
        if (P.riding === actor) {
          P.riding = null;
          hooks.landed?.(P.id);
        }
      }
    })();
    P.going = run;
    return run;
  }
  /** The walk to a spot of a place that is on stage, from wherever on stage they are (the old `send`). */
  function walkLeg(P, block, spot, { v = null, clip = null, rush = false, beside = null, after = 0, direct = false } = {}) {
    const held = null;
    P.astray = false;
    stopRoutine(P);
    const mine = ++P.tripId;
    travel?.cancel?.(P.id);
    const place = block;
    // (set down on open ground for what is about to happen to them: that is their place for the hour)
    const S = P.stand?.temp && P.openFor === block && spot === 'street' ? P.stand : claim(P, place, spot, spot === `pad:${P.id}`, beside);
    const [x, z] = [S.x, S.z];
    const A = at(P.id);
    leave(P);
    tally.walks += 1;
    Object.assign(P, { block, spot, held, away: false, transit: false });
    const d = Math.hypot(A.x - x, A.z - z);
    // a couple of steps are a straight step; anything more goes by the sidewalks, off this spot and on to that one by
    // their entry points on the lane. (`direct`: the walk in after an arrival. They were put down a few steps from
    // the place: over the ground to their spot when that way is short, not out to the lane and round by it)
    // And a spot with NO ENTRY, inside a yard, a lot or a plaza: the lanes do not lead to it. From another point of
    // the same yard the way is over the ground, not out to the sidewalk and back in by the gate.)
    // (never to a bench seat: the seat is the bench, and the way to it is walked up to its front and then sat on)
    const ground = S.kind !== 'bench' && ((direct && d < 16) || (!S.entry && d < 28)) ? actors.groundWay(A.x, A.z, x, z) : null;
    const near = d < 2.5 || (ground !== null && ground < d * 1.5 + 2);
    const metres = near ? d : actors.wayLength(P.id, x, z, S.entry) ?? d;
    // the hurry of the city's own walkers; at a run when a scene is waiting for them and the way is more than a few
    // steps (`rush`). Otherwise the hurry is enough and they arrive when they arrive
    const pace = v ?? (rush && metres > 9 ? RUN : HURRY);
    const run = !clip && pace > 3.4;
    const over = clip ?? (run ? 'run_getaway' : null);
    const note = { hour: hourNo, id: P.id, to: `${place}/${spot}`, straight: +d.toFixed(0), way: +metres.toFixed(0), pace: +pace.toFixed(1), took: null, metres: null, ended: 'replaced', at: +(actors.clock - hourStart).toFixed(1), rush };
    trips.push(note);
    if (trips.length > 300) trips.shift();
    const walking = (async () => {
      // (`after`: its turn to set off, when a whole block leaves at the top of the hour: playHour)
      if (after > 0) {
        await actors.seconds(after);
        if (P.tripId !== mine) return false;
      }
      // (it turns to the spot's own heading as it arrives: the city eases the turn. A door has none)
      // (whoever stands by the spot this walk is TO, a bench's other sitter, a stall's keeper, is where it is going
      // and not in its way: an arrival at the park stood behind its bench neighbour until the walk was given up)
      actors.passing(P.id, actors.nextTo(x, z, 1.6, P.id));
      const out = await actors.walkTo(P.id, x, z, { v: pace, how: near ? 'straight' : 'path', clip: over, clipFrom: run ? RUN_FROM : 0, entry: S.entry, yaw: S.way ? null : S.ry ?? facing(x, z) });
      if (P.tripId === mine) actors.passing(P.id, null);
      Object.assign(note, { took: +out.seconds.toFixed(1), metres: +out.metres.toFixed(0), ended: out.arrived ? 'arrived' : 'replaced' });
      if (P.tripId !== mine) return false;
      if (!out.arrived) {
        // a scene took them on the way: the trip is over, and they are not where it was going
        P.going = null;
        P.astray = true;
        return false;
      }
      P.going = null;
      actors.stand(P.id, S.way ? null : S);
      if (held) enter(P, held);
      else if (spot === `pad:${P.id}`) enter(P, padKey(P.id));
      // (no room took them in: nobody stays on a door's own point, which is everybody's way through it. A step
      // aside, to the free standing spot nearest the door)
      if (S.way && !P.inside) {
        const N = claim(P, place, 'street', false, [S.x, S.z], true);
        if (N && !N.way) actors.walkTo(P.id, N.x, N.z, { v: 1.6, entry: N.entry, yaw: N.ry }).then(out => out.arrived && P.tripId === mine && actors.stand(P.id, N));
      }
      // (what a scene put off until they got here: once, and then the routine)
      const late = P.onArrive;
      P.onArrive = null;
      const name = late?.epoch === epoch && !P.busy && !P.down ? late.step.clips.find(n => CLIP[n] && !CLIP[n].pair && !CLIP[n].moving && seatFor(P, n) === null) : null;
      if (name) {
        const mineR = ++P.routineId;
        actors.play(P.id, name, { hold: Math.min(CLIP[name].dur, 2 * HOLD) }).then(() => P.routineId === mineR && !P.busy && !P.going && startRoutine(P));
      } else startRoutine(P);
      return true;
    })();
    P.going = walking;
    return walking;
  }
  /**
   * Whoever is in a room (a cell, a clinic bed, their own pad) comes out of the door they went in by: a cut to the
   * sidewalk in front of it. EVERY walk of someone who is indoors starts with this: a room stands inside what the
   * city holds as a solid building, and nobody walks out through its wall.
   */
  /**
   * comeOut(), for whoever is in the middle of something that belongs to the room (cooking at the bench, sat on the
   * pen's bench): that clip ends at the cut, not on the sidewalk in front of the door.
   */
  function leave(P) {
    if (P.inside && !P.down) actors.cutClip(P.id);
    comeOut(P);
  }
  function comeOut(P) {
    if (!P.inside) return;
    if (HELD[P.inside]) {
      // (a held place is open air: they are let go where they sit, and leave from there)
      rooms?.leave?.(P.inside, P.id);
      P.inside = null;
      P.down = false;
      release(P);
      return;
    }
    const A = at(P.id);
    const [ex, ez] = base(P.block, `door:${P.id}`) ?? [A.x, A.z];
    actors.place(P.id, ex, ez, facing(ex, ez));
    open(P, P.inside, false);
    rooms?.leave?.(P.inside, P.id);
    P.inside = null;
    P.down = false;
  }
  /**
   * Through a door: into the set's room for that key ('jail', 'clinic', or an agent's own pad) when it has one, else
   * staying where the walk ended (the door). A held person keeps the pose their hour gives them.
   */
  function enter(P, key) {
    if (HELD[key]) {
      // IN THE HELD PLACE'S KEEPING: a spot of its own (stands.js: a real bench seat while one is free), in the open
      const S = stands.claim(P.id, key, 'in');
      P.stand = S;
      actors.place(P.id, S.x, S.z, S.ry ?? facing(S.x, S.z));
      actors.stand(P.id, S);
      P.inside = key;
      P.down = true;
      return;
    }
    // (the set's rooms keep a place per person: the same cot or bench for as long as they are in)
    const anchor = rooms?.anchor?.(key, P.id);
    if (anchor) {
      // a pad's place is at its open front, where the cut hides half of whoever stands there: a good step further in
      const ry = anchor[3] ?? 0;
      const inward = HELD[key] ? 0 : 1.3;
      actors.place(P.id, anchor[0] - Math.sin(ry) * inward, anchor[2] - Math.cos(ry) * inward, ry, anchor[1]);
      P.inside = key;
      open(P, key, true);
    }
    if (HELD[key]) P.down = true;
  }
  /**
   * Opens or shuts the room someone is in. The pen and the tent open for anyone in them. A pad opens only for the
   * player's own (the city has ONE cutaway for the whole page) and for a break-in staged there (showPad below).
   */
  function open(P, key, on) {
    if (!HELD[key] && P.id !== player) return;
    if (on === !!P.shown) return;
    P.shown = on;
    Promise.resolve(rooms?.show?.(key, on)).catch(err => console.warn('[stage] the room did not open:', key, err));
    tell(on ? 'room' : 'room-shut', { key, id: P.id, block: HELD[key] ? key : P.block });
  }
  /** Puts a person where they belong at once: for a skipped hour and for the start of a season. */
  function settle(P, block, spot, held = null) {
    P.tripId += 1;
    P.going = null;
    P.busy = 0;
    P.down = false;
    P.transit = false;
    if (P.inside) {
      open(P, P.inside, false);
      rooms?.leave?.(P.inside, P.id);
    }
    P.inside = null;
    const place = held ?? block;
    // (they are PUT somewhere: whatever they were doing ends at the cut, a ride's scene with its scooter too. A clip
    // left to blend out would be seen for a third of a second at the new place: somebody leaning on no wall)
    travel?.cancel?.(P.id);
    actors.cutClip(P.id);
    if (!here(place)) {
      // AWAY: at a place that is not loaded. Kept account of, never drawn
      release(P);
      stopRoutine(P);
      Object.assign(P, { block, spot, held, away: true, astray: false });
      actors.tag(P.id, false);
      actors.show(P.id, false);
      return;
    }
    Object.assign(P, { block, spot, held, away: false, astray: false });
    actors.show(P.id, true);
    if (held) {
      enter(P, held);
      startRoutine(P);
      return;
    }
    const S = claim(P, place, spot, spot === `pad:${P.id}`);
    actors.place(P.id, S.x, S.z, S.ry ?? facing(S.x, S.z));
    actors.stand(P.id, S.way ? null : S);
    if (spot === `pad:${P.id}`) enter(P, padKey(P.id));
    startRoutine(P);
  }
  /** Waits until a person stands on a block (sending them if nobody has). False when the patience ran out. */
  async function present(P, block, spot = 'street') {
    if (!here(block)) return false;
    if (P.off) summon(P, block, spot);
    if (HELD[block]) {
      if (P.held !== block) send(P, P.end?.block ?? P.block, 'street', { held: block });
    } else if (P.block !== block || P.held) send(P, block, spot, { rush: true });
    // (nobody on their way: they are there, unless they are away or the trip is not this hour's to make: the
    // followed person's to another zone)
    if (!P.going) return !P.away && !P.transit && (HELD[block] ? P.held === block : P.block === block && !P.held);
    // a scene is waiting for them now: whoever was only walking there runs the rest of the way (not the one on
    // their way to open ground to have it done to them: nobody runs to their own robbery)
    if (P.stand?.kind !== 'open') actors.hurry(P.id, RUN, 'run_getaway', RUN_FROM);
    // late in the hour nobody is waited for: the scene plays without whoever is still on the way
    const left = Math.min(PATIENCE, CURFEW - (actors.clock - hourStart));
    if (left <= 0) return false;
    return (await limit(P.going, left)) !== undefined;
  }

  // ── extras ──────────────────────────────────────────────────────────────────────────────────────────────────────
  // The people who keep a counter are always at it. Everyone else the game names but no seat plays (street buyers,
  // the officers, the Dunn brothers, the Sixes, the snitch, the courier) is an EXTRA: on stage only in an hour that
  // has a scene for them. They walk in from a dozen metres up the sidewalk and walk off the same way.
  const KEEPERS = new Set(['fence', 'gunshop', 'shopkeeper', 'supplier', 'medic']);
  function wings(P, block, spot, near = null) {
    // (a point ON the walkers' lane up the sidewalk: an extra comes and goes along the lane like anyone walking by.
    // `near`: where whoever they have come to see stands. The real places are wide: the lane nearest THAT person,
    // not the one nearest the middle of the plaza)
    const [bx, bz] = near ?? base(block, spot);
    const side = hashOf(P.id) % 2 ? 1 : -1;
    const far = WINGS + (hashOf(P.id) % (WINGS > 6 ? 5 : 3));
    const q = actors.laneAlong(bx, bz, side * far);
    // (a place with no sidewalk, the trailer park's lane or the island's yard: they come on by the place's way in)
    if (Math.hypot(q[0] - bx, q[1] - bz) < 3 && travel && map.PLACES?.[block]) return travel.wayIn(block, null).slice(0, 2);
    return q;
  }
  function summon(P, block, spot, near = null) {
    if (!P.off) return;
    const [x, z] = wings(P, block, spot, near);
    P.off = false;
    release(P);
    Object.assign(P, { block: null, spot: null, held: null, going: null });
    actors.place(P.id, x, z, 0);
    actors.show(P.id, true);
  }
  function dismiss(P, now = false) {
    if (P.off) return;
    P.off = true;
    P.tripId += 1;
    P.going = null;
    stopRoutine(P);
    release(P);
    actors.stop(P.id);
    const leave = () => {
      if (P.off) actors.show(P.id, false);
    };
    if (now || !P.block) {
      leave();
      return;
    }
    const [x, z] = wings(P, P.block, P.spot ?? 'street');
    actors.face(P.id, null);
    actors.walkTo(P.id, x, z, { v: HURRY }).then(leave);
  }

  // ── scenes ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const centre = scene => {
    const pts = scene.actors.map(id => people.get(id)).filter(Boolean).map(P => at(P.id));
    if (!pts.length) return base(scene.block, scene.spot);
    return [pts.reduce((s, A) => s + A.x, 0) / pts.length, pts.reduce((s, A) => s + A.z, 0) / pts.length];
  };

  // ── staging a pair with room: the city's placement (staging.js, ported from its stage/vignettes.js) ──────────────
  /** How far apart a step's two people stand: the clip's own pair gap, the city's 3.5 m for a gun, else a reach. */
  function gapOf(step) {
    if (step.action === 'shoot' || step.action === 'hold_up') return SHOT_D;
    return CLIP[step.clips[0]]?.pair?.gap ?? REACH;
  }
  /** For a walk up to someone: the gap of what the walker does to them next in this scene (so they arrive on it). */
  function gapAhead(scene, step) {
    const next = scene.steps.slice(scene.steps.indexOf(step) + 1).find(q => q.mode === 'act' && ((q.actor === step.actor && q.target === step.target) || (q.actor === step.target && q.target === step.actor)));
    return next ? gapOf(next) : REACH;
  }
  /** Everyone else on stage near a point, for the staging's checks: [[x, z, moving], …]. */
  const others = (x, z, r, skip) => actors.all().filter(A => !A.w.hide && !A.room && !skip.includes(A.id)).flatMap(A => {
    // (someone on their way counts where they are, as a passer-by, and where they are going to stand, as standing
    // there already: two people walking up to one person at once were given one mark)
    const goal = actors.goalOf(A.id);
    return [[A.x, A.z, A.moving > 0.1], ...(goal ? [[goal[0], goal[1], false]] : [])];
  }).filter(([px, pz]) => Math.hypot(px - x, pz - z) < r);
  /** Where a scene is: the one its first step is done to (they stay; the other comes), else the middle of its people. */
  function sceneAt(scene) {
    const first = scene.steps.find(q => q.target && people.get(q.target) && people.get(q.actor));
    const T = first ? people.get(first.target) : null;
    if (T && !T.off && !T.going && onBlock(T, scene)) return [at(T.id).x, at(T.id).z];
    // (on their way to open ground to have it done to them: the scene is where they will stand)
    if (T && !T.off && T.going && T.stand?.kind === 'open' && onBlock(T, scene)) return [T.stand.x, T.stand.z];
    const here = scene.actors.map(id => people.get(id)).filter(P => P && !P.off && !P.going);
    if (here.length) return [here.reduce((q, P) => q + at(P.id).x, 0) / here.length, here.reduce((q, P) => q + at(P.id).z, 0) / here.length];
    return centre(scene);
  }

  /**
   * THE MARK of a pair in a scene: who stays (the CENTRE: the one the step is done to), the axis from them to the
   * other's place, and the metres between them. The city's rules choose it (staging.js placeFor / pickAxis): the
   * other's place is standing ground on a sidewalk with nobody within 1.3 m, a gun has a clear line, and whoever
   * will go down in this scene falls on open ground, along the kerb or the wall where that can be had. It is chosen
   * once for the pair and kept while the distance asked for stays the same: a hold-up at 3.5 m and the grab at
   * 1.15 m after it are two marks, each on its own axis from where they then stand.
   */
  function markFor(scene, P, T, D, gun) {
    scene.marks ??= new Map();
    const key = [P.id, T.id].sort().join('|');
    const had = scene.marks.get(key);
    if (had && Math.abs(had.D - D) < 0.4) return had;
    const [C, M] = [at(T.id), at(P.id)];
    const d = Math.hypot(M.x - C.x, M.z - C.z);
    const u0 = d > 0.05 ? [(M.x - C.x) / d, (M.z - C.z) / d] : [Math.sin(C.ry), Math.cos(C.ry)];
    if (C.room) {
      // (someone held in the pen or the tent: a room has its own floor and walls, and the city's rules are for the
      // street. Straight towards them, as near as the walk gets)
      const mark = { centre: T.id, u: u0, a: Math.atan2(u0[0], u0[1]), D, O: null, at: [C.x, C.z], step: false, bad: 0, room: true };
      scene.marks.set(key, mark);
      return mark;
    }
    const t0 = performance.now();
    const L = actors.laneLine(C.x, C.z);
    const O = grid({ cx: C.x, cz: C.z, half: D + 4.6, side: actors.GROUND, solid: actors.solidAt, road: (x, z) => !actors.offKerb(x, z), lane: L ? L.d : null });
    scene.falls ??= new Set(scene.steps.filter(q => FALLS.has(q.action)).map(q => q.actor));
    const falls = [];
    if (scene.falls.has(T.id)) falls.push({ who: 'P', fp: BACK_FP });
    if (scene.falls.has(P.id)) falls.push({ who: 'Q', fp: BACK_FP, d: D });
    // (whoever is down, indoors or keeps a counter stays exactly where they are: only the axis is turned)
    const fixed = T.down || !!T.inside || (T.kind === 'npc' && !T.extra);
    // (a mark that follows another of the same two, the grab after the gun: on the axis they already stand on when
    // the ground allows it. Turned side-on to the camera it was a walk round the very person held up, 2.4 s of it,
    // to take what they hold)
    const pl = placeFor(O, { x: C.x, z: C.z, y: C.y }, u0, { D, falls, people: others(C.x, C.z, D + 5, [P.id, T.id]), los: gun, side: gun ? 5 : had ? 0 : 2, cam: city.camera.position, fixed });
    const mark = { centre: T.id, u: pl.ax.u, a: pl.ax.a, D, O, at: [pl.x, pl.z], step: pl.moved, bad: pl.ax.bad, ms: +(performance.now() - t0).toFixed(1) };
    scene.marks.set(key, mark);
    (scene.entry?.marks ?? []).push(`${T.id}←${P.id} ${D} m${pl.moved ? ', a step first' : ''}${pl.ax.bad ? `, bad ${pl.ax.bad}` : ''}, ${mark.ms} ms`);
    return mark;
  }

  /**
   * Brings `P` and `T` to their mark for a step `D` metres apart and turns them to each other. The one who stays
   * steps to clearer ground first when the city's rule says so; the other comes straight to their place by the
   * person, from wherever they are (a newcomer still on the way in never goes to a spot of their own first), round
   * the one who stays when the place is on their far side, backing off when it is a gun stepping back to its
   * distance. → true when they stand on it; false when the wait ran out with them still apart (NEVER FROM AFAR,
   * vignettes.js: nothing two-handed is played across a street).
   */
  async function meet(scene, P, T, D, rate, mine, { gun = false, v = null, clip = null } = {}) {
    if (!(await present(T, scene.block, scene.spot)) || epoch !== mine) return false;
    leave(P);
    // (whoever is at home comes to their door for someone who has come to them: nobody talks to a wall)
    if (T.inside && !HELD[T.inside]) {
      leave(T);
      T.astray = true;
    }
    const had = !!scene.marks?.get([P.id, T.id].sort().join('|'));
    const M = markFor(scene, P, T, D, gun);
    const centre = people.get(M.centre);
    const mover = centre === P ? T : P;
    const [C, A] = [at(centre.id), at(mover.id)];
    if (M.step && !centre.down && !centre.inside) {
      M.step = false;
      centre.astray = true;
      await limit(actors.stepTo(centre.id, M.at[0], M.at[1], { v: 1.25 * rate }), 4);
      if (epoch !== mine) return false;
    }
    M.step = false;
    const q = [C.x + M.u[0] * D, C.z + M.u[1] * D];
    const d = Math.hypot(A.x - q[0], A.z - q[1]);
    // (the one who stays is where the walk is going, not in its way: actors.js bodyAhead)
    actors.meeting(mover.id, centre.id);
    if (d > 0.3 && !mover.down) {
      mover.astray = true;
      mover.tripId += 1;
      mover.going = null;
      // (the step in from a gun's distance is the scene's own last two metres: the hour's end does not cut it to a
      // grab made across the yard)
      const left = Math.max(had ? 3 : 1.5, Math.min(PATIENCE, CURFEW - (actors.clock - hourStart)));
      // (a gun stepping back to its distance backs off, facing whoever it is on: vignettes.js shotScene)
      const backing = gun && d < 3.2 && (q[0] - A.x) * (A.x - C.x) + (q[1] - A.z) * (A.z - C.z) > 0;
      if (backing) {
        actors.face(mover.id, C.x, C.z);
        await limit(actors.stepTo(mover.id, q[0], q[1], { v: 2.2 * rate }), left);
      } else {
        actors.face(mover.id, null);
        // (where there is no walkers' lane at all, a yard or a lot, a few steps are a few steps: clearStep() knows
        // only sidewalks, and a walk laid out as a trip stops behind the very person it is walking up to)
        const open = d < 9 && actors.laneDistance(q[0], q[1]) === null;
        const far = d > 2.5 && !open && !actors.clearStep(mover.id, q[0], q[1], centre.id);
        const way = far ? actors.wayLength(mover.id, q[0], q[1]) ?? d : d;
        // (still a street away: at a run, like any trip a scene is waiting for)
        const run = !clip && way > 9;
        const pace = run ? RUN : v ?? 2.6 * rate;
        const over = { v: pace, clip: clip ?? (run ? 'run_getaway' : null), clipFrom: run ? RUN_FROM : clip && pace > 3.4 ? RUN_FROM : 0 };
        // (a few steps over open ground are walked over the ground: by the lanes the four metres to a mark in the
        // night market's yard were eight, out to the sidewalk and back)
        const ground = far && d < 16 ? actors.groundWay(A.x, A.z, q[0], q[1]) : null;
        if (far) await limit(actors.walkTo(mover.id, q[0], q[1], ground !== null && ground < d * 1.5 + 2 ? { ...over, how: 'straight' } : over), left);
        // (something low between them, a post, a planter's corner: round it. A straight step stops short of a
        // solid, and the grab was then made from three metres off)
        else await limit(actors.stepVia(mover.id, actors.wayRound(A.x, A.z, q[0], q[1]) || around(A, C, q, 1.4, M.O), over), left);
      }
      if (epoch !== mine) return false;
      if (!M.room && Math.hypot(A.x - C.x, A.z - C.z) > D + 0.8) return false;
    }
    actors.meeting(mover.id, null);
    actors.face(mover.id, C.x, C.z);
    if (!centre.down) actors.face(centre.id, A.x, A.z);
    await actors.turned(centre.down ? [mover.id] : [P.id, T.id], 0.9);
    return true;
  }

  /**
   * A QUEUE: whoever walked up to this person earlier in the scene goes back to their own place as the next one
   * (`P`) has their turn, so the ground round them is free.
   */
  function nextInLine(scene, T, P) {
    for (const Q of scene.came?.get(T.id) ?? []) if (Q !== P && Q.astray && !Q.down && !Q.going && !Q.leaving) send(Q, Q.block, Q.spot, { held: Q.held });
  }

  /** Has this person another thing to do, or have done to them, later in this scene (a clip of their own to come)? */
  const moreFor = (scene, step, id) => scene.steps.slice(scene.steps.indexOf(step) + 1).some(q => q.mode !== 'ambient' && (q.actor === id || (q.target === id && CLIP[q.clips[0]]?.pair)));

  /** Is this person's gun up? It comes down by its own clip (aim_lower, at aim_hold's seam), not by a cut. */
  const aiming = id => AIM.has(actors.clipOf(id).name) || AIM.has(actors.clipOf(id).want);
  async function lowerGun(P, rate = 1) {
    if (!aiming(P.id)) return;
    await limit(actors.play(P.id, 'aim_lower'), 2.4 / rate + 0.6);
  }

  /**
   * A BYSTANDER'S REACTION, the city's way (vignettes.js cowerNear): they turn to it, a little to one side or the
   * other by turns, a beat after the one before, and play `name` there (`secs`: for that long, then back to what
   * they were doing; none: until the scene is over). Whoever was walked out of the scene's room turns once there.
   */
  async function react(P, name, x, z, k, scene, mine, secs = null) {
    await actors.seconds(COWER.first + COWER.apart * k);
    if (P.clearing) await limit(P.clearing, 3.5);
    if (epoch !== mine || P.ambient !== scene || P.going || P.down || P.inside) return;
    const A = at(P.id);
    // (still on their way out of the scene's room: nobody crouches while they walk)
    if (A.route) await limit(actors.until(() => !A.route), 2.5);
    if (epoch !== mine || P.ambient !== scene || A.route) return;
    actors.turn(P.id, Math.atan2(x - A.x, z - A.z) + (k % 2 ? COWER.skew : -COWER.skew));
    await actors.turned([P.id], 0.7);
    if (epoch !== mine || P.ambient !== scene) return;
    actors.play(P.id, name, { loop: true, t: (hashOf(P.id) % 24) / 10 });
    if (secs === null) return;
    await actors.seconds(secs);
    if (epoch !== mine || P.ambient !== scene) return;
    P.ambient = null;
    actors.firm(P.id, false);
    actors.stop(P.id);
    startRoutine(P);
  }
  /**
   * A GUN IS OUT: the nearest few people within reach who are no part of the scene and free to react stop what they
   * are doing, turn to it and cower for a few seconds (cowerNear's figures: three within 9 m, 3.2 s and half a
   * second more each). The feed names its own bystanders for some scenes; this is everyone else who would see it.
   */
  function reactNear(scene, x, z, mine) {
    const free = [...people.values()].filter(Q => !Q.off && !Q.away && !Q.transit && !scene.everyone.includes(Q.id) && !Q.busy && !Q.going && !Q.down && !Q.inside && !Q.ambient);
    const picked = reactors(free.map(Q => ({ id: Q.id, x: at(Q.id).x, z: at(Q.id).z })), x, z);
    for (const [k, r] of picked.entries()) {
      const Q = people.get(r.id);
      stopRoutine(Q);
      actors.stop(Q.id);
      Q.ambient = scene;
      actors.firm(Q.id, true);
      react(Q, 'cower', x, z, k, scene, mine, r.secs);
    }
    return picked.length;
  }

  /**
   * Is this person really on the scene's block this hour? A scene's block is where it was resolved, and a call, a
   * text or a deal closed by phone names people who are somewhere else: they play their half where they stand.
   */
  const onBlock = (P, scene) => !!HELD[scene.block] || P.kind === 'npc' || P.block === scene.block || P.end?.block === scene.block;

  async function runStep(scene, step, rate, mine) {
    const P = people.get(step.actor);
    if (!P) return;
    const here = onBlock(P, scene);
    // (whoever is away, at a place that is not loaded, plays nothing: there is nobody there to watch it. Someone on
    // their way in by a cut is waited for like any walker: present() below)
    if (P.away || (!here && P.transit)) return;
    let T = step.target ? people.get(step.target) : null;
    // someone on another block is nobody to walk up to
    if (T && (!here || !onBlock(T, scene) || T.away)) T = null;
    if (!here && step.mode === 'go') return;
    // A NEWCOMER GOES STRAIGHT TO THE PERSON THEY CAME TO SEE: someone still on their way in whose step is with a
    // person is not waited for at a spot of their own. meet() below takes them from wherever they are to their mark
    // (never somebody between a departure and an arrival: a ride has their body until it has set them down)
    const direct = TRADES.has('b') && here && T && !HELD[scene.block] && !!P.going && !P.off && !P.held && !P.transit;
    // NOBODY'S HOUR WAITS FOR SOMEONE STILL WALKING IN TO DO A THING ALONE: it is played when they get there (the
    // trip's own end: send()). The player's own is always waited for
    if (TRADES.has('a') && here && !T && step.mode === 'act' && P.going && !P.off && !P.held && !HELD[scene.block] && P.id !== player && !step.lasting) {
      P.onArrive = { step, rate, epoch: mine };
      return;
    }
    if (here && !direct && (!(await present(P, scene.block, scene.spot)) || epoch !== mine)) return;
    const A = at(P.id);
    // a gun that is up comes down before its holder does anything else (the city's aim_lower, at its seam)
    const gun = step.action === 'shoot' || step.action === 'hold_up';
    if (!gun && aiming(P.id)) await lowerGun(P, rate);
    if (epoch !== mine) return;

    // (a step that walks someone who is indoors: out by the door first)
    if (step.mode === 'go' || T) leave(P);
    if (step.mode === 'go') {
      const clip = step.clips.find(n => CLIP[n]?.loop) ?? null;
      const v = (CLIP[clip]?.speed || PACE[step.action] || 1.6) * rate;
      let to = null;
      let spot = null;
      let lane = false;
      if (step.spot) {
        spot = claim(P, scene.block, step.spot, step.spot === `pad:${P.id}`);
        to = [spot.x, spot.z];
        P.spot = step.spot;
      }
      else if (T) {
        if (!(await present(T, scene.block, scene.spot)) || epoch !== mine) return;
        // (a queue: whoever walked up to this person earlier in the scene goes back to their own place as the next
        // one comes, so the ground round them is free)
        scene.came ??= new Map();
        if (!step.early) nextInLine(scene, T, P);
        scene.came.set(T.id, [...(scene.came.get(T.id) ?? []), P]);
        // to their mark by the person, the distance what they do to them next asks for
        await meet(scene, P, T, gapAhead(scene, step), rate, mine, { v, clip });
        return;
      } else if (!scene.kind.startsWith('move') && !scene.kind.startsWith('release')) {
        // walking, running or limping off: a few metres along the sidewalk, away from the middle of the scene, to
        // the free standing spot nearest that point. By the walkers' lane, like any walk, and OFF it at the end:
        // whoever stops on the lane closes the sidewalk to everyone behind them
        const [ux, uz] = along(A.x, A.z);
        const [cx, cz] = centre(scene);
        const sign = (A.x - cx) * ux + (A.z - cz) * uz >= 0 ? 1 : -1;
        const far = { run: 6, flee: 7, walk: 3, limp: 2.5, carry: 3, sneak: 2.5, led_away: 3, evicted: 2.5, patrol: 4 }[step.action] ?? 3;
        if (P.block && !P.held) {
          spot = claim(P, P.block, 'street', false, actors.laneAlong(A.x, A.z, sign * far), true);
          to = [spot.x, spot.z];
        } else {
          to = actors.laneAlong(A.x, A.z, sign * far, P.id);
          lane = true;
        }
      }
      if (to) {
        if (!step.spot && !spot) P.astray = true;
        actors.face(P.id, null);
        // (a run's clip waits for the body to reach a run; a named spot more than a couple of steps off is walked
        // to by the sidewalk and its entry, like any trip)
        const clipFrom = clip && v > 3.4 ? RUN_FROM : 0;
        if (spot && Math.hypot(A.x - to[0], A.z - to[1]) > 2.5) {
          // (a spot with no entry on the lanes, the pier inside the docks' yard: over the ground when that way is short)
          const d = Math.hypot(A.x - to[0], A.z - to[1]);
          const ground = !spot.entry && d < 28 ? actors.groundWay(A.x, A.z, to[0], to[1]) : null;
          const how = ground !== null && ground < d * 1.5 + 2 ? 'straight' : 'path';
          const out = await limit(actors.walkTo(P.id, to[0], to[1], { v, how, clip, clipFrom, entry: spot.entry, yaw: spot.way ? null : spot.ry }), 14);
          if (out?.arrived) actors.stand(P.id, spot.way ? null : spot);
        } else if (lane) await limit(actors.walkTo(P.id, to[0], to[1], { v, clip, clipFrom }), 14);
        else await limit(actors.stepTo(P.id, to[0], to[1], { v, clip, clipFrom }), 14);
      }
      if (step.action === 'get_up') P.down = false;
      return;
    }

    // ONE ACTION, THE CITY'S ORDER (vignettes.js robSeen, shotScene): what the feed lists as steps of its own are
    // beats of one move, and are played as it plays them.
    //   · the pat-down just before the grab, by the same hand on the same person, IS the grab: stepping in from the
    //     gun's distance and taking it. It is not a pause of its own
    if (scene.merged?.has(step)) return;
    const after = scene.steps[scene.steps.indexOf(step) + 1];
    if (step.action === 'pat_down' && T && after?.action === 'grab' && after.actor === step.actor && after.target === step.target) return;
    if (T) {
      // (the gun comes out: whoever is near and no part of this reacts, when the feed has named nobody to)
      if (gun && !scene.reacted && !scene.steps.some(q => q.action === 'cower')) scene.reacted = 1 + reactNear(scene, at(T.id).x, at(T.id).z, mine);
      if (!(await meet(scene, P, T, gapOf(step), rate, mine, { gun, v: ATTACKS.has(step.action) ? COME_AT * rate : null })) || epoch !== mine) return;
    }
    if (step.action === 'hold_up' && T) {
      //   · the hands go up AS the gun comes up (0.45 s into the draw), not when the hold-up has been held; the gun
      //     is held one beat of aim_hold, to its first seam, and the step ends there, where aim_lower can take over
      if (after?.action === 'hands_up' && after.actor === T.id && !T.down) {
        (scene.merged ??= new Set()).add(after);
        const up = after.clips.find(n => CLIP[n]);
        if (up) actors.seconds(0.45 / rate).then(() => epoch === mine && !T.down && actors.play(T.id, up));
      }
      actors.play(P.id, 'aim_draw');
      // (a hair short of the seam: what takes the gun down next is asked for before the clock crosses it)
      await actors.seconds((CLIP.aim_draw.dur + 0.7) / rate);
      return;
    }
    if (step.action === 'shoot') {
      // THE CITY'S SHOT (vignettes.js shotScene): the gun comes up (aim_draw, which runs into aim_hold by itself),
      // and fires at aim_hold's seam a beat in. The step ends as it fires: whoever is hit goes down on the next
      if (!aiming(P.id)) {
        actors.play(P.id, 'aim_draw');
        await limit(actors.until(() => AIM.has(actors.clipOf(P.id).name)), 1.5);
      }
      if (epoch !== mine) return;
      actors.play(P.id, 'aim_fire', { after: 0.8 });
      await limit(actors.until(() => actors.clipOf(P.id).name === 'aim_fire'), 4 / rate);
      await actors.seconds(0.12);
      return;
    }
    if (step.action === 'get_up') P.down = false;
    // (someone still on their feet from the last thing, a beat being paced, a walk the scene did not wait out, is
    // brought to a stop before they do anything that stands: nobody slides in a clip)
    if (at(P.id).route && !CLIP[step.clips[0]]?.moving) await limit(actors.stepTo(P.id, at(P.id).x, at(P.id).z), 1.5);
    if (epoch !== mine) return;
    for (const [k, asked] of step.clips.entries()) {
      if (!CLIP[asked] || epoch !== mine) continue;
      // NOTHING IS SAT ON, LEANT ON OR WORKED AT THAT IS NOT THERE (seatFor: the city's stand-spot kinds). A step's
      // furniture clip is played on the person's own spot's point for it; with none, they look about instead (the
      // city's own stand-in, deal_lookout), and a one-shot that needs a room is left out. A haggle away from any
      // counter is talked through
      let name = asked === 'haggle_counter' && !String(scene.spot).startsWith('counter') ? 'talk_gesture_b' : asked;
      const seat = seatFor(P, name);
      if (seat && !T && !P.down) {
        const A1 = at(P.id);
        if (Math.hypot(A1.x - seat[0], A1.z - seat[1]) > 0.03) await limit(actors.stepTo(P.id, seat[0], seat[1], { v: LIFE.walk * rate, yaw: seat[2], exact: true }), 4);
        if (epoch !== mine) return;
        actors.turn(P.id, seat[2]);
        await actors.turned([P.id], 1);
      }
      if (seat === false || (seat && (T || !actors.seated(P.id, name)) && name !== NAMES.pace)) {
        if (!(CLIP[name].loop || CLIP[name].hold)) continue;
        name = NAMES.look;
      }
      const clip = CLIP[name];
      const last = k === step.clips.length - 1;
      // a clip the actor just played as the other half of a pair is not played again
      if (P.lastPair === name) {
        P.lastPair = null;
        continue;
      }
      // where the city chains this clip by itself (a fall into lying hurt, a phone coming up into a call)
      let tail = clip;
      for (let n = 0; tail.next && CLIP[tail.next] && n < 4; n++) tail = CLIP[tail.next];
      // (one dab IS the hand-off both ways, the city's brush_pass: a baggie one way, a bill the other. The same two
      // do not do the same thing to each other twice running)
      const twice = clip.pair && T ? `${name}|${[P.id, T.id].sort().join('|')}` : null;
      if (twice && scene.lastPair === twice && !clip.loop && !clip.hold) continue;
      scene.lastPair = twice;
      if (clip.pair && T && !T.down) {
        T.lastPair = clip.pair.with;
        const loops = clip.loop || clip.hold;
        await limit(actors.pair(P.id, T.id, name, { placed: true, hold: loops ? HOLD : null }), (loops ? HOLD : clip.dur) + 3.6);
        // (a loop is blended out here only when its person has nothing more to do in this scene: with something
        // next, that is asked for over it and the two blend through, with no bare stand between: moreFor)
        if ((loops || tail.loop) && !moreFor(scene, step, P.id)) actors.stop(P.id);
        if (CLIP[clip.pair.with]?.loop && !T.down && !moreFor(scene, step, T.id)) actors.stop(T.id);
      } else if (clip.moving && !clip.loop) {
        // a lunge: half a step at the target with the clip over it, and the one on the end of it reels
        const B = T ? at(T.id) : null;
        const A2 = at(P.id);
        const [tx, tz] = B ? [A2.x + (B.x - A2.x) * 0.3, A2.z + (B.z - A2.z) * 0.3] : [A2.x, A2.z];
        if (T && step.reaction && !T.down) actors.play(T.id, step.reaction);
        await limit(actors.stepTo(P.id, tx, tz, { v: 1.6 * rate, clip: name }), 2);
      } else if (step.lasting || tail.name === 'lie_hurt') {
        actors.play(P.id, name, { loop: clip.loop });
        P.down = true;
        await actors.seconds((tail === clip ? 0.5 : clip.dur + 0.4) / rate);
        break;
      } else if (tail !== clip) {
        // the opening of a chain: let it run into its loop, hold there, and leave it playing for what comes next
        actors.play(P.id, name);
        await actors.seconds((clip.dur + HOLD) / rate);
        if (!last) actors.stop(P.id);
      } else if (clip.loop || clip.hold) {
        await limit(actors.play(P.id, name, { hold: Math.min(clip.dur, HOLD) }), HOLD + 1.6);
        if (last && !moreFor(scene, step, P.id)) actors.stop(P.id);
      } else {
        // (a one-shot: its own length, and the wait for its turn when it starts on a seam: get_up, at lie_hurt's wrap)
        await limit(actors.play(P.id, name), clip.dur / rate + 4.5);
      }
    }
  }

  /**
   * Makes room round a big scene: whoever stands within a few steps of it and is no part of it (the buyers' row, an
   * agent on a routine) walks a few metres along the sidewalk, and comes back when it is over. The cuffing, the
   * hold-up or the fight is then in the open instead of inside a knot of people.
   */
  function clearRoom(scene) {
    const [cx, cz] = sceneAt(scene);
    const moved = [];
    // (a gun is staged at 3.5 m: its room is that much wider. An attack's room is a ring of three metres and more
    // round the two; any other big scene keeps the room it had)
    const gun = scene.steps.some(q => q.action === 'shoot' || q.action === 'hold_up');
    const attack = scene.steps.some(q => ATTACK.has(q.action));
    const room = gun ? SHOT_D + 1.5 : 3.6;
    for (const Q of people.values()) {
      // (the scene's own bystanders are moved out of its room too: they film it, or cower, from a few steps off)
      if (Q.off || Q.away || Q.transit || scene.actors.includes(Q.id) || Q.busy || Q.going || Q.down || Q.inside || (Q.ambient && Q.ambient !== scene)) continue;
      const A = at(Q.id);
      const d = Math.hypot(A.x - cx, A.z - cz);
      if (d > room) continue;
      // (whoever keeps a counter stays behind it, unless an attack is on top of them)
      if (Q.kind === 'npc' && !Q.extra && d > (attack ? 2.2 : 1.6)) continue;
      stopRoutine(Q);
      actors.stop(Q.id);
      Q.astray = true;
      Q.cleared = scene;
      moved.push(Q);
      // WHERE TO: a free standing spot of the place OUTSIDE THE RING, the nearest to where they stand (it is their
      // place from now on: nobody walks back to where the trouble was). None within a few steps of the ring (a yard
      // with a handful of spots, all of them inside it): straight out from the scene to the ring's edge and a
      // step beyond, wherever the ground is free. They turn to watch from there.
      let S = Q.block && !Q.held ? claim(Q, Q.block, 'street', false, [A.x, A.z], true, [cx, cz, room + 0.5]) : null;
      if (S && (S.way || Math.hypot(S.x - cx, S.z - cz) > room + 7)) {
        release(Q);
        S = null;
      }
      let to = S ? [S.x, S.z] : null;
      if (!to) {
        const u = d > 0.2 ? [(A.x - cx) / d, (A.z - cz) / d] : [1, 0];
        for (const [more, turn] of [[0.9, 0], [0.9, 0.5], [0.9, -0.5], [1.8, 0], [0.9, 1.0], [0.9, -1.0], [2.6, 0], [1.8, 1.4], [1.8, -1.4]]) {
          const [c, n] = [Math.cos(turn), Math.sin(turn)];
          const p = [cx + (u[0] * c - u[1] * n) * (room + more), cz + (u[0] * n + u[1] * c) * (room + more)];
          if (actors.solidAt(p[0], p[1]) || actors.onRoad(p[0], p[1]) || !actors.free(p[0], p[1], 0.8, [Q.id])) continue;
          if (actors.groundWay(A.x, A.z, p[0], p[1]) === null) continue;
          to = p;
          break;
        }
      }
      if (!to) to = actors.laneAlong(A.x, A.z, room + 1.9 - d, Q.id);
      if (S) Q.astray = false;
      const ground = actors.groundWay(A.x, A.z, to[0], to[1]);
      const far = Math.hypot(to[0] - A.x, to[1] - A.z);
      Q.clearing = actors.walkTo(Q.id, to[0], to[1], { v: 2.6, entry: S?.entry ?? null, how: ground !== null && ground < far * 1.5 + 2 ? 'straight' : 'path' }).then(out => {
        Q.clearing = null;
        if (S && out.arrived) actors.stand(Q.id, S);
        if (out.arrived && Q.cleared === scene) actors.face(Q.id, cx, cz);
      });
    }
    return moved;
  }

  async function runScene(scene, rate, mine) {
    const cast = scene.everyone.map(id => people.get(id)).filter(Boolean);
    const principals = cast.filter(P => (scene.cast ?? scene.actors).includes(P.id));
    // one scene at a time for each of its people: a courier wanted on two blocks finishes the first
    const asked = actors.clock;
    await limit(actors.until(() => principals.every(P => !P.busy)), Math.max(0.1, Math.min(PATIENCE, CURFEW - (actors.clock - hourStart))));
    if (epoch !== mine) return;
    const began = actors.clock;
    const entry = { hour: hourNo, kind: scene.kind, block: scene.block, who: scene.actors.join(' '), at: +(scene.at / 1000).toFixed(1), began: +(began - hourStart).toFixed(1), waited: +(began - asked).toFixed(1), took: null, steps: [], marks: [] };
    scene.entry = entry;
    scene.began = true;
    log.push(entry);
    if (log.length > 400) log.shift();
    for (const P of principals) {
      P.busy += 1;
      stopRoutine(P);
      actors.setRate(P.id, rate);
      // (in a scene they keep their place: nobody is asked to make way for a walker in the middle of one)
      actors.firm(P.id, true);
      if (!P.down && !aiming(P.id)) actors.stop(P.id);
    }
    // a move is only its walk, a held hour only its room: they are under way since the top of the hour and
    // nothing waits for them
    const moveOnly = scene.passive;
    running += 1;
    // a break-in is staged at somebody's door and pad: that pad opens for the scene (it shuts the player's own, the
    // city having one cutaway, and the player's opens again when the scene is over and they are still home)
    const pad = !moveOnly && /^(breakin|door|night:(robbed|job))/.test(scene.kind) ? /^(?:door|pad):(.+)$/.exec(scene.spot)?.[1] : null;
    if (pad && rooms?.show) {
      Promise.resolve(rooms.show(padKey(pad), true)).catch(() => {});
      tell('room', { key: padKey(pad), id: pad, block: scene.block, scene });
    }
    // A SCENE STARTS WHEN ITS PEOPLE ARE NEARLY TOGETHER. Its first step is somebody coming to somebody: the names go
    // up and the camera cuts in when the two are a few steps apart, not while one of them is still a street away
    // (the owner counted eight seconds between a robbery "starting" and the hands going up). The comer walks in on
    // their own trip meanwhile; nothing is added to the hour
    const lead = moveOnly ? null : scene.steps.find(q => q.mode !== 'ambient');
    const [P0, T0] = [people.get(lead?.actor), people.get(lead?.target)];
    if (P0 && T0 && !HELD[scene.block] && onBlock(P0, scene) && onBlock(T0, scene)) {
      const apart = () => (P0.off || T0.off ? 99 : Math.hypot(at(P0.id).x - at(T0.id).x, at(P0.id).z - at(T0.id).z));
      // (someone who is not on stage, an extra not brought on yet, somebody away, is not on the way: its step
      // brings it on, or goes without it)
      const coming = Q => !Q.off && !Q.away;
      // (THE BIG CITY: a place is a yard or a block front, and two people who both stand on it can be ten metres
      // apart. The wait is for somebody ON THEIR WAY: with both of them standing it waited its whole patience,
      // eight seconds of nothing, for a walk only the scene's own first step makes)
      const onWay = () => !!(P0.going || P0.transit || T0.going || T0.transit);
      // (and whoever is still on the way in is being waited for: at a run, like any trip a scene waits for. Not
      // the one walking to open ground to have it done to them: nobody runs to their own robbery)
      const hurried = () => {
        for (const Q of [P0, T0]) if (Q.going && Q.stand?.kind !== 'open') actors.hurry(Q.id, RUN, 'run_getaway', RUN_FROM);
        return false;
      };
      // (THE ONE IT IS DONE TO IS WALKING TO OPEN GROUND: whoever comes for them does not stand and watch them go.
      // They set off after them at once, to a few steps short of where it will happen, and take their mark from
      // there when the other stands. Three seconds of every such hour were one person waiting for the other)
      if (coming(P0) && coming(T0) && T0.going && T0.stand?.kind === 'open' && scene.steps.some(q => ATTACK.has(q.action))) after(P0, T0, scene.steps.some(q => q.action === 'hold_up' || q.action === 'shoot') ? SHOT_D : REACH);
      if (coming(P0) && coming(T0) && onWay() && apart() > NEARLY) await limit(actors.until(() => epoch !== mine || hurried() || !onWay() || apart() <= NEARLY), Math.max(0.1, Math.min(PATIENCE, CURFEW - (actors.clock - hourStart))));
    }
    const cleared = !moveOnly && scene.big ? clearRoom(scene) : [];
    if (!moveOnly) {
      tell('start', scene);
      // the people a scene is about wear their names while it plays: on a crowded sidewalk nothing else finds them
      if (scene.actors.length > 1 || scene.big) for (const P of principals) actors.tag(P.id, true);
    }
    try {
      if (!moveOnly) {
        // the background first (people filming, cowering, craving), so it is there while the scene plays
        const ambient = scene.steps.filter(s => s.mode === 'ambient');
        const [sx, sz] = sceneAt(scene);
        let k = 0;
        for (const step of ambient) {
          const P = people.get(step.actor);
          const name = step.clips.find(n => CLIP[n] && (CLIP[n].loop || CLIP[n].hold));
          if (!P || P.busy && !principals.includes(P) || P.going || P.down || !name) continue;
          stopRoutine(P);
          P.ambient = scene;
          // (one of the scene's own people looking out or pacing plays it where they stand; a bystander turns to
          // the scene first, the city's way: react())
          if (principals.includes(P)) actors.play(P.id, name, { loop: true });
          else {
            actors.firm(P.id, true);
            react(P, name, sx, sz, k++, scene, mine);
          }
        }
        // THE WALK OFF IS NOT WAITED FOR: the steps a scene ends on that only take someone away (the getaway, the
        // limp home, the box carried off) are set going one after the other, and the scene is over
        const acting = scene.steps.filter(q => q.mode !== 'ambient');
        let exits = acting.length;
        if (TRADES.has('e')) while (exits > 0 && acting[exits - 1].mode === 'go' && !acting[exits - 1].target && !acting[exits - 1].spot) exits -= 1;
        const early = new Map();
        for (const [k, step] of acting.entries()) {
          if (epoch !== mine) continue;
          const t = actors.clock;
          // THE NEXT ONE COMES UP WHILE THIS ONE IS SERVED: a walk up to someone, by a person who has no part in the
          // step now playing, starts with it. They take a mark of their own by the person (the city's rule keeps
          // it a body and more from whoever stands there now), and whoever came before them leaves at their turn
          const next = acting[k + 1];
          if (TRADES.has('g') && k + 1 < exits && next?.mode === 'go' && next.target && step.mode === 'act' && step.target && ![step.actor, step.target].includes(next.actor) && people.get(next.actor)) {
            next.early = true;
            early.set(next, runStep(scene, next, rate, mine).catch(err => console.warn('[stage] a walk up fell over:', err)));
          }
          if (early.has(step)) {
            const [T, P] = [people.get(step.target), people.get(step.actor)];
            if (T && P) nextInLine(scene, T, P);
            await early.get(step);
            entry.steps.push(`${step.actor} ${step.action} ${(actors.clock - t).toFixed(1)} (early)`);
            continue;
          }
          if (k >= exits) {
            // (two exits of one person, a run and then a limp, still follow each other)
            const P = people.get(step.actor);
            if (P) P.leaving = (P.leaving ?? Promise.resolve()).then(() => epoch === mine && runStep(scene, step, rate, mine)).catch(() => {});
            entry.steps.push(`${step.actor} ${step.action} (off)`);
            continue;
          }
          await runStep(scene, step, rate, mine);
          entry.steps.push(`${step.actor} ${step.action} ${(actors.clock - t).toFixed(1)}`);
        }
      }
    } finally {
      running -= 1;
      if (pad && rooms?.show) {
        Promise.resolve(rooms.show(padKey(pad), false)).catch(() => {});
        tell('room-shut', { key: padKey(pad), id: pad, block: scene.block, scene });
        const me = player ? people.get(player) : null;
        if (me?.inside && !HELD[me.inside] && me.shown) Promise.resolve(rooms.show(me.inside, true)).catch(() => {});
      }
      entry.took = +(actors.clock - began).toFixed(1);
      for (const Q of cleared) {
        if (Q.cleared !== scene) continue;
        Q.cleared = null;
        actors.face(Q.id, null);
        if (epoch === mine && !Q.busy && !Q.going && !Q.down) send(Q, Q.block, Q.spot, { held: Q.held });
      }
      // (whoever only reacted to it, the feed's bystanders or the ones a gun stopped, is let go)
      for (const Q of people.values()) {
        if (Q.ambient !== scene || cast.includes(Q)) continue;
        Q.ambient = null;
        actors.firm(Q.id, false);
        if (epoch === mine && !Q.busy && !Q.going && !Q.down) {
          actors.stop(Q.id);
          startRoutine(Q);
        }
      }
      if (epoch === mine) {
        for (const P of cast) {
          if (principals.includes(P)) {
            P.busy = Math.max(0, P.busy - 1);
            if (!P.busy) actors.tag(P.id, false);
          }
          P.lastPair = null;
          if (P.ambient === scene) P.ambient = null;
          if (P.busy || P.ambient) continue;
          actors.firm(P.id, false);
          // back to their own place when the scene walked them off it, then the routine. A gun still up comes
          // down first, by its own clip
          // (stood on open ground for it: that was for the scene. Back to a place of their own)
          if (P.stand?.temp) P.astray = true;
          const after = () => {
            if (epoch !== mine || P.busy || P.ambient || P.going) return;
            if (!P.down) {
              actors.stop(P.id);
              actors.face(P.id, null);
            }
            if (P.astray && !P.down) send(P, P.block, P.spot, { held: P.held, v: HURRY });
            else startRoutine(P);
          };
          // (and whoever is walking off, the scene's last steps, does that first)
          if (aiming(P.id) && !P.down) lowerGun(P, rate).then(after);
          else if (P.leaving) P.leaving.then(after);
          else after();
        }
        if (!moveOnly) tell('end', scene);
      } else for (const P of cast) actors.firm(P.id, false);
    }
  }

  // ── the hour ────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * Where a person should be while the hour's scenes play: the block of their first scene, else where they end.
   * `beside`: where the person that scene is with stands on that block, when they are there already (or have just
   * been given their place there): the newcomer takes the free spot nearest them, so their business is a step or
   * two away and not a walk along the kerb.
   */
  function firstStop(plan, id, end) {
    const P = people.get(id);
    const scene = plan.staged.find(s => !s.passive && s.actors.includes(id) && !HELD[s.block] && (s.block === P.block || s.block === end.block));
    return scene ? { block: scene.block, spot: scene.spot, beside: besideOf(scene, P), solo: scene.actors.length < 2 } : null;
  }
  function besideOf(scene, P) {
    for (const id of scene.actors) {
      const Q = people.get(id);
      if (Q && Q !== P && !Q.off && Q.block === scene.block && !Q.held && Q.stand && !Q.stand.way) return [Q.stand.x, Q.stand.z];
    }
    return null;
  }
  function sendToEnd(P, end) {
    if (P.busy) return;
    if (end.held) {
      if (P.held !== end.held || (!P.going && !P.inside && !P.down)) {
        // on foot to the place's door: cuffed for the jail, hurt for the clinic
        const clip = end.held === 'jail' ? 'cuffed_walk' : 'walk_hurt';
        send(P, end.block, 'street', { held: end.held, v: end.held === 'jail' ? 2.2 : 1.8, clip });
      }
    } else send(P, end.block, end.spot);
  }

  /** Before an hour's first trip: who its attacks are done to, and where (their arrival there is set down on open ground). */
  function brief(plan) {
    const victims = victimsOf(plan.scenes);
    for (const P of people.values()) P.openFor = victims[P.id] ?? null;
  }
  /**
   * Plays one hour. Resolves when its scenes are done (walkers may still be arriving). `instant` settles everyone
   * where the hour leaves them and plays nothing.
   */
  async function playHour(plan, { instant = false } = {}) {
    const mine = ++epoch;
    if (instant) {
      for (const [id, end] of Object.entries(plan.ends)) {
        const P = people.get(id);
        if (!P) continue;
        P.routine = plan.routines[id]?.action ?? 'idle';
        settle(P, end.block, end.spot, end.held);
      }
      for (const [id, n] of Object.entries(plan.npcs)) {
        const P = people.get(id);
        if (!P || P.extra) continue;
        P.routine = n.action;
        settle(P, n.block, n.spot);
      }
      for (const P of people.values()) if (P.extra) dismiss(P, true);
      return;
    }
    // ONLY WHAT IS ON STAGE IS STAGED: a scene at a place that is not loaded has nobody to play it and nobody to see
    // it (the panels still tell it). Counted, for the audit
    plan.staged = plan.scenes.filter(s => here(s.block));
    for (const s of plan.scenes) {
      if (s.passive) continue;
      if (here(s.block)) tally.staged += 1;
      else {
        tally.offstage += 1;
        tally.offstageKinds[s.kind] = (tally.offstageKinds[s.kind] ?? 0) + 1;
      }
    }
    // (whoever an attack is done to this hour: on open ground for it. brief() set openFor before any trip of the
    // hour; whoever is there already walks to it now)
    brief(plan);
    // whoever a scene will wait for this hour runs where a walk would be late
    const wanted = new Set(plan.staged.filter(s => !s.passive).flatMap(s => s.actors));
    // (and each person's own scenes, so no routine is started on someone a scene is about to take: soon())
    hourStart = actors.clock;
    hourNo += 1;
    for (const P of people.values()) Object.assign(P, { scenes: [], onArrive: null, leaving: null });
    for (const scene of plan.staged) if (!scene.passive) for (const id of scene.actors) people.get(id)?.scenes.push(scene);
    const castOf = scene => {
      if (scene.passive || !TRADES.has('f')) return scene.actors;
      return scene.actors.filter(id => !people.get(id) || scene.steps.some(q => q.actor === id && q.mode !== 'ambient') || onBlock(people.get(id), scene));
    };
    // the named NPCs take their places for the hour
    for (const [id, n] of Object.entries(plan.npcs)) {
      const P = people.get(id);
      if (!P) continue;
      if (P.extra) {
        // an extra with a scene this hour walks on, at its own block when that is on stage, else where its scene
        // is (the snitch finds people wherever they are); one without goes off
        if (wanted.has(id) && !here(n.block)) n.block = plan.staged.find(s => !s.passive && s.actors.includes(id) && map.BLOCKS[s.block])?.block ?? n.block;
        if (!wanted.has(id) || !here(n.block)) {
          dismiss(P);
          continue;
        }
      }
      const changed = P.routine !== n.action;
      P.routine = n.action;
      // (an extra's place is beside whoever its scene is with, when they stand there already, and it comes on by
      // the lane nearest them)
      const scene = P.extra && n.spot === 'street' ? plan.staged.find(s => !s.passive && s.block === n.block && s.actors.includes(id)) : null;
      const beside = scene ? besideOf(scene, P) : null;
      if (P.extra) summon(P, n.block, n.spot, beside);
      if (P.block !== n.block || P.spot !== n.spot) send(P, n.block, n.spot, { rush: wanted.has(id), beside });
      else if (changed && !P.busy && !P.going && !P.away) startRoutine(P);
    }
    // every agent sets off for where the hour needs it first. NOT ALL IN ONE STEP: ten people who live on one corner
    // and leave it in the same frame meet in its one square and hold each other up (measured: 43 waits of over
    // 2 s in thirteen hours, most of them there). Whoever a scene is waiting for goes first; the others of the
    // block follow a third of a second apart
    const leaving = {};
    const turn = (P, to, first) => {
      if (!P.block || P.block === to || P.inside || P.held || P.away) return 0;
      const L = (leaving[P.block] ??= { first: 0, rest: 0 });
      return first ? 0.12 * L.first++ : 0.5 + 0.33 * L.rest++;
    };
    for (const [id, end] of Object.entries(plan.ends)) {
      const P = people.get(id);
      if (!P) continue;
      P.routine = plan.routines[id]?.action ?? 'idle';
      P.end = end;
      // whoever was left on the ground last hour and is not held is back on their feet
      if (P.down && !end.held) {
        P.down = false;
        // (someone on their back is not blended upright, a plank swinging up: they GET up, when they next walk or
        // stand about: actors.js upright(), live() below)
        if (!P.held && !LYING.has(actors.clipOf(id).name)) actors.stop(id);
      }
      // (about to be attacked where they stand: to open ground, and nothing else moves them this hour before it)
      if (P.openFor && P.openFor === P.block && !P.held && toOpen(P)) continue;
      // to the block of its first scene when it has one out on the street, else straight to where the hour leaves it
      const stop = firstStop(plan, id, end);
      // (at a run when somebody else is in that scene. Someone on their way to do a thing alone only hurries,
      // unless the hour would wait for them: trade a off, or the person playing)
      if (stop && (!P.held || !end.held)) {
        const rush = !stop.solo || !TRADES.has('a') || id === player;
        send(P, stop.block, stop.spot, { rush, beside: stop.spot === 'street' ? stop.beside : null, after: turn(P, stop.block, rush) });
      } else {
        // (the player's own walk is paced to end inside the hour: ownWalk below. Anyone else with nothing to be
        // in time for takes their turn out of the block: the same send sendToEnd would make, a moment later)
        if (id === player) ownWalk(P, end);
        else if (!end.held && !P.busy && !P.held) send(P, end.block, end.spot, { after: turn(P, end.block, false) });
        sendToEnd(P, end);
      }
      if (!P.going && !P.busy) startRoutine(P);
    }
    // Feed order holds for every person: a scene starts once every earlier scene that shares someone with it is
    // done, and no earlier than its own moment. Scenes with nobody in common play side by side, on one block or on
    // several, so one late walker holds up only the scenes that need them.
    const t0 = actors.clock;
    hourStart = t0;
    const playerBlock = player ? plan.ends[player]?.block ?? null : null;
    const chains = new Map();
    const started = [];
    // (who each scene holds, now that everyone has been told where the hour takes them: castOf above)
    for (const P of people.values()) P.scenes = [];
    for (const scene of plan.staged) {
      scene.cast = castOf(scene);
      if (!scene.passive) for (const id of scene.cast) people.get(id)?.scenes.push(scene);
    }
    for (const scene of plan.staged) {
      const rate = scene.rate ?? plan.rate[scene.block] ?? 1;
      // WHEN SOMEONE PLAYS, their own block shows ONE scene at a time, in the order the ticker tells them, so the eye
      // always knows where to look. Scenes on other blocks still run alongside.
      const own = playerBlock && scene.block === playerBlock;
      const before = started.filter(s => !s.scene.passive && !scene.passive && (s.scene.cast.some(id => scene.cast.includes(id)) || (own && s.scene.block === playerBlock))).map(s => s.done);
      const done = Promise.all(before).then(async () => {
        if (epoch !== mine) return;
        const wait = scene.at / 1000 - (actors.clock - t0);
        if (wait > 0) await actors.seconds(wait);
        if (epoch !== mine) return;
        await runScene(scene, rate, mine).catch(err => console.warn('[stage] a scene fell over:', scene.kind, err));
      });
      started.push({ scene, done });
      chains.set(scene, done);
    }
    await Promise.all(chains.values());
    if (epoch !== mine) return;
    // the scenes are done: everyone heads for where the line says they end, and the extras go off
    for (const [id, end] of Object.entries(plan.ends)) {
      const P = people.get(id);
      if (P && id === player) ownWalk(P, end);
      if (P) sendToEnd(P, end);
    }
    for (const P of people.values()) if (P.extra && !P.busy) dismiss(P);
    // THE PLAYER'S OWN WALK ENDS INSIDE ITS HOUR: the hour is not over, and the move menu does not come up, while
    // the person playing is still on their way to where it leaves them (held: that walk is the place's own business)
    const me = player ? people.get(player) : null;
    if (me && !me.held && !me.off) {
      const t1 = actors.clock;
      // (their walk off at the end of a scene, the trip the hour ends on, any walk at all)
      if (me.leaving) await limit(me.leaving, OWN_WALK);
      if (me.going) await limit(me.going, OWN_WALK + 5);
      if (epoch === mine && at(player).route) await limit(actors.until(() => epoch !== mine || !at(player).route), OWN_WALK);
      if (epoch === mine && log.length) log[log.length - 1].ownWalk = +(actors.clock - t1).toFixed(1);
    }
  }
  /**
   * Sets the person playing off for where the hour leaves them at the pace that gets them there in OWN_WALK
   * seconds: a walk when that is enough, up to a run when it is not. (The others hurry at one pace and arrive when
   * they arrive: nobody is waiting to play them.)
   */
  function ownWalk(P, end) {
    if (P.busy || end.held || P.held) return;
    // (a trip by cut has its own pace: travel.js)
    if (cutBetween(P, end.block, end.block, end.spot)) {
      send(P, end.block, end.spot);
      return;
    }
    const [bx, bz] = base(end.block, end.spot);
    const way = actors.wayLength(P.id, bx, bz) ?? Math.hypot(at(P.id).x - bx, at(P.id).z - bz);
    // (a walk speeds up, slows for its corners and steps off the lane at the end: about a second and a half of the time)
    send(P, end.block, end.spot, { v: Math.max(HURRY, Math.min(RUN, way / Math.max(1, OWN_WALK - 1.5))) });
  }

  return {
    people,
    log,
    trips,
    HOUR_MS,
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get running() {
      return running;
    },
    centre,
    base,
    /** Puts one person somewhere at once (the tools' tour of the camera's views). */
    settle(id, block, spot = 'street', held = null) {
      const P = people.get(id);
      if (P) settle(P, block, spot, held);
    },
    /** The seat a person plays (or null): their own pad opens when they are home. */
    setPlayer(id) {
      player = id ?? null;
    },
    /** The followed person (or null): their trips to another zone are the stage's to make (voyage). */
    setLead(id) {
      lead = id ?? null;
    },
    get lead() {
      return lead;
    },
    get hourNo() {
      return hourNo;
    },
    get zone() {
      return zoneId;
    },
    tally,
    here,
    /** The place a person is at, by the book (a block, or the held place), or null. */
    placeOf: id => (people.get(id) ? placeOf(people.get(id)) : null),
    /**
     * THE ZONE CHANGES: these places are loaded now and nothing else is. Everyone is seated afresh: whoever is at a
     * place of the zone stands on a spot of it, everyone else is away. `except` is the person whose trip this is: they
     * are between a departure and an arrival and are left alone.
     */
    setZone(id, { except = null } = {}) {
      zoneId = id;
      zone = new Set(map.ZONES?.[id]?.places ?? Object.keys(map.PLACES ?? map.BLOCKS));
      stands.reset();
      // (the zone's standing spots are looked over against the ground as it now stands: stands.js vet())
      for (const place of zone) stands.vet?.(place);
      // (whoever keeps a counter first: a named place is its first taker's, and it is the keeper's)
      const order = [...people.values()].sort((a, b) => (a.kind === 'npc' && !a.extra ? 0 : 1) - (b.kind === 'npc' && !b.extra ? 0 : 1));
      for (const P of order) {
        if (P.id === except) continue;
        P.stand = null;
        if (P.off) continue;
        if (P.extra) {
          dismiss(P, true);
          continue;
        }
        settle(P, P.block, P.spot ?? 'street', P.held);
      }
    },
    /**
     * The followed person's trip by cut, started by the stage: `between` is awaited while the picture is black.
     * → the trip's promise (it ends when they stand on their spot at the new place).
     */
    voyage(id, end, between = null) {
      const P = people.get(id);
      if (!P) return { arrived: Promise.resolve(false), done: Promise.resolve(false) };
      const to = end.held ?? end.block;
      if (placeOf(P) === to && !P.away && !P.transit) return { arrived: Promise.resolve(true), done: Promise.resolve(true) };
      const clip = end.held === 'jail' ? 'cuffed_walk' : end.held === 'clinic' ? 'walk_hurt' : null;
      let arrive = null;
      const arrived = new Promise(resolve => {
        arrive = resolve;
      });
      const done = trip(P, end.block, end.held ? 'street' : end.spot, { held: end.held ?? null, clip, v: end.held === 'jail' ? 2.2 : end.held === 'clinic' ? 1.8 : null, between, onArrived: arrive });
      done.then(arrive, arrive);
      return { arrived, done };
    },
    /** Is this person on a trip that can be skipped now (setting off, between, or coming in)? */
    riding: id => {
      const a = people.get(id)?.riding;
      return !!a && !a.gone() && !a.skipped;
    },
    /** Skips the trip a person is on: what is playing of it ends at once and they stand at the other end. → did it? */
    skipTrip(id) {
      const a = people.get(id)?.riding;
      if (!a || a.gone() || a.skipped) return false;
      a.skip();
      return true;
    },
    brief,
    /** Drops what is playing: the hour's scenes stop at their next step (the picture is going somewhere else). */
    abort() {
      epoch += 1;
    },
    /** Would the way from where a person is to the place an hour leaves them be a cut? */
    cutTo(id, end) {
      const P = people.get(id);
      return !!P && cutBetween(P, end.held ?? end.block, end.block, end.held ? 'street' : end.spot);
    },

    /** Adds a person the director may move. `kind` is 'agent' or 'npc'. They are stood where they belong at once. */
    add({ id, kind, role = null, block, spot = 'street', held = null, routine = 'idle' }) {
      const P = { id, kind, role, extra: kind === 'npc' && !KEEPERS.has(role) && !new URLSearchParams(location.search).has('oldstage'), off: false, away: false, transit: false, block: null, spot: null, held: null, stand: null, astray: false, shown: false, cleared: null, going: null, tripId: 0, busy: 0, routine, routineId: 0, down: false, inside: null, lastPair: null, ambient: null, end: null };
      people.set(id, P);
      settle(P, block, spot, held);
      // an extra waits off stage until a scene wants it
      if (P.extra) dismiss(P, true);
      return P;
    },
    clear() {
      epoch += 1;
      stands.clear();
      for (const P of people.values()) {
        release(P);
        if (P.inside) {
          open(P, P.inside, false);
          rooms?.leave?.(P.inside, P.id);
        }
      }
      people.clear();
    },
    playHour,
  };
}
