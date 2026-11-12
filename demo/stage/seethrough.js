// WHAT STANDS BETWEEN THE LENS AND THE PERSON FADES AS A WHOLE THING (the owner, three times: "i dont know if i like
// the tunnel vision i think an opacity drop would be better, and agents next to eachother shouldnt get droped
// especially if 2 are interacting" · "we still have that weird porthole" · "is there a better way, we cant just drop
// opacity on buildings in front? road objects are proably fine, how would a game dev handle this?").
//
// This is the occluder fade of a fixed-camera game: the building, roof, awning or stall that hides the watched person
// (or anyone in a scene with them, or standing next to them) drops to an even low opacity, all of it, eased in and
// out, and comes back when it hides nobody. No round patch.
//
// THE CITY HAS NO OBJECTS TO FADE. A block of the pinned city is four or five merged meshes (one a material), so
// "the bar" is not a mesh and has no material of its own. Two things stand in for it:
//
//   WHICH THING (the processor's side) · the city's own collision world (camera/world.js: every block as 0.25 m
//   columns of solid spans, posts and trunks flagged thin) is walked along the lines from the lens to each person's
//   body. A solid span on a line is grown over its neighbours of about the same top (a roof with its parapet, an
//   awning, a stall's canopy, a tree's crown) and the thing is that patch's box. Once per thing, then remembered.
//
//   HOW IT FADES (the graphics card's side) · the block materials are given a few lines more (chained onto the city's
//   own onBeforeCompile, never a change to the pinned files): a fragment inside the box of a fading thing is drawn
//   through the city's 4×4 screen-door at that thing's opacity. Opaque, unsorted, one uniform branch when nothing
//   fades; the shadow pass has its own materials and never sees it, so the shadows stay.
//
// WHAT FADES
//   · a thing with a roof's size (3 m² or more, a metre wide, its top over a head) fades as soon as it covers any
//     part of anybody watched;
//   · small things (a sign box, a bench, a table, a tree's crown, a parked van) stay solid: the owner's "road objects
//     are probably fine". Posts, poles and trunks are never even asked (the collision world's thin spans), and wires
//     and strings of lights hide nobody;
//   · unless they hide most of a person, chest included, for longer than it takes to walk past: then they fade too;
//   · people are never faded or dropped for standing on the line (the rig's two line settings, below).
//
// WHAT IS STILL THE CITY'S CONE. Its strength is ours to gate (the same property the game capped before), and it is
// zero in normal play. It comes back, softened as before, only while most of the watched person is behind something
// this file cannot box: a block whose collision columns are not built yet (the first moments after a cut to a new
// zone), or a solid thing that is no box at all (a thick wall running diagonally, an L or a ring of wall round a
// yard: its box would take the yard with it).
//
// WHAT OF THE PINNED CITY THIS LEANS ON (to check when the pin moves): city.cam.world.entry(i, j) and its columns
// (off, iv, ivf, top, sh, rank: camera/world.js, world.worker.js) · city.stream.blocks' records (mesh.full, mesh.mid)
// and the tier materials' vWinP (gpu.js tierize) · gpu.js HOLE and camera/config.js lock.hole, lock.lineAlpha,
// fade.lineAlpha · city.cam.mode and city.cam.lock.subject · city.late · city.parkedIn.

/** How much of a faded thing is left, and the seconds in, out and held after the last frame it hid somebody. */
const LEFT = 0.28;
const EASE_IN = 0.25;
const EASE_OUT = 0.3;
const HOLD = 0.18;
/** Things fading at once (the shader's loop). */
const SLOTS = 6;
/** The collision world's column, in metres. */
const COL = 0.25;
/**
 * Two neighbouring columns are one thing when their tops are this near: metres, or this share of the higher one (a
 * roof and its parapet, a pitched roof's steps; a tower's set-backs and plant rooms are metres apart and one tower).
 */
