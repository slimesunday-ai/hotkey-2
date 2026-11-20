#!/usr/bin/env node
// THE NEW PLACES AND CARDS, PLAYED IN THE PAGE AND CHECKED (batch-1, RUN.md "Low Tide Docks", "Glasswall Plaza", "Two
// cards on the walk", "Food: one cap a day"). The server must be running: node demo/serve.mjs --port 5495
//
//   HK2_DEBUG_PORT=5735 node demo/tools/run-places2.mjs --port 5495 --out <dir> [--speed 2]
//
// Each part starts from a state built headless with the run's own engine (src/run/) and loaded with the page's own
// hud.load, as the other picture tools do; every choice after that is made with REAL key events (DevTools
// Input.dispatchKeyEvent: the dock's 1 2 3, T for the Travel list and the arrows down it, H for home, B for the shop,
// M for the map, Enter to do it), and the map is also opened once with a REAL MOUSE PRESS on its button
// (Input.dispatchMouseEvent). In order:
//   1. the trailer park: the Travel list (the subway to the market, the docks and the plaza), the Map with the new stops
//      (by M, then by a mouse press on the Map button); the danger meter safe ("SAFE HERE");
//   2. the docks: the ride there, the shift for the foreman, the box off a driver's semi (a fight if it goes wrong:
//      watched to its end), the ride home;
//   3. the plaza: the ride there, the flyers, the wallet and the phone, each once (the meter's police word at heat 3);
//      and a police stop on the plaza, Officer Dana Pell's;
//   4. Fit Street: the barber at FRESH CUTZ and the sneaker wall at DROP, played from the stop's hand;
//   5. the food cap: the day's second food bought (the sandwich, the drink had at the market), and the line at the cap.
// A picture of every scene (held still mid-scene) and after it, of the lists and the map, at the normal width and at a
// narrow one for the meter. Fails on any page error, any frame fault (the stage's audit: overlaps, vanish, feet, heads,
// furniture; a fight's own frame check), a choice the page would not make, or the page's state after a step not being
// the headless engine's. Prints `places2-ok` or `places2-fail: <why>`.
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, newRun, step, view, deal } from '../../src/run/index.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-places2'));
const port = opt('--port', 5470);
const speed = Number(opt('--speed', '2'));
const base = `http://127.0.0.1:${port}/demo/?mode=run&seed=3&speed=${speed}`;
mkdirSync(out, { recursive: true });

// ── HEADLESS: the states each part starts from ──────────────────────────────────────────────────────────────────────
const fresh = (seed, extra = {}) => {
  const s = newRun({ seed });
  return { ...s, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) }, books: { ...s.books, ...(extra.books ?? {}) } };
};
/** Out in the trailer park with $X carried (the engine's own step out). */
function inPark(seed, carry, extra = {}) {
  const s = fresh(seed, { banked: 200, books: { start: 200 }, ...extra });
  return step(cfg, s, { do: 'out', take: carry }).state;
}
/** A plaza state at heat 4 whose flyers hour ends in a police stop (the engine's own dice). */
function stopOnPlaza() {
  for (let seed = 1; seed < 400; seed++) {
    let s = inPark(seed, 30);
    s = step(cfg, s, { do: 'subway', to: 'plaza', hop: false }).state;
    if (s.place !== 'plaza') continue;
    s = { ...s, heat: 4 };
    const r = step(cfg, s, { do: 'job', id: deal(cfg, s)[0].id });
    if (r.events.some(e => e.type === 'stopped')) return { seed, state: s };
  }
  throw new Error('no plaza state with a stop');
}
/**
 * A seed whose trip plays every job asked for with nothing ending the day early (no clinic, no jail), by the engine's
 * own dice: from the park with the bed, the ride to `to`, then each job of `jobs` (the safe one until it is dealt, at
 * most three times), then the ride home. → { seed, state } (the state in the park, before the ride)
 */
