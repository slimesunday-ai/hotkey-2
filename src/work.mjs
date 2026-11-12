// The `work` verb: do your class's job, here (SPEC section 6, "What work means").
// The engine knows what work means on this block, so an agent never picks from a long list.

import { theBlock } from './map.mjs';
import { docksBuy, streetUnitPrice, demandAfterSale, streetGunPrice, gunQuality, cookQuality, cookUnits } from './market.mjs';
import { earn, spend, tell, trustMark } from './ledger.mjs';
import { countGood, addGood, removeGood, qualitiesHeld, agentsOn, hourOfDay, isFree } from './state.mjs';
import { level, xpRisk, xpWork } from './skills.mjs';
import { rollChance, rollContest } from './contest.mjs';
import { watchBlock, tipsHeld } from './tips.mjs';
import { sellCrimeToPolice, guardDuties } from './deals.mjs';
import { toClinic, arrest, addHeat } from './held.mjs';
import { emit } from './stage.mjs';

const no = why => ({ ok: false, why });
const yes = (extra = {}) => ({ ok: true, ...extra });

/** Is the block's street market open at this hour? (The park opens at 18:00.) */
export function buyersOpen(cfg, map, block, t) {
  const b = map.blocks[block].buyers;
  return !!b && hourOfDay(cfg, t) >= b.from;
}

/** Are the police on this block this hour? */
export const policeOn = (state, block) => state.police.blocks.includes(block);

/**
 * What `work` would do for this agent right now, without doing it: { ok, why } or { ok, option, options, note }.
 * `option` is the default; `options` lists the choices when there are any.
 */
export function checkWork(ctx, agent, option = null) {
  const { cfg, map, state, t } = ctx;
  const home = theBlock(map, 'pads');
  switch (agent.cls) {
    case 'smuggler': {
      if (agent.block !== theBlock(map, 'supplier')) return no('the supplier is at the docks');
      const good = option ?? 'chems';
      if (!['chems', 'parts', 'product'].includes(good)) return no('a run is chems, parts or ready-made product');
      const want = cfg.docks.unitsPerRun + level(agent, 'haul');
      const buy = affordableRun(cfg, state, agent, good, want);
      if (buy.units === 0) return no(cfg.docks[good].stock - state.docks[good] <= 0 ? `the docks are out of ${good} today` : "you can't afford a single unit");
      return yes({ option: good, options: ['chems', 'parts', 'product'], units: buy.units, cost: buy.cost });
    }
    case 'cook':
      if (agent.block !== home) return no('you cook at your pad');
      if (agent.goods.chems < cfg.cook.chemsPerBatch) return no(`a batch needs ${cfg.cook.chemsPerBatch} chems`);
      return yes({ option: 'cook' });
    case 'dealer': {
      if (!map.blocks[agent.block].buyers) return no('there are no street buyers here');
      if (option === 'claim') {
        if (state.blocks[agent.block].turf === agent.id) return no('this is already your turf');
        return yes({ option: 'claim', options: ['sell', 'claim'] });
      }
      if (!buyersOpen(cfg, map, agent.block, t)) return no('the buyers here come out later');
      if (countGood(agent, 'product') === 0) return no('you have no product to sell');
      return yes({ option: 'sell', options: ['sell', 'claim'] });
    }
    case 'gunrunner': {
      const canBuild = agent.block === home && agent.goods.parts >= cfg.guns.partsPerGun;
      const byPhone = level(agent, 'connections') >= cfg.guns.phoneSalesAtConnections;
      const canSell = countGood(agent, 'gun') > 0 && (map.blocks[agent.block].gunBuyers || byPhone);
      const want = option ?? (canSell && !canBuild ? 'sell' : 'build');
      if (want === 'build') {
        if (agent.block !== home) return no('you build at your pad');
        if (!canBuild) return no(`a gun needs ${cfg.guns.partsPerGun} parts`);
        return yes({ option: 'build', options: canSell ? ['build', 'sell'] : ['build'] });
      }
      if (want === 'sell') {
        if (!canSell) return no(countGood(agent, 'gun') === 0 ? 'you have no gun to sell' : 'street gun buyers are at the bar and the park');
        return yes({ option: 'sell', options: canBuild ? ['build', 'sell'] : ['sell'] });
      }
      return no('you build guns or sell them');
    }
    case 'robber':
      return yes({ option: 'case' });
    case 'muscle': {
      const duty = guardDuties(state).find(d => d.guard.id === agent.id);
      return yes({ option: duty ? 'guard' : 'patrol', pay: !duty && map.blocks[agent.block].shopkeeper ? cfg.floors.patrolPay : 0 });
    }
    case 'informant': {
      if (option && option !== 'watch') {
        const tip = state.tips.find(x => x.id === option);
        if (!tip || tip.type !== 'crime' || !tip.holders.includes(agent.id)) return no("you don't hold that crime tip");
        const byPhone = level(agent, 'network') >= cfg.floors.networkPhoneAt;
        if (agent.block !== theBlock(map, 'police') && !byPhone) return no('the police buy tips at the precinct');
        return yes({ option });
      }
      return yes({ option: 'watch' });
    }
    default:
      return no('this class has no work');
  }
}

