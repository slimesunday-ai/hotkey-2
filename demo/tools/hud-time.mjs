#!/usr/bin/env node
// How long a season takes on the HUD's own clock: a whole season on auto in headless Chrome at real pace, sped up
// (4× unless --speed says otherwise) and scaled back, so the figure is what 1× would take. The stage is the dev
// stand-in, so this measures the HUD's pacing; the 3D stage adds whatever its scenes run past the HUD's hour.
//
//   node demo/tools/hud-time.mjs             watch and play (the seat's bot answers at once: no thinking time)
//   node demo/tools/hud-time.mjs watch --speed 2
import { launch } from './chrome.mjs';
import { serve, HUD_DEBUG_PORT } from './hud-serve.mjs';

const args = process.argv.slice(2);
const speedAt = args.indexOf('--speed');
const speed = speedAt === -1 ? 4 : Number(args[speedAt + 1]);
const modes = args.filter(a => ['watch', 'play', 'coach'].includes(a));
const server = await serve();
const browser = await launch({ debugPort: HUD_DEBUG_PORT, width: 1280, height: 720 });
try {
  for (const mode of modes.length ? modes : ['watch', 'play']) {
    const page = await browser.open(`${server.url}/demo/hud-dev.html?time=${mode}&speed=${speed}`);
    try {
      await page.waitFor(`/^time-(done|fail)/.test(document.title)`, 600000, 1000);
      console.log(mode, await page.evaluate('document.title'), await page.evaluate('JSON.stringify(window.__timing ?? null)'));
    } catch (err) {
      console.log(mode, err.message);
    }
    for (const line of page.logs.filter(l => /^\[(error|exception)\]/.test(l))) console.log(`  ${line}`);
    page.close();
  }
} finally {
  await browser.close();
  server.stop();
}
// (the DevTools socket can keep Node alive after the browser is gone)
process.exit(0);