function tripSeed(to, jobs) {
  for (let seed = 1; seed < 600; seed++) {
    const start = inPark(seed, 30, { owned: { bed: true }, energy: 10 });
    let s = step(cfg, start, { do: 'subway', to, hop: false }).state;
    let ok = s.place === to;
    for (const id of jobs) {
      if (!ok) break;
      for (let n = 0; n < 4 && !deal(cfg, s).some(j => j.id === id); n++) {
        const r = step(cfg, s, { do: 'job', id: deal(cfg, s)[0].id });
        if (r.events.some(e => e.type === 'clinic' || e.type === 'jail')) ok = false;
        s = r.state;
      }
      if (!ok || !deal(cfg, s).some(j => j.id === id)) { ok = false; break; }
      const r = step(cfg, s, { do: 'job', id });
      if (r.events.some(e => e.type === 'clinic' || e.type === 'jail')) ok = false;
      s = r.state;
    }
    if (ok) {
      const r = step(cfg, s, { do: 'subway', to: 'park', hop: false });
      if (!r.events.some(e => e.type === 'clinic' || e.type === 'jail')) return { seed, state: start };
    }
  }
  throw new Error(`no seed for a clean trip to ${to}`);
}
/** At Fit Street on the walk home from the market, heat 2: three dealt (the crates, the lookout, the sneaker wall) and the barber beside them, a shop on the walk (under Shop, B). */
function onFitStreet(seed) {
  let s = inPark(seed, 10);
  s = { ...s, place: 'market', heat: 2, energy: 6 };
  s = step(cfg, s, { do: 'walk', to: 'park' }).state;
  if (s.place !== 'fitst') throw new Error('the walk did not reach Fit Street');
  // (at 14:00: at 13:00 to 14:00 the night market's Pockets crosses from the JAY ST taxi stop to a stall, and the
  // audit's `feet` has caught him 6 cm under a kerb there, a walk of the market's own crowd this batch does not touch)
  return { ...s, hour: 14, route: { ...s.route, hand: ['errand', 'lookout', 'barber', 'drop'] } };
}

