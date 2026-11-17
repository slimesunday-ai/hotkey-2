// A FIST'S BLOOD IS OPT-IN PER STEP (demo/stage/gore.js blow, director.js 'blow'): a step bleeds only when its scene's
// author says `blood: true`, and only a blow the city's clips land (punch, haymaker, scuffle) has a moment to bleed at.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepPlan, IN_ORDER } from '../demo/stage/director-plan.js';
import { BLOWS } from '../demo/stage/gore.js';
import { ACTION_CLIPS } from '../src/clips.mjs';

test('a step asks for blood by `blood: true`, and nothing else asks for it', () => {
  assert.equal(stepPlan({ actor: 'a', action: 'punch', target: 'b', blood: true }).blood, true);
  assert.equal(stepPlan({ actor: 'a', action: 'punch', target: 'b' }).blood, undefined);
  assert.equal(stepPlan({ actor: 'a', action: 'haymaker', target: 'b', blood: false }).blood, undefined);
});

test('every blow that bleeds is the clip its action plays, landing inside it', async () => {
  const { CLIP } = await import('../city/from-trunk/style/city/anim/cast/clips/index.js');
  for (const [clip, at] of Object.entries(BLOWS)) {
    const action = Object.keys(ACTION_CLIPS).find(a => (IN_ORDER[a] ?? ACTION_CLIPS[a]).includes(clip));
    assert.ok(['punch', 'haymaker', 'scuffle'].includes(action), `${clip} is played by ${action}`);
    assert.ok(CLIP[clip]?.pair, `${clip} is a two-person clip`);
    assert.ok(at > 0 && at < CLIP[clip].dur, `${clip} lands at ${at} s, inside its ${CLIP[clip].dur} s`);
  }
});
