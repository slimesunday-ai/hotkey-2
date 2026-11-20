// THE RUN'S MAP PANEL (M): the kit's own paper map of the island (city/from-trunk/style/city/ui/map/: the printed sheet,
// drag, the wheel and pinch, double-click, + − 0, the YOU pin), fed from the run by this small adapter, with the run's
// three stops and its line drawn over the sheet.
//
//   const map = createRunMap({ where, clock, stops, line, card })
//   map.el (the panel's body) · map.open() · map.close() · map.refresh() · map.isOpen · map.card(id | null)
//   map.closeOne() (Esc: a card first) · map.focusYou(s) · map.view · map.setView(v) · map.opening() · map.stats()
//     where()  → { x, z, label, indoors } where the player is now (the stage's own position of them), or null
//     clock()  → the run's time in game minutes
//     stops()  → [{ id, name, flag, x, z, here, locked, heat, hot, police }]   line() → { ride | rides, walks, locked, stations }
//              (heat, hot, police: the place's, rules-2; drawn on its flag. rose: heat that just landed, trust-1)
//     card(id) → { name, body: [nodes] }: what a stop pays, its danger, who is left there today
//
// THE KIT'S MAP WAS WRITTEN FOR THE CITY SIMULATION'S STORE. What it reads (ui/map/index.js mountMap(api, { sim,
// dossier, root })) and what the run gives it here:
//   sim      agents() and where(handle): the player alone, where the stage has them (sim.me: the YOU pin); events()
//            none and world().crews none (no stamps, no turf); clock().t the run's hour; on('tick') our repaint
//   dossier  open(handle), a click on a pin: the player's pin opens the card of the stop they are at
//   api      the city app's own (its toys, the picture it stops drawing behind a full-screen map, the camera Go there
//            flies): none. The picture keeps drawing beside the panel and nothing flies
//   root     our panel's body: the sheet goes in it (run.css takes it out of full screen, folds the legend down to the
//            scale, the north arrow and the zoom, and hides the parts of a place card that are the simulation's)
// The kit's hover label lives in the kit's own root, which only the kit's mountRoot makes: made the first time the
// map opens, without web fonts (the page has Space Mono already). NOTHING RUNS UNTIL THE FIRST OPEN (the kit's map is
// imported then); closed, the kit releases its canvases and timers, and our layer stops with it.

import { h } from '../hud/dom.js';
import { icon } from './icons.js';
// (tree-1: the stops' labels laid out so none lies on another or off the sheet, each tied to its stop: maplabels.js)
import { placeLabels } from './maplabels.js';

const UI = new URL('../../city/from-trunk/style/city/ui/', import.meta.url).href;
const ME = 'you';
/** The kit's rulers along the sheet's top and left edge (ui/map/paper.js RW): no label lies on them. */
const RULER = 18;

