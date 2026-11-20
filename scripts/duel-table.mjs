#!/usr/bin/env node
// THE FIGHTS' BALANCE TABLE (duel-1, RUN.md "Fights"): every trailer park person who can fight you, and an ordinary
// one, against bare hands and the box cutter at every energy from 1 to the bed's full, N fights a cell, on the run's own
// numbers (src/run/config.mjs `duel`) and the fight's own simulation (src/fight/duel.mjs). Free, headless.
//
//   node scripts/duel-table.mjs [--fights 2000] [--out <dir>] [--with '<json of config overrides>']
//
// It prints the share you win in each cell, the fights' lengths, and the targets (RUN.md), each pass or fail:
//   bare hands, fresh on the mattress (energy 6), against an ordinary one: you win 40 to 55%; the box cutter 65 to 80%
//   energy 2 or less: at least 15 points under fresh, the same kit
//   the toughest of the park's against the weakest: at least 15 points apart (fresh, each kit)
//   no kit and energy in the park under 10% or over 90%
//   the median length 5 to 12 s of fight time; none over 20 s
// (those nine on the run's opponent as he was, the plain brawler: every row above plays as before)
// THE STYLES (styles-1, RUN.md "Fights in the run: styles and getting jumped"): then every way you can fight (bare
// hands, the box cutter, the three punch styles) against an ordinary one (55) of each of the five styles, fresh and
// tired, and every person of the run who can fight you with their style; and four targets more:
//   against each style, something you can own wins 15 points or more over bare hands, fresh
//   no one way is the best against all five
//   nothing you can own wins over 90% or under 10% fresh against any of them (bare hands said beside)
//   the box cutter, the dearest, wins the most on average over the five, fresh
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { RUN_CONFIG, withRunConfig } from '../src/run/config.mjs';
import { duelOf, toughnessOf, styleOf, armLabel } from '../src/run/rules.mjs';
import { runDuel } from '../src/fight/duel.mjs';
import { RIVALS } from '../src/fight/data.mjs';

const arg = (name, d) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : d);
const N = Number(arg('--fights', 2000));
// (--with '{"duel":{"hit":45}}': the table at other numbers, to tune them; the config is not changed)
const cfg = arg('--with', null) ? withRunConfig(JSON.parse(arg('--with'))) : RUN_CONFIG;
const FRESH = cfg.energy.mattress;

// who fights you in the park: the people of the jobs that fight, and the regular at your door
const park = cfg.places.park;
const roles = new Set(Object.values(park.jobs).filter(j => j.fight === 'fail').map(j => j.role));
if (cfg.duel.door) for (const p of park.people) if (p.regular) roles.add(p.role);
const folk = park.people.filter(p => roles.has(p.role));
const ordinary = { id: null, name: 'an ordinary one', role: null, ordinary: true };

/** One cell: the share won, the median and longest length, how many the cap decided. */
function cell(who, cutter, energy) {
  const state = { owned: { cutter } };
  const d = duelOf(cfg, state, plain(who), energy);
  if (who.ordinary) d.inputs.foe.hp = cfg.duel.foe.ordinary;
  let won = 0;
  let capped = 0;
  const t = [];
  for (let s = 1; s <= N; s++) {
    const F = runDuel(d.inputs, 7000003 * s + energy * 101 + (cutter ? 1 : 0));
    if (F.over.result === 'won') won += 1;
    if (F.capped) capped += 1;
    t.push(F.over.t);
  }
  t.sort((a, b) => a - b);
  return { pct: (won / N) * 100, median: t[Math.floor(N / 2)], max: t[N - 1], capped, hp: d.inputs.you.hp, them: d.inputs.foe.hp };
}

// (the plain brawler, as every person of the run was before styles-1: the nine targets are his)
const plain = who => ({ ...who, style: 'brawler' });
const t0 = Date.now();
const energies = Array.from({ length: cfg.duel.hp.of }, (_, k) => k + 1);
const rows = [];
for (const who of [ordinary, ...folk]) {
  for (const cutter of [false, true]) {
    const cells = Object.fromEntries(energies.map(e => [e, cell(who, cutter, e)]));
    rows.push({ who: who.name, id: who.id, tough: who.ordinary ? cfg.duel.foe.ordinary : toughnessOf(cfg, who), kit: cutter ? 'box cutter' : 'bare hands', cutter, cells });
  }
}
const at = (name, cutter, e) => rows.find(r => r.who === name && r.cutter === cutter).cells[e].pct;
const fmt = v => `${Math.round(v)}`.padStart(4);

