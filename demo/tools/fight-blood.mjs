#!/usr/bin/env node
// NO BLOOD LEFT IN THE AIR (anim-1; the owner, 2026-11-18: "a piece of blood splatter stays in the air and glitches in
// front of you"). The stage's blood (demo/stage/gore.js) lays marks that RIDE a body: a place and a heading. A body in
// a staged fight is posed by hand: its head is not where a standing head is, and a mark laid on it hangs in the air.
// This plays the fight page's one-on-one (the run's own fight, demo/run/duel.js) and watches the blood all through it:
//
//   · nothing rides a body further from that body's head, as it is drawn, than a head is big (0.75 m);
//   · no drop is still in the air 2.5 s after the last blow landed;
//   · when the fight is over, and when it is skipped, what rides a body is on a standing head, and no drop is left.
//
// One fight watched to its end, one skipped with a real Space key; both picked and started by real mouse presses on
// the build panel's own buttons. The server must be running: node demo/serve.mjs --port 5495 --quiet
//
//   HK2_DEBUG_PORT=5746 node demo/tools/fight-blood.mjs --port 5495
//
// Prints a line a fight, then `blood-ok` or `blood-fail: <why>`.
import { launch } from './chrome.mjs';

const opt = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
};
const url = `http://127.0.0.1:${opt('--port', 5495)}/demo/?mode=fight&nostairs=1`;
const HEAD = 0.75;
const faults = [];
const fail = why => {
  faults.push(why);
  console.log(`  FAULT: ${why}`);
};
const browser = await launch({ width: 1600, height: 1000 });
let page = null;
try {
  page = await browser.open(url);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "pick"', 180000);
  await page.sleep(1200);
  async function key(k, code, vk) {
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && k.length === 1 ? { text: k } : {}) });
  }
  /** A real mouse press on the middle of the first visible thing a selector finds. */
  async function press(sel) {
    const b = await ev(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => x.getBoundingClientRect().width > 0); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!b) throw new Error(`nothing to press: ${sel}`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y, button: 'none' });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await page.sleep(200);
  }
  /** What the blood is doing now, against where the bodies' heads are. */
  const look = () => ev(`(() => { const st = window.__demo.stage, A = st.actors, g = st.gore, d = window.__demo.hud.duel;
    if (!g || !g.riding) return { none: true };
    const heads = d.state && d.state.heads ? d.state.heads : {};
    const rows = g.riding().map(r => { const B = A.has(r.id) ? A.get(r.id) : null; const posed = !!B && /^fight_body_/.test(B.clipName || '');
      const h = heads[r.id] || (B ? [B.x, B.y + 1.3, B.z] : null);
      return { ...r, posed, off: h ? +Math.hypot(r.x - h[0], r.y - h[1], r.z - h[2]).toFixed(2) : null, up: B ? +(r.y - B.y).toFixed(2) : null }; });
    return { rows, drops: g.stats().drops, hits: d.state ? d.state.hits : null, phase: d.state ? d.state.phase : null, active: d.active }; })()`);

  async function fight(arm, foe, skipAt = null) {
    if (!(await ev(`!!document.querySelector('[data-row="duel:go"]')`))) await key('b', 'KeyB', 66);
    await page.sleep(400);
    await press(`[data-row="duel-arm:${arm}"]`);
    await press(`[data-row="duel-foe:${foe}"]`);
    await press('[data-row="duel:go"]');
    await page.waitFor('window.__demo.hud.duel.active', 60000, 30);
    let [n, worst, riders, lastHits, lastHitAt, late, skipped] = [0, 0, 0, 0, Date.now(), 0, false];
    const said = new Set();
    for (;;) {
      const L = await look();
      if (L.none) throw new Error('the stage has no blood to watch (gore.riding)');
      if (!L.active) break;
      n += 1;
      if (L.hits !== lastHits) [lastHits, lastHitAt] = [L.hits, Date.now()];
      for (const r of L.rows ?? []) {
        riders += 1;
        worst = Math.max(worst, r.off ?? 0);
        if (r.off !== null && r.off > HEAD && !said.has(r.id)) {
          said.add(r.id);
          fail(`${arm} v ${foe}: a ${r.kind} mark rides ${r.id} ${r.off} m from its head, ${r.up} m over its feet (${L.phase}${r.posed ? ', the body posed by hand' : ''})`);
        }
      }
      if (L.drops > 0 && Date.now() - lastHitAt > 2500) late += 1;
      if (skipAt !== null && !skipped && L.phase === 'fight' && L.hits >= skipAt) {
        skipped = true;
        await key(' ', 'Space', 32);
      }
      await page.sleep(90);
    }
    if (late) fail(`${arm} v ${foe}: drops still in the air 2.5 s after the last blow landed (${late} looks)`);
    // (over, or skipped: three seconds on)
    await page.sleep(3000);
    const E = await look();
    for (const r of E.rows ?? []) if (r.posed || (r.off ?? 0) > HEAD) fail(`${arm} v ${foe}: after it, a ${r.kind} mark rides ${r.id} ${r.off} m from its head${r.posed ? ' (the body still posed by hand)' : ''}`);
    if (E.drops > 0) fail(`${arm} v ${foe}: ${E.drops} drops still in the air three seconds after it`);
    console.log(`${arm} v ${foe}${skipped ? ' (skipped by Space)' : ''}: ${n} looks, ${lastHits} blows landed; marks riding a body seen ${riders} times, the furthest ${worst.toFixed(2)} m from its head; after it: ${(E.rows ?? []).length} riding (${(E.rows ?? []).map(r => `${r.kind} on ${r.id}, ${r.off} m from the head`).join('; ') || 'none'}), ${E.drops} drops`);
    await page.waitFor('window.__demo.hud.phase === "pick"', 60000, 100);
    await page.sleep(600);
  }
  await fight('hands', 'brawler');
  await fight('haymaker', 'quick', 2);
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  if (bad.length) fail(`${bad.length} page errors: ${[...new Set(bad)].slice(0, 3).join(' | ').slice(0, 600)}`);
} catch (err) {
  fail(String(err?.message ?? err));
} finally {
  await browser.close();
  console.log(faults.length ? `blood-fail: ${faults[0]}` : 'blood-ok');
  process.exitCode = faults.length ? 1 : 0;
}
