#!/usr/bin/env node
// Plays THE RUN over the real stage in headless Chrome, with the stage's audit on, and says how it went.
// The server must be running: node demo/serve.mjs --port 5507
//
//   node demo/tools/run-stage.mjs [--policy market|park|rough|drink|bins|lean|refuse|mixed|neighbour|burner|dealer|walker|skater|homefirst|guard|racer]
//                                 [--seed 3] [--days 6] [--speed 1|2|4] [--skip K] [--kit pocket,cutter,bed,board] [--port 5470] [--json out.json]
// (routes-1: the walker goes to the market on foot both ways by Fit Street and plays the stop's cards; the skater on the
// board: give it --kit board. Their line `routes:` says the ways set out on, the legs, the cards played)
// (home-1: --policy homefirst|guard|racer, the pressured player ignoring the attempts it brings, putting Cousin Earl on
// its step for the day one is due, racing home on a notice. Their line `home:` says the warnings, the notices, the
// attempts met at the door and settled while out, and the days Earl was paid)
// (save-1: --reload-at <step|notice|warning|door|guard> plays the run with the page's save on (&save=1, started fresh with
// &new=1), reloads the page once at that step (the page's own count of steps), or at the first choice point with a home
// notice up, a warning standing, a regular at the door or Cousin Earl on the step, lets it pick the run up and plays
// on (--arranged: just before the reload a thing of the crib is put away, as a player arranging it would, and after it
// the arrangement must come back the same, read for the run's own seed).
// --compare <json of an unbroken run's --json> then says whether the final state, at the step that ended the last
// day, is the same: `same final state` or where it differs. Its lines say where it was cut and what came back.)
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
// with each other, whose heads overlap in the picture for more than half a second of the game's own clock:
// actors.js auditHeads, demo/stage/heads.js).
import { writeFileSync, readFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const params = new URLSearchParams({ mode: 'run', runtest: opt('--policy', 'market'), seed: opt('--seed', '3'), days: opt('--days', '6'), speed: opt('--speed', '1') });
if (opt('--skip', null)) params.set('skip', opt('--skip'));
if (opt('--kit', null)) params.set('kit', opt('--kit'));
const reloadAt = opt('--reload-at', null);
if (reloadAt) params.set('save', '1');
// (--query "ground=plan": more of the page's own switches, to measure what a change did)
const url = `http://127.0.0.1:${opt('--port', 5470)}/demo/?${params}${opt('--query', '') ? '&' + opt('--query', '') : ''}`;
// (the first load starts the run fresh and replaces any save; the reload is the same link without it)
const firstUrl = reloadAt ? `${url}&new=1` : url;
const COUNTS = ['scenes', 'walks', 'overlaps', 'furniture', 'vanish', 'feet', 'heads', 'unseated', 'slides', 'pushes', 'seams', 'jumps', 'pops', 'close', 'through', 'flips', 'speedSteps', 'headingSnaps', 'inRoad', 'squeezes'];

const browser = await launch();
let ok = false;
let page = null;
try {
  const t0 = Date.now();
  page = await browser.open(firstUrl);
  await page.waitFor('window.__demo && window.__demo.hud', 150000);
  console.log(`the city, the stage and the panels are up after ${((Date.now() - t0) / 1000).toFixed(1)} s · ${firstUrl}`);
  await page.evaluate('window.__demo.stage.actors.audit(true)');
  const limit = Number(opt('--limit', 3000)) * 1000;
  let title = '';
  let said = -1;
  // (save-1: the cut, once: at the page's step N, or at the first choice point where the condition holds)
  const CUT = { notice: 'v.home?.notice', warning: 'v.home?.warning', door: 'v.door', guard: 'v.home?.defences?.guard?.on' };
  const cutTest = !reloadAt ? null : Number.isInteger(Number(reloadAt)) ? `window.__demo.hud.steps >= ${Number(reloadAt)}` : `(H => { const v = H.view; return H.phase === 'choose' && !!(${CUT[reloadAt] ?? 'false'}); })(window.__demo.hud)`;
  let cut = null;
  // (a condition holds at one choice point only, and the scripted player answers 120 ms after it comes: the page watches
  // for it itself and reloads itself, keeping where it was cut and its audit so far for this tool, sessionStorage)
  const CUT_INFO = '(H => ({ steps: H.steps, day: H.state.day, hour: H.state.hour, place: H.state.place, phase: H.phase, saved: H.saved.at, notice: !!H.view.home?.notice, warning: !!H.view.home?.warning, door: !!H.view.door, guard: !!H.view.home?.defences?.guard?.on, audit: Object.fromEntries(Object.entries(window.__demo.stage.debug().audit ?? {}).filter(([, n]) => typeof n === "number")) }))(window.__demo.hud)';
  const watching = !!cutTest && !Number.isInteger(Number(reloadAt));
  if (watching) {
    await page.evaluate(`(() => { const t = setInterval(() => { try { if (!(${cutTest})) return; } catch { return; } clearInterval(t); sessionStorage.setItem('hk2.cut', JSON.stringify(${CUT_INFO})); window.__cutGone = true; location.href = ${JSON.stringify(url)}; }, 10); return true; })()`, 10000);
  }
  while (Date.now() - t0 < limit) {
    title = await page.evaluate('document.title', 10000).catch(() => '');
    if (title.startsWith('run-')) break;
    const watched = watching && !cut ? await page.evaluate(`sessionStorage.getItem('hk2.cut')`, 5000).catch(() => null) : null;
    if (cutTest && !cut && (watched || (!watching && (await page.evaluate(`!!(${cutTest})`, 5000).catch(() => false))))) {
      cut = watched ? JSON.parse(watched) : await page.evaluate(CUT_INFO, 10000);
      console.log(`  reloading at step ${cut.steps}: day ${cut.day} ${cut.hour}:00 at ${cut.place} (${cut.phase}); saved as of ${cut.saved ? `day ${cut.saved.day} ${cut.saved.clock}` : 'nothing'}${cut.notice ? '; a notice up' : ''}${cut.warning ? '; a warning standing' : ''}${cut.door ? '; a regular at the door' : ''}${cut.guard ? '; Earl on the step' : ''}`);
      // (a thing moved in the crib, as a player arranging it would leave it: kept per seed, read back after the reload)
      if (process.argv.includes('--arranged')) {
        cut.arranged = await page.evaluate(`(async () => {
          const arr = window.__demo.stage.inside.place('pad:a1')?.arrange;
          if (!arr) return { ok: false, why: 'no arrangement' };
          await arr.ready();
          const ps = arr.pieces().filter(q => !q.fixed);
          let r = null;
          for (const q of ps) { r = await arr.putAway(q.key); if (r?.ok) { r.key = q.key; break; } }
          await new Promise(res => setTimeout(res, 300));
          return { ...r, record: arr.record(), kept: Object.keys(localStorage).filter(k => k.startsWith('hk2.run.arrange.')) };
        })()`, 30000).catch(err => ({ ok: false, why: String(err) }));
        console.log(`  arranged before the reload: ${cut.arranged.ok ? `${cut.arranged.key} put away; kept as ${cut.arranged.kept.join(', ')}` : cut.arranged.why}`);
      }
      // (the audit of the part before the reload, cut.audit: the page's own is lost with it, so its counts are added below)
      // (with --arranged the link names another seed: the run picked up is the slot's whatever the link says, and its
      // arrangement is read for its own seed. Watched, the page has reloaded itself already)
      if (!watched) await page.evaluate('window.__cutGone = true', 5000).catch(() => null);
      if (!watched) await page.send('Page.navigate', { url: process.argv.includes('--arranged') ? url.replace(/seed=\d+/, 'seed=999') : url });
      await page.sleep(1500);
      await page.waitFor('!window.__cutGone && window.__demo && window.__demo.hud && window.__demo.hud.phase', 150000);
      const back = await page.evaluate('(H => ({ ...H.saved, day: H.state.day, hour: H.state.hour, place: H.state.place, seed: H.state.seed, url: location.search }))(window.__demo.hud)', 10000);
      cut.back = back;
      if (cut.arranged?.ok) {
        const want = JSON.stringify(cut.arranged.record);
        cut.arrangedBack = await page.waitFor(`(() => { const a = window.__demo.stage.inside?.place?.('pad:a1')?.arrange; return !!a && JSON.stringify(a.record()) === ${JSON.stringify(want)}; })()`, 90000, 500).then(() => true, () => false);
        console.log(`  the arrangement back after the reload: ${cut.arrangedBack ? 'yes, the same' : 'NO'}`);
      }
      console.log(`  picked up: ${back.picked ? 'yes' : 'NO'}, day ${back.day} ${back.hour}:00 at ${back.place}, seed ${back.seed}; "${back.note ?? ''}"${back.reportDue ? '; the report again' : ''}${back.after ? '; coming home to a missed attempt' : ''} · ${back.url}`);
      await page.evaluate('window.__demo.stage.actors.audit(true)').catch(() => null);
      said = -1;
    }
    const d = await page.evaluate('window.__demo.hud.state.day', 5000).catch(() => null);
    if (d !== null && d !== said) {
      said = d;
      console.log(`  day ${d} at ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    await page.sleep(2000);
  }
  const R = await page.evaluate('window.__runtest ?? null', 10000).catch(() => null);
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  const audit = { ...(R?.audit ?? {}) };
  for (const [k, n] of Object.entries(cut?.audit ?? {})) if (typeof audit[k] === 'number') audit[k] += n;
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
    // (goods-1: packs bought where, sales that used a good where, rides with goods on you, goods lost to jumps and stops)
    const G = R.goods;
    if (G) console.log(`goods: packs ${Object.entries(G.packs).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}; sold ${Object.entries(G.sold).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}; rides carrying goods ${G.carriedRides}; taken in jumps ${G.lost}, seized ${G.seized}; errands ${G.errands}, things ${G.things}, put on ${G.worn}`);
    const Rt = R.routes;
    if (Rt) console.log(`routes: walks ${Rt.walks}, skates ${Rt.skates}, legs on from a stop ${Rt.onward}; cards ${Object.entries(Rt.cards).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}; on the way's ground jumped ${Rt.jumped}, stopped ${Rt.stopped}`);
    // (home-1: warnings, notices, attempts met at the door and settled while out, Earl's paid days, races home)
    const Hm = R.home;
    if (Hm) console.log(`home: warnings ${Hm.warnings}, notices ${Hm.notices}, attempts met at the door ${Hm.met}, settled while out ${Hm.settled} (taken ${Hm.taken}, held ${Hm.held}), Earl hired ${Hm.hires ?? 0} (kept on ${Hm.kept ?? 0}; last days ${Hm.lastDays ?? 0}, gone ${Hm.gone ?? 0}), called off ${Hm.calledOff}, raced home on a notice ${Hm.raced}${Hm.outcomes.length ? `; ${Hm.outcomes.join(' · ')}` : ''}`);
    if (T) console.log(`trust: witnesses called ${T.called}, kept quiet ${T.quiet}; turned against you ${T.against.length}${T.against.length ? ` (${T.against.join(', ')})` : ''}; won over ${T.with.length}${T.with.length ? ` (${T.with.join(', ')})` : ''}; looked away ${T.lookedAway}; sore ${T.sore}; notices ${T.notices}; at the end ${T.end?.length ? T.end.join(', ') : 'everyone neutral'}`);
  }
  console.log(`page errors ${bad.length} · ${COUNTS.map(k => `${k} ${audit[k] ?? '-'}`).join(' · ')}`);
  if (bad.length) console.log(`  ${[...new Set(bad)].slice(0, 8).join('\n  ').slice(0, 2500)}`);
  const seen = (audit.examples ?? []).filter(e => /^(vanish|furniture|overlap|feet|heads) /.test(e));
  if (seen.length) console.log(`  ${seen.slice(0, 10).join('\n  ')}`);
  // (the longest spells of heads over each other, noted or not: seconds of the game and of the wall, actors.js auditHeads)
  const spells = audit.spells ?? [];
  if (spells.length) console.log(`head spells: ${spells.slice(0, 4).map(s => `${s.key} ${s.game.toFixed(2)} s (${s.real.toFixed(2)} s of the wall), ${(100 * s.max).toFixed(0)}%`).join(' · ')}`);
  if (R?.errors?.length) console.log(`  run errors: ${R.errors.join('\n  ').slice(0, 1500)}`);
  // (save-1: the final state against an unbroken run's; and the reload must have picked the run up)
  let same = null;
  let why = null;
  if (opt('--compare', null)) {
    const other = JSON.parse(readFileSync(opt('--compare'), 'utf8'));
    const a = other.R?.endState ?? null;
    const b = R?.endState ?? null;
    const diff = (x, y, at = '') => {
      if (JSON.stringify(x) === JSON.stringify(y)) return null;
      if (!x || !y || typeof x !== 'object' || typeof y !== 'object') return `${at || 'the state'}: ${JSON.stringify(x)?.slice(0, 80)} against ${JSON.stringify(y)?.slice(0, 80)}`;
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
        const d = diff(x[k], y[k], at ? `${at}.${k}` : k);
        if (d) return d;
      }
      return `${at}: key order`;
    };
    same = !!a && !!b && !diff(a, b);
    console.log(!a || !b ? 'compare: a final state is missing' : same ? `compare: same final state (day ${b.day} ${b.hour}:00, banked $${b.banked}, carried $${b.carried}, energy ${b.energy})` : `compare: DIFFERENT final state: ${diff(a, b)}`);
    if (!same) why = 'the final state differs';
  }
  if (reloadAt && (!cut || !cut.back?.picked)) why = cut ? 'the reload did not pick the run up' : 'the run never reached the cut';
  if (cut?.arranged?.ok && !cut.arrangedBack) why = 'the arrangement did not come back';
  const said2 = why && ok ? `run-fail: ${why}` : verdict;
  if (why) ok = false;
  if (opt('--json', null)) writeFileSync(opt('--json'), JSON.stringify({ verdict: said2, R, cut, same, logs: page.logs.slice(-200) }, null, 1));
  console.log(said2);
} catch (err) {
  console.error(String(err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-12).join('\n').slice(0, 3000));
  console.log('run-fail: the tool fell over');
} finally {
  await browser.close();
}
process.exit(ok ? 0 : 1);
