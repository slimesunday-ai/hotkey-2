// THE RUN'S OPENABLE PANELS (demo/run/index.js opens them, one at a time, beside the dock): the character sheet, every
// move that exists, the stuff that can be bought, and the map. Each is drawn from the run's own config, view and state
// (src/run/): no number here is typed by hand, so none of them can drift from the rules. They show. Two things act
// (rules-2): a street move's "now" tag in the All moves panel PICKS it on the bar (the numbers and Enter still choose
// there), and the place's shop in the Stuff panel is bought with one click. The three things stay the crib card's.
//
//   characterBody(ctx) · movesBody(ctx) · stuffBody(ctx) · the map's words: lineNote(ctx), stopFlag(ctx, stop), stopBody(ctx, stop)
//   hookedShort(cfg, regular) · hookedText(cfg, regular): how hooked a regular is, in words
//   trustMark(t) · trustMeter(cfg, n) · trustTitle(t) · tellEl(tell) · signedT(n): trust (trust-1), wherever a person
//   is named (the bar's cards use them too), and the chance of being told on, drawn as the odds are
//   ctx: { cfg, v, state, dayStart, choosing, pick(key), go(key) }
// The kit's own pieces (city/from-trunk/style/city/ui/kit.js: statRow, the k-stats rows, k-card) wherever one fits.

import { h, barEl } from '../hud/dom.js';
import { statRow } from '../../city/from-trunk/style/city/ui/kit.js';
import { jobOdds, danger as dangerAt } from '../../src/run/index.mjs';
// (the street's numbers for a place you are not at: the rules' own functions, read only)
import { robOdds, binsFinds, tierOf, placeOf, fullEnergy, doorChance } from '../../src/run/rules.mjs';

const money = n => `$${n}`;
const range = ([lo, hi]) => (lo === hi ? money(lo) : `$${lo}–${hi}`);
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const signed = n => (n > 0 ? `+${n}` : `−${-n}`);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const kbd = key => h('kbd', null, key);
const ROLE = { neighbour: 'neighbour', buyer: 'buyer', mark: 'mark', debtor: 'debtor', shopkeeper: 'shopkeeper', stallholder: 'stallholder' };
const PLACE_ORDER = ['park', 'market'];
const placeName = (cfg, p) => cap(cfg.places[p].label);

/** A section of a panel: a heading in the kit's sign face and its body. */
const sec = (title, ...kids) => h('section', { class: 'rn-sec' }, h('h3', { class: 'rn-sec-h' }, title), ...kids);

/** The ledger of a stretch of the run, from two copies of the books: what came in and what went out. */
function ledgerRows(cfg, from, to, banked) {
  return [
    ['Earned', to.earned - from.earned, 'good'], ['Taken', to.jumped - from.jumped, 'bad'], ['Seized', to.seized - from.seized, 'bad'],
    ['Fares', to.fares - from.fares, ''], ['Spent', to.spent - from.spent, ''], ['Banked now', banked, 'good'],
  ];
}
const ledgerEl = rows => h('div', { class: 'hk-ledger rn-ledger' }, rows.map(([label, n, tone]) => h('div', { class: n && tone ? `is-${tone}` : '' }, h('span', null, label), h('b', null, money(n)))));

/** A mood as a small plate in its colour (the same words the cards use). */
const moodEl = (cfg, mood) => h('em', { class: `rn-mood is-${mood}` }, mood === 'calm' ? 'calm' : cfg.moods[mood].replace(/^is /, ''));

// ── TRUST (RUN.md "Trust"): one number per person, kept across nights; its band is a mark by their name wherever they
// are named. ▼ AGAINST YOU on red (off your table, and about at their place they may call in what you do there);
// ▲ WITH YOU on ink (they see nothing, a job with them pays more). Neutral is quiet: no mark on a card, a grey word in
// the People tab. Never by colour alone: the arrow and the word say it too. All of it is the view's (`trust`,
// `trustHere`, an option's `trust`, `withPay`, `tellRisk`).
const GLYPH = { against: '▼', with: '▲', neutral: '·' };
export const signedT = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
/** A person's trust in words, for a tooltip: the number, the band, and what it means. */
export function trustTitle(t) {
  if (!t) return '';
  const days = t.offDays ? `; won't deal with you, ${plural(t.offDays, 'day')}` : '';
  const means = t.band === 'with' ? ': they see nothing, and a job with them pays more' : t.band === 'against' ? `${days}; about at their place, they may call the police on what you do there` : '';
  return `${t.name ? `${cap(t.name)}: ` : ''}trust ${signedT(t.trust ?? 0)} (${t.bandText ?? t.band ?? 'neutral'})${means}`;
}
/** The mark by a name: ▲ with you (and, on a card, the extra a job with them pays), ▼ against you; neutral only when asked. */
export function trustMark(t, { pay = 0, short = false, quiet = true } = {}) {
  if (!t) return null;
  const band = t.band ?? 'neutral';
  if (band === 'neutral' && quiet) return null;
  const word = band === 'with' ? 'with you' : band === 'against' ? (short ? 'against' : 'against you') : 'neutral';
  return h('span', { class: `rn-trust is-${band}`, title: `${trustTitle(t)}${pay ? `. With them it pays ${money(pay)} more.` : ''}` },
    h('i', { 'aria-hidden': 'true' }, GLYPH[band]), word, pay ? h('b', null, `+${money(pay)}`) : null);
}
/** The number as a small meter, −3 to +3 from the middle out: red to the left, green to the right; the bands' cells ringed. */
export function trustMeter(cfg, n) {
  const T = cfg.trust;
  const cells = [];
  for (let k = T.min; k <= T.max; k++) {
    if (!k) {
      cells.push(h('b'));
      continue;
    }
    const on = k < 0 ? n <= k : n >= k;
    cells.push(h('i', { class: `${k < 0 ? 'is-neg' : 'is-pos'}${on ? ' is-on' : ''}${k <= T.against || k >= T.with ? ' is-zone' : ''}` }));
  }
  return h('span', { class: 'rn-tmeter', role: 'img', 'aria-label': `trust ${signedT(n)} of ${signedT(T.min)} to ${signedT(T.max)}` }, ...cells, h('em', null, signedT(n)));
}
/**
 * The chance of being told on, as the odds are shown (a small bar and its number), and who would tell. null: nobody
 * would. `short` (a card's small line): someone nameless by their first words, "a man at the bus stop" as "a man"
 * (a place's nameless people differ in those), their whole name in the tooltip.
 */
