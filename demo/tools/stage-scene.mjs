#!/usr/bin/env node
// Pictures of two things that a season only shows now and then, staged on purpose in a played game: the jail with
// people held in it, and somebody shot in a robbery. The server must be running: node demo/serve.mjs
//
//   node demo/tools/stage-scene.mjs jail [--held 1|10] [--place jail|clinic]
//   node demo/tools/stage-scene.mjs shot [--kind rob:disaster:shot] [--block projects]
//        common: [--out demo/shots/scene] [--tag name] [--port 5470] [--seat robber] [--seed 4] [--night] [--query "figures=0"]
//
// jail   stands the player in the jail (stage.tour, the cut the panels' Continue makes), with `--held 10` every
//        seat with them, and takes the picture from the game's camera and from close; then lets the player out
//        and takes that. Prints what each held person wears, how far each is from the nearest of the city's own
//        people and from each other, and the audit's `overlaps` after five seconds of it.
// shot   plays one scene of the game's own (src/stage.mjs: by default the robbery that ends with the robber shot)
//        between the player, who fires, and another seat, through the director like any hour's, and takes the
//        picture before the shot, at it, as whoever is hit reels, goes down and lies, and ten seconds on from
//        the game's own camera (a seat that is not the player's is up and on its way to the clinic by then).
// --night sets the clock to 22:00 first.
import path from 'node:path';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const what = process.argv[2];
const out = path.resolve(opt('--out', 'demo/shots/scene'));
const tag = opt('--tag', what);
const night = process.argv.includes('--night');
const url = `http://127.0.0.1:${opt('--port', 5470)}/demo/?mode=play&seat=${opt('--seat', 'robber')}&seed=${opt('--seed', 4)}${opt('--query', '') ? '&' + opt('--query', '') : ''}`;

