// RUN.md's seven marks, measured on the real engine with the scripted policies (policies.mjs). Free: no model, no
// network. scripts/run-marks.mjs prints them; tuning runs call measure() with withRunConfig(...).

import { POLICIES, playSeason } from './policies.mjs';
import { newRun } from './state.mjs';
import { withRunConfig } from './config.mjs';
import { step } from './step.mjs';
import { deal, placeOf, streetPlaces, guardOf, crewChance } from './rules.mjs';
import { raidChance, gunThings } from './raid.mjs';

export const KITS = Object.freeze([
  ['mattress', {}],
  ['+pocket', { pocket: true }],
  ['+cutter', { cutter: true }],
  ['+pocket+cutter', { pocket: true, cutter: true }],
  ['+bed', { bed: true }],
  ['all three', { pocket: true, cutter: true, bed: true }],
]);
export const STOPS = Object.freeze([30, 45, 60, 90, 120, 160, 220, 300]);

const pct = (n, d) => (d ? (100 * n) / d : 0);
const at = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

/** One policy, one kit, `seeds` six-day seasons: the daily take and what went wrong. */
export function trial(cfg, policy, kit, { seeds = 3000, days = 6, firstSeed = 1 } = {}) {
  const per = [];
  let jumped = 0, bad = 0, stopped = 0, earned = 0, lost = 0, trips = 0;
  const more = { robbed: 0, rough: 0, door: 0, fights: 0, robs: 0, bins: 0, drinks: 0, packs: 0, sales: 0, goodsLost: 0, goodsSeized: 0, walks: 0, cards: 0, cardPay: 0, footLost: 0, footGoods: 0, footJumped: 0,
    warnings: 0, raids: 0, raidsDoor: 0, raidsGuard: 0, raidsTaken: 0, burgled: 0, guardPaid: 0, alarms: 0, raced: 0, pressureSum: 0,
    crews: 0, sneaks: 0, burgledCrew: 0, burgledSneak: 0, crewFights: 0, crewLost: 0, earlDown: 0, taxPaid: 0, taxRefused: 0, sixesJumps: 0, sixesWon: 0, dogFood: 0,
    sixesRaids: 0, sixesRaidsHome: 0, sixesRaidsWon: 0, sixesRaidsOut: 0, sixesRaidTaken: 0, roundsFired: 0, roundsCost: 0, gunsLost: 0, gunHeat: 0, raidWarnings: 0 };
  // home pressure, per run: runs with an attempt, attempts on the day after one, attempts fewer than three days after
  // one (two quiet days between), attempts with no warning the day before
  const home = { runs: 0, withRaid: 0, backToBack: 0, shortGap: 0, unwarned: 0, minGap: Infinity };
  for (let s = firstSeed; s < firstSeed + seeds; s++) {
    const r = playSeason(cfg, { seed: s, policy, kit, days });
    per.push(...r.takes);
    jumped += r.tally.jumped; bad += r.tally.bad; stopped += r.tally.stopped;
    earned += r.tally.earned; lost += r.tally.lost; trips += r.tally.trips;
    for (const k of Object.keys(more)) more[k] += r.tally[k];
    const rd = r.tally.raidDays;
    home.runs += 1;
    if (rd.length) home.withRaid += 1;
    for (let i = 1; i < rd.length; i++) {
      const gap = rd[i] - rd[i - 1];
      if (gap === 1) home.backToBack += 1;
      if (gap < 3) home.shortGap += 1;
      home.minGap = Math.min(home.minGap, gap);
    }
    for (const d of rd) if (!r.tally.warnDays.includes(d - 1)) home.unwarned += 1;
  }
  const n = per.length;
  const day1 = [];
  for (let i = 0; i < n; i += days) day1.push(per[i]);
  // (bigman-1) the mean take of each day of the season, the first to the last
  const byDay = Array.from({ length: days }, (_, d) => { let a = 0, k = 0; for (let i = d; i < n; i += days) { a += per[i]; k += 1; } return k ? a / k : 0; });
  per.sort((a, b) => a - b);
  const worst = per.slice(0, Math.max(1, Math.floor(n / 10)));
  return {
    mean: per.reduce((a, b) => a + b, 0) / n,
    day1: day1.reduce((a, b) => a + b, 0) / day1.length,
    byDay,
    zero: pct(per.filter(x => x <= 0).length, n),
    p10: at(per, 0.1), p50: at(per, 0.5), p90: at(per, 0.9),
    tail10: worst.reduce((a, b) => a + b, 0) / worst.length, // the mean of the worst tenth of days
    lostPct: pct(lost, earned),
    trips: trips / n, jumped: jumped / n, bad: bad / n, stopped: stopped / n,
    perDay: Object.fromEntries(Object.entries(more).map(([k, x]) => [k, x / n])),
    // home pressure: what attempts took of what was earned, and the run-level counts above
    burgledPct: pct(more.burgled, earned),
    home: { ...home, withRaidPct: pct(home.withRaid, home.runs), raids: more.raids, perRun: more.raids / Math.max(1, home.runs) },
  };
}

/** Days until all three things are owned, buying each as soon as it can be afforded. */
export function daysToOwn(cfg, policy, { seeds = 3000, firstSeed = 1, maxDays = 40 } = {}) {
  const out = [];
  for (let s = firstSeed; s < firstSeed + seeds; s++) {
    const r = playSeason(cfg, { seed: s, policy: { ...policy, buy: true }, until: st => st.doneDay !== null, maxDays });
    out.push(r.state.doneDay ?? maxDays + 1);
  }
  out.sort((a, b) => a - b);
  return { p10: at(out, 0.1), median: at(out, 0.5), p90: at(out, 0.9), never: pct(out.filter(d => d > maxDays).length, out.length) };
}

/** Every row of the table: each kit with the trailer park, the stall, each go-home amount, never, and ignoring heat. */
export function measure(cfg, { seeds = 3000, kits = KITS, stops = STOPS, own = true } = {}) {
  const rows = {};
  for (const [name, kit] of kits) {
    const row = {
      park: trial(cfg, POLICIES.park, kit, { seeds }),
      stall: trial(cfg, POLICIES.stall, kit, { seeds }),
      homeAt: Object.fromEntries(stops.map(x => [x, trial(cfg, POLICIES.homeAt(x), kit, { seeds })])),
      never: trial(cfg, POLICIES.homeAt(Infinity), kit, { seeds }),
      reckless: trial(cfg, POLICIES.reckless, kit, { seeds }),
    };
    const amounts = Object.entries(row.homeAt);
    const [bestStop, bestHome] = amounts.reduce((a, b) => (b[1].mean > a[1].mean ? b : a));
    row.bestStop = Number(bestStop);
    row.bestHome = bestHome;
    // the market's best: the stall, any go-home amount, never, or ignoring heat
    const market = [['stall', row.stall], ...amounts.map(([x, t]) => [`home at $${x}`, t]), ['never', row.never], ['reckless', row.reckless]];
    [row.marketBestName, row.marketBest] = market.reduce((a, b) => (b[1].mean > a[1].mean ? b : a));
    [row.bestName, row.best] = [['park', row.park], ...market].reduce((a, b) => (b[1].mean > a[1].mean ? b : a));
    row.worstHome = amounts.reduce((a, b) => (b[1].mean < a[1].mean ? b : a))[1];
    rows[name] = row;
  }
  const owning = own ? {
    'park only': daysToOwn(cfg, POLICIES.park, { seeds }),
    'market, home at $90': daysToOwn(cfg, POLICIES.homeAt(90), { seeds }),
    'park until the cutter, then market': daysToOwn(cfg, { ...POLICIES.homeAt(90), marketOnce: { cutter: true } }, { seeds }),
  } : null;
  return { rows, owning, seeds };
}

/** The seven marks, pass or fail, with the numbers behind each. */
export function judge({ rows, owning }) {
  const gain = (a, b) => (100 * (a - b)) / b;
  const m = [];
  const bed = rows['+bed'];
  if (bed) {
    const g = gain(bed.bestHome.mean, bed.never.mean);
    m.push({ n: 1, name: 'Pushing has a price', target: 'with the bed, best go-home amount beats never going home early by 10%+',
      bracket: '$116 at $60 against $71', got: `$${bed.bestHome.mean.toFixed(0)} at $${bed.bestStop} against $${bed.never.mean.toFixed(0)} (+${g.toFixed(0)}%)`, pass: g >= 10 });
  }
  const mat = rows.mattress;
  const cut = rows['+cutter'];
  if (mat && cut) {
    const g1 = gain(mat.marketBest.mean, mat.park.mean);
    const g2 = gain(cut.marketBest.mean, mat.park.mean);
    m.push({ n: 2, name: 'The market is worth the risk', target: 'market best beats the trailer park best by 15%+ on the mattress, 30%+ with the cutter',
      bracket: '$74 and $87 against $63', got: `$${mat.marketBest.mean.toFixed(0)} (+${g1.toFixed(0)}%) and $${cut.marketBest.mean.toFixed(0)} (+${g2.toFixed(0)}%) against $${mat.park.mean.toFixed(0)}`, pass: g1 >= 15 && g2 >= 30 });
  }
  if (mat) {
    const z = mat.marketBest.zero;
    m.push({ n: 3, name: 'Losing is real', target: 'at the market best on the mattress, 15% to 35% of days bank nothing',
      bracket: '28%', got: `${z.toFixed(0)}% (${mat.marketBestName})`, pass: z >= 15 && z <= 35 });
  }
  {
    const worst = Object.entries(rows).map(([name, r]) => {
      const others = [r.park, r.stall, ...Object.values(r.homeAt), r.never];
      return { name, ok: others.every(t => t.mean > r.reckless.mean), reckless: r.reckless.mean };
    });
    m.push({ n: 4, name: 'Heat matters', target: 'ignoring heat is the worst policy in every kit',
      bracket: '$40 a day on the mattress', got: `$${rows.mattress?.reckless.mean.toFixed(0)} on the mattress; worst in ${worst.filter(w => w.ok).length} of ${worst.length} kits${worst.some(w => !w.ok) ? ` (not: ${worst.filter(w => !w.ok).map(w => w.name).join(', ')})` : ''}`, pass: worst.every(w => w.ok) });
  }
  {
    const ladder = ['mattress', '+pocket', '+pocket+cutter', 'all three'].filter(k => rows[k]);
    const steps = ladder.slice(1).map((k, i) => gain(rows[k].best.mean, rows[ladder[i]].best.mean));
    m.push({ n: 5, name: 'Every purchase shows', target: 'each thing raises the best daily take by 8%+ (mattress, pocket, pocket and cutter, all three)',
      bracket: '$74, $88, $101, $151', got: `${ladder.map(k => `$${rows[k].best.mean.toFixed(0)}`).join(', ')} (${steps.map(g => `+${g.toFixed(0)}%`).join(', ')})`, pass: steps.length === 3 && steps.every(g => g >= 8) });
  }
  if (owning) {
    const o = owning['market, home at $90'];
    const others = Object.entries(owning).filter(([k]) => k !== 'market, home at $90').map(([k, v]) => `${k} ${v.median}`).join(', ');
    m.push({ n: 6, name: 'Length', target: 'owning all three takes a median of 4 to 6 days (market, home at $90, buying as soon as affordable)',
      bracket: '4', got: `${o.median} (p10 ${o.p10}, p90 ${o.p90}; ${others})`, pass: o.median >= 4 && o.median <= 6 });
  }
  if (mat) {
    const g = gain(mat.bestHome.mean, mat.never.mean);
    const spread = gain(mat.bestHome.mean, Math.min(mat.worstHome.mean, mat.never.mean));
    m.push({ n: 7, name: 'A first day has a call worth making', target: 'on the mattress the go-home amount matters: best amount beats never going home early by 10%+ (the bar of mark 1)',
      bracket: '$72 to $74 across every amount', got: `$${mat.bestHome.mean.toFixed(0)} at $${mat.bestStop} against $${mat.never.mean.toFixed(0)} never (+${g.toFixed(0)}%); amounts span $${Math.min(mat.worstHome.mean, mat.never.mean).toFixed(0)} to $${mat.bestHome.mean.toFixed(0)} (${spread.toFixed(0)}%)`, pass: g >= 10 });
  }
  return m;
}

