// WHAT JUST HAPPENED, AS ONE CARD (ui-3, leg 1: the review's "result card and journal"). Every step the player takes
// ends with a card that says what happened in plain words, every change it made as a chip, and what to try next; the
// same card, short, is the day's journal line. Pure: the rules' events and the states before and after, read here and
// nothing else (no DOM), so it is tested in node (test/run-news.test.mjs). The page paints it (index.js paintResult).
//
// A card: { tone, kicker, chance, head, body, chips: [{ tone, icon, text }], next, big, day, hour, icon }
//   tone   'win' a job or a crime that came off · 'fail' one that did not · 'loss' something taken from you (big: the
//          police, a bad one, robbed asleep, a break-in) · 'good' news that went your way · 'news' something to know ·
//          'quiet' a purchase, a step out, a ride
//   chips  tone 'gain' · 'loss' · 'risk' · 'heat' · 'trust' · 'mute'; icon a name from the page's icon set

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const money = n => `$${Math.abs(n).toLocaleString('en-US')}`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const hourWord = n => `${String(((n % 24) + 24) % 24).padStart(2, '0')}:00`;

/** The words for goods, from the rules' labels (the page passes its own, panels.js, which are shorter). */
export function plainWords(cfg) {
  const good = (g, n) => {
    const label = cfg.goods?.[g]?.label ?? g;
    return n === 1 ? label.replace(/s$/, '') : label;
  };
  return {
    good,
    goods: goods => Object.entries(goods ?? {}).filter(([, n]) => n > 0).map(([g, n]) => `${n} ${good(g, n)}`).join(' and '),
    pack: g => (cfg.goods?.[g]?.pack ?? 'a pack').replace(/^an? /, ''),
    card: id => id,
    place: id => cfg.places?.[id]?.label ?? cfg.stops?.[id]?.label ?? id,
  };
}

/** The order the events are read in for the headline: what took something from you first, then what you did. */
const FIRST = ['stopped', 'robbed', 'raid', 'jumped', 'alarm', 'casing', 'job', 'rob', 'card', 'bins', 'calledOff', 'buy', 'thing', 'pack', 'shop', 'wear', 'unwear',
  'guard', 'gave', 'refused', 'fight', 'grudge', 'sore', 'hop', 'bank', 'inside', 'out', 'arrive', 'stop', 'onward', 'walk', 'ride'];
const rankOf = e => {
  // (a jump that took nothing, a door that held: below what you did that hour)
  if (e.type === 'jumped' && e.outcome !== 'clean' && e.outcome !== 'messy') return FIRST.indexOf('calledOff');
  if (e.type === 'raid' && !e.taken) return FIRST.indexOf('calledOff') + 0.5;
  const i = FIRST.indexOf(e.type);
  return i < 0 ? 99 : i;
};

/** The step ended the day (to bed, a night on the street, out of the jail or the clinic): the night's report says it. */
export const endsDay = events => events.some(e => e.type === 'morning' || e.type === 'released');

/**
 * The card for one step. `v0`, `v1`: the rules' views before and after. `words`: the page's words for goods and
 * places (plainWords by default). Null when the step ended the day: the night's report is its card.
 */
export function newsOf({ cfg, before, state, events, v0, v1, words = plainWords(cfg) }) {
  if (endsDay(events)) return null;
  const evs = events.filter(e => e.type !== 'witness' && e.type !== 'drift');
  const main = [...evs].sort((a, b) => rankOf(a) - rankOf(b))[0] ?? null;
  const card = { tone: 'quiet', kicker: 'Done', chance: null, head: null, body: '', chips: [], next: null, big: false, day: before.day, hour: before.hour, icon: 'clock' };
  if (!main) {
    card.head = cap(events.map(e => e.text).filter(Boolean)[0] ?? 'Nothing happened');
    card.chips = chipsOf({ cfg, before, state, events, v0, v1, words });
    return card;
  }
  Object.assign(card, headOf(main, { cfg, before, state, events, v0, v1, words }));
  // the body: the hour in the order it happened, in the rules' own sentences, the headline's event by its own words
  const told = events.find(e => e.type === 'witness');
  const lines = evs.filter(e => e === main || (e.text && !QUIET_LINES.has(e.type))).map(e => (e === main ? card.body : e.text));
  card.body = [...lines, told ? told.text : null].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  card.chips = chipsOf({ cfg, before, state, events, v0, v1, words });
  card.next = nextOf({ cfg, card, state, v1, words });
  return card;
}
/** Lines the chips already say (a fare, the hour's ride): not repeated in the body. */
const QUIET_LINES = new Set(['fare', 'ride', 'arrive', 'onward', 'walk', 'stop', 'bank', 'inside', 'jail', 'clinic']);

