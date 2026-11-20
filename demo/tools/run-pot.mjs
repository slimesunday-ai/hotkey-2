#!/usr/bin/env node
// THE POT, PLAYED IN THE PAGE THE WAY THE OWNER PLAYS IT (pot-2; demo/run/pot.js, dock.js, index.js; the rules: RUN.md
// "The pot (pot-1)"), in headless Chrome, by real key presses and real mouse clicks (DevTools Input.dispatchKeyEvent and
// Input.dispatchMouseEvent); nothing of the page's own is called to act. From a new run (the page's own load gives it
// $90 banked, as the other picture tools set up a game), at 1600 × 1000:
//   1. out into the trailer park; Shop (B) lists the hot plate and what you cook with, each with who sells it; the hot
//      plate bought with clicks, two tins of night tea and two boxes of rave sticks with the keys (↓ and Enter);
//   2. home (H); Cook (P) opens the pot's screen; each of the three cooked (Zonked: a click on the shelf; Disco Rash: ↓;
//      Disco Coma: clicks), the label read before and the bags counted after; the mix named with the label's Name it
//      and the keyboard; a bag put on the belt from the Stuff panel (O); the smell on HOME's slip (K); the two new rows
//      of WORTH; the fifth tree of Ahead (U), Make, and a card of it;
//   3. to bed (Z); out with the bags; at the bus stop the selling card says the bag and what it will do, a bag sold
//      to Shaky Dee, and the buyer is under it (the place's chips, the People tab, until when); (pot-3) AND HIS BODY:
//      he takes the bag there and then and goes down asleep where the sale ended (a dirty batch, its first buyer: the
//      Pukes first, there, as the sale ends);
//   3b. (pot-3) the subway to the market and back (home, and out) while he sleeps: he is asleep where he went down,
//      not seen to go down again; his wallet lifted (R) off him as he lies asleep (down on your heels beside him: the stage's liftSleeper,
//      played whole, and he never stands); and at the hour the rules end it he wakes where he lay, in sight;
//   4. a night; to the market (T); the crowd's card, the bag changed with a click on it to the mix (Swamp Bedtime),
//      sold; the buyer under it there, (pot-3) dancing in rainbow where the sale ended, and strangers catching it
//      until there are ten; 4b. (pot-3) the subway away and back: the place unloaded and loaded again, the
//      dance turned to sleep meanwhile: FOUND asleep there, nobody seen to go down;
//   5. at 1280 × 720, the pot's screen, the shop's list and a selling card again.
// (pot-3) EVERY BODY MOMENT IS MEASURED ON EVERY FRAME (the page's frame times; every pose handed to the walkers'
// shader, reach.js `stretch`: any stretch fails), and with --film filmed from the game's camera into <out>/film-*/
// (python3 demo/tools/fight-film.py <out>/film-<name> --out <dir> --box 1280x800 makes each clip).
// AT EACH STEP the screen said beforehand what then happened (the label's name, lines and bags against the cook's
// bags and the shelf after; the card's words against the dose; the lift's pay against its range), and A DIRTY BATCH IS
// NOT TO BE KNOWN before its first buyer: no word of it anywhere on the page until then. Fails on any page error.
// Pictures of every step into --out. Prints `pot-ok`, or `pot-fail: <why>`.
// The server must be running: node demo/serve.mjs --port 5525 --quiet
//
//   HK2_DEBUG_PORT=5789 node demo/tools/run-pot.mjs --port 5525 --out <dir> [--seed 3] [--size 1280x720] [--film]
// (--size: the whole play at that size, every picture at it; the last step, the smallest size, is then the same size)
import path from 'node:path';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, newRun } from '../../src/run/index.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-pot'));
const seed = Number(opt('--seed', 3));
const [W, HT] = String(opt('--size', '1600x1000')).split('x').map(Number);
/** (pot-3) --film: the bodies' moments filmed from the game's camera into <out>/film-<name>/ (fight-film.py makes the clips) */
const FILM = process.argv.includes('--film');
const debugPort = Number(process.env.HK2_DEBUG_PORT) || 5479;
const url = `http://127.0.0.1:${opt('--port', 5525)}/demo/?mode=run&seed=${seed}&new=1&speed=4`;
mkdirSync(out, { recursive: true });

const faults = [];
const report = { seed, steps: [], pictures: [], presses: [], films: [] };
const say = t => console.log(t);
const check = (name, ok, extra = {}) => {
  report.steps.push({ name, ok: !!ok, ...extra });
  say(`  ${ok ? 'ok' : 'NO'}: ${name}`);
  if (!ok) faults.push(name);
  return !!ok;
};

