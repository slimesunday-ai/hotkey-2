// THE DRUG LOOKS, STAGED ONE AT A TIME (looks-1): demo/?mode=looks. A named person of the game at the night market (or
// the trailer park) among the city's crowd, the game's own camera on them, and the look put on, held, and taken off
// again on a timeline, so it can be filmed and watched live. The owner's page for judging the looks by eye; the film
// tool's (demo/tools/looks-film.mjs).
//
//   /demo/?mode=looks&look=zonk|disco|lowres|pukes|cooked   [&zone=market|projects] [&hour=22 (night) | 13 (day)]
//          (lowres: the tape, the city's vhs skin, its name still open)
//          [&view=low]   a low view from the street instead of the game's camera
//          [&loop=1]     the timeline over and over (to watch live); the page's keys: 1-5 a look, Space again, L the view
// After it is up: window.__looksLab = { look, phase ('wait' | 'on' | 'off' | 'done'), t, marks: [[t, what]], who }
import { LOOKS } from '../stage/looks/index.js';

/** Who the look is put on, by look, and where they stand (metres from the place's `street` point, toward the camera's side). */
const CAST = {
  zonk: { who: 'pockets', at: { market: [-1.2, -8.0], projects: [1.2, 0.6] } },
  disco: { who: 'lola', at: { market: [3.6, -8.1], projects: [1.2, 0.6] } },
  // (pot-3: the tape, on somebody walking up and down: the static and the bursts ride the body as it moves. No jerks,
  // so the camera is on them as it is on anybody)
  lowres: { who: 'pockets', at: { market: [-1.0, -7.4], projects: [1.2, 0.6] } },
  pukes: { who: 'benny', at: { market: [-1.2, -8.0], projects: [1.2, 0.6] } },
  cooked: { who: 'tiny', also: 'ferraro', at: { market: [-1.2, -8.0], projects: [1.2, 0.6] } },
};
/** The timeline: seconds after the person is there. `crowd`: when strangers start catching it. */
const TIME = {
  zonk: { on: 1.5, off: 15.5, end: 22 },
  disco: { on: 1.5, crowd: 4, off: 27, end: 31 },
  lowres: { on: 1.0, off: 13, end: 15 },
  pukes: { on: 1.5, off: null, end: 10 },
  cooked: { on: 1.5, off: 12, end: 15 },
};

