// The reply parser: what a model wrote -> a reply the season can play, plus what was cut or left out and why.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReply, parseJournal, extractJson, clipChars, REPLY_FORMAT, JOURNAL_FORMAT } from '../../src/seats/reply.mjs';
import { chooseFromMenu } from '../../src/menu.mjs';
import { normalizeReply, SAY_MAX, MESSAGE_MAX, CONFESSIONAL_MAX, VERBS } from '../../src/resolve.mjs';
import { createGame } from '../../src/season.mjs';
import { legalReply } from '../../src/seats/ai.mjs';
import { viewsOf, playedViews } from './helpers.mjs';

// Hour 0 of seed 1: everyone is home with $100. a1 is a smuggler holding chems.
const hourZero = () => viewsOf(createGame({ seed: 1 })).views;
const line = (view, test) => view.menu.find(test);
const sellLine = view => line(view, m => m.move.terms?.kind === 'sell' && m.args?.to);
const jobLine = view => line(view, m => m.move.terms?.kind === 'job');
const loanLine = view => line(view, m => m.move.terms?.kind === 'loan');
const giftLine = view => line(view, m => m.move.terms?.kind === 'gift');
const restLine = view => line(view, m => m.verb === 'rest');
const say = obj => JSON.stringify(obj);

test('a good reply: the move, accepts, say, message and confessional all come through', () => {
  const view = hourZero().a1;
  const rest = restLine(view);
  const other = view.cast[2];
  const p = parseReply(say({
    move: { id: rest.id }, accept: [], say: { text: 'Quiet day.', to: other.id },
    message: { to: view.cast[0].name, text: 'You selling?' }, confessional: 'I am going to own the docks.',
  }), view);
  assert.equal(p.ok, true, p.why);
  assert.deepEqual(p.reply, {
    move: { id: rest.id }, accept: [], say: { text: 'Quiet day.', to: other.id },
    message: { to: view.cast[0].id, text: 'You selling?' }, confessional: 'I am going to own the docks.',
  });
  assert.deepEqual(p.trimmed, []);
  assert.deepEqual(p.dropped, []);
  assert.deepEqual(chooseFromMenu(view.menu, p.reply.move), { verb: 'rest' });
});

test('the other ways a model writes a move: a bare id, a number, upper case, args beside it, a verb', () => {
  const view = hourZero().a1;
  const sell = sellLine(view);
  const n = Number(sell.id.slice(1));
  for (const move of [sell.id, sell.id.toUpperCase(), n, { id: n }, { id: ` ${sell.id} ` }]) {
    const p = parseReply(say({ move }), view);
    assert.equal(p.ok, true, `${JSON.stringify(move)}: ${p.why}`);
    assert.equal(p.reply.move.id, sell.id);
  }
  // mini's habit: {"move":"m3","args":{...}}
  const flat = parseReply(say({ move: sell.id, args: { to: view.cast[1].id, n: 2, each: 30 } }), view);
  assert.deepEqual(flat.reply.move, { id: sell.id, to: view.cast[1].id, n: 2, each: 30 });
  // a verb with what tells its lines apart, or a bare verb when only one line has it
  const walk = line(view, m => m.verb === 'move');
  assert.equal(parseReply(say({ move: { verb: 'move', to: walk.move.to } }), view).reply.move.id, walk.id);
  assert.equal(parseReply(say({ move: 'rest' }), view).reply.move.id, restLine(view).id);
  // several lines share the verb and nothing tells them apart: not on the menu
  assert.equal(parseReply(say({ move: 'attack' }), view).ok, false);
});

test('junk is a failed reply with a reason, never a crash', () => {
  const view = hourZero().a1;
  for (const [text, why] of [
    ['', 'empty reply'], ['   ', 'empty reply'], [null, 'empty reply'], [undefined, 'empty reply'],
    ['I think I will rest this hour.', 'no JSON object in the reply'],
    ['[{"move":"m1"}]', 'no JSON object in the reply'],
    ['<tool_call>{"name":"rest"}</tool_call>', 'no JSON object in the reply'],
    ['42', 'no JSON object in the reply'], ['{ this reply is not JSON }', 'no JSON object in the reply'],
    ['{"move":{}}', 'the move has no menu id'], ['{"move":true}', 'no move'], ['{"say":"hello"}', 'no move'],
  ]) {
    const p = parseReply(text, view);
    assert.equal(p.ok, false, String(text));
    assert.equal(p.why, why, String(text));
  }
});

