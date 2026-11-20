#!/usr/bin/env node
// THE RUN'S FIGHTS, PLAYED IN THE PAGE AND CHECKED (duel-1, RUN.md "Fights"). The server must be running:
// node demo/serve.mjs --port 5486
//
//   HK2_DEBUG_PORT=5726 node demo/tools/run-duel.mjs --port 5486 --out <dir> [--speed 1] [--only won,lost,door,door-skip,won-skip,lost-skip,noscenes]
//
// First, headless (the run's own engine, src/run/): it finds states where a debt collected in the trailer park goes
// wrong and the fight is WON, one where it goes wrong and the fight is LOST, and a morning with Shaky Dee at the door who
// swings when the door is shut on him. Then in the page (/demo/?mode=run), for each: the state is loaded (the page's
// own hud.load, as the other picture tools do), the choice is made with REAL key events (the dock's key, then Enter:
// DevTools Input.dispatchKeyEvent), and the fight is watched to its end. Pictures: the card with its estimate, before
// the first blow (squaring up), the first blow, mid-fight, the loser down, after, the result row. Then the skips: the
// door's fight skipped by a REAL MOUSE PRESS on the visible Skip button (Input.dispatchMouseEvent), the won debt again
// skipped by Space, the lost one again by Enter. Last, the won debt again with no acting out (&scenes=0).
// Each time the page's state after the step must be the headless one (the same fight, the same result), the fight the
// page showed must end as the rules said, and the frame check (demo/fight/frame.js, watch.js) must find nobody coming
// on, going off or moved at once in the picture while it played. Any page error fails it. It prints `duel-ok` or
// `duel-fail: <why>`.
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { roomCheck } from './room-check.mjs';
import { RUN_CONFIG as cfg, newRun, step, view, deal } from '../../src/run/index.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/run-duel'));
const port = opt('--port', 5470);
const speed = opt('--speed', '1');
const base = `http://127.0.0.1:${port}/demo/?mode=run&seed=3&speed=${speed}${opt('--qs', '')}`;
mkdirSync(out, { recursive: true });
const DEE = 'npc:buyer:projects:1';

// ── HEADLESS: the states ──────────────────────────────────────────────────────────────────────────────────────────
/** A state in the trailer park, stepped out, with the debt dealt at `hour`; its next step as the engine has it. */
function debtAt(seed) {
  let s = newRun({ seed });
  s = step(cfg, s, { do: 'out', take: 0 }).state;
  // (odd jobs until the debt is dealt, at most four hours: each is a real step of the engine)
  for (let k = 0; k < 4; k++) {
    if (deal(cfg, s).some(j => j.id === 'collect')) {
      const r = step(cfg, s, { do: 'job', id: 'collect' });
      const e = r.events.find(x => x.type === 'job');
      return { state: s, choice: { do: 'job', id: 'collect' }, after: r.state, event: e };
    }
    const odd = deal(cfg, s).find(j => j.safe);
    s = step(cfg, s, { do: 'job', id: odd.id }).state;
  }
  return null;
}
function findDebt(result) {
  for (let seed = 1; seed < 500; seed++) {
    const c = debtAt(seed);
    if (c?.event?.duel?.result === result) return { ...c, seed };
  }
  throw new Error(`no seed with a debt fight ${result}`);
}
function findDoor() {
  for (let seed = 1; seed < 500; seed++) {
    let s = newRun({ seed });
    s = { ...s, regulars: { [DEE]: 3 } };
    const r = step(cfg, s, { do: 'sleep' });
    if (!r.state.door) continue;
    const q = step(cfg, r.state, { do: 'refuse' });
    const e = q.events.find(x => x.type === 'fight');
    if (e?.duel) return { seed, state: r.state, choice: { do: 'refuse' }, after: q.state, event: e };
  }
  throw new Error('no seed where the regular at the door swings');
}
const cases = { won: findDebt('won'), lost: findDebt('lost'), door: findDoor() };
for (const [k, c] of Object.entries(cases)) console.log(`headless ${k}: seed ${c.seed}, day ${c.state.day} ${c.state.hour}:00 at ${c.state.place}; the fight ${c.event.duel.result} in ${c.event.duel.seconds} s (${c.event.duel.chance.text}); ${c.event.text}`);

