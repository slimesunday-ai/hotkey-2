#!/usr/bin/env node
// THE NAMED CAST AS THE GAME DRAWS THEM (named-1): every named person of the game in a row with their names, at the
// game's own camera and size, the standard figure (the shared body, size 1) at each end of each row for scale. Day and
// night. The figures are the stage's own (demo/stage/actors.js add, a `named` look: the city's pool, world/named/, at
// the person's own `scale`), stood on the fight page's lot (demo/?mode=fight: clear ground, the city's crowd kept off
// it) with the player in the middle, under the run's play camera (camera.js: the Lock, 24 m up, 64° down, from the
// east). Nothing of the camera is changed: it follows the player as on any hour.
//
//   node demo/tools/cast-lineup.mjs --out <dir> [--port 5470] [--also]     (the server: node demo/serve.mjs)
//     --also   a second picture: the people drawn in the pool who are not in the game, in a row of their own
// Writes lineup-game-day.jpg and lineup-game-night.jpg (with --also, lineup-pool-…): the game's picture, cropped to the
// rows, each one's name and size under their feet; a copy twice the size (-x2); lineup.json (who stood where, at what size).
import path from 'node:path';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch } from './chrome.mjs';
import { NAMED } from '../run/scenes.js';

const opt = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
};
const out = path.resolve(opt('--out', 'demo/shots/cast'));
const port = Number(opt('--port', 5470));
const also = process.argv.includes('--also');
mkdirSync(out, { recursive: true });
const HERE = path.dirname(fileURLToPath(import.meta.url));

// the game's named people: the run's (scenes.js NAMED, by id) and the fight page's Big Moss (demo/fight/index.js LOOKS.boss)
const GAME = [...new Set([...Object.values(NAMED), 'moss'])];

const browser = await launch({ width: 1600, height: 1000 });
// (HK2_PIDS: a file each started browser's process id is added to, so whoever runs this stops only its own)
if (process.env.HK2_PIDS) appendFileSync(process.env.HK2_PIDS, `${browser.pid}\n`);
let failed = false;
try {
  const page = await browser.open(`http://127.0.0.1:${port}/demo/?mode=fight&seed=1`);
  const ev = (js, ms) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "pick"', 180000);
  await page.sleep(1500);
  // THE ROWS, on the lot's open ground east of where the player starts (the camera is carried with the player, so the
  // player is stood a step behind the rows, nearer the camera: the rows are in the picture's upper middle, clear of the
  // lot's parked van and truck). Each group in turn, the others not drawn: the game's people (two rows, smallest to
  // biggest), then (--also) the pool's people who are not in the game.
  const rows = await ev(`(async () => {
    const S = window.__demo.stage, A = S.actors, P = A.NAMED.PEOPLE;
    const game = ${JSON.stringify(GAME)}, also = ${also};
    const order = k => P.findIndex(p => p.key === k);
    const bySize = (a, b) => P.find(p => p.key === a).scale - P.find(p => p.key === b).scale || order(a) - order(b);
    const inGame = [...game].sort(bySize);
    const rest = P.map(p => p.key).filter(k => !game.includes(k)).sort(bySize);
    const you = A.all().find(q => q.id === 'fight:you');
    const [x0, z0] = [you.x, you.z];
    const half = Math.ceil(inGame.length / 2);
    // [group, row in the group, its people, metres east of the player's first place]
    const lines = [['game', 0, inGame.slice(0, half), 9.5], ['game', 1, inGame.slice(half), 12], ...(also ? [['pool', 0, rest, 10.5]] : [])];
    const GAP = 1.3, east = Math.PI / 2;
    const placed = [];
    lines.forEach(([group, r, list, dx], li) => {
      const all = ['std', ...list, 'std'];
      all.forEach((k, i) => {
        const id = 'lineup:' + li + ':' + i;
        // (left to right in the picture, smallest first: the camera looks west, so its right hand is north, -z)
        const [x, z] = [x0 + dx, z0 - (i - (all.length - 1) / 2) * GAP];
        const p = P.find(q => q.key === k);
        if (!A.has(id)) A.add({ id, name: p ? p.name : 'standard', x, z, ry: east, look: k === 'std' ? { seed: 'lineup:standard', pool: 'npc' } : { named: k } });
        A.place(id, x, z, east);
        // (named-1: a thing that goes about with them, the cart man's cart: pushed, as he goes about with it)
        if (k !== 'std' && S.along?.attach(id)) S.along.pose(id, 'push');
        placed.push({ id, key: k, name: p ? p.name : 'the standard figure (1.0)', group, row: r, size: A.sizeOf(id), inGame: k === 'std' ? null : game.includes(k) });
      });
    });
    A.place('fight:you', x0 + 15.5, z0, -east);
    return placed;
  })()`);
  const show = group => ev(`(() => { const A = window.__demo.stage.actors; for (const r of ${JSON.stringify(rows)}) A.show(r.id, r.group === ${JSON.stringify(group)}); })()`);
  const shoot = async (group, light) => {
    await page.sleep(2500);
    const mine = rows.filter(r => r.group === group);
    // where each one's feet and head are on the page, and the picture
    const at = await ev(`(() => { const A = window.__demo.stage.actors, city = window.__demo.city, THREE = city.THREE, V = new THREE.Vector3();
      city.camera.updateMatrixWorld();
      const sc = (x, y, z) => { V.set(x, y, z).project(city.camera); return [Math.round((V.x * .5 + .5) * innerWidth), Math.round((-V.y * .5 + .5) * innerHeight)]; };
      return ${JSON.stringify(mine.map(r => r.id))}.map(id => { const B = A.all().find(q => q.id === id); return { id, feet: sc(B.x, B.y, B.z), head: sc(B.x, B.y + B.head.y1, B.z) }; }); })()`);
    const raw = path.join(out, `lineup-${group}-${light}-raw.jpg`);
    await page.shot(raw);
    const json = path.join(out, `lineup-${group}-${light}.json`);
    writeFileSync(json, JSON.stringify({ rows: mine, at }, null, 1));
    execFileSync('python3', [path.join(HERE, 'cast-lineup.py'), raw, json, light, path.join(out, `lineup-${group}-${light}.jpg`)], { stdio: 'inherit' });
  };
  for (const group of also ? ['game', 'pool'] : ['game']) {
    await show(group);
    for (const [light, hour] of [['day', 13], ['night', 21.5]]) {
      await ev(`window.__demo.stage.setClock?.({ day: 5, hour: ${hour} })`);
      // (by night, the stage's own key lamps over the rows, as over any scene that plays at night: stage.keyLamps,
      // the city's lamp light 4.2 m up and 2.4 m toward the camera, three along the rows)
      if (light === 'night') await ev(`(() => { const S = window.__demo.stage, A = S.actors, R = ${JSON.stringify(rows.filter(r => r.group === group).map(r => r.id))}.map(id => A.all().find(q => q.id === id));
        const x = R.reduce((q, B) => q + B.x, 0) / R.length, y = R[0].y, zs = R.map(B => B.z), z0 = Math.min(...zs), z1 = Math.max(...zs);
        S.keyLamps(() => [0.2, 0.5, 0.8].map(t => [x + 2.4, y + 4.2, z0 + (z1 - z0) * t])); })()`);
      await shoot(group, light);
    }
  }
  writeFileSync(path.join(out, 'lineup.json'), JSON.stringify(rows, null, 1));
  console.log(`cast-lineup: ${rows.filter(r => r.key !== 'std').length} people in ${new Set(rows.map(r => r.row)).size} rows → ${out}`);
} catch (err) {
  failed = true;
  console.error('cast-lineup:', err?.message ?? err);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
