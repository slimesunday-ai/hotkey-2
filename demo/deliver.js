// HOW THE PAGE REACHES A PHONE AGAIN (phone-1, docs/phone.md): the service worker (sw.js at the root of what is served)
// keeps every file the player has used, so a second visit asks the network for next to nothing and the game plays
// offline once played.
//
//   ON A REAL HOST (https, not this machine): on, always. ?sw=0 takes it away (for a test).
//   ON THIS MACHINE (127.0.0.1, localhost): off, so an edited file shows at once, as it always has; ?sw=1 turns it on
//   for a measure (demo/tools/phone-probe.mjs --query sw=1). A worker left from such a test is taken away the next
//   time the page is opened without ?sw=1, and the page is loaded again once, clean.
//   A NEW VERSION: the browser looks for a new sw-files.js every time the page is opened; when there is one it is
//   installed beside the old and waits, and the player goes on with the old version, whole. The next opening finds it
//   waiting: it takes over and the page reloads once, all new (sw.js says how).

const Q = new URLSearchParams(location.search);
const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
const ROOT = new URL('../', import.meta.url);
export const WANTED = 'serviceWorker' in navigator && Q.get('sw') !== '0' && (Q.get('sw') === '1' || (!LOCAL && location.protocol === 'https:'));

/**
 * At the very start of boot, before anything else is loaded: a version waiting from an earlier visit takes over (the
 * page reloads once), or a worker that should not be here goes (the page reloads once). Resolves false when the page
 * is about to reload (boot stops there), true otherwise.
 */
export async function settle() {
  if (!('serviceWorker' in navigator)) return true;
  let reg = null;
  try {
    reg = await navigator.serviceWorker.getRegistration(ROOT.href);
  } catch {
    return true;
  }
  if (!reg) return true;
  if (!WANTED) {
    await reg.unregister().catch(() => {});
    if (navigator.serviceWorker.controller) {
      location.reload();
      return false;
    }
    return true;
  }
  if (reg.waiting && navigator.serviceWorker.controller) {
    const swapped = new Promise(resolve => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(true), { once: true });
      setTimeout(() => resolve(false), 4000);
    });
    reg.waiting.postMessage('skip');
    if (await swapped) {
      location.reload();
      return false;
    }
  }
  return true;
}

/** Registers the worker (when it is wanted); call early, it fetches nothing of the game itself. */
export function register() {
  if (!WANTED) return null;
  return navigator.serviceWorker.register(new URL('sw.js', ROOT).href, { scope: ROOT.pathname, updateViaCache: 'none' }).catch(err => {
    console.warn('[deliver] no service worker:', err?.message ?? err);
    return null;
  });
}

/**
 * Once the panels are up: the worker is told every file the page loaded before it was in charge, and keeps them (the
 * first visit's files, so the second asks for none of them).
 */
export async function handOver() {
  if (!WANTED) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const urls = [location.href, ...performance.getEntriesByType('resource').map(e => e.name)].filter(u => u.startsWith(ROOT.href));
    reg.active?.postMessage({ take: [...new Set(urls)] });
  } catch {}
}
