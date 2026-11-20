// EVERY SAMPLED FIGURE THE VIEW SHOWS, FOR EVERY SCRIPTED PLAYER (smooth-1). The fight odds moved to the background on
// the page (src/run/odds.mjs, demo/run/odds.js); the bar is that not one figure changes. This plays every policy of
// src/run/policies.mjs (buying the three things as it can: more arms, more figures) and the slice's player with its
// kit, a six-day season on each seed, and records at every choice point:
//   - every figure that comes from a sample of fights: getting jumped's bands and the hour's (this hour, one more), the
//     same jump with each arm (byArm), each card's fight ("you win about 6 in 10", pct, byArm), a way's danger leg by
//     leg (its bad one and scuffle and its words), the door fight's odds (byArm, byWay, the door bar, Earl, Earl down),
//     each Earl way's win: `fig`, the step's figures as JSON, kept once in `dict` and named by number per step
//   - a hash of the WHOLE view (`view`), so nothing else on it moved either
//   - after a fight lost, the advice (rules.mjs fightAdvice): `advice`
//   - the Ahead screen's fight table (ahead.mjs aheadCells / aheadCell) for each rested energy the run met: `ahead`
// It was run ONCE on the base commit 697d3a1 (before the odds moved) to make test/fixtures/odds-figures.json; the
// tests play the same with the code of now, in Node at once and through the background path, and compare.
//
//   node scripts/odds-figures.mjs [--root <a checkout>] [--out <file>] [--seeds 1,2] [--days 6] [--only dealer,docks]
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SEEDS = [1, 2, 3];
export const DAYS = 6;

/** The modules of a checkout (the base commit's, or this one's). */
export async function modulesOf(root) {
  const u = p => pathToFileURL(resolve(root, p)).href;
  const run = await import(u('src/run/index.mjs'));
  const rules = await import(u('src/run/rules.mjs'));
  const pol = await import(u('src/run/policies.mjs'));
  const ahead = await import(u('src/run/ahead.mjs'));
  const marks = await import(u('src/run/marks.mjs'));
  // (bench-1: the rules with the bench in, where a checkout has them: the page's config has none of it until its screens
  // exist, and the bench's odds are sampled like a jump's, so they are recorded too; `ODDS_CFG=page` records the page's)
  const cfg = process.env.ODDS_CFG !== 'page' && run.BENCH_CONFIG ? run.BENCH_CONFIG : run.RUN_CONFIG;
  return { cfg, newRun: run.newRun, view: run.view, step: run.step, rules, POLICIES: pol.POLICIES, decide: pol.decide, ahead, SLICE_KITS: marks.SLICE_KITS };
}

/** The players: every policy (a policy that takes where to head home takes $120, as the page's auto-play does), buying; and the slice's. */
export function playersOf(M) {
  const out = Object.keys(M.POLICIES).map(name => {
    const P0 = M.POLICIES[name];
    return { name, policy: { ...(typeof P0 === 'function' ? P0(120) : P0), buy: true }, kit: {} };
  });
  if (M.POLICIES.layLow && M.SLICE_KITS?.slice) out.push({ name: 'layLow+slice', policy: { ...M.POLICIES.layLow(120), buy: true }, kit: { bed: true, ...M.SLICE_KITS.slice } });
  // (bench-1: the bottle player with its workbench, dog spray and paint in one bottle: the throw's odds, the blue man's card)
  if (M.POLICIES.bottler && M.cfg.things?.workbench) out.push({ name: 'bottler+bench', policy: { ...M.POLICIES.bottler(120, ['painttin', 'spraycan']), buy: true }, kit: { workbench: true } });
  return out;
}

const FIG_KEYS = ['pct', 'in10', 'n', 'byArm', 'byWay', 'withBar', 'withEarl', 'earlDown', 'bands', 'bad', 'scuffle', 'seeOff', 'won', 'clean', 'messy', 'fail', 'text', 'swingPct'];
const pick = o => Object.fromEntries(FIG_KEYS.filter(k => k in o).map(k => [k, o[k]]));
/** Every sampled figure of a view, by where it is: [[path, figures]]. */
export function figuresOf(v) {
  const out = [];
  const walk = (o, path) => {
    if (Array.isArray(o)) return void o.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (!o || typeof o !== 'object') return;
    // (a fight as a card says it, a jump's fight, the door fight's odds; a jump's bands)
    if ('byArm' in o || 'bands' in o || 'seeOff' in o || 'earlDown' in o || 'byWay' in o) out.push([path, pick(o)]);
    // (a way's danger, leg by leg and whole, and its words)
    if (/\.danger$|\.legs\[\d+\]$/.test(path) && o.jump && 'bad' in o.jump) out.push([path, { bad: o.jump.bad, scuffle: o.jump.scuffle, ...(o.text ? { text: o.text } : {}) }]);
    // (each way Earl is told to fight: what it wins at the door)
    if ('win' in o && /earl/i.test(path)) out.push([`${path}.win`, o.win]);
    for (const [k, x] of Object.entries(o)) walk(x, `${path}.${k}`);
  };
  walk(v, 'v');
  return out;
}
export const hash = text => createHash('sha256').update(text).digest('hex').slice(0, 16);

