// THE FIGHT'S INTERFACE, IN THE RUN'S FRAME (join-1). The same parts as the run's, from the same stylesheets
// (demo/run/run.css, ui.css, skin.css: one change to the skin changes both pages), with the fight's own layout in
// demo/fight/ui.css (no colour of its own: tokens only). What it shows is dock.js's, as data.
//
//   CHOOSING   the WHERE card top left: the place's own name and the TRY-OUT mark, "nothing here counts". THE DOCK at
//              the bottom: the five loadouts on 1 to 5 (name, what is in it, how it did last time at this level), how
//              hard as a four-way choice (↑ ↓), Build your own (B: weapon, gear and help, folded until asked; with
//              Cousin Earl, his three ways as a row of choices, fight-3) and the
//              results side by side (J, folded to their last line until asked), and the main button saying exactly what
//              Enter does. ← → go along the loadouts.
//   A ROUND    the picture is the fight's: the frame compact by itself, a slim strip of meters (health, the vest, ammo,
//              how many are left, the time; Earl's health with him) and one quiet line of keys
//   AFTER      THE RESULT CARD top middle (the run's): won or lost, the numbers, the one line of advice, and the next
//              moves: Again (Enter), Change loadout (1 to 5), Back (Esc)
//   SIZES      I: full, compact, hidden, as the run's, kept in this browser (hk2.fight.*); the folds kept too
//
// No part here is one the stage makes way for (.hk-top, .hk-left, .hk-move-card): the fight's picture is framed as
// it always was, whatever is up. Nothing here moves anybody: the page's keys do (index.js).
import { h, fill, makeRoot, ensureStyles } from '../hud/dom.js';
import { icon } from '../run/icons.js';
import { WEAPONS, GEAR, ALLY, ARMS, RIVALS, levelOf } from '../../src/fight/data.mjs';
import { dockOf, metersOf, cardOf, tableOf, contentsOf, weaponWords, earlRows, LEVEL_WORD, levelName } from './dock.js';
import { RAID_HOLDS, RAID_CREWS } from '../run/raidcase.js';

const RUN = new URL('../run/', import.meta.url).href;
const FIGHT_CSS = new URL('./ui.css', import.meta.url).href;
/** This browser's memory of the fight's frame (its size, its folds); the page works without it. */
const kept = {
  get(k) {
    try {
      return localStorage.getItem(`hk2.fight.${k}`);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(`hk2.fight.${k}`, v);
    } catch {}
  },
};
export const SIZES = ['full', 'compact', 'hidden'];
const ROUND = new Set(['arrive', 'fight']);
/** (anim-1) One-on-one, to look at: what you may fight with there (the run's own five), in the run's words. */
const DUEL_ARMS = [['hands', 'Bare hands'], ['cutter', 'Box cutter'], ['jab', 'Quick hands'], ['haymaker', 'The haymaker'], ['throw', 'The throw']];

/** The run's own stylesheets, once (the same marks the run's page uses: loaded once whichever page loads them first). */
function linkStyles() {
  ensureStyles();
  const link = (href, mark) => {
    if (!document.querySelector(`link[${mark}]`)) document.head.append(h('link', { rel: 'stylesheet', href, [mark]: '' }));
  };
  link(`${RUN}run.css`, 'data-rn-css');
  link(`${RUN}ui.css`, 'data-rn-ui');
  link(`${RUN}skin.css`, 'data-rn-skin');
  link(FIGHT_CSS, 'data-fg-ui');
}

/**
 * `now()` → { phase: 'pick' | 'arrive' | 'fight' | 'over', pick, results, F, R (the last report), coming }
 * `act`: { preset(id), level(id), weapon(id), gear(id), ally(), fight(), back(), stay() }
 * `tryout`: { back: words } when the fight is a stop of a run's (the run's Back), else null (the test page).
 */
