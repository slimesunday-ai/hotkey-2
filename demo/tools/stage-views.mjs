#!/usr/bin/env node
// The play camera, looked at everywhere it can be, and the two things a person does to it with the mouse.
// The server must be running: node demo/serve.mjs --port 5475
//
//   node demo/tools/stage-views.mjs [--out demo/shots/views] [--port 5475] [--seat dealer] [--seed 4] [--night]
//
// It starts a played season, gets past the first night sheet so the menu is waiting, then:
//   1. stands the player on each of the set's blocks, in the pen, in the tent and in their own pad, and takes a
//      picture of each from the play camera (view-<place>.jpg);
//   2. watches the camera for four seconds while the menu waits: it must not move;
//   3. clicks another person with a real pointer event: the camera must go to them;
//   4. drags the camera with a real pointer: the stage must leave it alone, until it is asked for the player again.
// Prints what it measured. --night sets the set's clock to 22:00 first.
import path from 'node:path';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/views'));
const url = `http://127.0.0.1:${opt('--port', 5475)}/demo/?mode=play&seat=${opt('--seat', 'dealer')}&seed=${opt('--seed', 4)}`;
const night = process.argv.includes('--night');

const browser = await launch();
let failed = false;
let page = null;
try {
  const t0 = Date.now();
  page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.stage.debug().people > 0', 150000);
  console.log(`the game is up after ${((Date.now() - t0) / 1000).toFixed(1)} s (the city called itself ready at ${(await page.evaluate('window.__demo.readySeconds')).toFixed(1)} s)`);
  // past the first night's sheet, the way a person would: spend the points, start the day
  await page.evaluate(`(() => { for (let k = 0; k < 4; k++) document.querySelector('.hk-skill:not([disabled])')?.click(); document.querySelector('[data-act="day"]')?.click(); })()`);
  await page.sleep(6000);
  const S = () => page.evaluate('window.__demo.stage.debug()', 8000);
  const cam = () => page.evaluate('(() => { const c = window.__city.camera.position; return [c.x, c.y, c.z]; })()');
  const you = (await S()).you;
  if (night) await page.evaluate('window.__demo.stage.setClock({ day: 1, hour: 22 })');

  const blocks = await page.evaluate(`import('/demo/stage/citymap.js').then(m => Object.keys(m.BLOCKS))`);
  for (const place of [...blocks, 'jail', 'clinic', 'pad']) {
    await page.evaluate(`window.__demo.stage.tour(${JSON.stringify(place)})`);
    await page.sleep(3200);
    const file = await page.shot(path.join(out, `view-${place}${night ? '-night' : ''}.jpg`));
    const head = await page.evaluate(`window.__demo.stage.screenOf(${JSON.stringify(you)})`);
    console.log(`saved ${path.relative(process.cwd(), file)} · the player's head at ${Math.round(head.x)}, ${Math.round(head.y)}${head.visible ? '' : ' (off screen)'}`);
  }

  // 2. steady while the menu waits
  await page.evaluate(`window.__demo.stage.tour(${JSON.stringify(blocks[0])})`);
  await page.sleep(3000);
  const a = await cam();
  await page.sleep(4000);
  const b = await cam();
  console.log(`menu waiting, 4 s: the camera moved ${Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]).toFixed(3)} m`);

  // 3. a real click on another person
  const other = await page.evaluate(`(() => { const st = window.__demo.stage, me = ${JSON.stringify(you)}; for (const A of st.actors.all()) { if (A.id === me || !/^a\\d+$/.test(A.id)) continue; const p = st.screenOf(A.id); if (p.visible && document.elementFromPoint(p.x, p.y + 14)?.tagName === 'CANVAS' && st.actors.pickAt(p.x, p.y + 14) === A.id) return { id: A.id, x: p.x, y: p.y + 14 }; } return null; })()`);
  if (!other) console.log('click: nobody else was in the frame to click');
  else {
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await page.send('Input.dispatchMouseEvent', { type, x: other.x, y: other.y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 });
      await page.sleep(60);
    }
    await page.sleep(2500);
    const s = await S();
    console.log(`click on ${other.id}: the camera is ${s.following === other.id ? 'on them' : `NOT on them (following ${s.following}, user ${s.user})`}`);
    await page.shot(path.join(out, 'click-follow.jpg'));
  }

  // 4. a real drag, then nothing for three seconds, then "follow me"
  await page.evaluate(`window.__demo.stage.focus(${JSON.stringify(you)})`);
  await page.sleep(2500);
  const drag = async (x0, y0, x1, y1) => {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0, button: 'none' });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', buttons: 1, clickCount: 1 });
    for (let k = 1; k <= 8; k++) {
      await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + ((x1 - x0) * k) / 8, y: y0 + ((y1 - y0) * k) / 8, button: 'left', buttons: 1 });
      await page.sleep(30);
    }
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', buttons: 0, clickCount: 1 });
  };
  const c0 = await cam();
  // (in the gap the panels leave while a move is being chosen)
  await drag(560, 420, 470, 480);
  await page.sleep(600);
  const c1 = await cam();
  // the player is put on another block, which would bring the camera after them if the stage still had it
  await page.evaluate(`window.__demo.stage.director.settle(${JSON.stringify(you)}, ${JSON.stringify(blocks[3])})`);
  await page.sleep(3000);
  const c2 = await cam();
  const s1 = await S();
  console.log(`drag: the camera moved ${Math.hypot(c0[0] - c1[0], c0[2] - c1[2]).toFixed(1)} m under the mouse · user has it: ${s1.user} · three seconds later it had moved ${Math.hypot(c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]).toFixed(3)} m more`);
  await page.evaluate(`window.__demo.stage.focus(${JSON.stringify(you)})`);
  await page.sleep(2500);
  const s2 = await S();
  const c3 = await cam();
  console.log(`"follow me": user has it: ${s2.user} · the camera went ${Math.hypot(c2[0] - c3[0], c2[2] - c3[2]).toFixed(1)} m back`);

  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]/.test(l));
  if (bad.length) console.log(`page errors:\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}`);
} catch (err) {
  failed = true;
  console.error(String(err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-10).join('\n').slice(0, 2500));
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
