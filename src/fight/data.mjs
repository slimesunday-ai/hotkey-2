// THE FIGHT: what everything in it is, as plain data. A test round of THE RUN, kept apart from the game's economy and
// rules: a short live fight at a rough subway stop. Change the numbers here; the rules are in sim.mjs. (duel-1: the
// run's own fights, one-on-ones, use the weapons below through duel.mjs, with their own numbers in the run's config,
// src/run/config.mjs `duel`; nothing else here is read by src/run/.) (fight-3: every weapon a job of its own, no damage
// tiers: the two long guns, the three punch styles, the run's opponents' styles, Cousin Earl's ways and the small street
// fights, all as data the simulation runs; none of it is read by src/run/ yet, and nobody of the run has a style.)
//
// Units: metres, seconds, health points. `rate` is attacks a second. Damage is [lowest, highest], rolled even.
// A gun's hit chance is `acc` at point blank, falling in a straight line to `accFar` at its `range`.

/** One step of the simulation (s). The page steps it at this rate too, whatever its frame rate. */
export const TICK = 1 / 30;
/** A fight is over at this many seconds whatever is left: they back off and you get out (not a win). */
export const CAP = 90;
/** A body's radius on the ground (m): two stand no nearer than twice this. */
export const BODY = 0.5;

/**
 * THE ARENA in its own frame: x across (0 to w), y away from the stairs (0 to h). The stairs come up at the top edge
 * (`exit`, y small): you start a step in front of them, and walking back onto them ends the fight (you leave, you
 * keep your skin). They come in at `entries`, just outside an edge. `posts`: what stands in it, boxes [x0, y0, x1, y1] (measured
 * off the city where the page puts it: demo/fight/place.js).
 */
export const ARENA = Object.freeze({
  w: 20,
  h: 12,
  exit: [12, 0.7],
  exitR: 1.1,
  start: [12, 2.2],
  entries: [[-0.8, 4], [-0.8, 9.5], [3, 12.8], [9, 12.8], [15, 12.8], [20.8, 9.5], [20.8, 11.4]],
  // (at ELM ST, measured off the city where the page lays the arena, demo/fight/ debug().solid: the street tree and
  // the bus shelter beside it on the kerb, one box. 12 m deep, not 14: further east, the buildings across Elm St
  // stand between the game's camera and whoever is at the far edge, and the stage fades them see-through)
  posts: [[16, 5.5, 20.2, 7]],
});

/**
 * WEAPONS. `reach` (m, from body edge to body edge) for a fist or a blade; `range` for a gun, with a magazine (`mag`),
 * a `reload` (s) and the `rounds` you carry besides. `knock`: how far a hit throws them back (m). `bleed`: the blood
 * a hit draws on the stage (gore.js: 'blow' a fist's, 'hit' a shot's).
 */