function affordableRun(cfg, state, agent, good, want) {
  const barter = level(agent, 'barter');
  // cash first, then the tab: the supplier fronts a smuggler a little, out of its next income
  const budget = agent.cash + Math.max(0, cfg.docks.tab - agent.docksDebt);
  let buy = docksBuy(cfg, good, state.docks[good], want, barter);
  while (buy.units > 0 && buy.cost > budget) buy = docksBuy(cfg, good, state.docks[good], buy.units - 1, barter);
  return buy;
}

/** Do the work. Returns { ok, why } or { ok, text }. */
export function doWork(ctx, agent, option = null) {
  const { cfg, map, state, t } = ctx;
  const check = checkWork(ctx, agent, option);
  if (!check.ok) return check;
  agent.stats.worked += 1;

  switch (agent.cls) {
    case 'smuggler': {
      const good = check.option;
      const buy = affordableRun(cfg, state, agent, good, cfg.docks.unitsPerRun + level(agent, 'haul'));
      const paid = Math.min(agent.cash, buy.cost);
      spend(state, agent, paid, 'docks');
      agent.docksDebt += buy.cost - paid;
      state.docks[good] += buy.units;
      addGood(agent, good, buy.units, 1); // ready-made product from the docks is always quality 1
      if (policeOn(state, agent.block)) {
        xpRisk(cfg, agent, 'a run under police eyes');
        const skillPct = cfg.docks.bustPerSneak * level(agent, 'sneak') + cfg.docks.bustPerStealth * level(agent, 'stealth');
        const bust = rollChance(state, cfg.docks.bustPct, ['bust', t, agent.id], { skillPct, agent, skill: 'sneak' });
        ctx.risks?.push({ what: 'a bust', agent: agent.id, chance: bust.chance, roll: bust.roll, hit: bust.hit });
        if (bust.hit) {
          const officer = officerOn(state, agent.block);
          const block = agent.block;
          const result = arrest(ctx, agent, { officer, why: 'a docks bust', scene: false, seize: ['chems', 'parts'] });
          emit(ctx, 'work:run:bust', { block, spot: 'pier', who: { smuggler: agent.id, officer }, data: { good, units: buy.units, ...result, chance: bust.chance } });
          return yes({ text: `was busted at the docks with ${buy.units} ${good}` });
        }
        if (bust.decidedBy.length) ctx.decided.push(...bust.decidedBy.map(d => ({ ...d, what: 'slipped past a docks bust' })));
      }
      xpWork(cfg, agent);
      emit(ctx, 'work:run', { block: agent.block, spot: 'pier', who: { smuggler: agent.id, supplier: 'npc:supplier' }, data: { good, units: buy.units, cost: buy.cost } });
      return yes({ text: `ran ${buy.units} ${good} in for $${buy.cost}` });
    }

    case 'cook': {
      removeGood(agent, 'chems', cfg.cook.chemsPerBatch);
      const blow = rollChance(state, cfg.cook.blowUpPct, ['blowup', t, agent.id], { skillPct: cfg.cook.blowUpPerSteady * level(agent, 'steady'), agent, skill: 'steady' });
      ctx.risks?.push({ what: 'a blow-up', agent: agent.id, chance: blow.chance, roll: blow.roll, hit: blow.hit });
      if (blow.hit) {
        const block = agent.block;
        agent.heat = Math.min(cfg.heat.max, agent.heat + cfg.cook.blowUpHeat);
        xpRisk(cfg, agent, 'living through a blow-up');
        toClinic(ctx, agent, cfg.cook.blowUpClinicHours);
        emit(ctx, 'work:cook:blowup', { block, spot: `pad:${agent.id}`, who: { cook: agent.id }, data: { lost: cfg.cook.chemsPerBatch } });
        return yes({ text: 'blew up a batch' });
      }
      if (blow.decidedBy.length) ctx.decided.push(...blow.decidedBy.map(d => ({ ...d, what: 'kept a batch from blowing up' })));
      const units = cookUnits(cfg, level(agent, 'yield'));
      const quality = cookQuality(cfg, level(agent, 'purity'));
      addGood(agent, 'product', units, quality);
      xpWork(cfg, agent);
      emit(ctx, 'work:cook', { block: agent.block, spot: `pad:${agent.id}`, who: { cook: agent.id }, data: { units, quality } });
      return yes({ text: `cooked ${units} units of quality ${quality}` });
    }

    case 'dealer':
      return check.option === 'claim' ? claimTurf(ctx, agent) : sellOnStreet(ctx, agent);

    case 'gunrunner': {
      if (check.option === 'build') {
        removeGood(agent, 'parts', cfg.guns.partsPerGun);
        const quality = gunQuality(cfg, level(agent, 'craft'));
        addGood(agent, 'gun', 1, quality);
        xpWork(cfg, agent);
        emit(ctx, 'work:build', { block: agent.block, spot: `pad:${agent.id}`, who: { gunrunner: agent.id }, data: { quality } });
        return yes({ text: `built a quality ${quality} gun` });
      }
      const quality = qualitiesHeld(agent, 'gun')[0];
      const buyer = pickRegular(ctx, agent.block, 0) ?? null;
      xpRisk(cfg, agent, 'a street gun sale');
      const sting = rollChance(state, cfg.guns.stingPct, ['sting', t, agent.id], { skillPct: cfg.guns.stingPerConnections * level(agent, 'connections'), agent, skill: 'connections' });
      ctx.risks?.push({ what: 'a sting', agent: agent.id, chance: sting.chance, roll: sting.roll, hit: sting.hit });
      if (sting.hit) {
        const block = agent.block;
        const officer = 'npc:police2';
        removeGood(agent, 'gun', 1, quality); // the gun is evidence now
        const result = arrest(ctx, agent, { officer, why: 'a police sting', scene: false, light: cfg.guns.stingHours });
        emit(ctx, 'work:gunsale:sting', { block, who: { gunrunner: agent.id, buyer, officer }, data: { quality, ...result, chance: sting.chance } });
        return yes({ text: 'sold a gun to an undercover cop' });
      }
      if (sting.decidedBy.length) ctx.decided.push(...sting.decidedBy.map(d => ({ ...d, what: 'smelled a police sting' })));
      removeGood(agent, 'gun', 1, quality);
      const price = streetGunPrice(cfg, quality, level(agent, 'clientele'));
      earn(state, agent, price, 'street guns');
      xpWork(cfg, agent);
      emit(ctx, 'work:gunsale', { block: agent.block, who: { gunrunner: agent.id, buyer }, data: { quality, price } });
      return yes({ text: `sold a quality ${quality} gun on the street for $${price}` });
    }

    case 'robber': {
      const seen = {};
      for (const a of agentsOn(state, agent.block)) {
        if (a.id === agent.id) continue;
        seen[a.id] = { cash: a.cash, goods: structuredClone(a.goods) };
        if (a.cls === 'dealer' && level(a, 'streetSense') > 0) tell(state, a.id, t, `Someone is casing your block. Street Sense says it's ${agent.name}.`);
      }
      agent.cased = { t, block: agent.block, seen };
      emit(ctx, 'work:case', { block: agent.block, who: { robber: agent.id }, data: { saw: Object.keys(seen).length } });
      return yes({ text: `cased the ${agent.block}` });
    }

    case 'muscle': {
      if (check.option === 'guard') {
        const duty = guardDuties(state).find(d => d.guard.id === agent.id);
        emit(ctx, 'work:guard', { block: agent.block, who: { muscle: agent.id, client: duty.client.id }, data: {} });
        return yes({ text: `stood guard for ${duty.client.name}` });
      }
      ctx.patrols[agent.block] = [...(ctx.patrols[agent.block] ?? []), agent.id];
      let pay = 0;
      if (map.blocks[agent.block].shopkeeper) {
        pay = cfg.floors.patrolPay;
        earn(state, agent, pay, 'shopkeepers');
        xpWork(cfg, agent);
      }
      emit(ctx, 'work:patrol', { block: agent.block, who: { muscle: agent.id, shopkeeper: pay ? `npc:shop:${agent.block}` : undefined }, data: { pay } });
      return yes({ text: pay ? `patrolled the ${agent.block} for the shopkeepers ($${pay})` : `patrolled the ${agent.block}` });
    }

    case 'informant': {
      if (check.option !== 'watch') return sellCrimeToPolice(ctx, agent, check.option, 'work:tipoff');
      const made = watchBlock(ctx, agent);
      if (made.length) xpWork(cfg, agent);
      emit(ctx, 'work:watch', { block: agent.block, who: { informant: agent.id }, data: { tips: made.map(tip => tip.id) } });
      return yes({ text: made.length ? `watched the ${agent.block} and came away with ${made.length} tip${made.length > 1 ? 's' : ''}` : `watched the ${agent.block} and saw nothing worth selling` });
    }
  }
  return no('this class has no work');
}

