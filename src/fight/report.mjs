// THE FIGHT IN WORDS: what the page's cards say, as text, for an AI player (or a log). The losing line is advice.mjs's.
import { LEVELS, WEAPONS, POCKET, buildName } from './data.mjs';
import { outcome } from './sim.mjs';
import { advise } from './advice.mjs';

const list = parts => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

/** What was picked up, in words: '$34, 8 rounds and a bandage', or 'nothing'. */
export function pickedWords(O) {
  const P = O.picked;
  const parts = [];
  if (P.cash) parts.push(`$${P.cash}`);
  if (P.rounds) parts.push(`${P.rounds} rounds`);
  parts.push(...P.things);
  return parts.length ? list(parts) : 'nothing';
}

/** → { result, title, lines: [...], advice, outcome } for a fight that is over. */
export function report(F, { advice = true } = {}) {
  const O = outcome(F);
  const L = LEVELS[F.level];
  const lines = [];
  let title;
  if (O.result === 'won') {
    title = `You cleared ${L.name} in ${O.seconds} s.`;
    lines.push(`${O.hp} of ${O.max} health left. You dropped all ${O.of}.`);
    lines.push(`Picked up: ${pickedWords(O)}.`);
  } else if (O.result === 'lost') {
    title = `You went down at ${O.seconds} s.`;
    const took = [`$${O.taken.cash}`];
    if (O.taken.gun) took.push(`your ${O.taken.gun}`);
    lines.push(`You dropped ${O.dropped} of ${O.of}. They took ${list(took)} (the $${POCKET} you came with and all you picked up). You wake at your trailer.`);
  } else if (O.result === 'left') {
    title = `You went back down the stairs at ${O.seconds} s.`;
    lines.push(`You kept your skin: ${O.hp} health, and ${pickedWords(O)} picked up. The trip is lost.`);
  } else {
    title = `They backed off at ${O.seconds} s.`;
    lines.push(`You held out with ${O.hp} health and ${O.dropped} of ${O.of} dropped, but the stop is not cleared.`);
  }
  const A = advice && O.result !== 'won' ? advise(F) : null;
  if (A) lines.push(`${A.consider[0].toUpperCase()}${A.consider.slice(1)}. ${A.line}`);
  return { result: O.result, title, lines, advice: A, outcome: O, build: buildName(F.build), weapon: WEAPONS[F.build.weapon].name };
}

/** The fight in one block of text. */
export function reportText(F) {
  const R = report(F);
  return [`THE FIGHT, ${LEVELS[F.level].name}, ${R.build}: ${R.title}`, ...R.lines].join('\n');
}
