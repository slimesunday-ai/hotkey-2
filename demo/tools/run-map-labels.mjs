#!/usr/bin/env node
// THE MAP'S STOP LABELS, CHECKED IN THE PAGE (tree-1; the owner, 11-18: "the text on this part of the map is a bit
// buggy": with every place on the map, the labels lay on top of one another and ran off the panel's left edge).
// The server must be running: node demo/serve.mjs --port 5494 --quiet
//
//   HK2_DEBUG_PORT=5747 node demo/tools/run-map-labels.mjs --port 5494 --out <dir>
//
// At 1600 × 1000 and again at 1280 × 720 (the smallest the page supports), with REAL mouse presses and drags (DevTools
// Input.dispatchMouseEvent) and keys: the Map opened by its button on the rail, every place of the config on it (its
// subway stops, and the try-out's); then every label's box measured, at the view it opens on, after dragging the stops
// to each edge of the panel, and at each zoom step in and out (its + and − pressed): no two labels may meet, each must
// lie wholly inside the map's box, and at the opening view every stop in sight must have its label. Last, each stop's
// label pressed with the mouse: its card must open. A picture of each view into --out.
// Prints `maplabels-ok` or `maplabels-fail: <why>`.
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg } from '../../src/run/index.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-map-labels'));
const port = opt('--port', 5470);
mkdirSync(out, { recursive: true });
const SIZES = [[1600, 1000], [1280, 720]];
const PLACES = [...cfg.subwayStops, 'tryout'];

