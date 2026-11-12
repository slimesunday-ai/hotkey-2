#!/usr/bin/env node
// Fetches three.js once from the CDN into city/vendor/three/, so the page needs no network (SPEC section 24).
//
//   node demo/tools/vendor-three.mjs            fetch the pinned version and write city/vendor/three/MANIFEST.json
//   node demo/tools/vendor-three.mjs --check    compare the files on disk with the manifest's hashes
//
// It takes the module build and exactly the addons the city imports, then follows each file's own relative imports
// (the build's core file, an addon's shader or base class), so the set is closed. The layout is the package's own:
// build/… and examples/jsm/…, which is what the import map in demo/index.html points at.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** The version the pinned city was written against (its index.html's import map). Keep the two in step. */
const VERSION = '0.185.1';
const CDN = `https://cdn.jsdelivr.net/npm/three@${VERSION}/`;

/** What the city and the panels import by name (grep `three/addons/` over city/from-trunk and demo/hud). */
const ROOTS = [
  'build/three.module.js',
  'examples/jsm/controls/MapControls.js',
  'examples/jsm/controls/OrbitControls.js',
  'examples/jsm/environments/RoomEnvironment.js',
  'examples/jsm/postprocessing/EffectComposer.js',
  'examples/jsm/postprocessing/OutputPass.js',
  'examples/jsm/postprocessing/RenderPass.js',
  'examples/jsm/postprocessing/ShaderPass.js',
];

const DEST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'city', 'vendor', 'three');
const MANIFEST = path.join(DEST, 'MANIFEST.json');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

if (process.argv.includes('--check')) {
  if (!existsSync(MANIFEST)) {
    console.error('vendor-three: nothing vendored yet. Run this script without --check.');
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const bad = Object.entries(manifest.files).filter(([file, hash]) => !existsSync(path.join(DEST, file)) || sha256(readFileSync(path.join(DEST, file))) !== hash);
  if (bad.length) {
    console.error(`vendor-three: ${bad.length} file(s) differ from the manifest: ${bad.map(b => b[0]).join(', ')}`);
    process.exit(1);
  }
  console.log(`vendor-three: ${Object.keys(manifest.files).length} files match three@${manifest.version}`);
} else {
  const files = {};
  const queue = [...ROOTS];
  let bytes = 0;
  while (queue.length) {
    const file = queue.shift();
    if (files[file]) continue;
    const res = await fetch(CDN + file);
    if (!res.ok) throw new Error(`vendor-three: ${file}: HTTP ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    const target = path.join(DEST, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, body);
    files[file] = sha256(body);
    bytes += body.length;
    // a file's own relative imports come along; a bare `three` is the import map's business
    for (const m of body.toString('utf8').matchAll(/(?:from|import)\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])));
    }
  }
  const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(MANIFEST, JSON.stringify({ package: 'three', version: VERSION, source: CDN, licence: 'MIT', roots: ROOTS, bytes, files: sorted }, null, 1) + '\n');
  for (const [file, hash] of Object.entries(sorted)) console.log(`${hash.slice(0, 16)}…  ${file}`);
  console.log(`vendor-three: ${Object.keys(files).length} files, ${(bytes / 1e6).toFixed(2)} MB, three@${VERSION} into city/vendor/three/`);
}
