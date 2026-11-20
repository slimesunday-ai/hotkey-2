// THE RAID ON YOUR HOME, ON THE PAGE (raid-1, RUN.md "The raid on your home (raid-1)", "On the page"). The rules are
// src/run/raid.mjs and the night's step (src/run/step.mjs sixesRaidNight); this file only draws what they decided and
// sends the choices they offer. Every figure is the rules' own: the odds are raid.mjs raidOdds, sampled in the
// background (demo/run/odds.js: "…" until a count arrives), the stakes are raid.mjs's shareTaken, hiddenOf,
// thingsAtRisk, thingsToKnock and the config's shares.
//
//   const raid = createRaidUI(ctx)          ctx: { cfg, odds, S: () => S, fromPanel, toggle }
//   raid.weak(crew)                         what a crew is weak to, in plain words
//   raid.word(e)                            the morning's word (the `raidWarned` event) as a notice: { head, text, ... }
//   raid.worthStat(v, stat)                 THE WORTH METER on your numbers (a press opens its slip)
//   raid.paintWorth(node, v, open)          its slip: what it counts, the crew it brings, what is hidden and at risk
//   raid.paintCard(node, v, open)           THE ONE DECISION: who comes and what they are weak to, what is in your
//                                           hands, home or out, who stands with you, each with its odds; folded under
//                                           their titles, what you lose, what you win, what would help (raidfight-5)
//   raid.resultEl(e, state)                 the night as a card: held or lost, and each thing it cost, where it lives
//   raid.staging(D)                         how the night's fight is shown: 'scene' (the fight page's raid), or 'none'
import { h, fill } from '../hud/dom.js';
import { raidOdds, shareTaken, hiddenOf, thingsAtRisk, thingsToKnock, holdLabel } from '../../src/run/raid.mjs';
import { defVal, guardOf, goodsText, clamp } from '../../src/run/rules.mjs';
import { chances } from '../../src/contest.mjs';

const money = n => `$${n}`;
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const kbd = key => h('kbd', null, key);
/** A share as "N in 10" (NaN while it is worked out: the page says "…"). */
export const in10 = pct => `${Math.round(pct / 10)} in 10`;
/** The page's key for the card. */
export const RAID_KEY = 'Y';

/**
 * WHAT EACH CREW IS WEAK TO, in the player's words (RUN.md's table "Who comes": the gun that answers it, the names as
 * RUN.md has them). Words only: the odds on the card are the rules'.
 */
export const WEAK = Object.freeze({
  rush: 'Weak to a shotgun at the door: the Doorman takes several of them with each shell.',
  runners: 'They go down easy. Weak to a gun that sprays: the Chopper cuts them down before they reach you.',
  shooters: 'Fists can\'t reach the ones at the back. Weak to a gun that reaches them: the Six-shot or the Chopper.',
  bigmen: 'Heavy jackets soak up blows: fists barely dent them. Weak to the Long-eye, as they walk across the lot.',
})

