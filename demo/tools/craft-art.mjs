#!/usr/bin/env node
// THE CRAFTING THINGS, LOOKED AT (craft-art-1): every thing of demo/stage/props/craft.js pictured the ways the game will
// show it. Nothing here changes the game; the server must be running (node demo/serve.mjs --port <port>).
//
//   node demo/tools/craft-art.mjs --out <dir> [--port 5511] [--only tiles,hand,ground] [--ids a,b] [--seed 3]
//
//   tiles    close up: the item tiles' own camera and light (demo/tools/item-tiles.js), each thing alone at 128 px and
//            at 64 px, a sheet a build step (tiles-<step>-<size>.png)
//   hand     in a hand at the game's camera: on the run's own page (demo/?mode=run), a stranger stood beside you and the
//            real purchase played (hands/deals.js DEALS.buy) with the thing as the goods: two moments, the seller holding
//            it out and you looking at it beside your head, by day and by night (hand-<id>-<day|night>-<a|b>.png, and
//            hand.json: where on the picture your head is, to crop round)
//   ground   on the ground and on a shelf: every thing at its drawn size in rows on the pavement beside you, from the
//            game's camera, by day and by night (ground-<day|night>.png); and the bags of every product side by side
//            as a shelf would hold six (shelf-<day|night>.png)
// HK2_DEBUG_PORT sets the browser's debugging port (demo/tools/chrome.mjs). One browser at a time.
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { CRAFT, PRODUCTS } from '../stage/props/craft.js';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};
const out = path.resolve(opt('--out', 'demo/shots/craft-art'));
const port = opt('--port', 5511);
const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);
const ids = opt('--ids', null)?.split(',') ?? null;
const rows = CRAFT.filter(r => !ids || ids.includes(r.id));
/** (hand) the game's own held goods first, for their size beside these: the carton and the energy drink (things.js KINDS) */
const REFS = (opt('--refs', ids ? '' : 'carton,can') || '').split(',').filter(Boolean).map(id => ({ id, name: `(the game's own ${id})` }));
const base = `http://127.0.0.1:${port}`;
mkdirSync(out, { recursive: true });
const savePng = (name, dataUrl) => {
  const file = path.join(out, name);
  writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`saved ${file}`);
};

