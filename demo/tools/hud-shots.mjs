#!/usr/bin/env node
// Screenshots of the HUD at the two sizes it has to work at, over the REAL city (demo/index.html) or, with --stub,
// over the flat stand-in (demo/hud-dev.html). The tool drives the HUD the page mounted (window.__demo.hud, or
// window.hud on the stand-in page) through its own controls, and for every picture taken with the drawers closed it
// prints the measured share of the window left to the game (hud.clear(): the union of every plate, taken out).
//
//   node demo/tools/hud-shots.mjs                 every scene over the real city, into out/hud-shots/
//   node demo/tools/hud-shots.mjs --stub          the same scenes over the stand-in (fast: no city to load)
//   node demo/tools/hud-shots.mjs play held       some of the scenes: play, rob, watch, held
//
// Each scene is one page load (the city's first load can take a minute) and several pictures, each at 1440×900 and
// 1280×720. Starts its own server and browser and stops both by process id. One browser at a time.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { serve, HUD_DEBUG_PORT } from './hud-serve.mjs';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'out', 'hud-shots');
const SIZES = [[1440, 900], [1280, 720]];
const args = process.argv.slice(2);
const stub = args.includes('--stub');
const SCENES = ['play', 'rob', 'watch', 'held'];
const wanted = args.filter(a => SCENES.includes(a));

// What the page gets to drive the HUD with: wait for a state, click, and play on fast with the seat's own bot.
const HELPERS = `
window.__t = {
  hud: () => window.__demo?.hud ?? window.hud,
  sleep: ms => new Promise(r => setTimeout(r, ms)),
  until(test, ms = 90000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const poll = () => {
        let got = false;
        try { got = test(); } catch { got = false; }
        if (got) resolve(got);
        else if (Date.now() - t0 > ms) reject(new Error('timed out waiting for ' + test));
        else setTimeout(poll, 40);
      };
      poll();
    });
  },
  click(selector) {
    const node = document.querySelector(selector);
    if (node) node.click();
    return !!node;
  },
  /** Past the explainer and the first sheet, to the first prompt. */
  async toFirstMove() {
    const hud = this.hud();
    await this.until(() => ['how', 'first-sheet', 'move'].includes(hud.state));
    if (hud.state === 'how') this.click('[data-act="start-game"]');
    await this.until(() => ['first-sheet', 'move'].includes(hud.state));
    if (hud.state === 'first-sheet') this.click('[data-act="day"]');
    await this.until(() => hud.state === 'move');
  },
  /** Play on without waiting, the seat's bot answering, until a prompt where test(view) holds. */
  async runTo(test) {
    const hud = this.hud();
    hud.setInstant(true);
    for (let i = 0; i < 600; i++) {
      await this.until(() => ['how', 'first-sheet', 'night', 'move', 'held', 'end'].includes(hud.state));
      if (hud.state === 'end') throw new Error('the season ended first');
      if (hud.state === 'how') { this.click('[data-act="start-game"]'); await this.sleep(20); continue; }
      if (hud.state === 'first-sheet' || hud.state === 'night') { this.click('[data-act="day"]'); await this.sleep(20); continue; }
      if (test(hud.view, hud)) break;
      const t = hud.view.clock.t;
      if (hud.state === 'held') hud.confirm();
      else hud.auto();
      await this.until(() => hud.state === 'end' || hud.state === 'night' || (hud.view.clock.t !== t && ['move', 'held'].includes(hud.state)));
    }
    hud.setInstant(false);
  },
  closed() {
    const hud = this.hud();
    hud.drawer('left', null);
    hud.drawer('right', null);
  },
};`;

const server = await serve();
const results = [];
let failed = 0;