/**
 * One season of one player, every choice point: { view, fig, advice, ahead } (see the head). `viewOf(state)` and
 * `decideOf(state, v, policy)`, `stepOf(state, choice)`, `adviceOf(before, duel)` and `cellOf(state, arm, style)` let a test play
 * the same through another path (the background one); by default they are the plain calls.
 */
export async function season(M, player, seed, days = DAYS, how = {}) {
  const { cfg, rules, ahead } = M;
  const viewOf = how.viewOf ?? (st => M.view(cfg, st));
  const decideOf = how.decideOf ? (st, v) => how.decideOf(st, v, player.policy) : (st, v) => M.decide(cfg, st, player.policy, v);
  const stepOf = how.stepOf ?? ((st, c) => M.step(cfg, st, c));
  const adviceOf = how.adviceOf ?? ((before, duel) => rules.fightAdvice(cfg, before, duel));
  const cellOf = how.cellOf ?? ((st, arm, style) => ahead.aheadCell(cfg, st, arm, style));
  let state = M.newRun({ seed, cfg });
  for (const [k, on] of Object.entries(player.kit)) if (cfg.things?.[k]) state.things = { ...state.things, [k]: on };
  state.owned = { ...state.owned, ...Object.fromEntries(Object.entries(player.kit).filter(([k]) => !cfg.things?.[k])) };
  state.energy = rules.fullEnergy(cfg, state);
  const steps = [];
  const advice = [];
  const tables = {};
  let n = 0;
  while (state.day <= days && n++ < 700) {
    const v = await viewOf(state);
    const fig = JSON.stringify(figuresOf(v));
    steps.push({ view: hash(JSON.stringify(v)), fig });
    // (the Ahead screen's table, once for each rested energy the run meets)
    const cells = ahead.aheadCells(cfg, state);
    const tk = cells[0]?.key.split('|')[0];
    if (cells.length && !(tk in tables)) {
      tables[tk] = {};
      for (const c of cells) tables[tk][c.key] = await cellOf(state, c.arm, c.style);
    }
    const choice = await decideOf(state, v);
    const { state: next, events } = await stepOf(state, choice);
    for (const e of events) if (e.duel && e.duel.result !== 'won') advice.push({ at: steps.length - 1, advice: await adviceOf(state, e.duel) });
    state = next;
  }
  return { steps, advice, ahead: tables };
}

/** Every player on every seed: the fixture's body. */
export async function capture(M, { seeds = SEEDS, days = DAYS, only = null, how = {}, log = null } = {}) {
  const dict = [];
  const idOf = new Map();
  const runs = {};
  for (const p of playersOf(M)) {
    if (only && !only.includes(p.name)) continue;
    for (const seed of seeds) {
      const t0 = Date.now();
      const r = await season(M, p, seed, days, how);
      runs[`${p.name}@${seed}`] = {
        view: r.steps.map(s => s.view),
        fig: r.steps.map(s => {
          if (!idOf.has(s.fig)) {
            idOf.set(s.fig, dict.length);
            dict.push(s.fig);
          }
          return idOf.get(s.fig);
        }),
        advice: r.advice, ahead: r.ahead,
      };
      log?.(`${p.name}@${seed}: ${r.steps.length} steps, ${r.advice.length} advice, ${Date.now() - t0} ms`);
    }
  }
  return { seeds, days, dict, runs };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
  const root = resolve(arg('--root', new URL('..', import.meta.url).pathname));
  const out = arg('--out', null);
  const seeds = arg('--seeds', null)?.split(',').map(Number) ?? SEEDS;
  const days = Number(arg('--days', DAYS));
  const only = arg('--only', null)?.split(',') ?? null;
  const M = await modulesOf(root);
  const t0 = Date.now();
  const body = await capture(M, { seeds, days, only, log: s => console.error(s) });
  const json = JSON.stringify({ made: { root, seeds, days, at: new Date().toISOString(), ms: Date.now() - t0 }, ...body });
  if (out) writeFileSync(out, `${json}\n`);
  else process.stdout.write(`${json}\n`);
  console.error(`${Object.keys(body.runs).length} runs, ${body.dict.length} distinct figure sets, ${json.length} bytes, ${Date.now() - t0} ms`);
}
