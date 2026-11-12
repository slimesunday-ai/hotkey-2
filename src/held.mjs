// The clinic and the jail: losing costs hours (SPEC sections 7, 8 and 9). Nobody drops off screen: a patient lies in
// a bed at the clinic, a prisoner sits in a cell, and both walk out onto a named block.

import { clinicBill, take, tell } from './ledger.mjs';
import { qualitiesHeld, removeGood, countGood } from './state.mjs';
import { emit } from './stage.mjs';

/** Send an agent to the clinic for `hours`. It loses its move this hour if it hasn't acted, then the hours. */
export function toClinic(ctx, agent, hours) {
  const { cfg, state, t } = ctx;
  if (agent.state !== 'free') return;
  agent.state = 'clinic';
  agent.lastHit = t; // locals leave someone who was just hit alone for a while (no piling on)
  agent.until = t + 1 + hours;
  agent.spot = 'bed';
  agent.stats.clinicHours += hours;
  clinicBill(state, agent, hours, cfg);
  ctx.held?.add(agent.id);
  tell(state, agent.id, t, `You're in the clinic for ${hours} hour${hours > 1 ? 's' : ''} ($${hours * cfg.clinic.perHour}).`);
}

/** How long an arrest holds someone at their current heat. */
export function jailHours(cfg, heat) {
  return cfg.arrest.baseHours + Math.max(0, heat - cfg.heat.arrestAt) * cfg.arrest.perStarAbove;
}

/**
 * Arrest an agent: jail, a fine of 30% of the cash it carries, and its product and guns seized.
 * `scene: false` when the caller has its own scene for it (a robbery gone wrong, a sting, a bust).
 */
export function arrest(ctx, agent, { officer = 'npc:police1', why = 'heat', scene = true, seize = [], light = null } = {}) {
  const { cfg, state, t } = ctx;
  if (agent.state !== 'free') return null;
  // `light` is a short hold with no fine and nothing seized (a sting: the gun is gone already), for that many hours
  const hours = light ?? jailHours(cfg, agent.heat);
  const fine = light ? 0 : take(state, agent, Math.floor((agent.cash * cfg.arrest.finePct) / 100), 'fines');
  const seized = [];
  for (const good of light ? [] : ['product', 'gun']) {
    for (const quality of qualitiesHeld(agent, good)) {
      const n = countGood(agent, good, quality);
      removeGood(agent, good, n, quality);
      seized.push({ good, quality, n });
    }
  }
  for (const good of seize) {
    const n = agent.goods[good];
    if (n > 0) {
      removeGood(agent, good, n);
      seized.push({ good, quality: 1, n });
    }
  }
  const block = agent.block;
  agent.jailStars = agent.heat;
  if (!light) agent.heat = 0;
  agent.state = 'jail';
  agent.until = t + 1 + hours;
  agent.spot = 'cell';
  agent.stats.arrests += 1;
  agent.stats.jailHours += hours;
  ctx.held?.add(agent.id);
  ctx.tally.arrests += 1;
  ctx.tally.npcHits += 1; // the police are NPC trouble too
  tell(state, agent.id, t, `Arrested. ${hours} hours in jail, a $${fine} fine${seized.length ? ', and what you carried is gone' : ''}.`);
  if (scene) emit(ctx, 'arrest', { block, who: { agent: agent.id, officer }, data: { hours, fine, seized, why } });
  return { hours, fine, seized };
}

/**
 * Whoever's time is up by hour `by` walks out, onto the precinct block or the bar block.
 * It runs at the very end of an hour for the next one, so a released agent sees a full menu and plays its hour.
 */
export function releases(ctx, by = ctx.t) {
  const { map, state } = ctx;
  for (const id of state.order) {
    const agent = state.agents[id];
    if (agent.state === 'free' || agent.until > by) continue;
    const from = agent.state;
    agent.block = map.held[from].exit;
    agent.state = 'free';
    agent.spot = 'street';
    agent.jailStars = 0;
    agent.safeHour = by; // nobody can touch them in their first hour out: no camping the door
    emit(ctx, from === 'jail' ? 'release:jail' : 'release:clinic', { block: agent.block, who: { agent: id }, data: { bailedBy: agent.bailedBy ?? null } });
    agent.bailedBy = null;
  }
}

/** Heat from a crime, less what Stealth saves (−1 at levels 2 and 4). */
export function addHeat(cfg, agent, stars) {
  const saved = cfg.skills.stealthHeatAt.filter(at => (agent.skills.stealth ?? 0) >= at).length;
  const gain = Math.max(0, stars - saved);
  agent.heat = Math.min(cfg.heat.max, agent.heat + gain);
  return gain;
}