export const shortName = name => name.replace(/^(an? [a-z]+) (at|in|with) .*$/i, '$1');
export function tellEl(tell, { by = true, short = false } = {}) {
  if (!tell?.pct) return null;
  const said = tell.by.map(p => cap(short ? shortName(p.name) : p.name)).join(' and ');
  const names = tell.by.map(p => cap(p.name)).join(' and ');
  return h('span', { class: 'rn-odds rn-tell', title: `${tell.pct}% ${names} (against you, about now) ${tell.by.length > 1 ? 'call' : 'calls'} it in: heat +${tell.heat} on the place` },
    barEl([{ key: 'clean', pct: 100 - tell.pct, label: 'kept quiet' }, { key: 'disaster', pct: tell.pct, label: 'called in' }], { small: true }),
    h('b', null, `${tell.pct}% told`), by ? h('span', { class: 'rn-tell-by' }, said) : null);
}

// ── A REGULAR: how hooked, in words (rules-2: they keep count of what you have sold them, across days) ──────────────
/** Short, for the card's small line: "not hooked", "getting hooked, had 2", "hooked, had 4", "badly hooked, had 6", or a grudge. */
export function hookedShort(cfg, r) {
  if (!r) return null;
  if (r.grudgeDays) return `a grudge: ${plural(r.grudgeDays, 'day')}`;
  const n = r.sold;
  const word = !n ? 'not hooked' : n < r.doorFrom ? 'getting hooked' : doorChance(cfg, n) >= cfg.regulars.capPct ? 'badly hooked' : 'hooked';
  return n ? `${word}, had ${n}` : word;
}
/** In full, for the People tab and the card's tooltip: what they have had, what they pay, and the door. */
export function hookedText(cfg, r) {
  if (!r) return '';
  const R = cfg.regulars;
  const up = Math.min(R.payUpMax, R.payUp * r.sold);
  const pays = up ? ` They pay $${up} more for it now.` : '';
  if (r.grudgeDays) return `Holding a grudge: no sales to them for ${plural(r.grudgeDays, 'more day')}. Has had ${r.sold} from you.`;
  if (!r.sold) return `A regular: easy to sell to, and they keep count. Nothing from you yet. From ${R.doorAt} sales on they may come to your door in the morning wanting more.`;
  if (!r.hooked) return `${hookedShort(cfg, r)}: has had ${r.sold} from you.${pays} ${r.doorFrom - r.sold} more and they may come to your door in the morning.`;
  return `${hookedShort(cfg, r)}: has had ${r.sold} from you.${pays} ${doorChance(cfg, r.sold)}% they are at your door each morning, wanting more.`;
}

// ── THE CHARACTER SHEET ────────────────────────────────────────────────────────────────────────────────────────────
/** The stats tab: only what the run's state and its books hold. */
export function characterStats({ cfg, v, state, dayStart }) {
  const owned = v.shop.filter(s => s.owned);
  const b = state.books;
  const energyNote = `${v.energyMax} a day on ${state.owned.bed ? 'the real bed' : 'the mattress'}; tired at ${cfg.energy.tiredAt} or less (odds −${cfg.energy.tiredOdds}, easier to jump)`;
  // (rules-2: your own heat beside the heat here, the higher of yours and the place's)
  const here = (v.places ?? []).find(p => p.here);
  const heatNote = `the heat on you where you stand is the higher of your own and the place's${here ? ` (${here.label}: ${here.heat})` : ''}. Yours drops ${cfg.heat.nightDrop} a night at home (not on the street, in the clinic or in jail); a place cools ${tierOf(cfg, 'park')?.cool ?? 2} every night. Where the police are about, they can stop you from heat ${cfg.police.from}`;
  return [
    sec('Now',
      h('div', { class: 'k-stats' },
        statRow('Day and hour', `Day ${v.day} · ${v.clock}`),
        statRow('Where', cap(v.placeLabel)),
        statRow(v.place === 'market' ? 'Carried · at risk' : 'Carried', money(v.carried), true),
        statRow('Banked · safe', money(v.banked)),
        statRow('Energy', `${v.energy} / ${v.energyMax}${v.tired ? ' · tired' : ''}`),
        statRow('Heat here', `${v.heatHere ?? v.heat} / ${v.heatMax}${here?.police ? ' · police about' : ''}`),
        statRow('Your own heat', `${v.heatYours ?? v.heat} / ${v.heatMax}`)),
      here ? h('p', { class: `rn-note${here.hot ? ' is-risk' : ''}` }, here.text) : null,
      h('p', { class: 'rn-note' }, `Energy: ${energyNote}. Every hour out costs ${cfg.energy.perHour}, the subway included.`),
      h('p', { class: 'rn-note' }, `Heat: ${heatNote}.`)),
    sec('What you own',
      owned.length
        ? h('ul', { class: 'rn-owns' }, owned.map(s => h('li', null, h('b', null, s.label), h('span', null, s.does))))
        : h('p', { class: 'rn-empty' }, 'Nothing yet: a mattress on the floor.')),
    sec('Today', ledgerEl(ledgerRows(cfg, dayStart, b, state.banked)),
      h('p', { class: 'rn-note' }, 'The night\'s report shows the same numbers when the day ends.')),
    sec('The run so far',
      h('div', { class: 'k-stats' },
        statRow('Days', state.day > 1 ? `day ${state.day}, ${plural(state.day - 1, 'day')} behind you` : 'day 1, the first'),
        statRow('Started with', money(b.start)),
        statRow('Earned in all', money(b.earned)),
        statRow('Taken by whoever jumped you', money(b.jumped)),
        statRow('Seized by the police', money(b.seized)),
        statRow('Fares', money(b.fares)),
        statRow('Spent on stuff', money(b.spent)),
        statRow('All three owned', state.doneDay ? `done in ${plural(state.doneDay, 'day')}` : `${owned.length} of ${v.shop.length} so far`))),
  ];
}

