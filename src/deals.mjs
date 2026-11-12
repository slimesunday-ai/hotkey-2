// Every trade and every job (SPEC section 6a).
// Deals close by phone and goods move by hand (D12): an offer the other side accepts, from anywhere, in one step,
// then a pick-up that swaps the moment the two share a block. A courier skips the walk for 25%.
// Saying yes is a free reply field, so a trade never costs the one accepting its hour (D57).
// Patterns from hotkey mini's deals.mjs (offers and loans the game holds) and the original engine's rules/fence.mjs.

import { theBlock, distance } from './map.mjs';
import { fenceBuys, fenceSells, courierFee, bailFor, usualProductPrice } from './market.mjs';
import { earn, spend, transfer, hold, release, refund, trustMark, tell, grudge } from './ledger.mjs';
import { nextId, countGood, addGood, removeGood, nameOf, isFree, lastDueHour, dayOf, hourOfDay, qualitiesHeld, clockText } from './state.mjs';
import { level, xpDeal, xpRisk } from './skills.mjs';
import { emit } from './stage.mjs';

export const JOB_TASKS = Object.freeze(['rob', 'fight', 'guard', 'deliver', 'recover', 'bail']);
export const TRADE_GOODS = Object.freeze(['chems', 'parts', 'product', 'gun']);
const NPCS = ['fence', 'gunshop', 'police'];

const no = why => ({ ok: false, why });
const yes = (extra = {}) => ({ ok: true, ...extra });
const isInt = (n, min = 0) => Number.isInteger(n) && n >= min;
const q = terms => (terms.good === 'product' || terms.good === 'gun' ? terms.q ?? 1 : 1);
const goodWord = (good, n) => (good === 'gun' ? (n === 1 ? 'gun' : 'guns') : good);

/** "6 product (quality 3)" */
export function goodsText(good, n, quality) {
  const base = `${n} ${goodWord(good, n)}`;
  return good === 'product' || good === 'gun' ? `${base} (quality ${quality})` : base;
}

