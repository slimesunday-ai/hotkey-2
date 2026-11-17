#!/usr/bin/env node
// Pictures of THE RUN SAVED, COUSIN EARL BY THE STRETCH and ARRANGE ON THE DOCK (RUN.md "Saving", "Cousin Earl by the
// stretch"; demo/run/index.js, save.js, panels.js). The page is the plain play link with the save on (no runtest), and
// every moment is a real state of the run: the rules' own scripted players are played here in node until the step that
// brings it, and the page is handed the state (`load`, which the page saves as the run), then reloaded or pressed with
// its real keys and clicks, as run-home-shots.mjs does. The server must be running: node demo/serve.mjs
//
//   node demo/tools/run-save-shots.mjs --out <dir> [--port 5661] [--size 1568x740] [--only save,earl,arrange,casing]
//
// Saves <size>-<moment>.jpg:
//   save     save-mark (the top line's mark, at the crib), save-picked-up (reloaded at the flea market: picked up, its
//            line), save-picked-up-notice (reloaded with somebody at your door: the line on the notice), save-new-ask
//            (NEW RUN pressed once: what it ends), save-refused (a save of an older build in the slot, reloaded)
//   earl     earl-off (the crib, Earl not on: hire him), earl-on (the crib after hiring him: his days left, nothing to
//            press), earl-home-slip (the HOME slip with his days left), earl-last-day (the crib on his last day: keep
//            him), earl-stuff (the Stuff panel's Earl on his last day), earl-gone-report (the morning his days are up)
//   arrange  arrange-crib (at the crib, Arrange with the panel keys), arrange-open (pressed: arranging), arrange-door
//            (a regular at the door: greyed, with why), arrange-park (in the trailer park: no Arrange), arrange-dock-open
//            (the dock open at the crib)
//   casing   casing-earl-a/b/c (the morning somebody cases the trailer while Earl is on the step), casing-earl-card
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, newRun, view, step, saveRun } from '../../src/run/index.mjs';
import { POLICIES, decide } from '../../src/run/policies.mjs';
import { fullEnergy } from '../../src/run/rules.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-save'));
const port = opt('--port', 5661);
const [W, H] = opt('--size', '1568x740').split('x').map(Number);
const size = `${W}x${H}`;
const base = `http://127.0.0.1:${port}/demo/?mode=run&seed=8`;
const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);
mkdirSync(out, { recursive: true });

const PLAYERS = {
  guard: { ...POLICIES.homeFirst(120), defend: 'guard', buy: true },
  lean: { ...POLICIES.park, regular: 'lean', buy: true },
};
function play(name, seed, kit = {}, days = 6) {
  let s = newRun({ seed, cfg });
  s.owned = { ...s.owned, ...kit };
  s.energy = fullEnergy(cfg, s);
  const steps = [];
  for (let n = 0; s.day <= days && n < 3000; n++) {
    const c = decide(cfg, s, PLAYERS[name], view(cfg, s));
    let { state, events } = step(cfg, s, c);
    steps.push({ before: s, choice: c, events, after: state });
    if ((c.do === 'subway' && c.to === 'park' && state.place === 'park') || (['walk', 'skate', 'onward'].includes(c.do) && state.place === 'park' && !state.route)) state = step(cfg, state, { do: 'inside' }).state;
    s = state;
  }
  return steps;
}
const firstOf = (steps, test) => steps.find(test) ?? null;
const keyOf = (state, choice) => view(cfg, state).choices.find(c => JSON.stringify(c.choice) === JSON.stringify(choice) || (c.choice.do === choice.do && c.choice.to === choice.to && c.choice.id === choice.id && c.choice.on === choice.on && !!c.choice.hop === !!choice.hop))?.key ?? null;

