#!/usr/bin/env node
// THE LIBRARY AND ITS TILES ON THE RUN'S PAGE (ui-3 leg 3): pictures of each screen, staged with the page's own handles
// (`load`, `panel`, `library`, `tryOn`, `list`, `size`), and the measures the leg asked for. The server must be running:
// node demo/serve.mjs --port <port>
//
//   node demo/tools/run-library-ui-shots.mjs --out <dir> [--port 5470] [--seed 8] [--size 1280x800] [--only a,b] [--no-measure]
//
// Saves: library-wear, library-home-wall, library-grail-card, tryon-before and tryon-after (the same frame), shop-list
// (at a seller, today's shelf as tiles), wardrobe (the You panel), home-tray (arranging), library-compact (size I),
// left-rail (and a close crop of it); and library-measures.json:
//   firstScreenMs   the Library opened (the renderer warmed at idle, as in play): until every tile in sight is drawn
//   scroll          the whole list of things to wear scrolled top to bottom: the worst frame, the 99th percentile, frames over 25 ms
//   scene           the same hour (stepping out of the crib) played with the Library closed and open: worst frame, p95, frames over 33 ms
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-library-ui'));
const port = opt('--port', 5470);
const seed = opt('--seed', '8');
const [W, H] = opt('--size', '1280x800').split('x').map(Number);
const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);
const measure = !process.argv.includes('--no-measure');
mkdirSync(out, { recursive: true });
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${seed}&new=1${opt('--query', '')}`;

/** A state change for `load`: the run's state with these fields, its books kept whole (run-ui-shots.mjs's). */
const loadExpr = fields => `(async () => {
  const h = window.__demo.hud;
  const s = structuredClone(h.state);
  const f = ${JSON.stringify(fields)};
  Object.assign(s, f, { owned: { ...s.owned, ...(f.owned ?? {}) } });
  s.books.earned += (s.carried + s.banked) - (h.state.carried + h.state.banked);
  return await h.load(s);
})()`;
/** Tiles on screen still waiting for their picture (a tile clipped by its box does not count). */
const WAITING = `[...document.querySelectorAll('.u-tile.is-wait')].filter(t => { const r = t.getBoundingClientRect(); if (!r.width) return false; const x = r.left + r.width / 2, y = r.top + r.height / 2; if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false; const e = document.elementFromPoint(x, y); return !!e && (t.contains(e) || !!t.parentElement?.contains(e)); }).length`;
/** Frame timing in the page: start(), then stop() → { frames, worst, p95, p99, over25, over33 }. */
const FRAMES = `window.__frames = (() => { let last = 0, run = false, d = []; const long = []; const tick = t => { if (last) { d.push(t - last); if (t - last > 25) long.push({ ms: Math.round(t - last), phase: window.__demo?.hud?.phase }); } last = t; if (run) requestAnimationFrame(tick); };
  return { start() { d = []; long.length = 0; last = 0; run = true; requestAnimationFrame(tick); }, stop() { run = false; const s = d.slice().sort((a, b) => a - b); const q = p => +(s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0).toFixed(1);
    return { frames: d.length, worst: +(s[s.length - 1] ?? 0).toFixed(1), p95: q(0.95), p99: q(0.99), median: q(0.5), over25: d.filter(x => x > 25).length, over33: d.filter(x => x > 33).length, long: long.slice(0, 6) }; } }; })(); true`;

const browser = await launch({ width: W, height: H });
const measures = { size: `${W}x${H}`, seed };
let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failed += 1;
};
try {
  const page = await browser.open(url);
  const ev = (js, ms = 120000) => page.evaluate(js, ms);
  const hud = 'window.__demo.hud';
  const saved = async name => { console.log(`saved ${await page.shot(path.join(out, `${name}.png`))}`); await diag(name); };
  // (--diag: after each picture, the page's frames a second and the tiles' queue, to find what holds anything up)
  const diagOn = process.argv.includes('--diag');
  const diag = async label => diagOn && console.log(`  [diag ${label}] ${await ev(`new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 500) requestAnimationFrame(f); else r(JSON.stringify({ fps: n * 2, phase: ${hud}.phase, wait: ${hud}.tilesWait, ...(({ queued, pumping, boxes, drawn, error }) => ({ queued, pumping, boxes, drawn, error }))(${hud}.tiles.stats) })); }; requestAnimationFrame(f); })`)}`);
  const tilesIn = async (ms = 30000) => page.waitFor(`(${WAITING}) === 0`, ms, 100).catch(async () => console.log(`  (some tiles still drawing: ${await ev(`JSON.stringify((({ queued, pumping, boxes, drawn, failed, error, busySkips }) => ({ wait: ${hud}.tilesWait, queued, pumping, boxes, drawn, failed, error, busySkips }))(${hud}.tiles.stats))`)})`));
  // (a real key, as the player presses it: through the page's own listeners in their own order)
  const CODES = { Escape: ['Escape', 27], Enter: ['Enter', 13], l: ['KeyL', 76], b: ['KeyB', 66], c: ['KeyC', 67], v: ['KeyV', 86] };
  const key = async k => {
    await ev('(() => { document.activeElement?.blur?.(); return true; })()');
    const [code, vk] = CODES[k] ?? [k, 0];
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && k.length === 1 ? { text: k } : {}) });
    return true;
  };
  await page.waitFor(`${hud}?.phase === 'choose' && ${hud}.state.place === 'crib' && window.__demo.stage.inside?.up`, 240000, 250);
  await ev(FRAMES);
  // (the tiles' renderer is warmed at idle once the run is choosing, as in play)
  await ev(`${hud}.tiles.warm()`);
  measures.warm = await ev(`(({ importMs, stageMs, compileMs, warmMs }) => ({ importMs, stageMs, compileMs, warmMs }))(${hud}.tiles.stats)`);

  // THE RUN AS STAGED: some cash, a few things owned, a library hat worn; a grail piece among the owned
  const lib = await ev(`(async () => { const v = ${hud}.view; return v.library.pieces.map(p => ({ key: p.key, kind: p.kind, slot: p.slot, tier: p.tier, cat: p.cat, place: p.place, named: p.named })); })()`);
  const hat = lib.find(p => p.kind === 'wear' && p.slot === 'head' && !p.named && p.tier === 1);
  const top = lib.find(p => p.kind === 'wear' && p.slot === 'top' && !p.named && p.tier === 0);
  const shoes = lib.find(p => p.kind === 'wear' && p.slot === 'feet' && !p.named && p.tier === 2);
  const glasses = lib.find(p => p.kind === 'wear' && p.slot === 'eyewear' && !p.named && p.tier === 3);
  const homeOwned = [...lib.filter(p => p.kind === 'home' && !p.named && p.place !== 'wall').slice(0, 2), ...lib.filter(p => p.kind === 'home' && !p.named && p.place === 'wall').slice(0, 2)].map(p => p.key);
  const worn = { head: hat.key, feet: shoes.key };
  const things = Object.fromEntries([hat.key, top.key, shoes.key, glasses.key, 'visor', 'beanbag', ...homeOwned].map(k => [k, true]));
  check(await ev(loadExpr({ things, worn, carried: 60, banked: 140 })), 'the run loaded owning a few things');
  await page.sleep(1500);

  // ── THE LIBRARY ON WEAR: the first screen of tiles, timed
  if (want('library-wear') || measure) {
    await ev(`${hud}.library.set({ kind: 'wear', slot: 'all', cat: 'all', tier: 'all', show: 'all', sort: 'price' })`);
    const t0 = await ev(`(() => { window.__t0 = performance.now(); ${hud}.panel('library'); return true; })()`);
    await page.waitFor(`(${WAITING}) === 0 && document.querySelectorAll('.u-lib-grid .u-tile').length > 0`, 30000, 16);
    measures.firstScreenMs = await ev(`Math.round(performance.now() - window.__t0)`);
    measures.firstScreenNote = 'from opening the Library to every tile in sight drawn (renderer warmed at idle before, tiles not cached)';
    console.log(`first screen of tiles: ${measures.firstScreenMs} ms`);
    check(t0 && (await ev(`${hud}.library.shown.length`)) === lib.filter(p => p.kind === 'wear').length, 'the Library shows every piece to wear');
    await page.sleep(300);
    await saved('library-wear');
  }

  // ── SCROLLING THE WHOLE LIST: the worst frame
  if (measure) {
    await ev(`(() => { const sc = document.querySelector('.rn-sheet .rn-sheet-scroll'); sc.scrollTop = 0; return true; })()`);
    await ev('window.__frames.start()');
    await ev(`new Promise(res => { const sc = document.querySelector('.rn-sheet .rn-sheet-scroll'); const step = () => { sc.scrollTop += 60; if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1) return res(true); requestAnimationFrame(step); }; requestAnimationFrame(step); })`, 120000);
    await tilesIn(60000);
    measures.scroll = await ev('window.__frames.stop()');
    measures.scroll.note = 'the 299 pieces to wear, 60 px a frame top to bottom, then until the last screen is drawn';
    measures.scroll.tiles = await ev(`(({ drawn, failed, ms }) => { const s = ms.slice().sort((a, b) => a - b); return { drawn, failed, medianMs: s[s.length >> 1], maxMs: s[s.length - 1] }; })(${hud}.tiles.stats)`);
    console.log(`scroll: ${JSON.stringify(measures.scroll)}`);
    await ev(`(() => { document.querySelector('.rn-sheet .rn-sheet-scroll').scrollTop = 0; return true; })()`);
  }

  // ── HOME, ON A WALL
  if (want('library-home-wall')) {
    await ev(`${hud}.library.set({ kind: 'home', cat: 'on-wall', tier: 'all', show: 'all', sort: 'price' })`);
    await tilesIn();
    await ev(`${hud}.library.pin(${hud}.library.shown[3])`);
    await tilesIn();
    await page.sleep(300);
    await saved('library-home-wall');
  }

  // ── A GRAIL PIECE ON THE CARD
  if (want('library-grail-card')) {
    await ev(`${hud}.library.set({ kind: 'wear', slot: 'head', cat: 'all', tier: '3', show: 'all', sort: 'price-down' })`);
    await tilesIn();
    await ev(`${hud}.library.pin(${hud}.library.shown[0])`);
    await tilesIn();
    await page.sleep(400);
    await saved('library-grail-card');
  }

  // ── TRYING ON: the same frame before and after
  if (want('tryon')) {
    // (the grail cap on the Library's card, as the shot before it left it)
    await ev(`(() => { const s = document.querySelector('.rn-sheet'); if (s.hidden || s.dataset.sheet !== 'library') ${hud}.panel('library'); return true; })()`);
    if (!(await ev(`${hud}.library.filter.tier === '3'`))) {
      await ev(`${hud}.library.set({ kind: 'wear', slot: 'head', cat: 'all', tier: '3', show: 'all', sort: 'price-down' })`);
      await ev(`${hud}.library.pin(${hud}.library.shown[0])`);
      await tilesIn();
    }
    const k = await ev(`${hud}.library.onCard`);
    await page.sleep(600);
    await saved('tryon-before');
    const t = await ev(`${hud}.tryOn(${JSON.stringify(k)})`);
    await page.sleep(1200);
    const look = await ev(`window.__demo.stage.actors.all().find(a => a.id === 'a1').look`);
    check(!!t && Object.values(t).includes(k), `trying on ${k}`);
    check((look.hat?.id ?? look.hat) === k.split(':')[1], `the figure shows it (${look.hat?.id ?? look.hat})`);
    await tilesIn();
    await saved('tryon-after');
    measures.player = await ev(`(() => { const me = window.__demo.stage.screenOf?.('a1'); const r = document.querySelector('.rn-sheet').getBoundingClientRect(); const s = document.querySelector('.u-trying-slip').getBoundingClientRect();
      return me ? { x: Math.round(me.x), y: Math.round(me.y), sheetRight: Math.round(r.right), slipBottom: Math.round(s.bottom), coveredBySheet: me.x - 30 < r.right, coveredBySlip: me.y - 60 < s.bottom && me.x > s.left && me.x < s.right } : null; })()`);
    console.log(`player on screen while trying on: ${JSON.stringify(measures.player)}`);
    if (process.argv.includes('--off-api')) await ev(`${hud}.tryOn(null)`);
    else await key('Escape');
    await page.sleep(500);
    const back = await ev(`window.__demo.stage.actors.all().find(a => a.id === 'a1').look`);
    check((await ev(`document.querySelector('.u-trying-slip').hidden`)) && (back.hat?.id ?? back.hat) === hat.key.split(':')[1], `Esc took it off (the hat worn again: ${back.hat?.id ?? back.hat})`);
  }

  // ── THE WARDROBE (the You panel's Wearing tab), at home
  if (want('wardrobe')) {
    await ev(`${hud}.panel('character')`);
    await ev(`(() => { const t = [...document.querySelectorAll('.rn-sheet [role="tab"]')].find(b => /wearing/i.test(b.textContent)); t?.click(); return !!t; })()`);
    await page.sleep(600);
    await tilesIn();
    await page.sleep(300);
    await saved('wardrobe');
    // (and scrolled to what you own to wear, as a grid)
    await ev(`(() => { document.querySelector('.rn-sheet .u-ward-grid')?.scrollIntoView({ block: 'end' }); return true; })()`);
    await page.sleep(500);
    await tilesIn();
    await saved('wardrobe-grid');
    await ev(`${hud}.panel(null)`);
  }

  // ── THE HOME TRAY, arranging (V): what is owned for the home and put away, a wall piece among them
  if (want('home-tray')) {
    await ev(`${hud}.panel(null)`);
    await page.sleep(400);
    await key('v');
    await page.waitFor(`document.querySelector('.rn-arrange')`, 15000, 100);
    await page.sleep(1200);
    await tilesIn();
    // (a wall piece taken out: the walls light where it may hang)
    const wallKey = await ev(`(() => { const b = [...document.querySelectorAll('.rn-ar-chip.is-wall')][0]; b?.click(); return b?.dataset.key ?? null; })()`);
    await page.sleep(1200);
    await tilesIn();
    await saved('home-tray');
    check(!!wallKey, `a wall piece in the tray, taken out (${wallKey})`);
    await key('Escape');
    await page.sleep(300);
    await key('Escape');
    await page.sleep(800);
  }

  // ── AT A SELLER: a piece bought from the Library's card, then the shop's list (B), today's shelf as tiles, a piece
  // tried on from there
  if (want('shop-list')) {
    check(await ev(loadExpr({ things, worn, carried: 60, banked: 140, place: 'market', hour: 13 })), 'loaded at the flea market');
    await page.sleep(2500);
    // (bought for real from the Library's card: through the rules' own choice, the hour's scene, owned after. The
    // buying scene at the market now and then never ends, with or without the Library (seen 2026-11-17 on a plain
    // buy from the dock too): after 40 s it is skipped with Space, as a player would, and the measures say so)
    const buy = await ev(`(() => { const v = ${hud}.view; const p = v.library.pieces.filter(x => x.onShelf && x.onShelf.place === 'market' && !x.owned && x.price <= v.carried).sort((a, b) => a.price - b.price)[0]; return p ? { key: p.key, kind: p.kind, price: p.price } : null; })()`);
    if (buy) {
      await ev(`(() => { ${hud}.panel('library'); ${hud}.library.set({ kind: ${JSON.stringify(buy.kind)}, slot: 'all', cat: 'all', tier: 'all', show: 'today', sort: 'price' }); ${hud}.library.pin(${JSON.stringify(buy.key)}); return true; })()`);
      await page.sleep(400);
      const label = await ev(`document.querySelector('.u-lib-buy b')?.textContent`);
      await ev(`(() => { document.querySelector('.u-lib-buy').click(); return true; })()`);
      const done = `${hud}.phase === 'choose' && ${hud}.state.things?.[${JSON.stringify(buy.key)}] === true`;
      const skipped = await page.waitFor(done, 40000, 100).then(() => false, async () => {
        for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: ' ', code: 'Space', windowsVirtualKeyCode: 32, ...(type === 'keyDown' ? { text: ' ' } : {}) });
        await page.waitFor(done, 30000, 100);
        return true;
      });
      measures.buy = { key: buy.key, label, skipped };
      check(true, `bought ${buy.key} from the Library's card (${label}), as the rules' own choice: owned, $${buy.price} paid${skipped ? ' (its scene hung and was skipped with Space)' : ''}`);
      await ev(`${hud}.panel(null)`);
      await page.sleep(800);
    }
    await ev(`${hud}.list('shop')`);
    await page.sleep(500);
    await tilesIn();
    await saved('shop-list');
    const wearOnShelf = await ev(`(() => { const v = ${hud}.view; const s = v.library.shelves.find(x => x.here && x.kind === 'wear'); return s?.items[0] ?? null; })()`);
    if (wearOnShelf) {
      await ev(`(() => { const b = [...document.querySelectorAll('.u-shelf-try')][0]; b?.click(); return !!b; })()`);
      await page.sleep(1200);
      await tilesIn();
      await saved('shop-list-tryon');
      check(await ev(`!document.querySelector('.u-trying-slip').hidden`), 'tried on from the list of the shop: the slip says so');
      await key('Escape');
      await page.sleep(300);
      check(await ev(`document.querySelector('.u-trying-slip').hidden`), 'Esc took it off, the list still open');
    }
    await ev(`${hud}.list(null)`);
  }

  // ── COMPACT (I)
  if (want('library-compact')) {
    await ev(`(() => { const s = document.querySelector('.rn-sheet'); if (s.hidden || s.dataset.sheet !== 'library') ${hud}.panel('library'); return true; })()`);
    await ev(`${hud}.size('compact')`);
    await ev(`${hud}.library.set({ kind: 'wear', slot: 'all', tier: 'all', show: 'all', sort: 'tier-down' })`);
    await tilesIn();
    await page.sleep(400);
    await saved('library-compact');
    await ev(`${hud}.size('full')`);
  }

  // ── THE LEFT RAIL (part E): the whole frame, and a close crop of the rail at twice the size
  if (want('left-rail')) {
    check(await ev(loadExpr({ things, worn, carried: 60, banked: 140, place: 'crib', hour: 12 })), 'loaded at the crib (the rail)');
    await page.sleep(1500);
    await ev(`${hud}.panel('library')`);
    await tilesIn();
    await page.sleep(300);
    await saved('left-rail');
    const r = await ev(`(() => { const q = document.querySelector('.rn-dock').getBoundingClientRect(); return { x: Math.max(0, q.left - 6), y: Math.max(0, q.top - 10), w: q.width + 30, h: q.height + 20, right: q.right }; })()`);
    const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 2 } });
    writeFileSync(path.join(out, 'left-rail-close.png'), Buffer.from(shot.data, 'base64'));
    console.log(`saved ${path.join(out, 'left-rail-close.png')}`);
    measures.rail = { right: Math.round(r.right), note: 'the rail\'s right edge, which the stage frames the picture by (it was 86 at 1280 before)' };
    await ev(`${hud}.panel(null)`);
  }

  // ── THE DOCK AT THIS SIZE (part E): every title, verb word and tag cut off or hidden, at the crib, the park, the market
  if (want('dock-cuts')) {
    const CUTS = `(() => { const d = document.querySelector('.rn-card.u-dock'); if (!d) return null;
      const cut = [...d.querySelectorAll('.u-card-t, .u-card-pay, .u-verb-t b, .u-verb-t small, .u-go-t, .u-card-sub > *')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map(e => e.className.split(' ')[0] + ': ' + e.textContent.trim());
      const hidden = [...d.querySelectorAll('.u-card-sub')].flatMap(s => { const k = [...s.children]; const top = k[0]?.offsetTop ?? 0; return k.filter(e => e.offsetTop > top + 2).map(e => 'hidden tag: ' + e.textContent.trim()); });
      return [...cut, ...hidden]; })()`;
    measures.dockCuts = {};
    for (const [place, hour] of [['crib', 12], ['park', 12], ['market', 13], ['park', 20]]) {
      check(await ev(loadExpr({ things, worn, carried: 60, banked: 140, place, hour })), `loaded at the ${place}, ${hour}:00 (the dock)`);
      await page.sleep(1500);
      await ev(`${hud}.bar(false)`);
      await page.sleep(200);
      measures.dockCuts[`${place}-${hour}`] = await ev(CUTS);
      // (where the player stands on screen here, against the Library's right edge: covered while trying on, or not)
      await ev(`${hud}.panel('library')`);
      await page.sleep(300);
      (measures.playerVsLibrary ??= {})[`${place}-${hour}`] = await ev(`(() => { const me = window.__demo.stage.screenOf?.('a1'); const r = document.querySelector('.rn-sheet').getBoundingClientRect(); return me ? { x: Math.round(me.x), y: Math.round(me.y), visible: !!me.visible, libraryRight: Math.round(r.right), covered: me.x - 40 < r.right && me.y > r.top && me.y < r.bottom } : null; })()`);
      await ev(`${hud}.panel(null)`);
      console.log(`dock at the ${place}, ${hour}:00: ${JSON.stringify(measures.dockCuts[`${place}-${hour}`])}`);
      if (place === 'market' || hour === 20) await saved(`dock-${place}-${hour}`);
    }
  }

  // ── A SCENE WITH THE LIBRARY OPEN AND CLOSED: stepping out of the crib, the same hour from the same state
  if (measure) {
    const scene = async open => {
      check(await ev(loadExpr({ things, worn, carried: 60, banked: 140, place: 'crib', hour: 12 })), `loaded at the crib (Library ${open ? 'open' : 'closed'})`);
      await page.sleep(1500);
      await ev(`${hud}.panel(${open ? "'library'" : 'null'})`);
      if (open) await ev(`${hud}.library.set({ kind: 'home', cat: 'all', tier: 'all', show: 'all', sort: 'price-down' })`);
      await page.sleep(300);
      const out = await ev(`${hud}.view.choices.find(c => c.choice.do === 'out')?.key`);
      await ev(`${hud}.pick(${JSON.stringify(out)})`);
      // (in the page: how many tiles were drawn while the hour played, and how many waited for it)
      await ev(`(() => { const T = ${hud}.tiles.stats; window.__scene = { drawn: 0, waiting: 0 }; const d0 = T.drawn; const f = () => { if (${hud}.phase === 'playing') { window.__scene.drawn = T.drawn - d0; window.__scene.waiting = Math.max(window.__scene.waiting, T.queued); } if (${hud}.phase !== 'choose' || !window.__scene.seen) { window.__scene.seen = ${hud}.phase === 'playing' || window.__scene.seen; requestAnimationFrame(f); } }; requestAnimationFrame(f); return true; })()`);
      await ev('window.__frames.start()');
      await key('Enter');
      await page.waitFor(`${hud}.phase === 'playing'`, 10000, 20).catch(() => null);
      await page.waitFor(`${hud}.phase === 'choose'`, 120000, 50);
      const f = await ev('window.__frames.stop()');
      Object.assign(f, await ev('({ tilesDrawnWhilePlaying: window.__scene.drawn, tilesWaiting: window.__scene.waiting })'));
      return f;
    };
    measures.scene = { closed: await scene(false), open: await scene(true), note: 'stepping out of the crib (one hour on the stage), frames from Enter to the next choice' };
    console.log(`scene: ${JSON.stringify(measures.scene)}`);
    await ev(`${hud}.panel(null)`);
  }

  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || l.includes('[tiles]'));
  measures.pageErrors = bad.length;
  console.log(`page errors ${bad.length}${bad.length ? `\n  ${[...new Set(bad)].slice(0, 8).join('\n  ')}` : ''}`);
  if (bad.length) failed += 1;
  writeFileSync(path.join(out, 'library-measures.json'), JSON.stringify(measures, null, 1));
} catch (err) {
  console.error(String(err?.stack ?? err));
  failed += 1;
} finally {
  await browser.close();
}
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
