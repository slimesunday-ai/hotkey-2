#!/usr/bin/env node
// Play the run (RUN.md) in the terminal: the view in plain words, one key per choice.
//   node scripts/run-play.mjs --seed 1
//   node scripts/run-play.mjs --seed 1 --choices 4=2,5,1,2,h,i,5     replay a list of choices, then go on by hand
// Keys: the number of a choice; 3@2 does option 3 to its second target; i go inside, o step out (o=2 with $2), t the
// subway to the market, h head home, r rob somebody passing, b dig through the bins, d buy the energy drink, z sleep
// rough, g give the regular at your door what they ask, x shut the door on them, s sleep, m morning, q quit. A
// replayed list stops at the first key that isn't a choice there.
import { createInterface } from 'node:readline';
import { RUN_CONFIG, newRun, view, step, checkRunBooks } from '../src/run/index.mjs';
import { viewText, eventsText, choiceForKey } from '../src/run/text.mjs';

const argv = process.argv.slice(2);
const opt = name => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const seed = Number(opt('--seed') ?? 1);
const scripted = (opt('--choices') ?? '').split(',').map(s => s.trim()).filter(Boolean);
const cfg = RUN_CONFIG;
let state = newRun({ seed, cfg });

function play(key) {
  const v = view(cfg, state);
  const picked = choiceForKey(v, key);
  if (picked.error) return picked.error;
  const r = step(cfg, state, picked.choice);
  state = r.state;
  if (!checkRunBooks(state).ok) throw new Error('the books do not balance');
  console.log(`> ${key}\n${eventsText(r.events)}\n`);
  return null;
}

console.log(`The run, seed ${seed}. Wake at the crib.\n`);
let stopped = false;
for (const key of scripted) {
  console.log(viewText(view(cfg, state)));
  const error = play(key);
  if (error) {
    console.log(`> ${key}\n  ${error}\nStopped the replay there.`);
    stopped = true;
    break;
  }
}

function summary() {
  const b = state.books;
  return `Day ${state.day}: banked $${state.banked}, carried $${state.carried}. Earned $${b.earned}; jumped for $${b.jumped}; seized $${b.seized}; fares $${b.fares}; spent $${b.spent}.${state.doneDay ? ` Done in ${state.doneDay} days.` : ''}`;
}

if (!process.stdin.isTTY) {
  if (!stopped) console.log(viewText(view(cfg, state)));
  console.log(`\n${summary()}`);
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = () => {
    console.log(viewText(view(cfg, state)));
    rl.question('> ', key => {
      if (key.trim().toLowerCase() === 'q') {
        console.log(summary());
        rl.close();
        return;
      }
      const error = play(key);
      if (error) console.log(`  ${error}\n`);
      ask();
    });
  };
  ask();
}
