#!/usr/bin/env node
// THE CLIP SHEET: what the stage has to make a robbery or a debt hit harder with. Every clip of the city's that is a
// hit, a threat or a grab, a reaction to one, a fall and a getting up, or a hand-over or a search, played on THE RUN's
// own people (the player and one of the place's locals), as a strip of frames across the clip: each frame twice, from
// the game's own camera (its Lock, untouched) and from a close side view (a picture view of this tool's, the way
// run-people-shots.mjs takes its close-ups; the game's camera is given back after). A pair is played with its partner
// doing the matching reaction, from the clips' own `pair` (gap, delay).
//
// HELD STILL, NOT TIMED: the stage is stopped (setSpeed(0)) and each body is posed at the exact clip clock of the frame
// on its own gait state (the registry's playClip at that clock, full weight), so a frame is the clip's own pose at
// that time and not wherever a screenshot happened to land. Clips that walk under a walk of their own (shove_walk,
// winded_walk) are played live instead, slowed down, and caught as their clocks cross each frame's time.
//
//   node demo/tools/clip-sheet.mjs --out <dir> [--port 5681] [--seed 3] [--only punch,haymaker]
//
// Writes <dir>/frames/<clip>-<k>-game.png and -close.png, and <dir>/frames.json (every frame: its file, the clip
// clocks of both bodies, and the box round the two on the picture) for clip-sheet.py, which lays out the sheets.
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const out = path.resolve(opt('--out', 'demo/shots/clip-sheet'));
const port = opt('--port', 5681);
const only = opt('--only', null)?.split(',') ?? null;
const url = `http://127.0.0.1:${port}/demo/?mode=run&seed=${opt('--seed', '3')}`;

// THE CLIPS. group: the sheet it is on. lead: the player's clip. partner: the other's (null: alone; the other stands
// well off). delay: when the partner's starts, on the lead's clock (the clip's own pair.delay when it has one).
// contact: the lead clock of the moment it lands (one frame is put exactly there). live: played walking (see above).
// gap: how far apart (the clip's pair.gap, else 1.2). frames: the lead clock of each frame (default: six across).
const SHEET = [
  // hits
  { group: 'hits', lead: 'punch', partner: 'stagger', contact: 0.22 },
  { group: 'hits', lead: 'haymaker_wind', partner: null, note: 'the wind-up, alone (its pair delay 2.65 s is the haymaker after it)' },
  { group: 'hits', lead: 'haymaker', partner: 'stagger', contact: 0.08 },
  { group: 'hits', lead: 'shove_walk', partner: 'hit_stumble_back', delay: 0, contact: 0.1, live: true, gap: 1.15 },
  { group: 'hits', lead: 'scuffle_pair', partner: 'scuffle_partner', contact: 0.25 },
  { group: 'hits', lead: 'vault_shove', partner: 'guard_bowled', contact: 1.75, frames: [0.3, 0.9, 1.4, 1.75, 2.2, 2.68] },
  { group: 'hits', lead: 'crate_ram', partner: 'crate_rammed', contact: 1.25 },
  { group: 'hits', lead: 'aim_fire', partner: 'shot_hit', delay: 0.1, contact: 0.03, start: { lead: 'aim_hold' } },
  // threats and grabs
  { group: 'threats', lead: 'aim_draw', partner: 'hands_up_point', delay: 0.45 },
  { group: 'threats', lead: 'aim_hold', partner: 'hands_up_point', delay: -1 },
  { group: 'threats', lead: 'aim_lower', partner: 'hands_up_point', delay: -2 },
  { group: 'threats', lead: 'rob_lunge_grab', partner: 'hit_stumble_back', contact: 0.34 },
  { group: 'threats', lead: 'cuff_apply', partner: 'cuffed_idle', contact: 1.3 },
  { group: 'threats', lead: 'crate_tug', partner: 'crate_tug_lose', contact: 3.65, frames: [0.4, 1.3, 1.8, 2.7, 3.65, 4.5] },
  { group: 'threats', lead: 'guarded_stance', partner: null },
  // reactions
  { group: 'reactions', lead: 'stagger', partner: null },
  { group: 'reactions', lead: 'hit_stumble_back', partner: null },
  { group: 'reactions', lead: 'hands_up_point', partner: null },
  { group: 'reactions', lead: 'cower', partner: null },
  { group: 'reactions', lead: 'shot_hit', partner: null },
  { group: 'reactions', lead: 'guard_bowled', partner: null },
  { group: 'reactions', lead: 'crate_rammed', partner: null },
  { group: 'reactions', lead: 'withdrawal_shake', partner: null },
  // going down and getting up
  { group: 'down', lead: 'fall_back', partner: null },
  { group: 'down', lead: 'shove_fall', partner: null },
  { group: 'down', lead: 'death_collapse', partner: null },
  { group: 'down', lead: 'lie_hurt', partner: null },
  { group: 'down', lead: 'lie_still', partner: null },
  { group: 'down', lead: 'get_up', partner: null },
  { group: 'down', lead: 'walk_hurt', partner: null },
  { group: 'down', lead: 'winded_rest', partner: null },
  { group: 'down', lead: 'winded_walk', partner: null, live: true },
  { group: 'down', lead: 'crash_slump', partner: null },
  // hand-overs and searches
  { group: 'handover', lead: 'brush_pass', partner: 'brush_pass', contact: 0.28 },
  { group: 'handover', lead: 'bribe_pass', partner: 'bribe_take', contact: 0.72 },
  { group: 'handover', lead: 'pat_pockets', partner: null },
  { group: 'handover', lead: 'pick_up', partner: null, contact: 0.27 },
  { group: 'handover', lead: 'parcel_tuck', partner: null },
].filter(c => !only || only.includes(c.lead));