const browser = await launch({ width: W, height: HT });
let page = null;
/** (pot-3) the film being made, if any (filmStart) */
let cam = null;
try {
  page = await browser.open(url);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const H = 'window.__demo.hud';
  await page.waitFor(`window.__demo && ${H} && ${H}.phase === "choose"`, 240000);
  await page.sleep(1500);

  // ── real input ──
  const CODES = { Enter: 13, Escape: 27, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Shift: 16 };
  async function key(k, { shift = false, after = 350 } = {}) {
    const one = k.length === 1;
    const code = one ? (/\d/.test(k) ? `Digit${k}` : `Key${k.toUpperCase()}`) : k;
    const vk = one ? k.toUpperCase().charCodeAt(0) : CODES[k];
    const keyName = one ? k.toLowerCase() : k;
    const mods = shift ? 8 : 0;
    if (shift) await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, modifiers: 8 });
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods, ...(one ? { text: keyName } : {}) });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods });
    if (shift) await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
    report.presses.push(`key ${shift ? 'Shift+' : ''}${k}`);
    await page.sleep(after);
  }
  async function type(text) {
    for (const ch of text) {
      await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch, unmodifiedText: ch });
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
    }
    report.presses.push(`typed ${JSON.stringify(text)}`);
    await page.sleep(200);
  }
  const boxOf = sel => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => !x.closest('[hidden]') && x.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  /** A real click on what `sel` finds, in sight, with nothing over it. */
  async function click(sel, what, after = 500) {
    const b = await boxOf(sel);
    if (!b) throw new Error(`${what}: nothing to click (${sel})`);
    const hit = await ev(`(() => { const e = document.elementFromPoint(${b.x}, ${b.y}); const t = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => !x.closest('[hidden]') && x.getBoundingClientRect().width > 0); return !!e && !!t && (e === t || t.contains(e)); })()`);
    if (!hit) throw new Error(`${what}: something lies over it (${sel})`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y, button: 'none' });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    report.presses.push(`click ${what}`);
    await page.sleep(after);
  }
  const text = sel => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => !x.closest('[hidden]') && x.getBoundingClientRect().width > 0); return b ? b.innerText.replace(/\\s+/g, ' ').trim() : null; })()`);
  const st = () => ev(`${H}.state`);
  const vw = () => ev(`${H}.view`);
  let n = 0;
  async function shot(name) {
    n += 1;
    const f = await page.shot(path.join(out, `${String(n).padStart(2, '0')}-${name}.jpg`));
    report.pictures.push(f);
    say(`  saved ${f}`);
  }
  /** Waits for the next choice (a scene played, the odds kept), and puts the result card's eight seconds behind. */
  const notices = [];
  async function settle(extra = 900) {
    await page.waitFor(`${H}.phase === "choose" && !${H}.odds?.pending && !${H}.duel.active`, 180000, 150);
    await page.sleep(extra);
    // (every notice the page put up, for the one that comes from elsewhere: a sleeper waking while you are away)
    const nt = await text('.rn-notice');
    if (nt && notices[notices.length - 1] !== nt) notices.push(nt);
  }
  /** Whether the result card or a night's report is waiting for Enter (the page's own Continue). */
  const reportUp = () => ev(`!!document.querySelector('.hk-overlay.is-on')`);
  /** The rules' choice the dock has picked now. */
  const picked = async () => {
    const k = await ev(`${H}.sel`);
    return k ? (await vw()).choices.find(c => c.key === k) : null;
  };
  // A DIRTY BATCH NOT YET FOUND OUT: no word on the page may say it (the odds' "dirty 12" is the odds, not the batch)
  async function noDirtyWord(when) {
    const hits = await ev(`(() => { const t = document.querySelector('.rn')?.innerText ?? ''; return (t.match(/[^\\n]{0,30}\\b(dirty|Pukes|throw(s|n)? up)\\b[^\\n]{0,30}/gi) ?? []).filter(x => !/dirty \\d+/.test(x) && !/clean \\d+ · dirty/.test(x)); })()`);
    return check(`${when}: nothing on the page says a batch is dirty${hits.length ? ` (${hits.join(' | ')})` : ''}`, !hits.length);
  }
  const shownBags = (state, product) => Object.entries(state.stash ?? {}).filter(([g]) => g === product || g.startsWith(`${product}~`)).reduce((a, [, k]) => a + k, 0);
  // (pot-3) THE BODIES, as the stage has them: who is under what on stage and what each body is doing
  const underState = () => ev('window.__demo.stage.under?.state() ?? { want: [], on: [], log: [] }');
  const bodyOf = id => (id ? ev(`window.__demo.stage.looks?.bodyOf(${JSON.stringify(id)}) ?? null`) : null);
  /**
   * (pot-3) A FILM from the game's camera (--film): every picture the page presents (Chrome's screencast, as
   * looks-film.mjs), and EVERY FRAME MEASURED: the page's own frame times, and every pose handed to the walkers' shader
   * (demo/fight/puppet/reach.js: `stretch`, a part of a body drawn further than 1.5 m from its hips). Without --film the
   * measure is still taken (no pictures). → into report.films; a film with any stretch fails the run.
   */
  async function filmStart(name) {
    const dir = path.join(out, `film-${name}`);
    if (FILM) {
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
    }
    const r0 = await ev(`import('/demo/fight/puppet/reach.js').then(m => ({ poses: m.LOG.poses, bad: m.LOG.bad }))`);
    await ev(`(() => { const F = (window.__potFilm = { frames: [], last: performance.now(), on: true }); const tick = t => { if (!F.on) return; F.frames.push(+(t - F.last).toFixed(2)); F.last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); return true; })()`);
    cam = { name, dir, frames: [], heads: [], n: 0, r0, logs0: page.logs.length, ws: null, poll: null, t0: Date.now() };
    if (!FILM) return;
    const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r => r.json());
    const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('film: no second DevTools socket'));
    });
    let nid = 0;
    const C = cam;
    const cast = (method, params = {}) => ws.send(JSON.stringify({ id: ++nid, method, params }));
    ws.onmessage = event => {
      const msg = JSON.parse(event.data);
      if (msg.method !== 'Page.screencastFrame') return;
      cast('Page.screencastFrameAck', { sessionId: msg.params.sessionId });
      const file = `f-${String(C.n).padStart(5, '0')}.jpg`;
      C.n += 1;
      writeFileSync(path.join(C.dir, file), Buffer.from(msg.params.data, 'base64'));
      C.frames.push({ file, t: msg.params.metadata.timestamp });
    };
    cast('Page.startScreencast', { format: 'jpeg', quality: 84, everyNthFrame: 1 });
    C.ws = ws;
    C.cast = cast;
    // (where the player's head is on the picture, for the clip's box)
    C.poll = setInterval(() => {
      ev(`(s => s ? s.screenOf?.('a1') ?? null : null)(window.__demo.stage)`).then(h => h && C.heads.push({ at: Date.now() / 1000, you: { x: h.x, y: h.y }, st: { film: C.name } }), () => {});
    }, 250);
  }
  async function filmStop(keep = true) {
    const C = cam;
    if (!C) return null;
    cam = null;
    if (C.ws) {
      C.cast('Page.stopScreencast');
      clearInterval(C.poll);
      await page.sleep(300);
      C.ws.close();
    }
    const F = await ev('(F => { if (!F) return []; F.on = false; return F.frames.slice(2); })(window.__potFilm)');
    const r1 = await ev(`import('/demo/fight/puppet/reach.js').then(m => ({ poses: m.LOG.poses, bad: m.LOG.bad, last: m.LOG.last.slice(-4) }))`);
    const errs = page.logs.slice(C.logs0).filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
    const sorted = F.slice().sort((a, b) => a - b);
    const m = { name: C.name, seconds: +((Date.now() - C.t0) / 1000).toFixed(1), pictures: C.frames.length, pageFrames: F.length, longest: +(sorted[sorted.length - 1] ?? 0).toFixed(1), p99: +(sorted[Math.floor(sorted.length * 0.99)] ?? 0).toFixed(1), over33: F.filter(f => f > 33.4).length, poses: r1.poses - C.r0.poses, stretch: r1.bad - C.r0.bad, errors: errs.length, kept: keep };
    if (FILM) writeFileSync(path.join(C.dir, 'film.json'), `${JSON.stringify({ name: C.name, frames: C.frames, heads: C.heads, marks: [], measure: m, pageFrames: F, stretch: r1.bad > C.r0.bad ? r1.last : [] })}\n`);
    if (!keep && FILM) rmSync(C.dir, { recursive: true, force: true });
    report.films.push(m);
    say(`  film ${m.name}: ${m.seconds} s, ${m.pictures} pictures; every frame measured: ${m.pageFrames} page frames, the longest ${m.longest} ms, 99th ${m.p99} ms, over 33 ms ${m.over33}; bodies ${m.poses} poses, stretch ${m.stretch}`);
    check(`the film ${m.name}: no body stretched in any frame (${m.stretch} of ${m.poses} poses)`, m.stretch === 0 && m.poses > 0);
    return m;
  }

  // ── 0. A NEW RUN, $90 BANKED ──
  say('0. a new run');
  const n0 = newRun({ seed, cfg });
  const fresh = { ...n0, banked: 90, books: { ...n0.books, start: 90 } };
  if (!(await ev(`${H}.load(${JSON.stringify(fresh)})`, 60000))) throw new Error('the page would not load the new run');
  await settle(1800);
  await shot('crib-day-1');
  const cook0 = (await vw()).pot;
  check(`at the crib with no hot plate, Cook says where it is sold (${(await text('.u-verb[data-verb="cook"]'))})`, /no hot plate: \$30/.test(await text('.u-verb[data-verb="cook"]') ?? '') && !cook0.station.owned);

  // ── 1. OUT, AND SHOPPING AT THE TRAILER PARK ──
  say('1. out into the trailer park, and the shop');
  await key('1');
  for (let i = 0; i < 12 && Number(String(await text('.u-take .u-sign')).replace(/\D/g, '')) < 70; i++) await key('ArrowUp', { shift: true, after: 200 });
  await key('Enter');
  await settle();
  check(`out at the trailer park with $${(await st()).carried}`, (await st()).place === 'park' && (await st()).carried >= 66);
  await key('B');
  await page.sleep(500);
  const list = await text('.u-list[data-list="shop"]');
  const sellers = ['tea', 'sticks'].map(k => cfg.make.makings[k]);
  const keeperName = id => Object.values(cfg.places).flatMap(p => p.people ?? []).find(p => p.id === id)?.name;
  check(`Shop lists the hot plate and both things to cook with, each with who sells it (${list})`, /hot plate/i.test(list) && /Night tea/.test(list) && /Rave sticks/.test(list) && sellers.every(m => list.includes(keeperName(m.keeper))));
  await shot('shop-list');
  // the hot plate, by clicks: its tile picks it, a second click buys it
  const plateKey = (await vw()).choices.find(c => c.choice.do === 'get' && c.choice.item === 'hotplate').key;
  // (the shelf under the list's lines is longer than the list: the wheel over it until the hot plate's tile is in sight)
  for (let i = 0; i < 12; i++) {
    const s = await ev(`(() => { const L = document.querySelector('.u-list[data-list="shop"]'); const t = L?.querySelector('[data-key="${plateKey}"]'); if (!L || !t) return null; const a = L.getBoundingClientRect(), r = t.getBoundingClientRect(); return { inside: r.top >= a.top && r.bottom <= a.bottom, dy: r.bottom > a.bottom ? r.bottom - a.bottom + 12 : r.top - a.top - 12, x: a.left + a.width / 2, y: a.top + a.height / 2 }; })()`);
    if (!s || s.inside) break;
    await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: s.x, y: s.y, deltaX: 0, deltaY: Math.round(s.dy) });
    report.presses.push(`wheel ${Math.round(s.dy)} over the shop's list`);
    await page.sleep(250);
  }
  await click(`.u-list [data-key="${plateKey}"] .u-shelf-pick, .u-list [data-key="${plateKey}"]`, 'the hot plate');
  await click(`.u-list [data-key="${plateKey}"] .u-shelf-pick, .u-list [data-key="${plateKey}"]`, 'the hot plate, again: bought');
  await settle();
  check('the hot plate is yours, $30 from what you carried', (await st()).things?.hotplate === true);
  // two of each by the keys: B, down the list to it, Enter
  for (const item of ['tea', 'tea', 'sticks', 'sticks']) {
    const before = await st();
    if ((await ev(`${H}.list()`)) !== 'shop') await key('B');
    const want = (await vw()).choices.find(c => c.choice.do === 'making' && c.choice.item === item);
    for (let i = 0; i < 12 && (await ev(`${H}.sel`)) !== want.key; i++) await key('ArrowDown', { after: 150 });
    const line = await text(`.u-list [data-key="${want.key}"]`);
    await key('Enter');
    await settle(400);
    const after = await st();
    const m = cfg.make.makings[item];
    check(`${m.label}: the line said "${line}"; bought for $${m.price}, one more on you`, line.includes(`$${m.price}`) && line.includes(keeperName(m.keeper)) && (after.goods[item] ?? 0) === (before.goods[item] ?? 0) + 1 && after.carried === before.carried - m.price);
  }
  await shot('bought-what-goes-in');

  // ── 2. HOME, AND THE POT ──
  say('2. home, the pot');
  await key('H');
  await key('Enter');
  await settle();
  check('home at the crib, what you cook with at home', (await st()).place === 'crib' && (await st()).stash.tea === 2 && (await st()).stash.sticks === 2);
  await key('P');
  await page.sleep(700);
  check('P opens the pot\'s screen', (await ev(`${H}.sheet`)) === 'pot');
  await noDirtyWord('the pot opened');
  await shot('pot-open');
  /** Puts exactly `want` in the pot by clicks on the shelf. */
  async function fill(want) {
    for (let i = 0; i < 4; i++) {
      const w = await ev(`${H}.pot.with`);
      const extra = w.find(k => !want.includes(k));
      const missing = want.find(k => !w.includes(k));
      if (extra) await click(`.u-pot-thing[data-making="${extra}"]`, `the shelf: ${extra} out`, 350);
      else if (missing) await click(`.u-pot-thing[data-making="${missing}"]`, `the shelf: ${missing} in`, 350);
      else return;
    }
  }
  const named = 'Swamp Bedtime';
  for (const [i, want] of [['tea'], ['sticks'], ['sticks', 'tea']].entries()) {
    if (i === 1) {
      // (by the keys: ↓ walks the sets the pot could take)
      for (let k = 0; k < 4 && (await ev(`${H}.pot.with`)).join('+') !== want.join('+'); k++) await key('ArrowDown', { after: 250 });
    } else await fill(want);
    const v0 = await vw();
    const o = v0.pot.options.find(x => x.with.join('+') === want.join('+'));
    const label = await text('.u-pot-label');
    const go = await text('.u-go');
    check(`the label for ${want.join(' and ')}: ${label}`, label.includes(o.name.toUpperCase()) || label.includes(o.name), { label });
    check(`its numbered lines are the effect's own words (${o.lines.join(' / ')}), the odds, the smell, the hour and the energy`, o.lines.every(l => label.includes(l)) && label.includes(`clean ${o.odds.clean} · dirty ${o.odds.dirty} · something else ${o.odds.extra}`) && /HOME \+\d until day \d/.test(label) && label.includes(`energy ${v0.pot.energy.now} → ${v0.pot.energy.after}`));
    check(`the dock's main button names the cook (${go})`, go.includes(`Cook ${o.name}`));
    await shot(`label-${o.product}`);
    const before = await st();
    await key('Enter', { after: 0 });
    // (the cook is SEEN: the stage's own cook action on the player while the hour plays, its clip watched until done)
    const clips = new Set();
    for (let t = 0; t < 120 && (await ev(`${H}.phase`)) !== 'choose'; t++) {
      const c = await ev(`(a => a ? a.clipName : null)(window.__demo.stage?.actors?.has?.('a1') ? window.__demo.stage.actors.get('a1') : null)`);
      if (c) clips.add(c);
      if (t === 6 && i === 0) await shot('cooking');
      await page.sleep(100);
    }
    await settle();
    check(`the cook was seen: the player's clips while it played (${[...clips].join(', ')})`, [...clips].some(c => /^cook/.test(c)));
    const after = await st();
    const card = await ev(`${H}.news.card`);
    check(`cooked: ${o.bags} bags of ${o.name} at home (${shownBags(before, o.product)} → ${shownBags(after, o.product)}), an hour and an energy; the card says "${card?.head}"`,
      shownBags(after, o.product) === shownBags(before, o.product) + o.bags && after.hour === before.hour + 1 && after.energy === before.energy - 1 && card?.head === `${o.bags} bags of ${o.name}`);
    await noDirtyWord(`${o.name} cooked`);
    await shot(`cooked-${o.product}`);
  }
  // the mix named: Name it on its row (the pot is empty now: no label), the keyboard, Enter
  check(`the pot is empty, and says why to cook next (${await text('.u-pot-reason')})`, !(await ev(`${H}.pot.with`)).length);
  await click('.u-pot [data-act="name"][data-product="disco-coma"]', 'Name it');
  check('Name it opens a box, the focus in it', await ev(`document.activeElement?.classList.contains('u-pot-name-in')`));
  // (the box comes with the name it has, all of it picked: what is typed takes its place. Its letters, S B P T M E I,
  // are the run's keys anywhere else: here they are the box's)
  await type(named);
  check(`typing in the box opens nothing and does nothing else (the box: "${await ev('document.activeElement?.value')}")`, (await ev(`${H}.sheet`)) === 'pot' && (await ev('document.activeElement?.value')) === named && (await ev(`${H}.list()`)) === null);
  await shot('naming');
  await key('Enter');
  await settle(500);
  const book = (await st()).make.kitchen.book;
  check(`named: the rules call it ${book.names['disco-coma']}, and its row says it (${await text('.u-pot-made[data-good="disco-coma"]')})`, book.names['disco-coma'] === named && ((await text('.u-pot-made[data-good="disco-coma"]')) ?? '').includes(named));
  await shot('named');

  // the belt, from the Stuff panel's row
  await key('O');
  await page.sleep(600);
  const rows = await text('.rn-sheet[data-sheet="stuff"] .u-pot-rows');
  check(`Stuff: what you make, one row each, with its colours, on you and at home (${rows})`, rows.includes('Zonked') && rows.includes(named) && rows.includes('Disco Rash') && /0 on you · 6 at home/.test(rows));
  await click('.rn-sheet[data-sheet="stuff"] .u-pot-made[data-good="zonk"] [data-act="belt"]', 'Stuff: Zonked on your belt');
  await settle(500);
  const belt = (await st()).belt;
  check(`a bag of Zonked on your belt (${JSON.stringify(belt)}), and the row says so`, !!belt && belt.good.startsWith('zonk') && /on your belt/.test(await text('.rn-sheet[data-sheet="stuff"] .u-pot-made[data-good="zonk"]')));
  await noDirtyWord('the belt');
  await shot('stuff-row-belt');
  await key('Escape');
  // the smell on HOME's slip (WORTH is on your numbers once the Sixes care about you: at the market, below)
  await key('K');
  await page.sleep(500);
  const smellLine = await ev(`[...document.querySelectorAll('.rn-home-print li')].map(l => l.innerText.trim()).find(t => /smell/i.test(t)) ?? null`);
  check(`HOME's slip has the smell as a reason (${smellLine})`, /smell of your cooking/i.test(smellLine ?? ''));
  await shot('home-slip-smell');
  await key('K');
  // Ahead: the fifth tree
  await key('U');
  await page.sleep(900);
  const branches = await ev('[...document.querySelectorAll(".u-ah-branch")].map(b => b.dataset.branch)');
  const make = await ev('[...document.querySelectorAll(".u-ah-branch.is-make .u-ah-node")].map(b => b.innerText.trim())');
  check(`Ahead: five trees, Make the fifth, names only (${make.join(', ')})`, branches.join() === 'fight,gear,home,places,make' && make.includes(named) && make.includes('Hot plate and pot'));
  await click('.u-ah-node[data-node="product:disco-coma"]', 'Ahead: the mix');
  const aCard = await text('.u-ah-card');
  check(`its card says what it does (${aCard?.slice(0, 120)})`, /dancing/i.test(aCard ?? '') && /asleep/i.test(aCard ?? ''));
  await shot('ahead-make');
  await key('Escape');
  await key('Escape');

  // ── 3. A NIGHT, OUT WITH THE BAGS, THE BUS STOP ──
  say('3. to bed; out with the bags; the bus stop');
  await key('Z');
  await key('Enter');
  for (let i = 0; i < 60 && (await ev(`${H}.phase`)) !== 'choose'; i++) {
    if (await reportUp()) await key('Enter', { after: 600 });
    else await page.sleep(500);
  }
  await settle(1500);
  check(`day ${(await st()).day} at the crib`, (await st()).day === 2 && (await st()).place === 'crib');
  await key('1');
  const outCard = await text('.u-card[data-slot="1"]');
  await key('Enter');
  await settle();
  const s2 = await st();
  check(`out with the bags (the card said "${outCard}"): ${JSON.stringify(s2.goods)}`, s2.place === 'park' && Object.keys(s2.goods).some(g => g.startsWith('zonk')));
  await noDirtyWord('out with the bags');
  /** What of a card is in sight on it: the words of each part not cut off by the card's own edge. */
  const seenOn = slot => ev(`(() => { const c = document.querySelector('.u-card[data-slot="${slot}"]'); if (!c) return ''; const C = c.getBoundingClientRect(); return [...c.querySelectorAll('.u-card-t, .u-card-sub > *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= C.left - 0.5 && r.right <= C.right + 0.5; }).map(e => e.innerText.replace(/\\s+/g, ' ').trim()).join(' | '); })()`);
  /** The dock's card that sells `product` (as it shows), its bag changed with clicks on it until it is; → its slot. */
  async function saleCard(product, nameShown) {
    const v = await vw();
    const o = v.options.find(x => x.available && (x.goodsHere ?? []).some(g => g.good === product));
    if (!o) return null;
    const slot = await ev(`${H}.keyFor(${JSON.stringify(o.key)})`);
    await key(slot);
    for (let i = 0; i < 5 && !((await text(`.u-card[data-slot="${slot}"]`)) ?? '').includes(nameShown); i++) await click(`.u-card[data-slot="${slot}"] .rn-made-pill.is-pick`, 'the card\'s bag', 400);
    return { o, slot };
  }
  /** (pot-3) The subway to `to`, by the keys: T, down the list to it, Enter. */
  async function subway(to) {
    await key('T');
    const c = (await vw()).choices.find(x => x.choice.do === 'subway' && x.choice.to === to && !x.choice.hop && x.available);
    if (!c) throw new Error(`no subway to ${to}`);
    for (let i = 0; i < 16 && (await ev(`${H}.sel`)) !== c.key; i++) await key('ArrowDown', { after: 150 });
    for (let i = 0; i < 16 && (await ev(`${H}.sel`)) !== c.key; i++) await key('ArrowUp', { after: 150 });
    const sel = await ev(`${H}.sel`);
    if (sel !== c.key) throw new Error(`the subway to ${to} could not be picked by the keys (the list: ${await text('.u-list')})`);
    await key('Enter');
  }
  let sale = null;
  for (let i = 0; i < 4 && !(sale = await saleCard('zonk', 'Zonked')); i++) {
    // (not dealt this hour: the safe job, and the next hour's deal)
    const safe = (await vw()).options.find(x => x.sure);
    await key(await ev(`${H}.keyFor(${JSON.stringify(safe.key)})`));
    await key('Enter');
    await settle();
  }
  if (!sale) throw new Error('no selling job at the trailer park in four hours');
  const cardWords = await seenOn(sale.slot);
  const madeText = sale.o.goodsHere.find(g => g.good === 'zonk').made.text;
  check(`the bus stop's card says the bag and what it will do (${cardWords})`, cardWords.includes('Sell Zonked at the bus stop') && cardWords.includes(madeText.replace(/^[^:]*:\s*/, '')));
  await noDirtyWord('the sale card');
  await shot('sale-card-bus-stop');
  const b3 = await st();
  const dee = sale.o.who;
  // (pot-3: THE SALE FILMED from the game's camera, and the buyer's body watched from the moment it ends)
  await filmStart('dee-sale');
  const log0 = (await underState()).log.length;
  await key('Enter');
  // THE BODY: he takes the bag there and then; a dirty batch, the Pukes first; then down where he stands, asleep
  const seenLooks = new Set();
  let lying = null;
  for (let i = 0; i < 160 && !lying; i++) {
    const b = await bodyOf(dee.id);
    if (b) seenLooks.add(b.look);
    if (b?.look === 'zonk' && b.lying) lying = b;
    else await page.sleep(150);
  }
  await settle();
  await page.sleep(2500);
  await filmStop();
  const a3 = await st();
  const v3 = await vw();
  const u = v3.under.find(x => x.who.id === dee.id);
  const asleep = u?.now.find(r => r.effect === 'asleep');
  check(`${dee.name} took it: asleep until ${asleep?.untilClock} (the card said "${madeText}")`, !!asleep && asleep.untilHour === b3.hour + 1 + 3);
  const dirty = v3.make.makers[0].shelf.made.some(r => r.dirty);
  const deeLog = (await underState()).log.slice(log0).filter(e => e.id === dee.id);
  check(`HIS BODY: ${dirty ? 'a dirty batch, its first buyer: the Pukes there as the sale ended, then ' : ''}down where he stood, asleep (the looks on him: ${[...seenLooks].join(' → ')}; his head ${lying?.head} m off the ground; the stage: ${deeLog.map(e => `${e.what} ${e.look ?? ''}`.trim()).join(', ')})`,
    !!lying && (dirty ? deeLog[0]?.what === 'on' && deeLog[0]?.look === 'pukes' && seenLooks.has('pukes') : deeLog[0]?.what === 'on' && deeLog[0]?.look === 'zonk'));
  const chips = await text('.u-where-under');
  check(`the place shows who is under what (${chips})`, /asleep 1/.test(chips ?? ''));
  const note = await text('.rn-notice');
  check(`a notice says it (${note})`, dirty ? /dirty batch/i.test(note ?? '') && /threw up green/.test(note ?? '') : /Under it/.test(note ?? '') && note.includes(dee.name));
  await shot('sold-under-it');
  await key('C');
  await page.sleep(500);
  await click('.rn-sheet #k-tab-people', 'You: People');
  const line = await text(`.rn-under-line[data-under="${dee.id}"]`);
  check(`the People tab says until when (${line})`, (line ?? '').includes(`asleep until ${asleep?.untilClock}`));
  await shot('people-until-when');
  await key('Escape');

  // ── 3b. (pot-3) AWAY AND BACK WHILE HE SLEEPS: the subway to the market and straight back (the trailer park
  // unloaded and loaded again; the subway home lands you at your crib: out again from there) ──
  say('3b. away and back while he sleeps');
  await subway('market');
  await settle(1200);
  check(`at the market (${(await st()).place}, ${(await st()).hour}:00), ${dee.name} asleep at the trailer park meanwhile (${(await vw()).under.find(x => x.who.id === dee.id)?.text})`, (await st()).place === 'market');
  await filmStart('dee-found');
  await subway('park');
  await settle(1200);
  await key('1');
  await key('Enter');
  await settle(1500);
  check(`back out at the trailer park (${(await st()).place}, ${(await st()).hour}:00)`, (await st()).place === 'park');
  const found = await bodyOf(dee.id);
  const stillAsleep = (await vw()).under.find(x => x.who.id === dee.id)?.now.some(r => r.effect === 'asleep');
  const foundLog = (await underState()).log.filter(e => e.id === dee.id).slice(-3);
  await page.sleep(2500);
  await filmStop();
  check(`two hours later ${dee.name} is asleep where he went down, not seen to go down again (his body: ${found?.look}, lying ${found?.lying}, ${found?.t} s into it; the stage: ${foundLog.map(e => e.what).join(', ')})`,
    stillAsleep && found?.look === 'zonk' && found.lying && found.t >= 8);
  await shot('found-asleep');

  // THE SLEEPER'S WALLET: lifted off him where he lies (R picks it, Enter takes it)
  await key('R');
  const lift = await picked();
  const liftCard = await text('.u-go');
  check(`R picks the sleeper's wallet (${liftCard}): sure, $${lift?.pay?.join('–')}`, lift?.choice.do === 'lift' && lift.choice.who === dee.id);
  await shot('lift-picked');
  const a3b = await st();
  const deals0 = await ev('window.__demo.stage.hands.state.log.length');
  await filmStart('dee-lift');
  await key('Enter', { after: 0 });
  // (sampled while it plays: he never gets up; the player goes down beside him)
  let stood = 0;
  for (let i = 0; i < 200 && (await ev(`${H}.phase`)) !== 'choose'; i++) {
    const b = await bodyOf(dee.id);
    if (b && !b.lying) stood++;
    await page.sleep(100);
  }
  await settle();
  const a4 = await st();
  const got = a4.carried - a3b.carried;
  check(`lifted: +$${got}, inside the $${lift.pay[0]}–${lift.pay[1]} it said, and ${dee.name} will know`, got >= lift.pay[0] && got <= lift.pay[1] && !!(a4.marks ?? []).length + 1);
  const deal = (await ev('window.__demo.stage.hands.state.log')).slice(deals0).find(r => r.deal === 'liftSleeper');
  check(`THE LIFT ON A SLEEPER: down on your heels beside him, a hand in the pocket of the hip that is up (the deal played: ${deal ? `${deal.deal}, ${deal.seconds} s, ${deal.skipped ? 'cut short' : 'whole'}, faults ${JSON.stringify(deal.faults)}` : 'none'}); he lay asleep through it (seen standing in ${stood} of the samples)`,
    !!deal && !deal.skipped && !deal.faults?.length && stood === 0);
  await shot('lifted');
  // IT ENDS WHEN THE RULES SAY: his row's last hour, then he wakes where he lies, in sight
  const untilHour = asleep?.untilHour ?? 99;
  for (let i = 0; i < 4 && (await st()).hour < untilHour && (await st()).energy > 0; i++) {
    const safe = (await vw()).options.find(x => x.sure) ?? (await vw()).options.find(x => x.available);
    await key(await ev(`${H}.keyFor(${JSON.stringify(safe.key)})`));
    await key('Enter');
    await settle();
  }
  let woke = null;
  for (let i = 0; i < 80 && !woke; i++) {
    const L = (await underState()).log.filter(e => e.id === dee.id);
    if (L.some(e => e.what === 'free')) woke = L;
    else await page.sleep(150);
  }
  await page.sleep(1000);
  await filmStop();
  const wokeV = (await vw()).under.find(x => x.who.id === dee.id);
  check(`at ${(await st()).hour}:00 the rules have him awake (${wokeV?.text ?? 'nobody under anything'}), and so does the stage: he wakes where he lay, in sight, and is himself (${woke?.slice(-3).map(e => e.what).join(', ')}; no look on him now: ${!(await bodyOf(dee.id))})`,
    (await st()).hour >= untilHour && !wokeV?.now.length && !!woke && woke.some(e => e.what === 'off') && !(await bodyOf(dee.id)));
  await shot('dee-woke');

  // ── 4. THE MARKET, THE NEXT DAY (pot-3: energy for the tries a sale there may need) ──
  say('4. a night; the market');
  await key('H');
  await key('Enter');
  await settle(800);
  await key('Z');
  await key('Enter');
  for (let i = 0; i < 60 && (await ev(`${H}.phase`)) !== 'choose'; i++) {
    if (await reportUp()) await key('Enter', { after: 600 });
    else await page.sleep(500);
  }
  await settle(1500);
  await key('1');
  await key('Enter');
  await settle();
  await subway('market');
  await settle(1500);
  check(`at the market, day ${(await st()).day}`, (await st()).place === 'market');
  // (a sale can go wrong, 25 in 100 in the crowd: the bag lost and nobody dosed, as the rules say; then again next
  // hour, while there is energy, until one goes through. pot-3: the mix, Swamp Bedtime (Disco Coma): two hours of the
  // dance and then three asleep, so that it is still on when you come back)
  let won = false;
  let dancer = null;
  for (let tries = 0; tries < 3 && !won && (await st()).energy > 2; tries++) {
    let sale2 = null;
    for (let i = 0; i < 4 && !(sale2 = await saleCard('disco-coma', named)); i++) {
      const safe = (await vw()).options.find(x => x.sure) ?? (await vw()).options.find(x => x.available);
      await key(await ev(`${H}.keyFor(${JSON.stringify(safe.key)})`));
      await key('Enter');
      await settle();
    }
    if (!sale2) throw new Error('no selling job at the market in four hours');
    const card2 = await seenOn(sale2.slot);
    const made2 = sale2.o.goodsHere.find(g => g.good === 'disco-coma').made.text;
    check(`the crowd's card, its bag changed by a click to ${named} (${card2})`, card2.includes(`Sell ${named} in the crowd`) && card2.includes(made2.replace(/^[^:]*:\s*/, '')));
    if (!tries) await shot('sale-card-crowd');
    const b5 = await st();
    const buyer = sale2.o.who;
    // (the city's own walkers within 30 m of the player: thinned round him on the street, kept at their number while
    // a dance near him gathers its strangers)
    const walkersNear = () => ev(`(D => { const P = D.stage.actors.get('a1'); return P ? D.city.peds.sim.walkers.filter(w => !w.gone && !w.hide && !w.hk2 && w.p && Math.hypot(w.p[0] - P.x, w.p[2] - P.z) <= 30).length : null; })(window.__demo)`);
    const near0 = await walkersNear();
    await filmStart('market-dance');
    const mlog0 = (await underState()).log.length;
    await key('Enter');
    await settle();
    const v5 = await vw();
    const ev5 = await ev(`${H}.news.card`);
    const sold = (b5.goods['disco-coma'] ?? 0) - ((await st()).goods['disco-coma'] ?? 0) === 1;
    won = ev5?.tone === 'win';
    dancer = v5.under.find(x => x.now.some(r => r.effect === 'dancing') && x.place === 'market');
    check(`a bag of ${named} gone from you (${ev5?.head}); ${won ? `the buyer is dancing (${dancer?.text})` : 'it went wrong: nobody dosed, as the rules say'}`, sold && (won ? !!dancer : !dancer));
    if (!won) {
      await filmStop(false);
      // (nobody dosed: no look on the buyer)
      check(`it went wrong: no look on ${buyer?.name}`, !(await bodyOf(buyer?.id)));
      continue;
    }
    check(`the market shows it (${await text('.u-where-under')})`, /dancing 1/.test((await text('.u-where-under')) ?? ''));
    // THE BODY: dancing in rainbow where the sale ended, and strangers near catching it until there are ten, walking
    // over (the crowd round the player is thinned on the street: they are found further out)
    const id = dancer.who.id;
    let body = null;
    const crowdSeen = [];
    const nearSeen = [];
    // (THE MINUTE, by the wall's clock from the sale's end: the count of dancers round them every 5 s)
    const m0 = Date.now();
    let next = 0;
    while (Date.now() - m0 < 60000) {
      body = await bodyOf(id);
      crowdSeen.push(body?.crowd ?? 0);
      if (Date.now() - m0 >= next) {
        nearSeen.push([Math.round((Date.now() - m0) / 1000), body?.crowd ?? 0, await walkersNear()]);
        next += 5000;
      }
      if (body?.crowd >= 10 && Date.now() - m0 > 4000) break;
      await page.sleep(200);
    }
    report.dance = { seconds: +((Date.now() - m0) / 1000).toFixed(1), most: Math.max(...crowdSeen), walkersNearBefore: near0, minute: nearSeen };
    say(`  the dance over the minute [s, dancers, the city's walkers within 30 m of the player]: ${nearSeen.map(x => `[${x.join(', ')}]`).join(' ')}; ten at ${report.dance.most >= 10 ? `${report.dance.seconds} s` : 'never'}; walkers within 30 m before the sale ${near0}`);
    const mlog = (await underState()).log.slice(mlog0).filter(e => e.id === id);
    await page.sleep(3000);
    await filmStop();
    check(`THE BODY: ${dancer.who.name ?? id} dances in rainbow where the sale ended (${body?.look}, the skin ${body?.skin ? 'on' : 'off'}; the stage: ${mlog.map(e => `${e.what}${e.n !== undefined ? ` ${e.n}` : ''}`).join(', ')})`, body?.look === 'disco' && body.skin && mlog[0]?.what === 'on');
    check(`strangers near catch it until there are ten inside the minute (the dancers round them: ${[...new Set(crowdSeen)].join(' → ')})`, Math.max(...crowdSeen) >= 10);
    // (what the looks cost a frame with all of them on: the looks' own frame hook, ms)
    const ls = await ev('window.__demo.stage.looks.stats()');
    report.danceCost = ls;
    say(`  the looks with the dancer and her ${body?.crowd} strangers on: the frame hook ${ls.ms} ms now, at most ${ls.msMax} ms; ${ls.strangers} strangers, ${ls.people} people under a look`);
    await shot('sold-crowd');
  }
  // ── 4b. (pot-3) AWAY TO ANOTHER PART OF THE CITY AND BACK by the subway (the place unloaded and
  // loaded again). The dance has turned to sleep meanwhile: FOUND asleep, nobody seen to go down; and the strangers
  // who danced are gone with the place ──
  if (won && dancer) {
    const id = dancer.who.id;
    // (wherever the subway goes from here, another part of the city; the trailer park lands you at your crib: out again)
    const goes = (await vw()).choices.filter(c => c.choice.do === 'subway' && !c.choice.hop && c.available).map(c => c.choice.to);
    const away = ['docks', 'plaza', 'corner', 'park'].find(t => goes.includes(t));
    say(`4b. away to ${away} and back`);
    if (!away) throw new Error(`no subway from the market (${goes.join(', ')})`);
    await subway(away);
    await settle(1200);
    if ((await st()).place === 'crib') {
      await key('1');
      await key('Enter');
      await settle(1200);
    }
    check(`away from the market (${(await st()).place}, ${(await st()).hour}:00); ${dancer.who.name} meanwhile: ${(await vw()).under.find(x => x.who.id === id)?.text}`, (await st()).place !== 'market');
    await filmStart('market-found');
    const flog0 = (await underState()).log.length;
    await subway('market');
    await settle(1500);
    const fb = await bodyOf(id);
    const fv = (await vw()).under.find(x => x.who.id === id);
    const flog = (await underState()).log.slice(flog0).filter(e => e.id === id);
    await page.sleep(2500);
    await filmStop();
    const sleeping = fv?.now.some(r => r.effect === 'asleep');
    check(`back at the market at ${(await st()).hour}:00: ${dancer.who.name} is ${sleeping ? 'asleep' : 'dancing'} by the rules (${fv?.text}), and FOUND so on stage, not seen to start (${fb?.look}, ${fb?.t} s into it, lying ${fb?.lying}; the stage: ${flog.map(e => e.what).join(', ')})`,
      (await st()).place === 'market' && !!fb && fb.look === (sleeping ? 'zonk' : 'disco') && (sleeping ? fb.lying : true) && fb.t >= 3 && flog.some(e => e.what === 'found'));
    await shot('found-at-market');
  }
  check('a bag sold at the market went through', won);
  // (a sleeper woke while you were elsewhere: a notice. pot-3: here he woke in your sight, at the trailer park)
  const wokeAway = notices.filter(t => /woke up|stopped dancing/.test(t));
  check(`a notice for whoever came round while you were elsewhere (${wokeAway.join(' | ') || 'none'}), and none for ${dee.name}, who woke in your sight`, !wokeAway.some(t => t.includes(dee.name)));
  // WORTH, on your numbers now the Sixes have seen you sell on their ground: its two new rows
  if (await boxOf('.u-stat.is-worth')) {
    await click('.u-stat.is-worth', 'WORTH');
    const worth = await text('.rn-worth-rows');
    const rowsW = (await vw()).worth.entries.map(e => e.id);
    check(`WORTH counts what you make and what you cook with (${worth})`, rowsW.includes('made') && rowsW.includes('makings') && /cook with/i.test(worth ?? ''));
    await shot('worth-rows');
    await key('Escape');
  } else check(`WORTH is not on your numbers yet (the Sixes at ${(await vw()).sixes?.value ?? 0}): its rows are the rules' (${(await vw()).worth.entries.map(e => e.id).join(', ')})`, (await vw()).worth.entries.some(e => e.id === 'made'));

  // ── 5. THE SMALLEST SIZE ──
  say('5. 1280 × 720');
  if (W !== 1280) await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await page.sleep(2500);
  await shot('1280-market');
  const fits = await ev(`[...document.querySelectorAll('.rn-card .u-verb-t small, .rn-card .u-verb-t b, .rn-card .u-card-t')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent)`);
  check(`1280: no verb or card word cut on the dock${fits.length ? ` (${fits.join(' | ')})` : ''}`, !fits.length);
  await key('P');
  await page.sleep(700);
  await shot('1280-pot-away');
  const potFit = await ev(`(s => s ? s.scrollHeight <= s.clientHeight + 1 : false)(document.querySelector('.rn-sheet[data-sheet="pot"] .rn-sheet-scroll'))`);
  check('1280: the pot\'s screen whole without scrolling', potFit);
  await key('Escape');
} catch (err) {
  faults.push(String(err?.stack ?? err));
  console.log(`  FAULT: ${err?.stack ?? err}`);
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
} finally {
  // (pot-3: a film still running when something failed is stopped first: its socket and its timer would keep the tool
  // alive after it had said how it went)
  if (cam) {
    clearInterval(cam.poll);
    try {
      cam.ws?.close();
    } catch {
      /* gone */
    }
  }
  const bad = page ? page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]')) : [];
  if (bad.length) faults.push(`${bad.length} page errors: ${[...new Set(bad)].slice(0, 6).join(' | ').slice(0, 1500)}`);
  report.faults = faults;
  writeFileSync(path.join(out, 'run-pot.json'), `${JSON.stringify(report, null, 1)}\n`);
  await browser.close();
  console.log(faults.length ? `pot-fail: ${faults[0].split('\n')[0]}` : 'pot-ok');
  process.exitCode = faults.length ? 1 : 0;
  // (nothing left waiting keeps it alive: an answer the page never gave times out two minutes later)
  setTimeout(() => process.exit(process.exitCode), 200).unref?.();
}
