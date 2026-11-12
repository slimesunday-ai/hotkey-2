// Starts the pinned city inside hotkey 2's page, puts the stage in it and the panels over it (SPEC section 24).
//
// The city's main.js is loaded as it is. It reads the page's query string, builds the city into #stage and publishes
// window.__city. Nothing in city/from-trunk/ is edited: what we need to behave differently we do from here.
//
//   /demo/                          the game: the city, the stage, the panels' start screen
//   /demo/?mode=watch&seed=4        straight into a season (mode=play&seat=dealer, mode=coach)
//   /demo/?stagetest=watch|play     a whole season on auto over the real stage; the title ends `stage-ok` or
//                                   `stage-fail: <why>` (demo/stage/director-test.js)
//   /demo/?proof=all                the spike's proof scenes, no panels (demo/stage/proof.js)
//   /demo/?map=1                    the set's map drawn over the city, no panels (demo/stage/mapmarks.js)
//   plain=1 hides this page's own chrome; every other parameter goes to the city (tod=night, q=low|medium|high …)
//
// After it is up:  window.__demo = { city, CITY, ready, readySeconds, stage?, hud?, marks?, proof? }
//   city    window.__city (scene, camera, controls, peds, traffic, cam, VIEWS, tick …)
//   CITY    the URL of the copied city folder, for importing its modules (the SAME url gives the SAME module instance
//           the city itself uses, which matters: the clip registry and the cast are shared state)
//   ready   resolves once the first view has settled (every block in range built, shaders warm)

export const CITY = new URL('../city/from-trunk/style/city/', import.meta.url).href;
const VENDOR = new URL('../city/vendor/three/', import.meta.url).href;

const Q = new URLSearchParams(location.search);
// (?bare=1: the city alone, for the tools that read it: demo/tools/place-table.mjs)
const GAME = !Q.get('proof') && !Q.get('map') && !Q.has('bare');

// This repo carries no baked city (1.6 GB in trunk, left behind): tell the city so it doesn't look for one.
if (!Q.has('nobake')) {
  Q.set('nobake', '1');
  history.replaceState(null, '', `${location.pathname}?${Q}`);
}
// THE GAME LOADS BY PLACE (the owner, 2026-11-12: "we just load what's needed for the location youre at"): only the
// zone the followed person is in is built, with the haze beyond it (demo/stage/loader.js; the zones are
// demo/stage/citymap.js ZONES). The page starts on the zone a season starts in. And no traffic: the city's cars
// drive through people who stand off its own lanes (?cars=1 puts them back). ?oldstage=1 keeps the whole city
// loaded, cars and all, to measure against.
const SMALL = GAME && !Q.has('oldstage');
if (SMALL && !Q.has('cars')) {
  Q.set('cars', '0');
  history.replaceState(null, '', `${location.pathname}?${Q}`);
}
if (Q.has('plain') || Q.has('shot')) document.body.classList.add('plain');
if (GAME) document.body.classList.add('game');

