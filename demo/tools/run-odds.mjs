#!/usr/bin/env node
// THE ODDS WORKED OUT IN THE BACKGROUND, AS A PLAYER MEETS THEM (smooth-1, demo/run/odds.js). The server must run:
//   node demo/serve.mjs --port 5498 --quiet
//
//   HK2_DEBUG_PORT=5749 node demo/tools/run-odds.mjs --port 5498 [--out <dir>]
//
// In the page (/demo/?mode=run&seed=3), with the odds workers held (hud.oddsHold: the tools' own switch, so the moment a
// player could catch, a scene skipped at once, lasts long enough to look at and press):
//   1. a state at the docks loaded: every figure that comes from a sample of fights says "…" (the cards' fights, the
//      hour's danger, the meter waits), never a number and never "NaN"; a REAL MOUSE PRESS on a card whose fight is
//      still "…", then another (pick, then go): the choice is not taken, the toast says why; a picture of each;
//   2. the workers let go: every figure appears, and they are the very figures Node's rules give for that state
//      (scripts/odds-figures.mjs figuresOf, both sides); the card pressed again with the mouse: the choice is taken;
//   3. the subway from the trailer park to the market (Enter, real keys), arriving tired (odds never worked out on this
//      page), with the workers held again, the ride SKIPPED AT ONCE (Space): at the market the cards say "…" where their
//      figures wait; a mouse press on one is refused; let go, the figures come and are the rules'. A picture of each.
// Prints `odds-ok` or `odds-fail: <why>`.
import path from 'node:path';
import os from 'node:os';
import { mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, view, step } from '../../src/run/index.mjs';
import { isTired } from '../../src/run/rules.mjs';
import { figuresOf } from '../../scripts/odds-figures.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const PORT = opt('--port', 5498);
const OUT = path.resolve(opt('--out', path.join(os.tmpdir(), 'run-odds')));
mkdirSync(OUT, { recursive: true });
const faults = [];
const fail = why => {
  faults.push(why);
  console.log(`  FAULT: ${why}`);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEYS = { ' ': ['Space', 32], Enter: ['Enter', 13], Escape: ['Escape', 27] };

const browser = await launch({ width: 1600, height: 1000 });
try {
  const page = await browser.open(`http://127.0.0.1:${PORT}/demo/?mode=run&seed=3`);
  const ev = (js, ms = 60000) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 300000, 250);
  await sleep(1500);
  const shot = async name => console.log(`  picture ${await page.shot(path.join(OUT, `${name}.jpg`))}`);
  async function key(k) {
    const [code, vk] = KEYS[k] ?? (/^\d$/.test(k) ? [`Digit${k}`, 48 + Number(k)] : [`Key${k.toUpperCase()}`, k.toUpperCase().charCodeAt(0)]);
    const name = k.length === 1 ? k.toLowerCase() : k;
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: name, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && k.length === 1 ? { text: name } : {}) });
  }
  async function click(x, y) {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
  // (what a player reads: the dock's cards and the meter's line; never "NaN" anywhere on the page)
  const nanOnPage = () => ev('document.body.innerText.includes("NaN") || [...document.querySelectorAll("[title],[aria-label]")].some(e => /NaN/.test(e.getAttribute("title") || "") || /NaN/.test(e.getAttribute("aria-label") || ""))');
  const waitingCards = () => ev(`[...document.querySelectorAll('.u-card')].filter(c => c.getBoundingClientRect().width > 0 && c.innerText.includes('…')).map(c => { const r = c.getBoundingClientRect(); return { text: c.innerText.replace(/\\s+/g, ' ').trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 }; })`);
  /** The page's figures now against Node's rules for the page's own state: the same, figure by figure. */
  async function sameAsRules(what) {
    const [v, st] = await Promise.all([ev('window.__demo.hud.view'), ev('window.__demo.hud.state')]);
    const page = JSON.stringify(figuresOf(v));
    const rules = JSON.stringify(figuresOf(view(cfg, st)));
    if (page !== rules) fail(`${what}: the page's figures are not the rules' (${page.slice(0, 200)} against ${rules.slice(0, 200)})`);
    else console.log(`  ${what}: the page's ${JSON.parse(page).length} sampled figures are the rules', every one`);
  }
  /**
   * A card with a figure still "…" (or, `hour`: any card of the hour's work while the hour's own danger waits, the meter
   * saying so): pressed (pick), pressed again (go): not taken, the toast says why.
   */
  async function pressWaiting(what, { hour = false } = {}) {
    let cards = await waitingCards();
    if (!cards.length && hour && (await ev('!!document.querySelector(".rn-meter.is-odds-wait")'))) {
      cards = (await ev(`[...document.querySelectorAll('.u-card')].filter(c => c.getBoundingClientRect().width > 0).map(c => { const r = c.getBoundingClientRect(); return { text: c.innerText.replace(/\\s+/g, ' ').trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 }; })`)).slice(0, 1);
      if (cards.length) console.log(`  ${what}: no card's own figure waits here, but the hour's danger does (the meter waits): a card of the hour's work`);
    }
    if (!cards.length) return void fail(`${what}: no card shows a figure waiting ("…")`);
    const c = cards[0];
    console.log(`  ${what}: ${cards.length} card(s) with a figure waiting; pressing "${c.text.slice(0, 90)}"`);
    const steps0 = await ev('window.__demo.hud.steps');
    await click(c.x, c.y);
    await sleep(400);
    await click(c.x, c.y);
    await sleep(500);
    const toast = await ev('[...document.querySelectorAll(".hk-toasts > *")].map(t => t.innerText).join(" | ")');
    await shot(`${what}-pressed`);
    if ((await ev('window.__demo.hud.steps')) !== steps0 || (await ev('window.__demo.hud.phase')) !== 'choose') fail(`${what}: a choice was taken on a figure still being worked out`);
    else console.log(`  ${what}: not taken; the toast: "${toast}"`);
    if (!/working out the odds/i.test(toast)) fail(`${what}: no word that the odds are still being worked out (toast "${toast}")`);
    return c;
  }

  // 1. THE DOCKS, LOADED WITH THE WORKERS HELD
  console.log('1. the docks, the odds held');
  await ev('window.__demo.hud.oddsHold(true)');
  await ev(`(() => { const h = window.__demo.hud; const s = structuredClone(h.state);
    Object.assign(s, { people: {}, shifts: {}, today: {}, door: null, hoursThere: 0, place: 'docks', day: 2, hour: 15, banked: 40, carried: 60, energy: 6, heat: 0, placeHeat: {} });
    s.owned = { ...s.owned, cutter: true }; s.books.earned += (s.carried + s.banked) - (h.state.carried + h.state.banked);
    window.__loading = h.load(s); return true; })()`);
  await page.waitFor('window.__demo.hud.phase === "choose" && window.__demo.hud.state.place === "docks" && window.__demo.hud.odds.pending', 120000, 100);
  await sleep(2500);
  const o1 = await ev('window.__demo.hud.odds');
  console.log(`  held: ${o1.busy} counts asked and waiting, ${o1.workers} workers, figures pending: ${o1.pending}`);
  if (await nanOnPage()) fail('docks: "NaN" shows on the page');
  const meterWait = await ev('!!document.querySelector(".rn-meter.is-odds-wait")');
  console.log(`  the danger meter says it waits: ${meterWait}`);
  if (!meterWait) fail('docks: the meter does not say its split is still being worked out');
  await shot('1-docks-waiting');
  const pressed = await pressWaiting('1-docks');
  // 2. LET GO: THE FIGURES COME, AND THEY ARE THE RULES'
  console.log('2. let go');
  await ev('window.__demo.hud.oddsHold(false)');
  await ev('window.__loading');
  await page.waitFor('!window.__demo.hud.odds.pending && window.__demo.hud.odds.busy === 0', 120000, 100);
  await sleep(600);
  if (await nanOnPage()) fail('docks, let go: "NaN" shows on the page');
  if ((await waitingCards()).length) fail('docks, let go: a card still says "…"');
  if (await ev('!!document.querySelector(".rn-meter.is-odds-wait")')) fail('docks, let go: the meter still waits');
  await shot('2-docks-ready');
  await sameAsRules('2-docks');
  if (pressed) {
    const again = await ev(`[...document.querySelectorAll('.u-card')].filter(c => c.getBoundingClientRect().width > 0).map(c => { const r = c.getBoundingClientRect(); return { text: c.innerText.replace(/\\s+/g, ' ').trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 }; }).find(c => Math.abs(c.x - ${pressed.x}) < 4 && Math.abs(c.y - ${pressed.y}) < 4)`);
    console.log(`  the card now: "${again?.text.slice(0, 90)}"`);
    const steps0 = await ev('window.__demo.hud.steps');
    await click(pressed.x, pressed.y);
    await sleep(400);
    if ((await ev('window.__demo.hud.phase')) === 'choose') await click(pressed.x, pressed.y);
    await page.waitFor(`window.__demo.hud.steps > ${steps0}`, 20000, 100).then(() => console.log('  pressed again with its figures there: taken'), () => fail('docks: the card, its figures there, was not taken when pressed'));
    await shot('2-docks-taken');
  }
  // 3. THE SUBWAY TO THE MARKET, SKIPPED AT ONCE, THE WORKERS HELD: from the trailer park with just the energy that
  // leaves you tired at the market, so its odds (tired: a jump's other fight) were never worked out on this page and
  // are asked for the moment the ride is decided
  console.log('3. from the trailer park to the market, tired there, the ride skipped at once');
  await page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.duel.active && !window.__demo.hud.odds.pending', 240000, 200);
  const st0 = await ev('window.__demo.hud.state');
  let park = null;
  for (let e = cfg.energy.bed; e >= 1 && !park; e--) {
    const s = structuredClone(st0);
    Object.assign(s, { people: {}, shifts: {}, today: {}, door: null, hoursThere: 0, place: 'park', day: 2, hour: 14, banked: 40, carried: 30, energy: e, heat: 0, placeHeat: {} });
    s.books.earned += (s.carried + s.banked) - (st0.carried + st0.banked);
    const c = view(cfg, s).choices.find(x => x.choice.do === 'subway' && x.choice.to === 'market' && x.available);
    if (!c || isTired(cfg, s)) continue;
    const after = step(cfg, s, c.choice).state;
    if (after.place === 'market' && isTired(cfg, after)) park = s;
  }
  if (!park) fail('3: no energy at the trailer park leaves you tired at the market');
  else await ev(`window.__demo.hud.load(${JSON.stringify(park)})`, 180000);
  await sleep(1500);
  const v3 = await ev('window.__demo.hud.view');
  const ride = v3.choices.find(c => c.choice.do === 'subway' && c.choice.to === 'market' && c.available);
  if (!ride) fail('3: no subway to the market from the trailer park');
  else {
    await ev('window.__demo.hud.oddsHold(true)');
    const k = await ev(`window.__demo.hud.keyFor(${JSON.stringify(ride.key)})`);
    await ev(`window.__demo.hud.pick(${JSON.stringify(ride.key)})`);
    await sleep(300);
    await key('Enter');
    await page.waitFor('window.__demo.hud.phase === "playing"', 20000, 50);
    await sleep(300);
    await key(' ');
    const t0 = Date.now();
    await page.waitFor('window.__demo.hud.phase === "choose" && window.__demo.hud.state.place === "market"', 120000, 100);
    console.log(`  at the market, choosing ${((Date.now() - t0) / 1000).toFixed(1)} s after the skip (the dock's key for the ride was ${k})`);
    await sleep(1200);
    if (await nanOnPage()) fail('market: "NaN" shows on the page');
    const pending = await ev('window.__demo.hud.odds.pending');
    console.log(`  figures still being worked out: ${pending}`);
    if (!pending) fail('market: nothing was pending with the workers held (the check did not test what it says)');
    await shot('3-market-waiting');
    const meter3 = await ev('!!document.querySelector(".rn-meter.is-odds-wait")');
    console.log(`  the danger meter says it waits: ${meter3}`);
    await pressWaiting('3-market', { hour: true });
    await ev('window.__demo.hud.oddsHold(false)');
    await page.waitFor('!window.__demo.hud.odds.pending && window.__demo.hud.odds.busy === 0', 120000, 100);
    await sleep(600);
    if (await nanOnPage()) fail('market, let go: "NaN" shows on the page');
    if ((await waitingCards()).length) fail('market, let go: a card still says "…"');
    await shot('3-market-ready');
    await sameAsRules('3-market');
  }
  const errs = page.logs.filter(l => /\[exception\]|\[error\]/.test(l));
  if (errs.length) fail(`page errors: ${errs.slice(0, 3).join(' | ')}`);
} finally {
  await browser.close();
}
console.log(`pictures in ${OUT}`);
console.log(faults.length ? `odds-fail: ${faults.join('; ')}` : 'odds-ok');
