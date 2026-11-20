// THE SERVER LETS THE BROWSER KEEP ITS COPY, AND NEVER SERVES IT STALE (smooth-1, demo/serve.mjs): every file with
// `Cache-Control: no-cache` and an ETag; asked again with it, an unchanged file is a 304 with no body; a file changed in
// any way, even to the same size in the same second, even with its modification time put back, even replaced by
// another file (a `git checkout` in place while the server runs), is sent whole and new.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, renameSync, rmSync, statSync, utimesSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { server } from '../demo/serve.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = path.join(ROOT, 'test', `tmp-serve-${process.pid}`);
const FILE = path.join(DIR, 'a.js');
const URL_PATH = `/test/tmp-serve-${process.pid}/a.js`;

test('a file is kept by the browser and asked again; any change to it is sent new', async () => {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, 'window.v = "AAAA";\n');
  // (an ephemeral port of the machine's own choosing, on this machine only: never one of the reserved ones)
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (headers = {}) => fetch(base + URL_PATH, { headers }).then(async r => ({ status: r.status, etag: r.headers.get('etag'), last: r.headers.get('last-modified'), cache: r.headers.get('cache-control'), body: await r.text() }));
  try {
    const a = await get();
    assert.equal(a.status, 200);
    assert.equal(a.body, 'window.v = "AAAA";\n');
    assert.equal(a.cache, 'no-cache');
    assert.ok(a.etag && a.last, 'an ETag and a Last-Modified');
    // asked again with its ETag: a 304, nothing sent
    const a2 = await get({ 'If-None-Match': a.etag, 'If-Modified-Since': a.last });
    assert.equal(a2.status, 304);
    assert.equal(a2.body, '');
    assert.equal(a2.etag, a.etag);
    // THE CONTENT CHANGED, THE SAME SIZE, AT ONCE (the same second): sent new
    writeFileSync(FILE, 'window.v = "BBBB";\n');
    const b = await get({ 'If-None-Match': a.etag, 'If-Modified-Since': a.last });
    assert.equal(b.status, 200, 'a change of the same size in the same second is sent');
    assert.equal(b.body, 'window.v = "BBBB";\n');
    assert.notEqual(b.etag, a.etag);
    // ... and with its modification time put back as it was (a tool that keeps times): sent new all the same
    const t0 = statSync(FILE);
    writeFileSync(FILE, 'window.v = "CCCC";\n');
    utimesSync(FILE, t0.atime, t0.mtime);
    const c = await get({ 'If-None-Match': b.etag, 'If-Modified-Since': b.last });
    assert.equal(c.status, 200, 'a change with the time put back is sent');
    assert.equal(c.body, 'window.v = "CCCC";\n');
    // ... and replaced by another file of the same size, as a checkout may write it (a new file renamed over it)
    writeFileSync(`${FILE}.new`, 'window.v = "DDDD";\n');
    renameSync(`${FILE}.new`, FILE);
    const d = await get({ 'If-None-Match': c.etag });
    assert.equal(d.status, 200);
    assert.equal(d.body, 'window.v = "DDDD";\n');
    // unchanged since: a 304 again; a HEAD says the same
    assert.equal((await get({ 'If-None-Match': d.etag })).status, 304);
    const head = await fetch(base + URL_PATH, { method: 'HEAD', headers: { 'If-None-Match': d.etag } });
    assert.equal(head.status, 304);
    // If-Modified-Since alone: only a whole second after the file was written is it a 304
    assert.equal((await get({ 'If-Modified-Since': d.last })).status, 200, 'the same second as the file: sent');
    assert.equal((await get({ 'If-Modified-Since': new Date(Date.parse(d.last) + 2000).toUTCString() })).status, 304);
    // a wrong ETag wins over a date that would have been fresh: sent
    assert.equal((await get({ 'If-None-Match': '"nope"', 'If-Modified-Since': new Date(Date.now() + 60000).toUTCString() })).status, 200);
    // what is not a file is never kept
    const miss = await fetch(`${base}/test/tmp-serve-${process.pid}/none.js`);
    assert.equal(miss.status, 404);
    assert.equal(miss.headers.get('cache-control'), 'no-store');
  } finally {
    await new Promise(r => server.close(r));
    rmSync(DIR, { recursive: true, force: true });
  }
});
