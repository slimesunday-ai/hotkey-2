#!/usr/bin/env node
// THE LIBRARY KEEPS THE ARROWS AFTER A SCENE (join-1, part D), in headless Chrome by real keys: a new run, step out
// (an hour plays: the walk out), L while it plays (the Library opens over the scene), and once the game is choosing
// again, → and ↓: the Library's grid must move (the piece on its card changes, the focus is in the grid) and the dock
// must not (the picked thing is the same). Found by hand in real Chrome: the arrows drove the dock until the Library
// was shut and opened again. Ends `library-keys-ok` or `library-keys-fail: <why>`.
// The server must be running: node demo/serve.mjs --port 5485
//
//   HK2_DEBUG_PORT=5723 node demo/tools/run-library-keys.mjs --port 5485 [--out <dir>]
import path from 'node:path';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = opt('--out', null);
const url = `http://127.0.0.1:${opt('--port', 5485)}/demo/?mode=run&seed=3&new=1`;
const browser = await launch({ width: 1280, height: 800 });
let page = null;
const why = [];
try {
  page = await browser.open(url);
  const ev = js => page.evaluate(js);
  const H = 'window.__demo.hud';
  await page.waitFor(`window.__demo && ${H} && ${H}.phase === "choose"`, 240000);
  await page.sleep(1200);
  const CODES = { KeyL: 76, Digit1: 49, Enter: 13, ArrowRight: 39, ArrowDown: 40 };
  const KEY = { Enter: 'Enter', ArrowRight: 'ArrowRight', ArrowDown: 'ArrowDown' };
  const press = async (code, after = 300) => {
    const k = KEY[code] ?? (code.startsWith('Key') ? code.slice(3).toLowerCase() : code.slice(5));
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k, windowsVirtualKeyCode: CODES[code] });
    await page.sleep(50);
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: CODES[code] });
    await page.sleep(after);
  };
  // (an hour that plays: stepping out)
  await press('Digit1');
  await press('Enter', 0);
  await page.waitFor(`${H}.phase === "playing"`, 20000);
  await page.sleep(600);
  // L WHILE IT PLAYS
  await press('KeyL', 500);
  const openWhile = await ev(`(${H}.phase) + '|' + !!document.querySelector('.rn-sheet[data-sheet="library"]:not([hidden])')`);
  console.log(`L pressed while ${openWhile.split('|')[0]}: the Library open ${openWhile.split('|')[1]}`);
  if (!openWhile.startsWith('playing')) why.push(`the scene was over before L (${openWhile})`);
  // THE SCENE ENDS: choosing again, the Library still open
  await page.waitFor(`${H}.phase === "choose" && !!document.querySelector('.rn-sheet[data-sheet="library"]:not([hidden])')`, 120000);
  await page.sleep(1500);
  const state = () => ev(`({ sel: ${H}.sel, card: ${H}.library.onCard, inGrid: ${H}.library.owns(document.activeElement), focus: document.activeElement?.className ?? null, list: document.querySelector('.u-list')?.dataset.list ?? null })`);
  const s0 = await state();
  console.log(`choosing again: picked ${s0.sel} · on the Library's card ${s0.card} · the focus in the grid ${s0.inGrid} (${s0.focus})`);
  if (out) await page.shot(path.join(path.resolve(out), 'library-after-scene.jpg'));
  await press('ArrowRight');
  const s1 = await state();
  console.log(`→: picked ${s1.sel} · on the card ${s1.card} · focus in the grid ${s1.inGrid}`);
  await press('ArrowDown');
  const s2 = await state();
  console.log(`↓: picked ${s2.sel} · on the card ${s2.card} · focus in the grid ${s2.inGrid}`);
  if (s1.card === s0.card) why.push('→ did not move the grid');
  if (s2.card === s1.card) why.push('↓ did not move the grid');
  if (s1.sel !== s0.sel || s2.sel !== s0.sel) why.push(`the dock moved: ${s0.sel} → ${s1.sel} → ${s2.sel}`);
  if (s1.list || s2.list) why.push(`a dock list opened: ${s1.list ?? s2.list}`);
  if (!s1.inGrid || !s2.inGrid) why.push('the focus is not in the grid');
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  if (bad.length) why.push(`${bad.length} page errors: ${[...new Set(bad)].slice(0, 4).join(' | ')}`);
} catch (err) {
  why.push(String(err?.message ?? err));
} finally {
  console.log(why.length ? `library-keys-fail: ${why.join('; ')}` : 'library-keys-ok');
  await browser.close();
}
process.exit(why.length ? 1 : 0);
