import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RUN_CONFIG, newRun, view, step } from '../src/run/index.mjs';
import { viewText, choiceForKey } from '../src/run/text.mjs';
import { measure, judge, tableText, KITS, measureWorld, judgeWorld, worldText } from '../src/run/marks.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const play = (...args) => spawnSync(process.execPath, ['scripts/run-play.mjs', ...args], { cwd: root, encoding: 'utf8', input: '' });

test('run-play: a scripted list of choices replays the same game every time', () => {
  // (styles-1: seed 1; getting jumped is a fight now, and seed 3's day went another way)
  const keys = '4=2,5,2,1,h,i,o,1,i,s,4,t';
  const a = play('--seed', '1', '--choices', keys);
  const b = play('--seed', '1', '--choices', keys);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(a.stdout, b.stdout);
  assert.match(a.stdout, /The run, seed 1/);
  assert.match(a.stdout, /You stepped out with \$2\./);
  assert.match(a.stdout, /You rode the subway to the Jay St night market\./);
  assert.match(a.stdout, /Day 2, 12:00/);
  assert.match(a.stdout, /> t\n {2}- You hopped the turnstile/);
  assert.doesNotMatch(a.stdout, /Stopped the replay/);
  assert.match(a.stdout, /someone jumps you/);
  assert.notEqual(play('--seed', '4', '--choices', keys).stdout, a.stdout);
  // a key that isn't a choice there stops the replay and says why
  const c = play('--seed', '3', '--choices', '1');
  assert.match(c.stdout, /you have \$20 banked\nStopped the replay there\./);
});

test('run-play: keys are numbers from the list, N=amount to step out with cash, and letters for moves', () => {
  const cfg = RUN_CONFIG;
  let state = newRun({ seed: 1, cfg });
  let v = view(cfg, state);
  assert.deepEqual(choiceForKey(v, '4=2').choice, { do: 'out', take: 2 });
  assert.deepEqual(choiceForKey(v, 'o').choice, { do: 'out', take: 0 });
  assert.deepEqual(choiceForKey(v, 's').choice, { do: 'sleep' });
  assert.match(choiceForKey(v, '1').error, /banked/);
  assert.match(choiceForKey(v, '9').error, /no such choice/);
  assert.match(choiceForKey(v, 'o=x').error, /not an amount/);
  state = step(cfg, state, { do: 'out', take: 0 }).state;
  v = view(cfg, state);
  assert.deepEqual(choiceForKey(v, 't').choice, { do: 'subway', to: 'market', hop: true }); // no fare on you: the hop
  const text = viewText(v);
  assert.match(text, /Day 1, 12:00, the trailer park/);
  assert.match(text, /An odd job for (Mrs\. Alvarez|Mr\. Pruitt|Gloria): sure, \$6–10/);
  assert.match(text, /People here: Mrs\. Alvarez \(calm\)/);
  assert.match(text, /the corner\s+\[held by the Sixes\]/);
});

test('run-marks: the measuring runs on the real engine and judges all seven marks', () => {
  const result = measure(RUN_CONFIG, { seeds: 12, stops: [60, 120] });
  const marks = judge(result);
  assert.deepEqual(marks.map(m => m.n), [1, 2, 3, 4, 5, 6, 7]);
  for (const m of marks) assert.equal(typeof m.pass, 'boolean');
  assert.equal(Object.keys(result.rows).length, KITS.length);
  const text = tableText(result, marks);
  assert.match(text, /mattress/);
  assert.match(text, /Days to own all three/);
  // and rules-2's five, from the same rows
  const world = judgeWorld(measureWorld(RUN_CONFIG, { seeds: 6, rows: result.rows }));
  assert.deepEqual(world.map(m => m.n), [8, 9, 10, 11, 12]);
  for (const m of world) assert.equal(typeof m.pass, 'boolean');
  assert.match(worldText(world), /Robbing twice in one place/);
});

test('run-play: the new moves have keys and replay: rob, bins, a target, the drink, sleeping rough', () => {
  // seed 1 (styles-1: seed 3's day went another way once getting jumped was a fight): out with the fare and a carton's
  // price, the carton from Cousin Earl (11), the market, option 2 on its second target (selling a pack's worth to the
  // crowd), the bins, then stay out to nothing and sleep rough
  const keys = '4=12,11,5,2@2,b,1,1,1,z';
  const a = play('--seed', '1', '--choices', keys);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(a.stdout, play('--seed', '1', '--choices', keys).stdout);
  assert.doesNotMatch(a.stdout, /Stopped the replay/);
  assert.match(a.stdout, /> 2@2\n {2}- Sell to Lola in the crowd/); // (Pockets dealt, Lola the second of four buyers)
  assert.match(a.stdout, /> b\n {2}- You dug through the bins/);
  assert.match(a.stdout, /> z\n {2}- You slept rough at the Jay St night market\./);
  assert.match(a.stdout, /Day 2\. You wake on the street at the Jay St night market/);
  assert.match(a.stdout, /The city: /);
});
