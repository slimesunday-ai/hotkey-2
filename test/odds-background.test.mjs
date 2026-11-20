// THE SAMPLED FIGURES THROUGH THE PAGE'S PATH (smooth-1): the same players, seeds and season as
// test/odds-figures.test.mjs, but with the counts asked for and worked out in workers, as the page does
// (src/run/odds.mjs deferTallies, collecting, keepTally; demo/run/odds-worker.js plays tallyFights): every view is
// drawn first with its missing counts pending, the workers play them (each job cloned across, as postMessage does),
// they are kept, and the view is drawn again. Its figures must be the base commit's, and the pending view must be the
// final one with NaN exactly where a figure waited: the same shape, nothing else different, no figure made up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { modulesOf, capture } from '../scripts/odds-figures.mjs';
import { ROOT, FIXTURE, sameAsBase } from './odds-fixture.mjs';
import { deferTallies, collecting, keepTally, tallyFights, tallyRange, emptyTally } from '../src/run/odds.mjs';

const ODDS = new URL('../src/run/odds.mjs', import.meta.url).href;

/** A few workers playing tallyFights, as the page's do. */
function pool(n = 4) {
  const ws = Array.from({ length: n }, () => new Worker(`
    const { parentPort } = require('node:worker_threads');
    import(${JSON.stringify(ODDS)}).then(({ tallyFights }) => parentPort.on('message', ({ key, job }) => parentPort.postMessage({ key, tally: tallyFights(job) })));
  `, { eval: true }));
  const idle = [...ws];
  const queue = [];
  const done = new Map();
  const pump = () => {
    while (idle.length && queue.length) {
      const w = idle.pop();
      const { key, job, resolve } = queue.shift();
      w.once('message', m => {
        idle.push(w);
        resolve(m);
        pump();
      });
      w.postMessage({ key, job });
    }
  };
  return {
    run: (key, job) => done.get(key) ?? done.set(key, new Promise(resolve => {
      queue.push({ key, job, resolve });
      pump();
    })).get(key),
    end: () => Promise.all(ws.map(w => w.terminate())),
  };
}

/** A NaN anywhere in it, or words with NaN in them (demo/run/odds.js pendingIn, the page's own test). */
const hasNaN = x => (typeof x === 'number' ? Number.isNaN(x) : typeof x === 'string' ? x.includes('NaN') : !!x && typeof x === 'object' && Object.values(x).some(hasNaN));

/** The pending view against the final one: the same shape; where they differ, the pending one is NaN (or words with NaN in them). */
function onlyPending(p, f, path = 'v', out = { pending: 0 }) {
  if (typeof f === 'number' && typeof p === 'number') {
    if (Object.is(p, f)) return out;
    assert.ok(Number.isNaN(p), `${path}: pending ${p}, final ${f}: a figure that is not NaN changed`);
    assert.ok(!Number.isNaN(f), `${path}: still NaN when every count is kept`);
    out.pending += 1;
    return out;
  }
  if (typeof f === 'string' && typeof p === 'string') {
    if (p === f) return out;
    assert.ok(p.includes('NaN') && !f.includes('NaN'), `${path}: "${p}" against "${f}"`);
    // (the words are the final words with a number where each NaN stands: nothing else in them moved)
    const like = new RegExp(`^${p.split('NaN').map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('-?\\d+(?:\\.\\d+)?')}$`);
    assert.match(f, like, `${path}: "${p}" against "${f}"`);
    out.pending += 1;
    return out;
  }
  assert.equal(typeof p, typeof f, `${path}: the same kind of thing`);
  if (Array.isArray(f)) {
    assert.ok(Array.isArray(p) && p.length === f.length, `${path}: the same length`);
    f.forEach((x, i) => onlyPending(p[i], x, `${path}[${i}]`, out));
    return out;
  }
  if (f && typeof f === 'object') {
    const pk = Object.keys(p).filter(k => k !== 'pending');
    assert.deepEqual(pk, Object.keys(f), `${path}: the same keys`);
    for (const k of pk) onlyPending(p[k], f[k], `${path}.${k}`, out);
    return out;
  }
  assert.equal(p, f, path);
  return out;
}

