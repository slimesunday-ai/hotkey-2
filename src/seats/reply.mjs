// The model's reply -> a checked reply the season can play (SPEC section 13).
// Rewritten for hotkey 2 on the pattern of hotkey mini's seats/reply.mjs (commit 3438059). extractJson and its
// repair are mini's, with this game's field names.
//
// parseReply(text, view)  -> { ok, why, reply: { move, accept, say, message, confessional }, trimmed, dropped }
// parseJournal(text)      -> { ok, why, journal: { lines, ask }, trimmed, dropped }
//
// - The move decides `ok`. A reply that isn't one JSON object, or picks an id that isn't on the menu, or posts a job
//   with no readable task, fails: the seat layer then plays a legal fallback move and counts the turn as failed.
// - Nothing else fails a reply. Over-long text is cut and named in `trimmed`. An argument out of range is pulled back
//   into range, and anything unreadable is left out so the menu line's own value is used; each is named in `dropped`
//   with the reason. A failed move keeps its talk.
// - reply.move is a menu choice, { id: 'm3', ...args }: the season turns it into a move with chooseFromMenu.
import { LIMITS } from './defaults.mjs';
import { dayClock } from './clock.mjs';

/** The reply format as the model reads it. The prompt prints this; the parser below accepts it. */
export const REPLY_FORMAT = [
  'Answer with one JSON object and nothing else: no text, tags or tool calls around it (you have no tools).',
  '{"move":{"id":"<menu id>"},"accept":[],"say":null,"message":null,"confessional":"<to the viewers>"}',
  '- move: {"id":"m3"} plays MENU line m3; put it first. A line with "fill" takes those keys beside the id, e.g. {"id":"m7","to":"a4","n":3,"each":22}; a key left out keeps the line\'s own value. Write an hour ("due") as "Day 3 19:00". null when the MENU is empty.',
  '- a job\'s "task": {"type":"rob","agent":"a3"} (also fight, bail), {"type":"guard","hours":3} (add "agent" to guard someone else) or {"type":"deliver","good":"chems","n":3,"agent":"a3"}. A gift of goods takes "good" and "n" instead of "cash".',
  '- accept: up to 3 offer ids, free: ["o12"]. {"id":"o12","courier":true} pays the courier to skip the walk; {"id":"o12","units":2} takes part of a board listing. An offer you ignore is declined.',
  `- say: null or {"text":"<up to ${LIMITS.say} characters>","to":"<agent id, optional>"}: out loud; your block hears it next hour.`,
  `- message: null or {"to":"<agent id>","text":"<up to ${LIMITS.message} characters>"}: one private message, read next hour.`,
  `- confessional: up to ${LIMITS.confessional} characters to the viewers, in your own voice.`,
  'Anything else (no JSON object, an id not on the MENU) plays as a rest and counts as a failed turn. Over-long text is cut.',
].join('\n');

/** The journal's format: one extra call each night. */
export const JOURNAL_FORMAT = [
  'Answer with one JSON object and nothing else: no text, tags or tool calls around it (you have no tools).',
  '{"believe":"<what you believe now>","trust":"<who you trust, and who you don\'t>","tomorrow":"<what you will do tomorrow>","ask":"<what you want from your owner>"}',
  `Each line is one short sentence in your own voice, up to ${LIMITS.journalLine} characters; "ask" up to ${LIMITS.ask}. Viewers read all four and your owner reads the ask. You read them again tomorrow.`,
].join('\n');

const isObject = x => !!x && typeof x === 'object' && !Array.isArray(x);
const tryParse = s => {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
};
const lower = s => String(s).trim().toLowerCase();

// Fields only a reply has (a quoted fragment of the menu has none of them).
const REPLY_KEYS = ['move', 'accept', 'say', 'message', 'confessional', 'believe', 'trust', 'tomorrow', 'ask', 'lines'];
// Free text that may survive being cut off mid-sentence. A cut-off id or number can't be guessed.
const TEXT_KEYS = ['say', 'text', 'confessional', 'believe', 'trust', 'tomorrow', 'ask'];

