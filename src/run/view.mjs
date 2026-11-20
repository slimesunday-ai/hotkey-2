// What the player sees, as plain data a UI can draw without knowing any rule: where you are, what you carry and
// own, the three dealt options with their odds, pay, cost and who they could be done to, the ways to move, the shops,
// the locked corner, the danger of the hour you are in and the one after it, the people of each place with today's
// mood, each place's heat, police and supply, someone at your door, and whether where you are has been worked dry.
// Every odds number comes from rules.mjs, the same functions the engine rolls with. listChoices() is also what
// step() checks a choice against. No rule here names a place: each reads the place's entry.

import {
  danger, deal, jobOdds, jobPay, isTired, fullEnergy, fareFor, ITEMS, peopleOf, namedLabel, whoOf, isDry, placeOf, tierOf,
  homeId, streetOf, streetPlaces, heatHere, placeHeat, isHot, policeAbout, stopChance, supplyLeft, robOdds, binsFinds,
  shopOf, foodToday, isFood, soldTo, cap, tellRisk, jobTrust, canHeat, withUp, offText,
  goodsOn, goodsHome, someGoods, goodsWorth, goodsText, perSale, connectOf, connectFor, thingsAt, jobPool,
  isStop, routesFrom, wayHours, wayNeeds, wayDanger, canGo, cardOf,
  homeStreet, atHome, homeOf, pressureOf, warnChance, restUntil, defencesOf, raidTakes, doorContest, guardOf, marksTotal,
  fightsOnFail, doorFights, duelOf, duelChance,
  fightsNow, fears, markOn, marksOf, pronouns,
  armOf, armsOf, armLabel, knows, taughtAt, sentFor,
  defVal, defBy, dogOf, raidKind, earlWayOf, earlWayWords, crewOdds, sixesOf, sixesStateOf, sixesGround, sixesJob, taxOf,
  taxPctOf, personOf,
} from './rules.mjs';
import { gunsOf, gunThings, gunWords, holdsOf, holdOf, holdLabel, roundsOf, stakeOf, crewFoes, raidChance, homeWorth, raidAtOf, thingsAtRisk, hiddenOf } from './raid.mjs';
import { libraryOf, thingOf, shelvesHere, shelvesOn, libraryView } from './library.mjs';
import { aheadOf } from './ahead.mjs';

const money = ([lo, hi]) => (lo === hi ? `$${lo}` : `$${lo}–${hi}`);
const signed = n => (n > 0 ? `+${n}` : `−${-n}`);
const whereOf = (cfg, id) => placeOf(cfg, id).where ?? `at ${placeOf(cfg, id).label}`;
const bandText = (cfg, band) => cfg.trust.bands[band] ?? band;

/**
 * The chance of being told on for a move here that could heat the place (or is low): who here is against you and
 * about this hour, each tellPct, one roll; and the heat a call puts on the place. `pct` 0 and `by` empty: nobody would.
 */
function riskOfTelling(cfg, state) {
  const t = tellRisk(cfg, state);
  const names = t.by.map(p => p.name).join(' and ');
  return { ...t, text: t.pct ? `${t.pct}% ${names} ${t.by.length > 1 ? 'call' : 'calls'} it in (heat +${t.heat} here)` : null };
}

/** How a move here would move the pressure at home ({ ifWin, ifFail }), on the home's street only (null elsewhere). */
function pressureMove(cfg, state, p, sure = false) {
  if (!p || !cfg.pressure || state.place !== homeStreet(cfg)) return null;
  const win = p.win ?? 0;
  const fail = sure ? 0 : p.fail ?? 0;
  return win || fail ? { ifWin: win, ifFail: fail } : null;
}

/**
 * A FIGHT AS A CARD SAYS IT (duel-1): what going wrong means with `who`, a fight, and how it would go: the share you win
 * of the config's sample of the very same fight (rules.mjs duelChance), what each of you brings and why, and what it
 * costs, won or lost. `costs` the energy each way (a job's: the fight's cost; the door's: the regular's hurt).
 */
function fightView(cfg, state, who, costs = cfg.duel.cost, plus = 0) {
  const d = duelOf(cfg, state, who, state.energy, plus);
  const c = duelChance(cfg, state, who, state.energy, plus);
  // (styles-1: what you fight with, and the same fight with each other thing you own: { arm: pct })
  const arms = armsOf(cfg, state);
  const byArm = Object.fromEntries(arms.map(a => [a, a === d.you.arm ? c.pct : duelChance(cfg, state, who, state.energy, plus, { arm: a }).pct]));
  return {
    pct: c.pct, in10: c.in10, n: c.n,
    you: { arm: d.you.arm, weapon: d.you.label, hp: d.you.hp, max: d.you.max, pct: d.you.pct, why: d.you.why, text: d.you.text },
    them: { id: d.them.id, name: d.them.name, hp: d.them.hp, tough: d.them.tough, style: d.them.style, says: d.them.says, why: d.them.why, text: d.them.text },
    byArm,
    costs: { ...costs },
    text: `a fight: ${c.text}`,
  };
}

/** A person's trust as a card shows it: the number, its band, the days off your table. */
const trustOfPerson = (cfg, p) => ({ trust: p.trust ?? 0, band: p.band ?? 'neutral', bandText: bandText(cfg, p.band ?? 'neutral'), offDays: p.offDays ?? 0 });

function jobEntry(cfg, state, job, tell = riskOfTelling(cfg, state)) {
  const odds = jobOdds(cfg, state, job);
  const energy = cfg.energy.perHour;
  const why = state.energy < energy ? 'no energy left' : null;
  const ifWin = job.winHeat ? `heat ${signed(job.winHeat)}` : null;
  // (duel-1: gone wrong to their face, a fight: its odds and costs said on the line, not a hidden roll)
  const fights = !!job.who && !odds.sure && fightsNow(cfg, state, job);
  const fight = fights ? fightView(cfg, state, job.who) : null;
  // (memory-1: done to somebody who fears you, the card says so: they pay up, or they will not fight back)
  const scared = !!job.who && fears(cfg, state, job.who.id);
  const fear = scared ? { text: odds.feared ? 'fears you: pays up' : 'fears you', sure: !!odds.feared } : null;
  // (bigman-1: a job whose fight won heats less, `wonHeat`, says each way's heat in the fight's own words)
  const wonHeat = fight && job.wonHeat != null ? job.wonHeat : null;
  const heatOf = n => (n ? `heat ${signed(n)}, ` : '');
  const fails = wonHeat !== null
    ? [`${fight.text} (won: paid, ${heatOf(wonHeat)}energy −${fight.costs.win}; lost: ${heatOf(job.failHeat ?? 0)}energy −${fight.costs.lose})`]
    : [job.failHeat ? `heat ${signed(job.failHeat)}` : null, fight ? `${fight.text} (won: paid, energy −${fight.costs.win}; lost: energy −${fight.costs.lose})` : job.failEnergy ? `energy ${signed(-job.failEnergy)}` : null].filter(Boolean);
  const moves = jobTrust(job);
  const friend = withUp(cfg, state.place, job.who);
  return {
    id: job.id,
    label: namedLabel(job),
    who: job.who ? whoOf(job.who) : null, // the person it is done to or with
    mood: job.who?.mood ?? null, // their mood now (calm, or friendly if you have already worked for them today)
    // who it could be done to instead (the dealt one first): name one as { do: 'job', id, who: id }
    targets: (job.targets ?? []).map(p => ({ ...whoOf(p), mood: p.mood, ...(p.regular ? { regular: true } : {}), ...trustOfPerson(cfg, p), withPay: withUp(cfg, state.place, p),
      ...(fightsNow(cfg, state, job, p) && !jobOdds(cfg, state, { ...job, who: p }).sure ? { fight: fightView(cfg, state, p) } : {}), ...(fears(cfg, state, p.id) ? { fears: true } : {}) })),
    // (memory-1) the person fears you: { text: 'fears you: pays up' | 'fears you', sure }; null otherwise
    fear,
    // their trust in you now and how this job would move it (win, fail); with you, the pay above includes withPay
    trust: job.who ? { ...trustOfPerson(cfg, job.who), ifWin: moves.win, ifFail: odds.sure ? 0 : moves.fail } : null,
    withPay: friend,
    // a selling job: the good it would use (one sale's worth, win or lose), what a sale of it cost you, and what is left
    // on you after; and every good you carry that it takes, with its pay here (name one as { do: 'job', id, good })
    uses: job.good ? { good: job.good, label: cfg.goods[job.good].label, n: 1, cost: perSale(cfg, job.good), carried: goodsOn(state, job.good), left: goodsOn(state, job.good) - 1, home: goodsHome(state, job.good) } : null,
    goodsHere: (job.goodsHere ?? []).map(x => ({ good: x.good, label: x.label, pay: x.pay, cost: x.cost, carried: x.carried, choice: { do: 'job', id: job.id, good: x.good } })),
    // the chance someone here against you calls it in, if it heats the place (null: it cannot be told on)
    tellRisk: canHeat(job) ? tell : null,
    // on the street your crib opens onto: how it would move the pressure at home, win and fail (null elsewhere, or none)
    pressure: pressureMove(cfg, state, job.pressure, odds.sure),
    odds: odds.pct,
    sure: odds.sure,
    oddsWhy: odds.why,
    pay: jobPay(cfg, state, job),
    ifWin,
    ifFail: odds.sure ? null : fails.length ? fails.join(', ') : 'nothing',
    winHeat: job.winHeat ?? 0,
    failHeat: job.failHeat ?? 0,
    // (bigman-1) gone wrong and the fight won, the heat instead of failHeat (null: the same either way)
    wonHeat,
    failEnergy: fight ? fight.costs.lose : job.failEnergy ?? 0,
    // (duel-1) gone wrong, a fight with them: { pct, in10, n, you, them, costs, text }; null when it is not one
    fight,
    energy,
    safe: !!job.safe,
    available: !why,
    why: why ?? (odds.sure ? 'always safe' : `${odds.pct}% to get ${money(jobPay(cfg, state, job))}`),
    choice: { do: 'job', id: job.id },
  };
}

/**
 * The ways out of a place along its links: the fare, the turnstile, or locked. A link marked `late` (batch-1: the
 * trailer park's rides to the places added after the market) is listed after every older move, so their keys stay.
 */
