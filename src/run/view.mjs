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
} from './rules.mjs';

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
    // the chance someone here against you calls it in, if it heats the place (null: it cannot be told on)
    tellRisk: canHeat(job) ? tell : null,
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
      { kind: 'move', what: 'rob', hours: 1, energy: hour, odds: o.pct, oddsWhy: o.why, pay: o.pay, winHeat: o.winHeat, failHeat: o.failHeat, left: strangers, needs: rob.needs ?? null, tellRisk: tell });
  }
  const left = supplyLeft(cfg, state, place, cfg.street.bins.draws);
  if (left !== null) {
    const finds = binsFinds(cfg, place);
    const best = finds[finds.length - 1];
    add(`${cfg.street.bins.label} (mostly nothing or a few dollars; ${best.pct}% ${money(best.pay)})`, { do: 'bins' },
      noEnergy ?? (left <= 0 ? 'picked clean for today' : null),
      { kind: 'move', what: 'bins', hours: 1, energy: hour, finds, left, seen: p.binsSeen ? { role: p.binsSeen.role, pct: p.binsSeen.pct, mood: p.binsSeen.mood, trust: cfg.trust.seenBins, withYouLookAway: true } : null, tellRisk: tell });
  }
  for (const it of shopOf(cfg, state)) {
    const why = it.perDay && it.bought >= it.perDay ? `${it.perDay} a day: had today's`
      : state.carried < it.price ? `you carry $${state.carried}`
        : it.gives?.energy && state.energy >= fullEnergy(cfg, state) ? 'your energy is full' : null;
    add(`Buy ${it.label.toLowerCase()} ($${it.price}): ${it.does}`, { do: 'shop', item: it.item }, why, { kind: 'move', what: 'shop', item: it.item, price: it.price, hours: 0 });
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
    add('Step out', { do: 'out', take: 0 }, state.energy < hour ? 'no energy left: sleep' : null,
      { kind: 'move', takeOut: { min: 0, max: state.banked, default: 0 } });
    add('Sleep', { do: 'sleep' }, null, { kind: 'move' });
    if (state.door) {
      const d = state.door;
      add(`Give ${d.name} $${d.wants}`, { do: 'give' }, state.banked < d.wants ? `you have $${state.banked} banked` : null, { kind: 'move', what: 'door', amount: d.wants });
      add(`Shut the door on ${d.name}`, { do: 'refuse' }, null, { kind: 'move', what: 'door' });
    }
  }

  if (here.door) add(state.carried ? `Go inside and bank $${state.carried}` : 'Go inside', { do: 'inside' }, null, { kind: 'move', hours: 0 });
  if (here.links && !here.locked) rides(cfg, state, add);
  if (here.tier && !here.locked) streetMoves(cfg, state, add, tell);

  return out.map((c, i) => ({ key: String(i + 1), ...c }));
}

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
  const awayFromHome = !!place.tier && !place.door && !place.locked;
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
    // out of energy away from home: the day can only end here (or a drink buys an hour)
    stranded: awayFromHome && state.energy < cfg.energy.perHour
      ? { text: `Out of energy ${whereOf(cfg, state.place)}: sleep rough here (${tierOf(cfg, state.place).roughPct}% you are robbed in the night), or buy a drink if you can.` }
      : null,
    // where you are has nothing left but the safe job: says so, and names the way on (null otherwise)
    dry: dryNote(cfg, state, choices),
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
