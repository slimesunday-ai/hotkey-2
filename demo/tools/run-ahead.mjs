#!/usr/bin/env node
// WHAT'S AHEAD, PLAYED IN THE PAGE AND CHECKED (tree-1; demo/run/ahead.js, src/run/ahead.mjs). The server must be
// running: node demo/serve.mjs --port 5494 --quiet
//
//   HK2_DEBUG_PORT=5747 node demo/tools/run-ahead.mjs --port 5494 --out <dir>
//
// In the page (/demo/?mode=run), with REAL mouse presses (DevTools Input.dispatchMouseEvent) and REAL key presses
// (Input.dispatchKeyEvent), nothing of the page's own called to act:
//   1. a new run at 1600 × 1000: the panel opened by its button on the rail, closed with Escape, opened again by its key
//      (U); no card before anything is picked; every node's words are its name and nothing else; every name whole (its
//      text as wide as its box at most) and all five trees in sight without scrolling (pot-2: Make the fifth);
//   2. a node of each branch pressed (the throw, the real bed, the door bar, Low Tide Docks): its card comes up and is
//      checked against the config (name, price, who and where, its numbers; the throw's table of fights against the
//      rules' own sample, once every number is in), whole without scrolling inside; its × puts it away and a press
//      brings it back; Escape puts it away before it closes the panel;
//   3. the door bar's link into the Library pressed (its card there is the door bar's), Escape back to Ahead; the
//      docks' link to the Map pressed (the map's card is the docks'), and the panel's Back pressed to come back;
//   4. a game set up at the trailer park with $90 on you (the page's own load, as every picture tool does): the
//      haymaker's node pressed, its Learn pressed, the rules' learn made, and the node flips to yours;
//   5. Escape closes the panel; then at 1280 × 720 (the smallest the page supports), a new run and one in the middle of
//      the game: names whole and all five trees in sight again, and a card up.
// A picture of every step into --out. Fails on any page error. Prints `ahead-ok` or `ahead-fail: <why>`.
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, newRun, view } from '../../src/run/index.mjs';
import { aheadOf, aheadCell, aheadCells } from '../../src/run/ahead.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-ahead'));
const port = opt('--port', 5470);
const [width, height] = [1600, 1000];
const SEED = 3;
const base = `http://127.0.0.1:${port}/demo/?mode=run&seed=${SEED}&speed=4`;
mkdirSync(out, { recursive: true });

// ── HEADLESS: what each card must say, from the config and the rules ────────────────────────────────────────────────
const fresh = newRun({ seed: SEED, cfg });
const A0 = view(cfg, fresh).ahead;
const money = n => `$${n}`;
const throwOdds = Object.fromEntries(aheadCells(cfg, fresh).filter(c => c.arm === 'throw' || c.arm === 'hands').map(c => [c.style, null]));
for (const style of Object.keys(throwOdds)) throwOdds[style] = { hands: Math.round(aheadCell(cfg, fresh, 'hands', style) / 10), throw: Math.round(aheadCell(cfg, fresh, 'throw', style) / 10) };
const haines = cfg.places.docks.people.find(p => p.id === cfg.styles.throw.keeper);
const okafor = cfg.places.market.people.find(p => p.id === cfg.things.floorsafe.keeper);
const EXPECT = {
  'style:throw': [cfg.styles.throw.label.replace(/^the /, 'The '), money(cfg.styles.throw.price), haines.name, cfg.places.docks.where, cfg.styles.throw.does.slice(0, 40)],
  'shop:bed': [money(cfg.shop.bed.price), `energy ${cfg.energy.bed} a day, not ${cfg.energy.mattress}`, 'At your crib, from banked money'],
  'thing:doorbar': ['Door bar', money(cfg.things.doorbar.price), `−${cfg.things.doorbar.defends.bar} health`, haines.name, cfg.places.docks.where, cfg.things.doorbar.job.slice(0, 40)],
  'place:docks': [cfg.places.docks.label, `pays ${cfg.tiers.mean.pay / cfg.tiers.quiet.pay}× your street`, ...Object.values(cfg.places.docks.jobs).map(j => j.label), `${money(cfg.subway.fare)}`],
};
// the rigged game: at the trailer park with $90 on you, the haymaker taught here by Cousin Earl
const park = { ...fresh, place: 'park', energy: 5, carried: 90, banked: 0, books: { ...fresh.books, earned: 70 } };
const parkTree = aheadOf(cfg, park, view(cfg, park).choices);
// a game in the middle: at the market on day 5, two styles and things owned, Teo against you, Earl on the step
const mid = { ...fresh, day: 5, hour: 14, place: 'market', energy: 5, carried: 130, banked: 95, owned: { pocket: true, cutter: true, bed: false }, styles: { jab: true }, fightWith: 'jab',
  things: { deadbolt: true, dogsign: true }, goods: { smokes: 3 }, trust: { 'npc:connect:market': -3 }, home: { ...fresh.home, guard: { on: true, until: 6 } }, books: { ...fresh.books, earned: 405 } };