async function scene(name, query, steps) {
  const browser = await launch({ debugPort: HUD_DEBUG_PORT, width: SIZES[0][0], height: SIZES[0][1] });
  const url = stub ? `${server.url}/demo/hud-dev.html?${query}` : `${server.url}/demo/?${query}`;
  const page = await browser.open(url);
  const size = (w, h) => page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  /** One picture at both sizes. `measure` adds the share of the window no plate covers. */
  const shot = async (label, { measure = false } = {}) => {
    for (const [w, h] of SIZES) {
      await size(w, h);
      await page.sleep(350);
      const clear = measure ? await page.evaluate('window.__t.hud().clear()') : null;
      const file = await page.shot(path.join(OUT, `${stub ? 'stub-' : ''}${label}-${w}x${h}.png`));
      results.push({ label, size: `${w}x${h}`, clear, file });
      console.log(`${file}${clear === null ? '' : `   ${(clear * 100).toFixed(1)}% of the window left to the game`}`);
    }
    await size(...SIZES[0]);
    await page.sleep(150);
  };
  const run = code => page.evaluate(`(async () => { const t = window.__t; const hud = t.hud(); ${code} })()`);
  try {
    // the real page is up when the city has settled and the panels are mounted; the stand-in is up at once
    await page.waitFor(stub ? 'typeof window.hud?.clear === "function"' : 'typeof window.__demo?.hud?.clear === "function" && document.body.classList.contains("up")', 240000, 500);
    await page.evaluate(HELPERS);
    await steps({ shot, run, page });
  } catch (err) {
    failed += 1;
    console.log(`${name}: ${err.message}`);
    await page.shot(path.join(OUT, `${stub ? 'stub-' : ''}${name}-failed.png`)).catch(() => {});
  }
  for (const line of page.logs.filter(l => /^\[(error|exception)\]/.test(l)).slice(0, 6)) console.log(`  ${line.slice(0, 300)}`);
  page.close();
  await browser.close();
}

