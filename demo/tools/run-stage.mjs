#!/usr/bin/env node
// Plays THE RUN over the real stage in headless Chrome, with the stage's audit on, and says how it went.
// The server must be running: node demo/serve.mjs --port 5507
//
//   node demo/tools/run-stage.mjs [--policy market|park|rough|drink|bins|lean|refuse|mixed|neighbour|burner] [--seed 3] [--days 6]
//                                 [--speed 1|2|4] [--skip K] [--kit pocket,cutter,bed] [--port 5470] [--json out.json]
// It also says how many times each move was played (`moves`: the street's rob, bins, shop, rough, the door's give and
// refuse, beside the jobs and the rides), so a run shows which of the new moves its policy reached.
//
// The page is /demo/?mode=run&runtest=<policy> (demo/run/autoplay.js): a scripted player from src/run/policies.mjs makes
// every choice and every card is pressed on. It ends with one line, `run-ok` or `run-fail: <why>`, then the audit's
// counts (demo/stage/actors.js audit()), seconds per day and the scenes' lengths. Fails on any page error, any
// `overlaps` (somebody of ours inside one of the city's own people), any `furniture` (somebody of ours standing or
// walking in something low of the city's: a chair, a low table), any `vanish` (somebody of ours coming on, going
// off or moved at once where the camera's picture shows them, with no cut of the whole picture) or any `feet`
// (somebody of ours standing or walking outdoors more than 3 cm under or 5 cm over the ground as it is drawn, for
// more than a quarter of a second: demo/stage/surface.js) or any `heads` (two of ours standing, not in a contact step
// with each other, whose heads overlap in the picture for more than half a second: actors.js auditHeads).
import { writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const params = new URLSearchParams({ mode: 'run', runtest: opt('--policy', 'market'), seed: opt('--seed', '3'), days: opt('--days', '6'), speed: opt('--speed', '1') });
if (opt('--skip', null)) params.set('skip', opt('--skip'));
if (opt('--kit', null)) params.set('kit', opt('--kit'));
// (--query "ground=plan": more of the page's own switches, to measure what a change did)
const url = `http://127.0.0.1:${opt('--port', 5470)}/demo/?${params}${opt('--query', '') ? '&' + opt('--query', '') : ''}`;
const COUNTS = ['scenes', 'walks', 'overlaps', 'furniture', 'vanish', 'feet', 'heads', 'unseated', 'slides', 'pushes', 'seams', 'jumps', 'pops', 'close', 'through', 'flips', 'speedSteps', 'headingSnaps', 'inRoad', 'squeezes'];

const browser = await launch();
let ok = false;
let page = null;
try {
  const t0 = Date.now();
  page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud', 150000);
  console.log(`the city, the stage and the panels are up after ${((Date.now() - t0) / 1000).toFixed(1)} s · ${url}`);
  await page.evaluate('window.__demo.stage.actors.audit(true)');
  const limit = Number(opt('--limit', 3000)) * 1000;
  let title = '';
  let said = -1;
  while (Date.now() - t0 < limit) {
    title = await page.evaluate('document.title', 10000).catch(() => '');
    if (title.startsWith('run-')) break;
    const d = await page.evaluate('window.__demo.hud.state.day', 5000).catch(() => null);
    if (d !== null && d !== said) {
      said = d;
      console.log(`  day ${d} at ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    await page.sleep(2000);
  }
  const R = await page.evaluate('window.__runtest ?? null', 10000).catch(() => null);
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  const audit = R?.audit ?? {};
  ok = title === 'run-ok' && !bad.length && (audit.overlaps ?? 1) === 0 && (audit.furniture ?? 1) === 0 && (audit.vanish ?? 1) === 0 && (audit.feet ?? 1) === 0 && (audit.heads ?? 1) === 0;
  const verdict = ok ? 'run-ok' : `run-fail: ${title.startsWith('run-fail') ? title.slice(10) : bad.length ? `${bad.length} page errors` : (audit.overlaps ?? 0) > 0 ? `${audit.overlaps} overlaps` : (audit.furniture ?? 0) > 0 ? `${audit.furniture} in furniture` : (audit.vanish ?? 0) > 0 ? `${audit.vanish} came on or went off in the picture` : (audit.feet ?? 0) > 0 ? `${audit.feet} with their feet off the ground` : (audit.heads ?? 0) > 0 ? `${audit.heads} heads over each other` : title || 'no verdict'}`;
  if (R) {
    const perDay = R.daySeconds ?? [];
    const lengths = (R.lengths ?? []).slice().sort((a, b) => a - b);
    const median = a => (a.length ? a[Math.floor(a.length / 2)] : null);
    console.log(`policy ${R.policy}, seed ${R.seed}: ${R.days} days in ${R.seconds} s, ${R.steps} steps, done ${R.done ? `in ${R.done} days` : 'not yet'}; troubles ${JSON.stringify(R.troubles)}; skipped ${R.skipped}`);
    console.log(`seconds per day: ${perDay.join(', ')} (median ${median(perDay.slice().sort((a, b) => a - b))})`);
    console.log(`stage hours (s at 1x): median ${median(lengths)}, longest ${lengths[lengths.length - 1] ?? '-'}, n ${lengths.length}`);
    const steps = {};
    for (const { what, s } of R.stepSeconds ?? []) (steps[what] ??= []).push(s);
    console.log(`wall seconds per step, median by kind: ${Object.entries(steps).map(([k, v]) => `${k} ${median(v.slice().sort((a, b) => a - b))} (n${v.length})`).join(' · ')}`);
    console.log(`fps mean ${R.fpsMean}, worst second ${R.fpsWorst}; tally ${JSON.stringify(R.tally)}`);
    const NEW = ['rob', 'bins', 'shop', 'rough', 'give', 'refuse'];
    console.log(`moves played: ${Object.entries(R.moves ?? {}).map(([k, n]) => `${k} ${n}`).join(' · ')}; the new ones: ${NEW.map(k => `${k} ${R.moves?.[k] ?? 0}`).join(' · ')}; targets picked ${R.picked ?? 0}`);
    console.log(`events: ${Object.entries(R.kinds ?? {}).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    // (trust-1: who called it in or kept quiet, who was turned against you or won over, and who is not neutral at the end)
    const T = R.trust;
    if (T) console.log(`trust: witnesses called ${T.called}, kept quiet ${T.quiet}; turned against you ${T.against.length}${T.against.length ? ` (${T.against.join(', ')})` : ''}; won over ${T.with.length}${T.with.length ? ` (${T.with.join(', ')})` : ''}; looked away ${T.lookedAway}; sore ${T.sore}; notices ${T.notices}; at the end ${T.end?.length ? T.end.join(', ') : 'everyone neutral'}`);
  }
  console.log(`page errors ${bad.length} · ${COUNTS.map(k => `${k} ${audit[k] ?? '-'}`).join(' · ')}`);
  if (bad.length) console.log(`  ${[...new Set(bad)].slice(0, 8).join('\n  ').slice(0, 2500)}`);
  const seen = (audit.examples ?? []).filter(e => /^(vanish|furniture|overlap|feet|heads) /.test(e));
  if (seen.length) console.log(`  ${seen.slice(0, 10).join('\n  ')}`);
  if (R?.errors?.length) console.log(`  run errors: ${R.errors.join('\n  ').slice(0, 1500)}`);
  if (opt('--json', null)) writeFileSync(opt('--json'), JSON.stringify({ verdict, R, logs: page.logs.slice(-200) }, null, 1));
  console.log(verdict);
} catch (err) {
  console.error(String(err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
  console.log('run-fail: the tool fell over');
} finally {
  await browser.close();
}
process.exit(ok ? 0 : 1);
