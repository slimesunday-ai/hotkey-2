// THE SAMPLED FIGURES OF THE BASE COMMIT (smooth-1): the fixture (scripts/odds-figures.mjs, run once on 697d3a1) and
// the comparison both odds tests make (test/odds-figures.test.mjs, test/odds-background.test.mjs).
// (raid-page, 2026-11-19: RE-RECORDED with the same script on today's rules, after the raid (raid-1) added scripted
// players, a raid's odds to the view and its words: first recorded to a scratch file by the direct path (Node), then
// the background path (counts asked for, played by workers, kept) was compared figure by figure against it and every
// pending view checked to wait only where a figure waits; it passed, and that recording is this fixture)
// (pot-1, 2026-11-19: RE-RECORDED with the same script after the pot (the view's `make`, `pot`, `under` and each place's
// chips; one more scripted player, `cook`). Before it was replaced, the new recording was compared with the raid-page
// one for every player and seed they share: 6,410 choice points, the same steps, every sampled figure, every piece of
// advice and every Ahead fight table the same; only the whole view's hash differed, by the new fields)
// (bench-1, 2026-11-20: RE-RECORDED with the same script on the rules WITH THE BENCH IN (BENCH_CONFIG: the page's config
// has none of it until its screens exist), with two more players: `bottler` (no workbench: the dealer's shape) and
// `bottler+bench` (the workbench a kit, dog spray and paint in one bottle on its belt: the throw's odds, with and without
// the bottle, and the blue man's card). Before it was replaced, the new code was recorded twice, on the page's config and
// on the bench's, and each compared with the pot-1 recording for all 111 players and seeds they share: 6,560 choice
// points, the same steps, all 113,826 sampled figures, the 191 pieces of advice and the 205 Ahead tables the same; only
// the whole view's hash differed (the box fan's `does`, the dance's words, the pot screen's `verb` and `unit`, and on the bench's
// config its moves and screens). Then once more after the box fan's price went to $7: against that recording, all 117 runs,
// 6,932 choice points, 120,543 figures, 201 advice and 216 Ahead tables the same; only the view's hash differed. And once
// more after the orchestrator's three calls on the bench (a bag in a bottle at half size, a mix sharing it; paint's splash
// no news; all of it taken back) and the bottle player keeping its bottles and fillings out of its pockets: every run the
// same (114 runs, every figure, step, advice and Ahead table) but the bench owner's three, as it should; on the page's
// config all 114 runs the same)
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
