#!/usr/bin/env node
// A FIGHT OF THE RUN, FILMED AS IT PLAYS (anim-1): the page's own pictures at the game's camera and at the game's own
// speed, saved frame by frame with the time each was shown, for demo/tools/fight-film.py to make a clip and a strip of.
// A fight is judged in motion, at the speed the player sees it: a still says nothing of weight or timing.
// The server must be running: node demo/serve.mjs --port 5493 --quiet
//
//   HK2_DEBUG_PORT=5746 node demo/tools/fight-film.mjs --port 5493 --out <dir> --case debt:hands:won [--case ...]
//
// THE CASES (each found headless first, by the run's own engine, then loaded in the page and chosen with real keys):
//   debt:<arm>:<won|lost>   a debt collected in the trailer park that goes wrong (Benny Two-Coats, a plain brawler),
//                           fought with <arm>: hands, cutter, jab, haymaker or throw
//   lift:<arm>:<won|lost>[:nadia]   (named-1) a box lifted off Big Lou's semi at the docks that goes wrong (or Nadia's)
//   jump:<won|lost>         jumped by two at the market
//   crew:<front|hunt|block|side|none>[:won|lost]   the crew of two at your trailer door, Cousin Earl told that way (none: without him)
//   kerb                    the Sixes' two by the market's steps, after the tax is refused
// --angle bearing,down,high   the game's camera turned to that once the fight is on (the staging stays as it was laid
//                           for the view it began in): a low view, one from each side, one from behind
//   wave:<gun>[:<level>]    the fight you steer (the fight page), that gun in hand (pistol | chopper | doorman |
//                           longeye; level jumped | raid | real | hard ...: real and hard have some who shoot back),
//                           played by real keys; --secs 16; --guns old: the bodies as they were before the hand-posed
//                           ones (the page's ?guns=old); --seed <n>: another fight of that level; --trace: how every
//                           body with a gun was drawn, a row a frame, kept in film.json (demo/tools/gun-lean.mjs
//                           reads it: the spine's tilt through each shot); --dry: no pictures, the measures only
//   look:<arm>:<style>      the fight page's one-on-one, to look at (demo/?mode=fight, Build your own): <arm> against
//                           brawler, bigman, quick, knife or grabber
//   night:<crew>:<hold>[:won|lost]   (raidfight-2) THE RAID IN THE GAME, at night: a run's night at the crib with the
//                           Sixes due (the four guns and their rounds, $400 banked), what you hold set on the card, to
//                           bed with a real key, and the raid at your door filmed as the run plays it (/demo/?mode=run,
//                           under the night's light); --qs "&pool=0": without the raid's light. The same fail
//                           conditions as raid: below, and the frames over 33 ms
//   raid:<crew>:<arm>[:won|lost]   (raidfight-1) the raid on your home at the trailer's door (demo/run/raidfight.js, on
//                           the fight page at ELM ST, whose zone is the trailer park's): crew rush | runners | shooters |
//                           bigmen; arm hands | cutter | sixshot | doorman | chopper | longeye; --size 0|1|2 (1); --earl
//                           (Cousin Earl beside you); found headless (demo/run/raidcase.js), picked with a real B, a real
//                           mouse press on Night (or Day: --day) and one on Watch the raid. It FAILS on: the raid seen ending otherwise than the
//                           rules, a page error, anybody coming on, going off or moved at once in the picture, a drop
//                           of blood in the air 2.5 s after the last hit, a shot leaving its barrel over --line rad off
//                           its line, two standing bodies' middles within 0.6 m, a body turned over --spin rad (0.6) in
//                           one frame, the first shot or blow over 2.5 s after the press, control back over 4 s after
//                           the last
// Writes <dir>/<case>/f-00000.jpg ... and <dir>/<case>/film.json: every frame's time (s, the browser's own clock), the
// fight's phase and clock when it was taken, where the two heads were on the picture, and the page's frame times.
// HOW: Chrome's own screencast (DevTools Page.startScreencast): every picture the page presents, as it presents it.
import path from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, newRun, step, deal } from '../../src/run/index.mjs';
import { findRaid } from '../run/raidcase.js';
import { crewFoes } from '../../src/run/raid.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};
/** --dry: no pictures written (a check of the measures only). --line <rad>: fail when a shot left a barrel further off its line than that. */
const DRY = args.includes('--dry');
/** --trace: the film's film.json also carries how every body was drawn, a row a frame (gunner.js traceRow; demo/tools/gun-lean.mjs reads it). */
const TRACE = args.includes('--trace');
const LINE = opt('--line', null) === null ? null : Number(opt('--line', null));
const lineFaults = [];
const all = name => args.flatMap((a, k) => (a === name ? [args[k + 1]] : []));
const out = path.resolve(opt('--out', 'demo/shots/fight-film'));
const port = opt('--port', 5493);
const debugPort = Number(process.env.HK2_DEBUG_PORT) || 5746;
const cases = all('--case');
if (!cases.length) cases.push('debt:hands:won');
const SEED = Number(opt('--seed', '3'));
const angle = opt('--angle', null)?.split(',').map(Number) ?? null;
const base = `http://127.0.0.1:${port}/demo/?mode=run&seed=${SEED}&speed=1&new=1${opt('--qs', '')}`;

