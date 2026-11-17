#!/usr/bin/env node
// Pictures of TRUST ON THE PAGE (RUN.md trust-1; demo/run/index.js, panels.js, run.css): each moment staged with the
// page's own handles (`load`, `pick`, `panel`) and made with the real keys, as run-ui-shots.mjs does. The server must be
// running: node demo/serve.mjs
//
//   node demo/tools/run-trust-shots.mjs --out <dir> [--port 5470] [--seed 3] [--size 1869x882] [--only cards,people,...]
//
// The trailer park on day 2 at noon (seed 3), with trust set: Mrs. Alvarez +3 and Shaky Dee +2 (with you), a man at the
// bus stop −3 (against you, about this hour: won't deal with you, 2 days), Gloria +1, Benny Two-Coats −1. Saves
// <size>-<moment>.jpg:
//   cards        trust-card-with (the cigarettes picked: Dee with you, +$2), trust-card-tell (the wallet picked: the
//                chance the man calls it in, and Rob and Bins on the row with theirs)
//   people       trust-people (the character panel's People tab: every band, the meter, about now, the days off)
//   moves        trust-moves (the All moves panel: who would tell, with you)
//   told         trust-told (the wallet lifted with him about: he calls it in, the park's heat +2 on the top line),
//                trust-told-map (the map opened on it: the park's flag with the same +2)
//   failed       trust-told-failed (day 4: the lift goes wrong: the woman turns against you, and he calls it in)
//   quiet        trust-kept-quiet (day 5: it goes wrong in front of him and he keeps quiet: luck)
//   notice       trust-notice (day 4, Dee at the door at 0: shut on him, a grudge, the police round the park: the notice)
//   sore         trust-sore (the same at +3: he goes off sore, no grudge)
//   drift        trust-drift-report (a night with the man at −2: the night's report says he will deal with you again)
//   keys         no picture: C A S M open and close the panels, D folds the dock, F the bar; the bar's height
// With each: the bar's height and what the moment's own pieces say, read off the page.
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-trust'));
const port = opt('--port', 5470);
const seed = opt('--seed', '3');
const [W, H] = opt('--size', '1869x882').split('x').map(Number);
const size = `${W}x${H}`;
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${seed}`;
const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);
mkdirSync(out, { recursive: true });

const loadExpr = fields => `(async () => {
  const h = window.__demo.hud;
  const s = structuredClone(h.state);
  const f = ${JSON.stringify(fields)};
  Object.assign(s, f, { owned: { ...s.owned, ...(f.owned ?? {}) } });
  s.books.earned += (s.carried + s.banked) - (h.state.carried + h.state.banked);
  return await h.load(s);
})()`;
const SAY = `(() => {
  const q = s => document.querySelector(s), t = s => q(s)?.textContent.trim() ?? null, card = q('.rn-card');
  return {
    bar: card ? Math.round(card.getBoundingClientRect().height) : null,
    marks: [...document.querySelectorAll('.rn-card .rn-trust')].map(e => e.textContent),
    tells: [...document.querySelectorAll('.rn-card .rn-tell, .rn-card .rn-tell-pct')].map(e => e.textContent),
    result: t('.rn-result'), chips: [...document.querySelectorAll('.rn-tchip')].map(e => e.textContent),
    rose: [...document.querySelectorAll('.rn-stop-rose')].map(e => e.parentElement.textContent),
    notice: q('.rn-notice') && !q('.rn-notice').hidden ? t('.rn-notice') : null,
  };
})()`;

const PARK = { place: 'park', day: 2, hour: 12, hoursThere: 0, banked: 40, carried: 8, energy: 5, heat: 0, people: {}, owned: { cutter: true },
  shifts: { park: 0, market: 0 }, placeHeat: {}, regulars: { 'npc:buyer:projects:1': 2 },
  trust: { 'npc:neighbour': 3, 'npc:buyer:projects:1': 2, 'npc:mark:projects': -3, 'npc:neighbour:3': 1, 'npc:debtor': -1 } };
const DOOR = t => ({ place: 'crib', day: 4, hour: 9, banked: 20, carried: 0, energy: 6, heat: 0, people: {}, placeHeat: {},
  regulars: { 'npc:buyer:projects:1': 4 }, trust: { 'npc:buyer:projects:1': t },
  door: { id: 'npc:buyer:projects:1', name: 'Shaky Dee', role: 'buyer', place: 'park', wants: 11 } });

const browser = await launch({ width: W, height: H });
let page = null;
try {
  page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 240000);
  await page.evaluate('window.__demo.stage.actors.audit(true)');
  await page.sleep(2500);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const key = k => ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);
  const phase = p => page.waitFor(`window.__demo.hud.phase === ${JSON.stringify(p)}`, 120000, 100);
  const load = async fields => {
    await phase('choose');
    if (!(await ev(loadExpr(fields)))) throw new Error('the run would not load the state');
    await page.sleep(2500);
  };
  const shot = async (name, wait = 1200) => {
    await page.sleep(wait);
    const said = await ev(SAY);
    console.log(`saved ${await page.shot(path.join(out, `${size}-${name}.jpg`))} · ${JSON.stringify(said)}`);
  };
  const pickJob = id => ev(`(h => h.pick(h.view.options.find(o => o.id === ${JSON.stringify(id)}).key))(window.__demo.hud)`);
  const go = async () => {
    await key('Enter');
    await phase('playing');
    await phase('choose');
  };
  await ev('window.__demo.hud.fold(true)');
  await ev('window.__demo.hud.bar(false)');

  if (want('cards')) {
    await load(PARK);
    console.log(`  dealt ${await ev('JSON.stringify(window.__demo.hud.view.options.map(o => [o.id, o.who && o.who.name, o.withPay, o.tellRisk && o.tellRisk.pct]))')}`);
    await pickJob('loosies');
    await shot('trust-card-with', 800);
    await pickJob('wallet');
    await shot('trust-card-tell', 800);
  }
  if (want('people')) {
    await load(PARK);
    await ev('window.__demo.hud.panel("character")');
    await ev(`document.querySelector('.rn-sheet .k-tab#k-tab-people')?.click()`);
    await shot('trust-people', 1200);
    await ev('window.__demo.hud.panel(null)');
  }
  if (want('moves')) {
    await load(PARK);
    await key('g');
    await shot('trust-moves', 800);
    await key('g');
  }
  if (want('told')) {
    await load(PARK);
    await pickJob('wallet');
    await go();
    await shot('trust-told', 900);
    // (the same heat on the map's flag for the park, while what just happened is said)
    await key('m');
    await page.waitFor('window.__demo.hud.map.ready', 30000, 100).catch(() => console.log('  (the map was not up in 30 s)'));
    await shot('trust-told-map', 1200);
    console.log(`  the park's flag: ${await ev(`document.querySelector('.rn-flag[data-stop="park"]')?.textContent ?? null`)}`);
    await key('m');
  }
  if (want('failed')) {
    // (day 4, noon: the lift goes wrong, the woman turns against you, and the man calls it in)
    await load({ ...PARK, day: 4, hour: 12 });
    await pickJob('wallet');
    await go();
    await shot('trust-told-failed', 900);
  }
  if (want('quiet')) {
    // (day 5, ten: the lift goes wrong and he is watching, but keeps quiet: luck)
    await load({ ...PARK, day: 5, hour: 10 });
    await pickJob('wallet');
    await go();
    await shot('trust-kept-quiet', 900);
  }
  if (want('notice')) {
    await load(DOOR(0));
    // (ui-3, leg 2: at your door, 2 shuts it: X's old job)
    await key('2');
    await go();
    await shot('trust-notice', 900);
  }
  if (want('sore')) {
    await load(DOOR(3));
    await key('2');
    await go();
    await shot('trust-sore', 900);
  }
  if (want('drift')) {
    // (a night with the man at the bus stop at −2: in the morning he will deal with you again, said in the report)
    await load({ place: 'crib', day: 2, hour: 22, banked: 40, carried: 0, energy: 1, heat: 0, people: {}, placeHeat: {}, door: null, trust: { 'npc:mark:projects': -2, 'npc:neighbour': 3 } });
    await ev(`(h => h.pick(h.view.moves.find(m => m.choice.do === 'sleep').key))(window.__demo.hud)`);
    await key('Enter');
    await phase('report');
    await shot('trust-drift-report', 1500);
    console.log(`  report: ${await ev(`document.querySelector('.rn-report .is-trust')?.textContent ?? null`)}`);
    await key('Enter');
  }
  if (want('keys')) {
    await load(PARK);
    const sheet = () => ev(`(s => s.hidden ? null : s.dataset.sheet)(document.querySelector('.rn-sheet'))`);
    const said = [];
    // (ui-3, leg 2: C You, G Guide, O Stuff, M Map; N folds your numbers, D's old job; W A S D are never the run's)
    for (const [k, id] of [['c', 'character'], ['g', 'moves'], ['o', 'stuff'], ['m', 'map']]) {
      await key(k);
      await page.sleep(400);
      const open = await sheet();
      await key(k);
      await page.sleep(300);
      said.push(`${k.toUpperCase()} ${open === id && (await sheet()) === null ? 'opens and closes' : `FAILED (${open})`}`);
    }
    const rail = () => ev(`document.querySelector('.u-stats')?.classList.contains('is-folded') ?? null`);
    const r0 = await rail();
    await key('n');
    await page.sleep(300);
    const r1 = await rail();
    await key('n');
    await page.sleep(300);
    said.push(`N ${r0 !== r1 && (await rail()) === r0 ? 'folds and opens your numbers' : 'FAILED'}`);
    const wasd = [];
    for (const k of ['w', 'a', 's', 'd']) {
      const before = await sheet();
      await key(k);
      await page.sleep(200);
      if ((await sheet()) !== before) wasd.push(k);
    }
    said.push(`W A S D ${wasd.length ? `FAILED (${wasd.join(' ')})` : 'do nothing'}`);
    const folded = () => ev(`document.querySelector('.rn-card').classList.contains('is-folded')`);
    const f0 = await folded();
    await key('f');
    await page.sleep(300);
    const f1 = await folded();
    await key('f');
    await page.sleep(300);
    said.push(`F ${f0 !== f1 && (await folded()) === f0 ? 'folds and opens the bar' : 'FAILED'}`);
    // (the bar's height with trust's pieces on it, and with them hidden: the same if they took no room of their own)
    const barH = () => ev(`Math.round(document.querySelector('.rn-card').getBoundingClientRect().height)`);
    const withTrust = await barH();
    await ev(`document.head.append(Object.assign(document.createElement('style'), { id: 'no-trust', textContent: '.rn-card .rn-trust, .rn-card .rn-tell, .rn-card .rn-tell-pct { display: none !important; }' }))`);
    await page.sleep(300);
    const without = await barH();
    await ev(`document.getElementById('no-trust').remove()`);
    said.push(`bar ${withTrust} px (${without} px with trust's pieces hidden)`);
    console.log(`keys: ${said.join(' · ')}`);
  }
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]|\[run\]|\[inside\]/.test(l));
  console.log(bad.length ? `page errors ${bad.length}:\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}` : 'page errors 0');
  console.log('audit', JSON.stringify(await ev(`(a => a && { overlaps: a.overlaps, furniture: a.furniture, vanish: a.vanish, feet: a.feet, heads: a.heads })(window.__demo.stage.actors.audit())`)));
} catch (err) {
  console.error(String(err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-10).join('\n').slice(0, 2500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
