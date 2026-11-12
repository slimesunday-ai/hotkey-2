// The HUD's rules with no page in them (SPEC section 24): what a seat may be shown, the odds bar's geometry, the reason
// chips, how the menu is grouped, the forecast strip, the hour's ticker and its timing. Everything here is plain data
// in and plain data out, so `node --test` can hold it to account (test/hud.test.mjs).

import { witnessed } from '../../src/session.mjs';
import { describe, nameOf, money, clockOf, blockName, possessive } from '../../src/words.mjs';
import { streetUnitPrice, cookQuality, cookUnits, streetGunPrice } from '../../src/market.mjs';
import { distance, stepToward, blocksWith } from '../../src/map.mjs';
import { LINES, SITUATIONS, situationOf } from '../../src/lines.mjs';
import { SKILL_TEXT } from '../../src/skills.mjs';

// ---------------------------------------------------------------------------------------------------------------
// Seats and modes, in a sentence each

export const MODE_TEXT = Object.freeze({
  watch: ['Watch', 'Bots play all ten seats. You see everything: every roll, every message, every confessional.'],
  play: ['Play', 'You pick every move for one seat. You see only what your character sees.'],
  coach: ['Coach', 'A bot plays your seat. Each night you pick its skills, its stance and one order.'],
});

export const SEAT_TEXT = Object.freeze({
  dealer: ['Dealer', 'Sells product to street buyers. The money rides in your pocket until you stash it.'],
  robber: ['Robber', 'Takes what other people carry. Every job shows its odds before you commit.'],
  smuggler: ['Smuggler', 'Brings chems and parts in at the docks and sells them up the chain.'],
  cook: ['Cook', 'Turns chems into product at home. The whole chain needs you.'],
  gunrunner: ['Gunrunner', 'Builds guns from parts and sells them, on the street or to the others.'],
  muscle: ['Muscle', 'Hired by the hour to guard people and to collect debts.'],
  informant: ['Informant', 'Watches, collects tips and sells them to whoever pays, the police included.'],
});

export const MORE_SEATS = Object.freeze(['gunrunner', 'muscle', 'informant']);

// ---------------------------------------------------------------------------------------------------------------
// What may be seen (SPEC 24.5). Watching shows the whole hour. Playing or coaching shows the events the seat took
// part in or stood on the block for, and never another seat's private message, confessional, cash or roll.

const partOf = (event, id) => Object.values(event?.who ?? {}).includes(id);

/**
 * The events of an hour this viewer may be shown. `mode` is watch, play or coach; `you` is the seat's agent id.
 * The engine seals private business for anyone who only stood near it (src/stage.mjs, SEALED): who and where, no
 * words, no price, no other party. A public contest keeps its outcome for a bystander, and here loses its dice.
 */
export function seenOf(line, you, mode) {
  const events = line?.events ?? [];
  if (mode === 'watch' || !you) return events.slice();
  return witnessed(line, you).map(event => {
    if (event.sealed || !event.data?.roll || partOf(event, you)) return event;
    const { roll, ...data } = event.data;
    return { ...event, data };
  });
}

/** The rolls of an hour this viewer may be shown: all of them when watching, otherwise only the seat's own. */
export function rollsOf(line, you, mode) {
  const rolls = line?.rolls ?? [];
  if (mode === 'watch' || !you) return rolls.slice();
  return rolls.filter(r => r.attacker === you || r.defender === you);
}

/** The plain chances rolled in an hour (a bust, a blow-up, a sting) this viewer may be shown: the same rule. */
export function risksOf(line, you, mode) {
  const risks = (line?.risks ?? []).filter(r => r.chance > 0);
  if (mode === 'watch' || !you) return risks;
  return risks.filter(r => r.agent === you);
}

/**
 * The hour's talk, by kind (SPEC 24.7): out loud, private, and to the camera.
 *   said          [{ from, to?, text }]        a white bubble over the speaker
 *   messages      [{ from, to, text }]         a phone chip between the two; `text` and `to` are null when sealed
 *   confessionals [{ from, text }]             a lower-third caption
 * Playing shows no confessional. Coaching shows the one your own agent gave.
 */
export function talkOf(line, you, mode) {
  const said = [];
  const messages = [];
  for (const event of seenOf(line, you, mode)) {
    if ((event.kind === 'say' || event.kind === 'say:block') && event.say?.text) {
      said.push({ from: event.who.speaker, ...(event.who.listener ? { to: event.who.listener } : {}), text: event.say.text });
    } else if (event.kind === 'message') {
      messages.push(event.sealed ? { from: event.who.sender, to: null, text: null } : { from: event.who.sender, to: event.who.receiver, text: event.say?.text ?? null });
    }
  }
  const confessionals = [];
  for (const [id, a] of Object.entries(line?.agents ?? {})) {
    if (!a.confessional) continue;
    if (mode === 'watch' || (mode === 'coach' && id === you)) confessionals.push({ from: id, text: a.confessional });
  }
  return { said, messages, confessionals };
}

// ---------------------------------------------------------------------------------------------------------------
// The odds bar (SPEC 24.6)

export const BANDS = Object.freeze(['clean', 'messy', 'fail', 'disaster']);
export const BAND_WORDS = Object.freeze({ clean: 'clean win', messy: 'messy win', fail: 'fail', disaster: 'disaster' });

/** One bar, four segments: [{ key, pct, from, to }] in percent of the bar's width. Always adds up to 100. */
export function barOf(bands) {
  const raw = BANDS.map(key => Math.max(0, Number(bands?.[key]) || 0));
  const total = raw.reduce((a, b) => a + b, 0);
  let from = 0;
  return BANDS.map((key, i) => {
    const pct = total > 0 ? (raw[i] * 100) / total : i === 2 ? 100 : 0;
    const seg = { key, pct, from, to: from + pct };
    from += pct;
    return seg;
  });
}

/** The same bar for an hour of risky work: it goes fine, or the named thing happens. */
export function riskBarOf(risk) {
  const pct = Math.max(0, Math.min(100, Number(risk?.pct) || 0));
  return [{ key: 'clean', pct: 100 - pct, from: 0, to: 100 - pct, label: 'goes fine' }, { key: 'disaster', pct, from: 100 - pct, to: 100, label: risk?.what ?? 'trouble' }];
}

/** Where the needle lands for a roll of 0 to 99: the middle of that roll's own percent of the bar. */
export function needleOf(roll) {
  return Math.max(0.5, Math.min(99.5, (Number(roll) || 0) + 0.5));
}

/**
 * Where the needle lands on a risk bar. The bar draws "goes fine" first and the trouble at its right end, and the
 * engine's trouble is the low rolls, so the roll is mirrored: a roll under the chance lands in the trouble.
 */
export function riskNeedleOf(roll) {
  return 100 - needleOf(roll);
}

/** How far a risk roll was from trouble: "clear by 35", "caught by 2". */
export function riskMarginOf(risk) {
  return risk.hit ? { hit: true, by: risk.chance - risk.roll } : { hit: false, by: risk.roll - risk.chance + 1 };
}

/** Which segment a needle position sits in. */
export function segmentAt(segments, at) {
  return segments.find(s => at >= s.from && at < s.to) ?? segments[segments.length - 1];
}

/** How far the roll was from the win line, in points: "missed by 3", "made it by 12". */
export function marginOf(roll) {
  const by = roll.P - roll.roll;
  return by > 0 ? { won: true, by } : { won: false, by: 1 - by };
}

/**
 * Up to `max` reason chips from a contest's `why` ("a gun +15", "Dax's Toughness 1 −5"), biggest first; a tie keeps
 * the engine's order. Returns { chips: [{ label, value, good }], more } where `more` counts the reasons left out.
 */
