// The season's state (SPEC sections 4 and 5). It is plain JSON: no functions, no generator state. Every random draw
// comes from rng(seed, label, ...), so a season saved at any hour and loaded again plays out byte for byte the same.

import { CONFIG } from './config.mjs';
import { CITY, validateMap, blockIds, blocksWith, theBlock } from './map.mjs';
import { FULL_DEMAND } from './market.mjs';
import { blankSkills, spendDefault } from './skills.mjs';
import { agentNames, buildCast } from './cast.mjs';

export const STATE_VERSION = 1;

/** One seat of a lineup: `{ cls, kind: 'bot' | 'ai', lean, variant, owner, persona, model... }`. */
export function defaultLineup(cfg = CONFIG) {
  return cfg.seats.map(cls => ({ cls, kind: 'bot' }));
}

export function createSeason({ seed = 1, cfg = CONFIG, map = CITY, lineup = null, run = null } = {}) {
  validateMap(map);
  const seats = lineup ?? defaultLineup(cfg);
  const names = agentNames(seed, seats.length);
  const home = theBlock(map, 'pads');
  const { npcs, regulars } = buildCast(seed, map, cfg);

  const agents = {};
  const order = [];
  seats.forEach((seat, i) => {
    const id = `a${i + 1}`;
    order.push(id);
    agents[id] = {
      id,
      name: seat.name ?? names[i],
      cls: seat.cls,
      seat: i,
      kind: seat.kind ?? 'bot',
      variant: seat.variant ?? null, // turtle, grind, dead, cautious
      lean: seat.lean ?? null, // bold or careful, set by seed for bots
      owner: !!seat.owner,
      player: !!seat.player, // an owner's agent in a small lobby
      local: !seat.player && seats.some(s => s.player), // a scripted local filling a seat in a season that has players
      agenda: null, // a local's one-line agenda, so a player can plan around it
      model: seat.model ?? null,
      persona: (seat.persona ?? '').slice(0, 300),
      cash: cfg.start.cash,
      stash: cfg.start.stash,
      goods: {
        chems: cfg.start.kit?.[seat.cls]?.chems ?? 0,
        parts: cfg.start.kit?.[seat.cls]?.parts ?? 0,
        product: { ...(cfg.start.kit?.[seat.cls]?.product ?? {}) },
        guns: { ...(cfg.start.kit?.[seat.cls]?.guns ?? {}) },
      },
      heat: 0,
      safeHour: 0, // nobody can be attacked in the season's first hour, or in their first hour out of the clinic or jail
      state: 'free', // free, jail or clinic
      until: 0, // the hour it walks out
      evicted: false,
      block: home,
      spot: 'pad',
      skills: blankSkills(seat.cls),
      bought: [],
      xp: 0,
      xpDay: { partners: [], risks: 0, worked: false },
      xpLog: [],
      points: cfg.start.points,
      pointsEarned: cfg.start.points,
      crew: null,
      clinicDebt: 0,
      docksDebt: 0, // a smuggler's tab at the docks
      sharkDebt: 0, // what it owes the loan shark
      grudges: [], // { against, why, t }
      confessionals: [], // { t, text }
      journals: [], // { day, lines, ask }
      said: [], // the last things it said out loud: { t, text, to }
      note: null, // the owner's last note
      focus: null, // a coach's chip for a bot-played seat: { target: agentId } or { avoid: blockId }
      cased: null, // { t, block } when a robber last cased
      earned: { today: 0, yesterday: 0, byBlock: {}, byBlockYesterday: {} },
      snitchedToday: false,
      stats: {
        earnedNpc: 0, trades: 0, handoffs: 0, couriered: 0, robAttempts: 0, robWins: 0, breakIns: 0, fights: 0, betrayals: 0,
        robbedBy: 0, arrests: 0, clinicHours: 0, jailHours: 0, offersMade: 0, troubleStarted: 0, worked: 0, idle: 0,
      },
    };
  });

  const blocks = {};
  for (const id of blockIds(map)) {
    blocks[id] = {
      demand: map.blocks[id].buyers ? FULL_DEMAND : null,
      turf: null, // an agent id, or 'rival'
      soldThisHour: 0,
      crimes: 0, // today, for tomorrow's police schedule
      crimesYesterday: 0,
    };
  }

  const state = {
    version: STATE_VERSION,
    seed,
    run,
    t: 0, // the next hour to play, 0..59
    phase: 'day', // day, night (paused for owners) or over
    agents,
    order,
    npcs,
    regulars, // per buyer block, the ids of its regulars
    buyers: {}, // per regular: { craving, angryAt, lastBoughtFrom, lastBoughtT }
    blocks,
    docks: { chems: 0, parts: 0, product: 0 }, // bought today
    fenceProductSold: 0,
    police: { schedule: [], blocks: [] }, // today's schedule per unit, and where each unit is this hour
    forecast: null,
    early: [], // trouble announced an hour ahead by the quiet-street rule: { t, block }
    offers: [],
    pickups: [],
    jobs: [],
    contracts: [],
    loans: [],
    tips: [],
    crimes: [],
    loot: [], // what was stolen and from whom, for getting it back: { id, victim, robber, t, cash, lot }
    angry: [], // angry buyers on their way: { t, dealer, buyer }
    snitch: [], // the snitch's offers and unpaid crimes
    crews: {},
    trust: {}, // trust[a][b] = { score, reasons: [...] }
    seen: {}, // seen[a][b] = { block, t }
    standings: null,
    leader: null,
    quiet: 0,
    lastBeat: -1,
    books: { start: 0, in: {}, out: {} },
    ids: { o: 0, p: 0, j: 0, c: 0, l: 0, t: 0, k: 0, x: 0, e: 0 },
    days: [], // per finished day: night results
    players: [], // the owners' agents, when this season is a small lobby
    inbox: {}, // per agent: messages and says waiting to be seen: { messages: [], heard: [], happened: [] }
  };

  for (const id of order) {
    state.trust[id] = {};
    state.seen[id] = {};
    state.inbox[id] = { messages: [], heard: [], happened: [] };
  }
  for (const block of blocksWith(map, 'buyers')) {
    for (const buyer of regulars[block]) state.buyers[buyer] = { craving: 1, angryAt: null, lastBoughtFrom: null, lastBoughtT: -1 };
  }
  state.players = order.filter(id => agents[id].player);
  state.books.start = order.reduce((sum, id) => sum + agents[id].cash + agents[id].stash, 0);

  // Seats without an owner spend their starting points down the class's build order. Owners spend theirs at the
  // pause before hour 0.
  for (const id of order) {
    if (!agents[id].owner) spendDefault(cfg, agents[id]);
  }
  return state;
}

