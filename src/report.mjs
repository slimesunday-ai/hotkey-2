// report.md (SPEC sections 17 to 19): the marks of a run, in words a person can read.
// Pattern from hotkey mini's report.mjs: one table of marks with pass or fail, then the numbers behind them.

import { botMarks, variantMark, aiMarks } from './stats.mjs';

const tick = pass => (pass === null ? 'for a person' : pass ? 'PASS' : '**FAIL**');

/** The marks table for one lineup's seasons. `seasons` is a list of seasonStats(). */
export function marksTable(cfg, seasons, options = {}) {
  const out = botMarks(cfg, seasons, options);
  const lines = ['| # | Mark | Measured | Wanted | |', '|---:|---|---|---|---|'];
  for (const m of out.marks) lines.push(`| ${m.n} | ${m.name} | ${m.value} | ${m.want} | ${tick(m.pass)} |`);
  return { text: lines.join('\n'), ...out };
}

/** The numbers behind the marks: what each class ended with, and where the money came from and went. */
export function economyTables(extra) {
  const lines = ['| Class | Wins | Mean worth | Median | Mean rank | Points | Clinic hours | Jail hours |', '|---|---:|---:|---:|---:|---:|---:|---:|'];
  for (const [cls, v] of Object.entries(extra.byClass)) lines.push(`| ${cls} | ${v.wins} | $${v.worth} | $${v.median} | ${v.rank} | ${v.points} | ${v.clinic} | ${v.jail} |`);
  const money = side => Object.entries(side).map(([k, v]) => `${k} ${v}`).join(', ');
  const brokeLine = extra.broke ? `\n- Watched, not a pass or fail: seats ending under $50: ${Object.entries(extra.broke).map(([k, v]) => `${k} ${v}%`).join(', ')}.` : '';
  return `${lines.join('\n')}\n\n- Money in, a season: ${money(extra.moneyIn)}.\n- Money out, a season: ${money(extra.moneyOut)}.\n- A season, on average: ${Object.entries(extra.tallies).map(([k, v]) => `${k} ${v}`).join(', ')}.${brokeLine}`;
}

/**
 * The whole report for a bot run.
 * `runs` is a list of { lineup, seeds, seasons } (seasons = seasonStats for each seed). The first is the main lineup.
 */
export function botReport(cfg, runs, { title = 'hotkey 2: bot run', note = '' } = {}) {
  const out = [`# ${title}`, ''];
  if (note) out.push(note, '');
  for (const run of runs) {
    const variant = run.lineup.split(':')[0];
    out.push(`## Lineup \`${run.lineup}\`, ${run.seasons.length} seasons`, '');
    if (variant === 'turtle' || variant === 'grind') {
      const v = variantMark(run.seasons, variant);
      const pass = v.bottomHalfPct >= 70;
      out.push(`The ${variant === 'turtle' ? 'turtle' : 'safe grind'} finished in the bottom half in **${v.bottomHalfPct}%** of ${v.seeds} seeds (wanted: at least 70%). ${tick(pass)}. Mean rank ${v.meanRank}, mean worth $${v.meanWorth}, wins ${v.wins}.`, '');
      continue;
    }
    const skipSeat = variant === 'dead' ? run.seasons[0]?.agents.find(a => a.variant === 'dead')?.seat ?? null : null;
    const table = marksTable(cfg, run.seasons, { skipSeat });
    out.push(table.text, '', economyTables(table.extra), '');
  }
  return out.join('\n');
}

/** The report for an AI season: the AI marks, the spend, and the bot marks' numbers for the same season. */
export function aiReport(cfg, game, seasonStat, { failedTurns = 0, spend = null, title = 'hotkey 2: AI season' } = {}) {
  const out = [`# ${title}`, '', '| # | Mark | Measured | |', '|---|---|---|---|'];
  for (const m of aiMarks(game, { failedTurns })) out.push(`| ${m.n} | ${m.name} | ${m.value} | ${tick(m.pass)} |`);
  out.push('');
  if (spend) out.push(`Spent: $${spend.cost?.toFixed?.(4) ?? spend.cost} over ${spend.calls} calls (${spend.in} tokens in, ${spend.out} out).`, '');
  const table = marksTable(cfg, [seasonStat]);
  out.push('## The same season on the bot marks (one season, so read them as counts)', '', table.text, '', economyTables(table.extra), '');
  return out.join('\n');
}
