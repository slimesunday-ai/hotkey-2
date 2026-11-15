// THE RUN ON THE STAGE: where the player stands and who else is about, as hours in the shape the stage already takes
// (director-plan.js lines: the player's block and whether they are held, the locals on each block, the events). What
// is acted out in them is demo/run/acted.js. The panels (demo/run/index.js) never decide where anybody stands.
//
// The other people in a scene are LOCALS: the stage's own cast machinery (stage/index.js LOOKS by role, the director's
// extras that walk on for a scene and off again, the keepers who stay at their counter) with no rules of their own.

import { RUN_CONFIG } from '../../src/run/index.mjs';

/** The player's seat on the stage. a1's pad is a trailer of Sunny Acres (places.json pads): the crib. */
export const YOU = 'a1';

/** The run's places as the stage's: a block, the spot kept there, and the held place (the jail, the clinic). */
export function endOf(place, from = null) {
  switch (place) {
    case 'crib': return { block: 'projects', spot: `pad:${YOU}`, held: null };
    case 'park': return { block: 'projects', spot: 'street', held: null };
    case 'market': return { block: 'market', spot: 'street', held: null };
    case 'jail':
    case 'clinic': return { block: from ?? 'market', spot: 'street', held: place };
    default: return { block: 'projects', spot: 'street', held: null };
  }
}

// ── the locals ──────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PEOPLE ARE THE RULES' (src/run/config.mjs `people`: who each job is done to or with, by id and name). Here, only
// how each stands on the stage: its look (stage/index.js LOOKS by role: a shopkeeper's or a stallholder's apron;
// anyone else the plain clothes of the crowd), and its day: where it is at each hour and what it does there while
// nobody deals with it (DAYS below). Every one KEEPS its place (`keep`: on stage at its own spot whenever the place
// is, apart from the others), so a scene with them starts with them a few steps away. Whoever comes FOR you (the Dunn
// brothers, the police) is an extra: on stage only for the hour that has a scene for them, walking in and off.
const STAGE = {
  // (the park's people have a home each, the market's a stall or two or three places: their days below)
  'npc:shop:market': { look: 'shopkeeper' },
  'npc:shop:market:2': { look: 'shopkeeper' },
  'npc:stallholder': { look: 'shopkeeper' },
  'npc:stallholder:2': { look: 'shopkeeper' },
  'npc:stallholder:3': { look: 'shopkeeper' },
};
const BLOCK = { park: 'projects', market: 'market' };

