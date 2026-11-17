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
    // (routes-1) the ground between two places: paid like the market, but people pass through, so a quarter of the
    // jumping, and the police only once it is hot. The trade against the subway's fare (RUN.md, "Routes": at half the
    // market's jumping a walker carrying the day's cash home lost more than the fare, and every card played on the way
    // home cost more in what was taken than it paid, measured).
    street: { pay: 2, jump: 0.25, strength: 0, patrol: false, police: 1, cool: 2, roughPct: 40 },
  },

  // THE STREET: what any place offers when its entry has the supply for it. Pay is in base dollars, × the tier's pay.
  street: {
    // robbing somebody passing: needs the box cutter and a stranger worth robbing (the place's `strangers`); no person
    // remembers it, but the place heats up sharply, and the hotter it is the fewer are worth trying (odds − perHeat
    // for each heat the place has)
    rob: { label: 'Rob somebody passing', needs: 'cutter', odds: 70, perHeat: 10, base: [25, 40], winHeat: 2, failHeat: 3, draws: 'strangers', pressure: { win: 1, fail: 2 } },
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

  // GOODS (RUN.md, "Goods, the connect and errands"): what a selling job sells. Each good is bought by the pack from the
  // connect of the place it names (`at`): `price` paid up front, good for `sales` sales, at most `perDay` packs a day
  // from that connect. A selling job lists the goods it takes and what each pays there (its `goods`: base pay, × the
  // tier's pay); with none of them on you it is not dealt. A sale uses one, win or lose (one that goes wrong is lost:
  // you ditched it, or they walked off with it). Deeper places carry dearer, better-paying goods.
  goods: {
    // (lib-1: `piece`, `packPiece`: the game's own props for them, demo/stage/props/goods.js: a pack, sold loose; a carton)
    smokes: { label: 'loose cigarettes', pack: 'a carton of cigarettes', piece: 'prop:smokes-pack', packPiece: 'prop:smokes-carton', at: 'park', price: 10, sales: 5, perDay: 2 },
    discs: { label: 'bootleg films on disc', pack: 'a stack of bootleg discs', at: 'market', price: 26, sales: 4, perDay: 2 },
  },
  // THE CONNECT: a person of the place (its entry's `connect`) who sells the place's good. Against you, they will not
  // sell; with you, a pack costs withOffPct percent less. Buying from them is dealing with them (trust `buy`). Goods
  // on you are at risk like cash on you: worth their price a sale, they count towards being jumped (jump.perDollars)
  // and a jump takes them as it takes cash (all, or half; the inside pocket hides cash, not goods). A police stop
  // takes every good on you, your heat after jail is stopHeat higher, and each connect whose goods they took is
  // `pinched` (trust): against you, they will not sell to you tomorrow. Goods left at the crib are safe.
  connect: { withOffPct: 20, buy: 1, pinched: -3, stopHeat: 1 },

  // THINGS: a few things to wear and a few for the trailer, cosmetic only (no number changes), owned for the run like
  // the bed. Each is sold at one place (`at`), at a spot there (`spot`), by a person of that place (`keeper`). Things
  // to wear have a slot and are put on or taken off at the crib for nothing (bought with the slot free, put on at
  // once). Things for the trailer have the spot in the trailer they sit at (`inTrailer`). The corner's are listed for
  // later: the corner is locked, so they cannot be bought yet.
  // (lib-1) `piece`: what the game draws for it, a piece of the city's library ('<cast slot>:<id>' of the cast,
  // 'kit:<id>' of the home kit, 'held:<id>' a cast piece held in the hand, 'prop:<id>' one of the game's own props,
  // demo/stage/props/), and the thing is sold under that piece's own name with a description that matches it. The
  // keys stay what they were (saves and the auto-players name things by key). The chains are gone: no piece of the
  // cast is a chain at the neck. The neck slot went with them.
  things: {
    visor: { label: 'a Lucky 7 Dad Cap', kind: 'wear', slot: 'head', piece: 'hat:lucky7_dad', desc: 'washed bodega merch, a casino seven on a soft cap, curved bill, low and soft', price: 6, at: 'market', keeper: 'npc:stallholder:3', spot: 'clothes-rail' },
    bowling: { label: 'a Neon Row Silk shirt', kind: 'wear', slot: 'top', piece: 'top:neon_row_silk', desc: 'black silk camp shirt, dice and diamonds all over, short sleeves, open at the neck', price: 12, at: 'market', keeper: 'npc:stallholder:3', spot: 'clothes-rail' },
    hightops: { label: 'a pair of Tagged Customs', kind: 'wear', slot: 'feet', piece: 'shoes:tagged_customs', desc: 'white canvas high-tops a writer from Neon Row went over in pink, lime and cyan', price: 25, at: 'market', keeper: 'npc:stallholder:3', spot: 'clothes-rail' },
    lavalamp: { label: 'a lava lamp', kind: 'home', piece: 'kit:lava-lamp', desc: 'a lamp of coloured wax rising and falling in a glass', price: 8, at: 'park', keeper: 'npc:neighbour:2', spot: 'yard-sale', inTrailer: 'by-the-mattress' },
    boxfan: { label: 'a box fan', kind: 'home', piece: 'kit:box-fan', desc: 'a square fan, one speed, loud', price: 10, at: 'park', keeper: 'npc:neighbour:2', spot: 'yard-sale', inTrailer: 'window' },
    beanbag: { label: 'a beanbag', kind: 'home', piece: 'kit:beanbag', desc: 'cracked vinyl, leaks a little', price: 20, at: 'park', keeper: 'npc:neighbour:2', spot: 'yard-sale', inTrailer: 'floor' },
    fishtank: { label: 'a fish tank', kind: 'home', piece: 'kit:fish-tank', desc: 'a lit tank on a black stand, a few fish', price: 30, at: 'park', keeper: 'npc:neighbour:2', spot: 'yard-sale', inTrailer: 'counter' },
    overcoat: { label: 'a trench coat', kind: 'wear', slot: 'top', piece: 'top:npc_top_trench', desc: 'a beige trench, belted, collar up against the bay wind', price: 140, at: 'corner', keeper: null, spot: null },
    recliner: { label: 'a Puffer chair', kind: 'home', piece: 'kit:chair-puffer', desc: 'a quilted designer armchair, puffed like a jacket', price: 160, at: 'corner', keeper: null, spot: null, inTrailer: 'floor' },
    homebar: { label: 'a home bar', kind: 'home', piece: 'kit:bar-home', desc: 'a bar counter with bottles on the shelf behind it', price: 300, at: 'corner', keeper: null, spot: null, inTrailer: 'floor' },
    // (routes-1) the one thing with a use: a ride (`kind: 'ride'`, its `way` one of `ways` below). Owned for the run
    // like the rest, bought on the street; not one of the three things of the run's goal.
    board: { label: 'a skateboard', kind: 'ride', way: 'board', piece: 'board:pink', desc: 'a scuffed deck on new wheels', price: 100, at: 'market', keeper: 'npc:stallholder:2', spot: 'stall:6',
      does: 'Faster and less energy than walking: a way on foot in one hour and no energy (you need 1 to push off), and nobody catches you between the stops' },
    // (home-1) the two things for the trailer that DO something: `defends` changes how an attempt on your crib goes
    // (config `raid`). `pct`: the chance it works with nobody home and nobody on the step, instead of raid.pct. `share`:
    // the share of what is banked a success takes, instead of raid.share. Bought on the street like the rest; they
    // stand in the trailer at `inTrailer`.
    deadbolt: { label: 'a deadbolt', kind: 'home', piece: 'kit:door-locks', desc: 'a chain and a heavy deadbolt on the inside of the trailer door', price: 25, at: 'park', keeper: 'npc:neighbour:2', spot: 'yard-sale', inTrailer: 'door',
      defends: { pct: 50 }, does: 'Whoever tries your door gets in less often' },
    floorsafe: { label: 'a floor safe', kind: 'home', piece: 'kit:safe-small', desc: 'a squat green safe with a brass dial, bolted to the floor under the counter', price: 100, at: 'market', keeper: 'npc:stallholder:2', spot: 'stall:6', inTrailer: 'under-the-counter',
      defends: { share: 8 }, does: 'If they get in, they find much less: most of what you banked is in the safe' },
  },

  // THE LIBRARY (lib-1; the owner, 2026-11-16: "I want the full library"): every piece of the city's cast to wear
  // (hats, eyewear, tops, bottoms, shoes, accessories) and every piece of the home kit that can stand in the trailer
  // is a thing the player can own (src/run/library.mjs; the pieces themselves: src/run/library-data.mjs). Cosmetic
  // only: owning or wearing one changes no number of the game.
  library: {
    // !! MOCK VALUES, TO BE TUNED (the owner: "you can just mock those numbers for now and we will figure out real
    // cost / perks later"). A piece's tier is a plain number, 0 the commonest; `labels` only names them. Its price is
    // its tier's band, its place in the band fixed by its id (the same in every run). Steep on purpose: the common
    // tier within a day's money, the top tier far beyond a whole run.
    tiers: {
      labels: ['common', 'rare', 'epic', 'grail'],
      price: [[8, 45], [250, 900], [5000, 15000], [150000, 500000]],
      // the library's own tier words as numbers (the cast: slime's rank, else the designer's; the home kit's rarity)
      from: { common: 0, rare: 1, epic: 2, grail: 3, legendary: 3, '1of1': 3 },
      // a piece the library gives no tier: from its id's hash, these shares (per thousand), few at the top
      shares: [800, 150, 40, 10],
    },
    // the cast's slots the run sells, and the run's own slot each is worn in
    slots: { hat: 'head', eyewear: 'eyewear', top: 'top', bottom: 'bottom', shoes: 'feet', acc: 'acc' },
    // THE SHELVES: every person who sells things to wear (or for the trailer) at an open place shows this many pieces
    // of that kind each day, drawn from the run's seed and the day (nothing stored). A piece is `seen` once it has been
    // on any shelf on any day so far (every shelf of the day is in the view).
    shelf: { wear: 6, home: 4 },
  },

  // ROUTES (RUN.md, "Routes"): a way on foot between two places, both directions, beside their subway link. No fare,
  // no turnstile. It passes its `stops` in order (listed from the first of `between`), each a place of its own on the
  // city map (`stops` below) that deals a small hand of cards to play or pass by. A route to a locked place is shown,
  // locked. The hour stays the clock: every leg is a step.
  routes: {
    fitStreet: { label: 'the walk by Fit Street', between: ['park', 'market'], stops: ['fitst'] },
  },
  // HOW A ROUTE IS GONE. energy: what the whole way costs, paid setting out (you need at least 1 to set out, and,
  // going away from home, energy.rideBack more: enough to get back). Setting out takes `hours`, an hour where you were
  // (its danger rolls, as the subway's leaving hour does); each leg on from a stop takes legHours, an hour on that
  // stop's ground (its danger rolls) or, at 0, no hour and nothing rolls. needs: the thing it takes (things.board). `do`: its choice.
  ways: {
    foot: { do: 'walk', label: 'Walk', verb: 'walked', how: 'on foot', energy: 1, hours: 1, legHours: 1, scene: { ride: 'foot' } },
    board: { do: 'skate', label: 'Skate', verb: 'skated', how: 'on your skateboard', energy: 0, hours: 1, legHours: 0, needs: 'board', scene: { ride: 'skate' } },
  },
  // THE STOPS: real ground between two places (a block of src/map.mjs and a spot of it, for the stage), danger by a
  // tier like a place's (pay × the tier's, jumping, the police), what it has to use up (`supply`), and its `cards`.
  // Arriving, you are dealt `hand` of the cards that can be played now (the seeded dice: the day, the hour, the stop),
  // each played at most once a day there, each an hour and an energy like a job; the rest you pass by. A card is a
  // job without a person: label, odds, base pay (× the tier's), heat and energy on a win or a fail (the heat goes on you
  // and on the stop), `goods` for a sale (as a selling job's: only dealt with one on you), or `street: 'bins'` for
  // the street's own bins (config `street.bins`, drawing on the stop's supply). `scene` as a job's.
  stops: {
    // DEAD AIR's block (the bar, -3,0) is the one block of the map that lies between the trailer park's and the
    // market's: about 4 m off the straight line from Sunny Acres to the Jay St lot, 39 m short of the market (demo/stage/places.json).
    fitst: {
      label: 'Fit Street, outside DEAD AIR', where: 'on Fit Street', block: 'bar', spot: 'street', tier: 'street', hand: 3,
      supply: { bins: { max: 2, refill: 2 } },
      cards: {
        errand: { label: 'Carry crates down to the cellar for the barkeeper', with: 'the barkeeper', odds: 100, base: [10, 13], scene: { win: { action: 'carry', spot: 'counter:shop' } } },
        lookout: { label: 'Keep a lookout at the alley mouth for a stranger', with: 'a stranger', odds: 75, base: [13, 18], failHeat: 1, scene: { win: { action: 'lookout' }, fail: { action: 'flee' } } },
        tipsy: { label: 'Walk a stranger who had one too many to the FIT ST stairs, for a tip', with: 'a stranger', odds: 90, base: [9, 14], scene: { win: { action: 'walk' }, fail: { action: 'shove' } } },
        sell: { label: 'Sell a smoke to a stranger outside DEAD AIR', with: 'a stranger', odds: 80, base: [12, 17], goods: { smokes: [12, 17] }, scene: { win: { kind: 'work:deal' }, fail: { kind: 'work:deal:dry' } } },
        dumpster: { label: 'Dig through the dumpster in the alley', street: 'bins', scene: { win: { action: 'rummage' } } },
      },
    },
  },

  // HOME PRESSURE (RUN.md, "Home pressure (home-1)"): one number for your home, from 0 to max, made of what you DO on
  // the street your crib opens onto (never of what you have banked or own). Its reasons:
  //   what you did there (each job's own `pressure`, { win, fail }; robbing somebody passing, street.rob.pressure; seen
  //     in its bins, `bins`; someone against you calling the police on it, `witness`; shutting the door on a regular,
  //     `refuse`). Giving at your door (`give`) and a job whose `pressure` is below 0 (the odd job) take points off.
  //     These points fade every morning: `fade` after a day you added some, `quietFade` after a quiet day.
  //   who lives there: each person against you `against`; each with you `with` (they look out for your door; a regular
  //     never does: they want more from you); the place hot `hot`.
  // From warnAt, each morning has warnPct + perPoint for every point past warnAt (at most capPct) that somebody is seen
  // casing your crib: an attempt the next day (config `raid`). Never while one is due, nor on the `rest` mornings after
  // one (with the warning's day, that is rest + 1 quiet days at least between two attempts). Laid low on the warning's
  // day, so the pressure is callOff or more under warnAt on the morning the attempt was due: they think better of it.
  pressure: {
    max: 10, warnAt: 3, warnPct: 30, perPoint: 15, capPct: 85, fade: 1, quietFade: 2, rest: 1, callOff: 2,
    against: 1, with: -1, hot: 1, bins: 1, witness: 1, refuse: 2, give: -1,
    // who cases it when nobody of the place fits (a regular against you, the one most against you, a hooked regular)
    stranger: { id: 'stranger:home', name: 'somebody nobody here knows', role: 'stranger' },
  },
  // THE ATTEMPT: on the day after the warning. They wait for you to be gone: it starts the first time, from a seeded hour
  // in `hours`, that you are away from home (the crib or the street it opens onto); home all day, they come in the night.
  // A notice reaches you wherever you are; get home inside `window` hours (the subway 1, the board 1, walking 2) and you
  // meet them at the door: the regular's fight (src/contest.mjs bands) at `strength` less the box cutter, `hurt` on
  // their win. (strength 45, not the regular's 55: they came for an empty trailer and found you; at 55 meeting them saved
  // too little for racing home ever to pay, measured.) Otherwise your defences settle it: whoever is on your step first
  // (config `guard`), then the door: `pct` it works (a thing that `defends` with a `pct` lowers it). A success takes
  // `share` percent of what is banked (a thing's `share` lowers it), never all, never goods or things; a scuffle at the
  // door, messyShare percent of that. Tuned against marks H1 to H7 (RUN.md, "Marks of home pressure").
  raid: { hours: [13, 16], window: 2, pct: 75, share: 30, messyShare: 50, strength: 45, hurt: { clean: 4, messy: 2 } },
  // THE GUARD: a person of the street your crib opens onto (`who`), hired at the crib for a stretch of `days` days (the
  // day you hire him and the days after), `price` paid up front from banked: no refund, no sending him off. On his last
  // day you may keep him `days` more for `price` again (no gap); otherwise he is gone the next morning. While on, an
  // attempt fails unless he is beaten: the contest at the attempt's strength less his `strength`, their clean win;
  // beaten, he is hurt and off for hurtDays days, and what was left of the stretch is lost. Against you, he will not
  // take the job (nor another stretch); turned against you during one, he finishes what was paid for. Cousin Earl,
  // whose truck is in the park all day and who likes you if you buy his cartons (Benny Two-Coats was the first pick: a
  // player who collects his debts has him against you on most of the days he is needed, measured). (save-1: by the day
  // at $25, hiring him only on the day somebody was coming made the warning a $25 fee: RUN.md, "Cousin Earl by the
  // stretch".)
  guard: { who: 'npc:connect:projects', price: 75, days: 3, strength: 10, hurtDays: 3, spot: 'step', label: 'park his truck by your door and watch it' },

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
  // always dealt first; two of the rest are drawn by the seeded dice from what you are able to do and who is left
  // (a selling job whose goods you carry is always one of the two: rules.mjs deal).
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
      // the connect: who sells the place's goods (config `goods`, `at`), and the spot they sell from
      connect: { who: 'npc:connect:projects', spot: 'truck' },
      // errands: things bought from what you carry, no hour, at a spot of the place from a person of it. `kind: 'food'`
      // is food for energy (not over your day's full energy), perDay a day.
      shop: [
        { item: 'sandwich', label: 'A chopped cheese', kind: 'food', piece: 'held:chopped_cheese', price: 4, does: 'Energy +1: one more hour', perDay: 1, gives: { energy: 1 }, keeper: 'npc:neighbour:3', spot: 'kitchen-window' },
      ],
      jobs: {
        odd: { label: 'An odd job for a neighbour', named: 'An odd job for {who}', role: 'neighbour', with: 'a neighbour', safe: true, odds: 100, base: [6, 10], mood: { win: 'friendly' }, trust: { win: 1 }, pressure: { win: -1 }, scene: { win: { action: 'carry' } } },
        loosies: { label: 'Sell loose cigarettes at the bus stop', named: 'Sell loose cigarettes to {who} at the bus stop', role: 'buyer', with: 'the bus stop', odds: 85, base: [8, 17], goods: { smokes: [8, 17] }, mood: { win: 'friendly', fail: 'wary' }, trust: { win: 1, fail: 0 }, pressure: { win: 1, fail: 1 }, scene: { win: { kind: 'work:deal' }, fail: { kind: 'work:deal:dry' } } },
        wallet: { label: 'Lift a wallet at the bus stop', named: 'Lift a wallet off {who}', role: 'mark', with: 'a mark', odds: 60, base: [18, 30], failHeat: 1, mood: { win: 'unaware', fail: 'wary' }, trust: { win: 0, fail: -2 }, pressure: { win: 1, fail: 2 }, scene: { win: { action: 'hand_off', later: 'pickpocket_dip' }, fail: { action: 'hand_off', later: 'pickpocket_dip' } } },
        collect: { label: 'Collect a debt for the park manager', named: 'Collect a debt from {who} for the park manager', role: 'debtor', with: 'the park manager', odds: 70, base: [14, 22], failEnergy: 2, mood: { win: 'sour', fail: 'wary' }, trust: { win: -1, fail: -2 }, pressure: { win: 1, fail: 1 }, scene: { win: { kind: 'collect:win' }, fail: { kind: 'collect:lose' } } },
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
        { id: 'npc:connect:projects', name: 'Cousin Earl', role: 'connect' }, // sells cartons out of his truck
      ],
    },
    market: {
      label: 'the flea market', where: 'at the flea market', block: 'market', spot: 'street', tier: 'rough',
      onlySafe: 'only the stall',
      links: { park: { via: 'subway' } },
      supply: { strangers: { max: 3, refill: 2 }, bins: { max: 4, refill: 4 } },
      connect: { who: 'npc:connect:market', spot: 'back-row' },
      shop: [
        { item: 'drink', label: 'An energy drink', kind: 'food', piece: 'prop:energy-can', price: 5, does: 'Energy +1: one more hour', perDay: 1, gives: { energy: 1 }, keeper: 'npc:shop:market', spot: 'cooler' },
      ],
      jobs: {
        stall: { label: 'Work a stall for the shopkeeper', named: 'Work a stall for {who}', role: 'shopkeeper', with: 'the shopkeeper', safe: true, odds: 100, base: [11, 15], mood: { win: 'friendly' }, trust: { win: 1 }, pressure: { win: -1 }, scene: { win: { action: 'haggle', spot: 'counter:shop' } } },
        crowd: { label: 'Sell to the crowd', named: 'Sell to {who} in the crowd', role: 'buyer', with: 'the crowd', odds: 75, base: [32, 48], goods: { discs: [32, 48], smokes: [30, 46] }, failHeat: 1, mood: { win: 'friendly', fail: 'wary' }, trust: { win: 1, fail: 0 }, pressure: { win: 1, fail: 1 }, scene: { win: { kind: 'work:deal' }, fail: { kind: 'work:deal:dry' } } },
        wallet: { label: 'Lift a wallet in the crowd', named: 'Lift a wallet off {who}', role: 'mark', with: 'a mark', odds: 55, base: [30, 50], failHeat: 1, mood: { win: 'unaware', fail: 'wary' }, trust: { win: 0, fail: -2 }, pressure: { win: 1, fail: 2 }, scene: { win: { action: 'hand_off', later: 'pickpocket_dip' }, fail: { action: 'hand_off', later: 'pickpocket_dip' } } },
        till: { label: 'Grab a till', named: "Grab {who}'s till", role: 'stallholder', with: 'the shopkeeper', odds: 40, base: [60, 95], winHeat: 1, failHeat: 2, mood: { win: 'sour', fail: 'wary' }, trust: { win: -3, fail: -2 }, pressure: { win: 2, fail: 2 }, scene: { win: { action: 'grab', spot: 'counter:shop', later: 'till_grab' }, fail: { action: 'grab', spot: 'counter:shop', later: 'till_grab' } } },
        stickup: { label: 'A stick-up behind the stalls', named: 'Stick up {who} behind the stalls', role: 'stallholder', with: 'a stallholder', odds: 60, base: [50, 80], winHeat: 1, failHeat: 2, needs: 'cutter', mood: { win: 'sour', fail: 'wary' }, trust: { win: -3, fail: -2 }, pressure: { win: 2, fail: 2 }, scene: { win: { kind: 'rob:clean' }, fail: { kind: 'rob:fail' } } },
      },
      // seven to work, so it lasts; the third stallholder keeps ignoring heat the worst way to play (RUN.md)
      people: [
        { id: 'npc:shop:market', name: 'Mrs. Bao', role: 'shopkeeper' },
        { id: 'npc:shop:market:2', name: 'Mr. Ferraro', role: 'shopkeeper' },
        { id: 'npc:buyer:market:1', name: 'Lola', role: 'buyer' },
        { id: 'npc:buyer:market:2', name: 'Pockets', role: 'buyer' },
        // (goods-1: two more buyers in the crowd, so carrying more can sell more: RUN.md, "Goods, the connect and errands")
        { id: 'npc:buyer:market:3', name: 'Tiny', role: 'buyer' },
        { id: 'npc:buyer:market:4', name: 'a man with a shopping cart', role: 'buyer' },
        { id: 'npc:mark:market', name: 'a woman in the crowd', role: 'mark' },
        { id: 'npc:mark:market:2', name: 'a man with a camera', role: 'mark' },
        { id: 'npc:stallholder', name: 'a stallholder', role: 'stallholder' },
        { id: 'npc:stallholder:2', name: 'Mr. Okafor', role: 'stallholder' },
        { id: 'npc:stallholder:3', name: 'Mrs. Kowalski', role: 'stallholder' }, // (and the clothes rail)
        { id: 'npc:connect:market', name: 'Teo', role: 'connect' }, // sells bootleg discs from a duffel in the back row
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
    const by = tier?.pay ?? 1;
    // a selling job's goods: what each pays there in dollars (base × the tier's pay), as `goodsPay`
    const jobs = Object.fromEntries(Object.entries(p.jobs).map(([jid, j]) => [jid, Object.freeze({ ...j, pay: j.base ? scale(j.base, by) : j.pay,
      ...(j.goods ? { goodsPay: Object.freeze(Object.fromEntries(Object.entries(j.goods).map(([g, b]) => [g, scale(b, by)]))) } : {}) })]));
    places[id] = Object.freeze({ ...p, jobs: Object.freeze(jobs) });
  }
  // a stop's cards: their pay in dollars (base × the stop's tier's pay), as a place's jobs
  const stops = {};
  for (const [id, s] of Object.entries(raw.stops ?? {})) {
    const tier = s.tier ? raw.tiers[s.tier] : null;
    if (s.tier && !tier) throw new Error(`stop ${id}: no tier ${s.tier}`);
    const by = tier?.pay ?? 1;
    const cards = Object.fromEntries(Object.entries(s.cards ?? {}).map(([cid, c]) => [cid, Object.freeze({ ...c, ...(c.base ? { pay: scale(c.base, by) } : {}),
      ...(c.goods ? { goodsPay: Object.freeze(Object.fromEntries(Object.entries(c.goods).map(([g, b]) => [g, scale(b, by)]))) } : {}) })]));
    stops[id] = Object.freeze({ ...s, stop: true, cards: Object.freeze(cards) });
  }
  const worked = Object.keys(places).filter(id => places[id].jobs);
  return Object.freeze({
    ...raw,
    places: Object.freeze(places),
    stops: Object.freeze(stops),
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
