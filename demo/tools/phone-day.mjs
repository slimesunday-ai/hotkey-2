#!/usr/bin/env node
// ONE DAY OF THE RUN BY TAPS ALONE (phone-1): headless Chrome set up as a phone (demo/tools/phone-setup.mjs), the play
// page opened, and a whole in-game day played with nothing but taps (touch events at the middle of the page's own
// buttons and cards, as a finger lands: Input.dispatchTouchEvent; never a key, a script's click() or the page's
// handles). What to choose is the scripted player's (src/run/policies.mjs, --policy, park by default); how it is
// chosen is a tap on its card, or on the verb that opens the list it is in and then on its line, then on Go. Skip,
// Continue, Go on and Got it are tapped as they come.
// It FAILS on any page error, a request that failed, a choice it could not reach by a tap, a tap that landed on
// something other than what it aimed at, or no new day in --minutes. It also opens the fight page (?mode=fight) and
// taps through its first pick, and turns the phone, and says what each did.
// THE CAMERA BY FINGER (touch-1): at every moment a player would move it (at home at the start, with a card open, with
// a card waiting for a press, on the street, after a scene has played, after the day, after a fight), in both of its
// states (the free orbit and the Lock on a person), a drag on the right, a drag on the left 40 %, a pinch apart and a
// pinch together; each is counted, and one that does not move the camera FAILS (with who had the finger). A tap on a
// person in the picture must be heard as a click on them. The page must never zoom, scroll or select under any of it.
// A server must be running:  node demo/serve.mjs --port 5523
//
//   HK2_DEBUG_PORT=5787 node demo/tools/phone-day.mjs --port 5523 [--path /demo/] [--query ...] [--policy park]
//        [--seed 3] [--minutes 25] [--shots <dir>] [--urls <file>] [--device phone|desktop]
// Prints one line a step, then `day-ok` or `day-fail: <why>`. --urls writes every address the page asked for (to
// check an export holds them all, with the same case: a static host's paths are case-sensitive, this Mac's are not).
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { PHONE, DESKTOP, emulate, connect } from './phone-setup.mjs';
import { RUN_CONFIG as cfg, view } from '../../src/run/index.mjs';
import { POLICIES, decide } from '../../src/run/policies.mjs';
import { dockOf, placeOf } from '../run/dock.js';

