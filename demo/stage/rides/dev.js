// The ride scenes' dev page (demo/rides-dev.html): starts the pinned city as demo/boot.js does, the WHOLE city (none
// of the game's small-city trimming), then the stage's actors and the rides on top. The game page never loads this.
//
//   window.__rides = { ready, demo, actors, rides, play(name, o), view(pos, tgt, fov), cam(x, z, near), log }
//   play('subway' | 'scooter' | 'subway2' | 'cab' | 'foot', { back: false, hurried: false, n: 1 })
//     one trip of the dev list (TRIPS below): the departure from one end, then (as the game cuts) the arrival at the
//     other. back: the other way round. n: that many people leave and arrive together. → { leave, arrive } seconds
export const CITY = new URL('../../../city/from-trunk/style/city/', import.meta.url).href;
const VENDOR = new URL('../../../city/vendor/three/', import.meta.url).href;

const Q = new URLSearchParams(location.search);
for (const [k, v] of [['nobake', '1'], ['cars', '0']]) if (!Q.has(k)) Q.set(k, v);
history.replaceState(null, '', `${location.pathname}?${Q}`);
if (Q.has('plain') || Q.has('shot')) document.body.classList.add('plain');

// THREE WITHOUT THE NETWORK (demo/boot.js says why): the city's build workers get our vendored three.
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

const bar = document.querySelector('#loadin .bar i');
const msg = document.getElementById('loadmsg');
const PHASES = { code: 'loading the code', data: 'reading the city', view: 'raising the blocks', done: 'ready' };
addEventListener('city:loading', event => {
  const d = event.detail;
  if (bar) bar.style.width = `${Math.round((d.progress ?? 0) * 100)}%`;
  if (msg) msg.textContent = PHASES[d.phase] + (d.total ? ` · ${d.done} / ${d.total}` : '');
});

const t0 = performance.now();
await import(`${CITY}main.js`);
const PLAN = await import(`${CITY}plan.js`);
const city = window.__city;
if (!city) throw new Error('the city did not start: window.__city is missing');
const ready = new Promise(resolve => {
  const check = () => {
    if (city.marks.ready && city.marks.full) resolve((performance.now() - t0) / 1000);
    else setTimeout(check, 100);
  };
  check();
});
const demo = { city, CITY, ready, Q, readySeconds: null };
window.__demo = demo;

/**
 * THE DEV TRIPS: real places of the city (world/export/world.json) and the mode each is played in. `a` and `b` are
 * where a person stands at either end; the station is the one rides picks itself (the nearest on a line to the other end).
 */
export const TRIPS = {
  subway: { mode: 'subway', a: [-77.5, 31], b: [181, -37], names: ['DEAD AIR', 'St. Mercy'] },
  scooter: { mode: 'scooter', a: [-77.5, 31], b: [54, -18], names: ['DEAD AIR', 'Precinct 9'] },
  subway2: { mode: 'subway', a: [-234, -55], b: [-90, 18], names: ['Sunny Acres', 'Fit Street'] },
  cab: { mode: 'cab', a: [90, -270], b: [54, -18], names: ['Low Tide Docks', 'Precinct 9'] },
  foot: { mode: 'foot', a: [-36, 36], b: [-77.5, 31], names: ['Jay St & Washington St', 'DEAD AIR'] },
  // (for looking closely: a cab from the bar's own street, to a corner of Fit Street)
  cab2: { mode: 'cab', a: [-77.5, 31], b: [-36, 36], names: ['DEAD AIR', 'Jay St & Washington St'] },
  skate: { mode: 'skate', a: [-77.5, 31], b: [54, -18], names: ['DEAD AIR', 'Precinct 9'] },
  skate2: { mode: 'skate', a: [-36, 36], b: [-36, -36], names: ['Jay St & Washington St', 'Jay St & 1st St'] },
  // (cab3: the docks, the cab watched leaving them)
  cab3: { mode: 'cab', a: [90, -270], b: [-77.5, 31], names: ['Low Tide Docks', 'DEAD AIR'] },
};

const log = [];
const say = text => {
  log.push(`${(performance.now() / 1000).toFixed(2)} ${text}`);
  const el = document.getElementById('say');
  if (el) el.textContent = text;
};