export const WEAPONS = Object.freeze({
  hands: { name: 'bare hands', kind: 'melee', reach: 0.55, dmg: [5, 8], rate: 1.6, knock: 0.25, bleed: 'blow' },
  blade: { name: 'box cutter', kind: 'melee', reach: 0.7, dmg: [10, 15], rate: 1.8, knock: 0.2, bleed: 'blow' },
  pistol: { name: 'six-shot', kind: 'gun', range: 11, dmg: [15, 21], rate: 2.2, mag: 6, reload: 2, rounds: 22, acc: 0.9, accFar: 0.55, knock: 0.3, bleed: 'hit' },
  chopper: { name: 'chopper', kind: 'gun', range: 12, dmg: [10, 14], rate: 3.4, mag: 15, reload: 2.2, rounds: 30, acc: 0.85, accFar: 0.45, knock: 0.25, bleed: 'hit' },
  // (theirs and Earl's: not in the build panel)
  pipe: { name: 'tire iron', kind: 'melee', reach: 0.7, dmg: [7, 10], rate: 1.0, knock: 0.35, bleed: 'blow' },
  fists: { name: 'fists', kind: 'melee', reach: 0.55, dmg: [8, 12], rate: 1.1, knock: 0.25, bleed: 'blow' },
  shiv: { name: 'shiv', kind: 'melee', reach: 0.55, dmg: [4, 7], rate: 2.2, knock: 0.1, bleed: 'blow' },
  junkgun: { name: 'junk pistol', kind: 'gun', range: 10, dmg: [7, 11], rate: 1.0, mag: 6, reload: 2.4, rounds: Infinity, acc: 0.62, accFar: 0.3, knock: 0.2, bleed: 'hit' },
  knuckles: { name: 'brass knuckles', kind: 'melee', reach: 0.6, dmg: [12, 18], rate: 1.0, knock: 0.45, bleed: 'blow' },
  // THE TWO LONG GUNS (fight-3, the owner's names). Each has a job, not a tier: the six-shot is for anything, the chopper
  // strong and hungry for rounds, the Doorman for a rush, the Long-eye for those who hang back.
  //   THE DOORMAN, a short double barrel: a shell takes every one of the other side inside its `cone` (degrees each way
  //   of the one it is aimed at, and a body's width round it) and its range, each hit rolled on its own. Full damage
  //   out to `full` m, then less in a straight line to `farDmg` of it at `range`, and the throw back less by as much.
  //   Two shells, a slow reload.
  //   THE LONG-EYE, a scoped rifle: one hard shot, slow. With any of the other side within `close.r` m of it (body edge
  //   to body edge) its hit chance is `close.acc` of what it would be: it is no gun to be rushed with.
  // `stand`: how far a player who backs away while firing (policies.mjs kite) keeps the ones who hit, m [ready,
  // reloading or nearly empty] (a gun without one: [4.2, 7]). `pick`: the share of a dropped pack of rounds that fits it.
  doorman: { name: 'Doorman', kind: 'gun', range: 7, full: 2.5, farDmg: 0.2, cone: 22, dmg: [24, 32], rate: 1.6, mag: 2, reload: 1.8, rounds: 20, acc: 0.95, accFar: 0.6, knock: 1.0, bleed: 'hit', stand: [2.6, 5], pick: 0.5 },
  longeye: { name: 'Long-eye', kind: 'gun', range: 20, dmg: [36, 46], rate: 0.75, mag: 5, reload: 2.6, rounds: 15, acc: 0.95, accFar: 0.8, close: { r: 1.6, acc: 0.55 }, knock: 0.5, bleed: 'hit', stand: [6, 8], pick: 0.5 },
  // THE PUNCH STYLES (fight-3): ways to fight with bare hands, each bought once and chosen before a fight (in a
  // one-on-one each takes bare hands' own scale, the run's `duel.hits`). `land`: the share of the usual chance a blow of
  // it lands (a haymaker is seen coming). `hold`: a blow that lands puts them down that many seconds (they cannot hit
  // back or move), a leader `holdBoss` of it; up again, they cannot be put down for `free` s more, so nobody is held for
  // good. `holdSelf: false`, you stay on your feet (the throw); left out, a hold holds you to them as long (theirs, the
  // grab). `slam`: the ground does the damage, so no style's `soak` takes any off it.
  // (quick hands' blows come every 1/rate s, give or take 8%: longer than a heavy's stagger, 0.35 s, so they never keep
  // a heavy staggered for good; at a rate of 2.85 or more they would)
  jab: { name: 'quick hands', kind: 'melee', reach: 0.5, dmg: [5, 8], rate: 2.2, knock: 0.15, bleed: 'blow' },
  haymaker: { name: 'haymaker', kind: 'melee', reach: 0.6, dmg: [18, 24], rate: 0.6, land: 0.85, knock: 1.0, bleed: 'blow' },
  throw: { name: 'the throw', kind: 'melee', reach: 0.6, dmg: [7, 10], rate: 0.85, knock: 0.6, hold: 1.6, free: 0.8, holdBoss: 1, holdSelf: false, slam: true, bleed: 'blow' },
  // (the run's opponents' in a one-on-one: RIVALS below)
  mauler: { name: 'big fists', kind: 'melee', reach: 0.65, dmg: [14, 20], rate: 0.85, knock: 0.6, bleed: 'blow' },
  quickfists: { name: 'quick fists', kind: 'melee', reach: 0.55, dmg: [5, 8], rate: 2.0, knock: 0.15, bleed: 'blow' },
  grab: { name: 'grabbing hands', kind: 'melee', reach: 0.45, dmg: [8, 11], rate: 1.0, knock: 0, hold: 1.0, free: 1.0, bleed: 'blow' },
});
/** The weapons the build panel offers, in its order (the tire iron is Cousin Earl's alone). */
export const ARMS = ['hands', 'blade', 'pistol', 'chopper', 'doorman', 'longeye'];
/** The long guns (fight-3): held in both hands on the page. */
export const LONG_GUNS = ['doorman', 'longeye'];
/** The punch styles (fight-3): bare hands, bought once and chosen before a fight. Not on the page's panel, not in the run yet. */
export const PUNCHES = ['jab', 'haymaker', 'throw'];