export async function mountLooks(host, { stage, demo = window.__demo } = {}) {
  const Q = new URLSearchParams(location.search);
  const city = demo.city;
  const { actors, camera, looks, map } = stage;
  if (!looks) throw new Error('looks: the stage has no looks (?looks=0?)');
  const zone = Q.get('zone') === 'projects' ? 'projects' : 'market';
  const hour = Number(Q.get('hour') ?? 22);
  stage.setClock({ day: 1, hour });
  let look = LOOKS[Q.get('look')] ? Q.get('look') : 'zonk';
  const low = Q.get('view') === 'low';
  const lab = (window.__looksLab = { look, phase: 'wait', t: 0, marks: [], who: null, zone, hour, view: low ? 'low' : 'game', frames: [] });
  await actors.until(() => !!city.peds?.anim?.batch);
  const base = map.BLOCKS[zone].spots.street;
  const added = new Set();
  // (facing the camera: it is east of them, looking west)
  const EAST = Math.PI / 2;

  function person(id, named, dx, dz, ry = EAST) {
    let [x, z] = [base[0] + dx, base[1] + dz];
    const fit = actors.fitSpot?.(x, z);
    if (fit && Number.isFinite(fit.x)) [x, z] = [fit.x, fit.z];
    if (actors.has(id)) actors.place(id, x, z, ry);
    else actors.add({ id, name: named, x, z, ry, look: { named } });
    added.add(id);
    return actors.get(id);
  }

  function view() {
    // (the low view: from the street a little off the game's bearing; the pukes and cooked side on, so the ground in front and the two squared up show)
    if (low) camera.setAngle({ bearing: Number(Q.get('lowbear') ?? (look === 'pukes' || look === 'cooked' ? 180 : 70)), down: Number(Q.get('lowdown') ?? 20), high: Number(Q.get('lowhigh') ?? 2.1) });
    else camera.setAngle({ bearing: 90, down: 64, high: 24 });
  }

  // THE CAST is on stage from the start (a named person's look is baked when they are added: in the game they are
  // there already, so none of that is in the look's own frames)
  function cast(name) {
    const C = CAST[name];
    const at = C.at[zone];
    const A = person(`lab:${C.who}`, C.who, at[0], at[1]);
    // (low res: the other walks beside them, a body's width and a hand across the way they walk; cooked: the one squared up to)
    const B = C.also ? person(`lab:${C.also}`, C.also, at[0] + (name === 'lowres' ? 0 : 1.7), at[1] + (name === 'lowres' ? 1.25 : 0.4), name === 'cooked' ? -EAST : EAST) : null;
    return { A, B, id: A.id };
  }
  {
    const { id } = cast(look);
    lab.who = id;
    camera.begin({ you: id, mode: 'watch' });
    camera.focus(id);
    view();
  }

  // THE TIMELINE of one look
  let runId = 0;
  async function run(name) {
    const my = ++runId;
    look = lab.look = name;
    lab.marks = [];
    lab.phase = 'wait';
    for (const id of added) looks.off(id, { now: true });
    const { A, B, id } = cast(name);
    lab.who = id;
    const eye = id;
    camera.begin({ you: eye, mode: 'watch' });
    camera.focus(eye);
    view();
    const T = TIME[name];
    const t0 = (lab.t0 = actors.clock);
    lab.slow = [];
    const now = () => actors.clock - t0;
    const until = s => actors.until(() => runId !== my || now() >= s);
    const mark = what => lab.marks.push([+now().toFixed(2), what, +(performance.timeOrigin + performance.now()).toFixed(1)]);
    mark('start');
    // THE TAPE walks: up and down the sidewalk under it
    let walking = false;
    if (name === 'lowres') {
      walking = true;
      (async () => {
        const [x0, z0] = [A.x, A.z];
        // (up and down the sidewalk by the market's lot, 3.5 m each way of where they stood: across the game's picture)
        let dir = -1;
        while (walking && runId === my) {
          await actors.stepTo(id, x0 + dir * 3.5, z0, { v: 1.25 });
          dir = -dir;
          await actors.seconds?.(0.4);
        }
      })();
    }
    await until(T.on);
    if (runId !== my) return;
    looks.on(id, name, { chunky: Q.get('chunky') === '1' });
    lab.phase = 'on';
    mark('on');
    if (name === 'cooked' && B) actors.face(id, B.x, B.z);
    if (T.crowd) {
      await until(T.crowd);
      if (runId !== my) return;
      lab.crowd = looks.crowd(id, name, { n: 10, r: 16 });
      mark(`crowd ${lab.crowd.length}`);
    }
    if (T.off !== null) {
      await until(T.off);
      if (runId !== my) return;
      looks.off(id);
      for (const w of city.peds.sim.walkers) if (looks.has(w) && w !== A.w) looks.off(w);
      lab.phase = 'off';
      mark('off');
    }
    await until(T.end);
    walking = false;
    if (runId !== my) return;
    lab.phase = 'done';
    mark('done');
    if (Q.get('loop') === '1') run(name);
  }

  // frame times, for the film tool's measure (every frame the page drew, ms)
  let last = performance.now();
  const tick = t => {
    lab.frames.push(+(t - last).toFixed(2));
    // (a slow frame: when, on the look's timeline, and what it was doing)
    if (t - last > 33.4 && lab.marks.length) lab.slow = [...(lab.slow ?? []).slice(-20), [+(actors.clock - lab.t0).toFixed(2), +(t - last).toFixed(1), lab.phase]];
    if (lab.frames.length > 4000) lab.frames.splice(0, 2000);
    last = t;
    lab.t = +(actors.clock).toFixed(2);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // keys: 1-5 a look, space again, L the view
  const KEYS = ['zonk', 'disco', 'lowres', 'pukes', 'cooked'];
  addEventListener('keydown', e => {
    const k = Number(e.key);
    if (k >= 1 && k <= KEYS.length) run(KEYS[k - 1]);
    if (e.code === 'Space') run(look);
  }, true);

  // a plain label of the look, top left
  const tag = document.createElement('div');
  Object.assign(tag.style, { position: 'fixed', left: '12px', top: '10px', zIndex: 20, font: '600 15px/1.3 system-ui, sans-serif', color: '#fff', background: 'rgba(0,0,0,.55)', padding: '6px 10px', borderRadius: '6px', pointerEvents: 'none' });
  document.body.append(tag);
  setInterval(() => {
    tag.textContent = `${LOOKS[look].says} · ${lab.phase === 'on' ? 'ON' : lab.phase === 'off' ? 'wearing off' : lab.phase === 'done' ? 'off' : 'not yet'}`;
    tag.style.display = Q.has('notag') ? 'none' : '';
  }, 200);

  if (Q.get('auto') !== '0') run(look);
  return { run, get look() { return look; }, lab };
}
