// Contests: one formula for every contested roll (SPEC section 8).
//   P = clamp(50 + the attacker's modifiers − the defender's modifiers, 10, 90) percent
// and the roll lands in one of four bands: clean win, messy win, fail, disaster.
// The same function builds the odds an agent sees on its menu and the odds the engine rolls, so they can't disagree.

import { rng } from './rng.mjs';
import { level } from './skills.mjs';
import { bestGun, agentsOn } from './state.mjs';

export const OUTCOMES = Object.freeze(['clean', 'messy', 'fail', 'disaster']);

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** Crewmates of `agent` standing free on its block. */
function crewmatesWith(state, agent, block = agent.block) {
  if (!agent.crew) return [];
  return agentsOn(state, block).filter(a => a.id !== agent.id && a.crew === agent.crew);
}

/** Everyone guarding `client` on `block` right now: a muscle under contract, or anyone on a guard job. */
export function guardsOf(state, client, block = client.block) {
  const guards = [];
  for (const c of state.contracts) {
    if (c.active && c.client === client.id) {
      const g = state.agents[c.muscle];
      if (g.state === 'free' && g.block === block) guards.push(g);
    }
  }
  for (const j of state.jobs) {
    if (j.status === 'taken' && j.task.type === 'guard' && j.task.agent === client.id) {
      const g = state.agents[j.worker];
      if (g.state === 'free' && g.block === block && !guards.includes(g)) guards.push(g);
    }
  }
  return guards;
}

/** A valid cash tip on `target` held by `agent`, or null. */
export function tipOn(state, agent, target, t) {
  return state.tips.find(tip => tip.type === 'cash' && tip.subject === target.id && tip.holders.includes(agent.id) && tip.expires > t && !tip.spent) ?? null;
}

/**
 * The modifiers of a contest, each with whose skill it is, so the menu can show its reasons and the episode page can
 * say when a bought skill decided a roll.
 * kind: rob, door (a break-in with the owner home), breakin (owner out), fight, turf, collect, npc.
 * For kind 'npc' pass `strength` instead of an attacker.
 */
export function contestOdds(cfg, state, kind, attacker, defender, { t = state.t, strength = null, defenderBlock = null } = {}) {
  const c = cfg.contest;
  const mods = []; // { side: 'a' | 'd', label, value, agent?, skill? }
  const add = (side, label, value, agent = null, skill = null) => {
    if (value) mods.push({ side, label, value, ...(agent ? { agent: agent.id } : {}), ...(skill ? { skill } : {}) });
  };
  const physical = kind !== 'breakin';
  const block = defenderBlock ?? defender.block;

  if (attacker) {
    const gun = bestGun(attacker);
    if (physical) {
      if (level(attacker, 'aim')) add('a', `Aim ${level(attacker, 'aim')}`, level(attacker, 'aim') * (gun ? c.aimArmed : c.aimUnarmed), attacker, 'aim');
      if (gun) add('a', gun > 1 ? `a quality ${gun} gun` : 'a gun', cfg.guns.attack + cfg.guns.attackPerQuality * (gun - 1));
      if (level(attacker, 'toughness')) add('a', `Toughness ${level(attacker, 'toughness')}`, level(attacker, 'toughness') * c.toughness, attacker, 'toughness');
    }
    if (kind === 'rob' || kind === 'door' || kind === 'breakin') {
      if (level(attacker, 'ambush')) add('a', `Ambush ${level(attacker, 'ambush')}`, level(attacker, 'ambush') * c.ambush, attacker, 'ambush');
    }
    if (kind === 'breakin' && level(attacker, 'stealth')) add('a', `Stealth ${level(attacker, 'stealth')}`, level(attacker, 'stealth') * c.stealth, attacker, 'stealth');
    if (kind === 'turf' && level(attacker, 'turf')) add('a', `Turf ${level(attacker, 'turf')}`, level(attacker, 'turf') * c.turf, attacker, 'turf');
    if (kind === 'collect' && level(attacker, 'collect')) add('a', `Collect ${level(attacker, 'collect')}`, level(attacker, 'collect') * c.collect, attacker, 'collect');
    if (physical) {
      const mates = crewmatesWith(state, attacker);
      if (mates.length) add('a', `${mates.length} crewmate${mates.length > 1 ? 's' : ''} with you`, mates.length * c.crewBackup);
    }
    if ((kind === 'rob' || kind === 'door') && tipOn(state, attacker, defender, t)) add('a', 'a tip', c.tip);
  }

  const who = defender.name;
  if (kind === 'breakin') {
    if (level(defender, 'stealth')) add('d', `${who}'s Stealth ${level(defender, 'stealth')}`, level(defender, 'stealth') * c.stealth, defender, 'stealth');
  } else {
    const gun = bestGun(defender);
    if (level(defender, 'aim')) add('d', `${who}'s Aim ${level(defender, 'aim')}`, level(defender, 'aim') * (gun ? c.aimArmed : c.aimUnarmed), defender, 'aim');
    if (gun) add('d', `${who}'s gun`, cfg.guns.defence);
    if (level(defender, 'toughness')) add('d', `${who}'s Toughness ${level(defender, 'toughness')}`, level(defender, 'toughness') * c.toughness, defender, 'toughness');
    if (kind === 'turf' && level(defender, 'turf')) add('d', `${who}'s Turf ${level(defender, 'turf')}`, level(defender, 'turf') * c.turf, defender, 'turf');
    const mates = crewmatesWith(state, defender, block).filter(m => !attacker || m.id !== attacker.id);
    if (mates.length) add('d', `${who}'s crew`, mates.length * c.crewBackup);
  }
  for (const g of guardsOf(state, defender, block)) {
    if (attacker && g.id === attacker.id) continue;
    if (g.cls === 'muscle') {
      if (level(g, 'bodyguard')) add('d', `${g.name}'s Bodyguard ${level(g, 'bodyguard')}`, level(g, 'bodyguard') * c.bodyguard, g, 'bodyguard');
      if (level(g, 'toughness')) add('d', `${g.name} on guard`, level(g, 'toughness') * c.bodyguardToughness, g, 'toughness');
      if (!level(g, 'bodyguard') && !level(g, 'toughness')) add('d', `${g.name} on guard`, c.bodyguardToughness);
    } else {
      add('d', `${g.name} on guard`, Math.max(1, level(g, 'toughness')) * c.hiredGuardToughness, g, 'toughness');
    }
  }

  const base = strength ?? c.base;
  const raw = base + mods.reduce((sum, m) => sum + (m.side === 'a' ? m.value : -m.value), 0);
  const P = clamp(raw, c.min, c.max);
  const why = mods.map(m => `${m.label} ${m.side === 'a' ? '+' : '−'}${m.value}`);
  return { P, raw, base, mods, why };
}

