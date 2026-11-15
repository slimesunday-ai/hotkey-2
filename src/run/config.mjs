// The run (RUN.md): every number. Starting points from RUN.md's lower half, tuned against the marks
// (scripts/run-marks.mjs). The rules that read them are in rules.mjs; nothing else holds a number.
//
// A PLACE IS DATA (RUN.md, "Adding a place"): everything a place needs is in its own entry under `places`: its danger
// tier, its jobs and their pay, odds and costs, its people by role, what can be used up there (strangers worth robbing,
// bins worth digging, a regular's custom), what its shop sells, and its links to other places. No rule names a place.
// `jobs` and `people` at the top are copies of the places' own, kept for readers that look them up by place.

import { CONFIG, withConfig } from '../config.mjs';

const RAW = {
  start: { cash: 20, hour: 12, place: 'crib' }, // you wake at the crib with $20 banked; a day's clock starts at noon

  energy: {
    mattress: 6,
    bed: 10,
    perHour: 1, // every hour out, the subway included
    tiredAt: 2, // energy this or less before acting is tired
    tiredOdds: 15, // a tired hour's odds drop this many points (a sure job stays sure)
    tiredJump: 10, // and whoever jumps you is this much stronger
    rideBack: 1, // riding away from home needs this much more than the ride: enough to get back
    clinicMorning: 3, // the morning after the clinic starts this much lower
    jailMorning: 2, // after jail
    roughMorning: 3, // after a night on the street
    minMorning: 1, // and never below this
  },

  // Your own heat (0 to max) follows you: a job's heat, the turnstile seen, a night in jail. It drops nightDrop each
  // night at home. A place's heat (0 to max) is what was done there: a job's heat, and robbing somebody passing,
  // which heats only the place (nobody knows you did it). It drops by its tier's `cool` every night. The heat on you
  // where you stand is the higher of the two. A place at hotAt or more is hot: the police are about there.
  heat: { max: 5, nightDrop: 1, afterJail: 1, hotAt: 3 },

  // where the police are about, heat here `from` or more: each hour has (heat here − from + 1) × perHeat percent
  // chance of a stop, times the tier's `police`
  police: { from: 3, perHeat: 20 }, // RUN.md started at 15; 20 keeps heat-blind play the worst with the pocket and cutter (mark 4)

  subway: { fare: 2, hopCaughtPct: 25, hopHeat: 1, hours: 1 },

  // each hour at a place with jumpers, the leaving hour included (not the arriving one):
  //   (basePct + perHourPct × hours already spent there this trip + perStepPct for every perDollars carried) × the
  //   tier's `jump`, at most capPct; then the contest roll (src/contest.mjs) at their strength plus the tier's, less
  //   the box cutter, plus tired.
  jump: {
    basePct: 4,
    perHourPct: 4,
    perDollars: 10, // RUN.md started at $20; $10 makes the go-home amount a real call on the mattress (mark 7)
    perStepPct: 1,
    capPct: 45,
    strength: 55,
    cutter: 15,
    takePct: { clean: 100, messy: 50 }, // their clean win takes it all (and the clinic), their messy win half
    pocketFinds: 50, // with the inside pocket they find only this percent of what they would have taken
  },

  // THE DANGER TIERS. A place is tuned by choosing one. pay: × every pay there (its jobs' `base`, a stranger's
  // wallet, a find in the bins). jump: × the jumping chances (0: nobody jumps you there). strength: + whoever jumps
  // you. patrol: the police are about whatever the place's heat (false: only once the place is hot). police: × the
  // stop chance. cool: the place's heat lost each night. roughPct: the chance a night on the street there gets you
  // robbed. robHeat: [win, fail], what robbing somebody passing heats the place (else the street's own): a crowd at the
  // market notices less than the quiet trailer park, where one robbery is news (mark 10, RUN.md).
  tiers: {
    quiet: { pay: 1, jump: 0, strength: 0, patrol: false, police: 1, cool: 2, roughPct: 25 },
    rough: { pay: 2, jump: 1, strength: 0, patrol: true, police: 1, cool: 2, roughPct: 60, robHeat: [1, 2] },
    mean: { pay: 3, jump: 1.5, strength: 10, patrol: true, police: 1.25, cool: 2, roughPct: 80 },
  },

  // THE STREET: what any place offers when its entry has the supply for it. Pay is in base dollars, × the tier's pay.
  street: {
    // robbing somebody passing: needs the box cutter and a stranger worth robbing (the place's `strangers`); no person
    // remembers it, but the place heats up sharply, and the hotter it is the fewer are worth trying (odds − perHeat
    // for each heat the place has)
    rob: { label: 'Rob somebody passing', needs: 'cutter', odds: 70, perHeat: 10, base: [25, 40], winHeat: 2, failHeat: 3, draws: 'strangers' },
    // digging through the bins: an hour and an energy, usually nothing or a few dollars, rarely a real find
    bins: { label: 'Dig through the bins', draws: 'bins', finds: [{ pct: 50, base: [0, 0] }, { pct: 45, base: [1, 4] }, { pct: 5, base: [12, 20] }] },
  },

  // A night on the street: the day ends where you are; the tier's roughPct that they rob you in your sleep, at their
  // strength plus this (you are asleep), less the box cutter; the next day starts there, roughMorning lower.
  rough: { strength: 20 },

  // A REGULAR (a person with `regular: true`): an easy sale who keeps count, and pays payUp more for every sale they
  // have had (at most payUpMax more): selling to them stays tempting. From doorAt sales on, each morning at home
  // has doorPct + perSale for every sale past doorAt (at most capPct) that they turn up at your door wanting `wants`,
  // wantsUp more for every sale past doorAt.
  // Give it (from banked): their count drops by giveEases and they go, friendly. Refuse (or walk out past them): they
  // swing at you on fightPct, at their strength less the box cutter, and a win of theirs costs you energy today
  // (`hurt`); otherwise they hold a grudge: not dealt for grudgeDays, and the police come round where they live
  // (grudgeHeat on that place). Refused either way, their count drops by refuseEases: they will be back. (Measured,
  // RUN.md: giving is the better answer on average, refusing a gamble that is sometimes free.)
  regulars: { payUp: 3, payUpMax: 12, doorAt: 3, doorPct: 40, perSale: 20, capPct: 90, wants: [6, 12], wantsUp: 5, giveEases: 1, refuseEases: 1, fightPct: 60, strength: 55, hurt: { clean: 4, messy: 2 }, grudgeDays: 2, grudgeHeat: 2 },

  // a person's mood: the word the view shows, and how the event says it. Everyone wakes calm.
  moods: {
    calm: 'is calm', // not dealt with today
    friendly: 'is friendly', // you worked for them, or they bought from you
    sour: 'is sour', // they paid up, or you took it off them to their face
    wary: 'is wary of you', // you tried and it went wrong
    unaware: 'does not know yet', // a lift that worked
    cold: 'thinks less of you', // saw you in the bins: skips their turn at the safe job today while anyone else is left
  },
  rotaSkips: ['cold'], // (kept with trust: a neighbour who saw you in the bins still skips today's turn; the lasting part is their trust)

  // TRUST (RUN.md, "Trust"): one number per person, kept across nights, from min to max; everyone starts at 0 (and an
  // older saved state reads as everyone at 0). Three bands: `against` or less is against you, `with` or more is with
  // you, between is neutral.
  //   Against you: off your table (never dealt to you, as a job's person or its target) while it lasts; and when you do
  //     a crime at their place (a job that can heat it, whichever way it went; robbing somebody passing), or dig its
  //     bins, each of them who is about there this hour has tellPct to see it and call it in (tellHeat on that place,
  //     the per-place heat of rules-2). One roll for all of them.
  //   With you: they see nothing (in the bins they look away), and a job done for or with them pays withPay more
  //     (base dollars, × the tier's pay).
  //   It moves: a job's own `trust` ({ win, fail }, on each job below); seen in the bins (seenBins); giving at your door
  //     (give); refusing them there (refuse: from neutral that is the bottom, the old grudge: off the table 2 days, and
  //     the police on their place). Each morning it moves `drift` back toward 0, so nothing is permanent: below 0
  //     every morning (days off the table count it), above 0 only after a day you did not deal with them (good will
  //     holds while you keep it up). A person is about at their place on aroundPct of hours (seeded, shown in the view).
  // Tuned against marks 13 and 14 (RUN.md): aroundPct was 50 and tellPct 40.
  trust: {
    min: -3, max: 3, against: -2, with: 2, drift: 1, aroundPct: 60, tellPct: 50, tellHeat: 2, withPay: 2,
    seenBins: -1, give: 1, refuse: -4,
    bands: { against: 'against you', neutral: 'neutral', with: 'with you' },
    // why a job moved someone's trust, by the mood it left them in (the event's words)
    why: { friendly: 'you worked for them, or they bought from you', sour: 'you took it off them to their face', wary: 'you tried it on them and it went wrong', unaware: 'they do not know yet' },
  },

  shop: {
    pocket: { label: 'An inside pocket', price: 40, does: 'Whoever jumps you finds only half' },
    cutter: { label: 'A box cutter', price: 90, does: 'You are harder to jump, and stick-ups appear among your options' },
    bed: { label: 'A real bed', price: 150, does: 'Energy 10 a day instead of 6' },
  },

  // THE PLACES. home: your crib (bank, buy, sleep); inside: the place its door opens onto. door: the crib you can go
  // into from here. held: where a day can end against your will. Every place you can work has a tier, jobs, people,
  // supply, shop and links. A job: odds in percent; base pay a whole-dollar range (× the tier's pay); heat and energy
  // changes on win or fail (the heat goes to the place); done to or with one person of its `role`: `named` is its
  // label with them in it, `mood` what they feel after it, `with` who the stage shows it done for, `scene` how it
  // plays (RUN.md, "What it reuses"; `later` is the clip it moves to once the city is re-pinned). The `safe` job is
  // always dealt first; two of the rest are drawn by the seeded dice from what you are able to do and who is left.
  // supply: what the player's actions draw down there and the morning refills, `refill` a morning up to `max`; it is
  // the place's, not the player's, so players sharing a city would draw on the same.
  places: {
    crib: { label: 'your crib', block: 'projects', spot: 'pad', home: true, inside: 'park' },
    park: {
      label: 'the trailer park', where: 'in the trailer park', block: 'projects', spot: 'street', tier: 'quiet', door: 'crib',
      onlySafe: 'only odd jobs',
      links: { market: { via: 'subway' }, corner: { via: 'subway' } },
      supply: { strangers: { max: 2, refill: 1 }, bins: { max: 3, refill: 2 }, custom: { max: 2, refill: 1 } },
      binsSeen: { role: 'neighbour', pct: 35, mood: 'cold' }, // a neighbour who sees you in the bins thinks less of you
      shop: [],
      jobs: {
        odd: { label: 'An odd job for a neighbour', named: 'An odd job for {who}', role: 'neighbour', with: 'a neighbour', safe: true, odds: 100, base: [6, 10], mood: { win: 'friendly' }, trust: { win: 1 }, scene: { win: { action: 'carry' } } },
        loosies: { label: 'Sell loose cigarettes at the bus stop', named: 'Sell loose cigarettes to {who} at the bus stop', role: 'buyer', with: 'the bus stop', odds: 85, base: [5, 14], mood: { win: 'friendly', fail: 'wary' }, trust: { win: 1, fail: 0 }, scene: { win: { kind: 'work:deal' }, fail: { kind: 'work:deal:dry' } } },
        wallet: { label: 'Lift a wallet at the bus stop', named: 'Lift a wallet off {who}', role: 'mark', with: 'a mark', odds: 60, base: [18, 30], failHeat: 1, mood: { win: 'unaware', fail: 'wary' }, trust: { win: 0, fail: -2 }, scene: { win: { action: 'hand_off', later: 'pickpocket_dip' }, fail: { action: 'hand_off', later: 'pickpocket_dip' } } },
        collect: { label: 'Collect a debt for the park manager', named: 'Collect a debt from {who} for the park manager', role: 'debtor', with: 'the park manager', odds: 70, base: [14, 22], failEnergy: 2, mood: { win: 'sour', fail: 'wary' }, trust: { win: -1, fail: -2 }, scene: { win: { kind: 'collect:win' }, fail: { kind: 'collect:lose' } } },
      },
      // the page's locals (demo/run/scenes.js) where a role matches, and more people in the same id pattern. Four to
      // work, so a day here runs dry and sends you to the market (RUN.md, "People").
      people: [
        { id: 'npc:neighbour', name: 'Mrs. Alvarez', role: 'neighbour' },
        { id: 'npc:neighbour:2', name: 'Mr. Pruitt', role: 'neighbour' },
        { id: 'npc:neighbour:3', name: 'Gloria', role: 'neighbour' },
        { id: 'npc:buyer:projects:1', name: 'Shaky Dee', role: 'buyer', regular: true },
        { id: 'npc:mark:projects', name: 'a man at the bus stop', role: 'mark' },
        { id: 'npc:mark:projects:2', name: 'a woman at the bus stop', role: 'mark' },
        { id: 'npc:debtor', name: 'Benny Two-Coats', role: 'debtor' },
      ],
    },
    market: {
      label: 'the flea market', where: 'at the flea market', block: 'market', spot: 'street', tier: 'rough',
      onlySafe: 'only the stall',
      links: { park: { via: 'subway' } },
      supply: { strangers: { max: 3, refill: 2 }, bins: { max: 4, refill: 4 } },
      shop: [
        { item: 'drink', label: 'An energy drink', price: 5, does: 'Energy +1: one more hour', perDay: 1, gives: { energy: 1 } },
      ],
      jobs: {
        stall: { label: 'Work a stall for the shopkeeper', named: 'Work a stall for {who}', role: 'shopkeeper', with: 'the shopkeeper', safe: true, odds: 100, base: [11, 15], mood: { win: 'friendly' }, trust: { win: 1 }, scene: { win: { action: 'haggle', spot: 'counter:shop' } } },
        crowd: { label: 'Sell to the crowd', named: 'Sell to {who} in the crowd', role: 'buyer', with: 'the crowd', odds: 75, base: [20, 35], failHeat: 1, mood: { win: 'friendly', fail: 'wary' }, trust: { win: 1, fail: 0 }, scene: { win: { kind: 'work:deal' }, fail: { kind: 'work:deal:dry' } } },
        wallet: { label: 'Lift a wallet in the crowd', named: 'Lift a wallet off {who}', role: 'mark', with: 'a mark', odds: 55, base: [30, 50], failHeat: 1, mood: { win: 'unaware', fail: 'wary' }, trust: { win: 0, fail: -2 }, scene: { win: { action: 'hand_off', later: 'pickpocket_dip' }, fail: { action: 'hand_off', later: 'pickpocket_dip' } } },
        till: { label: 'Grab a till', named: "Grab {who}'s till", role: 'stallholder', with: 'the shopkeeper', odds: 40, base: [60, 95], winHeat: 1, failHeat: 2, mood: { win: 'sour', fail: 'wary' }, trust: { win: -3, fail: -2 }, scene: { win: { action: 'grab', spot: 'counter:shop', later: 'till_grab' }, fail: { action: 'grab', spot: 'counter:shop', later: 'till_grab' } } },
        stickup: { label: 'A stick-up behind the stalls', named: 'Stick up {who} behind the stalls', role: 'stallholder', with: 'a stallholder', odds: 60, base: [50, 80], winHeat: 1, failHeat: 2, needs: 'cutter', mood: { win: 'sour', fail: 'wary' }, trust: { win: -3, fail: -2 }, scene: { win: { kind: 'rob:clean' }, fail: { kind: 'rob:fail' } } },
      },
      // seven to work, so it lasts; the third stallholder keeps ignoring heat the worst way to play (RUN.md)
      people: [
        { id: 'npc:shop:market', name: 'Mrs. Bao', role: 'shopkeeper' },
        { id: 'npc:shop:market:2', name: 'Mr. Ferraro', role: 'shopkeeper' },
        { id: 'npc:buyer:market:1', name: 'Lola', role: 'buyer' },
        { id: 'npc:buyer:market:2', name: 'Pockets', role: 'buyer' },
        { id: 'npc:mark:market', name: 'a woman in the crowd', role: 'mark' },
        { id: 'npc:mark:market:2', name: 'a man with a camera', role: 'mark' },
        { id: 'npc:stallholder', name: 'a stallholder', role: 'stallholder' },
        { id: 'npc:stallholder:2', name: 'Mr. Okafor', role: 'stallholder' },
        { id: 'npc:stallholder:3', name: 'Mrs. Kowalski', role: 'stallholder' },
      ],
    },
    corner: { label: 'the corner', block: 'corner', spot: 'street', tier: 'mean', locked: 'held by the Sixes' },
    clinic: { label: 'the clinic', held: 'clinic' },
    jail: { label: 'the jail', held: 'jail' },
  },
  subwayStops: ['park', 'market', 'corner'], // the line as the map shows it; the corner is locked

  // the city's one roll formula and its four bands, unchanged (src/contest.mjs)
  contest: CONFIG.contest,
};

