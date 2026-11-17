// ARRANGE MODE AT THE CRIB (the owner, 2026-11-13: "people should be allowed to arrange things with a starter pack, we
// have a whole home builder we should bring that in"). At the crib, between choices, V (or Arrange with the panel keys
// on the dock, shown only at the crib: index.js arrangeKey) and the
// player arranges their own trailer in the inside view as it stands: click a thing to pick it up, click a lit spot to
// put it down (or press, drag and let go), R turns what you hold, X (or Delete) puts it away in the tray, a thing in
// the tray is clicked to take it out again, Z undoes (Shift+Z redoes), Esc puts back what you hold and then is done.
// While arranging no hour passes and the game's choices are set aside: the bar is the arrange bar (what the keys and
// clicks do, what you hold, the tray), the dock and the top line are dimmed and do nothing, the panels are shut; the
// camera is the inside view's own whole-room frame, never moved (the panels' boxes keep their places, so it is not
// framed again). What is valid, what moves and what stays: demo/stage/set/arrange.js.
//
// KEPT FOR THE RUN: in this browser, per seed and crib arrangement (localStorage `hk2.run.arrange.<a|b>.<seed>`), from
// every change; an untouched trailer keeps nothing; a reload of the same run (its seed) builds the room as arranged;
// New run forgets it (forget). `&arrange=<record JSON>` in the URL starts the run with that arrangement (the tools).
// Desktop only: it needs a mouse (a phone's layout is not in this job).
//
//   const arrange = createArrangeMode({ stage, root, pad, seed, can, tile })   demo/run/index.js
//   (tile(piece, opts): ui-3 leg 3, the tray's pieces as their tiles, demo/run/tiles.js; without it, words only)
//   arrange.onKey(e) → true when the key was arrange's (the page's own keys do nothing while arranging)
//   arrange.button() → an Arrange move (the dock's key is index.js arrangeKey) · arrange.movesEl(v) → its line in All moves
//   arrange.whyNot() → why it cannot start now, or null
//   arrange.forget(seed) · arrange.active
import { h, fill } from '../hud/dom.js';
// (ui-3, leg 3: the tray as tiles; a wall piece marked by the frame, as in the Library)
import { icon } from './icons.js';
import { placeOfPiece } from './catalog.js';

const KEY = 'V';
const kbd = k => h('kbd', null, k);
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  del(k) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};
const VARIANT = (new URLSearchParams(location.search).get('crib') ?? 'a').toLowerCase() === 'b' ? 'b' : 'a';
const keyFor = seed => `hk2.run.arrange.${VARIANT}.${seed}`;