const scenes = {
  // a dealer's first hours as a first-timer meets them: the explainer, the closed screen with its coach mark, every
  // drawer, and the guide followed for three hours
  async play() {
    await scene('play', 'mode=play&seat=dealer&seed=3', async ({ shot, run, page }) => {
      await run(`await t.until(() => hud.state === 'how');`);
      await shot('first-screen');
      await run(`t.click('[data-act="start-game"]'); await t.until(() => hud.state === 'first-sheet');`);
      await shot('first-sheet');
      await run(`t.click('[data-act="day"]'); await t.until(() => hud.state === 'move'); t.closed(); await t.sleep(400);`);
      await shot('play-closed', { measure: true });
      // the mouse, for real: the panels take it, the game gets it everywhere else, and a click on the game closes a drawer
      await run(`
        const under = sel => { const r = document.querySelector(sel).getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); };
        for (const sel of ['.hk-rail-btn[data-rail="you"]', '.hk-rail-btn[data-rail="moves"]', '.hk-move[data-entry]', '.hk-top [data-act="pause"]', '.hk-mark .hk-more']) {
          if (!under(sel)?.closest(sel)) throw new Error('the mouse cannot reach ' + sel + ': it lands on ' + (under(sel)?.className || under(sel)?.tagName));
        }
        const mid = document.elementFromPoint(innerWidth / 2, innerHeight * 0.45);
        if (mid?.closest('.hk')) throw new Error('the middle of the window belongs to a panel: ' + mid.className);
        hud.drawer('left', 'you'); hud.drawer('right', 'rank'); await t.sleep(100);`);
      const [w, h] = SIZES[0];
      for (const type of ['mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x: Math.round(w / 2), y: Math.round(h * 0.45), button: 'left', clickCount: 1 });
      await run(`await t.sleep(150); const open = hud.drawers; if (open.left || open.right) throw new Error('a click on the game left a drawer open: ' + JSON.stringify(open));`);
      for (const [left, right] of [['you', 'moves'], ['here', 'offers'], ['ahead', 'rank'], ['plate', 'log'], [null, 'game']]) {
        await run(`hud.drawer('left', ${JSON.stringify(left)}); hud.drawer('right', ${JSON.stringify(right)}); await t.sleep(150);`);
        await shot(`drawers-${left ?? 'none'}-${right}`);
      }
      // the guide, followed: click what the mark points at, then Enter, hour after hour
      for (const hour of [1, 2, 3]) {
        await run(`t.closed(); hud.setSpeed(4); await t.until(() => hud.state === 'move' && document.querySelector('.hk-mark.is-on')); await t.sleep(300);`);
        await shot(`mark-hour-${hour}`, { measure: true });
        await run(`
          // an offer first when the mark says so: its rail button, then its yes
          for (let i = 0; i < 3 && !document.querySelector('.hk-move.is-on'); i++) {
            const offers = document.querySelector('.hk-rail-btn[data-rail="offers"]');
            const yes = document.querySelector('.hk-offer.is-hint .hk-yes');
            const move = document.querySelector('.hk-move.is-hint') ?? document.querySelector('.hk-move[data-entry]');
            if (yes) yes.click();
            else if (/Offers/.test(document.querySelector('.hk-mark')?.textContent ?? '') && offers) offers.click();
            else move.click();
            await t.sleep(120);
          }
          await t.sleep(200);`);
        if (hour === 1) await shot('mark-then-enter');
        await run(`const at = hud.view.clock.t; hud.confirm(); await t.until(() => hud.state === 'night' || (hud.state === 'move' || hud.state === 'held') && hud.view.clock.t !== at, 120000);`);
      }
    });
  },
  // a robber: a contested move picked on the card, its roll landing with the two people in view, and a speech bubble
  async rob() {
    await scene('rob', 'mode=play&seat=robber&seed=3', async ({ shot, run }) => {
      await run(`await t.runTo(v => v.clock.t === 1 && v.menu.some(m => m.verb === 'attack')); t.closed();
        const rob = hud.card.find(r => r.entry.verb === 'attack') ?? hud.groups.flatMap(g => [...g.shown, ...g.more]).find(r => r.entry.verb === 'attack');
        hud.select(rob.entry.id); await t.sleep(400);`);
      await shot('contested-move', { measure: true });
      await run(`hud.setSpeed(1); hud.confirm(); await t.until(() => document.querySelector('.hk-roll.is-landed'), 60000); hud.pause(true); await t.sleep(200);`);
      await shot('roll', { measure: true });
      await run(`hud.pause(false);
        // on with the bot until somebody on the block says something out loud
        for (let i = 0; i < 40 && !document.querySelector('.hk-bubble.is-on'); i++) {
          if (hud.state === 'move' && !document.querySelector('.hk-bubble.is-on')) hud.auto();
          else if (hud.state === 'held') hud.confirm();
          else if (hud.state === 'night') t.click('[data-act="day"]');
          await t.until(() => document.querySelector('.hk-bubble.is-on') || ['move', 'held', 'night'].includes(hud.state), 60000);
          await t.sleep(60);
        }
        await t.until(() => document.querySelector('.hk-bubble.is-on'), 20000); hud.pause(true); await t.sleep(250);`);
      await shot('bubble', { measure: true });
    });
  },
  // watching: the closed screen while an hour plays, then following someone
  async watch() {
    await scene('watch', 'mode=watch&seed=3', async ({ shot, run }) => {
      await run(`await t.until(() => hud.state === 'playing' && hud.session.game.state.t >= 1, 120000); await t.sleep(2500); hud.pause(true); t.closed(); await t.sleep(300);`);
      await shot('watch-closed', { measure: true });
      await run(`hud.pick(hud.session.game.state.order[3]); hud.drawer('right', 'rank'); await t.sleep(300);`);
      await shot('watch-following');
    });
  },
  // a cook's first hour in the clinic: the countdown on the card
  async held() {
    await scene('held', 'mode=play&seat=cook&seed=5', async ({ shot, run }) => {
      await run(`await t.runTo(v => v.menu.length === 0); hud.pause(true); t.closed(); await t.sleep(400);`);
      await shot('held', { measure: true });
    });
  },
};

try {
  for (const name of wanted.length ? wanted : SCENES) await scenes[name]();
  writeFileSync(path.join(OUT, `${stub ? 'stub-' : ''}clear.json`), JSON.stringify(results.filter(r => r.clear !== null).map(({ label, size, clear }) => ({ label, size, clear: +clear.toFixed(4) })), null, 2));
} finally {
  server.stop();
}
process.exit(failed ? 1 : 0);
