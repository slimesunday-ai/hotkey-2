// THE FIGHT, LIVE: a test round of THE RUN behind the dead mall (demo/?mode=fight; &site=elm at the ELM ST stop where
// it began: sites.js). The simulation is src/fight/ (it runs headless just the same); this page plays it on the
// stage's people in the city and draws what reads from the game's camera: bars, numbers, the shots, blood, bodies
// going down, things on the ground (fx.js), and every body's moves (anim.js).
//
//   keys    in a round, WASD or the arrows MOVE you (the way the picture shows); attacks are your weapon's own, on the
//           nearest of them in reach or in range. Walk back onto the stairs (or the way out) to leave a fight you are
//           losing. Choosing (the run's keys, join-1): 1 to 5 a loadout, ← → along them, ↑ ↓ how hard, Enter fights
//           (after a round: again), B build your own, J the results side by side, F the dock to one row, I the
//           interface's size, Esc closes one thing (on a run's try-out stop: back to the run)
//   frame   THE RUN'S (join-1; panels.js, dock.js): the where card, the dock with the five loadouts, the meters while a
//           round is on, the result card after it; any weapon, gear and help still to be had (B), folded; with Cousin
//           Earl, how he is told to fight (fight-3: out in front, goes hunting, one at a time; his line and spot shown
//           in the round)
//
//   ONE-ON-ONE (anim-1, in Build your own): what you fight with (bare hands, the box cutter, quick hands, the haymaker,
//           the throw) against one of the five ways the run's people fight, played by itself on the lot exactly as the
//           run plays its fights (demo/run/duel.js, the run's own numbers): for looking at the moves side by side.
//           It changes no rule and keeps no result.
//
//   mountFight(host, { stage, demo, seed, site, tryout }) → the page's api; api.dispose() takes it all off again
//     site    a site of sites.js (else ?site=, else the dead mall)
//     tryout  { back: words, onBack(), ... } when it is a stop of a run's (demo/run/trip.js): Back is the run's
//
// THE STAGE'S OWN PIECES, CALLED: the camera's Lock on the player (camera.js, the run's play camera: 24 m up, 64°
// down, from the east), the rides' way of moving a body by hand every frame (rides/kit.js own(): the stairs and the
// cab use it), the rides' walk up and down a station's stairs (rides/subway.js), the stage's fade to black between
// rounds (travel.js), the city's clips for running and falling (run_getaway, fall_back → lie_hurt, death_collapse →
// lie_still), the stage's blood (gore.js hit and blow). Nothing of the stage is changed for it.
//
// NOBODY POPS (fight-2): every one of them walks in from out of the picture along a way of the site (ways.js,
// sites.js) and is at the entry on the tick the rules bring them in; the city's crowd is kept off the streets round
// the fight only where the picture cannot see it being done (the quiet zone, frame.js quietBox); a new round starts
// behind the stage's own fade to black; and the page checks every picture for anyone who came on or went off in it,
// and for cars or walkers through the arena (watch.js; hud.frameCheck(), the auto-play fails on any).
// THE MOVES (fight-2): the fight's own clips (clips/) on the cast's walkers; who plays which when (anim.js).
import { createFight, step, TICK, ARENA, PRESETS, WEAPONS, FOES, EARL_WAYS, RIVALS, rivalFoe, runDuel, presetOf, kite, levelOf } from '../../src/fight/index.mjs';
import { RUN_CONFIG } from '../../src/run/index.mjs';
import { createDuel } from '../run/duel.js';
import { createRaidFight } from '../run/raidfight.js';
import { raidCase, RAID_HOLDS, RAID_CREWS } from '../run/raidcase.js';
import { report } from '../../src/fight/report.mjs';
import { createKit } from '../stage/rides/kit.js';
import { arenaOn, arenaAt, siteOf, centerFromStairs } from './place.js';
import { createFx } from './fx.js';
import { waysOn, pickWays, pointBack, startOn, wayLength } from './ways.js';
import { quietBox } from './frame.js';
import { createWatch } from './watch.js';
import { installClips } from './clips/index.js';
import { createAnimator } from './anim.js';
import { createGunners } from './puppet/gunner.js';
import { warmBlood } from './puppet/gunmesh.js';
import { placeCover } from './cover.js';
import { createPanels } from './panels.js';
import { stepLevel, stepPreset, LEVEL_KEYS } from './dock.js';

/** Metres a walker on its way in walks out of the picture before it comes into it (ways.js startOn). */
const AHEAD = 3;
/** The longest the round waits, after you are up, for its first people to walk in (s). */
const PRE_MAX = 6;

const YOU = 'fight:you';
const EARL = 'fight:earl';
/** Above a body's feet: the bar (m). */
const BAR_Y = 2.55;
/** A body going this fast (m/s) or more runs (the city's run clip over the walk). */
const RUN_V = 2.9;
const LOOKS = {
  you: { seed: 'agent:you', pool: 'agent' },
  // (named-1: Cousin Earl and Big Moss are two of the city's drawn named people, world/named/: their own pieces, at their
  // own size. The one-on-one's unnamed big man keeps the look the boss had: `bigman`)
  ally: { seed: 'npc:Cousin Earl', named: 'earl', was: { pool: 'agent', wear: { top: 'dock_vest', hat: 'dockhand_beanie' } } },
  heavy: n => ({ seed: `fight:heavy:${n}`, pool: 'agent', wear: { hat: 'corner_rag', top: 'corner_hoodie' } }),
  runner: n => ({ seed: `fight:runner:${n}`, pool: 'agent', wear: { top: 'old_hoodie', hat: 'old_bandana' } }),
  shooter: n => ({ seed: `fight:shooter:${n}`, pool: 'agent', wear: { top: 'old_hoodie', hat: 'old_beanie' } }),
  boss: () => ({ seed: 'fight:boss', named: 'moss', was: { pool: 'agent', wear: { top: 'dock_vest', hat: 'corner_rag', eyewear: 'precinct_aviators' } } }),
  bigman: () => ({ seed: 'fight:boss', pool: 'agent', wear: { top: 'dock_vest', hat: 'corner_rag', eyewear: 'precinct_aviators' } }),
};
const PRESET_KEYS = Object.keys(PRESETS);

