#!/usr/bin/env node
// Pictures of GOODS ON THE PAGE (RUN.md "Goods, the connect and errands"; demo/run/index.js, panels.js, acted.js,
// scenes.js, stage/set/starter.js): each moment staged with the page's own handles (`load`, `pick`, `panel`) and made
// with the real keys, as run-trust-shots.mjs does. The server must be running: node demo/serve.mjs
//
//   node demo/tools/run-goods-shots.mjs --out <dir> [--port 5470] [--seed 3] [--size 1869x882] [--only earl,card,...]
//
// Saves <size>-<moment>.jpg:
//   earl      goods-earl (day 2, noon, $20 on you in the trailer park: P, Enter, the walk to Cousin Earl at his truck
//             and the hand-over, mid-scene), goods-earl-done (the plate after it)
//   card      goods-card (the flea market with 3 cigarettes and 2 discs on you: the crowd's card says what it uses and
//             what is left, and the good is picked: U)
//   dock      goods-dock (the same, the dock open: the goods on you beside the cash, at risk; what is at home, safe)
//   stuff     goods-stuff (the Stuff panel at the market: Teo's stack, Mrs. Bao's drink, Mrs. Kowalski's rail)
//   taken     goods-taken (a sale at the market and a jump after it, rigged: the plates of what was taken)
//   trailer   goods-trailer (the crib with the four things for the trailer owned)
//   wear      goods-wear (the market, wearing the visor, the shirt and the high-tops: the figure and the Wearing tab)
//   food      no picture: the sandwich bought from Gloria where she is (how near, which clips)
//   home      no picture: home from the market with goods on you: the home line keeps what was left at home
//   stop      no picture: a police stop takes the goods and turns the connects: the plates, the notice
//   keys      no picture: C A S M open and close, D folds the dock, F the bar, the bar's height, the trust marks
// With each: the bar's height and what the moment's own pieces say, read off the page.
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-goods'));
const port = opt('--port', 5470);
const seed = opt('--seed', '3');
const [W, H] = opt('--size', '1869x882').split('x').map(Number);
const size = `${W}x${H}`;
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${seed}`;
const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);
mkdirSync(out, { recursive: true });

const loadExpr = fields => `(async () => {
  const h = window.__demo.hud;
  const s = structuredClone(h.state);
  const f = ${JSON.stringify(fields)};
  Object.assign(s, f, { owned: { ...s.owned, ...(f.owned ?? {}) } });
  s.books.earned += (s.carried + s.banked) - (h.state.carried + h.state.banked);
  return await h.load(s);
})()`;
const SAY = `(() => {
  const q = s => document.querySelector(s), t = s => q(s)?.textContent.trim() ?? null, card = q('.rn-card');
  return {
    bar: card ? Math.round(card.getBoundingClientRect().height) : null,
    uses: [...document.querySelectorAll('.rn-card .rn-uses')].map(e => e.textContent),
    moves: [...document.querySelectorAll('.rn-card .u-verb')].map(e => e.textContent).slice(0, 9),
    carried: t('.rn-carried'), banked: t('.rn-banked'), sell: t('.rn-sell-note'),
    result: t('.rn-result'), chips: [...document.querySelectorAll('.rn-tchip')].map(e => e.textContent),
    notice: q('.rn-notice') && !q('.rn-notice').hidden ? t('.rn-notice') : null,
    said: t('.rn-said'),
  };
})()`;

const PARK = { place: 'park', day: 2, hour: 12, hoursThere: 0, banked: 30, carried: 20, energy: 6, heat: 0, people: {}, owned: {}, shifts: { park: 0, market: 0 }, placeHeat: {}, goods: {}, stash: {} };
const MARKET = { ...PARK, place: 'market', hour: 12, hoursThere: 1, carried: 60, goods: { smokes: 3, discs: 2 }, stash: { smokes: 2 } };

const browser = await launch({ width: W, height: H });
let page = null;
try {
  page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 240000);
  await page.evaluate('window.__demo.stage.actors.audit(true)');
  await page.sleep(2500);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const key = (k, mods = {}) => ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true, ...${JSON.stringify(mods)} }))`);
  // (ui-3, leg 2: a verb's letter picks its first thing, ↓ goes on to the one wanted: `test` is a choice's test, as text)
  const pickBy = async (letter, test) => {
    await key(letter);
    for (let i = 0; i < 16; i++) {
      if (await ev(`(h => { const c = h.view.choices.find(c => c.key === h.sel); return !!c && (${test})(c); })(window.__demo.hud)`)) return true;
      await key('ArrowDown');
    }
    throw new Error(`${letter}: nothing that passes ${test}`);
  };
  const phase = p => page.waitFor(`window.__demo.hud.phase === ${JSON.stringify(p)}`, 120000, 100);
  const load = async fields => {
    await phase('choose');
    if (!(await ev(loadExpr(fields)))) throw new Error('the run would not load the state');
    await page.sleep(2500);
  };
  const shot = async (name, wait = 1200) => {
    await page.sleep(wait);
    const said = await ev(SAY);
    console.log(`saved ${await page.shot(path.join(out, `${size}-${name}.jpg`))} · ${JSON.stringify(said)}`);
  };
  const go = async () => {
    await key('Enter');
    await phase('playing');
    await phase('choose');
  };
  await ev('window.__demo.hud.fold(true)');
  await ev('window.__demo.hud.bar(false)');

  if (want('earl')) {
    await load(PARK);
    console.log(`  before: ${JSON.stringify((await ev(SAY)).sell)}`);
    // (ui-3, leg 2: B, the shop, and ↓ to the carton: P's old job)
    await pickBy('b', `c => c.choice.do === 'pack'`);
    console.log(`  picked: ${await ev(`(h => JSON.stringify(h.view.choices.find(c => c.key === h.sel)?.choice ?? null))(window.__demo.hud)`)}`);
    await key('Enter');
    await phase('playing');
    // (mid-scene: the walk over to him at his truck, then the hand-over; where the two of them are, in metres)
    const near = `(A => { const a = A.get('a1'), e = A.has('npc:connect:projects') ? A.get('npc:connect:projects') : null; return JSON.stringify({ you: [a.x.toFixed(1), a.z.toFixed(1)], earl: e && [e.x.toFixed(1), e.z.toFixed(1)], apart: e && Math.hypot(a.x - e.x, a.z - e.z).toFixed(1), clip: a.clipName }); })(window.__demo.stage.actors)`;
    // (the picture when he has walked up to him: the hand-over)
    for (let t = 0; t < 14000; t += 500) {
      await page.sleep(500);
      const at = JSON.parse(await ev(near));
      if (t % 2000 === 0 || Number(at.apart) < 2.6) console.log(`  at ${t + 500} ms: ${JSON.stringify(at)}`);
      if (Number(at.apart) < 2.6) break;
    }
    await shot('goods-earl', 400);
    await phase('choose');
    await shot('goods-earl-done', 600);
  }
  if (want('card')) {
    await load(MARKET);
    const o = await ev(`JSON.stringify(window.__demo.hud.view.options.map(o => [o.id, o.uses && o.uses.good, (o.goodsHere || []).length]))`);
    console.log(`  dealt ${o}`);
    await ev(`(h => { const o = h.view.options.find(o => o.id === 'crowd'); if (o) h.pick(o.key); })(window.__demo.hud)`);
    // (ui-3, leg 2: Shift+↑, the good it sells: U's old job)
    await key('ArrowUp', { shiftKey: true });
    await shot('goods-card', 900);
  }
  if (want('dock')) {
    await load(MARKET);
    await ev('window.__demo.hud.fold(false)');
    await shot('goods-dock', 1200);
    await ev('window.__demo.hud.fold(true)');
  }
  if (want('stuff')) {
    await load(MARKET);
    await key('o');
    await shot('goods-stuff', 1200);
    await key('o');
  }
  if (want('taken')) {
    // (a sale, then jumped: the rig's chances are the job's and the jump's, its contest roll a scuffle's)
    await load({ ...MARKET, hoursThere: 3, rig: { chances: [0, 0, 99, 99, 99], rolls: [Number(opt('--band', 45))] } });
    await ev(`(h => { const o = h.view.options.find(o => o.id === 'crowd') ?? h.view.options.find(o => o.available); h.pick(o.key); })(window.__demo.hud)`);
    await key('Enter');
    await phase('playing');
    await page.waitFor(`['choose', 'held'].includes(window.__demo.hud.phase)`, 120000, 100);
    await shot('goods-taken', 700);
    if (await ev(`window.__demo.hud.phase === 'held'`)) await key('Enter');
  }
  if (want('stop')) {
    // (no picture: a police stop at the market takes the goods and turns both connects; the plates, then the notice
    // the next morning. Rigged: the sale works, the stop's roll hits)
    await load({ ...MARKET, heat: 4, placeHeat: { market: 4 }, rig: { chances: [0, 0, 99, 0], rolls: [45] } });
    await ev(`(h => { const o = h.view.options.find(o => o.id === 'crowd') ?? h.view.options.find(o => o.available); h.pick(o.key); })(window.__demo.hud)`);
    await key('Enter');
    await phase('playing');
    await page.waitFor(`['choose', 'held'].includes(window.__demo.hud.phase)`, 120000, 100);
    await page.sleep(600);
    console.log(`  stopped: ${JSON.stringify(await ev(SAY))}`);
    if (await ev(`window.__demo.hud.phase === 'held'`)) await key('Enter');
    await phase('choose');
    await page.sleep(800);
    console.log(`  in jail: ${JSON.stringify((await ev(SAY)).notice)}`);
    await key('Enter');
    await page.waitFor(`['choose', 'report'].includes(window.__demo.hud.phase)`, 120000, 100);
    if (await ev(`window.__demo.hud.phase === 'report'`)) await key('Enter');
    await phase('choose');
    await page.sleep(800);
    console.log(`  the morning: ${JSON.stringify((await ev(SAY)).notice)}`);
  }
  if (want('food')) {
    // (no picture: the sandwich, E, bought from Gloria where she is: the player walks up to her and she hands it over)
    await load({ ...PARK, energy: 4 });
    // (ui-3, leg 2: B, the shop, and ↓ to her food: E's old job)
    await pickBy('b', `c => c.choice.do === 'shop'`);
    await key('Enter');
    await phase('playing');
    const near = `(A => { const a = A.get('a1'), g = A.get('npc:neighbour:3'); return JSON.stringify({ apart: Math.hypot(a.x - g.x, a.z - g.z).toFixed(1), you: a.clipName, gloria: g.clipName }); })(window.__demo.stage.actors)`;
    let closest = 99;
    const clips = new Set();
    while (await ev(`window.__demo.hud.phase === 'playing'`)) {
      const at = JSON.parse(await ev(near));
      closest = Math.min(closest, Number(at.apart));
      if (at.you) clips.add(`you:${at.you}`);
      if (at.gloria) clips.add(`gloria:${at.gloria}`);
      await page.sleep(300);
    }
    console.log(`  sandwich: closest to Gloria ${closest} m; clips ${[...clips].join(', ')}; ${JSON.stringify((await ev(SAY)).chips)}`);
  }
  if (want('home')) {
    // (no picture: home from the market with goods on you; the home line says what was left at home)
    await load({ ...MARKET, rig: { chances: [99, 99, 99, 99] } });
    await ev(`(h => h.pick(h.view.moves.find(m => m.choice.do === 'subway' && m.choice.to === 'park' && !m.choice.hop).key))(window.__demo.hud)`);
    await go();
    console.log(`  home: ${JSON.stringify((await ev(SAY)).result)}`);
  }
  if (want('trailer')) {
    await load({ ...PARK, place: 'crib', hour: 12, carried: 0, things: { lavalamp: true, boxfan: true, beanbag: true, fishtank: true, visor: true, bowling: true }, worn: { head: 'visor' }, stash: { smokes: 3 } });
    await shot('goods-trailer', 2500);
    console.log(`  the figure: ${await ev(`(A => JSON.stringify({ dressed: A.dressed ?? null, hat: A.look.hat?.id ?? A.look.hat, own: A.own, drawn: A.w.look, outfit: A.outfit ?? null }))(window.__demo.stage.actors.get('a1'))`)}`);
  }
  if (want('wear')) {
    await load({ ...MARKET, things: { visor: true, bowling: true, hightops: true, chain: true }, worn: { head: 'visor', top: 'bowling', feet: 'hightops', neck: 'chain' } });
    await ev('window.__demo.hud.panel("character")');
    await ev(`document.querySelector('.rn-sheet .k-tab#k-tab-wearing')?.click()`);
    await shot('goods-wear', 3000);
    await ev('window.__demo.hud.panel(null)');
  }
  if (want('keys')) {
    await load(MARKET);
    const sheet = () => ev(`(s => s.hidden ? null : s.dataset.sheet)(document.querySelector('.rn-sheet'))`);
    const said = [];
    // (ui-3, leg 2: C You, G Guide, O Stuff, M Map; N folds your numbers, D's old job; W A S D are never the run's)
    for (const [k, id] of [['c', 'character'], ['g', 'moves'], ['o', 'stuff'], ['m', 'map']]) {
      await key(k);
      await page.sleep(400);
      const open = await sheet();
      await key(k);
      await page.sleep(300);
      said.push(`${k.toUpperCase()} ${open === id && (await sheet()) === null ? 'opens and closes' : `FAILED (${open})`}`);
    }
    const rail = () => ev(`document.querySelector('.u-stats')?.classList.contains('is-folded') ?? null`);
    const r0 = await rail();
    await key('n');
    await page.sleep(300);
    const r1 = await rail();
    await key('n');
    await page.sleep(300);
    said.push(`N ${r0 !== r1 && (await rail()) === r0 ? 'folds and opens your numbers' : 'FAILED'}`);
    const wasd = [];
    for (const k of ['w', 'a', 's', 'd']) {
      const before = await sheet();
      await key(k);
      await page.sleep(200);
      if ((await sheet()) !== before) wasd.push(k);
    }
    said.push(`W A S D ${wasd.length ? `FAILED (${wasd.join(' ')})` : 'do nothing'}`);
    const folded = () => ev(`document.querySelector('.rn-card').classList.contains('is-folded')`);
    const f0 = await folded();
    await key('f');
    await page.sleep(300);
    const f1 = await folded();
    await key('f');
    await page.sleep(300);
    said.push(`F ${f0 !== f1 && (await folded()) === f0 ? 'folds and opens the bar' : 'FAILED'}`);
    said.push(`bar ${await ev(`Math.round(document.querySelector('.rn-card').getBoundingClientRect().height)`)} px`);
    // (trust's pieces still there: the marks by names on the bar, and the People tab)
    await load({ ...PARK, trust: { 'npc:neighbour': 3, 'npc:buyer:projects:1': 2, 'npc:mark:projects': -3 }, goods: { smokes: 5 } });
    said.push(`trust marks on the bar ${await ev(`document.querySelectorAll('.rn-card .rn-trust').length`)}`);
    await ev('window.__demo.hud.panel("character")');
    await ev(`document.querySelector('.rn-sheet .k-tab#k-tab-people')?.click()`);
    await page.sleep(800);
    said.push(`People tab rows ${await ev(`document.querySelectorAll('.rn-sheet .rn-trust, .rn-sheet .rn-meter-t, .rn-sheet li').length`)}`);
    await ev('window.__demo.hud.panel(null)');
    console.log(`keys: ${said.join(' · ')}`);
  }
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]|\[run\]|\[inside\]/.test(l));
  console.log(bad.length ? `page errors ${bad.length}:\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}` : 'page errors 0');
  console.log('audit', JSON.stringify(await ev(`(a => a && { overlaps: a.overlaps, furniture: a.furniture, vanish: a.vanish, feet: a.feet, heads: a.heads })(window.__demo.stage.actors.audit())`)));
} catch (err) {
  console.error(String(err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-10).join('\n').slice(0, 2500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