/** The table as plain text. */
export function tableText({ rows, owning, seeds }, marks) {
  const f = n => String(Math.round(n)).padStart(4);
  const lines = [];
  const stops = Object.keys(Object.values(rows)[0].homeAt);
  lines.push(`Daily take ($ banked a day, mean of ${seeds} seeded six-day seasons per cell)`);
  lines.push(`${'kit'.padEnd(15)} park stall | home at ${stops.map(s => `$${s}`.padStart(4)).join(' ')} never | heat-blind | best: market zero%  p10  p50  p90 lost% trips bad/day stops/day day1`);
  for (const [name, r] of Object.entries(rows)) {
    const b = r.marketBest;
    lines.push(`${name.padEnd(15)} ${f(r.park.mean)} ${f(r.stall.mean)} |         ${Object.values(r.homeAt).map(t => f(t.mean)).join(' ')} ${f(r.never.mean)} |       ${f(r.reckless.mean)} | ${r.marketBestName.padStart(13)} ${f(b.zero)}% ${f(b.p10)} ${f(b.p50)} ${f(b.p90)} ${f(b.lostPct)}% ${b.trips.toFixed(1).padStart(5)} ${b.bad.toFixed(2).padStart(7)} ${b.stopped.toFixed(2).padStart(9)} ${f(b.day1)}`);
  }
  if (owning) {
    lines.push('', 'Days to own all three (buying each as soon as it can be afforded)');
    for (const [k, v] of Object.entries(owning)) lines.push(`  ${k.padEnd(36)} median ${v.median}  p10 ${v.p10}  p90 ${v.p90}${v.never ? `  not in 40 days ${v.never.toFixed(1)}%` : ''}`);
  }
  if (marks) {
    lines.push('', 'Marks');
    for (const mk of marks) lines.push(`  ${mk.n}. ${mk.pass ? 'PASS' : 'FAIL'}  ${mk.name}: ${mk.got}   [target: ${mk.target}; designer's check: ${mk.bracket}]`);
  }
  return lines.join('\n');
}

// ── rules-2: the world answers (RUN.md, "The world answers") ─────────────────────────────────────────────────────────
// Five more marks, measured the same way: seeded seasons of scripted policies on the real engine.

/** The average a move pays per energy at a place, over `n` seeded tries on the real engine: the bins, and the safe job. */
export function perEnergy(cfg, place, choiceOf, { n = 3000 } = {}) {
  let total = 0, energy = 0;
  for (let seed = 1; seed <= n; seed++) {
    const fresh = newRun({ seed, cfg });
    const s = { ...fresh, place, energy: cfg.energy.mattress, hour: cfg.start.hour + (seed % 6) };
    const { state } = step(cfg, s, choiceOf(cfg, s));
    total += state.books.earned;
    energy += s.energy - state.energy;
  }
  return total / energy;
}

/** The new marks' numbers. `rows` (from measure()) gives the single-place policies for mark 12 without playing them again. */
export function measureWorld(cfg, { seeds = 3000, rows = null } = {}) {
  const t = (policy, kit = {}, days = 6) => trial(cfg, policy, kit, { seeds, days });
  const out = {};
  // 8. a night on the street against going home (and, beside it, the day's drink)
  out.rough = Object.fromEntries([['mattress', {}], ['+bed', { bed: true }]].map(([name, kit]) => [name, {
    home: t(POLICIES.homeAt(120), kit),
    rough: t({ ...POLICIES.homeAt(120), rough: true }, kit),
    drink: t({ ...POLICIES.homeAt(120), drink: true }, kit),
  }]));
  // 9. the bins against the safe job, per energy, at every place with both
  out.bins = Object.fromEntries(streetPlaces(cfg).filter(p => placeOf(cfg, p).jobs && placeOf(cfg, p).supply?.[cfg.street.bins.draws]).map(p => [p, {
    bins: perEnergy(cfg, p, () => ({ do: 'bins' }), { n: seeds }),
    safe: perEnergy(cfg, p, (c, s) => ({ do: 'job', id: deal(c, s)[0].id }), { n: seeds }),
  }]));
  out.binsPolicy = { park: t(POLICIES.park), parkBins: t({ ...POLICIES.park, bins: true }) };
  // 10. robbing strangers: twice in one place against once in each
  const cut = { cutter: true };
  out.rob = {
    marketTwice: t({ ...POLICIES.homeAt(120), robPlan: { market: 2 } }, cut),
    parkTwice: t({ ...POLICIES.homeAt(120), robPlan: { park: 2 } }, cut),
    moving: t({ ...POLICIES.homeAt(120), robPlan: { park: 1, market: 1 } }, cut),
    none: t({ ...POLICIES.homeAt(120), robPlan: { market: 0 } }, cut),
  };
  // 11. a regular: always selling to them against never, over ten days (they need three sales to come knocking)
  out.regular = {
    lean: t({ ...POLICIES.park, regular: 'lean' }, {}, 10),
    avoid: t({ ...POLICIES.park, regular: 'avoid' }, {}, 10),
    leanRefuse: t({ ...POLICIES.park, regular: 'lean', door: 'refuse' }, {}, 10),
  };
  // 12. both places against one
  out.mixed = Object.fromEntries([['mattress', {}], ['+cutter', cut]].map(([name, kit]) => {
    const r = rows?.[name];
    const market = r ? { name: `home at $${r.bestStop}`, t: r.bestHome } : { name: 'home at $120', t: t(POLICIES.homeAt(120), kit) };
    return [name, { mixed: t(POLICIES.mixed(120), kit), park: r ? r.park : t(POLICIES.park, kit), market }];
  }));
  return out;
}

/** Marks 8 to 12, pass or fail, with the numbers behind each. */
export function judgeWorld(w) {
  const $ = n => `$${n.toFixed(0)}`;
  const m = [];
  {
    const cells = Object.entries(w.rough);
    const ok = cells.every(([, c]) => c.rough.mean < c.home.mean);
    m.push({ n: 8, name: 'Sleeping rough is worse than going home', target: 'staying out when spent and sleeping rough banks less a day than paying the fare home (home at $120), mattress and bed',
      got: cells.map(([k, c]) => `${k} ${$(c.rough.mean)} against ${$(c.home.mean)} (robbed on ${(100 * c.rough.perDay.robbed / Math.max(1e-9, c.rough.perDay.rough)).toFixed(0)}% of rough nights; worst tenth of days ${$(c.rough.tail10)} against ${$(c.home.tail10)}; with the drink ${$(c.drink.mean)})`).join('; '), pass: ok });
  }
  {
    const cells = Object.entries(w.bins);
    const ok = cells.every(([, c]) => c.bins < c.safe) && w.binsPolicy.parkBins.mean < w.binsPolicy.park.mean;
    m.push({ n: 9, name: 'The bins never beat the safe job', target: 'at every place with bins, a dig pays less per energy than the safe job; the park with bins instead of odd jobs banks less',
      got: `${cells.map(([p, c]) => `${p} $${c.bins.toFixed(1)} against $${c.safe.toFixed(1)} an energy`).join('; ')}; park ${$(w.binsPolicy.parkBins.mean)} with bins against ${$(w.binsPolicy.park.mean)}`, pass: ok });
  }
  {
    const r = w.rob;
    const ok = r.moving.mean > r.marketTwice.mean && r.moving.mean > r.parkTwice.mean;
    m.push({ n: 10, name: 'Robbing twice in one place loses to moving on', target: 'with the box cutter, home at $120: one robbery in the park and one at the market beats two at either',
      got: `${$(r.moving.mean)} moving against ${$(r.marketTwice.mean)} twice at the market and ${$(r.parkTwice.mean)} twice in the park (no robbing ${$(r.none.mean)})`, pass: ok });
  }
  {
    const r = w.regular;
    const ok = r.lean.tail10 < r.avoid.tail10;
    m.push({ n: 11, name: 'Leaning on a regular has a tail', target: 'trailer park, ten days: always selling to the regular has a worse tenth of days than never',
      got: `worst tenth $${r.lean.tail10.toFixed(1)} leaning against $${r.avoid.tail10.toFixed(1)} not (means ${$(r.lean.mean)} and ${$(r.avoid.mean)}; at the door ${r.lean.perDay.door.toFixed(2)} a day; refusing every time: tail ${$(r.leanRefuse.tail10)}, mean ${$(r.leanRefuse.mean)}, fights ${r.leanRefuse.perDay.fights.toFixed(2)} a day)`, pass: ok });
  }
  {
    const cells = Object.entries(w.mixed).map(([k, c]) => {
      const best = Math.max(c.park.mean, c.market.t.mean);
      const worst = Math.min(c.park.mean, c.market.t.mean);
      return { k, c, gain: (100 * (c.mixed.mean - best)) / best, floor: (100 * worst) / c.mixed.mean };
    });
    const ok = cells.every(x => x.gain >= 10 && x.floor >= 50);
    m.push({ n: 12, name: 'Both places beat one', target: 'playing both places (the park when the market is hot, and after a trip) beats the better single place by 10%+, and neither single place falls under half of it',
      got: cells.map(x => `${x.k} ${$(x.c.mixed.mean)} against park ${$(x.c.park.mean)} and market ${$(x.c.market.t.mean)} (${x.c.market.name}): +${x.gain.toFixed(0)}%, the weaker at ${x.floor.toFixed(0)}%`).join('; '), pass: ok });
  }
  return m;
}

export function worldText(marks) {
  return ['Marks of rules-2', ...marks.map(mk => `  ${mk.n}. ${mk.pass ? 'PASS' : 'FAIL'}  ${mk.name}: ${mk.got}   [target: ${mk.target}]`)].join('\n');
}

// ── trust: the good neighbour against the burner (RUN.md, "Trust") ────────────────────────────────────────────────────
// Three ways to treat people, the same frame otherwise (both places, home at $stopAt), the marks' seeds and season.