/**
 * The wearing tab: what the figure in the picture is made of, slot by slot, from the stage's own look of the player
 * (the spec the portrait is fed), each piece by the name the city's catalogue gives it (world/cast/fresh/). The list
 * is the section's first column; a skin picker, when there is one, goes in a column beside it (`.rn-wear`).
 */
export function characterWearing({ wearing, honest }) {
  if (!wearing) return [sec('Wearing', h('p', { class: 'rn-empty' }, 'Not ready yet: the figure is still being looked up.'))];
  const on = wearing.filter(w => w.id && w.id !== 'none');
  return [
    sec('Wearing',
      h('p', { class: 'rn-note' }, `Your figure as the stage dresses it${honest ? ' (the one turning above)' : ''}: ${on.length} of ${wearing.length} slots. Skins to choose from come later.`),
      h('div', { class: 'rn-wear' },
        h('ul', { class: 'rn-wear-list' }, wearing.map(w => h('li', { class: !w.id || w.id === 'none' ? 'is-none' : '' },
          h('span', { class: 'rn-role' }, w.label),
          h('b', null, !w.id || w.id === 'none' ? 'nothing' : w.id === 'base' ? 'the base' : w.name ?? w.id),
          w.name ? h('code', null, w.id) : null))))),
  ];
}

/**
 * The people tab: everybody at the two places, their role, today's mood, whether they are out for the day, and
 * (trust-1) their trust in you: the band's mark, the number as a meter, the days they won't deal with you. The place
 * you are in comes first, with who is about there this hour (only someone about can see what you do) and the view's
 * own sentence of who would tell.
 */
export function characterPeople({ cfg, v }) {
  const T = cfg.trust;
  const at = v.trustHere?.place ?? (v.trust ?? []).find(t => t.here)?.place ?? null;
  const order = PLACE_ORDER.slice().sort((a, b) => Number(b === at) - Number(a === at));
  const pay = Math.round(T.withPay * (tierOf(cfg, 'park')?.pay ?? 1));
  const payMarket = Math.round(T.withPay * (tierOf(cfg, 'market')?.pay ?? 1));
  return [
    ...order.map(place => {
      const all = v.people.filter(p => p.place === place);
      const trust = new Map((v.trust ?? []).filter(t => t.place === place).map(t => [t.id, t]));
      const here = place === at;
      const left = all.filter(p => !p.outToday).length;
      // (where you are, first: the chance a crime or the bins is told on this hour, as the odds are shown; the view's
      // own sentence of it in the tooltip)
      const th = here ? v.trustHere : null;
      const told = th ? tellEl({ ...th.tellRisk, text: th.text }) : null;
      return sec(`${placeName(cfg, place)}${here ? ' · you are here' : ''}`,
        th ? h('p', { class: `rn-note rn-told-here${told ? ' is-risk' : ''}`, title: th.text }, told ? [h('span', null, 'A crime or the bins here this hour: '), told] : 'Nobody here against you is about: nothing you do here is called in this hour.') : null,
        h('ul', { class: 'rn-people' }, all.map(p => {
          const t = trust.get(p.id);
          const band = t?.band ?? 'neutral';
          return h('li', { class: `${p.outToday ? 'is-out' : ''}${p.regular ? ' is-regular' : ''} is-${band}` },
            h('b', null, cap(p.name)),
            h('span', { class: 'rn-role' }, ROLE[p.role] ?? p.role),
            moodEl(cfg, p.mood),
            p.outToday ? h('span', { class: 'hk-tag is-why' }, 'out today') : null,
            // (their trust, under the row: the band, the meter, about now or not where you are, the days off your table)
            t ? h('div', { class: 'rn-trust-line', title: trustTitle(t) },
              trustMark(t, { quiet: false }), trustMeter(cfg, t.trust),
              here ? h('span', { class: `rn-about${t.around ? ' is-on' : ''}` }, t.around ? 'about now' : 'not about') : null,
              t.offDays ? h('span', { class: 'rn-off' }, t.offText) : null) : null,
            // (a regular: how hooked, in words, under the row)
            p.regular ? h('p', { class: `rn-hooked-line${p.regular.hooked ? ' is-hooked' : ''}` }, hookedText(cfg, p.regular)) : null);
        })),
        h('p', { class: 'rn-note' }, `${plural(left, 'person', 'people')} left to work today of ${all.length}. Whoever you work (not the safe job) is out for the rest of the day; everyone is calm again in the morning.`));
    }),
    h('p', { class: 'rn-note rn-trust-key' }, 'Trust runs ', h('b', null, `${signedT(T.min)} to ${signedT(T.max)}`), ', lasts across nights and drifts back to 0; each place\'s people are its own. ',
      trustMark({ band: 'against', trust: T.against, bandText: T.bands.against }), ` at ${signedT(T.against)} or less: won't deal with you; about at their place, ${T.tellPct}% each to call in a crime or the bins there (heat +${T.tellHeat}). `,
      trustMark({ band: 'with', trust: T.with, bandText: T.bands.with }), ` at ${signedT(T.with)} or more: they look away, and a job with them pays ${money(pay)} more (${money(payMarket)} at the market).`),
  ];
}

