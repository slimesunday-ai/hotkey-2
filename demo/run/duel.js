// THE RUN'S FIGHTS ON ITS STAGE (duel-1, RUN.md "Fights"): a debt or a lift gone wrong to somebody's face, or the
// regular at your door who swings, played out between the two people already in the picture, where the job's own scene
// left them. The fight is the rules' (src/run/rules.mjs fightOut: the event's `duel`, its inputs and its seed): the page
// steps the very same simulation a tick at a time (src/fight/duel.mjs startDuel, the brawl for both: nobody steers), so
// what is seen is what the rules decided, and a fight seen to end otherwise is a fault the page says (`mismatch`).
//
//   const duel = createDuel({ stage, city, root })
//   await duel.play({ duel, you, them, youName, themName })   → { result, seen, skipped, faults }
//                      (styles-1: `them` a list of actors for a fight with several, getting jumped: two at once, played
//                      on the spot where you stand; their bar is the two of them together)
//   duel.skip()        Space, Enter or the Skip button: the black, the bodies stood where they are, and the result
//   duel.active        a fight is on (the run's keys give Space and Enter to it)
//   duel.state         for the tools: the phase ('square' | 'fight' | 'down' | 'after'), the fight's clock, the blows
//   duel.log           every fight played so far: the rules' result, what was seen, skipped, the frame check's faults
//
// HOW IT PLAYS (anim-1). The rules' fight is seeded and nobody steers, so it is run to its end before the first frame
// and read as a SCRIPT (who throws what when, whether it lands, what it took, who goes down, who wins), and the fight
// seen is that script STAGED for the game's camera (demo/fight/puppet/: choreo.js stages it, moves.js is what every
// blow, cover, stagger, fall and getting up looks like, feet.js plants the feet). The rules' own places for the bodies
// are not drawn: they were made to decide the fight. What is the rules' is theirs still: the same simulation is
// stepped tick for tick beside the staged fight (the bars, the numbers off a hit, the stage's own blood, the end), and
// a fight that ends otherwise than the rules said is a fault the page says (`mismatch`).
// Square up: each walks to their mark on the nearest clear ground (side on to the camera, a blow travels across the
// picture), turns to the other, and the hands come up. The fight: the bodies are the stage's own people posed by hand
// every frame (puppet.js). The end: the loser goes down where the last blow leaves them and we stay on it; the winner
// stands over them; then, you beaten, they turn and walk off and you get up; you the winner, they get up, hurt, and
// back off. Nothing about the camera changes: it follows you as it does on any hour.
// THE FRAME CHECK (demo/fight/watch.js, frame.js) watches every picture while a fight is on: anyone who comes on, goes
// off or is moved at once in the picture is a fault, kept in the log for the tools (demo/tools/run-duel.mjs).
import { startDuel, step, brawl, TICK } from '../../src/fight/index.mjs';
import { createPuppets } from '../fight/puppet/puppet.js';
import { scriptOf, stageFight, stateAt } from '../fight/puppet/choreo.js';
import { createHeld } from '../fight/puppet/held.js';
import { createFx } from '../fight/fx.js';
import { installClips } from '../fight/clips/index.js';
import { createWatch } from '../fight/watch.js';
import { createKit } from '../stage/rides/kit.js';
import { h } from '../hud/dom.js';

/** The ground a fight needs round its middle (m): the brawl keeps both within 2.9 m of it (measured), and a body's room. */
const CLEAR_R = 3.0;
/** How far from where they stand the fight may move to find that ground (m). */
const SEEK = 5;
/** (styles-1) A fight with several: how far it may move to find ground clear of everybody else (m), and how clear. */
const SEEK_MANY = 16;
const CLEAR_OF = 3.6;
/** Squaring up: the walk to the marks (m/s), and the longest it may take (s). */
const WALK_V = 2.3;
const SQUARE_MAX = 6;
/** (styles-1) Two who jumped you run in to their marks (m/s). */
const RUN_V = 4.2;
/** (anim-1) Walking to a mark: how fast a body turns at most (rad/s) and how quickly it takes that turn up (rad/s²). */
const TURN_V = 2.5;
const TURN_A = 11;
/** (anim-1) Squared up, the hands coming up: seconds before the rules' clock starts. */
const SQUARE_PRE = 0.35;
/**
 * THE RUN-IN (the owner, 2026-11-18, of a debt fight: "the fight takes a long time to load before it happens and i
 * almost hit skip right away"): six seconds went by between a fight being called and its first blow, the two of them
 * turning on the spot, strolling four or five metres to clear ground, turning to each other and bringing their hands
 * up. Now they RUN there (m/s; faster when the ground is further, to be there in about a second; never
 * a stroll), turning as they go, and the fight is JOINED a third of a second before its first blow: whoever throws
 * it arrives already throwing it. `lead` s: how long before the first blow the staged fight takes the bodies.
 */
