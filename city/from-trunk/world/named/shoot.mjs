// THE NAMED CAST · the review pictures, drawn headless through the preview page (look.html) with the city's own Chrome driver
// (style/city/studio/audit/chrome.mjs). For each named person: today (how the game dresses them now) and now (their own pieces):
//   <key>-todayC.webp  <key>-todayG.png      close, and at the game's size
//   <key>-nowC.webp    <key>-nowW.webp  <key>-nowG.png   close, whole (fixed scale), and at the game's size
// plus sizes.json (each figure's height in pixels at the game's camera).
//   node world/named/shoot.mjs --port <p> --out <dir> [--only lou,hook]     (a server on the port: node style/serve.mjs <p>)
// A PROP (index.js § PROPS) with its owner: --prop <owner or prop key> writes <key>-prop-*.jpg (look.js propPictures: the game's
// camera by day and night, pushing it four ways round, walking and parked; four close-ups; side on; the contact sheet) and
// <key>-prop.json (the scale it was shot at, the owner's height there).
//   node world/named/shoot.mjs --port <p> --out <dir> --prop cart [--debug-port <p>] [--pid-file <file>]
import fs from 'node:fs';
import path from 'node:path';
import { open } from '../../style/city/studio/audit/chrome.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const PORT = Number(arg('--port', 0)), OUT = path.resolve(arg('--out', '')), ONLY = arg('--only', null)?.split(','), PROP = arg('--prop', null);
const CHROME = { debugPort: Number(arg('--debug-port', 0)), pidFile: arg('--pid-file', null) };
if (!PORT || !arg('--out')) { console.error('usage: node world/named/shoot.mjs --port <p> --out <dir> [--only a,b] [--prop <name>] [--debug-port <p>] [--pid-file <f>]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

// HOW THE GAME DRESSES EACH ONE TODAY (as the casting sheet recorded it: the stage rolls a person from the seed 'npc:<name>' in the pool
// their role gives and lays pieces over it; the eight not in the game yet are rolled the way the game would roll them)
const npc = name => ({ seed: `npc:${name}`, pool: 'npc' });
export const TODAY = {
  alvarez: npc('Mrs. Alvarez'), pruitt: npc('Mr. Pruitt'), gloria: npc('Gloria'), teague: npc('Mr. Teague'), dee: npc('Shaky Dee'), benny: npc('Benny Two-Coats'),
  earl: { seed: 'npc:Cousin Earl', pool: 'agent', wear: { top: 'dock_vest', hat: 'dockhand_beanie' } }, darlene: npc('Darlene'),
  dutch: { seed: 'npc:Dutch', pool: 'agent', wear: { hat: 'corner_rag', top: 'corner_hoodie' } }, hook: npc('Hook Mahoney'),
  pell: { seed: 'npc:Officer Dana Pell', pool: 'npc', outfit: 'officer' }, ambrose: npc('Mr. Ambrose'), haines: npc('Mr. Haines'), rosa: npc('Rosa'), lou: npc('Big Lou'),
  // the second nineteen (a stallholder wears the shopkeepers' deli apron over the roll; the fights' own looks for Big Moss and the hires)
  moss: { seed: 'fight:boss', pool: 'agent', wear: { top: 'dock_vest', hat: 'corner_rag', eyewear: 'precinct_aviators' } }, tiny: npc('Tiny'),
  lookout: { seed: 'run:lookout:2', pool: 'agent', wear: { top: 'old_opus_snorkel', hat: 'commissary_skully', acc: 'beeper' } },
  runner: { seed: 'fight:runner:1', pool: 'agent', wear: { top: 'old_hoodie', hat: 'old_bandana' } },
  muscle: { seed: 'run:muscle', pool: 'agent', wear: { top: 'ribbed_tank', hat: 'silk_durag', eyewear: 'getaway_wraps', acc: 'nameplate_ring', bottom: 'blackout_cargo' } },
  bao: { ...npc('Mrs. Bao'), wear: { top: 'npc_top_deli_apron' } }, ferraro: { ...npc('Mr. Ferraro'), wear: { top: 'npc_top_deli_apron' } },
  okafor: { ...npc('Mr. Okafor'), wear: { top: 'npc_top_deli_apron' } }, kowalski: { ...npc('Mrs. Kowalski'), wear: { top: 'npc_top_deli_apron' } },
  lola: npc('Lola'), pockets: npc('Pockets'), cart: npc('a man with a shopping cart'), teo: { seed: 'npc:Teo', pool: 'npc', wear: { top: 'old_hoodie', hat: 'old_bandana' } },
  nadia: npc('Nadia Petrakis'), tommy: npc('Tommy Gaffney'), vic: npc('Vic Amato'), booker: npc('Mr. Booker'), slim: npc('Slim'), frankie: npc('Frankie'),
};
const save = (name, url) => { const b = Buffer.from(url.split(',')[1], 'base64'); fs.writeFileSync(path.join(OUT, name), b); return b.length; };
const P = await open(`http://127.0.0.1:${PORT}/world/named/look.html?quiet`, { title: 'named-ready', timeout: 120000, ...CHROME });
const sizes = {};
if (PROP) try {
  const r = await P.ev(`JSON.stringify(window.__named.propPictures(${JSON.stringify(PROP)}))`).then(JSON.parse);
  for (const [f, u] of Object.entries(r.files)) console.log(`${f}: ${(save(f, u) / 1024).toFixed(0)} KB`);
  fs.writeFileSync(path.join(OUT, `${PROP}-prop.json`), JSON.stringify({ ppm70: r.ppm70, ownerPxAt46: r.h46 }, null, 1));
  console.log(`shot at ${r.ppm70} px a metre (the owner ${r.h46} px tall at 46)`);
} catch (e) { console.error(e); process.exitCode = 1; } finally { await P.close(); process.exit(process.exitCode ?? 0); }
try {
  const probs = await P.ev('JSON.stringify([window.__named.problems, window.__named.selfCheck])');
  console.log('pool problems / self-check:', probs);
  const keys = await P.ev('window.__named.people');
  for (const key of keys) { if (ONLY && !ONLY.includes(key)) continue;
    const now = await P.ev(`JSON.stringify(window.__named.pictures({ named: ${JSON.stringify(key)} }))`).then(JSON.parse);
    const tod = await P.ev(`JSON.stringify(window.__named.pictures(${JSON.stringify(TODAY[key])}, ['close', 'game']))`).then(JSON.parse);
    save(`${key}-nowC.webp`, now.close); save(`${key}-nowW.webp`, now.whole); save(`${key}-nowG.png`, now.game);
    save(`${key}-todayC.webp`, tod.close); save(`${key}-todayG.png`, tod.game);
    sizes[key] = { now: now.gamePx, today: tod.gamePx };
    console.log(`${key}: game size ${now.gamePx} px (today ${tod.gamePx} px)`);
  }
  fs.writeFileSync(path.join(OUT, 'sizes.json'), JSON.stringify(sizes, null, 1));
} finally { await P.close(); }
process.exit(0);
