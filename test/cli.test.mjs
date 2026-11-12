// The command-line runner (SPEC section 17): bot runs, a fake AI season with every output, the night pause resumed
// through its files, and every cost guard. Fake transports only: nothing here reaches a model, a key or the network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { main, parseArgs, parseSeatModels, checkSeatModels, lineupFor, seatModelsFor } from '../src/cli.mjs';
import { CONFIG } from '../src/config.mjs';
import { CITY } from '../src/map.mjs';
import { createGame, advance, levelUpSheet } from '../src/season.mjs';
import { seatSpecs, classSpecs, seatIndex } from '../src/lineups.mjs';
import { totalHours } from '../src/state.mjs';
import { createAiSeats } from '../src/seats/ai.mjs';
import { botBrain } from '../src/seats/fake-brain.mjs';
import { ai10Template, SEAT_DEFAULTS } from '../src/seats/defaults.mjs';
import { PRICES } from '../src/seats/anthropic.mjs';
import { tempDir, fakeKeyFile, KEY_WORD, completion, stubFetch } from './seats/helpers.mjs';

const quiet = { log: () => {} };
const lines = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const CALLS_PER_SEASON = 10 * (totalHours(CONFIG) + CONFIG.season.days);
const episodeBuilt = fs.existsSync(new URL('../src/episode.mjs', import.meta.url));

/** How a test owner fills a sheet in: every point on the first skill on offer, and a note. */
function fill(sheet) {
  return { ...sheet, buy: Array.from({ length: sheet.points }, () => sheet.canBuy[0].skill), note: `Night ${sheet.night}: sell high, and watch the robbers.` };
}

test('the command line: what it takes and what it refuses', () => {
  assert.deepEqual([parseArgs(['--bots']).lineup, parseArgs(['--bots']).seeds, parseArgs(['--bots']).start], ['default', 1, 1]);
  assert.equal(parseArgs(['--ai', '--fake']).lineup, 'ai10');
  const o = parseArgs(['--bots', '--seeds', '200', '--start', '9', '--lineup', 'dead:cook', '--keep', 'all']);
  assert.deepEqual([o.seeds, o.start, o.lineup, o.keep], [200, 9, 'dead:cook', Infinity]);
  assert.deepEqual(parseArgs(['--ai', '--fake', '--pause-nights', '--owner', 'dealer,robber#2']).owners, ['dealer', 'robber#2']);
  for (const [argv, why] of [
    [[], /say --bots or --ai/],
    [['--bots', '--ai', '--fake'], /separate runs/],
    [['--bots', '--seeds', '0'], /--seeds needs a whole number/],
    [['--bots', '--seeds'], /--seeds needs a value/],
    [['--bots', '--frobnicate'], /unknown option --frobnicate/],
    [['--bots', '--fake'], /are for --ai runs/],
    [['--bots', '--max-cost', '3'], /are for --ai runs/],
    [['--ai', '--fake', '--all-marks'], /--all-marks is for --bots runs/],
    [['--ai', '--fake', '--pause-nights'], /--pause-nights needs --owner/],
    [['--ai', '--fake', '--dry-run', '--pause-nights', '--owner', 'cook'], /--dry-run plays one hour/],
    [['--ai', '--fake', '--api', 'openrouter'], /--api takes "local"/],
    [['--resume', 'x', '--bots'], /--resume carries on a run as it was started/],
  ]) assert.throws(() => parseArgs(argv), why, argv.join(' '));
});