/** The value of a deal in dollars, for big beats and XP. */
function dealValue(cfg, terms) {
  if (terms.kind === 'sell' || terms.kind === 'buy') return terms.n * terms.each;
  if (terms.kind === 'tip') return terms.price;
  if (terms.kind === 'loan' || terms.kind === 'borrow') return terms.amount;
  if (terms.kind === 'protect') return terms.price;
  if (terms.kind === 'job') return terms.pay;
  if (terms.kind === 'gift') return terms.cash ?? 0;
  return 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Posting an offer (the `offer` verb). NPC trades and gifts happen at once; everything else waits for an accept.

/** Check an offer's terms without changing anything. The menu and the resolver both use it. */
export function checkOffer(ctx, agent, to, terms) {
  const { cfg, map, state, t } = ctx;
  if (!terms || typeof terms !== 'object') return no('an offer needs terms');
  const kind = terms.kind;

  if (NPCS.includes(to)) return checkNpcOffer(ctx, agent, to, terms);

  const other = to === 'anyone' ? null : state.agents[to];
  if (to !== 'anyone' && (!other || other.id === agent.id)) return no('no such agent to offer to');

  if (kind === 'withdraw') {
    const listing = state.offers.find(o => o.id === terms.id && o.from === agent.id && o.status === 'open');
    return listing ? yes() : no('no open offer of yours with that id');
  }
  // (a new listing for the same goods replaces the old one, so that one doesn't count)
  const replaces = o => (kind === 'sell' || kind === 'buy') && o.terms.kind === kind && o.terms.good === terms.good;
  if (to === 'anyone' && state.offers.filter(o => o.from === agent.id && o.to === 'anyone' && o.status === 'open' && !replaces(o)).length >= cfg.deals.listingsPerAgent) {
    return no(`you already have ${cfg.deals.listingsPerAgent} listings up`);
  }

  if (kind === 'sell' || kind === 'buy') {
    if (!TRADE_GOODS.includes(terms.good)) return no('no such goods');
    if (!isInt(terms.n, 1) || !isInt(terms.each, 1)) return no('a trade needs a whole number of units and a price each');
    if (kind === 'sell' && countGood(agent, terms.good, terms.good === 'product' || terms.good === 'gun' ? q(terms) : null) < terms.n) return no("you don't have that many to sell");
    // on credit: the goods change hands now and the game collects the cash by a due hour
    if (terms.due !== undefined && (!isInt(terms.due) || terms.due <= t + 1 || terms.due > lastDueHour(cfg))) return no('credit falls due after next hour and no later than 21:00 on day 5');
    if (terms.courier && agent.cash < courierFee(cfg, terms.n * terms.each) + (kind === 'buy' && terms.due === undefined ? terms.n * terms.each : 0)) return no("you can't cover the courier");
    return yes();
  }
  if (kind === 'tip') {
    const tip = state.tips.find(x => x.id === terms.tip);
    if (!tip || !tip.holders.includes(agent.id) || tip.expires <= t) return no("you don't hold that tip");
    if (!isInt(terms.price, 1) || terms.price > cfg.deals.tipMaxPrice) return no(`a tip costs between $1 and $${cfg.deals.tipMaxPrice}`);
    return yes();
  }
  if (kind === 'loan' || kind === 'borrow') {
    if (!isInt(terms.amount, 1) || !isInt(terms.repay, terms.amount)) return no('a loan needs an amount and a repayment at least as big');
    if (!isInt(terms.due) || terms.due <= t + 1 || terms.due > lastDueHour(cfg)) return no('a loan falls due after next hour and no later than 21:00 on day 5');
    if (kind === 'loan' && agent.cash < terms.amount) return no("you don't carry that much to lend");
    if (to === 'anyone' && kind === 'borrow') return yes();
    return yes();
  }
  if (kind === 'protect') {
    if (agent.cls !== 'muscle') return no('only a muscle sells protection; anyone can take a guard job');
    if (!isInt(terms.hours, 1) || terms.hours > 12 || !isInt(terms.price, 1)) return no('protection needs hours (1 to 12) and a price');
    if (state.contracts.some(c => c.active && c.muscle === agent.id)) return no('you already have a client');
    return yes();
  }
  if (kind === 'job') {
    const task = terms.task;
    if (!task || !JOB_TASKS.includes(task.type)) return no('no such kind of job');
    if (!isInt(terms.pay, 1)) return no('a job needs pay');
    if (terms.fromPot) {
      const crew = agent.crew ? state.crews[agent.crew] : null;
      if (!crew || crew.boss !== agent.id) return no('only the boss pays from the crew pot');
      if (crew.pot < terms.pay) return no("the pot doesn't hold that much");
    } else if (agent.cash < terms.pay) return no("you don't carry the pay");
    if (['rob', 'fight', 'bail'].includes(task.type) && (!state.agents[task.agent] || task.agent === agent.id)) return no('that job needs a target');
    // a job nobody could ever take would only be a place to hide cash: it can't be about the one it's offered to
    if (['rob', 'fight', 'bail', 'deliver'].includes(task.type) && task.agent === to) return no("you can't hire someone for a job about themselves");
    if (task.type === 'guard' && (task.agent ?? agent.id) === to) return no('nobody is paid to guard themselves');
    if (terms.fromPot && t >= lastDueHour(cfg)) return no('the pot is closed for the last hours of the season');
    if (task.type === 'guard') {
      if (!isInt(task.hours, 1) || task.hours > 12) return no('a guard job needs hours (1 to 12)');
      if (task.agent && !state.agents[task.agent]) return no('no such agent to guard');
    }
    if (task.type === 'deliver') {
      if (!TRADE_GOODS.includes(task.good) || !isInt(task.n, 1) || !state.agents[task.agent]) return no('a delivery needs goods, a number and someone to hand them to');
    }
    if (task.type === 'recover' && !state.loot.some(l => l.victim === agent.id && l.until > t && !l.done)) return no('nothing of yours is out there to get back');
    return yes();
  }
  if (kind === 'gift') {
    if (to === 'anyone') return no('a gift needs someone to give it to');
    if (terms.cash !== undefined) {
      if (!isInt(terms.cash, 1) || agent.cash < terms.cash + (terms.courier ? courierFee(cfg, terms.cash) : 0)) return no("you don't carry that much");
      return yes();
    }
    if (!TRADE_GOODS.includes(terms.good) || !isInt(terms.n, 1)) return no('a gift is cash or goods');
    if (countGood(agent, terms.good, terms.good === 'product' || terms.good === 'gun' ? q(terms) : null) < terms.n) return no("you don't have that many to give");
    return yes();
  }
  return no('no such kind of offer');
}

function checkNpcOffer(ctx, agent, to, terms) {
  const { cfg, map, state, t } = ctx;
  if (to === 'fence') {
    if (agent.block !== theBlock(map, 'fence')) return no('the fence is at the market');
    if (terms.kind === 'sell') {
      if (!TRADE_GOODS.includes(terms.good) || !isInt(terms.n, 1)) return no('sell the fence a number of goods');
      if (countGood(agent, terms.good, terms.good === 'product' || terms.good === 'gun' ? q(terms) : null) < terms.n) return no("you don't have that many");
      return yes();
    }
    if (terms.kind === 'stake') {
      // the loan shark works the fence's counter: one stake at a time, for someone with next to nothing
      if (agent.sharkDebt > 0) return no('you still owe the loan shark');
      if (agent.cash + agent.stash >= cfg.shark.onlyUnder) return no('the loan shark only stakes people who are broke');
      if (!isInt(terms.amount, 1) || terms.amount > cfg.shark.max) return no(`the loan shark stakes up to ${cfg.shark.max}`);
      return yes();
    }
    if (terms.kind === 'buy') {
      if (!['chems', 'parts', 'product'].includes(terms.good) || !isInt(terms.n, 1)) return no('the fence sells chems, parts and quality 1 product');
      if (terms.good === 'product' && state.fenceProductSold + terms.n > cfg.fence.productPerDay) return no(`the fence has ${Math.max(0, cfg.fence.productPerDay - state.fenceProductSold)} product left today`);
      if (agent.cash < terms.n * fenceSells(cfg, terms.good)) return no("you can't afford that");
      return yes();
    }
    return no('you buy from the fence or sell to it');
  }
  if (to === 'gunshop') {
    if (agent.block !== theBlock(map, 'gunshop')) return no('the gun shop is at the market');
    if (terms.kind !== 'buy' || terms.good !== 'gun') return no('the gun shop sells guns');
    if (agent.cash < cfg.gunshop.price) return no("you can't afford a gun");
    return yes();
  }
  // the police: a crime tip, or bail
  const atDesk = agent.block === theBlock(map, 'police');
  if (terms.kind === 'tip') {
    const byPhone = agent.cls === 'informant' && level(agent, 'network') >= cfg.floors.networkPhoneAt;
    if (!atDesk && !byPhone) return no('the police buy tips at the precinct');
    const tip = state.tips.find(x => x.id === terms.tip);
    if (!tip || tip.type !== 'crime' || !tip.holders.includes(agent.id)) return no("you don't hold that crime tip");
    return yes();
  }
  if (terms.kind === 'bail') {
    if (!atDesk) return no('bail is paid at the precinct');
    const prisoner = state.agents[terms.agent];
    if (!prisoner || prisoner.state !== 'jail') return no("they aren't in jail");
    const price = bailFor(cfg, prisoner.jailStars ?? 0);
    if (terms.fromPot) {
      const crew = agent.crew ? state.crews[agent.crew] : null;
      if (t >= lastDueHour(cfg)) return no('the pot is closed for the last hours of the season');
      if (!crew || crew.boss !== agent.id || crew.pot < price) return no("the pot can't cover bail");
    } else if (agent.cash < price) return no(`bail is $${price}`);
    return yes();
  }
  return no('the police buy crime tips and take bail');
}

/** The `offer` verb. Returns { ok, why } and emits what a viewer would see. */
export function postOffer(ctx, agent, to, terms) {
  const { cfg, map, state, t } = ctx;
  const check = checkOffer(ctx, agent, to, terms);
  if (!check.ok) return check;
  agent.stats.offersMade += 1;

  if (to === 'fence') return fenceTrade(ctx, agent, terms);
  if (to === 'gunshop') {
    spend(state, agent, cfg.gunshop.price, 'gunshop');
    addGood(agent, 'gun', 1, cfg.gunshop.quality);
    emit(ctx, 'offer:gunshop', { block: agent.block, spot: 'counter:gunshop', who: { agent: agent.id, npc: 'npc:gunshop' }, data: { price: cfg.gunshop.price } });
    return yes({ text: `bought a gun for $${cfg.gunshop.price}` });
  }
  if (to === 'police') return terms.kind === 'bail' ? payBail(ctx, agent, terms) : sellCrimeToPolice(ctx, agent, terms.tip, 'offer:police');

  if (terms.kind === 'withdraw') {
    const listing = state.offers.find(o => o.id === terms.id);
    listing.status = 'withdrawn';
    giveBackHeld(state, listing, listing.from); // a withdrawn job's pay goes back where it came from
    emit(ctx, 'offer:board', { block: agent.block, who: { from: agent.id }, data: { withdrew: listing.id } });
    return yes({ text: 'took the listing down' });
  }

  if (terms.kind === 'gift') return giveGift(ctx, agent, state.agents[to], terms);

  // one listing per kind of goods: a new one replaces the old one, so a price or terms can be changed in one move
  if (to === 'anyone' && (terms.kind === 'sell' || terms.kind === 'buy')) {
    for (const old of state.offers) {
      if (old.status === 'open' && old.from === agent.id && old.to === 'anyone' && old.terms.kind === terms.kind && old.terms.good === terms.good) old.status = 'withdrawn';
    }
  }

  const offer = {
    id: nextId(state, 'o'),
    from: agent.id,
    to,
    terms: cleanTerms(terms),
    t,
    visibleAt: t + 1,
    // a board listing stays up until it sells; a board job lasts until midnight; the rest last 3 hours
    expires: to === 'anyone' && terms.kind !== 'job' ? null : to === 'anyone' ? dayOf(cfg, t) * cfg.season.hoursPerDay
      : terms.kind === 'job' ? Math.min(dayOf(cfg, t) * cfg.season.hoursPerDay, t + 1 + cfg.deals.offerHours) : t + 1 + cfg.deals.offerHours,
    status: 'open',
  };
  if (terms.kind === 'job') {
    // the game holds the pay from the moment the job is posted
    offer.held = 0;
    if (terms.fromPot) {
      const crew = state.crews[agent.crew];
      crew.pot -= terms.pay;
      offer.held = terms.pay;
      offer.crew = crew.id;
    } else hold(state, agent, terms.pay, offer);
    emit(ctx, 'job:posted', { block: agent.block, who: { poster: agent.id }, data: { offer: offer.id, task: terms.task, pay: terms.pay, to } });
  } else if (to === 'anyone') {
    emit(ctx, 'offer:board', { block: agent.block, who: { from: agent.id }, data: { offer: offer.id, terms: structuredClone(offer.terms) } });
  } else {
    emit(ctx, 'offer:made', { block: agent.block, who: { from: agent.id, to }, data: { offer: offer.id, terms: structuredClone(offer.terms) } });
  }
  state.offers.push(offer);
  return yes({ offer: offer.id, text: `offered ${offerText(cfg, state, offer, agent.id)}` });
}

function cleanTerms(terms) {
  const out = { kind: terms.kind };
  for (const key of ['good', 'q', 'n', 'each', 'tip', 'price', 'amount', 'repay', 'due', 'hours', 'pay', 'sharePct', 'fromPot', 'courier']) {
    if (terms[key] !== undefined) out[key] = terms[key];
  }
  if ((out.good === 'product' || out.good === 'gun') && out.q === undefined) out.q = 1;
  if (terms.task) out.task = { type: terms.task.type, ...(terms.task.agent ? { agent: terms.task.agent } : {}), ...(terms.task.hours ? { hours: terms.task.hours } : {}),
    ...(terms.task.good ? { good: terms.task.good, n: terms.task.n, q: terms.task.q ?? 1 } : {}) };
  return out;
}

/** An offer in words, as the agent `viewer` would read it. */
export function offerText(cfg, state, offer, viewer) {
  const tm = offer.terms;
  const from = offer.from === viewer ? 'you' : nameOf(state, offer.from);
  const total = tm.n * tm.each;
  switch (tm.kind) {
    case 'sell': return `${from === 'you' ? 'you sell' : from + ' sells'} ${goodsText(tm.good, tm.n, tm.q)} for $${tm.each} each ($${total})${tm.due !== undefined ? `, on credit: pay by ${clockText(cfg, tm.due)}` : ''}${tm.courier ? ', by courier' : ''}`;
    case 'buy': return `${from === 'you' ? 'you buy' : from + ' buys'} ${goodsText(tm.good, tm.n, tm.q)} for $${tm.each} each ($${total})${tm.due !== undefined ? `, on credit: paid by ${clockText(cfg, tm.due)}` : ''}${tm.courier ? ', by courier' : ''}`;
    case 'tip': return `${from === 'you' ? 'you sell' : from + ' sells'} a tip for $${tm.price}: ${tipTeaser(state, tm.tip)}`;
    case 'loan': return `${from === 'you' ? 'you lend' : from + ' lends'} $${tm.amount}, $${tm.repay} back by ${clockText(cfg, tm.due)}`;
    case 'borrow': return `${from === 'you' ? 'you borrow' : from + ' wants to borrow'} $${tm.amount}, $${tm.repay} back by ${clockText(cfg, tm.due)}`;
    case 'protect': return `${from === 'you' ? 'you guard them' : from + ' guards you'} for ${tm.hours} hours, $${tm.price}`;
    case 'job': return `${from === 'you' ? 'your job' : 'a job from ' + from}: ${taskText(state, tm.task, offer.from)}, pays $${tm.pay}${tm.sharePct ? ` plus ${tm.sharePct}% of what comes back` : ''}`;
    case 'crew-invite': return `${from} invites you into ${state.crews[tm.crew]?.name ?? 'a crew'}`;
    case 'snitch': return `the snitch saw what you did: $${tm.price} and he forgets it`;
    default: return tm.kind;
  }
}

export function taskText(state, task, posterId) {
  const who = id => (id ? nameOf(state, id) : nameOf(state, posterId));
  switch (task.type) {
    case 'rob': return `rob ${who(task.agent)}`;
    case 'fight': return `put ${who(task.agent)} in the clinic`;
    case 'guard': return `guard ${who(task.agent)} for ${task.hours} hours`;
    case 'deliver': return `hand ${goodsText(task.good, task.n, task.q)} to ${who(task.agent)}`;
    case 'recover': return `get back what was stolen from ${who(posterId)}`;
    case 'bail': return `bail ${who(task.agent)} out`;
    default: return task.type;
  }
}

function tipTeaser(state, tipId) {
  const tip = state.tips.find(x => x.id === tipId);
  if (!tip) return 'gone';
  if (tip.type === 'cash') return `what ${nameOf(state, tip.subject)} is carrying`;
  if (tip.type === 'route') return 'where the police will be for the next 6 hours';
  return `a crime ${nameOf(state, tip.subject)} did`;
}

// ---------------------------------------------------------------------------------------------------------------
// NPC trades

function fenceTrade(ctx, agent, terms) {
  const { cfg, state } = ctx;
  if (terms.kind === 'stake') {
    agent.cash += terms.amount;
    agent.sharkDebt = Math.ceil((terms.amount * cfg.shark.repayPct) / 100);
    state.books.in['loan shark'] = (state.books.in['loan shark'] ?? 0) + terms.amount;
    emit(ctx, 'offer:fence', { block: agent.block, spot: 'counter:fence', who: { agent: agent.id, npc: 'npc:fence' }, data: { stake: terms.amount, owed: agent.sharkDebt }, big: true });
    return yes({ text: `took a ${terms.amount} stake from the loan shark; ${agent.sharkDebt} comes out of what you earn next` });
  }
  const quality = q(terms);
  if (terms.kind === 'sell') {
    const each = fenceBuys(cfg, terms.good, quality, agent.cls === 'smuggler' ? level(agent, 'barter') : 0);
    removeGood(agent, terms.good, terms.n, quality);
    earn(state, agent, each * terms.n, 'fence');
    emit(ctx, 'offer:fence', { block: agent.block, spot: 'counter:fence', who: { agent: agent.id, npc: 'npc:fence' }, data: { sold: terms.good, n: terms.n, q: quality, cash: each * terms.n } });
    return yes({ text: `sold ${goodsText(terms.good, terms.n, quality)} to the fence for $${each * terms.n}` });
  }
  const each = fenceSells(cfg, terms.good);
  spend(state, agent, each * terms.n, 'fence');
  addGood(agent, terms.good, terms.n, 1);
  if (terms.good === 'product') state.fenceProductSold += terms.n;
  emit(ctx, 'offer:fence', { block: agent.block, spot: 'counter:fence', who: { agent: agent.id, npc: 'npc:fence' }, data: { bought: terms.good, n: terms.n, cash: each * terms.n } });
  return yes({ text: `bought ${goodsText(terms.good, terms.n, 1)} from the fence for $${each * terms.n}` });
}

/** Sell a crime to the police. They pay once for each crime, to whoever brings it first; the criminal's heat goes up. */
export function sellCrimeToPolice(ctx, agent, tipId, kind) {
  const { cfg, state, t } = ctx;
  const tip = state.tips.find(x => x.id === tipId);
  const crime = state.crimes.find(c => c.id === tip.crime);
  tip.holders = tip.holders.filter(id => id !== agent.id);
  const fresh = crime && !crime.reported;
  let pay = 0;
  if (fresh) {
    crime.reported = true;
    pay = Math.floor((cfg.floors.crimeTip * (100 + cfg.floors.networkPct * (agent.cls === 'informant' ? level(agent, 'network') : 0))) / 100);
    earn(state, agent, pay, 'police');
    const criminal = state.agents[crime.by];
    criminal.heat = Math.min(cfg.heat.max, criminal.heat + cfg.snitch.heat);
    tell(state, criminal.id, t, `Someone sold the police what you did at the ${crime.block}. Your heat is ${criminal.heat} stars.`);
    burnSource(ctx, tip, criminal, agent);
  }
  const who = { agent: agent.id, informant: agent.id, officer: 'npc:police1' };
  emit(ctx, kind, { block: agent.block, spot: kind === 'offer:police' ? 'desk' : 'street', who, data: { crime: crime?.id, pay, by: crime?.by } });
  return yes({ text: fresh ? `sold a crime to the police for $${pay}` : 'the police already had that one: nothing paid' });
}

/** When a tip is used against someone, they learn who sold it unless the informant's Cover saves it (SPEC section 12). */
export function burnSource(ctx, tip, subject, user) {
  const { cfg, state, t } = ctx;
  const source = state.agents[tip.madeBy];
  if (!source || source.id === subject.id) return false;
  const coverPct = cfg.tips.coverBasePct + cfg.tips.coverPct * level(source, 'cover');
  const roll = Math.floor(ctx.rand('cover', tip.id, subject.id)() * 100);
  if (source.cls === 'informant') xpRisk(cfg, source, 'a tip that got used');
  if (roll < coverPct) return false;
  trustMark(state, cfg, subject.id, source.id, -3, 'sold you out', t);
  grudge(state, subject, source.id, 'sold you out', t);
  tell(state, subject.id, t, `Word is ${source.name} sold the tip that was used against you.`);
  emit(ctx, 'tip:burned', { block: subject.block, who: { subject: subject.id }, data: { source: source.id, user: user.id } });
  return true;
}

function payBail(ctx, agent, terms) {
  const { cfg, state, t } = ctx;
  const prisoner = state.agents[terms.agent];
  const price = bailFor(cfg, prisoner.jailStars ?? 0);
  if (terms.fromPot) {
    const crew = state.crews[agent.crew];
    crew.pot -= price;
    state.books.out.bail = (state.books.out.bail ?? 0) + price;
  } else spend(state, agent, price, 'bail');
  prisoner.until = t + 1;
  prisoner.bailedBy = agent.id;
  trustMark(state, cfg, prisoner.id, agent.id, +2, 'bailed you out', t);
  tell(state, prisoner.id, t, `${agent.name} paid your bail. You walk out next hour.`);
  emit(ctx, 'bail', { block: agent.block, spot: 'desk', who: { payer: agent.id, prisoner: prisoner.id, officer: 'npc:police2' }, data: { price } });
  jobDeed(ctx, 'bail', agent, { target: prisoner.id });
  return yes({ text: `paid $${price} bail for ${prisoner.name}` });
}

// ---------------------------------------------------------------------------------------------------------------
// Gifts: nothing asked in return, so no accept. Handed over when the two share a block, or sent by courier.

function giveGift(ctx, agent, other, terms) {
  const { cfg, state, t } = ctx;
  const item = terms.cash !== undefined ? { cash: terms.cash } : { good: terms.good, q: q(terms), n: terms.n };
  const pickup = {
    id: nextId(state, 'p'), kind: 'gift', a: agent.id, b: other.id, aGives: item, bGives: null, t, expires: t + cfg.deals.pickupHours, offer: null,
  };
  if (terms.courier) {
    const fee = courierFee(cfg, item.cash ?? item.n * giftUnitValue(cfg, item));
    if (agent.cash < fee + (item.cash ?? 0)) return no("you can't cover the courier");
    spend(state, agent, fee, 'courier');
    swap(ctx, pickup, { courier: true });
    return yes({ text: `sent ${itemText(item)} to ${other.name} by courier ($${fee})` });
  }
  if (agent.block === other.block && isFree(other)) {
    swap(ctx, pickup, {});
    return yes({ text: `gave ${itemText(item)} to ${other.name}` });
  }
  state.pickups.push(pickup);
  tell(state, other.id, t, `${agent.name} has ${itemText(item)} for you. Meet them to get it.`);
  return yes({ text: `will hand ${itemText(item)} to ${other.name} when you meet` });
}

const giftUnitValue = (cfg, item) => (item.good === 'chems' ? cfg.usual.chems : item.good === 'parts' ? cfg.usual.parts : item.good === 'gun' ? cfg.usual.gun * item.q : usualProductPrice(cfg, item.q));
const itemText = item => (item.cash !== undefined ? `$${item.cash}` : goodsText(item.good, item.n, item.q));

// ---------------------------------------------------------------------------------------------------------------
// Saying yes (the free `accept` field)

/** What an agent can accept right now: offers made to it or to anyone, that it has had a chance to see. */
export function offersFor(state, agent, t) {
  return state.offers.filter(o => o.status === 'open' && o.from !== agent.id && o.visibleAt <= t && (o.expires === null || o.expires > t)
    && (o.to === agent.id || o.to === 'anyone'));
}

/** Accept one offer. `entry` is an id, or { id, courier, units }. */
export function acceptOffer(ctx, agent, entry) {
  const { cfg, state, t } = ctx;
  const id = typeof entry === 'string' ? entry : entry?.id;
  const offer = offersFor(state, agent, t).find(o => o.id === id);
  if (!offer) return no('no such offer open to you');
  const tm = offer.terms;
  const from = state.agents[offer.from];
  const opts = typeof entry === 'object' ? entry : {};

  if (tm.kind === 'snitch') {
    if (agent.cash < tm.price) return no("you can't pay the snitch");
    spend(state, agent, tm.price, 'snitch');
    offer.status = 'closed';
    const crime = state.crimes.find(c => c.id === tm.crime);
    if (crime) crime.hushed = true;
    emit(ctx, 'npc:snitch:paid', { block: agent.block, who: { agent: agent.id, snitch: 'npc:snitch' }, data: { price: tm.price } });
    return yes({ text: `paid the snitch $${tm.price}` });
  }
  if (tm.kind === 'crew-invite') return ctx.joinCrew(ctx, agent, offer);

  if (tm.kind === 'sell' || tm.kind === 'buy') {
    const listing = offer.to === 'anyone';
    const seller = tm.kind === 'sell' ? from : agent;
    const buyer = tm.kind === 'sell' ? agent : from;
    // a seller can only promise what it holds and hasn't promised to someone else already
    const graded = tm.good === 'product' || tm.good === 'gun';
    const freeOf = quality => countGood(seller, tm.good, quality)
      - state.pickups.filter(p => !p.done && p.kind === 'trade' && p.a === seller.id && p.aGives.good === tm.good && (quality === null || p.aGives.q === quality)).reduce((sum, p) => sum + p.aGives.n, 0);
    // an order to buy is for that quality or better: the seller fills it with the least it can, or names a quality
    let quality0 = graded ? tm.q ?? 1 : null;
    if (graded && tm.kind === 'buy') {
      const held = qualitiesHeld(seller, tm.good).filter(x => x >= (tm.q ?? 1) && freeOf(x) >= 1).sort((a, b) => a - b);
      quality0 = held.includes(opts.q) ? opts.q : held[0] ?? quality0;
    }
    const free = freeOf(quality0);
    if (free < 1) {
      if (tm.kind === 'sell') offer.status = 'expired'; // sold out
      return no(tm.kind === 'sell' ? 'that listing is sold out' : "you don't have any free to sell");
    }
    let units = listing && isInt(opts.units, 1) ? Math.min(opts.units, tm.n) : tm.n;
    if (listing || tm.kind === 'sell') units = Math.min(units, free);
    else if (free < units) return no("you don't have that many free to sell");
    if (tm.due !== undefined && tm.due <= t + 1) return no('that offer asks to be paid by an hour that has passed');
    // saying yes to a cash deal means carrying the cash: an empty pocket can't tie up someone's stock
    if (tm.due === undefined) {
      const affordable = Math.floor(buyer.cash / tm.each);
      if (affordable < 1 || (affordable < units && !listing)) return no(buyer.id === agent.id ? "you don't carry the cash for that" : `${buyer.name} isn't carrying the cash for that right now`);
      units = Math.min(units, affordable);
    }
    const price = units * tm.each;
    const courier = tm.courier ? offer.from : opts.courier ? agent.id : null;
    const pickup = {
      id: nextId(state, 'p'), kind: 'trade', a: seller.id, b: buyer.id, aGives: { good: tm.good, q: quality0 ?? 1, n: units }, bGives: { cash: price }, each: tm.each,
      t, expires: t + cfg.deals.pickupHours, offer: offer.id, ...(tm.due !== undefined ? { due: Math.min(tm.due, lastDueHour(cfg)) } : {}),
    };
    if (courier) {
      const payer = state.agents[courier];
      const fee = courierFee(cfg, price);
      const quality = quality0;
      if (countGood(seller, tm.good, quality) < units) return no(`${seller.id === agent.id ? "you don't" : seller.name + " doesn't"} have the goods for a courier to carry`);
      if (buyer.cash < (tm.due !== undefined ? 0 : price) + (payer.id === buyer.id ? fee : 0)) return no(`${buyer.id === agent.id ? "you can't" : buyer.name + " can't"} cover it`);
      if (payer.id === seller.id && seller.cash < fee) return no("the courier's fee can't be covered");
      spend(state, payer, fee, 'courier');
      closeOffer(offer, units);
      emit(ctx, 'deal:closed', { block: agent.block, who: { a: agent.id, b: from.id }, data: { offer: offer.id, courier: true } });
      swap(ctx, pickup, { courier: true });
      return yes({ text: `closed with ${from.name} by courier ($${fee})` });
    }
    closeOffer(offer, units);
    emit(ctx, 'deal:closed', { block: agent.block, who: { a: agent.id, b: from.id }, data: { offer: offer.id, pickup: pickup.id } });
    tell(state, from.id, t, `${agent.name} said yes: ${goodsText(tm.good, units, tm.q ?? 1)} for $${price}. Meet to swap.`);
    if (seller.block === buyer.block && isFree(seller) && isFree(buyer)) swap(ctx, pickup, {});
    else state.pickups.push(pickup);
    return yes({ text: `closed with ${from.name}: ${goodsText(tm.good, units, tm.q ?? 1)} for $${price}` });
  }

  if (tm.kind === 'tip') {
    const tip = state.tips.find(x => x.id === tm.tip);
    if (!tip || !tip.holders.includes(from.id) || tip.expires <= t) {
      offer.status = 'expired';
      return no('that tip is gone');
    }
    if (tip.holders.includes(agent.id)) return no('you already have that tip');
    const byHand = from.block === agent.block && isFree(from);
    const byPhone = from.cls === 'informant' && level(from, 'network') >= cfg.floors.networkPhoneAt;
    const fee = byHand || byPhone ? 0 : courierFee(cfg, tm.price);
    if (agent.cash < tm.price + fee) return no(`you need $${tm.price + fee} on you${fee ? ` ($${fee} of it for the courier)` : ''}`);
    if (fee) spend(state, agent, fee, 'courier');
    transfer(state, agent, from, tm.price, { income: true });
    tip.holders.push(agent.id);
    tip.soldTo.push(agent.id);
    offer.status = 'closed'; // one sale per offer: selling the same tip twice is something an agent chooses to do
    if (tip.soldTo.length === 2 && from.cls === 'informant') {
      xpRisk(cfg, from, 'one tip sold twice');
      from.stats.betrayals += 1;
    }
    noteTrade(ctx, from, agent, tm.price, { handoff: byHand, courier: !!fee });
    emit(ctx, 'tip:sold', { block: agent.block, who: { seller: from.id, buyer: agent.id }, data: { tip: tip.id, type: tip.type, subject: tip.subject, price: tm.price, twice: tip.soldTo.length > 1 }, big: tip.soldTo.length === 2 });
    tell(state, from.id, t, `${agent.name} bought your tip for $${tm.price}.`);
    return yes({ text: `bought a tip from ${from.name} for $${tm.price}` });
  }

  if (tm.kind === 'loan' || tm.kind === 'borrow') {
    const lender = tm.kind === 'loan' ? from : agent;
    const borrower = tm.kind === 'loan' ? agent : from;
    if (lender.cash < tm.amount) return no(`${lender.id === agent.id ? "you don't" : lender.name + " doesn't"} carry $${tm.amount} to lend`);
    const pickup = {
      id: nextId(state, 'p'), kind: 'loan', a: lender.id, b: borrower.id, aGives: { cash: tm.amount }, bGives: null, t, expires: t + cfg.deals.pickupHours, offer: offer.id,
      loan: { amount: tm.amount, repay: tm.repay, due: Math.min(tm.due, lastDueHour(cfg)) },
    };
    const byCourier = opts.courier || tm.courier;
    const payer = tm.courier ? from : agent;
    const fee = byCourier ? courierFee(cfg, tm.amount) : 0;
    if (byCourier && payer.cash < fee + (payer.id === lender.id ? tm.amount : 0)) return no("the courier's fee can't be covered");
    offer.status = 'closed';
    emit(ctx, 'deal:closed', { block: agent.block, who: { a: agent.id, b: from.id }, data: { offer: offer.id, pickup: pickup.id } });
    if (byCourier) {
      spend(state, payer, fee, 'courier');
      swap(ctx, pickup, { courier: true });
    } else if (lender.block === borrower.block && isFree(lender) && isFree(borrower)) swap(ctx, pickup, {});
    else state.pickups.push(pickup);
    return yes({ text: `agreed a loan of $${tm.amount} with ${from.name}` });
  }

  if (tm.kind === 'protect') {
    if (state.contracts.some(c => c.active && c.muscle === from.id)) {
      offer.status = 'expired';
      return no(`${from.name} already has a client`);
    }
    if (agent.cash < tm.price) return no(`you need $${tm.price} on you to hire ${from.name}`);
    const contract = {
      id: nextId(state, 'c'), muscle: from.id, client: agent.id, hours: tm.hours, price: tm.price, perHour: Math.floor(tm.price / tm.hours), held: 0,
      // nothing the game holds lasts past midnight: a contract runs to the end of the day at most
      t0: t + 1, until: Math.min(t + 1 + tm.hours, dayOf(cfg, t) * cfg.season.hoursPerDay), active: true, paidHours: 0, tested: false,
    };
    hold(state, agent, tm.price, contract);
    state.contracts.push(contract);
    offer.status = 'closed';
    emit(ctx, 'contract:start', { block: agent.block, who: { muscle: from.id, client: agent.id }, data: { contract: contract.id, hours: tm.hours, price: tm.price } });
    tell(state, from.id, t, `${agent.name} hired you for ${tm.hours} hours ($${tm.price}).`);
    return yes({ text: `hired ${from.name} for ${tm.hours} hours` });
  }

  if (tm.kind === 'job') {
    if (state.jobs.some(j => j.status === 'taken' && j.worker === agent.id)) return no('you already hold a job');
    if (tm.task.agent === agent.id || (tm.task.type === 'guard' && (tm.task.agent ?? offer.from) === agent.id)) return no('that job is about you');
    const job = {
      id: nextId(state, 'j'), poster: offer.from, worker: agent.id, task: tm.task, pay: tm.pay, sharePct: tm.sharePct ?? 0, held: offer.held, crew: offer.crew ?? null,
      ...(offer.house ? { house: true } : {}),
      t, expires: Math.min(dayOf(cfg, t) * cfg.season.hoursPerDay, t + 1 + (tm.task.type === 'guard' ? tm.task.hours : cfg.deals.jobHours)), status: 'taken', done: 0,
      perHour: tm.task.type === 'guard' ? Math.floor(tm.pay / tm.task.hours) : 0,
    };
    if (job.task.type === 'guard' && !job.task.agent) job.task.agent = offer.from;
    offer.held = 0;
    offer.status = 'closed';
    state.jobs.push(job);
    emit(ctx, 'job:taken', { block: agent.block, who: { worker: agent.id, poster: offer.from }, data: { job: job.id, task: job.task, pay: job.pay, ...(offer.house ? { house: true } : {}) } });
    tell(state, offer.from, t, `${agent.name} took your job: ${taskText(state, job.task, offer.from)}.`);
    return yes({ text: `took the job: ${taskText(state, job.task, offer.from)} for $${job.pay}` });
  }
  return no("that can't be accepted");
}

function closeOffer(offer, units) {
  if (offer.to === 'anyone' && offer.terms.n > units) offer.terms.n -= units; // the rest of the listing stays up
  else offer.status = 'closed';
}

// ---------------------------------------------------------------------------------------------------------------
// The hand-off

/** Count a finished trade for both sides: trust, XP, the marks, and a big beat when it's big. */
function noteTrade(ctx, a, b, value, { handoff = false, courier = false } = {}) {
  const { cfg, state, t } = ctx;
  for (const [x, y] of [[a, b], [b, a]]) {
    x.stats.trades += 1;
    if (handoff) x.stats.handoffs += 1;
    if (courier) x.stats.couriered += 1;
    trustMark(state, cfg, x.id, y.id, +1, 'a clean deal', t);
    xpDeal(cfg, x, y.id, value);
  }
  ctx.tally.trades += 1;
  if (handoff) ctx.tally.handoffs += 1;
  if (courier) ctx.tally.couriered += 1;
}

/** Swap both sides of a pick-up. With `courier`, wherever they are; otherwise they're standing together. */
function swap(ctx, p, { courier = false }) {
  const { cfg, state, t } = ctx;
  const a = state.agents[p.a];
  const b = state.agents[p.b];
  let short = null;

  if (p.kind === 'trade') {
    const item = p.aGives;
    const quality = item.good === 'product' || item.good === 'gun' ? item.q : null;
    const have = Math.min(item.n, countGood(a, item.good, quality));
    const onCredit = p.due !== undefined;
    const afford = onCredit ? item.n : Math.floor(b.cash / p.each);
    const units = Math.min(have, afford);
    if (have < item.n) short = a;
    if (afford < item.n && (!short || afford < have)) short = b;
    if (units > 0) {
      removeGood(a, item.good, units, item.q);
      addGood(b, item.good, units, item.q);
      if (onCredit) {
        // goods now, cash later: the game collects by the due hour, and an unpaid one is a debt anyone can see
        const loan = { id: nextId(state, 'l'), lender: a.id, borrower: b.id, amount: units * p.each, owed: units * p.each, due: p.due, status: 'open', t, credit: true };
        state.loans.push(loan);
        tell(state, b.id, t, `You owe ${a.name} $${loan.owed} for the goods, due by ${clockText(cfg, loan.due)}.`);
      } else transfer(state, b, a, units * p.each);
      noteTrade(ctx, a, b, units * p.each, { handoff: !courier, courier });
      jobDelivery(ctx, a, b, item.good, units);
      if (a.cls === 'cook' && item.good === 'product' && !courier && a.block !== theBlock(ctx.map, 'pads')) xpRisk(cfg, a, 'a hand-off away from home');
    }
    const data = { pickup: p.id, good: item.good, q: item.q, n: units, asked: item.n, cash: units * p.each, each: p.each, short: short?.id ?? null, ...(onCredit ? { credit: true, due: p.due } : {}) };
    if (short) {
      trustMark(state, cfg, (short === a ? b : a).id, short.id, -1, 'came up short', t);
      tell(state, (short === a ? b : a).id, t, `${short.name} came up short at the pick-up: ${units} of ${item.n}.`);
    }
    const big = units * p.each >= cfg.deals.bigDeal || !!short;
    if (courier) emit(ctx, 'courier', { block: b.block, who: { courier: 'npc:courier', a: a.id, b: b.id }, data, big });
    else emit(ctx, short ? 'pickup:short' : 'pickup', { block: a.block, spot: spotFor(ctx, a, b), who: { a: b.id, b: a.id }, data, big });
    tell(state, a.id, t, `Handed ${goodsText(item.good, units, item.q)} to ${b.name} for $${units * p.each}.`);
    tell(state, b.id, t, `Got ${goodsText(item.good, units, item.q)} from ${a.name} for $${units * p.each}.`);
  } else if (p.kind === 'gift') {
    const item = p.aGives;
    if (item.cash !== undefined) {
      const cash = Math.min(item.cash, a.cash);
      transfer(state, a, b, cash);
      if (cash > 0) trustMark(state, cfg, b.id, a.id, +1, 'gave you money', t);
      emit(ctx, courier ? 'courier' : 'gift', { block: b.block, who: courier ? { courier: 'npc:courier', a: a.id, b: b.id } : { from: a.id, to: b.id }, data: { cash } });
      tell(state, b.id, t, `${a.name} gave you $${cash}.`);
    } else {
      const quality = item.good === 'product' || item.good === 'gun' ? item.q : null;
      const units = Math.min(item.n, countGood(a, item.good, quality));
      if (units > 0) {
        removeGood(a, item.good, units, item.q);
        addGood(b, item.good, units, item.q);
        trustMark(state, cfg, b.id, a.id, +1, 'gave you goods', t);
        jobDelivery(ctx, a, b, item.good, units);
      }
      emit(ctx, courier ? 'courier' : 'gift', { block: b.block, who: courier ? { courier: 'npc:courier', a: a.id, b: b.id } : { from: a.id, to: b.id }, data: { good: item.good, q: item.q, n: units } });
      tell(state, b.id, t, `${a.name} gave you ${goodsText(item.good, units, item.q)}.`);
    }
  } else if (p.kind === 'loan') {
    const cash = Math.min(p.aGives.cash, a.cash);
    if (cash < p.aGives.cash) {
      trustMark(state, cfg, b.id, a.id, -1, 'came up short', t);
      emit(ctx, 'pickup:short', { block: a.block, who: { a: b.id, b: a.id }, data: { pickup: p.id, loan: true, short: a.id } });
    } else {
      transfer(state, a, b, cash);
      const loan = { id: nextId(state, 'l'), lender: a.id, borrower: b.id, amount: cash, owed: p.loan.repay, due: p.loan.due, status: 'open', t };
      state.loans.push(loan);
      noteTrade(ctx, a, b, cash, { handoff: !courier, courier });
      emit(ctx, courier ? 'courier' : 'pickup', { block: b.block, spot: 'street', who: courier ? { courier: 'npc:courier', a: a.id, b: b.id } : { a: b.id, b: a.id }, data: { pickup: p.id, loan: loan.id, cash }, big: cash >= cfg.deals.bigDeal });
      tell(state, b.id, t, `${a.name} lent you $${cash}. $${loan.owed} is due by ${clockText(cfg, loan.due)}.`);
    }
  }
  p.done = true;
}

/** Where on the block a hand-off happens: at the seller's door when it's on the pads block, else on the street. */
function spotFor(ctx, a, b) {
  return a.block === theBlock(ctx.map, 'pads') ? `door:${a.id}` : 'street';
}

/** Step 6 of the hour: every pick-up whose two people now share a block swaps. Old ones lapse. */
export function settlePickups(ctx) {
  const { cfg, state, t } = ctx;
  for (const p of state.pickups) {
    if (p.done) continue;
    const a = state.agents[p.a];
    const b = state.agents[p.b];
    if (isFree(a) && isFree(b) && a.block === b.block) {
      swap(ctx, p, {});
    } else if (t >= p.expires) {
      p.done = true;
      p.lapsed = true;
      if (p.kind !== 'gift') {
        trustMark(state, cfg, a.id, b.id, -1, 'the pick-up never happened', t);
        trustMark(state, cfg, b.id, a.id, -1, 'the pick-up never happened', t);
      }
      emit(ctx, 'pickup:lapse', { block: a.block, who: { a: a.id, b: b.id }, data: { pickup: p.id } });
      tell(state, a.id, t, `The pick-up with ${b.name} never happened.`);
      tell(state, b.id, t, `The pick-up with ${a.name} never happened.`);
    }
  }
  state.pickups = state.pickups.filter(p => !p.done);
}

/** An agent's open pick-ups, with where the other side is and how far (for the top of its menu). */
export function pickupsOf(ctx, agent) {
  const { map, state, t } = ctx;
  return state.pickups.filter(p => !p.done && (p.a === agent.id || p.b === agent.id)).map(p => {
    const other = state.agents[p.a === agent.id ? p.b : p.a];
    const mine = p.a === agent.id ? p.aGives : p.bGives;
    const theirs = p.a === agent.id ? p.bGives : p.aGives;
    return {
      id: p.id, with: other.id, kind: p.kind,
      youGive: mine ? itemText(mine) : 'nothing', youGet: theirs ? itemText(theirs) : 'nothing',
      theirBlock: isFree(other) ? other.block : other.state, moves: isFree(other) ? distance(map, agent.block, other.block) : null,
      hoursLeft: p.expires - t,
    };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Offers that run out, loans that fall due

export function expireOffers(ctx) {
  const { state, t } = ctx;
  for (const o of state.offers) {
    if (o.status !== 'open' || o.expires === null || o.expires > t) continue;
    o.status = 'expired';
    if (o.terms.kind === 'job' && o.held) {
      giveBackHeld(state, o, o.from);
      emit(ctx, 'job:lapsed', { block: state.agents[o.from]?.block ?? null, who: { poster: o.from }, data: { offer: o.id } });
    }
  }
  state.offers = state.offers.filter(o => o.status === 'open' || o.t >= t - 12);
}

/** Loans due this hour: the game collects, from the pocket, then the stash. What's missing goes overdue. */
export function settleLoans(ctx) {
  const { cfg, state, t } = ctx;
  // An overdue debt keeps taking whatever cash the borrower carries, every hour, until it's paid. The stash is out
  // of the game's reach: that takes a collector at the door.
  for (const loan of state.loans) {
    if (loan.status !== 'overdue' || loan.owed <= 0) continue;
    const borrower = state.agents[loan.borrower];
    const lender = state.agents[loan.lender];
    const paid = Math.min(borrower.cash, loan.owed);
    if (paid <= 0) continue;
    borrower.cash -= paid;
    lender.cash += paid;
    loan.owed -= paid;
    if (loan.owed === 0) {
      loan.status = 'repaid';
      trustMark(state, cfg, lender.id, borrower.id, +1, 'paid you back, late', t);
      emit(ctx, 'loan:repaid', { block: borrower.block, who: { borrower: borrower.id, lender: lender.id }, data: { loan: loan.id, paid, late: true } });
      tell(state, lender.id, t, `${borrower.name} finally paid what was owed.`);
    }
  }
  for (const loan of state.loans) {
    if (loan.status !== 'open' || loan.due > t) continue;
    const borrower = state.agents[loan.borrower];
    const lender = state.agents[loan.lender];
    let paid = Math.min(borrower.cash, loan.owed);
    borrower.cash -= paid;
    const fromStash = Math.min(borrower.stash, loan.owed - paid);
    borrower.stash -= fromStash;
    paid += fromStash;
    lender.cash += paid;
    loan.owed -= paid;
    if (loan.owed === 0) {
      loan.status = 'repaid';
      trustMark(state, cfg, lender.id, borrower.id, +1, 'paid you back on time', t);
      emit(ctx, 'loan:repaid', { block: borrower.block, who: { borrower: borrower.id, lender: lender.id }, data: { loan: loan.id, paid } });
      tell(state, lender.id, t, `${borrower.name} paid back $${paid}.`);
    } else {
      loan.status = 'overdue';
      borrower.stats.betrayals += 1;
      ctx.tally.betrayals += 1;
      trustMark(state, cfg, lender.id, borrower.id, -2, "didn't pay you back", t);
      grudge(state, lender, borrower.id, `owes you $${loan.owed}`, t);
      emit(ctx, 'loan:default', { block: borrower.block, who: { borrower: borrower.id, lender: lender.id }, data: { loan: loan.id, owed: loan.owed, paid } });
      tell(state, lender.id, t, `${borrower.name} didn't pay: $${loan.owed} is overdue. You or a muscle can collect.`);
      tell(state, borrower.id, t, `You missed ${lender.name}'s loan: $${loan.owed} is overdue.`);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Protection contracts and guard jobs

/** Everyone on guard duty right now, as { guard, client, contract?, job? }. */
export function guardDuties(state) {
  const out = [];
  for (const c of state.contracts) if (c.active) out.push({ guard: state.agents[c.muscle], client: state.agents[c.client], contract: c });
  for (const j of state.jobs) if (j.status === 'taken' && j.task.type === 'guard') out.push({ guard: state.agents[j.worker], client: state.agents[j.task.agent], job: j });
  return out;
}

/** The end of the hour: a guard who stayed with its client is paid for the hour; contracts and guard jobs run out. */
export function payGuards(ctx) {
  const { cfg, state, t } = ctx;
  for (const c of state.contracts) {
    if (!c.active || t < c.t0) continue;
    const muscle = state.agents[c.muscle];
    const client = state.agents[c.client];
    const together = isFree(muscle) && (client.state !== 'free' || muscle.block === client.block);
    if (together) {
      release(state, c, muscle, c.perHour);
      c.paidHours += 1;
      if (c.paidHours === 1) noteTrade(ctx, muscle, client, c.price, {});
    }
    if (t + 1 >= c.until) {
      c.active = false;
      if (c.paidHours === c.hours && c.held > 0) release(state, c, muscle, c.held); // the rounding
      refund(state, c, client);
      emit(ctx, 'contract:end', { block: muscle.block, who: { muscle: muscle.id, client: client.id }, data: { contract: c.id, paidHours: c.paidHours } });
    }
  }
  for (const j of state.jobs) {
    if (j.status !== 'taken' || j.task.type !== 'guard') continue;
    const worker = state.agents[j.worker];
    const client = state.agents[j.task.agent];
    if (isFree(worker) && (client.state !== 'free' || worker.block === client.block)) {
      release(state, j, worker, j.perHour);
      j.done += 1;
      if (j.done === 1) noteTrade(ctx, worker, state.agents[j.poster], j.pay, {});
    }
    if (j.done >= j.task.hours) finishJob(ctx, j, { paid: true });
  }
  for (const j of state.jobs) {
    if (j.status === 'taken' && t + 1 >= j.expires) {
      j.status = 'lapsed';
      returnJobPay(ctx, j);
      trustMark(state, cfg, j.poster, j.worker, -1, "didn't do the job", t);
      emit(ctx, 'job:lapsed', { block: state.agents[j.poster]?.block ?? null, who: { poster: j.poster }, data: { job: j.id, worker: j.worker } });
      tell(state, j.poster, t, `${nameOf(state, j.worker)} didn't do the job. Your $${j.pay} is back.`);
    }
  }
  state.jobs = state.jobs.filter(j => j.status === 'taken' || j.t >= t - 12);
  state.contracts = state.contracts.filter(c => c.active || c.until >= t - 12);
}

function returnJobPay(ctx, job) {
  giveBackHeld(ctx.state, job, job.poster);
}

function finishJob(ctx, job, { extra = 0 } = {}) {
  const { cfg, state, t } = ctx;
  const worker = state.agents[job.worker];
  const poster = state.agents[job.poster];
  const paid = job.held;
  if (job.held > 0) release(state, job, worker, job.held);
  job.status = 'done';
  if (poster && job.task.type !== 'guard') noteTrade(ctx, worker, poster, job.pay, {});
  if (poster) trustMark(state, cfg, poster.id, worker.id, +1, 'did the job', t);
  ctx.tally.jobsDone += 1;
  emit(ctx, 'job:done', { block: worker.block, who: { worker: worker.id, poster: job.poster }, data: { job: job.id, task: job.task, pay: job.pay, paid: paid + extra, ...(job.house ? { house: true } : {}) } });
  tell(state, job.poster, t, `${worker.name} did your job: ${taskText(state, job.task, job.poster)}.`);
  tell(state, worker.id, t, `Job done: ${taskText(state, job.task, job.poster)}. Paid $${job.pay}.`);
}

/**
 * Something a job might be waiting for just happened: a robbery, a won fight, a bail, a recovery.
 * The engine pays out the moment it sees the deed done.
 */
export function jobDeed(ctx, type, worker, { target = null, recovered = 0 } = {}) {
  const { state } = ctx;
  for (const job of state.jobs) {
    if (job.status !== 'taken' || job.worker !== worker.id || job.task.type !== type) continue;
    if (type === 'recover') {
      if (job.poster !== target) continue;
      finishJob(ctx, job, {});
      return job;
    }
    if (job.task.agent !== target) continue;
    finishJob(ctx, job, {});
    return job;
  }
  return null;
}

/** Goods changed hands: does that finish a delivery job? */
function jobDelivery(ctx, giver, receiver, good, units) {
  for (const job of ctx.state.jobs) {
    if (job.status !== 'taken' || job.worker !== giver.id || job.task.type !== 'deliver') continue;
    if (job.task.agent !== receiver.id || job.task.good !== good) continue;
    job.done += units;
    if (job.done >= job.task.n) finishJob(ctx, job, {});
  }
}

/** The `quit` verb: walk out of a protection contract or a job. Everyone sees it. */
export function quitWork(ctx, agent, id) {
  const { cfg, state, t } = ctx;
  const contract = state.contracts.find(c => c.id === id && c.active && c.muscle === agent.id);
  if (contract) {
    endContractBadly(ctx, contract, 'walked out on you');
    emit(ctx, 'quit', { block: agent.block, who: { agent: agent.id, client: contract.client }, data: { contract: contract.id } });
    return yes({ text: `walked out on ${nameOf(state, contract.client)}` });
  }
  const job = state.jobs.find(j => j.id === id && j.status === 'taken' && j.worker === agent.id);
  if (job) {
    job.status = 'quit';
    returnJobPay(ctx, job);
    trustMark(state, cfg, job.poster, agent.id, -2, 'walked out on your job', t);
    agent.stats.betrayals += 1;
    ctx.tally.betrayals += 1;
    emit(ctx, 'quit', { block: agent.block, who: { agent: agent.id, client: job.poster }, data: { job: job.id } });
    tell(state, job.poster, t, `${agent.name} walked out on your job. Your money is back.`);
    return yes({ text: `dropped the job for ${nameOf(state, job.poster)}` });
  }
  return no('nothing of yours to quit with that id');
}

/** A muscle quit, or turned on its client: the contract ends, the rest of the pay goes back, and it's a betrayal. */
export function endContractBadly(ctx, contract, why) {
  const { cfg, state, t } = ctx;
  const muscle = state.agents[contract.muscle];
  const client = state.agents[contract.client];
  contract.active = false;
  refund(state, contract, client);
  muscle.stats.betrayals += 1;
  ctx.tally.betrayals += 1;
  trustMark(state, cfg, client.id, muscle.id, -2, why, t);
  grudge(state, client, muscle.id, why, t);
  tell(state, client.id, t, `${muscle.name} ${why}. The rest of your money is back.`);
}

/** Give back whatever an offer, job or contract still holds: to the crew pot it came from, or to the agent. */
function giveBackHeld(state, holder, agentId) {
  if (!holder.held) return 0;
  const back = holder.held;
  if (holder.house) {
    // the house's own money: it goes back out of the city
    state.books.out['house bounty'] = (state.books.out['house bounty'] ?? 0) + back;
    holder.held = 0;
  } else if (holder.crew && state.crews[holder.crew]) {
    state.crews[holder.crew].pot += back;
    holder.held = 0;
  } else refund(state, holder, state.agents[agentId]);
  return back;
}

/**
 * Midnight: the game holds nothing overnight. Open job offers lapse, jobs in hand end, contracts end, and every
 * dollar held goes back to whoever put it up. Otherwise a job nobody means to do is a place to hide cash from the
 * rent, the night robbers and the standings.
 */
export function closeDayHolds(ctx) {
  const { state, t } = ctx;
  for (const o of state.offers) {
    if (o.status === 'open' && o.terms.kind === 'job') {
      o.status = 'expired';
      giveBackHeld(state, o, o.from);
    }
  }
  for (const j of state.jobs) {
    if (j.status === 'taken') {
      j.status = 'lapsed';
      giveBackHeld(state, j, j.poster);
    }
  }
  for (const c of state.contracts) {
    if (c.active) {
      c.active = false;
      giveBackHeld(state, c, c.client);
    }
  }
}

/** What an agent is bound by right now, for its view and menu. */
export function dutiesOf(state, agent) {
  return {
    contracts: state.contracts.filter(c => c.active && (c.muscle === agent.id || c.client === agent.id)),
    jobs: state.jobs.filter(j => j.status === 'taken' && (j.worker === agent.id || j.poster === agent.id)),
    loans: state.loans.filter(l => (l.status === 'open' || l.status === 'overdue') && (l.lender === agent.id || l.borrower === agent.id)),
  };
}
