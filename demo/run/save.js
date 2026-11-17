// THE RUN, SAVED IN THIS BROWSER (RUN.md "Saving", the page's side). ONE SLOT: the run in progress, whatever its seed.
// The rules hold the game (src/run/save.mjs: saveRun, loadRun); this file wraps their text with what the page keeps for
// itself and a player would miss after a reload (the last step's line, the morning's report not yet put away, the log,
// the coming-home card after an attempt you missed, the "they got in" notice, a notice from elsewhere, the day's
// opening ledger, Earl's going). A choice half made (how much to take out, which goods, a way picked) is never in it.
// No DOM here, and every storage read and write is in try/catch: the node tests use it with a stand-in storage.
//
//   const slot = saveSlot(localStorage)        slot.read() → text | null · slot.write(text) → true | false
//   packSave({ state, view, page }) → text      unpackSave(text, cfg) → { ok, state, page, at } | { ok: false, why }
import { saveRun, loadRun, view, RUN_CONFIG } from '../../src/run/index.mjs';

/** The browser's keys: the slot, and a save the rules refused (kept, not deleted). */
export const SAVE_KEY = 'hk2.run.save';
export const REFUSED_KEY = 'hk2.run.save.refused';
/** What the page's record says it is, and its own shape's version (the rules' state version is inside `run`). */
export const PAGE_KIND = 'the-run-page';
export const PAGE_V = 1;
/** The page's own things kept with the run; nothing else of the page is written. */
export const PAGE_KEYS = ['result', 'report', 'log', 'after', 'raidNote', 'notice', 'dayStart', 'rose', 'earl'];
/** How many lines of the log are kept. */
export const LOG_KEEP = 80;

/** One save slot over a storage (localStorage, or a stand-in). Nothing here throws. */
export function saveSlot(storage) {
  const tryDo = (fn, no) => {
    try {
      return fn();
    } catch {
      return no;
    }
  };
  return {
    read: () => tryDo(() => storage?.getItem(SAVE_KEY) ?? null, null),
    write: text => tryDo(() => (storage.setItem(SAVE_KEY, text), true), false),
    /** A save the rules refused, kept under its own key (the slot then takes the new run). */
    keepRefused: text => tryDo(() => (storage.setItem(REFUSED_KEY, text), true), false),
    refused: () => tryDo(() => storage?.getItem(REFUSED_KEY) ?? null, null),
    clear: () => tryDo(() => (storage.removeItem(SAVE_KEY), true), false),
  };
}

/** The clock of a state, as the view says it ("14:00"). */
export const clockOf = hour => `${String(((hour % 24) + 24) % 24).padStart(2, '0')}:00`;

/** Where and when a run stands, for the mark and the line: { day, hour, clock, place }. */
export function atOf(state, view = null) {
  return { day: state.day, hour: state.hour, clock: view?.clock ?? clockOf(state.hour), place: view?.placeLabel ?? state.place, banked: state.banked, seed: state.seed };
}

/** The run and the page's own things as the slot's text. Only PAGE_KEYS of `page` are kept, and the log's last LOG_KEEP. */
export function packSave({ state, view = null, page = {} }) {
  const kept = {};
  for (const k of PAGE_KEYS) if (page[k] !== undefined && page[k] !== null) kept[k] = k === 'log' ? page[k].slice(-LOG_KEEP) : page[k];
  return JSON.stringify({ kind: PAGE_KIND, v: PAGE_V, at: atOf(state, view), run: saveRun(state), page: kept });
}

/**
 * The slot's text back: `{ ok: true, state, page, at }`, or `{ ok: false, why }` with `why` the rules' ('version': a
 * run of another state version; 'broken': anything else) or 'page' (the page's own record is of another shape, which
 * is read as broken). Never throws. A bare rules save (src/run/save.mjs text) is read as a run with nothing of the page.
 */
export function unpackSave(text, cfg = RUN_CONFIG) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, why: 'broken' };
  }
  if (data?.kind === 'the-run') {
    const r = loadRun(text, cfg);
    return r.ok ? { ok: true, state: r.state, page: {}, at: atOf(r.state, view(cfg, r.state)) } : { ok: false, why: r.why };
  }
  if (data?.kind !== PAGE_KIND || typeof data.run !== 'string') return { ok: false, why: 'broken' };
  if (data.v !== PAGE_V) return { ok: false, why: 'version' };
  const r = loadRun(data.run, cfg);
  if (!r.ok) return { ok: false, why: r.why };
  const page = {};
  const p = data.page && typeof data.page === 'object' ? data.page : {};
  for (const k of PAGE_KEYS) if (p[k] !== undefined && p[k] !== null) page[k] = p[k];
  if (page.log && !Array.isArray(page.log)) delete page.log;
  return { ok: true, state: r.state, page, at: atOf(r.state, view(cfg, r.state)) };
}

/** THE MARK on the top line: "saved · day 3 14:00", or "not saving" when the browser refuses its storage. */
export const savedMark = at => (at ? `saved · day ${at.day} ${at.clock}` : 'not saving');
/** The one line on picking up. */
export const pickedLine = at => `Picked up where you left off: day ${at.day}, ${at.clock}, ${at.place}.`;
/** A save the rules refused, said plainly. */
export const refusedLine = why => (why === 'version'
  ? 'Your saved run is from an older build and cannot be continued. A new run has started.'
  : 'Your saved run could not be read and cannot be continued. A new run has started.');
/** NEW RUN's second ask: what it replaces. */
export const replaceAsk = at => `This ends your run: day ${at.day}, $${at.banked} banked. Press again to start a new one.`;
