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

  // FOOD: energy you can buy in a day. One count for the day across every food and drink of every place (a place's
  // `shop` entries with `kind: 'food'`), whatever each one's own `perDay`: at most perDay a day. (Measured, RUN.md
  // "Goods, the connect and errands": with no cap three foods in the trailer park made a park player who eats bank
  // as much as the market, $73 against $73.) `full` is the line an option shows at the cap.
  food: { perDay: 2, full: 'you have eaten all you can today' },

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
    // (batch-1) WHERE THE POLICE ARE THE DANGER: Glasswall Plaza, 22 m from Precinct 9. Half again the park's pay, a
    // quarter of the market's jumping, patrolled, and a stop twice as likely. Careful (heat under 3) the police hardly
    // touch you; heat-blind they take everything (RUN.md "Glasswall Plaza": at pay × 2 it beat the market, measured).
    watched: { pay: 1.5, jump: 0.25, strength: 0, patrol: true, police: 2, cool: 2, roughPct: 50 },
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
    // (pot-1) the box fan's first job: in the window, the smell of the pot is `smellOff` lower (make.smell)
    // (bench-1: `does`, the card's line, which it lacked; its price $7, not $10: the orchestrator's call the owner approved,
    // where it pays back inside eight days on the mattress for a cook who also works his own street. Measured after the
    // dance's change: that cook gains $0.90 a day with it (2,500 seasons), so $7 is 7.8 days; $8 would be 8.9. RUN.md
    // "The bench and the bottle (bench-1)")
    boxfan: { label: 'a box fan', kind: 'home', piece: 'kit:box-fan', desc: 'a square fan, one speed, loud', price: 7, at: 'park', keeper: 'npc:neighbour:2', spot: 'yard-sale', inTrailer: 'window',
      smellOff: 1, does: 'The smell of your cooking is one lower', job: 'In the window it blows the smell of your cooking down the lane: the smell is one lower' },
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
    // (sixes-1, RUN.md "The Sixes and a home that scales: the first slice") EACH PIECE HAS ONE JOB against a named
    // visitor (`against`: 'sneak', 'crew' or both). What each key of `defends` does:
    //   pct: a sneak, nobody home and nobody on the step, gets in this often, not raid.pct (the chain and locks)
    //   kick: a crew kicking the door while you are out gets in this often, not crew.kickPct (the chain and locks)
    //   share: a sneak who gets in takes this share of what is banked, not raid.share (the safe)
    //   crewShare: a crew who gets in while you are out takes this share, not crew.share (the safe; home and beaten,
    //     they make you open it and it does not help)
    //   bar: at your door, the first of a crew through has lost this much health breaking it (the door bar)
    //   sneakOff: a sneak who comes while you are out and hears the dog gives up this often (the guard dog; fed, below)
    //   lead: the warning comes this many days sooner (the camera); attempts come no more often
    //   warn: points off each morning's chance that a sneak cases you (the dog sign)
    deadbolt: { label: 'a deadbolt', kind: 'home', piece: 'kit:door-locks', desc: 'a chain and a heavy deadbolt on the inside of the trailer door', price: 25, at: 'park', keeper: 'npc:neighbour:2', spot: 'yard-sale', inTrailer: 'door',
      defends: { pct: 50, kick: 75 }, against: ['sneak', 'crew'], does: 'Whoever tries your door gets in less often', job: 'A sneak gets in half the time, not 3 in 4; a crew kicking it while you are out, 3 in 4, not 9 in 10' },
    floorsafe: { label: 'a floor safe', kind: 'home', piece: 'kit:safe-small', desc: 'a squat green safe with a brass dial, bolted to the floor under the counter', price: 100, at: 'market', keeper: 'npc:stallholder:2', spot: 'stall:6', inTrailer: 'under-the-counter',
      defends: { share: 8, crewShare: 20 }, against: ['sneak', 'crew'], does: 'If they get in, they find much less: most of what you banked is in the safe', job: 'A sneak who gets in takes 8% of what you banked, not 30%; a crew while you are out 20%. Home and beaten, they make you open it' },
    doorbar: { label: 'a door bar', kind: 'home', piece: 'kit:door-bar', desc: 'a steel bar across the inside of the door, in two brackets', late: true, price: 40, at: 'docks', keeper: 'npc:foreman:docks', spot: 'pier', inTrailer: 'door',
      defends: { bar: 20 }, raid: { out: 1, pct: 50 }, against: ['crew'], does: 'At your door, the first of a crew through is hurt breaking it', job: 'Home when a crew comes: the first one through the door is hurt before the fight starts. A sneak never meets it: he comes while you are out' },
    dog: { label: 'a guard dog', kind: 'home', piece: 'kit:dog-bed', desc: "a dog from Gloria's yard, with its bed and bowls", late: true, price: 40, at: 'park', keeper: 'npc:neighbour:3', spot: 'kitchen-window', inTrailer: 'floor',
      defends: { sneakOff: 50 }, against: ['sneak'], does: 'A sneak who hears the dog gives up half the time', job: 'While you are out, a sneak who hears it gives up half the time. $2 a day for its food, from banked; two days unfed and it guards nothing. When a crew comes it is shut in the back' },
    camera: { label: 'a CCTV camera', kind: 'home', piece: 'kit:cctv-camera', desc: 'a small camera over the door, a red light on', late: true, price: 120, at: 'market', keeper: 'npc:stallholder:2', spot: 'stall:6', inTrailer: 'over-the-door',
      defends: { lead: 1 }, raid: { out: 2, pct: 50 }, against: ['sneak', 'crew'], does: 'You see them casing a day sooner', job: 'Whoever cases your crib is seen a day sooner: two days to answer, not one. It keeps nobody away and they come as often: it is worth it only if you answer the warning' },
    dogsign: { label: 'a beware of the dog sign', kind: 'home', piece: 'kit:dog-sign', desc: 'a tin BEWARE OF THE DOG sign. There is no dog', late: true, price: 5, at: 'park', keeper: 'npc:neighbour:2', spot: 'yard-sale', inTrailer: 'outside',
      defends: { warn: 10 }, against: ['sneak'], does: 'Fewer sneaks bother casing you', job: 'Ten points off each morning\'s chance a sneak cases you. A crew reads it and laughs' },
    // (raid-1, RUN.md "The raid on your home (raid-1)") THE GUNS: bought where they are, from who has them, kept at home
    // and held at your door when the Sixes come (`state.holdWith`); never in a one-on-one (the owner's call). `gun`: the
    // fight's weapon (src/fight/data.mjs WEAPONS: its numbers are the fight's own, untouched); `ammo`: a box of its rounds
    // (`n` for `price`) from the same seller (`state.ammo`); `loud`: the heat a night of firing it puts on you and on the
    // street your crib opens onto ("it's loud so it draws cops"); `holdFire`: m, it waits for them to be this close (the
    // Doorman at the door). Each has a job, not a tier: RUN.md, the raid's table. `late: 'raid'`: listed after every older
    // move (raidMoves), so no older key moves; `against: ['sixes']`: none of them answers a sneak or a crew.
    sixshot: { label: 'a Six-shot', kind: 'home', piece: 'kit:six-shot', desc: 'a snub revolver, six in the wheel, the bluing worn off the grip', late: 'raid', price: 150, at: 'market', keeper: 'npc:connect:market', spot: 'back-row', inTrailer: 'by-the-door',
      gun: 'pistol', ammo: { label: 'a box of twelve Six-shot rounds', piece: 'kit:six-shot-rounds', n: 12, price: 12 }, loud: 1, raid: { take: 50 },
      defends: {}, against: ['sixes'], does: 'A gun for anything: six shots, quick to reload', job: 'Held at your door: good against any of them, the best against none. The quietest gun' },
    doorman: { label: 'a Doorman', kind: 'home', piece: 'kit:double-barrel', desc: 'a short double barrel, sawn down, two shells and a slow reload', late: 'raid', price: 220, at: 'park', keeper: 'npc:connect:projects', spot: 'truck', inTrailer: 'by-the-door',
      gun: 'doorman', holdFire: 3.5, ammo: { label: 'a box of six Doorman shells', piece: 'kit:double-barrel-shells', n: 6, price: 15 }, loud: 1, raid: { take: 50 },
      defends: {}, against: ['sixes'], does: 'Waits for them at the door, then takes several at once', job: 'Held at your door: it waits until they are on you and each shell takes every one of them in front of it. Two shells, a slow reload: no use against the ones who hang back' },
    chopper: { label: 'a Chopper', kind: 'home', piece: 'kit:chopper', desc: 'a stubby automatic with a long magazine, fifteen at a pull', late: 'raid', price: 230, at: 'docks', keeper: 'npc:driver:docks', spot: 'pier', inTrailer: 'by-the-door',
      gun: 'chopper', ammo: { label: 'a box of thirty Chopper rounds', piece: 'kit:chopper-rounds', n: 30, price: 24 }, loud: 2, raid: { take: 50 },
      defends: {}, against: ['sixes'], does: 'Fast: it cuts down the quick ones before they reach you, and eats rounds', job: 'Held at your door: fifteen at a pull, the answer to the quick ones coming at you from every side. Hungry: a night of it is twenty rounds. Loud' },
    longeye: { label: 'a Long-eye', kind: 'home', piece: 'kit:long-rifle', desc: 'a scoped hunting rifle, five in the magazine', late: 'raid', price: 200, at: 'docks', keeper: 'npc:driver:docks:2', spot: 'pier', inTrailer: 'by-the-door',
      gun: 'longeye', ammo: { label: 'a box of five Long-eye rounds', piece: 'kit:long-rifle-rounds', n: 5, price: 15 }, loud: 2, raid: { take: 50 },
      defends: {}, against: ['sixes'], does: 'One hard shot before they reach you: the answer to big men', job: 'Held at your door: one hard shot after another as they cross the lot, through any jacket. Slow, and poor once one is on top of you. The loudest' },
    // (raid-1) A THING AT RISK, three ways (the owner: money, goods and stock can be taken; a station or a big piece is
    // never taken, only knocked out): `raid: { take: pct }` whoever gets in carries it off that often (owned no more; its
    // `worth`, else its price, counts in what your home is worth); `raid: { out: days, pct }` they smash it that often and it
    // does nothing for that many days (`state.home.out`: seen smashed, mended after); no `raid`, neither. In this slice
    // the guns are taken (the one in your hands always, if they beat you); the door bar and the camera are knocked out.
    // A HIDING PLACE: `hides` { cash: dollars never found, goods: true the goods at the crib never taken, things: how many
    // things at risk are never found, the dearest first }; the same rule for money and for things.
    // (raid-1) FIVE MORE PIECES, each one job the others do not have (`defends`: what it does in a raid by the Sixes; the
    // two hiding places against anyone who gets in):
    //   blind: home, they come in blind this many seconds (slowed, no blow, no shot)       (the pepper fogger)
    //   cut: home, every hit on you does this percent less                               (the stab vest)
    //   stash: this many dollars of what you bank are never found, by anyone who gets in  (the cereal-box stash)
    //   hideGoods: the goods at the crib are behind it: never taken                       (the false wall)
    //   decoy: home and beaten, when they make you open up you open the decoy: they take this percent less (the decoy safe)
    fogger: { label: 'a pepper fogger', kind: 'home', piece: 'kit:pepper-fogger', desc: 'a canister over the door on a pull cord: the room fills with pepper', late: 'raid', price: 50, at: 'market', keeper: 'npc:stallholder:2', spot: 'stall:6', inTrailer: 'over-the-door',
      defends: { blind: 3 }, against: ['sixes'], does: 'They come in blind', job: 'Home when the Sixes come: you pull the cord and they come through the door blind for three seconds, slowed and unable to hit. Your first shots and blows are free' },
    vest: { label: 'a stab vest', kind: 'home', piece: 'kit:stab-vest', desc: 'a grey stab vest on a hook by the door', late: 'raid', price: 40, at: 'market', keeper: 'npc:stallholder:3', spot: 'clothes-rail', inTrailer: 'by-the-door',
      defends: { cut: 30 }, against: ['sixes'], does: 'Every hit on you does less', job: 'Home when the Sixes come: you have it on, and every blow, cut and shot on you does 30% less' },
    cereal: { label: 'a cereal-box stash', kind: 'home', piece: 'kit:stash-cereal', desc: 'a box of corn flakes with a false bottom, on top of the fridge', late: 'raid', price: 20, at: 'park', keeper: 'npc:neighbour:3', spot: 'kitchen-window', inTrailer: 'counter',
      defends: { stash: 150 }, hides: { cash: 150 }, against: ['sneak', 'crew', 'sixes'], does: 'Nobody looks in the cereal', job: 'The first $150 of what you bank is in the cereal box: whoever gets in never finds it, even when they make you open up' },
    falsewall: { label: 'a false wall', kind: 'home', piece: 'kit:false-wall', desc: 'a panel of the back wall that lifts out, a cavity behind it', late: 'raid', price: 25, at: 'docks', keeper: 'npc:foreman:docks:2', spot: 'pier', inTrailer: 'back-wall',
      defends: { hideGoods: 100 }, hides: { goods: true, things: 2 }, against: ['crew', 'sixes'], does: 'Your stock and two guns are behind the wall', job: 'The goods you keep at the crib, and two of the guns you are not holding, are behind it: whoever gets in never takes them. It hides no cash' },
    // (a police scanner, halving gunfire's heat, was tried here: a night of firing is one or two heat a season, and halving
    // it paid nothing measurable (−$1.1 a day, mark D4 at 500). The decoy safe took its place: RUN.md)
    decoy: { label: 'a decoy safe', kind: 'home', piece: 'kit:decoy-safe', desc: 'a small safe in plain sight with a little cash in it, for show', late: 'raid', price: 60, at: 'park', keeper: 'npc:neighbour:2', spot: 'yard-sale', inTrailer: 'floor',
      defends: { decoy: 50 }, against: ['sixes'], does: 'When they make you open up, you open the wrong safe', job: 'Home and beaten by the Sixes, they make you open up and you open the decoy: they take half what they would have. It does nothing while you are out' },
    // (pot-1, RUN.md "The pot (pot-1)") THE HOT PLATE: the kitchen's station (make.makers.kitchen). Owned, the Cook move
    // at your crib. A station: knocked out by a raid, never taken (`raid: { out }`, as the door bar). `late: 'pot'`:
    // listed after every older move (potMoves), so no older key moves. `station`: the maker it stands for.
    hotplate: { label: 'a hot plate and pot', kind: 'home', piece: 'kit:hot-plate', desc: 'a single electric ring with a dented pot on it', late: 'pot', price: 30, at: 'park', keeper: 'npc:neighbour:2', spot: 'yard-sale', inTrailer: 'counter',
      station: 'kitchen', raid: { out: 1, pct: 50 }, does: 'Cook at your crib: an hour, two things in the pot, six bags', job: 'At your crib, an hour: up to two things in the pot and six bags come out. Cooking smells' },
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
        // (batch-1, RUN.md "Two cards on the walk") THE BARBER at FRESH CUTZ, the walk-up with the barber pole on the
        // block's Fit Street side: an hour and an energy for your own heat −1 (a new face). Sure, pays nothing; once a day
        // and only with heat of your own to cool (`minHeat`). A SHOP ON THE WALK (`beside`): it is no part of the hand's
        // draw, it stands beside the hand whenever you have heat, and never takes one of the hand's three places from a
        // card that pays (dealt into the hand it cost playing the stops 1.4 points, +4.5% against +5.9% at 3,000
        // seasons, under mark R2's bar; measured 2026-11-18)
        barber: { label: 'Get a cut at FRESH CUTZ, a new face for the police', with: 'the barber', odds: 100, base: [0, 0], winHeat: -1, minHeat: 1, beside: true, scene: { win: { action: 'hand_off' } } },
        // THE SNEAKER WALL at DROP, two doors along: a pair lifted off the wall. Pays less an energy than the market's
        // stall (mark R2's ceiling: at $20–30 × 2 and 50%, $25 an energy against the stall's ~$26)
        // A miss is heat +1 (2026-11-18; it was +2: the same average pay as carrying the crates, on a coin's toss, with
        // twice the lookout's heat on a miss, was a worse deal than the honest card beside it, and its heat cost the
        // walker who plays the stops 1.9 points: +5.9% against +7.9% at 3,000 seasons)
        drop: { label: 'Lift a pair off the sneaker wall at DROP', with: 'the clerk', odds: 50, base: [20, 30], failHeat: 1, scene: { win: { action: 'grab' }, fail: { action: 'flee' } } },
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
  guard: { who: 'npc:connect:projects', price: 75, days: 3, strength: 10, hurtDays: 3, spot: 'step', label: 'park his truck by your door and watch it',
    // (sixes-1) THE DOOR FIGHT: told how to fight (`ways`, data.mjs WAYS_OFFERED; unset, `way`), he fights beside you as
    // the fight study's Earl (`fight`: his health, weapon, its scale). Down in a door fight he is off `doorHurtDays`
    // (the day after it), and his stretch goes on when he is up: not three days and the stretch lost, as when he is
    // beaten alone on the step (the design: hurt that hard, he only paid for himself against three or more)
    way: 'front', ways: ['front', 'hunt', 'block'], doorHurtDays: 1, fight: { hp: 50, weapon: 'pipe', hits: 1.0 } },

  // (sixes-1) A CREW THAT KICKS THE DOOR (RUN.md "The first slice"): HOME's second line. From pressure `at`, the
  // warning is of a crew, not a sneak: two heavies after dark, warned the day before like the sneak. They come in the
  // night (resolved with the night, as the sneak who found you home all day): home, the DOOR FIGHT you watch (the
  // jumped fight's machinery, src/fight/duel.mjs: you with what you fight with, at the health a night's sleep gives,
  // Earl beside you if he is on, told his way; the door bar's head start); out for the night (the jail, the clinic, the
  // street), Earl on the step first (the contest at `strength` less his), then the door, a kick, `kickPct` (the chain
  // and locks: `kick`). In, they take `share` of what is banked (the safe while you are out: `crewShare`; home and
  // beaten, they make you open it: `share`), never all of it. Won at your door: energy `hurt.won` off the morning; lost,
  // `hurt.lost`. The dog is shut in the back; the sign means nothing to them.
  // `foes`: the two, as getting jumped's (duel.mjs), each a heavy; `around` where they stand when the fight starts;
  // `ally` where Earl stands. Tuned (RUN.md: mark S4) so that rested, bare-handed and alone you win about 50 in 100,
  // with the door bar about 70, with the box cutter about 80.
  crew: {
    at: 7, share: 30, kickPct: 90, strength: 60, stockPct: 50, hurt: { won: 1, lost: 4 },
    name: 'a crew of two', says: 'two heavies at your door',
    foes: [
      { id: 'c1', kind: 'heavy', name: 'the first heavy', weapon: 'fists', hp: 45, hits: 1.15, speed: 2.6, reel: 0.25 },
      { id: 'c2', kind: 'heavy', name: 'the second heavy', weapon: 'fists', hp: 45, hits: 1.15, speed: 2.6, reel: 0.25 },
    ],
    around: [[1.8, 0], [2.6, 40]],
    ally: [1.3, 200],
    cap: 25,
    sample: 400,
  },
  // (sixes-1) THE GUARD DOG's food: `feed` from banked every morning; `hungryDays` unfed mornings in a row and it guards nothing
  dog: { feed: 2, hungryDays: 2 },

  // (sixes-1) THE SIXES (RUN.md "The first slice"): a gang that thinks `ground` is theirs. One meter, 0 to `max`, made of
  // what you do on their ground (never of what you own): each act's points (`raise`) held up until they fade, the
  // oldest first: `quietFade` on the morning after a day you did nothing there, and paying the tax takes `pay` off and
  // that day's selling with it. In this slice it is held at `cap` at most: nothing above it is built.
  //   at `word`: Dutch has a word with you at the market (a scene and a notice), once a climb;
  //   at `tax`: on a day you sold or grabbed there, Dutch is waiting by the subway steps when you leave: `taxPct` of what
  //     you made there today, at least `taxMin`. Pay (from what you carry) or refuse (`raise.refuse`);
  //   at `jump`: warned the morning before ("they'll be looking for you at the market tomorrow"), that day two of them
  //     are waiting by the steps instead of her: the jumped fight, their two. Won: you keep it all, the two fear you for
  //     memory.days (a mark of kind `seenOff`: they do not come for you again while it lasts), and the meter goes up
  //     `raise.beat`. Lost: they take what the jump takes (all you carry and the clinic, or half), and the meter drops
  //     to `afterJump`: they made their point.
  sixes: {
    // (raid-1: held at `cap` 9, the raid's step; the siege at 10 is not built)
    ground: ['market'], max: 10, cap: 9, word: 3, tax: 5, jump: 7, raid: 9,
    // (second pass: a grab +1, not the design's +2: at +2 the market's tills made the burner meet the Sixes far more than
    // the good neighbour, and mark 13 (the two within 10%) fell out, 10.4% at 3,000; at +1 it is 8%: RUN.md)
    raise: { sell: 1, grab: 1, refuse: 2, beat: 2 },
    quietFade: 1, pay: 1, taxPct: 20, taxMin: 10, afterJump: 6,
    // (raid-1) THE PUSH: the longer you keep working their market, the bigger their cut: the tax is `taxPct` on the first
    // day of a run of days you made money there, `perDay` points more each day after in a row, at most `maxPct`; a day
    // with nothing made there starts the run again (RUN.md "The Sixes push")
    push: { perDay: 10, maxPct: 50 },
    grabs: ['till', 'stickup'],
    dutch: 'npc:sixes:dutch',
    jumpers: ['npc:sixes:heavy', 'npc:sixes:runner'],
    // (`rest: true`, a trial's switch only (run-marks: P1 to P5 compare one place with another): the meter held at 0)
  },

  // (raid-1, RUN.md "The raid on your home (raid-1)") THE SIXES COME FOR YOUR CRIB: with their meter at sixes.raid (9),
  // the morning brings word (the camera: a day sooner) that they come on the night of the next day; who comes and how
  // many is set then, by what is at stake at your crib (banked + the goods there at cost: `steps`, the dollars from
  // which it is the second and third size) and by the run's dice among the four `crews`. Home that night, it is the
  // raid fight (src/fight/raid.mjs: you with what you hold, `state.holdWith`, Earl beside you, each piece its job); out
  // (the street, the jail, the clinic), Earl on the step first (the crew's contest) then the door (the crew's kick and
  // the chain and locks), and the safe's share. Won at home: they leave you be for `truce` days (no tax, nobody on the
  // kerb, no raid) and the meter goes to `afterWin`; held but hurt (won at `hurtAt` percent of your health or less):
  // `hurt.hurt` off the morning; lost: knocked out, the clinic, they make you open up (`share` of what is banked: the
  // safe does not help, the cereal box does), `stockPct` of the goods at the crib (the false wall keeps them), and the
  // gun in your hands with its rounds; the meter to `afterLoss`. Out and they got in: `outShare` (the safe:
  // crewShare), the goods, and the meter to `afterTake`; out and the door held: the meter stays, and they come again
  // after `rest` quiet mornings.
  // `kinds`: each of them as the fight's foe (src/fight/duel.mjs: a shooter keeps back and shoots, sim.mjs's FOES.shooter);
  // `crews`: [kind, how many at each size, where they stand: `at`, [metres, degrees] from you at your door, 0° the lot]
  sixesRaid: {
    // (the owner, 2026-11-18: how often they come follows what you DO, never what you hold: the meter alone, no step
    // nearer for a richer home; what you hold sets how many come and what they take)
    share: 50, outShare: 30, stockPct: 50, hurtAt: 30, truce: 7, afterWin: 4, afterLoss: 3, afterTake: 5, rest: 3,
    // (`spoils`: held at your door, you go through the pockets of each of them you put down: dollars each, banked)
    hurt: { won: 1, hurt: 3 }, dogBite: 20, cap: 30, sample: 200, spoils: [10, 25],
    kinds: {
      heavy: { kind: 'heavy', name: 'a heavy', weapon: 'fists', hp: 45, hits: 1.15, speed: 2.6, reel: 0.25 },
      runner: { kind: 'runner', name: 'a runner', weapon: 'shiv', hp: 22, hits: 1.6, speed: 4.3, reel: 0.38 },
      shooter: { kind: 'shooter', name: 'a shooter', weapon: 'junkgun', hp: 38, speed: 2.4, reel: 0.35 },
      bigman: { kind: 'heavy', name: 'a big man', weapon: 'mauler', hp: 70, hits: 1.0, speed: 2.4, reel: 0.12, heft: 0.35, soak: 12 },
    },
    at: {
      door: [[6, 0], [6.5, 20], [6.5, -20], [7.3, 8], [7.7, -12]],
      scatter: [[7, 0], [9, 60], [11, -60], [13, 30], [15, -30]],
      back: [[10, 170], [10.5, -165]],
      lot: [[14, 0], [17, 12], [20, -10]],
    },
    crews: {
      rush: { name: 'a rush at your door', says: 'heavies, all of them at once, straight at the door', foes: [['heavy', [2, 3, 4], 'door']] },
      runners: { name: 'the quick ones', says: 'runners with blades, from every side', foes: [['runner', [3, 4, 5], 'scatter']] },
      shooters: { name: 'shooters at the back', says: 'a heavy at the door, and shooters who hang back by the fence', foes: [['heavy', [1, 1, 2], 'door'], ['shooter', [1, 2, 2], 'back']] },
      bigmen: { name: 'big men', says: 'big men in heavy jackets, walking across the lot', foes: [['bigman', [1, 2, 3], 'lot']] },
    },
    arena: { w: 60, h: 40, gap: 1.8 },
    ally: [1.3, 200],
  },

  // (raid-1) WHAT YOUR HOME IS WORTH (the WORTH meter): one sum over everything kept at the crib, each kind of holding a
  // row of `entries` (`of`: where the rules find it: 'banked' the cash banked; 'stash' the goods kept there, at cost;
  // 'things' every thing you own that a raid can carry off, its `worth` or else its price). A later kind of
  // holding (a workstation, ingredients, product, a modified gun) is one more row and one more `of`, nothing else. What
  // it decides: how big a crew the Sixes send (`steps`: the worth from which it is the second and the third size) and
  // what is at stake; never whether or when they come (that is what you do: the meter).
  worth: {
    entries: [
      { id: 'cash', label: 'cash banked', of: 'banked' },
      { id: 'stock', label: 'goods kept at the crib, at cost', of: 'stash' },
      { id: 'things', label: 'things a raid can carry off', of: 'things' },
      // (pot-1, the addition's G3.6: every made thing is a row) what you made, kept at the crib, at what it sells for (the
      // best a selling job pays for its kind, the middle of the range); what you make it with, at cost
      { id: 'made', label: 'what you made, kept at the crib, at what it sells for', of: 'made' },
      { id: 'makings', label: 'what you cook with, at cost', of: 'makings' },
    ],
    steps: [600, 1400],
  },

  // (pot-1, RUN.md "The pot (pot-1)") MAKING THINGS: the crafting plan's one mechanic in its general form (the addition's
  // G3: "a carrier takes these kinds of thing", not "the pot"). Read by src/run/make.mjs (the rules) and effects.mjs.
  //   makers: a workshop, the station that stands for it (a thing of `things` with `station`), and its carriers. A
  //     carrier takes `slots` things of the kinds in `takes` and gives `n` of the kind `gives`, in `hours` at your crib.
  //     The bench (build step 2) is one more maker here, its fillings one more kind in `makings`.
  //   kinds: what a carrier gives (a bag): its word (`unit`) and the art's piece (`prop:bag-<product>` per product).
  //   makings: what goes in, each ONE thing it does (an `effect`), its family (the chip's colour), its rarity, and who sells
  //     it where (`at`, `keeper`, `spot`) at what price: bought on the street from what you carry, no hour, from somebody
  //     not against you, kept as goods (on you, then at the crib: config `goods` is made from these).
  //   products: the art's ids (demo/stage/props/craft.js PRODUCTS) for what a set of makings makes, and the name it goes by
  //     (the owner's: "Zonked"); a product of two or more is named by the player (`names`), this name the default.
  //   effects: what being under it does, to the person (`person`) and to the place while anyone there is under it
  //     (`place`), how long (`hours`), which part of the body it wants (`part`: two on the same part take turns, the
  //     downer last, B3), and how it is seen (`look`, for the page). An effect does not care where it came from.
  //   outcomes: the odds of a batch, shown before you cook (B4): clean, dirty (`tired`: cooked tired), something else got
  //     in (one more making, free, from anything ever on your shelf; none possible: it is clean).
  //   dirty: what rides along in a dirty batch (slice 1: the Pukes), found out when the first person takes it.
  //   smell: a LEVEL, not a pile (B9): the most cooks on today or yesterday, at most `max`, less each fan's `smellOff`;
  //     a reason on HOME.
  //   lift: a sleeper's wallet (the asleep effect's `person.lift`): sure, an hour, it pays what the place's `like` job
  //     pays (its wallet), and he knows who sold it: a mark of `mark` for the week, `trust`, `pressure` at home.
  //   names: what a name you give may be. belt: what can be on you without being for sale.
  make: {
    makers: {
      kitchen: { label: 'the kitchen', station: 'hotplate',
        carriers: { pot: { label: 'the pot', takes: ['ingredient'], slots: 2, gives: 'bag', n: 6, hours: 1, scene: { action: 'cook', seconds: 3.5 } } } },
    },
    kinds: { bag: { label: 'a bag', unit: 'bag', piece: 'prop:bag' } },
    makings: {
      tea: { label: 'night tea', pack: 'a tin of night tea', unit: 'tin', kind: 'ingredient', maker: 'kitchen', family: 'downer', effect: 'asleep', rarity: 'common',
        price: 8, at: 'park', keeper: 'npc:neighbour', spot: 'yard', piece: 'prop:tea-tin' },
      sticks: { label: 'rave sticks', pack: 'a box of rave sticks', unit: 'box', kind: 'ingredient', maker: 'kitchen', family: 'trip', effect: 'dancing', rarity: 'common',
        price: 10, at: 'park', keeper: 'npc:neighbour:2', spot: 'yard-sale', piece: 'prop:rave-sticks' },
    },
    families: { downer: 'blue', upper: 'red', trip: 'violet', mutagen: 'green' },
    products: {
      zonk: { name: 'Zonked', from: ['tea'] },
      'disco-rash': { name: 'Disco Rash', from: ['sticks'] },
      'disco-coma': { name: 'Disco Coma', from: ['tea', 'sticks'] },
    },
    rarities: ['common', 'rare', 'epic', 'grail'],
    effects: {
      asleep: { label: 'asleep', short: 'sleeps', hours: 3, part: 'legs', family: 'downer', person: { lift: true },
        words: 'asleep where they stand', look: { legs: 'asleep', overhead: 'zzz' } },
      // (bench-1: the dance's cover trimmed from "jumped half as often" to "a quarter less often", the orchestrator's call
      // the owner approved, "Go with your calls": crafting-discussion.md, 2026-11-19 night. RUN.md "The pot (pot-1)")
      dancing: { label: 'dancing', short: 'dances', hours: 2, part: 'legs', family: 'trip', place: { noTell: true, jumpPct: 75, heat: 1 },
        words: 'rainbow skin, cannot stop dancing', look: { skin: 'rainbow', legs: 'dance', crowd: true } },
      // (a dirty batch's bad thing, an effect like the rest, so the page can show it on a body: the owner's rule)
      pukes: { label: 'the Pukes', short: 'pukes', hours: 1, bad: true, words: 'throws up green', look: { trail: 'puke', overhead: 'sick' } },
    },
    outcomes: { clean: 84, dirty: 12, extra: 4, tired: 26 },
    dirty: { pukes: { effect: 'pukes', mood: 'sour', trust: -2, heat: 1, says: 'One bad thing rode along: the Pukes. The rest of that batch is the same' } },
    smell: { perCook: 1, max: 2, days: 2 },
    lift: { like: 'wallet', label: 'Lift the wallet off {who} while {they} sleeps', mark: 'lifted', trust: -2, pressure: { win: 1 }, scene: { action: 'hand_off', later: 'pickpocket_dip' } },
    names: { max: 24 },
    // the belt (the addition's G3.3): a made thing on you without being for sale, one of the kinds it takes
    belt: { label: 'your belt', takes: ['bag', 'bottle'], n: 1 },
  },

  // THE FIGHTS (duel-1, RUN.md "Fights"): when you cross somebody to their face and it goes wrong, they fight you there
  // and then, a one-on-one of the fight's own simulation (src/fight/duel.mjs), seeded from the run's own dice, and that
  // fight IS the outcome (no roll besides it). Nobody steers: both brawl (src/fight/brawl.mjs). Which events fight: a
  // job whose entry says `fight: 'fail'` (when it goes wrong; the trailer park's debt and wallet), and the regular at
  // your door who swings when you refuse (`door`). The market's jobs, getting jumped and the attempt on your crib stay
  // the contest's dice; a job is switched on by its flag alone.
  //   you: the box cutter if you own it (the fight's `blade`), else bare hands; `hits` scales the weapon's blows in a
  //     one-on-one. Your health: full energy (measured against the bed's `of`) is a full bar of `max`, none is
  //     `floorPct` of it, on a straight slope between; the energy before the hour.
  //   them: fists, and a toughness of their own (health): their role's `base` (else `ordinary`), give or take `spread`,
  //     seeded by the person's id, so the same person is always as tough. `hits` and `speed` theirs.
  //   hit: the percent of blows thrown that land (two thirds of it on one backing off fast). cap: the most seconds a
  //     fight lasts; at the cap the one with more health left wins. arena: the ground they have (m), and how far apart
  //     they square up. brawl: how they move (src/fight/brawl.mjs BRAWL).
  //   cost: the energy a fight costs, won or lost; it replaces a job's failEnergy (never both); never the clinic.
  //   A job fight lost is the job's failure as it is, with the fight's cost; won, the job pays as a win, but their trust,
  //     the heat and the pressure at home move as for a failure (it was a fight in the street); a job's `wonHeat`, if it
  //     has one, is the heat of a fight won instead of its failHeat (bigman-1: the docks' lift, +1 won, +2 lost). The door: lost is their
  //     win as the contest had it (their clean win, `hurt.clean`, while they have more than doorClean percent of their
  //     health left; else the scuffle's); won is their losing (nothing). The door's energy is the regular's `hurt`.
  //   sample: how many fights of its own each card's estimate plays ("you win about 6 in 10"), cached by the inputs.
  // Tuned with node scripts/duel-table.mjs (RUN.md, "Fights": its targets and the table).
  duel: {
    door: true,
    // (styles-1: `label` the words for it. The punch styles fight at about bare hands' own scale, 1.8, the study's; quick
    // hands at 1.6 (at 1.8 they won 92% fresh against a quick one of 55, over the duel table's 90) and the haymaker at
    // 1.7 (at 1.8 it won as much on average as the box cutter, at less than its price): RUN.md, the duel table)
    you: { hands: { weapon: 'hands', hits: 1.8, label: 'bare hands' }, cutter: { weapon: 'blade', hits: 1.45, label: 'box cutter' },
      jab: { weapon: 'jab', hits: 1.6, label: 'quick hands' }, haymaker: { weapon: 'haymaker', hits: 1.7, label: 'the haymaker' }, throw: { weapon: 'throw', hits: 1.8, label: 'the throw' } },
    hp: { max: 100, floorPct: 50, of: 10 },
    foe: { weapon: 'fists', hits: 2.0, speed: 3.2, ordinary: 55, spread: 5, base: { debtor: 64, mark: 52, buyer: 48, driver: 62 } },
    hit: 45, cap: 20, arena: { w: 8, h: 6, gap: 1.8 },
    brawl: { ready: 0.16, guard: 0.45, back: 0.85, circle: 0.55, turn: 1.6, centre: 1.6 },
    cost: { win: 1, lose: 2 },
    doorClean: 50,
    sample: 200,
    // (styles-1) SOMEBODY SENT: a visit come due from somebody not of your own street, or who keeps a shop or a stall, is
    // not them at your door but somebody they sent (the same rule and numbers: their toughness + memory.due.tougher, the
    // same pay-off), a plain tough whose style is rolled from the run's seed and who sent him, among `styles`
    sent: { roles: ['shopkeeper', 'stallholder'], styles: ['brawler', 'bigman', 'quick', 'knife', 'grabber'], pronoun: 'he' },
    // (styles-1) AFTER A LOSS, one line of what would have helped (rules.mjs fightAdvice): the best other thing of the
    // run, if it wins the same fight `margin` points more often
    advice: { margin: 10 },
  },

  // GETTING JUMPED, A FIGHT YOU WATCH (styles-1, RUN.md "Fights in the run: styles and getting jumped"): two at once, a
  // heavy and a runner (the arena's "jumped", src/fight/data.mjs STREET), on the run's own numbers, played where you
  // stand (src/fight/duel.mjs, `foes`, placed `around` you: [metres, degrees]). You bring what you fight with, fresh or
  // tired (`you`: your health in it, out of duel.hp.max: jumped, there is no time to be anything else); each of them is
  // `perStrength` tougher for every point of the tier's strength (the docks' +10).
  // The fight decides it: lost, the bad one (all you carry, and the clinic); a scrape, the scuffle (half): won with your
  // health at `scrape.won` percent or less (they had their hands in your pockets first), or lost with them at
  // `scrape.lost` percent of their health or less together (you hurt them: they grab half and run); won, nothing. What
  // it takes is the dice's (`jump.takePct`). Its chances are a
  // sample of `sample` fights at the same inputs (the bar's risk line, as a card's odds). Every number here is new, tuned
  // so that each tier and kit (bare hands, the box cutter; fresh and tired) ends as the contest's dice did, within 3
  // points (RUN.md: the table). Sleeping rough is still the dice (robbed asleep is no fight).
  jumped: {
    fight: true,
    name: 'two of them', says: 'two at once, a heavy and a runner',
    you: { fresh: 92, tired: 79 },
    foes: [
      { id: 'j1', kind: 'heavy', name: 'the heavy', weapon: 'fists', hp: 37, perStrength: 1.0, hits: 1.175, speed: 2.6, reel: 0.25 },
      { id: 'j2', kind: 'runner', name: 'the runner', weapon: 'shiv', hp: 22, perStrength: 0.1, hits: 1.95, speed: 4.3, reel: 0.38 },
    ],
    around: [[1.8, 0], [2.0, 130]],
    scrape: { won: 17, lost: 15 },
    cap: 20,
    sample: 3000,
  },

  // FIGHT WITH (styles-1, RUN.md "Fights in the run: styles and getting jumped"): what you fight with, one-on-one and
  // jumped, is one standing choice among what you own (`state.fightWith`: 'hands', 'cutter' or a punch style you know),
  // set any time you are not in a fight, for nothing. Unset (or no longer yours): the box cutter if you own it, else bare
  // hands, as before. THE PUNCH STYLES (src/fight/data.mjs PUNCHES): each learned once, for money (from what you carry),
  // and kept; each taught at ONE place, by one person of it (`keeper`, at `spot`), no hour. `does` is the card's line.
  // Prices near the box cutter's $90 (measured: RUN.md). (bigman-1: the throw was $50 for a day while a docks day held
  // one lift; with a fight won heating the docks +1, not +2, it is $80 again: back on day 5 with the lift at 60%, mark
  // P5, RUN.md "Low Tide Docks")
  styles: {
    jab: { label: 'quick hands', at: 'market', keeper: 'npc:buyer:market:2', spot: 'crowd', price: 70,
      does: 'Fast light blows: a quick one never gets set. Too light for a big man.' },
    haymaker: { label: 'the haymaker', at: 'park', keeper: 'npc:connect:projects', spot: 'truck', price: 80,
      does: 'One big slow swing that knocks them back: hit a grabber before he gets hold of you. Too slow for a quick one.' },
    throw: { label: 'the throw', at: 'docks', keeper: 'npc:foreman:docks', spot: 'pier', price: 80,
      does: "Puts them on the ground, and the ground doesn't care how big they are. A slippery one twists out of it." },
  },

  // PEOPLE REMEMBER (memory-1, RUN.md "People remember"): a BIG act leaves a MARK on a person that lasts `days` days (the
  // day it is made and the days after: gone on the morning of the day `days` after it), whatever the daily mood and
  // trust do (they drift as ever). One mark a person, the latest that counts: a fight, won or lost, always makes a new
  // one; robbing them to their face (a job's `mark`) or shutting the door on a regular (the grudge) only when they hold
  // none. What each KIND does is data, so later jobs add kinds (named to the police, saved, a friend for a week) here:
  //   fear: they give way: a job with `feared: 'sure'` done to them is sure and no fight (a debt is paid without a fight;
  //     a lift caught is still a fight), they never swing at your door, never tell on what you do (unless `tells`), never
  //     case your crib; they still count as against you at home, and each eases it by `fear.pressure`
  //   hates: no sales to them and no work from them: a job whose mood on a win is `friendly` is never dealt with them
  //   comesDue: when the mark runs out they are at your door that morning for another go (`due` below), warned the
  //     evening before
  //   tells: (with fear) they give way but still talk: robbed to their face, somebody against you still calls it in when
  //     about (silent, the market's stallholders robbed by its careful player stopped calling in its tills: it banked $3 a
  //     day more and marks 6, R2 and P1 fell out, measured: RUN.md "People remember")
  //   breaks: a fight you LOSE at a place ends every fear mark held by that place's people at once (and its winner
  //     holds a `beaten` mark: no fear of you from him for the week)
  //   words: the People line ("{left}": the days left, today included); gone: the notice when it runs out or breaks
  // `fear.pressure`: points each person who fears you takes off the pressure at home (0: none; a new number, tuned with
  // the styles: RUN.md "People remember").
  // DUE: the visit on the eighth day: a one-on-one at your door with him rested and ready, his toughness + `tougher`,
  // unless you pay him `price` (from banked) to call it square; his win hurts as the regular's at the door
  // (regulars.hurt). Warned at `warnHour` (or the night, if the day ends first). One visit a morning at your door: the
  // earliest due first, the others wait a day (an attempt on your crib is not a visit).
  memory: {
    days: 7,
    kinds: {
      beat: { fear: true, hates: true, comesDue: true, did: 'you beat {them} on day {day}', words: 'gives way for {left}', gone: "{Name} isn't scared of you any more" },
      robbed: { fear: true, tells: true, hates: true, comesDue: true, did: 'you robbed {them} to {their} face on day {day}', words: 'gives way for {left}', gone: "{Name} isn't scared of you any more" },
      beaten: { holds: true, did: '{they} beat you on day {day}', words: "won't give way to you for {left}", gone: "{Name} doesn't hold that fight over you any more" },
      // (sixes-1) two of the Sixes who jumped you and were seen off: they keep off you for the week, and do not come back for another go
      seenOff: { fear: true, hates: true, did: 'you saw {them} off on day {day}', words: 'keeps off you for {left}', gone: "{Name} isn't scared of you any more" },
      shut: { hates: true, did: 'you shut the door on {them} on day {day}', words: "won't buy from you for {left}", gone: '{Name} has let the door go' },
      // (pot-1) a buyer whose wallet you lifted while he slept on what you sold him: he knows who sold it (the plan, B9)
      lifted: { hates: true, did: 'you lifted {their} wallet while {they} slept on day {day}', words: "won't buy from you for {left}", gone: '{Name} has let it go' },
    },
    fear: { pressure: -1 },
    due: { tougher: 10, price: 20, warnHour: 18 },
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
  // always dealt first; two of the rest are drawn by the seeded dice from what you are able to do and who is left
  // (a selling job whose goods you carry is always one of the two: rules.mjs deal).
  // supply: what the player's actions draw down there and the morning refills, `refill` a morning up to `max`; it is
  // the place's, not the player's, so players sharing a city would draw on the same.
  places: {
    crib: { label: 'your crib', block: 'projects', spot: 'pad', home: true, inside: 'park' },
    park: {
      label: 'the trailer park', where: 'in the trailer park', block: 'projects', spot: 'street', tier: 'quiet', door: 'crib',
      onlySafe: 'only odd jobs',
      // (batch-1: every place is ONE ride from here; two rides is a dead place on 6 energy, measured: RUN.md "Low Tide Docks".
      // `late`: listed after every older move, so the keys of the moves before them stay as they were)
      links: { market: { via: 'subway' }, corner: { via: 'subway' }, docks: { via: 'subway', late: true }, plaza: { via: 'subway', late: true } },
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
        loosies: { label: 'Sell loose cigarettes at the bus stop', named: 'Sell loose cigarettes to {who} at the bus stop', madeNamed: 'Sell {what} to {who} at the bus stop', role: 'buyer', with: 'the bus stop', odds: 85, base: [8, 17], goods: { smokes: [8, 17] }, made: { common: [17, 25] }, mood: { win: 'friendly', fail: 'wary' }, trust: { win: 1, fail: 0 }, pressure: { win: 1, fail: 1 }, scene: { win: { kind: 'work:deal' }, fail: { kind: 'work:deal:dry' } } },
        wallet: { label: 'Lift a wallet at the bus stop', named: 'Lift a wallet off {who}', role: 'mark', with: 'a mark', odds: 60, base: [18, 30], failHeat: 1, fight: 'fail', mood: { win: 'unaware', fail: 'wary' }, trust: { win: 0, fail: -2 }, pressure: { win: 1, fail: 2 }, scene: { win: { action: 'hand_off', later: 'pickpocket_dip' }, fail: { action: 'hand_off', later: 'pickpocket_dip' } } },
        collect: { label: 'Collect a debt for Darlene at the office', named: 'Collect a debt from {who} for Darlene at the office', role: 'debtor', with: 'Darlene at the office', odds: 70, base: [14, 22], failEnergy: 2, fight: 'fail', mark: { win: 'robbed' }, feared: 'sure', mood: { win: 'sour', fail: 'wary' }, trust: { win: -1, fail: -2 }, pressure: { win: 1, fail: 1 }, scene: { win: { kind: 'collect:win' }, fail: { kind: 'collect:lose' } } },
      },
      // the page's locals (demo/run/scenes.js) where a role matches, and more people in the same id pattern. Four to
      // work, so a day here runs dry and sends you to the market (RUN.md, "People").
      people: [
        { id: 'npc:neighbour', name: 'Mrs. Alvarez', role: 'neighbour', pronoun: 'she', style: 'brawler' },
        { id: 'npc:neighbour:2', name: 'Mr. Pruitt', role: 'neighbour', pronoun: 'he', style: 'grabber' },
        { id: 'npc:neighbour:3', name: 'Gloria', role: 'neighbour', pronoun: 'she', style: 'brawler' },
        { id: 'npc:buyer:projects:1', name: 'Shaky Dee', role: 'buyer', regular: true, pronoun: 'he', style: 'quick' },
        { id: 'npc:mark:projects', name: 'a man at the bus stop', role: 'mark', pronoun: 'he', style: 'brawler' },
        { id: 'npc:mark:projects:2', name: 'a woman at the bus stop', role: 'mark', pronoun: 'she', style: 'quick' },
        { id: 'npc:debtor', name: 'Benny Two-Coats', role: 'debtor', pronoun: 'he', style: 'brawler' },
        { id: 'npc:connect:projects', name: 'Cousin Earl', role: 'connect', pronoun: 'he' }, // sells cartons out of his truck
      ],
    },
    market: {
      label: 'the Jay St night market', where: 'at the Jay St night market', block: 'market', spot: 'street', tier: 'rough',
      onlySafe: 'only the stall',
      links: { park: { via: 'subway' } },
      supply: { strangers: { max: 3, refill: 2 }, bins: { max: 4, refill: 4 } },
      connect: { who: 'npc:connect:market', spot: 'back-row' },
      shop: [
        { item: 'drink', label: 'An energy drink', kind: 'food', piece: 'prop:energy-can', price: 5, does: 'Energy +1: one more hour', perDay: 1, gives: { energy: 1 }, keeper: 'npc:shop:market', spot: 'cooler' },
      ],
      jobs: {
        stall: { label: 'Work a stall for the shopkeeper', named: 'Work a stall for {who}', role: 'shopkeeper', with: 'the shopkeeper', safe: true, odds: 100, base: [11, 15], mood: { win: 'friendly' }, trust: { win: 1 }, pressure: { win: -1 }, scene: { win: { action: 'haggle', spot: 'counter:shop' } } },
        crowd: { label: 'Sell to the crowd', named: 'Sell to {who} in the crowd', madeNamed: 'Sell {what} to {who} in the crowd', role: 'buyer', with: 'the crowd', odds: 75, base: [32, 48], goods: { discs: [32, 48], smokes: [30, 46] }, made: { common: [34, 50] }, failHeat: 1, mood: { win: 'friendly', fail: 'wary' }, trust: { win: 1, fail: 0 }, pressure: { win: 1, fail: 1 }, scene: { win: { kind: 'work:deal' }, fail: { kind: 'work:deal:dry' } } },
        wallet: { label: 'Lift a wallet in the crowd', named: 'Lift a wallet off {who}', role: 'mark', with: 'a mark', odds: 55, base: [30, 50], failHeat: 1, mood: { win: 'unaware', fail: 'wary' }, trust: { win: 0, fail: -2 }, pressure: { win: 1, fail: 2 }, scene: { win: { action: 'hand_off', later: 'pickpocket_dip' }, fail: { action: 'hand_off', later: 'pickpocket_dip' } } },
        till: { label: 'Grab a till', named: "Grab {who}'s till", role: 'stallholder', with: 'the shopkeeper', odds: 40, base: [60, 95], winHeat: 1, failHeat: 2, mark: { win: 'robbed' }, mood: { win: 'sour', fail: 'wary' }, trust: { win: -3, fail: -2 }, pressure: { win: 2, fail: 2 }, scene: { win: { action: 'grab', spot: 'counter:shop', later: 'till_grab' }, fail: { action: 'grab', spot: 'counter:shop', later: 'till_grab' } } },
        stickup: { label: 'A stick-up behind the stalls', named: 'Stick up {who} behind the stalls', role: 'stallholder', with: 'a stallholder', odds: 60, base: [50, 80], winHeat: 1, failHeat: 2, needs: 'cutter', mark: { win: 'robbed' }, mood: { win: 'sour', fail: 'wary' }, trust: { win: -3, fail: -2 }, pressure: { win: 2, fail: 2 }, scene: { win: { kind: 'rob:clean' }, fail: { kind: 'rob:fail' } } },
      },
      // seven to work, so it lasts; the third stallholder keeps ignoring heat the worst way to play (RUN.md)
      people: [
        { id: 'npc:shop:market', name: 'Mrs. Bao', role: 'shopkeeper', pronoun: 'she', style: 'brawler' },
        { id: 'npc:shop:market:2', name: 'Mr. Ferraro', role: 'shopkeeper', pronoun: 'he', style: 'brawler' },
        { id: 'npc:buyer:market:1', name: 'Lola', role: 'buyer', pronoun: 'she', style: 'quick' },
        { id: 'npc:buyer:market:2', name: 'Pockets', role: 'buyer', pronoun: 'he', style: 'quick' },
        // (goods-1: two more buyers in the crowd, so carrying more can sell more: RUN.md, "Goods, the connect and errands")
        { id: 'npc:buyer:market:3', name: 'Tiny', role: 'buyer', pronoun: 'he', style: 'bigman' },
        { id: 'npc:buyer:market:4', name: 'a man with a shopping cart', role: 'buyer', pronoun: 'he', style: 'brawler' },
        { id: 'npc:mark:market', name: 'a woman in the crowd', role: 'mark', pronoun: 'she', style: 'quick' },
        { id: 'npc:mark:market:2', name: 'a man with a camera', role: 'mark', pronoun: 'he', style: 'brawler' },
        { id: 'npc:stallholder', name: 'a stallholder', role: 'stallholder', pronoun: 'they', style: 'brawler' },
        { id: 'npc:stallholder:2', name: 'Mr. Okafor', role: 'stallholder', pronoun: 'he', style: 'grabber' },
        { id: 'npc:stallholder:3', name: 'Mrs. Kowalski', role: 'stallholder', pronoun: 'she', style: 'brawler' }, // (and the clothes rail)
        { id: 'npc:connect:market', name: 'Teo', role: 'connect', pronoun: 'he', style: 'knife' }, // sells bootleg discs from a duffel in the back row
        // (sixes-1) THE SIXES at their market: Dutch, their eyes on the stalls (she carries a blade), and the two who are
        // waiting by the steps when the meter says so. No job is done to them (their role is no job's)
        { id: 'npc:sixes:dutch', name: 'Dutch', role: 'sixes', pronoun: 'she', style: 'knife' },
        { id: 'npc:sixes:heavy', name: 'a heavy of the Sixes', role: 'sixes', pronoun: 'he', style: 'brawler' },
        { id: 'npc:sixes:runner', name: 'a runner of the Sixes', role: 'sixes', pronoun: 'he', style: 'quick' },
      ],
    },
    // LOW TIDE DOCKS (batch-1, RUN.md "Low Tide Docks"): the third place. Tougher people and honest money: the mean tier
    // (pay × 3, the jumpers 1.5 × as often and 10 stronger, patrolled), a shift that pays more than the market's stall,
    // and one crime, a box off a semi, done to the driver's face (a fight when it goes wrong). No connect, no drug good:
    // the honest and the thief's way to earn (the owner: "I don't want drugs to be the only path to earn money"). One
    // subway ride from the trailer park (LOW TIDE station), and only from there.
    docks: {
      label: 'Low Tide Docks', where: 'on the docks', block: 'docks', spot: 'street', tier: 'mean',
      onlySafe: 'only the shift',
      links: { park: { via: 'subway' } },
      supply: { strangers: { max: 2, refill: 1 }, bins: { max: 2, refill: 1 } },
      shop: [],
      jobs: {
        shift: { label: 'Haul a shift for the foreman', named: 'Haul a shift for {who}', role: 'foreman', with: 'the foreman', safe: true, odds: 100, base: [10, 13], mood: { win: 'friendly' }, trust: { win: 1 }, scene: { win: { action: 'carry', spot: 'pier' } } },
        lift: { label: "Lift a box off a driver's semi", named: "Lift a box off {who}'s semi", role: 'driver', with: 'a driver', odds: 60, base: [28, 47], failHeat: 2, wonHeat: 1, fight: 'fail', mood: { win: 'unaware', fail: 'wary' }, trust: { win: 0, fail: -2 }, scene: { win: { action: 'grab' }, fail: { action: 'grab' } } },
      },
      people: [
        { id: 'npc:foreman:docks', name: 'Mr. Haines', role: 'foreman', pronoun: 'he', style: 'grabber' },
        { id: 'npc:foreman:docks:2', name: 'Rosa', role: 'foreman', pronoun: 'she', style: 'brawler' },
        // (bigman-1: Big Lou is a big man, the throw's natural use, taught on the same pier; Nadia a plain brawler, so a new
        // player still has a truck to lift from. RUN.md "Low Tide Docks")
        { id: 'npc:driver:docks', name: 'Big Lou', role: 'driver', pronoun: 'he', style: 'bigman' },
        { id: 'npc:driver:docks:2', name: 'Nadia Petrakis', role: 'driver', pronoun: 'she', style: 'brawler' },
      ],
    },
    // GLASSWALL PLAZA (batch-1, RUN.md "Glasswall Plaza"): the fourth place, where the danger is the police, not the
    // jumpers (the `watched` tier). Flyers for Vic Amato, a wallet off the office crowd, a phone snatched. Nobody here
    // fights you: a job gone wrong brings the police (heat), not fists. One ride from the trailer park (1ST ST station).
    plaza: {
      label: 'Glasswall Plaza', where: 'on the plaza', block: 'uptown', spot: 'street', tier: 'watched',
      onlySafe: 'only the flyers',
      links: { park: { via: 'subway' } },
      supply: { strangers: { max: 2, refill: 1 }, bins: { max: 2, refill: 1 } },
      shop: [],
      jobs: {
        flyers: { label: 'Hand out flyers', named: 'Hand out flyers for {who}', role: 'boss', with: 'the flyers man', safe: true, odds: 100, base: [10, 13], mood: { win: 'friendly' }, trust: { win: 1 }, scene: { win: { action: 'hand_off', spot: 'counter:shop' } } },
        wallet: { label: 'Lift a wallet off an office worker', named: 'Lift a wallet off {who}', role: 'office', with: 'a mark', odds: 55, base: [30, 50], failHeat: 1, mood: { win: 'unaware', fail: 'wary' }, trust: { win: 0, fail: -2 }, scene: { win: { action: 'hand_off', later: 'pickpocket_dip' }, fail: { action: 'hand_off', later: 'pickpocket_dip' } } },
        phone: { label: 'Snatch a phone on the plaza', named: "Snatch {who}'s phone", role: 'office', with: 'an office worker', odds: 45, base: [40, 60], winHeat: 1, failHeat: 2, mood: { win: 'sour', fail: 'wary' }, trust: { win: -3, fail: -2 }, scene: { win: { action: 'grab' }, fail: { action: 'shove' } } },
      },
      people: [
        { id: 'npc:boss:plaza', name: 'Vic Amato', role: 'boss', pronoun: 'he', style: 'brawler' },
        { id: 'npc:office:plaza', name: 'a man in a lanyard', role: 'office', pronoun: 'he', style: 'brawler' },
        { id: 'npc:office:plaza:2', name: 'a woman on two phones', role: 'office', pronoun: 'she', style: 'quick' },
        { id: 'npc:office:plaza:3', name: 'a man with a coffee', role: 'office', pronoun: 'he', style: 'brawler' },
      ],
    },
    corner: { label: 'the corner', block: 'corner', spot: 'street', tier: 'mean', locked: 'held by the Sixes' },
    clinic: { label: 'the clinic', held: 'clinic' },
    jail: { label: 'the jail', held: 'jail' },
  },
  subwayStops: ['park', 'market', 'docks', 'plaza', 'corner'], // the line as the map shows it; the corner is locked

  // the city's one roll formula and its four bands, unchanged (src/contest.mjs)
  contest: CONFIG.contest,

  // (bench-1, RUN.md "The bench and the bottle (bench-1)") THE BENCH IS OFF ON THE PAGE until its screens exist: the
  // config the page plays (RUN_CONFIG) has none of BENCH below, so nothing of it is sold, listed, thrown or drawn there.
  // `withRunConfig({ bench: true })` (BENCH_CONFIG, the rules' tests and the marks) has all of it. The screens' builder
  // turns it on by setting this true.
  bench: false,
};