export async function mountFight(host, { stage, demo = window.__demo, seed: seed0 = 1, site = null, tryout = null } = {}) {
  const city = demo?.city ?? window.__city;
  const { actors, camera, rides } = stage;
  const kit = rides?.kit ?? createKit({ city, actors, CLIPS: actors.CLIPS });
  // (named-1: Big Moss walks on in the middle of a round and Cousin Earl at its start: their named looks baked now, at
  // the page's mount, so no frame of a round bakes a look for them)
  actors.prebake?.(LOOKS.boss());
  actors.prebake?.(LOOKS.ally);
  // EVERYTHING THIS PAGE HANGS ON THE STAGE AND THE WINDOW, to take off again (dispose: a run's try-out stop leaves)
  const offs = [];
  let dead = false;
  // THE PLACE: the site (sites.js; ?site=elm for the ELM ST stop, else the dead mall), the arena laid there (its
  // middle off the station's own stairs where it has them, as the city has them), and the rules' arena with what
  // stands in it there
  const SITE = siteOf(site ?? new URLSearchParams(location.search).get('site'));
  const st = SITE.stairs ? rides?.station?.(SITE.stairs.top[0], SITE.stairs.top[1], SITE.stairs.station) ?? null : null;
  const A = arenaOn(SITE, ARENA, SITE.stairs ? centerFromStairs(st?.top ?? SITE.stairs.top, st?.dir ?? SITE.stairs.dir) : SITE.center);
  const RULES_ARENA = arenaAt(SITE);
  // (the zone the page opened in: its site's)
  const siteZone = stage.loader?.zone ?? null;
  const W = (x, y, up = 0) => {
    const [wx, wz] = A.world(x, y);
    return [wx, actors.groundAt(wx, wz) + up, wz];
  };
  // THE CITY'S OWN CROWD IS KEPT OFF THE STREETS ROUND THE FIGHT, AND NEVER IN THE PICTURE'S SIGHT. The quiet zone
  // holds every picture the camera can show while you are anywhere in the arena (frame.js quietBox): a walker of the
  // city's inside it is not drawn, outside it is, and the change is only ever made while the picture cannot see that
  // walker. On the first frame, before any picture of the fight, everyone in it at once. (Before: walkers were
  // hidden the moment they stepped into a box round the arena and shown as they stepped out, in plain sight: the
  // owner's "npcs are popping in and out of view".) The actors' keep-out box stays as it was
  actors.setKeepOut([A.box[0] - 2, A.box[1] - 2, A.box[2] + 2, A.box[3] + 2]);
  const street = actors.groundAt(...A.world(...ARENA.start));
  const QUIET = quietBox(A.corners, street, 3);
  const inQuiet = (x, z, pad = 0) => x > QUIET[0] - pad && x < QUIET[2] + pad && z > QUIET[1] - pad && z < QUIET[3] + pad;
  const watch = createWatch({ city, actors, fade: stage.travel?.fade ?? null, near: (x, z) => inQuiet(x, z, 12), street, arena: A.box });
  const quieted = new Set();
  let crowdFirst = true;
  offs.push(actors.onFrame(() => {
    const v = watch.view();
    for (const w of city.peds?.sim?.walkers ?? []) {
      if (w.hk2 || w.agent || !w.p) continue;
      const inside = inQuiet(w.p[0], w.p[2]);
      const ours = quieted.has(w);
      // (in the zone and drawn: taken off; out of it and taken off by us: put back. A walker the city itself keeps
      // undrawn is the city's)
      if (inside ? w.hide : !ours) continue;
      if (!crowdFirst && watch.seen(w.p[0], w.p[2], w.p[1], 0.5, v)) continue;
      w.hide = inside;
      if (inside) quieted.add(w);
      else quieted.delete(w);
    }
    crowdFirst = false;
  }));
  // WHAT STANDS IN IT, measured off the city: every half-metre cell of the arena the city calls solid. The fight's
  // own posts (ARENA.posts) are set from this list by hand; the page only reports it (debug().solid)
  const solid = [];
  for (let x = 0.25; x < ARENA.w; x += 0.5) {
    for (let y = 0.25; y < ARENA.h; y += 0.5) {
      const [wx, wz] = A.world(x, y);
      if (actors.solidKnown(wx, wz) && actors.solidAt(wx, wz)) solid.push([x, y]);
    }
  }

  // THE COVER put on the lot for the fight (cover.js: the city's own kit; sites.js `cover`, among the rules' posts)
  const cover = await placeCover({ city, CITY: demo?.CITY ?? '/city/from-trunk/style/city/', actors, site: SITE });

  // ── the people on the stage ────────────────────────────────────────────────────────────────────────────────────
  const [sx, , sz] = W(...ARENA.start);
  actors.add({ id: YOU, name: 'you', x: sx, z: sz, ry: Math.atan2(A.Y[0], A.Y[1]), look: LOOKS.you });
  // (the first fight comes up the station's stairs: until then you are below, not standing where the stairs will
  // bring you, so you are not taken off the lot in plain sight for the walk up)
  const STAIRS = !!SITE.stairs && !!rides && !new URLSearchParams(location.search).has('nostairs');
  if (STAIRS) actors.show(YOU, false);
  actors.mark(YOU);
  camera.begin({ you: YOU, mode: 'play' });
  // (the overlay in the run's look: its tokens read off the frame's root once it is up, panels.js)
  let skinRoot = null;
  const fx = createFx({ city, skin: () => skinRoot });
  // THE WAYS IN, on the city (place.js WAYS, each ending at its entry of the arena)
  const ways = waysOn(SITE.ways, ARENA.entries, A.world);
  // THE FIGHT'S OWN CLIPS on the cast's walkers (clips/index.js: the city's walkers are built by now), and who plays
  // which of them when (anim.js)
  await actors.until(() => !!city.peds?.anim?.batch || !city.peds);
  const clipNames = installClips({ CLIPS: actors.CLIPS, mats: [city.peds?.anim?.mat, city.peds?.anim?.batch?.customDepthMaterial], THREE: city.THREE });
  // (anim-1: the bodies of the fight you steer are posed by hand, puppet/gunner.js: each gun held, raised, fired and
  // reloaded its own way, the hands on it, the shot from its barrel; the falls by what dropped them. `?guns=old`: the
  // clips they had before, to look at the two side by side. Nothing of the rules, the steering or the camera differs)
  const OLD_GUNS = new URLSearchParams(location.search).get('guns') === 'old'; // (join-2: the owner judged the hand-posed gun bodies from the clips on 2026-11-19: they are the page's default; `?guns=old` still shows the ones before)
  const anim = OLD_GUNS ? createAnimator({ actors, CLIPS: actors.CLIPS, fx, W }) : createGunners({ actors, fx, W, city });
  // (anim-2: the blood's mist is first drawn at the first hit; its program is built now, not then: gunmesh.js warmBlood)
  warmBlood(city);
  /** The actor of a sim id. */
  const aidOf = id => bodies.get(id)?.id ?? (id === 'you' ? YOU : id === 'earl' ? EARL : `fight:${id}`);

  /** Bodies of the fight: sim id → { id (the actor's), body (kit handle), run, down, last: [x, z] }. */
  const bodies = new Map();
  function bodyFor(p) {
    let B = bodies.get(p.id);
    if (B) return B;
    const id = p.side === 'you' ? YOU : p.side === 'ally' ? EARL : `fight:${p.id}`;
    // (one of them who walked in: the body on its way is theirs, at the entry this very tick)
    const C = coming.get(p.id);
    if (C) {
      C.arrived = true;
      if (C.id !== id) console.warn(`[fight] ${p.id} came in, not the one walking in for it (${C.id})`);
    }
    if (!actors.has(id)) {
      const [x, , z] = W(p.x, p.y);
      const look = p.side === 'ally' ? LOOKS.ally : LOOKS[p.kind](p.id);
      actors.add({ id, name: p.name, x, z, look });
      if (p.side === 'foe') stats.unwalked += 1;
    }
    actors.show?.(id, true);
    B = { id, body: kit.own(id), run: !!C?.run, down: false, px: p.x, py: p.y };
    bodies.set(p.id, B);
    return B;
  }
  /** Takes everyone of the last round off the stage: only ever under the fade to black (start). */
  function clearBodies() {
    // (anim-1: whoever stood for the last one-on-one)
    for (const style of Object.keys(RIVALS)) {
      const id = `fight:rival:${style}`;
      if (!actors.has(id)) continue;
      kit.owned?.get(id)?.release();
      actors.remove(id);
    }
    for (const [sid, B] of bodies) {
      kit.owned?.get(B.id)?.release();
      if (B.id !== YOU && actors.has(B.id)) actors.remove(B.id);
      bodies.delete(sid);
    }
    // (anim-1: and what the hand-posed bodies held: the guns, the cases on the ground)
    anim.clear?.();
    for (const C of coming.values()) {
      kit.owned?.get(C.id)?.release();
      if (actors.has(C.id) && !bodies.has(C.sid)) actors.remove(C.id);
    }
    coming.clear();
    stage.gore?.clear();
    fx.clear();
  }

  // ── the walk in ──────────────────────────────────────────────────────────────────────────────────────────────
  // THEY WALK IN, NOBODY IS PUT DOWN: each of a level's people has a way in (ways.js pickWays: seeded by the fight's
  // seed, never its rolls), and starts along it as late as they can while the picture cannot see where they start
  // (ways.js startOn), at their kind's own pace, to stand at their entry on the tick the rules bring them in. Then the
  // rules have them. A round that ends before some of them got there sends those back the way they came.
  /** sim id → { sid, id (the actor's), kind, t, path, len, v, started, arrived, body, back } */
  const coming = new Map();
  const stats = { started: 0, late: 0, unwalked: 0, pre: [] };
  /** Is a body standing at (x, z) in the picture now, with room to spare (the camera eases after you)? */
  const seenNow = (x, z) => watch.seen(x, z, actors.groundAt(x, z), 0.8);
  function planComing(F) {
    coming.clear();
    for (const P of pickWays(F.waves, ways, F.seed)) {
      coming.set(P.id, { sid: P.id, id: `fight:${P.id}`, kind: P.kind, t: P.t, from: P.from, path: P.path, len: wayLength(P.path), v: FOES[P.kind].speed, started: false, arrived: false, body: null, back: false });
    }
  }
  /** How long the round must wait, from now, for its first people to walk in from out of the picture (s). */
  function leadNow() {
    let L = 0;
    for (const C of coming.values()) {
      if (C.t > 8) continue;
      // (how far back from the entry the picture sees along the way now)
      let b = 0;
      for (let q = 0; q <= C.len; q += 0.5) if (seenNow(...pointBack(C.path, q))) b = q + 0.5;
      L = Math.max(L, (b + AHEAD + 0.5) / C.v - C.t);
    }
    return Math.min(PRE_MAX, Math.max(0, L));
  }
  /** The walkers on their way in, at the fight's clock T (before the rules start: T < 0). */
  function walkIn(T, dt) {
    for (const C of coming.values()) {
      if (C.arrived) continue;
      const left = C.t - T;
      if (!C.started) {
        if (C.back) continue;
        const r = startOn(C.path, left, C.v, seenNow, { ahead: AHEAD });
        if (!r) continue;
        const [x, z, dx, dz] = pointBack(C.path, r.s);
        if (!actors.has(C.id)) actors.add({ id: C.id, name: FOES[C.kind].name, x, z, ry: Math.atan2(dx, dz), look: LOOKS[C.kind](C.sid) });
        actors.show?.(C.id, true);
        Object.assign(C, { started: true, v: r.v, s: r.s, body: kit.own(C.id), run: false });
        stats.started += 1;
        if (r.late || r.v > FOES[C.kind].speed * 1.05) stats.late += 1;
      }
      // (sent back: the way out again, at the same pace, and off the stage once the picture has lost them)
      if (C.back) {
        // (at their kind's own pace: one who set off late was hurrying in faster than that, and went back out at
        // that hurry, metres in a picture)
        const vb = Math.min(C.v, FOES[C.kind].speed);
        C.s = Math.min(C.len, C.s + vb * dt);
        const [x, z, dx, dz] = pointBack(C.path, C.s);
        C.body.put(x, actors.groundAt(x, z), z, Math.atan2(-dx, -dz), C.s < C.len ? vb : 0);
        if (C.s >= C.len - 0.01 || (C.s > 2 && !seenNow(x, z))) {
          kit.owned?.get(C.id)?.release();
          if (actors.has(C.id)) actors.remove(C.id);
          coming.delete(C.sid);
        }
        continue;
      }
      C.s = Math.max(0, C.v * left);
      const [x, z, dx, dz] = pointBack(C.path, C.s);
      const v = left > 0 ? C.v : 0;
      C.body.put(x, actors.groundAt(x, z), z, Math.atan2(dx, dz), v);
      if (v >= RUN_V && !C.run) {
        C.run = true;
        actors.play(C.id, 'run_getaway', { loop: true }).catch(() => {});
      } else if (v < RUN_V - 0.4 && C.run) {
        C.run = false;
        if (actors.clipOf(C.id)?.name === 'run_getaway') actors.stop(C.id);
      }
    }
  }
  /** The round is over: whoever is still on the way in turns round and goes back out of the picture. */
  function sendBack() {
    for (const C of coming.values()) {
      if (C.arrived) continue;
      if (!C.started) {
        coming.delete(C.sid);
        continue;
      }
      C.back = true;
    }
  }

  // ── the keys ─────────────────────────────────────────────────────────────────────────────────────────────────
  const held = new Set();
  const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  /** The keys held, as a move in the arena's frame: up the picture is away from the camera, whatever its bearing. */
  function moveNow() {
    let [r, d] = [0, 0];
    for (const k of held) if (MOVE[k]) [r, d] = [r + MOVE[k][0], d + MOVE[k][1]];
    const n = Math.hypot(r, d);
    if (!n) return { x: 0, y: 0 };
    [r, d] = [r / n, d / n];
    const az = ((camera.state().angle?.bearing ?? 90) * Math.PI) / 180;
    // (on the ground: down the picture is toward the camera, right is its right)
    const [wx, wz] = [r * Math.cos(az) + d * Math.sin(az), -r * Math.sin(az) + d * Math.cos(az)];
    return { x: wx * A.X[0] + wz * A.X[1], y: wx * A.Y[0] + wz * A.Y[1] };
  }
  // THE KEYS, the run's way (join-1). In a round: WASD and the arrows move you, nothing else does anything but I (the
  // interface's size) and Esc (a try-out stop: ask to go back). Choosing: 1 to 5 a loadout, ← → along them, ↑ ↓ how
  // hard, Enter fights, B build your own, J the results, F the dock, I the size, Esc one thing closed at a time. No run
  // key does anything else here (the run's own listener stands aside while a try-out is up: demo/run/trip.js)
  const round = () => phase === 'fight' || phase === 'arrive';
  function onKeyDown(e) {
    if (dead) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName ?? '')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // (ESC IS THE PAGE'S, never the browser's: Chrome's own Esc stops a page still loading, and that froze the picture)
    if (e.code === 'Escape') e.preventDefault();
    if (MOVE[e.code] && (round() || !e.code.startsWith('Arrow'))) {
      if (ui.asking) return;
      held.add(e.code);
      e.preventDefault();
      return;
    }
    if (e.repeat) return;
    if (e.code === 'KeyI') {
      e.preventDefault();
      ui.cycleSize();
      return;
    }
    // (asked whether to leave the round: Esc goes, Enter stays)
    if (ui.asking) {
      e.preventDefault();
      if (e.code === 'Escape') act.back(true);
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') act.stay();
      return;
    }
    if (round()) {
      if (e.code === 'Escape') {
        if (tryout) act.back();
        else ui.toast(`Walk onto the ${SITE.exit?.mark ?? 'way out'} to leave the round`);
      }
      return;
    }
    // (a one-on-one playing: Space or Enter skips it, as in the run; a raid the same)
    if (phase === 'duel' || phase === 'raid') {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        if (phase === 'raid') raidUi?.skip();
        else duelUi?.skip();
      }
      return;
    }
    if (phase !== 'pick' && phase !== 'over') return;
    // (the build list open: ↑ ↓ along it, Enter takes or drops)
    if (ui.buildOpen && ui.buildKey(e.code)) {
      e.preventDefault();
      return;
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      start();
    } else if (/^Digit[1-5]$/.test(e.code) || /^Numpad[1-5]$/.test(e.code)) {
      e.preventDefault();
      const id = PRESET_KEYS[Number(e.code.slice(-1)) - 1];
      if (id) act.preset(id);
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
      act.preset(stepPreset(pick, e.code === 'ArrowRight' ? 1 : -1));
    } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      e.preventDefault();
      act.level(stepLevel(pick.level, e.code === 'ArrowUp' ? 1 : -1));
    } else if (e.code === 'KeyB') {
      e.preventDefault();
      ui.toggleBuild();
    } else if (e.code === 'KeyJ') {
      e.preventDefault();
      ui.toggleResults();
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      ui.toggleDock();
    } else if (e.code === 'Escape') {
      // ONE THING AT A TIME: the build list, the result card (on the test page), then back to the run (a try-out stop)
      if (ui.buildOpen) ui.toggleBuild(false);
      else if (tryout) act.back();
      else if (ui.cardUp) ui.putAway();
    }
  }
  const onKeyUp = e => held.delete(e.code);
  const onBlur = () => held.clear();
  addEventListener('keydown', onKeyDown, true);
  addEventListener('keyup', onKeyUp, true);
  addEventListener('blur', onBlur);
  offs.push(() => removeEventListener('keydown', onKeyDown, true), () => removeEventListener('keyup', onKeyUp, true), () => removeEventListener('blur', onBlur));

  // ── the fight ────────────────────────────────────────────────────────────────────────────────────────────────
  let F = null;
  let seed = seed0;
  let phase = 'pick';
  let acc = 0;
  let seen = 0;
  let first = true;
  // (`earl`: how Cousin Earl is told to fight when he comes, fight-3: 'side' his old way, as the loadouts have him)
  const pick = { weapon: 'blade', gear: [], ally: false, earl: 'side', level: 'real' };
  // (this browser's memory of how each loadout did at this place, so the table is still there on the next visit and
  // after a reload: the fight's own key, never the run's save; the page works without it)
  const KEPT = `hk2.fight.results.${SITE.id}`;
  const results = (() => {
    try {
      const o = JSON.parse(localStorage.getItem(KEPT) ?? 'null');
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  })();
  const frames = [];
  let lastFrame = 0;

  /** The fight's clock before the rules start (the walk in of the first of them), or null. */
  let pre = null;
  async function start() {
    if (phase === 'arrive' || dead) return;
    phase = 'arrive';
    held.clear();
    ui.begin();
    const build = { weapon: pick.weapon, gear: [...pick.gear], ally: pick.ally, ...(pick.ally && pick.earl !== 'side' ? { earl: pick.earl } : {}) };
    const stairs = first && STAIRS;
    // A NEW ROUND BEHIND THE STAGE'S OWN FADE TO BLACK: the last round's people (down where they fell, or standing)
    // are taken off, you are put back at the stairs, Cousin Earl beside you, with nobody watching. The first round
    // comes up the stairs instead, and needs no cut
    const fade = stage.travel?.fade ?? null;
    const cut = !stairs && fade && (bodies.size > 0 || coming.size > 0 || build.ally || actors.get(YOU).w.hide || !first || Object.keys(RIVALS).some(k => actors.has(`fight:rival:${k}`)));
    if (cut) await fade.out();
    // (taken off meanwhile, a try-out stop gone back to the run: nothing more, and the black given back)
    if (dead) {
      if (cut) fade.in();
      return;
    }
    clearBodies();
    rides?.cancel?.(YOU);
    actors.stop(YOU);
    // (raidfight-1: back from a raid at the trailer park, the site's own zone again, under this black)
    if (zoneMoved && siteZone) {
      zoneMoved = false;
      try {
        await stage.enterZone(siteZone, stage.map.viewOf?.(siteZone) ?? null);
      } catch (err) {
        console.warn('[fight] the site did not load again:', err);
      }
    }
    F = createFight({ build, level: pick.level, seed, arena: RULES_ARENA });
    seed += 1;
    // (the frame says this round's level from now: it was painted while the last round's fight was still up)
    ui.paint();
    acc = 0;
    seen = 0;
    frames.length = 0;
    // (the last round's places are not this round's: a person's first tick is eased from where they are)
    prev.clear();
    slides.clear();
    anim.begin();
    planComing(F);
    const ally = F.people.find(p => p.side === 'ally');
    // THE FIRST TIME, UP THE STAIRS (the city's own flight: rides/subway.js), Earl right behind you
    if (stairs) {
      first = false;
      const at = A.world(...ARENA.start);
      const ups = [rides.arrive(YOU, { mode: 'subway', at, station: SITE.stairs.station, stairs: true })];
      if (ally) {
        if (!actors.has(EARL)) actors.add({ id: EARL, name: ally.name, x: at[0], z: at[1], look: LOOKS.ally });
        actors.show(EARL, false);
        ups.push(rides.arrive(EARL, { mode: 'subway', at: A.world(ally.x, ally.y), station: SITE.stairs.station, stairs: true }));
      }
      try {
        await Promise.race([Promise.all(ups), actors.seconds(24)]);
      } catch (err) {
        console.warn('[fight] the walk up the stairs did not play:', err);
      }
      rides.cancel?.(YOU);
      if (ally) rides.cancel?.(EARL);
      if (dead) return;
    }
    first = false;
    actors.show?.(YOU, true);
    actors.place(YOU, ...A.world(...ARENA.start), Math.atan2(A.Y[0], A.Y[1]));
    for (const p of F.people) {
      const B = bodyFor(p);
      put(B, p, p.x, p.y, 0);
      B.body.snapYaw?.();
    }
    camera.focus(YOU);
    camera.arrived();
    if (cut) {
      watch.cut();
      fade.in();
      await actors.seconds(0.1);
      if (dead) return;
    }
    // THEY WALK IN: the rules wait, after you are up, for as long as the first of them need to walk in from out of
    // the picture (none at all when their ways are out of it already). The rules' own clock and pacing are as they were
    pre = { T: -leadNow() };
    stats.pre.push(+(-pre.T).toFixed(2));
    lastFrame = performance.now();
  }

  /** Where a body is drawn: the sim's place eased between two ticks. */
  function put(B, p, x, y, v) {
    const [wx, wy, wz] = W(x, y);
    // (how they face: anim.js's, standing to whoever they fight, walking the way they walk; else the rules')
    const face = B.down ? p.face : anim.faceOf(p) ?? p.face;
    const f = [Math.cos(face), Math.sin(face)];
    const yaw = Math.atan2(f[0] * A.X[0] + f[1] * A.Y[0], f[0] * A.X[1] + f[1] * A.Y[1]);
    B.body.put(wx, wy, wz, yaw, B.down ? 0 : v);
  }

  // (for the tools' pictures: the fight is held still `after` fight seconds past the first event that matches)
  let hold = null;
  /** What a tick's events look like on the stage. */
  function play(e) {
    if (hold && hold.at === null && Object.entries(hold.match).every(([k, v]) => e[k] === v)) hold.at = F.t + hold.after;
    const P = id => F.people.find(q => q.id === id);
    const B = id => bodies.get(id);
    if (e.type === 'arrive') bodyFor(P(e.id));
    else if (e.type === 'shot') {
      // (the kick, the flash at the muzzle, the tracer and the puff: anim.js, on this tick)
      anim.event(e, F, aidOf);
    } else if (e.type === 'hit') {
      const q = P(e.id);
      // (thrown back by the Doorman's shell, fight-3: a skid of dust from where they stood)
      const by = P(e.by);
      if (e.how === 'shot' && by?.gun && WEAPONS[by.gun].cone && prev.has(q.id)) {
        const [x0, y0] = prev.get(q.id);
        if (Math.hypot(q.x - x0, q.y - y0) > 0.25) {
          fx.skid(W(x0, y0, 0.05), W(q.x, q.y, 0.05));
          // (slid back over SLIDE s from where the picture had them, not a metre in one picture)
          const [sx, sy] = slideOf(q.id, F.t);
          slides.set(q.id, { ox: x0 + sx - q.x, oy: y0 + sy - q.y, t: F.t });
          prev.set(q.id, [q.x, q.y]);
        }
      }
      fx.pop(W(q.x, q.y, BAR_Y + 0.45), `-${e.dmg}`, q.side === 'you' ? 'you' : q.side === 'ally' ? 'ally' : 'them');
      if (e.bleed === 'hit') stage.gore?.hit(B(e.id)?.id, B(e.by)?.id);
      else stage.gore?.blow(B(e.id)?.id, B(e.by)?.id, 'punch');
      // (the stab vest took a share of it: a grey puff on the chest, said, and the hands to it: anim.js fight_vest)
      if (q.side === 'you' && q.cut > 0) fx.vest(W(q.x, q.y, 1.05), Math.round((e.dmg * q.cut) / (1 - q.cut)));
      // (reeling: fight_flinch, or fight_vest, anim.js)
      anim.event(e, F, aidOf);
    } else if (e.type === 'swing') {
      // (the blow: its wind-up started before this tick, anim.js; it lands now)
      anim.event(e, F, aidOf);
    } else if (e.type === 'down') {
      const q = P(e.id);
      const by = P(e.by);
      const bq = B(e.id);
      if (!bq) return;
      // (they go down away from whoever dropped them: facing them, on their back)
      q.face = Math.atan2(by.y - q.y, by.x - q.x);
      bq.down = true;
      bq.run = false;
      // (from where the picture last had them: a blow's throw back on this tick, the Doorman's a metre, is eased
      // in by the frames after it, not jumped)
      const [dx0, dy0] = prev.get(q.id) ?? [q.x, q.y];
      const [sx, sy] = slideOf(q.id, F.t);
      put(bq, q, dx0 + sx, dy0 + sy, 0);
      bq.body.snapYaw?.();
      // (the city's own fall: anim.js, fall_back → lie_hurt for you and Earl, death_collapse → lie_still for them)
      anim.event(e, F, aidOf);
      // (no DOWN over each of them, join-1: the falls say it and the meters count them; the moment was crowded with it
      // and the pickups. Earl's, said: he is on your side)
      if (q.side === 'ally') fx.pop(W(q.x, q.y, BAR_Y + 0.3), 'EARL IS DOWN', 'note');
    } else if (e.type === 'pickup') {
      const me = F.people[0];
      fx.pop(W(me.x, me.y, BAR_Y + 0.2), e.text, 'gain');
    } else if (e.type === 'reload' && e.id === 'you') {
      // (the ring at your feet says it)
    } else if (e.type === 'dry') {
      const me = F.people[0];
      fx.pop(W(me.x, me.y, BAR_Y + 0.2), 'out of rounds', 'note');
    }
  }

  async function finish() {
    phase = 'over';
    held.clear();
    sendBack();
    const R = report(F);
    const key = presetOf(F.build) ?? 'custom';
    (results[key] ??= {})[F.level] = { result: R.result, seconds: R.outcome.seconds, hp: R.outcome.hp, max: R.outcome.max, dropped: R.outcome.dropped, of: R.outcome.of };
    try {
      localStorage.setItem(KEPT, JSON.stringify(results));
    } catch {}
    last = R;
    for (const [sid, B] of bodies) {
      const p = F.people.find(q => q.id === sid);
      if (B.run) actors.stop(B.id);
      B.run = false;
      // (where it is drawn: the rules' place and what is left of a slide; put at the rules' place alone, a body
      // still sliding was moved at once as the round ended)
      if (p && !p.down) {
        const [sx, sy] = slideOf(p.id, F.t);
        put(B, p, p.x + sx, p.y + sy, 0);
      }
    }
    // (walked back onto the stairs: down them, the city's own flight; where there are none, off across the lot, the
    // camera with you)
    if (R.result === 'left') {
      const B = bodies.get('you');
      kit.owned?.get(YOU)?.release();
      if (B) bodies.delete('you');
      const me = actors.get(YOU);
      if (SITE.stairs && rides) rides.leave(YOU, { mode: 'subway', from: [me.x, me.z], toward: [me.x - 400, me.z], station: SITE.stairs.station, stairs: true }).catch(() => {});
      else {
        const [ox, oz] = A.world(ARENA.exit[0], ARENA.exit[1] - 8);
        actors.stepTo(YOU, ox, oz, { v: 1.6 }).catch(() => {});
      }
    }
    ui.over();
  }
  let last = null;

  // EVERY FRAME OF THE STAGE (its clock: paused with it, at its speed): the fight's ticks, then the bodies where the
  // ticks put them, eased between two ticks
  const prev = new Map();
  // THROWN BACK, SLID NOT JUMPED (fight-3): the Doorman throws them a metre in one tick, more than the picture may move
  // anyone at once (watch.js). The rules' place is theirs at once; the picture adds back what is left of the throw, over
  // SLIDE s: sim id → { ox, oy, t } (the throw, arena m, back toward where they stood; the fight's clock it came)
  const SLIDE = 0.22;
  /** (raidfight-3) A move this far (m) past a body's own step in one tick is slid, not eased over its tick. */
  const SHOVE = 0.15;
  const slides = new Map();
  const slideOf = (id, T) => {
    const S = slides.get(id);
    if (!S) return [0, 0];
    const u = Math.min(1, Math.max(0, (T - S.t) / SLIDE));
    if (u >= 1) {
      slides.delete(id);
      return [0, 0];
    }
    const f = 1 - u * u * (3 - 2 * u);
    return [S.ox * f, S.oy * f];
  };
  offs.push(actors.onFrame(dt => {
    if (!F || dead) return;
    // (the walk in of the first of them, before the rules start: the fight's clock below zero)
    if (phase === 'arrive' && pre) {
      pre.T += dt;
      walkIn(Math.min(0, pre.T), dt);
      if (pre.T >= 0) {
        pre = null;
        phase = 'fight';
        lastFrame = performance.now();
      }
      return;
    }
    if (phase === 'over') walkIn(F.t, dt);
    if (phase !== 'fight') return;
    acc += dt;
    walkIn(F.t + acc, dt);
    let n = 0;
    while (acc >= TICK && !F.over && n < 8) {
      for (const p of F.people) prev.set(p.id, [p.x, p.y]);
      step(F, moveNow());
      acc -= TICK;
      n += 1;
      // (the effects of this tick's events are timed from this tick, not from the last picture: fight-3, the shells'
      // spread is shorter than a few ticks)
      fx.now = F.t;
      for (; seen < F.events.length; seen++) play(F.events[seen]);
      // (raidfight-2: MOVED FURTHER THAN ITS OWN STEP, SLID NOT EASED OVER ONE TICK: every knock back, not only the
      // Doorman's (the Long-eye's half metre, the six-shot's, a blow's), was eased over one tick: 0.3 to 0.5 m in two
      // pictures. Now each slides over SLIDE s from where the picture had it, as the Doorman's always did; the rules'
      // places are theirs at once as before. Only a move SHOVE m past its own step: the small shoves of two bodies
      // walking into each other, every tick, are eased over their tick as before. (raidfight-3: at 0.05 m they were
      // slid too, and a slide begun again every tick never got anywhere: Cousin Earl, shoving at a heavy, was drawn
      // further and further behind where the rules had him, and put there at once when the round ended: 2.3 m)
      for (const p of F.people) {
        const was = prev.get(p.id);
        if (!was || p.down || slides.has(p.id) && slides.get(p.id).t === F.t) continue;
        if (Math.hypot(p.x - was[0], p.y - was[1]) > Math.hypot(p.vx, p.vy) * TICK + SHOVE) {
          const [sx, sy] = slideOf(p.id, F.t);
          slides.set(p.id, { ox: was[0] + sx - p.x, oy: was[1] + sy - p.y, t: F.t });
          prev.set(p.id, [p.x, p.y]);
        }
      }
      if (hold?.at !== null && hold?.at !== undefined && F.t >= hold.at && !hold.held) {
        hold.held = true;
        stage.setSpeed(0);
        break;
      }
    }
    if (F.over) {
      finish();
      return;
    }
    // (the blows of the next few ticks, with the keys as they are: anim.js starts their wind-ups in time)
    if (n) anim.predict(F, moveNow());
    const a = Math.min(1, acc / TICK);
    // (anim-1: where everybody is drawn this frame; the hand-posed bodies then hold them off one another, so nobody
    // stands in anybody: gunner.js apart. The old bodies have no such thing and are drawn where the rules have them)
    const at = new Map();
    for (const p of F.people) {
      const [x0, y0] = prev.get(p.id) ?? [p.x, p.y];
      const [sx, sy] = slideOf(p.id, F.t + acc);
      at.set(p.id, [x0 + (p.x - x0) * a + sx, y0 + (p.y - y0) * a + sy]);
    }
    const heldOff = anim.apart?.(F, at, dt) ?? null;
    for (const p of F.people) {
      const B = bodies.get(p.id) ?? bodyFor(p);
      const v = p.down ? 0 : Math.hypot(p.vx, p.vy);
      const q = at.get(p.id);
      put(B, p, q[0], q[1], heldOff?.has(p.id) ? Math.min(v, heldOff.get(p.id)) : anim.paceOf?.(p, v) ?? v);
    }
    // (everyone's clip, look and facing for this frame: the gun held or raised, a blow winding up, the run, the walk)
    anim.frame(F, F.t + acc, dt, aidOf);
    // (the cover goes see-through where it stands between the camera and anyone of the fight)
    cover.fade(F.people.map(p => bodies.get(p.id)).filter(B => B && actors.has(B.id)).map(B => {
      const Q = actors.get(B.id);
      return [Q.x, Q.y + 1.1, Q.z];
    }), dt);
    // (for the tools' pictures: held still mid wind-up, `wind` s before a blow lands)
    if (hold?.wind !== undefined && !hold.held) {
      const w = anim.windSoon(F.t + acc, hold.wind, hold.who);
      if (w) {
        hold.held = true;
        hold.blow = w;
        stage.setSpeed(0);
      }
    }
  }));

  // EVERY PICTURE (after the city has drawn it, so the overlay sits on the same camera): the overlay
  function draw() {
    if (dead) return;
    requestAnimationFrame(draw);
    const t = performance.now();
    if (phase === 'fight') {
      if (lastFrame) frames.push(t - lastFrame);
      if (frames.length > 20000) frames.shift();
    }
    lastFrame = t;
    // THE FRAME CHECK, on the picture just drawn (from the first round on: the page's own loading is before it)
    if (F) watch.step(phase === 'fight' ? +(F.t + acc).toFixed(2) : phase === 'arrive' && pre ? +pre.T.toFixed(2) : null);
    if (!F || phase === 'pick' || (phase === 'arrive' && !pre)) {
      fx.now = F?.t ?? 0;
      fx.draw(phase === 'pick' || phase === 'arrive' ? { outline: outline(), exit: exitMark() } : null);
      ui.frame();
      return;
    }
    // (the fight's clock while it is on; after it, the effects still in the air run out on the wall's)
    if (phase === 'fight') fx.now = F.t + acc;
    else if (phase === 'arrive') fx.now = 0;
    else if (stage.actors.speed > 0) fx.now += Math.min(0.1, (t - (draw.t ?? t)) / 1000);
    draw.t = t;
    const people = [];
    // (whoever is walking in: their bar too, full, so a newcomer reads as one of them before they reach the line)
    for (const C of coming.values()) {
      if (!C.started || C.arrived || C.back || !actors.has(C.id)) continue;
      const Q = actors.get(C.id);
      const K = FOES[C.kind];
      people.push({ who: C.kind === 'boss' ? 'boss' : 'foe', p: [Q.x, Q.y, Q.z], head: Q.y + BAR_Y, frac: 1, label: K.name, hp: K.hp, down: false });
    }
    for (const p of F.people) {
      const B = bodies.get(p.id);
      if (!B || !actors.has(B.id)) continue;
      const Q = actors.get(B.id);
      people.push({ who: p.kind === 'boss' ? 'boss' : p.side, p: [Q.x, Q.y, Q.z], head: Q.y + BAR_Y, frac: p.hp / p.max, label: p.side === 'you' ? 'you' : p.side === 'ally' ? (F.build.earl ? `Earl · ${EARL_WAYS[F.build.earl].name}` : 'Earl') : FOES[p.kind].name, hp: p.hp, down: p.down || (phase === 'over' && p.side === 'you' && F.over.result === 'left') });
    }
    const me = F.people[0];
    const Wn = WEAPONS[me.gun ?? me.arm];
    const MQ = actors.get(YOU);
    // (Cousin Earl told a way, fight-3: whom he goes for and the spot he holds, while the round is on; his way is
    // said on his name plate)
    const E = F.people.find(p => p.side === 'ally');
    const way = F.build.earl;
    const EB = E && bodies.get(E.id);
    let earl = null;
    if (phase === 'fight' && E && !E.down && way && EB && actors.has(EB.id)) {
      const Q = actors.get(EB.id);
      const T = E.target ? F.people.find(p => p.id === E.target && !p.down) : null;
      const TB = T && bodies.get(T.id);
      const TQ = TB && actors.has(TB.id) ? actors.get(TB.id) : null;
      // (the spot he holds: his goal when it is not the one he goes for, out in front and one at a time)
      const holds = (way === 'front' || way === 'block') && E.goal && T && Math.hypot(E.goal[0] - T.x, E.goal[1] - T.y) > 0.6;
      earl = { at: [Q.x, Q.y + 0.05, Q.z], to: TQ ? [TQ.x, TQ.y + 0.05, TQ.z] : null, spot: holds ? W(E.goal[0], E.goal[1], 0.05) : null };
    }
    fx.draw({
      earl,
      outline: outline(),
      // (its words for leaving only while a round is on: after it, the plain mark, and nothing over the bodies)
      exit: exitMark(phase === 'fight' && Math.hypot(me.x - ARENA.exit[0], me.y - ARENA.exit[1]) < ARENA.exitR + 2.5),
      people,
      loot: F.loot.map(L => ({ kind: L.kind, p: W(L.x, L.y) })),
      me: phase === 'fight' && !me.down ? { p: [MQ.x, MQ.y, MQ.z], ammo: me.gun ? { gun: true, mag: me.mag, max: Wn.mag, rounds: me.rounds, reload: me.reload, reloadOf: me.reloadOf || 1, dry: me.arm !== me.gun && me.mag <= 0 } : null } : null,
    });
    ui.frame();
  }
  const outline = () => [W(0, 0, 0.05), W(ARENA.w, 0, 0.05), W(ARENA.w, ARENA.h, 0.05), W(0, ARENA.h, 0.05)];
  const exitMark = (near = false) => ({ p: W(...ARENA.exit, 0.05), near, mark: SITE.exit.mark, nearText: SITE.exit.near });
  requestAnimationFrame(draw);

  // ── THE FRAME: the run's (panels.js; what it shows, dock.js) ──────────────────────────────────────────────────
  /** What the frame reads: the phase, the pick, the results, the round and its report. */
  const now = () => ({ phase, pick, results, F, R: last, coming: phase === 'arrive' && !!pre, duel: duelPick, raid: raidPick });

  // ── ONE-ON-ONE, TO LOOK AT (anim-1): the run's own fight, played by itself on the lot ───────────────────────────
  const DUEL = RUN_CONFIG.duel;
  const duelPick = { arm: 'hands', foe: 'brawler' };
  const rivalId = style => `fight:rival:${style}`;
  let duelUi = null;
  let duelSeed = seed0;
  async function watchDuel() {
    if (round() || phase === 'duel' || dead) return;
    const { arm, foe } = duelPick;
    const Y = DUEL.you[arm];
    const inputs = { you: { weapon: Y.weapon, hp: 85, max: DUEL.hp.max, hits: Y.hits }, foe: rivalFoe(foe, { id: 'them', name: RIVALS[foe].name, hp: 58 }), cap: DUEL.cap, hit: DUEL.hit / 100, brawl: { ...DUEL.brawl }, arena: { ...DUEL.arena } };
    duelSeed += 1;
    const seedNow = duelSeed * 7919 + 13;
    const R = runDuel(inputs, seedNow);
    const D = { inputs, seed: seedNow, result: R.over.result, seconds: R.over.t, you: { why: [Y.label, 'to look at: no rule changed'] }, them: { why: [RIVALS[foe].says] } };
    phase = 'duel';
    held.clear();
    ui.toggleBuild(false);
    if (ui.cardUp) ui.putAway();
    ui.paint();
    // (the last round's people off, the two put on the lot, behind the stage's own black)
    const fade = stage.travel?.fade ?? null;
    if (fade) await fade.out();
    if (dead) return;
    clearBodies();
    rides?.cancel?.(YOU);
    actors.stop(YOU);
    const [yx, , yz] = W(ARENA.w / 2 - 1.2, ARENA.h / 2);
    const [tx, , tz] = W(ARENA.w / 2 + 1.2, ARENA.h / 2);
    actors.show?.(YOU, true);
    actors.place(YOU, yx, yz, Math.atan2(tx - yx, tz - yz));
    const them = rivalId(foe);
    if (!actors.has(them)) actors.add({ id: them, name: RIVALS[foe].name, x: tx, z: tz, ry: Math.atan2(yx - tx, yz - tz), look: (foe === 'bigman' ? LOOKS.bigman : foe === 'quick' || foe === 'knife' ? LOOKS.runner : LOOKS.heavy)(`rival:${foe}`) });
    else actors.place(them, tx, tz, Math.atan2(yx - tx, yz - tz));
    actors.show?.(them, true);
    camera.focus(YOU);
    camera.arrived();
    watch.cut();
    if (fade) fade.in();
    first = false;
    await actors.seconds(0.4);
    duelUi ??= createDuel({ stage, city, root: ui.root });
    let rec = null;
    try {
      rec = await duelUi.play({ duel: D, you: YOU, them, youName: 'You', themName: RIVALS[foe].name[0].toUpperCase() + RIVALS[foe].name.slice(1) });
    } catch (err) {
      console.warn('[fight] the one-on-one did not play:', err);
    }
    if (dead) return;
    phase = 'pick';
    ui.paint();
    ui.toast(rec ? `${Y.label} against ${RIVALS[foe].name}: you ${rec.seen === 'won' ? 'won' : 'lost'} in ${D.seconds.toFixed(1)} s (B to pick another)` : 'The one-on-one did not play');
    return rec;
  }
  // ── THE RAID ON YOUR HOME, TO LOOK AT (raidfight-1): the run's own raid fight, played by itself at the trailer's
  // door (demo/run/raidfight.js, the scene the run calls): who comes, how many, what is in your hands, Earl or not.
  // `?raid=<crew>:<hold>:<size>:<earl 0|1>:<seed>` picks one (the film tool's way in; the seed: that very fight)
  const raidPick = (() => {
    const [crew, hold, size, earl, s] = (new URLSearchParams(location.search).get('raid') ?? '').split(':');
    // (raidfight-2: AT NIGHT by default, as the game always has it, under the very light it uses; `&night=0`, or Day
    // in the rows, the same raid by day to compare)
    const nightQ = new URLSearchParams(location.search).get('night');
    return { crew: RAID_CREWS.includes(crew) ? crew : 'rush', hold: RAID_HOLDS.some(([k]) => k === hold) ? hold : 'doorman', size: /^[012]$/.test(size ?? '') ? Number(size) : 1, earl: earl === '1', seed: s && Number.isFinite(Number(s)) ? Number(s) : null, night: nightQ !== '0' };
  })();
  let raidUi = null;
  let raidSeed = seed0;
  /** (raidfight-1) the trailer park's zone was loaded for a raid: the site's own is put back before the next round */
  let zoneMoved = false;
  async function watchRaid() {
    if (round() || phase === 'duel' || phase === 'raid' || dead) return;
    const P = raidPick;
    raidSeed += 1;
    const D = raidCase({ crew: P.crew, size: P.size, hold: P.hold, earl: P.earl, seed: P.seed ?? raidSeed * 7919 + 29 });
    phase = 'raid';
    held.clear();
    ui.toggleBuild(false);
    if (ui.cardUp) ui.putAway();
    ui.paint();
    // (the last round's people off; you at your trailer's door (the run's own pad, a1: the stage's map), behind the
    // stage's black, which the raid takes over and lifts on them coming)
    const fade = stage.travel?.fade ?? null;
    if (fade) await fade.out();
    if (dead) return;
    clearBodies();
    rides?.cancel?.(YOU);
    actors.stop(YOU);
    // (the trailer park's zone, under the black, when the page is at a site of its own (the dead mall): the trailers
    // are built only in it. The next round puts the site's own back: start)
    const parkZone = stage.map?.zoneOf?.('projects') ?? null;
    if (parkZone && stage.loader?.zone && stage.loader.zone !== parkZone && stage.enterZone) {
      try {
        await stage.enterZone(parkZone, stage.map.viewOf?.(parkZone) ?? null);
        zoneMoved = true;
      } catch (err) {
        console.warn('[fight] the trailer park did not load:', err);
      }
      if (dead) return;
    }
    const spots = stage.map?.BLOCKS?.projects?.spots ?? {};
    const [st0, dr0] = [spots['home:a1:step'], spots['home:a1:door']];
    actors.show?.(YOU, true);
    if (st0 && dr0) actors.place(YOU, st0[0], st0[1], Math.atan2(st0[0] - dr0[0], st0[1] - dr0[1]));
    camera.focus(YOU);
    camera.arrived();
    watch.cut();
    first = false;
    // (night or day, under the black: the stage's own clock, the light it brings with it; the page's day after)
    stage.setClock?.(P.night ? { day: 5, hour: 21.5 } : { day: 5, hour: 13 });
    if (!raidUi) {
      raidUi = createRaidFight({ stage, city, root: ui.root });
      // (raidfight-5: the page taken off with a raid up: the scene ends at once and puts the stage's light back)
      offs.push(() => raidUi.leave());
    }
    let rec = null;
    try {
      rec = await raidUi.play({ raid: D, you: YOU, pad: 'a1' });
    } catch (err) {
      console.warn('[fight] the raid did not play:', err);
      if (fade?.dark) fade.in();
    }
    if (dead) return;
    // (the page's own day again; a night raid's light is given back by the scene)
    if (P.night) {
      const fade2 = stage.travel?.fade ?? null;
      if (fade2 && !fade2.dark) await fade2.out();
      stage.setClock?.({ day: 5, hour: 13 });
      if (fade2) fade2.in();
    }
    phase = 'pick';
    ui.paint();
    ui.toast(rec ? `The raid: ${D.them.text}, ${D.you.label} in your hands${P.earl ? ', Earl beside you' : ''}: you ${rec.seen === 'won' ? 'held the door' : 'went down'} in ${D.seconds.toFixed(1)} s (B to pick another)` : 'The raid did not play');
    return rec;
  }
  function usePreset(id) {
    const P = PRESETS[id];
    Object.assign(pick, { weapon: P.weapon, gear: [...P.gear], ally: P.ally, earl: 'side' });
    ui.paint();
  }
  /** What the frame's parts ask for (a key or a click). Nothing while a round is on but Back. */
  const act = {
    preset(id) {
      if (round()) return;
      if (ui.cardUp) ui.putAway();
      usePreset(id);
    },
    level(id) {
      if (round() || !levelOf(id) || !LEVEL_KEYS.includes(id)) return;
      if (ui.cardUp) ui.putAway();
      pick.level = id;
      ui.paint();
    },
    weapon(id) {
      if (round()) return;
      pick.weapon = id;
      ui.paint();
    },
    gear(id) {
      if (round()) return;
      pick.gear = pick.gear.includes(id) ? pick.gear.filter(g => g !== id) : [...pick.gear, id];
      ui.paint();
    },
    ally() {
      if (round()) return;
      pick.ally = !pick.ally;
      ui.paint();
    },
    /** How Earl fights (fight-3): one of his three ways; the one he is told already, back to his old way. Brings him. */
    earl(way) {
      if (round() || !EARL_WAYS[way]) return;
      pick.earl = pick.earl === way ? 'side' : way;
      pick.ally = true;
      ui.paint();
    },
    fight: () => start(),
    /** (anim-1) One-on-one, to look at: what you fight with, who you face, and the watching of it. */
    duelArm(id) {
      if (round() || phase === 'duel' || !DUEL.you[id]) return;
      duelPick.arm = id;
      ui.paint();
    },
    duelFoe(id) {
      if (round() || phase === 'duel' || !RIVALS[id]) return;
      duelPick.foe = id;
      ui.paint();
    },
    duel: () => watchDuel(),
    /** (raidfight-1) The raid to look at: who comes, how many, what is in your hands, Earl; and the watching of it. */
    raidCrew(id) {
      if (round() || phase === 'raid' || !RAID_CREWS.includes(id)) return;
      raidPick.crew = id;
      raidPick.seed = null;
      ui.paint();
    },
    raidSize(k) {
      if (round() || phase === 'raid') return;
      raidPick.size = k;
      raidPick.seed = null;
      ui.paint();
    },
    raidHold(id) {
      if (round() || phase === 'raid') return;
      raidPick.hold = id;
      raidPick.seed = null;
      ui.paint();
    },
    raidEarl() {
      if (round() || phase === 'raid') return;
      raidPick.earl = !raidPick.earl;
      raidPick.seed = null;
      ui.paint();
    },
    raidNight(on) {
      if (round() || phase === 'raid') return;
      raidPick.night = !!on;
      ui.paint();
    },
    raid: () => watchRaid(),
    /** BACK TO THE RUN (a try-out stop only). Mid-round it asks first, in the page; `sure`: asked and answered. */
    back(sure = false) {
      if (!tryout) return;
      if (round() && !sure) {
        held.clear();
        asked = stage.actors.speed;
        stage.setSpeed(0);
        ui.ask(true);
        return;
      }
      if (ui.asking) ui.ask(false);
      tryout.onBack?.();
    },
    /** Asked whether to leave the round: stay, and it goes on. */
    stay() {
      ui.ask(false);
      stage.setSpeed(asked || 1);
    },
  };
  let asked = 0;
  const ui = createPanels({ host, site: SITE, tryout, now, act });
  skinRoot = ui.root;
  offs.push(() => ui.dispose());
  ui.paint();

  const api = {
    get phase() {
      return phase;
    },
    /** (anim-1) For the tools: a one-on-one to look at, picked and watched; the one playing, and every one played. */
    watchDuel: (arm, foe) => {
      if (arm) duelPick.arm = arm;
      if (foe) duelPick.foe = foe;
      return watchDuel();
    },
    get duel() {
      return { active: !!duelUi?.active, state: duelUi?.state ?? null, log: duelUi?.log.slice() ?? [], pick: { ...duelPick } };
    },
    /** (raidfight-1) For the tools: the raid to look at, picked and watched; the one playing, and every one played. */
    watchRaid: (o = {}) => {
      Object.assign(raidPick, o);
      return watchRaid();
    },
    get raid() {
      return { active: !!raidUi?.active, state: raidUi?.state ?? null, log: raidUi?.log.slice() ?? [], pick: { ...raidPick }, skipButton: !!raidUi?.skipButton };
    },
    get fight() {
      return F;
    },
    get last() {
      return last;
    },
    results,
    start,
    usePreset,
    pick: o => {
      Object.assign(pick, o);
      ui.paint();
    },
    /** The frame (panels.js): its parts, for the tools. */
    ui,
    act,
    site: SITE.id,
    /** Holds the fight and the stage still (for a picture), or lets them go (at `speed`). */
    pause(on, speed = 1) {
      stage.setSpeed(on ? 0 : speed);
    },
    /** For the tools: hold the fight still `after` s past the next event matching `match` ({ type, id, hit, ... }). */
    holdOn(match, after = 0) {
      hold = { match, after, at: null, held: false };
    },
    get held() {
      return !!hold?.held;
    },
    /** For the tools: hold the fight still when its clock reaches `t` (s). */
    holdAt(t) {
      hold = { match: { type: 'never' }, after: 0, at: t, held: false };
    },
    /** For the tools: the last event that matches, or null. */
    lastEvent(match) {
      const E = F?.events ?? [];
      for (let k = E.length - 1; k >= 0; k--) if (Object.entries(match).every(([key, v]) => E[k][key] === v)) return E[k];
      return null;
    },
    /** For the tools: hold the fight still mid wind-up, `lead` s before the next blow lands (anim.js). */
    holdOnWind(lead = 0.1, who = null) {
      hold = { match: { type: 'never' }, after: 0, at: null, held: false, wind: lead, who };
    },
    /** For the tools: the blow a wind-up hold stopped on ({ id, t: the tick it lands, to }), or null. */
    get heldBlow() {
      return hold?.blow ?? null;
    },
    /**
     * For the tools: the move a player backing away while firing would make now (src/fight/policies.mjs kite), as
     * the picture shows it: [right, down], for the keys.
     */
    driveMove() {
      if (!F || phase !== 'fight') return [0, 0];
      const m = kite(F);
      const [wx, wz] = [m.x * A.X[0] + m.y * A.Y[0], m.x * A.X[1] + m.y * A.Y[1]];
      const az = ((camera.state().angle?.bearing ?? 90) * Math.PI) / 180;
      return [wx * Math.cos(az) - wz * Math.sin(az), wx * Math.sin(az) + wz * Math.cos(az)];
    },
    /** The frame times of the last fight (ms between pictures): median, 95th, worst, count. */
    frameTimes() {
      const s = frames.slice().sort((a, b) => a - b);
      const q = f => (s.length ? +s[Math.min(s.length - 1, Math.floor(f * s.length))].toFixed(1) : null);
      return { median: q(0.5), p95: q(0.95), worst: s.length ? +s[s.length - 1].toFixed(1) : null, frames: s.length };
    },
    debug: () => ({ site: SITE.id, phase, t: F?.t ?? null, over: F?.over ?? null, events: F?.events.length ?? 0, solid, box: A.box, quiet: QUIET, cover: cover.list, posts: RULES_ARENA.posts, arena: { origin: A.world(0, 0), X: A.X, Y: A.Y, exit: A.world(...ARENA.exit) }, station: st, bodies: [...bodies.values()].map(B => B.id), frames: api.frameTimes() }),
    /** THE FRAME CHECK so far (watch.js): faults (anyone who came on, went off or was moved at once in the picture), and how much it watched. */
    frameCheck: () => ({ ...watch.report(), walkIn: { ...stats, pre: stats.pre.slice(-12) } }),
    /** The ways in of this place, on the city, and who is on their way now. */
    ways: () => ({ ways: ways.map(W => ({ entry: W.entry, from: W.from, path: W.path.map(p => p.map(v => +v.toFixed(2))) })), coming: [...coming.values()].map(C => ({ id: C.sid, kind: C.kind, t: C.t, from: C.from, started: C.started, arrived: C.arrived, s: C.s ?? null })) }),
    /** The fight's own clips (clips/index.js) and how the blows and shots of the last fight were timed (anim.js). */
    anim: () => ({ clips: clipNames, ...anim.stats }),
    /** For the tools: is a body standing at (x, z) in the picture now (the check's own test)? */
    seen: (x, z) => watch.seen(x, z, actors.groundAt(x, z)),
    /**
     * TAKES THE FIGHT OFF THE STAGE AND THE PAGE (a run's try-out stop, going back; demo/run/trip.js), under the
     * stage's black: its people, its cover, its overlay and frame, its keys and its frame hooks; the city's crowd it
     * kept off the lot shown again. What it changed for good: its clips in the cast's registry (installClips, harmless,
     * kept for the next visit) and the cover's footprint (only on the lot). The stage's zone, keep-out box and camera
     * are the caller's to put back.
     */
    dispose() {
      if (dead) return;
      dead = true;
      held.clear();
      for (const off of offs.splice(0)) {
        try {
          off();
        } catch (err) {
          console.warn('[fight] could not take something off:', err);
        }
      }
      clearBodies();
      rides?.cancel?.(YOU);
      kit.owned?.get(YOU)?.release();
      if (actors.has(YOU)) actors.remove(YOU);
      if (actors.has(EARL)) actors.remove(EARL);
      cover.remove();
      fx.remove();
      for (const w of quieted) w.hide = false;
      quieted.clear();
      if (hold?.held) hold = null;
    },
    get dead() {
      return dead;
    },
  };
  return api;
}
