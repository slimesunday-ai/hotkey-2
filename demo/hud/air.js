// What plays over the scene while an hour runs (SPEC 24.6 and 24.7):
//   out loud          a white bubble over the speaker's head
//   a private message a phone chip between the two agents; sealed (no words) for anyone who may not read it
//   a confessional    a lower-third caption with the speaker's face
//   a roll            the odds bar again, with a needle landing on the number rolled; the same for the plain chance
//                     an hour of risky work carries (a bust, a blow-up, a sting)
// Bubbles and chips ask the stage where a head is (stage.screenOf) and stay inside the gap the panels leave.

import { h, face, clsTag, barEl, legendEl, chipsEl } from './dom.js';
import { barOf, riskBarOf, needleOf, riskNeedleOf, marginOf, riskMarginOf, BAND_WORDS, nameOf } from './logic.js';
import { chances } from '../../src/contest.mjs';

const VERBS = {
  rob: 'robs', fight: 'fights', collect: 'collects from', 'break-in': 'breaks into the pad of', 'break-in at the door': 'breaks in on',
  turf: 'fights for the corner of', 'a challenge for the chair': 'challenges', 'the night job': 'try the pad of',
};

const RISK_VERBS = {
  'a blow-up': ['cook a batch', 'cooks a batch'], 'a bust': ['run goods in under police eyes', 'runs goods in under police eyes'], 'a sting': ['sell a gun on the street', 'sells a gun on the street'],
};

/** "KIM ROBS GIL", "THE DUNN BROTHERS vs KIM". */
export function rollTitle(roll, game, you) {
  const who = id => (id === you ? 'you' : nameOf(game, id));
  const agent = roll.attacker && game.state.agents[roll.attacker];
  if (agent) return `${who(roll.attacker)} ${roll.attacker === you ? (VERBS[roll.kind] ?? roll.kind).replace(/^(\w+?)s\b/, '$1') : VERBS[roll.kind] ?? roll.kind} ${who(roll.defender)}`;
  const side = roll.kind === 'the night job' ? 'the Dunn brothers' : roll.kind;
  return `${side} vs ${who(roll.defender)}`;
}

/** The result in the viewer's own terms: a robbery that worked is bad news when you were the one robbed. */
export function rollStamp(roll, game, you) {
  if (roll.defender === you) return { clean: 'they got you', messy: 'they got you, just', fail: 'you held them off', disaster: 'they blew it' }[roll.outcome];
  if (roll.attacker === you) return BAND_WORDS[roll.outcome];
  const agent = roll.attacker && game.state.agents[roll.attacker];
  return `${agent ? agent.name : roll.kind === 'the night job' ? 'the Dunn brothers' : roll.kind}: ${BAND_WORDS[roll.outcome]}`;
}

