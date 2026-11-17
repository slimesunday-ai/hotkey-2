// TRAVEL AS A CUT, BEHIND ONE SEAM. The game's places are the city's real places now, hundreds of metres apart, and
// an hour is ten seconds: nobody is walked from the bar to St. Mercy. A trip is a short DEPARTURE, a CUT, and an
// ARRIVAL (the owner, 2026-11-12: "we can use cut scenes, like he gets on the scooter rides for a bit, then it cuts to
// the location with the agent arriving").
//
//   const travel = createTravel({ city, actors, map });
//   await travel.leave(actor, { from, to, mode })    the departure. Resolves when the actor is OFF STAGE at `from`
//                                                    (hidden), and, for the followed person, the picture is black
//   await travel.arrive(actor, { at, from, mode })   the arrival. Resolves when the actor STANDS at `at`'s way in,
//                                                    on stage, and, for the followed person, the picture is back.
//                                                    Whoever called then walks them to their own spot
//
//   actor   { id, lead, clip, pace, cut, gone }   id: the actors.js id · lead: the followed person (their trip is what the
//           camera and the loading follow; everyone else just leaves and arrives in view) · clip: a walk they keep
//           (cuffed_walk, walk_hurt) · pace: m/s · cut(): the lead's alone, called by arrive once they stand at the
//           new place and before the picture comes back: the stage puts the camera on them there · gone(): true
//           once the trip has been called off (a scene took them, the season was restarted): a ride stops there ·
//           dark: travel's own note that the picture is black for this trip (travel.black(actor) / travel.back(actor):
//           a ride that fades by itself uses these two, so a trip that is called off gives the picture back)
//   from, to, at   place ids of citymap.js PLACES (a game block, or 'jail' / 'clinic')
//   mode    how they go. 'walk' is the one built here: the plain cut, for a trip nobody chose (an arrest, a hurt
//           person taken to St. Mercy) and for a page without the rides. Every trip a person CHOOSES plays a ride
//           of demo/stage/rides/ (on foot, scooter, skateboard, subway, cab): travel.useRides(rides) slots them in
//           through travel.ride(mode, { leave, arrive, cancel }) and sets travel.choose = ({ from, to, actor }) =>
//           mode (rides.modeFor: by the city's own walk quote and its stations; a skater skates).
//
// BETWEEN the two calls the caller does what the cut hides: for the followed person the stage loads the destination
// (loader.js: it started building when the departure started) and re-seats everyone. Nothing in this file loads.
//
// 'walk', the stand-in until the rides are in: the leaver walks for a few seconds toward the place's way out (the
// walkers' lane, up the sidewalk on the side the destination is on), the picture fades for the lead, and they arrive
// on the lane a few steps from the new place, already walking in.

/** Seconds (at 1×) a departure on foot is watched before the cut. */
const LEAVE_S = 3.2;
/** Seconds of fade either side of the cut, real time. */
const FADE_S = 0.32;
/** How far up the sidewalk a leaver is headed (m): further than they get in LEAVE_S, so they are walking at the cut. */
const AWAY_M = 22;
/** How far from the place's own sidewalk point somebody arrives (m along the lane; each a little more, by the person). */
const ARRIVE_M = 6;
/** A walk's pace on the way out and in, m/s (the city's walkers: 1.1 to 2.6). */
const PACE = 2.3;
/** A watched departure by a ride is over when they are out of the picture, and after this many seconds whatever. */
const WATCHED = 14;
/** …unless they are still in it: then this many more at the most. */
const WATCHED_MORE = 30;
/** Seconds a watched departure may stand held up on the walkers' lane in the picture before it is given up there. */
const HELD_S = 3;
/**
 * And an arrival that has not got to its place after this many is put there.
 * (36, was 24: a watched arrival on foot starts as far as 26 m back along the lane, at the rides' own 1.5 m/s, and
 * its spot can be seven metres more into a plaza: 35.9 m, 24.4 s. Glasswall Plaza's bench seats are the city's own
 * sitters' now (figures.js), the spot given instead is that far in, and the arrival was put there two metres
 * short. And on the lane it can stand some seconds behind one of the city's walkers waiting at a crossing)
 */
const ARRIVING = 36;