const lines = [];
lines[0] = `THE FIGHTS, balance table: ${N} fights a cell, the share you win (%) by your energy before the hour (health: ${energies.map(e => rows[0].cells[e].hp).join(', ')})`;
lines.push('');
lines.push(`${'who'.padEnd(26)}${'tough'.padStart(5)}  ${'kit'.padEnd(11)}${energies.map(e => `${e}`.padStart(4)).join('')}`);
for (const r of rows) lines.push(`${r.who.padEnd(26)}${`${r.tough}`.padStart(5)}  ${r.kit.padEnd(11)}${energies.map(e => fmt(r.cells[e].pct)).join('')}`);
const all = rows.flatMap(r => Object.values(r.cells));
const lens = all.map(c => c.median).sort((a, b) => a - b);
lines.push('');
lines.push(`lengths: the cells' medians ${lens[0]} to ${lens[lens.length - 1]} s of fight time (the middle cell ${lens[Math.floor(lens.length / 2)]} s); the longest fight ${Math.max(...all.map(c => c.max))} s; decided at the cap: ${all.reduce((s, c) => s + c.capped, 0)} of ${all.length * N}`);

// THE TARGETS
const checks = [];
const p1 = v => v.toFixed(1);
const check = (text, pass) => checks.push(`${pass ? 'PASS' : 'FAIL'}  ${text}`);
const hF = at(ordinary.name, false, FRESH);
const cF = at(ordinary.name, true, FRESH);
check(`bare hands, fresh on the mattress (energy ${FRESH}), against an ordinary one: ${p1(hF)}% (40 to 55)`, hF >= 40 && hF <= 55);
check(`the box cutter, the same: ${p1(cF)}% (65 to 80)`, cF >= 65 && cF <= 80);
for (const cutter of [false, true]) {
  const tired = Math.max(...[1, 2].map(e => at(ordinary.name, cutter, e)));
  const fresh = at(ordinary.name, cutter, FRESH);
  check(`${cutter ? 'the box cutter' : 'bare hands'}, energy 2 or less against fresh: ${p1(tired)}% against ${p1(fresh)}% (15 points under at least)`, fresh - tired >= 15);
}
const tough = folk.reduce((a, b) => (toughnessOf(cfg, b) > toughnessOf(cfg, a) ? b : a));
const weak = folk.reduce((a, b) => (toughnessOf(cfg, b) < toughnessOf(cfg, a) ? b : a));
for (const cutter of [false, true]) {
  const [a, b] = [at(tough.name, cutter, FRESH), at(weak.name, cutter, FRESH)];
  check(`${cutter ? 'the box cutter' : 'bare hands'}, fresh: the toughest (${tough.name}, ${toughnessOf(cfg, tough)}) ${p1(a)}% against the weakest (${weak.name}, ${toughnessOf(cfg, weak)}) ${p1(b)}% (15 points apart at least)`, b - a >= 15);
}
const parkCells = rows.filter(r => r.id).flatMap(r => Object.values(r.cells));
const lo = Math.min(...parkCells.map(c => c.pct));
const hi = Math.max(...parkCells.map(c => c.pct));
check(`every kit and energy against the park's people: ${p1(lo)}% to ${p1(hi)}% (none under 10 nor over 90)`, lo >= 10 && hi <= 90);
check(`the median length ${lens[0]} to ${lens[lens.length - 1]} s (5 to 12 s)`, lens[0] >= 5 && lens[lens.length - 1] <= 12);
check(`the longest fight ${Math.max(...all.map(c => c.max))} s (20 at most)`, Math.max(...all.map(c => c.max)) <= 20);