const dev = { ready: null, demo, actors: null, rides: null, log, TRIPS };
window.__rides = dev;

/** Cuts the camera to a pose (the city's free orbit). */
dev.view = (pos, tgt, fov = 42) => {
  city.VIEWS.look = { pos, tgt, fov, sh: [(pos[0] + tgt[0]) / 2, (pos[2] + tgt[2]) / 2, Math.max(16, Math.hypot(pos[0] - tgt[0], pos[2] - tgt[2]) * 0.8)] };
  city.cam?.toOrbit?.({ instant: true });
  city.setView('look');
  city.clearFixedShadow?.();
};
/**
 * The game's camera on a point: 24 m up, 64 degrees down (11.7 m off), from `bearing` (0: from the south); `near`
 * halves it. (demo/stage/camera.js HIGH, DOWN, LENS.)
 */
dev.cam = (x, z, { near = false, tight = false, bearing = null } = {}) => {
  // (near: a person's height of 5 m, 32 degrees down, 8 m off: the ride as somebody across the street sees it;
  // tight: 2.4 m up, 26 degrees down, 4.9 m off, for the feet on a deck or a tread)
  const [high, down] = tight ? [2.4, 26] : near ? [5, 32] : [24, 64];
  const off = high / Math.tan((down * Math.PI) / 180);
  const world = city.cam?.world ?? null;
  const at = [x, 1.3, z];
  const tries = bearing !== null ? [bearing] : [Math.PI / 2, 0, Math.PI, -Math.PI / 2, Math.PI / 4, (3 * Math.PI) / 4, -Math.PI / 4, (-3 * Math.PI) / 4];
  let pick = null;
  const lifts = near ? [1] : [1, 1.3, 1.6];
  for (const b of lifts.flatMap(l => tries.map(t => [t, l]))) {
    const pos = [x + Math.sin(b[0]) * off * b[1], high * b[1] + 1.3, z + Math.cos(b[0]) * off * b[1]];
    // (in the open, and nothing solid between the lens and the person: camera.js open() and clear())
    // (without the rig's collision world: a lens over a road, and the line to the person over road or sidewalk, is open)
    const open = world ? [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].every(([dx, dz]) => world.topAt(pos[0] + dx, pos[2] + dz) <= pos[1] - 1) : dev.actors.onRoad(pos[0], pos[2]);
    const clear = world ? !world.ray({ x: pos[0], y: pos[1], z: pos[2] }, { x: at[0], y: at[1], z: at[2] }) : [0.25, 0.5, 0.75].every(u => dev.actors.onRoad(at[0] + (pos[0] - at[0]) * u, at[2] + (pos[2] - at[2]) * u) || PLAN.kerbOut(at[0] + (pos[0] - at[0]) * u, at[2] + (pos[2] - at[2]) * u) < 4.5);
    pick ??= pos;
    if (open && clear) {
      pick = pos;
      break;
    }
  }
  dev.view(pick, at, 42);
};

dev.ready = (async () => {
  demo.readySeconds = await ready;
  const [{ createActors }, { createRides }] = await Promise.all([import('../actors.js'), import('./index.js')]);
  dev.actors = await createActors({ city, CITY });
  dev.rides = await createRides({ city, CITY, actors: dev.actors });
  const box = document.getElementById('scenes');
  for (const name of Object.keys(TRIPS)) {
    const b = document.createElement('button');
    b.textContent = name;
    b.onclick = () => dev.play(name);
    box?.append(b);
  }
  return true;
})();

