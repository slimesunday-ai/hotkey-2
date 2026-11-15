// THE RUN, PLAYABLE IN THE PAGE (RUN.md): /demo/?mode=run&seed=N. The run's engine (src/run/) decides everything;
// these panels draw its view and send the choice, and the stage plays what happened in the city.
//
//   mountRun(host, { stage, seed?, speed?, pilot?, scenes?, onStep?, onError? })
//
// THE FRAME (the owner, 11-13: "it feels so disjointed, random floating ... the ui just needs to be assembled better
// and feel cohesive with collapsible and openable panels"). One assembled thing in the kit's zte paper (demo/hud/hud.css,
// the kit's dossier: city/from-trunk/style/city/ui/dossier.js), with the same edges, gutters and ink everywhere:
//   · the top line, the window's width: the run, the clock, the day, where you are, the line's stops, a new run
//   · THE DOCK, on the left, everything about you: a head with your own figure (the character sheet behind it),
//     CARRIED (at risk, loud), BANKED (safe, quiet), energy, heat, what you own, the next goal; under it the panel
//     keys. It folds to a slim rail that still shows what you carry and your heat (D, or its button; kept in this
//     browser), and starts folded. Open, it is only as tall as what is in it. At phone width, a strip under the top line
//   · THE BAR (the move card), along the bottom from the dock to the edge, THIN (the owner, 11-13: "i like the bar it's
//     just massive"; GTA V's size of type): the danger of one more hour here is a line along its top edge, its number
//     at the start; then the choices, each option one main line (its number, name, pay, odds) and one small line (who
//     it is done to with their mood, what failing costs); then one slim row: what just happened (it shows when the
//     hour ends and goes when the next choice is picked, or after eight seconds, in the same room), the ways to move
//     and Go. F (or its button) folds it to that one row, kept in this browser. While an hour plays it is that row
//   · THE PANELS, one at a time, opened beside the dock over the picture (which does not make way for them):
//     Character C, All moves A, Stuff S (demo/run/panels.js), and the Map M: the kit's own paper map of the island,
//     the player on it and the run's three stops (demo/run/map.js). Esc closes (a card on the map first). They only show
//   · over everything when it comes: the held card (taken to the jail or the clinic), the day's report, done in N days
// Keys: 1 2 3 the options (any number: that choice), H home, Enter to confirm, Space (or Enter) skips a scene; C A S M
// the panels, D the dock, F the bar. ONE RULE FOR THE NUMBERS: they and Enter always choose on the bar, with a panel
// open (the bar is never under a panel; the panel only shows) and with the bar folded (a number picks, and the folded
// row names the pick with its pay and odds; every option's pay and odds stay on that row).
// THE WORLD ANSWERS (RUN.md rules-2): R rob somebody passing, B the bins, E the place's shop (the energy drink), Z sleep
// rough, G give the regular at your door what they ask, X shut the door on them: each picks on the bar as a number
// does, and the same letter again goes. An option's number again (or T) picks its next target, shown on its own line.
// The row of moves keeps the essentials (the ways on, rob, the bins); the drink and sleeping rough join it when you are
// spent, lead the bar when you are stranded, and are always in the All moves panel with their keys. The heat HERE is
// under the danger's number (POLICE where they are about), in words on the row when the place is hot, on the top
// line's stops and the map's.
// TRUST (RUN.md trust-1), all in the page's own paper, no scene of its own: a mark by every person's name (▲ with you,
// ▼ against you; neutral quiet), on an option's line with what being with you adds to the pay; the chance of being
// told on and by whom, as the odds are shown, on a crime's card, Rob and Bins; after a move, the trust change, the
// witness's roll (called in, bad; kept quiet, luck) and the heat that landed on the top line's stop and the map's;
// the night's drift in the report when someone changed band; a call to the police elsewhere as a notice under the
// top line with what to do about it. The People tab of the character panel (C) lists everybody's trust.
// No rule lives here: every number drawn is the view's, every choice is one of the view's choices.
//
// `pilot(v, state)` answers for the player (the auto-play test): it returns a choice, and every card is pressed on.

import { h, fill, ensureStyles, makeRoot, barEl } from '../hud/dom.js';
import { tabs as kitTabs } from '../../city/from-trunk/style/city/ui/kit.js';
import { RUN_CONFIG, newRun, view, step, checkRunBooks } from '../../src/run/index.mjs';
import { YOU, stageGame, lineOf as lineAt, endOf } from './scenes.js';
import { scenesOf, binsOf, STEP, FAR_IN } from './acted.js';
import { characterStats, characterWearing, characterPeople, movesBody, stuffBody, lineNote, stopFlag, stopBody, stopOf, STOP_NAME, hookedShort, hookedText, trustMark, trustTitle, tellEl, signedT } from './panels.js';
// (the door's answer as the rules will have it: refusing from with you is sore, not a grudge. Read only, as panels.js does)
import { trustAfter, trustBand } from '../../src/run/rules.mjs';
import { createRunMap } from './map.js';

const CSS = new URL('./run.css', import.meta.url).href;
const KIT = new URL('../../city/from-trunk/style/city/', import.meta.url).href;
const money = n => `$${n}`;
const range = ([lo, hi]) => (lo === hi ? money(lo) : `$${lo}–${hi}`);
const kbd = key => h('kbd', null, key);
/** This browser's memory of the dock (folded or open), the bar (folded or open) and the character sheet's tab; the page works without it. */
const kept = {
  get(k) {
    try {
      return localStorage.getItem(`hk2.run.${k}`);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(`hk2.run.${k}`, v);
    } catch {}
  },
};
/** THE PANELS, in the order of their keys on the dock. */
const SHEETS = [
  { id: 'character', key: 'C', label: 'Character', short: 'You', title: 'Character' },
  { id: 'moves', key: 'A', label: 'All moves', short: 'Moves', title: 'Every move there is' },
  { id: 'stuff', key: 'S', label: 'Stuff', short: 'Stuff', title: 'Stuff: everything to buy' },
  { id: 'map', key: 'M', label: 'Map', short: 'Map', title: 'The map' },
];
/** The player's figure as the stage rolls it (stage/index.js: an agent's look is seeded `agent:<name>`, the agents' pool). */
const handleOf = name => `agent:${name}`;
const fnv = s => {
  let x = 2166136261;
  for (let k = 0; k < s.length; k++) x = Math.imul(x ^ s.charCodeAt(k), 16777619);
  return x >>> 0;
};

