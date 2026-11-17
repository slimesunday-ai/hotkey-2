#!/usr/bin/env node
// Pictures of THE RUN's people: every job ends in a reaction, and whoever it was done to stays changed for the day.
// Each moment twice: the game's own camera at 1600×1000, and a close-up (the stage's close angle) on the person it
// is about. At each moment the stage is held still (stage.setSpeed(0)). The run is carried to each job by a loaded
// state (hud.load: the place, an hour that deals the job, its roll rigged to win or to fail). The server must be
// running: node demo/serve.mjs
//
//   node demo/tools/run-people-shots.mjs --out <dir> [--port 5470] [--seed 3] [--only odd,debt,refused,lift,liftfail,sale,stall,jumpwon,jumplost,out,cards]
//
// odd       the three odd jobs, each neighbour's own work, and the thanks (the warm mark)
// debt      a debt pressed (walked up on, crowded), paid (handed over, storms off), the sour debtor an hour later
// refused   a debt refused: he shoves you off and stands his ground, watching
// lift      a lift that works: a few steps on, the mark pats their pockets
// liftfail  a lift that fails: the mark turns and points
// sale      a sale: the buyer nods and walks off with it
// stall     two stall shifts at the flea market: walking over, each piece of the work, the thanks
// jumpwon   the jumping seen off (they get nothing): a strip of frames from the start to the two out of the picture
// jumplost  the jumping that takes it all: the same
// out       the trailer park with two people out for the day and marked
// cards     a card with a long name, the dry card, the open map with who is left
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-people'));
const port = opt('--port', 5470);
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${opt('--seed', '3')}`;
const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);

const browser = await launch({ width: 1600, height: 1000 });
let page = null;
try {
  page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 150000);
  await page.evaluate('window.__demo.stage.actors.audit(true)');
  await page.sleep(2000);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const key = k => ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);
  // (ui-3, leg 2, THE DOCK: a rules' choice key is reached by its card's 1 to 3 or its verb's letter (B Shop, R Rob,
  // X Bins, T Travel, H Home, Z Sleep), and in the verb's list by its line; then Enter does it)
  const dockPress = async k => {
    const at = await ev(`window.__demo.hud.keyFor(${JSON.stringify(String(k))})`);
    if (at) await key(at);
    await ev(`window.__demo.hud.pick(${JSON.stringify(String(k))})`);
  };
  const choosing = () => page.waitFor('window.__demo.hud.phase === "choose"', 120000, 100);
  const saved = f => console.log(`saved ${f}`);
  /** The page at the element's box, at twice the size: a card or the map, close. */
  async function crop(name, selector) {
    const r = await ev(`(b => b && { x: b.left - 6, y: b.top - 6, width: b.width + 12, height: b.height + 12 })(document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect())`);
    if (!r) return console.log(`  (no ${selector} for ${name})`);
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, clip: { ...r, scale: 2 } });
    const file = path.join(out, `${name}.jpg`);
    mkdirSync(out, { recursive: true });
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    saved(file);
  }
  /** The moment, held still: the game's picture, then the close-up on `on` (from the side the game looks from, high). */
  async function both(name, on = 'a1') {
    await ev('window.__demo.stage.setSpeed(0)');
    await page.sleep(300);
    saved(await page.shot(path.join(out, `${name}.jpg`)));
    await ev(`(() => { const c = window.__city, A = window.__demo.stage.actors.get(${JSON.stringify(on)}), cp = c.camera.position;
      const [dx, dz] = [cp.x - A.x, cp.z - A.z], d = Math.hypot(dx, dz) || 1;
      // (from well over them: a stall's awning between the camera and the person hid them from a lower one)
      const p = [A.x + (dx / d) * 3.9, A.y + 5.4, A.z + (dz / d) * 3.9], t = [A.x, A.y + 0.9, A.z];
      c.VIEWS.hk2close = { pos: p, tgt: t, fov: 45, sh: [(p[0] + t[0]) / 2, (p[2] + t[2]) / 2, 16] };
      c.cam?.toOrbit({ instant: true });
      c.setView('hk2close'); })()`);
    await page.sleep(900);
    saved(await page.shot(path.join(out, `${name}-close.jpg`)));
    await ev(`(() => { const st = window.__demo.stage; st.camera.focus(null); st.focus('a1'); st.camera.arrived(); })()`);
    await page.sleep(900);
    await ev('window.__demo.stage.setSpeed(1)');
  }
  /**
   * Carries the run to `place` at an hour that deals job `job` (with `who` its person, when named), everyone calm
   * unless `people` says otherwise, the job's roll rigged (`chances`: 0 wins, 99 fails; then the market's notice
   * rolls, not hit). Returns the option's key, or null.
   */
  async function loadFor({ place, job = null, who = null, people = {}, chances = [], rolls = [], hour0 = 10 }) {
    await choosing();
    const k = await ev(`(async () => {
      const h = window.__demo.hud, { RUN_CONFIG: cfg, view } = await import('/src/run/index.mjs');
      const base = structuredClone(h.state);
      Object.assign(base, { place: ${JSON.stringify(place)}, energy: 10, heat: 0, carried: 0, hoursThere: 0, people: ${JSON.stringify(people)}, shifts: {}, rig: { chances: ${JSON.stringify(chances)}, rolls: ${JSON.stringify(rolls)} } });
      base.books.earned += (base.carried + base.banked) - (h.state.carried + h.state.banked);
      const fits = s => { const v = view(cfg, s); const o = ${JSON.stringify(job)} ? v.options.find(o => o.id === ${JSON.stringify(job)} && (!${JSON.stringify(who)} || o.who?.id === ${JSON.stringify(who)}) && o.available) : true; return o ? (o === true ? '0' : o.key) : null; };
      for (let hour = ${hour0}; hour <= 19; hour++) for (let shift = 0; shift < 4; shift++) {
        const s = structuredClone(base);
        s.hour = hour;
        s.shifts = { [${JSON.stringify(place)}]: shift };
        const key = fits(s);
        if (key) { await h.load(s); return key; }
      }
      return null; })()`, 60000);
    if (k === null) console.log(`  (no hour deals ${job} ${who ?? ''} at ${place})`);
    await page.sleep(1800);
    return k;
  }
  const go = async k => {
    await dockPress(k);
    await key('Enter');
  };
  const clipOf = id => `(window.__demo.stage.actors.has(${JSON.stringify(id)}) ? window.__demo.stage.actors.clipOf(${JSON.stringify(id)}).name ?? '' : '')`;
  const until = (js, ms = 40000) => page.waitFor(js, ms, 40).then(() => true, () => false);
  const moving = id => `(window.__demo.stage.actors.has(${JSON.stringify(id)}) && window.__demo.stage.actors.get(${JSON.stringify(id)}).moving > 0.3)`;
  if (want('odd')) {
    for (const [who, clip, name] of [['npc:neighbour', 'carry_box', 'alvarez'], ['npc:neighbour:2', 'bench_hammer', 'pruitt'], ['npc:neighbour:3', 'sweep', 'gloria']]) {
      const k = await loadFor({ place: 'park', job: 'odd', who });
      if (k === null) continue;
      await go(k);
      if (await until(`${clipOf('a1')} === ${JSON.stringify(clip)}`)) {
        await page.sleep(500);
        await both(`odd-${name}-work`);
      } else console.log(`  (the ${clip} was missed)`);
      await choosing();
      await page.sleep(1200);
      await both(`odd-${name}-thanks`, who);
    }
  }
  if (want('debt')) {
    const k = await loadFor({ place: 'park', job: 'collect', chances: [0] });
    if (k !== null) {
      await go(k);
      if (await until(`/shove/.test(${clipOf('a1')})`)) await both('debt-pressed', 'npc:debtor');
      else console.log('  (the shove was missed)');
      if (await until(`/hand/.test(${clipOf('npc:debtor')})`)) await both('react-debt-paid', 'npc:debtor');
      else console.log('  (the hand-over was missed)');
      if (await until(moving('npc:debtor'), 15000)) {
        await page.sleep(400);
        await both('react-debt-paid-storms-off', 'npc:debtor');
      }
      await choosing();
      await page.sleep(800);
      // an hour later: an odd job, and the debtor is going (the mark on him) or gone
      const k2 = await ev(`window.__demo.hud.view.options[0].key`);
      await go(k2);
      await page.sleep(2500);
      await both('debt-sour-hour-later', (await ev(`window.__demo.stage.actors.has('npc:debtor') && !window.__demo.stage.actors.get('npc:debtor').w.hide`)) ? 'npc:debtor' : 'a1');
      await choosing();
      await page.sleep(1500);
      await both('debt-sour-hour-later-after');
    }
  }
  if (want('refused')) {
    const k = await loadFor({ place: 'park', job: 'collect', chances: [99] });
    if (k !== null) {
      await go(k);
      if (await until(`/shove/.test(${clipOf('npc:debtor')})`)) await both('react-debt-refused', 'npc:debtor');
      else console.log('  (his shove was missed)');
      await choosing();
      await page.sleep(1500);
      await both('react-debt-refused-watching', 'npc:debtor');
    }
  }
  if (want('lift')) {
    const k = await loadFor({ place: 'park', job: 'wallet', chances: [0] });
    if (k !== null) {
      const who = await ev(`window.__demo.hud.view.options.find(o => o.key === ${JSON.stringify(k)}).who.id`);
      await go(k);
      if (await until(`/pat/.test(${clipOf(who)})`)) await both('react-lift-clean', who);
      else console.log('  (the pat-down was missed)');
      await choosing();
    }
  }
  if (want('liftfail')) {
    const k = await loadFor({ place: 'park', job: 'wallet', chances: [99] });
    if (k !== null) {
      const who = await ev(`window.__demo.hud.view.options.find(o => o.key === ${JSON.stringify(k)}).who.id`);
      await go(k);
      if (await until(`/hands_up/.test(${clipOf(who)})`)) {
        await page.sleep(700);
        await both('react-lift-failed', who);
      } else console.log('  (the point was missed)');
      await choosing();
      await page.sleep(1500);
      await both('react-lift-failed-watching', who);
    }
  }
  if (want('sale')) {
    const k = await loadFor({ place: 'park', job: 'loosies', chances: [0] });
    if (k !== null) {
      const who = await ev(`window.__demo.hud.view.options.find(o => o.key === ${JSON.stringify(k)}).who.id`);
      await go(k);
      // (served: the buyer's nod, then off with it)
      if (await until(`${clipOf(who)} === 'listen_nod'`)) await both('react-sale-nod', who);
      else console.log('  (the nod was missed)');
      if (await until(moving(who), 8000)) {
        await page.sleep(600);
        await both('react-sale-walks-off', who);
      } else console.log('  (walking off was missed)');
      await choosing();
    }
  }
  if (want('stall')) {
    // two shifts at two hours: each is its own work (demo/run/acted.js SHIFTS)
    for (const [n, hour0] of [[1, 10], [2, 13]]) {
      const k = await loadFor({ place: 'market', job: 'stall', chances: [99, 99, 99], hour0 });
      if (k === null) continue;
      const who = await ev(`window.__demo.hud.view.options.find(o => o.key === ${JSON.stringify(k)}).who.id`);
      await go(k);
      if (await until(`${moving('a1')}`, 8000)) await both(`stall-${n}-0-walks-over`);
      const done = new Set();
      for (let j = 1; j <= 3; j++) {
        const ok = await until(`(c => /^(haggle_counter|stock_shelf|sweep|mop|carry_box)$/.test(c) && !${JSON.stringify([...done])}.includes(c))(${clipOf('a1')})`, 20000);
        if (!ok) break;
        const c = await ev(clipOf('a1'));
        done.add(c);
        await page.sleep(500);
        await both(`stall-${n}-${j}-${c}`);
      }
      await choosing();
      await page.sleep(1200);
      await both(`stall-${n}-thanks`, who);
    }
  }
  /** A strip of frames, the game's own picture every 0.6 s, from the press until both robbers are out of it. */
  async function jumpStrip(name, rolls) {
    const k = await loadFor({ place: 'market', job: 'stall', chances: [0], rolls });
    if (k === null) return;
    await go(k);
    const robbers = ['npc:robber1', 'npc:robber2'];
    const seenNow = () => ev(`${JSON.stringify(robbers)}.map(id => window.__demo.stage.actors.seen(id))`);
    let was = false;
    let gone = 0;
    for (let i = 0; i < 90; i++) {
      saved(await page.shot(path.join(out, name, `${String(i).padStart(2, '0')}.jpg`)));
      const s = await seenNow();
      if (s.some(Boolean)) was = true;
      gone = was && !s.some(Boolean) ? gone + 1 : 0;
      // (two frames running with neither in the picture, once they have been in it)
      if (gone >= 2) break;
      await page.sleep(600);
    }
    console.log(`  ${name}: ${was ? (gone >= 2 ? 'both out of the picture' : 'still in the picture at the last frame') : 'never seen'}`);
    if ((await ev('window.__demo.hud.phase')) === 'held') await key('Enter');
    await choosing();
  }
  if (want('jumpwon')) await jumpStrip('jump-won', [99]);
  if (want('jumplost')) await jumpStrip('jump-lost', [0]);
  if (want('out')) {
    await loadFor({ place: 'park', people: { 'npc:debtor': { mood: 'wary', out: true, job: 'collect' }, 'npc:mark:projects': { mood: 'wary', out: true, job: 'wallet' }, 'npc:neighbour:2': { mood: 'friendly', out: false, job: 'odd' } } });
    await page.sleep(1500);
    // (the stage's own camera moved off to take the two in: from the debtor's side)
    await both('park-two-out-marked');
    await both('park-two-out-marked-debtor', 'npc:debtor');
  }
  if (want('cards')) {
    // a long name: the market's wallet off "a man with a camera", or any market card
    await loadFor({ place: 'market', job: 'wallet', who: 'npc:mark:market:2' });
    saved(await page.shot(path.join(out, 'card-long-name.jpg')));
    await crop('card-long-name-close', '.rn-card');
    // dry: everyone in the park worked but the neighbours
    const outAll = Object.fromEntries(['npc:buyer:projects:1', 'npc:mark:projects', 'npc:mark:projects:2', 'npc:debtor'].map((id, i) => [id, { mood: ['friendly', 'unaware', 'wary', 'sour'][i], out: true, job: 'x' }]));
    await loadFor({ place: 'park', people: outAll });
    saved(await page.shot(path.join(out, 'card-dry.jpg')));
    await crop('card-dry-close', '.rn-card');
    console.log('  dry: picked', await ev(`(s => s && JSON.stringify(window.__demo.hud.view.choices.find(c => c.key === s)?.choice))(window.__demo.hud.sel)`));
    // the map with who is left (a few worked at both stops)
    await loadFor({ place: 'market', people: { ...outAll, 'npc:shop:market': { mood: 'friendly', out: false, job: 'stall' }, 'npc:buyer:market:2': { mood: 'wary', out: true, job: 'crowd' } } });
    await key('m');
    await page.sleep(600);
    saved(await page.shot(path.join(out, 'map-open-who-left.jpg')));
    await crop('map-open-who-left-close', '.rn-map');
    await key('Escape');
  }
  console.log('audit', JSON.stringify(await ev(`(a => a && { scenes: a.scenes, overlaps: a.overlaps, furniture: a.furniture, close: a.close, ex: a.examples.filter(e => /^(furniture|overlap|close)/.test(e)).slice(0, 6) })(window.__demo.stage.actors.audit())`)));
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]|\[run\]/.test(l));
  console.log(bad.length ? `page errors:\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}` : 'page errors: 0');
} catch (err) {
  console.error(String(err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-10).join('\n').slice(0, 2500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