export function createRaidUI({ cfg, odds, S, fromPanel, toggle }) {
  const X = cfg.sixesRaid;
  const thing = k => cfg.things?.[k];
  const named = label => String(label ?? '').replace(/^an? /, 'the ');
  /** Where a thing is had: "Big Lou, Low Tide Docks". */
  const whereOf = k => {
    const t = thing(k);
    const keeper = (cfg.people?.[t?.at] ?? []).find(p => p.id === t?.keeper) ?? Object.values(cfg.people ?? {}).flat().find(p => p.id === t?.keeper);
    return `${keeper?.name ? cap(keeper.name) : 'sold'}, ${cfg.places?.[t?.at]?.label ?? t?.at}`;
  };

  /** The words of a crew: "4 of them: 3 heavies, a runner". */
  const crewWords = due => `${due.n} of them: ${due.text ?? ''}`;

  /** THE WORD, the morning before: a notice. */
  function word(e) {
    const when = e.lead > 1 ? `on the night of day ${e.raidNight}` : 'tomorrow night';
    const count = Object.entries(e.count ?? {}).map(([n, k]) => (k > 1 ? `${k} ${n.replace(/^an? /, '').replace(/(man)$/, 'men').replace(/y$/, 'ie').replace(/([^n])$/, '$1s')}` : n)).join(', ');
    return {
      head: `The Sixes come ${when}`, day: e.day ?? S().state.day, until: e.raidNight, who: null, sixes: true, raid: true,
      text: `${e.n} of them: ${count}. ${cap(e.says)}. ${WEAK[e.crew] ?? ''} They saw ${money(e.stake?.total ?? 0)} worth at your place.`,
    };
  }

  // ── THE WORTH METER ────────────────────────────────────────────────────────────────────────────────────────────────
  function worthStat(v, stat) {
    const W = v.worth;
    if (!W) return null;
    const X6 = v.sixes;
    const due = v.raid?.due;
    // (shown once the Sixes care about you, or while a raid is due: before that it decides nothing)
    if (!due && !(X6 && X6.value > 0)) return null;
    const sub = due ? (due.tonight ? 'they come tonight' : 'they come tomorrow night') : W.crew ? `brings ${W.crew}` : '';
    return stat(`is-worth${S().worthOpen ? ' is-open' : ''}${due ? ' is-due' : ''}`, 'bank', 'Worth', money(W.total),
      h('span', { class: `u-stat-sub${due ? ' u-bad' : ''}` }, sub),
      { role: 'button', tabindex: '0', 'data-worth': String(W.total), title: `What your home is worth to the Sixes: ${W.text} (a press: what it counts)`, onclick: () => toggle('worth'), onkeydown: ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle('worth'); } } });
  }
  function paintWorth(node, v, open) {
    const W = v.worth;
    node.hidden = !(open && W);
    if (node.hidden) return fill(node);
    const sizes = ['a small crew', 'a bigger crew', 'their biggest crew'];
    const hidden = W.hidden ?? { cash: 0, goods: false, things: [] };
    fill(node,
      h('div', { class: 'rn-print-head' }, h('b', null, `Worth ${money(W.total)}`), h('button', { type: 'button', class: 'k-btn rn-print-x', 'aria-label': 'Fold it', onclick: () => toggle('worth', false) }, '×')),
      h('p', { class: 'rn-note' }, 'What the Sixes think your home is worth: everything kept there, hidden or not. It decides how many of them come. When they come is their meter: what you do on their ground.'),
      h('p', { class: 'rn-hp-h' }, 'What it counts'),
      h('ul', { class: 'rn-hp-list rn-worth-rows' }, W.entries.map(e => h('li', { 'data-row': e.id }, h('b', null, money(e.value)), ` ${cap(e.label)}`))),
      h('p', { class: 'rn-hp-h' }, 'Who it brings'),
      h('ul', { class: 'rn-hp-list' }, [0, ...W.steps].map((at, i) => h('li', { class: W.size === i ? 'is-reached' : '' }, h('b', { class: W.size === i ? 'is-up' : '' }, i ? `from ${money(at)}` : `under ${money(W.steps[0])}`), ` ${sizes[i]}${W.size === i ? ': now' : ''}`))),
      W.atRisk?.length ? h('p', { class: 'rn-hp-h' }, 'Things they can carry off') : null,
      W.atRisk?.length ? h('ul', { class: 'rn-hp-list' }, W.atRisk.map(x => h('li', null, h('b', { class: x.hidden ? 'is-down' : '' }, x.hidden ? 'hidden' : `${x.take}%`), ` ${cap(named(x.label))}${x.hidden ? ', behind the false wall' : ', if they get in'} (${money(x.worth)})`))) : null,
      hidden.cash || hidden.goods ? h('p', { class: 'rn-note' }, [hidden.cash ? `The first ${money(hidden.cash)} you bank is in the cereal box: never found.` : null, hidden.goods ? 'The goods at your crib are behind the false wall: never found.' : null].filter(Boolean).join(' ')) : null);
  }

  // ── THE ONE DECISION ──────────────────────────────────────────────────────────────────────────────────────────────
  /** The rules' odds for the card, each count sampled in the background (NaN until it is kept). */
  const cardOdds = () => odds.collect(() => raidOdds(cfg, S().state)).value;
  /** What they take if they beat you at your door, by the rules' own sums. */
  function stakesHome(state, hold) {
    const decoy = defVal(cfg, state, 'decoy') ?? 0;
    const share = Math.round((X.share * (100 - decoy)) / 100);
    const hid = hiddenOf(cfg, state, { held: thing(hold)?.gun ? hold : null });
    const taken = shareTaken(cfg, state, share);
    const stash = Object.fromEntries(Object.entries(state.stash ?? {}).map(([g, n]) => [g, Math.floor((n * X.stockPct) / 100)]).filter(([, n]) => n > 0));
    const things = thingsAtRisk(cfg, state).filter(x => x.item !== hold);
    const knock = thingsToKnock(cfg, state);
    return { share, decoy, taken, hid, stash: hid.goods ? {} : stash, things, knock };
  }
  function stakesOut(state) {
    const kick = defVal(cfg, state, 'kick', Math.min) ?? cfg.crew.kickPct;
    const share = defVal(cfg, state, 'crewShare', Math.min) ?? X.outShare;
    const g = guardOf(cfg, state);
    const beaten = g?.on ? chances(cfg, clamp(cfg.crew.strength - cfg.guard.strength, cfg.contest.min, cfg.contest.max)).clean : null;
    return { kick, share, taken: shareTaken(cfg, state, share), earl: g?.on ? { beaten } : null };
  }
  // (raidfight-5) THE CARD, TITLES FIRST (the owner: "can just be the title, then once you click it, it brings up the
  // info"; a friend who played: the interface "still lacks clarity"). Up front only what decides the night: who comes,
  // how many and what they are weak to; a button for each thing you could hold, with its odds; home or out, with the
  // odds each way; who stands with you. Everything else is kept, folded under a short title that a press (or Tab and
  // Enter) opens: what you lose if they beat you, what you win if you hold, what would help and where it is had. One way
  // of saying a chance on the whole card: "N in 10". A fold stays as it was left while the card is drawn again.
  const FOLDS = { lose: 'If they beat you', win: 'If you hold them', help: 'What would help, and where to get it' };
  const unfolded = new Set();
  /** A fold: its title, a button (aria-expanded), and what it holds under it, hidden until it is opened. */
  function fold(id, ...body) {
    const kids = body.flat(3).filter(k => k !== null && k !== undefined && k !== false);
    if (!kids.length) return null;
    const on = unfolded.has(id);
    const mark = h('i', { 'aria-hidden': 'true' }, on ? '▾' : '▸');
    const inner = h('div', { class: 'rn-fold-body', id: `rn-raid-fold-${id}`, hidden: !on }, ...kids);
    const head = h('button', { type: 'button', class: 'rn-fold-t', 'data-fold': id, 'aria-expanded': String(on), 'aria-controls': `rn-raid-fold-${id}`,
      onclick: ev => {
        ev.stopPropagation();
        const now = !unfolded.has(id);
        if (now) unfolded.add(id);
        else unfolded.delete(id);
        // (in place: the button keeps the focus, nothing else is drawn again)
        head.setAttribute('aria-expanded', String(now));
        mark.textContent = now ? '▾' : '▸';
        inner.hidden = !now;
      } }, mark, FOLDS[id]);
    return h('div', { class: `rn-fold rn-raid-fold is-${id}` }, head, inner);
  }
  function paintCard(node, v, open) {
    const R = v.raid;
    const due = R?.due;
    node.hidden = !(open && R);
    // (the card put away: it opens again with every fold shut)
    if (!S().raidOpen) unfolded.clear();
    if (node.hidden) return fill(node);
    const st = S();
    const state = st.hold?.state ?? st.state;
    const choosing = st.phase === 'choose' && !st.hold;
    const O = due ? cardOdds() : null;
    const head = due ? (due.tonight ? 'The Sixes come tonight' : `The Sixes come ${due.day === state.day + 1 ? 'tomorrow night' : `on the night of day ${due.day}`}`) : 'Your door';
    const kids = [h('div', { class: 'rn-print-head' }, h('b', null, head), kbd(RAID_KEY), h('button', { type: 'button', class: 'k-btn rn-print-x', 'aria-label': 'Fold it', onclick: () => toggle('raid', false) }, '×'))];
    // WHO COMES, HOW MANY, WHAT THEY ARE WEAK TO
    if (!due) {
      kids.push(h('p', { class: 'rn-note' }, R.truce ? `They leave you be through day ${R.truce.until}.` : `Nothing due. At ${R.raidAt} on their meter the Sixes come for your crib at night; your home is worth ${money(R.worth.total)} to them (${R.worth.crew ?? 'a small crew'}).`));
    } else {
      kids.push(h('p', { class: 'rn-raid-who' }, h('b', null, `${due.n} of them: ${O?.them?.text?.replace(/^\d+ of them: /, '') ?? ''}`), h('span', null, cap(due.says))),
        h('p', { class: 'rn-raid-weak' }, WEAK[due.crew] ?? ''));
    }
    // IN YOUR HANDS: a button for each thing you could hold, its odds on it
    const holds = R.holds ?? [];
    kids.push(h('p', { class: 'rn-hp-h' }, 'In your hands'));
    kids.push(h('div', { class: 'rn-raid-holds' }, holds.map(x => {
      // (with a gun of yours, what you hold is its own choice; without one it is what you fight with: the same thing)
      const cs = st.v?.choices ?? [];
      const c = cs.find(y => y.choice.do === 'holdWith' && y.choice.with === x.with) ?? cs.find(y => y.choice.do === 'fightWith' && y.choice.with === x.with) ?? null;
      const pct = O?.byHold?.[x.with];
      const can = choosing && !!c && (c.available || x.chosen);
      return h('button', { type: 'button', class: `k-btn rn-raid-hold${x.chosen ? ' is-on' : ''}`, 'data-hold': x.with, disabled: !can, 'aria-pressed': String(!!x.chosen),
        title: `${cap(holdLabel(cfg, x.with))}${x.gun ? ` (${x.rounds} rounds)` : ''}${due ? `: you hold them about ${in10(pct)}` : ''}`,
        onclick: ev => { ev.stopPropagation(); if (c?.available) fromPanel(c.key, true); } },
      h('b', null, cap(holdLabel(cfg, x.with).replace(/^an? /, ''))), h('span', null, x.gun ? `${x.rounds} rounds` : 'no gun'), due ? h('em', { class: 'rn-raid-odds' }, in10(pct)) : null);
    })));
    // (the guns to buy and the rounds to get: under "What would help")
    const dry = (R.guns ?? []).filter(g => g.owned && !g.rounds);
    const notYours = (R.guns ?? []).filter(g => !g.owned);
    const shop = [
      dry.length ? h('p', { class: 'rn-note' }, `No rounds: ${dry.map(g => `${named(g.label)} (${g.box.label}, ${money(g.box.price)}: ${whereOf(g.item)})`).join('; ')}.`) : null,
      notYours.length ? h('ul', { class: 'rn-hp-list rn-raid-shop' }, notYours.map(g => h('li', { 'data-gun': g.item }, h('b', null, money(g.price)), ` ${cap(named(g.label))}: ${g.does.replace(/^./, s => s.toLowerCase())}. ${whereOf(g.item)}.`))) : null,
    ];
    if (!due) {
      kids.push(fold('help', shop));
      return fill(node, ...kids);
    }
    // HOME OR OUT, each with its odds
    const H = stakesHome(state, R.hold);
    const out = stakesOut(state);
    const sleep = st.v?.choices?.find(y => y.choice.do === 'sleep');
    kids.push(h('p', { class: 'rn-hp-h' }, 'Home or out'),
      h('ul', { class: 'rn-hp-list rn-raid-where' },
        h('li', { 'data-where': 'home' }, h('b', null, in10(O?.pct)), ` Home: you hold them. ${due.tonight && st.v?.place === 'crib' && sleep?.available ? 'Sleep here (Z).' : 'Sleep at your crib.'}`),
        h('li', { 'data-where': 'out' }, h('b', null, in10(100 - out.kick)), ' Out: your door holds. Sleep anywhere else.')));
    // WHO STANDS WITH YOU
    kids.push(h('p', { class: 'rn-hp-h' }, 'Who stands with you'));
    const earl = st.v?.earl;
    const g = guardOf(cfg, state);
    const told = !!(O?.earl && O.byWay);
    if (told) {
      kids.push(h('div', { class: 'rn-earl-ways' }, h('b', null, 'Cousin Earl, told:'), ...(earl?.ways ?? []).map(w => {
        const c = st.v?.choices?.find(y => y.choice.do === 'earlWay' && y.choice.way === w.way);
        return h('button', { type: 'button', class: `k-btn rn-earlway${w.chosen ? ' is-on' : ''}`, 'data-way': w.way, disabled: !(choosing && c?.available), title: `${w.word}: ${w.says}`,
          onclick: ev => { ev.stopPropagation(); if (c?.available) fromPanel(c.key, true); } }, `${w.word} · ${in10(O.byWay[w.way])}`);
      })));
    } else {
      const hire = st.v?.choices?.find(y => y.choice.do === 'guard');
      kids.push(h('p', { class: 'rn-raid-alone' }, h('b', null, 'Alone.'), O?.withEarl != null ? ` With Cousin Earl beside you: ${in10(O.withEarl)}.` : ''),
        hire?.available && choosing ? h('button', { type: 'button', class: 'k-btn rn-raid-hire', title: g ? `Cousin Earl stands with you: ${money(g.price)} for ${g.days} days, hired at your crib` : null, onclick: ev => { ev.stopPropagation(); fromPanel(hire.key, true); } }, `Hire Earl · ${money(g?.price ?? 0)}`) : null);
    }
    // THE FOLDS: what you lose, what you win, what would help and where it is had
    const gun = thing(R.hold)?.gun ? R.hold : null;
    const lose = [
      'you wake in the clinic',
      `${money(H.taken)} of the ${money(state.banked)} you have banked${H.hid.cash ? ` (the cereal box keeps ${money(Math.min(H.hid.cash, state.banked))})` : ''}${H.decoy ? ' (the decoy safe: half what they would take)' : ''}`,
      Object.keys(H.stash).length ? `${goodsText(cfg, H.stash)} of the goods at your crib` : null,
      gun ? `${named(thing(gun).label)} in your hands, and its rounds` : null,
      ...H.things.filter(x => !H.hid.things.includes(x.item)).map(x => `${named(x.label)}: ${in10(x.take)} they take it`),
      ...H.knock.map(x => `${named(x.label)}: ${in10(x.pct)} it is smashed, no use for ${x.out} day${x.out > 1 ? 's' : ''}`),
    ].filter(Boolean);
    const help = Object.entries(O?.withPiece ?? {});
    kids.push(
      fold('lose',
        h('p', { class: 'rn-fold-h' }, 'At home'),
        h('ul', { class: 'rn-hp-list rn-raid-lose' }, lose.map(t => h('li', null, cap(t)))),
        h('p', { class: 'rn-fold-h' }, 'Out, and they get in'),
        h('p', { class: 'rn-raid-out' }, `They take ${money(out.taken)} and half the goods at your crib.${out.earl ? ` Cousin Earl is on your step first: they beat him ${in10(out.earl.beaten)}.` : ''}`)),
      fold('win', h('p', { class: 'rn-raid-win' }, `Their pockets: $${X.spoils[0]} to $${X.spoils[1]} for each one you put down. And ${X.truce} days of truce: no tax, nobody on the kerb, no raid.`)),
      fold('help',
        help.length ? h('ul', { class: 'rn-hp-list rn-raid-help' }, help.map(([k, p]) => h('li', { 'data-piece': k }, h('b', null, in10(p)), ` with ${named(thing(k).label)}: ${thing(k).does.replace(/^./, c => c.toLowerCase())}. ${money(thing(k).price)}, ${whereOf(k)}.`))) : null,
        shop,
        !told && g ? h('p', { class: 'rn-note' }, g.why ? cap(g.why) : `Cousin Earl: ${money(g.price)} for ${g.days} days, hired at your crib.`) : null));
    fill(node, ...kids);
  }

  // ── THE NIGHT, AS A CARD ──────────────────────────────────────────────────────────────────────────────────────────
  /** Each consequence in plain words, the money, the stock, the gun, the things, the truce: [{ text, bad, id }]. */
  function lines(e, state) {
    const out = [];
    const D = e.duel;
    const won = e.outcome === 'held' || e.outcome === 'hurt';
    if (D) out.push({ id: 'fight', text: `${won ? 'You held them' : 'They beat you'} at your door with ${D.you.label}${D.spent ? `: ${D.spent} round${D.spent > 1 ? 's' : ''} fired` : ''}.`, bad: !won });
    if (e.guard) out.push({ id: 'earl', text: e.guard.beaten ? `Cousin Earl went down: off ${e.guard.hurtDays} day${e.guard.hurtDays > 1 ? 's' : ''}.` : e.how === 'guard' ? 'Cousin Earl was on your step and saw them off.' : 'Cousin Earl stood with you.', bad: !!e.guard.beaten });
    if (e.spoils) out.push({ id: 'spoils', text: `Their pockets: ${money(e.spoils)}, banked. Banked now ${money(state.banked)}.` });
    if (e.truce) out.push({ id: 'truce', text: `They leave you be through day ${e.truce}: no tax, nobody on the kerb, no raid.` });
    if (e.energyLost) out.push({ id: 'energy', text: `Energy −${e.energyLost} this morning${e.outcome === 'hurt' ? ': held, but hurt' : ''}.`, bad: e.outcome === 'hurt' });
    if (e.home && !won) out.push({ id: 'clinic', text: 'Knocked out: you wake in the clinic.', bad: true });
    if (!e.home) out.push({ id: 'away', text: e.how === 'guard' ? 'You were out.' : e.gotIn ? 'You were out: they kicked your door in.' : 'You were out: they kicked at your door and it held.', bad: e.gotIn });
    if (e.taken) out.push({ id: 'bank', text: `${money(e.taken)} of the ${money(e.banked)} you had banked: gone. Banked now ${money(e.bankedAfter)}.`, bad: true });
    if (Object.keys(e.goodsTaken ?? {}).length) out.push({ id: 'stock', text: `${cap(goodsText(cfg, e.goodsTaken))} taken from your crib.`, bad: true });
    if (e.lostGun) out.push({ id: 'gun', text: `${cap(named(e.lostGun.label))} in your hands: gone, with its ${e.lostGun.rounds} rounds.`, bad: true });
    for (const x of e.thingsTaken ?? []) out.push({ id: `took:${x.item}`, text: `${cap(named(x.label))}: taken.`, bad: true });
    for (const x of e.thingsOut ?? []) out.push({ id: `out:${x.item}`, text: `${cap(named(x.label))}: smashed, no use until day ${x.until + 1}.`, bad: true });
    const kept = [e.hidden?.cash && e.gotIn ? `the cash in the cereal box` : null, e.hidden?.goods && e.gotIn ? 'the goods behind the false wall' : null, ...(e.gotIn ? (e.hidden?.things ?? []).map(k => `${named(thing(k)?.label)} behind the false wall`) : [])].filter(Boolean);
    if (kept.length) out.push({ id: 'hidden', text: `They never found ${kept.join(' or ')}.` });
    if (e.gotIn && !e.taken && !e.lostGun && !(e.thingsTaken ?? []).length && !Object.keys(e.goodsTaken ?? {}).length) out.push({ id: 'nothing', text: 'They found nothing worth taking.' });
    if (e.heat) out.push({ id: 'heat', text: `The shots carried: heat +${e.heat}.`, bad: true });
    out.push({ id: 'meter', text: `The Sixes ${e.value} of ${e.max}.` });
    return out;
  }
  function resultEl(e, state, onGo) {
    const won = e.outcome === 'held' || e.outcome === 'hurt';
    const title = e.home ? (won ? (e.outcome === 'hurt' ? 'You held the door, only just' : 'You held the door') : 'They beat you at your door')
      : e.how === 'guard' ? 'Earl saw them off' : e.gotIn ? 'They got in while you were out' : 'Your door held';
    return h('div', { class: 'hk-screen' }, h('div', { class: `hk-plate rn-report rn-home-card rn-raid-card is-${won || (!e.home && !e.gotIn) ? 'held' : 'lost'}` },
      h('header', null, h('span', { class: 'hk-kicker' }, `The night of day ${e.day}: the Sixes, ${e.n} of them`),
        h('h1', null, title),
        h('ul', { class: 'rn-raid-lines' }, lines(e, state).map(l => h('li', { class: `rn-night${l.bad ? ' is-bad' : ' is-door'}`, 'data-line': l.id }, l.text)))),
      h('div', { class: 'hk-night-foot' }, h('button', { class: 'k-btn is-primary hk-go', onclick: () => onGo?.() }, 'Go on', kbd('Enter')))));
  }

  /**
   * HOW THE NIGHT'S FIGHT IS SHOWN: the fight page's raid scene (demo/run/raidfight.js) plays every loadout, a gun or
   * bare hands, Earl or not, and every crew. 'none' when you were out (no fight).
   */
  function staging(D) {
    return D ? { kind: 'scene', why: null } : { kind: 'none', why: 'no fight: you were out' };
  }

  return { weak: crew => WEAK[crew] ?? '', word, worthStat, paintWorth, paintCard, resultEl, lines, staging, crewWords };
}
