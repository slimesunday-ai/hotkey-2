// The menu (SPEC section 6): every hour each agent gets only its legal options, each with its odds and the reasons.
//   rob Kim · 62%: Ambush 2 +10, a gun +15, a tip +15, Kim's Toughness 3 −15
// The same checks the resolver runs build the menu, so an option on the menu is an option that works.
// Pattern from hotkey mini's menu.mjs (menus with odds and reasons).

import { neighbors, theBlock, distance, stepToward } from './map.mjs';
import { fenceBuys, fenceSells, usualProductPrice, bailFor, courierFee } from './market.mjs';
import { agentsOn, isFree, lots, countGood, qualitiesHeld, lastDueHour } from './state.mjs';
import { level } from './skills.mjs';
import { checkWork, buyersOpen, policeOn } from './work.mjs';
import { checkAttack, collectable, lootOut } from './attacks.mjs';
import { checkOffer, offersFor, pickupsOf, dutiesOf, goodsText } from './deals.mjs';
import { checkCrew, crewOf } from './crews.mjs';
import { tipsHeld } from './tips.mjs';
import { chances } from './contest.mjs';

const BLOCK_NOTES = {
  pads: 'pads and stashes', fence: 'the fence and the gun shop', supplier: 'the docks supplier', police: 'bail and the police desk',
};

function blockNote(cfg, map, state, block, t) {
  const b = map.blocks[block];
  const notes = [];
  for (const [feature, text] of Object.entries(BLOCK_NOTES)) if (b[feature]) notes.push(text);
  if (b.buyers) notes.push(buyersOpen(cfg, map, block, t) ? 'street buyers' : `street buyers from ${cfg.season.firstHour + b.buyers.from}:00`);
  if (policeOn(state, block)) notes.push('police there now');
  return notes.join(', ');
}

/** What your usual price would be for one unit of a lot, the anchor an offer starts from. */
export function usualEach(cfg, good, quality = 1) {
  if (good === 'chems') return cfg.usual.chems;
  if (good === 'parts') return cfg.usual.parts;
  if (good === 'gun') return cfg.usual.gun * quality;
  return usualProductPrice(cfg, quality);
}

/**
 * Build an agent's menu for this hour. Each entry: { id, verb, label, move, odds?, why?, args? }.
 * `move` is the structured move the resolver takes. An entry with `args` is a template: the reply fills them in.
 */
