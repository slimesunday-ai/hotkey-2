// THE POT'S PEOPLE WEAR IT (pot-3): who the rules say is under what (src/run: `v.under`, each row's `look` channels;
// RUN.md "The pot (pot-1)", "For the screens") put on their bodies on the stage, and taken off when the rules say it is
// over. The facts are the rules' (who, what, from when, until when, where); what it looks like and when it goes on and
// off on a body is this file's. The owner's rule for crafting: every bad reaction is an ANIMATION.
//
//   asleep  (legs 'asleep', overhead 'zzz')   Zonked: down where they stand, z's over them; up again with a stretch
//   dancing (legs 'dance', skin 'rainbow', crowd)   Disco Rash: dancing in rainbow, and strangers near catch it
//   pukes   (trail 'puke', overhead 'sick')   a dirty batch's first buyer throws up green, there, as the sale ends;
//                                             then whatever the bag does
//
// WHEN. The run's page hands every hour's line the rules' rows that are on (scenes.js lineOf: `line.under`), and the
// stage calls this file three times an hour:
//   hour(line)   at the top of the hour: what is wanted now; whoever has nothing on any more is let go (seen: they come
//                out of it as they do, waking with a stretch, the dance winding down; unseen: at once)
//   after()      when the hour's scenes are done: whoever was in one (the sale) is given theirs then, as it ends,
//                from its start (going down, the shiver into the dance; the Pukes first); anybody else not yet wearing
//                theirs is FOUND under it (asleep already, dancing already: `t` into the look), never seen to start
//   seat()       under the black of a cut, when the zone has been seated afresh: whoever is wanted and now on stage is
//                found under it, and a dancer's strangers are put round them already dancing
// A person under a look is held by the director where they are (director.pin: no routine, no walk; a scene's walk up
// to them stops beside them) until the look is off their body.
//
//   const under = createUnder({ looks, actors, director })
//   under.hour(line, { instant }) · under.after({ instant }) · under.seat() · under.state() → { want, on, log }
import { clockAt } from '../../../src/run/effects.mjs';

/** The rules' look channels → the stage's look (looks/index.js LOOKS): the body's first, then what rides along. */
export function lookOf(look) {
  if (!look) return null;
  if (look.legs === 'asleep') return 'zonk';
  if (look.legs === 'dance' || look.skin === 'rainbow') return 'disco';
  if (look.trail === 'puke') return 'pukes';
  return null;
}
/** A person's rows that are on → { main, pukes, crowd }: the body's look, whether the Pukes ride along, whether strangers catch it. */
export function wantOf(rows) {
  let main = null;
  let pukes = false;
  let crowd = false;
  for (const r of rows ?? []) {
    const k = lookOf(r.look);
    if (k === 'pukes') pukes = true;
    else if (k && !main) {
      main = k;
      crowd = !!r.look?.crowd;
    }
  }
  return main || pukes ? { main, pukes, crowd } : null;
}
/** Seconds into a look at which a body found under it is already settled in it (asleep and breathing; in the dance). */
const FOUND = { zonk: 9, disco: 3.5, pukes: 0 };
/** The strangers a dancer's patch fills to (the effect's `crowd`: looks.crowd). */
const CROWD = 10;

