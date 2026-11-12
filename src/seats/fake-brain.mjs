// The fake model's brain for a whole fake season (SPEC section 18: "one fake AI season"): the scripted bots,
// speaking through the reply format an AI seat uses. New in hotkey 2 (mini's fake picked menu lines by hash).
//
// createAiSeats({ transport: 'fake', fakeBrain: botBrain(game) }) asks this for every unscripted call. It runs the
// class's bot on the same view the prompt was built from, turns the bot's move back into a menu choice
// ({ id: 'm3', ...args }), and hands the fake transport a reply object to send as JSON. The seat layer then parses
// that text like any model's reply, so the prompt, the transport, the parser and the season all run for $0.
// It needs the game because the bots read the state; it only ever reads the hour being played, so it is as
// deterministic as the bots are.
import { hourContext } from '../resolve.mjs';
import { setPolice } from '../npc.mjs';
import { chooseFromMenu } from '../menu.mjs';
import { botReply, botJournal } from '../bots.mjs';
import { rng } from '../rng.mjs';

const isObject = x => !!x && typeof x === 'object' && !Array.isArray(x);
// Two values with the same content, whatever order their keys are in.
const canon = x => (Array.isArray(x) ? x.map(canon) : isObject(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canon(x[k])])) : x);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

// Chems and parts have no quality: a line that carries one for them means the same move.
const plain = move => (move?.verb === 'offer' && ['chems', 'parts'].includes(move.terms?.good) ? { ...move, terms: { ...move.terms, q: undefined } } : move);

const OFFER_KEYS = ['n', 'each', 'price', 'pay', 'amount', 'repay', 'due', 'hours', 'q', 'cash', 'courier', 'task', 'sharePct'];

/** What tells one menu line of a verb from another: where, who, how, which kind. */
function identity(move) {
  switch (move?.verb) {
    case 'move': return [move.to];
    case 'work': return [move.option ?? null];
    case 'attack': return [move.target, move.how];
    case 'offer': return [['fence', 'gunshop', 'police'].includes(move.to) ? move.to : 'player', move.terms?.kind, move.terms?.good ?? null, move.terms?.tip ?? null, move.terms?.id ?? null, move.terms?.task?.type === 'recover'];
    case 'stash': return [Math.sign(move.amount ?? 0)];
    case 'crew': return [move.action];
    case 'quit': return [move.id];
    default: return [];
  }
}

/** The arguments a choice would carry to rebuild `move` from a menu line. */
function argsFor(entry, move) {
  const spec = isObject(entry.args) ? entry.args : {};
  const out = {};
  if (move.verb === 'offer') {
    if (spec.to) out.to = move.to;
    for (const key of OFFER_KEYS) if (move.terms?.[key] !== undefined && (spec[key] || key === 'sharePct')) out[key] = move.terms[key];
    if (move.terms?.kind === 'gift' && move.terms.good) Object.assign(out, { good: move.terms.good, n: move.terms.n, q: move.terms.q ?? 1 });
  } else if (move.verb === 'stash') {
    if (spec.amount) out.amount = move.amount;
  } else if (move.verb === 'crew') {
    for (const key of ['name', 'agent', 'pct', 'amount']) if (spec[key] && move[key] !== undefined) out[key] = move[key];
  }
  return out;
}

/**
 * A structured move as a menu choice: { choice, exact }. `exact` is false when the menu has a line of the same kind
 * but can't carry every term (the bots sell on credit, which the menu doesn't offer). null when no line fits.
 */
export function menuChoice(menu, move) {
  if (!isObject(move) || !Array.isArray(menu)) return null;
  // Plain `work` is the class's usual job, and the menu lists that one first.
  if (move.verb === 'work' && (move.option === undefined || move.option === null)) {
    const usual = menu.find(e => e.verb === 'work');
    return usual ? { choice: { id: usual.id }, exact: true } : null;
  }
  let near = null;
  for (const entry of menu) {
    if (entry.verb !== move.verb) continue;
    const choice = { id: entry.id, ...argsFor(entry, move) };
    const made = chooseFromMenu(menu, choice);
    if (same(plain(made), plain(move))) return { choice, exact: true };
    if (!near && same(identity(made), identity(move))) near = { choice, exact: false };
  }
  return near;
}

/**
 * The brain for a fake season of `game`. `counts` adds up how the bots' moves came through the menu:
 * { exact, near, off } (off: no menu line fits, so the seat rests).
 */
export function botBrain(game, counts = { exact: 0, near: 0, off: 0 }) {
  const brain = ({ agentId, view, kind }) => {
    const { cfg, map, state } = game;
    const agent = state.agents[agentId];
    if (kind === 'journal') {
      const j = botJournal(hourContext({ cfg, map, state, t: state.t - 1 }), agent);
      return { believe: j.lines[0], trust: j.lines[1], tomorrow: j.lines[2], ask: j.ask };
    }
    const ctx = hourContext({ cfg, map, state });
    setPolice(ctx);
    // An AI seat has no lean of its own; the bot playing it gets one by seed, the way a bot seat does.
    const lean = agent.lean ?? (rng(state.seed, 'lean', agent.id)() < 0.5 ? 'bold' : 'careful');
    const had = agent.lean;
    agent.lean = lean;
    const r = botReply(ctx, agent, view);
    agent.lean = had;
    let move = null;
    if (r.move) {
      const found = menuChoice(view.menu, r.move);
      counts[found ? (found.exact ? 'exact' : 'near') : 'off'] += 1;
      move = found ? found.choice : (view.menu.find(m => m.verb === 'rest') ? { id: view.menu.find(m => m.verb === 'rest').id } : null);
    }
    // A bot speaks to the viewers only some hours. The fake fills the quiet ones with one plain line about its move,
    // so a fake season's page and every seat's memory have a confessional to show.
    const line = move ? view.menu.find(m => m.id === move.id) : null;
    const confessional = r.confessional ?? (line ? `${agent.name} here. This hour: ${line.label}.`.slice(0, 240) : null);
    return { move, accept: r.accept ?? [], say: r.say ?? null, message: r.message ?? null, confessional };
  };
  brain.counts = counts;
  return brain;
}