const SAY = `(() => {
  const q = s => document.querySelector(s), t = s => q(s)?.textContent.replace(/\\s+/g, ' ').trim() ?? null;
  const top = q('.rn-top'), r = top?.getBoundingClientRect();
  // (the top line's pieces: any cut (wider than shown) or over another)
  const kids = [...(top?.children ?? [])].filter(e => e.getBoundingClientRect().width > 0);
  const cut = kids.filter(e => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > r.right + 0.5).map(e => e.className);
  const over = [];
  for (let i = 1; i < kids.length; i++) if (kids[i].getBoundingClientRect().left < kids[i - 1].getBoundingClientRect().right - 0.5) over.push(kids[i - 1].className + ' / ' + kids[i].className);
  const keys = [...document.querySelectorAll('.rn-keys .rn-key')].map(e => ({ t: e.textContent.replace(/\\s+/g, ' ').trim(), off: e.classList.contains('is-off'), title: e.title, bottom: Math.round(e.getBoundingClientRect().bottom) }));
  const dock = q('.rn-dock')?.getBoundingClientRect();
  return {
    phase: window.__demo.hud.phase, place: window.__demo.hud.state.place, day: window.__demo.hud.state.day, hour: window.__demo.hud.state.hour, saved: window.__demo.hud.saved,
    top: t('.rn-top'), topCut: cut, topOver: over, notice: q('.rn-notice:not([hidden])') ? t('.rn-notice') : null, ask: q('.rn-new-ask:not([hidden])') ? t('.rn-new-ask') : null,
    alert: q('.rn-alert:not([hidden])') ? t('.rn-alert') : null, slip: q('.rn-home-print:not([hidden])') ? t('.rn-home-print') : null, overlay: t('.hk-overlay'),
    moves: [...document.querySelectorAll('.rn-card .u-verb')].map(e => e.textContent.replace(/\\s+/g, ' ').trim() + (e.title ? ' {' + e.title + '}' : '')),
    keys, dockBottom: dock ? Math.round(dock.bottom) : null, window: innerHeight, arranging: document.querySelector('.rn')?.classList.contains('is-arranging') ?? false,
  };
})()`;

