// The AI seats (SPEC sections 1, 13 and 17): a view -> a model call -> a checked reply, for every AI seat of an
// hour, in parallel.
//
// const seats = createAiSeats({ seats: [{ agentId, model, api?, effort? }], transport: 'fake' })
// const replies = await seats.decide([{ agentId, view }])    // { agentId: { move, accept, say, message, confessional } }
// const journals = await seats.journal([{ agentId, view }])  // { agentId: { lines: [three], ask } }
// const results = await seats.ask([{ agentId, view }], 'turn')  // Map agentId -> { reply, ok, why, usage, ms, raw, ... }
//
// Adapted from hotkey mini's seats/ai.mjs (commit 3438059). The guards below are mini's, line for line: the one
// spend tally, the cap checked before every request, the refusals to start, the halts, the retries, the lower-effort
// second try for a Claude reply cut off at max_tokens. EVERY DEVIATION FROM MINI:
//  1. The reply is this game's: render() and parseReply() take the whole view, and the parsed reply is
//     { move: { id, ...args }, accept, say, message, confessional }. Mini's reply had move, target, args, thought.
//  2. decide() resolves to { agentId: reply }, the shape src/season.mjs reads, where mini's resolved to a Map of
//     results. Mini's Map is still here as ask(batch, kind), and decide() and journal() are built on it.
//  3. The fallback move. In mini the engine played `rest` for a failed turn. Here the season plays whatever move the
//     seat layer hands it, so decide() fills in the fallback itself: the menu's rest line (or the runner's `fallback`
//     hook), with whatever talk the failed reply had. The turn still counts as failed (seats.failed), and its reply
//     carries failed: true, which the season reads to hand a seat to a bot after three failed hours in a row.
//  4. journal(): the night's extra call per seat. Same route, tally, cap and retries as a turn; parsed by
//     parseJournal. A failed journal is an empty one ({ lines: [], ask: null, failed: true }), never made-up words.
//  5. The fake's unscripted calls are played by legalReply(view), as in mini, or by the `fakeBrain` hook when the
//     runner gives one (it plays the scripted bots through the reply format, so a fake season looks like a season).
//  6. `spent`: a { cost, calls } the tally starts from, so a run resumed after a night pause keeps one cap.
//  7. onTurn(record): one record per turn (prompt sizes, every attempt's raw text, what was parsed, usage, cost),
//     for ai-replies.jsonl. Mini's per-attempt onReply is still here.
//  8. API 'local': the Mac's own model, a thin wrapper over the OpenRouter client pointed at 127.0.0.1 with no key.
//     It is free, so a run whose seats are all local needs no maxCost or go; a run with any paid seat needs both,
//     exactly as before. Under `node --test` a local seat needs an injected fetch, so no test reaches the real one.
//  9. The turn log says which kind of call it was (`kind`), and seats.failed counts failed turns and journals.
//
// - Each seat names its API: 'openrouter' (the default: chat completions through ./openrouter.mjs, thinking minimal,
//   max_tokens 2000, 60 s), 'claude' (the Messages API direct through ./anthropic.mjs: adaptive thinking at the
//   seat's effort, default high, with max_tokens and window by effort) or 'local'. All share one spend tally, so one
//   maxCost caps them all.
// - The cut-off second try: a Claude reply cut off at max_tokens that gave no valid move is asked once more at the
//   next lower effort (max -> xhigh -> high -> medium -> low). It is one more call on the same tally and cap.
// - Transport 'live' (or its old name 'openrouter') makes real calls. It refuses to start without maxCost and go, and
//   only then reads the key file of each API a seat uses. Under `node --test` it also refuses the default key files
//   and the real fetch.
// - Transport 'fake' answers in-process for $0: OpenRouter and local seats through the chat fake (./fake-model.mjs),
//   Claude seats through the real Claude client talking to a Messages-format fake (./fake-messages.mjs). The Claude
//   fake's usage is priced from PRICES, so a fake run shows the shape of a bill, not a real one.
// - Every request counts as a call (a retry too), keyed by seat and call number, never by arrival.
// - A failed turn is { ok: false, why }: 'timeout', 'transport: ...', 'http 4xx: ...', a parse reason ('move "m99" is
//   not on the menu'), 'cut off: ...', 'capped' (the spend cap was reached: no call was made) or 'halted: credit' /
//   'halted: key' (the account or the key stopped the run).
import { openRouter, readKey, openRouterFields, needsCacheMark, cacheMarked } from './openrouter.mjs';
import { claudeApi, claudeFields, CLAUDE_URL, CLAUDE_KEY_FILE, CLAUDE_EFFORTS, CLAUDE_NOTE, CLAUDE_THINKING, PRICES } from './anthropic.mjs';
import { fakeModel, SEAT_HEADER, CALL_HEADER } from './fake-model.mjs';
import { fakeMessages } from './fake-messages.mjs';
import { render } from './prompt.mjs';
import { parseReply, parseJournal, extractJson, clipChars } from './reply.mjs';
import { SEAT_DEFAULTS, LIMITS, APIS, PAID_APIS, byPrefix } from './defaults.mjs';
import { dayClock } from './clock.mjs';

