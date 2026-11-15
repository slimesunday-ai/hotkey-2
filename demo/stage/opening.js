// THE OPENING OF A RUN. The owner, 2026-11-13, of a run that began on the room alone: "it makes it look like the city
// doesnt exist as soon as you start the game". He kept the separate inside view and asked to "just fix the opening".
//
// A new run (a page load, or "New run", which loads the page again) begins on the city: the camera high over the
// trailer park by day, the city's own blocks and walkers under it, comes down toward the player's trailer, eased,
// three and a half seconds in all; then the picture goes through black (the stage's own fade, travel.js) and comes
// back on the room, where the run's first morning is played as before ("You wake at the crib"). Space, Enter or a
// click skips it: straight through black to the room. It is played once per page, before the run's first hour, and
// only when the run asks (not on auto, not with &scenes=0).
//
// NOBODY OF OURS IS ON THE STAGE WHILE IT PLAYS: it comes before the run's stage.begin, which puts everyone where the
// run's state has them, under the black it leaves behind. That black is held until the inside view is up round the
// player (inside.js), and only then let go, so nobody is seen put anywhere (the audit's `vanish` counts nothing).
//
//   const opening = createOpening({ city, fade, inside })
//   await opening.play({ key })   key: the place with an inside the run starts in ('pad:a1'). Resolves when the picture
//                                 is black (or at once when it cannot be played: the place's block is not built). The
//                                 black is let go by itself once the inside view of `key` is up (or after 12 s)
//   opening.debug()               { state, t, skipped, ms, path } for the tools

/** The whole move (s) and how long before its end the fade starts (s): the move ends under the black. */
const MOVE = 3.2;
const FADE_LEAD = 0.12;
/** The lens, high and low (degrees). */
const FOV = [44, 40];
/** Where it starts: this far from the park's middle round the trailer (m), this steep (degrees). */
const HIGH = { d: 92, down: 61, back: 9 };
/** Where it ends: this far in front of the trailer's door (m), this high over its stoop (m), looking at the door. */
const LOW = { d: 10.5, h: 5.2 };
/** How long it waits for the city, the place and the page's veil before it gives up and lets the run start (s). */
const WAIT = 12;
/**
 * THE CITY FALLS AWAY. The owner, 2026-11-13: "is there a way to have the city disolve away to the grass layout we
 * have now? like they voxel away and waht's left is you in the room in the cut away? thatd be kinda sick" and, asked
 * where: "yeah just use the dissolve in the opening".
 *
 * A place builds its inside `lift` metres over its own lot, so a camera that much LOWER than the inside view's has the
 * trailer in the city exactly where the room is in the inside view. The move ends on that camera; the last picture of
 * the city is kept over the page (a copy of the canvas, so it is the picture to the pixel: the grade and the grain
 * with it); the run begins under it and the room comes up, held on the matching frame (inside.hold); then the kept
 * picture breaks into blocks that shrink and lift away, from the trailer outward, and the room on its ground is what
 * is left. The cell's size on the page (px), how long the wave takes to reach the far corner, how ragged its edge is,
 * and how long one block takes to go (s).
 */
const FALL = { cell: 24, spread: 0.85, ragged: 0.22, life: 0.34, settle: 0.7 };
/**
 * AND THEN, AS HE MEANT IT (the same day, of that first version: "the dissolve is not what I meant, kind of like the
 * buildings disassemble in reverse around the trailer ... like Tetris blocks ... the trailers reverse grow, like voxel
 * away. Kinda like reverse stacking blocks. And the trailer ground is still grass it should be the actual ground the
 * trailer is on, just the other trailers around reverse voxel build/stack away"): the city itself is unstacked
 * (fallaway.js: every column of it cut down from its top, half a metre at a time, the nearest to the trailer first),
 * the player's own trailer last, down to the lot's own ground; that bare lot is what the inside view then stands the
 * room on (inside.js draws it under the room), and the room stacks itself up where the trailer stood (inside.rise).
 * The kept picture of above is now only the splice between the two (the bare lot before, the bare lot after: nothing
 * is seen to change under it); the flat fall is what plays if the city cannot be unstacked.
 * `lead`: how long before the move's end the unstacking starts (s) · `top`: the height a column starts from (m) ·
 * `pace`: seconds a metre out from the trailer · `ragged`: seconds of scatter · `far`: how far out it must reach (m) ·
 * `own`: when the player's own trailer starts, as a share of the others' time.
 */
