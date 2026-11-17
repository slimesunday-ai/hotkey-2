#!/usr/bin/env node
// Pictures of THE RUN'S FRAME (demo/run/index.js, run.css, panels.js) at one window size, each moment staged with the
// page's own handles (`load`, `fold`, `panel`) and the choices made with the real keys; and with every picture, what
// the frame leaves free of the picture, measured off the page. The server must be running: node demo/serve.mjs
//
//   node demo/tools/run-ui-shots.mjs --out <dir> [--port 5470] [--seed 3] [--size 1600x1000] [--only crib,park,...]
//
// Saves <size>-<moment>.jpg: crib-dock-open, crib-dock-folded (the shop), crib-2200, park-options (three dealt at
// rest, a mood mark up), park-option-picked, park-bar-folded and park-bar-folded-picked (the bar on its one row, a
// number pressed), park-dock-open, market-danger and market-small-print (the danger above 0, and its slip open),
// panel-character-a and -b (a second apart: the figure turns), panel-character-wearing, panel-moves, panel-stuff,
// panel-map (the kit's paper map, as it opens), map-zoomed-out, map-zoomed-in-you (on the YOU pin), map-stop-card (a
// stop clicked), scene-strip (an hour playing), scene-result (what just happened, the hour over), late-run (energy 10,
// all three owned, $1,240 carried) and, at phone width, late-run-dock-open. Then a JSON of the measures beside them
// (<size>-measures.json): the bar's height, the top line's, the dock's box, the free part of the picture (the box
// between the top line, the dock, and the bar), its share of the window's height, where the player's head is against
// it, the room's floor against it inside, any dock row cut off, and the mood marks on screen.
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-ui'));
const port = opt('--port', 5470);
const seed = opt('--seed', '3');
const [W, H] = opt('--size', '1600x1000').split('x').map(Number);
const size = `${W}x${H}`;
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${seed}`;
const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);
mkdirSync(out, { recursive: true });

/** A state change for `load`: the run's state with these fields, its books kept whole (run-shots.mjs's). */
const loadExpr = fields => `(async () => {
  const h = window.__demo.hud;
  const s = structuredClone(h.state);
  const f = ${JSON.stringify(fields)};
  Object.assign(s, f, { owned: { ...s.owned, ...(f.owned ?? {}) } });
  s.books.earned += (s.carried + s.banked) - (h.state.carried + h.state.banked);
  return await h.load(s);
})()`;

/** THE FREE PART, off the page: right of the dock (unless it lies across the top), under the top line (and the dock
 *  when it lies across), above the move card. The player's head and, inside, the room's floor, against it. */
const MEASURE = `(() => {
  const W = innerWidth, H = innerHeight, r = sel => { const e = document.querySelector(sel); if (!e || e.hidden) return null; const q = e.getBoundingClientRect(); return q.width && q.height ? { left: Math.round(q.left), top: Math.round(q.top), right: Math.round(q.right), bottom: Math.round(q.bottom) } : null; };
  const top = r('.rn-top'), dock = r('.rn-dock'), card = r('.rn-card'), sheet = r('.rn-sheet');
  const across = dock && dock.right - dock.left > W * 0.6;
  const free = { left: dock && !across ? dock.right : 0, top: Math.max(top?.bottom ?? 0, across ? dock.bottom : 0), right: W, bottom: card ? card.top : H };
  const st = window.__demo.stage, head = st.screenOf?.('a1');
  const inside = st.inside?.up ?? null, floor = inside ? st.inside.floorPx() : null;
  const within = (x, y) => x >= free.left && x <= free.right && y >= free.top && y <= free.bottom;
  const d = document.querySelector('.rn-dock');
  const cut = d ? [...d.querySelectorAll('.rn-carried, .rn-banked, .hk-heat, .rn-owned, .rn-goal, .rn-keys, .rn-dock-head')].filter(e => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > d.getBoundingClientRect().right + 1 || e.getBoundingClientRect().bottom > d.getBoundingClientRect().bottom + 1).map(e => e.className) : [];
  const marks = [...document.querySelectorAll('.rn-mark')].filter(m => !m.hidden && getComputedStyle(m).visibility !== 'hidden' && getComputedStyle(m.parentElement).visibility !== 'hidden').map(m => m.className);
  return {
    W, H, phase: window.__demo.hud.phase, place: window.__demo.hud.state.place, rail: document.querySelector('.rn-dock')?.classList.contains('is-rail'),
    bar: card ? card.bottom - card.top : null, topLine: top ? top.bottom - top.top : null, barFolded: document.querySelector('.rn-card')?.classList.contains('is-folded') ?? null,
    top, dock, card, sheet, free, freeShare: +((free.bottom - free.top) / H).toFixed(3),
    head: head ? { x: Math.round(head.x), y: Math.round(head.y), visible: head.visible, inFree: within(head.x, head.y) } : null,
    inside, floor: floor ? { x: floor.x, y: floor.y, inFree: floor.x[0] >= free.left - 2 && floor.x[1] <= free.right + 2 && floor.y[0] >= free.top - 2 && floor.y[1] <= free.bottom + 2 } : null,
    stageRect: st.inside?.debug?.().rect ?? null, offset: st.debug?.().offset ?? null,
    dockScroll: d ? { scroll: d.scrollHeight, client: d.clientHeight } : null, cut, marks, face: window.__demo.hud.face,
  };
})()`;

const browser = await launch({ width: W, height: H });
let page = null;
const measures = {};
try {
  page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 240000);
  await page.evaluate('window.__demo.stage.actors.audit(true)');
  await page.sleep(2500);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const key = k => ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);
  const phase = p => page.waitFor(`window.__demo.hud.phase === ${JSON.stringify(p)}`, 120000, 100);
  const load = async fields => {
    await phase('choose');
    if (!(await ev(loadExpr(fields)))) throw new Error('the run would not load the state');
    await page.sleep(2500);
  };
  const shot = async (name, wait = 1200) => {
    await page.sleep(wait);
    measures[name] = await ev(MEASURE);
    const m = measures[name];
    console.log(`saved ${await page.shot(path.join(out, `${size}-${name}.jpg`))} · bar ${m.bar} px · free ${m.freeShare} · head ${m.head ? `${m.head.inFree ? 'in' : 'OUT OF'} the free part` : '-'}${m.floor ? ` · floor ${m.floor.inFree ? 'in' : 'OUT OF'} it` : ''}${m.cut.length ? ` · CUT ${m.cut.join(' | ')}` : ''}${m.marks.length ? ` · marks ${m.marks.length}` : ''}`);
  };
  const fold = rail => ev(`window.__demo.hud.fold(${rail})`);
  const panel = id => ev(`window.__demo.hud.panel(${JSON.stringify(id)})`);
  const bar = folded => ev(`window.__demo.hud.bar(${folded})`);
  const phone = W <= 720;
  // (a first visit's frame: the dock on its rail, the bar open)
  await fold(true);
  await bar(false);

  if (want('crib')) {
    await load({ place: 'crib', day: 2, hour: 13, banked: 160, carried: 0, energy: 6, heat: 1 });
    await fold(false);
    await shot('crib-dock-open', 2500);
    await fold(true);
    await shot('crib-dock-folded', 2500);
    await load({ place: 'crib', day: 2, hour: 22, banked: 60, carried: 0, energy: 1, heat: 1 });
    await shot('crib-2200', 2500);
  }
  if (want('park')) {
    // the park with a mood mark up: Mrs. Alvarez friendly (the odd job done for her), a man at the bus stop wary of
    // you and out for the day, watching; three still dealt
    await load({ place: 'park', day: 2, hour: 14, banked: 40, carried: 8, energy: 5, heat: 1, shifts: { park: 1, market: 0 },
      people: { 'npc:neighbour': { mood: 'friendly', out: false, job: 'odd' }, 'npc:mark:projects': { mood: 'wary', out: true, job: 'wallet' } } });
    await shot('park-options', 3000);
    console.log(`  dealt ${await ev('window.__demo.hud.view.options.length')}`);
    await key('2');
    await shot('park-option-picked', 800);
    await bar(true);
    await shot('park-bar-folded', 1500);
    await key('3');
    await shot('park-bar-folded-picked', 800);
    await bar(false);
    await fold(false);
    await shot('park-dock-open', 1500);
    await fold(true);
  }
  if (want('market')) {
    // the market an hour in, money on you: the danger above 0, then its small print
    await load({ place: 'market', day: 2, hour: 15, hoursThere: 1, banked: 40, carried: 64, energy: 5, heat: 2, shifts: { park: 0, market: 1 } });
    await shot('market-danger', 3000);
    await ev('window.__demo.hud.print(true)');
    await shot('market-small-print', 600);
    await ev('window.__demo.hud.print(false)');
  }
  if (want('panels')) {
    await panel('character');
    await page.waitFor('window.__demo.hud.face.big === "ok"', 30000, 100).catch(() => console.log('  (the portrait was not drawn in 30 s)'));
    await shot('panel-character-a', 600);
    await page.sleep(1000);
    await page.shot(path.join(out, `${size}-panel-character-b.jpg`));
    console.log(`saved ${size}-panel-character-b.jpg (a second later)`);
    await ev(`document.querySelector('.rn-sheet .k-tab#k-tab-wearing')?.click()`);
    await shot('panel-character-wearing', 600);
    await ev(`document.querySelector('.rn-sheet .k-tab#k-tab-stats')?.click()`);
    await key('g');
    await shot('panel-moves', 500);
    await key('o');
    await shot('panel-stuff', 500);
    await key('m');
    await page.waitFor('window.__demo.hud.map.ready', 30000, 100).catch(() => console.log('  (the map was not up in 30 s)'));
    await shot('panel-map', 1200);
    console.log(`  map: ${JSON.stringify(await ev('(s => ({ flags: s.flags, view: s.kit?.view, geoMs: s.kit?.geoMs, baseMs: s.kit?.baseMs }))(window.__demo.hud.map.stats())'))}`);
    await ev('window.__demo.hud.map.setView({ cx: -140, cz: -10, s: 0.9 })');
    await shot('map-zoomed-out', 1000);
    await ev('window.__demo.hud.map.focusYou(8)');
    await shot('map-zoomed-in-you', 1000);
    await ev('window.__demo.hud.map.setView(window.__demo.hud.map.opening())');
    await ev('document.querySelector(\'.rn-flag[data-stop="market"]\')?.click()');
    await shot('map-stop-card', 800);
    await key('Escape');
    await page.sleep(300);
    console.log(`  Esc closed the stop's card first: ${await ev('!window.__demo.hud.map.cardId && !document.querySelector(".rn-sheet").hidden')}`);
    await key('Escape');
    await page.sleep(400);
    console.log(`  Esc closed the panel: ${await ev('document.querySelector(".rn-sheet").hidden')} · the map stopped: ${await ev('!window.__demo.hud.map.stats().kit.open')}`);
  }
  if (want('scene')) {
    await load({ place: 'park', day: 2, hour: 15, banked: 40, carried: 8, energy: 5, heat: 1 });
    await key('2');
    await key('Enter');
    await phase('playing');
    await shot('scene-strip', 1800);
    await phase('choose');
    await shot('scene-result', 1500);
  }
  if (want('late')) {
    await load({ place: 'market', day: 5, hour: 15, hoursThere: 2, banked: 310, carried: 1240, energy: 10, heat: 2, owned: { pocket: true, cutter: true, bed: true }, doneDay: 4, people: {}, shifts: { park: 0, market: 0 } });
    await shot('late-run', 2500);
    if (phone) {
      await fold(false);
      await shot('late-run-dock-open', 1500);
      await fold(true);
    }
  }
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]|\[run\]|\[inside\]/.test(l));
  console.log(bad.length ? `page errors:\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}` : 'page errors: 0');
  console.log('audit', JSON.stringify(await ev(`(a => a && { overlaps: a.overlaps, furniture: a.furniture, vanish: a.vanish })(window.__demo.stage.actors.audit())`)));
  writeFileSync(path.join(out, `${size}-measures.json`), JSON.stringify(measures, null, 1));
} catch (err) {
  console.error(String(err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-10).join('\n').slice(0, 2500));
  process.exitCode = 1;
} finally {
  if (Object.keys(measures).length) writeFileSync(path.join(out, `${size}-measures.json`), JSON.stringify(measures, null, 1));
  await browser.close();
}