// ── the trailer park's people at home ───────────────────────────────────────────────────────────────────────────────
// THE OWNER, 2026-11-14: "i wish the npcs at the trailer park moved around more, they all hang in the same place, like
// they should each proably have their own location/house nearby and they should have more actions, like maybe they
// are sweeping sometimes, and other times doing something else". So each of the seven has a trailer of Sunny Acres
// for the whole run (the place table's homes: places.json projects.near.homes, read off the lots' own anchors; a1 is
// the player's), and a day of their own there: three to five things at two or three real spots of it, from noon to
// the night, walked between. A spot is one of the home's own (demo/tools/place-table.mjs homeSpots): `door` on the
// porch at the door, `step` at the foot of it, `yard`, `stall` (the swap meet's stall in the yard), `front` where the
// pad meets the lane; or the park's bus stop on Elm St, SUNNY ACRES (`bus`, `bus:2`, `bus:3`: the places to wait at
// its shelter), which is where the run's loose cigarettes and wallets are: its two people and Shaky Dee keep to it
// through the day. Each line is [from this hour, the spot, the city's clips for it]: the clips are the city's own
// (data/city-clips.json), named outright. The jobs are done where the person is (demo/run/acted.js).
const HOME = {
  'npc:neighbour': 'a2',
  'npc:neighbour:2': 'a3',
  'npc:neighbour:3': 'a4',
  'npc:buyer:projects:1': 'a5',
  'npc:debtor': 'a6',
  'npc:mark:projects': 'a7',
  'npc:mark:projects:2': 'a8',
};
export const DAYS = {
  // Mrs. Alvarez, across the lane: her yard swept, her swap-meet stall stocked, a smoke on the porch, a call at night
  'npc:neighbour': [[12, 'yard', ['sweep']], [14, 'stall', ['stock_shelf']], [16, 'door', ['smoke']], [18, 'yard', ['dig_shovel']], [20, 'door', ['phone_call']]],
  // Mr. Pruitt: hammering in his yard, his stall, a drink on the porch, the phone in his hand
  'npc:neighbour:2': [[12, 'yard', ['bench_hammer']], [14, 'stall', ['stock_shelf']], [16, 'yard', ['bench_hammer']], [19, 'door', ['drink']], [21, 'door', ['phone_type']]],
  // Gloria: the porch mopped, her stall, the yard swept, on the phone out front, a smoke
  'npc:neighbour:3': [[12, 'door', ['mop']], [13, 'stall', ['stock_shelf']], [15, 'yard', ['sweep']], [18, 'front', ['phone_call']], [20, 'door', ['smoke']]],
  // Benny Two-Coats: a smoke on his porch, a drink in the yard, on the phone out front, the game on the radio
  'npc:debtor': [[12, 'door', ['smoke']], [14, 'yard', ['drink']], [16, 'front', ['phone_call']], [18, 'door', ['earpiece_listen']], [21, 'yard', ['smoke']]],
  // Shaky Dee, at the bus stop: shaking, smoking, texting, smoking
  'npc:buyer:projects:1': [[12, 'bus:3', ['withdrawal_shake']], [14, 'bus:3', ['smoke']], [17, 'bus:3', ['phone_type']], [20, 'bus:3', ['smoke']]],
  // the man and the woman at the bus stop: waiting for a bus that does not come (the shelter's board says NO SVC)
  'npc:mark:projects': [[12, 'bus', ['wait_stop']], [15, 'bus', ['phone_call']], [18, 'bus', ['wait_stop']], [21, 'bus', ['drink']]],
  'npc:mark:projects:2': [[12, 'bus:2', ['phone_type']], [14, 'bus:2', ['wait_stop']], [17, 'bus:2', ['phone_call']], [20, 'bus:2', ['wait_stop']]],

  // ── the flea market's people ──────────────────────────────────────────────────────────────────────────────────────
  // THE SAME FOR THE JAY ST NIGHT MARKET (the owner, of the market: "theres no npcs on the sidewalks and they just
  // sometimes pop in and out"). Its places are the place table's (demo/tools/place-table.mjs, `stalls`): each of its
  // eight stalls has its front, where its sign is and a customer browses it (`stall:k`: the west row 0 to 2 and the
  // middle row 3 to 5 face each other across the aisle, 6 and 7 sell to Jay St), and its back, where its keeper stands
  // behind it (`keep:k`; the three counters are the backs of stalls 4, 6 and 7); each picnic table its free end
  // (`table:k`); `kerb`, its own kerb on Washington St in front of the aisle; `taxi`, the JAY ST taxi stop across
  // Jay St, 17 m off.
  // THE KEEPERS KEEP TO THEIR STALL, each at the work of their hour, never two at the same thing at once. The yard
  // between the middle row's backs and the street stalls' is a passage a body and a half wide either side of the
  // picnic tables, and whoever stands in it closes it: only Mrs. Kowalski keeps a stall from there (5, from behind).
  // Mrs. Bao and the stallholder sell from in front of the street stalls, 7 and 6, on Jay St; Mr. Ferraro from in
  // front of stall 4, in the aisle; Mr. Okafor keeps stall 2, the west row's, from behind.
  'npc:shop:market': [[12, 'stall:7', ['haggle_counter']], [14, 'stall:7', ['stock_shelf']], [16, 'stall:7', ['phone_type']], [18, 'stall:7', ['sweep']], [21, 'stall:7', ['phone_type']]],
  'npc:shop:market:2': [[12, 'stall:4', ['stock_shelf']], [14, 'stall:4', ['drink']], [17, 'stall:4', ['haggle_counter']], [20, 'stall:4', ['stock_shelf']]],
  'npc:stallholder': [[12, 'stall:6', ['smoke']], [16, 'stall:6', ['stock_shelf']], [19, 'stall:6', ['drink']], [21, 'stall:6', ['smoke']]],
  'npc:stallholder:2': [[12, 'keep:2', ['sweep']], [14, 'keep:2', ['haggle_counter']], [17, 'keep:2', ['smoke']], [20, 'keep:2', ['haggle_counter']]],
  'npc:stallholder:3': [[12, 'keep:5', ['phone_type']], [13, 'keep:5', ['mop']], [15, 'keep:5', ['rummage']], [18, 'keep:5', ['phone_call']], [21, 'keep:5', ['mop']]],
  // THE CROWD has three places each and walks between them: no two at one place at one hour, nor at two stalls facing
  // each other across the aisle (stall 0 and 3, 2 and 5; Mr. Ferraro stands at 4, across from 1). Lola: browsing the
  // west row, a drink at the picnic table, on the phone at the kerb
  'npc:buyer:market:1': [[12, 'stall:0', ['rummage', 'pick_up']], [14, 'table:0', ['drink', 'phone_type']], [16, 'kerb', ['phone_call', 'smoke']], [18, 'stall:0', ['pick_up', 'rummage']], [20, 'table:0', ['phone_type', 'drink']]],
  // Pockets: waiting at the taxi stop, browsing Mrs. Kowalski's stall, a drink at the table
  'npc:buyer:market:2': [[12, 'taxi', ['wait_stop', 'smoke']], [14, 'stall:5', ['rummage']], [16, 'table:0', ['drink']], [18, 'taxi', ['smoke', 'wait_stop']], [20, 'stall:5', ['rummage', 'pick_up']]],
  // the woman in the crowd: browsing Mr. Okafor's stall, a cab at the taxi stop, the middle row's corner stall
  'npc:mark:market': [[12, 'stall:2', ['pick_up', 'rummage']], [14, 'taxi', ['phone_type', 'wait_stop']], [16, 'stall:3', ['rummage']], [18, 'stall:2', ['rummage', 'pick_up']], [20, 'taxi', ['hail_taxi', 'phone_type']]],
  // the man with a camera: filming from the kerb, filming the stalls, hailing at the taxi stop
  'npc:mark:market:2': [[12, 'kerb', ['film_phone']], [14, 'stall:3', ['film_phone', 'rummage']], [16, 'taxi', ['hail_taxi', 'wait_stop']], [18, 'kerb', ['film_phone']], [20, 'stall:3', ['film_phone']]],
};
/**
 * EACH ONE'S OWN PLACE, where the sour keep their backs to you: a park person's porch, a keeper's stall. (The market's
 * crowd has none: whoever of them you serve or rob walks off for the day.)
 */
