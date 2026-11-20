#!/usr/bin/env node
// Measures RUN.md's marks (seven of the first test, five of rules-2, two of trust, two of goods, R1 to R4 of routes, H1 to H8 of home pressure, P1 to P5 of the new places, S1 to S6 of the first slice, D1 to D6 of the raid, C1 to C6 of the pot) on the real engine (src/run/) with simple scripted policies, free.
//   node scripts/run-marks.mjs                 3,000 seeded six-day seasons per cell (ten-day for the home marks)
//   node scripts/run-marks.mjs --seeds 500     quicker, noisier
//   node scripts/run-marks.mjs --home          only the home marks, H1 to H8
//   node scripts/run-marks.mjs --places        only the new places' marks, P1 to P5 (batch-1; P5 bigman-1)
//   node scripts/run-marks.mjs --sixes         only the first slice's marks, S1 to S4 (sixes-1)
//   node scripts/run-marks.mjs --raid          only the raid's marks, D1 to D6 (raid-1)
//   node scripts/run-marks.mjs --pot           only the pot's marks, C1 to C6 (pot-1); --pot --all: the pot's marks, then every other mark beside its last recorded reading
//   node scripts/run-marks.mjs --bench         only the bench's marks, B1 to B4 (bench-1), on the rules with the bench in (BENCH_CONFIG)
//   node scripts/run-marks.mjs --json          the numbers as JSON
import { RUN_CONFIG, BENCH_CONFIG } from '../src/run/config.mjs';
import { measure, judge, tableText, measureWorld, judgeWorld, worldText, measureTrust, judgeTrust, trustText, measureGoods, judgeGoods, goodsText, measureRoutes, judgeRoutes, routesText, measureHome, judgeHome, homeText, measurePlaces, judgePlaces, placesText, measureSixes, judgeSixes, sixesText, atRest, measureRaid, judgeRaid, raidText, measurePot, judgePot, potText, measureBench, judgeBench, benchText } from '../src/run/marks.mjs';

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
if (argv.includes('--sixes')) {
  const sx = measureSixes(RUN_CONFIG, { seeds });
  const sxMarks = judgeSixes(sx);
  if (argv.includes('--json')) console.log(JSON.stringify({ sixes: sx, marks: sxMarks }, null, 1));
  else console.log(`${sixesText(sxMarks)}\n\n${sxMarks.filter(m => m.pass).length} of ${sxMarks.length} marks pass (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  process.exit(0);
}
if (argv.includes('--raid')) {
  const rd = measureRaid(RUN_CONFIG, { seeds });
  const rdMarks = judgeRaid(rd);
  if (argv.includes('--json')) console.log(JSON.stringify({ raid: rd, marks: rdMarks }, null, 1));
  else console.log(`${raidText(rdMarks)}

${rdMarks.filter(m => m.pass).length} of ${rdMarks.length} marks pass (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  process.exit(0);
}
// (bench-1) the bench's marks, on the rules with the bench in (the page's config has none of it until its screens exist)
if (argv.includes('--bench')) {
  const bn = measureBench(BENCH_CONFIG, { seeds });
  const bnMarks = judgeBench(bn);
  if (argv.includes('--json')) console.log(JSON.stringify({ bench: bn, marks: bnMarks }, null, 1));
  else console.log(`${benchText(bnMarks)}\n\n${bnMarks.filter(m => m.pass).length} of ${bnMarks.length} marks pass (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  process.exit(0);
}
// (pot-1) the pot's marks; with --all, then every other mark as the full run prints it (below)
let potMarks = [];
if (argv.includes('--pot')) {
  const pt = measurePot(RUN_CONFIG, { seeds });
  potMarks = judgePot(pt);
  if (argv.includes('--json')) console.log(JSON.stringify({ pot: pt, marks: potMarks }, null, 1));
  else console.log(`${potText(potMarks)}\n\n${potMarks.filter(m => m.pass).length} of ${potMarks.length} marks pass (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  if (!argv.includes('--all')) process.exit(0);
  console.log('');
}
if (argv.includes('--places')) {
  // (second pass: P1 to P5 compare a place with a place: the Sixes, who tax only the market, at rest)
  const places = measurePlaces(atRest(RUN_CONFIG), { seeds });
  const placeMarks = judgePlaces(places);
  console.log(`${placesText(placeMarks)}\n\n${placeMarks.filter(m => m.pass).length} of ${placeMarks.length} marks pass (${((Date.now() - started) / 1000).toFixed(0)} s)`);
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
// (second pass: with the Sixes at rest, so the market's own rows, measured with them on, are not handed over)
const places = measurePlaces(atRest(RUN_CONFIG), { seeds });
const placeMarks = judgePlaces(places);
const sixes = measureSixes(RUN_CONFIG, { seeds });
const sixesMarks = judgeSixes(sixes);
const raid = measureRaid(RUN_CONFIG, { seeds });
const raidMarks = judgeRaid(raid);
// (pot-1: the pot's, unless --pot measured them above)
const pot = argv.includes('--pot') ? null : measurePot(RUN_CONFIG, { seeds });
if (pot) potMarks = judgePot(pot);
if (argv.includes('--json')) console.log(JSON.stringify({ ...result, world, trust, goods, routes, home, places, sixes, raid, ...(pot ? { pot } : {}), marks: [...marks, ...routeMarks, ...homeMarks, ...placeMarks, ...sixesMarks, ...raidMarks, ...potMarks] }, null, 1));
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
  console.log('');
  console.log(placesText(placeMarks));
  console.log('');
  console.log(sixesText(sixesMarks));
  console.log('');
  console.log(raidText(raidMarks));
  if (pot) { console.log(''); console.log(potText(potMarks)); }
  const all = [...marks, ...routeMarks, ...homeMarks, ...placeMarks, ...sixesMarks, ...raidMarks, ...potMarks];
  console.log(`\n${all.filter(m => m.pass).length} of ${all.length} marks pass (${((Date.now() - started) / 1000).toFixed(0)} s)`);
}
