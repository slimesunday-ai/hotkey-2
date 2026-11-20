// THE LIBRARY (ui-3 leg 3, part C; the owner: "where is the catalog?"): everything that exists, to wear, for the home
// and to ride, in one scrolling sheet (L, or Library on the rail). Never hidden by what was seen: every piece of
// view.library.pieces is in it. Its filters (Wear, Home or Ride; the slot, or the category with "On a wall"; the
// rarity; all, on sale today or owned) and its order (price or rarity) are kept in this browser, and the count says
// how many it shows of how many there are. Each piece is a tile (tiles.js) with its name, its rarity as a word on its
// colour, its price, and marks for yours, worn and on sale today. Hovering a piece, or focusing it, shows it on the
// card under the grid: a bigger picture (on the player, for a piece to wear), what it is, where it is sold today, and
// what can be done: TRY ON (any piece to wear, owned or not: nothing is bought), BUY (only by the rules' own choice,
// when it is offered here and now; otherwise the button stays and says why), PUT ON or TAKE OFF (at home). A click
// keeps a piece on the card while the pointer goes to its buttons.
//
// The page owns the sheet (index.js: the panel's head, the try-on, the keys); this module draws the sheet's lead (the
// filters), its scroll (the grid) and its card, and redraws the grid only when what it shows has changed.
//
//   const lib = createLibrary({ cfg, tiles, now, act, kept, root })
//     now()  → { v, choosing, tried: { slot: key } | null, compact }
//     act    { buy(choiceKey), wear(choiceKey), tryOn(pieceKey), takeOff(pieceKey), toast(text) }
//     root() → the sheet's scrolling box (the tiles are drawn as they come into it)
//   lib.lead · lib.grid · lib.card    the three parts, placed by the page
//   lib.paint()   again from now() (cheap when nothing changed) · lib.owns(el) · lib.focus() · lib.filter · lib.set(f)
//   lib.show(key) one piece from elsewhere (the Ahead panel): its kind, kept on the card, in sight
import { h, fill } from '../hud/dom.js';
import { icon } from './icons.js';
import { KINDS, SLOTS, SHOWS, SORTS, FILTER0, ON_WALL, pick, order, countLine, catsOf, buyOf, wearOf, soldLine, fitLine, jobLine, marksOf, marksWords, money, nameOf, tierWord, fightWays } from './catalog.js';

const KEPT = 'lib';
const TIERS = [0, 1, 2, 3];

