// The AI seats and every cost guard (SPEC sections 1 and 18): fake transports only. No test here reaches a real
// key, the network or the Mac's own model.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAiSeats, legalReply, legalJournal, restChoice, effortBelow, claudeLimits, stableHash } from '../../src/seats/ai.mjs';
import { parseReply, parseJournal } from '../../src/seats/reply.mjs';
import { render } from '../../src/seats/prompt.mjs';
import { SEAT_DEFAULTS, APIS, PAID_APIS } from '../../src/seats/defaults.mjs';
import { CLAUDE_KEY_FILE, PRICES } from '../../src/seats/anthropic.mjs';
import { fakeModel, manualClock } from '../../src/seats/fake-model.mjs';
import { fakeMessages } from '../../src/seats/fake-messages.mjs';
import { createGame } from '../../src/season.mjs';
import { chooseFromMenu } from '../../src/menu.mjs';
import { tempDir, fakeKeyFile, KEY_WORD, completion, stubFetch, replyText, drive, viewsOf, playedViews } from './helpers.mjs';

const GPT = 'openai/gpt-6.1-sol';
const GEMINI = 'google/gemini-3.8-flash';
const KIMI = 'moonshotai/kimi-k3.1-pro';
const SONNET = 'claude-sonnet-5-5';
const HAIKU = 'claude-haiku-5-5';
const FAKE_URL = 'http://fake.invalid/v1/chat/completions';
const hourZero = () => viewsOf(createGame({ seed: 1 })).views;
const restOf = view => view.menu.find(m => m.verb === 'rest').id;
const ask = (views, ids) => ids.map(agentId => ({ agentId, view: views[agentId] }));

test('the fake transport plays a legal move for every seat, for $0, and decide() hands the season plain replies', async () => {
  const views = hourZero();
  const ids = Object.keys(views);
  const seats = createAiSeats({ seats: ids.map(agentId => ({ agentId, model: GPT })), transport: 'fake', concurrency: 10 });
  const replies = await seats.decide(ask(views, ids));
  assert.deepEqual(Object.keys(replies).sort(), [...ids].sort());
  for (const id of ids) {
    const r = replies[id];
    assert.deepEqual(Object.keys(r).sort(), ['accept', 'confessional', 'message', 'move', 'say']);
    assert.ok(chooseFromMenu(views[id].menu, r.move), `${id}: ${JSON.stringify(r.move)} is on its menu`);
    assert.ok(r.confessional.length > 0 && r.confessional.length <= 240);
    assert.equal('failed' in r, false, 'a good reply has no failed field');
  }
  assert.equal(seats.spend.cost, 0);
  assert.equal(seats.spend.calls, 10);
  assert.deepEqual(seats.failed, { turns: 0, journals: 0, skipped: 0 });
  assert.equal(seats.transport, 'fake');
  assert.deepEqual(await seats.preflight(), { balance: null, left: null, usage: null, refused: null, transport: 'fake' });
  await seats.close();
});

test('legalReply is deterministic and always parses, across a day of real views', () => {
  for (const view of playedViews({ seed: 7, hours: 12 }).views) {
    const a = legalReply(view);
    assert.deepEqual(legalReply(view), a);
    assert.equal(parseReply(JSON.stringify(a), view).ok, true);
  }
  assert.equal(stableHash('a1|3|move'), stableHash('a1|3|move'));
  assert.equal(legalReply({ you: { id: 'a1' }, clock: { t: 3 }, menu: [] }).move, null);
  assert.equal(parseJournal(JSON.stringify(legalJournal(hourZero().a1))).journal.lines.length, 3);
});

test('request settings: thinking minimal (off for Anthropic), max_tokens 2000, JSON mode, the cache mark, the prompt', async () => {
  const views = hourZero();
  const models = [GEMINI, GPT, KIMI, 'anthropic/claude-haiku-5.5'];
  const ids = ['a1', 'a2', 'a3', 'a4'];
  const seats = createAiSeats({ seats: ids.map((agentId, i) => ({ agentId, model: models[i] })), transport: 'fake' });
  await seats.decide(ask(views, ids));
  for (const [i, id] of ids.entries()) {
    const body = seats.fake.calls.find(c => c.seat === id).request;
    const { system, user } = render(views[id]);
    assert.equal(body.model, models[i]);
    assert.equal(body.max_tokens, 2000);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.deepEqual(body.usage, { include: true });
    assert.deepEqual(body.reasoning, models[i].startsWith('anthropic/') ? { enabled: false } : { effort: 'minimal' });
    assert.deepEqual(body.messages[1], { role: 'user', content: user });
    if (models[i].startsWith('google/') || models[i].startsWith('anthropic/')) {
      assert.deepEqual(body.messages[0].content, [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]);
    } else assert.equal(body.messages[0].content, system);
  }
  await seats.close();
});

