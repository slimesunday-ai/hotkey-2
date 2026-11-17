// THE PICTURE'S FRAME, AS PLAIN MATH (no browser): whether a body standing somewhere is in the game camera's picture,
// and the check that nobody comes on or goes off inside it. The page feeds it the real camera every frame
// (watch.js); the tests and the entrances' planning (ways.js) feed it the Lock as camera.js stands it.
//
//   lockView([x, y, z])          the Lock on a person standing there (camera.js: 24 m up, 64° down, from the east,
//                                a 42° lens), at the picture's shape of 1280 by 800
//   viewOf(cam)                  the same from a camera's own numbers (its world matrix, lens and shape)
//   inView(view, [x, y, z], r)   a ball of radius r there touches the picture
//   bodyIn(view, x, y, z)        a standing body there (its ball, feet to head) touches the picture
//   createFrameCheck()           the check, frame by frame: who came on, went off or was moved at once in the picture
//
// The picture is 1280 by 800 (aspect 1.6) whatever the window: the owner's frame. The camera's lens is vertical, so a
// wider window shows more at the sides; the check keeps to the 1280 by 800 frame, and the page draws it there.

/** The Lock (demo/stage/camera.js HIGH, DOWN, BEARING, LENS; its pivot is anchorH 0.82 of a body's height up). */
export const LOCK = Object.freeze({ high: 24, down: 64, bearing: 90, lens: 42, anchor: 0.82 * 1.75 });
/** The owner's picture: 1280 by 800. */
export const ASPECT = 1280 / 800;
/** A standing body as the check sees it: a ball from the feet to over the head. */
export const BODY_BALL = Object.freeze({ up: 0.95, r: 1.0 });

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => {
  const n = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** A view: where the camera stands, its axes (fwd into the picture, right, up), the lens's half-tangents. */
function view(eye, fwd, up0, fovDeg, aspect) {
  const f = norm(fwd);
  const right = norm(cross(f, up0));
  const up = cross(right, f);
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  return { eye, fwd: f, right, up, tanV, tanH: tanV * aspect, near: 0.1 };
}

/** The Lock on a person standing at p (feet), as camera.js stands it. */
export function lockView(p, { high = LOCK.high, down = LOCK.down, bearing = LOCK.bearing, lens = LOCK.lens, anchor = LOCK.anchor, aspect = ASPECT } = {}) {
  const az = (bearing * Math.PI) / 180;
  const el = (down * Math.PI) / 180;
  const d = high / Math.sin(el);
  const pivot = [p[0], p[1] + anchor, p[2]];
  const eye = [pivot[0] + Math.sin(az) * Math.cos(el) * d, pivot[1] + Math.sin(el) * d, pivot[2] + Math.cos(az) * Math.cos(el) * d];
  return view(eye, sub(pivot, eye), [0, 1, 0], lens, aspect);
}

/**
 * A view from a camera's own numbers: `m` its world matrix (16 numbers, column-major, three.js's `elements`), `fov`
 * its vertical lens in degrees. The picture's shape is the owner's (1280 by 800), not the window's.
 */
export function viewOf({ m, fov }, aspect = ASPECT) {
  const eye = [m[12], m[13], m[14]];
  // (a camera looks down its own −z; its +y is up)
  return view(eye, [-m[8], -m[9], -m[10]], [m[4], m[5], m[6]], fov, aspect);
}

/** Does a ball of radius r at p touch the picture? */
export function inView(v, p, r = 0) {
  const d = sub(p, v.eye);
  const z = dot(d, v.fwd);
  if (z < v.near - r) return false;
  const x = dot(d, v.right);
  const y = dot(d, v.up);
  // (the distance to each side plane of the lens: |x| − z tan, over the plane's slope)
  if (Math.abs(x) - z * v.tanH > r * Math.hypot(1, v.tanH)) return false;
  if (Math.abs(y) - z * v.tanV > r * Math.hypot(1, v.tanV)) return false;
  return true;
}

/** Does a standing body with its feet at (x, y, z) touch the picture? */
export const bodyIn = (v, x, y, z) => inView(v, [x, y + BODY_BALL.up, z], BODY_BALL.r);

/** The picture's four corners on the ground (the plane at height y): [[x, z] × 4], or null where a corner looks above it. */
export function footprint(v, y = 0) {
  const out = [];
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const d = [0, 1, 2].map(k => v.fwd[k] + v.right[k] * sx * v.tanH + v.up[k] * sy * v.tanV);
    if (d[1] >= -1e-6) return null;
    const t = (y - v.eye[1]) / d[1];
    out.push([v.eye[0] + d[0] * t, v.eye[2] + d[2] * t]);
  }
  return out;
}

