// THE POT'S SCREEN (pot-2; Cook on the dock, or P): the crafting plan's first screen (B10, "1. The pot"), one decision.
// On the left, ON YOUR SHELF: what you cook with, each a line with its colour and how many are at home (a click puts it
// in the pot, again takes it out), what you have none of greyed with who sells it and where; under it the one line
// that says the strongest reason to cook today; and your bags, each with its colours, on you and at home, the belt at
// the crib. In the middle, IN THE POT: its two places. On the right, THE LABEL, which rewrites itself as things go in:
// the name (a mix of two is yours to name, once you have cooked it), what it does in the effect's own numbered words,
// how a batch can come out, the smell after, the hour and the energy, and Cook. ↑ ↓ walk what the pot could take
// (each set fills it), Enter cooks, Esc closes. Every word and number is the rules' (view.pot, view.make): nothing is
// worked out here but which set is in the pot.
//
//   const pot = createPot({ cfg, now, act })
//     now() → { v, choosing }
//     act   { pick(key|null), go(key), send(choice) → bool, toast(text), keyFor(key) }
//   pot.head · pot.lead · pot.body       the parts, placed by the page (index.js paintSheet)
//   pot.open() · pot.paint() · pot.arrow(key) · pot.owns(el) · pot.editing · pot.with · pot.put(item)
//   madeRows(cfg, v, { choosing, go })    the bags and what you cook with, as the Stuff panel's row (panels.js)
import { h, fill } from '../hud/dom.js';
import { icon } from './icons.js';

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** A making's or a product's colours, as small squares: the family's colour (config make.families: downer blue, trip violet). */
export const chipsEl = (colours = [], families = []) => h('span', { class: 'u-pot-chips', 'aria-hidden': 'true' },
  colours.map((c, i) => h('i', { class: `u-pot-chip is-${c ?? 'none'}`, title: families[i] ?? '' })));