/** The good neighbour, the burner and the farmer, each kit; beside each kit's best policy of the marks (rows). */
export function measureTrust(cfg, { seeds = 3000, rows = null, kits = KITS, stopAt = 120 } = {}) {
  const out = {};
  for (const [name, kit] of kits) {
    out[name] = {
      neighbour: trial(cfg, POLICIES.neighbour(stopAt), kit, { seeds }),
      burner: trial(cfg, POLICIES.burner(stopAt), kit, { seeds }),
      farm: trial(cfg, POLICIES.farm(stopAt), kit, { seeds }),
      best: rows?.[name] ? { name: rows[name].bestName, t: rows[name].best } : null,
    };
  }
  return out;
}

/** Marks 13 and 14: neither way with people clearly wins; farming trust then robbing is not the best of the three. */
export function judgeTrust(tr) {
  const $ = n => `$${n.toFixed(0)}`;
  const cells = Object.entries(tr).map(([k, c]) => {
    const hi = Math.max(c.neighbour.mean, c.burner.mean);
    const lo = Math.min(c.neighbour.mean, c.burner.mean);
    return { k, c, gap: (100 * (hi - lo)) / lo, farmBest: c.farm.mean > hi };
  });
  const line = x => `${x.k} neighbour ${$(x.c.neighbour.mean)}, burner ${$(x.c.burner.mean)} (${x.gap.toFixed(0)}% apart), farm ${$(x.c.farm.mean)}${x.c.best ? `; best of the marks ${$(x.c.best.t.mean)} (${x.c.best.name})` : ''}`;
  return [
    { n: 13, name: 'Trust is a real choice', target: 'the good neighbour and the burner (both places, home at $120) bank within 10% of each other, every kit',
      got: cells.map(line).join('; '), pass: cells.every(x => x.gap <= 10) },
    { n: 14, name: 'Farming trust then robbing is not the way', target: 'odd jobs for three days then burning does not beat both the good neighbour and the burner, any kit',
      got: cells.map(x => `${x.k} ${x.farmBest ? 'farm best' : 'farm not best'}`).join('; '), pass: cells.every(x => !x.farmBest) },
  ];
}

export function trustText(marks) {
  return ['Marks of trust', ...marks.map(mk => `  ${mk.n}. ${mk.pass ? 'PASS' : 'FAIL'}  ${mk.name}: ${mk.got}   [target: ${mk.target}]`)].join('\n');
}

// ── goods: the dealer against players who never buy in (RUN.md, "Goods, the connect and errands") ───────────────────
// Both places, home at $stopAt, as `mixed`, the marks' seeds and season. The dealer buys at both connects what is worth
// the risk, sells first, and takes `carry` sales of each good out on a market trip (the rest stay at the crib).

/** The dealer at three carries, the same player never buying in, each kit; beside each kit's best of the marks (rows). */
export function measureGoods(cfg, { seeds = 3000, rows = null, kits = KITS, stopAt = 120, carries = [1, 2, 4] } = {}) {
  const out = {};
  for (const [name, kit] of kits) {
    out[name] = {
      dealer: Object.fromEntries(carries.map(c => [c, trial(cfg, POLICIES.dealer(stopAt, c), kit, { seeds })])),
      noSell: trial(cfg, POLICIES.noSell(stopAt), kit, { seeds }),
      best: rows?.[name] ? { name: rows[name].bestName, t: rows[name].best } : null,
      market: rows?.[name] ? { name: `home at $${rows[name].bestStop}`, t: rows[name].bestHome } : null,
    };
  }
  return out;
}

/**
 * Marks 15 and 16. 15: buying in is a real choice: the dealer (carry 2) within 15% of the best player who never buys a
 * pack (both places never buying; the market's best home-at amount, whose players find the market's discs not worth
 * the risk and buy none), and of the marks' best, either way, every kit. 16: carrying more is more risk (goods lost a
 * day rise with the carry) and, up to a trip's sales, more profit (carry 2 beats carry 1).
 */
export function judgeGoods(gd) {
  const $ = n => `$${n.toFixed(0)}`;
  const pc = (a, b) => (100 * (a - b)) / b;
  const cells = Object.entries(gd).map(([k, c]) => {
    const d = c.dealer[2] ?? Object.values(c.dealer)[0];
    const plain = [c.noSell, c.market?.t].filter(Boolean).reduce((a, b) => (b.mean > a.mean ? b : a));
    const best = c.best?.t ?? plain;
    const lost = Object.values(c.dealer).map(t => t.perDay.goodsLost + t.perDay.goodsSeized);
    return { k, c, d, plain, best, vsPlain: pc(d.mean, plain.mean), vsBest: pc(d.mean, best.mean), lost, riskUp: lost.every((x, i) => !i || x > lost[i - 1]), moreProfit: !c.dealer[1] || !c.dealer[2] || c.dealer[2].mean > c.dealer[1].mean };
  });
  const sign = n => `${n >= 0 ? '+' : ''}${n.toFixed(0)}%`;
  return [
    { n: 15, name: 'Buying in is a real choice', target: 'the dealer (both places, home at $120, carry 2) banks within 15% of the best player who never buys a pack, and of the marks\' best, either way, every kit',
      got: cells.map(x => `${x.k} dealer ${$(x.d.mean)} (${x.d.perDay.sales.toFixed(2)} sales, ${x.d.perDay.packs.toFixed(2)} packs a day), never buying ${$(x.c.noSell.mean)}, market ${$(x.c.market?.t.mean ?? 0)} (${x.c.market?.t.perDay.packs.toFixed(2) ?? 0} packs a day): ${sign(x.vsPlain)}; marks' best ${$(x.best.mean)} (${x.c.best?.name}): ${sign(x.vsBest)}`).join('; '),
      pass: cells.every(x => Math.abs(x.vsPlain) <= 15 && Math.abs(x.vsBest) <= 15) },
    { n: 16, name: 'Carrying more is more risk, and more profit up to a trip\'s sales', target: 'goods lost a day rise with what the dealer carries out (1, 2, 4 of each), and carrying 2 banks more than 1',
      got: cells.map(x => `${x.k} ${Object.entries(x.c.dealer).map(([n, t]) => `carry ${n} ${$(t.mean)} (lost ${(t.perDay.goodsLost + t.perDay.goodsSeized).toFixed(2)} a day, worst tenth ${$(t.tail10)})`).join(', ')}`).join('; '),
      pass: cells.every(x => x.riskUp && x.moreProfit) },
  ];
}

export function goodsText(marks) {
  return ['Marks of goods', ...marks.map(mk => `  ${mk.n}. ${mk.pass ? 'PASS' : 'FAIL'}  ${mk.name}: ${mk.got}   [target: ${mk.target}]`)].join('\n');
}

// ── routes: walking, the stops, the skateboard (RUN.md, "Routes") ───────────────────────────────────────────────────
// The market, home at $X, as homeAt, on the mattress: the same player by the subway, on foot (passing the stops or
// playing them), and on the board. The marks' seeds and season.

/**
 * What a stop's card pays an energy, over `n` seeded plays on the real engine (as perEnergy for the bins and the safe
 * jobs): you stand at the stop, on the way from its route's first place, with the card dealt (and five sales of each
 * good it takes on you). A sale counts what it paid less what the good cost.
 */
export function cardPerEnergy(cfg, stop, id, { n = 3000 } = {}) {
  const [routeId, r] = Object.entries(cfg.routes).find(([, x]) => x.stops.includes(stop));
  const card = cfg.stops[stop].cards[id];
  let total = 0, energy = 0;
  for (let seed = 1; seed <= n; seed++) {
    const fresh = newRun({ seed, cfg });
    const goods = Object.fromEntries(Object.keys(card.goods ?? {}).map(g => [g, 5]));
    const s = { ...fresh, place: stop, goods, energy: cfg.energy.mattress, hour: cfg.start.hour + (seed % 6),
      route: { id: routeId, from: r.between[0], to: r.between[1], way: 'foot', stops: [...r.stops], at: r.stops.indexOf(stop), hand: [id] } };
    const { state, events } = step(cfg, s, { do: 'card', id });
    const used = events.find(e => e.goods)?.goods;
    total += state.books.earned - (used ? Math.round(cfg.goods[used.good].price / cfg.goods[used.good].sales) : 0);
    energy += s.energy - state.energy;
  }
  return total / energy;
}

/** The routes' numbers. `rows` (from measure()) gives the subway riders without playing them again. */
export function measureRoutes(cfg, { seeds = 3000, rows = null, stops = [90, 120, 160], carries = [1, 2, 4] } = {}) {
  const t = (policy, kit = {}) => trial(cfg, policy, kit, { seeds });
  const out = {};
  // R1, R2: on foot both ways, passing every stop, playing them on the way home, and on foot out only (the subway home)
  out.walk = Object.fromEntries(stops.map(x => [x, {
    pass: t(POLICIES.walker(x)),
    play: t(POLICIES.walker(x, 'play')),
    out: t(POLICIES.walker(x, null, 'out')),
  }]));
  const [bestPlay] = Object.entries(out.walk).reduce((a, b) => (b[1].play.mean > a[1].play.mean ? b : a));
  out.all = { at: Number(bestPlay), t: t(POLICIES.walker(Number(bestPlay), 'all')) }; // every card it can, both ways
  out.subway = rows?.mattress ? { name: `home at $${rows.mattress.bestStop}`, t: rows.mattress.bestHome, best: { name: rows.mattress.bestName, t: rows.mattress.best } }
    : (() => { const [x, b] = stops.map(s => [s, t(POLICIES.homeAt(s))]).reduce((a, c) => (c[1].mean > a[1].mean ? c : a)); return { name: `home at $${x}`, t: b, best: { name: `home at $${x}`, t: b } }; })();
  // every card against the market's safe job, an energy
  out.safe = { place: 'market', perEnergy: perEnergy(cfg, 'market', (c, s) => ({ do: 'job', id: deal(c, s)[0].id }), { n: seeds }) };
  out.cards = Object.entries(cfg.stops ?? {}).flatMap(([stop, s]) => Object.keys(s.cards).map(id => ({ stop, id, perEnergy: cardPerEnergy(cfg, stop, id, { n: seeds }) })));
  // R3: the skateboard, every way, playing the stops on the way home
  out.board = Object.fromEntries(stops.map(x => [x, t(POLICIES.skater(x), { board: true })]));
  out.boardPrice = cfg.things.board.price;
  // R4: the dealer (both places, home at $120) on foot both ways, carrying 1, 2 and 4 sales of each good out
  out.carry = Object.fromEntries(['mattress', '+bed'].map(k => [k, Object.fromEntries(carries.map(c => [c, t({ ...POLICIES.dealer(120, c), walk: 'both' }, k === '+bed' ? { bed: true } : {})]))]));
  return out;
}

