#!/usr/bin/env node
// Pictures of ROUTES ON THE PAGE (RUN.md "Routes (routes-1)"; demo/run/index.js, panels.js, acted.js, scenes.js): each
// moment staged with the page's own handles (`load`, `panel`) and made with the real keys (W walk, Q skate, the
// numbers for the stop's cards, Enter), as run-goods-shots.mjs does. The server must be running: node demo/serve.mjs
//
//   node demo/tools/run-route-shots.mjs --out <dir> [--port 5470] [--seed 3] [--size 1568x740] [--only walk,cards,...]
//
// Saves <size>-<moment>.jpg:
//   walk      route-park-walk-picked (the trailer park, W pressed once: Walk on the bar, the way's meter and its brief),
//             route-setting-out (W again: the walk off, mid-leave), route-stop-hand (at Fit Street, outside DEAD AIR:
//             the hand of three as the hour's options, the stop on the top line), route-stop-moves (All moves there),
//             route-walk-on-picked (W: the way on picked, its meter), route-walking-on (W again: mid-leave),
//             route-arrive-market (mid-arrival at the flea market), route-at-market (standing there after)
//   cards     route-card-<id> for each card of the stop (mid-scene) and route-card-<id>-done (the row after it)
//   skate     route-stuff-board (the flea market's Stuff panel, the board for sale), route-skate-picked (the market
//             with the board owned: Q, its meter), route-skate-leave (Q again: mid-leave on the board),
//             route-skate-arrive-a/b/c (rolling in to the stop), route-skate-stop (at the stop on the board),
//             route-skate-on and -b, -c (Q: the push off from the stop), route-skate-home
// With each: what the moment's own pieces say (the bar's options and moves, the meter, the top line), and each leg's
// seconds from Go to the next choice at 1x (the owner's bar: about 15 s or less).
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-routes'));
const port = opt('--port', 5470);
const seed = opt('--seed', '3');
const [W, H] = opt('--size', '1568x740').split('x').map(Number);
const size = `${W}x${H}`;
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${seed}`;
const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);
mkdirSync(out, { recursive: true });

/** A state change for `load`: the run's state with these fields (things merged), its books kept whole. */
const loadExpr = fields => `(async () => {
  const h = window.__demo.hud;
  const s = structuredClone(h.state);
  const f = ${JSON.stringify(fields)};
  Object.assign(s, f, { owned: { ...s.owned, ...(f.owned ?? {}) }, things: { ...(s.things ?? {}), ...(f.things ?? {}) } });
  s.books.earned += (s.carried + s.banked) - (h.state.carried + h.state.banked);
  return await h.load(s);
})()`;
const SAY = `(() => {
  const q = s => document.querySelector(s), t = s => q(s)?.textContent.replace(/\\s+/g, ' ').trim() ?? null;
  return {
    phase: window.__demo.hud.phase, place: window.__demo.hud.state.place,
    top: t('.rn-stops'), meter: t('.rn-pct'), said: t('.rn-said'),
    options: [...document.querySelectorAll('.rn-card .u-card')].map(e => e.textContent.replace(/\\s+/g, ' ').trim()),
    moves: [...document.querySelectorAll('.rn-card .u-verb')].map(e => e.textContent.replace(/\\s+/g, ' ').trim()),
    cut: [...document.querySelectorAll('.rn-card .u-card-t, .rn-card .u-verb-t b')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent),
  };
})()`;

const browser = await launch({ width: W, height: H });
let page = null;
const said = {};
const legs = [];
try {
  page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 240000);
  await page.evaluate('window.__demo.stage.actors.audit(true)');
  await page.sleep(2500);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const key = k => ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);
  // (ui-3, leg 2: a verb's letter picks its first thing, ↓ goes on to the one wanted: `test` is a choice's test, as text)
  const pickBy = async (letter, test) => {
    await key(letter);
    for (let i = 0; i < 16; i++) {
      if (await ev(`(h => { const c = h.view.choices.find(c => c.key === h.sel); return !!c && (${test})(c); })(window.__demo.hud)`)) return true;
      await key('ArrowDown');
    }
    throw new Error(`${letter}: nothing that passes ${test}`);
  };
  // (T, Travel, and ↓ to the way on foot or on the board: W's and Q's old jobs)
  const FOOT = `c => c.choice.do === 'walk' || (c.choice.do === 'onward' && c.way !== 'board')`;
  const BOARD = `c => c.choice.do === 'skate' || (c.choice.do === 'onward' && c.way === 'board')`;
  const phase = (p, ms = 120000) => page.waitFor(`window.__demo.hud.phase === ${JSON.stringify(p)}`, ms, 100);
  const load = async fields => {
    await phase('choose');
    if (!(await ev(loadExpr(fields)))) throw new Error('the run would not load the state');
    await page.sleep(2500);
  };
  const shot = async (name, wait = 800) => {
    await page.sleep(wait);
    said[name] = await ev(SAY);
    console.log(`saved ${await page.shot(path.join(out, `${size}-${name}.jpg`))} · ${said[name].phase} at ${said[name].place}${said[name].cut.length ? ` · CUT ${said[name].cut.join(' | ')}` : ''}`);
  };
  /** Go: Enter, and the seconds until the next choice (a leg's length at 1x); `at` seconds in, a picture. */
  const go = async (name, { pic = null, at = 2, how = 'Enter', more = [] } = {}) => {
    const t0 = Date.now();
    await key(how);
    await phase('playing', 10000);
    // (`more`: further pictures of the same leg, [name, seconds in], as the board rolls in)
    for (const [p, s] of [...(pic ? [[pic, at]] : []), ...more]) {
      await page.sleep(Math.max(0, s * 1000 - (Date.now() - t0)));
      said[p] = await ev(SAY);
      console.log(`saved ${await page.shot(path.join(out, `${size}-${p}.jpg`))} · ${s} s in`);
    }
    await phase('choose', 120000);
    const s = +((Date.now() - t0) / 1000).toFixed(1);
    legs.push({ leg: name, seconds: s });
    console.log(`  ${name}: ${s} s from Go to the next choice`);
    return s;
  };
  await ev('window.__demo.hud.fold(true)');
  await ev('window.__demo.hud.bar(false)');
  // (a stop's state as the rules leave it: on the way from the park to the market, the hand dealt)
  const atStop = (hand, more = {}) => ({ place: 'fitst', day: 2, hour: 15, hoursThere: 0, carried: 30, energy: 5, heat: 0, route: { id: 'fitStreet', from: 'park', to: 'market', way: 'foot', stops: ['fitst'], at: 0, hand }, ...more });

  if (want('walk')) {
    await load({ place: 'park', day: 2, hour: 14, carried: 30, banked: 40, energy: 6, heat: 0, route: null });
    await pickBy('t', FOOT);
    await shot('route-park-walk-picked', 900);
    await go('setting out on foot (park to the stop)', { pic: 'route-setting-out', at: 2.2 });
    await shot('route-stop-hand', 1500);
    await key('g');
    await shot('route-stop-moves', 900);
    await key('g');
    await pickBy('t', FOOT);
    await shot('route-walk-on-picked', 700);
    await go('walking on (the stop to the market)', { pic: 'route-walking-on', at: 1.6 });
  }
  if (want('arrive')) {
    await load(atStop(['errand', 'lookout', 'tipsy']));
    await pickBy('t', FOOT);
    await go('walking on again, for the arrival', { pic: 'route-arrive-market', at: 4, more: [['route-arrive-market-b', 5.5], ['route-arrive-market-c', 7]] });
    await shot('route-at-market', 1200);
    // (and home on foot from there, the leaving hour first: both legs timed)
    await pickBy('t', FOOT);
    await go('setting out home on foot (the market to the stop)');
    await pickBy('t', FOOT);
    await go('walking on home (the stop to the trailer, in at the door)');
  }
  if (want('cards')) {
    for (const [id, more] of [['errand', {}], ['lookout', {}], ['tipsy', {}], ['sell', { goods: { smokes: 3 } }], ['dumpster', {}]]) {
      await load(atStop([id, ...['errand', 'lookout', 'tipsy'].filter(x => x !== id).slice(0, 2)], more));
      await key('1');
      await go(`card ${id}`, { pic: `route-card-${id}`, at: id === 'tipsy' ? 8 : id === 'dumpster' ? 7 : 5 });
      await shot(`route-card-${id}-done`, 600);
    }
  }
  if (want('skate')) {
    await load({ place: 'market', day: 2, hour: 15, hoursThere: 1, carried: 140, banked: 40, energy: 5, heat: 0, route: null, things: {} });
    await key('o');
    // (the board is the last thing Mr. Okafor's neighbours sell: the panel scrolled to it)
    await ev(`[...document.querySelectorAll('.rn-sheet .rn-thing')].find(e => /skateboard/i.test(e.textContent))?.scrollIntoView({ block: 'center' })`);
    await shot('route-stuff-board', 900);
    await key('o');
    await load({ place: 'market', day: 2, hour: 16, hoursThere: 1, carried: 60, banked: 40, energy: 4, heat: 0, route: null, things: { board: true } });
    await pickBy('t', BOARD);
    await shot('route-skate-picked', 900);
    await go('skating out (the market to the stop)', { pic: 'route-skate-leave', at: 2.3, more: [['route-skate-arrive-a', 4.5], ['route-skate-arrive-b', 6], ['route-skate-arrive-c', 7.5]] });
    await shot('route-skate-stop', 1200);
    await pickBy('t', BOARD);
    await go('skating on (the stop home)', { pic: 'route-skate-on', at: 1.8, more: [['route-skate-on-b', 2.6], ['route-skate-on-c', 3.2]] });
    await shot('route-skate-home', 1200);
  }
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]|\[run\]|\[inside\]/.test(l));
  console.log(bad.length ? `page errors:\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}` : 'page errors: 0');
  console.log('audit', JSON.stringify(await ev(`(a => a && { overlaps: a.overlaps, furniture: a.furniture, vanish: a.vanish, feet: a.feet, heads: a.heads, examples: (a.examples ?? []).filter(e => /^(vanish|furniture|overlap|feet|heads) /.test(e)).slice(0, 6) })(window.__demo.stage.actors.audit())`)));
  console.log('legs', JSON.stringify(legs));
} catch (err) {
  console.error(String(err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(out, `${size}-said.json`), JSON.stringify({ said, legs }, null, 1));
  await browser.close();
}
