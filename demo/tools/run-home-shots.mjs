#!/usr/bin/env node
// Pictures of HOME PRESSURE ON THE PAGE (RUN.md "Home pressure (home-1)"; demo/run/index.js, panels.js, acted.js,
// scenes.js). Every moment is a REAL state of the run: the rules' own scripted players (src/run/policies.mjs, the
// home-first one ignoring it, with Cousin Earl, racing home) are played here in node until the step that brings it, and
// the page is handed the state just before that step (`load`) and made to take it with the real keys and clicks, as
// run-route-shots.mjs does. Nothing is rigged. The server must be running: node demo/serve.mjs
//
//   node demo/tools/run-home-shots.mjs --out <dir> [--port 5631] [--size 1568x740] [--only meter,casing,...]
//
// Saves <size>-<moment>.jpg (the moments, by --only):
//   meter    home-meter-reasons (the trailer park, the dock open, the meter's slip open: what holds it up, what brings
//            it down, what it leads to), home-park-option-pressure (the same hour, the slip shut, an option picked:
//            its "home +1"), home-stuff-defences (the Stuff panel there: the deadbolt sold here, the floor safe, Earl)
//   casing   home-casing-a/b (the morning: somebody casing the trailer, mid-scene), home-warning-card, and the warning
//            standing on the top line after (home-warning-standing)
//   notice   home-notice-market (at the flea market, the notice with the ways home), home-met-at-door-a/b/c (home in
//            time: the fight at the door)
//   guard    home-guard-put-on (Earl put on the step, mid-scene), home-guard-on-step (stepping out: him on the step),
//            home-guard-facing-them-a/b (home in time with him on: him on the step facing them)
//   gotin    home-notice-got-in (at the flea market: they got in), home-coming-home-after-a/b/c (home: the door, the
//            floorboard), home-after-card
//   safe     home-floor-safe-room (the crib with the floor safe in it)
// With each: what the moment's own pieces say, and each scene's seconds from Go to the next choice at 1x.
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, newRun, view, step } from '../../src/run/index.mjs';
import { POLICIES, decide } from '../../src/run/policies.mjs';
import { fullEnergy } from '../../src/run/rules.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-home'));
const port = opt('--port', 5631);
const [W, H] = opt('--size', '1568x740').split('x').map(Number);
const size = `${W}x${H}`;
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=8`;
const only = opt('--only', null)?.split(',') ?? null;
const want = name => !only || only.includes(name);
mkdirSync(out, { recursive: true });

// ── THE RUN IN NODE: the rules' players, step by step, as the page plays them (home, all the way in: index.js act) ──
const PLAYERS = {
  ignore: { ...POLICIES.homeFirst(120), buy: true },
  guard: { ...POLICIES.homeFirst(120), defend: 'guard', buy: true },
  racer: { ...POLICIES.homeFirst(120), race: true, buy: true },
};
function play(name, seed, kit = {}, days = 5) {
  let s = newRun({ seed, cfg });
  s.owned = { ...s.owned, ...kit };
  s.energy = fullEnergy(cfg, s);
  const steps = [];
  for (let n = 0; s.day <= days && n < 3000; n++) {
    const c = decide(cfg, s, PLAYERS[name], view(cfg, s));
    let { state, events } = step(cfg, s, c);
    steps.push({ before: s, choice: c, events });
    if ((c.do === 'subway' && c.to === 'park' && state.place === 'park') || (['walk', 'skate', 'onward'].includes(c.do) && state.place === 'park' && !state.route)) state = step(cfg, state, { do: 'inside' }).state;
    s = state;
  }
  return steps;
}
/** The first step of a run whose events have one that passes `test`: { before, choice, events }. */
const firstOf = (steps, test) => steps.find(r => r.events.some(test)) ?? null;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** The key of a choice in the view of a state (the numbers the bar answers to). */
const keyOf = (state, choice) => view(cfg, state).choices.find(c => same(c.choice, choice) || (c.choice.do === choice.do && c.choice.to === choice.to && c.choice.id === choice.id && c.choice.on === choice.on && !!c.choice.hop === !!choice.hop && c.choice.item === choice.item))?.key ?? null;

const SAY = `(() => {
  const q = s => document.querySelector(s), t = s => q(s)?.textContent.replace(/\\s+/g, ' ').trim() ?? null;
  return {
    phase: window.__demo.hud.phase, place: window.__demo.hud.state.place, day: window.__demo.hud.state.day, hour: window.__demo.hud.state.hour,
    meter: t('.rn-press'), warn: t('.rn-warn'), alert: q('.rn-alert:not([hidden])') ? t('.rn-alert') : null, slip: q('.rn-home-print:not([hidden])') ? t('.rn-home-print') : null,
    overlay: t('.hk-overlay'), said: t('.rn-said'),
    options: [...document.querySelectorAll('.rn-card .u-card')].map(e => e.textContent.replace(/\\s+/g, ' ').trim()),
    moves: [...document.querySelectorAll('.rn-card .u-verb')].map(e => e.textContent.replace(/\\s+/g, ' ').trim()),
  };
})()`;

const browser = await launch({ width: W, height: H });
let page = null;
const said = {};
const scenes = [];
try {
  page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 240000);
  await page.evaluate('window.__demo.stage.actors.audit(true)');
  await page.sleep(2500);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const key = k => ev(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);
  const phase = (p, ms = 120000) => page.waitFor(`window.__demo.hud.phase === ${JSON.stringify(p)}`, ms, 100);
  const overlayUp = (ms = 60000) => page.waitFor(`!!document.querySelector('.hk-overlay.is-on')`, ms, 100);
  const load = async state => {
    await phase('choose');
    if (!(await ev(`window.__demo.hud.load(${JSON.stringify(state)})`, 60000))) throw new Error('the run would not load the state');
    await page.sleep(2500);
  };
  const shot = async (name, wait = 800) => {
    await page.sleep(wait);
    said[name] = await ev(SAY);
    console.log(`saved ${await page.shot(path.join(out, `${size}-${name}.jpg`))} · ${said[name].phase} at ${said[name].place}, day ${said[name].day} ${said[name].hour}:00`);
  };
  /** Takes one choice by its key (picked, then Enter); pictures at seconds in; the seconds until the next choice. */
  /** Seconds until the player stands within `r` metres of his own door (the stage's own pad), or null. */
  const atDoor = (r = 2.5, ms = 90000) => page.waitFor(`(() => { const A = window.__demo.stage.actors, d = window.__demo.stage.map?.PADS?.a1?.door; if (!d || !A.has('a1')) return false; const p = A.get('a1'); return !p.w?.hide && Math.hypot(p.x - d[0], p.z - d[1]) < ${r}; })()`, ms, 100).then(() => true, () => false);
  const go = async (name, k, { more = [], until = 'choose', press = [], door = [] } = {}) => {
    const t0 = Date.now();
    await ev(`window.__demo.hud.pick(${JSON.stringify(String(k))})`);
    await key('Enter');
    await phase('playing', 10000).catch(() => {});
    for (const [p, s] of more) {
      await page.sleep(Math.max(0, s * 1000 - (Date.now() - t0)));
      said[p] = await ev(SAY);
      console.log(`saved ${await page.shot(path.join(out, `${size}-${p}.jpg`))} · ${s} s in`);
    }
    // (`door`: pictures at seconds after he reaches his own door, and the scene's length from there)
    if (door.length && (await atDoor())) {
      const td = Date.now();
      scenes.push({ scene: `${name}: Go to his door`, seconds: +((td - t0) / 1000).toFixed(1) });
      for (const [p, s] of door) {
        await page.sleep(Math.max(0, s * 1000 - (Date.now() - td)));
        said[p] = await ev(SAY);
        console.log(`saved ${await page.shot(path.join(out, `${size}-${p}.jpg`))} · ${s} s after the door`);
      }
    }
    // (a card on the way: pictured, then put away with Enter, as a player would)
    for (const [p, at] of press) {
      await overlayUp(120000);
      const s = +((Date.now() - t0) / 1000).toFixed(1);
      scenes.push({ scene: `${name}: to the card`, seconds: s });
      console.log(`  ${name}: ${s} s to the card`);
      if (p) await shot(p, at ?? 900);
      await key('Enter');
      await page.sleep(400);
    }
    if (until) await phase(until, 180000);
    const s = +((Date.now() - t0) / 1000).toFixed(1);
    scenes.push({ scene: name, seconds: s });
    console.log(`  ${name}: ${s} s from Go to the next choice`);
    return s;
  };
  await ev('window.__demo.hud.fold(true)');
  await ev('window.__demo.hud.bar(false)');
  // NOBODY IN ANYBODY AT THE DOOR: every tenth of a second, the distance between each two people standing within 6 m of
  // the player's door (the trailer's own, the place table's) (on stage, not hidden), the smallest kept per pair with where and in which scene. A pair with a
  // step between them in a scene of a fight or a hand-over (a contact on purpose: the door's fight, Earl's, his wage
  // handed over, and the walk up to it) is not counted while that scene plays; anyone else in it is. The stage's own audit counts heads, and bodies only against the city's people
  await ev(`(() => {
    const st = window.__demo.stage, A = st.actors, d = st.map.BLOCKS.projects.spots['home:a1:door'], playing = new Map();
    const TOUCH = new Set(['shove', 'haymaker', 'scuffle', 'hand_off', 'punch', 'grab', 'walk']);
    st.director.on((what, sc) => { if (what === 'start') playing.set(sc, sc.kind); else if (what === 'end') playing.delete(sc); });
    window.__near = {};
    setInterval(() => {
      const ppl = A.all().filter(p => !p.w?.hide && Math.hypot(p.x - d[0], p.z - d[1]) < 6);
      const kinds = [...playing.values()];
      for (let i = 0; i < ppl.length; i++) for (let j = i + 1; j < ppl.length; j++) {
        const [a, b] = [ppl[i], ppl[j]];
        const contact = [...playing.keys()].some(sc => /^run:(raid|guard:on)/.test(sc.kind) && (sc.steps ?? []).some(q => q.target && TOUCH.has(q.action) && ((q.actor === a.id && q.target === b.id) || (q.actor === b.id && q.target === a.id))));
        if (contact) continue;
        const key = [a.id, b.id].sort().join(' | ');
        const dist = Math.hypot(a.x - b.x, a.z - b.z);
        const rec = (window.__near[key] ??= { min: 99 });
        if (dist < rec.min) Object.assign(rec, { min: +dist.toFixed(2), at: [+a.x.toFixed(1), +a.z.toFixed(1)], scenes: kinds.join(',') || 'none', day: window.__demo.hud.state.day, hour: window.__demo.hud.state.hour });
      }
    }, 100);
  })()`);

  const guard8 = play('guard', 8);
  const racer8 = play('racer', 8);
  const ignore8 = play('ignore', 8, { bed: true });

  if (want('meter')) {
    // (the trailer park, the pressure up and the options its crimes: the first such hour of the guard's run)
    const at = guard8.find(r => r.before.place === 'park' && (view(cfg, r.before).pressure?.value ?? 0) >= 3 && view(cfg, r.before).options.some(o => o.pressure && o.pressure.ifWin > 0));
    if (!at) throw new Error('no park hour with the pressure up');
    await load(at.before);
    await ev('window.__demo.hud.fold(false)');
    await ev('window.__demo.hud.home(true)');
    await shot('home-meter-reasons', 1200);
    await ev('window.__demo.hud.home(false)');
    const crime = view(cfg, at.before).options.find(o => o.pressure && o.pressure.ifWin > 0);
    await ev(`window.__demo.hud.pick(${JSON.stringify(crime.key)})`);
    await shot('home-park-option-pressure', 900);
    await ev(`window.__demo.hud.panel('stuff')`);
    await ev(`document.querySelector('.rn-sheet .rn-defences')?.scrollIntoView({ block: 'start' })`);
    await shot('home-stuff-defences', 900);
    await ev(`window.__demo.hud.panel(null)`);
    await ev('window.__demo.hud.fold(true)');
  }
  const audit = async what => console.log(`  audit after ${what}: ${JSON.stringify(await ev(`(a => a && { overlaps: a.overlaps, furniture: a.furniture, vanish: a.vanish, feet: a.feet, heads: a.heads })(window.__demo.stage.actors.audit())`))}`);
  await audit('meter');
  if (want('casing')) {
    // (the night before somebody is seen casing the crib: sleep, the day's report, the morning at the trailer)
    const r = firstOf(guard8, e => e.type === 'casing');
    await load(r.before);
    const t0 = Date.now();
    await ev(`window.__demo.hud.pick(${JSON.stringify(keyOf(r.before, r.choice))})`);
    await key('Enter');
    await overlayUp(120000);
    await page.sleep(1200);
    await key('Enter'); // (the day's report put away)
    const t1 = Date.now();
    console.log(`  the report up after ${((t1 - t0) / 1000).toFixed(1)} s`);
    for (const [n, at] of [['a', 3], ['b', 6], ['c', 7.5], ['d', 9]]) {
      await page.sleep(Math.max(0, at * 1000 - (Date.now() - t1)));
      if (await ev(`!!document.querySelector('.hk-overlay.is-on')`)) break;
      await shot(`home-casing-${n}`, 0);
    }
    await overlayUp(120000);
    scenes.push({ scene: 'casing: the report put away to the card', seconds: +((Date.now() - t1) / 1000).toFixed(1) });
    await shot('home-warning-card', 900);
    await key('Enter');
    await phase('choose', 120000);
    scenes.push({ scene: 'casing: the report put away to the next choice', seconds: +((Date.now() - t1) / 1000).toFixed(1) });
    await shot('home-warning-standing', 1500);
  }
  await audit('casing');
  if (want('notice')) {
    // (the racer: on the day it is due, out to the flea market, and word comes; then home in time)
    const r = firstOf(racer8, e => e.type === 'alarm');
    await load(r.before);
    await go('out to the market, the notice', keyOf(r.before, r.choice));
    await shot('home-notice-market', 1200);
    const home = await ev(`(() => { const b = [...document.querySelectorAll('.rn-alert-way')].find(x => !x.disabled && /in time/.test(x.textContent)); return b ? b.dataset.key : null; })()`);
    if (!home) throw new Error('no way home in time on the notice');
    await go('home in time: met at the door', home, { door: [['home-met-at-door-a', 8], ['home-met-at-door-b', 11], ['home-met-at-door-c', 14], ['home-met-at-door-d', 17], ['home-met-at-door-e', 20], ['home-met-at-door-f', 23]] });
    await shot('home-met-at-door-after', 900);
  }
  await audit('notice');
  if (want('guard')) {
    // (the guard's run: Earl put on the step for the day it is due; out; word comes; home in time with him on)
    const on = firstOf(guard8, e => e.type === 'guard' && e.on);
    await load(on.before);
    await go('Earl put on the step', keyOf(on.before, on.choice), { more: [['home-guard-put-on-a', 5], ['home-guard-put-on-b', 8], ['home-guard-put-on-c', 11]] });
    // (out of the door: him on the step)
    const out1 = await ev(`window.__demo.hud.view.moves.find(m => m.choice.do === 'out')?.key`);
    await go('stepping out past Earl', out1);
    await shot('home-guard-on-step', 1500);
    const r = firstOf(guard8, e => e.type === 'alarm');
    await load(r.before);
    await go('out to the market with Earl on', keyOf(r.before, r.choice));
    const home = await ev(`(() => { const b = [...document.querySelectorAll('.rn-alert-way')].find(x => !x.disabled && /in time/.test(x.textContent)); return b ? b.dataset.key : null; })()`);
    if (home) await go('home in time: Earl on the step facing them', home, { door: [['home-guard-facing-them-a', 8], ['home-guard-facing-them-b', 11], ['home-guard-facing-them-c', 14], ['home-guard-facing-them-d', 17], ['home-guard-facing-them-e', 20], ['home-guard-facing-them-f', 23], ['home-guard-facing-them-g', 26]] });
    await shot('home-guard-after', 900);
  }
  await audit('guard');
  if (want('gotin')) {
    // (the one who ignores it: at the flea market while the window runs out; they got in; then home, and seen)
    const r = firstOf(ignore8, e => e.type === 'raid' && e.taken > 0);
    await load(r.before);
    await go('the hour the window runs out', keyOf(r.before, r.choice));
    await shot('home-notice-got-in', 1200);
    const home = await ev(`window.__demo.hud.view.moves.find(m => m.choice.do === 'subway' && m.choice.to === 'park' && !m.choice.hop && m.available)?.key ?? window.__demo.hud.view.moves.find(m => m.choice.do === 'subway' && m.choice.to === 'park')?.key`);
    await go('home after it', home, { door: [['home-coming-home-after-a', 1], ['home-coming-home-after-b', 3], ['home-coming-home-after-c', 6], ['home-coming-home-after-d', 9], ['home-coming-home-after-e', 12]], press: [['home-after-card', 900]] });
  }
  await audit('gotin');
  if (want('safe')) {
    const r = guard8.find(x => x.before.place === 'crib' && x.before.day >= 2) ?? guard8[0];
    await load({ ...r.before, things: { ...(r.before.things ?? {}), floorsafe: true, deadbolt: true } });
    await page.sleep(3000);
    await shot('home-floor-safe-room', 1500);
  }
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]|\[run\]|\[inside\]/.test(l));
  console.log(bad.length ? `page errors:\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}` : 'page errors: 0');
  console.log('audit', JSON.stringify(await ev(`(a => a && { overlaps: a.overlaps, furniture: a.furniture, vanish: a.vanish, feet: a.feet, heads: a.heads, examples: (a.examples ?? []).filter(e => /^(vanish|furniture|overlap|feet|heads) /.test(e)).slice(0, 6) })(window.__demo.stage.actors.audit())`)));
  console.log('scenes', JSON.stringify(scenes));
  const near = await ev('window.__near ?? {}');
  const pairs = Object.entries(near).sort((a, b) => a[1].min - b[1].min);
  console.log(`closest at the door (outside a fight or a hand-over): ${pairs.slice(0, 8).map(([k, r]) => `${k} ${r.min} m (day ${r.day} ${r.hour}:00, ${r.scenes})`).join(' · ') || 'nobody'}`);
} catch (err) {
  console.error(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(out, `${size}-said.json`), JSON.stringify({ said, scenes }, null, 1));
  await browser.close();
}
