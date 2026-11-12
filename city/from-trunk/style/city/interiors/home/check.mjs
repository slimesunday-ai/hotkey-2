// AI City · home layouts · THE HOMES CHECK (hardening pass, 2026-10-05; grown from layout-check.mjs, which now just runs this). Every preset
// room in assemblies/ (FORMAT.md "Assemblies"), owned and vacant, read against the catalogue and the sim's rules:
//   geometry   every item id exists; nothing overlapping, floating, off the floor or through the ceiling; surface pieces on their surface;
//              art not hidden; the door not blocked and its swing clear; a walkable path from the door to the bed and the seats
//   the tier   a bed sized to the tier (trailer and apartment: mattress or double · house: double · penthouse: platform), somewhere to
//              sit, a kitchen piece (a house: a fridge; a house or penthouse: somewhere to eat), and the dressing that makes the tier read
//              at a glance (rugs, wall art, lived-in pieces: the minimums climb with the tier)
//   the sim    a stash spot (a slot whose fits take a stash piece: the sim keeps every home's stash) and room for the safe and the dog
//              (room.js spot() must find free floor for the tier's safe and a dog bed, unless a slot holds them)
//   slots      2–4, each with a unique id, fits (kinds or categories), a demo that exists, fits them and fits the slot
//   vacant     trailer · apartment · house carry a `vacant` item list (room.js builds it for an empty FOR RENT home): the door and windows
//              where the owned layout has them, a bare mattress, moving boxes and the FOR RENT board, nothing to sit at; the same pieces
//              across a tier (only where they stand differs)
//   node style/city/interiors/home/check.mjs [layout …] [--map]      --map prints a top-down plan per room (0.25 m cells), owned and vacant
//   node style/city/interiors/home/check.mjs path/to/home.json   a layout file (the home builder's Export, or a saved home) checked the same way
//   The rules live in rules.js (2026-10-06), shared with the home builder's live validity test.
//   mainland   (2026-10-06) the Mainland's house-kit layouts (mainland-<style>.json): the house + penthouse catalogues, 3–6 slots, richer
//              dressing, never vacant; their partition walls and car bays (room.built) are solid like any floor piece
// Exit code 1 on any error (warnings don't fail). Pure node: three is stubbed by sim2/node-hooks.mjs like the smoke test.
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../../..'), DIR = path.join(HERE, 'assemblies');
register(pathToFileURL(path.join(ROOT, 'sim2/node-hooks.mjs')).href);
const { byId, OBJECTS, CATS } = await import('./index.js');
const args = process.argv.slice(2), MAP = args.includes('--map'), names = args.filter(a => !a.startsWith('--'));
const { makeRules, rectOf } = await import('./rules.js');   // (the rules themselves live in rules.js: the home builder runs the same ones live)
const { geometry, tierCheck, vacantCheck } = makeRules({ byId, OBJECTS, CATS });

function plan({ A, LIST, solid, floorSlots, doorRect, seen }) {
  const R = A.room, G = Array.from({ length: R.d }, () => Array(R.w).fill(' ')), key = [], L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  LIST.forEach((it, k) => { const o = byId.get(it.id); if (o?.cat !== 'rugs' || it.on !== 'floor') return; const [x0, z0, w, d] = rectOf(it.x, it.z, o.foot, it.rot);
    for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) if (G[z]?.[x] !== undefined) G[z][x] = '~'; });
  for (const key2 of seen) { const [x, z] = key2.split(',').map(Number); for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (G[z + b]?.[x + a] === ' ') G[z + b][x + a] = '·'; }
  solid.forEach((p, n) => { const ch = L[n % 26]; key.push(`${ch} ${p.id}`); for (const [x, z, over] of p.cells) if (G[z]?.[x] !== undefined) G[z][x] = over ? ch.toLowerCase() : ch; });
  floorSlots.forEach(q => { for (let x = q.rc[0]; x < q.rc[0] + q.rc[2]; x++) for (let z = q.rc[1]; z < q.rc[1] + q.rc[3]; z++) if (G[z]?.[x] !== undefined) G[z][x] = '#'; });
  if (doorRect) for (let x = doorRect[0]; x < doorRect[0] + doorRect[2]; x++) for (let z = doorRect[1]; z < doorRect[1] + doorRect[3]; z++) if (G[z][x] === ' ' || G[z][x] === '·') G[z][x] = 'd';
  console.log('   ' + '▔'.repeat(R.w) + '  N wall (back)'); G.forEach((row, z) => console.log(String(z).padStart(2) + '▕' + row.join('') + '▏' + (z === 0 ? ' E' : '')));
  console.log('   (open front)  ~ rug · walkable · d door swing # floor slot'); console.log('   ' + key.join(' · '));
}


const list = names.length ? names : JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
let bad = 0; const tierSets = {};
// (a .json argument is a file path: a saved or exported home from the home builder)
for (const n of list) { const A = JSON.parse(fs.readFileSync(n.endsWith('.json') ? path.resolve(n) : path.join(DIR, n + '.json'), 'utf8')), r = geometry(A); tierCheck(A, r); vacantCheck(A, r, tierSets);
  const v = Array.isArray(A.vacant) ? geometry(A, 'vacant') : null; if (v) { r.E.push(...v.E.map(e => 'vacant: ' + e)); r.W.push(...v.W.map(e => 'vacant: ' + e)); }
  bad += r.E.length; console.log(`${r.E.length ? '✗' : '✓'} ${n}: ${r.E.length} errors, ${r.W.length} warnings · ${A.items.length} pieces, ${A.slots.length} slots${v ? `, vacant ${A.vacant.length}` : ''}`);
  for (const e of r.E) console.log('   ✗ ' + e); for (const w of r.W) console.log('   · ' + w); if (MAP) { plan(r); if (v) { console.log('   vacant:'); plan(v); } } }
// consistent per tier: every vacant set of a tier holds the same pieces (only where they stand differs)
if (!names.length) for (const [t, m] of Object.entries(tierSets)) if (new Set(m.values()).size > 1) { bad++; console.log(`✗ ${t}: the vacant sets differ\n` + [...m].map(([k, s]) => `   ${k}: ${s}`).join('\n')); }
console.log(bad ? `✗ ${bad} error(s)` : `✓ all ${list.length} layouts pass, owned and vacant`);
process.exit(bad ? 1 : 0);
