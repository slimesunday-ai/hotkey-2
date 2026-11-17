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
//     You C, the Guide G (every move), Stuff O (demo/run/panels.js), and the Map M: the kit's own paper map of the island,
//     the player on it and the run's three stops (demo/run/map.js). Esc closes (a card on the map first). At the crib,
//     Arrange V with them (demo/run/arrange.js: greyed, why in its tooltip, when it cannot start now). They only show
//   · over everything when it comes: the held card (taken to the jail or the clinic), the day's report, done in N days
// KEYS (ui-3, leg 2: the dock, below; one key one meaning everywhere in the run): 1 2 3 the three things in front of
// you; B Shop, R Rob, X Bins, T Travel, H Home, Z Sleep, the six verbs that never move, renumber or vanish; ← → along
// the dock, ↑ ↓ what the picked thing is set to; Enter does it; Esc closes; Space skips a scene (never the result
// card). C You, L the Library (leg 3: everything there is), G Guide, O Stuff, M Map, V Arrange, K the home risk, J the
// journal, I the frame's size, F the dock to one row, N your numbers to one line. W A S D are never the run's (kept for moving). The heat HERE is
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
import { YOU, stageGame, lineOf as lineAt, endOf, stopSpots } from './scenes.js';
import { scenesOf, binsOf, STEP, FAR_IN, FRONT, YARD, VISIT, POST, WAIT, WAIT_EAST, GUARD, homeWho } from './acted.js';
import { characterStats, characterWearing, characterPeople, movesBody, stuffBody, lineNote, stopFlag, stopBody, stopOf, STOP_NAME, hookedShort, hookedText, trustMark, trustTitle, tellEl, signedT, goodWord as goodWordOf, goodsWords as goodsWordsOf, packWord as packWordOf, thingWord, WEAR_LOOK, shortName as personShort } from './panels.js';
// (the door's answer as the rules will have it: refusing from with you is sore, not a grudge. Read only, as panels.js does)
import { trustAfter, trustBand } from '../../src/run/rules.mjs';
import { createRunMap } from './map.js';
import { createArrangeMode } from './arrange.js';
import { dressOf as dressWorn, thingOf, tryOn as tryOnOf } from '../../src/run/library.mjs';
import { saveSlot, packSave, unpackSave, atOf, pickedLine, refusedLine, replaceAsk, LOG_KEEP } from './save.js';
// (ui-3, leg 1: what just happened as a card and the day's journal, news.js; the run's own icons, icons.js)
import { newsOf, nightOf, journalOf, hourWord } from './news.js';
import { icon } from './icons.js';
// (ui-3, leg 2: the dock as data, dock.js: the three things in front of you and the six verbs)
import { dockOf, placeOf as dockPlace, arrowsTo } from './dock.js';
// (ui-3, leg 3: every piece's picture from the model the game draws, tiles.js)
import { createTiles } from './tiles.js';
// (ui-3, leg 3: THE LIBRARY, everything there is, library.js; its lists and words, catalog.js)
import { createLibrary } from './library.js';
import { nameOf as pieceName, tierWord } from './catalog.js';
// (join-1: THE TRY-OUT STOP, the fight behind the dead mall as a side trip of the page's, tryout.js and trip.js)
import { TRYOUT, TRYOUT_CHOICE, isTryout, withTryout, tryoutOffered, tryoutRow, tryoutGo, tryoutWhy } from './tryout.js';
import { createTrip } from './trip.js';

