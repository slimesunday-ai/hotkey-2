#!/usr/bin/env node
// THE FIRST SLICE, PLAYED IN THE PAGE AND CHECKED (sixes-1, RUN.md "The Sixes and a home that scales: the first
// slice"). The server must be running: node demo/serve.mjs --port 5496 --quiet
//
//   HK2_DEBUG_PORT=5743 node demo/tools/run-sixes.mjs --port 5496 --out <dir> [--speed 2] [--headless]
//
// First, headless (the run's own engine, src/run/), the steps it plays, each from the state before it. Then in the page
// (/demo/?mode=run), each step loaded (the page's own hud.load) and made with REAL key events (DevTools
// Input.dispatchKeyEvent) and REAL MOUSE PRESSES (Input.dispatchMouseEvent):
//   1. each of the six pieces bought where it is sold (B, ↓ to it, Enter): the deadbolt, the dog sign and the guard dog
//      in the trailer park, the floor safe and the camera at the market, the door bar on the docks; the Library (L)
//      says each one's job and where it is had; then the trailer with all six: each seen in the room (and the crib's
//      own list of what it shows);
//   2. a crew's warning: to bed (Z, Enter), the morning at the porch, the warning's card (a crew, the door fight's odds);
//   3. the door fight watched, won, and another lost (the fight of several, the same bar and Skip);
//   4. Cousin Earl on the step: K (the HOME slip), a mouse press on "Goes hunting": told; to bed, and the door fight with
//      him in it, told so (the fight's own record and the card);
//   5. Dutch's word at the market (a sale that takes the meter to 3): the scene, the notice, the SIXES meter moved;
//   6. the tax: leaving with money made there, Dutch by the steps; a mouse press on Pay: paid, the meter down;
//   7. the tax refused (a mouse press on Refuse): the meter up to 7; to bed: the warning they will be by the steps;
//      the next day at the market, leaving: the fight by the steps, two of the Sixes, watched;
//   8. a version-10 save in the browser's slot, the page reloaded: it loads, the Sixes and Earl's way as new.
// A picture of every step. After every step the page's state must be the headless one. Fails on any page error, a
// fight's frame fault, a fight seen to end otherwise than the rules said, or a result that differs.
// Prints `sixes-ok` or `sixes-fail: <why>`.
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { roomCheck } from './room-check.mjs';
import { RUN_CONFIG as cfg, newRun, step, view, deal, saveRun, RUN_STATE_VERSION } from '../../src/run/index.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-sixes'));
const port = opt('--port', 5496);
const speed = Number(opt('--speed', '2'));
const SEED = 3;
const base = `http://127.0.0.1:${port}/demo/?mode=run&seed=${SEED}&speed=${speed}${opt('--qs', '')}`;
mkdirSync(out, { recursive: true });
const SLICE = ['deadbolt', 'floorsafe', 'doorbar', 'dog', 'camera', 'dogsign'];
const X = cfg.sixes;