const SAME_TOP = 1.2;
const SAME_SHARE = 0.14;
/** A thing is looked for this far round where the line met it (columns): no thing here is wider than a block. */
const REACH = 96;
/** Nothing lower than this over the feet counts (the kerb, the floor stood on), and a line ends this short of the body. */
const FLOOR = 0.35;
const SHORT = 0.45;
/** A roof's size: square metres, metres across, metres up. */
const BIG = { area: 3, across: 1, top: 2.1 };
/** A crown: floating, thick, and not a building's roof. */
const CROWN = { thick: 1.3, area: 60 };
/** A thing fills at least this much of its own box, or it is no box (a wall running diagonally). */
const BOXLIKE = 0.42;
/** A wire is narrower than this on average, in metres, and no thicker; a net of wires fills less than this of its box. */
const WIRE = 0.6;
const NET = 0.3;
/** "Mostly hidden": this share of the lines up a body, the chest's among them. */
const MOSTLY = 0.6;
/** ...and for this long, in seconds: walking behind a signal's box hides a body for a tenth of one. */
const DWELL = 0.2;
/** Who counts as standing with the watched person, in metres; and how many people are asked about at most. */
const BESIDE = 3;
const PEOPLE = 6;
/** The city's cone, when it is needed at all: the game's softened one (camera.js, before this file). */
const CONE = { lens: 2.6, at: 3.4, edge: 1.8, strength: 0.88 };

const BAYER = 'float( k == 0 ? 0 : k == 1 ? 8 : k == 2 ? 2 : k == 3 ? 10 : k == 4 ? 12 : k == 5 ? 4 : k == 6 ? 14 : k == 7 ? 6 : k == 8 ? 3 : k == 9 ? 11 : k == 10 ? 1 : k == 11 ? 9 : k == 12 ? 15 : k == 13 ? 7 : k == 14 ? 13 : 5 )';
// The test is made a little INSIDE the surface (6 cm back along the face's own normal, read off the derivatives as
// the city's waterline does): a wall of the thing lies on its box's side and would flicker in and out of it, and the
// wall of the house next door lies on the same plane facing the other way and must stay.
const FRAG = `
#if !defined( DEPTH_PACKING )
  if ( uStN > 0 ) { vec3 stP = vWinP - normalize( cross( dFdx( vWinP ), dFdy( vWinP ) ) ) * .06; float stA = 1.;
    for ( int i = 0; i < ${SLOTS}; i ++ ) { if ( i >= uStN ) break; vec4 a = uStA[ i ], b = uStB[ i ];
      if ( stP.x > a.x && stP.z > a.y && stP.x < a.z && stP.z < a.w && stP.y > b.x && stP.y < b.y ) stA = min( stA, b.z ); }
    if ( stA < .999 ) { vec2 q = mod( floor( gl_FragCoord.xy ), 4. ); int k = int( q.x ) + int( q.y ) * 4;
      if ( ( ${BAYER} + .5 ) / 16. >= stA ) discard; } }
#endif`;

