// The run.mjs command line (SPEC section 17). main(argv) returns what it wrote, so tests can drive it in-process.
// Pattern from hotkey mini's cli.mjs (commit 3438059): the same refusals, the same dry run, the same run.json.
//
//   node run.mjs --bots --seeds 200 [--lineup default|cautious|turtle:<seat>|grind:<seat>|dead:<seat>] [--start 1]
//   node run.mjs --bots --seeds 200 --all-marks        every lineup the marks need, in one report
//   node run.mjs --ai --fake --lineup ai10 --seeds 1   a free fake AI season, with every output
//   node run.mjs --ai --lineup ai10 --seat-models <json or file> --seeds 1 --start 9 --max-cost <n> --go "<words>"
//        [--dry-run] [--pause-nights --owner <seat>]   paid: only ever run with slime's go
//   node run.mjs --resume <run>                        carry on after a night pause (or, with a new --max-cost
//                                                      and --go, after the hard stop cut a run)
// Other options: --out <dir>, --keep <n|all> (how many seasons of a bot run get their own files; default 1),
//   --api local [--model <id>] (every AI seat on the Mac's own model: free, a plumbing check), --quiet.
//
// --seat-models is a JSON array, or a file holding one (data/seat-models-ai10.json is the ai10 cast):
//   [{ "seat": "robber#2", "model": "...", "api": "openrouter"|"claude"|"local", "effort": "high", "persona": "..." }]
//   With "seat" on every entry they are matched by seat; without, they fill the AI seats in order.
//
// What a run writes, under out/<run>/:
//   run.json, report.md, report.json
//   <seed>/feed.jsonl, season.json, report.md, episode.html (when src/episode.mjs is there), ai-replies.jsonl (AI runs)
//   <seed>/levelup/<agentId>.json and <seed>/save.json at a night pause
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './config.mjs';
import { CITY } from './map.mjs';
import { buildLineup, seatIndex, seatSpecs, classSpecs } from './lineups.mjs';
import { createGame, advance, playBotSeason, levelUpSheet } from './season.mjs';
import { seasonStats, variantMark } from './stats.mjs';
import { botReport, aiReport, marksTable } from './report.mjs';
import { dayOf, hourOfDay, totalHours } from './state.mjs';
import { SEAT_DEFAULTS, APIS, PAID_APIS, LIMITS, ai10Template } from './seats/defaults.mjs';
import { CLAUDE_EFFORTS, PRICES } from './seats/anthropic.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEAT_KEYS = ['seat', 'model', 'api', 'effort', 'persona'];
const SAVE_VERSION = 1;
// How many seasons each extra lineup of --all-marks plays (SPEC section 18).
const VARIANT_SEEDS = 100;
const DEAD_SEEDS = 50;

const dollars = x => (x === null || x === undefined ? 'n/a' : `$${x.toFixed(4)}`);
const secs = ms => (ms === null || ms === undefined ? 'n/a' : `${(ms / 1000).toFixed(1)} s`);
const seatLabel = m => `${m.model} (${m.api}${m.effort ? `, ${m.effort}` : ''})`;
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const clockOf = (cfg, t) => `Day ${dayOf(cfg, t)} ${String(cfg.season.firstHour + hourOfDay(cfg, t)).padStart(2, '0')}:00`;