const CSS = new URL('./run.css', import.meta.url).href;
// (ui-3: the new frame's parts, ui.css, and their look, skin.css: every colour, outline and shadow, one file to swap)
const UI_CSS = new URL('./ui.css', import.meta.url).href;
const SKIN_CSS = new URL('./skin.css', import.meta.url).href;
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
// (ui-3, leg 2: W A S D are never the run's, kept for moving: the guide of every move is G, the stuff O)
const SHEETS = [
  { id: 'character', key: 'C', label: 'You', short: 'You', title: 'You', icon: 'person' },
  // (ui-3, leg 3: the owner, "where is the catalog?": every piece there is, L. The home risk slip went to K for it)
  { id: 'library', key: 'L', label: 'Library', short: 'Library', title: 'Library', icon: 'library' },
  { id: 'moves', key: 'G', label: 'Guide', short: 'Guide', title: 'Guide: every move there is', icon: 'journal' },
  { id: 'stuff', key: 'O', label: 'Stuff', short: 'Stuff', title: 'Stuff: everything to buy, everywhere', icon: 'goods' },
  { id: 'map', key: 'M', label: 'Map', short: 'Map', title: 'The map', icon: 'map' },
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
  if (!document.querySelector('link[data-rn-ui]')) document.head.append(h('link', { rel: 'stylesheet', href: UI_CSS, 'data-rn-ui': '' }), h('link', { rel: 'stylesheet', href: SKIN_CSS, 'data-rn-skin': '' }));
  const root = makeRoot(host);
  root.classList.add('rn');
  const cfg = RUN_CONFIG;
  // GOODS ON THE PAGE (goods-1): short words for what you carry, in the page's own type (panels.js)
  const goodWord = (g, n) => goodWordOf(cfg, g, n);
  const goodsWords = goods => goodsWordsOf(cfg, goods);
  const packWord = g => packWordOf(cfg, g);
  // (ui-3: the words the result card and the journal use for goods, places and a stop's cards: news.js)
  const newsWords = { good: (g, n) => goodWordOf(cfg, g, n), goods: g => goodsWordsOf(cfg, g, ' and '), pack: g => packWordOf(cfg, g), card: id => cardName(id), place: id => labelOf(id) };
  const hasGoods = goods => Object.values(goods ?? {}).some(n => n > 0);
  // what happened, acted out (demo/run/acted.js). `scenes: false` (?scenes=0) is the stage of step A: the player is
  // only put in the right place
  const actedOf = opts.scenes === false ? () => null : events => scenesOf(events);
  const speed = [1, 2, 4].includes(Number(opts.speed)) ? Number(opts.speed) : 1;

  // (the stage measures the panels it makes way for: `.hk-top`, `.hk-left > *` and `.hk-move-card`, stage/index.js
  // fitToPanels and stage/inside.js freeRect. The open panel is none of those: the picture does not make way for it)
  const el = {
    // (ui-3: the top line is an empty strip of its old height now, so the stage leaves the same room at the top; where
    // and when is its own card at the top left, your situation, the goal and the journal at the top right, and what
    // just happened a card between them. None of the three is a panel the stage makes way for)
    top: h('header', { class: 'hk-top hk-panel rn-top u-strip', 'aria-hidden': 'true' }),
    where: h('section', { class: 'u-where u-panel', 'aria-label': 'Where and when' }),
    side: h('aside', { class: 'u-side', 'aria-label': 'Your situation' }),
    res: h('section', { class: 'u-res u-panel', role: 'status', 'aria-live': 'polite', hidden: true }),
    // (said in the middle of the black between two places: tickMarks)
    dark: h('p', { class: 'u-dark-say', hidden: true, 'aria-hidden': 'true' }),
    // (the way back from the frame hidden: I, or this)
    back: h('button', { type: 'button', class: 'u-back u-btn is-quiet', hidden: true, title: 'Show the interface again (I)' }, 'Show the interface', h('kbd', { class: 'u-key' }, 'I')),
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
    // HOME PRESSURE (home-1): what holds it up, what brings it down, what it leads to, a slip beside the dock (the
    // meter's click, or L); and THE NOTICE that cannot be missed, over the picture's top: somebody at your door now and
    // the ways home, or how an attempt you were not there for went. Neither is a panel the stage makes way for
    homePrint: h('div', { class: 'rn-print rn-home-print', role: 'note', hidden: true }),
    alert: h('div', { class: 'rn-alert', role: 'alert', hidden: true }),
    // (save-1: NEW RUN's second ask, what it ends, a slip under the button)
    ask: h('div', { class: 'rn-new-ask', role: 'alert', hidden: true }),
    // (ui-3, leg 3: TRYING ON, said over the top of the picture while it lasts: what, that it is not yours, Take it off)
    trying: h('div', { class: 'u-trying-slip u-panel', role: 'status', 'aria-live': 'polite', hidden: true }),
  };
  const dock = h('section', { class: 'hk-panel rn-dock', 'aria-label': 'You' });
  const cardBody = h('div', { class: 'rn-card-body' });
  el.left.append(dock);
  // (the panel after the card: at phone width it is a sheet from the bottom over it; the day's report over both)
  root.append(el.top, el.where, el.side, el.notice, el.left, el.card, el.print, el.homePrint, el.sheet, el.res, el.alert, el.ask, el.trying, el.back, el.dark, el.overlay, el.toasts);
  el.back.addEventListener('click', () => cycleSize());

  const game = stageGame();
  // THE TILES (ui-3, leg 3; tiles.js): a piece's picture for the lists. Drawn only between scenes: while an hour plays,
  // the opening runs or the stage is between two places, nothing is drawn
  const busyWhy = () => (!(S.phase === 'choose' || S.phase === 'held' || S.phase === 'report' || S.phase === 'done') ? `phase ${S.phase}` : S.opening ? 'opening' : S.hold ? 'an hour holds' : stage.travelling ? 'travelling' : S.away ? 'on the try-out' : null);
  const tiles = createTiles({ busy: () => !!busyWhy() });

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
      // (ui-3 QUICK FIX: with their name up over them, the mark stands above the name, not on it: "PO♥TS")
      const tag = stage.actors?.has?.(id) ? stage.actors.get?.(id)?.tag : null;
      const lift = tag && tag.style.visibility !== 'hidden' && tag.style.display !== 'none' ? tag.offsetHeight + 3 : 0;
      if (at?.visible) m.el.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y - 4 - lift)}px)`;
    }
    if ((S.ticks = (S.ticks ?? 0) + 1) % 4 === 0) {
      clearFigures();
      // (ui-3 QUICK FIX: while the picture is black between two places, what is happening is said in the middle of it,
      // so the black reads as a cut, not as the game stopping)
      // (not over the subway car's own picture, which plays while the street behind it is black)
      const dark = !!stage.travel?.fade?.dark && S.phase === 'playing' && !S.opening && !document.querySelector('.sbw');
      el.dark.hidden = !dark;
      if (dark && el.dark.textContent !== (S.hold?.doing ?? '')) el.dark.textContent = S.hold?.doing ?? '';
    }
    if (!S.dead) requestAnimationFrame(tickMarks);
  }
  requestAnimationFrame(tickMarks);
  /**
   * WHILE A SCENE PLAYS, NOTHING OF THE FRAME'S CORNERS COVERS THE PLAYER OR WHOEVER THE SCENE NAMES (ui-3): a corner
   * block over one of them steps aside, faded out, until they are clear of it. The named are the ones with their name
   * up over them (the stage's tags); a figure is taken as the head and a little under it.
   */
  function clearFigures() {
    const blocks = [el.where, ...el.side.children];
    if (!(S.phase === 'playing' || S.hold)) {
      for (const b of blocks) b.classList.remove('u-clear');
      return;
    }
    const boxes = [];
    const me = stage.screenOf?.(YOU);
    if (me?.visible) boxes.push([me.x - 44, me.y - 40, me.x + 44, me.y + 96]);
    for (const t of document.querySelectorAll('.hk2-bubbles .hk2-tag')) {
      if (t.style.visibility === 'hidden' || t.style.display === 'none') continue;
      const r = t.getBoundingClientRect();
      if (r.width) boxes.push([r.left - 12, r.top - 8, r.right + 12, r.bottom + 96]);
    }
    for (const b of blocks) {
      const r = b.getBoundingClientRect();
      b.classList.toggle('u-clear', r.width > 0 && boxes.some(([l, t, rr, bb]) => l < r.right && rr > r.left && t < r.bottom && bb > r.top));
    }
  }
  /** Whoever is wary of you and out for the day stands apart turned to you. */
  function watchers() {
    const A = stage.actors;
    if (!A?.has(YOU)) return;
    const me = A.get(YOU);
    for (const p of S.v.people) if (p.here && p.outToday && p.mood === 'wary' && A.has(p.id)) A.face(p.id, me.x, me.z);
  }
  // ── THE RUN, SAVED IN THIS BROWSER (RUN.md "Saving"; demo/run/save.js): ONE SLOT, the run in progress whatever its
  // seed. The play link picks it up where it was saved; &new=1 starts a new run on the URL's seed and replaces it. A
  // page run by a tool (runtest=) never reads or writes it unless the tool asks (opts.save, autoplay.js &save=1)
  const Q0 = new URLSearchParams(location.search);
  const saving = opts.save ?? !Q0.get('runtest');
  // ── THE COMPOSITION'S SWITCHES (ui-3 leg 2, the owner's steer: the frame's composition is being chosen; these make the
  // likely changes one line each). FOLDED: what starts as one line in full size until the player opens it (then kept
  // in this browser); 'auto' is the goal's: open at home, one line out. WHERE_IN_DOCK: the place, the hour and how safe
  // it is on the dock's header line, at no extra height, and no card top left. Both can be tried on the real page:
  // &where=dock, and &fold=side,goal,journal,where (the blocks that start folded; &fold=none, none of them)
  const FOLDED = { where: false, side: false, goal: 'auto', journal: true };
  if (Q0.has('fold')) for (const k of Object.keys(FOLDED)) FOLDED[k] = Q0.get('fold').split(',').includes(k);
  const WHERE_IN_DOCK = Q0.get('where') === 'dock';
  const slot = saveSlot((() => {
    try {
      return saving ? globalThis.localStorage ?? null : null;
    } catch {
      return null;
    }
  })());
  let pickedUp = null;
  let refused = null;
  if (saving && Q0.get('new') === '1') {
    slot.clear();
    // (the link without its &new=1, so a reload picks this run up and does not start again)
    try {
      Q0.delete('new');
      history.replaceState(history.state, '', `${location.pathname}?${Q0}${location.hash}`);
    } catch {}
  } else if (saving) {
    const text = slot.read();
    if (text) {
      const r = unpackSave(text, cfg);
      if (r.ok) pickedUp = r;
      else {
        // (refused: kept under its own key, said plainly, and a new run on the URL's seed)
        slot.keepRefused(text);
        refused = r.why;
      }
    }
  }
  const S = {
    state: pickedUp?.state ?? newRun({ seed: Number(opts.seed) || 1, cfg }),
    v: null, sel: null, take: null, phase: 'start', result: null, t: 0, playing: null, line: null, skipped: false,
    resolve: null, dayStart: null, steps: 0, dead: false, hold: null, resultGone: false, resultT: null,
    // (ui-3, leg 2: the dock's list open, Shop's or Travel's, or null)
    list: null,
    // (goods-1: what of the goods at home to take out on stepping out, by good; the good picked for a selling option)
    goodsTake: null, goodPick: {},
    // (the opening, when one is asked for: 'before' the walk in begins, 'going' while it plays; a skip asked for before
    // it could be done is kept: skipWanted)
    opening: !opts.pilot && opts.scenes !== false ? 'before' : null, skipWanted: false,
    // (routes-1: the ride the player's own trip plays while a leg of a way is on the stage, 'foot' or 'skate': wayOn)
    ride: null,
    // (the first day's first steps, on the goal card until they are done or ×: firstSteps)
    wayIn: !opts.pilot && !pickedUp,
    // (the save: where the slot's run stands, for the mark on the top line: null before the first write, false when
    // the browser refuses it; the run's log; the morning's report not yet put away; the one line on picking up or on
    // a refused save; Earl's going, said on the top line that day)
    saveAt: pickedUp?.at ?? null, log: [], reportDue: null, pageNote: null, earl: null,
    // (ui-3: what just happened, as a card: news.js. It stays until the next pick or step, OK, Enter or Esc. THE JOURNAL:
    // every card of the run, short, kept in this page only (not in the save: a reload rebuilds it from the save's log);
    // the corners folded or not (D, J), and the frame's size, full, compact or hidden (I), kept in this browser)
    card: null, cardGone: false, journal: [], size: null,
    // (ui-3, leg 3: what is being tried on, { run slot: piece key }, or null: the stage shows it, the run never hears of it)
    tried: null,
  };
  if (pickedUp) {
    // PICKED UP: what the page keeps for itself, as it was (save.js PAGE_KEYS); a choice half made is not in it
    const P = pickedUp.page;
    Object.assign(S, { result: P.result ?? null, reportDue: P.report ?? null, log: P.log ?? [], after: P.after ?? null, raidNote: P.raidNote ?? null, notice: P.notice ?? null, rose: P.rose ?? null, earl: P.earl ?? null });
    S.pageNote = { head: 'Saved run', text: pickedLine(pickedUp.at) };
    // (the journal again from the save's log: its lines, without their chips)
    S.journal = (P.log ?? []).map(l => ({ day: l.day, hour: l.hour, at: hourWord(l.hour), tone: 'quiet', icon: 'clock', head: l.text, chips: [] }));
    // (the link's seed is the run's own: a reload, NEW RUN and the arrangement read it)
    try {
      if (Q0.get('seed') !== String(pickedUp.state.seed)) {
        Q0.set('seed', String(pickedUp.state.seed));
        history.replaceState(history.state, '', `${location.pathname}?${Q0}${location.hash}`);
      }
    } catch {}
  } else if (refused) S.pageNote = { head: 'Saved run', text: refusedLine(refused), refused: true };
  // (`kit`: things owned from the start, for the auto-play's tools: autoplay.js &kit=; a day's full energy with them.
  // Not on a run picked up: it has them already)
  if (!pickedUp && opts.kit && Object.keys(opts.kit).length) {
    // (routes-1: a thing of the street's, the skateboard, is owned as a thing, the way src/run/policies.mjs playSeason has it)
    const things = Object.fromEntries(Object.entries(opts.kit).filter(([k]) => cfg.things?.[k]));
    S.state.things = { ...(S.state.things ?? {}), ...things };
    S.state.owned = { ...S.state.owned, ...Object.fromEntries(Object.entries(opts.kit).filter(([k]) => !cfg.things?.[k])) };
    S.state.energy = S.state.owned.bed ? cfg.energy.bed : cfg.energy.mattress;
  }
  S.v = view(cfg, S.state);
  S.dayStart = pickedUp?.page.dayStart ?? ledgerOf(S.state);
  /** What the page keeps for itself with the run (save.js PAGE_KEYS). */
  const pageOf = () => ({ result: S.result, report: S.reportDue, log: S.log, after: S.after, raidNote: S.raidNote, notice: S.notice, dayStart: S.dayStart, rose: S.rose, earl: S.earl });
  /** THE SAVE: the run at a choice point and the page's own things, into the one slot. Never throws. */
  function saveNow(state = S.state, page = pageOf()) {
    if (!saving) return;
    let text = null;
    try {
      text = packSave({ state, view: view(cfg, state), page });
    } catch (err) {
      console.warn('[run] the run could not be saved:', err);
    }
    S.saveAt = text && slot.write(text) ? atOf(state, view(cfg, state)) : false;
  }
  // (ARRANGE MODE at the crib, demo/run/arrange.js: V, between choices; no hour passes while it is up)
  const arrange = createArrangeMode({ stage, root, pad: `pad:${YOU}`, seed: () => S.state.seed, can: () => S.phase === 'choose' && S.v?.place === 'crib' && !S.v.door && !S.dead, tile: (piece, o) => tiles.el(piece, o) });
  // (every hour the stage plays knows the people as the view has them after the step: who has left for the day, who
  // stands apart and watches. scenes.js presence)
  const lineOf = (o, door = null, at = []) => peopleOn(lineAt({ ...o, people: S.v?.people ?? [] }), door, at);
  // THE BINS ARE REAL ONES: the place table's trashcans and dumpsters become spots of the stage's blocks (acted.js)
  binsOf(stage.map);
  // (routes-1: the stop's own spots on DEAD AIR's block, the place table's standing places: scenes.js)
  stopSpots(stage.map);
  /**
   * Two things the new events need of where people stand, laid over the hour's line (scenes.js presence is not
   * changed for them): whoever thinks less of you (seen you in the bins) keeps their back to you; and a regular at
   * your door (`door`: the view's) stands at the foot of your step, shaking, facing the door, for as long as he is there.
   */
  const EXTRA = /^npc:(passer:\d+|robber[12]|police1)$/;
  function peopleOn(line, door, at = []) {
    const cold = new Set((S.v?.people ?? []).filter(p => p.mood === 'cold').map(p => p.id));
    const want = [...(door ? [{ id: door.id, spot: STEP, action: 'chore', clips: door.calm ? ['listen_nod'] : ['withdrawal_shake'], face: YOU, back: null }] : []), ...at];
    // (home-1: COUSIN EARL ON YOUR STEP while he is on, the view's guard: at his post to the east of your door (porch.post),
    // his back to it, at the city's guard_post. One person: buying his cartons
    // walks you to him there)
    const g = S.v?.home?.defences?.guard;
    if (g?.on && !want.some(w => w.id === GUARD)) want.push(...guardAt());
    // (and WHOEVER COMES FOR THE CRIB, once they are at your door, the notice: south-west of your step (porch.visit),
    // looking round, so home in time they are there to meet. Not before: waiting by the trailer on the day, they stood
    // in the way of the player stepping out past them, and lined up with Earl's head in the picture, 2026-11-16)
    const H = S.v?.home;
    const due = H?.notice;
    if (due && !want.some(w => w.id === homeWho(due.who.id))) want.push(...raiderAt(due.who, 'wait'));
    const found = new Map();
    for (const [block, list] of Object.entries(line.npcs ?? {})) {
      for (const n of list) {
        if (cold.has(n.id) && !n.face && !n.back) n.back = YOU;
        if (want.some(w => w.id === n.id)) found.set(n.id, [block, n]);
        // (the trailer park has no sidewalk of the city's: its way in is its own middle, in the picture. Whoever comes
        // on for a scene there, somebody passing, the Dunn brothers, an officer, comes along Elm St by the bus stop,
        // where the city's own passers-by walk, and walks in from there. director.js wings, travel.js wayIn)
        if (FAR_IN.has(block) && EXTRA.test(n.id) && n.spot === 'street') n.spot = 'bus';
      }
    }
    // (each put where the hour wants them at the trailer, from wherever presence had them. A regular at the door: given
    // what he asked, he is calm, stays for the hand-over, and goes)
    for (const { id, role = 'buyer', ...w } of want) {
      const f = found.get(id);
      const n = f?.[1] ?? { id, role };
      if (f && f[0] !== 'projects') line.npcs[f[0]] = line.npcs[f[0]].filter(q => q !== n);
      if (!f || f[0] !== 'projects') (line.npcs.projects ??= []).push(n);
      Object.assign(n, w);
    }
    return line;
  }
  // (home-1) THE PORCH'S OWN PLACES (acted.js VISIT, POST, WAIT), said from the trailer's own door (its front faces
  // the lane, -z): whoever comes stands south-west of the step, 1.4 m off the player's way up to it (VISIT), and while
  // the notice is up waits further off, by the lane south-west of the trailer (WAIT), clear of his way home, which comes
  // up from the south-west; Cousin Earl keeps his post 3 m east of the door, his back to it (POST), away from the ways
  // out to the lane. As one place, the step, the player walked in through whoever waited there and stood pressed into
  // Earl in the doorway; where the pad meets the lane is the mailbox's; and two of them across the step lined up head on
  // head in the picture (2026-11-16)
  const porch = (() => {
    const B = stage.map?.BLOCKS?.projects;
    // (the trailer's own door, the place table's: the pad's `door` in the stage's map is where the pad meets the lane)
    const d = B?.spots?.[`home:${YOU}:door`];
    if (!d) return { visit: STEP, post: YARD, wait: FRONT, waitEast: FRONT };
    B.spots[VISIT] ??= [d[0] - 1.4, d[1] - 2.65];
    B.spots[POST] ??= [d[0] + 3.0, d[1] - 0.6];
    B.spots[WAIT] ??= [d[0] - 3.0, d[1] - 5.45];
    // (with Earl on, whoever comes stands on his side for it, south-east past the yard's stall: from the south-west their
    // walk up to him crossed the front of the step under the player's nose)
    B.spots[WAIT_EAST] ??= [d[0] + 4.0, d[1] - 4.5];
    return { visit: VISIT, post: POST, wait: WAIT, waitEast: WAIT_EAST };
  })();
  /**
   * (home-1) Whoever comes for the crib, put at the trailer for an hour: at the foot of the step (`step`), looking round
   * for anyone coming; in the yard beside it (`yard`) or where the pad meets the lane (`front`), a smoke, looking the
   * trailer over; facing it.
   */
  const raiderAt = (who, where = 'step') => (who ? [{ id: homeWho(who.id), spot: where === 'step' ? porch.visit : where === 'wait' ? porch.wait : where === 'waitEast' ? porch.waitEast : where === 'yard' ? YARD : FRONT, action: 'chore', clips: where === 'step' ? ['deal_lookout'] : ['smoke'], face: YOU, back: null }] : []);
  /** Cousin Earl on the step for an hour whatever the view says now (an attempt he met: beaten, he is off after it). */
  const guardAt = (spot = porch.post) => [{ id: GUARD, role: 'supplier', spot, action: 'chore', clips: ['guard_post'], face: null, back: YOU }];
  /** An attempt on the crib that was met at the door, with the player there: coming home in time, or in the night. */
  const metAtDoor = e => !!e && (e.place === 'crib' || e.place === 'park') && (!!e.fight || e.how === 'guard');
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
    // (the opening's first black seconds, while the page waits for steady frames: nothing plays yet to skip. Kept, and
    // done as soon as it can be: the walk in settled at once, the camera's move not played. opening.js skip)
    if (S.opening === 'before') {
      S.skipWanted = true;
      stage.opening?.skip?.();
      return;
    }
    if (stage.travelling) return void stage.skipTravel();
    // (routes-1: the board still rolling in after the hour, wayOn: ended at once, under a dip, on his spot)
    if (!S.playing && S.phase === 'playing' && stage.travel?.rides?.busy?.(YOU)) return void dipped(() => stage.travel.cancel(YOU));
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
  // (routes-1: the player's own way along a route is the ride its way names, `foot` or `skate`, both halves of every
  // leg: setting out, at the stop, going on, arriving. S.ride is set while such an hour plays: wayOn below)
  if (stage.travel?.choose && !stage.travel._runWay) {
    const choose1 = stage.travel.choose;
    stage.travel._runWay = true;
    stage.travel.choose = trip => (S.ride && trip.actor?.id === YOU && !trip.actor.taken && stage.travel.rides ? S.ride : choose1(trip));
  }
  if (stage.travel?.arrive && !stage.travel._runHome) {
    const arrive0 = stage.travel.arrive;
    stage.travel._runHome = true;
    stage.travel.arrive = (actor, o) => {
      // (routes-1: INTO THE FLEA MARKET ON FOOT OR ON THE BOARD, by its own front on Washington St, the corner's side: from
      // Fit Street's side the way in started behind the stalls' west row and was held up there until it was given up
      // and he was set down in plain sight, 1 arrival in 12, 2026-11-16)
      if (S.ride && actor.lead && o.at === 'market' && o.from !== 'corner') return stage.travel.arrive(actor, { ...o, from: 'corner' });
      // (routes-1, A STAND-DOWN: ABOVE 1x THE BOARD IS NOT ROLLED IN. At 2x and 4x the skate's last walk, from where he
      // steps off to his spot, ran out its time behind something and set him down there in plain sight, 3 arrivals in 5
      // (skater, seed 3, 4x, 2026-11-16; none at 1x). There the arrival half is on foot; leaving is on the board at
      // every speed, and at 1x, the game's own pace, he rolls in and steps off)
      if (S.ride === 'skate' && actor.lead && speed > 1 && (o.mode ?? actor.mode) === 'skate') return arrive0(actor, { ...o, mode: 'foot' });
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
    // (the room shows what is owned: the bed, and the things for the trailer, goods-1: set/starter.js)
    // (a run picked up has no opening: it is put where it was saved, under the stage's own cut)
    const opened = await stage.openRun?.({ you: YOU, owned: () => ({ ...S.state.owned, things: { ...(S.state.things ?? {}) } }), opening: !opts.pilot && opts.scenes !== false && !pickedUp });
    stage.begin({ game, you: YOU, mode: 'play' });
    dressYou();
    stage.markPlayer?.(YOU);
    stage.setSpeed(speed);
    const home = () => lineOf({ day: S.state.day, hour: S.state.hour, place: 'crib' });
    if (opened?.walkIn && stage.walkIn) {
      // THE OPENING (the owner: "your character walking into the trailer with the cut scene like what happens in the
      // normal game"): everyone is put with the player OUTSIDE, in the trailer park, under the stage's black; then
      // the camera comes down to them as they walk home and in, which is this page's own going inside
      await playOn(lineOf({ day: S.state.day, hour: S.state.hour, place: 'projects' }), { instant: true });
      // (it is an hour playing as any other: Space is this page's own skip of it; the dock says so throughout.
      // A skip asked for before the walk began is the walk settled at once: skip, S.opening)
      S.phase = 'playing';
      paint();
      await stage.walkIn({ you: YOU, go: () => {
        S.opening = 'going';
        return playOn(home(), { instant: S.skipWanted });
      } });
      S.opening = null;
    } else {
      S.opening = null;
      // wake at the crib: put there at once (a run picked up: where it was saved, and what it left to see: pickUp)
      await dipped(() => playOn(pickedUp ? placeLine(S.state) : home(), { instant: true }));
      if (pickedUp && !S.dead) await pickUp();
    }
    while (!S.dead) {
      S.v = view(cfg, S.state);
      S.phase = 'choose';
      // (the save at every choice point, with the page's own things as they are now that the hour has played)
      saveNow();
      // (Arrange on the dock asks again whether it can start, a few times, while the room comes up: arrangeKey)
      S.arrangeTries = 0;
      S.sel = wayOnKey(S.v);
      S.list = null;
      // (each hour's options are dealt anew: their targets start at the one dealt)
      S.targets = {};
      S.goodPick = {};
      if (S.v.place !== 'crib') S.goodsTake = null;
      // (the cash to step out with starts, each time you are home, at what the first thing out there costs: takeFirst)
      if (S.v.place !== 'crib') S.take = null;
      else if (S.take === null) S.take = takeFirst(S.v).take;
      paint();
      // (the tiles' renderer, made and warmed at idle once the run is choosing: the first list does not wait for it)
      tiles.warm();
      const choice = await ask();
      if (S.dead) return;
      await act(choice);
      // (what you wear, on the figure: after the hour has played, so a thing bought is put on once it is handed over)
      dressYou();
    }
  }

  // WHAT YOU WEAR, ON THE FIGURE (goods-1): each thing worn as its piece of the city's cast (panels.js WEAR_LOOK),
  // dressed by the stage over the player's own look (stage/actors.js dress); the portrait follows (showFace)
  const dressOf = () => dressWorn(cfg, S.state.worn);   // (lib-1: a named thing's piece, or a piece of the library)
  const dressKey = () => JSON.stringify(dressOf());
  function dressYou() {
    try {
      if (stage.actors?.has?.(YOU) && stage.actors.dress?.(YOU, dressOf()) && face.kit) showFace(S.sheet === 'character');
    } catch (err) {
      console.warn('[run] could not dress the player:', err);
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
    // (ui-3, leg 3: what is tried on comes off before anything is done for real)
    if (S.tried) takeOff(null, false);
    const r = S.resolve;
    S.resolve = null;
    r(choice);
  }

  /** The choices whose outcome waits for their scene (the reveal), the ones played as work, and the door's events. */
  const HOLDS = new Set(['job', 'subway', 'inside', 'out', 'rob', 'bins', 'shop', 'pack', 'get', 'rough', 'give', 'refuse', 'walk', 'skate', 'onward', 'card', 'guard']);
  const WORKS = new Set(['job', 'rob', 'bins', 'card']);
  // (routes-1: the moves along a way: setting out on foot or on the board, and going on from a stop. wayOn)
  const WAYS = new Set(['walk', 'skate', 'onward']);
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
    // (routes-1: and the same at the end of a way home, on foot or on the board)
    const home = (choice.do === 'subway' && choice.to === 'park' && state.place === 'park') || (WAYS.has(choice.do) && state.place === 'park' && !state.route);
    if (home) {
      const r = step(cfg, state, { do: 'inside' });
      state = r.state;
      // (goods-1: and what was left at home, said on the same line: "You left 4 cigarettes at home")
      const left = st => (hasGoods(st) ? ` You left ${goodsWords(st)} at home.` : '');
      const banked = r.events.some(e => e.type === 'bank');
      events = [...events, ...r.events.map(e => (e.type === 'bank' ? { ...e, text: `You made it home and banked $${e.money[0].amount}.${left(e.stashed)}` } : e.type === 'inside' ? { ...e, text: `You made it home.${banked ? '' : left(e.stashed)}` } : e))];
    }
    if (!checkRunBooks(state).ok) throw new Error('the run\'s books do not balance');
    S.state = state;
    S.v = view(cfg, state);
    S.steps += 1;
    S.result = resultOf(events, before);
    // (ui-3: WHAT JUST HAPPENED, AS A CARD, and its line in the day's journal. A step that ended the day has none: the
    // night's report is its card, and what the night brought is the new day's first lines of the journal)
    const news = { cfg, before, state, events, v0: view(cfg, before), v1: S.v, words: newsWords };
    S.card = newsOf(news);
    S.cardGone = false;
    if (S.card) {
      // (the quiet roll, said: nobody came for you that hour, at its chance)
      const calm = S.result.rolls.find(x => x.quiet);
      if (calm) S.card.chips.push({ tone: 'gain', icon: 'check', text: calm.no });
      S.journal.push({ ...journalOf(S.card), step: S.steps });
    } else S.journal.push(...nightOf(news).map(j => ({ ...j, step: S.steps })));
    // (NEWS FROM ELSEWHERE, a call to the police where you are not: its own line, as its slip says it)
    for (const e of events.filter(x => x.notice)) {
      const n = e.notice;
      const said = `${e.who?.name ? `${cap(e.who.name)} called the police on ${cfg.places[n.place]?.label ?? n.place}. ` : ''}${n.text ?? ''}`.trim();
      if (said) S.journal.push({ day: state.day, hour: before.hour, at: hourWord(before.hour), tone: 'news', icon: 'police', head: said, chips: [], step: S.steps });
    }
    // (the first steps, ticked off as each is done: out, a pack, a sale tried, the cash banked after it)
    if (S.wayIn) {
      const F = (S.first ??= {});
      if (events.some(e => e.type === 'out')) F.out = true;
      if (events.some(e => e.type === 'pack')) F.pack = true;
      if (F.pack && events.some(e => e.type === 'job' && e.goods)) F.sold = true;
      if (F.sold && events.some(e => e.type === 'bank')) F.home = true;
      if (F.home) S.wayIn = false;
    }
    // (trust-1: the heat that landed on each place this step, shown by its heat on the top line and the map while what
    // just happened is said; and a call to the police somewhere you are not, kept as the notice under the top line)
    const was = Object.fromEntries((view(cfg, before).places ?? []).map(p => [p.place, p.heat]));
    S.rose = Object.fromEntries((S.v.places ?? []).filter(p => p.heat > (was[p.place] ?? 0)).map(p => [p.place, p.heat - (was[p.place] ?? 0)]));
    const told = events.find(e => e.notice);
    if (told) S.notice = { ...told.notice, day: state.day, who: told.who?.name ?? null };
    // (goods-1: a stop took your goods and turned their connect against you: that is tomorrow's, and elsewhere, so a
    // notice, with the other connect that still sells as what to do about it)
    // (home-1: an attempt settled while you were out, or held, is said at once wherever you are, the notice, and seen
    // when you next come home, S.after; one met at your door is its scene. One called off is a short notice)
    const raid = events.find(e => e.type === 'raid');
    if (raid && !metAtDoor(raid)) {
      S.after = raid;
      S.raidNote = raid;
    }
    const off = events.find(e => e.type === 'calledOff');
    if (off) S.notice = { head: 'Called off', day: state.day, who: null, text: off.text };
    const pinched = events.find(e => e.type === 'stopped' && e.trusts?.length);
    if (pinched) {
      const ids = new Set(pinched.trusts.map(t => t.who?.id));
      const names = pinched.trusts.map(t => `${cap(t.who?.name ?? 'the connect')}${t.offDays ? ` (${t.offDays} day${t.offDays > 1 ? 's' : ''})` : ''}`).join(' and ');
      const days = Math.max(...pinched.trusts.map(t => t.offDays ?? 0));
      const other = (S.v.connects ?? []).find(c => !ids.has(c.who?.id) && c.sells);
      S.notice = { head: 'Pinched', day: state.day, until: state.day + 1, who: null,
        text: `The police took ${[pinched.seized ? money(pinched.seized) : null, goodsWords(pinched.goodsSeized)].filter(Boolean).join(' and ')} off you. ${names} ${days ? 'won\'t sell to you' : 'trust you less'}; heat ${pinched.heatAfter} after jail.`,
        suggest: { text: other ? `Buy ${packWord(other.good)}s from ${cap(other.who.name)}, ${other.placeLabel}` : 'Sell what you left at home' } };
    }
    // (save-1: COUSIN EARL'S GOING, the morning his stretch is over: said on the top line that day, not as a loss)
    const gone = events.find(e => e.type === 'guard' && !e.on && e.why === 'done');
    if (gone) S.earl = { day: state.day, text: gone.text, who: gone.who?.name ?? null };
    // THE SAVE (RUN.md "Saving"): the state after the step is a choice point, saved now, before its hour plays, so a
    // reload in the middle of a scene comes back to the next choice with what just happened, not to this one again.
    // The morning's report goes with it until it is put away; the day's ledger is the new day's
    S.log = [...S.log, { day: before.day, hour: before.hour, text: S.result.lines.map(l => l.text).join(' ') }].slice(-LOG_KEEP);
    const report = events.some(e => e.type === 'morning' || e.type === 'released') ? reportOf(S.dayStart, before, state, events) : null;
    S.reportDue = report;
    S.pageNote = null;
    saveNow(state, { ...pageOf(), dayStart: report ? ledgerOf(state) : S.dayStart });
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
    if (choice.do === 'buy' || choice.do === 'wear' || choice.do === 'unwear') {
      // (bought at the crib, or something put on or taken off there: nothing to play; the figure is dressed after)
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
    } else if (choice.do === 'guard') {
      // COUSIN EARL ON YOUR STEP (home-1, save-1): hired, out on the porch, the three days' money handed over, he takes up
      // his post, and the player stays out on his porch with him (the next move is from there, as after a grudge).
      // Kept on from his last day: nothing to play (he is on the step already: acted.js), the player stays in
      const hired = events.some(e => e.type === 'guard' && e.paid && !e.kept);
      await playOn(lineOf({ ...hourOf(state), place: hired ? 'park' : 'crib', staged: actedOf(events.filter(e => e.type === 'guard')), verb: 'move' }));
      S.hold = null;
    } else if (WAYS.has(choice.do) && state.place !== 'jail' && state.place !== 'clinic') {
      await wayOn(choice, before, state, events, home);
      S.hold = null;
    } else {
      const taken = state.place === 'jail' || state.place === 'clinic';
      const staged = actedOf(events);
      // (the hour you leave the market is still an hour there: what it brought is played THERE, and then the ride.
      // As one hour the stage played the scenes, then started the player's walk home and waited on it, then the ride)
      const there = home ? actedOf(events.filter(e => e.place === 'market')) : staged;
      // (home-1: home in time for whoever is at the door, or home after an attempt you were not there for: homeArrival)
      const arrival = home ? homeArrival(events) : null;
      const indoors = arrival?.staged ?? null;
      // (the ride home lands a little up the lane from the trailer: landing())
      if (home) S.homeward = true;
      if (choice.do === 'subway' && !taken && there?.events.length) {
        await playOn(lineOf({ ...hourOf(before), place: before.place, staged: there, verb: 'move' }));
        if (!S.dead) await playOn(lineOf({ ...hourOf(state), place: arrival?.park ? 'park' : state.place, staged: indoors, verb: 'move' }, null, arrival?.at ?? []));
      } else {
        // (home-1: THE NOTICE ON A RIDE OUT is taken once there, its own short hour: a scene at the far end of a trip
        // is at a place not yet loaded when the hour starts, and the stage left it unplayed, measured 2026-11-16)
        const ride = choice.do === 'subway' && !home && !taken && staged?.events.some(e => e.kind === 'run:alarm');
        const trip = ride ? actedOf(events.filter(e => e.type !== 'alarm')) : staged;
        await playOn(lineOf({ ...hourOf(state), place: arrival?.park ? 'park' : state.place, taken: taken ? endOf(before.place).block : null, staged: home ? indoors : trip, verb: WORKS.has(choice.do) ? 'work' : 'move' }, choice.do === 'out' && atDoor.length ? doorWho : null, arrival?.at ?? []));
        if (ride && !S.dead) await playOn(lineOf({ ...hourOf(state), place: state.place, staged: actedOf(events.filter(e => e.type === 'alarm')), verb: 'move' }));
      }
      S.homeward = false;
      await homeThen(state, arrival);
      if (arrival?.after && !S.dead) await afterCard(arrival.after);
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
      S.dayStart = ledgerOf(state);
      const shown = showReport(report).then(() => {
        S.reportDue = null;
      });
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
      // HOME PRESSURE IN THE MORNING (home-1): what the night brought to your door (met there), who was seen casing
      // your crib, or what an attempt you were not there for left: seen at the trailer, the player out on his porch
      const front = homeFront(state, events);
      if (front && !S.dead) await homeMorning(state, front);
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
   * A LEG OF A WAY (routes-1, RUN.md "Routes"): setting out from the trailer park or the flea market, or going on from
   * the stop, on foot or on the board (the rides' `foot` and `skate`, demo/stage/rides: a few steps off, the cut, and
   * the walk or the roll in; the camera with the player as a walk at a place has it). What the hour brought where you
   * were (the market's leaving hour, an hour on Fit Street's ground: the Dunn brothers, the police) is played THERE
   * first, as the subway's leaving hour is; then the leg. Home at the end of one: the arrival a little up the lane and
   * the walk in at the door, as from the subway (landing).
   */
  async function wayOn(choice, before, state, events, home) {
    const way = before.route?.way ?? (choice.do === 'skate' ? 'board' : 'foot');
    const ride = cfg.ways[way]?.scene?.ride ?? 'foot';
    const there = actedOf(events.filter(e => e.place === before.place));
    if (there?.events.length) await playOn(lineOf({ ...hourOf(before), place: before.place, staged: there, verb: 'move' }));
    if (S.dead) return;
    // (home-1: home in time for whoever is at the door, or home after an attempt you were not there for: homeArrival)
    const arrival = home ? homeArrival(events) : null;
    // (home-1: the notice on the way is taken once there, its own short hour after the leg: index.js act, the ride out)
    const after = home ? arrival.staged : actedOf(events.filter(e => e.place !== before.place && e.type !== 'alarm'));
    const alarm = home ? null : events.find(e => e.type === 'alarm' && e.place !== before.place);
    S.ride = ride;
    if (home) S.homeward = true;
    try {
      await playOn(lineOf({ ...hourOf(state), place: arrival?.park ? 'park' : state.place, staged: after, verb: 'move' }, null, arrival?.at ?? []));
      // (THE BOARD ROLLS IN PAST THE HOUR: the stage's hour is over once the player is on stage at the new place, and a
      // skate's arrival then rolls, steps off and walks to the spot. The next choice waits for it, eight seconds at
      // most: chosen over it, the next hour's walk and the arrival's own fought, and the arrival set him down on his
      // spot in plain sight. Skater, seed 3, at the stop, 2026-11-16)
      const R = stage.travel?.rides;
      if (R?.busy?.(YOU) && !S.dead) await Promise.race([stage.actors.until(() => !R.busy(YOU)), stage.actors.seconds(8)]);
    } finally {
      S.ride = null;
      S.homeward = false;
    }
    if (alarm && !S.dead) await playOn(lineOf({ ...hourOf(state), place: state.place, staged: actedOf([alarm]), verb: 'move' }));
    await homeThen(state, arrival);
    if (arrival?.after && !S.dead) await afterCard(arrival.after);
  }

  /**
   * The morning's cut home: at the crib, or, with a regular at the door, the player out on his porch and the regular
   * at the foot of the step (the door's scene names the porch as where the player stays: its steps are not played in
   * a cut, only where everyone ends).
   */
  function morningLine(state, events = []) {
    // (home-1: with something to see at the trailer this morning, the player is put out on his porch under the same
    // cut, and whoever it is where they stand for it: homeFront)
    // (the player stays in: he comes out to it, by his door, as the morning's scene begins, and the picture comes with
    // him as it does when he steps out. Put out on the porch under the cut, the camera kept the trailer park's wide frame)
    const front = homeFront(state, events);
    if (!state.door) return lineOf({ ...hourOf(state), place: 'crib' }, null, front?.at ?? []);
    return lineOf({ ...hourOf(state), place: 'park', staged: actedOf([doorEvent(state, events)]), verb: 'move' }, state.door, front?.at ?? []);
  }

  // ── HOME PRESSURE AT THE TRAILER (home-1, RUN.md "Home pressure") ──────────────────────────────────────────────────
  /**
   * HOME AGAIN, by the subway, on foot or on the board: in time for whoever is at your door (up to it at a run, and the
   * attempt played there: Earl on the step facing them, the fight at the door), or home after an attempt you were not
   * there for (at the door a look round, Earl's word if he saw them off; inside, at the floorboard, what is missing).
   * → { staged, at: who stands where at the trailer, after: the attempt seen now }
   */
  function homeArrival(events) {
    const raid = events.find(e => e.type === 'raid');
    const met = metAtDoor(raid) ? raid : null;
    const after = met ? null : S.after;
    const bank = events.filter(e => e.type === 'bank');
    // (whoever came waits off the player's way while he comes up the lane, and, him inside, steps up to the porch for
    // the door's fight; with Earl on they stay off it, and walk up to him in the scene)
    // (with Earl on, they cross to his side while the player is in, not while he comes up the lane: arriving there from
    // away, they were seen to come on in the picture, 2026-11-16)
    const at = met ? (met.guard ? [...guardAt(), ...raiderAt(met.who, 'wait')] : raiderAt(met.who, 'wait')) : after?.how === 'guard' ? guardAt() : [];
    const atDoor = met ? (met.guard ? [...guardAt(), ...raiderAt(met.who, 'waitEast')] : raiderAt(met.who, 'step')) : at;
    if (!met && !after) return { staged: actedOf(bank), at, after, then: [] };
    // (IN HOURS OF THE STAGE'S OF THEIR OWN, not one: the ride in and up to his door; in; and out to what happens there,
    // as a regular's fight at the door is played. As one hour the fight's pair was stood
    // together on open ground by the lane, the player set down there from his porch, 2026-11-16)
    const front = actedOf([met ? { type: 'homeMeet' } : { type: 'homeAfter', raid: after }]);
    const then = [
      // (each ends inside, so the picture is the one at his door going in: the trailer park's wide one otherwise)
      // (met: in first, what he carried banked, then out again to them on the porch: the picture comes with him out of
      // his door as it does in the morning; arriving from the lane it stays the trailer park's wide frame, where the
      // two at the door were a few pixels each, 2026-11-16. Then in again, its own short hour: whoever came walks
      // off, kept at the step only while it lasted)
      // (met: going in past them is the meeting's too, so the door's shot holds him and them then as well: keep)
      { place: 'crib', staged: actedOf([...bank, ...(after?.taken ? [{ type: 'homeMissing' }] : [])]), at: atDoor, ...(met ? { keep: [YOU, homeWho(met.who?.id)], also: met.guard ? [GUARD] : null } : {}) },
      // (and while he goes in, whoever came keeps off to the waiting place, not across his step: they go the hour after)
      // (the hour at the door holds the player and whoever came, and Earl with him on, whole in the door's shot: keep)
      ...(met ? [{ place: 'park', staged: actedOf([met]), at: atDoor, keep: [YOU, homeWho(met.who?.id)], also: met.guard ? [GUARD] : null }, { place: 'crib', staged: null, at: raiderAt(met.who, met.guard ? 'waitEast' : 'wait') }] : []),
    ];
    return { staged: front, at, after, then, park: !!met };
  }
  /** The hours after the ride in (homeArrival `then`), each played at the trailer. */
  async function homeThen(state, arrival) {
    if (!arrival?.then?.length) return;
    // (the top line says where he is seen: at home, not still where the ride came from)
    S.where = view(cfg, state).placeLabel;
    paint();
    try {
      for (const h of arrival.then) {
        if (S.dead) return;
        keepInShot(h.keep, h.also);
        await playOn(lineOf({ ...hourOf(state), place: h.place, staged: h.staged, verb: 'move' }, null, h.at));
      }
    } finally {
      keepInShot(null);
      S.where = null;
    }
  }
  /**
   * THE VISITOR AT YOUR DOOR, IN THE PICTURE (save-1, the one camera change the owner allowed): while somebody cases
   * the trailer, or is met at the door, the door's low shot holds the player and them whole (and Cousin Earl, on, if
   * the frame allows), its aim and distance the stage's (demo/stage/inside.js keep); when no low lens there can, the
   * picture keeps the Lock on the player, as a moment later. Null lets it go.
   */
  const keepInShot = (ids, also = null) => stage.inside?.keep?.(ids?.filter(Boolean) ?? null, also);
  /**
   * What the morning has to show at the trailer, the player coming out to his porch for it: an attempt in the night met
   * at the door, somebody seen casing it, or an attempt you were not there for (out of the jail or the clinic).
   * → { kind, event, at: who stands where for it } or null
   */
  function homeFront(state, events = []) {
    if (opts.scenes === false || state.place !== 'crib') return null;
    const door = !!state.door;
    const night = events.find(e => e.type === 'raid' && e.night);
    if (night && metAtDoor(night)) return { kind: 'night', event: night, at: night.guard ? [...guardAt(), ...raiderAt(night.who, 'waitEast')] : raiderAt(night.who, 'step') };
    const casing = events.find(e => e.type === 'casing');
    // (at the foot of your step, looking your door over, as a regular stands there to ask: face to face with you as you
    // come out to the porch. Where the pad meets the lane is behind the camera there, and in the yard a neighbour's porch
    // across it stood head in head with them in the picture, 2026-11-16. A regular on the step this morning: the yard)
    if (casing) return { kind: 'casing', event: casing, at: door && state.door.id === homeWho(casing.who.id) ? [] : raiderAt(casing.who, 'step') };
    if (S.after) return { kind: 'after', event: S.after, at: S.after.how === 'guard' ? guardAt() : [] };
    return null;
  }
  /** The morning's scene at the trailer (homeFront), its card, and back inside (unless a regular waits at the door). */
  async function homeMorning(state, front) {
    const e = front.event;
    // (it plays as any hour: Skip and Space end it)
    S.phase = 'playing';
    paint();
    const staged = actedOf([{ type: 'porch' }, front.kind === 'after' ? { type: 'homeAfter', raid: e } : e]);
    // (somebody casing the trailer, or met at the door in the night: them and the player whole in the door's shot)
    const g = front.kind === 'night' ? !!e.guard : !!S.v?.home?.defences?.guard?.on;
    if (front.kind === 'casing' || front.kind === 'night') keepInShot([YOU, homeWho(e.who?.id)], g ? [GUARD] : null);
    try {
      await playOn(lineOf({ ...hourOf(state), place: 'park', staged, verb: 'move' }, state.door, front.at));
    } finally {
      keepInShot(null);
    }
    if (S.dead) return;
    if (front.kind === 'casing') await warningCard(e);
    if (!state.door && !S.dead) await playOn(lineOf({ ...hourOf(state), place: 'crib', staged: front.kind === 'after' && e.taken ? actedOf([{ type: 'homeMissing' }]) : null, verb: 'move' }));
    if (front.kind === 'after' && !S.dead) await afterCard(e);
  }
  /** THE WARNING'S CARD (home-1): who was seen, why them, what is at stake, and what you could do (the event's own list). */
  function warningCard(e) {
    paint();
    const could = (e.could ?? []).filter(c => !c.owned && !c.on && c.available !== false);
    const plate = h('div', { class: 'hk-screen' }, h('div', { class: 'hk-plate rn-report rn-home-card' },
      h('header', null, h('span', { class: 'hk-kicker' }, `Day ${e.day} · seen at your trailer`),
        h('h1', null, `${cap(e.who.name)} was casing your crib`),
        h('p', null, `${WHO_WHY[e.why] ?? ''} Hanging round your door, looking it over: they will try it tomorrow, while you are out.`),
        h('p', { class: 'rn-night is-bad' }, `At stake: ${money(e.stake.takes)} of the ${money(e.stake.banked)} you have banked (${e.stake.share}%).`)),
      h('div', { class: 'rn-could' }, h('b', null, 'You could'), h('ul', null, could.map(c => h('li', null, cap(c.text))))),
      h('p', { class: 'hk-fine' }, `Pressure at home ${e.pressure.value} of ${e.pressure.max}: L shows what holds it up.`),
      h('div', { class: 'hk-night-foot' }, h('button', { class: 'k-btn is-primary hk-go', onclick: () => S.onPress?.() }, 'Got it', kbd('Enter')))));
    return overlay(plate, 900);
  }
  /** HOME AFTER AN ATTEMPT YOU WERE NOT THERE FOR (home-1): what it left, once you have seen the door and the floorboard. */
  function afterCard(raid) {
    S.after = null;
    S.raidNote = null;
    S.hold = null;
    paint();
    const guard = raid.how === 'guard';
    const title = guard ? `${cap(raid.guard?.who?.name ?? 'Your guard')} saw them off` : raid.taken ? `They got in: ${money(raid.taken)} gone` : raid.gotIn ? 'They got in, and found nothing' : 'The door held';
    const plate = h('div', { class: 'hk-screen' }, h('div', { class: 'hk-plate rn-report rn-home-card' },
      h('header', null, h('span', { class: 'hk-kicker' }, `Home · while you were ${raid.held ? 'held' : 'out'}, day ${raid.day}${raid.night ? ', in the night' : ` at ${String((raid.hour ?? 0) % 24).padStart(2, '0')}:00`}`),
        h('h1', null, title),
        h('p', null, raid.text),
        h('p', { class: `rn-night${raid.taken ? ' is-bad' : ' is-door'}` }, raid.taken ? `Missing from under the floorboard: ${money(raid.taken)}. Banked now: ${money(S.state.banked)}.` : `Nothing missing. Banked: ${money(S.state.banked)}.`),
        raid.guard?.beaten ? h('p', { class: 'rn-night is-bad' }, `${cap(raid.guard.who.name)} is hurt: off ${raid.guard.hurtDays} days.`) : null),
      h('div', { class: 'hk-night-foot' }, h('button', { class: 'k-btn is-primary hk-go', onclick: () => S.onPress?.() }, 'Go on', kbd('Enter')))));
    return overlay(plate, 900);
  }
  const doorEvent = (state, events = []) => events.find(e => e.type === 'door') ?? { type: 'door', place: 'crib', day: state.day, hour: state.hour, who: { id: state.door.id, name: state.door.name, role: state.door.role } };
  /** A regular at the door this morning (the view's `door`): seen, he shakes and asks the player on his porch. */
  async function doorAt(state, event) {
    await playOn(lineOf({ ...hourOf(state), place: 'park', staged: actedOf([event ?? doorEvent(state)]), verb: 'move' }, state.door));
  }
  /**
   * Where a state puts the player at once (a run picked up, a state loaded by the tools): where it has them, everyone
   * the view says is there with them (Earl at his post, whoever waits at the door while a notice is up: peopleOn); a
   * regular at the door, the player out on his porch to him.
   */
  const placeLine = state => (state.place === 'crib' && state.door ? morningLine(state) : lineOf({ day: state.day, hour: state.hour, place: state.place, taken: state.place === 'jail' || state.place === 'clinic' ? 'market' : null }));
  /**
   * PICKED UP (RUN.md "Saving"): the run is where it was saved; then what it had left to show is shown: the morning's
   * report not yet put away, coming home after an attempt you were not there for (the look round, the floorboard, its
   * card), a regular asking at the door. The line saying it was picked up is the notice's (paintNotice).
   */
  async function pickUp() {
    paint();
    if (S.reportDue && !S.dead) {
      S.phase = 'report';
      paint();
      await showReport(S.reportDue);
      S.reportDue = null;
    }
    const st = S.state;
    if (st.place === 'crib' && S.after && !S.dead) {
      if (opts.scenes !== false) await homeMorning(st, { kind: 'after', event: S.after, at: S.after.how === 'guard' ? guardAt() : [] });
      else await afterCard(S.after);
    }
    if (st.place === 'crib' && st.door && !S.dead) await doorAt(st);
  }

  /** What you are doing, said while it plays out (how it went waits for the scene). */
  function doingOf(choice, v0) {
    if (choice.do === 'job') {
      const o = v0.options.find(x => x.choice.id === choice.id);
      const who = choice.who ? o?.targets?.find(t => t.id === choice.who)?.name : null;
      return `${who ? `${cfg.jobs[v0.place]?.[choice.id]?.label ?? o?.label}: ${who}` : o?.label ?? 'Working'}…`;
    }
    if (choice.do === 'subway') return `${choice.to === 'park' ? 'Heading home' : `To ${cfg.places.market.label}`}${choice.hop ? ', over the turnstile' : ''}…`;
    // (routes-1: on foot or on the board, toward the stop or on from it; a card of the stop's hand)
    if (choice.do === 'walk' || choice.do === 'skate') {
      const m = v0.moves.find(x => x.choice.do === choice.do && x.choice.to === choice.to);
      return `${choice.do === 'walk' ? 'Walking' : 'Skating'} ${choice.to === 'park' ? 'home' : `to ${cfg.places[choice.to]?.label ?? choice.to}`}${m?.via?.length ? `, by ${m.via[0].label.replace(/, outside .*$/, '')}` : ''}…`;
    }
    if (choice.do === 'onward') {
      const R = v0.route;
      return `${R?.way === 'board' ? 'Skating' : 'Walking'} on to ${R?.nextLabel ?? 'the next stop'}…`;
    }
    if (choice.do === 'card') {
      const c = (v0.hand ?? []).find(x => x.id === choice.id);
      return `${c?.label ?? 'Playing a card'}…`;
    }
    if (choice.do === 'rob') return 'Robbing somebody passing…';
    if (choice.do === 'bins') return 'Digging through the bins…';
    if (choice.do === 'shop') {
      const it = (v0.errands ?? []).find(x => x.here && x.item === choice.item);
      return `Buying ${it?.label.toLowerCase() ?? 'it'}${it?.keeper ? ` from ${cap(it.keeper.name)}` : ''}…`;
    }
    if (choice.do === 'pack') {
      const c = (v0.connects ?? []).find(x => x.good === choice.good);
      return `Buying ${cfg.goods[choice.good]?.pack ?? 'a pack'}${c ? ` from ${cap(c.who.name)}` : ''}…`;
    }
    if (choice.do === 'get') {
      const it = (v0.errands ?? []).find(x => x.here && x.item === choice.item);
      return `Buying ${it?.label ?? 'it'}${it?.keeper ? ` from ${cap(it.keeper.name)}` : ''}…`;
    }
    if (choice.do === 'rough') return `Lying down for the night ${cfg.places[v0.place]?.where ?? 'here'}…`;
    if (choice.do === 'give') return `Paying ${v0.door?.name ?? 'them'} at the door…`;
    if (choice.do === 'refuse') return `Shutting the door on ${v0.door?.name ?? 'them'}…`;
    if (choice.do === 'guard') {
      const g = v0.home?.defences?.guard;
      return g?.on ? `Keeping ${g?.who?.name ?? 'him'} on ${g.days} more days…` : `Hiring ${g?.who?.name ?? 'him'} for your step…`;
    }
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
    const BAD = new Set(['jumped', 'stopped', 'jail', 'clinic', 'robbed', 'fight', 'grudge', 'alarm', 'casing']);
    // (trust-1: a witness is its roll, below, and the morning's drift and every trust change are plates of their own)
    // (routes-1: the way's own lines short: the stop says its hand on the bar, going on is said by the arrival)
    const arrived = events.some(e => e.type === 'arrive');
    const lines = events.filter(e => !['ride', 'released', 'done', 'witness', 'drift'].includes(e.type) && (e.type !== 'morning' || e.night === 'street') && !(e.type === 'onward' && arrived) && e.text).map(e => ({
      text: wayLine(e) ?? e.text,
      bad: BAD.has(e.type) && !(e.type === 'fight' && !e.energyLost) && !(e.type === 'robbed' && !e.taken) || e.outcome === 'fail' || (e.type === 'hop' && e.caught) || (e.type === 'raid' && e.taken > 0),
      good: e.outcome === 'win' || (e.type === 'raid' && !e.taken) || e.type === 'calledOff', pay: (e.type === 'job' || e.type === 'rob' || e.type === 'card') && e.outcome === 'win' ? e.pay : e.type === 'bins' && e.pay ? e.pay : null,
      // (trust-1: said again by a plate and the dice when there is trust news: a job that moved its person's trust, a
      // door shut; then the row gives its room to the plates, the line's words stay in the tooltip)
      covered: (e.type === 'job' && !!e.trust) || e.type === 'refused' || PLATED.has(e.type) || ((e.type === 'jumped' || e.type === 'robbed') && hasGoods(e.goodsTaken)) || (e.type === 'stopped' && hasGoods(e.goodsSeized)),
      // (when the one row is short, the line that matters least gives way whole: home and banked is kept; a job's own
      // line goes before its dice and its pay, which say it; the fare goes first)
      // (home-1: an attempt on your crib and the notice of one come first)
      rank: e.type === 'raid' || e.type === 'alarm' ? 9 : WORKS.has(e.type) ? 4 : e.type === 'bank' || e.type === 'inside' ? 8 : e.type === 'fare' || e.type === 'hop' ? 2 : e.type === 'stop' ? 3 : BAD.has(e.type) ? 7 : 6,
    }));
    const rolls = [];
    for (const e of events) {
      if (e.type === 'job' && e.roll !== null && e.roll !== undefined) rolls.push({ label: 'the job', chance: e.chance, roll: e.roll, hit: e.outcome === 'win', yes: 'it worked', no: 'it went wrong', own: true });
      if (e.type === 'rob' && e.roll !== null && e.roll !== undefined) rolls.push({ label: 'the robbery', chance: e.chance, roll: e.roll, hit: e.outcome === 'win', yes: 'it worked', no: 'they got away', own: true });
      if (e.type === 'card' && e.roll !== null && e.roll !== undefined) rolls.push({ label: cardName(e.card).toLowerCase(), chance: e.chance, roll: e.roll, hit: e.outcome === 'win', yes: 'it worked', no: 'it went wrong', own: true });
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
        // (short on the plate, so it is never cut: who told, in the tooltip; who kept quiet, by their first words, "A man",
        // as on the cards)
        const short = (e.watchers ?? []).map(w => cap(personShort(w.name))).join(' and ');
        rolls.push({ label: `told on: ${names}`, chance: e.chance, roll: e.roll, hit: e.called, yes: `Told on · heat +${e.heat}`, no: `${short} kept quiet`, risk: true, title: e.text, witness: true });
      }
      if (e.type === 'sore') rolls.push({ label: 'he swung', chance: e.chance, roll: e.roll, hit: false, yes: '', no: 'sore, no grudge', risk: true });
      // (home-1: the door with nobody home, at the chance the notice said)
      if (e.type === 'raid' && e.roll !== null && e.roll !== undefined && e.chance !== undefined) rolls.push({ label: 'your door', chance: e.chance, roll: e.roll, hit: e.gotIn, yes: e.taken ? `they got in: $${e.taken}` : 'they got in', no: 'it held', risk: true });
    }
    // WHAT IT DID TO SOMEONE'S TRUST: who, which way, why; and the morning's drift only where someone changed band
    const chips = [];
    // (goods-1: what it did with your goods comes first, the losses before the rest; then what it did to people)
    const goods = events.map(goodsChip).filter(Boolean).sort((a, b) => Number(b.tone === 'bad') - Number(a.tone === 'bad'));
    for (const e of events) {
      if (e.trust) chips.push(trustChip(e.trust));
      if (e.type === 'bins' && e.lookedAway && e.seen) chips.push({ tone: 'luck', text: `${cap(e.seen.name)} looked away: with you`, title: e.text });
      if (e.type === 'drift') for (const c of e.changes ?? []) if (c.band !== c.bandWas) chips.push(trustChip(c));
      // (a stop pinches every connect whose goods it took: the first is `trust`, above; the others here)
      for (const t of (e.trusts ?? []).slice(1)) chips.push(trustChip(t));
    }
    chips.unshift(...goods.map(c => ({ ...c, rank: 5 })));
    // the market noticed you and nothing came of it: that was a roll too, and the one that matters
    const v0 = view(cfg, before);
    const rolled = events.some(e => e.type === 'jumped' || e.type === 'stopped');
    // (routes-1: setting out from the market, and going on from the stop on foot, are hours there too)
    if (v0.danger.here && !rolled && (events.some(e => WORKS.has(e.type)) || events.some(e => (e.type === 'ride' && e.place !== before.place) || e.type === 'walk' || (e.type === 'onward' && e.hours)))) {
      rolls.push({ label: v0.placeLabel,chance: v0.danger.thisHour.jump.chance, roll: null, hit: false, yes: '', no: `nobody came for you (${v0.danger.thisHour.jump.chance}% that hour${v0.danger.thisHour.stop.chance ? `, police ${v0.danger.thisHour.stop.chance}%` : ''})`, risk: true, quiet: true });
    }
    if (!lines.length && !chips.length) lines.push({ text: events.map(e => e.text).filter(Boolean).join(' ') || 'Nothing happened.' });
    return { lines: lines.slice(0, 3), chips, rolls };
  }
  /**
   * THE WAY'S LINES, short (routes-1): at the stop, how many cards it dealt (the bar shows them); going on, where to;
   * a card played, by its short name, what it paid or that it went wrong. Null: the event's own line.
   */
  function wayLine(e) {
    if (e.type === 'stop') return `${cap(labelOf(e.stop))}: ${e.hand?.length ? `${e.hand.length} to play, or go on` : 'nothing for you here today'}.`;
    if (e.type === 'onward') return `You went on toward ${labelOf(e.next)}.`;
    if (e.type === 'card' && e.outcome === 'win') return `${cardName(e.card)}: +$${e.pay}${e.heat ? `, heat +${e.heat}` : ''}.`;
    if (e.type === 'card') return `${cardName(e.card)}: it went wrong${e.heat ? ` (heat +${e.heat})` : ''}${e.goods ? `, the ${e.goods.label} lost` : ''}.`;
    return null;
  }
  /** A place's or a stop's label, as the rules have it. */
  const labelOf = id => cfg.places[id]?.label ?? cfg.stops?.[id]?.label ?? id;
  /** A stop's card by its short name for the bar (its whole label in the tooltip): the rules' label when it has none. */
  const CARD_NAME = { errand: 'Crates for the barkeeper', lookout: 'Lookout at the alley', tipsy: 'Walk a drunk to the stairs', sell: 'Sell a smoke', dumpster: 'Dig the dumpster' };
  const cardName = id => CARD_NAME[id] ?? Object.values(cfg.stops ?? {}).map(st => st.cards?.[id]).find(Boolean)?.label ?? id;
  /** The events whose line a goods plate says again, shorter (the line stays in the row's tooltip). */
  const PLATED = new Set(['pack', 'thing', 'wear', 'unwear', 'shop']);
  /**
   * WHAT IT DID WITH YOUR GOODS AND THINGS, as a plate on the row (goods-1): a pack bought, a sale and what is left, the
   * goods a jump or a stop took, an errand, a thing bought, put on, taken off. Lost: bad. The rest: quiet.
   */
  function goodsChip(e) {
    const t = e.text;
    if (e.type === 'pack') return { tone: 'quiet', text: `${cap(packWord(e.good))} from ${cap(e.who?.name ?? '')} · ${e.carried} ${goodWord(e.good, e.carried)} on you${e.off ? ` · ${money(e.off)} off` : ''}`, title: t };
    if (e.type === 'job' && e.goods) {
      const g = e.goods;
      const title = `${t} ${g.left} on you, ${g.home} at home.`;
      return e.outcome === 'win' ? { tone: 'quiet', text: `1 ${goodWord(g.good, 1)} sold · ${g.left} left`, title } : { tone: 'bad', text: `1 ${goodWord(g.good, 1)} lost · ${g.left} left`, title };
    }
    // (a jump or a stop that took goods: the plate says it all, cash first, and its line goes to the tooltip)
    const list = (cash, g) => [cash ? money(cash) : null, ...Object.entries(g ?? {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${goodWord(k, n)}`)].filter(Boolean).join(', ');
    if ((e.type === 'jumped' || e.type === 'robbed') && hasGoods(e.goodsTaken)) return { tone: 'bad', text: `Taken: ${list(e.taken, e.goodsTaken)}`, title: `${t} Left on you: ${hasGoods(e.goodsLeft) ? goodsWords(e.goodsLeft) : 'no goods'}.` };
    if (e.type === 'stopped' && hasGoods(e.goodsSeized)) return { tone: 'bad', text: `Seized: ${list(e.seized, e.goodsSeized)} · heat ${e.heatAfter}`, title: t };
    if (e.type === 'shop') {
      const it = (cfg.places[e.place]?.shop ?? []).find(x => x.item === e.item);
      const gives = Object.entries(e.gives ?? {}).map(([k, n]) => `${k} +${n}`).join(', ');
      return { tone: 'quiet', text: `${cap(thingWord(it?.label ?? e.item).toLowerCase())}${e.keeper ? ` from ${cap(e.keeper.name)}` : ''}${gives ? ` · ${gives}` : ''}${e.left !== null && e.left !== undefined ? ` · ${e.left ? `${e.left} more` : 'none left'} today` : ''}`, title: t };
    }
    if (e.type === 'thing') return { tone: 'quiet', text: `${cap(thingWord(e.label))}${e.keeper ? ` from ${cap(e.keeper.name)}` : ''} · ${e.worn ? 'wearing it' : e.kind === 'home' ? 'in the trailer' : 'owned'}`, title: t };
    if (e.type === 'wear') return { tone: 'quiet', text: `Put on: ${thingWord(e.label)}${e.replaced ? ` · off: ${thingWord(thingOf(cfg, e.replaced)?.label)}` : ''}`, title: t };
    if (e.type === 'unwear') return { tone: 'quiet', text: `Took off: ${thingWord(e.label)}`, title: t };
    return null;
  }
  /**
   * A trust change as a plate on the row: the arrow and who, which way (the number, and the band when it changed), why.
   * Turned against you: bad. With you, or over it: luck. Any other step: quiet. All of it in its tooltip.
   */
  function trustChip(t) {
    const turned = t.band !== t.bandWas;
    // (the days they won't deal with you are in the tooltip, with why)
    const way = turned
      ? t.band === 'against' ? 'against you' : t.band === 'with' ? 'with you' : t.bandWas === 'against' ? 'will deal with you again' : 'no longer with you'
      : `trust ${signedT(t.to)}`;
    const tone = t.band === 'against' ? 'bad' : turned && (t.band === 'with' || t.bandWas === 'against') ? 'luck' : t.band === 'with' ? 'with' : 'quiet';
    // (which way first when someone changed band, then who, so a short plate still says both; else who and the number.
    // Short, so the plate is never cut: a nameless person by their first words, and why in the tooltip)
    const arrow = t.change > 0 ? '▲' : '▼';
    const who = cap(personShort(t.who.name));
    return { tone, text: turned ? `${arrow} ${cap(way)}: ${who}` : `${arrow} ${who} ${signedT(t.change)}, ${way}`, title: t.text };
  }

  // ── the panels ──────────────────────────────────────────────────────────────────────────────────────────────────
  function paint() {
    const v = S.hold?.v ?? S.v;
    // (a try-on lasts while the Library, the shop's list or the You panel it came from is open, and only between moves)
    if (S.tried && (!(S.sheet === 'library' || S.sheet === 'character' || S.list === 'shop') || S.phase !== 'choose' || S.hold || arrange.active)) takeOff(null, false);
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
    paintAlert(v);
    paintRail(v);
    paintDanger(v);
    paintBar(v);
    paintSheet(v);
    paintHomePrint(v);
    paintResult();
    paintTrying();
    fitFrame();
    // (ui-3: the frame's size, full, compact or hidden: faded, never removed, so the stage frames the picture as it was)
    const size = sizeNow();
    for (const z of SIZES) root.classList.toggle(`u-size-${z}`, z === size);
    el.back.hidden = size !== 'hidden';
    fitFrame();
  }
  /** What just happened is being said (on the bar's row, and by the heat that landed on the top line and the map). */
  const resultUp = () => !S.hold && !!S.result && (S.phase !== 'choose' || !S.resultGone);
  /** THE NOTICE FROM ELSEWHERE (el.notice): what was called in where, and what to do about it; × puts it away. */
  function paintNotice() {
    // (the notice of home-1 has the picture's top while it is up: this slip waits under it, then shows again)
    if (alertOf(S.hold?.v ?? S.v)) {
      el.notice.hidden = true;
      return;
    }
    // (save-1: NEW RUN's second ask has the slip's place while it is up)
    if (S.newAsk) {
      el.notice.hidden = true;
      return;
    }
    // (save-1: the one line on picking up a saved run, or on a save that could not be continued: first, until the next
    // move or ×)
    if (S.pageNote) {
      const p = S.pageNote;
      el.notice.hidden = false;
      el.notice.classList.remove('is-way-in');
      el.notice.classList.toggle('is-refused', !!p.refused);
      el.notice.classList.add('is-saved');
      fill(el.notice,
        h('b', { class: 'rn-notice-h' }, p.head),
        h('span', { class: 'rn-notice-text', title: p.text }, p.text),
        h('button', { type: 'button', class: 'k-btn rn-notice-x', 'aria-label': 'Put it away', title: 'Put it away', onclick: () => { S.pageNote = null; paint(); } }, '×'));
      return;
    }
    el.notice.classList.remove('is-saved', 'is-refused');
    const n = S.notice && (S.notice.day === S.state.day || (S.notice.until ?? 0) >= S.state.day) ? S.notice : null;
    el.notice.hidden = !n;
    if (!n) return fill(el.notice);
    // (the view's words, less their last sentence when it is the suggestion: that is the plate after them)
    const words = n.suggest?.place ? n.text.replace(/\s+[^.:]*\bwork [^.]*\.$/i, '') : n.text;
    fill(el.notice,
      h('b', { class: 'rn-notice-h' }, n.head ?? (n.hot ? 'Police called' : 'Called in')),
      h('span', { class: 'rn-notice-text', title: n.text }, `${n.who ? `${cap(n.who)} called the police on ${cfg.places[n.place]?.label ?? n.place}. ` : ''}${words}`),
      n.suggest?.text ? h('span', { class: 'rn-suggest' }, cap(n.suggest.text)) : null,
      h('button', { type: 'button', class: 'k-btn rn-notice-x', 'aria-label': 'Put the notice away', title: 'Put it away', onclick: () => { S.notice = null; paint(); } }, '×'));
  }
  /**
   * THE FIRST STEPS (ui-3, leg 2), for someone who has never played: on the first day only, the loop one step at a
   * time on the goal card, in plain words with the keys that do it, each ticked off as it is done (S.first). Put away
   * with ×; a new run has them again.
   */
  const wayIn = () => S.wayIn && S.state.day === 1 && !S.opening;
  function firstSteps(v) {
    if (!wayIn()) return null;
    const F = S.first ?? {};
    const c = (v.connects ?? []).find(x => x.place === 'park');
    const cash = c ? Math.min(c.price + 2 * cfg.subway.fare, Math.max(c.price, cfg.start.cash)) : 0;
    const steps = [
      ['out', `Step out with ${money(cash)}: press 1, then Enter.`],
      ['pack', c ? `Buy a ${packWord(c.good)} from ${cap(c.who.name)}: B opens the shop, Enter buys.` : 'Buy something to sell: B opens the shop.'],
      ['sold', `Sell the ${c ? goodWord(c.good, 2) : 'goods'}: pick a selling job (1 to 3) and press Enter.`],
      ['home', 'Bring the cash home to bank it: H, then Enter. Banked, nobody can take it.'],
    ];
    const at = steps.findIndex(([k]) => !F[k]);
    if (at < 0) return null;
    return h('div', { class: 'u-first' }, h('span', { class: 'u-pill is-you' }, `First steps · ${at + 1} of ${steps.length}`), h('span', { class: 'u-first-t' }, steps[at][1]),
      h('button', { type: 'button', class: 'u-x', 'aria-label': 'Put the first steps away', title: 'Put the first steps away', onclick: () => { S.wayIn = false; paint(); } }, '×'));
  }
  // ── HOME PRESSURE ON THE PAGE (home-1, RUN.md "Home pressure"): the meter is the dock's (homeRow); its slip says what
  // holds it up, what brings it down and what it leads to; a warning stands on the top line (warnChip) while it lasts;
  // THE NOTICE (el.alert) is over the picture's top wherever you are while somebody is at your door, with every way
  // home pressable there, and says at once how an attempt you were not there for went, until you put it away or see
  // it at home. All of it the view's (`pressure`, `home`); every way pressed is one of the view's choices
  /** What the notice says now: somebody at your door (the view's), an attempt settled while you were out, or nothing. */
  // (WHILE A SCENE PLAYS, the notice of somebody at your door folds to its line on the top line, warnChip: over the
  // picture it sat on the scene at the door and still offered the ways home with him already there, 2026-11-16. It comes
  // back with the next choice while it is still open. How an attempt went stays up: it is read, not answered)
  const alertOf = v => (v?.home?.notice ? (S.phase === 'choose' && !S.hold ? { kind: 'door', n: v.home.notice } : null) : S.raidNote ? { kind: 'raid', r: S.raidNote } : null);
  const WHO_WHY = { grudge: 'He holds a grudge against you.', against: 'They are against you.', hooked: 'They want more from you than you give.', stranger: 'Nobody here knows them.' };
  /** (save-1: the line on picking up, on top of the notice while it has the picture's top: the slip waits under it) */
  const pickedEl = () => (S.pageNote ? h('p', { class: 'rn-alert-picked' }, S.pageNote.text) : null);
  function paintAlert(v) {
    // (ui-3: how an attempt went waits under the result card while that is up: the card says it, and it is in the journal)
    const a0 = alertOf(v);
    const a = a0?.kind === 'raid' && cardUp() ? null : a0;
    el.alert.hidden = !a;
    el.alert.className = `rn-alert${a?.kind === 'raid' ? (a.r.taken ? ' is-taken' : ' is-held') : ''}`;
    if (!a) return fill(el.alert);
    if (a.kind === 'door') {
      const n = a.n;
      const choosing = S.phase === 'choose' && !S.hold;
      const ways = n.ways.map(w => {
        const m = v.moves.find(x => x.key === w.key);
        const name = m ? moveWords(m)[0] : w.label;
        return h('button', { type: 'button', class: `k-btn rn-alert-way${w.inTime ? '' : ' is-late'}${S.sel === w.key ? ' is-on' : ''}`, disabled: !choosing || !w.available, 'data-key': w.key,
          title: `${w.label}${w.available ? '' : `: ${w.why}`}`, onclick: () => fromPanel(w.key, true) },
          kbd(keyFor(w.key) ?? '·'), h('b', null, name), h('span', null, `${w.hours}h${w.fare ? ` · ${money(w.fare)}` : ''}`), h('em', null, !w.available ? shortWhy(w) : w.inTime ? 'in time' : 'too late'));
      });
      fill(el.alert, pickedEl(),
        h('div', { class: 'rn-alert-head' }, h('b', null, `${cap(n.who.name)} is at your door`), h('span', { class: 'rn-alert-clock' }, `${n.hoursLeft} hour${n.hoursLeft === 1 ? '' : 's'} left · till ${String(n.until % 24).padStart(2, '0')}:00`)),
        h('p', { class: 'rn-alert-text' }, `Home in time and you meet them at the door. At stake: ${money(n.stake.takes)} of the ${money(n.stake.banked)} banked.`),
        h('div', { class: 'rn-alert-ways' }, ways.length ? ways : h('span', { class: 'rn-alert-none' }, 'No way home from here gets you there in time.')),
        h('p', { class: 'rn-alert-stay' }, h('b', null, 'If you stay: '), n.ifYouStay.text));
      return;
    }
    const r = a.r;
    const head = r.how === 'guard' ? `${cap(r.guard?.who?.name ?? 'Your guard')} saw them off` : r.taken ? `They got in: ${money(r.taken)} gone` : r.gotIn ? 'They got in, and found nothing banked' : 'Your door held';
    fill(el.alert, pickedEl(),
      h('div', { class: 'rn-alert-head' }, h('b', null, head), h('span', { class: 'rn-alert-clock' }, `${cap(r.who.name)} · ${String((r.hour ?? 0) % 24).padStart(2, '0')}:00`),
        h('button', { type: 'button', class: 'k-btn rn-notice-x', 'aria-label': 'Put the notice away', title: 'Put it away (you will see it when you get home)', onclick: () => { S.raidNote = null; paint(); } }, '×')),
      h('p', { class: 'rn-alert-text' }, r.text),
      r.guard?.beaten ? h('p', { class: 'rn-alert-stay' }, `${cap(r.guard.who.name)} is hurt: off ${r.guard.hurtDays} days.`) : null);
  }
  /** THE METER on the dock: home pressure 0 to 10, the warning's line marked; a click (or L) opens its slip. */
  function homeRow(v, rail = false) {
    const P = v.pressure;
    if (!P) return null;
    const pipsEl = h('span', { class: 'hk-pips rn-pips rn-press-pips', 'aria-label': `${P.value} of ${P.max}` }, Array.from({ length: P.max }, (_, k) => h('i', { class: `${k < P.value ? 'is-on' : ''}${k === P.warnAt - 1 ? ' is-line' : ''}` })));
    const due = v.home?.notice ? 'now' : v.home?.warning ? (v.home.warning.today ? 'today' : 'tomorrow') : null;
    return h('div', { class: `hk-heat rn-press is-${P.level}${S.homeOpen ? ' is-open' : ''}${due ? ' is-due' : ''}`, role: 'button', tabindex: '0', title: `${P.text} (K: what holds it up)`, onclick: () => toggleHome() },
      h('span', null, 'Home'), pipsEl, h('em', { class: P.level === 'high' ? 'is-bad' : '' }, rail ? (due ? `${P.value} · ${due === 'tomorrow' ? 'tmrw' : due}` : `${P.value}/${P.max}`) : due ? `${P.value} · ${due}` : `${P.value}/${P.max}`));
  }
  function toggleHome(on = !S.homeOpen) {
    if (!(S.hold?.v ?? S.v)?.pressure) return;
    S.homeOpen = on;
    if (on && S.sheet) openSheet(null);
    paint();
  }
  /** THE WARNING, small and steady on the top line while it stands: who, and when they will try it. */
  function warnChip(v) {
    const w = v.home?.warning;
    const n = v.home?.notice;
    if (!w && !n) return null;
    const who = cap(personShort((n ?? w).who.name));
    const text = n ? (S.phase === 'choose' && !S.hold ? `${who} is at your door: ${n.hoursLeft}h left` : `${who} is at your door`) : w.today ? `${who} will try your crib today while you are out` : `${who} will try your crib tomorrow`;
    // (save-1: its short words, when the top line is full: fitTop)
    const short = n ? (S.phase === 'choose' && !S.hold ? `At your door: ${n.hoursLeft}h left` : 'At your door') : w.today ? 'They try your crib today' : 'They try your crib tomorrow';
    return h('button', { type: 'button', class: `rn-warn${n || w.today ? ' is-now' : ''}`, title: `${(n ?? w).text} (K: home pressure)`, onclick: () => toggleHome(true) }, h('i', { 'aria-hidden': 'true' }), h('span', { 'data-short': short }, text));
  }
  /** THE METER'S SLIP: what holds it up (the view's reasons), what brings it down, what it leads to; the defences and how an attempt would go now. */
  function paintHomePrint(v) {
    const P = v.pressure;
    const H = v.home;
    el.homePrint.hidden = !(S.homeOpen && P);
    if (el.homePrint.hidden) return fill(el.homePrint);
    const row = (n, text) => h('li', null, h('b', { class: n > 0 ? 'is-up' : 'is-down' }, signedT(n)), ' ', text.replace(/\s*\([+−-]\d+\)$/, ''));
    const o = H?.odds;
    const d = H?.defences;
    const thing = t => h('li', null, h('b', { class: t.owned ? 'is-down' : '' }, t.owned ? 'yours' : money(t.price)), ` ${cap(thingWord(t.label))}: ${t.does.toLowerCase()}${t.owned ? '' : ` (${cap(t.keeper?.name ?? '')}, ${t.atLabel})`}.`);
    const g = d?.guard;
    fill(el.homePrint,
      h('div', { class: 'rn-print-head' }, h('b', null, `Home pressure ${P.value} of ${P.max}${P.level === 'high' ? ' · high' : P.level === 'calm' ? ' · calm' : ''}`), kbd('K'), h('button', { type: 'button', class: 'k-btn rn-print-x', 'aria-label': 'Fold it', onclick: () => toggleHome(false) }, '×')),
      H?.warning ? h('p', { class: 'rn-hp-warn' }, H.warning.text) : null,
      h('p', { class: 'rn-hp-h' }, 'What holds it up'),
      P.reasons.length ? h('ul', { class: 'rn-hp-list' }, P.reasons.filter(r => r.n).map(r => row(r.n, r.text))) : h('p', { class: 'rn-note' }, `Nothing you have done ${cfg.places[P.place]?.where ?? 'there'} is held against you.`),
      h('p', { class: 'rn-hp-h' }, 'What brings it down'),
      h('ul', { class: 'rn-hp-list' }, P.eases.map(e => row(e.n, e.text))),
      h('p', { class: 'rn-hp-h' }, 'What it leads to'),
      h('p', null, P.leadsTo.text, P.leadsTo.chance ? h('b', { class: 'rn-hp-chance' }, ` ${P.leadsTo.chance}%`) : null),
      o ? h('p', { class: 'rn-hp-h' }, `If they try it now (${money(o.stake.takes)} of ${money(o.stake.banked)} banked)`) : null,
      o ? h('ul', { class: 'rn-hp-list' },
        h('li', null, h('b', null, 'out'), ` ${o.away.guard ? `${100 - o.away.guard.beatenPct}% ${cap(g?.who?.name ?? 'your guard')} sees them off; else ` : ''}${o.away.pct}% they get in and take ${money(o.away.takes)}${d.pctBy || d.shareBy ? ` (${[d.pctBy ? 'the deadbolt' : null, d.shareBy ? 'the floor safe' : null].filter(Boolean).join(' and ')} counted)` : ''}.`),
        h('li', null, h('b', null, 'home'), ` you meet them at the door: ${o.door.bands.clean}% they lay into you and get in (${money(o.door.takes)}), ${o.door.bands.messy}% a scuffle (${money(o.door.scuffle)}), else you see them off.`)) : null,
      d ? h('p', { class: 'rn-hp-h' }, 'What defends it') : null,
      d ? h('ul', { class: 'rn-hp-list' }, ...d.things.map(thing),
        g ? h('li', { class: 'rn-hp-guard' }, h('b', { class: g.on ? 'is-down' : '' }, g.on ? `${g.daysLeft}d left` : money(g.price)), ` ${cap(g.who.name)} on your step: whoever tries your door has to get past him (${g.beatenPct}% they beat him). ${g.on ? `He is there through day ${g.until}${g.lastDay ? ': his last day. Keep him three more days at the crib' : ''}.` : g.why ?? `Hire him at the crib: ${money(g.price)} for ${g.days} days, paid up front.`}`) : null) : null);
  }

  /** A pick by the player puts what just happened away (the bar keeps its height: the row says something else). */
  const picked = () => {
    if (S.result) S.resultGone = true;
    // (ui-3: and the result card goes with it: it stays in the journal)
    if (S.card) S.cardGone = true;
  };
  // THE FRAME'S MEASURES, for the CSS: the move card's height (an open panel stops above it, so the card it chooses
  // on is never under it) and the dock's (at phone width the card stops short of it). Again whenever either changes
  // size: the kit's own face arriving late made a first measure short
  function fitFrame() {
    root.style.setProperty('--rn-card-h', `${Math.ceil(el.card.offsetHeight)}px`);
    root.style.setProperty('--rn-dock-h', `${Math.ceil(dock.offsetHeight)}px`);
    // (ui-3: where the corner cards end, for what lies under them: the rail, a panel, the slips; ui.css)
    root.style.setProperty('--u-where-b', `${Math.ceil(el.where.getBoundingClientRect().bottom)}px`);
    // (at phone width the first steps' card is part of your numbers' block: what lies under them goes below it)
    root.style.setProperty('--u-side-b', `${Math.ceil((el.side.querySelector('.u-first-card') ?? el.side.querySelector('.u-stats'))?.getBoundingClientRect().bottom ?? 0)}px`);
    // (and the result card's foot, while it is up: a slip under the where card goes below it)
    root.style.setProperty('--u-res-b', `${el.res.hidden ? 0 : Math.ceil(el.res.getBoundingClientRect().bottom)}px`);
    root.style.setProperty('--u-keys-w', `${Math.ceil(dock.querySelector('.rn-keys')?.getBoundingClientRect().width ?? 120)}px`);
  }
  if (typeof ResizeObserver !== 'undefined') {
    // (measured again on the next frame, not inside the observer's own delivery: a measure that moves what is watched
    // would be a loop the browser reports as an error. ui-3 leg 2: at phone width the rail, the where card and the
    // numbers measure each other)
    let due = false;
    const ro = new ResizeObserver(() => {
      if (due) return;
      due = true;
      requestAnimationFrame(() => {
        due = false;
        if (S.dead) return;
        fitFrame();
        fitRow();
      });
    });
    ro.observe(el.card);
    ro.observe(dock);
    ro.observe(el.where);
  }
  addEventListener('resize', () => !S.dead && paint());

  // ── THE DOCK IS THE RAIL (ui-3); D FOLDS YOUR SITUATION to one line, kept in this browser ───────────────────────
  function toggleDock(fold = !isFolded('side')) {
    kept.set('side', fold ? 'fold' : 'open');
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
    if (was === 'library') S.libTop = sheetBits.scroll.scrollTop;
    S.sheet = id && id !== was ? id : null;
    // (one slip or panel at a time beside the dock: the home pressure slip folds for a panel)
    if (S.sheet) S.homeOpen = false;
    if (was === 'character' && S.sheet !== 'character') face.big.player?.stop();
    if (was === 'map' && S.sheet !== 'map') runMap.close();
    if (S.sheet === 'character') showFace(true);
    paint();
    if (S.sheet && S.sheet !== was && S.sheet !== 'library') sheetBits.scroll.scrollTop = 0;
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
    const at = v.place === 'crib' ? stage.map?.PADS?.[YOU]?.door : stage.map?.PLACES?.[BLOCK_OF[v.place] ?? cfg.stops?.[v.place]?.block]?.at;
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
      const list = ['park', 'market', 'corner'].filter(id => P[BLOCK_OF[id]]?.at).map(id => {
        // (each place's heat and police, the view's: map.js draws them on the stop's flag)
        const pl = (c.v.places ?? []).find(q => q.place === id);
        return {
          id, name: STOP_NAME[id], flag: stopFlag(c, id), x: P[BLOCK_OF[id]].at[0], z: P[BLOCK_OF[id]].at[1], here: id === at, locked: id === 'corner',
          heat: pl ? pl.heat : null, hot: !!pl?.hot, police: !!pl?.police,
          // (trust-1: the heat that just landed there, while what just happened is said)
          rose: pl && resultUp() ? S.rose?.[id] ?? 0 : 0,
        };
      });
      // (join-1: THE TRY-OUT STOP at the dead mall, marked so; its card takes the trip, wherever Travel is offered)
      list.push({ id: 'tryout', name: 'The dead mall', flag: 'TRY-OUT · nothing counts', x: TRYOUT.at[0], z: TRYOUT.at[1], here: false, locked: false, heat: null, hot: false, police: false, rose: 0, mark: 'tryout', side: true, right: true });
      return list;
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
    card: id => (id === 'tryout' ? tryoutCard() : { name: STOP_NAME[id], body: stopBody(mapCtx(), id) }),
  });
  /** THE TRY-OUT STOP'S CARD ON THE MAP (join-1): what it is, that nothing counts, and the way there or why not now. */
  function tryoutCard() {
    const why = tryoutWhy({ dock: dockOf({ cfg, v: S.v }), phase: S.phase, hold: !!S.hold });
    if (!why) trip.prepare();
    return {
      name: 'The dead mall · try-out',
      body: [
        h('span', { class: 'u-pill u-trying' }, TRYOUT.mark),
        h('p', null, h('b', null, 'The fight'), `: pick a loadout and fight on the back lot. ${TRYOUT.says[0].toUpperCase()}${TRYOUT.says.slice(1)}: whatever you win or lose there stays there.`),
        h('p', { class: 'is-safe' }, h('b', null, 'Free'), ': no fare, no hour, no energy, no heat. Back puts you where you are now.'),
        why ? h('p', null, h('b', null, 'Not now'), `: ${why}.`)
          : h('button', { type: 'button', class: 'u-btn is-go rn-tryout-go', 'data-key': TRYOUT.key, title: `${tryoutGo()} (or T, then the last line of Travel's list)`, onclick: () => goTryout() }, 'Go: try it out', h('kbd', { class: 'u-key' }, 'Enter')),
      ],
    };
  }
  // THE SIDE TRIP ITSELF (trip.js): under the stage's black, the run's frame away and its keys aside, the fight on the
  // same stage, and back to exactly where you were. Nothing of the run's state or its save is touched
  const trip = createTrip({
    stage, demo: window.__demo, host: root.closest('#hud') ?? document.getElementById('hud') ?? root.parentElement,
    run: { you: YOU, away, replace: () => backFromTrip(), seed: () => S.state.seed, where: () => String(S.v?.placeLabel ?? 'the run').toLowerCase() },
  });
  /** Takes the try-out stop: only while choosing, wherever Travel is offered. */
  async function goTryout() {
    if (S.dead || S.away || trip.busy) return false;
    const why = tryoutWhy({ dock: dockOf({ cfg, v: S.v }), phase: S.phase, hold: !!S.hold });
    if (why) {
      toast(cap(why));
      return false;
    }
    return trip.go();
  }
  /** The run's frame put away for the trip (`on`) or back as it was: the panel that was open opens again. */
  function away(on) {
    if (on) {
      S.away = { sheet: S.sheet ?? null };
      // (the open panel shuts: the map's own keys and canvases with it. It opens again on the way back)
      if (S.sheet) openSheet(null);
      root.style.display = 'none';
      // (the stage makes no room for the run's dock while it is away: stage/index.js fitToPanels reads this)
      el.card.dataset.fit = 'away';
      return;
    }
    const w = S.away;
    S.away = null;
    root.style.display = '';
    if (w?.sheet) openSheet(w.sheet);
    else paint();
  }
  /** Back from the trip, under its black: everyone where the run's state has them, at once (as a run picked up). */
  async function backFromTrip() {
    dressYou();
    await playOn(placeLine(S.state), { instant: true });
  }
  const sheetBits = (() => {
    const title = h('h2', { class: 'rn-sheet-title' });
    const key = h('kbd');
    const x = h('button', { type: 'button', class: 'k-btn rn-sheet-x', 'aria-label': 'Close (Esc)', title: 'Close (Esc)', onclick: () => openSheet(null) }, '×');
    const lead = h('div', { class: 'rn-sheet-lead' });
    const scroll = h('div', { class: 'rn-sheet-scroll' });
    const foot = h('div', { class: 'rn-sheet-foot' }, h('span', null, '1–3 and the dock\'s letters still pick there'), h('span', null, 'Esc closes'));
    // (a panel's own things in its head, after its title: the Library's kinds and count, leg 3)
    const slot = h('div', { class: 'rn-sheet-slot' });
    el.sheet.append(h('div', { class: 'rn-sheet-head' }, title, slot, key, x), lead, scroll, foot);
    return { title, slot, key, x, lead, scroll, foot };
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
  // THE LIBRARY (ui-3, leg 3; library.js): everything there is, on L or the rail. Its parts stay while it is open and are
  // redrawn only when what they show changes; buying and putting on are the rules' own choices (fromPanel), trying on
  // is the stage's alone (tryOnKey)
  const library = createLibrary({
    cfg, tiles, kept, root: () => sheetBits.scroll,
    now: () => ({ v: S.hold?.v ?? S.v, choosing: S.phase === 'choose' && !S.hold, tried: S.tried, compact: compact() }),
    act: { buy: key => fromPanel(key, true), wear: key => fromPanel(key, true), tryOn: key => tryOnKey(key), takeOff: key => takeOff(key), toast: text => toast(text) },
  });
  // ── TRYING ON (ui-3, leg 3; the owner: "People should be able to try it on tho without buying it"): any piece to
  // wear, owned or not, shown on the figure where it stands (src/run/library.mjs tryOn → stage.tryOn); nothing of the
  // run changes. Pieces of different slots go on together; another of the same slot takes the place of the first. It
  // comes off (stage.tryOff) with Esc or the slip's button, before anything is done for real (send), and when the
  // Library, the shop's list or the You panel is closed (paint). No camera move: the player stays where the picture has them
  function tryOnKey(key) {
    if (S.phase !== 'choose' || S.hold) return toast('Try it on when this hour is over');
    const t = thingOf(cfg, key);
    if (t?.kind !== 'wear') return toast('Only things to wear can be tried on');
    const tried = { ...(S.tried ?? {}), [t.slot]: key };
    const r = tryOnOf(cfg, S.state, Object.values(tried));
    if (r.why) return toast(cap(r.why));
    // (from what you really wear each time: a piece of a slot tried before is replaced, not laid over)
    if (S.tried) stage.tryOff?.();
    if (!stage.tryOn?.(r.dress)) {
      S.tried = null;
      return toast('Trying on needs you in the picture: not here');
    }
    S.tried = tried;
    // (what just happened goes: the slip has the top of the picture)
    picked();
    paint();
  }
  /** Takes off what is tried (one piece, `key`; else all of it): what you really wear again. → whether anything was tried. */
  function takeOff(key = null, again = true) {
    if (!S.tried) return false;
    const rest = key ? Object.fromEntries(Object.entries(S.tried).filter(([, k]) => k !== key)) : {};
    stage.tryOff?.();
    S.tried = Object.keys(rest).length ? rest : null;
    if (S.tried) stage.tryOn?.(tryOnOf(cfg, S.state, Object.values(S.tried)).dress);
    if (again) paint();
    return true;
  }
  /** THE SLIP while trying on, over the top of the picture: what, whether it is yours, and Take it off (Esc). */
  function paintTrying() {
    const t = S.tried;
    el.trying.hidden = !t;
    // (with a panel open, the Library's or the You panel's, the slip is in it under its head: over the picture's top it
    // sat on the panel's head; from the shop's list, over the top of the picture between the corner cards)
    const inSheet = !!t && !el.sheet.hidden;
    el.trying.classList.toggle('is-in-sheet', inSheet);
    if (inSheet && el.trying.parentNode !== el.sheet) el.sheet.insertBefore(el.trying, sheetBits.lead);
    if (!inSheet && el.trying.parentNode !== root) root.insertBefore(el.trying, el.back);
    if (!t) return fill(el.trying);
    const keys = Object.values(t);
    const names = keys.map(k => pieceName(S.v.library?.pieces.find(x => x.key === k) ?? { name: thingOf(cfg, k)?.label ?? k }));
    const yours = keys.every(k => S.state.things?.[k]);
    fill(el.trying,
      h('span', { class: 'u-pill u-trying' }, icon('person'), 'Trying on'),
      h('b', { class: 'u-trying-what', title: names.join(', ') }, names.join(' + ')),
      h('span', { class: 'u-trying-not' }, yours ? 'yours, not put on: change at home' : `not yours: nothing is bought`),
      h('button', { type: 'button', class: 'u-btn is-quiet', title: 'Back to what you really wear (Esc)', onclick: () => takeOff() }, 'Take it off', ukey('Esc')));
  }

  function paintSheet(v) {
    const def = SHEETS.find(s => s.id === S.sheet);
    el.sheet.hidden = !def;
    root.classList.toggle('has-sheet', !!def);
    if (!def) return;
    el.sheet.dataset.sheet = def.id;
    if (def.id !== 'library') fill(sheetBits.slot);
    el.sheet.setAttribute('aria-label', def.title);
    sheetBits.title.textContent = def.title;
    sheetBits.key.textContent = def.key;
    const state = S.hold?.state ?? S.state;
    // (a panel can pick a move on the bar, `pick`, or buy from the place's shop at once, `go`: rules-2)
    const ctx = { cfg, v, state, dayStart: S.dayStart, choosing: S.phase === 'choose' && !S.hold, pick: key => fromPanel(key, false), go: key => fromPanel(key, true), keyFor };
    const top = sheetBits.scroll.scrollTop;
    if (def.id === 'character') {
      fill(charHead, face.big.box,
        h('div', { class: 'rn-char-id' }, h('h3', { class: 'rn-char-name' }, game.state.agents[YOU].name),
          h('p', null, `Day ${v.day} · ${v.clock} · ${S.taken ?? v.placeLabel}`),
          h('p', null, h('b', null, v.shop.filter(s => s.owned).length ? v.shop.filter(s => s.owned).map(s => shortName(s.label)).join(' · ') : 'a mattress on the floor')),
          face.honest ? null : h('p', { class: 'rn-note' }, 'The stage\'s own picture of you.')));
      fill(sheetBits.lead, charHead, charTabs.el);
      const tab = charTabs.selected;
      // (leg 3: the Wearing tab's wardrobe: tiles, Put on and Take off at home, Try on elsewhere, the Library)
      const ward = { tile: (piece, o = {}) => tiles.el(piece, { ...o, root: sheetBits.scroll }), tryOn: k => tryOnKey(k), takeOff: k => takeOff(k), tried: S.tried, library: () => openSheet('library') };
      fill(sheetBits.scroll, tab === 'people' ? characterPeople(ctx) : tab === 'wearing' ? characterWearing({ ...ctx, ...ward, wearing: face.wearing?.(v.place === 'jail') ?? null, honest: face.honest && dressKey() === '{}' }) : characterStats(ctx));
    } else if (def.id === 'library') {
      // (its parts stay while it is open: redrawn only when what they show has changed, library.js; no foot of its own)
      library.paint();
      if (sheetBits.slot.firstChild !== library.head) fill(sheetBits.slot, library.head);
      if (sheetBits.lead.firstChild !== library.lead) fill(sheetBits.lead, library.lead);
      if (sheetBits.scroll.firstChild !== library.grid) {
        fill(sheetBits.scroll, library.grid);
        sheetBits.scroll.scrollTop = S.libTop ?? 0;
      }
      if (library.card.parentNode !== el.sheet) el.sheet.insertBefore(library.card, sheetBits.foot);
      return;
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
      if (def.id === 'moves') sheetBits.scroll.append(arrange.movesEl());
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
      // (as the stage dresses the player now: what was bought and put on included, goods-1)
      const now = stage.actors?.has?.(YOU) ? stage.actors.get(YOU).look : staged;
      const look = now ? structuredClone(now) : null;
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
      // (dressed in something bought, goods-1, the kit's portrait, which rolls the look from the handle alone, is not
      // the figure: the stage's own still of it stands in, made again whenever what is worn changes)
      const dk = dressKey();
      if (!face.honest || dk !== '{}') {
        if (face.stillKey !== dk) {
          face.stillKey = dk;
          face.asked = null;
          face.big.player?.stop?.();
          for (const c of [face.small, face.big.canvas]) c.getContext('2d').clearRect(0, 0, c.width, c.height);
          face.still = await stage.portraitOf?.(YOU);
        }
        if (face.still) for (const c of [face.small, face.big.canvas]) c.style.backgroundImage = `url(${face.still})`;
        return;
      }
      if (face.stillKey) {
        face.stillKey = null;
        for (const c of [face.small, face.big.canvas]) c.style.backgroundImage = '';
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
    // (ui-3: the top line is an empty strip now, kept for the room it leaves; what it said is on the cards in the corners)
    fill(el.top);
    paintWhere(v);
    paintSide(v);
    // (NEW RUN's second ask says what it ends: a slip under the where-and-when card, until it is pressed again or six seconds)
    el.ask.hidden = !S.newAsk;
    fill(el.ask, S.newAsk ? [h('b', null, 'New run?'), ' ', replaceAsk(atOf(S.state, v))] : null);
  }
  // ── THE NEW FRAME'S PARTS (ui-3, leg 1; ui.css, skin.css) ──────────────────────────────────────────────────────────
  const ukey = k => h('kbd', { class: 'u-key' }, k);
  const upill = (tone, ic, text, extra = {}) => h('span', { class: `u-pill is-${tone}`, ...extra }, icon(ic), text);
  const chipEl = c => upill(c.tone, c.icon, c.text);
  const thingName = label => cap(String(label).replace(/^an? /i, ''));
  /**
   * WHERE AND WHEN, top left: home or out and the day, the place in the city's lettering, the hour, how safe it is
   * here in one pill; under them the map, the save's mark (one clock on screen: the save's own time is in its
   * tooltip) and a new run.
   */
  /** Where and when's pieces: the place's name, home or out, how safe it is here (a pill). */
  function whereBits(v) {
    const label = S.taken ?? S.where ?? v.placeLabel;
    const kind = S.taken ? 'Taken away' : v.place === 'crib' ? 'Home' : v.place === 'jail' ? 'Held' : v.place === 'clinic' ? 'Held' : S.state.route ? 'On the way' : 'Out';
    const here = (v.places ?? []).find(p => p.here);
    const safety = () => (v.place === 'jail' ? upill('loss', 'police', 'in jail till morning') : v.place === 'clinic' ? upill('loss', 'warn', 'in the clinic till morning')
      : here?.hot || v.heatHere >= cfg.police.from ? upill('heat', 'police', `hot: police about`, { title: here?.text ?? '' })
        : v.danger?.here ? upill('risk', 'warn', 'every hour can go wrong', { title: `At ${v.placeLabel} you can be jumped: the meter on the dock says how likely this hour.` })
          : upill('gain', 'check', v.place === 'crib' ? 'safe at home' : 'safe: nobody jumps you', { title: here?.text ?? '' }));
    return { label, kind, here, safety };
  }
  /** THE DOCK'S HEADER SLOT (WHERE_IN_DOCK): the place, the hour and, `pill`, how safe it is, on one line. */
  function dockWhere(v, pill = true) {
    if (!WHERE_IN_DOCK) return null;
    const { label, kind, here, safety } = whereBits(v);
    return h('span', { class: 'u-dock-where', title: `${kind} · day ${v.day}${here?.text ? `. ${here.text}` : ''}` }, h('b', { class: 'u-dock-place' }, label), h('span', { class: 'u-dock-hour' }, icon('clock'), v.clock), pill ? safety() : null);
  }
  function paintWhere(v) {
    // (the place on the dock's header: no card here)
    el.where.hidden = WHERE_IN_DOCK;
    if (WHERE_IN_DOCK) return;
    const { label, kind, here, safety: safe } = whereBits(v);
    const safety = safe();
    const saved = saving && S.saveAt !== null
      ? h('span', { class: `u-saved${S.saveAt ? '' : ' is-off'}`, title: S.saveAt ? `This run is saved in this browser as of day ${S.saveAt.day}, ${S.saveAt.clock}: a reload picks it up there. Seed ${S.state.seed}.` : 'This browser will not keep the run: a reload starts again. The game plays on.' }, S.saveAt ? 'saved' : 'not saving')
      : h('span', { class: 'u-saved', title: 'the run\'s dice' }, `seed ${S.state.seed}`);
    // (folded on its own, or the frame compact: one line, the place, the hour and how safe it is)
    // (leg 3: and while the Library is open, so its grid has the room: it opens again when the Library closes)
    const small = compact() || isFolded('where') || S.sheet === 'library';
    el.where.classList.toggle('is-compact', small);
    fill(el.where,
      compact() ? null : h('button', { type: 'button', class: 'u-x u-where-fold', title: small ? 'Open where and when' : 'Fold where and when to one line', 'aria-expanded': String(!small), onclick: () => toggleFold('where', small) }, icon(small ? 'unfold' : 'fold')),
      h('div', { class: 'u-cap' }, `${kind} · day ${v.day}`),
      h('b', { class: `u-where-name${String(label).length > 17 ? ' is-long' : ''}`, title: here?.text ?? label }, label),
      h('div', { class: 'u-where-when' }, icon('clock'), h('b', null, v.clock), safety),
      h('div', { class: 'u-where-foot' },
        h('button', { type: 'button', class: `u-btn is-quiet${S.sheet === 'map' ? ' is-on' : ''}`, title: 'The map (M)', 'aria-expanded': String(S.sheet === 'map'), onclick: () => openSheet('map') }, icon('map'), 'Map', ukey('M')),
        saved,
        h('button', { type: 'button', class: `u-btn is-quiet u-new${S.newAsk ? ' is-ask' : ''}`, title: S.newAsk ? replaceAsk(atOf(S.state, v)) : 'Start a new run (asks again first)', onclick: () => newRun0() }, S.newAsk ? 'Sure? Again' : 'New run')));
  }
  /**
   * YOUR SITUATION, top right, in one place: what you carry (pink while it can be taken), what is banked, energy, the
   * heat where you stand, home risk while it means something; the warning and Earl's word under them; THE GOAL; THE
   * JOURNAL. D folds the numbers to one line.
   */
  function paintSide(v) {
    // (at phone width your numbers are always their one line)
    const folded = compact() || isFolded('side') || innerWidth <= 720;
    const out = v.place !== 'crib';
    const onYou = v.atRisk?.goods ?? {};
    const home = Object.fromEntries((v.goods ?? []).filter(g => g.home).map(g => [g.good, g.home]));
    const here = (v.places ?? []).find(p => p.here);
    const heat = v.heatHere ?? v.heat;
    const hot = heat >= cfg.police.from;
    const atRisk = !!v.danger?.here && (v.carried > 0 || hasGoods(onYou));
    const P = v.pressure;
    const due = v.home?.notice ? 'now' : v.home?.warning ? (v.home.warning.today ? 'today' : 'tomorrow') : null;
    const showHome = !!P && (P.value > 0 || !!due);
    const upips = (n, max, cls = '', line = -1) => h('span', { class: `u-pips ${cls}`, 'aria-label': `${n} of ${max}` }, Array.from({ length: max }, (_, k) => h('i', { class: `${k < n ? 'is-on' : ''}${k === line ? ' is-line' : ''}` })));
    // (folded, each says itself shorter: Home, not Home risk. Heat is the heat where you stand: its tooltip says so)
    const SHORT_CAP = { 'Home risk': 'Home' };
    // (five numbers, with the home risk: the captions shorter and without their icons, so none is cut at 1280: leg 2)
    const short = folded || showHome;
    const stat = (cls, ic, capText, val, sub, extra = {}) => h('div', { class: `u-stat ${cls}`, ...extra }, h('span', { class: 'u-cap' }, showHome && !folded ? null : icon(ic), short ? SHORT_CAP[capText] ?? capText : capText), h('b', { class: 'u-stat-v' }, val), sub);
    const stats = h('div', { class: `u-stats u-panel${folded ? ' is-folded' : ''}` },
      stat(`is-carried${atRisk ? ' is-risk' : ''}`, 'cash', 'On you', money(v.carried),
        h('span', { class: 'u-stat-sub' }, [hasGoods(onYou) ? `+ ${goodsWords(onYou)}` : null, atRisk ? 'at risk here' : null].filter(Boolean).join(' · ') || (out ? 'nobody acts on you here' : 'step out to use it')),
        { title: atRisk ? `On you: ${money(v.carried)}${hasGoods(onYou) ? ` and ${goodsWords(onYou)}` : ''}. Here it can be taken: a jump takes it, a police stop takes it all.` : 'What you carry. Cash at home cannot be taken.' }),
      stat('is-banked', 'bank', 'Banked', money(v.banked), h('span', { class: 'u-stat-sub' }, hasGoods(home) ? `safe · + ${goodsWords(home)}` : 'safe at home'), { title: 'Banked at your crib: nobody on the street can take it. The three things are bought from it.' }),
      stat('is-energy', 'energy', 'Energy', [String(v.energy), h('small', null, `/${v.energyMax}`)],
        v.tired ? h('span', { class: 'u-stat-sub u-bad' }, 'tired: odds −15') : upips(v.energy, Math.max(v.energyMax, v.energy)),
        { title: `Every hour out costs ${cfg.energy.perHour} energy, the subway included. At 2 or less you are tired: your odds drop.` }),
      stat(`is-heat${hot ? ' is-hot' : ''}`, 'heat', 'Heat', [String(heat), h('small', null, `/${v.heatMax}`)],
        hot ? h('span', { class: 'u-stat-sub' }, here?.police ? 'police about' : `police from ${cfg.police.from}`) : upips(heat, v.heatMax, 'is-heat', cfg.police.from - 1),
        { title: here ? `${here.text} Heat here ${heat}: the higher of yours (${v.heatYours ?? v.heat}) and ${here.label}'s (${here.heat}). The police can stop you from heat ${cfg.police.from}.` : `Your heat ${v.heat}.` }),
      showHome ? stat(`is-press${S.homeOpen ? ' is-open' : ''}`, 'homerisk', 'Home risk', [String(P.value), h('small', null, `/${P.max}`)],
        due ? h('span', { class: 'u-stat-sub u-bad' }, due === 'now' ? 'at your door now' : `attempt ${due}`) : upips(P.value, P.max, 'is-press', P.warnAt - 1),
        { role: 'button', tabindex: '0', title: `${P.text} (K: what holds it up)`, onclick: () => toggleHome(), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHome(); } } }) : null,
      compact() ? null : h('button', { type: 'button', class: 'u-x u-fold', title: folded ? 'Open your numbers (N)' : 'Fold your numbers to one line (N)', 'aria-expanded': String(!folded), onclick: () => toggleDock() }, icon(folded ? 'unfold' : 'fold')));
    const news = [warnChip(v), earlChip(v)].filter(Boolean);
    // (the goal: open at home, its next thing only when you are out, unless you open or fold it yourself; compact, one line)
    const goalMini = compact() || isFolded('goal', out);
    const goal = goalCard(v, goalMini);
    // (the first steps wait while an hour plays: the scene has the picture; they are back for the next choice. At
    // phone width the goal card is not shown: there they are a card of their own under your numbers)
    const first = S.phase === 'choose' && !S.hold ? firstSteps(v) : null;
    const phone = innerWidth <= 720;
    if (first && !phone) goal.prepend(first);
    fill(el.side, stats, first && phone ? h('div', { class: 'u-panel u-first-card' }, first) : null, news.length ? h('div', { class: 'u-side-news' }, news) : null, goal, journalCard());
  }
  /** THE GOAL: the three things, which is next, how far banked (solid) and carried (striped) are from it, and where it is bought. */
  function goalCard(v, mini) {
    const things = v.shop ?? [];
    const next = things.filter(s => !s.owned).sort((a, b) => a.price - b.price)[0];
    const owned = things.filter(s => s.owned).length;
    const have = v.banked + v.carried;
    const head = h('div', { class: 'u-goal-head' }, icon('star'), h('span', { class: 'u-cap' }, 'Goal · own all three'), h('span', { class: `u-pill ${next ? 'is-you' : 'is-gain'}` }, `${owned} of ${things.length}`));
    const three = h('div', { class: 'u-goal-three' }, things.map(s => h('div', { class: `u-goal-thing${s.owned ? ' is-owned' : s === next ? ' is-next' : ''}`, title: `${thingName(s.label)}: ${s.does}` },
      h('b', null, thingName(s.label)), h('span', null, s.owned ? 'yours' : money(s.price)))));
    const toggle = compact() ? null : h('button', { type: 'button', class: 'u-x', title: mini ? 'Open the goal' : 'Fold the goal to its next thing', 'aria-expanded': String(!mini), onclick: () => toggleFold('goal', mini) }, icon(mini ? 'unfold' : 'fold'));
    head.append(...[toggle].filter(Boolean));
    if (!next) return h('div', { class: `u-goal u-panel${mini ? ' is-mini' : ''}` }, mini ? h('div', { class: 'u-goal-mini' }, icon('star'), h('b', null, v.done ? `All three owned: ${v.done.text}` : 'All three owned'), toggle) : [head, three, h('div', { class: 'u-goal-where' }, v.done ? `All three owned: ${v.done.text}. Play goes on as long as you like.` : 'All three owned.')]);
    const b = Math.min(100, (v.banked / next.price) * 100);
    const c = Math.max(0, Math.min(100 - b, (v.carried / next.price) * 100));
    const bar = () => h('div', { class: 'u-goal-bar', title: `Banked ${money(v.banked)} (solid) and carried ${money(v.carried)} (striped), of ${money(next.price)}` }, h('i', { class: 'is-banked', style: `width:${b}%` }), h('i', { class: 'is-carried', style: `width:${c}%` }));
    if (mini) {
      return h('div', { class: 'u-goal u-panel is-mini', title: `Goal: own all three (${owned} of ${things.length}). Next: ${thingName(next.label)}, ${money(next.price)}, bought at home from banked money.` },
        h('div', { class: 'u-goal-mini' }, icon('star'), h('b', null, `Next: ${thingName(next.label)}`), bar(), h('span', null, `${money(Math.min(have, next.price))}/${money(next.price)}`), toggle));
    }
    const where = v.banked >= next.price ? (v.place === 'crib' ? 'Banked enough: buy it now: 2, or B, the shop at home.' : 'Banked enough: buy it at home.')
      : have >= next.price ? 'Enough with what you carry: bank it at home first.' : `Bought at home from banked money: ${money(next.price - have)} to go.`;
    return h('div', { class: 'u-goal u-panel' }, head, three,
      h('div', { class: 'u-goal-next' }, h('span', null, `Next: ${thingName(next.label)}`), h('span', null, `${money(Math.min(have, next.price))} of ${money(next.price)}`)),
      bar(),
      h('div', { class: 'u-goal-where' }, where));
  }
  /** THE JOURNAL: today's cards, short, newest first. J folds it to its latest line. Kept in this page only. */
  function journalCard() {
    // (folded to its latest line until opened: the coordinator, leg 2; J or its button opens it, and that is kept)
    const folded = compact() || isFolded('journal');
    // (the step playing now is not in it yet: how it went waits for its scene, as everywhere)
    const today = S.journal.filter(j => j.day === (S.hold?.state ?? S.state).day && !(S.hold && j.step === S.steps)).slice().reverse();
    const list = today.length ? h('ol', null, today.map((j, i) => h('li', { class: `u-je is-${j.tone}${i === 0 && cardUp() ? ' is-new' : ''}` },
      h('span', { class: 'u-je-at' }, j.at), icon(j.icon ?? 'clock') ?? h('span'),
      h('div', null, h('div', { class: 'u-je-head', title: j.head }, j.head), j.chips?.length ? h('div', { class: 'u-je-chips' }, j.chips.map(chipEl)) : null))))
      : h('p', { class: 'u-journal-empty' }, 'Nothing yet today. What happens shows here.');
    return h('div', { class: `u-journal u-panel${folded ? ' is-folded' : ''}` },
      h('div', { class: 'u-journal-head' }, icon('journal'), h('span', { class: 'u-cap' }, `Today · day ${S.state.day}`),
        compact() ? null : h('button', { type: 'button', class: 'u-x', title: folded ? 'Open the journal (J)' : 'Fold the journal to its last line (J)', 'aria-expanded': String(!folded), onclick: () => toggleJournal() }, folded ? 'Open' : 'Fold', ukey('J'))),
      list);
  }
  function toggleJournal() {
    kept.set('journal', isFolded('journal') ? 'open' : 'fold');
    paint();
  }
  /**
   * THE FRAME'S THREE SIZES (ui-3, the owner: "I just fear a lot of the game is hidden"): FULL; COMPACT, every block to
   * its essentials (where and when one line, your numbers a slim strip, the goal its next thing, the journal its last
   * line); HIDDEN, the city alone with a small way back. I steps through them; kept in this browser (the page works
   * without it). While a scene plays the frame is compact by itself, and comes back when the result card lands. The
   * result card is never hidden.
   */
  const SIZES = ['full', 'compact', 'hidden'];
  const sizeChosen = () => S.size ?? (SIZES.includes(kept.get('size')) ? kept.get('size') : 'full');
  function cycleSize() {
    S.size = SIZES[(SIZES.indexOf(sizeChosen()) + 1) % SIZES.length];
    kept.set('size', S.size);
    toast(S.size === 'full' ? 'Interface: full (I)' : S.size === 'compact' ? 'Interface: compact (I)' : 'Interface hidden: I brings it back');
    paint();
  }
  const sizeNow = () => (sizeChosen() === 'hidden' ? 'hidden' : S.phase === 'playing' || S.hold || S.opening ? 'compact' : sizeChosen());
  const compact = () => sizeNow() !== 'full';
  /** A block's own fold (the where card, the goal), kept in this browser: 'fold', 'open' or not chosen. */
  const foldOf = k => kept.get(k);
  /** Whether a block is one line now: the player's own choice, kept; else FOLDED's ('auto': `auto`). */
  function isFolded(k, auto = false) {
    const mine = foldOf(k);
    if (mine === 'fold' || mine === 'open') return mine === 'fold';
    return FOLDED[k] === 'auto' ? !!auto : !!FOLDED[k];
  }
  function toggleFold(k, folded) {
    kept.set(k, folded ? 'open' : 'fold');
    paint();
  }
  /** The result card is up: after a step, until the next pick or step, OK, Enter or Esc; never over a door's notice. */
  // (somebody at your door now is its own notice there, with every way home: the card waits under it)
  const cardUp = () => !!S.card && !S.cardGone && !S.hold && (S.phase === 'choose' || S.phase === 'held') && alertOf(S.hold?.v ?? S.v)?.kind !== 'door' && !arrange.active;
  const putAway = () => {
    S.cardGone = true;
    paint();
  };
  /**
   * WHAT JUST HAPPENED, AS A CARD (news.js), top middle: what it was and how likely, the headline in the city's
   * lettering, the hour in the rules' own words, every change as a chip, what to try next, OK. Held (the jail, the
   * clinic), its button is Continue.
   */
  function paintResult() {
    const c = S.card;
    const up = cardUp();
    el.res.hidden = !up;
    if (!up) return fill(el.res);
    const held = S.phase === 'held';
    el.res.className = `u-res u-panel is-${c.tone}${c.big ? ' is-big' : ''}`;
    const jail = S.state.place === 'jail' || (S.phase === 'held' && S.card.kicker === 'Arrested');
    fill(el.res,
      h('div', { class: 'u-res-kick' }, upill(c.tone === 'quiet' ? 'mute' : c.tone, c.icon, c.kicker), c.chance ? h('span', { class: 'u-cap' }, c.chance) : null,
        h('span', { class: 'u-cap u-at' }, `Day ${c.day} · ${hourWord(c.hour)}`)),
      h('h2', { class: 'u-res-head' }, c.head),
      c.body ? h('p', { class: 'u-res-body', title: c.body }, c.body) : null,
      c.chips.length ? h('div', { class: 'u-res-chips' }, c.chips.map(chipEl)) : null,
      h('div', { class: 'u-res-foot' },
        held ? h('span', { class: 'u-res-next' }, icon('warn'), jail ? 'Continue takes you to the jail.' : 'Continue takes you to the clinic.')
          : c.next ? h('span', { class: 'u-res-next' }, icon('star'), c.next) : h('span', { class: 'u-res-next u-cap' }, 'It stays in the journal'),
        held ? h('button', { type: 'button', class: 'u-btn is-go', onclick: () => S.onPress?.() }, 'Continue', ukey('Enter'))
          : h('button', { type: 'button', class: 'u-btn', title: 'Put it away (Enter or Esc): it stays in the journal', onclick: putAway }, 'OK', ukey('Enter'))));
  }
  /**
   * COUSIN EARL'S STRETCH ON THE TOP LINE (save-1): his last day (the same move at the crib keeps him three more days),
   * and the morning he has gone, said plainly, not as a loss.
   */
  function earlChip(v) {
    const g = v.home?.defences?.guard;
    const who = cap(String(g?.who?.name ?? S.earl?.who ?? 'Earl').replace(/^Cousin /, ''));
    if (g?.on && g.lastDay) return h('span', { class: 'rn-earl is-last', 'data-short': `${who}: last day`, title: `${g.text} At the crib: keep him ${g.days} more days for ${money(g.price)}.` }, `${who}'s last day: keep him at the crib`);
    if (!g?.on && S.earl?.day === S.state.day) return h('span', { class: 'rn-earl', 'data-short': `${who} has gone`, title: S.earl.text }, `${who} has gone: his days are up`);
    return null;
  }

  /** A NEW RUN from the page: a new seed, asked twice so a stray click loses nothing. */
  function newRun0() {
    if (!S.newAsk) {
      S.newAsk = true;
      paint();
      clearTimeout(S.newAskT);
      // (long enough to read what it ends)
      S.newAskT = setTimeout(() => {
        S.newAsk = false;
        if (!S.dead) paint();
      }, 6000);
      return;
    }
    const Q = new URLSearchParams(location.search);
    Q.set('mode', 'run');
    Q.set('seed', String(1 + Math.floor(Math.random() * 9999)));
    Q.delete('runtest');
    // (save-1: &new=1, the new run replaces the save; the run ended forgets its arrangement, and the new seed starts
    // from the trailer as it comes)
    Q.set('new', '1');
    arrange.forget(S.state.seed);
    arrange.forget(Q.get('seed'));
    location.search = Q.toString();
  }

  const pips = (n, max, cls = '') => h('span', { class: `hk-pips rn-pips ${cls}`, 'aria-label': `${n} of ${max}` }, Array.from({ length: max }, (_, k) => h('i', { class: k < n ? 'is-on' : '' })));
  const heatBoxes = heat => h('span', { class: 'hk-heat-pips', 'aria-label': `heat ${heat} of ${cfg.heat.max}` }, Array.from({ length: cfg.heat.max }, (_, i) => h('i', { class: `${i < heat ? 'is-on' : ''}${i === cfg.police.from - 1 ? ' is-line' : ''}` })));

  /** The panel keys: a row under the dock (a column on the rail). Each says its key; the open one is lit. */
  // (ui-3, leg 3, part E: the rail in the dock's style: each key an icon, its word and its letter on the corner)
  const sheetKeys = v => h('div', { class: 'rn-keys', role: 'toolbar', 'aria-label': 'Panels' }, SHEETS.map(s => h('button', {
    type: 'button', class: `rn-key u-rail-key${S.sheet === s.id ? ' is-on' : ''}`, 'data-sheet': s.id, 'aria-pressed': String(S.sheet === s.id),
    title: `${s.title} (${s.key})`, 'aria-label': s.label, onclick: () => openSheet(s.id),
  }, icon(s.icon), h('span', { class: 'is-long' }, s.label), h('span', { class: 'is-short' }, s.short), ukey(s.key))), arrangeKey(v));
  /**
   * ARRANGE, WITH THE PANEL KEYS (the owner, 2026-11-16: he did not know arranging was there; on the crib's row it was
   * the first move to fold away into "+N more"). Only while you are at the crib; greyed, with why in its tooltip, when
   * it cannot start now (somebody at your door, an hour playing). V as ever; again (or Esc) is done.
   */
  function arrangeKey(v) {
    if (v?.place !== 'crib') return null;
    const why = () => (arrange.active ? null : v.door ? `${cap(v.door.name)} is at your door: answer them first` : S.phase !== 'choose' || S.hold ? 'not while something plays: when it is over' : arrange.whyNot());
    const no = why();
    const on = arrange.active;
    // (the room comes up a moment after the choice does: asked again then, so the key is not left greyed)
    if (no && S.phase === 'choose' && !S.hold && !v.door && !S.arrangeT && (S.arrangeTries = (S.arrangeTries ?? 0) + 1) <= 8) {
      S.arrangeT = setTimeout(() => {
        S.arrangeT = null;
        if (!S.dead && S.phase === 'choose') paint();
      }, 500);
    }
    return h('button', {
      type: 'button', class: `rn-key u-rail-key rn-key-arrange${on ? ' is-on' : ''}${no ? ' is-off' : ''}`, 'data-sheet': 'arrange', 'aria-pressed': String(on), 'aria-disabled': no ? 'true' : null,
      title: on ? 'Done arranging (V or Esc)' : no ? `Arrange your trailer: ${no}` : 'Arrange your trailer: move your things, turn them, put them away. No hour passes (V)', 'aria-label': 'Arrange',
      onclick: () => {
        if (arrange.active) arrange.leave().then(() => paint());
        else if (!why() && arrange.enter()) paint();
        else paint();
      },
    }, icon('home'), h('span', { class: 'is-long' }, 'Arrange'), h('span', { class: 'is-short' }, 'Arrange'), ukey('V'));
  }

  function paintRail(v) {
    // (ui-3: THE DOCK IS THE RAIL OF PANEL KEYS now, always: what it held, what you carry, the banked, energy, heat, home
    // risk, what you own and the goal, is your situation at the top right (paintSide). Its width is the rail's, as the
    // dock started, folded, so the stage leaves the room it left)
    root.classList.add('is-rail');
    dock.classList.add('is-rail');
    dock.setAttribute('aria-label', 'Panels');
    // (the county orange in jail: the figure changes with the stage's)
    if (!face.kit || (face.asked && face.asked !== `${face.kit?.handle}|${v.place === 'jail'}`)) showFace(S.sheet === 'character');
    const faceBtn = h('button', { type: 'button', class: 'rn-face', title: 'Your character (C)', onclick: () => openSheet('character') }, face.small);
    fill(dock, faceBtn, sheetKeys(v));
  }
  /** What you own to ride (routes-1: the skateboard), beside the three. */
  const ridesOwned = () => Object.entries(cfg.things ?? {}).filter(([k, t]) => t.kind === 'ride' && S.state.things?.[k]).map(([, t]) => t);
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
    if (!S.v.danger.here && !wayPicked(S.v)) return;
    S.dangerOpen = !S.dangerOpen;
    paint();
  };
  meter.btn.addEventListener('click', togglePrint);
  meter.el.addEventListener('click', togglePrint);
  el.card.append(meter.el, cardBody);

  /** What a jump would take, in words: the cash and the goods (goods-1), or what is said when it takes nothing. */
  const loses = (cash, goods, then, none) => (cash || hasGoods(goods) ? ` lose ${[cash ? money(cash) : null, hasGoods(goods) ? goodsWords(goods) : null].filter(Boolean).join(' and ')}${then}` : none);
  /**
   * THE WAY'S METER (routes-1, the owner's standing rule: every risk that runs over time has a meter where it
   * happens). A way's move picked on the bar (Walk, Skate, the way on from a stop) and the meter is THE WAY'S: the
   * chance of being jumped on the rest of it at what you carry now, its bad one and scuffle as the fills, the police
   * beside it, read before Go (the view's `danger` on the move: each leg's rolls, what each would take). Its small
   * print is the legs. Unpicked, the meter is the hour's here, as ever.
   */
  function wayPicked(v) {
    if (S.phase !== 'choose' || !S.sel || S.hold) return null;
    const m = v.moves?.find(x => x.key === S.sel && x.danger);
    return m && (m.what === 'route' || m.what === 'onward') ? m : null;
  }
  function paintWayDanger(v, m) {
    const d = m.danger;
    const cap = cfg.jump.capPct;
    const w = pct => `${Math.min(100, (pct / cap) * 100)}%`;
    meter.bad.style.width = w(d.jump.bad);
    meter.scuffle.style.width = w(d.jump.scuffle);
    meter.tried.style.width = w(Math.max(0, d.jump.chance - d.jump.bad - d.jump.scuffle));
    meter.now.hidden = true;
    const policeOnly = !d.jump.chance && d.stop.chance > 0;
    const pct = `${policeOnly ? d.stop.chance : d.jump.chance}%`;
    meter.pct.textContent = pct;
    meter.word.textContent = policeOnly ? 'stopped' : 'the way';
    fill(meter.heat, h('span', null, d.legs.some(l => l.rolls) ? `${d.legs.filter(l => l.rolls).length} of ${d.legs.length} legs roll` : 'nothing rolls'));
    meter.heat.title = d.text;
    const none = !d.jump.chance && !d.stop.chance;
    for (const x of [meter.btn, meter.el]) {
      x.classList.toggle('is-zero', none);
      x.classList.add('is-way');
    }
    meter.btn.classList.toggle('is-open', !!S.dangerOpen);
    meter.btn.setAttribute('aria-expanded', String(!!S.dangerOpen));
    meter.btn.title = `${d.text} ${S.dangerOpen ? 'Click to fold the small print' : 'Click for the small print: each leg'}`;
    if (meter.last !== null && meter.last !== pct) {
      meter.pct.classList.remove('is-new');
      void meter.pct.offsetWidth;
      meter.pct.classList.add('is-new');
    }
    meter.last = pct;
    el.print.hidden = !S.dangerOpen;
    if (el.print.hidden) return fill(el.print);
    const stake = d.atStake;
    fill(el.print,
      h('div', { class: 'rn-print-head' }, h('b', null, `The way: ${pct} ${policeOnly ? 'stopped' : 'jumped'}`), h('button', { type: 'button', class: 'k-btn rn-print-x', 'aria-label': 'Fold the small print', onclick: togglePrint }, '×')),
      h('div', { class: 'hk-legend' },
        h('span', { 'data-band': 'disaster' }, h('i'), 'a bad one ', h('b', null, `${d.jump.bad}%`), loses(d.jump.takes?.bad ?? 0, d.jump.takesGoods?.bad, ', wake in the clinic', ' wake in the clinic')),
        h('span', { 'data-band': 'messy' }, h('i'), 'a scuffle ', h('b', null, `${d.jump.scuffle}%`), loses(d.jump.takes?.scuffle ?? 0, d.jump.takesGoods?.scuffle, '', ' nothing to lose'))),
      h('div', { class: `rn-police${d.stop.chance ? ' is-on' : ''}` }, h('span', null, 'Police stop'), h('b', null, `${d.stop.chance}%`),
        h('em', null, d.stop.chance ? `all ${money(d.stop.seizes ?? stake.cash)}${hasGoods(d.stop.seizesGoods) ? ` and ${goodsWords(d.stop.seizesGoods)}` : ''} seized, the night in jail` : `none below heat ${cfg.police.from}`)),
      h('ol', { class: 'rn-legs' }, d.legs.map(l => h('li', { class: l.rolls ? 'is-rolls' : '' },
        h('b', null, `${cap1(labelOf(l.from))} → ${labelOf(l.to)}`),
        h('span', null, l.rolls ? `${l.hours}h on ${labelOf(l.ground)}: ${l.jump.chance}% jumped${l.stop.chance ? `, ${l.stop.chance}% stopped` : ''}` : l.hours ? `${l.hours}h, nothing rolls` : 'no hour: nobody catches you')))),
      h('p', { class: 'rn-now-line' }, `On you: ${money(stake.cash)}${hasGoods(stake.goods) ? ` and ${goodsWords(stake.goods)}` : ''}. ${m.what === 'onward' ? 'Going on' : 'Setting out'}, ${m.hours ? `${m.hours} hour${m.hours > 1 ? 's' : ''}` : 'no hour'}${m.energy ? `, energy ${m.energy}` : ''}.`));
  }
  const cap1 = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
  function paintDanger(v) {
    const way = wayPicked(v);
    meter.btn.classList.toggle('is-way', !!way);
    meter.el.classList.toggle('is-way', !!way);
    if (way) return paintWayDanger(v, way);
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
    // (ui-3: the heat is your situation's, top right; under the number only the police, when they are about)
    fill(meter.heat, here?.police ? h('em', { class: `rn-pol${here.hot || hot ? ' is-on' : ''}`, title: here.text }, 'police') : null);
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
        h('span', { 'data-band': 'disaster' }, h('i'), 'a bad one ', h('b', null, `${one.jump.bad}%`), loses(one.jump.takes.bad, one.jump.takesGoods?.bad, ', wake in the clinic', ' wake in the clinic')),
        h('span', { 'data-band': 'messy' }, h('i'), 'a scuffle ', h('b', null, `${one.jump.scuffle}%`), loses(one.jump.takes.scuffle, one.jump.takesGoods?.scuffle, '', ' nothing to lose'))),
      h('div', { class: `rn-police${one.stop.chance ? ' is-on' : ''}` }, h('span', null, 'Police stop'), h('b', null, `${one.stop.chance}%`),
        h('em', null, one.stop.chance ? `all ${money(one.stop.seizes)}${hasGoods(one.stop.seizesGoods) ? ` and ${goodsWords(one.stop.seizesGoods)}` : ''} seized, the night in jail${hasGoods(one.stop.seizesGoods) ? `, heat ${one.stop.heatAfter} after, the connect against you` : ''}` : `none below heat ${cfg.police.from}`)),
      h('p', { class: 'rn-now-line' }, `This hour, work or leave: ${now.jump.chance}% jumped${now.stop.chance ? `, ${now.stop.chance}% stopped` : ''}. ${v.hoursThere} hour${v.hoursThere === 1 ? '' : 's'} here, ${money(v.carried)}${hasGoods(v.atRisk?.goods) ? ` and ${goodsWords(v.atRisk.goods)}` : ''} on you.`));
  }

  // ── THE BAR'S ROW: what is happening, what just happened, or what the place says, in the same room each time ──────
  function saidEl(v) {
    if (S.hold) return h('p', { class: 'rn-said-line' }, S.hold.doing);
    // (the opening: the walk home, Skip beside it)
    if (S.opening) return h('p', { class: 'rn-said-line is-quiet' }, `Day ${v.day}. Home to the trailer.`);
    const r = S.result;
    // (ui-3: what just happened is the result card's, and the journal's: the row says it only when there is no card,
    // as after a reload, which keeps the line it saved)
    if (r && !S.card && (S.phase !== 'choose' || !S.resultGone)) return resultEl(r);
    // (the door and stranded say it plainly: they are the morning's and the night's one question)
    if (S.phase === 'choose' && v.door && v.place === 'crib') return h('p', { class: 'rn-said-line rn-dry rn-door-said', title: v.door.text }, v.door.text);
    if (S.phase === 'choose' && v.stranded) return h('p', { class: 'rn-said-line rn-dry rn-stranded', title: v.stranded.text }, v.stranded.text);
    if (S.phase === 'choose' && v.dry) return h('p', { class: 'rn-said-line rn-dry', title: v.dry.text }, v.dry.text);
    // (routes-1: a way picked: its danger in brief, the small print a click away)
    const way = wayPicked(v);
    if (way) return wayHint(way);
    const note = S.phase === 'choose' ? sellNote(v) : null;
    // (where nothing can act on you and it is not hot, the note has the row: the number says SAFE)
    const calm = !v.danger.here && !(v.places ?? []).find(p => p.here && p.place === v.place)?.hot;
    return note ? (calm ? note : [hintEl(v), note]) : hintEl(v);
  }
  /**
   * A SELLING JOB MISSING FOR WANT OF GOODS (goods-1): one quiet line on the row, what is missing and where to buy it
   * (the view's `selling` and `connects`); what is at home said too. None when every selling job here is dealt.
   */
  function sellNote(v) {
    // (and one missing this hour with the goods on you: a newcomer with a fresh carton looked for it. The options are
    // dealt anew each hour; when nobody here is left to buy today, that is said instead)
    const on = (v.selling?.jobs ?? []).find(x => x.takes.some(t => t.carried) && !(v.options ?? []).some(o => o.id === x.job));
    if (on) {
      const role = cfg.places[v.place]?.jobs?.[on.job]?.role;
      const left = (v.people ?? []).some(p => p.place === v.place && p.role === role && !p.outToday);
      const said = left ? 'No buyer this hour' : 'No buyer left today';
      const name = (cfg.jobs[v.place]?.[on.job]?.label ?? on.label).replace(/ at the bus stop$/, '');
      return h('span', { class: 'rn-sell-note', 'data-rank': 8, title: `${name}: not dealt this hour. ${left ? 'The options are dealt anew each hour: maybe the next.' : 'Everyone here who buys has been sold to today.'}` }, h('b', null, said));
    }
    const j = (v.selling?.jobs ?? []).find(x => !x.dealt && x.takes.every(t => !t.carried));
    if (!j) return null;
    const where = c => (c.here ? 'here' : c.placeLabel);
    const buy = j.takes.map(t => (v.connects ?? []).find(c => c.good === t.good)).filter(Boolean)
      .sort((a, b) => Number(b.here) - Number(a.here)).map(c => `${cap(c.who.name)} (${where(c)}): ${packWord(c.good)} ${money(c.price)}${c.sells ? '' : ', not to you today'}`);
    const home = goodsWords(Object.fromEntries(j.takes.filter(t => t.home).map(t => [t.good, t.home])));
    const name = (cfg.jobs[v.place]?.[j.job]?.label ?? j.label).replace(/ at the bus stop$/, '');
    return h('span', { class: 'rn-sell-note', 'data-rank': 6, title: j.text }, h('b', null, `${name}: not dealt`), ` no ${j.takes.map(t => goodWord(t.good, 2)).join(' or ')} on you${home ? ` (${home} at home)` : ''} · buy from ${buy.join(' · ')}`);
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
      // (the goods at stake first: it is what you stand to lose, and the chances are on the number too. Whole plates,
      // the least giving way when the row is short: fitRow)
      const stake = hasGoods(v.atRisk?.goods) ? `${goodsWords(v.atRisk.goods)} at stake` : null;
      return h('button', { type: 'button', class: 'rn-said-line rn-danger-sum', onclick: togglePrint, title: `${here ? `${here.text} ` : ''}${stake ? `${cap(stake)}. ` : ''}Bad one ${one.jump.bad}%, scuffle ${one.jump.scuffle}%, police ${one.stop.chance}%. The small print: what each would cost` },
        words,
        stake ? h('span', { class: 'rn-at-goods', 'data-rank': 9 }, stake) : null,
        one.jump.chance ? h('span', { 'data-band': 'disaster', 'data-rank': 6 }, h('i'), `bad one ${one.jump.bad}%`) : null,
        one.jump.chance ? h('span', { 'data-band': 'messy', 'data-rank': 5 }, h('i'), `scuffle ${one.jump.scuffle}%`) : null,
        h('span', { class: one.stop.chance ? 'is-police' : '', 'data-rank': one.stop.chance ? 7 : 2 }, `police ${one.stop.chance}%`),
        h('em', { 'data-rank': 1 }, S.dangerOpen ? 'less' : 'more'));
    }
    // (quiet: short, so the row's narrowest room holds it whole)
    if (here) return h('p', { class: `rn-said-line${here.hot ? ' rn-dry' : ' is-quiet'}`, title: `${here.text} Nobody jumps you here.` }, here.hot || here.heat ? `${here.hot ? `Hot today (heat ${here.heat}): police about` : `Heat ${here.heat} here`}. Nobody jumps you here.` : 'Quiet. Safe here.');
    return h('p', { class: 'rn-said-line is-quiet' }, d.why === 'the day is over' ? 'The day is over.' : v.place === 'jail' || v.place === 'clinic' ? 'Your day is over.' : `Nobody acts on you here. At ${cfg.places.market.label}, every hour can go wrong.`);
  }
  /**
   * THE WAY'S DANGER IN BRIEF (routes-1), on the row while a way is picked: what is at stake, the bad one and the
   * scuffle and what each would take, the police, where it rolls. Whole plates; the least gives way when it is short.
   */
  function wayHint(m) {
    const d = m.danger;
    const stake = d.atStake;
    const grounds = [...new Set(d.legs.filter(l => l.rolls).map(l => labelOf(l.ground)))];
    const where = m.what === 'onward' ? `On to ${m.home ? 'home' : labelOf(m.to)}` : `${m.choice.do === 'skate' ? 'Skate' : 'Walk'} ${m.home ? 'home' : `to ${labelOf(m.to)}`}`;
    return h('button', { type: 'button', class: 'rn-said-line rn-danger-sum rn-way-sum', onclick: togglePrint, title: `${d.text} The small print: each leg` },
      h('b', { class: 'rn-place-word', 'data-rank': 4 }, where),
      h('span', { class: 'rn-at-goods', 'data-rank': 9 }, `${money(stake.cash)}${hasGoods(stake.goods) ? ` + ${goodsWords(stake.goods)}` : ''} at stake`),
      d.jump.chance ? h('span', { 'data-band': 'disaster', 'data-rank': 6 }, h('i'), `bad one ${d.jump.bad}%`) : null,
      d.jump.chance ? h('span', { 'data-band': 'messy', 'data-rank': 5 }, h('i'), `scuffle ${d.jump.scuffle}%`) : null,
      h('span', { class: d.stop.chance ? 'is-police' : '', 'data-rank': d.stop.chance ? 7 : 2 }, `police ${d.stop.chance}%`),
      h('span', { 'data-rank': 3 }, grounds.length ? `rolls on ${grounds.map(g => g.replace(/, outside .*$/, '')).join(', ')}` : 'nothing rolls on the way'),
      h('em', { 'data-rank': 1 }, S.dangerOpen ? 'less' : 'more'));
  }
  /** What just happened: its lines and its rolls on the one row (all of it in the tooltip when the row is short). */
  function resultEl(r) {
    const chips = r.chips ?? [];
    const title = [...r.lines.map(l => l.text), ...chips.map(c => c.title), ...r.rolls.filter(x => x.title).map(x => x.title)].join(' ');
    // (each plate's and line's rank: when the one row is short, the lowest gives way whole, fitRow)
    const paid = l => (l.pay ? h('b', { class: 'rn-paid', 'data-rank': 9 }, `+${money(l.pay)}`) : null);
    if (!chips.length) {
      return h('div', { class: 'rn-said-line rn-result', title },
        r.lines.flatMap(l => [paid(l), h('span', { class: `rn-tick${l.bad ? ' rn-bad' : ''}`, 'data-rank': l.rank }, l.text)]),
        r.rolls.map(rollEl));
    }
    // WITH TRUST NEWS the one row is shared (has-chips, run.css): what it paid, the lines a plate does not say again,
    // the move's own dice (how it went), told on or not (the heat), then what it did to people, then the other dice
    return h('div', { class: 'rn-said-line rn-result has-chips', title },
      r.lines.map(paid),
      r.lines.filter(l => !l.covered).map(l => h('span', { class: `rn-tick${l.bad ? ' rn-bad' : ''}`, title: l.text, 'data-rank': l.rank }, l.text)),
      r.rolls.filter(x => x.own).map(rollEl),
      r.rolls.filter(x => x.witness).map(rollEl),
      chips.map(c => h('span', { class: `rn-tchip is-${c.tone}`, title: c.title, 'data-rank': c.tone === 'bad' ? 7 : c.rank ?? 4 }, c.text)),
      r.rolls.filter(x => !x.own && !x.witness).map(rollEl));
  }
  /**
   * THE ONE ROW NEVER CUTS A PLATE MID-WORD (the owner: long names were cut, "A man at the bus stop called…"): while
   * what it says is wider than the row, or a line of it is cut, the plate or line of lowest rank gives way whole, its
   * words still in the row's tooltip. The bar's own row only, and not at phone width, where it has two lines.
   */
  function fitRow() {
    const said = cardBody.querySelector('.rn-said');
    const row = said?.querySelector(':scope > .rn-result, :scope > .rn-danger-sum');
    if (!row) return;
    // (a selling note beside the danger's brief is one of the row's plates)
    const plates = [...row.children, ...said.querySelectorAll(':scope > .rn-sell-note')].filter(e => e.dataset.rank);
    for (const p of plates) p.style.display = '';
    if (matchMedia('(max-width: 720px)').matches) return;
    const cut = () => said.scrollWidth > said.clientWidth + 1 || row.scrollWidth > row.clientWidth + 1 || plates.some(e => e.style.display !== 'none' && e.scrollWidth > e.clientWidth + 1);
    // (the most important stays whatever: alone and still too long, its words end in … and the tooltip has them all)
    const order = plates.slice().sort((a, b) => a.dataset.rank - b.dataset.rank).slice(0, -1);
    while (cut() && order.length) order.shift().style.display = 'none';
  }
  /** A roll: the chance as a bar and the needle where the number landed (the old HUD's roll card, small). */
  function rollEl(r) {
    const segs = [{ key: 'clean', pct: r.risk ? 100 - r.chance : r.chance, label: r.risk ? 'clear' : 'works' }, { key: 'disaster', pct: r.risk ? r.chance : 100 - r.chance, label: r.risk ? r.label : 'fails' }];
    const bar = barEl(segs, { small: true });
    // (the engine rolls under the chance to hit; the bar draws the good part first, so a risk's roll is mirrored)
    if (r.roll !== null) bar.append(h('span', { class: 'hk-needle', style: `left:${r.risk ? 100 - (r.roll + 0.5) : r.roll + 0.5}%` }));
    const band = r.quiet ? 'clean' : r.risk ? (r.hit ? 'disaster' : 'clean') : r.hit ? 'clean' : 'disaster';
    return h('span', { class: `rn-roll${r.witness ? ' is-told' : ''}`, 'data-rank': r.own ? 8 : r.witness ? 5 : r.quiet ? 3 : 7, title: r.roll !== null ? `${r.label}: rolled ${r.roll}, under ${r.chance} ${r.risk ? 'is trouble' : 'wins'}` : r.label }, bar,
      r.quiet ? h('span', { class: 'rn-roll-said' }, r.no) : h('span', { class: 'hk-tick-roll', 'data-band': band }, r.hit ? r.yes : r.no));
  }
  /**
   * WHAT A SALE USES (goods-1), on the option's small line: one of the good it sells, and what is left on you (and at
   * home) after. With more than one good it takes on you, the good is picked there (a click, or U: the next), as a
   * target is; the pay follows the pick.
   */
  function usesEl(o) {
    const u = usesOf(o);
    if (!u) return null;
    const many = (o.goodsHere?.length ?? 0) > 1;
    // (short, and never cut: the good only when it is picked, since the card's name says what it sells)
    const words = many ? `${goodWord(u.good, 2)} · ${u.left} left` : `uses 1 · ${u.left} left`;
    const title = `A sale uses one, win or lose: ${u.carried} ${goodWord(u.good, u.carried)} on you, ${u.left} after${many ? `. It takes ${o.goodsHere.map(g => `${goodWord(g.good, 2)} (${range(g.pay)})`).join(' or ')}: a click or U picks` : ''}`;
    return many
      ? h('span', { class: 'rn-uses is-pick', role: 'button', tabindex: '-1', title, onclick: ev => { ev.stopPropagation(); cycleGood(o); } }, h('i', null, '‹'), words, h('i', null, '›'), h('b', { class: 'rn-uses-key' }, 'U'))
      : h('span', { class: 'rn-uses', title }, words);
  }
  /** The good an option sells as picked (its dealt one unless another is), with what is on you of it. */
  function usesOf(o) {
    if (!o.uses) return null;
    const pick = goodOfPick(o);
    if (!pick || pick.good === o.uses.good) return o.uses;
    const g = (S.v.goods ?? []).find(x => x.good === pick.good);
    return { good: pick.good, n: 1, cost: pick.cost, carried: pick.carried, left: pick.carried - 1, home: g?.home ?? 0 };
  }
  function goodOfPick(o) {
    const list = o.goodsHere ?? [];
    if (list.length < 2) return null;
    const dealt = Math.max(0, list.findIndex(g => g.good === o.uses?.good));
    return list[(S.goodPick?.[o.id] ?? dealt) % list.length];
  }
  function cycleGood(o) {
    if (S.phase !== 'choose' || (o.goodsHere?.length ?? 0) < 2) return;
    const list = o.goodsHere;
    const now = list.indexOf(goodOfPick(o));
    S.goodPick = { ...(S.goodPick ?? {}), [o.id]: (now + 1) % list.length };
    S.sel = o.key;
    picked();
    paint();
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
    // (home-1: what each answer does to the pressure at home, as the options show it)
    const atHome = (n, sep = '; ') => (S.v.pressure && n ? `${sep}home ${signedT(n)}` : '');
    if (c.do === 'give') return [`Give ${S.v.door?.name ?? 'them'} what they ask`, `from banked (${money(S.v.banked)}); they go, friendly (trust ${signedT(cfg.trust.give)}), and they will be back${atHome(cfg.pressure?.give)}`, money(m.amount)];
    if (c.do === 'refuse') {
      // (trust-1: refusing is trust −4. From with you at +3 that is only neutral: sore, no grudge, no police)
      const d = S.v.door;
      const sore = d && trustBand(cfg, trustAfter(cfg, S.state, d.id, cfg.trust.refuse)) !== 'against';
      return [`Shut the door on ${d?.name ?? 'them'}`, `${R.fightPct}% they swing at you (energy −${R.hurt.messy} to −${R.hurt.clean}); ${sore ? 'else they go off sore: you go back far enough, no grudge, no police' : `else a grudge: no sales ${R.grudgeDays} days, police round the park (heat +${R.grudgeHeat} there)`}${atHome(cfg.pressure?.refuse)}`, null];
    }
    const w = moveWords(m);
    return [w[0], w[1], null];
  }
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
  /**
   * HOW A MOVE WOULD MOVE THE PRESSURE AT HOME (home-1), as heat's "+1" is shown: "home +1", "home +1/+2" (+2 if it
   * fails), "home −1" for what eases it. Only where it counts (the view's `pressure` on the option: the trailer park).
   */
  const pressWords = p => (!p ? null : `home ${signedT(p.ifWin)}${p.ifFail && p.ifFail !== p.ifWin ? `/${signedT(p.ifFail)}` : ''}`);
  const pressTag = p => (!p ? null : h('span', { class: `hk-tag rn-press-tag${(p.ifWin ?? 0) < 0 ? ' is-eases' : ''}`, title: `Pressure at home ${signedT(p.ifWin)} if it works${p.ifFail && p.ifFail !== p.ifWin ? `, ${signedT(p.ifFail)} if it fails` : ''}: what you do on your own street brings somebody to your door (K)` }, pressWords(p)));

  // ── THE TARGET OF AN OPTION: the dealt one unless another is picked (kept for the hour, by option) ─────────────────
  const targetIndex = o => Math.min(S.targets?.[o.id] ?? 0, Math.max(0, (o.targets?.length ?? 1) - 1));
  const targetOf = o => o.targets?.[targetIndex(o)] ?? o.who ?? null;
  /** The picked person's trust (a target carries its own; the dealt one of a job with no targets, the option's). */
  const trustOfPick = o => o.targets?.[targetIndex(o)] ?? (o.trust ? { ...o.trust, withPay: o.withPay ?? 0 } : null);
  /** The pay with the picked person: the view's is the dealt one's, with them (withPay) or not. */
  const payOfPick = o => {
    const d = (trustOfPick(o)?.withPay ?? 0) - (o.withPay ?? 0);
    // (goods-1: another good picked than the one dealt: its pay there, with what the dealt one's carries over it)
    const g = goodOfPick(o);
    const base = g && g.good !== o.uses?.good ? (() => { const dealt = o.goodsHere.find(x => x.good === o.uses?.good)?.pay ?? o.pay; return g.pay.map((x, i) => x + (o.pay[i] - dealt[i])); })() : o.pay;
    return d ? base.map(x => x + d) : base;
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
    // (routes-1: at a stop with nothing of its hand to play, the way on)
    if (v.route) return (v.hand ?? []).some(c => c.available) ? null : v.moves.find(m => m.what === 'onward')?.key ?? null;
    if (!v.dry) return null;
    const c = v.dry.to === 'market'
      ? v.choices.find(x => x.available && x.choice.do === 'subway' && x.choice.to === 'market' && !x.choice.hop) ?? v.choices.find(x => x.available && x.choice.do === 'subway' && x.choice.to === 'market') ?? v.choices.find(x => x.available && x.choice.do === 'inside')
      : v.choices.find(x => x.available && x.choice.do === 'subway' && x.choice.to === 'park' && !x.choice.hop) ?? v.choices.find(x => x.available && x.choice.do === 'subway' && x.choice.to === 'park') ?? v.choices.find(x => x.available && x.choice.do === 'inside');
    return c?.key ?? null;
  }

  /**
   * THE CASH TO STEP OUT WITH, AS IT STARTS (a newcomer stepped out with nothing and met the connect short): with no
   * goods on you or at home, the price of the trailer park's pack when its connect sells to you and the bank covers it,
   * and with it the subway's fare there and back when the bank covers that too ("$14 for a carton + fares": slime,
   * 2026-11-15, after the carton alone left $0 and the market was only the turnstile); with goods at home to sell,
   * the fare there and back (or one way, all the bank has); else nothing. Still the player's to change; −10 is less.
   */
  function takeFirst(v) {
    if (v.place !== 'crib') return { take: 0, for: '' };
    if (!hasGoods(S.state.goods) && !hasGoods(S.state.stash)) {
      const c = (v.connects ?? []).find(x => x.place === 'park');
      if (!c?.sells || c.price > v.banked) return { take: 0, for: '' };
      const ride = 2 * cfg.subway.fare;
      return c.price + ride <= v.banked ? { take: c.price + ride, for: ` for a ${packWord(c.good)} + fares` } : { take: c.price, for: ` for a ${packWord(c.good)}` };
    }
    const fares = v.banked >= 2 * cfg.subway.fare ? 2 : v.banked >= cfg.subway.fare ? 1 : 0;
    return hasGoods(S.state.stash) && fares ? { take: fares * cfg.subway.fare, for: fares > 1 ? ' fares' : ' fare' } : { take: 0, for: '' };
  }
  /** A move's words on the row: [its name, what it costs and risks in brief, more for its tooltip]. */
  function moveWords(m) {
    const c = m.choice;
    if (c.do === 'inside') return ['Go inside', S.v.carried ? `bank ${money(S.v.carried)}` : 'the crib'];
    if (c.do === 'subway' && c.to === 'market') return c.hop ? ['Hop it', `${m.hop.caught}% seen`, `free; heat +${m.hop.heat} if seen`] : ['Subway', money(m.fare), 'the fare, to the market'];
    if (c.do === 'subway' && c.to === 'park') return c.hop ? ['Hop home', `${m.hop.caught}% seen`, `free; heat +${m.hop.heat} if seen; this hour still counts here`] : ['Head home', money(m.fare), 'the fare; this hour still counts here'];
    if (c.do === 'out') {
      const goods = hasGoods(S.goodsTake) ? goodsWords(S.goodsTake) : '';
      // (the cash as it started, takeFirst: what it is for, in a few words)
      const first = takeFirst(S.v);
      const cash = S.take ? `${money(S.take)}${first.take && S.take === first.take ? first.for : ''}` : null;
      return ['Step out', cash || goods ? `with ${[cash, goods || null].filter(Boolean).join(' + ')}` : 'with nothing'];
    }
    // (routes-1: the ways on foot and on the board, beside the subway: no fare, the hours, the energy, the chance of
    // being jumped on the way at what you carry; at a stop, the way on. All of it in the tooltip and the danger's line)
    if (c.do === 'walk' || c.do === 'skate') {
      const d = m.danger;
      const name = `${c.do === 'walk' ? 'Walk' : 'Skate'}${m.home ? ' home' : ''}`;
      return [name, 'free', `no fare; ${m.hours} hour${m.hours > 1 ? 's' : ''}, energy ${m.energy}; by ${m.via.map(x => x.label).join(', then ')}${d ? `. ${d.text}` : ''}`];
    }
    if (c.do === 'onward') {
      const d = m.danger;
      return [`${m.way === 'board' ? 'Skate' : 'Walk'} on`, `${m.home ? 'home' : `to ${labelOf(m.to).replace(/^the /, '')}`} · ${m.hours ? `${m.hours}h` : 'no hour'}${d?.jump.chance ? ` · ${d.jump.chance}% jumped` : ''}`, d?.text ?? ''];
    }
    if (c.do === 'sleep') return ['Sleep', 'the day ends'];
    if (c.do === 'morning') return ['Morning', 'out and home'];
    // the street (rules-2): what each costs and risks, in the row's small type; all of it in the tooltip
    if (c.do === 'rob') return ['Rob', `${m.odds}% ${range(m.pay)} · heat +${m.winHeat} here${m.pressure ? ` · ${pressWords(m.pressure)}` : ''}`, `${m.pressure ? `pressure at home ${signedT(m.pressure.ifWin)}, ${signedT(m.pressure.ifFail)} if it fails; ` : ''}an hour and ${m.energy} energy; if it fails, heat +${m.failHeat} here; ${m.left} worth robbing left today${m.oddsWhy?.length ? `; ${m.oddsWhy.join(', ')}` : ''}`];
    if (c.do === 'bins') {
      const best = m.finds[m.finds.length - 1];
      // (an hour and an energy, as every job: said in the tooltip and the All moves panel, as the jobs say it on the dock)
      return ['Bins', `${best.pct}% ${range(best.pay)}${m.seen ? ` · ${m.seen.pct}% seen` : ''}`,
        `an hour and ${m.energy} energy: ${m.finds.map(f => (f.pay[1] ? `${f.pct}% ${range(f.pay)}` : `${f.pct}% nothing`)).join(', ')}${m.seen ? `; ${m.seen.pct}% a ${m.seen.role} sees you: one with you looks away, anyone else ${cfg.moods[m.seen.mood]} (trust ${signedT(m.seen.trust ?? 0)})${m.seen.pressure ? `, and pressure at home ${signedT(m.seen.pressure)}` : ''}` : ''}; ${m.left} left to dig today`];
    }
    if (c.do === 'shop') {
      const it = S.v.shopHere.find(s => s.item === c.item);
      const gives = Object.entries(it?.gives ?? {}).map(([k, n]) => `${k} +${n}`).join(', ');
      return [`${cap(shortName(it?.label ?? m.label))} ${money(m.price)}`, gives || it?.does || '', `${it?.does ?? ''}${it?.left !== null && it?.left !== undefined ? `; ${it.left} left today` : ''}; no hour`];
    }
    if (c.do === 'rough') return ['Sleep rough', `${m.robbedPct}% robbed · wake at ${m.morningEnergy}`, 'the day ends here; you wake here at noon, your own heat not cooled'];
    // (goods-1: the connect's pack, P; the place's things, K, one on the row at a time; what you wear, at the crib)
    // (short on the row: the pack's word, price, who and how many more today; a thing's last word, price, which of how
    // many. All of it in the tooltip, the All moves panel and the Stuff panel)
    if (c.do === 'pack') return [`${cap(packWord(c.good))} ${money(m.price)}`, `${cap(String(m.who?.name ?? '').replace(/^Cousin /, ''))}${m.left !== null && m.left !== undefined ? ` · ${m.left} left` : ''}`, `${m.sales} sales of ${cfg.goods[c.good]?.label} from ${m.who?.name}${m.off ? `, ${money(m.off)} off: with you` : ''}; no hour`];
    if (c.do === 'get') {
      const all = S.v.moves.filter(x => x.choice.do === 'get');
      const e = (S.v.errands ?? []).find(x => x.here && x.item === c.item);
      const word = thingWord(thingOf(cfg, c.item)?.label).split(' ').pop();
      // (home-1: a thing that defends your home says so on the row: what it does, in the tooltip)
      const defends = !!thingOf(cfg, c.item)?.defends;
      return [`${cap(defends ? thingWord(thingOf(cfg, c.item).label) : word)} ${money(m.price)}`, defends ? 'defends your crib' : all.length > 1 ? `${all.indexOf(m) + 1}/${all.length}` : '', `${thingWord(thingOf(cfg, c.item)?.label)} from ${e?.keeper?.name ?? 'them'}: ${thingOf(cfg, c.item)?.desc ?? ''}; ${thingOf(cfg, c.item)?.kind === 'ride' || defends ? `${thingOf(cfg, c.item).does}` : 'looks only'}; no hour`];
    }
    // (save-1: COUSIN EARL BY THE STRETCH, at the crib: hired for three days, paid up front; on his last day the same
    // move keeps him three more. No taking him off)
    if (c.do === 'guard') {
      const who = cap(String(m.who?.name ?? 'him').replace(/^Cousin /, ''));
      const why = `whoever tries your door has to get past him (${m.beatenPct}% they beat him); paid from banked now, no refund; no hour`;
      return m.on ? [`Keep ${who} ${m.days} more days`, money(m.price), why] : [`Hire ${who}`, `${m.days} days · ${money(m.price)}`, why];
    }
    if (c.do === 'wear' || c.do === 'unwear') return [cap(thingWord(thingOf(cfg, c.item)?.label)), c.do === 'wear' ? 'put on' : 'take off'];
    if (c.do === 'give') return [`Give ${money(m.amount)}`, 'from banked'];
    if (c.do === 'refuse') return ['Shut the door', `${cfg.regulars.fightPct}% he swings`];
    return [m.label, ''];
  }
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
    // (routes-1: the board not owned yet: its price, and where it is sold)
    if (/^you need a skateboard/.test(w)) return `needs a board: ${money(cfg.things.board.price)}, the market`;
    if (/^no energy left: walk on/.test(w)) return 'no energy';
    if (/won't sell to you/.test(w)) return 'won\'t sell: against you';
    if (/has sold you/.test(w)) return 'sold out today';
    if (/^you carry \$\d+/.test(w)) return `short: ${w.match(/^you carry (\$\d+)/)[1]} on you`;
    if (/^you have \$\d+ banked/.test(w)) return `short: ${w.match(/^you have (\$\d+)/)[1]} banked`;
    return w;
  }
  // ── THE DOCK (ui-3, leg 2; dock.js): the three things in front of you, 1 to 3, and the six verbs that never move,
  // renumber or vanish (Shop B, Rob R, Bins X, Travel T, Home H, Sleep Z); the main button names exactly what it
  // will do. Shop and Travel open a list over the verb. Arrows move the selection: ← → along the dock, ↑ ↓ change what
  // is picked (the cash to step out with, who a job is done to, which thing in a list). Enter does it, Esc closes.
  // (join-1: and the try-out stop, last on Travel's list wherever Travel is offered: tryout.js. It is the page's, never
  // the rules': choiceOf knows it as a choice the dock can show and pick; confirm() takes the trip, nothing is sent)
  const dockNow = () => withTryout(dockOf({ cfg, v: S.v }));
  const choiceOf = key => (key ? S.v.choices.find(c => c.key === key) ?? (isTryout(key) && tryoutOffered(dockOf({ cfg, v: S.v })) ? TRYOUT_CHOICE : null) : null);
  /** The page key that reaches a rules' choice on the dock ('1'..'3', 'B', 'R', …), or null: for the panels. */
  const keyFor = key => dockPlace(dockNow(), key)?.key ?? null;
  /** The slots in the arrows' order: the three cards, then the six verbs. */
  const slotsOf = d => [...d.cards.map(c => ({ card: c, keys: c.keys })), ...d.verbs.map(x => ({ verb: x, keys: x.keys }))];
  /** The slot the picked choice is in (an open list's verb first), or -1. */
  function slotNow(d) {
    const slots = slotsOf(d);
    if (S.list) return slots.findIndex(s => s.verb?.id === S.list);
    if (!S.sel) return -1;
    const i = slots.findIndex(s => s.card && s.keys.includes(S.sel));
    return i >= 0 ? i : slots.findIndex(s => s.verb && s.keys.includes(S.sel));
  }
  /** Pick a choice on the dock (the list it is in stays open, any other closes). */
  function pickKey(key, list = null) {
    if (S.phase !== 'choose') return;
    S.sel = key;
    S.list = list;
    picked();
    paint();
  }
  /** 1 to 3: the thing in that place (the one it shows: the goal card keeps the one ↑ ↓ chose). */
  function pickCard(n) {
    const c = dockNow().cards[n - 1];
    if (!c?.keys.length) return toast(cap(c?.empty ?? 'nothing there'));
    pickKey(c.keys.includes(S.sel) ? S.sel : c.keys[0]);
  }
  /** A verb's key: Shop and Travel open (again: close) their list on its first thing; the others pick their one. */
  function pickVerb(id) {
    if (S.phase !== 'choose') return;
    const verb = dockNow().verbs.find(x => x.id === id);
    if (!verb) return;
    if (verb.list && S.list === id) {
      S.list = null;
      S.sel = null;
      return paint();
    }
    if (!verb.keys.length) return toast(cap(verb.why));
    pickKey(verb.list && verb.keys.includes(S.sel) ? S.sel : verb.keys[0], verb.list ? id : null);
    if (verb.why && !verb.list) toast(cap(verb.why));
  }
  /** ← →: the next slot along the dock that holds something (a list verb opens its list). */
  function moveSlot(dir) {
    const d = dockNow();
    const slots = slotsOf(d);
    let i = slotNow(d);
    for (let n = 0; n < slots.length; n++) {
      i = i < 0 ? (dir > 0 ? 0 : slots.length - 1) : (i + dir + slots.length) % slots.length;
      const s = slots[i];
      if (!s.keys.length) continue;
      if (s.verb) return pickKey(s.verb.list && s.keys.includes(S.sel) ? S.sel : s.keys[0], s.verb.list ? s.verb.id : null);
      return pickKey(s.keys.includes(S.sel) ? S.sel : s.keys[0]);
    }
  }
  /** ↑ ↓: what the picked thing is set to. `big`: Shift, ten dollars at a time. */
  function adjust(dir, big = false) {
    const d = dockNow();
    const c = choiceOf(S.sel);
    const step = (keys, k, by = dir) => keys[(keys.indexOf(k) + by + keys.length) % keys.length];
    if (S.list) {
      // (a list reads top to bottom: ↓ is the line below, ↑ the line above. `dir` is "more" for ↑, as an amount
      // wants it, and took the lists the wrong way round)
      const keys = d.verbs.find(x => x.id === S.list)?.keys ?? [];
      if (keys.length) pickKey(step(keys, S.sel, -dir), S.list);
      return;
    }
    if (!c) return;
    if (c.choice.do === 'out') {
      const max = c.takeOut?.max ?? 0;
      S.take = Math.max(0, Math.min(max, (S.take ?? 0) + dir * (big ? 10 : 1)));
      return paint();
    }
    const card = d.cards.find(x => x.keys.includes(S.sel));
    if (card && card.keys.length > 1) return pickKey(step(card.keys, S.sel));
    const o = c.job ? S.v.options.find(x => x.key === c.key) : null;
    // (a job with a choice of goods and of who: ↑ ↓ who it is done to, Shift with them the good it sells; U's old job)
    if (o && (o.goodsHere?.length ?? 0) > 1 && (big || (o.targets?.length ?? 0) < 2)) return cycleGood(o);
    if (o && (o.targets?.length ?? 0) > 1) {
      S.targets = { ...(S.targets ?? {}), [o.id]: (targetIndex(o) + dir + o.targets.length) % o.targets.length };
      return paint();
    }
    const verb = d.verbs.find(x => !x.list && x.keys.includes(S.sel) && x.keys.length > 1);
    if (verb) pickKey(step(verb.keys, S.sel));
  }

  /** The main button's words: exactly what Enter will do now. */
  function goWords(c) {
    if (!c) return null;
    if (c.choice.do === 'tryout') return tryoutGo();
    const m = c;
    const x = c.choice;
    if (x.do === 'job') {
      const o = S.v.options.find(q => q.key === c.key);
      const who = o ? targetOf(o) : null;
      return `${cfg.jobs[S.v.place]?.[o?.id]?.label ?? c.label}${who ? ` · ${cap(personShort(who.name))}` : ''}`;
    }
    if (x.do === 'card') return cardName(x.id ?? c.card?.id);
    if (x.do === 'out') {
      const goods = hasGoods(S.goodsTake) ? goodsWords(S.goodsTake) : '';
      const cash = S.take ? money(S.take) : '';
      return `Step out with ${[cash, goods].filter(Boolean).join(' + ') || 'nothing'}`;
    }
    if (x.do === 'buy') {
      const s = S.v.shop.find(q => q.item === x.item);
      return `Buy the ${thingWord(s?.label ?? x.item).replace(/^real /, '')} · ${money(s?.price ?? 0)}`;
    }
    if (x.do === 'inside') return S.v.carried ? `Go inside: bank ${money(S.v.carried)}` : 'Go inside';
    if (x.do === 'subway') return x.hop ? (x.to === 'park' ? 'Hop the turnstile home' : 'Hop the turnstile') : `${x.to === 'park' ? 'Subway home' : `Subway to ${labelOf(x.to).replace(/^the /, '')}`} · ${money(m.fare ?? cfg.subway.fare)}`;
    if (x.do === 'walk' || x.do === 'skate') return `${x.do === 'walk' ? 'Walk' : 'Skate'} ${m.home ? 'home' : `to ${labelOf(x.to).replace(/^the /, '')}`}`;
    if (x.do === 'onward') return `${m.way === 'board' ? 'Skate' : 'Walk'} on ${m.home ? 'home' : `to ${labelOf(m.to).replace(/^the /, '')}`}`;
    if (x.do === 'rob') return 'Rob somebody passing';
    if (x.do === 'bins') return 'Dig through the bins';
    if (x.do === 'sleep') return `Sleep: day ${S.v.day} ends`;
    if (x.do === 'rough') return 'Sleep rough here';
    if (x.do === 'morning') return 'Morning: out and home';
    if (x.do === 'give') return `Give ${cap(S.v.door?.name ?? 'them')} ${money(m.amount)}`;
    if (x.do === 'refuse') return 'Shut the door';
    if (x.do === 'guard') return `${m.on ? 'Keep' : 'Hire'} ${String(m.who?.name ?? 'him').replace(/^Cousin /, '')} · ${m.days} days · ${money(m.price)}`;
    if (x.do === 'shop' || x.do === 'pack' || x.do === 'get') return `Buy ${moveWords(m)[0].replace(/ \$\d+$/, '')} · ${money(m.price)}`;
    return cap(c.label);
  }

  // ── its parts ──
  const dkey = k => h('kbd', { class: 'u-key' }, k);
  /** The picker on a card's second line (who it is done to, the cash): ‹ … ›, its ↑ ↓ said in its tooltip. */
  const picker = (label, title, fn) => h('span', { class: 'u-pick', role: 'button', tabindex: '-1', title, onclick: ev => { ev.stopPropagation(); fn(); } }, h('i', null, '‹'), label, h('i', null, '›'));
  const oddsEl = (pct, sure) => (sure ? h('span', { class: 'u-pill is-gain' }, 'sure') : h('span', { class: 'u-odds', title: `${pct} in 100 it works` }, h('span', { class: 'u-odds-bar' }, h('i', { style: `width:${pct}%` })), `${pct}%`));
  /** One of the three in front of you. */
  function dockCard(slot, compact) {
    const n = slot.n;
    const key = slot.keys.includes(S.sel) ? S.sel : slot.keys[0];
    const c = choiceOf(key);
    const on = !!c && S.sel === key;
    if (!c) {
      return h('div', { class: `u-card is-empty${compact ? ' is-row' : ''}`, 'aria-disabled': 'true', title: cap(slot.empty ?? '') },
        h('span', { class: 'u-card-main' }, dkey(String(n)), h('b', { class: 'u-card-t' }, compact ? '—' : cap(slot.empty ?? 'nothing'))));
    }
    let title = c.label;
    let name = '';
    let pay = null;
    let sub = [];
    let ic = 'cash';
    const x = c.choice;
    if (x.do === 'job') {
      const o = S.v.options.find(q => q.key === key);
      name = cfg.jobs[S.v.place]?.[o.id]?.label ?? o.label;
      pay = range(payOfPick(o));
      const who = targetOf(o);
      const many = (o.targets?.length ?? 0) > 1;
      const mood = who?.mood && who.mood !== 'calm' ? who.mood : null;
      const tw = trustOfPick(o);
      const reg = who ? (S.v.people ?? []).find(p => p.id === who.id)?.regular : null;
      // (leg 3, part E: a long name on the card is its first word, "Benny" for Benny Two-Coats, so the tags after it
      // stay on the card at 1280; the whole name in the tooltip and the People tab. Mr., Mrs. and Ms. keep their name)
      const nick = n => (n.length > 12 && !/^(Mr|Mrs|Ms|Dr)\.? /.test(n) && !/^an? /i.test(n) ? n.split(' ')[0] : n);
      const whoName = who ? `${cap(nick(personShort(who.name)))}${mood ? ` · ${cfg.moods[mood]}` : ''}` : null;
      sub = [
        who ? (many ? picker(whoName, `Who: ${o.targets.map(t => t.name).join(' · ')} (↑ ↓ or a click: the next)`, () => { S.sel = key; adjust(1); }) : h('span', { class: 'u-who', title: tw ? trustTitle({ ...tw, name: who.name }) : null }, whoName)) : null,
        oddsEl(o.odds, o.sure),
        o.sure ? null : h('span', { class: 'u-pill is-risk', title: `If it fails: ${o.ifFail}` }, `fail: ${o.ifFail}`),
        pressTag(o.pressure),
        trustMark(tw, { pay: tw?.withPay ?? 0, short: true }),
        reg ? h('span', { class: `rn-hooked${reg.hooked ? ' is-hooked' : ''}`, title: hookedText(cfg, reg) }, hookedShort(cfg, reg)) : null,
        tellEl(o.tellRisk, { short: true }),
        usesEl(o),
        o.oddsWhy?.length ? h('span', { class: 'u-dim' }, o.oddsWhy.join(', ')) : null,
      ];
      title = `${name}${who ? ` · ${who.name}` : ''}${o.tellRisk?.text ? `. ${cap(o.tellRisk.text)}` : ''}`;
      ic = o.sure ? 'check' : 'cash';
    } else if (x.do === 'card') {
      const k = (S.v.hand ?? []).find(q => q.key === key);
      const bins = k.street === 'bins';
      const best = bins ? k.finds[k.finds.length - 1] : null;
      name = cardName(k.id);
      pay = bins ? range([0, best.pay[1]]) : range(k.pay);
      sub = [k.with ? h('span', { class: 'u-who' }, cap(k.with)) : null, bins ? h('span', { class: 'u-dim' }, `${best.pct}% a find · ${k.left} left`) : oddsEl(k.odds, k.sure),
        bins || k.sure ? null : h('span', { class: 'u-pill is-risk' }, `fail: ${k.ifFail}`), k.uses ? h('span', { class: 'u-dim' }, `uses 1 · ${k.uses.left} left`) : null];
      title = k.label;
    } else if (x.do === 'out') {
      name = 'Step out';
      ic = 'walk';
      const max = c.takeOut?.max ?? 0;
      S.take = Math.min(S.take ?? takeFirst(S.v).take, max);
      const bump = (dn, ev) => { ev?.stopPropagation(); S.sel = key; S.take = Math.max(0, Math.min(max, S.take + dn)); picked(); paint(); };
      const tg = c.takeGoods ?? {};
      S.goodsTake = Object.fromEntries(Object.entries(tg).map(([g, r]) => [g, Math.max(r.min, Math.min(r.max, S.goodsTake?.[g] ?? r.default))]));
      const bumpG = (g, dn, ev) => { ev.stopPropagation(); S.sel = key; S.goodsTake = { ...S.goodsTake, [g]: Math.max(0, Math.min(tg[g].max, S.goodsTake[g] + dn)) }; picked(); paint(); };
      const btn = (t, fn, off, tip) => h('button', { type: 'button', class: 'u-step', disabled: off, title: tip, onclick: fn }, t);
      sub = max > 0 || Object.keys(tg).length ? [
        max > 0 ? h('span', { class: 'u-take', title: 'The cash you take out of the bank: ↑ ↓ a dollar, Shift ten' }, h('span', { class: 'u-dim' }, 'Take'),
          btn('−', ev => bump(-1, ev), !S.take, 'A dollar less (↓)'), h('b', { class: 'u-sign' }, money(S.take)), btn('+', ev => bump(1, ev), S.take >= max, 'A dollar more (↑)'),
          h('span', { class: 'u-dim' }, `of ${money(max)}`)) : null,
        ...Object.entries(tg).map(([g, r]) => h('span', { class: 'u-take', title: 'Goods from home you take: the rest stay safe at the crib' },
          btn('−', ev => bumpG(g, -1, ev), !S.goodsTake[g], 'One less'), h('b', null, `${S.goodsTake[g]}/${r.max} ${goodWord(g, 2)}`), btn('+', ev => bumpG(g, 1, ev), S.goodsTake[g] >= r.max, 'One more'))),
      ] : [h('span', { class: 'u-dim' }, 'nothing banked to take')];
      title = 'Step out into the trailer park with the cash and goods you choose: what you carry can be taken; banked cash cannot';
    } else if (x.do === 'buy') {
      const s = S.v.shop.find(q => q.item === x.item);
      name = `Buy the ${thingWord(s.label).replace(/^real /, '')}`;
      ic = 'star';
      pay = money(s.price);
      const others = slot.keys.length > 1 ? h('span', { class: 'u-dim' }, `↑ ↓ the other ${slot.keys.length === 2 ? 'one' : `${slot.keys.length - 1}`}`) : null;
      sub = [h('span', { class: 'u-dim' }, s.does), s.available ? null : h('span', { class: 'u-pill is-mute' }, `need ${money(s.price - S.v.banked)} more`), others];
      title = `${s.label}: ${s.does}. Bought from banked money.`;
    } else if (x.do === 'guard') {
      const w = moveWords(c);
      name = w[0];
      ic = 'homerisk';
      pay = c.on && !c.lastDay ? null : money(c.price);
      sub = [h('span', { class: 'u-dim' }, c.on ? `on your step · ${c.daysLeft} day${c.daysLeft === 1 ? '' : 's'} left` : `${c.days} days · watches your door`)];
      title = `${c.label}. ${w[2] ?? ''}`;
    } else if (x.do === 'give' || x.do === 'refuse') {
      const [t, small, cost] = tileWords(c);
      name = t;
      ic = 'person';
      pay = cost;
      sub = [h('span', { class: 'u-dim', title: small }, small)];
      title = `${t}: ${small}`;
    } else if (x.do === 'morning') {
      name = 'Morning';
      ic = 'home';
      sub = [h('span', { class: 'u-dim' }, 'out and home: the day is over')];
    } else {
      const w = moveWords(c);
      name = w[0];
      sub = [h('span', { class: 'u-dim' }, w[1] ?? '')];
    }
    // (at the door: stepping out past them shuts the door on them too; said in its name, so the Take keeps its room)
    if (x.do === 'out' && S.v.door) {
      name = 'Step out past them';
      title = `${title}. Stepping out past them shuts the door on them too`;
    }
    if (!c.available) sub.push(h('span', { class: 'u-pill is-mute u-why', title: c.why }, shortWhy(c)));
    // (leg 3, part E: a long name, "Collect a debt for the park manager", one size down and without its icon: whole at 1280)
    const long = String(name).length > 26;
    const main = h('span', { class: `u-card-main${long ? ' is-long' : ''}` }, dkey(String(n)), long ? null : icon(ic), h('b', { class: 'u-card-t', title: name }, name), pay ? h('span', { class: 'u-card-pay u-sign' }, pay) : null);
    return h('div', {
      class: `u-card${on ? ' is-on' : ''}${c.available ? '' : ' is-off'}${compact ? ' is-row' : ''}`, role: 'button', tabindex: '0', 'data-key': key, 'data-slot': String(n), title: c.available ? title : `${title}: ${c.why}`,
      onclick: () => pickOrGo(key, c.available),
    }, main, compact ? null : h('span', { class: 'u-card-sub' }, sub.filter(Boolean)));
  }
  /** A verb's small line: what it would do here, or why it cannot. */
  // (leg 3, part E: a verb's small line has the room of about fifteen letters at 1280 wide: what it would do in the
  // fewest words, the rest in its tooltip and its list. Cut off, "stack $26 · shir…", it said less than nothing)
  function verbSub(verb) {
    if (verb.why) return verbWhy(shortWhy({ why: verb.why }));
    const cs = verb.keys.map(choiceOf).filter(c => c?.available);
    const one = cs[0];
    if (!one) return '';
    if (verb.id === 'shop') {
      // (one thing: its last word and price, "pocket $40"; more: how many can be bought now, "8 you can buy")
      if (cs.length > 1) return `${cs.length} you can buy`;
      if (one.choice.do === 'buy') {
        const s = S.v.shop.find(q => q.item === one.choice.item);
        return `${thingWord(s?.label ?? '').split(' ').pop()} ${money(s?.price ?? 0)}`;
      }
      return one.choice.do === 'guard' ? `Earl ${money(one.price)}` : `${moveWords(one)[0].split(' ').slice(0, 2).join(' ').toLowerCase()}`;
    }
    if (verb.id === 'travel') {
      const ways = [...new Set(cs.map(c => (c.choice.do === 'subway' ? (c.choice.hop ? 'hop' : `subway ${money(c.fare ?? cfg.subway.fare)}`) : c.choice.do === 'onward' ? 'go on' : c.choice.do === 'tryout' ? 'try-out' : c.choice.do)))];
      return `${ways[0]}${ways.length > 1 ? ` +${ways.length - 1}` : ''}`;
    }
    if (verb.id === 'home') return one.choice.do === 'inside' ? (S.v.carried ? `bank ${money(S.v.carried)}` : 'go inside') : one.choice.do === 'subway' ? (one.choice.hop ? 'hop it' : `subway ${money(one.fare ?? cfg.subway.fare)}`) : one.choice.do === 'onward' ? 'go on home' : `${one.choice.do} home`;
    if (verb.id === 'sleep') return one.choice.do === 'rough' ? `${one.robbedPct}% robbed` : 'the day ends';
    if (verb.id === 'bins') return String(moveWords(one)[1] ?? '').split(' · ')[0];
    return moveWords(one)[1] ?? '';
  }
  /** A why for a verb's small line, shorter: "short: $20 banked" is "only $20 banked" (the whole why in its tooltip). */
  const verbWhy = w => String(w ?? '').replace(/^short: /, 'only ').replace(/^needs (a |the )?box cutter$/, 'no box cutter')
    .replace(/^go inside to sleep \(H\)$/, 'go in first: H').replace(/^needs (a|the) /, 'needs ');
  const VERB_ICON = { shop: 'shop', rob: 'rob', bins: 'bins', travel: 'train', home: 'home', sleep: 'moon' };
  function verbBtn(verb, compact) {
    const on = (verb.list && S.list === verb.id) || (!verb.list && verb.keys.includes(S.sel));
    const off = !!verb.why;
    const sub = verbSub(verb);
    return h('button', {
      type: 'button', class: `u-verb${on ? ' is-on' : ''}${off ? ' is-off' : ''}${verb.list ? ' has-list' : ''}`, 'data-verb': verb.id, 'aria-expanded': verb.list ? String(S.list === verb.id) : null,
      title: `${verb.label} (${verb.key})${sub ? `: ${sub}` : ''}`, onclick: () => (verb.list || !verb.keys.includes(S.sel) ? pickVerb(verb.id) : confirm()),
    }, icon(VERB_ICON[verb.id]), h('span', { class: 'u-verb-t' }, h('b', null, verb.label), compact ? null : h('small', null, sub)), dkey(verb.key));
  }
  /** Shop's or Travel's list, over its verb: each thing with its price or fare, what it does or risks, why not. */
  function listEl(d) {
    const verb = d.verbs.find(x => x.id === S.list);
    if (!verb) return null;
    const row = key => {
      const c = choiceOf(key);
      if (!c) return null;
      // (join-1: the try-out stop, marked, under a rule of its own: it is not a way of the rules')
      if (c.choice.do === 'tryout') {
        const r = tryoutRow();
        trip.prepare();
        return h('li', { class: 'u-li-tryout' }, h('button', {
          type: 'button', class: `u-li${S.sel === key ? ' is-on' : ''}`, 'data-key': key, title: `${c.label}: you pick a loadout and fight; nothing carries back to the run`,
          onclick: () => pickOrGo(key, true),
        }, h('span', { class: 'u-li-t' }, h('b', null, h('span', { class: 'u-pill u-trying' }, r.mark), ' ', r.name), h('small', null, r.small)), h('span', { class: 'u-sign u-li-p' }, 'free')));
      }
      const x = c.choice;
      let name = goWords(c).replace(/ · \$\d+$/, '');
      let price = c.price ?? c.fare ?? null;
      let small = '';
      if (x.do === 'buy') {
        const s = S.v.shop.find(q => q.item === x.item);
        name = thingWord(s.label);
        price = s.price;
        small = `${s.does} · from banked`;
      } else if (x.do === 'guard') {
        name = moveWords(c)[0];
        small = `${c.days} days on your step · from banked`;
      } else if (x.do === 'subway' || x.do === 'walk' || x.do === 'skate' || x.do === 'onward') {
        const w = moveWords(c);
        small = [x.do === 'subway' ? `1 hour · ${c.energy ?? cfg.energy.perHour} energy` : `${c.hours ?? 0} hour${c.hours === 1 ? '' : 's'} · ${c.energy} energy`, c.hop ? `${c.hop.caught}% seen: heat +${c.hop.heat}` : null, c.danger?.jump?.chance ? `${c.danger.jump.chance}% jumped on the way` : null].filter(Boolean).join(' · ') || w[1];
        if (x.do === 'subway' && x.hop) price = 0;
      } else if (x.do === 'get') {
        const t = thingOf(cfg, x.item) ?? {};
        const e = (S.v.errands ?? []).find(q => q.here && q.item === x.item);
        name = thingWord(t.label ?? x.item);
        small = [t.defends || t.kind === 'ride' ? t.does : t.desc, t.defends ? 'defends your crib' : t.kind === 'ride' ? null : 'looks only', e?.keeper ? cap(e.keeper.name) : null].filter(Boolean).join(' · ');
      } else if (x.do === 'pack') {
        name = `${cap(packWord(x.good))} of ${goodWord(x.good, 2)}`;
        small = `${c.sales} sales · ${cap(c.who?.name ?? '')}${c.left !== null && c.left !== undefined ? ` · ${c.left} left today` : ''}${c.off ? ` · ${money(c.off)} off: with you` : ''}`;
      } else if (x.do === 'shop') {
        const it = S.v.shopHere.find(q => q.item === x.item);
        name = thingWord(it?.label ?? x.item);
        small = `${it?.does ?? ''}${it?.left !== null && it?.left !== undefined ? ` · ${it.left} left today` : ''}`;
      } else {
        const w = moveWords(c);
        small = w[1] ?? '';
      }
      const on = S.sel === key;
      return h('li', null, h('button', {
        type: 'button', class: `u-li${on ? ' is-on' : ''}${c.available ? '' : ' is-off'}`, 'data-key': key, title: c.available ? c.label : `${c.label}: ${c.why}`,
        onclick: () => pickOrGo(key, c.available),
      }, h('span', { class: 'u-li-t' }, h('b', null, cap(name)), h('small', null, c.available ? small : shortWhy(c))), price !== null && price !== undefined ? h('span', { class: 'u-sign u-li-p' }, price ? money(price) : 'free') : null));
    };
    const box = h('div', { class: 'u-list u-panel', role: 'listbox', 'aria-label': verb.label, 'data-list': verb.id });
    // (leg 3: the things on a shelf here as tiles, after the rest: their picture, rarity and price; to wear, Try on)
    const gets = verb.id === 'shop' ? verb.keys.filter(k => choiceOf(k)?.choice.do === 'get') : [];
    box.classList.toggle('has-shelf', gets.length > 0);
    const rest = verb.keys.filter(k => !gets.includes(k));
    return fill(box,
      h('div', { class: 'u-list-head' }, icon(VERB_ICON[verb.id]), h('span', { class: 'u-cap' }, verb.id === 'shop' ? (S.v.place === 'crib' ? 'Bought at home, from banked money' : `Sold here · from what you carry (${money(S.v.carried)})`) : 'Ways from here'),
        h('span', { class: 'u-dim u-list-keys' }, '↑ ↓ · Enter · Esc')),
      rest.length ? h('ul', null, rest.map(row)) : null,
      gets.length ? shelfEl(gets, box) : null);
  }
  /**
   * THE SHELF HERE TODAY (ui-3, leg 3), in the shop's list: each thing on sale where you stand as its tile, its rarity
   * and its price; picked and bought as any line of the list (a click picks, again or Enter buys); a thing to wear can
   * be tried on from here. The Library (L) has every piece there is.
   */
  function shelfEl(keys, box) {
    const lib = new Map((S.v.library?.pieces ?? []).map(p => [p.key, p]));
    const cells = keys.map(key => {
      const c = choiceOf(key);
      const item = c.choice.item;
      const p = lib.get(item);
      const t = thingOf(cfg, item) ?? {};
      const name = p ? pieceName(p) : cap(thingWord(t.label ?? item));
      const tier = p?.tier ?? t.tier ?? 0;
      const tried = p?.kind === 'wear' && S.tried?.[p.slot] === item;
      const does = t.defends ? 'defends your crib' : t.kind === 'ride' ? 'a ride' : null;
      return h('div', { class: `u-shelf-cell${S.sel === key ? ' is-on' : ''}${c.available ? '' : ' is-off'}`, 'data-key': key },
        h('button', { type: 'button', class: 'u-shelf-pick', title: c.available ? `${name} · ${tierWord(tier)} · ${money(c.price ?? p?.price)}${does ? ` · ${does}` : ''}: Enter buys, from what you carry` : `${name}: ${c.why}`, onclick: () => pickOrGo(key, c.available) },
          h('span', { class: 'u-lib-pic' }, tiles.el(p?.piece ?? t.piece ?? item, { root: box, label: name })),
          h('b', { class: 'u-lib-name' }, name),
          h('span', { class: 'u-lib-meta' }, h('span', { class: `u-tier is-t${tier}` }, tierWord(tier)), h('span', { class: 'u-lib-price' }, money(c.price ?? p?.price ?? 0))),
          c.available ? (does ? h('small', { class: 'u-shelf-why' }, does) : null) : h('small', { class: 'u-shelf-why' }, shortWhy(c))),
        p?.kind === 'wear' ? h('button', { type: 'button', class: `u-btn is-quiet u-shelf-try${tried ? ' is-on' : ''}`, 'aria-pressed': String(tried), title: tried ? 'Take it off' : 'See it on you: nothing is bought', onclick: () => (tried ? takeOff(item) : tryOnKey(item)) }, icon('person'), tried ? 'Take off' : 'Try on') : null);
    });
    const kinds = keys.map(k => lib.get(choiceOf(k)?.choice.item)?.kind).filter(Boolean);
    const kind = kinds.includes('wear') ? 'wear' : kinds.includes('home') ? 'home' : 'wear';
    return h('div', { class: 'u-shelf' },
      h('div', { class: 'u-shelf-head' }, h('span', { class: 'u-cap' }, `On the shelf here today · ${keys.length}`),
        h('button', { type: 'button', class: 'u-btn is-quiet', title: 'Every piece there is, and where each is sold today (L)', onclick: () => libraryFrom(kind) }, icon('library'), 'Library', ukey('L'))),
      h('div', { class: 'u-shelf-grid' }, cells));
  }
  /** The Library from the shop's list: on what is on sale today, the list shut (the panel is where the list was). */
  function libraryFrom(kind) {
    S.list = null;
    S.sel = null;
    library.set({ kind, slot: 'all', cat: 'all', tier: 'all', show: 'today' });
    if (S.sheet !== 'library') openSheet('library');
    else paint();
  }
  /** The head row: the danger of one more hour here, what the place says, and when the next jobs come. */
  function dockHead(v, compactRow) {
    const next = v.place !== 'crib' && !v.route && cfg.places[v.place]?.jobs && v.options?.length ? h('span', { class: 'u-cap u-next', title: 'Each hour a place deals its safe job and two of the rest' }, `new jobs at ${hourWord(v.hour + 1)}`) : null;
    // (the header's first place is a slot: where and when when the composition puts them here, WHERE_IN_DOCK)
    return h('div', { class: 'u-dock-head' }, h('div', { class: 'u-dock-slot', 'data-slot': 'where' }, dockWhere(v)), meter.btn, h('div', { class: 'rn-said' }, saidEl(v)), compactRow ? null : next, foldBtn());
  }
  const foldBtn = () => {
    const small = dockSmall();
    return h('button', { type: 'button', class: 'u-x u-dock-fold', title: small ? 'Open the dock (F)' : 'Fold the dock to one row (F)', 'aria-expanded': String(!small), onclick: () => toggleBar() }, icon(small ? 'fold' : 'unfold'));
  };
  /** The dock is one row: the frame compact (I, or a scene playing), or folded on its own (F). */
  const dockSmall = () => compact() || barFolded();
  function goBtn(c) {
    const words = c ? (c.available ? goWords(c) : `Can't: ${shortWhy(c)}`) : 'Pick 1–3 or a verb';
    return h('button', { type: 'button', class: 'u-btn is-go u-go', disabled: !c?.available, title: c ? (c.available ? `${goWords(c)} (Enter)` : `${c.label}: ${c.why}`) : 'Pick one first: 1 to 3, or a verb', onclick: () => confirm() },
      h('span', { class: 'u-go-t' }, words), dkey('Enter'));
  }
  /** THE BAR at the bottom: while you choose, the dock (full, or one row); while an hour plays, one row with Skip. */
  function paintBar(v) {
    el.card.dataset.phase = S.phase;
    const choose = S.phase === 'choose';
    const small = dockSmall() || !choose;
    // (the stage measures the bar again when it changes its size on purpose: stage/index.js fitToPanels, inside.js freeRect)
    el.card.dataset.fit = small ? 'folded' : 'open';
    el.card.classList.toggle('is-folded', small);
    el.card.classList.toggle('u-dock', true);
    el.card.classList.toggle('is-playing', !choose);
    if (!choose) {
      const jail = v.place === 'jail' || S.taken === cfg.places.jail?.label;
      const held = S.phase === 'held' ? [h('span', { class: 'u-pill is-loss' }, jail || S.state.place === 'jail' ? 'Under arrest' : 'Hurt'), h('span', { class: 'u-dim' }, S.state.place === 'jail' ? 'Continue takes you to the jail.' : 'Continue takes you to the clinic.'),
        h('button', { type: 'button', class: 'u-btn is-go', onclick: () => S.onPress?.() }, 'Continue', dkey('Enter'))] : null;
      const skipBtn = S.phase === 'playing' ? h('button', { type: 'button', class: 'u-btn u-skip', title: 'End the scene now: what happened still shows (Space)', onclick: () => skip() }, 'Skip', dkey('Space')) : null;
      fill(cardBody, h('div', { class: 'u-dock-row is-playing' }, h('div', { class: 'u-dock-slot', 'data-slot': 'where' }, dockWhere(v, false)), meter.btn, h('div', { class: 'rn-said' }, saidEl(v)), held, skipBtn));
      fitRow();
      return;
    }
    const d = dockNow();
    if (S.list && !d.verbs.find(x => x.id === S.list)?.keys.length) S.list = null;
    const c = choiceOf(S.sel);
    if (small) {
      fill(cardBody, h('div', { class: 'u-dock-row' }, h('div', { class: 'u-dock-slot', 'data-slot': 'where' }, dockWhere(v, false)), meter.btn,
        h('div', { class: 'u-dock-cards is-row' }, d.cards.map(s => dockCard(s, true))),
        h('div', { class: 'u-dock-verbs is-row' }, d.verbs.map(x => verbBtn(x, true))),
        goBtn(c), foldBtn()), S.list ? listEl(d) : null);
    } else {
      fill(cardBody, dockHead(v),
        h('div', { class: 'u-dock-cards' }, d.cards.map(s => dockCard(s, false))),
        h('div', { class: 'u-dock-verbs' }, h('div', { class: 'u-verbs' }, d.verbs.slice(0, 1).map(x => verbBtn(x)), h('div', { class: 'u-street', role: 'group', 'aria-label': 'The street', title: 'The street: rob somebody passing (R), dig through the bins (X)' }, d.verbs.slice(1, 3).map(x => verbBtn(x))), d.verbs.slice(3).map(x => verbBtn(x))), goBtn(c)),
        S.list ? listEl(d) : null);
    }
    // (an open list sits over its verb)
    const list = cardBody.querySelector('.u-list');
    const at = list && cardBody.querySelector(`.u-verb[data-verb="${S.list}"]`);
    if (list && at) {
      const r = at.getBoundingClientRect();
      const box = el.card.getBoundingClientRect();
      list.style.left = `${Math.max(0, Math.min(box.width - list.offsetWidth, r.left - box.left))}px`;
      // (the picked line in sight: the list scrolls itself, nothing else moves)
      const on = list.querySelector('.u-li.is-on, .u-shelf-cell.is-on');
      if (on) {
        const top = on.offsetTop;
        const bottom = top + on.offsetHeight;
        if (bottom > list.clientHeight) list.scrollTop = bottom - list.clientHeight + 6;
      }
    }
    fitRow();
  }

  // ── choosing ────────────────────────────────────────────────────────────────────────────────────────────────────
  /** From a panel: a move picked on the bar (its key lit there), or, `go`, made at once (the Stuff panel's Buy). */
  function fromPanel(key, go) {
    if (S.phase !== 'choose') return;
    const c = S.v.choices.find(x => x.key === key);
    if (!c) return;
    S.sel = key;
    S.list = null;
    picked();
    if (go && c.available) return confirm();
    if (!c.available) toast(c.why);
    paint();
  }
  function pickOrGo(key, available) {
    if (S.phase !== 'choose') return;
    if (S.sel === key && available) return confirm();
    // (a thing of the open list keeps it open; anything else closes it)
    const inList = S.list && dockNow().verbs.find(x => x.id === S.list)?.keys.includes(key);
    pickKey(key, inList ? S.list : null);
  }
  function confirm() {
    if (S.phase !== 'choose' || !S.sel) return;
    // (join-1: the try-out stop: the page's side trip, nothing sent to the rules)
    if (isTryout(S.sel)) return void goTryout();
    const c = S.v.choices.find(x => x.key === S.sel);
    if (!c) return;
    if (!c.available) return toast(c.why);
    // (an option done to another of its targets than the one dealt names them: { do: 'job', id, who })
    const o = c.choice.do === 'job' ? S.v.options.find(x => x.key === c.key) : null;
    const who = o && targetIndex(o) ? targetOf(o)?.id : null;
    // (goods-1: a sale with another good than the one dealt names it: { do: 'job', id, good }; stepping out names the
    // goods taken: { do: 'out', take, goods })
    const g = o ? goodOfPick(o) : null;
    const good = g && g.good !== o.uses?.good ? g.good : null;
    send(c.choice.do === 'out' ? { ...c.choice, take: S.take, ...(S.goodsTake && Object.keys(S.goodsTake).length ? { goods: { ...S.goodsTake } } : {}) } : who || good ? { ...c.choice, ...(who ? { who } : {}), ...(good ? { good } : {}) } : c.choice);
  }
  // (ui-3: a word, not a loss: neutral; red is for what was lost, and that is the result card's)
  function toast(text) {
    const t = h('div', { class: 'hk-toast u-toast' }, text);
    el.toasts.append(t);
    setTimeout(() => t.remove(), 2400);
  }

  function onKey(e) {
    // (join-1: ON THE TRY-OUT the keys are the fight's, all of them: none of the run's does anything meanwhile)
    if (S.away) return;
    const was = arrange.active;
    if (arrange.onKey(e)) {
      // (V in or out: the dock's Arrange key lit or not)
      if (arrange.active !== was) Promise.resolve().then(() => setTimeout(() => !S.dead && paint(), 0));
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // ESC IS THE RUN'S, never the browser's: Chrome's own Esc stops a page that is still loading, and with the city's
    // live connections open that stopped every frame, the picture frozen and the next hour never played (found in leg 3
    // in headless Chrome, the same on 536dbb3 before it; the page's frames ran on once the default was cancelled)
    if (e.key === 'Escape') e.preventDefault();
    const mine = keyOf(e);
    // (once the kit's map is in the page, its own keys listen on the window after ours: a key that was ours goes no
    // further, nor B, the city's own key for its full-screen map. Its + − 0, W and the arrows still reach it)
    if (runMap.loaded && (mine || e.key === 'b' || e.key === 'B')) e.stopImmediatePropagation();
  }
  /** One key: true when it was the run's. */
  /**
   * THE KEYS (ui-3, leg 2), one meaning each, everywhere in the run:
   *   1 2 3 the things in front of you · B Shop · R Rob · X Bins · T Travel · H Home · Z Sleep (each picks; Enter does)
   *   ← → along the dock · ↑ ↓ what the picked thing is set to (Shift: ten dollars) · Enter does it · Esc closes · Space skips a scene
   *   C You · L Library · G Guide · O Stuff · M Map · V Arrange (at home) · K Home risk · J the journal · I the interface's size · F the dock to one row
   *   · N your numbers to one line
   *   W A S D are never the run's: they are kept for moving.
   */
  const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
  const VERB_KEYS = { B: 'shop', R: 'rob', X: 'bins', T: 'travel', H: 'home', Z: 'sleep' };
  function keyOf(e) {
    const k = e.key;
    const K = k.length === 1 ? k.toUpperCase() : k;
    if (k.length === 1 && 'WASD'.includes(K)) return false;
    // THE PANELS AND THE FRAME, in every phase: C G O M open one (again: close it), F folds the dock, I the frame's
    // size, J the journal, K the home risk slip (L is the Library's, leg 3)
    const sheet = SHEETS.find(s => s.key === K);
    if (sheet && k.length === 1) {
      e.preventDefault();
      openSheet(sheet.id);
      // (the Library opened from the keyboard: the arrows walk its grid, Enter keeps a piece on its card)
      if (S.sheet === 'library') library.focus();
      return true;
    }
    if (K === 'F') {
      e.preventDefault();
      toggleBar();
      return true;
    }
    // (N, your numbers folded to one line or opened: D's old job; D is kept for moving)
    if (K === 'N') {
      e.preventDefault();
      toggleDock();
      return true;
    }
    if (K === 'I') {
      e.preventDefault();
      cycleSize();
      return true;
    }
    if (K === 'J') {
      e.preventDefault();
      toggleJournal();
      return true;
    }
    if (K === 'K' && (S.hold?.v ?? S.v)?.pressure) {
      e.preventDefault();
      toggleHome();
      return true;
    }
    // ESC CLOSES one thing at a time: the open list, a card on the map, the panel, the home risk slip, the danger's
    // small print, the result card; then it lets go of what is picked
    if (k === 'Escape') {
      // (a try-on comes off first: what you really wear again; the list or panel it was tried from stays open)
      if (S.tried) return takeOff(), true;
      if (S.list) {
        S.list = null;
        S.sel = null;
        paint();
        return true;
      }
      if (S.sheet) {
        if (!(S.sheet === 'map' && runMap.closeOne())) openSheet(null);
        return true;
      }
      if (S.homeOpen) return toggleHome(false), true;
      if (S.dangerOpen && (S.v.danger.here || wayPicked(S.v))) {
        S.dangerOpen = false;
        paint();
        return true;
      }
      if (S.phase === 'choose' && cardUp()) return putAway(), true;
      if (S.phase === 'choose' && S.sel) {
        S.sel = null;
        paint();
        return true;
      }
      return false;
    }
    // ENTER: the card that holds the game (the night's report, Continue to the jail), or the picked thing
    if (S.onPress && k === 'Enter') {
      e.preventDefault();
      S.onPress();
      return true;
    }
    // SPACE SKIPS A SCENE, nothing else (what happened still shows on its card)
    if (k === ' ') {
      e.preventDefault();
      if (S.phase === 'playing' || S.opening) skip();
      return true;
    }
    // (a button reached with Tab takes Enter as its own click; a card reached with Tab, as a click on it. Focus left
    // by the mouse does not: Enter is the picked thing's)
    const f = document.activeElement;
    if (k === 'Enter' && f && f !== document.body && root.contains(f) && f.matches?.(':focus-visible')) {
      if (f.classList.contains('u-card') && f.dataset.key) {
        e.preventDefault();
        pickOrGo(f.dataset.key, !!choiceOf(f.dataset.key)?.available);
        return true;
      }
      if (f.tagName === 'BUTTON') return false;
    }
    if (S.phase !== 'choose') return false;
    // (the map panel's own arrows pan it; in the Library's grid they move along it: dock.js arrowsTo)
    const owner = ARROWS.has(k) || k === 'Home' || k === 'End' ? arrowsTo({ sheet: S.sheet, phase: S.phase, hold: !!S.hold }) : null;
    if (ARROWS.has(k) && owner === 'map') return false;
    if (owner === 'library') {
      // (join-1: the grid keeps them whenever the Library is open and the game is choosing: with the focus in it, its
      // own keys move; with the focus gone (a scene ended under it, the grid drawn again), into it and on)
      if (library.owns(document.activeElement)) return false;
      e.preventDefault();
      library.arrow(k);
      return true;
    }
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      e.preventDefault();
      moveSlot(k === 'ArrowRight' ? 1 : -1);
      return true;
    }
    if (k === 'ArrowUp' || k === 'ArrowDown') {
      e.preventDefault();
      adjust(k === 'ArrowUp' ? 1 : -1, e.shiftKey);
      return true;
    }
    if (k === 'Enter') {
      e.preventDefault();
      // (nothing picked: one way on only, the morning out of the jail or the clinic, goes; else the result card is put away)
      if (!S.sel) {
        const only = S.v.choices.filter(c => c.available);
        if (only.length === 1) S.sel = only[0].key;
        else if (cardUp()) return putAway(), true;
      }
      confirm();
      return true;
    }
    if (/^[1-3]$/.test(k)) {
      e.preventDefault();
      pickCard(Number(k));
      return true;
    }
    if (k.length === 1 && VERB_KEYS[K]) {
      e.preventDefault();
      pickVerb(VERB_KEYS[K]);
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
    // (home-1: an attempt on your crib in the night, Cousin Earl's last day or his going (save-1), one called off.
    // Somebody seen casing it is the morning's own scene and card, after this)
    // (save-1: Earl's last day and his going, by their own words; his going is the end of what was paid for, not a loss)
    const home = events.filter(e => (e.type === 'raid' && e.night) || e.type === 'calledOff' || e.type === 'guard').map(e => ({ text: e.text, bad: e.type === 'raid' && e.taken > 0, quiet: e.type === 'guard' }));
    return {
      day, where, banked: state.banked, night, door, drift, rough, carried: state.carried, home,
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
        r.door ? h('p', { class: 'rn-night is-door' }, r.door) : null,
        ...(r.home ?? []).map(l => h('p', { class: `rn-night${l.bad ? ' is-bad' : l.quiet ? ' is-trust' : ' is-door'}` }, l.text))),
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
    /** For the tools (save-1): whether this page saves, as of when (null: not yet; false: the browser refused), picked up or refused, the line said, the log's length. */
    get saved() {
      return { saving, at: S.saveAt, picked: !!pickedUp, refused, note: S.pageNote?.text ?? null, log: S.log.length, reportDue: !!S.reportDue, after: !!S.after };
    },
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
      S.card = null;
      S.rose = null;
      S.notice = null;
      S.dangerOpen = false;
      S.after = null;
      S.raidNote = null;
      S.pageNote = null;
      S.arrangeTries = 0;
      S.sel = wayOnKey(S.v);
      S.targets = {};
      S.goodPick = {};
      S.goodsTake = null;
      S.take = state.place === 'crib' ? takeFirst(S.v).take : null;
      // (save-1: the state handed over is the run now: saved, when this page saves)
      saveNow();
      dressYou();
      await dipped(() => playOn(placeLine(state), { instant: true }));
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
    /**
     * For the tools: the dock is always its rail now (ui-3); true folds your situation to one line and false opens it,
     * as N does; kept in this browser. → whether it is folded.
     */
    fold(on) {
      toggleDock(!!on);
      return isFolded('side');
    },
    /** For the tools (ui-3): the frame's size, 'full', 'compact' or 'hidden', as I does; kept in this browser. → the size now. */
    size(z = null) {
      if (SIZES.includes(z)) {
        S.size = z;
        kept.set('size', z);
        paint();
      }
      return sizeNow();
    },
    /** For the tools (ui-3): the result card now (news.js), whether it is up, and the journal's lines. */
    get news() {
      return { card: S.card, up: cardUp(), journal: S.journal.slice() };
    },
    /** For the tools: folds the bar to its one row (true) or opens it (false), as F would; kept in this browser. */
    bar(fold) {
      if (barFolded() !== !!fold) toggleBar(!!fold);
      return barFolded();
    },
    /** For the tools: the home pressure slip open (true) or folded, as L would (home-1). */
    home(on) {
      toggleHome(!!on);
      return !!S.homeOpen;
    },
    /** For the tools: an attempt settled while you were out, as if it had just happened (home-1): said at once, seen at home. */
    settled(raid) {
      S.after = raid;
      S.raidNote = raid;
      paint();
      return true;
    },
    /** For the tools: the danger's small print open (true) or folded, as a click on the number would. */
    print(on) {
      if (!!S.dangerOpen !== !!on && (S.v.danger.here || wayPicked(S.v))) togglePrint();
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
    /** For the tools (ui-3, leg 3): the Library (library.js: filter, set, shown, onCard, pin, focus). */
    get library() {
      return library;
    },
    /** For the tools (ui-3, leg 3): tries a piece on (its key), as the Library's Try on; null takes everything off. → what is tried */
    tryOn(key = null) {
      if (key) tryOnKey(String(key));
      else takeOff();
      return S.tried ? { ...S.tried } : null;
    },
    /** For the tools (ui-3, leg 3): the dock's list open ('shop', 'travel') or shut (null), as B or T. */
    list(id = null) {
      if (id) pickVerb(id);
      else if (S.list) {
        S.list = null;
        S.sel = null;
        paint();
      }
      return S.list ?? null;
    },
    /** For the tools (ui-3, leg 3): the tiles (tiles.js: el, warm, has, stats), and why none are drawn now (null: they can be). */
    get tiles() {
      return tiles;
    },
    get tilesWait() {
      return busyWhy();
    },
    /** For the tools (ui-3, leg 2): the rules' key of the picked choice, or null. */
    get sel() {
      return S.sel ?? null;
    },
    /** For the tools (ui-3, leg 2): the dock now (dock.js: the three cards and the six verbs, each with its choice keys). */
    get dock() {
      return dockNow();
    },
    /** For the tools (ui-3, leg 2): the page's key that reaches a rules' choice key: '1' to '3' or a verb's letter; null when it is not on the dock. */
    keyFor(key) {
      return keyFor(String(key));
    },
    /** For the tools: picks a choice by its rules' key (as the dock would: its card, or its verb and its line in the list); Enter then does it. */
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
    /** For the tools (join-1): the try-out stop's side trip (trip.js: go, back, active, busy, fight, log). */
    get trip() {
      return trip;
    },
    /** For the tools (join-1): takes the try-out stop now, as its line of Travel's list would. → whether it went */
    tryout: () => goTryout(),
    /** For the tools (join-1): whether the run is away on the try-out (its frame put away, its keys aside). */
    get away() {
      return !!S.away;
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
