#!/usr/bin/env node
// Pictures of THE RUN in the page, each moment staged on purpose: the run's state is set (demo/run/index.js `load`,
// with a rigged roll where the moment needs one: state.rig, src/contest.mjs) and the choice made as a player would
// make it, keys and all. The server must be running: node demo/serve.mjs --port 5507
//
//   node demo/tools/run-shots.mjs --out <dir> [--port 5470] [--seed 3] [--only crib,park,...] [--phone]
//
// Saves, at 1600×1000: crib-shop, park-options, market-low, market-high, result-win (and its scene), result-fail,
// jumped (the Dunn brothers' scene), held-hurt, clinic, police-stop (the arrest), held-arrest, jail, jail-close,
// report-clinic, done, report-day. --phone adds market-high at 400×860.
import path from 'node:path';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run'));
const port = opt('--port', 5470);
const seed = opt('--seed', '3');
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${seed}`;

/** A state change for `load`, as a page expression: the run's state with these fields, and its books kept whole. */
const loadExpr = fields => `(async () => {
  const h = window.__demo.hud;
  const s = structuredClone(h.state);
  const f = ${JSON.stringify(fields)};
  Object.assign(s, f, { owned: { ...s.owned, ...(f.owned ?? {}) } });
  // (whatever money the picture wants came from pay, so the books balance: src/run/ledger.mjs)
  s.books.earned += (s.carried + s.banked) - (h.state.carried + h.state.banked);
  return await h.load(s);
})()`;

async function session(width, height, run) {
  const browser = await launch({ width, height });
  let page = null;
  try {
    page = await browser.open(url);
    await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 150000);
    await page.evaluate('window.__demo.stage.actors.audit(true)');
    await page.sleep(1500);
    await run(page);
    const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]|\[run\]/.test(l));
    console.log(bad.length ? `page errors:\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}` : 'page errors: 0');
  } catch (err) {
    console.error(String(err));
    if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-10).join('\n').slice(0, 2500));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

const tools = page => {
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const shot = async name => console.log(`saved ${await page.shot(path.join(out, `${name}.jpg`))}`);
  const key = k => ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);
  const phase = p => page.waitFor(`window.__demo.hud.phase === ${JSON.stringify(p)}`, 120000, 100);
  const load = async fields => {
    await phase('choose');
    if (!(await ev(loadExpr(fields)))) throw new Error('the run would not load the state');
    await page.sleep(2500);
  };
  /** The key of the first dealt option that is not sure (a roll), else the first. */
  const risky = () => ev(`(window.__demo.hud.view.options.find(o => !o.sure && o.available) ?? window.__demo.hud.view.options[0]).key`);
  // (ui-3, leg 2: the rules' choice key k reached on the dock, by its card's 1 to 3 or its verb's letter, and in the
  // verb's list by its line; then Enter)
  const choose = async k => {
    const at = await ev(`window.__demo.hud.keyFor(${JSON.stringify(String(k))})`);
    if (at) await key(at);
    await ev(`window.__demo.hud.pick(${JSON.stringify(String(k))})`);
    await key('Enter');
  };
  const scene = (re, ms = 30000) => page.waitFor(`window.__demo.stage.debug().playing.some(s => ${re}.test(s.kind))`, ms, 100);
  const close = on => ev(`(() => { const st = window.__demo.stage; st.camera.setAngle(${on ? '{ bearing: 90, down: 38, high: 6.5 }' : '{}'}); st.focus('a1'); })()`);
  return { ev, shot, key, phase, load, risky, choose, scene, close };
};

const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);

await session(1600, 1000, async page => {
  const { ev, shot, key, phase, load, risky, choose, scene, close } = tools(page);
  if (want('crib')) {
    await load({ place: 'crib', banked: 160, carried: 0 });
    await shot('crib-shop');
  }
  if (want('park')) {
    await load({ place: 'crib', banked: 20, carried: 0 });
    await choose(4);
    await phase('choose');
    await page.sleep(1500);
    await shot('park-options');
  }
  if (want('market')) {
    await load({ place: 'market', hour: 13, hoursThere: 0, carried: 0, banked: 18, heat: 0, energy: 5 });
    await shot('market-low');
    await load({ place: 'market', hour: 17, hoursThere: 4, carried: 184, banked: 18, heat: 3, energy: 3 });
    await shot('market-high');
  }
  if (want('result')) {
    // a win: the job's roll under its odds, then nobody comes for you
    await load({ place: 'market', hour: 14, hoursThere: 1, carried: 30, banked: 18, heat: 0, energy: 5, rig: { chances: [0, 99], rolls: [] } });
    await choose(await risky());
    await page.sleep(3000);
    await shot('result-win-scene');
    await phase('choose');
    await page.sleep(600);
    await shot('result-win');
    // a fail
    await load({ place: 'market', hour: 15, hoursThere: 2, carried: 40, banked: 18, heat: 0, energy: 4, rig: { chances: [99, 99], rolls: [] } });
    await choose(await risky());
    await phase('choose');
    await page.sleep(600);
    await shot('result-fail');
  }
  if (want('jumped')) {
    // jumped, a bad one: the stall (sure), the jumping roll under its chance, the contest their clean win
    await load({ place: 'market', hour: 16, hoursThere: 3, carried: 120, banked: 18, heat: 0, energy: 4, rig: { chances: [0], rolls: [10] } });
    await choose(1);
    await scene('/^npc:robbers/');
    // (the moment they reach you: the gun up, the hands up)
    await page.waitFor(`/^aim/.test(window.__demo.stage.actors.clipOf('npc:robber1')?.name ?? '')`, 20000, 50).catch(() => {});
    await page.sleep(700);
    await shot('jumped');
    await phase('held');
    await page.sleep(800);
    await shot('held-hurt');
    await key('Enter');
    await phase('choose');
    await page.sleep(2500);
    await shot('clinic');
    await choose(1);
    await phase('report');
    await page.sleep(1200);
    await shot('report-clinic');
    await key('Enter');
  }
  if (want('police')) {
    // stopped: heat 4, the stall (sure), the stop's roll under its chance
    await load({ place: 'market', hour: 15, hoursThere: 2, carried: 90, banked: 18, heat: 4, energy: 4, rig: { chances: [0], rolls: [] } });
    await choose(1);
    await scene('/^arrest$/');
    // (the cuffs: the officer at the player's side)
    await page.waitFor(`(() => { const a = window.__demo.stage.actors; if (!a.has('npc:police1')) return false; const R = a.get('npc:police1'), Y = a.get('a1'); return Math.hypot(R.x - Y.x, R.z - Y.z) < 1.8; })()`, 20000, 100).catch(() => {});
    await page.sleep(700);
    await shot('police-stop');
    await phase('held');
    await page.sleep(800);
    await shot('held-arrest');
    await key('Enter');
    await phase('choose');
    await page.sleep(2500);
    await shot('jail');
    await close(true);
    await page.sleep(2500);
    await shot('jail-close');
    await close(false);
    await choose(1);
    await phase('report');
    await key('Enter');
  }
  if (want('done')) {
    await load({ place: 'crib', banked: 160, carried: 0, owned: { pocket: true, cutter: true } });
    await choose(3);
    await phase('done');
    await page.sleep(1200);
    await shot('done');
    await key('Enter');
    await phase('choose');
    // and a day's end at home: sleep, the report
    await choose(await ev(`window.__demo.hud.view.choices.find(c => c.choice.do === 'sleep').key`));
    await phase('report');
    await page.sleep(1200);
    await shot('report-day');
    await key('Enter');
  }
  console.log('audit', JSON.stringify(await ev(`(a => a && { scenes: a.scenes, overlaps: a.overlaps, close: a.close, jumps: a.jumps, pops: a.pops, slides: a.slides })(window.__demo.stage.actors.audit())`)));
});

if (process.argv.includes('--phone')) {
  await session(400, 860, async page => {
    const { shot, load } = tools(page);
    await load({ place: 'market', hour: 17, hoursThere: 4, carried: 184, banked: 18, heat: 3, energy: 3 });
    await shot('market-high-phone');
  });
}
