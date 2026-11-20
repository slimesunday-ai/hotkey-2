// THE RAID ON YOUR HOME, PLAYED AT YOUR DOOR (raidfight-1, RUN.md "The raid on your home"). The rules' raid
// (src/fight/raid.mjs: the crew, what is in your hands, Cousin Earl beside you or not, the pieces) is seeded and nobody
// steers it, so the page steps the very same fight a tick at a time (startRaid, step with raidMove) and what is seen
// is what the rules decided: who fires at whom and when, who is hit, who goes down, the end. A fight seen to end
// otherwise than the rules said is a fault the record says (`mismatch`).
//
//   const raid = createRaidFight({ stage, city, root })
//   await raid.play({ raid, you, ally, pad, dark })   → the record (below)
//     raid    the rules' raid fight: the `raid` event's `duel` (src/run/raid.mjs raidOut: { inputs, seed, result, ... }),
//             or anything with `inputs`, `seed` and `result`
//     you     the player's actor; ally: Cousin Earl's (when the inputs have him; one is made if not given)
//     pad     whose door: the stage's map has `home:<pad>:door` and `:step` (default 'a1', the run's own)
//     dark    true: the scene ends under the black and leaves it to the caller (a card, the clinic); else it fades in
//   Called under the stage's black (travel.js fade.out()), the scene takes the black over and lifts it itself, on them
//   coming (the caller does not call fade.in()); else it goes to black first itself.
//   raid.skip()     Space, Enter or the Skip button: the black, the rules' end, the record (skipped: true)
//   raid.active · raid.state (the phase, the fight's clock, the layout) · raid.log (every raid played) · raid.skipButton
//
// HOW IT PLAYS. Before the first frame the rules' raid is run to its end once, to know it whole: where everybody goes,
// every shot and blow. Their ground (60 by 40 m, open, you in the middle) is laid on your door (raidlay.js: near you
// exactly as the rules have it, the far ones bent along the lane and drawn in to fit it and the picture). Then, under
// the stage's black, everybody is put where the rules have them a moment before the first shot or blow (LEAD s: the
// big men's long walk is not watched whole), and the black lifts on them coming. The bodies are the gun fight's own
// (demo/fight/puppet/gunner.js, the four new gun bodies): the legs the city's walk, at the pace they are drawn moving;
// above the hips posed by hand from what each is doing; the blows' wind-ups started so they land on the rules' tick
// (a copy of the fight stepped a few ticks ahead: it is seeded); the falls by what dropped them. The end: whoever went
// down stays down; you held, you stand over them; you beaten, you are seen going down and they stand over you. HOLD s
// on it, then the black, the crew taken off, and control back.
//
// THE RECORD: { result (the rules'), seen (what played), mismatch, skipped, crew, n, hold, earl, seconds (the rules'),
// open (s from the call to the first shot or blow), close (s from the last to control back), slow (what was over PACE),
// join (the rules' clock when the black lifted), layout { anchor, mirror, turn, figures }, frames (the frame check),
// crowd (the room it was given), clean { knot, nearest, spin, slide, ... } (the measures, below), anim (the bodies') }
import { startRaid, raidMove } from '../../src/fight/raid.mjs';
import { step, TICK, WEAPONS } from '../../src/fight/index.mjs';
import { createGunners } from '../fight/puppet/gunner.js';
import { warmBlood } from '../fight/puppet/gunmesh.js';
import { GUNS, GUN_OF } from '../fight/puppet/guns.js';
import { createFx } from '../fight/fx.js';
import { installClips } from '../fight/clips/index.js';
import { createWatch } from '../fight/watch.js';
import { createKit } from '../stage/rides/kit.js';
import { h } from '../hud/dom.js';
import { layRaid } from './raidlay.js';

/** How soon the first shot or blow must come after the scene is called, and control come back after the last (s). */
export const RAID_PACE = Object.freeze({ open: 2.0, close: 4 });
/** The most of their walk up that is watched before the first shot or blow (s of the rules' clock). */
const LEAD = 1.3;
/** On the end, before the black (s). */
const HOLD = 2.0;
/** A body's heading turned at most (rad/s) and taken up (rad/s²): walking or squaring to somebody, and a gun's pivot. */
const TURN = { walk: [3.4, 16], quick: [9, 70] };
/** A move this far (m) past a body's own step in one tick is slid over SLIDE s, not eased over its tick. */
const SHOVE = 0.15;
/** A body drawn moving faster than this (m/s) in one picture is noted, with what moved it (the measure). */
const JUMP = 9;
/** How long before its shot a gun in one hand squares up to whoever it is at (s). */
const SQUARE = 0.6;
/** How much faster than its own move a body may be drawn moving, held off another (m/s). */
const PUSH = 3;
/** Over a head: where a number pops, and the bar's height (m). */
const POP_Y = 2.35;
/** How the crew look, by what they are (the fight page's own looks for its heavies, runners and shooters). */
const LOOKS = {
  // (named-1: Cousin Earl in his own drawn pieces, at his own size: world/named/, demo/run/scenes.js NAMED)
  ally: { seed: 'npc:Cousin Earl', named: 'earl', was: { pool: 'agent', wear: { top: 'dock_vest', hat: 'dockhand_beanie' } } },
  heavy: n => ({ seed: `raid:heavy:${n}`, pool: 'agent', wear: { hat: 'corner_rag', top: 'corner_hoodie' } }),
  runner: n => ({ seed: `raid:runner:${n}`, pool: 'agent', wear: { top: 'old_hoodie', hat: 'old_bandana' } }),
  shooter: n => ({ seed: `raid:shooter:${n}`, pool: 'agent', wear: { top: 'old_hoodie', hat: 'old_beanie' } }),
  // (big men in heavy jackets: the snorkel parka, a durag and wraparound shades: from above, the durag and the shades)
  bigman: n => ({ seed: `raid:bigman:${n}`, pool: 'agent', wear: { top: 'old_opus_snorkel', hat: 'silk_durag', eyewear: 'getaway_wraps' } }),
};
const lookOf = (q, n) => (q.arm === 'mauler' ? LOOKS.bigman : LOOKS[q.kind] ?? LOOKS.heavy)(n);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/** The rules' raid run to its end: everybody every tenth of a second, every shot and blow, the first and the last. */
export function raidScript(D) {
  const F = startRaid(D.inputs, D.seed);
  const idx = new Map(F.people.map((p, k) => [p.id, k]));
  const frames = [{ t: 0, at: F.people.map(p => [p.x, p.y]) }];
  const acts = [];
  let n = 0;
  while (!F.over) {
    step(F, raidMove(F));
    for (; n < F.events.length; n++) {
      const e = F.events[n];
      if (e.type === 'shot' || e.type === 'swing') acts.push({ t: e.t, from: idx.get(e.id), to: idx.get(e.to) });
    }
    if (F.tick % 3 === 0 || F.over) frames.push({ t: F.t, at: F.people.map(p => (p.down ? null : [p.x, p.y])) });
  }
  return { o: F.arena.start, frames, acts, first: acts[0]?.t ?? null, last: acts.at(-1)?.t ?? null, over: F.over, events: F.events.slice() };
}

