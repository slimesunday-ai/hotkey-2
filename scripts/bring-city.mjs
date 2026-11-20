#!/usr/bin/env node
// Fills city/from-trunk/ with the 3D city, copied from ONE pinned trunk commit (SPEC section 24, item 11).
//
//   node scripts/bring-city.mjs            copy the pinned commit (replaces city/from-trunk/)
//   node scripts/bring-city.mjs --check    compare the copy on disk with the pinned commit, file by file
//   node scripts/bring-city.mjs --trunk /path/to/trunk --pin <commit>
//
// Trunk is read-only. This script only ever runs `git -C <trunk> archive | rev-parse | ls-tree` there: it reads the
// COMMITTED tree, never the working files (trunk has uncommitted files that belong to the owner), and it never
// changes directory into trunk. The copy keeps trunk's relative layout, so the city's own `../../world/…` imports
// resolve inside city/from-trunk/ unchanged.
//
// The copy is never edited by hand. `--check` proves it: every file's git blob hash must equal the commit's.
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

/** The trunk commit this repo's city is pinned to. Change it here, run the script, then re-test the demo. */
const PIN = '36073f5bae35611e8d0e9867ac45e942708abc9b';   // (the original city's lane commit lane/K4-vhs: the walkers, 9cfd6788, plus the colour switch, its mix and band, rainbow, glitch and the tape look)

/** What the city page needs: the city itself, the world it imports, and the sim's place list its go-to menu reads. */
const INCLUDE = ['style/city', 'world', 'sim2/places.json'];

/** Left behind on purpose (city/FROM-TRUNK.md says why). `style/city/baked/` is not in git at all. */
const EXCLUDE = [
  'style/city/shots',
  'style/city/tools',
  'style/city/board-*.jpg',
  'style/city/render-presets-sheet.jpg',
];

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const DEST = path.join(REPO, 'city', 'from-trunk');
const STAMP = path.join(DEST, 'PIN.json');

function arg(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? null : process.argv[at + 1];
}

const trunk = arg('--trunk') ?? path.join(os.homedir(), 'Desktop', 'ai-city', 'trunk');
const pin = arg('--pin') ?? PIN;
// `git archive` understands exclude pathspecs; `git ls-tree` doesn't, so the file list is filtered here.
const pathspec = [...INCLUDE, ...EXCLUDE.map(p => `:(exclude)${p}`)];
const excluded = EXCLUDE.map(p => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '(/|$)'));

function git(...args) {
  return execFileSync('git', ['-C', trunk, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/** Every file of the pinned commit that the copy should hold: path → { hash, size }. */
function pinnedFiles(commit) {
  const out = new Map();
  for (const line of git('ls-tree', '-r', '-l', commit, '--', ...INCLUDE).split('\n')) {
    const m = /^\d+ blob ([0-9a-f]+)\s+(\d+)\t(.+)$/.exec(line);
    if (m && !excluded.some(re => re.test(m[3]))) out.set(m[3], { hash: m[1], size: +m[2] });
  }
  return out;
}

/** The hash git gives a file's bytes, so a copy can be checked against a commit without git seeing it. */
function blobHash(file) {
  const bytes = readFileSync(file);
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full));
  }
  return out;
}

function check(commit) {
  const want = pinnedFiles(commit);
  const have = new Set(walk(DEST).filter(f => f !== 'PIN.json' && !f.endsWith('.DS_Store')));
  const problems = [];
  for (const [file, { hash }] of want) {
    if (!have.has(file)) problems.push(`missing   ${file}`);
    else if (blobHash(path.join(DEST, file)) !== hash) problems.push(`changed   ${file}`);
    have.delete(file);
  }
  for (const file of have) problems.push(`extra     ${file}`);
  return { files: want.size, problems };
}

function archive(commit) {
  return new Promise((resolve, reject) => {
    const from = spawn('git', ['-C', trunk, 'archive', '--format=tar', commit, '--', ...pathspec], { stdio: ['ignore', 'pipe', 'inherit'] });
    const into = spawn('tar', ['-x', '-C', DEST], { stdio: ['pipe', 'inherit', 'inherit'] });
    from.stdout.pipe(into.stdin);
    let failed = null;
    from.on('error', reject);
    into.on('error', reject);
    from.on('close', code => {
      if (code !== 0) failed = new Error(`git archive exited ${code}`);
    });
    into.on('close', code => {
      if (failed) reject(failed);
      else if (code !== 0) reject(new Error(`tar exited ${code}`));
      else resolve();
    });
  });
}

const commit = git('rev-parse', '--verify', `${pin}^{commit}`).trim();

if (process.argv.includes('--check')) {
  if (!existsSync(DEST)) {
    console.error('bring-city: city/from-trunk/ is not there yet. Run this script without --check.');
    process.exit(1);
  }
  const { files, problems } = check(commit);
  if (problems.length) {
    console.error(`bring-city: the copy differs from trunk ${commit.slice(0, 7)} in ${problems.length} file(s):`);
    for (const line of problems.slice(0, 40)) console.error('  ' + line);
    process.exit(1);
  }
  console.log(`bring-city: ${files} files match trunk ${commit.slice(0, 7)}`);
} else {
  const when = git('log', '-1', '--format=%cI', commit).trim();
  rmSync(DEST, { recursive: true, force: true });
  mkdirSync(DEST, { recursive: true });
  await archive(commit);
  const { files, problems } = check(commit);
  if (problems.length) {
    console.error(`bring-city: the copy came out wrong (${problems.length} file(s)):`);
    for (const line of problems.slice(0, 40)) console.error('  ' + line);
    process.exit(1);
  }
  let bytes = 0;
  for (const { size } of pinnedFiles(commit).values()) bytes += size;
  const stamp = { source: 'trunk', commit, committed: when, include: INCLUDE, exclude: EXCLUDE, files, bytes };
  writeFileSync(STAMP, JSON.stringify(stamp, null, 1) + '\n');
  console.log(`bring-city: ${files} files, ${(bytes / 1e6).toFixed(1)} MB, from trunk ${commit.slice(0, 7)} (${when}) into city/from-trunk/`);
}
