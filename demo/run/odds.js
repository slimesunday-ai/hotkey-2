// THE FIGHT ODDS IN THE BACKGROUND (smooth-1, docs/perf/2026-11-18-audit.md fix 1 and 3). The rules print odds from
// samples of fights (src/run/odds.mjs): 3,000 fights for getting jumped, a few hundred for a card's fight, the door
// fight, the advice after a loss, the Ahead screen's tables. Played on the page's thread they froze it for up to a
// second. Here the page says it wants them in the background: a count the rules ask for and do not have is asked of a
// few module workers (odds-worker.js, the same tallyFights), and the figure built on it is NaN until it is kept; the
// worker's count is then kept by its key and whoever drew a figure too early is told (`onKept`) and draws it again.
// The step is always exact (`exactly`): what happens never waits on, nor depends on, the background.
// With no worker (one would not start, or failed), the same counts are played in idle slices of at most a few ms.
//
//   const odds = createOdds({ onKept })
//   odds.collect(fn) → { value, missing }   fn() and the counts it asked for that are not kept yet
//   odds.settle(fn) → Promise of fn()'s value once nothing it asks for is missing (the pilot, the advice, Ahead)
//   odds.whenKept(keys) → Promise   odds.exactly(fn)   odds.busy() → counts asked and not yet kept
//   odds.hold(on)   for the tools only (run-odds.mjs): nothing more is handed out while on, so a check can see and
//                   press what a player sees while a figure is still being worked out
//   pendingIn(x) → is a figure of x still waiting (a NaN, or words with NaN in them)
//   watchPending(node) → { seen } the "…" where a figure waits, in every word drawn under `node`; `seen` counts them
import { deferTallies, keepTally, hasTally, collecting, exactly, tallyRange, emptyTally } from '../../src/run/odds.mjs';

/** Is anything in `x` (a view, a card, a figure) still waiting for its count: a NaN, or words with NaN in them? */
export function pendingIn(x, depth = 0) {
  if (typeof x === 'number') return Number.isNaN(x);
  if (typeof x === 'string') return x.includes('NaN');
  if (!x || typeof x !== 'object' || depth > 12) return false;
  if (Array.isArray(x)) return x.some(y => pendingIn(y, depth + 1));
  for (const k in x) if (pendingIn(x[k], depth + 1)) return true;
  return false;
}

