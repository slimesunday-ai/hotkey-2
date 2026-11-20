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
    default: {
      // (batch-1: any other place is its config's block and spot: Low Tide Docks `docks`, Glasswall Plaza `uptown`)
      const p = RUN_CONFIG.places?.[place];
      if (p?.block && !p.held && !p.home) return { block: p.block, spot: p.spot ?? 'street', held: null };
      // (routes-1: a stop on a way between two places is a place on the stage of its own: its block and spot,
      // src/run/config.mjs `stops`. Fit Street is DEAD AIR's block, `bar`)
      const s = RUN_CONFIG.stops?.[place];
      return s ? { block: s.block, spot: s.spot ?? 'street', held: null } : { block: 'projects', spot: 'street', held: null };
    }
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
  // (goods-1's two connects, in looks the stage already has: Cousin Earl in the dock vest and beanie of a man with a
  // truck to load; Teo in an old hoodie and bandana, a duffel man. stage/index.js LOOKS)
  'npc:connect:projects': { look: 'supplier' },
  'npc:connect:market': { look: 'snitch' },
  // (batch-1: the docks' foremen in the dock vest and beanie the stage already has; its drivers in a delivery top.
  // The plaza's flyers man in an apron at his folding table; the office crowd in the crowd's own clothes)
  'npc:foreman:docks': { look: 'supplier' },
  'npc:foreman:docks:2': { look: 'supplier' },
  'npc:driver:docks': { look: 'courier' },
  'npc:driver:docks:2': { look: 'courier' },
  'npc:boss:plaza': { look: 'shopkeeper' },
  // (sixes-1: Dutch in the Sixes' own look, the green rag and the grey corner hoodie: stage/index.js LOOKS rival)
  'npc:sixes:dutch': { look: 'rival' },
};
/**
 * THE NAMED CAST (named-1): who of the game's people is one of the city's drawn named people (world/named/, the
 * owner's casting: each with their own face, hair, clothes, the thing they carry and their own size), by the pool's
 * key. They wear their own pieces and only those, everywhere they are on stage (stage/index.js begin: `named`), and
 * stand at their own size (demo/stage/actors.js). Anyone not here (the crowd, the marks, the office crowd, the Sixes'
 * hired types, the Dunn brothers, the police of the market, the clinic's medic) keeps the look of their role (LOOKS).
 * Cousin Earl is also the fights' and the raid's ally: demo/fight/index.js and demo/run/raidfight.js dress him by
 * this same key (NAMED_EARL).
 */
export const NAMED = {
  'npc:neighbour': 'alvarez',
  'npc:neighbour:2': 'pruitt',
  'npc:neighbour:3': 'gloria',
  'npc:buyer:projects:1': 'dee',
  'npc:debtor': 'benny',
  'npc:connect:projects': 'earl',
  'npc:shop:market': 'bao',
  'npc:shop:market:2': 'ferraro',
  'npc:buyer:market:1': 'lola',
  'npc:buyer:market:2': 'pockets',
  'npc:buyer:market:3': 'tiny',
  'npc:buyer:market:4': 'cart',
  'npc:stallholder:2': 'okafor',
  'npc:stallholder:3': 'kowalski',
  'npc:connect:market': 'teo',
  'npc:sixes:dutch': 'dutch',
  'npc:foreman:docks': 'haines',
  'npc:foreman:docks:2': 'rosa',
  'npc:driver:docks': 'lou',
  'npc:driver:docks:2': 'nadia',
  'npc:boss:plaza': 'vic',
  'npc:police:plaza': 'pell',
};
export const NAMED_EARL = 'earl';
// (batch-1: each place's block is its config's: a new place's people stand on its own block)
const BLOCK = Object.fromEntries(Object.entries(RUN_CONFIG.places).filter(([, p]) => p.block).map(([id, p]) => [id, p.block]));

