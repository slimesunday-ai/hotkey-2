// THE TILES (ui-3 leg 3, part B): any piece's picture, from the model the game itself draws, for the run's lists: the
// Library, the shop's shelf, the wardrobe, the home tray. Drawn by lib-1's renderer, demo/tools/item-tiles.js (modelOf →
// alone / worn → picture), not by a second one. Shown at 64 px and rendered at 128 for 2× screens: the item alone, its
// 1 px ink outline (item-tiles.js outline), on bone (the tile's own background, ui.css .u-tile); tops, caps and eyewear
// from the lower 12° camera (item-tiles.js lowFor). A worn picture, the player wearing the piece, is the larger preview
// of a piece to wear (the Library's card).
//
// WHEN ONE IS DRAWN: only a tile in sight (an IntersectionObserver for each scrolling box it lies in), one at a time in
// the page's idle time, the one most recently scrolled to first; a tile scrolled away before its turn leaves the queue.
// Each picture is drawn once per piece and kept, as an object URL, for the life of the page. WHILE A SCENE PLAYS
// (busy()) NOTHING IS DRAWN: the queue waits for the next choice, so a scene never waits on a tile.
// THE WEBGL CONTEXT: item-tiles.js's own small one (its stage(): 256 px square at most, alpha, the city's icon light),
// made the first time a tile is wanted. Not the city's renderer (its state, its shadows and its frame are the scene's)
// and not the portrait's (kept private inside city/from-trunk/style/city/ui/portrait.js, which this repo never edits):
// one small context more, and only once a list asks for a picture.
//
//   const tiles = createTiles({ busy })                 demo/run/index.js
//   tiles.el(piece, { how, slot, size, root, label })   → <span class="u-tile"> whose <img> is filled once drawn
//                                                         how: 'alone' | 'worn' (slot: the run's slot it is worn in)
//                                                         root: the scrolling box it lies in (null: the window)
//   tiles.warm()   the module, the kit and the renderer, at idle (nothing drawn)
//   tiles.stats    { drawn, failed, ms: [per tile], warmMs, firstMs, queued, busySkips }
import { h } from '../hud/dom.js';

const TOOL = new URL('../tools/item-tiles.js', import.meta.url).href;
/** The size a tile is shown at, and the factor it is rendered at (2: for 2× screens). */
export const TILE = 64;
export const RENDER = 2;
/** The supersampling inside a render (item-tiles.js picture `ss`): 2, as tiles.md measured for the game. */
const SS = 2;
/** How long a tile in sight waits for a frame with the room for it before it is drawn anyway (ms; never in a scene). */
const OVERDUE = 90;

const now = () => performance.now();
const idle = (f, timeout) => (typeof requestIdleCallback === 'function'
  ? requestIdleCallback(f, { timeout })
  : setTimeout(() => f({ didTimeout: true, timeRemaining: () => 0 }), 50));
const median = a => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);

