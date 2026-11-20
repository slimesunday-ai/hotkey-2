// A small headless-Chrome driver for the demo's screenshots and measurements. Zero dependencies: Chrome's own
// DevTools protocol over Node 22's built-in WebSocket.
//
// The method is the one trunk's screenshot tools use (WebGL through Metal in a headless window), rewritten here so
// nothing runs inside trunk. One browser at a time: this machine also runs a large local model. The browser gets its
// own throwaway profile and is stopped by its own process id, never by name, so the owner's Chrome is never touched.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Starts one headless Chrome. `debugPort` must be one of ours (5470 to 5479); HK2_DEBUG_PORT sets it for a whole
 * run, so two people's tools can run side by side.
 * Returns { pid, open(url), close() }.
 */
export async function launch({ debugPort = Number(process.env.HK2_DEBUG_PORT) || 5479, width = 1600, height = 1000, flags = null } = {}) {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'hotkey2-chrome-'));
  const child = spawn(CHROME, [
    // (HK2_WINDOW=1: a real window on its own throwaway profile, to time frames as a screen shows them)
    ...(process.env.HK2_WINDOW === '1' ? [] : ['--headless=new']),
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--use-angle=metal',
    '--ignore-gpu-blocklist',
    '--hide-scrollbars',
    '--mute-audio',
    // a page nobody can see must keep drawing: when the Mac's display sleeps the page goes hidden, its frames stop
    // and a season freezes mid-hour with no error (seen 2026-11-11, a watch season stuck at hour 26)
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-background-timer-throttling',
    '--disable-features=CalculateNativeWinOcclusion',
    ...(flags ?? []),
    `--window-size=${width},${height}`,
    'about:blank',
  ], { stdio: 'ignore' });

  const base = `http://127.0.0.1:${debugPort}`;
  let up = false;
  for (let k = 0; k < 100 && !up; k++) {
    await sleep(100);
    up = await fetch(`${base}/json/version`).then(r => r.ok, () => false);
  }
  if (!up) {
    child.kill();
    throw new Error('chrome: the browser did not start');
  }

  async function open(url) {
    // the tab Chrome opened with: a second tab would sit behind it, where screenshots never come back
    const targets = await fetch(`${base}/json/list`).then(r => r.json());
    const target = targets.find(t => t.type === 'page');
    if (!target) throw new Error('chrome: no tab to use');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('chrome: no DevTools socket'));
    });
    let nextId = 0;
    const waiting = new Map();
    const logs = [];
    const failed = [];
    ws.onmessage = event => {
      const msg = JSON.parse(event.data);
      if (msg.id && waiting.has(msg.id)) {
        const { resolve, reject } = waiting.get(msg.id);
        waiting.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
        return;
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value ?? a.description ?? '').join(' ');
        logs.push(`[${msg.params.type}] ${text}`);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        logs.push(`[exception] ${d.exception?.description ?? d.text}`);
      } else if (msg.method === 'Network.responseReceived') {
        const r = msg.params.response;
        if (r.status >= 400) failed.push(`${r.status} ${r.url}`);
      } else if (msg.method === 'Network.loadingFailed' && !msg.params.canceled) {
        failed.push(`failed ${msg.params.errorText}`);
      }
    };
    // a dropped socket fails whatever was waiting, so a caller sees an error instead of hanging
    ws.onclose = event => {
      for (const { reject } of waiting.values()) reject(new Error(`chrome: the DevTools socket closed (${event.code} ${event.reason})`));
      waiting.clear();
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      waiting.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url });

    /** Runs an expression in the page (it may be async) and returns its JSON value. Throws after `timeout` ms. */
    async function evaluate(expression, timeout = 120000) {
      // (anim-1: the timeout's own timer is taken down when the answer comes. Left pending, the last one kept every
      // tool alive for up to two minutes after it had printed its result: a chain of checks waited that long on each)
      let timer = null;
      const late = new Promise((_, no) => {
        timer = setTimeout(() => no(new Error(`chrome: timed out running ${expression.slice(0, 80)}`)), timeout);
      });
      const r = await Promise.race([send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }), late]).finally(() => clearTimeout(timer));
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    }

    /** Waits until an expression is truthy. Returns the seconds it took, or throws after `timeout` ms. */
    async function waitFor(expression, timeout = 90000, every = 250) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        // only the truth of it crosses over: a page object returned whole can be too big to send
        const ok = await evaluate(`!!(${expression})`).catch(() => false);
        if (ok) return (Date.now() - t0) / 1000;
        await sleep(every);
      }
      throw new Error(`chrome: timed out after ${timeout} ms waiting for ${expression}`);
    }

    /**
     * Saves what the page shows: the WebGL canvas and the page's own elements over it. A `.jpg` name saves a JPEG,
     * anything else a PNG. Throws instead of hanging when Chrome never answers.
     */
    async function shot(file, timeout = 20000) {
      const format = /\.jpe?g$/i.test(file) ? { format: 'jpeg', quality: 92 } : { format: 'png' };
      let timer = null;
      const late = new Promise((_, no) => {
        timer = setTimeout(() => no(new Error('chrome: the screenshot never came back')), timeout);
      });
      const r = await Promise.race([send('Page.captureScreenshot', format), late]).finally(() => clearTimeout(timer));
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    }

    return { evaluate, waitFor, shot, send, logs, failed, sleep, close: () => ws.close() };
  }

  async function close() {
    child.kill('SIGTERM');
    await sleep(400);
    if (child.exitCode === null) child.kill('SIGKILL');
    await sleep(200);
    rmSync(profile, { recursive: true, force: true });
  }

  return { pid: child.pid, open, close };
}
