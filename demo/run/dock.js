// THE DOCK (ui-3, leg 2; the review's item 4): what the bar offers, as data. Pure: the rules' view in, and out the
// three things in front of you (keys 1 to 3) and the six verbs that never move, renumber or vanish (Shop B, Rob R,
// Bins X, Travel T, Home H, Sleep Z), each with the rules' choice keys it reaches and, when none can be made now, why.
// The page draws it (index.js paintDock) and its keys answer to it (index.js keyOf). Tested in node:
// test/run-dock.test.mjs (every choice the rules offer is reachable from the dock; the verbs are always the same six).
//
// dockOf({ cfg, v, state }) → {
//   kind:  'street' | 'stop' | 'crib' | 'door' | 'held'
//   cards: [three slots] each { n: 1|2|3, keys: [rules' choice keys, the one shown first], role, empty: why nothing }
//          role 'job' (a dealt option) · 'card' (a stop's hand) · 'out' (stepping out) · 'goal' (one of the three things
//          to own) · 'guard' (Cousin Earl) · 'give' · 'refuse' (a regular at your door) · 'morning' · 'pay' ·
//          'refuseTax' (sixes-1: Dutch waiting by the steps for the tax) · null (empty)
//   verbs: [six] each { id, key, label, keys: [rules' choice keys], list: whether it opens a list, why: when none }
// }

/** The six verbs, in the order they stand on the dock. */
export const VERBS = [
  { id: 'shop', key: 'B', label: 'Shop', list: true },
  { id: 'rob', key: 'R', label: 'Rob' },
  { id: 'bins', key: 'X', label: 'Bins' },
  { id: 'travel', key: 'T', label: 'Travel', list: true },
  { id: 'home', key: 'H', label: 'Home' },
  { id: 'sleep', key: 'Z', label: 'Sleep' },
];
/** The page's keys for the three things in front of you. */
export const CARD_KEYS = ['1', '2', '3'];

const byDo = (v, ...dos) => (v.moves ?? []).filter(m => dos.includes(m.choice.do));

/** The choice keys a verb reaches here, the one it picks first at the head (available before not, then the rules' order). */
function verbKeys(id, { v }) {
  if (id === 'shop') {
    // what is sold where you stand: the place's shop (food), the connect's pack, its things (to wear, for the trailer,
    // to ride, to defend your door); at the crib, the three things bought from banked money
    // and Cousin Earl's stretch on your step, paid from banked like them
    // (styles-1: and a punch style taught here, from what you carry)
    // (and a shop on the walk, beside the stop's hand: the barber, whenever you have heat to cool)
    // (raid-1: and a box of rounds for a gun of yours, where its seller stands)
    return byDo(v, 'shop', 'pack', 'get', 'learn', 'ammo').map(m => m.key)
      .concat((v.hand ?? []).filter(c => c.beside).map(c => c.key))
      .concat(v.place === 'crib' ? (v.shop ?? []).filter(s => s.key && !s.owned).map(s => s.key) : [])
      .concat(byDo(v, 'guard').map(m => m.key));
  }
  if (id === 'rob') return byDo(v, 'rob').map(m => m.key);
  if (id === 'bins') return byDo(v, 'bins').map(m => m.key);
  if (id === 'travel') {
    // every way from here: the subway (paid or hopped, out or home), on foot and on the board, the way on from a stop.
    // The way into the crib is Home's
    return byDo(v, 'subway', 'walk', 'skate', 'onward').map(m => m.key);
  }
  if (id === 'home') {
    // the quickest way home that can be made: in through your door; the subway home, paid before hopped; on foot or
    // on the board home; on from a stop when the way ends at home
    const ways = [
      ...byDo(v, 'inside'),
      ...byDo(v, 'subway').filter(m => m.home && !m.choice.hop),
      ...byDo(v, 'walk', 'skate', 'onward').filter(m => m.home),
      ...byDo(v, 'subway').filter(m => m.home && m.choice.hop),
    ];
    const best = ways.find(m => m.available) ?? ways[0];
    return best ? [best.key, ...ways.filter(m => m !== best).map(m => m.key)] : [];
  }
  if (id === 'sleep') return byDo(v, 'sleep', 'rough').map(m => m.key);
  return [];
}

/** Why a verb has nothing here at all (its keys are none): the player's words. */
function verbWhy(id, { cfg, v }) {
  const held = v.place === 'jail' || v.place === 'clinic';
  if (held) return v.place === 'jail' ? 'in jail till morning' : 'in the clinic till morning';
  const crib = v.place === 'crib';
  const stop = !!v.route;
  if (id === 'shop') return stop ? 'nothing sold on the way' : 'nothing sold here';
  if (id === 'rob' || id === 'bins') {
    if (crib) return 'not at home';
    if (stop) return id === 'bins' ? 'the dumpster is one of the cards' : 'nobody to rob on the way';
    return id === 'rob' ? 'nobody to rob here' : 'no bins here';
  }
  if (id === 'travel') return crib ? 'step out first' : 'no way on from here';
  if (id === 'home') return crib ? 'you are home' : stop ? `on the way to ${cfg.places[v.route?.to]?.label ?? 'somewhere'}: T goes on` : 'no way home from here';
  if (id === 'sleep') return stop ? 'not on the way: go on' : cfg.places[v.place]?.door ? 'go inside to sleep (H)' : 'not here';
  return 'not here';
}