if (!parkTree.nodes['style:haymaker'].choice?.available) throw new Error('the rigged game: the haymaker is not to be learned at the park');

// ── THE PAGE ──────────────────────────────────────────────────────────────────────────────────────────────────────
const faults = [];
const fail = why => {
  faults.push(why);
  console.log(`  FAULT: ${why}`);
};
const KEYS = { Enter: ['Enter', 13], Escape: ['Escape', 27] };
const browser = await launch({ width, height });
let page = null;
const report = { seed: SEED, size: `${width}x${height}`, steps: [], pictures: [], presses: [] };
try {
  page = await browser.open(base);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending', 180000);
  await page.sleep(1500);
  async function key(k) {
    const [code, vk] = KEYS[k] ?? [`Key${k.toUpperCase()}`, k.toUpperCase().charCodeAt(0)];
    const keyName = k.length === 1 ? k.toLowerCase() : k;
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && k.length === 1 ? { text: keyName } : {}) });
    report.presses.push(`key ${k}`);
    await page.sleep(450);
  }
  async function click(x, y, what) {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    report.presses.push(what);
  }
  const boxOf = sel => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => !x.closest('[hidden]') && x.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, bottom: r.bottom }; })()`);
  /** Presses what `sel` finds, in sight: the point it is pressed at must be it (nothing over it). */
  async function press(sel, what) {
    const b = await boxOf(sel);
    if (!b) throw new Error(`${what}: nothing to press (${sel})`);
    const hit = await ev(`(() => { const e = document.elementFromPoint(${b.x}, ${b.y}); const t = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => !x.closest('[hidden]') && x.getBoundingClientRect().width > 0); return !!e && !!t && (e === t || t.contains(e)); })()`);
    if (!hit) throw new Error(`${what}: something lies over it (${sel})`);
    await click(b.x, b.y, what);
    await page.sleep(500);
  }
  /** Turns the wheel over the panel's trees until `sel` is wholly in sight between their top and the card. */
  async function reveal(sel, what) {
    for (let n = 0; n < 14; n++) {
      const s = await ev(`(() => { const sc = document.querySelector('.rn-sheet[data-sheet="ahead"] .rn-sheet-scroll'); const t = document.querySelector(${JSON.stringify(sel)}); if (!sc || !t) return null; const a = sc.getBoundingClientRect(); const r = t.getBoundingClientRect(); const head = t.closest('.u-ah-branch')?.querySelector('.u-ah-bhead')?.getBoundingClientRect().height ?? 0; return { inside: r.top >= a.top + head + 2 && r.bottom <= a.bottom - 2, dy: r.top < a.top + head + 2 ? r.top - a.top - head - 20 : r.bottom - a.bottom + 20, x: a.left + a.width / 2, y: a.top + a.height / 2 }; })()`);
      if (!s) throw new Error(`${what}: not in the panel (${sel})`);
      if (s.inside) return;
      await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: s.x, y: s.y, deltaX: 0, deltaY: Math.round(s.dy) });
      report.presses.push(`wheel ${Math.round(s.dy)} for ${what}`);
      await page.sleep(250);
    }
    throw new Error(`${what}: the wheel never brought it into sight`);
  }
  async function shot(name) {
    const f = await page.shot(path.join(out, `${name}.jpg`));
    report.pictures.push(f);
    console.log(`  saved ${f}`);
  }
  const sheet = () => ev('(() => { const s = document.querySelector(".rn-sheet"); return s && !s.hidden ? s.dataset.sheet : null; })()');
  const textOf = sel => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => !x.closest('[hidden]')); return b ? b.innerText.replace(/\\s+/g, ' ').trim() : null; })()`);
  const step = (name, ok, extra = {}) => {
    report.steps.push({ name, ok, ...extra });
    console.log(`  ${ok ? 'ok' : 'NO'}: ${name}`);
    if (!ok) fail(name);
  };

  const cardUp = () => ev('(c => !!c && !c.hidden && c.getBoundingClientRect().height > 0)(document.querySelector(".u-ah-card"))');
  /** Every node's words its name alone, every name whole in its box, and the five trees in sight without scrolling. */
  async function fits(name) {
    const r = await ev(`(() => {
      const A = window.__demo.hud.ahead.data;
      const sc = document.querySelector('.rn-sheet[data-sheet="ahead"] .rn-sheet-scroll');
      const S = sc.getBoundingClientRect();
      const nodes = [...document.querySelectorAll('.u-ah-node')].map(b => {
        const nm = b.querySelector('.u-ah-name');
        const n = nm.getBoundingClientRect(), r = b.getBoundingClientRect();
        return { id: b.dataset.node, text: b.innerText.trim(), name: A.nodes[b.dataset.node]?.name, cut: nm.scrollWidth > nm.clientWidth + 1 || nm.scrollHeight > nm.clientHeight + 1 || n.right > r.right + 0.5 || n.bottom > r.bottom + 0.5,
          seen: r.top >= S.top - 0.5 && r.bottom <= S.bottom + 0.5 && r.left >= S.left - 0.5 && r.right <= S.right + 0.5, w: Math.round(nm.scrollWidth), box: Math.round(nm.clientWidth) };
      });
      return { nodes, scrolls: sc.scrollHeight > sc.clientHeight + 1, sh: sc.scrollHeight, ch: sc.clientHeight };
    })()`);
    const words = r.nodes.filter(n => n.text !== n.name);
    const cut = r.nodes.filter(n => n.cut);
    const unseen = r.nodes.filter(n => !n.seen);
    step(`${name}: every node's words are its name only (${r.nodes.length} nodes${words.length ? `; not: ${words.map(n => JSON.stringify(n.text)).join(', ')}` : ''})`, r.nodes.length > 0 && !words.length);
    step(`${name}: no name cut off${cut.length ? ` (${cut.map(n => `${n.name} ${n.w}px in ${n.box}px`).join(', ')})` : ''}`, !cut.length);
    step(`${name}: all five trees in sight without scrolling (${r.sh}px of trees in ${r.ch}px${unseen.length ? `; out of sight: ${unseen.map(n => n.name).join(', ')}` : ''})`, !r.scrolls && !unseen.length);
  }

  // 1. OPENED BY ITS BUTTON, CLOSED WITH ESCAPE, OPENED BY ITS KEY
  console.log('1. the panel: its button, Escape, its key');
  await press('.rn-key[data-sheet="ahead"]', 'the rail: Ahead');
  await page.sleep(700);
  step('the button opens it', (await sheet()) === 'ahead');
  await shot('1-open-by-button');
  await key('Escape');
  step('Escape closes it', (await sheet()) === null);
  await key('U');
  await page.sleep(700);
  step('U opens it', (await sheet()) === 'ahead');
  const lead = await textOf('.u-ah-lead');
  step(`the lead says the money and the next thing (${lead})`, lead.includes(`$${A0.have} to spend`) && lead.includes(A0.nodes[A0.next.id].name));
  const counts = await ev('[...document.querySelectorAll(".u-ah-branch")].map(b => [b.dataset.branch, b.querySelectorAll(".u-ah-node").length])');
  // (pot-2: the rules' four trees and the page's fifth, Make, from the rules' view of the pot: the hot plate moved to it
  // from Gear; every other node of the rules' tree where the rules put it)
  const pageTree = await ev('window.__demo.hud.ahead.data.branches.map(b => [b.id, b.groups.flatMap(g => g.nodes).length])');
  const rulesIds = A0.branches.flatMap(b => b.groups.flatMap(g => g.nodes));
  const drawn = await ev('[...document.querySelectorAll(".u-ah-node")].map(b => b.dataset.node)');
  step(`five branches, Make the fifth, every node of the rules' tree drawn (${JSON.stringify(counts)})`, JSON.stringify(counts) === JSON.stringify(pageTree) && counts.map(c => c[0]).join() === 'fight,gear,home,places,make' && rulesIds.every(id => drawn.includes(id)));
  step('no card before anything is picked', !(await cardUp()));
  await fits('1600x1000, a new run');
  // (the fight's numbers come in a few at a time while the panel is open)
  await page.waitFor('window.__demo.hud.ahead.oddsLeft === 0', 90000, 250);
  await page.sleep(600);
  await shot('1-open-by-key-fresh');

  // 2. A NODE OF EACH BRANCH, ITS CARD AGAINST THE CONFIG
  console.log('2. a node of each branch');
  for (const id of ['style:throw', 'shop:bed', 'thing:doorbar', 'place:docks']) {
    const sel = `.u-ah-node[data-node="${id}"]`;
    await reveal(sel, id);
    await press(sel, `node ${id}`);
    const picked = await ev('window.__demo.hud.ahead.selected');
    step(`${id}: its card is up`, await cardUp());
    const whole = await ev('(c => ({ sh: c.scrollHeight, ch: c.clientHeight }))(document.querySelector(".u-ah-card"))');
    step(`${id}: its card is whole, nothing to scroll inside it (${whole.sh}px in ${whole.ch}px)`, whole.sh <= whole.ch + 1);
    const card = await textOf('.u-ah-card');
    const missing = EXPECT[id].filter(w => !card.includes(w));
    step(`${id}: pressed, its card says ${EXPECT[id].length} things of the config${missing.length ? ` (missing: ${missing.join(' | ')})` : ''}`, picked === id && !missing.length, { card });
    if (id === 'style:throw') {
      const rows = await ev('[...document.querySelectorAll(".u-ah-vs tbody tr")].map(r => [...r.querySelectorAll("td")].map(td => td.innerText.trim()))');
      const want = Object.keys(throwOdds).map(st => [throwOdds[st].hands, throwOdds[st].throw]);
      const got = rows.map(r => [Number(r[1].split(' ')[0]), Number(r[2].split(' ')[0])]);
      step(`the throw's fights against the rules' own sample (${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want), { want, got });
    }
    await shot(`2-card-${id.replace(':', '-')}`);
    // (the card lies over part of the trees: put away with its ×, as a player would, before the next)
    await press('.u-ah-card [data-close]', 'the card: ×');
  }
  await press('.u-ah-node[data-node="place:docks"]', 'node place:docks');
  // its × puts the card away; a press brings it back; Escape puts it away first, the panel stays
  await press('.u-ah-card [data-close]', 'the card: ×');
  step('the × puts the card away', !(await cardUp()) && (await sheet()) === 'ahead');
  await press('.u-ah-node[data-node="place:docks"]', 'node place:docks again');
  step('pressed again, the card comes back', await cardUp());
  await key('Escape');
  step('Escape puts the card away and the panel stays', !(await cardUp()) && (await sheet()) === 'ahead');

  // 3. INTO THE LIBRARY AND BACK; ONTO THE MAP AND BACK
  console.log('3. the links');
  await reveal('.u-ah-node[data-node="thing:doorbar"]', 'the door bar');
  await press('.u-ah-node[data-node="thing:doorbar"]', 'node thing:doorbar');
  await press('.u-ah-card [data-link="library"]', 'the door bar: In the Library');
  await page.sleep(900);
  const lib = await ev('window.__demo.hud.library.onCard');
  const libCard = await textOf('.u-lib-card');
  step(`the Library opens on the door bar (${lib}: ${libCard?.slice(0, 60)})`, (await sheet()) === 'library' && lib === 'doorbar' && /Door bar/i.test(libCard ?? ''));
  await shot('3-library-door-bar');
  await key('Escape');
  await page.sleep(500);
  step('Escape comes back to Ahead, on the door bar', (await sheet()) === 'ahead' && (await ev('window.__demo.hud.ahead.selected')) === 'thing:doorbar');
  await reveal('.u-ah-node[data-node="place:docks"]', 'the docks');
  await press('.u-ah-node[data-node="place:docks"]', 'node place:docks');
  await press('.u-ah-card [data-link="map"]', 'the docks: On the map');
  await page.waitFor('window.__demo.hud.map.ready', 60000, 200);
  await page.sleep(1500);
  const mapCard = await textOf('.rn-stopcard');
  step(`the Map opens on the docks' card (${mapCard?.slice(0, 60)})`, (await sheet()) === 'map' && (await ev('window.__demo.hud.map.cardId')) === 'docks' && /Low Tide Docks/.test(mapCard ?? ''));
  await shot('3-map-docks');
  await press('.rn-sheet [data-back="ahead"]', 'the map: Back to Ahead');
  await page.sleep(600);
  step('Back comes back to Ahead, on the docks', (await sheet()) === 'ahead' && (await ev('window.__demo.hud.ahead.selected')) === 'place:docks');

  // 4. A RIGGED GAME: LEARNED FROM THE CARD, THE NODE FLIPS TO YOURS
  console.log('4. the haymaker learned from its card');
  await key('Escape');
  await key('Escape');
  if ((await sheet()) !== null) throw new Error('two Escapes did not close the panel');
  const loaded = await ev(`window.__demo.hud.load(${JSON.stringify(park)})`, 60000);
  if (!loaded) throw new Error('the page would not load the rigged game');
  await page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending', 60000, 100);
  await page.sleep(1800);
  await key('U');
  await page.sleep(700);
  const hay = '.u-ah-node[data-node="style:haymaker"]';
  await reveal(hay, 'the haymaker');
  const before = await ev(`document.querySelector('${hay}').className`);
  step(`the haymaker is here now before (${before})`, /is-now/.test(before) && /is-here/.test(before));
  await press(hay, 'node style:haymaker');
  await shot('4-haymaker-before');
  await press('.u-ah-card [data-act="learn"]', 'the haymaker: Learn it');
  await page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending && !window.__demo.hud.duel.active', 90000, 100);
  await page.sleep(1500);
  const st = await ev('window.__demo.hud.state');
  const after = await ev(`(e => e && e.className)(document.querySelector('${hay}'))`);
  step(`learned: the rules have it (${JSON.stringify(st.styles)}, $${st.carried} on you) and the node is yours (${after})`, !!st.styles?.haymaker && st.carried === park.carried - cfg.styles.haymaker.price && /is-owned/.test(after ?? ''));
  await reveal(hay, 'the haymaker');
  await shot('4-haymaker-after');

  await fits('1600x1000, the haymaker learned');

  // 5. ESCAPE CLOSES (the card first, then the panel)
  await key('Escape');
  await key('Escape');
  step('Escape closes it', (await sheet()) === null);
  await shot('5-closed');

  // 6. THE SMALLEST SIZE: a new run and one in the middle of the game
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await page.sleep(2500);
  for (const [name, st] of [['a new run', fresh], ['the middle of the game', mid]]) {
    const ok = await ev(`window.__demo.hud.load(${JSON.stringify(st)})`, 60000);
    if (!ok) throw new Error(`1280x720: the page would not load ${name}`);
    await page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending', 60000, 100);
    await page.sleep(1800);
    await key('U');
    await page.sleep(900);
    await fits(`1280x720, ${name}`);
    await shot(`6-1280-${name.replace(/ /g, '-')}`);
    await press(`.u-ah-node[data-node="${name === 'a new run' ? 'style:throw' : 'thing:floorsafe'}"]`, `1280x720: a node`);
    step(`1280x720, ${name}: its card comes up`, await cardUp());
    await shot(`6-1280-${name.replace(/ /g, '-')}-card`);
    await key('Escape');
    await key('Escape');
  }
} catch (err) {
  fail(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
} finally {
  const bad = page ? page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]')) : [];
  if (bad.length) fail(`${bad.length} page errors: ${[...new Set(bad)].slice(0, 6).join(' | ').slice(0, 1500)}`);
  report.faults = faults;
  writeFileSync(path.join(out, 'run-ahead.json'), `${JSON.stringify(report, null, 1)}\n`);
  await browser.close();
  console.log(faults.length ? `ahead-fail: ${faults[0]}` : 'ahead-ok');
  process.exitCode = faults.length ? 1 : 0;
}