// ── HEADLESS: the steps ───────────────────────────────────────────────────────────────────────────────────────────
const go = (s, choice) => ({ state: s, choice, ...(r => ({ after: r.state, events: r.events }))(step(cfg, s, choice)) });
const carrying = (s, n) => ({ ...s, carried: s.carried + n, books: { ...s.books, earned: s.books.earned + n } });
const banking = (s, n) => ({ ...s, banked: s.banked + n, books: { ...s.books, earned: s.books.earned + n } });
const at = (place, o = {}) => {
  const s = newRun({ seed: SEED, cfg });
  return { ...s, place, energy: 5, ...o, owned: { ...s.owned, ...(o.owned ?? {}) } };
};
const owns = (list = SLICE) => Object.fromEntries(list.map(k => [k, true]));
const homeMarks = (n, day) => [{ why: 'loosies', text: `Sold loose cigarettes (day ${day})`, n, day }];
const sixesAt = (n, day, more = {}) => ({ marks: n ? [{ why: 'sell', text: `sold at their market (day ${day - 1})`, n, day: day - 1 }] : [], did: null, word: n >= X.word ? day - 1 : null, made: 0, madeDay: null, taxDay: null, tax: null, jump: null, jumps: [], ...more });
// 1. the six pieces, where each is sold
const buys = [];
{
  let s = carrying(at('park', { day: 2, hour: 14 }), 100);
  for (const item of ['deadbolt', 'dogsign', 'dog']) {
    const r = go(s, { do: 'get', item });
    buys.push({ item, ...r });
    s = r.after;
  }
  s = carrying(at('market', { day: 2, hour: 14, things: owns(['deadbolt', 'dogsign', 'dog']) }), 260);
  for (const item of ['floorsafe', 'camera']) {
    const r = go(s, { do: 'get', item });
    buys.push({ item, ...r });
    s = r.after;
  }
  s = carrying(at('docks', { day: 2, hour: 14, things: owns(['deadbolt', 'dogsign', 'dog', 'floorsafe', 'camera']) }), 60);
  const r = go(s, { do: 'get', item: 'doorbar' });
  buys.push({ item: 'doorbar', ...r });
}
const trailer = { ...at('crib', { day: 3, hour: 13, things: owns(), owned: { bed: true } }) };
// 2. a crew's warning: the evening before, the pressure at 8; a night whose morning roll sees them
let warn = null;
for (let day = 2; day < 60 && !warn; day++) {
  const s = banking(at('crib', { day, hour: 21, energy: 2, owned: { bed: true }, things: owns(['deadbolt', 'floorsafe']), home: { marks: homeMarks(8, day), raid: null, last: null, guard: null, raids: [] } }), 300);
  const r = go(s, { do: 'sleep' });
  if (r.events.some(e => e.type === 'casing' && e.kind === 'crew')) warn = r;
}
if (!warn) throw new Error('no morning sees a crew casing the crib');
// 3. the door fight: a crew due tonight, won and lost; 4. with Earl on, told to go hunting
const crewNight = (day, o = {}) => banking(at('crib', { day, hour: 21, energy: 2, owned: { bed: true }, things: owns(), ...o,
  home: { marks: homeMarks(8, day), raid: { who: { ...cfg.pressure.stranger }, why: 'stranger', day, hour: 14, warned: day - 1, started: null, kind: 'crew' }, last: null, guard: o.guard ?? null, raids: [] } }), 400);