// ── EVERY MOVE THAT EXISTS ─────────────────────────────────────────────────────────────────────────────────────────
/** One job as the panel lists it: pay, odds, what failing costs, who it is done to, what it needs, and whether it is on the table. */
function jobEl(cfg, v, state, place, id, job) {
  const dealt = v.place === place ? v.options.find(o => o.id === id) : null;
  const people = v.people.filter(p => p.place === place && p.role === job.role);
  const left = people.filter(p => !p.outToday);
  const needs = job.needs ? cfg.shop[job.needs] : null;
  const able = !job.needs || state.owned[job.needs];
  const now = jobOdds(cfg, state, job);
  const fails = [job.failHeat ? `heat ${signed(job.failHeat)}` : null, job.failEnergy ? `energy ${signed(-job.failEnergy)}` : null].filter(Boolean);
  const tags = [];
  if (dealt) tags.push(h('span', { class: 'rn-ontable' }, 'on the table', kbd(dealt.key)));
  else if (!able) tags.push(h('span', { class: 'hk-tag is-why' }, `needs ${needs.label.replace(/^an? /i, 'the ').toLowerCase()}`));
  else if (!job.safe && !left.length) tags.push(h('span', { class: 'hk-tag' }, 'nobody left today'));
  else if (v.place === place) tags.push(h('span', { class: 'hk-tag' }, 'not dealt this hour'));
  const better = [];
  if (needs) better.push(`Possible only with ${needs.label.toLowerCase()} (${money(needs.price)}${state.owned[job.needs] ? ', yours' : ''}).`);
  if (!job.safe) better.push(`Tired (energy ${cfg.energy.tiredAt} or less): ${Math.max(0, job.odds - cfg.energy.tiredOdds)}%.${now.why.length ? ' You are tired now.' : ''}`);
  // (trust-1: how it moves its person's trust, and who here would tell on it; with you, a job with them pays more)
  const tw = job.trust ?? {};
  const moves = [tw.win ? `works ${signedT(tw.win)}` : job.safe ? null : 'works 0', job.safe ? null : `fails ${signedT(tw.fail ?? 0)}`].filter(Boolean);
  if (moves.length) better.push(`Their trust: ${moves.join(', ')}.`);
  const trustBy = new Map((v.trust ?? []).map(t => [t.id, t]));
  const tell = dealt?.tellRisk ?? null;
  const friend = dealt?.withPay ? h('span', { class: 'rn-trust is-with', title: `${cap(dealt.who?.name ?? '')} is with you: the pay above includes it` }, h('i', { 'aria-hidden': 'true' }, GLYPH.with), 'with you', h('b', null, `+${money(dealt.withPay)}`)) : null;
  return h('li', { class: `rn-job${dealt ? ' is-dealt' : ''}${able ? '' : ' is-locked'}${job.safe ? ' is-safe' : ''}` },
    h('div', { class: 'rn-job-head' }, h('b', null, job.label), h('span', { class: 'rn-pay' }, range(job.pay))),
    h('div', { class: 'rn-job-odds' },
      job.safe ? h('span', { class: 'hk-tag is-yours' }, 'sure') : h('span', { class: 'hk-mini' }, barEl([{ key: 'clean', pct: job.odds, label: 'works' }, { key: 'disaster', pct: 100 - job.odds, label: 'fails' }], { small: true }), h('b', null, `${job.odds}%`)),
      job.safe ? h('span', null, 'always dealt, never fails') : h('span', null, `fails: ${fails.length ? fails.join(', ') : 'nothing lost'}`),
      job.winHeat ? h('span', { class: 'hk-tag is-down' }, `heat ${signed(job.winHeat)} even when it works`) : null,
      tellEl(tell), friend,
      ...tags),
    h('p', { class: 'rn-job-who' }, h('span', null, `Done ${job.safe ? 'with' : 'to'}: `),
      people.length ? people.map((p, i) => h('span', { class: `rn-who-name${p.outToday ? ' is-out' : ''}` }, i ? ', ' : '', cap(p.name), p.mood !== 'calm' ? h('em', { class: `rn-mood is-${p.mood}` }, cfg.moods[p.mood].replace(/^is /, '')) : null, trustMark(trustBy.get(p.id), { short: true }))) : 'nobody'),
    better.length ? h('p', { class: 'rn-job-better' }, better.join(' ')) : null);
}

/**
 * THE STREET AT A PLACE (rules-2): robbing somebody passing, the bins, what its shop sells, sleeping rough, each with
 * its numbers (the rules' own: robOdds, binsFinds, the tier), and what the place has left of each today. Where you
 * stand, each says whether it can be done now, with its key; a click picks it on the bar.
 */