const OWN = {
  'npc:shop:market': 'stall:7',
  'npc:shop:market:2': 'stall:4',
  'npc:stallholder': 'stall:6',
  'npc:stallholder:2': 'keep:2',
  'npc:stallholder:3': 'keep:5',
};
/** The spot a day names: a home's own (`door`, `yard` …) for whoever has a home, else the place's own spot as named. */
const spotOf = (id, where) => (HOME[id] && /^(door|step|yard|stall|front)$/.test(where) ? `home:${HOME[id]}:${where}` : where);
/** Where a person is at this hour and what they do there: { spot, clips }. */
function dayOf(id, hour) {
  const list = DAYS[id];
  if (!list) return null;
  let at = list[0];
  for (const q of list) if (q[0] <= (hour ?? 12)) at = q;
  const [, where, clips] = at;
  return { spot: spotOf(id, where), clips };
}
/** A person's own home spot (`door`, `yard` …), when they have a home. */
export const homeSpot = (id, which) => (HOME[id] ? `home:${HOME[id]}:${which}` : null);
/** Where the player works a shopkeeper's stall shift (lineOf): behind their counter, the stall between them. */
const WORK_AT = { 'npc:shop:market': 'keep:7', 'npc:shop:market:2': 'keep:4' };
/** A person's own place: their porch, or their stall. */
const ownOf = id => homeSpot(id, 'door') ?? OWN[id] ?? null;
const LOCALS = [
  ...Object.entries(RUN_CONFIG.people).flatMap(([place, list]) => list.map(p => ({
    id: p.id, name: p.name, block: BLOCK[place], role: STAGE[p.id]?.look ?? 'buyer', spot: DAYS[p.id] ? dayOf(p.id, 12).spot : 'street',
    action: 'idle', keep: true, home: HOME[p.id] ?? null, days: !!DAYS[p.id],
  }))),
  { id: 'npc:medic', role: 'medic', name: 'Doc Imani', held: 'clinic', spot: 'bed' },
  // (somebody passing, robbed: one of ours cast as a passer-by for the hour, walking on along the lane as an extra
  // does; the city's own walkers are never taken over. demo/run/acted.js `rob`)
  { id: 'npc:passer:1', role: 'buyer', name: 'a man passing', block: 'projects' },
  { id: 'npc:passer:2', role: 'buyer', name: 'a woman passing', block: 'projects' },
  { id: 'npc:passer:3', role: 'buyer', name: 'somebody passing', block: 'projects' },
  { id: 'npc:robber1', role: 'npcRobber', name: 'Mick Dunn', block: 'market' },
  { id: 'npc:robber2', role: 'npcRobber', name: 'Lyle Dunn', block: 'market' },
  { id: 'npc:police1', role: 'police', name: 'Officer Hale', block: 'market' },
];
const KEEPERS = new Set(['shopkeeper', 'medic']);
const keeps = n => KEEPERS.has(n.role) || !!n.keep;
/**
 * WHERE SOMEBODY WHO HAS LEFT FOR THE DAY GOES: a place of the city's that is not the one loaded (Pleasantview
 * Park), so the stage walks them off the way anyone leaves and keeps them away until the morning brings them back.
 */