async function session(name, url, run, size = { width: 1600, height: 1000 }) {
  const browser = await launch(size);
  try {
    const page = await browser.open(url);
    await run(page);
    const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
    console.log(`${name}: page errors ${bad.length}${bad.length ? `\n  ${[...new Set(bad)].slice(0, 8).join('\n  ').slice(0, 2000)}` : ''}`);
  } catch (err) {
    console.error(`${name}: ${String(err?.stack ?? err)}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

if (want('tiles')) {
  await session('tiles', `${base}/demo/tools/item-tiles.html?quiet`, async page => {
    await page.waitFor('window.__tiles && window.__tiles.ready', 120000, 100);
    for (const step of [...new Set(rows.map(r => r.step))]) {
      const R = rows.filter(r => r.step === step).map(r => ({ key: r.id, kind: 'goods', label: `${r.name}${r.note ? ` (${r.note})` : ''}`, model: { type: 'prop', id: r.id } }));
      for (const s of [128, 64]) savePng(`tiles-${step}-${s}.png`, await page.evaluate(`window.__tiles.rowsSheet(${JSON.stringify(R)}, ${s}, { title: 'CRAFTING · build step ${step}', sub: 'demo/stage/props/craft.js · the item tiles\\' camera and light' })`, 300000));
    }
  });
}

// ── on the run's own page
const runPage = `${base}/demo/?mode=run&seed=${opt('--seed', '3')}`;
/**
 * The page up, then a run loaded standing OUTSIDE at the trailer park (as hand-film.mjs's purchase does: place 'park'),
 * so the game's own street camera is the one used, not the trailer's inside view.
 */
async function ready(page) {
  await page.waitFor(`window.__demo?.hud?.phase === 'choose' && !!window.__demo.stage?.hands`, 240000, 250);
  await page.sleep(1200);
  const ok = await page.evaluate(`(async () => { const R = await import('/src/run/index.mjs'); const s0 = R.newRun({ seed: 3, cfg: R.RUN_CONFIG }); return await window.__demo.hud.load({ ...s0, place: 'park', hour: 10 }); })()`, 60000);
  if (!ok) throw new Error('the page would not load the state');
  await page.waitFor(`window.__demo.hud.phase === 'choose'`, 60000, 100);
  await page.sleep(2500);
}
/** The clock of the stage set to an hour (the light follows it), kept on the day it is. */
const setHour = (page, h) => page.evaluate(`(() => { const s = window.__demo.stage; const c = s.clock ?? { day: 1, hour: 12 }; s.setClock({ ...c, hour: ${h} }); return true; })()`);

if (want('hand')) {
  const marks = {};
  await session('hand', runPage, async page => {
    await ready(page);
    await page.sleep(3000);
    // you buy it from a stranger stood beside you, across the picture at the deal's own distance (deals.js STAND, both
    // sizes 1; --across moves him to the other side). --toward m and a second stranger buy it instead, on other ground
    const toward = Number(opt('--toward', 0)), side = Number(opt('--across', 1));
    const put = await page.evaluate(`(() => {
      const A = window.__demo.stage.actors, me = A.all().find(a => a.id === 'a1'), cam = window.__city.camera.position;
      const away = [me.x - cam.x, me.z - cam.z], n = Math.hypot(...away) || 1, f = [away[0] / n, away[1] / n], right = [-f[1], f[0]];
      const b = [me.x - f[0] * ${toward}, me.z - f[1] * ${toward}], s = [b[0] + right[0] * 1.44 * ${side}, b[1] + right[1] * 1.44 * ${side}];
      if (${toward} !== 0) A.add({ id: 'craft:buyer', name: 'a buyer', x: b[0], z: b[1], ry: Math.atan2(-f[0], -f[1]) });
      A.add({ id: 'craft:seller', name: 'a seller', x: s[0], z: s[1], ry: Math.atan2(-f[0], -f[1]) });
      return { buyer: b, seller: s };
    })()`);
    const BUYER = toward !== 0 ? 'craft:buyer' : 'a1';
    console.log('stood', JSON.stringify(put));
    await page.sleep(1500);
    for (const [when, hour] of [['day', 13], ['night', 22.5]]) {
      await setHour(page, hour);
      await page.sleep(2500);
      for (const r of [...REFS, ...rows]) {
        const t0 = Date.now();
        await page.evaluate(`(window.__craftDeal = window.__demo.stage.hands.perform({ deal: 'buy', roles: { buyer: ${JSON.stringify(BUYER)}, seller: 'craft:seller' }, told: { goods: ${JSON.stringify(r.id)} } }), true)`);
        // (the seller's hand out with it at about 1.75 s; you looking at it in yours at about 2.4 s: DEALS.buy's timeline)
        for (const [k, at] of [['a', 1.75], ['b', 2.4]]) {
          const wait = at * 1000 - (Date.now() - t0);
          if (wait > 0) await page.sleep(wait);
          await page.shot(path.join(out, `hand-${r.id}-${when}-${k}.png`));
        }
        // (where the two heads are on the picture: the camera's own projection, in the picture's pixels)
        marks[r.id] ??= await page.evaluate(`(() => { const C = window.__city, A = window.__demo.stage.actors.all(), r = C.renderer.domElement.getBoundingClientRect();
          const at = id => { const a = A.find(q => q.id === id); const v = new C.THREE.Vector3(a.x, a.y + 1.4, a.z).project(C.camera); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; };
          return { me: at(${JSON.stringify(BUYER)}), seller: at('craft:seller') }; })()`);
        await page.evaluate('window.__craftDeal');
        await page.sleep(400);
      }
    }
  });
  writeFileSync(path.join(out, 'hand.json'), JSON.stringify(marks, null, 1));
}

if (want('ground')) {
  await session('ground', runPage, async page => {
    await ready(page);
    await page.sleep(3000);
    // every thing at its drawn size (twice a real one), in rows on the ground in front of you; the bags as a shelf
    await page.evaluate(`(async () => {
      const C = window.__city, THREE = C.THREE, G = await import('/demo/stage/props/goods.js');
      const me = window.__demo.stage.actors.all().find(a => a.id === 'a1'), cam = C.camera.position;
      const away = [me.x - cam.x, me.z - cam.z], n = Math.hypot(...away) || 1, f = [away[0] / n, away[1] / n], r = [-f[1], f[0]];
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0.3 });
      // (the held things' own material: hands/things.js \`own\`, each vertex glowing a little in its own colour)
      mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\\n#ifdef USE_COLOR\\n totalEmissiveRadiance *= vColor.rgb;\\n#endif'); };
      const yaw = Math.atan2(-f[0], -f[1]);
      const lay = (list, row0, gap) => list.forEach((id, i) => {
        const g = new THREE.Group();
        for (const geo of G.propGeometry(THREE, id) ?? []) if (geo) g.add(Object.assign(new THREE.Mesh(geo, mat), { castShadow: true }));
        const col = i % 8, row = row0 + Math.floor(i / 8);
        const x = me.x + r[0] * (col - 3.5) * gap - f[0] * (1.4 + row * 0.75), z = me.z + r[1] * (col - 3.5) * gap - f[1] * (1.4 + row * 0.75);
        g.position.set(x, window.__demo.stage.actors.groundAt?.(x, z) ?? me.y, z);
        g.rotation.y = yaw;
        g.name = 'craft:ground';
        C.scene.add(g);
      });
      window.__craftLay = { lay, list: ${JSON.stringify(rows.filter(r => r.base === r.id).map(r => r.id))}, bags: ${JSON.stringify(Object.keys(PRODUCTS).map(p => `bag-${p}`))} };
      lay(window.__craftLay.list, 0, 0.55);
      return true;
    })()`);
    for (const [when, hour] of [['day', 13], ['night', 22.5]]) {
      await setHour(page, hour);
      await page.sleep(2500);
      await page.shot(path.join(out, `ground-${when}.png`));
    }
    await page.evaluate(`(() => { const C = window.__city; for (const g of C.scene.children.filter(o => o.name === 'craft:ground')) C.scene.remove(g); window.__craftLay.lay(window.__craftLay.bags, 0, 0.42); return true; })()`);
    for (const [when, hour] of [['day', 13], ['night', 22.5]]) {
      await setHour(page, hour);
      await page.sleep(2500);
      await page.shot(path.join(out, `shelf-${when}.png`));
    }
    const pos = await page.evaluate(`window.__demo.stage.screenOf('a1')`);
    writeFileSync(path.join(out, 'ground.json'), JSON.stringify({ me: pos }, null, 1));
  });
}
// (the DevTools socket keeps node alive after the browser is gone)
process.exit(process.exitCode ?? 0);