const faults = [];
const fail = why => {
  if (faults.length < 40) console.log(`  FAULT: ${why}`);
  faults.push(why);
};
const browser = await launch({ width: SIZES[0][0], height: SIZES[0][1] });
let page = null;
const report = { views: [], presses: [], pictures: [] };
try {
  page = await browser.open(`http://127.0.0.1:${port}/demo/?mode=run&seed=3&speed=4`);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 180000);
  await page.sleep(1500);
  const move = (type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' && !extra.held ? 'none' : 'left', clickCount: 1, ...(extra.held ? { buttons: 1 } : {}) });
  async function click(x, y, what) {
    await move('mouseMoved', x, y);
    await move('mousePressed', x, y);
    await move('mouseReleased', x, y);
    report.presses.push(what);
  }
  async function key(code, keyName, vk) {
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && keyName.length === 1 ? { text: keyName } : {}) });
    report.presses.push(`key ${keyName}`);
  }
  const centre = sel => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => !x.closest('[hidden]') && x.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const e = document.elementFromPoint(x, y); return { x, y, hit: !!e && (e === b || b.contains(e)) }; })()`);
  async function press(sel, what) {
    const c = await centre(sel);
    if (!c) throw new Error(`${what}: nothing to press (${sel})`);
    if (!c.hit) throw new Error(`${what}: something lies over it`);
    await click(c.x, c.y, what);
  }
  /** A drag on the map's open paper from its middle by (dx, dy), in small real mouse moves. */
  async function drag(dx, dy, what) {
    const b = await ev(`(() => { const m = document.querySelector('.rn-map').getBoundingClientRect(); const flags = [...document.querySelectorAll('.rn-flag')].filter(f => !f.hidden).map(f => f.getBoundingClientRect()); for (let k = 0; k < 60; k++) { const x = m.left + m.width * (0.3 + 0.4 * ((k * 37) % 60) / 60), y = m.top + m.height * (0.3 + 0.4 * ((k * 23) % 60) / 60); if (!flags.some(r => x > r.left - 10 && x < r.right + 10 && y > r.top - 10 && y < r.bottom + 10) && document.elementFromPoint(x, y)?.closest('.mp-sheet')) return { x, y }; } return null; })()`);
    if (!b) throw new Error(`${what}: no open paper to drag`);
    await move('mouseMoved', b.x, b.y);
    await move('mousePressed', b.x, b.y);
    for (let k = 1; k <= 12; k++) {
      await move('mouseMoved', b.x + (dx * k) / 12, b.y + (dy * k) / 12, { held: true });
      await page.sleep(16);
    }
    await move('mouseReleased', b.x + dx, b.y + dy);
    report.presses.push(what);
    await page.sleep(500);
  }
  /** Every shown label's box against the map's and one another's; at `all`, every stop in sight must have one. */
  async function measure(name, all = false) {
    await page.sleep(350);
    const m = await ev(`(() => {
      const box = document.querySelector('.rn-map').getBoundingClientRect();
      const labels = [...document.querySelectorAll('.rn-flag')].filter(f => !f.hidden && f.getBoundingClientRect().width > 0).map(f => { const r = f.getBoundingClientRect(); return { id: f.dataset.stop, text: f.innerText.replace(/\\s+/g, ' ').trim(), left: r.left, top: r.top, right: r.right, bottom: r.bottom }; });
      const st = window.__demo.hud.map.stats();
      return { box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom }, labels, stops: st.stops ?? null, view: window.__demo.hud.map.view };
    })()`);
    const bad = [];
    for (const a of m.labels) {
      if (a.left < m.box.left - 0.5 || a.top < m.box.top - 0.5 || a.right > m.box.right + 0.5 || a.bottom > m.box.bottom + 0.5) bad.push(`${a.id} runs off the map (${Math.round(a.left - m.box.left)}, ${Math.round(a.top - m.box.top)} to ${Math.round(a.right - m.box.left)}, ${Math.round(a.bottom - m.box.top)} in a ${Math.round(m.box.right - m.box.left)} × ${Math.round(m.box.bottom - m.box.top)} map)`);
    }
    for (let i = 0; i < m.labels.length; i++) {
      for (let j = 0; j < i; j++) {
        const [a, b] = [m.labels[i], m.labels[j]];
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) bad.push(`${a.id} lies on ${b.id}`);
      }
    }
    const unlabelled = (m.stops ?? []).filter(s => s.onSheet && !s.label).map(s => s.id);
    if (all) {
      const ids = new Set(m.labels.map(l => l.id));
      for (const id of PLACES) if (!ids.has(id) && !(m.stops && !m.stops.find(s => s.id === id)?.onSheet)) bad.push(`${id} has no label at the opening view`);
    }
    report.views.push({ name, labels: m.labels.length, unlabelled, view: m.view, faults: bad });
    console.log(`  ${name}: ${m.labels.length} labels${unlabelled.length ? ` (no room: ${unlabelled.join(', ')})` : ''}${bad.length ? ` · ${bad.length} faults` : ' · ok'}`);
    for (const b of bad) fail(`${name}: ${b}`);
    return m;
  }
  async function shot(name) {
    const f = await page.shot(path.join(out, `${name}.jpg`));
    report.pictures.push(f);
  }
  const mapOpen = () => ev('(s => !!s && !s.hidden && s.dataset.sheet === "map")(document.querySelector(".rn-sheet"))');

  for (const [W, H] of SIZES) {
    const tag = `${W}x${H}`;
    console.log(`${tag}`);
    if (W !== SIZES[0][0]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
      await page.sleep(2500);
    }
    // THE MAP, BY ITS BUTTON
    if (await mapOpen()) await key('KeyM', 'm', 77);
    await page.sleep(400);
    await press('.rn-key[data-sheet="map"]', `${tag}: the rail's Map`);
    await page.waitFor('window.__demo.hud.map.ready', 60000, 200);
    await page.sleep(2000);
    if (!(await mapOpen())) throw new Error(`${tag}: the Map did not open`);
    const ids = await ev('[...document.querySelectorAll(".rn-flag")].map(f => f.dataset.stop)');
    for (const id of PLACES) if (!ids.includes(id)) fail(`${tag}: ${id} is not on the map`);
    await measure(`${tag} opening view`, true);
    await shot(`${tag}-0-opening`);
    // DRAGGED TO EACH EDGE: the stops carried towards the left, the right, the top and the bottom of the panel
    const box = await ev('(r => ({ w: r.width, h: r.height }))(document.querySelector(".rn-map").getBoundingClientRect())');
    for (const [dx, dy, edge] of [[-0.42, 0, 'left'], [0.42, 0, 'right'], [0, -0.42, 'top'], [0, 0.42, 'bottom']]) {
      await drag(dx * box.w, dy * box.h, `${tag}: drag ${edge}`);
      await measure(`${tag} dragged to the ${edge}`);
      await shot(`${tag}-1-${edge}`);
      await drag(-dx * box.w, -dy * box.h, `${tag}: drag back`);
    }
    // EACH ZOOM STEP: + to the closest, then − to the farthest
    for (const [btn, word] of [['.rn-map .mp-zin', 'in'], ['.rn-map .mp-zout', 'out']]) {
      for (let n = 0; n < 14; n++) {
        const s0 = (await ev('window.__demo.hud.map.view'))?.s;
        await press(btn, `${tag}: zoom ${word}`);
        await page.sleep(500);
        const s1 = (await ev('window.__demo.hud.map.view'))?.s;
        if (Math.abs(s1 - s0) < 1e-6) break;
        await measure(`${tag} zoomed ${word} ×${n + 1} (scale ${s1.toFixed(2)})`);
        if (n === 0 || n % 3 === 2) await shot(`${tag}-2-zoom-${word}-${n + 1}`);
      }
    }
    // BACK TO THE OPENING VIEW (the Map shut and opened again), AND EACH STOP'S LABEL PRESSED: ITS CARD
    await key('KeyM', 'm', 77);
    await page.sleep(500);
    await key('KeyM', 'm', 77);
    await page.waitFor('window.__demo.hud.map.ready', 60000, 200);
    await page.sleep(1500);
    for (const id of PLACES) {
      const sel = `.rn-flag[data-stop="${id}"]`;
      const c = await centre(sel);
      if (!c) {
        fail(`${tag}: ${id}'s label is not shown to press`);
        continue;
      }
      if (!c.hit) {
        fail(`${tag}: ${id}'s label is covered where it would be pressed`);
        continue;
      }
      await click(c.x, c.y, `${tag}: ${id}'s label`);
      await page.sleep(500);
      const card = await ev('(c => c && !c.hidden ? c.innerText.split("\\n")[0] : null)(document.querySelector(".rn-stopcard"))');
      const on = await ev('window.__demo.hud.map.cardId');
      if (on !== id || !card) fail(`${tag}: pressing ${id}'s label opened ${on ?? 'no card'}`);
      else console.log(`  ${id}'s label pressed: its card "${card}"`);
      if (id === 'market') {
        await measure(`${tag} with the market's card`);
        await shot(`${tag}-3-market-card`);
      }
      await key('Escape', 'Escape', 27);
      await page.sleep(300);
    }
    await key('KeyM', 'm', 77);
    await page.sleep(500);
  }
} catch (err) {
  fail(String(err?.stack ?? err));
} finally {
  const bad = page ? page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]')) : [];
  if (bad.length) fail(`${bad.length} page errors: ${[...new Set(bad)].slice(0, 6).join(' | ').slice(0, 1500)}`);
  report.faults = faults;
  writeFileSync(path.join(out, 'run-map-labels.json'), `${JSON.stringify(report, null, 1)}\n`);
  await browser.close();
  console.log(faults.length ? `maplabels-fail: ${faults[0]}${faults.length > 1 ? ` (and ${faults.length - 1} more)` : ''}` : 'maplabels-ok');
  process.exitCode = faults.length ? 1 : 0;
}