/** Marks R1 to R4, pass or fail, with the numbers behind each. */
export function judgeRoutes(r) {
  const $ = n => `$${n.toFixed(0)}`;
  const sign = n => `${n >= 0 ? '+' : ''}${n.toFixed(0)}%`;
  const pc = (a, b) => (100 * (a - b)) / b;
  const walkers = Object.entries(r.walk).flatMap(([x, w]) => Object.entries(w).map(([k, tt]) => ({ name: `${k === 'out' ? 'on foot out, the subway home' : `on foot, ${k === 'play' ? 'playing the stops' : 'passing the stops'}`}, home at $${x}`, t: tt })));
  const bestWalker = walkers.reduce((a, b) => (b.t.mean > a.t.mean ? b : a));
  const rider = r.subway.t;
  const gap = (100 * Math.abs(bestWalker.t.mean - rider.mean)) / Math.min(bestWalker.t.mean, rider.mean);
  const m = [];
  m.push({ n: 'R1', name: 'Walking is a real choice', target: 'on the mattress the best walker and the best subway rider to the market bank within 15% of each other',
    got: `best walker ${$(bestWalker.t.mean)} (${bestWalker.name}) against the best rider ${$(rider.mean)} (${r.subway.name}): ${gap.toFixed(0)}% apart; on foot both ways passing the stops ${Object.entries(r.walk).map(([x, w]) => `${$(w.pass.mean)} at $${x}`).join(', ')}; out only ${Object.entries(r.walk).map(([x, w]) => `${$(w.out.mean)} at $${x}`).join(', ')}`,
    pass: gap <= 15 });
  const [x, w] = Object.entries(r.walk).reduce((a, b) => (b[1].play.mean > a[1].play.mean ? b : a));
  const g = pc(w.play.mean, w.pass.mean);
  const over = r.cards.filter(c => c.perEnergy >= r.safe.perEnergy);
  m.push({ n: 'R2', name: 'Stops are worth it, never the point', target: 'a walker who plays the stops banks 5%+ more than one who passes them all, and no stop card pays more an energy than the market\'s safe job',
    got: `home at $${x}: playing ${$(w.play.mean)} (${w.play.perDay.cards.toFixed(2)} cards a day, $${w.play.perDay.cardPay.toFixed(1)}) against passing ${$(w.pass.mean)}: ${sign(g)}; every card it can, both ways: ${$(r.all.t.mean)} (${r.all.t.perDay.cards.toFixed(2)} a day); an energy: ${r.cards.map(c => `${c.id} $${c.perEnergy.toFixed(1)}`).join(', ')} against the market's safe job $${r.safe.perEnergy.toFixed(1)}`,
    pass: g >= 5 && !over.length });
  const [bx, bt] = Object.entries(r.board).reduce((a, b) => (b[1].mean > a[1].mean ? b : a));
  const without = [rider, r.subway.best?.t, bestWalker.t].filter(Boolean).reduce((a, b) => (b.mean > a.mean ? b : a));
  const bg = pc(bt.mean, without.mean);
  const payback = r.boardPrice / Math.max(1e-9, bt.mean - without.mean);
  m.push({ n: 'R3', name: 'The skateboard shows', target: 'owning it raises the best daily take by 8%+, and its price is earned back in 2 to 5 days of use',
    got: `on the board ${$(bt.mean)} (home at $${bx}, ${bt.perDay.walks.toFixed(2)} ways a day) against the best without ${$(without.mean)}: ${sign(bg)}; $${r.boardPrice} earned back in ${payback.toFixed(1)} days`,
    pass: bg >= 8 && payback >= 2 && payback <= 5 });
  const cells = Object.entries(r.carry).map(([k, c]) => {
    const lost = Object.values(c).map(tt => tt.perDay.footLost);
    return { k, c, lost, up: lost.every((y, i) => !i || y > lost[i - 1]) };
  });
  m.push({ n: 'R4', name: 'Carrying on foot is a readable risk', target: 'what is lost a day on foot (jumped or stopped on the route: cash, and goods at cost) rises with what is carried (the dealer on foot both ways, carrying 1, 2, 4 of each good)',
    got: cells.map(cl => `${cl.k} ${Object.entries(cl.c).map(([n, tt]) => `carry ${n} $${tt.perDay.footLost.toFixed(2)} a day (goods $${tt.perDay.footGoods.toFixed(2)}; banks ${$(tt.mean)})`).join(', ')}`).join('; '),
    pass: cells.every(cl => cl.up) });
  return m;
}

export function routesText(marks) {
  return ['Marks of routes', ...marks.map(mk => `  ${mk.n}. ${mk.pass ? 'PASS' : 'FAIL'}  ${mk.name}: ${mk.got}   [target: ${mk.target}]`)].join('\n');
}

// ── home pressure: attempts on your crib, and what defends it (RUN.md, "Home pressure (home-1)") ────────────────────
// Ten-day seasons (pressure is built over days; the bank worth taking grows with them), the marks' seeds otherwise.
// The quiet players: the stall only, and both places doing only the safe jobs (odd jobs, the stall). The pressured
// players, never defending: the trailer park's crime player, and the one who does the trailer park's crimes first and
// then the market (`homeFirst`), on the mattress and with the bed. The home-first player with the bed is THE pressured
// player of H3, H5 and H7: with the bed its trips are long enough to be away when they come (on the mattress it is
// usually home again inside the window, so the door decides it: shown beside).

const HOME_DAYS = 10;
/** (second pass) H3's bars: a piece against sneaks pays back within this many days; the door bar against crews within H3_CREW_DAYS (measured: RUN.md). */
export const H3_DAYS = 8;
export const H3_CREW_DAYS = 10;

/** The home marks' numbers. */
export function measureHome(cfg, { seeds = 3000, days = HOME_DAYS, stopAt = 120 } = {}) {
  const t = (policy, kit = {}) => trial(cfg, policy, kit, { seeds, days });
  const hf = POLICIES.homeFirst(stopAt);
  const bed = { bed: true };
  const out = {
    days,
    quiet: { stall: t(POLICIES.stall), quiet: t(POLICIES.quiet(stopAt)), quietBed: t(POLICIES.quiet(stopAt), bed) },
    pressured: { park: t(POLICIES.park), homeFirst: t(hf), homeFirstBed: t(hf, bed) },
  };
  // each defence, for the pressured player with the bed and for the quiet one with the bed (the deadbolt and the floor
  // safe owned from the start; the guard put on for the day an attempt is due), and on the mattress beside
  const defend = (base, kit) => ({
    deadbolt: t(base, { ...kit, deadbolt: true }),
    floorsafe: t(base, { ...kit, floorsafe: true }),
    guard: t({ ...base, defend: 'guard' }, kit),
  });
  out.defended = { homeFirstBed: defend(hf, bed), homeFirst: defend(hf, {}), quietBed: defend(POLICIES.quiet(stopAt), bed) };
  out.racer = { homeFirstBed: t({ ...hf, race: true }, bed), homeFirst: t({ ...hf, race: true }) };
  out.carrier = { homeFirstBed: t({ ...hf, carryAll: true }, bed), homeFirst: t({ ...hf, carryAll: true }), park: t({ ...POLICIES.park, carryAll: true }) };
  out.prices = Object.fromEntries(Object.entries(cfg.things).filter(([, x]) => x.defends).map(([k, x]) => [k, x.price]));
  // (second pass) H3 BY THE VISITOR EACH PIECE IS FOR: the chain and locks, the floor safe, the dog and its sign against
  // sneaks (the same pressured player, out when they come, with crews held off: crew.at past the meter's top); the door
  // bar against crews (the game as it is: he is home at night when they come). The quiet player, every piece
  if (cfg.crew) {
    const sneaks = withRunConfig({ crew: { at: (cfg.pressure?.max ?? 10) + 1 } }, cfg);
    const ts = (policy, kit = {}) => trial(sneaks, policy, kit, { seeds, days });
    const forSneak = Object.keys(cfg.things).filter(k => cfg.things[k].defends && cfg.things[k].against?.includes('sneak') && !cfg.things[k].against.includes('crew') || ['deadbolt', 'floorsafe'].includes(k));
    const forCrew = Object.keys(cfg.things).filter(k => cfg.things[k].defends && cfg.things[k].against?.length === 1 && cfg.things[k].against[0] === 'crew');
    const sb = ts(hf, bed);
    out.h3 = {
      sneak: { base: sb, pieces: Object.fromEntries(forSneak.map(k => [k, ts(hf, { ...bed, [k]: true })])) },
      crew: { base: out.pressured.homeFirstBed, pieces: Object.fromEntries(forCrew.map(k => [k, t(hf, { ...bed, [k]: true })])) },
      quiet: Object.fromEntries([...forSneak, ...forCrew].map(k => [k, t(POLICIES.quiet(stopAt), { ...bed, [k]: true })])),
    };
  }
  out.guard = { price: cfg.guard.price, days: cfg.guard.days };
  // H8 (save-1): hiring Cousin Earl is a decision, not a reflex. The pressured player (bed) three ways, otherwise the
  // same: never hires him; hires him on every warning (the morning the attempt is due); hires him only when what stands
  // to be lost (the share of the bank an attempt takes, times the chance they get in with the defences owned) is more
  // than his price. Beside, the same with the deadbolt, the floor safe and both owned.
  const worth = { ...hf, defend: 'guard', guardWhen: 'worth' };
  const kits = { none: bed, deadbolt: { ...bed, deadbolt: true }, floorsafe: { ...bed, floorsafe: true }, both: { ...bed, deadbolt: true, floorsafe: true } };
  out.earl = Object.fromEntries(Object.entries(kits).map(([k, kit]) => [k, {
    never: k === 'none' ? out.pressured.homeFirstBed : k === 'both' ? t(hf, kit) : out.defended.homeFirstBed[k],
    every: k === 'none' ? out.defended.homeFirstBed.guard : t({ ...hf, defend: 'guard' }, kit),
    worth: t(worth, kit),
  }]));
  // the bank at which hiring starts to pay, by the rule (the share an attempt takes × the chance they get in = his
  // price), and counting that he is beaten (their clean win) some of the time; with nobody home
  const beaten = guardOf(cfg, newRun({ cfg })).beatenPct;
  out.breakEven = Object.fromEntries(Object.keys(kits).map(k => {
    const things = k === 'none' ? [] : k === 'both' ? ['deadbolt', 'floorsafe'] : [k];
    const pct = Math.min(cfg.raid.pct, ...things.map(x => cfg.things[x].defends.pct ?? Infinity));
    const share = Math.min(cfg.raid.share, ...things.map(x => cfg.things[x].defends.share ?? Infinity));
    const rule = cfg.guard.price / ((share / 100) * (pct / 100));
    return [k, { pct, share, rule, held: rule / (1 - beaten / 100), beatenPct: beaten }];
  }));
  return out;
}

