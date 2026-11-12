// The marks (SPEC section 18): what one season measured, and what many seasons add up to.
// Pattern from hotkey mini's stats.mjs and the original engine's bench/passbars.mjs: every pass bar is a number with
// a threshold, measured the same way every run.

import { netWorth } from './state.mjs';

const BROKE = 50;

/** Everything the marks need from one finished season. */
export function seasonStats(game) {
  const { cfg, state, feed } = game;
  const days = cfg.season.days;
  const H = cfg.season.hoursPerDay;
  const perDay = Array.from({ length: days }, () => ({ trades: 0, handoffs: 0, playerRobs: 0, npcHits: 0, beats: 0 }));
  const tally = {};
  let quiet = 0;
  let longestQuiet = 0;
  const seatTrouble = new Set();
  // stuck: free, and the hour went on nothing (a rest with no heat to cool, no move, or a move that failed).
  // Hours in the clinic or jail neither count nor break the run: they are the price of losing, not dead air.
  const stuckRun = {};
  const stuckWorst = {};
  const tradedByDay = Array.from({ length: days }, () => new Set());

  for (const line of feed) {
    if (line.type !== 'hour') continue;
    const d = perDay[line.day - 1];
    for (const [k, v] of Object.entries(line.tally)) tally[k] = (tally[k] ?? 0) + v;
    d.trades += line.tally.trades;
    d.handoffs += line.tally.handoffs;
    d.playerRobs += line.tally.robAttempts + line.tally.breakIns;
    d.npcHits += line.tally.npcHits;
    d.beats += line.tally.beats;
    if (line.tally.beats > 0) quiet = 0;
    else {
      quiet += 1;
      longestQuiet = Math.max(longestQuiet, quiet);
    }
    for (const [id, x] of Object.entries(line.agents)) {
      if (x.block === 'jail' || x.block === 'clinic') continue;
      const nothing = !x.move || x.ok === false || (x.move.verb === 'rest' && !/heat down/.test(x.text ?? ''));
      stuckRun[id] = nothing ? (stuckRun[id] ?? 0) + 1 : 0;
      stuckWorst[id] = Math.max(stuckWorst[id] ?? 0, stuckRun[id]);
    }
    for (const e of line.events) {
      if (['rob', 'breakin', 'door', 'fight'].includes(e.kind.split(':')[0])) seatTrouble.add(e.who.robber ?? e.who.attacker);
      if (e.kind === 'pickup' || e.kind === 'pickup:short' || e.kind === 'courier' || e.kind === 'tip:sold' || e.kind === 'job:done') {
        for (const id of Object.values(e.who)) if (state.agents[id]) tradedByDay[line.day - 1].add(id);
      }
    }
  }

  const final = state.final;
  const winner = state.agents[final[0].id];
  const night4 = game.nights[days - 2];
  const leaderDay5 = night4 ? night4.standings[0].id : null;
  // comebacks: who was in the bottom three after night 2
  const night2 = game.nights[1];
  const lowAfterNight2 = night2 ? night2.standings.filter(r => r.rank > night2.standings.length - 3).map(r => r.id) : [];
  const inCrew = id => {
    const crew = state.agents[id].crew ? state.crews[state.agents[id].crew] : null;
    return !!crew && crew.members.length > 1;
  };
  const agents = state.order.map(id => {
    const a = state.agents[id];
    const row = final.find(r => r.id === id);
    return {
      id, cls: a.cls, seat: a.seat, variant: a.variant, lean: a.lean, kind: a.kind, rank: row.rank, worth: row.worth,
      points: a.pointsEarned, inCrew: inCrew(id), stats: a.stats, earnedNpc: a.stats.earnedNpc,
      tradedEveryDay: tradedByDay.every(set => set.has(id)),
      stuck: stuckWorst[id] ?? 0, lowAfterNight2: lowAfterNight2.includes(id),
    };
  });

  return {
    seed: state.seed,
    winner: { id: winner.id, cls: winner.cls, inCrew: inCrew(winner.id), variant: winner.variant },
    leaderDay5Won: leaderDay5 !== null && leaderDay5 === winner.id,
    perDay,
    tally,
    tradesPerDay: (tally.trades ?? 0) / days,
    handoffShare: tally.trades ? tally.handoffs / tally.trades : 0,
    everyDayRobAndNpc: perDay.every(d => d.playerRobs >= 1 && d.npcHits >= 1),
    daysWithRob: perDay.filter(d => d.playerRobs >= 1).length,
    daysWithNpc: perDay.filter(d => d.npcHits >= 1).length,
    robsPerDay: perDay.map(d => d.playerRobs),
    betrayal: (tally.betrayals ?? 0) >= 1,
    longestQuiet,
    crewFormed: (tally.crewsFormed ?? 0) >= 1,
    bossChallengedOrSkimmed: (tally.coups ?? 0) + (tally.skims ?? 0) >= 1,
    breakIn: (tally.breakIns ?? 0) >= 1,
    seatsStartingTrouble: seatTrouble.size,
    agents,
    books: state.books,
    hours: days * H,
  };
}