test('text around the object is ignored, and a quoted fragment is never taken for the reply', () => {
  const view = hourZero().a1;
  const rest = restLine(view).id;
  const fenced = parseReply('Here is my move:\n```json\n{"move":{"id":"' + rest + '"},"confessional":"ok"}\n```\nGood luck.', view);
  assert.equal(fenced.ok, true, fenced.why);
  assert.equal(fenced.reply.move.id, rest);
  // notes that quote a piece of the menu before the real reply
  const noted = parseReply('The line takes {"n":3}. <think>{calm}</think> {"move":{"id":"' + rest + '"},"say":null}', view);
  assert.equal(noted.ok, true, noted.why);
  assert.equal(noted.reply.move.id, rest);
  // a fragment alone is no reply
  assert.equal(parseReply('The line takes {"n":3}.', view).ok, false);
  // trailing commas and a bad quote inside free text are repaired
  const sloppy = parseReply('{"move":{"id":"' + rest + '",},"confessional":"He said "pay up" and left",}', view);
  assert.equal(sloppy.ok, true, sloppy.why);
  assert.equal(sloppy.reply.confessional, 'He said "pay up" and left');
});

test('cut-off JSON: free text that was cut survives, an id or a number that was cut is never guessed', () => {
  const view = hourZero().a1;
  const rest = restLine(view).id;
  const sell = sellLine(view).id;
  // cut inside the confessional: the move before it stands
  const talk = parseReply(`{"move":{"id":"${rest}"},"say":null,"confessional":"I was about to say someth`, view);
  assert.equal(talk.ok, true, talk.why);
  assert.equal(talk.reply.move.id, rest);
  assert.equal(talk.reply.confessional, 'I was about to say someth');
  // cut inside a say's text
  const said = parseReply(`{"move":{"id":"${rest}"},"say":{"text":"Nobody mov`, view);
  assert.equal(said.ok, true, said.why);
  assert.equal(said.reply.say.text, 'Nobody mov');
  // cut inside the id, after a number's key, or before any move: no move is made up
  for (const text of [`{"move":{"id":"m`, `{"move":{"id":"${sell}","n":`, `{"move":{"id":"${sell}","to":"a`, `{"confessional":"Thinking about it`, '{"move":']) {
    const p = parseReply(text, view);
    assert.equal(p.ok, false, text);
    assert.equal(p.reply?.move ?? null, null, text);
  }
  // talk before a move that never arrived is kept for the record
  assert.equal(parseReply('{"confessional":"Thinking about it', view).reply.confessional, 'Thinking about it');
});

test('over-long text is cut to the limits in src/resolve.mjs, at a sentence or a word, and named', () => {
  const view = hourZero().a1;
  const long = n => 'This is one sentence of the speech. '.repeat(Math.ceil(n / 36) + 2);
  const p = parseReply(say({
    move: { id: restLine(view).id }, say: long(SAY_MAX), message: { to: view.cast[0].id, text: long(MESSAGE_MAX) }, confessional: long(CONFESSIONAL_MAX),
  }), view);
  assert.equal(p.ok, true, p.why);
  assert.deepEqual(p.trimmed, ['say', 'message', 'confessional']);
  assert.ok(p.reply.say.text.length <= SAY_MAX && p.reply.message.text.length <= MESSAGE_MAX && p.reply.confessional.length <= CONFESSIONAL_MAX);
  for (const text of [p.reply.say.text, p.reply.message.text, p.reply.confessional]) assert.match(text, /speech\.$/, 'cut at the end of a sentence');
  // the engine's own tidy-up leaves it alone
  const tidy = normalizeReply({ ...p.reply, move: chooseFromMenu(view.menu, p.reply.move) });
  assert.equal(tidy.say.text, p.reply.say.text);
  assert.equal(tidy.confessional, p.reply.confessional);
  // one long word: a hard cut
  assert.deepEqual(clipChars('x'.repeat(300), 140), { text: 'x'.repeat(140), cut: true });
  // no sentence end: the last whole word
  const words = clipChars('word '.repeat(60), 140);
  assert.equal(words.cut, true);
  assert.match(words.text, /word$/);
  assert.deepEqual(clipChars('  short   and\nsweet ', 140), { text: 'short and sweet', cut: false });
});