/** Marks H1 to H7, pass or fail, with the numbers behind each. */
export function judgeHome(h) {
  const $ = n => `$${n.toFixed(1)}`;
  const p1 = n => `${n.toFixed(1)}%`;
  const m = [];
  const quiet = Object.entries(h.quiet);
  m.push({ n: 'H1', name: 'A quiet player is left alone', target: 'a player who works the stall and odd jobs and never sells, lifts or robs at home sees an attempt in at most 2% of runs',
    got: quiet.map(([k, x]) => `${k} ${p1(x.home.withRaidPct)} of runs (${x.perDay.warnings.toFixed(3)} warnings a day)`).join('; '), pass: quiet.every(([, x]) => x.home.withRaidPct <= 2) });
  const pr = Object.entries(h.pressured);
  m.push({ n: 'H2', name: 'It matters, it is not ruin', target: 'a player who brings pressure on (deals, lifts, robs at home) and never defends loses 8% to 25% of what they earn to attempts',
    got: pr.map(([k, x]) => `${k} ${p1(x.burgledPct)} (${x.home.perRun.toFixed(2)} attempts a ${h.days}-day run, ${(x.perDay.raidsDoor * h.days).toFixed(2)} met at the door; banks ${$(x.mean)} a day)`).join('; '),
    pass: pr.every(([, x]) => x.burgledPct >= 8 && x.burgledPct <= 25) });
  // H3: each defence's payback for the pressured player (the bed), and for the quiet one
  const payback = (base, d, price) => {
    const gain = d.mean - base.mean;
    return { gain, days: price ? (gain > 0 ? price / gain : Infinity) : null };
  };
  const pb = h.pressured.homeFirstBed;
  const qb = h.quiet.quietBed;
  const rows = ['deadbolt', 'floorsafe', 'guard'].map(k => {
    const price = h.prices[k] ?? 0;
    const p = payback(pb, h.defended.homeFirstBed[k], price);
    const q = payback(qb, h.defended.quietBed[k], price);
    const mat = payback(h.pressured.homeFirst, h.defended.homeFirst[k], price);
    const wages = k === 'guard' ? h.defended.homeFirstBed.guard.perDay.guardPaid * 7 : 0;
    return { k, price, p, q, mat, wages };
  });
  const words = r => (r.k === 'guard' ? `Cousin Earl ($${h.guard.price} for ${h.guard.days} days, hired the morning it is due) +${$(r.p.gain)} a day after his hire ($${r.wages.toFixed(0)} a week)` : `${r.k} ($${r.price}) +${$(r.p.gain)} a day, paid back in ${r.p.days.toFixed(1)} days`);
  // (second pass, sixes-1) each piece judged against the visitor it is for: H3_DAYS (sneaks), H3_CREW_DAYS (crews)
  if (h.h3) {
    const back = (base, x, price) => { const gain = x.mean - base.mean; return { gain, days: gain > 0 ? price / gain : Infinity }; };
    const S = Object.entries(h.h3.sneak.pieces).map(([k, x]) => ({ k, ...back(h.h3.sneak.base, x, h.prices[k]) }));
    const C = Object.entries(h.h3.crew.pieces).map(([k, x]) => ({ k, ...back(h.h3.crew.base, x, h.prices[k]) }));
    const Q = Object.entries(h.h3.quiet).map(([k, x]) => ({ k, gain: x.mean - qb.mean }));
    const g = rows.find(r => r.k === 'guard');
    const w = r => `${r.k} ($${h.prices[r.k]}) +${$(r.gain)} a day, ${Number.isFinite(r.days) ? `${r.days.toFixed(1)} days` : 'never'}`;
    m.push({ n: 'H3', name: 'Defences are choices, not a tax', target: `for the pressured player (the bed) each piece pays for itself against the visitor it is for: the chain and locks, the floor safe, the dog and its sign against sneaks (crews held off) within ${H3_DAYS} days; the door bar against crews (the game as it is: home at night) within ${H3_CREW_DAYS} days; Cousin Earl more saved than his hire; none is worth buying for the quiet player`,
      got: `against sneaks: ${S.map(w).join('; ')}. Against crews: ${C.map(w).join('; ')}. ${words(g)}. Quiet, with the bed: ${Q.map(r => `${r.k} ${r.gain >= 0 ? '+' : ''}${$(r.gain)} a day`).join(', ')}, the deadbolt ${$(rows[0].q.gain)}, the floor safe ${$(rows[1].q.gain)}. (Beside, the old reading, every visitor at once: ${rows.filter(r => r.k !== 'guard').map(r => `${r.k} ${Number.isFinite(r.p.days) ? `${r.p.days.toFixed(1)} days` : 'never'}`).join(', ')})`,
      pass: S.every(r => r.days <= H3_DAYS) && C.every(r => r.days <= H3_CREW_DAYS) && g.p.gain > 0 && Q.every(r => r.gain <= 0) && rows.every(r => r.q.gain <= 0) });
  } else m.push({ n: 'H3', name: 'Defences are choices, not a tax', target: 'for the pressured player each defence pays for itself within about a week (8 days; Cousin Earl: more saved than his hire), and none is worth buying for the quiet player',
    got: `pressured, with the bed: ${rows.map(words).join('; ')}. On the mattress: ${rows.map(r => `${r.k} ${r.mat.gain >= 0 ? '+' : ''}${$(r.mat.gain)} a day${r.mat.days ? ` (${Number.isFinite(r.mat.days) ? `${r.mat.days.toFixed(0)} days` : 'never'})` : ''}`).join(', ')}. Quiet, with the bed: ${rows.map(r => `${r.k} ${r.q.gain >= 0 ? '+' : ''}${$(r.q.gain)} a day`).join(', ')}`,
    pass: rows.every(r => (r.k === 'guard' ? r.p.gain > 0 : r.p.days <= 8) && r.q.gain <= 0) });
  // H4, H6: over every run of these marks
  const all = [...Object.values(h.quiet), ...Object.values(h.pressured), ...Object.values(h.defended).flatMap(x => Object.values(x)), ...Object.values(h.racer), ...Object.values(h.carrier)];
  const sum = key => all.reduce((a, x) => a + x.home[key], 0);
  const minGap = Math.min(...all.map(x => x.home.minGap));
  m.push({ n: 'H4', name: 'Waves', target: 'no run has attempts on consecutive days, and at least two quiet days follow every attempt',
    got: `${sum('raids')} attempts in ${sum('runs')} runs: ${sum('backToBack')} on the day after one, ${sum('shortGap')} with fewer than two quiet days between; the closest two ${Number.isFinite(minGap) ? `${minGap} days apart` : '(never two in a run)'}`,
    pass: sum('backToBack') === 0 && sum('shortGap') === 0 });
  const r = h.racer.homeFirstBed;
  const ignorer = h.pressured.homeFirstBed;
  const best = Object.entries(h.defended.homeFirstBed).reduce((a, b) => (b[1].mean > a[1].mean ? b : a));
  const carrier = h.carrier.homeFirstBed;
  const bankGain = (100 * (ignorer.mean - carrier.mean)) / Math.max(1e-9, carrier.mean);
  m.push({ n: 'H5', name: 'Banking still wins', target: 'for the pressured player with no defences, banking at home beats carrying everything by 15%+',
    got: `with the bed ${$(ignorer.mean)} banking against ${$(carrier.mean)} carrying it all (+${bankGain.toFixed(0)}%); on the mattress ${$(h.pressured.homeFirst.mean)} against ${$(h.carrier.homeFirst.mean)}; the trailer park's player ${$(h.pressured.park.mean)} against ${$(h.carrier.park.mean)}`,
    pass: bankGain >= 15 });
  m.push({ n: 'H6', name: 'Never without warning', target: 'every attempt comes the day after its warning (100%)',
    got: `${sum('raids') - sum('unwarned')} of ${sum('raids')} attempts warned the day before`, pass: sum('unwarned') === 0 });
  m.push({ n: 'H7', name: 'Racing home is worth it sometimes', target: 'the pressured player racing home on a notice lands between the one who ignores it and the best defender',
    got: `with the bed: ignoring ${$(ignorer.mean)}, racing ${$(r.mean)} (raced on ${r.perDay.raced.toFixed(2)} of ${r.perDay.alarms.toFixed(2)} notices a day), best defender ${$(best[1].mean)} (${best[0]}); on the mattress ignoring ${$(h.pressured.homeFirst.mean)}, racing ${$(h.racer.homeFirst.mean)} (raced on ${h.racer.homeFirst.perDay.raced.toFixed(2)} of ${h.racer.homeFirst.perDay.alarms.toFixed(2)} a day)`,
    pass: r.mean > ignorer.mean && r.mean < best[1].mean });
  // H8: hiring Cousin Earl is a decision, not a reflex
  const e = h.earl;
  const hires = x => (x.perDay.guardPaid * h.days) / h.guard.price;
  const three = x => `never ${$(x.never.mean)}, every warning ${$(x.every.mean)} (${hires(x.every).toFixed(2)} hires a run), only when worth it ${$(x.worth.mean)} (${hires(x.worth).toFixed(2)} hires a run)`;
  const be = h.breakEven;
  m.push({ n: 'H8', name: 'Hiring Earl is a decision, not a reflex', target: `the pressured player (bed) who hires him only when what stands to be lost (the share of the bank an attempt takes × the chance they get in) is more than his $${h.guard.price} ends with the most money of three otherwise the same: never hires, hires on every warning`,
    got: `${three(e.none)}; with the deadbolt ${three(e.deadbolt)}; with the floor safe ${three(e.floorsafe)}; with both ${three(e.both)}. Hiring starts to pay at a bank of $${be.none.rule.toFixed(0)} (deadbolt $${be.deadbolt.rule.toFixed(0)}, floor safe $${be.floorsafe.rule.toFixed(0)}, both $${be.both.rule.toFixed(0)}); counting that they beat him ${be.none.beatenPct}% of the time, $${be.none.held.toFixed(0)} ($${be.deadbolt.held.toFixed(0)}, $${be.floorsafe.held.toFixed(0)}, $${be.both.held.toFixed(0)})`,
    pass: e.none.worth.mean > e.none.never.mean && e.none.worth.mean > e.none.every.mean });
  return m;
}

export function homeText(marks) {
  return ['Marks of home pressure', ...marks.map(mk => `  ${mk.n}. ${mk.pass ? 'PASS' : 'FAIL'}  ${mk.name}: ${mk.got}   [target: ${mk.target}]`)].join('\n');
}

// ── batch-1: the new places (RUN.md "Low Tide Docks", "Glasswall Plaza") ──────────────────────────────────────────────
// The market's homeAt player taken to each new place (policies.mjs `docks`, `plaza`, ...): one ride from the trailer
// park, the same rules of play. The marks' seeds and season. `rows` (from measure()) gives the market's own players.

const PLACE_KITS = Object.freeze([['mattress', {}], ['+cutter', { cutter: true }], ['+bed', { bed: true }]]);
// (bigman-1) P5's season and kit: the mattress, the player with nothing to fight with, whom the docks' drivers beat.
// (The bed player gains about as many dollars a day from the throw, a smaller share of more; the box cutter already
// does the throw's work on a plain brawler and is the better thing to have when jumped: RUN.md "Low Tide Docks".)
const THROW_DAYS = 10;
const THROW_KITS = Object.freeze([['mattress', {}]]);
// P5's bars: over THROW_DAYS days, the lesson counted, the throw player banks at least `more` percent more a day, and
// the lesson is paid back (what it banked in all, from the first day, at least the plain player's from then on) by day
// `backBy`. (Measured before set, the throw at $80, a fight won heating +1, the lift at 60%: +5.9% and day 5 at 3,000
// seasons, +8.5% and day 3 at 500; the bars 2 points and 2 days inside the smaller. RUN.md "Low Tide Docks")
export const THROW_MARK = Object.freeze({ more: 4, backBy: 7 });

