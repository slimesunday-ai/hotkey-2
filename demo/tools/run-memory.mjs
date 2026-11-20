#!/usr/bin/env node
// PEOPLE REMEMBER, PLAYED IN THE PAGE AND CHECKED (memory-1, RUN.md "People remember"). The server must be running:
// node demo/serve.mjs --port 5498 --quiet
//
//   HK2_DEBUG_PORT=5739 node demo/tools/run-memory.mjs --port 5498 --out <dir> [--speed 2]
//
// First, headless (the run's own engine, src/run/), one run of real steps from a new run: day 1, Benny Two-Coats's debt
// goes wrong and the fight is WON (he fears you for the week); day 2, the same man's debt, collected with no fight (he
// pays up); to bed each night to day 7; day 7, odd jobs into the evening, when Benny says he is coming by tomorrow; to
// bed; day 8, Benny at the door for another go. Then in the page (/demo/?mode=run), each step from the state before it
// (the page's own hud.load, as the other picture tools do), the choice made with REAL key events (DevTools
// Input.dispatchKeyEvent: the dock's key, C for the You panel, Z to sleep, Enter) and REAL MOUSE PRESSES
// (Input.dispatchMouseEvent: the People tab, the door's "Pay Benny off"):
//   1. the debt gone wrong, the fight watched to its end and won;
//   2. the next day the same man's debt: the card says "fears you: pays up", and it is paid with no fight;
//   3. the You panel's People tab (C, then a mouse press on People): Benny's line reads what he remembers, as the rules say;
//   4. the evening of day 7: the hour into the evening, and the notice "… says he is coming by tomorrow";
//   5. to bed (Z): the night's report, and the eighth morning, Benny at your door for another go, the choice on the bar;
//   6. paid off (a mouse press on the card, then Enter), in one go; and from the same morning, fought (the dock's key,
//      Enter), the fight watched to its end.
// A picture of every step. After every step the page's state must be the headless one. Fails on any page error, a
// fight's frame fault (demo/fight/frame.js), a fight seen to end otherwise than the rules said, or a result that differs.
// Prints `memory-ok` or `memory-fail: <why>`.
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, newRun, step, view, deal } from '../../src/run/index.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-memory'));
const port = opt('--port', 5470);
const speed = Number(opt('--speed', '2'));
const base = `http://127.0.0.1:${port}/demo/?mode=run&seed=3&speed=${speed}`;
mkdirSync(out, { recursive: true });
const BENNY = 'npc:debtor';

// ── HEADLESS: one run of real steps ─────────────────────────────────────────────────────────────────────────────────
/** One step of the engine, kept as { state before, choice, after, events }. */
const go = (s, choice) => ({ state: s, choice, ...(r => ({ after: r.state, events: r.events }))(step(cfg, s, choice)) });
/** Odd jobs in the trailer park until the debt is dealt to Benny (at most `n` hours). null: not dealt. */
function toDebt(s, n = 4) {
  for (let k = 0; k <= n; k++) {
    if (deal(cfg, s).some(j => j.id === 'collect' && j.who?.id === BENNY)) return s;
    if (k === n || s.energy < 2) return null;
    s = go(s, { do: 'job', id: deal(cfg, s)[0].id }).after;
  }
  return null;
}
/** Inside and to bed: the next morning (whoever is at the door answered by paying, unless `keep`). */
function night(s) {
  if (s.place !== 'crib') s = go(s, { do: 'inside' }).after;
  return go(s, { do: 'sleep' }).after;
}
function chain(seed) {
  let s = go(newRun({ seed }), { do: 'out', take: 0 }).after;
  s = toDebt(s);
  if (!s) return null;
  const won = go(s, { do: 'job', id: 'collect' });
  const e1 = won.events.find(e => e.type === 'job');
  if (e1.duel?.result !== 'won' || won.after.marks?.[BENNY]?.kind !== 'beat') return null;
  // day 2: the same man's debt, with no fight
  s = night(won.after);
  if (s.day !== 2 || s.door) return null;
  s = toDebt(go(s, { do: 'out', take: 0 }).after);
  if (!s) return null;
  const sure = go(s, { do: 'job', id: 'collect' });
  const e2 = sure.events.find(e => e.type === 'job');
  if (!e2.fear || e2.duel) return null;
  // to bed every night to day 7 (nobody else at the door on the way)
  s = night(sure.after);
  while (s.day < cfg.memory.days) {
    if (s.door || s.home?.raid) return null;
    s = night(s);
  }
  if (s.door || s.home?.raid || s.day !== cfg.memory.days) return null;
  // day 7: odd jobs into the evening, until Benny says he is coming by tomorrow
  s = go(s, { do: 'out', take: 0 }).after;
  let evening = null;
  for (let k = 0; k < 8 && !evening; k++) {
    const o = deal(cfg, s)[0];
    if (s.energy < 1) return null;
    const r = go(s, { do: 'job', id: o.id });
    if (r.events.some(e => e.type === 'coming' && e.who?.id === BENNY)) evening = r;
    s = r.after;
  }
  if (!evening) return null;
  const inside = go(evening.after, { do: 'inside' });
  const bed = go(inside.after, { do: 'sleep' });
  if (bed.after.door?.kind !== 'due' || bed.after.door.id !== BENNY) return null;
  return { seed, won, sure, evening, inside, bed, pay: go(bed.after, { do: 'give' }), fight: go(bed.after, { do: 'refuse' }) };
}
let C = null;
for (let seed = 1; seed < 800 && !C; seed++) C = chain(seed);
if (!C) throw new Error('no seed gives the whole chain');
const said = r => r.events.filter(e => e.text).map(e => e.text).join(' ');
writeFileSync(path.join(out, 'chain.json'), `${JSON.stringify(C)}\n`);
if (process.argv.includes('--headless')) process.exit(0);
console.log(`headless: seed ${C.seed}`);
for (const k of ['won', 'sure', 'evening', 'bed', 'pay', 'fight']) console.log(`  ${k}: day ${C[k].state.day} ${C[k].state.hour}:00 at ${C[k].state.place}, ${JSON.stringify(C[k].choice)} → ${said(C[k]).slice(0, 260)}`);

