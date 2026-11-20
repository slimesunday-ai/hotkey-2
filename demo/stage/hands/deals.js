// THE DEALS (anim-1): each transaction of the game as a few lines naming its parts. A deal is a list of moves
// (moves.js: who does what with what), read top to bottom; `['&', move, back]` starts that move WITH the one before it
// (`back` s before the one before it ends; none: when it began), so two people do things at once and one move overlaps
// the next. Roles are names (`buyer`, `seller`, `you`, `neighbour`): whoever plays them is given when it is staged.
//
//   stageDeal('buy', { people: { buyer: { x, z, yaw, scale }, seller: { … } }, cam: [x, z], goods: 'carton' }) → moves.js's staged timeline
//
// A NEW DEAL is a new entry here: its things (what, and where each starts: `<role>:pocket`, `<role>:store`, `bin:in`)
// and its moves. "Pay Dutch her fifth" is fetch, give, pocket; "learn a punch" is ask, answer, give (the money), nod.
// docs/animation/handing-things-over.md says how, and what the measures are.
import { stageHands } from './moves.js';

/**
 * How far apart two who deal stand, side by side: this much of the two sizes' sum (m). 0.44 m between two heads of
 * size 1. Wider (0.78 was tried), the sway that brings the hands together brought the heads' corners together too;
 * nearer, there is no gap to see the things in. test/hand-over.test.mjs holds both ends.
 */
export const STAND = 0.72;
/** A pocket picked: closer (the heads 4 cm apart; nothing is handed over in the gap, a hand goes to his hip). */
export const STAND_CLOSE = 0.52;