/** Which band a roll of 0..99 lands in at P percent. */
export function bandOf(cfg, P, roll) {
  const b = cfg.contest.band;
  if (roll < P - b) return 'clean';
  if (roll < P) return 'messy';
  if (roll < P + b) return 'fail';
  return 'disaster';
}

/** The chances of each outcome at P percent, out of 100: { clean, messy, fail, disaster }. The odds bar draws these. */
export function chances(cfg, P) {
  const count = { clean: 0, messy: 0, fail: 0, disaster: 0 };
  for (let roll = 0; roll < 100; roll++) count[bandOf(cfg, P, roll)] += 1;
  return count;
}

/**
 * Roll a contest. Deterministic for the same seed, hour, kind and pair.
 * Returns { P, roll, outcome, why, decidedBy } where decidedBy lists every skill whose levels changed the outcome:
 * the same roll without that skill would have landed in a different band (D31).
 */
export function rollContest(cfg, state, kind, attacker, defender, opts = {}) {
  const t = opts.t ?? state.t;
  const odds = contestOdds(cfg, state, kind, attacker, defender, opts);
  const key = [state.seed, 'contest', t, kind, attacker?.id ?? opts.attackerKey ?? 'npc', defender.id];
  // (tests can rig the next rolls: state.rig = { rolls: [5, 95] })
  const roll = state.rig?.rolls?.length ? state.rig.rolls.shift() : Math.floor(rng(...key)() * 100);
  const outcome = bandOf(cfg, odds.P, roll);
  const decidedBy = [];
  for (const m of odds.mods) {
    if (!m.skill) continue;
    const without = clamp(odds.raw - (m.side === 'a' ? m.value : -m.value), cfg.contest.min, cfg.contest.max);
    const other = bandOf(cfg, without, roll);
    if (other !== outcome) decidedBy.push({ agent: m.agent, skill: m.skill, value: m.value, without: other, side: m.side });
  }
  return { ...odds, roll, outcome, decidedBy, won: outcome === 'clean' || outcome === 'messy' };
}

/** A plain percentage roll (a bust, a sting, a blow-up), with the skill that moved it. Deterministic by its keys. */
export function rollChance(state, pct, keys, { skillPct = 0, agent = null, skill = null } = {}) {
  const roll = state.rig?.chances?.length ? state.rig.chances.shift() : Math.floor(rng(state.seed, ...keys)() * 100);
  const chance = clamp(pct - skillPct, 0, 100);
  const hit = roll < chance;
  const decidedBy = skill && skillPct > 0 && !hit && roll < clamp(pct, 0, 100) ? [{ agent: agent.id, skill, value: skillPct, without: 'hit', side: 'a' }] : [];
  return { hit, roll, chance, decidedBy };
}