/** The police unit standing on a block, for the scene. */
export function officerOn(state, block) {
  const i = state.police.blocks.indexOf(block);
  return i === 1 ? 'npc:police2' : 'npc:police1';
}

/** One of the block's regulars, the one craving most (ties by cast order), skipping the first `skip`. */
function pickRegular(ctx, block, skip) {
  const ids = ctx.state.regulars[block];
  if (!ids?.length) return null;
  const sorted = [...ids].sort((a, b) => ctx.state.buyers[b].craving - ctx.state.buyers[a].craving || ids.indexOf(a) - ids.indexOf(b));
  return sorted[skip % sorted.length];
}

/** A dealer's share of a block this hour: 100 alone or on its own turf, 50 on someone else's, 80 when sharing. */
export function dealerShare(ctx, agent) {
  const { cfg, state } = ctx;
  const turf = state.blocks[agent.block].turf;
  if (turf === agent.id) return cfg.street.turfHolderPct;
  if (turf) return cfg.street.turfOtherPct;
  const others = (ctx.dealing[agent.block] ?? []).filter(id => id !== agent.id);
  return others.length ? cfg.street.sharedBlockPct : 100;
}

function sellOnStreet(ctx, agent) {
  const { cfg, map, state, t } = ctx;
  const block = agent.block;
  const here = state.blocks[block];
  const sharePct = dealerShare(ctx, agent);
  const max = cfg.street.unitsPerHour + level(agent, 'hustle');
  const priceKey = map.blocks[block].buyers.price;
  let cash = 0;
  let sold = 0;
  const buyers = [];
  const byQuality = {};
  while (sold < max) {
    const quality = qualitiesHeld(agent, 'product')[0];
    if (!quality) break;
    const price = streetUnitPrice(cfg, priceKey, quality, here.demand, { t, sharePct });
    if (price <= 0) break;
    removeGood(agent, 'product', 1, quality);
    here.demand = demandAfterSale(cfg, here.demand);
    cash += price;
    byQuality[quality] = (byQuality[quality] ?? 0) + 1;
    const buyer = pickRegular(ctx, block, 0);
    if (buyer) {
      const b = state.buyers[buyer];
      b.craving = 0;
      b.lastBoughtFrom = agent.id;
      b.lastBoughtT = t;
      buyers.push(buyer);
      // a bad batch: quality 1 has a chance to send the same face back angry
      if (quality === 1 && state.angry.filter(a => a.dealer === agent.id).length < 2) {
        const r = ctx.rand('angry', agent.id, sold);
        if (Math.floor(r() * 100) < cfg.street.angryPct) {
          state.angry.push({ t: t + 1 + Math.floor(r() * cfg.street.angryWithinHours), dealer: agent.id, buyer });
          b.angryAt = agent.id;
        }
      }
    }
    sold += 1;
  }
  here.soldThisHour += sold;
  if (sold === 0) {
    emit(ctx, 'work:deal:dry', { block, who: { dealer: agent.id }, lists: { waiting: waitingRegulars(ctx, block, []) }, data: {} });
    return yes({ text: 'found no buyers at a price worth taking' });
  }
  earn(state, agent, cash, 'street');
  xpWork(cfg, agent);
  if (policeOn(state, block)) {
    agent.heat = Math.min(cfg.heat.max, agent.heat + cfg.street.policeHeat);
    xpRisk(cfg, agent, 'selling under police eyes');
  }
  emit(ctx, 'work:deal', {
    block, who: { dealer: agent.id }, lists: { buyers, waiting: waitingRegulars(ctx, block, buyers) },
    data: { sold, cash, byQuality, sharePct, demand: here.demand, police: policeOn(state, block) },
  });
  return yes({ text: `sold ${sold} unit${sold > 1 ? 's' : ''} at the ${block} for $${cash}` });
}