test('an id that is not on the menu fails the turn, and the talk is kept', () => {
  const view = hourZero().a1;
  const p = parseReply(say({ move: { id: 'm999' }, say: 'I tried.', confessional: 'Oops.' }), view);
  assert.equal(p.ok, false);
  assert.equal(p.why, 'move "m999" is not on the menu');
  assert.equal(p.reply.move, null);
  assert.deepEqual(p.reply.say, { text: 'I tried.' });
  assert.equal(p.reply.confessional, 'Oops.');
  // an action the game has, but not this hour: still not on the menu
  assert.equal(parseReply(say({ move: { verb: 'quit', id: 'c1' } }), view).ok, false);
});

test('args out of range are pulled back into range; anything unreadable keeps the line\'s own value', () => {
  const view = hourZero().a1;
  const sell = sellLine(view);
  const max = sell.args.n.max;
  const over = parseReply(say({ move: { id: sell.id, n: max + 50, each: 0, to: 'a1' } }), view);
  assert.equal(over.ok, true, over.why);
  assert.equal(over.reply.move.n, max);
  assert.equal(over.reply.move.each, 1);
  assert.equal('to' in over.reply.move, false, 'yourself is not one of the choices');
  assert.deepEqual(over.dropped.map(d => d.field).sort(), ['move.each', 'move.n', 'move.to']);
  const made = chooseFromMenu(view.menu, over.reply.move);
  assert.equal(made.terms.n, max);
  assert.equal(made.to, 'anyone');

  // numbers as a model writes them, a name for an id, a word for the board, yes for true
  const loose = parseReply(say({ move: { id: sell.id, n: '2', each: '$31', to: view.cast[3].name, courier: 'yes' } }), view);
  assert.deepEqual(loose.reply.move, { id: sell.id, to: view.cast[3].id, n: 2, each: 31, courier: true });
  assert.deepEqual(loose.dropped, []);
  assert.equal(parseReply(say({ move: { id: sell.id, to: 'board' } }), view).reply.move.to, 'anyone');

  // not a number, not a choice, and a key the line doesn't take
  const bad = parseReply(say({ move: { id: sell.id, n: 'lots', courier: 'maybe', colour: 'red' } }), view);
  assert.equal(bad.ok, true);
  assert.deepEqual(bad.reply.move, { id: sell.id });
  assert.deepEqual(bad.dropped.map(d => d.field).sort(), ['move.colour', 'move.courier', 'move.n']);
  assert.deepEqual(chooseFromMenu(view.menu, bad.reply.move), sell.move);

  // stash: a negative amount where only a deposit is on the menu
  const stash = line(view, m => m.verb === 'stash');
  assert.equal(parseReply(say({ move: { id: stash.id, amount: -40 } }), view).reply.move.amount, 1);
  assert.equal(parseReply(say({ move: { id: stash.id, amount: 60.4 } }), view).reply.move.amount, 60);
});

test('an hour is written as a clock time and read back as the engine\'s hour', () => {
  const view = hourZero().a1;
  const loan = loanLine(view);
  const p = parseReply(say({ move: { id: loan.id, to: view.cast[0].id, amount: 40, repay: 55, due: 'Day 2 14:00' } }), view);
  assert.equal(p.ok, true, p.why);
  assert.equal(p.reply.move.due, 14, 'day 2 at 14:00 is hour 12 + 2');
  assert.equal(chooseFromMenu(view.menu, p.reply.move).terms.due, 14);
  // past the last hour anything can fall due: pulled back to it
  assert.equal(parseReply(say({ move: { id: loan.id, due: 'Day 5 23:00' } }), view).reply.move.due, loan.args.due.max);
  // not a time at all: the line's own value
  const junk = parseReply(say({ move: { id: loan.id, due: 'tomorrow-ish' } }), view);
  assert.equal('due' in junk.reply.move, false);
  assert.equal(junk.dropped[0].field, 'move.due');
});