const UNSTACK = { lead: 0.7, top: 6.5, pace: 0.022, ragged: 0.4, far: 45, own: 0.55 };
/**
 * AND THEN, WHAT HE CHOSE (the same evening, of the unstacking: "I don't like the intro, how about instead it's your
 * character walking into the the trailer with the cut scene like what happens in the normal game. Like as you get
 * closer you see the character walking into the trailer"). The run begins with the player outside in the trailer
 * park; the camera starts high over the park and comes down to the game's own picture of them (the Lock's pose,
 * camera.js lockPose) while they walk home; there the camera is the game's again, and what follows is exactly what
 * going inside is at any hour: the shot at the door, the door, the step in, black, the room. The unstacking stays,
 * asked for with ?opening=unstack (stage/index.js openRun).
 * `move`: how long the camera takes to come down (s) · `far`: how many times the game's distance it starts from ·
 * `swing`: how far round it starts (rad) · `down`: how steeply it looks at the start (degrees).
 */
const WALKIN = { move: 2.8, far: 2.6, swing: 0.5, down: 62 };

export function createOpening({ city, fade, inside, fall: unbuild = null, camera = () => null }) {
  // (the panels are mounted before it plays and painted only for the first morning: while it plays they are empty
  // boxes over the city, so they are kept out of the picture until it is black)
  const css = document.createElement('style');
  css.textContent = 'body.hk2-opening .hk-top, body.hk2-opening .hk-left, body.hk2-opening .hk-right, body.hk2-opening .hk-move-card { visibility: hidden; }';
  document.head.append(css);
  const rig = city.cam;
  const world = rig?.world ?? null;
  const cam = city.camera;
  const ctl = city.controls;
  const D = { state: 'idle', t: 0, skipped: false, ms: 0, path: null, frames: 0, released: null };
  const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
  const rad = d => (d * Math.PI) / 180;

  /** Whether a camera at `p` is in the open (over every roof within a metre and a half) and sees `q`. */
  const openAt = p => !world || [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]].every(([dx, dz]) => world.topAt(p[0] + dx, p[2] + dz) < p[1] - 1.2);
  const sees = (p, q) => !world || !world.ray({ x: p[0], y: p[1], z: p[2] }, { x: q[0], y: q[1], z: q[2] });

  /** The move: from high over the park to the trailer's door, the bearing chosen so that every point of it is in the open. */
  function pathFor(o) {
    const g = o.stoop[1];
    const door = [o.sill[0], g + 1.25, o.sill[2]];
    const az0 = Math.atan2(o.face[0], o.face[1]);
    for (const turn of [0.42, -0.42, 0.7, -0.7, 0.2, -0.2, 1.0, -1.0, 0]) {
      for (const lift of [0, 1.8, 4]) {
        const az = az0 + turn;
        const d1 = LOW.d;
        const h1 = LOW.h + lift;
        const el1 = Math.atan2(h1 - 1.25, d1);
        const tgt1 = door;
        // (high: over a point a little in front of the trailer, so the park is round it, the trailer below the middle)
        const tgt0 = [door[0] + Math.sin(az) * HIGH.back, g + 1, door[2] + Math.cos(az) * HIGH.back];
        const P = {
          az0: az + 0.55, az1: az, el0: rad(HIGH.down), el1, d0: HIGH.d, d1: Math.hypot(d1, h1 - 1.25), tgt0, tgt1,
        };
        const end = poseAt(P, 1);
        if (!openAt(end.pos) || !sees(end.pos, door)) continue;
        let ok = true;
        for (let s = 0; s <= 1.0001 && ok; s += 0.05) ok = openAt(poseAt(P, s).pos);
        if (ok) return P;
      }
    }
    return null;
  }
  /** The camera at s (0 … 1 of the move, eased already): round a target sliding from the park to the door, the bearing, the steepness and the distance easing down together. */
  function poseAt(P, s) {
    const L = (a, b) => a + (b - a) * s;
    const tgt = [L(P.tgt0[0], P.tgt1[0]), L(P.tgt0[1], P.tgt1[1]), L(P.tgt0[2], P.tgt1[2])];
    const az = L(P.az0, P.az1);
    const el = L(P.el0, P.el1);
    // (the distance falls away geometrically: the same share every moment, as a camera coming down feels)
    const d = P.d0 * Math.pow(P.d1 / P.d0, s);
    const pos = [tgt[0] + Math.sin(az) * Math.cos(el) * d, tgt[1] + Math.sin(el) * d, tgt[2] + Math.cos(az) * Math.cos(el) * d];
    return { pos, tgt, fov: L(FOV[0], P.fov1 ?? FOV[1]) };
  }
  // (ease in and out: it sets off and comes in gently)
  const ease = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

  function put(v) {
    cam.position.set(...v.pos);
    ctl.target.set(...v.tgt);
    if (Math.abs(cam.fov - v.fov) > 1e-3) {
      cam.fov = v.fov;
      cam.updateProjectionMatrix();
    }
    cam.lookAt(...v.tgt);
  }

  /** The move that ends ON a pose (the camera that matches the inside view's): the bearing swung in from one side, every point of it in the open. */
  function pathTo(M) {
    const off = [M.pos[0] - M.tgt[0], M.pos[1] - M.tgt[1], M.pos[2] - M.tgt[2]];
    const d1 = Math.hypot(...off) || 1;
    const el1 = Math.asin(Math.max(-1, Math.min(1, off[1] / d1)));
    const az1 = Math.atan2(off[0], off[2]);
    if (!openAt(M.pos)) return null;
    const tgt0 = [M.tgt[0] + Math.sin(az1) * HIGH.back, M.tgt[1], M.tgt[2] + Math.cos(az1) * HIGH.back];
    for (const swing of [0.55, -0.55, 0.3, -0.3, 0]) {
      const P = { az0: az1 + swing, az1, el0: rad(HIGH.down), el1, d0: HIGH.d, d1, tgt0, tgt1: M.tgt, fov1: M.fov };
      let ok = true;
      for (let u = 0; u <= 1.0001 && ok; u += 0.05) ok = openAt(poseAt(P, u).pos);
      if (ok) return P;
    }
    return null;
  }

  /** The picture on the canvas now, kept (a canvas of its own), or null if it cannot be read (it reads black once the frame has been handed on). */
  function keep() {
    const src = city.renderer?.domElement;
    if (!src || !(src.width > 0 && src.height > 0)) return null;
    const snap = document.createElement('canvas');
    snap.width = src.width;
    snap.height = src.height;
    try {
      snap.getContext('2d').drawImage(src, 0, 0);
      const probe = document.createElement('canvas');
      probe.width = probe.height = 8;
      const pg = probe.getContext('2d', { willReadFrequently: true });
      pg.drawImage(snap, 0, 0, 8, 8);
      const px = pg.getImageData(0, 0, 8, 8).data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
      if (sum < 64 * 3 * 8) return null;
    } catch {
      return null;
    }
    return snap;
  }
  /** The kept picture over the page: over the stage's black, under the panels. */
  function cover(snap) {
    const r = city.renderer.domElement.getBoundingClientRect();
    const c = document.createElement('canvas');
    c.id = 'hk2-opening-city';
    c.width = snap.width;
    c.height = snap.height;
    const kz = Number(getComputedStyle(document.getElementById('k') ?? document.body).zIndex);
    c.style.cssText = `position: fixed; left: ${r.left}px; top: ${r.top}px; width: ${r.width}px; height: ${r.height}px; z-index: ${Number.isFinite(kz) && kz > 14 ? kz - 1 : 13}; pointer-events: none;`;
    c.getContext('2d').drawImage(snap, 0, 0);
    document.body.append(c);
    return { c, snap, scale: snap.width / Math.max(1, r.width) };
  }
  const noise = (i, j) => {
    const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  /** The kept picture falls away in blocks, from `at` (page px) outward: each shrinks and lifts, a dark side under it, and is gone. */
  async function fall(C, at) {
    const { c, snap, scale } = C;
    const g = c.getContext('2d');
    const cell = Math.max(8, Math.round(FALL.cell * scale));
    const cols = Math.ceil(c.width / cell);
    const rows = Math.ceil(c.height / cell);
    const [cx, cy] = at ? [at[0] * scale, at[1] * scale] : [c.width / 2, c.height / 2];
    const far = Math.max(Math.hypot(cx, cy), Math.hypot(c.width - cx, cy), Math.hypot(cx, c.height - cy), Math.hypot(c.width - cx, c.height - cy)) || 1;
    const delay = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) delay[j * cols + i] = (Math.hypot((i + 0.5) * cell - cx, (j + 0.5) * cell - cy) / far) * FALL.spread + noise(i, j) * FALL.ragged;
    const total = FALL.spread + FALL.ragged + FALL.life;
    const t0 = performance.now();
    D.state = 'falling';
    for (;;) {
      const t = (performance.now() - t0) / 1000;
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(snap, 0, 0);
      // (top row first: a block lifting goes over the row above it, which is already drawn)
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const u = (t - delay[j * cols + i]) / FALL.life;
          if (u <= 0) continue;
          const [x, y] = [i * cell, j * cell];
          g.clearRect(x, y, cell, cell);
          if (u >= 1) continue;
          const sz = cell * (1 - u * u);
          const [dx, dy] = [x + (cell - sz) / 2, y + (cell - sz) / 2 - cell * 0.9 * u];
          g.drawImage(snap, x, y, cell, cell, dx, dy, sz, sz);
          g.fillStyle = 'rgba(0, 0, 0, 0.28)';
          g.fillRect(dx, dy + sz, sz, Math.max(1, sz * 0.2));
        }
      }
      if (t >= total) break;
      await frame();
    }
    c.remove();
  }

  /**
   * Lets the black go once the run's first morning has the room up round the player. With the bare lot kept over the
   * page (C.bare), the room is first stood down to nothing under it, the kept picture is taken away (the lot under it
   * is the same lot) and the room stacks itself up. With the city kept over it (the flat fall), the city falls away.
   */
  async function release(key, C = null) {
    const t0 = performance.now();
    while (inside.up !== key && performance.now() - t0 < WAIT * 1000) await frame();
    await inside.ready();
    await frame();
    await frame();
    D.released = Math.round(performance.now() - t0);
    if (!C) return void fade.in();
    try {
      const stacks = !!C.bare && !!inside.realGround && !!inside.rise;
      if (stacks) inside.rise({ on: true, t: 0 });
      // (the black lifts UNDER the kept picture: the room, or the bare lot, is live beneath it before it goes)
      await fade.in();
      const veil = document.getElementById('hk2-cut');
      for (let k = 0; k < 90 && veil && +getComputedStyle(veil).opacity > 0.02; k++) await frame();
      document.body.classList.remove('hk2-opening');
      await frame();
      if (stacks) {
        await frame();
        C.c.remove();
        D.state = 'stacking';
        const span = inside.riseSpan();
        const r0 = performance.now();
        for (;;) {
          const t = (performance.now() - r0) / 1000;
          inside.rise({ on: true, t });
          if (t >= span) break;
          await frame();
        }
        return;
      }
      // (from the room's own middle on the page)
      const b = inside.place(key)?.bounds?.();
      let at = null;
      if (b && city.THREE) {
        const v = new city.THREE.Vector3(b.corners.reduce((q, p) => q + p[0], 0) / 4, b.y, b.corners.reduce((q, p) => q + p[1], 0) / 4).project(cam);
        at = [((v.x + 1) / 2) * innerWidth, ((1 - v.y) / 2) * innerHeight];
      }
      await fall(C, at);
    } finally {
      C.c.remove();
      inside.rise?.({ on: false });
      document.body.classList.remove('hk2-opening');
      inside.letGo?.(FALL.settle);
    }
  }

  async function play({ key }) {
    const t0 = performance.now();
    D.state = 'waiting';
    // (the panels are out of the picture from the first moment: the page's loading veil lifts over them otherwise, a
    // frame of empty boxes over the city)
    document.body.classList.add('hk2-opening');
    // ── WHEN THE STAGE IS READY: the city's walkers up, the trailer's block built (its door known), the page's
    // loading veil lifted
    const place = inside.place(key);
    const veil = document.getElementById('loadin');
    const ready = () => !!city.peds?.ready && !!place?.door?.()?.outside && document.body.classList.contains('up') && (!veil || +getComputedStyle(veil).opacity < 0.08);
    while (!ready() && performance.now() - t0 < WAIT * 1000) await frame();
    const o = ready() ? place.door().outside : null;
    // ── WHERE IT ENDS: on the camera that matches the inside view's (the city then falls away round the room); if the
    // place cannot say, or that camera is not in the open, at the trailer's door, and through black as before
    const lift = Number(place?.lift) || 0;
    const frameIn = o && lift > 0 ? inside.hold?.(key) ?? null : null;
    const match = frameIn ? { pos: [frameIn.pos[0], frameIn.pos[1] - lift, frameIn.pos[2]], tgt: [frameIn.tgt[0], frameIn.tgt[1] - lift, frameIn.tgt[2]], fov: frameIn.fov } : null;
    let P = match ? pathTo(match) : null;
    const matched = !!P;
    if (!matched) {
      inside.letGo?.(0);
      P = o ? pathFor(o) : null;
    }
    if (!P) {
      document.body.classList.remove('hk2-opening');
      D.state = 'skipped: not ready';
      return { played: false };
    }
    // (can the city be unstacked? the place's floor says where from, and which box is the player's own)
    const b = matched ? place.bounds?.() : null;
    const solid = !!(b && unbuild && (unbuild.scan(), unbuild.ok));
    const mid = b ? [b.corners.reduce((q, p) => q + p[0], 0) / 4, b.corners.reduce((q, p) => q + p[1], 0) / 4] : null;
    const edge = b ? [b.corners[1][0] - b.corners[0][0], b.corners[1][1] - b.corners[0][1]] : null;
    const el = edge ? Math.hypot(...edge) || 1 : 1;
    const own = b ? { box: [mid[0], mid[1], el / 2 + 0.5, Math.hypot(b.corners[2][0] - b.corners[1][0], b.corners[2][1] - b.corners[1][1]) / 2 + 0.5], ax: [edge[0] / el, edge[1] / el] } : null;
    const others = solid ? unbuild.span(UNSTACK.top, undefined, UNSTACK.far, UNSTACK.pace, UNSTACK.ragged) : 0;
    const ownAt = others * UNSTACK.own;
    const whole = solid ? Math.max(others, ownAt + unbuild.span(UNSTACK.top, undefined, 0, UNSTACK.pace, UNSTACK.ragged)) : 0;
    /** The city at `u` seconds into its unstacking (the sun's shadows going with it). */
    const unstack = u => {
      unbuild.set({ on: true, t: u, top: UNSTACK.top, at: mid, pace: UNSTACK.pace, ragged: UNSTACK.ragged, own: { ...own, t: u - ownAt } });
      unbuild.shadows(1 - Math.min(1, u / (whole * 0.8)));
    };
    D.path = { from: poseAt(P, 0), to: poseAt(P, 1), matched, solid, whole: +whole.toFixed(2) };
    // ── THE MOVE. The rig is the map's controls' (camera.js does the same before every cut of its own); the shadow
    // follows the camera's target while it moves (the city's own rule for a free camera)
    rig?.toOrbit?.({ instant: true });
    city.clearFixedShadow?.();
    put(poseAt(P, 0));
    let skip = false;
    const onKey = e => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        skip = true;
      }
    };
    const onPress = () => {
      skip = true;
    };
    addEventListener('keydown', onKey, true);
    addEventListener('pointerdown', onPress, true);
    D.state = 'moving';
    const m0 = performance.now();
    let C = null;
    try {
      for (;;) {
        const t = (performance.now() - m0) / 1000;
        D.t = +t.toFixed(3);
        D.frames += 1;
        put(poseAt(P, ease(Math.min(1, t / MOVE))));
        // (the unstacking starts as the camera comes in to its last place)
        if (solid && t >= MOVE - UNSTACK.lead) unstack(t - (MOVE - UNSTACK.lead));
        if (skip || t >= (matched ? MOVE : MOVE - FADE_LEAD)) break;
        await frame();
      }
      D.skipped = skip;
      if (solid && !skip) {
        // ── THE CITY IS UNSTACKED, the camera still: the others round it, then the player's own trailer, down to the
        // lot's ground. Space ends it at once. Then that bare lot is kept over the page (the splice), the black goes
        // on under it, and the city is given back for the run
        D.state = 'unstacking';
        put(poseAt(P, 1));
        const u0 = performance.now() - UNSTACK.lead * 1000;
        for (;;) {
          const u = (performance.now() - u0) / 1000;
          unstack(skip ? 1e6 : u);
          if (skip || u >= whole) break;
          await frame();
        }
        unbuild.set({ on: true, t: Infinity, at: mid, own: null });
        unbuild.shadows(0);
        for (let k = 0; k < 4 && !C; k++) {
          await frame();
          const snap = keep();
          if (snap) C = Object.assign(cover(snap), { bare: true });
        }
        if (C) fade.blackNow();
        unbuild.set({ on: false, own: null });
        unbuild.shadows(1);
        D.state = C ? 'bare' : 'fading';
      } else if (solid) {
        unbuild.set({ on: false, own: null });
        unbuild.shadows(1);
      }
      if (matched && !skip && !solid) {
        // ── THE CITY IS KEPT: the camera exactly on the matching pose, drawn, and that picture copied over the page;
        // the black goes on under it at once
        put(poseAt(P, 1));
        for (let k = 0; k < 4 && !C; k++) {
          await frame();
          const snap = keep();
          if (snap) C = cover(snap);
        }
        D.state = C ? 'kept' : 'fading';
        if (C) fade.blackNow();
      }
      if (!C) {
        // ── THROUGH BLACK: the fade the inside view uses; the move runs on under it to its end (not when skipped: it
        // stops where it was)
        inside.letGo?.(0);
        D.state = 'fading';
        const out = fade.out();
        while (!skip && !fade.black) {
          const t = (performance.now() - m0) / 1000;
          D.t = +t.toFixed(3);
          put(poseAt(P, ease(Math.min(1, t / MOVE))));
          await frame();
        }
        await out;
      }
    } finally {
      removeEventListener('keydown', onKey, true);
      removeEventListener('pointerdown', onPress, true);
      // (black now: the panels come back over it, as at every cut of the run, before the room is framed between them.
      // Under the kept city they stay out until it starts to fall)
      if (!C) document.body.classList.remove('hk2-opening');
    }
    if (!C) D.state = 'black';
    D.ms = Math.round(performance.now() - m0);
    release(key, C).then(() => {
      D.state = 'done';
    }, err => {
      console.warn('[opening] the black was let go early:', err);
      C?.c.remove();
      document.body.classList.remove('hk2-opening');
      inside.letGo?.(0);
      fade.in();
    });
    return { played: true, skipped: D.skipped, ms: D.ms, fell: !!C };
  }

  /**
   * THE WALK IN. `you` stands outside already (the page put everyone, under the stage's black); go() is the page's own
   * "go inside" for them (it resolves when they are in the room). Resolves when the room is up. Space is the page's
   * own skip of what go() plays: the camera is then given back at once.
   */
  async function walkIn({ you, key, go }) {
    const t0 = performance.now();
    D.state = 'waiting';
    const cams = camera();
    const veil = document.getElementById('loadin');
    const ready = () => !!city.peds?.ready && document.body.classList.contains('up') && (!veil || +getComputedStyle(veil).opacity < 0.08) && !!cams?.lockPose?.(you);
    while (!ready() && performance.now() - t0 < WAIT * 1000) await frame();
    await inside.ready();
    const end0 = cams?.lockPose?.(you) ?? null;
    if (!end0 || inside.up) {
      // (nothing to come down to: the walk alone, as at any hour)
      D.state = 'walking';
      fade.in();
      await go();
      document.body.classList.remove('hk2-opening');
      D.state = 'done';
      return { played: false };
    }
    // (round the person, wherever they have got to: the bearing, the steepness and the distance easing in together)
    const at = (s, end) => {
      const L = (a, b) => a + (b - a) * s;
      const az = L(end.az + WALKIN.swing, end.az);
      const el = L(rad(WALKIN.down), end.el);
      const d = end.d * WALKIN.far * Math.pow(1 / WALKIN.far, s);
      const T = end.tgt;
      return { pos: [T[0] + Math.sin(az) * Math.cos(el) * d, T[1] + Math.sin(el) * d, T[2] + Math.cos(az) * Math.cos(el) * d], tgt: T, fov: L(FOV[0], end.fov) };
    };
    // ── NOTHING MOVES UNTIL THE PAGE DRAWS STEADILY (the owner, of a first load: "when i first loaded the scene it was
    // super glitchy and didnt smoothly zoom in, then when it got to the trailer, it got stuck/glitched a bit"). On a
    // first load the city is still raising what the camera first looks at and making its programs. So, under the
    // black: the city's materials take the fall now (fallaway.js: the ground under the room is drawn with it, and
    // their programs are made here, not at the door); the camera looks from where the move ENDS for a few frames,
    // then from where it starts; and the black lifts only after two dozen frames in a row have come on time (four
    // seconds at the most)
    if (inside.realWanted) unbuild?.scan?.();
    D.state = 'settling';
    cams.cutTo(at(1, end0));
    for (let k = 0; k < 8; k++) await frame();
    cams.cutTo(at(0, end0));
    {
      const c0 = performance.now();
      let last = c0;
      for (let calm = 0; calm < 24 && performance.now() - c0 < 4000;) {
        await frame();
        const now = performance.now();
        calm = now - last < 34 ? calm + 1 : 0;
        last = now;
      }
      D.settled = Math.round(performance.now() - c0);
    }
    D.state = 'moving';
    D.path = { from: at(0, end0), to: at(1, end0), walkIn: true };
    fade.in();
    const m0 = performance.now();
    const going = Promise.resolve().then(go);
    let gone = false;
    going.then(() => {
      gone = true;
    }, () => {
      gone = true;
    });
    for (;;) {
      const t = (performance.now() - m0) / 1000;
      D.t = +t.toFixed(3);
      D.frames += 1;
      // (the page skipped it, or they are in already: the camera is the game's at once)
      if (gone || inside.up === key || fade.dark) break;
      put(at(ease(Math.min(1, t / WALKIN.move)), cams.lockPose(you) ?? end0));
      if (t >= WALKIN.move) break;
      await frame();
    }
    cams.arrived();
    D.state = 'walking';
    D.ms = Math.round(performance.now() - m0);
    try {
      await going;
    } finally {
      document.body.classList.remove('hk2-opening');
      D.state = 'done';
    }
    return { played: true, ms: D.ms };
  }

  return {
    play,
    walkIn,
    debug: () => ({ ...D }),
  };
}