export function createArrangeMode({ stage, root, pad, seed, can, tile = null }) {
  let arr = null;
  // (the last piece of the tray that could not come out, and why: said on it until another is tried)
  let refused = null;
  let active = false;
  let loaded = false;
  let bar = null;
  let said = null;
  let saidT = 0;
  let pointed = null;
  let press = null;

  // ── the stage's arrangement of the run's pad (set/arrange.js), once its place is there; the kept one read back
  (async () => {
    for (let k = 0; k < 400 && !arr; k++) {
      arr = stage.inside?.place?.(pad)?.arrange ?? null;
      if (!arr) await new Promise(r => setTimeout(r, 250));
    }
    if (!arr) return console.warn('[arrange] the crib has no arrangement to give');
    await arr.ready();
    const Q = new URLSearchParams(location.search);
    if (Q.get('arrange')) store.set(keyFor(seed()), Q.get('arrange'));
    const text = store.get(keyFor(seed()));
    if (text) {
      let rec = null;
      try {
        rec = JSON.parse(text);
      } catch {}
      const r = await arr.load(rec);
      // (kept as it is: the next change writes over it)
      if (!r.ok) console.info(`[arrange] the kept arrangement was not used (${r.why}): the starter's own`);
    }
    loaded = true;
    arr.onChange(() => {
      keep();
      if (active) paint();
    });
  })().catch(err => console.warn('[arrange]', err));
  /** Keeps the arrangement for this run (nothing when untouched). */
  function keep() {
    if (!loaded || !arr) return;
    const rec = arr.record();
    if (rec) store.set(keyFor(seed()), JSON.stringify(rec));
    else store.del(keyFor(seed()));
  }

  /** Whether arranging can start now, and why not. */
  function why() {
    if (!arr) return 'the trailer is not ready yet';
    if (!can()) return 'only at the crib, between choices';
    if (stage.inside?.up !== pad) return 'only in the trailer';
    return null;
  }

  // ── IN AND OUT
  function enter() {
    if (active || why()) return false;
    if (!arr.enter()) return false;
    active = true;
    root.classList.add('is-arranging');
    bar = h('section', { class: 'rn-arrange', role: 'toolbar', 'aria-label': 'Arrange your trailer' });
    root.append(bar);
    said = null;
    paint();
    addEventListener('pointerdown', onDown, true);
    addEventListener('pointermove', onMove, true);
    addEventListener('pointerup', onUp, true);
    return true;
  }
  async function leave() {
    if (!active) return;
    active = false;
    removeEventListener('pointerdown', onDown, true);
    removeEventListener('pointermove', onMove, true);
    removeEventListener('pointerup', onUp, true);
    press = null;
    document.body.style.cursor = '';
    await arr.leave();
    bar?.remove();
    bar = null;
    root.classList.remove('is-arranging');
    keep();
  }
  const say = text => {
    said = text;
    saidT = performance.now();
    if (active) paint();
  };

  // ── THE BAR WHILE ARRANGING: in the bar's own place, the page's paper. What the keys and clicks do, what you hold or
  // point at, the tray
  function statusText() {
    const held = arr.held;
    if (said && performance.now() - saidT < 4500) return said;
    if (held?.refused) return `${cap(held.name)} can't hang there: ${held.refused}.`;
    if (held) return `Holding ${held.name}: ${held.spots} spot${held.spots === 1 ? '' : 's'} fit${held.spots === 1 ? 's' : ''}, lit ${held.wall ? 'on the walls' : 'on the floor'}. Click one to ${held.wall ? 'hang it' : 'put it down'}.`;
    if (pointed) return pointed.fixed ? `${cap(pointed.name)}: ${pointed.fixed}.` : `${cap(pointed.name)}: click to pick it up.`;
    return 'Point at one of your things. No hour passes while you arrange.';
  }
  function paint() {
    if (!bar) return;
    const held = arr.held;
    const tray = arr.tray();
    const btn = (label, k, fn, { off = false, title = '' } = {}) => h('button', { type: 'button', class: 'k-btn rn-ar-btn', disabled: off, title, onclick: fn }, label, kbd(k));
    // THE TRAY (leg 3): each piece as its tile (what the game draws), a wall piece marked, and why it could not come out
    const trayEl = h('div', { class: `rn-ar-tray${tile ? ' has-tiles' : ''}`, 'aria-label': 'The tray' });
    const chip = t => {
      const wall = placeOfPiece({ key: `kit:${t.id}` }) === 'wall';
      const on = held?.key === t.key;
      const why = on && held?.refused ? held.refused : refused?.key === t.key ? refused.why : null;
      const name = cap(t.name.replace(/^the /, ''));
      return h('button', {
        type: 'button', class: `k-btn rn-ar-chip${tile ? ' u-ar-tile' : ''}${on ? ' is-on' : ''}${wall ? ' is-wall' : ''}`, 'data-key': t.key,
        title: `Take ${t.name} out: then click a lit spot${wall ? ' on one of the walls' : ''}${why ? `. ${cap(why)}` : ''}`,
        onclick: () => act(() => arr.takeOut(t.key)).then(r => {
          refused = r && r.ok === false && r.why ? { key: t.key, why: r.why } : null;
          if (active) paint();
        }),
      }, tile ? tile(`kit:${t.id}`, { label: name, root: trayEl }) : null,
      h('span', { class: 'u-ar-name' }, name),
      wall ? h('span', { class: 'u-ar-wall' }, icon('frame'), 'wall') : null,
      why ? h('small', { class: 'u-ar-why' }, why) : null);
    };
    fill(trayEl, h('span', { class: 'rn-ar-tray-h' }, 'Tray'),
      tray.length ? tray.map(chip) : h('em', { class: 'rn-ar-none' }, held ? 'empty · Delete puts what you hold in here' : 'empty · what you put away waits here'));
    fill(bar,
      h('div', { class: 'rn-ar-head' },
        h('b', { class: 'rn-ar-title' }, 'Arrange'), h('span', { class: 'rn-ar-sub' }, 'your trailer'),
        h('span', { class: 'rn-ar-status', role: 'status', 'aria-live': 'polite' }, statusText()),
        // (ui-3, leg 2: one key one meaning in the whole run: R, X and Z are the dock's, so arranging turns with E, puts
        // away with Delete and undoes with Ctrl+Z, as an editor does)
        btn('Turn', 'E', () => act(() => arr.turn()), { off: !held, title: 'Turn what you hold a quarter (E)' }),
        btn('Put away', 'Del', () => act(() => arr.putAway(held ? null : pointed?.key ?? null)), { off: !held, title: 'Put what you hold in the tray (Delete or Backspace)' }),
        btn('Undo', 'Ctrl Z', () => act(() => arr.undo().then(w => (w ? say(`Undone: ${w}.`) : null))), { off: !arr.canUndo && !held, title: 'Undo the last change (Ctrl+Z or ⌘Z; with Shift it redoes)' }),
        h('button', { type: 'button', class: 'k-btn is-primary rn-ar-done', title: 'Done arranging (Esc or V)', onclick: () => leave() }, 'Done', kbd('Esc'))),
      h('p', { class: 'rn-ar-keys' },
        h('span', null, h('b', null, 'Click'), ' a thing to pick it up'), h('span', null, h('b', null, 'click'), ' a lit spot to put it down'),
        h('span', null, kbd('E'), ' turn'), h('span', null, kbd('Del'), ' put away'), h('span', null, kbd('Ctrl Z'), ' undo'), h('span', null, kbd('Esc'), held ? ' put it back' : ' done')),
      trayEl);
  }
  /** Does one thing of arrange's and says why not when it cannot. */
  async function act(fn) {
    const r = await fn();
    if (r && r.ok === false && r.why) say(`${cap(r.why)}.`);
    else if (active) paint();
    return r;
  }

  // ── THE POINTER over the picture: a press on it is arrange's (it never turns the camera nor picks a person)
  const onCanvas = e => e.target?.tagName === 'CANVAS';
  function onDown(e) {
    if (!active || !onCanvas(e) || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    if (arr.held) {
      arr.aimAt(e.clientX, e.clientY);
      press = { kind: 'place', x: e.clientX, y: e.clientY };
      return;
    }
    const r = arr.pickAt(e.clientX, e.clientY);
    if (r.ok) {
      press = { kind: 'grab', x: e.clientX, y: e.clientY };
      said = null;
      paint();
    } else if (r.why) say(`${cap(r.why)}.`);
  }
  function onMove(e) {
    if (!active) return;
    if (arr.held) {
      if (onCanvas(e) || press) arr.aimAt(e.clientX, e.clientY);
      document.body.style.cursor = onCanvas(e) ? 'grabbing' : '';
      return;
    }
    if (!onCanvas(e)) return;
    const was = pointed?.key ?? null;
    pointed = arr.hover(e.clientX, e.clientY);
    document.body.style.cursor = pointed ? (pointed.fixed ? 'not-allowed' : 'grab') : '';
    if ((pointed?.key ?? null) !== was) paint();
  }
  function onUp(e) {
    if (!active || !press || e.button !== 0) return;
    const p = press;
    press = null;
    e.stopPropagation();
    const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6;
    // (a click picked it up: it follows the pointer until the next click; a press, drag and release puts it down)
    if (p.kind === 'grab' && !moved) return;
    arr.aimAt(e.clientX, e.clientY);
    act(() => arr.drop());
  }

  // ── THE KEYS: while arranging every key is arrange's
  function onKey(e) {
    const k = e.key;
    if (!active) {
      if ((k === 'v' || k === 'V') && !e.metaKey && !e.ctrlKey && !e.altKey && !why()) {
        e.preventDefault();
        enter();
        return true;
      }
      return false;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName ?? '')) return true;
    const mod = e.metaKey || e.ctrlKey;
    if (k === 'Escape') {
      if (arr.held) act(() => arr.cancel());
      else leave();
    } else if (k === 'v' || k === 'V') leave();
    else if (k === 'Enter') {
      if (arr.held) act(() => arr.drop());
      else leave();
    } else if (k === 'e' || k === 'E') act(() => arr.turn());
    else if (k === 'Delete' || k === 'Backspace') act(() => arr.putAway(arr.held ? null : pointed?.key ?? null));
    else if (mod && (k === 'z' || k === 'Z') && e.shiftKey) act(() => arr.redo().then(w => (w ? say(`Done again: ${w}.`) : null)));
    else if (mod && (k === 'z' || k === 'Z')) act(() => arr.undo().then(w => say(w ? `Undone: ${w}.` : 'Nothing to undo.')));
    else if (mod && (k === 'y' || k === 'Y')) act(() => arr.redo());
    return true;
  }

  return {
    get active() {
      return active;
    },
    onKey,
    enter,
    leave,
    /** Why arranging cannot start now (null: it can): for the dock's Arrange key (index.js arrangeKey). */
    whyNot: () => why(),
    /** The bar's Arrange move at the crib (beside stepping out and sleep). */
    button() {
      const no = why();
      return h('button', { type: 'button', class: `hk-move rn-move rn-arrange-move${no ? ' is-off' : ''}`, 'data-do': 'arrange', title: no ? `Arrange your trailer: ${no}` : 'Arrange your trailer: move your things, turn them, put them away. No hour (V)', onclick: () => enter() },
        kbd(KEY), h('span', { class: 'hk-move-text' }, h('b', null, 'Arrange')));
    },
    /** Its line in the Guide (G). */
    movesEl() {
      const no = why();
      return h('section', { class: 'rn-sec' }, h('h3', { class: 'rn-sec-h' }, 'Your trailer'),
        h('ul', { class: 'rn-jobs' }, h('li', { class: `rn-job rn-way${no ? '' : ' is-dealt'}` },
          h('div', { class: 'rn-job-head' }, h('b', null, 'Arrange'), h('span', { class: 'rn-pay' }, 'no hour')),
          h('div', { class: 'rn-job-odds' }, h('span', null, 'At the crib: pick up your things and put them where they fit (lit), turn them (E), put them away in the tray (Delete) and take them out again; Ctrl+Z undoes, Esc is done. Only what you own. Kept for the run.'),
            no ? h('span', { class: 'hk-tag is-why' }, no) : h('span', { class: 'rn-ontable' }, 'now', kbd(KEY))))));
    },
    /** A new run starts from the trailer as it comes. */
    forget(s) {
      store.del(keyFor(s));
    },
  };
}
