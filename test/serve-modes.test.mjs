// THE SERVER'S TWO NEW WAYS (phone-1, demo/serve.mjs), and its old way untouched: the default keeps `no-cache` and
// sends files as they are; `fast` gzips text and lets the browser keep a file ten minutes, as a static host does; a
// folder served under a sub-path answers only inside it, from that folder, with the sub-path's own front door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeServer, server as defaultServer } from '../demo/serve.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = path.join(ROOT, 'test', `tmp-modes-${process.pid}`);
const TEXT = 'export const x = "' + 'abc'.repeat(400) + '";\n';

/** A raw GET (node's fetch would undo the gzip): status, headers, body bytes. */
function get(port, p, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: p, headers }, res => {
      const parts = [];
      res.on('data', d => parts.push(d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(parts) }));
    }).on('error', reject);
  });
}
const listen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));
const close = s => new Promise(r => s.close(r));

test('the default server is as it was: no-cache, sent as it is, never gzipped', async () => {
  mkdirSync(path.join(DIR, 'demo'), { recursive: true });
  writeFileSync(path.join(DIR, 'demo', 'a.js'), TEXT);
  const port = await listen(defaultServer);
  try {
    const r = await get(port, `/test/tmp-modes-${process.pid}/demo/a.js`, { 'Accept-Encoding': 'gzip, br' });
    assert.equal(r.status, 200);
    assert.equal(r.headers['cache-control'], 'no-cache');
    assert.equal(r.headers['content-encoding'], undefined);
    assert.equal(r.body.toString(), TEXT);
    assert.equal((await get(port, '/')).headers.location, '/demo/');
  } finally {
    await close(defaultServer);
  }
});

test('fast: text gzipped when asked for, kept ten minutes, with its validator; not gzipped when not asked', async () => {
  mkdirSync(path.join(DIR, 'demo'), { recursive: true });
  writeFileSync(path.join(DIR, 'demo', 'a.js'), TEXT);
  const s = makeServer({ root: DIR, fast: true, quiet: true });
  const port = await listen(s);
  try {
    const r = await get(port, '/demo/a.js', { 'Accept-Encoding': 'gzip, deflate, br' });
    assert.equal(r.status, 200);
    assert.equal(r.headers['content-encoding'], 'gzip');
    assert.equal(r.headers['cache-control'], 'max-age=600');
    assert.match(r.headers['content-type'], /^text\/javascript/);
    assert.ok(r.body.length < TEXT.length / 4, 'smaller');
    assert.equal(gunzipSync(r.body).toString(), TEXT);
    assert.equal((await get(port, '/demo/a.js', { 'If-None-Match': r.headers.etag })).status, 304);
    const plain = await get(port, '/demo/a.js');
    assert.equal(plain.headers['content-encoding'], undefined);
    assert.equal(plain.body.toString(), TEXT);
    // an edit is a new version, gzipped anew
    writeFileSync(path.join(DIR, 'demo', 'a.js'), TEXT.replace('abc', 'xyz'));
    const r2 = await get(port, '/demo/a.js', { 'Accept-Encoding': 'gzip', 'If-None-Match': r.headers.etag });
    assert.equal(r2.status, 200);
    assert.equal(gunzipSync(r2.body).toString(), TEXT.replace('abc', 'xyz'));
  } finally {
    await close(s);
  }
});

test('a folder under a sub-path: served inside it, nothing outside it, its front door to its demo/', async () => {
  mkdirSync(path.join(DIR, 'demo'), { recursive: true });
  writeFileSync(path.join(DIR, 'demo', 'a.js'), TEXT);
  writeFileSync(path.join(DIR, 'demo', 'index.html'), '<!doctype html>hi');
  const s = makeServer({ root: DIR, at: '/hotkey-2/', quiet: true });
  const port = await listen(s);
  try {
    assert.equal((await get(port, '/hotkey-2/demo/a.js')).body.toString(), TEXT);
    assert.equal((await get(port, '/hotkey-2/demo/')).body.toString(), '<!doctype html>hi');
    assert.equal((await get(port, '/hotkey-2/demo')).headers.location, '/hotkey-2/demo/');
    assert.equal((await get(port, '/hotkey-2/')).headers.location, '/hotkey-2/demo/');
    assert.equal((await get(port, '/')).headers.location, '/hotkey-2/demo/');
    assert.equal((await get(port, '/demo/a.js')).status, 404, 'outside the sub-path: nothing');
    assert.equal((await get(port, '/hotkey-2/../package.json')).status, 404);
    assert.notEqual((await get(port, '/hotkey-2/%2e%2e/package.json')).status, 200);
    const post = await new Promise(r => http.request({ host: '127.0.0.1', port, path: '/hotkey-2/demo/a.js', method: 'POST' }, r).end());
    assert.equal(post.statusCode, 405);
  } finally {
    await close(s);
    rmSync(DIR, { recursive: true, force: true });
  }
});