/**
 * (bench-1, RUN.md "The bench and the bottle (bench-1)") THE BENCH AND THE BOTTLE: build step 2 of crafting, the
 * addition's slice 2 (crafting-plan-addendum.md B3, Part C, Part E). Read by make.mjs, rules.mjs (the throw's odds) and
 * step.mjs. One more maker, its fillings one more kind of making, its bottle one more kind of made thing, a bag from the
 * kitchen one more thing it takes; a home piece that stands on the floor spot; the dye pack given its job.
 *   things.workbench: the bench's station, $60 from Mr. Pruitt. `floor`: it stands on the trailer's one floor spot
 *     (approved decision 8: the stove or the bench; both can be owned, one stands, an hour to change; the hot plate is a
 *     counter piece and never leaves). Knocked out by a raid as the hot plate is.
 *   things.dyepack: the home kit's dye pack (drawn, with no job before): in your floor safe (`needs`), whoever gets into
 *     the safe comes out blue (`tags`). Spent when it goes off.
 *   make.makers.bench: the bottle takes one or two fillings, or one bag alone (`alone`); three come out, an hour, no smell
 *     (`smells: false`), no batch odds (packing is a clamp and a funnel, not chemistry: it comes out as packed).
 *   make.effects: blind and tagged, and what each effect does in a fight (`fight`: the plan's fixed sizes, B11) and says
 *     on a bottle (`inBottle`).
 *   make.bottle: the fights it is thrown in (`fights`: several of them, never a one-on-one), the heat of a cloud that changes
 *     the fight where the police are about (paint alone: none), and the blue man (`blue`: how long, what taking it back gets you, its heat).
 *   memory.kinds is untouched: a blue man is a row of who is under what (effects.mjs), not a mark.
 */