export function buildMenu(ctx, agent) {
  const { cfg, map, state, t } = ctx;
  const menu = [];
  const add = entry => {
    entry.id = `m${menu.length + 1}`;
    menu.push(entry);
    return entry;
  };
  if (!isFree(agent)) return menu; // in jail or the clinic: no move, only talk and the free accept

  const home = theBlock(map, 'pads');
  const here = agent.block;
  const others = agentsOn(state, here).filter(a => a.id !== agent.id);
  const everyone = state.order.filter(id => id !== agent.id);

  // ---- pick-ups lead the menu: where to walk to make the swap
  for (const p of pickupsOf(ctx, agent)) {
    if (p.moves && p.moves > 0) {
      const to = stepToward(map, here, state.agents[p.with].block);
      add({ verb: 'move', label: `walk to the ${to}, toward ${state.agents[p.with].name} for your pick-up (${p.youGive} for ${p.youGet}; ${p.moves} move${p.moves > 1 ? 's' : ''} away, ${p.hoursLeft}h left)`, move: { verb: 'move', to }, pickup: p.id });
    }
  }

  // ---- if you were robbed: the answers come first (D16)
  for (const loot of lootOut(state, agent, t)) {
    const robber = state.agents[loot.robber];
    if (isFree(robber) && robber.block === here) {
      const check = checkAttack(ctx, agent, { target: robber.id, how: 'fight' });
      if (check.ok) add({ verb: 'attack', label: `fight ${robber.name} to take back what's left of yours`, odds: check.odds.P, why: check.odds.why, move: { verb: 'attack', target: robber.id, how: 'fight' }, answer: true });
    } else if (isFree(robber) && distance(map, here, robber.block) > 0) {
      const to = stepToward(map, here, robber.block);
      if (!menu.some(m => m.verb === 'move' && m.move.to === to && m.answer)) add({ verb: 'move', label: `walk to the ${to}, after ${robber.name} (on the ${robber.block}, ${loot.hoursLeft}h left to get it back)`, move: { verb: 'move', to }, answer: true });
    }
    if (agent.cash >= 10 && !state.offers.some(o => o.from === agent.id && o.status === 'open' && o.terms.kind === 'job' && o.terms.task.type === 'recover')) {
      add({ verb: 'offer', label: `post a job: get back what ${robber.name} took from you`, move: { verb: 'offer', to: 'anyone', terms: { kind: 'job', task: { type: 'recover' }, pay: Math.min(agent.cash, 30), sharePct: 20 } },
        args: { to: ['anyone', ...everyone.filter(id => id !== robber.id)], pay: { min: 1, max: agent.cash } }, answer: true });
    }
  }

  // ---- move
  for (const to of neighbors(map, here)) {
    if (menu.some(m => m.verb === 'move' && m.move.to === to)) continue;
    add({ verb: 'move', label: `walk to the ${to} (${blockNote(cfg, map, state, to, t)})`, move: { verb: 'move', to } });
  }

  // ---- work
  const work = checkWork(ctx, agent);
  if (work.ok) {
    for (const option of work.options ?? [work.option]) {
      const check = option === work.option ? work : checkWork(ctx, agent, option);
      if (!check.ok) continue;
      const risk = workRisk(ctx, agent, option);
      add({ verb: 'work', label: workLabel(ctx, agent, option, check), move: { verb: 'work', option }, ...(risk ? { risk } : {}) });
    }
  } else if (agent.cls === 'dealer' && map.blocks[here].buyers) {
    const claim = checkWork(ctx, agent, 'claim');
    if (claim.ok) add({ verb: 'work', label: workLabel(ctx, agent, 'claim', claim), move: { verb: 'work', option: 'claim' } });
  }
  if (agent.cls === 'informant') {
    for (const tip of tipsHeld(state, agent, t).filter(x => x.type === 'crime')) {
      const check = checkWork(ctx, agent, tip.id);
      if (check.ok) add({ verb: 'work', label: `sell the police what ${state.agents[tip.subject].name} did ($${Math.floor((cfg.floors.crimeTip * (100 + cfg.floors.networkPct * level(agent, 'network'))) / 100)}, once per crime)`, move: { verb: 'work', option: tip.id } });
    }
  }

  // ---- attack: everyone on your block, with the odds and why
  for (const other of others) {
    for (const how of ['rob', 'fight']) {
      if (menu.some(m => m.verb === 'attack' && m.move.target === other.id && m.move.how === how)) continue;
      const check = checkAttack(ctx, agent, { target: other.id, how });
      if (check.ok) add({ verb: 'attack', label: `${how} ${other.name}`, odds: check.odds.P, why: check.odds.why, move: { verb: 'attack', target: other.id, how } });
    }
    const loan = collectable(state, agent, other);
    if (loan) {
      const check = checkAttack(ctx, agent, { target: other.id, how: 'collect' });
      if (check.ok) add({ verb: 'attack', label: `collect the $${loan.owed} ${other.name} owes ${loan.lender === agent.id ? 'you' : state.agents[loan.lender].name}`, odds: check.odds.P, why: check.odds.why, move: { verb: 'attack', target: other.id, how: 'collect' } });
    }
  }
  if (agent.cls === 'robber' && here === home) {
    for (const id of everyone) {
      const check = checkAttack(ctx, agent, { target: id, how: 'break-in' });
      if (check.ok) add({ verb: 'attack', label: `break into ${state.agents[id].name}'s pad (${check.home ? 'they are home: a fight at the door' : 'they are out'})`, odds: check.odds.P, why: check.odds.why, move: { verb: 'attack', target: id, how: 'break-in' } });
    }
  }

  // ---- offer: NPCs on this block, at their posted prices
  if (map.blocks[here].fence) {
    for (const lot of lots(agent)) {
      const each = fenceBuys(cfg, lot.good, lot.quality, agent.cls === 'smuggler' ? level(agent, 'barter') : 0);
      add({ verb: 'offer', label: `sell the fence your ${goodsText(lot.good, lot.n, lot.quality)} at $${each} each`, move: { verb: 'offer', to: 'fence', terms: { kind: 'sell', good: lot.good, q: lot.quality, n: lot.n } }, args: { n: { min: 1, max: lot.n } } });
    }
    for (const good of ['chems', 'parts', 'product']) {
      const each = fenceSells(cfg, good);
      const stock = good === 'product' ? cfg.fence.productPerDay - state.fenceProductSold : 99;
      const max = Math.min(Math.floor(agent.cash / each), stock);
      if (max >= 1) add({ verb: 'offer', label: `buy ${good === 'product' ? 'quality 1 product' : good} from the fence at $${each} each (up to ${max})`, move: { verb: 'offer', to: 'fence', terms: { kind: 'buy', good, n: max } }, args: { n: { min: 1, max } } });
    }
  }
  if (map.blocks[here].fence && agent.sharkDebt === 0 && agent.cash + agent.stash < cfg.shark.onlyUnder) {
    add({ verb: 'offer', label: `take a stake from the loan shark: ${cfg.shark.max} now, ${Math.ceil((cfg.shark.max * cfg.shark.repayPct) / 100)} out of what you earn next`, move: { verb: 'offer', to: 'fence', terms: { kind: 'stake', amount: cfg.shark.max } }, args: { amount: { min: 1, max: cfg.shark.max } } });
  }
  if (map.blocks[here].gunshop && agent.cash >= cfg.gunshop.price) {
    add({ verb: 'offer', label: `buy a gun at the gun shop for $${cfg.gunshop.price}`, move: { verb: 'offer', to: 'gunshop', terms: { kind: 'buy', good: 'gun' } } });
  }
  if (map.blocks[here].police) {
    if (agent.cls !== 'informant') {
      for (const tip of tipsHeld(state, agent, t).filter(x => x.type === 'crime')) {
        add({ verb: 'offer', label: `sell the police what ${state.agents[tip.subject].name} did ($${cfg.floors.crimeTip}, once per crime)`, move: { verb: 'offer', to: 'police', terms: { kind: 'tip', tip: tip.id } } });
      }
    }
    for (const id of everyone) {
      const prisoner = state.agents[id];
      if (prisoner.state !== 'jail') continue;
      const price = bailFor(cfg, prisoner.jailStars ?? 0);
      if (agent.cash >= price) add({ verb: 'offer', label: `bail ${prisoner.name} out for $${price}`, move: { verb: 'offer', to: 'police', terms: { kind: 'bail', agent: id } } });
    }
  }

  // ---- offer: to players. Templates: the reply names who, how many and the price.
  const anyoneOrAgent = ['anyone', ...everyone];
  // on credit: add a due hour and the goods change hands now, paid for out of what the buyer earns
  const canCredit = t + 2 <= lastDueHour(cfg);
  const creditArg = canCredit ? { due: { min: t + 2, max: lastDueHour(cfg) } } : {};
  const creditNote = canCredit ? '; add a due hour to make it on credit: goods now, paid from what the buyer earns' : '';
  for (const lot of lots(agent)) {
    const each = usualEach(cfg, lot.good, lot.quality);
    add({ verb: 'offer', label: `offer to sell your ${goodsText(lot.good, lot.n, lot.quality)} (usual price ${each} each${creditNote})`,
      move: { verb: 'offer', to: 'anyone', terms: { kind: 'sell', good: lot.good, q: lot.quality, n: lot.n, each } },
      args: { to: anyoneOrAgent, n: { min: 1, max: lot.n }, each: { min: 1 }, courier: [false, true], ...creditArg } });
  }
  const wants = { cook: ['chems'], dealer: ['product'], gunrunner: ['parts'] }[agent.cls] ?? [];
  for (const good of [...wants, ...(countGood(agent, 'gun') === 0 && agent.cls !== 'gunrunner' ? ['gun'] : [])]) {
    const quality = good === 'product' ? 3 : 1;
    const each = usualEach(cfg, good, quality);
    const max = Math.floor(agent.cash / each);
    if (max < 1 && !canCredit) continue;
    add({ verb: 'offer', label: `offer to buy ${good === 'gun' ? 'a gun' : good} (usual price ${each} each${good === 'product' ? ' at quality 3 or better' : ''}; you carry enough for ${max}${creditNote})`,
      move: { verb: 'offer', to: 'anyone', terms: { kind: 'buy', good, q: quality, n: good === 'gun' ? 1 : Math.max(1, Math.min(max, 6)), each } },
      args: { to: anyoneOrAgent, n: { min: 1, max: 32 }, each: { min: 1 }, ...(good === 'product' || good === 'gun' ? { q: { min: 1, max: good === 'gun' ? 3 : 5 } } : {}), courier: [false, true], ...creditArg } });
  }
  for (const tip of tipsHeld(state, agent, t)) {
    const price = tip.type === 'cash' ? cfg.usual.cashTip : tip.type === 'route' ? cfg.usual.routeTip : cfg.usual.crimeTip;
    add({ verb: 'offer', label: `offer to sell a tip: ${tipLabel(state, tip)} (usual price $${price})`,
      move: { verb: 'offer', to: 'anyone', terms: { kind: 'tip', tip: tip.id, price } }, args: { to: anyoneOrAgent, price: { min: 1, max: cfg.deals.tipMaxPrice } } });
  }
  if (agent.cls === 'muscle' && !state.contracts.some(c => c.active && c.muscle === agent.id)) {
    add({ verb: 'offer', label: `offer protection (usual price $${cfg.usual.protectPerHour} an hour)`,
      move: { verb: 'offer', to: 'anyone', terms: { kind: 'protect', hours: 4, price: 4 * cfg.usual.protectPerHour } }, args: { to: anyoneOrAgent, hours: { min: 1, max: 12 }, price: { min: 1 } } });
  }
  if (agent.cash >= 10) {
    add({ verb: 'offer', label: 'post a paid job (the game holds the pay): rob, fight, guard, deliver or bail',
      move: { verb: 'offer', to: 'anyone', terms: { kind: 'job', task: { type: 'guard', hours: 3 }, pay: Math.min(agent.cash, 3 * cfg.usual.protectPerHour) } },
      args: { to: anyoneOrAgent, task: ['rob <agent>', 'fight <agent>', 'guard <agent or me> <hours>', 'deliver <n> <goods> <agent>', 'bail <agent>'], pay: { min: 1, max: agent.cash },
        // a boss can pay a job from the crew pot instead of its own pocket
        ...(crewOf(state, agent)?.boss === agent.id && crewOf(state, agent).pot > 0 && t < lastDueHour(cfg) ? { fromPot: [false, true] } : {}) } });
    const dueMax = lastDueHour(cfg);
    if (t + 2 <= dueMax) {
      add({ verb: 'offer', label: 'offer a loan: cash now, more back by a due hour (the game collects)',
        move: { verb: 'offer', to: 'anyone', terms: { kind: 'loan', amount: Math.min(agent.cash, 50), repay: Math.ceil(Math.min(agent.cash, 50) * 1.3), due: Math.min(dueMax, t + 12) } },
        args: { to: anyoneOrAgent, amount: { min: 1, max: agent.cash }, repay: { min: 1 }, due: { min: t + 2, max: dueMax } } });
    }
    add({ verb: 'offer', label: 'give cash or goods to someone (handed over when you meet, or by courier)',
      move: { verb: 'offer', to: everyone[0], terms: { kind: 'gift', cash: Math.min(agent.cash, 20) } }, args: { to: everyone, cash: { min: 1, max: agent.cash }, courier: [false, true] } });
  }
  {
    const dueMax = lastDueHour(cfg);
    if (t + 2 <= dueMax) {
      add({ verb: 'offer', label: 'ask for a loan: cash now, more back by a due hour',
        move: { verb: 'offer', to: 'anyone', terms: { kind: 'borrow', amount: 60, repay: 80, due: Math.min(dueMax, t + 12) } },
        args: { to: anyoneOrAgent, amount: { min: 1 }, repay: { min: 1 }, due: { min: t + 2, max: dueMax } } });
    }
  }
  for (const o of state.offers.filter(x => x.from === agent.id && x.to === 'anyone' && x.status === 'open' && x.terms.kind !== 'job')) {
    add({ verb: 'offer', label: `take down your listing ${o.id}`, move: { verb: 'offer', to: 'anyone', terms: { kind: 'withdraw', id: o.id } } });
  }

  // ---- stash, rest
  if (here === home) {
    if (agent.cash > 0) add({ verb: 'stash', label: `stash cash at your pad (you carry $${agent.cash})`, move: { verb: 'stash', amount: agent.cash }, args: { amount: { min: 1, max: agent.cash } } });
    if (agent.stash > 0) add({ verb: 'stash', label: `take cash out of your stash ($${agent.stash} in it)`, move: { verb: 'stash', amount: -agent.stash }, args: { amount: { min: -agent.stash, max: -1 } } });
  }
  add({ verb: 'rest', label: agent.heat > 0 ? (policeOn(state, here) ? 'lie low (no use here: the police are on this block)' : `lie low: heat ${agent.heat} down to ${agent.heat - 1}`) : 'rest', move: { verb: 'rest' } });

  // ---- crew
  const crew = crewOf(state, agent);
  if (!crew) add({ verb: 'crew', label: 'start a crew (you become its boss; invite up to 3 others)', move: { verb: 'crew', action: 'start', name: `${agent.name}'s crew` }, args: { name: 'text' } });
  else {
    if (crew.boss === agent.id) {
      const free = everyone.filter(id => checkCrew(ctx, agent, { action: 'invite', agent: id }).ok);
      if (free.length) add({ verb: 'crew', label: `invite someone into ${crew.name}`, move: { verb: 'crew', action: 'invite', agent: free[0] }, args: { agent: free } });
      add({ verb: 'crew', label: `set ${crew.name}'s cut of members' income (now ${crew.cut}%)`, move: { verb: 'crew', action: 'cut', pct: crew.cut }, args: { pct: { min: 0, max: cfg.crews.maxCutPct } } });
      const others = crew.members.filter(m => m !== agent.id);
      if (crew.pot > 0 && others.length && t < lastDueHour(cfg)) add({ verb: 'crew', label: `pay a member from the pot (${crew.pot} in it)`, move: { verb: 'crew', action: 'pay', agent: others[0], amount: Math.min(crew.pot, 20) }, args: { agent: others, amount: { min: 1, max: crew.pot } } });
    } else {
      const ch = checkCrew(ctx, agent, { action: 'challenge' });
      if (ch.ok) {
        const check = checkAttack(ctx, agent, { target: crew.boss, how: 'fight' });
        add({ verb: 'crew', label: `challenge ${state.agents[crew.boss].name} for the chair of ${crew.name}`, odds: check.ok ? check.odds.P : undefined, why: check.ok ? check.odds.why : undefined, move: { verb: 'crew', action: 'challenge' } });
      }
      if (checkCrew(ctx, agent, { action: 'skim' }).ok) add({ verb: 'crew', label: `skim the pot and walk out of ${crew.name} (a betrayal everyone sees)`, move: { verb: 'crew', action: 'skim' } });
    }
    add({ verb: 'crew', label: `leave ${crew.name}`, move: { verb: 'crew', action: 'leave' } });
  }

  // ---- quit
  const duties = dutiesOf(state, agent);
  for (const c of duties.contracts.filter(x => x.muscle === agent.id)) add({ verb: 'quit', label: `walk out on ${state.agents[c.client].name} (you forfeit the rest of the pay; everyone sees it)`, move: { verb: 'quit', id: c.id } });
  for (const j of duties.jobs.filter(x => x.worker === agent.id)) add({ verb: 'quit', label: `drop the job for ${state.agents[j.poster]?.name ?? state.npcs[j.poster]?.crew ?? 'the house'} (everyone sees it)`, move: { verb: 'quit', id: j.id } });

  // the odds bar: a contested move's four outcomes, out of 100 (the same split the roll will use)
  for (const entry of menu) if (typeof entry.odds === 'number') entry.bands = chances(cfg, entry.odds);
  return menu;
}