// ── FIT STREET, OUTSIDE DEAD AIR (routes-1: the stop on the walk between the trailer park and the flea market) ──────
// Nobody there is a person of the game (RUN.md "Routes": no trust, no mood, nobody to tell on you), so its people are
// the stage's alone: the barkeeper the crates are carried for, a stranger at the alley mouth who wants a lookout, one
// who had one too many and wants walking to the FIT ST stairs, and one who wants a smoke. They keep to the bar's
// block with a small day each, as the park's and the market's people do (DAYS below), at its own spots (STOP_SPOTS).
const STOP_FOLK = [
  { id: 'npc:fit:barkeep', name: 'the barkeeper', look: 'shopkeeper' },
  { id: 'npc:fit:stranger', name: 'a stranger', look: 'buyer' },
  { id: 'npc:fit:drunk', name: 'a stranger who had one too many', look: 'buyer' },
  { id: 'npc:fit:smoker', name: 'a stranger', look: 'courier' },
  // (batch-1: the barber of FRESH CUTZ, at the walk-up's door with the barber pole; the clerk of DROP, at its door by
  // the sneaker wall)
  { id: 'npc:fit:barber', name: 'the barber', look: 'shopkeeper' },
  { id: 'npc:fit:clerk', name: 'the clerk at DROP', look: 'shopkeeper' },
];
/** Who each card of the stop is played with (src/run/config.mjs `stops.fitst.cards`): the stage's person for it. */
export const CARD_WITH = { errand: 'npc:fit:barkeep', lookout: 'npc:fit:stranger', tipsy: 'npc:fit:drunk', sell: 'npc:fit:smoker', barber: 'npc:fit:barber', drop: 'npc:fit:clerk' };
/**
 * THE PLAZA'S PATROL (batch-1: at Glasswall Plaza the police are the danger, and it is seen before it bites): an officer
 * of the stage's own, not a person of the game, who walks the plaza's beat all day (the place table's stands with a
 * `beat`, the stage's own patrol: director.js lifeStep, the city's patrol_walk). A stop on the plaza is hers.
 */
export const PATROL = { 'uptown': 'npc:police:plaza' };
/**
 * THE STOP'S SPOTS, on DEAD AIR's block: each the place table's own standing place (places.json bar.stands: the city's
 * stand-spot maker's, clear of the walkers' lane and the kerb) nearest a point said from the block's own `street`
 * spot, where the player stands. The bar's front faces Fit Street's sidewalk; its north side is a strip of pavement
 * between it and the next building (the alley mouth); its east side is on Ivy St, the way the FIT ST stairs lie.
 * Added once to the stage's map (stopSpots, index.js at mount), as acted.js binsOf adds the bins.
 */