const BENCH = {
  things: {
    workbench: { label: 'a workbench', kind: 'home', piece: 'kit:tool-bench', desc: 'a heavy bench with a vice on one end and a pegboard of tools over it', late: 'bench', price: 60, at: 'park', keeper: 'npc:neighbour:2', spot: 'yard-sale', inTrailer: 'floor-spot',
      floor: true, station: 'bench', raid: { out: 1, pct: 50 }, does: 'Pack bottles at your crib: an hour, three bottles', job: 'At your crib, an hour: dog spray, blue paint or a bag from the kitchen into three bottles. It stands on the floor spot' },
    dyepack: { label: 'a dye pack', kind: 'home', piece: 'kit:dye-pack', desc: 'a fat bundle of notes with a dye charge hidden in it, for the safe', late: 'bench', price: 30, at: 'market', keeper: 'npc:stallholder:2', spot: 'stall:6', inTrailer: 'under-the-counter',
      needs: 'floorsafe', tags: true, does: 'Whoever gets into your safe comes out blue', job: 'In your floor safe: whoever gets into the safe comes out bright blue for a week, and is at his usual place all week, where you can take it back off him. It goes off once' },
  },
  make: {
    makers: {
      bench: { label: 'the bench', station: 'workbench', smells: false, outcomes: false, verb: 'Pack',
        carriers: { bottle: { label: 'a bottle', takes: ['filling', 'bag'], slots: 2, alone: ['bag'], gives: 'bottle', n: 3, hours: 1, scene: { action: 'bench_clamp', seconds: 3.5 } } } },
    },
    kinds: { bottle: { label: 'a bottle', unit: 'bottle', piece: 'prop:bottle', sold: false } },
    makings: {
      spraycan: { label: 'dog spray', pack: 'a can of dog spray', unit: 'can', kind: 'filling', maker: 'bench', family: 'sting', effect: 'blind', rarity: 'common',
        price: 8, at: 'park', keeper: 'npc:connect:projects', spot: 'truck', piece: 'prop:spray-can', does: 'In a bottle: all of them blind 3 seconds' },
      painttin: { label: 'blue paint', pack: 'a tin of blue paint', unit: 'tin', kind: 'filling', maker: 'bench', family: 'dye', effect: 'tagged', rarity: 'common',
        price: 5, at: 'park', keeper: 'npc:neighbour:2', spot: 'yard-sale', piece: 'prop:paint-tin', does: 'In a bottle: all of them blue for a week' },
    },
    families: { sting: 'orange', dye: 'blue' },
    products: {
      spray: { name: 'Dog Spray', from: ['spraycan'] },
      paint: { name: 'Blue Paint', from: ['painttin'] },
      'spray-paint': { name: 'Dog Spray and Blue Paint', from: ['painttin', 'spraycan'] },
      // (a bag from the kitchen in a bottle: its own effect, lightly, in the plan's fixed sizes; named after the bag)
      'zonk-bottle': { bag: 'zonk' },
      'disco-rash-bottle': { bag: 'disco-rash' },
      'disco-coma-bottle': { bag: 'disco-coma' },
    },
    effects: {
      blind: { label: 'blind', short: 'blind', hours: 0, part: 'eyes', family: 'sting', fight: { blind: 3 }, words: 'blind, hands over their eyes', inBottle: 'All of them blind 3 seconds: no blow, half speed',
        look: { overhead: 'stars', legs: 'stumble' } },
      tagged: { label: 'blue', short: 'blue', hours: 168, part: 'skin', family: 'dye', person: { tagged: true }, words: 'bright blue all over, for a week', inBottle: 'All of them blue for a week',
        look: { skin: 'blue' } },
      // (the kitchen's, in a bottle, at half the plan's fixed sizes: asleep 3 s, not 6; dancing 4 s, not 6 (bench-1's B1,
      // the orchestrator's call: inside the box cutter's lift, so a kitchen bag is never the best weapon on the street))
      asleep: { fight: { asleep: { n: 1, s: 3 } }, inBottle: 'The first of them asleep 3 seconds' },
      dancing: { fight: { slow: { s: 4, by: 0.5 } }, inBottle: 'All of them dancing 4 seconds: half speed' },
    },
    // (bench-1, the orchestrator's calls on B3: a cloud is news only when it changes the fight (`heat`: dog spray, a bag;
    // a splash of paint is not); taking it back gets ALL of what he took (`back` 100: never more, so being jumped never pays))
    bottle: {
      fights: ['jumped', 'crew', 'sixes'],
      heat: 1,
      blue: { days: 7, back: 100, heat: 1, label: 'Take it back off {who}' },
    },
  },
};