test('a Claude seat goes through the real Messages client: thinking at its effort, the system text cache-marked, priced from PRICES', async () => {
  const views = hourZero();
  const seats = createAiSeats({ seats: [{ agentId: 'a1', model: SONNET, api: 'claude', effort: 'xhigh' }, { agentId: 'a2', model: HAIKU, api: 'claude' }], transport: 'fake' });
  const out = await seats.ask(ask(views, ['a1', 'a2']));
  assert.equal(out.get('a1').ok, true, out.get('a1').why);
  const sent = seats.fakeClaude.calls.find(c => c.seat === 'a1').request;
  assert.deepEqual(sent.thinking, { type: 'adaptive' });
  assert.deepEqual(sent.output_config, { effort: 'xhigh' });
  assert.equal(sent.max_tokens, 32000);
  assert.deepEqual(sent.system, [{ type: 'text', text: render(views.a1).system, cache_control: { type: 'ephemeral' } }]);
  assert.equal('response_format' in sent, false);
  assert.equal(seats.fakeClaude.calls.find(c => c.seat === 'a2').request.output_config.effort, 'high', "the client's default effort");
  // the fake's usage is priced, so a fake run shows the shape of a bill
  assert.ok(out.get('a1').usage.cost > 0 && seats.spend.cost > 0);
  assert.ok(Math.abs(seats.spend.cost - out.get('a1').usage.cost - out.get('a2').usage.cost) < 1e-12, 'one tally');
  assert.deepEqual([effortBelow('max'), effortBelow('xhigh'), effortBelow('high'), effortBelow('low')], ['xhigh', 'high', 'medium', null]);
  assert.deepEqual(claudeLimits('max'), { maxTokens: 64000, timeoutMs: 600000 });
  await seats.close();
});

test('a timeout becomes a failed turn after one retry, and the seat plays the fallback: the menu\'s rest', async () => {
  const clock = manualClock();
  const views = hourZero();
  const seats = createAiSeats({ seats: [{ agentId: 'a3', model: GPT }], transport: 'fake', clock, fake: { script: { a3: [{ fault: 'hang' }, { fault: 'hang' }] } } });
  const replies = await drive(seats.decide(ask(views, ['a3'])), clock, 10000, 100);
  assert.deepEqual(replies.a3, { accept: [], say: null, message: null, confessional: null, move: { id: restOf(views.a3) }, failed: true });
  assert.deepEqual(chooseFromMenu(views.a3.menu, replies.a3.move), { verb: 'rest' });
  const t = seats.turns[0];
  assert.deepEqual([t.ok, t.why, t.tries, t.kind], [false, 'timeout', 2, 'turn']);
  assert.ok(t.ms >= 2 * SEAT_DEFAULTS.timeoutMs);
  assert.deepEqual(seats.failed, { turns: 1, journals: 0, skipped: 0 });
  assert.equal(seats.perModel[GPT].failed, 1);
  assert.equal(seats.perModel[GPT].calls, 2);
  assert.equal(seats.spend.calls, 2, 'a retry is a call too');
  await seats.close();
});

test('a retry after a timeout can still win the turn; a model reply that fails to parse is not retried and keeps its talk', async () => {
  const clock = manualClock();
  const views = hourZero();
  const bad = JSON.stringify({ move: { id: 'm999' }, say: 'I meant well.', confessional: 'Wrong button.' });
  const seats = createAiSeats({
    seats: ['a3', 'a4', 'a5', 'a6'].map(agentId => ({ agentId, model: GPT })), transport: 'fake', clock,
    fake: { script: { a3: [{ fault: 'hang' }, { bot: true }], a4: [{ fault: 'malformed' }], a5: [{ content: bad }], a6: [{ content: `{"move":{"id":"${restOf(views.a6)}"},"confessional":"cut off mid-thou`, finish: 'length' }] } },
    fallback: ({ view, why }) => (why.startsWith('no JSON') ? { id: view.menu[0].id } : null),
  });
  const out = await drive(seats.ask(ask(views, ['a3', 'a4', 'a5', 'a6'])), clock, 10000, 100);
  assert.equal(out.get('a3').ok, true, out.get('a3').why);
  assert.equal(out.get('a3').tries, 2);
  assert.deepEqual([out.get('a4').ok, out.get('a4').why, out.get('a4').tries, out.get('a4').raw], [false, 'no JSON object in the reply', 1, '{ this reply is not JSON }']);
  assert.deepEqual([out.get('a5').ok, out.get('a5').why, out.get('a5').tries], [false, 'move "m999" is not on the menu', 1]);
  assert.deepEqual(out.get('a5').reply.say, { text: 'I meant well.' });
  // a reply cut off after a whole move: the repair saves the turn
  assert.deepEqual([out.get('a6').ok, out.get('a6').finish, out.get('a6').reply.confessional], [true, 'length', 'cut off mid-thou']);
  assert.deepEqual(seats.failed, { turns: 2, journals: 0, skipped: 0 });

  // decide(): the failed seats play the fallback (the runner's hook, else rest) and keep what they said
  const clock2 = manualClock();
  const again = createAiSeats({
    seats: ['a4', 'a5'].map(agentId => ({ agentId, model: GPT })), transport: 'fake', clock: clock2,
    fake: { script: { a4: [{ fault: 'malformed' }], a5: [{ content: bad }] } },
    fallback: ({ view, why }) => (why.startsWith('no JSON') ? { id: view.menu[0].id } : null),
  });
  const replies = await drive(again.decide(ask(views, ['a4', 'a5'])), clock2, 1000, 10);
  assert.deepEqual(replies.a4.move, { id: views.a4.menu[0].id }, "the runner's fallback");
  assert.equal(replies.a4.failed, true);
  assert.deepEqual(replies.a5, { move: { id: restOf(views.a5) }, accept: [], say: { text: 'I meant well.' }, message: null, confessional: 'Wrong button.', failed: true });
  await seats.close();
  await again.close();
});