test('a real AI run refuses to start without both --max-cost and --go, before anything is written or read', async t => {
  const dir = tempDir(t);
  const out = path.join(dir, 'run');
  const read = [];
  const real = fs.readFileSync;
  fs.readFileSync = (file, ...rest) => {
    read.push(String(file));
    return real(file, ...rest);
  };
  t.after(() => {
    fs.readFileSync = real;
  });
  const stub = stubFetch([]);
  const opts = { ...quiet, seatOptions: { fetch: stub } };
  await assert.rejects(main(['--ai', '--lineup', 'ai10', '--seeds', '1', '--out', out], opts), /refusing a real AI run without --max-cost/);
  await assert.rejects(main(['--ai', '--lineup', 'ai10', '--seeds', '1', '--go', 'do it', '--out', out], opts), /refusing a real AI run without --max-cost/);
  await assert.rejects(main(['--ai', '--lineup', 'ai10', '--seeds', '1', '--max-cost', '0', '--go', 'do it', '--out', out], opts), /refusing a real AI run without --max-cost/);
  await assert.rejects(main(['--ai', '--lineup', 'ai10', '--seeds', '1', '--max-cost', '5', '--out', out], opts), /refusing a real AI run without --go/);
  await assert.rejects(main(['--ai', '--lineup', 'ai10', '--seeds', '1', '--max-cost', '5', '--go', '   ', '--out', out], opts), /refusing a real AI run without --go/);
  await assert.rejects(main(['--ai', '--dry-run', '--max-cost', '5', '--out', out], opts), /refusing a real AI run without --go/, 'the dry run is a real run too');
  assert.equal(fs.existsSync(out), false, 'a refused run writes nothing');
  // with both, under node --test, the seat layer still refuses the real key files and the real fetch
  await assert.rejects(main(['--ai', '--max-cost', '5', '--go', 'do it', '--out', out], opts), /under node --test a live run needs an injected fetch and temp key files/);
  await assert.rejects(main(['--ai', '--max-cost', '5', '--go', 'do it', '--out', out], quiet), /under node --test/);
  await assert.rejects(main(['--ai', '--api', 'local', '--out', out], quiet), /under node --test/, "the Mac's own model is never called from a test");
  assert.equal(stub.seen.length, 0, 'no request went out');
  assert.deepEqual(read.filter(f => f.includes(`${path.sep}.config${path.sep}`)), [], 'no key file was read');
});

test('--seat-models: checked before any call, as JSON or as a file; the ai10 cast follows the casting rules', t => {
  const dir = tempDir(t);
  const one = [{ model: 'openai/gpt-6.1-sol', api: 'openrouter', persona: ' Bold. ' }];
  assert.deepEqual(parseSeatModels(JSON.stringify(one)), [{ model: 'openai/gpt-6.1-sol', api: 'openrouter', persona: 'Bold.' }]);
  const file = path.join(dir, 'cast.json');
  fs.writeFileSync(file, JSON.stringify({ note: 'x', seats: one }));
  assert.deepEqual(parseSeatModels(file), parseSeatModels(JSON.stringify(one)));
  for (const [bad, why] of [
    ['[]', /at least one seat/], ['{"a":1}', /JSON array/], ['[{"api":"openrouter"}]', /needs a model/], ['[{"model":"m"}]', /needs an api/],
    ['[{"model":"m","api":"openrouter","effort":"high"}]', /effort is for claude seats only/],
    ['[{"model":"claude-sonnet-5-5","api":"claude","effort":"huge"}]', /effort is one of/],
    ['[{"model":"claude-nope","api":"claude"}]', /has no Claude price/],
    ['[{"model":"m","api":"openrouter","sliders":{}}]', /unknown keys: sliders/],
    [`[{"model":"m","api":"openrouter","persona":"${'x'.repeat(301)}"}]`, /at most 300 characters/],
    ['[{"seat":"cook","model":"m","api":"openrouter"},{"model":"m","api":"openrouter"}]', /on every entry or on none/],
    ['[{"model":', /is not JSON/], [path.join(dir, 'missing.json'), /neither JSON nor a file/],
  ]) assert.throws(() => parseSeatModels(bad), why, bad);

  // the ai10 cast (SPEC section 5)
  const cast = checkSeatModels(ai10Template());
  assert.deepEqual(cast.map(m => m.seat), seatSpecs(CONFIG), 'one entry per seat, in seat order');
  const strong = m => ['claude-sonnet-5-5', 'claude-opus-5-5', 'openai/gpt-6.1-sol', 'moonshotai/kimi-k3.1-pro'].includes(m.model);
  assert.equal(cast.filter(strong).length, 5, 'a strong model in five seats');
  assert.equal(cast.filter(m => !strong(m)).length, 5, 'a cheap one in the other five');
  const family = m => (m.api === 'claude' ? 'anthropic' : m.model.split('/')[0]);
  assert.ok(new Set(cast.map(family)).size >= 4, 'at least four model families');
  // the model that played safe in mini is not a robber or the cook
  for (const m of cast.filter(x => ['robber', 'robber#2', 'cook'].includes(x.seat))) assert.equal(/sonnet/.test(m.model), false, `${m.seat} is on ${m.model}`);
  for (const m of cast) {
    assert.ok(m.persona.length > 20 && m.persona.length <= 300, m.seat);
    if (m.api === 'claude') assert.ok(Object.hasOwn(PRICES, m.model));
  }
  // a lineup takes the cast by seat name, and marks the owners
  const o = { ai: true, lineup: 'ai5', owners: ['robber'] };
  const seats = lineupFor(o, cast);
  assert.deepEqual(seats.filter(s => s.kind === 'ai').map(s => s.cls), ['cook', 'dealer', 'robber', 'muscle', 'informant']);
  assert.equal(seats[seatIndex(CONFIG, 'cook')].model, cast.find(m => m.seat === 'cook').model);
  assert.equal(seats[seatIndex(CONFIG, 'robber')].owner, true);
  assert.throws(() => lineupFor({ ai: true, lineup: 'ai10', owners: [] }, cast.slice(0, 3).map(({ seat, ...m }) => m)), /has 10 AI seats and --seat-models has 3/);
  assert.throws(() => lineupFor({ ai: true, lineup: 'default', owners: [] }, cast), /has no AI seats/);
});

