// Crews, light (SPEC section 12b). Nobody is ever assigned to lead or to obey: the game makes leading profitable and
// risky, and the agents decide. No seat counts are hard-coded, so crews can grow into factions when the city grows.
// Pattern from hotkey mini's crews.mjs (invites, pots, backup, skims).

import { nextId, isFree, nameOf, lastDueHour } from './state.mjs';
import { trustMark, grudge, tell, clinicBill } from './ledger.mjs';
import { rollContest } from './contest.mjs';
import { xpBeating } from './skills.mjs';
import { toClinic } from './held.mjs';
import { emit } from './stage.mjs';

const no = why => ({ ok: false, why });
const yes = (extra = {}) => ({ ok: true, ...extra });

export const crewOf = (state, agent) => (agent.crew ? state.crews[agent.crew] : null);

/** Check a `crew` move without changing anything. */
export function checkCrew(ctx, agent, move) {
  const { cfg, state } = ctx;
  const crew = crewOf(state, agent);
  switch (move.action) {
    case 'start':
      if (crew) return no('you are already in a crew');
      if (typeof move.name !== 'string' || !move.name.trim()) return no('a crew needs a name');
      return yes();
    case 'invite': {
      if (!crew || crew.boss !== agent.id) return no('only a boss invites');
      const other = state.agents[move.agent];
      if (!other || other.id === agent.id) return no('no such agent');
      if (other.crew) return no(`${other.name} is already in a crew`);
      if (crew.members.length >= cfg.crews.maxMembers) return no('the crew is full');
      if (state.offers.some(o => o.status === 'open' && o.terms.kind === 'crew-invite' && o.to === other.id && o.terms.crew === crew.id)) return no('they already have your invite');
      return yes();
    }
    case 'leave':
      return crew ? yes() : no('you are in no crew');
    case 'challenge': {
      if (!crew || crew.boss === agent.id) return no('there is no boss of yours to challenge');
      const boss = state.agents[crew.boss];
      if (!isFree(boss) || boss.block !== agent.block) return no('the boss has to be on your block');
      if (boss.safeHour === ctx.t) return no("the boss can't be touched this hour");
      return yes();
    }
    case 'skim':
      if (!crew || crew.boss === agent.id) return no('a member skims; a boss pays himself from the pot');
      if (crew.pot <= 0) return no('the pot is empty');
      return yes();
    case 'cut':
      if (!crew || crew.boss !== agent.id) return no('only the boss sets the cut');
      if (!Number.isInteger(move.pct) || move.pct < 0 || move.pct > cfg.crews.maxCutPct) return no(`the cut is 0 to ${cfg.crews.maxCutPct} percent`);
      return yes();
    case 'pay': {
      if (!crew || crew.boss !== agent.id) return no('only the boss spends the pot');
      if (!crew.members.includes(move.agent)) return no('the pot only pays members');
      if (move.agent === agent.id) return no('the pot pays the crew, not its boss');
      if (ctx.t >= lastDueHour(cfg)) return no('the pot is closed for the last hours of the season');
      if (!Number.isInteger(move.amount) || move.amount < 1 || move.amount > crew.pot) return no("the pot doesn't hold that");
      return yes();
    }
    default:
      return no('no such crew action');
  }
}