test('arrival order does not change the results', async () => {
  const views = hourZero();
  const ids = ['a1', 'a2', 'a3', 'a4'];
  async function run(delays) {
    const clock = manualClock();
    const script = Object.fromEntries(ids.map((id, i) => [id, [{ bot: true, delayMs: delays[i] }]]));
    const seats = createAiSeats({ seats: ids.map(agentId => ({ agentId, model: GPT })), transport: 'fake', clock, fake: { script } });
    const out = await drive(seats.ask([...ask(views, ids)].reverse()), clock, 50, 100);
    const finished = [...seats.fake.calls].sort((a, b) => a.start + a.ms - (b.start + b.ms)).map(c => c.seat);
    await seats.close();
    return { out, finished };
  }
  const a = await run([400, 300, 200, 100]);
  const b = await run([100, 200, 300, 400]);
  assert.notDeepEqual(a.finished, b.finished, 'the replies landed in different orders');
  assert.deepEqual([...a.out.keys()], ids);
  for (const id of ids) {
    const { ms: _a, ...ra } = a.out.get(id);
    const { ms: _b, ...rb } = b.out.get(id);
    assert.deepEqual(ra, rb, id);
  }
});

test('the hard stop: the spend cap stops calls (fake transport with costed replies)', async () => {
  const views = hourZero();
  const usage = { prompt_tokens: 1000, completion_tokens: 60, total_tokens: 1060, cost: 0.006 };
  const script = { a1: [{ content: replyText({ id: restOf(views.a1) }), usage }], a2: [{ content: replyText({ id: restOf(views.a2) }), usage }] };
  const halts = [];
  const seats = createAiSeats({
    seats: [{ agentId: 'a1', model: GPT }, { agentId: 'a2', model: KIMI }], transport: 'fake', maxCost: 0.01,
    concurrency: 1, fake: { script }, onHalt: h => halts.push(h.kind),
  });
  assert.equal(seats.estimate({ callsPerSeat: 65 }), null);
  const hour1 = await seats.ask(ask(views, ['a1', 'a2']));
  // the call that crossed the cap was paid for, so its reply stands
  assert.equal(hour1.get('a1').ok, true);
  assert.equal(hour1.get('a2').ok, true);
  assert.deepEqual(hour1.get('a2').usage, { in: 1000, out: 60, reasoning: null, cost: 0.006 });
  assert.equal(seats.capped, true);
  assert.deepEqual(halts, ['cap']);
  const hour2 = await seats.ask(ask(views, ['a1', 'a2']));
  for (const r of hour2.values()) assert.deepEqual([r.ok, r.why, r.tries], [false, 'capped', 0]);
  assert.equal(seats.fake.calls.length, 2, 'no call after the cap');
  assert.equal(seats.spend.calls, 2);
  assert.ok(Math.abs(seats.spend.cost - 0.012) < 1e-12);
  assert.deepEqual(seats.failed, { turns: 0, journals: 0, skipped: 2 });
  assert.equal(seats.perModel[GPT].skipped, 1);
  assert.equal(seats.halted.kind, 'cap');
  assert.ok(Math.abs(seats.estimate({ callsPerSeat: 65 }) - 0.006 * 65 * 2) < 1e-9);
  // once capped, decide() still answers: every seat rests, and the journals come back empty
  const replies = await seats.decide(ask(views, ['a1', 'a2']));
  assert.deepEqual(replies.a1.move, { id: restOf(views.a1) });
  assert.equal(replies.a1.failed, true, 'a turn the hard stop swallowed is a failed hour too');
  assert.deepEqual(await seats.journal(ask(views, ['a1'])), { a1: { lines: [], ask: null, failed: true } });
  assert.equal(seats.fake.calls.length, 2);
  await seats.close();
});

