// THE SAMPLED FIGURES OF THE BASE COMMIT (smooth-1): the fixture (scripts/odds-figures.mjs, run once on 697d3a1) and
// the comparison both odds tests make (test/odds-figures.test.mjs, test/odds-background.test.mjs).
// (raid-page, 2026-11-19: RE-RECORDED with the same script on today's rules, after the raid (raid-1) added scripted
// players, a raid's odds to the view and its words: first recorded to a scratch file by the direct path (Node), then
// the background path (counts asked for, played by workers, kept) was compared figure by figure against it and every
// pending view checked to wait only where a figure waits; it passed, and that recording is this fixture)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const FIXTURE = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/odds-figures.json.gz', import.meta.url))).toString('utf8'));

/** Every run of `body` against the fixture, figure by figure: the first difference is said with where it is. */
export function sameAsBase(body, base = FIXTURE) {
  assert.deepEqual(Object.keys(body.runs).sort(), Object.keys(base.runs).sort(), 'the same players and seeds');
  let figures = 0;
  for (const [name, r0] of Object.entries(base.runs)) {
    const r = body.runs[name];
    assert.equal(r.view.length, r0.view.length, `${name}: the same number of choice points`);
    for (let i = 0; i < r0.view.length; i++) {
      const f0 = base.dict[r0.fig[i]];
      const f = body.dict[r.fig[i]];
      if (f !== f0) assert.deepEqual(JSON.parse(f), JSON.parse(f0), `${name}, choice point ${i}: the sampled figures`);
      figures += JSON.parse(f0).length;
      assert.equal(r.view[i], r0.view[i], `${name}, choice point ${i}: the whole view`);
    }
    assert.deepEqual(r.advice, r0.advice, `${name}: the advice after each fight lost`);
    assert.deepEqual(r.ahead, r0.ahead, `${name}: the Ahead screen's fight tables`);
  }
  return figures;
}
