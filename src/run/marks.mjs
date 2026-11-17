// RUN.md's seven marks, measured on the real engine with the scripted policies (policies.mjs). Free: no model, no
// network. scripts/run-marks.mjs prints them; tuning runs call measure() with withRunConfig(...).

import { POLICIES, playSeason } from './policies.mjs';
import { newRun } from './state.mjs';
import { step } from './step.mjs';
import { deal, placeOf, streetPlaces, guardOf } from './rules.mjs';

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
    warnings: 0, raids: 0, raidsDoor: 0, raidsGuard: 0, raidsTaken: 0, burgled: 0, guardPaid: 0, alarms: 0, raced: 0, pressureSum: 0 };
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
  per.sort((a, b) => a - b);
  const worst = per.slice(0, Math.max(1, Math.floor(n / 10)));
  return {
    mean: per.reduce((a, b) => a + b, 0) / n,
    day1: day1.reduce((a, b) => a + b, 0) / day1.length,
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
  m.push({ n: 'H3', name: 'Defences are choices, not a tax', target: 'for the pressured player each defence pays for itself within about a week (8 days; Cousin Earl: more saved than his hire), and none is worth buying for the quiet player',
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