const fights = { won: null, lost: null, earl: null };
for (let day = 3; day < 80 && !(fights.won && fights.lost); day++) {
  const r = go(crewNight(day), { do: 'sleep' });
  const e = r.events.find(x => x.type === 'raid' && x.duel);
  if (!e) continue;
  if (e.duel.result === 'won' && !fights.won) fights.won = r;
  if (e.duel.result !== 'won' && !fights.lost) fights.lost = r;
}
if (!fights.won || !fights.lost) throw new Error('no door fight won and none lost');
for (let day = 3; day < 80 && !fights.earl; day++) {
  const s = crewNight(day, { guard: { on: true, until: day + 1 } });
  const told = go(s, { do: 'earlWay', way: 'hunt' });
  const r = go(told.after, { do: 'sleep' });
  const e = r.events.find(x => x.type === 'raid' && x.duel);
  if (e?.duel.earl?.way === 'hunt') fights.earl = { told, night: r };
}
if (!fights.earl) throw new Error('no door fight with Earl');
// 5. Dutch's word: at the market with the meter at 2 and discs to sell, the sale that takes it to 3
let word = null;
for (let hour = 13; hour < 22 && !word; hour++) {
  const s = { ...carrying(at('market', { day: 4, hour, hoursThere: 0 }), 10), goods: { discs: 2 }, sixes: sixesAt(2, 4) };
  const o = deal(cfg, s).find(j => j.id === 'crowd');
  if (!o) continue;
  const r = go(s, { do: 'job', id: 'crowd' });
  if (r.events.some(e => e.type === 'sixes' && e.what === 'word') && !r.events.some(e => e.type === 'jumped' || e.type === 'stopped')) word = r;
}
if (!word) throw new Error('no hour deals the sale that brings Dutch\'s word');
// 6, 7. the tax: at the market with the meter at 5, something sold there today and $60 made; leaving
const taxDay = 5;
const taxState = { ...carrying(at('market', { day: taxDay, hour: 18, hoursThere: 2 }), 80), sixes: sixesAt(5, taxDay, { did: taxDay, made: 60, madeDay: taxDay, word: taxDay - 2 }) };
const homeRide = { do: 'subway', to: 'park', hop: false };
const stopped = go(taxState, homeRide);
if (!stopped.after.sixes?.tax) throw new Error('Dutch was not waiting by the steps');
const paid = go(stopped.after, { do: 'tax', pay: true });
const refused = go(stopped.after, { do: 'tax', pay: false });
// (refused: to bed that night; the morning's word that two of them will be by the steps tomorrow)
const nightAfter = go({ ...refused.after, place: 'crib', hour: 21, banked: refused.after.banked + refused.after.carried, carried: 0 }, { do: 'sleep' });
if (!nightAfter.events.some(e => e.type === 'sixes' && e.what === 'jumpWarned')) throw new Error('no warning after the tax refused');
// (the next day at the market, leaving: the fight by the steps, seen off)
let steps = null;
// (the fight's seed is the day's: the first day it is seen off, the warning said the day before)
for (let k = 1; k < 40 && !steps; k++) {
  const d = nightAfter.after.day + k;
  const h = 17;
  const s0 = carrying({ ...nightAfter.after, day: d, place: 'market', hour: h, hoursThere: 1, energy: 6, sixes: { ...nightAfter.after.sixes, jump: { day: d, warned: d - 1 } } }, 40);
  const r = go(s0, homeRide);
  const e = r.events.find(x => x.type === 'jumped' && x.sixes);
  if (e?.duel.result === 'won') steps = r;
}
if (!steps) throw new Error('no fight by the steps seen off');
// 8. a version-10 save
const v10 = JSON.parse(saveRun(at('crib', { day: 2, hour: 13 })));
v10.v = 10;
v10.state.v = 10;
delete v10.state.sixes;
delete v10.state.earlWay;
delete v10.state.books.dog;
delete v10.state.books.sixes;
const said = r => r.events.filter(e => e.text).map(e => e.text).join(' ');
console.log(`headless: seed ${SEED}`);
for (const b of buys) console.log(`  buy ${b.item}: ${said(b).slice(0, 160)}`);
console.log(`  warning: day ${warn.after.day}: ${said(warn).slice(0, 220)}`);
for (const [k, r] of Object.entries({ won: fights.won, lost: fights.lost, earl: fights.earl.night })) console.log(`  door fight ${k}: day ${r.state.day}: ${said(r).slice(0, 220)}`);
console.log(`  word: ${said(word).slice(0, 220)}`);
console.log(`  tax: ${said(stopped).slice(0, 200)} | paid: ${said(paid)} | refused: ${said(refused)}`);
console.log(`  the steps: ${said(steps).slice(0, 220)}`);
if (process.argv.includes('--headless')) process.exit(0);

