// The HUD (SPEC section 24): everything a person reads and clicks over the 3D city. One call mounts it:
//
//   mountHud(rootEl, { stage, seed?, mode?, seat? })
//
// It owns the game loop: read what the session waits on, wait for the human where one is needed, step, hand each hour
// to the stage, update the panels, repeat. The stage is anything that answers playHour, screenOf, focus, onPick and
// setClock (demo/hud/stage-stub.js is the dev stand-in). Watching shows everything; playing and coaching show only
// what the seat may see (demo/hud/logic.js, seenOf).
//
// The arrangement leaves the window to the game. With nothing opened there is a slim line across the top (the clock,
// who you are, cash, heat, speed), a thin rail of buttons on each edge, and one compact move card at the bottom
// centre: the latest thing that happened and the hour's best two or three moves. Everything else lives in drawers
// that a rail button opens beside its rail, one a side: You, Here, Ahead, Plate on the left; Moves, Offers, Rank, Log
// and Game on the right. Esc, the same button, or a click on the game closes a drawer.
//
// Other options: `pilot` answers for the human (the selftest and the screenshot tools use it), `storage: false` keeps
// the season and the open drawers out of localStorage, `intro: false` skips the one-screen explainer, `onState(name)`
// hears each screen change.

import { h, fill, ensureStyles, makeRoot, face, clsTag, oddsEl, miniOddsEl } from './dom.js';
import { createAir } from './air.js';
import { startScreen, howScreen, nightScreen, nightBrief, endScreen, revealScreen } from './screens.js';
import {
  seenOf, talkOf, tickerOf, scheduleOf, groupMenu, rowByNumber, argSpec, choiceOf, forecastStrip, forecastStripAll, comingFor,
  stopReason, dayLedger, liveStandings, linesFor, guideFor, tradeDone, errandsOf, sortOffers, isStaple, stapleValues, ordinal, plainHours, TIGHTEST,
  plainMove, bestMoves, numberMoves, clearShare, termsLine, SITUATION_WORDS, MODE_TEXT, SKILL_TEXT, money, nameOf, clockOf,
} from './logic.js';
import { CONFIG } from '../../src/config.mjs';
import { createSession, restoreSession, skillPreview } from '../../src/session.mjs';
import { forecastWords, possessive } from '../../src/words.mjs';
import { DEFAULT_BUILD } from '../../src/skills.mjs';
import { episodeHtml } from '../../src/episode.mjs';

const SAVE_KEY = 'hotkey2.hud.season.v1';
const GUIDE_KEY = 'hotkey2.hud.guide.off';
const DRAWER_KEY = 'hotkey2.hud.drawers.v1';
const kbd = key => h('kbd', null, key);
const placeName = (game, id) => game.map.blocks[id]?.name ?? game.map.held?.[id]?.name ?? id;
const shortBlock = (game, id) => placeName(game, id).replace(/^the /, '');

const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // a full or closed store only costs the "carry on" offer
    }
  },
  drop(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // nothing to drop
    }
  },
};

// The rails: [drawer id, label, key]. A label is six letters at most: the rail is about fifty pixels wide.
const RAILS = {
  play: { left: [['you', 'You'], ['here', 'Here'], ['ahead', 'Ahead'], ['plate', 'Plate']], right: [['moves', 'Moves', 'M'], ['offers', 'Offers', 'O'], ['rank', 'Rank', 'T'], ['log', 'Log', 'L'], ['help', 'Help'], ['game', 'Game']] },
  coach: { left: [['you', 'Agent'], ['here', 'Here'], ['ahead', 'Ahead'], ['plate', 'Plate']], right: [['rank', 'Rank', 'T'], ['log', 'Log', 'L'], ['help', 'Help'], ['game', 'Game']] },
  watch: { left: [['you', 'Who'], ['ahead', 'Ahead']], right: [['rank', 'Rank', 'T'], ['log', 'Log', 'L'], ['game', 'Game']] },
};
const DRAWER_TITLES = {
  you: 'You', here: 'Where you are', ahead: 'What is coming today', plate: 'On your plate', moves: 'Every move this hour', offers: 'Offers', rank: 'Standings',
  log: 'What happened', game: 'The game', say: 'Say something',
};
const ICONS = {
  you: '<circle cx="8" cy="4.6" r="3.1"/><path d="M2 15c.4-4.2 2.6-5.8 6-5.8s5.6 1.6 6 5.8z"/>',
  here: '<path d="M8 1a5 5 0 0 1 5 5c0 3.6-5 9.4-5 9.4S3 9.6 3 6a5 5 0 0 1 5-5zm0 3.2a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8z" fill-rule="evenodd"/>',
  ahead: '<path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 2a5 5 0 1 0 0 10A5 5 0 0 0 8 3zm-.9 1.6h1.8v3l2.3 1.5-1 1.5-3.1-2z" fill-rule="evenodd"/>',
  plate: '<path d="M2 2h12v2.4H2zM2 6.8h12v2.4H2zM2 11.6h8v2.4H2z"/>',
  moves: '<path d="M3 1.5l11 6.5-11 6.5z"/>',
  offers: '<path d="M1.5 1.5h6.2l6.8 6.8-6.2 6.2-6.8-6.8zm3.4 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" fill-rule="evenodd"/>',
  rank: '<path d="M1.5 14.5v-5h3.4v5zM6.3 14.5v-13h3.4v13zM11.1 14.5v-9h3.4v9z"/>',
  log: '<path d="M1.5 2h2.4v2.4H1.5zM5.5 2h9v2.4h-9zM1.5 6.8h2.4v2.4H1.5zM5.5 6.8h9v2.4h-9zM1.5 11.6h2.4V14H1.5zM5.5 11.6h9V14h-9z"/>',
  help: '<path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 2.6c-1.7 0-2.9 1-3 2.6h1.9c.1-.6.5-1 1.1-1s1 .4 1 .9c0 1.1-1.9 1.2-1.9 3.2h1.8c0-1.300 2-1.500 2-3.400 0-1.400-1.200-2.300-2.900-2.300zM7.100 10.400h1.800v1.800H7.100z" fill-rule="evenodd"/>',
  game: '<path d="M3 2h3.6v12H3zM9.400 2H13v12H9.400z"/>',
};
const icon = id => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[id] ?? '';
  return svg;
};

