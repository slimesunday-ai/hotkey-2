#!/usr/bin/env node
// hotkey 2: play bot or AI seasons and write out/<run>/ (SPEC section 17). The options are listed in src/cli.mjs.
import { main } from './src/cli.mjs';

main(process.argv.slice(2)).catch(err => {
  console.error(`run.mjs: ${err.message}`);
  process.exitCode = 1;
});