/**
 * THE RUN'S OPPONENTS' STYLES (fight-3): how somebody who fights you one-on-one fights, for the card to show before you
 * choose (`says`). `weapon` theirs; `hits` its blows' scale in a one-on-one; `speed` m/s; `reel` how long a blow of
 * yours that lands staggers them (s); `heft` the share of a blow's throw back they take; `soak` points off every blow
 * of yours that lands (never below 1); `slip` the share of a hold they take; `hp` the toughness of one as most are (a
 * person's own toughness, the run's, may differ). A one-on-one's `foe` takes these fields (duel.mjs). The brawler is
 * the run's opponent as he is now. Nobody of the run has a style yet (the trailer park's stay plain brawlers and the
 * quick one; the others are for people deeper in the city).
 */
export const RIVALS = Object.freeze({
  brawler: { name: 'the brawler', says: 'a plain brawler', weapon: 'fists', hits: 2.0, speed: 3.2, reel: 0.35, heft: 1, soak: 0, slip: 1, hp: 55 },
  bigman: { name: 'the big man', says: 'big, slow, hits like a truck', weapon: 'mauler', hits: 2.0, speed: 2.6, reel: 0.12, heft: 0.35, soak: 7, slip: 1, hp: 70 },
  quick: { name: 'the quick one', says: 'quick and slippery', weapon: 'quickfists', hits: 2.0, speed: 4.0, reel: 0.45, heft: 1.2, soak: 0, slip: 0.3, hp: 45 },
  knife: { name: 'the knife', says: 'carries a blade', weapon: 'blade', hits: 1.6, speed: 3.4, reel: 0.35, heft: 1, soak: 0, slip: 1, hp: 50 },
  grabber: { name: 'the grabber', says: "grabs and won't let go", weapon: 'grab', hits: 2.0, speed: 3.0, reel: 0.3, heft: 0.8, soak: 5, slip: 1, hp: 60 },
});
/** A one-on-one's foe of a style: { weapon, hits, speed, reel, heft, soak, slip, hp } (the run's own toughness over `hp`). */
export function rivalFoe(style, o = {}) {
  const R = RIVALS[style];
  if (!R) throw new Error(`fight: no style ${style}`);
  const { name, says, ...foe } = R;
  return { ...foe, ...o };
}

/** GEAR: each is on or off. `cut`: the share of every hit taken off; `speed`, `health`, `hits`: multipliers / added. */
export const GEAR = Object.freeze({
  vest: { name: 'stab vest', cut: 0.3, says: 'takes 30% off every hit' },
  shoes: { name: 'good sneakers', speed: 1.22, says: 'you move a fifth faster' },
  // (built, the gym's mark: +10 health and ×1.1, fight-3; it was +30 and ×1.2, and box cutter + built beat a six-shot)
  strength: { name: 'built', health: 10, hits: 1.1, says: '+10 health, fists and blades hit a tenth harder' },
});

