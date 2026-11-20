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
  marks: isObj,
  visits: Array.isArray,
  today: isObj,
  goods: isObj,
  stash: isObj,
  things: isObj,
  worn: isObj,
  styles: isObj,
  fightWith: x => x === null || typeof x === 'string',
  sixes: x => isObj(x) && Array.isArray(x.marks),
  earlWay: x => x === null || typeof x === 'string',
  ammo: x => isObj(x) && Object.values(x).every(n => isInt(n) && n >= 0),
  holdWith: x => x === null || typeof x === 'string',
  make: x => isObj(x) && Object.values(x).every(m => isObj(m) && isObj(m.book ?? {})),
  under: x => isObj(x) && Object.values(x).every(rows => Array.isArray(rows) && rows.every(r => isObj(r) && typeof r.effect === 'string' && isInt(r.from) && isInt(r.until))),
  belt: x => x === null || (isObj(x) && typeof x.good === 'string'),
  floor: x => x === null || typeof x === 'string',
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
    let found = data.state.v;
    // (memory-1: a version-8 save is read: nobody marked, nobody coming to your door; its shape is otherwise this one's)
    if (found === 8 && data.v === 8) {
      data.state = { ...data.state, v: 9, marks: {}, visits: [] };
      data.v = found = 9;
    }
    // (styles-1: a version-9 save is read: no punch style learned, what you fight with unset; its shape is otherwise this one's)
    if (found === 9 && data.v === 9) {
      data.state = { ...data.state, v: 10, styles: {}, fightWith: null };
      data.v = found = 10;
    }
    // (sixes-1: a version-10 save is read: the Sixes have never heard of you, Earl is told nothing, no dog, nothing paid)
    if (found === 10 && data.v === 10) {
      data.state = { ...data.state, v: 11, sixes: { marks: [], did: null, word: null, made: 0, madeDay: null, taxDay: null, tax: null, jump: null, jumps: [] }, earlWay: null,
        books: { dog: 0, sixes: 0, ...(data.state.books ?? {}) } };
      data.v = found = 11;
    }
    // (raid-1: a version-11 save is read: no rounds, nothing chosen to hold, the Sixes' push and raids not begun)
    if (found === 11 && data.v === 11) {
      const sx = data.state.sixes ?? {};
      data.state = { ...data.state, v: 12, ammo: {}, holdWith: null,
        sixes: { ...sx, streak: 0, streakDay: null, raid: null, raids: [], truce: null, raidLast: null },
        books: { ammo: 0, ...(data.state.books ?? {}) } };
      data.v = found = 12;
    }
    // (pot-1: a version-12 save is read: nothing made, nothing on the shelf of a maker, nobody under anything, the belt empty)
    if (found === 12 && data.v === 12) {
      data.state = { ...data.state, v: 13, make: {}, under: {}, belt: null };
      data.v = found = 13;
    }
    // (bench-1: a version-13 save is read: nothing chosen to stand on the floor spot; the rest of its shape is this one's)
    if (found === 13 && data.v === 13) {
      data.state = { ...data.state, v: RUN_STATE_VERSION, floor: null };
      data.v = found = RUN_STATE_VERSION;
    }
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