export function createLibrary({ cfg, tiles, now, act, kept, root }) {
  const f = { ...FILTER0 };
  try {
    Object.assign(f, JSON.parse(kept.get(KEPT) ?? '{}'));
  } catch {}
  let pinned = null;      // the piece kept on the card (a click, or the keyboard)
  let hover = null;       // the piece under the pointer
  let gridSig = null;
  let cardSig = null;
  let leadSig = null;
  let shown = [];
  let pieces = [];
  let foldCard = kept.get('lib.card') === 'fold';
  let foldLead = kept.get('lib.lead') === 'fold';

  const head = h('div', { class: 'u-lib-head' });
  const lead = h('div', { class: 'u-lib-lead' });
  const grid = h('div', { class: 'u-lib-grid', role: 'listbox', 'aria-label': 'Every piece', 'aria-orientation': 'horizontal' });
  const card = h('section', { class: 'u-lib-card', 'aria-label': 'The piece', 'aria-live': 'polite' });
  const byKey = new Map();

  const keep = () => kept.set(KEPT, JSON.stringify({ kind: f.kind, slot: f.slot, cat: f.cat, tier: f.tier, show: f.show, sort: f.sort }));
  function set(o) {
    Object.assign(f, o);
    if (o.kind && o.kind !== 'wear') f.slot = 'all';
    if (o.kind && o.kind !== 'home') f.cat = 'all';
    keep();
    gridSig = null;
    pinned = null;
    hover = null;
    paint();
    const sc = root();
    if (sc) sc.scrollTop = 0;
  }

  // ── THE FILTERS ─────────────────────────────────────────────────────────────────────────────────────────────────
  const seg = (items, on, pickIt, cls = '') => h('div', { class: `u-seg ${cls}`, role: 'group' }, items.map(it => h('button', {
    type: 'button', class: `u-chip${it.id === on ? ' is-on' : ''}${it.cls ? ` ${it.cls}` : ''}`, 'aria-pressed': String(it.id === on), title: it.title ?? null,
    onclick: () => pickIt(it.id),
  }, it.dot ?? null, it.label, it.n !== undefined && it.n !== null ? h('small', null, String(it.n)) : null)));
  function paintLead({ compact, v }) {
    const counts = { wear: pieces.filter(p => p.kind === 'wear').length, home: pieces.filter(p => p.kind === 'home').length, ride: pieces.filter(p => p.kind === 'ride').length, fight: fightWays(v).length };
    if (f.kind === 'fight') {
      // (styles-1: the ways to fight are a short list: no filters)
      const sig = JSON.stringify([f.kind, counts, compact]);
      if (sig === leadSig) return;
      leadSig = sig;
      fill(head, seg(KINDS.map(k => ({ ...k, n: counts[k.id] })), f.kind, kind => set({ kind }), 'is-kinds'), h('span', { class: 'u-lib-count' }, `${counts.fight} ways`));
      return fill(lead, h('p', { class: 'u-lib-said rn-note' }, 'What you can fight with, one-on-one and when you are jumped. Each is had at one place. You choose what you fight with in You (C), Fight.'));
    }
    const sig = JSON.stringify([f, counts, shown.length, compact, foldLead]);
    if (sig === leadSig) return;
    leadSig = sig;
    const folded = compact || foldLead;
    const count = h('span', { class: 'u-lib-count', title: 'How many the filters show, of every piece of this kind' }, countLine(shown, pieces, f));
    // (the panel's head: what kind of thing, and how many shown of how many)
    fill(head, seg(KINDS.map(k => ({ ...k, n: counts[k.id] })), f.kind, kind => set({ kind }), 'is-kinds'), count);
    const foldBtn = compact ? null : h('button', { type: 'button', class: 'u-x u-lib-fold', title: folded ? 'Open the filters' : 'Fold the filters to one line', 'aria-expanded': String(!folded), onclick: () => { foldLead = !foldLead; kept.set('lib.lead', foldLead ? 'fold' : 'open'); paint(); } }, icon(folded ? 'unfold' : 'fold'));
    if (folded) {
      const words = [KINDS.find(k => k.id === f.kind)?.label, f.kind === 'wear' && f.slot !== 'all' ? SLOTS.find(s => s.id === f.slot)?.label : null,
        f.kind === 'home' && f.cat !== 'all' ? (f.cat === ON_WALL ? 'On a wall' : catsOf(pieces).find(c => c.id === f.cat)?.label) : null,
        f.tier !== 'all' ? tierWord(Number(f.tier)) : null, f.show !== 'all' ? SHOWS.find(s => s.id === f.show)?.label : null, SORTS.find(s => s.id === f.sort)?.label].filter(Boolean);
      return fill(lead, h('div', { class: 'u-lib-row is-folded' }, h('span', { class: 'u-lib-said', title: words.join(' · ') }, words.join(' · ')), foldBtn));
    }
    const shows = seg(SHOWS, f.show, show => set({ show }), 'is-shows');
    let row2;
    if (f.kind === 'wear') row2 = seg([{ id: 'all', label: 'All' }, ...SLOTS], f.slot, slot => set({ slot }), 'is-slots');
    else if (f.kind === 'home') {
      const cats = catsOf(pieces);
      const wall = cats[0];
      const sel = h('select', { class: 'u-select', 'aria-label': 'Category', onchange: e => set({ cat: e.target.value }) },
        h('option', { value: 'all' }, 'Every category'), cats.slice(1).map(c => h('option', { value: c.id }, `${c.label} (${c.n})`)));
      sel.value = f.cat === ON_WALL ? 'all' : f.cat;
      row2 = h('div', { class: 'u-seg is-cats' }, sel, h('button', { type: 'button', class: `u-chip is-wall${f.cat === ON_WALL ? ' is-on' : ''}`, 'aria-pressed': String(f.cat === ON_WALL), title: 'Everything that hangs on a wall', onclick: () => set({ cat: f.cat === ON_WALL ? 'all' : ON_WALL }) }, 'On a wall', h('small', null, String(wall.n))));
    } else row2 = null;
    const tiersSeg = seg([{ id: 'all', label: 'Any rarity' }, ...TIERS.map(t => ({ id: String(t), label: tierWord(t), cls: `is-tier is-t${t}`, dot: h('i', { class: `u-tier-dot is-t${t}`, 'aria-hidden': 'true' }) }))], String(f.tier), tier => set({ tier }), 'is-tiers');
    const sort = h('select', { class: 'u-select', 'aria-label': 'Order', onchange: e => set({ sort: e.target.value }) }, SORTS.map(s => h('option', { value: s.id }, s.label)));
    sort.value = f.sort;
    fill(lead,
      row2 ? h('div', { class: 'u-lib-row' }, row2) : null,
      h('div', { class: 'u-lib-row' }, tiersSeg),
      h('div', { class: 'u-lib-row' }, shows, h('span', { class: 'u-lib-sort' }, sort), foldBtn));
  }

  // ── THE GRID ────────────────────────────────────────────────────────────────────────────────────────────────────
  const markEl = (m, p) => {
    const out = [];
    if (m.worn) out.push(h('span', { class: 'u-mark is-worn', title: 'You are wearing it' }, icon('person')));
    else if (m.owned) out.push(h('span', { class: 'u-mark is-owned', title: 'Yours' }, icon('check')));
    if (!m.owned && m.today) out.push(h('span', { class: `u-mark is-today${m.here ? ' is-here' : ''}`, title: m.here ? 'On sale here today' : 'On sale today somewhere' }, icon('shop')));
    if (m.wall) out.push(h('span', { class: 'u-mark is-wall', title: 'Hangs on a wall' }, icon('frame')));
    return out.length ? h('span', { class: 'u-marks' }, out) : null;
  };
  const tierPlate = t => h('span', { class: `u-tier is-t${t}` }, tierWord(t));
  /** What a cell shows of a piece's state: yours, worn, on sale today, here. */
  const flags = new Map();
  const flagOf = (p, v) => {
    const m = marksOf(p, v);
    return `${+m.owned}${+m.worn}${+m.today}${+m.here}${pinned === p.key ? 1 : 0}`;
  };
  function cellOf(p, v) {
    const m = marksOf(p, v);
    const words = marksWords(m);
    const name = nameOf(p);
    const b = h('button', {
      type: 'button', class: `u-lib-cell${m.owned ? ' is-owned' : ''}${pinned === p.key ? ' is-pinned' : ''}`, 'data-key': p.key, role: 'option', tabindex: '-1', 'aria-selected': String(pinned === p.key),
      title: `${name} · ${tierWord(p.tier)} · ${money(p.price)}${words ? ` · ${words}` : ''}`,
    },
    h('span', { class: 'u-lib-pic' }, tiles.el(p.piece ?? p.key, { root: root(), label: name }), markEl(m, p)),
    h('b', { class: 'u-lib-name' }, name),
    h('span', { class: 'u-lib-meta' }, tierPlate(p.tier), h('span', { class: 'u-lib-price' }, shortMoney(p.price))),
    words ? h('span', { class: 'u-lib-state' }, words) : null);
    byKey.set(p.key, b);
    return b;
  }
  function paintGrid(v, choosing) {
    // (while an hour plays the grid stays as it is, its marks a step behind: built again at the next choice, so a
    // scene never waits on a few hundred tiles laid out anew. A filter changed meanwhile is drawn at once)
    if (!choosing && gridSig !== null) return;
    // (join-1: THE GRID KEEPS THE KEYBOARD when it is drawn again: a cell that had the focus, replaced or laid out
    // anew at the next choice, gave it to the page, and the arrows went to the dock till the Library was shut and
    // opened again. Found by hand in Chrome: opened while a scene played, then the scene ended)
    const had = grid.contains(document.activeElement);
    try {
      paintGrid1(v);
    } finally {
      if (had && !grid.contains(document.activeElement)) (byKey.get(pinned) ?? grid.querySelector('.u-lib-cell'))?.focus({ preventScroll: true });
    }
  }
  function paintGrid1(v) {
    const sig = JSON.stringify(f) + '|' + shown.map(p => p.key).join(',');
    // (the same pieces in the same order, a step later or in another place: only the cells whose marks changed are
    // drawn again, not the whole grid: the moment the next choice comes stays smooth)
    if (sig === gridSig) {
      for (const p of shown) {
        const fl = flagOf(p, v);
        if (flags.get(p.key) === fl) continue;
        const old = byKey.get(p.key);
        const cell = cellOf(p, v);
        if (old) {
          cell.tabIndex = old.tabIndex;
          old.replaceWith(cell);
        }
        flags.set(p.key, fl);
      }
      return;
    }
    const keepTop = gridSig && gridSig.split('|')[0] === JSON.stringify(f);
    const sc = root();
    const top = sc?.scrollTop ?? 0;
    gridSig = sig;
    byKey.clear();
    flags.clear();
    for (const p of shown) flags.set(p.key, flagOf(p, v));
    fill(grid, shown.length ? shown.map(p => cellOf(p, v)) : h('p', { class: 'u-lib-none' }, f.show === 'owned' ? 'You own none of these yet.' : f.show === 'today' ? 'None of these is on sale today.' : 'Nothing here.'));
    // (the keyboard's way in: the kept piece, or the first)
    const first = byKey.get(pinned) ?? grid.querySelector('.u-lib-cell');
    if (first) first.tabIndex = 0;
    if (sc && keepTop) sc.scrollTop = top;
  }
  grid.addEventListener('pointerover', e => {
    const c = e.target.closest?.('.u-lib-cell');
    const k = c?.dataset.key ?? null;
    if (k && k !== hover) {
      hover = k;
      paintCard();
    }
  });
  grid.addEventListener('pointerleave', () => {
    if (hover === null) return;
    hover = null;
    paintCard();
  });
  grid.addEventListener('click', e => {
    const c = e.target.closest?.('.u-lib-cell');
    if (c) pin(c.dataset.key);
  });
  grid.addEventListener('focusin', e => {
    const c = e.target.closest?.('.u-lib-cell');
    if (!c) return;
    for (const x of grid.querySelectorAll('.u-lib-cell[tabindex="0"]')) if (x !== c) x.tabIndex = -1;
    c.tabIndex = 0;
    if (c.matches(':focus-visible')) pin(c.dataset.key);
  });
  // THE ARROWS move along the grid (up and down by its row), Home and End to its ends
  /** From a cell, by a key: the next cell focused and kept on the card. → whether the key was the grid's. */
  function step(c, key) {
    const cells = [...grid.querySelectorAll('.u-lib-cell')];
    if (!cells.length) return false;
    const i = Math.max(0, cells.indexOf(c));
    const cols = Math.max(1, cells.findIndex(x => x.offsetTop !== cells[0].offsetTop) === -1 ? cells.length : cells.findIndex(x => x.offsetTop !== cells[0].offsetTop));
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: cells.length - 1 }[key];
    if (to === undefined) return false;
    const n = cells[Math.max(0, Math.min(cells.length - 1, to))];
    n.focus();
    n.scrollIntoView({ block: 'nearest' });
    pin(n.dataset.key);
    return true;
  }
  grid.addEventListener('keydown', e => {
    const c = e.target.closest?.('.u-lib-cell');
    if (!c) return;
    if (step(c, e.key)) e.preventDefault();
  });
  function pin(key) {
    if (pinned === key) return;
    const was = byKey.get(pinned);
    if (was) {
      was.classList.remove('is-pinned');
      was.setAttribute('aria-selected', 'false');
    }
    pinned = key;
    const b = byKey.get(key);
    if (b) {
      b.classList.add('is-pinned');
      b.setAttribute('aria-selected', 'true');
    }
    paintCard();
  }

  // ── THE CARD ────────────────────────────────────────────────────────────────────────────────────────────────────
  function paintCard() {
    const { v, choosing, tried, compact } = now();
    const p = pieces.find(x => x.key === (hover ?? pinned)) ?? shown[0] ?? null;
    const isTried = !!p && p.kind === 'wear' && tried?.[p.slot] === p.key;
    const b = p ? buyOf(p, { cfg, v, choosing }) : null;
    const w = p ? wearOf(p, { v, choosing }) : null;
    const folded = foldCard || compact;
    const sig = JSON.stringify([p?.key, p?.owned, p?.worn, isTried, b, w, folded, v.place, v.carried]);
    if (sig === cardSig) return;
    cardSig = sig;
    card.classList.toggle('is-folded', folded);
    if (!p) return fill(card, h('p', { class: 'u-lib-none' }, 'Nothing to show.'));
    const name = nameOf(p);
    const tryBtn = p.kind === 'wear' ? h('button', {
      type: 'button', class: `u-btn u-lib-try${isTried ? ' is-on' : ''}`, 'aria-pressed': String(isTried),
      title: isTried ? 'Take it off: back to what you really wear' : 'See it on you, here and now: nothing is bought, and it comes off when you close this or move',
      onclick: () => (isTried ? act.takeOff(p.key) : act.tryOn(p.key)),
    }, icon('person'), isTried ? 'Take it off' : 'Try on') : null;
    const buyBtn = h('button', {
      type: 'button', class: `u-btn u-lib-buy${b.can ? ' is-go' : ' is-no'}`, 'aria-disabled': b.can ? null : 'true',
      title: b.can ? `${b.label}: from what you carry, no hour` : `${b.label}: ${b.why}`,
      onclick: () => (b.can ? act.buy(b.key) : act.toast(`${name}: ${b.why}`)),
    }, h('span', { class: 'u-lib-buy-t' }, h('b', null, b.label), b.can || p.owned ? null : h('small', null, b.why)));
    const wearBtn = w ? h('button', {
      type: 'button', class: `u-btn u-lib-wear${w.can ? '' : ' is-no'}`, 'aria-disabled': w.can ? null : 'true', title: w.can ? `${w.label}: no hour` : `${w.label}: ${w.why}`,
      onclick: () => (w.can ? act.wear(w.key) : act.toast(`${name}: ${w.why}`)),
    }, h('span', { class: 'u-lib-buy-t' }, h('b', null, w.label), w.can ? null : h('small', null, w.why))) : null;
    const foldBtn = compact ? null : h('button', { type: 'button', class: 'u-x u-lib-fold', title: folded ? 'Open the card' : 'Fold the card to one line', 'aria-expanded': String(!folded), onclick: () => { foldCard = !foldCard; kept.set('lib.card', foldCard ? 'fold' : 'open'); cardSig = null; paintCard(); } }, icon(folded ? 'fold' : 'unfold'));
    const tryNote = isTried ? h('span', { class: 'u-pill u-trying' }, icon('person'), p.owned ? 'Trying it on · yours' : 'Trying it on · not yours') : null;
    if (folded) {
      return fill(card, h('div', { class: 'u-lib-card-row' },
        h('b', { class: 'u-lib-card-name', title: name }, name), h('span', { class: `u-tier is-t${p.tier}` }, tierWord(p.tier)), h('span', { class: 'u-lib-card-price' }, money(p.price)),
        tryBtn, buyBtn, wearBtn, foldBtn));
    }
    // (to wear: the piece on the player, the preview that is always there; else the piece alone, bigger)
    const pic = p.kind === 'wear' ? tiles.el(p.piece ?? p.key, { how: 'worn', slot: p.slot, size: 96, label: `${name}, worn` }) : tiles.el(p.piece ?? p.key, { size: 96, label: name });
    fill(card,
      h('div', { class: 'u-lib-card-pic' }, pic),
      h('div', { class: 'u-lib-card-body' },
        h('div', { class: 'u-lib-card-head' }, h('b', { class: 'u-lib-card-name' }, name), foldBtn),
        h('div', { class: 'u-lib-card-meta' }, h('span', { class: `u-tier is-t${p.tier}` }, tierWord(p.tier)), h('span', { class: 'u-lib-card-price' }, money(p.price)), h('span', { class: 'u-lib-card-kind' }, fitLine(p))),
        // (sixes-1: a piece that defends your crib: its one job, before where it is had)
        jobLine(p) ? h('p', { class: 'u-lib-card-job' }, jobLine(p)) : null,
        h('p', { class: 'u-lib-card-sold' }, soldLine(p, { cfg, v })),
        tryNote,
        h('div', { class: 'u-lib-card-acts' }, tryBtn, wearBtn, buyBtn)));
  }

  /** (styles-1) The Fight kind: the ways to fight, one row each, with what it does and where it is had; Learn when taught here. */
  function paintFight(v, choosing) {
    const ways = fightWays(v);
    const sig = JSON.stringify([ways, choosing]);
    if (sig === gridSig) return;
    gridSig = sig;
    byKey.clear();
    fill(grid, h('ul', { class: 'u-lib-fight' }, ways.map(w => h('li', { class: `u-lib-fightway${w.owned ? ' is-owned' : ''}${w.chosen ? ' is-chosen' : ''}`, 'data-key': w.key },
      h('div', { class: 'u-lib-fight-top' }, h('b', { class: 'u-lib-name' }, w.name), h('span', { class: 'u-lib-price' }, money(w.price)),
        w.chosen ? h('span', { class: 'u-pill is-go' }, 'you fight with it') : w.owned ? h('span', { class: 'u-pill' }, icon('check'), 'yours') : null),
      h('p', { class: 'u-lib-fight-does' }, w.does),
      h('p', { class: 'u-lib-fight-where' }, icon('map'), w.where),
      w.learn ? h('button', {
        type: 'button', class: `u-btn u-lib-buy${w.learn.can && choosing ? ' is-go' : ' is-no'}`, 'aria-disabled': w.learn.can && choosing ? null : 'true', 'data-learn': w.key,
        title: w.learn.can ? `Learn ${w.name}: from what you carry, no hour` : `Learn ${w.name}: ${w.learn.why}`,
        onclick: () => (w.learn.can && choosing ? act.buy(w.learn.key) : act.toast(`${w.name}: ${w.learn.why ?? 'not now'}`)),
      }, h('span', { class: 'u-lib-buy-t' }, h('b', null, `Learn it · ${money(w.price)}`), w.learn.can ? null : h('small', null, w.learn.why))) : null))));
    fill(card, h('p', { class: 'u-lib-none' }, 'Against a big man, the throw; a grabber, the haymaker; a quick one, quick hands; a knife, the box cutter. Every fight card says what you win with what you have.'));
    cardSig = null;
  }

  function paint() {
    const n = now();
    pieces = n.v?.library?.pieces ?? [];
    if (f.kind === 'fight') {
      shown = [];
      paintLead(n);
      return paintFight(n.v, n.choosing);
    }
    shown = order(pick(pieces, f), f.sort);
    paintLead(n);
    paintGrid(n.v, n.choosing);
    paintCard();
  }

  return {
    head, lead, grid, card,
    paint,
    /** Whether an element is one of the Library's (its keys, its grid). */
    owns: el => !!el && (lead.contains(el) || grid.contains(el) || card.contains(el)),
    /** Into the grid, on the kept piece or the first. */
    focus() {
      const c = byKey.get(pinned) ?? grid.querySelector('.u-lib-cell');
      c?.focus({ preventScroll: false });
    },
    /**
     * An arrow (or Home, End) the page had while the Library is open and the game is choosing, with the focus not in
     * it (join-1): into the grid at the kept piece, and on by the key, as the grid's own would. → whether it moved.
     */
    arrow(key) {
      const c = byKey.get(pinned) ?? grid.querySelector('.u-lib-cell');
      return c ? step(c, key) : false;
    },
    get filter() {
      return { ...f };
    },
    set,
    /** For the tools: what it shows, in order, and the piece on the card. */
    get shown() {
      return shown.map(p => p.key);
    },
    get onCard() {
      return hover ?? pinned ?? shown[0]?.key ?? null;
    },
    pin,
    /**
     * (tree-1) One piece shown from elsewhere (the Ahead panel's link): the filters opened up to its kind, the piece kept
     * on the card and its cell scrolled into sight. → whether it is there.
     */
    show(key) {
      const p = (now().v?.library?.pieces ?? []).find(x => x.key === key);
      if (!p) return false;
      set({ kind: p.kind, slot: 'all', cat: 'all', tier: 'all', show: 'all' });
      pin(key);
      byKey.get(key)?.scrollIntoView({ block: 'center' });
      return true;
    },
    /** The card again whatever its last state (a try-on began or ended outside it). */
    repaintCard() {
      cardSig = null;
      paintCard();
    },
  };
}
/** A price short enough for a tile's line: $8, $255, $6,450, $152k (the card and the tooltip say it whole). */
const shortMoney = n => (n >= 10000 ? `$${Math.round(n / 1000)}k` : money(n));
