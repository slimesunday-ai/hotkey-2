#!/usr/bin/env node
// ITEM TILES (tiles-1): contact sheets of every thing THE RUN sells, from the model the game draws, at tile sizes; a
// whole slot of the cast at one size; what the libraries hold; and the two ways of making the pictures in play, timed.
// The page and the module are demo/tools/item-tiles.html / item-tiles.js (what is photographed, and how, is said there).
// The server must be running: node demo/serve.mjs --port <port>
//
//   node demo/tools/item-tiles.mjs --out <dir> [--port 5470] [--only sheets,library,cost] [--sizes 48,64,96,128]
//        [--slot hat] [--slot-size 64] [--seed 3]
//
//   sheets   sheet-<size>.png for each size (bone alone | bone worn | white alone | white worn, a row a thing),
//            ladder.png (every size side by side, on bone) and ladder-ink.png (the same with the icon baker's ink
//            outline), mapping.json (each thing, the model it is and why), alike-<size>.json (the closest pairs)
//   library  library-<slot>-<size>.png (every piece of one cast slot, alone and on the player), counts.json,
//            alike-<slot>-<size>.json
//   candidates  candidates-64.png: pieces the libraries already hold that could stand for the things with no model of
//            their own (NOT what the game draws: a look for the owner), the same camera and light
//   cost     atlas-64.png and atlas-128.png (a baked sheet: every tile of the things sold) with their index, then the
//            game's own page (demo/?mode=run): the snapshots taken there (this module imported into the running game,
//            each tile timed) and the baked sheet decoded and sliced there; cost.json. Also checks there that the
//            stage's player look is the one photographed and that each WEAR_LOOK piece goes onto the figure.
// HK2_DEBUG_PORT sets the browser's debugging port (demo/tools/chrome.mjs). One browser at a time.
import path from 'node:path';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/item-tiles'));
const port = opt('--port', 5470);
const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);
const SIZES = opt('--sizes', '48,64,96,128').split(',').map(Number);
const SLOT = opt('--slot', 'hat');
const SLOT_SIZE = Number(opt('--slot-size', 64));
const base = `http://127.0.0.1:${port}`;
mkdirSync(out, { recursive: true });

const savePng = (name, dataUrl) => {
  const file = path.join(out, name);
  writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`saved ${file}`);
  return file;
};
const saveJson = (name, v) => {
  const file = path.join(out, name);
  writeFileSync(file, JSON.stringify(v, null, 1));
  console.log(`saved ${file}`);
  return file;
};

async function session(name, url, run, { width = 1400, height = 900 } = {}) {
  const browser = await launch({ width, height });
  let page = null;
  try {
    page = await browser.open(url);
    await run(page);
    const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
    console.log(`${name}: page errors ${bad.length}${bad.length ? `\n  ${[...new Set(bad)].slice(0, 8).join('\n  ').slice(0, 2000)}` : ''}${page.failed.length ? `\n  failed loads: ${page.failed.slice(0, 5).join(', ')}` : ''}`);
  } catch (err) {
    console.error(`${name}: ${String(err)}`);
    if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-10).join('\n').slice(0, 2500));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
const tilesPage = `${base}/demo/tools/item-tiles.html?quiet`;
const ready = page => page.waitFor('window.__tiles && window.__tiles.ready', 120000, 100);

if (want('sheets')) {
  await session('sheets', tilesPage, async page => {
    await ready(page);
    const ev = (js, ms = 300000) => page.evaluate(js, ms);
    const mapping = await ev('window.__tiles.rows');
    saveJson('mapping.json', mapping);
    for (const s of SIZES) {
      const r = await ev(`window.__tiles.sheet(${s})`);
      savePng(`sheet-${s}.png`, r.png);
      saveJson(`alike-${s}.json`, r.alike);
    }
    savePng('ladder.png', await ev(`window.__tiles.ladder(${JSON.stringify(SIZES)})`));
    savePng('ladder-ink.png', await ev(`window.__tiles.ladder(${JSON.stringify(SIZES)}, { ink: true })`));
  });
}

if (want('library')) {
  await session('library', tilesPage, async page => {
    await ready(page);
    const ev = (js, ms = 600000) => page.evaluate(js, ms);
    saveJson('counts.json', await ev('window.__tiles.counts()'));
    const r = await ev(`window.__tiles.slot(${JSON.stringify(SLOT)}, ${SLOT_SIZE})`);
    savePng(`library-${SLOT}-${SLOT_SIZE}.png`, r.png);
    saveJson(`alike-${SLOT}-${SLOT_SIZE}.json`, r.alike);
  });
}