/** The headline and kicker of the event that leads. */
function headOf(e, { cfg, before, state, v0, v1, words }) {
  const taken = (cash, goods) => [cash ? money(cash) : null, words.goods(goods) || null].filter(Boolean).join(' and ');
  const after = (text, lead) => (text && lead && text.startsWith(lead) ? text.slice(lead.length).replace(/^[:.,]\s*(\+\$\d+[^.]*\.)?\s*/, '').trim() : '');
  switch (e.type) {
    case 'stopped': {
      const what = taken(e.seized, e.goodsSeized);
      return { tone: 'loss', big: true, icon: 'police', kicker: 'Arrested', chance: `${e.chance}% that hour`, head: what ? `The police took ${what}` : 'Stopped by the police',
        body: `${what ? 'All you carried is gone. ' : ''}The night in jail; your heat after it is ${e.heatAfter}.` };
    }
    case 'robbed':
      return e.taken || Object.keys(e.goodsTaken ?? {}).length
        ? { tone: 'loss', big: true, icon: 'warn', kicker: 'Robbed in your sleep', head: `They took ${taken(e.taken, e.goodsTaken)}`, body: '' }
        : { tone: 'good', icon: 'check', kicker: 'The night', head: 'Nobody touched you', body: '' };
    case 'raid': {
      const who = cap(e.who?.name ?? 'somebody');
      if (e.taken) return { tone: 'loss', big: true, icon: 'homerisk', kicker: e.night ? 'Your crib, in the night' : 'Your crib was hit', head: `They got in: ${money(e.taken)} gone`, body: `${who} came for what you had banked. ${e.text}` };
      if (e.how === 'guard') return { tone: 'good', icon: 'homerisk', kicker: 'Your crib held', head: `${cap(e.guard?.who?.name ?? 'Your guard')} saw them off`, body: e.text };
      return { tone: 'good', icon: 'homerisk', kicker: 'Your crib held', head: e.gotIn ? 'They got in, and found nothing banked' : 'Your door held', body: e.text };
    }
    case 'jumped':
      if (e.outcome === 'clean') return { tone: 'loss', big: true, icon: 'warn', kicker: 'Jumped: a bad one', chance: `${e.chance}% that hour`, head: taken(e.taken, e.goodsTaken) ? `They took ${taken(e.taken, e.goodsTaken)}` : 'They found nothing to take', body: 'You wake in the clinic.' };
      if (e.outcome === 'messy') return { tone: 'loss', icon: 'warn', kicker: 'Jumped: a scuffle', chance: `${e.chance}% that hour`, head: taken(e.taken, e.goodsTaken) ? `They took ${taken(e.taken, e.goodsTaken)}` : 'They found nothing to take', body: '' };
      return { tone: 'good', icon: 'check', kicker: 'Jumped', chance: `${e.chance}% that hour`, head: 'Somebody tried it and got nothing', body: '' };
    case 'alarm':
      return { tone: 'news', icon: 'homerisk', kicker: 'At your door', head: `${cap(e.who?.name ?? 'Somebody')} is at your door`, body: e.text };
    case 'casing':
      return { tone: 'news', icon: 'homerisk', kicker: 'Warning', head: `${cap(e.who?.name ?? 'Somebody')} was casing your crib`, body: e.text };
    case 'calledOff':
      return { tone: 'good', icon: 'homerisk', kicker: 'Called off', head: 'They thought better of it', body: e.text };
    case 'job':
    case 'card': {
      const label = e.type === 'card' ? words.card(e.card) : e.label;
      const odds = e.chance !== null && e.chance !== undefined && e.chance < 100 ? `${e.chance}% chance · ${e.outcome === 'win' ? 'it came up' : 'it missed'}` : e.chance >= 100 ? 'a sure thing' : null;
      return e.outcome === 'win'
        ? { tone: 'win', icon: 'cash', kicker: 'It worked', chance: odds, head: `${cap(label)}: +${money(e.pay)}`, body: after(e.text, label) }
        : { tone: 'fail', icon: 'warn', kicker: 'It didn\'t work', chance: odds, head: `${cap(label)}: it went wrong`, body: after(e.text, label).replace(/^it went wrong[^.]*\.\s*/, '') };
    }
    case 'rob':
      return e.outcome === 'win'
        ? { tone: 'win', icon: 'cash', kicker: 'It worked', chance: `${e.chance}% chance · it came up`, head: `Robbed somebody passing: +${money(e.pay)}`, body: '' }
        : { tone: 'fail', icon: 'warn', kicker: 'It didn\'t work', chance: `${e.chance}% chance · it missed`, head: 'They got away shouting', body: '' };
    case 'bins':
      return { tone: e.pay ? 'win' : 'quiet', icon: 'bins', kicker: e.pay ? 'A find' : 'Nothing', head: e.pay ? `The bins: +${money(e.pay)}` : 'The bins: nothing', body: after(e.text, 'You dug through the bins') };
    case 'buy':
      return { tone: 'win', icon: 'star', kicker: 'Bought', head: e.text.replace(/^You bought /, 'You own ').replace(/ for \$\d+\.$/, ''), body: '' };
    case 'thing':
      return { tone: 'quiet', icon: 'shop', kicker: 'Bought', head: `${cap(String(e.label).replace(/^an? /i, ''))}${e.worn ? ': wearing it' : e.kind === 'home' ? ': in the trailer' : ''}`, body: '' };
    case 'pack':
      return { tone: 'quiet', icon: 'shop', kicker: 'Bought', head: `${cap(words.pack(e.good))} from ${cap(e.who?.name ?? '')}`, body: '' };
    case 'shop':
      return { tone: 'quiet', icon: 'shop', kicker: 'Bought', head: cap(e.text.replace(/\.$/, '')), body: '' };
    case 'wear':
    case 'unwear':
      return { tone: 'quiet', icon: 'person', kicker: e.type === 'wear' ? 'Put on' : 'Took off', head: cap(String(e.label).replace(/^an? /i, '')), body: '' };
    case 'guard':
      return { tone: 'news', icon: 'homerisk', kicker: 'Your step', head: cap(e.text.split(/(?<=\.)\s/)[0].replace(/\.$/, '')), body: e.text.split(/(?<=\.)\s/).slice(1).join(' ') };
    case 'gave':
    case 'refused':
    case 'fight':
    case 'grudge':
    case 'sore':
      return { tone: e.type === 'gave' ? 'quiet' : e.type === 'fight' && e.energyLost ? 'fail' : 'news', icon: 'person', kicker: 'At your door', head: cap(e.text.split(/(?<=\.)\s/)[0].replace(/\.$/, '')), body: e.text.split(/(?<=\.)\s/).slice(1).join(' ') };
    case 'hop':
      return e.caught
        ? { tone: 'fail', icon: 'heat', kicker: 'Seen', chance: `${e.chance}% chance`, head: 'Seen hopping the turnstile', body: '' }
        : { tone: 'quiet', icon: 'train', kicker: 'On the move', head: `On to ${words.place(state.place)}`, body: '' };
    case 'bank':
    case 'inside':
      return { tone: e.type === 'bank' ? 'good' : 'quiet', icon: 'home', kicker: 'Home', head: e.type === 'bank' ? `Home: banked ${money(e.money?.[0]?.amount ?? 0)}` : 'Home', body: '' };
    case 'out':
      return { tone: 'quiet', icon: 'walk', kicker: 'Out', head: `Stepped out${state.carried ? ` with ${money(state.carried)}` : ''}`, body: '' };
    case 'arrive':
    case 'ride':
    case 'walk':
    case 'onward':
    case 'stop':
      return { tone: 'quiet', icon: e.type === 'walk' || e.type === 'onward' || e.type === 'stop' ? 'walk' : 'train', kicker: 'On the move', head: cap(v1.placeLabel ?? words.place(state.place)), body: e.type === 'stop' ? e.text : '' };
    default:
      return { tone: 'quiet', icon: 'clock', kicker: 'Done', head: cap(String(e.text ?? '').split(/(?<=\.)\s/)[0].replace(/\.$/, '')), body: '' };
  }
}