// THREE, WITHOUT THE NETWORK. The page's own imports go through the import map in index.html, which points at
// city/vendor/three/. The city's build workers cannot use an import map: the city sends them its sources as text and
// rewrites a bare `three` to a CDN address fixed in its own code. So the text is rewritten here first, on its way
// from the server to the city: a bare `three` becomes our vendored file's full address, which the city leaves alone.
const fetch0 = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const res = await fetch0(input, init);
  const url = typeof input === 'string' ? input : input?.url ?? String(input);
  if (!res.ok || !/\/city\/from-trunk\/[^?]*\.js(\?|$)/.test(url)) return res;
  const text = (await res.text())
    .replace(/(\bfrom\s*)(['"])three\2/g, `$1$2${VENDOR}build/three.module.js$2`)
    .replace(/(\bfrom\s*)(['"])three\/addons\//g, `$1$2${VENDOR}examples/jsm/`);
  return new Response(text, { status: res.status, statusText: res.statusText, headers: { 'Content-Type': 'text/javascript; charset=utf-8' } });
};

// THE KEYBOARD IS THE PANELS'. The city moves its camera on WASD, the arrows, Q E R F and the digits. On the game's
// page those keys pick moves, so the city never hears a key here: this listener is on the window before any of the
// city's and stops the event there, after the panels (which listen earlier, on the way down) have had it.
// The mouse still moves the camera. ?camkeys=1 gives the city its keys back.
if (GAME && !Q.has('camkeys')) {
  for (const type of ['keydown', 'keyup']) addEventListener(type, event => event.stopImmediatePropagation());
}

let demo_small = null;

// the load-in veil: the city reports its progress as `city:loading` events
const bar = document.querySelector('#loadin .bar i');
const msg = document.getElementById('loadmsg');
const PHASES = { code: 'loading the code', data: 'reading the city', view: 'raising the blocks', done: GAME ? 'setting the stage' : 'ready' };
addEventListener('city:loading', event => {
  const d = event.detail;
  if (bar) bar.style.width = `${Math.round((d.progress ?? 0) * 100)}%`;
  if (msg) msg.textContent = PHASES[d.phase] + (d.total ? ` · ${d.done} / ${d.total}` : '');
});

// THE SET'S NIGHT needs one thing done before the city makes its first material: its street-lamp light is compiled
// in only when asked for first (demo/stage/set/prelight.js says how). Without it people and walls stay dark at night.
if (GAME) {
  try {
    const { prelight } = await import('./stage/set/prelight.js');
    await prelight(CITY);
  } catch (err) {
    console.warn('[boot] the set has no prelight: night will be dark', err);
  }
}

const t0 = performance.now();
const cityMain = await import(`${CITY}main.js`);
const city = window.__city;
if (!city) throw new Error('the city did not start: window.__city is missing');

// ONLY THE FIRST ZONE: the city's stream is told its universe is that zone's blocks (main.js returns a couple of
// seconds in, long before most blocks are built, so the rest are never made) and is shown it, behind the loading
// veil. The stage's loader takes it from there: demo/stage/loader.js.
let loader = null;
let zone0 = null;
if (SMALL) {
  try {
    const [map, { createLoader }, { buildsBlock }] = await Promise.all([import('./stage/citymap.js'), import('./stage/loader.js'), import(`${CITY}modules.js`)]);
    loader = createLoader({ city, CITY, map });
    zone0 = map.zoneOf(Q.get('zone') && map.PLACES[Q.get('zone')] ? Q.get('zone') : map.START);
    // (only blocks the city has: a ring round a place on the shore reaches out over open sea)
    const world = new Set(cityMain.worldBlocks().map(([i, j]) => `${i},${j}`));
    const blocks = map.zoneBlocks(zone0, loader.ring).filter(([i, j]) => world.has(`${i},${j}`));
    city.stream.setUniverse(blocks.map(([i, j]) => [i, j, buildsBlock(i, j)]), 'section');
    // the haze: everything past the ring is gone into it
    city.R.draw = map.PITCH * (loader.ring + 2.2);
    const { pos, tgt, fov } = map.viewOf(zone0);
    city.VIEWS.hk2 = { pos, tgt, fov, sh: [(pos[0] + tgt[0]) / 2, (pos[2] + tgt[2]) / 2, Math.max(16, Math.hypot(pos[0] - tgt[0], pos[2] - tgt[2]) * 0.8)] };
    city.cam?.toOrbit({ instant: true });
    city.setView('hk2');
    loader.adopt(zone0);
    demo_small = { zone: zone0, blocks: blocks.length, ring: loader.ring, draw: city.R.draw };
  } catch (err) {
    console.warn('[boot] the city stays whole:', err);
    loader = null;
  }
}

// THE GAME DOES NOT WAIT FOR MORE THAN ITS ZONE. The stage needs the first picture, the walkers, and the sidewalks
// of the zone's own blocks (a walk is laid on the city's lanes, which arrive with a block's build). The other pages
// (the proof, the map, the tools) wait for the whole view.
let near = () => false;
if (GAME && loader) near = () => !!city.marks.first && !!city.peds?.ready && loader.standing(zone0);

/** Resolves when the view is up. A `?shot=1` page is already drained when main.js returns. */
const ready = new Promise(resolve => {
  const check = () => {
    if (Q.has('shot') || (city.marks.ready && city.marks.full) || near()) resolve((performance.now() - t0) / 1000);
    else setTimeout(check, 100);
  };
  check();
});

const demo = { city, CITY, ready, Q, readySeconds: null, small: demo_small, loader };
window.__demo = demo;
ready.then(seconds => {
  demo.readySeconds = seconds;
});

// ?map=1 draws the proposed map over the city (city/MAP-PROPOSAL.md); ?map=pins leaves the legend off
if (Q.get('map')) {
  const { createMapMarks } = await import('./stage/mapmarks.js');
  demo.marks = createMapMarks(demo);
  if (Q.get('map') === 'pins') demo.marks.legend(false);
}

if (Q.get('proof')) {
  await ready;
  const { startProof } = await import('./stage/proof.js');
  demo.proof = await startProof(demo, Q.get('proof'));
}

// the game: the stage in the city, the panels over it
if (GAME) {
  await ready;
  const [{ createStage }, { mountHud }] = await Promise.all([import('./stage/index.js'), import('./hud/index.js')]);
  demo.stage = await createStage({ city, CITY, loader: loader ?? null });
  const host = document.getElementById('hud');
  if (Q.get('stagetest')) {
    const { runStageTest } = await import('./stage/director-test.js');
    demo.hud = runStageTest({ demo, mountHud, host, mode: Q.get('stagetest') });
  } else {
    const mode = ['watch', 'play', 'coach'].includes(Q.get('mode')) ? Q.get('mode') : null;
    demo.hud = mountHud(host, {
      stage: demo.stage,
      ...(mode ? { mode, seat: Q.get('seat') ?? 'dealer', seed: Number(Q.get('seed')) || 1 } : {}),
      ...(Q.get('speed') ? { speed: Number(Q.get('speed')) } : {}),
    });
  }
  // the panels are up: lift the veil (index.html holds it down until now)
  document.body.classList.add('up');
}
