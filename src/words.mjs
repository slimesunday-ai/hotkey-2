// Plain words for everything the engine records (SPEC section 16, D67).
// describe(event, game) turns one feed event into one sentence a newcomer can follow: names, places and dollars,
// never an id, a menu line or a number from the dice. The episode page is built from these sentences, and the runner
// can print them too.
//
// Every sentence has to read right when a part is missing (no officer, no amount, no place), because the page is also
// written for seasons that are only part-way through and for events the engine adds later.

import { SKILL_TEXT } from './skills.mjs';
import { RIVAL_CREW_NAME, NPC_ROBBERS_NAME } from './cast.mjs';

// ---------------------------------------------------------------------------------------------------------------
// Small pieces: money, names, places, time, goods

const isNum = x => typeof x === 'number' && Number.isFinite(x);

/** "$1,240". Returns null when there is no number, so a missing amount drops out of its sentence. */
export function money(n) {
  if (!isNum(n)) return null;
  const whole = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}$${whole}`;
}

/** Words that stand in for the fixed things an offer can be made to. */
const STAND_INS = { anyone: 'anyone', fence: 'the fence', gunshop: 'the gun shop', police: 'the police', rival: RIVAL_CREW_NAME };

/** What an NPC does in the city, added after its name the first time a sentence needs it. */
const NPC_JOBS = {
  fence: 'the fence', gunshop: 'the gun-shop clerk', supplier: 'the docks supplier', courier: 'the courier', snitch: 'the snitch',
  shopkeeper: 'the shopkeeper', medic: 'the medic',
};

/** An agent's or NPC's name. Never an id: an unknown id becomes "someone". */
export function nameOf(game, id) {
  if (typeof id !== 'string' || !id) return 'someone';
  const state = game?.state;
  return state?.agents?.[id]?.name ?? state?.npcs?.[id]?.name ?? STAND_INS[id] ?? 'someone';
}

/** An NPC's name with its job: "Odette the fence". For an agent, just the name. */
function withJob(game, id) {
  const job = NPC_JOBS[game?.state?.npcs?.[id]?.role];
  return job ? `${nameOf(game, id)} ${job}` : nameOf(game, id);
}

/** "Kim's", "the Sixes'". */
export const possessive = name => (/^the .*s$/i.test(name) ? `${name}'` : `${name}'s`);

/** A name at the start of a sentence: "someone" becomes "Someone". */
const cap = text => (text ? text[0].toUpperCase() + text.slice(1) : text);

/** How each block of the round 1 city is said after a verb: "robbed Kim in the park". */
const PLACES = {
  projects: 'in the projects', market: 'at the market', uptown: 'uptown', corner: 'on the corner', bar: 'at the bar', park: 'in the park',
  docks: 'at the docks', precinct: 'at the precinct', jail: 'in jail', clinic: 'in the clinic',
};

/** A block's own name: "the market", "uptown". Works for any map, and for the jail and the clinic. */
export function blockName(game, block) {
  if (typeof block !== 'string' || !block) return null;
  const named = game?.map?.blocks?.[block]?.name ?? game?.map?.held?.[block]?.name;
  if (named) return named;
  return block === 'uptown' ? block : `the ${block}`;
}

/** Where something happened, ready to follow a verb: "at the market". Empty when the event has no block. */
export function placeOf(game, block) {
  if (typeof block !== 'string' || !block) return '';
  return PLACES[block] ?? `at ${blockName(game, block)}`;
}

/** "day 2, 15:00" for an hour of the season counted from 0. */
export function clockOf(game, t) {
  if (!isNum(t)) return null;
  const perDay = game?.cfg?.season?.hoursPerDay ?? 12;
  const first = game?.cfg?.season?.firstHour ?? 12;
  return `day ${Math.floor(t / perDay) + 1}, ${first + (t % perDay)}:00`;
}

/** "6 units of quality-3 product", "a quality-2 gun", "5 chems". Null when there is nothing to name. */
export function goodsWords(good, n, quality) {
  if (typeof good !== 'string' || !isNum(n)) return null;
  const q = isNum(quality) ? `quality-${quality} ` : '';
  if (good === 'gun') return n === 1 ? `a ${q}gun` : `${n} ${q}guns`;
  if (good === 'product') return `${n} ${n === 1 ? 'unit' : 'units'} of ${q}product`;
  return `${n} ${good}`;
}

/** "a, b and c" */
export function listOf(items) {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Join the parts of a sentence that are there, tidy the spacing, start with a capital and end with a full stop. */
function sentence(...parts) {
  let s = parts.filter(p => typeof p === 'string' && p.trim()).join(' ').replace(/\s+/g, ' ').replace(/ ([,.;:])/g, '$1').trim();
  if (!s) return '';
  s = s[0].toUpperCase() + s.slice(1);
  return /[.!?]$/.test(s) || /[.!?]["”]$/.test(s) ? s : `${s}.`;
}

// ---------------------------------------------------------------------------------------------------------------
// Things the feed says once and later events only point at: what an offer was for, what a crew is called, which
// pad a robber was trying, and what each seat bought on which night. Kept per game, and topped up as the feed grows.

const memory = new WeakMap();

function recall(game) {
  const blank = { read: 0, offers: new Map(), crews: new Map(), lines: new Map(), buys: [] };
  if (!game || typeof game !== 'object' || !Array.isArray(game.feed)) return blank;
  let known = memory.get(game);
  if (!known || known.read > game.feed.length) memory.set(game, (known = blank));
  for (; known.read < game.feed.length; known.read++) {
    const line = game.feed[known.read];
    if (line?.type === 'hour') known.lines.set(line.t, line);
    if (line?.type === 'night' || line?.type === 'levelup') {
      for (const row of line.bought ?? []) known.buys.push({ id: row.id, night: line.day, skills: row.skills ?? [] });
    }
    for (const event of line?.events ?? []) {
      const data = event.data ?? {};
      if (data.offer && data.terms) known.offers.set(data.offer, { terms: data.terms, from: event.who?.from, board: event.kind === 'offer:board' });
      if (data.offer && data.task) known.offers.set(data.offer, { terms: { kind: 'job', task: data.task, pay: data.pay }, from: event.who?.poster });
      if (data.crew && data.name) known.crews.set(data.crew, data.name);
    }
  }
  return known;
}

/** A crew's name, or "the crew" when the feed never gave one. */
function crewName(game, crewId) {
  return recall(game).crews.get(crewId) ?? game?.state?.crews?.[crewId]?.name ?? 'the crew';
}

/**
 * The level an agent's skill stood at during the hour `t`: what it started the season with, plus what it bought on
 * every night before that day. Returns 0 when the feed doesn't say.
 */
export function skillLevelAt(game, agentId, skill, t) {
  const agent = game?.state?.agents?.[agentId];
  if (!agent || !Array.isArray(agent.bought)) return 0;
  const perDay = game?.cfg?.season?.hoursPerDay ?? 12;
  const day = isNum(t) ? Math.floor(t / perDay) + 1 : Infinity;
  const nights = recall(game).buys.filter(b => b.id === agentId);
  const startCount = Math.max(0, agent.bought.length - nights.reduce((sum, b) => sum + b.skills.length, 0));
  let level = agent.bought.slice(0, startCount).filter(s => s === skill).length;
  for (const b of nights) if (b.night < day) level += b.skills.filter(s => s === skill).length;
  return level;
}

// ---------------------------------------------------------------------------------------------------------------
// Offers and jobs in words

/** A job's task: "rob Kim", "guard Rook for 4 hours". */
function taskWords(game, task, posterId) {
  if (!task || typeof task !== 'object') return 'a job';
  const who = nameOf(game, task.agent ?? posterId);
  switch (task.type) {
    case 'rob': return `rob ${who}`;
    case 'fight': return `put ${who} in the clinic`;
    case 'guard': return `guard ${who}${isNum(task.hours) ? ` for ${plural(task.hours, 'hour')}` : ''}`;
    case 'deliver': return `hand ${goodsWords(task.good, task.n, task.q) ?? 'some goods'} to ${who}`;
    case 'recover': return `get back what was stolen from ${nameOf(game, posterId)}`;
    case 'bail': return `bail ${who} out of jail`;
    default: return 'a job';
  }
}

/** What an offer proposes, as the rest of a sentence that starts with the name of whoever made it. */
function termsWords(game, terms, { from, to }) {
  if (!terms || typeof terms !== 'object') return to ? `made ${to} an offer` : 'put an offer on the board';
  const goods = goodsWords(terms.good, terms.n, terms.q) ?? 'some goods';
  const each = money(terms.each);
  const price = each ? ` at ${each} each` : '';
  const credit = isNum(terms.due) ? `, on credit until ${clockOf(game, terms.due)}` : '';
  const courier = terms.courier ? ', sent by courier' : '';
  const due = isNum(terms.due) ? ` by ${clockOf(game, terms.due)}` : '';
  switch (terms.kind) {
    case 'sell': return to ? `offered to sell ${to} ${goods}${price}${credit}${courier}` : `put ${goods} up for sale on the board${price}${credit}${courier}`;
    case 'buy': return to ? `offered to buy ${goods} from ${to}${price}${credit}${courier}` : `posted on the board to buy ${goods}${price}${credit}${courier}`;
    case 'tip': return `${to ? `offered ${to} a tip` : 'put a tip up for sale on the board'}${money(terms.price) ? ` for ${money(terms.price)}` : ''}`;
    case 'loan': return `offered to lend ${to ?? 'anyone'} ${money(terms.amount) ?? 'money'}${money(terms.repay) ? `, with ${money(terms.repay)} due back${due}` : ''}`;
    case 'borrow': return `asked ${to ?? 'anyone'} for a loan of ${money(terms.amount) ?? 'some money'}${money(terms.repay) ? `, promising ${money(terms.repay)} back${due}` : ''}`;
    case 'protect': return `offered to guard ${to ?? 'anyone who pays'}${isNum(terms.hours) ? ` for ${plural(terms.hours, 'hour')}` : ''}${money(terms.price) ? ` for ${money(terms.price)}` : ''}`;
    case 'job': return `${to ? `offered ${to} a job` : 'put up a job'}: ${taskWords(game, terms.task, from)}${money(terms.pay) ? `, for ${money(terms.pay)}` : ''}`;
    case 'gift': return `offered ${to ?? 'someone'} a gift`;
    default: return to ? `made ${to} an offer` : 'put an offer on the board';
  }
}

/** A closed deal's terms as a short tail: ": 6 units of quality-3 product at $29 each". Empty when unknown. */
function dealTail(game, offer) {
  const terms = offer?.terms;
  if (!terms) return '';
  const each = money(terms.each) ? ` at ${money(terms.each)} each` : '';
  // a board listing can be taken a few units at a time, so its size says nothing about this deal
  const kindOfGoods = `${isNum(terms.q) && (terms.good === 'product' || terms.good === 'gun') ? `quality-${terms.q} ` : ''}${terms.good === 'gun' ? 'guns' : terms.good ?? 'goods'}`;
  switch (terms.kind) {
    case 'sell': case 'buy': return `: ${offer.board ? kindOfGoods : goodsWords(terms.good, terms.n, terms.q) ?? 'goods'}${each}`;
    case 'loan': case 'borrow': return `: a loan of ${money(terms.amount) ?? 'cash'}${money(terms.repay) ? `, ${money(terms.repay)} to pay back` : ''}`;
    case 'job': return `: ${taskWords(game, terms.task, offer.from)}`;
    default: return '';
  }
}

/** What an arrest cost: "2 hours in jail and a $13 fine, and the police took a quality-1 gun". */
function arrestCost(data) {
  const parts = [];
  if (isNum(data.hours)) parts.push(`${plural(data.hours, 'hour')} in jail`);
  if (isNum(data.fine) && data.fine > 0) parts.push(`a ${money(data.fine)} fine`);
  const seized = (Array.isArray(data.seized) ? data.seized : []).map(s => goodsWords(s.good, s.n, s.good === 'gun' || s.good === 'product' ? s.quality : null)).filter(Boolean);
  const cost = listOf(parts);
  const took = seized.length ? `the police took ${listOf(seized)}` : '';
  if (cost && took) return `${cost}, and ${took}`;
  return cost || took;
}

/** What a robbery took: "$30 and 6 units of quality-3 product". Null when the event doesn't say. */
function haul(data) {
  const lot = data.lot ? goodsWords(data.lot.good, data.lot.n, data.lot.good === 'gun' || data.lot.good === 'product' ? data.lot.quality : null) : null;
  const cash = isNum(data.cash) && (data.cash > 0 || !lot) ? money(data.cash) : null;
  return listOf([cash, lot]) || null;
}

// ---------------------------------------------------------------------------------------------------------------
// One sentence for every kind of event. `x` carries the event and the helpers bound to it:
//   x.n(role)  the name of whoever plays that role, or "someone"
//   x.has(role) whether the event names anyone in that role
//   x.at       where it happened, ready to follow a verb ("at the market"), or ''
//   x.d        the event's data

/** Was this job posted by the rival crew? In a small lobby they put a bounty on the leader every day. */
const fromTheHouse = x => x.d.house === true || /^npc:rival/.test(x.who.poster ?? '') || x.game?.state?.npcs?.[x.who.poster]?.role === 'rival';
const posterName = x => (fromTheHouse(x) ? RIVAL_CREW_NAME : x.n('poster'));
/** The name of whoever the rival crew's bounty is on, or null when this job isn't that bounty. */
const bountyOn = x => (fromTheHouse(x) && x.d.task?.type === 'rob' && x.d.task.agent ? nameOf(x.game, x.d.task.agent) : null);
/** Whose pad the night robbers went for. */
const nightPad = x => (x.has('agent') || x.has('owner') ? `${possessive(x.n(x.has('agent') ? 'agent' : 'owner'))} pad` : 'a pad');
/** Whoever stood guard at the door through the night, by name, or '' when nobody did. */
const nightGuards = x => {
  const ids = Array.isArray(x.d.guards) && x.d.guards.length ? x.d.guards : x.has('guard') ? [x.who.guard] : [];
  return listOf(ids.map(id => nameOf(x.game, id)));
};
/** What a smuggler brought in on a docks run: chems, parts, or product that is already cooked but low grade. */
const runGoods = d => (!isNum(d.units) ? 'goods' : d.good === 'product' ? `${plural(d.units, 'unit')} of ready-made, low-grade product` : `${d.units} ${d.good ?? 'goods'}`);
const robbersName = x =>(x.who.robber1 === 'npc:robber1' || !x.has('robber1') ? NPC_ROBBERS_NAME : listOf([x.n('robber1'), x.has('robber2') ? x.n('robber2') : null]));
const betrayal = x => (x.d.betrayed ? `It was a betrayal: ${x.n('robber')} turned on someone who trusted them.` : '');
const padOf = x => (x.has('owner') ? `${possessive(x.n('owner'))} pad` : x.padOwner ? `${possessive(x.padOwner)} pad` : 'a pad');
const took = (x, verb = 'took') => (haul(x.d) ? `${verb} ${haul(x.d)}` : '');
const jailed = (x, who) => (arrestCost(x.d) ? `${cap(who)} got ${arrestCost(x.d)}.` : '');

const WORDS = {
  // ---- what an agent did with its own hour
  'move': x => sentence(x.n('mover'), 'walked', x.d.from ? `from ${blockName(x.game, x.d.from)}` : '', x.d.to ? `to ${blockName(x.game, x.d.to)}` : 'on'),
  'move:guard': x => sentence(x.n('guard'), 'followed', x.n('client'), x.d.to ? `to ${blockName(x.game, x.d.to)}` : ''),
  'work:run': x => sentence(x.n('smuggler'), 'bought', runGoods(x.d), x.has('supplier') ? `from ${withJob(x.game, x.who.supplier)}` : x.at, money(x.d.cost) ? `for ${money(x.d.cost)}` : ''),
  'work:run:bust': x => sentence(`${x.has('officer') ? x.n('officer') : 'The police'} caught ${x.n('smuggler')} unloading`, runGoods(x.d), `${x.at}.`, jailed(x, x.n('smuggler'))),
  'work:cook': x => sentence(x.n('cook'), 'cooked', isNum(x.d.units) ? `${plural(x.d.units, 'unit')} of ${isNum(x.d.quality) ? `quality-${x.d.quality} ` : ''}product` : 'a batch of product'),
  'work:cook:blowup': x => sentence(`${possessive(x.n('cook'))} batch blew up in the kitchen. The chems are gone and ${x.n('cook')} is in the clinic`),
  'work:deal': x => sentence(x.n('dealer'), 'sold', isNum(x.d.sold) ? plural(x.d.sold, 'unit') : 'product', 'to street buyers', x.at, money(x.d.cash) ? `for ${money(x.d.cash)}` : ''),
  'work:deal:dry': x => sentence(x.n('dealer'), 'found no street buyers', x.at),
  'work:claim': x => sentence(x.n('dealer'), 'claimed', x.e.block ? blockName(x.game, x.e.block) : 'the block', 'as turf until midnight'),
  'turf:win': x => sentence(x.n('dealer'), 'fought', x.n('holder'), 'for', x.e.block ? blockName(x.game, x.e.block) : 'the block', 'and took it'),
  'turf:lose': x => sentence(x.n('dealer'), 'tried to take', x.e.block ? blockName(x.game, x.e.block) : 'the block', 'from', x.n('holder'), 'and lost the fight'),
  'work:build': x => sentence(x.n('gunrunner'), 'built', isNum(x.d.quality) ? `a quality-${x.d.quality} gun` : 'a gun'),
  'work:gunsale': x => sentence(x.n('gunrunner'), 'sold', isNum(x.d.quality) ? `a quality-${x.d.quality} gun` : 'a gun', x.has('buyer') ? `to ${x.n('buyer')}` : 'on the street', x.at, money(x.d.price) ? `for ${money(x.d.price)}` : ''),
  'work:gunsale:sting': x => sentence(x.n('gunrunner'), 'sold a gun', x.has('buyer') ? `to ${x.n('buyer')}` : '', `${x.at}, and it was a police sting.`, jailed(x, x.n('gunrunner'))),
  'work:case': x => sentence(x.n('robber'), 'watched', x.e.block ? blockName(x.game, x.e.block) : 'the block', 'to see who was carrying cash'),
  'work:guard': x => sentence(x.n('muscle'), 'stood guard over', x.n('client')),
  'work:patrol': x => sentence(x.n('muscle'), 'patrolled', x.e.block ? blockName(x.game, x.e.block) : 'the block', isNum(x.d.pay) && x.d.pay > 0 ? `and the shopkeepers paid ${money(x.d.pay)}` : ''),
  'work:watch': x => sentence(x.n('informant'), 'watched', x.e.block ? blockName(x.game, x.e.block) : 'the block', Array.isArray(x.d.tips) && x.d.tips.length ? `and picked up ${plural(x.d.tips.length, 'tip')}` : 'and learned nothing worth selling'),
  'work:tipoff': x => policeTip(x),
  'offer:police': x => policeTip(x),
  'work:none': x => sentence(x.n('agent'), 'had no work to do', x.at),
  'stash': x => (isNum(x.d.took)
    ? sentence(x.n('agent'), `took ${money(x.d.took)} out of the stash at home`)
    : sentence(x.n('agent'), 'put', money(x.d.put) ?? 'cash', 'in the stash at home')),
  'rest': x => sentence(x.n('agent'), 'lay low', x.at),
  'offer:made': x => sentence(x.n('from'), termsWords(x.game, x.asked ?? x.d.terms, { from: x.who.from, to: x.n('to') })),
  'offer:board': x => (x.d.withdrew ? sentence(x.n('from'), 'took a listing down from the board') : sentence(x.n('from'), termsWords(x.game, x.asked ?? x.d.terms, { from: x.who.from, to: null }))),
  'offer:fence': x => {
    const fence = x.has('npc') ? withJob(x.game, x.who.npc) : 'the fence';
    const price = money(x.d.cash) ? `for ${money(x.d.cash)}` : '';
    // the loan shark works the fence's counter: cash now, and more than that out of what the agent earns next
    if (isNum(x.d.stake)) return sentence(x.n('agent'), 'was broke and took', `a ${money(x.d.stake)} stake`, 'from the loan shark', `${x.at}.`, money(x.d.owed) ? `${cap(x.n('agent'))} now owes ${money(x.d.owed)}, taken out of whatever it earns next.` : '');
    if (x.d.bought) return sentence(x.n('agent'), 'bought', goodsWords(x.d.bought, x.d.n, x.d.bought === 'product' ? 1 : null) ?? 'goods', 'from', fence, price);
    return sentence(x.n('agent'), 'sold', goodsWords(x.d.sold, x.d.n, x.d.sold === 'product' || x.d.sold === 'gun' ? x.d.q : null) ?? 'goods', 'to', fence, price);
  },
  'offer:gunshop': x => sentence(x.n('agent'), 'bought a gun', x.has('npc') ? `from ${withJob(x.game, x.who.npc)}` : 'at the gun shop', money(x.d.price) ? `for ${money(x.d.price)}` : ''),
  'bail': x => sentence(x.n('payer'), 'paid', money(x.d.price) ?? 'the bail', 'to get', x.n('prisoner'), 'out of jail'),
  'crew:start': x => sentence(x.n('boss'), 'started a crew', x.d.name ? `called ${x.d.name}` : ''),
  'crew:invite': x => sentence(x.n('boss'), 'invited', x.n('agent'), 'into', crewName(x.game, x.d.crew)),
  'crew:join': x => sentence(x.n('agent'), 'joined', x.d.name ?? crewName(x.game, x.d.crew), x.has('boss') ? `under ${x.n('boss')}.` : '.', isNum(x.d.size) ? `The crew is now ${x.d.size} strong.` : ''),
  'crew:leave': x => sentence(x.n('agent'), 'walked out of', crewName(x.game, x.d.crew)),
  'crew:coup:win': x => sentence(x.n('challenger'), 'fought', x.n('boss'), 'for the chair of', crewName(x.game, x.d.crew), 'and took it'),
  'crew:coup:lose': x => sentence(x.n('challenger'), 'came for', possessive(x.n('boss')), 'chair at the head of', crewName(x.game, x.d.crew), 'and lost'),
  'crew:skim': x => sentence(x.n('agent'), 'skimmed', money(x.d.amount) ?? 'cash', 'from the pot of', crewName(x.game, x.d.crew), 'and walked out'),
  'crew:cut': x => sentence(x.n('boss'), 'set the cut every member pays into the pot of', crewName(x.game, x.d.crew), isNum(x.d.pct) ? `to ${x.d.pct}%` : ''),
  'crew:pay': x => (x.who.boss && x.who.boss === x.who.agent
    ? sentence(x.n('boss'), 'took', money(x.d.amount) ?? 'cash', 'out of the pot of', crewName(x.game, x.d.crew), 'as the boss, in front of everyone')
    : sentence(x.n('boss'), 'paid', x.n('agent'), money(x.d.amount) ?? '', 'from the pot of', crewName(x.game, x.d.crew))),
  'quit': x => (x.d.job
    ? sentence(x.n('agent'), 'walked out on a job for', x.n('client'), 'and everyone saw it')
    : sentence(x.n('agent'), 'walked out on guarding', x.n('client'), 'and everyone saw it')),
  'held:jail': x => sentence(x.n('agent'), 'sat in a cell'),
  'held:clinic': x => sentence(x.n('agent'), 'lay in a clinic bed'),
  'idle': x => (x.d.why ? sentence(possessive(x.n('agent')), 'plan for the hour fell through') : sentence(x.n('agent'), 'stood around', x.at)),

  // ---- talk
  'say': x => sentence(x.n('speaker'), x.e.say?.text ? 'said' : 'said something', x.has('listener') ? `to ${x.n('listener')}` : '', x.e.say?.text ? `: “${x.e.say.text}”` : ''),
  'say:block': x => sentence(x.n('speaker'), 'said', x.e.say?.text ? `: “${x.e.say.text}”` : 'something out loud'),
  'message': x => sentence(x.n('sender'), 'sent', x.n('receiver'), 'a private message', x.e.say?.text ? `: “${x.e.say.text}”` : ''),

  // ---- deals
  'deal:closed': x => sentence(x.n('a'), 'said yes to', possessive(x.n('b')), `offer${dealTail(x.game, x.offer)}.`, x.d.courier ? 'A courier carries it.' : ''),
  'pickup': x => {
    if (x.d.loan) return sentence(x.n('b'), 'handed', x.n('a'), 'a loan', money(x.d.cash) ? `of ${money(x.d.cash)}` : '', x.at);
    const goods = goodsWords(x.d.good, x.d.n, x.d.good === 'product' || x.d.good === 'gun' ? x.d.q : null) ?? 'goods';
    return sentence(x.n('a'), 'met', x.n('b'), x.at, 'and bought', goods, money(x.d.cash) ? `for ${money(x.d.cash)}` : '', x.d.credit ? `on credit${isNum(x.d.due) ? `, to be paid by ${clockOf(x.game, x.d.due)}` : ''}` : '');
  },
  'pickup:short': x => {
    if (x.d.loan) return sentence(x.n('b'), 'came to hand', x.n('a'), 'a loan and did not have the cash');
    const short = x.d.short ? nameOf(x.game, x.d.short) : 'one of them';
    const units = x.d.good === 'gun' ? 'guns' : x.d.good === 'product' || !x.d.good ? 'units' : x.d.good;
    const swapped = !isNum(x.d.n) || !isNum(x.d.asked) ? 'the swap was cut short' : x.d.n === 0 ? 'nothing changed hands' : `only ${x.d.n} of the ${x.d.asked} ${units} changed hands`;
    return sentence(x.n('a'), 'and', x.n('b'), 'met', x.at, `to swap, but ${short} came up short: ${swapped}`, isNum(x.d.cash) && x.d.cash > 0 ? `for ${money(x.d.cash)}` : '');
  },
  'pickup:lapse': x => sentence(x.n('a'), 'and', x.n('b'), 'never met to make their swap, so the deal is off'),
  'courier': x => {
    const courier = x.has('courier') ? withJob(x.game, x.who.courier) : 'A courier';
    if (x.d.loan) return sentence(courier, 'carried a loan', money(x.d.cash) ? `of ${money(x.d.cash)}` : '', 'from', x.n('a'), 'to', x.n('b'));
    const goods = goodsWords(x.d.good, x.d.n, x.d.good === 'product' || x.d.good === 'gun' ? x.d.q : null);
    if (!goods) return sentence(courier, 'carried', money(x.d.cash) ?? 'a package', 'from', x.n('a'), 'to', x.n('b'));
    return sentence(courier, 'carried', goods, 'from', x.n('a'), 'to', x.n('b'), isNum(x.d.cash) && x.d.cash > 0 ? `for ${money(x.d.cash)}` : '');
  },
  'gift': x => sentence(x.n('from'), 'gave', x.n('to'), goodsWords(x.d.good, x.d.n, x.d.good === 'product' || x.d.good === 'gun' ? x.d.q : null) ?? money(x.d.cash) ?? 'a gift', 'and asked for nothing back'),
  'loan:repaid': x => sentence(x.n('borrower'), 'paid', x.n('lender'), 'back', money(x.d.paid) ?? '', x.d.late ? ', late' : ''),
  'loan:default': x => sentence(x.n('borrower'), 'could not pay', x.n('lender'), 'back on time.', money(x.d.owed) ? `${money(x.d.owed)} is still owed, and now it can be collected by force.` : 'The debt can now be collected by force.'),
  'tip:sold': x => {
    const about = x.d.type === 'cash' ? `how much cash ${nameOf(x.game, x.d.subject)} is carrying` : x.d.type === 'route' ? 'where the police will be' : x.d.type === 'crime' ? `a crime ${nameOf(x.game, x.d.subject)} committed` : '';
    return sentence(x.n('seller'), 'sold', x.n('buyer'), 'a tip', money(x.d.price) ? `for ${money(x.d.price)}` : '', about ? `: ${about}.` : '.', x.d.twice ? `${x.n('seller')} had already sold the same tip to someone else.` : '');
  },
  'tip:burned': x => sentence(x.n('subject'), 'found out that', x.d.source ? nameOf(x.game, x.d.source) : 'an informant', 'sold the tip that was used against them'),
  // A job the rival crew posts is the house bounty: money on the leader's head, for anyone to collect.
  'job:posted': x => (bountyOn(x)
    ? sentence(RIVAL_CREW_NAME, 'put', money(x.d.pay) ?? 'a bounty', 'on', possessive(bountyOn(x)), 'head')
    : sentence(posterName(x), termsWords(x.game, { kind: 'job', task: x.d.task, pay: x.d.pay }, { from: x.who.poster, to: x.d.to && x.d.to !== 'anyone' ? nameOf(x.game, x.d.to) : null }))),
  'job:taken': x => (bountyOn(x)
    ? sentence(x.n('worker'), 'took up', possessive(RIVAL_CREW_NAME), money(x.d.pay) ?? '', 'bounty on', bountyOn(x))
    : sentence(x.n('worker'), 'took', possessive(posterName(x)), `job: ${taskWords(x.game, x.d.task, x.who.poster)}`, money(x.d.pay) ? `, for ${money(x.d.pay)}` : '')),
  'job:done': x => (bountyOn(x)
    ? sentence(x.n('worker'), 'collected', possessive(RIVAL_CREW_NAME), money(x.d.paid) ?? money(x.d.pay) ?? 'bounty', 'for robbing', bountyOn(x))
    : sentence(x.n('worker'), 'finished', possessive(posterName(x)), `job (${taskWords(x.game, x.d.task, x.who.poster)})`, money(x.d.paid) ? `and was paid ${money(x.d.paid)}` : '')),
  'job:lapsed': x => {
    if (!fromTheHouse(x)) return sentence(possessive(x.n('poster')), 'job ran out with nobody finishing it');
    const task = x.d.task ?? x.offer?.terms?.task;
    return sentence(possessive(RIVAL_CREW_NAME), 'bounty', task?.agent ? `on ${nameOf(x.game, task.agent)}` : '', 'ran out with nobody collecting it');
  },
  'contract:start': x => sentence(x.n('client'), 'hired', x.n('muscle'), 'as a guard', isNum(x.d.hours) ? `for ${plural(x.d.hours, 'hour')}` : '', money(x.d.price) ? `at ${money(x.d.price)}` : ''),
  'contract:end': x => sentence(possessive(x.n('muscle')), 'guard job for', x.n('client'), 'came to an end'),

  // ---- attacks
  'rob:clean:armed': x => sentence(x.n('robber'), 'held', x.n('target'), 'up at gunpoint', x.at, took(x, 'and took') || 'and cleaned them out', '.', betrayal(x)),
  'rob:clean': x => sentence(x.n('robber'), 'robbed', x.n('target'), x.at, took(x, 'and took') || 'and cleaned them out', '.', betrayal(x)),
  'rob:messy': x => sentence(x.n('robber'), 'robbed', x.n('target'), `${x.at}, but it turned into a scuffle:`, x.n('robber'), took(x, 'got away with') || 'got away', 'and both of them were hurt.', betrayal(x)),
  'rob:fail': x => sentence(x.n('robber'), 'tried to rob', x.n('target'), x.at, 'and took a beating instead.', betrayal(x)),
  'rob:disaster:arrest': x => sentence(x.n('robber'), 'tried to rob', x.n('target'), x.at, `and was arrested on the spot${x.has('officer') ? ` by ${x.n('officer')}` : ''}.`, jailed(x, x.n('robber'))),
  'rob:disaster:shot': x => sentence(x.n('robber'), 'tried to rob', x.n('target'), x.at, `and ${x.n('target')} shot back. ${cap(x.n('robber'))} is in the clinic`),
  'rob:disaster:getaway': x => sentence(x.n('robber'), 'tried to rob', x.n('target'), `${x.at}. It went badly wrong, but ${x.n('robber')} got away before the police came`),
  'breakin:clean': x => sentence(x.n('robber'), 'broke into', padOf(x), 'while nobody was home', isNum(x.d.cash) && x.d.cash > 0 ? `and took ${money(x.d.cash)} from the stash` : 'and found nothing in the stash'),
  'breakin:messy': x => sentence(x.n('robber'), 'broke into', padOf(x), 'while nobody was home, made a mess of it', isNum(x.d.cash) && x.d.cash > 0 ? `and left with ${money(x.d.cash)} from the stash` : 'and left with nothing'),
  'breakin:fail': x => sentence(x.n('robber'), 'tried to break into', padOf(x), 'and got hurt on the way in'),
  'breakin:disaster': x => sentence(x.n('robber'), 'was caught breaking into', padOf(x), x.has('officer') ? `by ${x.n('officer')}.` : '.', jailed(x, x.n('robber'))),
  'breakin:getaway': x => sentence(x.n('robber'), 'was nearly caught breaking into', padOf(x), 'and got away before the police came'),
  'door:clean': x => sentence(x.n('robber'), 'broke into', padOf(x), `with ${x.n('owner')} at home, won the fight at the door`, isNum(x.d.cash) && x.d.cash > 0 ? `and took ${money(x.d.cash)} from the stash` : 'and found nothing in the stash'),
  'door:messy': x => sentence(x.n('robber'), 'fought', x.n('owner'), 'at the door of', padOf(x), isNum(x.d.cash) && x.d.cash > 0 ? `and left with ${money(x.d.cash)} from the stash.` : 'and got inside.', 'Both of them were hurt'),
  'door:fail': x => sentence(x.n('robber'), 'tried to break into', `${padOf(x)}.`, cap(x.n('owner')), 'was home and beat them back'),
  'door:disaster:arrest': x => sentence(x.n('robber'), 'tried to break into', padOf(x), `with ${x.n('owner')} at home and was arrested at the door${x.has('officer') ? ` by ${x.n('officer')}` : ''}.`, jailed(x, x.n('robber'))),
  'door:disaster:shot': x => sentence(x.n('robber'), 'tried to break into', padOf(x), `and ${x.n('owner')} shot them at the door. ${cap(x.n('robber'))} is in the clinic`),
  'door:disaster:getaway': x => sentence(x.n('robber'), 'tried to break into', padOf(x), `with ${x.n('owner')} at home. It went badly wrong, but ${x.n('robber')} got away`),
  'fight:clean': x => sentence(x.n('attacker'), 'beat', x.n('target'), 'in a fight', x.at, `and put them in the clinic.`, x.d.betrayed ? 'It was a betrayal.' : ''),
  'fight:messy': x => sentence(x.n('attacker'), 'beat', x.n('target'), 'in a fight', x.at, 'and both of them were hurt.', x.d.betrayed ? 'It was a betrayal.' : ''),
  'fight:fail': x => sentence(x.n('attacker'), 'started a fight with', x.n('target'), x.at, 'and lost it'),
  'fight:disaster': x => sentence(x.n('attacker'), 'started a fight with', x.n('target'), x.at, 'and was beaten badly'),
  'loot:back': x => {
    const got = listOf([isNum(x.d.cash) && x.d.cash > 0 ? money(x.d.cash) : null, typeof x.d.goods === 'string' ? tidyGoods(x.d.goods) : null]);
    const other = x.d.for && x.d.for !== x.who.victim ? nameOf(x.game, x.d.for) : null;
    if (!got) return sentence(x.n('victim'), 'went to take back what', x.n('robber'), 'stole', other ? `from ${other},` : ',', 'but it was already gone');
    return sentence(x.n('victim'), 'took back', got, 'from', x.n('robber'), other ? `for ${other}` : '');
  },
  'collect:win': x => {
    const lender = x.d.lender && x.d.lender !== x.who.collector ? `for ${nameOf(x.game, x.d.lender)}` : '';
    const left = isNum(x.d.left) && x.d.left > 0 ? `${money(x.d.left)} is still owed.` : '';
    if (isNum(x.d.got) && x.d.got === 0) return sentence(x.n('collector'), 'came to collect a debt from', x.n('debtor'), lender, 'and won the fight, but there was no cash to take.', left);
    return sentence(x.n('collector'), 'collected', money(x.d.got) ?? 'a debt', 'from', x.n('debtor'), 'by force', lender, '.', left);
  },
  'collect:lose': x => sentence(x.n('collector'), 'came to collect a debt from', x.n('debtor'), 'and lost the fight'),

  // ---- the law
  'arrest': x => sentence(`${x.has('officer') ? x.n('officer') : 'The police'} arrested ${x.n('agent')}`, `${x.at}.`, jailed(x, x.n('agent'))),
  'release:jail': x => sentence(x.n('agent'), 'walked out of jail', x.d.bailedBy ? `, bailed out by ${nameOf(x.game, x.d.bailedBy)}` : ''),
  'release:clinic': x => sentence(x.n('agent'), 'walked out of the clinic'),

  // ---- NPC trouble
  'npc:robbers:clean': x => sentence(robbersName(x), 'robbed', x.n('target'), x.at, money(x.d.lost) ? `and took ${money(x.d.lost)}` : ''),
  'npc:robbers:messy': x => sentence(robbersName(x), 'jumped', x.n('target'), `${x.at}.`, cap(x.n('target')), 'fought back', money(x.d.lost) ? `but still lost ${money(x.d.lost)}` : 'but still lost cash'),
  'npc:robbers:fail': x => sentence(robbersName(x), 'came for', x.n('target'), x.at, `and ${x.n('target')} saw them off`),
  'npc:robbers:scared': x => sentence(robbersName(x), 'came', x.d.saved ? `for ${nameOf(x.game, x.d.saved)}` : 'looking for cash to take', `${x.at},`, x.has('muscle') ? `but ${possessive(x.n('muscle'))} patrol scared them off` : 'but a patrol scared them off'),
  'npc:robbers:prowl': x => sentence(robbersName(x), 'prowled', x.e.block ? blockName(x.game, x.e.block) : 'the streets', 'and found nobody worth robbing'),
  'npc:rival:push': x => sentence(RIVAL_CREW_NAME, x.has('rival1') && x.who.rival1 !== 'npc:rival1' ? `(${listOf([x.n('rival1'), x.has('rival2') ? x.n('rival2') : null, x.has('rival3') ? x.n('rival3') : null])})` : '', 'pushed onto', x.e.block ? blockName(x.game, x.e.block) : 'a block'),
  'npc:rival:toll': x => sentence(x.n('agent'), 'paid', RIVAL_CREW_NAME, money(x.d.paid) ? `a ${money(x.d.paid)} toll` : 'a toll', 'to keep working', x.at),
  'npc:rival:win': x => sentence(x.n('agent'), 'stood up to', RIVAL_CREW_NAME, x.at, 'and sent them home'),
  'npc:rival:lose': x => sentence(RIVAL_CREW_NAME, 'put', x.n('agent'), 'down', x.at, x.d.lostTurf ? 'and took the block until midnight' : ''),
  'npc:angry:win': x => sentence(x.n('buyer'), 'came back angry about a bad batch, and', x.n('dealer'), 'saw them off'),
  'npc:angry:lose': x => sentence(x.n('buyer'), 'came back angry about a bad batch, knocked', x.n('dealer'), 'down', money(x.d.lost) ? `and took ${money(x.d.lost)}` : ''),
  'npc:snitch:offer': x => sentence(x.has('snitch') ? withJob(x.game, x.who.snitch) : 'The snitch', 'saw what', x.n('agent'), 'did and named a price to forget it', money(x.d.price) ? `: ${money(x.d.price)}` : ''),
  'npc:snitch:paid': x => sentence(x.n('agent'), 'paid', x.has('snitch') ? withJob(x.game, x.who.snitch) : 'the snitch', money(x.d.price) ?? '', 'to keep quiet'),

  // ---- night
  'night:sleep': x => sentence(x.n('agent'), 'paid', money(x.d.rent) ? `the ${money(x.d.rent)} rent` : 'the rent', 'and slept at home'),
  'night:evicted': x => sentence(x.n('agent'), 'could not pay', money(x.d.rent) ? `the ${money(x.d.rent)} rent` : 'the rent', 'and spent the night on the street'),
  // the night job: every night the NPC robbers try the pad with the biggest stash, and a guard can stand in their way
  'night:job': x => sentence(robbersName(x), 'broke into', nightPad(x), 'in the night', nightGuards(x) ? `, got past ${nightGuards(x)}` : '', 'and took', money(x.d.lost) ?? 'cash', 'from the stash'),
  'night:job:off': x => sentence(robbersName(x), 'tried', nightPad(x), 'in the night', nightGuards(x) ? `, and ${nightGuards(x)}, on guard, saw them off` : 'and could not get in'),
  'night:robbed': x => (x.d.roll
    // the night job: the NPC robbers go for the biggest stash in the projects, whether its owner is home or not
    ? sentence(robbersName(x), 'broke into', x.has('agent') || x.has('owner') ? `${possessive(x.n(x.has('agent') ? 'agent' : 'owner'))} pad` : 'a pad', 'in the night and took', money(x.d.lost) ?? 'cash', 'from the stash')
    : x.has('agent') || x.has('owner')
    ? sentence('While', x.n(x.has('agent') ? 'agent' : 'owner'), 'was locked out,', robbersName(x), 'took', money(x.d.lost) ?? 'cash', 'from the stash')
    : sentence(robbersName(x), 'took', money(x.d.lost) ?? 'cash', 'from a stash while its owner was locked out')),

  // ---- news
  'forecast': x => forecastWords(x.d, x.game),
  'forecast:early': x => sentence('Word on the street:', typeof x.d.who === 'string' ? x.d.who : NPC_ROBBERS_NAME, 'are out early, coming next hour for whoever carries the most cash'),
  'lead': x => (!x.d.leader ? 'The lead changed hands.' : x.d.was ? sentence(nameOf(x.game, x.d.leader), 'took the lead from', nameOf(x.game, x.d.was)) : sentence(nameOf(x.game, x.d.leader), 'took the lead')),
  'rent': x => {
    const out = (Array.isArray(x.d.evicted) ? x.d.evicted : []).map(id => nameOf(x.game, id));
    return sentence(money(x.d.rent) ? `Rent was ${money(x.d.rent)}.` : 'Rent fell due.', out.length ? `${listOf(out)} could not pay and spent the night on the street` : 'Everyone paid');
  },
  'snitch:sold': x => sentence('The snitch sold', x.d.by ? nameOf(x.game, x.d.by) : 'a crime', 'to the police overnight.', isNum(x.d.heat) && x.d.by ? `${nameOf(x.game, x.d.by)} wakes up with ${plural(x.d.heat, 'star')} of heat.` : ''),
  'levelup': () => 'The owners spent their skill points.',
  'standings': x => {
    const top = Array.isArray(x.d.rows) ? x.d.rows[0] : null;
    return top ? sentence('The standings after', isNum(x.d.day) ? `day ${x.d.day}:` : 'the day:', nameOf(x.game, top.id), 'leads', money(top.worth) ? `with ${money(top.worth)}` : '') : 'The standings were published.';
  },
  'note': () => 'An owner left a note.',
  'journal': () => 'The agents wrote their journals.',
  'final': x => {
    // in a small lobby the winner is the richest player, who may not be the richest in the city
    const rows = Array.isArray(x.d.rows) ? x.d.rows : [];
    const top = rows.find(row => row.id === x.game?.state?.winner) ?? rows[0] ?? null;
    return top ? sentence('The season is over.', nameOf(x.game, top.id), 'won', money(top.worth) ? `with ${money(top.worth)}` : '') : 'The season is over.';
  },
};

/** The engine writes recovered goods as "6 product (quality 3)". Say it the way the rest of the page does. */
function tidyGoods(text) {
  const m = /^(\d+) (\w+?)s?(?: \(quality (\d+)\))?$/.exec(text);
  if (!m) return text;
  const good = m[2] === 'gun' ? 'gun' : `${m[2]}${/^(chem|part)$/.test(m[2]) ? 's' : ''}`;
  return goodsWords(good, Number(m[1]), m[3] ? Number(m[3]) : null) ?? text;
}

function policeTip(x) {
  const seller = x.has('informant') ? x.n('informant') : x.n('agent');
  const crime = x.d.by ? `a tip about a crime ${nameOf(x.game, x.d.by)} committed` : 'a tip about a crime';
  if (isNum(x.d.pay) && x.d.pay === 0) return sentence(seller, 'tried to sell the police', `${crime},`, 'but they already knew about it');
  return sentence(seller, 'sold the police', crime, money(x.d.pay) ? `for ${money(x.d.pay)}` : '');
}

/**
 * The noon forecast in a line: where the police are most, where the NPC robbers work tonight and where the rival crew
 * pushes. Takes the feed's forecast line (`{ police, robbers, rival }`) or a forecast event's data.
 */
export function forecastWords(forecast, game) {
  if (!forecast || typeof forecast !== 'object') return 'The forecast is not out yet.';
  const first = game?.cfg?.season?.firstHour ?? 12;
  const parts = [];
  if (Array.isArray(forecast.police)) {
    const hours = {};
    for (const unit of forecast.police) for (const block of Array.isArray(unit) ? unit : []) hours[block] = (hours[block] ?? 0) + 1;
    const most = Object.entries(hours).filter(([block]) => game?.map?.blocks?.[block] || PLACES[block]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([block]) => blockName(game, block));
    if (most.length) parts.push(`The police spend most of the day around ${listOf(most)}.`);
  }
  const robberBlocks = (forecast.robbers?.blocks ?? []).map(block => blockName(game, block));
  if (robberBlocks.length) parts.push(`${NPC_ROBBERS_NAME[0].toUpperCase()}${NPC_ROBBERS_NAME.slice(1)} work ${listOf(robberBlocks)}${isNum(forecast.robbers.fromHour) ? ` from ${first + forecast.robbers.fromHour}:00` : ' tonight'}.`);
  if (forecast.rival?.block) parts.push(`${RIVAL_CREW_NAME[0].toUpperCase()}${RIVAL_CREW_NAME.slice(1)} push onto ${blockName(game, forecast.rival.block)}${isNum(forecast.rival.hour) ? ` at ${first + forecast.rival.hour}:00` : ''}.`);
  else if ('rival' in forecast) parts.push(`${RIVAL_CREW_NAME[0].toUpperCase()}${RIVAL_CREW_NAME.slice(1)} stay home.`);
  return parts.join(' ') || 'A quiet forecast.';
}

/** Every kind of event this file has words for. A test checks it against the engine's own list. */
export const DESCRIBED = Object.freeze(Object.keys(WORDS));

/**
 * One plain sentence for a feed event: names, places and dollars, never an id.
 * `game` is `{ cfg, map, state, feed }`. It is only read, and the sentence still comes out when parts are missing.
 */
export function describe(event, game) {
  if (!event || typeof event !== 'object') return 'Something happened.';
  const who = event.who && typeof event.who === 'object' ? event.who : {};
  const known = recall(game);
  const x = {
    e: event,
    game,
    who,
    d: event.data && typeof event.data === 'object' ? event.data : {},
    has: role => typeof who[role] === 'string' && who[role] !== '',
    n: role => nameOf(game, who[role]),
    at: placeOf(game, event.block),
    offer: known.offers.get(event.data?.offer) ?? null,
    padOwner: null,
    asked: null,
  };
  // The engine counts a board listing down as it sells, in the same record the feed holds. What the agent asked for
  // in its own move that hour is the listing as it was posted.
  if (event.kind === 'offer:made' || event.kind === 'offer:board') {
    const move = known.lines.get(event.t)?.agents?.[who.from]?.move;
    if (move?.verb === 'offer' && move.terms && move.terms.kind === event.data?.terms?.kind && move.terms.good === event.data?.terms?.good) x.asked = move.terms;
  }
  // a break-in that ended in an arrest or a getaway doesn't name the pad: the robber's own move that hour does
  if (!x.has('owner') && typeof event.kind === 'string' && event.kind.startsWith('breakin')) {
    const target = known.lines.get(event.t)?.agents?.[who.robber]?.move?.target;
    if (target && game?.state?.agents?.[target]) x.padOwner = nameOf(game, target);
  }
  const words = WORDS[event.kind];
  const out = words ? words(x) : '';
  return out || sentence('Something happened', x.at);
}

// ---------------------------------------------------------------------------------------------------------------
// Skills at work (D31): a roll that a bought skill decided, in plain words.

/** The four ways a contest can end, seen from the side that started it. */
const ENDINGS = { clean: 'a clean win', messy: 'a messy win', fail: 'a failed try', disaster: 'a disaster' };

/** Who started the contest an event records, by name. Null when the event isn't a contest. */
function starterOf(event, game) {
  const kind = event?.kind ?? '';
  const who = event?.who ?? {};
  if (kind.startsWith('npc:robbers') || kind === 'night:robbed' || kind.startsWith('night:job')) return NPC_ROBBERS_NAME;
  if (kind.startsWith('npc:rival')) return RIVAL_CREW_NAME;
  if (kind.startsWith('npc:angry')) return nameOf(game, who.buyer);
  const id = who.robber ?? who.attacker ?? who.collector ?? who.challenger ?? (kind.startsWith('turf') ? who.dealer : null);
  return id ? nameOf(game, id) : null;
}

/** Engine notes that read better said another way. */
const SAID_BETTER = {
  'slipped past a docks bust': 'slipped a docks run past the police',
  'smelled a police sting': 'kept a street gun sale clear of a police sting',
  'kept the stash hidden while evicted': 'kept the stash hidden through a night on the street',
  'kept the night robbers out of the stash': `made the night harder for ${NPC_ROBBERS_NAME}`,
};

/**
 * One line for a roll a skill decided: "Kim's Getaway 2 turned an arrest into a getaway."
 * `decided` is an entry of a feed line's `decided` list (or of an event's `data.roll.decidedBy`), and `event` is the
 * event it belongs to, when there is one.
 */
export function skillFlag(decided, event, game) {
  if (!decided || typeof decided !== 'object') return '';
  const label = SKILL_TEXT[decided.skill]?.[0] ?? 'a skill';
  const level = skillLevelAt(game, decided.agent, decided.skill, event?.t);
  const skill = `${possessive(nameOf(game, decided.agent))} ${label}${level > 0 ? ` ${level}` : ''}`;
  const roll = event?.data?.roll;
  if (roll && ENDINGS[roll.outcome] && ENDINGS[decided.without] && roll.outcome !== decided.without) {
    const starter = starterOf(event, game);
    if (decided.side === 'd' && starter) return `${skill} turned ${possessive(starter)} ${ENDINGS[decided.without].replace(/^an? /, '')} into ${ENDINGS[roll.outcome]}.`;
    return `${skill} turned ${ENDINGS[decided.without]} into ${ENDINGS[roll.outcome]}.`;
  }
  const what = typeof decided.what === 'string' ? decided.what : '';
  if (/^scared /.test(what)) return `${skill} scared ${NPC_ROBBERS_NAME} off${event?.block ? ` ${blockName(game, event.block)}` : ''} before they could rob anyone.`;
  if (SAID_BETTER[what]) return `${skill} ${SAID_BETTER[what]}.`;
  // the engine's contest notes look like "rob: clean instead of messy": keep those out of a viewer's sight
  if (!what || /instead of/.test(what)) return `${skill} made the difference.`;
  return `${skill} ${what}.`;
}