const browser = await launch();
let failed = false;
let page = null;
try {
  page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.stage.debug().people > 0', 150000);
  // past the first screens, the way a person would: the "you are" card, the night sheet if it is up
  await page.evaluate(`(() => { [...document.querySelectorAll('button')].find(b => /^\\s*start/i.test(b.textContent))?.click(); for (let k = 0; k < 4; k++) document.querySelector('.hk-skill:not([disabled])')?.click(); document.querySelector('[data-act="day"]')?.click(); })()`);
  await page.sleep(4000);
  await page.evaluate('window.__demo.stage.actors.audit(true)');
  const S = () => page.evaluate('window.__demo.stage.debug()', 8000);
  const you = (await S()).you;
  const shot = async name => console.log(`saved ${path.relative(process.cwd(), await page.shot(path.join(out, `${tag}-${name}.jpg`)))}`);
  const angle = a => page.evaluate(`(() => { const st = window.__demo.stage; st.camera.setAngle(${JSON.stringify(a)}); st.focus(${JSON.stringify(you)}); })()`);
  const CLOSE = { bearing: 90, down: 38, high: 6.5 };
  if (night) await page.evaluate('window.__demo.stage.setClock({ day: 1, hour: 22 })');

  if (what === 'jail') {
    const place = opt('--place', 'jail');
    const n = Number(opt('--held', 1));
    await page.evaluate(`window.__demo.stage.tour(${JSON.stringify(place)})`);
    if (n > 1) {
      await page.evaluate(`(() => { const st = window.__demo.stage, D = st.director; let k = 1; for (const P of D.people.values()) { if (P.kind !== 'agent' || P.id === ${JSON.stringify(you)} || k >= ${n}) continue; k += 1; D.settle(P.id, P.block ?? 'projects', 'street', ${JSON.stringify(place)}); } })()`);
    }
    await page.sleep(5500);
    await shot(`${place}-game`);
    const report = () => page.evaluate(`(() => {
      const st = window.__demo.stage;
      const on = st.actors.all().filter(a => !a.w.hide);
      const figs = st.figures?.all() ?? [];
      const rows = on.map(a => {
        const f = figs.map(F => Math.hypot(F.x - a.x, F.z - a.z)).sort((p, q) => p - q)[0];
        const o = on.filter(b => b !== a).map(b => Math.hypot(b.x - a.x, b.z - a.z)).sort((p, q) => p - q)[0];
        return a.id + ' at ' + a.x.toFixed(2) + ', ' + a.z.toFixed(2) + ' in ' + (a.clipName ?? 'no clip') + ', wearing ' + (a.outfit ?? 'their own') + ', a ' + (a.stand?.kind ?? 'no') + ' spot; nearest of the city\\'s people ' + (f === undefined ? 'none known' : f.toFixed(2) + ' m') + ', nearest of ours ' + (o === undefined ? 'nobody' : o.toFixed(2) + ' m');
      });
      const a = st.actors.audit();
      return { rows, figures: figs.length, audit: { overlaps: a.overlaps, overlapFrames: a.overlapFrames, byFigure: a.byFigure, close: a.close, unseated: a.unseated, examples: a.examples.filter(e => /^(overlap|close|unseated)/.test(e)) }, unfit: st.debug().unfit, tally: st.debug().tally };
    })()`);
    const R = await report();
    for (const row of R.rows) console.log(`  ${row}`);
    console.log(`the city's own people known: ${R.figures} · audit ${JSON.stringify(R.audit)} · unfit ${JSON.stringify(R.unfit)} · tally ${JSON.stringify(R.tally)}`);
    await angle(CLOSE);
    await page.sleep(2500);
    await shot(`${place}-close`);
    await angle({ bearing: 20, down: 30, high: 5 });
    await page.sleep(2500);
    await shot(`${place}-close2`);
    // let out: back on the street they were taken from
    await angle({});
    const street = await page.evaluate(`window.__demo.stage.director.people.get(${JSON.stringify(you)}).block`);
    await page.evaluate(`window.__demo.stage.tour(${JSON.stringify(street)})`);
    await page.sleep(5000);
    await shot(`${place}-released-game`);
    await angle(CLOSE);
    await page.sleep(2500);
    await shot(`${place}-released-close`);
    const R2 = await report();
    console.log(`let out at ${street}: ${R2.rows.find(r => r.startsWith(you + ' '))}`);
  } else if (what === 'shot') {
    const kind = opt('--kind', 'rob:disaster:shot');
    const block = opt('--block', null);
    if (block) {
      await page.evaluate(`window.__demo.stage.tour(${JSON.stringify(block)})`);
      await page.sleep(4000);
    }
    await angle(CLOSE);
    await page.sleep(1500);
    // one scene of the game's own, through the director, like any hour's: the player fires
    const cast = await page.evaluate(`(async () => {
      const [{ buildStage }, { planHour }] = await Promise.all([import('/src/stage.mjs'), import('/demo/stage/director-plan.js')]);
      const st = window.__demo.stage, D = st.director, you = ${JSON.stringify(you)};
      const here = D.placeOf(you);
      const other = [...D.people.values()].find(P => P.kind === 'agent' && P.id !== you && !P.away && D.placeOf(P.id) === here);
      if (!other) return null;
      const event = { kind: ${JSON.stringify(kind)}, t: 0, block: here, spot: 'street', big: true, who: { robber: other.id, target: you, owner: you }, lists: { bystanders: [] } };
      event.stage = buildStage(event);
      const agents = Object.fromEntries([...D.people.values()].filter(P => P.kind === 'agent').map(P => [P.id, { block: P.block, state: 'free', move: { verb: 'rest' } }]));
      const line = { t: 0, day: 1, hour: ${night ? 22 : 13}, events: [event], agents, npcs: {}, police: [] };
      window.__shot = null;
      D.on((w, info) => { if (w === 'shot') window.__shot = info; });
      window.__played = D.playHour(planHour(line, { classes: {}, prev: {}, held: null })).then(() => 'done', err => String(err?.stack ?? err));
      return { you, other: other.id, here, steps: event.stage.steps.map(s => s.actor + ' ' + s.action + (s.target ? ' ' + s.target : '')) };
    })()`);
    if (!cast) throw new Error('nobody else is at the player\'s place to play the scene with');
    console.log(`the scene: ${cast.steps.join(' · ')} at ${cast.here}`);
    await page.sleep(1500);
    await shot('before-the-shot');
    await page.waitFor('window.__shot', 60000, 50);
    console.log(`the shot: ${JSON.stringify(await page.evaluate('window.__shot'))}`);
    await page.sleep(180);
    await shot('at-the-shot');
    // (close on whoever was hit from here: the blood is theirs)
    await page.evaluate(`(() => { const st = window.__demo.stage; st.camera.setAngle({ bearing: 90, down: 55, high: 5 }); st.focus(${JSON.stringify(cast.other)}); })()`);
    await page.sleep(650);
    await shot('reeling');
    await page.sleep(2700);
    await shot('down');
    await page.sleep(1400);
    await shot('lying');
    console.log(`blood on stage: ${JSON.stringify(await page.evaluate('window.__demo.stage.gore?.stats() ?? null'))} · the victim: ${JSON.stringify(await page.evaluate(`(() => { const a = window.__demo.stage.actors.get(${JSON.stringify(cast.other)}); return { clip: a.clipName, hidden: !!a.w.hide }; })()`))}`);
    await page.sleep(7000);
    await angle({});
    await page.sleep(2500);
    await shot('after-game');
    console.log(`the hour: ${await Promise.race([page.evaluate('window.__played', 30000), page.sleep(20000).then(() => 'still playing')]).catch(() => 'still playing')}`);
  } else throw new Error('say what to stage: jail or shot');
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]/.test(l));
  if (bad.length) console.log(`page errors:\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}`);
} catch (err) {
  failed = true;
  console.error(String(err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-10).join('\n').slice(0, 2500));
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
