// Saving a run (RUN.md, "Saving"): the state as text, and the text back as a state. The state is plain JSON already
// (state.mjs: no functions, no Maps or Sets, no generator: every draw is rng(seed, purpose, day, hour...)), so a run
// saved at any choice point and loaded again goes on exactly as if it had never stopped (test/run-save.test.mjs cuts
// runs at random steps, and at every step, and compares the end with the uncut run's).
//   const text = saveRun(state);
//   const r = loadRun(text);   // { ok: true, state } or { ok: false, why: 'version' | 'broken', text }

import { RUN_CONFIG } from './config.mjs';
import { RUN_STATE_VERSION } from './state.mjs';
import { view } from './view.mjs';
import { checkRunBooks } from './ledger.mjs';

/** What a saved run's text says it is (anything else is not a saved run). */
export const SAVE_KIND = 'the-run';

/** A run's state as text: `{ kind, v, state }`, the state as it is. */
export function saveRun(state) {
  return JSON.stringify({ kind: SAVE_KIND, v: state?.v ?? null, state });
}

// the fields every state of this version holds, and what each must be
const isInt = x => Number.isInteger(x);
const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const FIELDS = {
  seed: x => (typeof x === 'number' && Number.isFinite(x)) || typeof x === 'string',
  day: x => isInt(x) && x >= 1,
  hour: isInt,
  place: x => typeof x === 'string',
  energy: x => isInt(x) && x >= 0,
  heat: x => isInt(x) && x >= 0,
  carried: x => isInt(x) && x >= 0,
  banked: x => isInt(x) && x >= 0,
  owned: isObj,
  hoursThere: x => isInt(x) && x >= 0,
  doneDay: x => x === null || isInt(x),
  people: isObj,
  shifts: isObj,
  placeHeat: isObj,
  supply: isObj,
  regulars: isObj,
  grudges: isObj,
  trust: isObj,
  door: x => x === null || isObj(x),
  today: isObj,
  goods: isObj,
  stash: isObj,
  things: isObj,
  worn: isObj,
  route: x => x === null || (isObj(x) && Array.isArray(x.stops) && Array.isArray(x.hand)),
  home: x => isObj(x) && Array.isArray(x.marks) && Array.isArray(x.raids) && (x.raid === null || isObj(x.raid)) && (x.guard === null || isObj(x.guard)),
  books: x => isObj(x) && Object.values(x).every(n => isInt(n)),
};

/** Why a state of this version cannot be played (null: it can). */
function problem(cfg, state) {
  for (const [k, ok] of Object.entries(FIELDS)) if (!(k in state) || !ok(state[k])) return `its ${k} is missing or not what a run holds`;
  if (!cfg.places[state.place] && !cfg.stops?.[state.place]) return `no place ${state.place}`;
  if (!checkRunBooks(state).ok) return 'its books do not add up';
  try {
    view(cfg, state);
  } catch (e) {
    return `it does not play: ${e.message}`;
  }
  return null;
}

/**
 * Text back as a state. Never throws: `{ ok: true, state }`, or `{ ok: false, why, text }` with `why` 'version' (the
 * text is a run saved by another state version: `found`, `wants`; no migration) or 'broken' (anything else: not JSON,
 * not a saved run, a field missing or wrong, books that do not add up, a state the rules cannot play).
 */
export function loadRun(text, cfg = RUN_CONFIG) {
  const no = (why, words, extra = {}) => ({ ok: false, why, text: words, ...extra });
  try {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return no('broken', 'Not a saved run: the text is not JSON.');
    }
    if (!isObj(data) || data.kind !== SAVE_KIND || !isObj(data.state)) return no('broken', 'Not a saved run.');
    const found = data.state.v;
    if (found !== RUN_STATE_VERSION || data.v !== found) {
      return no('version', `A run saved by another version of the game (state version ${found ?? data.v ?? 'none'}; this one reads ${RUN_STATE_VERSION}).`, { found: found ?? data.v ?? null, wants: RUN_STATE_VERSION });
    }
    const bad = problem(cfg, data.state);
    if (bad) return no('broken', `A saved run that cannot be played: ${bad}.`);
    return { ok: true, state: data.state };
  } catch (e) {
    return no('broken', `A saved run that cannot be read: ${e?.message ?? e}.`);
  }
}
