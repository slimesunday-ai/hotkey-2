#!/usr/bin/env node
// Does the menu fit? A whole played season for each of the four seats offered first, at 1280x720, with the menu
// measured at every prompt: how many hours it had to scroll, and the worst of them. (demo/hud/dev.js, ?fit=<seat>)
//
//   node demo/tools/hud-fit.mjs                      dealer, robber, smuggler, cook at seeds 3 and 5
//   node demo/tools/hud-fit.mjs cook --seed 8 --size 1440x900
//
// Starts its own server and browser and stops both by process id. Exits 1 when any hour scrolled.
import { launch } from './chrome.mjs';
import { serve, HUD_DEBUG_PORT } from './hud-serve.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const [width, height] = flag('--size', '1280x720').split('x').map(Number);
const seeds = args.includes('--seed') ? [Number(flag('--seed'))] : [3, 5];
const seats = args.filter(a => ['dealer', 'robber', 'smuggler', 'cook', 'gunrunner', 'muscle', 'informant'].includes(a));
const server = await serve();
const browser = await launch({ debugPort: HUD_DEBUG_PORT, width, height });
let scrolled = 0;
try {
  for (const seat of seats.length ? seats : ['dealer', 'robber', 'smuggler', 'cook']) {
    for (const seed of seeds) {
      const page = await browser.open(`${server.url}/demo/hud-dev.html?fit=${seat}&seed=${seed}`);
      try {
        await page.waitFor(`/^fit-(done|fail)/.test(document.title)`, 120000);
        const out = await page.evaluate('JSON.stringify(window.__fit ?? document.title)').then(JSON.parse);
        if (typeof out === 'string') throw new Error(out);
        scrolled += out.overflowed;
        console.log(`${seat.padEnd(9)} seed ${String(seed).padEnd(3)} ${out.size}  ${out.prompts} prompts, ${out.overflowed} scrolled${out.overflowed ? ` (worst ${out.worst}px at ${out.worstAt})` : ''}; tightness 0/1/2/3/4: ${out.tight.join('/')}; ${out.errands} errand rows shown, ${out.held} hours held`);
      } catch (err) {
        scrolled += 1;
        console.log(`${seat} seed ${seed}: ${err.message}`);
      }
      for (const line of page.logs.filter(l => /^\[(error|exception)\]/.test(l))) console.log(`  ${line}`);
      page.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}
process.exit(scrolled ? 1 : 0);