let people = 0;
/** One trip of the list: everybody leaves from one end, then (a cut) arrives at the other. */
dev.play = async (name, { back = false, hurried = false, n = 1, follow = true, gap = 0.5, stairs = undefined, followed = false } = {}) => {
  await dev.ready;
  const T = TRIPS[name];
  let [from, to] = back ? [T.b, T.a] : [T.a, T.b];
  // (a place's point made fit to stand on; a junction's middle, Jay St & Washington St, to the lane beside it)
  // (a point inside a lot or a building, St. Mercy's, Precinct 9's: the nearest sidewalk to it, on rings 1 m apart)
  const fit = p => {
    if (dev.actors.onRoad(p[0], p[1])) {
      const L = dev.actors.laneLine(p[0], p[1]);
      if (L && Math.hypot(L.x - p[0], L.z - p[1]) < 12) p = [L.x, L.z];
    }
    const walkable = (x, z) => PLAN.kerbOut(x, z) > 0.9 && PLAN.kerbOut(x, z) < 3.2 && !dev.actors.solidAt(x, z);
    if (!walkable(p[0], p[1])) {
      search: for (let r = 1; r <= 40; r++) {
        for (let k = 0; k < 8 * r; k++) {
          const a = (2 * Math.PI * k) / (8 * r);
          const q = [p[0] + Math.sin(a) * r, p[1] + Math.cos(a) * r];
          if (walkable(q[0], q[1])) {
            p = q;
            break search;
          }
        }
      }
    }
    const s = dev.actors.fitSpot(p[0], p[1]);
    return [s.x, s.z];
  };
  [from, to] = [fit(from), fit(to)];
  const ids = [];
  for (let k = 0; k < n; k++) {
    const id = `rider${++people}`;
    const spot = dev.actors.fitSpot(from[0] + k * 1.2, from[1]);
    dev.actors.add({ id, x: spot.x, z: spot.z, ry: Math.atan2(to[0] - from[0], to[1] - from[1]), look: { seed: id } });
    // (several: each a body's width from the others, along the sidewalk: actors.place keeps people apart)
    dev.actors.place(id, spot.x, spot.z, Math.atan2(to[0] - from[0], to[1] - from[1]));
    ids.push(id);
  }
  dev.current = { name, ids, from, to, phase: 'leave' };
  // (the city's own crowd kept off the scene, as the game keeps it off its set: actors.setKeepOut. ?crowd=1 keeps it)
  const keep = p => !Q.has('crowd') && dev.actors.setKeepOut([p[0] - 30, p[1] - 30, p[0] + 30, p[1] + 30]);
  const mode = T.mode;
  keep(from);
  if (follow) dev.cam(from[0], from[1]);
  await dev.actors.seconds(1);
  say(`${name}: leave ${T.names[back ? 1 : 0]} by ${mode}`);
  const t1 = dev.actors.clock;
  const left = await Promise.all(ids.map((id, k) => dev.actors.seconds(k * gap).then(() => dev.rides.leave(id, { mode, from, toward: to, hurried, stairs, followed: k === 0 && (Q.has('followed') || followed) }))));
  const leave = dev.actors.clock - t1;
  dev.current.phase = 'cut';
  dev.current.leftAt = dev.actors.clock;
  dev.current.left = left;
  // (the scene plays on past the cut: the camera stays a moment to show what is seen if it lingers)
  await dev.actors.seconds(Number(Q.get('linger') ?? 1.5));
  // ?followed=1 on a subway trip: the city's carriage between the halves, for the first of them
  if (mode === 'subway' && (Q.has('followed') || followed)) {
    dev.current.phase = 'carriage';
    dev.current.carriage = await dev.rides.between(ids[0], { from, to, seconds: 8 });
  }
  say(`${name}: arrive at ${T.names[back ? 0 : 1]} by ${mode}`);
  keep(to);
  if (follow) dev.cam(to[0], to[1]);
  dev.current.phase = 'arrive';
  const t2 = dev.actors.clock;
  const came = await Promise.all(ids.map((id, k) => dev.actors.seconds(k * gap).then(() => dev.rides.arrive(id, { mode, at: [to[0] + k * 1.2, to[1]], from, hurried, stairs, followed: k === 0 && (Q.has('followed') || followed) }))));
  const arrive = dev.actors.clock - t2;
  dev.current.phase = 'done';
  dev.current.came = came;
  const out = { name, mode, leave: +leave.toFixed(2), arrive: +arrive.toFixed(2), left, came };
  say(`${name}: leave ${out.leave} s, arrive ${out.arrive} s`);
  dev.last = out;
  return out;
};

if (Q.get('play')) dev.ready.then(() => dev.play(Q.get('play'), { back: Q.has('back'), n: Number(Q.get('n')) || 1, stairs: Q.has('stairs') ? Q.get('stairs') !== '0' : undefined }));