/** Every change the step made, as chips: money, goods, energy, time, heat, home risk, trust, things owned. */
export function chipsOf({ cfg, before, state, events, v0, v1, words = plainWords(cfg) }) {
  const out = [];
  const same = state.day === before.day;
  const dc = state.carried - before.carried;
  const db = state.banked - before.banked;
  // (something taken that hour: what came in and what went, each said, not the sum of the two)
  const lost = events.filter(e => (e.type === 'stopped' && e.seized) || ((e.type === 'jumped' || e.type === 'robbed') && e.taken) || (e.type === 'raid' && e.taken));
  if (lost.length) {
    for (const e of events) {
      const pay = (e.type === 'job' || e.type === 'rob' || e.type === 'card') && e.outcome === 'win' ? e.pay : e.type === 'bins' ? e.pay : 0;
      if (pay) out.push({ tone: 'gain', icon: 'cash', text: `+${money(pay)}` });
    }
    for (const e of lost) out.push({ tone: 'loss', icon: e.type === 'raid' ? 'bank' : 'cash', text: `−${money(e.seized ?? e.taken)} ${e.type === 'stopped' ? 'seized' : e.type === 'raid' ? 'from the bank' : 'taken'}` });
  } else if (db > 0 && dc < 0 && db === -dc) out.push({ tone: 'gain', icon: 'bank', text: `banked ${money(db)}` });
  else if (db < 0 && dc > 0 && -db === dc) out.push({ tone: 'mute', icon: 'cash', text: `took ${money(dc)} out` });
  else {
    if (dc) out.push({ tone: dc > 0 ? 'gain' : 'loss', icon: 'cash', text: `${dc > 0 ? '+' : '−'}${money(dc)}` });
    if (db) out.push({ tone: db > 0 ? 'gain' : 'loss', icon: 'bank', text: `banked ${db > 0 ? '+' : '−'}${money(db)}` });
  }
  const goods = new Set([...Object.keys(before.goods ?? {}), ...Object.keys(state.goods ?? {}), ...Object.keys(before.stash ?? {}), ...Object.keys(state.stash ?? {})]);
  for (const g of goods) {
    const dg = (state.goods?.[g] ?? 0) - (before.goods?.[g] ?? 0);
    const ds = (state.stash?.[g] ?? 0) - (before.stash?.[g] ?? 0);
    if (dg > 0 && ds < 0 && dg === -ds) out.push({ tone: 'mute', icon: 'goods', text: `${plural(dg, words.good(g, 1), words.good(g, 2))} on you` });
    else if (dg < 0 && ds > 0 && -dg === ds) out.push({ tone: 'mute', icon: 'goods', text: `${plural(ds, words.good(g, 1), words.good(g, 2))} left at home` });
    else {
      if (dg) out.push({ tone: dg > 0 ? 'gain' : 'loss', icon: 'goods', text: `${dg > 0 ? '+' : '−'}${plural(Math.abs(dg), words.good(g, 1), words.good(g, 2))}` });
      if (ds) out.push({ tone: ds > 0 ? 'gain' : 'loss', icon: 'goods', text: `${ds > 0 ? '+' : '−'}${plural(Math.abs(ds), words.good(g, 1), words.good(g, 2))} at home` });
    }
  }
  if (same) {
    const de = state.energy - before.energy;
    if (de) out.push({ tone: de > 0 ? 'gain' : de < -1 ? 'loss' : 'mute', icon: 'energy', text: `${de > 0 ? '+' : '−'}${Math.abs(de)} energy` });
    const dh = state.hour - before.hour;
    if (dh > 0) out.push({ tone: 'mute', icon: 'clock', text: plural(dh, 'hour') });
    if (v1?.tired && !v0?.tired) out.push({ tone: 'risk', icon: 'warn', text: 'tired: odds −15' });
  }
  // heat: where you stand, when you are still there; else your own
  const here = same && state.place === before.place && v0 && v1 ? (v1.heatHere ?? v1.heat) - (v0.heatHere ?? v0.heat) : state.heat - before.heat;
  if (here && !(state.place === 'jail')) out.push({ tone: 'heat', icon: 'heat', text: `heat ${here > 0 ? '+' : '−'}${Math.abs(here)}${same && state.place === before.place ? ' here' : ''}` });
  const police = p => !!(p?.places ?? []).find(q => q.here)?.hot;
  if (same && state.place === before.place && police(v1) && !police(v0)) out.push({ tone: 'heat', icon: 'police', text: 'police about' });
  const dp = same && v0?.pressure && v1?.pressure ? v1.pressure.value - v0.pressure.value : 0;
  if (dp) out.push({ tone: dp > 0 ? 'risk' : 'gain', icon: 'homerisk', text: `home risk ${dp > 0 ? '+' : '−'}${Math.abs(dp)}` });
  for (const e of events) {
    for (const t of [e.trust, ...(e.trusts ?? []).slice(1)].filter(Boolean)) {
      const who = cap(String(t.who?.name ?? 'someone').replace(/^(an? [a-z]+) (at|in|with) .*$/i, '$1'));
      const turned = t.band !== t.bandWas;
      out.push({ tone: turned && t.band === 'against' ? 'loss' : 'trust', icon: 'trust', text: turned ? `${who}: ${t.band === 'against' ? 'against you' : t.band === 'with' ? 'with you' : 'deals again'}` : `${who} ${t.change > 0 ? '+' : '−'}${Math.abs(t.change)}` });
    }
  }
  for (const k of Object.keys(state.owned ?? {})) if (state.owned[k] && !before.owned?.[k]) out.push({ tone: 'gain', icon: 'star', text: `yours: ${String(cfg.shop?.[k]?.label ?? k).replace(/^an? /i, '')}` });
  return out;
}