function rides(cfg, state, add, late = false) {
  const s = cfg.subway;
  const from = state.place;
  const hour = cfg.energy.perHour;
  const noEnergy = state.energy < hour ? (placeOf(cfg, from).door ? 'no energy left' : 'no energy left: sleep rough here, or buy a drink') : null;
  for (const [to, link] of Object.entries(placeOf(cfg, from).links ?? {})) {
    if (!!link.late !== late) continue;
    const dest = placeOf(cfg, to);
    if (dest.locked) {
      add(`Take the subway to ${dest.label}`, { do: 'subway', to, hop: false }, dest.locked, { kind: 'move', locked: true, to });
      continue;
    }
    const { fare, canPay } = fareFor(cfg, state, link);
    const energy = link.energy ?? hour;
    const hops = { caught: s.hopCaughtPct, heat: s.hopHeat };
    if (dest.door) {
      // home: the hour you leave is still an hour here
      const ride = { kind: 'move', hours: link.hours ?? s.hours, energy, to, home: true };
      add(`Head home ($${fare} fare)`, { do: 'subway', to, hop: false }, noEnergy ?? (canPay ? null : `you carry $${state.carried}: hop`), { ...ride, fare });
      add(`Head home, hop the turnstile (${s.hopCaughtPct}% caught: heat +${s.hopHeat})`, { do: 'subway', to, hop: true }, noEnergy, { ...ride, fare: 0, hop: hops });
    } else {
      // away from home: enough energy to get there and back
      const need = cfg.energy.rideBack + energy;
      const tooTired = state.energy < need ? `you need energy ${need} to get there and back` : null;
      const ride = { kind: 'move', hours: link.hours ?? s.hours, energy, to };
      const short = placeOf(cfg, from).door ? 'step inside for the fare, or hop' : 'hop';
      add(`Take the subway to ${dest.label} ($${fare})`, { do: 'subway', to, hop: false },
        tooTired ?? (canPay ? null : `you carry $${state.carried}: ${short}`), { ...ride, fare });
      add(`Take the subway to ${dest.label}, hop the turnstile (${s.hopCaughtPct}% caught: heat +${s.hopHeat})`,
        { do: 'subway', to, hop: true }, tooTired, { ...ride, fare: 0, hop: hops });
    }
  }
}

// ── routes (RUN.md, "Routes") ──────────────────────────────────────────────────────────────────────────────────────
/** The legs still ahead from `from` through `stops` to `to`: [{ from, to }]. */
const legsOf = (from, stops, to) => [from, ...stops].map((p, i, all) => ({ from: p, to: all[i + 1] ?? to }));

/**
 * A way's danger as the page's meter reads it: the chance of being jumped (bad, scuffle) or stopped on the rest of
 * the way at what you carry now, what each would take of cash and goods, and each leg's own numbers.
 */
function wayRisk(cfg, state, way, legs) {
  const d = wayDanger(cfg, state, way, legs);
  const goods = someGoods(state.goods);
  const worth = goodsWorth(cfg, goods);
  const ground = [...new Set(d.legs.filter(l => l.rolls).map(l => l.ground))];
  const on = `$${state.carried}${worth ? ` and ${goodsText(cfg, goods)} (worth $${worth})` : ''}`;
  const text = !d.jump.chance && !d.stop.chance ? `Nothing acts on you on the way (on you: ${on}).`
    : [`On the way, carrying ${on}:`, d.jump.chance ? `${d.jump.chance}% jumped (${d.jump.bad}% a bad one: $${d.jump.takes.bad}${Object.keys(d.jump.takesGoods.bad).length ? ` and ${goodsText(cfg, d.jump.takesGoods.bad)}` : ''}, and the clinic; ${d.jump.scuffle}% a scuffle: $${d.jump.takes.scuffle})` : null,
      d.stop.chance ? `${d.stop.chance}% stopped by the police (all of it)` : null].filter(Boolean).join(' ') + `${ground.length ? `, crossing ${ground.map(g => placeOf(cfg, g).label).join(' and ')}` : ''}.`;
  return { ...d, atStake: { cash: state.carried, goods, worth }, text };
}

/** What a stop could deal, for a planner: each card with its odds, pay and what it takes (the hand is drawn from these). */
function cardsOf(cfg, stop) {
  return Object.entries(placeOf(cfg, stop).cards ?? {}).map(([id, c]) => ({
    id, label: c.label, with: c.with ?? null, odds: c.street ? null : c.odds, pay: c.street ? null : c.pay ?? null, goodsPay: c.goodsPay ?? null,
    finds: c.street === 'bins' ? binsFinds(cfg, stop) : null, failHeat: c.failHeat ?? 0, energy: cfg.energy.perHour, hours: 1, perDay: c.perDay ?? 1,
  }));
}

/** A card of the hand as the page shows it: odds, pay (or the bins' finds), what a sale uses, the energy, what it pays an energy on average. */
function cardEntry(cfg, state, stop, c) {
  const energy = cfg.energy.perHour;
  const why = state.energy < energy ? 'no energy left: walk on' : null;
  if (c.street === 'bins') {
    const finds = binsFinds(cfg, stop);
    const mean = finds.reduce((a, f) => a + (f.pct / 100) * ((f.pay[0] + f.pay[1]) / 2), 0);
    return { id: c.id, label: c.label, with: null, street: 'bins', finds, left: supplyLeft(cfg, state, stop, cfg.street.bins.draws), odds: null, sure: false, pay: null,
      perEnergy: Math.round(mean * 10) / 10, energy, hours: 1, available: !why, why: why ?? 'mostly nothing or a few dollars', choice: { do: 'card', id: c.id } };
  }
  const odds = jobOdds(cfg, state, c);
  const fails = [c.failHeat ? `heat ${signed(c.failHeat)}` : null, c.failEnergy ? `energy ${signed(-c.failEnergy)}` : null].filter(Boolean);
  const cost = c.good ? perSale(cfg, c.good) : 0;
  return {
    id: c.id, label: c.label, with: c.with ?? null, odds: odds.pct, sure: odds.sure, oddsWhy: odds.why, pay: c.pay,
    uses: c.good ? { good: c.good, label: cfg.goods[c.good].label, n: 1, cost, carried: goodsOn(state, c.good), left: goodsOn(state, c.good) - 1, home: goodsHome(state, c.good) } : null,
    ifWin: c.winHeat ? `heat ${signed(c.winHeat)}` : null, ifFail: odds.sure ? null : fails.length ? fails.join(', ') : 'nothing',
    winHeat: c.winHeat ?? 0, failHeat: c.failHeat ?? 0, failEnergy: c.failEnergy ?? 0, beside: !!c.beside,
    perEnergy: Math.round(((odds.pct / 100) * ((c.pay[0] + c.pay[1]) / 2) - cost) * 10) / 10,
    energy, hours: 1, available: !why, why: why ?? (odds.sure ? 'always safe' : `${odds.pct}% to get ${money(c.pay)}`), choice: { do: 'card', id: c.id },
  };
}

/** The ways on foot (and on the board) along the routes from where you stand: no fare; the energy, the hours, the danger. */
function walks(cfg, state, add) {
  const from = state.place;
  for (const r of routesFrom(cfg, from)) {
    const dest = placeOf(cfg, r.to);
    const by = r.stops.length ? ` by ${r.stops.map(s => placeOf(cfg, s).label).join(', then ')}` : '';
    const stops = r.stops.map(s => ({ stop: s, label: placeOf(cfg, s).label, block: placeOf(cfg, s).block ?? null, spot: placeOf(cfg, s).spot ?? null }));
    for (const [way, w] of Object.entries(cfg.ways ?? {})) {
      const hours = wayHours(cfg, way, r.stops.length);
      const extra = { kind: 'move', what: 'route', way, route: r.id, to: r.to, via: stops, hours, energy: w.energy, fare: 0, needs: w.needs ?? null, home: !!dest.door };
      const label = `${w.label} to ${dest.label}${by} (no fare; ${hours} hour${hours > 1 ? 's' : ''}, energy ${w.energy})`;
      if (dest.locked) {
        add(label, { do: w.do, to: r.to }, dest.locked, { ...extra, locked: true });
        continue;
      }
      const need = wayNeeds(cfg, way, r.to);
      const t = w.needs ? cfg.things[w.needs] : null;
      const keeper = t?.keeper ? (placeOf(cfg, t.at).people ?? []).find(p => p.id === t.keeper) : null;
      const why = !canGo(cfg, state, way) ? `you need ${t.label} (${keeper ? `${keeper.name} sells one ` : ''}${whereOf(cfg, t.at)}, $${t.price})`
        : state.energy < need ? (need > cfg.energy.perHour && !dest.door ? `you need energy ${need} to get there and back` : 'no energy left') : null;
      add(label, { do: w.do, to: r.to }, why, { ...extra, danger: wayRisk(cfg, state, way, legsOf(from, r.stops, r.to)) });
    }
  }
}

/** At a stop: the cards it dealt you still to play, and the way on. */
function stopMoves(cfg, state, add) {
  const R = state.route;
  const stop = state.place;
  const w = cfg.ways[R.way];
  for (const id of R.hand) {
    const e = cardEntry(cfg, state, stop, cardOf(cfg, state, stop, id));
    add(e.label, e.choice, e.available ? null : e.why, { kind: 'card', card: e });
  }
  const ahead = R.stops.slice(R.at + 1);
  const next = ahead[0] ?? R.to;
  const hours = w.legHours * (ahead.length + 1);
  add(`${w.label} on to ${placeOf(cfg, next).label}${R.hand.length ? ' (pass these by)' : ''}`, { do: 'onward' }, null,
    { kind: 'move', what: 'onward', way: R.way, route: R.id, to: next, end: R.to, hours, energy: 0, home: !!placeOf(cfg, R.to).door, danger: wayRisk(cfg, state, R.way, legsOf(stop, ahead, R.to)) });
}

/** Where you are on a route: its ends, the way, the stop you stand at, what is behind and ahead, and the hand. */
function routeView(cfg, state, choices) {
  const R = state.route;
  if (!R) return null;
  const s = placeOf(cfg, state.place);
  const next = R.stops[R.at + 1] ?? R.to;
  const hand = choices.filter(c => c.card).map(c => ({ key: c.key, ...c.card }));
  return {
    id: R.id, label: cfg.routes[R.id]?.label ?? R.id, from: R.from, to: R.to, way: R.way, wayLabel: cfg.ways[R.way].label,
    stop: state.place, stopLabel: s.label, block: s.block ?? null, spot: s.spot ?? null, at: R.at,
    passed: R.stops.slice(0, R.at), ahead: R.stops.slice(R.at + 1), next, nextLabel: placeOf(cfg, next).label, hand,
    text: `${cap(s.label)}, ${cfg.ways[R.way].how} from ${placeOf(cfg, R.from).label} to ${placeOf(cfg, R.to).label}. ${hand.length ? `Dealt: ${hand.map(c => c.label.toLowerCase()).join('; ')}.` : 'Nothing dealt here.'} Next: ${placeOf(cfg, next).label}.`,
  };
}

/** Every route of the city: its ends, its stops (block, spot, tier, what they can deal), the ways it is gone, and whether it leaves from here. */
function routesView(cfg, state) {
  const from = state.route ? null : state.place;
  return Object.entries(cfg.routes ?? {}).map(([id, r]) => ({
    id, label: r.label, between: [...r.between], fromHere: r.between.includes(from), here: state.route?.id === id,
    locked: r.between.some(p => placeOf(cfg, p).locked) ? r.between.map(p => placeOf(cfg, p).locked).find(Boolean) : null,
    stops: r.stops.map(st => {
      const p = placeOf(cfg, st);
      return { stop: st, label: p.label, where: p.where ?? null, block: p.block ?? null, spot: p.spot ?? null, tier: p.tier ?? null, hand: p.hand ?? null, heat: placeHeat(state, st), cards: cardsOf(cfg, st) };
    }),
    ways: Object.entries(cfg.ways ?? {}).map(([way, w]) => ({ way, label: w.label, energy: w.energy, hours: wayHours(cfg, way, r.stops.length), needs: w.needs ?? null, owned: canGo(cfg, state, way), choice: { do: w.do } })),
  }));
}