/** The plain chance that an hour of work goes wrong, as the engine will roll it: { what, pct }, or null. */
export function workRisk(ctx, agent, option) {
  const { cfg, state } = ctx;
  const pct = x => Math.max(0, Math.min(100, x));
  if (agent.cls === 'smuggler' && policeOn(state, agent.block)) {
    return { what: 'a bust', pct: pct(cfg.docks.bustPct - cfg.docks.bustPerSneak * level(agent, 'sneak') - cfg.docks.bustPerStealth * level(agent, 'stealth')) };
  }
  if (agent.cls === 'cook') return { what: 'a blow-up', pct: pct(cfg.cook.blowUpPct - cfg.cook.blowUpPerSteady * level(agent, 'steady')) };
  if (agent.cls === 'gunrunner' && option === 'sell') return { what: 'a sting', pct: pct(cfg.guns.stingPct - cfg.guns.stingPerConnections * level(agent, 'connections')) };
  return null;
}

function workLabel(ctx, agent, option, check) {
  const { cfg, map, state, t } = ctx;
  switch (agent.cls) {
    case 'smuggler': return `${option === 'product' ? 'bring in ready-made low-grade product (quality 1)' : 'run ' + option + ' in'} at the docks: ${check.units} for ${check.cost}${policeOn(state, agent.block) ? ` (police are here: ${Math.max(0, cfg.docks.bustPct - cfg.docks.bustPerSneak * level(agent, 'sneak') - cfg.docks.bustPerStealth * level(agent, 'stealth'))}% bust)` : ''}`;
    case 'cook': return `cook a batch: ${cfg.cook.chemsPerBatch} chems into product (${Math.max(0, cfg.cook.blowUpPct - cfg.cook.blowUpPerSteady * level(agent, 'steady'))}% blow-up)`;
    case 'dealer': {
      if (option === 'claim') {
        const turf = state.blocks[agent.block].turf;
        return turf && turf !== 'rival' ? `fight ${state.agents[turf]?.name ?? 'the holder'} for this corner` : 'claim this block as your turf until midnight (others sell at half here)';
      }
      const q = qualitiesHeld(agent, 'product')[0];
      const demandPct = Math.round(state.blocks[agent.block].demand / 10);
      return `sell product here: up to ${cfg.street.unitsPerHour + level(agent, 'hustle')} units, best quality first (quality ${q}; demand ${demandPct}%)${policeOn(state, agent.block) ? ' (police are here: +1 heat)' : ''}`;
    }
    case 'gunrunner':
      return option === 'build' ? `build a gun from ${cfg.guns.partsPerGun} parts` : `sell a gun to a street buyer (${Math.max(0, cfg.guns.stingPct - cfg.guns.stingPerConnections * level(agent, 'connections'))}% it's a sting)`;
    case 'robber': return 'case this block: see exactly what everyone here carries';
    case 'muscle': return option === 'guard' ? 'stand guard for your client' : check.pay ? `patrol this block for the shopkeepers ($${check.pay})` : 'patrol this block (nobody pays here)';
    case 'informant': return 'watch this block and collect tips';
    default: return 'work';
  }
}

