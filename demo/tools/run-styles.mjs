#!/usr/bin/env node
// THE FIGHT'S NEW PARTS, PLAYED IN THE PAGE AND CHECKED (styles-1, RUN.md "Fights in the run: styles and getting
// jumped"). The server must be running: node demo/serve.mjs --port 5499 --quiet
//
//   HK2_DEBUG_PORT=5740 node demo/tools/run-styles.mjs --port 5499 --out <dir> [--speed 2]
//
// First, headless (the run's own engine, src/run/), the steps it plays, each from the state before it. Then in the page
// (/demo/?mode=run), each step loaded (the page's own hud.load, as the other picture tools do) and made with REAL key
// events (DevTools Input.dispatchKeyEvent) and REAL MOUSE PRESSES (Input.dispatchMouseEvent):
//   1. at the market with the price on you, quick hands learned from Pockets (B, ↓ to it, Enter); then the Library (L)
//      and a mouse press on its Fight kind: every way to fight, what it does and where it is had;
//   2. on the docks (the throw learned from Mr. Haines, headless) the lift dealt at Big Lou: the card names his style
//      ("big man") and its odds with bare hands; the You panel (C), a mouse press on its Fight tab and on "The throw":
//      fight with it (no hour); the card's odds again, changed (bigman-1: Big Lou a big man, the throw his answer);
//   3. the lift gone wrong: the fight with him, fought with the throw, watched to its end (his style on his bar);
//   4. jumped at the market, two at once, the fight watched where you stand: once seen off (won), once beaten (lost);
//   5. after the loss, the result card's line of what would have helped, as the rules' fightAdvice says it;
//   6. a stallholder you robbed comes due: "Mr. Okafor sent somebody round" at your door (Z, the night, Enter), and he is
//      paid off with a mouse press on the card.
// A picture of every step. After every step the page's state must be the headless one. Fails on any page error, a
// fight's frame fault (demo/fight/frame.js), a fight seen to end otherwise than the rules said, or a result that differs.
// Prints `styles-ok` or `styles-fail: <why>`.
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { roomCheck } from './room-check.mjs';
import { RUN_CONFIG as cfg, newRun, step, view, deal } from '../../src/run/index.mjs';
import { fightAdvice } from '../../src/run/rules.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-styles'));
const port = opt('--port', 5470);
const speed = Number(opt('--speed', '2'));
const SEED = 3;
const base = `http://127.0.0.1:${port}/demo/?mode=run&seed=${SEED}&speed=${speed}${opt('--qs', '')}`;
mkdirSync(out, { recursive: true });
const LOU = 'npc:driver:docks';
const OKAFOR = 'npc:stallholder:2';

