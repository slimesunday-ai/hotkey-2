// THE FIGHT'S CLIP LAB (demo/?mode=fightlab): every clip the fight plays, new or the city's own, looping on the city's
// own people on the fight's lot, each labelled in plain words, with whoever it is done to beside them, and the shot's
// flash, tracer and puff where a gun fires. Two views: the game's own camera (the size the fight is played at: does it
// read?) and close (does it look right?), one clip at a time. A yes / no for each clip, kept in this browser, and a
// button that copies the verdicts as text.
//
//   keys   G the game's view, all of them · C close on one · ← → the one before or after · Y / N yes or no for it
import { ARENA } from '../../src/fight/data.mjs';
import { createKit } from '../stage/rides/kit.js';
import { arenaOn, siteOf } from './place.js';
import { installClips } from './clips/index.js';
import { createFx } from './fx.js';
import { lookFor } from './clips/gun.js';
import { CONTACT } from './clips/melee.js';
import { muzzleOf } from './anim.js';
import { makeRoot, ensureStyles } from '../hud/dom.js';

/**
 * The acts: who plays what, every how many seconds, and what it is said to be. `clip` loops (a loop) or is played
 * again every `every` s (a one-shot); `walk` m back and forth while it plays; `to`: the one it is done to stands
 * there (arena metres off, along the picture) and does `react` `on` s into each play; `at` where the act stands; `up` the gun's raise;
 * `behind`: the one they shoot at stands behind them while they walk away.
 */
export const ACTS = [
  { id: 'gun-ready', at: [11, 2.4], clip: 'fight_gun', up: 0, walk: 3, says: 'Gun held ready, walking (nobody in range)', kind: 'new' },
  { id: 'gun-aim', at: [13.4, 6.8], clip: 'fight_gun', up: 1, to: 3.2, says: 'Gun up and on them, standing', kind: 'new' },
  { id: 'gun-aim-walk', at: [1.6, 2.4], clip: 'fight_gun', up: 1, walk: 3, to: 3.2, behind: true, says: 'Gun up on them while walking away: the legs walk, the upper body turns back', kind: 'new' },
  { id: 'gun-fire', at: [13.4, 11], clip: 'fight_fire', every: 0.9, base: 'fight_gun', up: 1, to: 3.6, react: 'fight_flinch', on: 0, shot: true, says: 'A shot: the kick, the flash at the gun, the tracer, the puff on them; they flinch', kind: 'new' },
  { id: 'gun-fire-walk', at: [0.8, -2.6], clip: 'fight_fire', every: 0.45, base: 'fight_gun', up: 1, walk: 3, to: 4, shot: true, miss: true, says: 'Shots while walking (a quick gun): kick after kick, the misses puff dust off the ground', kind: 'new' },
  { id: 'hook', at: [8, 2.4], clip: 'fight_hook', every: 1.3, to: 1.15, react: 'fight_flinch', on: CONTACT.fight_hook, says: 'A blow (fists, knuckles, box cutter, tire iron): wind-up, the hit, follow-through; they flinch on the hit', kind: 'new' },
  { id: 'hook-walk', at: [0.8, 6.8], clip: 'fight_hook', every: 1.0, walk: 2.4, to: 1.4, says: 'The same blow thrown while stepping', kind: 'new' },
  { id: 'stab', at: [0.8, 11], clip: 'fight_stab', every: 0.9, to: 1.05, react: 'fight_flinch', on: CONTACT.fight_stab, says: 'A stab (the shiv): drawn back, thrust in, pulled out; they flinch', kind: 'new' },
  { id: 'flinch', at: [7.6, 11], clip: 'fight_flinch', every: 1.2, to: 1.3, from: true, says: 'Hit, and it hurts: the head snaps back, the body rocks away from the blow', kind: 'new' },
  { id: 'vest', at: [16.4, 2.4], clip: 'fight_vest', every: 1.2, to: 1.3, from: true, vest: true, says: 'Hit, and the stab vest takes it: a thud, the head down to the chest, hands to the vest; a grey puff', kind: 'new' },
  { id: 'fall-you', at: [7.6, 6.8], clip: 'fall_back', every: 5, says: 'Going down (you, Earl): the city\'s fall_back, then lying hurt (lie_hurt)', kind: 'the city\'s own' },
  { id: 'fall-them', at: [4.6, 11], clip: 'death_collapse', every: 5, says: 'Going down (them): the city\'s death_collapse, then lying still (lie_still)', kind: 'the city\'s own' },
  { id: 'run', at: [9, -2.6], clip: 'run_getaway', walk: 5, speed: 4.3, says: 'Running in (a runner): the city\'s run_getaway', kind: 'the city\'s own' },
];