function tipLabel(state, tip) {
  if (tip.type === 'cash') return `what ${state.agents[tip.subject].name} is carrying`;
  if (tip.type === 'route') return 'the police schedule';
  return `a crime ${state.agents[tip.subject].name} did`;
}

/**
 * Turn a reply's choice into a move. `choice` is { id, ...args } picked from the menu, or a full structured move.
 * Arguments outside the entry's ranges are clamped; anything else falls back to the entry's own default.
 */
export function chooseFromMenu(menu, choice) {
  if (!choice || typeof choice !== 'object') return null;
  if (choice.verb) return choice; // a structured move: the resolver checks it
  const entry = menu.find(m => m.id === choice.id);
  if (!entry) return null;
  const move = structuredClone(entry.move);
  const args = entry.args ?? {};
  const num = (value, spec, fallback) => {
    if (!Number.isInteger(value)) return fallback;
    let v = value;
    if (spec.min !== undefined) v = Math.max(spec.min, v);
    if (spec.max !== undefined) v = Math.min(spec.max, v);
    return v;
  };
  if (move.verb === 'offer') {
    if (Array.isArray(args.to) && args.to.includes(choice.to)) move.to = choice.to;
    for (const key of ['n', 'each', 'price', 'pay', 'amount', 'repay', 'due', 'hours', 'q', 'cash']) {
      if (args[key] && choice[key] !== undefined) move.terms[key] = num(choice[key], args[key], move.terms[key]);
    }
    if (args.courier && choice.courier === true) move.terms.courier = true;
    if (args.task && choice.task && typeof choice.task === 'object') move.terms.task = choice.task;
    if (args.fromPot && choice.fromPot === true) move.terms.fromPot = true;
    if (choice.sharePct !== undefined && move.terms.kind === 'job') move.terms.sharePct = num(choice.sharePct, { min: 0, max: 100 }, move.terms.sharePct);
    if (move.terms.kind === 'gift' && choice.good) {
      delete move.terms.cash;
      Object.assign(move.terms, { good: choice.good, q: choice.q ?? 1, n: Number.isInteger(choice.n) ? choice.n : 1 });
    }
  } else if (move.verb === 'stash') {
    if (args.amount && choice.amount !== undefined) move.amount = num(choice.amount, args.amount, move.amount);
  } else if (move.verb === 'crew') {
    if (args.name && typeof choice.name === 'string') move.name = choice.name;
    if (Array.isArray(args.agent) && args.agent.includes(choice.agent)) move.agent = choice.agent;
    if (args.pct && choice.pct !== undefined) move.pct = num(choice.pct, args.pct, move.pct);
    if (args.amount && choice.amount !== undefined) move.amount = num(choice.amount, args.amount, move.amount);
  }
  return move;
}