export function createRaidFight({ stage, city: city0 = null, root }) {
  const A = stage.actors;
  let city = city0;
  const cityNow = () => (city ??= window.__demo?.city ?? window.__city);
  let kit = null;
  let fx = null;
  let G = null;
  let clips = false;
  let cur = null;
  const log = [];
  // (the layout of the raid now playing: the gun bodies are made once, and read the ground through this)
  let lay = null;
  const W2 = (x, y) => (lay ? lay.W(x, y) : [x, y]);
  const W = (x, y, up = 0) => {
    const [wx, wz] = W2(x, y);
    return [wx, A.groundAt(wx, wz) + up, wz];
  };

  // ── THE STRIP: the run's fight strip (duel.js's own look): two bars, the names, Skip ──────────────────────────
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
  const skipBtn = h('button', { type: 'button', class: 'u-btn is-quiet rn-duel-skip', title: 'Skip the raid: the same result (Space or Enter)' }, 'Skip', h('kbd', { class: 'u-key' }, 'Space'));
  const head = h('span', { class: 'u-cap rn-duel-cap' }, 'The raid');
  const strip = h('section', { class: 'u-panel rn-duel rn-raid', role: 'status', 'aria-label': 'The raid on your home', hidden: true }, head, h('div', { class: 'rn-duel-sides' }, Y.el, h('span', { class: 'rn-duel-vs u-sign' }, 'vs'), T.el), skipBtn);
  root.append(strip);
  skipBtn.addEventListener('click', e => {
    e.preventDefault();
    cur?.skip();
  });
  function paintBars(F) {
    const set = (S, hp, max, down) => {
      S.fill.style.width = `${Math.max(0, (hp / max) * 100)}%`;
      S.hp.textContent = String(Math.max(0, hp));
      S.el.classList.toggle('is-low', hp / max < 0.3);
      S.el.classList.toggle('is-down', down);
    };
    const me = F.people[0];
    set(Y, me.hp, me.max, me.down);
    const them = F.people.filter(p => p.side === 'foe');
    set(T, them.reduce((a, q) => a + Math.max(0, q.hp), 0), them.reduce((a, q) => a + q.max, 0), them.every(q => q.down));
  }

  // ── THE LIGHT BY NIGHT (raidfight-2; the owner: "can we add a glow / light radius or something around the raiders
  // that illuminates the area they are in?"). The rules bring the Sixes at night, and under the stage's night the
  // fight was a dim cluster in a blue picture. Two lights of the city's own, the night's lamp term (render/night.js:
  // a few uniforms read by every lit material, compiled in already, so nothing is built and nothing is linked):
  //   THE POOL   its one SPOT (the last slot, its own colour and strength, a cone with a soft edge; the city lends it
  //              to a billboard downtown, kept and given back after), POOL.up m over the middle of everybody in the
  //              fight, pointed straight down, its cone just wide enough for all of them and POOL.margin m more, eased
  //              after them as the fight moves: the fight's ground stands in a pool of light, the rest stays night
  //   A FLASH    each round fired, a key lamp at the muzzle for POOL.flash s (the stage's key lamps, the street lamps'
  //              own light: stage.keyLamps): the ground round the gun lights up and goes
  // By day neither is lit (the night's own switch). `?pool=<intensity>` tries another strength.
  // (raidfight-5) THE FLASH, PLAIN. A key lamp is a street lamp's strength, shared with every street lamp in the city:
  // at the muzzle for 0.07 s it barely showed, and the shot's lines carried the moment. Look c has no pool, so the spot
  // is free, and it is the flash: FLASH.up m over the muzzle, a hand ahead of it, pointed down at the ground at the
  // gun, a wide soft warm cone that falls off fast, full for FLASH.hold s and gone over FLASH.fade s more, with the old
  // key lamp at the muzzle for FLASH.keys s beside it (all round: the shooter and whoever stands behind):
  // the ground, the shooter and whoever stands in front of the gun light up plainly, every round (a Chopper's burst
  // flickers). Where the spot is the pool (a, b, d) the flash is two key lamps at the muzzle for FLASH.keys s, twice the
  // old one and half again as long. The spot is the city's billboard's, put back as the city had it when the raid
  // ends (render/night.js keeps its own copy of the spot's strength and writes it again whenever the lamps are placed:
  // the spot is set again with the very figures it had, then every uniform as it was). `&flash=old`: the flash as it
  // was, for looking at the two side by side.
  const POOL = { up: 9, margin: 1.6, least: 3.6, most: 9, ease: 3.5, penumbra: 0.4, decay: 1, intensity: (q => (q !== null && q !== '' && Number.isFinite(Number(q)) ? Number(q) : 75))(new URLSearchParams(location.search).get('pool')), color: 0xffe9cc, flash: 0.07 };
  if (typeof window !== 'undefined') window.__raidPool = POOL;
  const FLASH = { up: 1.4, ahead: 0.3, reach: 0.7, angle: 1.2, penumbra: 0.8, distance: 8, decay: 1.8, intensity: 260, color: 0xffc27a, hold: 0.05, fade: 0.09, keys: 0.1, old: new URLSearchParams(location.search).get('flash') === 'old' };
  if (typeof window !== 'undefined') window.__raidFlash = FLASH;
  /**
   * (raidfight-4) THE NIGHT'S LOOKS, for the owner to choose by eye (`&nightlook=a|b|c|d`). Every one is the night
   * term's uniforms and the stage's own clock: nothing is built. (raidfight-5: the owner chose c, "Agree on c": it is
   * the default wherever a raid plays at night; a, b and d stay reachable by the address.)
   *   a  the warm pool as above
   *   b  MOONLIGHT: the same pool, cool blue-white, half the strength, its cone half again as wide and its edge all
   *      fall-off (penumbra 1: full only straight under it, fading the whole way out): a moonlit patch of the yard
   *   c  THE PORCH LIGHT AND A LIGHTER NIGHT: no pool; a key lamp over your door (a street lamp's light, 2.4 m up: the
   *      porch lamp come on), and the stage's own clock set back toward dusk while the raid plays (19:00, the night
   *      three fifths of the way in), put back after
   *   d  b and c, each a little less: the moon at a third of a's strength, the porch lamp higher (3.4 m: dimmer and
   *      wider, its strength being every street lamp's), the night four fifths of the way in (19:20)
   */
  const NIGHT_LOOKS = {
    a: { pool: { intensity: 1, color: 0xffe9cc, penumbra: 0.4, widen: 1 } },
    b: { pool: { intensity: 0.5, color: 0xcfe0ff, penumbra: 1, widen: 1.5 } },
    c: { porch: 2.4, hour: 19.0, spotFlash: true },
    d: { pool: { intensity: 0.34, color: 0xcfe0ff, penumbra: 1, widen: 1.5 }, porch: 3.4, hour: 19.33 },
  };
  const lookOfNight = () => NIGHT_LOOKS[new URLSearchParams(location.search).get('nightlook')] ?? NIGHT_LOOKS.c;
  /**
   * THE LIGHT AS IT IS, for the record and the check that it is put back: the stage's clock, the night (0 … 1), the
   * city's lamp level, and the spot's and the lamps' uniforms.
   */
  function lightNow() {
    const U = cityNow()?.THREE?.ShaderLib?.standard?.uniforms;
    const r = v => (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'number').map(([k, x]) => [k, +x.toFixed(4)])) : v);
    return { clock: stage.clock ? { ...stage.clock } : null, night: window.__light?.night?.levelNow ?? null,
      spotP: r(U?.citySpotP?.value), spotK: r(U?.citySpotK?.value), lampK: r(U?.cityLampK?.value), lampX: r(U?.cityLampX?.value) };
  }
  function nightLight(door) {
    // (`?pool=0`: the night as it was, for looking at the two side by side)
    if (!(POOL.intensity > 0)) return null;
    const N = window.__light?.night ?? null;
    const U = cityNow()?.THREE?.ShaderLib?.standard?.uniforms;
    if (!N?.spot || !U?.citySpotP) return null;
    const look = lookOfNight();
    const saved = { P: { ...U.citySpotP.value }, D: { ...U.citySpotD.value }, K: { ...U.citySpotK.value }, y: U.cityLampX.value.y, level: N.levelNow ?? 1 };
    const pool = { c: null, r: POOL.least };
    const flashes = [];
    // (the flash by the spot: the last round's, { at, dir, t })
    const spotFlash = look.spotFlash && !look.pool && !FLASH.old;
    let fl = null;
    let spotOn = false;
    let touched = false;
    // (the porch lamp: over the step, toward the door)
    const porch = look.porch && door ? [door.step[0] - Math.sin(door.face) * 0.5, A.groundAt(door.step[0], door.step[1]) + look.porch, door.step[1] - Math.cos(door.face) * 0.5] : null;
    stage.keyLamps?.(() => [...(porch && N.lit ? [porch] : []), ...flashes.filter(f => f.until > A.clock).flatMap(f => f.n === 2 ? [f.at, f.at] : [f.at])]);
    // (the lighter night: the stage's own clock, toward dusk, while the raid plays; put back after, whatever ends it.
    // Only the stage's clock, the light's: the run's own clock, on your numbers, is the rules' state and never this.
    // Put back only if it is still the one set here: a clock set since by somebody else is theirs)
    const clock0 = stage.clock ?? null;
    let setTo = null;
    if (look.hour && N.lit && clock0) {
      setTo = { ...clock0, hour: look.hour };
      stage.setClock?.(setTo);
    }
    let on = false;
    let gone = false;
    return {
      look: Object.keys(NIGHT_LOOKS).find(k => NIGHT_LOOKS[k] === look),
      clock: { was: clock0 ? { ...clock0 } : null, set: setTo ? { ...setTo } : null, back: null },
      flash(at, dir = null) {
        if (!at) return;
        // (and with the spot, a key lamp at the muzzle as before: it lights all round, the shooter and whoever is
        // behind them; the spot is the plain burst on the ground and the bodies in front of the gun)
        if (spotFlash) fl = { at: [...at], dir: dir ? [dir[0], dir[2]] : [0, 0], t: A.clock };
        flashes.push({ at: [at[0], at[1] + 0.15, at[2]], until: A.clock + (FLASH.old ? POOL.flash : FLASH.keys), n: FLASH.old || spotFlash ? 1 : 2 });
        while (flashes.length > 6) flashes.shift();
      },
      /** How strong the spot's flash is now, 0 … 1 (the record, the tools). */
      flashNow: 0,
      /** pts: everybody in the fight, world [x, y, z] */
      frame(pts, dt) {
        // THE FLASH BY THE SPOT: full, then gone (the stage's clock: held still with it)
        if (spotFlash) {
          const age = fl ? A.clock - fl.t : 9;
          const k = !N.lit ? 0 : age <= FLASH.hold ? 1 : Math.max(0, 1 - (age - FLASH.hold) / FLASH.fade) ** 2;
          this.flashNow = +k.toFixed(3);
          if (k > 0) {
            const l = Math.hypot(fl.dir[0], fl.dir[1]) || 1;
            const [dx, dz] = [fl.dir[0] / l, fl.dir[1] / l];
            const gy = A.groundAt(fl.at[0], fl.at[2]);
            // (the lamp term's strength is the lamps' level × this: at dusk the flash is as strong as at night)
            N.spot({ pos: [fl.at[0] + dx * FLASH.ahead, Math.max(fl.at[1], gy + 1) + FLASH.up, fl.at[2] + dz * FLASH.ahead], target: [fl.at[0] + dx * FLASH.reach, gy, fl.at[2] + dz * FLASH.reach], color: FLASH.color, intensity: (FLASH.intensity * k) / Math.max(0.25, N.levelNow ?? 1), distance: FLASH.distance, angle: FLASH.angle, penumbra: FLASH.penumbra, decay: FLASH.decay });
            spotOn = true;
            touched = true;
          } else if (spotOn) {
            // (between rounds: no spot at all, its cut-off 0)
            U.citySpotP.value.w = 0;
            spotOn = false;
          }
        }
        const L = look.pool;
        if (!L || !N.lit || !pts.length) {
          if (on) Object.assign(U.citySpotP.value, saved.P);
          on = false;
          return;
        }
        const c = [0, 0, 0];
        for (const p of pts) for (let i = 0; i < 3; i++) c[i] += p[i] / pts.length;
        let r = 0;
        for (const p of pts) r = Math.max(r, Math.hypot(p[0] - c[0], p[2] - c[2]));
        r = Math.min(POOL.most, Math.max(POOL.least, r + POOL.margin)) * L.widen;
        const k = pool.c ? 1 - Math.exp(-POOL.ease * Math.min(dt, 0.1)) : 1;
        pool.c = pool.c ? pool.c.map((v, i) => v + (c[i] - v) * k) : c;
        pool.r += (r - pool.r) * (pool.c === c ? 1 : k);
        const [x, y, z] = pool.c;
        N.spot({ pos: [x, y + POOL.up, z], target: [x, y, z], color: L.color, intensity: POOL.intensity * L.intensity * (N.levelNow ?? 1), distance: POOL.up + 9, angle: Math.atan(pool.r / POOL.up), penumbra: L.penumbra, decay: POOL.decay });
        on = true;
        touched = true;
      },
      /** Everything put back as it was (once; the clock first, whatever else fails). */
      done() {
        if (gone) return;
        gone = true;
        try {
          if (setTo && stage.clock === setTo) {
            stage.setClock?.(clock0);
            this.clock.back = { ...clock0 };
          }
        } finally {
          // (the spot set again with what it had (its strength is the uniform over the lamps' level then), so the night
          // term's own copy of it is the city's again, not ours: it writes that copy back whenever the lamps are placed)
          if (touched && saved.level > 0) {
            const k = saved.level;
            N.spot({ pos: [saved.P.x, saved.P.y, saved.P.z], target: [saved.P.x - saved.D.x, saved.P.y - saved.D.y, saved.P.z - saved.D.z], color: new (cityNow().THREE.Color)(saved.K.x / k, saved.K.y / k, saved.K.z / k), intensity: 1, distance: saved.P.w, angle: 0.5, decay: saved.K.w });
          }
          Object.assign(U.citySpotP.value, saved.P);
          Object.assign(U.citySpotD.value, saved.D);
          Object.assign(U.citySpotK.value, saved.K);
          U.cityLampX.value.y = saved.y;
          stage.keyLamps?.(null);
        }
      },
    };
  }

  function ensure() {
    cityNow();
    if (!clips) {
      installClips({ CLIPS: A.CLIPS, mats: [city.peds?.anim?.mat, city.peds?.anim?.batch?.customDepthMaterial], THREE: city.THREE });
      clips = true;
    }
    kit ??= stage.rides?.kit ?? createKit({ city, actors: A, CLIPS: A.CLIPS });
    fx ??= createFx({ city, skin: () => root });
    G ??= createGunners({ actors: A, fx, W, city, at0: () => lay?.o ?? [0, 0], heads: true, shotsAhead: 1.2, fromGrip: true });
    // (the blood's mist is first drawn at the first hit: its program built now, not then)
    warmBlood(city);
  }

  /** The door of a pad: where its step is, and the way out of it (the stage's map: the place table's spots). */
  function doorOf(pad, you) {
    const S = stage.map?.BLOCKS?.projects?.spots ?? {};
    const d = S[`home:${pad}:door`];
    const s = S[`home:${pad}:step`];
    if (d && s) return { step: s, face: Math.atan2(s[0] - d[0], s[1] - d[1]) };
    const Q = A.get(you);
    const yaw = Q.w?.yawS ?? Q.ry ?? 0;
    return { step: [Q.x, Q.z], face: yaw };
  }

  /**
   * THE PICTURE, as the game's camera has it with you at `c`: its own angle (camera.js: the bearing it looks from, how
   * far down, how far off) and lens, wherever it happens to be looking now. → seen(x, z): a body standing there is
   * well inside it (its middle, a margin off every edge).
   */
  function pictureAt(c) {
    const ang = stage.camera?.state?.().angle ?? { bearing: 90, down: 64, metres: 26.7 };
    const cam = cityNow().camera;
    const b = (ang.bearing * Math.PI) / 180;
    const dn = (ang.down * Math.PI) / 180;
    const m = ang.metres ?? 26.7;
    const y0 = A.groundAt(c[0], c[1]);
    const P = [c[0] + Math.sin(b) * Math.cos(dn) * m, y0 + Math.sin(dn) * m, c[1] + Math.cos(b) * Math.cos(dn) * m];
    const f = [c[0] - P[0], y0 + 0.9 - P[1], c[1] - P[2]];
    const fl = Math.hypot(...f);
    const F = f.map(v => v / fl);
    const R0 = [F[2], 0, -F[0]];
    const rl = Math.hypot(...R0);
    const R = R0.map(v => -v / rl);
    const U = [R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0]];
    const tv = Math.tan(((cam?.fov ?? 42) * Math.PI) / 360);
    const th = tv * (cam?.aspect ?? 1.6);
    return (x, z) => {
      const v = [x - P[0], A.groundAt(x, z) + 0.9 - P[1], z - P[2]];
      const d = v[0] * F[0] + v[1] * F[1] + v[2] * F[2];
      if (d <= 0.5) return false;
      const sx = (v[0] * R[0] + v[1] * R[1] + v[2] * R[2]) / d / th;
      const sy = (v[0] * U[0] + v[1] * U[1] + v[2] * U[2]) / d / tv;
      return Math.abs(sx) < 0.86 && Math.abs(sy) < 0.8;
    };
  }

  /**
   * One raid, played. Resolves when it is over and control is back (or the skip), with the record.
   */
  async function play({ raid: D, you, ally: ally0 = null, pad = 'a1', dark = false }) {
    const timing = { called: A.clock, first: null, last: null, back: null };
    if (!A.has(you)) return { result: D.result, seen: null, skipped: true, why: 'nobody on the stage to be you' };
    // (called under the stage's black, the scene takes it over: it is lifted on them coming, and the caller does not.
    // Else the black first: the setting up (the ground laid, the crew made: a long picture) is never seen)
    const fade = stage.travel?.fade ?? null;
    if (fade && !fade.dark) await fade.out();
    // (for the picture tools: the yard as it is before anything of the raid's is put on it, under the black)
    if (typeof window.__raidWait === 'function') await window.__raidWait('before', lightNow());
    // (raidfight-5: whatever the setting up throws, the light it changed is put back before the error goes on)
    let light = null;
    try {
      return await begin();
    } catch (err) {
      try {
        light?.done();
      } catch (e) {
        console.error('[raid] the light could not be put back:', e);
      }
      throw err;
    }
    async function begin() {
      ensure();
      // THE RULES' RAID, whole, first; then the one the page steps, the same fight tick for tick
      const S = raidScript(D);
      const F = startRaid(D.inputs, D.seed);
      // THE GROUND: laid on the door (raidlay.js), from the whole of it
      const door = doorOf(pad, you);
      // (the city's ground there known first: a page that has just put you at the door waits a moment for it)
      for (let k = 0; k < 40 && !A.solidKnown(door.step[0], door.step[1]); k++) await new Promise(r => setTimeout(r, 100));
      const [ox, oz] = [Math.sin(door.face), Math.cos(door.face)];
      const [sx0, sz0] = [oz, -ox];
      const anchors = [[1.0, 0], [0.5, 0], [1.6, 0], [2.2, 0], [3.0, 0], [3.8, 0], [1.4, 1.3], [1.4, -1.3], [1.4, 2.6], [1.4, -2.6], [2.8, 1.6], [2.8, -1.6]].map(([o, s]) => [door.step[0] + ox * o + sx0 * s, door.step[1] + oz * o + sz0 * s]);
      const y0 = A.groundAt(...anchors[0]);
      const openCache = new Map();
      const open = (x, z) => {
        const k = `${Math.round(x * 4)},${Math.round(z * 4)}`;
        let v = openCache.get(k);
        if (v === undefined) {
          v = A.solidKnown(x, z) && !A.solidAt(x, z) && !A.lowNear(x, z, 0.3) && Math.abs(A.groundAt(x, z) - y0) < 0.3;
          openCache.set(k, v);
        }
        return v;
      };
      const seen = pictureAt(anchors[0]);
      const t0 = performance.now();
      const L = layRaid({ o: S.o, frames: S.frames, shots: S.acts, anchors, face: door.face, open, seen });
      lay = { ...L, o: S.o };
      const layMs = +(performance.now() - t0).toFixed(1);
      // WHERE IT IS JOINED: LEAD s before the first shot or blow (nothing happens before it but their walk up)
      const tJoin = S.first === null ? 0 : Math.max(0, S.first - LEAD);
      while (!F.over && F.t + TICK <= tJoin + 1e-9) step(F, raidMove(F));
      let seenN = F.events.length;
      // WHO IS WHO on the stage: you, Earl (given, or made), and the crew (made here, taken off at the end)
      const aid = new Map();
      const made = [];
      let ally = null;
      for (const p of F.people) {
        if (p.side === 'you') aid.set(p.id, you);
        else if (p.side === 'ally') {
          ally = ally0 && A.has(ally0) ? ally0 : 'raid:earl';
          if (!A.has(ally)) {
            A.add({ id: ally, name: p.name, x: anchors[0][0], z: anchors[0][1], look: LOOKS.ally });
            made.push(ally);
          }
          aid.set(p.id, ally);
        } else {
          const id = `raid:${p.id}`;
          if (A.has(id)) A.remove(id);
          A.add({ id, name: p.name, x: anchors[0][0], z: anchors[0][1], look: lookOf(p, p.id) });
          made.push(id);
          aid.set(p.id, id);
        }
      }
      const aidOf = id => aid.get(id) ?? null;
      const all = [...aid.values()];
      // UNDER THE BLACK: everybody where the rules have them at the join

      const held = all.map(id => stage.director?.people?.get(id)).filter(Boolean);
      for (const P of held) {
        P.busy += 1;
        stage.director.rest?.(P.id);
      }
      const body = new Map();
      for (const p of F.people) {
        const id = aidOf(p.id);
        stage.rides?.cancel?.(id);
        A.stop(id);
        A.contact?.(id, 'raid');
        A.show?.(id, true);
        const [x, z] = W2(p.x, p.y);
        // (facing: whoever is coming, the way they come; you and Earl, the nearest of them)
        const them = F.people.filter(q => q.side !== p.side && (p.side === 'foe') !== (q.side === 'foe'));
        const n = them.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
        const [tx, tz] = n ? W2(n.x, n.y) : [x + 1, z];
        A.place(id, x, z, Math.atan2(tx - x, tz - z));
        const B = kit.owned?.get(id) ?? kit.own(id);
        B.put(x, A.groundAt(x, z), z, Math.atan2(tx - x, tz - z), 0);
        B.snapYaw?.();
        body.set(p.id, B);
      }
      G.begin();
      light = nightLight(door);
      stage.gore?.clear?.();
      fx.clear();
      // THE ROOM it is given: nobody not in it on its ground (room.js), the ground as far as the furthest of them is drawn
      let reach = 3;
      for (const Fr of S.frames) for (const p of Fr.at) if (p) {
        const [x, z] = W2(p[0], p[1]);
        reach = Math.max(reach, Math.hypot(x - L.anchor[0], z - L.anchor[1]));
      }
      const room = stage.room?.open({ c: L.anchor, r: Math.min(14, reach + 0.5), keep: all }) ?? null;
      const watch = createWatch({ city, actors: A, fade, near: (x, z) => Math.hypot(x - L.anchor[0], z - L.anchor[1]) < 32, street: y0 });
      // THE STRIP
      const foes = F.people.filter(p => p.side === 'foe');
      Y.name.textContent = ally ? 'You and Earl' : 'You';
      T.name.textContent = `${foes.length} of the Sixes`;
      Y.why.textContent = D.you?.label ?? WEAPONS[F.people[0].arm]?.name ?? '';
      T.why.textContent = D.them?.name ?? '';
      paintBars(F);
      strip.hidden = false;
      strip.dataset.result = '';
      const st = { phase: 'open', t: +F.t.toFixed(2), join: +F.t.toFixed(2), lastHit: null, layout: { anchor: L.anchor.map(v => +v.toFixed(2)), mirror: L.mirror, turn: L.turn, floor: L.floor, figures: L.figures, ms: layMs, room: L.room, ways: L.drawnWays }, expected: D.result };
      // THE MEASURES, every frame of the fight (CLEAN): two standing bodies' heads within 0.8 m (`knot`: frames with any;
      // `nearest`: the closest two heads came), bodies' middles within 0.6 m (`inside`), the most a body's heading turned in
      // one frame (`spin`, rad), the most a body was drawn moving (`fastest`, m/s), and a body drawn standing in something
      // solid (`solid`, frames)
      const clean = { frames: 0, knot: 0, nearest: 9, inside: 0, insideAt: null, spin: 0, spinAt: null, fastest: 0, fastAt: null, solid: 0, riding: 0, line: 0, lineAt: null, jumps: [] };
      const lastYaw = new Map();
      const stats = { shots: 0, hits: 0, falls: 0, blows: 0 };
      let done = null;
      const finished = new Promise(r => {
        done = r;
      });

      // ── THE FIGHT, every frame of the stage's clock ──
      const prev = new Map();
      const SLIDE = 0.22;
      const slides = new Map();
      const slideOf = (id, t) => {
        const s = slides.get(id);
        if (!s) return [0, 0];
        const u = Math.min(1, Math.max(0, (t - s.t) / SLIDE));
        if (u >= 1) {
          slides.delete(id);
          return [0, 0];
        }
        const f = 1 - u * u * (3 - 2 * u);
        return [s.ox * f, s.oy * f];
      };
      /** the last shot of each gun the light has flashed for */
      const shotSeen = new Map();
      /** where each was drawn last (world), and where the rules' own place was drawn then */
      const drawn = new Map();
      /** who bled, and the pools laid under those who stay down */
      const bled = new Set();
      const pools = new Map();
      /** sim id → { yaw, w }: each body's heading as drawn, and how fast it is turning */
      const heads = new Map();
      const person = id => F.people.find(q => q.id === id);
      function onEvent(e) {
        if (e.type === 'shot' || e.type === 'swing') {
          timing.first ??= A.clock;
          timing.last = A.clock;
          if (e.type === 'shot') stats.shots += 1;
          else stats.blows += 1;
          G.event(e, F, aidOf);
          // (THE LINE, as it left the barrel: the barrel's heading against the way from its muzzle to whoever it was at;
          // under 2.5 m the round is drawn along the barrel itself into them: gunner.js POINT, kept as `pointOff`)
          const g = e.type === 'shot' ? G.gunOf(e.id) : null;
          const to = person(e.to);
          if (g?.muzzle && to) {
            const [tx, , tz] = W(to.x, to.y, 1);
            const [mx, mz] = [tx - g.muzzle[0], tz - g.muzzle[2]];
            if (Math.hypot(mx, mz) > 2.5) {
              const off = Math.abs(wrap(Math.atan2(mx, mz) - Math.atan2(g.dir[0], g.dir[2])));
              if (off > clean.line) {
                clean.line = +off.toFixed(3);
                clean.lineAt = [e.id, e.to, e.t, +Math.hypot(mx, mz).toFixed(2)];
              }
            }
          }
        } else if (e.type === 'hit') {
          const q = person(e.id);
          const by = person(e.by);
          stats.hits += 1;
          st.lastHit = e.t;
          // (THROWN BACK, SLID NOT JUMPED: the rules put a body its whole knock back in one tick (the Doorman's a
          // metre, the chopper's a quarter); the picture slides it there over SLIDE s from where it had them, and the
          // Doorman's leaves a skid of dust)
          // (the slide itself: after the tick, for whatever moved a body further than its own step, below)
          if (prev.has(q.id)) {
            const [x0, y0p] = prev.get(q.id);
            if (e.how === 'shot' && by?.gun && WEAPONS[by.gun].cone && Math.hypot(q.x - x0, q.y - y0p) > 0.25) fx.skid(W(x0, y0p, 0.05), W(q.x, q.y, 0.05));
          }
          fx.pop(W(q.x, q.y, POP_Y), `-${e.dmg}`, q.side === 'you' ? 'you' : q.side === 'ally' ? 'ally' : 'them');
          // (THE BLOOD, and nothing that rides a body posed by hand: a mark laid on it hangs where a standing chest would
          // be, over a body that is falling or lying (gore.js A BODY POSED BY HAND). A round's spray and its splats on the
          // ground; a blow's drops off the head it landed on; a pool under whoever stays down, below)
          if (e.bleed === 'hit') stage.gore?.hit(aidOf(e.id), aidOf(e.by), { mark: false });
          else {
            const hd = G.headOf(e.id);
            stage.gore?.blow(aidOf(e.id), aidOf(e.by), 'punch', { at: hd ? [hd[0], hd[1] - 0.15, hd[2]] : W(q.x, q.y, 1.5), mark: false });
          }
          bled.add(e.id);
          if (q.side === 'you' && q.cut > 0) fx.vest(W(q.x, q.y, 1.05), Math.round((e.dmg * q.cut) / (1 - q.cut)));
          G.event(e, F, aidOf);
        } else if (e.type === 'down') {
          const q = person(e.id);
          const by = person(e.by);
          stats.falls += 1;
          G.event(e, F, aidOf);
          if (q.side === 'ally') fx.pop(W(q.x, q.y, POP_Y - 0.15), 'EARL IS DOWN', 'note');
        } else if (e.type === 'dry') {
          const me = F.people[0];
          fx.pop(W(me.x, me.y, POP_Y - 0.25), 'out of rounds', 'note');
        }
      }
      /** A heading on the fight's ground at (x, y), as a heading on the world (the ground is bent: read it locally). */
      const yawAt = (x, y, a) => {
        const [x0, z0] = W2(x, y);
        const [x1, z1] = W2(x + Math.cos(a) * 0.3, y + Math.sin(a) * 0.3);
        return Math.atan2(x1 - x0, z1 - z0);
      };
      let acc = 0;
      let Tn = F.t;
      let overAt = null;
      let ended = false;
      let skipping = false;
      let live = false;
      function frame(dt0) {
        if (!live) return;
        // (a long picture, the first after the setting up under the black, is not a jump: the fight's clock is let fall
        // behind the stage's by what is over a twentieth of a second)
        const dt = Math.min(dt0, 1 / 20);
        acc += dt;
        let n = 0;
        while (acc >= TICK && !F.over && n < 8) {
          for (const p of F.people) prev.set(p.id, [p.x, p.y]);
          step(F, raidMove(F));
          acc -= TICK;
          n += 1;
          fx.now = F.t;
          for (; seenN < F.events.length; seenN++) onEvent(F.events[seenN]);
          // (MOVED FURTHER THAN ITS OWN STEP, SLID NOT JUMPED: a knock back puts a body its whole knock away in one tick
          // (the Doorman's a metre, a big man's blow 0.6 m), and the rules' bodies shove each other apart in a tick
          // (sim.mjs apart: a big man stood on you). The picture slides it there over SLIDE s from where it had it, and
          // the tick is not eased as well: eased from the old place too, it was drawn the whole knock BEHIND where it
          // stood for the rest of the tick, then jumped (0.6 m in one picture); a shove eased over one tick was 0.2 m a
          // picture, four pictures running, at 11.3 s of the big men's raid against the Six-shot)
          for (const p of F.people) {
            const [x0, y0p] = prev.get(p.id);
            // (raidfight-3: only a move SHOVE m past its own step: begun again every tick by small shoves, a slide never
            // got anywhere and the body was drawn ever further behind; small shoves are eased over their tick)
            if (Math.hypot(p.x - x0, p.y - y0p) > Math.hypot(p.vx, p.vy) * TICK + SHOVE) {
              const [sx, sy] = slideOf(p.id, F.t);
              slides.set(p.id, { ox: x0 + sx - p.x, oy: y0p + sy - p.y, t: F.t });
              prev.set(p.id, [p.x, p.y]);
            }
          }
        }
        // (for the picture tools: held still once the rules' clock reaches window.__raidHoldAt)
        if (window.__raidHoldAt != null && F.t >= window.__raidHoldAt) {
          window.__raidHoldAt = null;
          stage.setSpeed?.(0);
        }
        if (F.over) {
          if (overAt === null) {
            overAt = A.clock;
            strip.dataset.result = F.over.result;
            st.phase = 'down';
          }
          acc = Math.min(acc, TICK);
        } else if (n) G.predict(F, raidMove);
        const a = F.over ? 1 : Math.min(1, acc / TICK);
        // (the scene's clock: the rules' while it runs; after their end it runs on, for the falls and what is in the air)
        Tn = F.over ? Math.max(Tn, F.t) + dt : F.t + acc;
        const T0 = Tn;
        // WHERE EACH IS DRAWN: the rules' place eased between two ticks, on the world; then held off one another
        const at = new Map();
        for (const p of F.people) {
          const [x0, y0p] = prev.get(p.id) ?? [p.x, p.y];
          const [sx, sy] = slideOf(p.id, T0);
          at.set(p.id, W2(x0 + (p.x - x0) * a + sx, y0p + (p.y - y0p) * a + sy));
        }
        const at0 = new Map([...at].map(([k, v]) => [k, [...v]]));
        const heldOff = G.apart(F, at, dt) ?? null;
        // (HELD OFF, NOT SHOVED: two bodies the rules bring together are eased apart, never put a metre apart in one
        // picture: the drawn place goes no faster than the rules' own move there and PUSH m/s more)
        for (const p of F.people) {
          const q = at.get(p.id);
          const was = drawn.get(p.id);
          if (was && !p.down && dt > 0) {
            const own = at0.get(p.id);
            const ownStep = own && was.own ? Math.hypot(own[0] - was.own[0], own[1] - was.own[1]) : 0;
            const most = ownStep + PUSH * Math.min(dt, 1 / 30);
            const d = Math.hypot(q[0] - was.x, q[1] - was.z);
            if (d > most) {
              q[0] = was.x + ((q[0] - was.x) / d) * most;
              q[1] = was.z + ((q[1] - was.z) / d) * most;
            }
          }
          // (for the measure: a body drawn moving over JUMP m/s this picture, and what moved it)
          if (was && !p.down && dt > 0 && Math.hypot(q[0] - was.x, q[1] - was.z) / dt > JUMP && clean.jumps.length < 6) {
            const own = at0.get(p.id);
            clean.jumps.push({ id: p.id, t: +F.t.toFixed(2), acc: +acc.toFixed(3), dt: +dt.toFixed(3), drawn: +Math.hypot(q[0] - was.x, q[1] - was.z).toFixed(3), own: was.own ? +Math.hypot(own[0] - was.own[0], own[1] - was.own[1]).toFixed(3) : null, slide: slides.has(p.id) ? { ...slides.get(p.id) } : null, held: !!heldOff?.has(p.id), rules: +Math.hypot(p.vx, p.vy).toFixed(2), T0: +T0.toFixed(3), a: +a.toFixed(2), p: [+p.x.toFixed(2), +p.y.toFixed(2)], prev: prev.get(p.id)?.map(v => +v.toFixed(2)), at: q.map(v => +v.toFixed(2)), was: [+was.x.toFixed(2), +was.z.toFixed(2)] });
          }
          drawn.set(p.id, { x: q[0], z: q[1], own: at0.get(p.id) });
        }
        for (const p of F.people) {
          const B = body.get(p.id);
          const [x, z] = at.get(p.id);
          // (the legs at the pace the body is drawn moving: the rules' speed, as the bent ground has it there)
          let v = 0;
          if (!p.down) {
            const sp = Math.hypot(p.vx, p.vy);
            if (sp > 0.01) {
              const [ax0, az0] = W2(p.x, p.y);
              const [ax1, az1] = W2(p.x + (p.vx / sp) * 0.3, p.y + (p.vy / sp) * 0.3);
              v = (sp * Math.hypot(ax1 - ax0, az1 - az0)) / 0.3;
            }
            v = heldOff?.has(p.id) ? Math.min(v, heldOff.get(p.id)) : G.paceOf(p, v);
          }
          // THE HEADING, turned here at a body's pace (the walker's own easing is held off: snapYaw): 3.4 rad/s taken up
          // over a fifth of a second; a gun to be brought round on somebody well off it, a quick pivot (9 rad/s), never
          // in one picture. One going down keeps the heading it had: the fall itself turns it away from whoever
          // dropped it (guns.js DROPS away)
          const Qh = A.get(aidOf(p.id));
          const Hd = heads.get(p.id) ?? { yaw: Qh.w?.yawS ?? Qh.ry, w: 0 };
          heads.set(p.id, Hd);
          // (a gun brought round at its shot by the gun bodies themselves, when nothing else could bring the barrel onto
          // them: taken as it is, not turned back the next picture)
          const now_ = Qh.w?.yawS ?? Qh.ry;
          if (Math.abs(wrap(now_ - Hd.yaw)) > 0.25) {
            Hd.yaw = now_;
            Hd.w = 0;
          }
          if (!p.down) {
            let f = G.faceOf(p) ?? p.face;
            // (A GUN IN ONE HAND squares up to whoever it fires at next, a moment before: its arm's swing is short, and
            // turned off them by its legs' own reckoning (the two shooters, one each side) it reached 105 degrees round
            // and threw its holder the rest of the way at the shot)
            const nx = p.gun && p.arm === p.gun && (GUNS[GUN_OF[p.gun] ?? 'pistol']?.hands ?? 1) === 1 ? G.nextShotOf(p.id) : null;
            const nq = nx && nx.t - F.t < SQUARE ? person(nx.to) : null;
            if (nq && !nq.down) f = Math.atan2(nq.y - p.y, nq.x - p.x);
            const d = wrap(yawAt(p.x, p.y, f) - Hd.yaw);
            const quick = !!p.gun && p.arm === p.gun && Math.abs(d) > 0.5;
            const [most, acc_] = quick ? TURN.quick : TURN.walk;
            const want = Math.sign(d) * Math.min(most, Math.sqrt(2 * acc_ * Math.abs(d)) * 0.9);
            const dtt = Math.min(dt, 1 / 45);
            Hd.w += Math.max(-acc_ * dtt, Math.min(acc_ * dtt, want - Hd.w));
            const step_ = Hd.w * dtt;
            Hd.yaw = Math.abs(step_) > Math.abs(d) && Math.sign(step_) === Math.sign(d) ? Hd.yaw + d : wrap(Hd.yaw + step_);
            if (Math.abs(step_) > Math.abs(d)) Hd.w = 0;
          } else Hd.w = 0;
          B.put(x, A.groundAt(x, z), z, Hd.yaw, v);
          B.snapYaw?.();
        }
        G.frame(F, T0, dt, aidOf);
        // (BY NIGHT: the pool over all of them, a flash at every muzzle that fired since the last picture)
        if (light) {
          for (const p of F.people) {
            const at_ = G.shotOf(p.id);
            if (at_ !== null && at_ !== shotSeen.get(p.id)) {
              shotSeen.set(p.id, at_);
              if (at_ > -1) light.flash(G.gunOf(p.id)?.muzzle, G.gunOf(p.id)?.dir);
            }
          }
          // (the flash lit in the very picture its round is fired in)
          light.frame(F.people.map(p => {
            const Q = A.get(aidOf(p.id));
            return [Q.x, Q.y, Q.z];
          }), dt);
          st.flash = light.flashNow;
        }
        // (down a moment and bled: a pool spreads under the head where it lies)
        for (const p of F.people) {
          if (!p.down || !bled.has(p.id) || pools.has(p.id)) continue;
          const dn = p.downAt ?? null;
          const hd = G.headOf(p.id);
          if (dn !== null && T0 - dn > 1.1 && hd) pools.set(p.id, stage.gore?.pool?.(hd[0], A.groundAt(hd[0], hd[2]), hd[2]) ?? null);
        }
        paintBars(F);
        st.t = +T0.toFixed(2);
        measure(dt);
        // THE END: HOLD s on it, then the black
        if (overAt !== null && A.clock - overAt >= HOLD) end(false);
      }
      function measure(dt) {
        if (dt <= 0) return;
        clean.frames += 1;
        const up = F.people.filter(p => !p.down);
        let knot = false;
        for (let i = 0; i < up.length; i++) {
          const a = G.headOf(up[i].id);
          const Qa = A.get(aidOf(up[i].id));
          for (let j = i + 1; j < up.length; j++) {
            const b = G.headOf(up[j].id);
            const Qb = A.get(aidOf(up[j].id));
            if (a && b) {
              const d = Math.hypot(a[0] - b[0], a[2] - b[2]);
              clean.nearest = Math.min(clean.nearest, +d.toFixed(2));
              if (d < 0.8) knot = true;
            }
            if (Math.hypot(Qa.x - Qb.x, Qa.z - Qb.z) < 0.6) {
              clean.inside += 1;
              clean.insideAt ??= [up[i].id, up[j].id, st.t];
            }
          }
        }
        if (knot) clean.knot += 1;
        // (any blood riding one of them: none should, they are posed by hand)
        if (clean.frames % 6 === 0) {
          const ours = new Set(all);
          clean.riding = Math.max(clean.riding, (stage.gore?.riding?.() ?? []).filter(r => ours.has(r.id)).length);
        }
        for (const p of F.people) {
          const Q = A.get(aidOf(p.id));
          const yaw = Q.w?.yawS ?? Q.ry;
          const was = lastYaw.get(p.id);
          if (was && !p.down) {
            const turn = Math.abs(wrap(yaw - was[0]));
            if (turn > clean.spin) {
              clean.spin = +turn.toFixed(3);
              clean.spinAt = [p.id, st.t];
            }
            const sp = +(Math.hypot(Q.x - was[1], Q.z - was[2]) / dt).toFixed(2);
            if (sp > clean.fastest) {
              clean.fastest = sp;
              clean.fastAt = [p.id, st.t, +(Q.x - was[1]).toFixed(2), +(Q.z - was[2]).toFixed(2), +dt.toFixed(3), +Math.hypot(p.vx, p.vy).toFixed(2)];
            }
          }
          lastYaw.set(p.id, [yaw, Q.x, Q.z]);
          if (!p.down && !open(Q.x, Q.z)) clean.solid += 1;
        }
      }
      // (raidfight-5: THE SCENE THREW. Said once, loud, and ended as a skip ends it: under the black, everything taken
      // off, the light put back. A frame hook that throws is otherwise only noted by the stage and called again: the
      // scene would never reach its end, and the dusk would stay. `window.__raidThrowAt` (the rules' clock): a throw
      // asked for by the tools, to see it put back)
      let threw = null;
      let left = false;
      const off = A.onFrame(dt => {
        if (ended || skipping) return;
        try {
          if (window.__raidThrowAt != null && F.t >= window.__raidThrowAt) {
            window.__raidThrowAt = null;
            throw new Error('a throw asked for by the tools (__raidThrowAt)');
          }
          frame(dt);
        } catch (err) {
          threw = String(err?.message ?? err).slice(0, 300);
          console.error('[raid] the scene threw: ended, the light put back:', err);
          void end(true);
        }
      });
      // (the page going away with the scene up: put back at once)
      const onLeave = () => cur?.leave();
      addEventListener('pagehide', onLeave);
      const raf = () => {
        if (ended) return;
        requestAnimationFrame(raf);
        fx.now = Tn;
        fx.draw({ people: [] });
        watch.step(live ? st.t : null);
      };
      requestAnimationFrame(raf);

      async function end(skipped) {
        if (ended) return;
        ended = true;
        off();
        removeEventListener('pagehide', onLeave);
        st.phase = 'after';
        let rec = null;
        try {
          // (left: the page is going, nothing waits for a black)
          if (fade && !fade.dark && !left) await fade.out();
          watch.cut();
          const crowd = room?.figures?.() ?? null;
          room?.close();
          for (const id of all) {
            const Q = A.get(id);
            kit.owned?.get(id)?.release(Q ? A.groundAt(Q.x, Q.z) : null);
            A.setRate?.(id, 1);
            A.contact?.(id, null);
          }
          G.clear();
          for (const id of made) if (A.has(id)) A.remove(id);
          for (const P of held) P.busy = Math.max(0, P.busy - 1);
          light?.done();
          for (const P of pools.values()) P?.dry?.();
          stage.gore?.clear?.();
          strip.hidden = true;
          fx.clear();
          fx.draw(null);
          timing.back = A.clock;
          const open_ = timing.first !== null ? +(timing.first - timing.called).toFixed(2) : null;
          const close = !skipped && timing.last !== null ? +(timing.back - timing.last).toFixed(2) : null;
          const slow = [];
          if (open_ !== null && open_ > RAID_PACE.open) slow.push(`the first shot or blow came ${open_} s after the raid was called (over ${RAID_PACE.open} s)`);
          if (close !== null && close > RAID_PACE.close) slow.push(`control came back ${close} s after the last (over ${RAID_PACE.close} s)`);
          const crew = D.them?.crew ?? null;
          rec = {
            result: D.result, seen: F.over?.result ?? null, mismatch: !!F.over && F.over.result !== D.result, scriptSaid: S.over.result, skipped,
            crew, n: foes.length, hold: F.people[0].gun ?? F.people[0].arm, earl: !!ally, seconds: S.over.t, join: st.join, firstAt: S.first, lastAt: S.last,
            open: open_, close, slow, stageSeconds: +(timing.back - timing.called).toFixed(2), layout: st.layout, frames: watch.report(), crowd,
            clean: { ...clean, knotShare: clean.frames ? +(clean.knot / clean.frames).toFixed(3) : 0 },
            anim: { ...stats, pointOff: G.stats.pointOff ?? null, roundsCut: G.stats.roundsCut ?? 0, offLine: G.stats.offLine ?? null, whipped: G.stats.whipped ?? 0, whips: G.stats.whips?.slice() ?? [], rounds: G.stats.rounds ?? 0, burstOff: G.stats.burstOff ?? null, onTime: G.stats.onTime, late: G.stats.late },
          };
          if (rec.mismatch) console.error(`[raid] the raid seen ended ${F.over.result}, the rules said ${D.result} (seed ${D.seed})`);
        } catch (err) {
          threw ??= String(err?.message ?? err).slice(0, 300);
          console.error('[raid] the scene did not end cleanly (the light is put back all the same):', err);
        } finally {
          // (whatever happened above: the light, and with it the stage's clock, as it was before the raid)
          try {
            light?.done();
          } catch (e) {
            console.error('[raid] the light could not be put back:', e);
          }
          strip.hidden = true;
        }
        rec ??= { result: D.result, seen: null, mismatch: false, skipped: true, crew: D.them?.crew ?? null, slow: [] };
        Object.assign(rec, { threw, left, light: light ? { look: light.look, clock: light.clock } : null });
        log.push(rec);
        cur = null;
        lay = null;
        // (for the picture tools: the yard once everything of the raid's is off it and the light is back, under the black)
        if (typeof window.__raidWait === 'function' && !left) await Promise.resolve(window.__raidWait('after', lightNow())).catch(() => {});
        if (fade && !dark && !left) fade.in();
        done(rec);
      }

      cur = {
        async skip() {
          if (ended || skipping) return;
          skipping = true;
          try {
            if (fade && !fade.dark) await fade.out();
            watch.cut();
            while (!F.over) step(F, raidMove(F));
          } catch (err) {
            threw ??= String(err?.message ?? err).slice(0, 300);
            console.error('[raid] the skip threw: ended, the light put back:', err);
          }
          await end(true);
        },
        /** The page leaves the scene (the fight page taken off, the run stopped, the page hidden): ended at once, put back. */
        leave() {
          if (ended) return;
          left = true;
          void end(true);
        },
        st,
      };
      // THE BLACK LIFTS on them coming; the rules' clock runs from now
      watch.cut();
      live = true;
      st.phase = 'fight';
      if (fade) fade.in();
      return finished;
    }
  }

  return {
    play,
    skip: () => cur?.skip(),
    /** (raidfight-5) The page leaves the scene: it ends at once, everything put back, the light and the clock first. */
    leave: () => cur?.leave(),
    get active() {
      return !!cur;
    },
    get state() {
      return cur ? { ...cur.st } : null;
    },
    log,
    get skipButton() {
      return strip.hidden ? null : skipBtn;
    },
  };
}
