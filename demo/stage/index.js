// THE STAGE: hotkey 2 played in the 3D city, behind the contract the panels call (SPEC section 24, "The stage
// contract"; demo/hud/stage-stub.js is the flat stand-in for the same calls).
//
//   const stage = await createStage({ city, CITY });
//   stage.begin({ game, you, mode })            the cast takes its places
//   await stage.playHour(line, { seen, speed }) the hour's scenes; resolves when they are done
//   stage.setSpeed(n) · stage.screenOf(id) · stage.focus(target) · stage.onPick(fn) · stage.setClock({ day, hour })
//   stage.portraitOf(id)
//   await stage.openRun({ you, owned, opening })  THE RUN, before its first hour: its pad from the starter pack
//                                               (set/starter.js) and the city first (opening.js)
//
// Its parts: actors.js (the city's walkers, driven by us), director.js (an hour's plan played on them), camera.js
// (what to look at), loader.js (only the zone the followed person is in is built) and travel.js (a trip between
// places is a departure, a cut and an arrival). Where the places are is data: demo/stage/citymap.js over the place
// table, places.json. demo/stage/set/index.js gives the pads' rooms and the time of day; nothing is built or dressed.
//
// THE FOLLOWED PERSON (the LEAD) is the player, or, watching, whoever the camera was asked to follow (the first seat
// until someone is). The zone that is loaded is the one they are in. When their hour takes them to another, this
// file starts the trip (voyage): the destination starts building as they set off, the picture cuts when it stands.
import { createActors } from './actors.js';
import { createDirector } from './director.js';
import { createCamera } from './camera.js';
import { planHour, weightOf, HOUR_MS } from './director-plan.js';
import { createStands } from './stands.js';
import { createTravel } from './travel.js';
import { createLoader } from './loader.js';
import { createRides } from './rides/index.js';
import { createSeeThrough } from './seethrough.js';
import { createFigures, SPOT, PASS, TOUCH } from './figures.js';
import { createGore } from './gore.js';
import { createDoorway } from './doorway.js';
import { createInside } from './inside.js';
import { createOpening } from './opening.js';
import { createFallaway } from './fallaway.js';
import * as CITYMAP from './citymap.js';

/**
 * What each kind of person wears, so a viewer can tell them apart at a glance. `pool` is the cast's: agents are the
 * loud streetwear, NPCs the plain clothes of the crowd. `wear` names pieces of the city's cast; one the cast doesn't
 * have is skipped (stage.debug().missing lists them).
 */
const LOOKS = {
  agent: () => ({ pool: 'agent' }),
  police: () => ({ pool: 'npc', outfit: 'officer' }),
  // the Dunn brothers: one face between them, both in the dark hoodie and beanie
  npcRobber: (npc, kin) => ({ pool: 'agent', wear: { ...kin('the Dunn brothers', ['skin', 'hair']), top: 'old_hoodie', hat: 'old_beanie' } }),
  // the Sixes: the green rag and the grey corner hoodie on all three
  rival: () => ({ pool: 'agent', wear: { hat: 'corner_rag', top: 'corner_hoodie' } }),
  shopkeeper: () => ({ pool: 'npc', wear: { top: 'npc_top_deli_apron' } }),
  fence: () => ({ pool: 'npc', wear: { top: 'npc_top_deli_apron', eyewear: 'precinct_aviators' } }),
  gunshop: () => ({ pool: 'npc', wear: { top: 'npc_top_deli_apron', hat: 'dockhand_beanie' } }),
  supplier: () => ({ pool: 'agent', wear: { top: 'dock_vest', hat: 'dockhand_beanie' } }),
  medic: () => ({ pool: 'npc', wear: { top: 'npc_top_scrubs', bottom: 'npc_pants_scrubs' } }),
  courier: () => ({ pool: 'npc', wear: { top: 'npc_top_delivery' } }),
  snitch: () => ({ pool: 'npc', wear: { top: 'old_hoodie', hat: 'old_bandana' } }),
  buyer: () => ({ pool: 'npc' }),
};