export function createOdds({ onKept = () => {}, workers = 3 } = {}) {
  const queue = new Map(); // key → job, asked and not yet given to a worker (in the order asked)
  const running = new Map(); // key → the worker (or 'idle') playing it
  const waiters = new Set(); // { keys: Set, resolve }
  const pool = [];
  const errors = [];
  let keptT = null;
  let held = false;

  // ── the workers ────────────────────────────────────────────────────────────────────────────────────────────────
  function start() {
    try {
      for (let i = 0; i < workers; i++) {
        const w = { worker: new Worker(new URL('./odds-worker.js', import.meta.url), { type: 'module' }), key: null, dead: false };
        w.worker.onmessage = ({ data }) => got(w, data);
        w.worker.onerror = e => {
          e.preventDefault?.();
          dead(w, e.message || 'the worker failed');
        };
        pool.push(w);
      }
    } catch (err) {
      errors.push(String(err?.message ?? err));
    }
  }
  function dead(w, why) {
    if (w.dead) return;
    w.dead = true;
    errors.push(why);
    console.warn('[run] an odds worker stopped; its counts are played in idle slices:', why);
    try {
      w.worker.terminate();
    } catch {}
    // (what it was playing goes back to the front of the queue)
    if (w.key && running.get(w.key) === w) {
      const job = w.job;
      running.delete(w.key);
      const rest = [...queue];
      queue.clear();
      queue.set(w.key, job);
      for (const [k, j] of rest) queue.set(k, j);
    }
    w.key = null;
    pump();
  }
  function got(w, { key, tally, error }) {
    w.key = null;
    w.job = null;
    if (error) return void dead(w, error);
    running.delete(key);
    kept(key, tally);
    pump();
  }
  function kept(key, tally) {
    keepTally(key, tally);
    for (const wt of [...waiters]) {
      if ([...wt.keys].every(hasTally)) {
        waiters.delete(wt);
        wt.resolve();
      }
    }
    // (a burst of counts is drawn once)
    if (!keptT) keptT = setTimeout(() => {
      keptT = null;
      try {
        onKept();
      } catch (err) {
        console.warn('[run] drawing the odds again failed:', err);
      }
    }, 30);
  }
  function pump() {
    if (held) return;
    for (const w of pool) {
      if (w.dead || w.key || !queue.size) continue;
      const [key, job] = queue.entries().next().value;
      queue.delete(key);
      w.key = key;
      w.job = job;
      running.set(key, w);
      w.worker.postMessage({ key, job });
    }
    if (queue.size && pool.every(w => w.dead)) idleLater();
  }

  // ── with no worker: idle slices of a few ms ────────────────────────────────────────────────────────────────────
  let slice = null; // { key, job, acc, next }
  let idleT = null;
  const SLICE_MS = 4;
  function idleLater() {
    if (idleT) return;
    const go = () => {
      idleT = null;
      idleSlice();
    };
    idleT = typeof requestIdleCallback === 'function' ? requestIdleCallback(go, { timeout: 200 }) : setTimeout(go, 16);
  }
  function idleSlice() {
    if (held) return;
    const t0 = performance.now();
    while (performance.now() - t0 < SLICE_MS) {
      if (!slice) {
        if (!queue.size) return;
        const [key, job] = queue.entries().next().value;
        queue.delete(key);
        running.set(key, 'idle');
        slice = { key, job, acc: emptyTally(job.n, job.scrape, job.raid ?? null), next: 1 };
      }
      // (one fight at a time: a jump's is about a third of a millisecond here)
      tallyRange(slice.job, slice.next, slice.next, slice.acc);
      slice.next += 1;
      if (slice.next > slice.job.n) {
        const { key, acc } = slice;
        slice = null;
        running.delete(key);
        kept(key, acc);
      }
    }
    if (slice || queue.size) idleLater();
  }

  // ── what the rules ask for ─────────────────────────────────────────────────────────────────────────────────────
  function ask(key, job) {
    if (hasTally(key) || running.has(key) || queue.has(key)) return;
    queue.set(key, job);
    if (!pool.length || pool.every(w => w.dead)) idleLater();
    else Promise.resolve().then(pump);
  }
  start();
  deferTallies(ask);

  function whenKept(keys) {
    const want = new Set(keys.filter(k => !hasTally(k)));
    if (!want.size) return Promise.resolve();
    return new Promise(resolve => waiters.add({ keys: want, resolve }));
  }
  async function settle(fn) {
    for (;;) {
      const r = collecting(fn);
      if (!r.missing.length) return r.value;
      await whenKept(r.missing);
    }
  }
  return {
    collect: collecting,
    exactly,
    settle,
    whenKept,
    busy: () => queue.size + running.size,
    workers: () => pool.filter(w => !w.dead).length,
    errors,
    hold(on) {
      held = !!on;
      if (held) return;
      if (!pool.length || pool.every(w => w.dead)) idleLater();
      else pump();
    },
    stop() {
      deferTallies(null);
      for (const w of pool) w.worker.terminate();
    },
  };
}

/**
 * THE "…" WHERE A FIGURE WAITS: every word drawn under `node` that has a figure still waiting for its count (NaN, from
 * the rules) says "…" there instead, in the text and in a tooltip; nothing else is touched. The page also draws the
 * meter's bars from figures: those say themselves (index.js meterWaits).
 */
export function watchPending(node) {
  const out = { seen: 0, observer: null };
  const fixText = t => {
    if (!t.data.includes('NaN')) return;
    t.data = t.data.replace(/NaN/g, '…');
    out.seen += 1;
  };
  const fixAttrs = el => {
    for (const a of ['title', 'aria-label']) {
      const v = el.getAttribute?.(a);
      if (!v || !v.includes('NaN')) continue;
      el.setAttribute(a, v.replace(/NaN/g, '…'));
      out.seen += 1;
    }
  };
  const fixTree = n => {
    if (n.nodeType === 3) return fixText(n);
    if (n.nodeType !== 1) return;
    fixAttrs(n);
    // (the browser's own look first, so a paint with nothing waiting costs next to nothing)
    if (!n.textContent.includes('NaN') && !n.querySelector('[title*="NaN"], [aria-label*="NaN"]')) return;
    const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let x = w.nextNode(); x; x = w.nextNode()) {
      if (x.nodeType === 3) fixText(x);
      else fixAttrs(x);
    }
  };
  const mo = new MutationObserver(recs => {
    for (const r of recs) {
      if (r.type === 'characterData') fixText(r.target);
      else if (r.type === 'attributes') fixAttrs(r.target);
      else for (const n of r.addedNodes) fixTree(n);
    }
  });
  mo.observe(node, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label'] });
  fixTree(node);
  out.observer = mo;
  return out;
}