/** The regulars on a block who are craving and weren't served this hour: they pace and shake. */
function waitingRegulars(ctx, block, served) {
  return (ctx.state.regulars[block] ?? []).filter(id => !served.includes(id) && ctx.state.buyers[id].craving >= 2).slice(0, 3);
}

function claimTurf(ctx, agent) {
  const { cfg, state, t } = ctx;
  const here = state.blocks[agent.block];
  const holderId = here.turf;
  const holder = holderId && holderId !== 'rival' ? state.agents[holderId] : null;
  if (holder && isFree(holder) && holder.block === agent.block) {
    // the holder is here: a turf fight
    xpRisk(cfg, agent, 'a turf fight');
    xpRisk(cfg, holder, 'a turf fight');
    agent.stats.fights += 1;
    agent.stats.troubleStarted += 1;
    ctx.tally.turfFights += 1;
    const roll = rollContest(cfg, state, 'turf', agent, holder, { t });
    ctx.rolls.push({ kind: 'turf', attacker: agent.id, defender: holder.id, ...rollSummary(roll) });
    for (const d of roll.decidedBy) ctx.decided.push({ ...d, what: `turf fight: ${roll.outcome} instead of ${d.without}` });
    if (roll.won) {
      here.turf = agent.id;
      toClinic(ctx, holder, roll.outcome === 'clean' ? cfg.fight.loserClinic : cfg.fight.messyClinic);
      if (roll.outcome === 'messy') toClinic(ctx, agent, cfg.fight.messyClinic);
      trustMark(state, cfg, holder.id, agent.id, -2, 'took your corner', t);
      emit(ctx, 'turf:win', { block: agent.block, who: { dealer: agent.id, holder: holder.id }, data: { roll: rollSummary(roll) } });
      return yes({ text: `took the ${agent.block} from ${holder.name}`, roll });
    }
    toClinic(ctx, agent, roll.outcome === 'fail' ? cfg.fight.failClinic : cfg.fight.disasterClinic);
    emit(ctx, 'turf:lose', { block: agent.block, who: { dealer: agent.id, holder: holder.id }, data: { roll: rollSummary(roll) } });
    return yes({ text: `tried to take the ${agent.block} from ${holder.name} and lost`, roll });
  }
  if (holderId === 'rival') return no('the Sixes hold this block until midnight');
  here.turf = agent.id;
  emit(ctx, 'work:claim', { block: agent.block, who: { dealer: agent.id }, data: { from: holderId } });
  if (holder) tell(state, holder.id, t, `${agent.name} claimed the ${agent.block} while you were gone.`);
  return yes({ text: `claimed the ${agent.block} as turf until midnight` });
}

export const rollSummary = roll => ({ P: roll.P, roll: roll.roll, outcome: roll.outcome, why: roll.why, decidedBy: roll.decidedBy });