/** The moves on the street where you stand: robbing somebody passing, the bins, the shop, sleeping rough. */
function streetMoves(cfg, state, add, tell = riskOfTelling(cfg, state)) {
  const place = state.place;
  const p = placeOf(cfg, place);
  const hour = cfg.energy.perHour;
  const noEnergy = state.energy < hour ? 'no energy left' : null;
  const rob = cfg.street.rob;
  const strangers = supplyLeft(cfg, state, place, rob.draws);
  if (strangers !== null) {
    const o = robOdds(cfg, state);
    const needs = rob.needs && !state.owned[rob.needs] ? `you need ${cfg.shop[rob.needs].label.replace(/^an? /i, 'the ').toLowerCase()}` : null;
    add(`${rob.label} (${o.pct}%: ${money(o.pay)}, heat +${o.winHeat} here; if it fails, heat +${o.failHeat} here)`, { do: 'rob' },
      needs ?? noEnergy ?? (strangers <= 0 ? 'nobody worth robbing comes by here again today' : null),
      { kind: 'move', what: 'rob', hours: 1, energy: hour, odds: o.pct, oddsWhy: o.why, pay: o.pay, winHeat: o.winHeat, failHeat: o.failHeat, left: strangers, needs: rob.needs ?? null, tellRisk: tell, pressure: pressureMove(cfg, state, rob.pressure) });
  }
  const left = supplyLeft(cfg, state, place, cfg.street.bins.draws);
  if (left !== null) {
    const finds = binsFinds(cfg, place);
    const best = finds[finds.length - 1];
    add(`${cfg.street.bins.label} (mostly nothing or a few dollars; ${best.pct}% ${money(best.pay)})`, { do: 'bins' },
      noEnergy ?? (left <= 0 ? 'picked clean for today' : null),
      { kind: 'move', what: 'bins', hours: 1, energy: hour, finds, left, seen: p.binsSeen ? { role: p.binsSeen.role, pct: p.binsSeen.pct, mood: p.binsSeen.mood, trust: cfg.trust.seenBins, withYouLookAway: true, pressure: pressureMove(cfg, state, { win: cfg.pressure?.bins })?.ifWin ?? 0 } : null, tellRisk: tell });
  }
  const food = foodToday(cfg, state);
  for (const it of shopOf(cfg, state)) {
    // (the day's one count across every food and drink comes first: config `food`)
    const why = isFood(it) && food.full ? cfg.food.full
      : it.perDay && it.bought >= it.perDay ? `${it.perDay} a day: had today's`
      : state.carried < it.price ? `you carry $${state.carried}`
        : it.gives?.energy && state.energy >= fullEnergy(cfg, state) ? 'your energy is full' : null;
    add(`Buy ${it.label.toLowerCase()} ($${it.price}): ${it.does}${isFood(it) && food.full ? ` (${cfg.food.full})` : ''}`, { do: 'shop', item: it.item }, why,
      { kind: 'move', what: 'shop', item: it.item, price: it.price, hours: 0, ...(isFood(it) ? { food: { eaten: food.eaten, perDay: food.perDay, left: food.left, full: food.full } } : {}) });
  }
  const c = connectOf(cfg, state, place);
  if (c) {
    const g = cfg.goods[c.good];
    add(`Buy ${g.pack} from ${c.who.name} ($${c.price}): ${g.sales} sales of ${g.label}`, { do: 'pack', good: c.good },
      c.why ?? (state.carried < c.price ? `you carry $${state.carried}: a pack is $${c.price}${p.door ? '; step inside for cash' : ''}` : null),
      { kind: 'move', what: 'pack', good: c.good, who: c.who, spot: c.spot, price: c.price, basePrice: c.basePrice, off: c.off, sales: c.sales, left: c.left, hours: 0 });
  }
  // (the things that defend your home are listed after every older move: homeMoves)
  for (const t of thingsAt(cfg, place).filter(x => !x.defends)) {
    add(`Buy ${t.label} ($${t.price})`, { do: 'get', item: t.item },
      state.things?.[t.item] ? 'owned' : state.carried < t.price ? `you carry $${state.carried}${p.door ? '; step inside for cash' : ''}` : null,
      { kind: 'move', what: 'get', item: t.item, thing: t.kind, slot: t.slot ?? null, price: t.price, keeper: t.keeper ?? null, spot: t.spot ?? null, hours: 0 });
  }
  if (!p.door) {
    add(`Sleep rough ${whereOf(cfg, place)}`, { do: 'rough' }, null, { kind: 'move', what: 'rough', robbedPct: tierOf(cfg, place).roughPct, morningEnergy: Math.max(cfg.energy.minMorning, fullEnergy(cfg, state) - cfg.energy.roughMorning) });
  }
}

/** Every choice the player could make from here, legal or not, each with why. */
export function listChoices(cfg, state) {
  const out = [];
  const add = (label, choice, why = null, extra = {}) => out.push({ label, choice, available: !why, why, ...extra });
  const here = placeOf(cfg, state.place);
  const hour = cfg.energy.perHour;

  if (here.held) add(`Morning: out of ${here.label} and home`, { do: 'morning' }, null, { kind: 'move' });

  // who here would tell on a crime, the bins or a robbery this hour: worked out once for every card
  const tell = here.tier && !here.locked ? riskOfTelling(cfg, state) : null;
  if (here.jobs) {
    for (const job of deal(cfg, state)) {
      const e = jobEntry(cfg, state, job, tell);
      out.push({ label: e.label, choice: e.choice, available: e.available, why: e.why, job: e });
    }
  }

  if (here.home) {
    for (const item of ITEMS) {
      const it = cfg.shop[item];
      const why = state.owned[item] ? 'owned' : state.banked < it.price ? `you have $${state.banked} banked` : null;
      add(`Buy ${it.label.toLowerCase()} ($${it.price})`, { do: 'buy', item }, why, { kind: 'buy' });
    }
    // goods at home come out with you unless the choice says how many (`goods: { good: n }`)
    add('Step out', { do: 'out', take: 0 }, state.energy < hour ? 'no energy left: sleep' : null,
      { kind: 'move', takeOut: { min: 0, max: state.banked, default: 0 },
        takeGoods: Object.fromEntries(Object.entries(someGoods(state.stash)).map(([g, n]) => [g, { min: 0, max: n, default: n }])) });
    add('Sleep', { do: 'sleep' }, null, { kind: 'move' });
    // what you own to wear: put on or take off, for nothing
    for (const [item, t] of Object.entries(cfg.things ?? {})) {
      if (t.kind !== 'wear' || !state.things?.[item]) continue;
      const on = state.worn?.[t.slot] === item;
      add(on ? `Take off ${t.label}` : `Put on ${t.label}`, { do: on ? 'unwear' : 'wear', item }, null, { kind: 'move', what: 'wear', item, slot: t.slot, worn: on });
    }
    if (state.door?.kind === 'due') {
      // (memory-1: somebody who feared you, come for another go: pay them off, or the fight, them rested and ready)
      const d = state.door;
      const pr = pronouns(cfg, d.id);
      // (styles-1: somebody they sent, a tough of his own style: his words, the same numbers)
      const fighter = d.sent ? { id: d.id, name: d.sent.name, role: d.role, style: d.sent.style } : { id: d.id, name: d.name, role: d.role };
      add(d.sent ? `Pay him $${d.wants} to call it square` : `Pay ${d.name} $${d.wants} to call it square`, { do: 'give' }, state.banked < d.wants ? `you have $${state.banked} banked` : null, { kind: 'move', what: 'door', due: true, amount: d.wants, ...(d.sent ? { sent: { ...d.sent } } : {}) });
      add(d.sent ? 'Fight him' : `Fight ${pr.them === 'them' ? d.name : pr.them}`, { do: 'refuse' }, null, { kind: 'move', what: 'door', due: true, ...(d.sent ? { sent: { ...d.sent } } : {}), fight: fightView(cfg, state, fighter, { win: 0, lose: cfg.regulars.hurt.clean, scuffle: cfg.regulars.hurt.messy }, d.tougher ?? 0) });
    } else if (state.door) {
      const d = state.door;
      add(`Give ${d.name} $${d.wants}`, { do: 'give' }, state.banked < d.wants ? `you have $${state.banked} banked` : null, { kind: 'move', what: 'door', amount: d.wants });
      // (duel-1: shut on them, they may swing, and a swing is a fight: its odds said, as a card's)
      const swing = doorFights(cfg) && !fears(cfg, state, d.id) ? { swingPct: cfg.regulars.fightPct, ...fightView(cfg, state, { id: d.id, name: d.name, role: d.role }, { win: 0, lose: cfg.regulars.hurt.clean, scuffle: cfg.regulars.hurt.messy }) } : null;
      add(`Shut the door on ${d.name}`, { do: 'refuse' }, null, { kind: 'move', what: 'door', ...(swing ? { fight: swing } : {}) });
    }
  }

  if (here.door) add(state.carried ? `Go inside and bank $${state.carried}` : 'Go inside', { do: 'inside' }, null, { kind: 'move', hours: 0 });
  // on a route, at a stop: its hand of cards, and the way on (nothing else: you are passing through)
  if (state.route && isStop(cfg, state.place)) {
    stopMoves(cfg, state, add);
    styleMoves(cfg, state, add);
    return out.map((c, i) => ({ key: String(i + 1), ...c }));
  }
  if (here.links && !here.locked) rides(cfg, state, add);
  if (here.tier && !here.locked) streetMoves(cfg, state, add, tell);
  // (after the rest, so every older move keeps its key)
  if (!here.locked) walks(cfg, state, add);
  // (home-1, after the rest too: the things that defend your home sold here, and at the crib the guard)
  homeMoves(cfg, state, add);
  // (lib-1, after everything older: today's shelves where you stand, and at the crib what you own of the library to wear)
  libraryMoves(cfg, state, add);
  // (batch-1, after everything older: the rides to the places added since, one ride from home)
  if (here.links && !here.locked) rides(cfg, state, add, true);
  // (styles-1, after everything older: a punch style taught where you stand, and what you fight with)
  styleMoves(cfg, state, add);
  // (sixes-1, after everything older: the slice's pieces sold where you stand, how Earl fights, the tax)
  sliceMoves(cfg, state, add);
  // (raid-1, after everything older: the guns, their rounds and the raid's pieces sold where you stand; what you hold)
  raidMoves(cfg, state, add);
  // (sixes-1: Dutch waiting by the steps: pay her or refuse; nothing else until then)
  if (sixesStateOf(state).tax) {
    const why = `${personName(cfg, cfg.sixes.dutch)} is waiting on the kerb: pay her or refuse first`;
    for (const c of out) if (c.choice.do !== 'tax' && c.available) Object.assign(c, { available: false, why });
  }

  return out.map((c, i) => ({ key: String(i + 1), ...c }));
}

/**
 * The moves of styles-1: a punch style taught where you stand (from what you carry, no hour), and what you fight with,
 * one-on-one and jumped: each thing you own to fight with (kind 'set': not a move of the bar; any time, anywhere).
 */