/** A name may be these, the rules' own (step.mjs nameIt): 1 to `max` letters, numbers, spaces and ' & ! . , ? - */
const NAME_OK = /^[\p{L}\p{N} '&!.,?-]+$/u;

/**
 * WHAT YOU HAVE (B10, "What he has: the shelf"): one short row of each made thing (its name, its colours, on you and at
 * home, the belt at the crib) and one of what you cook with (its colour and how many), for the Stuff panel and the
 * pot's own shelf. `go(key)`: a rules' choice made at once (the belt).
 */
export function madeRows(cfg, v, { choosing = false, go = null, compact = false, makings = true, nameFor = null } = {}) {
  const K = v.make?.makers?.[0];
  if (!K) return null;
  const shelf = K.shelf;
  const belt = v.make.belt;
  const beltOn = good => (v.choices ?? []).find(c => c.choice.do === 'belt' && c.choice.good === good);
  const beltOff = (v.choices ?? []).find(c => c.choice.do === 'unbelt');
  const made = shelf.made.map(r => {
    const on = beltOn(r.good);
    const onBelt = belt?.good === r.good;
    const naming = nameFor?.(r) ?? null;
    if (naming?.editing) return h('li', { class: 'u-pot-made is-naming', 'data-good': r.good }, naming.el);
    return h('li', { class: `u-pot-made${r.dirty ? ' is-dirty' : ''}`, 'data-good': r.good },
      h('span', { class: 'u-pot-made-name' }, chipsEl(r.colours, r.families), h('b', null, r.name), naming?.el ?? null),
      h('span', { class: 'u-pot-count' }, `${r.on} on you · ${r.home} at home`),
      onBelt ? h('span', { class: 'u-pot-belt' }, icon('belt'), 'on your belt',
        beltOff && choosing && go ? h('button', { type: 'button', class: 'u-btn is-quiet', 'data-act': 'unbelt', title: `${beltOff.label}: free`, onclick: () => go(beltOff.key) }, 'Take off') : null)
        : on && choosing && go && !belt ? h('button', { type: 'button', class: 'u-btn is-quiet u-pot-beltbtn', 'data-act': 'belt', title: `${on.label}: free`, onclick: () => go(on.key) }, icon('belt'), 'On your belt') : null);
  });
  const ins = (makings ? shelf.makings : []).filter(m => m.on + m.home > 0).map(m => h('li', { class: 'u-pot-in', 'data-making': m.item },
    h('span', { class: 'u-pot-made-name' }, chipsEl([m.colour], [m.family]), h('b', null, cap(m.label))),
    h('span', { class: 'u-pot-count' }, `${m.on} on you · ${m.home} at home`)));
  if (!made.length && !ins.length) return null;
  return h('ul', { class: `u-pot-rows${compact ? ' is-compact' : ''}` }, made, ins);
}

export function createPot({ cfg, now, act }) {
  // what is in the pot (makings, sorted), what is being named (a product) and the words so far
  let inPot = [];
  let naming = null;
  let sig = null;
  // (after a cook the pot is filled again with the first set it could take, once: never while the player empties it)
  let refill = false;
  const head = h('div', { class: 'u-pot-head' });
  const lead = h('div', { class: 'u-pot-lead' });
  const body = h('div', { class: 'u-pot', role: 'group', 'aria-label': 'The pot' });
  const input = h('input', { type: 'text', class: 'u-pot-name-in', maxlength: String(cfg.make?.names?.max ?? 24), 'aria-label': 'A name for it', spellcheck: 'false', autocomplete: 'off' });
  const said = h('small', { class: 'u-pot-name-why', 'aria-live': 'polite' });
  input.addEventListener('keydown', e => {
    // (the page's keys never see these: index.js onKey lets a key typed into a box be the box's)
    if (e.key === 'Enter') {
      e.preventDefault();
      saveName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      stopNaming();
    }
  });

  const keyOf = w => [...w].sort().join('+');
  const optionOf = (v, w = inPot) => (v.pot?.options ?? []).find(o => keyOf(o.with) === keyOf(w)) ?? null;
  /** The set in the pot now, kept to what is still at home (after a cook, what ran out comes out). */
  function keep(v) {
    const have = new Set((v.pot?.shelf?.makings ?? []).filter(m => m.home > 0).map(m => m.item));
    inPot = inPot.filter(k => have.has(k));
  }
  /** The dock's main button names the cook of what is in the pot (Enter does it); nothing in it, nothing picked. */
  function pickNow(v) {
    const o = optionOf(v);
    act.pick(o?.key ?? null);
  }
  /** A making on the shelf, put in the pot or taken out (the pot full, it takes the place of the last one put in). */
  function put(item) {
    const n0 = now();
    const v = n0.v;
    const m = v.pot?.shelf?.makings.find(x => x.item === item);
    if (!m) return;
    const slots = v.pot.carrier?.slots ?? 2;
    if (inPot.includes(item)) inPot = inPot.filter(k => k !== item);
    else if (!m.home) return act.toast(m.on ? `${cap(m.label)}: what is on you goes home when you go in` : `No ${m.label} at home: ${(v.pot.missing.find(x => x.item === item)?.text ?? '').replace(/^[^:]*:\s*/, '')}`);
    else inPot = [...(inPot.length >= slots ? inPot.slice(0, slots - 1) : inPot), item].sort();
    sig = null;
    pickNow(v);
  }
  /** ↑ ↓: the next set the pot could take now (each fills it). */
  function arrow(key) {
    if (key !== 'ArrowUp' && key !== 'ArrowDown') return false;
    const v = now().v;
    const list = v.pot?.options ?? [];
    if (!list.length) return act.toast(v.pot?.reason?.text ?? 'Nothing at home to cook'), true;
    const i = list.findIndex(o => keyOf(o.with) === keyOf(inPot));
    const j = i < 0 ? 0 : (i + (key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
    inPot = [...list[j].with];
    sig = null;
    pickNow(v);
    return true;
  }
  /** Opened: the pot as it was left, or the first set it could take, so the label has something to say at once. */
  function open() {
    const v = now().v;
    keep(v);
    if (!inPot.length && v.pot?.options?.length) inPot = [...v.pot.options[0].with];
    naming = null;
    sig = null;
    pickNow(v);
  }

  // ── naming a mix ──
  function startNaming(product, name) {
    naming = product;
    input.value = name;
    said.textContent = '';
    sig = null;
    paint();
    input.focus();
    input.select();
  }
  function stopNaming() {
    naming = null;
    sig = null;
    paint();
    body.querySelector('[data-act="name"]')?.focus({ preventScroll: true });
  }
  function saveName() {
    const v = now().v;
    const c = (v.choices ?? []).find(x => x.choice.do === 'name' && x.choice.product === naming);
    const text = input.value.replace(/\s+/g, ' ').trim();
    const max = c?.max ?? cfg.make?.names?.max ?? 24;
    if (!c) return void (said.textContent = 'Not now');
    if (!text || text.length > max || !NAME_OK.test(text)) return void (said.textContent = `1 to ${max} letters, numbers, spaces and ' & ! . , ? -`);
    if (text === c.name) return stopNaming();
    if (!act.send({ ...c.choice, name: text })) return void (said.textContent = 'When this hour is over');
    naming = null;
    sig = null;
  }

  // ── the parts ──
  /** The box a name is typed in, with its two buttons and why a name will not do. */
  const editorEl = () => h('div', { class: 'u-pot-naming' }, input,
    h('div', { class: 'u-pot-naming-acts' },
      h('button', { type: 'button', class: 'u-btn is-go', 'data-act': 'save-name', onclick: () => saveName() }, 'Call it that', h('kbd', { class: 'u-key' }, 'Enter')),
      h('button', { type: 'button', class: 'u-btn is-quiet', onclick: () => stopNaming() }, 'Keep it', h('kbd', { class: 'u-key' }, 'Esc'))),
    said);
  function shelfEl(v, n0) {
    const P = v.pot;
    const rows = P.shelf.makings.map(m => {
      const inIt = inPot.includes(m.item);
      const none = !m.home;
      const miss = P.missing.find(x => x.item === m.item);
      const where = miss ? miss.text.replace(/^[^:]*:\s*/, '') : null;
      return h('li', null, h('button', {
        type: 'button', class: `u-pot-thing${inIt ? ' is-in' : ''}${none ? ' is-none' : ''}`, 'data-making': m.item, 'aria-pressed': String(inIt),
        title: none ? `${cap(m.label)}: none at home. ${where ?? ''}` : `${cap(m.label)}: ${m.home} at home${m.on ? `, ${m.on} on you` : ''}. ${inIt ? 'In the pot: a click takes it out' : 'A click puts it in the pot'}`,
        onclick: () => put(m.item),
      }, chipsEl([m.colour], [m.family]), h('span', { class: 'u-pot-thing-t' }, h('b', null, cap(m.label)), none ? h('small', null, where ?? 'none at home') : h('small', null, `${m.home} at home${m.on ? ` · ${m.on} on you` : ''}`)),
      inIt ? h('span', { class: 'u-pot-mark' }, icon('check')) : none ? null : h('span', { class: 'u-pot-count' }, `×${m.home}`)));
    });
    // (a mix you have cooked is yours to name from its row too, under the pot: once the pot is empty, its label is gone)
    return h('section', { class: 'u-pot-col u-pot-shelf' },
      h('h3', { class: 'u-cap' }, 'On your shelf'),
      h('ul', { class: 'u-pot-list' }, rows),
      h('p', { class: `u-pot-reason is-${P.reason.why}` }, icon(P.reason.why === 'station' || P.reason.why === 'empty' ? 'shop' : P.reason.why === 'blank' ? 'star' : 'pot'),
        h('span', { title: P.reason.text }, P.reason.why === 'empty' ? 'Nothing at home to cook with: the greyed ones say who sells them, and where.' : P.reason.text)));
  }
  function potEl(v, o, n0) {
    const P = v.pot;
    // (your bags under the pot: what came out of it)
    const inLabel = o?.product ?? null;
    const nameFor = r => {
      const c = (v.choices ?? []).find(x => x.choice.do === 'name' && x.choice.product === r.product);
      if (!c || inLabel === r.product) return null;
      return naming === r.product ? { editing: true, el: editorEl() } : { el: h('button', { type: 'button', class: 'u-btn is-quiet', 'data-act': 'name', 'data-product': r.product, title: `Give ${r.name} a name of your own: free, any time. People say it back`, onclick: () => startNaming(r.product, c.name) }, 'Name it') };
    };
    const bags = madeRows(cfg, v, { choosing: n0.choosing, go: null, compact: true, makings: false, nameFor });
    const slots = P.carrier?.slots ?? 2;
    const X = cfg.make;
    return h('section', { class: 'u-pot-col u-pot-mid' },
      h('h3', { class: 'u-cap' }, 'In the pot'),
      h('div', { class: 'u-pot-slots' }, Array.from({ length: slots }, (_, i) => {
        const k = inPot[i];
        const m = k ? P.shelf.makings.find(x => x.item === k) : null;
        return m ? h('button', { type: 'button', class: 'u-pot-slot is-full', 'data-slot': String(i), title: `${cap(m.label)}: a click takes it out`, onclick: () => put(k) },
          chipsEl([m.colour], [m.family]), h('b', null, cap(m.label)), h('span', { class: 'u-pot-x', 'aria-hidden': 'true' }, '×'))
          : h('div', { class: 'u-pot-slot is-empty', 'data-slot': String(i) }, 'empty');
      })),
      h('p', { class: 'u-pot-into' }, icon('pot'), h('span', null, `${P.carrier?.n ?? 6} ${X.kinds?.[P.carrier?.gives]?.unit ?? 'bag'}s come out`)),
      h('p', { class: 'u-pot-hint' }, o ? '↑ ↓ the next set' : 'Click what goes in, or ↑ ↓'),
      bags ? h('h3', { class: 'u-cap' }, 'Your bags') : null,
      bags);
  }
  function labelEl(v, o, n0) {
    const P = v.pot;
    const X = cfg.make;
    if (!P.station?.owned) {
      return h('section', { class: 'u-pot-col u-pot-label is-none' }, h('h3', { class: 'u-cap' }, 'The label'),
        h('p', { class: 'u-pot-empty' }, P.reason.text));
    }
    if (!o) {
      return h('section', { class: 'u-pot-col u-pot-label is-none' }, h('h3', { class: 'u-cap' }, 'The label'),
        h('p', { class: 'u-pot-empty' }, P.options.length ? 'Put something in the pot: the label says what it makes.' : 'Nothing in the pot.'),
        h('p', { class: 'u-pot-odds' }, P.odds.text));
    }
    const c = (v.choices ?? []).find(x => x.key === o.key);
    const nameC = (v.choices ?? []).find(x => x.choice.do === 'name' && x.choice.product === o.product);
    const families = o.families ?? [];
    const colours = families.map(f => X.families?.[f] ?? null);
    const editing = naming === o.product && nameC;
    const smell = o.smell?.level ? `HOME +${o.smell.level} until day ${o.smell.until}` : 'nothing on HOME: the fan blows it down the lane';
    return h('section', { class: 'u-pot-col u-pot-label', 'data-product': o.product },
      h('h3', { class: 'u-cap' }, 'The label'),
      editing
        ? editorEl()
        : h('div', { class: 'u-pot-title' }, chipsEl(colours, families), h('b', { class: 'u-pot-name' }, o.name),
          nameC ? h('button', { type: 'button', class: 'u-btn is-quiet', 'data-act': 'name', title: `Give ${o.name} a name of your own: free, any time. People say it back`, onclick: () => startNaming(o.product, nameC.name) }, 'Name it')
            : o.with.length > 1 ? h('small', { class: 'u-pot-note' }, 'yours to name once cooked') : null),
      h('p', { class: 'u-pot-sub' }, `${cap(o.rarity)} · ${o.bags} ${X.kinds?.[o.kind]?.unit ?? 'bag'}s${o.found ? '' : ' · never cooked: new in your book'}`),
      h('ol', { class: 'u-pot-lines' }, o.lines.map(l => h('li', null, l))),
      h('dl', { class: 'u-pot-facts' },
        h('dt', null, 'Comes out'), h('dd', { title: o.odds.why?.length ? cap(o.odds.why.join('; ')) : '' }, `clean ${o.odds.clean} · dirty ${o.odds.dirty} · something else ${o.odds.extra}`, o.odds.tired ? h('span', { class: 'u-pill is-risk' }, 'tired') : null),
        h('dt', null, 'The smell'), h('dd', null, smell),
        h('dt', null, 'It takes'), h('dd', null, `${P.hours === 1 ? '1 hour' : plural(P.hours, 'hour')} · energy ${P.energy.now} → ${P.energy.after}`)),
      h('button', {
        type: 'button', class: `u-btn u-pot-cook${c?.available && n0.choosing ? ' is-go' : ''}`, 'data-act': 'cook', 'aria-disabled': c?.available && n0.choosing ? null : 'true',
        title: c ? (c.available ? `${c.label} (Enter)` : `${c.label}: ${c.why}`) : o.why ?? 'not here',
        onclick: () => (c?.available && n0.choosing ? act.go(c.key) : act.toast(cap(c?.why ?? o.why ?? 'not now'))),
      }, icon('pot'), h('span', null, `Cook ${o.name}`), c?.available ? h('kbd', { class: 'u-key' }, 'Enter') : h('small', null, c?.why ?? o.why ?? 'not here')));
  }

  function paint() {
    const n0 = now();
    const v = n0.v;
    if (!v?.pot) return;
    keep(v);
    const o = optionOf(v);
    const s = JSON.stringify([v.pot, v.make?.belt, (v.choices ?? []).filter(c => ['cook', 'name', 'belt', 'unbelt'].includes(c.choice.do)).map(c => [c.key, c.available]), inPot, naming, n0.choosing]);
    if (s === sig) return;
    sig = s;
    const P = v.pot;
    fill(head, h('span', { class: 'u-pot-hours' }, icon('clock'), `${P.hours === 1 ? '1 hour' : plural(P.hours, 'hour')}`, icon('energy'), `energy ${P.energy.now} → ${P.energy.after}`));
    fill(lead, h('p', { class: 'u-pot-where' }, P.open ? `At your crib, on ${P.station.label.replace(/^an? /, 'the ')}.` : !P.station?.owned ? 'No hot plate yet.' : P.station.out ? `${cap(P.station.label.replace(/^an? /, 'the '))} is smashed: no use until day ${P.station.out + 1}.` : 'You cook at your crib (H, home).'));
    fill(body, shelfEl(v, n0), potEl(v, o, n0), labelEl(v, o, n0));
  }

  return {
    head, lead, body,
    open, paint, arrow, put,
    /** For the page's keys: true while a name is typed (the box's own keys). */
    get editing() {
      return !!naming;
    },
    get with() {
      return [...inPot];
    },
    owns: el => !!el && (body.contains(el) || lead.contains(el)),
    /** The rules' key of the cook of what is in the pot now (null: nothing in it, or nothing it could take). */
    keyNow(v) {
      keep(v);
      if (refill && !inPot.length && v.pot?.options?.length) inPot = [...v.pot.options[0].with];
      refill = false;
      return optionOf(v)?.key ?? null;
    },
    /** After a step: the pot keeps what is still at home; a name typed is done. */
    stepped() {
      naming = null;
      sig = null;
      refill = true;
    },
  };
}
