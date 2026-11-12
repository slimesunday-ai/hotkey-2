#!/usr/bin/env node
// Re-reads the names of the 3D city's animation clips into data/city-clips.json (SPEC section 16, D61).
// It reads trunk's clip files as TEXT. It never imports, runs, edits or writes anything there: trunk is read-only.
// The scene-coverage test checks every action against this snapshot, so the engine can't ask for a clip the city lacks.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const trunk = process.argv[2] ?? path.join(os.homedir(), 'Desktop', 'ai-city', 'trunk');
const dir = path.join(trunk, 'style', 'city', 'anim', 'cast', 'clips');
const ENTRY = /\{\s*name:\s*'([a-z0-9_]+)'/g;

const names = new Set();
for (const file of readdirSync(dir).sort()) {
  if (!file.endsWith('.js') || file.endsWith('-props.js') || file === 'index.js') continue;
  const text = readFileSync(path.join(dir, file), 'utf8');
  for (const match of text.matchAll(ENTRY)) names.add(match[1]);
}

let commit = 'unknown';
try {
  commit = execFileSync('git', ['-C', trunk, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch {
  // not a git checkout: keep 'unknown'
}

const out = { source: 'trunk/style/city/anim/cast/clips', commit, count: names.size, clips: [...names].sort() };
const target = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'city-clips.json');
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(out, null, 1) + '\n');
console.log(`snapshot-clips: ${names.size} clips at trunk ${commit}`);