test('the hard stop through the real OpenRouter client (fake fetch, temp key), and a tally carried over a pause', async t => {
  const dir = tempDir(t);
  const views = hourZero();
  const usage = { prompt_tokens: 1200, completion_tokens: 80, total_tokens: 1280, cost: 0.006 };
  const fake = fakeModel({ script: { a1: [{ content: replyText({ id: restOf(views.a1) }), usage }], a2: [{ content: replyText({ id: restOf(views.a2) }), usage }] } });
  const seats = createAiSeats({
    seats: [{ agentId: 'a1', model: KIMI }, { agentId: 'a2', model: GPT }], transport: 'live',
    keyFile: fakeKeyFile(dir), maxCost: 0.01, go: 'test go words', fetch: fake.fetch, url: FAKE_URL, concurrency: 1,
  });
  assert.equal(seats.go, 'test go words');
  assert.equal(seats.transport, 'live');
  const hour1 = await seats.ask(ask(views, ['a1', 'a2']));
  assert.equal(hour1.get('a1').ok, true, hour1.get('a1').why);
  assert.equal(hour1.get('a2').ok, true, hour1.get('a2').why);
  assert.equal(seats.capped, true);
  const hour2 = await seats.ask(ask(views, ['a1', 'a2']));
  assert.deepEqual([...hour2.values()].map(r => [r.ok, r.why]), [[false, 'capped'], [false, 'capped']]);
  assert.equal(fake.calls.length, 2, 'no paid call after the cap');
  assert.ok(Math.abs(seats.spend.cost - 0.012) < 1e-12);
  await fake.close();

  // a run resumed after a pause starts from what it had already spent: the cap is one cap for the whole run
  const later = fakeModel({ script: {} });
  const resumed = createAiSeats({
    seats: [{ agentId: 'a1', model: KIMI }], transport: 'live', keyFile: fakeKeyFile(dir), maxCost: 0.01, go: 'go',
    fetch: later.fetch, url: FAKE_URL, spent: { cost: 0.012, calls: 2 },
  });
  const r = (await resumed.ask(ask(views, ['a1']))).get('a1');
  assert.deepEqual([r.ok, r.why, r.tries], [false, 'capped', 1]);
  assert.equal(later.calls.length, 0, 'the first request was refused before it went out');
  assert.equal(resumed.spend.calls, 2);
  await later.close();
});

test('one cap counts both transports: OpenRouter and Claude share the tally', async () => {
  const views = hourZero();
  const usage = { prompt_tokens: 1000, completion_tokens: 60, total_tokens: 1060, cost: 0.006 };
  const seats = createAiSeats({
    seats: [{ agentId: 'a1', model: GPT, api: 'openrouter' }, { agentId: 'a2', model: SONNET, api: 'claude', effort: 'high' }],
    transport: 'fake', maxCost: 0.015, concurrency: 1,
    fake: { script: { a1: [{ content: replyText({ id: restOf(views.a1) }), usage }] } },
  });
  const hour1 = await seats.ask(ask(views, ['a1', 'a2']));
  assert.equal(hour1.get('a1').ok, true);
  assert.equal(hour1.get('a2').ok, true, hour1.get('a2').why);
  assert.ok(seats.spend.cost >= 0.015, String(seats.spend.cost));
  assert.equal(seats.capped, true);
  const hour2 = await seats.ask(ask(views, ['a1', 'a2']));
  assert.deepEqual([...hour2.values()].map(r => [r.ok, r.why, r.tries]), [[false, 'capped', 0], [false, 'capped', 0]]);
  assert.equal(seats.fake.calls.length, 1);
  assert.equal(seats.fakeClaude.calls.length, 1);
  await seats.close();
});

test('a live run refuses to start without maxCost and go, and reads a key file only after both', () => {
  const seats = [{ agentId: 'a1', model: GPT }];
  const missing = '/nonexistent-hotkey2/key';
  const stub = stubFetch([]);
  for (const maxCost of [undefined, 0, -1, Number.NaN, '3']) {
    assert.throws(() => createAiSeats({ seats, transport: 'live', keyFile: missing, go: 'go', maxCost, fetch: stub }), /without maxCost/, String(maxCost));
  }
  for (const go of [undefined, '', '   ', 7]) {
    assert.throws(() => createAiSeats({ seats, transport: 'live', keyFile: missing, go, maxCost: 3, fetch: stub }), /without go/, String(go));
  }
  // the same for a Claude seat
  const claude = [{ agentId: 'a1', model: SONNET, api: 'claude' }];
  assert.throws(() => createAiSeats({ seats: claude, transport: 'live', claudeKeyFile: missing, go: 'go', fetch: stub }), /without maxCost/);
  assert.throws(() => createAiSeats({ seats: claude, transport: 'live', claudeKeyFile: missing, maxCost: 3, fetch: stub }), /without go/);
  // with both, the key file is read (and this one doesn't exist)
  assert.throws(() => createAiSeats({ seats, transport: 'live', keyFile: missing, go: 'go', maxCost: 3, fetch: stub }), /ENOENT/);
  assert.throws(() => createAiSeats({ seats: claude, transport: 'live', claudeKeyFile: missing, go: 'go', maxCost: 3, fetch: stub }), /ENOENT/);
  assert.equal(stub.seen.length, 0);
  assert.throws(() => createAiSeats({ seats, transport: 'paid' }), /transport is 'live' \(or 'openrouter'\) or 'fake'/);
  assert.throws(() => createAiSeats({ seats: [], transport: 'fake' }), /needs seats/);
  assert.deepEqual(PAID_APIS, ['openrouter', 'claude']);
});