export function chipsOf(why, max = 3) {
  const parsed = [];
  for (const [i, text] of (Array.isArray(why) ? why : []).entries()) {
    const m = /^(.*\S)\s*([+−-])\s*(\d+)$/.exec(String(text));
    parsed.push(m ? { label: m[1], value: Number(m[3]), good: m[2] === '+', i } : { label: String(text), value: 0, good: true, i });
  }
  parsed.sort((a, b) => b.value - a.value || a.i - b.i);
  return { chips: parsed.slice(0, max).map(({ label, value, good }) => ({ label, value, good })), more: Math.max(0, parsed.length - max) };
}

// ---------------------------------------------------------------------------------------------------------------
// The menu, grouped so the likely moves are easy to find

/** A menu label cut into the move and its small print. */
export function splitLabel(label) {
  const text = String(label ?? '').replace(/; add a due hour to make it on credit[^)]*/, '');
  const paren = text.indexOf(' (');
  const colon = text.indexOf(': ');
  if (colon > 0 && (paren < 0 || colon < paren)) return { main: text.slice(0, colon), note: text.slice(colon + 2) };
  if (text.endsWith(')')) {
    let depth = 0;
    for (let i = text.length - 1; i >= 0; i--) {
      if (text[i] === ')') depth += 1;
      else if (text[i] === '(' && --depth === 0) return { main: text.slice(0, i).trim(), note: text.slice(i + 1, -1) };
    }
  }
  return { main: text, note: '' };
}

const GROUP_TITLES = {
  errand: 'Pick-ups', now: 'Waiting on you', work: 'Your job', hit: 'Take it', go: 'Go', trade: 'The counters here', home: 'Lie low',
  deal: 'Make an offer', crew: 'Crew and contracts',
};

/** Which group a menu entry belongs to. */
export function groupOf(entry) {
  if (entry.pickup) return 'errand';
  if (entry.answer) return 'now';
  if (entry.verb === 'work') return 'work';
  if (entry.verb === 'attack' || (entry.verb === 'crew' && typeof entry.odds === 'number')) return 'hit';
  if (entry.verb === 'move') return 'go';
  if (entry.verb === 'offer') {
    if (entry.move?.terms?.kind === 'withdraw') return 'crew';
    return ['fence', 'gunshop', 'police'].includes(entry.move?.to) ? 'trade' : 'deal';
  }
  if (entry.verb === 'stash' || entry.verb === 'rest') return 'home';
  return 'crew';
}

/** What each class buys to do its job, and the offers it lives on. Everything else it can offer sits behind "more". */
export const WANTS = Object.freeze({ cook: ['chems'], dealer: ['product'], gunrunner: ['parts'] });
const STAPLES = {
  smuggler: { sell: ['chems', 'parts', 'product'] }, cook: { sell: ['product'], buy: ['chems'] }, dealer: { buy: ['product'] },
  gunrunner: { sell: ['gun'], buy: ['parts'] }, robber: { sell: ['chems', 'parts', 'product'] }, muscle: { protect: true }, informant: { tip: true },
};

/** Is this "make an offer" line one of the two or three this class lives on? They come prefilled at the usual price. */
export function isStaple(entry, cls) {
  const terms = entry?.move?.terms ?? {};
  const mine = STAPLES[cls];
  if (!mine || entry.verb !== 'offer' || entry.move.to !== 'anyone') return false;
  if (terms.kind === 'sell' || terms.kind === 'buy') return !!mine[terms.kind]?.includes(terms.good);
  return mine[terms.kind] === true;
}

export const TIGHTEST = 4;

/** How many offers lead at a tightness: three when there is room, down to the single best. */
export const leadMax = tight => (tight >= 4 ? 1 : tight >= 3 ? 2 : 3);

/** A short name for a line drawn as a tile: where a walk goes, how much goes into the stash. */
function tileOf(entry, main) {
  if (entry.verb === 'move') return main.replace(/^walk to (the )?/, '');
  if (entry.verb === 'stash') return entry.move.amount > 0 ? `stash $${entry.move.amount}` : `take out $${-entry.move.amount}`;
  return main;
}

/**
 * The menu in groups: [{ id, title, shown: [row], more: [row] }], each row { entry, n, main, note, tile?, staple? }.
 * `shown` rows are on screen at once; `more` rows sit behind the group's "more" line. The rows on screen are numbered
 * 1 to 9 in reading order (`n`, or null past nine): those are the number keys.
 *   errand   the walk to each pick-up (drawn as the errand card)
 *   go, home drawn as a row of tiles (`tile` is the short name)
 *   deal     opens with the class's staple offers (`staple`), the rest behind "more"
 * A robber's attacks lead; for everyone else attacks come after the day job and only the best one is on screen.
 * `tight` is how hard the screen is pressed, 0 to 4: each step puts something more behind a "more" line (the staple
 * offers, then a non-robber's attack, then counter lines and a robber's lesser targets), so a crowded hour still fits
 * without scrolling. TIGHTEST is the last step.
 */
export function groupMenu(menu, cls = null, { tight = 0 } = {}) {
  const order = cls === 'robber' ? ['errand', 'now', 'hit', 'work', 'go', 'trade', 'home', 'deal', 'crew'] : ['errand', 'now', 'work', 'go', 'trade', 'hit', 'home', 'deal', 'crew'];
  const buckets = Object.fromEntries(order.map(id => [id, []]));
  for (const entry of menu ?? []) buckets[groupOf(entry)].push(entry);
  // the best odds first, so the first attack on screen is the one most worth a look
  buckets.hit.sort((a, b) => (b.odds ?? 0) - (a.odds ?? 0));
  const staples = buckets.deal.filter(e => isStaple(e, cls)).slice(0, 3);
  buckets.deal = [...staples, ...buckets.deal.filter(e => !staples.includes(e))];
  const keep = {
    errand: 3, now: 3, work: 3, go: 4, home: 3, crew: 0,
    hit: cls === 'robber' ? (tight >= 4 ? 2 : tight >= 3 ? 3 : 4) : tight >= 2 ? 0 : 1,
    deal: tight >= 1 ? 0 : staples.length,
    trade: tight >= 4 ? 1 : tight >= 3 ? 2 : 4,
  };
  let n = 0;
  const groups = [];
  for (const id of order) {
    const entries = buckets[id];
    if (!entries.length) continue;
    const row = (entry, numbered) => {
      const cut = splitLabel(entry.label);
      return {
        entry, n: numbered && n < 9 ? ++n : null, ...cut,
        ...(id === 'go' || id === 'home' ? { tile: tileOf(entry, cut.main) } : {}),
        ...(id === 'deal' && staples.includes(entry) ? { staple: true } : {}),
        // under "Make an offer" every line would start "offer to": say what is offered
        ...(id === 'deal' ? { main: cut.main.replace(/^offer to /, '').replace(/^offer a loan/, 'lend cash').replace(/^offer /, '') } : {}),
      };
    };
    const shown = entries.slice(0, keep[id]).map(e => row(e, true));
    const more = entries.slice(keep[id]).map(e => row(e, false));
    groups.push({ id, title: GROUP_TITLES[id], shown, more });
  }
  return groups;
}