const GONE = 'park';
/**
 * Out for the day and gone: a lift that worked (they find out and leave); at the flea market a sale too (the buyer
 * walks off with it). The wary stay, apart, and watch. The sour stay at their own place and keep their backs to you
 * (a debt paid at the trailer park, a till or a stick-up at a stall), and a buyer served at the trailer park walks
 * home with it (moodOf). Whoever has no place of their own to be sour at goes.
 */
const gone = (p, n) => p.outToday && (p.mood === 'unaware' || (p.mood === 'sour' && !ownOf(n.id)) || (p.role === 'buyer' && p.mood === 'friendly' && !n?.home));
/**
 * THE MOODS (the owner's ask: "Sour: they go to their own place and keep their back to you. Wary: they watch you from
 * it. Friendly: as they were"): where a person with a day stands and what they do, by the mood the day left them in.
 */
function moodOf(n, p, hour) {
  const day = dayOf(n.id, hour);
  if (!p?.outToday) return { spot: day.spot, action: 'chore', clips: day.clips };
  // (sour: their own place, back turned: on the porch, smoking or drinking; at their stall, at its work)
  if (p.mood === 'sour') return { spot: ownOf(n.id), action: 'chore', clips: n.home ? ['smoke', 'drink'] : ['stock_shelf', 'smoke'], back: YOU };
  // (wary: where they are, watching you)
  if (p.mood === 'wary') return { spot: day.spot, action: 'lookout', clips: ['deal_lookout'], face: YOU };
  // (a buyer served at the trailer park walks home with it)
  if (p.role === 'buyer' && n.home) return { spot: homeSpot(n.id, 'yard'), action: 'chore', clips: ['smoke'] };
  return { spot: day.spot, action: 'chore', clips: day.clips };
}