const opt = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
};
const PORT = opt('--port', 5523);
const DEBUG = Number(process.env.HK2_DEBUG_PORT) || 5787;
const PAGE_PATH = opt('--path', '/demo/');
const EXTRA = opt('--query', '');
const SEED = Number(opt('--seed', 3));
const MINUTES = Number(opt('--minutes', 25));
const SHOTS = opt('--shots', null) ? path.resolve(opt('--shots')) : null;
const URLS = opt('--urls', null);
const D = opt('--device', 'phone') === 'desktop' ? DESKTOP : PHONE;
// (park by default: the dealer takes cash and goods out of the crib by amounts a finger cannot set at phone width yet)
const POLICY = opt('--policy', 'park');
const BASE = `http://127.0.0.1:${PORT}${PAGE_PATH}`;
const URL0 = `${BASE}?mode=run&seed=${SEED}&new=1&speed=4${EXTRA ? `&${EXTRA}` : ''}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = s => console.log(s);
const problems = [];
const fail = s => {
  problems.push(s);
  say(`  FAIL: ${s}`);
};

const browser = await launch({ debugPort: DEBUG, width: D === PHONE ? 500 : D.width, height: D === PHONE ? 900 : D.height });
let page = null;
const asked = new Set();
const failedReq = [];
// every gesture tried on the camera, at every moment, in every state (touch-1)
const gestures = { tried: 0, moved: 0, list: [] };
// taps on a person in the picture: tried, and heard as a click on them
const personTaps = { tried: 0, heard: 0 };
// the page errors of a tab closed on the way (the fight page has a tab of its own: below)
const errorsBefore = [];
/** A tab of the browser set up as the phone (or the desktop), with every finger and request heard. */
async function setUp(targetId = null) {
  const p = await connect(DEBUG, targetId);
  await emulate(p.send, D);
  // who has a finger (touch-1): every press, release and cancel the page hears, and what was under the last press
  await p.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const P = window.__fingers = { down: 0, up: 0, cancel: 0, last: '' };
    const name = e => { const t = e.target; return !t ? '?' : t.tagName === 'CANVAS' ? 'the picture' : typeof t.className === 'string' && t.className ? '.' + t.className.split(' ')[0] : t.tagName; };
    addEventListener('pointerdown', e => { P.down++; P.last = name(e); }, true);
    addEventListener('pointerup', () => { P.up++; }, true);
    addEventListener('pointercancel', () => { P.cancel++; }, true); })()` });
  // the network as it is on this machine: the day is about taps, not the 4G (the measure is phone-probe.mjs)
  await p.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  p.on('Network.requestWillBeSent', q => { if (/^https?:/.test(q.request.url)) asked.add(q.request.url.split('#')[0]); });
  p.on('Network.responseReceived', q => { if (q.response.status >= 400) failedReq.push(`${q.response.status} ${q.response.url}`); });
  p.on('Network.loadingFailed', q => { if (!q.canceled) failedReq.push(`failed ${q.errorText}`); });
  return p;
}
try {
  page = await setUp();

  const ev = js => page.evaluate(js);
  /** A finger on the middle of the first visible element matching `sel` (or the element itself, by index). */
  async function tap(sel, why = sel) {
    const at = await ev(`(() => {
      const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden' && !e.disabled; });
      const e = els[0];
      if (!e) return null;
      e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = e.getBoundingClientRect();
      const x = Math.min(innerWidth - 2, Math.max(2, r.left + r.width / 2)), y = Math.min(innerHeight - 2, Math.max(2, r.top + r.height / 2));
      const top = document.elementFromPoint(x, y);
      return { x, y, hit: !!top && (top === e || e.contains(top)), top: top ? (top.className || top.tagName).toString().slice(0, 60) : null, w: r.width, h: r.height };
    })()`);
    if (!at) return false;
    if (!at.hit) {
      fail(`a tap on ${why} would land on ${at.top} (it is under something)`);
      return false;
    }
    const point = { x: at.x, y: at.y, radiusX: 8, radiusY: 8, force: 1, id: 1 };
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await sleep(60);
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(250);
    return at;
  }

  say(`phone-day: ${URL0} (${D === PHONE ? `phone ${D.width}×${D.height} @${D.ratio}, CPU ×${D.cpu}` : 'desktop'})`);
  const t0 = Date.now();
  await page.send('Page.navigate', { url: URL0 });
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose" && document.body.classList.contains("up")', 600000, 250);
  say(`  up in ${((Date.now() - t0) / 1000).toFixed(1)} s; preset ${await ev('window.__city.PR.name')}, pixel ratio ${await ev('window.__city.renderer.getPixelRatio()')}`);
  await sleep(1500);
  if (SHOTS) await page.shot(path.join(SHOTS, `trailer.jpg`));

  // THE CAMERA BY FINGER (touch-1). At every moment a player would move the camera (at home at the start, on the
  // street, with a card open, after a scene has played, after the day, after a fight), in both of the camera's states
  // the game uses (the free orbit: the map's controls; and on a person: the city's Lock), four gestures on the open
  // picture: a one-finger drag on the right, one on the left 40 %, a pinch apart and a pinch together. Each must move
  // the camera as the mouse's drag and wheel do: in the orbit the camera or its target moves (a drag) or its distance
  // to the target changes (a pinch); in the Lock the viewer's bearing or pitch changes (a drag) or the distance (a
  // pinch). The state the game has the camera in is taken first; the other is put by the rig's own switches, as its
  // keys do (to the orbit at once, as the stage's cuts do; the Lock on the player), and the game's picture is asked
  // back afterwards (the stage's focus(null), as Esc). A gesture spoiled by a cut of the stage's is tried again.
  const camNow = () => ev(`(c => { const r = c.cam, a = r.lock.angles, p = c.camera.position, t = c.controls.target, s = window.__demo.stage?.camera?.state?.() ?? {};
    return { mode: r.mode, blending: !!r.blending, a: [a.az, a.el, a.d], p: [p.x, p.y, p.z], t: [t.x, t.y, t.z], d: p.distanceTo(t), cuts: s.cuts ?? 0, on: s.on ?? '',
      who: (window.__fingers ? window.__fingers.down + ' presses heard, the last on ' + (window.__fingers.last || 'nothing') + ', ' + window.__fingers.cancel + ' cancelled' : 'no presses counted') + '; rig input ' + (r.input.active ? 'on' : 'off') + ', map controls ' + (c.controls.enabled ? 'on' : 'off') + ' (' + (c.controls._pointers?.length ?? '?') + ' pointers held, state ' + c.controls.state + ')' + (s.on ? '; stage on ' + s.on : '') }; })(window.__city)`);
  const touch = (type, points) => page.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const drag = async (x0, y0, x1, y1) => {
    await touch('touchStart', [{ x: x0, y: y0, id: 1 }]);
    for (let k = 1; k <= 12; k++) { await touch('touchMove', [{ x: x0 + (x1 - x0) * k / 12, y: y0 + (y1 - y0) * k / 12, id: 1 }]); await sleep(16); }
    await touch('touchEnd', []);
    await sleep(700);
  };
  const pinch = async (cx, cy, from, to) => {
    const pts = s => [{ x: cx - s, y: cy, id: 1 }, { x: cx + s, y: cy, id: 2 }];
    await touch('touchStart', pts(from));
    for (let k = 1; k <= 12; k++) { await touch('touchMove', pts(from + (to - from) * k / 12)); await sleep(16); }
    await touch('touchEnd', []);
    await sleep(900);
  };
  /**
   * The point nearest (fx, fy) (shares of the window; the first of `fxs` that has one) where the city's picture is
   * under a finger, with `pad` px of it on both sides: a panel or a card over the middle leaves the picture above or
   * below it.
   */
  const openAt = (fxs, fy, pad = 0) => ev(`(() => { const c = window.__city.renderer.domElement, on = (x, y) => document.elementFromPoint(x, y) === c;
    for (const fx of ${JSON.stringify([].concat(fxs))}) { const x = innerWidth * fx; for (let k = 0; k < innerHeight / 6; k++) { const y = innerHeight * ${fy} + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 12;
      if (y > 20 && y < innerHeight - 20 && on(x, y) && on(x - ${pad}, y) && on(x + ${pad}, y)) return { x, y }; } } return null; })()`);
  /** The share of the window where the city's picture is under a finger (a grid of 12 × 24 points). */
  const openShare = () => ev(`(() => { const c = window.__city.renderer.domElement; let n = 0; for (let i = 0; i < 12; i++) for (let j = 0; j < 24; j++) if (document.elementFromPoint((i + 0.5) * innerWidth / 12, (j + 0.5) * innerHeight / 24) === c) n++; return n / 288; })()`);
  const wrapA = v => Math.atan2(Math.sin(v), Math.cos(v));
  /** What a gesture did, from the camera's state before and after it: 'moved', 'NOT', or null (spoiled: a cut or a switch came between). */
  function judge(kind, a, b) {
    if (a.mode !== b.mode || a.cuts !== b.cuts || a.blending) return null;
    if (a.mode === 'lock') {
      return (kind === 'pinch' ? Math.abs(b.a[2] - a.a[2]) / a.a[2] > 0.01 : Math.abs(wrapA(b.a[0] - a.a[0])) > 0.005 || Math.abs(b.a[1] - a.a[1]) > 0.005) ? 'moved' : 'NOT';
    }
    if (kind === 'pinch') return Math.abs(b.d - a.d) / a.d > 0.01 ? 'moved' : 'NOT';
    return a.p.some((v, k) => Math.abs(v - b.p[k]) > 0.05) || a.t.some((v, k) => Math.abs(v - b.t[k]) > 0.05) ? 'moved' : 'NOT';
  }
  async function into(want) {
    const now = await camNow();
    if (want === 'orbit' && now.mode !== 'orbit') await ev('window.__city.cam.toOrbit({ instant: true })');
    if (want === 'lock' && now.mode !== 'lock') {
      const ok = await ev(`(() => { const s = window.__demo.stage, id = s.debug().you, A = id && s.actors.has(id) ? s.actors.get(id) : null; return !!A && window.__city.cam.setMode('lock', { subject: A.w }); })()`);
      if (!ok) return false;
    }
    for (let k = 0; k < 40 && (await camNow()).blending; k++) await sleep(150);
    await sleep(500);
    return (await camNow()).mode === want;
  }
  async function cameraAt(moment) {
    // (a card over the whole window leaves no picture to drag, for a finger as for the mouse: said, not counted)
    if ((await openShare()) <= 0.05) {
      const over = await ev(`(e => e ? (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : e.tagName) : 'nothing')(document.elementFromPoint(innerWidth * 0.5, innerHeight * 0.42))`);
      say(`  camera ${moment}: the picture is under ${over} on the whole window (none of it open): nothing to drag`);
      return;
    }
    const first = (await camNow()).mode === 'lock' ? 'lock' : 'orbit';
    const parts = [];
    for (const state of [first, first === 'lock' ? 'orbit' : 'lock']) {
      if (!(await into(state))) { parts.push(`${state}: could not be put there`); fail(`${moment}: the camera could not be put in ${state}`); continue; }
      const right = await openAt([0.7, 0.8, 0.6], 0.42, 45), left = await openAt([0.2, 0.3, 0.1], 0.42), mid = await openAt([0.62, 0.5], 0.42, 120);
      const said = [];
      for (const [name, kind, at, go] of [
        ['drag on the right', 'drag', right, p => drag(p.x, p.y, p.x - 80, p.y + 10)],
        ['drag on the left 40 %', 'drag', left, p => drag(p.x, p.y, p.x + 60, p.y + 10)],
        ['pinch apart', 'pinch', mid, p => pinch(p.x, p.y, 40, 110)],
        ['pinch together', 'pinch', mid, p => pinch(p.x, p.y, 110, 40)],
      ]) {
        if (!at) {
          const over = await ev(`(e => e === window.__city.renderer.domElement ? 'the picture' : e ? (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : e.tagName) : 'nothing')(document.elementFromPoint(innerWidth * 0.5, innerHeight * 0.42))`);
          const share = await openShare();
          said.push(`${name}: no open picture there (${over} covers it; the picture is open on ${Math.round(share * 100)} % of the window)`);
          if (share > 0.05) fail(`${moment}, ${state}: the picture is open on ${Math.round(share * 100)} % of the window but a ${name} found no room`);
          continue;
        }
        let got = null;
        let why = '';
        for (let tries = 0; tries < 3 && got === null; tries++) {
          const a = await camNow();
          await go(at);
          const b = await camNow();
          got = judge(kind, a, b);
          why = b.who;
          if (got === null) await sleep(800);
        }
        if (got === null) { said.push(`${name}: spoiled three times by the stage's cuts`); continue; }
        gestures.tried++;
        if (got === 'moved') gestures.moved++;
        gestures.list.push(`${moment}/${state}/${name}: ${got}`);
        said.push(`${name} ${got === 'moved' ? (kind === 'pinch' ? 'zoomed' : 'moved') : `did NOT ${kind === 'pinch' ? 'zoom' : 'move'} (${why})`}`);
        if (got !== 'moved') fail(`${moment}, ${state}: a ${name} did not ${kind === 'pinch' ? 'zoom' : 'move'} the camera (${why})`);
      }
      parts.push(`${state}: ${said.join('; ')}`);
    }
    // the page itself: no zoom, no scroll, no selection under any of it
    const pg = await ev('({ scale: visualViewport ? visualViewport.scale : 1, scroll: [scrollX, scrollY, document.scrollingElement.scrollTop], sel: String(getSelection()).length })');
    if (pg.scale !== 1) fail(`${moment}: the page itself zoomed (${pg.scale})`);
    if (pg.scroll.some(v => v !== 0)) fail(`${moment}: the page scrolled (${pg.scroll})`);
    if (pg.sel) fail(`${moment}: text got selected (${pg.sel} characters)`);
    say(`  camera ${moment} (the game had it in ${first}): ${parts.join(' | ')}`);
    // the game's own picture again, as Esc asks for it
    await ev('window.__demo.stage?.camera?.focus?.(null)');
    await sleep(600);
  }
  /** A tap on a person in the picture (not the player): the stage hears who it was, as a click (actors.pickAt). */
  async function tapPerson(moment) {
    const at = await ev(`(() => { const s = window.__demo.stage, you = s.debug().you, c = window.__city.renderer.domElement;
      for (const A of s.actors.all()) { if (A.id === you || A.w.hide) continue; const h = s.actors.screenOf(A.id); if (!h.visible) continue;
        for (const dy of [4, 10, 16, 24]) { const x = h.x, y = h.y + dy; if (x < 30 || x > innerWidth - 30 || y < 40 || y > innerHeight - 40 || document.elementFromPoint(x, y) !== c) continue;
          if (s.actors.pickAt(x, y) === A.id) return { x, y, id: A.id }; } } return null; })()`);
    if (!at) { say(`  a tap on a person ${moment}: nobody clear in the picture to tap`); return; }
    personTaps.tried++;
    const before = await ev('window.__demo.stage.debug().clicks.up');
    await touch('touchStart', [{ x: at.x, y: at.y, radiusX: 8, radiusY: 8, force: 1, id: 1 }]);
    await sleep(60);
    await touch('touchEnd', []);
    await sleep(500);
    const k = await ev('window.__demo.stage.debug().clicks');
    const ok = k.up > before && k.last === at.id;
    say(`  a tap on a person ${moment}: ${ok ? `heard (${at.id})` : `NOT heard as a click on ${at.id} (last ${k.last})`}`);
    if (ok) personTaps.heard++;
    else fail(`${moment}: a tap on ${at.id} was not heard as a click on them`);
    await ev('window.__demo.stage?.camera?.focus?.(null)');
    await sleep(600);
  }
  await cameraAt('at home at the start');
  // a double tap on the picture must not zoom the page
  const dtAt = (await openAt([0.7], 0.42)) ?? { x: 270, y: 350 };
  const dt = { x: dtAt.x, y: dtAt.y, id: 1 };
  for (let k = 0; k < 2; k++) { await touch('touchStart', [dt]); await touch('touchEnd', []); await sleep(120); }
  await sleep(600);
  const scale2 = await ev('visualViewport ? visualViewport.scale : 1');
  const scrolled = await ev('[scrollX, scrollY, document.scrollingElement.scrollTop]');
  if (scale2 !== 1) fail(`a double tap zoomed the page (${scale2})`);
  if (scrolled.some(v => v !== 0)) fail(`the page scrolled (${scrolled})`);
  const did = { street: false, card: false, picked: false, scene: false };
  let sawPlaying = false;

  // THE DAY
  const s0 = await ev('window.__demo.hud.state');
  const day0 = s0.day;
  say(`  day ${day0}, ${s0.hour}:00 at ${s0.place}; playing until day ${day0 + 1}`);
  const VERB_OF = { buy: 'shop', shop: 'shop', rob: 'rob', bins: 'bins', travel: 'travel', ride: 'travel', walk: 'travel', home: 'home', sleep: 'sleep' };
  const pol = typeof POLICIES[POLICY] === 'function' ? POLICIES[POLICY](120) : POLICIES[POLICY];
  let steps = 0;
  let shotMarket = false;
  let noSteps = false;
  const seen = new Map();
  const deadline = Date.now() + MINUTES * 60000;
  while (Date.now() < deadline) {
    const st = await ev('(h => ({ phase: h.phase, day: h.state.day, hour: h.state.hour, place: h.state.place, sel: h.sel ?? null }))(window.__demo.hud)').catch(() => null);
    if (!st) { await sleep(300); continue; }
    if (st.day > day0 && st.phase === 'choose') break;
    if (SHOTS && !shotMarket && st.place === 'market' && st.phase === 'choose') { await sleep(1200); await page.shot(path.join(SHOTS, 'market.jpg')); shotMarket = true; }
    // THE CAMERA AT THE DAY'S MOMENTS: the first card that waits for a press, the first time the player is out on the
    // street (the Lock on them), the first choice after an hour has played
    if (!did.card && await ev(`[...document.querySelectorAll('.hk-go')].some(e => e.getBoundingClientRect().width > 2)`)) {
      did.card = true;
      const card = await ev(`(e => (e.closest('[class*="hk-"]:not(.hk-go)')?.className.split(' ')[0] ?? '') + ' "' + e.textContent.trim().slice(0, 24) + '"')([...document.querySelectorAll('.hk-go')].find(e => e.getBoundingClientRect().width > 2))`);
      say(`  (the card waiting for a press: ${card})`);
      await cameraAt('with a card waiting for a press');
      continue;
    }
    if (st.phase === 'playing') sawPlaying = true;
    if (st.phase === 'choose' && !did.street && (await camNow()).on.startsWith('lock:')) {
      did.street = true;
      await sleep(800);
      await cameraAt('on the street');
      await tapPerson('on the street');
      continue;
    }
    if (st.phase === 'choose' && !did.scene && sawPlaying && did.street) {
      did.scene = true;
      await sleep(800);
      await cameraAt('after a scene has played');
      await tapPerson('after a scene has played');
      continue;
    }
    // the cards that wait for a press: the night's, the report's, held, a news card's
    if (await tap('.hk-go', 'Go on / Got it')) { say(`  tap: ${await ev('document.title')} · a card's Go on`); continue; }
    if (st.phase !== 'choose') {
      if (await tap('.u-dock-row .u-btn.is-go', 'Continue')) { say('  tap: Continue'); continue; }
      if (st.phase === 'playing' && await tap('.u-skip', 'Skip')) { await sleep(400); continue; }
      await sleep(300);
      continue;
    }
    // CHOOSE: the scripted player's choice, reached by taps
    const state = await ev('window.__demo.hud.state');
    const v = view(cfg, state);
    let ch = decide(cfg, state, pol, v);
    // (out and in again with the clock standing: the player goes to bed instead, when bed is a choice here)
    if ((seen.get(JSON.stringify([st.day, st.hour, st.place, state.carried, state.banked])) ?? 0) >= 2) {
      const bed = v.choices.find(x => x.available !== false && (x.choice.do === 'sleep' || x.choice.do === 'home'));
      if (bed) { say(`  (the clock stood still twice here: ${bed.label} instead)`); ch = bed.choice; }
    }
    if (!ch) { fail(`the ${POLICY} player has no choice at day ${st.day} ${st.hour}:00`); break; }
    // (the same choice, or the card of the same move: its amount is the card's own, as a finger takes it)
    const want = v.choices.find(x => JSON.stringify(x.choice) === JSON.stringify(ch)) ?? v.choices.find(x => x.available !== false && x.choice.do === ch.do && (ch.id === undefined || x.choice.id === ch.id) && (ch.to === undefined || x.choice.to === ch.to));
    if (!want) { fail(`no ${JSON.stringify(ch)} among the choices`); break; }
    const sel = `[data-key="${want.key.replace(/"/g, '\\"')}"]`;
    let at = await tap(sel, `the choice ${want.key}`);
    if (!at) {
      // (where the page's own dock puts it: one of the three cards, or a verb's list: demo/run/dock.js)
      const verb = placeOf(dockOf({ cfg, v }), want.key)?.verb ?? VERB_OF[ch.do];
      if (verb && await tap(`.u-verb[data-verb="${verb}"]`, `the verb ${verb}`)) {
        // a verb with a list opens it (then its line is tapped); a verb of one move picks it (lit: is-on)
        at = await tap(sel, `the choice ${want.key} in ${verb}'s list`);
        if (!at) at = await ev(`!!document.querySelector('.u-verb[data-verb="${verb}"].is-on:not(.has-list)')`);
      }
    }
    if (!at) { fail(`could not reach ${want.key} (${want.label}) by a tap`); break; }
    // WITH A CARD OPEN: the first choice whose card (or verb's list) is open and waits for Go. The fingers on the
    // picture may close it (a press on the game closes the drawers, as the mouse's does): it is reached again by taps
    if (!did.picked) {
      did.picked = true;
      say(`  (the card open: ${want.label})`);
      await cameraAt('with a card open');
      continue;
    }
    // THE CASH TAKEN OUT (Step out's own − and +, a dollar a tap): set to the player's when they are on the screen
    if (typeof ch.take === 'number') {
      const takeNow = () => ev(`(() => { const b = document.querySelector('.u-card.is-on .u-take b'); return b && b.getBoundingClientRect().width ? Number(b.textContent.replace(/[^0-9]/g, '')) : null; })()`);
      let cur = await takeNow();
      if (cur === null) {
        if (!noSteps) say(`  (Step out's − and + are not on the screen at this width: the card's own amount is taken)`);
        noSteps = true;
      }
      for (let k = 0; cur !== null && cur !== ch.take && k < 80; k++) {
        const which = cur < ch.take ? 1 : 0;
        await ev(`(() => { const s = document.querySelector('.u-card.is-on .u-take').querySelectorAll('.u-step'); s.forEach(x => x.removeAttribute('data-phone-step')); s[${which}].setAttribute('data-phone-step', '1'); })()`);
        if (!(await tap('[data-phone-step="1"]', 'the cash − or +'))) break;
        cur = await takeNow();
      }
    }
    // a loop that never moves the clock (out and in again) is broken by going to sleep: the day ends as a player's would
    const sig = JSON.stringify([st.day, st.hour, st.place, state.carried, state.banked]);
    seen.set(sig, (seen.get(sig) ?? 0) + 1);
    const picked = await ev('window.__demo.hud.sel ?? null').catch(() => null);
    if (await ev('window.__demo.hud.phase') === 'choose') {
      if (!(await tap('.u-go', 'Go'))) { fail(`Go could not be tapped for ${want.key} (picked ${picked})`); break; }
    }
    steps++;
    say(`  step ${steps}: day ${st.day} ${st.hour}:00 ${st.place}: ${want.label} (${want.key}) by taps`);
    await sleep(500);
  }
  const s1 = await ev('window.__demo.hud.state');
  if (s1.day <= day0) fail(`no new day after ${MINUTES} minutes (day ${s1.day} ${s1.hour}:00)`);
  else say(`  a new day: day ${s1.day}, ${s1.hour}:00 at ${s1.place}, after ${steps} choices by taps, ${((Date.now() - t0) / 60000).toFixed(1)} minutes`);

  // THE CAMERA AGAIN, after a day of play
  for (const [k, moment] of [['card', 'with a card waiting for a press'], ['picked', 'with a card open'], ['street', 'on the street'], ['scene', 'after a scene has played']]) if (!did[k]) fail(`the day never came to the moment "${moment}"`);
  await cameraAt('after the day');
  await tapPerson('after the day');

  // TURNING THE PHONE: landscape, then back; the picture must fill the new shape
  if (D === PHONE) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: D.height, height: D.width, deviceScaleFactor: D.ratio, mobile: true, screenOrientation: { type: 'landscapePrimary', angle: 90 } });
    await sleep(1500);
    const fit = await ev('(c => ({ w: innerWidth, h: innerHeight, cw: c.renderer.domElement.clientWidth, ch: c.renderer.domElement.clientHeight }))(window.__city)');
    if (SHOTS) await page.shot(path.join(SHOTS, 'turned.jpg'));
    say(`  turned: the window ${fit.w}×${fit.h}, the picture ${fit.cw}×${fit.ch}`);
    if (fit.cw !== fit.w || fit.ch !== fit.h) fail(`turned, the picture is ${fit.cw}×${fit.ch} in a ${fit.w}×${fit.h} window`);
    await page.send('Emulation.setDeviceMetricsOverride', { width: D.width, height: D.height, deviceScaleFactor: D.ratio, mobile: true, screenOrientation: { type: 'portraitPrimary', angle: 0 } });
    await sleep(1500);
    const fit2 = await ev('(c => ({ w: innerWidth, h: innerHeight, cw: c.renderer.domElement.clientWidth, ch: c.renderer.domElement.clientHeight }))(window.__city)');
    if (fit2.cw !== fit2.w || fit2.ch !== fit2.h) fail(`turned back, the picture is ${fit2.cw}×${fit2.ch} in a ${fit2.w}×${fit2.h} window`);
  }

  // THE FIGHT PAGE: its first pick by a tap. In a tab of its own: after a two-finger touch, Chrome's DevTools touch
  // emulation hands no finger at all (no touchstart, no pointerdown) to the next page opened in the same tab
  // (measured, touch-1: a pinch, then a navigation, then nothing; a tap or a drag alone does not do it). That is the
  // emulation's, not the page's: a phone's browser starts every page with no finger down.
  {
    const fresh = await fetch(`http://127.0.0.1:${DEBUG}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json());
    errorsBefore.push(...page.errors);
    page.close();
    await fetch(`http://127.0.0.1:${DEBUG}/json/close/${page.id}`).catch(() => {});
    page = await setUp(fresh.id);
  }
  await page.send('Page.navigate', { url: `${BASE}?mode=fight${EXTRA ? `&${EXTRA}` : ''}` });
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "pick"', 600000, 250);
  await sleep(1500);
  const pickBtn = await ev(`(() => { const b = [...document.querySelectorAll('#hud button')].find(b => b.getBoundingClientRect().width > 4 && !b.disabled && /fight|go|start/i.test(b.textContent)); if (!b) return null; b.setAttribute('data-phone-tap', '1'); return b.textContent.trim().slice(0, 40); })()`);
  if (pickBtn && await tap('[data-phone-tap="1"]', `the fight's ${pickBtn}`)) {
    await sleep(3000);
    const ph = await ev('window.__demo.hud.phase');
    say(`  the fight page: tapped "${pickBtn}", now ${ph}`);
    if (SHOTS) await page.shot(path.join(SHOTS, 'fight.jpg'));
    // AFTER A FIGHT: the camera by finger once it is over
    const over = await page.waitFor('window.__demo.hud.phase === "over"', 240000, 500).then(() => true, () => false);
    if (over) {
      await cameraAt('after a fight');
      await tapPerson('after a fight');
    }
    else fail(`the fight page's fight did not end in 4 minutes (phase ${await ev('window.__demo.hud.phase')})`);
  } else {
    say('  the fight page: no button to start a fight found by its words (pictured as it is)');
    if (SHOTS) await page.shot(path.join(SHOTS, 'fight.jpg'));
    fail('the fight page: no fight could be started by a tap, so the camera after a fight was not tried');
  }
} catch (err) {
  fail(String(err?.stack ?? err).slice(0, 800));
} finally {
  const short = gestures.list.filter(x => !x.endsWith(': moved'));
  say(`  gestures: ${gestures.moved} of ${gestures.tried} moved the camera${short.length ? `; not: ${short.join(', ')}` : ''}; taps on a person: ${personTaps.heard} of ${personTaps.tried} heard`);
  const errs = [...errorsBefore, ...(page?.errors ?? [])];
  for (const e of errs) fail(`page error: ${e}`);
  for (const r of failedReq) fail(`request: ${r}`);
  if (URLS) { mkdirSync(path.dirname(path.resolve(URLS)), { recursive: true }); writeFileSync(URLS, `${[...asked].sort().join('\n')}\n`); say(`  ${asked.size} addresses asked for, written to ${URLS}`); }
  page?.close();
  await browser.close();
}
say(problems.length ? `day-fail: ${problems[0]}` : 'day-ok');
process.exit(problems.length ? 1 : 0);
