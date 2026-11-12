#!/usr/bin/env node
// The camera, measured the way the owner met it: "camera is super janky when clicking on other agents, I'm flying
// through a building over and over". The server must be running: node demo/serve.mjs --port 5476
//
//   node demo/tools/camera-check.mjs [--port 5476] [--part clicks|views|season] [--out demo/shots/camera]
//                                    [--mode watch|play|coach] [--hours N] [--speed 1|2|4] [--seed N]
//
//   clicks   (the default) watching, then playing: three different people on three different blocks are clicked
//            one after another with REAL pointer events (DevTools Input.dispatchMouseEvent), a few seconds apart.
//            When nobody on a new block is in the frame it does what a person would: Esc back to the wide shot
//            (watching), or the wheel to zoom the Lock out (playing).
//   views    the pictures: the Lock on the player on each block, the pen, the tent, their pad; the wide shot; a
//            clicked person crossing a street; a cut-in on a robbery (--watch-only leaves the player's out).
//   season   /demo/?stagetest=<mode> with the same counting on, to its verdict.
//
// WHAT IS COUNTED, every frame the page draws (a requestAnimationFrame in the page):
//   inside     frames the camera is INSIDE A BUILDING: lower than the highest solid top at its own x, z, read from
//              the column heights of the city's collision world (camera/world.js topAt: built from each block's own
//              full-detail boxes, so a roof, an awning and a tree crown all count). `solid` is the stricter kin:
//              frames the camera's own point overlaps a solid. The test is tried first: the camera is put inside a
//              building on purpose and every one of those frames must be counted.
//   off        frames the watched person's head is not on the screen, in spells longer than half a second
//   jump       the largest move of the camera in one frame that was not a declared cut (the stage counts its cuts),
//              not the watched person's own step (the Lock carries the camera with them) and not the tool's own
//              wheel; `jumps` is how many such moves were over a metre
import path from 'node:path';
import { launch } from './chrome.mjs';

function opt(name, fallback) {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
}
const port = opt('--port', 5476);
const part = opt('--part', 'clicks');
const out = path.resolve(opt('--out', 'demo/shots/camera'));
const base = `http://127.0.0.1:${port}/demo/`;