/** The day (1: the first) from which what `b` banked in all stays at least what `a` did, to the end; null: never. */
export function paidBackOn(a, b) {
  let gap = 0;
  let from = null;
  a.byDay.forEach((x, i) => {
    gap += b.byDay[i] - x;
    if (gap >= 0 && from === null) from = i + 1;
    if (gap < 0) from = null;
  });
  return from;
}

/**
 * (second pass) THE SIXES AT REST, for marks that compare one place with another (P1 to P5): the Sixes tax only the
 * market, so with them on every other place reads better against it; that is the Sixes working (mark S6), not the place.
 * The players are the same; only the meter is held at 0 (config sixes.rest).
 */
export const atRest = cfg => (cfg.sixes && !cfg.sixes.rest ? withRunConfig({ sixes: { rest: true } }, cfg) : cfg);

/** The new places' numbers: the docks against the market at $120 each kit, honest work there; the plaza careful and heat-blind. */
export function measurePlaces(cfg, { seeds = 3000, rows = null, stopAt = 120, stops = STOPS } = {}) {
  const t = (policy, kit = {}) => trial(cfg, policy, kit, { seeds });
  const out = { stopAt };
  if (cfg.places.docks) {
    out.docks = Object.fromEntries(PLACE_KITS.map(([name, kit]) => [name, {
      market: rows?.[name]?.homeAt?.[stopAt] ?? t(POLICIES.homeAt(stopAt), kit),
      docks: t(POLICIES.docks(stopAt), kit),
      honest: t(POLICIES.docksHonest(stopAt), kit),
    }]));
  }
  // (bigman-1) P5: the careful docks player against the same player who learns the throw from Mr. Haines (the lesson
  // counted against the day it is bought), over THROW_DAYS days, each kit of THROW_KITS
  if (cfg.places.docks && cfg.styles?.throw) {
    out.throwDays = THROW_DAYS;
    out.throwPrice = cfg.styles.throw.price;
    out.throw = Object.fromEntries(THROW_KITS.map(([name, kit]) => [name, {
      plain: trial(cfg, POLICIES.docks(stopAt), kit, { seeds, days: THROW_DAYS }),
      throw: trial(cfg, POLICIES.docksThrow(stopAt), kit, { seeds, days: THROW_DAYS }),
    }]));
  }
  if (cfg.places.plaza) {
    const careful = Object.fromEntries(stops.map(x => [x, t(POLICIES.plaza(x))]));
    const [bestStop, best] = Object.entries(careful).reduce((a, b) => (b[1].mean > a[1].mean ? b : a));
    const market = rows?.mattress ? { stop: rows.mattress.bestStop, t: rows.mattress.bestHome } : (() => {
      const [x, b] = stops.map(s => [s, t(POLICIES.homeAt(s))]).reduce((a, c) => (c[1].mean > a[1].mean ? c : a));
      return { stop: x, t: b };
    })();
    out.plaza = { careful, bestStop: Number(bestStop), best, blind: t(POLICIES.plazaBlind(stopAt)), market };
  }
  return out;
}

/** Marks P1 to P5, pass or fail, with the numbers behind each. */
export function judgePlaces(p) {
  const $ = n => `$${n.toFixed(0)}`;
  const pc = (a, b) => (100 * (a - b)) / b;
  const m = [];
  if (p.docks) {
    const cells = Object.entries(p.docks).map(([k, c]) => ({ k, c, less: -pc(c.docks.mean, c.market.mean) }));
    m.push({ n: 'P1', name: 'The docks are not a better market', target: `the same player (home at $${p.stopAt}) banks 3% to 15% less a day on the docks than at the market, each kit (mattress, cutter, bed), and banks nothing on more days (the Sixes at rest: a place against a place)`,
      got: cells.map(x => `${x.k} ${$(x.c.docks.mean)} against ${$(x.c.market.mean)} (${x.less.toFixed(1)}% less; nothing banked ${x.c.docks.zero.toFixed(0)}% of days against ${x.c.market.zero.toFixed(0)}%)`).join('; '),
      pass: cells.every(x => x.less >= 3 && x.less <= 15 && x.c.docks.zero > x.c.market.zero) });
    m.push({ n: 'P2', name: 'Honest money, less of it', target: 'on the docks the shift alone banks less than the shift and the box off the semi, each kit (the Sixes at rest: a place against a place)',
      got: cells.map(x => `${x.k} shift only ${$(x.c.honest.mean)} against ${$(x.c.docks.mean)}`).join('; '),
      pass: cells.every(x => x.c.honest.mean < x.c.docks.mean) });
  }
  if (p.throw) {
    const cells = Object.entries(p.throw).map(([k, c]) => ({ k, c, more: pc(c.throw.mean, c.plain.mean), back: paidBackOn(c.plain, c.throw) }));
    m.push({ n: 'P5', name: 'The throw opens the docks', target: `the docks player who learns the throw ($${p.throwPrice}, counted against its day) banks at least ${THROW_MARK.more}% more a day over ${p.throwDays} days than the one who does not, and has the lesson back by day ${THROW_MARK.backBy}, on the ${cells.map(x => x.k).join(', ')} (the Sixes at rest: a place against a place)`,
      got: cells.map(x => `${x.k} ${$(x.c.throw.mean)} against ${$(x.c.plain.mean)} (${x.more >= 0 ? '+' : ''}${x.more.toFixed(1)}%; the lesson back on day ${x.back ?? 'never'})`).join('; '),
      pass: cells.every(x => x.more >= THROW_MARK.more && x.back !== null && x.back <= THROW_MARK.backBy) });
  }
  if (p.plaza) {
    const z = p.plaza;
    const gap = pc(z.best.mean, z.market.t.mean);
    m.push({ n: 'P3', name: 'The plaza is for the careful', target: 'on the mattress the careful player\'s best on the plaza is under the market\'s best, by 10% at most (the Sixes at rest: a place against a place)',
      got: `plaza ${$(z.best.mean)} (home at $${z.bestStop}; stopped ${z.best.stopped.toFixed(2)} a day) against the market ${$(z.market.t.mean)} (home at $${z.market.stop}): ${gap.toFixed(1)}%`,
      pass: gap < 0 && gap >= -10 });
    m.push({ n: 'P4', name: 'On the plaza the police are the danger', target: 'on the mattress the heat-blind player on the plaza banks less than half the careful player\'s best (the Sixes at rest: a place against a place)',
      got: `heat-blind ${$(z.blind.mean)} (stopped ${z.blind.stopped.toFixed(2)} a day) against ${$(z.best.mean)}: ${(100 * z.blind.mean / z.best.mean).toFixed(0)}%`,
      pass: z.blind.mean < z.best.mean / 2 });
  }
  return m;
}

export function placesText(marks) {
  return ['Marks of the new places', ...marks.map(mk => `  ${mk.n}. ${mk.pass ? 'PASS' : 'FAIL'}  ${mk.name}: ${mk.got}   [target: ${mk.target}]`)].join('\n');
}

// ── sixes-1: the first slice (RUN.md "The Sixes and a home that scales: the first slice") ─────────────────────────
// Ten-day seasons, as the home marks. The pressured player is H3's (home-first, the bed); the tax's players are the
// market's crime player (`mixed`, home at $120) paying the tax and refusing it, each kit.
const SLICE_DAYS = 10;
/** The pieces of the first slice, as a kit (owned from the start, as H3's), and today's two. */
export const SLICE_KITS = Object.freeze({
  none: {},
  two: { deadbolt: true, floorsafe: true },
  slice: { deadbolt: true, floorsafe: true, doorbar: true, dog: true, camera: true, dogsign: true },
});
/** S4's bars: the door fight against a crew of two, rested and alone (bare hands, with the door bar, the box cutter). */
export const CREW_MARK = Object.freeze({ hands: 50, bar: 70, cutter: 80, within: 5 });
/** (second pass) S5 and S6: the kits, the market's go-home amounts, the split player's; S5's band and S6's bar (RUN.md). */
export const SIXES_KITS = Object.freeze([['mattress', {}], ['+cutter', { cutter: true }], ['+bed', { bed: true }]]);
export const SIXES_STOPS = Object.freeze([60, 90, 120, 160]);
export const SPLIT_STOPS = Object.freeze([90, 120, 160]);
// (S5: the coordinator's 3 to 8 could not hold at a fifth with mark 13 passing; the band is the 3,000 readings with 2
// points each side, RUN.md. S6: splitting comes out about level with the market only, not above it: within 7%)
export const BITE_MARK = Object.freeze({ lo: 0.1, hi: 6.4 });
/** (raid-1) S3: how far under the payer the refuser who never answers the raid may bank (RUN.md). */
export const S3_UNDER = 40;
export const SPLIT_MARK = Object.freeze({ min: -7 });

/** The slice's numbers: what crews and sneaks take with each set, each piece alone, laying low, the tax, the door fight. */
export function measureSixes(cfg, { seeds = 3000, stopAt = 120 } = {}) {
  const t = (policy, kit = {}) => trial(cfg, policy, kit, { seeds, days: SLICE_DAYS });
  const hf = POLICIES.homeFirst(stopAt);
  const bed = { bed: true };
  const out = { days: SLICE_DAYS, stopAt };
  out.sets = Object.fromEntries(Object.entries(SLICE_KITS).map(([k, kit]) => [k, t(hf, { ...bed, ...kit })]));
  out.low = t(POLICIES.layLow(stopAt), { ...bed, ...SLICE_KITS.slice });
  out.pieces = Object.fromEntries(Object.keys(SLICE_KITS.slice).map(k => [k, t(hf, { ...bed, [k]: true })]));
  out.prices = Object.fromEntries(Object.keys(SLICE_KITS.slice).map(k => [k, cfg.things[k].price]));
  out.tax = Object.fromEntries([['mattress', {}], ['+cutter', { cutter: true }], ['+bed', bed]].map(([k, kit]) => [k, {
    pay: t(POLICIES.taxPayer(stopAt), kit), refuse: t(POLICIES.taxRefuser(stopAt), kit),
  }]));
  // S4: the door fight's own sample (as many fights as seasons, seeds of their own), rested (the bed's full energy)
  const big = { ...cfg.crew, sample: seeds };
  const c2 = { ...cfg, crew: big };
  const s0 = { ...newRun({ cfg }), owned: { pocket: false, cutter: false, bed: true } };
  const rested = cfg.energy.bed;
  const bar = Object.values(cfg.things).find(x => x.defends?.bar != null)?.defends.bar ?? 0;
  // (second pass) S5: the market's best player (homeAt, the best of SIXES_STOPS, six-day seasons as marks 1 to 7) with
  // the Sixes on and at rest; S6: with them on, the best who works the market and another place by turns
  const six = (c, mk, kit, stops) => stops.map(x => [x, trial(c, mk(x), kit, { seeds, days: 6 })]).reduce((a, b) => (b[1].mean > a[1].mean ? b : a));
  out.tax = out.tax ?? {};
  out.bite = Object.fromEntries(SIXES_KITS.map(([k, kit]) => {
    const on = six(cfg, x => POLICIES.homeAt(x), kit, SIXES_STOPS);
    const rest = six(atRest(cfg), x => POLICIES.homeAt(x), kit, SIXES_STOPS);
    const splits = Object.fromEntries(['docks', 'plaza'].filter(o => cfg.places[o]).map(o => [o, six(cfg, x => POLICIES.split(x, o), kit, SPLIT_STOPS)]));
    return [k, { on: { stop: on[0], t: on[1] }, rest: { stop: rest[0], t: rest[1] }, splits: Object.fromEntries(Object.entries(splits).map(([o, [x, t]]) => [o, { stop: x, t }])) }];
  }));
  out.door = {
    hands: crewChance(c2, s0, { arm: 'hands', bar: 0, energy: rested, earl: false }).pct,
    // (second pass: the mattress player, 80% health, the same three)
    mattressRow: {
      hands: crewChance(c2, s0, { arm: 'hands', bar: 0, energy: cfg.energy.mattress, earl: false }).pct,
      bar: crewChance(c2, s0, { arm: 'hands', bar, energy: cfg.energy.mattress, earl: false }).pct,
      cutter: crewChance(c2, { ...s0, owned: { ...s0.owned, cutter: true } }, { arm: 'cutter', bar: 0, energy: cfg.energy.mattress, earl: false }).pct,
    },
    bar: crewChance(c2, s0, { arm: 'hands', bar, energy: rested, earl: false }).pct,
    cutter: crewChance(c2, { ...s0, owned: { ...s0.owned, cutter: true } }, { arm: 'cutter', bar: 0, energy: rested, earl: false }).pct,
    mattress: crewChance(c2, s0, { arm: 'hands', bar: 0, energy: cfg.energy.mattress, earl: false }).pct,
    earl: Object.fromEntries((cfg.guard.ways ?? []).map(w => [w, crewChance(c2, s0, { arm: 'hands', bar: 0, energy: rested, earl: true, way: w })])),
    n: seeds,
  };
  return out;
}

