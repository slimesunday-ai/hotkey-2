// THE FIGHT: what everything in it is, as plain data. A test round of THE RUN, kept apart from the game's economy and
// rules (nothing here is read by src/run/ or the season): a short live fight at a rough subway stop. Change the numbers
// here; the rules are in sim.mjs.
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
});
/** The weapons the build panel offers, in its order. */
export const ARMS = ['hands', 'blade', 'pistol', 'chopper'];

/** GEAR: each is on or off. `cut`: the share of every hit taken off; `speed`, `health`, `hits`: multipliers / added. */
export const GEAR = Object.freeze({
  vest: { name: 'stab vest', cut: 0.3, says: 'takes 30% off every hit' },
  shoes: { name: 'good sneakers', speed: 1.22, says: 'you move a fifth faster' },
  strength: { name: 'built', health: 30, hits: 1.2, says: '+30 health, fists and blades hit a fifth harder' },
});

/** YOU, before gear. */
export const YOU = Object.freeze({ name: 'you', hp: 100, speed: 3.6 });
/** THE ALLY: one who fights beside you. Cousin Earl is the stage's own (the run's connect, npc:connect:projects). */
export const ALLY = Object.freeze({ id: 'earl', name: 'Cousin Earl', hp: 65, speed: 3.2, weapon: 'pipe', leash: 5 });

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

/** THE PRESETS of the test round. */
export const PRESETS = Object.freeze({
  hands: { name: 'Bare hands', weapon: 'hands', gear: [], ally: false },
  starter: { name: 'Starter', weapon: 'blade', gear: [], ally: false },
  pistol: { name: 'Handgun', weapon: 'pistol', gear: [], ally: false },
  pistolVest: { name: 'Handgun + vest', weapon: 'pistol', gear: ['vest'], ally: false },
  full: { name: 'Chopper + vest + Earl', weapon: 'chopper', gear: ['vest'], ally: true },
});

/** A build: { weapon, gear: [...], ally }. Its name in a few words. */
export function buildName(b) {
  const parts = [WEAPONS[b.weapon]?.name ?? b.weapon, ...(b.gear ?? []).map(g => GEAR[g]?.name ?? g)];
  if (b.ally) parts.push(ALLY.name);
  return parts.join(' + ');
}
/** Which preset a build is, or null. */
export function presetOf(b) {
  const key = x => `${x.weapon}|${[...(x.gear ?? [])].sort().join(',')}|${!!x.ally}`;
  return Object.keys(PRESETS).find(id => key(PRESETS[id]) === key(b)) ?? null;
}