const scale = (range, by) => range.map(x => Math.round(x * by));

/**
 * (pot-1) THE GOODS MAKING BRINGS: every making (an ingredient) and every product as a good of `goods` (so a bag is on you
 * or at the crib, sold through the selling jobs, taken by a jump and seized by the police as any good is), and each
 * product's dirty batch as a good of its own (`<product>~<bad thing>`, "zonk~pukes": its bad thing in `dirty`): the rules show it as its
 * product until it is found out (make.mjs). A making has no `at` (no connect sells it: its seller is make.makings'); a
 * product costs what its makings cost, over the bags a batch gives. Listed after the bought goods, so their order stays.
 */
function madeGoods(raw) {
  const M = raw.make;
  if (!M) return {};
  const out = {};
  for (const [id, m] of Object.entries(M.makings ?? {})) {
    out[id] = { label: m.label, pack: m.pack, unit: m.unit ?? 'one', price: m.price, sales: 1, making: true, kind: m.kind, maker: m.maker, piece: m.piece ?? null };
  }
  const rank = r => (M.rarities ?? []).indexOf(r);
  for (const [id, p] of Object.entries(M.products ?? {})) {
    // (bench-1: a bag from the kitchen in a bottle: its carrier the one that takes bags, three bottles from one bag, at
    // the bag's cost; named after the bag ("Zonked in a bottle"); never sold: no selling job takes a bottle)
    if (p.bag) {
      const B = out[p.bag];
      const [mk, C] = Object.entries(M.makers).flatMap(([m, x]) => Object.values(x.carriers).map(c => [m, c])).find(([, c]) => c.takes.includes(B.kind));
      const kind = M.kinds[C.gives];
      out[id] = { label: `${B.label} in a ${kind?.unit ?? 'bottle'}`, unit: kind?.unit ?? 'one', price: B.price / B.sales, sales: C.n, made: true, kind: C.gives, maker: mk, product: id, bag: p.bag, rarity: B.rarity, piece: `prop:${C.gives}-${p.bag}`, ...(kind?.sold === false ? { sold: false } : {}) };
      continue;
    }
    const makings = p.from.map(k => M.makings[k]);
    const maker = makings[0].maker;
    const C = Object.values(M.makers[maker].carriers).find(c => c.takes.includes(makings[0].kind));
    const rarity = makings.map(m => m.rarity).reduce((a, b) => (rank(b) > rank(a) ? b : a));
    const kind = M.kinds[C.gives];
    const good = { label: p.name, unit: kind?.unit ?? 'one', price: makings.reduce((a, m) => a + m.price, 0), sales: C.n, made: true, kind: C.gives, maker, product: id, rarity, piece: `prop:${C.gives}-${id}`, ...(kind?.sold === false ? { sold: false } : {}) };
    out[id] = good;
    // (bench-1: a bottle comes out as packed: no dirty batch of it)
    if (kind?.sold !== false) for (const d of Object.keys(M.dirty ?? {})) out[`${id}~${d}`] = { ...good, dirty: d, clean: id };
  }
  return out;
}

