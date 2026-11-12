// Crimes and tips (SPEC section 12). A tip is an item: it has an id, a type, a subject and an expiry, and it can be
// offered, listed and resold. The same tip can be sold to more than one buyer, which is the informant's risky play.
// Pattern from hotkey mini's facts.mjs: tips are true facts about agents that the engine recorded, never free text.

import { nextId, agentsOn, isFree, dayOf, clockText } from './state.mjs';
import { level } from './skills.mjs';
import { tell } from './ledger.mjs';
import { emit } from './stage.mjs';

export const CRIME_TIP_HOURS = 12;

/** Make a tip. `by` is who made it and holds it first. */
export function makeTip(state, t, { type, subject, by, hours, data = {}, crime = null }) {
  const tip = { id: nextId(state, 't'), type, subject, madeBy: by, holders: [by], soldTo: [], t, expires: t + hours, data, crime, spent: false };
  state.tips.push(tip);
  return tip;
}

/** A tip in words. `known` is whether the reader holds it (and so sees the detail). */
export function tipText(state, tip, cfg) {
  const name = id => state.agents[id]?.name ?? id;
  if (tip.type === 'cash') return `${name(tip.subject)} was carrying $${tip.data.cash} at the ${tip.data.block} (${clockText(cfg, tip.t)}). +${cfg.contest.tip} to rob them.`;
  if (tip.type === 'route') return `The police schedule for the next ${cfg.police.routeTipHours} hours.`;
  return `${name(tip.subject)} ${tip.data.what} at the ${tip.data.block} (${clockText(cfg, tip.t)}).`;
}

/**
 * Record a crime: a robbery, a break-in. The victim always holds the crime tip for what was done to it (D16), the
 * block gets hotter for tomorrow's police schedule, and the snitch may come calling.
 */
export function recordCrime(ctx, { by, victim = null, block, what }) {
  const { cfg, state, t } = ctx;
  const crime = { id: nextId(state, 'x'), by, victim, block, t, what, reported: false, hushed: false, seenBy: [] };
  state.crimes.push(crime);
  state.blocks[block].crimes += 1;
  if (victim && state.agents[victim]) {
    makeTip(state, t, { type: 'crime', subject: by, by: victim, hours: CRIME_TIP_HOURS, data: { what, block }, crime: crime.id });
  }
  // The snitch: when there are no police on the block, he offers the criminal silence, once a day.
  const criminal = state.agents[by];
  const policeHere = state.police.blocks.includes(block);
  if (!policeHere && !criminal.snitchedToday) {
    criminal.snitchedToday = true;
    state.offers.push({
      id: nextId(state, 'o'), from: 'npc:snitch', to: by, terms: { kind: 'snitch', price: cfg.snitch.price, crime: crime.id },
      t, visibleAt: t + 1, expires: t + 3, status: 'open',
    });
    crime.snitch = true;
    emit(ctx, 'npc:snitch:offer', { block, who: { snitch: 'npc:snitch', agent: by }, data: { crime: crime.id, price: cfg.snitch.price } });
    tell(state, by, t, `The snitch saw that. $${cfg.snitch.price} and he forgets it; ignore him and he sells it to the police tonight.`);
  }
  return crime;
}

/** The informant's `work`: watch the block. Makes 1 tip, plus 1 at Eyes 1, 3 and 5. */
export function watchBlock(ctx, informant) {
  const { cfg, state, t } = ctx;
  const eyes = level(informant, 'eyes');
  const count = 1 + cfg.tips.eyesAt.filter(at => eyes >= at).length;
  const made = [];
  const holds = (type, subject, crime = null) => state.tips.some(tip => tip.madeBy === informant.id && tip.type === type && tip.subject === subject && tip.expires > t && (crime === null || tip.crime === crime));

  // 1. crimes done on this block in the last two hours that this informant hasn't written up
  for (const crime of state.crimes) {
    if (made.length >= count) break;
    if (crime.block !== informant.block || crime.t < t - 2 || crime.by === informant.id || crime.seenBy.includes(informant.id)) continue;
    crime.seenBy.push(informant.id);
    made.push(makeTip(state, t, { type: 'crime', subject: crime.by, by: informant.id, hours: CRIME_TIP_HOURS, data: { what: crime.what, block: crime.block }, crime: crime.id }));
  }
  // 2. who is carrying what, richest first
  const carriers = agentsOn(state, informant.block).filter(a => a.id !== informant.id && a.cash >= 40).sort((a, b) => b.cash - a.cash || a.seat - b.seat);
  for (const a of carriers) {
    if (made.length >= count) break;
    if (holds('cash', a.id)) continue;
    made.push(makeTip(state, t, { type: 'cash', subject: a.id, by: informant.id, hours: cfg.tips.cashHours, data: { cash: a.cash, block: a.block } }));
  }
  // 3. where the police will be
  if (made.length < count && !holds('route', 'police')) {
    made.push(makeTip(state, t, { type: 'route', subject: 'police', by: informant.id, hours: cfg.police.routeTipHours, data: {} }));
  }
  return made;
}

/** A cash tip dies when its subject stashes. Old tips are dropped. */
export function spoilTipsOn(state, subjectId) {
  for (const tip of state.tips) if (tip.type === 'cash' && tip.subject === subjectId) tip.spent = true;
}

export function dropOldTips(state, t) {
  state.tips = state.tips.filter(tip => tip.expires > t && !(tip.type === 'cash' && tip.spent) && tip.holders.length > 0);
}

/** The tips an agent holds, for its view. */
export function tipsHeld(state, agent, t) {
  return state.tips.filter(tip => tip.holders.includes(agent.id) && tip.expires > t && !tip.spent);
}

/** Tonight the snitch sells every crime that wasn't hushed or already reported: +2 heat each (SPEC section 9). */
export function snitchSells(ctx) {
  const { cfg, state, t } = ctx;
  const today = dayOf(cfg, t);
  const sold = [];
  for (const crime of state.crimes) {
    if (!crime.snitch || crime.hushed || crime.reported || crime.sold || dayOf(cfg, crime.t) !== today) continue;
    crime.sold = true;
    crime.reported = true;
    const criminal = state.agents[crime.by];
    criminal.heat = Math.min(cfg.heat.max, criminal.heat + cfg.snitch.heat);
    sold.push({ crime: crime.id, by: crime.by, heat: criminal.heat });
    tell(state, criminal.id, t, `The snitch sold you to the police overnight. Your heat is ${criminal.heat} stars.`);
  }
  return sold;
}