const STOP_SPOTS = {
  bar: {
    'fit:door': [-4, -1], // (the barkeeper's: on the sidewalk by the bar's front, four metres up from you)
    'fit:cellar': [-6, -3], // (round the bar's west corner, where the crates go down)
    'fit:alley': [-7.5, -4], // (the alley mouth, the passage up the bar's west side: where the lookout stands)
    'fit:alley:in': [-9, -4.5], // (a step into the passage: the stranger's)
    'fit:corner': [6.5, -3.5], // (the corner of Ivy St at the crossing: the one who had one too many)
    'fit:kerb': [-8.5, -0.5], // (up Fit Street past the alley mouth: the one who wants a smoke)
    'fit:stairs': [6.5, -8], // (up Ivy St, the way the FIT ST stairs lie: as far as the drunk is walked in an hour's scene)
    // (the dumpster in the service alley behind the bar: the place table's own, a step out from its box at its Ivy St
    // end, the one end anybody can come to. The alley is shut by chain-link gates at both mouths (the city's own:
    // heroes/fitstreet.js alleyGate) and nothing walks round to its far side: the spot was there (side [-1, 0]) and
    // every walk to it gave out on the sidewalk at the gate, 2 m short of the dumpster: mapped 2026-11-18. The dig
    // goes in by the gate and comes back out: demo/stage/hands/perform.js `shut`)
    'fit:dumpster': { thing: 'alley·dumpster', side: [1, 0] },
    // (batch-1: the two shopfronts on the block's north face, Fit Street proper, the other side of the block from the
    // bar's front: FRESH CUTZ, the walk-up with the barber pole, and DROP with its sneaker wall, a step out from each
    // door. The city's own pieces (city/from-trunk/style/city/heroes/fitstreet.js; audit.json `-3_0·walkup·barberpole·0`
    // and `-3_0·drop·structure·0`, moved into the place table's frame as its other pieces of the block are). Not in the
    // place table's stands (they are all on the bar's front), so the points are the doors' own)
    'fit:barber': [-15.9, -26.6],
    'fit:drop': [-5, -27.6],
  },
  // (batch-1) LOW TIDE DOCKS: the cargo ring behind the quay (places.json docks.stands, all open ground, about the
  // `street` spot) and the quay's edge at its first mooring (`pier`). The foremen keep the ring's quay side, where the
  // boxes go down to the pier; the drivers the ring's land side, by their semis' doors, toward Dock St.
  docks: {
    'dock:tally': [-2.5, -4], // (Mr. Haines, counting boxes at the quay side)
    'dock:night': [3, -4.5], // (Rosa, at the quay side's other end)
    'dock:cab': [-4.5, 4.5], // (Big Lou, by his cab on the land side)
    'dock:cab:2': [4.5, 5], // (Nadia Petrakis, by hers)
    'dock:load': [0, 2], // (the open middle of the ring: where a box is set down to be carried)
  },
  // (batch-1) GLASSWALL PLAZA: the plaza's west and south edges and its benches round the fountain (places.json uptown);
  // Precinct 9 is 22 m east. Vic Amato's folding table at the bench by the plaza's north side; the office crowd along
  // the edges with their phones and coffee; the patrol on the plaza's beat
  uptown: {
    'plz:table': [1, 3.5], // (Vic Amato: by the north bench, `counter:shop`)
    'plz:edge': [-5, -2], // (a man in a lanyard, on the west edge)
    'plz:edge:2': [3.5, -6], // (a woman on two phones, on the south edge)
    'plz:edge:3': [-4.5, 4], // (a man with a coffee, by the north-west corner)
    'plz:beat': { beat: true, near: [5, 0] }, // (the patrol: the stand with a beat nearest the plaza's east side)
  },
};
export function stopSpots(map) {
  const out = {};
  for (const [block, spots] of Object.entries(STOP_SPOTS)) {
    const B = map?.BLOCKS?.[block];
    const T = map?.TABLE?.places?.[block];
    const stands = T?.stands ?? [];
    if (!B?.spots?.street) continue;
    const [sx, sz] = B.spots.street;
    const taken = new Set();
    for (const [name, at] of Object.entries(spots)) {
      if (!Array.isArray(at) && at.beat) {
        // (batch-1: a stand with a beat, nearest a point said from the street spot: whoever has it walks its beat)
        const [x, z] = [sx + at.near[0], sz + at.near[1]];
        const near = stands.filter(q => q.beat?.length && !taken.has(q)).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
        if (!near) continue;
        taken.add(near);
        B.spots[name] ??= [near.x, near.z];
        out[name] = B.spots[name];
        continue;
      }
      if (!Array.isArray(at)) {
        const t = (T?.near?.things ?? []).find(q => q.id.includes(at.thing));
        if (!t?.box) continue;
        const [x0, , z0, x1, , z1] = t.box;
        const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
        B.spots[name] ??= [at.side[0] ? (at.side[0] > 0 ? x1 + 0.75 : x0 - 0.75) : cx, at.side[1] ? (at.side[1] > 0 ? z1 + 0.75 : z0 - 0.75) : cz];
        out[name] = B.spots[name];
        continue;
      }
      const [dx, dz] = at;
      const [x, z] = [sx + dx, sz + dz];
      const near = stands.filter(q => !taken.has(q)).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
      if (near && Math.hypot(near.x - x, near.z - z) < 2.5) taken.add(near);
      B.spots[name] ??= near && Math.hypot(near.x - x, near.z - z) < 2.5 ? [near.x, near.z] : [x, z];
      out[name] = B.spots[name];
    }
  }
  return out;
}

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
  // (goods-1: Cousin Earl sells cartons out of his truck, parked where pad 31 meets the lane, two pads up from yours)
  'npc:connect:projects': 'a10',
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
  // Cousin Earl (goods-1, the park's connect): at his truck where his pad meets the lane all day, a smoke, the phone,
  // stock shifted; his porch at night. Never in the lane itself: `front` is a step into the pad
  'npc:connect:projects': [[12, 'front', ['smoke']], [14, 'front', ['phone_type']], [16, 'front', ['stock_shelf']], [18, 'front', ['smoke']], [21, 'door', ['drink']]],
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
  // Teo (goods-1, the market's connect): the back row, behind the west row's first stall (`keep:0`, as Mr. Okafor keeps
  // stall 2 from behind), his duffel at his feet: on the phone, sorting stock, a smoke
  'npc:connect:market': [[12, 'keep:0', ['phone_type']], [14, 'keep:0', ['stock_shelf']], [17, 'keep:0', ['smoke']], [20, 'keep:0', ['phone_type']]],
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
  // (goods-1: the crowd's two new buyers, with the crowd and by the same rule: the picnic tables' free ends, the kerb,
  // Mrs. Kowalski's stall, never where another of the crowd is that hour nor across the aisle from one)
  // Tiny: a drink at the second picnic table, on the phone at the kerb
  'npc:buyer:market:3': [[12, 'table:1', ['drink', 'phone_type']], [14, 'kerb', ['smoke', 'phone_call']], [16, 'table:1', ['phone_type']], [18, 'table:0', ['drink']], [20, 'kerb', ['phone_call', 'smoke']]],
  // the man with a shopping cart: the picnic tables, then browsing Mrs. Kowalski's stall
  'npc:buyer:market:4': [[12, 'table:0', ['phone_type']], [14, 'table:1', ['drink']], [16, 'stall:5', ['rummage', 'pick_up']], [18, 'table:1', ['phone_type', 'drink']], [20, 'table:1', ['drink']]],

  // ── Fit Street, outside DEAD AIR (routes-1) ───────────────────────────────────────────────────────────────────────
  // the barkeeper, at the bar's front all day: the sidewalk swept, a smoke, a call to the brewery, on the phone, a drink
  'npc:fit:barkeep': [[12, 'fit:door', ['sweep']], [14, 'fit:door', ['smoke']], [16, 'fit:door', ['phone_call']], [18, 'fit:door', ['phone_type']], [20, 'fit:door', ['smoke']], [22, 'fit:door', ['sweep']]],
  // the stranger who wants a lookout: a step into the alley, on the phone, pacing, a smoke
  'npc:fit:stranger': [[12, 'fit:alley:in', ['phone_call']], [15, 'fit:alley:in', ['deal_pace']], [18, 'fit:alley:in', ['smoke']], [21, 'fit:alley:in', ['phone_type']]],
  // the one who had one too many: at the corner of Ivy St, a drink, unsteady, adrift
  'npc:fit:drunk': [[12, 'fit:corner', ['drink']], [14, 'fit:corner', ['stagger']], [17, 'fit:corner', ['spaced_drift']], [20, 'fit:corner', ['drink']], [22, 'fit:corner', ['stagger']]],
  // the one who wants a smoke: waiting up Fit Street, on the phone, patting his pockets for one he has not got
  'npc:fit:smoker': [[12, 'fit:kerb', ['wait_stop']], [14, 'fit:kerb', ['phone_type']], [17, 'fit:kerb', ['pat_pockets']], [20, 'fit:kerb', ['phone_call']]],
  // (batch-1) the barber, at his door between customers: a smoke, his phone, the step swept; the clerk at DROP's door
  'npc:fit:barber': [[12, 'fit:barber', ['smoke']], [14, 'fit:barber', ['phone_type']], [16, 'fit:barber', ['sweep']], [19, 'fit:barber', ['smoke']], [21, 'fit:barber', ['phone_call']]],
  'npc:fit:clerk': [[12, 'fit:drop', ['phone_type']], [15, 'fit:drop', ['stock_shelf']], [18, 'fit:drop', ['phone_type']], [21, 'fit:drop', ['smoke']]],

  // ── Low Tide Docks (batch-1) ──────────────────────────────────────────────────────────────────────────────────────
  // Mr. Haines (days; counts every box twice): his tally at the quay side, a box shifted, on the phone to the office
  'npc:foreman:docks': [[12, 'dock:tally', ['phone_type']], [14, 'dock:tally', ['carry_box']], [16, 'dock:tally', ['phone_call']], [18, 'dock:tally', ['phone_type']]],
  // Rosa (runs the night shift): in for it in the afternoon, a smoke, the phone, a box or two
  'npc:foreman:docks:2': [[12, 'dock:night', ['smoke']], [15, 'dock:night', ['phone_call']], [18, 'dock:night', ['carry_box']], [21, 'dock:night', ['smoke']]],
  // Big Lou (sleeps in his cab between loads): by his cab, drowsing on his feet, a smoke, a drink
  'npc:driver:docks': [[12, 'dock:cab', ['wait_stop']], [14, 'dock:cab', ['smoke']], [17, 'dock:cab', ['drink']], [20, 'dock:cab', ['wait_stop']]],
  // Nadia Petrakis (drives nights, trusts nobody): by hers, watching the ring, on the phone
  'npc:driver:docks:2': [[12, 'dock:cab:2', ['deal_lookout']], [15, 'dock:cab:2', ['phone_type']], [18, 'dock:cab:2', ['deal_lookout']], [21, 'dock:cab:2', ['phone_call']]],

  // ── Glasswall Plaza (batch-1) ─────────────────────────────────────────────────────────────────────────────────────
  // Vic Amato (sells condos off a folding table): at his table, on the phone, a pitch at the air
  'npc:boss:plaza': [[12, 'plz:table', ['phone_call']], [14, 'plz:table', ['haggle_counter']], [17, 'plz:table', ['phone_type']], [20, 'plz:table', ['phone_call']]],
  // the office crowd: lunch on the edges, a phone, a coffee, waiting
  'npc:office:plaza': [[12, 'plz:edge', ['phone_type']], [14, 'plz:edge', ['drink']], [17, 'plz:edge', ['phone_call']], [20, 'plz:edge', ['phone_type']]],
  'npc:office:plaza:2': [[12, 'plz:edge:2', ['phone_call']], [15, 'plz:edge:2', ['phone_type']], [18, 'plz:edge:2', ['phone_call']]],
  'npc:office:plaza:3': [[12, 'plz:edge:3', ['drink']], [14, 'plz:edge:3', ['phone_type']], [17, 'plz:edge:3', ['wait_stop']], [20, 'plz:edge:3', ['drink']]],
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
  'npc:connect:market': 'keep:0',
  // (batch-1: the docks' foremen and drivers keep their posts; Vic Amato his table)
  'npc:foreman:docks': 'dock:tally',
  'npc:foreman:docks:2': 'dock:night',
  'npc:driver:docks': 'dock:cab',
  'npc:driver:docks:2': 'dock:cab:2',
  'npc:boss:plaza': 'plz:table',
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
  // (sixes-1: the two of the Sixes who wait by the steps are extras, as the Dunn brothers are, below)
  ...Object.entries(RUN_CONFIG.people).flatMap(([place, list]) => list.filter(p => !(RUN_CONFIG.sixes?.jumpers ?? []).includes(p.id)).map(p => ({
    id: p.id, name: p.name, block: BLOCK[place], role: STAGE[p.id]?.look ?? 'buyer', spot: DAYS[p.id] ? dayOf(p.id, 12).spot : 'street',
    action: 'idle', keep: true, home: HOME[p.id] ?? null, days: !!DAYS[p.id], named: NAMED[p.id] ?? null,
  }))),
  // (routes-1: the stop's own people, the stage's alone, on DEAD AIR's block)
  ...STOP_FOLK.map(p => ({ id: p.id, name: p.name, block: 'bar', role: p.look, spot: dayOf(p.id, 12).spot, action: 'idle', keep: true, home: null, days: true })),
  // (batch-1: the plaza's patrol, Officer Dana Pell, on its beat all day: PATROL above)
  { id: 'npc:police:plaza', role: 'police', name: 'Officer Dana Pell', block: 'uptown', spot: 'plz:beat', action: 'patrol', keep: true, named: NAMED['npc:police:plaza'] },
  { id: 'npc:medic', role: 'medic', name: 'Doc Imani', held: 'clinic', spot: 'bed' },
  // (somebody passing, robbed: one of ours cast as a passer-by for the hour, walking on along the lane as an extra
  // does; the city's own walkers are never taken over. demo/run/acted.js `rob`)
  { id: 'npc:passer:1', role: 'buyer', name: 'a man passing', block: 'projects' },
  { id: 'npc:passer:2', role: 'buyer', name: 'a woman passing', block: 'projects' },
  { id: 'npc:passer:3', role: 'buyer', name: 'somebody passing', block: 'projects' },
  // (home-1: "somebody nobody here knows", who cases your crib when nobody of the trailer park fits: one of ours in the
  // crowd's plain clothes. He keeps to the place of the city that is not loaded (GONE, below: away, as anyone out for
  // the day is); index.js peopleOn puts him by your trailer for the warning and the attempt, under the morning's cut
  // like anyone who keeps a place, and the next hour without him walks him off again. demo/run/acted.js homeWho
  { id: 'npc:caser', role: 'buyer', name: 'somebody nobody here knows', block: 'park', keep: true },
  { id: 'npc:robber1', role: 'npcRobber', name: 'Mick Dunn', block: 'market' },
  { id: 'npc:robber2', role: 'npcRobber', name: 'Lyle Dunn', block: 'market' },
  // (sixes-1: the two of the Sixes who wait for you by the steps, in their own look; on stage only for that hour)
  ...(RUN_CONFIG.sixes?.jumpers ?? []).map(id => ({ id, role: 'rival', name: RUN_CONFIG.places.market.people.find(p => p.id === id)?.name ?? 'one of the Sixes', block: 'market' })),
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
      blocks: { projects: { name: 'the trailer park', pads: true }, market: { name: 'the Jay St night market' }, bar: { name: 'Fit Street, outside DEAD AIR' }, docks: { name: 'Low Tide Docks' }, uptown: { name: 'Glasswall Plaza' } },
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