function styleMoves(cfg, state, add) {
  const here = placeOf(cfg, state.place);
  if (!state.route && here.tier && !here.locked) {
    for (const [s, S] of Object.entries(cfg.styles ?? {})) {
      if (S.at !== state.place) continue;
      const t = taughtAt(cfg, s);
      add(`Learn ${S.label}${t.keeper ? ` from ${t.keeper.name}` : ''} ($${S.price})`, { do: 'learn', style: s },
        knows(state, s) ? 'you know it' : state.carried < S.price ? `you carry $${state.carried}${here.door ? '; step inside for cash' : ''}` : null,
        { kind: 'move', what: 'learn', style: s, price: S.price, keeper: S.keeper, keeperName: t.keeper?.name ?? null, spot: S.spot ?? null, hours: 0, does: S.does });
    }
  }
  // (only with something to choose between: bare hands alone is no choice)
  const now = armOf(cfg, state);
  const arms = armsOf(cfg, state);
  if (arms.length < 2) return;
  for (const a of arms) {
    add(`Fight with ${armLabel(cfg, a)}`, { do: 'fightWith', with: a }, a === now && state.fightWith === a ? 'already' : null, { kind: 'set', what: 'fightWith', arm: a, label: armLabel(cfg, a), chosen: a === now, hours: 0 });
  }
}

/**
 * WHAT YOU FIGHT WITH (styles-1), for the You panel, the bar and the cards: the choice now, each thing you own to fight
 * with (its key), and every punch style of the run: what it does, where it is taught, by whom, the price, whether you
 * know it and whether it can be learned here now.
 */
function fightWithView(cfg, state, choices) {
  const arm = armOf(cfg, state);
  const arms = armsOf(cfg, state).map(a => {
    const c = choices.find(x => x.choice.do === 'fightWith' && x.choice.with === a);
    return { arm: a, label: armLabel(cfg, a), chosen: a === arm, key: c?.key ?? null, available: !!c?.available, choice: { do: 'fightWith', with: a } };
  });
  const styles = Object.entries(cfg.styles ?? {}).map(([s, S]) => {
    const t = taughtAt(cfg, s);
    const c = choices.find(x => x.choice.do === 'learn' && x.choice.style === s);
    return { style: s, label: S.label, does: S.does, price: S.price, at: S.at, atLabel: t.placeLabel, where: t.where, keeper: t.keeper, spot: S.spot ?? null, known: knows(state, s), here: !!c,
      key: c?.key ?? null, available: !!c?.available, choice: { do: 'learn', style: s },
      why: knows(state, s) ? 'you know it' : c ? c.why : `taught ${t.where}${t.keeper ? ` by ${t.keeper.name}` : ''}`, text: `${cap(S.label)}. ${S.does} ${cap(t.text)}.` };
  });
  return { arm, label: armLabel(cfg, arm), set: state.fightWith ?? null, arms, styles,
    text: `You fight with ${armLabel(cfg, arm)}${arms.length > 1 ? ` (yours: ${arms.map(a => a.label).join(', ')})` : ''}.` };
}

/** The moves of lib-1: a piece off today's shelf where you stand; at the crib, a piece you own put on or taken off. */
function libraryMoves(cfg, state, add) {
  const here = placeOf(cfg, state.place);
  for (const s of shelvesHere(cfg, state)) {
    for (const key of s.items) {
      const t = thingOf(cfg, key);
      add(`Buy ${t.label} ($${t.price})`, { do: 'get', item: key },
        state.things?.[key] ? 'owned' : state.carried < t.price ? `you carry $${state.carried}${here.door ? '; step inside for cash' : ''}` : null,
        { kind: 'move', what: 'get', item: key, thing: t.kind, slot: t.slot ?? null, tier: t.tier, price: t.price, keeper: s.keeper, spot: s.spot, shelf: true, hours: 0 });
    }
  }
  if (here.home) {
    for (const p of libraryOf(cfg).pieces) {
      if (p.named || p.kind !== 'wear' || !state.things?.[p.key]) continue;
      const on = state.worn?.[p.slot] === p.key;
      add(on ? `Take off ${p.name}` : `Put on ${p.name}`, { do: on ? 'unwear' : 'wear', item: p.key }, null, { kind: 'move', what: 'wear', item: p.key, slot: p.slot, worn: on });
    }
  }
}

/** The moves of home-1: buying a thing that defends your home where it is sold; at the crib, the guard on or off. */
function homeMoves(cfg, state, add) {
  const here = placeOf(cfg, state.place);
  if (here.tier && !here.locked) {
    for (const t of thingsAt(cfg, state.place).filter(x => x.defends && !x.late)) {
      const keeper = (here.people ?? []).find(p => p.id === t.keeper);
      add(`Buy ${t.label} ($${t.price}): ${t.does.toLowerCase()}`, { do: 'get', item: t.item },
        state.things?.[t.item] ? 'owned' : state.carried < t.price ? `you carry $${state.carried}${here.door ? '; step inside for cash' : ''}` : null,
        { kind: 'move', what: 'get', item: t.item, thing: t.kind, defends: { ...t.defends }, does: t.does, inTrailer: t.inTrailer ?? null, price: t.price, keeper: t.keeper ?? null, keeperName: keeper?.name ?? null, spot: t.spot ?? null, hours: 0 });
    }
  }
  if (here.home) {
    const g = guardOf(cfg, state);
    if (!g) return;
    // (a stretch: hired for g.days days, paid now; on his last day the same move keeps him on. No sending him off)
    const extra = { kind: 'move', what: 'guard', who: g.who, wage: g.wage, price: g.price, days: g.days, until: g.until, daysLeft: g.daysLeft, lastDay: g.lastDay,
      keep: g.on, spot: g.spot, hours: 0, beatenPct: g.beatenPct, on: g.on };
    const short = state.banked < g.price ? `you have $${state.banked} banked` : null;
    if (g.on) add(`Keep ${g.who.name} on your step ${numWord(g.days)} more days ($${g.price}, paid now): through day ${g.until + g.days}`, { do: 'guard', on: true },
      !g.lastDay ? `${cap(g.who.name)} is on your step through day ${g.until}; you can keep him on from his last day` : g.why ? `${g.why}: he won't take another stretch` : short, extra);
    else add(`Hire ${g.who.name} for your step, ${numWord(g.days)} days ($${g.price}, paid now): ${g.label ?? 'watch your door'}`, { do: 'guard', on: true }, g.why ?? short, extra);
  }
}
/**
 * (sixes-1) The slice's moves, after every older one: the new pieces sold where you stand (each with its one job), how
 * Cousin Earl is told to fight at your door (any time he is on your step, no hour), and the tax when Dutch is waiting.
 */
function sliceMoves(cfg, state, add) {
  const here = placeOf(cfg, state.place);
  if (here.tier && !here.locked) {
    for (const t of thingsAt(cfg, state.place).filter(x => x.defends && x.late === true)) {
      const keeper = (here.people ?? []).find(p => p.id === t.keeper);
      add(`Buy ${t.label} ($${t.price}): ${t.does.toLowerCase()}`, { do: 'get', item: t.item },
        state.things?.[t.item] ? 'owned' : state.carried < t.price ? `you carry $${state.carried}${here.door ? '; step inside for cash' : ''}` : null,
        { kind: 'move', what: 'get', item: t.item, thing: t.kind, defends: { ...t.defends }, does: t.does, oneJob: t.job ?? null, against: t.against ?? null, inTrailer: t.inTrailer ?? null, price: t.price, keeper: t.keeper ?? null, keeperName: keeper?.name ?? null, spot: t.spot ?? null, hours: 0 });
    }
  }
  const g = guardOf(cfg, state);
  if (g?.on && cfg.crew) {
    const now = earlWayOf(cfg, state);
    for (const w of cfg.guard.ways ?? []) {
      const W = earlWayWords(w);
      add(`Tell Cousin Earl: ${W.name} (${W.says})`, { do: 'earlWay', way: w }, w === now && state.earlWay === w ? 'already' : null, { kind: 'set', what: 'earlWay', ...W, chosen: w === now, hours: 0 });
    }
  }
  const t = sixesStateOf(state).tax;
  if (t && cfg.sixes) {
    const X = cfg.sixes;
    const name = personName(cfg, X.dutch);
    const v = sixesOf(cfg, state).value;
    add(`Pay ${name} $${t.wants}`, { do: 'tax', pay: true }, state.carried < t.wants ? `you carry $${state.carried}` : null,
      { kind: 'move', what: 'tax', pay: true, amount: t.wants, made: t.made, sixes: { from: v, to: Math.max(0, v - X.pay - sixesStateOf(state).marks.filter(m => m.why === 'sell' && m.day === state.day).reduce((a, m) => a + m.n, 0)) }, hours: 0 });
    add(`Refuse ${name}`, { do: 'tax', pay: false }, null,
      { kind: 'move', what: 'tax', pay: false, amount: t.wants, made: t.made, sixes: { from: v, to: Math.min(X.cap ?? X.max, v + X.raise.refuse), jumpAt: X.jump }, hours: 0 });
  }
}
const personName = (cfg, id) => Object.values(cfg.people).flat().find(p => p.id === id)?.name ?? 'Dutch';
const numWord = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'][n] ?? String(n);

/** Each place in the city you can be in: its heat, whether it is hot and the police are about, and what it has left today. */
function placesView(cfg, state) {
  return streetPlaces(cfg).map(id => {
    const p = placeOf(cfg, id);
    const heat = placeHeat(state, id);
    const hot = isHot(cfg, state, id);
    const police = policeAbout(cfg, state, id);
    const supply = Object.fromEntries(Object.entries(p.supply ?? {}).map(([k, s]) => [k, { left: supplyLeft(cfg, state, id, k), max: s.max, refill: s.refill }]));
    const name = cap(p.label);
    const text = hot ? `${name} is hot today (heat ${heat}): the police are about.`
      : heat ? `${name}: heat ${heat}${police ? ', police about' : ''}.`
        : police ? `${name} is quiet; the police patrol it.` : `${name} is quiet.`;
    // the chance of a stop there for you, an hour from now, as things stand
    const stop = stopChance(cfg, state, id);
    return { place: id, label: p.label, block: p.block ?? null, tier: p.tier, heat, hot, police, stopPct: stop, here: streetOf(cfg, state.place) === id, supply, text };
  });
}