// ── HEADLESS: the states ──────────────────────────────────────────────────────────────────────────────────────────
const STYLES = { jab: true, haymaker: true, throw: true };
function debt(arm, result) {
  for (let seed = 1; seed < 900; seed++) {
    let s = newRun({ seed });
    s = { ...s, styles: { ...STYLES }, owned: { ...s.owned, cutter: arm === 'cutter' }, fightWith: arm };
    s = step(cfg, s, { do: 'out', take: 0 }).state;
    for (let k = 0; k < 4; k++) {
      if (deal(cfg, s).some(j => j.id === 'collect')) {
        const r = step(cfg, s, { do: 'job', id: 'collect' });
        const e = r.events.find(x => x.type === 'job');
        if (e?.duel?.result === result && !r.events.some(x => x.type === 'jumped' || x.type === 'stopped')) return { seed, state: s, choice: { do: 'job', id: 'collect' }, after: r.state, duel: e.duel };
        break;
      }
      const odd = deal(cfg, s).find(j => j.safe);
      if (!odd) break;
      s = step(cfg, s, { do: 'job', id: odd.id }).state;
    }
  }
  throw new Error(`no debt fought with ${arm} that is ${result}`);
}
// (named-1) lift:<arm>:<won|lost>[:<who>]: a box lifted off a driver's semi at Low Tide Docks that goes wrong, and the
// fight with the driver (Big Lou, the biggest of the named cast at 1.25; or `nadia`)
function lift(arm, result, who = 'lou') {
  const name = who === 'nadia' ? 'Nadia Petrakis' : 'Big Lou';
  for (let seed = 1; seed < 3000; seed++) {
    let s = newRun({ seed });
    s = { ...s, styles: { ...STYLES }, owned: { ...s.owned, cutter: arm === 'cutter' }, fightWith: arm };
    s = step(cfg, s, { do: 'out', take: 0 }).state;
    // (money for the fare, and the books say where it came from)
    s = { ...s, hour: 10, energy: 8, carried: s.carried + 40, books: { ...s.books, earned: s.books.earned + 40 } };
    try {
      s = step(cfg, s, { do: 'subway', to: 'docks', hop: false }).state;
    } catch {
      continue;
    }
    if (!deal(cfg, s).some(j => j.id === 'lift')) continue;
    const r = step(cfg, s, { do: 'job', id: 'lift' });
    const e = r.events.find(x => x.type === 'job');
    if (e?.duel?.result === result && e.text.includes(name) && !r.events.some(x => x.type === 'jumped' || x.type === 'stopped')) return { seed, state: s, choice: { do: 'job', id: 'lift' }, after: r.state, duel: e.duel };
  }
  throw new Error(`no lift off ${name} fought with ${arm} that is ${result}`);
}
function jump(result) {
  for (let day = 2; day < 60; day++) {
    for (let hour = 14; hour < 20; hour++) {
      const s0 = newRun({ seed: SEED, cfg });
      const s = { ...s0, place: 'market', day, hour, hoursThere: 2, energy: 4, carried: s0.carried + 60, books: { ...s0.books, earned: s0.books.earned + 60 } };
      const stall = deal(cfg, s)[0];
      const r = step(cfg, s, { do: 'job', id: stall.id });
      const e = r.events.find(x => x.type === 'jumped');
      if (!e?.duel) continue;
      if (e.duel.result === result && (result === 'lost' || e.outcome === 'fail')) return { seed: SEED, state: s, choice: { do: 'job', id: stall.id }, after: r.state, duel: e.duel };
    }
  }
  throw new Error(`no jump ${result}`);
}
// (sixes-1) THE CREW AT YOUR DOOR and THE SIXES' TWO BY THE STEPS, as demo/tools/run-sixes.mjs makes their states
const SLICE = ['deadbolt', 'floorsafe', 'doorbar', 'dog', 'camera', 'dogsign'];
const goes = (s, choice) => ({ state: s, choice, ...(r => ({ after: r.state, events: r.events }))(step(cfg, s, choice)) });
const placed = (place, o = {}) => {
  const s = newRun({ seed: SEED, cfg });
  return { ...s, place, energy: 5, ...o, owned: { ...s.owned, ...(o.owned ?? {}) } };
};
function crew(way, result = null) {
  for (let day = 3; day < 80; day++) {
    const s0 = placed('crib', { day, hour: 21, energy: 2, owned: { bed: true }, things: Object.fromEntries(SLICE.map(k => [k, true])),
      home: { marks: [{ why: 'loosies', text: `Sold loose cigarettes (day ${day})`, n: 8, day }], raid: { who: { ...cfg.pressure.stranger }, why: 'stranger', day, hour: 14, warned: day - 1, started: null, kind: 'crew' }, last: null, guard: way === 'none' ? null : { on: true, until: day + 1 }, raids: [] } });
    let s = { ...s0, banked: s0.banked + 400, books: { ...s0.books, earned: s0.books.earned + 400 } };
    if (way !== 'none') s = goes(s, { do: 'earlWay', way }).after;
    const r = goes(s, { do: 'sleep' });
    const e = r.events.find(x => x.type === 'raid' && x.duel);
    if (e && (!result || e.duel.result === result)) return { seed: SEED, state: s, choice: { do: 'sleep' }, after: r.after, duel: e.duel };
  }
  throw new Error(`no door fight with Earl ${way}${result ? `, ${result}` : ''}`);
}
function kerb() {
  const X = cfg.sixes;
  const taxDay = 5;
  const t0 = placed('market', { day: taxDay, hour: 18, hoursThere: 2 });
  const taxState = { ...t0, carried: t0.carried + 80, books: { ...t0.books, earned: t0.books.earned + 80 }, sixes: { marks: [{ why: 'sell', text: `sold at their market (day ${taxDay - 1})`, n: 5, day: taxDay - 1 }], did: taxDay, word: taxDay - 2, made: 60, madeDay: taxDay, taxDay: null, tax: null, jump: null, jumps: [] } };
  const ride = { do: 'subway', to: 'park', hop: false };
  const refused = goes(goes(taxState, ride).after, { do: 'tax', pay: false });
  const night = goes({ ...refused.after, place: 'crib', hour: 21, banked: refused.after.banked + refused.after.carried, carried: 0 }, { do: 'sleep' });
  void X;
  for (let k = 1; k < 40; k++) {
    const d = night.after.day + k;
    const b = { ...night.after, day: d, place: 'market', hour: 17, hoursThere: 1, energy: 6, sixes: { ...night.after.sixes, jump: { day: d, warned: d - 1 } } };
    const s0 = { ...b, carried: b.carried + 40, books: { ...b.books, earned: b.books.earned + 40 } };
    const r = goes(s0, ride);
    const e = r.events.find(x => x.type === 'jumped' && x.sixes);
    if (e?.duel) return { seed: SEED, state: s0, choice: ride, after: r.after, duel: e.duel };
  }
  throw new Error('no fight by the steps');
}
// (raidfight-2) THE RAID IN THE GAME: the night it is due, held as asked (run-raid.mjs's own night, at the middle size)
function night(crew, hold, result) {
  const s0 = newRun({ seed: SEED, cfg });
  const c = crewFoes(cfg, crew, 1);
  for (let day = 3; day < 90; day++) {
    const sixes = { ...s0.sixes, marks: [{ why: 'refuse', text: `refused Dutch the tax (day ${day})`, n: 9, day }], did: day, word: day - 3, raid: { day, warned: day - 1, crew, size: 1, n: c.n, stake: 1500 } };
    const s = { ...s0, place: 'crib', day, hour: 21, energy: 4, stash: { smokes: 6 }, things: { sixshot: true, doorman: true, chopper: true, longeye: true, doorbar: true, camera: true }, ammo: { sixshot: 24, doorman: 12, chopper: 60, longeye: 10 }, holdWith: null, sixes, banked: s0.banked + 400, books: { ...s0.books, earned: s0.books.earned + 400 } };
    const held = goes(s, { do: 'holdWith', with: hold }).after;
    const r = goes(held, { do: 'sleep' });
    const e = r.events.find(x => x.type === 'raid' && x.kind === 'sixes' && x.duel);
    if (e && e.home && (!result || e.duel.result === result)) return { seed: SEED, state: held, choice: { do: 'sleep' }, after: r.after, duel: e.duel, night: true };
  }
  throw new Error(`no night of ${crew} with ${hold}${result ? `, ${result}` : ''}`);
}
const found = cases.map(name => {
  const [kind, a, b] = name.split(':');
  // (look:<arm>:<style>: the fight page's one-on-one, to look at: any way to fight against any style)
  if (kind === 'look') return { name, look: { arm: a, foe: b } };
  // (wave:<gun>[:<level>]: the fight you steer, on the fight page, with that gun in hand; played by the keys as a
  // player backing away while firing would play it (the page's own driveMove), for --secs seconds or to its end)
  if (kind === 'wave') return { name, wave: { gun: a ?? 'pistol', level: b ?? 'jumped' } };
  // (raid:<crew>:<arm>[:won|lost]: the raid at the trailer's door, found headless)
  if (kind === 'raid') {
    const result = name.split(':')[3] ?? null;
    const R = findRaid({ crew: a ?? 'rush', hold: b ?? 'doorman', size: Number(opt('--size', '1')), earl: args.includes('--earl'), result });
    console.log(`headless ${name}: ${R.them.text}, ${R.you.label}${args.includes('--earl') ? ', Earl' : ''}; ${R.result} in ${R.seconds} s, fight seed ${R.seed}`);
    return { name, raid: { crew: a ?? 'rush', hold: R.you.hold ?? b, size: Number(opt('--size', '1')), earl: args.includes('--earl'), seed: R.seed, result: R.result, seconds: R.seconds } };
  }
  const c = kind === 'debt' ? debt(a, b) : kind === 'lift' ? lift(a, b, name.split(':')[3] ?? 'lou') : kind === 'jump' ? jump(a) : kind === 'crew' ? crew(a ?? 'front', b ?? null) : kind === 'kerb' ? kerb() : kind === 'night' ? night(a ?? 'rush', b ?? 'doorman', name.split(':')[3] ?? null) : null;
  if (!c) throw new Error(`no such case ${name}`);
  console.log(`headless ${name}: seed ${c.seed}, day ${c.state.day} ${c.state.hour}:00 at ${c.state.place}; ${c.duel.result} in ${c.duel.seconds} s, fight seed ${c.duel.seed}`);
  return { name, ...c };
});
// (--stage: each case's fight staged here, without a browser, and how long that took: a staging that never ends is
// found before a page is hung on it)
if (args.includes('--stage')) {
  const { scriptOf, stageFight } = await import('../fight/puppet/choreo.js');
  for (const c of found.filter(x => x.duel)) {
    const t0 = performance.now();
    const script = scriptOf(c.duel.inputs, c.duel.seed);
    const fight = stageFight({ script, ground: { c: [0, 0], r: 1.5 }, cam: [1, 0], seed: c.duel.seed, firstHurt: c.duel.inputs.firstHurt ?? 0 });
    console.log(`staged ${c.name}: ${script.people.length} in it, ${script.beats.length} blows, over ${JSON.stringify(script.over)}; the score runs ${fight.t0} to ${fight.t1.toFixed(2)}; ${(performance.now() - t0).toFixed(0)} ms`);
  }
  process.exit(0);
}
if (args.includes('--headless')) process.exit(0);

