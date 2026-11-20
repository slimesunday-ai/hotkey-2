// THE SAMPLED FIGURES DID NOT MOVE (smooth-1): every figure the view shows that comes from a sample of fights, for
// every scripted player on three seeds over a six-day season, the advice after each fight lost and the Ahead screen's
// fight tables, against what the base commit 697d3a1 showed (scripts/odds-figures.mjs, run once there:
// test/fixtures/odds-figures.json.gz). This file is the plain path, Node's: every count played at once.
// test/odds-background.test.mjs plays the same through the page's path (counts asked for, worked out in workers, kept).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modulesOf, capture } from '../scripts/odds-figures.mjs';
import { ROOT, FIXTURE, sameAsBase } from './odds-fixture.mjs';

test('every sampled figure of every scripted player is the base commit\'s, played at once (Node)', { timeout: 900000 }, async () => {
  const M = await modulesOf(ROOT);
  const body = await capture(M, { seeds: FIXTURE.seeds, days: FIXTURE.days });
  const figures = sameAsBase(body);
  assert.ok(figures > 10000, `a real count of figures compared (${figures})`);
});