/** The view a UI draws. */
export function view(cfg, state) {
  const place = placeOf(cfg, state.place);
  const choices = listChoices(cfg, state);
  const now = danger(cfg, state);
  const oneMore = danger(cfg, state, { hoursThere: state.hoursThere + 1 });
  const owned = ITEMS.filter(k => state.owned[k]);
  const locked = Object.entries(cfg.places).find(([, p]) => p.locked);
  const here = heatHere(cfg, state);
  const awayFromHome = !!place.tier && !place.door && !place.locked && !isStop(cfg, state.place); // (a stop: the way on is paid)
  // every place's people, once: today's mood and out, their trust, and whether they are about this hour
  const folk = Object.fromEntries(Object.keys(cfg.people).map(at => [at, peopleOf(cfg, state, at, { around: true })]));
  const marked = new Map(marksOf(cfg, state).map(m => [m.who.id, m]));
  return {
    day: state.day,
    hour: state.hour,
    clock: `${String(state.hour % 24).padStart(2, '0')}:00`,
    place: state.place,
    placeLabel: place.label,
    block: place.block ?? null,
    held: place.held ?? null,
    energy: state.energy,
    energyMax: fullEnergy(cfg, state),
    tired: isTired(cfg, state),
    // the heat on you where you stand: your own plus the place's (police stop you from police.from where they are about)
    heat: here,
    heatMax: cfg.heat.max,
    heatHere: here,
    heatYours: state.heat,
    carried: state.carried,
    banked: state.banked,
    owned: { ...state.owned },
    ownedLabels: owned.map(k => cfg.shop[k].label),
    done: state.doneDay ? { days: state.doneDay, text: `done in ${state.doneDay} day${state.doneDay > 1 ? 's' : ''}` } : null,
    hoursThere: tierOf(cfg, state.place)?.jump ? state.hoursThere : 0,
    // the three dealt options (empty where nothing is dealt)
    options: choices.filter(c => c.job).map(c => ({ key: c.key, ...c.job })),
    moves: choices.filter(c => c.kind === 'move'),
    shop: ITEMS.map(item => {
      const c = choices.find(x => x.choice.do === 'buy' && x.choice.item === item);
      const it = cfg.shop[item];
      return {
        item, label: it.label, price: it.price, does: it.does, owned: state.owned[item],
        key: c?.key ?? null, available: !!c?.available,
        why: state.owned[item] ? 'owned' : c ? c.why : `buy it at ${placeOf(cfg, homeId(cfg)).label}`,
      };
    }),
    // what the place you stand in sells (config: the place's `shop`), each with what is left of today's limit
    shopHere: shopOf(cfg, state).map(it => {
      const c = choices.find(x => x.choice.do === 'shop' && x.choice.item === it.item);
      return { item: it.item, label: it.label, price: it.price, does: it.does, perDay: it.perDay ?? null, left: it.perDay ? Math.max(0, it.perDay - it.bought) : null, gives: { ...(it.gives ?? {}) }, food: isFood(it), key: c?.key ?? null, available: !!c?.available, why: c?.why ?? null };
    }),
    // FOOD: the day's one count across every food and drink of the city (config `food`): eaten, the cap, what is left
    food: foodToday(cfg, state),
    // the danger where you stand: of this hour (whatever you do, leaving included) and of one hour more, at today's carry
    danger: now.here
      ? { here: true, thisHour: { jump: now.jump, stop: now.stop }, oneMore: { jump: oneMore.jump, stop: oneMore.stop } }
      : { here: false, why: place.held ? 'the day is over' : 'nobody acts on you here' },
    subway: cfg.subwayStops.map(stop => ({
      stop, label: placeOf(cfg, stop).label, here: stop === state.place || place.inside === stop,
      locked: !!placeOf(cfg, stop).locked, why: placeOf(cfg, stop).locked ?? null,
    })),
    corner: locked ? { label: locked[1].label, locked: true, why: locked[1].locked, block: locked[1].block } : null,
    choices,
    // everyone in the city's places: today's mood, and whether they are out for the rest of the day; a regular also
    // says how many times you have sold to them and any grudge
    people: Object.keys(folk).flatMap(at => folk[at].map(p => ({
      id: p.id, name: p.name, role: p.role, place: at, block: placeOf(cfg, at).block, here: at === state.place,
      mood: p.mood, moodText: cfg.moods[p.mood], outToday: p.out,
      ...(p.regular ? { regular: { sold: soldTo(state, p.id), doorFrom: cfg.regulars.doorAt, hooked: soldTo(state, p.id) >= cfg.regulars.doorAt, grudgeDays: p.offDays } } : {}),
      // (memory-1: what they remember of you this week, and for how long: marks, below)
      ...(marked.has(p.id) ? { mark: { kind: marked.get(p.id).kind, left: marked.get(p.id).left, fear: marked.get(p.id).fear, text: marked.get(p.id).text } } : {}),
    }))),
    // everyone's trust (kept across nights), in the same order as `people`: the number, its band, the days they won't
    // deal with you, and whether they are about at their place this hour (a witness only while about)
    trust: Object.keys(folk).flatMap(at => folk[at].map(p => ({
      id: p.id, name: p.name, role: p.role, place: at, here: at === streetOf(cfg, state.place),
      ...trustOfPerson(cfg, p), offText: offText(p.offDays), around: p.around,
    }))),
    // trust where you stand: who won't deal with you (and for how long), who is against you and about (the chance a
    // move that heats the place, or the bins, is called in), who is with you
    trustHere: trustHere(cfg, state, folk),
    // each place's heat, police and what it has left today, and the one where you stand
    places: placesView(cfg, state),
    // a regular at your door this morning, wanting more: give or refuse (stepping out or sleeping refuses); (memory-1)
    // or somebody who feared you, come for another go (`due`): pay them off, or fight them
    door: state.door ? doorView(cfg, state, choices) : null,
    // PEOPLE REMEMBER (memory-1, RUN.md "People remember"): every mark a person holds of you for the week, in words
    // ("you beat him on day 2 · gives way for 5 more days"), and who is coming to your door (warned, or waiting a day)
    marks: marksOf(cfg, state),
    coming: comingView(cfg, state),
    // GOODS (RUN.md, "Goods, the connect and errands"): what you carry of each good and what is at home, where it is
    // bought, and what it is worth; each place's connect; why a selling job here is not dealt; what you stand to lose
    goods: goodsView(cfg, state),
    connects: connectsView(cfg, state, choices),
    selling: sellingNote(cfg, state),
    atRisk: atRiskView(cfg, state, now),
    // every place's errands (food, things to wear, things for the trailer): who keeps it, at which spot, the price, the
    // day's cap and what is left of it, what it gives; and what you own and wear
    errands: errandsView(cfg, state, choices),
    things: thingsView(cfg, state),
    // (lib-1) the library: every piece with its tier, price, where and when it is sold, owned / worn / seen; today's
    // shelves; the slots (src/run/library.mjs libraryView)
    library: libraryView(cfg, state),
    // out of energy away from home: the day can only end here (or a drink buys an hour)
    stranded: awayFromHome && state.energy < cfg.energy.perHour
      ? { text: `Out of energy ${whereOf(cfg, state.place)}: sleep rough here (${tierOf(cfg, state.place).roughPct}% you are robbed in the night), or buy a drink if you can.` }
      : null,
    // where you are has nothing left but the safe job: says so, and names the way on (null otherwise)
    dry: dryNote(cfg, state, choices),
    // ROUTES (RUN.md, "Routes"): where you are on one (null at a place), the hand the stop dealt you (each card's odds,
    // pay, energy), and every route of the city with its stops and ways. Each way's move (`moves`, what: 'route' or
    // 'onward') carries `danger`: the chance of being jumped or stopped on the rest of the way at what you carry, and
    // what it would take (the page's meter).
    route: routeView(cfg, state, choices),
    hand: choices.filter(c => c.card).map(c => ({ key: c.key, ...c.card })),
    routes: routesView(cfg, state),
    // HOME PRESSURE (RUN.md, "Home pressure (home-1)"): the meter (value, max, every reason in words, what it leads to
    // and when), and the home's state: a warning you were given, the notice of an attempt under way with the ways home
    // and their hours, what defends it (the things, the guard) and how an attempt would go now, and the last ones
    pressure: pressureView(cfg, state),
    home: homeView(cfg, state, choices),
    // (styles-1) WHAT YOU FIGHT WITH, one-on-one and jumped: the choice, what you own to fight with, every punch style
    // and where it is taught
    fight: fightWithView(cfg, state, choices),
    // (sixes-1) THE SIXES' METER (value, the steps built, what holds it up and brings it down, what comes next and when,
    // the tax waiting, the two waiting by the steps), and how Cousin Earl is told to fight
    sixes: sixesView(cfg, state, choices),
    earl: earlView(cfg, state, choices),
    // (raid-1) THE RAID ON YOUR HOME: the raid warned of (who comes, when), what you hold and what each thing you could
    // hold wins (sampled: raid.mjs raidChance), your guns and their rounds, the pieces with a job in it, the truce
    raid: raidView(cfg, state, choices),
    // (raid-1) WORTH: what your home is worth to whoever comes for it, every kind of holding a row (raid.mjs homeWorth):
    // the meter beside HOME and SIXES, with the size of crew it brings and the next step
    worth: cfg.worth ? worthView(cfg, state) : null,
    // (tree-1) WHAT'S AHEAD: every way to fight, every piece of gear, every piece for the home and every place, as a tree:
    // what each does in the game's numbers, what it opens, yours or not, and where and from whom it is had (ahead.mjs).
    // Without the fight numbers, which the page asks for one at a time (ahead.mjs aheadCell)
    ahead: aheadOf(cfg, state, choices),
  };
}

/** (sixes-1) The Sixes' meter for the page: its slip, as HOME's. */
function sixesView(cfg, state, choices) {
  const X = cfg.sixes;
  const m = sixesOf(cfg, state);
  if (!m) return null;
  const s = m.state;
  const steps = [{ at: X.word, what: 'a word from Dutch at the market' }, { at: X.tax, what: 'the tax: a fifth of what you make there, when you leave' }, { at: X.jump, what: 'two of them waiting for you on the kerb as you leave' },
    ...(X.raid != null && cfg.sixesRaid ? [{ at: X.raid, what: 'they come for your crib, at night' }] : [])];
  const ground = (X.ground ?? []).map(id => placeOf(cfg, id).label);
  const reasons = m.reasons.filter(r => r.n).map(r => ({ ...r, text: `${r.text} (+${r.n})` }));
  const next = steps.find(x => x.at > m.value) ?? null;
  const today = s.did === state.day;
  const tomorrow = today ? m.value : Math.max(0, m.value - (m.reasons.length ? X.quietFade : 0));
  const level = m.value >= X.jump ? 'war' : m.value >= X.tax ? 'tax' : m.value >= X.word ? 'word' : m.value > 0 ? 'rising' : 'calm';
  const jump = s.jump ? { day: s.jump.day, today: s.jump.day === state.day, text: s.jump.day === state.day ? 'Two of them are waiting on the market\'s kerb today, for when you leave' : `Two of them will be waiting on the market\'s kerb on day ${s.jump.day}, for when you leave` } : null;
  const taxNow = s.tax ? { ...s.tax, keys: choices.filter(c => c.choice.do === 'tax').map(c => ({ key: c.key, pay: c.choice.pay, available: c.available, why: c.why })) } : null;
  const madeToday = s.madeDay === state.day ? s.made : 0;
  // (raid-1, the push: the tax tomorrow if they stop you again: a run of days goes on, a day off starts it again)
  const streakNow = s.streakDay === state.day ? s.streak : s.streakDay === state.day - 1 ? (s.streak ?? 0) + 1 : 1;
  const pctNext = taxPctOf(cfg, streakNow);
  const truce = s.truce != null && s.truce >= state.day ? { until: s.truce, text: `They leave you be through day ${s.truce}: no tax, nobody on the kerb, no raid` } : null;
  const leads = truce ? truce.text : jump ? jump.text
    : m.value >= X.tax ? `On a day you sell or grab at the market, Dutch is waiting on the kerb when you leave: ${pctNext}% of what you made there (at least $${X.taxMin})${madeToday ? `, $${taxOf(cfg, madeToday, streakNow)} today so far` : ''}${X.push ? `; ${X.push.perDay} points more each day running, up to ${X.push.maxPct}%` : ''}`
      : next ? `At ${next.at}: ${next.what}` : '';
  return {
    value: m.value, max: m.max, cap: m.cap, level, steps, next, ground, reasons, fear: m.fear,
    raises: [
      { what: 'grab', n: X.raise.grab, text: `a till or a stick-up at their market (+${X.raise.grab})` },
      { what: 'sell', n: X.raise.sell, text: `selling at their market (+${X.raise.sell}, once a day)` },
      { what: 'refuse', n: X.raise.refuse, text: `refusing Dutch the tax (+${X.raise.refuse})` },
      { what: 'beat', n: X.raise.beat, text: `beating the two who wait for you on the kerb (+${X.raise.beat})` },
    ],
    eases: [
      { what: 'quiet', n: -X.quietFade, text: `a day with nothing done at their market (−${X.quietFade} the next morning)` },
      { what: 'pay', n: -X.pay, text: `paying the tax (−${X.pay}, and that day's selling doesn't count)` },
    ],
    tomorrow, madeToday, tax: taxNow, jump, did: s.did, word: s.word,
    push: X.push ? { streak: streakNow, pct: pctNext, base: X.taxPct, perDay: X.push.perDay, max: X.push.maxPct } : null, truce,
    capNote: `In this version the meter stops at ${m.cap}: nothing above it is built yet.`,
    text: `The Sixes ${m.value} of ${m.max}${reasons.length ? `: ${reasons.map(r => r.text).join('; ')}` : ': they have no reason to care about you'}. ${leads ? `${leads}.` : ''}`.trim(),
  };
}

