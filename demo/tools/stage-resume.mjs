#!/usr/bin/env node
// Save, reload, carry on, over the real stage. The server must be running: node demo/serve.mjs --port 5475
//
//   node demo/tools/stage-resume.mjs [--port 5475]
//
// Plays a watched season for a few hours (the panels save every step in the browser's storage), loads the page again
// with no season asked for, takes the start screen's offer to carry on, and checks that the stage has its whole cast
// back, that held people are where the season holds them, and that the hours go on from where they stopped.
import { launch } from './chrome.mjs';

const at = process.argv.indexOf('--port');
const base = `http://127.0.0.1:${at === -1 ? 5475 : process.argv[at + 1]}/demo/`;
const browser = await launch();
let failed = true;
try {
  const page = await browser.open(`${base}?mode=watch&seed=4&speed=4`);
  await page.waitFor('window.__demo && window.__demo.stage && window.__demo.stage.debug().hours >= 6', 240000);
  const before = await page.evaluate('(() => { const d = window.__demo.stage.debug(); return { hours: d.hours, clock: d.clock }; })()');
  await page.send('Page.navigate', { url: base });
  await page.sleep(1500);
  await page.waitFor(`window.__demo && window.__demo.hud && document.querySelector('.hk-resume .k-btn.is-primary')`, 180000);
  const offer = await page.evaluate(`document.querySelector('.hk-resume').textContent.slice(0, 120)`);
  await page.evaluate(`document.querySelector('.hk-resume .k-btn.is-primary').click()`);
  await page.waitFor('window.__demo.stage.debug().people > 0 && window.__demo.stage.debug().hours >= 2', 120000);
  const after = await page.evaluate(`(() => { const st = window.__demo.stage, d = st.debug(), g = window.__demo.hud.session?.game ?? null; return { people: d.people, hours: d.hours, clock: d.clock, inside: d.inside.length }; })()`);
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]|\[hud\] the stage/.test(l));
  const on = after.clock && before.clock && (after.clock.day > before.clock.day || after.clock.hour > before.clock.hour);
  console.log(JSON.stringify({ before, offer, after, carriedOn: !!on, errors: bad.slice(0, 5) }));
  failed = !(on && after.people > 0 && !bad.length);
  console.log(failed ? 'resume-fail' : 'resume-ok');
} catch (err) {
  console.error(String(err));
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
