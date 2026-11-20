#!/usr/bin/env node
// THE PLAYER WALKED DOWN A BUSY SIDE STREET AND AN AVENUE, AGAINST THE CROWD (walk-1; the owner: "There's lots of
// interactions/people walking into you"). The run's own page at a place (the market by default, day 2 at 15:00), the
// player (a1) walked by the game (actors.walkTo, the stage's own way: what a trip's leg on foot or a scene's way does)
// along one 3 m side street walk and one 4 m avenue walk, against the crowd's ring, filmed from the game's own camera
// (untouched) and measured while he walks: the stage's audit `crowd` for the player (actors.js auditCrowd: meetings
// with the crowd's walkers, through < 0.6 m, squeezed < 1.0 m, held, aside, clear), how far off the walkers' lane he
// walked (the median, on the walk's middle stretch), the crowd within 20 m of him, and the city's own count of its
// walkers coming on or going off in the picture (peds.js stats). The same walk with the page's switches for the code as
// it was: --query "k2walk=0&thin=0&kerb=0" (the crowd as before the city's walk-1, no thinning, the lane).
// The server must be running: node demo/serve.mjs --port 5524 --quiet
//
//   HK2_DEBUG_PORT=5788 node demo/tools/walk-film.mjs --out <dir> [--port 5524] [--seed 3] [--place market]
//        [--query "k2walk=0&thin=0&kerb=0"] [--side x,z] [--avenue x,z] [--settle 20] [--label after]
//
// --side / --avenue: the middle of the walk to take (the nearest of that width to it); by default the walk of that width
// within 90 m of the player with the most walkers on it, after --settle s (printed, to pass to the other run).
// Writes <dir>/<label>-<street>/f-NNN.jpg, <dir>/<label>-<street>.mp4 (ffmpeg, 10 frames a second) and
// <dir>/<label>.json; prints one line per street and `walk-film-ok` (or `walk-film-fail: <why>`).
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/walk'));
const port = opt('--port', 5524);
const query = opt('--query', '');
const label = opt('--label', query ? 'before' : 'after');
const place = opt('--place', 'market');
const settle = Number(opt('--settle', 20));
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${opt('--seed', '3')}${query ? '&' + query : ''}`;
const STATES = {
  market: { place: 'market', day: 2, hour: 15, banked: 40, carried: 20, energy: 6, heat: 0, placeHeat: {} },
  plaza: { place: 'plaza', day: 2, hour: 15, banked: 40, carried: 20, energy: 6, heat: 0, placeHeat: {} },
};
const WIDTH = { side: 3, avenue: 4 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync(out, { recursive: true });
const browser = await launch({ width: 1280, height: 800 });
const report = { url, label, place, streets: {} };
let fail = null;
try {
  const page = await browser.open(url);
  const ev = (js, ms = 60000) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 300000, 250);
  const ok = await ev(`(async () => { const h = window.__demo.hud; const s = structuredClone(h.state); const f = ${JSON.stringify(STATES[place])};
    Object.assign(s, { people: {}, shifts: {}, today: {}, door: null, hoursThere: 0 }, f); s.books.earned += (s.carried + s.banked) - (h.state.carried + h.state.banked); return await h.load(s); })()`, 180000);
  if (!ok) throw new Error(`${place}: the run would not load the state`);
  await page.waitFor('window.__demo.hud.phase === "choose"', 150000, 100);
  await sleep(settle * 1000);
  // (in the page: the walks of a width near the player, the sampler of the player's line and crowd)
  await ev(`(() => {
    const sim = window.__city.peds.sim, S = window.__demo.stage, A = S.actors;
    window.__wf = {
      pick(width, near) {
        const P = A.get('a1');
        const [cx, cz] = near ?? [P.x, P.z];
        let best = null;
        for (const E of sim.edges) {
          if (E.cross || E.joint || Math.abs((E.sw || 2) - width) > 0.2 || E.len < 22) continue;
          const mx = (E.from.x + E.to.x) / 2, mz = (E.from.z + E.to.z) / 2, d = Math.hypot(mx - cx, mz - cz);
          if (near ? d > 30 : d > 90) continue;
          const score = near ? -d : (E.list?.filter(w => !w.agent && !w.hk2).length ?? 0) - d * 0.01;
          if (!best || score > best.score) best = { E, score, mid: [+mx.toFixed(1), +mz.toFixed(1)] };
        }
        if (!best) return null;
        const E = best.E, at = f => [E.from.x + (E.to.x - E.from.x) * f, E.from.z + (E.to.z - E.from.z) * f];
        // (against the ring: the crowd walks each side from its 'from' corner to its 'to' one)
        window.__wf.E = E;
        return { mid: best.mid, len: +E.len.toFixed(1), sw: E.sw, walkers: E.list?.filter(w => !w.agent && !w.hk2).length ?? 0, start: at(0.9), end: at(0.1) };
      },
      on: false, off: [], near: 0, frames: 0,
    };
    A.onFrame(() => {
      const W = window.__wf; if (!W.on) return;
      const P = A.get('a1'), E = W.E;
      if (!P || P.w.hide) return;
      const ux = (E.to.x - E.from.x) / E.len, uz = (E.to.z - E.from.z) / E.len, s = (P.x - E.from.x) * ux + (P.z - E.from.z) * uz;
      if (s > 6 && s < E.len - 6) { const L = A.laneLine(P.x, P.z); if (L) W.off.push(L.d(P.x, P.z)); }
      let n = 0; for (const w of sim.walkers) if (!w.hk2 && !w.agent && !w.hide && Math.hypot(w.p[0] - P.x, w.p[2] - P.z) < 20) n++;
      W.near += n; W.frames++;
    });
    return true;
  })()`);
  for (const street of ['side', 'avenue']) {
    const near = opt(`--${street}`, null)?.split(',').map(Number) ?? null;
    const W = await ev(`window.__wf.pick(${WIDTH[street]}, ${JSON.stringify(near)})`);
    if (!W) {
      fail = `no ${WIDTH[street]} m walk near the player`;
      console.log(`${street}: ${fail}`);
      continue;
    }
    // to the start of it (not filmed), then along it against the ring, filmed
    await ev(`window.__demo.stage.actors.walkTo('a1', ${W.start[0]}, ${W.start[1]}, { v: 1.4 })`, 180000);
    await sleep(1500);
    await ev(`(() => { const S = window.__demo.stage; S.actors.audit(true); Object.assign(window.__wf, { on: true, off: [], near: 0, frames: 0, done: false }); S.actors.walkTo('a1', ${W.end[0]}, ${W.end[1]}, { v: 1.4 }).then(() => { window.__wf.done = true; }); return true; })()`);
    const dir = path.join(out, `${label}-${street}`);
    let k = 0;
    const t0 = Date.now();
    while (!(await ev('window.__wf.done')) && Date.now() - t0 < 120000) {
      await page.shot(path.join(dir, `f-${String(k++).padStart(3, '0')}.jpg`));
      await sleep(60);
    }
    for (let q = 0; q < 8; q++) {
      await page.shot(path.join(dir, `f-${String(k++).padStart(3, '0')}.jpg`));
      await sleep(60);
    }
    const r = await ev(`(() => { const W = window.__wf; W.on = false; const a = window.__demo.stage.actors.audit(false); const off = W.off.slice().sort((x, y) => x - y);
      return { crowd: a.crowd?.player ?? null, pops: a.crowdPops, offLane: off.length ? +off[Math.floor(off.length / 2)].toFixed(2) : null, near20: W.frames ? +(W.near / W.frames).toFixed(1) : null, seconds: +(a.crowd?.streetSeconds ?? 0).toFixed(1),
        notes: a.examples.filter(e => e.startsWith('crowd ')).slice(0, 8) }; })()`);
    const film = path.join(out, `${label}-${street}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '10', '-i', path.join(dir, 'f-%03d.jpg'), '-vf', 'scale=1280:-2', '-pix_fmt', 'yuv420p', film]);
    report.streets[street] = { ...W, ...r, frames: k, film };
    const C = r.crowd ?? {};
    console.log(`${label} ${street} (a ${W.sw} m walk at ${W.mid.join(', ')}, ${W.len} m, ${W.walkers} walkers on it at the start): meetings ${C.meet ?? '-'} (through ${C.through ?? '-'}, squeezed ${C.squeezed ?? '-'}, held ${C.held ?? '-'}, aside ${C.aside ?? '-'}, clear ${C.clear ?? '-'}); off the lane ${r.offLane} m (median); within 20 m ${r.near20}; came on in the picture ${r.pops?.spawns ?? '-'}, went off ${r.pops?.removals ?? '-'}; ${r.seconds} s; ${k} frames → ${film}`);
    for (const n of r.notes) console.log(`  ${n}`);
  }
  writeFileSync(path.join(out, `${label}.json`), JSON.stringify(report, null, 1));
} catch (err) {
  fail = String(err);
} finally {
  await browser.close();
}
console.log(fail ? `walk-film-fail: ${fail}` : 'walk-film-ok');
process.exit(fail ? 1 : 0);