/** (sixes-1) Cousin Earl at your door: how he is told to fight, each way with what it does and its door-fight odds. */
function earlView(cfg, state, choices) {
  if (!cfg.crew || !cfg.guard) return null;
  const now = earlWayOf(cfg, state);
  const g = guardOf(cfg, state);
  const odds = g?.on ? crewOdds(cfg, state) : null;
  const ways = (cfg.guard.ways ?? []).map(w => {
    const c = choices.find(x => x.choice.do === 'earlWay' && x.choice.way === w);
    return { ...earlWayWords(w), chosen: w === now, key: c?.key ?? null, available: !!c?.available, choice: { do: 'earlWay', way: w }, win: odds?.byWay?.[w] ?? null };
  });
  return { way: now, set: state.earlWay ?? null, on: !!g?.on, ways, hurtDays: cfg.guard.doorHurtDays ?? 1,
    text: `Told: ${earlWayWords(now).name} (${earlWayWords(now).says}).` };
}

/**
 * The pressure meter: value of max, the reasons holding it up (each with its points, who, in words), and what it leads
 * to: tomorrow morning's value if the rest of today stays as it is, the chance then that somebody is seen casing your
 * crib, and why not (an attempt already due, the quiet days after the last one).
 */
function pressureView(cfg, state) {
  const p = pressureOf(cfg, state);
  if (!p) return null;
  const P = cfg.pressure;
  const H = homeOf(state);
  const today = (H.marks ?? []).some(m => m.day === state.day && m.n > 0);
  const fade = Math.min(marksTotal(state), today ? P.fade : P.quietFade);
  const tomorrow = clampTo(p.raw - fade, 0, p.max);
  const rest = restUntil(cfg, state);
  const resting = rest !== null && state.day + 1 <= rest;
  const due = H.raid ? { day: H.raid.day, who: H.raid.who } : null;
  const chance = due || resting ? 0 : warnChance(cfg, tomorrow);
  const level = p.value >= p.warnAt ? 'high' : p.value > 0 ? 'rising' : 'calm';
  const placeLabel = placeOf(cfg, p.place).label;
  const why = due ? `an attempt is already due (day ${due.day})` : resting ? `quiet days after the last attempt (no warning before day ${rest + 1})` : null;
  const leadsText = why ? `No warning tomorrow: ${why}.`
    : chance ? `Tomorrow morning at ${tomorrow} of ${p.max}: ${chance}% somebody is seen casing your crib (an attempt the day after).`
      : `Under ${p.warnAt}, nobody comes for your crib (tomorrow: ${tomorrow} of ${p.max}${today ? '' : ', if today stays quiet'}).`;
  const reasons = p.reasons.map(r => ({ ...r, text: `${r.text} (${r.n > 0 ? '+' : '−'}${Math.abs(r.n)})` }));
  return {
    value: p.value, max: p.max, warnAt: p.warnAt, level, place: p.place, placeLabel, reasons,
    // the moves that bring it down (there is always one: a quiet day; the home street's jobs that ease it; giving at
    // your door; anyone there who comes to be with you)
    eases: easesOf(cfg, p.place, placeLabel),
    leadsTo: { tomorrow, chance, warnAt: p.warnAt, due, restUntil: rest, resting, why, callOffAt: p.warnAt - (P.callOff ?? 1), text: leadsText },
    text: `Pressure at home ${p.value} of ${p.max}${p.reasons.length ? `: ${reasons.filter(r => r.n).map(r => r.text).join('; ')}` : ': nothing you have done here is held against you'}. ${leadsText}`,
  };
}
const clampTo = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** What brings the pressure down, in words, from the config: a quiet day, the jobs that ease it, giving at the door, friends. */
function easesOf(cfg, street, placeLabel) {
  const P = cfg.pressure;
  const jobs = Object.values(placeOf(cfg, street).jobs ?? {}).filter(j => (j.pressure?.win ?? 0) < 0).map(j => ({ what: 'job', label: j.label, n: j.pressure.win, text: `${j.label.toLowerCase()} (−${-j.pressure.win})` }));
  return [
    { what: 'quiet', n: -P.quietFade, text: `a quiet day ${placeOf(cfg, street).where ?? `at ${placeLabel}`} (−${P.quietFade} overnight; −${P.fade} after a day you added to it)` },
    ...jobs,
    ...(P.give < 0 ? [{ what: 'give', n: P.give, text: `giving a regular what they ask at your door (−${-P.give})` }] : []),
    ...(P.with < 0 ? [{ what: 'with', n: P.with, text: `anyone there who comes to be with you (−${-P.with} while they are)` }] : []),
  ];
}

/**
 * The home's state for the page: a warning (who, the day, what is at stake, what could be done), a notice under way
 * (who, when it started, the hours left, each way home with its hours and whether it is in time, what decides it if you
 * do not come), the defences (each thing, the guard and his move), how an attempt would go now, and the last ones.
 */
function homeView(cfg, state, choices) {
  const street = homeStreet(cfg);
  if (!cfg.pressure || !street) return null;
  const H = homeOf(state);
  const R = cfg.raid;
  const stake = raidTakes(cfg, state);
  const d = defencesOf(cfg, state);
  const g = guardOf(cfg, state);
  const door = doorContest(cfg, state);
  const raid = H.raid;
  const things = Object.entries(cfg.things ?? {}).filter(([, t]) => t.defends).map(([item, t]) => {
    const c = choices.find(x => x.choice.do === 'get' && x.choice.item === item);
    const keeper = (placeOf(cfg, t.at).people ?? []).find(p => p.id === t.keeper);
    return { item, label: t.label, desc: t.desc, price: t.price, does: t.does, job: t.job ?? null, against: t.against ?? null, defends: { ...t.defends }, inTrailer: t.inTrailer ?? null, at: t.at, atLabel: placeOf(cfg, t.at).label, keeper: keeper ? whoOf(keeper) : null, spot: t.spot ?? null,
      owned: !!state.things?.[item], key: c?.key ?? null, available: !!c?.available, why: state.things?.[item] ? 'owned' : c ? c.why : `buy it ${whereOf(cfg, t.at)}` };
  });
  const gm = choices.find(x => x.choice.do === 'guard');
  const guard = g ? { ...g, key: gm?.key ?? null, choice: gm?.choice ?? null, moveAvailable: !!gm?.available, moveWhy: gm ? gm.why : 'put him on at the crib' } : null;
  const warning = raid && !raid.started ? {
    who: { ...raid.who }, why: raid.why ?? null, day: raid.day, warned: raid.warned, today: raid.day === state.day, stake,
    text: raid.day === state.day ? `${cap(raid.who.name)} will try your crib today while you are out: be home, or let your defences decide it. At stake: $${stake.takes} of $${stake.banked}.`
      : `${cap(raid.who.name)} was seen casing your crib: they will try it tomorrow while you are out. At stake now: $${stake.takes} of $${stake.banked}. Lay low: down to ${cfg.pressure.warnAt - (cfg.pressure.callOff ?? 1)} by tomorrow morning and they think better of it.`,
    callOffAt: cfg.pressure.warnAt - (cfg.pressure.callOff ?? 1),
  } : null;
  let notice = null;
  if (raid?.started) {
    const left = Math.max(0, raid.started.by - state.hour);
    const ways = choices.filter(c => c.kind === 'move' && c.home && (c.choice.do === 'subway' || c.what === 'route' || c.what === 'onward'))
      .map(c => ({ key: c.key, label: c.label, choice: c.choice, hours: c.hours, fare: c.fare ?? 0, available: c.available, why: c.why, inTime: c.available && c.hours <= left }));
    const keep = [g?.on ? `${g.who.name} on your step` : null, d.pctBy ? cfg.things[d.pctBy].label : null, d.shareBy ? cfg.things[d.shareBy].label : null].filter(Boolean);
    notice = { who: { ...raid.who }, startedAt: raid.started.at, until: raid.started.by, hoursLeft: left, ways, stake,
      ifYouStay: { guard: !!g?.on, pct: d.pct, share: d.share, text: `${keep.length ? keep.join(' and ') : 'Nothing but the door'} ${keep.length > 1 ? 'decide' : 'decides'} it: ${g?.on ? `${100 - g.beatenPct}% ${g.who.name} sees them off; else ` : ''}${d.pct}% they get in and take $${stake.takes}.` },
      text: `${cap(raid.who.name)} is at your crib's door. ${left} hour${left === 1 ? '' : 's'} to get home and meet them there.` };
  }
  // (sixes-1) a crew: the warning's kind, what it would take, the door fight's odds (and what changes them), the dog
  const p0 = pressureOf(cfg, state);
  const crew = cfg.crew ? (() => {
    const C = cfg.crew;
    const share = defVal(cfg, state, 'crewShare', Math.min) ?? C.share;
    const kick = defVal(cfg, state, 'kick', Math.min) ?? C.kickPct;
    const odds = crewOdds(cfg, state);
    return { at: C.at, now: raidKind(cfg, p0.value) === 'crew', due: raid?.kind === 'crew', odds,
      away: { kickPct: kick, baseKick: C.kickPct, share, baseShare: C.share, takes: Math.floor((state.banked * share) / 100), guard: g?.on ? { beatenPct: g.beatenPct } : null },
      door: { share: C.share, takes: Math.floor((state.banked * C.share) / 100), hurt: { ...C.hurt } },
      text: `From ${C.at}, a crew of two comes instead of a sneak: after dark. Home, a fight at your door (${odds.text}); out, they kick it in (${kick}%) and take ${share}% of what is banked.` };
  })() : null;
  if (warning && raid?.kind === 'crew') {
    warning.kind = 'crew';
    warning.text = raid.day === state.day ? `${cap(raid.who.name)} and a friend come for your crib tonight, after dark. Home, it is a fight at your door (${crew.odds.text}); out, they kick it in.`
      : `${cap(raid.who.name)} and a friend were seen looking at your door: they come on the night of day ${raid.day}. Lay low: down to ${cfg.pressure.warnAt - (cfg.pressure.callOff ?? 1)} by that morning and they think better of it.`;
  } else if (warning && raid.day > state.day + 1) warning.text = `${cap(raid.who.name)} was seen casing your crib (the camera caught them early): they will try it on day ${raid.day} while you are out. Lay low: down to ${cfg.pressure.warnAt - (cfg.pressure.callOff ?? 1)} by that morning and they think better of it.`;
  if (warning) warning.kind ??= 'sneak';
  return {
    place: street, placeLabel: placeOf(cfg, street).label, crib: homeId(cfg), atHome: atHome(cfg, state),
    warning, notice, crew, dog: dogOf(cfg, state),
    defences: { things, guard, pct: d.pct, share: d.share, pctBy: d.pctBy, shareBy: d.shareBy },
    // how an attempt would go now: with nobody home (the guard, then the door), and met at the door (the fight)
    odds: {
      stake,
      away: { guard: g?.on ? { beatenPct: g.beatenPct } : null, pct: d.pct, basePct: R.pct, share: d.share, baseShare: R.share, takes: stake.takes },
      door: { P: door.P, bands: door.bands, why: door.why, takes: stake.takes, scuffle: stake.scuffle, hurt: { ...R.hurt } },
      window: R.window,
    },
    last: H.last, restUntil: restUntil(cfg, state), raids: (H.raids ?? []).map(r => ({ ...r })),
  };
}

