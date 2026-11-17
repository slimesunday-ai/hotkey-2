// The run (RUN.md): a new way to play, beside the old rules and sharing their roll formula, dice and stage.
//   const cfg = RUN_CONFIG; let state = newRun({ seed: 1 });
//   view(cfg, state)                      → what to draw, with every legal choice
//   ({ state, events } = step(cfg, state, view(cfg, state).choices[0].choice))
//   const text = saveRun(state); ({ ok, state, why } = loadRun(text))   → a run kept as text and picked up again

export { RUN_CONFIG, withRunConfig } from './config.mjs';
export { newRun, copyRun, RUN_STATE_VERSION } from './state.mjs';
export { view, listChoices } from './view.mjs';
export { step } from './step.mjs';
export { checkRunBooks } from './ledger.mjs';
export { saveRun, loadRun, SAVE_KIND } from './save.mjs';
export { danger, deal, jobOdds, jumpContest, jumpTakes, morningEnergy, ownsAll, ITEMS } from './rules.mjs';