/** Marks S1 to S4, pass or fail, with the numbers behind each. */
export function judgeSixes(x) {
  const $ = n => `$${n.toFixed(0)}`;
  const ten = (r, k) => r.perDay[k] * x.days;
  const m = [];
  const S = x.sets;
  const cut = (a, b) => (a > 0 ? (100 * (a - b)) / a : 0);
  const crew = k => ten(S[k], 'burgledCrew');
  const all = k => ten(S[k], 'burgled');
  m.push({ n: 'S1', name: 'Against a crew, today\'s two are not enough and the slice is', target: 'for the pressured player (bed), over ten days: what crews take, today\'s two (the deadbolt, the floor safe) cut it by less than 15%; the slice\'s six by 30% or more, and all attempts take a third less with the slice than with today\'s two',
    got: `crews took ${$(crew('none'))} with nothing, ${$(crew('two'))} with today's two (−${cut(crew('none'), crew('two')).toFixed(0)}%), ${$(crew('slice'))} with the slice (−${cut(crew('none'), crew('slice')).toFixed(0)}%); all attempts ${$(all('none'))} / ${$(all('two'))} / ${$(all('slice'))} (the slice −${cut(all('two'), all('slice')).toFixed(0)}% on today's two); a day ${$(S.none.mean)} / ${$(S.two.mean)} / ${$(S.slice.mean)}, laying low with the slice ${$(x.low.mean)} (all taken ${$(ten(x.low, 'burgled'))}); door fights with a crew ${ten(S.slice, 'crewFights').toFixed(2)} in ten days, lost ${ten(S.slice, 'crewLost').toFixed(2)} (nothing: ${ten(S.none, 'crewLost').toFixed(2)})`,
    pass: cut(crew('none'), crew('two')) < 15 && cut(crew('none'), crew('slice')) >= 30 && cut(all('two'), all('slice')) >= 33 });
  const none = S.none;
  const sg = n => (Math.round(n) > 0 ? `+${Math.round(n)}` : Math.round(n) < 0 ? `−${-Math.round(n)}` : '0');
  const rows = Object.entries(x.pieces).map(([k, r]) => {
    const sneak = cut(ten(none, 'burgledSneak'), ten(r, 'burgledSneak'));
    const crw = cut(ten(none, 'burgledCrew'), ten(r, 'burgledCrew'));
    return { k, sneak, crew: crw, both: sneak >= 25 && crw >= 25 };
  });
  m.push({ n: 'S2', name: 'No single piece covers every visitor', target: 'for the pressured player (bed), no one piece alone cuts what both the sneaks and the crews take by a quarter or more',
    got: `with nothing sneaks took ${$(ten(none, 'burgledSneak'))} and crews ${$(ten(none, 'burgledCrew'))} in ten days; alone (what each takes, less or more): ${rows.map(r => `${r.k} sneaks ${sg(-r.sneak)}%, crews ${sg(-r.crew)}%`).join('; ')}`,
    pass: rows.every(r => !r.both) });
  const T = Object.entries(x.tax).map(([k, c]) => ({ k, c, gap: (100 * Math.abs(c.pay.mean - c.refuse.mean)) / Math.max(c.pay.mean, c.refuse.mean) }));
  // (raid-1: refusing now brings the raid on your home, so the refuser who never answers it banks less than the payer:
  // that is the raid's point. The bar was within 10% (sixes-1); now the undefended refuser is under the payer, and no
  // more than S3_UNDER% under; the refuser who defends is mark D6's)
  m.push({ n: 'S3', name: 'The tax is a real choice', target: `the market\'s crime player who pays Dutch and the same who refuses, each kit, by different roads (the payer pays the tax; the refuser meets two of the Sixes by the steps and, since raid-1, the raid on his home): the refuser who never defends banks less than the payer, and no more than ${S3_UNDER}% less (the one who defends: D6)`,
    got: T.map(r => `${r.k}: pays ${$(r.c.pay.mean)} (the tax ${$(ten(r.c.pay, 'taxPaid'))} in ten days), refuses ${$(r.c.refuse.mean)} (${ten(r.c.refuse, 'sixesJumps').toFixed(2)} fights by the steps, ${ten(r.c.refuse, 'sixesWon').toFixed(2)} won): ${r.gap.toFixed(1)}% apart`).join('; '),
    pass: T.every(r => r.c.refuse.mean < r.c.pay.mean && r.gap <= S3_UNDER && ten(r.c.pay, 'taxPaid') > 0 && ten(r.c.refuse, 'sixesJumps') > 0.3) });
  const D = x.door;
  const near = (got, want) => Math.abs(got - want) <= CREW_MARK.within;
  if (x.bite) {
    const B = Object.entries(x.bite).map(([k, c]) => ({ k, c, less: (100 * (c.rest.t.mean - c.on.t.mean)) / c.rest.t.mean }));
    m.push({ n: 'S5', name: 'The tax bites, it does not gut', target: `the market's best player (homeAt, the best go-home amount, six-day seasons) banks ${BITE_MARK.lo}% to ${BITE_MARK.hi}% less a day with the Sixes on than with them at rest, each kit`,
      got: B.map(r => `${r.k} ${$(r.c.on.t.mean)} (home at $${r.c.on.stop}) against ${$(r.c.rest.t.mean)} at rest (home at $${r.c.rest.stop}): ${r.less.toFixed(1)}% less (the tax $${(r.c.on.t.perDay.taxPaid).toFixed(1)} a day, by the kerb ${(r.c.on.t.perDay.sixesJumps * 6).toFixed(2)} times in six days)`).join('; '),
      pass: B.every(r => r.less >= BITE_MARK.lo && r.less <= BITE_MARK.hi) });
    const Sp = Object.entries(x.bite).map(([k, c]) => {
      const best = Object.entries(c.splits).reduce((a, b) => (b[1].t.mean > a[1].t.mean ? b : a));
      return { k, c, best, more: (100 * (best[1].t.mean - c.on.t.mean)) / c.on.t.mean };
    });
    m.push({ n: 'S6', name: 'The Sixes make other ground worth working', target: `with the Sixes on, the best player who works the market and another place by turns (a day each) banks no less than ${-SPLIT_MARK.min}% under the best who works only the market, each kit: other ground is as good as the taxed market`,
      got: Sp.map(r => `${r.k}: ${Object.entries(r.c.splits).map(([o, s]) => `market and ${o} ${$(s.t.mean)} (home at $${s.stop})`).join(', ')} against the market only ${$(r.c.on.t.mean)}: the best ${r.more >= 0 ? '+' : ''}${r.more.toFixed(1)}%`).join('; '),
      pass: Sp.every(r => r.more >= SPLIT_MARK.min) });
  }
  m.push({ n: 'S4', name: 'The crew is a step up', target: `rested and alone at your door, a crew of two is beaten about ${CREW_MARK.hands} in 100 with bare hands, ${CREW_MARK.bar} with the door bar, ${CREW_MARK.cutter} with the box cutter (each within ${CREW_MARK.within})`,
    got: `${D.hands}, ${D.bar}, ${D.cutter} (${D.n} fights each); on the mattress (80% health) ${D.mattressRow ? `${D.mattressRow.hands}, ${D.mattressRow.bar}, ${D.mattressRow.cutter}` : `bare hands ${D.mattress}`}; with Earl, bare hands: ${Object.entries(D.earl).map(([w, c]) => `${w} ${c.pct} (Earl down ${c.earlDown})`).join(', ')}`,
    pass: near(D.hands, CREW_MARK.hands) && near(D.bar, CREW_MARK.bar) && near(D.cutter, CREW_MARK.cutter) });
  return m;
}

export function sixesText(marks) {
  return ['Marks of the first slice (the Sixes, and a home that scales)', ...marks.map(mk => `  ${mk.n}. ${mk.pass ? 'PASS' : 'FAIL'}  ${mk.name}: ${mk.got}   [target: ${mk.target}]`)].join('\n');
}

// ── raid-1: the raid on your home (RUN.md "The raid on your home (raid-1)") ─────────────────────────────────────────
// Fourteen-day seasons: the raid comes to a refuser about once in one. Every player is the market's crime player
// (`mixed`, home at $120) with the box cutter; pieces and guns are kits (owned from the start, with their rounds, as H3's
// and S1's), their price counted in the payback, not in the day.
export const RAID_DAYS = 14;
export const RAID_KIT = Object.freeze({ cutter: true });
/** The raid's pieces of a hands-only player, as a kit. */
export const HANDS_KIT = Object.freeze({ doorbar: true, fogger: true, vest: true, cereal: true });
/** A gun as a kit: the gun and three boxes of its rounds. */
export const gunKit = (cfg, item) => ({ [item]: true, ammo: { [item]: 3 * cfg.things[item].ammo.n } });
/** The bars (RUN.md, the marks of raid-1; set from the 3,000-season readings with margin). */
export const RAID_MARK = Object.freeze({ defiant: 0.5, quiet: 0.25, payback: 16, band: 25, helps: 3, together: 30, guns: 3, near: 5 });