// ── HEADLESS: the steps ───────────────────────────────────────────────────────────────────────────────────────────
const go = (s, choice) => ({ state: s, choice, ...(r => ({ after: r.state, events: r.events }))(step(cfg, s, choice)) });
const carrying = (s, n) => ({ ...s, carried: s.carried + n, books: { ...s.books, earned: s.books.earned + n } });
/** A state of the run at `place` on `day` at `hour`, as a new run with these changed (the page loads any). */
const at = (place, o = {}) => {
  const s = newRun({ seed: SEED, cfg });
  return { ...s, place, energy: 5, ...o, owned: { ...s.owned, ...(o.owned ?? {}) } };
};
// 1. quick hands learned at the market, from Pockets
const market0 = carrying(at('market', { day: 2, hour: 14, hoursThere: 0 }), 100);
const learn = go(market0, { do: 'learn', style: 'jab' });
// 2. on the docks the throw learned from Mr. Haines (bigman-1), the lift dealt at Big Lou (a big man), and it goes
// wrong: the hour found on the same day
const docks0 = go(carrying({ ...learn.after, place: 'docks', hoursThere: 0, hour: 14 }, 60), { do: 'learn', style: 'throw' }).after;
let lift = null;
for (let hour = 14; hour < 23 && !lift; hour++) {
  const s = { ...docks0, hour };
  const o = deal(cfg, s).find(j => j.id === 'lift');
  if (o?.who?.id !== LOU) continue;
  const set = go(s, { do: 'fightWith', with: 'throw' });
  const r = go(set.after, { do: 'job', id: 'lift' });
  const e = r.events.find(x => x.type === 'job');
  if (e.duel && !r.events.some(x => x.type === 'jumped' || x.type === 'stopped')) lift = { set, job: r };
}
if (!lift) throw new Error('no hour deals the lift at Big Lou and has it go wrong');
// 4. jumped at the market, seen off and beaten
const jumps = { won: null, lost: null };
for (let day = 2; day < 40 && !(jumps.won && jumps.lost); day++) {
  for (let hour = 14; hour < 20; hour++) {
    const s = carrying(at('market', { day, hour, hoursThere: 2, energy: 4 }), 60);
    const stall = deal(cfg, s)[0];
    const r = go(s, { do: 'job', id: stall.id });
    const e = r.events.find(x => x.type === 'jumped');
    if (!e?.duel) continue;
    if (e.duel.result === 'won' && e.outcome === 'fail' && !jumps.won) jumps.won = r;
    if (e.duel.result === 'lost' && !jumps.lost) jumps.lost = r;
  }
}
if (!jumps.won || !jumps.lost) throw new Error('no jump seen off and none beaten');
const lostE = jumps.lost.events.find(x => x.type === 'jumped');
const advice = fightAdvice(cfg, jumps.lost.state, lostE.duel);
// 6. somebody sent: Mr. Okafor robbed to his face on day 1 comes due on day 8
const okafor = cfg.places.market.people.find(p => p.id === OKAFOR);
const eve0 = at('crib', { day: cfg.memory.days, hour: 21, energy: 2 });
const eve = { ...eve0, banked: 60, books: { ...eve0.books, earned: 40 }, marks: { [OKAFOR]: { kind: 'robbed', day: 1, place: 'market', who: { id: okafor.id, name: okafor.name, role: okafor.role }, warned: true } } };
const night = go(eve, { do: 'sleep' });
if (!night.after.door?.sent) throw new Error('nobody sent to the door');
const pay = go(night.after, { do: 'give' });
const said = r => r.events.filter(e => e.text).map(e => e.text).join(' ');
const C = { seed: SEED, learn, set: lift.set, lift: lift.job, jumpWon: jumps.won, jumpLost: jumps.lost, advice, night, pay };
writeFileSync(path.join(out, 'chain.json'), `${JSON.stringify(C)}\n`);
console.log(`headless: seed ${SEED}`);
for (const k of ['learn', 'set', 'lift', 'jumpWon', 'jumpLost', 'night', 'pay']) console.log(`  ${k}: day ${C[k].state.day} ${C[k].state.hour}:00 at ${C[k].state.place}, ${JSON.stringify(C[k].choice)} → ${said(C[k]).slice(0, 220)}`);
console.log(`  advice after the loss: "${advice?.line}"`);
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
const report = { seed: SEED, steps: [], pictures: [], fights: [], presses: [] };
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
  const boxOf = (sel, text = null) => ev(`(() => { const all = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(b => !b.closest('[hidden]') && b.getBoundingClientRect().width > 0 && (${JSON.stringify(text)} === null || b.innerText.includes(${JSON.stringify(text)}))); const b = all[0]; if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
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
  /** Picks the step's choice on the dock with its real key (and ↓ down a list). */
  async function pick(name, c) {
    const v = await ev('window.__demo.hud.view');
    const want = v.choices.find(x => x.choice.do === c.choice.do && (c.choice.id === undefined || x.choice.id === c.choice.id) && (c.choice.style === undefined || x.choice.style === c.choice.style));
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
    else console.log(`  ${name}: the page's state after it is the headless one (day ${got.day} ${got.hour}:00 at ${got.place}, energy ${got.energy}, carried $${got.carried})`);
  }
  /** A fight in the step: watched to its end, a picture mid-fight and at the end; its record checked. */
  async function fight(name, c) {
    const e = c.events.find(x => x.duel);
    await page.waitFor('window.__demo.hud.duel.active', 90000, 50);
    await page.waitFor('(s => !s || s.firstHit !== null)(window.__demo.hud.duel.state)', 40000, 30).catch(() => {});
    await page.sleep(400 / speed);
    await still(`${name}-fight`);
    const bars = await ev('[...document.querySelectorAll(".rn-duel-side")].map(b => b.innerText.replace(/\\s+/g, " ").trim())');
    await page.waitFor('(s => !s || (s.down && s.phase !== "fight"))(window.__demo.hud.duel.state)', 60000, 30).catch(() => {});
    await page.sleep(500 / speed);
    await still(`${name}-fight-end`);
    await page.waitFor('!window.__demo.hud.duel.active', 90000, 50);
    const D = await ev('window.__demo.hud.duel');
    const rec = D.log[D.log.length - 1];
    if (!rec) return fail(`${name}: no fight was played`);
    report.fights.push({ name, result: rec.result, seen: rec.seen, skipped: rec.skipped, frames: rec.frames, hits: rec.hits, foes: rec.foes, room: rec.anim?.crowd ?? null, bars });
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
    console.log(`  the fight: ${rec.result} (seen ${rec.seen}), ${rec.foes} of them, ${rec.hits} blows landed, frames ${rec.frames?.frames}, faults ${rec.frames?.faults}; the bars: ${JSON.stringify(bars)}`);
    return { rec, bars };
  }
  const textOf = sel => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => !x.closest('[hidden]')); return b ? b.innerText.replace(/\\s+/g, ' ').trim() : null; })()`);
  const record = (name, c, extra = {}) => report.steps.push({ name, day: c.state.day, hour: c.state.hour, choice: c.choice, text: said(c), ...extra });

  // 1. THE THROW LEARNED ON THE DOCKS (B, ↓, Enter); THE LIBRARY'S FIGHT KIND (L, a mouse press)
  console.log('1. quick hands learned at the market');
  await load(C.learn.state, 'learn');
  await pick('learn', C.learn);
  await shot('1-learn-picked');
  await key('Enter');
  await page.sleep(2500);
  await still('1-learn-scene');
  await compare('learn', C.learn);
  record('learn', C.learn);
  await key('L');
  await page.sleep(900);
  await press('.u-lib-head .u-chip', 'Fight', 'the Library: Fight');
  await page.sleep(700);
  const ways = await ev('[...document.querySelectorAll(".u-lib-fightway")].map(b => b.innerText.replace(/\\s+/g, " ").trim())');
  console.log(`  the Library's ways to fight: ${JSON.stringify(ways)}`);
  if (ways.length !== 4 || !ways.some(w => /The throw/.test(w) && /Mr\. Haines teaches it on the docks/.test(w)) || !ways.some(w => /Quick hands/.test(w) && /yours/.test(w)) || !ways.some(w => /haymaker/i.test(w) && /Cousin Earl teaches it/.test(w))) fail(`library: the ways to fight do not say where each is taught: ${JSON.stringify(ways)}`);
  await shot('1-library-fight');
  report.library = ways;
  await key('Escape');
  await page.sleep(500);

  // 2. FIGHT WITH: the card with bare hands; the You panel's Fight tab and "The throw", with mouse presses; the card again
  console.log('2. fight with the throw');
  await load(C.set.state, 'set');
  const vBefore = await ev('window.__demo.hud.view');
  const liftBefore = vBefore.options.find(o => o.id === 'lift');
  await pick('card-before', { choice: { do: 'job', id: 'lift' } });
  const pill0 = await textOf('.u-card.is-on .rn-fight-pill');
  const style0 = (await textOf('.u-card.is-on .rn-fight-pill'))?.match(/^fails: an? (.+?), (?:~|under |over )/)?.[1] ?? null;
  // (and it shows: the pill is not dropped from the card for want of room)
  const pillShows = await ev(`(() => { const b = document.querySelector('.u-card.is-on .rn-fight-pill'); if (!b) return false; const r = b.getBoundingClientRect(); const c = b.closest('.u-card').getBoundingClientRect(); return r.width > 0 && getComputedStyle(b).display !== 'none' && getComputedStyle(b).visibility !== 'hidden' && r.right <= c.right + 1; })()`);
  if (!pillShows) fail('set: the card\'s fight (and his style) is not shown on it');
  const row0 = await textOf('.rn-fight-said');
  console.log(`  the card with ${liftBefore.fight.you.weapon}: "${pill0}" · "${style0}"; the bar: "${row0}"`);
  if (style0 !== 'big man') fail(`set: the card does not name Big Lou's style: "${style0}"`);
  // (the card's own words for the odds: "~4 in 10", and at the ends "under 1 in 10", "over 9 in 10")
  const in10Short = n => (n <= 0 ? 'under 1 in 10' : n >= 10 ? 'over 9 in 10' : `~${n} in 10`);
  if (!(pill0 ?? '').includes(in10Short(liftBefore.fight.in10))) fail(`set: the card's odds "${pill0}" are not the rules' ${liftBefore.fight.in10} in 10`);
  await shot('2-card-bare-hands');
  await key('C');
  await page.sleep(900);
  await press('.k-tab#k-tab-fight', null, 'the You panel: Fight');
  await page.sleep(700);
  await shot('2-you-fight-tab');
  await press('.rn-fightwith', 'The throw', 'Fight with: the throw');
  await page.sleep(1200);
  await compare('set', C.set);
  record('set', C.set);
  await shot('2-you-fight-tab-after');
  await key('Escape');
  await page.sleep(500);
  const vAfter = await ev('window.__demo.hud.view');
  const liftAfter = vAfter.options.find(o => o.id === 'lift');
  await pick('card-after', { choice: { do: 'job', id: 'lift' } });
  const pill1 = await textOf('.u-card.is-on .rn-fight-pill');
  const row1 = await textOf('.rn-fight-said');
  console.log(`  the card with ${liftAfter.fight.you.weapon}: "${pill1}"; the bar: "${row1}"`);
  if (liftAfter.fight.pct === liftBefore.fight.pct) fail('set: the card\'s odds did not change');
  if (!(pill1 ?? '').includes(in10Short(liftAfter.fight.in10))) fail(`set: the card's odds "${pill1}" are not the rules' ${liftAfter.fight.in10} in 10`);
  if (!/with the throw/.test(row1 ?? '')) fail(`set: the bar does not say what you fight with: "${row1}"`);
  await shot('2-card-throw');
  report.card = { before: { arm: liftBefore.fight.you.arm, pct: liftBefore.fight.pct, pill: pill0, style: style0 }, after: { arm: liftAfter.fight.you.arm, pct: liftAfter.fight.pct, pill: pill1, row: row1 } };

  // 3. THE LIFT GONE WRONG: the fight with Big Lou, with the throw
  console.log('3. the lift gone wrong: Big Lou, a big man');
  await key('Enter');
  const f3 = await fight('3-lift', C.lift);
  if (f3 && !f3.bars.some(b => /big, slow, hits like a truck/.test(b))) fail(`lift: his bar does not say his style: ${JSON.stringify(f3.bars)}`);
  if (f3 && !f3.bars.some(b => /the throw/.test(b))) fail(`lift: your bar does not say the throw: ${JSON.stringify(f3.bars)}`);
  await compare('lift', C.lift);
  await page.sleep(600);
  await shot('3-lift-after');
  record('lift', C.lift);

  // 4. JUMPED AT THE MARKET, TWO AT ONCE: seen off, and beaten
  for (const [k, name] of [['jumpWon', '4-jumped-won'], ['jumpLost', '4-jumped-lost']]) {
    console.log(`4. jumped at the market (${k === 'jumpWon' ? 'seen off' : 'beaten'})`);
    const c = C[k];
    await load(c.state, k);
    const v = await ev('window.__demo.hud.view');
    const risk = await textOf('.rn-with-plate');
    console.log(`  the risk line: bad one ${v.danger.oneMore.jump.bad}%, scuffle ${v.danger.oneMore.jump.scuffle}%, "${risk}"`);
    if (!/with bare hands/.test(risk ?? '')) fail(`${k}: the risk line does not say what you fight with: "${risk}"`);
    await pick(k, c);
    await key('Enter');
    const f = await fight(name, c);
    if (f && f.rec.foes !== 2) fail(`${k}: the fight was not two at once (${f.rec.foes})`);
    // (5) after the loss: the line of advice on the card, before Continue
    if (k === 'jumpLost') {
      await page.waitFor('["choose", "report", "held"].includes(window.__demo.hud.phase)', 60000, 100);
      await page.sleep(900);
      const line = await textOf('.u-res-advice');
      const D = await ev('window.__demo.hud.duel');
      console.log(`5. the advice: "${line}" (the rules: "${C.advice.line}")`);
      if (line !== C.advice.line) fail(`advice: the card says "${line}", the rules "${C.advice.line}"`);
      if (D.advice?.line !== C.advice.line) fail(`advice: the page's advice "${D.advice?.line}" is not the rules'`);
      await shot('5-advice');
      report.advice = { card: line, rules: C.advice.line };
      if ((await ev('window.__demo.hud.phase')) === 'held') {
        await compare(k, c);
        await key('Enter');
        await page.sleep(1500);
      } else await compare(k, c);
    } else {
      await compare(k, c);
      await page.sleep(600);
      await shot(`${name}-after`);
    }
    record(k, c, { risk });
  }

  // 6. SOMEBODY SENT: to bed (Z, Enter), the night's report (Enter), the morning at the door; paid off with a mouse press
  console.log('6. somebody sent to your door');
  await load(C.night.state, 'night');
  await pick('night', C.night);
  await key('Enter');
  await page.waitFor('window.__demo.hud.phase === "report"', 120000, 100);
  await page.sleep(1200);
  await shot('6-night-report');
  await key('Enter');
  await choosing();
  await compare('night', C.night);
  await page.sleep(1800);
  let door = null;
  for (let n = 0; n < 40 && !door; n++) {
    door = await textOf('.rn-door-said');
    if (!door) await page.sleep(250);
  }
  console.log(`  the door: "${door}"`);
  if (!/Mr\. Okafor sent somebody round for another go/.test(door ?? '')) fail(`night: the bar does not say who sent him: "${door}"`);
  await still('6-door-sent');
  record('night', C.night, { door });
  const v6 = await ev('window.__demo.hud.view');
  const payC = v6.choices.find(c => c.choice.do === 'give');
  const card = await boxOf(`.u-card[data-key="${payC.key}"]`);
  if (!card) throw new Error('pay: no card on the dock to pay him off');
  await click(card.x, card.y, 'the door: pay him');
  await page.sleep(400);
  if ((await ev('window.__demo.hud.phase')) === 'choose') {
    await shot('6-pay-card');
    await click(card.x, card.y, 'the door: pay him (again: it goes)');
  }
  await page.sleep(1500);
  await still('6-pay-scene');
  await compare('pay', C.pay);
  record('pay', C.pay);
  await page.sleep(500);
  await shot('6-pay-after');

  const audit = await ev('(a => a && { overlaps: a.overlaps, vanish: a.vanish, feet: a.feet, heads: a.heads, furniture: a.furniture, stretch: a.stretch })(window.__demo.stage.actors.audit())').catch(() => null);
  report.audit = audit;
  console.log(`the stage's audit: ${JSON.stringify(audit)}`);
  // (streak-1: a body posed by hand drawn with a part of it past a body's reach, demo/fight/puppet/reach.js)
  if (audit?.stretch) fail(`the stage's audit: ${audit.stretch} bodies drawn stretched past their reach`);
} catch (err) {
  fail(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
} finally {
  const bad = page ? page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]')) : [];
  if (bad.length) fail(`${bad.length} page errors: ${[...new Set(bad)].slice(0, 6).join(' | ').slice(0, 1500)}`);
  report.faults = faults;
  writeFileSync(path.join(out, 'run-styles.json'), `${JSON.stringify(report, null, 1)}\n`);
  await browser.close();
  console.log(faults.length ? `styles-fail: ${faults[0]}` : 'styles-ok');
  process.exitCode = faults.length ? 1 : 0;
}
