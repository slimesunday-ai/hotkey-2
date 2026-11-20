#!/usr/bin/env node
// THE ROOM UNDER LOAD (room-2; demo/stage/room.js, THE ROOM'S WORK IS BOUNDED). A page once stopped answering in the
// `rough` autoplay (seed 3) while fights were given room. This plays fights and watches the page the whole time:
//   · the page must answer within 2 s, every half second (else: its stack, from a second DevTools socket, and a fail);
//   · during each fight, the room's own work in any one frame (its measure: figures().msMax) must stay under 100 ms;
//   · it prints the page's longest frame during a fight (long animation frames, observed from before the page's own
//     scripts, as demo/tools/perf-probe.mjs does), with the script it was charged to, and the room's longest frame.
// The server must be running: node demo/serve.mjs --port 5499 --quiet
//
//   HK2_DEBUG_PORT=5751 node demo/tools/room-load.mjs --port 5499 --runtest rough [--seed 3] [--days 3] [--times 5]
//   HK2_DEBUG_PORT=5751 node demo/tools/room-load.mjs --port 5499 --forced
//   (--qs '&room=0' with --runtest: the same with the room off, to compare the page's longest frame)
//
// --forced: the fight you are jumped in at the market, with the room told the worst it can be told (room.stress):
// every crowd walker within 8 m past its edge is looked for (`all`), no place out can be reached straight (`noLine`)
// nor round anything (`noWay`), so every look runs its searches and fails, and every walker ends in the fallback.
// Prints `room-load-ok` or `room-load-fail: <why>`.
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, newRun, step, deal } from '../../src/run/index.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const port = opt('--port', 5499);
const forced = process.argv.includes('--forced');
const times = Number(opt('--times', 1));
const LIMIT_MS = 100;
const ANSWER_MS = 2000;
const faults = [];
const fail = why => {
  faults.push(why);
  console.log(`  FAULT: ${why}`);
};

// (before the page's own scripts: every long animation frame, and whether a fight was on when it ended)
const OBSERVE = `(() => {
  const L = (window.__loaf = []);
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        const d = window.__demo;
        const s = (e.scripts || []).slice().sort((a, b) => b.duration - a.duration)[0];
        L.push({ d: Math.round(e.duration), fight: !!(d && d.hud && d.hud.duel && d.hud.duel.active), room: d?.stage?.room?.state?.stats?.msMax ?? null,
          top: s ? \`\${s.sourceFunctionName || '(anon)'} \${(s.sourceURL || '').replace(/^.*?\\/(demo|city|src)\\//, '$1/')} \${Math.round(s.duration)} ms\` : null });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch {}
})();`;

/** The jumped fight at the market, seen off (as run-styles finds it). */
function marketJump() {
  const at = (place, o = {}) => ({ ...newRun({ seed: 3, cfg }), place, energy: 5, ...o });
  for (let day = 2; day < 40; day++) {
    for (let hour = 14; hour < 20; hour++) {
      const s0 = at('market', { day, hour, hoursThere: 2, energy: 4 });
      const s = { ...s0, carried: s0.carried + 60, books: { ...s0.books, earned: s0.books.earned + 60 } };
      const r = step(cfg, s, { do: 'job', id: deal(cfg, s)[0].id });
      const e = r.events.find(x => x.type === 'jumped');
      if (e?.duel?.result === 'won' && e.outcome === 'fail') return { state: s, choice: { do: 'job', id: deal(cfg, s)[0].id } };
    }
  }
  throw new Error('no jumped fight found');
}

