// Small DOM pieces every HUD screen uses: the root in the kit's skin, a face for an agent, the odds bar and its chips.
// The look is the owner's UI kit (city/from-trunk/style/city/ui/kit.css, skin "zte"); nothing here names a colour.

import { h } from '../../city/from-trunk/style/city/ui/kit.js';
import { barOf, riskBarOf, chipsOf, needleOf, BAND_WORDS, SEAT_TEXT } from './logic.js';

export { h };

const KIT = new URL('../../city/from-trunk/style/city/ui/', import.meta.url);
const SPACE_MONO = 'https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap';

/** Load the kit's stylesheet, ours, and the zte skin's two faces. Safe to call twice. */
export function ensureStyles() {
  const link = (href, mark) => {
    if (document.querySelector(`link[${mark}]`)) return;
    document.head.append(h('link', { rel: 'stylesheet', href, [mark]: '' }));
  };
  link(new URL('kit.css', KIT).href, 'data-k-css');
  link(new URL('./hud.css', import.meta.url).href, 'data-hk-css');
  link(SPACE_MONO, 'data-hk-font');
  // the city's own sign lettering, built in the browser by the kit; the skin falls back to the mono face without it
  import(new URL('signfont.js', KIT).href).then(m => m.loadSignFont()).catch(() => {});
}

/**
 * The HUD's root inside `host`. The kit styles everything under `#k`, so the HUD sits in one: fixed over the page,
 * with the mouse passing through wherever there is no panel. A host already inside a kit root uses that one.
 */
export function makeRoot(host) {
  let kit = host.closest?.('#k');
  if (!kit) {
    kit = h('div', { id: 'k', 'data-skin': 'zte' });
    host.append(kit);
  }
  const root = h('div', { class: 'hk' });
  kit.append(root);
  return root;
}

/** An agent's face: a tile in its class colour with its initial, and its real portrait over that when the stage has one. */
export function face(ctx, id, cls = '') {
  const agent = ctx.game.state.agents[id];
  const name = agent?.name ?? ctx.game.state.npcs?.[id]?.name ?? '?';
  const tile = h('span', { class: `hk-face ${cls}`, 'data-cls': agent?.cls ?? 'npc', 'aria-hidden': 'true' }, name[0]);
  if (id === ctx.you) tile.classList.add('is-you');
  const got = ctx.portraits.get(id);
  if (got) tile.style.backgroundImage = `url(${got})`;
  else if (got === undefined && ctx.stage?.portraitOf && agent) {
    ctx.portraits.set(id, null);
    Promise.resolve(ctx.stage.portraitOf(id)).then(url => {
      if (!url) return;
      ctx.portraits.set(id, url);
      for (const el of document.querySelectorAll(`.hk-face[data-id="${id}"]`)) el.style.backgroundImage = `url(${url})`;
    }).catch(() => {});
  }
  tile.dataset.id = id;
  return tile;
}

/** replaceChildren that skips what isn't there, so a screen can write `condition ? node : null` among its parts. */
export function fill(node, ...kids) {
  node.replaceChildren(...kids.flat(3).filter(k => k !== null && k !== undefined && k !== false));
  return node;
}

/** "robber", as a small tag in the class's colour. */
export function clsTag(cls) {
  return h('span', { class: 'hk-cls', 'data-cls': cls }, SEAT_TEXT[cls]?.[0] ?? cls);
}

/** The bar itself: segments, and a needle when there is a roll to land. */
export function barEl(segments, { small = false } = {}) {
  const bar = h('div', { class: `hk-bar${small ? ' is-small' : ''}`, role: 'img' });
  for (const s of segments) {
    if (s.pct <= 0) continue;
    bar.append(h('span', { class: 'hk-seg', 'data-band': s.key, style: `width:${s.pct}%` }));
  }
  bar.setAttribute('aria-label', segments.filter(s => s.pct > 0).map(s => `${s.label ?? BAND_WORDS[s.key]} ${Math.round(s.pct)}%`).join(', '));
  return bar;
}

/** The words under a bar: each outcome with its chance. */
export function legendEl(segments) {
  return h('div', { class: 'hk-legend' }, segments.filter(s => s.pct > 0).map(s => h('span', { 'data-band': s.key }, h('i'), `${s.label ?? BAND_WORDS[s.key]} `, h('b', null, `${Math.round(s.pct)}%`))));
}

/** Up to three reason chips, biggest first, and a count of the rest. */
export function chipsEl(why) {
  const { chips, more } = chipsOf(why);
  if (!chips.length) return h('div', { class: 'hk-chips' }, h('span', { class: 'hk-why is-flat' }, 'an even contest: nothing tilts it'));
  return h('div', { class: 'hk-chips' },
    chips.map(c => h('span', { class: `hk-why ${c.good ? 'is-good' : 'is-bad'}` }, h('b', null, `${c.good ? '+' : '−'}${c.value}`), ` ${c.label}`)),
    more ? h('span', { class: 'hk-why is-flat' }, `+${more} more`) : null);
}

/** The whole odds block for a menu entry: the win chance as a number, the bar, its legend and the reasons. */
export function oddsEl(entry) {
  if (typeof entry.odds === 'number') {
    const segments = barOf(entry.bands);
    return h('div', { class: 'hk-odds' },
      h('div', { class: 'hk-odds-head' }, h('b', { class: 'hk-pct' }, `${entry.odds}%`), h('span', null, 'to win')),
      barEl(segments), legendEl(segments), chipsEl(entry.why));
  }
  if (entry.risk) {
    const segments = riskBarOf(entry.risk);
    return h('div', { class: 'hk-odds' },
      h('div', { class: 'hk-odds-head' }, h('b', { class: 'hk-pct is-risk' }, `${entry.risk.pct}%`), h('span', null, `chance of ${entry.risk.what}`)),
      barEl(segments), legendEl(segments));
  }
  return null;
}

/** The small bar on a menu row: the chance at a glance, before the row is opened. */
export function miniOddsEl(entry) {
  if (typeof entry.odds === 'number') return h('span', { class: 'hk-mini' }, barEl(barOf(entry.bands), { small: true }), h('b', null, `${entry.odds}%`));
  if (entry.risk) return h('span', { class: 'hk-mini is-risk' }, barEl(riskBarOf(entry.risk), { small: true }), h('b', null, `${entry.risk.pct}%`));
  return null;
}

/** A needle on a bar, set where a roll lands. */
export function needleEl(roll) {
  return h('span', { class: 'hk-needle', style: `left:${needleOf(roll)}%` });
}
