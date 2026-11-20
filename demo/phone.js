// THE PAGE ON A PHONE (phone-1, docs/phone.md): what demo/boot.js does differently on a phone-sized touch screen, and
// the readout ?stats=1. A desktop gets none of it: every change here waits on `phone` (or on ?stats=1).
//
//   ON A PHONE (a touch screen as its main pointer whose short side is at most 500 CSS pixels; ?phone=1 forces it,
//   ?phone=0 never), with no ?q= in the address:
//     · the city's LOW preset (?q=low, read by the city from the address: city/from-trunk/style/city/quality.js):
//       pixel ratio 1 at most (its dynamic resolution may drop to 0.6 of it), a 1024 shadow, 3 blocks of full detail
//     · at most 60 frames a second (?fps=N sets it, ?fps=0 lifts it): a phone with a 90 or 120 Hz screen draws no
//       more than a 60 Hz one. Under 55 the city's dynamic resolution is held where it is: without a GPU timer
//       (Safari has none) it judges a frame by its interval against 60 a second, and would read every frame of a
//       lower cap as overloaded and drop the picture to its floor
//     · the page itself does not zoom, scroll, bounce, select or call up the press-and-hold menu under a finger;
//       turning the phone re-fits the picture
//   ?stats=1 (any device): a small readout, low on the left, for a screenshot.
//
// Why these and not others: docs/phone.md (the measure: demo/tools/phone-probe.mjs).

const Q = new URLSearchParams(location.search);

/** Whether this is a phone: a touch screen as the main pointer, short side at most 500 CSS px. */
export function isPhone() {
  if (Q.get('phone') === '1') return true;
  if (Q.get('phone') === '0') return false;
  const coarse = matchMedia('(pointer: coarse)').matches;
  return coarse && Math.min(screen.width, screen.height) <= 500;
}

export const PHONE = isPhone();
/** The cap on frames a second: 60 on a phone unless ?fps= says otherwise; none on a desktop unless ?fps= says. */
export const FPS = Q.has('fps') ? Math.max(0, Number(Q.get('fps')) || 0) : PHONE ? 60 : 0;

/**
 * Before the city starts: the address the city reads (its preset) and the page's own handling of a finger.
 * `Qb` is boot.js's own copy of the address, written back with history.replaceState by boot.js.
 */
export function beforeCity(Qb) {
  if (PHONE && !Qb.has('q')) Qb.set('q', 'low');
  if (FPS) capFrames(FPS);
  if (PHONE) fingers();
}

/**
 * After the city is up: hold its dynamic resolution under a cap below 55 (see the head of this file).
 */
export function afterCity(city) {
  if (FPS && FPS < 55) city.dyn?.setEnabled(false);
}

/**
 * At most `fps` animation frames a second for the whole page: every callback asked for runs together on the first
 * display frame at least 1000 / fps ms (less 4 ms of slack) after the last one, with that frame's time, as the
 * browser's own would. The city draws from three.js's loop, which asks window.requestAnimationFrame for every frame.
 */
export function capFrames(fps) {
  const raf0 = window.requestAnimationFrame.bind(window);
  const gap = 1000 / fps - 4;
  let queue = new Map();
  let next = 0;
  let pending = 0;
  let last = -1e9;
  const tick = t => {
    pending = 0;
    if (t - last < gap) {
      pending = raf0(tick);
      return;
    }
    last = t;
    const due = queue;
    queue = new Map();
    for (const cb of due.values()) {
      try {
        cb(t);
      } catch (err) {
        (window.reportError ?? (e => setTimeout(() => { throw e; })))(err);
      }
    }
  };
  window.requestAnimationFrame = cb => {
    const id = ++next;
    queue.set(id, cb);
    if (!pending) pending = raf0(tick);
    return id;
  };
  window.cancelAnimationFrame = id => {
    queue.delete(id);
  };
}

/** The page under a finger: no zoom, no scroll or bounce, no selection; turning the phone re-fits the picture. */
function fingers() {
  document.documentElement.classList.add('touch');
  // Safari's pinch on the page (outside the canvas, which takes its own touches) is a gesture event: refused
  for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, e => e.preventDefault(), { passive: false });
  // a second tap within the double-tap time would zoom in an older Safari even with touch-action: refused on what is
  // not a field to type in
  let lastTap = 0;
  document.addEventListener('touchend', e => {
    const now = performance.now();
    if (now - lastTap < 300 && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName ?? '') && e.cancelable) e.preventDefault();
    lastTap = now;
  }, { passive: false });
  // TURNING THE PHONE: the city re-fits on `resize`; on iOS the new size is sometimes not there yet when the event
  // comes, so it is said again a little later, and on the visual viewport's own resize
  const again = () => setTimeout(() => dispatchEvent(new Event('resize')), 350);
  addEventListener('orientationchange', again);
  screen.orientation?.addEventListener?.('change', again);
}

/** ?stats=1: the readout. `demo` is window.__demo (its city, its stage). */
export function mountStats(demo) {
  const el = document.createElement('div');
  el.id = 'hk-stats';
  el.style.cssText = 'position:fixed;left:calc(4px + env(safe-area-inset-left));top:34%;z-index:40;pointer-events:none;background:rgba(10,10,12,.82);color:#e8ffe8;'
    + 'font:600 10px/1.35 ui-monospace,Menlo,monospace;padding:4px 6px;white-space:pre;border-radius:3px;max-width:60vw';
  document.body.appendChild(el);
  const city = demo.city;
  let lost = 0;
  city.renderer.domElement.addEventListener('webglcontextlost', () => lost++);
  // frames: the page's own animation frames, which the city draws on (it draws one each, unless the subway's
  // carriage covers it); the slowest of the last ten seconds
  const times = [];
  let fps = 0;
  const loop = t => {
    times.push(t);
    while (times.length && t - times[0] > 10000) times.shift();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  const paint = () => {
    const now = performance.now();
    let slow = 0;
    let n1 = 0;
    for (let k = 1; k < times.length; k++) {
      slow = Math.max(slow, times[k] - times[k - 1]);
      if (now - times[k] <= 1000) n1++;
    }
    fps = n1;
    let blocks = '';
    let people = '';
    try {
      const c = city.stream.counts();
      blocks = `${c.full} near ${c.mid} mid ${c.far} far`;
    } catch {}
    try {
      people = String(city.peds?.stats?.().visible ?? '?');
    } catch {}
    const ours = (() => { try { return demo.stage?.debug?.().people ?? null; } catch { return null; } })();
    const mem = performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1e6)} MB JS` : 'n/a (iOS: none)';
    const up = Math.round(now / 1000);
    const I = city.renderer.info.render;
    el.textContent = [
      `${fps} fps · slowest ${Math.round(slow)} ms (10 s)`,
      `${city.PR?.name ?? '?'}${FPS ? ` · cap ${FPS}` : ''} · ratio ${city.renderer.getPixelRatio().toFixed(2)} (device ${devicePixelRatio})`,
      `${innerWidth}×${innerHeight} · up ${Math.floor(up / 60)}m${String(up % 60).padStart(2, '0')}s${lost ? ` · GL LOST ${lost}` : ''}`,
      `blocks ${blocks}`,
      `walkers drawn ${people}${ours != null ? ` · ours ${ours}` : ''} · ${I.calls} calls`,
      `memory ${mem}`,
    ].join('\n');
  };
  setInterval(paint, 1000);
  paint();
  return el;
}