export function createTiles({ busy = () => false } = {}) {
  let M = null;          // demo/tools/item-tiles.js
  let K = null;          // its kit: the city's cast, the home kit, the props
  let loading = null;
  const done = new Map();       // id → object URL, or '' (the piece draws nothing)
  const spec = new Map();       // id → { piece, how, slot, px }
  const queue = [];             // ids wanted, the most recent last
  const watching = new Map();   // box → id, while not drawn
  const ios = new Map();        // scrolling box (or null) → IntersectionObserver
  const seenOnce = new Set();   // pieces once in sight and not drawn yet: a box made again for one (a list redrawn) is wanted at once
  const stats = { drawn: 0, failed: 0, ms: [], warmMs: null, firstMs: null, busySkips: 0, error: null, get queued() { return queue.length; }, get pumping() { return pumping; }, get boxes() { return watching.size; } };
  let pumping = false;
  let lastDraw = 0;
  const t0 = now();

  const idOf = (piece, how, px) => `${piece}|${how}|${px}`;

  /** The module, its kit and the renderer: once, on the first tile wanted (or at idle, warm()). */
  function load() {
    loading ??= (async () => {
      const a = now();
      const mod = await import(TOOL);
      K = await mod.kit();
      stats.importMs = Math.round(now() - a);
      // (the renderer, then its shaders compiled, each after a frame of its own)
      await new Promise(r => requestAnimationFrame(() => r()));
      const b = now();
      mod.stage();
      stats.stageMs = Math.round(now() - b);
      await new Promise(r => requestAnimationFrame(() => r()));
      stats.compileMs = Math.round(await mod.warm(K));
      M = mod;
      stats.warmMs = Math.round(now() - a);
    })().catch(err => {
      console.warn('[tiles] the renderer could not start:', err);
      M = null;
    });
    return loading;
  }

  function observerOf(root) {
    if (ios.has(root)) return ios.get(root);
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const id = watching.get(e.target);
        // (a box taken out of the page, its list redrawn: let go of; its piece stays wanted, the new box shows it)
        if (!e.target.isConnected || id === undefined) {
          io.unobserve(e.target);
          watching.delete(e.target);
          continue;
        }
        e.target.dataset.seen = e.isIntersecting ? '1' : '0';
        if (e.isIntersecting) want(id);
        else drop(id);
      }
    }, { root, rootMargin: '96px 0px' });
    ios.set(root, io);
    return io;
  }
  /** In sight: to the head of the queue. */
  function want(id) {
    if (done.has(id)) return fillAll(id);
    seenOnce.add(id);
    const i = queue.indexOf(id);
    if (i >= 0) queue.splice(i, 1);
    queue.push(id);
    pump();
  }
  /** Scrolled out of sight before its turn: out of the queue (unless another box with it is still in sight). */
  function drop(id) {
    for (const [box, b] of watching) if (b === id && box.isConnected && box.dataset.seen === '1') return;
    seenOnce.delete(id);
    const i = queue.indexOf(id);
    if (i >= 0) queue.splice(i, 1);
  }
  /** Whether any box in the page shows a piece (a piece nobody shows any more is not drawn). */
  function shown(id) {
    for (const [box, b] of watching) if (b === id && box.isConnected) return true;
    return false;
  }

  function pump() {
    if (pumping || !queue.length) return;
    pumping = true;
    idle(deadline => work(deadline).catch(err => {
      // (whatever went wrong with one piece, the queue goes on: a stuck pump would leave every list blank)
      stats.error = String(err?.message ?? err);
      console.warn('[tiles]', err);
      pumping = false;
      setTimeout(pump, 200);
    }), 600);
  }
  async function work(deadline) {
    pumping = false;
    if (!queue.length) return;
    if (busy()) {
      stats.busySkips += 1;
      setTimeout(pump, 350);
      return;
    }
    if (!M) {
      await load();
      if (M) pump();
      return;
    }
    // one at a time while the frame has the room for one (the tiles so far say how long one takes); when no frame has
    // had the room for a while, one anyway: outside a scene the city only idles, and a list should not wait on it
    const est = Math.max(4, (median(stats.ms) ?? 10) + 1);
    let n = 0;
    sweep();
    while (queue.length && !busy()) {
      // (one nobody shows any more, a list redrawn before its turn: passed over, at no cost)
      if (!shown(queue[queue.length - 1])) {
        queue.pop();
        continue;
      }
      const room = deadline.timeRemaining() > est;
      if (!room && !(n === 0 && (deadline.didTimeout || now() - lastDraw > OVERDUE))) break;
      draw(queue.pop());
      lastDraw = now();
      n += 1;
    }
    pump();
  }

  /** Boxes no longer in the page: let go of (a list redrawn, the card's picture replaced). */
  function sweep() {
    for (const box of watching.keys()) {
      if (box.isConnected) continue;
      watching.delete(box);
      for (const io of ios.values()) io.unobserve(box);
    }
    // (and the observer of a scrolling box no longer in the page: the shop's list and the tray are made anew each time)
    for (const [r, io] of ios) {
      if (!r || r.isConnected) continue;
      io.disconnect();
      ios.delete(r);
    }
  }
  function draw(id) {
    const s = spec.get(id);
    if (!s || done.has(id)) return;
    const a = now();
    let pic = null;
    try {
      const model = M.modelOf(K, s.piece);
      const sub = s.how === 'worn' ? M.worn(K, model, s.slot) : M.alone(K, model);
      if (sub) {
        pic = M.picture(sub, s.px, { ss: SS, ink: true });
        if (s.how === 'worn') K.CH.dispose(sub.group);
        else if (!sub.keepGeo) sub.group.traverse(n => n.geometry?.dispose?.());
      }
    } catch (err) {
      console.warn(`[tiles] ${s.piece}:`, err);
      pic = null;
    }
    const ms = now() - a;
    stats.ms.push(+ms.toFixed(2));
    if (!pic) {
      stats.failed += 1;
      done.set(id, '');
      return fillAll(id);
    }
    stats.drawn += 1;
    stats.firstMs ??= Math.round(now() - t0);
    done.set(id, null);   // (drawn; its URL comes with the blob)
    pic.toBlob(b => {
      done.set(id, b ? URL.createObjectURL(b) : pic.toDataURL('image/png'));
      fillAll(id);
    }, 'image/png');
  }

  /** Every box of a piece drawn: its picture (or its blank). */
  function fillAll(id) {
    const url = done.get(id);
    if (url === null || url === undefined) return;
    for (const [box, b] of watching) {
      if (b !== id) continue;
      paintBox(box, url);
      watching.delete(box);
      for (const io of ios.values()) io.unobserve(box);
    }
  }
  function paintBox(box, url) {
    box.classList.remove('is-wait');
    if (url) box.firstChild.src = url;
    else box.classList.add('is-none');
  }

  return {
    /** A tile of `piece` (a key of the library's pieces' `piece`: 'hat:id', 'kit:id', 'board:pink'…). */
    el(piece, { how = 'alone', slot = null, size = TILE, root = null, label = '' } = {}) {
      const px = size * RENDER;
      const id = idOf(piece, how, px);
      if (!spec.has(id)) spec.set(id, { piece, how, slot, px });
      const img = h('img', { alt: label, width: size, height: size, decoding: 'async', draggable: 'false' });
      const box = h('span', { class: 'u-tile is-wait', 'data-tile': id, style: `--u-tile-s:${size}px`, 'aria-hidden': label ? null : 'true' }, img);
      const url = done.get(id);
      if (url !== undefined && url !== null) paintBox(box, url);
      else {
        // (a box is in sight once the observer says so: its `seen` keeps another box of the same piece from dropping it.
        // A piece already in sight in a box this one replaces, its list redrawn while the queue waited, stays wanted)
        watching.set(box, id);
        observerOf(root).observe(box);
        if (seenOnce.has(id)) {
          box.dataset.seen = '1';
          queueMicrotask(() => want(id));
        }
      }
      return box;
    },
    /** The module, the kit and the renderer, made at idle (outside a scene) so the first list does not wait for them. */
    warm() {
      if (loading) return loading;
      return new Promise(resolve => idle(() => (busy() ? setTimeout(() => resolve(this.warm()), 1000) : resolve(load())), 2000));
    },
    /** Whether a piece's picture is drawn (or known to be blank). */
    has: (piece, how = 'alone', size = TILE) => {
      const u = done.get(idOf(piece, how, size * RENDER));
      return u !== undefined && u !== null;
    },
    stats,
  };
}