test('a bot run writes report.md and report.json with the marks, and the first season\'s own files', async t => {
  const out = path.join(tempDir(t), 'bots');
  const said = [];
  const res = await main(['--bots', '--seeds', '6', '--start', '3', '--out', out], { log: s => said.push(s) });
  assert.deepEqual(fs.readdirSync(out).sort(), ['3', 'report.json', 'report.md', 'run.json']);
  const report = fs.readFileSync(path.join(out, 'report.md'), 'utf8');
  assert.match(report, /## Lineup `default`, 6 seasons/);
  assert.match(report, /\| # \| Mark \| Measured \| Wanted \| \|/);
  const data = json(path.join(out, 'report.json'));
  assert.equal(data.runs[0].lineup, 'default');
  assert.equal(data.runs[0].seasons, 6);
  assert.ok(data.runs[0].marks.length >= 10);
  assert.deepEqual(res.summary[0].marks, data.runs[0].marks);
  // the marks are printed
  for (const m of data.runs[0].marks) assert.ok(said.some(s => s.includes(`${m.n}. ${m.name}`)), m.name);
  const run = json(path.join(out, 'run.json'));
  assert.deepEqual([run.mode, run.lineup, run.seeds, run.kept], ['bots', 'default', [3, 4, 5, 6, 7, 8], [3]]);
  // the first season's own files
  const season = fs.readdirSync(path.join(out, '3')).sort();
  assert.deepEqual(season.filter(f => f !== 'episode.html'), ['feed.jsonl', 'report.md', 'season.json']);
  assert.equal(season.includes('episode.html'), episodeBuilt);
  assert.equal(lines(path.join(out, '3', 'feed.jsonl')).filter(l => l.type === 'hour').length, totalHours(CONFIG));
  const saved = json(path.join(out, '3', 'season.json'));
  assert.deepEqual([saved.seed, saved.lineup, saved.phase, saved.config.name], [3, 'default', 'over', 'default']);
  assert.equal(saved.standings.length, 10);
  // the same seeds give the same marks
  const again = await main(['--bots', '--seeds', '6', '--start', '3', '--keep', '0', '--out', path.join(out, '..', 'again')], quiet);
  assert.deepEqual(again.summary, res.summary);
  assert.equal(fs.existsSync(path.join(out, '..', 'again', '3')), false, '--keep 0 writes no season files');
});

test('--all-marks plays every lineup the marks need into one report', async t => {
  const out = path.join(tempDir(t), 'marks');
  const res = await main(['--bots', '--seeds', '3', '--all-marks', '--keep', '0', '--out', out], { ...quiet, variantSeeds: 2, deadSeeds: 1 });
  const want = ['default', 'cautious', ...classSpecs(CONFIG).map(c => `turtle:${c}`), ...classSpecs(CONFIG).map(c => `grind:${c}`), ...seatSpecs(CONFIG).map(s => `dead:${s}`)];
  assert.deepEqual(res.summary.map(r => r.lineup), want);
  assert.deepEqual(res.summary.map(r => r.seasons), [3, 3, ...Array(14).fill(2), ...Array(10).fill(1)]);
  const report = fs.readFileSync(path.join(out, 'report.md'), 'utf8');
  for (const lineup of want) assert.ok(report.includes(`## Lineup \`${lineup}\``), lineup);
  assert.match(report, /The turtle finished in the bottom half in/);
  assert.match(report, /The safe grind finished in the bottom half in/);
  assert.ok(res.summary.find(r => r.lineup === 'turtle:cook').variant.seeds === 2);
});

test('a fake ai10 season through the command line: every output, 0 failed turns, the AI marks and the spend', async t => {
  const out = path.join(tempDir(t), 'fake');
  const said = [];
  const res = await main(['--ai', '--fake', '--lineup', 'ai10', '--seeds', '1', '--start', '7', '--out', out], { log: s => said.push(s) });
  assert.deepEqual(res.done, [7]);
  assert.equal(res.stopped, null);
  const dir = path.join(out, '7');
  const files = fs.readdirSync(dir).sort();
  assert.deepEqual(files.filter(f => f !== 'episode.html'), ['ai-replies.jsonl', 'feed.jsonl', 'report.md', 'season.json']);
  assert.equal(files.includes('episode.html'), episodeBuilt, res.runJson.episode);
  if (episodeBuilt) assert.equal(res.runJson.episode, 'written');

  // ai-replies.jsonl: one line a call, with the prompt's sizes, the raw reply, what was parsed, usage and cost
  const replies = lines(path.join(dir, 'ai-replies.jsonl'));
  assert.equal(replies.length, CALLS_PER_SEASON);
  for (const r of replies) {
    assert.equal(r.ok, true, `${r.agentId} t=${r.t}: ${r.why}`);
    assert.ok(r.prompt.system > 0 && r.prompt.user > 0 && typeof r.raw === 'string' && r.reply && r.usage.in > 0);
    assert.equal(typeof r.usage.cost, 'number');
  }
  assert.equal(replies.filter(r => r.kind === 'journal').length, 10 * CONFIG.season.days);

  // season.json: the final state, the standings, the config, the lineup and the seat models
  const season = json(path.join(dir, 'season.json'));
  assert.deepEqual([season.seed, season.lineup, season.phase, season.hoursPlayed], [7, 'ai10', 'over', totalHours(CONFIG)]);
  assert.equal(season.standings.length, 10);
  assert.equal(season.state.final[0].rank, 1);
  assert.deepEqual(season.seatModels.map(m => m.model), ai10Template().map(m => m.model));
  assert.deepEqual(season.seats.map(s => [s.kind, s.model]), ai10Template().map(m => ['ai', m.model]));
  assert.ok(season.state.agents.a3.persona.length > 20, 'the persona reached the agent');
  assert.equal(lines(path.join(dir, 'feed.jsonl')).length, res.finished[0].game.feed.length);

  // the reports: the AI marks, the failed-turn count and the spend
  for (const file of [path.join(dir, 'report.md'), path.join(out, 'report.md')]) {
    const report = fs.readFileSync(file, 'utf8');
    for (const mark of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']) assert.ok(report.includes(`| ${mark} |`), `${file}: ${mark}`);
    assert.match(report, /\| A4 \| no failed turns \| 0 failed \| PASS \|/);
    assert.match(report, /Spent: \$\d+\.\d{4} over 650 calls \(\d+ tokens in, \d+ out\)\./);
  }
  const top = fs.readFileSync(path.join(out, 'report.md'), 'utf8');
  assert.match(top, /\*\*Failed turns: 0\*\* of 600\. Failed journals: 0 of 50\./);
  assert.match(top, /\*\*Spend: \$\d+\.\d{4}\*\* over 650 calls/);
  assert.match(top, /Transport: \*\*fake\*\* \(nothing was billed/);
  assert.ok(said.some(s => /failed turns: 0 \| spend: \$\d+\.\d{4} over 650 calls/.test(s)));
  const run = json(path.join(out, 'run.json'));
  assert.deepEqual([run.mode, run.transport, run.go, run.maxCost, run.progress['7'].status], ['ai-fake', 'fake', null, null, 'done']);
  assert.equal(run.ai.total.calls, CALLS_PER_SEASON);
  assert.equal(run.ai.total.failedTurns + run.ai.total.failedJournals + run.ai.total.skipped, 0);
  assert.equal(JSON.stringify(run).includes(KEY_WORD), false);
});

test('a pause-nights run with an owner and a note, resumed through its files, equals the same run played in one go', async t => {
  const out = path.join(tempDir(t), 'paused');
  const seed = 4;
  const argv = ['--ai', '--fake', '--lineup', 'ai10', '--seeds', '1', '--start', String(seed), '--pause-nights', '--owner', 'cook', '--out', out];
  const dir = path.join(out, String(seed));
  const sheetFile = path.join(dir, 'levelup', `a${seatIndex(CONFIG, 'cook') + 1}.json`);

  // through the files: stop, fill the sheet in, resume, five times
  let res = await main(argv, quiet);
  const nights = [];
  const sheets = [];
  while (res.stopped) {
    assert.equal(res.stopped.kind, 'paused');
    nights.push(res.stopped.night);
    assert.deepEqual(fs.readdirSync(path.join(dir, 'levelup')), [path.basename(sheetFile)], 'one sheet: the owner\'s');
    assert.ok(fs.existsSync(path.join(dir, 'save.json')) && fs.existsSync(path.join(dir, 'season.json')));
    if (episodeBuilt) assert.ok(fs.existsSync(path.join(dir, 'episode.html')), 'the episode page so far');
    const sheet = json(sheetFile);
    assert.equal(sheet.night, res.stopped.night);
    assert.equal(sheet.note, '');
    if (sheet.night > 0) assert.ok(sheet.ask, "the agent's ask from its journal is on the sheet");
    sheets.push(fill(sheet));
    fs.writeFileSync(sheetFile, JSON.stringify(sheets.at(-1), null, 2));
    assert.equal(json(path.join(out, 'run.json')).stopped.kind, 'paused');
    res = await main(['--resume', out], quiet);
  }
  assert.deepEqual(nights, [0, 1, 2, 3, 4], 'one stop before hour 0 and one after each of the four nights');
  assert.deepEqual(res.done, [seed]);
  assert.equal(fs.existsSync(path.join(dir, 'save.json')), false, 'a finished season keeps no save');
  await assert.rejects(main(['--resume', out], quiet), /is not paused: there is nothing to resume/);

  // in one go, in memory: the same lineup and fake seats, the same sheets handed straight to the season
  const o = { ai: true, lineup: 'ai10', owners: ['cook'] };
  const seatModels = seatModelsFor({ ai: true, seatModels: null, api: null });
  const game = createGame({ seed, cfg: CONFIG, map: CITY, lineup: lineupFor(o, seatModels), run: path.basename(out) });
  const seats = createAiSeats({
    seats: game.state.order.map((agentId, i) => ({ agentId, model: seatModels[i].model, api: seatModels[i].api, ...(seatModels[i].effort ? { effort: seatModels[i].effort } : {}) })),
    transport: 'fake', concurrency: 10, fakeBrain: botBrain(game),
  });
  const owner = Object.values(game.state.agents).find(a => a.owner);
  let result = await advance(game, { seats, pauseNights: true });
  let stops = 0;
  while (result === 'paused') {
    const sheet = fill(levelUpSheet(game, owner));
    assert.deepEqual(sheet, sheets[stops], `the sheet at stop ${stops} is the one the files showed`);
    stops += 1;
    result = await advance(game, { seats, pauseNights: true, sheets: { [owner.id]: sheet } });
  }
  await seats.close();
  assert.equal(stops, 5);

  // the same bytes
  assert.equal(fs.readFileSync(path.join(dir, 'feed.jsonl'), 'utf8'), game.feed.map(l => JSON.stringify(l)).join('\n') + '\n');
  assert.deepEqual(json(path.join(dir, 'season.json')).state, JSON.parse(JSON.stringify(game.state)));
  // the note reached the agent and the feed, and the skills were bought
  const saved = json(path.join(dir, 'season.json')).state.agents[owner.id];
  assert.equal(saved.note, 'Night 4: sell high, and watch the robbers.');
  assert.ok(saved.bought.length >= 2);
  const levelups = lines(path.join(dir, 'feed.jsonl')).filter(l => l.type === 'levelup' && l.owners);
  assert.equal(levelups.length, 5);
  assert.equal(levelups[1].bought[0].note, 'Night 1: sell high, and watch the robbers.');
  // every call of the season was made once: nothing was replayed after a resume
  const replies = lines(path.join(dir, 'ai-replies.jsonl'));
  assert.equal(replies.length, CALLS_PER_SEASON);
  assert.equal(new Set(replies.map(r => `${r.agentId}|${r.t}|${r.kind}`)).size, CALLS_PER_SEASON);
  const run = json(path.join(out, 'run.json'));
  assert.equal(run.resumes.length, 5);
  assert.equal(run.ai.total.calls, CALLS_PER_SEASON);
  assert.equal(run.ai.total.failedTurns, 0);
  // a sheet that was spoiled stops the resume with a plain message
  const broken = path.join(out, '..', 'broken');
  await main([...argv.slice(0, -1), broken], quiet);
  fs.writeFileSync(path.join(broken, String(seed), 'levelup', path.basename(sheetFile)), '{ not json');
  await assert.rejects(main(['--resume', broken], quiet), /is not JSON any more/);
});

test('the hard stop cuts a run when the tally passes --max-cost; carrying on needs a bigger number', async t => {
  const out = path.join(tempDir(t), 'cut');
  const said = [];
  // a fake run takes --max-cost too: the fake prices its Claude seats, so the stop can be rehearsed for $0
  const res = await main(['--ai', '--fake', '--lineup', 'ai10', '--seeds', '2', '--max-cost', '0.2', '--out', out], { log: s => said.push(s) });
  assert.equal(res.stopped.kind, 'cut');
  assert.equal(res.stopped.halt, 'cap');
  assert.equal(res.stopped.seed, 1);
  assert.deepEqual(res.done, []);
  assert.ok(res.total.cost >= 0.2, `the tally passed the stop: $${res.total.cost}`);
  assert.ok(res.total.cost < 0.3, `and not by much: $${res.total.cost}`);
  const season = json(path.join(out, '1', 'season.json'));
  assert.notEqual(season.phase, 'over');
  assert.ok(season.hoursPlayed > 0 && season.hoursPlayed < totalHours(CONFIG), `cut at hour ${season.hoursPlayed}`);
  assert.equal(season.cut.why, res.stopped.why);
  assert.equal(fs.existsSync(path.join(out, '2')), false, 'the second season never started');
  // nothing was called after the stop: the last hour's unasked seats rested, and that was the end
  const replies = lines(path.join(out, '1', 'ai-replies.jsonl'));
  const asked = replies.filter(r => r.tries > 0);
  assert.equal(asked.length, res.total.calls);
  const never = replies.filter(r => r.tries === 0);
  assert.ok(never.every(r => r.why === 'capped' && r.t === season.hoursPlayed - 1), 'the only turns never asked were in the hour the stop fell in');
  assert.equal(res.total.skipped, never.length);
  const report = fs.readFileSync(path.join(out, 'report.md'), 'utf8');
  assert.match(report, /\*\*The run was cut after Day \d \d\d:00, seed 1\*\* \(cap: the spend reached the cap/);
  assert.ok(said.some(s => /CUT after Day \d \d\d:00, seed 1/.test(s)));

  // carrying on spends more, so it needs a new, bigger --max-cost
  await assert.rejects(main(['--resume', out], quiet), /resuming needs a new --max-cost above that/);
  await assert.rejects(main(['--resume', out, '--max-cost', '0.1'], quiet), /resuming needs a new --max-cost above that/);
  const more = await main(['--resume', out, '--max-cost', '50'], quiet);
  assert.equal(more.stopped, null);
  assert.deepEqual(more.done, [1, 2]);
  assert.equal(json(path.join(out, '1', 'season.json')).phase, 'over');
  assert.ok(more.total.cost > res.total.cost, 'one tally for the whole run');
  assert.equal(more.total.calls, 2 * CALLS_PER_SEASON - res.total.skipped);
});

test('the hard stop on the live path (stub fetch, temp key files): the preflight, the key in the header only, the cut', async t => {
  const dir = tempDir(t);
  const out = path.join(dir, 'live');
  const cast = JSON.stringify(Array.from({ length: 10 }, () => ({ model: 'openai/gpt-6.1-sol', api: 'openrouter', persona: 'Plain.' })));
  // every chat call costs a cent and answers "rest"; the account has $10 and the key $5 left
  const answers = balance => asked => (asked.method === 'GET'
    ? { body: { data: asked.url.endsWith('/credits') ? { total_credits: balance, total_usage: 0 } : { limit_remaining: 5, usage: 0 } } }
    : { body: completion(JSON.stringify({ move: 'rest', confessional: 'Resting.' }), { cost: 0.01 }) });
  const stub = stubFetch(answers(10));
  const seatOptions = { fetch: stub, keyFile: fakeKeyFile(dir), url: 'http://fake.invalid/api/v1/chat/completions' };
  const res = await main(['--ai', '--lineup', 'ai10', '--seat-models', cast, '--seeds', '1', '--start', '9', '--max-cost', '0.25', '--go', 'test go words', '--out', out], { ...quiet, seatOptions });
  assert.equal(res.stopped.kind, 'cut');
  const gets = stub.seen.filter(s => s.method === 'GET');
  const posts = stub.seen.filter(s => s.method === 'POST');
  assert.deepEqual(gets.map(s => new URL(s.url).pathname).slice(0, 2), ['/api/v1/credits', '/api/v1/key'], 'the preflight read the balance and the key limit first');
  assert.ok(posts.length >= 25 && posts.length <= 30, `${posts.length} paid calls: the 25 that reached the stop, and at most the rest of that hour's wave`);
  assert.ok(Math.abs(res.total.cost - posts.length * 0.01) < 1e-9);
  for (const s of stub.seen) assert.equal(s.headers.get('authorization'), `Bearer ${KEY_WORD}`);
  const run = json(path.join(out, 'run.json'));
  assert.deepEqual([run.transport, run.maxCost, run.go, run.preflight.refused, run.preflight.balance], ['live', 0.25, 'test go words', null, 10]);
  // the key is in no file the run wrote
  for (const file of fs.readdirSync(out, { recursive: true }).map(f => path.join(out, f)).filter(f => fs.statSync(f).isFile())) {
    assert.equal(fs.readFileSync(file, 'utf8').includes(KEY_WORD), false, file);
  }
  // resuming a cut live run needs the go words again
  await assert.rejects(main(['--resume', out, '--max-cost', '1'], { ...quiet, seatOptions }), /resuming needs --go/);

  // a preflight that finds too little money refuses the run before any paid call
  const poor = stubFetch(answers(0.1));
  await assert.rejects(
    main(['--ai', '--seat-models', cast, '--max-cost', '0.25', '--go', 'go', '--out', path.join(dir, 'poor')], { ...quiet, seatOptions: { ...seatOptions, fetch: poor } }),
    /preflight refused: the account's balance, \$0\.10, is below --max-cost \$0\.25/,
  );
  assert.equal(poor.seen.filter(s => s.method === 'POST').length, 0);
});

test('the dry run spends one hour only, and prints a season estimate with a hard stop about 30% above it', async t => {
  const dir = tempDir(t);
  // fake: 10 calls, one per seat
  const said = [];
  const fake = await main(['--ai', '--fake', '--dry-run', '--start', '9', '--out', path.join(dir, 'dry')], { log: s => said.push(s) });
  assert.equal(fake.dryRun.spend.calls, 10);
  assert.equal(fake.dryRun.turns.length, 10);
  assert.ok(fake.dryRun.turns.every(tr => tr.t === 0 && tr.kind === 'turn' && tr.ok));
  assert.equal(fake.dryRun.callsPerSeat, totalHours(CONFIG) + CONFIG.season.days);
  assert.ok(Math.abs(fake.dryRun.estimateSeason - fake.dryRun.estimate.total * SEAT_DEFAULTS.promptGrowth) < 1e-12);
  const ratio = fake.dryRun.suggestedMaxCost / fake.dryRun.estimateSeason;
  assert.ok(ratio >= 1.3 && ratio < 1.4, `the suggested stop is ${ratio.toFixed(2)} times the estimate`);
  assert.ok(said.some(s => /^season estimate: \$\d+\.\d{4}/.test(s)));
  assert.ok(said.some(s => /^suggested --max-cost: \$\d+\.\d\d \(about 30% above the estimate/.test(s)));
  assert.equal(lines(path.join(dir, 'dry', '9', 'ai-replies.jsonl')).length, 10);
  assert.equal(fs.existsSync(path.join(dir, 'dry', '9', 'feed.jsonl')), false, 'a dry run is not a season');
  assert.equal(json(path.join(dir, 'dry', 'run.json')).dryRun.spend.calls, 10);

  // live path (stub fetch): two preflight reads and ten paid calls, then it stops
  const cast = JSON.stringify(Array.from({ length: 10 }, () => ({ model: 'openai/gpt-6.1-sol', api: 'openrouter' })));
  const stub = stubFetch(asked => (asked.method === 'GET'
    ? { body: { data: asked.url.endsWith('/credits') ? { total_credits: 50, total_usage: 0 } : { limit_remaining: null, usage: 0 } } }
    : { body: completion(JSON.stringify({ move: 'rest' }), { cost: 0.002 }) }));
  const live = await main(['--ai', '--dry-run', '--seat-models', cast, '--max-cost', '8', '--go', 'dry run only', '--out', path.join(dir, 'live-dry')], {
    ...quiet, seatOptions: { fetch: stub, keyFile: fakeKeyFile(dir), url: 'http://fake.invalid/api/v1/chat/completions' },
  });
  assert.equal(stub.seen.filter(s => s.method === 'POST').length, 10, 'one hour: ten calls');
  assert.equal(stub.seen.filter(s => s.method === 'GET').length, 2);
  assert.ok(Math.abs(live.dryRun.spend.cost - 0.02) < 1e-12);
  // 10 seats x 65 calls x $0.002, times the growth factor
  assert.ok(Math.abs(live.dryRun.estimateSeason - 10 * 65 * 0.002 * SEAT_DEFAULTS.promptGrowth) < 1e-9);
  assert.equal(live.dryRun.suggestedMaxCost, Math.ceil(live.dryRun.estimateSeason * 1.3 * 4) / 4);
});