export function mountRun(host, opts = {}) {
  const { stage } = opts;
  if (!stage) throw new Error('mountRun needs a stage');
  ensureStyles();
  if (!document.querySelector('link[data-rn-css]')) document.head.append(h('link', { rel: 'stylesheet', href: CSS, 'data-rn-css': '' }));
  const root = makeRoot(host);
  root.classList.add('rn');
  const cfg = RUN_CONFIG;
  // what happened, acted out (demo/run/acted.js). `scenes: false` (?scenes=0) is the stage of step A: the player is
  // only put in the right place
  const actedOf = opts.scenes === false ? () => null : events => scenesOf(events);
  const speed = [1, 2, 4].includes(Number(opts.speed)) ? Number(opts.speed) : 1;

  // (the stage measures the panels it makes way for: `.hk-top`, `.hk-left > *` and `.hk-move-card`, stage/index.js
  // fitToPanels and stage/inside.js freeRect. The open panel is none of those: the picture does not make way for it)
  const el = {
    top: h('header', { class: 'hk-top hk-panel rn-top' }),
    left: h('div', { class: 'hk-left rn-left' }),
    card: h('section', { class: 'hk-move-card hk-panel rn-card', 'aria-label': 'Your move' }),
    overlay: h('div', { class: 'hk-overlay' }),
    toasts: h('div', { class: 'hk-toasts', role: 'status' }),
    sheet: h('section', { class: 'rn-sheet', role: 'dialog', hidden: true }),
    // the danger's small print: a slip over the bar's start (the bar keeps its height)
    print: h('div', { class: 'rn-print', role: 'note', hidden: true }),
    // NEWS FROM ELSEWHERE (trust-1): a call to the police at a place you are not standing in (a regular you shut the
    // door on calls them round where he lives), with what to do about it. One small slip under the top line, on the
    // right, until it is put away (×) or the day ends. Not one of the panels the stage makes way for
    notice: h('div', { class: 'rn-notice', role: 'status', hidden: true }),
  };
  const dock = h('section', { class: 'hk-panel rn-dock', 'aria-label': 'You' });
  const cardBody = h('div', { class: 'rn-card-body' });
  el.left.append(dock);
  // (the panel after the card: at phone width it is a sheet from the bottom over it; the day's report over both)
  root.append(el.top, el.notice, el.left, el.card, el.print, el.sheet, el.overlay, el.toasts);

  const game = stageGame();

  // ── THE MOOD, SEEN AND KEPT: a small mark over the head of anyone not calm, for the rest of the day (the owner: "should
  // his emotion change and his head be steaming or something like hes mad at you"). Sour steams, wary watches,
  // friendly is warm; nothing on "does not know yet". From the view's own people (the one the panels hold while an
  // hour plays, so the mark comes with the reveal); the morning's calm takes them away.
  // (and cold, rules-2: seen you in the bins and thinks less of you: a grey mark, eyes down)
  const MARKS = new Set(['sour', 'wary', 'friendly', 'cold']);
  const marks = new Map();
  const markLayer = h('div', { class: 'rn-marks', 'aria-hidden': 'true' });
  root.prepend(markLayer);
  const markEl = mood => h('span', { class: `rn-mark is-${mood}` }, mood === 'sour' ? [h('i'), h('i'), h('i'), h('b', null, '!')] : mood === 'wary' ? h('b') : mood === 'cold' ? h('b', null, '\u2193') : h('b', null, '\u2665'));
  function tickMarks() {
    const v = S.hold?.v ?? S.v;
    const want = new Map((v?.people ?? []).filter(p => MARKS.has(p.mood)).map(p => [p.id, p.mood]));
    for (const [id, m] of marks) {
      if (want.get(id) === m.mood) continue;
      m.el.remove();
      marks.delete(id);
    }
    for (const [id, mood] of want) {
      let m = marks.get(id);
      if (!m) {
        m = { mood, el: markEl(mood) };
        markLayer.append(m.el);
        marks.set(id, m);
      }
      const at = stage.screenOf?.(id);
      m.el.hidden = !at?.visible;
      if (at?.visible) m.el.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y - 4)}px)`;
    }
    if (!S.dead) requestAnimationFrame(tickMarks);
  }
  requestAnimationFrame(tickMarks);
  /** Whoever is wary of you and out for the day stands apart turned to you. */
  function watchers() {
    const A = stage.actors;
    if (!A?.has(YOU)) return;
    const me = A.get(YOU);
    for (const p of S.v.people) if (p.here && p.outToday && p.mood === 'wary' && A.has(p.id)) A.face(p.id, me.x, me.z);
  }
  const S = {
    state: newRun({ seed: Number(opts.seed) || 1, cfg }),
    v: null, sel: null, take: 0, phase: 'start', result: null, t: 0, playing: null, line: null, skipped: false,
    resolve: null, dayStart: null, steps: 0, dead: false, hold: null, resultGone: false, resultT: null,
  };
  // (`kit`: things owned from the start, for the auto-play's tools: autoplay.js &kit=; a day's full energy with them)
  if (opts.kit && Object.keys(opts.kit).length) {
    S.state.owned = { ...S.state.owned, ...opts.kit };
    S.state.energy = S.state.owned.bed ? cfg.energy.bed : cfg.energy.mattress;
  }
  S.v = view(cfg, S.state);
  S.dayStart = ledgerOf(S.state);
  // (every hour the stage plays knows the people as the view has them after the step: who has left for the day, who
  // stands apart and watches. scenes.js presence)
  const lineOf = (o, door = null) => peopleOn(lineAt({ ...o, people: S.v?.people ?? [] }), door);
  // THE BINS ARE REAL ONES: the place table's trashcans and dumpsters become spots of the stage's blocks (acted.js)
  binsOf(stage.map);
  /**
   * Two things the new events need of where people stand, laid over the hour's line (scenes.js presence is not
   * changed for them): whoever thinks less of you (seen you in the bins) keeps their back to you; and a regular at
   * your door (`door`: the view's) stands at the foot of your step, shaking, facing the door, for as long as he is there.
   */
  const EXTRA = /^npc:(passer:\d+|robber[12]|police1)$/;
  function peopleOn(line, door) {
    const cold = new Set((S.v?.people ?? []).filter(p => p.mood === 'cold').map(p => p.id));
    let at = null;
    for (const [block, list] of Object.entries(line.npcs ?? {})) {
      for (const n of list) {
        if (cold.has(n.id) && !n.face && !n.back) n.back = YOU;
        if (door && n.id === door.id) at = [block, n];
        // (the trailer park has no sidewalk of the city's: its way in is its own middle, in the picture. Whoever comes
        // on for a scene there, somebody passing, the Dunn brothers, an officer, comes along Elm St by the bus stop,
        // where the city's own passers-by walk, and walks in from there. director.js wings, travel.js wayIn)
        if (FAR_IN.has(block) && EXTRA.test(n.id) && n.spot === 'street') n.spot = 'bus';
      }
    }
    if (door) {
      const n = at?.[1] ?? { id: door.id, role: 'buyer' };
      if (at && at[0] !== 'projects') line.npcs[at[0]] = line.npcs[at[0]].filter(q => q !== n);
      if (!at || at[0] !== 'projects') (line.npcs.projects ??= []).push(n);
      // (given what he asked, he is calm: he stays for the hand-over, and goes)
      Object.assign(n, { spot: STEP, action: 'chore', clips: door.calm ? ['listen_nod'] : ['withdrawal_shake'], face: YOU, back: null });
    }
    return line;
  }
  // (the audit's notes say when: actors.js `vanish`)
  if (stage.actors) stage.actors.noteAt = () => `day ${S.state.day} ${S.state.hour}:00 ${S.phase}`;

  // ── the stage ───────────────────────────────────────────────────────────────────────────────────────────────────
  /** Plays one hour on the stage: where the run's state has the player now, and (step B) what happened, acted out. */
  async function playOn(line, { instant = false, hurried = false } = {}) {
    S.t += 1;
    line.t = S.t;
    for (const e of line.events) {
      e.t = S.t;
      if (e.stage) e.stage.t = S.t;
    }
    // the stage reads the game's own word on who is held at the end of this very hour (stage/index.js heldNow)
    const a = line.agents[YOU];
    Object.assign(game.state.agents[YOU], { block: a.block, state: a.state });
    game.state.t = S.t + 1;
    stage.setClock({ day: line.day, hour: line.hour });
    S.line = line;
    S.skipped = false;
    const seen = line.events.filter(e => e.kind !== 'move');
    const p = Promise.resolve().then(() => stage.playHour(line, { seen, speed: instant ? 1000 : speed, hurried })).catch(err => console.warn('[run] the stage dropped an hour:', err));
    S.playing = p;
    await p;
    if (S.playing === p) S.playing = null;
    watchers();
  }

  /**
   * AN HOUR SETTLED AT ONCE IS A CUT OF THE WHOLE PICTURE: through black, a third of a second each way (the stage's
   * own fade, travel.js), so nobody is seen put on, taken off or moved where they stand. The skip, the morning, the
   * wake at the crib, a state loaded by the tools. A trip already black is its own cut.
   */
  async function dipped(fn) {
    const fade = stage.travel?.fade;
    const dip = !!fade && !fade.dark;
    if (dip) await fade.out();
    try {
      return await fn();
    } finally {
      if (dip) fade.in();
    }
  }
  /** SPACE: what is playing ends at once. A trip is the stage's own skip; a scene is dropped and everyone put where the hour leaves them. */
  async function skip() {
    if (stage.travelling) return void stage.skipTravel();
    if (!S.playing || S.skipped) return;
    S.skipped = true;
    const p = S.playing;
    await dipped(async () => {
      stage.director.abort();
      // (a step already under way, a clip or a walk, runs out fast; then the hour is settled at once)
      stage.setSpeed(6);
      await p;
      stage.setSpeed(speed);
      if (stage.travelling) stage.skipTravel();
      await stage.playHour(S.line, { seen: [], speed: 1000 }).catch(err => console.warn('[run] the skip did not settle:', err));
    });
  }

  // ── the ride home lands a little up the lane from the trailer ────────────────────────────────────────────────────
  // The trip's two halves are the stage's (travel.js); for the run's ride home only, the arrival is the plain cut
  // (travel.js walk: a placement, `actor.landAt`) to a point ten to fifteen metres from the trailer's step on the side
  // the subway lies, on open ground with a way over it to the step. The departure and the carriage are the subway's.
  function landing() {
    const step = stage.doorway?.step(`pad:${YOU}`);
    const A = stage.actors;
    if (!step) return null;
    // (on the walkers' lane, ten to fifteen metres along it from the step: not in a neighbour's yard)
    const clear = (x, z) => A.solidKnown(x, z) && !A.solidAt(x, z) && !A.lowNear(x, z, 0.6) && A.groundWay(x, z, step[0], step[1]) !== null;
    for (const d of [12, -12, 14, -14, 10, -10, 15, -15]) {
      const [x, z] = A.laneAlong(step[0], step[1], d);
      if (Math.hypot(x - step[0], z - step[1]) > 8 && (A.laneDistance(x, z) ?? 9) < 1.2 && clear(x, z)) return [x, z, Math.atan2(step[0] - x, step[1] - z)];
    }
    const sub = stage.map.PLACES.projects?.ways?.subway;
    const u0 = sub ? Math.atan2(sub.x - step[0], sub.z - step[1]) : 0;
    for (const d of [12, 14, 10, 15]) {
      for (const turn of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6]) {
        const [x, z] = [step[0] + Math.sin(u0 + turn) * d, step[1] + Math.cos(u0 + turn) * d];
        if (!A.solidKnown(x, z) || A.solidAt(x, z)) continue;
        if (A.groundWay(x, z, step[0], step[1]) === null) continue;
        return [x, z, Math.atan2(step[0] - x, step[1] - z)];
      }
    }
    return null;
  }
  // (a local who leaves for the day, or comes back in the morning, goes on foot: not on a scooter)
  if (stage.travel?.choose && !stage.travel._runFoot) {
    const choose0 = stage.travel.choose;
    stage.travel._runFoot = true;
    // ('foot': the ride on foot, watched until they are out of the picture. Not 'walk', the plain cut)
    stage.travel.choose = trip => (String(trip.actor?.id).startsWith('npc:') && !trip.actor.taken && stage.travel.rides ? 'foot' : choose0(trip));
  }
  if (stage.travel?.arrive && !stage.travel._runHome) {
    const arrive0 = stage.travel.arrive;
    stage.travel._runHome = true;
    stage.travel.arrive = (actor, o) => {
      if (S.homeward && actor.lead && o.at === 'projects') {
        const at = landing();
        if (at) {
          actor.landAt = at;
          return arrive0(actor, { ...o, mode: 'walk' });
        }
      }
      return arrive0(actor, o);
    };
  }

  // ── the loop ────────────────────────────────────────────────────────────────────────────────────────────────────
  async function start() {
    // the crib from the starter pack, and the city before it (demo/stage/opening.js): not on auto, not with no scenes
    const opened = await stage.openRun?.({ you: YOU, owned: () => S.state.owned, opening: !opts.pilot && opts.scenes !== false });
    stage.begin({ game, you: YOU, mode: 'play' });
    stage.markPlayer?.(YOU);
    stage.setSpeed(speed);
    const home = () => lineOf({ day: S.state.day, hour: S.state.hour, place: 'crib' });
    if (opened?.walkIn && stage.walkIn) {
      // THE OPENING (the owner: "your character walking into the trailer with the cut scene like what happens in the
      // normal game"): everyone is put with the player OUTSIDE, in the trailer park, under the stage's black; then
      // the camera comes down to them as they walk home and in, which is this page's own going inside
      await playOn(lineOf({ day: S.state.day, hour: S.state.hour, place: 'projects' }), { instant: true });
      // (it is an hour playing as any other: Space or Enter is this page's own skip of it)
      S.phase = 'playing';
      await stage.walkIn({ you: YOU, go: () => playOn(home()) });
    } else {
      // wake at the crib: put there at once
      await dipped(() => playOn(home(), { instant: true }));
    }
    while (!S.dead) {
      S.v = view(cfg, S.state);
      S.phase = 'choose';
      S.sel = wayOnKey(S.v);
      // (each hour's options are dealt anew: their targets start at the one dealt)
      S.targets = {};
      paint();
      const choice = await ask();
      if (S.dead) return;
      await act(choice);
    }
  }

  function ask() {
    return new Promise(resolve => {
      S.resolve = resolve;
      const answer = opts.pilot?.(S.v, S.state);
      if (answer) setTimeout(() => S.resolve === resolve && send(answer), 120);
    });
  }

  /** Sends a choice: the engine's step, the panels at once, then the stage. */
  function send(choice) {
    if (!S.resolve) return;
    const r = S.resolve;
    S.resolve = null;
    r(choice);
  }

  /** The choices whose outcome waits for their scene (the reveal), the ones played as work, and the door's events. */
  const HOLDS = new Set(['job', 'subway', 'inside', 'out', 'rob', 'bins', 'shop', 'rough', 'give', 'refuse']);
  const WORKS = new Set(['job', 'rob', 'bins']);
  // (sore, trust-1: one who was with you, refused, goes off sore with no grudge: played at the door as the others)
  const DOOR_TYPES = new Set(['gave', 'refused', 'fight', 'grudge', 'sore']);
  const hourOf = s => ({ day: s.day, hour: s.hour });

  async function act(choice) {
    const before = S.state;
    let { state, events } = step(cfg, before, choice);
    // HOME FROM THE MARKET, ALL THE WAY IN (the coordinator's ruling, flagged to the owner as such): in the trailer park
    // nobody acts on you, so there is nothing to decide between the ride and the door. The page sends `inside` itself
    // (the engine untouched), the ride's cut puts you a little up the lane from your trailer, and you walk to your
    // door and in. What came home is banked; you can step out again for nothing
    const home = choice.do === 'subway' && choice.to === 'park' && state.place === 'park';
    if (home) {
      const r = step(cfg, state, { do: 'inside' });
      state = r.state;
      events = [...events, ...r.events.map(e => (e.type === 'bank' ? { ...e, text: `You made it home and banked $${e.money[0].amount}.` } : e.type === 'inside' ? { ...e, text: 'You made it home.' } : e))];
    }
    if (!checkRunBooks(state).ok) throw new Error('the run\'s books do not balance');
    S.state = state;
    S.v = view(cfg, state);
    S.steps += 1;
    S.result = resultOf(events, before);
    // (trust-1: the heat that landed on each place this step, shown by its heat on the top line and the map while what
    // just happened is said; and a call to the police somewhere you are not, kept as the notice under the top line)
    const was = Object.fromEntries((view(cfg, before).places ?? []).map(p => [p.place, p.heat]));
    S.rose = Object.fromEntries((S.v.places ?? []).filter(p => p.heat > (was[p.place] ?? 0)).map(p => [p.place, p.heat - (was[p.place] ?? 0)]));
    const told = events.find(e => e.notice);
    if (told) S.notice = { ...told.notice, day: state.day, who: told.who?.name ?? null };
    // (what just happened is new: it shows when the hour has played, until the next pick or eight seconds)
    clearTimeout(S.resultT);
    S.resultT = null;
    S.resultGone = false;
    // (taken to the jail or the clinic: the top line says where it happened until the cut there)
    S.taken = (state.place === 'jail' || state.place === 'clinic') && before.place !== state.place ? view(cfg, before).placeLabel : null;
    // THE REVEAL WAITS FOR THE SCENE: while the hour plays, the panels still say what you went in with and what you
    // are doing. How it went, the money and the meter land when it has played out (or is skipped). Told at once, the
    // scene was only a wait for something already read. Nothing to play (a purchase, ?scenes=0): at once, as before
    S.hold = opts.scenes !== false && HOLDS.has(choice.do) ? { v: view(cfg, before), state: before, doing: doingOf(choice, view(cfg, before)) } : null;
    S.phase = 'playing';
    paint();
    opts.onStep?.({ choice, events, state, before });
    const dayOver = events.some(e => e.type === 'morning' || e.type === 'released');
    // A REGULAR WAS AT THE DOOR: given, or refused (shut on him, walked out past him, slept past him), and the fight
    // or the grudge that follows. Played at the door, with him standing at the foot of the step while it lasts
    const atDoor = events.filter(e => DOOR_TYPES.has(e.type));
    const doorWho = before.door ? { id: before.door.id } : null;
    if (choice.do === 'buy') {
      // (bought at the crib: nothing to play)
    } else if (choice.do === 'sleep') {
      // (the door shut on him on the way to bed: that first, at the door)
      if (atDoor.length && opts.scenes !== false) await playOn(lineOf({ ...hourOf(before), place: 'crib', staged: actedOf(atDoor), verb: 'move' }, doorWho));
      // TO BED: across the room to the bed the room has and onto it (doorway.js, the city's plan of the room); with no
      // plan of it, the sleep is played where they stand
      if (opts.scenes !== false && stage.doorway?.has(`pad:${YOU}`)) {
        const slept = stage.doorway.bed(YOU, `pad:${YOU}`, { alive: () => !S.dead });
        await Promise.race([slept, new Promise(r => setTimeout(r, 7000))]);
      } else {
        const staged = actedOf(events.filter(e => e.type === 'sleep'));
        if (staged) await playOn(lineOf({ ...hourOf(before), place: 'crib', staged, verb: 'rest' }));
      }
    } else if (choice.do === 'morning') {
      // out of the jail or the clinic: the plain cut home, under the day's report
    } else if (choice.do === 'rough') {
      // SLEEPING ROUGH: he lies down where he is, and the night passes there (the robbers through his pockets, when
      // they came). The morning is played after the night's report, where he lay (below)
      await playOn(lineOf({ ...hourOf(before), place: before.place, staged: actedOf(events.filter(e => e.type === 'rough' || e.type === 'robbed')), verb: 'rest' }));
      S.hold = null;
    } else if (choice.do === 'give' || choice.do === 'refuse') {
      // at the door, and then back in (the hour ends at the pad: lineOf). A grudge: he stays out on his porch, to see
      // the regular storm off and the police come round (the state is the crib's: the next choice is made from there)
      const grudge = atDoor.find(e => e.type === 'grudge');
      await playOn(lineOf({ ...hourOf(state), place: grudge ? 'park' : 'crib', staged: actedOf(atDoor), verb: 'move' }, doorWho && { ...doorWho, calm: choice.do === 'give' }));
      // (and then he storms off home, sour, while the player watches from the porch. The police coming round is the
      // place's heat: the bar and the line's stops say it)
      if (grudge && !S.dead && opts.scenes !== false) await playOn(lineOf({ ...hourOf(state), place: 'park', staged: actedOf([{ type: 'stormed', place: 'park', day: state.day, hour: state.hour }]), verb: 'move' }));
      S.hold = null;
    } else {
      const taken = state.place === 'jail' || state.place === 'clinic';
      const staged = actedOf(events);
      // (the hour you leave the market is still an hour there: what it brought is played THERE, and then the ride.
      // As one hour the stage played the scenes, then started the player's walk home and waited on it, then the ride)
      const there = home ? actedOf(events.filter(e => e.place === 'market')) : staged;
      const indoors = home ? actedOf(events.filter(e => e.type === 'bank')) : null;
      // (the ride home lands a little up the lane from the trailer: landing())
      if (home) S.homeward = true;
      if (choice.do === 'subway' && !taken && there?.events.length) {
        await playOn(lineOf({ ...hourOf(before), place: before.place, staged: there, verb: 'move' }));
        if (!S.dead) await playOn(lineOf({ ...hourOf(state), place: state.place, staged: indoors, verb: 'move' }));
      } else await playOn(lineOf({ ...hourOf(state), place: state.place, taken: taken ? endOf(before.place).block : null, staged: home ? indoors : staged, verb: WORKS.has(choice.do) ? 'work' : 'move' }, choice.do === 'out' && atDoor.length ? doorWho : null));
      S.homeward = false;
      // (it has played: the next paint, the held card's or the next choice's, tells it)
      S.hold = null;
      if (taken && !S.dead) {
        // TAKEN: NOTHING TAKES THE PLAYER THERE WITHOUT A PRESS (the old HUD's rule, SPEC 25.8). The hour ends where it
        // happened, the card up; Continue is the cut.
        S.phase = 'held';
        paint();
        await press(opts.pilot ? 600 : null);
        await stage.take(YOU, state.place).catch(err => console.warn('[run] the stage did not take the player there:', err));
        S.taken = null;
      }
    }
    if (dayOver) {
      S.phase = 'report';
      paint();
      const report = reportOf(S.dayStart, before, state, events);
      S.dayStart = ledgerOf(state);
      const shown = showReport(report);
      // the night under the report: the next morning, at home. Asleep in bed, they stay asleep until the report is
      // put away; out of the jail or the clinic, the cut home is made under it. A REGULAR AT THE DOOR this morning is
      // put at the foot of the step under the same cut (doorAt below)
      if (choice.do === 'rough') {
        // ON THE STREET: he lies there until the report is put away, then the morning is THERE: he gets up where he
        // lay and pats his pockets
        await shown;
        if (!S.dead) await playOn(lineOf({ ...hourOf(state), place: state.place, staged: actedOf(events.filter(e => e.type === 'morning')), verb: 'move' }));
      } else if (before.place === 'crib') {
        await shown;
        await dipped(() => playOn(morningLine(state, events), { instant: true }));
      } else {
        await playOn(morningLine(state, events), { hurried: true });
        await shown;
      }
      // THE REGULAR AT THE DOOR: he is at the foot of the step, shaking, and asks. The choice (give, or shut the door)
      // is then the bar's, before anything else
      // (out of the jail or the clinic, the cut home was a played hour under the report: he has asked already)
      if (state.door && events.some(e => e.type === 'door') && !S.dead && (before.place === 'crib' || choice.do === 'rough')) await doorAt(state, events.find(e => e.type === 'door'));
    }
    if (events.some(e => e.type === 'done')) {
      S.phase = 'done';
      paint();
      await showDone(state.doneDay);
    }
  }

  /**
   * The morning's cut home: at the crib, or, with a regular at the door, the player out on his porch and the regular
   * at the foot of the step (the door's scene names the porch as where the player stays: its steps are not played in
   * a cut, only where everyone ends).
   */
  function morningLine(state, events = []) {
    if (!state.door) return lineOf({ ...hourOf(state), place: 'crib' });
    return lineOf({ ...hourOf(state), place: 'park', staged: actedOf([doorEvent(state, events)]), verb: 'move' }, state.door);
  }
  const doorEvent = (state, events = []) => events.find(e => e.type === 'door') ?? { type: 'door', place: 'crib', day: state.day, hour: state.hour, who: { id: state.door.id, name: state.door.name, role: state.door.role } };
  /** A regular at the door this morning (the view's `door`): seen, he shakes and asks the player on his porch. */
  async function doorAt(state, event) {
    await playOn(lineOf({ ...hourOf(state), place: 'park', staged: actedOf([event ?? doorEvent(state)]), verb: 'move' }, state.door));
  }

  /** What you are doing, said while it plays out (how it went waits for the scene). */
  function doingOf(choice, v0) {
    if (choice.do === 'job') {
      const o = v0.options.find(x => x.choice.id === choice.id);
      const who = choice.who ? o?.targets?.find(t => t.id === choice.who)?.name : null;
      return `${who ? `${cfg.jobs[v0.place]?.[choice.id]?.label ?? o?.label}: ${who}` : o?.label ?? 'Working'}…`;
    }
    if (choice.do === 'subway') return `${choice.to === 'park' ? 'Heading home' : `To ${cfg.places.market.label}`}${choice.hop ? ', over the turnstile' : ''}…`;
    if (choice.do === 'rob') return 'Robbing somebody passing…';
    if (choice.do === 'bins') return 'Digging through the bins…';
    if (choice.do === 'shop') return `Buying ${v0.shopHere.find(s => s.item === choice.item)?.label.toLowerCase() ?? 'it'}…`;
    if (choice.do === 'rough') return `Lying down for the night ${cfg.places[v0.place]?.where ?? 'here'}…`;
    if (choice.do === 'give') return `Paying ${v0.door?.name ?? 'them'} at the door…`;
    if (choice.do === 'refuse') return `Shutting the door on ${v0.door?.name ?? 'them'}…`;
    return choice.do === 'inside' ? 'Going inside…' : v0.door ? `Stepping out past ${v0.door.name}…` : 'Stepping out…';
  }

  /** Waits for Continue (Enter, or the card's button). A pilot presses it after `auto` ms. */
  function press(auto = null) {
    return new Promise(resolve => {
      S.onPress = () => {
        S.onPress = null;
        resolve();
      };
      if (auto !== null) setTimeout(() => S.onPress?.(), auto);
    });
  }

  // ── what just happened ──────────────────────────────────────────────────────────────────────────────────────────
  /** The step's events as one or two plain lines, and the roll that decided it (the needle on the odds). */
  function resultOf(events, before) {
    // (a job that paid leads with what it paid: the bar's row is one line, and the pay is what the hour was for)
    const BAD = new Set(['jumped', 'stopped', 'jail', 'clinic', 'robbed', 'fight', 'grudge']);
    // (trust-1: a witness is its roll, below, and the morning's drift and every trust change are plates of their own)
    const lines = events.filter(e => !['ride', 'released', 'done', 'witness', 'drift'].includes(e.type) && (e.type !== 'morning' || e.night === 'street') && e.text).map(e => ({
      text: e.text,
      bad: BAD.has(e.type) && !(e.type === 'fight' && !e.energyLost) && !(e.type === 'robbed' && !e.taken) || e.outcome === 'fail' || (e.type === 'hop' && e.caught),
      good: e.outcome === 'win', pay: (e.type === 'job' || e.type === 'rob') && e.outcome === 'win' ? e.pay : e.type === 'bins' && e.pay ? e.pay : null,
      // (trust-1: said again by a plate and the dice when there is trust news: a job that moved its person's trust, a
      // door shut; then the row gives its room to the plates, the line's words stay in the tooltip)
      covered: (e.type === 'job' && !!e.trust) || e.type === 'refused',
    }));
    const rolls = [];
    for (const e of events) {
      if (e.type === 'job' && e.roll !== null && e.roll !== undefined) rolls.push({ label: 'the job', chance: e.chance, roll: e.roll, hit: e.outcome === 'win', yes: 'it worked', no: 'it went wrong', own: true });
      if (e.type === 'rob' && e.roll !== null && e.roll !== undefined) rolls.push({ label: 'the robbery', chance: e.chance, roll: e.roll, hit: e.outcome === 'win', yes: 'it worked', no: 'they got away', own: true });
      if (e.type === 'robbed') rolls.push({ label: 'robbed asleep', chance: e.chance, roll: e.roll, hit: true, yes: e.taken ? `$${e.taken} gone` : 'nothing taken', no: '', risk: true });
      if (e.type === 'fight') rolls.push({ label: 'he swung', chance: e.chance, roll: e.roll, hit: true, yes: e.energyLost ? `energy −${e.energyLost}` : 'saw him off', no: '', risk: true });
      if (e.type === 'grudge') rolls.push({ label: 'he swung', chance: e.chance, roll: e.roll, hit: false, yes: '', no: 'a grudge instead', risk: true });
      if (e.type === 'stopped') rolls.push({ label: 'police stop', chance: e.chance, roll: e.roll, hit: true, yes: 'stopped', no: 'not stopped', risk: true });
      if (e.type === 'jumped') rolls.push({ label: 'jumped', chance: e.chance, roll: e.roll, hit: true, yes: e.outcome === 'clean' ? 'a bad one' : e.outcome === 'messy' ? 'a scuffle' : 'got nothing', no: 'clear', risk: true });
      if (e.type === 'hop') rolls.push({ label: 'the turnstile', chance: e.chance, roll: e.roll, hit: e.caught, yes: 'seen: heat +1', no: 'not seen', risk: true });
      // TOLD ON (trust-1): someone against you was about and saw it: called in, bad; kept quiet, luck. The roll at the
      // chance the card showed before you chose
      if (e.type === 'witness') {
        const names = (e.watchers ?? []).map(w => cap(w.name)).join(' and ');
        rolls.push({ label: `told on: ${names}`, chance: e.chance, roll: e.roll, hit: e.called, yes: `${cap(e.who?.name ?? names)} called it in · heat +${e.heat}`, no: `${names} kept quiet`, risk: true, title: e.text, witness: true });
      }
      if (e.type === 'sore') rolls.push({ label: 'he swung', chance: e.chance, roll: e.roll, hit: false, yes: '', no: 'sore, no grudge', risk: true });
    }
    // WHAT IT DID TO SOMEONE'S TRUST: who, which way, why; and the morning's drift only where someone changed band
    const chips = [];
    for (const e of events) {
      if (e.trust) chips.push(trustChip(e.trust));
      if (e.type === 'bins' && e.lookedAway && e.seen) chips.push({ tone: 'luck', text: `${cap(e.seen.name)} looked away: with you`, title: e.text });
      if (e.type === 'drift') for (const c of e.changes ?? []) if (c.band !== c.bandWas) chips.push(trustChip(c));
    }
    // the market noticed you and nothing came of it: that was a roll too, and the one that matters
    const v0 = view(cfg, before);
    const rolled = events.some(e => e.type === 'jumped' || e.type === 'stopped');
    if (v0.danger.here && !rolled && (events.some(e => WORKS.has(e.type)) || events.some(e => e.type === 'ride' && e.place !== before.place))) {
      rolls.push({ label: v0.placeLabel,chance: v0.danger.thisHour.jump.chance, roll: null, hit: false, yes: '', no: `nobody came for you (${v0.danger.thisHour.jump.chance}% that hour${v0.danger.thisHour.stop.chance ? `, police ${v0.danger.thisHour.stop.chance}%` : ''})`, risk: true, quiet: true });
    }
    if (!lines.length && !chips.length) lines.push({ text: events.map(e => e.text).filter(Boolean).join(' ') || 'Nothing happened.' });
    return { lines: lines.slice(0, 3), chips, rolls };
  }
  /**
   * A trust change as a plate on the row: the arrow and who, which way (the number, and the band when it changed), why.
   * Turned against you: bad. With you, or over it: luck. Any other step: quiet. All of it in its tooltip.
   */
  function trustChip(t) {
    const turned = t.band !== t.bandWas;
    const way = turned
      ? t.band === 'against' ? `against you${t.offDays ? `, ${t.offDays} day${t.offDays > 1 ? 's' : ''}` : ''}` : t.band === 'with' ? 'with you' : t.bandWas === 'against' ? 'will deal with you again' : 'no longer with you'
      : `trust ${signedT(t.to)}`;
    const tone = t.band === 'against' ? 'bad' : turned && (t.band === 'with' || t.bandWas === 'against') ? 'luck' : t.band === 'with' ? 'with' : 'quiet';
    // (which way first when someone changed band, then who, so a short plate still says both; else who and the number;
    // why last)
    const why = t.cause === 'drift' ? '' : ` · ${t.why}`;
    const arrow = t.change > 0 ? '▲' : '▼';
    return { tone, text: turned ? `${arrow} ${cap(way)}: ${cap(t.who.name)}${why}` : `${arrow} ${cap(t.who.name)} ${signedT(t.change)}, ${way}${why}`, title: t.text };
  }

  // ── the panels ──────────────────────────────────────────────────────────────────────────────────────────────────
  function paint() {
    const v = S.hold?.v ?? S.v;
    // (what just happened, shown with the choice after the hour: it goes by itself after eight seconds)
    if (S.phase === 'choose' && S.result && !S.resultGone && !S.resultT) {
      S.resultT = setTimeout(() => {
        S.resultT = null;
        S.resultGone = true;
        if (!S.dead && S.phase === 'choose') paint();
      }, 8000);
    }
    paintTop(v);
    paintNotice();
    paintDock(v);
    paintDanger(v);
    paintCard(v);
    paintSheet(v);
    fitFrame();
  }
  /** What just happened is being said (on the bar's row, and by the heat that landed on the top line and the map). */
  const resultUp = () => !S.hold && !!S.result && (S.phase !== 'choose' || !S.resultGone);
  /** THE NOTICE FROM ELSEWHERE (el.notice): what was called in where, and what to do about it; × puts it away. */
  function paintNotice() {
    const n = S.notice && S.notice.day === S.state.day ? S.notice : null;
    el.notice.hidden = !n;
    if (!n) return fill(el.notice);
    // (the view's words, less their last sentence when it is the suggestion: that is the plate after them)
    const words = n.suggest?.place ? n.text.replace(/\s+[^.:]*\bwork [^.]*\.$/i, '') : n.text;
    fill(el.notice,
      h('b', { class: 'rn-notice-h' }, n.hot ? 'Police called' : 'Called in'),
      h('span', { class: 'rn-notice-text', title: n.text }, `${n.who ? `${cap(n.who)} called the police on ${cfg.places[n.place]?.label ?? n.place}. ` : ''}${words}`),
      n.suggest?.text ? h('span', { class: 'rn-suggest' }, cap(n.suggest.text)) : null,
      h('button', { type: 'button', class: 'k-btn rn-notice-x', 'aria-label': 'Put the notice away', title: 'Put it away', onclick: () => { S.notice = null; paint(); } }, '×'));
  }
  /** A pick by the player puts what just happened away (the bar keeps its height: the row says something else). */
  const picked = () => {
    if (S.result) S.resultGone = true;
  };
  // THE FRAME'S MEASURES, for the CSS: the move card's height (an open panel stops above it, so the card it chooses
  // on is never under it) and the dock's (at phone width the card stops short of it). Again whenever either changes
  // size: the kit's own face arriving late made a first measure short
  function fitFrame() {
    root.style.setProperty('--rn-card-h', `${Math.ceil(el.card.offsetHeight)}px`);
    root.style.setProperty('--rn-dock-h', `${Math.ceil(dock.offsetHeight)}px`);
  }
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => fitFrame());
    ro.observe(el.card);
    ro.observe(dock);
  }
  addEventListener('resize', () => !S.dead && paint());

  // ── THE DOCK, OPEN OR FOLDED ────────────────────────────────────────────────────────────────────────────────────
  // Kept in this browser, apart for a phone and a desk. Both start folded (the owner, 11-13: the rail is the left side
  // he likes; and the picture needs the room)
  const narrow = () => innerWidth <= 720;
  const railKey = () => (narrow() ? 'dock.narrow' : 'dock.wide');
  const isRail = () => (kept.get(railKey()) ?? 'rail') === 'rail';
  function toggleDock(rail = !isRail()) {
    kept.set(railKey(), rail ? 'rail' : 'open');
    paint();
  }
  // ── THE BAR, OPEN OR FOLDED to its one row (F, or its button; kept in this browser) ─────────────────────────────
  const barFolded = () => kept.get('bar') === 'fold';
  function toggleBar(fold = !barFolded()) {
    kept.set('bar', fold ? 'fold' : 'open');
    paint();
  }

  // ── THE PANELS: one open at a time, beside the dock ─────────────────────────────────────────────────────────────
  function openSheet(id = null) {
    const was = S.sheet ?? null;
    S.sheet = id && id !== was ? id : null;
    if (was === 'character' && S.sheet !== 'character') face.big.player?.stop();
    if (was === 'map' && S.sheet !== 'map') runMap.close();
    if (S.sheet === 'character') showFace(true);
    paint();
    if (S.sheet && S.sheet !== was) sheetBits.scroll.scrollTop = 0;
  }

  // ── THE MAP (M): the kit's paper map of the island, fed from the run (demo/run/map.js) ─────────────────────────────
  const mapCtx = () => ({ cfg, v: S.hold?.v ?? S.v, state: S.hold?.state ?? S.state, dayStart: S.dayStart });
  const BLOCK_OF = { park: 'projects', market: 'market', corner: 'corner', jail: 'jail', clinic: 'clinic' };
  /** Where the player is on the island: the stage's own position of them; hidden or on a ride, where the run has them. */
  function youOnMap() {
    const v = S.hold?.v ?? S.v;
    const label = `you · ${S.taken ?? v.placeLabel}`;
    const indoors = v.place === 'crib';
    const A = stage.actors;
    const me = A?.has?.(YOU) ? A.get(YOU) : null;
    if (me && Number.isFinite(me.x) && Number.isFinite(me.z) && !me.w?.hide && !stage.travelling) return { x: me.x, z: me.z, label, indoors };
    const at = v.place === 'crib' ? stage.map?.PADS?.[YOU]?.door : stage.map?.PLACES?.[BLOCK_OF[v.place]]?.at;
    return at ? { x: at[0], z: at[1], label, indoors } : null;
  }
  const runMap = createRunMap({
    where: youOnMap,
    clock: () => (S.state.day - 1) * 1440 + S.state.hour * 60,
    // the run's three stops where the stage plays them (places.json, through the stage's own table)
    stops: () => {
      const c = mapCtx();
      const at = stopOf(c.v);
      const P = stage.map?.PLACES ?? {};
      return ['park', 'market', 'corner'].filter(id => P[BLOCK_OF[id]]?.at).map(id => {
        // (each place's heat and police, the view's: map.js draws them on the stop's flag)
        const pl = (c.v.places ?? []).find(q => q.place === id);
        return {
          id, name: STOP_NAME[id], flag: stopFlag(c, id), x: P[BLOCK_OF[id]].at[0], z: P[BLOCK_OF[id]].at[1], here: id === at, locked: id === 'corner',
          heat: pl ? pl.heat : null, hot: !!pl?.hot, police: !!pl?.police,
          // (trust-1: the heat that just landed there, while what just happened is said)
          rose: pl && resultUp() ? S.rose?.[id] ?? 0 : 0,
        };
      });
    },
    // THE LINE as the stage rides it: a walk to the park's subway stairs, the ride to the market's, a walk to the stalls;
    // the corner, locked, a walk on from there
    line: () => {
      const P = stage.map?.PLACES ?? {};
      const [pk, mk, cn] = [P.projects, P.market, P.corner];
      if (!pk || !mk) return { ride: [], walks: [], locked: [], stations: [] };
      const [a, b] = [pk.ways?.subway, mk.ways?.subway];
      const xz = s => [s.x, s.z];
      return {
        stations: [a, b].filter(Boolean).map(s => ({ x: s.x, z: s.z, name: s.name })),
        ride: a && b ? [xz(a), xz(b)] : [pk.at, mk.at],
        walks: a && b ? [[pk.at, xz(a)], [xz(b), mk.at]] : [],
        locked: cn ? [[b ? xz(b) : mk.at, cn.at]] : [],
      };
    },
    card: id => ({ name: STOP_NAME[id], body: stopBody(mapCtx(), id) }),
  });
  const sheetBits = (() => {
    const title = h('h2', { class: 'rn-sheet-title' });
    const key = h('kbd');
    const x = h('button', { type: 'button', class: 'k-btn rn-sheet-x', 'aria-label': 'Close (Esc)', title: 'Close (Esc)', onclick: () => openSheet(null) }, '×');
    const lead = h('div', { class: 'rn-sheet-lead' });
    const scroll = h('div', { class: 'rn-sheet-scroll' });
    const foot = h('div', { class: 'rn-sheet-foot' }, h('span', null, 'The numbers, the letters and Enter still choose on the bar'), h('span', null, 'Esc closes'));
    el.sheet.append(h('div', { class: 'rn-sheet-head' }, title, key, x), lead, scroll, foot);
    return { title, key, x, lead, scroll, foot };
  })();
  // the character sheet's own head and tabs (the kit's: the dossier's look), made once and kept
  const charTabs = kitTabs([{ id: 'stats', label: 'Stats' }, { id: 'wearing', label: 'Wearing' }, { id: 'people', label: 'People' }], {
    selected: ['wearing', 'people'].includes(kept.get('tab')) ? kept.get('tab') : 'stats',
    onchange: (id, user) => {
      if (user) kept.set('tab', id);
      if (user) paint();
    },
  });
  const charHead = h('div', { class: 'rn-char-head' });

  function paintSheet(v) {
    const def = SHEETS.find(s => s.id === S.sheet);
    el.sheet.hidden = !def;
    root.classList.toggle('has-sheet', !!def);
    if (!def) return;
    el.sheet.dataset.sheet = def.id;
    el.sheet.setAttribute('aria-label', def.title);
    sheetBits.title.textContent = def.title;
    sheetBits.key.textContent = def.key;
    const state = S.hold?.state ?? S.state;
    // (a panel can pick a move on the bar, `pick`, or buy from the place's shop at once, `go`: rules-2)
    const ctx = { cfg, v, state, dayStart: S.dayStart, choosing: S.phase === 'choose' && !S.hold, pick: key => fromPanel(key, false), go: key => fromPanel(key, true) };
    const top = sheetBits.scroll.scrollTop;
    if (def.id === 'character') {
      fill(charHead, face.big.box,
        h('div', { class: 'rn-char-id' }, h('h3', { class: 'rn-char-name' }, game.state.agents[YOU].name),
          h('p', null, `Day ${v.day} · ${v.clock} · ${S.taken ?? v.placeLabel}`),
          h('p', null, h('b', null, v.shop.filter(s => s.owned).length ? v.shop.filter(s => s.owned).map(s => shortName(s.label)).join(' · ') : 'a mattress on the floor')),
          face.honest ? null : h('p', { class: 'rn-note' }, 'The stage\'s own picture of you.')));
      fill(sheetBits.lead, charHead, charTabs.el);
      const tab = charTabs.selected;
      fill(sheetBits.scroll, tab === 'people' ? characterPeople(ctx) : tab === 'wearing' ? characterWearing({ ...ctx, wearing: face.wearing?.(v.place === 'jail') ?? null, honest: face.honest }) : characterStats(ctx));
    } else if (def.id === 'map') {
      // (the map is one piece that stays while the panel is open: the run's data is handed to it, nothing redrawn here)
      fill(sheetBits.lead, h('p', { class: 'rn-lede' }, lineNote(ctx)));
      if (runMap.el.parentNode !== el.sheet) el.sheet.insertBefore(runMap.el, sheetBits.foot);
      runMap.open();
      runMap.refresh();
      return;
    } else {
      fill(sheetBits.lead);
      fill(sheetBits.scroll, def.id === 'moves' ? movesBody(ctx) : stuffBody(ctx));
    }
    sheetBits.scroll.scrollTop = top;
  }

  // ── YOUR FIGURE: the kit's portrait (ui/portrait.js, the dossier's: the figure in its real look, turning, rendered
  // once into a sprite sheet) fed the look the stage gives the player, so the portrait IS the figure in the picture.
  // Checked, not assumed: the stage's own look of the player against the roll the portrait makes from the same
  // handle; if they ever differ, the stage's own still picture (stage.portraitOf) stands in, and the sheet says so
  const face = {
    small: h('canvas', { class: 'rn-face-c', width: 104, height: 128, 'aria-hidden': 'true' }),
    big: { box: null, canvas: h('canvas', { width: 208, height: 256, 'aria-hidden': 'true' }), player: null },
    honest: true, sheet: null, kit: null, still: null, asked: null, wearing: null,
  };
  face.big.box = h('div', { class: 'rn-portrait' }, face.big.canvas, h('span', { class: 'rn-portrait-wait' }, 'developing…'));
  async function faceKit() {
    if (face.kit) return face.kit;
    const THREE = window.__city?.THREE;
    if (!THREE) return null;
    // (not until the stage has put the player: a run opens on the city first, stage/opening.js, and a look read before
    // then is no look, which made the portrait give way to the still for the whole run. Asked again at every paint)
    if (!stage.actors?.has?.(YOU)) return null;
    const [{ createPortraits }, CH, REG] = await Promise.all([import(`${KIT}ui/portrait.js`), import(`${KIT}cast.js`), import(`${KIT}../../world/cast/fresh/index.js`)]);
    const kit = createPortraits({ THREE });
    // (the stage's look of the player, and the roll the portrait would make from the same handle)
    const handle = handleOf(game.state.agents[YOU].name);
    const staged = stage.actors?.has?.(YOU) ? stage.actors.get(YOU).look : null;
    face.honest = !!staged && JSON.stringify(staged) === JSON.stringify(CH.rollLook(fnv(handle) & 0xffffff));
    // WHAT YOU ARE WEARING: that same look, slot by slot, named by the city's own catalogue (world/cast/fresh/: each
    // piece's id and its `name`); in jail the county issue over it, as the stage and the portrait dress you
    face.wearing = jailed => {
      const look = staged ? structuredClone(staged) : null;
      if (look && jailed) CH.wear(look, CH.OUTFITS.county);
      return look ? REG.SLOTS.map(slot => {
        const id = typeof look[slot] === 'string' ? look[slot] : look[slot]?.id;
        return { slot, label: REG.SLOT_LABEL?.[slot] ?? slot, id, name: id && id !== 'none' && id !== 'base' ? REG.entry(slot, id)?.name ?? null : null };
      }) : null;
    };
    face.kit = { kit, handle };
    if (S.sheet === 'character') paint();
    return face.kit;
  }
  /** The small still in the dock's head, and (big) the turning one in the character sheet. In jail: the county orange. */
  async function showFace(big = false) {
    try {
      const k = await faceKit();
      if (!k) return;
      const jailed = (S.hold?.v ?? S.v).place === 'jail';
      if (!face.honest) {
        face.still ??= await stage.portraitOf?.(YOU);
        if (face.still) for (const c of [face.small, face.big.canvas]) c.style.backgroundImage = `url(${face.still})`;
        return;
      }
      const want = `${k.handle}|${jailed}`;
      if (face.asked !== want) {
        face.asked = want;
        const sh = await k.kit.sheet(k.handle, jailed);
        if (sh && face.asked === want) {
          const g = face.small.getContext('2d');
          g.clearRect(0, 0, 104, 128);
          // (a turn of the sheet that looks a little to the side, as the dossier's first frame does)
          g.drawImage(sh, 0, 0, 208, 256, 0, 0, 104, 128);
          face.small.dataset.state = 'ok';
        }
      }
      if (big && S.sheet === 'character') {
        face.big.player ??= k.kit.player(face.big.canvas);
        await face.big.player.show(k.handle, jailed);
        if (S.sheet !== 'character') face.big.player.stop();
      }
    } catch (err) {
      console.warn('[run] no portrait:', err);
    }
  }
  // (rendered when the page is idle after it is up: the first open of the sheet does not wait on the shaders)
  (window.requestIdleCallback ?? (f => setTimeout(f, 2500)))(() => showFace(false), { timeout: 6000 });

  function paintTop(v) {
    fill(el.top,
      h('span', { class: 'hk-mode', 'data-mode': 'play' }, 'The run'),
      h('b', { class: 'hk-clock-time' }, v.clock),
      h('span', { class: 'hk-clock-day' }, `Day ${v.day}`),
      h('span', { class: 'hk-top-stat rn-where' }, h('b', null, S.taken ?? v.placeLabel)),
      stopsEl(v),
      v.done ? h('span', { class: 'hk-clock-note is-hot' }, v.done.text) : null,
      h('span', { class: 'rn-seed', title: 'the run\'s dice' }, `seed ${S.state.seed}`),
      h('button', { class: `k-btn rn-new${S.newAsk ? ' is-ask' : ''}`, onclick: () => newRun0() }, S.newAsk ? 'Sure? again' : 'New run'));
  }

  // THE LINE, on the top line: its three stops as a strip, where you are lit (a click, or M, opens the map panel)
  const stopName = { park: 'Trailer park', market: 'Flea market', corner: 'The corner' };
  const stopShort = { park: 'Park', market: 'Market', corner: 'Corner' };
  // (rules-2: each stop's heat as a small count, red from the police line, and a blue P where the police are about)
  function stopsEl(v) {
    const at = stopOf(v);
    const on = S.sheet === 'map';
    return h('button', { class: `rn-stops${on ? ' is-on' : ''}`, onclick: () => openSheet('map'), title: 'The map (M)', 'aria-expanded': String(on) },
      ...v.subway.flatMap((st, i) => {
        const p = (v.places ?? []).find(q => q.place === st.stop);
        const heat = p ? h('b', { class: `rn-stop-heat${p.heat >= cfg.heat.hotAt ? ' is-hot' : p.heat ? '' : ' is-zero'}`, title: `heat ${p.heat}` }, String(p.heat)) : null;
        const pol = p?.police ? h('em', { class: `rn-stop-pol${p.hot ? ' is-hot' : ''}`, title: 'the police are about' }, 'P') : null;
        // (trust-1: the heat that just landed there, by its count, while what just happened is said)
        const rose = p && resultUp() && S.rose?.[st.stop] ? h('small', { class: 'rn-stop-rose', title: `heat +${S.rose[st.stop]} there just now` }, `+${S.rose[st.stop]}`) : null;
        return [...(i ? [h('i', { class: 'rn-line' })] : []),
          h('span', { class: `rn-stop${st.stop === at ? ' is-here' : ''}${st.locked ? ' is-locked' : ''}`, title: st.locked ? `${stopName[st.stop]}: locked, ${st.why}` : p ? p.text : stopName[st.stop] }, h('i'), stopShort[st.stop] ?? st.label, heat, rose, pol, st.locked ? h('em', null, ' locked') : null)];
      }),
      kbd('M'));
  }

  /** A NEW RUN from the page: a new seed, asked twice so a stray click loses nothing. */
  function newRun0() {
    if (!S.newAsk) {
      S.newAsk = true;
      paint();
      setTimeout(() => {
        S.newAsk = false;
        if (!S.dead) paint();
      }, 3000);
      return;
    }
    const Q = new URLSearchParams(location.search);
    Q.set('mode', 'run');
    Q.set('seed', String(1 + Math.floor(Math.random() * 9999)));
    Q.delete('runtest');
    location.search = Q.toString();
  }

  const pips = (n, max, cls = '') => h('span', { class: `hk-pips rn-pips ${cls}`, 'aria-label': `${n} of ${max}` }, Array.from({ length: max }, (_, k) => h('i', { class: k < n ? 'is-on' : '' })));
  const heatBoxes = heat => h('span', { class: 'hk-heat-pips', 'aria-label': `heat ${heat} of ${cfg.heat.max}` }, Array.from({ length: cfg.heat.max }, (_, i) => h('i', { class: `${i < heat ? 'is-on' : ''}${i === cfg.police.from - 1 ? ' is-line' : ''}` })));

  /** The panel keys: a row under the dock (a column on the rail). Each says its key; the open one is lit. */
  const sheetKeys = () => h('div', { class: 'rn-keys', role: 'toolbar', 'aria-label': 'Panels' }, SHEETS.map(s => h('button', {
    type: 'button', class: `k-btn rn-key${S.sheet === s.id ? ' is-on' : ''}`, 'data-sheet': s.id, 'aria-pressed': String(S.sheet === s.id),
    title: `${s.label} (${s.key})`, 'aria-label': s.label, onclick: () => openSheet(s.id),
  }, kbd(s.key), h('span', { class: 'is-long' }, s.label), h('span', { class: 'is-short' }, s.short))));

  function paintDock(v) {
    const rail = isRail();
    const atRisk = v.place === 'market';
    root.classList.toggle('is-rail', rail);
    dock.classList.toggle('is-rail', rail);
    dock.setAttribute('aria-label', rail ? 'You, folded' : 'You');
    // (the county orange in jail: the figure changes with the stage's)
    if (!face.kit || (face.asked && face.asked !== `${face.kit?.handle}|${v.place === 'jail'}`)) showFace(S.sheet === 'character');
    const fold = h('button', { type: 'button', class: 'k-btn rn-fold', title: rail ? 'Open the dock (D)' : 'Fold the dock (D)', 'aria-expanded': String(!rail), onclick: () => toggleDock() },
      h('span', { 'aria-hidden': 'true' }, rail ? '»' : '«'), kbd('D'));
    const faceBtn = h('button', { type: 'button', class: 'rn-face', title: 'Your character (C)', onclick: () => openSheet('character') }, face.small);
    const carried = h('div', { class: `rn-carried${atRisk && v.carried ? ' is-risk' : ''}${v.carried ? '' : ' is-none'}` }, h('span', null, atRisk ? 'Carried · at risk' : 'Carried'), h('b', null, money(v.carried)));
    const heat = h('div', { class: 'hk-heat rn-heat' }, h('span', null, 'Heat'), heatBoxes(v.heat), h('em', { class: v.heat >= cfg.police.from ? 'is-bad' : '' }, `${v.heat}/${v.heatMax}`));
    const energy = h('div', { class: 'hk-heat rn-energy', title: `every hour out costs ${cfg.energy.perHour} energy, the subway included` }, h('span', null, 'Energy'), pips(v.energy, Math.max(v.energyMax, v.energy)), h('em', { class: v.tired ? 'is-bad' : '' }, v.tired ? `${v.energy}/${v.energyMax} tired` : `${v.energy}/${v.energyMax}`));
    if (rail) {
      // FOLDED: what the city can take and how hot you are, still in sight; the panel keys under them
      fill(dock, fold, faceBtn, h('div', { class: 'rn-rail-stats' }, carried, heat, energy), sheetKeys(true));
      return;
    }
    fill(dock,
      h('div', { class: 'rn-dock-head' }, faceBtn,
        h('button', { type: 'button', class: 'rn-id', title: 'Your character (C)', onclick: () => openSheet('character') },
          h('b', null, game.state.agents[YOU].name),
          h('span', null, S.taken ?? v.placeLabel),
          h('span', { class: 'rn-id-open' }, 'character', kbd('C'))),
        fold),
      h('div', { class: 'rn-dock-body' },
        h('div', { class: 'rn-cash' }, carried, h('div', { class: 'rn-banked' }, h('span', null, 'Banked · safe'), h('b', null, money(v.banked)))),
        energy, heat,
        // (only what is owned: the three not yet bought, outlined after "You own", read as owned)
        h('div', { class: 'rn-owned' }, h('span', null, 'You own'),
          v.shop.some(s => s.owned) ? v.shop.filter(s => s.owned).map(s => h('span', { class: 'hk-tag is-yours', title: s.does }, shortName(s.label))) : h('em', { class: 'rn-none' }, 'nothing yet')),
        goalEl(v)),
      sheetKeys(false));
  }
  /** THE NEXT GOAL, always in sight: the cheapest thing not yet owned, its price, and how far banked and carried are from it. */
  function goalEl(v) {
    const next = v.shop.filter(s => !s.owned).sort((a, b) => a.price - b.price)[0];
    if (!next) return h('div', { class: 'rn-goal is-done' }, h('span', null, 'Goal'), h('b', null, v.done ? v.done.text : 'all three owned'));
    const have = v.banked + v.carried;
    const gap = next.price - have;
    return h('div', { class: 'rn-goal' },
      h('div', { class: 'rn-goal-head' }, h('span', null, 'Next'), h('b', null, `${shortName(next.label)} ${money(next.price)}`),
        h('em', { class: gap > 0 ? '' : 'is-go' }, gap > 0 ? `${money(gap)} to go` : v.banked >= next.price ? 'buy it at the crib' : 'bank it first')),
      h('div', { class: 'rn-goal-bar' }, h('i', { class: 'is-banked', style: `width:${Math.min(100, (v.banked / next.price) * 100)}%` }),
        h('i', { class: 'is-carried', style: `width:${Math.max(0, Math.min(100 - (v.banked / next.price) * 100, (v.carried / next.price) * 100))}%` })));
  }
  const shortName = label => label.replace(/^an? /i, '').replace(/^real /, '');

  // THE DANGER OF ONE MORE HOUR HERE: a line along the bar's top edge, its number at the bar's start. THE METER IS ONE
  // PIECE THAT STAYS: its fills slide to the new numbers (run.css transitions), so an hour more or a fatter pocket is
  // seen to push it up, not just redrawn higher. At none (the park, the crib) it is a hairline. A click on the number
  // (or the line) opens its small print, a slip over the bar's start: the bar keeps its height
  const meter = {
    bad: h('i', { class: 'rn-fill is-bad' }), scuffle: h('i', { class: 'rn-fill is-scuffle' }), tried: h('i', { class: 'rn-fill is-tried' }),
    now: h('span', { class: 'rn-now' }), pct: h('b', { class: 'rn-danger-pct' }), word: h('span', { class: 'rn-pct-word' }), last: null,
    // (rules-2: the heat HERE under the number, and the police when they are about, in the same small type)
    heat: h('span', { class: 'rn-pct-heat' }),
  };
  meter.el = h('div', { class: 'rn-meter', 'aria-hidden': 'true' }, meter.bad, meter.scuffle, meter.tried, meter.now);
  meter.btn = h('button', { type: 'button', class: 'rn-pct', 'aria-label': 'The danger of one more hour here' }, meter.pct, meter.word, meter.heat);
  const togglePrint = () => {
    if (!S.v.danger.here) return;
    S.dangerOpen = !S.dangerOpen;
    paint();
  };
  meter.btn.addEventListener('click', togglePrint);
  meter.el.addEventListener('click', togglePrint);
  el.card.append(meter.el, cardBody);

  function paintDanger(v) {
    const d = v.danger;
    const one = d.here ? d.oneMore : null;
    const now = d.here ? d.thisHour : null;
    // the meter runs to the most it can be (the jumping's cap), so its fill is the share of the worst
    const cap = cfg.jump.capPct;
    const w = pct => `${Math.min(100, (pct / cap) * 100)}%`;
    meter.bad.style.width = w(one?.jump.bad ?? 0);
    meter.scuffle.style.width = w(one?.jump.scuffle ?? 0);
    meter.tried.style.width = w(one ? Math.max(0, one.jump.chance - one.jump.bad - one.jump.scuffle) : 0);
    meter.now.style.left = w(now?.jump.chance ?? 0);
    meter.now.hidden = !now;
    meter.now.title = now ? `this hour: ${now.jump.chance}%` : '';
    // (where nobody jumps you but the police are about, a hot trailer park: the number is the stop's)
    const policeOnly = !!one && !one.jump.chance && one.stop.chance > 0;
    const pct = `${policeOnly ? one.stop.chance : one?.jump.chance ?? 0}%`;
    meter.pct.textContent = pct;
    meter.word.textContent = policeOnly ? 'stopped' : one ? 'jumped' : 'safe';
    // THE HEAT HERE, always: the higher of yours and the place's (the place's own word when it is hot or patrolled)
    const here = (v.places ?? []).find(p => p.here);
    const hot = v.heatHere >= cfg.police.from;
    fill(meter.heat, h('span', { class: hot ? 'is-bad' : '' }, `heat ${v.heatHere ?? v.heat}`),
      here?.police ? h('em', { class: `rn-pol${here.hot || hot ? ' is-on' : ''}`, title: here.text }, 'police') : null);
    meter.heat.title = here ? `${here.text} Heat here ${v.heatHere}: the higher of yours (${v.heatYours}) and ${here.label}'s (${here.heat}).` : '';
    meter.btn.classList.toggle('is-zero', !one);
    meter.el.classList.toggle('is-zero', !one);
    meter.btn.classList.toggle('is-open', !!one && !!S.dangerOpen);
    meter.btn.setAttribute('aria-expanded', String(!!one && !!S.dangerOpen));
    meter.btn.title = one ? `One more hour here: ${pct} that you are jumped${one.stop.chance ? `, ${one.stop.chance}% stopped` : ''}. ${S.dangerOpen ? 'Click to fold the small print' : 'Click for the small print: what each would cost'}` : (d.why === 'the day is over' ? 'The day is over.' : `Nobody acts on you here. At ${cfg.places.market.label}, every hour can go wrong.`);
    // (the number is stamped when it changes)
    if (meter.last !== null && meter.last !== pct) {
      meter.pct.classList.remove('is-new');
      void meter.pct.offsetWidth;
      meter.pct.classList.add('is-new');
    }
    meter.last = pct;
    // THE SMALL PRINT: what each would cost, the police, this hour's own odds
    el.print.hidden = !(one && S.dangerOpen);
    if (el.print.hidden) return fill(el.print);
    fill(el.print,
      h('div', { class: 'rn-print-head' }, h('b', null, `One more hour here: ${pct} jumped`), h('button', { type: 'button', class: 'k-btn rn-print-x', 'aria-label': 'Fold the small print', onclick: togglePrint }, '×')),
      h('div', { class: 'hk-legend' },
        h('span', { 'data-band': 'disaster' }, h('i'), 'a bad one ', h('b', null, `${one.jump.bad}%`), v.carried ? ` lose ${money(one.jump.takes.bad)}, wake in the clinic` : ' wake in the clinic'),
        h('span', { 'data-band': 'messy' }, h('i'), 'a scuffle ', h('b', null, `${one.jump.scuffle}%`), v.carried ? ` lose ${money(one.jump.takes.scuffle)}` : ' nothing to lose')),
      h('div', { class: `rn-police${one.stop.chance ? ' is-on' : ''}` }, h('span', null, 'Police stop'), h('b', null, `${one.stop.chance}%`),
        h('em', null, one.stop.chance ? `all ${money(one.stop.seizes)} seized, the night in jail` : `none below heat ${cfg.police.from}`)),
      h('p', { class: 'rn-now-line' }, `This hour, work or leave: ${now.jump.chance}% jumped${now.stop.chance ? `, ${now.stop.chance}% stopped` : ''}. ${v.hoursThere} hour${v.hoursThere === 1 ? '' : 's'} here, ${money(v.carried)} on you.`));
  }

  // ── THE BAR'S ROW: what is happening, what just happened, or what the place says, in the same room each time ──────
  function saidEl(v, compact) {
    if (S.hold) return h('p', { class: 'rn-said-line' }, S.hold.doing);
    const r = S.result;
    if (r && (S.phase !== 'choose' || !S.resultGone)) return resultEl(r);
    // (folded, the row is every choice: the door's two answers and the ways out among them)
    if (compact) return compactEl(v);
    // (the door and stranded say it plainly: they are the morning's and the night's one question)
    if (S.phase === 'choose' && v.door && v.place === 'crib') return h('p', { class: 'rn-said-line rn-dry rn-door-said', title: v.door.text }, v.door.text);
    if (S.phase === 'choose' && v.stranded) return h('p', { class: 'rn-said-line rn-dry rn-stranded', title: v.stranded.text }, v.stranded.text);
    if (S.phase === 'choose' && v.dry) return h('p', { class: 'rn-said-line rn-dry', title: v.dry.text }, v.dry.text);
    return hintEl(v);
  }
  /**
   * Nothing new to say: the place's own word. On the street it leads with the place's heat and police in words (the
   * view's: "The flea market is hot today (heat 4): the police are about."), then, where something can act on you,
   * the danger in brief, its small print a click away.
   */
  function hintEl(v) {
    const d = v.danger;
    if (v.place === 'crib') return h('p', { class: 'rn-said-line is-quiet' }, v.hour === cfg.start.hour ? `Day ${v.day}. You wake at the crib.` : `Day ${v.day}, ${v.clock}. At the crib.`);
    const here = (v.places ?? []).find(p => p.here && p.place === v.place);
    // (the place's own sentence when it is hot, or quiet with nobody to jump you; a patrolled place's police are the
    // POLICE under the number, and their chance in the danger's brief)
    const words = here && (here.hot || !d.here) ? h('b', { class: `rn-place-word${here.hot ? ' is-hot' : ''}`, title: here.text }, here.hot ? `Hot today (heat ${here.heat}): police about` : here.heat ? `Heat ${here.heat} here` : 'Quiet') : null;
    if (d.here) {
      const one = d.oneMore;
      return h('button', { type: 'button', class: 'rn-said-line rn-danger-sum', onclick: togglePrint, title: `${here ? `${here.text} ` : ''}The small print: what each would cost` },
        words,
        one.jump.chance ? h('span', { 'data-band': 'disaster' }, h('i'), `bad one ${one.jump.bad}%`) : null,
        one.jump.chance ? h('span', { 'data-band': 'messy' }, h('i'), `scuffle ${one.jump.scuffle}%`) : null,
        h('span', { class: one.stop.chance ? 'is-police' : '' }, `police ${one.stop.chance}%`),
        h('em', null, S.dangerOpen ? 'less' : 'more'));
    }
    if (here) return h('p', { class: `rn-said-line${here.hot ? ' rn-dry' : ' is-quiet'}`, title: here.text }, `${here.hot ? `Hot today (heat ${here.heat}): police about` : here.heat ? `Heat ${here.heat} here` : 'Quiet'}. Nobody jumps you here.`);
    return h('p', { class: 'rn-said-line is-quiet' }, d.why === 'the day is over' ? 'The day is over.' : v.place === 'jail' || v.place === 'clinic' ? 'Your day is over.' : `Nobody acts on you here. At ${cfg.places.market.label}, every hour can go wrong.`);
  }
  /** What just happened: its lines and its rolls on the one row (all of it in the tooltip when the row is short). */
  function resultEl(r) {
    const chips = r.chips ?? [];
    const title = [...r.lines.map(l => l.text), ...chips.map(c => c.title), ...r.rolls.filter(x => x.title).map(x => x.title)].join(' ');
    if (!chips.length) {
      return h('div', { class: 'rn-said-line rn-result', title },
        r.lines.flatMap(l => [l.pay ? h('b', { class: 'rn-paid' }, `+${money(l.pay)}`) : null, h('span', { class: `rn-tick${l.bad ? ' rn-bad' : ''}` }, l.text)]),
        r.rolls.map(rollEl));
    }
    // WITH TRUST NEWS the one row is shared (has-chips, run.css): what it paid, the lines a plate does not say again,
    // the move's own dice (how it went), told on or not (the heat), then what it did to people, then the other dice
    return h('div', { class: 'rn-said-line rn-result has-chips', title },
      r.lines.map(l => (l.pay ? h('b', { class: 'rn-paid' }, `+${money(l.pay)}`) : null)),
      r.lines.filter(l => !l.covered).map(l => h('span', { class: `rn-tick${l.bad ? ' rn-bad' : ''}`, title: l.text }, l.text)),
      r.rolls.filter(x => x.own).map(rollEl),
      r.rolls.filter(x => x.witness).map(rollEl),
      chips.map(c => h('span', { class: `rn-tchip is-${c.tone}`, title: c.title }, c.text)),
      r.rolls.filter(x => !x.own && !x.witness).map(rollEl));
  }
  /** A roll: the chance as a bar and the needle where the number landed (the old HUD's roll card, small). */
  function rollEl(r) {
    const segs = [{ key: 'clean', pct: r.risk ? 100 - r.chance : r.chance, label: r.risk ? 'clear' : 'works' }, { key: 'disaster', pct: r.risk ? r.chance : 100 - r.chance, label: r.risk ? r.label : 'fails' }];
    const bar = barEl(segs, { small: true });
    // (the engine rolls under the chance to hit; the bar draws the good part first, so a risk's roll is mirrored)
    if (r.roll !== null) bar.append(h('span', { class: 'hk-needle', style: `left:${r.risk ? 100 - (r.roll + 0.5) : r.roll + 0.5}%` }));
    const band = r.quiet ? 'clean' : r.risk ? (r.hit ? 'disaster' : 'clean') : r.hit ? 'clean' : 'disaster';
    return h('span', { class: `rn-roll${r.witness ? ' is-told' : ''}`, title: r.roll !== null ? `${r.label}: rolled ${r.roll}, under ${r.chance} ${r.risk ? 'is trouble' : 'wins'}` : r.label }, bar,
      r.quiet ? h('span', { class: 'rn-roll-said' }, r.no) : h('span', { class: 'hk-tick-roll', 'data-band': band }, r.hit ? r.yes : r.no));
  }
  /** FOLDED, the row holds every choice small: its number and, for an option, its pay and odds; the pick by its name. */
  function compactEl(v) {
    const things = v.place === 'crib'
      ? (v.door ? [] : v.shop.filter(s => s.key).map(s => ({ key: s.key, available: s.available, name: shortName(s.label), pay: money(s.price), odds: s.owned ? 'owned' : null })))
      : (v.options ?? []).map(o => ({ key: o.key, available: o.available, name: cfg.jobs[v.place]?.[o.id]?.label ?? o.label, pay: range(payOfPick(o)), odds: o.sure ? 'sure' : `${o.odds}%` }));
    // (the street's moves and the door's by their letters; a picked target by its name)
    const ways = v.moves.filter(m => !m.locked).map(m => ({ key: m.key, cap: letterOf(m) ?? m.key, available: m.available, name: moveWords(m)[0] }));
    for (const t of things) {
      const o = v.options?.find(x => x.key === t.key);
      if (o && targetIndex(o)) t.name = `${t.name} · ${targetOf(o).name}`;
      if (o && trustOfPick(o)?.band === 'with') t.name = `${t.name} ▲`;
    }
    return h('div', { class: 'rn-said-line rn-chips' }, [...things, ...ways].map(c => h('button', {
      type: 'button', class: `rn-chip${S.sel === c.key ? ' is-on' : ''}${c.available ? '' : ' is-off'}`, 'data-key': c.key,
      title: `${c.name}${c.pay ? ` · ${c.pay}` : ''}${c.odds ? ` · ${c.odds}` : ''}`, onclick: () => pickOrGo(c.key, c.available),
    }, kbd(c.cap ?? c.key), S.sel === c.key || !c.pay ? h('b', null, c.name) : null, c.pay ? h('span', { class: 'rn-pay' }, c.pay) : null, c.odds ? h('em', null, c.odds) : null)));
  }

  function paintCard(v) {
    el.card.dataset.phase = S.phase;
    const folded = barFolded();
    // (the stage measures the bar again when it changes its size on purpose: stage/index.js fitToPanels, inside.js freeRect)
    el.card.dataset.fit = folded ? 'folded' : 'open';
    el.card.classList.toggle('is-folded', folded);
    const choose = S.phase === 'choose';
    // (while what just happened is said, the ways give it their small print's room: the row keeps its height)
    el.card.classList.toggle('has-result', resultUp());
    let top = null;
    let ways = [];
    if (choose && !folded) [top, ways] = v.place === 'crib' ? cribParts(v) : v.place === 'jail' || v.place === 'clinic' ? heldParts(v) : streetParts(v);
    const jail = v.place === 'jail';
    const held = S.phase === 'held' ? h('div', { class: 'hk-held rn-held' }, h('b', null, jail ? 'You are under arrest' : 'You are hurt'),
      h('span', null, jail ? 'Continue takes you to the jail.' : 'Continue takes you to the clinic.'),
      h('button', { class: 'k-btn is-primary hk-confirm rn-go', onclick: () => S.onPress?.() }, 'Continue', kbd('Enter'))) : null;
    const skipBtn = S.phase === 'playing' ? h('button', { class: 'k-btn rn-skip', onclick: () => skip() }, 'Skip', kbd('Space')) : null;
    // (run.css lays these on a grid: the number at the start, the choices, the slim row of what is said and the ways)
    cardBody.classList.toggle('is-one-row', !top);
    fill(cardBody, meter.btn, top, h('div', { class: 'rn-said' }, saidEl(v, choose && folded)),
      h('div', { class: 'rn-ways' }, ...ways, held, skipBtn, choose ? confirmBtn() : null, foldBtn(folded)));
    // (folded, the row of every choice slides to keep the pick in sight when it holds more than its width)
    const chips = cardBody.querySelector('.rn-chips');
    const pick = chips?.querySelector('.rn-chip.is-on');
    if (pick) chips.scrollLeft = Math.max(0, pick.offsetLeft - chips.offsetLeft - (chips.clientWidth - pick.offsetWidth) / 2);
  }
  const foldBtn = folded => h('button', { type: 'button', class: 'k-btn rn-barfold', title: folded ? 'Open the bar (F)' : 'Fold the bar to one row (F)', 'aria-expanded': String(!folded), 'aria-label': folded ? 'Open the bar' : 'Fold the bar', onclick: () => toggleBar() },
    h('span', { 'aria-hidden': 'true' }, folded ? '▴' : '▾'), kbd('F'));

  /**
   * The three dealt options, and the ways to move. THE ROW OF MOVES keeps the essentials: the ways on (inside, the
   * subway, the turnstile), robbing somebody passing and the bins; the shop and sleeping rough live in the All moves
   * panel (A) with their keys (E, Z), and come onto the row when you are spent (energy 1 or less, away from home).
   * STRANDED, the options give way to the ways out.
   */
  function streetParts(v) {
    if (v.stranded) return strandedParts(v);
    const cards = h('div', { class: 'rn-options' }, v.options.map(o => {
      const on = S.sel === o.key;
      const name = cfg.jobs[v.place]?.[o.id]?.label ?? o.label;
      // THE TARGET: the one dealt, or another of its role picked on the option's own line (a click on the name, the
      // option's number again, or T); its mood and, for a regular, how hooked they are, follow the pick
      const who = targetOf(o);
      const many = (o.targets?.length ?? 0) > 1;
      const mood = who?.mood && who.mood !== 'calm' ? who.mood : null;
      const reg = who ? (v.people ?? []).find(p => p.id === who.id)?.regular : null;
      const nameEl = who ? h('span', null, who.name[0].toUpperCase() + who.name.slice(1)) : null;
      // (trust-1: the picked person's trust, as a mark beside the name: with you, and what that adds to the pay)
      const tw = trustOfPick(o);
      const band = t => (t.band && t.band !== 'neutral' ? ` (${t.bandText ?? t.band})` : '');
      const whoEl = !who ? null : many
        ? h('span', { class: `rn-who is-pick${mood ? ` is-${mood}` : ''}`, role: 'button', tabindex: '-1', title: `Who: ${o.targets.map(t => `${t.name}${band(t)}`).join(' · ')} (a click, ${o.key} again, or T: the next)`, onclick: ev => { ev.stopPropagation(); cycleTarget(o); } },
          h('i', null, '‹'), nameEl, h('i', null, '›'), h('small', null, `${targetIndex(o) + 1}/${o.targets.length}`), mood ? h('em', null, cfg.moods[mood]) : null)
        : h('span', { class: `rn-who${mood ? ` is-${mood}` : ''}`, title: tw ? trustTitle({ ...tw, name: who.name }) : null }, nameEl, mood ? h('em', null, cfg.moods[mood]) : null);
      // (the chance someone here against you, about now, calls it in: a crime's card only, as its odds are shown)
      const tell = tellEl(o.tellRisk, { short: true });
      // (one main line: the number, the name, the pay, the odds; one small line: who it is done to and their mood,
      // what failing costs. Every job costs an hour and the same energy, said once on the dock's energy row)
      return h('button', { class: `rn-option${on ? ' is-on' : ''}${o.available ? '' : ' is-off'}${o.safe ? ' is-safe' : ''}`, 'data-key': o.key, title: `${name}${tw ? `. ${trustTitle({ ...tw, name: who?.name })}` : ''}${o.tellRisk?.text ? `. ${cap(o.tellRisk.text)}` : ''}`, onclick: () => pickOrGo(o.key, o.available) },
        h('span', { class: 'rn-o-main' }, kbd(o.key), h('b', { class: 'rn-o-name' }, name), h('span', { class: 'rn-pay' }, range(payOfPick(o))),
          o.sure ? h('span', { class: 'hk-tag is-yours rn-odds' }, 'sure') : h('span', { class: 'rn-odds' }, barEl([{ key: 'clean', pct: o.odds, label: 'works' }, { key: 'disaster', pct: 100 - o.odds, label: 'fails' }], { small: true }), h('b', null, `${o.odds}%`))),
        h('span', { class: `rn-o-sub${tell ? ' has-tell' : ''}` },
          whoEl,
          trustMark(tw, { pay: tw?.withPay ?? 0, short: true }),
          reg ? h('span', { class: `rn-hooked${reg.hooked ? ' is-hooked' : ''}`, title: hookedText(cfg, reg) }, hookedShort(cfg, reg)) : null,
          tell,
          o.sure ? null : h('span', { class: 'rn-fails' }, `fails: ${o.ifFail}`),
          o.ifWin ? h('span', { class: 'hk-tag is-down' }, o.ifWin) : null,
          o.oddsWhy?.length ? h('span', { class: 'rn-why' }, o.oddsWhy.join(', ')) : null,
          o.available ? null : h('span', { class: 'hk-tag is-why' }, o.why)));
    }));
    return [cards, rowMoves(v).map(m => moveBtn(m))];
  }
  /** The moves on the row (see streetParts): the ways on and the street's essentials; spent, the shop and the night too. */
  function rowMoves(v) {
    const spent = v.energy <= cfg.energy.perHour;
    const home = !!cfg.places[v.place]?.door;
    return v.moves.filter(m => !m.locked && (!['shop', 'rough'].includes(m.choice.do) || (spent && !home)));
  }
  /** STRANDED (out of energy away from home): the ways out are the tiles, the drink first while it can be had. */
  function strandedParts(v) {
    const ways = v.moves.filter(m => m.choice.do === 'shop' || m.choice.do === 'rough');
    const tiles = h('div', { class: 'rn-options rn-ways-out' }, ways.map(m => moveTile(m)));
    return [tiles, v.moves.filter(m => !m.locked && m.choice.do === 'subway').map(m => moveBtn(m))];
  }
  /** A move as a tile of the top row (the door, stranded): its key, its name and price, what it does and risks. */
  function moveTile(m, extra = null) {
    const on = S.sel === m.key;
    const [name, small, cost] = tileWords(m);
    return h('button', { class: `rn-option rn-move-tile${on ? ' is-on' : ''}${m.available ? '' : ' is-off'}`, 'data-key': m.key, title: `${m.label}${m.available ? '' : `: ${m.why}`}`, onclick: () => pickOrGo(m.key, m.available) },
      h('span', { class: 'rn-o-main' }, kbd(letterOf(m) ?? m.key), h('b', { class: 'rn-o-name' }, name), cost ? h('span', { class: 'rn-pay' }, cost) : null),
      h('span', { class: 'rn-o-sub' }, h('span', { class: 'rn-does' }, small), m.available ? null : h('span', { class: 'hk-tag is-why' }, shortWhy(m)), extra));
  }
  /** A tile's words: [name, what it does and risks, its price]. */
  function tileWords(m) {
    const c = m.choice;
    const R = cfg.regulars;
    if (c.do === 'shop') {
      const it = S.v.shopHere.find(s => s.item === c.item);
      return [`Buy ${it.label.toLowerCase()}`, `${it.does}${it.left !== null ? ` · ${it.left} left today` : ''}`, money(it.price)];
    }
    if (c.do === 'rough') return [cap(m.label), `${m.robbedPct}% they rob you in your sleep (asleep, you are easier); you wake here at noon, energy ${m.morningEnergy}, your heat not cooled`, null];
    if (c.do === 'give') return [`Give ${S.v.door?.name ?? 'them'} what they ask`, `from banked (${money(S.v.banked)}); they go, friendly (trust ${signedT(cfg.trust.give)}), and they will be back`, money(m.amount)];
    if (c.do === 'refuse') {
      // (trust-1: refusing is trust −4. From with you at +3 that is only neutral: sore, no grudge, no police)
      const d = S.v.door;
      const sore = d && trustBand(cfg, trustAfter(cfg, S.state, d.id, cfg.trust.refuse)) !== 'against';
      return [`Shut the door on ${d?.name ?? 'them'}`, `${R.fightPct}% they swing at you (energy −${R.hurt.messy} to −${R.hurt.clean}); ${sore ? 'else they go off sore: you go back far enough, no grudge, no police' : `else a grudge: no sales ${R.grudgeDays} days, police round the park (heat +${R.grudgeHeat} there)`}`, null];
    }
    const w = moveWords(m);
    return [w[0], w[1], null];
  }
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

  // ── THE TARGET OF AN OPTION: the dealt one unless another is picked (kept for the hour, by option) ─────────────────
  const targetIndex = o => Math.min(S.targets?.[o.id] ?? 0, Math.max(0, (o.targets?.length ?? 1) - 1));
  const targetOf = o => o.targets?.[targetIndex(o)] ?? o.who ?? null;
  /** The picked person's trust (a target carries its own; the dealt one of a job with no targets, the option's). */
  const trustOfPick = o => o.targets?.[targetIndex(o)] ?? (o.trust ? { ...o.trust, withPay: o.withPay ?? 0 } : null);
  /** The pay with the picked person: the view's is the dealt one's, with them (withPay) or not. */
  const payOfPick = o => {
    const d = (trustOfPick(o)?.withPay ?? 0) - (o.withPay ?? 0);
    return d ? o.pay.map(x => x + d) : o.pay;
  };
  function cycleTarget(o) {
    if (S.phase !== 'choose' || (o.targets?.length ?? 0) < 2) return;
    S.targets = { ...(S.targets ?? {}), [o.id]: (targetIndex(o) + 1) % o.targets.length };
    S.sel = o.key;
    picked();
    paint();
  }
  /**
   * Worked dry: the way on, picked for the next press (the subway paid, else hopped, else inside). A regular at the
   * door: giving, when it can be paid, else shutting the door. Stranded: the drink while it can be had, else the night.
   */
  function wayOnKey(v) {
    if (v.door && v.place === 'crib') return (v.moves.find(m => m.choice.do === 'give' && m.available) ?? v.moves.find(m => m.choice.do === 'refuse'))?.key ?? null;
    if (v.stranded) return (v.moves.find(m => m.choice.do === 'shop' && m.available) ?? v.moves.find(m => m.choice.do === 'rough'))?.key ?? null;
    if (!v.dry) return null;
    const c = v.dry.to === 'market'
      ? v.choices.find(x => x.available && x.choice.do === 'subway' && x.choice.to === 'market' && !x.choice.hop) ?? v.choices.find(x => x.available && x.choice.do === 'subway' && x.choice.to === 'market') ?? v.choices.find(x => x.available && x.choice.do === 'inside')
      : v.choices.find(x => x.available && x.choice.do === 'subway' && x.choice.to === 'park' && !x.choice.hop) ?? v.choices.find(x => x.available && x.choice.do === 'subway' && x.choice.to === 'park') ?? v.choices.find(x => x.available && x.choice.do === 'inside');
    return c?.key ?? null;
  }

  function moveBtn(m, label = null) {
    const on = S.sel === m.key;
    const home = m.choice.do === 'subway' && m.choice.to === 'park' && !m.choice.hop;
    const words = label ?? moveWords(m);
    const said = m.available ? words[1] : shortWhy(m);
    const full = m.available ? `${m.label}${words[2] ? ` · ${words[2]}` : ''}` : `${m.label}: ${m.why}`;
    // (trust-1: robbing and the bins can be told on: the chance, in the danger's colour, beside its own odds; who, in
    // the tooltip. Nothing when nobody against you is about here)
    const tell = m.available && m.tellRisk?.pct ? h('em', { class: 'rn-tell-pct', title: cap(m.tellRisk.text ?? '') }, `${m.tellRisk.pct}% told`) : null;
    return h('button', { class: `hk-move rn-move${on ? ' is-on' : ''}${m.available ? '' : ' is-off'}`, 'data-key': m.key, 'data-do': m.choice.do, title: `${full}${tell ? `; ${m.tellRisk.text}` : ''}`, onclick: () => pickOrGo(m.key, m.available) },
      kbd(letterOf(m) ?? (home || m.choice.do === 'inside' ? `${m.key}·H` : m.key)),
      h('span', { class: 'hk-move-text' }, h('b', null, words[0]), said ? h('span', null, said) : null, tell));
  }
  /** A move's words on the row: [its name, what it costs and risks in brief, more for its tooltip]. */
  function moveWords(m) {
    const c = m.choice;
    if (c.do === 'inside') return ['Go inside', S.v.carried ? `bank ${money(S.v.carried)}` : 'the crib'];
    if (c.do === 'subway' && c.to === 'market') return c.hop ? ['Hop it', `${m.hop.caught}% seen`, `free; heat +${m.hop.heat} if seen`] : ['Subway', money(m.fare), 'the fare, to the market'];
    if (c.do === 'subway' && c.to === 'park') return c.hop ? ['Hop home', `${m.hop.caught}% seen`, `free; heat +${m.hop.heat} if seen; this hour still counts here`] : ['Head home', money(m.fare), 'the fare; this hour still counts here'];
    if (c.do === 'out') return ['Step out', S.take ? `with ${money(S.take)}` : 'with nothing'];
    if (c.do === 'sleep') return ['Sleep', 'the day ends'];
    if (c.do === 'morning') return ['Morning', 'out and home'];
    // the street (rules-2): what each costs and risks, in the row's small type; all of it in the tooltip
    if (c.do === 'rob') return ['Rob', `${m.odds}% ${range(m.pay)} · heat +${m.winHeat} here`, `an hour and ${m.energy} energy; if it fails, heat +${m.failHeat} here; ${m.left} worth robbing left today${m.oddsWhy?.length ? `; ${m.oddsWhy.join(', ')}` : ''}`];
    if (c.do === 'bins') {
      const best = m.finds[m.finds.length - 1];
      // (an hour and an energy, as every job: said in the tooltip and the All moves panel, as the jobs say it on the dock)
      return ['Bins', `${best.pct}% ${range(best.pay)}${m.seen ? ` · ${m.seen.pct}% seen` : ''}`,
        `an hour and ${m.energy} energy: ${m.finds.map(f => (f.pay[1] ? `${f.pct}% ${range(f.pay)}` : `${f.pct}% nothing`)).join(', ')}${m.seen ? `; ${m.seen.pct}% a ${m.seen.role} sees you: one with you looks away, anyone else ${cfg.moods[m.seen.mood]} (trust ${signedT(m.seen.trust ?? 0)})` : ''}; ${m.left} left to dig today`];
    }
    if (c.do === 'shop') {
      const it = S.v.shopHere.find(s => s.item === c.item);
      const gives = Object.entries(it?.gives ?? {}).map(([k, n]) => `${k} +${n}`).join(', ');
      return [`${cap(shortName(it?.label ?? m.label))} ${money(m.price)}`, gives || it?.does || '', `${it?.does ?? ''}${it?.left !== null && it?.left !== undefined ? `; ${it.left} left today` : ''}; no hour`];
    }
    if (c.do === 'rough') return ['Sleep rough', `${m.robbedPct}% robbed · wake at ${m.morningEnergy}`, 'the day ends here; you wake here at noon, your own heat not cooled'];
    if (c.do === 'give') return [`Give ${money(m.amount)}`, 'from banked'];
    if (c.do === 'refuse') return ['Shut the door', `${cfg.regulars.fightPct}% he swings`];
    return [m.label, ''];
  }
  /** The letter a move of the street or the door answers to (the numbers still pick them too). */
  const LETTER = { rob: 'R', bins: 'B', shop: 'E', rough: 'Z', give: 'G', refuse: 'X' };
  const letterOf = m => LETTER[m.choice.do] ?? null;
  /** Why a move cannot be made, short enough for the row (the whole of it in its tooltip). */
  function shortWhy(m) {
    const w = m.why ?? '';
    if (/box cutter/.test(w)) return 'needs the box cutter';
    if (/nobody worth robbing/.test(w)) return 'nobody about today';
    if (/picked clean/.test(w)) return 'picked clean today';
    if (/had today/.test(w)) return 'had today\'s';
    if (/^no energy left/.test(w)) return 'no energy';
    if (/energy is full/.test(w)) return 'energy full';
    if (/you need energy/.test(w)) return w.replace('you need energy', 'needs energy').replace(' to get there and back', '');
    return w;
  }
  function confirmBtn() {
    const c = S.sel ? S.v.choices.find(x => x.key === S.sel) : null;
    return h('button', { class: 'k-btn is-primary hk-confirm rn-go', disabled: !c?.available, title: c ? `Go: ${c.label}` : 'Pick one first', onclick: () => confirm() }, 'Go', kbd('Enter'));
  }

  /** At the crib: the three things to buy; stepping out (with cash if you like), sleep. A regular at the door first. */
  function cribParts(v) {
    if (v.door) return doorParts(v);
    const shop = h('div', { class: 'rn-options rn-shop' }, v.shop.map(s => {
      const on = S.sel === s.key;
      return h('button', { class: `rn-option${on ? ' is-on' : ''}${s.available ? '' : ' is-off'}${s.owned ? ' is-owned' : ''}`, 'data-key': s.key ?? '', title: `${s.label}: ${s.does}`, onclick: () => s.key && pickOrGo(s.key, s.available) },
        h('span', { class: 'rn-o-main' }, s.key ? kbd(s.key) : null, h('b', { class: 'rn-o-name' }, s.label), h('span', { class: 'rn-pay' }, money(s.price)),
          s.owned ? h('span', { class: 'hk-tag is-yours rn-odds' }, 'owned') : null),
        h('span', { class: 'rn-o-sub' }, s.available || s.owned ? null : h('span', { class: 'hk-tag is-why' }, s.why), h('span', { class: 'rn-does' }, s.does)));
    }));
    const out = v.moves.find(m => m.choice.do === 'out');
    const sleep = v.moves.find(m => m.choice.do === 'sleep');
    const max = out?.takeOut?.max ?? 0;
    S.take = Math.min(S.take, max);
    const bump = n => {
      S.take = Math.max(0, Math.min(max, S.take + n));
      S.sel = out.key;
      picked();
      paint();
    };
    const taking = out && max > 0 ? h('div', { class: 'rn-take', title: 'What you take out of the bank when you step out' }, h('span', null, 'Take'),
      h('button', { class: 'k-btn hk-bump', onclick: () => bump(-10), disabled: !S.take }, '−10'),
      h('button', { class: 'k-btn hk-bump', onclick: () => bump(-1), disabled: !S.take }, '−1'),
      h('b', null, money(S.take)),
      h('button', { class: 'k-btn hk-bump', onclick: () => bump(1), disabled: S.take >= max }, '+1'),
      h('button', { class: 'k-btn hk-bump', onclick: () => bump(10), disabled: S.take >= max }, '+10'),
      h('button', { class: 'k-btn hk-bump', onclick: () => { S.take = Math.min(max, cfg.subway.fare); S.sel = out.key; picked(); paint(); } }, `fare ${money(cfg.subway.fare)}`)) : null;
    return [shop, [out ? moveBtn(out) : null, taking, sleep ? moveBtn(sleep) : null]];
  }

  /**
   * A REGULAR AT YOUR DOOR, before anything else: who and what they want are the row's words (saidEl); the two
   * answers are the tiles, give first; the third says what stepping out or sleeping does (it shuts the door on them).
   * Buying waits (its numbers still work, and the Stuff panel lists it).
   */
  function doorParts(v) {
    const give = v.moves.find(m => m.choice.do === 'give');
    const refuse = v.moves.find(m => m.choice.do === 'refuse');
    const p = (v.people ?? []).find(q => q.id === v.door.id);
    const t = (v.trust ?? []).find(q => q.id === v.door.id);
    const note = h('div', { class: 'rn-option rn-door-note is-off', 'aria-hidden': 'true' },
      h('span', { class: 'rn-o-main' }, h('b', { class: 'rn-o-name' }, `${cap(v.door.name)} at the door`), h('span', { class: 'rn-pay' }, `wants ${money(v.door.wants)}`)),
      h('span', { class: 'rn-o-sub' }, trustMark(t, { short: true }), p?.regular ? h('span', { class: 'rn-hooked is-hooked' }, hookedShort(cfg, p.regular)) : null, h('span', { class: 'rn-does' }, 'Step out or sleep and you shut the door on him too')));
    const tiles = h('div', { class: 'rn-options rn-door' }, [give ? moveTile(give) : null, refuse ? moveTile(refuse) : null, note]);
    const out = v.moves.find(m => m.choice.do === 'out');
    const sleep = v.moves.find(m => m.choice.do === 'sleep');
    return [tiles, [out ? moveBtn(out, ['Step out', 'past him']) : null, sleep ? moveBtn(sleep, ['Sleep', 'door shut']) : null]];
  }

  /** In the jail or the clinic: the day is over; the morning out. */
  function heldParts(v) {
    const m = v.moves.find(x => x.choice.do === 'morning');
    return [h('div', { class: 'hk-held rn-held' }, h('b', null, v.place === 'jail' ? 'In jail' : 'In the clinic'),
      h('span', null, v.place === 'jail' ? 'Your day is over. What you carried is gone.' : 'Your day is over. Tomorrow starts tired.')), [m ? moveBtn(m) : null]];
  }

  // ── choosing ────────────────────────────────────────────────────────────────────────────────────────────────────
  /** From a panel: a move picked on the bar (its key lit there), or, `go`, made at once (the Stuff panel's Buy). */
  function fromPanel(key, go) {
    if (S.phase !== 'choose') return;
    const c = S.v.choices.find(x => x.key === key);
    if (!c) return;
    S.sel = key;
    picked();
    if (go && c.available) return confirm();
    if (!c.available) toast(c.why);
    paint();
  }
  function pickOrGo(key, available) {
    if (S.phase !== 'choose') return;
    if (S.sel === key && available) return confirm();
    S.sel = key;
    picked();
    paint();
  }
  function confirm() {
    if (S.phase !== 'choose' || !S.sel) return;
    const c = S.v.choices.find(x => x.key === S.sel);
    if (!c) return;
    if (!c.available) return toast(c.why);
    // (an option done to another of its targets than the one dealt names them: { do: 'job', id, who })
    const o = c.choice.do === 'job' ? S.v.options.find(x => x.key === c.key) : null;
    const who = o && targetIndex(o) ? targetOf(o)?.id : null;
    send(c.choice.do === 'out' ? { ...c.choice, take: S.take } : who ? { ...c.choice, who } : c.choice);
  }
  function toast(text) {
    const t = h('div', { class: 'hk-toast is-bad' }, text);
    el.toasts.append(t);
    setTimeout(() => t.remove(), 2400);
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const mine = keyOf(e);
    // (once the kit's map is in the page, its own keys listen on the window after ours: a key that was ours goes no
    // further, nor B, the city's own key for its full-screen map. Its + − 0, W and the arrows still reach it)
    if (runMap.loaded && (mine || e.key === 'b' || e.key === 'B')) e.stopImmediatePropagation();
  }
  /** One key: true when it was the run's. */
  function keyOf(e) {
    const k = e.key;
    // THE PANELS, THE DOCK AND THE BAR, in every phase: C A S M open one (again: close it), D folds the dock, F the bar,
    // Esc closes one thing (a card on the map first, then the panel; with none open, the danger's small print)
    const sheet = SHEETS.find(s => s.key === k.toUpperCase());
    if (sheet && k.length === 1) {
      e.preventDefault();
      openSheet(sheet.id);
      return true;
    }
    if (k === 'd' || k === 'D') {
      e.preventDefault();
      toggleDock();
      return true;
    }
    if (k === 'f' || k === 'F') {
      e.preventDefault();
      toggleBar();
      return true;
    }
    if (k === 'Escape' && S.sheet) {
      if (!(S.sheet === 'map' && runMap.closeOne())) openSheet(null);
      return true;
    }
    if (k === 'Escape' && S.dangerOpen && S.v.danger.here) {
      S.dangerOpen = false;
      paint();
      return true;
    }
    if (S.onPress && (k === 'Enter' || k === ' ')) {
      e.preventDefault();
      S.onPress();
      return true;
    }
    if (S.phase === 'playing' && (k === ' ' || k === 'Enter')) {
      e.preventDefault();
      skip();
      return true;
    }
    if (S.phase !== 'choose') return false;
    if (k === 'Enter') {
      e.preventDefault();
      // (one way on, nothing picked: the morning out of the jail or the clinic)
      if (!S.sel) {
        const only = S.v.choices.filter(c => c.available);
        if (only.length === 1) S.sel = only[0].key;
      }
      confirm();
      return true;
    }
    if (/^[1-9]$/.test(k)) {
      const c = S.v.choices.find(x => x.key === k);
      if (!c) return false;
      e.preventDefault();
      // (an option's number again, while it is the pick: its next target, when it has more than one)
      const o = S.sel === k && c.job ? S.v.options.find(x => x.key === k) : null;
      if (o && o.targets?.length > 1) {
        cycleTarget(o);
        return true;
      }
      S.sel = k;
      picked();
      paint();
      return true;
    }
    // T: the picked option's next target (or the first option that has more than one)
    if (k === 't' || k === 'T') {
      const o = S.v.options.find(x => x.key === S.sel && x.targets?.length > 1) ?? S.v.options.find(x => x.targets?.length > 1 && x.available);
      if (!o) return false;
      e.preventDefault();
      cycleTarget(o);
      return true;
    }
    // THE STREET'S AND THE DOOR'S LETTERS (rules-2): R rob somebody passing, B the bins, E the place's shop (its first
    // thing: the energy drink), Z sleep rough, G give the regular at your door what they ask, X shut the door on them.
    // A letter picks on the bar as a number does; the same letter again (or Enter) goes
    const letter = Object.entries(LETTER).find(([, L]) => L === k.toUpperCase());
    if (letter && k.length === 1) {
      const all = S.v.choices.filter(c => c.choice.do === letter[0]);
      const c = all.find(x => x.available) ?? all[0];
      if (!c) return false;
      e.preventDefault();
      if (S.sel === c.key && c.available) return confirm(), true;
      S.sel = c.key;
      picked();
      paint();
      if (!c.available) toast(c.why);
      return true;
    }
    if (k === 'h' || k === 'H') {
      const home = S.v.choices.filter(c => c.choice.do === 'inside' || (c.choice.do === 'subway' && c.choice.to === 'park'));
      const c = home.find(x => x.available && !x.choice.hop) ?? home.find(x => x.available);
      if (!c) return false;
      e.preventDefault();
      S.sel = c.key;
      picked();
      paint();
      return true;
    }
    return false;
  }
  addEventListener('keydown', onKey, true);

  // ── the day's report, and done ──────────────────────────────────────────────────────────────────────────────────
  function reportOf(start, before, state, events) {
    const b = state.books;
    const day = before.day;
    const rough = events.some(e => e.type === 'rough');
    const where = rough ? `on the street ${cfg.places[before.place]?.where ?? ''}`.trim() : before.place === 'jail' ? 'in jail' : before.place === 'clinic' ? 'in the clinic' : 'at home';
    // (a night on the street: what it took, said; and a regular at the door in the morning)
    const robbed = events.find(e => e.type === 'robbed');
    const night = rough ? (robbed ? robbed.text : 'Nobody touched you.') : null;
    const door = events.find(e => e.type === 'door')?.text ?? null;
    // (trust-1: the night's drift, in one short line, only when it moved someone across a band)
    const drift = events.find(e => e.type === 'drift' && (e.changes ?? []).some(c => c.band !== c.bandWas))?.text ?? null;
    return {
      day, where, banked: state.banked, night, door, drift, rough, carried: state.carried,
      rows: [
        ['Earned', b.earned - start.earned, 'good'], ['Taken', b.jumped - start.jumped, 'bad'], ['Seized', b.seized - start.seized, 'bad'],
        ['Fares', b.fares - start.fares, ''], ['Spent', b.spent - start.spent, ''], ['Banked now', state.banked, 'good'],
      ],
      kept: events.find(e => e.type === 'released')?.money?.[0]?.amount ?? 0,
      energy: state.energy, owned: view(cfg, state).ownedLabels,
    };
  }
  function showReport(r) {
    const plate = h('div', { class: 'hk-screen' }, h('div', { class: 'hk-plate rn-report' },
      h('header', null, h('span', { class: 'hk-kicker' }, `Day ${r.day} is over`), h('h1', null, `The night ${r.where}`),
        r.night ? h('p', { class: `rn-night${/took|gone/.test(r.night) ? ' is-bad' : ''}` }, r.night) : null,
        h('p', null, `Day ${r.day + 1} next: you wake ${r.rough ? 'there, on the street, ' : ''}with energy ${r.energy}${r.rough && r.carried ? `, carrying ${money(r.carried)}` : ''}.${r.kept ? ` The pocket kept ${money(r.kept)}: banked.` : ''}`),
        r.drift ? h('p', { class: 'rn-night is-trust' }, r.drift) : null,
        r.door ? h('p', { class: 'rn-night is-door' }, r.door) : null),
      h('div', { class: 'hk-ledger' }, r.rows.map(([label, n, tone]) => h('div', { class: n && tone ? `is-${tone}` : '' }, h('span', null, label), h('b', null, money(n))))),
      h('p', { class: 'hk-fine' }, r.owned.length ? `You own: ${r.owned.join(', ').toLowerCase()}.` : 'You own a mattress on the floor.'),
      h('div', { class: 'hk-night-foot' }, h('button', { class: 'k-btn is-primary hk-go', onclick: () => S.onPress?.() }, `Day ${r.day + 1}`, kbd('Enter')))));
    return overlay(plate, 900);
  }
  function showDone(days) {
    const plate = h('div', { class: 'hk-screen' }, h('div', { class: 'hk-plate rn-report rn-done' },
      h('header', null, h('span', { class: 'hk-kicker' }, 'All three owned'), h('h1', null, `Done in ${days} day${days === 1 ? '' : 's'}`),
        h('p', null, 'The pocket, the box cutter and the bed. Play goes on as long as you like.')),
      h('div', { class: 'hk-night-foot' }, h('button', { class: 'k-btn is-primary hk-go', onclick: () => S.onPress?.() }, 'Keep playing', kbd('Enter')))));
    return overlay(plate, 900);
  }
  async function overlay(node, auto) {
    el.overlay.replaceChildren(node);
    el.overlay.classList.add('is-on');
    await press(opts.pilot ? auto : null);
    el.overlay.classList.remove('is-on');
    el.overlay.replaceChildren();
  }

  const api = {
    get state() {
      return S.state;
    },
    get view() {
      return S.v;
    },
    get phase() {
      return S.phase;
    },
    get steps() {
      return S.steps;
    },
    skip,
    root,
    /**
     * FOR THE TOOLS (demo/tools/run-shots.mjs): carries on from another run state (a day further on, money banked, a
     * rigged roll: state.rig, src/contest.mjs). The player is put where it has them at once. Only between choices.
     */
    async load(state) {
      if (S.phase !== 'choose' || !S.resolve) return false;
      S.state = state;
      S.v = view(cfg, state);
      S.dayStart = ledgerOf(state);
      S.result = null;
      S.rose = null;
      S.notice = null;
      S.dangerOpen = false;
      S.sel = wayOnKey(S.v);
      S.targets = {};
      await dipped(() => playOn(state.place === 'crib' && state.door ? morningLine(state) : lineOf({ day: state.day, hour: state.hour, place: state.place, taken: state.place === 'jail' || state.place === 'clinic' ? 'market' : null }), { instant: true }));
      // (a regular at the door of the state loaded: the player comes out to him, as on a morning)
      if (state.place === 'crib' && state.door) await doorAt(state);
      paint();
      return true;
    },
    /** For the tools: the picked option's next target, as T would. */
    target(key = null) {
      const o = S.v.options.find(x => x.key === (key ?? S.sel) && x.targets?.length > 1);
      if (!o) return null;
      cycleTarget(o);
      return targetOf(o)?.id ?? null;
    },
    /** For the tools: opens a panel ('character', 'moves', 'stuff', 'map'; null closes), as its key would. */
    panel(id = null) {
      if ((S.sheet ?? null) !== id) openSheet(id);
      return S.sheet ?? null;
    },
    /** For the tools: folds the dock to its rail (true) or opens it (false), as D would; kept in this browser. */
    fold(rail) {
      if (isRail() !== !!rail) toggleDock(!!rail);
      return isRail();
    },
    /** For the tools: folds the bar to its one row (true) or opens it (false), as F would; kept in this browser. */
    bar(fold) {
      if (barFolded() !== !!fold) toggleBar(!!fold);
      return barFolded();
    },
    /** For the tools: the danger's small print open (true) or folded, as a click on the number would. */
    print(on) {
      if (!!S.dangerOpen !== !!on && S.v.danger.here) togglePrint();
      return !!S.dangerOpen;
    },
    /** For the tools: the map panel's map (map.js: stats, view, setView, focusYou, card, opening). */
    get map() {
      return runMap;
    },
    /** For the tools: the portrait's state (whether it is the stage's own look of the player, and drawn). */
    get face() {
      return { honest: face.honest, asked: face.asked, small: face.small.dataset.state ?? null, big: face.big.canvas.dataset.state ?? null, playing: !!face.big.player?.playing };
    },
    /** For the tools: picks a choice by its key, as a press of that number would. */
    pick(key) {
      if (S.phase !== 'choose') return false;
      S.sel = String(key);
      picked();
      paint();
      return true;
    },
    stop() {
      S.dead = true;
      removeEventListener('keydown', onKey, true);
    },
  };
  start().catch(err => {
    console.error('[run] the run stopped:', err);
    opts.onError?.(err);
  });
  return api;
}

function ledgerOf(state) {
  return { ...state.books, banked: state.banked };
}