function streetEl(ctx, place) {
  const { cfg, v, state } = ctx;
  const p = placeOf(cfg, place);
  const pv = (v.places ?? []).find(q => q.place === place);
  const sup = pv?.supply ?? {};
  const at = v.place === place;
  const choiceOf = what => (at ? v.choices.filter(c => c.choice.do === what).sort((a, b) => Number(b.available) - Number(a.available))[0] ?? null : null);
  const tag = (c, letter) => (!c ? null : c.available
    ? h('button', { type: 'button', class: 'rn-ontable', title: 'Pick it on the bar', onclick: () => ctx.pick?.(c.key) }, 'now', kbd(letter))
    : h('span', { class: 'hk-tag is-why' }, c.why));
  const left = (s, what) => (s ? h('span', { class: `rn-supply${s.left ? '' : ' is-none'}` }, `${s.left} of ${s.max} ${what} left today (+${s.refill} a morning)`) : null);
  const row = (name, pay, text, more, now) => h('li', { class: `rn-job rn-street${now?.tagName === 'BUTTON' ? ' is-dealt' : ''}` },
    h('div', { class: 'rn-job-head' }, h('b', null, name), pay ? h('span', { class: 'rn-pay' }, pay) : null),
    h('p', { class: 'rn-job-better' }, text),
    h('div', { class: 'rn-job-odds' }, more, now));
  const out = [];
  // (trust-1: where you stand, who here would tell on a robbery or the bins this hour, as the odds are shown)
  const T = cfg.trust;
  const tell = at ? tellEl(choiceOf('rob')?.tellRisk ?? choiceOf('bins')?.tellRisk ?? v.trustHere?.tellRisk) : null;
  const tellWords = `Anyone here against you who is about has ${T.tellPct}% to see it and call it in (heat +${T.tellHeat} on ${p.label})${at ? (tell ? '' : ': nobody this hour') : ''}.`;
  if (sup.strangers) {
    const o = robOdds(cfg, state, place);
    const needs = cfg.street.rob.needs;
    out.push(row('Rob somebody passing', `${o.pct}% · ${range(o.pay)}`,
      `An hour and ${cfg.energy.perHour} energy. It works: heat +${o.winHeat} on ${p.label}. It fails: heat +${o.failHeat} there, and they get away shouting. Nobody knows it was you; the place does: ${cfg.street.rob.perHeat} off the odds for each heat it has${o.why.length ? ` (now ${o.why.join(', ')})` : ''}. ${tellWords} Needs ${cfg.shop[needs].label.replace(/^an? /i, 'the ').toLowerCase()}${state.owned[needs] ? ' (yours)' : ''}.`,
      [left(sup.strangers, 'worth robbing'), tell], tag(choiceOf('rob'), 'R')));
  }
  if (sup.bins) {
    const finds = binsFinds(cfg, place);
    const seen = p.binsSeen;
    out.push(row('Dig through the bins', range([0, finds[finds.length - 1].pay[1]]),
      `An hour and ${cfg.energy.perHour} energy: ${finds.map(f => (f.pay[1] ? `${f.pct}% ${range(f.pay)}` : `${f.pct}% nothing`)).join(', ')}.${seen ? ` ${seen.pct}% a ${seen.role} sees you: one with you looks away; anyone else ${cfg.moods[seen.mood]} (trust ${signedT(T.seenBins)}, and they skip their turn at the safe job today).` : ' Nobody here minds.'} ${tellWords}`,
      [left(sup.bins, 'bins'), tell?.cloneNode(true) ?? null], tag(choiceOf('bins'), 'B')));
  }
  for (const it of p.shop ?? []) {
    const c = at ? v.choices.find(x => x.choice.do === 'shop' && x.choice.item === it.item) : null;
    const sold = at ? v.shopHere.find(s => s.item === it.item) : null;
    out.push(row(it.label, money(it.price), `${it.does}. Paid from what you carry; no hour.${it.perDay ? ` ${it.perDay} a day.` : ''} The Stuff panel (S) sells it.`,
      sold?.left !== null && sold?.left !== undefined ? h('span', { class: `rn-supply${sold.left ? '' : ' is-none'}` }, `${sold.left} of ${it.perDay} left today`) : null, tag(c, 'E')));
  }
  if (!p.door && p.tier) {
    const tier = tierOf(cfg, place);
    out.push(row('Sleep rough', `${tier.roughPct}% robbed`,
      `The day ends here, on the street. ${tier.roughPct}% they rob you in your sleep (asleep, they are ${cfg.rough.strength} stronger; the box cutter and the pocket help as ever); no clinic. You wake here at noon with energy ${Math.max(cfg.energy.minMorning, fullEnergy(cfg, state) - cfg.energy.roughMorning)}, still carrying what is left, your own heat not cooled. Out of energy away from home, it is this or a drink.`,
      null, tag(choiceOf('rough'), 'Z')));
  }
  if (sup.custom) {
    const reg = (v.people ?? []).filter(q => q.place === place && q.regular);
    out.push(h('li', { class: 'rn-job rn-street is-note' }, h('div', { class: 'rn-job-odds' },
      left(sup.custom, `sales to ${reg.map(q => cap(q.name)).join(', ') || 'a regular'}`), ...reg.map(q => h('span', { class: `rn-hooked${q.regular.hooked ? ' is-hooked' : ''}` }, hookedShort(cfg, q.regular))))));
  }
  return out.length ? h('div', { class: 'rn-street-sec' }, h('p', { class: 'rn-sub-h' }, `On the street${pv ? ` · heat ${pv.heat}${pv.police ? ', police about' : ''}` : ''}`), h('ul', { class: 'rn-jobs' }, out)) : null;
}

