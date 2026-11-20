#!/usr/bin/env node
// The demo's static server (SPEC section 24). Zero dependencies. It serves the whole repo, so the demo page at
// /demo/ can load the copied city at /city/from-trunk/style/city/ with the city's own relative imports and workers.
//
//   node demo/serve.mjs                 http://127.0.0.1:5470/demo/
//   node demo/serve.mjs --port 5471     another port (5470 to 5479 are ours)
//   node demo/serve.mjs --quiet         don't print misses
//   node demo/serve.mjs --overlay       last night's narrowed streets (city/overlay/) in front of the pinned city.
//                                       OFF by default since the big-city branch: the game plays on the city as pinned
//
// It listens on this machine only (127.0.0.1) and reads files and nothing else. Files whose name starts with a dot, and
// anything outside the repo, are never served.
// THE BROWSER KEEPS ITS COPY, AND ASKS EVERY TIME (smooth-1, docs/perf/2026-11-18-audit.md fix 9): every file goes out
// with `Cache-Control: no-cache` and a validator, so the browser keeps the file and the code it compiled from it, and
// asks again on every load: an unchanged file is a 304 with no body, a changed one is sent whole. The ETag is the
// file's size, its modification time and its change time (to the nanosecond) and its inode: any write to the file
// changes the change time, which nothing can set back, so an edit, or a `git checkout` of another version in place
// while this server runs, is never answered from the old copy, even one of the same size in the same second.
// If-None-Match is the answer when it is sent; If-Modified-Since alone only when the file is a whole second older.
import http from 'node:http';
import { createReadStream, realpathSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The types a browser insists on: a module script or a worker with the wrong type is refused. */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.bin': 'application/octet-stream',
};

function arg(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}

const port = Number(arg('--port', process.env.PORT ?? 5470));
const quiet = process.argv.includes('--quiet');
// the big city plays on the pinned city as it is; --overlay puts the 3×3 set's narrowed streets back (to measure against)
const OVERLAY = process.argv.includes('--overlay');
const PINNED = '/city/from-trunk/';

/** The file a request path names, or null when it points outside the repo or at a dot file. */
function resolve(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const file = path.normalize(path.join(ROOT, decoded));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return null;
  if (path.relative(ROOT, file).split(path.sep).some(part => part.startsWith('.'))) return null;
  return file;
}

/** The validator of a file as it is now (stat with bigint: nanoseconds). Any write to it changes it. */
export const etagOf = info => `"${info.size.toString(36)}-${info.mtimeNs.toString(36)}-${info.ctimeNs.toString(36)}-${info.ino.toString(36)}"`;

/**
 * Whether the browser's copy is the file as it is now: If-None-Match names this ETag (it wins when sent); else
 * If-Modified-Since is a whole second after the file was last written (an edit in the same second is never missed).
 */
export function fresh(req, etag, mtimeMs) {
  const inm = req.headers['if-none-match'];
  if (inm) return inm.split(',').map(t => t.trim().replace(/^W\//, '')).some(t => t === etag || t === '*');
  const ims = Date.parse(req.headers['if-modified-since'] ?? '');
  return Number.isFinite(ims) && Math.floor(mtimeMs / 1000) * 1000 < ims;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'GET and HEAD only\n', { Allow: 'GET, HEAD' });
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/') return send(res, 302, '', { Location: '/demo/' });
  let file = resolve(url.pathname);
  if (!file) return send(res, 403, 'not served\n');
  // THE OVERLAY: an adapted copy in city/overlay/ stands in front of the pinned city's file of the same path.
  // city/from-trunk/ itself is never edited; city/overlay/adapt.py makes every file there from the pinned one.
  if (OVERLAY && url.pathname.startsWith(PINNED)) {
    const over = resolve('/city/overlay/' + url.pathname.slice(PINNED.length));
    if (over && await stat(over).then(i => i.isFile(), () => false)) file = over;
  }
  try {
    let info = await stat(file, { bigint: true });
    if (info.isDirectory()) {
      // a folder without its closing slash would resolve the page's relative imports one level too high
      if (!url.pathname.endsWith('/')) return send(res, 302, '', { Location: url.pathname + '/' + url.search });
      file = path.join(file, 'index.html');
      info = await stat(file, { bigint: true });
    }
    const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    const etag = etagOf(info);
    const mtimeMs = Number(info.mtimeNs / 1000000n);
    const kept = { 'Cache-Control': 'no-cache', ETag: etag, 'Last-Modified': new Date(mtimeMs).toUTCString() };
    if (fresh(req, etag, mtimeMs)) {
      res.writeHead(304, kept);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': String(info.size), ...kept });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).on('error', () => res.destroy()).pipe(res);
  } catch {
    if (!quiet) console.log(`404 ${url.pathname}`);
    send(res, 404, 'not found\n');
  }
});

export { server };

// (run as a script it listens; imported, by a test, it is the server not yet listening)
const main = (() => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (main) {
  server.on('error', err => {
    console.error(err.code === 'EADDRINUSE' ? `serve: port ${port} is taken. Try --port 5471.` : `serve: ${err.message}`);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`serve: http://127.0.0.1:${port}/demo/   (the city alone: /city/from-trunk/style/city/?nobake=1)`);
  });
}