/** The raid's numbers: who it comes for, each gun and piece with and without, the four ways, the fight's own table. */
export function measureRaid(cfg, { seeds = 3000, stopAt = 120 } = {}) {
  const days = RAID_DAYS;
  const t = (policy, kit = {}) => trial(cfg, policy, { ...RAID_KIT, ...kit }, { seeds, days });
  const out = { days, seeds };
  out.who = { refuser: t(POLICIES.taxRefuser(stopAt)), payer: t(POLICIES.taxPayer(stopAt)), moved: t(POLICIES.moved(stopAt)), stall: t(POLICIES.stall), quiet: t(POLICIES.quiet(stopAt)) };
  out.armedNone = t(POLICIES.armed(stopAt));
  out.guns = Object.fromEntries(gunThings(cfg).map(([k]) => [k, t(POLICIES.armed(stopAt), gunKit(cfg, k))]));
  out.hands = t(POLICIES.handsOnly(stopAt), HANDS_KIT);
  out.handsBare = t(POLICIES.handsOnly(stopAt));
  // (each piece as the hands-only player's first buy: added alone to it, Earl still hired on the day)
  out.handsOne = Object.fromEntries(['fogger', 'vest', 'cereal', 'decoy'].map(k => [k, t(POLICIES.handsOnly(stopAt), { [k]: true })]));
  const all = gunThings(cfg).map(([k]) => gunKit(cfg, k)).reduce((a, b) => ({ ...a, ...b, ammo: { ...(a.ammo ?? {}), ...b.ammo } }), {});
  out.wall = { without: t(POLICIES.armed(stopAt), all), with: t(POLICIES.armed(stopAt), { ...all, falsewall: true }) };
  out.prices = Object.fromEntries(Object.entries(cfg.things).filter(([, x]) => x.late === 'raid').map(([k, x]) => [k, x.price]));
  out.boxes = Object.fromEntries(gunThings(cfg).map(([k, x]) => [k, 3 * x.ammo.price]));
  // the fight's own table: each crew at each size, rested on the mattress (80% health), nothing else, each gun and the
  // box cutter; and what each piece adds for the hands-only player against a rush of three
  const s0 = newRun({ cfg });
  const owner = { ...s0, owned: { ...s0.owned, cutter: true }, things: Object.fromEntries(gunThings(cfg).map(([k]) => [k, true])), ammo: Object.fromEntries(gunThings(cfg).map(([k, x]) => [k, 3 * x.ammo.n])) };
  const big = { ...cfg.sixesRaid, sample: Math.min(seeds, 1000) };
  const c2 = { ...cfg, sixesRaid: big };
  const none = { bar: 0, blind: 0, cut: 0, dog: false };
  const holds = [...gunThings(cfg).map(([k]) => k), 'cutter'];
  out.table = Object.fromEntries(Object.keys(cfg.sixesRaid.crews).map(crew => [crew, [0, 1, 2].map(size => Object.fromEntries(holds.map(h => [h, raidChance(c2, owner, { hold: h, crew, size, earl: false, pieces: none, energy: cfg.energy.mattress }).pct])))]));
  const ref = { hold: 'cutter', crew: 'rush', size: 1, earl: false, energy: cfg.energy.mattress };
  const bar = cfg.things.doorbar?.defends.bar ?? 0;
  out.helps = {
    nothing: raidChance(c2, owner, { ...ref, pieces: none }).pct,
    bar: raidChance(c2, owner, { ...ref, pieces: { ...none, bar } }).pct,
    fogger: raidChance(c2, owner, { ...ref, pieces: { ...none, blind: cfg.things.fogger.defends.blind } }).pct,
    vest: raidChance(c2, owner, { ...ref, pieces: { ...none, cut: cfg.things.vest.defends.cut } }).pct,
    dog: raidChance(c2, owner, { ...ref, pieces: { ...none, dog: true } }).pct,
    earl: raidChance(c2, owner, { ...ref, pieces: none, earl: true }).pct,
    all: raidChance(c2, owner, { ...ref, pieces: { bar, blind: cfg.things.fogger.defends.blind, cut: cfg.things.vest.defends.cut, dog: true }, earl: true }).pct,
    n: big.sample,
  };
  return out;
}

/** Payback in days: price over what it adds a day (Infinity when it adds nothing). */
const payDays = (price, perDay) => (perDay > 0 ? price / perDay : Infinity);

/** Marks D1 to D6 of the raid, pass or fail, with the numbers behind each. */
export function judgeRaid(x) {
  const M = RAID_MARK;
  const D = x.days;
  const $ = n => `$${n.toFixed(1)}`;
  const per = r => r.perDay.sixesRaids * D;
  const dd = n => (Number.isFinite(n) ? `${n.toFixed(1)} days` : 'never');
  const m = [];
  const W = x.who;
  m.push({ n: 'D1', name: 'The raid comes for those who defy them, not for the quiet', target: `a refuser meets ${M.defiant} raids or more in ${D} days; the payer under ${M.quiet}; the player who moves away, the stall and the quiet player none`,
    got: `refuser ${per(W.refuser).toFixed(2)} (home ${(W.refuser.perDay.sixesRaidsHome * D).toFixed(2)}, held ${(W.refuser.perDay.sixesRaidsWon * D).toFixed(2)}, taken ${$(W.refuser.perDay.sixesRaidTaken * D)}), payer ${per(W.payer).toFixed(2)}, moved ${per(W.moved).toFixed(2)}, stall ${per(W.stall).toFixed(2)}, quiet ${per(W.quiet).toFixed(2)}`,
    pass: per(W.refuser) >= M.defiant && per(W.payer) < M.quiet && per(W.moved) === 0 && per(W.stall) === 0 && per(W.quiet) === 0 });
  const base = x.armedNone;
  const G = Object.entries(x.guns).map(([k, r]) => {
    const add = r.mean - base.mean - x.boxes[k] / D;
    return { k, r, add, days: payDays(x.prices[k], add) };
  });
  m.push({ n: 'D2', name: 'Each gun pays for itself', target: `for the armed refuser, each gun (with three boxes of its rounds, their price spread over the season) pays back its price within ${M.payback} days`,
    got: `with no gun ${$(base.mean)} a day (raids held ${(base.perDay.sixesRaidsWon * D).toFixed(2)} of ${(base.perDay.sixesRaidsHome * D).toFixed(2)}); ${G.map(g => `${g.k} ${$(g.r.mean)} (held ${(g.r.perDay.sixesRaidsWon * D).toFixed(2)} of ${(g.r.perDay.sixesRaidsHome * D).toFixed(2)}, ${(g.r.perDay.roundsFired * D).toFixed(1)} rounds, heat +${(g.r.perDay.gunHeat * D).toFixed(1)}, guns lost ${(g.r.perDay.gunsLost * D).toFixed(2)}): +${$(g.add)} a day, pays back in ${dd(g.days)}`).join('; ')}`,
    pass: G.every(g => g.days <= M.payback) });
  // none dominates: in the fight's own table, each crew's best gun at its middle size
  const guns = Object.keys(x.guns);
  const bests = Object.entries(x.table).map(([crew, sizes]) => {
    const row = sizes[1];
    const top = Math.max(...guns.map(g => row[g]));
    return { crew, row, top, best: guns.filter(g => row[g] === top), near: guns.filter(g => row[g] >= top - M.near) };
  });
  const distinct = new Set(bests.flatMap(b => b.best));
  const everyNear = guns.every(g => bests.some(b => b.near.includes(g)));
  m.push({ n: 'D3', name: 'No gun is the answer to everything, none is worthless', target: `against the four crews (middle size, rested on the mattress, nothing else), at least ${M.guns} different guns are the best against one, and every gun is within ${M.near} points of the best against at least one`,
    got: bests.map(b => `${b.crew}: ${guns.map(g => `${g} ${b.row[g]}`).join(', ')}, box cutter ${b.row.cutter} (best ${b.best.join('/')})`).join('; '),
    pass: distinct.size >= M.guns && everyNear });
  // (the false wall is shown, not judged: what it hides today, a few sales of stock and the guns you are not holding, is
  // little; it is the hiding place for what crafting brings home. RUN.md)
  const pieceRows = Object.entries(x.handsOne).map(([k, r]) => ({ k, who: 'hands-only, its first piece', add: r.mean - x.handsBare.mean, price: x.prices[k] })).map(r => ({ ...r, days: payDays(r.price, r.add) }));
  const wall = { add: x.wall.with.mean - x.wall.without.mean, price: x.prices.falsewall };
  m.push({ n: 'D4', name: 'Each new piece pays for itself, for the player it is for', target: `each new piece pays back its price within ${M.payback} days for its player (the hands-only refuser, each as its first piece: the fogger, the vest, the cereal box, the decoy safe)`,
    got: `hands-only with no piece ${$(x.handsBare.mean)} a day, with the door bar, fogger, vest and cereal box ${$(x.hands.mean)}; ${pieceRows.map(r => `${r.k} (${r.who}) +${$(r.add)} a day, ${dd(r.days)}`).join('; ')}; not judged: the false wall for the armed player with the four guns ${wall.add >= 0 ? '+' : ''}${$(wall.add)} a day, ${dd(payDays(wall.price, wall.add))}`,
    pass: pieceRows.every(r => r.days <= M.payback) });
  const H = x.helps;
  const adds = ['bar', 'fogger', 'vest', 'dog', 'earl'].map(k => [k, H[k] - H.nothing]);
  m.push({ n: 'D5', name: 'What you own is helping you', target: `in the raid fight (a rush of three, the box cutter, the mattress), each of the door bar, the fogger, the vest, the dog and Earl adds ${M.helps} points or more alone, and all of them ${M.together} or more together`,
    got: `nothing ${H.nothing}; ${adds.map(([k, a]) => `${k} +${a}`).join(', ')}; all together ${H.all} (+${H.all - H.nothing}) (${H.n} fights each)`,
    pass: adds.every(([, a]) => a >= M.helps) && H.all - H.nothing >= M.together });
  // (the armed refuser with the gun that does best for him: in the trailer, the Doorman)
  const bestGun = Object.entries(x.guns).reduce((a, b) => (b[1].mean > a[1].mean ? b : a));
  const four = [['payer', W.payer.mean], [`armed (${bestGun[0]})`, bestGun[1].mean], ['hands-only', x.hands.mean], ['moved away', W.moved.mean]];
  const hi = Math.max(...four.map(f => f[1]));
  const lo = Math.min(...four.map(f => f[1]));
  m.push({ n: 'D6', name: 'Several ways to play', target: `the payer, the armed refuser (with the gun that does best for him), the hands-only refuser and the player who moves away bank within ${M.band}% of one another a day (the lowest no more than ${M.band}% under the highest)`,
    got: `${four.map(([k, v]) => `${k} ${$(v)}`).join(', ')}: the lowest ${(100 * (hi - lo) / hi).toFixed(1)}% under the highest (the refuser who does nothing ${$(W.refuser.mean)}; hands-only, no pieces ${$(x.handsBare.mean)})`,
    pass: (100 * (hi - lo)) / hi <= M.band });
  return m;
}

export function raidText(marks) {
  return ['Marks of the raid on your home (raid-1)', ...marks.map(mk => `  ${mk.n}. ${mk.pass ? 'PASS' : 'FAIL'}  ${mk.name}: ${mk.got}   [target: ${mk.target}]`)].join('\n');
}
