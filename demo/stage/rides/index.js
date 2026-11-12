// THE RIDES: the two halves of a trip round a cut, played on a stage actor with the city's own models and clips.
//
//   const rides = await createRides({ city, CITY, actors, skaters?, haste? });   (haste: the walks' pace, × the city's stroll)
//   rides.leave(id, { mode, from: [x, z], toward: [x, z], station?, followed?, hurried?, mark? })
//       → Promise<{ mode, cut, ... }> at the moment to cut: the person is out of sight or on their way out.
//         The scene plays on behind the cut and takes the person off the stage at its end (actors.show(id, false)).
//   rides.arrive(id, { mode, at: [x, z], from: [x, z], station?, followed?, hurried? })
//       → Promise<{ mode, seconds, at }> once they stand at `at` (fitted to stand on: actors.fitSpot).
//         It starts at the cut: whoever arrives is put where the scene starts and shown.
//   rides.modeFor(from, to, { cab, id }) → 'foot' | 'subway' | 'scooter' | 'skate' | 'cab'
//   rides.skates(id) → is this person a skater (createRides({ skaters: [ids] }) names them; else one in three by id)
//   rides.cancel(id) · rides.cancelAll()   finish at once: a leaver is off the stage, an arriver stands at `at`
//   rides.between(id, { from, to, slice }) → the city's carriage scene for a followed rider: the last `slice` seconds
//                                           of the ride's last run, at 1× (closeBetween() ends it: a skip)
//   rides.stats()
// Modes: scooter.js, cab.js, subway.js, foot.js (each file's header says what of the city it plays and what is ours).
// Several people may leave or arrive together: their marks (a place at the kerb, a scooter, the top of a flight) are
// kept apart (kit.js claim), and one flight of stairs is taken single file.
//
// WHY THE STAGE'S ACTORS AND NOT THE CITY'S MOVER. simstate/movement.js draws sim agents from booked trips (legs
// timed in game minutes on the page's movement clock), its cabs are cars of the city's traffic sim (traffic/cabs.js,
// which the game's page does not run: cars=0) and its people are the sim's walkers, not ours. Driving it would need a
// sim clock, a trip book, the traffic and a hand-over of our person to its walker and back for every half-trip. The
// pieces the city's mover itself is made of are reachable without it, and are what this module plays: the scooter
// clip and its prop (ride.js, ride-props.js), the stairs' flight (subway/index.js under(), called), the cab's model,
// lanes, kerb and door point (vehicles/, traffic/sim.js, movement.js's own figures), the transit clips (transit.js).
import { createKit } from './kit.js';
import { createScooter } from './scooter.js';
import { createSkate } from './skate.js';
import { createCab } from './cab.js';
import { createSubway } from './subway.js';
import { createFoot } from './foot.js';

export const MODES = ['foot', 'scooter', 'skate', 'subway', 'cab'];
/** modeFor: a walk of this many metres or less is made on foot; a station this near each end makes it the subway. */
const FOOT_M = 110;
/** between: the seconds of the carriage that are shown, the end of the ride's last run (at the stage's 1×). */
const SLICE_S = 8;
const STATION_M = 80;