export function createAir(root, ctx) {
  const layer = h('div', { class: 'hk-air', 'aria-hidden': 'true' });
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lines.setAttribute('class', 'hk-air-lines');
  layer.append(lines);
  const rollSlot = h('div', { class: 'hk-roll-slot' });
  const lower = h('div', { class: 'hk-lower-slot' });
  root.append(layer, rollSlot, lower);

  // everything in the air right now: { el, place() }
  const live = new Set();
  let raf = 0;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Put a box of the element's size near a point, inside the safe gap and clear of the boxes already up. */
  function settle(el, x, y, taken) {
    const safe = ctx.safe();
    const w = el.offsetWidth;
    const hh = el.offsetHeight;
    let px = clamp(x - w / 2, safe.left, Math.max(safe.left, safe.right - w));
    let py = clamp(y - hh, safe.top, Math.max(safe.top, safe.bottom - hh));
    for (let tries = 0; tries < 6; tries++) {
      const hit = taken.find(r => px < r.x + r.w && px + w > r.x && py < r.y + r.h && py + hh > r.y);
      if (!hit) break;
      py = hit.y - hh - 6 >= safe.top ? hit.y - hh - 6 : hit.y + hit.h + 6;
    }
    taken.push({ x: px, y: py, w, h: hh });
    el.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px)`;
    return { x: px, y: py, w, h: hh };
  }

  function frame() {
    raf = 0;
    if (!live.size) return;
    const taken = [];
    for (const item of live) item.place(taken);
    raf = requestAnimationFrame(frame);
  }
  const kick = () => {
    if (!raf && live.size) raf = requestAnimationFrame(frame);
  };

  async function hold(item, ms) {
    live.add(item);
    layer.append(item.el);
    item.place([...live].filter(x => x !== item && x.box).map(x => x.box));
    item.el.classList.add('is-on');
    kick();
    await ctx.wait(ms);
    item.el.classList.remove('is-on');
    live.delete(item);
    item.line?.remove();
    setTimeout(() => item.el.remove(), 200);
  }

  const readTime = text => Math.max(2400, Math.min(5200, 1200 + String(text ?? '').length * 45));

  /** Out loud: a white bubble over the speaker. */
  function say({ from, to, text }) {
    const el = h('div', { class: `hk-bubble${from === ctx.you ? ' is-you' : ''}` }, h('b', null, from === ctx.you && ctx.mode === 'play' ? 'You' : nameOf(ctx.game, from), to ? h('i', null, ` to ${to === ctx.you ? 'you' : nameOf(ctx.game, to)}`) : null), h('span', null, text));
    const item = {
      el, box: null,
      place(taken) {
        const p = ctx.stage.screenOf(from) ?? { visible: false };
        const safe = ctx.safe();
        el.classList.toggle('is-away', !p.visible);
        item.box = settle(el, p.visible ? p.x : safe.left + 140, p.visible ? p.y - 12 : safe.top + 60, taken);
      },
    };
    return hold(item, readTime(text));
  }

  /** A private message: a phone chip between the two, with its words only when the viewer may read them. */
  function phone({ from, to, text }) {
    const sealed = text === null;
    const who = id => (id === ctx.you ? 'you' : nameOf(ctx.game, id));
    const head = sealed ? `${who(from)} is texting` : `${who(from)} to ${who(to)}`;
    const el = h('div', { class: `hk-phone${sealed ? ' is-sealed' : ''}` },
      h('b', null, h('i', { class: 'hk-phone-icon' }), head, h('em', null, sealed ? 'private' : 'private message')),
      sealed ? null : h('span', null, text));
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'hk-air-line');
    if (!sealed) lines.append(line);
    const item = {
      el, box: null, line,
      place(taken) {
        const a = ctx.stage.screenOf(from) ?? { visible: false };
        const b = to ? ctx.stage.screenOf(to) ?? { visible: false } : { visible: false };
        const safe = ctx.safe();
        const both = a.visible && b.visible;
        const at = both ? { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 26 } : a.visible ? { x: a.x + 30, y: a.y - 10 } : b.visible ? { x: b.x + 30, y: b.y - 10 } : { x: safe.right - 150, y: safe.top + 60 };
        item.box = settle(el, at.x, at.y, taken);
        if (both) {
          line.setAttribute('x1', a.x);
          line.setAttribute('y1', a.y);
          line.setAttribute('x2', b.x);
          line.setAttribute('y2', b.y);
        }
        line.style.display = both ? '' : 'none';
      },
    };
    return hold(item, readTime(text ?? ''));
  }

  /** A confessional: a lower-third caption with the speaker's face. One at a time. */
  let confessing = Promise.resolve();
  function confess({ from, text }) {
    const agent = ctx.game.state.agents[from];
    confessing = confessing.then(async () => {
      const el = h('div', { class: 'hk-lower' },
        face(ctx, from, 'is-big'),
        h('div', { class: 'hk-lower-text' },
          h('div', { class: 'hk-lower-who' }, h('b', null, agent.name), clsTag(agent.cls), h('em', null, from === ctx.you ? 'your agent, to the camera' : 'to the camera')),
          h('p', null, `“${text}”`)));
      lower.replaceChildren(el);
      // low and to the left, clear of the speaker
      const safe = ctx.safe();
      const head = ctx.stage.screenOf(from);
      const low = safe.bottom - el.offsetHeight;
      const hidden = head?.visible && head.x < safe.left + el.offsetWidth + 30 && head.y + 90 > low;
      el.style.left = `${Math.round(hidden ? Math.max(safe.left, safe.right - el.offsetWidth) : safe.left)}px`;
      el.style.top = `${Math.round(low)}px`;
      requestAnimationFrame(() => el.classList.add('is-on'));
      await ctx.wait(Math.max(2600, readTime(text) - 400));
      el.classList.remove('is-on');
      await ctx.wait(180);
      if (el.parentNode) el.remove();
    });
    return confessing;
  }

  /**
   * Where a card of w × h may sit so that it hides none of `people`: top centre first, then the top corners, then low
   * centre and the lower corners. Falls back to the top centre when everyone is everywhere.
   */
  function clearSpot(w, hh, people) {
    const safe = ctx.safe();
    const heads = people.map(id => ctx.stage.screenOf(id)).filter(p => p?.visible);
    const cx = (safe.left + safe.right) / 2 - w / 2;
    const spots = [[cx, safe.top], [safe.left, safe.top], [safe.right - w, safe.top], [cx, safe.bottom - hh], [safe.left, safe.bottom - hh], [safe.right - w, safe.bottom - hh]];
    // a head, and the body under it: a person is about 90 px tall on screen
    const hides = ([x, y]) => heads.some(p => p.x > x - 30 && p.x < x + w + 30 && p.y + 90 > y - 10 && p.y - 20 < y + hh);
    const [x, y] = spots.find(s => !hides(s)) ?? spots[0];
    return { x: Math.round(Math.max(4, x)), y: Math.round(Math.max(4, y)) };
  }

  /** A card with a bar on it: the needle makes two passes, slows into its place, and the result is stamped. */
  async function land({ title, pct, segments, at, band, result, extra = null, people = [] }, slot) {
    const bar = barEl(segments);
    const needle = h('span', { class: 'hk-needle' });
    bar.append(needle);
    const el = h('div', { class: 'hk-roll', 'data-band': band },
      h('div', { class: 'hk-roll-head' }, h('b', null, title), h('span', { class: 'hk-pct' }, pct)),
      bar, legendEl(segments), result, extra);
    rollSlot.replaceChildren(el);
    const spot = clearSpot(el.offsetWidth, el.offsetHeight, people);
    el.style.left = `${spot.x}px`;
    el.style.top = `${spot.y}px`;
    requestAnimationFrame(() => el.classList.add('is-on'));
    const sweep = Math.min(1300, slot * 0.46);
    const speed = Math.max(0.25, ctx.speed());
    const anim = needle.animate(
      [{ left: '0%', offset: 0 }, { left: '100%', offset: 0.3 }, { left: '0%', offset: 0.55 }, { left: `${Math.max(0, Math.min(100, at + (at > 82 ? -18 : 18)))}%`, offset: 0.8 }, { left: `${at}%`, offset: 1 }],
      { duration: sweep / speed, easing: 'cubic-bezier(.3, .6, .3, 1)', fill: 'forwards' });
    ctx.onPause(paused => (paused ? anim.pause() : anim.play()), el);
    await ctx.wait(sweep);
    anim.finish();
    needle.style.left = `${at}%`;
    el.classList.add('is-landed');
    await ctx.wait(Math.max(900, slot - sweep - 250));
    el.classList.remove('is-on');
    setTimeout(() => {
      if (el.parentNode) el.remove();
    }, 220);
  }

  /** A contest's roll. `slot` is how long it has, at 1×. */
  function roll(r, slot = 2800) {
    const margin = marginOf(r);
    return land({
      title: rollTitle(r, ctx.game, ctx.you), pct: `${r.P}%`, segments: barOf(chances(ctx.game.cfg, r.P)), at: needleOf(r.roll), band: r.outcome,
      result: h('div', { class: 'hk-roll-result' }, h('div', { class: 'hk-roll-stamp', 'data-band': r.outcome }, rollStamp(r, ctx.game, ctx.you)),
        h('span', null, `rolled ${r.roll}, needed under ${r.P}: `, h('b', null, margin.won ? `made it by ${margin.by}` : `missed by ${margin.by}`), margin.by <= 5 ? h('em', null, 'close') : null)),
      extra: chipsEl(r.why), people: [r.attacker, r.defender].filter(id => id && ctx.game.state.agents[id]),
    }, slot);
  }

  /** The plain chance on an hour of risky work: the same bar in two parts, and the same needle. */
  function risk(r, slot = 2800) {
    const mine = r.agent === ctx.you && ctx.mode === 'play';
    const verbs = RISK_VERBS[r.what] ?? ['take a chance', 'takes a chance'];
    const margin = riskMarginOf(r);
    const band = r.hit ? 'disaster' : 'clean';
    return land({
      title: `${mine ? 'you' : nameOf(ctx.game, r.agent)} ${verbs[mine ? 0 : 1]}`, pct: `${r.chance}% risk`, segments: riskBarOf({ pct: r.chance, what: r.what }), at: riskNeedleOf(r.roll), band,
      result: h('div', { class: 'hk-roll-result' }, h('div', { class: 'hk-roll-stamp', 'data-band': band }, r.hit ? r.what.replace(/^an? /, '') : 'went fine'),
        h('span', null, `rolled ${r.roll}, ${r.what} under ${r.chance}: `, h('b', null, r.hit ? `caught by ${margin.by}` : `clear by ${margin.by}`), margin.by <= 5 ? h('em', null, 'close') : null)),
      people: [r.agent],
    }, slot);
  }

  function clear() {
    for (const item of live) {
      item.el.remove();
      item.line?.remove();
    }
    live.clear();
    rollSlot.replaceChildren();
    lower.replaceChildren();
  }

  return { say, phone, confess, roll, risk, clear, layer, rollSlot, lower };
}
