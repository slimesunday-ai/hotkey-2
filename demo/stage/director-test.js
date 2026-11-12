// A whole season on auto over the REAL stage, for /demo/?stagetest=watch|play (demo/tools/stage-run.mjs reads it).
//
// The panels are driven through their own pilot hooks, the way their dev page's selftest does it: the night sheet is
// clicked through, and in play the seat's own bot answers every hour ("play on auto"). Nothing is skipped: every hour
// plays at the speed asked for (?speed=1|2|4, default 1), so the wall-clock length is the real one.
//
// When the season is over the title becomes `stage-ok` or `stage-fail: <why>`, and window.__stagetest holds the
// numbers: hours, seconds of wall clock, frames a second (mean, and the worst second), the longest hour, errors.

export function runStageTest({ demo, mountHud, host, mode }) {
  const { stage, Q } = demo;
  const errors = [];
  addEventListener('error', e => errors.push(e.message || String(e)));
  addEventListener('unhandledrejection', e => errors.push(String(e.reason?.stack ?? e.reason)));
  for (const level of ['error', 'warn']) {
    const real = console[level];
    console[level] = (...args) => {
      // the panels warn when the stage drops an hour: that is a failure of ours, so it counts
      const text = args.map(a => a?.stack ?? String(a)).join(' ');
      if (level === 'error' || /\[stage\]|\[hud\] the stage/.test(text)) errors.push(text);
      real(...args);
    };
  }

  // frames a second, counted by the second for the whole run
  const fps = [];
  let frames = 0;
  let second = performance.now();
  const count = now => {
    frames += 1;
    if (now - second >= 1000) {
      fps.push((frames * 1000) / (now - second));
      frames = 0;
      second = now;
    }
    requestAnimationFrame(count);
  };
  requestAnimationFrame(count);

  const seen = { mode, hours: 0, sheets: 0, moves: 0, longestHour: 0, hourSeconds: [] };
  const started = performance.now();
  let hourAt = started;
  let done = false;
  const finish = why => {
    if (done) return;
    done = true;
    const mean = fps.length ? fps.reduce((a, b) => a + b, 0) / fps.length : 0;
    const sorted = seen.hourSeconds.slice().sort((a, b) => a - b);
    window.__stagetest = {
      ...seen, hourSeconds: undefined, ok: !why, why: why ?? null, seconds: +((performance.now() - started) / 1000).toFixed(1),
      fpsMean: +mean.toFixed(1), fpsWorst: +(fps.length ? Math.min(...fps) : 0).toFixed(1),
      hourMedian: +(sorted[Math.floor(sorted.length / 2)] ?? 0).toFixed(1), longestHour: +seen.longestHour.toFixed(1),
      errors: errors.slice(0, 8), stage: stage.debug(),
    };
    document.title = why ? `stage-fail: ${why}` : 'stage-ok';
  };
  // generous: a season at 1× is about twelve minutes
  setTimeout(() => finish(`timed out after ${seen.hours} hours`), Number(Q.get('limit') || 1500) * 1000);

  const click = (root, selector) => {
    const node = root.querySelector(selector);
    if (node) node.click();
    return !!node;
  };
  const pilot = {
    instant: false,
    sheet(p, api) {
      seen.sheets += 1;
      for (let i = 0; i < p.sheet.points; i++) click(api.root, '.hk-skill:not([disabled])');
      if (!click(api.root, '[data-act="day"]')) finish('the night screen has no way on');
      return undefined;
    },
    move() {
      seen.moves += 1;
      return 'auto';
    },
  };

  const hud = mountHud(host, {
    stage, mode, seat: Q.get('seat') ?? 'dealer', seed: Number(Q.get('seed')) || 4, storage: false, pilot,
    speed: [1, 2, 4].includes(Number(Q.get('speed'))) ? Number(Q.get('speed')) : 1,
    onError: err => finish(err?.message ?? String(err)),
    onLine(line) {
      if (line.type !== 'hour') return;
      const now = performance.now();
      if (seen.hours) {
        const s = (now - hourAt) / 1000;
        seen.hourSeconds.push(s);
        seen.longestHour = Math.max(seen.longestHour, s);
      }
      hourAt = now;
      seen.hours += 1;
      if (Number(Q.get('hours')) && seen.hours > Number(Q.get('hours'))) finish(errors[0] ?? null);
    },
    onState(state) {
      if (state !== 'end' || done) return;
      setTimeout(() => {
        if (errors.length) return finish(errors[0].slice(0, 200));
        if (seen.hours !== 60) return finish(`${seen.hours} hours played, not 60`);
        finish(null);
      }, 50);
    },
  });
  return hud;
}
