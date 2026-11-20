#!/usr/bin/env node
// THE NAMED CAST AT THEIR WORK (named-1): each named person at their place, at the hour their day has them at a clip
// (demo/run/scenes.js DAYS), filmed from the game's own camera (the run's play camera on the player, stood a few
// metres off them) and from a low view (the same camera turned: camera.setAngle, as hand-film --angle does). For what
// is in their hands (their own held thing or the clip's prop) and what the clip acts on (a stall, a shelf, a bench).
// The server must be running: node demo/serve.mjs
//
//   node demo/tools/cast-work.mjs --out <dir> [--port 5470] [--qs '&named=0'] [--only pruitt,gloria] [--clip]
// Writes <who>-game.jpg and <who>-low.jpg (crops round them, twice the size) for each; --clip: and <who>-game.mp4,
// <who>-low.mp4 (3 s each, from the page's own screencast).
import path from 'node:path';
import { mkdirSync, appendFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, newRun, step } from '../../src/run/index.mjs';

const opt = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
};
const out = path.resolve(opt('--out', 'demo/shots/cast'));
const port = Number(opt('--port', 5470));
const QS = opt('--qs', '');
const tag = QS.includes('named=0') ? 'stand-in' : QS.includes('hands=old') ? 'before' : 'after';
const CLIP = process.argv.includes('--clip');
mkdirSync(out, { recursive: true });
// who, where (the run's place), the hour their day has them at the clip, and that clip (held to by the director while
// the pictures are taken: its person's `clips`, as their day gives them). The player is stood 2.6 m to their side
// (2.4 m to their side, across their heading, out of the low view's line, which looks at them from in front)
const WHO = {
  pruitt: { id: 'npc:neighbour:2', place: 'park', hour: 13, clip: 'bench_hammer' },
  gloria: { id: 'npc:neighbour:3', place: 'park', hour: 13, clip: 'stock_shelf' },
  alvarez: { id: 'npc:neighbour', place: 'park', hour: 14, clip: 'stock_shelf' },
  earl: { id: 'npc:connect:projects', place: 'park', hour: 16, clip: 'stock_shelf' },
  ferraro: { id: 'npc:shop:market:2', place: 'market', hour: 12, clip: 'stock_shelf' },
  teo: { id: 'npc:connect:market', place: 'market', hour: 14, clip: 'stock_shelf' },
};
const only = opt('--only', null)?.split(',') ?? Object.keys(WHO);

function stateAt(place, hour) {
  let s = newRun({ seed: 3, cfg });
  s = step(cfg, s, { do: 'out', take: 0 }).state;
  s = { ...s, carried: s.carried + 40, books: { ...s.books, earned: s.books.earned + 40 } };
  if (place !== 'park') s = step(cfg, { ...s, hour: 10 }, { do: 'subway', to: place, hop: false }).state;
  return { ...s, hour };
}

const browser = await launch({ width: 1600, height: 1000 });
if (process.env.HK2_PIDS) appendFileSync(process.env.HK2_PIDS, `${browser.pid}\n`);
let failed = false;
try {
  const page = await browser.open(`http://127.0.0.1:${port}/demo/?mode=run&seed=3&speed=1${QS}`);
  const ev = (js, ms) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 180000);
  for (const key of only) {
    const W = WHO[key];
    if (!(await ev(`window.__demo.hud.load(${JSON.stringify(stateAt(W.place, W.hour))})`, 60000))) throw new Error(`no state for ${key}`);
    await page.waitFor('window.__demo.hud.phase === "choose"', 120000);
    await page.sleep(3000);
    // the player a few steps to their side, so the game's camera, which follows the player, has them; their clip played, the director's life for them held off while it is (its person `busy`)
    await ev(`(() => { const S = window.__demo.stage, A = S.actors, P = A.get(${JSON.stringify(W.id)}); const ry = P.w.yawS ?? P.ry; A.place('a1', P.x + 2.4 * Math.cos(ry), P.z - 2.4 * Math.sin(ry), ry);
      const D = S.director.people.get(${JSON.stringify(W.id)}); if (D) D.busy = 1; A.play(${JSON.stringify(W.id)}, ${JSON.stringify(W.clip)}, { loop: true }); })()`);
    await page.sleep(5000);
    const info = await ev(`JSON.stringify((() => { const A = window.__demo.stage.actors, P = A.get(${JSON.stringify(W.id)}); return { clip: P.clipName, want: P.want?.name ?? null, look: P.w.look, own: P.own, bare: P.bare ?? null, busy: !!P.handsBusy, size: P.size, at: [+P.x.toFixed(2), +P.z.toFixed(2)], ry: +(P.w.yawS ?? P.ry).toFixed(2) }; })())`);
    console.log(`${key} (${tag}): ${info}`);
    // (the low view from in front of them: the camera's bearing their own heading; 0 is due south, 90 due east)
    const front = await ev(`Math.round(((window.__demo.stage.actors.get(${JSON.stringify(W.id)}).w.yawS ?? window.__demo.stage.actors.get(${JSON.stringify(W.id)}).ry) * 180 / Math.PI + 360) % 360)`);
    for (const [view, angle] of [['game', null], ['low', [front, 22, 3.6]]]) {
      if (angle) await ev(`window.__demo.stage.camera.setAngle({ bearing: ${angle[0]}, down: ${angle[1]}, high: ${angle[2]} })`);
      await page.sleep(angle ? 1500 : 200);
      const at = await ev(`(() => { const s = window.__demo.stage.actors.screenOf(${JSON.stringify(W.id)}); return [Math.round(s.x), Math.round(s.y)]; })()`);
      const raw = path.join(out, `${key}-${tag}-${view}-full.jpg`);
      await page.shot(raw);
      const crop = (file, img) => execFileSync('python3', ['-c', `from PIL import Image; im = Image.open(${JSON.stringify(img)}); x, y = ${at[0]}, ${at[1]} + ${view === 'low' ? 90 : 40}; w, h = ${view === 'low' ? '260, 220' : '170, 130'}; im.crop((x - w, y - h, x + w, y + h)).resize((4 * w, 4 * h), Image.LANCZOS).save(${JSON.stringify(file)}, quality=86)`]);
      crop(path.join(out, `${key}-${tag}-${view}.jpg`), raw);
      if (CLIP) {
        // three seconds of the page's own frames, round them
        const dir = path.join(out, `.frames-${key}-${view}`);
        mkdirSync(dir, { recursive: true });
        let n = 0;
        const t0 = Date.now();
        while (Date.now() - t0 < 3000) {
          const f = path.join(dir, `f-${String(n++).padStart(4, '0')}.jpg`);
          await page.shot(f);
          crop(f, f);
        }
        execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(Math.max(4, Math.round(n / 3))), '-i', path.join(dir, 'f-%04d.jpg'), '-vf', 'scale=680:-2', '-c:v', 'libx264', '-crf', '27', '-pix_fmt', 'yuv420p', path.join(out, `${key}-${tag}-${view}.mp4`)]);
        rmSync(`${dir}`, { recursive: true, force: true });
      }
      if (angle) await ev('window.__demo.stage.camera.setAngle()');
    }
  }
} catch (err) {
  failed = true;
  console.error('cast-work:', err?.message ?? err);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