// (the pieces already in the libraries nearest to each thing that has no model of its own, or borrows one: a look, not a choice)
const CANDIDATES = [
  { key: 'visor?', kind: 'wear', part: 'head', label: 'casino visor: the only visor-like hat (a Cleaner uniform hood)', model: { type: 'cast', slot: 'hat', id: 'npc_cleaner_hood_visor' } },
  { key: 'hightops?', kind: 'wear', part: 'feet', label: 'white high-tops: Tagged Customs (white high-top, painted)', model: { type: 'cast', slot: 'shoes', id: 'tagged_customs' } },
  { key: 'hightops?2', kind: 'wear', part: 'feet', label: 'high-tops: cursor high-tops (colour-blocked)', model: { type: 'cast', slot: 'shoes', id: 'old_classic_hightop' } },
  { key: 'overcoat?', kind: 'wear', part: 'top', label: 'camel overcoat: the NPC beige trench', model: { type: 'cast', slot: 'top', id: 'npc_top_trench' } },
  { key: 'chain?', kind: 'wear', part: 'neck', label: 'gold chain: no neck piece in the cast', model: null },
  { key: 'recliner?', kind: 'home', label: 'leather recliner: the kit recliner (already in the trailer)', model: { type: 'kit', id: 'recliner' } },
  { key: 'homebar?', kind: 'home', label: 'home bar: the kit home bar', model: { type: 'kit', id: 'bar-home' } },
  { key: 'deadbolt?', kind: 'home', label: 'deadbolt: the kit door chain + deadbolt', model: { type: 'kit', id: 'door-locks' } },
  { key: 'sandwich?', kind: 'food', label: 'sandwich: the held chopped cheese', model: { type: 'cast', slot: 'held', id: 'chopped_cheese' } },
  { key: 'drink?', kind: 'food', label: 'energy drink: the held orange drink', model: { type: 'cast', slot: 'held', id: 'orange_drink' } },
  { key: 'drink?2', kind: 'food', label: 'energy drink: the held tallboy', model: { type: 'cast', slot: 'held', id: 'tallboy' } },
];
// (lib-1) the whole library the run sells, a sheet per slot to wear and per family of the home kit
const HOME_SHEETS = [
  ['seating-tables-storage', ['seating', 'tables', 'storage']], ['electronics-gaming-music', ['electronics', 'gaming', 'music']],
  ['decor-lights-plants-rugs', ['decor', 'lights', 'plants', 'rugs']], ['kitchen-bath-clutter-stash-security', ['kitchen', 'bath', 'clutter', 'stash', 'security']],
  ['collectibles', ['collectibles']], ['trophies', ['trophies']], ['wall', ['wall']],
];
if (want('library-all')) {
  await session('library-all', tilesPage, async page => {
    await ready(page);
    const blanks = {};
    for (const slot of ['hat', 'eyewear', 'top', 'bottom', 'shoes', 'acc']) {
      const r = await page.evaluate(`window.__tiles.library('wear', ${JSON.stringify(slot)}, 64, ${JSON.stringify(`THE RUN'S LIBRARY · to wear · ${slot}`)})`, 600000);
      savePng(`lib-wear-${slot}-64.png`, r.png);
      blanks[slot] = { n: r.n, blanks: r.blanks };
    }
    for (const [name, cats] of HOME_SHEETS) {
      const r = await page.evaluate(`window.__tiles.library('home', ${JSON.stringify(cats)}, 64, ${JSON.stringify(`THE RUN'S LIBRARY · for the trailer · ${cats.join(', ')}`)})`, 600000);
      savePng(`lib-home-${name}-64.png`, r.png);
      blanks[name] = { n: r.n, blanks: r.blanks };
    }
    saveJson('lib-blanks.json', blanks);
  });
}
// (lib-1, part B) the new props and the pieces chosen for the goods and the food, with the library's nearest for comparison
const PART_B = [
  { key: 'energy-can', kind: 'goods', label: 'NEW · energy drink can (the shop\'s drink)', model: { type: 'prop', id: 'energy-can' } },
  { key: 'smokes-pack', kind: 'goods', label: 'NEW · pack of cigarettes (loose cigarettes)', model: { type: 'prop', id: 'smokes-pack' } },
  { key: 'smokes-carton', kind: 'goods', label: 'NEW · carton of cigarettes (the connect\'s pack)', model: { type: 'prop', id: 'smokes-carton' } },
  { key: 'chopped_cheese', kind: 'food', label: 'CHOSEN · held Chopped Cheese (the sandwich)', model: { type: 'cast', slot: 'held', id: 'chopped_cheese' } },
  { key: 'tallboy', kind: 'food', label: 'not chosen · held 99 Tallboy (lemon tea)', model: { type: 'cast', slot: 'held', id: 'tallboy' } },
  { key: 'orange_drink', kind: 'food', label: 'not chosen · held Orange Drink (a gallon)', model: { type: 'cast', slot: 'held', id: 'orange_drink' } },
];
if (want('partb')) {
  await session('partb', tilesPage, async page => {
    await ready(page);
    for (const s of [64, 128]) savePng(`partb-${s}.png`, await page.evaluate(`window.__tiles.rowsSheet(${JSON.stringify(PART_B)}, ${s}, { title: 'PART B · new props for the goods, and the pieces chosen', sub: 'NEW: built for the game (demo/stage/props/goods.js) · CHOSEN: from the library · the art call is the owner' })`, 300000));
  });
}

if (want('candidates')) {
  await session('candidates', tilesPage, async page => {
    await ready(page);
    savePng('candidates-64.png', await page.evaluate(`window.__tiles.rowsSheet(${JSON.stringify(CANDIDATES)}, 64, { title: 'CANDIDATES ONLY, NOT IN THE GAME', sub: 'pieces the libraries already hold, nearest to the things with no model (or a borrowed one) · same camera and light' })`, 300000));
  });
}

if (want('cost')) {
  const cost = { note: 'times in ms, measured in headless Chrome (Metal) on this machine; bytes are PNG bytes' };
  const atlases = {};
  // the baked sheet: made ahead of time in the tools page (its bake time is the tool's, not the player's)
  await session('bake', tilesPage, async page => {
    await ready(page);
    // (a page that has not loaded the game: what importing the cast, the kits and the tables costs cold)
    cost.coldImportMs = await page.evaluate('window.__tiles.K.importMs');
    for (const s of [64, 128]) {
      const a = await page.evaluate(`window.__tiles.atlas(${s})`, 300000);
      const file = savePng(`atlas-${s}.png`, a.png);
      saveJson(`atlas-${s}.json`, { size: s, index: a.index });
      atlases[s] = { file, index: a.index, bakeMs: a.bakeMs, bytes: readFileSync(file).length };
    }
  });
  cost.baked = Object.fromEntries(Object.entries(atlases).map(([s, a]) => [s, { tiles: Object.keys(a.index).length, bytes: a.bytes, bakeMsOffline: a.bakeMs }]));
  // the game's own page: both ways, while the city runs
  await session('game', `${base}/demo/?mode=run&seed=${opt('--seed', '3')}`, async page => {
    const t0 = Date.now();
    await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 240000);
    cost.gameLoadS = (Date.now() - t0) / 1000;
    await page.sleep(2000);
    const ev = (js, ms = 300000) => page.evaluate(js, ms);
    const mod = `${base}/demo/tools/item-tiles.js`;
    // the rows are the module's own (catalog), from the same tables the game reads
    cost.snapshot = {};
    cost.snapshot.first64 = await ev(`(async () => { const T = await import(${JSON.stringify(mod)}); const K = await T.kit(); return await T.timeSnapshots(T.catalog(K), 64, 2); })()`);
    cost.snapshot.again64 = await ev(`(async () => { const T = await import(${JSON.stringify(mod)}); const K = await T.kit(); const r = await T.timeSnapshots(T.catalog(K), 64, 2); delete r.per; return r; })()`);
    cost.snapshot.again128 = await ev(`(async () => { const T = await import(${JSON.stringify(mod)}); const K = await T.kit(); const r = await T.timeSnapshots(T.catalog(K), 128, 2); delete r.per; return r; })()`);
    cost.bakedInGame = {};
    for (const [s, a] of Object.entries(atlases)) {
      const b64 = readFileSync(a.file).toString('base64');
      const cells = Object.values(a.index);
      cost.bakedInGame[s] = await ev(`(async () => { const T = await import(${JSON.stringify(mod)}); return await T.timeBaked(${JSON.stringify(b64)}, ${JSON.stringify(cells)}, ${s}); })()`);
    }
    // the checks: the player's look on the stage is the one photographed; each WEAR_LOOK piece goes on the figure
    cost.checks = await ev(`(async () => {
      const T = await import(${JSON.stringify(mod)}); const K = await T.kit();
      const A = window.__demo.stage.actors.all().find(a => a.id === 'a1');
      const mine = T.playerLook(K);
      const same = !!A && Object.keys(mine).filter(k => k !== 'handle').every(k => JSON.stringify(A.look[k]) === JSON.stringify(mine[k]));
      const dressed = {};
      for (const [key, w] of Object.entries(K.WEAR_LOOK)) {
        const ok = window.__demo.stage.actors.dress('a1', { [w.slot]: w.id });
        const B = window.__demo.stage.actors.all().find(a => a.id === 'a1');
        dressed[key] = { asked: w.slot + ':' + w.id, dressOk: ok, wearing: B.look[w.slot]?.id ?? B.look[w.slot] };
      }
      window.__demo.stage.actors.dress('a1', {});
      return { stagePlayerFound: !!A, sameLookAsPhotographed: same, stageHat: A?.look.hat, stageTop: A?.look.top, stageShoes: A?.look.shoes, dressed };
    })()`);
  }, { width: 1600, height: 1000 });
  saveJson('cost.json', cost);
}
// (the DevTools socket keeps node alive after the browser is gone)
process.exit(process.exitCode ?? 0);
