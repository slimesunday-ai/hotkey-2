// THE RUN ACTED OUT: how each thing the run's engine says happened is played with the stage's own scenes (RUN.md,
// "What it reuses": the "Plays as" table). THE ONE PLACE this mapping lives, the stand-ins for the clips this copy's
// pinned city lacks included. Each event of src/run/step.mjs carries a `scene` hint from the same table; this file
// turns it into src/stage.mjs events (an existing kind, its steps made by buildStage, or a short one of the run's own
// made of the same actions), with the locals each one needs (demo/run/scenes.js).
import { buildStage } from '../../src/stage.mjs';
import { RUN_CONFIG } from '../../src/run/index.mjs';
import { YOU, endOf, CARD_WITH, PATROL } from './scenes.js';
import { STAND, STAND_CLOSE } from '../stage/hands/deals.js';
import { kitKind, handHeld } from '../stage/hands/things.js';
import { pieceOf } from '../../src/run/library.mjs';

/** The player's own porch, at the trailer's door (the place table's home spots: places.json projects.spots). */
/** (anim-1) `?deals=old`: the pack's purchase and the bins as they were before they were performed (to film the before). */
const OLD_DEALS = typeof location !== 'undefined' && new URLSearchParams(location.search).get('deals') === 'old';
export const DOOR = `home:${YOU}:door`;
/** The foot of the player's step, where a regular stands to ask (index.js doorAt). */
export const STEP = `home:${YOU}:step`;
/** Where the player's pad meets the lane (home-1: where somebody casing the crib loiters, and comes in from). */
export const FRONT = `home:${YOU}:front`;
/**
 * THE PORCH'S OWN PLACES (home-1), each apart from the others and from the player's way in and out of his door (door,
 * step, the lane): whoever comes for the crib (casing it, waiting, at the door) stands south-west of the step, VISIT;
 * Cousin Earl keeps his post east of the door, POST. index.js says both from the trailer's own door.
 */
export const VISIT = `porch:${YOU}:visit`;
export const POST = `porch:${YOU}:post`;
/** Where whoever comes waits while the notice is up, off the player's way home (home-1: index.js porch). */
export const WAIT = `porch:${YOU}:wait`;
/** Where they wait while Cousin Earl is on, on his side of the door (home-1). */
export const WAIT_EAST = `porch:${YOU}:wait-east`;
/** The player's yard (home-1: where Cousin Earl stands while a regular has the step). */
export const YARD = `home:${YOU}:yard`;
/** Cousin Earl, the guard of home-1 (src/run/config.mjs `guard.who`): the stage's own person for him. */
export const GUARD = RUN_CONFIG.guard?.who ?? 'npc:connect:projects';
/** WHO COMES FOR THE CRIB, as the stage casts them (home-1): a person of the trailer park as themselves; "somebody nobody here knows" (config pressure.stranger) is one of ours in the crowd's plain clothes, an extra (scenes.js LOCALS `npc:caser`). */
export const homeWho = id => (!id ? null : id === RUN_CONFIG.pressure?.stranger?.id ? 'npc:caser' : id);

/**
 * CLIPS THE RUN WANTS THAT THIS COPY'S PINNED CITY DOES NOT HAVE, and what plays instead until the city is re-pinned
 * (RUN.md: "`pickpocket_dip` once the city is re-pinned; `hand_off` until then"). Each value is an action of
 * src/stage.mjs ACTIONS; null is "no clip of its own": the turnstile is the plain subway ride. Swap them here.
 */
export const STAND_INS = Object.freeze({ pickpocket_dip: 'hand_off', till_grab: 'grab', turnstile_hop: null });
const LIFT = STAND_INS.pickpocket_dip;
/** (stage 2) A pocket picked, performed (deals.js lift): stood closer than a deal, a hand to his hip; `felt`, he has it back. */
const DIP = felt => ['agent', 'hand_off', 'mark', null, null, { deal: 'lift', roles: { buyer: 'actor', seller: 'target' }, felt, stand: STAND_CLOSE, gap: 2 * STAND_CLOSE }];
const TILL = STAND_INS.till_grab;

// ── the scenes ──────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * A stage event: an existing kind of src/stage.mjs (its steps made by buildStage), or one of the run's own made of
 * the same actions (`steps`, in the same [role, action, target?, spot?] form). `big` gives an attack its room.
 */
function scene(kind, block, who, { spot = 'street', lists = {}, steps = null, big = null } = {}) {
  const event = { kind, t: 0, block, spot, who, lists: { bystanders: [], ...lists }, data: {}, big: big ?? false };
  if (!steps) {
    event.stage = buildStage(event);
    event.big = big ?? /^(rob|npc:robbers|arrest|collect)/.test(kind);
    return event;
  }
  const out = [];
  for (const [role, action, target, at, clip, perform] of steps) {
    const actor = who[role];
    if (!actor) continue;
    const s = { actor, action };
    if (target && who[target]) s.target = who[target];
    if (at) s.spot = at;
    // (a clip of the city's named outright: the work of an odd job, a shelf stocked, a look about. director-plan.js)
    if (clip) s.clip = clip;
    // (anim-1: performed on hand-posed bodies, not played from a clip: demo/stage/hands/deals.js)
    if (perform) s.perform = perform;
    out.push(s);
  }
  event.stage = { t: 0, block, spot, steps: out };
  return event;
}

// The run's own short scenes, from the city's clips (RUN.md "Plays as"). EVERY ONE ENDS IN A REACTION, NOT IN IDLING
// (the owner: "like i just shake the neighbors hand and that's it, then walk up and collect debt"): whoever it was done
// to or with is changed by it, and it shows (the mark over their head, demo/run/index.js; leaving for the day or
// standing apart to watch, demo/run/scenes.js). And no two jobs end in the same hand-over:
//   an odd job is WORK, each neighbour's own (the boxes carried, the hammer, the broom), and a nod of thanks;
//   a stall shift is WORK AT THE STALL (the owner: "i work a stall i just shake her had, no animation of me going to
//   the stall and doing anything"): he walks over to it and works it, serving at the counter, stocking, sweeping,
//   mopping, carrying, and not the same every shift; then a nod of thanks;
//   a sale is a buyer served who nods and walks off with it;
//   a debt is PRESSURE: walked up on and crowded first; paid, he hands it over and storms off; refused, he shoves you
//   off and stands his ground, watching;
//   a lift is the player walking up to the mark where they stand: one that works is nothing at first; a few steps on
//   the mark pats their pockets and looks about; one that fails, the mark turns on you and points, and stays;
//   THE JUMPING ENDS FOR EVERY OUTCOME (the owner: "i hit him and he just vanishes, if i won why didnt he fall to the
//   ground?"): seen off, the one you hit goes down, stays down a moment while the other comes to him, gets up, and
//   both run; taken from you, they run off with it. Either way they run on out of the picture (director.js dismiss).
const WORK = {
  'npc:neighbour': ['carry', 'carry_box'],
  'npc:neighbour:2': ['build', 'bench_hammer'],
  'npc:neighbour:3': ['build', 'sweep'],
};
// A stall shift's work, by the shift (the city's work, cleaners and errands clips: [action, clip])
// (ONE piece of work a shift: with two, the safest job in the game, the one picked most, took 30 s to watch at 1x
// (15.5 s wall at speed 2, measured 2026-11-13), three times any other hour. The variety is across shifts)
const SHIFTS = [
  [['haggle', 'haggle_counter']],
  [['build', 'stock_shelf']],
  [['carry', 'carry_box']],
  [['build', 'sweep']],
  [['build', 'mop']],
];
// THE PLAYER GOES TO THEM (the owner, 2026-11-14: "when you rob someone the npc comes up to you which is weird, you
// should go up to them"; and of the park: the jobs happen where the person is, at their own trailer, at the bus
// stop). Every job starts with the player walking up to whoever it is done to or with, where they stand (the scene
// is where its first step's target is: director.js sceneAt); what follows plays from there. A buyer still comes up
// to a seller: that is how a sale goes.
/**
 * (styles-1) SOMEBODY SENT to your door for another go by somebody not of your street (or who keeps a shop or a stall):
 * one of the stage's own toughs stands there for him (the market's robber, Mick Dunn: no new person).
 */
