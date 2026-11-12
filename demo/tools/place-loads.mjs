#!/usr/bin/env node
// Measures LOADING BY PLACE: how long each zone takes to stand, cold and with the browser's block cache warm.
// The server must be running: node demo/serve.mjs
//
//   node demo/tools/place-loads.mjs [--port 5470] [--workers 3] [--json out.json]
//
// A zone is the places that load together (demo/stage/citymap.js ZONES). Four passes, each a page of the game with
// the season held still:
//   cold, at the cut      a new browser profile (nothing cached). The picture cuts to each zone in turn and waits
//                         for it: the seconds are the whole build, with the camera there
//   warm, at the cut      the same profile, the page loaded again: every block is in the browser's cache
//   cold, built ahead     another new profile. Each zone is built ahead first, the way a departure does it
//                         (loader.prepare: the seconds a departure has to cover), and then cut to: the seconds the
//                         cut itself waits, black
//   warm, built ahead     the same, the page loaded again
// The first zone's figure is the page's own start (boot.js: the seconds until the stage could be made).
// Memory is the city's own count for its stream (MB of block data and of GPU meshes) after each cut, and the page's
// heap. The last pass goes round the zones twice: the second round's memory beside the first says whether anything
// is left behind.
// --workers N gives the city N build workers (?workers=N; a laptop stand-in is 3). The default is the city's own:
// one less than the machine's cores, 8 at most.
import { writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const workers = opt('--workers', null);
const url = `http://127.0.0.1:${opt('--port', 5470)}/demo/?mode=watch&seed=4${workers ? `&workers=${workers}` : ''}`;
const UP = 'window.__demo && window.__demo.hud && window.__demo.stage && window.__demo.stage.debug().people > 0';

/** One page of the game, the season held: cuts to every zone in turn. → [{ zone, places, ahead, cut, blocks, cpu, gpu, heap }] */
async function pass(page, { ahead, rounds = 1 }) {
  await page.waitFor(UP, 240000);
  await page.evaluate('window.__demo.hud.pause?.(true)');
  await page.sleep(400);
  return page.evaluate(`(async () => {
    const S = window.__demo.stage;
    const { ZONES } = S.map;
    const rows = [{ zone: S.loader.zone, places: ZONES[S.loader.zone].places, ahead: null, cut: +window.__demo.readySeconds.toFixed(2), start: true, blocks: window.__demo.small?.blocks ?? null, ...S.loader.memory(), workers: window.__city.pool?.n ?? null }];
    for (let round = 0; round < ${rounds}; round++) {
      for (const z of Object.keys(ZONES)) {
        if (z === S.loader.zone) continue;
        let built = null;
        if (${ahead}) built = await S.loader.prepare(z);
        await S.showPlace(ZONES[z].places[0]);
        const L = S.loader.log.at(-1);
        // (a breath, as play would give it: the stream frees what it left behind on its own frames)
        await new Promise(r => setTimeout(r, 1500));
        rows.push({ zone: z, round, places: ZONES[z].places, ahead: built ? { seconds: built.seconds, built: built.built, cached: built.cached } : null, cut: L.seconds, stood: L.stood, blocks: L.blocks, ...S.loader.memory() });
      }
    }
    return rows;
  })()`, 600000);
}

const out = { url, workers: workers ? Number(workers) : 'default', passes: {} };
let failed = false;
for (const [name, ahead] of [['at the cut', false], ['built ahead', true]]) {
  const browser = await launch({ width: 1600, height: 1000 });
  try {
    const page = await browser.open(url);
    out.passes[`cold, ${name}`] = await pass(page, { ahead });
    await page.send('Page.navigate', { url: 'about:blank' });
    await page.sleep(800);
    await page.send('Page.navigate', { url });
    await page.sleep(1500);
    out.passes[`warm, ${name}`] = await pass(page, { ahead, rounds: ahead ? 2 : 1 });
    const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
    if (bad.length) console.log(`page errors:\n  ${[...new Set(bad)].slice(0, 8).join('\n  ').slice(0, 2000)}`);
  } catch (err) {
    failed = true;
    console.error(String(err));
  } finally {
    await browser.close();
  }
}

const P = out.passes;
const first = Object.values(P)[0] ?? [];
out.workers = first[0]?.workers ?? out.workers;
console.log(`build workers: ${out.workers}${workers ? ' (asked for)' : ' (the city\'s default on this machine)'}`);
console.log('seconds per zone                      cold, at the cut   warm, at the cut   cold: ahead + cut    warm: ahead + cut   blocks   MB data / GPU / heap');
const cell = (rows, z) => rows?.find(r => r.zone === z && !r.round) ?? rows?.find(r => r.zone === z);
for (const row of first) {
  const z = row.zone;
  const [a, b, c, d] = ['cold, at the cut', 'warm, at the cut', 'cold, built ahead', 'warm, built ahead'].map(k => cell(P[k], z));
  const both = r => (r ? (r.ahead ? `${r.ahead.seconds.toFixed(2)} + ${r.cut.toFixed(2)}` : `${r.cut.toFixed(2)}${r.start ? ' (start)' : ''}`) : '—');
  console.log(`${(z + ' (' + row.places.join(', ') + ')').padEnd(38)}${both(a).padEnd(19)}${both(b).padEnd(19)}${both(c).padEnd(21)}${both(d).padEnd(20)}${String(row.blocks ?? '').padEnd(9)}${a ? `${a.cpu} / ${a.gpu} / ${a.heap}` : ''}`);
}
const two = P['warm, built ahead'] ?? [];
if (two.some(r => r.round === 1)) {
  console.log('memory, the second time round the same zones (MB data / GPU / heap, first → second):');
  for (const r of two.filter(q => q.round === 1)) {
    const f = two.find(q => q.zone === r.zone && (q.round === 0 || q.start));
    if (f) console.log(`  ${r.zone.padEnd(10)} ${f.cpu} / ${f.gpu} / ${f.heap}  →  ${r.cpu} / ${r.gpu} / ${r.heap}`);
  }
}
if (opt('--json', null)) writeFileSync(opt('--json', null), `${JSON.stringify(out, null, 1)}\n`);
process.exit(failed ? 1 : 0);