export function createSeeThrough({ city, actors, pitch, hole = null, partners = () => [] }) {
  const THREE = city.THREE;
  const rig = city.cam ?? null;
  const W = rig?.world ?? null;
  const G = Math.round(pitch / COL);
  const U = {
    uStN: { value: 0 },
    uStA: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4()) },
    uStB: { value: Array.from({ length: SLOTS }, () => new THREE.Vector4()) },
  };

  // ── people on the line stay whole; the cone is gated ───────────────────────────────────────────────────────────
  // The rig ghosts or drops a body near the line to the watched person (camera/fade.js: lineAlpha). Not here: whoever
  // stands next to them, or is doing business with them, stays whole. (A body the lens is inside still fades: the
  // city's near zone.) And the cone's strength, which the city eases to 1 with no setting for less, is written
  // through us: its cap times `cone.k`, which is 0 unless the cone is needed (the header).
  const cone = { k: 0, want: 0, since: -1e9 };
  if (rig?.config?.lock?.hole) {
    Object.assign(rig.config.lock.hole, { lens: CONE.lens, at: CONE.at, edge: CONE.edge });
    rig.config.lock.lineAlpha = 1;
    if (rig.config.fade) rig.config.fade.lineAlpha = 1;
    const A = hole?.a?.value;
    if (A) {
      let w = 0;
      Object.defineProperty(A, 'w', { get: () => w, set: v => { w = Math.min(v, CONE.strength) * cone.k; }, enumerable: true, configurable: true });
    }
  }

  // ── the materials ──────────────────────────────────────────────────────────────────────────────────────────────
  // The block meshes' own (the stream's records name them: full, four layers, and mid), found again every half
  // second: blocks load as the player travels, and a block changing tier is drawn for a moment with a clone. The
  // city's standing figures (its own records: cfull, cmid) are people and are left alone.
  const wrapped = new WeakSet();
  let programs = 0;
  function wrap(mat) {
    if (!mat || wrapped.has(mat) || !mat._tierOpts || mat.isMeshDepthMaterial) return;
    wrapped.add(mat);
    const prev = mat.onBeforeCompile;
    const key = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh, r) => {
      prev?.call(mat, sh, r);
      if (!sh.fragmentShader?.includes('vWinP')) return;
      Object.assign(sh.uniforms, U);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nuniform int uStN; uniform vec4 uStA[ ${SLOTS} ]; uniform vec4 uStB[ ${SLOTS} ];`)
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + FRAG);
    };
    mat.customProgramCacheKey = () => (key ? key.call(mat) : mat.type) + '|hk2see';
    mat.needsUpdate = true;
    programs += 1;
  }
  function wrapAll() {
    const blocks = city.stream?.blocks;
    if (!blocks) return;
    for (const r of blocks.values()) {
      const M = r.mesh;
      if (!M) continue;
      if (Array.isArray(M.full)) for (const m of M.full) wrap(m?.material);
      wrap(M.mid?.material);
    }
  }

  // ── the collision world's columns ──────────────────────────────────────────────────────────────────────────────
  // (W.entry(i, j): { off, iv, ivf, top, sh, rank } for a block; only the real columns count: a block still on its
  // far massing, or one with a mesh and no columns yet, is `unknown`)
  let eI = NaN;
  let eJ = NaN;
  let eE = null;
  let eKnown = true;
  function entry(i, j) {
    if (i === eI && j === eJ) return eE;
    eI = i;
    eJ = j;
    const e = W.entry(i, j);
    if (e && !e.sh && e.rank >= 2) {
      eE = e;
      eKnown = true;
    } else {
      eE = null;
      const d = city.stream?.blocks?.get(`${i},${j}`)?.data;
      eKnown = !(d && (d.mid || d.full || d.far));
    }
    return eE;
  }

  // ── things ─────────────────────────────────────────────────────────────────────────────────────────────────────
  // (per collision entry: the thing each span belongs to, by the span's index. A rebuilt block is a new entry)
  const spans = new WeakMap();
  const things = new Set();
  const known = [];
  let made = 0;
  const stack = new Int32Array(4 * 4 * REACH * REACH + 8);
  const seen = new Uint8Array(4 * REACH * REACH);
  /** The span of a column nearest in top to `top`, and no thin one: its index, or -1. */
  function spanNear(e, c, top) {
    let best = -1;
    let bd = 1e9;
    for (let k = e.off[c]; k < e.off[c + 1]; k += 2) {
      if (e.ivf[k >> 1] & 1) continue;
      const d = Math.abs(e.iv[k + 1] - top);
      if (d < bd && d <= Math.max(SAME_TOP, SAME_SHARE * Math.max(top, e.iv[k + 1])) && e.iv[k + 1] > FLOOR) {
        bd = d;
        best = k;
      }
    }
    return best;
  }
  /** The thing a span is part of: grown from it over the neighbouring columns whose span tops are near. */
  function thingOf(e0, c0, k0, gx0, gz0) {
    let map = spans.get(e0);
    if (!map) spans.set(e0, map = new Map());
    const had = map.get(k0);
    if (had) return had.same ?? had;
    const T = { id: ++made, x0: 0, z0: 0, x1: 0, z1: 0, y0: 0, y1: 0, area: 0, top: 0, big: false, box: false, wire: false, crown: false, same: null, k: 0, wanted: -1e9 };
    seen.fill(0);
    const D = 2 * REACH;
    let sp = 0;
    let n = 0;
    let [ax, bx, az, bz] = [gx0, gx0, gz0, gz0];
    let [hiMax, thick, grounded, slim] = [-1e9, 0, 0, 0];
    const take = (e, c, k, gx, gz) => {
      let m = spans.get(e);
      if (!m) spans.set(e, m = new Map());
      m.set(k, T);
      const lo = Math.max(0, e.iv[k]);
      const hi = e.iv[k + 1];
      n += 1;
      if (gx < ax) ax = gx;
      if (gx > bx) bx = gx;
      if (gz < az) az = gz;
      if (gz > bz) bz = gz;
      if (hi > hiMax) hiMax = hi;
      thick += hi - lo;
      if (hi - lo < WIRE) slim += 1;
      if (lo <= 0.5) grounded += 1;
      stack[sp++] = gx;
      stack[sp++] = gz;
      stack[sp++] = k;
      stack[sp++] = 0;
    };
    seen[REACH * D + REACH] = 1;
    take(e0, c0, k0, gx0, gz0);
    while (sp) {
      sp -= 4;
      const gx = stack[sp];
      const gz = stack[sp + 1];
      const k = stack[sp + 2];
      const eC = entry(Math.floor(gx / G), Math.floor(gz / G));
      if (!eC) continue;
      const top = eC.iv[k + 1];
      for (let q = 0; q < 4; q++) {
        const nx = gx + (q === 0 ? 1 : q === 1 ? -1 : 0);
        const nz = gz + (q === 2 ? 1 : q === 3 ? -1 : 0);
        const rx = nx - gx0 + REACH;
        const rz = nz - gz0 + REACH;
        if (rx < 0 || rz < 0 || rx >= D || rz >= D || seen[rz * D + rx]) continue;
        const i = Math.floor(nx / G);
        const j = Math.floor(nz / G);
        const e = entry(i, j);
        if (!e) continue;
        const c = (nz - j * G) * G + (nx - i * G);
        const kk = spanNear(e, c, top);
        if (kk < 0) continue;
        seen[rz * D + rx] = 1;
        take(e, c, kk, nx, nz);
      }
    }
    const [w, d] = [(bx - ax + 1) * COL, (bz - az + 1) * COL];
    T.area = n * COL * COL;
    T.top = hiMax;
    T.box = T.area >= BOXLIKE * w * d;
    // a wire, a string of lights, a rail: thin up and down nearly everywhere (not at the gate sign it hangs from), and
    // thin across or a net of such over a yard (the night market's lights are one thing 18 m by 24 m that fills a
    // sixth of its box). It hides nobody
    T.wire = slim >= 0.7 * n && (T.area < WIRE * Math.max(w, d) || T.area < NET * w * d);
    const floating = grounded < n * 0.5;
    T.crown = floating && thick / n >= CROWN.thick && T.area < CROWN.area;
    T.big = T.box && !T.crown && T.area >= BIG.area && Math.min(w, d) >= BIG.across && hiMax >= BIG.top;
    // the box: the patch's columns and 2 cm; from just over the ground (what stands under a canopy is the stall's
    // too) to over what stands on a roof (a tank, a sign, an air unit: 8 m), or a metre over a small thing
    T.x0 = ax * COL - 0.02;
    T.z0 = az * COL - 0.02;
    T.x1 = (bx + 1) * COL + 0.02;
    T.z1 = (bz + 1) * COL + 0.02;
    T.y0 = 0.3;
    T.y1 = hiMax + (T.big && (!floating || T.area >= 30) ? 8 : 1);
    // a parked van or truck is a road object, whatever its size (the city's own list of what is parked where)
    if (T.big && hiMax < 4.5 && T.area < 30 && city.parkedIn?.(T.x0 + 0.5, T.z0 + 0.5, T.x1 - 0.5, T.z1 - 0.5)) T.big = false;
    // ONE BOX, ONE THING: a building is met at several heights (its roof, a floor, a ledge: each a patch of its own
    // with the same footprint), and a block that was rebuilt gives the same things again. They are the first one met.
    for (const O of known) {
      if (Math.abs(O.x0 - T.x0) + Math.abs(O.z0 - T.z0) + Math.abs(O.x1 - T.x1) + Math.abs(O.z1 - T.z1) > 1.5) continue;
      O.y1 = Math.max(O.y1, T.y1);
      O.big ||= T.big;
      T.same = O;
      return O;
    }
    known.push(T);
    if (known.length > 96) known.shift();
    return T;
  }

  // ── the lines ──────────────────────────────────────────────────────────────────────────────────────────────────
  // (one line, lens to a point of a body: every column it passes over, and in each the spans it passes through)
  const onLine = [];
  let unknown = false;
  function walk(L, x, y, z, floorY) {
    onLine.length = 0;
    unknown = false;
    const [dx, dy, dz] = [x - L.x, y - L.y, z - L.z];
    const len = Math.hypot(dx, dy, dz);
    if (!(len > SHORT + 0.1)) return;
    const tEnd = 1 - SHORT / len;
    let gx = Math.floor(L.x / COL);
    let gz = Math.floor(L.z / COL);
    const [sx, sz] = [dx > 0 ? 1 : -1, dz > 0 ? 1 : -1];
    const [stepX, stepZ] = [Math.abs(dx) > 1e-9 ? COL / Math.abs(dx) : Infinity, Math.abs(dz) > 1e-9 ? COL / Math.abs(dz) : Infinity];
    let tx = Math.abs(dx) > 1e-9 ? ((gx + (sx > 0 ? 1 : 0)) * COL - L.x) / dx : Infinity;
    let tz = Math.abs(dz) > 1e-9 ? ((gz + (sz > 0 ? 1 : 0)) * COL - L.z) / dz : Infinity;
    let t0 = 0;
    for (let guard = 0; guard < 4000; guard++) {
      const t1 = Math.min(tx, tz, tEnd);
      const ya = L.y + dy * t0;
      const yb = L.y + dy * t1;
      const lo = ya < yb ? ya : yb;
      const hi = ya < yb ? yb : ya;
      const i = Math.floor(gx / G);
      const j = Math.floor(gz / G);
      const e = entry(i, j);
      if (!e) {
        if (!eKnown && lo < 40) unknown = true;
      } else {
        const c = (gz - j * G) * G + (gx - i * G);
        if (e.top[c] > lo) {
          for (let k = e.off[c]; k < e.off[c + 1]; k += 2) {
            if (e.iv[k] >= hi) break;
            if (e.iv[k + 1] <= lo || e.iv[k + 1] < floorY || e.ivf[k >> 1] & 1) continue;
            // the thing this span is of; or, when that is nothing much and the column goes on up (a ledge, a sign's
            // letters, the wall between two windows: a tower taller than the lens is met through its side, never
            // through its roof), the thing its top is of
            let T = thingOf(e, c, k, gx, gz);
            if (!T.big) {
              let kt = e.off[c + 1] - 2;
              while (kt > k && e.ivf[kt >> 1] & 1) kt -= 2;
              if (kt > k) {
                const B = thingOf(e, c, kt, gx, gz);
                if (B.big) T = B;
              }
            }
            if (!onLine.includes(T)) onLine.push(T);
          }
        }
      }
      if (t1 >= tEnd) break;
      if (tx < tz) {
        gx += sx;
        tx += stepX;
      } else {
        gz += sz;
        tz += stepZ;
      }
      t0 = t1;
    }
  }

  // ── a frame ────────────────────────────────────────────────────────────────────────────────────────────────────
  const UP = [0.25, 0.6, 0.95, 1.3, 1.65];
  const stat = { ms: 0, max: 0, frames: 0, lines: 0, people: 0, cone: 0, coneFor: null };
  let clock = 0;
  let frame = 0;
  const people = [];
  const smooth = k => k * k * (3 - 2 * k);

  /** Who is watched: the Lock's person, whoever is in a scene with them, whoever stands beside them. */
  function watched() {
    people.length = 0;
    const lead = rig?.mode === 'lock' ? rig.lock?.subject : null;
    if (!lead?.p || lead.hide) return;
    people.push(lead);
    const A = actors.all().find(X => X.w === lead);
    const scene = A ? partners(A.id) : [];
    for (const X of actors.all()) {
      if (people.length >= PEOPLE) break;
      if (X.w === lead || X.w.hide || !X.w.tier) continue;
      const far = Math.hypot(X.w.p[0] - lead.p[0], X.w.p[2] - lead.p[2]);
      if (far <= BESIDE || (far <= 14 && scene.includes(X.id))) people.push(X.w);
    }
  }

  // (`by`: for the tools, whose body it hid last and on which line)
  let by = '';
  const dwell = new WeakMap();
  const want = T => {
    T.wanted = clock;
    T.by = by;
    things.add(T);
  };

  let enabled = true;
  function update(dt) {
    const t0 = performance.now();
    clock += dt;
    frame += 1;
    if (frame % 30 === 1) wrapAll();
    watched();
    let needCone = !enabled;
    if (W && people.length && enabled) {
      const L = city.camera.position;
      eI = NaN;
      for (let p = 0; p < people.length; p++) {
        const w = people[p];
        const [x, y, z] = w.p;
        const tall = (rig.people?.heightOf?.(w) ?? 1.75) / 1.75;
        // across the view, for the two lines either side of the chest
        const [vx, vz] = [x - L.x, z - L.z];
        const vl = Math.hypot(vx, vz) || 1;
        const [px, pz] = [(-vz / vl) * 0.4, (vx / vl) * 0.4];
        let hidden = 0;
        let lost = 0;
        let noBoxes = null;
        // (a table hides the legs of whoever stands behind it, three lines of five, and nobody would call them hidden)
        let chest = false;
        const small = [];
        for (let s = 0; s < 7; s++) {
          if (s < 5) walk(L, x, y + UP[s] * tall, z, y + FLOOR);
          else walk(L, x + (s === 5 ? px : -px), y + 1.2 * tall, z + (s === 5 ? pz : -pz), y + FLOOR);
          stat.lines += 1;
          by = `${w.aid ?? p}:${s}`;
          let other = false;
          let noBox = unknown;
          for (const T of onLine) {
            if (T.wire) continue;
            if (T.big) want(T);
            else if (T.box) other = true;
            else noBox = true;
            if (!T.big && T.box && s < 5 && !small.includes(T)) small.push(T);
            if (!T.big && !T.box && s < 5) noBoxes = T;
          }
          if (s < 5 && (other || noBox)) hidden += 1;
          if (s < 5 && noBox) lost += 1;
          if (s === 3) chest = other || noBox;
        }
        // mostly hidden by what stays solid, and for longer than it takes to walk behind a signal's box: the small
        // things fade too; by what has no box: the city's cone
        let D = dwell.get(w);
        if (!D) dwell.set(w, D = { since: 0, last: -9 });
        if (hidden >= MOSTLY * 5 && chest) {
          if (D.last !== frame - 1) D.since = clock;
          D.last = frame;
          if (clock - D.since >= DWELL) {
            for (const T of small) want(T);
            if (p === 0 && lost >= MOSTLY * 5) {
              needCone = true;
              stat.coneFor = noBoxes ? `a thing that is no box: ${noBoxes.area.toFixed(1)} m², top ${noBoxes.top.toFixed(1)} m, in ${[noBoxes.x0, noBoxes.z0, noBoxes.x1, noBoxes.z1].map(v => v.toFixed(1)).join(' ')}` : 'a block with no columns yet';
            }
          }
        }
      }
    }
    // the cone's gate
    if (needCone) cone.since = clock;
    cone.want = clock - cone.since < HOLD ? 1 : 0;
    cone.k = cone.want ? Math.min(1, cone.k + dt / EASE_IN) : Math.max(0, cone.k - dt / EASE_OUT);
    if (cone.k > 0) stat.cone += 1;
    // the fades, eased; and the uniforms
    for (const T of things) {
      const on = clock - T.wanted < HOLD;
      T.k = on ? Math.min(1, T.k + dt / EASE_IN) : Math.max(0, T.k - dt / EASE_OUT);
      if (!on && T.k <= 0) things.delete(T);
    }
    let n = 0;
    for (const T of things) {
      if (n >= SLOTS) break;
      if (!(T.k > 0)) continue;
      U.uStA.value[n].set(T.x0, T.z0, T.x1, T.z1);
      U.uStB.value[n].set(T.y0, T.y1, 1 - (1 - LEFT) * smooth(T.k), 0);
      n += 1;
    }
    U.uStN.value = n;
    const ms = performance.now() - t0;
    stat.ms += ms;
    stat.frames += 1;
    stat.people = people.length;
    if (ms > stat.max) stat.max = ms;
  }
  // after the rig's late step (the Lock's pose is made there, from this frame's walkers) and before the draw
  const late0 = city.late;
  city.late = dt => {
    late0?.(dt);
    try {
      update(dt);
    } catch (err) {
      console.warn('[stage] see-through:', err);
      U.uStN.value = 0;
    }
  };

  return {
    /** For the tools: what is fading, who is watched, the cone, and what a frame of this costs. */
    debug() {
      const round = v => +v.toFixed(2);
      return {
        fading: [...things].filter(T => T.k > 0).map(T => ({ id: T.id, box: [T.x0, T.z0, T.x1, T.z1].map(round), y: [round(T.y0), round(T.y1)], area: round(T.area), top: round(T.top), big: T.big, crown: T.crown, k: round(T.k), by: T.by })),
        slots: U.uStN.value, people: stat.people, cone: round(cone.k), materials: programs,
        ms: stat.frames ? +(stat.ms / stat.frames).toFixed(4) : 0, max: round(stat.max), frames: stat.frames, lines: stat.lines, coneFrames: stat.cone, coneFor: stat.coneFor,
      };
    },
    /** For the tools: every thing on the line from the lens to a point, whether it would fade or not. */
    probe(x, y, z, from = city.camera.position) {
      eI = NaN;
      walk(from, x, y, z, FLOOR);
      return { unknown, things: onLine.map(T => ({ id: T.id, box: [T.x0, T.z0, T.x1, T.z1], y: [T.y0, T.y1], area: T.area, top: T.top, big: T.big, isBox: T.box, wire: T.wire, crown: T.crown })) };
    },
    /** For the tools' before-and-after pictures: off, nothing fades and the city's cone is as the game had it. */
    set on(v) {
      enabled = !!v;
      if (rig?.config?.lock?.hole) Object.assign(rig.config.lock.hole, enabled ? { lens: CONE.lens, at: CONE.at, edge: CONE.edge } : { lens: 1.5, at: 4, edge: 1 });
    },
    left: LEFT,
  };
}
