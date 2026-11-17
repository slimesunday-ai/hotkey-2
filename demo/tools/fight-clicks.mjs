// THE FIGHT PAGE TAKES THE MOUSE: every button of its frame is clicked with a real mouse press (the browser's own
// pointer events, not a script's click()), and the page must do what the button says. The keys were checked by the
// other tools; the mouse was not, and it did nothing.
//
// The server must be running: node demo/serve.mjs --port 5485
//   HK2_DEBUG_PORT=5725 node demo/tools/fight-clicks.mjs --port 5485
// Prints one line per button, then `clicks-ok` or `clicks-fail`.

import { launch } from './chrome.mjs';

const opt = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
};
const url = `http://127.0.0.1:${opt('--port', 5485)}/demo/?mode=fight`;
const say = s => console.log(s);
let failed = false;
const fail = s => {
  failed = true;
  say(`  FAIL: ${s}`);
};

const browser = await launch({ width: 1280, height: 800 });
let page = null;
try {
  page = await browser.open(url);
  const H = 'window.__demo.hud';
  const ev = js => page.evaluate(js);
  await page.waitFor(`window.__demo && ${H} && ${H}.phase === "pick"`, 180000);
  await page.sleep(2500);

  /** What is under the middle of the element `sel` matches: itself (or a child of it), or what covers it. */
  const under = sel => ev(`(() => {
    const e = document.querySelector(${JSON.stringify(sel)});
    if (!e) return { missing: true };
    const r = e.getBoundingClientRect();
    const [x, y] = [r.left + r.width / 2, r.top + r.height / 2];
    const top = document.elementFromPoint(x, y);
    const chain = [];
    for (let q = top; q && chain.length < 4; q = q.parentElement) chain.push((q.id ? '#' + q.id : q.tagName.toLowerCase()) + (q.className && q.className.baseVal === undefined ? '.' + String(q.className).trim().split(/\\s+/).join('.') : ''));
    return { x, y, hit: !!top && (top === e || e.contains(top)), top: chain.join(' < '), pe: getComputedStyle(e).pointerEvents };
  })()`);
  /** A real mouse press and release at the middle of `sel`. */
  const click = async (sel, after = 450) => {
    const u = await under(sel);
    if (u.missing) return fail(`${sel}: not on the page`), u;
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await page.send('Input.dispatchMouseEvent', { type, x: u.x, y: u.y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 });
      await page.sleep(40);
    }
    await page.sleep(after);
    return u;
  };
  /** Clicks `sel`, then `test` (an expression, true when the page did it). */
  const check = async (what, sel, test) => {
    const u = await click(sel);
    if (u.missing) return;
    const did = await ev(test);
    say(`${what}: ${did ? 'done' : 'NOTHING HAPPENED'} · under the pointer: ${u.hit ? 'the button' : u.top} · pointer-events ${u.pe}`);
    if (!did) fail(`${what}: the click at ${Math.round(u.x)}, ${Math.round(u.y)} did nothing`);
  };

  // CHOOSING
  const levelOn = id => `document.querySelector('.fg-dock [data-level="${id}"]')?.getAttribute('aria-checked') === 'true'`;
  await check('how hard: Hard', '.fg-dock [data-level="hard"]', levelOn('hard'));
  await check('how hard: Easy', '.fg-dock [data-level="easy"]', levelOn('easy'));
  await check('a loadout card (the fifth)', '.fg-dock .fg-card[data-slot="5"]', `!!document.querySelector('.fg-dock .fg-card[data-slot="5"].is-on')`);
  await check('a loadout card (the first)', '.fg-dock .fg-card[data-slot="1"]', `!!document.querySelector('.fg-dock .fg-card[data-slot="1"].is-on')`);
  await check('Results, opened', '.fg-table .fg-table-x', `!!document.querySelector('.fg-table table.fg-results')`);
  await check('Results, folded', '.fg-table .fg-table-x', `!document.querySelector('.fg-table table.fg-results')`);
  await check('Build your own, opened', '.fg-dock [data-verb="build"]', `!!document.querySelector('.fg-build')`);
  await check('Build your own, closed', '.fg-dock [data-verb="build"]', `!document.querySelector('.fg-build')`);
  await check('the where card, folded', '.fg-where .u-where-fold', `document.querySelector('.fg-where .u-where-fold')?.getAttribute('aria-expanded') === 'false'`);
  await check('the where card, opened', '.fg-where .u-where-fold', `document.querySelector('.fg-where .u-where-fold')?.getAttribute('aria-expanded') === 'true'`);
  // HIDDEN (I, twice): the one button left brings the frame back
  for (let k = 0; k < 2; k++) {
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, code: 'KeyI', key: 'i', windowsVirtualKeyCode: 73 });
    await page.sleep(300);
  }
  await check('hidden: Show the interface', '.fg .u-back', `!!document.querySelector('.fg .u-back[hidden]') || getComputedStyle(document.querySelector('.fg .u-back')).display === 'none'`);
  // THE ROUND, from the main button (bare hands on Easy... a short one); then its card's buttons
  await check('the main button: Fight', '.fg-dock .u-go', `${H}.phase !== "pick"`);
  await ev(`${H}.pause(false, 3)`);
  await page.waitFor(`${H}.phase === "over" && !!document.querySelector('.fg-res:not([hidden]) [data-move="change"]')`, 240000);
  await ev(`${H}.pause(false, 1)`);
  await page.sleep(800);
  await check('the card: Change loadout', '.fg-res [data-move="change"]', `!document.querySelector('.fg-res:not([hidden]) [data-move]')`);

  // KEPT: the page loaded again still shows how the round just fought went (bare hands, Easy)
  const lastOf = `document.querySelector('.fg-dock .fg-card[data-slot="1"] .fg-card-last')?.textContent`;
  const was = await ev(lastOf);
  await page.send('Page.reload');
  await page.sleep(5000);
  await page.waitFor(`window.__demo && ${H} && ${H}.phase === "pick"`, 180000);
  await page.sleep(2000);
  await click('.fg-dock [data-level="easy"]');
  const is = await ev(lastOf);
  say(`the results over a reload: "${was}" → "${is}"`);
  if (!is || /not tried/.test(is) || is !== was) fail('the results were not kept over a reload');

  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  say(`page errors: ${bad.length ? `\n  ${[...new Set(bad)].slice(0, 8).join('\n  ')}` : 'none'}`);
  if (bad.length) failed = true;
} catch (err) {
  failed = true;
  console.error(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n'));
} finally {
  await browser.close();
}
say(failed ? 'clicks-fail' : 'clicks-ok');
process.exit(failed ? 1 : 0);
