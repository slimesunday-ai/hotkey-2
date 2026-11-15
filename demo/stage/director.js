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
/** ?heads=old: pairs and lines a body's width apart, as they were (to measure the head's room: the audit's `heads`). */
const HEADS_OLD = new URLSearchParams(globalThis.location?.search ?? '').get('heads') === 'old';
/** The person playing is walked to where their hour leaves them in about this many seconds (at 1×), a run if need be. */
const OWN_WALK = 8;
/**
 * THE PLAYER'S OWN WALK INSIDE A PLACE (walkLeg ownPace): at the city's own walkers' pace (HURRY, 2.6 m/s) while the
 * way takes OWN_SECS or less at it (31 m), else a jog quick enough to be there in about that, JOG m/s (the city's run
 * over it from RUN_FROM up). The trailer park's bus stop is 51 to 67 m from its homes by the lane: 11 to 15 s. Only a
 * way a jog takes more than HOP_SECS over is still a hop: none at the run's two places.
 */
const OWN_SECS = 12;
const JOG = [3.4, 4.6];
const HOP_SECS = 16;
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
/** The steps whose clip has two people's hands meet: stood close, side by side to the camera (runStep, markFor). */
const CONTACT = new Set(['hand_off', 'shove', 'grab', 'punch', 'haymaker', 'scuffle', 'cuff', 'bribe']);
/** The clips of a gun that is up (the city's aim clips: they leave by a seam, aim_lower, not by a cut). */
const AIM = new Set(['aim_draw', 'aim_hold', 'aim_fire']);
/** The routines of someone with time on their hands: they take a spot with something to lean or sit on, if there is one. */
const HANGS = new Set(['rest', 'lean', 'sit', 'watch', 'smoke']);
/** The clips of a body on its back (it leaves them by get_up, at lie_hurt's seam). */
const LYING = new Set(['lie_hurt', 'fall_back', 'shove_fall', 'shot_hit']);
/** The actions that put a body on the ground: whoever has one in a scene gets the fall's footprint kept clear. */
const FALLS = new Set(['fall', 'lie_hurt', 'get_shot']);