export const DEALS = {
  // BUYING: the ask (your outer hand out, your head to him) and his nod, your other hand already in your pocket; the
  // money out, seen, into his hand; he puts it away and his hand comes back out of his store with the goods, held
  // out a beat; into your hand; you look at them and tuck them away.
  // (Only the hands between the two reach each other: they stand side by side. The outer hands are for talk.)
  buy: ({ goods = 'carton' }) => ({
    things: { cash: { kind: 'cash', in: 'buyer:pocket' }, goods: { kind: goods, in: 'seller:store' } },
    moves: [
      // (the ask is the outer hand and the head; the inner hand is in the pocket for the money from the first frame)
      ['ask', 'buyer', 'seller', 'outer'],
      ['&', ['answer', 'seller', 'buyer', 'yes'], 0.22],
      ['@', 0, ['fetch', 'buyer', 'cash']],
      ['wait', 0.06],
      ['give', 'buyer', 'seller', 'cash', { lead: 0.26 }],
      // (into his pocket, and the same hand on to his store and out with the goods: one move, no coming to rest)
      ['pocket', 'seller', 'cash'],
      ['&', ['fetch', 'seller', 'goods'], 0.16],
      // (held out a moment before they go: seen in his hand)
      ['wait', 0.38],
      ['give', 'seller', 'buyer', 'goods', { lead: 0.26 }],
      ['look', 'buyer', 'goods', 0.2],
      ['&', ['nod', 'seller'], 0.16],
      ['tuck', 'buyer', 'goods'],
      ['&', ['settle', 'buyer', 0.2], 0.12],
      ['&', ['settle', 'seller', 0.2], 0.12],
    ],
  }),
  // A BIG PIECE BOUGHT (stage 2: a box fan, a safe, a fish tank: anything handHeld says one hand cannot carry,
  // things.js). IT NEVER LEAVES THE GROUND. The ask and his nod; he reaches back and slides it out from behind his hip,
  // round his side and in front, and pushes it on to stand in front of the gap between you, where it is seen whole
  // from any camera; the money passes over it into his hand; he pats it (yours); you put your hand on it, draw it over
  // in front of you and round your side, and it is put away behind you, as the carton is put away at the hip.
  buyBig: ({ goods }) => ({
    things: { cash: { kind: 'cash', in: 'buyer:pocket' }, piece: { kind: goods, in: 'seller:store' } },
    moves: [
      ['@', 0, ['ask', 'buyer', 'seller', 'outer']],
      ['@', 0.2, ['answer', 'seller', 'buyer', 'yes']],
      ['bringOut', 'seller', 'piece', 'buyer'],
      ['&', ['fetch', 'buyer', 'cash'], 0.5],
      ['wait', 0.06],
      ['give', 'buyer', 'seller', 'cash', { lead: 0.24 }],
      ['pocket', 'seller', 'cash'],
      ['&', ['pat', 'seller', 'piece', 'buyer'], 0.1],
      ['claim', 'buyer', 'piece'],
      ['&', ['nod', 'seller'], 0.7],
      ['&', ['settle', 'seller', 0.25], 0.3],
      ['settle', 'buyer', 0.25],
    ],
  }),
  // A LOOSE CIGARETTE SOLD (stage 2; the owner: people are seen USING what they got). He asks with his outer hand while
  // yours is already in your pocket for one; out, over, and straight to his lips; your hand out for the money: he digs
  // it out and pays, you put it away (and you are let go: `back`). Not paid (`paid: false`, a sale gone wrong, the
  // smoke gone with it): your hand stays out, he turns his shoulder on you, and you throw up your hands.
  // EITHER WAY HE SMOKES IT where he stands, while you have the next hour: the lighter under his chin, the flame, two
  // long drags with the end glowing and the smoke coming off him, and the end flicked away to go out on the ground.
  sell: ({ paid = true }) => ({
    things: { smoke: { kind: 'cig', in: 'seller:pocket' }, cash: { kind: 'cash', in: 'buyer:pocket' }, lighter: { kind: 'lighter', in: 'buyer:pocket' } },
    moves: [
      ['ask', 'buyer', 'seller', 'outer'],
      ['@', 0, ['fetch', 'seller', 'smoke']],
      ['give', 'seller', 'buyer', 'smoke', { lead: 0.22 }],
      ['mouth', 'buyer', 'smoke'],
      ['&', ['holdOut', 'seller', 'buyer'], 0.26],
      ...(paid
        ? [['fetch', 'buyer', 'cash'], ['give', 'buyer', 'seller', 'cash', { lead: 0.22 }], ['pocket', 'seller', 'cash'], ['&', ['nod', 'buyer'], 0.36], ['settle', 'seller', 0.2], ['back', 'seller'], ['&', ['light', 'buyer', 'smoke', 'lighter'], 0.3]]
        : [['snub', 'buyer', 'seller'], ['&', ['throwUp', 'seller'], 0.12], ['settle', 'seller', 0.2], ['back', 'seller'], ['&', ['light', 'buyer', 'smoke', 'lighter'], 0.5]]),
      ['drag', 'buyer', 'smoke'],
      ['wait', 0.25],
      ['drag', 'buyer', 'smoke'],
      ['flick', 'buyer', 'smoke'],
      ['settle', 'buyer'],
    ],
  }),
  // ── STAGE 2 ──
  // A BOOTLEG DISC SOLD: he asks, you have one out of your pocket, his money over first (paid) or not (he just takes it,
  // you throw up your hands), the disc into his hand; you are let go, and he looks it over, turns it, and tucks it away
  sellDisc: ({ paid = true }) => ({
    things: { goods: { kind: 'disc', in: 'seller:pocket' }, cash: { kind: 'cash', in: 'buyer:pocket' } },
    moves: paid
      ? [['ask', 'buyer', 'seller', 'outer'], ['&', ['answer', 'seller', 'buyer', 'yes'], 0.22], ['@', 0, ['fetch', 'buyer', 'cash']], ['wait', 0.06], ['give', 'buyer', 'seller', 'cash', { lead: 0.24 }], ['pocket', 'seller', 'cash'], ['&', ['fetch', 'seller', 'goods'], 0.16], ['wait', 0.2], ['give', 'seller', 'buyer', 'goods', { lead: 0.24 }], ['&', ['nod', 'seller'], 0.1], ['settle', 'seller', 0.2], ['back', 'seller'], ['look', 'buyer', 'goods', 0.6], ['tuck', 'buyer', 'goods'], ['settle', 'buyer']]
      : [['ask', 'buyer', 'seller', 'outer'], ['@', 0, ['fetch', 'seller', 'goods']], ['give', 'seller', 'buyer', 'goods', { lead: 0.22 }], ['&', ['holdOut', 'seller', 'buyer'], 0.2], ['snub', 'buyer', 'seller'], ['&', ['throwUp', 'seller'], 0.12], ['settle', 'seller', 0.2], ['back', 'seller'], ['look', 'buyer', 'goods', 0.5], ['tuck', 'buyer', 'goods'], ['settle', 'buyer']],
  }),
  // BOUGHT AND USED THERE AND THEN (the errands: a chopped cheese from Gloria, an energy drink from Mrs. Bao): the money
  // over, the thing over, two bites (two swigs, the head back), and the rest put away
  // (hands-2: CONTROL BACK WHEN IT IS HANDED OVER, and he eats or drinks on while you choose, as the buyer of a cigarette
  // smokes on (`back`; the next hour cuts it). Played to its end before, 3.86 s, the drink was over its time whenever the
  // two had to be stood first: 4 runs of 5)
  buyUse: ({ goods = 'sandwich' }) => ({
    things: { cash: { kind: 'cash', in: 'buyer:pocket' }, goods: { kind: goods, in: 'seller:store' } },
    moves: [['@', 0, ['fetch', 'buyer', 'cash']], ['@', 0.08, ['nod', 'seller']], ['wait', 0.5], ['give', 'buyer', 'seller', 'cash', { lead: 0.22 }], ['pocket', 'seller', 'cash'], ['&', ['fetch', 'seller', 'goods'], 0.16], ['wait', 0.12], ['give', 'seller', 'buyer', 'goods', { lead: 0.22 }], ['&', ['settle', 'seller', 0.2], 0.05], ['back', 'seller'], ['bite', 'buyer', 'goods', { n: 2, by: goods === 'can' ? 0 : 0.3 }], ['tuck', 'buyer', 'goods'], ['settle', 'buyer', 0.2]],
  }),
  // (hands-2) A THING TO WEAR, bought and PUT ON there and then (the owner's payoff: people seen using what they got):
  // the money over, the piece over, a look at it, and on: up to the head, against the front, down at the feet. From
  // that moment the figure wears it (perform.js, `wear`). Bought with that slot already worn (`on: false`), it is kept
  // and tucked away, as the rules have it (put on later, at the crib)
  buyWear: ({ goods = 'wear:top', slot = 'top', on = true }) => ({
    things: { cash: { kind: 'cash', in: 'buyer:pocket' }, goods: { kind: goods, in: 'seller:store' } },
    moves: [['@', 0, ['fetch', 'buyer', 'cash']], ['@', 0.08, ['nod', 'seller']], ['wait', 0.5], ['give', 'buyer', 'seller', 'cash', { lead: 0.22 }], ['pocket', 'seller', 'cash'], ['&', ['fetch', 'seller', 'goods'], 0.16], ['wait', 0.12], ['give', 'seller', 'buyer', 'goods', { lead: 0.22 }], ['look', 'buyer', 'goods', 0.4],
      ...(on ? [['putOn', 'buyer', 'goods', slot], ['&', ['nod', 'seller'], 0.05], ['admire', 'buyer', slot]] : [['tuck', 'buyer', 'goods'], ['&', ['nod', 'seller'], 0.1]]),
      ['&', ['settle', 'seller', 0.2], 0.3], ['settle', 'buyer', 0.2]],
  }),
  // (hands-2) A PAIR OFF THE SNEAKER WALL AT DROP: up to the shop's wall, a hand to it and away with a pair, held out
  // beside the head and looked at; a look back over the shoulder; tucked at the hip, and off. Seen (`caught`): put back
  // on the wall and the hands thrown up (the clerk points, and he runs: the scene's own steps after it)
  swipe: ({ caught = false, rim, inside }) => ({
    things: { pair: { kind: 'wear:shoes', in: 'bin:in', at: inside } },
    moves: [['reach', 'you', rim, 'pair'], ['glance', 'you'], ...(caught ? [['putBack', 'you', 'pair', rim], ['throwUp', 'you']] : [['tuck', 'you', 'pair']]), ['settle', 'you', 0.25]],
  }),
  // A POCKET PICKED (a wallet at the bus stop, in the crowd): you look off the other way while your near hand goes to his
  // near pocket and away to yours. Felt (`felt`): his head round, his hand on yours, and he has it back; your hands up
  // (closer than a deal stands: `stand`, heads 4 cm apart, a hand reaches his hip. perform.js setUp reads it)
  lift: ({ felt = false }) => ({
    things: { wallet: { kind: 'wallet', in: 'seller:pocket' } },
    moves: [['dip', 'buyer', 'seller', 'wallet', { felt }], ['&', ['settle', 'buyer', 0.25], 0.05], ['settle', 'seller', 0.25]],
  }),
  // A STICK-UP WITH THE BOX CUTTER: out of your pocket and up at her, jabbed; her hands up, then her near hand into her
  // apron and the money held out; into your hand and your pocket, and the cutter away. Gone wrong (`win: false`): she
  // shoves you off, and you put it away
  // (hands-2, the owner: "it doesnt read as gone wrong, nothing happens to our agent". Gone wrong it LANDS ON HIM: she
  // shoves him off hard, he is knocked back a metre and more, nearly goes down and catches himself, puts the blade away
  // and backs off with his hands half up; she points after him shouting, and whoever is near turns to look. `room`: the
  // metres free behind him, perform.js)
  stickup: ({ win = true, room = 1.9, dir = null }) => ({
    things: { cutter: { kind: 'boxcutter', in: 'buyer:pocket' }, cash: { kind: 'cash', in: 'seller:store' } },
    moves: win
      ? [['fetch', 'buyer', 'cutter', 'outer'], ['threat', 'buyer', 'seller', 'cutter', 0.4], ['&', ['handsUp', 'seller', 1.4], 0.3], ['wait', 0.2], ['fetch', 'seller', 'cash'], ['wait', 0.12], ['give', 'seller', 'buyer', 'cash', { lead: 0.22 }], ['pocket', 'buyer', 'cash'], ['pocket', 'buyer', 'cutter'], ['&', ['settle', 'seller', 0.3], 0.3], ['settle', 'buyer', 0.2]]
      : [['fetch', 'buyer', 'cutter', 'outer'], ['threat', 'buyer', 'seller', 'cutter', 0.4], ['shoveOff', 'seller', 'buyer', { room, dir }], ['backOff', 'buyer', 'seller', 'cutter', { room, dir }], ['settle', 'seller', 0.25], ['&', ['settle', 'buyer', 0.2], 0]],
  }),
  // A LESSON (quick hands, the haymaker, the throw): the money over and away; he shows it at the air, you do it after him,
  // and he nods
  lesson: ({ style = 'jab' }) => ({
    things: { cash: { kind: 'cash', in: 'buyer:pocket' } },
    moves: [['@', 0, ['fetch', 'buyer', 'cash']], ['@', 0.08, ['nod', 'seller']], ['wait', 0.5], ['give', 'buyer', 'seller', 'cash', { lead: 0.22 }], ['pocket', 'seller', 'cash'], ['show', 'seller', style], ['show', 'buyer', style], ['&', ['nod', 'seller'], 0.3], ['settle', 'seller', 0.2], ['settle', 'buyer', 0.2]],
  }),
  // THE BARBER: paid; the scissors out, at work at the side of your head, the bits dropping; and you run a hand over it
  haircut: () => ({
    things: { cash: { kind: 'cash', in: 'buyer:pocket' }, scissors: { kind: 'scissors', in: 'seller:store' } },
    moves: [['@', 0, ['fetch', 'buyer', 'cash']], ['@', 0.08, ['nod', 'seller']], ['wait', 0.5], ['give', 'buyer', 'seller', 'cash', { lead: 0.22 }], ['pocket', 'seller', 'cash'], ['&', ['fetch', 'seller', 'scissors'], 0.16], ['cut', 'seller', 'buyer', 'scissors'], ['pocket', 'seller', 'scissors'], ['&', ['preen', 'buyer'], 0.2], ['&', ['nod', 'seller'], 0.1], ['settle', 'seller', 0.2], ['settle', 'buyer', 0.2]],
  }),
  // REFUSED (the seller will not sell): the ask; no, with a hand up between them; the money is never out.
  refused: () => ({
    things: {},
    moves: [['ask', 'buyer', 'seller'], ['&', ['answer', 'seller', 'buyer', 'no'], 0.2], ['wait', 0.25], ['settle', 'buyer'], ['settle', 'seller']],
  }),
  // PAYING SOMEBODY (a debt handed on, a fifth of the day's take): the money out, into their hand, put away, a nod.
  // (stage 2: `count`: whoever is paid weighs it in the hand and looks it over first: Dutch her fifth, Cousin Earl his
  // three days, you a debt collected for Darlene)
  pay: ({ count = false } = {}) => ({
    things: { cash: { kind: 'cash', in: 'buyer:pocket' } },
    moves: [['fetch', 'buyer', 'cash'], ['give', 'buyer', 'seller', 'cash'], ...(count ? [['count', 'seller', 'cash', 0.5]] : []), ['pocket', 'seller', 'cash'], ['&', ['nod', 'buyer'], 0.3], ['settle', 'buyer'], ['settle', 'seller']],
  }),
  // THE BINS: onto it, in over it, three strokes of the arm with the body going after it, and up: with nothing (the
  // hands turned up, wiped down the trousers), a little (coins looked at in the palm and pocketed), or a find (held
  // up, then tucked away). SEEN: a neighbour watching from a little way off; you look over your shoulder when it is
  // done, too late, and they shake their head and turn their back (`cold`); or they had already looked away, a hand
  // at their neck (`away`: they are with you).
  bins: ({ find = 'nothing', seen = null, rim, inside, seenAt = 0.7 }) => ({
    things: find === 'nothing' ? {} : { found: { kind: find === 'find' ? 'find' : 'coins', in: 'bin:in', at: inside } },
    moves: [
      ['leanIn', 'you', rim, inside],
      // (`seenAt`: when whoever saw is standing there: at once, or when their walk over brings them: perform.js)
      ...(seen ? [['@', seenAt, ['watch', 'neighbour', 'you', seen === 'away' ? 0.9 : 1.9]], ...(seen === 'away' ? [['@', seenAt + 0.9, ['turnAway', 'neighbour', 'away']]] : [])] : []),
      ['rummage', 'you', { n: 3, s: 0.42 }],
      ['comeUp', 'you', find === 'nothing' ? null : 'found'],
      ...(find === 'nothing' ? [['wipe', 'you']] : find === 'little' ? [['count', 'you', 'found'], ['pocket', 'you', 'found']] : [['holdUp', 'you', 'found', 0.6], ['tuck', 'you', 'found']]),
      ...(seen ? [['lookOver', 'you', 'neighbour', 0.5], ...(seen === 'cold' ? [['&', ['turnAway', 'neighbour', 'cold'], 0.55]] : [])] : []),
      ['settle', 'you'],
      ...(seen ? [['settle', 'neighbour']] : []),
    ],
  }),
};