/** Every job by place (the corner locked), then the moves that are not jobs. */
export function movesBody(ctx) {
  const { cfg, v, state } = ctx;
  const s = cfg.subway;
  const e = cfg.energy;
  const choiceKey = test => v.choices.find(c => test(c.choice));
  const now = c => (c ? (c.available ? h('span', { class: 'rn-ontable' }, 'now', kbd(c.key)) : h('span', { class: 'hk-tag is-why' }, c.why)) : null);
  const move = (name, what, c, extra = null) => h('li', { class: `rn-job rn-way${c?.available ? ' is-dealt' : ''}` },
    h('div', { class: 'rn-job-head' }, h('b', null, name), extra ? h('span', { class: 'rn-pay' }, extra) : null),
    h('div', { class: 'rn-job-odds' }, h('span', null, what), now(c)));
  const jobsAt = place => Object.entries(cfg.jobs[place]);
  const count = PLACE_ORDER.reduce((n, p) => n + jobsAt(p).length, 0);
  return [
    h('p', { class: 'rn-lede' }, `${count} jobs at two places, a third place locked, and ${v.place === 'park' || v.place === 'market' ? `${v.options.length} dealt this hour` : 'none dealt where you are'}. Each hour a place deals its safe job and two of the rest that still have somebody to do them to. Every job costs an hour and ${e.perHour} energy.`),
    ...PLACE_ORDER.map(place => sec(`${placeName(cfg, place)}${v.place === place || (place === 'park' && v.place === 'crib') ? ' · you are here' : ''}`,
      place === 'market' ? h('p', { class: 'rn-note is-risk' }, `Pays about twice the park, and people will take it off you: every hour there can go wrong (now ${dangerAt(cfg, { ...state, place: 'market', hoursThere: state.place === 'market' ? state.hoursThere : 0 }).jump.chance}% jumped for a ${state.place === 'market' ? 'this' : 'first'} hour, more each hour and each $${cfg.jump.perDollars} on you; police from heat ${cfg.police.from}).`) : h('p', { class: 'rn-note' }, 'Safe and poor: nobody jumps you here. The police come only once the place itself is hot.'),
      (v.places ?? []).find(q => q.place === place) ? h('p', { class: `rn-note${(v.places ?? []).find(q => q.place === place).hot ? ' is-risk' : ''}` }, (v.places ?? []).find(q => q.place === place).text) : null,
      h('ul', { class: 'rn-jobs' }, jobsAt(place).map(([id, job]) => jobEl(cfg, v, state, place, id, job))),
      streetEl(ctx, place))),
    // (a regular at your door, or one who may come: the morning's two answers)
    doorEl(ctx),
    sec(`${placeName(cfg, 'corner')} · locked`,
      h('ul', { class: 'rn-jobs' }, h('li', { class: 'rn-job is-locked' },
        h('div', { class: 'rn-job-head' }, h('b', null, `${cap(cfg.places.corner.label)}: ${cfg.places.corner.locked}`)),
        h('p', { class: 'rn-job-better' }, 'On the subway map, and the next place. Nothing can be done there yet.')))),
    sec('Getting about, home and the night',
      h('ul', { class: 'rn-jobs' },
        move('Step out', `From the crib to the trailer park. No hour. Take any of your banked money with you (none unless you say). Needs ${e.perHour} energy.`, choiceKey(c => c.do === 'out')),
        move('Go inside', 'From the trailer park into the crib. No hour. Everything you carry is banked: safe. H picks it.', choiceKey(c => c.do === 'inside')),
        move('Subway to the flea market', `One hour and ${e.perHour} energy, ${money(s.fare)} fare from what you carry. You need energy ${e.rideBack + e.perHour} to get there and back.`, choiceKey(c => c.do === 'subway' && c.to === 'market' && !c.hop), money(s.fare)),
        move('Hop it', `The subway without the fare: free, ${s.hopCaughtPct}% you are seen (heat +${s.hopHeat}), and you still ride. Carrying under ${money(s.fare)}, it is the only way.`, choiceKey(c => c.do === 'subway' && c.hop), 'free'),
        move('Head home', `From the market, ${money(s.fare)} or hop it. The hour you leave is still an hour there: it can still go wrong. Home, what you carry is banked. H picks it.`, choiceKey(c => c.do === 'subway' && c.to === 'park' && !c.hop), money(s.fare)),
        move('Sleep', `At the crib. The day ends: energy back to ${state.owned.bed ? e.bed : e.mattress}, heat −${cfg.heat.nightDrop}, everyone calm again.`, choiceKey(c => c.do === 'sleep')),
        move('Buy', 'At the crib, from banked money: the stuff (S) lists it all.', v.choices.find(c => c.choice.do === 'buy' && c.available) ?? null),
        move('Morning', `Out of the clinic or the jail and home. The day after the clinic starts ${e.clinicMorning} energy lower, after jail ${e.jailMorning}.`, choiceKey(c => c.do === 'morning')))),
  ];
}