export function mountHud(rootEl, opts = {}) {
  const stage = opts.stage;
  if (!stage) throw new Error('mountHud needs a stage');
  ensureStyles();
  const root = makeRoot(rootEl);
  const useStore = opts.storage !== false;

  // ---- the frame: a slim line across the top, a thin rail on each edge whose buttons open one drawer a side, and
  // one compact move card at the bottom centre. The rest of the window is the game.
  const el = {
    top: h('header', { class: 'hk-top hk-panel' }),
    railL: h('nav', { class: 'hk-rail is-left hk-panel', 'aria-label': 'Your seat' }),
    railR: h('nav', { class: 'hk-rail is-right hk-panel', 'aria-label': 'The game' }),
    left: h('section', { class: 'hk-drawer is-left hk-panel' }),
    right: h('section', { class: 'hk-drawer is-right hk-panel' }),
    card: h('section', { class: 'hk-move-card hk-panel', 'aria-label': 'Your move' }),
    you: h('div', { class: 'hk-you-tag' }, 'this is you'),
    mark: h('aside', { class: 'hk-mark', role: 'note' }),
    overlay: h('div', { class: 'hk-overlay' }),
    toasts: h('div', { class: 'hk-toasts', role: 'status' }),
  };
  const tickerHead = h('div', { class: 'hk-ticker-head' });
  const tickerRows = h('ol', { class: 'hk-ticker-rows', 'aria-live': 'polite' });
  const tick = h('p', { class: 'hk-card-tick' });
  root.append(el.top, el.railL, el.railR, el.left, el.right, el.card);

  // ---- everything the HUD knows
  const S = {
    session: null, mode: null, you: null, game: null,
    pending: null, view: null, lastLine: null, forecast: null,
    speed: [1, 2, 4].includes(opts.speed) ? opts.speed : 1, paused: false, instant: false, devInstant: false, skipTo: null,
    follow: null, look: null,
    drawers: { left: null, right: null }, sayBack: null,
    groups: [], card: [], tight: 0, sel: null, values: {}, open: new Map(), accept: new Map(), heldHold: false, heldAsked: false, heldPass: false, heldNew: false, wasHeld: false, taking: false, quick: false,
    memo: { traded: false, closed: false }, guideShown: false, say: null, message: null, sayBank: null, sayTo: 'block',
    boardOpen: false, resolveMove: null, autoRun: false, latest: null,
    screen: null, guideOff: store.get(GUIDE_KEY) === '1', dawn: {}, hours: 0, state: 'boot',
  };
  let runId = 0;
  let dead = false;
  const ctx = {
    get game() { return S.game; },
    get you() { return S.you; },
    get mode() { return S.mode; },
    stage,
    portraits: new Map(),
    wait,
    speed: () => S.speed,
    safe,
    onPause(fn, node) {
      pauseHooks.add({ fn, node });
    },
    skillName: s => SKILL_TEXT[s]?.[0] ?? s,
  };
  const pauseHooks = new Set();
  const air = createAir(root, ctx);
  root.append(el.you, el.mark, el.overlay, el.toasts);
  const name = id => nameOf(S.game, id);

  function setState(state) {
    S.state = state;
    root.dataset.state = state;
    opts.onState?.(state);
  }

  // ---- time: every pause in the playback goes through here, so speed and the pause key reach all of it
  function wait(ms) {
    return new Promise(resolve => {
      if (S.instant || dead || ms <= 0) return resolve();
      let left = ms;
      let last = performance.now();
      const tick = () => {
        const now = performance.now();
        if (!S.paused) left -= (now - last) * S.speed;
        last = now;
        if (left <= 0 || S.instant || dead) resolve();
        else setTimeout(tick, Math.max(8, Math.min(60, left / S.speed)));
      };
      setTimeout(tick, Math.min(60, ms / S.speed));
    });
  }
  const breathe = () => new Promise(resolve => setTimeout(resolve, 0));

  /** The part of the window no panel covers, where bubbles, the roll card and the caption may go. */
  function safe() {
    const box = node => (node.offsetWidth ? node.getBoundingClientRect() : null);
    const top = (box(el.top)?.bottom ?? 0) + 8;
    const left = (box(el.left)?.right ?? box(el.railL)?.right ?? 0) + 8;
    const right = (box(el.right)?.left ?? box(el.railR)?.left ?? innerWidth) - 8;
    const bottom = (box(el.card)?.top ?? innerHeight) - 8;
    return { top, left, right: Math.max(left + 200, right), bottom: Math.max(top + 120, bottom) };
  }

  function toast(text, ms = 2600) {
    if (S.instant) return;
    const t = h('div', { class: 'hk-toast' }, text);
    el.toasts.append(t);
    while (el.toasts.children.length > 2) el.toasts.firstChild.remove();
    setTimeout(() => t.remove(), ms);
  }

  function fail(err) {
    console.error('[hud]', err);
    api.error = err;
    opts.onError?.(err);
    el.toasts.append(h('div', { class: 'hk-toast is-bad' }, `The game stopped: ${err?.message ?? err}`));
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Saving: the season survives a reload, and so do the drawers the player keeps open

  function save() {
    if (!useStore || !S.session) return;
    if (S.game.state.phase === 'over') return store.drop(SAVE_KEY);
    try {
      store.set(SAVE_KEY, JSON.stringify(S.session.save()));
    } catch {
      // a season too big for the store plays on unsaved
    }
  }

  function savedSeason() {
    if (!useStore) return null;
    try {
      const saved = JSON.parse(store.get(SAVE_KEY) ?? 'null');
      if (saved?.v !== 1 || !saved.state || saved.state.phase === 'over') return null;
      const cfg = CONFIG;
      const t = saved.state.t;
      const where = saved.state.phase === 'pre' ? 'before the first hour' : `day ${Math.floor(Math.max(0, saved.state.phase === 'night' ? t - 1 : t) / cfg.season.hoursPerDay) + 1}${saved.state.phase === 'night' ? ', at night' : `, ${cfg.season.firstHour + (t % cfg.season.hoursPerDay)}:00`}`;
      return { saved, mode: saved.mode, seat: saved.seat, seed: saved.seed, where };
    } catch {
      return null;
    }
  }

  function keptDrawers(mode) {
    if (!useStore) return { left: null, right: null };
    try {
      const kept = JSON.parse(store.get(DRAWER_KEY) ?? '{}')[mode] ?? {};
      const known = side => (RAILS[mode][side].some(([id]) => id === kept[side] && id !== 'help') ? kept[side] : null);
      return { left: known('left'), right: known('right') };
    } catch {
      return { left: null, right: null };
    }
  }
  function keepDrawers() {
    if (!useStore || !S.mode) return;
    let all = {};
    try {
      all = JSON.parse(store.get(DRAWER_KEY) ?? '{}');
    } catch {
      // a store nobody can read starts again
    }
    all[S.mode] = { left: S.drawers.left, right: S.drawers.right === 'say' ? S.sayBack : S.drawers.right };
    store.set(DRAWER_KEY, JSON.stringify(all));
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Screens over everything: start, how to play, night, end, reveal

  function show(screen, state) {
    S.screen = screen;
    el.overlay.replaceChildren(screen.el);
    el.overlay.classList.add('is-on');
    setState(state);
  }
  function hide() {
    S.screen = null;
    el.overlay.classList.remove('is-on');
    el.overlay.replaceChildren();
  }

  function showStart() {
    runId += 1;
    S.session = null;
    S.resolveMove = null;
    root.dataset.mode = 'start';
    air.clear();
    for (const part of [el.top, el.railL, el.railR, el.left, el.right, el.card, tickerRows, tickerHead, el.mark]) part.replaceChildren();
    for (const part of [el.left, el.right, el.mark, el.you]) part.classList.remove('is-on');
    const waiting = savedSeason();
    show(startScreen(ctx, {
      seed: opts.seed ?? 1 + Math.floor(Math.random() * 9999), mode: opts.mode ?? 'play', seat: opts.seat ?? 'dealer', saved: waiting,
      onStart: begin,
      onResume: () => begin({ saved: waiting.saved }),
      onDiscard: () => {
        store.drop(SAVE_KEY);
        showStart();
      },
    }), 'start');
  }

  /** The one-screen explainer for the seat: the goal and its loop in three steps. `then` runs when it is closed. */
  function showHow(then = null) {
    if (!S.you) return then?.();
    const back = S.screen;
    const was = S.state;
    return show(howScreen(ctx, {
      first: !!then,
      onDone() {
        if (back) show(back, was);
        else {
          hide();
          setState(was === 'how' ? 'boot' : was);
        }
        then?.();
        repaint();
      },
    }), 'how');
  }

  function begin({ mode, seat, seed, saved = null }) {
    hide();
    const session = saved ? restoreSession(saved) : createSession({ seed, mode, seat });
    Object.assign(S, {
      session, mode: session.mode, you: session.you, game: session.game, pending: null, view: null, lastLine: null, forecast: null,
      follow: null, look: null, autoRun: false, skipTo: null, instant: S.devInstant || !!opts.pilot?.instant, paused: false, dawn: {}, hours: 0, latest: null,
      drawers: keptDrawers(session.mode), sel: null, resolveMove: null,
    });
    // a season carried on mid-way has already had its first trade, or not: the guide picks up from the feed
    const traded = !!S.you && S.game.feed.some(l => l.type === 'hour' && tradeDone(l, S.you));
    S.memo = { traded, closed: traded };
    S.forecast = S.game.feed.findLast?.(l => l.type === 'forecast') ?? null;
    S.lastLine = S.game.feed.findLast?.(l => l.type === 'hour') ?? null;
    root.dataset.mode = S.mode;
    ctx.portraits.clear();
    tickerRows.replaceChildren();
    tick.textContent = '';
    // a season carried on after a reload opens on its last hour, so the log isn't blank
    if (S.lastLine) {
      tickerHead.replaceChildren(h('b', null, `Day ${S.lastLine.day} · the ${S.lastLine.hour}:00 hour`), h('span', null, 'where you left off'));
      for (const row of tickerOf(S.lastLine, S.game, { you: S.you, mode: S.mode })) pushRow(row);
    }
    stage.begin?.({ game: S.game, you: S.you, mode: S.mode });
    if (S.you) stage.markPlayer?.(S.you);
    stage.onPick(pick);
    // (the player's own trip is on the picture, or no longer: the card offers to skip it)
    stage.onTravel?.(on => {
      S.travelling = !!on;
      repaint();
    });
    stage.setSpeed?.(S.speed);
    const run = ++runId;
    const go = () => loop(run).catch(fail);
    // a new season in a seat opens on the explainer: the goal, and what this seat does, in three steps
    if (S.you && !saved && opts.intro !== false && !(opts.pilot && opts.intro !== true)) {
      paint();
      showHow(go);
    } else go();
  }

  // ---------------------------------------------------------------------------------------------------------------
  // The loop

  async function loop(run) {
    const alive = () => run === runId && !dead;
    while (alive()) {
      const p = S.session.pending();
      S.pending = p;
      if (!S.skipTo) S.instant = S.devInstant || !!opts.pilot?.instant;
      if (p.view) {
        // what the last hour did to the seat's money, shown beside the new figures
        const was = S.view?.you.id === p.view.you.id && S.view.clock.t === p.view.clock.t - 1 ? S.view.you : null;
        S.delta = was ? { cash: p.view.you.cash - was.cash, stash: p.view.you.stash - was.stash, worth: p.view.you.worth - was.worth } : null;
        S.view = p.view;
      } else if (S.mode === 'watch') S.view = S.follow ? S.session.viewOf(S.follow) : null;
      if (p.kind === 'over') {
        store.drop(SAVE_KEY);
        paint();
        showEnd(p);
        return;
      }
      let result;
      if (p.kind === 'sheet') {
        S.instant = S.devInstant || !!opts.pilot?.instant;
        S.skipTo = null;
        S.autoRun = false;
        paint();
        const sheet = await askSheet(p);
        if (!alive()) return;
        result = await S.session.step({ sheet });
      } else if (p.kind === 'move') {
        if (p.view.clock.t % S.game.cfg.season.hoursPerDay === 0) S.dawn[p.view.clock.day] ??= p.view.you.worth;
        paint();
        const reply = S.autoRun ? 'auto' : await askMove(p.view);
        if (!alive()) return;
        S.resolveMove = null;
        if (S.memo.traded && S.guideShown) S.memo.closed = true;
        S.quick = !p.view.menu.length;
        result = reply === 'auto' ? await S.session.auto() : await S.session.step({ reply });
      } else {
        paint();
        setState('hour');
        while (S.paused && !S.instant && alive()) await new Promise(r => setTimeout(r, 80));
        if (!alive()) return;
        result = await S.session.step();
      }
      save();
      for (const line of result.lines) {
        if (!alive()) return;
        await playLine(line);
        opts.onLine?.(line, api);
      }
      if (S.instant) await breathe();
    }
  }

  function askSheet(p) {
    const night = p.sheet.night > 0 ? S.game.feed.findLast(l => l.type === 'night') ?? null : null;
    const agent = S.game.state.agents[S.you];
    return new Promise(resolve => {
      const done = sheet => {
        hide();
        resolve(sheet);
      };
      show(nightScreen(ctx, {
        pending: p, night,
        // before the first hour the seat's usual first picks are already in: a first-timer can just start
        usual: night ? [] : DEFAULT_BUILD[agent.cls].slice(0, p.sheet.points),
        ledger: night ? dayLedger(S.game.feed, S.you, night.day, S.dawn[night.day] ?? null) : null,
        preview(skill, picks) {
          const copy = structuredClone(agent);
          for (const s of picks) copy.skills[s] = (copy.skills[s] ?? 0) + 1;
          return skillPreview(S.game, copy, skill);
        },
        onDone: done,
      }), night ? 'night' : 'first-sheet');
      // a pilot may hand back a filled sheet, or work the screen itself and answer nothing
      const answered = opts.pilot?.sheet?.(p, api);
      if (answered !== undefined) done(answered);
    });
  }

  /** Lay the menu out at a tightness: its groups, and the card's best moves, on one numbering. */
  function layout(tight) {
    const view = S.view;
    S.tight = tight;
    S.groups = groupMenu(view.menu, view.you.cls, { tight });
    S.card = numberMoves(S.groups, bestMoves(view, { pin: guide()?.entry ?? null }));
  }

  function askMove(view) {
    Object.assign(S, { sel: null, values: {}, open: new Map(), accept: new Map(), say: null, message: null, boardOpen: false, heldHold: false, guideShown: false });
    // (the first card of a stay: they have just been taken, and the picture is still where it happened. Free again:
    // the next stay starts by waiting for a press again)
    S.heldNew = !view.menu.length && !S.wasHeld;
    S.wasHeld = !view.menu.length;
    if (view.menu.length) S.heldPass = false;
    if (S.drawers.right === 'say') S.drawers.right = S.sayBack;
    // while a menu waits, the stage runs at the speed the top line shows, whatever the last hour did
    stage.setSpeed?.(S.paused ? 0 : S.speed);
    return new Promise(resolve => {
      S.resolveMove = resolve;
      setState(view.menu.length ? 'move' : 'held');
      repaint();
      // a pilot may answer outright, or drive the controls itself and answer nothing
      const answered = opts.pilot?.move?.(view, api);
      if (answered !== undefined) return resolve(answered);
      if (view.menu.length) return undefined;
      // HELD IN JAIL OR THE CLINIC: NOTHING TAKES THE PLAYER ANYWHERE WITHOUT A PRESS (the owner, 2026-11-12: "the cut
      // scene to the hospital or location shouldnt just jump, you should have to press continue or something"). The
      // hour that put them there holds at its end with this card up, and the cut to the jail or the clinic comes on
      // Continue; every held hour after it waits for Continue too. "Let the hours pass" is the long stretch's way
      // out: from then on the hours of this stay pass on their own after a second, as they all used to, unless an
      // offer made to the seat is waiting for an answer.
      S.heldAsked = sortOffers(view).lead.some(o => o.why === 'to you');
      S.heldHold = S.heldAsked || S.heldNew || !S.heldPass;
      repaint();
      if (S.heldHold) return undefined;
      return wait(1000).then(() => {
        if (S.resolveMove === resolve && !S.heldHold) confirm();
      });
    });
  }

  /** Send the hour: the picked move with its arguments, what was said yes to, and anything said. */
  function confirm() {
    if (!S.resolveMove) return;
    const view = S.view;
    const accept = [...S.accept].map(([id, how]) => (how.courier ? { id, courier: true } : id));
    const talk = { ...(S.say ? { say: S.say } : {}), ...(S.message ? { message: S.message } : {}) };
    if (!view.menu.length) {
      // THE FIRST CONTINUE OF A STAY IS THE TRIP THERE, NOT AN HOUR. The card came up where it happened; this press
      // asks the stage to take the player to the jail or the clinic (stage.take: a cut), and the card then stands
      // there, at the place, waiting for the next press like every held hour. A stay of one hour is two presses:
      // without this the player would be let out again without ever having seen where they were.
      if (S.heldNew && typeof stage.take === 'function') {
        if (S.taking) return undefined;
        const pending = S.resolveMove;
        S.taking = true;
        return Promise.resolve(stage.take(S.you, view.you.state)).catch(err => console.warn('[hud] the stage did not take the player there:', err)).then(() => {
          S.taking = false;
          if (S.resolveMove !== pending) return;
          S.heldNew = false;
          S.heldHold = S.heldAsked || !S.heldPass;
          repaint();
          // (asked to let the hours pass: this one does, a second after they get there)
          if (!S.heldHold) wait(1000).then(() => S.resolveMove === pending && !S.heldHold && confirm());
        });
      }
      return S.resolveMove({ accept, ...talk });
    }
    const entry = view.menu.find(m => m.id === S.sel);
    if (!entry) return toast('Pick a move first: press its number.');
    S.resolveMove({ move: choiceOf(entry, S.values[entry.id] ?? {}), accept, ...talk });
  }

  function auto(untilSomething = false) {
    if (!S.resolveMove) return;
    S.autoRun = untilSomething;
    S.resolveMove('auto');
  }

  // ---------------------------------------------------------------------------------------------------------------
  // An hour playing back

  async function playLine(line) {
    if (line.type === 'forecast') {
      S.forecast = line;
      const words = S.mode === 'watch' ? forecastWords(line.forecast, S.game) : forecastWords({ robbers: line.forecast.robbers, rival: line.forecast.rival }, S.game);
      pushRow({ text: `Day ${line.day}. ${words}`, kind: 'forecast', big: false, mine: false }, true);
      // last night's standings are public: rank and a rough bracket for everyone
      const table = S.game.state.standings;
      if (S.mode !== 'watch' && table?.rows?.length && line.day > 1) {
        const mine = table.rows.find(r => r.id === S.you);
        pushRow({ text: `Standings after night ${table.day}: ${name(table.rows[0].id)} leads (${table.rows[0].bracket}).${mine ? ` ${S.mode === 'coach' ? name(S.you) : 'You'} ${S.mode === 'coach' ? 'is' : 'are'} ${ordinal(mine.rank)} of ${table.rows.length}.` : ''}`, kind: 'news', big: false, mine: false });
      }
      return;
    }
    if (line.type === 'night') {
      if (S.mode !== 'watch') return;
      S.instant = S.devInstant || !!opts.pilot?.instant;
      S.skipTo = null;
      paint();
      paintTop({ day: line.day, hour: null });
      await new Promise(resolve => {
        const done = () => {
          hide();
          resolve();
        };
        const brief = nightBrief(ctx, { night: line, onDone: done });
        show(brief, 'night');
        if (S.instant) done();
        else wait(9000).then(() => S.screen === brief && done());
      });
      return;
    }
    if (line.type !== 'hour') return;

    S.hours += 1;
    setState('playing');
    const seen = seenOf(line, S.you, S.mode);
    const rows = tickerOf(line, S.game, { you: S.you, mode: S.mode, follow: S.follow });
    const { at, total } = scheduleOf(rows);
    const talk = talkOf(line, S.you, S.mode);
    stage.setClock({ day: line.day, hour: line.hour });
    S.playing = { day: line.day, hour: line.hour };
    paintTop(S.playing);
    repaint();
    tickerHead.replaceChildren(h('b', null, `Day ${line.day} · the ${line.hour}:00 hour`), h('span', null, S.mode === 'watch' ? 'everything that happened' : S.mode === 'coach' ? 'what your agent saw' : 'what you saw'));
    // an hour spent in jail or the clinic goes by fast: its lines land at once and nothing waits for the stage. The
    // stage itself is never hurried: it plays at the speed the top line shows, always (it ran at 8× here once, and
    // stayed there while the next move's menu waited)
    const quick = S.quick && !S.instant && S.mode === 'play';
    const staged = Promise.resolve().then(() => stage.playHour(line, { seen, speed: S.instant ? 1000 : S.speed, hurried: quick })).catch(err => console.warn('[hud] the stage dropped an hour:', err));
    if (quick) {
      for (const row of rows) pushRow(row);
      // (the stage is waited for, five seconds at most: this hour may be the cut to the jail or the clinic, or the
      // one back out, and the next card or menu must not come up before the picture is there)
      await Promise.race([staged, wait(5000)]);
      S.lastLine = line;
      if (S.you && tradeDone(line, S.you)) S.memo.traded = true;
      return;
    }

    // confessionals share the hour between them, while the ticker runs
    const loud = new Set(seen.filter(e => e.big).flatMap(e => Object.values(e.who)));
    const rank = c => (c.from === (S.follow ?? S.you) ? 0 : loud.has(c.from) ? 1 : 2);
    const confess = S.instant ? [] : talk.confessionals.slice().sort((a, b) => rank(a) - rank(b)).slice(0, 2);
    const camera = c => ({ text: `${name(c.from)}, to the camera: “${c.text}”`, kind: 'confessional', big: false, mine: c.from === S.you });
    const told = (async () => {
      for (const [i, c] of confess.entries()) {
        await wait(i === 0 ? 700 : 300);
        pushRow(camera(c));
        await air.confess(c);
      }
    })();

    let elapsed = 0;
    for (const [i, row] of rows.entries()) {
      await wait(at[i] - elapsed);
      elapsed = at[i];
      pushRow(row);
      if (S.instant) continue;
      const slot = (at[i + 1] ?? total) - at[i];
      if (row.roll) await air.roll(row.roll, Math.max(1500, slot)).then(() => { elapsed += Math.max(1500, slot); });
      else if (row.risk) await air.risk(row.risk, Math.max(1500, slot)).then(() => { elapsed += Math.max(1500, slot); });
      else if (row.kind === 'say' || row.kind === 'say:block') air.say({ from: row.event.who.speaker, to: row.event.who.listener ?? null, text: row.event.say.text });
      else if (row.kind === 'message') air.phone({ from: row.event.who.sender, to: row.event.who.receiver, text: row.event.say?.text ?? '' });
      // private business seen from outside: a phone chip with no words for whoever was thumbing one
      else if (row.kind === 'sealed') for (const id of row.texting) air.phone({ from: id, to: null, text: null });
    }
    await wait(total - elapsed);
    if (!S.instant) await Promise.all([staged, told]);
    S.lastLine = line;
    if (S.you && tradeDone(line, S.you)) S.memo.traded = true;
    for (const c of talk.confessionals) if (!confess.includes(c)) pushRow(camera(c));

    if (S.autoRun) {
      const why = stopReason(line, S.you);
      if (why) {
        S.autoRun = false;
        toast(why);
      }
    }
  }

  function pushRow(row, head = false) {
    const cls = ['hk-tick', row.big ? 'is-big' : '', row.mine ? 'is-mine' : '', head ? 'is-head' : '', row.roll || row.risk ? 'is-roll' : '',
      row.kind === 'confessional' ? 'is-camera' : '', row.kind === 'news' ? 'is-news' : '', row.kind === 'sealed' ? 'is-sealed' : ''].filter(Boolean).join(' ');
    const li = h('li', { class: cls },
      row.roll ? h('span', { class: 'hk-tick-roll', 'data-band': row.roll.outcome }, `${row.roll.P}%`) : null,
      row.risk ? h('span', { class: 'hk-tick-roll', 'data-band': row.risk.hit ? 'disaster' : 'clean' }, `${row.risk.chance}%`) : null,
      row.kind === 'news' ? h('span', { class: 'hk-tick-tag' }, 'city') : null,
      row.text);
    tickerRows.append(li);
    while (tickerRows.children.length > 80) tickerRows.firstChild.remove();
    tickerRows.scrollTop = tickerRows.scrollHeight;
    // the move card keeps the latest line; what happened to the seat itself is not pushed off it by small talk
    const weight = r => (r.mine ? 2 : 0) + (r.big ? 1 : 0);
    if (!S.latest || S.latest.hour !== S.hours || weight(row) >= weight(S.latest.row)) {
      S.latest = { hour: S.hours, row };
      tick.className = `hk-card-tick${row.big ? ' is-big' : ''}${row.mine ? ' is-mine' : ''}`;
      fill(tick, row.kind === 'news' ? h('span', { class: 'hk-tick-tag' }, 'city') : null, row.text);
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // The top line: the clock, who you are, your cash and heat, pause and speed

  function clockNow() {
    const { cfg, state } = S.game;
    const t = Math.min(state.t, cfg.season.days * cfg.season.hoursPerDay - 1);
    return { day: Math.floor(t / cfg.season.hoursPerDay) + 1, hour: cfg.season.firstHour + (t % cfg.season.hoursPerDay) };
  }

  const heatPips = heat => h('span', { class: 'hk-heat-pips' }, Array.from({ length: S.game.cfg.heat.max }, (_, i) => h('i', { class: `${i < heat ? 'is-on' : ''}${i === S.game.cfg.heat.arrestAt - 1 ? ' is-line' : ''}` })));

  function speedButtons() {
    return h('span', { class: 'hk-speeds' },
      h('button', { type: 'button', class: `k-btn${S.paused ? ' is-on' : ''}`, 'data-act': 'pause', onclick: () => setPaused(!S.paused) }, S.paused ? 'Paused' : 'Pause', kbd('Space')),
      [1, 2, 4].map(n => h('button', { type: 'button', class: `k-btn${S.speed === n && !S.paused ? ' is-on' : ''}`, 'data-act': `speed-${n}`, onclick: () => setSpeed(n) }, `${n}×`)));
  }

  function paintTop(at = null) {
    if (!S.session) return;
    const { cfg } = S.game;
    // between two days the clock reads "night": the next day's noon hasn't come
    const asleep = !at && S.game.state.phase === 'night';
    const now = asleep ? { day: Math.floor((S.game.state.t - 1) / cfg.season.hoursPerDay) + 1, hour: null } : at ?? clockNow();
    S.now = now;
    const view = S.mode === 'watch' ? null : S.view;
    const you = view?.you ?? (S.you ? S.game.state.agents[S.you] : null);
    const lastDay = now.day >= cfg.season.days;
    fill(el.top,
      h('span', { class: 'hk-mode', 'data-mode': S.mode }, MODE_TEXT[S.mode][0]),
      h('b', { class: 'hk-clock-time' }, now.hour === null ? 'Night' : `${now.hour}:00`),
      h('span', { class: 'hk-clock-day' }, `Day ${now.day}/${cfg.season.days}`),
      you ? h('span', { class: 'hk-top-you' }, S.mode === 'play' ? 'You are ' : 'Your agent: ', h('b', null, you.name), clsTag(you.cls))
        : h('span', { class: 'hk-top-you' }, S.follow ? ['Following ', h('b', null, name(S.follow)), clsTag(S.game.state.agents[S.follow].cls)] : 'Click a person to follow them'),
      you ? h('span', { class: 'hk-top-stat' }, 'Cash ', h('b', null, money(you.cash))) : null,
      you ? h('span', { class: 'hk-top-stat', title: `the police arrest at heat ${cfg.heat.arrestAt}` }, 'Heat ', heatPips(you.heat)) : null,
      lastDay ? h('span', { class: 'hk-clock-note is-hot' }, 'Final bell at midnight') : view?.clock.rentTonight ? h('span', { class: 'hk-clock-note' }, `Rent ${money(view.clock.rentTonight)} tonight`) : null,
      speedButtons());
  }

  function setPaused(on) {
    S.paused = on;
    stage.setSpeed?.(on ? 0 : S.speed);
    for (const hook of pauseHooks) {
      if (!hook.node.isConnected) pauseHooks.delete(hook);
      else hook.fn(on);
    }
    paintTop(S.state === 'playing' ? S.playing : null);
  }
  function setSpeed(n) {
    S.speed = n;
    S.paused = false;
    stage.setSpeed?.(n);
    paintTop(S.state === 'playing' ? S.playing : null);
  }
  function skipToNight() {
    S.skipTo = 'night';
    S.instant = true;
    S.paused = false;
    air.clear();
  }
  function quit() {
    save();
    showStart();
  }

  // ---------------------------------------------------------------------------------------------------------------
  // The rails and their drawers

  function toggleDrawer(side, id) {
    if (id === 'help') return showHow();
    // "You" is also the way back to yourself: the camera goes to your own agent, wherever it had been taken
    if (id === 'you' && S.you && !S.instant) stage.focus(S.you);
    if (side === 'right' && S.drawers.right === 'say' && id !== 'say') S.sayBack = null;
    S.drawers[side] = S.drawers[side] === id ? null : id;
    if (id === 'moves' && S.drawers.right === 'moves') S.open = new Map();
    keepDrawers();
    return repaint();
  }
  function closeDrawers() {
    if (!S.drawers.left && !S.drawers.right) return false;
    S.drawers = { left: null, right: null };
    keepDrawers();
    repaint();
    return true;
  }
  function toggleSay() {
    if (S.drawers.right === 'say') S.drawers.right = S.sayBack;
    else {
      S.sayBack = S.drawers.right;
      S.drawers.right = 'say';
    }
    repaint();
  }

  /** What waits behind a rail button, as a small badge: a count, or a mark. */
  function badgeOf(id) {
    const view = S.view;
    if (!view || S.mode === 'watch') return null;
    if (id === 'offers' && S.mode === 'play') return sortOffers(view).lead.length || null;
    if (id === 'plate') return view.pickups.length + view.robbed.length + view.duties.loans.filter(l => l.overdue && l.borrower === view.you.id).length || null;
    if (id === 'here') return view.here?.police ? '!' : null;
    if (id === 'ahead') return forecastStrip(view, S.game.cfg).some(c => !c.past && !c.now && (c.here.police || c.here.dunn || c.here.sixes)) ? '!' : null;
    if (id === 'you') return view.you.heat >= S.game.cfg.heat.arrestAt ? '!' : null;
    return null;
  }

  function paintRails() {
    if (!S.session) return;
    for (const side of ['left', 'right']) {
      fill(side === 'left' ? el.railL : el.railR, RAILS[S.mode][side].map(([id, label, key]) => {
        const badge = badgeOf(id);
        return h('button', { type: 'button', class: `hk-rail-btn${S.drawers[side] === id ? ' is-on' : ''}`, 'data-rail': id, 'aria-pressed': S.drawers[side] === id ? 'true' : 'false',
          title: id === 'you' && S.you ? 'You, and the camera back on your agent' : `${DRAWER_TITLES[id] ?? 'How to play'}${key ? ` (${key})` : ''}`, onclick: () => toggleDrawer(side, id) },
          icon(id), h('span', null, label), badge ? h('i', { class: 'hk-badge' }, String(badge)) : null);
      }));
    }
  }

  function seatCard(view, label) {
    const you = view.you;
    const rank = view.race?.rows.find(r => r.id === you.id)?.rank ?? null;
    const arrestAt = S.game.cfg.heat.arrestAt;
    const goods = [];
    if (you.goods.chems) goods.push(`${you.goods.chems} chems`);
    if (you.goods.parts) goods.push(`${you.goods.parts} parts`);
    for (const [q, n] of Object.entries(you.goods.product ?? {})) if (n) goods.push(`${n} product q${q}`);
    for (const [q, n] of Object.entries(you.goods.guns ?? {})) if (n) goods.push(n > 1 ? `${n} guns q${q}` : `a gun q${q}`);
    const skills = Object.entries(you.skills).filter(([, v]) => v > 0);
    const held = you.state !== 'free';
    const moved = S.mode !== 'watch' && S.delta ? ['cash', 'stash', 'worth'].filter(key => S.delta[key]).map(key => h('span', { class: `hk-tag ${S.delta[key] > 0 ? 'is-up' : 'is-down'}` }, `${key} ${S.delta[key] > 0 ? '+' : '−'}${money(Math.abs(S.delta[key]))}`)) : [];
    return h('div', { class: 'hk-card hk-seat' },
      h('div', { class: 'hk-seat-head' }, face(ctx, you.id, 'is-big'),
        h('div', null, h('b', { class: 'hk-name' }, you.name), h('div', { class: 'hk-seat-tags' }, clsTag(you.cls), h('span', { class: 'hk-tag is-yours' }, label)))),
      held ? h('div', { class: 'hk-held-line' }, you.state === 'jail' ? 'In jail' : 'In the clinic', `: out in ${you.hoursLeft} hour${you.hoursLeft === 1 ? '' : 's'}`) : null,
      h('div', { class: 'hk-stats' },
        h('div', null, h('span', null, 'Cash'), h('b', null, money(you.cash))),
        h('div', null, h('span', null, 'Stash'), h('b', null, money(you.stash))),
        h('div', null, h('span', null, 'Worth'), h('b', null, money(you.worth))),
        h('div', { title: rank ? 'as of last night' : 'the first standings come out tonight' }, h('span', null, 'Rank'), h('b', null, rank ? `${rank} of ${view.race.rows.length}` : '—'))),
      moved.length ? h('div', { class: 'hk-chipline' }, h('span', null, 'Last hour'), moved) : null,
      h('div', { class: 'hk-heat' }, h('span', null, 'Heat'),
        h('span', { class: 'hk-heat-pips' }, Array.from({ length: S.game.cfg.heat.max }, (_, i) => h('i', { class: `${i < you.heat ? 'is-on' : ''}${i === arrestAt - 1 ? ' is-line' : ''}` }))),
        h('em', { class: you.heat >= arrestAt ? 'is-bad' : '' }, you.heat >= arrestAt ? 'police will arrest you' : `arrest at ${arrestAt}`)),
      h('div', { class: 'hk-chipline' }, h('span', null, 'Carrying'), goods.length ? goods.map(g => h('span', { class: 'hk-tag' }, g)) : h('em', null, 'nothing')),
      h('div', { class: 'hk-chipline' }, h('span', null, 'Skills'), skills.length ? skills.map(([s, v]) => h('span', { class: 'hk-tag', title: SKILL_TEXT[s]?.[1] ?? '' }, `${SKILL_TEXT[s]?.[0] ?? s} ${v}`)) : h('em', null, 'none yet')));
  }

  function hereCard(view) {
    if (!view.here) return null;
    const theirs = S.mode === 'watch';
    const b = S.game.map.blocks[view.here.block];
    const notes = [];
    if (b.pads) notes.push(theirs ? 'the pads and stashes' : 'your pad and stash');
    if (b.fence) notes.push('the fence');
    if (b.gunshop) notes.push('the gun shop');
    if (b.supplier) notes.push('the docks supplier');
    if (b.police) notes.push('the police desk');
    if (view.here.buyers) notes.push(view.here.buyers.open ? `street buyers, demand ${view.here.buyers.demandPct}%${view.here.buyers.turf ? `, ${name(view.here.buyers.turf) === 'someone' ? view.here.buyers.turf : name(view.here.buyers.turf)}’s turf` : ''}` : 'street buyers, later');
    const coming = comingFor(view, S.game.cfg);
    const people = view.here.others;
    return h('div', { class: 'hk-card hk-here' },
      h('div', { class: 'hk-here-head' }, h('span', null, theirs ? `${view.you.name} is at` : 'You are at'), h('b', null, shortBlock(S.game, view.here.block)), view.here.police ? h('span', { class: 'hk-tag is-police' }, 'police here') : null),
      notes.length ? h('p', { class: 'hk-fine' }, notes.join(' · ')) : null,
      theirs ? null : h('ul', { class: 'hk-coming' }, coming.map(c => h('li', { class: c.bad ? 'is-bad' : '' }, c.text))),
      people.length ? h('ul', { class: 'hk-people' }, people.map(p => h('li', null, h('button', { type: 'button', class: `hk-person${S.look === p.id ? ' is-on' : ''}`, 'data-person': p.id, onclick: () => pick(p.id) },
        face(ctx, p.id), h('b', null, p.name), clsTag(p.cls),
        h('span', { class: 'hk-person-cash' }, typeof p.cash === 'number' ? money(p.cash) : p.cash),
        p.armed ? h('span', { class: 'hk-tag is-armed' }, 'gun') : null,
        p.heat ? h('span', { class: 'hk-heat-pips is-small', title: `heat ${p.heat}` }, Array.from({ length: p.heat }, () => h('i', { class: 'is-on' }))) : null))))
        : h('p', { class: 'hk-fine' }, 'Nobody else is on this block.'));
  }

  function dutiesCard(view) {
    const rows = [];
    for (const p of view.pickups) rows.push(h('li', null, h('b', null, 'Pick-up: '), `${p.withName} at ${placeName(S.game, p.theirBlock)}. Gives ${p.youGive}, gets ${p.youGet}. ${p.hoursLeft}h left.`));
    for (const r of view.robbed) rows.push(h('li', { class: 'is-bad' }, h('b', null, 'Robbed: '), `${r.robberName} has ${[r.cash ? money(r.cash) : null, r.goods || null].filter(Boolean).join(' and ') || 'what is left'}, at ${placeName(S.game, r.robberBlock)}. ${r.hoursLeft}h to take it back.`));
    for (const l of view.duties.loans) rows.push(h('li', { class: l.overdue ? 'is-bad' : '' }, h('b', null, l.borrower === view.you.id ? 'You owe ' : 'Owed to you: '), l.borrower === view.you.id ? `${name(l.lender)} ${money(l.owed)}` : `${money(l.owed)} by ${name(l.borrower)}`, l.overdue ? ', overdue' : `, due ${clockOf(S.game, l.due)}`, '.'));
    for (const j of view.duties.jobs) rows.push(h('li', null, h('b', null, j.worker === view.you.id ? 'Your job: ' : 'Job you posted: '), `${j.task}, pays ${money(j.pay)}. ${j.hoursLeft}h left.`));
    for (const c of view.duties.contracts) rows.push(h('li', null, h('b', null, 'Protection: '), c.muscle === view.you.id ? `you guard ${name(c.client)}` : `${name(c.muscle)} guards you`, `, ${c.hoursLeft}h left.`));
    if (view.crew) rows.push(h('li', null, h('b', null, 'Crew: '), `${view.crew.name ?? 'yours'}${view.crew.pot !== undefined ? `, ${money(view.crew.pot)} in the pot` : ''}.`));
    for (const t of view.tips.slice(0, 2)) rows.push(h('li', null, h('b', null, 'Tip: '), plainHours(t.text, S.game), ` ${t.hoursLeft}h left.`));
    for (const o of view.yourOffers.slice(0, 2)) rows.push(h('li', null, h('b', null, 'Your listing: '), plainHours(o.text, S.game), '.'));
    if (!rows.length) return null;
    return h('div', { class: 'hk-card hk-duties' }, h('h2', { class: 'k-h' }, S.mode === 'watch' ? `On ${possessive(view.you.name)} plate` : 'On your plate'), h('ul', null, rows));
  }

  /** What the seat knows about someone it clicked: only what its own view holds. */
  function lookCard(view, id) {
    const who = view.cast.find(c => c.id === id);
    if (!who) return null;
    const near = view.here?.others.find(o => o.id === id);
    const trust = view.trust[id];
    const grudge = view.grudges.find(g => g.against === id);
    const race = view.race?.rows.find(r => r.id === id);
    const skills = near ? Object.entries(near.skills) : [];
    return h('div', { class: 'hk-card hk-look' },
      h('div', { class: 'hk-seat-head' }, face(ctx, id, 'is-big'), h('div', null, h('b', { class: 'hk-name' }, who.name), h('div', { class: 'hk-seat-tags' }, clsTag(who.cls), who.crew ? h('span', { class: 'hk-tag' }, who.crew) : null)),
        h('button', { type: 'button', class: 'k-btn hk-x', 'aria-label': 'close', onclick: () => pick(id) }, '×')),
      who.known ? h('p', null, `“${who.known}”`) : null,
      h('ul', { class: 'hk-facts' },
        h('li', null, h('b', null, 'Where: '), near ? 'here, on your block' : who.lastSeen ? `last seen at ${placeName(S.game, who.lastSeen.block)}, ${who.lastSeen.hoursAgo}h ago` : 'you haven’t seen them yet'),
        near ? h('li', null, h('b', null, 'Carrying: '), typeof near.cash === 'number' ? money(near.cash) : `${near.cash} cash`, near.armed ? ', and a gun' : ', no gun') : null,
        skills.length ? h('li', null, h('b', null, 'Skills: '), skills.map(([s, v]) => `${SKILL_TEXT[s]?.[0] ?? s} ${v}`).join(', ')) : null,
        race ? h('li', null, h('b', null, 'Standing: '), `${race.rank} of ${view.race.rows.length} last night, ${race.bracket}`) : null,
        trust ? h('li', null, h('b', null, `Trust ${trust.score > 0 ? '+' : ''}${trust.score}: `), trust.why.join(', ')) : null,
        grudge ? h('li', { class: 'is-bad' }, h('b', null, 'Grudge: '), `${grudge.why}, ${grudge.hoursAgo}h ago`) : null));
  }

  /** The day ahead, an hour a line: where the police are, where the Dunn brothers work, where the Sixes push. */
  function aheadEl() {
    const { cfg } = S.game;
    const view = S.mode === 'watch' ? null : S.view;
    const hourNow = S.now?.hour ?? cfg.season.firstHour + cfg.season.hoursPerDay;
    const followBlock = S.follow ? S.lastLine?.agents[S.follow]?.block ?? S.game.state.agents[S.follow].block : null;
    const strip = view ? forecastStrip(view, cfg).map(c => ({ ...c, past: c.hour < hourNow, now: c.hour === hourNow })) : forecastStripAll(S.forecast?.forecast, cfg, hourNow, followBlock);
    const cell = (c, kind) => {
      const blocks = kind === 'police' ? c.police : kind === 'dunn' ? c.dunn : c.sixes ? [c.sixes] : [];
      const unknown = kind === 'police' && c.police === null;
      return h('td', { class: `hk-cell${unknown ? ' is-unknown' : ''}${c.here[kind] && !c.past ? ' is-here' : ''}`, 'data-kind': kind }, unknown ? (c.past ? '' : '?') : (blocks ?? []).map(b => shortBlock(S.game, b)).join(', '));
    };
    return h('div', { class: 'hk-ahead' },
      view ? h('ul', { class: 'hk-coming' }, comingFor(view, cfg).map(c => h('li', { class: c.bad ? 'is-bad' : '' }, c.text))) : null,
      h('table', { class: 'hk-ahead-table' },
        h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Police'), h('th', null, 'Dunn bros'), h('th', null, 'The Sixes'))),
        h('tbody', null, strip.map(c => h('tr', { class: `${c.past ? 'is-past' : ''}${c.now ? ' is-now' : ''}` }, h('th', null, `${c.hour}:00`), cell(c, 'police'), cell(c, 'dunn'), cell(c, 'sixes'))))),
      h('p', { class: 'hk-fine' }, view ? 'Red is trouble on your own block. A question mark is further than you can see.' : S.follow ? `Red is trouble on ${possessive(name(S.follow))} block.` : 'The whole day: you are watching, so nothing is hidden.'));
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Picking a line, and the rows, tiles and controls it is made of

  function select(id) {
    if (S.sel !== id) S.termsOpen = false;
    S.sel = id;
    const entry = S.view?.menu.find(m => m.id === id);
    if (entry) {
      // the controls start at the engine's own move; a staple offer the seat can't pay for starts on credit
      S.values[id] ??= {
        ...Object.fromEntries(argSpec(entry).map(c => [c.key, c.type === 'task' ? { type: 'guard', hours: 3 } : c.value])),
        ...(isStaple(entry, S.view.you.cls) ? stapleValues(entry, S.view) : {}),
      };
      // a line about a PERSON (a robbery, a fight) glances at them when they are out of the picture. A line about a
      // place (walk to the market) moves nothing: the camera stays on the player's own agent (the owner, playing:
      // "you lose your character, there's no continuity")
      const target = entry.move.target ?? null;
      if (target && S.game.state.agents[target] && !S.instant) stage.focus(target);
    }
    repaint();
  }

  /** The rows of a group that sit behind its "more" line and are on screen now: opened by hand, or holding the picked line. */
  function moreOf(g) {
    const level = S.open.get(g.id) ?? 0;
    if (!level) return g.more.filter(r => r.entry.id === S.sel);
    // "make an offer" opens on the offers this seat lives on; the rest come with a second "more"
    if (g.id === 'deal' && !g.shown.length && level === 1 && g.more.some(r => r.staple)) return g.more.filter(r => r.staple || r.entry.id === S.sel);
    return g.more;
  }
  const menuOpen = () => S.drawers.right === 'moves';
  const rowsOnScreen = () => (menuOpen() ? S.groups.flatMap(g => [...g.shown, ...moreOf(g)]) : S.card);

  function controlEl(entry, c) {
    const values = S.values[entry.id];
    const names = Object.fromEntries(S.view.cast.map(p => [p.id, p.name]));
    const spec = argSpec(entry, names).find(x => x.key === c.key);
    const field = (label, input) => h('label', { class: 'hk-field', 'data-type': spec.type }, h('span', null, label), input);
    if (spec.type === 'pick') {
      return field(spec.label, h('select', { class: 'hk-input', onchange: e => { values[c.key] = e.target.value; } }, spec.options.map(o => h('option', { value: o.value, selected: o.value === values[c.key] }, o.label))));
    }
    if (spec.type === 'number') {
      const shown = spec.negate ? -values[c.key] : values[c.key];
      const lo = spec.negate ? -spec.max : spec.min;
      const hi = spec.negate ? -spec.min : spec.max;
      const input = h('input', { class: 'hk-input is-num', type: 'number', min: String(lo), max: String(hi), value: String(shown), oninput: e => {
        const v = Math.max(lo, Math.min(hi, Math.round(Number(e.target.value) || lo)));
        values[c.key] = spec.negate ? -v : v;
      } });
      const bump = to => h('button', { type: 'button', class: 'k-btn hk-bump', onclick: () => {
        const v = to === 'all' ? hi : Math.max(lo, Math.min(hi, Number(input.value) + to));
        input.value = String(v);
        values[c.key] = spec.negate ? -v : v;
      } }, to === 'all' ? 'all' : to > 0 ? '+' : '−');
      return field(`${spec.label}${spec.money ? ' $' : ''}`, h('span', { class: 'hk-numrow' }, bump(-1), input, bump(1), hi < 9999 ? bump('all') : null));
    }
    if (spec.type === 'due') {
      const hours = [];
      for (let t = spec.min; t <= spec.max; t++) hours.push(t);
      return field(spec.optional ? 'paid' : 'due back by', h('select', { class: 'hk-input', onchange: e => { values[c.key] = e.target.value === '' ? null : Number(e.target.value); } },
        spec.optional ? h('option', { value: '', selected: values[c.key] === null }, 'on the spot') : null,
        hours.map(t => h('option', { value: String(t), selected: t === values[c.key] }, `${spec.optional ? 'on credit, by ' : ''}${clockOf(S.game, t)}`))));
    }
    if (spec.type === 'toggle') {
      return h('label', { class: 'hk-field is-check', 'data-type': 'toggle' }, h('input', { type: 'checkbox', checked: values[c.key] === true, onchange: e => { values[c.key] = e.target.checked; } }), h('span', null, spec.label));
    }
    if (spec.type === 'text') {
      return field(spec.label, h('input', { class: 'hk-input', type: 'text', maxlength: '32', value: values[c.key] ?? '', oninput: e => { values[c.key] = e.target.value; } }));
    }
    // a job: what kind, and what that kind needs
    const task = values.task;
    const kind = spec.kinds.find(k => k.type === task.type) ?? spec.kinds[0];
    task.agent ??= spec.agents[0]?.value;
    return h('div', { class: 'hk-task' },
      field('the job', h('select', { class: 'hk-input', onchange: e => { task.type = e.target.value; repaint(); } }, spec.kinds.map(k => h('option', { value: k.type, selected: k.type === kind.type }, k.label)))),
      kind.needs.includes('agent') ? field('who', h('select', { class: 'hk-input', onchange: e => { task.agent = e.target.value; } }, spec.agents.map(o => h('option', { value: o.value, selected: o.value === task.agent }, o.label)))) : null,
      kind.needs.includes('hours') ? field('hours', h('input', { class: 'hk-input is-num', type: 'number', min: '1', max: '12', value: String(task.hours ?? 3), oninput: e => { task.hours = Number(e.target.value); } })) : null,
      kind.needs.includes('good') ? field('goods', h('select', { class: 'hk-input', onchange: e => { task.good = e.target.value; } }, ['product', 'chems', 'parts', 'gun'].map(g => h('option', { value: g, selected: g === (task.good ?? 'product') }, g)))) : null,
      kind.needs.includes('n') ? field('how many', h('input', { class: 'hk-input is-num', type: 'number', min: '1', max: '32', value: String(task.n ?? 1), oninput: e => { task.n = Number(e.target.value); } })) : null);
  }

  function rowEl(row, hint) {
    const { entry } = row;
    const on = S.sel === entry.id;
    return h('button', { type: 'button', class: `hk-row${on ? ' is-on' : ''}${hint?.id === entry.id ? ' is-hint' : ''}`, 'data-entry': entry.id, 'data-verb': entry.verb, 'aria-pressed': on ? 'true' : 'false',
      onclick: () => (on ? confirm() : select(entry.id)) },
      row.n ? kbd(String(row.n)) : h('span', { class: 'hk-nokey' }),
      h('span', { class: 'hk-row-text' }, h('b', null, row.main), row.note ? h('span', null, row.note) : null),
      hint?.id === entry.id ? h('span', { class: 'hk-try' }, 'try this') : null,
      miniOddsEl(entry));
  }

  /** A walk or a lie-low line as a tile: its number and a word or two. The whole label is on the move card when picked. */
  function tileEl(row, hint) {
    const { entry } = row;
    const on = S.sel === entry.id;
    const police = /police there now/.test(row.note);
    return h('button', { type: 'button', class: `hk-row hk-tile${on ? ' is-on' : ''}${hint?.id === entry.id ? ' is-hint' : ''}`, 'data-entry': entry.id, 'data-verb': entry.verb, 'aria-pressed': on ? 'true' : 'false', title: entry.label,
      onclick: () => (on ? confirm() : select(entry.id)) },
      row.n ? kbd(String(row.n)) : null, h('b', null, row.tile), police ? h('span', { class: 'hk-tag is-police' }, 'police') : null);
  }

  /**
   * The pick-ups as one errand card: who, what for what, how far, how long, and one button that takes the walk.
   * A deal is closed by phone and the goods move by hand, so this card is the trade's second half.
   */
  function errandsEl(view, hint) {
    const errands = errandsOf(view);
    if (!errands.length) return null;
    const rows = S.groups.find(g => g.id === 'errand');
    return h('div', { class: 'hk-errands', 'data-group': 'errand' },
      h('div', { class: 'hk-group-head' }, h('h2', { class: 'k-h' }, errands.length > 1 ? 'Pick-ups' : 'Pick-up'), h('span', { class: 'hk-fine' }, 'give \u2192 get, swapped when you meet')),
      h('ul', null, errands.map(e => {
        const row = e.entry && rows ? [...rows.shown, ...rows.more].find(r => r.entry.id === e.entry.id) : null;
        const on = row && S.sel === row.entry.id;
        const where = e.moves === null ? `held in ${shortBlock(S.game, e.theirBlock)}` : e.here ? 'on your block' : `${placeName(S.game, e.theirBlock)} · ${e.moves} move${e.moves === 1 ? '' : 's'}`;
        const full = `${e.withName}: ${e.moves === null ? where : e.here ? where : `at ${placeName(S.game, e.theirBlock)}, ${e.moves} move${e.moves === 1 ? '' : 's'} away`}. You give ${e.youGive}, you get ${e.youGet}. ${e.hoursLeft} hours left.`;
        return h('li', { class: 'hk-errand', 'data-pickup': e.id, title: full },
          h('div', { class: 'hk-errand-text' },
            h('p', null, h('b', null, e.withName), ` · ${where}`),
            h('p', null, h('span', null, e.youGive, ' \u2192 ', h('b', null, e.youGet)), h('span', { class: e.hoursLeft <= 2 ? 'hk-tag is-down' : 'hk-tag' }, `${e.hoursLeft}h left`))),
          row ? h('button', { type: 'button', class: `hk-row hk-walk${on ? ' is-on' : ''}${hint?.id === row.entry.id ? ' is-hint' : ''}`, 'data-entry': row.entry.id, 'data-verb': 'move', 'aria-pressed': on ? 'true' : 'false', title: row.entry.label,
            onclick: () => (on ? confirm() : select(row.entry.id)) }, row.n ? kbd(String(row.n)) : null, h('b', null, 'Walk there'))
            : h('span', { class: 'hk-tag' }, e.here ? 'swaps this hour' : 'wait'));
      })));
  }

  /** The offers the seat can say yes to: the ones that match what it holds or needs first, each one tap from a yes. */
  function offersEl(view) {
    if (!view.offers.length) return null;
    const { lead, rest } = sortOffers(view);
    const wanted = guide()?.offer?.id ?? null;
    const row = o => {
      const yes = S.accept.has(o.id);
      const full = !yes && S.accept.size >= 3;
      const goods = o.kind === 'sell' || o.kind === 'buy';
      const text = plainHours(o.text, S.game);
      return h('li', { class: `hk-offer${yes ? ' is-yes' : ''}${wanted === o.id && !yes ? ' is-hint' : ''}`, 'data-why': o.why ?? null },
        h('span', { class: 'hk-offer-text', title: text }, o.why ? h('span', { class: 'hk-tag is-why' }, o.why) : null, ' ', text, o.hoursLeft !== null ? h('em', null, ` ${o.hoursLeft}h left`) : null),
        yes && goods ? h('label', { class: 'hk-field is-check' }, h('input', { type: 'checkbox', checked: !!S.accept.get(o.id).courier, onchange: e => { S.accept.get(o.id).courier = e.target.checked; } }), h('span', null, 'courier')) : null,
        h('button', { type: 'button', class: `k-btn hk-yes${yes ? ' is-on' : ''}`, 'data-offer': o.id, disabled: full, 'aria-pressed': yes ? 'true' : 'false', onclick: () => {
          if (yes) S.accept.delete(o.id);
          else S.accept.set(o.id, { courier: false });
          // answering an offer from a cell or a clinic bed stops the hours rolling by until the player carries on
          if (!view.menu.length) S.heldHold = true;
          repaint();
        } }, yes ? 'Yes' : 'Say yes'));
    };
    return h('div', { class: 'hk-offers' },
      h('div', { class: 'hk-group-head' }, h('h2', { class: 'k-h' }, 'Offers'), h('span', { class: 'hk-fine' }, `saying yes is free · ${S.accept.size}/3`),
        rest.length ? h('button', { type: 'button', class: 'hk-more', 'data-more': 'board', onclick: () => { S.boardOpen = !S.boardOpen; repaint(); } }, S.boardOpen ? 'fewer' : `board +${rest.length}`) : null),
      lead.length || S.boardOpen ? h('ul', null, lead.map(row), S.boardOpen ? rest.map(row) : null) : null);
  }

  function sayEl(view) {
    const { situation, banks } = linesFor(view, view.menu.find(m => m.id === S.sel)?.move ?? null);
    const bank = S.sayBank ?? situation;
    const lines = banks.find(([s]) => s === bank)?.[1] ?? [];
    const here = view.here?.others ?? [];
    const privately = S.sayTo.startsWith('msg:');
    const chosen = (privately ? S.message?.text : S.say?.text) ?? null;
    // one thing out loud and one private message can ride on the same hour
    const set = text => {
      if (S.sayTo === 'block') S.say = { text };
      else if (privately) S.message = { to: S.sayTo.slice(4), text };
      else S.say = { text, to: S.sayTo.slice(4) };
      toggleSay();
    };
    return h('div', { class: 'hk-say' },
      h('div', { class: 'hk-group-head' }, h('h2', { class: 'k-h' }, 'Say something'), h('button', { type: 'button', class: 'hk-more', onclick: toggleSay }, 'close')),
      h('label', { class: 'hk-field' }, h('span', null, 'how'), h('select', { class: 'hk-input', 'data-say-how': '', onchange: e => { S.sayTo = e.target.value; repaint(); } },
        h('option', { value: 'block', selected: S.sayTo === 'block' }, 'out loud, to the block'),
        here.map(p => h('option', { value: `say:${p.id}`, selected: S.sayTo === `say:${p.id}` }, `out loud, to ${p.name}`)),
        view.cast.map(p => h('option', { value: `msg:${p.id}`, selected: S.sayTo === `msg:${p.id}` }, `a private message to ${p.name}`)))),
      h('div', { class: 'hk-say-tabs' }, banks.map(([s]) => h('button', { type: 'button', class: `hk-say-tab${s === bank ? ' is-on' : ''}`, onclick: () => { S.sayBank = s; repaint(); } }, SITUATION_WORDS[s] ?? s))),
      h('ul', { class: 'hk-say-lines' }, lines.map(text => h('li', null, h('button', { type: 'button', class: `hk-say-line${text === chosen ? ' is-on' : ''}`, onclick: () => set(text) }, text)))));
  }

  function standingsEl() {
    const view = S.mode === 'watch' ? null : S.view;
    let rows;
    let note;
    if (S.mode === 'watch') {
      rows = S.lastLine ? liveStandings(S.lastLine, S.game.state.order).map(r => ({ id: r.id, rank: r.rank, right: money(r.worth), sub: shortBlock(S.game, r.block) }))
        : S.game.state.order.map((id, i) => ({ id, rank: i + 1, right: '', sub: '' }));
      note = 'Live, to the dollar: you are watching, so nothing is hidden.';
    } else if (view?.race) {
      rows = view.race.rows.map(r => ({ id: r.id, rank: r.rank, right: r.id === S.you ? money(view.you.worth) : r.bracket, sub: '' }));
      note = `As of last night. Everyone sees rank and a rough bracket.`;
    } else {
      rows = [S.you, ...S.game.state.order.filter(id => id !== S.you)].map(id => ({ id, rank: '·', right: id === S.you ? money(view?.you.worth ?? 0) : '', sub: '' }));
      note = 'The first standings come out tonight.';
    }
    return h('div', { class: 'hk-board' },
      h('div', { class: 'hk-group-head' }, h('h2', { class: 'k-h' }, 'Standings'), h('span', { class: 'hk-fine' }, S.mode === 'watch' ? 'live' : view?.race ? `night ${view.race.day}` : '')),
      h('ol', { class: 'hk-standings' }, rows.map(r => {
        const agent = S.game.state.agents[r.id];
        const on = S.follow === r.id || S.look === r.id;
        return h('li', { class: `${r.id === S.you ? 'is-you' : ''}${on ? ' is-on' : ''}` }, h('button', { type: 'button', class: 'hk-standing', 'data-person': r.id, onclick: () => pick(r.id) },
          h('span', { class: 'hk-rank' }, String(r.rank)), face(ctx, r.id), h('b', null, agent.name), clsTag(agent.cls), r.sub ? h('span', { class: 'hk-fine' }, r.sub) : null, h('span', { class: 'hk-worth' }, r.right)));
      })),
      h('p', { class: 'hk-fine' }, note));
  }

  /**
   * The full menu, for the Moves drawer, built at the loosest tightness that fits the drawer without scrolling. Once the
   * player has opened something by hand the tightness stays put, so the list doesn't shift under the mouse.
   */
  function menuEl(view, host) {
    const hint = guide()?.entry ?? null;
    const build = tight => {
      layout(tight);
      const box = h('div', { class: 'hk-menu' });
      const errands = errandsEl(view, hint);
      if (errands) box.append(errands);
      const closed = [];
      for (const g of S.groups) {
        if (g.id === 'errand') continue;
        const extra = moreOf(g);
        if (!g.shown.length && !extra.length) {
          closed.push(g);
          continue;
        }
        const left = g.more.length - extra.length;
        const link = g.more.length ? h('button', { type: 'button', class: 'hk-more', 'data-more': g.id, onclick: () => {
          if (left) S.open.set(g.id, (S.open.get(g.id) ?? 0) + 1);
          else S.open.delete(g.id);
          S.reveal = g.id;
          repaint();
        } }, left ? `${left} more` : 'fewer') : null;
        if (g.id === 'go' || g.id === 'home') {
          box.append(h('div', { class: 'hk-group is-tiles', 'data-group': g.id }, h('h2', { class: 'k-h' }, g.title), h('div', { class: 'hk-tiles' }, [...g.shown, ...extra].map(r => tileEl(r, hint))), link));
        } else {
          box.append(h('div', { class: 'hk-group', 'data-group': g.id }, h('div', { class: 'hk-group-head' }, h('h2', { class: 'k-h' }, g.title), link), [...g.shown, ...extra].map(r => rowEl(r, hint))));
        }
      }
      // the groups that start closed share one line until one is opened
      if (closed.length) {
        const short = { crew: 'Crew' };
        box.append(h('div', { class: 'hk-closed' }, closed.map(g => h('button', { type: 'button', class: 'hk-more', 'data-more': g.id, onclick: () => { S.open.set(g.id, 1); S.reveal = g.id; repaint(); } }, `${short[g.id] ?? g.title} · ${g.more.length}`))));
      }
      return box;
    };
    const byHand = S.open.size > 0;
    let menu = null;
    for (let tight = byHand ? S.tight : 0; tight <= TIGHTEST; tight++) {
      menu = build(tight);
      host.replaceChildren(menu);
      if (byHand || host.scrollHeight <= host.clientHeight + 1) break;
    }
    // what was just opened by hand comes into view; otherwise the picked line does
    const opened = S.reveal ? menu.querySelector(`[data-group="${S.reveal}"]`) : null;
    S.reveal = null;
    const on = menu.querySelector('.hk-row.is-on');
    if (opened) host.scrollTop = Math.max(0, opened.offsetTop - menu.offsetTop - 4);
    else if (on) on.scrollIntoView({ block: 'nearest' });
  }

  /** The Game drawer: the season's own controls. */
  function gameEl() {
    const asking = S.mode === 'play' && !!S.resolveMove && S.view?.menu.length;
    return h('div', { class: 'hk-game' },
      h('h2', { class: 'k-h' }, 'Speed'), speedButtons(),
      S.mode === 'play' ? null : h('button', { type: 'button', class: `k-btn${S.skipTo ? ' is-on' : ''}`, 'data-act': 'skip', onclick: skipToNight }, 'Skip to tonight'),
      S.mode !== 'play' ? null : [h('h2', { class: 'k-h' }, 'Let the bot play'),
        h('button', { type: 'button', class: 'k-btn', 'data-act': 'auto', disabled: !asking, onclick: () => auto(false) }, 'This hour', kbd('A')),
        h('button', { type: 'button', class: 'k-btn', 'data-act': 'auto-until', disabled: !asking, onclick: () => auto(true) }, 'Until something happens to me'),
        h('h2', { class: 'k-h' }, 'Tips'),
        h('button', { type: 'button', class: `k-btn${S.guideOff ? '' : ' is-on'}`, 'data-act': 'tips', onclick: () => { S.guideOff = !S.guideOff; store.set(GUIDE_KEY, S.guideOff ? '1' : '0'); repaint(); } }, S.guideOff ? 'Tips are off' : 'Tips are on')],
      S.you ? h('button', { type: 'button', class: 'k-btn', 'data-act': 'how', onclick: () => showHow() }, 'How to play') : null,
      h('h2', { class: 'k-h' }, `Season, seed ${S.session.save().seed}`),
      h('button', { type: 'button', class: 'k-btn', 'data-act': 'quit', onclick: quit }, 'Leave: it is saved'));
  }

  function drawerBody(id, host) {
    const view = S.view;
    const asking = S.mode === 'play' && !!S.resolveMove && view;
    const none = text => h('p', { class: 'hk-fine' }, text);
    if (id === 'you') return view ? seatCard(view, S.mode === 'play' ? 'you' : S.mode === 'coach' ? 'your agent' : 'following') : none('Click a person in the city, or a name under Rank, to follow them and read their pockets.');
    if (id === 'here') return view ? [S.look ? lookCard(view, S.look) : null, hereCard(view) ?? none(view.you.state === 'jail' ? 'In a cell.' : 'In a clinic bed.')] : none('Nobody followed.');
    if (id === 'ahead') return aheadEl();
    if (id === 'plate') return view ? dutiesCard(view) ?? none('Nothing owed, nothing due, nothing listed.') : none('Nobody followed.');
    if (id === 'rank') return standingsEl();
    if (id === 'log') return [tickerHead, tickerRows];
    if (id === 'game') return gameEl();
    if (id === 'say') return asking ? sayEl(view) : none('You can speak when it is your move.');
    if (id === 'offers') return asking ? offersEl(view) ?? none('No offers this hour. Listings and jobs show up here.') : none('Offers come back with your move.');
    if (id === 'moves') {
      if (!asking || !view.menu.length) return none(asking ? 'No move while you are held.' : 'The menu comes back with your move.');
      menuEl(view, host);
      return undefined;
    }
    return null;
  }

  function paintDrawers() {
    if (!S.session) return;
    for (const side of ['left', 'right']) {
      const box = side === 'left' ? el.left : el.right;
      const id = S.drawers[side];
      box.classList.toggle('is-on', !!id);
      box.dataset.drawer = id ?? '';
      if (!id) {
        box.replaceChildren();
        continue;
      }
      const body = h('div', { class: 'hk-drawer-body' });
      fill(box, h('div', { class: 'hk-drawer-head' }, h('h2', null, id === 'you' && S.mode !== 'play' ? (S.view ? S.view.you.name : 'Nobody followed') : DRAWER_TITLES[id]),
        h('button', { type: 'button', class: 'k-btn hk-x', 'aria-label': 'close', 'data-act': 'close-drawer', onclick: () => toggleDrawer(side, id) }, '×')), body);
      const made = drawerBody(id, body);
      if (made !== undefined) fill(body, made);
      if (id === 'log') tickerRows.scrollTop = tickerRows.scrollHeight;
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // The move card: the latest thing that happened, and the hour's best moves

  /** A move as a button on the card: its number, what it does, what it gets you, and its odds at a glance. */
  function moveEl(row) {
    const { entry } = row;
    const on = S.sel === entry.id;
    const words = plainMove(entry, S.view, S.game);
    const hinted = !on && guide()?.entry === entry;
    return h('button', { type: 'button', class: `hk-move${on ? ' is-on' : ''}${hinted ? ' is-hint' : ''}`, 'data-entry': entry.id, 'data-verb': entry.verb, 'aria-pressed': on ? 'true' : 'false', title: entry.label,
      onclick: () => (on ? confirm() : select(entry.id)) },
      row.n ? kbd(String(row.n)) : null,
      h('span', { class: 'hk-move-text' }, h('b', null, words.title), words.gain ? h('span', null, words.gain) : null),
      miniOddsEl(entry));
  }

  /** The picked move, opened on the card: plain words, the engine's own line, the odds bar with its reasons, the controls. */
  function detailEl(entry) {
    const words = plainMove(entry, S.view, S.game);
    const controls = argSpec(entry);
    const odds = oddsEl(entry);
    // an offer's terms start as one line: the usual ones are already in, and "change" opens the controls
    const names = Object.fromEntries(S.view.cast.map(p => [p.id, p.name]));
    const terms = controls.length && !S.termsOpen ? h('p', { class: 'hk-terms' },
      termsLine(argSpec(entry, names), S.values[entry.id] ?? {}, t => clockOf(S.game, t)),
      h('button', { type: 'button', class: 'hk-more', 'data-act': 'terms', onclick: () => { S.termsOpen = true; repaint(); } }, 'change')) : null;
    return h('div', { class: `hk-card-detail${odds ? ' has-odds' : ''}${controls.length ? ' has-fields' : ''}` },
      h('div', { class: 'hk-detail-head' }, h('b', null, words.title), h('span', null, words.gain), h('button', { type: 'button', class: 'hk-more', 'data-act': 'unpick', onclick: () => { S.sel = null; repaint(); } }, 'not this')),
      odds,
      terms,
      controls.length && S.termsOpen ? h('div', { class: 'hk-fields' }, controls.map(c => controlEl(entry, c))) : null,
      h('button', { type: 'button', class: 'k-btn is-primary hk-confirm', 'data-act': 'confirm', onclick: confirm }, 'Do it', kbd('Enter')));
  }

  function paintCard() {
    if (!S.session) return;
    const view = S.view;
    const asking = S.mode === 'play' && !!S.resolveMove && view;
    const small = (label, act, onclick, key = null, title = null) => h('button', { type: 'button', class: `k-btn${act === 'say' && S.drawers.right === 'say' ? ' is-on' : ''}`, 'data-act': act, title, onclick }, label, key ? kbd(key) : null);
    el.card.dataset.kind = asking ? (view.menu.length ? 'move' : 'held') : 'quiet';
    if (!asking) {
      const agent = S.mode === 'coach' && S.you ? S.game.state.agents[S.you] : null;
      return fill(el.card, h('div', { class: 'hk-card-top' }, tick,
        S.mode === 'play' && S.autoRun ? small('Stop auto', 'stop-auto', () => { S.autoRun = false; repaint(); }) : null,
        S.mode === 'play' && S.travelling ? small('Skip', 'skip-trip', skipTrip, 'Enter', 'Skip the trip: you are there at once') : null,
        S.mode !== 'play' ? small('Skip to tonight', 'skip', skipToNight) : null),
        agent ? h('p', { class: 'hk-fine' }, `${agent.name} plays on its own; you speak at night. Stance: ${agent.lean ?? 'its own'}. Order: ${agent.focus?.target ? `go after ${name(agent.focus.target)}` : agent.focus?.avoid ? `stay off ${placeName(S.game, agent.focus.avoid)}` : 'none'}.`) : null);
    }
    const said = [
      S.say ? [`Out loud${S.say.to ? ` to ${name(S.say.to)}` : ''}: “${S.say.text}”`, () => { S.say = null; }] : null,
      S.message ? [`To ${name(S.message.to)}, privately: “${S.message.text}”`, () => { S.message = null; }] : null,
    ].filter(Boolean).map(([text, drop]) => h('div', { class: 'hk-said' }, h('span', null, text), h('button', { type: 'button', class: 'hk-more', onclick: () => { drop(); repaint(); } }, 'unsay')));
    const yes = S.accept.size ? h('div', { class: 'hk-said' }, h('span', null, `Saying yes to ${S.accept.size} offer${S.accept.size === 1 ? '' : 's'} with this move.`)) : null;
    if (!view.menu.length) {
      const left = view.you.hoursLeft;
      return fill(el.card, h('div', { class: 'hk-card-top' }, tick, small('Say', 'say', toggleSay, 'S')),
        said, yes,
        h('div', { class: 'hk-held' },
          h('b', null, S.heldNew ? (view.you.state === 'jail' ? 'You are under arrest' : 'You are hurt') : view.you.state === 'jail' ? 'You are in jail' : 'You are in the clinic'),
          h('span', { class: 'hk-held-pips' }, Array.from({ length: Math.min(left, 8) }, () => h('i'))), h('b', null, `${left} hour${left === 1 ? '' : 's'} to go`),
          h('span', null, S.heldAsked ? 'Stopped: an offer made to you is waiting.' : S.heldNew ? `Continue takes you to ${view.you.state === 'jail' ? 'the jail' : 'the clinic'}.` : S.heldHold ? 'Continue for the next hour.' : 'The hours pass on their own.'),
          small(S.heldPass ? 'Stop at each hour' : 'Let the hours pass', 'hold', () => {
            S.heldPass = !S.heldPass;
            S.heldHold = !S.heldPass;
            if (S.heldHold) repaint();
            else confirm();
          }),
          h('button', { type: 'button', class: 'k-btn is-primary', 'data-act': 'go', onclick: confirm }, 'Continue', kbd('Enter'))));
    }
    if (!menuOpen()) layout(S.open.size ? S.tight : 0);
    const entry = view.menu.find(m => m.id === S.sel);
    return fill(el.card,
      h('div', { class: 'hk-card-top' }, tick,
        small('Say', 'say', toggleSay, 'S'),
        small('Auto', 'auto', () => auto(false), 'A', 'Your seat’s own bot takes this hour'),
        small('Skip ahead', 'auto-until', () => auto(true), null, 'The bot plays on until something happens to you (Shift+A)')),
      said, yes,
      entry ? detailEl(entry) : null,
      h('div', { class: 'hk-card-moves' }, S.card.map(moveEl),
        h('button', { type: 'button', class: `hk-move is-all${menuOpen() ? ' is-on' : ''}`, 'data-act': 'all-moves', title: 'Every move you can make this hour', onclick: () => toggleDrawer('right', 'moves') },
          kbd('M'), h('span', { class: 'hk-move-text' }, h('b', null, 'All moves'), h('span', null, `${view.menu.length} this hour`)))));
  }

  // ---------------------------------------------------------------------------------------------------------------
  // The first-time guide: one mark, on the one thing to click this hour

  function guide() {
    if (S.guideOff || S.mode !== 'play' || !S.view || !S.resolveMove) return null;
    return guideFor(S.view, { ...S.memo, accepted: [...S.accept.keys()] }, S.game.map);
  }

  /** Where the mark points and what it says: the offer's yes (or the rail button that leads to it), then the move, then Enter. */
  function markTarget(g) {
    if (g.offer) {
      const yes = el.right.querySelector(`.hk-yes[data-offer="${g.offer.id}"]`);
      return yes ? { node: yes, say: g.say } : { node: el.railR.querySelector('[data-rail="offers"]'), say: 'An offer is waiting that suits you. Open Offers.' };
    }
    if (!g.entry) return { node: el.card, say: g.say };
    if (S.sel === g.entry.id) return { node: el.card.querySelector('[data-act="confirm"]'), say: 'Press Enter to do it. The hour then plays out.' };
    return { node: el.card.querySelector(`.hk-move[data-entry="${g.entry.id}"]`) ?? el.card, say: g.say };
  }

  function paintMark() {
    const g = S.screen ? null : guide();
    const target = g ? markTarget(g) : null;
    const first = !!g && !S.memo.traded && S.view.clock.t < 3;
    // on the first hours, a tag over the player's own head: the stage says where that is
    const head = first ? stage.screenOf(S.you) : null;
    el.you.classList.toggle('is-on', !!head?.visible);
    if (head?.visible) el.you.style.transform = `translate(${Math.round(head.x)}px, ${Math.round(head.y)}px)`;
    if (!target?.node) {
      el.mark.classList.remove('is-on');
      el.mark.replaceChildren();
      return;
    }
    S.guideShown = true;
    fill(el.mark, h('p', null, target.say), h('button', { type: 'button', class: 'hk-more', 'data-act': 'guide-off', title: 'You can turn tips back on under Game', onclick: () => { S.guideOff = true; store.set(GUIDE_KEY, '1'); repaint(); } }, 'no tips'));
    el.mark.classList.add('is-on');
    // beside what it points at: above something on the card, inward from something on a rail or in a drawer
    const r = target.node.getBoundingClientRect();
    const w = el.mark.offsetWidth;
    const hh = el.mark.offsetHeight;
    const side = el.card.contains(target.node) ? 'above' : r.left > innerWidth / 2 ? 'left' : 'right';
    const x = side === 'above' ? r.left + r.width / 2 - w / 2 : side === 'left' ? r.left - w - 12 : r.right + 12;
    // above the whole card, so the mark never sits on the card's own first line
    const y = side === 'above' ? el.card.getBoundingClientRect().top - hh - 10 : r.top + r.height / 2 - hh / 2;
    el.mark.dataset.side = side;
    el.mark.style.transform = `translate(${Math.round(Math.max(8, Math.min(innerWidth - w - 8, x)))}px, ${Math.round(Math.max(8, Math.min(innerHeight - hh - 8, y)))}px)`;
    el.mark.style.setProperty('--at', `${Math.round(side === 'above' ? Math.max(12, Math.min(w - 12, r.left + r.width / 2 - Math.max(8, Math.min(innerWidth - w - 8, x)))) : hh / 2)}px`);
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Picking a person: follow them when watching, look them up when playing

  function pick(id) {
    if (!S.session || !S.game.state.agents[id]) return;
    if (S.mode === 'watch') {
      S.follow = S.follow === id ? null : id;
      S.view = S.follow ? S.session.viewOf(S.follow) : null;
      if (S.follow) {
        stage.focus(S.follow);
        S.drawers.left = 'you';
      }
      paintTop(S.state === 'playing' ? S.playing : null);
    } else {
      S.look = S.look === id || id === S.you ? null : id;
      if (S.look) S.drawers.left = 'here';
      stage.focus(S.look ?? S.you);
    }
    repaint();
  }

  /** Everything but the top line: the rails, the open drawers, the move card and the guide's mark. */
  function repaint() {
    if (!S.session) return;
    paintRails();
    paintDrawers();
    paintCard();
    paintMark();
  }

  function paint() {
    paintTop();
    repaint();
  }

  // ---------------------------------------------------------------------------------------------------------------
  // The end

  function showEnd(p) {
    const finish = () => show(endScreen(ctx, {
      final: p.final, rank: p.rank, top: p.top,
      onReveal: () => show(revealScreen(ctx, { html: episodeHtml(S.game, { title: `Hotkey 2, seed ${S.session.save().seed}: the whole season` }), onClose: finish }), 'reveal'),
      onAgain: showStart,
    }), 'end');
    finish();
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Keys: numbers pick a move, Enter confirms, Space pauses, a letter opens a drawer, Esc closes

  /** Skips the player's own trip, when one is on the picture (stage.skipTravel: nothing else is skipped). */
  function skipTrip() {
    if (!stage.skipTravel?.()) return;
    S.travelling = false;
    repaint();
  }
  function onKey(e) {
    if (dead || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target?.tagName ?? '';
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(tag);
    // a button reached with Tab keeps its own Enter and Space
    if (tag === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
    // a key the HUD takes goes no further: the city's camera listens to the same keyboard
    const took = () => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    if (S.screen) {
      if (e.key === 'Escape' && S.screen.esc) S.screen.esc();
      else if (e.key === 'Enter' && tag !== 'SELECT') S.screen.enter();
      else if (typing || !S.screen.key(e)) return;
      took();
      return;
    }
    if (!S.session || (typing && e.key !== 'Enter' && e.key !== 'Escape')) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    // (the player's own trip is on the picture and no menu is up: Space or Enter skips it, and only it. With a menu
    // up they are the menu's, and on a paused game Space is the pause's)
    if (S.travelling && !S.resolveMove && !S.paused && (key === ' ' || key === 'Enter')) {
      took();
      skipTrip();
      return;
    }
    if (key === ' ') {
      took();
      setPaused(!S.paused);
      return;
    }
    if (key === 'Escape') {
      // one step back: the say list, then the picked move, then the drawers
      if (S.drawers.right === 'say') toggleSay();
      else if (S.sel && S.resolveMove) {
        S.sel = null;
        repaint();
      } else if (!closeDrawers()) return;
      took();
      return;
    }
    const drawer = { t: 'rank', l: 'log', ...(S.mode === 'play' ? { m: 'moves', o: 'offers' } : {}) }[key];
    if (drawer && !typing) {
      took();
      toggleDrawer('right', drawer);
      return;
    }
    if (!S.resolveMove) return;
    if (key === 'Enter') {
      took();
      confirm();
    } else if (/^[1-9]$/.test(key) && !typing) {
      took();
      // a number is a move on the card, or, with the menu open, any numbered line of it
      const row = rowByNumber(S.groups, Number(key));
      if (row && rowsOnScreen().includes(row)) select(row.entry.id);
    } else if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'ArrowRight' || key === 'ArrowLeft') {
      took();
      const rows = rowsOnScreen();
      const i = rows.findIndex(r => r.entry.id === S.sel);
      const next = rows[key === 'ArrowDown' || key === 'ArrowRight' ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1)];
      if (next) select(next.entry.id);
    } else if (key === 'a') {
      took();
      auto(e.shiftKey);
    } else if (key === 's') {
      took();
      toggleSay();
    }
  }
  addEventListener('keydown', onKey, true);
  // a click on the game itself closes the drawers; a button clicked with the mouse gives the keys back, so Space
  // still pauses and Enter still confirms
  function onPress(e) {
    if (dead || S.screen || !S.session) return;
    if (e.target.closest?.('.hk-panel, .hk-mark, .hk-overlay, .hk-toasts')) return;
    closeDrawers();
  }
  addEventListener('pointerdown', onPress, true);
  root.addEventListener('click', e => {
    if (e.detail > 0 && document.activeElement?.tagName === 'BUTTON') document.activeElement.blur();
  });
  const onResize = () => S.session && !S.screen && repaint();
  addEventListener('resize', onResize);

  const api = {
    root,
    error: null,
    get session() { return S.session; },
    get state() { return S.state; },
    get hours() { return S.hours; },
    get view() { return S.view; },
    get groups() { return S.groups; },
    get card() { return S.card; },
    get tight() { return S.tight; },
    get drawers() { return { ...S.drawers }; },
    start: begin,
    select,
    confirm,
    auto,
    pick,
    setSpeed,
    pause: setPaused,
    /** Open a drawer by its rail button's id (or close it with null), as a click on the rail would. */
    drawer(side, id) {
      if (S.drawers[side] !== id) toggleDrawer(side, id ?? S.drawers[side]);
    },
    how: () => showHow(),
    /**
     * The share of the window no panel covers, 0 to 1: the union of every plate on screen right now (the top line,
     * the rails, any open drawer, the move card, the mark, bubbles and the roll card), taken out of the window.
     */
    clear() {
      const plates = [...root.querySelectorAll('.hk-top, .hk-rail, .hk-drawer.is-on, .hk-move-card, .hk-mark.is-on, .hk-you-tag.is-on, .hk-roll, .hk-lower, .hk-bubble.is-on, .hk-phone.is-on, .hk-toast, .hk-plate')];
      const rects = plates.map(p => p.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0).map(r => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
      return clearShare(rects, innerWidth, innerHeight);
    },
    /** Play without waiting, for a tool that wants to be somewhere fast. It holds until it is switched off. */
    setInstant(on) {
      S.devInstant = !!on;
      S.instant = !!on;
    },
    destroy() {
      dead = true;
      runId += 1;
      removeEventListener('keydown', onKey, true);
      removeEventListener('pointerdown', onPress, true);
      removeEventListener('resize', onResize);
      root.remove();
    },
  };

  setState('boot');
  if (opts.mode && opts.autostart !== false) begin({ mode: opts.mode, seat: opts.seat ?? 'dealer', seed: opts.seed ?? 1 });
  else showStart();
  return api;
}
