#!/usr/bin/env node
// ONE BLOODY PUNCH (gore.js blow()): the player punches one of the place's locals, through the director like any hour's
// scene, on a step that asks for blood (`blood: true`), and pictures of it just before the fist lands, as it lands,
// and two seconds after, each from the game's own camera and from a close side view (a picture view of this tool's;
// the game's camera is given back after). The stage is slowed to a third for the punch and held still for each
// picture. The server must be running: node demo/serve.mjs
//
//   node demo/tools/blood-punch.mjs --out <dir> [--port 5681] [--seed 3] [--place park] [--action punch|haymaker|scuffle]
//                                   [--query "blood=0"]   (the same with the blood left out: nothing must show)
import path from 'node:path';
import { launch } from './chrome.mjs';
import { SPOT_JS } from './clip-spot.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/blood-punch'));
const action = opt('--action', 'punch');
const query = opt('--query', '');
const url = `http://127.0.0.1:${opt('--port', 5681)}/demo/?mode=run&seed=${opt('--seed', '3')}${query ? '&' + query : ''}`;
const SLOW = 0.3;

const browser = await launch({ width: 1600, height: 1000 });
let page = null;
let failed = false;
try {
  page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 150000);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  await ev(`(async () => { const h = window.__demo.hud, s = structuredClone(h.state); Object.assign(s, { place: ${JSON.stringify(opt('--place', 'park'))}, hour: 12, hoursThere: 0 }); await h.load(s); })()`, 60000);
  await page.waitFor('window.__demo.hud.phase === "choose"', 120000);
  await page.sleep(3000);
  await ev(SPOT_JS);
  // the two: the player, and the nearest of the place's own people; the one punched stood on open ground, the player
  // three metres south of them, so the punch is thrown along a north-south line, side on to both cameras
  const cast = await ev(`(() => {
    const st = window.__demo.stage, AC = st.actors, me = AC.get('a1');
    const other = AC.all().filter(a => a.id !== 'a1' && !a.w.hide && st.director.people.get(a.id)?.kind === 'npc' && !/buyer|cart/.test(a.id)).sort((p, q) => Math.hypot(p.x - me.x, p.z - me.z) - Math.hypot(q.x - me.x, q.z - me.z))[0];
    if (!other) return null;
    const S = window.__spot([me.x, me.z], ['a1', other.id], 3.2);
    if (!S) return null;
    const [x, z] = S.at;
    AC.stop(other.id);
    AC.place(other.id, x, z + 1.2, Math.PI);
    AC.stop('a1');
    AC.place('a1', x, z - 2.2, 0);
    return { other: other.id, name: other.name, at: S.at, side: S.side, here: st.director.placeOf('a1') };
  })()`);
  if (!cast) throw new Error('no one to punch, or no open ground for it');
  console.log(`the punch: a1 at ${cast.other} (${cast.name}), ${action}, at ${cast.at.map(v => v.toFixed(1))} (${cast.here}); close view from the ${cast.side > 0 ? 'east' : 'west'}`);
  await page.sleep(1500);

  /** The moment, held still: the game's picture, then the close side view on the two, then the game's camera back. */
  async function both(name, view = 'side') {
    await ev('window.__demo.stage.setSpeed(0)');
    await page.sleep(250);
    console.log(`saved ${await page.shot(path.join(out, `${name}-game.png`))}`);
    await ev(`(() => { const city = window.__city, AC = window.__demo.stage.actors, A = AC.get('a1'), B = AC.get(${JSON.stringify(cast.other)});
      const [mx, mz] = [(A.x + B.x) / 2, (A.z + B.z) / 2], y = AC.groundAt(mx, mz);
      // (close, from over the game camera's own side of them, high: a stall's awning or a rail between a low camera
      // and the two hid them. For 'face': in front of whoever was hit, and high, to see the mark on the cheek)
      const cp = city.camera.position, [dx, dz] = [cp.x - B.x, cp.z - B.z], d = Math.hypot(dx, dz) || 1;
      const face = ${JSON.stringify(view)} === 'face', [fx, fz] = [Math.sin(B.w.yawS ?? B.ry), Math.cos(B.w.yawS ?? B.ry)];
      const p = face ? [B.x + fx * 3.2, y + 3.4, B.z + fz * 3.2] : [B.x + (dx / d) * 3.9, y + 5.0, B.z + (dz / d) * 3.9], t = [B.x, y + 0.9, B.z];
      city.VIEWS.hk2blood = { pos: p, tgt: t, fov: 40, sh: [(p[0] + t[0]) / 2, (p[2] + t[2]) / 2, 12] };
      city.cam?.toOrbit({ instant: true });
      city.setView('hk2blood'); })()`);
    await page.sleep(900);
    console.log(`saved ${await page.shot(path.join(out, `${name}-${view === 'face' ? 'face' : 'close'}.png`))}`);
    const stats = await ev(`({ blood: window.__demo.stage.gore?.stats() ?? null, a1: window.__demo.stage.actors.clipOf('a1'), them: window.__demo.stage.actors.clipOf(${JSON.stringify(cast.other)}) })`);
    console.log(`  ${name}: a1 ${stats.a1.name ?? '-'}@${(stats.a1.t ?? 0).toFixed(2)} · them ${stats.them.name ?? '-'}@${(stats.them.t ?? 0).toFixed(2)} · blood ${JSON.stringify(stats.blood)}`);
    await ev(`(() => { const st = window.__demo.stage; st.camera.focus(null); st.focus('a1'); st.camera.arrived(); })()`);
    await page.sleep(700);
  }

  // the scene, through the director like any hour's: one step, and it asks for blood
  await ev(`(async () => {
    const { planHour } = await import('/demo/stage/director-plan.js');
    const st = window.__demo.stage, D = st.director;
    const event = { kind: 'test:blood', t: 0, block: ${JSON.stringify(cast.here)}, spot: 'street', who: { agent: 'a1', target: ${JSON.stringify(cast.other)} },
      stage: { t: 0, block: ${JSON.stringify(cast.here)}, spot: 'street', steps: [{ actor: 'a1', action: ${JSON.stringify(action)}, target: ${JSON.stringify(cast.other)}, blood: true }] } };
    const line = { t: 0, day: 1, hour: 12, events: [event], agents: { a1: { block: ${JSON.stringify(cast.here)}, state: 'free', move: { verb: 'rest' } } }, npcs: {}, police: [] };
    window.__blow = null;
    D.on((w, info) => { if (w === 'blow') window.__blow = { ...info, clock: st.actors.clock }; });
    st.setSpeed(${SLOW});
    window.__played = D.playHour(planHour(line, { classes: {}, prev: {}, held: null })).then(() => 'done', err => String(err?.stack ?? err));
  })()`);
  const clip = { punch: 'punch', haymaker: 'haymaker', scuffle: 'scuffle_pair' }[action];
  const before = { punch: 0.12, haymaker: 0.02, scuffle: 0.12 }[action];
  await page.waitFor(`(c => c.name === ${JSON.stringify(clip)} && c.t >= ${before})(window.__demo.stage.actors.clipOf('a1'))`, 60000, 10);
  await both('1-before');
  await ev(`window.__demo.stage.setSpeed(${SLOW})`);
  const blew = await page.waitFor('window.__blow', 15000, 10).then(() => true, () => false);
  if (!blew) console.log('  (no blow was told: no blood asked for, or none landed)');
  await both('2-at-the-hit');
  const t0 = await ev('window.__blow?.clock ?? window.__demo.stage.actors.clock');
  // (and the drops in the air, a beat after)
  await ev(`window.__demo.stage.setSpeed(${SLOW})`);
  await page.waitFor(`window.__demo.stage.actors.clock >= ${t0 + 0.2}`, 60000, 10);
  await both('2b-drops-in-the-air');
  await ev(`window.__demo.stage.setSpeed(${SLOW})`);
  await page.waitFor(`window.__demo.stage.actors.clock >= ${t0 + 2}`, 60000, 10);
  await both('3-two-seconds-after');
  await both('3-two-seconds-after', 'face');
  console.log(`the blow: ${JSON.stringify(await ev('window.__blow'))}`);
  await ev('window.__demo.stage.setSpeed(1)');
  console.log(`the hour: ${await Promise.race([ev('window.__played', 30000), page.sleep(20000).then(() => 'still playing')]).catch(() => 'still playing')}`);
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]/.test(l));
  if (bad.length) console.log(`page errors:\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}`);
} catch (err) {
  failed = true;
  console.error(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-10).join('\n').slice(0, 2500));
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