export function createTravel({ city, actors, map }) {
  // ── the fade: the stage's own, over the city and under the panels (the panels never go dark) ───────────────────
  const veil = document.createElement('div');
  veil.id = 'hk2-cut';
  veil.style.cssText = `position: fixed; inset: 0; z-index: 12; background: #0b0b0e; opacity: 0; pointer-events: none; transition: opacity ${FADE_S}s linear;`;
  document.body.append(veil);
  const real = s => new Promise(resolve => setTimeout(resolve, s * 1000));
  // (is a person in the camera's picture now? A body's sphere against the camera's frustum)
  const VIEW = city.THREE ? { M: new city.THREE.Matrix4(), F: new city.THREE.Frustum(), S: new city.THREE.Sphere() } : null;
  const seen = (id, r = 1.2) => {
    if (!VIEW || !actors.has(id)) return false;
    const A = actors.get(id);
    if (A.w.hide) return false;
    // (not in the picture while a place's inside view is up and they stand outside it: actors.js inPicture)
    if (actors.pictureHides?.(A.x, A.y ?? 0, A.z)) return false;
    const cam = city.camera;
    cam.updateMatrixWorld();
    VIEW.F.setFromProjectionMatrix(VIEW.M.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    VIEW.S.center.set(A.x, (A.y ?? 0) + 1, A.z);
    VIEW.S.radius = r;
    return VIEW.F.intersectsSphere(VIEW.S);
  };
  /**
   * NOBODY OF OURS IS LEFT STANDING IN THE WALKERS' LANE: whoever is left in the picture to be taken off once the
   * camera has lost them steps to the side of the sidewalk first (actors.fitSpot: off the lane's line), ending the walk
   * that had them held up there. The city's walkers piled up behind one such on the flea market's sidewalk.
   */
  const offLane = id => {
    if (!actors.has(id) || !actors.laneDistance) return;
    const A = actors.get(id);
    const d = actors.laneDistance(A.x, A.z);
    if (d === null || d > 0.5) return;
    // (on the sidewalk and a head from anybody standing there: actors.offLaneSpot)
    const q = actors.offLaneSpot?.(id);
    if (q && Math.hypot(q[0] - A.x, q[1] - A.z) > 0.2) actors.stepTo(id, q[0], q[1], { v: 1.3 }).catch(() => {});
  };
  let dark = 0;
  // (black: the veil is all the way over, from the end of the fade out to the start of the fade in. The audit's
  // `vanish` takes it as a cut of the whole picture: actors.js pictureDark)
  let black = false;
  // (and black at any moment since it was last asked: an hour settled at once under the black can begin and end
  // between two frames, and what it put on is first drawn as the veil starts to lift)
  let wasBlack = false;
  const count = { leaves: 0, arrives: 0, cuts: 0, noLane: 0, byMode: {}, capped: 0, cancelled: 0 };
  const tally = (half, mode, lead) => {
    const k = `${mode} ${half}${lead ? ', followed' : ''}`;
    count.byMode[k] = (count.byMode[k] ?? 0) + 1;
  };
  const fade = {
    get dark() {
      return dark > 0;
    },
    get black() {
      return black;
    },
    /** Black now, or at any moment since the last ask (the audit asks once a frame: actors.js pictureDark). */
    sinceAsked() {
      const was = black || wasBlack;
      wasBlack = false;
      return was;
    },
    /** To black. Counted: two who ask for black get it until both have asked for the picture back. */
    async out() {
      dark += 1;
      if (dark > 1) return;
      count.cuts += 1;
      veil.style.opacity = '1';
      await real(FADE_S + 0.03);
      black = dark > 0;
      if (black) wasBlack = true;
    },
    async in() {
      dark = Math.max(0, dark - 1);
      if (dark) return;
      black = false;
      veil.style.opacity = '0';
      await real(FADE_S);
    },
    /**
     * Black AT ONCE, no fade: for a change of view nobody walked into (a skipped hour settled inside or out of a
     * place with an inside view, inside.js). Counted like out(); in() fades it away.
     */
    blackNow() {
      dark += 1;
      // (the audit's `vanish` takes it as a cut of the whole picture, as it does a faded black: `black`, above)
      black = true;
      wasBlack = true;
      if (dark > 1 && veil.style.opacity === '1') return;
      count.cuts += 1;
      veil.style.transition = 'none';
      veil.style.opacity = '1';
      void veil.offsetWidth;
      veil.style.transition = `opacity ${FADE_S}s linear`;
    },
    /** Seconds the fade takes each way, real time. */
    seconds: FADE_S,
    /**
     * The black goes UNDER the city's carriage (its root is z 7 on the game's page) while one is open, and back over
     * everything of the city's when it has closed: the car rides over black, and what is under it when it closes
     * is black, never the place they left.
     */
    under(on) {
      veil.style.zIndex = on ? '6' : '12';
    },
  };

  const P = id => map.PLACES[id] ?? null;
  const unit = (ax, az, bx, bz) => {
    const d = Math.hypot(bx - ax, bz - az) || 1;
    return [(bx - ax) / d, (bz - az) / d];
  };

  /** Where a leaver heads: the lane point up the sidewalk on the destination's side; with no sidewalk, straight for the way out. */
  function wayOut(A, from, to) {
    const [F, T] = [P(from), P(to)];
    const toward = T && F ? unit(F.at[0], F.at[1], T.at[0], T.at[1]) : [Math.sin(A.ry), Math.cos(A.ry)];
    const picks = [AWAY_M, -AWAY_M].map(m => actors.laneAlong(A.x, A.z, m)).filter(q => Math.hypot(q[0] - A.x, q[1] - A.z) > 4);
    if (picks.length) {
      const score = q => {
        const u = unit(A.x, A.z, q[0], q[1]);
        return u[0] * toward[0] + u[1] * toward[1];
      };
      picks.sort((a, b) => score(b) - score(a));
      return { to: picks[0], lane: true };
    }
    // (no sidewalk here: the trailer park's lane, the island's yard. Straight for the place's nearest sidewalk point,
    // and when that is where they stand already, the way the destination lies)
    count.noLane += 1;
    // (the side its subway stairs are on when they are near, a place's natural way out; else its nearest sidewalk;
    // else the way the destination lies. And of the headings round that one, the first that is open ground for a
    // dozen metres: nobody sets off into a trailer's wall)
    const [W, sub] = [F?.ways?.walk, F?.ways?.subway];
    const d = W ? Math.hypot(W.x - A.x, W.z - A.z) : 0;
    const u = sub && sub.metres < 90 ? unit(A.x, A.z, sub.x, sub.z) : d > 6 ? unit(A.x, A.z, W.x, W.z) : toward;
    const open = (x, z) => {
      for (let m = 1; m <= 12; m += 0.5) if (actors.solidAt(A.x + ((x - A.x) * m) / 12, A.z + ((z - A.z) * m) / 12)) return m;
      return 13;
    };
    let best = null;
    for (const turn of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.5, -1.5]) {
      const [c, n] = [Math.cos(turn), Math.sin(turn)];
      const q = [A.x + (u[0] * c - u[1] * n) * 12, A.z + (u[0] * n + u[1] * c) * 12];
      const clear = open(q[0], q[1]);
      if (!best || clear > best.clear) best = { q, clear };
      if (clear > 12) break;
    }
    return { to: best.q, lane: false };
  }

  /** Where somebody arrives: on the lane a few steps from the place, on the side they come from. → [x, z, ry]. */
  function wayIn(at, from, who = '') {
    const [T, F] = [P(at), P(from)];
    // (each a little their own distance up the lane: two who arrive together do not arrive in one spot)
    let h = 0;
    for (let k = 0; k < who.length; k++) h = (h * 31 + who.charCodeAt(k)) >>> 0;
    const more = (h % 5) * 1.3;
    const [tx, tz] = T.at;
    const toward = F ? unit(tx, tz, F.at[0], F.at[1]) : [1, 0];
    const W = T.ways?.walk ?? { x: tx, z: tz };
    const picks = [ARRIVE_M + more, -ARRIVE_M - more, ARRIVE_M / 2 + more, -ARRIVE_M / 2 - more].map(m => actors.laneAlong(W.x, W.z, m)).filter(q => Math.hypot(q[0] - W.x, q[1] - W.z) > 2 && !actors.solidAt(q[0], q[1]));
    let q = null;
    if (picks.length && Math.hypot(W.x - tx, W.z - tz) < 30) {
      // on a sidewalk (never a dealing corner's ramp into the road), on the side they come from, and with a short
      // way over the ground to the place's own point: they walk in, they do not go round the block
      const ways = new Map(picks.map(p => [p, actors.groundWay(p[0], p[1], tx, tz)]));
      const score = p => {
        const u = unit(tx, tz, p[0], p[1]);
        const way = ways.get(p);
        const straight = Math.hypot(p[0] - tx, p[1] - tz);
        return u[0] * toward[0] + u[1] * toward[1] - straight / 40 - (actors.offKerb(p[0], p[1]) ? 0 : 3) - (way === null ? 2 : Math.max(0, way - straight) / 6);
      };
      picks.sort((a, b) => score(b) - score(a));
      // (a place fenced off from its sidewalk, the docks' yard: no lane point has a way in over the ground. They
      // arrive inside it, below)
      // (asked only where the ground is known and the place's own point is ground: the bar's is in what stands on
      // its sidewalk, and nothing can be said of the way to it)
      if (ways.get(picks[0]) !== null || !actors.solidKnown(tx, tz) || actors.solidAt(tx, tz)) q = picks[0];
    }
    if (!q) {
      // (no sidewalk at the place: a few steps off its own point, wherever the ground is free: on the side of its
      // subway stairs when they are near, a place's natural way in, else of its nearest sidewalk)
      const sub = T.ways?.subway;
      const u = sub && sub.metres < 90 ? unit(tx, tz, sub.x, sub.z) : Math.hypot(W.x - tx, W.z - tz) > 3 ? unit(tx, tz, W.x, W.z) : toward;
      const far = 7 + more * 0.6;
      // (with a way over the ground to the place's own point: not behind a trailer)
      for (const [d, turn] of [[far, 0], [5, 0], [far, 0.7], [far, -0.7], [5, 1.4], [5, -1.4], [3.5, 0], [3.5, Math.PI]]) {
        const [c, s] = [Math.cos(turn), Math.sin(turn)];
        const p = [tx + (u[0] * c - u[1] * s) * d, tz + (u[0] * s + u[1] * c) * d];
        if (!actors.solidAt(p[0], p[1]) && actors.groundWay(p[0], p[1], tx, tz) !== null) {
          q = p;
          break;
        }
      }
      q ??= [tx, tz];
    }
    return [q[0], q[1], Math.atan2(tx - q[0], tz - q[1])];
  }

  // ── the walk, and whatever is slotted in beside it ──────────────────────────────────────────────────────────────
  const rides = {
    walk: {
      async leave(actor, { from, to }) {
        const A = actors.get(actor.id);
        const out = wayOut(A, from, to);
        const pace = actor.pace ?? PACE;
        actors.face(actor.id, null);
        // (not waited for: they are still walking when the cut comes)
        actors.walkTo(actor.id, out.to[0], out.to[1], { v: pace, how: out.lane ? 'path' : 'straight', clip: actor.clip ?? null }).catch(() => {});
        if (actor.lead) {
          await actors.seconds(LEAVE_S - FADE_S);
          if (!actor.gone?.()) await api.black(actor);
        } else await actors.seconds(LEAVE_S);
      },
      async arrive(actor, { at, from }) {
        // (`actor.landAt`: [x, z, ry], where whoever called wants the cut to put them: the run's ride home, a little up
        // the lane from the player's own trailer)
        const [x, z, ry] = actor.landAt ?? wayIn(at, from, actor.id);
        actors.place(actor.id, x, z, ry);
      },
    },
  };

  const api = {
    fade,
    count,
    LEAVE_S,
    /** Set by the stage when it opens the city's carriage between the halves of the followed person's subway trip. */
    carriage: false,
    /** Slots a way of travelling in: { leave(actor, trip), arrive(actor, trip) }, the calls at the top of this file. */
    ride(mode, impl) {
      rides[mode] = impl;
    },
    /** Which mode a trip uses, when whoever calls names none. Replace it to send people by scooter, subway or cab. */
    choose: () => 'walk',
    /** What the city's own planner says a trip costs: { straight, walk, scooter, subway, taxi: { seconds, metres } }, or null. */
    quote: (from, to) => map.TRIPS?.[`${from}>${to}`] ?? null,
    /** The seconds a trip on foot would take at the city's walking pace (world.json modes.walk: 1.5 m/s), by its way in metres. */
    walkSeconds: metres => metres / 1.5,

    async leave(actor, { from, to, mode = null }) {
      const m = mode ?? api.choose({ from, to, actor });
      const impl = rides[m] ?? rides.walk;
      // (the trip's mode is settled when it sets off: the arrival is the same ride's other half)
      actor.mode = m;
      // (the followed person by subway: the city's carriage is the cut. api.carriage is the stage's word that it
      // will open one: index.js)
      actor.carriage = !!actor.lead && m === 'subway' && !!api.carriage;
      count.leaves += 1;
      tally('leave', rides[m] ? m : 'walk', actor.lead);
      try {
        // (`actor.skipping`: resolves when the viewer skips the trip. The departure is then over at once)
        await Promise.race([impl.leave(actor, { from, to, mode: m }), actor.skipping].filter(Boolean));
      } catch (err) {
        console.warn('[stage] a departure fell over:', actor.id, from, '→', to, err);
      }
      // (called off on the way: whoever called it off has them)
      if (actor.gone?.()) {
        impl.cancel?.(actor);
        return;
      }
      // THE CUT, for the followed person: black. On a subway trip the city's carriage then opens OVER the black (the
      // stage opens it between the two halves, index.js voyage): from here until the new place stands, nothing of
      // the place they left is on the picture again.
      if (actor.lead) await api.black(actor);
      // off stage, whatever the ride did: nobody is left walking where nobody is looking. A ride's scene is ended
      // (its scooter, board or cab cleared); place() ends a walk.
      // (STILL IN THE PICTURE ON FOOT when a ride's scene is given up, a watched departure capped: the scene's own end
      // takes a leaver off the stage at once, rides/index.js settle, and they went in plain sight. A buyer off for the
      // day, held up on the lane behind one of the city's own standing at a crossing for the whole cap, was taken off
      // there: flea market, burner seed 12, 2026-11-14. They are put back the same frame, before any frame is drawn
      // without them, their walk left to go on, and taken off once the camera has lost them, as below)
      const onFoot = !actor.lead && !!impl.cancel && actors.has(actor.id) && seen(actor.id, 3) && !api.rides?.kit?.owned?.has(actor.id);
      impl.cancel?.(actor);
      if (onFoot && actors.has(actor.id)) {
        count.stood = (count.stood ?? 0) + 1;
        actors.show(actor.id, true);
        offLane(actor.id);
        actors.until(() => !!actor.gone?.() || !actors.has(actor.id) || !seen(actor.id, 3)).then(() => {
          if (actor.gone?.() || !actors.has(actor.id)) return;
          const A = actors.get(actor.id);
          (actors.cutClip ?? actors.stop)(actor.id);
          actors.place(actor.id, A.x, A.z, A.ry);
          actors.show(actor.id, false);
        });
        return;
      }
      if (actors.has(actor.id)) {
        const A = actors.get(actor.id);
        // (off stage at a cut: the clip ends there, it is not left to blend out where they next appear)
        (actors.cutClip ?? actors.stop)(actor.id);
        actors.place(actor.id, A.x, A.z, A.ry);
        // STILL IN THE PICTURE WITH NOWHERE LEFT TO WALK (not the followed person, whose cut is black): they are left
        // standing where the walk gave out and taken off once the camera has lost them, or left alone if something
        // else wants them first. Taken off here they went in plain sight: a neighbour off for the day whose lane
        // ended eighteen metres up, inside a picture the thin panels had made bigger (park, seed 29, 2026-11-13).
        if (!actor.lead && seen(actor.id, 3)) {
          count.stood = (count.stood ?? 0) + 1;
          // (lost by a good margin: the camera moves a little between the frame that finds them gone and the one
          // they are taken off in, and a body at the very edge was seen to go off there)
          actors.until(() => !!actor.gone?.() || !actors.has(actor.id) || !seen(actor.id, 3)).then(() => {
            if (!actor.gone?.() && actors.has(actor.id)) actors.show(actor.id, false);
          });
        } else actors.show(actor.id, false);
      }
    },

    /**
     * `spot` ([x, z]): the standing place they have at `at`, when whoever calls knows it: a ride ends ON it. Without
     * one a ride ends at the place's own point.
     */
    async arrive(actor, { at, from = null, mode = null, spot = null, rush = false }) {
      const m = mode ?? actor.mode ?? api.choose({ from, to: at, actor });
      const impl = rides[m] ?? rides.walk;
      count.arrives += 1;
      tally('arrive', rides[m] ? m : 'walk', actor.lead);
      if (!actors.has(actor.id) || actor.gone?.()) {
        api.back(actor);
        return;
      }
      // ON STAGE: the person is where the arrival starts and can be seen. For the followed person the camera is cut
      // to them and the picture comes back, as they come in. Once, whoever gets there first: the ride at its first
      // frame, or this call when the ride is over.
      let staged = false;
      const onStage = async () => {
        if (staged) return;
        staged = true;
        if (actor.lead) {
          try {
            await actor.cut?.();
          } catch (err) {
            console.warn('[stage] the camera did not cut to the arrival:', err);
          }
          // (not waited for: they come in as the picture comes up)
          api.back(actor);
        }
        actor.onStage?.();
      };
      try {
        // (a trip being skipped arrives at once, on its spot; skipped on the way in, the ride's scene is ended there)
        if (actor.skipped) await impl.arrive(actor, { at, from, mode: m, spot, onStage, rush, hurried: true });
        else {
          await Promise.race([impl.arrive(actor, { at, from, mode: m, spot, onStage, rush }), actor.skipping].filter(Boolean));
          if (actor.skipped && !actor.gone?.()) {
            impl.cancel?.(actor);
            const [x, z, ry] = spot ? [spot[0], spot[1], actors.get(actor.id).ry] : wayIn(at, from);
            actors.place(actor.id, x, z, ry);
          }
        }
      } catch (err) {
        console.warn('[stage] an arrival fell over:', actor.id, '→', at, err);
        impl.cancel?.(actor);
        const [x, z, ry] = wayIn(at, from);
        actors.place(actor.id, x, z, ry);
      }
      if (actor.gone?.()) {
        impl.cancel?.(actor);
        api.back(actor);
        return;
      }
      actors.show(actor.id, true);
      await onStage();
    },
    /** Ends whatever ride scene a person is in, at once (they are about to be put somewhere, or sent somewhere else). */
    cancel(id) {
      if (api.rides?.busy(id)) {
        count.cancelled += 1;
        api.rides.cancel(id);
      }
    },
    /**
     * SLOTS THE RIDE SCENES IN (demo/stage/rides/index.js createRides): every mode they play, and the choice of mode
     * by the trip. `cab`: a trip that would be a scooter's is a cab's (the owner: the cab comes in with fares; until
     * then it is seen with ?cab=1 and picked by nothing).
     */
    useRides(R, { cab = false } = {}) {
      api.rides = R;
      const pt = id => P(id)?.at ?? null;
      /**
       * WHERE A FAR PLACE LIES, AS A POINT THIS ZONE'S SIDEWALKS LEAD TO. A ride lays its way out (and in) on the
       * walkers' lanes toward the other place, which is hundreds of metres off in blocks that are not built: no lane
       * is known there and no way can be laid. So the point handed to the ride is on a sidewalk of this zone, up to
       * eighty metres off on the far place's side, the farthest a way leads to.
       */
      const toward = (x, z, there) => {
        const u = unit(x, z, there[0], there[1]);
        const far = Math.hypot(there[0] - x, there[1] - z);
        if (far < 90 && actors.routeOf(x, z, there[0], there[1])) return there;
        for (const m of [80, 62, 46, 32, 20]) {
          if (m > far) continue;
          for (const turn of [0, 0.4, -0.4, 0.8, -0.8]) {
            const [c, n] = [Math.cos(turn), Math.sin(turn)];
            const [qx, qz] = [x + (u[0] * c - u[1] * n) * m, z + (u[0] * n + u[1] * c) * m];
            const d = actors.laneDistance(qx, qz);
            if (d === null || d > 12) continue;
            const q = actors.laneAlong(qx, qz, 0);
            if (actors.routeOf(x, z, q[0], q[1])) return q;
          }
        }
        return there;
      };
      // SET BACK FROM ANY SIDEWALK (Sunny Acres' lane, the docks' yard, the middle of the park): nothing on wheels
      // comes there. That end of the trip is played on foot (rides/foot.js: over the ground), whatever the trip's
      // mode. The subway decides for itself (its stairs are played where they are in the place's picture).
      const WHEELS = new Set(['scooter', 'skate', 'cab']);
      const setBack = (x, z) => {
        const d = actors.laneDistance(x, z);
        return d === null || d > 9;
      };
      const scene = mode0 => ({
        async leave(actor, { from, to }) {
          const A = actors.get(actor.id);
          const T = pt(to);
          const mode = WHEELS.has(mode0) && setBack(A.x, A.z) ? 'foot' : mode0;
          actors.face(actor.id, null);
          await R.leave(actor.id, { mode, from: [A.x, A.z], toward: T ? toward(A.x, A.z, T) : [A.x, A.z], followed: !!actor.lead });
          if (actor.lead || actor.gone?.()) return;
          // WATCHED (the camera stays where it is): the scene plays on until they are out of the picture and takes
          // them off the stage itself. Not for ever: someone still in the picture after WATCHED seconds is taken off
          let capped = false;
          // (HELD UP ON THE LANE in the picture, behind somebody who does not move on, for HELD_S: given up there, and
          // stood off the lane below. Left to wait out the caps they stood in the walkers' way for up to 44 s, and the
          // city's walkers piled up behind them on the flea market's sidewalk)
          const held = () => (actors.get(actor.id)?.route?.stood ?? 0) > HELD_S && seen(actor.id);
          await Promise.race([actors.until(() => !R.busy(actor.id) || actor.gone?.() || held()), actors.seconds(WATCHED).then(() => (capped = true))]);
          if (held()) capped = true;
          // (STILL IN THE PICTURE at that moment, walking off toward a station 80 m up the street: taken off there
          // they vanish in plain sight. They are left to walk on until they are out of it, WATCHED_MORE seconds at
          // the most. `capped` counts only the ones cut while the camera could still see them)
          if (capped && R.busy(actor.id) && seen(actor.id)) {
            await Promise.race([actors.until(() => !R.busy(actor.id) || actor.gone?.() || !seen(actor.id) || held()), actors.seconds(WATCHED_MORE)]);
          }
          if (capped && R.busy(actor.id) && seen(actor.id)) count.capped += 1;
        },
        cancel(actor) {
          if (R.busy(actor.id)) R.cancel(actor.id);
        },
        async arrive(actor, { at, from, spot, onStage, rush, hurried = false }) {
          const here = spot ?? pt(at);
          const F = from ? pt(from) : null;
          const mode = WHEELS.has(mode0) && setBack(here[0], here[1]) ? 'foot' : mode0;
          const done = R.arrive(actor.id, { mode, at: here, from: F ? toward(here[0], here[1], F) : here, followed: !!actor.lead, rush: !!rush, hurried: !!hurried });
          // (on stage at the cut: a body that comes into the picture already riding takes a frame or two to be shown)
          await Promise.race([actors.until(() => !actors.has(actor.id) || !actors.get(actor.id).w.hide), real(0.6), done]);
          await onStage?.();
          let late = false;
          await Promise.race([done, actors.until(() => !!actor.gone?.()), actors.seconds(ARRIVING).then(() => (late = true))]);
          // (called off, or never got there: the scene is ended. An arrival ended so stands at its place)
          if ((late || actor.gone?.()) && R.busy(actor.id)) {
            if (late) count.capped += 1;
            R.cancel(actor.id);
          }
        },
      });
      for (const mode of R.MODES) rides[mode] = scene(mode);
      // LET OUT OF IRON ISLAND: no ride starts in the yard (it has no sidewalk, and nobody is handed a scooter at the
      // gate): the plain cut there, and they come to the precinct's block on foot, the ride's arrival.
      rides.out = { leave: rides.walk.leave, cancel: rides.foot.cancel, arrive: rides.foot.arrive };
      api.choose = ({ from, to, actor }) => {
        // (taken, not going: an arrest, a hurt person. The plain cut)
        if (actor.taken || !pt(from) || !pt(to)) return 'walk';
        if (from === 'jail') return 'out';
        return R.modeFor(pt(from), pt(to), { id: actor.id, cab });
      };
    },
    /** The picture goes black for this actor's trip (once: `actor.dark` says it has), and comes back for it. */
    async black(actor) {
      if (actor.dark) return;
      actor.dark = true;
      await fade.out();
    },
    back(actor) {
      if (!actor.dark) return;
      actor.dark = false;
      fade.in();
    },
    wayIn,
    wayOut,
  };
  return api;
}