/** A new id of a kind: nextId(state, 'o') gives 'o1', 'o2'... */
export function nextId(state, kind) {
  state.ids[kind] += 1;
  return `${kind}${state.ids[kind]}`;
}

// ---- time

export const dayOf = (cfg, t) => Math.floor(t / cfg.season.hoursPerDay) + 1;
export const hourOfDay = (cfg, t) => t % cfg.season.hoursPerDay;
export const totalHours = cfg => cfg.season.days * cfg.season.hoursPerDay;
/** The last hour anything may fall due: 21:00 on day 5. */
export const lastDueHour = cfg => (cfg.season.days - 1) * cfg.season.hoursPerDay + cfg.season.lastDueHourOfDay5;
/** "day 2, 15:00" */
export function clockText(cfg, t) {
  return `day ${dayOf(cfg, t)}, ${cfg.season.firstHour + hourOfDay(cfg, t)}:00`;
}

// ---- agents

export const agentsIn = state => state.order.map(id => state.agents[id]);
export const isFree = agent => agent.state === 'free';
/** Free agents standing on a block. */
export function agentsOn(state, block) {
  return agentsIn(state).filter(a => isFree(a) && a.block === block);
}
export const nameOf = (state, id) => state.agents[id]?.name ?? state.npcs[id]?.name ?? id;

