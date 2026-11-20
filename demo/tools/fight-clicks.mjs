// THE FIGHT PAGE TAKES THE MOUSE: every button of its frame is clicked with a real mouse press (the browser's own
// pointer events, not a script's click()), and the page must do what the button says. The keys were checked by the
// other tools; the mouse was not, and it did nothing. (fight-3: the Doorman, the Long-eye, Earl brought and each of his
// three ways in Build your own, and the fourth level, Jumped, each by a real press; then the keys walk the same list.)
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
  await check('how hard: Jumped', '.fg-dock [data-level="jumped"]', levelOn('jumped'));
  await check('Build your own, opened', '.fg-dock [data-verb="build"]', `!!document.querySelector('.fg-build')`);
  // (fight-3) THE LONG GUNS AND EARL'S WAYS, in the list
  const rowOn = (row, attr = 'aria-pressed') => `document.querySelector('.fg-build [data-row="${row}"]')?.getAttribute('${attr}') === 'true'`;
  await check('build: the Doorman', '.fg-build [data-row="weapon:doorman"]', `${rowOn('weapon:doorman')} && /Doorman/.test(document.querySelector('.fg-dock .u-go')?.textContent ?? '')`);
  await check('build: the Long-eye', '.fg-build [data-row="weapon:longeye"]', `${rowOn('weapon:longeye')} && !(${rowOn('weapon:doorman')})`);
  await check('build: Cousin Earl brought (his ways come up)', '.fg-build [data-row="ally:earl"]', `${rowOn('ally:earl')} && document.querySelectorAll('.fg-build .fg-way').length === 3`);
  for (const [way, word] of [['front', 'out in front'], ['hunt', 'goes hunting'], ['block', 'one at a time']]) {
    await check(`build: Earl ${word}`, `.fg-build [data-row="way:${way}"]`, `${rowOn(`way:${way}`, 'aria-checked')} && document.querySelectorAll('.fg-build .fg-way.is-on').length === 1 && new RegExp(${JSON.stringify(word)}).test(document.querySelector('.fg-dock .u-go')?.textContent ?? '')`);
  }
  await check('build: Earl one at a time again (back to his old way)', '.fg-build [data-row="way:block"]', `!document.querySelector('.fg-build .fg-way.is-on') && !/one at a time/.test(document.querySelector('.fg-dock .u-go')?.textContent ?? '')`);
  // (the keys walk the same list: ↓ to Earl's first way and Enter takes it)
  const keyPress = async (code, key, vk) => {
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, code, key, windowsVirtualKeyCode: vk });
    await page.sleep(160);
  };
  const at = () => ev(`document.querySelector('.fg-build .is-at')?.getAttribute('data-row')`);
  for (let k = 0; k < 20 && (await at()) !== 'way:front'; k++) await keyPress('ArrowDown', 'ArrowDown', 40);
  await keyPress('Enter', 'Enter', 13);
  const keyed = await ev(rowOn('way:front', 'aria-checked'));
  say(`build by keys: ↓ to Earl out in front, Enter: ${keyed ? 'done' : 'NOTHING HAPPENED'}`);
  if (!keyed) fail('the keys did not take Earl\'s way');
  // (anim-1) ONE-ON-ONE, TO LOOK AT: every choice of its two rows by a real press (the pick must SHOW: the owner pressed
  // them and saw nothing change, the panel's repaint not knowing the pick), then Watch it, and Space ends it
  // (join-2: the raid's rows wear the same chip; they are pressed below by their own measure, not the one-on-one's)
  const chipRows = await ev(`[...document.querySelectorAll('.fg-build .fg-duel-chip')].map(e => e.getAttribute('data-row'))`);
  const duelRows = chipRows.filter(r => r.startsWith('duel-'));
  let raidRows = chipRows.filter(r => r.startsWith('raid-'));
  if (duelRows.length !== 10) fail(`the one-on-one shows ${duelRows.length} choices, not its five ways and five opponents`);
  for (const row of [...duelRows].reverse()) {
    const [kind, id] = row.split(':');
    const which = kind === 'duel-arm' ? 'arm' : 'foe';
    await check(`one-on-one: ${row}`, `.fg-build [data-row="${row}"]`, `${rowOn(row, 'aria-checked')} && ${H}.duel.pick.${which} === ${JSON.stringify(id)} && [...document.querySelectorAll('.fg-build .fg-duel-chip.is-on')].filter(e => e.getAttribute('data-row').startsWith(${JSON.stringify(kind + ':')})).length === 1`);
  }
  await check('one-on-one: Watch it', '.fg-build [data-row="duel:go"], [data-row="duel:go"]', `${H}.duel.active === true || ${H}.phase === "duel"`);
  await page.sleep(2500);
  await keyPress('Space', ' ', 32);
  await page.waitFor(`${H}.phase === "pick" && !${H}.duel.active`, 60000);
  say('one-on-one: Space ended it, back to choosing');
  // (join-2) THE RAID ON YOUR HOME, TO LOOK AT: every choice of its rows by a real press (the pick must SHOW, one lit a
  // row; Cousin Earl is a switch), then Watch the raid, and Space ends it
  if (!(await ev(`!!document.querySelector('.fg-build')`))) await click('.fg-dock [data-verb="build"]');
  // (raidfight-3: the raid's rows are folded under their title until it is pressed: pressed, they show)
  const raidOpen = `document.querySelector('.fg-build [data-row="raid:open"]')?.getAttribute('aria-expanded') === 'true'`;
  if (!(await ev(raidOpen))) await check('the raid: its title, pressed, opens its rows', '.fg-build [data-row="raid:open"]', `${raidOpen} && document.querySelectorAll('.fg-build .fg-duel-chip[data-row^="raid-"]').length >= 12`);
  raidRows = await ev(`[...document.querySelectorAll('.fg-build .fg-duel-chip')].map(e => e.getAttribute('data-row')).filter(r => r.startsWith('raid-'))`);
  if (raidRows.length < 12) fail(`the raid shows ${raidRows.length} choices, not who comes, how many, what is in your hands, when, and Earl`);
  for (const row of raidRows) {
    const kind = row.split(':')[0];
    if (row === 'raid-earl') {
      const was = await ev(rowOn(row, 'aria-checked'));
      await check(`the raid: ${row}`, `.fg-build [data-row="${row}"]`, `(${rowOn(row, 'aria-checked')}) === ${!was}`);
      continue;
    }
    await check(`the raid: ${row}`, `.fg-build [data-row="${row}"]`, `${rowOn(row, 'aria-checked')} && [...document.querySelectorAll('.fg-build .fg-duel-chip.is-on')].filter(e => e.getAttribute('data-row').startsWith(${JSON.stringify(kind + ':')})).length === 1`);
  }
  if (raidRows.includes('raid-time:night')) await check('the raid: back to night', '.fg-build [data-row="raid-time:night"]', rowOn('raid-time:night', 'aria-checked'));
  await check('the raid: Watch the raid', '.fg-build [data-row="raid:go"], [data-row="raid:go"]', `${H}.phase === "raid"`);
  await page.sleep(7000);
  await keyPress('Space', ' ', 32);
  await page.waitFor(`${H}.phase === "pick"`, 90000);
  say('the raid: Space ended it, back to choosing');
  if (!(await ev(`!!document.querySelector('.fg-build')`))) await click('.fg-dock [data-verb="build"]');
  await check('Build your own, closed', '.fg-dock [data-verb="build"]', `!document.querySelector('.fg-build')`);
  // (back to the first loadout for the round below: bare hands on Easy)
  await click('.fg-dock .fg-card[data-slot="1"]');
  await click('.fg-dock [data-level="easy"]');
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