/** The three things in front of you. */
function cardsOf({ v }) {
  const slot = (n, keys, role, empty = null) => ({ n, keys: keys.filter(Boolean), role: keys.filter(Boolean).length ? role : null, empty });
  const held = v.place === 'jail' || v.place === 'clinic';
  if (held) {
    const m = byDo(v, 'morning')[0];
    return [slot(1, [m?.key], 'morning', 'the day is over'), slot(2, [], null, 'the day is over'), slot(3, [], null, 'the day is over')];
  }
  if (v.place === 'crib') {
    const out = byDo(v, 'out')[0];
    if (v.door) {
      const give = byDo(v, 'give')[0];
      const refuse = byDo(v, 'refuse')[0];
      return [slot(1, [give?.key], 'give'), slot(2, [refuse?.key], 'refuse'), slot(3, [out?.key], 'out')];
    }
    // the next of the three to own: the cheapest not yet yours first, the others after it (↑ ↓ change it)
    const goals = (v.shop ?? []).filter(s => s.key && !s.owned).sort((a, b) => a.price - b.price).map(s => s.key);
    const guard = byDo(v, 'guard')[0];
    return [slot(1, [out?.key], 'out'), slot(2, goals, 'goal', 'all three are yours'), slot(3, [guard?.key], 'guard', 'nobody to hire')];
  }
  // (sixes-1: Dutch waiting by the subway steps: pay her or refuse, the two in front of you until it is answered)
  const tax = byDo(v, 'tax');
  if (tax.length) {
    const pay = tax.find(m => m.choice.pay);
    const no = tax.find(m => !m.choice.pay);
    // (the dealt options wait behind the third, each saying why: she is waiting)
    return [slot(1, [pay?.key], 'pay'), slot(2, [no?.key], 'refuseTax'), slot(3, (v.options ?? []).map(o => o.key), 'job', 'Dutch is waiting: pay her or refuse')];
  }
  if (v.route) {
    // (the three dealt; a shop on the walk is beside them, under Shop (B), and takes none of the three)
    const hand = (v.hand ?? []).filter(c => !c.beside);
    return [0, 1, 2].map(i => slot(i + 1, [hand[i]?.key], 'card', i ? 'nothing else dealt here' : 'nothing dealt here: go on (T)'));
  }
  const opts = v.options ?? [];
  return [0, 1, 2].map(i => slot(i + 1, [opts[i]?.key], 'job', 'nobody else to work this hour'));
}

/** The dock for a view (see the head of the file). */
export function dockOf({ cfg, v }) {
  const held = v.place === 'jail' || v.place === 'clinic';
  const kind = held ? 'held' : v.place === 'crib' ? (v.door ? 'door' : 'crib') : v.route ? 'stop' : byDo(v, 'tax').length ? 'tax' : 'street';
  const verbs = VERBS.map(d => {
    const keys = held ? [] : verbKeys(d.id, { v });
    const choices = keys.map(k => v.choices.find(c => c.key === k)).filter(Boolean);
    // (one that can be made first; with none, the first one's own why)
    const ok = choices.filter(c => c.available);
    const order = d.list ? [...ok, ...choices.filter(c => !c.available)].map(c => c.key) : keys;
    // (a list with nothing to be had says the why that matters most: short of cash, before the rest)
    const why = !keys.length ? verbWhy(d.id, { cfg, v }) : ok.length ? null : (d.list ? choices.find(c => /^you (carry|have) \$/.test(c.why ?? ''))?.why : null) ?? choices[0]?.why ?? verbWhy(d.id, { cfg, v });
    return { ...d, keys: order, why };
  });
  return { kind, cards: cardsOf({ v }), verbs };
}

/**
 * Where a rules' choice key is on the dock: { card: n } or { verb: id }, the first place it is found (a card before a
 * verb), or null (the choice is not on the dock: what you wear, at the crib, is the You panel's). For the panels'
 * "now" tags and the tools.
 */
export function placeOf(dock, key) {
  const c = dock.cards.find(s => s.keys.includes(key));
  if (c) return { card: c.n, key: CARD_KEYS[c.n - 1] };
  const verb = dock.verbs.find(d => d.keys.includes(key));
  return verb ? { verb: verb.id, key: verb.key } : null;
}

/**
 * WHO HAS THE ARROWS (and Home, End) while the run is choosing (join-1, the Library's fix): an open map pans with them,
 * the Library's grid keeps them whenever the Library is open and the game is choosing, wherever the focus went (a
 * scene that ended while it was open used to leave them on the dock); else the dock. Not choosing: nobody's (null).
 */
export function arrowsTo({ sheet = null, phase, hold = false }) {
  if (phase !== 'choose') return null;
  if (sheet === 'map') return 'map';
  if (sheet === 'library' && !hold) return 'library';
  // (tree-1: the Ahead panel's arrows walk its trees)
  if (sheet === 'ahead' && !hold) return 'ahead';
  return 'dock';
}

