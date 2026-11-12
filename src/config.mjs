// Every number in the game (SPEC sections 4 to 12). They are starting points: PAYTABLE.md shows what each class earns
// an hour at these numbers (scripts/paytable.mjs), and the free bot runs tune them (TUNING.md).
// Money is whole dollars everywhere. Rates are whole percents or per-mille, so no rounding error ever decides a dollar.

export const CONFIG = Object.freeze({
  season: {
    days: 5,
    hoursPerDay: 12, // 12:00 to 23:00
    firstHour: 12,
    lastCallDay: 5,
    lastCallPricePct: 100, // street prices on day 5 before 21:00: no lift, so one day can't outweigh four
    lastCallLatePct: 125, // from 21:00 on day 5
    lastCallLateFrom: 9, // hour of the day (0 = 12:00), so 9 = 21:00
    lastCallTroublePct: 100,
    lastDueHourOfDay5: 9, // nothing falls due after 21:00 on day 5
  },

  // Everyone starts with $100 and 2 points. The chain classes also start with a little stock, so the first sale
  // happens in the first hours instead of the first evening (TUNING.md).
  start: {
    cash: 100, stash: 0, points: 2,
    kit: { smuggler: { chems: 6 }, cook: { chems: 6 }, dealer: { product: { 2: 4 } }, gunrunner: { parts: 6 }, robber: { guns: { 1: 1 } } },
  },

  // 10 seats. The lone cook is the chain's bottleneck.
  seats: ['smuggler', 'smuggler', 'cook', 'dealer', 'dealer', 'gunrunner', 'robber', 'robber', 'muscle', 'informant'],

  docks: {
    chems: { price: 10, stock: 48 },
    parts: { price: 14, stock: 24 },
    // ready-made low-grade product (quality 1): dear and poor next to the cook's, so it only matters when the cook is out
    product: { price: 12, stock: 32 },
    stepUnits: 8, // the price rises after every 8 units bought that day
    stepPct: 10,
    unitsPerRun: 1, // plus Haul
    tab: 150, // the supplier fronts a smuggler this much; it comes out of the smuggler's next income first
    barterPct: 5, // per Barter level, off the docks price
    bustPct: 25, // when police are on the docks
    bustPerSneak: 4,
    bustPerStealth: 3,
  },

  cook: {
    chemsPerBatch: 3,
    unitsPerBatch: 6, // +1 at Yield 2, +2 at Yield 4
    maxQuality: 5,
    blowUpPct: 6,
    blowUpPerSteady: 2,
    blowUpClinicHours: 1,
    blowUpHeat: 1,
  },

  street: {
    // base price of one unit of product, before quality and demand
    price: { corner: 36, bar: 44, park: 50, uptown: 60 },
    qualityBasePct: 60, // price × (60 + 20 × quality)%: q1 ×0.8, q3 ×1.2, q5 ×1.6
    qualityStepPct: 20,
    demandDropPct: 93, // demand after each unit sold
    demandRecoverPct: 105, // demand each hour, back up to full
    unitsPerHour: 2, // plus Hustle
    sharedBlockPct: 80, // two dealers on one block
    turfOtherPct: 50, // a dealer on someone else's turf
    turfHolderPct: 120, // the holder's own price on its turf: holding a corner has to pay, or nobody fights for one
    regularsPerBlock: 6,
    angryPct: 30, // each q1 unit sold
    angryWithinHours: 3,
    angryStrength: 50,
    angryClinicHours: 1,
    angryCashPct: 20,
    policeHeat: 1, // each hour of dealing with police on the block
  },

  guns: {
    partsPerGun: 3,
    maxQuality: 3,
    attack: 15, // plus 5 per quality above 1
    attackPerQuality: 5,
    defence: 10,
    streetPrice: 140, // × quality
    clientelePct: 10,
    stingPct: 20,
    stingHours: 1, // a sting costs the gun and an hour in a cell, not a full arrest: the street has to be worth the risk
    stingPerConnections: 5,
    phoneSalesAtConnections: 3,
  },

  fence: {
    buys: { chems: 7, parts: 10, product: 4, gun: 50 }, // product and guns × quality
    sells: { chems: 46, parts: 30, product: 40 }, // product is quality 1 only
    productPerDay: 20, // q1 units the fence has to sell each day, shared
    barterPct: 5, // per Barter level, on what the fence pays a smuggler
  },

  gunshop: { price: 220, quality: 1 },
  // The loan shark, at the fence's counter: a way back for someone who is flat broke. One stake at a time, and every
  // dollar earned goes to paying it back first.
  shark: { max: 100, repayPct: 125, onlyUnder: 60 },

  floors: {
    crimeTip: 70, // what the police pay for a crime, once
    networkPct: 20, // per Network level
    networkPhoneAt: 2,
    patrolPay: 4, // a patrolling muscle, per hour, on a block with a shopkeeper
  },

  rent: { first: 25, step: 10, evictStashPct: 30, evictSavePerStealth: 15 },
  // Every night the NPC robbers go for the fattest stash in the city: a stash is never immune, and neither is a lead.
  nightJob: { minStash: 200, strength: 55, perDay: 3, cleanStashPct: 20, messyStashPct: 10, savePerStealth: 5 },
  clinic: { perHour: 15 },
  bail: { base: 40, perStar: 20 },

  deals: {
    offerHours: 3,
    pickupHours: 6,
    courierPct: 25,
    courierMin: 5,
    listingsPerAgent: 3,
    acceptsPerTurn: 3,
    tipMaxPrice: 100,
    jobHours: 6,
    bigDeal: 60, // a deal this size is a big beat
    xpDealMin: 20,
  },

  contest: {
    base: 50,
    min: 10,
    max: 90,
    band: 20, // clean below P − 20, fail up to P + 20
    aimArmed: 5,
    aimUnarmed: 2,
    toughness: 5,
    ambush: 5,
    stealth: 5, // in a break-in with the owner out: the robber's Stealth against the owner's
    turf: 8,
    collect: 10,
    bodyguard: 6,
    bodyguardToughness: 3,
    hiredGuardToughness: 3, // anyone on a guard job who isn't a muscle
    crewBackup: 5,
    tip: 15,
  },

  rob: {
    cleanCashPct: 60,
    messyCashPct: 30,
    heat: 2,
    failHeat: 1,
    cleanTargetClinic: 1,
    messyClinic: 1,
    failClinic: 1,
    disasterClinic: 2,
    getawayPct: 10, // per Getaway level, a disaster doesn't end in an arrest
    recoverHours: 6,
  },
  breakIn: { cleanStashPct: 45, messyStashPct: 22 },
  fight: { loserClinic: 2, messyClinic: 1, failClinic: 2, disasterClinic: 3, disasterHeat: 2 },
  collectFeePct: 20,

  heat: { max: 5, arrestAt: 3, nightDrop: 1, restDrop: 2 },
  arrest: { baseHours: 2, perStarAbove: 1, finePct: 20 },

  police: { units: 2, seeHours: 3, streetSenseHours: 6, routeTipHours: 6, uptownUntil: 6 },
  npcRobbers: { fromHour: 8, strength: 55, perDay: 3, twoBlocksFromDay: 3, intimidatePct: 15, cleanCashPct: 30, messyCashPct: 15, hitsPerNight: 2 },
  rivalCrew: { fromDay: 2, toll: 30, strength: 50, perDay: 4 },
  snitch: { price: 20, heat: 2 },
  // A seat whose model fails this many hours in a row is played by its class's bot until the model answers again.
  takeover: { afterHours: 3 },
  // The house bounty: each noon from this day on, the rival crew puts a price on the leader's head. Anyone can take it.
  houseBounty: { fromDay: 2, pay: 75 },
  // A small lobby: a few owners' agents among scripted locals. When choices are close, a local leans toward a player
  // as its partner or its target, because bot-on-bot business is noise to a viewer. Locals never pile on: they leave
  // alone anyone hit in the last hours, and the bottom of the standings.
  lobby: { spotlightPct: 20, breatherHours: 2, spareBottom: 2 },
  quietHours: 2, // after this many hours with no big beat, trouble comes early
  quietFromHour: 2, // but not in the season's first hours, while everyone is still setting up
  quietMinCash: 40, // and only when some block has this much cash on it to come for

  skills: { max: 5, stealthHeatAt: [2, 4], stealthRobberPct: 10 },
  xp: { perPoint: 2, risksPerDay: 2, dealsPerDay: 2, hungrySeats: 3, hungryPoints: 1 },

  tips: { cashHours: 3, coverBasePct: 40, coverPct: 15, eyesAt: [1, 3, 5] },

  crews: { maxMembers: 4, maxCutPct: 30, backup: 5, skimExtraPct: 50 },

  trust: { min: -5, max: 5 },

  // Usual prices between players: what bots ask, and the anchor a menu shows. Players can agree anything.
  usual: {
    chems: 33,
    parts: 24,
    product: 11, // per unit, plus productPerQuality × quality: q1 $14, q3 $20, q5 $26
    importProduct: 18, // a smuggler's price for ready-made quality 1 product
    creditPct: 20, // what bots add to a price when they ask to pay later: the seller is carrying the street's risk
    productPerQuality: 3,
    gun: 160, // × quality
    protectPerHour: 28,
    cashTip: 55,
    routeTip: 25,
    crimeTip: 85,
  },
});

/** A copy of the config with some numbers replaced, for tuning runs and tests: `withConfig({ rent: { first: 30 } })`. */
export function withConfig(overrides, base = CONFIG) {
  const out = {};
  for (const key of new Set([...Object.keys(base), ...Object.keys(overrides ?? {})])) {
    const a = base[key];
    const b = overrides?.[key];
    if (b === undefined) out[key] = a;
    else if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      out[key] = withConfig(b, a);
    } else out[key] = b;
  }
  return Object.freeze(out);
}