const RUN_IN = Object.freeze({ v: 4.8, most: 11, within: 1.0, acc: 20, dec: 13, hard: 28, turnV: 8, turnA: 60, lead: 0.3 });
/** How soon a fight must start and how soon it must give control back (s): the checks fail one that is slower. */
export const PACE = Object.freeze({ open: 2.5, close: 4 });
/**
 * The two ends of a fight as it was seen: `open` s from its being called to its first blow, `close` s from its last
 * blow to control handed back (null where it was skipped before that), and `slow`: what was over PACE, in words.
 */
function paceOf(T, skipped) {
  const open = T.first !== null ? +(T.first - T.called).toFixed(2) : null;
  const close = !skipped && T.last !== null && T.back !== null ? +(T.back - T.last).toFixed(2) : null;
  const slow = [];
  if (open !== null && open > PACE.open) slow.push(`the first blow came ${open} s after the fight was called (over ${PACE.open} s)`);
  if (close !== null && close > PACE.close) slow.push(`control came back ${close} s after the last blow (over ${PACE.close} s)`);
  return { open, close, slow };
}
/** The end: on the one down, nobody else moving much, this long (s) before the after. */
const DOWN_HOLD = 1.5;
/** Over a head: where a number pops (m). */
const POP_Y = 2.35;

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export function createDuel({ stage, city: city0 = null, root }) {
  const A = stage.actors;
  // (the city, once it is up: the page's own)
  let city = city0;
  const cityNow = () => (city ??= window.__demo?.city ?? window.__city);
  let kit = null;
  let puppets = null;
  let heldThings = null;
  let fx = null;
  let clips = false;
  let cur = null;
  const log = [];

  // ── THE BARS: two, with names, over the picture's top, each saying why it starts where it does ──────────────────
  const side = who => {
    const fill = h('i', { class: 'rn-duel-fill' });
    const hp = h('b', { class: 'rn-duel-hp u-sign' });
    const name = h('b', { class: 'rn-duel-name' });
    const why = h('span', { class: 'rn-duel-why' });
    const el = h('div', { class: `rn-duel-side is-${who}` }, h('div', { class: 'rn-duel-top' }, name, hp), h('span', { class: 'rn-duel-bar' }, fill), why);
    return { el, fill, hp, name, why };
  };
  const Y = side('you');
  const T = side('them');
  const skipBtn = h('button', { type: 'button', class: 'u-btn is-quiet rn-duel-skip', title: 'Skip the fight: the same result (Space or Enter)' }, 'Skip', h('kbd', { class: 'u-key' }, 'Space'));
  const head = h('span', { class: 'u-cap rn-duel-cap' }, 'A fight');
  const strip = h('section', { class: 'u-panel rn-duel', role: 'status', 'aria-label': 'The fight', hidden: true }, head, h('div', { class: 'rn-duel-sides' }, Y.el, h('span', { class: 'rn-duel-vs u-sign' }, 'vs'), T.el), skipBtn);
  root.append(strip);
  skipBtn.addEventListener('click', e => {
    e.preventDefault();
    cur?.skip();
  });
  function paintBars(F, D) {
    const me = F.people[0];
    // (sixes-1: Cousin Earl is on your side, not theirs: their bar is theirs alone)
    const them = F.people.filter(p => p.side === 'foe');
    const set = (S, p, max) => {
      S.fill.style.width = `${Math.max(0, (p.hp / max) * 100)}%`;
      S.hp.textContent = String(Math.max(0, p.hp));
      S.el.classList.toggle('is-low', p.hp / max < 0.3);
      S.el.classList.toggle('is-down', p.down);
    };
    set(Y, me, me.max);
    // (several: their health together, down only when all of them are)
    const all = them.length > 1 ? { hp: them.reduce((a, q) => a + Math.max(0, q.hp), 0), max: them.reduce((a, q) => a + q.max, 0), down: them.every(q => q.down) } : them[0];
    set(T, all, all.max);
    strip.dataset.over = F.over ? F.over.result : '';
  }

  /** The fight's own clips, once, on the cast's walkers (clips/index.js: safe to call again). */
  function installed() {
    cityNow();
    if (!clips) {
      installClips({ CLIPS: A.CLIPS, mats: [city.peds?.anim?.mat, city.peds?.anim?.batch?.customDepthMaterial], THREE: city.THREE });
      clips = true;
    }
  }
  /** And what a fight needs on the page besides: its bodies' kit, its overlay, the hand-posed bodies, what they hold. */
  function ensure() {
    installed();
    kit ??= stage.rides?.kit ?? createKit({ city, actors: A, CLIPS: A.CLIPS });
    fx ??= createFx({ city, skin: () => root });
    puppets ??= createPuppets({ actors: A, kit, city });
    heldThings ??= createHeld(city);
  }

  /**
   * (styles-1) A point out of the picture to come on at, toward (qx, qz) from (cx, cz) and on round, on known open
   * ground, 6 to 40 m off; else the farthest looked at.
   */
  function offPicture(cx, cz, qx, qz) {
    const a0 = Math.hypot(qx - cx, qz - cz) > 0.5 ? Math.atan2(qx - cx, qz - cz) : 0;
    let last = [cx, cz];
    for (const da of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
      for (let r = 6; r <= 40; r += 2) {
        const x = cx + Math.sin(a0 + da) * r;
        const z = cz + Math.cos(a0 + da) * r;
        if (!A.solidKnown(x, z) || A.solidAt(x, z)) continue;
        last = [x, z];
        if (!(A.inPicture?.(x, z) ?? true)) return [x, z];
      }
    }
    return last;
  }
  /**
   * (anim-1) THE NEAREST point out of the picture to a fight's ground, for somebody who comes on running: every way
   * round, the first open ground the picture does not show, and of those the nearest (a little dearer the further
   * round it is from where they are, `qx, qz`). offPicture above takes the first way that has one, which can be the
   * far end of the picture: eighteen metres to run before the first blow.
   */
  function edgeNear(cx, cz, qx, qz) {
    const a0 = Math.hypot(qx - cx, qz - cz) > 0.5 ? Math.atan2(qx - cx, qz - cz) : 0;
    let best = null;
    for (let k = 0; k < 16; k++) {
      const da = ((k % 2 ? -1 : 1) * Math.ceil(k / 2) * Math.PI) / 8;
      for (let r = 6; r <= 30; r += 1) {
        const x = cx + Math.sin(a0 + da) * r;
        const z = cz + Math.cos(a0 + da) * r;
        if (!A.solidKnown(x, z) || A.solidAt(x, z)) continue;
        if (A.inPicture?.(x, z) ?? true) continue;
        const cost = r + 0.6 * Math.abs(da);
        if (!best || cost < best.cost) best = { cost, at: [x, z] };
        break;
      }
    }
    return best?.at ?? offPicture(cx, cz, qx, qz);
  }
  /** Is this point open ground a fight can be on: known, not solid, nothing low, level with the middle? */
  // (and under the open sky: a stall's canopy over it hides whoever falls there from the camera, seen 2026-11-17. The
  // city's own collision world, straight up from over a head; each point once per search, `seen`)
  let seen = new Map();
  // (how far from the middle's height a point may be and still count as level)
  const level = 0.22;
  const roofed = (x, z, y) => {
    const ray = cityNow()?.cam?.world?.ray;
    return !!ray && !!ray({ x, y: y + 2.1, z }, { x, y: y + 9, z });
  };
  // (sixes-1: `paved`, the road's carriageway is not open ground: a fight with several is fought on a sidewalk or a
  // square, and in the road only when nothing else is in range. Seen 2026-11-18: a jump won in the road by a parked car)
  let paved = false;
  const open = (x, z, y0) => {
    const k = `${Math.round(x * 2)},${Math.round(z * 2)}`;
    let v = seen.get(k);
    if (v === undefined) {
      const y = A.groundAt(x, z);
      v = A.solidKnown(x, z) && !A.solidAt(x, z) && !A.lowNear(x, z, 0.3) && !roofed(x, z, y) ? { y, road: !!A.inRoad?.(x, z) } : null;
      seen.set(k, v);
    }
    return v !== null && Math.abs(v.y - y0) < level && !(paved && v.road);
  };
  /** The share of a disc round (cx, cz) that is open ground (1: all of it). */
  function openShare(cx, cz, r = CLEAR_R) {
    const y0 = A.groundAt(cx, cz);
    let n = 0;
    let ok = 0;
    for (let dx = -r; dx <= r + 1e-6; dx += 0.5) {
      for (let dz = -r; dz <= r + 1e-6; dz += 0.5) {
        if (dx * dx + dz * dz > r * r) continue;
        n += 1;
        if (open(cx + dx, cz + dz, y0)) ok += 1;
      }
    }
    return n ? ok / n : 0;
  }
  /**
   * THE GROUND: the middle nearest the two of them whose disc is all open; else the most open one near. (styles-1)
   * `others`: where everybody of ours not in the fight stands: then the middle is also kept CLEAR_OF metres from each
   * of them (a jump fought where the player stood at the flea market put him at a stallholder's elbow, heads over each
   * other for 16 s in the stage's audit, 2026-11-18), looked for further off (SEEK_MANY); else the clearest open one.
   */
  function groundFor(a, b, others = null) {
    seen = new Map();
    // (sixes-1: a fight with several looks for paved ground first, a sidewalk or a square, as far as it may look; the
    // road only when none of that is in range)
    if (others) {
      paved = true;
      const g = groundSearch(a, b, others);
      paved = false;
      if (g.fits) return { ...g, paved: true };
    }
    return { ...groundSearch(a, b, others), paved: false };
  }
  function groundSearch(a, b, others) {
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let X = [b[0] - a[0], b[1] - a[1]];
    const n = Math.hypot(X[0], X[1]);
    X = n > 0.05 ? [X[0] / n, X[1] / n] : [1, 0];
    // (nearly all open is enough near them: the brawl keeps to the middle of it, a stray fence post at its rim is not met)
    const ENOUGH = 0.9;
    const gap = c => (others?.length ? Math.min(...others.map(([x, z]) => Math.hypot(x - c[0], z - c[1]))) : Infinity);
    // (a fight with several wants its ground all open: pushed into a picnic table's edge, the player stood in it)
    const enough = others ? 0.97 : ENOUGH;
    const fits = (c, sh) => sh >= enough && gap(c) >= CLEAR_OF;
    const share0 = openShare(...m);
    let best = { c: m, share: share0, d: 0, gap: gap(m) };
    const better = (q, b0) => (others ? (q.share >= ENOUGH) - (b0.share >= ENOUGH) || Math.min(q.gap, CLEAR_OF) - Math.min(b0.gap, CLEAR_OF) || Math.min(q.share, enough) - Math.min(b0.share, enough) : q.share - b0.share) > 1e-6;
    if (fits(m, share0)) return { c: m, X, share: share0, moved: 0, gap: best.gap, fits: true };
    const far = others ? SEEK_MANY : SEEK;
    for (let r = 0.5; r <= far + 1e-6; r += 0.5) {
      const k = Math.max(8, Math.round((2 * Math.PI * r) / 0.75));
      for (let j = 0; j < k; j++) {
        const t = (j / k) * Math.PI * 2;
        const c = [m[0] + Math.cos(t) * r, m[1] + Math.sin(t) * r];
        const q = { c, share: openShare(...c), d: r, gap: gap(c) };
        if (better(q, best)) best = q;
        if (fits(c, q.share)) return { c, X, share: q.share, moved: r, gap: q.gap, fits: true };
      }
    }
    return { c: best.c, X, share: best.share, moved: best.d, gap: best.gap, fits: false };
  }

  /**
   * One fight, played. `duel` is the rules' (the event's: inputs, seed, result, who brings what); `you` and `them` the
   * stage's actors. Resolves when it is over and both stand (or the skip), with what was seen.
   */
  async function play({ duel: D, you, them: them0, ally: ally0 = null, youName = 'You', themName = 'them' }) {
    // (styles-1: several of them: `them` a list, one actor a foe of the fight, in its order)
    const many = Array.isArray(them0);
    const ids = many ? them0 : [them0];
    const them = ids[0];
    // (THE TWO ENDS OF IT, measured on the stage's clock: `called` now; `first` the first blow thrown (landed, covered
    // or slipped: the first act of it); `last` the blow that ends it; `back` control handed back. The checks fail a
    // fight whose first blow is over 2.5 s from its being called, or whose control is over 4 s from its last blow)
    const timing = { called: A.clock, first: null, last: null, back: null };
    // (sixes-1: `ally`, the actor who is Cousin Earl in a door fight: the fight's ally, beside you)
    const ally = D.inputs?.ally && ally0 && A.has(ally0) ? ally0 : null;
    if (!A.has(you) || !ids.every(id => A.has(id))) return { result: D.result, seen: null, skipped: true, why: 'nobody on the stage to fight' };
    if (D.inputs?.ally && !ally) return { result: D.result, seen: null, skipped: true, why: 'Earl is not on the stage to fight' };
    ensure();
    const F = startDuel(D.inputs, D.seed);
    const PY = A.get(you);
    const PT = A.get(them);
    // (jumped, two at once: on the spot where you stand, the way you face; one-on-one: between the two of you)
    // (and clear of everybody of ours who is not in it: they square up there, the player walking to it)
    const inIt = new Set([you, ...ids, ...(ally ? [ally] : [])]);
    const others = many ? (A.all?.() ?? []).filter(B => !inIt.has(B.id) && !B.w?.hide).map(B => [B.x, B.z]) : null;
    const G = many ? groundFor([PY.x, PY.z], [PY.x + Math.sin(PY.w?.yawS ?? PY.ry ?? 0) * 0.5, PY.z + Math.cos(PY.w?.yawS ?? PY.ry ?? 0) * 0.5], others) : groundFor([PY.x, PY.z], [PT.x, PT.z]);
    const [cx, cz] = G.c;
    const gy = (x, z) => A.groundAt(x, z);
    // (sixes-1: by side: you, each of them in their order, and Earl, last in the fight's own list)
    const foeIds = F.people.filter(p => p.side === 'foe').map(p => p.id);
    const actorOf = new Map(F.people.map((p, k) => [p.id, !k ? you : p.side === 'ally' ? ally : ids[foeIds.indexOf(p.id)]]));
    const all = [you, ...ids, ...(ally ? [ally] : [])];
    const aidOf = id => actorOf.get(id) ?? them;
    // THE SCRIPT, AND ITS STAGING (anim-1): the rules' fight run to its end, staged across the camera's view on that
    // ground (choreo.js). The way to the camera: along the ground, from the fight's middle
    const script = scriptOf(D.inputs, D.seed);
    // (the game's camera is asked for its bearing, not where it happens to be: a scene's cut may still be on)
    const az = ((stage.camera?.state?.().angle?.bearing ?? 90) * Math.PI) / 180;
    const fight = stageFight({
      script, seed: D.seed, pre: SQUARE_PRE, ground: { c: [cx, cz], r: all.length > 3 ? 2.4 : many ? 2.0 : 1.7 }, cam: [Math.sin(az), Math.cos(az)], firstHurt: D.inputs?.firstHurt ?? 0,
      // (named-1: and the size each is drawn at: the staging stands and reaches by it)
      cast: Object.fromEntries(F.people.map(p => [p.id, { at: [A.get(aidOf(p.id)).x, A.get(aidOf(p.id)).z], size: A.sizeOf?.(aidOf(p.id)) ?? 1 }])),
    });
    // THE FIGHT IS GIVEN ROOM (anim-1; demo/stage/room.js): from the squaring up to the last of it, nobody who is not
    // in it stands or walks on its ground: the city's crowd goes round or waits at its edge, ours standing there
    // step back and watch, ours walking are laid a way round
    const room = stage.room?.open({ c: [cx, cz], r: all.length > 3 ? 2.4 : many ? 2.0 : 1.7, keep: all }) ?? null;
    // THE DIRECTOR'S HANDS OFF THEM while it lasts: no routine of theirs starts on either (director.js `busy`)
    // (styles-1) THE TWO WHO JUMPED YOU ARE THE FIGHT'S, NOT THE HOUR'S: the line that brought them on has ended, and
    // the stage sends its extras off when a line ends (director.js dismiss): their walk off is called off (its trip
    // moved on), and one not on the stage yet comes on out of the picture, on the far side from where it is fought,
    // and runs in to the mark (the square-up). Seen 2026-11-18: one walking off through the fight, one never shown
    const cameOn = new Set();
    if (many) {
      for (const id of ids) {
        const P = stage.director?.people?.get(id);
        if (P) {
          P.tripId = (P.tripId ?? 0) + 1;
          P.off = false;
          P.going = null;
        }
        const Q = A.get(id);
        // (not on the stage yet, or a long way off where the picture does not show them: they come on at the NEAREST
        // point out of the picture and run in. Brought on at the first such point found they had eighteen metres to
        // run, and the fight waited for them)
        const far = Math.hypot(Q.x - cx, Q.z - cz) > 9 && !(A.inPicture?.(Q.x, Q.z) ?? true);
        if (Q.w?.hide || far) {
          const [ox, oz] = edgeNear(cx, cz, Q.x, Q.z);
          if (Q.w?.hide || Math.hypot(ox - cx, oz - cz) < Math.hypot(Q.x - cx, Q.z - cz) - 1) {
            A.place(id, ox, oz, Math.atan2(cx - ox, cz - oz));
            A.show?.(id, true);
            cameOn.add(id);
          }
        }
      }
    }
    const held = all.map(id => stage.director?.people?.get(id)).filter(Boolean);
    for (const P of held) {
      P.busy += 1;
      stage.director.rest(P.id);
    }
    for (const id of all) {
      A.stop(id);
      A.contact(id, 'duel');
    }
    const body = Object.fromEntries(F.people.map(p => [p.id, puppets.take(aidOf(p.id))]));
    const watch = createWatch({ city, actors: A, fade: stage.travel?.fade ?? null, near: (x, z) => Math.hypot(x - cx, z - cz) < 30, street: A.groundAt(cx, cz) });
    // THE BARS
    Y.name.textContent = youName;
    T.name.textContent = themName;
    Y.why.textContent = D.you?.why?.join(' · ') ?? '';
    T.why.textContent = D.them?.why?.join(' · ') ?? '';
    paintBars(F, D);
    strip.hidden = false;
    strip.dataset.result = '';
    const clock0 = A.clock;
    const st = { phase: 'square', t: 0, hits: 0, firstHit: null, down: null, result: null, expected: D.result, skipped: false, seconds: D.seconds, ground: { moved: +G.moved.toFixed(2), open: +G.share.toFixed(3), at: [+G.c[0].toFixed(2), +G.c[1].toFixed(2)], ...(many ? { clear: +Math.min(99, G.gap).toFixed(2), paved: G.paved } : {}) } };
    const stats = { blows: 0, onTime: 0, late: 0, whiffs: 0, shots: 0, flinches: 0, vests: 0, falls: 0 };
    // (the room it is given, measured by the room itself from a second after the fight was called to its end: frames,
    // frames with somebody not in it on its ground (`on`) or within a step of its edge (`near`), `lingers`, `nearest`
    // (m past its edge), `most` at once: room.js THE MEASURE. Kept in the record at the end)
    stats.crowd = null;
    let done = null;
    const finished = new Promise(r => {
      done = r;
    });

    // ── SQUARING UP: each walks to their mark, the way a person walks somewhere (turns to it, goes, slows into it),
    // and turns to the other. No heading is ever set at once: a turn is taken up and let go (TURN_A), never faster
    // than a body turns (TURN_V) ──
    const pose = F.people.map(p => {
      const Q = A.get(aidOf(p.id));
      return { x: Q.x, z: Q.z, yaw: Q.w?.yawS ?? Q.ry, v: 0, w: 0, there: false };
    });
    let squareT = 0;
    // (styles-1: jumped, they run in to their marks from wherever the scene left them, and squaring waits for them)
    // (no cap that starts the fight with one of them short of their mark: they would be moved at once to it, seen
    // 2026-11-18; a long one only, for a way that never gets there)
    const squareMax = many ? 30 : SQUARE_MAX;
    const turn = (P, to, dt) => {
      const err = wrap(to - P.yaw);
      const want = Math.max(-RUN_IN.turnV, Math.min(RUN_IN.turnV, err * 16));
      P.w += Math.max(-RUN_IN.turnA * dt, Math.min(RUN_IN.turnA * dt, want - P.w));
      const d = P.w * dt;
      // (never past it)
      if (Math.abs(d) > Math.abs(err) && Math.sign(d) === Math.sign(err)) {
        P.yaw = to;
        P.w = 0;
      } else P.yaw = wrap(P.yaw + d);
      return Math.abs(wrap(to - P.yaw));
    };
    // WHERE THE FIGHT IS JOINED: a third of a second before its first blow (the rules' ticks up to there are stepped
    // at once: nothing happens in them), each body where the staged fight has it THEN: whoever throws the first blow
    // is already stepping in to throw it
    const firstBlow = script.beats.find(b => !b.spent)?.t ?? 0;
    const tJoin = Math.max(fight.t0, firstBlow - RUN_IN.lead);
    const joined = stateAt(fight, tJoin).map(S => ({ at: [S.x, S.z], yaw: S.yaw }));
    // (how fast, each of them: there in about a second. One of a crew who comes on from out of the picture, fourteen
    // metres off at the trailer park, comes on already sprinting and brakes hard into it: the fight does not wait
    // two seconds for him)
    const runOf = pose.map((P, k) => Math.min(RUN_IN.most, Math.max(RUN_IN.v, Math.hypot(joined[k].at[0] - P.x, joined[k].at[1] - P.z) / RUN_IN.within)));
    pose.forEach((P, k) => {
      if (cameOn.has(aidOf(F.people[k].id))) P.v = runOf[k];
    });
    function square(dt) {
      squareT += dt;
      let all = true;
      F.people.forEach((p, k) => {
        const P = pose[k];
        const M = joined[k];
        const [mx, mz] = M.at;
        if (P.there) return body[p.id].walk(mx, gy(mx, mz), mz, M.yaw, 0);
        all = false;
        const d = Math.hypot(mx - P.x, mz - P.z);
        if (d > 0.05) {
          // (AT A RUN, at once, turning as they go: round to the way the fight has them face over the last metre;
          // one who starts with their back to it goes slower for the moment it takes to come round)
          const along = Math.atan2(mx - P.x, mz - P.z);
          const blend = Math.max(0, Math.min(1, 1 - (d - 0.2) / 0.9));
          const off = turn(P, wrap(along + wrap(M.yaw - along) * blend * blend), dt);
          const dec = runOf[k] > 6.5 ? RUN_IN.hard : RUN_IN.dec;
          const want = Math.min(runOf[k], 0.5 + Math.sqrt(2 * dec * d)) * (off > 1.7 ? 0.4 : 1);
          P.v += Math.max(-dec * 1.5 * dt, Math.min(RUN_IN.acc * dt, want - P.v));
          const s = Math.min(d, P.v * dt);
          P.x += ((mx - P.x) / d) * s;
          P.z += ((mz - P.z) / d) * s;
          return body[p.id].walk(P.x, gy(P.x, P.z), P.z, P.yaw, P.v);
        }
        P.v = 0;
        // (there: round to face the other)
        // (there, and near enough round: the staged fight takes them from here, a few degrees eased in its own blend)
        if (turn(P, M.yaw, dt) < 0.07 || squareT > squareMax) {
          P.there = true;
          P.x = mx;
          P.z = mz;
          P.yaw = M.yaw;
        }
        body[p.id].walk(P.x, gy(P.x, P.z), P.z, P.yaw, 0);
      });
      if (squareT > squareMax) for (const P of pose) P.there = true;
      st.walk = pose.map((P, k) => [+Math.hypot(joined[k].at[0] - P.x, joined[k].at[1] - P.z).toFixed(2), +wrap(joined[k].yaw - P.yaw).toFixed(2), P.there ? 1 : 0, +P.v.toFixed(2)]);
      return all;
    }

    // ── THE FIGHT: the staged score on the bodies, and the rules' own fight stepped tick for tick beside it ──
    let Tn = tJoin;
    /** who took a blow (their cheek is marked when they stand again), and the pool under whoever stays down */
    const bled = new Set();
    let pool = null;
    const states = fight.fighters.map(() => undefined);
    let seen = 0;
    let fxI = 0;
    const headOf = id => {
      const Q = A.get(aidOf(id));
      return [Q.x, Q.y + POP_Y, Q.z];
    };
    function onEvent(e) {
      if (e.type === 'hit') {
        const q = F.people.find(x => x.id === e.id);
        st.hits += 1;
        st.firstHit ??= F.t;
        stats.flinches += 1;
        fx.pop(headOf(e.id), `-${e.dmg}`, q.side === 'you' ? 'you' : 'them');
        // THE BLOOD of it: off the very place it landed (the staged fight's own), and nothing that rides the body
        // while it is posed by hand: a mark laid on a walker hangs where a STANDING head would be (gore.js "a body
        // posed by hand"; the owner's "blood splatter stays in the air", 2026-11-18). The cheek's mark is put on when
        // the fight is over and they stand (end)
        const hitAt = fight.fx.find(x => x.to === e.id && Math.abs(x.t - F.t) < 1e-6)?.at?.() ?? null;
        stage.gore?.blow(aidOf(e.id), aidOf(e.by), 'punch', { at: hitAt ?? [headOf(e.id)[0], headOf(e.id)[1] - 1.2, headOf(e.id)[2]], mark: false });
        bled.add(aidOf(e.id));
      } else if (e.type === 'swing') {
        timing.first ??= A.clock;
        stats.blows += 1;
        stats.onTime += 1;
      } else if (e.type === 'down') {
        st.down = { id: e.id, t: F.t, how: e.how };
        stats.falls += 1;
      }
    }
    function fightStep(dt) {
      Tn = Math.min(fight.t1, Tn + dt);
      // (the rules' clock starts when the squaring up is done)
      while (!F.over && F.t + TICK <= Tn + 1e-9) {
        step(F, brawl(F));
        for (; seen < F.events.length; seen++) onEvent(F.events[seen]);
      }
      // (where a blow lands: the star on it; one caught on the arms, a puff)
      for (; fxI < fight.fx.length && fight.fx[fxI].t <= Tn + 1e-9; fxI++) {
        const e = fight.fx[fxI];
        const p = e.at?.();
        if (!p) continue;
        if (e.kind === 'hit') fx.impact(p, e.w, e.held ? 'cut' : 'blow');
        else if (e.kind === 'slam') {
          // (put on the ground: the dust it raises, and the blow of it)
          fx.impact([p[0], gy(p[0], p[2]) + 0.1, p[2]], 1, 'slam');
          fx.impact(p, 0.9, 'blow');
        } else if (e.kind === 'block') fx.impact(p, 0.2, 'guard');
      }
      st.t = +Math.max(0, Math.min(Tn, F.over?.t ?? Tn)).toFixed(2);
      const now = stateAt(fight, Tn, states);
      for (const [k, p] of F.people.entries()) {
        const Fi = fight.byId[p.id];
        const S = now[k];
        const y = gy(S.x, S.z);
        Fi.y = y;
        body[p.id].set(S.x, y, S.z, S.yaw, S.P);
        // (where each head is as it is drawn, for the tools: demo/tools/fight-blood.mjs)
        const pts = Fi.points(Tn, S);
        (st.heads ??= {})[aidOf(p.id)] = pts.headC.map(v => +v.toFixed(3));
        // (a blade in the hand that holds it)
        if (Fi.G.held) {
          // (the hand it is in: the strong one, which is the body's own L for a blade led with, mirrored for a southpaw)
          const L = ((Fi.G.strong ?? 'R') === 'L') === (Fi.lead === -1);
          heldThings.show(p.id, Fi.G.held, L ? pts.fistL : pts.fistR, L ? pts.elbL : pts.elbR);
        }
      }
      paintBars(F, D);
      // (down and staying down: a small pool under the head; it dries as they get up)
      const lying = fight.fighters.find(Fi => Fi.out);
      if (lying && bled.has(aidOf(lying.id))) {
        const s = Tn - lying.out.t;
        if (!pool && s > 1.6 && (lying.out.up === undefined || Tn < lying.out.up)) {
          const h = st.heads?.[aidOf(lying.id)];
          if (h) pool = stage.gore?.pool?.(h[0], gy(h[0], h[2]), h[2]) ?? null;
        } else if (pool && lying.out.up !== undefined && Tn >= lying.out.up) {
          pool.dry();
          pool = { dry() {} };
        }
      }
      if (F.over) timing.last ??= A.clock;
      if (Tn < 0) st.phase = 'square';
      else if (!F.over) st.phase = 'fight';
      else {
        if (!strip.dataset.result) strip.dataset.result = F.over.result === 'won' ? 'won' : 'lost';
        st.phase = Tn < fight.tOver + DOWN_HOLD ? 'down' : 'after';
      }
      return Tn >= fight.t1 - 1e-9;
    }

    // ── EVERY FRAME OF THE STAGE (its clock: paused with it, at its speed) ──
    let skipping = false;
    let ended = false;
    let walking = true;
    function end(skipped) {
      if (ended) return;
      ended = true;
      off();
      stats.crowd = room?.figures?.() ?? null;
      room?.close();
      st.result = F.over?.result ?? D.result;
      st.skipped = skipped;
      for (const id of all) {
        // (handed back on the ground as drawn where they stand: a runner let go 0.14 m over a kerb's edge, in the fight's
        // clip, was feet off the ground in the stage's audit, 2026-11-18)
        const Q = A.get(id);
        puppets.live.get(id)?.release(Q ? A.groundAt(Q.x, Q.z) : null);
        A.setRate(id, 1);
        A.contact(id, null);
      }
      for (const P of held) P.busy = Math.max(0, P.busy - 1);
      // (the blood that rides a body: now that they stand as the stage has them, the mark on the cheek of whoever took it)
      pool?.dry();
      for (const id of bled) stage.gore?.cheek?.(id);
      strip.hidden = true;
      heldThings.clear();
      fx.clear();
      fx.draw(null);
      timing.back = A.clock;
      const rec = { result: D.result, seen: F.over?.result ?? null, skipped, seconds: D.seconds, foes: ids.length, ...(D.jumped ? { jumped: true, band: D.band } : {}), ...(D.crew ? { crew: true, ally: !!ally, earlDown: !!F.people.find(p => p.side === 'ally')?.down } : {}), stageSeconds: +(A.clock - clock0).toFixed(2), seenSeconds: F.over?.t ?? null, ...paceOf(timing, skipped), mismatch: !!F.over && F.over.result !== D.result, hits: st.hits, ground: st.ground, frames: watch.report(), anim: { ...stats } };
      if (rec.mismatch) console.error(`[run] the fight seen ended ${F.over.result}, the rules said ${D.result} (seed ${D.seed})`);
      log.push(rec);
      cur = null;
      done(rec);
    }
    const off = A.onFrame(dt => {
      if (ended || skipping) return;
      if (walking) {
        if (!square(dt)) return;
        walking = false;
      }
      if (fightStep(dt)) end(false);
    });
    // EVERY PICTURE: the numbers off a hit, and the frame check
    const raf = () => {
      if (ended) return;
      requestAnimationFrame(raf);
      fx.now = Tn;
      fx.draw({ people: [] });
      watch.step(st.phase === 'square' ? null : st.t);
    };
    requestAnimationFrame(raf);

    // THE SKIP: under the black, everybody stood where the fight would have left them; the result is the rules' all along
    cur = {
      async skip() {
        if (ended || skipping) return;
        skipping = true;
        const fade = stage.travel?.fade;
        const dip = !!fade && !fade.dark;
        if (dip) await fade.out();
        watch.cut();
        // (the rules' fight to its end, for the record: it is the same one)
        while (!F.over) {
          step(F, brawl(F));
          for (; seen < F.events.length; seen++) if (F.events[seen].type === 'down') st.down = { id: F.events[seen].id, t: F.t, how: F.events[seen].how };
        }
        const last = F.people.map(p => fight.byId[p.id].at(fight.t1));
        for (const id of all) {
          A.cutClip?.(id);
          A.stop(id);
        }
        end(true);
        F.people.forEach((p, k) => A.place(aidOf(p.id), last[k].x, last[k].z, last[k].yaw));
        if (dip) fade.in();
      },
      st,
    };
    return finished;
  }

  // THE FIGHT'S CLIPS AT PAGE LOAD (anim-1): adding them recompiles the walkers' shader, half a second in which the
  // page draws nothing; it was paid at the first fight of a session, as the two squared up. Once the city's walkers
  // are up it is paid here, while the page is still opening.
  // (the clips only: the fight's overlay and the rest are made when a fight is, as before. Made here too, the overlay
  // was on the page from its start, and the try-out stop's check counted it as left behind by the fight it had watched)
  A.until?.(() => !!(window.__demo?.city ?? window.__city)?.peds?.anim?.batch).then(() => {
    try {
      installed();
    } catch (err) {
      console.warn('[run] the fight\'s clips were not set up ahead:', err);
    }
  });

  return {
    play,
    skip: () => cur?.skip(),
    get active() {
      return !!cur;
    },
    get state() {
      return cur ? { ...cur.st } : null;
    },
    log,
    /** The strip's Skip button, for the tools (its box on the page). */
    get skipButton() {
      return strip.hidden ? null : skipBtn;
    },
  };
}