export async function createRides({ city, CITY, actors, skaters = null, haste = 1 }) {
  const [CLIPS, RP, V3, GP, PLAN, RULES, TSIM, NETM, SUBM, SB] = await Promise.all([
    import(`${CITY}anim/cast/clips/index.js`),
    import(`${CITY}anim/cast/clips/ride-props.js`),
    import(`${CITY}vehicles/three.js`),
    import(`${CITY}gpu.js`),
    import(`${CITY}plan.js`),
    import(`${CITY}traffic/rules.js`),
    import(`${CITY}traffic/sim.js`),
    import(`${CITY}subway/net.js`),
    import(`${CITY}subway/index.js`),
    import(`${CITY}anim/cast/clips/skate-board.js`),
  ]);
  const NET = await NETM.loadNet();
  // the stairs: the city's own subway module, mounted for its stairs alone where the page has not mounted it
  // (?subway=stairs: no demo ride, no carriage built at load)
  const SUB = city.subway ?? SUBM.mountSubway(city, { Q: new URLSearchParams('subway=stairs') });
  const kit = createKit({ city, actors, CLIPS, haste });

  const foot = createFoot({ actors, kit });
  const scooter = createScooter({ city, actors, kit, CLIPS, RP, PLAN });
  const cab = createCab({ city, actors, kit, CLIPS, V3, GP, PLAN, RULES, TSIM });
  const subway = createSubway({ city, actors, kit, CLIPS, SUB, NET });
  const skate = createSkate({ city, actors, kit, CLIPS, SB });
  const SCENES = { foot, scooter, skate, cab, subway };
  // (the carriage open now, by between())
  let riding = null;
  // THE CARRIAGE'S STAGE IS MADE AT LOAD (the city's own prewarmCarriage: its renderer, its car, its shaders), not at
  // the first ride: made as the first ride opened it held the page for a third of a second, the person just gone
  // down the stairs. (Where the page has mounted the subway itself that is already done: the call then does nothing.)
  import(`${CITY}subway/carriage.js`).then(m => m.prewarmCarriage?.()).catch(err => console.warn('rides: the carriage was not made ahead', err));
  // WHO SKATES: the people named in `skaters` when a list is given (the owner's choice); else about one in three, stable by
  // id (the same person always skates)
  let skaterList = skaters ? new Set(skaters) : null;
  const hashOf = text => {
    let h = 2166136261;
    for (let k = 0; k < text.length; k++) h = Math.imul(h ^ text.charCodeAt(k), 16777619);
    return h >>> 0;
  };
  const skates = id => (skaterList ? skaterList.has(id) : hashOf(`skate:${id}`) % 3 === 0);

  // the city's quotes (world/export/travel.mjs on the export's world.json): fetched once, behind the page
  let TV = null;
  const quotes = (async () => {
    const [T, W] = await Promise.all([import(new URL('../../world/export/travel.mjs', CITY).href), fetch(new URL('../../world/export/world.json', CITY)).then(r => r.json())]);
    TV = T.createTravel(W);
    return TV;
  })().catch(err => {
    console.warn('rides: no travel quotes, modeFor goes by distance', err);
    return null;
  });

  const S = { leaves: 0, arrivals: 0, cancelled: 0, byMode: {}, last: [] };
  const note = (id, half, mode, out) => {
    S.byMode[mode] = (S.byMode[mode] ?? 0) + 1;
    S.last.push({ id, half, mode, ...out });
    if (S.last.length > 40) S.last.shift();
  };
  const ends = new Map();

  /** What `id` is left as when its scene is finished at once: off the stage, or standing at its place. */
  function settle(id) {
    const E = ends.get(id);
    if (!E || !actors.has(id)) return;
    kit.owned.get(id)?.release();
    actors.cutClip(id);
    if (E.half === 'leave') actors.show(id, false);
    else {
      const spot = actors.fitSpot(E.at[0], E.at[1]);
      actors.place(id, spot.x, spot.z, actors.get(id).ry);
      actors.show(id, true);
    }
  }

  /** Stations within STATION_M of each end that share a line (no change), the pair with the least walking. */
  function pairFor(from, to) {
    const near = p => [...NET.stations.values()].map(st => ({ st, d: Math.hypot(st.x - p[0], st.z - p[1]) })).filter(s => s.d <= STATION_M);
    let best = null;
    for (const a of near(from)) {
      for (const b of near(to)) {
        if (a.st.id === b.st.id || !a.st.lines.some(l => b.st.lines.includes(l))) continue;
        if (!best || a.d + b.d < best.d) best = { a: a.st.id, b: b.st.id, d: a.d + b.d };
      }
    }
    return best;
  }

  function start(half, id, o) {
    if (!actors.has(id)) return Promise.reject(new Error(`rides: no actor ${id}`));
    const mode = MODES.includes(o.mode) ? o.mode : 'foot';
    const J = kit.job(id, mode, o);
    J.onEnd(() => kit.unclaim(id));
    ends.set(id, { half, at: o.at ?? null, J });
    // (a scene that cannot be played the way asked goes on in the next best: no street for a cab → a scooter, no
    // lane for a scooter → on foot)
    const o2 = {
      ...o, mode,
      foot: (J2, id2, o3) => foot[half](J2, id2, o3),
      scooter: (J2, id2, o3) => scooter[half](J2, id2, o3),
    };
    if (half === 'arrive' && !o2.from) o2.from = o2.at;
    if (half === 'leave' && !o2.toward) o2.toward = o2.from ?? [actors.get(id).x, actors.get(id).z];
    // (the subway's stations: the pair on one line for this trip, when there is one; else the nearest)
    if (mode === 'subway' && !o2.station) {
      const here = half === 'leave' ? o2.from ?? [actors.get(id).x, actors.get(id).z] : o2.at;
      const there = half === 'leave' ? o2.toward : o2.from;
      const pair = pairFor(here, there);
      if (pair) o2.station = pair.a;
    }
    const stopped = new Promise(resolve => J.onEnd(why => resolve(why)));
    const run = SCENES[mode][half](J, id, o2);
    // (a scene that ends itself, arrived or gone, answers through `run`; one cut short, through `stopped`)
    return Promise.race([run, stopped.then(why => (why === 'cancelled' || why === 'replaced' ? { cancelled: why } : run))]).then(out => {
      const r = { mode, seconds: +(actors.clock - J.t0).toFixed(2), ...(out ?? { cancelled: J.stopped ?? true }) };
      if (half === 'leave') S.leaves += 1;
      else S.arrivals += 1;
      note(id, half, mode, r);
      return r;
    });
  }

  const rides = {
    MODES,
    kit,
    leave: (id, o = {}) => start('leave', id, o),
    arrive: (id, o = {}) => start('arrive', id, o),
    /** Finishes a person's scene at once: off the stage when leaving, standing at the place when arriving. */
    cancel(id) {
      const E = ends.get(id);
      if (!E || !E.J.live()) return false;
      S.cancelled += 1;
      E.J.stop('cancelled');
      settle(id);
      return true;
    },
    cancelAll() {
      for (const id of [...ends.keys()]) rides.cancel(id);
      scooter.clear();
      skate.clear();
      cab.clear();
    },
    /** Is a scene of this person's still playing (behind a cut too)? */
    busy: id => !!ends.get(id)?.J.live(),
    /**
     * The mode a trip between two points should use: on foot when the walk is short (the city's walk quote, ≤ 110 m);
     * by subway when a station is within 80 m of each end on one line between them (no change: the city's quotes
     * make every subway trip slower than a scooter, so the stations are the test); otherwise the scooter, or the
     * cab when `cab` is asked for.
     */
    modeFor(from, to, { cab: wantCab = false, id = null } = {}) {
      let walk = null;
      try {
        walk = TV?.best(from, to, 'walk')?.m ?? null;
      } catch {
        walk = null;
      }
      walk ??= (Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1])) * 1.05;
      if (walk <= FOOT_M) return 'foot';
      if (pairFor(from, to)) return 'subway';
      if (wantCab) return 'cab';
      // (a skater skates where anyone else takes a scooter: skateboards are their own, scooters are rented)
      return id !== null && skates(id) ? 'skate' : 'scooter';
    },
    /** Is this person a skater? */
    skates,
    /** The owner's list of skaters (null: one in three by id, as without a list). */
    setSkaters(list) {
      skaterList = list ? new Set(list) : null;
    },
    /** The two stations of a subway trip: within 80 m of each end, on one line, the shortest walks. Or null. */
    pairFor: (from, to) => pairFor(from, to),
    /** The station a subway scene at a point uses: { id, name, top, dir } (its stairs' top nosing and way down). */
    station(x, z, id = null) {
      const s = subway.stationFor(x, z, id);
      return s ? { id: s.id, name: s.name, top: s.W.top, dir: s.W.dir, d: s.d } : null;
    },
    /**
     * THE CITY'S CARRIAGE between the two halves, for the person the camera follows: the ride the export's planner
     * books from one station to the other (subway/net.js programOf), played over the city by subway/carriage.js,
     * squeezed into `seconds` at most. Resolves when it closes (or at once when it cannot open).
     */
    async between(id, { from, to, slice = SLICE_S } = {}) {
      const T = TV ?? (await quotes);
      const a = subway.stationFor(from[0], from[1]);
      const b = subway.stationFor(to[0], to[1]);
      if (!T || !a || !b || a.id === b.id || !SUB.ride) return { opened: false };
      const trip = T.trip(a.id, b.id, 'subway', { dep: 600 });
      const whole = trip && NETM.programOf(NET, trip.legs, 60);
      // ONE LEG, AT THE LINE'S OWN PACE. The whole ride (a platform wait, stops on the way, a change of line) is not
      // shown and nothing is squeezed: the program handed to the city's carriage is its LAST RUN alone, the stretch
      // into the station the person gets off at, in the seconds the line itself takes for it (net.js: the run's
      // metres at the line's speed and three seconds more, the city's own nominal). With the timetable's minutes read
      // as seconds (Sunny Acres to Fit St: 127 m in 3.2 s) the same carriage braked at 51 m/s², and it leans its
      // standing riders 0.03 rad for every m/s² and tips its car 0.0015: 87° and 4°. They lay on the floor. Now that
      // run is 10.9 s, 4.3 m/s² at the most: 7° and 0.4°.
      const run = whole?.segs[whole.segs.length - 1];
      const ln = run && NET.lines.get(run.line);
      if (!run || run.kind !== 'run' || !ln) return { opened: false };
      const dur = Math.max(4, run.m / ln.speed + 3);
      const P = {
        t0: whole.t0, dur, from: run.a, to: run.b, lines: [run.line],
        segs: [{ kind: 'dwell', t0: 0, t1: 0, st: run.a, line: run.line, dir: run.dir, board: true }, { kind: 'run', a: run.a, b: run.b, m: run.m, t0: 0, t1: dur, line: run.line, dir: run.dir }],
      };
      // THE SLICE: the last `slice` seconds of that run, on the stage's clock at 1×: on the train, running, braking
      // into the station, the doors opening, and the city's scene closes itself. The clock stands at the slice's
      // first second until the car is on screen (the carriage plays its program up to there unseen, and shows).
      const start = Math.max(0, dur - slice);
      let shown = null;
      const now = () => start + (shown === null ? 0 : actors.clock - shown);
      // (the rider in the carriage wears the person's own look and name, not the one the city would roll for the id)
      const A = actors.get(id);
      const t0 = actors.clock;
      const h = await SUB.ride(P, { id, handle: A?.name ?? id, look: A?.look }, now);
      if (!h) return { opened: false };
      // UNDER THE GAME'S PANELS (the city's own arrangement for a page with panels: carriage.js `under`, "Panels on
      // top"; subway/index.js's ride() gives no way to ask for it from here, so its class is put on the carriage's
      // root): the top line, the rails and the ticker stay over the car, and its own cards drop below the top line
      if (document.body.classList.contains('game')) document.querySelector('.sbw')?.classList.add('sbw-under');
      shown = actors.clock;
      riding = h;
      await actors.until(() => !SUB.open || actors.clock - shown > slice + 6);
      // (closed before its last second: the viewer's Esc or its own ×, or closeBetween(): the trip is being skipped)
      const left = now() < dur - 0.2;
      if (SUB.open) SUB.open.close?.('done');
      riding = null;
      return { opened: true, seconds: +(actors.clock - shown).toFixed(2), wait: +(shown - t0).toFixed(2), program: +dur.toFixed(1), from: start, pace: 1, left, lean: +(Math.max(1.3, (4 * run.m) / (dur * dur)) * 0.03).toFixed(3) };
    },
    /** Closes the carriage now (the trip is being skipped). → was one open? */
    closeBetween() {
      if (!riding && !SUB.open) return false;
      SUB.open?.close?.('left');
      return true;
    },
    /** (the scenes themselves, for the dev page and the tools) */
    scenes: SCENES,
    stats: () => ({ ...S, parked: scooter.parked(), boards: skate.boards(), cabs: cab.cabs(), quotes: !!TV }),
    ready: quotes,
  };
  return rides;
}
