#!/usr/bin/env node
// THE RAID ON YOUR HOME, PLAYED IN THE PAGE AND CHECKED (raid-1, RUN.md "The raid on your home (raid-1)", "On the
// page"). The server must be running: node demo/serve.mjs --port 5505 --quiet
//
//   HK2_DEBUG_PORT=5770 node demo/tools/run-raid.mjs --port 5505 --out <dir> [--speed 2] [--headless] [--only rush,runners]
//
// First, headless (the run's own engine, src/run/): for each of the four crews the evening whose night brings the word,
// and a night the raid is due, each from the state before it. Then in the page (/demo/?mode=run), each state loaded
// (the page's own hud.load) and played with REAL keys (DevTools Input.dispatchKeyEvent) and a REAL MOUSE
// (Input.dispatchMouseEvent):
//   1. a gun bought from its seller (the Six-shot from Teo at the market: B, ↓ to it, Enter) and a box of its rounds,
//      a piece bought (the pepper fogger from Mr. Okafor) and seen placed in the trailer; the Library (L) and Ahead (U)
//      saying where each of the four guns and the five pieces is had;
//   2. for each crew, THE WORD: to bed (Z, Enter), the report put away (Enter): the notice (which crew, how many, what it
//      is weak to), the card of the one decision up by itself, its odds arriving;
//   3. THE WORTH METER: a mouse press on it, its slip (what it counts);
//   4. for each crew, THE NIGHT: Y opens the card; a mouse press on every thing you could hold, each one's odds
//      arriving (raidfight-5: the card's folds shut at first, then each opened with a real mouse press); to bed; the
//      night seen (the fight page's raid at your door, demo/run/raidfight.js), its card, and each thing it cost seen
//      where it lives (the money on your numbers, the stock at home, the gun gone from the card, the piece knocked out
//      off the HOME slip, the truce on the notice and the Sixes' meter);
//   5. Dutch's cut on a job card at the market;
//   6. a version-11 save (made by the code before the raid: test/fixtures/run-save-v11.json) in the browser's slot,
//      the page reloaded: it loads, as version 12.
// Fails on any page error, a card that never gets its odds, a frame over 100 ms while the card is open, a raid seen to
// end otherwise than the rules said (the scene's `mismatch`) or with a frame fault, control not back within 5 s of the
// scene's end (its last blow to control: `close`; its end to the night's card), a state that is not the headless one,
// or a consequence not on screen. A picture of every step. Prints `raid-ok` or `raid-fail: <why>`.
import path from 'node:path';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, newRun, step, deal, RUN_STATE_VERSION } from '../../src/run/index.mjs';
import { crewFoes } from '../../src/run/raid.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-raid'));
const port = opt('--port', 5505);
const speed = Number(opt('--speed', '2'));
const ONLY = opt('--only', null)?.split(',') ?? null;
const SEED = 3;
const base = `http://127.0.0.1:${port}/demo/?mode=run&seed=${SEED}&speed=${speed}${opt('--qs', '')}`;
mkdirSync(out, { recursive: true });
const CREWS = ['rush', 'runners', 'shooters', 'bigmen'].filter(c => !ONLY || ONLY.includes(c));
/** Most a frame may take while the card is open (ms). */
const FRAME_MS = 100;