// ── THE PAGE ──────────────────────────────────────────────────────────────────────────────────────────────────────
const faults = [];
const fail = why => {
  faults.push(why);
  console.log(`  FAULT: ${why}`);
};
const KEYS = { ' ': ['Space', 32], Enter: ['Enter', 13], ArrowDown: ['ArrowDown', 40], Escape: ['Escape', 27] };
const browser = await launch({ width: 1600, height: 1000 });
let page = null;
const report = { seed: SEED, steps: [], pictures: [], fights: [], presses: [], meters: [] };
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
  async function click(x, y, what) {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    report.presses.push(what);
  }
  const boxOf = (sel, text = null) => ev(`(() => { const all = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(b => !b.closest('[hidden]') && b.getBoundingClientRect().width > 0 && (${JSON.stringify(text)} === null || b.innerText.includes(${JSON.stringify(text)}))); const b = all[0]; if (!b) return null; b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  async function press(sel, text, what) {
    const b = await boxOf(sel, text);
    if (!b) throw new Error(`${what}: nothing to press (${sel}${text ? ` "${text}"` : ''})`);
    await click(b.x, b.y, what);
    await page.sleep(600);
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
  const textOf = sel => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => !x.closest('[hidden]')); return b ? b.innerText.replace(/\\s+/g, ' ').trim() : null; })()`);
  const choosing = () => page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending && !window.__demo.hud.duel.active', 180000, 100);
  async function load(state, name) {
    await choosing();
    const ok = await ev(`window.__demo.hud.load(${JSON.stringify(state)})`, 60000);
    if (!ok) throw new Error(`${name}: the page would not load the state`);
    await choosing();
    await page.sleep(1800);
  }
  async function pick(name, c) {
    const v = await ev('window.__demo.hud.view');
    const want = v.choices.find(x => x.choice.do === c.choice.do && ['id', 'item', 'to', 'pay', 'way'].every(k => c.choice[k] === undefined || x.choice[k] === c.choice[k]) && (c.choice.hop === undefined || !!x.choice.hop === !!c.choice.hop));
    if (!want) throw new Error(`${name}: no ${JSON.stringify(c.choice)} in the page's choices`);
    if (!want.available) throw new Error(`${name}: ${want.label}: ${want.why}`);
    const k = await ev(`window.__demo.hud.keyFor(${JSON.stringify(want.key)})`);
    if (!k) throw new Error(`${name}: the dock has no key for ${want.label}`);
    await key(k);
    await page.sleep(250);
    for (let n = 0; n < 24 && (await ev('window.__demo.hud.sel')) !== want.key; n++) {
      await key('ArrowDown');
      await page.sleep(120);
    }
    await page.sleep(300);
    if ((await ev('window.__demo.hud.sel')) !== want.key) throw new Error(`${name}: the keys never picked ${want.label}`);
    return want;
  }
  async function compare(name, c) {
    await page.waitFor('["choose", "report", "held"].includes(window.__demo.hud.phase) && !window.__demo.hud.duel.active', 180000, 100);
    await page.sleep(500);
    const got = await ev('window.__demo.hud.state');
    const strip = s => JSON.stringify({ ...s, rig: undefined });
    if (strip(got) !== strip(c.after)) fail(`${name}: the page's state after it is not the headless one (${Object.keys(c.after).filter(k => JSON.stringify(got[k]) !== JSON.stringify(c.after[k])).join(', ')})`);
    else console.log(`  ${name}: the page's state after it is the headless one (day ${got.day} ${got.hour}:00 at ${got.place})`);
  }
  async function fight(name, e) {
    await page.waitFor('window.__demo.hud.duel.active', 120000, 50);
    await page.waitFor('(s => !s || s.firstHit !== null)(window.__demo.hud.duel.state)', 40000, 30).catch(() => {});
    await page.sleep(500 / speed);
    await still(`${name}-fight`);
    const bars = await ev('[...document.querySelectorAll(".rn-duel-side")].map(b => b.innerText.replace(/\\s+/g, " ").trim())');
    await page.waitFor('(s => !s || (s.down && s.phase !== "fight"))(window.__demo.hud.duel.state)', 60000, 30).catch(() => {});
    await page.sleep(500 / speed);
    await still(`${name}-fight-end`);
    await page.waitFor('!window.__demo.hud.duel.active', 90000, 50);
    const D = await ev('window.__demo.hud.duel');
    const rec = D.log[D.log.length - 1];
    if (!rec) return fail(`${name}: no fight was played`);
    report.fights.push({ name, result: rec.result, seen: rec.seen, skipped: rec.skipped, frames: rec.frames, hits: rec.hits, foes: rec.foes, ally: rec.ally ?? false, earlDown: rec.earlDown ?? null, ground: rec.ground, room: rec.anim?.crowd ?? null, bars });
    if (rec.result !== e.duel.result) fail(`${name}: the page's rules said ${rec.result}, headless ${e.duel.result}`);
    if (rec.mismatch) fail(`${name}: the fight seen ended ${rec.seen}, the rules said ${rec.result}`);
    // (anim-1, THE FIGHT'S TWO ENDS: its first blow within 2.5 s of its being called, control back within 4 s of its
    // last blow: demo/run/duel.js PACE; a fight that is slower fails here)
    for (const w of rec.slow ?? []) fail(`${name}: ${w}`);
    // (room-1: nobody not in it on its ground or at its edge: demo/tools/room-check.mjs)
    roomCheck(name, rec, fail);
    console.log(`  ${name}: the first blow ${rec.open ?? '(none)'} s after the fight was called; control back ${rec.close ?? '(skipped)'} s after the last blow`);
    if (rec.skipped) fail(`${name}: the fight was skipped`);
    if (rec.frames?.faults) fail(`${name}: the frame check found ${rec.frames.faults}: ${JSON.stringify(rec.frames.first?.slice(0, 4))}`);
    console.log(`  the fight: ${rec.result} (seen ${rec.seen}), ${rec.foes} of them${rec.ally ? ', Earl beside you' : ''}, ${rec.hits} blows landed, frames ${rec.frames?.frames}, faults ${rec.frames?.faults}, ground ${JSON.stringify(rec.ground)}; the bars: ${JSON.stringify(bars)}`);
    return { rec, bars };
  }
  const meter = async name => {
    const m = await ev('(() => { const b = document.querySelector(".u-stat.is-sixes"); return b ? { value: Number(b.dataset.sixes), text: b.innerText.replace(/\\s+/g, " ").trim() } : null; })()');
    report.meters.push({ name, ...(m ?? { value: null }) });
    console.log(`  the SIXES meter (${name}): ${JSON.stringify(m)}`);
    return m;
  };
  const record = (name, c, extra = {}) => report.steps.push({ name, day: c.state.day, hour: c.state.hour, choice: c.choice, text: said(c), ...extra });
  /** To bed with real keys (Z, Enter), the night's report put away (Enter): the morning plays on. */
  async function toBed(name, c) {
    await pick(name, c);
    await key('Enter');
    await page.waitFor('window.__demo.hud.phase === "report"', 120000, 100);
    await page.sleep(1200);
    await shot(`${name}-report`);
    await key('Enter');
  }

  // 1. THE SIX PIECES, EACH WHERE IT IS SOLD
  console.log('1. the six pieces');
  let loaded = null;
  for (const b of buys) {
    if (loaded !== b.state.place || b.item === 'deadbolt' || b.item === 'floorsafe' || b.item === 'doorbar') {
      await load(b.state, `buy-${b.item}`);
      loaded = b.state.place;
    }
    await pick(`buy-${b.item}`, b);
    await shot(`1-buy-${b.item}-picked`);
    await key('Enter');
    await page.sleep(2600);
    await still(`1-buy-${b.item}-scene`);
    await compare(`buy-${b.item}`, b);
    record(`buy-${b.item}`, b);
  }
  // (the Library: each piece's job and where it is had)
  await key('L');
  await page.sleep(900);
  await press('.u-lib-head .u-chip', 'Home', 'the Library: Home');
  await page.sleep(700);
  const libText = {};
  for (const k of ['doorbar', 'camera']) {
    await press(`.u-lib-cell[data-key="${k}"]`, null, `the Library: ${k}`);
    await page.sleep(700);
    libText[k] = await textOf('.u-lib-card-job');
    const sold = await textOf('.u-lib-card-sold');
    console.log(`  the Library, ${k}: "${libText[k]}" · "${sold}"`);
    if (!libText[k] || !/defends your crib/i.test(libText[k])) fail(`library: ${k}'s card does not say its job`);
    if (!/on sale every day/i.test(sold ?? '')) fail(`library: ${k}'s card does not say where it is had: "${sold}"`);
    await shot(`1-library-${k}`);
  }
  await key('Escape');
  await page.sleep(400);
  await ev(`window.__demo.hud.panel('stuff')`);
  await page.sleep(900);
  await ev(`document.querySelector('.rn-sheet .rn-defences')?.scrollIntoView({ block: 'start' })`);
  await page.sleep(400);
  const defences = await textOf('.rn-sheet .rn-defences');
  await shot('1-stuff-defences');
  await ev(`window.__demo.hud.panel(null)`);
  console.log(`  the Stuff panel's defences: "${(defences ?? '').slice(0, 400)}"`);
  for (const k of SLICE) {
    const t = cfg.things[k];
    if (!defences?.toLowerCase().includes(t.job.slice(0, 30).toLowerCase())) fail(`stuff: ${k}'s job is not said: "${t.job.slice(0, 30)}"`);
  }
  report.library = libText;
  // (the trailer with all six)
  await load(trailer, 'trailer');
  await page.sleep(2500);
  const shows = await ev('window.__demo.stage.starterShows()');
  console.log(`  the crib shows: ${JSON.stringify(shows)}`);
  for (const k of ['dog', 'camera', 'dogsign', 'floorsafe']) if (!shows?.things?.[k]) fail(`trailer: ${k} is not shown in the crib`);
  if (!shows?.door) fail('trailer: the deadbolt is not on the door');
  if (!shows?.bar) fail('trailer: the door bar is not on the door');
  // (your numbers folded to one line, so the room's back right, the safe and the boxes, is not under them)
  await ev('window.__demo.hud.fold(true)');
  await page.sleep(800);
  await shot('1-trailer');
  await ev('window.__demo.hud.fold(false)');
  report.shows = shows;

  // 2. A CREW'S WARNING
  console.log('2. a crew\'s warning');
  await load(warn.state, 'warn');
  await toBed('2-warn', warn);
  await page.waitFor('!!document.querySelector(".rn-home-card")', 120000, 200).catch(() => {});
  await page.sleep(800);
  const card = await textOf('.rn-home-card');
  console.log(`  the warning's card: "${card?.slice(0, 300)}"`);
  if (!/a crew/i.test(card ?? '')) fail(`warn: the card does not say a crew: "${card?.slice(0, 120)}"`);
  if (!/At your door: you win about \d+ in 10/i.test(card ?? '')) fail('warn: the card does not give the door fight\'s odds');
  await shot('2-warn-card');
  await key('Enter');
  await compare('warn', warn);
  record('warn', warn, { card });

  // 3. THE DOOR FIGHT, WON AND LOST
  for (const k of ['won', 'lost']) {
    console.log(`3. the door fight (${k})`);
    const c = fights[k];
    await load(c.state, `door-${k}`);
    await toBed(`3-door-${k}`, c);
    const e = c.events.find(x => x.type === 'raid' && x.duel);
    const f = await fight(`3-door-${k}`, e);
    if (f && f.rec.foes !== 2) fail(`door-${k}: the fight was not two at once (${f.rec.foes})`);
    await page.waitFor('!!document.querySelector(".rn-crew-card")', 60000, 200).catch(() => {});
    await page.sleep(600);
    const cc = await textOf('.rn-crew-card');
    console.log(`  the card: "${cc?.slice(0, 240)}"`);
    if (!cc) fail(`door-${k}: no card after the door fight`);
    await shot(`3-door-${k}-card`);
    await key('Enter');
    await compare(`door-${k}`, c);
    record(`door-${k}`, c, { card: cc });
  }

  // 4. EARL TOLD HOW TO FIGHT, AND THE FIGHT WITH HIM IN IT
  console.log('4. Earl told to go hunting');
  await load(fights.earl.told.state, 'earl');
  await key('K');
  await page.sleep(900);
  await shot('4-home-slip');
  await press('.rn-home-print button.rn-earlway[data-way="hunt"]', null, 'the HOME slip: tell Earl, goes hunting');
  await page.sleep(1200);
  await compare('earl-told', fights.earl.told);
  await key('K');
  await page.sleep(400);
  const slip = await (async () => { await key('K'); await page.sleep(700); const t = await textOf('.rn-home-print'); await shot('4-home-slip-told'); await key('K'); return t; })();
  if (!/goes hunting/i.test(slip ?? '')) fail('earl: the slip does not show the ways');
  {
    const c = fights.earl.night;
    await toBed('4-earl-night', c);
    const e = c.events.find(x => x.type === 'raid' && x.duel);
    const f = await fight('4-earl-door', e);
    if (f && !f.rec.ally) fail('earl: Earl was not in the door fight');
    await page.waitFor('!!document.querySelector(".rn-crew-card")', 60000, 200).catch(() => {});
    await page.sleep(600);
    const cc = await textOf('.rn-crew-card');
    console.log(`  the card: "${cc?.slice(0, 260)}"`);
    if (!/goes hunting/i.test(cc ?? '')) fail(`earl: the card does not say how he was told: "${cc?.slice(0, 200)}"`);
    await shot('4-earl-card');
    await key('Enter');
    await compare('earl-night', c);
    record('earl-night', c, { card: cc });
  }

  // 5. DUTCH'S WORD
  console.log('5. Dutch\'s word');
  await load(word.state, 'word');
  const m0 = await meter('before the word');
  await pick('word', word);
  await key('Enter');
  await page.sleep(2600);
  // (second pass: the scene first, then the notice: while it plays, no word of Dutch's on the notice yet)
  const early = (await ev('window.__demo.hud.phase')) !== 'choose' ? await textOf('.rn-notice') : null;
  if (early && /Dutch/i.test(early)) fail(`word: the notice told it before the scene had played: "${early}"`);
  await still('5-word-scene');
  await compare('word', word);
  const m1 = await meter('after the word');
  const notice = await textOf('.rn-notice');
  console.log(`  the notice: "${notice?.slice(0, 240)}"`);
  if (!/Dutch/i.test(notice ?? '')) fail(`word: no notice of Dutch's word: "${notice}"`);
  if (!(m1?.value > (m0?.value ?? 0))) fail(`word: the SIXES meter did not move (${m0?.value} → ${m1?.value})`);
  await shot('5-word-after');
  record('word', word, { notice });

  // 6. THE TAX, PAID
  console.log('6. the tax, paid');
  await load(stopped.state, 'tax');
  await meter('before the tax');
  await pick('tax-stop', stopped);
  await key('Enter');
  await page.sleep(2600);
  await still('6-tax-stop-scene');
  await compare('tax-stop', stopped);
  await page.sleep(800);
  await shot('6-tax-cards');
  const payKey = (await ev('window.__demo.hud.view')).choices.find(c => c.choice.do === 'tax' && c.choice.pay).key;
  const payCard = await boxOf(`.u-card[data-key="${payKey}"]`);
  if (!payCard) throw new Error('tax: no Pay card on the dock');
  await click(payCard.x, payCard.y, 'the tax: pay Dutch');
  await page.sleep(400);
  if ((await ev('window.__demo.hud.phase')) === 'choose' && !(await ev('window.__demo.hud.state.sixes.taxDay'))) await click(payCard.x, payCard.y, 'the tax: pay Dutch (again: it goes)');
  await page.sleep(2400);
  await still('6-tax-paid-scene');
  await compare('tax-paid', paid);
  await meter('after paying');
  await shot('6-tax-paid-after');
  record('tax-paid', paid);

  // 7. THE TAX REFUSED, AND THE FIGHT BY THE STEPS
  console.log('7. the tax refused');
  await load(stopped.after, 'refuse');
  const noKey = (await ev('window.__demo.hud.view')).choices.find(c => c.choice.do === 'tax' && !c.choice.pay).key;
  const noCard = await boxOf(`.u-card[data-key="${noKey}"]`);
  if (!noCard) throw new Error('refuse: no Refuse card on the dock');
  await click(noCard.x, noCard.y, 'the tax: refuse Dutch');
  await page.sleep(400);
  if ((await ev('window.__demo.hud.phase')) === 'choose' && !(await ev('window.__demo.hud.state.sixes.taxDay'))) await click(noCard.x, noCard.y, 'the tax: refuse Dutch (again: it goes)');
  await page.sleep(2400);
  await still('7-refused-scene');
  await compare('tax-refused', refused);
  const m7 = await meter('after refusing');
  if (m7?.value !== refused.after.sixes.marks.reduce((a, m) => a + m.n, 0)) fail(`refuse: the meter reads ${m7?.value}`);
  await shot('7-refused-after');
  record('tax-refused', refused);
  await load(nightAfter.state, 'night-after');
  await toBed('7-night', nightAfter);
  await choosing();
  await page.sleep(1500);
  const n7 = await textOf('.rn-notice');
  console.log(`  the morning's notice: "${n7?.slice(0, 240)}"`);
  if (!/on the kerb/i.test(n7 ?? '')) fail(`night: no warning of the two on the kerb: "${n7}"`);
  await shot('7-warned');
  await compare('night-after', nightAfter);
  record('night-after', nightAfter, { notice: n7 });
  await load(steps.state, 'steps');
  await pick('steps', steps);
  await key('Enter');
  const e7 = steps.events.find(x => x.type === 'jumped' && x.sixes);
  const f7 = await fight('7-steps', e7);
  if (f7 && !f7.bars.some(b => /Two of the Sixes/i.test(b))) fail(`steps: the bar does not name the Sixes: ${JSON.stringify(f7.bars)}`);
  await compare('steps', steps);
  await meter('after the steps');
  await page.sleep(800);
  await shot('7-steps-after');
  record('steps', steps);

  // (the stage's audit over everything above, before the reload starts a new page)
  {
    const a = await ev('(a => a && { overlaps: a.overlaps, vanish: a.vanish, feet: a.feet, heads: a.heads, furniture: a.furniture, examples: a.examples.filter(x => /^(overlaps?|vanish|feet|heads?|furniture) /.test(x)).slice(0, 8) })(window.__demo.stage.actors.audit())').catch(() => null);
    report.audit = a;
    console.log(`the stage's audit: ${JSON.stringify(a)}`);
  }
  // 8. A VERSION-10 SAVE, LOADED
  console.log('8. a version-10 save');
  await ev(`localStorage.setItem('hk2.run.save', ${JSON.stringify(JSON.stringify({ kind: 'the-run-page', v: 1, at: { day: v10.state.day, hour: v10.state.hour }, run: JSON.stringify(v10), page: {} }))})`);
  await page.send('Page.navigate', { url: `http://127.0.0.1:${port}/demo/?mode=run&seed=${SEED}` });
  await page.sleep(1500);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase', 240000);
  await choosing();
  await page.sleep(2500);
  const st = await ev('window.__demo.hud.state');
  console.log(`  loaded: version ${st.v}, day ${st.day} ${st.hour}:00 at ${st.place}, the Sixes ${JSON.stringify(st.sixes?.marks)}, Earl told ${st.earlWay}`);
  // (raid-1: a version-10 save is read through 11 to the state version of now, 12)
  if (st.v !== RUN_STATE_VERSION || !st.sixes || st.day !== v10.state.day || st.place !== v10.state.place) fail(`save: the version-10 save did not load as itself (v ${st.v}, day ${st.day}, ${st.place})`);
  await shot('8-v10-loaded');
  report.save = { v: st.v, day: st.day, place: st.place };

} catch (err) {
  fail(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
} finally {
  const bad = page ? page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]')) : [];
  if (bad.length) fail(`${bad.length} page errors: ${[...new Set(bad)].slice(0, 6).join(' | ').slice(0, 1500)}`);
  report.faults = faults;
  writeFileSync(path.join(out, 'run-sixes.json'), `${JSON.stringify(report, null, 1)}\n`);
  await browser.close();
  console.log(faults.length ? `sixes-fail: ${faults[0]}` : 'sixes-ok');
  process.exitCode = faults.length ? 1 : 0;
}
