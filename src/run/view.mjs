// What the player sees, as plain data a UI can draw without knowing any rule: where you are, what you carry and
// own, the three dealt options with their odds, pay, cost and who they could be done to, the ways to move, the shops,
// the locked corner, the danger of the hour you are in and the one after it, the people of each place with today's
// mood, each place's heat, police and supply, someone at your door, and whether where you are has been worked dry.
// Every odds number comes from rules.mjs, the same functions the engine rolls with. listChoices() is also what
// step() checks a choice against. No rule here names a place: each reads the place's entry.

import {
  danger, deal, jobOdds, jobPay, isTired, fullEnergy, fareFor, ITEMS, peopleOf, namedLabel, whoOf, isDry, placeOf, tierOf,
  homeId, streetOf, streetPlaces, heatHere, placeHeat, isHot, policeAbout, stopChance, supplyLeft, robOdds, binsFinds,
  shopOf, soldTo, cap, tellRisk, jobTrust, canHeat, withUp, offText,
  goodsOn, goodsHome, someGoods, goodsWorth, goodsText, perSale, connectOf, connectFor, thingsAt, jobPool,
  isStop, routesFrom, wayHours, wayNeeds, wayDanger, canGo, cardOf,
  homeStreet, atHome, homeOf, pressureOf, warnChance, restUntil, defencesOf, raidTakes, doorContest, guardOf, marksTotal,
} from './rules.mjs';
import { libraryOf, thingOf, shelvesHere, shelvesOn, libraryView } from './library.mjs';

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

/** A person's trust as a card shows it: the number, its band, the days off your table. */
const trustOfPerson = (cfg, p) => ({ trust: p.trust ?? 0, band: p.band ?? 'neutral', bandText: bandText(cfg, p.band ?? 'neutral'), offDays: p.offDays ?? 0 });

function jobEntry(cfg, state, job, tell = riskOfTelling(cfg, state)) {
  const odds = jobOdds(cfg, state, job);
  const energy = cfg.energy.perHour;
  const why = state.energy < energy ? 'no energy left' : null;
  const ifWin = job.winHeat ? `heat ${signed(job.winHeat)}` : null;
  const fails = [job.failHeat ? `heat ${signed(job.failHeat)}` : null, job.failEnergy ? `energy ${signed(-job.failEnergy)}` : null].filter(Boolean);
  const moves = jobTrust(job);
  const friend = withUp(cfg, state.place, job.who);
  return {
    id: job.id,
    label: namedLabel(job),
    who: job.who ? whoOf(job.who) : null, // the person it is done to or with
    mood: job.who?.mood ?? null, // their mood now (calm, or friendly if you have already worked for them today)
    // who it could be done to instead (the dealt one first): name one as { do: 'job', id, who: id }
    targets: (job.targets ?? []).map(p => ({ ...whoOf(p), mood: p.mood, ...(p.regular ? { regular: true } : {}), ...trustOfPerson(cfg, p), withPay: withUp(cfg, state.place, p) })),
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
    failEnergy: job.failEnergy ?? 0,
    energy,
    safe: !!job.safe,
    available: !why,
    why: why ?? (odds.sure ? 'always safe' : `${odds.pct}% to get ${money(jobPay(cfg, state, job))}`),
    choice: { do: 'job', id: job.id },
  };
}

/** The ways out of a place along its links: the fare, the turnstile, or locked. */
function rides(cfg, state, add) {
  const s = cfg.subway;
  const from = state.place;
  const hour = cfg.energy.perHour;
  const noEnergy = state.energy < hour ? (placeOf(cfg, from).door ? 'no energy left' : 'no energy left: sleep rough here, or buy a drink') : null;
  for (const [to, link] of Object.entries(placeOf(cfg, from).links ?? {})) {
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
    winHeat: c.winHeat ?? 0, failHeat: c.failHeat ?? 0, failEnergy: c.failEnergy ?? 0,
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
  for (const it of shopOf(cfg, state)) {
    const why = it.perDay && it.bought >= it.perDay ? `${it.perDay} a day: had today's`
      : state.carried < it.price ? `you carry $${state.carried}`
        : it.gives?.energy && state.energy >= fullEnergy(cfg, state) ? 'your energy is full' : null;
    add(`Buy ${it.label.toLowerCase()} ($${it.price}): ${it.does}`, { do: 'shop', item: it.item }, why, { kind: 'move', what: 'shop', item: it.item, price: it.price, hours: 0 });
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
    if (state.door) {
      const d = state.door;
      add(`Give ${d.name} $${d.wants}`, { do: 'give' }, state.banked < d.wants ? `you have $${state.banked} banked` : null, { kind: 'move', what: 'door', amount: d.wants });
      add(`Shut the door on ${d.name}`, { do: 'refuse' }, null, { kind: 'move', what: 'door' });
    }
  }

  if (here.door) add(state.carried ? `Go inside and bank $${state.carried}` : 'Go inside', { do: 'inside' }, null, { kind: 'move', hours: 0 });
  // on a route, at a stop: its hand of cards, and the way on (nothing else: you are passing through)
  if (state.route && isStop(cfg, state.place)) {
    stopMoves(cfg, state, add);
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

  return out.map((c, i) => ({ key: String(i + 1), ...c }));
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
    for (const t of thingsAt(cfg, state.place).filter(x => x.defends)) {
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
      return { item: it.item, label: it.label, price: it.price, does: it.does, perDay: it.perDay ?? null, left: it.perDay ? Math.max(0, it.perDay - it.bought) : null, gives: { ...(it.gives ?? {}) }, key: c?.key ?? null, available: !!c?.available, why: c?.why ?? null };
    }),
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
    // a regular at your door this morning, wanting more: give or refuse (stepping out or sleeping refuses)
    door: state.door ? { ...state.door, text: `${cap(state.door.name)} is at your door wanting more: they ask for $${state.door.wants}. Give it, or shut the door (stepping out or sleeping shuts it too).` } : null,
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
  };
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
    return { item, label: t.label, desc: t.desc, price: t.price, does: t.does, defends: { ...t.defends }, inTrailer: t.inTrailer ?? null, at: t.at, atLabel: placeOf(cfg, t.at).label, keeper: keeper ? whoOf(keeper) : null, spot: t.spot ?? null,
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
  return {
    place: street, placeLabel: placeOf(cfg, street).label, crib: homeId(cfg), atHome: atHome(cfg, state),
    warning, notice,
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
        perDay: it.perDay ?? null, bought: it.bought, left: it.perDay ? Math.max(0, it.perDay - it.bought) : null, here: here(pl), key: c?.key ?? null, available: !!c?.available, why: c ? c.why : `${whereOf(cfg, pl)}` };
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