// From mini. Only outer objects are candidates: a malformed reply must never fall through to a fragment inside it.
// Prose may come before the reply. Repair only string quotes, trailing commas and cut-off closing brackets; never
// supply a move or finish an id.
export function extractJson(text) {
  if (typeof text !== 'string') return undefined;
  const t = text.replace(/^﻿/, '').trim();
  const whole = tryParse(t);
  if (isObject(whole)) return whole;
  if (whole !== undefined || t.startsWith('[')) return undefined;
  const next = from => {
    const i = t.slice(from).search(/[{[]/);
    return i < 0 ? -1 : from + i;
  };
  // Notes before the reply can quote a fragment ({"id":"m3"}): the reply is the first outer object with a move, else
  // the first with any reply field. A fragment alone is no reply.
  let talk;
  for (let start = next(0); start !== -1;) {
    const end = closing(t, start);
    const slice = t.slice(start, end === -1 ? undefined : end + 1);
    const obj = t[start] === '{' ? tryParse(slice) ?? repairObject(t.slice(start)) : undefined;
    if (isObject(obj) && 'move' in obj) return obj;
    if (isObject(obj)) talk ??= REPLY_KEYS.some(k => k in obj) ? obj : undefined;
    // A JSON-looking outer reply failed: do not search inside it (even if a bad quote fooled closing()).
    else if (/^\{\s*"/.test(slice) || end === -1) return talk;
    if (end === -1) return talk;
    start = next(end + 1);
  }
  return talk;
}

function repairObject(t) {
  const stack = [];
  let out = '', key = '', previous = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '"') {
      const isKey = stack.at(-1) === '}' && (previous === '{' || previous === ',');
      let raw = '"', ended = false;
      for (i++; i < t.length; i++) {
        const ch = t[i];
        if (ch === '\\') {
          if (i + 1 >= t.length) return undefined;
          raw += ch + t[++i];
        } else if (ch === '"') {
          const rest = t.slice(i + 1).trimStart();
          const boundary = isKey ? rest.startsWith(':') : !rest || rest[0] === stack.at(-1)
            || (rest[0] === ',' && (stack.at(-1) === ']' || /^,\s*"(?:[^"\\]|\\.)*"\s*:/.test(rest) || /^,\s*[}\]]/.test(rest)));
          if (boundary) {
            raw += '"';
            ended = true;
            break;
          }
          if (isKey) return undefined;
          raw += '\\"';
        } else raw += ch;
      }
      // Cut-off free text can survive, but a cut-off id, name or number cannot be guessed.
      if (!ended) {
        if (isKey || !TEXT_KEYS.includes(key)) return undefined;
        raw += '"';
      }
      if (tryParse(raw) === undefined) return undefined;
      if (isKey) key = tryParse(raw);
      out += raw;
      previous = '"';
    } else if (c === '{' || c === '[') {
      stack.push(c === '{' ? '}' : ']');
      out += c;
      previous = c;
    } else if (c === '}' || c === ']') {
      if (stack.pop() !== c) return undefined;
      out += c;
      previous = c;
      if (!stack.length) return tryParse(out);
    } else if (c === ',' && (!t.slice(i + 1).trim() || /^[}\]]/.test(t.slice(i + 1).trimStart()))) {
      // Trailing commas only outside strings.
    } else {
      out += c;
      if (!/\s/.test(c)) previous = c;
    }
  }
  return tryParse(out + stack.reverse().join(''));
}

// The matching outer bracket, skipping strings.
function closing(t, start) {
  const stack = [];
  let inString = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') {
      if (stack.pop() !== c) return -1;
      if (!stack.length) return i;
    }
  }
  return -1;
}

/**
 * Free text cut to `max` characters, whitespace collapsed: { text, cut }. A cut lands on the last sentence end in
 * the second half of the limit, else on the last word break, so the engine's own hard cut never splits a word.
 */
