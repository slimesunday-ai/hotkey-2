#!/usr/bin/env node
// THE GAME AS A FOLDER OF FILES (phone-1, docs/phone.md): what the page needs and nothing else, for any plain static
// host, from the root or from a sub-folder.
//
//   node scripts/export-web.mjs --out <dir>      writes the folder (refuses a folder inside the repo, and empties
//                                                <dir> first only when it holds an export made by this script)
//   node scripts/export-web.mjs --stamp          writes sw-files.js in the repo itself, for a host that serves the
//                                                repo as it is pushed (GitHub's static hosting: docs/phone.md)
//   node scripts/export-web.mjs --check          says whether the repo's sw-files.js names the files as they are now
//                                                (exit 1 when it does not: make it again with --stamp before a push)
//   node scripts/export-web.mjs --list           prints the files, one a line
//
// WHAT GOES IN: the page (demo/ without its tools, the dev pages, the server or any paper), the rules (src/), the
// pinned city (city/from-trunk/) and three.js (city/vendor/three/), the service worker (sw.js) and its list
// (sw-files.js), and a front door (index.html: to the game). Only files git knows or would take (tracked, or new and
// not ignored), and of those only the kinds a page loads (scripts, styles, data, pictures, fonts). Never: docs/, test/,
// any tools/ folder (but demo/tools/item-tiles.js: the page draws its goods' tiles with it), *.md, *.py, the city's own pages (*.html but the game's), README, CLAUDE.md, AGENTS.md, SPEC.md,
// RUN.md, TUNING.md, PAYTABLE.md, LICENSE, package.json, scripts/, data/, city/overlay/.
// sw-files.js names every one of them with the first 16 hex of its SHA-256, and a version made from all of them: the
// service worker keeps a copy only when its bytes have that hash, and a new version is a new list.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
};
const has = name => process.argv.includes(name);

const KINDS = /\.(js|mjs|json|css|png|jpe?g|webp|gif|svg|woff2?|ttf|wasm|bin)$/i;
const IN = [/^demo\//, /^src\//, /^city\/from-trunk\//, /^city\/vendor\/three\//];
const OUT = [
  /(^|\/)tools\//, // every tools folder: the demo's, the city's own
  /^demo\/serve\.mjs$/,
  /^demo\/[^/]+-dev\.html$/,
  /^demo\/stage\/rides\/(shots|dev)\.(mjs|js)$/,
  /\.(md|py|diff|txt)$/i,
  /^demo\/shots\//,
  /^city\/vendor\/three\/MANIFEST\.json$/,
];
/** Files the page loads although they sit where tools do (demo/run/tiles.js draws the goods' tiles with the tool's own code). */
const KEEP = new Set(['demo/tools/item-tiles.js']);
/** The service worker's list: written here, never read in to make itself. */
export const LIST = 'sw-files.js';

/** Every file the page may load, relative to the repo, sorted. */
export function pageFiles() {
  const all = execFileSync('git', ['-C', ROOT, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8', maxBuffer: 64 << 20 })
    .split('\0').filter(Boolean);
  const files = all.filter(f => (KEEP.has(f) || (IN.some(r => r.test(f)) && KINDS.test(f) && !OUT.some(r => r.test(f)))) && existsSync(path.join(ROOT, f)));
  files.push('demo/index.html', 'sw.js');
  return [...new Set(files)].sort();
}

const hashOf = buf => createHash('sha256').update(buf).digest('hex').slice(0, 16);

/** The front door: a host's root (or the export's) sends the player on to the game. */
export const FRONT_DOOR = `<!doctype html>
<meta charset="utf-8">
<title>hotkey 2</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=demo/?mode=run">
<a href="demo/?mode=run">THE RUN</a>
`;

/** sw-files.js for these files (their bytes as `read` gives them). */
export function listOf(files, read) {
  const map = {};
  for (const f of files) map[f] = hashOf(read(f));
  map['index.html'] = hashOf(Buffer.from(FRONT_DOOR));
  const version = hashOf(Buffer.from(JSON.stringify(map)));
  return { version, map, text: `// made by scripts/export-web.mjs: every file the page may load, with the first 16 hex of its SHA-256 (sw.js keeps a\n// copy only when its bytes have that hash). Make it again before a push: node scripts/export-web.mjs --stamp\nself.HK2_FILES = ${JSON.stringify({ version, files: map }, null, 0).replace(/","/g, '",\n"')};\n` };
}

const read = f => readFileSync(path.join(ROOT, f));
const files = pageFiles();

if (has('--list')) {
  for (const f of files) console.log(f);
} else if (has('--check')) {
  const want = listOf(files, read).text;
  const got = existsSync(path.join(ROOT, LIST)) ? readFileSync(path.join(ROOT, LIST), 'utf8') : '';
  if (want === got) console.log(`export-web: ${LIST} is current (${files.length} files)`);
  else {
    console.log(`export-web: ${LIST} is OUT OF DATE: make it again with  node scripts/export-web.mjs --stamp`);
    process.exit(1);
  }
} else if (has('--stamp')) {
  const L = listOf(files, read);
  writeFileSync(path.join(ROOT, LIST), L.text);
  writeFileSync(path.join(ROOT, 'index.html'), FRONT_DOOR);
  if (!existsSync(path.join(ROOT, '.nojekyll'))) writeFileSync(path.join(ROOT, '.nojekyll'), '');
  console.log(`export-web: ${LIST} written (${files.length} files, version ${L.version}), and the front door index.html`);
} else if (opt('--out', null)) {
  const out = path.resolve(opt('--out'));
  if (out === ROOT || out.startsWith(ROOT + path.sep)) throw new Error('export-web: --out must be outside the repo');
  const MARK = '.hotkey2-export';
  if (existsSync(out) && readdirSync(out).length) {
    if (!existsSync(path.join(out, MARK))) throw new Error(`export-web: ${out} is not empty and is not an export of ours: give an empty or new folder`);
    for (const name of readdirSync(out)) rmSync(path.join(out, name), { recursive: true, force: true });
  }
  mkdirSync(out, { recursive: true });
  let bytes = 0;
  for (const f of files) {
    mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
    copyFileSync(path.join(ROOT, f), path.join(out, f));
    bytes += statSync(path.join(out, f)).size;
  }
  const L = listOf(files, read);
  writeFileSync(path.join(out, LIST), L.text);
  writeFileSync(path.join(out, 'index.html'), FRONT_DOOR);
  // GitHub's static hosting runs Jekyll over a folder unless it holds .nojekyll (Jekyll leaves out names starting _)
  writeFileSync(path.join(out, '.nojekyll'), '');
  writeFileSync(path.join(out, MARK), `${new Date().toISOString()}\n`);
  console.log(`export-web: ${files.length + 2} files, ${(bytes / 1e6).toFixed(1)} MB, to ${out} (version ${L.version})`);
} else {
  console.log('usage: node scripts/export-web.mjs --out <dir> | --stamp | --check | --list');
  process.exit(2);
}
