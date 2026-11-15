// RUN.md's seven marks, measured on the real engine with the scripted policies (policies.mjs). Free: no model, no
// network. scripts/run-marks.mjs prints them; tuning runs call measure() with withRunConfig(...).

import { POLICIES, playSeason } from './policies.mjs';
import { newRun } from './state.mjs';
import { step } from './step.mjs';
import { deal, placeOf, streetPlaces } from './rules.mjs';

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
  const more = { robbed: 0, rough: 0, door: 0, fights: 0, robs: 0, bins: 0, drinks: 0 };
  for (let s = firstSeed; s < firstSeed + seeds; s++) {
    const r = playSeason(cfg, { seed: s, policy, kit, days });
    per.push(...r.takes);
    jumped += r.tally.jumped; bad += r.tally.bad; stopped += r.tally.stopped;
    earned += r.tally.earned; lost += r.tally.lost; trips += r.tally.trips;
    for (const k of Object.keys(more)) more[k] += r.tally[k];
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