export const SENT = 'npc:robber1';
// (sixes-1) THE SIXES ON THE STAGE: Dutch, at their market; the two who wait by the steps (the jumped fight's pair,
// their own people in the Sixes' green rag and grey hoodie); a crew's friend at your door (the one who cased it is the
// first; the stage's tough Lyle Dunn stands for the friend)
export const DUTCH = RUN_CONFIG.sixes?.dutch ?? 'npc:sixes:dutch';
export const SIXES_TWO = RUN_CONFIG.sixes?.jumpers ?? ['npc:sixes:heavy', 'npc:sixes:runner'];
export const CREW_FRIEND = 'npc:robber2';

// (anim-1, the hands, stage 2) PAID FOR IT: the one who pays (`by`) hands the money to the player where they stand, and
// he puts it away (deals.js pay; `count`: whoever is paid weighs it first). Every job of work ends on it now, a nod was
// all it was. And the player paying somebody (`to`): Dutch her fifth, Cousin Earl his three days, the regular at the door
const PAID = (by, count = false) => ['agent', 'hand_off', by, null, null, { deal: 'pay', roles: { buyer: 'target', seller: 'actor' }, keeps: 'buyer', count, gap: 2 * STAND }];
const PAYS = (to, count = false) => ['agent', 'hand_off', to, null, null, { deal: 'pay', roles: { buyer: 'actor', seller: 'target' }, count, gap: 2 * STAND }];
const OWN = {
  odd: work => [['agent', 'walk', 'neighbour'], ['neighbour', 'talk', 'agent'], ['agent', work[0], null, null, work[1]], ...(work[0] === 'build' ? [['agent', work[0], null, null, work[1]]] : []), ...(OLD_DEALS ? [['neighbour', 'listen', 'agent']] : [PAID('neighbour')])],
  sale: [['buyer', 'approach', 'dealer'], ['dealer', 'hand_off', 'buyer'], ['buyer', 'listen', 'dealer'], ['buyer', 'walk']],
  saleFail: [['buyer', 'approach', 'dealer'], ['dealer', 'talk', 'buyer'], ['buyer', 'deal', null, null, 'deal_lookout']],
  // (the loose cigarettes are sold AT THE BUS STOP, where Shaky Dee keeps: the player goes to him there)
  saleAt: [['dealer', 'walk', 'buyer'], ['dealer', 'hand_off', 'buyer'], ['buyer', 'listen', 'dealer'], ['buyer', 'walk']],
  saleAtFail: [['dealer', 'walk', 'buyer'], ['dealer', 'talk', 'buyer'], ['buyer', 'deal', null, null, 'deal_lookout']],
  lift: [['agent', 'walk', 'mark'], OLD_DEALS ? ['agent', LIFT, 'mark'] : DIP(false), ['mark', 'walk'], ['mark', 'pat_down'], ['mark', 'deal', null, null, 'deal_lookout']],
  liftFail: [['agent', 'walk', 'mark'], OLD_DEALS ? ['agent', LIFT, 'mark'] : DIP(true), ['mark', 'hands_up'], ['agent', 'walk']],
  // (stage 2: A STICK-UP with the box cutter, performed: deals.js stickup. Paid, off at a run; not, shoved off, away)
  // (hands-2: `victim`, so the one stuck up is stood on open ground for it, as an attack's victim is: director.js victimsOf)
  stickup: win => [['agent', 'walk', 'mark'], ['agent', 'hand_off', 'mark', null, null, { deal: 'stickup', roles: { buyer: 'actor', seller: 'target' }, win, victim: true, gap: 2 * STAND }], ['agent', win ? 'run' : 'walk']],
  // (stage 2: bought and used there and then: deals.js buyUse; a lesson: paid, shown, done after him: deals.js lesson)
  buyUse: goods => [['agent', 'walk', 'shop'], ['shop', 'hand_off', 'agent', null, null, { deal: 'buyUse', roles: { seller: 'actor', buyer: 'target' }, goods, gap: 2 * STAND }]],
  lesson: style => [['agent', 'walk', 'shop'], ['shop', 'hand_off', 'agent', null, null, { deal: 'lesson', roles: { seller: 'actor', buyer: 'target' }, style, gap: 2 * STAND }]],
  // (hands-2: a thing to wear, paid for, handed over and PUT ON: from that moment he wears it. deals.js buyWear)
  buyWear: ({ goods, slot, wear }) => [['agent', 'walk', 'shop'], ['shop', 'hand_off', 'agent', null, null, { deal: 'buyWear', roles: { seller: 'actor', buyer: 'target' }, goods, slot, on: !!wear, wear, gap: 2 * STAND }]],
  // (stage 2: Gloria's dog: paid for, and he comes round her to you; then he follows you home: perform.js, `dog`)
  buyDog: [['agent', 'walk', 'shop'], ['shop', 'hand_off', 'agent', null, null, { deal: 'pay', roles: { buyer: 'target', seller: 'actor' }, dog: true, gap: 2 * STAND }]],
  // (stage 2: he digs it out and pays you, and you count it: it is Darlene's)
  debt: [['agent', 'walk', 'debtor'], ['agent', 'shove', 'debtor'], ['debtor', 'hands_up'], OLD_DEALS ? ['debtor', 'hand_off', 'agent'] : PAID('debtor', true), ['debtor', 'walk']],
  debtFail: [['agent', 'walk', 'debtor'], ['agent', 'talk', 'debtor'], ['debtor', 'shove', 'agent'], ['agent', 'stumble'], ['debtor', 'deal', null, null, 'deal_lookout']],
  // (duel-1: GONE WRONG TO THEIR FACE, IT IS A FIGHT. These are only its start, up to the first move of it; the fight
  // itself is the page's (demo/run/duel.js), the very one the rules fought, and it ends with the loser down and up)
  // a debt refused: he will not pay and shoves you off, and it is on
  debtFight: [['agent', 'walk', 'debtor'], ['agent', 'talk', 'debtor'], ['debtor', 'shove', 'agent'], ['agent', 'stumble']],
  // a lift caught: the mark turns on you and shoves you off
  liftFight: [['agent', 'walk', 'mark'], ['agent', LIFT, 'mark'], ['mark', 'shove', 'agent'], ['agent', 'stumble']],
  // (told what to do, he steps along the stall to do it: the work, a mop or a broom going, a head and more from the keeper)
  stall: shift => [['agent', 'walk', 'shop'], ['shop', 'talk', 'agent'], ['agent', 'walk'], ...shift.map(([action, clip]) => ['agent', action, null, null, clip]), OLD_DEALS ? ['shop', 'listen', 'agent'] : PAID('shop')],
  till: [['agent', TILL, 'shop'], ['shop', 'hands_up'], ['agent', 'run']],
  tillFail: [['agent', TILL, 'shop'], ['shop', 'shove', 'agent'], ['agent', 'stumble']],
  jumpFail: [['robber1', 'run', 'target'], ['robber1', 'grab', 'target'], ['target', 'punch', 'robber1'], ['robber1', 'fall'], ['robber2', 'run', 'robber1'], ['robber1', 'get_up'], ['robber1', 'flee'], ['robber2', 'flee']],
  jumpMessy: [['robber1', 'run', 'target'], ['robber1', 'grab', 'target'], ['target', 'scuffle', 'robber1'], ['robber2', 'punch', 'target'], ['target', 'stumble'], ['robber1', 'flee'], ['robber2', 'flee']],
  jumpClean: [['robber1', 'run', 'target'], ['robber1', 'hold_up', 'target'], ['target', 'hands_up'], ['robber2', 'grab', 'target'], ['robber1', 'flee'], ['robber2', 'flee']],
  // (styles-1: jumped is a fight: the two of them run up to you; the fight itself is duel.js's, and so is the end)
  // (a grab to open it, as the old jumped scenes did: the stage then stands the player on open ground for the hour
  // before anything of it is played, director.js victimsOf: without it the hour's sale was met among the stalls)
  jumpFight: [['robber1', 'run', 'target'], ['robber1', 'grab', 'target'], ['robber2', 'run', 'target']],
  // (and after it, the stage's own way off, as the old jumped scenes ran it: up if they are down, and away out of the
  // picture by the walkers' lane: director.js, an extra who flees runs on out of the picture)
  jumpAway: [['robber1', 'flee'], ['robber2', 'flee']],
  // (banking, once through the door: a short beat at the floorboard, not the whole lift and close)
  bank: [['agent', 'stash', null, null, 'floorboard_lift']],
  sleep: [['agent', 'sleep']],

  // ── THE WORLD ANSWERS (RUN.md rules-2) ──
  // ROBBING SOMEBODY PASSING: one of ours cast as the passer-by for the hour (demo/run/scenes.js LOCALS, an extra: the
  // city's own walkers are never taken over), coming along the lane; the player walks up to them and grabs. It worked:
  // their hands go up, they hand it over and run. It did not: they shove him off, point and shout, and run. Either way
  // they run on out of the picture (director.js dismiss), as the robbers seen off do
  rob: [['agent', 'walk', 'passer'], ['agent', 'grab', 'passer'], ['passer', 'hands_up'], ['passer', 'hand_off', 'agent'], ['passer', 'flee']],
  robFail: [['agent', 'walk', 'passer'], ['agent', 'grab', 'passer'], ['passer', 'shove', 'agent'], ['agent', 'stumble'], ['passer', 'hands_up'], ['passer', 'flee']],
  // THE BINS: the real ones (the place table's trashcans and dumpsters: binsOf below); he walks over and digs. A find,
  // he picks it out. Seen in the trailer park: the neighbour comes over, says their piece, and turns their back
  // (anim-1, THE REFERENCE PIECE: the dig is PERFORMED, demo/stage/hands/deals.js `bins`: onto the bin, in over it,
  // the arm working and the body after it, and up with nothing, a little or a find, each told its own way; whoever saw
  // is watching from a little way off, and looks away (`away`: they are with you) or shakes their head and turns
  // their back (`cold`). They walk off after: binsSeen)
  // (`?deals=old`: the two as they were, to film the before: the dig from the city's rummage clip, the pack's hand-off)
  binsOld: (spot, find) => [['agent', 'walk', null, spot], ['agent', 'rummage'], ...(find ? [['agent', 'rummage', null, null, 'pick_up']] : [])],
  binsSeenOld: [['neighbour', 'walk', 'agent'], ['neighbour', 'talk', 'agent'], ['agent', 'listen', 'neighbour'], ['neighbour', 'walk']],
  // (whoever saw is one of the scene's own people, so the director leaves them to it from its first moment: they come
  // near while he walks to the bin (perform.js prepare), and walk off when it is done, the scene not waiting for that)
  bins: (spot, find, seen = null) => [['agent', 'walk', null, spot], ['agent', 'rummage', null, null, null, { deal: 'bins', roles: { you: 'actor', ...(seen ? { neighbour: seen.id } : {}) }, find, seen: seen?.how ?? null, spot }], ...(seen ? [['neighbour', 'walk']] : [])],
  // THE PLACE'S SHOP: up to whoever keeps it, a word, the thing handed over; a drink is drunk there and then
  shop: [['agent', 'walk', 'shop'], ['agent', 'talk', 'shop'], ['shop', 'hand_off', 'agent']],
  // (anim-1, THE REFERENCE PIECE: a pack bought from the connect is PERFORMED, demo/stage/hands/deals.js `buy`: the ask
  // and the nod, the money out of your pocket into his hand and put away, the goods out of his hand into yours, looked
  // at and tucked away. `goods`: what is drawn in the hand, demo/stage/hands/things.js KINDS)
  buy: goods => [['agent', 'walk', 'shop'], ['shop', 'hand_off', 'agent', null, null, { deal: 'buy', roles: { seller: 'actor', buyer: 'target' }, goods, gap: 2 * STAND }]],
  // (anim-1, stage 2: A PIECE TOO BIG FOR A HAND, bought: it never leaves the ground. Out from behind him, in front of
  // the two of you, the money over it, and drawn round behind you: deals.js `buyBig`)
  buyBig: goods => [['agent', 'walk', 'shop'], ['shop', 'hand_off', 'agent', null, null, { deal: 'buyBig', roles: { seller: 'actor', buyer: 'target' }, goods, gap: 2 * STAND }]],
  // (anim-1, stage 2: A LOOSE CIGARETTE SOLD, performed: deals.js `sell`. Out of your pocket into his hand and to his
  // lips, the money out of his into yours (or not: `paid`), and you have the next hour while he lights it and smokes it
  // where he stands, and flicks the end away. Nobody walks off after: he stands smoking, and his own day takes him on
  // at the next hour. At the bus stop you go to him; in the crowd at the market he comes to you, `come`)
  sell: (paid, come = false) => [come ? ['buyer', 'approach', 'dealer'] : ['dealer', 'walk', 'buyer'], ['dealer', 'hand_off', 'buyer', null, null, { deal: 'sell', roles: { seller: 'actor', buyer: 'target' }, paid, gap: 2 * STAND }]],
  // (pot-3: a bag of what you cook: he pays and TAKES IT there and then, and stays where he is (what it does to him is
  // the look's, stage/looks/under.js, as the scene ends); gone wrong, he just takes it and keeps it: deals.js sellBag)
  sellBag: (paid, come, goods) => [come ? ['buyer', 'approach', 'dealer'] : ['dealer', 'walk', 'buyer'], ['dealer', 'hand_off', 'buyer', null, null, { deal: 'sellBag', roles: { seller: 'actor', buyer: 'target' }, paid, goods, gap: 2 * STAND }]],
  // (pot-3: A SLEEPER'S WALLET: up to him where he lies, down beside him, the hand in his pocket: deals.js liftSleeper.
  // He sleeps on through it: his body is the look's)
  liftSleeper: [['agent', 'walk', 'mark'], ['agent', 'hand_off', 'mark', null, null, { deal: 'liftSleeper', roles: { you: 'actor', mark: 'target' }, gap: 0.9 }]],
  // (stage 2: a bootleg disc: he pays and gets it, or just takes it; he looks it over and puts it away: deals.js sellDisc)
  sellDisc: (paid, come = true) => [come ? ['buyer', 'approach', 'dealer'] : ['dealer', 'walk', 'buyer'], ['dealer', 'hand_off', 'buyer', null, null, { deal: 'sellDisc', roles: { seller: 'actor', buyer: 'target' }, paid, gap: 2 * STAND }]],
  // (sixes-1: Dutch has a word: she walks up to you and says it; at the steps she is waiting and asks)
  dutchWord: [['dutch', 'walk', 'agent'], ['dutch', 'talk', 'agent'], ['agent', 'listen', 'dutch'], ['dutch', 'walk']],
  // (second pass: the way out of the market to the subway is its kerb, where the city's own walk to the FIT ST stairs
  // starts (places.json market ways.kerb; the stairs themselves are 72 m off, on Fit Street's block): you walk there, and
  // she is waiting; the two by the kerb the same)
  dutchTax: [['agent', 'walk', null, 'kerb'], ['dutch', 'walk', 'agent'], ['dutch', 'talk', 'agent'], ['agent', 'listen', 'dutch']],
  sixesJump: [['target', 'walk', null, 'kerb'], ['robber1', 'run', 'target'], ['robber1', 'grab', 'target'], ['robber2', 'run', 'target']],
  // (stage 2: her fifth into her hand, and she counts it before it goes away; refused, her open hand out and your no)
  taxPaid: [['agent', 'walk', null, 'kerb'], OLD_DEALS ? ['agent', 'hand_off', 'dutch'] : PAYS('dutch', true), ['dutch', 'walk']],
  taxRefused: OLD_DEALS ? [['agent', 'walk', null, 'kerb'], ['agent', 'talk', 'dutch'], ['dutch', 'listen', 'agent'], ['dutch', 'walk']]
    : [['agent', 'walk', null, 'kerb'], ['dutch', 'hand_off', 'agent', null, null, { deal: 'refused', roles: { buyer: 'actor', seller: 'target' }, gap: 2 * STAND }], ['dutch', 'walk']],
  drink: [['agent', 'build', null, null, 'drink']],
  // SLEEPING ROUGH: he lies down where he is (on his side, the city's lie_still: not a bed's clip, out here)
  rough: [['agent', 'sleep', null, null, 'lie_still']],
  // ROBBED ASLEEP: the Dunn brothers creep up; one goes through his pockets while the other keeps watch; off they run.
  // Woken in time: he is up, they run, and he lies down again
  // (`come`: how they come up: a creep where they come on near, a walk in the trailer park, where they come by Elm St)
  robbed: come => [['robber1', come, 'target'], ['robber2', 'lookout'], ['robber1', 'pat_down', 'target'], ['robber1', 'run'], ['robber2', 'run']],
  robbedWoke: come => [['robber1', come, 'target'], ['target', 'get_up'], ['robber1', 'flee'], ['robber2', 'flee'], ['target', 'sleep', null, null, 'lie_still']],
  // THE MORNING ON THE STREET: he gets up where he lay and pats his pockets
  wake: [['agent', 'get_up'], ['agent', 'pat_down']],
  // THE REGULAR AT THE DOOR: under the morning's black the player is put out on his porch and the regular at the foot
  // of the step (index.js doorAt: a cut, so nobody is seen put there); then, seen, he shakes and asks
  door: [['regular', 'crave'], ['regular', 'talk', 'agent'], ['agent', 'listen', 'regular']],
  // (memory-1) SOMEBODY COME FOR ANOTHER GO: no craving; he says his piece at the foot of the step and waits for the answer
  due: [['regular', 'talk', 'agent'], ['agent', 'listen', 'regular']],
  // given: the money handed over at the door, a nod, and he goes, friendly
  gave: OLD_DEALS ? [['agent', 'hand_off', 'regular'], ['regular', 'listen', 'agent'], ['regular', 'walk']] : [PAYS('regular'), ['regular', 'walk']],
  // refused: shut on him (he says no and goes back in: the hour ends at the pad), or walked out past him
  shut: [['agent', 'talk', 'regular'], ['regular', 'hands_up']],
  past: [['agent', 'walk']],
  // the fight at the door, by how it went for him (the contest's bands: his clean win lays into you; messy, a scuffle;
  // otherwise you see him off)
  fightClean: [['regular', 'shove', 'agent'], ['regular', 'haymaker', 'agent'], ['agent', 'stumble'], ['regular', 'walk']],
  fightMessy: [['regular', 'shove', 'agent'], ['regular', 'scuffle', 'agent'], ['agent', 'stumble'], ['regular', 'walk']],
  fightOff: [['regular', 'shove', 'agent'], ['agent', 'shove', 'regular'], ['regular', 'stumble'], ['regular', 'walk']],
  // (duel-1: the swing is a fight: he shoves you, and it is on; the rest is the page's, demo/run/duel.js)
  fightDuel: [['regular', 'shove', 'agent'], ['agent', 'stumble']],
  // a grudge: he storms off cursing, and the police come round the park
  grudge: [['regular', 'hands_up'], ['regular', 'walk']],
  // sore (trust-1): one who was with you, refused, goes off sore with no grudge and no police: the grudge's own steps
  // (the same clips: he throws up his hands and goes), without the player kept out to watch
  sore: [['regular', 'hands_up'], ['regular', 'walk']],
  // (after a grudge, index.js: the player stays out on his porch and watches the regular storm off home. The police
  // coming round is told, the bar's heat and the line's stops, not acted: an officer at the trailer park can only come
  // on along Elm St, fifty metres off, out of the porch's picture; measured 2026-11-14, he never reached it in the hour)
  watch: [['agent', 'lookout']],

  // ── THE STOP'S CARDS (routes-1, RUN.md "Routes": Fit Street, outside DEAD AIR). Each played with the person it is
  // done with, where they stand (scenes.js DAYS: the stop's own people), and each ends in what it did to them:
  // CRATES FOR THE BARKEEPER: up to him at the bar's front, a word, a crate lifted and carried round the corner to
  // the cellar; a nod from him
  errand: [['agent', 'walk', 'keeper'], ['keeper', 'talk', 'agent'], ['agent', 'build', null, null, 'crate_lift'], ['agent', 'carry', null, 'fit:cellar'], OLD_DEALS ? ['keeper', 'listen', 'agent'] : PAID('keeper')],
  // A LOOKOUT AT THE ALLEY MOUTH: up to the stranger there, a word, he keeps watch up and down the street and waves it
  // clear; paid. Gone wrong (somebody saw: heat +1), the stranger points and runs, and so does he (`flee`, RUN.md)
  lookout: [['agent', 'walk', 'stranger'], ['stranger', 'talk', 'agent'], ['agent', 'lookout', null, null, 'deal_lookout'], ['agent', 'lookout', null, null, 'lookout_wave'], ...(OLD_DEALS ? [['stranger', 'hand_off', 'agent'], ['agent', 'listen', 'stranger']] : [PAID('stranger')])],
  lookoutFail: [['agent', 'walk', 'stranger'], ['stranger', 'talk', 'agent'], ['agent', 'lookout', null, null, 'deal_lookout'], ['stranger', 'hands_up'], ['stranger', 'flee'], ['agent', 'run']],
  // THE ONE WHO HAD ONE TOO MANY, walked up Ivy St toward the FIT ST stairs, adrift, and the tip at the end. Gone wrong
  // (`shove`), he shoves you off and staggers where he stands
  // (he leads, the drunk drifts after him: `approach` is the city's unsteady walks)
  tipsy: [['agent', 'walk', 'drunk'], ['agent', 'walk', null, 'fit:stairs'], ['drunk', 'approach', 'agent'], OLD_DEALS ? ['drunk', 'hand_off', 'agent'] : PAID('drunk')],
  tipsyFail: [['agent', 'walk', 'drunk'], ['agent', 'talk', 'drunk'], ['drunk', 'shove', 'agent'], ['agent', 'stumble'], ['drunk', 'stumble']],
  // A SMOKE SOLD (`work:deal`): up to him, handed over, and he lights it there. Gone wrong (`work:deal:dry`), he takes it
  // and walks off without paying; you throw up your hands
  smoke: [['dealer', 'walk', 'buyer'], ['dealer', 'hand_off', 'buyer'], ['buyer', 'listen', 'dealer'], ['buyer', 'smoke']],
  smokeFail: [['dealer', 'walk', 'buyer'], ['dealer', 'hand_off', 'buyer'], ['buyer', 'walk'], ['dealer', 'hands_up']],
  // THE DUMPSTER IN THE ALLEY (`rummage`): round into the passage, up to it, and a dig; a find, picked out
  dumpster: find => [['agent', 'walk', null, 'fit:dumpster'], ['agent', 'rummage'], ...(find ? [['agent', 'rummage', null, null, 'pick_up']] : [])],
  // (batch-1) THE BARBER AT FRESH CUTZ: up to him at his door, a word, paid, and the hour in his chair (there is no
  // clip of a cut: the hour passes at his door, he sweeps up after), then a look about, a new face: your own heat −1
  barber: OLD_DEALS ? [['agent', 'walk', 'barber'], ['barber', 'talk', 'agent'], ['agent', 'hand_off', 'barber'], ['barber', 'build', null, null, 'sweep'], ['agent', 'lookout', null, null, 'deal_lookout'], ['barber', 'listen', 'agent']]
    // (stage 2: paid, the scissors at the side of your head and the bits falling, and a hand run over it: deals.js haircut)
    : [['agent', 'walk', 'barber'], ['barber', 'hand_off', 'agent', null, null, { deal: 'haircut', roles: { seller: 'actor', buyer: 'target' }, gap: 2 * STAND }]],
  // (batch-1) THE SNEAKER WALL AT DROP: to the shop's door past the clerk, a pair lifted off the wall, and off at a walk;
  // the clerk is none the wiser. Gone wrong, the clerk sees it, points and shouts (heat +2), and he runs for it
  // (hands-2: the pair off the wall, PERFORMED: deals.js swipe. A hand to the wall, the pair looked at, a look back over
  // the shoulder, tucked away; seen, it goes back on the wall and his hands go up)
  drop: OLD_DEALS ? [['agent', 'walk', null, 'fit:drop'], ['agent', 'rummage', null, null, 'pick_up'], ['agent', 'walk', null, 'fit:kerb'], ['clerk', 'build', null, null, 'phone_type']]
    : [['agent', 'walk', null, 'fit:drop'], ['agent', 'rummage', null, null, null, { deal: 'swipe', roles: { you: 'actor' }, caught: false }], ['agent', 'walk', null, 'fit:kerb'], ['clerk', 'build', null, null, 'phone_type']],
  dropFail: OLD_DEALS ? [['agent', 'walk', null, 'fit:drop'], ['agent', 'rummage', null, null, 'pick_up'], ['clerk', 'hands_up', null, null, 'hands_up_point'], ['agent', 'run', null, 'fit:kerb']]
    : [['agent', 'walk', null, 'fit:drop'], ['agent', 'rummage', null, null, null, { deal: 'swipe', roles: { you: 'actor' }, caught: true }], ['clerk', 'hands_up', null, null, 'hands_up_point'], ['agent', 'run', null, 'fit:kerb']],

  // ── LOW TIDE DOCKS (batch-1) ──
  // A SHIFT FOR THE FOREMAN: up to him at the quay side, a word, a box lifted off the ring and carried down to the pier,
  // a nod (the shift's work as the walk's crates are carried: crate_lift, then the carry)
  shift: [['agent', 'walk', 'foreman'], ['foreman', 'talk', 'agent'], ['agent', 'build', null, null, 'crate_lift'], ['agent', 'carry', null, 'pier'], OLD_DEALS ? ['foreman', 'listen', 'agent'] : PAID('foreman')],
  // A BOX OFF THE SEMI: up to the driver's cab while he is at his own business, a box lifted and walked off with; a few
  // steps on he finds it gone, pats about and watches
  semi: [['agent', 'walk', 'driver'], ['agent', 'build', null, null, 'crate_lift'], ['agent', 'carry', null, 'dock:load'], ['driver', 'pat_down'], ['driver', 'deal', null, null, 'deal_lookout']],
  // (gone wrong to his face it is a fight, duel-1: he turns, shoves you off, and it is on; the rest is the page's)
  semiFight: [['agent', 'walk', 'driver'], ['agent', 'build', null, null, 'crate_lift'], ['driver', 'shove', 'agent'], ['agent', 'stumble']],

  // ── GLASSWALL PLAZA (batch-1) ──
  // FLYERS FOR VIC AMATO: up to his table, a word, the stack handed over; a few steps along the plaza, held out to
  // whoever goes by (the hand-off's clip, to nobody of ours: an extra walking on for it went off over the plaza's raised
  // edge, the audit's `feet`), twice, and a nod from him
  flyers: [['agent', 'walk', 'boss'], ['boss', 'talk', 'agent'], ['boss', 'hand_off', 'agent'], ['agent', 'walk'], ['agent', 'hand_off'], ['agent', 'walk'], ['agent', 'hand_off'], ['boss', 'listen', 'agent']],
  // A PHONE SNATCHED: up to them on the edge, the phone grabbed out of their hand, and off at a run; they throw up their
  // hands. Gone wrong, they hold on and shove him off, and get straight on their other phone to the police (heat +2)
  phone: [['agent', 'walk', 'mark'], ['agent', 'grab', 'mark'], ['mark', 'hands_up'], ['agent', 'run']],
  phoneFail: [['agent', 'walk', 'mark'], ['agent', 'grab', 'mark'], ['mark', 'shove', 'agent'], ['agent', 'stumble'], ['mark', 'build', null, null, 'phone_call']],

  // ── HOME PRESSURE (home-1, RUN.md "Home pressure"): all of it at the player's own trailer, in the city's clips, with
  // the people the city already has. Each `who` names the player first, so he stays where the scene is (on his porch,
  // DOOR) until the hour takes him in
  // (a look round is `watch` with the city's deal_lookout: `lookout` is a background action, started and passed over, and
  // whoever is only seen doing it is never seen doing anything)
  // SEEN CASING YOUR CRIB (the morning's warning): out on his porch he looks round; whoever it is, where his pad meets
  // the lane (index.js puts them there, facing the trailer), looks it over once more and has a smoke over it while he
  // watches them, and they walk off
  casing: [['agent', 'watch', null, null, 'deal_lookout'], ['caser', 'watch', null, null, 'deal_lookout'], ['caser', 'smoke'], ['caser', 'walk']],
  // THE NOTICE: word reaches him where he is, on his phone
  alarm: [['agent', 'phone']],
  // HOME IN TIME: up the lane and to his door at a run (they are at the foot of his step: index.js)
  meet: [['agent', 'run', null, DOOR]],
  // MET AT THE DOOR: the regular's fight at the door (fightClean and the rest, above), by how it went for him. They got
  // in: laid into him, and off at a run with it; a scuffle: they grab what they can and run; seen off: shoved back, off
  // (one beat fewer than the regular's: with the walk out to them and back in, the hour kept under 15 s at 1x)
  // (off at a run to the waiting place by the lane, south-west, away from Earl's post and the door: a few steps "along
  // the lane", the run went past Earl and stood head on head with him in the picture, 2026-11-16)
  doorClean: [['raider', 'haymaker', 'agent'], ['agent', 'stumble'], ['raider', 'run', null, WAIT]],
  doorMessy: [['raider', 'scuffle', 'agent'], ['agent', 'stumble'], ['raider', 'run', null, WAIT]],
  doorOff: [['raider', 'shove', 'agent'], ['agent', 'shove', 'raider'], ['raider', 'run', null, WAIT]],
  // COUSIN EARL ON THE STEP: they come up to him; he squares up (guard_post) and shoves them off. Beaten: a haymaker,
  // he goes down, gets up and limps off hurt (and the door decides it after)
  guardHeld: [['agent', 'watch', null, null, 'deal_lookout'], ['raider', 'walk', 'guard'], ['guard', 'guard'], ['guard', 'shove', 'raider'], ['raider', 'stumble'], ['raider', 'run', null, WAIT_EAST]],
  guardBeaten: [['agent', 'watch', null, null, 'deal_lookout'], ['raider', 'walk', 'guard'], ['raider', 'haymaker', 'guard'], ['guard', 'fall'], ['guard', 'get_up'], ['guard', 'limp']],
  // HIRED FOR YOUR STEP: out on the porch as he comes up from his truck, his three days' money handed over; his post (guard_post)
  // is his to keep after, while the player goes back in
  guardOn: [OLD_DEALS ? ['agent', 'hand_off', 'guard'] : PAYS('guard', true)],
  // COMING HOME AFTER AN ATTEMPT YOU WERE NOT THERE FOR: at his door he stops and looks round (the door, them gone);
  // Earl there, he tells him how it went. Then inside at the floorboard: what is missing, and he throws up his hands
  after: [['agent', 'walk', null, DOOR], ['agent', 'watch', null, null, 'deal_lookout']],
  afterGuard: [['agent', 'walk', 'guard'], ['guard', 'talk', 'agent'], ['agent', 'listen', 'guard']],
  missing: [['agent', 'stash', null, null, 'floorboard_rummage'], ['agent', 'hands_up']],
};