/** --seat-models: a JSON array (or a file holding one), checked here so a typo stops the run before any call. */
export function parseSeatModels(text) {
  let source = text;
  if (!/^\s*[[{]/.test(text)) {
    const file = path.resolve(text);
    if (!fs.existsSync(file)) throw new Error(`--seat-models is neither JSON nor a file that exists: ${text}`);
    source = fs.readFileSync(file, 'utf8');
  }
  let list;
  try {
    list = JSON.parse(source);
  } catch (e) {
    throw new Error(`--seat-models is not JSON: ${e.message}`);
  }
  if (list && !Array.isArray(list) && Array.isArray(list.seats)) list = list.seats;
  return checkSeatModels(list);
}

export function checkSeatModels(list) {
  if (!Array.isArray(list) || list.length === 0) throw new Error('--seat-models is a JSON array of { seat?, model, api, effort?, persona? }, with at least one seat');
  const out = list.map((m, i) => {
    const at = `--seat-models[${i}]`;
    if (!m || typeof m !== 'object' || Array.isArray(m)) throw new Error(`${at} is not an object`);
    const extra = Object.keys(m).filter(k => !SEAT_KEYS.includes(k));
    if (extra.length) throw new Error(`${at} has unknown keys: ${extra.join(', ')} (it takes ${SEAT_KEYS.join(', ')})`);
    if (typeof m.model !== 'string' || !m.model.trim()) throw new Error(`${at} needs a model`);
    if (!APIS.includes(m.api)) throw new Error(`${at} needs an api: ${APIS.join(', ')}`);
    if (m.effort !== undefined && m.api !== 'claude') throw new Error(`${at}: effort is for claude seats only`);
    if (m.effort !== undefined && !CLAUDE_EFFORTS.includes(m.effort)) throw new Error(`${at}: effort is one of ${CLAUDE_EFFORTS.join(', ')}`);
    if (m.api === 'claude' && !Object.hasOwn(PRICES, m.model)) throw new Error(`${at}: ${m.model} has no Claude price (known: ${Object.keys(PRICES).join(', ')})`);
    if (m.seat !== undefined && (typeof m.seat !== 'string' || !m.seat.trim())) throw new Error(`${at}: seat is a seat name such as "dealer" or "robber#2"`);
    if (m.persona !== undefined && (typeof m.persona !== 'string' || !m.persona.trim() || m.persona.trim().length > LIMITS.persona)) {
      throw new Error(`${at}: persona is a non-empty string of at most ${LIMITS.persona} characters`);
    }
    return {
      ...(m.seat !== undefined ? { seat: m.seat.trim() } : {}), model: m.model, api: m.api,
      ...(m.effort !== undefined ? { effort: m.effort } : {}), ...(m.persona !== undefined ? { persona: m.persona.trim() } : {}),
    };
  });
  const named = out.filter(m => m.seat !== undefined).length;
  if (named !== 0 && named !== out.length) throw new Error('--seat-models: give "seat" on every entry or on none');
  return out;
}

export function parseArgs(argv) {
  const o = {
    bots: false, ai: false, fake: false, seeds: 1, start: 1, lineup: null, allMarks: false, out: null, seatModels: null, api: null, model: null,
    maxCost: null, go: null, dryRun: false, pauseNights: false, owners: [], resume: null, keep: 1, quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    switch (a) {
      case '--bots': o.bots = true; break;
      case '--ai': o.ai = true; break;
      case '--fake': o.fake = true; break;
      case '--seeds': o.seeds = Number(val()); break;
      case '--start': o.start = Number(val()); break;
      case '--lineup': o.lineup = val(); break;
      case '--all-marks': o.allMarks = true; break;
      case '--out': o.out = val(); break;
      case '--seat-models': o.seatModels = parseSeatModels(val()); break;
      case '--api': o.api = val(); break;
      case '--model': o.model = val(); break;
      case '--max-cost': o.maxCost = Number(val()); break;
      case '--go': o.go = val(); break;
      case '--dry-run': o.dryRun = true; break;
      case '--pause-nights': o.pauseNights = true; break;
      case '--owner': o.owners.push(...val().split(',').map(s => s.trim()).filter(Boolean)); break;
      case '--resume': o.resume = val(); break;
      case '--keep': {
        const v = val();
        o.keep = v === 'all' ? Infinity : Number(v);
        break;
      }
      case '--quiet': o.quiet = true; break;
      default: throw new Error(`unknown option ${a}`);
    }
  }
  if (o.resume) {
    if (o.bots || o.ai) throw new Error('--resume carries on a run as it was started: leave out --bots and --ai');
    return o;
  }
  if (!Number.isInteger(o.seeds) || o.seeds < 1) throw new Error('--seeds needs a whole number of at least 1');
  if (!Number.isInteger(o.start)) throw new Error('--start needs a whole number');
  if (!(o.keep === Infinity || (Number.isInteger(o.keep) && o.keep >= 0))) throw new Error('--keep needs a whole number, or "all"');
  if (!o.bots && !o.ai) throw new Error('say --bots or --ai (or --resume <run>)');
  if (o.bots && o.ai) throw new Error('--bots and --ai are separate runs');
  o.lineup ??= o.ai ? 'ai10' : 'default';
  if (o.api !== null && o.api !== 'local') throw new Error('--api takes "local": every AI seat on the Mac\'s own model. Other APIs are set per seat in --seat-models');
  if ((o.seatModels || o.api || o.fake || o.dryRun || o.maxCost !== null || o.go !== null) && !o.ai) throw new Error('--seat-models, --api, --fake, --dry-run, --max-cost and --go are for --ai runs');
  if (o.seatModels && o.api) throw new Error('--api local replaces --seat-models: give one of them');
  if (o.allMarks && !o.bots) throw new Error('--all-marks is for --bots runs');
  if (o.allMarks && (o.pauseNights || o.owners.length)) throw new Error('--all-marks plays plain bot seasons: no owners');
  if (o.pauseNights && !o.owners.length) throw new Error('--pause-nights needs --owner <seat>: the seat whose skills a person chooses');
  if (o.dryRun && o.pauseNights) throw new Error('--dry-run plays one hour and stops: leave out --pause-nights');
  return o;
}

/** A real run with any paid seat needs both a spend cap and slime's go words (SPEC section 1). */
function refuseUnlessCleared(o, seatModels) {
  if (!o.ai || o.fake) return;
  if (!seatModels.some(m => PAID_APIS.includes(m.api))) return; // the Mac's own model only: free
  if (!(Number.isFinite(o.maxCost) && o.maxCost > 0)) throw new Error('refusing a real AI run without --max-cost');
  if (!o.go || !String(o.go).trim()) throw new Error('refusing a real AI run without --go "<slime\'s words>"');
}

function gitCommit() {
  try {
    const head = fs.readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8').trim();
    if (!head.startsWith('ref: ')) return head;
    const ref = head.slice(5);
    const p = path.join(ROOT, '.git', ref);
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
    const packed = fs.readFileSync(path.join(ROOT, '.git', 'packed-refs'), 'utf8');
    return packed.split('\n').find(l => l.endsWith(` ${ref}`))?.split(' ')[0] ?? null;
  } catch {
    return null;
  }
}

const configHash = cfg => crypto.createHash('sha256').update(JSON.stringify(cfg)).digest('hex').slice(0, 8);

/** The lineup for a run: the named one, with the AI seats' models and personas and the owners' seats marked. */
export function lineupFor(o, seatModels, cfg = CONFIG) {
  const seats = buildLineup(o.lineup, cfg);
  const specs = seatSpecs(cfg);
  if (o.ai) {
    const aiSeats = seats.map((s, i) => ({ s, spec: specs[i] })).filter(x => x.s.kind === 'ai');
    if (!aiSeats.length) throw new Error(`lineup ${o.lineup} has no AI seats: use ai10 or ai5`);
    const bySeat = seatModels.every(m => m.seat !== undefined);
    if (!bySeat && seatModels.length !== aiSeats.length) throw new Error(`lineup ${o.lineup} has ${aiSeats.length} AI seats and --seat-models has ${seatModels.length}`);
    aiSeats.forEach(({ s, spec }, i) => {
      const m = bySeat ? seatModels.find(x => specs[seatIndex(cfg, x.seat)] === spec) : seatModels[i];
      if (!m) throw new Error(`--seat-models has no entry for the ${spec} seat`);
      Object.assign(s, { model: m.model, api: m.api, ...(m.effort ? { effort: m.effort } : {}), persona: m.persona ?? '' });
    });
  }
  for (const spec of o.owners) seats[seatIndex(cfg, spec)].owner = true;
  return seats;
}

/** The seat models a run uses: what was given, or the ai10 cast (on the Mac's own model with --api local). */
export function seatModelsFor(o) {
  if (!o.ai) return null;
  if (o.seatModels) return o.seatModels;
  const cast = checkSeatModels(ai10Template());
  if (o.api === 'local') return cast.map(m => ({ seat: m.seat, model: o.model ?? 'local', api: 'local', ...(m.persona ? { persona: m.persona } : {}) }));
  return cast;
}

// ---------------------------------------------------------------------------------------------------------------
// What a season writes

/** The episode page, when the module that builds it is there. Returns what happened, for run.json. */
async function writeEpisode(dir, game, options) {
  try {
    const mod = await import('./episode.mjs');
    if (typeof mod.episodeHtml !== 'function') return 'no episodeHtml in src/episode.mjs';
    const html = await mod.episodeHtml(game, options);
    if (typeof html !== 'string' || !html) return 'the episode builder returned no page';
    fs.writeFileSync(path.join(dir, 'episode.html'), html);
    return 'written';
  } catch (e) {
    return e?.code === 'ERR_MODULE_NOT_FOUND' ? 'src/episode.mjs is not there yet' : `the episode builder failed: ${String(e?.message ?? e).slice(0, 200)}`;
  }
}

const seatsOf = game => game.state.order.map(id => {
  const a = game.state.agents[id];
  return { id, name: a.name, cls: a.cls, kind: a.kind, model: a.model ?? null, variant: a.variant ?? null, owner: !!a.owner };
});

function writeFeed(dir, game) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'feed.jsonl'), game.feed.map(l => JSON.stringify(l)).join('\n') + '\n');
}