export function createRunMap({ where, clock, stops, line, card }) {
  const host = h('div', { class: 'rn-map' });
  let kit = null;
  let loading = null;
  let open = false;
  let raf = 0;
  let sig = '';
  let data = 0;
  let cv = null;
  let layer = null;
  let kitCard = null;
  let cardId = null;
  let downAt = null;
  let youClick = false;
  const flags = new Map();
  // (where each label was last laid, so it stays there while that still works: maplabels.js `keep`)
  const laid = new Map();
  const ticks = new Set();
  const cardEl = h('aside', { class: 'rn-stopcard', role: 'dialog', hidden: true });

  // ── what the kit's map reads, from the run ──────────────────────────────────────────────────────────────────────
  const youCard = () => {
    const w = where();
    return w ? { handle: ME, npc: false, cls: null, at: null, home: null, x: w.x, z: w.z, indoors: !!w.indoors, now: w.label ?? '', status: 'ok' } : null;
  };
  const sim = {
    me: ME,
    agents: () => [youCard()].filter(Boolean),
    where: hd => (hd === ME ? (c => c && { x: c.x, z: c.z })(youCard()) : null),
    agent: hd => (hd === ME ? { live: youCard() } : null),
    events: () => [],
    world: () => ({ crews: [] }),
    clock: () => ({ t: clock() }),
    on: (type, fn) => {
      if (type !== 'tick') return () => {};
      ticks.add(fn);
      return () => ticks.delete(fn);
    },
  };
  const dossier = {
    open: hd => {
      if (hd !== ME) return;
      const at = stops().find(s => s.here);
      youClick = true;
      if (at) showCard(at.id);
    },
  };

  async function load() {
    if (kit) return kit;
    loading ??= (async () => {
      // (the sheet's look first: the kit reads its colours off it the moment it opens)
      if (!document.querySelector('link[data-map-css]')) {
        const l = h('link', { rel: 'stylesheet', href: `${UI}map/map.css`, 'data-map-css': '' });
        const done = new Promise(r => {
          l.onload = r;
          l.onerror = r;
        });
        document.head.append(l);
        await done;
      }
      const [K, M] = await Promise.all([import(`${UI}kit.js`), import(`${UI}map/index.js`)]);
      if (!K.getRoot()) K.mountRoot(new URLSearchParams('ui=zte'), { fonts: false });
      kit = M.mountMap({}, { sim, dossier, root: host });
      return kit;
    })();
    return loading;
  }

  /** Our layer on the kit's sheet: the line under its pins (a canvas before its live one), the flags and the card over it. */
  function attach() {
    const mp = host.querySelector('section.mp');
    if (!mp || layer) return;
    const sheet = mp.querySelector('.mp-sheet');
    cv = h('canvas', { class: 'rn-map-line', 'aria-hidden': 'true' });
    sheet.insertBefore(cv, sheet.querySelector('.mp-live'));
    layer = h('div', { class: 'rn-map-over' }, cardEl);
    mp.append(layer);
    kitCard = mp.querySelector('.mp-card');
    // A CLICK ON A STOP'S POINT is ours: its card (the kit's own, for the city place under it, put away). A click on
    // open paper puts our card away, as it does the kit's
    sheet.addEventListener('pointerdown', e => {
      downAt = [e.clientX, e.clientY];
      youClick = false;
    });
    sheet.addEventListener('pointerup', e => {
      if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) return;
      downAt = null;
      const r = sheet.getBoundingClientRect();
      const [x, y] = [e.clientX - r.left, e.clientY - r.top];
      const hit = stops().map(s => [s, Math.hypot(...kit.screenOf(s.x, s.z).map((q, k) => q - [x, y][k]))]).filter(([, d]) => d < 13).sort((a, b) => a[1] - b[1])[0]?.[0];
      if (hit) {
        if (kitCard && !kitCard.hidden) kitCard.hidden = true;
        showCard(hit.id);
      } else if (!youClick) showCard(null);
      youClick = false;
    });
  }

  function flagOf(s) {
    let f = flags.get(s.id);
    if (!f) {
      f = { el: h('button', { type: 'button', class: 'rn-flag', 'data-stop': s.id, onclick: () => showCard(cardId === s.id ? null : s.id) }), key: '' };
      layer.append(f.el);
      flags.set(s.id, f);
    }
    const key = `${s.name}|${s.here}|${s.locked}|${cardId === s.id}|${s.hot}|${s.mark ?? ''}`;
    if (key !== f.key) {
      f.key = key;
      // (tree-1, the owner: "the text on this part of the map is a bit buggy": a label is the stop's NAME, and at most a
      // mark: locked, or hot (the police about because of what was done there). What it pays, its risk, its heat and
      // police are its card's, a click away. Where you are: yellow; the one picked: ink)
      const mark = s.locked ? h('i', { class: 'rn-flag-lock', 'aria-label': 'locked' }, icon('lock')) : s.hot ? h('i', { class: 'rn-flag-heat is-hot' }, 'hot') : null;
      f.el.replaceChildren(...[h('b', null, s.name), mark].filter(Boolean));
      f.el.className = `rn-flag${s.here ? ' is-here' : ''}${s.locked ? ' is-locked' : ''}${s.mark ? ` is-${s.mark}` : ''}${cardId === s.id ? ' is-on' : ''}`;
      // (join-1: a stop of the page's own, the try-out: its card says what it is)
      f.el.title = s.side ? `${s.name}: ${s.flag}` : `${s.name}${s.here ? ' (you are here)' : ''}: ${s.flag}${s.heat ? ` · heat ${s.heat}` : ''}${s.police ? ' · police about' : ''}. Its card: what it pays, its danger, who is left today`;
      f.el.setAttribute('aria-label', f.el.title);
    }
    return f;
  }

  function showCard(id) {
    cardId = id && stops().some(s => s.id === id) ? id : null;
    fillCard();
    sig = '';
    kick();
  }
  function fillCard() {
    cardEl.hidden = !cardId;
    if (!cardId) return;
    const c = card(cardId);
    cardEl.replaceChildren(
      h('header', null, h('b', null, c.name), h('button', { type: 'button', class: 'k-btn rn-stopcard-x', 'aria-label': 'Close the card (Esc)', title: 'Close (Esc)', onclick: () => showCard(null) }, '×')),
      ...c.body.filter(Boolean));
  }

  // ── drawing: only while open, and only when the view, the size or the run's data changed ──────────────────────────
  function kick() {
    if (!raf && open && kit?.isOpen) raf = requestAnimationFrame(frame);
  }
  function frame() {
    raf = 0;
    if (!open || !kit?.isOpen || !layer) return;
    const v = kit.view;
    const W = host.clientWidth;
    const H = host.clientHeight;
    if (v && W && H) {
      const now = [v.cx.toFixed(2), v.cz.toFixed(2), v.s.toFixed(4), W, H, data, cardId].join();
      if (now !== sig) {
        sig = now;
        draw(v, W, H);
      }
    }
    kick();
  }
  const css = k => getComputedStyle(host).getPropertyValue(k).trim();
  function draw(v, W, H) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const [w, hh] = [Math.round(W * dpr), Math.round(H * dpr)];
    if (cv.width !== w || cv.height !== hh) {
      cv.width = w;
      cv.height = hh;
      cv.style.width = `${W}px`;
      cv.style.height = `${H}px`;
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const P = (x, z) => kit.screenOf(x, z);
    const ink = css('--k-map-ink') || '#17171B';
    const halo = css('--k-map-halo') || '#F4F1EA';
    const core = css('--zt-lime') || '#6CFF4A';
    const slate = css('--zt-slate') || '#6D707A';
    const font = css('--k-map-font') || 'monospace';
    const L = line();
    const path = pts => {
      ctx.beginPath();
      pts.forEach(([x, z], k) => {
        const [a, b] = P(x, z);
        if (k) ctx.lineTo(a, b);
        else ctx.moveTo(a, b);
      });
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // the walks to and from the stations: ink, dashed; the corner's, locked: slate, dashed
    ctx.setLineDash([5, 5]);
    for (const seg of L.walks) {
      path(seg);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (const seg of L.locked) {
      path(seg);
      ctx.strokeStyle = slate;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // the ride: an ink casing, the line's colour inside, station to station (batch-1: one ride a place from the park's
    // stairs, `rides`; a single `ride` as before)
    for (const r of L.rides ?? [L.ride]) {
      path(r);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = core;
      ctx.lineWidth = 4.5;
      ctx.stroke();
    }
    // the stations: a paper disc in an ink ring, the name beside it
    ctx.font = `700 11px ${font}`;
    ctx.textBaseline = 'middle';
    for (const st of L.stations) {
      const [x, y] = P(st.x, st.z);
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, 7);
      ctx.fillStyle = halo;
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = halo;
      ctx.strokeText(st.name, x + 9, y + 1);
      ctx.fillStyle = ink;
      ctx.fillText(st.name, x + 9, y + 1);
    }
    // the stops: a square in the paper's ink (the corner a slate diamond, locked), each with its label laid where it
    // covers no other label, no stop, no station and not the legend, inside the sheet (maplabels.js), a leader to it
    // when it sits off its stop
    const seen = new Set();
    const items = [];
    const pts = [];
    for (const s of stops()) {
      const [x, y] = P(s.x, s.z);
      const f = flagOf(s);
      const on = x > RULER && y > RULER && x < W && y < H;
      seen.add(s.id);
      if (!on) {
        f.el.hidden = true;
        continue;
      }
      f.el.hidden = false;
      items.push({ id: s.id, x, y, w: Math.ceil(f.el.offsetWidth) + 2, h: Math.ceil(f.el.offsetHeight) + 2, prio: s.here ? 2 : cardId === s.id ? 3 : 0 });
      pts.push({ s, f, x, y });
    }
    const sq = (x, y, r) => ({ left: x - r, top: y - r, right: x + r, bottom: y + r });
    const obstacles = [...pts.map(p => sq(p.x, p.y, 9)), ...L.stations.map(st => {
      const [x, y] = P(st.x, st.z);
      return { left: x - 7, top: y - 8, right: x + 12 + ctx.measureText(st.name).width, bottom: y + 8 };
    })];
    const me = where();
    if (me) {
      const [x, y] = P(me.x, me.z);
      obstacles.push({ left: x - 8, top: y - 24, right: x + 50, bottom: y + 8 });
    }
    const lg = host.querySelector('.mp-legend');
    const mpR = layer.getBoundingClientRect();
    if (lg && lg.offsetParent) {
      const r = lg.getBoundingClientRect();
      obstacles.push({ left: r.left - mpR.left - 4, top: r.top - mpR.top - 4, right: r.right - mpR.left + 4, bottom: r.bottom - mpR.top + 4 });
    }
    const at = placeLabels({ items, box: { left: RULER + 4, top: RULER + 4, right: W - 6, bottom: H - 6 }, obstacles, keep: new Map([...laid].filter(([, k]) => k)) });
    laid.clear();
    for (const { s, f, x, y } of pts) {
      const L2 = at.get(s.id);
      laid.set(s.id, L2?.key ?? null);
      f.el.hidden = !L2;
      if (L2) {
        f.el.style.transform = 'none';
        f.el.style.left = `${L2.left + 1}px`;
        f.el.style.top = `${L2.top + 1}px`;
        if (L2.lead) {
          ctx.beginPath();
          ctx.moveTo(L2.lead[0], L2.lead[1]);
          ctx.lineTo(L2.lead[2], L2.lead[3]);
          ctx.strokeStyle = ink;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      ctx.save();
      ctx.translate(x, y);
      if (s.locked) ctx.rotate(Math.PI / 4);
      const r = s.locked ? 5 : 6.5;
      ctx.fillStyle = ink;
      ctx.fillRect(-r + 1.5, -r + 1.5, r * 2, r * 2);
      ctx.fillStyle = s.locked ? slate : s.here ? css('--zt-yel') || '#FFC21A' : halo;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-r, -r, r * 2, r * 2);
      // (join-1: a try-out stop, ringed in dashes: not a place of the run's, nothing counts there)
      if (s.mark === 'tryout') {
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }
    for (const [id, f] of flags) if (!seen.has(id)) f.el.hidden = true;
    placeCard(W, H);
  }
  /** A stop's card beside its stop, as the kit places a place's: above and to the right of it (its flag is to the
   *  left), else to the left, else under it; always inside the map. */
  function placeCard(W, H) {
    const s = cardId && stops().find(q => q.id === cardId);
    if (!s) return;
    const [x, y] = kit.screenOf(s.x, s.z);
    const [w, hh] = [cardEl.offsetWidth || 280, cardEl.offsetHeight || 150];
    let X = x + 18;
    let Y = y - hh - 14;
    if (X + w > W - 8) X = x - 18 - w;
    if (Y < 8) Y = y + 18;
    X = Math.max(8, Math.min(W - w - 8, X));
    Y = Math.max(8, Math.min(H - hh - 8, Y));
    cardEl.style.transform = `translate(${Math.round(X)}px, ${Math.round(Y)}px)`;
  }

  // ── open, close, the run's data ───────────────────────────────────────────────────────────────────────────────
  /** The view the map opens on: the part that holds the trailer park and the flea market (and the player, wherever they are). */
  function opening() {
    const W = host.clientWidth || 600;
    const H = host.clientHeight || 400;
    // (the run's own stops but the corner, locked; and a stop of the page's own, the try-out, so its flag is on the sheet)
    const pts = stops().filter(s => s.id !== 'corner').map(s => [s.x, s.z]);
    const me = where();
    if (me) pts.push([me.x, me.z]);
    const xs = pts.map(p => p[0]);
    const zs = pts.map(p => p[1]);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    // (room on the left for the flags, which sit left of their stops: the westmost stop as far in from the edge as its
    // flag is wide, when the flags are up; else a guess)
    const west = stops().filter(s => s.id !== 'corner' && !s.side).sort((a, b) => a.x - b.x)[0];
    const fw = west && flags.get(west.id)?.el.offsetWidth;
    const [left, right, ends] = [Math.min(fw ? fw + 30 : 290, W * 0.6), 50, 90];
    const s = Math.max(0.35, Math.min(14, (W - left - right) / Math.max(40, x1 - x0), (H - 2 * ends) / Math.max(40, z1 - z0)));
    return { cx: x0 + (W / 2 - left) / s, cz: (z0 + z1) / 2, s };
  }
  async function openMap() {
    if (open) return;
    open = true;
    const k = await load();
    if (!open || k.isOpen) return;
    k.open();
    attach();
    // (the flags up first, so the view can make room for them)
    for (const s of stops()) flagOf(s);
    k.setView(opening());
    sig = '';
    fillCard();
    kick();
  }
  function closeMap() {
    if (!open) return;
    open = false;
    cardId = null;
    cardEl.hidden = true;
    cancelAnimationFrame(raf);
    raf = 0;
    kit?.close();
    // (our canvas released with the kit's)
    if (cv) cv.width = cv.height = 0;
    sig = '';
  }

  return {
    el: host,
    open: openMap,
    close: closeMap,
    get isOpen() {
      return open;
    },
    /** The kit's map is in the page (its keys listen on the window from then on). */
    get loaded() {
      return !!loading;
    },
    get ready() {
      return !!kit?.isOpen && !!layer;
    },
    /** The run's data changed (the hour, who is left, where the player is): the flags, the card and the YOU pin again. */
    refresh() {
      if (!open) return;
      data += 1;
      if (cardId) fillCard();
      for (const fn of ticks) fn();
      kick();
    },
    card: showCard,
    get cardId() {
      return cardId;
    },
    /** Esc: one thing. Our card, else the kit's own card for a city place; true when there was one. */
    closeOne() {
      if (cardId) {
        showCard(null);
        return true;
      }
      if (kitCard && !kitCard.hidden) {
        kitCard.hidden = true;
        return true;
      }
      return false;
    },
    opening,
    get view() {
      return kit?.view ?? null;
    },
    setView: v => kit?.setView(v),
    focusYou(s = 6) {
      const me = where();
      if (me && kit) kit.setView({ cx: me.x, cz: me.z, s });
    },
    stats: () => ({ open, loaded: !!kit, card: cardId, kit: kit?.stats?.() ?? null, flags: [...flags.keys()].filter(id => !flags.get(id).el.hidden),
      // (tree-1, for the tools: each stop's point on the sheet, whether it is in sight, and its label's box or why none)
      stops: kit && open ? stops().map(s => {
        const [x, y] = kit.screenOf(s.x, s.z);
        return { id: s.id, x, y, onSheet: x > RULER && y > RULER && x < host.clientWidth && y < host.clientHeight, label: !flags.get(s.id)?.el.hidden };
      }) : [] }),
  };
}