// ── THE BINS ARE REAL ONES: the place table's (demo/stage/places.json `near.things`, the city's own trashcans and
// dumpsters round each place, with their boxes and how far each is from the place's point). The nearest three within
// BIN_FAR metres become spots of the stage's block (`bins:0` …): a point a step out from the bin's box on the side
// toward the place's own point, so a dig walks up to it and the director stands him there (stands.js claim: the
// nearest free standing ground to the point), not in it. The trailer park has one that near (by Pad 22), the flea
// market three. Added once, by binsOf(map) at mount.
const BIN_FAR = 30;
const BINS = {};
/** The stage's bins at each block (index.js calls it once with the stage's map): { block: ['bins:0', …] }. */
export function binsOf(map) {
  for (const [block, T] of Object.entries(map?.TABLE?.places ?? {})) {
    const B = map.BLOCKS?.[block];
    if (!B?.spots?.street) continue;
    const [sx, sz] = B.spots.street;
    const near = (T.near?.things ?? []).filter(t => /^(trashcan|dumpster)$/.test(t.what) && Number.isFinite(t.far) && t.far <= BIN_FAR).sort((a, b) => a.far - b.far).slice(0, 3);
    BINS[block] = near.map((t, k) => {
      const name = `bins:${k}`;
      const [x0, , z0, x1, , z1] = t.box ?? [t.at[0], 0, t.at[1], t.at[0], 0, t.at[1]];
      const pad = 0.75;
      B.spots[name] ??= [Math.min(x1 + pad, Math.max(x0 - pad, sx)), Math.min(z1 + pad, Math.max(z0 - pad, sz))];
      return name;
    });
  }
  return BINS;
}
/**
 * The places whose way in is their own middle (no sidewalk of the city's near them: the trailer park): whoever comes
 * on for a scene there comes by the nearest real one (index.js peopleOn: Elm St, by the bus stop), and from there
 * walks rather than creeps.
 */