/** The counting, in the page. window.__camrec.reset() starts it over; .sum() reads it. */
const RECORDER = `(() => {
  if (window.__camrec) return;
  const st = __demo.stage, city = __city, W = city.cam.world, cam = city.camera;
  let R = null, last = null, lastCuts = 0, lastSub = null, off = null;
  const reset = () => {
    R = { frames: 0, inside: 0, solid: 0, farColumns: 0, insideEx: [], off: 0, offSpells: 0, offEx: [], jump: 0, jumpEx: null, jumps: 0, cuts: 0, cutMax: 0, watched: 0, locked: 0, headY: [1, 0], hand: -1e9, handFrames: 0 };
    last = null; lastSub = null; off = null; lastCuts = st.camera.state().cuts;
  };
  reset();
  const tick = now => {
    const s = st.camera.state(), p = cam.position;
    R.frames++;
    const top = W.topAt(p.x, p.z);
    if (!W.ready(p.x, p.z)) R.farColumns++;
    if (p.y < top) { R.inside++; if (R.insideEx.length < 5) R.insideEx.push({ at: [p.x, p.y, p.z].map(v => +v.toFixed(1)), roof: +top.toFixed(1), on: s.on, rig: s.rig, user: s.user }); }
    if (W.overlap({ x: p.x, y: p.y, z: p.z }, 0.2)) R.solid++;
    const who = /^(lock|room):/.test(s.on) && !s.user ? s.on.slice(s.on.lastIndexOf(':') + 1) : null;
    const A = who && st.actors.has(who) ? st.actors.get(who) : null;
    const sub = A ? { id: who, x: A.w.p[0], y: A.w.p[1], z: A.w.p[2] } : null;
    if (last) {
      const d = Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z);
      if (s.cuts !== lastCuts) { R.cuts += s.cuts - lastCuts; R.cutMax = Math.max(R.cutMax, d); }
      else if (now - R.hand < 700) R.handFrames++;
      else {
        // (on the Lock the camera's step is the person's: what is left over is the camera's own)
        const carried = s.rig === 'lock' && sub && lastSub && lastSub.id === sub.id ? Math.hypot(sub.x - lastSub.x, sub.y - lastSub.y, sub.z - lastSub.z) : 0;
        const own = Math.max(0, d - carried);
        if (own > R.jump) { R.jump = own; R.jumpEx = { metres: +own.toFixed(2), on: s.on, rig: s.rig, user: s.user, carried: +carried.toFixed(2) }; }
        if (own > 1) R.jumps++;
      }
    }
    last = { x: p.x, y: p.y, z: p.z }; lastCuts = s.cuts; lastSub = sub;
    if (A) {
      R.watched++;
      if (s.rig === 'lock') R.locked++;
      const h = st.screenOf(who);
      if (h.visible) { R.headY[0] = Math.min(R.headY[0], h.y / innerHeight); R.headY[1] = Math.max(R.headY[1], h.y / innerHeight); off = null; }
      else {
        if (!off || off.who !== who) off = { who, at: now, n: 0, counted: false };
        off.n++;
        if (now - off.at > 500) {
          if (!off.counted) { off.counted = true; R.offSpells++; R.off += off.n; if (R.offEx.length < 5) R.offEx.push({ who, on: s.on, hidden: !!A.w.hide, head: [Math.round(h.x), Math.round(h.y)] }); }
          else R.off++;
        }
      }
    } else off = null;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__camrec = { reset, hand() { R.hand = performance.now(); }, sum: () => ({ ...R, headY: R.headY.map(v => +v.toFixed(2)), jump: +R.jump.toFixed(2), cutMax: +R.cutMax.toFixed(1), hand: undefined }) };
})()`;