/** The door: a regular there now (give G, shut X), or how one comes to be there. */
function doorEl(ctx) {
  const { cfg, v } = ctx;
  const R = cfg.regulars;
  const give = v.door ? v.choices.find(c => c.choice.do === 'give') : null;
  const shut = v.door ? v.choices.find(c => c.choice.do === 'refuse') : null;
  const tag = (c, letter) => (!c ? null : c.available
    ? h('button', { type: 'button', class: 'rn-ontable', title: 'Pick it on the bar', onclick: () => ctx.pick?.(c.key) }, 'now', kbd(letter))
    : h('span', { class: 'hk-tag is-why' }, c.why));
  return sec(`At your door${v.door ? ' · now' : ''}`,
    v.door ? h('p', { class: 'rn-note is-risk' }, v.door.text) : h('p', { class: 'rn-note' }, `A regular you have sold to ${R.doorAt} times or more may be at your door in a morning (${R.doorPct}%, +${R.perSale} for each sale past ${R.doorAt}, at most ${R.capPct}%), wanting $${R.wants[0]}–${R.wants[1]} and $${R.wantsUp} more for each sale past ${R.doorAt}.`),
    h('ul', { class: 'rn-jobs' },
      h('li', { class: `rn-job rn-street${give?.available ? ' is-dealt' : ''}` }, h('div', { class: 'rn-job-head' }, h('b', null, 'Give them what they ask'), v.door ? h('span', { class: 'rn-pay' }, money(v.door.wants)) : null),
        h('p', { class: 'rn-job-better' }, `From banked. They go, friendly; their count drops by ${R.giveEases}, and they will be back.`), h('div', { class: 'rn-job-odds' }, tag(give, 'G'))),
      h('li', { class: `rn-job rn-street${shut?.available ? ' is-dealt' : ''}` }, h('div', { class: 'rn-job-head' }, h('b', null, 'Shut the door on them')),
        h('p', { class: 'rn-job-better' }, `${R.fightPct}% they swing at you (their strength ${R.strength}, less the box cutter): their clean win costs you ${R.hurt.clean} energy today, a messy one ${R.hurt.messy}. Their trust ${signedT(cfg.trust.refuse)}: from neutral that is against you, so otherwise a grudge: no sales to them for ${plural(R.grudgeDays, 'day')}, and the police come round where they live (heat +${R.grudgeHeat} there). One who was with you at ${signedT(cfg.trust.max)} only goes off sore: no grudge, no police. Giving: trust ${signedT(cfg.trust.give)}. Stepping out or sleeping past them shuts it too.`),
        h('div', { class: 'rn-job-odds' }, tag(shut, 'X')))));
}

// ── THE STUFF ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** Everything that can be bought: price, what it does, owned or not, and how far banked money is from it. A list that holds many. */
export function stuffBody(ctx) {
  const { cfg, v } = ctx;
  const rows = v.shop.slice().sort((a, b) => Number(a.owned) - Number(b.owned) || a.price - b.price);
  const owned = rows.filter(s => s.owned).length;
  return [
    hereEl(ctx),
    h('p', { class: 'rn-lede' }, `${owned} of ${rows.length} owned. Bought at ${cfg.places.crib.label} from banked money, on the move card there; never lost.`),
    h('ul', { class: 'rn-stuff' }, rows.map(s => {
      const gap = s.price - v.banked;
      const status = s.owned ? h('span', { class: 'hk-tag is-yours' }, 'owned')
        : gap > 0 ? h('span', { class: 'rn-gap' }, `${money(gap)} to go`, h('em', null, ` · ${money(v.banked)} banked${v.carried ? `, ${money(v.carried)} carried` : ''}`))
          : v.place === 'crib' && s.key ? h('span', { class: 'rn-ontable' }, 'buy it now', kbd(s.key)) : h('span', { class: 'rn-gap is-go' }, 'banked enough: buy it at the crib');
      const bar = s.owned ? null : h('div', { class: 'rn-goal-bar' }, h('i', { class: 'is-banked', style: `width:${Math.min(100, (v.banked / s.price) * 100)}%` }),
        h('i', { class: 'is-carried', style: `width:${Math.max(0, Math.min(100 - (v.banked / s.price) * 100, (v.carried / s.price) * 100))}%` }));
      return h('li', { class: `rn-thing${s.owned ? ' is-owned' : ''}` },
        h('div', { class: 'rn-job-head' }, h('b', null, s.label), h('span', { class: 'rn-pay' }, money(s.price))),
        h('p', { class: 'rn-thing-does' }, s.does),
        h('div', { class: 'rn-job-odds' }, status), bar);
    })),
    h('p', { class: 'rn-note' }, 'More to come. These three are bought on the crib\'s card.'),
  ];
}

/**
 * WHAT THE PLACE YOU STAND IN SELLS (the view's `shopHere`, from the place's own `shop` list: a new item shows with no
 * new code): price, what it does, how many left today; Buy is one click here (or its key, E, on the bar). Elsewhere,
 * where each place's shop is.
 */
function hereEl(ctx) {
  const { cfg, v } = ctx;
  const items = v.shopHere ?? [];
  const sells = Object.entries(cfg.places).filter(([, p]) => p.shop?.length);
  if (!items.length) {
    return sells.length ? h('section', { class: 'rn-sec rn-here' }, h('h3', { class: 'rn-sec-h' }, 'Sold on the street'),
      h('ul', { class: 'rn-stuff' }, sells.flatMap(([, p]) => p.shop.map(it => h('li', { class: 'rn-thing is-away' },
        h('div', { class: 'rn-job-head' }, h('b', null, it.label), h('span', { class: 'rn-pay' }, money(it.price))),
        h('p', { class: 'rn-thing-does' }, `${it.does}${it.perDay ? ` · ${it.perDay} a day` : ''}`),
        h('div', { class: 'rn-job-odds' }, h('span', { class: 'hk-tag' }, `at ${p.label}`))))))) : null;
  }
  return h('section', { class: 'rn-sec rn-here' }, h('h3', { class: 'rn-sec-h' }, `Sold here, ${cfg.places[v.place]?.where ?? v.placeLabel}`),
    h('ul', { class: 'rn-stuff' }, items.map((it, i) => h('li', { class: `rn-thing is-here${it.available ? '' : ' is-off'}` },
      h('div', { class: 'rn-job-head' }, h('b', null, it.label), h('span', { class: 'rn-pay' }, money(it.price))),
      h('p', { class: 'rn-thing-does' }, it.does),
      h('div', { class: 'rn-job-odds' },
        it.left !== null ? h('span', { class: `rn-supply${it.left ? '' : ' is-none'}` }, `${it.left} of ${it.perDay} left today`) : null,
        it.available && ctx.choosing
          ? h('button', { type: 'button', class: 'k-btn rn-buy', onclick: () => ctx.go?.(it.key) }, `Buy ${money(it.price)}`, i === 0 ? kbd('E') : null)
          : h('span', { class: 'hk-tag is-why' }, it.why ?? 'not now'))))),
    h('p', { class: 'rn-note' }, 'Paid from what you carry, no hour.'));
}

