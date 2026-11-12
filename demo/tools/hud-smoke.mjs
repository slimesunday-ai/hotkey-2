#!/usr/bin/env node
// The HUD's browser smoke run: a whole season on auto in each of the three ways to sit, in headless Chrome, through
// the HUD's real controls (demo/hud/dev.js, ?selftest=). Prints each page's final title: `hud-ok`, or `hud-fail: why`.
//
//   node demo/tools/hud-smoke.mjs            play, watch and coach, then a season with the keyboard alone (keys)
//   node demo/tools/hud-smoke.mjs play       one of them
//
// Starts its own server (port 5471) and its own browser, and stops both by process id. Exits 1 when any run fails.
import { launch } from './chrome.mjs';
import { serve, HUD_DEBUG_PORT } from './hud-serve.mjs';

const modes = process.argv.slice(2).filter(a => ['play', 'watch', 'coach', 'keys'].includes(a));
const server = await serve();
const browser = await launch({ debugPort: HUD_DEBUG_PORT, width: 1440, height: 900 });
let failed = 0;
try {
  for (const mode of modes.length ? modes : ['play', 'watch', 'coach', 'keys']) {
    const page = await browser.open(`${server.url}/demo/hud-dev.html?selftest=${mode}`);
    const t0 = Date.now();
    let title;
    try {
      await page.waitFor(`/^hud-(ok|fail)/.test(document.title)`, 120000);
      title = await page.evaluate('document.title');
    } catch (err) {
      title = `hud-fail: ${err.message}`;
    }
    const seen = await page.evaluate('JSON.stringify(window.__selftest ?? null)').then(JSON.parse, () => null);
    const bad = page.logs.filter(l => /^\[(error|exception)\]/.test(l));
    if (title !== 'hud-ok' || bad.length) failed += 1;
    if (seen?.keysOnly) console.log(`${mode.padEnd(5)}  ${title}  (${((Date.now() - t0) / 1000).toFixed(1)}s, ${seen.hours} hours, ${seen.picked} moves picked by number and sent with Enter, ${seen.held} held hours carried on with Enter, ${seen.sheets} sheets filled by key)`);
    else console.log(`${mode.padEnd(5)}  ${title}  (${((Date.now() - t0) / 1000).toFixed(1)}s${seen ? `, ${seen.hours} hours, ${seen.sheets} sheets, ${seen.picked} menu picks, ${seen.said} lines said, ${seen.yes} offers taken, ${seen.carded} card picks, ${seen.held} hours held, ${seen.autoRuns} auto runs, ${seen.drawers} drawers opened, ${seen.marks} hours with a coach mark, ${Math.round(seen.clear * 100)}% of the window clear at worst${seen.keys ? ', keys worked' : ''}${seen.intro ? ', explainer shown' : ''}${seen.resumed ? ', saved and carried on once' : ''}` : ''})`);
    for (const line of bad) console.log(`       ${line}`);
    for (const line of page.failed.filter(f => !/fonts\.g/.test(f))) console.log(`       network: ${line}`);
    page.close();
  }
} finally {
  await browser.close();
  server.stop();
}
process.exit(failed ? 1 : 0);