test("a job's task: as an object or in words; a job with no readable task fails the turn", () => {
  const view = hourZero().a1;
  const job = jobLine(view);
  const target = view.cast[4];
  const cases = [
    [{ type: 'rob', agent: target.id }, { type: 'rob', agent: target.id }],
    [{ type: 'fight', agent: target.name }, { type: 'fight', agent: target.id }],
    [`rob ${target.name}`, { type: 'rob', agent: target.id }],
    [{ type: 'guard', hours: 4 }, { type: 'guard', hours: 4 }],
    ['guard me for 3 hours', { type: 'guard', hours: 3 }],
    [{ type: 'guard', agent: target.id, hours: 40 }, { type: 'guard', hours: 12, agent: target.id }],
    [`deliver 3 chems ${target.id}`, { type: 'deliver', good: 'chems', n: 3, agent: target.id }],
    [{ type: 'bail', agent: target.id }, { type: 'bail', agent: target.id }],
  ];
  for (const [task, want] of cases) {
    const p = parseReply(say({ move: { id: job.id, task, pay: 30 } }), view);
    assert.equal(p.ok, true, `${JSON.stringify(task)}: ${p.why}`);
    assert.deepEqual(p.reply.move.task, want);
    assert.deepEqual(chooseFromMenu(view.menu, p.reply.move).terms.task, want);
  }
  for (const task of [undefined, 'rob', { type: 'rob', agent: 'a1' }, { type: 'rob', agent: 'nobody' }, { type: 'kidnap', agent: target.id }, 'deliver chems', 7]) {
    const p = parseReply(say({ move: { id: job.id, task } }), view);
    assert.equal(p.ok, false, JSON.stringify(task));
    assert.match(p.why, new RegExp(`^${job.id}: `));
  }
});

test('a gift of goods takes "good" and "n" in place of cash', () => {
  const view = hourZero().a1;
  const gift = giftLine(view);
  const p = parseReply(say({ move: { id: gift.id, to: view.cast[2].id, good: 'chems', n: 2 } }), view);
  assert.equal(p.ok, true, p.why);
  assert.deepEqual(chooseFromMenu(view.menu, p.reply.move), { verb: 'offer', to: view.cast[2].id, terms: { kind: 'gift', good: 'chems', q: 1, n: 2 } });
});

test('accepts: only offers this view shows, three at most, with the courier and units', () => {
  const { views } = playedViews({ seed: 2, hours: 10 });
  const view = views.findLast(v => v.offers.length >= 2 && v.menu.length);
  assert.ok(view, 'a view with two open offers');
  const [a, b] = view.offers;
  const rest = restLine(view).id;
  const p = parseReply(say({ move: { id: rest }, accept: [a.id, { id: b.id.toUpperCase(), courier: true, units: 2 }, 'o9999', a.id, 12] }), view);
  assert.equal(p.ok, true, p.why);
  assert.deepEqual(p.reply.accept, [a.id, { id: b.id, courier: true, units: 2 }]);
  assert.equal(p.dropped.filter(d => d.field === 'accept').length, 3);
  // one id on its own, not in a list
  assert.deepEqual(parseReply(say({ move: { id: rest }, accept: a.id }), view).reply.accept, [a.id]);
  // more than three: the rest are named and left out
  const many = { ...view, offers: [1, 2, 3, 4].map(n => ({ id: `o${n}` })) };
  const four = parseReply(say({ move: { id: rest }, accept: ['o1', 'o2', 'o3', 'o4'] }), many);
  assert.deepEqual(four.reply.accept, ['o1', 'o2', 'o3']);
  assert.match(four.dropped[0].why, /three accepts a turn/);
});

test('say and message: who they are for is checked, and a bad one is dropped without failing the turn', () => {
  const view = hourZero().a1;
  const rest = restLine(view).id;
  const p = parseReply(say({ move: { id: rest }, say: { text: 'Hey.', to: 'the mayor' }, message: { to: 'a1', text: 'note to self' } }), view);
  assert.equal(p.ok, true);
  assert.deepEqual(p.reply.say, { text: 'Hey.' });
  assert.equal(p.reply.message, null);
  assert.deepEqual(p.dropped.map(d => d.field), ['say.to', 'message']);
  assert.equal(parseReply(say({ move: { id: rest }, message: 'hello' }), view).reply.message, null);
  assert.equal(parseReply(say({ move: { id: rest }, message: { to: view.cast[0].id, text: '   ' } }), view).reply.message, null);
  assert.equal(parseReply(say({ move: { id: rest }, say: '', confessional: '' }), view).reply.say, null);
  // two messages: the first is sent
  const two = parseReply(say({ move: { id: rest }, message: [{ to: view.cast[0].id, text: 'one' }, { to: view.cast[1].id, text: 'two' }] }), view);
  assert.deepEqual(two.reply.message, { to: view.cast[0].id, text: 'one' });
});