const scale = (range, by) => range.map(x => Math.round(x * by));

/**
 * The config the rules read: each place's jobs with their pay in dollars (base × the tier's pay), and `jobs` and
 * `people` at the top as copies of the places' own. A job given `pay` and no `base` keeps its pay as it is.
 */
function resolve(raw) {
  const places = {};
  for (const [id, p] of Object.entries(raw.places)) {
    const tier = p.tier ? raw.tiers[p.tier] : null;
    if (p.tier && !tier) throw new Error(`place ${id}: no tier ${p.tier}`);
    if (!p.jobs) { places[id] = p; continue; }
    const jobs = Object.fromEntries(Object.entries(p.jobs).map(([jid, j]) => [jid, Object.freeze({ ...j, pay: j.base ? scale(j.base, tier?.pay ?? 1) : j.pay })]));
    places[id] = Object.freeze({ ...p, jobs: Object.freeze(jobs) });
  }
  const worked = Object.keys(places).filter(id => places[id].jobs);
  return Object.freeze({
    ...raw,
    places: Object.freeze(places),
    jobs: Object.freeze(Object.fromEntries(worked.map(id => [id, places[id].jobs]))),
    people: Object.freeze(Object.fromEntries(worked.map(id => [id, places[id].people ?? []]))),
  });
}

export const RUN_CONFIG = resolve(withConfig(RAW, {}));

/**
 * A copy with some numbers replaced, for tuning runs and tests: `withRunConfig({ jump: { perHourPct: 6 } })`, or a
 * place added or changed: `withRunConfig({ places: { docks: {...} } })`. Overrides of `jobs` or `people` by place
 * are folded into the places' own.
 */
export function withRunConfig(overrides, base = RUN_CONFIG) {
  const o = { ...(overrides ?? {}) };
  if (o.jobs || o.people) {
    const places = { ...(o.places ?? {}) };
    for (const [id, jobs] of Object.entries(o.jobs ?? {})) places[id] = { ...(places[id] ?? {}), jobs };
    for (const [id, people] of Object.entries(o.people ?? {})) places[id] = { ...(places[id] ?? {}), people };
    o.places = places;
  }
  delete o.jobs;
  delete o.people;
  return resolve(withConfig(o, base));
}