/** A deal staged: `name` (DEALS) or `{ things, moves }`; `people` by role; whatever else the deal is told (`goods`, `find`, `seen`, `rim`, `inside`). */
export function stageDeal(name, { people, cam = null, ...told }) {
  const D = typeof name === 'string' ? DEALS[name](told) : name;
  const S = stageHands({ people, things: D.things, cam });
  let began = 0;
  const run = m => {
    const [verb, ...args] = m;
    if (verb === '&') {
      const [move, back = null] = args;
      // (with the move before it: from when that began, or `back` s before it ended)
      S.also(() => {
        if (back === null) S.wait(began - S.t);
        run(move);
      }, back);
      return;
    }
    if (verb === '@') {
      const [t, move] = args;
      S.also(() => {
        S.wait(t - S.t);
        run(move);
      });
      return;
    }
    began = S.t;
    // (`far`: the hand away from the camera, for what is held ready while the near one does the business)
    if (verb === 'fetch' && args[2] === 'far') args[2] = S.farHand(args[0]);
    // (`outer`: the hand away from the other one of a pair)
    if (verb === 'fetch' && args[2] === 'outer') args[2] = S.outerHand(args[0], Object.keys(people).find(k => k !== args[0] && k !== 'neighbour'));
    // (`outer`: the hand away from whoever it is said to; the inner one is left free for what is handed over)
    if (verb === 'ask' && args[2] === 'outer') args[2] = S.outerHand(args[0], args[1]);
    if (typeof S[verb] !== 'function') throw new Error(`a deal has no move "${verb}"`);
    S[verb](...args);
  };
  for (const m of D.moves) run(m);
  return S.done();
}
