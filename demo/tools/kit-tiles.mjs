#!/usr/bin/env node
// KIT TILES (assets-1): one picture per piece, from the model the game draws (item-tiles.js alone → picture), on the
// tile's own bone background, saved as WebP; with each piece's triangles and the time its tile took. For the owner's
// before / after pages of the home kit's pieces, the shop kit's and the new ones. The server must be running:
// node demo/serve.mjs --port <port>
//
//   node demo/tools/kit-tiles.mjs --out <dir> --ids kit:hot-plate,kit:cook-rig@1,store:store-pawn-shelf [--port 5470]
//        [--prefix after-] [--size 256] [--max-kb 40] [--game] [--shop]
//
//   an id is kit:<home kit id>, store:<shop kit id>, prop:<goods prop>, or anything item-tiles.js modelOf reads;
//   @<n> picks a variant, #<state> a kit piece's state. Files: <prefix><id>.webp (the kit: or store: word left off, @n kept
//   as -v<n>, #state as -<state>), and
//   tiles.json: per piece { tris, ms (this size, 4× supersampled), gameMs (the game's own tile: 128 px, 2×), bytes }.
//   --game: also time each piece at the game's size three times and keep the median.
//   --shop: the picture as the shop's lists show it (demo/run/tiles.js: rendered at 2 × 64 with 2× supersampling and the
//   ink outline), brought down to --size (64: what a 1× screen shows); the file name gets -<size>.
//   --el <degrees>: the camera that many degrees above the horizon, for every piece (the room's camera looks down at about 58°:
//   a glass case's lid, a rug, what shows from above); the file name gets -el<degrees>.
// HK2_DEBUG_PORT sets the browser's debugging port (demo/tools/chrome.mjs). One browser at a time.
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/kit-tiles'));
const port = opt('--port', 5470);
const ids = opt('--ids', 'kit:hot-plate').split(',').filter(Boolean);
const prefix = opt('--prefix', '');
const size = Number(opt('--size', 256));
const maxKb = Number(opt('--max-kb', 40));
const game = process.argv.includes('--game');
const shop = process.argv.includes('--shop');
const el = opt('--el', null) === null ? null : Number(opt('--el'));
mkdirSync(out, { recursive: true });

const fileOf = id => `${prefix}${id.replace(/^(kit|store):/, '').replace(/#([a-z0-9-]+)$/i, '-$1').replace(/@(\d+)/, '-v$1').replace(/[^a-z0-9_-]+/gi, '-')}${shop ? `-${size}` : ''}${el === null ? '' : `-el${el}`}.webp`;
const browser = await launch({ width: 900, height: 700 });
let failed = 0;
try {
  const page = await browser.open(`http://127.0.0.1:${port}/demo/tools/item-tiles.html?quiet`);
  await page.waitFor('window.__tiles && window.__tiles.ready', 120000, 100);
  const stats = {};
  for (const id of ids) {
    const r = await page.evaluate(`(async () => {
      const { T, K } = window.__tiles;
      const id = ${JSON.stringify(id)}, m = id.match(/^(.*?)(?:@(\\d+))?(?:#([a-z0-9-]+))?$/i), key = m[1], variant = Number(m[2] ?? 0), state = m[3];
      const kind = key.slice(0, key.indexOf(':')), rest = key.slice(key.indexOf(':') + 1);
      const model = kind === 'kit' ? (K.HO.byId.get(rest) ? { type: 'kit', id: rest, variant, state } : null) : kind === 'store' ? { type: 'store', id: rest } : T.modelOf(K, key);
      if (!model) return { error: 'no model for ' + id };
      const t0 = performance.now();
      const sub = T.alone(K, model);
      if (!sub) return { error: 'draws nothing: ' + id };
      if (${el} !== null) sub.el = ${el} * Math.PI / 180;
      let tris = 0;
      sub.group.traverse(n => { if (n.isMesh && n.geometry) tris += (n.geometry.index ? n.geometry.index.count : n.geometry.attributes.position.count) / 3; });
      // (--shop: the shop's own picture, 2 × the size at 2× supersampling with its ink, then down to the size)
      const pic = ${shop} ? T.shrink(T.picture(sub, ${size} * 2, { ss: 2, ink: true }), ${size}) : T.picture(sub, ${size}, { ss: 4 });
      const ms = performance.now() - t0;
      let gameMs = null;
      if (${game}) {
        const runs = [];
        for (let k = 0; k < 3; k++) { const a = performance.now(); const s2 = T.alone(K, model); T.picture(s2, 128, { ss: 2 }); runs.push(performance.now() - a); s2.group.traverse(n => n.geometry?.dispose?.()); }
        gameMs = runs.sort((p, q) => p - q)[1];
      }
      if (!sub.keepGeo) sub.group.traverse(n => n.geometry?.dispose?.());
      const c = document.createElement('canvas');
      c.width = c.height = ${size};
      const g = c.getContext('2d');
      g.fillStyle = T.BONE;
      g.fillRect(0, 0, ${size}, ${size});
      g.drawImage(pic, 0, 0);
      let url = null, q = 0.92;
      for (; q >= 0.3; q -= 0.06) { url = c.toDataURL('image/webp', q); if (url.length * 0.75 < ${maxKb} * 1000) break; }
      return { url, q: +q.toFixed(2), tris, ms: +ms.toFixed(1), gameMs: gameMs && +gameMs.toFixed(1) };
    })()`, 300000);
    if (r.error) { console.log(`FAIL ${r.error}`); failed += 1; continue; }
    const buf = Buffer.from(r.url.split(',')[1], 'base64');
    const file = path.join(out, fileOf(id));
    writeFileSync(file, buf);
    stats[id] = { file: path.basename(file), tris: r.tris, ms: r.ms, gameMs: r.gameMs, bytes: buf.length, q: r.q };
    console.log(`saved ${file}  ${r.tris} tris  ${r.ms} ms${r.gameMs !== null ? `  game ${r.gameMs} ms` : ''}  ${(buf.length / 1000).toFixed(1)} KB`);
  }
  writeFileSync(path.join(out, `${prefix || 'tiles'}${prefix ? 'tiles' : ''}.json`), JSON.stringify(stats, null, 1));
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  console.log(`page errors ${bad.length}${bad.length ? `\n  ${[...new Set(bad)].slice(0, 8).join('\n  ').slice(0, 2000)}` : ''}`);
  if (bad.length) failed += 1;
} catch (err) {
  console.error(String(err?.stack ?? err));
  failed += 1;
} finally {
  await browser.close();
}
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
