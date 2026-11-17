#!/usr/bin/env node
// Pictures of THE WORLD ANSWERING (RUN.md rules-2) in the page: the bar with the street's moves, a target picked, the
// heat here (hot, and with the police about), the map's stops with their heat, the shop in the Stuff panel, the door
// in the morning, stranded, the panels, and a scene for every new event. Each moment is staged with the page's own
// handles (`load`, `panel`, `pick`) and a rigged roll (state.rig: src/contest.mjs), the choice made with the real
// keys (R B E Z G X T, the numbers, Enter), and the picture taken when the clip that shows it is playing. The server
// must be running: node demo/serve.mjs
//
//   node demo/tools/run-world-shots.mjs --out <dir> [--port 5470] [--seed 3] [--size 1869x882]
//        [--only bar,target,heat,map,stuff,panels,stranded,rob,robfail,bins,binsseen,drink,rough,door,refuse,grudge]
//
// `bar` also crops the bar alone (<size>-bar-*.png) and measures its height at rest; at 1600x1000 and 400x860 run it
// with --only bar. Then the audit's counts and the page's errors.
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-world'));
const port = opt('--port', 5470);
const [W, H] = opt('--size', '1869x882').split('x').map(Number);
const size = `${W}x${H}`;
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${opt('--seed', '3')}`;
const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);
mkdirSync(out, { recursive: true });
const measures = {};

const browser = await launch({ width: W, height: H });
let page = null;
try {
  page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 240000);
  await page.evaluate('window.__demo.stage.actors.audit(true)');
  await page.sleep(2000);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const key = k => ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);
  const choosing = (ms = 150000) => page.waitFor('window.__demo.hud.phase === "choose"', ms, 100);
  const phase = p => page.waitFor(`window.__demo.hud.phase === ${JSON.stringify(p)}`, 150000, 100);
  const until = (js, ms = 40000) => page.waitFor(js, ms, 40).then(() => true, () => false);
  const clipOf = id => `(window.__demo.stage.actors.has(${JSON.stringify(id)}) ? window.__demo.stage.actors.clipOf(${JSON.stringify(id)}).name ?? '' : '')`;
  const BAR = `(() => { const c = document.querySelector('.rn-card'); const b = c?.getBoundingClientRect(); return b ? Math.round(b.height) : null; })()`;
  async function shot(name, wait = 600) {
    await page.sleep(wait);
    const file = path.join(out, `${size}-${name}.jpg`);
    await page.shot(file);
    const bar = await ev(BAR);
    measures[name] = { bar };
    console.log(`saved ${file} · bar ${bar} px`);
  }
  /** The element's box, at twice the size (the bar alone, a panel). */
  async function crop(name, selector, scale = 2) {
    const r = await ev(`(b => b && { x: Math.max(0, b.left - 4), y: Math.max(0, b.top - 4), width: b.width + 8, height: b.height + 8 })(document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect())`);
    if (!r) return console.log(`  (no ${selector} for ${name})`);
    const s = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale } });
    const file = path.join(out, `${size}-${name}.png`);
    writeFileSync(file, Buffer.from(s.data, 'base64'));
    console.log(`saved ${file}`);
  }
  /**
   * Carries the run on from the state it has, with these fields (the books kept whole: run-ui-shots.mjs's way), and
   * a rig: `chances` the next chance rolls, `rolls` the next contest rolls.
   */
  async function load(fields, { chances = [], rolls = [] } = {}) {
    await choosing();
    const ok = await ev(`(async () => {
      const h = window.__demo.hud;
      const s = structuredClone(h.state);
      const f = ${JSON.stringify(fields)};
      Object.assign(s, { people: {}, shifts: {}, today: {}, door: null, hoursThere: 0 }, f, { owned: { ...s.owned, ...(f.owned ?? {}) } });
      s.rig = { chances: ${JSON.stringify(chances)}, rolls: ${JSON.stringify(rolls)} };
      s.books.earned += (s.carried + s.banked) - (h.state.carried + h.state.banked);
      return await h.load(s);
    })()`, 90000);
    if (!ok) throw new Error('the run would not load the state');
    await page.sleep(2200);
  }
  /**
   * Picks a choice by its key on the dock and goes (Enter), as a player would. (ui-3, leg 2: the old letters, pressed
   * twice, are the dock's now: R Rob, X Bins (was B), B Shop (was E), Z Sleep, and at your door 1 gives, 2 shuts the
   * door (were G and X))
   */
  const twice = async k => {
    await key(k);
    await page.sleep(250);
    await key('Enter');
  };
  const passer = `(['npc:passer:1', 'npc:passer:2', 'npc:passer:3'].find(id => window.__demo.stage.actors.has(id) && !window.__demo.stage.actors.get(id).w.hide) ?? 'npc:passer:1')`;
  const panel = id => ev(`window.__demo.hud.panel(${JSON.stringify(id)})`);
  const RIG_NONE = [99, 99, 99, 99, 99];

  if (want('bar')) {
    // the trailer park, no box cutter yet: robbing listed, greyed, with why
    await load({ place: 'park', day: 2, hour: 14, banked: 40, carried: 8, energy: 5, heat: 0, placeHeat: { park: 0, market: 0 } });
    await shot('bar-park-no-cutter', 1500);
    await crop('bar-park-no-cutter', '.rn-card');
    // with the cutter
    await load({ place: 'park', day: 3, hour: 15, banked: 40, carried: 8, energy: 5, heat: 0, placeHeat: { park: 0, market: 0 }, owned: { cutter: true } });
    await shot('bar-park', 1500);
    await crop('bar-park', '.rn-card');
    // the market with the cutter, money on you
    await load({ place: 'market', day: 3, hour: 15, hoursThere: 1, banked: 40, carried: 64, energy: 5, heat: 1, placeHeat: { park: 0, market: 1 }, owned: { cutter: true } });
    await shot('bar-market', 1500);
    await crop('bar-market', '.rn-card');
    // spent at the market (energy 1): the drink and the night come onto the row
    await load({ place: 'market', day: 3, hour: 19, hoursThere: 3, banked: 40, carried: 30, energy: 1, heat: 1, placeHeat: { park: 0, market: 1 }, owned: { cutter: true } });
    await shot('bar-market-spent', 1500);
    await crop('bar-market-spent', '.rn-card');
    await ev('window.__demo.hud.bar(true)');
    await shot('bar-market-folded', 1000);
    await crop('bar-market-folded', '.rn-card');
    await ev('window.__demo.hud.bar(false)');
  }
  if (want('target')) {
    // the market at an hour that deals an option with more than one target: its number again picks the next
    await load({ place: 'market', day: 2, hour: 13, banked: 40, carried: 20, energy: 6, heat: 0, placeHeat: { park: 0, market: 0 } });
    const k = await ev('(o => o ? o.key : null)(window.__demo.hud.view.options.find(o => o.targets?.length > 1))');
    if (k) {
      // (ui-3, leg 2: its card's key picks it, ↑ its next target: the number again and T were the old keys)
      await key(await ev(`window.__demo.hud.keyFor(${JSON.stringify(k)})`));
      await shot('target-dealt', 600);
      await crop('target-dealt', '.rn-card');
      await key('ArrowUp');
      await shot('target-picked', 600);
      await crop('target-picked', '.rn-card');
      await key('ArrowUp');
      await shot('target-picked-again', 600);
      console.log(`  picked: ${await ev(`(o => o && o.targets.map(t => t.name).join(' / '))(window.__demo.hud.view.options.find(o => o.key === ${JSON.stringify(k)}))`)}`);
    } else console.log('  (no option with two targets this hour)');
  }
  if (want('heat')) {
    // the trailer park hot (heat 4 on the place): the police are about there, in words, and their chance
    await load({ place: 'park', day: 3, hour: 14, banked: 40, carried: 12, energy: 5, heat: 1, placeHeat: { park: 4, market: 0 } });
    await shot('heat-park-hot', 1500);
    await crop('heat-park-hot', '.rn-card');
    await crop('heat-park-hot-top', '.rn-top');
    // the market with heat 3 on you: the police can stop you
    await load({ place: 'market', day: 3, hour: 15, hoursThere: 1, banked: 40, carried: 50, energy: 5, heat: 3, placeHeat: { park: 1, market: 2 } });
    await shot('heat-market-police', 1500);
    await crop('heat-market-police', '.rn-card');
    await panel('character');
    await shot('panel-character-heat', 1500);
    await panel(null);
  }
  if (want('map')) {
    await load({ place: 'market', day: 3, hour: 15, banked: 40, carried: 20, energy: 5, heat: 1, placeHeat: { park: 3, market: 2 } });
    await panel('map');
    await page.waitFor('window.__demo.hud.map.ready', 30000, 100).catch(() => console.log('  (the map was not up)'));
    await shot('map-heat', 1500);
    await ev('document.querySelector(\'.rn-flag[data-stop="park"]\')?.click()');
    await shot('map-heat-park-card', 800);
    await panel(null);
    await crop('map-top-strip', '.rn-stops');
  }
  if (want('stuff')) {
    await load({ place: 'market', day: 2, hour: 16, banked: 40, carried: 20, energy: 3, heat: 0, placeHeat: { park: 0, market: 0 } });
    await panel('stuff');
    await shot('stuff-shop', 1000);
    await crop('stuff-shop-panel', '.rn-sheet');
    await panel(null);
  }
  if (want('panels')) {
    await load({ place: 'park', day: 4, hour: 14, banked: 60, carried: 10, energy: 5, heat: 0, placeHeat: { park: 1, market: 2 }, owned: { cutter: true }, regulars: { 'npc:buyer:projects:1': 4 } });
    const k = await ev(`(o => o ? o.key : null)(window.__demo.hud.view.options.find(o => o.who?.id === 'npc:buyer:projects:1'))`);
    console.log(`  Dee dealt: ${k}`);
    await crop('card-regular-hooked', '.rn-card');
    await panel('moves');
    await shot('panel-moves', 1000);
    await crop('panel-moves', '.rn-sheet');
    // (the street at each place, its numbers and what it has left today; and the door's section)
    await ev('document.querySelector(".rn-street-sec")?.scrollIntoView({ block: "start" })');
    await crop('panel-moves-street-park', '.rn-sheet');
    await ev('document.querySelectorAll(".rn-street-sec")[1]?.scrollIntoView({ block: "start" })');
    await crop('panel-moves-street-market', '.rn-sheet');
    await ev('document.querySelector(".rn-sheet-scroll").scrollTop = 99999');
    await crop('panel-moves-end', '.rn-sheet');
    await panel('character');
    await ev(`document.querySelector('.rn-sheet .k-tab#k-tab-people')?.click()`);
    await shot('panel-people-regular', 1000);
    await ev(`document.querySelector('.rn-sheet .k-tab#k-tab-stats')?.click()`);
    await panel(null);
  }
  if (want('stranded')) {
    await load({ place: 'market', day: 3, hour: 20, hoursThere: 4, banked: 40, carried: 12, energy: 0, heat: 1, placeHeat: { park: 0, market: 1 } });
    await shot('stranded', 1500);
    await crop('stranded-bar', '.rn-card');
  }

  // ── THE SCENES ──
  if (want('rob')) {
    // robbing somebody passing in the trailer park, and it works
    await load({ place: 'park', day: 3, hour: 15, banked: 40, carried: 8, energy: 5, heat: 0, placeHeat: { park: 0, market: 0 }, owned: { cutter: true } }, { chances: [0, ...RIG_NONE] });
    await twice('r');
    if (await until(`(id => window.__demo.stage.actors.has(id) && !window.__demo.stage.actors.get(id).w.hide)(${passer})`, 20000)) await shot('scene-rob-passer-comes', 200);
    if (await until(`/rob_lunge_grab/.test(${clipOf('a1')}) || /hands_up_point/.test(${clipOf('npc:passer:1')} + ${clipOf('npc:passer:2')} + ${clipOf('npc:passer:3')})`, 60000)) await shot('scene-rob-win-grab', 100);
    if (await until(`/brush_pass/.test(${clipOf('npc:passer:1')} + ${clipOf('npc:passer:2')} + ${clipOf('npc:passer:3')})`, 15000)) await shot('scene-rob-win-handover', 100);
    if (await until(`/flee_run|run_getaway/.test(${clipOf('npc:passer:1')} + ${clipOf('npc:passer:2')} + ${clipOf('npc:passer:3')})`, 15000)) await shot('scene-rob-win-runs', 300);
    await choosing();
    await shot('scene-rob-win-after', 1500);
  }
  if (want('robfail')) {
    // at the market, and it fails: they shove him off, point and shout, and run
    await load({ place: 'market', day: 3, hour: 15, banked: 40, carried: 20, energy: 5, heat: 0, placeHeat: { park: 0, market: 0 }, owned: { cutter: true } }, { chances: [99, ...RIG_NONE] });
    await twice('r');
    if (await until(`${clipOf('a1')} === 'rob_lunge_grab'`)) await shot('scene-rob-fail-grab', 300);
    if (await until(`/hands_up_point/.test(${clipOf('npc:passer:1')} + ${clipOf('npc:passer:2')} + ${clipOf('npc:passer:3')})`)) await shot('scene-rob-fail-shouting', 300);
    if (await until(`/flee_run/.test(${clipOf('npc:passer:1')} + ${clipOf('npc:passer:2')} + ${clipOf('npc:passer:3')})`, 15000)) await shot('scene-rob-fail-runs', 300);
    await choosing();
    await shot('scene-rob-fail-after', 1500);
  }
  if (want('bins')) {
    // the bins in the trailer park, a real find, nobody sees
    await load({ place: 'park', day: 3, hour: 15, banked: 40, carried: 8, energy: 5, heat: 0, placeHeat: { park: 0, market: 0 } }, { chances: [97, 99] });
    await twice('x');
    if (await until(`${clipOf('a1')} === 'rummage'`)) await shot('scene-bins-dig', 400);
    if (await until(`${clipOf('a1')} === 'pick_up'`, 15000)) await shot('scene-bins-find', 300);
    await choosing();
    await shot('scene-bins-after', 1200);
  }
  if (want('binsseen')) {
    // seen: a neighbour comes over, says their piece, turns their back (cold: thinks less of you)
    await load({ place: 'park', day: 3, hour: 16, banked: 40, carried: 8, energy: 5, heat: 0, placeHeat: { park: 0, market: 0 } }, { chances: [10, 0] });
    await twice('x');
    if (await until(`${clipOf('a1')} === 'rummage'`)) await shot('scene-bins-seen-dig', 300);
    if (await until(`['npc:neighbour', 'npc:neighbour:2', 'npc:neighbour:3'].some(id => window.__demo.stage.actors.has(id) && /^talk_gesture/.test(window.__demo.stage.actors.clipOf(id).name ?? ''))`)) await shot('scene-bins-seen-neighbour', 300);
    await choosing();
    await shot('scene-bins-seen-after', 2500);
    console.log(`  seen by: ${await ev(`(window.__demo.hud.view.people.find(p => p.mood === 'cold') ?? {}).name ?? 'nobody'`)}`);
  }
  if (want('drink')) {
    await load({ place: 'market', day: 3, hour: 18, hoursThere: 2, banked: 40, carried: 20, energy: 1, heat: 0, placeHeat: { park: 0, market: 0 } }, { chances: RIG_NONE });
    await twice('b');
    if (await until(`${clipOf('npc:shop:market')} === 'brush_pass'`, 30000)) await shot('scene-drink-handed', 100);
    if (await until(`${clipOf('a1')} === 'drink'`, 30000)) await shot('scene-drink', 300);
    await choosing();
    await shot('scene-drink-after', 1200);
  }
  if (want('rough')) {
    // a night on the street at the market: robbed in it (a clean win of theirs), waking there
    await load({ place: 'market', day: 3, hour: 20, hoursThere: 3, banked: 40, carried: 34, energy: 1, heat: 1, placeHeat: { park: 0, market: 1 } }, { chances: [0], rolls: [0] });
    await twice('z');
    if (await until(`${clipOf('a1')} === 'lie_still'`)) await shot('scene-rough-lying', 1200);
    if (await until(`window.__demo.stage.actors.has('npc:robber1') && !window.__demo.stage.actors.get('npc:robber1').w.hide`, 20000)) await shot('scene-robbed-creep', 600);
    if (await until(`${clipOf('npc:robber1')} === 'pat_pockets'`)) await shot('scene-robbed-pockets', 200);
    await phase('report');
    await shot('scene-rough-report', 1500);
    await key('Enter');
    if (await until(`${clipOf('a1')} === 'get_up'`, 30000)) await shot('scene-wake-street', 500);
    if (await until(`${clipOf('a1')} === 'pat_pockets'`, 15000)) await shot('scene-wake-pockets', 200);
    await choosing();
    await shot('scene-wake-street-after', 1500);
    console.log(`  the morning: ${await ev('JSON.stringify({ place: window.__demo.hud.state.place, energy: window.__demo.hud.state.energy, carried: window.__demo.hud.state.carried, hour: window.__demo.hud.state.hour })')}`);
  }
  if (want('door')) {
    // the night before at the crib, Shaky Dee hooked (five sales): the morning's door roll rigged to come
    await load({ place: 'crib', day: 4, hour: 22, banked: 60, carried: 0, energy: 1, heat: 0, placeHeat: { park: 0, market: 0 }, regulars: { 'npc:buyer:projects:1': 5 } }, { chances: [0] });
    const sleepKey = await ev(`window.__demo.hud.view.choices.find(c => c.choice.do === 'sleep').key`);
    await ev(`window.__demo.hud.pick(${JSON.stringify(sleepKey)})`);
    await key('Enter');
    await phase('report');
    await shot('door-report', 1200);
    await key('Enter');
    await choosing();
    if (await until(`${clipOf('npc:buyer:projects:1')} === 'withdrawal_shake'`, 20000)) await shot('door-morning', 1500);
    else await shot('door-morning', 1500);
    await crop('door-morning-bar', '.rn-card');
    // give
    await twice('1');
    if (await until(`${clipOf('a1')} === 'brush_pass'`)) await shot('scene-gave', 300);
    if (await until(`(A => A.has('npc:buyer:projects:1') && A.get('npc:buyer:projects:1').moving > 0.3)(window.__demo.stage.actors)`, 15000)) await shot('scene-gave-leaves', 500);
    await choosing();
    await shot('scene-gave-after', 1200);
  }
  if (want('refuse')) {
    // the regular at the door, refused: he swings, a scuffle (his messy win: energy −2)
    await load({ place: 'crib', day: 5, hour: 12, banked: 60, carried: 0, energy: 6, heat: 0, placeHeat: { park: 0, market: 0 }, regulars: { 'npc:buyer:projects:1': 5 }, door: { id: 'npc:buyer:projects:1', name: 'Shaky Dee', role: 'buyer', place: 'park', wants: 21 } }, { chances: [0], rolls: [40] });
    await shot('door-loaded', 800);
    await twice('2');
    if (await until(`/hands_up_point|talk_gesture/.test(${clipOf('npc:buyer:projects:1')} + ${clipOf('a1')})`)) await shot('scene-refused', 300);
    if (await until(`/scuffle|shove/.test(${clipOf('npc:buyer:projects:1')} + ${clipOf('a1')})`)) await shot('scene-fight', 300);
    await choosing();
    await shot('scene-fight-after', 1200);
  }
  if (want('grudge')) {
    // refused, and he does not swing: a grudge; the police come round the park
    await load({ place: 'crib', day: 5, hour: 12, banked: 60, carried: 0, energy: 6, heat: 0, placeHeat: { park: 0, market: 0 }, regulars: { 'npc:buyer:projects:1': 5 }, door: { id: 'npc:buyer:projects:1', name: 'Shaky Dee', role: 'buyer', place: 'park', wants: 21 } }, { chances: [99] });
    await twice('2');
    if (await until(`${clipOf('npc:buyer:projects:1')} === 'hands_up_point'`)) await shot('scene-grudge', 400);
    // (he storms off home, the player watching from his porch)
    if (await until(`window.__demo.stage.actors.has('npc:buyer:projects:1') && window.__demo.stage.actors.get('npc:buyer:projects:1').moving > 0.3`, 20000)) await shot('scene-grudge-storms-off', 1000);
    await choosing();
    await shot('scene-grudge-after', 1500);
  }

  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]|\[run\]|\[inside\]/.test(l));
  console.log(bad.length ? `page errors:\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}` : 'page errors: 0');
  console.log('audit', JSON.stringify(await ev(`(a => a && { scenes: a.scenes, overlaps: a.overlaps, furniture: a.furniture, vanish: a.vanish, feet: a.feet, heads: a.heads, ex: (a.examples ?? []).filter(e => /^(vanish|furniture|overlap|feet|heads) /.test(e)).slice(0, 8) })(window.__demo.stage.actors.audit())`)));
} catch (err) {
  console.error(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(out, `${size}-measures.json`), JSON.stringify(measures, null, 1));
  await browser.close();
}