const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0);
const mean = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
const median = list => {
  if (!list.length) return 0;
  const s = list.slice().sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/**
 * The bot marks over many seasons of one lineup. `only` narrows which agents count (the dead-seat runs leave the
 * dead seat out). Returns { marks: [{ n, name, value, pass, want }], extra }.
 */
export function botMarks(cfg, seasons, { skipSeat = null } = {}) {
  const N = seasons.length;
  const classes = [...new Set(cfg.seats)];
  const seatsOf = cls => cfg.seats.filter(c => c === cls).length;
  const marks = [];
  const mark = (n, name, value, pass, want) => marks.push({ n, name, value, pass, want });

  // 1. every class wins 0.5–1.5× its share of seats
  const wins = Object.fromEntries(classes.map(c => [c, seasons.filter(s => s.winner.cls === c).length]));
  const ratio = Object.fromEntries(classes.map(c => [c, Math.round((100 * (wins[c] / N)) / (seatsOf(c) / cfg.seats.length)) / 100]));
  mark(1, 'every class wins 0.5–1.5× its share of seats', classes.map(c => `${c} ${ratio[c]}`).join(', '), classes.every(c => ratio[c] >= 0.5 && ratio[c] <= 1.5), '0.5–1.5 each');

  // 2. trades between players a day
  const trades = mean(seasons.map(s => s.tradesPerDay));
  mark(2, 'trades between players a day', trades.toFixed(1), trades >= 3, 'at least 3');

  // 3. a player robbery attempt and an NPC hit every day, in 90% of seasons
  const m3 = pct(seasons.filter(s => s.everyDayRobAndNpc).length, N);
  mark(3, 'a player robbery attempt and an NPC hit every day', `${m3}% of seasons (robbery days ${mean(seasons.map(s => s.daysWithRob)).toFixed(1)}/5, NPC days ${mean(seasons.map(s => s.daysWithNpc)).toFixed(1)}/5)`, m3 >= 90, '90% of seasons');

  // 4. a betrayal in 70% of seasons
  const m4 = pct(seasons.filter(s => s.betrayal).length, N);
  mark(4, 'at least one betrayal', `${m4}% of seasons`, m4 >= 70, '70% of seasons');

  // 5. the leader going into day 5 wins 30–60% of the time
  const m5 = pct(seasons.filter(s => s.leaderDay5Won).length, N);
  mark(5, 'the leader at the start of day 5 wins', `${m5}% of seasons`, m5 >= 30 && m5 <= 60, '30–60%');

  // 6. nobody is stuck: finishing poor is fine, having nothing to do is not (slime's call, 2026-11-11)
  const live = seasons.flatMap(s => s.agents.filter(a => a.seat !== skipSeat && a.variant !== 'dead'));
  const STUCK_HOURS = 4;
  const unstuck = pct(live.filter(a => a.stuck <= STUCK_HOURS).length, live.length);
  const stuckBy = Object.fromEntries(classes.map(c => {
    const all = live.filter(a => a.cls === c);
    return [c, pct(all.filter(a => a.stuck > STUCK_HOURS).length, all.length)];
  }));
  mark(6, `nobody is stuck: no seat goes more than ${STUCK_HOURS} hours in a row with nothing useful to do`, `${unstuck}% of seats (stuck longer: ${classes.map(c => `${c} ${stuckBy[c]}%`).join(', ')})`, unstuck >= 90, '90% of seats');

  // 16. comebacks happen
  const low = live.filter(a => a.lowAfterNight2);
  const half = seasons[0] ? seasons[0].agents.length / 2 : 5;
  const cameBack = pct(low.filter(a => a.rank <= half).length, low.length);
  const lowWins = pct(low.filter(a => a.rank === 1).length, low.length);
  mark(16, 'comebacks happen: a seat in the bottom three after night 2 finishes in the top half', `${cameBack}% of them (${lowWins}% go on to win)`, cameBack >= 25, 'at least 1 in 4');

  // watched, not a pass or fail: how many seats of each class end under $50
  const broke = Object.fromEntries(classes.map(c => {
    const all = live.filter(a => a.cls === c);
    return [c, pct(all.filter(a => a.worth < BROKE).length, all.length)];
  }));

  // 7. the longest stretch with no big beat
  const worstQuiet = Math.max(...seasons.map(s => s.longestQuiet));
  const m7 = pct(seasons.filter(s => s.longestQuiet <= 3).length, N);
  mark(7, 'never more than 3 hours without a big beat', `${m7}% of seasons hold it (worst stretch ${worstQuiet} hours, usual ${median(seasons.map(s => s.longestQuiet))})`, m7 >= 95, '3 hours or less');

  // 8. crews form, and bosses fall
  const m8a = pct(seasons.filter(s => s.crewFormed).length, N);
  const m8b = pct(seasons.filter(s => s.bossChallengedOrSkimmed).length, N);
  mark(8, 'a crew forms; a boss is challenged or a pot skimmed', `${m8a}% and ${m8b}% of seasons`, m8a >= 60 && m8b >= 25, '60% and 25%');

  // 10. crews don't crush loners
  const crewSeats = seasons.reduce((sum, s) => sum + s.agents.filter(a => a.inCrew).length, 0);
  const loneSeats = seasons.reduce((sum, s) => sum + s.agents.filter(a => !a.inCrew).length, 0);
  const crewWins = seasons.filter(s => s.winner.inCrew).length;
  const crewRatio = crewSeats ? Math.round((100 * (crewWins / crewSeats)) / (1 / cfg.seats.length)) / 100 : 0;
  const loneRatio = loneSeats ? Math.round((100 * ((N - crewWins) / loneSeats)) / (1 / cfg.seats.length)) / 100 : 0;
  mark(10, "crews don't crush loners", `in a crew ${crewRatio}× their share, in none ${loneRatio}×`, crewRatio >= 0.5 && crewRatio <= 1.5 && loneRatio >= 0.5 && loneRatio <= 1.5, '0.5–1.5 each');

  // 11. a break-in in 70% of seasons
  const m11 = pct(seasons.filter(s => s.breakIn).length, N);
  mark(11, 'at least one break-in', `${m11}% of seasons`, m11 >= 70, '70% of seasons');

  // 12. people meet
  const m12 = pct(seasons.reduce((sum, s) => sum + (s.tally.handoffs ?? 0), 0), seasons.reduce((sum, s) => sum + (s.tally.trades ?? 0), 0));
  mark(12, 'people meet: trades that are hand-offs on a shared block', `${m12}%`, m12 >= 50, 'at least half');

  // 15. points
  const points = seasons.flatMap(s => s.agents.filter(a => a.variant !== 'dead').map(a => a.points));
  const most = Math.max(...points);
  mark(15, 'skill points over a season, the 2 starting ones included', `median ${median(points)}, most ${most}`, median(points) >= 8 && median(points) <= 11 && most <= 14, 'median 8–11, nobody over 14');

  // ---- extra numbers for tuning
  const byClass = Object.fromEntries(classes.map(c => {
    const all = seasons.flatMap(s => s.agents.filter(a => a.cls === c));
    return [c, {
      worth: Math.round(mean(all.map(a => a.worth))), median: Math.round(median(all.map(a => a.worth))), rank: Math.round(10 * mean(all.map(a => a.rank))) / 10,
      points: Math.round(10 * mean(all.map(a => a.points))) / 10, idle: Math.round(10 * mean(all.map(a => a.stats.idle))) / 10,
      clinic: Math.round(10 * mean(all.map(a => a.stats.clinicHours))) / 10, jail: Math.round(10 * mean(all.map(a => a.stats.jailHours))) / 10,
      wins: wins[c],
    }];
  }));
  const sumBooks = side => {
    const out = {};
    for (const s of seasons) for (const [k, v] of Object.entries(s.books[side])) out[k] = (out[k] ?? 0) + v;
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round(v / N)]).sort((a, b) => b[1] - a[1]));
  };
  const tallies = {};
  for (const s of seasons) for (const [k, v] of Object.entries(s.tally)) tallies[k] = (tallies[k] ?? 0) + v;
  for (const k of Object.keys(tallies)) tallies[k] = Math.round((10 * tallies[k]) / N) / 10;

  marks.sort((a, b) => a.n - b.n);
  return { seasons: N, marks, extra: { byClass, broke, moneyIn: sumBooks('in'), moneyOut: sumBooks('out'), tallies, meanWorth: Math.round(mean(seasons.flatMap(s => s.agents.map(a => a.worth)))) } };
}