/** feed.jsonl, season.json, report.md and the episode page for one season, finished or not. */
async function writeSeason(dir, game, { run, lineup, seatModels = null, stats = null, report = null, ai = null, cut = null }) {
  writeFeed(dir, game);
  const { cfg, state } = game;
  writeJson(path.join(dir, 'season.json'), {
    run, seed: state.seed, lineup, config: { name: cfg === CONFIG ? 'default' : 'custom', hash: configHash(cfg) },
    seats: seatsOf(game), seatModels, phase: state.phase, hoursPlayed: state.t, cut,
    standings: state.final ?? state.standings ?? null, ...(stats ? { stats } : {}), state,
  });
  if (report) fs.writeFileSync(path.join(dir, 'report.md'), report);
  return writeEpisode(dir, game, { run, seed: state.seed, lineup, seatModels, ai, cut, partial: state.phase !== 'over' });
}

// ---------------------------------------------------------------------------------------------------------------
// Bot runs

function botRun(o, { say, outDir, runName, runJson, variantSeeds = VARIANT_SEEDS, deadSeeds = DEAD_SEEDS }) {
  const cfg = CONFIG;
  const seedsOf = n => Array.from({ length: n }, (_, i) => o.start + i);
  const plan = [{ lineup: o.lineup, seeds: seedsOf(o.seeds) }];
  if (o.allMarks) {
    if (o.lineup !== 'cautious') plan.push({ lineup: 'cautious', seeds: seedsOf(o.seeds) });
    for (const cls of classSpecs(cfg)) plan.push({ lineup: `turtle:${cls}`, seeds: seedsOf(variantSeeds) });
    for (const cls of classSpecs(cfg)) plan.push({ lineup: `grind:${cls}`, seeds: seedsOf(variantSeeds) });
    for (const seat of seatSpecs(cfg)) plan.push({ lineup: `dead:${seat}`, seeds: seedsOf(deadSeeds) });
  }
  const runs = [];
  const kept = [];
  for (const [n, step] of plan.entries()) {
    const lineup = buildLineup(step.lineup, cfg);
    const seasons = [];
    for (const [i, seed] of step.seeds.entries()) {
      const game = playBotSeason({ seed, cfg, lineup: structuredClone(lineup) });
      const stat = seasonStats(game);
      seasons.push(stat);
      // only the main lineup's first seasons get their own files: a feed is about 0.6 MB
      if (n === 0 && i < o.keep) kept.push({ seed, game, stat });
    }
    runs.push({ lineup: step.lineup, seeds: step.seeds, seasons });
    if (plan.length > 1) say(`  played ${step.lineup}: ${seasons.length} seasons`);
  }
  const title = `hotkey 2: bot run ${runName}`;
  const note = `Seeds ${o.start} to ${o.start + o.seeds - 1} of lineup \`${o.lineup}\`${o.allMarks ? `, then \`cautious\` on the same seeds, every \`turtle:<class>\` and \`grind:<class>\` (${variantSeeds} seeds each) and every \`dead:<seat>\` (${deadSeeds} seeds each)` : ''}. Config ${configHash(cfg)}.`;
  fs.writeFileSync(path.join(outDir, 'report.md'), botReport(cfg, runs, { title, note }));

  const summary = runs.map(run => {
    const variant = run.lineup.split(':')[0];
    if (variant === 'turtle' || variant === 'grind') return { lineup: run.lineup, seasons: run.seasons.length, variant: variantMark(run.seasons, variant) };
    const skipSeat = variant === 'dead' ? run.seasons[0]?.agents.find(a => a.variant === 'dead')?.seat ?? null : null;
    const table = marksTable(cfg, run.seasons, { skipSeat });
    return { lineup: run.lineup, seasons: run.seasons.length, marks: table.marks, extra: table.extra };
  });
  writeJson(path.join(outDir, 'report.json'), { title, start: o.start, config: configHash(cfg), runs: summary });
  runJson.kept = kept.map(k => k.seed);
  return { runs, summary, kept, cfg };
}

function printBotMarks(say, summary) {
  for (const run of summary) {
    if (run.variant) {
      const v = run.variant;
      say(`  [${v.bottomHalfPct >= 70 ? 'pass' : 'FAIL'}] ${run.lineup}: bottom half in ${v.bottomHalfPct}% of ${v.seeds} seeds (wanted 70% or more)`);
      continue;
    }
    say(`  lineup ${run.lineup}, ${run.seasons} seasons:`);
    for (const m of run.marks) say(`    [${m.pass === null ? 'n/a' : m.pass ? 'pass' : 'FAIL'}] ${m.n}. ${m.name}: ${m.value} (wanted: ${m.want})`);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Seasons played hour by hour: AI seats, and any run that stops for an owner

// What one season cost and how its calls went: turns and journals asked for, and how many failed or were never asked.
const blankCount = () => ({ calls: 0, cost: 0, in: 0, out: 0, turns: 0, journals: 0, failedTurns: 0, failedJournals: 0, skipped: 0 });

/** Where a season stands on disk, so it can carry on: the state, the nights, and the feed beside it. */
function saveSeason(dir, game) {
  writeFeed(dir, game);
  writeJson(path.join(dir, 'save.json'), { version: SAVE_VERSION, seed: game.state.seed, cfg: game.cfg, map: game.map, state: game.state, nights: game.nights, feedLines: game.feed.length });
}

function loadSeason(dir) {
  const save = readJson(path.join(dir, 'save.json'));
  if (save.version !== SAVE_VERSION) throw new Error(`${dir}/save.json is version ${save.version}, and this code reads version ${SAVE_VERSION}`);
  const feed = fs.readFileSync(path.join(dir, 'feed.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  if (feed.length !== save.feedLines) throw new Error(`${dir}/feed.jsonl has ${feed.length} lines and the save expects ${save.feedLines}: it was changed after the pause`);
  // the default config and map are used as themselves when nothing in them has changed, so the rulebook cache holds
  const cfg = JSON.stringify(save.cfg) === JSON.stringify(CONFIG) ? CONFIG : save.cfg;
  const map = JSON.stringify(save.map) === JSON.stringify(CITY) ? CITY : save.map;
  return { cfg, map, state: save.state, feed, nights: save.nights };
}

/** The owners' sheets for a pause, written for a person to fill in. */
function writeSheets(dir, game) {
  const folder = path.join(dir, 'levelup');
  fs.mkdirSync(folder, { recursive: true });
  const files = [];
  for (const id of game.state.order) {
    const agent = game.state.agents[id];
    if (!agent.owner) continue;
    const file = path.join(folder, `${id}.json`);
    writeJson(file, levelUpSheet(game, agent));
    files.push(file);
  }
  return files;
}

function readSheets(dir, game) {
  const sheets = {};
  for (const id of game.state.order) {
    if (!game.state.agents[id].owner) continue;
    const file = path.join(dir, 'levelup', `${id}.json`);
    if (!fs.existsSync(file)) throw new Error(`the level-up sheet ${file} is missing`);
    try {
      sheets[id] = readJson(file);
    } catch (e) {
      throw new Error(`the level-up sheet ${file} is not JSON any more: ${e.message}`);
    }
  }
  return sheets;
}

async function steppedRun(o, seatModels, { say, outDir, runName, runJson, seatOptions, resumed }) {
  const cfg0 = CONFIG;
  const seeds = runJson.seeds;
  const progress = (runJson.progress ??= {}); // per seed: { status, ...counts }
  const lineupName = o.lineup;
  let current = null; // the season being played: { seed, dir, game, count, brain, sheets }
  let aiSeats = null;
  let brainFor = () => null;

  if (o.ai) {
    const lineup = lineupFor(o, seatModels, cfg0);
    const ids = lineup.map((s, i) => ({ s, id: `a${i + 1}` })).filter(x => x.s.kind === 'ai');
    const { createAiSeats } = await import('./seats/ai.mjs');
    const { botBrain } = await import('./seats/fake-brain.mjs');
    // a fake season is played by the scripted bots, speaking through the reply format
    brainFor = game => botBrain(game);
    const allLocal = ids.every(x => x.s.api === 'local');
    const before = Object.values(progress).reduce((a, p) => ({ cost: a.cost + (p.cost ?? 0), calls: a.calls + (p.calls ?? 0) }), { cost: 0, calls: 0 });
    aiSeats = createAiSeats({
      seats: ids.map(x => ({ agentId: x.id, model: x.s.model, api: x.s.api, ...(x.s.effort ? { effort: x.s.effort } : {}) })),
      transport: o.fake ? 'fake' : 'live',
      // every AI seat of an hour in one wave: the hour waits for its slowest call anyway
      concurrency: allLocal ? SEAT_DEFAULTS.local.concurrency : ids.length,
      // a fake run takes --max-cost too (optional there): it caps the fake-priced spend, to rehearse a hard stop for $0
      ...(Number.isFinite(o.maxCost) && o.maxCost > 0 ? { maxCost: o.maxCost } : {}),
      ...(o.fake ? {} : { go: o.go }),
      spent: before,
      fakeBrain: req => current.brain(req),
      onTurn: record => {
        const c = current.count;
        c.calls += record.tries;
        c.cost += record.usage.cost;
        c.in += record.usage.in;
        c.out += record.usage.out;
        if (record.kind === 'journal') c.journals += 1;
        else c.turns += 1;
        if (!record.ok) {
          if (record.tries === 0 && (record.why === 'capped' || String(record.why).startsWith('halted'))) c.skipped += 1;
          else if (record.kind === 'journal') c.failedJournals += 1;
          else c.failedTurns += 1;
        }
        fs.appendFileSync(path.join(outDir, String(current.seed), 'ai-replies.jsonl'), JSON.stringify(record) + '\n');
      },
      ...seatOptions,
    });
    runJson.aiSeats = aiSeats.seats;
    if (!o.fake) {
      // OpenRouter's balance and key limit against --max-cost; the Claude API has none to read (its note says so).
      runJson.preflight = await aiSeats.preflight();
      if (runJson.preflight.claude) say(`claude: ${runJson.preflight.claude}`);
      if (runJson.preflight.refused) {
        runJson.finishedAt = new Date().toISOString();
        writeJson(path.join(outDir, 'run.json'), runJson);
        await aiSeats.close();
        throw new Error(`preflight refused: ${runJson.preflight.refused}`);
      }
    }
  }

  const startSeason = seed => {
    const dir = path.join(outDir, String(seed));
    fs.mkdirSync(dir, { recursive: true });
    if (resumed && progress[seed] && progress[seed].status !== 'done') {
      const game = loadSeason(dir);
      const count = { ...blankCount(), ...progress[seed] };
      delete count.status;
      // a season waiting on its owners carries on with the sheets they filled in
      const waiting = o.pauseNights && (game.state.phase === 'pre' || game.state.phase === 'night');
      return { seed, dir, game, count, brain: brainFor(game), sheets: waiting ? readSheets(dir, game) : null };
    }
    const game = createGame({ seed, cfg: cfg0, map: CITY, lineup: lineupFor(o, seatModels, cfg0), run: runName });
    if (o.ai) fs.writeFileSync(path.join(dir, 'ai-replies.jsonl'), '');
    return { seed, dir, game, count: blankCount(), brain: brainFor(game), sheets: null };
  };
  const keep = status => {
    progress[current.seed] = { status, ...current.count };
    writeJson(path.join(outDir, 'run.json'), runJson);
  };
  const aiInfo = () => (o.ai ? { transport: aiSeats.transport, failedTurns: current.count.failedTurns, failedJournals: current.count.failedJournals, skipped: current.count.skipped, spend: { cost: current.count.cost, calls: current.count.calls, in: current.count.in, out: current.count.out } } : null);

  // ---- the dry run: one hour of the first seed, then the cost so far and a season estimate
  if (o.dryRun) {
    current = startSeason(seeds[0]);
    await advance(current.game, { seats: aiSeats, untilHour: 1 });
    const { cfg } = current.game;
    const callsPerSeat = totalHours(cfg) + cfg.season.days; // a turn an hour, and a journal a night
    const detail = aiSeats.estimateDetail({ callsPerSeat });
    const estimate = detail.total === null ? null : detail.total * SEAT_DEFAULTS.promptGrowth;
    const suggested = estimate === null ? null : Math.ceil(estimate * (1 + SEAT_DEFAULTS.headroom) * 4) / 4;
    runJson.dryRun = {
      hours: 1, callsPerSeat, spend: { ...aiSeats.spend }, perModel: aiSeats.perModel, halted: aiSeats.halted,
      estimate: detail, promptGrowth: SEAT_DEFAULTS.promptGrowth, estimateSeason: estimate, suggestedMaxCost: suggested, turns: aiSeats.turns,
    };
    runJson.finishedAt = new Date().toISOString();
    writeJson(path.join(outDir, 'run.json'), runJson);
    say(`dry run (${o.fake ? "fake: nothing billed, Claude seats priced from the fake's token counts" : 'live'}, 1 hour, seed ${seeds[0]}): ${aiSeats.spend.calls} calls, ${dollars(aiSeats.spend.cost)}`);
    for (const tr of aiSeats.turns) {
      const u = tr.usage;
      say(`  ${tr.agentId} ${seatLabel(tr)}: ${tr.ok ? 'ok' : `failed (${tr.why})`} | parsed ${tr.parsed ? 'yes' : 'no'} | finish ${tr.finish ?? 'n/a'} | in ${u.in} out ${u.out} reasoning ${u.reasoning ?? 'n/a'} | ${dollars(u.cost)} | ${secs(tr.ms)}${tr.tries > 1 ? ` | ${tr.tries} tries` : ''}${tr.fallback ? ` | cut off at ${tr.fallback.from}, asked again at ${tr.fallback.to}: ${tr.fallback.ok ? 'ok' : 'failed'}` : ''}`);
    }
    say('per model:');
    for (const [m, v] of Object.entries(aiSeats.perModel)) {
      const e = detail.perModel[m];
      say(`  ${m} (${v.api}${v.efforts.length ? `, ${v.efforts.join('/')}` : ''}; ${v.seats} seat${v.seats === 1 ? '' : 's'}): ${v.calls} calls | in ${v.in} out ${v.out} | ${dollars(v.cost)} | failed ${v.failed} | cut-offs ${v.cutoffs} | season ${dollars(e?.season)} (${e?.seats ?? 0} × ${detail.callsPerSeat} calls × ${dollars(e?.perCall)}${e && !e.measured ? ": no costed call yet, the other models' mean" : ''})`);
    }
    say(`season estimate: ${dollars(estimate)} (${callsPerSeat} calls per seat at each model's cost per call this hour, times ${SEAT_DEFAULTS.promptGrowth} because prompts grow as the season fills up)`);
    say(`suggested --max-cost: ${suggested === null ? 'n/a' : `$${suggested.toFixed(2)}`} (about ${Math.round(SEAT_DEFAULTS.headroom * 100)}% above the estimate; slime sets the real number with his go)`);
    say(`halted: ${aiSeats.halted ? `${aiSeats.halted.kind}: ${aiSeats.halted.why}` : 'no'}`);
    await aiSeats.close();
    return { outDir, runJson, dryRun: runJson.dryRun };
  }

  // ---- whole seasons
  const finished = [];
  let stopped = null; // { kind: 'paused' | 'cut', ... }
  for (const seed of seeds) {
    if (progress[seed]?.status === 'done') continue;
    current = startSeason(seed);
    const { game, dir } = current;
    let sheets = current.sheets;
    let result = null;
    while (result !== 'over') {
      result = await advance(game, { seats: aiSeats, pauseNights: o.pauseNights, sheets, untilHour: game.state.t + 1 });
      sheets = null;
      if (aiSeats?.halted && result !== 'over') {
        // the hard stop: nothing more is called, so the run ends here, with everything played so far on disk
        const h = aiSeats.halted;
        stopped = { kind: 'cut', seed, t: game.state.t, after: game.state.t > 0 ? clockOf(game.cfg, game.state.t - 1) : 'the start', halt: h.kind, why: h.why };
        break;
      }
      if (result === 'paused' && (game.state.phase === 'pre' || game.state.phase === 'night')) {
        stopped = { kind: 'paused', seed, night: game.state.phase === 'pre' ? 0 : dayOf(game.cfg, game.state.t - 1) };
        break;
      }
    }
    if (stopped) {
      saveSeason(dir, game);
      // sheets whenever the season is waiting on its owners, which a cut at a night is too
      stopped.sheets = o.pauseNights && (game.state.phase === 'pre' || game.state.phase === 'night') ? writeSheets(dir, game) : [];
      const page = await writeSeason(dir, game, { run: runName, lineup: lineupName, seatModels, ai: aiInfo(), cut: stopped.kind === 'cut' ? stopped : null });
      runJson.episode = page;
      runJson.stopped = { ...stopped, sheets: stopped.sheets.map(f => path.relative(outDir, f)) };
      keep(stopped.kind);
      break;
    }
    const stat = seasonStats(game);
    const info = aiInfo();
    const report = o.ai
      ? aiReport(game.cfg, game, stat, { failedTurns: info.failedTurns + info.failedJournals, spend: info.spend, title: `hotkey 2: AI season, seed ${seed} (${runName})` })
      : botReport(game.cfg, [{ lineup: lineupName, seeds: [seed], seasons: [stat] }], { title: `hotkey 2: season, seed ${seed} (${runName})` });
    runJson.episode = await writeSeason(dir, game, { run: runName, lineup: lineupName, seatModels, stats: stat, report, ai: info });
    for (const f of ['save.json']) if (fs.existsSync(path.join(dir, f))) fs.unlinkSync(path.join(dir, f));
    runJson.stopped = null;
    keep('done');
    finished.push({ seed, game, stat, report, info });
  }

  // ---- the run's report
  const total = Object.values(progress).reduce((a, p) => {
    for (const k of Object.keys(a)) a[k] += p[k] ?? 0;
    return a;
  }, blankCount());
  const lines = [`# hotkey 2: ${o.ai ? 'AI run' : 'run'} ${runName}`, ''];
  lines.push(`Lineup \`${lineupName}\`, seeds ${seeds.join(', ')}. Config ${configHash(cfg0)}.${o.owners.length ? ` Owners: ${o.owners.join(', ')}.` : ''}`, '');
  if (o.ai) {
    lines.push(`Transport: **${aiSeats.transport}**${o.fake ? ' (nothing was billed: the fake prices Claude seats from its own token counts, to show the shape of a bill)' : ''}.${aiSeats.maxCost ? ` Hard stop: $${aiSeats.maxCost}.` : ''}`, '');
    lines.push(`**Failed turns: ${total.failedTurns}** of ${total.turns}. Failed journals: ${total.failedJournals} of ${total.journals}.${total.skipped ? ` ${total.skipped} of those were never asked, because the run had stopped calling.` : ''} A failed turn plays a rest.`, '');
    lines.push(`**Spend: ${dollars(total.cost)}** over ${total.calls} calls (${total.in} tokens in, ${total.out} out).`, '');
    lines.push('| Seat | Class | Model | API |', '|---|---|---|---|');
    for (const s of lineupFor(o, seatModels, cfg0).map((x, i) => ({ ...x, id: `a${i + 1}` })).filter(x => x.kind === 'ai')) lines.push(`| ${s.id} | ${s.cls} | ${s.model} | ${s.api}${s.effort ? `, ${s.effort}` : ''} |`);
    lines.push('', resumed ? 'Per model, since the run was last resumed:' : 'Per model:', '', '| Model | Seats | Calls | Failed | Never asked | Cut off | Tokens in | Tokens out | Cost |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const [m, v] of Object.entries(aiSeats.perModel)) lines.push(`| ${m} | ${v.seats} | ${v.calls} | ${v.failed} | ${v.skipped} | ${v.cutoffs} | ${v.in} | ${v.out} | ${dollars(v.cost)} |`);
    lines.push('');
  }
  if (stopped?.kind === 'cut') lines.push(`**The run was cut after ${stopped.after}, seed ${stopped.seed}** (${stopped.halt}: ${stopped.why}). Everything played up to there is in \`${stopped.seed}/\`. To carry on: \`node run.mjs --resume ${runName} --max-cost <more> --go "<words>"\`.`, '');
  if (stopped?.kind === 'paused') lines.push(`**Paused ${stopped.night === 0 ? 'before hour 0' : `after night ${stopped.night}`}, seed ${stopped.seed}.** Fill in the sheets in \`${stopped.seed}/levelup/\`, then \`node run.mjs --resume ${runName}\`.`, '');
  const done = seeds.filter(s => progress[s]?.status === 'done');
  for (const seed of done) {
    const f = finished.find(x => x.seed === seed);
    const text = f ? f.report : fs.readFileSync(path.join(outDir, String(seed), 'report.md'), 'utf8');
    lines.push(text.replace(/^# /, '## ').replace(/\n## /g, '\n### '), '');
  }
  fs.writeFileSync(path.join(outDir, 'report.md'), lines.join('\n'));
  writeJson(path.join(outDir, 'report.json'), {
    run: runName, lineup: lineupName, seeds, done, stopped: runJson.stopped ?? null, total,
    ...(o.ai ? { transport: aiSeats.transport, maxCost: aiSeats.maxCost, perModel: aiSeats.perModel, halted: aiSeats.halted } : {}),
    seasons: done.map(seed => readJson(path.join(outDir, String(seed), 'season.json')).stats),
  });

  if (o.ai) {
    runJson.ai = {
      seatModels, maxCost: aiSeats.maxCost, go: aiSeats.go, total, perModel: aiSeats.perModel, capped: aiSeats.capped, halted: aiSeats.halted,
      ...(o.fake || !aiSeats.paid ? {} : { openRouterKeyUsage: await aiSeats.keyUsage() }),
    };
    await aiSeats.close();
  }
  return { finished, stopped, total, done };
}

// ---------------------------------------------------------------------------------------------------------------

/**
 * Run the command line. `seatOptions` reaches createAiSeats (tests inject a fetch, key files and scripts there);
 * `variantSeeds` and `deadSeeds` shorten --all-marks for tests.
 */
export async function main(argv, { log = console.log, seatOptions = {}, variantSeeds = VARIANT_SEEDS, deadSeeds = DEAD_SEEDS } = {}) {
  let o = parseArgs(argv);
  let outDir, runJson, resumed = false;
  const started = Date.now();

  if (o.resume) {
    const given = o;
    outDir = [path.resolve(given.resume), path.resolve(ROOT, 'out', given.resume)].find(d => fs.existsSync(path.join(d, 'run.json')));
    if (!outDir) throw new Error(`no run to resume at ${given.resume}: there is no run.json there, or under out/`);
    runJson = readJson(path.join(outDir, 'run.json'));
    if (!runJson.stopped) throw new Error(`run ${path.basename(outDir)} is not paused: there is nothing to resume`);
    o = { ...runJson.options, quiet: given.quiet };
    if (runJson.stopped.kind === 'cut') {
      // the hard stop cut this run: carrying on spends more, so it needs a new cap and the go words again
      const spent = Object.values(runJson.progress ?? {}).reduce((a, p) => a + (p.cost ?? 0), 0);
      if (!(Number.isFinite(given.maxCost) && given.maxCost > spent)) throw new Error(`this run was cut by its hard stop after $${spent.toFixed(4)}: resuming needs a new --max-cost above that`);
      if (!o.fake && (!given.go || !String(given.go).trim())) throw new Error('this run was cut by its hard stop: resuming needs --go "<slime\'s words>" again');
    }
    if (given.maxCost !== null) o.maxCost = given.maxCost;
    if (given.go !== null) o.go = given.go;
    resumed = true;
  }

  const say = o.quiet ? () => {} : log;
  const seatModels = seatModelsFor(o);
  refuseUnlessCleared(o, seatModels ?? []);
  const mode = o.ai ? `ai${o.fake ? '-fake' : ''}${o.dryRun ? '-dry-run' : ''}` : 'bots';

  if (!resumed) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    outDir = path.resolve(ROOT, o.out ?? path.join('out', `${stamp}-${mode}-${o.lineup.replace(/[^a-z0-9]+/gi, '-')}`));
    fs.mkdirSync(outDir, { recursive: true });
    runJson = {
      command: `node run.mjs ${argv.map(a => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`,
      mode, lineup: o.lineup, seeds: Array.from({ length: o.seeds }, (_, i) => o.start + i),
      configHash: configHash(CONFIG), gitCommit: gitCommit(), startedAt: new Date(started).toISOString(),
      options: { ...o, keep: o.keep === Infinity ? 'all' : o.keep },
      ...(o.ai ? { seatModels, transport: o.fake ? 'fake' : 'live', maxCost: o.maxCost, go: o.fake ? null : o.go } : {}),
    };
  } else {
    if (o.keep === 'all') o.keep = Infinity;
    (runJson.resumes ??= []).push({ at: new Date(started).toISOString(), from: runJson.stopped, ...(o.ai ? { maxCost: o.maxCost } : {}) });
    if (o.ai) Object.assign(runJson, { maxCost: o.maxCost, go: o.fake ? null : o.go });
  }
  const runName = path.basename(outDir);
  const ctx = { say, outDir, runName, runJson, seatOptions, resumed, variantSeeds, deadSeeds };
  // a path a person can paste: short when the run is under the folder they are in
  const shown = file => (path.relative(process.cwd(), file).startsWith('..') ? file : path.relative(process.cwd(), file) || file);
  const where = shown(outDir);

  // ---- plain bot seasons: the fast path
  if (o.bots && !o.owners.length) {
    const { summary, kept, cfg } = botRun(o, ctx);
    for (const k of kept) {
      const report = botReport(cfg, [{ lineup: o.lineup, seeds: [k.seed], seasons: [k.stat] }], { title: `hotkey 2: season, seed ${k.seed} (${runName})` });
      runJson.episode = await writeSeason(path.join(outDir, String(k.seed)), k.game, { run: runName, lineup: o.lineup, stats: k.stat, report });
    }
    runJson.finishedAt = new Date().toISOString();
    runJson.ms = Date.now() - started;
    writeJson(path.join(outDir, 'run.json'), runJson);
    say(`${summary.reduce((a, r) => a + r.seasons, 0)} seasons (bots, lineup ${o.lineup}${o.allMarks ? ' and every lineup the marks need' : ''}) in ${runJson.ms} ms -> ${where}`);
    printBotMarks(say, summary);
    return { outDir, runJson, summary };
  }

  // ---- hour by hour: AI seats, owners, pauses
  const out = await steppedRun(o, seatModels, ctx);
  if (o.dryRun) return out;
  runJson.finishedAt = new Date().toISOString();
  runJson.ms = (runJson.ms ?? 0) + (Date.now() - started);
  writeJson(path.join(outDir, 'run.json'), runJson);
  const { stopped, total, finished } = out;
  say(`${out.done.length} of ${runJson.seeds.length} season${runJson.seeds.length === 1 ? '' : 's'} done (${mode}, lineup ${o.lineup}) -> ${where}`);
  if (o.ai) say(`  failed turns: ${total.failedTurns}${total.failedJournals ? ` (and ${total.failedJournals} journals)` : ''}${total.skipped ? `; never asked: ${total.skipped}` : ''} | spend: ${dollars(total.cost)} over ${total.calls} calls (${total.in} tokens in, ${total.out} out)${o.fake ? ' | fake: nothing billed' : ''}`);
  for (const f of finished) {
    const winner = f.game.state.agents[f.game.state.final[0].id];
    say(`  seed ${f.seed}: ${winner.name} the ${winner.cls} won with $${f.game.state.final[0].worth}`);
  }
  if (stopped?.kind === 'cut') say(`  CUT after ${stopped.after}, seed ${stopped.seed}: ${stopped.why}. To carry on: node run.mjs --resume ${runName} --max-cost <more> --go "<words>"`);
  if (stopped?.kind === 'paused') {
    say(`  paused ${stopped.night === 0 ? 'before hour 0' : `after night ${stopped.night}`}, seed ${stopped.seed}. Fill in:`);
    for (const f of stopped.sheets) say(`    ${shown(f)}`);
    say(`  then: node run.mjs --resume ${runName}`);
  }
  return { outDir, runJson, ...out };
}