/** YOU, before gear. */
export const YOU = Object.freeze({ name: 'you', hp: 100, speed: 3.6 });
/** THE ALLY: one who fights beside you. Cousin Earl is the stage's own (the run's connect, npc:connect:projects). */
export const ALLY = Object.freeze({ id: 'earl', name: 'Cousin Earl', hp: 65, speed: 3.2, weapon: 'pipe', leash: 5 });
/**
 * EARL'S WAYS (fight-3): how Cousin Earl fights, told him before the fight (a build's `earl`; left out, `side`). `says`
 * in a card's words, `word` in a button's.
 *   side    the nearest of them near you, else at your shoulder: as he always has (the stop's presets keep it)
 *   front   a step in front of you, toward the nearest one who walks up to hit; takes what comes, fights what reaches
 *           him or you
 *   hunt    after the ones who hang back and shoot, wherever they are; then the one furthest from you
 *   block   with two or more on their way to you, he stands a step and a half out between you and the second nearest
 *           and fights him there, so they reach you one at a time
 * The three the player is offered are WAYS_OFFERED (the old way is never the clear call: run70's study).
 */
export const EARL_WAYS = Object.freeze({
  side: { name: 'at your side', word: 'At your side', says: 'fights whoever comes at you' },
  front: { name: 'out in front', word: 'Out in front', says: 'stands in front, takes the hits' },
  hunt: { name: 'goes hunting', word: 'Goes hunting', says: 'goes after the shooters' },
  block: { name: 'one at a time', word: 'One at a time', says: 'keeps the second one off you' },
});
export const WAYS_OFFERED = ['front', 'hunt', 'block'];

/**
 * THEIR KINDS. `keep`: a shooter keeps between these distances of whoever it shoots; `bias`: how much more it wants
 * you than Earl (distances to you are divided by it). `loot`: the chance of rounds and of a thing, and the cash range.
 */
export const FOES = Object.freeze({
  heavy: { name: 'heavy', says: 'walks up and hits', hp: 58, speed: 2.5, weapon: 'fists', reel: 0.35, bias: 1.4, loot: { cash: [6, 16], rounds: 0.35, thing: 0.12 } },
  runner: { name: 'runner', says: 'fast and weak', hp: 26, speed: 4.3, weapon: 'shiv', reel: 0.45, bias: 1.6, loot: { cash: [3, 10], rounds: 0.25, thing: 0.1 } },
  shooter: { name: 'shooter', says: 'keeps back and shoots', hp: 38, speed: 2.4, weapon: 'junkgun', keep: [5.5, 9], reel: 0.35, bias: 2, loot: { cash: [8, 20], rounds: 0.7, thing: 0.15 } },
  boss: { name: 'Big Moss', says: 'their leader: tough, hits hard', hp: 150, speed: 2.7, weapon: 'knuckles', reel: 0.12, bias: 1.5, loot: { cash: [40, 70], rounds: 0.5, thing: 1 } },
});

/**
 * THE STOP'S THREE LEVELS. `waves`: [seconds in, kind, entry] (an entry is an index of ARENA.entries; they walk in
 * from there).
 */
export const LEVELS = Object.freeze({
  easy: {
    name: 'quiet night',
    says: 'three of them, one at a time',
    waves: [[1, 'heavy', 3], [7, 'runner', 0], [14, 'heavy', 5]],
  },
  real: {
    name: 'Elm St after dark',
    says: 'the real one: nine, in three waves, one shoots',
    waves: [[1, 'heavy', 2], [1.5, 'runner', 0], [2.5, 'runner', 6], [13, 'heavy', 4], [13.5, 'shooter', 5], [14, 'heavy', 1], [14.5, 'runner', 3], [26, 'runner', 3], [26.5, 'heavy', 6]],
  },
  hard: {
    name: 'bad night',
    says: 'ten and Big Moss, two shoot',
    waves: [[1, 'heavy', 2], [1.4, 'runner', 0], [1.8, 'runner', 5], [9, 'shooter', 6], [9.5, 'heavy', 4], [10, 'heavy', 1], [18, 'shooter', 3], [18.5, 'runner', 0], [19, 'heavy', 5], [27, 'boss', 3], [27.5, 'runner', 6]],
  },
});