// ── THE PAGE ──────────────────────────────────────────────────────────────────────────────────────────────────────
const KEYS = { ' ': ['Space', 32], Enter: ['Enter', 13] };
const browser = await launch({ debugPort, width: 1600, height: 1000 });
let failed = null;
/** (the page, for what it logged when a film fails before its own check of the page's errors) */
let thePage = null;
try {
  const lookBase = `http://127.0.0.1:${port}/demo/?mode=fight&nostairs=1`;
  const fightPage = c => !!(c.look || c.wave || c.raid);
  const page = await browser.open(fightPage(found[0]) ? lookBase : base);
  thePage = page;
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  await page.waitFor(`window.__demo && window.__demo.hud && window.__demo.hud.phase === "${fightPage(found[0]) ? 'pick' : 'choose'}"`, 180000);
  await page.sleep(1500);
  let onLook = !!found[0].look;
  async function key(k) {
    const [code, vk] = KEYS[k] ?? (/^\d$/.test(k) ? [`Digit${k}`, 48 + Number(k)] : [`Key${k.toUpperCase()}`, k.toUpperCase().charCodeAt(0)]);
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && k.length === 1 ? { text: k } : {}) });
  }
  /** (raidfight-2) The night's raid, as the run plays it: filmed from when the raid is on to its end; its record checked. */
  async function nightFilm(c, dir, frames) {
    const t0 = Date.now();
    for (;;) {
      if (await ev('!!(window.__demo.hud.raid && window.__demo.hud.raid.active)')) break;
      if (await ev('window.__demo.hud.phase === "report"')) await key('Enter');
      if (Date.now() - t0 > 180000) throw new Error('the night\'s raid never came');
      await page.sleep(60);
    }
    await page.waitFor('(s => s && s.phase !== "open")(window.__demo.hud.raid.state)', 60000, 20).catch(() => {});
    if (angle) await ev(`window.__demo.stage.camera.setAngle({ bearing: ${angle[0]}, down: ${angle[1]}, high: ${angle[2]} })`);
    await ev(`(() => { const F = (window.__film = { frames: [], marks: [], on: true }); let last = performance.now();
      const tick = now => { if (!F.on) return; requestAnimationFrame(tick); F.frames.push(+(now - last).toFixed(2)); last = now;
        const st = window.__demo.hud.raid.state; F.marks.push([+(performance.timeOrigin + now).toFixed(1), st ? st.phase : null, st ? st.t : null]); };
      requestAnimationFrame(tick); })()`);
    while (await ev('window.__demo.hud.raid.active')) {
      await page.sleep(150);
      if (Date.now() - t0 > 240000) throw new Error('the night\'s raid never ended');
    }
    await page.sleep(900);
    cast('Page.stopScreencast');
    sink = null;
    const film = await ev('(() => { const F = window.__film; F.on = false; return { frames: F.frames.slice(-6000), marks: F.marks.slice(-6000) }; })()');
    const rec = await ev('(R => (R.log[R.log.length - 1] || {}).fight || null)(window.__demo.hud.raid)');
    if (angle) await ev('window.__demo.stage.camera.setAngle()');
    writeFileSync(path.join(dir, 'film.json'), `${JSON.stringify({ name: c.name, frames, heads: [], pageFrames: film.frames, marks: film.marks, trace: [], rec })}\n`);
    const on = film.marks.map((m, k) => (m[1] === 'fight' || m[1] === 'down' ? film.frames[k] : null)).filter(v => v !== null).slice(3);
    const sorted = on.slice().sort((a, b) => a - b);
    const C = rec?.clean ?? {};
    const over = on.filter(v => v > 33.4).length;
    console.log(`${c.name}: in the game at night: seen ${rec?.seen}, the rules ${rec?.result} in ${rec?.seconds} s; first shot or blow ${rec?.open} s after the call, control back ${rec?.close} s after the last; frame faults ${rec?.frames?.faults}; the page drew ${on.length} frames while it played, the worst ${sorted[sorted.length - 1]} ms, over 33 ms ${over}; clean ${JSON.stringify({ knot: C.knotShare, spin: C.spin, fastest: C.fastest, fastAt: C.fastAt, line: C.line, riding: C.riding })}; anim ${JSON.stringify(rec?.anim ?? null)}`);
    const fail = [];
    if (!rec) fail.push('no record of the raid');
    if (rec?.mismatch) fail.push('the raid seen ended otherwise than the rules said');
    if (rec?.frames?.faults) fail.push(`${rec.frames.faults} frame faults (${JSON.stringify(rec.frames.first).slice(0, 300)})`);
    if (over) fail.push(`${over} frames over 33 ms while it played`);
    if (LINE !== null && !((C.line ?? 0) <= LINE)) fail.push(`a round ${C.line} rad off its barrel`);
    if ((C.spin ?? 0) > Number(opt('--spin', '0.6'))) fail.push(`a body turned ${C.spin} rad in one frame`);
    if (C.inside) fail.push(`two standing bodies within 0.6 m in ${C.inside} frames`);
    if (C.riding) fail.push('blood riding a body posed by hand');
    if (fail.length) lineFaults.push(`${c.name}: ${fail.join('; ')}`);
    const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
    if (bad.length) throw new Error(`page errors: ${[...new Set(bad)].slice(0, 3).join(' | ').slice(0, 700)}`);
  }
  // THE SCREENCAST, on a second DevTools socket of the same tab (chrome.mjs keeps its own): every frame as presented
  const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r => r.json());
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('film: no second DevTools socket'));
  });
  let nid = 0;
  const cast = (method, params = {}) => ws.send(JSON.stringify({ id: ++nid, method, params }));
  let sink = null;
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.method !== 'Page.screencastFrame') return;
    cast('Page.screencastFrameAck', { sessionId: msg.params.sessionId });
    sink?.(msg.params);
  };

  for (const c of found) {
    const dir = path.join(out, c.name.replace(/:/g, '-') + (opt('--guns', '') === 'old' ? '-old' : '') + (angle ? `-view-${angle.join('-')}` : '') + (c.wave && args.includes('--seed') ? `-seed-${SEED}` : '') + (c.raid ? `${c.raid.size !== 1 ? `-size${c.raid.size}` : ''}${c.raid.earl ? '-earl' : ''}${args.includes('--day') ? '-day' : '-night'}` : '') + (c.night && opt('--qs', '').includes('pool=0') ? '-nolight' : ''));
    if (existsSync(dir)) rmSync(dir, { recursive: true });
    mkdirSync(dir, { recursive: true });
    // (a page of its own for each of the run's: a fight that ends in the clinic or the night leaves the last one
    // somewhere else; the fight page's one-on-ones follow each other on one page)
    if (!c.wave && c !== found[0] && !(c.look && onLook)) {
      await page.send('Page.navigate', { url: c.look ? lookBase : base });
      await page.sleep(1500);
      await page.waitFor(`window.__demo && window.__demo.hud && window.__demo.hud.phase === "${c.look ? 'pick' : 'choose'}"`, 180000);
      await page.sleep(1500);
      onLook = !!c.look;
    }
    if (c.wave) {
      const frames = [];
      let n = 0;
      const old = opt('--guns', '') === 'old';
      const secs = Number(opt('--secs', '16'));
      // (join-2: the page's own default is the old bodies until the new ones are judged: asked for by name)
      // (--kick <n>: guns.js KICK.doorman tried at another number, the page's ?kick=)
      // (--seed <n>, given: the fight page's own seed, another fight of the same level)
      await page.send('Page.navigate', { url: `${lookBase}${old ? '&guns=old' : '&guns=new'}${opt('--kick', null) !== null ? `&kick=${opt('--kick', null)}` : ''}${args.includes('--seed') ? `&seed=${SEED}` : ''}` });
      await page.sleep(1500);
      await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "pick"', 180000);
      await page.sleep(1200);
      onLook = false;
      // (--trace: how every body is drawn, a row a frame: gunner.js traceRow; read by demo/tools/gun-lean.mjs)
      if (TRACE) await ev('window.__gunTrace = []');
      await ev(`window.__demo.hud.pick(${JSON.stringify({ weapon: c.wave.gun, gear: [], ally: opt('--ally', '') === '1', earl: 'front', level: c.wave.level })})`);
      if (angle) await ev(`window.__demo.stage.camera.setAngle({ bearing: ${angle[0]}, down: ${angle[1]}, high: ${angle[2]} })`);
      await page.sleep(500);
      sink = p => {
        const file = `f-${String(n).padStart(5, '0')}.jpg`;
        n += 1;
        if (!DRY) writeFileSync(path.join(dir, file), Buffer.from(p.data, 'base64'));
        frames.push({ file, t: p.metadata.timestamp });
      };
      await ev(`(() => { const F = (window.__film = { frames: [], marks: [], on: true }); let last = performance.now();
        const tick = now => { if (!F.on) return; requestAnimationFrame(tick); F.frames.push(+(now - last).toFixed(2)); last = now;
          const h = window.__demo.hud; const a = h.anim(); F.marks.push([+(performance.timeOrigin + now).toFixed(1), h.phase, h.fight ? h.fight.t : null, a.shots, a.falls, a.blows]); };
        requestAnimationFrame(tick); })()`);
      cast('Page.startScreencast', { format: 'jpeg', quality: 84, everyNthFrame: 2 });
      await key('Enter');
      await page.waitFor('window.__demo.hud.phase === "fight"', 60000, 30);
      const VK = { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68 };
      const keyDU = (type, code) => page.send('Input.dispatchKeyEvent', { type, code, key: code.slice(3).toLowerCase(), windowsVirtualKeyCode: VK[code], nativeVirtualKeyCode: VK[code] });
      const down = new Set();
      const hold = async m => {
        const want = new Set();
        if (m[0] > 0.38) want.add('KeyD');
        if (m[0] < -0.38) want.add('KeyA');
        if (m[1] > 0.38) want.add('KeyS');
        if (m[1] < -0.38) want.add('KeyW');
        for (const k of [...down]) if (!want.has(k)) { await keyDU('keyUp', k); down.delete(k); }
        for (const k of want) if (!down.has(k)) { await keyDU('keyDown', k); down.add(k); }
      };
      const heads = [];
      const blood = { most: 0, looks: 0, late: 0, longest: 0 };
      const t0 = Date.now();
      for (;;) {
        const h = await ev(`(() => { const d = window.__demo, s = d.stage; const E = d.hud.fight ? d.hud.fight.events : []; let lastHit = null; for (let i = E.length - 1; i >= 0 && lastHit === null; i--) if (E[i].type === 'hit' || E[i].type === 'down') lastHit = E[i].t;
          return { phase: d.hud.phase, drops: s.gore ? s.gore.stats().drops : null, lastHit, m: d.hud.driveMove(), you: s.screenOf('fight:you'), all: d.hud.fight ? d.hud.fight.people.map(p => ({ id: p.id, kind: p.kind, side: p.side, down: !!p.down, gun: p.gun || null, s: s.screenOf(p.id === 'you' ? 'fight:you' : 'fight:' + p.id) })) : [], st: { phase: d.hud.phase === 'fight' ? 'fight' : d.hud.phase, t: d.hud.fight ? d.hud.fight.t : null } }; })()`).catch(() => null);
        if (h) {
          // (everybody of the fight, where they are on the picture and whether they are down: for a look at whoever falls)
          heads.push({ at: Date.now() / 1000, you: h.you, st: h.st, all: h.all ?? [] });
          // (THE BLOOD: how many drops are in the air, and how long since anybody was last hit. The owner: a fleck
          // of blood must never hang in the air)
          if (h.drops !== null && h.st.t !== null) {
            blood.most = Math.max(blood.most, h.drops);
            blood.looks += 1;
            if (h.drops > 0 && h.lastHit !== null && h.st.t - h.lastHit > 2.5) blood.late += 1;
            if (h.drops > 0 && h.lastHit !== null) blood.longest = Math.max(blood.longest, +(h.st.t - h.lastHit).toFixed(2));
          }
          if (h.phase !== 'fight') break;
          await hold(h.m);
        }
        if (Date.now() - t0 > secs * 1000) break;
        await page.sleep(90);
      }
      await hold([0, 0]);
      await page.sleep(700);
      cast('Page.stopScreencast');
      sink = null;
      const film = await ev('(() => { const F = window.__film; F.on = false; return { frames: F.frames.slice(-4000), marks: F.marks.slice(-4000) }; })()');
      const info = await ev('(() => { const h = window.__demo.hud; return { anim: h.anim(), t: h.fight ? h.fight.t : null, check: h.frameCheck().faults ?? null }; })()').catch(() => null);
      if (angle) await ev('window.__demo.stage.camera.setAngle()');
      const gunTrace = [];
      if (TRACE) {
        const size = await ev('window.__gunTrace.length');
        for (let a = 0; a < size; a += 1500) gunTrace.push(...(await ev(`window.__gunTrace.slice(${a}, ${a + 1500})`)));
        await ev('window.__gunTrace = null');
      }
      writeFileSync(path.join(dir, 'film.json'), `${JSON.stringify({ name: c.name, frames, heads, pageFrames: film.frames, marks: film.marks, trace: [], gunTrace, rec: info })}\n`);
      // (--line: THE BARREL IS ON THE LINE at every shot: the most any gun pointed off whoever it fired at, rad)
      if (LINE !== null && !old && !((info?.anim?.offLine ?? 9) <= LINE)) lineFaults.push(`${c.name}: a shot left a barrel ${info?.anim?.offLine ?? '?'} rad off its line (over ${LINE})`);
      console.log(`${c.name}: the blood: ${blood.most} drops in the air at the most over ${blood.looks} looks; a drop seen in the air at most ${blood.longest} s after the last hit; looks with a drop still in the air 2.5 s after the last hit: ${blood.late}`);
      if (blood.late) lineFaults.push(`${c.name}: a drop of blood still in the air 2.5 s after the last hit (${blood.late} looks)`);
      const on = film.marks.map((m, k) => (m[1] === 'fight' ? film.frames[k] : null)).filter(v => v !== null).slice(3);
      const sorted = on.slice().sort((a, b) => a - b);
      const mean = on.reduce((a, b) => a + b, 0) / Math.max(1, on.length);
      console.log(`${c.name}${old ? ' (the old bodies)' : ''}: ${frames.length} pictures → ${dir}; in the fight the page drew ${on.length} frames, ${(1000 / mean).toFixed(1)} a second (the slowest tenth ${sorted[Math.floor(sorted.length * 0.9)]} ms, the worst ${sorted[sorted.length - 1]} ms); ${JSON.stringify(info?.anim ? { ...info.anim, clips: info.anim.clips?.length } : null).slice(0, 1200)}`);
      const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
      if (bad.length) throw new Error(`page errors: ${[...new Set(bad)].slice(0, 3).join(' | ').slice(0, 700)}`);
      continue;
    }
    if (c.raid) {
      const frames = [];
      let n = 0;
      const R = c.raid;
      // (a page of its own: the trailer park's zone, ELM ST's site; the raid picked by the address, watched by the keys)
      await page.send('Page.navigate', { url: `${lookBase}&site=elm&guns=new&raid=${R.crew}:${R.hold}:${R.size}:${R.earl ? 1 : 0}:${R.seed}` });
      await page.sleep(1500);
      await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "pick"', 180000);
      await page.sleep(1200);
      onLook = false;
      if (TRACE) await ev('window.__gunTrace = []');
      sink = p => {
        const file = `f-${String(n).padStart(5, '0')}.jpg`;
        n += 1;
        if (!DRY) writeFileSync(path.join(dir, file), Buffer.from(p.data, 'base64'));
        frames.push({ file, t: p.metadata.timestamp });
      };
      await ev(`(() => { const F = (window.__film = { frames: [], marks: [], on: true }); let last = performance.now();
        const tick = now => { if (!F.on) return; requestAnimationFrame(tick); F.frames.push(+(now - last).toFixed(2)); last = now;
          const st = window.__demo.hud.raid.state; F.marks.push([+(performance.timeOrigin + now).toFixed(1), st ? st.phase : null, st ? st.t : null]); };
        requestAnimationFrame(tick); })()`);
      cast('Page.startScreencast', { format: 'jpeg', quality: 84, everyNthFrame: 2 });
      // (picked as the owner would: B opens Build your own, a real press on Watch the raid)
      if (!(await ev(`!!document.querySelector('[data-row="raid:go"]')`))) await key('b');
      await page.sleep(400);
      const boxOf = row => ev(`(() => { const b = document.querySelector('[data-row="${row}"]'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
      // (raidfight-2: Night or Day, pressed: night unless --day)
      const when = args.includes('--day') ? 'day' : 'night';
      const tb = await boxOf(`raid-time:${when}`);
      if (!tb) throw new Error(`no ${when} button in the raid's rows`);
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x: tb[0], y: tb[1], button: 'left', clickCount: 1 });
      await page.sleep(200);
      if ((await ev('window.__demo.hud.raid.pick.night')) !== (when === 'night')) throw new Error(`pressing ${when} did not set it`);
      const box = await boxOf('raid:go');
      if (!box) throw new Error('no Watch the raid button');
      await page.sleep(200);
      const pressed = Date.now() / 1000;
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x: box[0], y: box[1], button: 'left', clickCount: 1 });
      await page.waitFor('window.__demo.hud.phase === "raid"', 60000, 30);
      // (another view: once the black has lifted on them; the ground was laid for the game's own)
      if (angle) {
        await page.waitFor('window.__demo.hud.raid.state && window.__demo.hud.raid.state.phase !== "open"', 60000, 20);
        await ev(`window.__demo.stage.camera.setAngle({ bearing: ${angle[0]}, down: ${angle[1]}, high: ${angle[2]} })`);
      }
      const heads = [];
      const blood = { most: 0, looks: 0, late: 0, longest: 0 };
      const t0 = Date.now();
      while (await ev('window.__demo.hud.phase === "raid"')) {
        const h = await ev(`(() => { const s = window.__demo.stage; const st = window.__demo.hud.raid.state; return { you: s.screenOf('fight:you'), st, drops: s.gore ? s.gore.stats().drops : null }; })()`).catch(() => null);
        if (h) {
          heads.push({ at: Date.now() / 1000, you: h.you, st: h.st, all: [] });
          if (h.drops !== null && h.st && h.st.lastHit !== null && h.st.lastHit !== undefined) {
            blood.most = Math.max(blood.most, h.drops);
            blood.looks += 1;
            if (h.drops > 0 && h.st.t - h.st.lastHit > 2.5) blood.late += 1;
            if (h.drops > 0) blood.longest = Math.max(blood.longest, +(h.st.t - h.st.lastHit).toFixed(2));
          }
        }
        await page.sleep(100);
        if (Date.now() - t0 > 120000) throw new Error('the raid never ended');
      }
      await page.sleep(900);
      cast('Page.stopScreencast');
      sink = null;
      const film = await ev('(() => { const F = window.__film; F.on = false; return { frames: F.frames.slice(-6000), marks: F.marks.slice(-6000) }; })()');
      const rec = await ev('(L => L[L.length - 1])(window.__demo.hud.raid.log)');
      if (angle) await ev('window.__demo.stage.camera.setAngle()');
      const gunTrace = [];
      if (TRACE) {
        const size = await ev('window.__gunTrace.length');
        for (let a = 0; a < size; a += 1500) gunTrace.push(...(await ev(`window.__gunTrace.slice(${a}, ${a + 1500})`)));
        await ev('window.__gunTrace = null');
      }
      // (from the press, by the browser's own clock: the first shot or blow, as the page marked it)
      // (from the PRESS, by the browser's own clock: the first picture whose clock is at the first shot or blow; and
      // from the last of them to the last picture of the raid)
      const firstMark = rec?.firstAt != null ? film.marks.find(m => (m[1] === 'fight' || m[1] === 'down') && m[2] !== null && m[2] >= rec.firstAt - 1e-3) : null;
      const fromPress = firstMark ? +((firstMark[0] / 1000 - pressed)).toFixed(2) : null;
      if (rec) rec.fromPress = fromPress;
      writeFileSync(path.join(dir, 'film.json'), `${JSON.stringify({ name: c.name, raid: R, pressed, frames, heads, pageFrames: film.frames, marks: film.marks, trace: [], gunTrace, rec })}\n`);
      const on = film.marks.map((m, k) => (m[1] === 'fight' || m[1] === 'down' ? film.frames[k] : null)).filter(v => v !== null).slice(3);
      const mean = on.reduce((a, b) => a + b, 0) / Math.max(1, on.length);
      const sorted = on.slice().sort((a, b) => a - b);
      const C = rec?.clean ?? {};
      console.log(`${c.name}: ${frames.length} pictures → ${dir}; while it played the page drew ${on.length} frames, ${(1000 / mean).toFixed(1)} a second (the slowest tenth ${sorted[Math.floor(sorted.length * 0.9)]} ms, the worst ${sorted[sorted.length - 1]} ms, over 33 ms: ${on.filter(v => v > 33.4).length})`);
      console.log(`  seen ${rec?.seen}, the rules ${rec?.result} in ${rec?.seconds} s (joined at ${rec?.join} s); first shot or blow ${rec?.open} s after the call (${rec?.fromPress} s after the press), control back ${rec?.close} s after the last; frame faults ${rec?.frames?.faults}; shots ${rec?.anim?.shots}, blows ${rec?.anim?.blows}, hits ${rec?.anim?.hits}, falls ${rec?.anim?.falls}; barrel off its line at most ${rec?.clean?.line} rad from the muzzle (${rec?.anim?.offLine?.toFixed?.(2) ?? rec?.anim?.offLine} from the body's middle), whipped ${rec?.anim?.whipped}`);
      console.log(`  clean: heads within 0.8 m in ${((C.knotShare ?? 0) * 100).toFixed(1)}% of frames (nearest ${C.nearest} m), middles within 0.6 m ${C.inside} frames, the most a heading turned in a frame ${C.spin} rad (${JSON.stringify(C.spinAt)}), fastest drawn ${C.fastest} m/s (${JSON.stringify(C.fastAt ?? null)}), stood in something ${C.solid} frames, blood riding a body ${C.riding}; layout ${JSON.stringify(rec?.layout)}; the blood: at most ${blood.longest} s after the last hit, late looks ${blood.late}`);
      const fail = [];
      if (rec?.mismatch) fail.push('the raid seen ended otherwise than the rules said');
      if (rec?.frames?.faults) fail.push(`${rec.frames.faults} frame faults (${JSON.stringify(rec.frames.first).slice(0, 300)})`);
      if (blood.late) fail.push(`a drop of blood still in the air 2.5 s after the last hit (${blood.late} looks)`);
      if (LINE !== null && !((C.line ?? 0) <= LINE)) fail.push(`a shot left a barrel ${C.line} rad off its line from the muzzle (over ${LINE}: ${JSON.stringify(C.lineAt)})`);
      if (C.inside) fail.push(`two standing bodies within 0.6 m of each other in ${C.inside} frames`);
      if (C.riding) fail.push(`blood riding a body posed by hand (${C.riding})`);
      if ((C.spin ?? 0) > Number(opt('--spin', '0.6'))) fail.push(`a body turned ${C.spin} rad in one frame`);
      if (rec?.open !== null && rec?.open > 2.5) fail.push(`the first shot or blow ${rec.open} s after the raid was called`);
      if (rec?.fromPress !== null && rec?.fromPress > 3) fail.push(`the first shot or blow ${rec.fromPress} s after the press`);
      if (rec?.close !== null && rec?.close > 4) fail.push(`control back ${rec.close} s after the last shot or blow`);
      if (fail.length) lineFaults.push(`${c.name}: ${fail.join('; ')}`);
      const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
      if (bad.length) throw new Error(`page errors: ${[...new Set(bad)].slice(0, 3).join(' | ').slice(0, 700)}`);
      continue;
    }
    if (c.look) {
      const frames = [];
      let n = 0;
      sink = p => {
        const file = `f-${String(n).padStart(5, '0')}.jpg`;
        n += 1;
        writeFileSync(path.join(dir, file), Buffer.from(p.data, 'base64'));
        frames.push({ file, t: p.metadata.timestamp });
      };
      await ev(`(() => { const F = (window.__film = { frames: [], marks: [], on: true }); let last = performance.now();
        const tick = now => { if (!F.on) return; requestAnimationFrame(tick); F.frames.push(+(now - last).toFixed(2)); last = now;
          const st = window.__demo.hud.duel.state; F.marks.push([+(performance.timeOrigin + now).toFixed(1), st ? st.phase : null, st ? st.t : null]); };
        requestAnimationFrame(tick); })()`);
      cast('Page.startScreencast', { format: 'jpeg', quality: 84, everyNthFrame: 2 });
      // (picked and watched as the owner would: the build panel's own buttons, pressed)
      if (!(await ev(`!!document.querySelector('[data-row="duel:go"]')`))) await key('b');
      await page.sleep(400);
      await ev(`(async () => { const press = sel => { const b = document.querySelector(sel); if (!b) throw new Error('no ' + sel); b.click(); };
        press('[data-row="duel-arm:${c.look.arm}"]'); await new Promise(r => setTimeout(r, 120));
        press('[data-row="duel-foe:${c.look.foe}"]'); await new Promise(r => setTimeout(r, 120));
        press('[data-row="duel:go"]'); })()`);
      await page.waitFor('window.__demo.hud.duel.active', 60000, 30);
      const heads = [];
      const t0 = Date.now();
      while (await ev('window.__demo.hud.phase === "duel"')) {
        const h = await ev(`(() => { const s = window.__demo.stage; return { you: s.screenOf('fight:you'), st: window.__demo.hud.duel.state }; })()`).catch(() => null);
        if (h) heads.push({ at: Date.now() / 1000, ...h, all: [] });
        await page.sleep(120);
        if (Date.now() - t0 > 120000) throw new Error('the one-on-one never ended');
      }
      await page.sleep(800);
      cast('Page.stopScreencast');
      sink = null;
      const film = await ev('(() => { const F = window.__film; F.on = false; return F; })()');
      const rec = await ev('(L => L[L.length - 1])(window.__demo.hud.duel.log)');
      writeFileSync(path.join(dir, 'film.json'), `${JSON.stringify({ name: c.name, frames, heads, pageFrames: film.frames, marks: film.marks, trace: [], rec })}\n`);
      const on = film.marks.map((m, k) => (m[1] === 'fight' ? film.frames[k] : null)).filter(v => v !== null).slice(3);
      const mean = on.reduce((a, b) => a + b, 0) / Math.max(1, on.length);
      const sorted = on.slice().sort((a, b) => a - b);
      console.log(`${c.name}: ${frames.length} pictures → ${dir}; while the blows were on the page drew ${on.length} frames, ${(1000 / mean).toFixed(1)} a second (the slowest tenth ${sorted[Math.floor(sorted.length * 0.9)]} ms, the worst ${sorted[sorted.length - 1]} ms); seen ${rec?.seen}, the rules ${rec?.result} in ${rec?.seconds} s, frame faults ${rec?.frames?.faults}, ${rec?.hits} landed${rec?.open !== undefined ? `; the first blow ${rec.open} s after the fight was called, control back ${rec.close} s after the last blow` : ''}`);
      const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
      if (bad.length) throw new Error(`page errors: ${[...new Set(bad)].slice(0, 3).join(' | ').slice(0, 700)}`);
      continue;
    }
    const ok = await ev(`window.__demo.hud.load(${JSON.stringify(c.state)})`, 60000);
    if (!ok) throw new Error('the page would not load the state');
    await page.waitFor('window.__demo.hud.phase === "choose"', 60000, 100);
    await page.sleep(900);
    const v = await ev('window.__demo.hud.view');
    const want = v.choices.find(x => Object.entries(c.choice).every(([k, val]) => x.choice[k] === val));
    if (!want) throw new Error(`no ${JSON.stringify(c.choice)} in the page's choices`);
    const k = await ev(`window.__demo.hud.keyFor(${JSON.stringify(want.key)})`);
    if (k) await key(k);
    else await ev(`window.__demo.hud.pick(${JSON.stringify(want.key)})`);
    await page.sleep(300);
    // (the page's own frame times while the fight is on, and who is where on the picture, sampled by the page itself)
    await ev(`(() => { const F = (window.__film = { frames: [], marks: [], trace: [], on: true }); let last = performance.now();
      const A = window.__demo.stage.actors;
      const tick = now => { if (!F.on) return; requestAnimationFrame(tick); F.frames.push(+(now - last).toFixed(2)); last = now;
        const st = window.__demo.hud.duel.state;
        const at = +(performance.timeOrigin + now).toFixed(1);
        F.marks.push([at, st ? st.phase : null, st ? st.t : null, st && st.phase === 'square' ? st.walk ?? null : null]);
        // (every body of ours within 14 m of the player: where it is, how it is drawn to face, what it is told to face, how fast it turns)
        const Y = A.has('a1') ? A.get('a1') : null;
        if (Y) for (const B of A.all()) { if (B.w.hide || Math.hypot(B.x - Y.x, B.z - Y.z) > 14) continue;
          F.trace.push([at, B.id, +B.x.toFixed(3), +B.z.toFixed(3), +(B.w.yawS ?? B.ry).toFixed(3), +(B.w.p[3]).toFixed(3), +(B.w.omega || 0).toFixed(2), +(B.vc || 0).toFixed(2), B.clipName ?? '', +(B.w.g ? B.w.g.look || 0 : 0).toFixed(2)]); } };
      requestAnimationFrame(tick); })()`);
    const frames = [];
    let n = 0;
    sink = p => {
      const file = `f-${String(n).padStart(5, '0')}.jpg`;
      n += 1;
      writeFileSync(path.join(dir, file), Buffer.from(p.data, 'base64'));
      frames.push({ file, t: p.metadata.timestamp });
    };
    cast('Page.startScreencast', { format: 'jpeg', quality: 84, everyNthFrame: 2 });
    await key('Enter');
    if (c.night) {
      await nightFilm(c, dir, frames);
      continue;
    }
    // (to bed: the day's report is pressed on, and the door fight is the morning's)
    if (c.choice.do === 'sleep') {
      await page.waitFor('window.__demo.hud.phase === "report"', 120000, 100);
      await page.sleep(1200);
      await key('Enter');
    }
    await page.waitFor('window.__demo.hud.duel.active', 120000, 30);
    if (angle) await ev(`window.__demo.stage.camera.setAngle({ bearing: ${angle[0]}, down: ${angle[1]}, high: ${angle[2]} })`);
    const heads = [];
    const t0 = Date.now();
    // (where the fight is on the picture: the player's head, a few times a second)
    while (await ev('window.__demo.hud.duel.active')) {
      const h = await ev(`(() => { const s = window.__demo.stage; const a = s.actors; const out = []; for (const id of ['a1']) if (a.has(id)) out.push(s.screenOf(id)); const all = (a.all?.() ?? []).filter(B => B.w && !B.w.hide).map(B => { const p = s.screenOf(B.id); return [B.id, Math.round(p.x), Math.round(p.y), a.get(B.id).clipName ?? null]; }); return { you: out[0] ?? null, all, st: window.__demo.hud.duel.state }; })()`).catch(() => null);
      if (h) heads.push({ at: Date.now() / 1000, ...h });
      await page.sleep(120);
      if (Date.now() - t0 > 120000) throw new Error('the fight never ended');
    }
    await page.sleep(1200);
    cast('Page.stopScreencast');
    sink = null;
    // (fetched in pieces: a minute's trace of a busy place in one message is more than the DevTools socket carries)
    const sizes = await ev('(() => { const F = window.__film; F.on = false; return { frames: F.frames.length, marks: F.marks.length, trace: F.trace.length }; })()');
    const film = { frames: [], marks: [], trace: [] };
    for (const k of ['frames', 'marks', 'trace']) for (let a = 0; a < sizes[k]; a += 4000) film[k].push(...(await ev(`window.__film.${k}.slice(${a}, ${a + 4000})`)));
    const rec = await ev('(L => L[L.length - 1])(window.__demo.hud.duel.log)');
    writeFileSync(path.join(dir, 'film.json'), `${JSON.stringify({ name: c.name, seed: c.seed, duel: { result: c.duel.result, seconds: c.duel.seconds, seed: c.duel.seed }, frames, heads, pageFrames: film.frames, marks: film.marks, trace: film.trace, rec })}\n`);
    if (angle) await ev('window.__demo.stage.camera.setAngle()');
    const dts = film.frames.slice(5);
    const mean = dts.reduce((a, b) => a + b, 0) / Math.max(1, dts.length);
    const sorted = dts.slice().sort((a, b) => a - b);
    console.log(`${c.name}: ${frames.length} pictures over ${(frames[frames.length - 1].t - frames[0].t).toFixed(1)} s → ${dir}; the page drew ${dts.length} frames, ${(1000 / mean).toFixed(1)} a second (the slowest tenth ${sorted[Math.floor(sorted.length * 0.9)]} ms, the worst ${sorted[sorted.length - 1]} ms); seen ${rec?.seen}, the rules ${rec?.result}, frame faults ${rec?.frames?.faults}${rec?.open !== undefined ? `; the first blow ${rec.open} s after the fight was called, control back ${rec.close} s after the last blow` : ''}`);
  }
  ws.close();
} catch (err) {
  failed = err;
  console.error(String(err?.stack ?? err));
  const said = [...new Set((thePage?.logs ?? []).filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || l.startsWith('[warning]')))];
  if (said.length) console.error(`the page said: ${said.slice(0, 5).join(' | ').slice(0, 1200)}`);
  const where = await thePage?.evaluate('(h => h ? { phase: h.phase, t: h.fight ? h.fight.t : null } : null)(window.__demo && window.__demo.hud)', 5000).catch(() => null);
  if (where) console.error(`the page was at: ${JSON.stringify(where)}`);
} finally {
  await browser.close();
  if (!failed && lineFaults.length) failed = new Error(lineFaults.join(' | '));
  console.log(failed ? `film-fail: ${failed.message}` : LINE !== null ? `film-ok: every shot left its barrel within ${LINE} rad of its line, and no drop of blood hung in the air` : 'film-ok');
  // (at once: a wait's own timer, still pending, kept the tool alive for minutes after its work was done)
  process.exit(failed ? 1 : 0);
}