/**
 * THE QUIET ZONE: a box [x0, z0, x1, z1] holding every picture the Lock can show while the player is anywhere in
 * `area` (world [x, z] points: the arena's corners), with `pad` m round it. Nobody inside it is put on or taken off
 * while the picture can see them, and nobody outside it can be in a picture of the fight.
 */
export function quietBox(area, y = 0, pad = 3, o = {}) {
  let [x0, z0, x1, z1] = [Infinity, Infinity, -Infinity, -Infinity];
  const xs = area.map(p => p[0]);
  const zs = area.map(p => p[1]);
  // (the player anywhere inside: the corners and the middles of the sides are enough for a box of pictures)
  const pts = [];
  for (const fx of [0, 0.5, 1]) for (const fz of [0, 0.5, 1]) pts.push([Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) * fx, Math.min(...zs) + (Math.max(...zs) - Math.min(...zs)) * fz]);
  for (const [px, pz] of pts) {
    for (const [gx, gz] of footprint(lockView([px, y, pz], o), y) ?? []) {
      [x0, z0, x1, z1] = [Math.min(x0, gx), Math.min(z0, gz), Math.max(x1, gx), Math.max(z1, gz)];
    }
  }
  return [x0 - pad, z0 - pad, x1 + pad, z1 + pad];
}

/**
 * THE CHECK, frame by frame. `step(bodies, v, { cut, hidden })`: `bodies` is everyone on the street this frame, as
 * [{ id, on, x, y, z }] (on: drawn); whoever was there last frame and is missing now was taken off the stage. It
 * returns this frame's faults: { id, what: 'came on' | 'went off' | 'was moved at once', at: [x, z] }, and keeps
 * them all in `faults`. Not counted: a frame the whole picture is cut (black, or the camera put somewhere else at
 * once: `cut`), and a body `hidden(x, y, z)` says nobody can see (behind something, under the street); those are
 * kept apart in `hiddenOnes`, so the check says what it let by.
 */
export function createFrameCheck({ jump = 0.9 } = {}) {
  let last = new Map();
  const faults = [];
  const hiddenOnes = [];
  let frames = 0;
  let seen = 0;
  function step(bodies, v, { cut = false, hidden = null, dt = 1 / 60, t = null } = {}) {
    frames += 1;
    const now = new Map();
    const out = [];
    const note = (B, what, x, y, z, d = null) => {
      const f = { id: B.id, what, at: [+x.toFixed(1), +z.toFixed(1)], t };
      // (how far it went in the one picture, for whoever reads the fault)
      if (d !== null) f.d = +d.toFixed(2);
      if (hidden?.(x, y, z)) hiddenOnes.push(f);
      else out.push(f);
    };
    // (the first frame watched is what there is: nobody came on at the moment the check began)
    const first = frames === 1;
    for (const B of bodies) {
      now.set(B.id, B);
      const L = last.get(B.id);
      if (cut || first) continue;
      const inNow = bodyIn(v, B.x, B.y, B.z);
      if (B.on && inNow) seen += 1;
      if (!L) {
        if (B.on && inNow) note(B, 'came on', B.x, B.y, B.z);
        continue;
      }
      if (B.on && !L.on && inNow) note(B, 'came on', B.x, B.y, B.z);
      else if (!B.on && L.on && bodyIn(v, L.x, L.y, L.z)) note(B, 'went off', L.x, L.y, L.z);
      else if (B.on && L.on && Math.hypot(B.x - L.x, B.z - L.z) > Math.max(jump, 8 * dt) && (inNow || bodyIn(v, L.x, L.y, L.z))) note(B, 'was moved at once', B.x, B.y, B.z, Math.hypot(B.x - L.x, B.z - L.z));
    }
    if (!cut && !first) for (const [id, L] of last) if (!now.has(id) && L.on && bodyIn(v, L.x, L.y, L.z)) note(L, 'went off', L.x, L.y, L.z);
    last = now;
    faults.push(...out);
    return out;
  }
  return {
    step,
    faults,
    hiddenOnes,
    get frames() {
      return frames;
    },
    /** Body-frames seen in the picture (a check that watched nothing would pass on nothing). */
    get seen() {
      return seen;
    },
    reset() {
      last = new Map();
    },
  };
}