const browser = await launch({ width: 1600, height: 1000 });
let page = null;
let failed = false;
const frames = [];
try {
  page = await browser.open(url);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 150000);
  await page.sleep(2500);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  // out of the crib, to the place (a loaded state, as run-people-shots.mjs carries the run to a job): its locals are there
  await ev(`(async () => { const h = window.__demo.hud, s = structuredClone(h.state); Object.assign(s, { place: ${JSON.stringify(opt('--place', 'park'))}, hour: 12, hoursThere: 0 }); await h.load(s); })()`, 60000);
  await page.waitFor('window.__demo.hud.phase === "choose"', 120000);
  await page.sleep(4000);
  // the helper in the page: who plays, where, and a body posed at a clip clock
  const cast = await ev(`(() => {
    const st = window.__demo.stage, AC = st.actors, C = AC.CLIPS, city = window.__city;
    const you = 'a1', me = AC.get(you);
    // the other: the nearest of the place's people to the player who is in view
    const others = AC.all().filter(a => a.id !== you && !a.w.hide && !/buyer|cart/.test(a.id + ' ' + a.name)).sort((p, q) => Math.hypot(p.x - me.x, p.z - me.z) - Math.hypot(q.x - me.x, q.z - me.z));
    const other = others[0]?.id ?? null;
    if (!other) return null;
    // THE MARK: open ground near where the player stands (nothing solid within 2.5 m), with the close view's line
    // clear: nothing solid, and none of ours or the city's stood people, between it and a camera 9 m to the east or west
    const people = [...AC.all().filter(a => a.id !== you && a.id !== other && !a.w.hide).map(a => [a.x, a.z]), ...(st.figures?.all?.() ?? []).map(F => [F.x, F.z])];
    let at = null, side = 1, tested = 0;
    for (let r = 0; r <= 70 && !at; r += 1) for (let k = 0; k < Math.max(1, r * 6) && !at; k++) {
      const x = me.x + Math.sin(k * 2 * Math.PI / Math.max(1, r * 6)) * r, z = me.z + Math.cos(k * 2 * Math.PI / Math.max(1, r * 6)) * r;
      let ok = AC.solidKnown(x, z) && !AC.onRoad?.(x, z);
      for (let rr = 0.5; ok && rr <= 2.5; rr += 0.5) for (let q = 0; q < 16 && ok; q++) if (AC.solidAt(x + Math.sin(q * Math.PI / 8) * rr, z + Math.cos(q * Math.PI / 8) * rr)) ok = false;
      if (!ok) continue;
      for (const s of [1, -1]) {
        let line = true;
        // (off the walkers' lanes, the corridor too: a walker of the city's stood in front of the pair)
        for (let e = -1; line && e <= 9; e += 1) for (const dz of [-1, 0.6, 2.2]) if (city.peds.sim.laneNear(x + s * e, z + dz, 1.3)) line = false;
        if (line && people.some(([px, pz]) => (px - x) * s > -1.5 && (px - x) * s < 9 && pz > z - 1.5 && pz < z + 3)) line = false;
        // (and what is drawn: a stall's awning or a sign is no solid of the walkers' but stands in the picture)
        if (line) {
          const y = AC.groundAt(x, z), R = new city.THREE.Raycaster(), from = new city.THREE.Vector3(x + s * 8.5, y + 3, z + 0.6);
          R.camera = city.camera;
          for (const [dz, dy] of [[-0.6, 0.3], [-0.6, 1.6], [0.6, 0.9], [1.8, 0.3], [1.8, 1.6], [0.6, 2.3]]) {
            const to = new city.THREE.Vector3(x, y + dy, z + dz), d = from.distanceTo(to);
            R.set(from, to.clone().sub(from).normalize());
            R.far = d - 1.3;
            if (R.intersectObject(city.scene, true).some(h => h.object.visible !== false)) { line = false; break; }
          }
          tested += 1;
        }
        if (line) { at = [x, z]; side = s; break; }
      }
    }
    at ??= [me.x, me.z];
    const posed = (id, name, t) => {
      const A = AC.get(id), g = A.w.g;
      if (!g) return false;
      A.want = A.asked = null;
      C.clearClip(g);
      if (!name) return true;
      let c = C.CLIP[name];
      // (past its end: on into what it chains to, as the city plays it; a one-shot that ends there holds its last pose)
      while (t > c.dur && c.next) { t -= c.dur; c = C.CLIP[c.next]; }
      if (!c.loop) t = Math.min(t, c.dur - 0.004);
      else t = ((t % c.dur) + c.dur) % c.dur;
      C.playClip(g, c.name, { t, snap: true });
      g.clip.w = 1;
      return c.name + '@' + t.toFixed(2);
    };
    const mark = (lead, partner, gap) => {
      const [x, z] = at;
      const y = AC.groundAt(x, z);
      // the two along the north-south line, side on to the game's camera (it looks from the east)
      AC.place(you, x, z, 0, y);
      if (partner) AC.place(other, x, z + gap, Math.PI, AC.groundAt(x, z + gap));
      else AC.place(other, x - 7, z + 4, 0, AC.groundAt(x - 7, z + 4));
      for (const id of [you, other]) { const A = AC.get(id); A.want = A.asked = null; if (A.w.g) C.clearClip(A.w.g); }
    };
    /** The box round the two on the picture now (CSS px), from the feet to over the heads. */
    const box = (gap, partner) => {
      const V = new city.THREE.Vector3(), P = [];
      const [x, z] = at, y = AC.groundAt(x, z);
      for (const dz of partner ? [-0.9, gap + 0.9] : [-1.2, 1.2]) for (const dy of [-0.2, 2.4]) for (const dx of [-0.9, 0.9]) {
        V.set(x + dx, y + dy, z + dz).project(city.camera);
        P.push([(V.x * 0.5 + 0.5) * innerWidth, (-V.y * 0.5 + 0.5) * innerHeight]);
      }
      return [Math.min(...P.map(p => p[0])), Math.min(...P.map(p => p[1])), Math.max(...P.map(p => p[0])), Math.max(...P.map(p => p[1]))];
    };
    const close = (gap, partner, low) => {
      const [x, z] = at, y = AC.groundAt(x, z), mz = z + (partner ? gap / 2 : 0);
      const p = [x + side * 8.5, y + (low ? 4.2 : 3.0), mz], t = [x, y + (low ? 0.7 : 1.15), mz];
      city.VIEWS.hk2clip = { pos: p, tgt: t, fov: 40, sh: [(p[0] + t[0]) / 2, (p[2] + t[2]) / 2, 12] };
      city.cam?.toOrbit({ instant: true });
      city.setView('hk2clip');
    };
    const game = () => { st.camera.focus(null); st.focus(you); st.camera.arrived(); };
    window.__cs = { posed, mark, box, close, game, at, you, other };
    return { you, other, at, side, tested, name: AC.get(other).name };
  })()`);
  if (!cast) throw new Error('nobody at the place to play the pairs with');
  console.log(`the two: ${cast.you} and ${cast.other} (${cast.name}) at ${cast.at.map(v => v.toFixed(1)).join(', ')}, the close view from the ${cast.side > 0 ? 'east' : 'west'} (${cast.tested} lines cast)`);
  await ev('window.__demo.stage.setSpeed(0)');
  await ev(`window.__demo.stage.actors.audit(true)`);
  const CLIP = await ev(`Object.fromEntries(window.__demo.stage.actors.CLIPS.CLIPS.map(c => [c.name, { dur: c.dur, loop: c.loop, pair: c.pair, next: c.next, moving: c.moving, speed: c.speed }]))`);
  mkdirSync(path.join(out, 'frames'), { recursive: true });

  for (const S of SHEET) {
    const c = CLIP[S.lead];
    const gap = S.gap ?? c.pair?.gap ?? 1.2;
    const delay = S.delay ?? c.pair?.delay ?? 0;
    const end = c.dur - 0.02;
    let times = S.frames ?? [0, 1, 2, 3, 4, 5].map(k => +((end * k) / 5).toFixed(3));
    if (S.contact !== undefined && !S.frames) {
      const k = times.reduce((b, t, i) => (Math.abs(t - S.contact) < Math.abs(times[b] - S.contact) ? i : b), 1);
      times[k] = S.contact;
      times = [...new Set(times)].sort((a, b) => a - b);
    }
    const low = /lie_|fall|collapse|get_up|cower|crash|winded_rest/.test(S.lead);
    const rows = [];
    for (const view of ['game', 'close']) {
      await ev(`window.__cs.mark(${JSON.stringify(S.lead)}, ${JSON.stringify(S.partner)}, ${gap})`);
      if (view === 'game') await ev('window.__cs.game()');
      else await ev(`window.__cs.close(${gap}, ${!!S.partner}, ${low})`);
      await page.sleep(900);
      if (process.env.CS_DEBUG) console.log(view, await ev(`(() => { const c = window.__city.camera, AC = window.__demo.stage.actors, f = a => [a.x.toFixed(2), a.z.toFixed(2), a.ry.toFixed(2)].join(','); return 'cam ' + [c.position.x, c.position.y, c.position.z].map(v => v.toFixed(1)) + ' a1 ' + f(AC.get('a1')) + ' other ' + f(AC.get(window.__cs.other)); })()`));
      if (S.live) {
        // played, slowed to a tenth: the lead walks with the clip over the walk, as the stage plays it
        await ev('window.__demo.stage.setSpeed(0.1)');
        await ev(`(() => { const AC = window.__demo.stage.actors, cs = window.__cs, A = AC.get(cs.you);
          ${S.partner ? `AC.play(cs.other, ${JSON.stringify(S.partner)});` : ''}
          AC.stepTo(cs.you, A.x, A.z + ${S.partner ? gap * 0.3 : 3}, { v: ${S.partner ? 1.6 : 1.1}, clip: ${JSON.stringify(S.lead)} }); })()`);
        for (const [k, t] of times.entries()) {
          await page.waitFor(`(c => c.name === ${JSON.stringify(S.lead)} && c.t >= ${t})(window.__demo.stage.actors.clipOf('a1'))`, 30000, 15).catch(() => null);
          await ev('window.__demo.stage.setSpeed(0)');
          await page.sleep(250);
          const got = await ev(`({ a: window.__demo.stage.actors.clipOf('a1'), b: window.__demo.stage.actors.clipOf(window.__cs.other) })`);
          const file = path.join(out, 'frames', `${S.lead}-${k}-${view}.png`);
          await page.shot(file);
          rows.push({ view, k, t, file, lead: `${got.a.name ?? '-'}@${(got.a.t ?? 0).toFixed(2)}`, partner: S.partner ? `${got.b.name ?? '-'}@${(got.b.t ?? 0).toFixed(2)}` : null, box: await ev(`window.__cs.box(${gap}, ${!!S.partner})`) });
          await ev('window.__demo.stage.setSpeed(0.1)');
        }
        await ev('window.__demo.stage.setSpeed(0)');
        await page.sleep(300);
        continue;
      }
      for (const [k, t] of times.entries()) {
        const start = S.start?.lead && t < 0 ? S.start.lead : null;
        const lead = await ev(`window.__cs.posed('a1', ${JSON.stringify(start ?? S.lead)}, ${t})`);
        const tp = t - delay;
        const partner = S.partner ? await ev(`window.__cs.posed(window.__cs.other, ${tp >= 0 ? JSON.stringify(S.partner) : 'null'}, ${tp})`) : null;
        await page.sleep(220);
        const file = path.join(out, 'frames', `${S.lead}-${k}-${view}.png`);
        await page.shot(file);
        rows.push({ view, k, t, file, lead, partner: S.partner ? (tp >= 0 ? partner : 'stand') : null, box: await ev(`window.__cs.box(${gap}, ${!!S.partner})`) });
      }
    }
    frames.push({ group: S.group, lead: S.lead, partner: S.partner, dur: c.dur, loop: !!c.loop, delay: S.partner ? delay : null, contact: S.contact ?? null, gap, live: !!S.live, note: S.note ?? null, rows });
    console.log(`${S.lead}: ${rows.length} frames`);
  }
  await ev('window.__cs.game()');
  writeFileSync(path.join(out, 'frames.json'), JSON.stringify(frames, null, 1));
  console.log(`saved ${path.join(out, 'frames.json')}`);
  const bad = page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]'));
  if (bad.length) console.log(`page errors:\n  ${[...new Set(bad)].slice(0, 10).join('\n  ').slice(0, 2500)}`);
} catch (err) {
  failed = true;
  console.error(String(err?.stack ?? err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-10).join('\n').slice(0, 2500));
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