/** THINGS that are dropped now and then: `heal` is used at once when picked up; `worth` is cash in your pocket. */
export const THINGS = Object.freeze([
  { id: 'bandage', name: 'a bandage', heal: 25 },
  { id: 'watch', name: 'a cheap watch', worth: 30 },
  { id: 'phone', name: 'a cracked phone', worth: 22 },
  { id: 'smokes', name: 'a pack of smokes', worth: 8 },
]);
/** What you carry in when you come up the stairs (it is what they take if you go down). */
export const POCKET = 40;

/**
 * THE SMALL STREET FIGHTS (fight-3), the stop's own simulation by these names too (createFight's `level`): getting
 * jumped, two at once and one of them a runner; the corner, where two hang back and shoot and two come at you; a raid,
 * four at once. `waves` as LEVELS'. The page offers `jumped` (dock.js); the other two are the table's, to measure Earl's
 * ways by. THE SIXES AT YOUR DOOR, a first look and not tuned (`ground: 'yard'`, YARD): you and Earl at your door,
 * nobody leaves, and a Six who gets past you to the door is not counted yet.
 */
export const STREET = Object.freeze({
  jumped: { name: 'two at once', says: 'two of them at once, one a runner', waves: [[1, 'heavy', 2], [1.2, 'runner', 5]] },
  corner: { name: 'the corner', says: 'two hang back and shoot, two come at you', waves: [[1, 'shooter', 3], [1.3, 'shooter', 5], [1.6, 'heavy', 2], [1.9, 'heavy', 4]] },
  raid: { name: 'a raid', says: 'four of them at once', waves: [[1, 'heavy', 2], [1.1, 'heavy', 4], [1.2, 'runner', 0], [1.3, 'runner', 6]] },
  sixes1: { name: 'the Sixes, one at a time', says: 'five of them, one after another', ground: 'yard', waves: [[1, 'heavy', 0], [6, 'runner', 1], [11, 'heavy', 2], [16, 'shooter', 0], [21, 'heavy', 1]] },
  sixes4: { name: 'the Sixes, all at once', says: 'four of them together', ground: 'yard', waves: [[1, 'heavy', 0], [1.2, 'heavy', 1], [1.4, 'runner', 2], [1.6, 'shooter', 0]] },
});
/** THE YARD in front of your door (fight-3): 10 by 8 m, your door at its top edge; no way out, nothing standing in it. */
export const YARD = Object.freeze({
  w: 10, h: 8, exit: [-99, -99], exitR: 0.01, start: [5, 1.2],
  entries: [[5, 8.8], [-0.8, 5.5], [10.8, 5.5]],
  posts: [],
});
/** A level of the stop's or a street fight by its name, or null. */
export const levelOf = id => LEVELS[id] ?? STREET[id] ?? null;

/** THE PRESETS of the test round. */
export const PRESETS = Object.freeze({
  hands: { name: 'Bare hands', weapon: 'hands', gear: [], ally: false },
  starter: { name: 'Starter', weapon: 'blade', gear: [], ally: false },
  pistol: { name: 'Handgun', weapon: 'pistol', gear: [], ally: false },
  pistolVest: { name: 'Handgun + vest', weapon: 'pistol', gear: ['vest'], ally: false },
  full: { name: 'Chopper + vest + Earl', weapon: 'chopper', gear: ['vest'], ally: true },
});

/** A build: { weapon, gear: [...], ally, earl }. Its name in a few words (Earl's way said when it is not his old one). */
export function buildName(b) {
  const parts = [WEAPONS[b.weapon]?.name ?? b.weapon, ...(b.gear ?? []).map(g => GEAR[g]?.name ?? g)];
  if (b.ally) parts.push(b.earl && b.earl !== 'side' && EARL_WAYS[b.earl] ? `${ALLY.name} (${EARL_WAYS[b.earl].name})` : ALLY.name);
  return parts.join(' + ');
}
/** Which preset a build is, or null (a build with Earl told another way than his old one is none of them). */
export function presetOf(b) {
  const key = x => `${x.weapon}|${[...(x.gear ?? [])].sort().join(',')}|${!!x.ally}|${x.ally && x.earl && x.earl !== 'side' ? x.earl : ''}`;
  return Object.keys(PRESETS).find(id => key(PRESETS[id]) === key(b)) ?? null;
}