// ── THE MAP'S STOPS ────────────────────────────────────────────────────────────────────────────────────────────────
// The map panel is the kit's paper map of the island (demo/run/map.js); these are the words on it. Each stop's card
// (a click on the stop): what it pays, its danger in a word and a number, who is left to work there today; the corner
// locked as the next place. And the line itself in one sentence. Read-only: the moves stay on the bar.
export const STOP_NAME = { park: 'Trailer park', market: 'Flea market', corner: 'The corner' };
export const stopOf = v => (v.place === 'crib' ? 'park' : v.place === 'jail' || v.place === 'clinic' ? null : v.place);

/** Names in a sentence, each followed by its trust mark when it is not neutral. */
const named = (v, people) => {
  const trust = new Map((v.trust ?? []).map(t => [t.id, t]));
  return people.flatMap((p, i) => [i ? ', ' : '', cap(p.name), trustMark(trust.get(p.id), { short: true }) ? ' ' : '', trustMark(trust.get(p.id), { short: true })]).filter(x => x !== '' && x !== null);
};

/** The pay of the options a stop can deal you (the stick-up only with the box cutter): its range. */
function payOf(cfg, place, owned) {
  const jobs = Object.values(cfg.jobs[place] ?? {}).filter(j => !j.needs || owned[j.needs]);
  return jobs.length ? [Math.min(...jobs.map(j => j.pay[0])), Math.max(...jobs.map(j => j.pay[1]))] : null;
}
/** The market's danger: the view's own this hour when you are there; else the engine's for a first hour there now. */
const marketDanger = ({ cfg, v, state }) => (v.danger.here ? v.danger.thisHour : dangerAt(cfg, { ...state, place: 'market', hoursThere: 0 }));

/** The line in one sentence: the fare, the turnstile, the hour and the energy a ride costs. */
export const lineNote = ({ cfg }) => `The line: ${money(cfg.subway.fare)} fare, or hop the turnstile (${cfg.subway.hopCaughtPct}% seen: heat +${cfg.subway.hopHeat}) · 1 hour, ${cfg.energy.perHour} energy.`;

/** A stop's flag on the map, at a glance: its pay and its danger in a word. */
export function stopFlag(ctx, stop) {
  const { cfg, state } = ctx;
  if (stop === 'corner') return 'locked';
  const r = payOf(cfg, stop, state.owned);
  // (rules-2: a place nobody jumps you in is "safe" only while it is not hot: hot, the police are about there)
  const hot = (ctx.v.places ?? []).find(q => q.place === stop)?.hot;
  return `${r ? range(r) : '–'} · ${stop === 'market' ? `${marketDanger(ctx).jump.chance}% jumped` : hot ? 'nobody jumps you' : 'safe'}`;
}

/** A stop's card: what it pays, its danger, who is left there today (the corner: locked, the next place). */
export function stopBody(ctx, stop) {
  const { cfg, v, state } = ctx;
  const at = stopOf(v);
  const here = stop === at ? h('span', { class: 'hk-tag is-yours' }, v.place === 'crib' ? 'you are home' : 'you are here') : null;
  if (stop === 'corner') {
    return [h('p', null, h('b', null, 'Locked'), ` ${cfg.places.corner.locked}. The next place: nothing can be done there yet.`)];
  }
  const r = payOf(cfg, stop, state.owned);
  const all = v.people.filter(p => p.place === stop);
  const on = all.filter(p => !p.outToday);
  const out = all.filter(p => p.outToday);
  const mk = stop === 'market' ? marketDanger(ctx) : null;
  // (rules-2: the place's own heat and police, in the view's words, and what it has left of its street today)
  const pl = (v.places ?? []).find(q => q.place === stop);
  const sup = pl?.supply ?? {};
  const supWords = [sup.strangers ? `${sup.strangers.left} worth robbing` : null, sup.bins ? `${sup.bins.left} bins` : null, sup.custom ? `${sup.custom.left} sales to a regular` : null].filter(Boolean);
  return [
    here,
    pl ? h('p', { class: pl.hot ? 'is-hot' : pl.police ? 'is-police' : 'is-quiet' }, h('b', null, `heat ${pl.heat}`), ` ${pl.text}`) : null,
    h('p', null, 'Pays ', h('b', null, r ? range(r) : '–'), ' an hour.'),
    mk
      ? h('p', { class: 'is-risk' }, h('b', null, `${mk.jump.chance}% jumped`), v.danger.here ? ' this hour, and rising.' : ` a first hour there, rising each hour and each $${cfg.jump.perDollars} on you.`)
      : h('p', { class: 'is-safe' }, h('b', null, 'Safe'), ': nobody acts on you here.'),
    mk?.stop.chance ? h('p', { class: 'is-police' }, h('b', null, `${mk.stop.chance}% police`), ` at heat ${v.place === stop ? v.heatHere : Math.max(state.heat, pl?.heat ?? 0)} here.`) : null,
    // (each name with its trust mark when it is not neutral: trust-1)
    h('p', { class: 'rn-stop-left' }, h('span', null, on.length ? 'Left today: ' : 'Nobody left today.'), ...named(v, on),
      out.length ? h('em', null, `${on.length ? '.' : ''} Out: `, ...named(v, out), '.') : on.length ? '.' : null),
    supWords.length ? h('p', { class: 'rn-stop-left' }, h('span', null, 'On the street: '), `${supWords.join(', ')} left today.`) : null,
  ];
}
