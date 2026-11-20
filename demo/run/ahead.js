// WHAT'S AHEAD (tree-1; U, or Ahead on the rail): every way to fight, every piece of gear, every piece for the home and
// every place, as four trees side by side, from the rules' own data (src/run/ahead.mjs, view.ahead). THE TREES ARE NAMES
// (the owner, 11-18: "the tree doesn't need all the info, can just be the title, then once you click it, it brings up the
// info on what that button means"): each node is its name and nothing else in words, and how it looks says where you
// stand with it: yours (the yellow down its side, and a tick), within reach today (an ink outline; a lime dot when it
// can be had where you stand), something first (dashed and grey; a lock when its place is locked), one of the goal's
// three (a star). Above them one line: your money and the next thing within reach (pressed: its card).
// A CLICK (or Enter from the keys: the arrows walk the trees) BRINGS UP ITS CARD over the trees, on the side away from
// it: all it does in the game's numbers, its price and what is still to go, who fights each way and what you win against
// them with it, what it opens, where and from whom it is had and on what condition, and what can be done from there: buy
// or learn it when that is open where you stand (the rules' own move), see it in the Library, find its place on the Map,
// go to its place's card. Esc or its × puts the card away; Esc again closes the panel. Nothing is worked out here: every
// word and number is the rules' (ahead.mjs), but the fight's numbers, which it asks for while the panel is open and the
// game is idle (aheadCell: a few hundred simulated fights each, the fight cards' own sample). (smooth-1: those fights
// are played in the page's odds workers, odds.js `bg`; a number shows when its count is kept, "…" until then. Without
// `bg`, here, in slices, as before)
//
//   const ahead = createAhead({ cfg, tiles, now, act, root, kept, bg })
//     now()  → { v, state, choosing, keyFor(choiceKey) → the dock's key }
//     act    { go(choiceKey), library(pieceKey), map(placeId), toast(text) }
//     root() → the sheet's scrolling box
//   ahead.head · ahead.lead · ahead.body · ahead.card   the parts, placed by the page
//   ahead.paint() · ahead.select(id) · ahead.focus() · ahead.arrow(key) · ahead.owns(el) · ahead.stop()
//   ahead.closeCard() (Esc: true when the card was up) · ahead.cardOpen · ahead.selected · ahead.data · ahead.oddsLeft
import { h, fill } from '../hud/dom.js';
import { icon } from './icons.js';
import { aheadOf, aheadCells, aheadCell } from '../../src/run/ahead.mjs';

const money = n => `$${n}`;
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const in10 = p => (p === null || p === undefined ? '…' : String(Math.round(p / 10)));
const BRANCH_ICON = { fight: 'fight', gear: 'goods', home: 'home', places: 'map', make: 'pot' };
const KIND_ICON = { arm: 'fight', style: 'fight', shop: 'star', good: 'goods', guard: 'person', place: 'map', route: 'walk', thing: 'home', making: 'goods', bag: 'bag', product: 'pot' };

// ── MAKE (pot-2): the fifth tree, the crafting plan's (B10, "In what's ahead: a fifth tree, Make. Names only"), from the
// rules' view of the pot (view.make, view.pot) and its moves: the kitchen and its tools (the hot plate, taken off Gear,
// and the box fan), what goes in (who sells it, where), what it goes into (bags), and what you have found (each thing a
// set of makings makes, by its name: the player's own when he named it). The same three states as every node. Nothing
// worked out here but which state: every word and number is the rules'.
const STATE_OF = ({ owned = false, price = 0, have = 0, why = null, here = false }) => (owned ? { state: 'owned', here: false, toGo: 0, why: null }
  : why ? { state: 'later', here: false, toGo: 0, why } : Math.max(0, (price ?? 0) - have) ? { state: 'later', here: false, toGo: Math.max(0, price - have), why: null } : { state: 'now', here: !!here, toGo: 0, why: null });
