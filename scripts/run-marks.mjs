#!/usr/bin/env node
// Measures RUN.md's marks (seven of the first test, five of rules-2, two of trust) on the real engine (src/run/) with simple scripted policies, free.
//   node scripts/run-marks.mjs                 3,000 seeded six-day seasons per cell
//   node scripts/run-marks.mjs --seeds 500     quicker, noisier
//   node scripts/run-marks.mjs --json          the numbers as JSON
import { RUN_CONFIG } from '../src/run/config.mjs';
import { measure, judge, tableText, measureWorld, judgeWorld, worldText, measureTrust, judgeTrust, trustText } from '../src/run/marks.mjs';

const argv = process.argv.slice(2);
const opt = name => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const seeds = Number(opt('--seeds') ?? 3000);
if (!Number.isInteger(seeds) || seeds < 1) throw new Error('--seeds takes a whole number');

const started = Date.now();
const result = measure(RUN_CONFIG, { seeds });
const marks = judge(result);
const world = measureWorld(RUN_CONFIG, { seeds, rows: result.rows });
marks.push(...judgeWorld(world));
const trust = measureTrust(RUN_CONFIG, { seeds, rows: result.rows });
marks.push(...judgeTrust(trust));
if (argv.includes('--json')) console.log(JSON.stringify({ ...result, world, trust, marks }, null, 1));
else {
  console.log(tableText(result, marks.filter(m => m.n <= 7)));
  console.log('');
  console.log(worldText(marks.filter(m => m.n > 7 && m.n <= 12)));
  console.log('');
  console.log(trustText(marks.filter(m => m.n > 12)));
  console.log(`\n${marks.filter(m => m.pass).length} of ${marks.length} marks pass (${((Date.now() - started) / 1000).toFixed(0)} s)`);
}
