// THE PHONE SET-UP (phone-1), shared by demo/tools/phone-probe.mjs and phone-day.mjs: headless Chrome made to look
// like a phone before the page is opened, and a DevTools socket that hears every event (chrome.mjs's own open()
// navigates at once, before any set-up could be made).
//   PHONE    390 x 844 CSS pixels at a pixel ratio of 3 (an iPhone 14 / 15), touch on (five points), an iPhone Safari
//            user agent, the processor slowed 4x, the network at Chrome DevTools' "Fast 4G" figures
//   DESKTOP  the 1600 x 1000 window the other tools use, ratio 1, nothing slowed
// It is Chrome dressed as a phone, NOT iOS Safari: this Mac's graphics chip, Chrome's WebGL and memory limits.
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export const PHONE = {
  width: 390, height: 844, ratio: 3, cpu: 4,
  ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  // Chrome DevTools' "Fast 4G": 9 Mbit/s down, 1.5 Mbit/s up, 165 ms round trip
  net: { offline: false, latency: 165, downloadThroughput: (9e6 / 8), uploadThroughput: (1.5e6 / 8) },
};
export const DESKTOP = { width: 1600, height: 1000, ratio: 1, cpu: 1, ua: null, net: null };

/** Puts a page into the phone (or desktop) set-up. Must run before the page is navigated. */
export async function emulate(send, D) {
  await send('Emulation.setDeviceMetricsOverride', { width: D.width, height: D.height, deviceScaleFactor: D.ratio, mobile: D === PHONE, ...(D === PHONE ? { screenOrientation: { type: 'portraitPrimary', angle: 0 } } : {}) });
  if (D === PHONE) {
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Emulation.setUserAgentOverride', { userAgent: D.ua, platform: 'iPhone' });
  }
  if (D.cpu > 1) await send('Emulation.setCPUThrottlingRate', { rate: D.cpu });
  if (D.net) await send('Network.emulateNetworkConditions', D.net);
}

// what runs in the page before anything of its own: the time the veil lifted
const INJECT = `(() => {
  if (window.__probe) return;
  const P = window.__probe = { marks: {} };
  const poll = setInterval(() => {
    if (!P.marks.up && document.body && document.body.classList.contains('up')) { P.marks.up = performance.now(); clearInterval(poll); }
  }, 20);
})()`;

/**
 * Our own DevTools socket on the tab chrome.mjs started with (so the set-up comes before the first navigation), or
 * on the tab `targetId` (a tab opened since: phone-day.mjs's fight page).
 */
export async function connect(debugPort, targetId = null) {
  const base = `http://127.0.0.1:${debugPort}`;
  const target = (await fetch(`${base}/json/list`).then(r => r.json())).find(t => t.type === 'page' && (!targetId || t.id === targetId));
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('no DevTools socket')); });
  let nextId = 0;
  const waiting = new Map();
  const handlers = new Map();
  const errors = [];
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(`[exception] ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`.slice(0, 400));
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(`[error] ${msg.params.args.map(a => a.value ?? a.description ?? '').join(' ')}`.slice(0, 400));
    for (const fn of handlers.get(msg.method) ?? []) fn(msg.params);
  };
  ws.onclose = () => { for (const { reject } of waiting.values()) reject(new Error('the DevTools socket closed')); waiting.clear(); };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const on = (method, fn) => { if (!handlers.has(method)) handlers.set(method, []); handlers.get(method).push(fn); };
  const off = method => handlers.delete(method);
  async function evaluate(expression, timeout = 120000) {
    let timer = null;
    const late = new Promise((_, no) => { timer = setTimeout(() => no(new Error(`timed out: ${expression.slice(0, 80)}`)), timeout); });
    const r = await Promise.race([send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }), late]).finally(() => clearTimeout(timer));
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }
  async function waitFor(expression, timeout = 300000, every = 200) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (await evaluate(`!!(${expression})`, 30000).catch(() => false)) return (Date.now() - t0) / 1000;
      await sleep(every);
    }
    throw new Error(`timed out waiting for ${expression}`);
  }
  async function shot(file) {
    const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT });
  return { id: target.id, send, on, off, evaluate, waitFor, shot, errors, close: () => ws.close() };
}


/**
 * THE SERVICE WORKER'S OWN TRAFFIC. A page's service worker fetches from the network in its own target: the page's
 * DevTools session sees the page's requests answered "from the service worker" and never the worker's requests behind
 * them. This socket on the browser attaches to every service worker as it starts (held at its first line until the
 * set-up is made), gives it the same network as the page (`net`: the phone's 4G, or none) and hands each of its
 * Network events to `on(method, params)`. Returns { close }.
 */
export async function watchWorkers(debugPort, { net = null, on }) {
  const { webSocketDebuggerUrl } = await fetch(`http://127.0.0.1:${debugPort}/json/version`).then(r => r.json());
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('no browser socket')); });
  let nextId = 0;
  const send = (method, params = {}, sessionId = undefined) => ws.send(JSON.stringify({ id: ++nextId, method, params, ...(sessionId ? { sessionId } : {}) }));
  const workers = new Set();
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Target.attachedToTarget') {
      const { sessionId, targetInfo } = msg.params;
      if (targetInfo.type === 'service_worker') {
        workers.add(sessionId);
        send('Network.enable', {}, sessionId);
        if (net) send('Network.emulateNetworkConditions', net, sessionId);
      }
      send('Runtime.runIfWaitingForDebugger', {}, sessionId);
      return;
    }
    if (msg.sessionId && workers.has(msg.sessionId) && msg.method?.startsWith('Network.')) on(msg.method, msg.params);
  };
  send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  return { close: () => ws.close() };
}