export async function mountLab(host, { stage, demo = window.__demo } = {}) {
  const city = demo?.city ?? window.__city;
  const { actors, camera } = stage;
  const CLIPS = actors.CLIPS;
  const kit = stage.rides?.kit ?? createKit({ city, actors, CLIPS });
  const SITE = siteOf(new URLSearchParams(location.search).get('site'));
  const A = arenaOn(SITE, ARENA);
  await actors.until(() => !!city.peds?.anim?.batch || !city.peds);
  installClips({ CLIPS, mats: [city.peds?.anim?.mat, city.peds?.anim?.batch?.customDepthMaterial] });
  const fx = createFx({ city });
  const W = (x, y, up = 0) => {
    const [wx, wz] = A.world(x, y);
    return [wx, actors.groundAt(wx, wz) + up, wz];
  };
  // THE STAGE: the acts in rows on the lot (their `at`, arena metres: clear of the city's own concrete stubs on its
  // middle line, no cover put down), the doer facing the picture's right, the one it is done to beside them; an
  // anchor for the game's view, left of their middle so the panel does not hide them
  const at = k => ACTS[k].at;
  const anchor = 'lab:anchor';
  const [ax, , az] = W(6, 4.5);
  actors.add({ id: anchor, name: 'lab', x: ax, z: az, look: { seed: 'lab', pool: 'agent' } });
  actors.show(anchor, false);
  const people = [];
  const LOOK = n => ({ seed: `lab:${n}`, pool: 'agent', wear: n % 2 ? { top: 'old_hoodie', hat: 'old_beanie' } : { top: 'corner_hoodie', hat: 'corner_rag' } });
  ACTS.forEach((act, k) => {
    const [x, y] = at(k);
    const id = `lab:${act.id}`;
    const [wx, , wz] = W(x, y);
    actors.add({ id, name: act.id, x: wx, z: wz, look: k === 0 ? { seed: 'agent:you', pool: 'agent' } : LOOK(k) });
    const P = { act, id, x, y, body: kit.own(id), t0: actors.clock, last: -9, target: null };
    if (act.to) {
      const tid = `lab:${act.id}:to`;
      const [tx, , tz] = W(x + act.to * (act.behind ? -1 : 1) * (act.walk ? 0 : 1) + (act.behind ? -1.2 : 0), y);
      actors.add({ id: tid, name: 'to', x: tx, z: tz, look: LOOK(k + 7) });
      P.target = { id: tid, body: kit.own(tid), x: act.behind ? x - 1.2 : x + act.to, y };
    }
    people.push(P);
  });
  // (the doer faces +x of the arena: the picture's right; the one it is done to faces them)
  const yawX = Math.atan2(A.X[0], A.X[1]);
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  function play(id, name, t = 0, loop = false) {
    const B = actors.get(id);
    if (!B.w.g) return;
    CLIPS.playClip(B.w.g, name, { t, loop });
    B.want = B.asked = { name, loop, t, after: 0, began: actors.clock, walk: true };
  }
  actors.onFrame(dt => {
    const T = actors.clock;
    fx.now = T;
    for (const P of people) {
      const { act } = P;
      const B = actors.get(P.id);
      // where: still, or back and forth along the picture's x
      let x = P.x;
      let v = 0;
      let dir = 1;
      if (act.walk) {
        const sp = act.speed ?? 1.5;
        const per = (2 * act.walk) / sp;
        const u = ((T - P.t0) % per) / per;
        dir = u < 0.5 ? 1 : -1;
        x = P.x + act.walk * (u < 0.5 ? u * 2 : 2 - u * 2);
        v = sp;
      }
      const [wx, wy, wz] = W(x, P.y);
      const face = act.behind ? (dir > 0 ? yawX : yawX + Math.PI) : act.walk ? (dir > 0 ? yawX : yawX + Math.PI) : yawX;
      P.body.put(wx, wy, wz, face, v);
      // the one it is done to: standing, facing them (or walked past: behind them)
      let bear = 0;
      if (P.target) {
        const [tx, ty, tz] = W(act.behind ? P.x - 1.2 : act.walk ? x + act.to : P.target.x, P.y);
        P.target.body.put(tx, ty, tz, Math.atan2(wx - tx, wz - tz), 0);
        bear = wrap(Math.atan2(tx - wx, tz - wz) - (B.w.yawS ?? face));
      }
      // the clip
      const g = B.w.g;
      if (!g) continue;
      const up = act.up ?? 0;
      const hitFrom = act.from ? bear : bear;
      g.look = lookFor(act.from ? hitFrom : bear, up);
      if (!act.every) {
        if (g.clip?.name !== act.clip) play(P.id, act.clip, 0, true);
        continue;
      }
      if (T - P.last >= act.every) {
        P.last = T;
        play(P.id, act.clip, 0);
        P.react = act.react ? T + (act.on ?? 0) : null;
        if (act.shot) {
          const to = P.target ? actors.get(P.target.id) : null;
          const miss = act.miss && Math.floor(T / act.every) % 2 === 0;
          const dest = to ? (miss ? [to.x + 1.2, to.y + 0.05, to.z - 1.4] : [to.x, to.y + 1.0, to.z]) : W(x + 6, P.y, 1);
          fx.shot(muzzleOf(B, lookFor(bear, 1)), dest, !miss, 'you');
        }
        if (act.vest) fx.vest([B.x, B.y + 1.05, B.z], 4);
      }
      if (P.react !== null && P.react !== undefined && T >= P.react && P.target) {
        P.react = null;
        const TB = actors.get(P.target.id);
        if (TB.w.g) TB.w.g.look = lookFor(wrap(Math.atan2(wx - TB.x, wz - TB.z) - (TB.w.yawS ?? 0)), 0);
        play(P.target.id, act.react, 0);
      }
      // (a one-shot of the fight's own ends where the page says: the gun held again, or the walk)
      const c = g.clip;
      if (c && !c.loop && /^fight_/.test(c.name) && c.t >= CLIPS.CLIP[c.name].dur) {
        if (act.base) play(P.id, act.base, 0, true);
        else {
          CLIPS.stopClip(g);
          B.want = B.asked = null;
        }
      }
      const TBc = P.target && actors.get(P.target.id).w.g?.clip;
      if (TBc && !TBc.loop && /^fight_/.test(TBc.name) && TBc.t >= CLIPS.CLIP[TBc.name].dur) {
        CLIPS.stopClip(actors.get(P.target.id).w.g);
        actors.get(P.target.id).want = actors.get(P.target.id).asked = null;
      }
    }
  });

  // THE VIEWS
  let view = 'game';
  let one = 0;
  camera.begin({ you: anchor, mode: 'watch' });
  camera.focus(anchor);
  function show() {
    if (view === 'game') {
      camera.setAngle({ bearing: 90, down: 64, high: 24 });
      camera.focus(anchor);
    } else {
      // (the game's own angle, three and a half times nearer)
      camera.setAngle({ bearing: 90, down: 64, high: 7 });
      camera.focus(people[one].id);
    }
    render();
  }

  // THE LABELS (on the picture, over each act) and the panel
  const cv = document.createElement('canvas');
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '6' });
  document.body.append(cv);
  const g2 = cv.getContext('2d');
  const V = new city.THREE.Vector3();
  const scr = (x, y, z) => {
    V.set(x, y, z).project(city.camera);
    return V.z > 1 ? null : [(V.x * 0.5 + 0.5) * innerWidth, (-V.y * 0.5 + 0.5) * innerHeight];
  };
  const KEY = 'fightlab:verdicts';
  let verdicts = {};
  try {
    verdicts = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    verdicts = {};
  }
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(verdicts));
    } catch {
      /* (a private window: the verdicts stay on the page) */
    }
  };
  function labels() {
    requestAnimationFrame(labels);
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(innerWidth * dpr)) [cv.width, cv.height] = [Math.round(innerWidth * dpr), Math.round(innerHeight * dpr)];
    g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    g2.clearRect(0, 0, innerWidth, innerHeight);
    people.forEach((P, k) => {
      if (view === 'close' && k !== one) return;
      const B = actors.get(P.id);
      const s = scr(B.x, B.y + 2.4, B.z);
      if (!s) return;
      const v = verdicts[P.act.id];
      const tag = `${k + 1}`;
      g2.font = '800 13px "Inter", Arial, sans-serif';
      g2.textAlign = 'center';
      g2.lineWidth = 4;
      g2.strokeStyle = 'rgba(10,8,6,.9)';
      g2.fillStyle = v === 'yes' ? '#7be38a' : v === 'no' ? '#ff6b57' : '#ffd36b';
      g2.strokeText(tag, s[0], s[1]);
      g2.fillText(tag, s[0], s[1]);
    });
  }
  requestAnimationFrame(labels);

  // (join-1, a light restyle: the run's paper, ink and type, its skin's tokens, as the fight page has them now)
  const RUN = new URL('../run/', import.meta.url).href;
  ensureStyles();
  for (const [href, mark] of [[`${RUN}run.css`, 'data-rn-css'], [`${RUN}ui.css`, 'data-rn-ui'], [`${RUN}skin.css`, 'data-rn-skin']]) {
    if (!document.querySelector(`link[${mark}]`)) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.setAttribute(mark, '');
      document.head.append(l);
    }
  }
  const css = document.createElement('style');
  css.textContent = `#k .fl { position: absolute; left: 8px; top: 8px; width: 380px; max-height: calc(100% - 16px); overflow: auto; z-index: 20; padding: 10px 12px; font: 500 var(--u-fs)/1.35 var(--u-ui); }
#k .fl h2 { margin: 0 0 4px; font: 400 calc(22 * var(--k-px))/1.05 var(--u-sign); text-transform: uppercase; } #k .fl p { margin: 4px 0 8px; color: var(--u-ink-2); font-size: var(--u-fs-s); }
#k .hk .fl ol { margin: 0; padding-left: 24px; list-style: decimal; } #k .fl li::marker { font-weight: 800; } #k .fl li { margin: 0 0 6px; padding-left: 4px; cursor: pointer; } #k .fl li.is-on { box-shadow: inset 4px 0 0 var(--u-you); } #k .fl li small { color: var(--u-mute); font-size: var(--u-fs-s); }
#k .fl .v { display: inline-flex; gap: 4px; margin-left: 6px; } #k .fl button { font: 700 var(--u-fs-s)/1 var(--u-ui); border-radius: 6px; border: 1px solid var(--u-line); background: var(--u-key-bg); color: var(--u-ink); padding: 3px 8px; cursor: pointer; box-shadow: var(--u-key-shadow); }
#k .fl button.yes { background: var(--u-gain); color: var(--u-gain-on); } #k .fl button.no { background: var(--u-loss-plate); color: var(--u-loss-on); } #k .fl .row { display: flex; gap: 6px; margin: 8px 0; }`;
  document.head.append(css);
  const root = makeRoot(host.querySelector?.('#k') ?? host);
  root.classList.add('rn');
  const panel = document.createElement('section');
  panel.className = 'fl u-panel';
  root.append(panel);
  function render() {
    panel.innerHTML = '';
    const h = (tag, cls, text) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (text !== undefined) el.textContent = text;
      return el;
    };
    panel.append(h('h2', '', 'THE FIGHT’S MOVES'), h('p', '', `Each one loops on the city’s own people at ${SITE.short}. G the game’s view (the size you play at) · C close on one · ← → another · Y / N yes or no.`));
    const row = h('div', 'row');
    for (const [k, label] of [['game', 'Game view'], ['close', 'Close']]) {
      const b = h('button', view === k ? 'yes' : '', label);
      b.onclick = () => {
        view = k;
        show();
      };
      row.append(b);
    }
    const copy = h('button', '', 'Copy verdicts');
    copy.onclick = () => navigator.clipboard?.writeText(ACTS.map((a, k) => `${k + 1}. ${a.says}: ${verdicts[a.id] ?? '?'}`).join('\n')).catch(() => {});
    row.append(copy);
    panel.append(row);
    const ol = h('ol');
    ACTS.forEach((a, k) => {
      const li = h('li', k === one && view === 'close' ? 'is-on' : '');
      li.append(document.createTextNode(`${a.says} `), h('small', '', `(${a.clip}; ${a.kind})`));
      const v = h('span', 'v');
      for (const word of ['yes', 'no']) {
        const b = h('button', verdicts[a.id] === word ? word : '', word);
        b.onclick = e => {
          e.stopPropagation();
          verdicts[a.id] = verdicts[a.id] === word ? undefined : word;
          save();
          render();
        };
        v.append(b);
      }
      li.append(v);
      li.onclick = () => {
        one = k;
        view = 'close';
        show();
      };
      ol.append(li);
    });
    panel.append(ol);
  }
  addEventListener('keydown', e => {
    if (e.code === 'KeyG') view = 'game';
    else if (e.code === 'KeyC') view = 'close';
    else if (e.code === 'ArrowRight') one = (one + 1) % ACTS.length;
    else if (e.code === 'ArrowLeft') one = (one + ACTS.length - 1) % ACTS.length;
    else if (e.code === 'KeyY' || e.code === 'KeyN') {
      verdicts[ACTS[one].id] = e.code === 'KeyY' ? 'yes' : 'no';
      save();
    } else return;
    show();
  });
  show();
  return {
    phase: 'lab',
    acts: ACTS.map(a => a.id),
    view: (v, k = one) => {
      view = v;
      one = k;
      show();
    },
    get verdicts() {
      return { ...verdicts };
    },
  };
}