test('under node --test the live transport refuses the real fetch and the default key files, before anything is read', t => {
  assert.ok(process.env.NODE_TEST_CONTEXT, 'this file runs under node --test');
  const dir = tempDir(t);
  const stub = stubFetch([]);
  const or = [{ agentId: 'a1', model: GPT }];
  const claude = [{ agentId: 'a1', model: SONNET, api: 'claude' }];
  // every read of a key file in this test is watched: none may touch the real ones
  const read = [];
  const real = fs.readFileSync;
  fs.readFileSync = (file, ...rest) => {
    read.push(String(file));
    return real(file, ...rest);
  };
  t.after(() => {
    fs.readFileSync = real;
  });
  // the default key files, even with an injected fetch
  assert.throws(() => createAiSeats({ seats: or, transport: 'live', go: 'go', maxCost: 3, fetch: stub }), /under node --test/);
  assert.throws(() => createAiSeats({ seats: claude, transport: 'live', go: 'go', maxCost: 3, fetch: stub }), /under node --test/);
  assert.throws(() => createAiSeats({ seats: [...or, { agentId: 'a2', model: SONNET, api: 'claude' }], transport: 'live', go: 'go', maxCost: 3, fetch: stub, keyFile: fakeKeyFile(dir) }), /under node --test/, 'one temp key is not enough when two APIs are used');
  // the real fetch (given or by default), even with temp key files
  assert.throws(() => createAiSeats({ seats: or, transport: 'live', keyFile: fakeKeyFile(dir), go: 'go', maxCost: 3 }), /under node --test/);
  assert.throws(() => createAiSeats({ seats: or, transport: 'live', keyFile: fakeKeyFile(dir), go: 'go', maxCost: 3, fetch: globalThis.fetch }), /under node --test/);
  assert.throws(() => createAiSeats({ seats: claude, transport: 'live', claudeKeyFile: fakeKeyFile(dir), go: 'go', maxCost: 3 }), /under node --test/);
  // the Mac's own model: never the real fetch under test
  assert.throws(() => createAiSeats({ seats: [{ agentId: 'a1', model: 'local', api: 'local' }], transport: 'live' }), /under node --test/);
  assert.equal(stub.seen.length, 0);
  const keyDirs = [path.dirname(SEAT_DEFAULTS.keyFile), path.dirname(CLAUDE_KEY_FILE)];
  assert.deepEqual(keyDirs, [path.join(os.homedir(), '.config', 'openrouter'), path.join(os.homedir(), '.config', 'anthropic')]);
  assert.deepEqual(read.filter(f => keyDirs.some(d => f.startsWith(d))), [], 'no real key file was read');
});

test('a fake run reads no key file at all', async t => {
  const read = [];
  const real = fs.readFileSync;
  fs.readFileSync = (file, ...rest) => {
    read.push(String(file));
    return real(file, ...rest);
  };
  t.after(() => {
    fs.readFileSync = real;
  });
  const views = hourZero();
  const seats = createAiSeats({ seats: [{ agentId: 'a1', model: GPT }, { agentId: 'a2', model: SONNET, api: 'claude' }, { agentId: 'a3', model: 'local', api: 'local' }], transport: 'fake', maxCost: 5, go: 'not needed' });
  await seats.decide(ask(views, ['a1', 'a2', 'a3']));
  await seats.journal(ask(views, ['a1', 'a2', 'a3']));
  assert.deepEqual(read.filter(f => f.includes(`${path.sep}.config${path.sep}`)), []);
  assert.equal(seats.spend.calls, 6);
  await seats.close();
});

test('openrouter: a 500 gets one retry, a 400 is final, a 402 halts the run; the key rides only in the header', async t => {
  const dir = tempDir(t);
  const views = hourZero();
  const ok = replyText({ id: restOf(views.a1) });
  const stub = stubFetch([
    { status: 500, body: { error: { code: 500, message: 'upstream' } } },
    { status: 200, body: completion(ok) },
    { status: 400, body: { error: { code: 400, message: 'bad field' } } },
    { status: 402, body: { error: { code: 402, message: 'Insufficient credits' } } },
  ]);
  const records = [];
  const seats = createAiSeats({ seats: [{ agentId: 'a1', model: GPT }], transport: 'live', keyFile: fakeKeyFile(dir), maxCost: 3, go: 'go', fetch: stub, url: FAKE_URL, onTurn: r => records.push(r) });
  const one = () => seats.ask(ask(views, ['a1'])).then(m => m.get('a1'));
  const r1 = await one();
  assert.deepEqual([r1.ok, r1.tries, r1.reply.move.id], [true, 2, restOf(views.a1)]);
  const r2 = await one();
  assert.deepEqual([r2.ok, r2.why, r2.tries], [false, 'http 400: bad field', 1]);
  const r3 = await one();
  assert.deepEqual([r3.ok, r3.why, r3.tries], [false, 'halted: credit', 1]);
  const r4 = await one();
  assert.deepEqual([r4.ok, r4.why, r4.tries], [false, 'halted: credit', 0]);
  assert.equal(seats.capped, false);
  assert.equal(seats.halted.kind, 'credit');
  assert.equal(stub.seen.length, 4);
  for (const s of stub.seen) {
    assert.equal(s.headers.get('authorization'), `Bearer ${KEY_WORD}`);
    assert.ok(!s.body.includes(KEY_WORD));
    assert.equal(s.headers.get('x-seat'), 'a1');
  }
  assert.deepEqual(stub.seen.map(s => s.headers.get('x-call')), ['1', '2', '3', '4']);
  // nothing that is kept or written holds the key
  assert.ok(!JSON.stringify([seats.log, seats.turns, records]).includes(KEY_WORD));
  assert.deepEqual(seats.failed, { turns: 2, journals: 0, skipped: 1 });
});