// ── THE PAGE ──────────────────────────────────────────────────────────────────────────────────────────────────────
const faults = [];
const fail = why => {
  faults.push(why);
  console.log(`  FAULT: ${why}`);
};
const KEYS = { ' ': ['Space', 32], Enter: ['Enter', 13] };
const browser = await launch({ width: 1600, height: 1000 });
let page = null;
const report = { cases: {}, pictures: [] };
try {
  page = await browser.open(base);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending', 180000);
  await ev('window.__demo.stage.actors.audit(true)');
  await page.sleep(1500);
  /** A real key, down and up (DevTools). */
  async function key(k) {
    const [code, vk] = KEYS[k] ?? (/^\d$/.test(k) ? [`Digit${k}`, 48 + Number(k)] : [`Key${k.toUpperCase()}`, k.toUpperCase().charCodeAt(0)]);
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && k.length === 1 ? { text: k } : {}) });
  }
  /** A real mouse press and release at a point of the page (DevTools). */
  async function click(x, y) {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
  async function shot(name) {
    const f = await page.shot(path.join(out, `${name}.jpg`));
    report.pictures.push(f);
    console.log(`  saved ${f}`);
  }
  /** Held still for a picture (the stage's own speed 0), then on. */
  async function still(name) {
    await ev('window.__demo.stage.setSpeed(0)');
    await page.sleep(350);
    await shot(name);
    await ev(`window.__demo.stage.setSpeed(${Number(speed)})`);
  }
  const duelState = () => ev('window.__demo.hud.duel');
  /** Loads a state and makes its choice with real keys: the dock's key for it, then Enter. */
  async function choose(c) {
    await page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending', 120000, 100);
    const ok = await ev(`window.__demo.hud.load(${JSON.stringify(c.state)})`, 60000);
    if (!ok) throw new Error('the page would not load the state');
    await page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending', 60000, 100);
    await page.sleep(900);
    const v = await ev('window.__demo.hud.view');
    const want = v.choices.find(x => x.choice.do === c.choice.do && (c.choice.id === undefined || x.choice.id === c.choice.id));
    if (!want) throw new Error(`no ${JSON.stringify(c.choice)} in the page's choices`);
    const k = await ev(`window.__demo.hud.keyFor(${JSON.stringify(want.key)})`);
    if (k) await key(k);
    else await ev(`window.__demo.hud.pick(${JSON.stringify(want.key)})`);
    await page.sleep(300);
    return want;
  }
  /** The page's state after the step against the headless one. */
  async function compare(name, c) {
    await page.waitFor('window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending || window.__demo.hud.phase === "report"', 120000, 100);
    const got = await ev('window.__demo.hud.state');
    const strip = s => JSON.stringify({ ...s, rig: undefined });
    if (strip(got) !== strip(c.after)) {
      const diff = Object.keys(c.after).filter(k => JSON.stringify(got[k]) !== JSON.stringify(c.after[k]));
      fail(`${name}: the page's state after the fight is not the headless one (${diff.join(', ')})`);
    } else console.log(`  ${name}: the page's state after it is the headless one (energy ${got.energy}, carried $${got.carried})`);
  }
  async function lastFight(name, c, { skipped = false } = {}) {
    const D = await duelState();
    const rec = D.log[D.log.length - 1];
    if (!rec) return fail(`${name}: no fight was played`);
    if (rec.result !== c.event.duel.result) fail(`${name}: the page's rules said ${rec.result}, headless ${c.event.duel.result}`);
    if (rec.mismatch) fail(`${name}: the fight seen ended ${rec.seen}, the rules said ${rec.result}`);
    // (anim-1, THE FIGHT'S TWO ENDS: its first blow within 2.5 s of its being called, control back within 4 s of its
    // last blow: demo/run/duel.js PACE; a fight that is slower fails here)
    for (const w of rec.slow ?? []) fail(`${name}: ${w}`);
    // (room-1: nobody not in it on its ground or at its edge: demo/tools/room-check.mjs)
    roomCheck(name, rec, fail);
    console.log(`  ${name}: the first blow ${rec.open ?? '(none)'} s after the fight was called; control back ${rec.close ?? '(skipped)'} s after the last blow`);
    if (!skipped && rec.skipped) fail(`${name}: it was skipped`);
    if (skipped && !rec.skipped) fail(`${name}: the skip did not take`);
    if (rec.frames.faults) fail(`${name}: the frame check found ${rec.frames.faults}: ${JSON.stringify(rec.frames.first.slice(0, 4))}`);
    console.log(`  ${name}: ${rec.skipped ? 'skipped' : `seen to the end, ${rec.seen}`} (the rules: ${rec.result}); ${rec.hits} blows landed; ${rec.stageSeconds} s of the stage's clock (the fight ${rec.seconds} s of it); ground moved ${rec.ground.moved} m, ${Math.round(rec.ground.open * 100)}% open; frames ${rec.frames.frames}, seen ${rec.frames.seen}, faults ${rec.frames.faults}, hidden ${rec.frames.hidden}; blows on time ${rec.anim.onTime}/${rec.anim.blows}`);
    report.cases[name] = rec;
  }

  /** One fight watched to its end, with its pictures. */
  async function watchOne(name, c) {
    console.log(`${name}:`);
    await choose(c);
    await shot(`${name}-1-card`);
    const t0 = Date.now();
    await key('Enter');
    await page.waitFor('window.__demo.hud.duel.active', 60000, 50);
    const t1 = Date.now();
    await page.waitFor('(s => s && s.phase === "square")(window.__demo.hud.duel.state)', 10000, 30).catch(() => {});
    await still(`${name}-2-before`);
    await page.waitFor('(s => !s || s.firstHit !== null)(window.__demo.hud.duel.state)', 30000, 20);
    await still(`${name}-3-first-blow`);
    const half = c.event.duel.seconds / 2;
    await page.waitFor(`(s => !s || s.t >= ${half})(window.__demo.hud.duel.state)`, 40000, 30);
    await still(`${name}-4-mid-fight`);
    await page.waitFor('(s => !s || (s.down && s.phase !== "fight"))(window.__demo.hud.duel.state)', 40000, 20);
    await page.sleep(500 / Number(speed));
    await still(`${name}-5-loser-down`);
    await page.waitFor('(s => !s || s.phase === "after")(window.__demo.hud.duel.state)', 30000, 30);
    await page.sleep(900 / Number(speed));
    await still(`${name}-6-after`);
    await page.waitFor('!window.__demo.hud.duel.active', 40000, 50);
    const t2 = Date.now();
    await compare(name, c);
    await page.sleep(600);
    await shot(`${name}-7-result-row`);
    report.cases[`${name}-seconds`] = { fight: (t2 - t1) / 1000, step: (t2 - t0) / 1000 };
    console.log(`  the fight on screen ${((t2 - t1) / 1000).toFixed(1)} s (with its pictures held still), the whole step ${((t2 - t0) / 1000).toFixed(1)} s`);
    await lastFight(name, c);
  }

  /** One fight skipped: `how` 'mouse' (the Skip button, pressed), ' ' or 'Enter'. */
  async function skipOne(name, c, how) {
    console.log(`${name} (skipped by ${how === 'mouse' ? 'a mouse press on Skip' : how === ' ' ? 'Space' : 'Enter'}):`);
    await choose(c);
    if (name === 'door-skip') await shot('door-1-card');
    await key('Enter');
    await page.waitFor('(s => s && s.phase === "fight" && s.t > 1.2)(window.__demo.hud.duel.state)', 60000, 30);
    if (how === 'mouse') {
      const box = await ev('(() => { const b = document.querySelector(".rn-duel-skip"); if (!b || b.closest("[hidden]")) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()');
      if (!box) return fail(`${name}: no Skip button to press`);
      await still(`${name}-button`);
      await click(box.x, box.y);
    } else await key(how);
    await page.waitFor('!window.__demo.hud.duel.active', 20000, 50);
    await compare(name, c);
    await page.sleep(500);
    await shot(`${name}-result-row`);
    await lastFight(name, c, { skipped: true });
  }

  // (--only won,door: some of them, to look at one again)
  const only = opt('--only', null)?.split(',') ?? null;
  const want = n => !only || only.includes(n);
  if (want('won')) await watchOne('won', cases.won);
  if (want('lost')) await watchOne('lost', cases.lost);
  if (want('door')) await watchOne('door', cases.door);
  if (want('door-skip')) await skipOne('door-skip', cases.door, 'mouse');
  if (want('won-skip')) await skipOne('won-skip', cases.won, ' ');
  if (want('lost-skip')) await skipOne('lost-skip', cases.lost, 'Enter');
  if (!want('noscenes')) throw Object.assign(new Error('(--only: no more)'), { quiet: true });

  // WITHOUT ACTING OUT (&scenes=0): the same state, the same choice, the same state after
  console.log('won, with no acting out (&scenes=0):');
  await page.send('Page.navigate', { url: `${base}&scenes=0` });
  await page.sleep(1500);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose" && !window.__demo.hud.odds?.pending', 180000);
  await choose(cases.won);
  await key('Enter');
  await compare('won-noscenes', cases.won);
  const D = await duelState();
  if (D.log.length) fail('won-noscenes: a fight was played with no acting out');

  const audit = await ev('(a => a && { overlaps: a.overlaps, vanish: a.vanish, feet: a.feet, heads: a.heads, furniture: a.furniture })(window.__demo.stage.actors.audit())').catch(() => null);
  report.audit = audit;
  console.log(`the stage's audit (the last page): ${JSON.stringify(audit)}`);
} catch (err) {
  if (!err?.quiet) fail(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
} finally {
  const bad = page ? page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]')) : [];
  if (bad.length) fail(`${bad.length} page errors: ${[...new Set(bad)].slice(0, 6).join(' | ').slice(0, 1500)}`);
  report.faults = faults;
  writeFileSync(path.join(out, 'run-duel.json'), `${JSON.stringify(report, null, 1)}\n`);
  await browser.close();
  console.log(faults.length ? `duel-fail: ${faults[0]}` : 'duel-ok');
  process.exitCode = faults.length ? 1 : 0;
}