const REAL_CLOCK = { now: () => Date.now(), setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) };
const isObject = x => !!x && typeof x === 'object' && !Array.isArray(x);
const parsed = text => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};
const short = s => String(s).replace(/\s+/g, ' ').slice(0, 200);
// The fake Claude endpoint's key and the local model's: plain words the far end only checks are present. Not credentials.
const FAKE_CLAUDE_KEY = ['fake', 'messages', 'word'].join('-');
const LOCAL_WORD = ['local', 'no', 'key'].join('-');
const LOOPBACK = ['127.0.0.1', 'localhost', '[::1]'];
// A request's finish reasons that mean the reply was cut off at max_tokens (chat's and the Messages API's names).
const CUT_OFF = new Set(['length', 'max_tokens']);
// Nearest-rank percentile of a sorted list, or null when it's empty.
const percentile = (sorted, p) => (sorted.length ? sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] : null);

// FNV-1a, 32 bits: a stable hash for the fake's picks.
export function stableHash(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The menu's rest line as a choice: the move a failed turn plays. null when the menu is empty (jail, the clinic). */
export function restChoice(view) {
  const line = (Array.isArray(view?.menu) ? view.menu : []).find(m => isObject(m) && m.verb === 'rest');
  return line ? { id: line.id } : null;
}

// A legal reply for a view, with no model: a menu line picked by a stable hash of seat id and hour, and arguments
// inside what the line takes. Some hours it also accepts an offer, says a line and messages someone, so the engine's
// talk paths run in a fake season. A view with an empty menu gets move null.
export function legalReply(view) {
  const v = isObject(view) ? view : {};
  const you = isObject(v.you) ? v.you : {};
  const c = isObject(v.clock) ? v.clock : {};
  const pick = (what, n) => stableHash(`${you.id}|${c.t}|${what}`) % n;
  const menu = Array.isArray(v.menu) ? v.menu.filter(isObject) : [];
  const when = Number.isInteger(c.t) ? dayClock(c).label(c.t) : 'now';
  const reply = { move: null, accept: [], say: null, message: null, confessional: `${when}: nothing I can do this hour but wait.` };
  if (menu.length > 0) {
    const line = menu[pick('move', menu.length)];
    const move = { id: line.id };
    for (const [key, spec] of Object.entries(isObject(line.args) ? line.args : {})) {
      if (key === 'task') move.task = { type: 'guard', hours: 1 + pick('hours', 3) };
      else if (spec === 'text') move[key] = `${you.name ?? 'Our'} crew`;
      else if (Array.isArray(spec) && spec.length) move[key] = spec[pick(`arg:${key}`, spec.length)];
      else if (isObject(spec) && Number.isInteger(spec.min) && Number.isInteger(spec.max) && spec.max >= spec.min) {
        const n = spec.min + pick(`arg:${key}`, spec.max - spec.min + 1);
        // an hour goes out as the prompt asks for it, a clock time, so that path runs too
        move[key] = key === 'due' ? dayClock(c).label(n) : n;
      }
      // a number with no upper end (a price) keeps the line's own value
    }
    reply.move = move;
    reply.confessional = clipChars(`${when}: I'm going with this: ${line.label}`, LIMITS.confessional).text;
  }
  const offers = Array.isArray(v.offers) ? v.offers.filter(isObject) : [];
  if (offers.length && pick('accept', 3) === 0) reply.accept = [offers[pick('offer', offers.length)].id];
  const others = (Array.isArray(v.cast) ? v.cast : []).filter(r => isObject(r) && typeof r.id === 'string' && r.id !== you.id);
  if (pick('say', 3) === 0) reply.say = { text: reply.move ? 'Busy hour. Stay out of my way.' : 'Still here.' };
  if (others.length && pick('message', 4) === 0) reply.message = { to: others[pick('to', others.length)].id, text: `${when}: you around? It's ${you.name ?? you.id}.` };
  return reply;
}

/** A journal with no model: three lines and an ask, from the view. */
export function legalJournal(view) {
  const you = isObject(view?.you) ? view.you : {};
  const day = Number.isInteger(view?.clock?.day) ? view.clock.day - 1 : 0;
  return {
    believe: `Day ${day} is done and I have $${you.worth ?? 0} to my name.`,
    trust: 'I trust nobody yet.',
    tomorrow: 'Tomorrow, more of the same, and faster.',
    ask: 'Spend my points on whatever keeps me alive.',
  };
}

// The next effort down for the cut-off second try, or null at the lowest.
export const effortBelow = effort => {
  const i = CLAUDE_EFFORTS.indexOf(effort);
  return i > 0 ? CLAUDE_EFFORTS[i - 1] : null;
};
// A Claude seat's max_tokens and window at an effort (SEAT_DEFAULTS.claude).
export const claudeLimits = effort => ({ maxTokens: SEAT_DEFAULTS.claude.maxTokensByEffort[effort], timeoutMs: SEAT_DEFAULTS.claude.timeoutMsByEffort[effort] });

// One seat as given -> its settings: { agentId, model, api, effort, maxTokens, timeoutMs }. Throws on a bad seat. A
// Claude seat's max_tokens and window come from its effort unless the seat names its own.
export function seatSettings(s, { maxTokens = SEAT_DEFAULTS.maxTokens, timeoutMs = SEAT_DEFAULTS.timeoutMs } = {}) {
  if (!isObject(s) || typeof s.agentId !== 'string' || !s.agentId || typeof s.model !== 'string' || !s.model) throw new Error('each seat is { agentId, model, api?, effort? }, with agentId and model strings');
  const api = s.api ?? 'openrouter';
  if (!APIS.includes(api)) throw new Error(`seat ${s.agentId}: api is ${APIS.map(a => `'${a}'`).join(' or ')}, not ${JSON.stringify(s.api)}`);
  const effort = s.effort ?? null;
  if (effort !== null && api !== 'claude') throw new Error(`seat ${s.agentId}: effort is for claude seats (OpenRouter seats think at minimal)`);
  if (effort !== null && !CLAUDE_EFFORTS.includes(effort)) throw new Error(`seat ${s.agentId}: effort is one of ${CLAUDE_EFFORTS.join(', ')}, not ${JSON.stringify(effort)}`);
  if (api === 'claude' && !Object.hasOwn(PRICES, s.model)) throw new Error(`seat ${s.agentId}: ${s.model} has no price in anthropic.mjs PRICES (${Object.keys(PRICES).join(', ')}), so its spend can't be counted`);
  const own = (v, name) => {
    if (v === undefined || v === null) return null;
    if (!(Number.isInteger(v) && v > 0)) throw new Error(`seat ${s.agentId}: ${name} is a whole number above 0`);
    return v;
  };
  const claude = api === 'claude';
  const eff = claude ? effort ?? CLAUDE_THINKING.on.output_config.effort : null;
  return {
    agentId: s.agentId, model: s.model, api, effort: eff,
    maxTokens: own(s.maxTokens, 'maxTokens') ?? (claude ? claudeLimits(eff).maxTokens : maxTokens),
    timeoutMs: own(s.timeoutMs, 'timeoutMs') ?? (claude ? claudeLimits(eff).timeoutMs : api === 'local' ? SEAT_DEFAULTS.local.timeoutMs : timeoutMs),
  };
}

export function createAiSeats({
  seats,
  transport,
  keyFile = SEAT_DEFAULTS.keyFile,
  maxCost,
  go,
  concurrency = SEAT_DEFAULTS.concurrency,
  timeoutMs = SEAT_DEFAULTS.timeoutMs,
  fake,
  // All optional:
  // claudeKeyFile: the Claude API's key file (default ~/.config/anthropic/key), read only for a live run with a
  //   claude seat; fakeClaude: the Messages fake (a fakeMessages() instance, or { script } options for one);
  // fetch: the fetch every live client calls (tests inject a fake's); url / claudeUrl / localUrl: the endpoints;
  // clock: { now, setTimeout, clearTimeout } (manualClock() in tests); maxTokens, retries: OpenRouter request settings;
  // onCall(record): every request as it ends, with its seat model; onHalt(halt): the run stopped calling;
  // onReply(record): reply text per HTTP attempt; onTurn(record): one record per finished turn;
  // spent: { cost, calls } already spent by this run before a pause; fakeBrain({ agentId, view, kind }): what the
  //   fake answers when nothing is scripted; fallback({ agentId, view, why }): the choice a failed turn plays.
  claudeKeyFile = CLAUDE_KEY_FILE,
  fakeClaude,
  fetch: injectedFetch,
  url,
  claudeUrl,
  localUrl = SEAT_DEFAULTS.local.url,
  clock = REAL_CLOCK,
  maxTokens = SEAT_DEFAULTS.maxTokens,
  retries = SEAT_DEFAULTS.retries,
  onCall = null,
  onReply = null,
  onHalt = null,
  onTurn = null,
  spent = null,
  fakeBrain = null,
  fallback = null,
} = {}) {
  if (!Array.isArray(seats) || seats.length === 0) throw new Error('createAiSeats needs seats: [{ agentId, model, api?, effort? }]');
  if (!(Number.isFinite(timeoutMs) && timeoutMs > 0)) throw new Error('timeoutMs is a number of ms above 0');
  const byAgent = new Map();
  for (const s of seats) {
    const seat = seatSettings(s, { maxTokens, timeoutMs });
    if (byAgent.has(seat.agentId)) throw new Error(`seat ${seat.agentId} is listed twice`);
    byAgent.set(seat.agentId, seat);
  }
  const live = transport === 'live' || transport === 'openrouter';
  if (!live && transport !== 'fake') throw new Error(`transport is 'live' (or 'openrouter') or 'fake', not ${JSON.stringify(transport)}`);
  if (!(Number.isInteger(concurrency) && concurrency >= 1)) throw new Error('concurrency is a whole number of at least 1');
  if (!(Number.isInteger(retries) && retries >= 0)) throw new Error('retries is a whole number of at least 0');
  const uses = api => [...byAgent.values()].some(s => s.api === api);
  const paid = PAID_APIS.some(uses);

  const spend = { cost: Number.isFinite(spent?.cost) ? spent.cost : 0, calls: Number.isInteger(spent?.calls) ? spent.calls : 0 };
  const perModel = {};
  const costed = {};
  const latencies = {};
  const entryFor = model => {
    if (!perModel[model]) {
      const seatsOf = [...byAgent.values()].filter(s => s.model === model);
      perModel[model] = {
        api: seatsOf[0]?.api ?? null, efforts: [...new Set(seatsOf.map(s => s.effort).filter(Boolean))], seats: seatsOf.length,
        calls: 0, in: 0, out: 0, reasoning: null, cost: 0, failed: 0, skipped: 0, cutoffs: 0, fallbacks: 0, rescued: 0, finishes: {}, medianMs: null, p90Ms: null,
      };
      costed[model] = 0;
      latencies[model] = [];
    }
    return perModel[model];
  };
  for (const { model } of byAgent.values()) entryFor(model);
  const log = [];
  const turns = [];
  const failed = { turns: 0, journals: 0, skipped: 0 };
  const callNo = new Map([...byAgent.keys()].map(id => [id, 0]));
  const turnUse = new Map();
  const pending = new Map();
  // seat#call -> { from, to } for the cut-off second try's calls, so their records say so.
  const fallbackCalls = new Map();
  let halt = null;
  const setHalt = (kind, why) => {
    if (halt) return;
    halt = { kind, why: String(why) };
    if (onHalt) onHalt(halt);
  };

  // Every request as it ends, from any client's onCall or the fake chat path below: the spend by model, the turn's
  // usage, the log. Latency counts requests that got an answer (a timeout's wait is the window, not the model).
  function record(r) {
    const seat = byAgent.get(r.seat);
    const model = seat ? seat.model : 'unknown';
    const st = entryFor(model);
    const tin = r.tokens && Number.isFinite(r.tokens.in) ? r.tokens.in : 0;
    const tout = r.tokens && Number.isFinite(r.tokens.out) ? r.tokens.out : 0;
    const think = r.tokens && Number.isFinite(r.tokens.reasoning) ? r.tokens.reasoning : null;
    const cost = Number.isFinite(r.cost) ? r.cost : 0;
    st.calls += 1;
    st.in += tin;
    st.out += tout;
    if (think !== null) st.reasoning = (st.reasoning ?? 0) + think;
    st.cost += cost;
    if (Number.isFinite(r.cost)) costed[model] += 1;
    if (r.finish !== null && r.finish !== undefined) {
      st.finishes[r.finish] = (st.finishes[r.finish] ?? 0) + 1;
      if (CUT_OFF.has(r.finish)) st.cutoffs += 1;
    }
    if (r.status !== null && r.status !== undefined && Number.isFinite(r.ms)) {
      const list = latencies[model];
      list.push(r.ms);
      list.sort((a, b) => a - b);
      st.medianMs = percentile(list, 0.5);
      st.p90Ms = percentile(list, 0.9);
    }
    const u = turnUse.get(`${r.seat}#${r.call}`);
    if (u) {
      u.in += tin;
      u.out += tout;
      if (think !== null) u.reasoning = (u.reasoning ?? 0) + think;
      u.cost += cost;
    }
    const fb = fallbackCalls.get(`${r.seat}#${r.call}`);
    const line = { ...r, served: r.model ?? null, model, api: seat ? seat.api : null, ...(fb ? { fallback: { ...fb } } : {}) };
    log.push(line);
    if (onCall) onCall(line);
  }
  const parseFor = (kind, raw, view) => (kind === 'journal' ? parseJournal(raw) : parseReply(raw, view));
  function recordReply(r) {
    const p = pending.get(`${r.seat}#${r.call}`);
    // Reply text and its own facts only. Never a request, a response, headers, an error body or a prompt.
    if (p) p.attempts.push({ call: r.call, try: r.try, status: r.status, finish: r.finish, raw: r.raw });
    if (!onReply) return;
    const seat = byAgent.get(r.seat);
    const c = p?.view?.clock;
    const parse = typeof r.raw === 'string' ? parseFor(p?.kind, r.raw, p?.view) : { ok: false, why: 'no reply text' };
    onReply({ seat: r.seat, model: seat?.model ?? null, api: seat?.api ?? null, kind: p?.kind ?? null,
      hour: c ? { t: c.t, day: c.day, hour: c.hour } : null,
      call: r.call, try: r.try, finish: r.finish, status: r.status, raw: r.raw,
      parse, fallback: fallbackCalls.get(`${r.seat}#${r.call}`) ?? null });
  }
  const clientHalt = h => setHalt(h.halt || 'cap', h.message);
  const capOn = Number.isFinite(maxCost) && maxCost > 0;

  // The route for each API: { send, endpoint }. Live clients share `spend` as their tally, so one cap counts them all.
  const routes = {};
  const clients = [];
  let chatFake = null, messagesFake = null;
  if (live) {
    // A paid seat needs the cap and the go words. A run of local seats only is free and needs neither.
    if (paid && !capOn) throw new Error('a live run refuses to start without maxCost (dollars, above 0)');
    if (paid && (typeof go !== 'string' || !go.trim())) throw new Error("a live run refuses to start without go (slime's go words)");
    // Tests never reach a real key, the network or the Mac's own model.
    if (process.env.NODE_TEST_CONTEXT) {
      const realFetch = typeof injectedFetch !== 'function' || injectedFetch === globalThis.fetch;
      if (realFetch || (uses('openrouter') && keyFile === SEAT_DEFAULTS.keyFile) || (uses('claude') && claudeKeyFile === CLAUDE_KEY_FILE)) {
        throw new Error('under node --test a live run needs an injected fetch and temp key files');
      }
    }
    const send = injectedFetch ?? globalThis.fetch;
    if (uses('openrouter')) {
      const c = openRouter({ fetch: send, key: readKey(keyFile), maxCost, clock, tally: spend, onCall: record, onHalt: clientHalt, onReply: recordReply });
      clients.push(c);
      routes.openrouter = { send: c.fetch, endpoint: url ?? SEAT_DEFAULTS.url, preflight: () => c.preflight(url ?? SEAT_DEFAULTS.url), keyUsage: () => c.keyUsage(url ?? SEAT_DEFAULTS.url) };
    }
    if (uses('claude')) {
      const c = claudeApi({ fetch: send, key: readKey(claudeKeyFile), maxCost, clock, tally: spend, onCall: record, onHalt: clientHalt, onReply: recordReply });
      clients.push(c);
      routes.claude = { send: c.fetch, endpoint: claudeUrl ?? CLAUDE_URL };
    }
    if (uses('local')) {
      // The Mac's own model: the OpenRouter client again, pointed at this machine. No key file is read, the
      // placeholder word is taken back off each request, and a reply with no cost adds nothing to the tally.
      if (!LOOPBACK.includes(new URL(localUrl).hostname)) throw new Error(`a local seat only calls this machine (127.0.0.1), not ${new URL(localUrl).hostname}`);
      const bare = (u, init = {}) => {
        const headers = new Headers(init.headers);
        headers.delete('authorization');
        return send(u, { ...init, headers });
      };
      const c = openRouter({ fetch: bare, key: LOCAL_WORD, maxCost: capOn ? maxCost : Number.MAX_SAFE_INTEGER, clock, tally: spend, onCall: record, onHalt: clientHalt, onReply: recordReply });
      clients.push(c);
      routes.local = { send: c.fetch, endpoint: localUrl };
    }
  } else {
    const botFor = request => {
      const p = pending.get(`${request.seat}#${request.call}`);
      if (!p) throw new Error(`no view for ${request.seat} call ${request.call}`);
      if (fakeBrain) return fakeBrain({ agentId: request.seat, view: p.view, kind: p.kind });
      return p.kind === 'journal' ? legalJournal(p.view) : legalReply(p.view);
    };
    if (uses('openrouter') || uses('local')) {
      // A chat fake given whole is used as it is; otherwise one is made here, its unscripted calls played by botFor.
      const own = !(fake && typeof fake.fetch === 'function');
      chatFake = own ? fakeModel({ script: fake?.script ?? {}, tape: fake?.tape ?? null, hooks: { bot: botFor, ...(fake?.hooks || {}) }, clock }) : fake;
      // The fake chat path's own accounting, in the client's record shape; a maxCost, when given, caps it like the client.
      const send = async (u, init) => {
        const headers = new Headers(init.headers);
        const seat = headers.get(SEAT_HEADER), call = Number(headers.get(CALL_HEADER)) || null;
        if (capOn && spend.cost >= maxCost) setHalt('cap', `the spend reached the cap: $${spend.cost.toFixed(4)} of $${maxCost} after ${spend.calls} calls`);
        if (halt) throw new Error(`no call once the run has stopped: ${halt.why}`);
        const start = clock.now();
        let res, text;
        try {
          res = await chatFake.fetch(u, init);
          text = await res.text();
        } catch (e) {
          recordReply({ seat, call, try: 1, status: null, finish: null, raw: null });
          spend.calls += 1;
          record({ seat, call, try: 1, status: null, finish: null, cost: null, provider: null, model: null, tokens: null, ms: clock.now() - start, why: init.signal && init.signal.aborted ? 'aborted' : 'failed' });
          throw e;
        }
        const body = parsed(text);
        const usage = isObject(body) && isObject(body.usage) ? body.usage : null;
        const cost = usage && Number.isFinite(usage.cost) ? usage.cost : null;
        const choice = isObject(body) && Array.isArray(body.choices) ? body.choices[0] : null;
        recordReply({ seat, call, try: 1, status: res.status, finish: choice?.finish_reason ?? null, raw: typeof choice?.message?.content === 'string' ? choice.message.content : null });
        spend.calls += 1;
        if (cost !== null) spend.cost += cost;
        record({
          seat, call, try: 1, status: res.status, finish: (choice && choice.finish_reason) ?? null, cost, provider: null,
          model: (isObject(body) && body.model) ?? null,
          tokens: usage ? { in: usage.prompt_tokens ?? null, out: usage.completion_tokens ?? null, reasoning: usage.completion_tokens_details?.reasoning_tokens ?? null } : null,
          ms: clock.now() - start,
        });
        if (capOn && spend.cost >= maxCost) setHalt('cap', `the spend reached the cap: $${spend.cost.toFixed(4)} of $${maxCost} after ${spend.calls} calls`);
        return new Response(text, { status: res.status });
      };
      routes.openrouter = { send, endpoint: url ?? SEAT_DEFAULTS.fakeUrl };
      routes.local = routes.openrouter;
    }
    if (uses('claude')) {
      // The real Claude client over a Messages-format fake: the body conversion, pricing, waits and halts all run.
      const own = !(fakeClaude && typeof fakeClaude.fetch === 'function');
      messagesFake = own ? fakeMessages({ script: fakeClaude?.script ?? {}, bot: botFor, clock }) : fakeClaude;
      const c = claudeApi({
        fetch: messagesFake.fetch, key: FAKE_CLAUDE_KEY, maxCost: capOn ? maxCost : Number.MAX_SAFE_INTEGER,
        clock, tally: spend, onCall: record, onHalt: clientHalt, onReply: recordReply,
      });
      clients.push(c);
      routes.claude = { send: c.fetch, endpoint: claudeUrl ?? SEAT_DEFAULTS.claude.fakeUrl };
    }
  }

  // Any client's halt, mirrored here once it is set (a call that crossed the cap still returns its reply).
  const syncHalt = () => {
    for (const c of clients) if (c.halted && !halt) setHalt(c.halted.halt || 'cap', c.halted.message);
    return halt;
  };
  const haltWhy = () => (halt.kind === 'cap' ? 'capped' : `halted: ${halt.kind}`);

  // The request body for one seat's prompt, in the chat shape every client takes. OpenRouter: the client's fields,
  // thinking minimal (or off), max_tokens, JSON mode, the cache mark where the model needs one. Claude: adaptive
  // thinking at the seat's effort, the seat's max_tokens, the system text cache-marked (the Messages client keeps the
  // mark; it drops chat-only fields and has no JSON mode). Local: the plain chat fields the Mac's server takes.
  function bodyFor(seat, prompt) {
    const messages = [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }];
    if (seat.api === 'claude') {
      return cacheMarked({ model: seat.model, messages, ...claudeFields({ thinking: true, model: seat.model, effort: seat.effort }), max_tokens: seat.maxTokens }, prompt.system);
    }
    if (seat.api === 'local') {
      return { model: seat.model, messages, max_tokens: seat.maxTokens, response_format: { type: 'json_object' }, chat_template_kwargs: { enable_thinking: false } };
    }
    const body = {
      model: seat.model,
      messages,
      ...openRouterFields(),
      reasoning: { ...byPrefix(SEAT_DEFAULTS.reasoningByModel, seat.model, SEAT_DEFAULTS.reasoning) },
      max_tokens: seat.maxTokens,
      ...(byPrefix(SEAT_DEFAULTS.jsonModeByModel, seat.model, SEAT_DEFAULTS.jsonMode) ? { response_format: { type: 'json_object' } } : {}),
    };
    return needsCacheMark(seat.model) ? cacheMarked(body, prompt.system) : body;
  }

  // One request inside the window of `seat` (its settings, or the second try's): { kind: 'reply', status, text } |
  // { kind: 'timeout' | 'halted' | 'error' }.
  async function once(seat, call, bodyText) {
    const { send, endpoint } = routes[seat.api];
    const stop = new AbortController();
    let late = false;
    const timer = clock.setTimeout(() => {
      late = true;
      stop.abort(new Error(`no reply inside ${seat.timeoutMs} ms`));
    }, seat.timeoutMs);
    try {
      const res = await send(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [SEAT_HEADER]: seat.agentId, [CALL_HEADER]: String(call) },
        body: bodyText,
        signal: stop.signal,
      });
      return { kind: 'reply', status: res.status, text: await res.text() };
    } catch (e) {
      if (late) return { kind: 'timeout', message: `no reply inside ${seat.timeoutMs} ms` };
      if (syncHalt()) return { kind: 'halted', message: halt.why };
      return { kind: 'error', message: short(e && e.message !== undefined ? e.message : e) };
    } finally {
      clock.clearTimeout(timer);
    }
  }

  // One seat's turn (or its journal): never throws. Its attempts at the seat's settings, then, for a Claude reply cut
  // off with no valid answer, the same at the next lower effort once.
  async function turn({ agentId, view }, kind) {
    const start = clock.now();
    const seat = byAgent.get(agentId);
    const usage = { in: 0, out: 0, reasoning: null, cost: 0 };
    const attemptsMade = [];
    const out = {
      reply: null, ok: false, why: null, usage, ms: 0, raw: null, model: seat ? seat.model : null, api: seat ? seat.api : null,
      effort: seat ? seat.effort : null, tries: 0, finish: null, parsed: false, trimmed: [], dropped: [], fallback: null, kind,
    };
    let prompt = null;
    const done = () => {
      out.ms = clock.now() - start;
      if (!out.ok) {
        const skipped = out.tries === 0 && (out.why === 'capped' || String(out.why).startsWith('halted'));
        if (seat && out.tries > 0) perModel[seat.model].failed += 1;
        else if (seat && skipped) perModel[seat.model].skipped += 1;
        if (skipped) failed.skipped += 1;
        else if (kind === 'journal') failed.journals += 1;
        else failed.turns += 1;
      }
      const c = view?.clock;
      const base = {
        t: Number.isInteger(c?.t) ? c.t : null, agentId, kind, model: out.model, api: out.api, effort: out.effort,
        ok: out.ok, parsed: out.parsed, why: out.why, finish: out.finish, usage: { ...usage }, ms: out.ms, tries: out.tries,
        fallback: out.fallback ? { ...out.fallback } : null,
      };
      turns.push(base);
      if (onTurn) {
        onTurn({
          ...base, day: c?.day ?? null, hour: c?.hour ?? null,
          prompt: prompt ? { system: prompt.system.length, user: prompt.user.length } : null,
          raw: out.raw, attempts: attemptsMade.map(a => ({ ...a })), reply: out.reply, trimmed: out.trimmed, dropped: out.dropped,
        });
      }
      return out;
    };
    if (!seat) return Object.assign(out, { why: `${agentId} is not an AI seat` }) && done();
    if (syncHalt()) return Object.assign(out, { why: haltWhy() }) && done();
    let bodyText;
    try {
      prompt = render(view, { kind });
      bodyText = JSON.stringify(bodyFor(seat, prompt));
    } catch (e) {
      return Object.assign(out, { why: `render failed: ${short(e.message)}` }) && done();
    }
    await attempts(seat, bodyText, view, kind, out, usage, null, attemptsMade);
    const lower = seat.api === 'claude' && !out.ok && CUT_OFF.has(out.finish) && !syncHalt() ? effortBelow(seat.effort) : null;
    if (lower) {
      const fb = { ...seat, effort: lower, ...claudeLimits(lower) };
      out.fallback = { from: seat.effort, to: lower, ok: false };
      perModel[seat.model].fallbacks += 1;
      Object.assign(out, { reply: null, why: null, raw: null, finish: null, parsed: false, trimmed: [], dropped: [] });
      await attempts(fb, JSON.stringify(bodyFor(fb, prompt)), view, kind, out, usage, { from: seat.effort, to: lower }, attemptsMade);
      out.fallback.ok = out.ok;
      if (out.ok) perModel[seat.model].rescued += 1;
    }
    return done();
  }

  // A seat's requests at one setting (`cur`: the seat's, or the second try's), with the transport retries: the
  // model's answer, parsed into `out`, or the failure. `mark` ({ from, to }) marks the second try's calls in the log.
  async function attempts(cur, bodyText, view, kind, out, usage, mark, attemptsMade) {
    const { agentId } = cur;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (syncHalt()) {
        out.why = haltWhy();
        break;
      }
      const call = callNo.get(agentId) + 1;
      callNo.set(agentId, call);
      const key = `${agentId}#${call}`;
      turnUse.set(key, usage);
      pending.set(key, { view, kind, attempts: attemptsMade });
      if (mark) fallbackCalls.set(key, mark);
      out.tries += 1;
      const res = await once(cur, call, bodyText);
      pending.delete(key);
      turnUse.delete(key);
      fallbackCalls.delete(key);
      syncHalt();
      if (res.kind === 'timeout') {
        out.why = 'timeout';
        continue;
      }
      if (res.kind === 'halted') {
        out.why = haltWhy();
        break;
      }
      if (res.kind === 'error') {
        out.why = `transport: ${res.message}`;
        continue;
      }
      const body = parsed(res.text);
      const error = isObject(body) && isObject(body.error) ? body.error : null;
      const choice = isObject(body) && Array.isArray(body.choices) ? body.choices[0] : null;
      const content = choice && isObject(choice.message) ? choice.message.content : undefined;
      out.finish = (choice && choice.finish_reason) ?? null;
      if (res.status === 200 && !error && typeof content === 'string') {
        out.raw = content;
        out.parsed = extractJson(content) !== undefined;
        const p = parseFor(kind, content, view);
        const answer = kind === 'journal' ? p.journal : p.reply;
        if (p.ok) Object.assign(out, { ok: true, why: null, reply: answer, trimmed: p.trimmed, dropped: p.dropped });
        else {
          out.why = CUT_OFF.has(out.finish) ? `cut off: ${p.why}` : p.why;
          // A failed move keeps its talk (say, message, confessional) when the reply had any.
          if (answer) Object.assign(out, { reply: answer, trimmed: p.trimmed ?? [], dropped: p.dropped ?? [] });
        }
        // A model's answer, good or bad, is final: no transport retry (a Claude cut-off gets the second try above).
        break;
      }
      out.raw = typeof res.text === 'string' ? res.text.slice(0, 500) : null;
      const code = res.status !== 200 ? res.status : error ? Number(error.code) || null : null;
      const said = error && typeof error.message === 'string' ? `: ${short(error.message)}` : '';
      if (halt) {
        out.why = haltWhy();
        break;
      }
      if (res.status === 200 && !error) {
        out.why = 'empty reply';
        break;
      }
      out.why = `http ${code ?? res.status}${said}`;
      // Server-side, overload and rate errors are transport errors and get the retry; other 4xx answers are final.
      if (code === null || code === 408 || code === 429 || code >= 500) continue;
      break;
    }
  }

  // One wave of calls, in parallel up to the cap: Map agentId -> result, in sorted agent-id order.
  async function ask(batch, kind = 'turn') {
    if (!Array.isArray(batch)) throw new Error('decide takes [{ agentId, view }]');
    if (kind !== 'turn' && kind !== 'journal') throw new Error(`a call is a 'turn' or a 'journal', not ${JSON.stringify(kind)}`);
    const items = [...batch].sort((a, b) => (a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0));
    for (let i = 1; i < items.length; i++) if (items[i].agentId === items[i - 1].agentId) throw new Error(`${items[i].agentId} is in the batch twice`);
    const results = new Map();
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const item = items[next++];
        results.set(item.agentId, await turn(item, kind));
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    return new Map(items.map(it => [it.agentId, results.get(it.agentId)]));
  }

  // One hour's AI turns, as the season reads them: { agentId: reply }. A failed turn plays the fallback move, with
  // whatever talk its reply had, and is marked failed: true. A good reply has no such field.
  async function decide(batch) {
    const results = await ask(batch, 'turn');
    const views = new Map(batch.map(b => [b.agentId, b.view]));
    const replies = {};
    for (const [agentId, r] of results) {
      if (r.ok) replies[agentId] = r.reply;
      else {
        const view = views.get(agentId);
        const move = (fallback ? fallback({ agentId, view, why: r.why }) : null) ?? restChoice(view);
        r.played = move;
        // failed: true tells the season this hour was a failed one (it hands the seat to a bot after three in a row)
        replies[agentId] = { accept: [], say: null, message: null, confessional: null, ...(r.reply ?? {}), move, failed: true };
      }
    }
    return replies;
  }

  // The night's journals: { agentId: { lines, ask } }. A failed one is empty and marked failed: true.
  async function journal(batch) {
    const results = await ask(batch, 'journal');
    const out = {};
    for (const [agentId, r] of results) out[agentId] = r.ok ? r.reply : { lines: [], ask: null, failed: true };
    return out;
  }

  // Dollars for callsPerSeat more calls by every seat, at the mean cost per call each model has shown so far (a model
  // with no costed call yet uses the mean of all models): { total, perModel: { [model]: { seats, perCall, season } } },
  // total null before any call has a cost.
  function estimateDetail({ callsPerSeat } = {}) {
    if (!(Number.isFinite(callsPerSeat) && callsPerSeat >= 0)) throw new Error('estimate needs callsPerSeat, a number of at least 0');
    const models = Object.keys(perModel);
    const n = models.reduce((a, m) => a + costed[m], 0);
    const all = n > 0 ? models.reduce((a, m) => a + (costed[m] > 0 ? perModel[m].cost : 0), 0) / n : null;
    const detail = {};
    let total = 0;
    for (const { model } of byAgent.values()) {
      const each = costed[model] > 0 ? perModel[model].cost / costed[model] : all;
      // measured: false when this model has no costed call yet and borrows the other models' mean.
      const d = (detail[model] ??= { seats: 0, perCall: each, measured: costed[model] > 0, season: each === null ? null : 0 });
      d.seats += 1;
      if (each === null) total = null;
      else {
        d.season += each * callsPerSeat;
        if (total !== null) total += each * callsPerSeat;
      }
    }
    return { callsPerSeat, total, perModel: detail };
  }
  const estimate = opts => estimateDetail(opts).total;

  // Before a live run: OpenRouter's balance and key limit against maxCost (refused below it), and the Claude API's note
  // (it has no balance to read; the Console's spend limit is the hard stop). The fake has none to check.
  async function preflight() {
    if (!live) return { balance: null, left: null, usage: null, refused: null, transport: 'fake' };
    const or = routes.openrouter?.preflight ? await routes.openrouter.preflight() : { balance: null, left: null, usage: null, refused: null };
    return { ...or, ...(routes.claude ? { claude: CLAUDE_NOTE } : {}) };
  }

  // OpenRouter's key usage in dollars, read again at the end for what the run was billed (null without OpenRouter seats).
  async function keyUsage() {
    return routes.openrouter?.keyUsage ? routes.openrouter.keyUsage() : null;
  }

  // Ends the fakes this made (open calls dropped, timers cleared). A fake given whole is the caller's to close.
  async function close() {
    if (chatFake && chatFake !== fake) await chatFake.close();
    if (messagesFake && messagesFake !== fakeClaude) await messagesFake.close();
  }

  return {
    decide, journal, ask, estimate, estimateDetail, preflight, keyUsage, close,
    spend, perModel, log, turns, failed, transport: live ? 'live' : 'fake', paid,
    seats: [...byAgent.values()].map(s => ({ ...s })),
    go: go ?? null,
    maxCost: capOn ? maxCost : null,
    limits: { ...LIMITS },
    get capped() {
      return !!syncHalt() && halt.kind === 'cap';
    },
    get halted() {
      return syncHalt() ? { ...halt } : null;
    },
    get fake() {
      return chatFake;
    },
    get fakeClaude() {
      return messagesFake;
    },
  };
}