const browser = await launch({ width: W, height: H });
let page = null;
const said = {};
try {
  page = await browser.open(`${base}&new=1`);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const ready = async () => {
    await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 240000);
    await page.sleep(2000);
  };
  await ready();
  const key = k => ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);
  const phase = (p, ms = 120000) => page.waitFor(`window.__demo.hud.phase === ${JSON.stringify(p)}`, ms, 100);
  const overlayUp = (ms = 60000) => page.waitFor(`!!document.querySelector('.hk-overlay.is-on')`, ms, 100);
  const load = async state => {
    await phase('choose');
    if (!(await ev(`window.__demo.hud.load(${JSON.stringify(state)})`, 60000))) throw new Error('the run would not load the state');
    await page.sleep(2500);
  };
  const reload = async (link = base) => {
    await page.send('Page.navigate', { url: link });
    await page.sleep(1500);
    await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase', 240000);
    await phase('choose', 240000);
    await page.sleep(2500);
    await ev('window.__demo.hud.fold(true)');
    await ev('window.__demo.hud.bar(false)');
  };
  const shot = async (name, wait = 800) => {
    await page.sleep(wait);
    said[name] = await ev(SAY);
    const s = said[name];
    console.log(`saved ${await page.shot(path.join(out, `${size}-${name}.jpg`))} · ${s.phase} at ${s.place}, day ${s.day} ${s.hour}:00${s.topCut.length || s.topOver.length ? ` · TOP LINE: cut ${s.topCut.join(', ') || 'none'}, over ${s.topOver.join(', ') || 'none'}` : ''}`);
  };
  await ev('window.__demo.hud.fold(true)');
  await ev('window.__demo.hud.bar(false)');

  const guard8 = play('guard', 8);
  if (want('save')) {
    const crib = firstOf(guard8, r => r.before.place === 'crib' && r.before.day === 2);
    await load(crib.before);
    await shot('save-mark', 1200);
    const market = firstOf(guard8, r => r.before.place === 'market' && r.before.day >= 2 && !view(cfg, r.before).home?.notice);
    await load(market.before);
    await reload();
    await shot('save-picked-up', 1200);
    await page.evaluate(`document.querySelector('.rn-new').click()`);
    await shot('save-new-ask', 600);
    await page.sleep(6500);
    const notice = firstOf(guard8, r => !!view(cfg, r.before).home?.notice);
    await load(notice.before);
    await reload();
    await shot('save-picked-up-notice', 1200);
    // (a save of the build before save-1: the rules' state version 7, refused)
    const old = JSON.parse(saveRun(market.before));
    old.v = 7;
    old.state.v = 7;
    await ev(`localStorage.setItem('hk2.run.save', ${JSON.stringify(JSON.stringify({ kind: 'the-run-page', v: 1, at: { day: market.before.day, hour: market.before.hour }, run: JSON.stringify(old), page: {} }))})`);
    await reload();
    await shot('save-refused', 1500);
    said.refusedKept = await ev(`!!localStorage.getItem('hk2.run.save.refused')`);
    console.log(`  the refused save kept under its own key: ${said.refusedKept}`);
  }
  if (want('earl')) {
    const hire = firstOf(guard8, r => r.choice.do === 'guard');
    await load(hire.before);
    await shot('earl-off', 1000);
    await load(hire.after);
    await shot('earl-on', 1000);
    await ev('window.__demo.hud.home(true)');
    await ev(`document.querySelector('.rn-home-print .rn-hp-guard')?.scrollIntoView({ block: 'center' })`);
    await shot('earl-home-slip', 900);
    await ev('window.__demo.hud.home(false)');
    const last = firstOf(guard8, r => r.before.place === 'crib' && view(cfg, r.before).home?.defences?.guard?.lastDay);
    if (last) {
      await load(last.before);
      await shot('earl-last-day', 1000);
      await ev(`window.__demo.hud.panel('stuff')`);
      await ev(`document.querySelector('.rn-sheet .rn-defences')?.scrollIntoView({ block: 'start' })`);
      await shot('earl-stuff', 900);
      await ev(`window.__demo.hud.panel(null)`);
    } else console.log('  no crib hour on his last day in this run');
    const gone = firstOf(guard8, r => r.events.some(e => e.type === 'guard' && !e.on && e.why === 'done'));
    if (gone) {
      await load(gone.before);
      await ev(`window.__demo.hud.pick(${JSON.stringify(keyOf(gone.before, gone.choice))})`);
      await key('Enter');
      await overlayUp(120000);
      await shot('earl-gone-report', 1200);
      await key('Enter');
      await phase('choose', 120000);
      await shot('earl-gone-top', 1500);
    } else console.log('  his days are never up in this run');
  }
  if (want('arrange')) {
    const crib = firstOf(guard8, r => r.before.place === 'crib' && r.before.day === 2);
    await load(crib.before);
    await shot('arrange-crib', 1000);
    await page.evaluate(`document.querySelector('.rn-key-arrange').click()`);
    await shot('arrange-open', 1500);
    await key('Escape');
    await page.sleep(1500);
    await ev('window.__demo.hud.fold(false)');
    await shot('arrange-dock-open', 1000);
    await ev('window.__demo.hud.fold(true)');
    const park = firstOf(guard8, r => r.before.place === 'park');
    await load(park.before);
    await shot('arrange-park', 1000);
    // (a regular at the door: the lean seller of the trailer park, seed 1)
    let s = newRun({ seed: 1, cfg });
    for (let n = 0; n < 400 && !(s.door && s.place === 'crib'); n++) s = step(cfg, s, decide(cfg, s, PLAYERS.lean, view(cfg, s))).state;
    await load(s);
    await page.sleep(4000);
    await shot('arrange-door', 1000);
  }
  if (want('casing')) {
    // (the morning somebody cases the trailer while Cousin Earl is on the step: the guard's run, the night before)
    const r = firstOf(guard8, x => x.events.some(e => e.type === 'casing') && view(cfg, x.after).home?.defences?.guard?.on);
    if (r) {
      await load(r.before);
      await ev(`window.__demo.hud.pick(${JSON.stringify(keyOf(r.before, r.choice))})`);
      await key('Enter');
      await overlayUp(120000);
      await page.sleep(1000);
      await key('Enter');
      const t1 = Date.now();
      for (const [n, at] of [['a', 3], ['b', 6], ['c', 7.5], ['d', 9]]) {
        await page.sleep(Math.max(0, at * 1000 - (Date.now() - t1)));
        if (await ev(`!!document.querySelector('.hk-overlay.is-on')`)) break;
        await shot(`casing-earl-${n}`, 0);
        said[`casing-earl-${n}`].shotCam = await ev('(() => { const d = window.__demo.stage.inside.debug?.(); return { cam: window.__demo.stage.camera?.state?.()?.on ?? null, door: d?.doorShot ?? null }; })()').catch(() => null);
      }
      await overlayUp(120000);
      await shot('casing-earl-card', 900);
      await key('Enter');
      await phase('choose', 120000);
    } else console.log('  no casing while Earl is on in this run');
  }
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]|\[run\]|\[inside\]/.test(l));
  console.log(bad.length ? `page errors:\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}` : 'page errors: 0');
} catch (err) {
  console.error(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(out, `${size}-said.json`), JSON.stringify(said, null, 1));
  await browser.close();
}
