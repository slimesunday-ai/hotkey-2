#!/usr/bin/env node
// THE BALANCE TABLE: every loadout against every level of the stop and every small street fight, N seeds, both movement
// policies (policies.mjs), headless; then COUSIN EARL'S WAYS, what you carry against how he is told to fight, backing
// away while firing. Printed, and saved with --out. (fight-3: the loadouts are the five presets and the two long guns;
// the levels the stop's three and STREET's jumped, the corner and a raid: run70's study, the table a designer reads.)
//
//   node src/fight/table.mjs [--seeds 200] [--out <dir>]
//
// The aim (the owner's, for the test round): the Starter loses the real stop most of the time (wins 10 to 25%), the
// Handgun wins 55 to 70%, Handgun + vest 75 to 85%, the full build 90% or more; and backing away while firing beats
// standing still by a clear margin. (fight-3) Each gun has its fight: the Doorman a rush (jumped, a raid), the Long-eye
// the corner and the bad night; Earl out in front for hands against men who walk up, hunting for shooters you cannot
// reach, one at a time for a gun against several.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { PRESETS, LEVELS, WEAPONS, EARL_WAYS } from './data.mjs';
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

/** The loadouts of the table: the five presets, then the two long guns alone (fight-3). */
export const LOADOUTS = Object.freeze({
  ...PRESETS,
  doorman: { name: 'Doorman', weapon: 'doorman', gear: [], ally: false },
  longeye: { name: 'Long-eye', weapon: 'longeye', gear: [], ally: false },
});
/** Its levels: the stop's three, then the small street fights (data.mjs STREET; the Sixes' yard is a first look, left out). */
export const TABLE_LEVELS = [...Object.keys(LEVELS), 'jumped', 'corner', 'raid'];
/** Earl's table: what you carry (rows) × how Earl fights, 'alone' without him (columns), at each level. */
export const EARL_ARMS = ['hands', 'blade', 'pistol', 'chopper', 'doorman', 'longeye'];
export const EARL_COLS = ['alone', ...Object.keys(EARL_WAYS)];

export function table(seeds = 200) {
  const rows = [];
  for (const [pid, P] of Object.entries(LOADOUTS)) {
    for (const level of TABLE_LEVELS) {
      const row = { preset: pid, name: P.name, level };
      for (const pol of Object.keys(POLICIES)) row[pol] = cell(P, level, pol, seeds);
      rows.push(row);
    }
  }
  return rows;
}

/** EARL'S WAYS: { [arm]: { [level]: { [way]: { win, earlDown } } } }, kite, `seeds` seeds a cell. */
export function earlTable(seeds = 200) {
  const out = {};
  for (const arm of EARL_ARMS) {
    out[arm] = {};
    for (const level of TABLE_LEVELS) {
      out[arm][level] = {};
      for (const way of EARL_COLS) {
        const build = { weapon: arm, gear: [], ally: way !== 'alone', ...(way !== 'alone' ? { earl: way } : {}) };
        let down = 0;
        let won = 0;
        for (let s = 1; s <= seeds; s++) {
          const F = runFight({ build, level, seed: s, policy: POLICIES.kite });
          if (F.over.result === 'won') won += 1;
          if (F.stats.allyDown) down += 1;
        }
        out[arm][level][way] = { win: won / seeds, earlDown: way === 'alone' ? null : down / seeds };
      }
    }
  }
  return out;
}

const pct = v => `${Math.round(v * 100)}%`.padStart(4);
export function print(rows, seeds, earl = null) {
  const lines = [`THE FIGHT, balance table: ${seeds} seeds a cell. win% (still / kite), and for kite: mean seconds, health left when won, share dropped`, ''];
  lines.push(`${'loadout'.padEnd(24)}${'level'.padEnd(8)}  still  kite   secs  hp-left  dropped`);
  for (const r of rows) {
    lines.push(`${r.name.padEnd(24)}${r.level.padEnd(8)}  ${pct(r.still.win)}  ${pct(r.kite.win)}   ${r.kite.secs.toFixed(1).padStart(4)}   ${pct(r.kite.hpLeft)}     ${pct(r.kite.dropped)}`);
  }
  if (earl) {
    const W = 6;
    lines.push('', `COUSIN EARL'S WAYS: win% backing away while firing (kite), ${seeds} seeds a cell; alone = without him. * the best of his four ways (within 2 points). Earl down %, his four ways, below.`, '');
    for (const part of [TABLE_LEVELS.slice(0, 3), TABLE_LEVELS.slice(3)]) {
      lines.push(`${''.padEnd(12)}${part.map(l => `  ${l.padEnd(EARL_COLS.length * W - 2)}`).join('')}`);
      lines.push(`${''.padEnd(12)}${part.map(() => EARL_COLS.map(w => w.padStart(W)).join('')).join('')}`);
      for (const arm of EARL_ARMS) {
        lines.push(`${WEAPONS[arm].name.padEnd(12)}${part.map(l => {
          const C = earl[arm][l];
          const best = Math.max(...EARL_COLS.slice(1).map(w => C[w].win));
          return EARL_COLS.map(w => `${Math.round(C[w].win * 100)}${w !== 'alone' && best > 0.005 && C[w].win >= best - 0.02 ? '*' : ' '}`.padStart(W)).join('');
        }).join('')}`);
      }
      lines.push('');
    }
    lines.push(`Earl down (%): side front hunt block, at ${TABLE_LEVELS.join(', ')}`);
    for (const arm of EARL_ARMS) lines.push(`${WEAPONS[arm].name.padEnd(12)}${TABLE_LEVELS.map(l => EARL_COLS.slice(1).map(w => String(Math.round(earl[arm][l][w].earlDown * 100)).padStart(4)).join('')).join('  ')}`);
  }
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (name, d) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : d);
  const seeds = Number(arg('--seeds', 200));
  const t0 = Date.now();
  const rows = table(seeds);
  const earl = earlTable(seeds);
  const text = print(rows, seeds, earl);
  console.log(text);
  console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  const out = arg('--out', null);
  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, 'fight-table.txt'), `${text}\n`);
    writeFileSync(path.join(out, 'fight-table.json'), `${JSON.stringify({ seeds, rows, earl }, null, 1)}\n`);
    console.log(`saved ${path.join(out, 'fight-table.txt')} and .json`);
  }
}