export function createDirector({ city, actors, map, stands, travel = null, hooks = {}, rooms = null, padKey = id => `pad:${id}`, doorway = null }) {
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
    // (THE ROOM OF A BIG SCENE THAT IS PLAYING is nobody's place to arrive at: clearRoom walks out whoever stands in
    // it when the scene starts, and somebody who came by a ride a few seconds later was set down in it, 1.4 m from
    // a hold-up. Not for the scene's own people)
    if (!clear && spot === 'street') {
      for (const R of rooms_) {
        if (R.block === block && !R.cast.includes(P.id)) {
          clear = R.at;
          break;
        }
      }
    }
    // (whoever has an hour to hang about takes a spot with a wall or a ledge to it, when the block has one free)
    // (`apart`: whoever keeps a place by the `keep` word, the run's locals, stands apart from the others there)
    P.stand = stands.claim(P.id, block, spot, { through, beside, fresh, clear, seat: HANGS.has(P.routine) && !P.extra, apart: P.keep && spot === 'street' && !beside ? 3.2 : 0, roomy: P.id === player && spot === 'street' && !beside ? 1.0 : 0 });
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
  /** The rooms of the big scenes playing now: { block, cast, at: [x, z, r] } (clearRoom; claim keeps arrivals out). */
  const rooms_ = new Set();
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
   * The open ground nearest a point: among the standing spots of the zone within 8 m of it (nobody is stood on
   * ground the place table has not looked at), the nearest with OPEN metres clear round it and a way to it over the
   * ground; else the most open of them, when that is half a metre better than the point itself. Null: the point is
   * open, or nothing better is to be had.
   */
  function openGround(x, z, who = null) {
    if (!actors.solidKnown(x, z)) return null;
    const here0 = clearAt(x, z);
    if (here0 >= OPEN) return null;
    let best = null;
    for (const s of stands.list()) {
      if (s.named || s.by === 'unfit' || !here(s.block)) continue;
      // (nor somebody else's spot, nor within two steps of the open ground somebody else has been given: two people
      // robbed in one hour at the bar were sent to the one open spot, and stood in each other)
      if (s.by && s.by !== who) continue;
      if ([...people.values()].some(Q => Q.id !== who && Q.stand?.temp && Math.hypot(Q.stand.x - s.x, Q.stand.z - s.z) < 2.4)) continue;
      // (nor at the kerb: whoever comes for them needs a place to stand that is not the street)
      if ([0, 1, 2, 3, 4, 5, 6, 7].some(k => actors.onRoad(s.x + Math.sin((k * Math.PI) / 4) * 1.6, s.z + Math.cos((k * Math.PI) / 4) * 1.6))) continue;
      // (nor a spot the ground there has turned out to refuse, a table or a chair on it: its ring was clear and
      // its own point was never asked. The debtor of a collect was stood in a 1.3 m table for a whole scene)
      if (actors.solidAt(s.x, s.z) || actors.lowNear?.(s.x, s.z, 0.9)) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      // (no farther than 8 m: the walk there is the hour waiting. At 14 m a victim at the bar walked for the whole
      // of a scene's patience and the robber for the whole of theirs: a grab of 15.4 s)
      if (d > 8 || actors.onRoad(s.x, s.z)) continue;
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
    return way !== null && way < Math.min(11, best.d * 2 + 6) ? [best.s.x, best.s.z] : null;
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
    const g = openGround(A.x, A.z, P.id);
    if (!g) return false;
    stopRoutine(P);
    const mine = ++P.tripId;
    release(P);
    P.stand = { x: g[0], z: g[1], ry: null, entry: null, kind: 'open', temp: true };
    stands.hold?.(P.id, P.stand);
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
    // (somebody they keep their face to, watching them, or their back to, sour: the run's moods. Else the spot's way)
    const other = P.watch ?? P.shun;
    const O = other && actors.has(other) && !at(other).w.hide ? at(other) : null;
    const A0 = at(P.id);
    const st = O ? Math.atan2(O.x - A0.x, O.z - A0.z) + (P.shun ? Math.PI : 0) : sp.st ?? sp.ry ?? null;
    const facing = spread => (st === null ? null : st + (rn() - 0.5) * (O ? 0.3 : spread));
    const idle = (a, b, spread) => ({ k: 'idle', secs: a + b * rn(), ry: facing(spread) });
    const look = n => ({ k: 'loop', clip: NAMES.look, n, ry: facing(0.8) });
    // (a bench sitter stays sat: the loop again is seamless)
    if (sp.kind === 'bench' && !P.astray) return { k: 'loop', clip: NAMES.bench, at: [sp.x, sp.z, sp.ry ?? 0], n: 3 };
    // what their hour has them at that needs nothing under or behind it: a phone, an earpiece, a guard's stance
    const own = (P.clips ?? ACTION_CLIPS[P.routine] ?? []).filter(n => CLIP[n] && !CLIP[n].moving && !CLIP[n].pair && (P.clips || n !== NAMES.look) && n !== NAMES.pace && seatFor(P, n) === null && (role !== 'work' || P.inside));
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
    // (a routine of its own, named clip by clip: that is what they are at, most of the time)
    if (own.length) opts.push([P.clips ? 12 : role === 'hang' ? 5 : 4, 'own']);
    const left = opts.filter(o => o[1] !== L.prev || o[1] === 'stoop' || o[1] === 'lean' || (o[1] === 'own' && P.clips));
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
    // already there, or already on the way there (unless a scene walked them off their place, or the person they
    // are going to see stands at the far end of the place: the trailer park's neighbours are at their own trailers,
    // its bus stop fifty metres off)
    const far = beside && P.stand && !P.stand.way && Math.hypot(P.stand.x - beside[0], P.stand.z - beside[1]) > 4;
    if (P.block === block && P.spot === spot && P.held === held && !P.astray && !far) return P.going;
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
        // (still in the picture, the walk off having given out: travel.js has left them standing and takes them off
        // once the camera has lost them. Taken off here they went in plain sight)
        if (!actors.seen?.(P.id)) actors.show(P.id, false);
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
        const g = openGround(S.x, S.z, P.id);
        if (g) {
          release(P);
          S = P.stand = { x: g[0], z: g[1], ry: null, entry: null, kind: 'open', temp: true };
          stands.hold?.(P.id, S);
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
      return walkLeg(P, block, spot, { v: clip ? v : null, clip, rush, beside, direct: true, hop: false });
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
  /**
   * WHERE A HOP COMES BACK ON THEM: a few steps short of (x, z), on the side they came `from` when the ground there
   * is free (else turned a little either way, or a little nearer), on the slab, with a short way over the ground to
   * it. Null: nowhere, and they are put at the place itself.
   */
  function arrivalNear(x, z, from, id) {
    const d = Math.hypot(from[0] - x, from[1] - z) || 1;
    const a0 = Math.atan2((from[0] - x) / d, (from[1] - z) / d);
    for (const m of [5, 4, 6, 3]) {
      for (const da of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
        const q = [x + Math.sin(a0 + da) * m, z + Math.cos(a0 + da) * m];
        if (actors.solidAt(q[0], q[1]) || actors.onRoad(q[0], q[1]) || !actors.free(q[0], q[1], 0.9, [id]) || actors.lowNear?.(q[0], q[1], 0.4)) continue;
        const way = actors.groundWay(q[0], q[1], x, z);
        if (way !== null && way < m * 1.6 + 1) return q;
      }
    }
    return null;
  }
  // ── the place's own ways ────────────────────────────────────────────────────────────────────────────────────────
  /**
   * THE WAY ALONG A PLACE'S OWN LANES (the place table's `paths`, citymap.js: Sunny Acres' lanes, where the city's
   * walkers' lanes do not go) from (ax, az) to (bx, bz): { points, metres }, the points to walk through with (bx, bz)
   * last, or null when it is not that kind of walk (no lanes here, both ends in one pad, both on the lane, an end this
   * does not know). A point in a home's pad leaves it by the pad's front and steps on to the lane's middle straight
   * across; a point past a lane's mouth (the bus stop on Elm St) comes in at the mouth; along the lane is its middle
   * line. Each leg goes round whatever stands on it (actors.wayRound). The owner, 2026-11-14: he walks on the lanes
   * and paths, not through the yards between.
   */
  function laneWay(block, ax, az, bx, bz, who = null) {
    const T = map.PLACES?.[block] ?? map.BLOCKS?.[block];
    const lanes = T?.paths;
    if (!lanes?.length) return null;
    const homes = T.homes ?? [];
    const inRect = (r, x, z) => x >= r[0] - 0.2 && x <= r[2] + 0.2 && z >= r[1] - 0.2 && z <= r[3] + 0.2;
    // A PAD'S WAY ON TO THE LANE: its edge on the lane at its front, or a step or two along the edge from there when
    // somebody stands at it (Gloria on the phone at her front, held head-on with the player for six seconds) or
    // something does (the swap meet's cart in front of Pad 25)
    const exitOf = (h, L) => {
      const zc = L.line[0][1];
      const ze = zc + (Math.sign(h.front[1] - zc) || 1) * (L.half - 0.4);
      for (const dx of [0, 1.6, -1.6, 3, -3]) {
        const x = h.front[0] + dx;
        if (x < h.rect[0] + 0.5 || x > h.rect[2] - 0.5 || actors.solidAt(x, ze) || actors.nextTo(x, ze, 1.3, who).length) continue;
        return [x, ze];
      }
      return [h.front[0], ze];
    };
    // where a point is: on a lane, in a home's pad (and where it comes on to the lane), a short step past a lane's
    // mouth on Elm St (it comes in at the mouth), or nowhere this knows
    const where = (x, z) => {
      for (const L of lanes) {
        const [[x0, zc], [x1]] = L.line;
        if (x >= x0 - 0.5 && x <= x1 + 0.5 && Math.abs(z - zc) <= L.half) return { L, on: true, join: [x, z] };
      }
      const h = homes.find(q => q.rect && q.front && inRect(q.rect, x, z));
      if (h) {
        const L = lanes.find(q => q.lane === h.lane) ?? lanes[0];
        return { L, on: false, join: exitOf(h, L), home: h };
      }
      let best = null;
      for (const L of lanes) {
        const m = L.line[1];
        const d = Math.hypot(x - m[0], z - m[1]);
        if (x > m[0] && d < 14 && (!best || d < best.d)) best = { d, L, on: false, join: [m[0], m[1]] };
      }
      return best;
    };
    const A = where(ax, az);
    const B = where(bx, bz);
    // (both on the lane, both in one pad, or both out past the mouth on Elm St: not a walk through the park)
    const outside = Q => !Q.on && !Q.home;
    if (!A || !B || (A.on && B.on) || (A.home && A.home === B.home) || (outside(A) && outside(B))) return null;
    const via = [];
    if (!A.on) via.push(A.join);
    // (two lanes meet on Elm St: out of one at its mouth, along the sidewalk, in at the other's. Along one lane, a
    // way of more than a few pads goes down its middle)
    if (A.L !== B.L) via.push(A.L.line[1], B.L.line[1]);
    else if (Math.abs(B.join[0] - A.join[0]) > 8) via.push([A.join[0], A.L.line[0][1]], [B.join[0], A.L.line[0][1]]);
    if (!B.on) via.push(B.join);
    via.push([bx, bz]);
    const points = [];
    let [px, pz] = [ax, az];
    let metres = 0;
    for (const [k, q] of via.entries()) {
      if (Math.hypot(q[0] - px, q[1] - pz) < 0.3) continue;
      const round = actors.wayRound(px, pz, q[0], q[1]);
      // (a point of the way that cannot be got to, a pad's front with the swap meet's cart or speaker standing on
      // it: left out, and the way goes on to the next point round whatever it is. The last one cannot be left out)
      if (round === false) {
        if (k < via.length - 1) continue;
        return null;
      }
      for (const r of round || [q]) {
        metres += Math.hypot(r[0] - px, r[1] - pz);
        points.push(r);
        [px, pz] = r;
      }
    }
    return points.length ? { points, metres } : null;
  }
  /** Does the straight line between two points cross a roadway (the walk over the ground would cut across a street)? */
  function acrossRoad(ax, az, bx, bz) {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5);
    for (let k = 1; k < n; k++) if (actors.onRoad(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n)) return true;
    return false;
  }
  /** Walks a person through `points` (laneWay) as walkTo would: → { seconds, metres, arrived }. */
  async function walkVia(P, points, { v, clip = null, clipFrom = 0, yaw = null }) {
    const [t0, A] = [actors.clock, at(P.id)];
    const [x0, z0] = [A.x, A.z];
    const arrived = await actors.stepVia(P.id, points, { v, clip, clipFrom, yaw });
    let metres = 0;
    let [px, pz] = [x0, z0];
    for (const q of points) {
      metres += Math.hypot(q[0] - px, q[1] - pz);
      [px, pz] = q;
    }
    return { seconds: actors.clock - t0, metres, arrived };
  }
  /** THE PLAYER'S OWN PACE for a way of `metres` (walkLeg, meet): a walk, or a jog. → { v, clip, clipFrom } */
  function ownPace(metres) {
    if (metres <= HURRY * OWN_SECS) return { v: HURRY, clip: null, clipFrom: 0 };
    return { v: Math.min(JOG[1], Math.max(JOG[0], metres / OWN_SECS)), clip: 'run_getaway', clipFrom: RUN_FROM };
  }
  /**
   * HOW LONG A SCENE WAITS FOR THE PLAYER'S OWN WALK: what is left of it at its pace, and a little. His walk is the
   * hour: a scene never plays without him, and never cuts his walk short at its patience (the bus stop's eight seconds).
   */
  function ownLeft(P) {
    if (!P || P.id !== player || !P.going) return 0;
    // (when walkLeg expects him there, `ownBy`, and three seconds more: a walk held up behind somebody is not waited
    // for past that. Still coming out of his own door, nothing laid yet: a moment more)
    const R = at(P.id)?.route;
    const left = P.ownBy ? P.ownBy - actors.clock : R ? (R.metres - R.m) / Math.max(1, R.v) : 1;
    return left > -3 ? left + 3 : 0;
  }
  /** Waits for a promise as `limit` does, and for as long after as the player's own walk still has to go (ownLeft). */
  async function patient(P, promise, s) {
    const t0 = actors.clock;
    let out = await limit(promise, s);
    while (out === undefined && ownLeft(P) > 0.05 && actors.clock - t0 < 30) out = await limit(promise, ownLeft(P));
    return out;
  }

  /** The walk to a spot of a place that is on stage, from wherever on stage they are (the old `send`). */
  function walkLeg(P, block, spot, { v = null, clip = null, rush = false, beside = null, after = 0, direct = false, hop: canHop = true, outside = false } = {}) {
    const held = null;
    // THE PLAYER'S OWN DOOR IS WALKED (doorway.js: the city's way into the pad): out of it across the room and through
    // the door before this walk, in at it after. Anyone else's pad, and a pad with no way known, is the cut as before
    const mineDoor = key => (doorway && P.id === player && key && !HELD[key] && doorway.has(key) ? key : null);
    const outOf = mineDoor(P.inside);
    const into = spot === `pad:${P.id}` ? mineDoor(padKey(P.id)) : null;
    P.astray = false;
    P.ownBy = null;
    stopRoutine(P);
    const mine = ++P.tripId;
    travel?.cancel?.(P.id);
    const place = block;
    // (set down on open ground for what is about to happen to them: that is their place for the hour)
    const S = P.stand?.temp && P.openFor === block && spot === 'street' ? P.stand : claim(P, place, spot, spot === `pad:${P.id}`, beside);
    // (going in at their own door: to its step, then through it)
    const [x, z] = into ? doorway.step(into) : [S.x, S.z];
    const A = at(P.id);
    if (!outOf) leave(P);
    tally.walks += 1;
    Object.assign(P, { block, spot, held, away: false, transit: false });
    if (outOf) {
      // (out through the door first; the walk on starts from the step)
      const walking = (async () => {
        const out = await doorway.out(P.id, outOf, { alive: () => P.tripId === mine, shut: () => comeOut(P, { walked: true }) });
        if (P.tripId !== mine) return false;
        if (!out) comeOut(P);
        P.going = null;
        return walkLeg(P, block, spot, { v, clip, rush, beside, direct: true, hop: true, outside: true });
      })();
      P.going = walking;
      return walking;
    }
    const d = Math.hypot(A.x - x, A.z - z);
    // (THE PLACE'S OWN LANES, Sunny Acres': from one home to another, or out to its bus stop, down the pad to its
    // front and along the lane, not across the yards between. laneWay)
    const lanes = S.kind !== 'bench' && d > 3 ? laneWay(place, A.x, A.z, x, z, P.id) : null;
    // a couple of steps are a straight step; anything more goes by the sidewalks, off this spot and on to that one by
    // their entry points on the lane. (`direct`: the walk in after an arrival. They were put down a few steps from
    // the place: over the ground to their spot when that way is short, not out to the lane and round by it)
    // And a spot with NO ENTRY, inside a yard, a lot or a plaza: the lanes do not lead to it. From another point of
    // the same yard the way is over the ground, not out to the sidewalk and back in by the gate.)
    // (never to a bench seat: the seat is the bench, and the way to it is walked up to its front and then sat on)
    const ground = !lanes && S.kind !== 'bench' && ((direct && d < 16) || (!S.entry && d < 28)) && !acrossRoad(A.x, A.z, x, z) ? actors.groundWay(A.x, A.z, x, z) : null;
    const near = !lanes && (d < 2.5 || (ground !== null && ground < d * 1.5 + 2));
    const metres = lanes ? lanes.metres : near ? d : actors.wayLength(P.id, x, z, S.entry) ?? d;
    // THE PLAYER WALKS WHAT IS NEAR (the owner, 2026-11-14: "if something is nearby like a bus stop, how long does it
    // take to walk there, not everything should be a cut scene or should it?"). Within a place and round it he is
    // seen walking, the camera with him: at a walk while that takes OWN_SECS or less, else at a jog (ownPace). A cut is
    // for a trip to another place. Only a way longer than a jog covers in HOP_SECS is still a HOP (set off, black,
    // a few steps from it, walking in): none at the trailer park or the flea market
    const mineWalk = P.id === player && P.id === lead && !clip;
    const hop = canHop && (!direct || outside) && mineWalk && !!travel?.fade && !near && metres / JOG[1] > HOP_SECS;
    // the hurry of the city's own walkers; at a run when a scene is waiting for them and the way is more than a few
    // steps (`rush`). Otherwise the hurry is enough and they arrive when they arrive. The player's own: ownPace
    const own = mineWalk ? ownPace(metres) : null;
    const pace = own ? own.v : v ?? (rush && metres > 9 ? RUN : HURRY);
    // (when he should be there: a scene waits that long for him, ownLeft)
    P.ownBy = own ? actors.clock + after + metres / pace + 1.5 : null;
    const run = !clip && pace > 3.4;
    const over = clip ?? (run ? 'run_getaway' : null);
    const note = { hour: hourNo, id: P.id, to: `${place}/${spot}`, xz: [+x.toFixed(1), +z.toFixed(1)], straight: +d.toFixed(0), way: +metres.toFixed(0), pace: +pace.toFixed(1), took: null, metres: null, ended: 'replaced', at: +(actors.clock - hourStart).toFixed(1), rush };
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
      let how = near ? 'straight' : 'path';
      if (hop) {
        const from = [A.x, A.z];
        actors.walkTo(P.id, x, z, { v: HURRY, how: 'path', entry: S.entry });
        await actors.seconds(0.7);
        if (P.tripId !== mine) return false;
        await travel.fade.out();
        try {
          if (P.tripId !== mine) return false;
          const q = arrivalNear(x, z, from, P.id);
          if (q) {
            actors.place(P.id, q[0], q[1], Math.atan2(x - q[0], z - q[1]));
            // (the camera is put on them there, under the black: index.js camera.arrived)
            hooks.cut?.(P.id);
            await actors.seconds(0.1);
            how = 'straight';
          }
          tally.hops = (tally.hops ?? 0) + 1;
        } finally {
          travel.fade.in();
        }
        if (P.tripId !== mine) return false;
      }
      const yaw = S.way ? null : S.ry ?? facing(x, z);
      const out = lanes && !hop ? await walkVia(P, lanes.points, { v: pace, clip: over, clipFrom: run ? RUN_FROM : 0, yaw }) : await actors.walkTo(P.id, x, z, { v: hop ? HURRY : pace, how, clip: hop ? null : over, clipFrom: run && !hop ? RUN_FROM : 0, entry: S.entry, yaw });
      if (P.tripId === mine) actors.passing(P.id, null);
      Object.assign(note, { took: +out.seconds.toFixed(1), metres: +out.metres.toFixed(0), ended: out.arrived ? 'arrived' : 'replaced' });
      if (P.tripId !== mine) return false;
      if (!out.arrived) {
        // a scene took them on the way: the trip is over, and they are not where it was going
        P.going = null;
        P.astray = true;
        return false;
      }
      if (into) {
        // in at their own door: it opens, they go in, it shuts, the room opens round them, and to their place in it
        const ok = await doorway.in(P.id, into, { alive: () => P.tripId === mine, open: () => open(P, into, true) });
        if (P.tripId !== mine) return false;
        P.going = null;
        enter(P, into, { walked: ok });
        startRoutine(P);
        return true;
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
  /**
   * WHAT THE HELD PLACE PUTS ITS PEOPLE IN (the owner, 2026-11-12: "we cut to the jail, and your in an orange
   * jumpsuit until you pass the time"): from the cut into the jail's keeping until they are let go, a held person
   * wears the place's own issue, the city's county orange (citymap.js HELD `wear`, an outfit of the city's cast: what
   * its own inmates in the yard wear); out of it, their own clothes. Called wherever `inside` changes.
   */
  function garb(P) {
    actors.wear(P.id, HELD[P.inside]?.wear ?? null);
  }
  function comeOut(P, { walked = false } = {}) {
    if (!P.inside) return;
    if (HELD[P.inside]) {
      // (a held place is open air: they are let go where they sit, and leave from there)
      rooms?.leave?.(P.inside, P.id);
      P.inside = null;
      P.down = false;
      garb(P);
      release(P);
      return;
    }
    const A = at(P.id);
    // (`walked`: out through the door on foot, doorway.js, and standing on the step: nobody is put anywhere)
    if (!walked) {
      const [ex, ez] = base(P.block, `door:${P.id}`) ?? [A.x, A.z];
      actors.place(P.id, ex, ez, facing(ex, ez));
    }
    open(P, P.inside, false);
    rooms?.leave?.(P.inside, P.id);
    P.inside = null;
    P.down = false;
  }
  /**
   * Through a door: into the set's room for that key ('jail', 'clinic', or an agent's own pad) when it has one, else
   * staying where the walk ended (the door). A held person keeps the pose their hour gives them.
   */
  function enter(P, key, { walked = false } = {}) {
    if (HELD[key]) {
      // IN THE HELD PLACE'S KEEPING: a spot of its own (stands.js: a real bench seat while one is free), in the open
      const S = stands.claim(P.id, key, 'in');
      P.stand = S;
      actors.place(P.id, S.x, S.z, S.ry ?? facing(S.x, S.z));
      actors.stand(P.id, S);
      P.inside = key;
      P.down = true;
      garb(P);
      return;
    }
    // (the set's rooms keep a place per person: the same cot or bench for as long as they are in. The player's own
    // place with an inside view, doorway.js and inside.js: where they stand in that view)
    const anchor = (P.id === player && doorway?.has(key) ? doorway.anchor(key) : null) ?? rooms?.anchor?.(key, P.id);
    if (anchor) {
      // a pad's place is at its open front, where the cut hides half of whoever stands there: a good step further in.
      // An EXACT anchor (the fifth entry: the city's plan of the room, its clear floor) is stood on as it is, and
      // whoever walked in to it (doorway.js) is there already
      const ry = anchor[3] ?? 0;
      const inward = HELD[key] || anchor[4] ? 0 : 1.3;
      if (!walked) actors.place(P.id, anchor[0] - Math.sin(ry) * inward, anchor[2] - Math.cos(ry) * inward, ry, anchor[1]);
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
    if (!HELD[key] && P.id !== player) return undefined;
    if (on === !!P.shown) return undefined;
    P.shown = on;
    // (the player's own place with an inside is seen in its inside view, inside.js, never cut open where it stands)
    const inner = !HELD[key] && P.id === player && doorway?.has(key);
    const done = Promise.resolve(inner ? doorway.view(key, on) : rooms?.show?.(key, on)).catch(err => console.warn('[stage] the room did not open:', key, err));
    tell(on ? 'room' : 'room-shut', { key, id: P.id, block: HELD[key] ? key : P.block });
    return done;
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
    garb(P);
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
  async function present(P, block, spot = 'street', grace = 0) {
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
    // (the player walks at his own pace, and is waited for: ownLeft)
    if (P.stand?.kind !== 'open' && P.id !== player) actors.hurry(P.id, RUN, 'run_getaway', RUN_FROM);
    // late in the hour nobody is waited for: the scene plays without whoever is still on the way
    // (BUT SOMEBODY WHO IS AT THE PLACE, walking a few steps back to their spot after making room for the scene
    // before, is not "on the way": they are given two and a half seconds whatever the hour. Without that the Dunn
    // brothers' robbery at the bar, the third scene of a long hour, was not played at all: its victim was three
    // steps from his spot when it began)
    // (`grace`: asked for by a step of an attack done TO them, meet(). Nothing else is held up for it)
    const near = grace > 0 && !P.transit && !P.away && P.block === block && !P.held && !HELD[block];
    const left = Math.max(near ? grace : 0, ownLeft(P), Math.min(PATIENCE, CURFEW - (actors.clock - hourStart)));
    if (left <= 0) return false;
    return (await patient(P, P.going, left)) !== undefined;
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
    // (a row of street buyers, `…:1` to `…:6`: each from their own point, by turns from the two sides and a body
    // and a half further out each pair. By the hash alone two of six came on at one point, one inside the other)
    const n = Number(/:(\d+)$/.exec(P.id)?.[1]) || 0;
    const side = n ? (n % 2 ? 1 : -1) : hashOf(P.id) % 2 ? 1 : -1;
    const far = n ? WINGS + Math.floor((n - 1) / 2) * 1.6 : WINGS + (hashOf(P.id) % (WINGS > 6 ? 5 : 3));
    const q = actors.laneAlong(bx, bz, side * far);
    // (WHOEVER THEY HAVE COME TO SEE STANDS FAR FROM ANY SIDEWALK, at the park's bandstand, twenty metres in: they
    // come on ten metres from that person, on the sidewalk's side, each a step from the next, with a way over the
    // ground to them. From the sidewalk the first buyer's walk in was 12.8 s of an hour waiting for it)
    if (near) {
      const dq = Math.hypot(q[0] - bx, q[1] - bz);
      if (dq > 13) {
        const [ux, uz] = [(q[0] - bx) / dq, (q[1] - bz) / dq];
        const off = side * (0.8 + Math.floor(((n || 1) - 1) / 2) * 1.3);
        for (const r of [10, 8.5, 11.5]) {
          const p = [bx + ux * r - uz * off, bz + uz * r + ux * off];
          if (actors.solidKnown(p[0], p[1]) && !actors.solidAt(p[0], p[1]) && !actors.onRoad(p[0], p[1]) && actors.groundWay(p[0], p[1], bx, bz) !== null) return p;
        }
      }
    }
    // (a place with no sidewalk, the trailer park's lane or the island's yard: they come on by the place's way in)
    if (Math.hypot(q[0] - bx, q[1] - bz) < 3 && travel && map.PLACES?.[block]) return travel.wayIn(block, null).slice(0, 2);
    return q;
  }
  // NOBODY COMES ON OR GOES OFF IN THE PICTURE (the owner: "why are people just vanishing off the map?"). An extra
  // comes on where the camera does not see (up the lane past the edge of the picture: further than the wings when
  // the wings are in it) and walks in; going off, they walk up the lane until the camera has lost them, and only
  // then are taken off. Somebody still walking off when their next scene wants them turns back from where they are.
  // (actors.js audit: `vanish`)
  /**
   * A point of the walkers' lanes the camera does not see, on a ring round (cx, cz) 24 to 68 m out, with a way to it
   * from (wx, wz): the first found from the heading `a0` round (each person a little off the next).
   */
  function offPoint(P, cx, cz, wx, wz, a0) {
    const a1 = a0 + (hashOf(P.id) % 5) * 0.11;
    for (const r of [24, 32, 42, 54, 68]) {
      for (let k = 0; k < 12; k++) {
        const a = a1 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6);
        const q = actors.laneAlong(cx + Math.sin(a) * r, cz + Math.cos(a) * r, 0);
        if (actors.inPicture(q[0], q[1]) || actors.onRoad(q[0], q[1]) || actors.solidAt(q[0], q[1])) continue;
        if (actors.routeOf(wx, wz, q[0], q[1])) return q;
      }
    }
    return null;
  }
  /** Where an extra comes on: the wings, else a point of the lanes further out (24 to 68 m) that the camera does not see. */
  function offstage(P, block, spot, near) {
    const first = wings(P, block, spot, near);
    if (!actors.inPicture(first[0], first[1])) return first;
    const [bx, bz] = near ?? base(block, spot);
    return offPoint(P, bx, bz, first[0], first[1], Math.atan2(first[0] - bx, first[1] - bz)) ?? first;
  }
  function summon(P, block, spot, near = null) {
    if (!P.off) return;
    const walking = !at(P.id).w.hide;
    const [x, z] = walking ? [0, 0] : offstage(P, block, spot, near);
    P.off = false;
    P.tripId += 1;
    release(P);
    Object.assign(P, { block: null, spot: null, held: null, going: null, fled: false });
    // (still on their way off, and in the picture: they turn back from there)
    if (walking) return;
    actors.place(P.id, x, z, 0);
    actors.show(P.id, true);
  }
  /** Walks (or runs) on, away from the place, to a point the camera does not see, until it has lost them. */
  async function offPicture(P, trip, from, fled) {
    for (let k = 0; k < 3; k++) {
      if (!P.off || P.tripId !== trip) return;
      const A = at(P.id);
      if (!actors.inPicture(A.x, A.z)) return;
      const q = offPoint(P, A.x, A.z, A.x, A.z, Math.atan2(A.x - from[0], A.z - from[1]));
      if (!q) return;
      await limit(actors.walkTo(P.id, q[0], q[1], { v: fled ? RUN : HURRY, clip: fled ? 'run_getaway' : null, clipFrom: fled ? RUN_FROM : 0 }), 20);
    }
  }
  function dismiss(P, now = false) {
    if (P.off) return;
    P.off = true;
    P.tripId += 1;
    const trip = P.tripId;
    P.going = null;
    stopRoutine(P);
    release(P);
    actors.stop(P.id);
    const leave = () => {
      if (P.off && P.tripId === trip) actors.show(P.id, false);
    };
    // (`now`: a whole hour settled at once, the picture cut for it: the run's skip and its morning, demo/run/index.js)
    if (now || !P.block) {
      leave();
      return;
    }
    const from = base(P.block, P.spot ?? 'street');
    const [x, z] = wings(P, P.block, P.spot ?? 'street');
    actors.face(P.id, null);
    // (whoever ran from the scene, the robbers seen off or away with it, runs on out of the picture)
    const fled = !!P.fled || P.role === 'npcRobber';
    const go = (tx, tz) => actors.walkTo(P.id, tx, tz, { v: fled ? RUN : HURRY, clip: fled ? 'run_getaway' : null, clipFrom: fled ? RUN_FROM : 0 });
    // (the wings in the picture: straight for a point out of it)
    const out = actors.inPicture(x, z) ? offPoint(P, at(P.id).x, at(P.id).z, at(P.id).x, at(P.id).z, Math.atan2(at(P.id).x - from[0], at(P.id).z - from[1])) : null;
    limit(go(...(out ?? [x, z])), 24).then(() => offPicture(P, trip, from, fled)).then(leave);
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
  function markFor(scene, P, T, D, gun, contact = false) {
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
    // (nor whoever is SITTING: a seller on a bench was asked to step to clearer ground for a buyer and slid off the
    // seat, still sitting: the audit's `slide` and `unseated`)
    const fixed = T.down || !!T.inside || (T.kind === 'npc' && !T.extra) || /^(sit_|sleep|lie_)/.test(actors.clipOf(T.id).name ?? '');
    // (a mark that follows another of the same two, the grab after the gun: on the axis they already stand on when
    // the ground allows it. Turned side-on to the camera it was a walk round the very person held up, 2.4 s of it,
    // to take what they hold)
    // (TWO PEOPLE CLOSE ARE SEEN SIDE BY SIDE, NOT ONE OVER THE OTHER. The city's figures have heads a metre across:
    // a pair at a hand-off's reach on the camera's own bearing is one head on top of the other in the picture. A
    // contact step's axis is held hard across the camera's view, any other pair's a little)
    const side = gun ? 5 : HEADS_OLD ? (had ? 0 : 2) : contact ? 14 : had ? 0 : 10;
    // (and the partner's mark is a head and a hand from anybody else standing there: actors.headGap)
    const clear = HEADS_OLD ? undefined : Math.max(1.3, actors.headGap(P.id) - 0.2);
    const pl = placeFor(O, { x: C.x, z: C.z, y: C.y }, u0, { D, falls, people: others(C.x, C.z, D + 5, [P.id, T.id]), los: gun, side, cam: city.camera.position, fixed, clear });
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
  /** Seconds a scene waits, even late in the hour, for somebody who is at the place: only when it has an attack in it. */
  const graceFor = scene => (scene.steps.some(q => ATTACK.has(q.action)) ? 2.5 : 0);
  async function meet(scene, P, T, D, rate, mine, { gun = false, v = null, clip = null } = {}) {
    // (an ATTACK is never left out because the one it is done to is three steps from their spot late in a long
    // hour: graceFor. A street sale's late hand-offs are left as they were: not played past the hour's curfew)
    if (!(await present(T, scene.block, scene.spot, graceFor(scene))) || epoch !== mine) return false;
    leave(P);
    // (whoever is at home comes to their door for someone who has come to them: nobody talks to a wall)
    if (T.inside && !HELD[T.inside]) {
      leave(T);
      T.astray = true;
    }
    const had = !!scene.marks?.get([P.id, T.id].sort().join('|'));
    // (A PAIR THAT DOES NOT TOUCH STANDS A HEAD APART: two people talking, a sale talked through, a look. Their heads,
    // a metre across, and a hand between: actors.headGap. A contact step keeps its clip's own reach)
    const contact = at(P.id).contact === T.id;
    if (!contact && !gun && !HEADS_OLD) D = Math.max(D, actors.headGap(P.id, T.id));
    // (WHOEVER IS SITTING STAYS SITTING, and the other comes to them: a seller on a bench handing off to a buyer who
    // is not at their mark yet was walked to the buyer, still sitting: the audit's `slide` and `unseated`)
    const sits = Q => /^(sit_|sleep|lie_)/.test(actors.clipOf(Q.id).name ?? '');
    const M = sits(P) && !sits(T) && !T.down && !T.inside ? markFor(scene, T, P, D, gun, contact) : markFor(scene, P, T, D, gun, contact);
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
    // (a pair that does not touch and could only be stood along the camera's bearing, a keeper at a counter with the
    // stall on one side: a little further apart, so the nearer head does not sit over the other in the picture)
    if (!contact && !gun && !HEADS_OLD) {
      const cam = city.camera.position;
      const cl = Math.hypot(cam.x - C.x, cam.z - C.z) || 1;
      const inline = Math.abs((M.u[0] * (cam.x - C.x) + M.u[1] * (cam.z - C.z)) / cl);
      if (inline > 0.5) D = Math.max(D, actors.headGap(mover.id, centre.id) * (1 + 0.45 * inline));
    }
    const q = [C.x + M.u[0] * D, C.z + M.u[1] * D];
    // (a mark in something solid, or with its back in it, a stall's counter across the flea market's aisle: brought
    // in toward the one who stays until it is clear, a little short of the distance asked for)
    for (let k = 0; k < 3 && D - 0.15 * k > 0.9 && !M.room && (actors.solidAt(q[0], q[1]) || actors.solidAt(q[0] + M.u[0] * 0.3, q[1] + M.u[1] * 0.3)); k++) {
      q[0] -= M.u[0] * 0.15;
      q[1] -= M.u[1] * 0.15;
    }
    if (!HEADS_OLD) makeWay(scene, mover, centre, q);
    const d = Math.hypot(A.x - q[0], A.z - q[1]);
    // (the one who stays is where the walk is going, not in its way: actors.js bodyAhead)
    actors.meeting(mover.id, centre.id);
    if (d > 0.3 && !mover.down) {
      mover.astray = true;
      mover.tripId += 1;
      mover.going = null;
      // (the step in from a gun's distance is the scene's own last two metres: the hour's end does not cut it to a
      // grab made across the yard)
      let left = Math.max(had ? 3 : 1.5, Math.min(PATIENCE, CURFEW - (actors.clock - hourStart)));
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
        // (still a street away: at a run, like any trip a scene is waiting for. The player at his own pace, a walk or
        // a jog, and the scene waits for all of it: ownPace)
        const own = mover.id === player && !clip && !gun ? ownPace(way) : null;
        const run = !own && !clip && way > 9;
        const pace = own ? Math.max(own.v, v ?? 0) : run ? RUN : v ?? 2.6 * rate;
        const over = own ? { v: pace, clip: own.clip, clipFrom: own.clipFrom } : { v: pace, clip: clip ?? (run ? 'run_getaway' : null), clipFrom: run ? RUN_FROM : clip && pace > 3.4 ? RUN_FROM : 0 };
        if (own) left = Math.max(left, way / pace + 3);
        // (a few steps over open ground are walked over the ground: by the lanes the four metres to a mark in the
        // night market's yard were eight, out to the sidewalk and back)
        // (never across a roadway when there is a way round by the crossings: the player was walked straight over
        // Jay St between two parked cars to the man with a camera at the taxi stop)
        const ground = far && d < 16 && !acrossRoad(A.x, A.z, q[0], q[1]) ? actors.groundWay(A.x, A.z, q[0], q[1]) : null;
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
   * ROOM FOR THE PAIR'S HEADS: whoever stands within a head and a hand of where the pair will stand (the mover's mark
   * `q`, the one who stays) and is no part of the scene steps back from it, a short straight step to just clear of
   * it, when that ground is free. A stall's keeper had the player work his shift with a wary customer at his elbow:
   * their two heads, a metre across each, in one another for the whole shift.
   */
  function makeWay(scene, mover, centre, q) {
    const C = at(centre.id);
    for (const Q of people.values()) {
      if (Q === mover || Q === centre || scene.actors.includes(Q.id) || Q.busy || Q.going || Q.down || Q.inside || Q.held || Q.off || Q.away || Q.transit) continue;
      const B = at(Q.id);
      if (!B || B.w.hide || B.route || B.room) continue;
      // (where they step to is a head and a hand from everybody else too, the pair's two places among them)
      const roomy = (x, z) => actors.all().every(R => R.id === Q.id || R.w.hide || Math.hypot(R.x - x, R.z - z) >= actors.headGap(Q.id, R.id)) && Math.hypot(q[0] - x, q[1] - z) >= actors.headGap(Q.id, mover.id) && Math.hypot(C.x - x, C.z - z) >= actors.headGap(Q.id, centre.id);
      for (const [px, pz, who] of [[q[0], q[1], mover.id], [C.x, C.z, centre.id]]) {
        const need = actors.headGap(who, Q.id);
        const d = Math.hypot(B.x - px, B.z - pz);
        if (d >= need || d < 0.05) continue;
        const a0 = Math.atan2(B.x - px, B.z - pz);
        let to = null;
        for (const da of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
          for (const m of [need + 0.3, need + 0.9]) {
            const t = [px + Math.sin(a0 + da) * m, pz + Math.cos(a0 + da) * m];
            if (actors.solidAt(t[0], t[1]) || actors.onRoad(t[0], t[1]) || actors.lowNear?.(t[0], t[1], 0.3) || !roomy(t[0], t[1])) continue;
            to = t;
            break;
          }
          if (to) break;
        }
        if (!to) continue;
        if (!Q.ambient) stopRoutine(Q);
        Q.astray = true;
        actors.stepTo(Q.id, to[0], to[1], { v: 1.3 }).then(out => out && !Q.busy && !Q.going && !Q.ambient && startRoutine(Q));
        break;
      }
    }
  }

  /**
   * A QUEUE: whoever walked up to this person earlier in the scene goes back to their own place as the next one
   * (`P`) has their turn, so the ground round them is free.
   */
  function nextInLine(scene, T, P) {
    for (const Q of scene.came?.get(T.id) ?? []) if (Q !== P && Q.astray && !Q.down && !Q.going && !Q.leaving) send(Q, Q.block, Q.spot, { held: Q.held });
  }

  /**
   * SERVED, AND OFF: a street buyer who has had their turn (the hand-off done) and has nothing more to do this hour
   * walks off along the sidewalk, away from the seller, as the next one comes up. They stood where they were served
   * until the hour ended: four buyers and the seller on one paving stone.
   */
  function served(scene, step) {
    if (step.mode !== 'act' || !step.target) return;
    for (const id of [step.actor, step.target]) {
      const Q = people.get(id);
      if (!Q?.extra || Q.off || Q.down || !/^npc:buyer/.test(Q.id)) continue;
      const after = scene.steps.slice(scene.steps.indexOf(step) + 1).some(q => q.actor === id || q.target === id);
      const later = (Q.scenes ?? []).some(s => s !== scene && !(s.entry && s.entry.took !== null));
      const other = people.get(id === step.actor ? step.target : step.actor);
      const [A, C] = [at(Q.id), other ? at(other.id) : null];
      // (wanted again this hour, by this seller or the next: back to the end of the line, out of the way of whoever
      // comes up now. Left standing where they were served they stood in the next one's mark, and a hand-off waited
      // its eight seconds of patience for a buyer who could not get there)
      if (after || later) {
        if (C && !Q.going) {
          actors.firm(Q.id, false);
          queueUp(Q, scene.block, 'street', [C.x, C.z], 4);
        }
        continue;
      }
      const [ux, uz] = along(A.x, A.z);
      const sign = !C || (A.x - C.x) * ux + (A.z - C.z) * uz >= 0 ? 1 : -1;
      const q = actors.laneAlong(A.x, A.z, sign * (WINGS + 5), Q.id);
      Q.off = true;
      Q.tripId += 1;
      Q.going = null;
      stopRoutine(Q);
      release(Q);
      actors.firm(Q.id, false);
      actors.face(Q.id, null);
      actors.walkTo(Q.id, q[0], q[1], { v: HURRY }).then(() => Q.off && actors.show(Q.id, false));
    }
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

  /**
   * A CONTACT STEP (a hand-off, a shove, a lift, a grab, a punch, a cuffing: the clip has the two hands meet) is told
   * to the actors (actors.contact) from the walk up to it to the scene's end, so the audit's `heads` leaves the two
   * be at the clip's own short reach; and the two are stood side by side to the camera for it (markFor).
   */
  let contactNo = 0;
  async function runStep(scene, step, rate, mine) {
    const next = step.mode === 'go' && step.target ? scene.steps.slice(scene.steps.indexOf(step) + 1).find(q => q.mode === 'act' && q.target && [q.actor, q.target].sort().join('|') === [step.actor, step.target].sort().join('|')) : null;
    // (a scene with a contact step in it is a fight, a lift, a hand-off: whoever comes up to anyone in it is in it at
    // arm's length too, the second robber running in to the first, who is down beside the one they jumped)
    const fight = scene.steps.some(q => CONTACT.has(q.action) && q.target);
    if (step.target && (fight || CONTACT.has(step.action) || (next && CONTACT.has(next.action))) && people.get(step.target)) {
      scene.contactKey ??= `scene:${++contactNo}`;
      actors.contact(step.actor, scene.contactKey);
      actors.contact(step.target, scene.contactKey);
      (scene.contacts ??= new Set()).add(step.actor).add(step.target);
    }
    return runStep0(scene, step, rate, mine);
  }
  async function runStep0(scene, step, rate, mine) {
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
        if (!(await present(T, scene.block, scene.spot, graceFor(scene))) || epoch !== mine) return;
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
        // (an extra running off, robbers seen off or away with it: they run on out of the picture when the hour lets them go)
        if (P.extra && (step.action === 'flee' || step.action === 'run')) P.fled = true;
        const [ux, uz] = along(A.x, A.z);
        const [cx, cz] = centre(scene);
        const sign = (A.x - cx) * ux + (A.z - cz) * uz >= 0 ? 1 : -1;
        const far = { run: 6, flee: 7, walk: 3, limp: 2.5, carry: 3, sneak: 2.5, led_away: 3, evicted: 2.5, patrol: 4 }[step.action] ?? 3;
        // (and clear of whoever stands there by a head and a hand: a lifted mark walked on into Shaky Dee at the bus
        // stop and patted his pockets with their two heads in one another)
        let there = actors.laneAlong(A.x, A.z, sign * far);
        const clear = q => actors.all().every(B => B.id === P.id || B.w.hide || Math.hypot(B.x - q[0], B.z - q[1]) >= actors.headGap(P.id, B.id));
        for (const m of [far, far + 1.5, far - 1, far + 3, -far, -far - 1.5]) {
          const q = actors.laneAlong(A.x, A.z, sign * m);
          if (clear(q)) {
            there = q;
            break;
          }
        }
        // (A FEW STEPS OFF ARE A FEW STEPS FROM WHERE THEY ARE, over the ground, away from the middle of the scene,
        // when the nearest walkers' lane is further than that: at the flea market it is a street away from its aisle.
        // A lift that failed there sent the player to a place 42 m off for the end of the hour, a walk that never got
        // there, and the woman he lifted from walked twelve metres to pat her pockets. Not whoever runs off out of the
        // picture: the lane is their way out)
        if (!P.extra && Math.hypot(there[0] - A.x, there[1] - A.z) > far + 2) {
          const d0 = Math.hypot(A.x - cx, A.z - cz);
          const a0 = d0 > 0.3 ? Math.atan2(A.x - cx, A.z - cz) : Math.atan2(ux, uz) * sign;
          for (const da of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
            const q = [A.x + Math.sin(a0 + da) * far, A.z + Math.cos(a0 + da) * far];
            if (actors.solidAt(q[0], q[1]) || actors.onRoad(q[0], q[1]) || actors.lowNear?.(q[0], q[1], 0.4) || !clear(q) || actors.groundWay(A.x, A.z, q[0], q[1]) === null) continue;
            there = q;
            break;
          }
        }
        // (THE PLAYER STAYS WHERE HIS JOB LEFT HIM: his few steps off are to a place of his own there, free ground
        // beside them when the place's spots are far, stands.js. Left with none, the end of the hour sent him back to
        // the middle of the trailer park from its bus stop, 58 m)
        if (P.block && !P.held) spot = claim(P, P.block, 'street', false, there, P.id !== player);
        // (a few steps on is a few steps: where the place's nearest free spot to it is across the yard, through a gate,
        // the lane point itself. A mark at the bus stop walked fourteen seconds into the trailer park to pat his pockets)
        if (spot && !spot.way && Math.hypot(spot.x - there[0], spot.z - there[1]) > 3) {
          release(P);
          spot = null;
        }
        if (spot) to = [spot.x, spot.z];
        else {
          to = there;
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
      // (THE SHOT, told to whoever listens: who fired, at whom, and whether the scene says it went home, which is
      // whether the one fired at is shot, falls or lies hurt in what follows. The stage puts the blood there)
      if (epoch === mine && T) tell('shot', { kind: scene.kind, block: scene.block, by: P.id, at: T.id, hit: scene.steps.slice(scene.steps.indexOf(step) + 1).some(q => q.actor === T.id && FALLS.has(q.action)) });
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
    scene.roomAt = [cx, cz, room + 0.5];
    for (const Q of people.values()) {
      // (the scene's own bystanders are moved out of its room too: they film it, or cower, from a few steps off)
      if (Q.off || Q.away || Q.transit || scene.actors.includes(Q.id) || Q.busy || Q.down || Q.inside || Q.cleared === scene || (Q.ambient && Q.ambient !== scene)) continue;
      const A = at(Q.id);
      // (somebody WALKING: only when the walk ends inside the room. They are on their way to stand in it)
      const goal = Q.going ? actors.goalOf(Q.id) : null;
      if (Q.going && (!goal || Math.hypot(goal[0] - cx, goal[1] - cz) > room)) continue;
      const d = goal ? Math.min(Math.hypot(A.x - cx, A.z - cz), Math.hypot(goal[0] - cx, goal[1] - cz)) : Math.hypot(A.x - cx, A.z - cz);
      if (d > room) continue;
      if (Q.going) {
        Q.tripId += 1;
        Q.going = null;
      }
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
        const dA = Math.hypot(A.x - cx, A.z - cz);
        const u = dA > 0.2 ? [(A.x - cx) / dA, (A.z - cz) / dA] : [1, 0];
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
      // (the player is not: he walks at his own pace, a walk or a jog, and the scene waits for him: ownLeft)
      const hurried = () => {
        for (const Q of [P0, T0]) if (Q.going && Q.stand?.kind !== 'open' && Q.id !== player) actors.hurry(Q.id, RUN, 'run_getaway', RUN_FROM);
        return false;
      };
      // (THE ONE IT IS DONE TO IS WALKING TO OPEN GROUND: whoever comes for them does not stand and watch them go.
      // They set off after them at once, to a few steps short of where it will happen, and take their mark from
      // there when the other stands. Three seconds of every such hour were one person waiting for the other)
      if (coming(P0) && coming(T0) && T0.going && T0.stand?.kind === 'open' && scene.steps.some(q => ATTACK.has(q.action))) after(P0, T0, scene.steps.some(q => q.action === 'hold_up' || q.action === 'shoot') ? SHOT_D : REACH);
      // (the player's own walk is waited out, however long his way: ownLeft)
      const base = Math.max(0.1, Math.min(PATIENCE, CURFEW - (actors.clock - hourStart)));
      const t0w = actors.clock;
      if (coming(P0) && coming(T0) && onWay() && apart() > NEARLY) await limit(actors.until(() => epoch !== mine || hurried() || !onWay() || apart() <= NEARLY || (actors.clock - t0w > base && !ownLeft(P0) && !ownLeft(T0))), Math.max(base, 30));
    }
    const cleared = !moveOnly && scene.big ? clearRoom(scene) : [];
    const room_ = !moveOnly && scene.big && scene.roomAt ? { block: scene.block, cast: scene.everyone ?? scene.actors, at: scene.roomAt } : null;
    if (room_) rooms_.add(room_);
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
          // (whoever has come to stand in the scene's room since it began, set down there by a ride or walking to a
          // spot in it, is walked out before the next thing is done: clearRoom looks again)
          if (scene.big && k > 0 && k < exits) cleared.push(...clearRoom(scene));
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
          served(scene, step);
        }
      }
    } finally {
      running -= 1;
      for (const id of scene.contacts ?? []) if (at(id)?.contact === scene.contactKey) actors.contact(id, null);
      if (pad && rooms?.show) {
        Promise.resolve(rooms.show(padKey(pad), false)).catch(() => {});
        tell('room-shut', { key: padKey(pad), id: pad, block: scene.block, scene });
        const me = player ? people.get(player) : null;
        if (me?.inside && !HELD[me.inside] && me.shown && !doorway?.has(me.inside)) Promise.resolve(rooms.show(me.inside, true)).catch(() => {});
      }
      entry.took = +(actors.clock - began).toFixed(1);
      if (room_) rooms_.delete(room_);
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
            // (an extra sent off meanwhile, the scene over: they are on their way out of the picture. dismiss)
            if (epoch !== mine || P.busy || P.ambient || P.going || P.off) return;
            if (!P.down) {
              actors.stop(P.id);
              actors.face(P.id, null);
            }
            // (left by the scene in something low, a table's edge the scene's steps took them into: back to their place)
            const B = at(P.id);
            if (!P.down && !P.inside && actors.lowNear?.(B.x, B.z, 0.15)) P.astray = true;
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
  /**
   * A buyer's place in the line: `turn` places from the seller (1 is next), on the side they come from, 2.6 m off
   * and 1.25 m more for each place, facing the seller. They were all sent to stand BESIDE the seller at the top of
   * the hour, at a run, and stood round them at arm's length. → false when the ground there cannot be had (they
   * are then sent as before).
   */
  function queueUp(P, block, spot, seller, turn) {
    const A = at(P.id);
    const d = Math.hypot(A.x - seller[0], A.z - seller[1]);
    if (d < 0.3) return false;
    const [ux, uz] = [(A.x - seller[0]) / d, (A.z - seller[1]) / d];
    let mark = null;
    // (a place in the line is a head and a hand from the next: actors.headGap)
    const step = HEADS_OLD ? 1.25 : Math.max(1.25, actors.headGap(P.id));
    for (const [more, side] of [[0, 0], [0, 0.7], [0, -0.7], [0.6, 0], [1.2, 0.7], [1.2, -0.7]]) {
      // (coming in from the sidewalk: never past the seller's side of where they are. Stepping back from the
      // seller, served: the whole distance)
      const far = d > 4 ? Math.min(d - 1, 2.6 + step * (turn - 1) + more) : 2.6 + step * (turn - 1) + more;
      const q = [seller[0] + ux * far - uz * side, seller[1] + uz * far + ux * side];
      if (actors.solidAt(q[0], q[1]) || actors.onRoad(q[0], q[1]) || !actors.free(q[0], q[1], HEADS_OLD ? 0.9 : step * 0.8, [P.id])) continue;
      if ([...people.values()].some(Q => Q !== P && Q.stand?.kind === 'queue' && Math.hypot(Q.stand.x - q[0], Q.stand.z - q[1]) < (HEADS_OLD ? 1.1 : actors.headGap(P.id, Q.id)))) continue;
      if (actors.groundWay(q[0], q[1], seller[0], seller[1]) === null) continue;
      mark = q;
      break;
    }
    if (!mark) return false;
    stopRoutine(P);
    const mine = ++P.tripId;
    release(P);
    P.stand = { x: mark[0], z: mark[1], ry: Math.atan2(seller[0] - mark[0], seller[1] - mark[1]), entry: null, kind: 'queue', temp: true };
    stands.hold?.(P.id, P.stand);
    Object.assign(P, { block, spot, held: null, away: false, transit: false, astray: false });
    const way = actors.groundWay(A.x, A.z, mark[0], mark[1]);
    const straight = Math.hypot(mark[0] - A.x, mark[1] - A.z);
    P.going = actors.walkTo(P.id, mark[0], mark[1], { v: HURRY, how: way !== null && way < straight * 1.5 + 2 ? 'straight' : 'path', yaw: P.stand.ry }).then(out => {
      if (P.tripId !== mine) return false;
      P.going = null;
      if (out.arrived) actors.face(P.id, seller[0], seller[1]);
      return out.arrived;
    });
    return true;
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
    for (const P of people.values()) reseat(P);
  }
  /**
   * THE LAST CHECK THAT NOBODY SHARES A PLACE WITH ONE OF THE CITY'S OWN PEOPLE. A place is refused when it is given
   * (stands.js `crowd`); this is for a place given before the city had said who it stands on that block (its people
   * come in with the block's build). Looked at when an hour begins: whoever stands or sits still on such a place is
   * given another, by a cut. `tally.reseated` counts them: it should stay 0.
   */
  function reseat(P) {
    if (P.off || P.away || P.transit || P.busy || P.going || !P.stand || P.stand.way || P.stand.temp) return;
    // (AND IN SOMETHING LOW of the city's, a table or a chair: a place given before the ground there was known, the
    // free ground handed out when a place's spots ran out. It is nobody's from here on)
    const S0 = P.stand;
    const low = !P.room && actors.solidKnown(S0.x, S0.z) && (!!actors.solidAt(S0.x, S0.z) || actors.lowNear?.(S0.x, S0.z, 0.25));
    if (!low && !stands.crowded?.(P.stand)) return;
    if ((P.inside && !HELD[P.inside]) || (P.down && !P.inside)) return;
    // (held, the jail's or the clinic's own place, and the camera on them: they keep it. Moved there by a cut, they
    // were seen to jump from one cot to the next)
    if (P.held && actors.seen(P.id)) return;
    if (low) S0.unfit = true;
    tally.reseated = (tally.reseated ?? 0) + 1;
    if (!low) console.warn(`[stage] ${P.id} was on a place one of the city's own people has, at ${P.stand.x.toFixed(1)}, ${P.stand.z.toFixed(1)}: given another`);
    // (let go of first: asked again for the place they hold, a person keeps it)
    release(P);
    // (where the camera sees them, they walk to the new one: a cut there is somebody gone and back a step off)
    if (!P.held && actors.seen(P.id)) send(P, P.block, P.spot ?? 'street');
    else settle(P, P.block, P.spot ?? 'street', P.held);
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
      // (whoever is put somewhere else lets go of where they were first, as in an hour played: below)
      for (const [id, n] of Object.entries(plan.npcs)) {
        const P = people.get(id);
        if (P && !P.extra && P.keep && P.stand && (P.block !== n.block || P.spot !== n.spot)) release(P);
      }
      for (const [id, n] of Object.entries(plan.npcs)) {
        const P = people.get(id);
        if (!P || P.extra) continue;
        P.routine = n.action;
        // (and what their hour has them at: the run's clips by name, whom they face or turn their back to. Left as
        // they were, a skipped hour's people went on at the last one's work: Pockets waiting for a cab at the table)
        [P.clips, P.watch, P.shun] = [n.clips ?? null, n.face ?? null, n.back ?? null];
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
    // (WHOEVER LEAVES A PLACE OF THEIRS THIS HOUR LETS GO OF IT FIRST: it is the next one's to have. Taken in the
    // table's order, the woman at the flea market came to the stall the man with the camera was leaving while it was
    // still his, and was stood off it, in the mouth of the aisle)
    for (const [id, n] of Object.entries(plan.npcs)) {
      const P = people.get(id);
      if (P && !P.extra && P.keep && P.stand && !P.stand.temp && !P.busy && !P.going && (P.block !== n.block || P.spot !== n.spot)) release(P);
    }
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
      // (the run's people name their routine's clips outright, and whom they keep their face or their back to)
      const clips = n.clips ?? null;
      const changed = P.routine !== n.action || String(P.clips) !== String(clips) || P.watch !== (n.face ?? null) || P.shun !== (n.back ?? null);
      P.routine = n.action;
      [P.clips, P.watch, P.shun] = [clips, n.face ?? null, n.back ?? null];
      // (an extra's place is beside whoever its scene is with, when they stand there already, and it comes on by
      // the lane nearest them)
      const scene = P.extra && n.spot === 'street' ? plan.staged.find(s => !s.passive && s.block === n.block && s.actors.includes(id)) : null;
      const beside = scene ? besideOf(scene, P) : null;
      if (P.extra) summon(P, n.block, n.spot, beside);
      // (A ROW OF STREET BUYERS WAITS ITS TURN A STEP APART: the first goes to the seller, the others to a line
      // toward the sidewalk they came by, and each walks up when the one before is being served: queueUp)
      const turnOf = scene && beside && /^npc:buyer/.test(id) ? scene.steps.filter(q => q.action === 'approach').findIndex(q => q.actor === id) : -1;
      if (turnOf > 0 && queueUp(P, n.block, n.spot, beside, turnOf)) continue;
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
      // (his walk is waited out at his own pace: a jog to the far end of the place is up to fifteen seconds)
      if (me.leaving) await limit(me.leaving, Math.max(OWN_WALK, ownLeft(me)));
      // (a walk held up for good, behind somebody who cannot make way, one of the city's own people on the flea
      // market's corner: not waited out. The hour ends, and he goes on when he can. It held one hour 21 s)
      const heldUp = () => (at(player).route?.stood ?? 0) > 3;
      if (me.going) await limit(Promise.race([me.going, actors.until(() => epoch !== mine || heldUp())]), Math.max(OWN_WALK + 5, ownLeft(me)));
      if (epoch === mine && at(player).route && !heldUp()) await limit(actors.until(() => epoch !== mine || !at(player).route || heldUp()), Math.max(OWN_WALK, ownLeft(me)));
      if (epoch === mine && log.length) log[log.length - 1].ownWalk = +(actors.clock - t1).toFixed(1);
    }
  }
  /**
   * Sets the person playing off for where the hour leaves them, at his own pace: a walk, or a jog for the far end of
   * the place (walkLeg ownPace). (The others hurry at one pace and arrive when they arrive: nobody is waiting to play
   * them.)
   */
  function ownWalk(P, end) {
    if (P.busy || end.held || P.held) return;
    // (a trip by cut has its own pace: travel.js)
    if (cutBetween(P, end.block, end.block, end.spot)) {
      send(P, end.block, end.spot);
      return;
    }
    // (inside the place: his own pace, a walk or a jog, walkLeg ownPace)
    send(P, end.block, end.spot);
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
    /**
     * Stops a standing person's own routine where they are, until something else starts it (the next hour, a scene, a
     * settle): the player gone to bed (doorway.bed). Left running, its next look round stood them up on the bed.
     */
    rest(id) {
      const P = people.get(id);
      if (P) stopRoutine(P);
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

    /**
     * Adds a person the director may move. `kind` is 'agent' or 'npc'. They are stood where they belong at once.
     * `keep`: an NPC who stays at their place like a keeper at a counter, whatever their role (the run's locals).
     */
    add({ id, kind, role = null, block, spot = 'street', held = null, routine = 'idle', keep = false }) {
      const P = { id, kind, role, keep, extra: kind === 'npc' && !KEEPERS.has(role) && !keep && !new URLSearchParams(location.search).has('oldstage'), off: false, away: false, transit: false, block: null, spot: null, held: null, stand: null, astray: false, shown: false, cleared: null, going: null, tripId: 0, busy: 0, routine, routineId: 0, down: false, inside: null, lastPair: null, ambient: null, end: null };
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
