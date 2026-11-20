// WHO IS UNDER WHAT, UNTIL WHEN (pot-1, RUN.md "The pot (pot-1)"; the addition's G3.2: "an effect on a person does not
// care where it came from"). A person under an effect is a row of `state.under[id]`: the effect, the hour it starts and
// the hour it ends (the run's clock: day × 24 + hour), the place, and what put it there (`by`: the maker, the carrier,
// the product, the good). A bag sold today, a bottle thrown or a round fired tomorrow write the same row. What an effect
// does is config make.effects: to the person (`person`) and to the place while anyone there is under it (`place`).
// No imports from rules.mjs: rules.mjs reads these (the place's heat, who tells, the jumping chance).

/** The run's clock: the day and the hour as one number (an hour past midnight is still that day's: hour 25). */
export const clockOf = (state, day = state.day, hour = state.hour) => day * 24 + hour;
/** A clock as the day and the hour of that day's own count (the clock text wraps at 24). */
export const clockAt = t => {
  // (a day starts at noon, so an hour from 0 to 11 on the clock is the night of the day before: hour 24 to 35)
  let day = Math.floor(t / 24);
  let hour = t - day * 24;
  if (hour < 12) { day -= 1; hour += 24; }
  return { day, hour, clock: `${String(hour % 24).padStart(2, '0')}:00` };
};

/** Every row a person has (an older saved state: none). */
export const rowsOf = (state, id) => state.under?.[id] ?? [];
/** A row is on at `t`: it has started and not yet ended. */
export const rowOn = (row, t) => row.from <= t && t < row.until;

/** The effects a person is under now (or at `t`): their rows that are on, the soonest to end first. */
export function underNow(state, id, t = clockOf(state)) {
  return rowsOf(state, id).filter(r => rowOn(r, t)).sort((a, b) => a.until - b.until);
}

/** Everyone under something now (or at `t`) at a place: [{ id, rows }]. */
export function underHere(state, place, t = clockOf(state)) {
  return Object.keys(state.under ?? {}).map(id => ({ id, rows: underNow(state, id, t).filter(r => r.place === place) })).filter(x => x.rows.length);
}

/**
 * What the effects on the people at a place do to it now: `noTell` (nobody there tells on you: the effects that say so,
 * by name), `jumpPct` (the jumping chance there, in percent of itself: the lowest any effect says), `heat` (the place
 * is this much hotter while it lasts: the most any effect says). Read by rules.mjs tellRisk, danger, placeHeat.
 */
export function placeEffects(cfg, state, place, t = clockOf(state)) {
  const E = cfg.make?.effects ?? {};
  const out = { noTell: [], jumpPct: 100, heat: 0, by: [] };
  for (const { id, rows } of underHere(state, place, t)) {
    for (const r of rows) {
      const P = E[r.effect]?.place;
      if (!P) continue;
      if (P.noTell && !out.noTell.includes(r.effect)) out.noTell.push(r.effect);
      if (P.jumpPct != null) out.jumpPct = Math.min(out.jumpPct, P.jumpPct);
      if (P.heat) out.heat = Math.max(out.heat, P.heat);
      out.by.push({ id, effect: r.effect });
    }
  }
  return out;
}

/**
 * The heat a place's effects add now, from the rows alone (each row carries its effect's `heat` and the heat's top when
 * it was written, so rules.mjs placeHeat needs no config): the most of them.
 */
export function heatFromRows(state, place, t = clockOf(state)) {
  let n = 0;
  let top = Infinity;
  if (!state.under) return { n, top };
  for (const rows of Object.values(state.under)) for (const r of rows) if (r.place === place && r.heat && rowOn(r, t)) { n = Math.max(n, r.heat); top = Math.min(top, r.heatTop ?? Infinity); }
  return { n, top };
}

/**
 * A product's effects as rows on a person, from `t`: each effect of the product in its turn (`at`: hours after the
 * first, the mixing rule's), for its hours. `by` says what put them there. The place's heat for an effect that heats
 * a place is copied in (`heat`), and the bad thing of a dirty batch is its own row.
 */
export function rowsFor(cfg, effects, t, place, by) {
  const E = cfg.make.effects;
  return effects.map(e => ({ effect: e.effect, from: t + (e.at ?? 0), until: t + (e.at ?? 0) + (e.hours ?? E[e.effect].hours), place, by: { ...by },
    ...(E[e.effect]?.place?.heat ? { heat: E[e.effect].place.heat, heatTop: cfg.heat.max } : {}) }));
}

/** Rows that have ended by `t` dropped (the morning's sweep): a person with none left is gone from `under`. */
export function sweepRows(state, t = clockOf(state)) {
  const out = {};
  for (const [id, rows] of Object.entries(state.under ?? {})) {
    const left = rows.filter(r => r.until > t);
    if (left.length) out[id] = left.map(r => ({ ...r, by: { ...r.by } }));
  }
  return out;
}

/**
 * THE SMELL'S LEVEL (pot-1; make.mjs smellOf says it in words): on any day you cooked and the day after, the most cooks
 * of a day among them (make.smell `perCook` each, at most `max`), less each fan's `smellOff` (owned, not knocked out).
 * `cooking`: one cook more today. → { level, raw, cooks, off, fans }.
 */
export function smellLevel(cfg, state, { day = state.day, cooking = 0 } = {}) {
  const S = cfg.make?.smell;
  if (!S) return { level: 0, raw: 0, cooks: 0, off: 0, fans: [] };
  let cooks = 0;
  for (const m of Object.keys(cfg.make.makers ?? {})) {
    // (bench-1: packing bottles does not smell: a maker with `smells: false`)
    if (cfg.make.makers[m].smells === false) continue;
    const c = state.make?.[m]?.cooked ?? {};
    for (let d = day - (S.days ?? 2) + 1; d <= day; d++) cooks = Math.max(cooks, (c[d] ?? 0) + (d === day ? cooking : 0));
  }
  const raw = Math.min(S.max ?? 2, cooks * (S.perCook ?? 1));
  const fans = Object.entries(cfg.things ?? {}).filter(([k, t]) => t.smellOff && state.things?.[k] && !((state.home?.out?.[k] ?? 0) >= state.day)).map(([k]) => k);
  const off = fans.reduce((a, k) => a + cfg.things[k].smellOff, 0);
  return { level: Math.max(0, raw - off), raw, cooks, off, fans };
}
