#!/usr/bin/env node
// The demo's static server (SPEC section 24). Zero dependencies. It serves the whole repo, so the demo page at
// /demo/ can load the copied city at /city/from-trunk/style/city/ with the city's own relative imports and workers.
//
//   node demo/serve.mjs                 http://127.0.0.1:5470/demo/
//   node demo/serve.mjs --port 5471     another port (5470 to 5479 are ours)
//   node demo/serve.mjs --quiet         don't print misses
//   node demo/serve.mjs --overlay       last night's narrowed streets (city/overlay/) in front of the pinned city.
//                                       OFF by default since the big-city branch: the game plays on the city as pinned
//   node demo/serve.mjs --fast          (phone-1) AS A STATIC HOST SERVES IT: every text file gzipped (made once per
//                                       version of the file, kept in memory) and kept by the browser ten minutes
//                                       without asking (`Cache-Control: max-age=600`, the figure GitHub's static
//                                       hosting is known to send; with its ETag after that). NOT for developing: an
//                                       edit can take ten minutes to show. docs/phone.md
//   node demo/serve.mjs --root <dir> --at /hotkey-2/
//                                       (phone-1) serves another folder (an export: scripts/export-web.mjs) under a
//                                       sub-path, the way a static host serves a project from a sub-folder; anything
//                                       outside the sub-path is a 404. With --fast or without
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
import { stat, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

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
const PINNED = '/city/from-trunk/';
/** A sub-path as `/a/b/` (or `/`). */
const atOf = a => `/${String(a).replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');

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

// (phone-1) the gzipped copies of --fast, by file and its validator (a changed file is a new key; the old one is dropped)
const COMPRESS = /^(text\/|application\/(json|javascript)|image\/svg)/;
const zipped = new Map();
async function gzipped(file, etag) {
  const kept = zipped.get(file);
  if (kept && kept.etag === etag) return kept.body;
  const body = gzipSync(await readFile(file), { level: 9 });
  zipped.set(file, { etag, body });
  return body;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

/**
 * The server, not yet listening. `root`: the folder served (the repo by default); `at`: the sub-path it is served
 * under ('/'); `fast`: as a static host serves it (gzipped, kept ten minutes); `overlay`, `quiet`: as on the command
 * line. (phone-1: made a function so a test can make each kind; run as a script, the command line's.)
 */
export function makeServer({ root = REPO, at = '/', fast = false, overlay = false, quiet = false } = {}) {
  const ROOT = path.resolve(root);
  const AT = atOf(at);
  const FAST = fast;
  /** The file a request path names, or null when it points outside the folder (or the sub-path) or at a dot file. */
  function resolve(urlPath) {
    // (phone-1: under a sub-path, only what is inside it is served; it is the folder's root)
    if (AT !== '/') {
      if (!urlPath.startsWith(AT)) return null;
      urlPath = urlPath.slice(AT.length - 1);
    }
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
  return http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'GET and HEAD only\n', { Allow: 'GET, HEAD' });
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/' || url.pathname === AT) return send(res, 302, '', { Location: `${AT}demo/` });
    // (outside the sub-path there is nothing, as on a static host)
    if (AT !== '/' && !url.pathname.startsWith(AT)) return send(res, 404, 'not found\n');
    let file = resolve(url.pathname);
    if (!file) return send(res, 403, 'not served\n');
    // THE OVERLAY: an adapted copy in city/overlay/ stands in front of the pinned city's file of the same path.
    // city/from-trunk/ itself is never edited; city/overlay/adapt.py makes every file there from the pinned one.
    if (overlay && url.pathname.startsWith(PINNED)) {
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
      const kept = { 'Cache-Control': FAST ? 'max-age=600' : 'no-cache', ETag: etag, 'Last-Modified': new Date(mtimeMs).toUTCString(), ...(FAST ? { Vary: 'Accept-Encoding' } : {}) };
      if (fresh(req, etag, mtimeMs)) {
        res.writeHead(304, kept);
        return res.end();
      }
      // (phone-1) fast: a text file goes out gzipped when the browser takes it, made once per version of the file
      if (FAST && COMPRESS.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
        const body = await gzipped(file, etag);
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': String(body.length), 'Content-Encoding': 'gzip', ...kept });
        return res.end(req.method === 'HEAD' ? undefined : body);
      }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': String(info.size), ...kept });
      if (req.method === 'HEAD') return res.end();
      createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch {
      if (!quiet) console.log(`404 ${url.pathname}`);
      send(res, 404, 'not found\n');
    }
  });
}

// the command line's server: --root and --at (phone-1), --fast (phone-1), --overlay, --quiet
const OPTS = {
  root: arg('--root', null) ? path.resolve(arg('--root')) : REPO,
  at: arg('--at', '/'),
  fast: process.argv.includes('--fast'),
  overlay: process.argv.includes('--overlay'),
  quiet: process.argv.includes('--quiet'),
};
const server = makeServer(OPTS);

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
    if (OPTS.root !== REPO || OPTS.fast || atOf(OPTS.at) !== '/') console.log(`serve: http://127.0.0.1:${port}${atOf(OPTS.at)}demo/   (${OPTS.root === REPO ? 'the repo' : OPTS.root}${OPTS.fast ? ', as a static host serves it: gzipped, kept 10 minutes' : ''})`);
    else console.log(`serve: http://127.0.0.1:${port}/demo/   (the city alone: /city/from-trunk/style/city/?nobake=1)`);
  });
}