const choiceFor = (v, test) => {
  const c = (v.choices ?? []).find(x => test(x.choice ?? {}));
  return c ? { key: c.key, available: !!c.available, why: c.why ?? null, label: c.label, choice: { ...c.choice } } : null;
};
const nameOf = s => cap(String(s ?? '').replace(/^(a pair of|an?|the) /i, ''));
/** Where a thing of the pot is had: { place, placeLabel, who, at, pays, text, payText } (as the rules' Ahead says it). */
function madeWhere(cfg, place, keeper, verb = 'sells it') {
  const P = cfg.places[place] ?? {};
  const p = (P.people ?? []).find(x => x.id === (keeper?.id ?? keeper)) ?? null;
  return { place, placeLabel: P.label ?? place, who: p ? { id: p.id, name: p.name } : null, at: null, pays: 'carried',
    text: `${p ? `${cap(p.name)} ${verb}` : cap(verb)}, ${P.where ?? `at ${P.label ?? place}`}.`, payText: 'from what you carry, no hour' };
}
export function makeBranch(cfg, v, D, have) {
  const M = v?.make;
  const P = v?.pot;
  if (!M || !P) return null;
  const X = cfg.make;
  const add = n => {
    Object.assign(n, STATE_OF({ owned: n.owned, price: n.price, have, why: n.why, here: !!n.choice?.available }));
    n.stateText = n.state === 'owned' ? n.ownedText ?? 'yours' : n.why ?? (n.toGo ? `$${n.toGo} to go` : n.here ? 'here, now' : n.where ? n.where.text.replace(/\.$/, '') : 'within reach');
    D.nodes[n.id] = n;
    return n.id;
  };
  const kitchen = M.makers.find(m => m.id === P.maker) ?? M.makers[0];
  const shelf = kitchen.shelf;
  // THE KITCHEN: its station (the rules' own node of it, moved here from Gear) and the box fan (the smell one lower)
  const tools = [];
  const st = kitchen.station;
  const plate = D.nodes[`thing:${st?.item}`];
  if (plate) {
    for (const b of D.branches) for (const g of b.groups) g.nodes = g.nodes.filter(id => id !== plate.id);
    plate.branch = 'make';
    if (plate.state === 'owned' && st.out) plate.ownedText = `yours · smashed until day ${st.out + 1}`;
    tools.push(plate.id);
  }
  const fanItem = Object.keys(cfg.things ?? {}).find(k => cfg.things[k].smellOff);
  if (fanItem) {
    const t = cfg.things[fanItem];
    const smell = M.smell;
    tools.push(add({ id: `thing:${fanItem}`, branch: 'make', kind: 'thing', key: fanItem, name: nameOf(t.label), price: t.price, priceText: `$${t.price}`, parent: null, owned: !!v.things?.owned?.some?.(o => o.item === fanItem) || !!D.owns?.[fanItem],
      short: 'the smell of your cooking one lower', does: `${t.job}.`, facts: [smell?.text ? `${smell.text}.` : 'Nothing cooked lately: no smell on HOME.', 'Stands in the trailer\'s window. Kept for the run.'], opens: [],
      where: madeWhere(cfg, t.at, t.keeper), needs: [], choice: choiceFor(v, c => c.do === 'get' && c.item === fanItem), piece: t.piece ?? null, library: t.piece ? fanItem : null }));
  }
  // WHAT GOES IN: each making, who sells it and where; yours while you have some (on you or at home)
  const ins = shelf.makings.map(m => {
    const E = X.effects[m.effect];
    const n = m.on + m.home;
    return add({ id: `making:${m.item}`, branch: 'make', kind: 'making', key: m.item, name: cap(m.label), price: m.price, priceText: `$${m.price} a ${m.unit}`, parent: null, owned: n > 0, ownedText: `${m.on} on you · ${m.home} at home`,
      short: `${cap(E.words)}, ${E.hours} hours`, does: `${cap(m.pack)}: one goes in the pot. Whoever takes what it makes: ${E.words}, ${E.hours} hours.`, facts: [`${cap(m.label)} on its own makes ${P.options.find(o => o.with.length === 1 && o.with[0] === m.item)?.name ?? Object.values(X.products).find(p => p.from.length === 1 && p.from[0] === m.item)?.name ?? 'something'}.`, 'Bought onto you; it goes home when you go in. On you it is at risk like any goods.'],
      opens: [], where: madeWhere(cfg, m.at, m.keeper), needs: [], colour: m.colour, piece: m.piece ?? null, choice: choiceFor(v, c => c.do === 'making' && c.item === m.item) });
  });
  // WHAT IT GOES INTO: the pot gives bags (each sold as a good, one on your belt)
  const C = P.carrier;
  const bags = shelf.made.reduce((a, r) => a + r.on + r.home, 0);
  const into = C ? [add({ id: `bag:${C.gives}`, branch: 'make', kind: 'bag', key: C.gives, name: cap(`${X.kinds?.[C.gives]?.unit ?? C.gives}s`), price: null, priceText: '', parent: null, owned: bags > 0, ownedText: `${bags} now`,
    why: bags ? null : st?.owned ? 'cook first' : 'a hot plate first',
    short: `${C.n} come out of a cook, ${C.hours === 1 ? 'an hour' : `${C.hours} hours`}`, does: `${C.n} bags come out of the pot every cook, at home. Each sells as goods do: Shaky Dee at the bus stop, the crowd at the market. One can ride on your belt, never sold.`,
    facts: [`What is at home counts in what your home is worth.`], opens: [], where: null, needs: [] })] : [];
  // FOUND: what each set makes, by the name it goes by (yours, once named); not found yet, how to find it
  const book = kitchen.book;
  const found = Object.entries(X.products).map(([id, p]) => {
    const f = book.found.find(x => x.product === id);
    const withWords = p.from.map(k => X.makings[k].label).join(' and ');
    const opt = P.options.find(o => o.product === id);
    return add({ id: `product:${id}`, branch: 'make', kind: 'product', key: id, name: f?.name ?? p.name, price: null, priceText: '', parent: null, owned: !!f, ownedText: f ? `found day ${f.day}` : 'yours',
      why: f ? null : `not cooked yet: ${withWords}`,
      short: (f?.lines ?? opt?.lines ?? []).join(', ').toLowerCase() || withWords, does: `${withWords.replace(/^./, c => c.toUpperCase())} in the pot.${f?.canName ? ' Yours to name.' : ''}`, facts: (f?.lines ?? opt?.lines ?? []).map((l, i) => `${i + 1}. ${l}`), opens: [], where: null, needs: [] });
  });
  const groups = [
    { id: 'kitchen', label: 'The kitchen', note: 'Where you cook, and what keeps the smell down.', nodes: tools },
    { id: 'in', label: 'What goes in', note: 'Sold on your own street, from what you carry.', nodes: ins },
    { id: 'into', label: 'What comes out', note: 'Six bags a cook.', nodes: into },
    { id: 'found', label: 'Found', note: `${book.found.length} of ${Object.keys(X.products).length} found. ${book.text}.`, nodes: found },
  ].filter(g => g.nodes.length);
  const all = groups.flatMap(g => g.nodes).map(id => D.nodes[id]);
  const counted = all.filter(n => n.kind === 'thing' || n.kind === 'product');
  return { id: 'make', label: 'Make', icon: 'pot', note: 'Cook it, sell it, watch what it does (P: the pot).', groups, count: { owned: counted.filter(n => n.state === 'owned').length, of: counted.length, word: 'yours' } };
}