test('preflight: OpenRouter balance and key limit against maxCost', async t => {
  const dir = tempDir(t);
  const answers = () => [
    { status: 200, body: { data: { total_credits: 10, total_usage: 2 } } },
    { status: 200, body: { data: { limit_remaining: 5, usage: 1.5 } } },
  ];
  const keyFile = fakeKeyFile(dir);
  const seats = createAiSeats({ seats: [{ agentId: 'a1', model: GPT }], transport: 'live', keyFile, maxCost: 3, go: 'go', fetch: stubFetch(answers()) });
  assert.deepEqual(await seats.preflight(), { balance: 8, left: 5, usage: 1.5, refused: null });
  const stub = stubFetch(answers());
  const tight = createAiSeats({ seats: [{ agentId: 'a1', model: GPT }], transport: 'live', keyFile, maxCost: 6, go: 'go', fetch: stub });
  assert.match((await tight.preflight()).refused, /key's limit left, \$5\.00, is below --max-cost \$6/);
  assert.deepEqual(stub.seen.map(s => [s.method, new URL(s.url).pathname]), [['GET', '/api/v1/credits'], ['GET', '/api/v1/key']]);
  const poor = createAiSeats({ seats: [{ agentId: 'a1', model: GPT }], transport: 'live', keyFile, maxCost: 9, go: 'go', fetch: stubFetch(answers()) });
  assert.match((await poor.preflight()).refused, /account's balance, \$8\.00, is below --max-cost \$9/);
  // a Claude-only run has no balance to read: it says so, and makes no call
  const none = stubFetch([]);
  const claude = createAiSeats({ seats: [{ agentId: 'a1', model: SONNET, api: 'claude' }], transport: 'live', claudeKeyFile: keyFile, maxCost: 3, go: 'go', fetch: none });
  const p = await claude.preflight();
  assert.equal(p.refused, null);
  assert.match(p.claude, /no balance to read/);
  assert.equal(none.seen.length, 0);
});

test('the cut-off second try: a Claude reply cut off with no move is asked once more at the next lower effort, on the same tally', async () => {
  const views = hourZero();
  const good = replyText({ id: restOf(views.a1) });
  const seats = createAiSeats({
    seats: [{ agentId: 'a1', model: HAIKU, api: 'claude', effort: 'xhigh' }, { agentId: 'a2', model: HAIKU, api: 'claude', effort: 'low' }], transport: 'fake',
    // cut inside the move itself, so the repair can't save it
    fakeClaude: { script: { a1: [{ text: '{"move":{"id":"m', fault: 'cutoff' }, { text: good }], a2: [{ text: '{"move":{"id":"m', fault: 'cutoff' }] } },
  });
  const out = await seats.ask(ask(views, ['a1', 'a2']));
  const r = out.get('a1');
  assert.equal(r.ok, true, r.why);
  assert.deepEqual(r.fallback, { from: 'xhigh', to: 'high', ok: true });
  assert.equal(r.tries, 2);
  const sent = seats.fakeClaude.calls.filter(c => c.seat === 'a1').map(c => [c.request.output_config.effort, c.request.max_tokens]);
  assert.deepEqual(sent, [['xhigh', 32000], ['high', 16000]]);
  // at the lowest effort there is nowhere to go: the turn fails
  const low = out.get('a2');
  assert.equal(low.ok, false);
  assert.match(low.why, /^cut off: /);
  assert.equal(low.fallback, null);
  const pm = seats.perModel[HAIKU];
  assert.deepEqual([pm.calls, pm.cutoffs, pm.fallbacks, pm.rescued, pm.failed], [3, 2, 1, 1, 1]);
  assert.deepEqual(seats.log.filter(l => l.seat === 'a1').map(l => [l.call, l.finish, l.fallback ?? null]), [[1, 'max_tokens', null], [2, 'end_turn', { from: 'xhigh', to: 'high' }]]);
  assert.ok(r.usage.cost > 0, 'both calls are on the turn');
  await seats.close();
});

test("journal(): one extra call per seat on the same route and tally; three lines and an ask; a failed one is empty, never made up", async () => {
  const views = hourZero();
  const records = [];
  const seats = createAiSeats({
    seats: [{ agentId: 'a1', model: GPT }, { agentId: 'a2', model: SONNET, api: 'claude' }, { agentId: 'a3', model: GPT }], transport: 'fake', onTurn: r => records.push(r),
    fake: { script: { a3: [{ content: 'I would rather not write tonight.' }] } },
  });
  const out = await seats.journal(ask(views, ['a1', 'a2', 'a3']));
  for (const id of ['a1', 'a2']) {
    assert.equal(out[id].lines.length, 3);
    assert.ok(out[id].lines.every(l => typeof l === 'string' && l.length > 0 && l.length <= 200));
    assert.ok(out[id].ask.length > 0 && out[id].ask.length <= 160);
  }
  assert.deepEqual(out.a3, { lines: [], ask: null, failed: true });
  assert.equal('failed' in out.a1, false, 'a good journal has no failed field');
  assert.deepEqual(seats.failed, { turns: 0, journals: 1, skipped: 0 });
  assert.equal(seats.spend.calls, 3);
  // the journal's prompt went out, not the turn's
  const body = seats.fake.calls.find(c => c.seat === 'a1').request;
  assert.deepEqual(body.messages.map(m => m.content), Object.values(render(views.a1, { kind: 'journal' })));
  assert.deepEqual(records.map(r => r.kind), ['journal', 'journal', 'journal']);
  await assert.rejects(seats.ask([], 'speech'), /a 'turn' or a 'journal'/);
  await seats.close();
});

test('onTurn: one record a turn with the prompt sizes, every attempt, what was parsed, usage and cost, and never the prompt itself', async () => {
  const views = hourZero();
  const records = [];
  const attempts = [];
  const seats = createAiSeats({ seats: [{ agentId: 'a1', model: SONNET, api: 'claude' }], transport: 'fake', onTurn: r => records.push(r), onReply: r => attempts.push(r) });
  await seats.decide(ask(views, ['a1']));
  const [r] = records;
  const { system, user } = render(views.a1);
  assert.deepEqual(r.prompt, { system: system.length, user: user.length });
  assert.deepEqual([r.t, r.day, r.hour, r.agentId, r.kind, r.model, r.api, r.effort, r.ok, r.tries], [0, 1, 12, 'a1', 'turn', SONNET, 'claude', 'high', true, 1]);
  assert.equal(parseReply(r.raw, views.a1).ok, true);
  assert.deepEqual(r.attempts.map(a => [a.call, a.try, a.status, a.raw]), [[1, 1, 200, r.raw]]);
  assert.ok(r.usage.in > 0 && r.usage.out > 0 && r.usage.cost > 0);
  assert.ok(r.reply.move.id);
  const text = JSON.stringify(records);
  assert.equal(text.includes('THE EIGHT VERBS'), false, 'the rulebook is not in the record');
  assert.equal(text.includes('fake-messages-word'), false);
  assert.equal(attempts.length, 1);
  assert.deepEqual([attempts[0].seat, attempts[0].kind, attempts[0].parse.ok], ['a1', 'turn', true]);
  await seats.close();
});

test("the Mac's own model (api local): no key, no cost, only this machine, and only through an injected fetch here", async () => {
  const views = hourZero();
  const stub = stubFetch(() => ({ status: 200, body: { choices: [{ message: { role: 'assistant', content: replyText({ id: restOf(views.a1) }) }, finish_reason: 'stop' }], usage: { prompt_tokens: 3000, completion_tokens: 60 } } }));
  // free: it needs neither maxCost nor go
  const seats = createAiSeats({ seats: [{ agentId: 'a1', model: 'qwen', api: 'local' }], transport: 'live', fetch: stub });
  assert.equal(seats.paid, false);
  const r = (await seats.ask(ask(views, ['a1']))).get('a1');
  assert.equal(r.ok, true, r.why);
  assert.deepEqual(r.usage, { in: 3000, out: 60, reasoning: null, cost: 0 });
  assert.equal(seats.spend.cost, 0);
  const sent = stub.seen[0];
  assert.equal(sent.url, 'http://127.0.0.1:8000/v1/chat/completions');
  assert.equal(sent.headers.get('authorization'), null, 'no key goes to the local model');
  const body = JSON.parse(sent.body);
  assert.deepEqual(Object.keys(body).sort(), ['chat_template_kwargs', 'max_tokens', 'messages', 'model', 'response_format']);
  assert.equal(seats.seats[0].timeoutMs, SEAT_DEFAULTS.local.timeoutMs);
  // it only ever calls this machine
  assert.throws(() => createAiSeats({ seats: [{ agentId: 'a1', model: 'qwen', api: 'local' }], transport: 'live', fetch: stub, localUrl: 'https://example.com/v1/chat/completions' }), /only calls this machine/);
  // a paid seat beside it brings the guards back
  assert.throws(() => createAiSeats({ seats: [{ agentId: 'a1', model: 'qwen', api: 'local' }, { agentId: 'a2', model: GPT }], transport: 'live', fetch: stub, keyFile: '/nonexistent-hotkey2/key' }), /without maxCost/);
  assert.throws(() => createAiSeats({ seats: [{ agentId: 'a1', model: 'qwen', api: 'local', effort: 'high' }], transport: 'fake' }), /effort is for claude seats/);
  assert.deepEqual(APIS, ['openrouter', 'claude', 'local']);
});

test('estimate uses the cost per call seen so far, per model', async t => {
  const dir = tempDir(t);
  const views = hourZero();
  const stub = stubFetch([
    { body: completion(replyText({ id: restOf(views.a1) }), { cost: 0.002 }) },
    { body: completion(replyText({ id: restOf(views.a2) }), { cost: 0.004 }) },
  ]);
  const seats = createAiSeats({
    seats: [{ agentId: 'a1', model: GEMINI }, { agentId: 'a2', model: GPT }, { agentId: 'a3', model: KIMI }],
    transport: 'live', keyFile: fakeKeyFile(dir), maxCost: 3, go: 'go', fetch: stub, url: FAKE_URL, concurrency: 1,
  });
  assert.equal(seats.estimate({ callsPerSeat: 65 }), null);
  const out = await seats.ask(ask(views, ['a1', 'a2']));
  assert.deepEqual(out.get('a1').usage, { in: 1000, out: 50, reasoning: null, cost: 0.002 });
  // a3's model has no call yet, so it takes the mean of the others: 0.003
  assert.ok(Math.abs(seats.estimate({ callsPerSeat: 65 }) - 65 * (0.002 + 0.004 + 0.003)) < 1e-9);
  assert.throws(() => seats.estimate({}), /callsPerSeat/);
});

test('seat validation, and results keyed by agent in sorted order', async () => {
  const views = hourZero();
  assert.throws(() => createAiSeats({ seats: [{ agentId: 'a1' }], transport: 'fake' }), /agentId and model strings/);
  assert.throws(() => createAiSeats({ seats: [{ agentId: 'a1', model: GPT, api: 'anthropic' }], transport: 'fake' }), /api is 'openrouter' or 'claude' or 'local'/);
  assert.throws(() => createAiSeats({ seats: [{ agentId: 'a1', model: GPT, effort: 'high' }], transport: 'fake' }), /effort is for claude seats/);
  assert.throws(() => createAiSeats({ seats: [{ agentId: 'a1', model: SONNET, api: 'claude', effort: 'huge' }], transport: 'fake' }), /effort is one of/);
  assert.throws(() => createAiSeats({ seats: [{ agentId: 'a1', model: 'claude-unknown', api: 'claude' }], transport: 'fake' }), /has no price/);
  assert.throws(() => createAiSeats({ seats: [{ agentId: 'a1', model: GPT }, { agentId: 'a1', model: GPT }], transport: 'fake' }), /listed twice/);
  assert.ok(Object.keys(PRICES).includes(SONNET) && Object.keys(PRICES).includes(HAIKU));
  const seats = createAiSeats({ seats: [{ agentId: 'a2', model: GPT }, { agentId: 'a1', model: GPT }], transport: 'fake' });
  const out = await seats.ask([{ agentId: 'a2', view: views.a2 }, { agentId: 'a9', view: views.a9 }, { agentId: 'a1', view: views.a1 }]);
  assert.deepEqual([...out.keys()], ['a1', 'a2', 'a9']);
  assert.deepEqual([out.get('a9').ok, out.get('a9').why], [false, 'a9 is not an AI seat']);
  await assert.rejects(seats.ask([{ agentId: 'a1', view: views.a1 }, { agentId: 'a1', view: views.a1 }]), /twice/);
  assert.deepEqual(await seats.decide([]), {});
  assert.equal(restChoice({ menu: [] }), null);
  await seats.close();
});

test('a Claude seat, live: only its own key file is read, it rides in x-api-key, and a 401 halts the run', async t => {
  const dir = tempDir(t);
  const views = hourZero();
  const claudeKey = path.join(dir, 'claude-key');
  const word = ['claude', 'test', 'word'].join('-');
  fs.writeFileSync(claudeKey, word);
  const msgs = fakeMessages({ script: { a1: [{ text: replyText({ id: restOf(views.a1) }) }, { status: 401, error: { type: 'authentication_error', message: 'invalid x-api-key' } }] } });
  const seen = [];
  const route = async (url, init) => {
    const h = new Headers(init.headers);
    seen.push({ path: new URL(String(url)).pathname, auth: h.get('authorization'), xkey: h.get('x-api-key'), body: init.body });
    return msgs.fetch(url, init);
  };
  // the OpenRouter key file is not used by this run, so it is never read: a path that doesn't exist is fine
  const seats = createAiSeats({ seats: [{ agentId: 'a1', model: SONNET, api: 'claude' }], transport: 'live', maxCost: 1, go: 'go', keyFile: '/nonexistent-hotkey2/key', claudeKeyFile: claudeKey, fetch: route, claudeUrl: 'http://fake.invalid/v1/messages' });
  const r1 = (await seats.ask(ask(views, ['a1']))).get('a1');
  assert.equal(r1.ok, true, r1.why);
  const r2 = (await seats.ask(ask(views, ['a1']))).get('a1');
  assert.deepEqual([r2.ok, r2.why], [false, 'halted: key']);
  assert.deepEqual(seen.map(s => [s.path, s.auth, s.xkey]), [['/v1/messages', null, word], ['/v1/messages', null, word]]);
  for (const s of seen) assert.ok(!s.body.includes(word));
  assert.ok(!JSON.stringify([seats.log, seats.turns]).includes(word));
  await msgs.close();
});
