#!/usr/bin/env node
// Plays a season over the real stage in headless Chrome and reports how it went.
// The server must be running: node demo/serve.mjs
//
//   node demo/tools/stage-run.mjs --mode watch|play [--speed 1|2|4] [--seed 4] [--hours N] [--shots demo/shots/stage]
//                                 [--offline] [--query "q=medium"]
//
// The page is /demo/?stagetest=<mode> (demo/stage/director-test.js): the panels on auto over the stage. It ends with
// the title `stage-ok` or `stage-fail: <why>`; this prints the numbers it left (hours, wall clock, frames a second).
// With --shots, a picture is taken the first time each of these is on stage (the camera is cut in on the scene first): a robbery with the roll over it, a
// hand-off, a street sale, an arrest, a spoken bubble, a phone chip, a confessional, the wide set early on, the fifth
// hour (in play: the camera with the player), a night hour, the pen and the tent with someone in them, and (in play)
// the player's own pad open.
// --offline points the three.js CDN at a dead address, to prove the page needs no network for it.
import path from 'node:path';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const mode = opt('--mode', 'watch');
const shots = opt('--shots', null);
const params = new URLSearchParams({ stagetest: mode, seed: opt('--seed', '4'), speed: opt('--speed', '1') });
if (opt('--hours', null)) params.set('hours', opt('--hours'));
const url = `http://127.0.0.1:${opt('--port', 5470)}/demo/?${params}${opt('--query', '') ? '&' + opt('--query', '') : ''}`;

/** A picture point: what must be true in the page, and how long after it first is to press the shutter (ms). */
const WANTED = [
  { name: 'robbery', delay: 1200, show: '^(rob|npc:robbers|fight)', test: `!!document.querySelector('.hk-roll') && S.playing.some(s => /^(rob|npc:robbers|fight)/.test(s.kind))` },
  { name: 'hand-off', delay: 2600, show: '^(pickup|gift)$', test: `S.playing.some(s => s.kind === 'pickup' || s.kind === 'gift')` },
  { name: 'street-sale', delay: 2600, show: '^work:deal$', test: `S.playing.some(s => s.kind === 'work:deal')` },
  { name: 'arrest', delay: 2800, show: '^arrest$|:(arrest|bust|sting)$', test: `S.playing.some(s => s.kind === 'arrest' || /:(arrest|bust|sting)$/.test(s.kind))` },
  { name: 'talk-out-loud', delay: 500, test: `!!document.querySelector('.hk-air .hk-say, .hk-air [class*="say"], .hk-air [class*="bubble"]')` },
  { name: 'talk-phone', delay: 400, test: `!!document.querySelector('.hk-air .hk-phone-icon')` },
  { name: 'talk-confessional', delay: 600, test: `!!document.querySelector('.hk-lower')` },
  { name: 'opening', delay: 3000, focus: 'projects', test: `S.hours === 1` },
  { name: 'wide-set', delay: 2500, test: `S.hours === 2 && !S.following` },
  { name: 'night', delay: 5000, test: `S.clock && S.clock.hour >= 22` },
  { name: 'pen', delay: 3000, focus: 'jail', test: `S.inside.some(p => p.key === 'jail')` },
  { name: 'tent', delay: 3000, focus: 'clinic', test: `S.inside.some(p => p.key === 'clinic')` },
  { name: 'own-pad', delay: 3500, test: `S.inside.some(p => p.id === S.you && p.key.startsWith('pad:') && p.shown)` },
  { name: 'hour-five', delay: 3500, test: `S.hours === 5` },
];

const browser = await launch(process.argv.includes('--offline') ? { flags: ['--host-resolver-rules=MAP cdn.jsdelivr.net 127.0.0.1:9'] } : {});
let failed = false;
let page = null;
try {
  const t0 = Date.now();
  page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud', 120000);
  console.log(`the city, the stage and the panels are up after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  // --audit: count jumps, clip flips and people standing in each other, every frame of the run
  if (process.argv.includes('--audit')) await page.evaluate('window.__demo.stage.actors.audit(true)');
  const todo = shots ? WANTED.map(w => ({ ...w, since: null })) : [];
  const limit = Number(opt('--limit', 1700)) * 1000;
  let title = '';
  while (Date.now() - t0 < limit) {
    title = await page.evaluate('document.title', 10000).catch(() => '');
    if (title.startsWith('stage-')) break;
    for (const want of todo.filter(w => !w.done)) {
      const on = await page.evaluate(`(() => { const S = window.__demo.stage.debug(); return ${want.test}; })()`, 5000).catch(() => false);
      if (!on) continue;
      if (!want.since) {
        want.since = Date.now();
        // a picture of a scene wants the camera on that scene, whatever else is playing
        if (want.show) await page.evaluate(`window.__demo.stage.showScene(new RegExp(${JSON.stringify(want.show)}))`, 5000).catch(() => {});
        if (want.focus) await page.evaluate(`window.__demo.stage.focus(${JSON.stringify(want.focus)})`, 5000).catch(() => {});
      }
      if (Date.now() - want.since < want.delay) continue;
      want.done = true;
      const file = await page.shot(path.join(path.resolve(shots), `${mode}-${want.name}.jpg`));
      console.log(`saved ${path.relative(process.cwd(), file)}`);
      // a picture that took the camera somewhere gives it back
      if (want.focus) await page.evaluate('window.__demo.stage.focus(null)', 5000).catch(() => {});
    }
    await page.sleep(todo.some(w => !w.done) ? 120 : 1000);
  }
  console.log(title || 'no verdict: the run outlasted this tool');
  console.log(JSON.stringify(await page.evaluate('window.__stagetest ?? window.__demo.stage.debug()', 10000), null, 1));
  const missed = todo.filter(w => !w.done).map(w => w.name);
  if (missed.length) console.log(`never on stage, so no picture: ${missed.join(', ')}`);
  const cdn = page.failed.filter(f => f.includes('jsdelivr'));
  if (cdn.length) console.log(`requests to the three.js CDN that failed: ${cdn.length}`);
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  if (bad.length) console.log(`page errors:\n  ${[...new Set(bad)].slice(0, 12).join('\n  ').slice(0, 3000)}`);
  failed = !title.startsWith('stage-ok');
} catch (err) {
  failed = true;
  console.error(String(err));
  if (page) {
    console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
    console.error(await page.evaluate(`document.getElementById('err')?.textContent`, 5000).catch(() => ''));
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
