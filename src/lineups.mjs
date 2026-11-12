// Lineups (SPEC section 5): who sits in the ten seats.
//   default            ten bots, for tuning
//   cautious           ten bots that play the way mini's AI seats did
//   turtle:<seat>      default, with one seat a turtle        (seat is a class name, or class#2 for its second seat)
//   grind:<seat>       default, with one seat on its class's safe grind
//   dead:<seat>        default, with one seat that does nothing all season
//   ai5, ai10          AI seats; the models come from --seat-models
//   small:<seat>,<seat>  a small lobby: those seats are owners' agents, scripted locals fill the rest

import { CONFIG } from './config.mjs';

/** The seat index a spec like "dealer" or "robber#2" names. */
export function seatIndex(cfg, spec) {
  const [cls, nth] = spec.split('#');
  const matches = cfg.seats.map((c, i) => [c, i]).filter(([c]) => c === cls).map(([, i]) => i);
  const index = matches[(Number(nth) || 1) - 1];
  if (index === undefined) throw new Error(`no such seat: ${spec}`);
  return index;
}

/** Which seats are AI in the ai5 lineup: one dealer, the cook, one robber, the muscle and the informant. */
const AI5 = ['dealer', 'cook', 'robber', 'muscle', 'informant'];

export function buildLineup(name = 'default', cfg = CONFIG) {
  const seats = cfg.seats.map(cls => ({ cls, kind: 'bot' }));
  if (name === 'default') return seats;
  if (name === 'cautious') return seats.map(s => ({ ...s, variant: 'cautious', lean: 'careful' }));
  if (name === 'ai10') return seats.map(s => ({ ...s, kind: 'ai' }));
  if (name === 'ai5') {
    for (const cls of AI5) seats[seatIndex(cfg, cls)].kind = 'ai';
    return seats;
  }
  // a small lobby: the named seats are owners' agents and scripted locals fill the rest ("small:dealer,robber")
  if (name.startsWith('small:')) {
    for (const spec of name.slice(6).split(',')) Object.assign(seats[seatIndex(cfg, spec.trim())], { kind: 'ai', player: true });
    return seats;
  }
  const [variant, spec] = name.split(':');
  if (['turtle', 'grind', 'dead'].includes(variant) && spec) {
    seats[seatIndex(cfg, spec)].variant = variant;
    if (variant !== 'dead') seats[seatIndex(cfg, spec)].lean = 'careful';
    return seats;
  }
  throw new Error(`no such lineup: ${name}`);
}

/** Every seat spec, for the lineups that are run once per seat: "smuggler", "smuggler#2", "cook"... */
export function seatSpecs(cfg = CONFIG) {
  const seen = {};
  return cfg.seats.map(cls => {
    seen[cls] = (seen[cls] ?? 0) + 1;
    return seen[cls] === 1 ? cls : `${cls}#${seen[cls]}`;
  });
}

/** One seat spec per class, for the lineups that are run once per class. */
export function classSpecs(cfg = CONFIG) {
  return [...new Set(cfg.seats)];
}