/**
 * Who is coming to your door (memory-1): whoever said they come tomorrow (a mark running out, warned), and anyone
 * waiting a day for the door: [{ who, day, kind, text }].
 */
function comingView(cfg, state) {
  if (!cfg.memory) return [];
  const out = [];
  for (const m of marksOf(cfg, state)) {
    if (!m.due || !m.warned) continue;
    const sent = sentFor(cfg, state, m.who);
    const when = m.due === state.day + 1 ? 'tomorrow' : `on day ${m.due}`;
    out.push({ who: m.who, day: m.due, kind: 'due', since: m.day, price: cfg.memory.due.price, ...(sent ? { sent } : {}),
      text: sent ? `${cap(m.who.name)} is sending somebody round ${when} for another go (or $${cfg.memory.due.price} to call it square)` : `${cap(m.who.name)} is coming by ${when} for another go (or $${cfg.memory.due.price} to call it square)` });
  }
  for (const x of state.visits ?? []) {
    out.push({ who: { id: x.id, name: x.name, role: x.role }, day: Math.max(x.due, state.day + (state.door ? 1 : 0)), kind: x.kind, waited: true,
      text: `${cap(x.name)} is waiting to come to your door${x.kind === 'due' ? ' for another go' : ' wanting more'}` });
  }
  return out;
}

/** The regular at your door: who, what they ask, and (duel-1) what shutting it on them may bring, a fight and its odds. */
function doorView(cfg, state, choices) {
  const d = state.door;
  if (d.kind === 'due') {
    const fight = choices.find(c => c.choice.do === 'refuse')?.fight ?? null;
    const pr = pronouns(cfg, d.id);
    if (d.sent) return { ...d, due: true, fight, text: `${cap(d.name)} sent somebody round for another go: ${d.sent.says}. Pay him $${d.wants} to call it square, or fight him: rested and ready, tougher than ${d.name}${fight ? ` (${fight.text})` : ''}. Stepping out or sleeping past him is the fight.` };
    return { ...d, due: true, fight, text: `${cap(d.name)} is at your door for another go. Pay ${pr.them} $${d.wants} to call it square, or fight ${pr.them}: rested and ready, tougher than before${fight ? ` (${fight.text})` : ''}. Stepping out or sleeping past ${pr.them} is the fight.` };
  }
  const fight = choices.find(c => c.choice.do === 'refuse')?.fight ?? null;
  const swing = fight ? ` Shut, ${fight.swingPct}% they swing: ${fight.text}.` : '';
  return { ...d, fight, text: `${cap(d.name)} is at your door wanting more: they ask for $${d.wants}. Give it, or shut the door (stepping out or sleeping shuts it too).${swing}` };
}

/** Trust at the place you stand in (null where nobody lives): off your table, the risk of being told on, with you. */
function trustHere(cfg, state, folk) {
  const street = streetOf(cfg, state.place);
  if (!street || !placeOf(cfg, street).people?.length) return null;
  const all = folk[street] ?? peopleOf(cfg, state, street, { around: true });
  const off = all.filter(p => p.offDays).map(p => ({ ...whoOf(p), days: p.offDays, around: p.around, text: `${cap(p.name)}: ${offText(p.offDays)}` }));
  const withYou = all.filter(p => p.band === 'with').map(p => ({ ...whoOf(p), trust: p.trust, around: p.around }));
  const t = tellRisk(cfg, state, street);
  const name = cap(placeOf(cfg, street).label);
  const text = [
    off.length ? `Won't deal with you ${whereOf(cfg, street)}: ${off.map(p => `${p.name} (${p.days} day${p.days > 1 ? 's' : ''})`).join(', ')}.` : null,
    t.pct ? `Against you and about this hour: ${t.by.map(p => p.name).join(', ')}: ${t.pct}% anything that heats ${placeOf(cfg, street).label}, or the bins, is called in (heat +${t.heat}).` : null,
    withYou.length ? `With you: ${withYou.map(p => p.name).join(', ')}.` : null,
  ].filter(Boolean).join(' ') || `${name}: nobody here is against you.`;
  return { place: street, offTable: off, tellRisk: { pct: t.pct, by: t.by, heat: t.heat }, withYou, text };
}

/** A place worked out sends you on: from the place with your door, along its first open link; from elsewhere, home. `open`: you can go that way now. */
function dryNote(cfg, state, choices) {
  const p = placeOf(cfg, state.place);
  if (!p.jobs || !isDry(cfg, state)) return null;
  const said = `Nobody left to work ${whereOf(cfg, state.place)} today, ${p.onlySafe ?? 'only the safe job'}.`;
  if (p.door) {
    const to = Object.keys(p.links ?? {}).find(id => !placeOf(cfg, id).locked && !placeOf(cfg, id).door);
    const ways = choices.filter(c => c.choice.do === 'subway' && c.choice.to === to);
    const open = ways.some(c => c.available);
    const way = `the subway to ${placeOf(cfg, to).label}`;
    const then = open ? `The way on: ${way}.` : `The way on is ${way}, but ${ways[0].why}: go inside for today.`;
    return { place: state.place, to, way, open, text: `${said} ${then}` };
  }
  const to = Object.keys(p.links ?? {}).find(id => placeOf(cfg, id).door) ?? null;
  const open = choices.some(c => c.choice.do === 'subway' && c.choice.to === to && c.available);
  return { place: state.place, to, way: 'home', open, text: `${said} The way on: home.` };
}

/** Each good of the city: on you, at home, what a sale cost, where it is bought and from whom. */
function goodsView(cfg, state) {
  return Object.entries(cfg.goods ?? {}).map(([g, d]) => {
    const c = connectFor(cfg, g);
    const on = goodsOn(state, g);
    const home = goodsHome(state, g);
    return { good: g, label: d.label, pack: d.pack, price: d.price, sales: d.sales, perSale: perSale(cfg, g), carried: on, home, worth: on * perSale(cfg, g),
      at: c.place, atLabel: placeOf(cfg, c.place).label, connect: c.who, spot: c.spot,
      sellsAt: Object.entries(cfg.places).flatMap(([pl, p]) => Object.entries(p.jobs ?? {}).filter(([, j]) => j.goods?.[g]).map(([id, j]) => ({ place: pl, job: id, label: j.label, pay: j.goodsPay[g] }))),
      text: `${cap(d.label)}: ${on} on you, ${home} at home. ${cap(d.pack)} is $${d.price} for ${d.sales} sales from ${c.who?.name ?? 'nobody'} ${whereOf(cfg, c.place)}.` };
  });
}

/** Each place's connect: who, what, the pack's price for you now, how many more today, and whether they will sell (why not). */
function connectsView(cfg, state, choices) {
  return Object.keys(cfg.places).map(pl => connectOf(cfg, state, pl)).filter(Boolean).map(c => {
    const g = cfg.goods[c.good];
    const move = choices.find(x => x.choice.do === 'pack' && x.choice.good === c.good);
    const here = streetOf(cfg, state.place) === c.place && state.place === c.place;
    const text = c.sells ? `${c.who.name} sells ${g.pack} ${whereOf(cfg, c.place)}: $${c.price} for ${c.sales} sales of ${g.label}${c.off ? ` ($${c.off} off: with you)` : ''}${c.left !== null ? `, ${c.left} more today` : ''}.`
      : `${c.why}.`;
    return { ...c, label: g.label, pack: g.pack, placeLabel: placeOf(cfg, c.place).label, bandText: bandText(cfg, c.band), here, key: move?.key ?? null, available: !!move?.available, whyNot: move?.why ?? (here ? null : `buy it ${whereOf(cfg, c.place)}`), text };
  });
}

/** Where you stand, each selling job of the place: dealt or not, the goods it takes, and (with none on you) where to buy. */
function sellingNote(cfg, state) {
  const p = placeOf(cfg, state.place);
  if (!p.jobs) return null;
  const able = new Set(jobPool(cfg, state).map(j => j.id));
  const jobs = Object.entries(p.jobs).filter(([, j]) => j.goods).map(([id, j]) => {
    const takes = Object.keys(j.goods).map(g => ({ good: g, label: cfg.goods[g].label, pay: j.goodsPay[g], carried: goodsOn(state, g), home: goodsHome(state, g), at: connectFor(cfg, g).place, connect: connectFor(cfg, g).who }));
    const has = able.has(id);
    const buy = takes.map(t => `${t.connect?.name ?? 'nobody'} sells ${t.label} ${whereOf(cfg, t.at)}`).join('; ');
    const home = takes.filter(t => t.home);
    const text = has ? `${j.label}: you carry ${takes.filter(t => t.carried).map(t => `${t.carried} ${t.label}`).join(', ')}.`
      : `${j.label} is not dealt: you carry nothing it takes.${home.length ? ` You left ${home.map(t => `${t.home} ${t.label}`).join(', ')} at home.` : ''} ${buy}.`;
    return { job: id, label: j.label, dealt: has, takes, text };
  });
  return jobs.length ? { place: state.place, jobs, text: jobs.map(j => j.text).join(' ') } : null;
}

/** What you stand to lose where you stand: cash and goods, to a jump (bad or scuffle) or to a police stop. */
function atRiskView(cfg, state, d) {
  const goods = someGoods(state.goods);
  const worth = goodsWorth(cfg, goods);
  const base = { cash: state.carried, goods, worth };
  if (!d.here) return { ...base, here: false, text: state.carried || worth ? `On you: $${state.carried}${worth ? ` and ${goodsText(cfg, goods)}` : ''}. Nothing acts on you here.` : 'Nothing on you.' };
  const j = d.jump;
  const text = [`On you: $${state.carried}${worth ? ` and ${goodsText(cfg, goods)} (worth $${worth})` : ''}.`,
    j.chance ? `Jumped (${j.chance}% this hour): a bad one takes $${j.takes.bad}${Object.keys(j.takesGoods.bad).length ? ` and ${goodsText(cfg, j.takesGoods.bad)}` : ''}, a scuffle $${j.takes.scuffle}${Object.keys(j.takesGoods.scuffle).length ? ` and ${goodsText(cfg, j.takesGoods.scuffle)}` : ''}.` : null,
    d.stop.chance ? `Stopped (${d.stop.chance}% this hour): all of it, and heat ${d.stop.heatAfter} after jail.` : null].filter(Boolean).join(' ');
  return { ...base, here: true, jump: { chance: j.chance, bad: { cash: j.takes.bad, goods: j.takesGoods.bad }, scuffle: { cash: j.takes.scuffle, goods: j.takesGoods.scuffle } }, stop: { chance: d.stop.chance, cash: d.stop.seizes, goods: d.stop.seizesGoods, heatAfter: d.stop.heatAfter }, text };
}