// ── THE PAGE ──────────────────────────────────────────────────────────────────────────────────────────────────────
const faults = [];
const fail = why => {
  faults.push(why);
  console.log(`  FAULT: ${why}`);
};
const KEYS = { ' ': ['Space', 32], Enter: ['Enter', 13], ArrowDown: ['ArrowDown', 40], Escape: ['Escape', 27] };
const browser = await launch({ width: 1600, height: 1000 });
let page = null;
const report = { seed: C.seed, steps: [], pictures: [], fights: [] };
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
  /** The middle of the first element matching `sel` (and `text`, if given) that shows. */
  const boxOf = (sel, text = null) => ev(`(() => { const all = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(b => !b.closest('[hidden]') && b.getBoundingClientRect().width > 0 && (${JSON.stringify(text)} === null || b.innerText.includes(${JSON.stringify(text)}))); const b = all[0]; if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
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
  async function load(state, name) {
    await choosing();
    const ok = await ev(`window.__demo.hud.load(${JSON.stringify(state)})`, 60000);
    if (!ok) throw new Error(`${name}: the page would not load the state`);
    await choosing();
    await page.sleep(1800);
  }
  /** Picks the step's choice on the dock with its real key (and ↓ down a list), or with a real mouse press on its card. */
  async function pick(name, c, how = 'key') {
    const v = await ev('window.__demo.hud.view');
    const want = v.choices.find(x => x.choice.do === c.choice.do && (c.choice.id === undefined || x.choice.id === c.choice.id));
    if (!want) throw new Error(`${name}: no ${JSON.stringify(c.choice)} in the page's choices`);
    if (!want.available) throw new Error(`${name}: ${want.label}: ${want.why}`);
    if (how === 'mouse') {
      const b = await boxOf(`.u-card[data-key="${want.key}"]`);
      if (!b) throw new Error(`${name}: no card on the dock for ${want.label}`);
      // (a press on the card already picked does it at once, as a second press on any card does: no Enter after)
      const already = (await ev('window.__demo.hud.sel')) === want.key;
      await click(b.x, b.y);
      await page.sleep(300);
      if (already) {
        if ((await ev('window.__demo.hud.phase')) === 'choose') throw new Error(`${name}: the press on the picked card did not do it`);
        return { ...want, went: true };
      }
    } else {
      const k = await ev(`window.__demo.hud.keyFor(${JSON.stringify(want.key)})`);
      if (!k) throw new Error(`${name}: the dock has no key for ${want.label}`);
      await key(k);
      await page.sleep(250);
      for (let n = 0; n < 16 && (await ev('window.__demo.hud.sel')) !== want.key; n++) {
        await key('ArrowDown');
        await page.sleep(120);
      }
    }
    await page.sleep(300);
    if ((await ev('window.__demo.hud.sel')) !== want.key) throw new Error(`${name}: ${how === 'mouse' ? 'the press' : 'the keys'} never picked ${want.label}`);
    return want;
  }
  /** The page's state now against the headless one after the step. */
  async function compare(name, c) {
    await page.waitFor('["choose", "report", "held"].includes(window.__demo.hud.phase) && !window.__demo.hud.duel.active', 180000, 100);
    await page.sleep(500);
    const got = await ev('window.__demo.hud.state');
    const strip = s => JSON.stringify({ ...s, rig: undefined });
    if (strip(got) !== strip(c.after)) fail(`${name}: the page's state after it is not the headless one (${Object.keys(c.after).filter(k => JSON.stringify(got[k]) !== JSON.stringify(c.after[k])).join(', ')})`);
    else console.log(`  ${name}: the page's state after it is the headless one (day ${got.day} ${got.hour}:00, energy ${got.energy}, banked $${got.banked})`);
  }
  /** A fight in the step: watched to its end, a picture mid-fight; its record checked. */
  async function fight(name, c) {
    const e = c.events.find(x => x.duel);
    await page.waitFor('window.__demo.hud.duel.active', 90000, 50);
    await page.waitFor('(s => !s || s.firstHit !== null)(window.__demo.hud.duel.state)', 40000, 30).catch(() => {});
    await still(`${name}-fight`);
    await page.waitFor('(s => !s || (s.down && s.phase !== "fight"))(window.__demo.hud.duel.state)', 60000, 30).catch(() => {});
    await page.sleep(500 / speed);
    await still(`${name}-fight-end`);
    await page.waitFor('!window.__demo.hud.duel.active', 90000, 50);
    const D = await ev('window.__demo.hud.duel');
    const rec = D.log[D.log.length - 1];
    if (!rec) return fail(`${name}: no fight was played`);
    report.fights.push({ name, result: rec.result, seen: rec.seen, skipped: rec.skipped, frames: rec.frames, hits: rec.hits });
    if (rec.result !== e.duel.result) fail(`${name}: the page's rules said ${rec.result}, headless ${e.duel.result}`);
    if (rec.mismatch) fail(`${name}: the fight seen ended ${rec.seen}, the rules said ${rec.result}`);
    if (rec.skipped) fail(`${name}: the fight was skipped`);
    if (rec.frames?.faults) fail(`${name}: the frame check found ${rec.frames.faults}: ${JSON.stringify(rec.frames.first?.slice(0, 4))}`);
    console.log(`  the fight: ${rec.result} (seen ${rec.seen}), ${rec.hits} blows landed, frames ${rec.frames?.frames}, faults ${rec.frames?.faults}`);
  }
  const textOf = sel => ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); return b && !b.closest('[hidden]') ? b.innerText.replace(/\\s+/g, ' ').trim() : null; })()`);
  const record = (name, c, extra = {}) => report.steps.push({ name, day: c.state.day, hour: c.state.hour, choice: c.choice, text: said(c), ...extra });

  // 1. THE DEBT GONE WRONG, THE FIGHT WON
  console.log('1. the debt gone wrong, the fight won');
  await load(C.won.state, 'won');
  await pick('won', C.won);
  await shot('1-debt-card');
  await key('Enter');
  await fight('1-debt', C.won);
  await compare('won', C.won);
  await page.sleep(600);
  await shot('1-debt-after');
  record('won', C.won);

  // 2. THE NEXT DAY, THE SAME MAN: "fears you: pays up", no fight
  console.log('2. the next day, the same man pays up');
  await load(C.sure.state, 'sure');
  await pick('sure', C.sure);
  const tag = await textOf('.u-card.is-on .rn-fear-tag');
  console.log(`  the card: "${tag}"`);
  if (tag !== 'fears you: pays up') fail(`sure: the card says "${tag}", not "fears you: pays up"`);
  await shot('2-sure-card');
  await key('Enter');
  await page.sleep(2200);
  await still('2-sure-scene');
  await compare('sure', C.sure);
  const D2 = await ev('window.__demo.hud.duel');
  if (D2.active) fail('sure: a fight on a debt from somebody who fears you');
  await page.sleep(500);
  await shot('2-sure-after');
  record('sure', C.sure, { card: tag });

  // 3. THE PEOPLE PANEL: C, then a mouse press on the People tab
  console.log('3. the People panel');
  await key('C');
  await page.sleep(900);
  const tab = await boxOf('.k-tab#k-tab-people');
  if (!tab) fail('people: no People tab on the You panel');
  else await click(tab.x, tab.y);
  await page.sleep(900);
  const lines = await ev('[...document.querySelectorAll(".rn-mark-line")].map(b => b.innerText.replace(/\\s+/g, " ").trim())');
  const want = view(cfg, C.sure.after).marks.find(m => m.who.id === BENNY);
  console.log(`  the People lines: ${JSON.stringify(lines)}`);
  if (!lines.some(l => l.includes(want.did) && l.includes(want.words))) fail(`people: no line reads "${want.text}"`);
  await ev('document.querySelector(".rn-mark-line")?.scrollIntoView({ block: "center" })');
  await page.sleep(300);
  await shot('3-people');
  report.people = lines;
  await key('Escape');
  await page.sleep(500);

  // 4. THE EVENING OF DAY 7: "Benny says he is coming by tomorrow"
  console.log('4. the evening before');
  await load(C.evening.state, 'evening');
  await pick('evening', C.evening);
  await key('Enter');
  await page.sleep(1800);
  await still('4-evening-scene');
  await compare('evening', C.evening);
  await page.sleep(400);
  const notice = await textOf('.rn-notice');
  console.log(`  the notice: "${notice}"`);
  if (!/coming by tomorrow/.test(notice ?? '')) fail(`evening: the notice says "${notice}"`);
  await shot('4-evening-notice');
  record('evening', C.evening, { notice });

  // 5. TO BED (Z), THE NIGHT'S REPORT, THE EIGHTH MORNING AT THE DOOR
  console.log('5. the eighth morning');
  await load(C.bed.state, 'bed');
  await pick('bed', C.bed);
  await key('Enter');
  await page.waitFor('window.__demo.hud.phase === "report"', 120000, 100);
  await page.sleep(1200);
  await shot('5-night-report');
  const rep = await textOf('.rn-report');
  if (!/at your door for another go/.test(rep ?? '')) fail(`bed: the night's report does not say who is at the door: "${(rep ?? '').slice(0, 200)}"`);
  await key('Enter');
  await choosing();
  await compare('bed', C.bed);
  await page.sleep(1500);
  await shot('5-door-pay-card');
  await still('5-door-visit');
  let door = null;
  for (let n = 0; n < 40 && !door; n++) {
    door = await textOf('.rn-door-said');
    if (!door) await page.sleep(250);
  }
  console.log(`  the door: "${door}"`);
  if (!/another go/.test(door ?? '')) fail(`bed: the bar does not say why he is at the door: "${door}"`);
  record('bed', C.bed, { door });

  // 6. PAID OFF (a mouse press on the card, then Enter); and from the same morning, FOUGHT (the dock's key, Enter)
  console.log('6a. paid off');
  await load(C.pay.state, 'pay');
  const paid = await pick('pay', C.pay, 'mouse');
  if (!paid.went) {
    await shot('6-pay-card');
    await key('Enter');
  }
  await page.sleep(1500);
  await still('6-pay-scene');
  await compare('pay', C.pay);
  await page.sleep(500);
  await shot('6-pay-after');
  record('pay', C.pay);
  console.log('6b. fought');
  await load(C.fight.state, 'fight');
  await pick('fight', C.fight);
  await shot('6-fight-card');
  await key('Enter');
  await fight('6-door', C.fight);
  await compare('fight', C.fight);
  await page.sleep(600);
  await shot('6-fight-after');
  record('fight', C.fight);

  const audit = await ev('(a => a && { overlaps: a.overlaps, vanish: a.vanish, feet: a.feet, heads: a.heads, furniture: a.furniture })(window.__demo.stage.actors.audit())').catch(() => null);
  report.audit = audit;
  console.log(`the stage's audit: ${JSON.stringify(audit)}`);
} catch (err) {
  fail(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
} finally {
  const bad = page ? page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]')) : [];
  if (bad.length) fail(`${bad.length} page errors: ${[...new Set(bad)].slice(0, 6).join(' | ').slice(0, 1500)}`);
  report.faults = faults;
  writeFileSync(path.join(out, 'run-memory.json'), `${JSON.stringify(report, null, 1)}\n`);
  await browser.close();
  console.log(faults.length ? `memory-fail: ${faults[0]}` : 'memory-ok');
  process.exitCode = faults.length ? 1 : 0;
}
