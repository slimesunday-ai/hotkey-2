#!/usr/bin/env node
// Screenshots of the demo page from any number of cameras, in ONE page load (a load builds the city: about 20 s).
// The server must be running: node demo/serve.mjs
//
//   node demo/tools/look.mjs --out demo/shots  name=x,y,z/x,y,z[/fov[/fogNear,fogFar]]  name2=…  [--query "tod=night&q=high"]
//                            [--eval "js run in the page before the first shot"] [--settle 1500] [--port 5470]
//
// A camera is where it stands / what it looks at / its field of view (default 50) / its own haze band in metres (an
// overhead from above 150 m is washed out by the city's haze unless the band is pushed back). Each shot waits until the blocks
// in view have streamed in, then `--settle` ms more. Files are JPEGs: a PNG of this noisy picture is several MB and
// Node's WebSocket drops a message that large (measured here: the DevTools socket closes with code 1006).
import path from 'node:path';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}

const flags = new Set(['--out', '--query', '--eval', '--settle', '--port', '--width', '--height']);
const shots = process.argv.slice(2).filter((a, k, all) => a.includes('=') && !a.startsWith('--') && !flags.has(all[k - 1]));
const out = path.resolve(opt('--out', 'demo/shots'));
const settle = Number(opt('--settle', 1500));
const port = Number(opt('--port', 5470));
const query = opt('--query', '');
const url = `http://127.0.0.1:${port}/demo/?plain=1${query ? '&' + query : ''}`;

const browser = await launch({ width: Number(opt('--width', 1600)), height: Number(opt('--height', 1000)) });
let failed = false;
try {
  const page = await browser.open(url);
  const secs = await page.waitFor('window.__demo && window.__demo.readySeconds', 150000);
  console.log(`page ready after ${secs.toFixed(1)} s (the page says ${(await page.evaluate('window.__demo.readySeconds')).toFixed(1)} s)`);
  if (opt('--eval', '')) console.log('eval →', JSON.stringify(await page.evaluate(opt('--eval', ''))));
  for (const spec of shots) {
    const name = spec.slice(0, spec.indexOf('='));
    const [pos, tgt, fov = '50', fog = ''] = spec.slice(name.length + 1).split('/');
    await page.evaluate(`(() => {
      const c = window.__city, p = [${pos}], t = [${tgt}];
      c.VIEWS.look = { pos: p, tgt: t, fov: ${Number(fov)}, ${fog ? `fog: [${fog}], ` : ''}sh: [(p[0] + t[0]) / 2, (p[2] + t[2]) / 2, Math.max(16, Math.hypot(p[0] - t[0], p[2] - t[2]) * .8)] };
      c.cam?.toOrbit({ instant: true });
      c.setView('look');
    })()`);
    await page.sleep(400);
    await page.waitFor('window.__city.stream.settled()', 60000).catch(() => console.log(`  ${name}: the stream never settled, shooting anyway`));
    await page.sleep(settle);
    const file = await page.shot(path.join(out, `${name}.jpg`));
    console.log(`saved ${path.relative(process.cwd(), file)}`);
  }
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  if (bad.length) console.log(`page errors:\n  ${bad.slice(0, 10).join('\n  ').slice(0, 2000)}`);
  if (page.failed.length) console.log(`failed requests:\n  ${[...new Set(page.failed)].slice(0, 10).join('\n  ')}`);
} catch (err) {
  failed = true;
  console.error(String(err));
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
