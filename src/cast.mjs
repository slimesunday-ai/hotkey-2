// The named cast (SPEC section 3, D42). Every game NPC is a person with a name and a home spot, so the 3D city can
// draw the same face every time. All names are our own.

import { rng, shuffle } from './rng.mjs';
import { blocksWith, theBlock } from './map.mjs';

/** Names for the ten seats, by seed. Short, easy to tell apart, no two alike in a season. */
const AGENT_NAMES = [
  'Kim', 'Rook', 'Wren', 'Juno', 'Dax', 'Mara', 'Ozzie', 'Tess', 'Cal', 'Nico', 'Bea', 'Silas', 'Indy', 'Lou', 'Vee', 'Hank',
  'Pru', 'Gil', 'Roxy', 'Ansel',
];

const REGULAR_NAMES = [
  'Shaky Dee', 'Mrs. Alvarez', 'Twitch', 'Old Ferris', 'Benny Two-Coats', 'Lola', 'Pockets', 'Skinny Raj', 'Marge', 'Dutch',
  'Little Abe', 'Coral', 'Fitz', 'Ma Bell', 'Sleepy Tom', 'Gwen', 'Hollis', 'Peaches', 'Radio', 'Queenie', 'Moth', 'Uncle Vic',
  'Jitters', 'Sister Ro', 'Banjo', 'Dot', 'Curly', 'Nine-Lives', 'Flo', 'Zeke', 'Minty', 'Deacon', 'Birdie', 'Lucky Lu', 'Sarge',
  'Opal',
];

/** The fixed NPCs. `block` is a feature name looked up on the map, so the cast works on any map. */
const FIXED = [
  { id: 'npc:fence', role: 'fence', name: 'Odette', at: 'fence', spot: 'counter:fence' },
  { id: 'npc:gunshop', role: 'gunshop', name: 'Marek', at: 'gunshop', spot: 'counter:gunshop' },
  { id: 'npc:supplier', role: 'supplier', name: 'Tolly', at: 'supplier', spot: 'pier' },
  { id: 'npc:medic', role: 'medic', name: 'Doc Imani', held: 'clinic', spot: 'bed' },
  { id: 'npc:courier', role: 'courier', name: 'Fleet', at: 'fence', spot: 'street' },
  { id: 'npc:snitch', role: 'snitch', name: 'Petey', at: 'police', spot: 'street' },
  { id: 'npc:police1', role: 'police', name: 'Officer Hale', at: 'police', spot: 'street' },
  { id: 'npc:police2', role: 'police', name: 'Officer Okafor', at: 'police', spot: 'street' },
  { id: 'npc:robber1', role: 'npcRobber', name: 'Mick Dunn', at: 'robberHome', spot: 'street' },
  { id: 'npc:robber2', role: 'npcRobber', name: 'Lyle Dunn', at: 'robberHome', spot: 'street' },
  { id: 'npc:rival1', role: 'rival', name: 'Cutter', at: 'rivalHome', spot: 'street', crew: 'the Sixes' },
  { id: 'npc:rival2', role: 'rival', name: 'Baby June', at: 'rivalHome', spot: 'street', crew: 'the Sixes' },
  { id: 'npc:rival3', role: 'rival', name: 'Moss', at: 'rivalHome', spot: 'street', crew: 'the Sixes' },
];

const SHOPKEEPER_NAMES = ['Mrs. Bao', 'Dez', 'Lindqvist', 'Auntie Fay', 'Gus', 'Imre'];

export const RIVAL_CREW_NAME = 'the Sixes';
export const NPC_ROBBERS_NAME = 'the Dunn brothers';

/** The names of the season's agents, one per seat, by seed. */
export function agentNames(seed, count) {
  if (count > AGENT_NAMES.length) throw new Error(`only ${AGENT_NAMES.length} agent names`);
  return shuffle(rng(seed, 'names'), AGENT_NAMES).slice(0, count);
}

/** The season's whole NPC cast: fixed people, shopkeepers, and each buyer block's regulars. */
export function buildCast(seed, map, cfg) {
  const npcs = {};
  for (const n of FIXED) {
    const block = n.held ? null : blocksWith(map, n.at)[0] ?? theBlock(map, 'police');
    npcs[n.id] = { id: n.id, role: n.role, name: n.name, block, held: n.held ?? null, spot: n.spot, ...(n.crew ? { crew: n.crew } : {}) };
  }
  blocksWith(map, 'shopkeeper').forEach((block, i) => {
    const id = `npc:shop:${block}`;
    npcs[id] = { id, role: 'shopkeeper', name: SHOPKEEPER_NAMES[i % SHOPKEEPER_NAMES.length], block, held: null, spot: 'counter:shop' };
  });
  const names = shuffle(rng(seed, 'regulars'), REGULAR_NAMES);
  let k = 0;
  const regulars = {};
  for (const block of blocksWith(map, 'buyers')) {
    regulars[block] = [];
    for (let i = 0; i < cfg.street.regularsPerBlock; i++) {
      const id = `npc:buyer:${block}:${i + 1}`;
      const name = names[k++ % names.length];
      npcs[id] = { id, role: 'buyer', name, block, held: null, spot: 'street' };
      regulars[block].push(id);
    }
  }
  return { npcs, regulars };
}
