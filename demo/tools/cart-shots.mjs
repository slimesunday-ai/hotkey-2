#!/usr/bin/env node
// THE CART MAN AND HIS CART IN THE GAME (named-1): stills at the game's own camera (the run's play camera on the player,
// 24 m up, 64° down) at the Jay St night market, day and night: him pushing it across the picture (a straight walk of the
// stage's own, actors.stepTo), and him standing with it parked. The cart is the city's (world/named/props/cart.js), put
// beside him by demo/stage/props/along.js. The server must be running: node demo/serve.mjs
//
//   node demo/tools/cart-shots.mjs --out <dir> [--port 5470] [--seed 3]
// Writes cart-push-day.jpg, cart-push-night.jpg, cart-park-day.jpg (crops round him, and -full.jpg: the game's whole
// picture) and prints the cart's own audit (props/along.js state: frames it was in anybody, its worst lag).
import path from 'node:path';
import { mkdirSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, newRun, step } from '../../src/run/index.mjs';

const opt = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
};
const out = path.resolve(opt('--out', 'demo/shots/cast'));
const port = Number(opt('--port', 5470));
mkdirSync(out, { recursive: true });
const ID = 'npc:buyer:market:4';

// a state at the market: out of the trailer, the fare on you, the subway there
let s = newRun({ seed: Number(opt('--seed', 3)), cfg });
s = step(cfg, s, { do: 'out', take: 0 }).state;
s = { ...s, hour: 13, carried: s.carried + 40, books: { ...s.books, earned: s.books.earned + 40 } };
s = step(cfg, s, { do: 'subway', to: 'market', hop: false }).state;

const browser = await launch({ width: 1600, height: 1000 });
if (process.env.HK2_PIDS) appendFileSync(process.env.HK2_PIDS, `${browser.pid}\n`);
let failed = false;
try {
  const page = await browser.open(`http://127.0.0.1:${port}/demo/?mode=run&seed=3&speed=1`);
  const ev = (js, ms) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 180000);
  if (!(await ev(`window.__demo.hud.load(${JSON.stringify(s)})`, 60000))) throw new Error('the page would not load the state');
  await page.waitFor('window.__demo.hud.phase === "choose"', 120000);
  await page.sleep(4000);
  // where he is on the page, and a crop round him
  const crop = async (name, full = false) => {
    const at = await ev(`(() => { const A = window.__demo.stage.actors.screenOf(${JSON.stringify(ID)}); return [Math.round(A.x), Math.round(A.y), A.visible]; })()`);
    const raw = path.join(out, `${name}-full.jpg`);
    await page.shot(raw);
    execFileSync('python3', ['-c', `from PIL import Image; im = Image.open(${JSON.stringify(raw)}); x, y = ${at[0]}, ${at[1]} + 30; im.crop((x - 170, y - 120, x + 170, y + 120)).resize((680, 480), Image.LANCZOS).save(${JSON.stringify(path.join(out, name + '.jpg'))}, quality=88)`]);
    return at;
  };
  // across the picture, by the player: on the sidewalk 3 m east of them, from 4.5 m north to 4.5 m south (the camera looks
  // west), a stage walk (actors.walkTo, the lanes)
  const walk = async name => {
    const t = await ev(`(() => { const S = window.__demo.stage, A = S.actors, Y = A.get('a1'), C = A.get(${JSON.stringify(ID)}); const was = [C.x, C.z]; const { x: ax, z: az } = A.fitSpot(Y.x + 3, Y.z - 4.5); const { x: bx, z: bz } = A.fitSpot(Y.x + 3, Y.z + 4.5); A.place(${JSON.stringify(ID)}, ax, az, 0); window.__cartErr = null; window.__cartWalk = A.walkTo(${JSON.stringify(ID)}, bx, bz, { v: 1.1 }).catch(e => { window.__cartErr = String(e); }); return JSON.stringify({ was, now: [C.x, C.z], you: [Y.x, Y.z] }); })()`);
    await page.sleep(3400);
    console.log(name, t, await ev(`JSON.stringify({ at: [window.__demo.stage.actors.get(${JSON.stringify(ID)}).x, window.__demo.stage.actors.get(${JSON.stringify(ID)}).z], route: !!window.__demo.stage.actors.get(${JSON.stringify(ID)}).route, err: window.__cartErr })`));
    await ev('window.__demo.stage.setSpeed(0)');
    await page.sleep(400);
    const at = await crop(name);
    await ev('window.__demo.stage.setSpeed(1)');
    await ev('window.__cartWalk');
    return at;
  };
  await ev('window.__demo.stage.along.reset()');
  await ev('window.__demo.stage.setClock?.({ day: 1, hour: 13 })');
  console.log('push day at', await walk('cart-push-day'));
  await page.sleep(1500);
  console.log('park day at', await crop('cart-park-day'));
  await ev('window.__demo.stage.setClock?.({ day: 1, hour: 21.5 })');
  await page.sleep(1500);
  console.log('push night at', await walk('cart-push-night'));
  await page.sleep(1500);
  console.log('park night at', await crop('cart-park-night'));
  console.log('the cart:', JSON.stringify(await ev('window.__demo.stage.along.state()')));
} catch (err) {
  failed = true;
  console.error('cart-shots:', err?.message ?? err);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