const line = (name, r) => {
  console.log(`${name}: ${r.frames} frames · INSIDE A BUILDING ${r.inside} (in a solid ${r.solid}) · PERSON OFF SCREEN ${r.off} frames in ${r.offSpells} spells · LARGEST UNDECLARED JUMP ${r.jump} m (${r.jumps} over a metre) · ${r.cuts} declared cuts (the longest ${r.cutMax} m) · on a person ${r.watched} frames, ${r.locked} of them on the Lock · their head between ${r.headY[0]} and ${r.headY[1]} of the page's height${r.handFrames ? ` · ${r.handFrames} frames under the tool's own wheel left out` : ''}${r.farColumns ? ` · ${r.farColumns} frames over columns still on the far massing` : ''}`);
  if (r.insideEx.length) console.log(`   inside, for example: ${JSON.stringify(r.insideEx)}`);
  if (r.offEx.length) console.log(`   off screen, for example: ${JSON.stringify(r.offEx)}`);
  if (r.jumpEx && r.jump > 0.5) console.log(`   the jump: ${JSON.stringify(r.jumpEx)}`);
};

// (the browser's own DevTools port: never one that already answers, which would be somebody else's browser)
const debugPort = Number(opt('--debug-port', 5477));
if (await fetch(`http://127.0.0.1:${debugPort}/json/version`).then(() => true, () => false)) {
  console.error(`port ${debugPort} already has a browser on it: pass another --debug-port`);
  process.exit(1);
}
const browser = await launch({ debugPort });
let failed = false;
let page = null;
const errorsOf = p => [...new Set(p.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]') || /\[stage\]|camera rig/.test(l)))];

async function open(query) {
  if (page) page.close();
  page = await browser.open(`${base}?${query}`);
  await page.waitFor('window.__demo && window.__demo.hud && window.__demo.stage.debug().people > 0', 150000);
  await page.evaluate(RECORDER);
  return page;
}
const state = () => page.evaluate('window.__demo.stage.camera.state()');
const mouse = async (type, x, y, extra = {}) => page.send('Input.dispatchMouseEvent', { type, x, y, button: 'none', ...extra });
async function click(x, y) {
  await mouse('mouseMoved', x, y);
  await page.sleep(50);
  await mouse('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1 });
  await page.sleep(60);
  await mouse('mouseReleased', x, y, { button: 'left', buttons: 0, clickCount: 1 });
}
async function key(name) {
  const code = name.length === 1 ? `Key${name.toUpperCase()}` : name;
  for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: name, code, windowsVirtualKeyCode: name === 'Escape' ? 27 : name.toUpperCase().charCodeAt(0) });
}
/** Playing: the seat's own bot takes `n` hours (the panels' A key), each waited for, so the cast is spread over the set. */
async function autoHours(n) {
  const first = await page.evaluate('window.__demo.stage.debug().hours');
  for (let k = 0; k < n * 2 && (await page.evaluate('window.__demo.stage.debug().hours')) < first + n; k++) {
    const before = (await page.evaluate('window.__demo.stage.debug().hours'));
    await key('a');
    await page.waitFor(`window.__demo.stage.debug().hours > ${before}`, 20000).catch(() => {});
    await page.waitFor('!window.__demo.stage.debug().running', 60000).catch(() => {});
    await page.sleep(1200);
  }
  return page.evaluate('window.__demo.stage.debug().hours');
}
/** The agents a real click would reach now: on the screen, nothing of the page over them, and the stage's own pick agrees. */
const clickable = () => page.evaluate(`(() => {
  const st = __demo.stage, V = new __city.THREE.Vector3(), cv = __city.renderer.domElement, list = [];
  for (const P of st.director.people.values()) {
    if (P.kind !== 'agent' || P.inside || !st.actors.has(P.id)) continue;
    const A = st.actors.get(P.id);
    if (A.w.hide) continue;
    V.set(A.w.p[0], A.w.p[1] + 1.2, A.w.p[2]).project(__city.camera);
    if (V.z > 1 || Math.abs(V.x) > 0.94 || Math.abs(V.y) > 0.94) continue;
    const x = Math.round((V.x * 0.5 + 0.5) * innerWidth), y = Math.round((-V.y * 0.5 + 0.5) * innerHeight);
    if (document.elementFromPoint(x, y) !== cv || st.actors.pickAt(x, y) !== P.id) continue;
    // (on a roadway: Ivy St runs along x = -72 and Washington St along z = 36, each about nine metres wide)
    const road = A.moving > 0 && (Math.abs(A.w.p[0] + 72) < 2.2 || Math.abs(A.w.p[2] - 36) < 2.2);
    list.push({ id: P.id, block: P.block, x, y, moving: A.moving > 0, road });
  }
  return list;
})()`);

/** Three people on three blocks, clicked one after another. `widen` is what to do when nobody new is in the frame. */
async function threeClicks(label, widen, skip = []) {
  const done = [];
  const blocks = new Set();
  for (let n = 0; n < 3; n++) {
    let pickOne = null;
    for (let tries = 0; tries < 6 && !pickOne; tries++) {
      const list = (await clickable()).filter(c => !skip.includes(c.id) && !done.includes(c.id));
      pickOne = list.find(c => !blocks.has(c.block)) ?? null;
      if (!pickOne) {
        console.log(`   ${label}: nobody on a new block in the frame (${list.length} others are): ${await widen()}`);
        await page.sleep(900);
      }
    }
    if (!pickOne) {
      const list = (await clickable()).filter(c => !skip.includes(c.id) && !done.includes(c.id));
      pickOne = list[0] ?? null;
      if (!pickOne) {
        console.log(`   ${label}: click ${n + 1}: nobody to click`);
        failed = true;
        continue;
      }
      console.log(`   ${label}: click ${n + 1} is on a block already visited (${pickOne.block})`);
    }
    // (the picture may have been cut since the person was chosen: a cut-in starting or ending. They are found again
    // just before the press, the way an eye does)
    for (let k = 0; k < 5; k++) {
      const now = (await clickable()).find(c => c.id === pickOne.id);
      if (now) {
        pickOne.x = now.x;
        pickOne.y = now.y;
        break;
      }
      await page.sleep(400);
    }
    await click(pickOne.x, pickOne.y);
    done.push(pickOne.id);
    blocks.add(pickOne.block);
    await page.sleep(700);
    const s = await state();
    const onThem = s.on.endsWith(`:${pickOne.id}`) && s.following === pickOne.id;
    console.log(`   ${label}: click ${n + 1} on ${pickOne.id} at ${pickOne.block} (${pickOne.x}, ${pickOne.y}): the camera is ${onThem ? `on them (${s.on}, the rig in ${s.rig})` : `NOT on them (${JSON.stringify(s)})`}`);
    if (!onThem) failed = true;
    await page.sleep(3300);
  }
  return done;
}
/** Past whatever stands before the first menu, the way a person would: the first-timer's screen, the night sheet. */
async function nightSheet() {
  for (let k = 0; k < 8; k++) {
    const did = await page.evaluate(`(() => { const start = document.querySelector('[data-act="start-game"]'); if (start) { start.click(); return 'start'; } const day = document.querySelector('[data-act="day"]'); if (!day) return null; for (let k = 0; k < 4; k++) document.querySelector('.hk-skill:not([disabled])')?.click(); day.click(); return 'day'; })()`);
    if (!did && k > 1) break;
    await page.sleep(700);
  }
}

try {
  if (part === 'clicks') {
    // ── the test of the test: the camera inside a building on purpose
    await open(`mode=watch&seed=${opt('--seed', 4)}`);
    await page.sleep(2500);
    const spot = await page.evaluate(`(() => { const W = __city.cam.world; for (let x = -100; x < -78; x += 2) for (let z = 8; z < 30; z += 2) if (W.topAt(x, z) > 11 && W.topAt(x + 1, z) > 11 && W.topAt(x, z + 1) > 11) return [x, z, W.topAt(x, z)]; return null; })()`);
    await page.evaluate(`(() => { __camrec.reset(); __city.cam.toOrbit({ instant: true }); __city.VIEWS.inside = { pos: [${spot[0]}, 6, ${spot[1]}], tgt: [${spot[0]} + 3, 0, ${spot[1]} + 3], fov: 42, sh: [${spot[0]}, ${spot[1]}, 16] }; __city.setView('inside'); })()`);
    await page.sleep(1000);
    const proof = await page.evaluate('window.__camrec.sum()');
    // (the frame in which the camera was put there is the only one that may be missed)
    const caught = proof.inside >= proof.frames - 1 && proof.frames > 10;
    console.log(`the test itself: the camera put 6 m up inside the building at ${spot[0]}, ${spot[1]} (its roof is ${spot[2].toFixed(1)} m): ${proof.inside} of ${proof.frames} frames counted as inside, ${proof.solid} as in a solid → ${caught ? 'the test sees it' : 'THE TEST IS BLIND'}`);
    if (!caught) failed = true;

    // ── watching
    await page.evaluate(`(() => { __demo.stage.focus(null); __camrec.reset(); })()`);
    await page.sleep(1500);
    const watched = await threeClicks('watch', async () => {
      await key('Escape');
      return 'Esc, back to the wide shot';
    });
    // a click on the person the camera is already on, a few times: the same move must not be made again
    const before = (await state()).cuts;
    const again = (await clickable()).find(c => c.id === watched[watched.length - 1]);
    if (again) {
      for (let k = 0; k < 3; k++) await page.evaluate(`window.__demo.stage.focus(${JSON.stringify(again.id)})`);
      console.log(`   watch: asked three more times for the person it is on: ${(await state()).cuts - before} cuts`);
    }
    await key('Escape');
    await page.sleep(1500);
    const sw = await state();
    console.log(`   watch: Esc: the camera is on '${sw.on}' (the rig in ${sw.rig})`);
    if (sw.on !== 'wide' && sw.on !== 'beat') failed = true;
    await page.sleep(1500);
    const rw = await page.evaluate('window.__camrec.sum()');
    // the viewer's hand: a real drag on the wide shot takes the camera, and the stage leaves it alone until asked
    const free = await page.evaluate(`(() => { const cv = __city.renderer.domElement; for (let y = 300; y < innerHeight - 250; y += 40) for (let x = innerWidth / 2 - 200; x < innerWidth / 2 + 200; x += 40) if (document.elementFromPoint(x, y) === cv && document.elementFromPoint(x + 120, y + 60) === cv && !__demo.stage.actors.pickAt(x, y)) return [x, y]; return null; })()`);
    if (free) {
      const camAt = () => page.evaluate('(() => { const c = __city.camera.position; return [c.x, c.y, c.z]; })()');
      const a = await camAt();
      await mouse('mouseMoved', free[0], free[1]);
      await mouse('mousePressed', free[0], free[1], { button: 'left', buttons: 1, clickCount: 1 });
      for (let k = 1; k <= 8; k++) {
        await mouse('mouseMoved', free[0] + k * 15, free[1] + k * 7, { button: 'left', buttons: 1 });
        await page.sleep(30);
      }
      await mouse('mouseReleased', free[0] + 120, free[1] + 56, { button: 'left', buttons: 0, clickCount: 1 });
      await page.sleep(500);
      const b = await camAt();
      const sd = await state();
      await page.sleep(3000);
      const c = await camAt();
      const sl = await state();
      console.log(`   watch: a drag on the wide shot moved the camera ${Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]).toFixed(1)} m · the viewer has it: ${sd.user} · three seconds on the stage had cut ${sl.cuts - sd.cuts} times and the camera had moved ${Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2]).toFixed(2)} m more`);
      if (!sd.user || sl.cuts !== sd.cuts) failed = true;
      await key('Escape');
      await page.sleep(600);
      const se = await state();
      console.log(`   watch: Esc after the drag: the camera is on '${se.on}', the viewer has it: ${se.user}`);
      if (se.user) failed = true;
    }
    line('WATCH, three clicks', rw);
    if (rw.inside || rw.off) failed = true;
    const errs = errorsOf(page);
    if (errs.length) console.log(`   page errors:\n     ${errs.slice(0, 8).join('\n     ').slice(0, 2000)}`);

    // ── playing
    await open(`mode=play&seat=${opt('--seat', 'dealer')}&seed=${opt('--seed', 3)}`);
    await nightSheet();
    await page.sleep(5000);
    const you = (await page.evaluate('window.__demo.stage.debug()')).you;
    const s0 = await state();
    console.log(`   play: the menu waits: the camera is on '${s0.on}' (the rig in ${s0.rig}), ${s0.angle.metres} m from the player, ${s0.angle.down}° down, from bearing ${s0.angle.bearing}°`);
    const c0 = await page.evaluate('(() => { const c = __city.camera.position; return [c.x, c.y, c.z]; })()');
    await page.sleep(4000);
    const c1 = await page.evaluate('(() => { const c = __city.camera.position; return [c.x, c.y, c.z]; })()');
    console.log(`   play: four seconds with the menu waiting: the camera moved ${Math.hypot(c0[0] - c1[0], c0[1] - c1[1], c0[2] - c1[2]).toFixed(3)} m`);
    await page.evaluate('window.__camrec.reset()');
    // three hours on the seat's own bot first: at hour one the whole cast stands on one block
    const hours = await autoHours(3);
    const s1 = await state();
    const ra = await page.evaluate('window.__camrec.sum()');
    console.log(`   play: ${hours} hours played on auto: the camera is on '${s1.on}' (the rig in ${s1.rig})`);
    line('PLAY, three hours on the Lock', ra);
    if (ra.inside || ra.off) failed = true;
    await page.evaluate('window.__camrec.reset()');
    let wheels = 0;
    await threeClicks('play', async () => {
      if (++wheels > 2) return 'nothing more to try';
      // the wheel, over the middle of the city: the Lock zooms out and more of the set is in the frame
      await page.evaluate('window.__camrec.hand()');
      const at = await page.evaluate(`(() => { const cv = __city.renderer.domElement; for (let y = 200; y < innerHeight - 150; y += 40) for (let x = innerWidth / 2 - 300; x < innerWidth / 2 + 300; x += 40) if (document.elementFromPoint(x, y) === cv) return [x, y]; return [innerWidth / 2, innerHeight / 2]; })()`);
      await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: at[0], y: at[1], deltaX: 0, deltaY: 500 });
      return 'the wheel, to zoom the Lock out';
    }, [you]);
    await page.evaluate(`window.__demo.stage.focus(${JSON.stringify(you)})`);
    await page.sleep(2000);
    const sp = await state();
    console.log(`   play: asked for the player again: the camera is on '${sp.on}' (the rig in ${sp.rig}), ${sp.angle.metres} m away (the zoom the wheel left is kept)`);
    const rp = await page.evaluate('window.__camrec.sum()');
    line('PLAY, three clicks', rp);
    if (rp.inside || rp.off) failed = true;
    const errs2 = errorsOf(page);
    if (errs2.length) console.log(`   page errors:\n     ${errs2.slice(0, 8).join('\n     ').slice(0, 2000)}`);
  } else if (part === 'views') {
    // ── playing: the Lock on the player everywhere, and the three rooms
    if (!process.argv.includes('--watch-only')) {
      await open(`mode=play&seat=${opt('--seat', 'dealer')}&seed=${opt('--seed', 3)}`);
      await nightSheet();
      await page.sleep(5000);
      const you = (await page.evaluate('window.__demo.stage.debug()')).you;
      const blocks = await page.evaluate(`import('/demo/stage/citymap.js').then(m => Object.keys(m.BLOCKS))`);
      for (const place of [...blocks, 'jail', 'clinic', 'pad']) {
        await page.evaluate(`window.__demo.stage.tour(${JSON.stringify(place)})`);
        await page.sleep(2600);
        const file = await page.shot(path.join(out, `play-${place}.jpg`));
        const r = await page.evaluate(`(() => { const s = __demo.stage.camera.state(), h = __demo.stage.screenOf(${JSON.stringify(you)}), c = __city.camera.position; return { on: s.on, rig: s.rig, head: [Math.round(h.x), Math.round(h.y), h.visible], cam: [c.x, c.y, c.z].map(v => +v.toFixed(1)), roof: +__city.cam.world.topAt(c.x, c.z).toFixed(1) }; })()`);
        console.log(`${path.relative(process.cwd(), file)} · ${JSON.stringify(r)}`);
      }
      line('PLAY, the tour', await page.evaluate('window.__camrec.sum()'));
    }
    // ── watching: the wide shot, a clicked person crossing a street, a cut-in on a robbery
    await open(`mode=watch&seed=${opt('--seed', 4)}&speed=${opt('--speed', 2)}`);
    await page.sleep(2500);
    console.log(path.relative(process.cwd(), await page.shot(path.join(out, 'watch-wide.jpg'))));
    let crossing = false;
    let robbery = false;
    const t0 = Date.now();
    while (Date.now() - t0 < Number(opt('--limit', 420)) * 1000 && !(crossing && robbery)) {
      const s = await state();
      if (!robbery && s.on === 'beat') {
        const kinds = (await page.evaluate('window.__demo.stage.debug().playing')).map(p => p.kind);
        if (kinds.some(k => /^(rob|breakin|npc:robbers|fight)/.test(k))) {
          await page.sleep(900);
          const heads = await page.evaluate(`(() => { const st = __demo.stage; const sc = st.debug().playing.find(p => /^(rob|breakin|npc:robbers|fight)/.test(p.kind)); return sc ? sc.actors.map(id => { const h = st.screenOf(id); return [id, Math.round(h.x), Math.round(h.y), h.visible]; }) : null; })()`);
          console.log(`${path.relative(process.cwd(), await page.shot(path.join(out, 'watch-cut-in-robbery.jpg')))} · ${kinds.join(', ')} · the people in it at ${JSON.stringify(heads)}`);
          robbery = true;
        }
      }
      if (!crossing && s.on === 'wide') {
        const walker = (await clickable()).find(c => c.road);
        if (walker) {
          await click(walker.x, walker.y);
          await page.sleep(350);
          const still = await page.evaluate(`(() => { const A = __demo.stage.actors.get(${JSON.stringify(walker.id)}); return { moving: A.moving > 0, at: [A.w.p[0], A.w.p[2]].map(v => +v.toFixed(1)) }; })()`);
          console.log(`${path.relative(process.cwd(), await page.shot(path.join(out, 'watch-clicked-crossing.jpg')))} · ${walker.id}, ${still.moving ? 'walking' : 'stopped'} at ${still.at} · ${JSON.stringify((await state()).on)}`);
          crossing = true;
          await page.sleep(3000);
          await key('Escape');
        }
      }
      await page.sleep(150);
    }
    if (!crossing) console.log('no clicked person crossing a street: nobody was caught on a roadway');
    if (!robbery) console.log(`no cut-in on a robbery: none was staged in the time given (--limit seconds); the stage cut in on ${(await state()).beats} scenes, ${(await page.evaluate('window.__demo.stage.debug().hours'))} hours played`);
    line('WATCH, the pictures', await page.evaluate('window.__camrec.sum()'));
    const errs = errorsOf(page);
    if (errs.length) console.log(`page errors:\n  ${errs.slice(0, 8).join('\n  ').slice(0, 2000)}`);
  } else if (part === 'season') {
    const mode = opt('--mode', 'watch');
    const params = new URLSearchParams({ stagetest: mode, seed: opt('--seed', '4'), speed: opt('--speed', '1') });
    if (opt('--hours', null)) params.set('hours', opt('--hours'));
    const t0 = Date.now();
    await open(String(params));
    let title = '';
    let said = 0;
    while (Date.now() - t0 < Number(opt('--limit', 1700)) * 1000) {
      title = await page.evaluate('document.title', 10000).catch(() => '');
      if (/^stage-(ok|fail)/.test(title)) break;
      // a line now and then, so that a run cut short by whoever started it still says how far it got
      if (Date.now() - t0 - said > 120000) {
        said = Date.now() - t0;
        const d = await page.evaluate('({ hours: window.__demo.stage.debug().hours, on: window.__demo.stage.camera.state().on })', 10000).catch(() => null);
        console.log(`   ${Math.round(said / 1000)} s in: ${JSON.stringify(d)}`);
      }
      await page.sleep(1000);
    }
    const t = await page.evaluate('(() => { const t = window.__stagetest; return t ? { hours: t.hours, seconds: t.seconds, fpsMean: t.fpsMean, fpsWorst: t.fpsWorst, hourMedian: t.hourMedian, longestHour: t.longestHour, errors: t.errors } : null; })()').catch(() => null);
    console.log(`SEASON ${mode} at ${opt('--speed', '1')}×: ${/^stage-/.test(title) ? title : `NO VERDICT after ${Math.round((Date.now() - t0) / 1000)} s (title: '${title}')`} · ${JSON.stringify(t)}`);
    if (!/^stage-ok/.test(title)) failed = true;
    console.log(`   the camera at the end: ${JSON.stringify(await state())}`);
    line(`SEASON ${mode}, every frame`, await page.evaluate('window.__camrec.sum()'));
    const errs = errorsOf(page);
    if (errs.length) console.log(`   page errors:\n     ${errs.slice(0, 8).join('\n     ').slice(0, 2000)}`);
  } else {
    console.error(`no such part: ${part}`);
    failed = true;
  }
} catch (err) {
  failed = true;
  console.error(String(err));
  if (page) console.error(page.logs.filter(l => !l.startsWith('[log]')).slice(-10).join('\n').slice(0, 2500));
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