/** The menu row a number key picks, or null. */
export function rowByNumber(groups, n) {
  for (const g of groups) for (const r of [...g.shown, ...g.more]) if (r.n === n) return r;
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Trading: the errands a closed deal leaves, and which offers are worth a seat's eye

/**
 * Each pick-up as one errand: who, what for what, how far, how long, and the menu line that walks toward it.
 * `entry` is null when the two already share a block (the swap happens this hour) or the other side is held.
 */
export function errandsOf(view) {
  return (view.pickups ?? []).map(p => ({ ...p, here: p.moves === 0, entry: (view.menu ?? []).find(m => m.pickup === p.id) ?? null }));
}

/**
 * What a staple offer's controls should start at, where the engine's own default would be a poor first order: a buy
 * the seat can't pay for is put on credit, for a load worth walking for. Everything else keeps the engine's default,
 * which is already the usual price. Returns { n, due } to lay over the controls' values, or {}.
 */
export function stapleValues(entry, view) {
  const terms = entry?.move?.terms ?? {};
  const due = entry?.args?.due;
  if (terms.kind !== 'buy' || !due || terms.good === 'gun') return {};
  const afford = Math.floor(view.you.cash / terms.each);
  if (afford >= 3) return {};
  return { n: 6, due: Math.max(due.min, Math.min(due.max, view.clock.t + 12)) };
}

/**
 * The offers a seat can say yes to, the ones that matter to it first: { lead: [offer + why], rest: [offer] }.
 * An offer leads when it was made to the seat, when it asks for goods the seat holds (at the quality asked or better),
 * when it sells what the seat's class needs and the seat can pay (or it is on credit), and, for the seats that live
 * on them, tips and paid jobs. `max` caps the lead: a seat can say yes to three an hour.
 */
export function sortOffers(view, { max = 3 } = {}) {
  const you = view.you;
  // what is already promised in a pick-up can't be sold twice
  const promised = good => (view.pickups ?? []).reduce((sum, p) => sum + (new RegExp(`^(\\d+) ${good === 'gun' ? 'guns?' : good}\\b`).exec(p.youGive)?.[1] | 0), 0);
  const bestHeld = good => {
    const lots = good === 'gun' ? you.goods.guns : good === 'product' ? you.goods.product : null;
    const held = lots ? Object.values(lots).reduce((sum, n) => sum + n, 0) : you.goods[good] ?? 0;
    if (held - promised(good) <= 0) return 0;
    if (lots) return Math.max(0, ...Object.entries(lots).filter(([, n]) => n > 0).map(([q]) => Number(q)));
    return 1;
  };
  const whyOf = o => {
    const terms = o.terms ?? {};
    if (!o.board) return 'to you';
    if (o.kind === 'buy' && bestHeld(terms.good) >= (terms.q ?? 1)) return 'you hold this';
    if (o.kind === 'sell' && (WANTS[you.cls] ?? []).includes(terms.good) && (terms.due !== undefined || you.cash >= (terms.each ?? Infinity))) return 'you need this';
    if (o.kind === 'tip' && you.cls === 'robber' && you.cash >= (terms.price ?? Infinity)) return 'a lead';
    if (o.kind === 'job' && (you.cls === 'robber' || you.cls === 'muscle')) return 'paid work';
    return null;
  };
  const rank = { 'to you': 0, 'you hold this': 1, 'you need this': 1, 'a lead': 2, 'paid work': 2 };
  const tagged = (view.offers ?? []).map((o, i) => ({ o, i, why: whyOf(o) }));
  const fit = tagged.filter(x => x.why).sort((a, b) => rank[a.why] - rank[b.why] || a.i - b.i);
  const lead = fit.slice(0, max).map(x => ({ ...x.o, why: x.why }));
  const rest = tagged.filter(x => !lead.some(l => l.id === x.o.id)).map(x => x.o);
  return { lead, rest };
}

// ---------------------------------------------------------------------------------------------------------------
// Controls for a menu entry's arguments. Every shape src/menu.mjs builds is listed here.

const NUMBER_LABELS = {
  n: 'how many', each: 'price each', price: 'price', pay: 'pay', amount: 'amount', repay: 'paid back', hours: 'hours', q: 'quality, at least',
  cash: 'cash', pct: 'cut %',
};
const MONEY_KEYS = new Set(['each', 'price', 'pay', 'amount', 'repay', 'cash']);
const TOGGLE_LABELS = { courier: 'send by courier (you pay 25%, at least $5)', fromPot: 'pay it from the crew pot' };
export const JOB_KINDS = Object.freeze([
  { type: 'rob', label: 'rob someone', needs: ['agent'] },
  { type: 'fight', label: 'put someone in the clinic', needs: ['agent'] },
  { type: 'guard', label: 'guard me', needs: ['hours'] },
  { type: 'deliver', label: 'deliver goods', needs: ['n', 'good', 'agent'] },
  { type: 'bail', label: 'bail someone out', needs: ['agent'] },
]);

/**
 * The controls an entry needs: [{ key, type, ... }].
 *   pick    { options: [{ value, label }], value }           who it goes to, or which crew member
 *   number  { min, max, value, label, money, negate }        `negate` shows a withdrawal as a positive amount
 *   due     { min, max, value, optional }                    an hour of the season; optional means "on credit"
 *   toggle  { value: false, label }
 *   text    { value, label }
 *   task    { kinds: JOB_KINDS, agents: [{ value, label }] } the job being posted
 * `names` maps agent ids to names.
 */
export function argSpec(entry, names = {}) {
  const args = entry?.args ?? {};
  const move = entry?.move ?? {};
  const terms = move.terms ?? {};
  const who = id => (id === 'anyone' ? 'anyone (the board)' : names[id] ?? id);
  const out = [];
  for (const [key, spec] of Object.entries(args)) {
    if (key === 'task') {
      const agents = (Array.isArray(args.to) ? args.to : Object.keys(names)).filter(id => id !== 'anyone').map(id => ({ value: id, label: who(id) }));
      out.push({ key, type: 'task', kinds: JOB_KINDS, agents });
    } else if (spec === 'text') {
      out.push({ key, type: 'text', value: move[key] ?? '', label: 'name' });
    } else if (Array.isArray(spec) && spec.length === 2 && spec[0] === false && spec[1] === true) {
      out.push({ key, type: 'toggle', value: false, label: TOGGLE_LABELS[key] ?? key });
    } else if (Array.isArray(spec)) {
      out.push({ key, type: 'pick', options: spec.map(id => ({ value: id, label: who(id) })), value: key === 'to' ? move.to : move[key] ?? spec[0], label: key === 'to' ? 'to' : 'who' });
    } else if (key === 'due') {
      const has = terms.due !== undefined;
      out.push({ key, type: 'due', min: spec.min, max: spec.max, value: has ? terms.due : null, optional: !has });
    } else if (spec && typeof spec === 'object') {
      const current = move.verb === 'offer' ? terms[key] : move[key];
      const negate = (spec.max ?? 1) < 0;
      const min = spec.min ?? 0;
      const max = spec.max ?? Math.max(9999, current ?? 0);
      out.push({ key, type: 'number', min, max, value: current ?? min, label: negate ? 'take out' : NUMBER_LABELS[key] ?? key, money: MONEY_KEYS.has(key) || move.verb === 'stash', negate });
    }
  }
  return out;
}

/**
 * An entry's terms as they stand, in one line: "5 · $20 each · to anyone (the board) · paid on the spot".
 * `controls` is argSpec(entry, names), `values` what the controls hold, `clock` turns a due hour into words.
 */
export function termsLine(controls, values, clock = t => `hour ${t}`) {
  const parts = [];
  for (const c of controls) {
    const v = values[c.key] ?? c.value;
    if (c.type === 'number') parts.push(c.key === 'n' ? `${v} unit${v === 1 ? '' : 's'}` : `${c.label} ${c.money ? '$' : ''}${c.negate ? -v : v}`);
    else if (c.type === 'pick') parts.push(`${c.label} ${c.options.find(o => o.value === v)?.label ?? v}`);
    else if (c.type === 'due') parts.push(v === null || v === undefined ? 'paid on the spot' : `${c.optional ? 'on credit, by' : 'due back by'} ${clock(v)}`);
    else if (c.type === 'toggle' && v === true) parts.push(c.key === 'courier' ? 'by courier' : c.label);
    else if (c.type === 'text' && v) parts.push(`"${v}"`);
    else if (c.type === 'task') parts.push(JOB_KINDS.find(k => k.type === v?.type)?.label ?? 'a job');
  }
  return parts.join(' \u00b7 ');
}

/** The reply's `move` for an entry and the values its controls hold: { id, ...args }. */
export function choiceOf(entry, values = {}) {
  const choice = { id: entry.id };
  for (const control of argSpec(entry)) {
    const v = values[control.key];
    if (v === undefined || v === null || v === '') continue;
    if (control.type === 'toggle') {
      if (v === true) choice[control.key] = true;
    } else if (control.type === 'number' || control.type === 'due') {
      if (Number.isInteger(Number(v))) choice[control.key] = Number(v);
    } else if (control.type === 'task') {
      const kind = JOB_KINDS.find(k => k.type === v.type);
      if (!kind) continue;
      const task = { type: kind.type };
      for (const need of kind.needs) {
        if (need === 'agent' && v.agent) task.agent = v.agent;
        else if (need === 'hours') task.hours = Math.max(1, Math.min(12, Number(v.hours) || 3));
        else if (need === 'n') task.n = Math.max(1, Number(v.n) || 1);
        else if (need === 'good') task.good = v.good ?? 'product';
      }
      choice.task = task;
    } else {
      choice[control.key] = v;
    }
  }
  return choice;
}

// ---------------------------------------------------------------------------------------------------------------
// What is coming: the forecast as a strip across the day

/**
 * One column per hour of the day: [{ hour, past, now, police, dunn, sixes, here }].
 *   police   the blocks the police are on that hour, or null when the seat can't see that far
 *   dunn     the blocks the Dunn brothers work that hour ([] before they come out)
 *   sixes    the block the Sixes push onto that hour, or null
 *   here     { police, dunn, sixes }: is that trouble on the seat's own block
 * Built from the view alone, so it shows what the seat knows and nothing more.
 */
export function forecastStrip(view, cfg) {
  const first = cfg.season.firstHour;
  const perDay = cfg.season.hoursPerDay;
  const now = view.clock.hour;
  const block = view.here?.block ?? null;
  const policeAt = new Map((view.forecast?.police ?? []).map(p => [p.hour, [...new Set(p.blocks)]]));
  const robbers = view.forecast?.robbers ?? null;
  const rival = view.forecast?.rival ?? null;
  const out = [];
  for (let hour = first; hour < first + perDay; hour++) {
    const police = policeAt.get(hour) ?? null;
    const dunn = robbers && hour >= robbers.fromHour ? robbers.blocks.slice() : [];
    const sixes = rival && rival.hour === hour ? rival.block : null;
    out.push({
      hour, past: hour < now, now: hour === now, police, dunn, sixes,
      here: { police: !!block && !!police?.includes(block), dunn: !!block && dunn.includes(block), sixes: !!block && sixes === block },
    });
  }
  return out;
}

/** The same strip for a watcher, from the day's forecast line in the feed: the whole police schedule is known. */
export function forecastStripAll(forecast, cfg, hourNow, block = null) {
  const first = cfg.season.firstHour;
  const perDay = cfg.season.hoursPerDay;
  const out = [];
  for (let i = 0; i < perDay; i++) {
    const hour = first + i;
    const police = [...new Set((forecast?.police ?? []).map(unit => unit[i]).filter(Boolean))];
    const dunn = forecast?.robbers && i >= forecast.robbers.fromHour ? forecast.robbers.blocks.slice() : [];
    const sixes = forecast?.rival && forecast.rival.hour === i ? forecast.rival.block : null;
    out.push({ hour, past: hour < hourNow, now: hour === hourNow, police, dunn, sixes, here: { police: !!block && police.includes(block), dunn: !!block && dunn.includes(block), sixes: !!block && sixes === block } });
  }
  return out;
}

/** "What is coming for me", in at most two short lines, worst first: [{ text, bad }]. */
export function comingFor(view, cfg) {
  if (!view.here) return [];
  const strip = forecastStrip(view, cfg);
  const place = view.here.block === 'uptown' ? 'uptown' : `the ${view.here.block}`;
  const out = [];
  const arrestAt = cfg.heat?.arrestAt ?? 3;
  const next = kind => strip.find(c => !c.past && c.here[kind]);
  const police = next('police');
  if (view.here.police || police?.now) out.push({ text: view.you.heat >= arrestAt ? `Police are here and your heat is ${view.you.heat}: they arrest at ${arrestAt}. Leave.` : `Police are on this block now. Crimes here cost more heat.`, bad: true });
  else if (police) out.push({ text: `Police reach ${place} at ${police.hour}:00.`, bad: view.you.heat >= arrestAt });
  const dunn = next('dunn');
  if (dunn) out.push({ text: dunn.now ? `The Dunn brothers are working ${place}: they rob whoever carries the most.` : `The Dunn brothers work ${place} from ${dunn.hour}:00.`, bad: !!dunn.now });
  const sixes = next('sixes');
  if (sixes) out.push({ text: sixes.now ? `The Sixes push onto ${place} this hour: pay $${view.forecast.rival.toll} or fight.` : `The Sixes push onto ${place} at ${sixes.hour}:00.`, bad: !!sixes.now });
  if (view.forecast?.early) out.push({ text: `${view.forecast.early[0].toUpperCase()}${view.forecast.early.slice(1)}.`, bad: true });
  if (!out.length) out.push({ text: `Nothing is forecast for ${place} in the hours you can see.`, bad: false });
  return out.sort((a, b) => Number(b.bad) - Number(a.bad)).slice(0, 2);
}

// ---------------------------------------------------------------------------------------------------------------
// The hour playing back: the ticker and its timing

/** Events that are only somebody getting on with it. They stay out of a watcher's ticker unless they follow that agent. */
export const QUIET = Object.freeze(new Set(['move', 'move:guard', 'rest', 'idle', 'held:jail', 'held:clinic', 'work:none', 'night:sleep']));

/** Engine text that counts hours from the season's start ("by hour 16"), said as a clock time. */
export function plainHours(text, game) {
  return String(text ?? '').replace(/(\bby |\bat |\()hour (\d+)\b/g, (found, lead, n) => `${lead}${clockOf(game, Number(n))}`);
}

/** What a sealed event looks like from across the street, by family: its content is closed, its gesture is not. */
const SEALED_FAMILY = {
  message: 'phone', 'deal:closed': 'phone', 'offer:made': 'phone', 'loan:repaid': 'phone', 'job:taken': 'phone', 'job:posted': 'phone',
  'crew:invite': 'phone', 'crew:pay': 'phone', 'crew:cut': 'phone', 'work:tipoff': 'phone',
  'offer:fence': 'counter', 'offer:gunshop': 'counter', 'offer:police': 'desk', stash: 'floor', 'work:watch': 'watch', 'work:case': 'watch',
};
const SEALED_WORDS = {
  phone: ['is on the phone', 'are on their phones'],
  counter: ['did some business at the counter', 'did some business at the counter'],
  desk: ['had a word at the police desk', 'had a word at the police desk'],
  floor: ['was at the floorboards', 'were at the floorboards'],
  watch: ['is watching the block', 'are watching the block'],
  word: ['had a quiet word with someone', 'had quiet words'],
};

/** One short line for the sealed business of a family: "Ansel is on the phone.", "Ansel and Silas are watching the block." */
export function sealedLine(family, names) {
  const words = SEALED_WORDS[family] ?? SEALED_WORDS.word;
  const who = names.length ? names : ['Someone'];
  const list = who.length > 1 ? `${who.slice(0, -1).join(', ')} and ${who[who.length - 1]}` : who[0];
  return `${list} ${words[who.length > 1 ? 1 : 0]}.`;
}

/** Is this something the whole city can read: a lead change, a warning, a listing or a job on the board? */
export function isNews(event) {
  if (event.kind === 'lead' || event.kind === 'forecast:early' || event.kind === 'offer:board') return true;
  return event.kind === 'job:posted' && (event.data?.to === undefined || event.data.to === 'anyone');
}
const NEWS_ORDER = ['lead', 'forecast:early', 'job:posted', 'offer:board'];
const RISKY_WORK = /^work:(run|cook|gunsale)/;

/**
 * The hour as rows for the ticker: [{ key, text, kind, big, mine, roll, risk, event }], in the order things happened.
 *   roll    { P, roll, outcome, why, kind, attacker, defender } when the row carries dice this viewer may see
 *   risk    { what, agent, chance, roll, hit } when the row is an hour of risky work whose roll this viewer may see
 *   kind 'sealed'   private business seen from outside, one row a family; `texting` lists who was thumbing a phone
 *   kind 'news'     (playing and coaching) what the whole city can read, from blocks the seat wasn't on
 * A sealed event is never handed to describe(): it has no content to put in a sentence.
 */
export function tickerOf(line, game, { you = null, mode = 'watch', follow = null, newsMax = 4 } = {}) {
  const rows = [];
  const focus = follow ?? you;
  const mine = line.agents?.[you];
  const blank = { big: false, mine: false, roll: null, risk: null, event: null };
  // a move that failed, and what came of saying yes: the seat's own results the events don't spell out
  if (you && mine) {
    if (mine.ok === false && mine.text) rows.push({ ...blank, key: 'own', text: `${mode === 'coach' ? `${nameOf(game, you)}'s` : 'Your'} move fell through: ${plainHours(mine.text, game)}.`, kind: 'own', mine: true });
    for (const [i, text] of (mine.accepts ?? []).entries()) rows.push({ ...blank, key: `acc${i}`, text: `Your yes: ${plainHours(text, game)}.`, kind: 'own', mine: true });
  }
  const risks = risksOf(line, you, mode);
  const sealed = new Map();
  for (const [i, event] of seenOf(line, you, mode).entries()) {
    if (event.sealed) {
      const actor = Object.values(event.who ?? {})[0];
      if (!actor) continue;
      const family = SEALED_FAMILY[event.kind] ?? 'word';
      let row = sealed.get(family);
      if (!row) {
        row = { ...blank, key: `s${i}`, text: '', kind: 'sealed', family, who: [], texting: [], sealed: true };
        sealed.set(family, row);
        rows.push(row);
      }
      if (!row.who.includes(actor)) row.who.push(actor);
      if (event.kind === 'message') row.texting.push(actor);
      row.text = sealedLine(family, row.who.map(id => nameOf(game, id)));
      continue;
    }
    const involved = !!focus && partOf(event, focus);
    if (QUIET.has(event.kind) && !involved && !(mode !== 'watch' && event.kind === 'move')) continue;
    const found = event.data?.roll ? (line.rolls ?? []).find(r => r.roll === event.data.roll.roll && r.P === event.data.roll.P && Object.values(event.who).includes(r.defender)) : null;
    const roll = event.data?.roll ? { ...event.data.roll, kind: found?.kind ?? event.kind.split(':')[0], attacker: found?.attacker ?? null, defender: found?.defender ?? null } : null;
    const risk = RISKY_WORK.test(event.kind) ? risks.find(r => Object.values(event.who).includes(r.agent)) ?? null : null;
    rows.push({ ...blank, key: `e${i}`, text: describe(event, game), kind: event.kind, big: !!event.big, mine: !!you && partOf(event, you), roll, risk, event });
  }
  // the city's public news, so a seat's hour isn't only its own block
  if (mode !== 'watch' && you) {
    const inSight = e => partOf(e, you) || Object.values(e.lists ?? {}).some(list => Array.isArray(list) && list.includes(you));
    const news = (line.events ?? []).filter(e => isNews(e) && !inSight(e)).sort((a, b) => NEWS_ORDER.indexOf(a.kind) - NEWS_ORDER.indexOf(b.kind));
    for (const [i, event] of news.slice(0, newsMax).entries()) rows.push({ ...blank, key: `n${i}`, text: describe(event, game), kind: 'news', news: event.kind, big: event.kind === 'lead', event });
    if (news.length > newsMax) rows.push({ ...blank, key: 'nmore', text: `${news.length - newsMax} more new listing${news.length - newsMax === 1 ? '' : 's'} went up on the board.`, kind: 'news', news: 'offer:board' });
  }
  if (!rows.length) rows.push({ ...blank, key: 'quiet', text: mode === 'watch' ? 'A quiet hour.' : 'Nothing happened where you could see it.', kind: 'quiet' });
  return rows;
}

const WEIGHT = { roll: 2800, big: 1500, talk: 1100, plain: 650, quiet: 320 };

/** How long a ticker row holds the floor at 1×, before the hour is fitted to its length. */
export function weightOf(row) {
  if (row.roll || row.risk) return WEIGHT.roll;
  if (row.kind === 'news') return row.big ? WEIGHT.big : WEIGHT.plain;
  if (row.kind === 'sealed') return row.texting?.length ? WEIGHT.plain : WEIGHT.quiet;
  if (row.big) return WEIGHT.big;
  if (row.kind === 'say' || row.kind === 'say:block' || row.kind === 'message') return WEIGHT.talk;
  if (QUIET.has(row.kind)) return WEIGHT.quiet;
  return WEIGHT.plain;
}

export const HOUR_MS = 10000;

/**
 * When each row comes up, in ms from the start of the hour at 1×: { at: [ms], total }.
 * A busy hour is squeezed to fit 10 seconds; a thin one ends early rather than sitting on dead air.
 */
export function scheduleOf(rows, { hourMs = HOUR_MS, lead = 300, tail = 900 } = {}) {
  const weights = rows.map(weightOf);
  const sum = weights.reduce((a, b) => a + b, 0);
  const room = hourMs - lead - tail;
  const k = sum > room ? room / sum : 1;
  const at = [];
  let t = lead;
  for (const w of weights) {
    at.push(Math.round(t));
    t += w * k;
  }
  return { at, total: Math.round(Math.max(2400, Math.min(hourMs, t + tail))) };
}

/**
 * Why "auto until something happens to me" should stop after this hour, in a few words, or null to carry on.
 * It stops for anything big the seat was part of, a move that failed, being held, and anyone speaking to the seat.
 */
export function stopReason(line, you) {
  const mine = line?.agents?.[you];
  if (!mine) return null;
  if (mine.block === 'jail') return 'You are in jail.';
  if (mine.block === 'clinic') return 'You are in the clinic.';
  for (const event of line.events ?? []) {
    if (!partOf(event, you)) continue;
    if (event.kind === 'message' && event.who.receiver === you) return 'Someone messaged you.';
    if (event.kind === 'say' && event.who.listener === you) return 'Someone spoke to you.';
    if (event.kind === 'pickup' || event.kind === 'pickup:short' || event.kind === 'courier') return 'A pick-up happened.';
    if (event.kind === 'npc:snitch:offer') return 'The snitch wants paying.';
    if (event.big && event.kind !== 'lead') return 'Something happened to you.';
  }
  if (mine.ok === false) return 'Your move fell through.';
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// The night screen and the standings

/** The seat's day in money: where its worth started and ended, and the best and worst hour. */
export function dayLedger(feed, you, day, startWorth = null) {
  const hours = (feed ?? []).filter(l => l.type === 'hour' && l.day === day && l.agents?.[you]);
  if (!hours.length) return null;
  const before = (feed ?? []).filter(l => l.type === 'night' && l.day === day - 1)[0]?.standings?.find(r => r.id === you)?.worth;
  let last = startWorth ?? before ?? hours[0].agents[you].worth;
  const start = last;
  const rows = [];
  for (const line of hours) {
    const a = line.agents[you];
    rows.push({ hour: line.hour, delta: a.worth - last, text: a.text ?? '' });
    last = a.worth;
  }
  const earned = rows.filter(r => r.delta > 0).reduce((s, r) => s + r.delta, 0);
  const lost = -rows.filter(r => r.delta < 0).reduce((s, r) => s + r.delta, 0);
  const best = rows.slice().sort((a, b) => b.delta - a.delta)[0];
  const worst = rows.slice().sort((a, b) => a.delta - b.delta)[0];
  return { start, end: last, earned, lost, best: best.delta > 0 ? best : null, worst: worst.delta < 0 ? worst : null, rows };
}

/**
 * What the night screen may show a viewer, from the feed's night line.
 * A player or coach gets their own rent, their own night, and the standings as everyone sees them: rank and a rough
 * bracket, with an exact figure only on their own row. A watcher gets all of it.
 */
export function nightFor(night, you, mode) {
  const all = mode === 'watch' || !you;
  const rentPaid = night.rent?.find(r => r.id === you) ?? null;
  const evicted = night.evicted?.find(e => e.id === you) ?? null;
  return {
    day: night.day,
    rent: night.rent?.[0]?.paid ?? night.evicted?.[0]?.rent ?? null,
    yours: you ? { paid: !!rentPaid, evicted: evicted ? { lost: evicted.lost, saved: evicted.saved } : null } : null,
    evicted: all ? (night.evicted ?? []).map(e => ({ id: e.id, lost: e.lost })) : [],
    job: night.job && (all || night.job.target === you) ? { target: night.job.target, lost: night.job.lost, off: night.job.lost === 0, guards: night.job.guards ?? [] } : null,
    points: all ? night.points ?? [] : (night.points ?? []).filter(p => p.id === you),
    standings: (night.standings ?? []).map(r => ({ id: r.id, rank: r.rank, bracket: r.bracket, ...(all || r.id === you ? { worth: r.worth } : {}) })),
  };
}

/** A watcher's live standings from the hour just played: everyone, richest first. */
export function liveStandings(line, order) {
  return order.map((id, seat) => ({ id, seat, worth: line.agents[id].worth, cash: line.agents[id].cash, block: line.agents[id].block }))
    .sort((a, b) => b.worth - a.worth || a.seat - b.seat).map((row, i) => ({ ...row, rank: i + 1 }));
}

/** "1st", "2nd", "3rd", "4th". */
export function ordinal(n) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Speaking: lines from the banks

/** The banks a human speaks from, with the one that fits this hour first: { situation, banks: [[name, lines]] }. */
export function linesFor(view, move = null) {
  const situation = situationOf(null, view.you, view, move);
  const banks = [situation, ...SITUATIONS.filter(s => s !== situation)].map(s => [s, LINES[s]]);
  return { situation, banks };
}

export const SITUATION_WORDS = Object.freeze({ selling: 'Business', robbed: 'Robbed', robbing: 'Threat', guarding: 'Guarding', broke: 'Broke', winning: 'Winning' });

// ---------------------------------------------------------------------------------------------------------------
// Plain words for a move: what it does and what it gets you, for the move card (the engine's own sentence stays in
// the full menu)

const capital = text => (text ? text[0].toUpperCase() + text.slice(1) : text);
const CASH_WORDS = { broke: 'carries next to nothing', some: 'carries some cash', loaded: 'carries a lot' };

/** { title, gain }: a few words for the button and a few more for what comes of it. Built from the view, the map and the price list. */
export function plainMove(entry, view, game) {
  const { cfg, map } = game;
  const you = view.you;
  const cut = splitLabel(entry.label);
  const terms = entry.move?.terms ?? {};
  const place = b => map.blocks[b]?.name ?? `the ${b}`;
  const person = id => view.cast.find(c => c.id === id)?.name ?? 'them';
  const carried = id => {
    const p = view.here?.others.find(o => o.id === id);
    return p ? (typeof p.cash === 'number' ? `carries $${p.cash}` : CASH_WORDS[p.cash] ?? '') : '';
  };
  const each = Number(/\$(\d+) each/.exec(entry.label)?.[1] ?? /usual price \$?(\d+)/.exec(entry.label)?.[1] ?? NaN);
  // a line with no words of its own here: the engine's, cut at its first bracket or colon
  const [head, ...tail] = cut.main.replace(/^offer to /, '').split(/\s*[:(]\s*/);
  const fallback = { title: capital(head), gain: cut.note || tail.join(', ').replace(/\)\s*,?/g, '') };
  if (entry.verb === 'move') {
    const title = `Walk to ${place(entry.move.to)}`;
    const p = entry.pickup ? view.pickups.find(x => x.id === entry.pickup) : null;
    if (p) return { title, gain: `meet ${p.withName}: ${p.youGive} for ${p.youGet}` };
    if (entry.answer) return { title, gain: cut.main.replace(/^walk to [^,]+,\s*/, '') || 'after what was taken' };
    return { title, gain: cut.note || 'one hour on foot' };
  }
  if (entry.verb === 'work') {
    const option = entry.move.option;
    if (you.cls === 'dealer') {
      if (option === 'claim') return { title: /^fight/.test(cut.main) ? capital(cut.main) : 'Claim this corner', gain: 'others sell at half price here until midnight' };
      const held = Object.entries(you.goods.product ?? {}).filter(([, n]) => n > 0);
      const best = Math.max(1, ...held.map(([q]) => Number(q)));
      const units = Math.min(cfg.street.unitsPerHour + (you.skills.hustle ?? 0), held.reduce((sum, [, n]) => sum + n, 0));
      const key = map.blocks[view.here.block]?.buyers?.price;
      const price = key ? streetUnitPrice(cfg, key, best, (view.here.buyers?.demandPct ?? 100) * 10, { t: view.clock.t }) : null;
      return { title: 'Sell here', gain: price ? `about $${price} a unit, ${units} unit${units === 1 ? '' : 's'}` : cut.note };
    }
    if (you.cls === 'cook') return { title: 'Cook a batch', gain: `makes ${cookUnits(cfg, you.skills.yield ?? 0)} product, quality ${cookQuality(cfg, you.skills.purity ?? 0)}` };
    if (you.cls === 'smuggler') {
      const deal = /(\d+) for (\d+)/.exec(entry.label);
      return { title: option === 'product' ? 'Bring in ready product' : `Run ${option ?? 'goods'} in`, gain: deal ? `${deal[1]} unit${deal[1] === '1' ? '' : 's'} for $${deal[2]}, to sell on` : cut.note };
    }
    if (you.cls === 'gunrunner') {
      if (option === 'sell') {
        const q = Math.max(1, ...Object.entries(you.goods.guns ?? {}).filter(([, n]) => n > 0).map(([k]) => Number(k)));
        return { title: 'Sell a gun on the street', gain: `about $${streetGunPrice(cfg, q, you.skills.clientele ?? 0)}` };
      }
      return { title: 'Build a gun', gain: `uses ${cfg.guns.partsPerGun} parts` };
    }
    if (you.cls === 'robber') return { title: 'Case this block', gain: 'see exactly what everyone here carries' };
    if (you.cls === 'muscle') return option === 'guard' ? { title: 'Stand guard', gain: 'your client pays by the hour' } : { title: 'Patrol this block', gain: /\(\$(\d+)\)/.test(entry.label) ? `the shopkeepers pay $${/\(\$(\d+)\)/.exec(entry.label)[1]}` : 'nobody pays here' };
    if (you.cls === 'informant') return /^sell the police/.test(cut.main) ? { title: 'Sell the police a tip', gain: cut.main.replace(/^sell the police /, '') } : { title: 'Watch this block', gain: 'collect tips to sell' };
    return fallback;
  }
  if (entry.verb === 'attack') {
    const who = person(entry.move.target);
    if (entry.move.how === 'rob') return { title: `Rob ${who}`, gain: carried(entry.move.target) || 'take what they carry' };
    if (entry.move.how === 'fight') return { title: `Fight ${who}`, gain: entry.answer ? 'take back what is yours' : 'put them in the clinic' };
    if (entry.move.how === 'collect') return { title: `Collect from ${who}`, gain: cut.main.replace(/^collect /, '') };
    return { title: `Break into ${possessive(who)} pad`, gain: /they are out/.test(entry.label) ? 'they are out: take from the stash' : 'they are home: a fight at the door' };
  }
  if (entry.verb === 'offer') {
    const good = terms.good === 'gun' ? (terms.n > 1 ? 'guns' : 'a gun') : terms.good;
    if (entry.move.to === 'fence') {
      if (terms.kind === 'sell') return { title: `Sell the fence ${terms.n} ${terms.good}${terms.good === 'gun' && terms.n > 1 ? 's' : ''}`, gain: Number.isFinite(each) ? `$${each} each, $${each * terms.n} in your pocket` : cut.note };
      if (terms.kind === 'buy') return { title: `Buy ${terms.good} from the fence`, gain: Number.isFinite(each) ? `$${each} each, up to ${terms.n}` : cut.note };
      return { title: 'Borrow from the loan shark', gain: cut.note || 'cash now, paid back from what you earn' };
    }
    if (entry.move.to === 'gunshop') return { title: 'Buy a gun', gain: `$${cfg.gunshop.price}: a gun adds to every robbery and fight` };
    if (entry.move.to === 'police') return terms.kind === 'bail' ? { title: capital(cut.main), gain: 'they walk out now' } : { title: 'Sell the police a tip', gain: cut.note };
    if (terms.kind === 'sell') return { title: `Put ${terms.n} ${good} up for sale`, gain: Number.isFinite(each) ? `$${each} each, the usual price` : cut.note };
    if (terms.kind === 'buy') return { title: `Order ${good}`, gain: Number.isFinite(each) ? `$${each} each, the usual price` : cut.note };
    if (terms.kind === 'tip') return { title: 'Put a tip up for sale', gain: cut.main.replace(/^offer to sell a tip:\s*/, '') };
    if (terms.kind === 'protect') return { title: 'Offer protection', gain: `$${cfg.usual.protectPerHour} an hour, the usual price` };
    return fallback;
  }
  if (entry.verb === 'stash') return entry.move.amount > 0 ? { title: 'Stash your cash', gain: `$${entry.move.amount} safe from robbers` } : { title: 'Take cash out', gain: `$${-entry.move.amount} from your stash` };
  if (entry.verb === 'rest') return you.heat > 0 ? { title: 'Lie low', gain: cut.note || cut.main.replace(/^lie low:?\s*/, '') || 'let the heat drop' } : { title: 'Rest', gain: 'do nothing this hour' };
  return fallback;
}

/** The seat's loop in three steps, for the one-screen explainer: [icon, a few words]. The goal is the same for all. */
export const GOAL = 'Be worth the most after five days.';
export const LOOPS = Object.freeze({
  dealer: [['order', 'Get product from the cook'], ['corner', 'Sell it on a corner'], ['home', 'Stash the cash at home before you are robbed']],
  robber: [['eye', 'See who is carrying cash'], ['hit', 'Rob them when the odds are good'], ['cool', 'Lie low while you are hot, and fence what you took']],
  smuggler: [['docks', 'Run goods in at the docks'], ['order', 'Sell them to the cook and the dealers'], ['home', 'Stash the cash at home before you are robbed']],
  cook: [['order', 'Buy chems from a smuggler'], ['cook', 'Cook them into product at home'], ['corner', 'Sell the product to the dealers']],
  gunrunner: [['order', 'Buy parts from a smuggler'], ['cook', 'Build guns at home'], ['corner', 'Sell them on the street or to the others']],
  muscle: [['order', 'Offer protection on the board'], ['eye', 'Guard whoever hires you'], ['hit', 'Collect debts that have gone bad']],
  informant: [['eye', 'Watch a block and collect tips'], ['order', 'Sell tips to whoever pays'], ['cool', 'Keep it quiet: the one you sold out may find out']],
});
export const TURN_FACTS = Object.freeze(['One turn is one hour: pick a move, press Enter, watch it play.', 'Rent is due every night. Cash on you can be robbed; cash in your stash cannot.', 'Crime adds heat. The police arrest at heat 3.']);

// ---------------------------------------------------------------------------------------------------------------
// The move card: the hour's best two or three moves, and one numbering for the card and the full menu

const find = (menu, test) => (menu ?? []).find(test) ?? null;
const job = option => menu => find(menu, m => m.verb === 'work' && (option === undefined || m.move.option === option)) ?? find(menu, m => m.verb === 'work');
const bestHit = menu => (menu ?? []).filter(m => m.verb === 'attack' && m.move.how === 'rob').sort((a, b) => (b.odds ?? 0) - (a.odds ?? 0))[0] ?? null;
const stapleLine = (cls, kind, good) => menu => find(menu, m => isStaple(m, cls) && m.move.terms.kind === kind && (!good || m.move.terms.good === good));
const fenceSale = menu => find(menu, m => m.verb === 'offer' && m.move.to === 'fence' && m.move.terms?.kind === 'sell' && m.move.terms.good !== 'gun');

/** The menu line that walks one step toward `block`, or null when the seat is there or held. */
export function walkToward(view, map, block) {
  const here = view.here?.block;
  if (!here || !block || here === block || !map.blocks[block]) return null;
  const next = stepToward(map, here, block);
  return find(view.menu, m => m.verb === 'move' && m.move.to === next);
}

/** The nearest block with a feature (buyers that are open count only when `open` says so), by moves from here. */
function nearestWith(view, map, feature) {
  const here = view.here?.block;
  if (!here) return null;
  return blocksWith(map, feature).filter(b => b !== here).sort((a, b) => distance(map, here, a) - distance(map, here, b))[0] ?? null;
}

/**
 * The moves worth a button of their own this hour, best first, at most `max`. `pin` (the guide's line) leads.
 * What waits on the seat comes next (a pick-up to walk to, a robber to chase), then the seat's own living.
 */
export function bestMoves(view, { pin = null, max = 3 } = {}) {
  const menu = view.menu ?? [];
  const out = [];
  const add = e => {
    if (e && !out.includes(e) && out.length < max) out.push(e);
  };
  add(pin);
  add(find(menu, m => m.pickup));
  add(find(menu, m => m.answer));
  if (view.you.cls === 'robber') add(bestHit(menu));
  add(job()(menu));
  add(fenceSale(menu));
  if (view.you.cash >= 150) add(find(menu, m => m.verb === 'stash' && m.move.amount > 0));
  if (view.you.heat >= 2) add(find(menu, m => m.verb === 'rest'));
  add(find(menu, m => m.verb === 'move' && !m.pickup && !m.answer));
  add(find(menu, m => m.verb === 'rest'));
  return out;
}

/**
 * One numbering for the card and the menu: the card's moves are 1, 2, 3, and the rest of the lines on screen in the
 * menu carry on from there, up to 9. Returns the card's rows; the groups' rows are renumbered in place.
 */
export function numberMoves(groups, best) {
  const rows = groups.flatMap(g => [...g.shown, ...g.more]);
  for (const r of rows) r.n = null;
  const card = best.map(entry => rows.find(r => r.entry === entry)).filter(Boolean);
  let n = 0;
  for (const r of card) r.n = ++n;
  for (const g of groups) for (const r of g.shown) if (r.n === null && n < 9) r.n = ++n;
  return card;
}

// ---------------------------------------------------------------------------------------------------------------
// The first-time guide: one mark an hour on the single thing to click, with one line of why. It follows what the
// seat holds and has done, not the clock, and ends with the first whole trade (or with the first day).

/** How long the guide stays with a seat that hasn't finished a trade: the first day. */
export const GUIDE_HOURS = 12;

/** Did the seat finish a trade this hour: goods or cash swapped by hand, by courier, over the fence's counter, or a tip bought? */
export function tradeDone(line, you) {
  return (line?.events ?? []).some(e => ['pickup', 'pickup:short', 'courier', 'offer:fence', 'tip:sold'].includes(e.kind) && partOf(e, you));
}

const count = lots => Object.values(lots ?? {}).reduce((sum, n) => sum + n, 0);

/** The seat's own next step, from what it holds and where it stands: { say, entry }. */
function ownStep(view, map) {
  const { you, menu } = view;
  const cls = you.cls;
  const listed = (kind, good) => (view.yourOffers ?? []).some(o => o.kind === kind && (!good || o.terms?.good === good));
  const rest = find(menu, m => m.verb === 'rest');
  const product = count(you.goods.product);
  if (cls === 'dealer') {
    const order = stapleLine('dealer', 'buy', 'product')(menu);
    if (order && product < 6 && !listed('buy', 'product') && !view.pickups.length) return { say: 'Order product from the cook first. It arrives as a pick-up.', entry: order };
    const sell = job('sell')(menu);
    if (product > 0 && sell && sell.move.option !== 'claim') return { say: 'Sell here. Every sale lowers demand on this block a little.', entry: sell };
    if (product > 0) return { say: 'Street buyers are on the corner. Walk there to sell.', entry: walkToward(view, map, nearestWith(view, map, 'buyers')) };
    const stash = find(menu, m => m.verb === 'stash' && m.move.amount > 0);
    if (stash && you.cash >= 100) return { say: 'Stash your cash at home: nobody can rob it there.', entry: stash };
    return { say: 'Nothing to sell until your order arrives. Wait for a yes.', entry: rest };
  }
  if (cls === 'robber') {
    const others = view.here?.others ?? [];
    const hit = bestHit(menu);
    const kase = job()(menu);
    if (you.heat >= 2 && rest) return { say: 'You are hot. Lie low: the police arrest at heat 3.', entry: rest };
    if (others.length && others.every(o => typeof o.cash !== 'number') && kase) return { say: 'Case the block: it shows what everyone here carries.', entry: kase };
    if (hit) {
      const rich = menu.filter(m => m.verb === 'attack' && m.move.how === 'rob').sort((a, b) => {
        const cash = m => Number(others.find(o => o.id === m.move.target)?.cash) || 0;
        return cash(b) * (b.odds ?? 0) - cash(a) * (a.odds ?? 0);
      })[0];
      return { say: 'Rob the one carrying the most. Green on the bar is a clean win.', entry: rich ?? hit };
    }
    return { say: 'Nobody to rob here. The corner is where the money walks.', entry: walkToward(view, map, 'corner') ?? walkToward(view, map, 'bar') };
  }
  if (cls === 'smuggler') {
    const held = ['chems', 'parts'].find(g => you.goods[g] > 0) ?? (product > 0 ? 'product' : null);
    const sell = held ? stapleLine('smuggler', 'sell', held)(menu) : null;
    if (held && sell && !listed('sell', held) && !view.pickups.length) return { say: `Put your ${held} up for sale. The ${held === 'chems' ? 'cook' : held === 'parts' ? 'gunrunner' : 'dealers'} will say yes.`, entry: sell };
    const run = job('chems')(menu);
    const load = you.goods.chems + you.goods.parts + product;
    if (run && load < 6) return { say: 'Run chems in here: the cook always needs them.', entry: run };
    if (!load) return { say: 'The docks are where you get goods to sell. Head there.', entry: walkToward(view, map, nearestWith(view, map, 'supplier') ?? 'docks') };
    // a load in the bag and a listing up: carry it to where the buyers are, so a yes swaps on the spot
    const home = blocksWith(map, 'pads')[0];
    if (view.here?.block !== home) return { say: 'Carry your load home to the projects: the cook is there.', entry: walkToward(view, map, home) };
    return { say: 'Wait here for a yes: on the same block the swap is instant.', entry: rest };
  }
  if (cls === 'cook') {
    const cook = job()(menu);
    if (cook && you.goods.chems >= 3) return { say: 'Cook: three chems make a batch of product.', entry: cook };
    const sell = stapleLine('cook', 'sell', 'product')(menu);
    if (product > 0 && sell && !listed('sell', 'product') && !view.pickups.length) return { say: 'Put your product up for sale. The dealers buy it.', entry: sell };
    const buy = stapleLine('cook', 'buy', 'chems')(menu);
    if (buy && !listed('buy', 'chems') && !view.pickups.length) return { say: 'Out of chems. Order more: a smuggler will fill it.', entry: buy };
    return { say: 'Your offers are on the board. Wait for a yes.', entry: rest };
  }
  // the quieter seats: their job when there is one, or their staple offer
  const work = job()(menu);
  const staple = find(menu, m => isStaple(m, cls));
  if (staple && !(view.yourOffers ?? []).length) return { say: 'Put your offer on the board so the others can hire you.', entry: staple };
  return work ? { say: 'Do your job here.', entry: work } : { say: 'Nothing to do here this hour.', entry: rest };
}

/**
 * The guide's one mark for this hour, or null when the guide is over: { say, entry, offer }.
 *   entry   the menu line to take (it leads the move card), or null
 *   offer   the offer to say yes to first, or null
 * `memo` is { traded, closed, accepted }: `traded` once tradeDone() was true for the seat, `closed` once the line that
 * says so has been shown, `accepted` the offer ids the player has already said yes to this hour.
 */
export function guideFor(view, memo = {}, map) {
  const cls = view.you.cls;
  const menu = view.menu ?? [];
  if (!LOOPS[cls] || !menu.length) return null;
  const own = ownStep(view, map);
  if (memo.traded) return memo.closed ? null : { say: 'That was a whole trade: a yes, a walk, a swap. Keep that loop going.', entry: own.entry, offer: null };
  if (view.clock.t >= GUIDE_HOURS) return null;
  // a deal already closed: the goods still have to change hands
  const errand = errandsOf(view)[0];
  if (errand?.here) return { say: `${errand.withName} is on your block: the swap happens this hour.`, entry: own.entry, offer: null };
  if (errand?.entry) return { say: `Deal made. Walk to ${errand.withName}: the swap happens when you meet.`, entry: errand.entry, offer: null };
  if (errand) return { say: `${errand.withName} can\u2019t meet you yet. Carry on until they are out.`, entry: own.entry, offer: null };
  // loot to turn into cash: the fence is a trade too, and needs no yes
  if (cls === 'robber' && view.you.heat < 2 && (view.you.goods.chems > 0 || view.you.goods.parts > 0 || count(view.you.goods.product) > 0)) {
    const sale = fenceSale(menu);
    if (sale) return { say: 'The fence buys anything. Sell her what you took.', entry: sale, offer: null };
    const walk = walkToward(view, map, nearestWith(view, map, 'fence') ?? 'market');
    if (walk) return { say: 'What you took sells at the fence, in the market.', entry: walk, offer: null };
  }
  // an offer worth a yes, unless the player has already said it this hour
  const offer = sortOffers(view).lead.find(o => o.why !== 'paid work' && !(memo.accepted ?? []).includes(o.id)) ?? null;
  if (offer && !(cls === 'robber' && view.clock.t < 2)) {
    // someone on your block: stay put, and the swap happens the moment the deal closes
    const near = (view.here?.others ?? []).some(o => o.id === offer.from);
    const stay = find(menu, m => m.verb === 'work' && cls !== 'smuggler') ?? find(menu, m => m.verb === 'rest');
    if (offer.kind === 'tip') return { say: 'A tip on someone raises your odds of robbing them. Say yes.', entry: own.entry, offer };
    return { say: near ? 'Say yes to this one and stay put: they are here, so you swap at once.' : 'Say yes to this one: it is free, and it starts a trade.', entry: near ? stay : own.entry, offer };
  }
  return { say: own.say, entry: own.entry, offer: null };
}

// ---------------------------------------------------------------------------------------------------------------
// How much of the window the panels leave to the game

/** The share of a w × h window not covered by any of the rectangles ({ x, y, w, h }), 0 to 1. Overlaps count once. */
export function clearShare(rects, w, h) {
  const boxes = rects.map(r => ({ x0: Math.max(0, r.x), y0: Math.max(0, r.y), x1: Math.min(w, r.x + r.w), y1: Math.min(h, r.y + r.h) })).filter(b => b.x1 > b.x0 && b.y1 > b.y0);
  const xs = [...new Set(boxes.flatMap(b => [b.x0, b.x1]))].sort((a, b) => a - b);
  let covered = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    // the boxes over this vertical strip, merged along y
    const spans = boxes.filter(b => b.x0 <= xs[i] && b.x1 >= xs[i + 1]).map(b => [b.y0, b.y1]).sort((a, b) => a[0] - b[0]);
    let top = -Infinity;
    let tall = 0;
    for (const [y0, y1] of spans) {
      if (y1 <= top) continue;
      tall += y1 - Math.max(y0, top);
      top = y1;
    }
    covered += tall * (xs[i + 1] - xs[i]);
  }
  return w > 0 && h > 0 ? 1 - covered / (w * h) : 1;
}

export { money, nameOf, clockOf, blockName, describe, SKILL_TEXT };
