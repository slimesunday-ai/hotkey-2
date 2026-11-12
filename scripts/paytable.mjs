#!/usr/bin/env node
// Writes PAYTABLE.md from the config (SPEC section 7c). `--print` only prints it.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { CONFIG } from '../src/config.mjs';
import { CITY } from '../src/map.mjs';
import { payTableMarkdown, payTable } from '../src/paytable.mjs';

const text = payTableMarkdown(CONFIG, CITY);
if (process.argv.includes('--print')) {
  console.log(text);
} else {
  const target = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'PAYTABLE.md');
  writeFileSync(target, text);
  const failed = payTable(CONFIG, CITY).rules.filter(r => !r.ok);
  console.log(`paytable: wrote PAYTABLE.md, ${failed.length ? failed.length + ' rule(s) FAIL' : 'all five rules pass'}`);
}