test('an empty menu (jail, the clinic): no move is fine, and the talk still counts', () => {
  const view = { ...hourZero().a1, menu: [] };
  const p = parseReply(say({ move: null, message: { to: view.cast[0].id, text: 'Bail me out.' }, confessional: 'Cuffed again.' }), view);
  assert.equal(p.ok, true);
  assert.equal(p.reply.move, null);
  assert.equal(p.reply.message.text, 'Bail me out.');
  const tried = parseReply(say({ move: { id: 'm1' } }), view);
  assert.equal(tried.ok, true);
  assert.equal(tried.reply.move, null);
  assert.equal(tried.dropped[0].field, 'move');
});

test('every reply the parser passes becomes a move the engine takes, across a day of real views', () => {
  let checked = 0;
  for (const seed of [1, 2, 3]) {
    for (const view of playedViews({ seed, hours: 12 }).views) {
      // the hash-picking fake fills every argument a line takes, so every kind of line comes up
      const p = parseReply(JSON.stringify(legalReply(view)), view);
      assert.equal(p.ok, true, `${view.you.id} t=${view.clock.t}: ${p.why}`);
      if (!view.menu.length) continue;
      const move = chooseFromMenu(view.menu, p.reply.move);
      assert.ok(move && VERBS.includes(move.verb), `${view.you.id} t=${view.clock.t}: ${JSON.stringify(p.reply.move)}`);
      assert.deepEqual(normalizeReply({ ...p.reply, move }).move, move);
      checked += 1;
    }
  }
  assert.ok(checked > 300, `${checked} views checked`);
});

test('a journal: four named lines or a list, cut to length; no lines at all is a failed journal', () => {
  const four = parseJournal(say({ believe: 'The cook is the key.', trust: 'I trust Wren, not Roxy.', tomorrow: 'Tomorrow I sell uptown.', ask: 'I need Getaway. I got cuffed twice.' }));
  assert.equal(four.ok, true);
  assert.deepEqual(four.journal, { lines: ['The cook is the key.', 'I trust Wren, not Roxy.', 'Tomorrow I sell uptown.'], ask: 'I need Getaway. I got cuffed twice.' });
  assert.deepEqual(four.dropped, []);
  const listed = parseJournal('My journal:\n' + say({ lines: ['One.', 'Two.', 'Three.', 'Four.'], ask: 'More Hustle.' }));
  assert.deepEqual(listed.journal, { lines: ['One.', 'Two.', 'Three.'], ask: 'More Hustle.' });
  assert.equal(listed.dropped.length, 1);
  const long = parseJournal(say({ believe: 'A long thought. '.repeat(40), trust: 'x', tomorrow: 'y', ask: 'Please. '.repeat(60) }));
  assert.ok(long.journal.lines[0].length <= 200 && long.journal.ask.length <= 160);
  assert.deepEqual(long.trimmed, ['believe', 'ask']);
  const thin = parseJournal(say({ believe: 'Only this.' }));
  assert.equal(thin.ok, true);
  assert.deepEqual(thin.journal, { lines: ['Only this.'], ask: null });
  assert.deepEqual(thin.dropped.map(d => d.field), ['lines', 'ask']);
  for (const text of ['', 'no json here', say({ ask: 'Something.' }), say({ lines: [1, 2, 3] })]) assert.equal(parseJournal(text).ok, false, text);
  // cut off mid-line: what was written is kept
  const cut = parseJournal('{"believe":"The docks are mine.","trust":"Nobody, after tod');
  assert.equal(cut.ok, true);
  assert.deepEqual(cut.journal.lines, ['The docks are mine.', 'Nobody, after tod']);
});

test('the formats the prompt prints open with the line that keeps models from writing tool tags', () => {
  const first = 'Answer with one JSON object and nothing else: no text, tags or tool calls around it (you have no tools).';
  assert.equal(REPLY_FORMAT.split('\n')[0], first);
  assert.equal(JOURNAL_FORMAT.split('\n')[0], first);
  // the example in the format is itself a reply the extractor reads
  assert.ok(extractJson(REPLY_FORMAT.split('\n')[1]));
});
