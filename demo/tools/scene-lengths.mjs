#!/usr/bin/env node
// HOW LONG THE RUN'S ROBBERY AND DEBT SCENES TAKE NOW, in stage seconds (1×: the stage clock runs at the speed it is
// played at, so its seconds are 1× seconds whatever the panels' speed). Each is played as the run plays it: a loaded
// state at the place (as run-people-shots.mjs carries the run to a job), the roll rigged to win or to fail, the option
// taken with its key. Prints, for each, the director's own log of the scene: when it began, how long it took, and
// each step's seconds. The server must be running: node demo/serve.mjs
//
//   node demo/tools/scene-lengths.mjs [--port 5681] [--seed 3] [--place park] [--times 2]
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const url = `http://127.0.0.1:${opt('--port', 5681)}/demo/?mode=run&seed=${opt('--seed', '3')}`;
const place = opt('--place', 'park');
const times = Number(opt('--times', 2));
const CASES = [
  { name: 'debt (collect, paid)', job: 'collect', chances: [0], kind: /^collect:win/ },
  { name: 'debtFail (collect, refused)', job: 'collect', chances: [99], kind: /^collect:lose/ },
  { name: 'rob (robbing somebody passing, works)', job: 'rob', chances: [0], kind: /^run:rob$/ },
  { name: 'robFail (robbing somebody passing, fails)', job: 'rob', chances: [99], kind: /^run:rob:fail/ },
];

const browser = await launch({ width: 1600, height: 1000 });
let page = null;
let failed = false;
try {
  page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 150000);
  await page.sleep(2000);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const key = k => ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);
  const choosing = () => page.waitFor('window.__demo.hud.phase === "choose"', 120000, 100);
  for (const C of CASES) {
    for (let n = 0; n < times; n++) {
      await choosing();
      const k = await ev(`(async () => {
        const h = window.__demo.hud, { RUN_CONFIG: cfg, view } = await import('/src/run/index.mjs');
        // (from the run's first state each time: a debt collected is not dealt again that day)
        window.__base0 ??= structuredClone(h.state);
        const base = structuredClone(window.__base0);
        Object.assign(base, { place: ${JSON.stringify(place)}, energy: 10, heat: 0, carried: 0, hoursThere: 0, owned: { ...base.owned, cutter: true }, shifts: {}, rig: { chances: ${JSON.stringify(C.chances)}, rolls: [] } });
        for (let hour = 10; hour <= 19; hour++) {
          const s = structuredClone(base);
          s.hour = hour;
          const v = view(cfg, s);
          const o = [...v.options, ...(v.moves ?? [])].find(o => (o.id === ${JSON.stringify(C.job)} || o.what === ${JSON.stringify(C.job)}) && o.available);
          if (o) { await h.load(s); return o.key; }
        }
        return null; })()`, 60000);
      if (k === null) {
        console.log(`${C.name}: no hour deals it at ${place}`);
        break;
      }
      await page.sleep(1500);
      const before = await ev('window.__demo.stage.director.log.length');
      await key(String(k));
      await key('Enter');
      await page.sleep(1000);
      await choosing();
      await page.sleep(500);
      const e = await ev(`window.__demo.stage.director.log.slice(${before}).filter(e => ${C.kind}.test(e.kind)).map(e => ({ kind: e.kind, began: e.began, waited: e.waited, took: e.took, steps: e.steps }))`);
      if (!e.length) console.log(`${C.name}: not staged (log: ${JSON.stringify(await ev(`window.__demo.stage.director.log.slice(${before}).map(e => e.kind)`))})`);
      for (const x of e) console.log(`${C.name}: ${x.kind} took ${x.took} s (began ${x.began} s into the hour, waited ${x.waited}) · ${x.steps.join(' · ')}`);
    }
  }
} catch (err) {
  failed = true;
  console.error(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-10).join('\n').slice(0, 2500));
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
