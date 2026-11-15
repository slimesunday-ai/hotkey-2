#!/usr/bin/env node
// THE CRIB'S STARTER LAYOUTS THROUGH THE CITY'S OWN HOMES CHECK. The run's crib (demo/stage/set/homes/*.json) is in
// the home kit's own assembly format, so the city's home builder could edit it; this runs the pinned kit's check.mjs
// on it, unmodified (city/from-trunk/style/city/interiors/home/check.mjs: geometry, the tier, the slots, the vacant set,
// the same rules.js the builder tests every move against). The kit's check registers trunk's sim2/node-hooks.mjs to
// stub `three`, which the pinned copy does not carry: the hook below stands in for it, and nothing else differs.
//
//   node demo/tools/crib-check.mjs            both starter layouts
//   node demo/tools/crib-check.mjs --map      and a top-down plan of each (0.25 m cells), owned and vacant
//   node demo/tools/crib-check.mjs a.json …   any layout file
// Exit code 1 on any error (the kit's own: warnings do not fail).
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, '../../city/from-trunk/style/city/interiors/home/check.mjs');
const HOMES = path.join(HERE, '../stage/set/homes');
const STUB = 'data:text/javascript,export default {}';
const THREE = `export async function resolve(s, c, n) { if (s === 'three' || s.startsWith('three/')) return { url: ${JSON.stringify(STUB)}, shortCircuit: true }; return n(s, c); }`;
const HOOKS = `export async function resolve(s, c, n) {
  if (s === 'three' || s.startsWith('three/')) return { url: ${JSON.stringify(STUB)}, shortCircuit: true };
  if (s.endsWith('/sim2/node-hooks.mjs')) return { url: ${JSON.stringify(`data:text/javascript,${encodeURIComponent(THREE)}`)}, shortCircuit: true };
  return n(s, c);
}`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const args = process.argv.slice(2);
const files = args.filter(a => !a.startsWith('--'));
const list = files.length ? files : ['trailer-starter.json', 'trailer-starter-b.json'].map(f => path.join(HOMES, f));
process.argv = [process.argv[0], KIT, ...list.map(f => path.resolve(f)), ...args.filter(a => a.startsWith('--'))];
await import(KIT);