/** The `crew` verb. */
export function crewMove(ctx, agent, move) {
  const { cfg, state, t } = ctx;
  const check = checkCrew(ctx, agent, move);
  if (!check.ok) return check;
  const crew = crewOf(state, agent);

  switch (move.action) {
    case 'start': {
      const id = nextId(state, 'k');
      const name = move.name.trim().replace(/\s+/g, ' ').slice(0, 24);
      state.crews[id] = { id, name, boss: agent.id, members: [agent.id], cut: 10, pot: 0, paidIn: {}, t, formedAt: null };
      agent.crew = id;
      emit(ctx, 'crew:start', { block: agent.block, who: { boss: agent.id }, data: { crew: id, name }, big: false });
      return yes({ text: `started a crew, "${name}"` });
    }
    case 'invite': {
      const other = state.agents[move.agent];
      state.offers.push({
        id: nextId(state, 'o'), from: agent.id, to: other.id, terms: { kind: 'crew-invite', crew: crew.id }, t, visibleAt: t + 1,
        expires: t + 1 + cfg.deals.offerHours, status: 'open',
      });
      emit(ctx, 'crew:invite', { block: agent.block, who: { boss: agent.id, agent: other.id }, data: { crew: crew.id } });
      return yes({ text: `invited ${other.name} into ${crew.name}` });
    }
    case 'leave':
      leaveCrew(ctx, agent, crew, { why: 'left' });
      return yes({ text: `left ${crew.name}` });
    case 'challenge': {
      const boss = state.agents[crew.boss];
      const roll = rollContest(cfg, state, 'fight', agent, boss, { t });
      ctx.rolls.push({ kind: 'a challenge for the chair', attacker: agent.id, defender: boss.id, P: roll.P, roll: roll.roll, outcome: roll.outcome, why: roll.why, decidedBy: roll.decidedBy });
      for (const d of roll.decidedBy) ctx.decided.push({ ...d, what: `challenge for the chair: ${roll.outcome} instead of ${d.without}` });
      const loserHours = roll.outcome === 'clean' ? cfg.fight.loserClinic : roll.outcome === 'messy' ? cfg.fight.messyClinic : roll.outcome === 'fail' ? cfg.fight.failClinic : cfg.fight.disasterClinic;
      agent.stats.fights += 1;
      agent.stats.troubleStarted += 1;
      ctx.tally.coups += 1;
      if (roll.won) {
        crew.boss = agent.id;
        toClinic(ctx, boss, loserHours);
        if (roll.outcome === 'messy') toClinic(ctx, agent, cfg.fight.messyClinic);
        xpBeating(cfg, boss);
        trustMark(state, cfg, boss.id, agent.id, -3, 'took your chair', t);
        grudge(state, boss, agent.id, 'took your chair', t);
        emit(ctx, 'crew:coup:win', { block: agent.block, who: { challenger: agent.id, boss: boss.id }, data: { crew: crew.id, roll: rollData(roll) } });
        for (const m of crew.members) tell(state, m, t, `${agent.name} beat ${boss.name} and took the chair of ${crew.name}.`);
        return yes({ text: `took the chair of ${crew.name} from ${boss.name}`, roll });
      }
      toClinic(ctx, agent, loserHours);
      xpBeating(cfg, agent);
      trustMark(state, cfg, boss.id, agent.id, -3, 'came for your chair', t);
      emit(ctx, 'crew:coup:lose', { block: agent.block, who: { challenger: agent.id, boss: boss.id }, data: { crew: crew.id, roll: rollData(roll) } });
      for (const m of crew.members) tell(state, m, t, `${agent.name} came for ${boss.name}'s chair and lost.`);
      return yes({ text: `challenged ${boss.name} and lost`, roll });
    }
    case 'skim': {
      const mine = crew.paidIn[agent.id] ?? 0;
      const amount = Math.min(crew.pot, Math.max(1, Math.floor((mine * (100 + cfg.crews.skimExtraPct)) / 100)));
      crew.pot -= amount;
      agent.cash += amount;
      agent.stats.betrayals += 1;
      agent.stats.troubleStarted += 1;
      ctx.tally.betrayals += 1;
      ctx.tally.skims += 1;
      for (const m of crew.members) {
        if (m === agent.id) continue;
        trustMark(state, cfg, m, agent.id, -3, 'skimmed the pot', t);
        grudge(state, state.agents[m], agent.id, 'skimmed the pot', t);
        tell(state, m, t, `${agent.name} skimmed $${amount} from ${crew.name}'s pot and walked.`);
      }
      emit(ctx, 'crew:skim', { block: agent.block, who: { agent: agent.id }, data: { crew: crew.id, amount } });
      leaveCrew(ctx, agent, crew, { why: 'skimmed', quiet: true });
      return yes({ text: `skimmed $${amount} from the pot and left ${crew.name}` });
    }
    case 'cut':
      crew.cut = move.pct;
      emit(ctx, 'crew:cut', { block: agent.block, who: { boss: agent.id }, data: { crew: crew.id, pct: move.pct } });
      for (const m of crew.members) if (m !== agent.id) tell(state, m, t, `${agent.name} set ${crew.name}'s cut to ${move.pct}%.`);
      return yes({ text: `set the cut to ${move.pct}%` });
    case 'pay': {
      const other = state.agents[move.agent];
      crew.pot -= move.amount;
      other.cash += move.amount;
      if (other.id === agent.id) {
        // a boss paying himself is a skim everyone sees
        agent.stats.betrayals += 1;
        ctx.tally.betrayals += 1;
        ctx.tally.skims += 1;
        for (const m of crew.members) {
          if (m === agent.id) continue;
          trustMark(state, cfg, m, agent.id, -2, 'paid himself from the pot', t);
          tell(state, m, t, `${agent.name} paid himself $${move.amount} from ${crew.name}'s pot.`);
        }
      } else {
        trustMark(state, cfg, other.id, agent.id, +1, 'paid you from the pot', t);
        tell(state, other.id, t, `${agent.name} paid you $${move.amount} from the pot.`);
      }
      emit(ctx, 'crew:pay', { block: agent.block, who: { boss: agent.id, agent: other.id }, data: { crew: crew.id, amount: move.amount }, big: other.id === agent.id });
      return yes({ text: `paid ${other.id === agent.id ? 'yourself' : other.name} $${move.amount} from the pot` });
    }
  }
  return no('no such crew action');
}