export function createAhead({ cfg, tiles, now, act, root, kept = null, bg = null }) {
  const odds = {};
  let picked = null;
  // (the card is up only once something is picked, by a click or Enter; Esc or its × puts it away)
  let cardOpen = false;
  let data = null;
  let sig = null;
  let cardSig = null;
  let timer = null;
  let open = false;
  const byId = new Map();

  const head = h('div', { class: 'u-ah-head' });
  const lead = h('div', { class: 'u-ah-lead' });
  const body = h('div', { class: 'u-ah-tree', role: 'tree', 'aria-label': 'What there is to get' });
  const card = h('section', { class: 'u-ah-card', 'aria-label': 'The thing', 'aria-live': 'polite', hidden: true });
  // (a click on the trees' open paper, off any node, puts the card away)
  body.addEventListener('click', e => {
    if (!e.target.closest('.u-ah-node, .u-ah-glabel')) closeCard();
  });

  // ── THE FIGHT'S NUMBERS: one at a time, while open and idle ─────────────────────────────────────────────────────────
  function missing(state) {
    return aheadCells(cfg, state).filter(c => !(c.key in odds));
  }
  function tick() {
    timer = null;
    if (!open) return;
    const n = now();
    if (!n.choosing) return void (timer = setTimeout(tick, 400));
    const left = missing(n.state);
    if (!left.length) return;
    // (smooth-1: each number whose fights are kept is read at once; the rest are asked of the odds workers, and this
    // ticks again when they are kept: odds.js, the page's oddsKept → kick)
    if (bg) {
      let got = 0;
      const waiting = [];
      for (const c of left) {
        const r = bg.collect(() => aheadCell(cfg, n.state, c.arm, c.style));
        if (r.missing.length) waiting.push(...r.missing);
        else {
          odds[c.key] = r.value;
          got += 1;
        }
      }
      if (got) {
        sig = null;
        paint();
      }
      if (waiting.length) bg.whenKept(waiting).then(kick);
      return;
    }
    // (a branch's worth at a time, then drawn: a few hundred fights a number, about 50 ms each)
    const t0 = performance.now();
    for (const c of left) {
      odds[c.key] = aheadCell(cfg, n.state, c.arm, c.style);
      if (performance.now() - t0 > 60) break;
    }
    sig = null;
    paint();
    timer = setTimeout(tick, 40);
  }
  const kick = () => {
    if (!timer && open) timer = setTimeout(tick, 120);
  };

  // ── THE TREES ──────────────────────────────────────────────────────────────────────────────────────────────────────
  function pic(n, size = 56) {
    if (n.piece && tiles) return tiles.el(n.piece, { size, root: null, label: n.name });
    return h('span', { class: 'u-ah-ico' }, icon(KIND_ICON[n.kind] ?? 'star'));
  }
  /** The state in words, for the card's pill and a node's tooltip (never written on the node itself). */
  function pill(n, keyFor) {
    if (n.state === 'owned') return h('span', { class: 'u-ah-pill is-owned' }, icon('check'), n.ownedText ?? 'yours');
    if (n.here) {
      const k = n.choice?.key ? keyFor?.(n.choice.key) : null;
      return h('span', { class: 'u-ah-pill is-here' }, n.kind === 'place' ? 'you are here' : 'here now', k ? h('kbd', { class: 'u-key' }, k) : null);
    }
    if (n.state === 'now') return h('span', { class: 'u-ah-pill is-now' }, n.kind === 'place' || n.kind === 'route' ? n.stateText : 'within reach');
    if (n.toGo) return h('span', { class: 'u-ah-pill is-later' }, `${money(n.toGo)} to go`);
    return h('span', { class: 'u-ah-pill is-later is-why', title: n.why ?? '' }, icon('lock'), /^locked/.test(n.why ?? '') ? 'locked' : 'not now');
  }
  /** A node's one small mark, if any: yours (a tick), here now (a lime dot), the place you are at (you), locked (a lock), one of the goal's three (a star). */
  function markOf(n) {
    if (n.state === 'owned') return h('span', { class: 'u-ah-mark is-owned', 'aria-hidden': 'true' }, icon('check'));
    if (n.here && n.kind === 'place') return h('span', { class: 'u-ah-mark is-you', 'aria-hidden': 'true' }, icon('person'));
    if (n.here) return h('span', { class: 'u-ah-mark is-here', 'aria-hidden': 'true' });
    if (/^locked/.test(n.why ?? '')) return h('span', { class: 'u-ah-mark is-locked', 'aria-hidden': 'true' }, icon('lock'));
    if (n.goal) return h('span', { class: 'u-ah-mark is-goal', 'aria-hidden': 'true' }, icon('star'));
    return null;
  }
  // A NODE IS ITS NAME (the owner, 11-18: "the tree doesn't need all the info, can just be the title, then once you click
  // it, it brings up the info"): its state is how it looks (yours: the yellow down its side; within reach: a solid
  // outline; something first: dashed and grey) and at most one small mark. Everything it says is on its card.
  function nodeEl(n) {
    const cls = `u-ah-node is-${n.state}${n.here ? ' is-here' : ''}${n.id === picked ? ' is-picked' : ''}`;
    const said = n.state === 'owned' ? (n.ownedText ?? 'yours') : n.toGo ? `${money(n.toGo)} to go` : n.why ?? (n.here ? 'here now' : n.stateText);
    const b = h('button', {
      type: 'button', class: cls, 'data-node': n.id, role: 'treeitem', 'aria-selected': String(n.id === picked), 'aria-label': `${n.name}: ${said}`, title: `${n.name}: ${said}`,
      // (a click brings its card up; Enter from the keys, a click with no pointer, too, and on into the card's buttons)
      onclick: e => {
        select(n.id, { card: true });
        if (e.detail === 0) card.querySelector('.u-ah-acts button:not([disabled]), .u-ah-x')?.focus();
      },
      onfocus: () => select(n.id, { scroll: false }),
    }, h('span', { class: 'u-ah-name' }, n.name), markOf(n));
    byId.set(n.id, b);
    return b;
  }
  function branchEl(b, D) {
    const kids = b.groups.map(g => {
      const nodes = g.nodes.map(id => D.nodes[id]);
      // (a group with a name is the node its pieces hang off; else the branch's own root, the node with no parent)
      const items = nodes.map(n => h('li', { class: `u-ah-li${g.label || n.parent ? ' is-child' : ' is-root'}` }, nodeEl(n)));
      return h('div', { class: 'u-ah-group', 'data-group': g.id },
        g.label ? h('button', { type: 'button', class: `u-ah-glabel${picked === `group:${b.id}:${g.id}` ? ' is-picked' : ''}`, 'data-group': `group:${b.id}:${g.id}`, title: g.note ?? g.label,
          onclick: () => select(`group:${b.id}:${g.id}`, { card: true }) }, g.label) : null,
        h('ul', { class: 'u-ah-list', role: 'group' }, items));
    });
    return h('section', { class: `u-ah-branch is-${b.id}`, 'data-branch': b.id, 'aria-label': b.label },
      h('header', { class: 'u-ah-bhead', title: `${b.note ?? ''} ${b.count.owned} of ${b.count.of} ${b.count.word}.`.trim() }, icon(BRANCH_ICON[b.id] ?? 'star'), h('b', null, b.label),
        h('span', { class: 'u-ah-count' }, `${b.count.owned}/${b.count.of}`)),
      kids,
      b.quiet ? h('p', { class: 'u-ah-quiet' }, b.quiet) : null);
  }

  // ── THE CARD ───────────────────────────────────────────────────────────────────────────────────────────────────────
  function linkBtn(label, ico, onclick, title = label, extra = {}) {
    return h('button', { type: 'button', class: 'u-btn is-quiet u-ah-link', title, onclick, ...extra }, ico ? icon(ico) : null, label);
  }
  function nodeChip(D, id) {
    const n = D.nodes[id];
    if (!n) return null;
    return h('button', { type: 'button', class: `u-chip u-ah-chip is-${n.state}`, 'data-go': id, title: `${n.name}: ${n.short}`, onclick: () => select(id, { focus: true, card: true }) },
      n.state === 'owned' ? icon('check') : null, n.name);
  }
  function vsTable(n) {
    if (!n.vs?.length) return null;
    const hands = n.key === 'hands';
    // (the two it helps most against, in bold: the line above the table names them)
    return h('table', { class: 'u-ah-vs' },
      h('thead', null, h('tr', null, h('th', null, 'Against'), h('th', null, 'Bare hands'), hands ? null : h('th', null, n.name))),
      h('tbody', null, n.vs.map(x => {
        const d = x.pct !== null && x.hands !== null ? Math.round(x.pct / 10) - Math.round(x.hands / 10) : 0;
        const who = x.who.filter(w => w.place).map(w => w.name);
        return h('tr', { class: x.best ? 'is-best' : '' },
          h('td', { class: 'is-who', title: `${cap(x.name)}: ${x.says}${x.who.length ? `. Who fights you this way: ${x.who.map(w => w.name).join(', ')}` : ''}` }, h('b', null, cap(x.name)), who.length ? h('small', null, ` · ${who.join(', ')}`) : null),
          h('td', { class: 'is-num' }, `${in10(x.hands)} in 10`),
          hands ? null : h('td', { class: `is-num${d >= 2 ? ' is-up' : d <= -1 ? ' is-down' : ''}` }, `${in10(x.pct)} in 10`));
      })));
  }
  function actBtn(n, D, n0) {
    const c = n.choice;
    if (n.fightWith && n.state === 'owned') {
      const fw = n.fightWith;
      if (fw.chosen) return h('span', { class: 'u-pill is-you' }, 'you fight with it');
      if (fw.choice) return h('button', { type: 'button', class: `u-btn${fw.choice.available && n0.choosing ? ' is-go' : ''}`, 'data-act': 'fightWith', disabled: !(fw.choice.available && n0.choosing) || null,
        onclick: () => act.go(fw.choice.key), title: 'No hour: what you fight with, one-on-one and jumped' }, `Fight with it`, h('kbd', { class: 'u-key' }, 'E'));
    }
    if (!c || n.state === 'owned') return null;
    const can = c.available && n0.choosing;
    const verb = c.choice.do === 'learn' ? 'Learn it' : c.choice.do === 'guard' ? 'Hire him' : 'Buy it';
    const k = n0.keyFor?.(c.key);
    return h('button', {
      type: 'button', class: `u-btn u-ah-do${can ? ' is-go' : ' is-no'}`, 'data-act': c.choice.do, 'aria-disabled': can ? null : 'true',
      title: can ? `${c.label}` : `${c.label}: ${c.why ?? 'not now'}`, onclick: () => (can ? act.go(c.key) : act.toast(cap(c.why ?? 'not now'))),
    }, h('span', { class: 'u-ah-do-t' }, h('b', null, `${verb} · ${n.priceText}`), can ? null : h('small', null, c.why ?? 'not now')), can && k ? h('kbd', { class: 'u-key' }, k) : null);
  }
  function paintCard(D, n0) {
    const grp = groupOf(picked);
    if (grp) {
      const s = JSON.stringify(['group', picked, grp.g.nodes.map(id => D.nodes[id].state)]);
      if (s === cardSig) return;
      cardSig = s;
      fill(card,
        h('div', { class: 'u-ah-card-pic' }, h('span', { class: 'u-ah-ico' }, icon(grp.b.id === 'home' ? 'homerisk' : BRANCH_ICON[grp.b.id] ?? 'star'))),
        h('div', { class: 'u-ah-card-body' },
          h('div', { class: 'u-ah-card-head' }, h('b', { class: 'u-ah-card-name' }, grp.g.label), grp.g.short ? h('span', { class: 'u-pill' }, grp.g.short) : null, closeX()),
          grp.g.note ? h('p', { class: 'u-ah-does is-wide' }, grp.g.note) : null,
          h('div', { class: 'u-ah-chips is-wide' }, grp.g.nodes.map(id => nodeChip(D, id)))));
      return placeCard();
    }
    const n = D.nodes[picked] ?? D.nodes[D.next?.id] ?? D.nodes[D.order[0]];
    const s = JSON.stringify([n, n0.choosing, n0.keyFor && n.choice ? n0.keyFor(n.choice.key) : null]);
    if (s === cardSig) return placeCard();
    cardSig = s;
    if (!n) return fill(card);
    const place = n.where?.place ? (cfg.places[n.where.place]?.home ? D.nodes[`place:${cfg.places[n.where.place].inside}`] : D.nodes[`place:${n.where.place}`]) : null;
    const opens = n.opens?.length ? h('div', { class: 'u-ah-sec' }, h('h4', null, 'Opens'), h('ul', { class: 'u-ah-ul' }, n.opens.map(o => h('li', null, o.text)))) : null;
    const jobs = n.jobs?.length ? h('div', { class: 'u-ah-sec' }, h('h4', null, 'Work here'), h('ul', { class: 'u-ah-ul' }, n.jobs.map(j => h('li', null,
      `${j.label}: ${j.odds}% for ${j.pay[0] === j.pay[1] ? money(j.pay[0]) : `$${j.pay[0]}–${j.pay[1]}`}${j.needs ? ` (needs ${cfg.shop?.[j.needs]?.label?.toLowerCase() ?? j.needs})` : ''}${j.goods ? ' (with goods on you)' : ''}${j.fight ? ' (a fight if it goes wrong)' : ''}`)))) : null;
    const cards = n.cards?.length ? h('div', { class: 'u-ah-sec' }, h('h4', null, 'Cards on the way'), h('ul', { class: 'u-ah-ul' }, n.cards.map(c => h('li', null,
      `${c.label}${c.odds !== null && c.pay ? `: ${c.odds}% for ${c.pay[0] === c.pay[1] ? money(c.pay[0]) : `$${c.pay[0]}–${c.pay[1]}`}` : ''}${c.heat < 0 ? ` (heat ${c.heat})` : ''}`)))) : null;
    const got = n.got?.length ? h('div', { class: 'u-ah-sec' }, h('h4', null, 'Only had here'), h('div', { class: 'u-ah-chips' }, n.got.map(id => nodeChip(D, id)))) : null;
    const needs = (n.needs ?? []).filter(id => D.nodes[id] && D.nodes[id].kind !== 'place');
    const facts = (n.facts ?? []).length ? h('ul', { class: 'u-ah-facts' }, n.facts.map(f => h('li', null, f))) : null;
    const acts = h('div', { class: 'u-ah-acts' },
      actBtn(n, D, n0),
      n.library ? linkBtn('In the Library', 'library', () => act.library(n.library), `${n.name} in the Library: its picture, where it is sold`, { 'data-link': 'library' }) : null,
      n.map ? linkBtn('On the map', 'map', () => act.map(n.map), `${n.name} on the map`, { 'data-link': 'map' }) : null,
      place && place.id !== n.id ? linkBtn(`${place.name}`, 'map', () => select(place.id, { focus: true, card: true }), `${place.name}: what it pays, what else is had there`, { 'data-link': 'place' }) : null);
    fill(card,
      h('div', { class: 'u-ah-card-pic' }, pic(n)),
      h('div', { class: 'u-ah-card-body' },
        h('div', { class: 'u-ah-card-head' }, h('b', { class: 'u-ah-card-name' }, n.name), n.priceText ? h('span', { class: 'u-ah-card-price' }, n.priceText) : null, pill(n, n0.keyFor), closeX()),
        h('div', { class: 'u-ah-card-main' },
          h('p', { class: 'u-ah-short-big' }, n.short),
          h('p', { class: 'u-ah-does' }, n.does),
          facts, jobs, cards),
        h('div', { class: 'u-ah-card-side' },
          n.where ? h('p', { class: 'u-ah-wheretext' }, icon('map'), h('span', null, n.where.text, n.where.payText && n.kind !== 'place' && n.kind !== 'route' && n.where.pays ? ` Paid ${n.where.payText}.` : '')) : null,
          opens, got,
          needs.length ? h('div', { class: 'u-ah-chips' }, h('span', { class: 'u-ah-needs' }, 'Needs'), needs.map(id => nodeChip(D, id))) : null,
          acts),
        // (the fight's table across the whole card: every row in sight, its columns in full)
        n.vs?.length ? h('div', { class: 'u-ah-vswrap is-wide' }, vsTable(n)) : null));
    placeCard();
  }
  const closeX = () => h('button', { type: 'button', class: 'u-x u-ah-x', 'data-close': '', title: 'Put the card away (Esc)', 'aria-label': 'Put the card away (Esc)', onclick: () => closeCard(true) }, '×');
  /**
   * THE CARD COMES UP OVER THE TREES, on the side away from what was picked (picked in the left half, on the right; else
   * on the left), from the trees' top, as tall as what it says: so the picked node stays in sight beside it.
   */
  function placeCard() {
    card.hidden = !cardOpen;
    if (!cardOpen) return;
    const sheet = card.offsetParent;
    const sc = root();
    if (!sheet || !sc) return;
    const S = sheet.getBoundingClientRect();
    const T = sc.getBoundingClientRect();
    card.style.maxHeight = `${Math.round(S.bottom - T.top - 14)}px`;
    const at = (byId.get(picked) ?? body.querySelector(`[data-group="${picked}"]`))?.getBoundingClientRect() ?? null;
    const [w, hh] = [card.offsetWidth, card.offsetHeight];
    // (of the four corners of the trees' box, the one where the card covers least of what was picked; the top first)
    const top = T.top - S.top + 6;
    const low = Math.max(top, S.bottom - S.top - hh - 8);
    const options = [[false, top], [true, top], [false, low], [true, low]].map(([right, y]) => {
      const x = right ? S.width - 10 - w : 10;
      const cover = at ? Math.max(0, Math.min(at.right - S.left, x + w) - Math.max(at.left - S.left, x)) * Math.max(0, Math.min(at.bottom - S.top, y + hh) - Math.max(at.top - S.top, y)) : 0;
      return { right, y, cover };
    });
    const best = options.reduce((a, b) => (b.cover < a.cover ? b : a));
    card.classList.toggle('is-right', best.right);
    card.style.top = `${Math.round(best.y)}px`;
  }
  /** Puts the card away (Esc, its ×): the trees alone again. `focusBack`: the keys go back to the node it was for. */
  function closeCard(focusBack = false) {
    if (!cardOpen) return false;
    cardOpen = false;
    card.hidden = true;
    if (focusBack) (byId.get(picked) ?? body.querySelector(`[data-group="${picked}"]`))?.focus({ preventScroll: true });
    return true;
  }

  // ── PAINT ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  function paint() {
    open = true;
    const n0 = now();
    const v = n0.v;
    if (!v) return;
    data = aheadOf(cfg, n0.state, v.choices, odds);
    // (pot-2: the fifth tree, Make, from the rules' view of the pot; the hot plate moves to it from Gear)
    const make = makeBranch(cfg, v, { ...data, owns: n0.state?.things }, data.have);
    if (make) {
      data.branches.push(make);
      const gear = data.branches.find(b => b.id === 'gear');
      if (gear) {
        const counted = gear.groups.flatMap(g => g.nodes).map(id => data.nodes[id]).filter(n => n.kind !== 'good');
        gear.count = { ...gear.count, owned: counted.filter(n => n.state === 'owned').length, of: counted.length };
      }
      data.order = data.branches.flatMap(b => b.groups.flatMap(g => g.nodes));
    }
    if (picked && !data.nodes[picked] && !groupOf(picked)) picked = null;
    const keys = (v.choices ?? []).map(c => `${c.key}:${n0.keyFor?.(c.key) ?? ''}`).join();
    const s = JSON.stringify([data.branches, data.order.map(id => data.nodes[id]), picked, keys]);
    if (s !== sig) {
      sig = s;
      const scroll = root();
      const top = scroll?.scrollTop ?? 0;
      const had = document.activeElement?.dataset?.node ?? null;
      byId.clear();
      fill(body, data.branches.map(b => branchEl(b, data)));
      if (scroll) scroll.scrollTop = top;
      if (had && byId.get(had)) byId.get(had).focus({ preventScroll: true });
      const owned = Object.values(data.nodes).filter(x => x.state === 'owned' && x.kind !== 'place' && x.kind !== 'route' && x.kind !== 'good').length;
      const all = data.branches.filter(b => b.id !== 'places').reduce((a, b) => a + b.count.of, 0);
      fill(head, h('span', { class: 'u-lib-count', title: 'Ways to fight, gear and pieces for the home that are yours' }, `${owned} of ${all} yours`));
      const next = data.next ? data.nodes[data.next.id] : null;
      fill(lead,
        h('p', { class: 'u-ah-money' }, icon('cash'), h('span', null, h('b', null, money(data.have)), ` to spend: ${money(data.carried)} on you, ${money(data.banked)} banked`)),
        next ? h('button', { type: 'button', class: `u-ah-next${data.next.now ? ' is-now' : ''}`, 'data-go': next.id, title: 'Show it', onclick: () => select(next.id, { focus: true, card: true }) },
          h('b', null, data.next.now ? 'Next within reach' : 'Nearest'), h('span', null, data.next.text.replace(/^(Within reach|Nearest): /, ''))) : null);
    }
    if (cardOpen) paintCard(data, n0);
    else card.hidden = true;
    if (missing(n0.state).length) kick();
  }
  /** A group's own card: who it answers and what is in it (the Home branch's visitors). */
  const groupOf = id => {
    const [, bid, gid] = String(id).split(':');
    const b = data?.branches.find(x => x.id === bid);
    const g = b?.groups.find(x => x.id === gid);
    return g ? { b, g } : null;
  };
  function select(id, { focus = false, scroll = true, card: up = false } = {}) {
    if (!data?.nodes[id] && !groupOf(id)) return;
    if (picked !== id) {
      for (const x of body.querySelectorAll('.u-ah-glabel.is-picked')) x.classList.remove('is-picked');
      body.querySelector(`[data-group="${id}"]`)?.classList.add('is-picked');
      const was = byId.get(picked);
      if (was) {
        was.classList.remove('is-picked');
        was.setAttribute('aria-selected', 'false');
      }
      picked = id;
      const b = byId.get(id);
      if (b) {
        b.classList.add('is-picked');
        b.setAttribute('aria-selected', 'true');
      }
      sig = null;
    }
    const b = byId.get(id) ?? body.querySelector(`[data-group="${id}"]`);
    if (b && scroll) b.scrollIntoView({ block: 'nearest' });
    if (b && focus) b.focus({ preventScroll: true });
    if (up) cardOpen = true;
    if (cardOpen) paintCard(data, now());
  }
  /** The arrows: ↑ ↓ along a branch (into the next at its end), ← → to the branch beside, at about the same row. */
  function arrow(key) {
    if (!data) return false;
    const cols = data.branches.map(b => b.groups.flatMap(g => g.nodes));
    let ci = cols.findIndex(c => c.includes(picked));
    if (ci < 0) {
      select(data.next?.id ?? cols[0][0], { focus: true });
      return true;
    }
    let ri = cols[ci].indexOf(picked);
    if (key === 'ArrowDown') ri < cols[ci].length - 1 ? (ri += 1) : ((ci = (ci + 1) % cols.length), (ri = 0));
    else if (key === 'ArrowUp') ri > 0 ? (ri -= 1) : ((ci = (ci - 1 + cols.length) % cols.length), (ri = cols[ci].length - 1));
    else if (key === 'ArrowRight' || key === 'ArrowLeft') {
      ci = (ci + (key === 'ArrowRight' ? 1 : -1) + cols.length) % cols.length;
      ri = Math.min(ri, cols[ci].length - 1);
    } else if (key === 'Home') ri = 0;
    else if (key === 'End') ri = cols[ci].length - 1;
    else return false;
    select(cols[ci][ri], { focus: true });
    return true;
  }
  return {
    head, lead, body, card,
    paint,
    /** (smooth-1) Counts were kept: the numbers still missing are asked for again, while the panel is open. */
    kick: () => (open ? kick() : null),
    select,
    arrow,
    /** Into the trees, on the kept node or the next within reach. */
    focus() {
      const id = picked ?? data?.next?.id ?? data?.order[0];
      if (id) select(id, { focus: true });
    },
    owns: el => !!el && (body.contains(el) || card.contains(el) || lead.contains(el)),
    /** Esc: the card away first; true when it was up. */
    closeCard: () => closeCard(true),
    get cardOpen() {
      return cardOpen;
    },
    /** Closed: the fight's numbers stop being asked for (what was asked is kept). */
    stop() {
      open = false;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    get selected() {
      return picked;
    },
    get data() {
      return data;
    },
    get oddsLeft() {
      const n = now();
      return n.state ? missing(n.state).length : null;
    },
  };
}
