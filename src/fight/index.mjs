// THE FIGHT (a test round of THE RUN, kept apart from its economy and rules): see sim.mjs.
export * from './data.mjs';
export { createFight, step, runFight, outcome, you, allyOf, foes } from './sim.mjs';
export { still, kite, brawl, POLICIES } from './policies.mjs';
export { duelArena, startDuel, runDuel, duelOdds } from './duel.mjs';
export { advise, upgrades } from './advice.mjs';
export { report, reportText, pickedWords } from './report.mjs';