// ── THE STYLES (styles-1) ──
const ARMS = ['hands', 'cutter', ...Object.keys(cfg.styles ?? {})];
const STYLES = Object.keys(RIVALS);
const ALL = { owned: { cutter: true }, styles: Object.fromEntries(Object.keys(cfg.styles ?? {}).map(k => [k, true])) };
/** The share won (and the median length) of `arm` against `who` at `energy`, N fights. */
function armCell(who, arm, energy, hp = null) {
  const d = duelOf(cfg, ALL, who, energy, 0, { arm });
  if (hp !== null) d.inputs.foe.hp = hp;
  let won = 0;
  const t = [];
  for (let s = 1; s <= N; s++) {
    const F = runDuel(d.inputs, 7000003 * s + energy * 101 + ARMS.indexOf(arm) * 7);
    if (F.over.result === 'won') won += 1;
    t.push(F.over.t);
  }
  t.sort((a, b) => a - b);
  return { pct: (won / N) * 100, median: t[Math.floor(N / 2)], max: t[N - 1] };
}
const TIRED = 2;
const grid = {};
lines.push('', `THE STYLES: what you fight with against an ordinary one (${cfg.duel.foe.ordinary}) of each style, the share you win (%), fresh on the mattress (energy ${FRESH}) / tired (energy ${TIRED})`, '');
lines.push(`${'you fight with'.padEnd(16)}${STYLES.map(st => RIVALS[st].name.replace(/^the /, '').padStart(14)).join('')}   mean`);
for (const arm of ARMS) {
  grid[arm] = {};
  const cells = STYLES.map(st => {
    const f = armCell({ id: null, name: st, role: null, style: st }, arm, FRESH, cfg.duel.foe.ordinary);
    const t = armCell({ id: null, name: st, role: null, style: st }, arm, TIRED, cfg.duel.foe.ordinary);
    grid[arm][st] = { fresh: f.pct, tired: t.pct, median: f.median };
    return `${Math.round(f.pct)} / ${Math.round(t.pct)}`.padStart(14);
  });
  const mean = STYLES.reduce((a, st) => a + grid[arm][st].fresh, 0) / STYLES.length;
  grid[arm].mean = mean;
  lines.push(`${armLabel(cfg, arm).padEnd(16)}${cells.join('')}   ${Math.round(mean)}`);
}
// every person of the run who can fight you (a job's, the door's, the visits'), with their own style and toughness
const fighters = Object.entries(cfg.places).flatMap(([pl, P]) => {
  const roles = new Set(Object.values(P.jobs ?? {}).filter(j => j.fight === 'fail').map(j => j.role));
  return (P.people ?? []).filter(p => roles.has(p.role) || (cfg.duel.door && p.regular)).map(p => ({ ...p, place: pl }));
});
lines.push('', 'The run\'s own who fight you, with their style, fresh (energy ' + FRESH + '): the share you win (%)', '');
lines.push(`${'who'.padEnd(26)}${'tough'.padStart(5)}  ${'style'.padEnd(15)}${ARMS.map(a => armLabel(cfg, a).replace(/^the /, '').padStart(12)).join('')}`);
const people = [];
for (const p of fighters) {
  const row = ARMS.map(a => armCell(p, a, FRESH).pct);
  people.push({ who: p.name, style: styleOf(cfg, p), tough: toughnessOf(cfg, p), row });
  lines.push(`${p.name.padEnd(26)}${`${toughnessOf(cfg, p)}`.padStart(5)}  ${RIVALS[styleOf(cfg, p)].name.replace(/^the /, '').padEnd(15)}${row.map(v => fmt(v).padStart(12)).join('')}`);
}
const own = ARMS.filter(a => a !== 'hands');
for (const st of STYLES) {
  const best = own.reduce((a, b) => (grid[b][st].fresh > grid[a][st].fresh ? b : a));
  check(`against ${RIVALS[st].name}: ${armLabel(cfg, best)} ${p1(grid[best][st].fresh)}% against bare hands ${p1(grid.hands[st].fresh)}% (15 points over at least)`, grid[best][st].fresh - grid.hands[st].fresh >= 15);
}
const bests = STYLES.map(st => ARMS.reduce((a, b) => (grid[b][st].fresh > grid[a][st].fresh ? b : a)));
check(`no one way is best against all five: the best are ${STYLES.map((st, i) => `${RIVALS[st].name.replace(/^the /, '')} ${armLabel(cfg, bests[i])}`).join(', ')}`, new Set(bests).size > 1);
const ownCells = own.flatMap(a => STYLES.map(st => ({ a, st, v: grid[a][st].fresh })));
const lo2 = ownCells.reduce((a, b) => (b.v < a.v ? b : a));
const hi2 = ownCells.reduce((a, b) => (b.v > a.v ? b : a));
const handsLo = Math.min(...STYLES.map(st => grid.hands[st].fresh));
check(`what you can own, fresh: ${p1(lo2.v)}% (${armLabel(cfg, lo2.a)} against ${RIVALS[lo2.st].name}) to ${p1(hi2.v)}% (${armLabel(cfg, hi2.a)} against ${RIVALS[hi2.st].name}) (none under 10 nor over 90; bare hands at worst ${p1(handsLo)}%)`, lo2.v >= 10 && hi2.v <= 90);
const meanBest = own.reduce((a, b) => (grid[b].mean > grid[a].mean ? b : a));
check(`the box cutter wins the most on average over the five, fresh: ${own.map(a => `${armLabel(cfg, a)} ${p1(grid[a].mean)}%`).join(', ')}`, meanBest === 'cutter');
lines.push('', ...checks, '', `${checks.filter(c => c.startsWith('PASS')).length} of ${checks.length} targets pass (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

const text = lines.join('\n');
console.log(text);
const out = arg('--out', null);
if (out) {
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'duel-table.txt'), `${text}\n`);
  writeFileSync(path.join(out, 'duel-table.json'), `${JSON.stringify({ fights: N, rows, styles: grid, people }, null, 1)}\n`);
  console.log(`saved ${path.join(out, 'duel-table.txt')} and .json`);
}
