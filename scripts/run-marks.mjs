#!/usr/bin/env node
// Measures RUN.md's marks (seven of the first test, five of rules-2, two of trust, two of goods, R1 to R4 of routes, H1 to H8 of home pressure) on the real engine (src/run/) with simple scripted policies, free.
//   node scripts/run-marks.mjs                 3,000 seeded six-day seasons per cell (ten-day for the home marks)
//   node scripts/run-marks.mjs --seeds 500     quicker, noisier
//   node scripts/run-marks.mjs --home          only the home marks, H1 to H8
//   node scripts/run-marks.mjs --json          the numbers as JSON
import { RUN_CONFIG } from '../src/run/config.mjs';
import { measure, judge, tableText, measureWorld, judgeWorld, worldText, measureTrust, judgeTrust, trustText, measureGoods, judgeGoods, goodsText, measureRoutes, judgeRoutes, routesText, measureHome, judgeHome, homeText } from '../src/run/marks.mjs';

const argv = process.argv.slice(2);
const opt = name => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const seeds = Number(opt('--seeds') ?? 3000);
if (!Number.isInteger(seeds) || seeds < 1) throw new Error('--seeds takes a whole number');

const started = Date.now();
if (argv.includes('--home')) {
  const home = measureHome(RUN_CONFIG, { seeds });
  const homeMarks = judgeHome(home);
  if (argv.includes('--json')) console.log(JSON.stringify({ home, marks: homeMarks }, null, 1));
  else console.log(`${homeText(homeMarks)}\n\n${homeMarks.filter(m => m.pass).length} of ${homeMarks.length} marks pass (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  process.exit(0);
}
const result = measure(RUN_CONFIG, { seeds });
const marks = judge(result);
const world = measureWorld(RUN_CONFIG, { seeds, rows: result.rows });
marks.push(...judgeWorld(world));
const trust = measureTrust(RUN_CONFIG, { seeds, rows: result.rows });
marks.push(...judgeTrust(trust));
const goods = measureGoods(RUN_CONFIG, { seeds, rows: result.rows });
marks.push(...judgeGoods(goods));
const routes = measureRoutes(RUN_CONFIG, { seeds, rows: result.rows });
const routeMarks = judgeRoutes(routes);
const home = measureHome(RUN_CONFIG, { seeds });
const homeMarks = judgeHome(home);
if (argv.includes('--json')) console.log(JSON.stringify({ ...result, world, trust, goods, routes, home, marks: [...marks, ...routeMarks, ...homeMarks] }, null, 1));
else {
  console.log(tableText(result, marks.filter(m => m.n <= 7)));
  console.log('');
  console.log(worldText(marks.filter(m => m.n > 7 && m.n <= 12)));
  console.log('');
  console.log(trustText(marks.filter(m => m.n > 12 && m.n <= 14)));
  console.log('');
  console.log(goodsText(marks.filter(m => m.n > 14)));
  console.log('');
  console.log(routesText(routeMarks));
  console.log('');
  console.log(homeText(homeMarks));
  const all = [...marks, ...routeMarks, ...homeMarks];
  console.log(`\n${all.filter(m => m.pass).length} of ${all.length} marks pass (${((Date.now() - started) / 1000).toFixed(0)} s)`);
}