/** How one swapped seat (a turtle, a safe grind) finished: the share of seeds it ended in the bottom half. */
export function variantMark(seasons, variant) {
  const rows = seasons.map(s => s.agents.find(a => a.variant === variant)).filter(Boolean);
  const half = seasons[0] ? seasons[0].agents.length / 2 : 5;
  const bottom = rows.filter(a => a.rank > half).length;
  return { seeds: rows.length, bottomHalfPct: pct(bottom, rows.length), meanRank: Math.round(10 * mean(rows.map(a => a.rank))) / 10, meanWorth: Math.round(mean(rows.map(a => a.worth))), wins: rows.filter(a => a.rank === 1).length };
}

/** The AI marks, measured on one all-AI season (SPEC section 18, A1 to A4; A5 and A6 are people's). */
export function aiMarks(game, { failedTurns = 0 } = {}) {
  const s = seasonStats(game);
  const ai = s.agents.filter(a => a.kind === 'ai');
  const journals = game.state.order.flatMap(id => game.state.agents[id].kind === 'ai' ? game.state.agents[id].journals : []);
  const lookBack = journals.filter(j => j.day >= 2 && /yesterday|last night|earlier|again|still|since|day [1-4]\b|back when|before/i.test((j.lines ?? []).join(' '))).length;
  const later = journals.filter(j => j.day >= 2).length;
  return [
    { n: 'A1', name: 'every AI seat trades with another player every day', value: `${ai.filter(a => a.tradedEveryDay).length} of ${ai.length} seats`, pass: ai.length > 0 && ai.every(a => a.tradedEveryDay) },
    { n: 'A2', name: 'at least 6 seats start trouble, and 2 or more player robberies or break-ins a day', value: `${s.seatsStartingTrouble} seats; per day ${s.robsPerDay.join(', ')}`, pass: s.seatsStartingTrouble >= 6 && s.robsPerDay.every(n => n >= 2) },
    { n: 'A3', name: 'at least half the journals refer back to an earlier day', value: `${lookBack} of ${later} (a word count: a person should read them)`, pass: later > 0 && lookBack * 2 >= later },
    { n: 'A4', name: 'no failed turns', value: `${failedTurns} failed`, pass: failedTurns === 0 },
    { n: 'A5', name: 'a fresh viewer scores the episode page 7 or better out of 10', value: 'a person scores this', pass: null },
    { n: 'A6', name: 'slime reads the episode page and wants to watch another season', value: "slime's call", pass: null },
  ];
}

export { netWorth };