export function clipChars(value, max) {
  const s = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (s.length <= max) return { text: s, cut: false };
  const head = s.slice(0, max);
  let end = -1;
  for (const m of head.matchAll(/[.!?]["')\]]*(?= |$)/g)) if (m.index + m[0].length >= max / 2) end = m.index + m[0].length;
  if (end === -1) {
    const space = s[max] === ' ' ? max : head.lastIndexOf(' ');
    end = space >= max * 0.6 ? space : max;
  }
  return { text: head.slice(0, end).trim(), cut: true };
}

// A number as a model writes one: 40, "40", "$40".
const asNumber = v => (typeof v === 'number' ? v : typeof v === 'string' && /^\s*\$?\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v.replace(/[$\s]/g, '')) : NaN);
const GOODS = { chems: 'chems', chem: 'chems', parts: 'parts', part: 'parts', product: 'product', gun: 'gun', guns: 'gun' };
const ME = ['me', 'myself', 'self', 'you'];

/** Everyone the view names, as [{ id, name }], and this agent's own id. */
function peopleOf(view) {
  const you = isObject(view?.you) ? view.you : {};
  const cast = (Array.isArray(view?.cast) ? view.cast : []).filter(p => isObject(p) && typeof p.id === 'string').map(p => ({ id: p.id, name: p.name }));
  return { self: typeof you.id === 'string' ? you.id : null, selfName: typeof you.name === 'string' ? you.name : null, cast };
}

/** An agent given by id or by name, among `people`: its id, or null. */
function resolveAgent(given, people) {
  if (typeof given !== 'string' || !given.trim()) return null;
  const g = lower(given);
  const byId = people.find(p => lower(p.id) === g);
  if (byId) return byId.id;
  const byName = people.filter(p => typeof p.name === 'string' && lower(p.name) === g);
  return byName.length === 1 ? byName[0].id : null;
}

/** The menu line a reply's move names: { entry, given } or { why }. `given` is the arguments it came with. */
function findEntry(obj, menu) {
  let m = obj.move;
  if (typeof m === 'number' && Number.isInteger(m)) m = `m${m}`;
  if (typeof m === 'string') m = { id: m };
  if (!isObject(m)) return { why: 'no move' };
  // {"move":"m3","args":{...}} and {"move":{"id":"m3","args":{...}}} are read as one flat choice.
  const given = { ...(isObject(obj.args) ? obj.args : {}), ...(isObject(m.args) ? m.args : {}), ...m };
  delete given.args;
  if (typeof given.id === 'number' && Number.isInteger(given.id)) given.id = `m${given.id}`;
  if (typeof given.id === 'string' && given.id.trim()) {
    const id = lower(given.id);
    const entry = menu.find(e => lower(e.id) === id);
    if (entry) return { entry, given };
    // a bare verb in place of an id ("rest") is read below, when only one line has that verb
    if (!given.verb) given.verb = id;
    else return { why: `move ${JSON.stringify(given.id)} is not on the menu` };
  }
  if (typeof given.verb === 'string') {
    const verb = lower(given.verb);
    let lines = menu.filter(e => e.verb === verb);
    // a verb with what tells its lines apart: where to walk, who to attack and how, which job or crew action
    for (const key of ['to', 'target', 'how', 'option', 'action']) {
      if (lines.length > 1 && typeof given[key] === 'string') {
        const narrowed = lines.filter(e => typeof e.move?.[key] === 'string' && lower(e.move[key]) === lower(given[key]));
        if (narrowed.length) lines = narrowed;
      }
    }
    if (lines.length === 1) return { entry: lines[0], given };
    return { why: `move ${JSON.stringify(given.id ?? given.verb)} is not on the menu` };
  }
  return { why: 'the move has no menu id' };
}

/** A job's task as the engine takes it, from an object or from words ("rob Kim", "guard me 3"): { task } or { why }. */
function readTask(given, people) {
  let t = given;
  if (typeof t === 'string') {
    const w = t.trim().split(/\s+/);
    const type = lower(w[0] ?? '');
    if (type === 'deliver') t = { type, n: w[1], good: w[2], agent: w.slice(3).join(' ') };
    else if (type === 'guard') {
      const hours = w.findLast(x => /^\d+$/.test(x));
      t = { type, hours, agent: w.slice(1).filter(x => x !== hours && !/^(for|hours?|h)$/i.test(x)).join(' ') };
    } else t = { type, agent: w.slice(1).join(' ') };
  }
  if (!isObject(t) || typeof t.type !== 'string') return { why: 'a job needs a task' };
  const type = lower(t.type);
  const all = [...people.cast, ...(people.self ? [{ id: people.self, name: people.selfName }] : [])];
  const named = t.agent ?? t.target ?? t.who ?? t.to;
  const mine = named === undefined || named === null || named === '' || (typeof named === 'string' && (ME.includes(lower(named)) || resolveAgent(named, all) === people.self));
  const agent = mine ? null : resolveAgent(named, people.cast);
  if (['rob', 'fight', 'bail'].includes(type)) {
    return agent ? { task: { type, agent } } : { why: `a ${type} job needs another agent, not ${JSON.stringify(named ?? null)}` };
  }
  if (type === 'guard') {
    const hours = Math.round(asNumber(t.hours ?? 3));
    if (!Number.isFinite(hours)) return { why: 'a guard job needs a number of hours' };
    if (!mine && !agent) return { why: `no such agent to guard: ${JSON.stringify(named)}` };
    return { task: { type, hours: Math.min(12, Math.max(1, hours)), ...(agent ? { agent } : {}) } };
  }
  if (type === 'deliver') {
    const good = GOODS[lower(t.good ?? '')];
    const n = Math.round(asNumber(t.n ?? t.units));
    if (!good || !Number.isFinite(n) || n < 1 || !agent) return { why: 'a delivery needs goods, a number and another agent to hand them to' };
    const q = Math.round(asNumber(t.q));
    return { task: { type, good, n, agent, ...(Number.isFinite(q) ? { q } : {}) } };
  }
  return { why: `no such kind of job: ${JSON.stringify(t.type)}` };
}

/** The arguments of a choice, checked against the menu line's own list. Returns { args } or { why } (a fatal one). */
function readArgs(entry, given, view, people, drop) {
  const spec = isObject(entry.args) ? entry.args : {};
  const clock = dayClock(view?.clock);
  const args = {};
  const known = new Set(['id', 'verb']);
  const number = (key, value, range) => {
    let n = asNumber(value);
    if (key === 'due' && !Number.isFinite(n)) {
      const at = clock.parse(value);
      if (at.t !== undefined) n = at.t;
    }
    if (!Number.isFinite(n)) return drop(`move.${key}`, `${JSON.stringify(value)} is not a number: the menu line's own value is used`);
    let v = Math.round(n);
    if (range.min !== undefined && v < range.min) v = range.min;
    if (range.max !== undefined && v > range.max) v = range.max;
    if (v !== n) drop(`move.${key}`, `${JSON.stringify(value)} is outside what this line takes: ${v} is used`);
    args[key] = v;
  };

  for (const [key, range] of Object.entries(spec)) {
    known.add(key);
    if (key === 'task') {
      const task = readTask(given.task ?? given.job, people);
      known.add('job');
      if (task.why) return { why: task.why };
      args.task = task.task;
      continue;
    }
    const value = given[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(range) && range.every(x => typeof x === 'boolean')) {
      const yes = value === true || ['true', 'yes'].includes(lower(value));
      const no = value === false || ['false', 'no'].includes(lower(value));
      if (yes || no) args[key] = yes;
      else drop(`move.${key}`, `${JSON.stringify(value)} is not true or false`);
    } else if (Array.isArray(range)) {
      // one of a list: agent ids (by id or by name), or a word such as "anyone"
      const words = range.filter(x => typeof x === 'string');
      const word = typeof value === 'string' ? words.find(x => lower(x) === lower(value)) : undefined;
      const board = typeof value === 'string' && ['board', 'everyone', 'all', 'any'].includes(lower(value)) && words.includes('anyone') ? 'anyone' : undefined;
      const agent = resolveAgent(value, people.cast.filter(p => words.includes(p.id)));
      const hit = word ?? board ?? agent;
      if (hit !== undefined && hit !== null) args[key] = hit;
      else drop(`move.${key}`, `${JSON.stringify(value)} is not one of this line's choices: its own value is used`);
    } else if (range === 'text') {
      const name = clipChars(String(value), 24).text;
      if (name) args[key] = name;
    } else if (isObject(range)) number(key, value, range);
  }

  // what the engine reads without listing it: a job's share of what comes back, and a gift of goods instead of cash
  const terms = entry.move?.terms;
  if (entry.verb === 'offer' && terms?.kind === 'job' && given.sharePct !== undefined) {
    known.add('sharePct');
    number('sharePct', given.sharePct, { min: 0, max: 100 });
  }
  if (entry.verb === 'offer' && terms?.kind === 'gift' && given.good !== undefined && given.good !== null) {
    for (const k of ['good', 'n', 'q']) known.add(k);
    const good = GOODS[lower(given.good)];
    const n = Math.round(asNumber(given.n ?? 1));
    const q = Math.round(asNumber(given.q ?? 1));
    if (good && Number.isFinite(n) && n >= 1) {
      Object.assign(args, { good, n, q: Number.isFinite(q) && q >= 1 ? q : 1 });
      delete args.cash;
    } else drop('move.good', `a gift of goods needs "good" and "n", not ${JSON.stringify({ good: given.good, n: given.n ?? null })}`);
  }
  for (const key of Object.keys(given)) {
    if (!known.has(key) && !['to', 'target', 'how', 'option', 'action'].includes(key)) drop(`move.${key}`, 'this menu line takes no such key');
  }
  return { args };
}

/** A reply's text read against the view it answers. */
export function parseReply(text, view) {
  const obj = extractJson(text);
  if (!obj) return { ok: false, why: typeof text === 'string' && text.trim() ? 'no JSON object in the reply' : 'empty reply', reply: null, trimmed: [], dropped: [] };
  const menu = (Array.isArray(view?.menu) ? view.menu : []).filter(e => isObject(e) && typeof e.id === 'string');
  const people = peopleOf(view);
  const trimmed = [], dropped = [];
  const drop = (field, why) => {
    dropped.push({ field, why });
  };
  const other = given => {
    const id = resolveAgent(given, people.cast);
    return id && id !== people.self ? id : null;
  };

  // ---- talk first: cut or dropped, never fatal, and kept when the move fails
  let say = null;
  const s = isObject(obj.say) ? obj.say : { text: obj.say };
  const sayText = clipChars(s.text, LIMITS.say);
  if (sayText.cut) trimmed.push('say');
  if (sayText.text) {
    say = { text: sayText.text };
    if (s.to !== undefined && s.to !== null && s.to !== '') {
      const to = other(s.to);
      if (to) say.to = to;
      else drop('say.to', `${JSON.stringify(s.to)} is not another agent: the line is said to the block`);
    }
  }

  let message = null;
  const m = Array.isArray(obj.message) ? obj.message[0] : obj.message;
  if (Array.isArray(obj.message) && obj.message.length > 1) drop('message', 'one message a turn: the first is sent');
  if (m !== null && m !== undefined && m !== false && m !== '') {
    if (!isObject(m)) drop('message', 'not {"to","text"}');
    else {
      const to = other(m.to);
      const body = clipChars(m.text, LIMITS.message);
      if (!to) drop('message', `"to" ${JSON.stringify(m.to ?? null)} is not another agent`);
      else if (!body.text) drop('message', 'no text');
      else {
        if (body.cut) trimmed.push('message');
        message = { to, text: body.text };
      }
    }
  }

  const conf = clipChars(isObject(obj.confessional) ? obj.confessional.text : obj.confessional, LIMITS.confessional);
  if (conf.cut) trimmed.push('confessional');
  const confessional = conf.text || null;

  // ---- accepts: free, up to 3, only offers this view shows
  const open = new Map((Array.isArray(view?.offers) ? view.offers : []).filter(o => isObject(o) && typeof o.id === 'string').map(o => [lower(o.id), o]));
  const accept = [];
  const asked = obj.accept === null || obj.accept === undefined || obj.accept === false ? [] : Array.isArray(obj.accept) ? obj.accept : [obj.accept];
  for (const a of asked) {
    const id = typeof a === 'string' ? a : isObject(a) && typeof a.id === 'string' ? a.id : null;
    const offer = id === null ? null : open.get(lower(id));
    if (!offer) drop('accept', `${JSON.stringify(id ?? a)} is not an offer open to you`);
    else if (accept.some(x => (x.id ?? x) === offer.id)) drop('accept', `${offer.id} is named twice`);
    else if (accept.length >= 3) drop('accept', `${offer.id}: three accepts a turn`);
    else {
      const units = isObject(a) ? Math.round(asNumber(a.units)) : NaN;
      const extra = { ...(isObject(a) && a.courier === true ? { courier: true } : {}), ...(Number.isFinite(units) && units >= 1 ? { units } : {}) };
      accept.push(Object.keys(extra).length ? { id: offer.id, ...extra } : offer.id);
    }
  }

  const reply = { move: null, accept, say, message, confessional };
  const out = (ok, why) => ({ ok, why, reply, trimmed, dropped });

  // ---- the move
  if (menu.length === 0) {
    if (obj.move !== null && obj.move !== undefined) drop('move', 'the menu is empty this hour: no move is played');
    return out(true, null);
  }
  const found = findEntry(obj, menu);
  if (!found.entry) return out(false, found.why);
  const read = readArgs(found.entry, found.given, view, people, drop);
  if (read.why) return out(false, `${found.entry.id}: ${read.why}`);
  reply.move = { id: found.entry.id, ...read.args };
  return out(true, null);
}

/** A journal reply: { believe, trust, tomorrow, ask } or { lines: [...], ask }. */
export function parseJournal(text) {
  const obj = extractJson(text);
  if (!obj) return { ok: false, why: typeof text === 'string' && text.trim() ? 'no JSON object in the reply' : 'empty reply', journal: null, trimmed: [], dropped: [] };
  const trimmed = [], dropped = [];
  const given = Array.isArray(obj.lines) ? obj.lines : [obj.believe, obj.trust, obj.tomorrow];
  const lines = [];
  given.forEach((line, i) => {
    const c = clipChars(typeof line === 'string' ? line : '', LIMITS.journalLine);
    if (!c.text) return;
    if (lines.length >= 3) return dropped.push({ field: 'lines', why: 'three lines a journal: the rest are left out' });
    if (c.cut) trimmed.push(Array.isArray(obj.lines) ? `lines[${i}]` : ['believe', 'trust', 'tomorrow'][i]);
    lines.push(c.text);
  });
  const want = clipChars(typeof obj.ask === 'string' ? obj.ask : '', LIMITS.ask);
  if (want.cut) trimmed.push('ask');
  if (lines.length < 3) dropped.push({ field: 'lines', why: `${lines.length} of 3 lines given` });
  if (!want.text) dropped.push({ field: 'ask', why: 'no ask for the owner' });
  const journal = { lines, ask: want.text || null };
  if (lines.length === 0) return { ok: false, why: 'the journal has no lines', journal, trimmed, dropped };
  return { ok: true, why: null, journal, trimmed, dropped };
}