export function createPanels({ host, site, tryout = null, now, act }) {
  linkStyles();
  const kit = host.querySelector?.('#k') ?? host;
  const root = makeRoot(kit);
  root.classList.add('rn', 'fg');
  const S = { size: null, build: false, buildAt: 0, cardGone: false, ask: false, sig: {}, dead: false };
  const el = {
    where: h('section', { class: 'u-where u-panel fg-where', 'aria-label': 'Where' }),
    table: h('aside', { class: 'u-panel fg-table', 'aria-label': 'Results side by side' }),
    res: h('section', { class: 'u-res u-panel fg-res', role: 'status', 'aria-live': 'polite', hidden: true }),
    ask: h('section', { class: 'u-res u-panel fg-ask', role: 'alertdialog', hidden: true }),
    dock: h('section', { class: 'rn-card u-dock fg-dock', 'aria-label': 'The fight' }),
    back: h('button', { type: 'button', class: 'u-back u-btn is-quiet', hidden: true, title: 'Show the interface again (I)' }, 'Show the interface', h('kbd', { class: 'u-key' }, 'I')),
    toasts: h('div', { class: 'hk-toasts', role: 'status' }),
  };
  el.back.addEventListener('click', () => cycleSize());
  root.append(el.where, el.table, el.dock, el.res, el.ask, el.back, el.toasts);

  const ukey = k => h('kbd', { class: 'u-key' }, k);
  const upill = (tone, ic, text, extra = {}) => h('span', { class: `u-pill is-${tone}`, ...extra }, icon(ic), text);
  const chipEl = c => upill(c.tone, c.icon, c.text);
  const xBtn = (open, title, fn) => h('button', { type: 'button', class: 'u-x', title, 'aria-expanded': String(open), onclick: fn }, icon(open ? 'fold' : 'unfold'));

  // ── sizes and folds ──────────────────────────────────────────────────────────────────────────────────────────────
  const sizeChosen = () => S.size ?? (SIZES.includes(kept.get('size')) ? kept.get('size') : 'full');
  /** While a round is on the frame is compact by itself; hidden stays hidden. */
  const sizeNow = () => (sizeChosen() === 'hidden' ? 'hidden' : ROUND.has(now().phase) ? 'compact' : sizeChosen());
  /** Folded or not: the player's own choice, kept; else the results start folded and everything else open. */
  // (raidfight-3: the raid's rows start folded under their title too, the owner's rule for a crowded screen: "can just
  // be the title, then once you click it, it brings up the info"; at 1280 by 800 the build list ran under the dock.
  // Open when the address picks a raid)
  const RAID_ADDR = (q => q.has('raid') || q.has('night'))(new URLSearchParams(location.search));
  const folded = k => (k === 'raid' && RAID_ADDR && kept.get(k) !== 'fold' ? false : kept.get(k) === 'fold' || (kept.get(k) !== 'open' && (k === 'results' || k === 'raid')));
  function fold(k, on = !folded(k)) {
    kept.set(k, on ? 'fold' : 'open');
    paint();
  }
  function cycleSize() {
    S.size = SIZES[(SIZES.indexOf(sizeChosen()) + 1) % SIZES.length];
    kept.set('size', S.size);
    toast(S.size === 'full' ? 'Interface: full (I)' : S.size === 'compact' ? 'Interface: compact (I)' : 'Interface hidden: I brings it back');
    paint();
  }
  function toast(text) {
    const t = h('div', { class: 'hk-toast u-toast' }, text);
    el.toasts.append(t);
    setTimeout(() => t.remove(), 2400);
  }

  // ── WHERE, top left ──────────────────────────────────────────────────────────────────────────────────────────────
  function paintWhere(s) {
    const round = ROUND.has(s.phase);
    const small = sizeNow() !== 'full' || folded('where');
    const level = round && s.F ? s.F.level : s.pick.level;
    const sig = JSON.stringify([small, level, sizeNow(), !!tryout]);
    if (S.sig.where === sig) return;
    S.sig.where = sig;
    el.where.classList.toggle('is-compact', small);
    fill(el.where,
      sizeNow() === 'full' ? h('button', { type: 'button', class: 'u-x u-where-fold', title: small ? 'Open where you are' : 'Fold it to one line', 'aria-expanded': String(!small), onclick: () => fold('where', !small) }, icon(small ? 'unfold' : 'fold')) : null,
      h('div', { class: 'fg-where-mark' }, h('span', { class: 'u-pill u-trying', title: 'A try-out: whatever happens here, nothing carries back' }, 'Try-out'), h('span', { class: 'fg-where-not' }, 'nothing here counts')),
      h('b', { class: `u-where-name${site.name.length > 17 ? ' is-long' : ''}`, title: site.place ?? site.name }, site.name),
      h('div', { class: 'u-where-when' }, icon('crowd'), h('b', null, LEVEL_WORD[level]), h('span', { class: 'fg-where-lvl', title: levelOf(level)?.says }, levelName(site, level))),
      h('div', { class: 'u-where-foot' },
        tryout ? h('button', { type: 'button', class: 'u-btn is-quiet', title: `${tryout.back} (Esc)`, onclick: () => act.back() }, icon('back'), tryout.back, ukey('Esc'))
          : h('span', { class: 'u-saved' }, 'the fight on its own: ?mode=fight'),
        h('span', { class: 'u-saved fg-where-free', title: 'No fare, no hour, no energy, no heat, and nothing you win or lose here goes back' }, 'costs nothing')));
  }

  // ── THE RESULTS SIDE BY SIDE, top right: folded to its last line until J ────────────────────────────────────────────
  function paintTable(s) {
    const round = ROUND.has(s.phase);
    el.table.hidden = round || sizeNow() === 'hidden';
    if (el.table.hidden) return;
    const open = !folded('results') && sizeNow() === 'full';
    const T = tableOf(s.results, s.pick);
    const sig = JSON.stringify([open, T, s.R?.result ?? null]);
    if (S.sig.table === sig) return;
    S.sig.table = sig;
    el.table.classList.toggle('is-folded', !open);
    const last = s.R && s.F ? `${s.R.result === 'won' ? 'won' : s.R.result === 'lost' ? 'went down' : s.R.result === 'left' ? 'left' : 'held out'} · ${LEVEL_WORD[s.F.level]}` : 'nothing fought yet';
    const head = h('div', { class: 'fg-table-head' }, icon('journal'), h('span', { class: 'u-cap' }, open ? 'Results side by side' : 'Results'), open ? null : h('span', { class: 'fg-table-last' }, last),
      h('button', { type: 'button', class: 'u-x fg-table-x', title: open ? 'Fold the results (J)' : 'Open the results side by side (J)', 'aria-expanded': String(open), onclick: () => fold('results', open) }, open ? 'Fold' : 'Open', ukey('J')));
    if (!open) return fill(el.table, head);
    const cell = c => (c ? h('td', { class: `is-${c.result}`, title: c.text }, c.short) : h('td', { class: 'is-none' }, '·'));
    fill(el.table, head,
      h('table', { class: 'fg-results' },
        h('thead', null, h('tr', null, h('th'), ...T.levels.map(l => h('th', { class: l.on ? 'is-on' : '' }, l.word)))),
        h('tbody', null, T.rows.map(r => h('tr', { class: r.on ? 'is-on' : '' }, h('th', null, r.name), ...r.cells.map(cell))))),
      h('p', { class: 'fg-table-note' }, 'The last result of each loadout at each level, kept in this browser.'));
  }

  // ── THE DOCK, bottom: while you choose, the loadouts, how hard, Enter; while a round is on, the meters ─────────────
  function paintDock(s) {
    const round = ROUND.has(s.phase);
    el.dock.classList.toggle('is-playing', round);
    if (round) return paintMeters(s);
    const small = sizeNow() !== 'full' || folded('dock');
    const d = dockOf({ pick: s.pick, results: s.results, site, again: s.phase === 'over' && !S.cardGone });
    const sig = JSON.stringify([small, d, S.build, S.buildAt, s.phase, sizeNow(), folded('results'), folded('raid'), s.duel ?? null, s.raid ?? null]);
    if (S.sig.dock === sig) return;
    S.sig.dock = sig;
    S.sig.meters = null;
    el.dock.classList.toggle('is-folded', small);
    const card = (c, row) => h('div', {
      class: `u-card fg-card${c.on ? ' is-on' : ''}${row ? ' is-row' : ''}`, role: 'button', tabindex: '0', 'data-preset': c.id, 'data-slot': String(c.n),
      title: `${c.name}: ${c.contents}. Last time on ${LEVEL_WORD[s.pick.level]}: ${c.last.text}. ${c.on ? 'Enter fights' : `${c.n} picks it`}`,
      onclick: () => (c.on ? act.fight() : act.preset(c.id)),
    }, h('span', { class: 'u-card-main' }, ukey(String(c.n)), h('b', { class: 'u-card-t' }, c.name)),
      row ? null : h('span', { class: 'u-card-sub fg-card-has' }, c.contents),
      row ? null : h('span', { class: `fg-card-last is-${c.last.tone}` }, c.last.text));
    const levels = h('div', { class: 'fg-levels', role: 'radiogroup', 'aria-label': 'How hard' },
      small ? null : h('span', { class: 'u-cap' }, 'How hard'),
      h('span', { class: 'u-seg' }, d.levels.map(l => h('button', { type: 'button', role: 'radio', 'aria-checked': String(l.on), class: `u-chip${l.on ? ' is-on' : ''}`, 'data-level': l.id, title: `${l.word}: ${l.name}, ${l.says} (↑ ↓)`, onclick: () => act.level(l.id) }, l.word, small ? null : h('small', null, l.name)))),
      small ? null : h('span', { class: 'fg-hint' }, ukey('↑'), ukey('↓')));
    const verb = (id, label, key, sub, on, fn) => h('button', { type: 'button', class: `u-verb${on ? ' is-on' : ''}`, 'data-verb': id, 'aria-expanded': String(on), title: `${label} (${key})`, onclick: fn },
      icon(id === 'build' ? 'goods' : 'journal'), h('span', { class: 'u-verb-t' }, h('b', null, label), small ? null : h('small', null, sub)), ukey(key));
    const custom = d.custom ? h('span', { class: 'u-pill is-you fg-own', title: d.contents }, 'Your own build') : null;
    const go = h('button', { type: 'button', class: 'u-btn is-go u-go', title: `${d.go}: ${d.contents} (Enter)`, onclick: () => act.fight() }, h('span', { class: 'u-go-t' }, d.go), ukey('Enter'));
    const buildBtn = verb('build', 'Build your own', 'B', 'weapon, gear, help', S.build, () => toggleBuild());
    if (small) {
      fill(el.dock, h('div', { class: 'u-dock-row' }, h('div', { class: 'u-dock-cards is-row fg-cards' }, d.cards.map(c => card(c, true))), levels, h('div', { class: 'u-dock-verbs is-row' }, buildBtn), go,
        sizeNow() === 'full' ? h('button', { type: 'button', class: 'u-x u-dock-fold', title: 'Open the dock (F)', 'aria-expanded': 'false', onclick: () => fold('dock', false) }, icon('fold')) : null), S.build ? buildList(s) : null);
    } else {
      fill(el.dock,
        h('div', { class: 'u-dock-head' }, h('span', { class: 'u-cap fg-dock-cap' }, 'The fight'), h('div', { class: 'rn-said' }, h('span', { class: 'rn-said-line' }, s.phase === 'over' && !S.cardGone ? 'Again with the same, or pick another: 1 to 5 (← →), how hard ↑ ↓.' : 'Pick a loadout: 1 to 5 (← →). How hard: ↑ ↓. Enter fights.')), custom,
          h('button', { type: 'button', class: 'u-x u-dock-fold', title: 'Fold the dock to one row (F)', 'aria-expanded': 'true', onclick: () => fold('dock', true) }, icon('unfold'))),
        h('div', { class: 'u-dock-cards fg-cards' }, d.cards.map(c => card(c, false))),
        h('div', { class: 'u-dock-verbs fg-verbs' }, levels, h('div', { class: 'u-verbs' }, buildBtn, verb('results', 'Results', 'J', folded('results') ? 'side by side' : 'open, top right', !folded('results'), () => fold('results'))), go),
        S.build ? buildList(s) : null);
    }
    // (the list sits over its button, as the run's Shop and Travel lists do over theirs)
    const list = el.dock.querySelector('.fg-build');
    const at = list && el.dock.querySelector('.u-verb[data-verb="build"]');
    if (list && at) {
      const r = at.getBoundingClientRect();
      const box = el.dock.getBoundingClientRect();
      list.style.left = `${Math.max(0, Math.min(box.width - list.offsetWidth, r.left - box.left))}px`;
      // (anim-1: as tall as the room over the dock allows, so the one-on-one and every row are in sight without a scroll)
      list.style.maxHeight = `${Math.max(240, Math.round(box.top - 14))}px`;
    }
  }

  // ── BUILD YOUR OWN (B): weapon, gear and help, over its button; ↑ ↓ along it, Enter takes or drops, B or Esc shut ──
  // (fight-3: each weapon says its job first; with Cousin Earl, how he fights: his three ways in a row under him, each
  // a stop of ↑ ↓ like any row, one at most; none, and he fights at your side as in the loadouts)
  function buildRows(pick) {
    return [
      ...ARMS.map(id => {
        const w = weaponWords(id);
        return { kind: 'weapon', id, name: WEAPONS[id].name, job: w.job, small: w.stats, on: pick.weapon === id, fn: () => act.weapon(id) };
      }),
      ...Object.entries(GEAR).map(([id, G]) => ({ kind: 'gear', id, name: G.name, small: G.says, on: pick.gear.includes(id), fn: () => act.gear(id) })),
      { kind: 'ally', id: 'earl', name: ALLY.name, small: `fights beside you: ${ALLY.hp} health, a ${WEAPONS[ALLY.weapon].name}`, on: pick.ally, fn: () => act.ally() },
      ...earlRows(pick).map(w => ({ kind: 'way', id: w.id, name: w.word, small: w.says, on: w.on, fn: () => act.earl(w.id) })),
    ];
  }
  function buildList(s) {
    const rows = buildRows(s.pick);
    const li = (r, i) => h('li', null, h('button', { type: 'button', class: `u-li${r.on ? ' is-on' : ''}${i === S.buildAt ? ' is-at' : ''}`, 'data-row': `${r.kind}:${r.id}`, 'aria-pressed': String(r.on), onclick: () => { S.buildAt = i; r.fn(); } },
      h('span', { class: 'u-li-t' }, h('b', null, r.name[0].toUpperCase() + r.name.slice(1)), r.job ? h('small', { class: 'fg-job' }, r.job) : null, h('small', null, r.small)), h('span', { class: 'fg-li-mark' }, r.on ? (r.kind === 'weapon' ? 'in hand' : 'taken') : r.kind === 'weapon' ? '' : 'add')));
    const ways = rows.filter(r => r.kind === 'way');
    const way = (r, i) => h('button', { type: 'button', role: 'radio', class: `u-chip fg-way${r.on ? ' is-on' : ''}${i === S.buildAt ? ' is-at' : ''}`, 'data-row': `way:${r.id}`, 'aria-checked': String(r.on), title: `${r.name}: ${r.small}`, onclick: () => { S.buildAt = i; r.fn(); } },
      h('b', null, r.name), h('small', null, r.small));
    return h('div', { class: 'u-list u-panel fg-build', role: 'listbox', 'aria-label': 'Build your own' },
      h('div', { class: 'u-list-head' }, icon('goods'), h('span', { class: 'u-cap' }, 'Build your own'), h('span', { class: 'u-dim u-list-keys' }, '↑ ↓ · Enter · B or Esc')),
      // (two columns, fight-3: the weapons, each with its job; the gear and help, and Earl's ways under him)
      // (anim-1) ONE-ON-ONE, TO LOOK AT (first in the panel: at the list's foot it was under the fold, its last row and its button out of sight): the run's own fight, played by itself here; no rule changed, no result kept
      (() => {
        const D = s.duel ?? { arm: 'hands', foe: 'brawler' };
        // (classes of its own: Earl's ways are `fg-ways`, and what looks for them must not find these)
        const chip = (on, label, title, fn, row) => h('button', { type: 'button', role: 'radio', class: `u-chip fg-duel-chip${on ? ' is-on' : ''}`, 'data-row': row, 'aria-checked': String(on), title, onclick: fn }, h('b', null, label));
        return h('div', { class: 'fg-duel', role: 'group', 'aria-label': 'One-on-one, to look at' },
          h('span', { class: 'u-cap fg-duel-cap' }, 'One-on-one, to look at: it plays itself, as in the run'),
          h('div', { class: 'fg-duel-row', role: 'radiogroup', 'aria-label': 'You fight with' }, DUEL_ARMS.map(([id, label]) => chip(D.arm === id, label, `You fight with ${label.toLowerCase()}`, () => act.duelArm(id), `duel-arm:${id}`))),
          h('div', { class: 'fg-duel-row', role: 'radiogroup', 'aria-label': 'Against' }, Object.entries(RIVALS).map(([id, R]) => chip(D.foe === id, R.name, `Against ${R.name}: ${R.says}`, () => act.duelFoe(id), `duel-foe:${id}`))),
          h('div', { class: 'fg-duel-row' }, h('button', { type: 'button', class: 'u-btn', 'data-row': 'duel:go', title: 'Watch this one-on-one play itself on the lot (Space or Enter skips it)', onclick: () => act.duel() }, 'Watch it')));
      })(),
      // (raidfight-1) THE RAID ON YOUR HOME, TO LOOK AT: the run's own raid, played by itself at your trailer's door
      (() => {
        const R = s.raid ?? { crew: 'rush', size: 1, hold: 'doorman', earl: false, night: true };
        const chip = (on, label, title, fn, row) => h('button', { type: 'button', role: 'radio', class: `u-chip fg-duel-chip${on ? ' is-on' : ''}`, 'data-row': row, 'aria-checked': String(on), title, onclick: fn }, h('b', null, label));
        const CREW = { rush: 'A rush', runners: 'The quick ones', shooters: 'Shooters', bigmen: 'Big men' };
        const shut = folded('raid');
        const HOLD = Object.fromEntries(RAID_HOLDS);
        const head = h('button', { type: 'button', class: 'u-cap fg-duel-cap fg-raid-head', 'data-row': 'raid:open', 'aria-expanded': String(!shut), title: shut ? 'Open the raid\'s choices' : 'Fold the raid\'s choices away', onclick: () => fold('raid') },
          `${shut ? '▸' : '▾'} The raid on your home, to look at${shut ? `: ${(CREW[R.crew] ?? R.crew).toLowerCase()}, ${(HOLD[R.hold] ?? R.hold).toLowerCase()}, ${R.night === false ? 'by day' : 'at night'}` : ': it plays itself at your door'}`);
        if (shut) return h('div', { class: 'fg-duel fg-raid is-shut', role: 'group', 'aria-label': 'The raid on your home, to look at' }, head);
        return h('div', { class: 'fg-duel fg-raid', role: 'group', 'aria-label': 'The raid on your home, to look at' },
          head,
          h('div', { class: 'fg-duel-row', role: 'radiogroup', 'aria-label': 'Who comes' }, RAID_CREWS.map(id => chip(R.crew === id, CREW[id] ?? id, `They send ${CREW[id] ?? id}`, () => act.raidCrew(id), `raid-crew:${id}`))),
          h('div', { class: 'fg-duel-row', role: 'radiogroup', 'aria-label': 'How many' }, ['Small', 'Bigger', 'Biggest'].map((label, k) => chip(R.size === k, label, `The ${label.toLowerCase()} crew`, () => act.raidSize(k), `raid-size:${k}`))),
          h('div', { class: 'fg-duel-row', role: 'radiogroup', 'aria-label': 'In your hands' }, RAID_HOLDS.map(([id, label]) => chip(R.hold === id, label, `In your hands: ${label.toLowerCase()}`, () => act.raidHold(id), `raid-hold:${id}`))),
          h('div', { class: 'fg-duel-row', role: 'radiogroup', 'aria-label': 'When' }, chip(R.night !== false, 'Night', 'At night, as the game always has it: the raid in its pool of light', () => act.raidNight(true), 'raid-time:night'), chip(R.night === false, 'Day', 'By day, to compare', () => act.raidNight(false), 'raid-time:day')),
          h('div', { class: 'fg-duel-row' }, chip(!!R.earl, 'Cousin Earl beside you', 'Cousin Earl stands with you at the door', () => act.raidEarl(), 'raid-earl'),
            h('button', { type: 'button', class: 'u-btn', 'data-row': 'raid:go', title: 'Watch the raid play itself at your trailer\'s door (Space or Enter skips it)', onclick: () => act.raid() }, 'Watch the raid')));
      })(),
      h('div', { class: 'fg-build-cols' },
        h('div', null, h('p', { class: 'fg-build-sub u-cap' }, 'Weapon: one'), h('ul', null, rows.filter(r => r.kind === 'weapon').map(r => li(r, rows.indexOf(r))))),
        h('div', null, h('p', { class: 'fg-build-sub u-cap' }, 'Gear and help: any'), h('ul', null, rows.filter(r => r.kind !== 'weapon' && r.kind !== 'way').map(r => li(r, rows.indexOf(r)))),
          ways.length ? h('div', { class: 'fg-ways', role: 'radiogroup', 'aria-label': `How ${ALLY.name} fights` },
            h('span', { class: 'u-cap fg-ways-cap' }, ways.some(r => r.on) ? 'How Earl fights' : 'How Earl fights: at your side, or'),
            h('div', { class: 'fg-ways-row' }, ways.map(r => way(r, rows.indexOf(r))))) : null)));
  }
  function toggleBuild(on = !S.build) {
    const s = now();
    if (ROUND.has(s.phase)) return;
    S.build = on;
    if (on) S.buildAt = Math.max(0, buildRows(s.pick).findIndex(r => r.kind === 'weapon' && r.on));
    paint();
  }

  // ── THE METERS while a round is on: every running risk, a meter, in the run's number style ──────────────────────
  function paintMeters(s) {
    const F = s.F;
    if (!F) return;
    const M = metersOf(F);
    const coming = s.phase === 'arrive';
    const sig = JSON.stringify([M, coming, sizeNow()]);
    if (S.sig.meters === sig) return;
    S.sig.meters = sig;
    S.sig.dock = null;
    el.dock.classList.toggle('is-folded', true);
    const meter = (cls, ic, capText, value, gauge, title) => h('div', { class: `fg-meter ${cls}`, title }, h('span', { class: 'u-cap' }, icon(ic), capText), h('b', { class: 'fg-meter-v' }, value), gauge);
    const bar = (frac, cls) => h('span', { class: `fg-bar ${cls}` }, h('i', { style: `width:${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%` }));
    const pips = (n, max, cls) => h('span', { class: `u-pips ${cls}`, 'aria-label': `${n} of ${max}` }, Array.from({ length: max }, (_, k) => h('i', { class: k < n ? 'is-on' : '' })));
    const A = M.ammo;
    const ammo = A.gun
      ? meter(`is-ammo${A.reload || A.dry ? ' is-risk' : ''}`, 'ammo', 'Ammo', A.reload ? 'reloading' : A.dry ? 'no rounds' : [String(A.mag), h('small', null, ` · ${A.rounds}`)], A.reload || A.dry ? null : pips(A.mag, A.max, `fg-pips-you${A.max > 8 ? ' is-many' : ''}`), `${A.name}: ${A.mag} in it, ${A.rounds} more on you`)
      : meter('is-ammo', 'ammo', 'Weapon', A.name, null, `${A.name}: no rounds to run out of`);
    fill(el.dock,
      h('div', { class: 'u-dock-row is-playing fg-strip' },
        meter(`is-health${M.health.low ? ' is-risk' : ''}`, 'health', 'Health', [String(M.health.hp), h('small', null, `/${M.health.max}`)], bar(M.health.frac, M.health.low ? 'is-risk' : 'is-gain'), 'Your health: at none you go down'),
        M.ally ? meter(`is-ally${M.ally.down ? ' is-risk' : ''}`, 'person', 'Earl', M.ally.down ? 'down' : String(M.ally.hp), M.ally.down ? null : bar(M.ally.hp / M.ally.max, 'is-trust'), `${M.ally.name}: ${M.ally.hp} of ${M.ally.max}`) : null,
        M.vest ? meter('is-vest', 'shield', 'Vest', [String(M.vest.took), h('small', null, ' taken')], null, `The stab vest takes ${M.vest.cut}% off every hit: ${M.vest.took} so far`) : null,
        ammo,
        meter('is-left is-risk-pips', 'crowd', 'Left', [String(M.left.n), h('small', null, ` of ${M.left.of}`)], pips(M.left.n, M.left.of, 'is-press'), `${M.left.n} of them still to drop (${M.left.dropped} down)`),
        meter(`is-time${M.time.late ? ' is-late' : ''}`, 'clock', 'Time', coming ? 'coming' : M.time.text, null, coming ? 'They are coming: the round starts as the first of them walk in' : `At ${Math.floor(M.time.cap / 60)}:${String(M.time.cap % 60).padStart(2, '0')} they back off whatever is left`)),
      h('p', { class: 'fg-keys' }, ukey('W'), ukey('A'), ukey('S'), ukey('D'), h('span', null, 'move'), h('i', null, '·'), h('span', null, 'your weapon fires by itself'), h('i', null, '·'),
        h('span', null, `walk to the ${site.exit?.mark ?? 'WAY OUT'} to leave`), tryout ? [h('i', null, '·'), ukey('Esc'), h('span', null, 'back')] : null));
  }

  // ── THE RESULT CARD, top middle ──────────────────────────────────────────────────────────────────────────────────
  function paintCard(s) {
    const up = s.phase === 'over' && !!s.R && !S.cardGone;
    el.res.hidden = !up;
    if (!up) {
      S.sig.res = null;
      return;
    }
    const c = cardOf(s.R, s.F, site, { tryout: !!tryout });
    const sig = JSON.stringify(c);
    if (S.sig.res === sig) return;
    S.sig.res = sig;
    el.res.className = `u-res u-panel fg-res is-${c.tone}`;
    const kick = { win: ['win', 'check'], loss: ['loss', 'warn'], quiet: ['mute', 'walk'], news: ['news', 'clock'] }[c.tone] ?? ['mute', 'clock'];
    fill(el.res,
      h('div', { class: 'u-res-kick' }, upill(kick[0], kick[1], c.kicker), h('span', { class: 'u-cap' }, c.meta)),
      h('h2', { class: 'u-res-head' }, c.head),
      h('p', { class: 'u-res-body' }, c.body),
      // (the try-out's mark last among what happened: nothing of it counts)
      h('div', { class: 'u-res-chips' }, c.chips.map(chipEl), c.note ? h('span', { class: 'u-pill u-trying', title: 'Whatever happened here, nothing carries back' }, c.note) : null),
      c.advice ? h('p', { class: 'fg-advice' }, icon('star'), h('span', null, h('b', null, c.advice.head), ' ', c.advice.line)) : null,
      h('div', { class: 'u-res-foot fg-res-foot' },
        h('button', { type: 'button', class: 'u-btn is-go', 'data-move': 'again', title: 'The same loadout, the same level, at once (Enter)', onclick: () => act.fight() }, 'Again', ukey('Enter')),
        h('button', { type: 'button', class: 'u-btn', 'data-move': 'change', title: 'Put this away and pick another loadout: 1 to 5', onclick: () => putAway() }, 'Change loadout', ukey('1–5')),
        tryout ? h('button', { type: 'button', class: 'u-btn', 'data-move': 'back', title: `${tryout.back} (Esc)`, onclick: () => act.back() }, icon('back'), 'Back', ukey('Esc'))
          : h('button', { type: 'button', class: 'u-btn', 'data-move': 'away', title: 'Put the card away (Esc)', onclick: () => putAway() }, 'Put away', ukey('Esc'))));
  }
  function putAway() {
    S.cardGone = true;
    paint();
  }

  // ── THE ASK, mid-round: leaving drops the round. Built into the page (never the browser's dialog) ────────────────
  function paintAsk() {
    el.ask.hidden = !S.ask;
    if (!S.ask || el.ask.childElementCount) return;
    fill(el.ask,
      h('div', { class: 'u-res-kick' }, upill('risk', 'warn', 'Leave the round?')),
      h('p', { class: 'fg-ask-t' }, `${tryout?.back ?? 'Back'}: this round is dropped. Nothing of it counts either way.`),
      h('div', { class: 'u-res-foot' },
        h('button', { type: 'button', class: 'u-btn is-go', 'data-ask': 'go', onclick: () => act.back(true) }, tryout?.back ?? 'Back', ukey('Esc')),
        h('button', { type: 'button', class: 'u-btn', 'data-ask': 'stay', onclick: () => act.stay() }, 'Stay and fight', ukey('Enter'))));
  }

  function paint() {
    if (S.dead) return;
    const s = now();
    if (ROUND.has(s.phase)) S.build = false;
    paintWhere(s);
    paintTable(s);
    paintDock(s);
    paintCard(s);
    paintAsk();
    const size = sizeNow();
    for (const z of SIZES) root.classList.toggle(`u-size-${z}`, z === size);
    root.classList.toggle('is-round', ROUND.has(s.phase));
    el.back.hidden = size !== 'hidden';
    // (where the corner cards end and the dock begins, for what lies under and over them: ui.css)
    root.style.setProperty('--rn-card-h', `${Math.ceil(el.dock.offsetHeight)}px`);
  }

  return {
    root,
    el,
    paint,
    toast,
    cycleSize,
    sizeNow,
    /** Every picture: the meters while a round is on (each redrawn only when its numbers change). */
    frame() {
      if (S.dead) return;
      const s = now();
      if (ROUND.has(s.phase)) paintMeters(s);
    },
    /** A round starts: the card of the last one goes, and any list. */
    begin() {
      S.cardGone = false;
      S.build = false;
      S.ask = false;
      el.ask.replaceChildren();
      paint();
    },
    /** The round is over: its card comes up. */
    over() {
      S.cardGone = false;
      paint();
    },
    get cardUp() {
      return now().phase === 'over' && !!now().R && !S.cardGone;
    },
    putAway,
    toggleBuild,
    get buildOpen() {
      return S.build;
    },
    /** ↑ ↓ along the build list; Enter takes or drops the row. → true when the list had it. */
    buildKey(code) {
      if (!S.build) return false;
      const rows = buildRows(now().pick);
      if (code === 'ArrowUp' || code === 'ArrowDown') {
        S.buildAt = (S.buildAt + (code === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
        paint();
        return true;
      }
      if (code === 'Enter' || code === 'NumpadEnter') {
        rows[S.buildAt]?.fn();
        return true;
      }
      return false;
    },
    toggleResults: () => fold('results'),
    toggleDock: () => fold('dock'),
    /** The ask before leaving a round: up or not. */
    ask(on) {
      S.ask = !!on;
      if (!on) el.ask.replaceChildren();
      paint();
    },
    get asking() {
      return S.ask;
    },
    dispose() {
      S.dead = true;
      root.remove();
    },
  };
}