// ---- goods. Product and guns are kept by quality: goods.product = { 3: 6 } is six units of quality 3.

export const GOODS = ['chems', 'parts', 'product', 'gun'];
const byQuality = good => good === 'product' || good === 'gun';
const bucket = (agent, good) => (good === 'gun' ? agent.goods.guns : agent.goods.product);

export function countGood(agent, good, quality = null) {
  if (!byQuality(good)) return agent.goods[good];
  const b = bucket(agent, good);
  if (quality !== null) return b[quality] ?? 0;
  return Object.values(b).reduce((a, n) => a + n, 0);
}

export function addGood(agent, good, n, quality = 1) {
  if (n < 0 || !Number.isInteger(n)) throw new Error(`bad amount of ${good}: ${n}`);
  if (n === 0) return;
  if (!byQuality(good)) agent.goods[good] += n;
  else bucket(agent, good)[quality] = (bucket(agent, good)[quality] ?? 0) + n;
}

export function removeGood(agent, good, n, quality = 1) {
  if (n < 0 || !Number.isInteger(n)) throw new Error(`bad amount of ${good}: ${n}`);
  if (countGood(agent, good, byQuality(good) ? quality : null) < n) throw new Error(`${agent.id} doesn't have ${n} ${good}`);
  if (!byQuality(good)) agent.goods[good] -= n;
  else {
    const b = bucket(agent, good);
    b[quality] -= n;
    if (b[quality] === 0) delete b[quality];
  }
}

/** The qualities an agent holds of product or guns, best first. */
export function qualitiesHeld(agent, good) {
  return Object.keys(bucket(agent, good)).map(Number).filter(q => bucket(agent, good)[q] > 0).sort((a, b) => b - a);
}

/** The best gun an agent carries, or 0. Guns count just by being carried. */
export const bestGun = agent => qualitiesHeld(agent, 'gun')[0] ?? 0;

/** Every lot an agent carries, as `{ good, quality, n }`. */
export function lots(agent) {
  const out = [];
  if (agent.goods.chems) out.push({ good: 'chems', quality: 1, n: agent.goods.chems });
  if (agent.goods.parts) out.push({ good: 'parts', quality: 1, n: agent.goods.parts });
  for (const q of qualitiesHeld(agent, 'product')) out.push({ good: 'product', quality: q, n: agent.goods.product[q] });
  for (const q of qualitiesHeld(agent, 'gun')) out.push({ good: 'gun', quality: q, n: agent.goods.guns[q] });
  return out;
}

export const carriesGoods = agent => lots(agent).length > 0;

/** Net worth for the standings: cash carried, stash, and an even share of the crew pot (SPEC section 15). */
export function netWorth(state, agent) {
  // what's owed to the clinic and the docks comes off: nobody wins by running up a tab on the last day
  let worth = agent.cash + agent.stash - agent.clinicDebt - agent.docksDebt - agent.sharkDebt;
  // pay the game is holding for this agent's jobs and guards is still its money; what it owes other players is not
  for (const o of state.offers) if (o.from === agent.id && o.held && !o.crew) worth += o.held;
  for (const j of state.jobs) if (j.poster === agent.id && j.held && !j.crew) worth += j.held;
  for (const c of state.contracts) if (c.client === agent.id && c.held) worth += c.held;
  for (const l of state.loans) if (l.borrower === agent.id && (l.status === 'open' || l.status === 'overdue')) worth -= l.owed;
  const crew = agent.crew ? state.crews[agent.crew] : null;
  if (crew && crew.members.length > 1) worth += Math.floor(crew.pot / crew.members.length);
  return worth;
}