/** Every place's errands: food from its shop, and the things sold there. */
function errandsView(cfg, state, choices) {
  const keeper = (pl, id) => {
    const q = id ? (placeOf(cfg, pl).people ?? []).find(x => x.id === id) : null;
    return q ? whoOf(q) : null;
  };
  const here = pl => state.place === pl;
  return Object.keys(cfg.places).flatMap(pl => [
    ...shopOf(cfg, state, pl).map(it => {
      const c = here(pl) ? choices.find(x => x.choice.do === 'shop' && x.choice.item === it.item) : null;
      return { place: pl, item: it.item, kind: it.kind ?? 'food', label: it.label, price: it.price, does: it.does, gives: { ...(it.gives ?? {}) }, keeper: keeper(pl, it.keeper), spot: it.spot ?? null,
        perDay: it.perDay ?? null, bought: it.bought, left: it.perDay ? Math.max(0, it.perDay - it.bought) : null, food: isFood(it), dayFull: isFood(it) && foodToday(cfg, state).full,
        here: here(pl), key: c?.key ?? null, available: !!c?.available, why: c ? c.why : isFood(it) && foodToday(cfg, state).full ? cfg.food.full : `${whereOf(cfg, pl)}` };
    }),
    ...thingsAt(cfg, pl).map(t => {
      const c = here(pl) ? choices.find(x => x.choice.do === 'get' && x.choice.item === t.item) : null;
      const sold = !!t.keeper && !placeOf(cfg, pl).locked;
      return { place: pl, item: t.item, kind: t.kind, label: t.label, desc: t.desc, slot: t.slot ?? null, inTrailer: t.inTrailer ?? null, price: t.price, keeper: keeper(pl, t.keeper), spot: t.spot ?? null,
        perDay: null, left: null, owned: !!state.things?.[t.item], buyable: sold, here: here(pl), key: c?.key ?? null, available: !!c?.available,
        why: state.things?.[t.item] ? 'owned' : !sold ? `not sold yet: ${placeOf(cfg, pl).locked ?? 'later'}` : c ? c.why : `${whereOf(cfg, pl)}` };
    }),
    // (lib-1: today's shelves, a few pieces a seller: the whole library is in view.library, not here)
    ...shelvesOn(cfg, state.seed, state.day).filter(s => s.place === pl).flatMap(s => s.items.map(key => {
      const t = thingOf(cfg, key);
      const c = here(pl) && !state.route ? choices.find(x => x.choice.do === 'get' && x.choice.item === key) : null;
      return { place: pl, item: key, kind: t.kind, label: t.label, desc: t.desc, slot: t.slot ?? null, inTrailer: null, price: t.price, tier: t.tier, keeper: keeper(pl, s.keeper), spot: s.spot ?? null,
        perDay: null, left: null, owned: !!state.things?.[key], buyable: true, shelf: true, here: here(pl), key: c?.key ?? null, available: !!c?.available,
        why: state.things?.[key] ? 'owned' : c ? c.why : `${whereOf(cfg, pl)}, today` };
    })),
  ]);
}

/** What you own to wear and for the trailer, and what you have on in each slot. */
function thingsView(cfg, state) {
  // (the named things first, in the config's order; then the library's pieces owned, lib-1)
  const keys = [...Object.keys(cfg.things ?? {}), ...Object.keys(state.things ?? {}).filter(k => !cfg.things?.[k])];
  const owned = keys.filter(k => state.things?.[k] && thingOf(cfg, k)).map(k => {
    const t = thingOf(cfg, k);
    return { item: k, label: t.label, kind: t.kind, desc: t.desc, slot: t.slot ?? null, inTrailer: t.inTrailer ?? null, worn: t.kind === 'wear' && state.worn?.[t.slot] === k, ...(t.library ? { library: true, piece: t.piece, tier: t.tier } : {}) };
  });
  const worn = { ...(state.worn ?? {}) };
  const on = Object.values(worn).map(k => thingOf(cfg, k)?.label).filter(Boolean);
  return { owned, worn, trailer: owned.filter(t => t.kind === 'home').map(t => ({ item: t.item, label: t.label, inTrailer: t.inTrailer })), text: on.length ? `Wearing ${on.join(', ')}.` : 'Wearing what you woke up in.' };
}

/**
 * (raid-1) The raid's moves, after every older one: the guns and the raid's pieces sold where you stand (each with its
 * one job), a box of rounds for each gun you own where its seller stands, and what you hold at your door when the Sixes
 * come (kind 'set', no hour, any time: listed when you own a gun).
 */
function raidMoves(cfg, state, add) {
  if (!cfg.sixesRaid) return;
  const here = placeOf(cfg, state.place);
  if (here.tier && !here.locked && !state.route) {
    for (const t of thingsAt(cfg, state.place).filter(x => x.late === 'raid')) {
      const keeper = (here.people ?? []).find(p => p.id === t.keeper);
      const short = state.carried < t.price ? `you carry $${state.carried}${here.door ? '; step inside for cash' : ''}` : null;
      add(`Buy ${t.label} ($${t.price}): ${t.does.toLowerCase()}`, { do: 'get', item: t.item }, state.things?.[t.item] ? 'owned' : short,
        { kind: 'move', what: 'get', item: t.item, thing: t.kind, gun: t.gun ?? null, defends: { ...t.defends }, does: t.does, oneJob: t.job ?? null, against: t.against ?? null, inTrailer: t.inTrailer ?? null, price: t.price, keeper: t.keeper ?? null, keeperName: keeper?.name ?? null, spot: t.spot ?? null, hours: 0 });
      if (t.gun && state.things?.[t.item]) {
        const A = t.ammo;
        add(`Buy ${A.label} ($${A.price}) for ${t.label}`, { do: 'ammo', item: t.item }, state.carried < A.price ? `you carry $${state.carried}${here.door ? '; step inside for cash' : ''}` : null,
          { kind: 'move', what: 'ammo', item: t.item, n: A.n, price: A.price, rounds: roundsOf(state, t.item), keeper: t.keeper ?? null, keeperName: keeper?.name ?? null, spot: t.spot ?? null, hours: 0 });
      }
    }
  }
  if (!gunsOf(cfg, state).length) return;
  const now = holdOf(cfg, state);
  for (const h of holdsOf(cfg, state)) {
    add(`At your door, hold ${holdLabel(cfg, h)}`, { do: 'holdWith', with: h }, h === now && state.holdWith === h ? 'already' : null,
      { kind: 'set', what: 'holdWith', with: h, label: holdLabel(cfg, h), gun: !!cfg.things?.[h]?.gun, rounds: cfg.things?.[h]?.gun ? roundsOf(state, h) : null, chosen: h === now, hours: 0 });
  }
}

/** (raid-1) The raid on your home for the page: due or not, what you hold and its odds, your guns, the pieces, the truce. */
function raidView(cfg, state, choices) {
  if (!cfg.sixesRaid || !cfg.sixes) return null;
  const X = cfg.sixes;
  const s = sixesStateOf(state);
  const R = s.raid;
  const stake = stakeOf(cfg, state);
  const w = worthView(cfg, state);
  // (the odds of what you hold now only: each other thing you could hold, Earl and each piece are raid.mjs raidOdds, a
  // few hundred fights more: the page asks it when the card opens, as it asks fightAdvice)
  const odds = R ? raidChance(cfg, state) : null;
  const now = holdOf(cfg, state);
  const holds = holdsOf(cfg, state).map(h => {
    const c = choices.find(x => x.choice.do === 'holdWith' && x.choice.with === h);
    return { with: h, label: holdLabel(cfg, h), gun: !!cfg.things?.[h]?.gun, rounds: cfg.things?.[h]?.gun ? roundsOf(state, h) : null, chosen: h === now, key: c?.key ?? null, available: !!c?.available, choice: { do: 'holdWith', with: h }, win: odds?.byHold?.[h] ?? null };
  });
  const guns = gunThings(cfg).map(([item, t]) => ({ ...gunWords(cfg, item), owned: !!state.things?.[item], rounds: roundsOf(state, item), price: t.price, at: t.at, atLabel: placeOf(cfg, t.at).label, keeper: personOf(cfg, t.keeper) ? whoOf(personOf(cfg, t.keeper)) : null, spot: t.spot ?? null }));
  const pieces = Object.entries(cfg.things ?? {}).filter(([, t]) => t.late === 'raid' && !t.gun).map(([item, t]) => ({ item, label: t.label, job: t.job, does: t.does, price: t.price, defends: { ...t.defends }, against: [...(t.against ?? [])], owned: !!state.things?.[item], at: t.at, atLabel: placeOf(cfg, t.at).label, keeper: personOf(cfg, t.keeper) ? whoOf(personOf(cfg, t.keeper)) : null, spot: t.spot ?? null }));
  const due = R ? (() => {
    const c = crewFoes(cfg, R.crew, R.size);
    const tonight = R.day === state.day;
    return { day: R.day, warned: R.warned, tonight, crew: R.crew, size: R.size, n: c.n, name: c.name, says: c.says, count: { ...c.count }, stake: R.stake,
      text: `The Sixes come for your crib ${tonight ? 'tonight' : `on the night of day ${R.day}`}: ${c.text} (${c.says}). Home, you meet them with ${holdLabel(cfg, now)} (${odds.text}); out for the night, your door and Earl decide it.` };
  })() : null;
  const truce = s.truce != null && s.truce >= state.day ? { until: s.truce } : null;
  return { at: X.raid, due, odds, hold: now, set: state.holdWith ?? null, holds, guns, pieces, stake, truce, raids: (s.raids ?? []).map(r => ({ ...r })),
    worth: w, raidAt: raidAtOf(cfg),
    // (pieces knocked out in a raid, until mended)
    out: Object.entries(state.home?.out ?? {}).filter(([, d]) => d >= state.day).map(([item, until]) => ({ item, label: cfg.things[item]?.label ?? item, until, daysLeft: until - state.day + 1 })),
    text: due ? due.text : truce ? `The Sixes leave you be through day ${truce.until}.` : `At ${raidAtOf(cfg)} on their meter the Sixes come for your crib, at night: how many by what your home is worth ($${w.total} now).` };
}

/** (raid-1) The WORTH meter: the sum and its rows, the size of crew it brings, the next step, what is hidden and at risk. */
function worthView(cfg, state) {
  const w = homeWorth(cfg, state);
  const h = hiddenOf(cfg, state);
  const sizes = ['a small crew', 'a bigger crew', 'their biggest crew'];
  return { ...w, max: w.steps.length ? w.steps[w.steps.length - 1] : null, crew: sizes[w.size] ?? null, raidAt: cfg.sixesRaid ? raidAtOf(cfg) : null,
    atRisk: thingsAtRisk(cfg, state).map(x => ({ ...x, hidden: h.things.includes(x.item) })), hidden: { ...h, things: [...h.things] },
    text: `${w.text} ${w.next != null ? `At $${w.next} the Sixes would send ${sizes[w.size + 1]}.` : 'The Sixes would send their biggest crew.'}` };
}
