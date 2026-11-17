#!/usr/bin/env node
// THE BALANCE TABLE: every preset against every level of the stop, N seeds, both movement policies (policies.mjs),
// headless. Printed, and saved with --out.
//
//   node src/fight/table.mjs [--seeds 200] [--out <dir>]
//
// The aim (the owner's, for the test round): the Starter loses the real stop most of the time (wins 10 to 25%), the
// Handgun wins 55 to 70%, Handgun + vest 75 to 85%, the full build 90% or more; and backing away while firing beats
// standing still by a clear margin.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { PRESETS, LEVELS } from './data.mjs';
import { runFight, outcome } from './sim.mjs';
import { POLICIES } from './policies.mjs';

/** One cell: wins, how it ended, the seconds and the health left, over `seeds` seeds. */
export function cell(build, level, policy, seeds) {
  const n = { won: 0, lost: 0, left: 0, timeout: 0 };
  let secs = 0;
  let hp = 0;
  let dropped = 0;
  for (let s = 1; s <= seeds; s++) {
    const F = runFight({ build, level, seed: s, policy: POLICIES[policy] });
    const O = outcome(F);
    n[O.result] += 1;
    secs += O.seconds;
    dropped += O.dropped / O.of;
    if (O.result === 'won') hp += O.hp / O.max;
  }
  return { win: n.won / seeds, ...n, secs: secs / seeds, hpLeft: n.won ? hp / n.won : 0, dropped: dropped / seeds };
}

export function table(seeds = 200) {
  const rows = [];
  for (const [pid, P] of Object.entries(PRESETS)) {
    for (const level of Object.keys(LEVELS)) {
      const row = { preset: pid, name: P.name, level };
      for (const pol of Object.keys(POLICIES)) row[pol] = cell(P, level, pol, seeds);
      rows.push(row);
    }
  }
  return rows;
}

const pct = v => `${Math.round(v * 100)}%`.padStart(4);
export function print(rows, seeds) {
  const lines = [`THE FIGHT, balance table: ${seeds} seeds a cell. win% (still / kite), and for kite: mean seconds, health left when won, share dropped`, ''];
  lines.push(`${'preset'.padEnd(24)}${'level'.padEnd(7)}  still  kite   secs  hp-left  dropped`);
  for (const r of rows) {
    lines.push(`${r.name.padEnd(24)}${r.level.padEnd(7)}  ${pct(r.still.win)}  ${pct(r.kite.win)}   ${r.kite.secs.toFixed(1).padStart(4)}   ${pct(r.kite.hpLeft)}     ${pct(r.kite.dropped)}`);
  }
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (name, d) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : d);
  const seeds = Number(arg('--seeds', 200));
  const t0 = Date.now();
  const rows = table(seeds);
  const text = print(rows, seeds);
  console.log(text);
  console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  const out = arg('--out', null);
  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, 'fight-table.txt'), `${text}\n`);
    writeFileSync(path.join(out, 'fight-table.json'), `${JSON.stringify({ seeds, rows }, null, 1)}\n`);
    console.log(`saved ${path.join(out, 'fight-table.txt')} and .json`);
  }
}
