// What an agent sees (SPEC section 13): one compact object per agent per hour. Bots and AI seats play from the same
// view, so the free bot runs test exactly what the models will be shown.
// Other agents' words reach an agent only as quoted speech here, never as instructions (pattern from the original
// engine's agents/speech-context.mjs).

import { theBlock } from './map.mjs';
import { rentOn } from './market.mjs';
import { agentsOn, isFree, dayOf, hourOfDay, bestGun, netWorth } from './state.mjs';
import { level } from './skills.mjs';
import { buyersOpen, policeOn } from './work.mjs';
import { policeAhead } from './npc.mjs';
import { offersFor, offerText, pickupsOf, dutiesOf, taskText } from './deals.mjs';
import { lootOut } from './attacks.mjs';
import { crewView } from './crews.mjs';
import { tipsHeld, tipText } from './tips.mjs';
import { buildMenu } from './menu.mjs';
import { RIVAL_CREW_NAME, NPC_ROBBERS_NAME } from './cast.mjs';

/** A rough word for what someone carries. Exact numbers need Read, a casing or a tip. */
export function cashBracket(cash) {
  return cash < 20 ? 'broke' : cash < 150 ? 'some' : 'loaded';
}

/** The exact cash `viewer` knows `other` carries, or null. */
function exactCash(cfg, state, viewer, other, t) {
  if (viewer.cls === 'robber' && level(viewer, 'read') >= 1) return other.cash;
  if (viewer.cased && viewer.cased.block === other.block && viewer.cased.t >= t - 2 && viewer.cased.seen[other.id]) return viewer.cased.seen[other.id].cash;
  const tip = state.tips.find(x => x.type === 'cash' && x.subject === other.id && x.holders.includes(viewer.id) && x.expires > t && !x.spent);
  return tip ? tip.data.cash : null;
}

function person(cfg, state, viewer, other, t) {
  const exact = exactCash(cfg, state, viewer, other, t);
  return {
    id: other.id, name: other.name, cls: other.cls,
    skills: Object.fromEntries(Object.entries(other.skills).filter(([, v]) => v > 0)),
    cash: exact !== null ? exact : cashBracket(other.cash),
    armed: bestGun(other) > 0,
    heat: other.heat,
    ...(other.crew ? { crew: state.crews[other.crew].name } : {}),
  };
}