/** The game the stage is handed (stage.begin): one seat, the player, and the locals. The panels keep its state current. */
export function stageGame() {
  const npcs = Object.fromEntries(LOCALS.map(n => [n.id, { held: null, spot: 'street', ...n, block: n.block ?? null }]));
  return {
    state: { t: 0, phase: 'day', order: [YOU], agents: { [YOU]: { id: YOU, name: 'You', block: 'projects', state: 'free', cls: null } }, npcs },
    // the stage reads a held place's way out (it starts building the zone there) and which block has the pads
    map: {
      blocks: { projects: { name: 'the trailer park', pads: true }, market: { name: 'the flea market' } },
      held: { jail: { name: 'the jail', exit: 'projects' }, clinic: { name: 'the clinic', exit: 'projects' } },
    },
  };
}

/**
 * Where the locals are this hour: whoever keeps a place at it (or, out for the day, gone, or watching), the others
 * at the block of their scene. `people`: the view's (mood, out today); `busy`: who is in this hour's scenes (they
 * play them where they are, and leave after).
 */
function presence(locals, people = [], busy = new Set(), hour = 12) {
  const out = {};
  const now = new Map(people.map(p => [p.id, p]));
  for (const n of LOCALS) {
    if (!keeps(n) || !n.block) continue;
    const p = now.get(n.id);
    if (p && gone(p, n) && !busy.has(n.id)) (out[GONE] ??= []).push({ id: n.id, role: n.role, spot: 'street', action: 'idle' });
    // (whoever is in this hour's scene stays at the place their day had them: the scene is played where they are)
    else if (n.days) (out[n.block] ??= []).push({ id: n.id, role: n.role, ...(busy.has(n.id) ? { ...moodOf(n, p?.outToday ? null : p, hour) } : moodOf(n, p, hour)) });
    else (out[n.block] ??= []).push({ id: n.id, role: n.role, spot: n.spot ?? 'street', action: p?.mood === 'wary' && p.outToday ? 'lookout' : n.action ?? 'idle' });
  }
  for (const [id, block] of locals) {
    const n = LOCALS.find(q => q.id === id);
    if (!n || keeps(n)) continue;
    (out[block] ??= []).push({ id, role: n.role, spot: 'street', action: 'idle' });
  }
  return out;
}

/**
 * THE HOUR AS THE STAGE TAKES IT (director-plan.js planHour): where the player ends, the scenes, and the locals on
 * stage. `place` is where the run's state now has them; `taken` the block they were taken from (jail, clinic);
 * `staged`: the step's scenes ({ events, locals: [[id, block]] }, demo/run/acted.js) or null for a placement only.
 */
export function lineOf({ t, day, hour, place, taken = null, staged = null, verb = 'move', people = [] }) {
  const end = endOf(place, taken);
  const held = end.held;
  const events = [...(staged?.events ?? [])];
  // (A STALL SHIFT IS WORKED AT THE STALL: told what to do, he goes round to the side of it its keeper is not on, and
  // does the work there, the stall between them (WORK_AT). The crowd's days leave those places to him. It was a few
  // steps along the nearest sidewalk, wherever that was: fourteen seconds stuck, or his head in a customer's)
  for (const e of events) {
    const work = e.kind === 'run:stall' ? WORK_AT[e.who?.shop] : null;
    if (work) for (const s of e.stage?.steps ?? []) if (s.actor === YOU && s.action === 'walk' && !s.target && !s.spot) s.spot = work;
  }
  // where they stay: the spot their own last event names (endsOf reads the first role of an event). At home, the pad.
  if (!held && end.spot !== 'street' && !events.some(e => e.spot === end.spot)) events.push({ kind: 'move', t, block: end.block, spot: end.spot, who: { mover: YOU }, lists: {}, data: {}, big: false, stage: { t, block: end.block, spot: end.spot, steps: [{ actor: YOU, action: 'walk' }] } });
  for (const e of events) {
    e.t = t;
    if (e.stage) e.stage.t = t;
  }
  return {
    type: 'hour', t, day, hour,
    agents: { [YOU]: { block: held ?? end.block, state: held ?? 'free', move: { verb } } },
    npcs: presence(staged?.locals ?? [], people, new Set((staged?.events ?? []).flatMap(e => e.stage?.steps?.flatMap(q => [q.actor, q.target]) ?? [])), hour),
    events,
    police: [],
  };
}