export const FAR_IN = new Set(['projects']);

/** Who keeps a place's shop: the first person of its safe job's role (the market's stall keeper). */
function keeperOf(cfg, place) {
  const p = cfg?.places?.[place];
  const safe = Object.values(p?.jobs ?? {}).find(j => j.safe);
  return (p?.people ?? []).find(q => q.role === safe?.role)?.id ?? null;
}
/**
 * (hands-2) A THING TO WEAR as the hands show it: what is handed over (things.js `wear:<cast slot>`), the cast's slot it
 * goes on, and, when the rules put it on at once (`e.worn`), the piece the figure is dressed in then ({ slot, id }).
 */
function wearOf(e) {
  const piece = pieceOf(RUN_CONFIG, e.item) ?? '';
  const [slot, id] = piece.split(':');
  if (!slot || !id) return null;
  const kind = ['hat', 'eyewear', 'top', 'bottom', 'shoes', 'acc'].includes(slot) ? `wear:${slot}` : 'wear:acc';
  return { goods: kind, slot, wear: e.worn ? { slot, id } : null };
}
/** The passer-by cast for a robbery: one of three, by what is left of the place's strangers (demo/run/scenes.js). */
const passerOf = e => `npc:passer:${1 + (Math.abs(e.left ?? 0) + (e.hour ?? 0)) % 3}`;