// ── HEADLESS: the states ──────────────────────────────────────────────────────────────────────────────────────────
const go = (s, choice) => ({ state: s, choice, ...(r => ({ after: r.state, events: r.events }))(step(cfg, s, choice)) });
const s0 = newRun({ seed: SEED, cfg });
const at = (place, o = {}) => ({ ...s0, place, energy: 5, ...o, owned: { ...s0.owned, ...(o.owned ?? {}) } });
const money = (s, carried = 0, banked = 0) => ({ ...s, carried: s.carried + carried, banked: s.banked + banked, books: { ...s.books, earned: s.books.earned + carried + banked } });
/** The Sixes at 9 and working their market today (no quiet fade tonight): at their raid step. */
const meter = (day, more = {}) => ({ ...s0.sixes, marks: [{ why: 'refuse', text: `refused Dutch the tax (day ${day})`, n: 9, day }], did: day, word: day - 3, ...more });
const GUNS = { sixshot: true, doorman: true, chopper: true, longeye: true };
const AMMO = { sixshot: 24, doorman: 12, chopper: 60, longeye: 10 };
// 1. the shops
const buyGun = go(money(at('market', { day: 3, hour: 14 }), 300), { do: 'get', item: 'sixshot' });
const buyAmmo = go(buyGun.after, { do: 'ammo', item: 'sixshot' });
const buyFogger = go(buyAmmo.after, { do: 'get', item: 'fogger' });
const trailer = at('crib', { day: 4, hour: 13, things: { ...buyFogger.after.things }, ammo: { ...buyFogger.after.ammo } });
// 2. the word, each crew: the evening whose night brings it (the crew is the run's dice for the morning's day)
const words = {};
for (let day = 3; day < 80 && CREWS.some(c => !words[c]); day++) {
  const r = go(money(at('crib', { day, hour: 21, sixes: meter(day) }), 0, 300), { do: 'sleep' });
  const w = r.events.find(e => e.type === 'sixes' && e.what === 'raidWarned');
  if (w && CREWS.includes(w.crew) && !words[w.crew]) words[w.crew] = r;
}
for (const c of CREWS) if (!words[c]) throw new Error(`no evening brings the word of ${c}`);
// 4. the night, each crew: what you hold and the outcome each one is checked for (the four guns with rounds, the door bar
// and the camera, smokes at home, $400 banked); the night found on the first day it comes to that
const NIGHTS = {
  rush: { size: 1, hold: 'hands', want: 'won', why: 'bare hands against three heavies; held: their pockets and a week\'s truce' },
  runners: { size: 1, hold: 'sixshot', want: 'lost', why: 'the Six-shot against four runners; lost: the clinic, the bank, the stock, the gun, things taken, the door bar knocked out' },
  shooters: { size: 1, hold: 'hands', want: 'lost', why: 'bare hands against a heavy and two shooters; lost' },
  bigmen: { size: 1, hold: 'longeye', earl: true, want: 'won', why: 'the Long-eye and Cousin Earl against two big men; held' },
};
const nightState = (day, crew, size, hold, earl = false) => {
  const c = crewFoes(cfg, crew, size);
  return money(at('crib', { day, hour: 21, energy: 4, stash: { smokes: 6 }, things: { ...GUNS, doorbar: true, camera: true }, ammo: { ...AMMO }, holdWith: null,
    ...(earl ? { home: { ...(s0.home ?? {}), guard: { on: true, until: day + 2 } } } : {}),
    sixes: meter(day, { raid: { day, warned: day - 1, crew, size, n: c.n, stake: 1500 } }) }), 0, 400);
};
const nights = {};
for (const crew of CREWS) {
  const N = NIGHTS[crew];
  for (let day = 3; day < 90 && !nights[crew]; day++) {
    const s = nightState(day, crew, N.size, N.hold, !!N.earl);
    // (the loadout as the player sets it on the card: the hold, then to bed)
    const held = go(s, { do: 'holdWith', with: N.hold });
    const r = go(held.after, { do: 'sleep' });
    const e = r.events.find(x => x.type === 'raid' && x.kind === 'sixes');
    const won = e && e.outcome !== 'beaten';
    if (e && (N.want === 'won') === won && !!e.duel?.earl === !!N.earl && (won || (e.thingsOut?.length && Object.keys(e.goodsTaken ?? {}).length && e.taken))) nights[crew] = { s, held, night: r, e };
  }
  if (!nights[crew]) throw new Error(`no night of ${crew} ${N.want} with ${N.hold}`);
}
// 5. Dutch's cut: at the market the third day running they stop you, with a job dealt
let cut = null;
for (let hour = 13; hour < 20 && !cut; hour++) {
  const day = 9;
  const s = money(at('market', { day, hour, hoursThere: 0, sixes: { ...s0.sixes, marks: [{ why: 'refuse', text: `refused Dutch the tax (day ${day - 1})`, n: 6, day: day - 1 }], did: day - 1, word: day - 4, streak: 2, streakDay: day - 1 } }), 20);
  if (deal(cfg, s).length) cut = s;
}
const v11 = readFileSync(new URL('../../test/fixtures/run-save-v11.json', import.meta.url), 'utf8');
const said = r => r.events.filter(e => e.text).map(e => e.text).join(' ');
console.log(`headless: seed ${SEED}`);
console.log(`  buy: ${said(buyGun)} | ${said(buyAmmo)} | ${said(buyFogger)}`);
for (const c of CREWS) console.log(`  word ${c}: day ${words[c].after.day}: ${words[c].events.find(e => e.what === 'raidWarned').text}`);
for (const c of CREWS) console.log(`  night ${c} (${NIGHTS[c].why}): day ${nights[c].s.day}: ${nights[c].e.outcome}: ${nights[c].e.text}`);
if (process.argv.includes('--headless')) process.exit(0);