/**
 * The config the rules read: each place's jobs with their pay in dollars (base × the tier's pay), and `jobs` and
 * `people` at the top as copies of the places' own. A job given `pay` and no `base` keeps its pay as it is.
 */
function resolve(raw0) {
  // (pot-1) the goods making brings, after the bought ones; a selling job's `made` (what a made thing of each rarity pays
  // there) becomes a line of its `goods` for every made good of that rarity, so the selling machinery reads them as any good
  const made = madeGoods(raw0);
  const raw = Object.keys(made).length ? { ...raw0, goods: { ...raw0.goods, ...Object.fromEntries(Object.entries(made).filter(([k]) => !raw0.goods?.[k])) } } : raw0;
  // (bench-1: a made thing never sold, a bottle, is no line of any selling job)
  const withMade = j => (j.made ? { ...j, goods: { ...(j.goods ?? {}), ...Object.fromEntries(Object.entries(made).filter(([, g]) => g.made && g.sold !== false && j.made[g.rarity]).map(([k, g]) => [k, j.made[g.rarity]])) } } : j);
  const places = {};
  for (const [id, p] of Object.entries(raw.places)) {
    const tier = p.tier ? raw.tiers[p.tier] : null;
    if (p.tier && !tier) throw new Error(`place ${id}: no tier ${p.tier}`);
    if (!p.jobs) { places[id] = p; continue; }
    const by = tier?.pay ?? 1;
    // a selling job's goods: what each pays there in dollars (base × the tier's pay), as `goodsPay`
    const jobs = Object.fromEntries(Object.entries(p.jobs).map(([jid, j0]) => [jid, withMade(j0)]).map(([jid, j]) => [jid, Object.freeze({ ...j, pay: j.base ? scale(j.base, by) : j.pay,
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
  // (bench-1: `bench: true` brings the bench and the bottle in, under whatever else the overrides change)
  if (o.bench === true && !base.make?.makers?.bench) base = withConfig(BENCH, base);
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

/** (bench-1) The rules with the bench and the bottle in: what the tests and the marks play until the page has its screens. */
export const BENCH_CONFIG = withRunConfig({ bench: true });