test('every sampled figure is the base commit\'s through the background path, and a pending view only ever waits', { timeout: 900000 }, async () => {
  const M = await modulesOf(ROOT);
  const P = pool(4);
  const asked = new Map();
  deferTallies((key, job) => asked.set(key, structuredClone(job)));
  const seen = { views: 0, waited: 0, pendingFigures: 0, counts: 0 };
  /** fn() until it asks for nothing missing: what it asked for is played by the workers and kept between tries. */
  const settle = async (fn, check = null) => {
    let first = null;
    for (;;) {
      const r = collecting(fn);
      if (!r.missing.length) {
        if (first && check) check(first, r.value);
        return r.value;
      }
      first ??= r.value;
      const got = await Promise.all(r.missing.map(k => P.run(k, asked.get(k))));
      for (const { key, tally } of got) keepTally(key, tally);
      seen.counts += got.length;
    }
  };
  try {
    const body = await capture(M, {
      seeds: FIXTURE.seeds, days: FIXTURE.days,
      how: {
        viewOf: st => settle(() => M.view(M.cfg, st), (p, f) => {
          seen.waited += 1;
          seen.pendingFigures += onlyPending(p, f).pending;
        }).then(v => {
          // (and a view with every count kept has no NaN anywhere: the page's "still being worked out" is never stuck)
          assert.ok(!hasNaN(v), 'a view with every count kept has a NaN in it');
          seen.views += 1;
          return v;
        }),
        decideOf: (st, v, policy) => settle(() => M.decide(M.cfg, st, policy, v)),
        // (the page's stepExact: played with what is kept; a try that asked for a count not kept is thrown away, the
        // counts worked out, and the step played again)
        stepOf: (st, c) => settle(() => M.step(M.cfg, st, c)),
        adviceOf: (before, duel) => settle(() => M.rules.fightAdvice(M.cfg, before, duel)),
        cellOf: (st, arm, style) => settle(() => M.ahead.aheadCell(M.cfg, st, arm, style)),
      },
    });
    const figures = sameAsBase(body);
    assert.ok(figures > 10000, `a real count of figures compared (${figures})`);
    assert.ok(seen.waited > 50 && seen.pendingFigures > 500 && seen.counts > 100, `the background path was really taken: ${JSON.stringify(seen)}`);
  } finally {
    deferTallies(null);
    await P.end();
  }
});

test('counts are the same played whole, in slices, or kept and asked again', async () => {
  const { RUN_CONFIG: cfg, newRun } = await import('../src/run/index.mjs');
  const { jumpOf, duelOf, crewOf } = await import('../src/run/rules.mjs');
  const { raidOf } = await import('../src/run/raid.mjs');
  const s = { ...newRun({ seed: 3, cfg }), place: 'docks' };
  const jobs = [
    { inputs: jumpOf(cfg, s, 'docks').inputs, n: 120, scrape: cfg.jumped.scrape },
    { inputs: duelOf(cfg, s, { id: 'x', name: 'x', role: 'debtor' }).inputs, n: 90, scrape: null },
    { inputs: crewOf(cfg, s, { earl: true }).inputs, n: 60, scrape: null },
    // (raid-page: the raid on your home's fight, counted with the fights held only just and the rounds fired)
    { inputs: raidOf(cfg, { ...s, things: { sixshot: true, fogger: true }, ammo: { sixshot: 12 } }, { crew: 'shooters', size: 1, earl: true }).inputs, n: 40, scrape: null, raid: { hurtAt: cfg.sixesRaid.hurtAt } },
  ];
  for (const job of jobs) {
    const whole = tallyFights(job);
    const acc = emptyTally(job.n, job.scrape, job.raid ?? null);
    for (let i = 1; i <= job.n; i += 7) tallyRange(job, i, Math.min(job.n, i + 6), acc);
    assert.deepEqual(acc, whole);
  }
});