/** Build the view for one agent at hour `ctx.t`, before anyone moves. */
export function buildView(ctx, agent) {
  const { cfg, map, state, t } = ctx;
  const H = cfg.season.hoursPerDay;
  const day = dayOf(cfg, t);
  const h = hourOfDay(cfg, t);
  const home = theBlock(map, 'pads');
  const free = isFree(agent);
  const box = state.inbox[agent.id];
  const name = id => state.agents[id]?.name ?? state.npcs[id]?.name ?? id;

  const view = {
    you: {
      id: agent.id, name: agent.name, cls: agent.cls, persona: agent.persona,
      cash: agent.cash, stash: agent.stash, goods: agent.goods, heat: agent.heat,
      state: agent.state, ...(free ? {} : { freeAtHour: agent.until, hoursLeft: Math.max(0, agent.until - t) }),
      block: free ? agent.block : agent.state, home: free && agent.block === home,
      skills: agent.skills, xp: agent.xp, points: agent.points,
      worth: netWorth(state, agent), clinicDebt: agent.clinicDebt,
      lean: agent.lean, variant: agent.variant,
    },
    clock: {
      t, day, hour: cfg.season.firstHour + h, hoursLeftToday: H - h, daysLeft: cfg.season.days - day,
      lastCall: day >= cfg.season.lastCallDay, rentTonight: day < cfg.season.days ? rentOn(cfg, day) : 0,
    },
    note: agent.note,
    forecast: {
      police: policeAhead(cfg, state, t, agent.cls === 'dealer' && level(agent, 'streetSense') > 0 ? cfg.police.streetSenseHours : state.tips.some(x => x.type === 'route' && x.holders.includes(agent.id) && x.expires > t) ? H : cfg.police.seeHours),
      robbers: { who: NPC_ROBBERS_NAME, fromHour: cfg.season.firstHour + state.forecast.robbers.fromHour, blocks: state.forecast.robbers.blocks },
      rival: state.forecast.rival ? { who: RIVAL_CREW_NAME, hour: cfg.season.firstHour + state.forecast.rival.hour, block: state.forecast.rival.block, toll: cfg.rivalCrew.toll } : null,
      early: state.early.some(e => e.t === t) ? `${NPC_ROBBERS_NAME} are out early: this hour they come for whoever carries the most cash` : null,
    },
    pickups: pickupsOf(ctx, agent).map(p => ({ ...p, withName: name(p.with) })),
    robbed: lootOut(state, agent, t).map(l => ({ ...l, robberName: name(l.robber) })),
    here: null,
    cast: state.order.filter(id => id !== agent.id).map(id => {
      const other = state.agents[id];
      const seen = state.seen[agent.id][id];
      return { id, name: other.name, cls: other.cls, ...(other.crew ? { crew: state.crews[other.crew].name } : {}), ...(other.local && other.agenda ? { local: true, known: other.agenda } : {}), lastSeen: seen ? { block: seen.block, hoursAgo: t - seen.t } : null };
    }),
    race: state.standings,
    offers: offersFor(state, agent, t).map(o => ({ id: o.id, from: o.from, board: o.to === 'anyone', kind: o.terms.kind, text: offerText(cfg, state, o, agent.id), terms: o.terms, hoursLeft: o.expires === null ? null : o.expires - t })),
    yourOffers: state.offers.filter(o => o.from === agent.id && o.status === 'open').map(o => ({ id: o.id, to: o.to, kind: o.terms.kind, text: offerText(cfg, state, o, agent.id), terms: o.terms })),
    duties: (() => {
      const d = dutiesOf(state, agent);
      return {
        contracts: d.contracts.map(c => ({ id: c.id, muscle: c.muscle, client: c.client, hoursLeft: c.until - t, price: c.price })),
        jobs: d.jobs.map(j => ({ id: j.id, poster: j.poster, worker: j.worker, task: taskText(state, j.task, j.poster), type: j.task.type, target: j.task.agent ?? null, pay: j.pay, hoursLeft: j.expires - t })),
        loans: d.loans.map(l => ({ id: l.id, lender: l.lender, borrower: l.borrower, owed: l.owed, due: l.due, overdue: l.status === 'overdue' })),
      };
    })(),
    crew: crewView(state, agent),
    grudges: agent.grudges.map(g => ({ against: g.against, name: name(g.against), why: g.why, hoursAgo: t - g.t })),
    trust: Object.fromEntries(Object.entries(state.trust[agent.id]).map(([id, e]) => [id, { score: e.score, why: e.reasons.slice(-2).map(r => r.why) }])),
    tips: tipsHeld(state, agent, t).map(tip => ({ id: tip.id, type: tip.type, subject: tip.subject, text: tipText(state, tip, cfg), hoursLeft: tip.expires - t, yours: tip.madeBy === agent.id })),
    memory: { confessionals: agent.confessionals.slice(-6).map(c => c.text), journals: agent.journals.slice(-2) },
    messages: box.messages.slice(-8).map(m => ({ hoursAgo: t - m.t, from: m.from, to: m.to, text: m.text })),
    heard: box.heard.filter(x => x.t === t - 1).map(x => ({ from: x.from, text: x.text, ...(x.to ? { to: x.to } : {}) })),
    happened: box.happened.filter(x => x.t >= t - 3).map(x => ({ hoursAgo: t - x.t, text: x.text })),
    menu: [],
  };

  if (free) {
    const b = map.blocks[agent.block];
    const here = state.blocks[agent.block];
    view.here = {
      block: agent.block,
      police: policeOn(state, agent.block),
      buyers: b.buyers ? { open: buyersOpen(cfg, map, agent.block, t), demandPct: Math.round(here.demand / 10), turf: here.turf === 'rival' ? RIVAL_CREW_NAME : here.turf } : null,
      others: agentsOn(state, agent.block).filter(a => a.id !== agent.id).map(a => person(cfg, state, agent, a, t)),
    };
    // Read 3: a robber also sees who is on the blocks next door
    if (agent.cls === 'robber' && level(agent, 'read') >= 3) {
      view.nextDoor = Object.fromEntries(b.links.map(link => [link, agentsOn(state, link).map(a => person(cfg, state, agent, a, t))]));
    }
  }
  view.menu = buildMenu(ctx, agent);
  return view;
}