export async function createStage({ city, CITY, map = CITYMAP, loader: given = null }) {
  const actors = await createActors({ city, CITY });
  // the rooms to see into (the pads) and the time of day. Nothing is dressed: the places are the city's own
  let set = null;
  try {
    set = await import('./set/index.js');
    await set.startSet?.(city);
  } catch (err) {
    if (!/Failed to fetch|Cannot find|404|error loading/i.test(String(err?.message ?? err))) console.warn('[stage] the set module did not load:', err);
    set = null;
  }
  const rooms = set?.rooms ?? null;
  // THE FIRST ZONE: where a season starts (everyone is home). boot.js told the city to build only that; a page that
  // did not (a tool's) has it loaded here. THE SIDEWALKS FIRST: every walk is laid on the city's lanes, and a
  // block's lanes arrive with its build.
  const loader = given ?? createLoader({ city, CITY, map });
  const zone0 = loader.zone ?? map.zoneOf(map.START);
  if (!loader.zone) await loader.enter(zone0);
  else for (const t0 = performance.now(); performance.now() - t0 < 15000 && !loader.standing(zone0); ) await new Promise(resolve => setTimeout(resolve, 100));
  if (!loader.standing(zone0)) console.warn('[stage] the first zone is not whole: walks start on plain sidewalks and shift when the lanes come');
  // WHERE PEOPLE STAND: the place table's standing spots (the city's own published spots and stand-spot rules:
  // demo/tools/place-table.mjs)
  // (and each is looked over against the ground once its zone stands: a body can stand there, and can walk there
  // from the place's own point by a way not much longer than the straight one. A bench seat is asked a step in front
  // of itself: the seat is the bench)
  // A POINT READ OFF A PIECE'S BOX CAN BE IN SOMETHING (the bar's own point, a step out from the middle of its front,
  // is in what stands on its sidewalk there; the pier's is against a pallet): the nearest ground a body can stand on,
  // within two metres, is the point meant.
  // WATER IS SOLID TO ANYONE ON FOOT (citymap.js WET: the fountain, the pond, the paddling pool): nobody is stood in
  // it, no mark of a scene is in it, no way is laid through it.
  actors.addSolid((x, z) => {
    for (const [x0, z0, x1, z1, what] of map.WET ?? []) if (x > x0 && x < x1 && z > z0 && z < z1) return what;
    return null;
  });
  // THE CITY'S OWN PEOPLE ARE SOLID TOO (figures.js: whoever the city itself stands or seats in its places, read off
  // what it draws): nobody is given a seat, a lean or a standing spot one of them has or is within a body's width
  // of (`crowd`, asked by stands.js every time a place is given), no mark of a scene is put in one, no way is laid
  // through one, and the audit counts anybody of ours found in one (`overlaps`). `?figures=0` is the stage as it
  // was, blind to them, with the audit still counting: to measure against.
  const figures = createFigures({ city });
  const CROWD = new URLSearchParams(location.search).get('figures') !== '0';
  actors.addSolid((x, z, y, sure) => (CROWD && figures.at(x, z, y, sure ? -0.1 : PASS) ? 'one of the city\'s own people' : null));
  actors.setCrowd((x, z, y, reach) => figures.at(x, z, y, reach), TOUCH);
  const crowd = (x, z) => CROWD && !!figures.at(x, z, actors.GROUND, SPOT, true);
  const unstuck = (x, z) => {
    if (!actors.solidKnown(x, z) || !actors.solidAt(x, z)) return [x, z];
    // (off the roadway first; on a quay or a yard, which the city's plan knows as no sidewalk, anywhere free. As far
    // as 4.8 m: Glasswall Plaza's own point is the middle of its fountain)
    for (const kerb of [true, false]) {
      for (let r = 0.4; r <= 4.81; r += 0.4) {
        for (let k = 0; k < 12; k++) {
          const [px, pz] = [x + Math.sin((k * Math.PI) / 6) * r, z + Math.cos((k * Math.PI) / 6) * r];
          if (!actors.solidAt(px, pz) && (!kerb || actors.offKerb(px, pz))) return [px, pz];
        }
      }
    }
    return [x, z];
  };
  const vet = (at0, s) => {
    if (!actors.solidKnown(s.x, s.z) || !actors.solidKnown(at0[0], at0[1])) return null;
    // (and who the city itself has there must be known: a block's people come in with its build)
    if (CROWD && !figures.known(s.x, s.z)) return null;
    if (crowd(s.x, s.z)) return false;
    const at = unstuck(at0[0], at0[1]);
    const ry = s.ry ?? 0;
    const [x, z] = s.kind === 'bench' ? [s.x + Math.sin(ry) * 0.7, s.z + Math.cos(ry) * 0.7] : [s.x, s.z];
    if (actors.solidAt(x, z)) return false;
    // (nor in a cluster of lawn chairs: nothing low of the city's within a body's reach of a standing spot. A seat
    // of the city's own, a bench, is sat on, and is asked a step in front of itself above)
    if (s.kind !== 'bench' && !s.sit && actors.lowNear?.(x, z, 0.6)) return false;
    const straight = Math.hypot(x - at[0], z - at[1]);
    if (straight < 1.5) return true;
    const way = actors.groundWay(at[0], at[1], x, z);
    return way !== null && way < straight * 2 + 6;
  };
  // (?heads=old: places a body's width apart, as they were, to measure what the head's room changed: the audit's `heads`)
  const HEADS_OLD = new URLSearchParams(location.search).get('heads') === 'old';
  const stands = createStands({
    map, data: map.STANDS, vet, crowd,
    // (two places of ours are a head and a hand apart: actors.js headGap. And when the two lie along the camera's
    // bearing, the nearer head drawn over the farther, more: as a pair in a scene is, director.js meet. Two at the
    // flea market a head apart east and west of each other were 18% one over the other in the picture)
    gap: HEADS_OLD ? null : (a, b, p = null, q = null) => {
      const g = actors.headGap(a, b);
      if (!p || !q) return g;
      const cam = city.camera.position;
      const [dx, dz, cx, cz] = [q[0] - p[0], q[1] - p[1], cam.x - p[0], cam.z - p[1]];
      const inline = Math.abs(dx * cx + dz * cz) / ((Math.hypot(dx, dz) || 1) * (Math.hypot(cx, cz) || 1));
      return inline > 0.5 ? g * (1 + 0.45 * inline) : g;
    },
    // (free ground handed out when a place's spots are all taken is never on a step, a stoop or by a chair either)
    blocked: (x, z, r = 0.6) => actors.solidKnown(x, z) && (!!actors.solidAt(x, z) || actors.lowNear(x, z, r)),
    // (and free ground is standing ground: off the roadway, and off the walkers' own lane, which a body stood on closes)
    ground: (x, z) => actors.offKerb(x, z) && (actors.laneDistance(x, z) ?? 9) >= 0.75,
    fit(x0, z0, along) {
      const [x, z] = unstuck(x0, z0);
      const S = actors.fitSpot(x, z, 0.75, along);
      // (fitted off the walkers' lane and into something: the free point stands)
      return actors.solidKnown(S.x, S.z) && actors.solidAt(S.x, S.z) ? { ...S, x, z } : S;
    },
  });
  const travel = createTravel({ city, actors, map });
  // (the picture black is a cut of the whole of it: nobody is counted coming on or going off under it. actors.js)
  actors.pictureDark = () => travel.fade.sinceAsked();
  // THE RIDES (demo/stage/rides/): on foot, scooter, skateboard, subway, and the cab. Every trip a person chooses
  // plays one, through the travel seam. ?rides=0 leaves the plain cut for everything (to measure against);
  // ?skaters=a2,a7 names who skates (else about one in three, the same people every time); ?cab=1 sends a cab
  // wherever a scooter would go (the owner: cabs come in with fares; until then nothing picks one).
  const QS = new URLSearchParams(location.search);
  let rides = null;
  if (QS.get('rides') !== '0') {
    try {
      rides = await createRides({ city, CITY, actors, skaters: QS.get('skaters') ? QS.get('skaters').split(',') : null });
      travel.useRides(rides, { cab: QS.get('cab') === '1' });
      travel.carriage = QS.get('carriage') !== '0';
    } catch (err) {
      console.warn('[stage] the rides did not load: every trip is the plain cut', err);
      rides = null;
    }
  }
  // (the camera is made after the director it reads: the director's one call into it goes through here)
  let camera = null;
  // THE INSIDE VIEW (inside.js): the places with an inside (the pads: set/crib.js), seen alone while whoever the
  // picture is about stands in one; and the player's own door, walked (doorway.js), in and out of it
  let lastGap = null;
  // (the city taken down to its ground, block by block: the opening, and the real ground under a place's inside)
  const fall = createFallaway({ city });
  const inside = createInside({
    city, actors, fade: travel.fade, gap: () => lastGap, fall,
    night: () => set.nightNow(),
    lead: () => {
      try {
        return leadId();
      } catch {
        return null;
      }
    },
    who: id => {
      try {
        return director.people.get(id) ?? null;
      } catch {
        return null;
      }
    },
    // (the player's own door is walked: director.js walkLeg, doorway.js)
    walks: id => {
      try {
        return mode !== 'watch' && id === you;
      } catch {
        return false;
      }
    },
    // (everybody but the lead within r m, ours and the city's own, walking or standing: the door's low shot keeps its
    // lens clear of them)
    people: (x, z, r) => {
      let lead = null;
      try {
        lead = leadId();
      } catch {}
      const near = (px, pz) => Math.hypot(px - x, pz - z) < r;
      const out = actors.all().filter(A => A.id !== lead && !A.w.hide && near(A.x, A.z)).map(A => [A.x, A.y, A.z]);
      for (const w of city.peds?.sim?.walkers ?? []) if (!w.hk2 && !w.hide && w.p && near(w.p[0], w.p[2])) out.push([w.p[0], w.p[1], w.p[2]]);
      for (const F of figures.all?.() ?? []) if (near(F.x, F.z)) out.push([F.x, F.y0 ?? 0, F.z]);
      return out;
    },
  });
  for (const key of set?.insides?.keys() ?? []) inside.register(set.insides.place(key));
  inside.onLamp(points => set?.setInsideLamp?.(points));
  inside.onSwitch(() => camera?.arrived());
  const doorway = set?.insides?.keys().length ? createDoorway({ actors, inside, fade: travel.fade, rest: id => director.rest(id) }) : null;
  // (a run's opening over the city, before its first morning in the crib: opening.js)
  // (what the camera's picture leaves out, for the audit and for whoever waits for someone to be out of it: the
  // inside view draws a place's inside alone)
  actors.pictureHides = (x, y, z) => !!inside.up && !inside.holds(inside.up, x, y, z);
  const opening = createOpening({ city, fade: travel.fade, inside, fall, camera: () => camera });
  const director = createDirector({ city, actors, map, stands, travel, rooms, doorway, padKey: set?.padOf ?? (id => `pad:${id}`), hooks: { cut: () => camera?.arrived(), landed: id => id === journeying && travelOver() } });
  director.setZone(zone0);
  // (the city's see-through hole, for the camera to soften: camera.js)
  const hole = await import(`${CITY}gpu.js`).then(m => m.HOLE ?? null, () => null);
  let firstSeat = null;
  // watching: the person the camera was last asked to follow. When the viewer lets them go the picture stays where
  // they are (their place's own shot), and the zone goes on following them
  let lastFollowed = null;
  /** Who the zone follows: the player; watching, whoever the camera follows or last followed, else the first seat (nobody while a place is asked for). */
  const leadId = () => (mode === 'watch' ? (camera?.place ? null : camera?.following ?? (lastFollowed && actors.has(lastFollowed) ? lastFollowed : null) ?? firstSeat) : you);
  camera = createCamera({ city, actors, map, director, rooms, hole, inside, home: () => director.placeOf(leadId()) ?? camera?.place ?? map.ZONES[loader.zone]?.places[0] ?? map.START });
  loader.setCut(view => camera.cutTo(view));
  // (what hides the watched person, or whoever is in a scene with them, fades as a whole thing: seethrough.js)
  const seeThrough = createSeeThrough({ city, actors, pitch: map.PITCH, hole, partners: id => [...playing].filter(s => s.actors?.includes(id)).flatMap(s => s.actors) });
  const CH = await import(`${CITY}cast.js`);

  let game = null;
  let you = null;
  let mode = 'watch';
  let picked = () => {};
  let ends = {};
  let hours = 0;
  const lengths = [];
  const walls = [];
  // each hour's account, for looking into a long one: the lead's trip first, the scenes, the trip after, the hold
  const notes = [];
  let lastClock = null;
  // a change of zone that is under way (the season's start, a jump to someone watched): an hour waits for it
  let ready = Promise.resolve();
  const voyages = [];

  // ── the zone ────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The city's own crowd is kept off the ground our people stand on: the box round the zone's places, and a pavement's width more. */
  function keepOut() {
    // (the place's own ground, sixteen metres round its point: Sunny Acres' spots now reach its homes and its bus stop
    // on Elm St, and a box out to Elm St hid the city's walkers on its sidewalk as they walked into it, in plain sight)
    const own = id => q => Math.hypot(q[0] - map.PLACES[id].at[0], q[1] - map.PLACES[id].at[1]) <= 16;
    const pts = (map.ZONES[loader.zone]?.places ?? []).flatMap(id => [map.PLACES[id].at, ...Object.values(map.PLACES[id].spots), ...((map.STANDS.blocks[id] ?? map.STANDS.held[id] ?? []).map(q => [q.x, q.z]))].filter(own(id)));
    if (!pts.length) return actors.setKeepOut(null);
    actors.setKeepOut([Math.min(...pts.map(q => q[0])) - 6, Math.min(...pts.map(q => q[1])) - 6, Math.max(...pts.map(q => q[0])) + 6, Math.max(...pts.map(q => q[1])) + 6]);
  }
  /** A first view of a place, for the stream to build round (the camera's own shot follows at once). */
  const viewAt = place => {
    const [x, z] = map.PLACES[place]?.at ?? map.ZONES[map.zoneOf(place)].at;
    return { pos: [x + 12, 24, z + 4], tgt: [x, 1, z], fov: 42 };
  };
  /** A JUMP to another zone with nobody travelling (the season starts there, or the viewer asks for someone who is there). */
  async function goZone(z, place = null, { veil = true } = {}) {
    if (!z || z === loader.zone) return;
    director.abort();
    // (`veil: false`: the picture is never black. For an hour the panels hurry by, the player's own in the jail or
    // the clinic: they bring the move menu up half a second later whatever the stage is doing, and a menu must not
    // be up over a black picture. The zone was started building when they were taken away: the cut finds it in the
    // cache, and what is seen is the new place coming up, not a veil)
    if (veil) await travel.fade.out();
    try {
      await loader.enter(z, place ? viewAt(place) : null);
      director.setZone(z);
      keepOut();
      camera.arrived();
    } finally {
      if (veil) travel.fade.in();
    }
  }
  /** THE PLAIN CUT that puts the followed person where an hour leaves them, at once: black, the zone, them in their place, the picture. */
  async function cutLead(id, end) {
    const to = end.held ?? end.block;
    const z = map.zoneOf(to);
    director.abort();
    await travel.fade.out();
    try {
      if (z && z !== loader.zone) {
        await loader.enter(z, viewAt(to));
        director.setZone(z, { except: id });
        keepOut();
      }
      director.settle(id, end.block, end.held ? 'street' : end.spot ?? 'street', end.held);
      camera.arrived();
    } finally {
      await travel.fade.in();
    }
  }
  /**
   * THE LEAD'S TRIP. The destination's zone starts building as they set off (loader.prepare); the picture goes
   * black when the departure has played; the cut waits there until the zone stands; everyone is seated afresh; they
   * arrive. → { arrived, done }: they stand at the new place · they are on their own spot there.
   */
  // the player's own trip while it is on the picture (play), and who is told
  let journeying = null;
  let travelTold = null;
  function travelOver() {
    if (!journeying) return;
    journeying = null;
    travelTold?.(false);
  }
  function voyage(id, end) {
    const to = end.held ?? end.block;
    const z = map.zoneOf(to);
    const moving = z !== loader.zone;
    const note = { hour: hours, id, from: director.placeOf(id), to, zone: moving ? z : null, t0: performance.now(), leave: null, load: null, total: null };
    voyages.push(note);
    if (voyages.length > 80) voyages.shift();
    if (moving) loader.prepare(z);
    // (taken to the jail or the clinic: the block the game lets them out on is known, and its zone starts building
    // too. The panels hurry a held player's hours by, and the cut that brings them back should not wait for it)
    const exit = end.held ? game?.map?.held?.[end.held]?.exit : null;
    if (exit && map.zoneOf(exit)) loader.prepare(map.zoneOf(exit));
    // (the panels are told while the player's own trip is on the picture: it can be skipped, skipTravel below)
    if (mode === 'play' && id === you) {
      journeying = id;
      travelTold?.(true);
    }
    const out = director.voyage(id, end, async actor => {
      note.leave = +((performance.now() - note.t0) / 1000).toFixed(2);
      note.mode = actor?.mode ?? null;
      // (the viewer asked for someone or somewhere else while they were setting off: the zone is no longer theirs
      // to move. They go on as anyone does who leaves for a place that is not loaded)
      if (leadId() !== id) return;
      // THE PICTURE IS BLACK FROM HERE (travel.leave made it so for the followed person) until the new place stands:
      // nothing of the place they left is shown again.
      // THE CITY'S CARRIAGE, on a subway trip: it opens over the black and plays ONE SLICE of the ride at the city's
      // own pace (rides.between: the last run into their station, the brakes, the doors). NOTHING ELSE IS DONE WHILE
      // IT PLAYS: the zone is changed after it has closed, under the black, where a long frame is a still black
      // picture and not a carriage that stops dead (changed under the carriage, the stream's first frame of the new
      // zone held the page for a third of a second).
      if (actor?.carriage && rides && !actor.skipped) {
        const [a, b] = [map.PLACES[note.from]?.at, map.PLACES[to]?.at];
        const t0 = performance.now();
        travel.fade.under(true);
        try {
          const r = await Promise.race([
            rides.between(id, { from: a, to: b }).catch(err => {
              console.warn('[stage] the carriage did not open:', err);
              return { opened: false };
            }),
            // (skipped while it rides: closed, and the rest of the trip is not played)
            actor.skipping.then(() => (rides.closeBetween(), { opened: true, left: true })),
          ]);
          note.carriage = r.opened ? r.wait ?? 0 : false;
          note.carriageSeconds = r.seconds ?? null;
          // (its own Esc or × closed it: that is a skip too)
          if (r.left && !actor.skipped) actor.skip();
        } finally {
          rides.closeBetween();
          travel.fade.under(false);
        }
        note.carriageWall = +((performance.now() - t0) / 1000).toFixed(2);
      }
      if (moving) {
        const entry = await loader.enter(z, viewAt(to));
        note.load = entry.seconds;
        director.setZone(z, { except: id });
        keepOut();
        // (the new zone's first frames, its meshes going to the card, are drawn under the black too)
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      }
    });
    out.arrived.then(() => !director.riding(id) && id === journeying && travelOver(), () => {});
    out.done.then(() => {
      note.total = +((performance.now() - note.t0) / 1000).toFixed(2);
    });
    return out;
  }

  // BLOOD ON WHOEVER IS SHOT (gore.js: the city's own blood, stage/gorefx.js): when a gun is fired at somebody and
  // the scene says it went home (the director's 'shot'), at the moment of the shot, and kept while they lie hurt.
  // `?blood=0`, or the city's own `?gore=0`, leaves it out.
  const gore = QS.get('blood') === '0' || QS.get('gore') === '0' ? null : await createGore({ city, CITY, actors }).catch(err => {
    console.warn('[stage] the blood did not load:', err);
    return null;
  });
  director.on((what, shot) => {
    if (what === 'shot' && shot.hit) gore?.hit(shot.at, shot.by);
    // (a fist that lands, on a step that asks for blood: director.js 'blow', at the clip's contact moment)
    if (what === 'blow') gore?.blow(shot.at, shot.by, shot.clip);
  });

  // what is playing now, for the tools: the kinds of the scenes on stage
  const playing = new Set();
  director.on((what, scene) => {
    if (what === 'start') {
      playing.add(scene);
      // (the audit's proof that scenes played: its other counts mean nothing on a run where none did)
      actors.count('scenes');
    } else playing.delete(scene);
  });

  // ── BY NIGHT, WHOEVER THE PICTURE IS ABOUT STANDS IN LAMP LIGHT ────────────────────────────────────────────────
  // The owner's first whole season: at 20:00 on Glasswall Plaza the people were dark shapes on a dark plaza and only
  // the name tags said anyone was there. The city lights its night with its own street lamps (render/night.js: the
  // lamp light of the twelve lamps nearest the camera), and a plaza's middle, the night market's yard and all of
  // Sunny Acres have none. So a KEY LAMP of the same light is kept over the followed person, and one over each scene
  // that is playing somewhere else on stage: it is still night, and they stand in a pool of lamp light as under a
  // street lamp. KEY: how high the lamp is over the ground they stand on and how far toward the camera (m); lower
  // is brighter and tighter (the city's lamp light falls off with distance^1.4 and ends at 15 m; its own lamps are
  // 5.4 m up). `?key=<up>,<front>` tries others; `?key=0` is the night without it.
  const KEY = (v => (v === '0' ? null : { up: Number(v?.split(',')[0]) || 4.2, front: Number(v?.split(',')[1] ?? '') || 2.4 }))(QS.get('key'));
  if (KEY && set?.setKeys) {
    actors.onFrame(() => {
      if (!(set.nightNow() > 0)) return set.setKeys([]);
      const cam = city.camera.position;
      const over = (x, y, z) => {
        const d = Math.hypot(cam.x - x, cam.z - z) || 1;
        return [x + ((cam.x - x) / d) * KEY.front, y + KEY.up, z + ((cam.z - z) / d) * KEY.front];
      };
      const keys = [];
      const mid = ids => {
        const on = ids.filter(id => actors.has(id)).map(id => actors.get(id)).filter(A => !A.w.hide && !A.room);
        return on.length ? [on.reduce((q, A) => q + A.x, 0) / on.length, on.reduce((q, A) => q + A.y, 0) / on.length, on.reduce((q, A) => q + A.z, 0) / on.length] : null;
      };
      const lead = leadId();
      const L = lead && actors.has(lead) && !actors.get(lead).w.hide && !actors.get(lead).room ? actors.get(lead) : null;
      // (the followed person, and with them whoever a scene has them with, when they are a few steps apart)
      let mine = L ? [L.x, L.y, L.z] : null;
      for (const scene of playing) {
        if (scene.passive || map.zoneOf(scene.block) !== loader.zone) continue;
        const m = mid(scene.actors);
        if (!m) continue;
        if (L && scene.actors.includes(lead)) {
          if (Math.hypot(m[0] - L.x, m[2] - L.z) < 4) mine = m;
        } else if (keys.length < 3) keys.push(over(...m));
      }
      if (mine) keys.unshift(over(...mine));
      set.setKeys(keys);
    });
  }

  // a click on a person: a press and release in one place, on the city itself
  const canvas = city.renderer.domElement;
  let down = null;
  const clicks = { down: 0, up: 0, last: null };
  canvas.addEventListener('pointerdown', e => {
    clicks.down += 1;
    down = e.button === 0 ? [e.clientX, e.clientY, performance.now()] : null;
  });
  // (on the window: the city's own camera controls capture the pointer on a press, and a release then need not come
  // back to the canvas. On the way down: while the city's rig is on a person it stops a release at the canvas, and
  // a click on the next person would never be heard)
  addEventListener('pointerup', e => {
    const d = down;
    down = null;
    clicks.up += 1;
    if (!d || Math.hypot(e.clientX - d[0], e.clientY - d[1]) > 6 || performance.now() - d[2] > 450) return;
    const id = actors.pickAt(e.clientX, e.clientY);
    clicks.last = id;
    if (id) {
      const asks = camera.asks;
      camera.picked(id);
      picked(id);
      // watching, a second click on the person the camera is on lets them go: the panels drop them without a word
      // to the stage, so the stage reads their silence and goes back to the wide shot
      if (mode === 'watch' && camera.following === id && camera.asks === asks) camera.focus(null);
    }
  }, true);

  // THE PICTURE SITS IN THE GAP THE PANELS LEAVE. The panels cover the top, both sides and the bottom of the page;
  // what the camera aims at would land in the middle of the page, half under them. So the camera's picture is slid
  // over (a view offset: the projection moves, nothing else does) until its middle is the middle of the free gap.
  // The gap is measured off the page, from whatever panels are there; with none, nothing moves. Both arrangements
  // of the panels are read: the wide ones (a column each side, a bar on top, the ticker below) and the thin rails
  // (a rail each side, a slim line at the top, one move card at the bottom centre).
  let seenFlyout = 0;
  let seenGuide = 0;
  let seenCard = 0;
  let seenFit = '';
  function fitToPanels() {
    const W = innerWidth;
    const H = innerHeight;
    const box = sel => [...document.querySelectorAll(sel)].map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    const left = Math.max(0, ...box('.hk-left > *, .hk-rail.is-left').map(r => r.right).filter(x => x < W * 0.45));
    // While a move is being chosen the panels also open a flyout beside the menu and a guide strip over the ticker.
    // Their room is kept for good once they have been seen: the picture must not slide each time one opens or shuts.
    for (const r of box('.hk-flyout')) seenFlyout = Math.max(seenFlyout, r.width + 8);
    for (const r of box('.hk-guide > *')) seenGuide = Math.max(seenGuide, r.height + 8);
    // (the move card grows and shrinks with what is picked on it: its tallest so far is kept, up to a third of the
    // page, so the person the camera is on sits clear above it and the picture does not ride up and down with it. A
    // card that changes its size on purpose says so, `data-fit`: the run's bar folded or open. Then it is measured anew)
    const fit = document.querySelector('.hk-move-card')?.dataset.fit ?? '';
    if (fit !== seenFit) [seenCard, seenFit] = [0, fit];
    for (const r of box('.hk-move-card')) seenCard = Math.max(seenCard, Math.min(H / 3, H - r.top + 8));
    const right = Math.min(W, ...box('.hk-right, .hk-rail.is-right').map(r => r.left).filter(x => x > W * 0.55)) - seenFlyout;
    // (and a side panel laid across the page under the top line, at phone width: the run's dock, demo/run/)
    const top = Math.max(0, ...box('.hk-top').map(r => r.bottom).filter(y => y < H * 0.4), ...box('.hk-left > *').filter(r => r.width > W * 0.6).map(r => r.bottom).filter(y => y < H * 0.5));
    const bottom = Math.min(H - seenCard, ...box('.hk-ticker').map(r => r.top).filter(y => y > H * 0.6)) - seenGuide;
    lastGap = { left, right, top, bottom };
    let dx = Math.round(W / 2 - (left + right) / 2);
    let dy = Math.round(H / 2 - (top + bottom) / 2);
    // (while the run's opening plays its panels are laid out but not painted: the slide is held where they will put
    // it, as the last play in this window left it, so the city's last picture and the room share it. opening.js)
    const kept = document.body.classList.contains('hk2-opening') ? inside.pinned?.() ?? null : null;
    if (kept) [dx, dy] = kept;
    const now = city.camera.view;
    if (!dx && !dy) {
      if (now?.enabled) city.camera.clearViewOffset();
      return;
    }
    if (now?.enabled && now.offsetX === dx && now.offsetY === dy && now.fullWidth === W && now.fullHeight === H) return;
    city.camera.setViewOffset(W, H, dx, dy, W, H);
  }
  const fitting = setInterval(fitToPanels, 500);

  // ── THE DEPTH THE CAMERA CAN TELL APART. The owner, 2026-11-13: "we get these glitches all around the city with
  // overlapping 3d shapes, on the ground planes, corners of objects" and "we gotta fix that ground/texture glitch around
  // the city on floors and edges in intersecting textures". The city's camera keeps everything from 0.1 m to 4 km in
  // one depth range, so from the game's height it cannot tell two surfaces a centimetre apart from each other, and
  // they flicker as it moves. The near end now follows the camera's height (nothing is that near a camera that high;
  // low, at a door, it stays a quarter of a metre): from where the game is played the depth is about thirty times
  // finer. Two faces that lie in exactly one plane still fight: those are pieces of the city itself.
  actors.onFrame(() => {
    const cam = city.camera;
    if (!cam?.isPerspectiveCamera) return;
    const near = Math.max(0.25, Math.min(3, cam.position.y * 0.08));
    if (Math.abs(near - cam.near) > cam.near * 0.08) {
      cam.near = near;
      cam.updateProjectionMatrix();
    }
  });

  /** Pieces two or more people share (a family's skin and hair), rolled once from the family's name. */
  const kin = (family, slots) => {
    const look = CH.rollLook(hashOf(family) & 0xffffff);
    return Object.fromEntries(slots.map(slot => [slot, look[slot]?.id ?? look[slot]]).filter(([, piece]) => piece && piece !== 'none'));
  };

  function begin({ game: g, you: id = null, mode: m = 'watch' }) {
    game = g;
    you = id;
    mode = m;
    hours = 0;
    seenFlyout = 0;
    seenGuide = 0;
    seenCard = 0;
    director.clear();
    director.setPlayer(mode === 'watch' ? null : you);
    for (const A of actors.all()) actors.remove(A.id);
    const { state } = game;
    ends = {};
    // the zone the season opens in: where the lead is (everyone is put where the state has them; whoever is not in
    // that zone is away)
    firstSeat = state.order[0] ?? null;
    lastFollowed = null;
    const first = state.agents[mode === 'watch' ? firstSeat : you ?? firstSeat];
    const place0 = first ? (first.state === 'jail' || first.state === 'clinic' ? first.state : first.block) : map.START;
    const z0 = map.zoneOf(place0) ?? map.zoneOf(map.START);
    director.setLead(mode === 'watch' ? firstSeat : you);
    director.setZone(z0);
    for (const agentId of state.order) {
      const a = state.agents[agentId];
      const held = a.state === 'jail' || a.state === 'clinic' ? a.state : null;
      // the look is rolled from the name, so the same agent has the same face in every season it is in
      actors.add({ id: agentId, name: a.name, x: 0, z: 0, look: { seed: `agent:${a.name}`, ...LOOKS.agent() } });
      director.add({ id: agentId, kind: 'agent', block: a.block, spot: 'street', held, routine: held === 'jail' ? 'sit_cell' : held === 'clinic' ? 'lie_hurt' : 'idle' });
      ends[agentId] = { block: a.block, spot: 'street', held };
    }
    for (const npc of Object.values(state.npcs ?? {})) {
      const look = (LOOKS[npc.role] ?? LOOKS.buyer)(npc, kin);
      actors.add({ id: npc.id, name: npc.name, x: 0, z: 0, look: { seed: `npc:${npc.name}`, ...look } });
      const home = npc.held ? { block: npc.held, spot: 'street', held: null } : { block: npc.block, spot: npc.spot ?? 'street', held: null };
      director.add({ id: npc.id, kind: 'npc', role: npc.role, ...home, routine: 'idle', keep: !!npc.keep });
    }
    actors.mark(mode === 'watch' ? null : you);
    if (z0 === loader.zone) {
      keepOut();
      camera.begin({ you, mode });
    } else {
      // (the zone is not the one that is loaded: it is, behind the fade, before the first hour plays)
      ready = (async () => {
        await travel.fade.out();
        try {
          await loader.enter(z0, viewAt(place0));
          director.setZone(z0);
          keepOut();
          camera.begin({ you, mode });
        } finally {
          travel.fade.in();
        }
      })().catch(err => console.warn('[stage] the opening zone did not load:', err));
    }
  }

  /** Whether the season's own state says an agent is held, which outranks anything read off one hour's events. */
  function heldNow(id) {
    const s = game?.state.agents[id]?.state;
    return s === 'jail' || s === 'clinic' ? s : s === 'free' ? null : undefined;
  }

  /**
   * `hurried`: the player is held (the pen, the tent) and the panels are letting this hour go by in a second. Nothing
   * is sped up for it. The player is put in their place at once instead of walked there, so the picture is the bed
   * or the bench the ticker is talking about, at the speed the top line shows.
   */
  // the hour that is playing, for the tools: a tour of the places waits for it to end before it moves anybody
  let inFlight = Promise.resolve();
  // (ONE HOUR AT A TIME. The panels do not wait for an hour they hurry by, the player's own in the jail or the
  // clinic: they call for the next half a second later. An hour is a trip and its scenes now, and two at once would
  // each move the zone: the next one starts when this one is done.)
  function playHour(line, opts) {
    inFlight = inFlight.catch(() => {}).then(() => playHour1(line, opts));
    return inFlight;
  }
  /** For the tools: lets the hour in flight play out (the panels may have been paused in the middle of it). */
  async function quiet() {
    if (!actors.speed) actors.setSpeed(1);
    await inFlight.catch(() => {});
    await ready;
  }
  async function playHour1(line, { seen = line.events ?? [], speed = 1, hurried = false } = {}) {
    if (!game) throw new Error('stage.playHour before stage.begin');
    const classes = Object.fromEntries(game.state.order.map(id => [id, game.state.agents[id].cls]));
    // the season's state is the truth about who is held, when it stands at the end of this very hour (it does when
    // the panels play a line as it is made; a replayed old line has only its own events to go by)
    const fresh = game.state.t === line.t + 1 || game.state.phase !== 'day';
    const held = fresh ? Object.fromEntries(game.state.order.map(id => [id, heldNow(id)])) : null;
    const plan = planHour(line, { seen, classes, prev: ends, held });
    ends = plan.ends;
    hours += 1;
    const instant = !(speed < 50);
    if (!instant) actors.setSpeed(speed);
    await ready;
    camera.hour();
    // THE LEAD'S HOUR. When it takes them to another place by a cut, the trip is made here, round the hour's scenes:
    // FIRST when they have no business where they are (they set off at the top of the hour, as every mover does, and
    // the hour's scenes play where they arrive), AFTER the scenes when they have (the arrest is played, then they
    // are taken away). Scenes at a place that is not loaded are not staged at all.
    const id = leadId();
    director.setLead(id);
    director.brief(plan);
    const L = id ? director.people.get(id) : null;
    const end = L ? plan.ends[id] : null;
    const from = L ? director.placeOf(id) : null;
    const to = end ? end.held ?? end.block : null;
    const t0 = actors.clock;
    const wall0 = performance.now();
    const note = { hour: hours, lead: id, from, to, first: null, scenes: null, after: null, held: null, len: null };
    let after = null;
    if (L && to && (to !== from || L.away)) {
      if (instant) {
        // (a skipped hour: nothing is played. The picture goes to where the hour leaves them)
        await goZone(map.zoneOf(to), to, { veil: false });
      } else if (hurried) {
        // AN HOUR THE PANELS HURRY BY (the player's own, held): the player has pressed Continue, and this is the cut
        // it asked for: to the jail or the clinic from where they were taken, or back out onto the street. A plain
        // cut, and the panels wait for it before the next card or menu comes up.
        await cutLead(id, end);
      } else if (mode === 'play' && id === you && end.held && L.held !== end.held) {
        // TAKEN THIS HOUR, AND PLAYING: NOTHING TAKES THE PLAYER SOMEWHERE WITHOUT A PRESS. The hour's scenes play
        // where they are and they are left there, hurt or cuffed, with the panels' card up ("Continue takes you to
        // the clinic"). The cut is the next hour's, above. Both places start building now.
        for (const place of [to, game?.map?.held?.[end.held]?.exit]) if (place && map.zoneOf(place)) loader.prepare(map.zoneOf(place));
      } else if (director.cutTo(id, end)) {
        const busyHere = !L.away && plan.scenes.some(s => !s.passive && s.actors.includes(id) && s.block === from);
        if (busyHere) after = end;
        else {
          // (whatever of the last hour is still under way, a walk off, a routine's step, is dropped: nothing of it
          // may send them back while they travel)
          director.abort();
          await voyage(id, end).arrived;
        }
      }
    } else if (L?.away && from) await goZone(map.zoneOf(from), from);
    note.first = +(actors.clock - t0).toFixed(1);
    if (hurried && !instant && end?.held && !L?.inside) director.settle(id, end.block, 'street', end.held);
    const t1 = actors.clock;
    await director.playHour(plan, { instant });
    note.scenes = +(actors.clock - t1).toFixed(1);
    if (after && !instant) {
      const t2 = actors.clock;
      director.abort();
      const v = voyage(id, after);
      // (the hour is over when they stand at the new place. Whoever plays is walked to their own spot first, a few
      // seconds at most: the move menu does not come up over somebody still on their way. Watching, the next hour
      // starts as they walk in)
      await Promise.race([v.done, v.arrived.then(() => actors.seconds(mode === 'watch' ? 0.8 : 5))]);
      note.after = +(actors.clock - t2).toFixed(1);
    }
    await ready;
    // THE HOUR IS NEVER SHORTER THAN ITS TICKER. The panels tell every event this viewer may see, one row after
    // another on the hour's own clock (director-plan.js: the same weights). When little or none of it was on stage
    // (it happened at places that are not loaded) the scenes are over in a moment, and the hour is held until the
    // last row has had its time: the panels' hours run as they always did.
    if (!instant && !hurried) {
      const rows = Math.min(HOUR_MS - 900, 300 + seen.reduce((ms, e) => ms + weightOf(e), 0)) / 1000;
      const left = rows - (actors.clock - t0);
      if (left > 0.05) {
        note.held = +left.toFixed(1);
        await actors.seconds(left);
      }
    }
    // (held somewhere: the block the game lets them out on is known, and its zone starts building now, so the cut
    // that brings them back does not wait for it)
    const out = end?.held ? game.map?.held?.[end.held]?.exit : null;
    if (out && map.zoneOf(out)) loader.prepare(map.zoneOf(out));
    note.len = +(actors.clock - t0).toFixed(1);
    note.log = director.log.filter(e => e.hour === director.hourNo).map(e => `${e.kind}@${e.block} ${e.began}+${e.took}${e.waited > 0.5 ? ` (waited ${e.waited})` : ''}${e.ownWalk ? ` own walk ${e.ownWalk}` : ''}${e.took > 6 ? ` [${e.steps.join(', ')}]` : ''}`);
    // (the lead's own walks this hour: where to, how far, at what pace, how long, for the tools)
    note.walks = director.trips.filter(e => e.hour === director.hourNo && e.id === id).map(e => `${e.to}${e.xz ? ` (${e.xz})` : ''} ${e.way ?? '?'} m @${e.pace ?? '-'} ${e.took ?? '-'} s ${e.ended}`);
    notes.push(note);
    if (notes.length > 80) notes.shift();
    // how long the hour's scenes took, in seconds at 1× (the hour is meant to be about ten), and on the wall
    if (!instant) lengths.push(+(actors.clock - t0).toFixed(1));
    if (!instant) walls.push(+((performance.now() - wall0) / 1000).toFixed(1));
  }

  return {
    begin,
    playHour,
    setSpeed(n) {
      actors.setSpeed(n);
    },
    screenOf: id => actors.screenOf(id),
    /**
     * The panels (or a click) ask for a person, a block, or nothing. Someone or somewhere in the zone that is loaded:
     * the camera goes there. Somewhere else: WATCHING, the picture jumps to that zone behind the fade (the hour's
     * scenes are dropped: they were at the place just left); PLAYING, nothing moves: the game stays where the player is.
     */
    focus(target) {
      const person = target && actors.has(target) ? director.people.get(target) : null;
      const place = person ? (person.away ? director.placeOf(target) : null) : target && map.PLACES[target] && map.zoneOf(target) !== loader.zone ? target : null;
      if (place) {
        if (mode !== 'watch') return;
        ready = ready.then(() => goZone(map.zoneOf(place), place)).then(() => {
          camera.focus(target);
          if (person) lastFollowed = target;
          director.setLead(leadId());
        }).catch(err => console.warn('[stage] the picture did not jump to', target, err));
        return;
      }
      camera.focus(target);
      if (person && mode === 'watch') lastFollowed = target;
      director.setLead(leadId());
      // (a place was let go of, and whoever the zone follows is somewhere else: the picture goes back to them)
      const id = leadId();
      if (!target && mode === 'watch' && id && director.people.get(id)?.away) {
        const at = director.placeOf(id);
        ready = ready.then(() => goZone(map.zoneOf(at), at)).catch(err => console.warn('[stage] the picture did not go back to', id, err));
      }
    },
    onPick(fn) {
      picked = typeof fn === 'function' ? fn : () => {};
    },
    /** `fn(on)`: the player's own trip is on the picture (a departure, the carriage, an arrival), or no longer. */
    onTravel(fn) {
      travelTold = typeof fn === 'function' ? fn : null;
    },
    /** Is the player's own trip on the picture now? */
    get travelling() {
      return !!journeying && director.riding(journeying);
    },
    /**
     * SKIPS THE PLAYER'S OWN TRIP: what is playing of it (the departure, the carriage, the arrival) ends at once and
     * they stand at the place they were going to, the camera on them. Nothing else is skipped. → was there one?
     */
    skipTravel() {
      if (!journeying || !director.riding(journeying)) return false;
      const did = director.skipTrip(journeying);
      if (did) rides?.closeBetween();
      return did;
    },
    setClock(clock) {
      lastClock = clock;
      set?.setClock?.(clock);
    },
    portraitOf(id) {
      try {
        return Promise.resolve(actors.has(id) ? actors.portrait(id) : null);
      } catch (err) {
        console.warn('[stage] no portrait for', id, err);
        return Promise.resolve(null);
      }
    },
    /**
     * THE RUN BEGINS (demo/run/index.js, before its first hour). The player's pad is built from the starter pack,
     * showing what `owned()` ({ bed, … }, the run's own state) says is owned, and the room follows it as things are
     * bought (set/starter.js, set/crib.js). With `opening`, the city is shown first and the picture is left black for
     * the run's first morning, let go once the room is up round the player (opening.js). Resolves when the run may go
     * on: { played, skipped, ms }.
     */
    async openRun({ you: id, owned = () => ({}), opening: play = true } = {}) {
      const key = set?.padOf?.(id) ?? `pad:${id}`;
      set?.useStarter?.({ pad: key, owned });
      if (!play || !inside.has(key)) return { played: false };
      // (the opening the owner chose, 2026-11-13: the player walks home and in, as at any hour, the camera coming
      // down to them: the page puts them outside under this black and then asks for stage.walkIn. The city
      // unstacked round the trailer is still here: ?opening=unstack)
      if (new URLSearchParams(location.search).get('opening') !== 'unstack') {
        travel.fade.blackNow();
        document.body.classList.add('hk2-opening');
        return { played: false, walkIn: true };
      }
      try {
        return await opening.play({ key });
      } catch (err) {
        console.warn('[stage] the opening did not play:', err);
        document.body.classList.remove('hk2-opening');
        if (travel.fade.dark) travel.fade.in();
        return { played: false };
      }
    },

    /** THE RUN's opening, the walk in (opening.js): `go()` is the page's own going inside for `you`, who stands outside. */
    async walkIn({ you: id, go }) {
      const key = set?.padOf?.(id) ?? `pad:${id}`;
      try {
        return await opening.walkIn({ you: id, key, go });
      } catch (err) {
        console.warn('[stage] the walk in did not play:', err);
        document.body.classList.remove('hk2-opening');
        if (travel.fade.dark) travel.fade.in();
        return { played: false };
      }
    },

    // not part of the contract: for the tools and for looking into a problem
    /** A ring on the ground under one agent (the player's own, set by `begin`; the panels may move it). */
    markPlayer(agentId) {
      actors.mark(agentId);
    },
    /**
     * Stands the player on a block, in the pen ('jail'), in the tent ('clinic') or in their own pad ('pad'), and
     * points the camera at them: for looking at every view the play camera has (demo/tools/stage-views.mjs).
     */
    async tour(place) {
      const who = you ?? firstSeat;
      const P = director.people.get(who);
      if (!P) return false;
      const home = Object.keys(game.map.blocks).find(id => game.map.blocks[id].pads) ?? P.block;
      const street = map.BLOCKS[P.block] ? P.block : home;
      const at = place === 'pad' ? home : place;
      await quiet();
      await goZone(map.zoneOf(at), at);
      if (place === 'jail' || place === 'clinic') director.settle(who, street, 'street', place);
      else if (place === 'pad') director.settle(who, home, `pad:${who}`);
      else director.settle(who, place, 'street');
      camera.focus(mode === 'watch' ? null : who);
      return true;
    },
    /**
     * THE PLAYER IS TAKEN TO THE JAIL OR THE CLINIC, on their press (the panels' Continue on the card that came up
     * where it happened): the plain cut there. Resolves when the picture is back, at the place. Not part of the
     * first contract: the panels call it when it is there.
     */
    async take(id, held) {
      await inFlight.catch(() => {});
      await ready;
      const P = director.people.get(id);
      if (!P || !map.HELD[held] || (P.held === held && P.inside)) return false;
      await cutLead(id, { block: ends[id]?.block ?? P.block, spot: 'street', held });
      return true;
    },
    /**
     * For the tools: sends one person on a trip by cut to a block, now. The followed person's moves the zone (the
     * stage's own voyage); anyone else's is watched from where the camera is. → { arrived, done }
     */
    async trip(id, block, spot = 'street') {
      await quiet();
      director.setLead(leadId());
      const end = { block, spot, held: null };
      return id === leadId() ? voyage(id, end) : director.voyage(id, end);
    },
    /**
     * A CHANGE OF ZONE THE PAGE MAKES UNDER ITS OWN BLACK (join-1: the run's try-out stop, demo/run/trip.js): the zone
     * becomes all there is round `view` (the camera is cut there for the city to build round), the director's people
     * are seated afresh in it (away where their place is not in it) and the city's crowd is kept off as the zone wants.
     * No fade and no camera move of its own: the page holds the black and puts the camera where it wants it. → the
     * loader's entry ({ seconds, built, cached, blocks }).
     */
    async enterZone(z, view = null) {
      await inFlight.catch(() => {});
      await ready;
      director.abort();
      const entry = await loader.enter(z, view);
      director.setZone(z);
      keepOut();
      return entry;
    },
    /** The place's own camera shot (the tools' pictures): the zone is loaded first. */
    async showPlace(place) {
      await quiet();
      await goZone(map.zoneOf(place), place);
      camera.focus(place);
      return true;
    },
    /** Cuts the camera in on the first playing scene whose kind matches (for the tools' pictures). */
    showScene(pattern) {
      const scene = [...playing].find(s => pattern.test(s.kind));
      if (scene) camera.show(scene);
      return !!scene;
    },
    stop() {
      clearInterval(fitting);
      city.camera.clearViewOffset();
    },
    actors,
    /**
     * TRYING ON (lib-1): the player shown wearing `pieces` ({ cast slot: id }, e.g. from src/run/library.mjs tryOn's
     * `dress`) until tryOff(); nothing of the run changes. The page ends it when the player leaves the wardrobe or stall.
     */
    tryOn: pieces => (you ? actors.tryOn(you, pieces) : false),
    tryOff: () => (you ? actors.tryOff(you) : false),
    director,
    camera,
    seeThrough,
    gore,
    figures,
    stands,
    doorway,
    inside,
    opening,
    fall,
    loader,
    travel,
    rides,
    map,
    debug() {
      return {
        zone: loader.zone, lead: leadId(), loads: loader.log.slice(-60), voyages: voyages.slice(-60), travel: { ...travel.count }, rides: rides ? (({ last, ...r }) => r)(rides.stats()) : null, tally: { ...director.tally }, walls: walls.slice(-80), memory: loader.memory(),
        away: [...director.people.values()].filter(P => P.away).length, unfit: stands.unfit(), figures: figures.count, blood: gore?.stats() ?? null,
        notes: notes.slice(-80),
        leadAt: director.placeOf(leadId()), leadMoving: !!director.people.get(leadId())?.transit, dark: travel.fade.dark,
        hours, clock: lastClock, you, clicks: { ...clicks }, audit: actors.audit(), onStage: actors.all().filter(A => !A.w.hide).length, inside: [...director.people.values()].filter(P => P.inside).map(P => ({ id: P.id, key: P.inside, shown: !!P.shown })),
        lengths: lengths.slice(-80), playing: [...playing].map(s => ({ kind: s.kind, block: s.block, actors: s.actors })), people: director.people.size, running: director.running, speed: actors.speed, user: camera.user, following: camera.following,
        near: actors.all().filter(A => A.w.tier === 1).length, drawn: actors.all().filter(A => A.w.tier).length,
        cam: camera.state(),
        offset: city.camera.view?.enabled ? [city.camera.view.offsetX, city.camera.view.offsetY] : null,
        missing: Object.fromEntries(actors.all().filter(A => A.missing.length).map(A => [A.id, A.missing])),
        set: set ? Object.keys(set) : null,
        insideView: inside.debug(),
      };
    },
  };
}

function hashOf(text) {
  let h = 2166136261;
  for (let k = 0; k < text.length; k++) h = Math.imul(h ^ text.charCodeAt(k), 16777619);
  return h >>> 0;
}