// ── THE PAGE ──────────────────────────────────────────────────────────────────────────────────────────────────────
const faults = [];
const fail = why => {
  faults.push(why);
  console.log(`  FAULT: ${why}`);
};
const KEYS = { ' ': ['Space', 32], Enter: ['Enter', 13], ArrowDown: ['ArrowDown', 40], Escape: ['Escape', 27], Tab: ['Tab', 9] };
const browser = await launch({ width: 1440, height: 900 });
let page = null;
const report = { seed: SEED, pictures: [], presses: [], words: {}, worth: null, nights: {}, odds: {}, frames: [], buys: {}, cut: null, save: null };
try {
  page = await browser.open(base);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending', 240000);
  await ev('window.__demo.stage.actors.audit(true)');
  await page.sleep(1500);
  // (THE FRAME WATCH while the card is open: every picture's time apart, kept with the card's state)
  await ev(`(() => { const W = window.__raidFrames = { open: 0, worst: 0, over: [], n: 0 }; let last = performance.now();
    const tick = t => { const dt = t - last; last = t; const up = !!document.querySelector('.rn-raid-print:not([hidden])');
      if (up) { W.n += 1; W.open += dt; if (dt > W.worst) W.worst = dt; if (dt > ${FRAME_MS}) W.over.push(Math.round(dt) + (window.__raidAct ? ' after ' + window.__raidAct : '')); }
      requestAnimationFrame(tick); }; requestAnimationFrame(tick); return true; })()`);
  // (asTyped: Enter as a keyboard types it, with its carriage return: what makes the browser press a focused button)
  async function key(k, asTyped = false) {
    // (what was last done, said beside a long frame while the card is open)
    await page.evaluate(`window.__raidAct = ${JSON.stringify(`the key ${k}`)}`).catch(() => {});
    const [code, vk] = KEYS[k] ?? (/^\d$/.test(k) ? [`Digit${k}`, 48 + Number(k)] : [`Key${k.toUpperCase()}`, k.toUpperCase().charCodeAt(0)]);
    const keyName = k.length === 1 ? k.toLowerCase() : k;
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && k.length === 1 ? { text: keyName } : {}), ...(type === 'keyDown' && k === 'Enter' && asTyped ? { text: '\r' } : {}) });
  }
  async function click(x, y, what) {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    report.presses.push(what);
    await page.evaluate(`window.__raidAct = ${JSON.stringify(`a press: ${what}`)}`).catch(() => {});
  }
  const boxOf = (sel, text = null) => ev(`(() => { const all = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(b => !b.closest('[hidden]') && b.getBoundingClientRect().width > 0 && (${JSON.stringify(text)} === null || b.innerText.includes(${JSON.stringify(text)}))); const b = all[0]; if (!b) return null; b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  async function press(sel, text, what) {
    const b = await boxOf(sel, text);
    if (!b) throw new Error(`${what}: nothing to press (${sel}${text ? ` "${text}"` : ''})`);
    await click(b.x, b.y, what);
    await page.sleep(500);
  }
  async function shot(name) {
    const f = await page.shot(path.join(out, `${name}.jpg`));
    report.pictures.push(f);
    console.log(`  saved ${f}`);
  }
  const textOf = sel => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => !x.closest('[hidden]')); return b ? b.innerText.replace(/\\s+/g, ' ').trim() : null; })()`);
  const choosing = () => page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending && !window.__demo.hud.duel.active', 240000, 100);
  async function load(state, name) {
    await choosing();
    const ok = await ev(`window.__demo.hud.load(${JSON.stringify(state)})`, 90000);
    if (!ok) throw new Error(`${name}: the page would not load the state`);
    await choosing();
    await page.sleep(1500);
  }
  async function pick(name, c) {
    const v = await ev('window.__demo.hud.view');
    const want = v.choices.find(x => x.choice.do === c.choice.do && ['id', 'item', 'to', 'with'].every(k => c.choice[k] === undefined || x.choice[k] === c.choice[k]));
    if (!want) throw new Error(`${name}: no ${JSON.stringify(c.choice)} in the page's choices`);
    if (!want.available) throw new Error(`${name}: ${want.label}: ${want.why}`);
    const k = await ev(`window.__demo.hud.keyFor(${JSON.stringify(want.key)})`);
    if (!k) throw new Error(`${name}: the dock has no key for ${want.label}`);
    await key(k);
    await page.sleep(250);
    for (let n = 0; n < 30 && (await ev('window.__demo.hud.sel')) !== want.key; n++) {
      await key('ArrowDown');
      await page.sleep(120);
    }
    await page.sleep(300);
    if ((await ev('window.__demo.hud.sel')) !== want.key) throw new Error(`${name}: the keys never picked ${want.label}`);
    return want;
  }
  const strip = s => JSON.stringify({ ...s, rig: undefined });
  async function compare(name, after) {
    await page.waitFor('["choose", "report", "held"].includes(window.__demo.hud.phase) && !window.__demo.hud.duel.active', 240000, 100);
    await page.sleep(400);
    const got = await ev('window.__demo.hud.state');
    if (strip(got) !== strip(after)) fail(`${name}: the page's state after it is not the headless one (${Object.keys(after).filter(k => JSON.stringify(got[k]) !== JSON.stringify(after[k])).join(', ')})`);
    else console.log(`  ${name}: the page's state is the headless one (day ${got.day} ${got.hour}:00 at ${got.place})`);
  }
  /** The card open, every figure on it arrived (no "…"), within `ms`: its text, or a fault. */
  async function cardOdds(name, ms = 90000) {
    const t0 = Date.now();
    await page.waitFor('!!document.querySelector(".rn-raid-print:not([hidden])")', 20000, 100).catch(() => {});
    let txt = null;
    for (;;) {
      txt = await textOf('.rn-raid-print');
      if (txt && !txt.includes('…') && /\d+ in 10/.test(txt)) break;
      if (Date.now() - t0 > ms) {
        fail(`${name}: the card never got its odds in ${ms / 1000} s: "${(txt ?? 'no card').slice(0, 200)}"`);
        return txt;
      }
      await page.sleep(200);
    }
    console.log(`  ${name}: the card's odds arrived in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    return txt;
  }
  /**
   * (raidfight-5) THE CARD, TITLES FIRST: each fold (what you lose, what you win, what would help) shut when the card is
   * opened, then opened with a real mouse press on its title: its words shown. One way of saying a chance: never "in 100".
   */
  const foldSel = id => `.rn-raid-print .rn-fold-t[data-fold="${id}"]`;
  async function foldsShut(name) {
    const st = await ev('[...document.querySelectorAll(".rn-raid-print .rn-fold-t")].map(b => [b.dataset.fold, b.getAttribute("aria-expanded"), document.getElementById(b.getAttribute("aria-controls")).hidden])');
    for (const [id, exp, hid] of st) if (exp !== 'false' || !hid) fail(`${name}: the fold "${id}" is open before it is pressed`);
    return st.map(([id]) => id);
  }
  async function openFolds(name) {
    const ids = await ev('[...document.querySelectorAll(".rn-raid-print .rn-fold-t")].map(b => b.dataset.fold)');
    const got = {};
    for (const id of ids) {
      if ((await ev(`document.querySelector('${foldSel(id)}').getAttribute('aria-expanded')`)) !== 'true') await press(foldSel(id), null, `the card: open "${id}"`);
      const open = await ev(`(b => b.getAttribute('aria-expanded') === 'true' && !document.getElementById(b.getAttribute('aria-controls')).hidden)(document.querySelector('${foldSel(id)}'))`);
      if (!open) fail(`${name}: a press on the fold "${id}" did not open it`);
      got[id] = await textOf(`.rn-raid-print .rn-raid-fold.is-${id} .rn-fold-body`);
    }
    // (and by the keyboard: Tab from the fold before it onto "If you hold them", Enter shuts it, Enter opens it again)
    if (ids.includes('lose') && ids.includes('win')) {
      await ev(`document.querySelector('${foldSel('lose')}').focus()`);
      await key('Tab');
      await page.sleep(150);
      const on = await ev(`document.activeElement === document.querySelector('${foldSel('win')}')`);
      const was = await ev(`document.querySelector('${foldSel('win')}').getAttribute('aria-expanded')`);
      await key('Enter', true);
      await page.sleep(250);
      const shut = await ev(`document.querySelector('${foldSel('win')}').getAttribute('aria-expanded')`);
      await key('Enter', true);
      await page.sleep(250);
      const again = await ev(`document.querySelector('${foldSel('win')}').getAttribute('aria-expanded')`);
      if (!on || was !== 'true' || shut !== 'false' || again !== 'true') fail(`${name}: the fold "win" by the keyboard: Tab onto it ${on}, Enter ${was} → ${shut} → ${again}`);
      else console.log('  the fold "If you hold them" by the keyboard: Tab onto it, Enter shut it, Enter opened it');
      await ev('document.activeElement && document.activeElement.blur()');
    }
    const all = await textOf('.rn-raid-print');
    if (/\bin 100\b/.test(all ?? '')) fail(`${name}: the card says a chance "in 100" (one way only: N in 10)`);
    console.log(`  the folds opened by a press: ${ids.join(', ') || 'none'}`);
    return got;
  }
  const frames = async name => {
    const F = await ev('(W => { const r = { ...W, over: W.over.slice() }; W.over = []; W.worst = 0; W.n = 0; W.open = 0; return r; })(window.__raidFrames)');
    report.frames.push({ name, ...F });
    console.log(`  frames with the card open (${name}): ${F.n}, worst ${Math.round(F.worst)} ms, over ${FRAME_MS} ms: ${F.over.length}`);
    if (F.over.length) fail(`${name}: ${F.over.length} frame(s) over ${FRAME_MS} ms while the card was open (${F.over.join(', ')} ms)`);
  };

  // 1. THE SHOPS: A GUN FROM ITS SELLER, ITS ROUNDS, A PIECE, SEEN PLACED; THE LIBRARY AND AHEAD
  console.log('1. the shops');
  await load(buyGun.state, 'buy-gun');
  for (const [name, c] of [['buy-sixshot', buyGun], ['buy-rounds', buyAmmo], ['buy-fogger', buyFogger]]) {
    await pick(name, c);
    await shot(`1-${name}-picked`);
    await key('Enter');
    await page.sleep(2400);
    await compare(name, c.after);
  }
  report.buys = { sixshot: !!(await ev('window.__demo.hud.state.things.sixshot')), rounds: await ev('window.__demo.hud.state.ammo.sixshot'), fogger: !!(await ev('window.__demo.hud.state.things.fogger')) };
  if (!report.buys.sixshot || report.buys.rounds !== buyAmmo.after.ammo.sixshot || !report.buys.fogger) fail(`buys: ${JSON.stringify(report.buys)}`);
  await load(trailer, 'trailer');
  await page.sleep(2500);
  const shows = await ev('window.__demo.stage.starterShows()');
  console.log(`  the crib shows: ${JSON.stringify(shows?.tray)}`);
  for (const k of ['fogger', 'sixshot']) if (!(shows?.tray ?? []).some(([x]) => x === k)) fail(`trailer: ${k} is not placed in the crib`);
  await ev('window.__demo.hud.fold(true)');
  await page.sleep(800);
  await shot('1-trailer-placed');
  await ev('window.__demo.hud.fold(false)');
  report.buys.tray = shows?.tray ?? null;
  // (the Library: each gun and piece, its job and where it is had)
  await key('L');
  await page.sleep(1000);
  await press('.u-lib-head .u-chip', 'Home', 'the Library: Home');
  await page.sleep(700);
  const libs = {};
  for (const k of ['sixshot', 'doorman', 'chopper', 'longeye', 'fogger', 'vest', 'cereal', 'falsewall', 'decoy']) {
    const b = await boxOf(`.u-lib-cell[data-key="${k}"]`);
    if (!b) {
      fail(`library: no cell for ${k}`);
      continue;
    }
    await click(b.x, b.y, `the Library: ${k}`);
    await page.sleep(500);
    const sold = await textOf('.u-lib-card-sold');
    const pic = await ev(`(() => { const c = document.querySelector('.u-lib-cell[data-key="${k}"] canvas, .u-lib-cell[data-key="${k}"] img'); return !!c; })()`);
    libs[k] = { sold, pic };
    const t = cfg.things[k];
    const keeper = Object.values(cfg.people).flat().find(p => p.id === t.keeper)?.name ?? '';
    if (!sold || !sold.toLowerCase().includes(keeper.toLowerCase().split(' ').pop())) fail(`library: ${k} does not say where it is had (${keeper}): "${sold}"`);
    if (k === 'sixshot' || k === 'fogger') await shot(`1-library-${k}`);
  }
  report.buys.library = libs;
  await key('Escape');
  await page.sleep(400);
  await key('U');
  await page.sleep(1500);
  const ahead = await ev('(() => { const d = window.__demo.hud.ahead.data; const n = d?.nodes ?? {}; return Object.fromEntries(["sixshot","doorman","chopper","longeye","fogger","vest","cereal","falsewall","decoy"].map(k => [k, n["thing:" + k]?.where?.text ?? null])); })()');
  console.log(`  Ahead: ${JSON.stringify(ahead)}`);
  for (const [k, w] of Object.entries(ahead ?? {})) if (!w) fail(`ahead: ${k} has no place it is had`);
  report.buys.ahead = ahead;
  await shot('1-ahead');
  await key('Escape');
  await page.sleep(400);

  // 2. THE WORD, AND 3. THE WORTH METER
  for (const crew of CREWS) {
    console.log(`2. the word: ${crew}`);
    const r = words[crew];
    await load(r.state, `word-${crew}`);
    await pick(`word-${crew}`, r);
    await key('Enter');
    await page.waitFor('window.__demo.hud.phase === "report"', 120000, 100);
    await page.sleep(800);
    await key('Enter');
    await choosing();
    await page.sleep(1200);
    await compare(`word-${crew}`, r.after);
    const w = r.events.find(e => e.what === 'raidWarned');
    const notice = await textOf('.rn-notice');
    console.log(`  the notice: "${notice}"`);
    const count = crewFoes(cfg, crew, w.size).text.replace(/^\d+ of them: /, '');
    if (!/The Sixes come tomorrow night/i.test(notice ?? '')) fail(`word-${crew}: the notice does not say they come tomorrow night`);
    if (!(notice ?? '').includes(count)) fail(`word-${crew}: the notice does not say who comes ("${count}")`);
    const weak = { rush: /Weak to .*Doorman/, runners: /Weak to .*Chopper/, shooters: /Weak to .*Six-shot or the Chopper/, bigmen: /Weak to the Long-eye/ }[crew];
    if (!weak.test(notice ?? '')) fail(`word-${crew}: the notice does not say what they are weak to`);
    await shot(`2-word-${crew}-notice`);
    // (titles first: the card is the notice's button, pressed with the mouse)
    await press('.rn-notice .rn-notice-go', null, `the word (${crew}): Your door`);
    const open = await ev('window.__demo.hud.raid.open');
    if (!open) fail(`word-${crew}: the notice's button did not open the card`);
    const card = await cardOdds(`word-${crew}`);
    report.words[crew] = { notice, card: card?.slice(0, 600) };
    await shot(`2-word-${crew}`);
    await frames(`word-${crew}`);
    if (crew === CREWS[0]) {
      console.log('3. the WORTH meter');
      await press('.u-stat.is-worth', null, 'the WORTH meter');
      await page.sleep(600);
      const slip = await textOf('.rn-worth-print');
      console.log(`  the slip: "${slip?.slice(0, 300)}"`);
      const W = r.after.banked;
      if (!slip || !slip.includes('Cash banked') || !slip.includes(`$${W}`)) fail(`worth: the slip does not say what it counts: "${slip?.slice(0, 160)}"`);
      if (!/Who it brings/i.test(slip ?? '')) fail('worth: the slip does not say who it brings');
      report.worth = slip;
      await shot('3-worth-slip');
      await press('.rn-worth-print .rn-print-x', null, 'the WORTH slip: fold');
    }
  }

  // 4. THE NIGHT, EACH CREW
  for (const crew of CREWS) {
    const N = nights[crew];
    console.log(`4. the night: ${crew} (${NIGHTS[crew].why})`);
    await load(N.s, `night-${crew}`);
    // (the odds held back a moment: the card is drawn with "…" where each figure waits, and nothing waits on it)
    await ev('window.__demo.hud.oddsHold(true)');
    await key('Y');
    await page.sleep(600);
    const waiting = await textOf('.rn-raid-print');
    if (!(waiting ?? '').includes('…')) fail(`night-${crew}: the card drew no "…" while its odds were held back`);
    await shot(`4-night-${crew}-card-waiting`);
    await ev('window.__demo.hud.oddsHold(false)');
    const first = await cardOdds(`night-${crew}`);
    // (the first view: who, how many, weak to, in your hands, home or out, who stands with you; the rest folded)
    const shut = await foldsShut(`night-${crew}`);
    for (const id of ['lose', 'win']) if (!shut.includes(id)) fail(`night-${crew}: no fold "${id}" on the card`);
    if (/clinic|truce/i.test(first ?? '')) fail(`night-${crew}: what you lose or win shows before its fold is opened`);
    for (const t of ['In your hands', 'Home or out', 'Who stands with you']) if (!(first ?? '').toLowerCase().includes(t.toLowerCase())) fail(`night-${crew}: the first view does not say "${t}"`);
    await shot(`4-night-${crew}-card-first`);
    // (every thing you could hold, pressed with the mouse: it is held, and its odds are there)
    const holds = await ev('[...document.querySelectorAll(".rn-raid-print .rn-raid-hold")].map(b => b.dataset.hold)');
    const odds = {};
    for (const h of [...holds.filter(x => x !== NIGHTS[crew].hold), NIGHTS[crew].hold]) {
      await press(`.rn-raid-print .rn-raid-hold[data-hold="${h}"]`, null, `the card: hold ${h}`);
      await page.waitFor(`window.__demo.hud.phase === "choose" && window.__demo.hud.state.holdWith === ${JSON.stringify(h)}`, 30000, 100).catch(() => fail(`night-${crew}: pressing ${h} did not set it`));
      await cardOdds(`night-${crew} hold ${h}`, 60000);
      odds[h] = await textOf(`.rn-raid-print .rn-raid-hold[data-hold="${h}"]`);
    }
    report.odds[crew] = odds;
    console.log(`  each thing you could hold: ${JSON.stringify(odds)}`);
    if (holds.length < 5) fail(`night-${crew}: the card shows ${holds.length} things to hold (the four guns and your hands at least)`);
    await shot(`4-night-${crew}-card`);
    const folds = await openFolds(`night-${crew}`);
    if (!/clinic/i.test(folds.lose ?? '')) fail(`night-${crew}: the fold "If they beat you" does not say the clinic: "${folds.lose}"`);
    if (!/truce/i.test(folds.win ?? '')) fail(`night-${crew}: the fold "If you hold them" does not say the truce: "${folds.win}"`);
    report.folds = { ...(report.folds ?? {}), [crew]: folds };
    await shot(`4-night-${crew}-card-open`);
    await frames(`night-${crew}`);
    await compare(`night-${crew} hold`, N.held.after);
    // (to bed: the night)
    await pick(`night-${crew}`, { choice: { do: 'sleep' } });
    await key('Enter');
    // (the raid at your door: the fight page's scene, the rules' own raid)
    await page.waitFor('window.__demo.hud.raid.active', 180000, 50);
    await page.waitFor('(s => s && s.phase === "fight")(window.__demo.hud.raid.state)', 30000, 50).catch(() => {});
    await page.sleep(1500 / speed);
    await shot(`4-night-${crew}-raid`);
    await page.waitFor('(s => !s || s.phase === "down" || s.phase === "after")(window.__demo.hud.raid.state)', 120000, 50).catch(async () => {
      // (a raid that never reaches its end: what it was doing, said)
      fail(`night-${crew}: the raid never reached its end: ${JSON.stringify(await ev('({ state: window.__demo.hud.raid.state, speed: window.__demo.stage.actors.speed, dark: window.__demo.stage.travel?.fade?.dark, phase: window.__demo.hud.phase, focus: document.activeElement && (document.activeElement.className || document.activeElement.tagName) })').catch(e => String(e)))}`);
    });
    await shot(`4-night-${crew}-raid-end`);
    await page.waitFor('!window.__demo.hud.raid.active', 120000, 50);
    const ended = Date.now();
    await page.waitFor('!!document.querySelector(".rn-raid-card")', 120000, 50);
    const toCard = (Date.now() - ended) / 1000;
    await page.sleep(600);
    const card = await textOf('.rn-raid-card');
    const lines = await ev('[...document.querySelectorAll(".rn-raid-card [data-line]")].map(l => l.dataset.line)');
    console.log(`  the night's card: "${card?.slice(0, 400)}"`);
    await shot(`4-night-${crew}-result`);
    const log = (await ev('window.__demo.hud.raid')).log.at(-1);
    const fight = log?.fight;
    report.nights[crew] = { how: log?.how, why: log?.why, outcome: N.e.outcome, fight: fight ? { result: fight.result, seen: fight.seen, mismatch: fight.mismatch, skipped: fight.skipped, frames: fight.frames?.faults ?? null, open: fight.open, close: fight.close, slow: fight.slow, seconds: fight.seconds, earl: fight.earl } : null, toCard, lines, card };
    console.log(`  the scene: ${JSON.stringify(report.nights[crew].fight)}; its end to the card ${toCard.toFixed(2)} s`);
    if (log?.how !== 'scene' || !fight) fail(`night-${crew}: the raid was not played (${log?.how}: ${log?.why})`);
    if (fight?.mismatch) fail(`night-${crew}: the raid seen ended ${fight.seen}, the rules said ${fight.result}`);
    if (fight && fight.result !== (N.e.duel.result)) fail(`night-${crew}: the scene's result ${fight.result}, headless ${N.e.duel.result}`);
    if (fight?.skipped) fail(`night-${crew}: the raid was skipped`);
    if (fight?.frames?.faults) fail(`night-${crew}: the raid's frame check found ${fight.frames.faults}`);
    if (fight && !(fight.close <= 5)) fail(`night-${crew}: control came back ${fight.close} s after the last blow (over 5 s)`);
    if (toCard > 5) fail(`night-${crew}: the night's card came ${toCard.toFixed(2)} s after the scene ended (over 5 s)`);
    if (NIGHTS[crew].earl && !fight?.earl) fail(`night-${crew}: Cousin Earl was not in the raid`);
    // (each consequence on the card)
    const e = N.e;
    const need = e.outcome === 'beaten' ? ['fight', 'clinic', 'bank', 'stock', ...(e.lostGun ? ['gun'] : []), ...e.thingsTaken.map(x => `took:${x.item}`), ...e.thingsOut.map(x => `out:${x.item}`)] : ['fight', 'spoils', 'truce'];
    for (const l of need) if (!lines.includes(l)) fail(`night-${crew}: the card does not say ${l}`);
    await key('Enter');
    await page.waitFor('window.__demo.hud.phase === "report"', 120000, 100);
    await page.sleep(800);
    report.nights[crew].reportText = await textOf('.rn-report');
    await shot(`4-night-${crew}-report`);
    await key('Enter');
    await page.waitFor('["choose", "held"].includes(window.__demo.hud.phase)', 240000, 100);
    await page.sleep(1500);
    await compare(`night-${crew}`, N.night.after);
    // (each consequence where it lives)
    const v = await ev('window.__demo.hud.view');
    const banked = await textOf('.u-stat.is-banked');
    if (!banked?.includes(`$${N.night.after.banked}`)) fail(`night-${crew}: the money is not on your numbers: "${banked}"`);
    if (e.outcome === 'beaten') {
      // (woken in the clinic: the cut there under the report; the rules have you home by the morning)
      if (!(await ev("window.__demo.hud.raid")).log.at(-1)?.clinic) fail(`night-${crew}: the clinic was not seen`);
      if (!/clinic/i.test(report.nights[crew].reportText ?? '')) fail(`night-${crew}: the report does not say the clinic`);
      // (the stock: what is left at home, on the Banked line)
      const left = N.night.after.stash?.smokes ?? 0;
      if (!banked.includes(`+ ${left}`)) fail(`night-${crew}: the stock left at home (${left}) is not on your numbers: "${banked}"`);
      // (the gun gone from the card, the piece knocked out on the HOME slip and off its place)
      await key('Y');
      await page.sleep(700);
      // (the guns to buy are under "What would help": opened with a press)
      await openFolds(`night-${crew} after`);
      const c2 = await textOf('.rn-raid-print');
      const holds2 = await ev('[...document.querySelectorAll(".rn-raid-print .rn-raid-hold")].map(b => b.dataset.hold)');
      if (e.lostGun && holds2.includes(e.lostGun.item)) fail(`night-${crew}: the gun lost (${e.lostGun.item}) is still in the card's hands`);
      if (e.lostGun && !(c2 ?? '').includes(cfg.things[e.lostGun.item].label.replace(/^an? /, ''))) fail(`night-${crew}: the gun lost is not on the card as one to buy again`);
      await shot(`4-night-${crew}-home-card`);
      await key('Y');
      await key('K');
      await page.sleep(700);
      const slip = await textOf('.rn-home-print');
      for (const x of e.thingsOut) if (!new RegExp(`smashed`, 'i').test(slip ?? '') || !(slip ?? '').toLowerCase().includes(cfg.things[x.item].label.replace(/^an? /, '').toLowerCase())) fail(`night-${crew}: ${x.item} is not shown out of action on the HOME slip`);
      const tray = await ev('window.__demo.stage.starterShows()');
      if (e.thingsOut.some(x => x.item === 'doorbar') && tray?.bar) fail(`night-${crew}: the door bar knocked out is still on the door`);
      await shot(`4-night-${crew}-home-slip`);
      await key('K');
    } else {
      const notice = await textOf('.rn-notice');
      if (!new RegExp(`through day ${e.truce}`).test(notice ?? '')) fail(`night-${crew}: no notice of the truce and when it ends: "${notice}"`);
      const six = await textOf('.u-stat.is-sixes');
      if (!/truce till day/i.test(six ?? '')) fail(`night-${crew}: the Sixes' meter does not say the truce: "${six}"`);
      await shot(`4-night-${crew}-truce`);
    }
  }

  // 5. DUTCH'S CUT
  if (cut) {
    console.log('5. Dutch\'s cut');
    await load(cut, 'cut');
    const t = await textOf('.rn-cut');
    console.log(`  the card: "${t}"`);
    report.cut = t;
    if (!/Dutch's cut 40%/.test(t ?? '') || !/a day away: 20%/.test(t ?? '')) fail(`cut: the job card does not say Dutch's cut today and a day away: "${t}"`);
    await shot('5-dutch-cut');
  }

  {
    const a = await ev('(a => a && { overlaps: a.overlaps, vanish: a.vanish, feet: a.feet, heads: a.heads, furniture: a.furniture, examples: a.examples.slice(0, 8) })(window.__demo.stage.actors.audit())').catch(() => null);
    report.audit = a;
    console.log(`the stage's audit: ${JSON.stringify(a)}`);
  }
  // 6. A VERSION-11 SAVE, LOADED
  console.log('6. a version-11 save');
  const s11 = JSON.parse(v11);
  await ev(`localStorage.setItem('hk2.run.save', ${JSON.stringify(JSON.stringify({ kind: 'the-run-page', v: 1, at: { day: s11.state.day, hour: s11.state.hour }, run: v11, page: {} }))})`);
  await page.send('Page.navigate', { url: `http://127.0.0.1:${port}/demo/?mode=run&seed=${SEED}` });
  await page.sleep(1500);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase', 240000);
  await choosing();
  await page.sleep(2500);
  const st = await ev('window.__demo.hud.state');
  const saved = await ev('window.__demo.hud.saved');
  console.log(`  loaded: version ${st.v}, day ${st.day} ${st.hour}:00 at ${st.place}, rounds ${JSON.stringify(st.ammo)}, holding ${st.holdWith}, picked ${saved.picked}`);
  if (st.v !== RUN_STATE_VERSION || !saved.picked || st.day !== s11.state.day || st.banked !== s11.state.banked) fail(`save: the version-11 save did not load as itself (v ${st.v}, day ${st.day}, picked ${saved.picked})`);
  await shot('6-v11-loaded');
  report.save = { v: st.v, day: st.day, place: st.place, banked: st.banked, picked: saved.picked, note: saved.note };
} catch (err) {
  fail(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
} finally {
  const bad = page ? page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]')) : [];
  if (bad.length) fail(`${bad.length} page errors: ${[...new Set(bad)].slice(0, 6).join(' | ').slice(0, 1500)}`);
  report.faults = faults;
  writeFileSync(path.join(out, 'run-raid.json'), `${JSON.stringify(report, null, 1)}\n`);
  await browser.close();
  console.log(faults.length ? `raid-fail: ${faults[0]}` : 'raid-ok');
  process.exitCode = faults.length ? 1 : 0;
}