async function once(k) {
  const browser = await launch({ width: 1600, height: 1000 });
  let page = null;
  const said = [];
  try {
    page = await browser.open('about:blank');
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVE });
    const url = forced ? `http://127.0.0.1:${port}/demo/?mode=run&seed=3&speed=1` : `http://127.0.0.1:${port}/demo/?mode=run&runtest=${opt('--runtest', 'rough')}&seed=${opt('--seed', '3')}&days=${opt('--days', '3')}&speed=4${opt('--qs', '')}`;
    await page.send('Page.navigate', { url });
    await page.sleep(1500);
    await page.waitFor('window.__demo && window.__demo.hud', 180000);
    if (forced) {
      const C = marketJump();
      await page.waitFor('window.__demo.hud.phase === "choose"', 180000);
      await page.evaluate(`window.__demo.hud.load(${JSON.stringify(C.state)})`, 60000);
      await page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.duel.active', 120000, 100);
      await page.sleep(1500);
      const v = await page.evaluate('window.__demo.hud.view');
      const want = v.choices.find(x => x.choice.do === C.choice.do && x.choice.id === C.choice.id);
      await page.evaluate(`window.__demo.hud.pick(${JSON.stringify(want.key)})`);
      await page.evaluate('Object.assign(window.__demo.stage.room.stress, { all: 8, noLine: true, noWay: true }), true');
      await page.sleep(300);
      for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    }
    // THE WATCH: an answer every half second, within 2 s, until it is done
    const t0 = Date.now();
    let seenFight = false;
    for (;;) {
      const t = Date.now();
      const r = await page.evaluate('({ done: !!window.__runtest, fight: !!(window.__demo.hud.duel && window.__demo.hud.duel.active), n: window.__demo.hud.duel.log.length })', ANSWER_MS).catch(() => 'HUNG');
      if (r === 'HUNG') {
        fail(`run ${k}: the page did not answer for ${((Date.now() - t) / 1000).toFixed(1)} s, ${((t - t0) / 1000).toFixed(0)} s in`);
        const targets = await fetch(`http://127.0.0.1:${process.env.HK2_DEBUG_PORT || 5479}/json/list`).then(x => x.json());
        const ws = new WebSocket(targets.find(x => x.type === 'page').webSocketDebuggerUrl);
        await new Promise(res => (ws.onopen = res));
        const frames = new Promise(res => (ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.method === 'Debugger.paused') res(m.params.callFrames.slice(0, 12).map(f => `${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/')}:${f.location.lineNumber + 1}`)); }));
        ws.send(JSON.stringify({ id: 1, method: 'Debugger.enable' }));
        ws.send(JSON.stringify({ id: 2, method: 'Debugger.pause' }));
        console.log(`  where it was: ${JSON.stringify(await Promise.race([frames, new Promise(res => setTimeout(() => res('(no pause)'), 15000))]))}`);
        break;
      }
      if (r.fight) seenFight = true;
      if (forced ? seenFight && !r.fight : r.done) break;
      if (Date.now() - t0 > 1200000) {
        fail(`run ${k}: not done in 20 minutes`);
        break;
      }
      await page.sleep(500);
    }
    if (faults.length) return;
    const got = await page.evaluate(`({ log: window.__demo.hud.duel.log.map(r => ({ foes: r.foes, skipped: r.skipped, room: r.anim && r.anim.crowd })), stats: window.__demo.stage.room.state.stats, loaf: window.__loaf })`, 20000);
    const during = got.loaf.filter(l => l.fight).sort((a, b) => b.d - a.d);
    const S = got.stats;
    console.log(`run ${k}: ${got.log.length} fights; the room's longest frame ${S.msMax} ms (a search at most ${S.searchMsMax} ms; ${S.searches} searches, ${S.deferred} looks put off to the next frame, ${S.noPlace} in vain, ${S.fallback} fallbacks, ${S.startled} startled out, ${S.crossed ?? 0} crossed); the page's longest frame during a fight ${during[0] ? `${during[0].d} ms (${during[0].top ?? 'no script named'})` : 'none over 50 ms'}; long frames during fights ${during.length}`);
    for (const [i, f] of got.log.entries()) {
      const R = f.room;
      if (!R) continue;
      console.log(`  fight ${i + 1}: ${f.foes} of them; the room's longest frame ${R.msMax ?? '?'} ms; ${R.on} frames with somebody on its ground, ${R.lingers} lingered, nearest ${R.nearest} m past its edge`);
      if ((R.msMax ?? 0) > LIMIT_MS) fail(`run ${k}, fight ${i + 1}: the room took ${R.msMax} ms in one frame (at most ${LIMIT_MS})`);
    }
    if (!got.log.length) fail(`run ${k}: no fight was played`);
    said.push(page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]')));
    if (said.flat().length) fail(`run ${k}: page errors: ${said.flat().slice(0, 3).join(' | ').slice(0, 600)}`);
  } catch (err) {
    fail(`run ${k}: ${String(err?.stack ?? err).slice(0, 600)}`);
  } finally {
    await browser.close();
  }
}

for (let k = 1; k <= (forced ? 1 : times); k++) await once(k);
console.log(faults.length ? `room-load-fail: ${faults[0]}` : 'room-load-ok');
process.exit(faults.length ? 1 : 0);