// ── THE PAGE ──────────────────────────────────────────────────────────────────────────────────────────────────────
const faults = [];
const fail = why => {
  faults.push(why);
  console.log(`  FAULT: ${why}`);
};
const KEYS = { ' ': ['Space', 32], Enter: ['Enter', 13], ArrowDown: ['ArrowDown', 40], ArrowUp: ['ArrowUp', 38], Escape: ['Escape', 27] };
const browser = await launch({ width: 1600, height: 1000 });
let page = null;
const report = { steps: [], pictures: [] };
try {
  page = await browser.open(base);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending', 180000);
  await ev('window.__demo.stage.actors.audit(true)');
  await page.sleep(1500);
  async function key(k) {
    const [code, vk] = KEYS[k] ?? (/^\d$/.test(k) ? [`Digit${k}`, 48 + Number(k)] : [`Key${k.toUpperCase()}`, k.toUpperCase().charCodeAt(0)]);
    const keyName = k.length === 1 ? k.toLowerCase() : k;
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && k.length === 1 ? { text: keyName } : {}) });
  }
  async function click(x, y) {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
  async function shot(name) {
    const f = await page.shot(path.join(out, `${name}.jpg`));
    report.pictures.push(f);
    console.log(`  saved ${f}`);
  }
  async function still(name) {
    await ev('window.__demo.stage.setSpeed(0)');
    await page.sleep(350);
    await shot(name);
    await ev(`window.__demo.stage.setSpeed(${speed})`);
  }
  const choosing = () => page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending && !window.__demo.hud.duel.active', 180000, 100);
  // (sixes-1) AFTER EVERY STEP, ANY NEW FAULT OF THE STAGE'S AUDIT, so the step it came in is known (a `furniture` once
  // in three runs at 3b1200d, with no step to it)
  const FAULT = /^(overlaps?|vanish|feet|heads?|furniture) /;
  let auditSeen = { n: 0, counts: {} };
  async function auditAfter(name) {
    const a = await ev('(a => a && { counts: { overlaps: a.overlaps, vanish: a.vanish, feet: a.feet, heads: a.heads, furniture: a.furniture }, examples: a.examples })(window.__demo.stage.actors.audit())').catch(() => null);
    if (!a) return;
    const fresh = a.examples.slice(auditSeen.n).filter(x => FAULT.test(x));
    const grew = Object.entries(a.counts).filter(([k, n]) => n > (auditSeen.counts[k] ?? 0)).map(([k, n]) => `${k} ${auditSeen.counts[k] ?? 0} → ${n}`);
    if (grew.length || fresh.length) {
      console.log(`  AUDIT after ${name}: ${grew.join(', ')}`);
      for (const x of fresh) console.log(`    ${x}`);
      (report.auditSteps ??= []).push({ step: name, grew, examples: fresh });
    }
    auditSeen = { n: a.examples.length, counts: a.counts };
  }
  async function load(state, name) {
    await auditAfter(`before load ${name}`);
    await choosing();
    const ok = await ev(`window.__demo.hud.load(${JSON.stringify(state)})`, 60000);
    if (!ok) throw new Error(`${name}: the page would not load the state`);
    await choosing();
    await page.sleep(1800);
  }
  /**
   * Makes a choice with real keys: a card's 1 2 3, or its verb (T, B, H …) and ↓ down the list until it is picked, then
   * Enter. `want(c)` picks the rules' choice from the page's own view. Checks the page's state after it is the headless one.
   */
  async function choose(name, want, { pictures = true, mid = 1400, more = [] } = {}) {
    await choosing();
    const before = await ev('window.__demo.hud.state');
    const v = await ev('window.__demo.hud.view');
    const c = v.choices.find(x => want(x.choice, x));
    if (!c) throw new Error(`${name}: no such choice in the page's view`);
    if (!c.available) throw new Error(`${name}: ${c.label}: ${c.why}`);
    const k = await ev(`window.__demo.hud.keyFor(${JSON.stringify(c.key)})`);
    if (!k) throw new Error(`${name}: the dock has no key for ${c.label}`);
    await key(k);
    await page.sleep(250);
    for (let n = 0; n < 16 && (await ev('window.__demo.hud.sel')) !== c.key; n++) {
      await key('ArrowDown');
      await page.sleep(120);
    }
    if ((await ev('window.__demo.hud.sel')) !== c.key) throw new Error(`${name}: the arrows never reached ${c.label}`);
    let headless = step(cfg, before, c.choice);
    // (home from a ride, the page goes on in through your door itself: index.js act, "HOME ..., ALL THE WAY IN")
    if (c.choice.do === 'subway' && c.choice.to === 'park' && headless.state.place === 'park') {
      const r = step(cfg, headless.state, { do: 'inside' });
      headless = { state: r.state, events: [...headless.events, ...r.events] };
    }
    await key('Enter');
    report.steps.push({ name, label: c.label, choice: c.choice, text: headless.events.map(e => e.text).join(' ') });
    console.log(`${name}: ${c.label} → ${headless.events.filter(e => e.text).map(e => e.text).join(' ').slice(0, 220)}`);
    if (pictures) {
      await page.sleep(mid);
      await still(`${name}-scene`);
      // (more pictures later in the hour: the second scene of it, the arrest after the work)
      for (const [i, ms] of more.entries()) {
        await page.sleep(ms);
        await still(`${name}-scene-${i + 2}`);
      }
    }
    // a fight, if it is one: watched to its end, a picture mid-fight
    if (headless.events.some(e => e.duel)) {
      await page.waitFor('window.__demo.hud.duel.active', 60000, 50).catch(() => {});
      await page.waitFor('(s => !s || s.firstHit !== null)(window.__demo.hud.duel.state)', 40000, 30).catch(() => {});
      await still(`${name}-fight`);
      await page.waitFor('!window.__demo.hud.duel.active', 90000, 50);
      const D = await ev('window.__demo.hud.duel');
      const rec = D.log[D.log.length - 1];
      if (!rec) fail(`${name}: no fight was played`);
      else {
        if (rec.mismatch) fail(`${name}: the fight seen ended ${rec.seen}, the rules said ${rec.result}`);
        if (rec.frames?.faults) fail(`${name}: the fight's frame check found ${rec.frames.faults}`);
        console.log(`  the fight: ${rec.result}, ${rec.hits} blows landed, frames ${rec.frames?.frames} faults ${rec.frames?.faults}`);
      }
    }
    await page.waitFor('["choose", "report", "held"].includes(window.__demo.hud.phase)', 180000, 100);
    await page.sleep(700);
    const got = await ev('window.__demo.hud.state');
    const strip = s => JSON.stringify({ ...s, rig: undefined });
    if (strip(got) !== strip(headless.state)) fail(`${name}: the page's state after it is not the headless one (${Object.keys(headless.state).filter(k2 => JSON.stringify(got[k2]) !== JSON.stringify(headless.state[k2])).join(', ')})`);
    if (pictures) await shot(`${name}-after`);
    await auditAfter(name);
    // (stopped or hurt, the day's end card: Continue, Enter, takes you to the jail or the clinic)
    if ((await ev('window.__demo.hud.phase')) === 'held') {
      await key('Enter');
      await choosing();
      await page.sleep(1500);
      if (pictures) await shot(`${name}-held`);
    }
    return headless;
  }
  const meterText = () => ev('(() => { const b = document.querySelector(".rn-pct"); return b ? b.innerText.replace(/\\s+/g, " ").trim() : null; })()');
  async function narrow(name) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 760, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.sleep(1200);
    await shot(`${name}-narrow`);
    console.log(`  the meter, narrow: "${await meterText()}"`);
    await page.send('Emulation.clearDeviceMetricsOverride', {});
    await page.sleep(1200);
  }
  async function meter(name, expect) {
    const t = await meterText();
    console.log(`  the meter: "${t}"`);
    if (!expect.test(t ?? '')) fail(`${name}: the meter reads "${t}", not ${expect}`);
    await shot(`${name}-wide`);
    await narrow(name);
  }

  // 1. THE TRAILER PARK: the Travel list, the map, the meter safe
  console.log('1. the trailer park');
  const docks = tripSeed('docks', ['shift', 'lift']);
  console.log(`  the docks' trip: seed ${docks.seed}`);
  await load(docks.state, 'park');
  await meter('meter-safe', /safe here/i);
  await key('T');
  await page.sleep(700);
  const travel = await ev('window.__demo.hud.view.moves.filter(m => m.choice.do === "subway").map(m => m.choice.to)');
  for (const to of ['market', 'docks', 'plaza']) if (!travel.includes(to)) fail(`the Travel list has no subway to ${to}`);
  await shot('travel-list');
  await key('T');
  await page.sleep(300);
  await key('M');
  await page.sleep(2500);
  const stops = await ev('window.__demo.hud.map && document.querySelectorAll(".rn-flag").length');
  await shot('map-key');
  const flags = await ev('[...document.querySelectorAll(".rn-flag")].map(f => f.innerText.replace(/\\s+/g, " ").trim())');
  console.log(`  map flags (${stops}): ${flags.join(' | ')}`);
  for (const w of ['low tide', 'glasswall']) if (!flags.some(f => f.toLowerCase().includes(w))) fail(`the map has no ${w} stop`);
  await key('M');
  await page.sleep(800);
  const btn = await ev('(() => { const b = [...document.querySelectorAll("button")].find(x => x.title === "The map (M)" && x.offsetParent); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()');
  if (!btn) fail('no Map button to press');
  else {
    await click(btn.x, btn.y);
    await page.sleep(2500);
    const open = await ev('window.__demo.hud.panel ? document.querySelectorAll(".rn-flag").length : 0');
    if (!open) fail('the mouse press on the Map button did not open the map');
    await shot('map-mouse');
    await click(btn.x, btn.y);
    await page.sleep(800);
  }

  // 2. THE DOCKS: the ride, the shift, the box off the semi, the ride home
  console.log('2. the docks');
  await choose('docks-ride', c => c.do === 'subway' && c.to === 'docks' && !c.hop, { mid: 2500 });
  await meter('meter-jumped', /risk \d+%.*could be jumped/i);
  await choose('docks-shift', c => c.do === 'job' && c.id === 'shift');
  for (let n = 0; n < 4; n++) {
    const v = await ev('window.__demo.hud.view');
    if (v.options.some(o => o.id === 'lift' && o.available)) break;
    await choose(`docks-shift-${n}`, c => c.do === 'job' && c.id === 'shift', { pictures: false });
  }
  await choose('docks-lift', c => c.do === 'job' && c.id === 'lift');
  await choose('docks-home', c => c.do === 'subway' && c.to === 'park' && !c.hop, { mid: 2500 });

  // 3. THE PLAZA: the ride, the flyers, the wallet, the phone; the police word at heat 3; a stop
  console.log('3. the plaza');
  const plaza = tripSeed('plaza', ['flyers', 'wallet', 'phone']);
  console.log(`  the plaza's trip: seed ${plaza.seed}`);
  await load(plaza.state, 'plaza');
  await choose('plaza-ride', c => c.do === 'subway' && c.to === 'plaza' && !c.hop, { mid: 2500 });
  {
    // (the plaza's patrol, Officer Dana Pell: on stage, on the plaza, before anything bites)
    const cop = await ev('(A => { if (!A.has("npc:police:plaza")) return null; const q = A.get("npc:police:plaza"); return { x: q.x, z: q.z, hide: !!q.w?.hide }; })(window.__demo.stage.actors)');
    const at = [18, -18];
    console.log(`  the patrol: ${JSON.stringify(cop)}`);
    if (!cop || cop.hide || Math.hypot(cop.x - at[0], cop.z - at[1]) > 30) fail(`the plaza's patrol is not on the plaza: ${JSON.stringify(cop)}`);
  }
  await choose('plaza-flyers', c => c.do === 'job' && c.id === 'flyers');
  for (const id of ['wallet', 'phone']) {
    // (each once: if this hour did not deal it, the flyers until one does)
    for (let n = 0; n < 4; n++) {
      const v = await ev('window.__demo.hud.view');
      if (v.options.some(o => o.id === id && o.available)) break;
      await choose(`plaza-flyers-${id}-${n}`, c => c.do === 'job' && c.id === 'flyers', { pictures: false });
    }
    await choose(`plaza-${id}`, c => c.do === 'job' && c.id === id);
  }
  {
    const st = await ev('window.__demo.hud.state');
    await load({ ...st, heat: 3 }, 'plaza-heat3');
    await meter('meter-police', /risk \d+%.*police could stop you/i);
  }
  const stop = stopOnPlaza();
  console.log(`  a stop: seed ${stop.seed}`);
  await load(stop.state, 'plaza-stop');
  const stopped = await choose('plaza-stop', c => c.do === 'job' && c.id === 'flyers', { mid: 2600, more: [3500, 3500] });
  if (!stopped.events.some(e => e.type === 'stopped')) fail('plaza-stop: no stop');

  // 4. FIT STREET: the barber and the sneaker wall from the stop's hand
  console.log('4. Fit Street');
  await load(onFitStreet(7), 'fitst');
  await shot('fitst-hand');
  // (the barber is a shop on the walk: beside the three dealt, under Shop)
  const besideKeys = await ev('window.__demo.hud.view.hand.filter(c => c.beside).map(c => c.id)');
  if (besideKeys.join(',') !== 'barber') fail(`Fit Street: beside the hand ${JSON.stringify(besideKeys)}, not the barber`);
  await key('B');
  await page.sleep(700);
  await shot('fitst-shop-list');
  await key('B');
  await page.sleep(300);
  await choose('fitst-barber', c => c.do === 'card' && c.id === 'barber', { mid: 2500 });
  await choose('fitst-drop', c => c.do === 'card' && c.id === 'drop', { mid: 2500 });

  // 5. THE FOOD CAP: in the trailer park, the drink already had at the night market; the sandwich, then the line at the cap
  console.log('5. the food cap');
  {
    const s = inPark(9, 30);
    await load({ ...s, energy: 2, today: { market: { drink: 1 } } }, 'food');
    await key('B');
    await page.sleep(700);
    await shot('food-shop-before');
    await key('B');
    await page.sleep(300);
    await choose('food-sandwich', c => c.do === 'shop' && c.item === 'sandwich');
    const v = await ev('window.__demo.hud.view');
    const drink = v.choices.find(c => c.choice.do === 'shop');
    if (!v.food?.full) fail('food: the day is not full after the second food');
    if (!/eaten all you can today/.test(drink?.why ?? '')) fail(`food: the line at the cap says "${drink?.why}"`);
    await key('B');
    await page.sleep(700);
    await shot('food-shop-at-cap');
    await key('B');
  }

  const audit = await ev('(a => a && { overlaps: a.overlaps, vanish: a.vanish, feet: a.feet, heads: a.heads, furniture: a.furniture })(window.__demo.stage.actors.audit())').catch(() => null);
  report.audit = audit;
  console.log(`the stage's audit: ${JSON.stringify(audit)}`);
  const examples = await ev('(window.__demo.stage.actors.audit()?.examples ?? []).filter(x => /^(overlaps?|vanish|feet|heads?|furniture) /.test(x))').catch(() => []);
  for (const x of examples) console.log(`  audit: ${x}`);
  for (const [k, n] of Object.entries(audit ?? {})) if (n) fail(`the stage's audit: ${k} ${n}${examples.length ? ` (${examples.join('; ').slice(0, 400)})` : ''}`);
} catch (err) {
  fail(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
} finally {
  const bad = page ? page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]')) : [];
  if (bad.length) fail(`${bad.length} page errors: ${[...new Set(bad)].slice(0, 6).join(' | ').slice(0, 1500)}`);
  report.faults = faults;
  writeFileSync(path.join(out, 'run-places2.json'), `${JSON.stringify(report, null, 1)}\n`);
  await browser.close();
  console.log(faults.length ? `places2-fail: ${faults[0]}` : 'places2-ok');
  process.exitCode = faults.length ? 1 : 0;
}