/** What to try next, when there is something worth saying. */
function nextOf({ cfg, card, state, v1, words }) {
  if (!v1) return null;
  const goal = (v1.shop ?? []).filter(s => !s.owned).sort((a, b) => a.price - b.price)[0];
  const name = goal ? String(goal.label).replace(/^an? /i, '').replace(/^real /, '') : null;
  if (v1.place === 'jail' || v1.place === 'clinic') return null;
  if (v1.danger?.here && v1.carried >= 40) return `You carry ${money(v1.carried)} here, and every hour can go wrong: H heads home to bank it.`;
  if (goal && v1.place === 'crib' && v1.banked >= goal.price) return `You can buy the ${name} now, here at home.`;
  if (goal && v1.place !== 'crib' && v1.carried > 0 && v1.banked < goal.price && v1.banked + v1.carried >= goal.price) return `Bank what you carry (H: home) and the ${name} is yours.`;
  if (v1.place !== 'crib' && v1.energy === 0) return 'Out of energy: head home to sleep.';
  return null;
}

/** The card, short, as a line of the day's journal. */
export function journalOf(card) {
  return { day: card.day, hour: card.hour, at: hourWord(card.hour), tone: card.tone, icon: card.icon, head: card.head, chips: card.chips.slice(0, 3) };
}
export { hourWord };

/**
 * The night's news, for the journal: the step that ended the day has no card (the night's report is its card), but
 * what the night brought (robbed asleep, an attempt on your crib, somebody seen casing it, a regular at the door,
 * Cousin Earl's last day or his going) is a line of the new day's journal, at "Night".
 */
const NIGHT = new Set(['robbed', 'raid', 'casing', 'calledOff', 'door', 'guard']);
export function nightOf({ cfg, before, state, events, v0, v1, words = plainWords(cfg) }) {
  return events.filter(e => NIGHT.has(e.type)).map(e => {
    const h = headOf(e, { cfg, before, state, v0, v1, words });
    const took = e.taken ? [{ tone: 'loss', icon: e.type === 'raid' ? 'bank' : 'cash', text: `−${money(e.taken)}` }] : [];
    return { day: state.day, hour: null, at: 'Night', tone: h.tone, icon: h.icon, head: h.head, chips: took };
  });
}
