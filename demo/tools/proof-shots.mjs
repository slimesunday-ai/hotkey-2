#!/usr/bin/env node
// Plays the proof scenes (demo/stage/proof.js) in headless Chrome and saves a picture at every picture point.
// The server must be running: node demo/serve.mjs
//
//   node demo/tools/proof-shots.mjs [--out demo/shots] [--scenes lineup,set,walk,rob,cook,pass,bubble] [--query "tod=night"]
//
// The page stops the city's loop at each picture point and waits for this tool, so a clip is caught on the frame the
// scene names (the contact of a lunge), not wherever a timer happened to land. Prints the scenes' measurements and
// writes them, with the sidewalk distances between the proposed blocks, to <out>/proof.json.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}

const out = path.resolve(opt('--out', 'demo/shots'));
const scenes = opt('--scenes', 'lineup,set,walk,rob,cook,pass,bubble').split(',');
const query = opt('--query', '');
const url = `http://127.0.0.1:${opt('--port', 5470)}/demo/?plain=1&proof=hold${query ? '&' + query : ''}`;

const browser = await launch();
let failed = false;
let page = null;
try {
  page = await browser.open(url);
  const secs = await page.waitFor('window.__demo && window.__demo.proof', 90000);
  console.log(`the city and the cast are up after ${secs.toFixed(1)} s (city ready at ${(await page.evaluate('window.__demo.readySeconds')).toFixed(1)} s)`);
  await page.evaluate(`void window.__demo.proof.run(${JSON.stringify(scenes)}).catch(e => { window.__demo.proof.error = String(e && e.stack || e); })`);
  const t0 = Date.now();
  while (Date.now() - t0 < 600000) {
    const state = await page.evaluate('({ waiting: window.__demo.proof.waiting, done: !!window.__demo.proof.done, error: window.__demo.proof.error || null })');
    if (state.error) throw new Error(`the proof failed in the page: ${state.error}`);
    if (state.waiting) {
      await page.sleep(150);
      const file = await page.shot(path.join(out, `${state.waiting}.jpg`));
      console.log(`saved ${path.relative(process.cwd(), file)}`);
      await page.evaluate('window.__demo.proof.release()');
    } else if (state.done) break;
    await page.sleep(100);
  }
  const results = await page.evaluate('window.__demo.proof.results');
  const links = await page.evaluate('window.__demo.proof.measure()', 60000);
  const fps = await page.evaluate(`new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 4000) r(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`);
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'proof.json'), JSON.stringify({ url, fps, results, links }, null, 1) + '\n');
  console.log(JSON.stringify({ fps, ...results, lineup: undefined }, null, 1));
  console.log((await page.evaluate('window.__demo.proof.log')).join('\n'));
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || l.startsWith('[warning]'));
  if (bad.length) console.log(`page errors and warnings:\n  ${bad.slice(0, 12).join('\n  ').slice(0, 3000)}`);
  const text = await page.evaluate(`document.getElementById('err').textContent + document.getElementById('modfail').textContent`);
  if (text) console.log(`on the page's error plates:\n${text.slice(0, 2000)}`);
} catch (err) {
  failed = true;
  console.error(String(err));
  // what the page itself said, so a failure is never a bare timeout
  if (page) {
    console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
    console.error(await page.evaluate(`document.getElementById('err')?.textContent`, 5000).catch(() => ''));
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