/**
 * The stage events for one step of the run: what the engine said happened (its events, each with a `scene` hint)
 * as scenes at the place it happened. → { events, locals: [[id, block]] }
 */
export function scenesOf(runEvents) {
  const events = [];
  const locals = new Map();
  const block = place => endOf(place).block;
  const pad = `pad:${YOU}`;
  for (const e of runEvents) {
    const at = block(e.place === 'crib' ? 'crib' : e.place);
    switch (e.type) {
      case 'job': {
        // (cast from the event's own person: a card for Mr. Pruitt plays with Mr. Pruitt)
        const win = e.outcome === 'win';
        const k = e.job;
        const them = e.who?.id ?? null;
        if (them) locals.set(them, at);
        if (k === 'odd') {
          events.push(scene('run:odd', at, { agent: YOU, neighbour: them }, { steps: OWN.odd(WORK[them] ?? WORK['npc:neighbour']) }));
        } else if (e.goods?.made && !OLD_DEALS && (k === 'loosies' || k === 'crowd')) {
          // (pot-3: a bag of what you cook, at the bus stop (you go to him) or in the crowd (they come to you): OWN.sellBag)
          events.push(scene(win ? 'work:deal' : 'work:deal:dry', at, { dealer: YOU, buyer: them }, { steps: OWN.sellBag(win, k === 'crowd', `bag-${e.goods.product}`) }));
        } else if (k === 'loosies') {
          // (anim-1, stage 2: a loose cigarette, performed: OWN.sell)
          events.push(scene(win ? 'work:deal' : 'work:deal:dry', at, { dealer: YOU, buyer: them }, { steps: OLD_DEALS ? (win ? OWN.saleAt : OWN.saleAtFail) : OWN.sell(win) }));
        } else if (k === 'crowd') {
          // (the crowd's buyer comes to you; a cigarette performed, the discs as they were until their own turn)
          const smoke = e.goods?.good === 'smokes' && !OLD_DEALS;
          const disc = e.goods?.good === 'discs' && !OLD_DEALS;
          events.push(scene(win ? 'work:deal' : 'work:deal:dry', at, { dealer: YOU, buyer: them }, { steps: smoke ? OWN.sell(win, true) : disc ? OWN.sellDisc(win, true) : win ? OWN.sale : OWN.saleFail }));
        } else if (k === 'wallet') {
          events.push(e.duel ? scene('run:lift:fight', at, { agent: YOU, mark: them }, { steps: OWN.liftFight })
            : scene(win ? 'run:lift' : 'run:lift:fail', at, { agent: YOU, mark: them }, { steps: win ? OWN.lift : OWN.liftFail }));
        } else if (k === 'collect') {
          events.push(e.duel ? scene('run:collect:fight', at, { agent: YOU, debtor: them }, { steps: OWN.debtFight })
            : scene(win ? 'collect:win' : 'collect:lose', at, { agent: YOU, debtor: them }, { steps: win ? OWN.debt : OWN.debtFail }));
        } else if (k === 'stall') {
          events.push(scene('run:stall', at, { agent: YOU, shop: them }, { steps: OWN.stall(SHIFTS[((e.day ?? 1) * 5 + (e.hour ?? 0)) % SHIFTS.length]) }));
        } else if (k === 'till') {
          events.push(scene(win ? 'run:till' : 'run:till:fail', at, { agent: YOU, shop: them }, { steps: win ? OWN.till : OWN.tillFail }));
        } else if (k === 'stickup') {
          events.push(OLD_DEALS ? scene(win ? 'rob:clean' : 'rob:fail', at, { robber: YOU, target: them }) : scene(win ? 'rob:clean' : 'rob:fail', at, { agent: YOU, mark: them }, { steps: OWN.stickup(win), big: true }));
        } else if (k === 'shift') {
          // (batch-1, Low Tide Docks: the foreman's shift, a box carried to the pier)
          events.push(scene('run:shift', at, { agent: YOU, foreman: them }, { steps: OWN.shift }));
        } else if (k === 'lift') {
          // (batch-1: a box off a driver's semi; gone wrong to his face, a fight)
          events.push(e.duel ? scene('run:semi:fight', at, { agent: YOU, driver: them }, { steps: OWN.semiFight })
            : scene(win ? 'run:semi' : 'run:semi:fail', at, { agent: YOU, driver: them }, { steps: win ? OWN.semi : OWN.semiFight }));
        } else if (k === 'flyers') {
          // (batch-1, Glasswall Plaza: flyers handed out for Vic Amato, along the plaza)
          events.push(scene('run:flyers', at, { agent: YOU, boss: them }, { steps: OWN.flyers }));
        } else if (k === 'phone') {
          events.push(scene(win ? 'run:phone' : 'run:phone:fail', at, { agent: YOU, mark: them }, { steps: win ? OWN.phone : OWN.phoneFail }));
        }
        break;
      }
      case 'sixes': {
        // (sixes-1: Dutch's word at the market, and the tax at the steps: she comes up to you; paid or refused, she goes.
        // The meter's other notes (eased, a jump warned or called off) are the notice's, not a scene)
        const steps = e.what === 'word' ? OWN.dutchWord : e.what === 'tax' ? OWN.dutchTax : e.what === 'paid' ? OWN.taxPaid : e.what === 'refused' ? OWN.taxRefused : null;
        if (!steps) break;
        locals.set(DUTCH, at);
        // (second pass: the tax and its answer on the kerb, where the walk to the subway starts: you stay there for it)
        events.push(scene(`run:sixes:${e.what}`, at, { agent: YOU, dutch: DUTCH }, { steps, ...(e.what === 'word' ? {} : { spot: 'kerb' }) }));
        break;
      }
      case 'jumped': {
        // (sixes-1: two of the Sixes by the steps: their own two in the jumped fight's place)
        if (e.sixes) {
          const band = e.outcome === 'clean' ? 'clean' : e.outcome === 'messy' ? 'messy' : 'fail';
          events.push(scene(`npc:sixes:${band}`, at, { robber1: SIXES_TWO[0], robber2: SIXES_TWO[1], target: YOU }, { steps: OWN.sixesJump, big: true, spot: 'kerb' }));
          locals.set(SIXES_TWO[0], at);
          locals.set(SIXES_TWO[1], at);
          break;
        }
        const band = e.outcome === 'clean' ? 'clean' : e.outcome === 'messy' ? 'messy' : 'fail';
        // (styles-1: a jump that was a fight: they run up to you, and the page plays the fight (index.js duelHour))
        // (a big scene, as the old ones were: the player is stood on open ground for the hour first, director.js)
        if (e.duel) events.push(scene(`npc:robbers:${band}`, at, { robber1: 'npc:robber1', robber2: 'npc:robber2', target: YOU }, { steps: OWN.jumpFight, big: true }));
        else events.push(scene(`npc:robbers:${band}`, at, { robber1: 'npc:robber1', robber2: 'npc:robber2', target: YOU }, { steps: band === 'clean' ? OWN.jumpClean : band === 'messy' ? OWN.jumpMessy : OWN.jumpFail, big: true }));
        locals.set('npc:robber1', at);
        locals.set('npc:robber2', at);
        break;
      }
      case 'jumpedAway': {
        // (styles-1: after the fight with the two who jumped you, played by the page: their way off)
        const [r1, r2] = e.sixes ? SIXES_TWO : ['npc:robber1', 'npc:robber2'];
        events.push(scene(`npc:robbers:away`, at, { robber1: r1, robber2: r2, target: YOU }, { steps: OWN.jumpAway, big: false }));
        locals.set(r1, at);
        locals.set(r2, at);
        break;
      }
      case 'stopped': {
        // (batch-1: where a place has its own patrol, the plaza, it is she who stops you: seen walking her beat before)
        const officer = PATROL[at] ?? 'npc:police1';
        events.push(scene('arrest', at, { agent: YOU, officer }));
        locals.set(officer, at);
        break;
      }
      case 'bank':
        events.push(scene('stash', 'projects', { agent: YOU }, { spot: pad, steps: OWN.bank }));
        break;
      case 'sleep':
        events.push(scene('run:sleep', 'projects', { agent: YOU }, { spot: pad, steps: OWN.sleep }));
        break;
      // ── the world answers ──
      case 'rob': {
        const passer = passerOf(e);
        locals.set(passer, at);
        // (in the trailer park the passer-by comes along Elm St, by the bus stop: he robs them there, and stays there.
        // Not a `big` scene: the director would first walk the one robbed out to open ground, off the sidewalk)
        events.push(scene(e.outcome === 'win' ? 'run:rob' : 'run:rob:fail', at, { agent: YOU, passer }, { spot: FAR_IN.has(at) ? 'bus' : 'street', steps: e.outcome === 'win' ? OWN.rob : OWN.robFail, big: false }));
        break;
      }
      // ── routes-1: a card of the stop's hand, played with its own person where they stand (scenes.js CARD_WITH) ──
      case 'card': {
        const win = e.outcome === 'win';
        const them = CARD_WITH[e.card] ?? null;
        if (them) locals.set(them, at);
        if (e.card === 'errand') events.push(scene('run:card:errand', at, { agent: YOU, keeper: them }, { steps: OWN.errand }));
        else if (e.card === 'lookout') events.push(scene(win ? 'run:card:lookout' : 'run:card:lookout:fail', at, { agent: YOU, stranger: them }, { steps: win ? OWN.lookout : OWN.lookoutFail }));
        else if (e.card === 'tipsy') events.push(scene(win ? 'run:card:tipsy' : 'run:card:tipsy:fail', at, { agent: YOU, drunk: them }, { steps: win ? OWN.tipsy : OWN.tipsyFail }));
        else if (e.card === 'sell') events.push(scene(win ? 'work:deal' : 'work:deal:dry', at, { dealer: YOU, buyer: them }, { steps: OLD_DEALS ? (win ? OWN.smoke : OWN.smokeFail) : OWN.sell(win) }));
        // (batch-1: the barber at FRESH CUTZ, the sneaker wall at DROP)
        else if (e.card === 'barber') events.push(scene('run:card:barber', at, { agent: YOU, barber: them }, { spot: 'fit:barber', steps: OWN.barber }));
        else if (e.card === 'drop') events.push(scene(win ? 'run:card:drop' : 'run:card:drop:fail', at, { agent: YOU, clerk: them }, { spot: 'fit:drop', steps: win ? OWN.drop : OWN.dropFail }));
        break;
      }
      case 'bins': {
        // (routes-1: the stop's dumpster card is the street's bins, at the dumpster in the alley)
        if (e.card) {
          // (anim-1: the same performed dig, at the dumpster's Ivy St end: in by the alley's gate, and out again)
          const saw = e.seen?.id ? { id: e.seen.id, how: e.lookedAway ? 'away' : 'cold' } : null;
          if (saw) locals.set(e.seen.id, at);
          events.push(scene('run:card:dumpster', at, { agent: YOU, ...(saw ? { neighbour: saw.id } : {}) }, { spot: 'fit:dumpster', steps: OLD_DEALS ? OWN.dumpster(e.find === 'find') : OWN.bins('fit:dumpster', e.find ?? 'nothing', saw) }));
          break;
        }
        const spots = BINS[at] ?? [];
        const spot = spots.length ? spots[Math.abs(e.left ?? 0) % spots.length] : 'street';
        if (e.seen?.id) locals.set(e.seen.id, at);
        if (OLD_DEALS) {
          events.push(scene('run:bins', at, { agent: YOU }, { spot, steps: OWN.binsOld(spot, e.find === 'find') }));
          if (e.seen?.id) events.push(scene('run:bins:seen', at, { neighbour: e.seen.id, agent: YOU }, { spot, steps: OWN.binsSeenOld }));
          break;
        }
        events.push(scene('run:bins', at, { agent: YOU, ...(e.seen?.id ? { neighbour: e.seen.id } : {}) }, { spot, steps: OWN.bins(spot, e.find ?? 'nothing', e.seen?.id ? { id: e.seen.id, how: e.lookedAway ? 'away' : 'cold' } : null) }));
        break;
      }
      case 'shop': {
        // (goods-1: the errand's own keeper, at their own spot: the sandwich from Gloria, the drink from Mrs. Bao.
        // Only a drink is drunk there and then: there is no clip of eating, so the sandwich is handed over and kept)
        const keeper = e.keeper?.id ?? keeperOf(RUN_CONFIG, e.place);
        if (keeper) locals.set(keeper, at);
        // (stage 2: bought and used there and then, performed: deals.js buyUse)
        const steps = keeper && !OLD_DEALS && (e.item === 'drink' || e.item === 'sandwich') ? OWN.buyUse(e.item === 'drink' ? 'can' : 'sandwich') : [...(keeper ? OWN.shop : []), ...(e.item === 'drink' ? OWN.drink : [])];
        if (steps.length) events.push(scene('run:shop', at, { agent: YOU, shop: keeper }, { steps }));
        break;
      }
      // A PACK FROM THE CONNECT, A THING FROM ITS KEEPER (goods-1): walked up to where they stand, a word, handed over.
      // No hour passes; Space skips it as any scene
      case 'pack':
      case 'thing':
      case 'lesson': {
        // (styles-1: a lesson is had as a thing is: walked up to whoever teaches it, a word, paid)
        const them = e.type === 'pack' ? e.who?.id : e.keeper?.id;
        if (!them) break;
        locals.set(them, at);
        // (anim-1: a pack from the connect, the carton from Cousin Earl: performed. Stage 2: a piece for the trailer from
        // Mr. Pruitt's swap meet, the kit's own piece seen (things.js kitKind): handed over when one hand carries it, and
        // when not, never off the ground (OWN.buyBig). A thing from another keeper and a lesson are still the old
        // hand-off: the next stage's, in this pattern)
        // (stage 2: every piece for the trailer from whoever keeps it, Mr. Okafor's safe and camera, Mr. Haines's door bar;
        // Gloria's dog is no piece: he comes to you and follows you home, OWN.buyDog. A lesson: paid, shown, done)
        const dog = e.type === 'thing' && e.item === 'dog' && !OLD_DEALS;
        // (hands-2: a thing to wear, bought and put on there and then: OWN.buyWear; the cast's piece of it, `wear`)
        const worn = e.type === 'thing' && e.kind === 'wear' && !OLD_DEALS ? wearOf(e) : null;
        const piece = e.type === 'thing' && e.kind === 'home' && !dog && !OLD_DEALS ? kitKind(pieceOf(RUN_CONFIG, e.item) ?? '') : null;
        const steps = dog ? OWN.buyDog : worn ? OWN.buyWear(worn) : piece ? (handHeld(piece) ? OWN.buy(piece) : OWN.buyBig(piece)) : e.type === 'lesson' && !OLD_DEALS ? OWN.lesson(e.style) : e.type === 'pack' && !OLD_DEALS ? OWN.buy(e.good === 'smokes' ? 'carton' : 'pack') : OWN.shop;
        events.push(scene(`run:${e.type}`, at, { agent: YOU, shop: them }, { steps }));
        break;
      }
      // ── pot-2 (RUN.md "The pot (pot-1)"): what you cook with, bought from whoever sells it where they stand; the cook
      // at your crib, the stage's own `cook` action (its clip and the cook's set: actors.js), for the hour; (pot-3) a
      // sleeper's wallet, lifted off him where he lies asleep: walked up to, down on your heels beside him, a hand in his
      // pocket (OWN.liftSleeper)
      case 'making': {
        const them = e.who?.id;
        if (!them) break;
        locals.set(them, at);
        events.push(scene('run:making', at, { agent: YOU, shop: them }, { steps: OWN.shop }));
        break;
      }
      case 'cook':
        events.push(scene('run:cook', 'projects', { agent: YOU }, { spot: pad, steps: [['agent', e.scene?.action ?? 'cook']] }));
        break;
      case 'lift': {
        const them = e.who?.id;
        if (!them) break;
        locals.set(them, at);
        events.push(scene('run:lift:sleeper', at, { agent: YOU, mark: them }, { steps: OLD_DEALS ? OWN.lift.slice(0, 2) : OWN.liftSleeper }));
        break;
      }
      case 'rough':
        events.push(scene('run:rough', at, { agent: YOU }, { steps: OWN.rough }));
        break;
      case 'robbed': {
        const woke = e.outcome !== 'clean' && e.outcome !== 'messy';
        const come = FAR_IN.has(at) ? 'walk' : 'sneak';
        events.push(scene(woke ? 'run:robbed:woke' : 'run:robbed', at, { robber1: 'npc:robber1', robber2: 'npc:robber2', target: YOU }, { steps: woke ? OWN.robbedWoke(come) : OWN.robbed(come), big: true }));
        locals.set('npc:robber1', at);
        locals.set('npc:robber2', at);
        break;
      }
      case 'morning':
        // (only a morning on the street is played here: one at home is the crib's own cut, index.js)
        if (e.night === 'street') events.push(scene('run:wake', at, { agent: YOU }, { steps: OWN.wake }));
        break;
      case 'door': {
        // (styles-1: somebody sent: a tough of the stage's own stands at your door for whoever sent him)
        const them = e.sent ? SENT : e.who?.id;
        if (!them) break;
        locals.set(them, 'projects');
        events.push(scene(e.due ? 'run:door:due' : 'run:door', 'projects', { agent: YOU, regular: them }, { spot: DOOR, steps: e.due ? OWN.due : OWN.door }));
        break;
      }
      case 'gave':
        if (e.who?.id) events.push(scene('run:gave', 'projects', { agent: YOU, regular: e.sent ? SENT : e.who.id }, { spot: DOOR, steps: OWN.gave }));
        break;
      case 'refused':
        if (e.who?.id) events.push(scene(`run:refused:${e.how}`, 'projects', { agent: YOU, regular: e.who.id }, { spot: e.how === 'past' ? 'street' : DOOR, steps: e.how === 'past' ? OWN.past : OWN.shut }));
        break;
      case 'fight': {
        if (!e.who?.id) break;
        const steps = e.duel ? OWN.fightDuel : e.outcome === 'clean' ? OWN.fightClean : e.outcome === 'messy' ? OWN.fightMessy : OWN.fightOff;
        // (not a `big` scene: the director would first walk the one it is done to out to open ground, off his porch)
        events.push(scene(`run:fight:${e.outcome}`, 'projects', { regular: e.sent ? SENT : e.who.id, agent: YOU }, { steps, big: false }));
        break;
      }
      case 'grudge':
        if (e.who?.id) events.push(scene('run:grudge', 'projects', { regular: e.who.id, agent: YOU }, { steps: OWN.grudge }));
        break;
      case 'sore':
        if (e.who?.id) events.push(scene('run:sore', 'projects', { regular: e.who.id, agent: YOU }, { steps: OWN.sore }));
        break;
      case 'stormed':
        // (not an engine event: the page's, after a grudge: he watches from his porch as the regular storms off home)
        events.push(scene('run:watch', 'projects', { agent: YOU }, { spot: DOOR, steps: OWN.watch }));
        break;
      // ── home-1 (RUN.md "Home pressure"): each at the player's own trailer, with whoever it is cast as themselves ──
      case 'casing': {
        const caser = homeWho(e.who?.id);
        if (!caser) break;
        locals.set(caser, 'projects');
        events.push(scene('run:casing', 'projects', { agent: YOU, caser }, { spot: DOOR, steps: OWN.casing }));
        break;
      }
      case 'alarm':
        events.push(scene('run:alarm', at, { agent: YOU }, { steps: OWN.alarm }));
        break;
      case 'raid': {
        // (only what happened at his door with him there: met coming home, or in the night. Settled while he was out,
        // it is seen when he next comes home: index.js `homeAfter`)
        if (e.place !== 'crib' && e.place !== 'park') break;
        const raider = homeWho(e.who?.id);
        if (!raider) break;
        locals.set(raider, 'projects');
        if (e.guard && (e.fight || e.how === 'guard')) {
          locals.set(GUARD, 'projects');
          events.push(scene(e.guard.beaten ? 'run:raid:guard:beaten' : 'run:raid:guard', 'projects', { agent: YOU, raider, guard: GUARD }, { spot: DOOR, steps: e.guard.beaten ? OWN.guardBeaten : OWN.guardHeld }));
        }
        // (sixes-1: a crew's door fight is the page's to play, the fight you watch: index.js crewNight)
        if (e.fight && !e.duel) {
          const band = e.fight.outcome === 'clean' ? 'clean' : e.fight.outcome === 'messy' ? 'messy' : 'off';
          // (not a `big` scene: the director would first walk the one it is done to out to open ground, off his porch)
          events.push(scene(`run:raid:door:${band}`, 'projects', { agent: YOU, raider }, { spot: DOOR, steps: band === 'clean' ? OWN.doorClean : band === 'messy' ? OWN.doorMessy : OWN.doorOff, big: false }));
        }
        break;
      }
      case 'guard':
        // (hired at the crib: out on the porch, paid for his stretch, and he takes up his post. Kept on from his last day
        // (`scene: { action: 'hand_off' }`): nothing, he is on the step already. His last day and his going are the report's)
        if (e.on && e.scene?.action === 'guard') {
          locals.set(GUARD, 'projects');
          events.push(scene('run:guard:on', 'projects', { agent: YOU, guard: GUARD }, { spot: DOOR, steps: OWN.guardOn }));
        }
        break;
      // (the page's own, not the engine's: home in time, up to the door at a run; home after an attempt he was not there
      // for, the look at the door and Earl's word; what is missing at the floorboard)
      case 'homeMeet':
        events.push(scene('run:meet', 'projects', { agent: YOU }, { spot: DOOR, steps: OWN.meet }));
        break;
      // (under the morning's cut, the player out on his porch for what the morning shows at the trailer: only where he
      // ends is read from it, a cut plays no steps)
      case 'porch':
        events.push(scene('run:porch', 'projects', { agent: YOU }, { spot: DOOR, steps: OWN.watch }));
        break;
      case 'homeAfter': {
        const guard = e.raid?.how === 'guard' ? GUARD : null;
        if (guard) locals.set(guard, 'projects');
        events.push(scene('run:after', 'projects', { agent: YOU, ...(guard ? { guard } : {}) }, { spot: DOOR, steps: [...OWN.after, ...(guard ? OWN.afterGuard : [])] }));
        break;
      }
      case 'homeMissing':
        events.push(scene('run:missing', 'projects', { agent: YOU }, { spot: pad, steps: OWN.missing }));
        break;
      default:
        // the subway is the trip itself (the stage's ride); a purchase, a morning, stepping out: no scene of its own
        break;
    }
  }
  return { events, locals: [...locals] };
}