export function createUnder({ looks, actors, director }) {
  /** id → { main, pukes, crowd, place, until } wanted now (the last line's) */
  let want = new Map();
  /** id → { look, phase: 'pukes' | 'main' | 'off', main } what this file has put on whom */
  const mine = new Map();
  /** who of this hour's scenes are waiting for theirs until the scenes are done */
  let deferred = new Set();
  /** who of this hour's scenes come out of theirs when their scene is over */
  let later = new Set();
  const log = [];
  const note = (what, id, extra = {}) => {
    log.push({ t: +actors.clock.toFixed(2), what, id, ...extra });
    if (log.length > 200) log.shift();
  };
  const P = id => director.people?.get(id) ?? null;
  /** On stage now: in the loaded zone, not off somewhere or on their way. */
  const present = id => {
    const p = P(id);
    return !!p && actors.has(id) && !p.away && !p.transit && !p.off && director.here?.(director.placeOf(id));
  };
  const seen = id => present(id) && !!actors.seen?.(id);

  function wear(id, look, { found = false, then = null } = {}) {
    if (!looks.on(id, look, found ? { t: FOUND[look] ?? 0 } : {})) return false;
    director.pin?.(id, true);
    mine.set(id, { look, phase: look === 'pukes' && then ? 'pukes' : 'main', main: then ?? look });
    note(found ? 'found' : 'on', id, { look });
    return true;
  }
  /**
   * A dancer's strangers (the effect's `crowd`): walking over, or, only under a black picture, already round them
   * (`placed`). Seen to start dancing, they come once the dance has got going (2.5 s in, as the looks page has it).
   */
  function crowdOf(id, placed) {
    const W = want.get(id);
    const m = mine.get(id);
    if (!W?.crowd || m?.look !== 'disco') return;
    m.crowded = true;
    const b = looks.bodyOf(id);
    if (b && b.crowd >= CROWD) return;
    const got = looks.crowd(id, 'disco', { n: CROWD, placed });
    note(placed ? 'crowd placed' : 'crowd', id, { n: got.length });
  }
  function letGo(id, now) {
    const m = mine.get(id);
    if (!m) return;
    if (m.phase !== 'off') {
      looks.off(id, { now });
      // (the strangers who caught it from them are let go with them: they wind down and walk back to their lanes)
      looks.offCrowd?.(id, { now });
      m.phase = 'off';
      note(now ? 'off now' : 'off', id, { look: m.look });
    }
  }

  /** The hour's line: what is wanted now, and whoever was in this hour's scenes (they get theirs after them). */
  function hour(line, { instant = false } = {}) {
    const next = new Map();
    for (const u of line?.under ?? []) {
      const W = wantOf(u.rows);
      if (W) next.set(u.id, { ...W, place: u.place, until: Math.max(...u.rows.map(r => r.until)), clock: u.clock ?? null });
    }
    want = next;
    for (const id of deferred) director.stay?.(id, false);
    const cast = new Set((line?.events ?? []).flatMap(e => e.stage?.steps?.flatMap(s => [s.actor, s.target]) ?? []));
    deferred = new Set([...cast].filter(id => want.has(id) && !mine.has(id)));
    // (left where their scene ends: the look takes them there)
    if (!instant) for (const id of deferred) director.stay?.(id, true);
    // whoever has nothing on any more is let go: seen, they come out of it; unseen, at once. Whoever is in one of this
    // hour's scenes (his wallet lifted in his sleep, in the hour it ends) only when that scene is over: the rules' hour
    // is over at its end, not at its start
    for (const id of later) letGo(id, true);
    later = new Set();
    for (const id of mine.keys()) {
      if (want.has(id)) continue;
      if (cast.has(id) && !instant) later.add(id);
      else letGo(id, instant || !seen(id));
    }
    // what changed on somebody still under something (a dance turned to sleep: Disco Coma): the one off, the next on after
    for (const [id, W] of want) {
      const m = mine.get(id);
      if (m && m.phase !== 'off' && W.main && m.main !== W.main) {
        letGo(id, instant || !seen(id));
        m.swap = W.main;
      }
    }
  }
  /** AS THE SALE ENDS: from its start. A dirty batch: the Pukes first, then what the bag does. */
  function fresh(id) {
    const W = want.get(id);
    deferred.delete(id);
    director.stay?.(id, false);
    if (!W || !present(id)) return;
    if (W.pukes) wear(id, 'pukes', { then: W.main });
    else if (W.main) wear(id, W.main);
  }
  // (the scene a buyer was in has ended: theirs now, where it left them)
  director.on?.((what, scene) => {
    if (what !== 'end' || (!deferred.size && !later.size)) return;
    for (const id of scene?.actors ?? []) {
      if (deferred.has(id)) fresh(id);
      if (later.delete(id)) letGo(id, !seen(id));
    }
  });
  /** The hour's scenes are done. */
  function after({ instant = false } = {}) {
    for (const [id, W] of want) {
      if (!actors.has(id) || mine.get(id)?.phase === 'main' || mine.get(id)?.phase === 'pukes') continue;
      if (mine.get(id)?.phase === 'off' && looks.has(id)) continue;
      if (!present(id)) continue;
      if (deferred.has(id) && !instant) fresh(id);
      else if (W.main) {
        // (a swap in view, a dance wound down into sleep, is seen to start; anything else is found as it is)
        wear(id, W.main, { found: instant || !(mine.get(id)?.swap && seen(id)) });
        if (instant) crowdOf(id, true);
      }
    }
    for (const id of deferred) director.stay?.(id, false);
    deferred.clear();
    for (const id of later) letGo(id, instant || !seen(id));
    later.clear();
  }
  /** Under the black, the zone seated afresh: whoever is wanted and on stage now is found under it. */
  function seat() {
    for (const [id, W] of want) {
      if (!present(id) || !W.main) continue;
      const m = mine.get(id);
      if (!m || m.phase === 'off' || !looks.has(id)) wear(id, W.main, { found: true });
      else if (m.phase === 'pukes') {
        looks.off(id, { now: true });
        wear(id, W.main, { found: true });
      }
      crowdOf(id, true);
    }
    // (and whoever this file still holds who is not wanted, or not here: let go at once)
    for (const id of mine.keys()) if (!want.has(id)) letGo(id, true);
  }

  // EVERY FRAME, a little: the Pukes done, what the bag does starts; a look come off, the director has them back; one
  // held is kept held (a cut's settle stood them up as anyone)
  actors.onFrame(() => {
    if (!mine.size) return;
    for (const [id, m] of mine) {
      const has = looks.has(id);
      if (m.phase === 'pukes' && !has) {
        m.phase = 'main';
        const W = want.get(id);
        if (W?.main && present(id)) wear(id, W.main);
        else {
          director.pin?.(id, false);
          mine.delete(id);
        }
        continue;
      }
      if (m.phase === 'off' && !has) {
        const W = want.get(id);
        if (m.swap && W?.main && present(id)) {
          const swap = m.swap;
          m.swap = null;
          wear(id, swap, { found: !seen(id) });
          continue;
        }
        director.pin?.(id, false);
        mine.delete(id);
        note('free', id);
        continue;
      }
      // (a dancer without strangers: they catch it once the dance has got going, and walk over)
      if (m.phase === 'main' && m.look === 'disco' && !m.crowded && present(id) && (looks.bodyOf(id)?.t ?? 0) > 2.5) crowdOf(id, false);
      const p = P(id);
      if (p && has && !p.down) p.down = true;
    }
  });

  return {
    hour,
    after,
    seat,
    lookOf,
    wantOf,
    state: () => ({
      want: [...want].map(([id, W]) => ({ id, ...W, untilClock: clockAt(W.until).clock })),
      on: [...mine].map(([id, m]) => ({ id, look: m.look, phase: m.phase, main: m.main, body: looks.bodyOf(id) })),
      log: log.slice(-40),
    }),
  };
}