/** Joining, through the free `accept` field. */
export function joinCrew(ctx, agent, offer) {
  const { cfg, state, t } = ctx;
  const crew = state.crews[offer.terms.crew];
  if (!crew) {
    offer.status = 'expired';
    return no('that crew is gone');
  }
  if (agent.crew) return no('you are already in a crew');
  if (crew.members.length >= cfg.crews.maxMembers) return no('that crew is full');
  crew.members.push(agent.id);
  agent.crew = crew.id;
  offer.status = 'closed';
  if (crew.formedAt === null) {
    crew.formedAt = t;
    ctx.tally.crewsFormed += 1;
  }
  trustMark(state, cfg, crew.boss, agent.id, +1, 'joined your crew', t);
  emit(ctx, 'crew:join', { block: agent.block, who: { agent: agent.id, boss: crew.boss }, data: { crew: crew.id, name: crew.name, size: crew.members.length } });
  for (const m of crew.members) if (m !== agent.id) tell(state, m, t, `${agent.name} joined ${crew.name}.`);
  return yes({ text: `joined ${crew.name}` });
}

function leaveCrew(ctx, agent, crew, { why, quiet = false }) {
  const { state, t } = ctx;
  crew.members = crew.members.filter(m => m !== agent.id);
  agent.crew = null;
  if (!quiet) emit(ctx, 'crew:leave', { block: agent.block, who: { agent: agent.id, boss: crew.boss }, data: { crew: crew.id, why }, big: crew.members.length > 0 });
  if (crew.members.length === 0) {
    // the last one out takes what's left
    agent.cash += crew.pot;
    crew.pot = 0;
    delete state.crews[crew.id];
    for (const o of state.offers) if (o.terms.kind === 'crew-invite' && o.terms.crew === crew.id) o.status = 'expired';
    return;
  }
  if (crew.members.length === 1 && crew.pot > 0) {
    // a crew of one has no pot: what's left sits in the last member's stash
    state.agents[crew.members[0]].stash += crew.pot;
    crew.pot = 0;
  }
  if (crew.boss === agent.id) {
    crew.boss = crew.members[0];
    for (const m of crew.members) tell(state, m, t, `${agent.name} left. ${nameOf(state, crew.boss)} has the chair of ${crew.name} now.`);
  } else if (!quiet) {
    for (const m of crew.members) tell(state, m, t, `${agent.name} left ${crew.name}.`);
  }
}

/** A break-in on the boss's pad takes its share of the pot too: the pot is never immune (SPEC section 12b). */
export function potAt(state, agent) {
  const crew = crewOf(state, agent);
  return crew && crew.boss === agent.id && crew.members.length > 1 ? crew : null;
}

const rollData = roll => ({ P: roll.P, roll: roll.roll, outcome: roll.outcome, why: roll.why, decidedBy: roll.decidedBy });

/** What an agent sees of its own crew. */
export function crewView(state, agent) {
  const crew = crewOf(state, agent);
  if (!crew) return null;
  return {
    id: crew.id, name: crew.name, boss: crew.boss, members: crew.members, cut: crew.cut, pot: crew.pot,
    yourShare: crew.members.length > 1 ? Math.floor(crew.pot / crew.members.length) : 0, paidIn: crew.paidIn[agent.id] ?? 0,
  };
}
