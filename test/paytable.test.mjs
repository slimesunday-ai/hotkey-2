import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG, withConfig } from '../src/config.mjs';
import { CITY, validateMap, distance, stepToward, theBlock } from '../src/map.mjs';
import { payTable, payTableMarkdown, bands } from '../src/paytable.mjs';
import {
  FULL_DEMAND, docksUnitPrice, docksBuy, streetUnitPrice, streetSell, demandAfterHour, demandAfterSale,
  fenceBuys, fenceSells, usualProductPrice, rentOn, courierFee, lastCallPct,
} from '../src/market.mjs';

test('the city map is usable', () => {
  assert.doesNotThrow(() => validateMap(CITY));
  assert.equal(theBlock(CITY, 'pads'), 'projects');
  assert.equal(distance(CITY, 'docks', 'projects'), 2);
  assert.equal(distance(CITY, 'projects', 'park'), 3);
  assert.equal(stepToward(CITY, 'docks', 'projects'), 'corner');
  assert.equal(CITY.held.clinic.exit, 'bar');
  assert.equal(CITY.held.jail.exit, 'precinct');
});

test('prices are whole dollars and move the way the spec says', () => {
  // pinned numbers, so tuning the shipped config never breaks the arithmetic being tested
  const cfg = withConfig({
    docks: { chems: { price: 10, stock: 48 }, stepUnits: 8, stepPct: 10, barterPct: 5 },
    street: { price: { corner: 30, uptown: 46 }, qualityBasePct: 60, qualityStepPct: 20, demandDropPct: 93, demandRecoverPct: 105 },
    rent: { first: 25, step: 10 }, deals: { courierPct: 25, courierMin: 5 },
  });
  assert.equal(docksUnitPrice(cfg, 'chems', 0), 10);
  assert.equal(docksUnitPrice(cfg, 'chems', 8), 11);
  assert.equal(docksUnitPrice(cfg, 'chems', 0, 2), 9); // Barter 2: 10% off
  assert.deepEqual(docksBuy(cfg, 'chems', 46, 5), { units: 2, cost: 30 }); // only 2 left in the day's stock
  assert.equal(streetUnitPrice(cfg, 'uptown', 3, FULL_DEMAND), 55); // 46 × 1.2
  assert.equal(streetUnitPrice(cfg, 'corner', 1, FULL_DEMAND), 24); // 30 × 0.8
  assert.equal(streetUnitPrice(cfg, 'corner', 1, FULL_DEMAND, { sharePct: 80 }), 19);
  assert.equal(demandAfterSale(cfg, FULL_DEMAND), 930);
  assert.equal(demandAfterHour(cfg, 930), 976);
  assert.equal(demandAfterHour(cfg, 990), FULL_DEMAND);
  assert.equal(demandAfterHour(cfg, 5), 6); // it always creeps back
  const sale = streetSell(cfg, 'uptown', 3, FULL_DEMAND, 2);
  assert.equal(sale.cash, 55 + 51);
  assert.equal(rentOn(cfg, 1), 25);
  assert.equal(rentOn(cfg, 4), 55);
  assert.equal(courierFee(cfg, 100), 25);
  assert.equal(courierFee(cfg, 8), 5);
  for (const price of [streetUnitPrice(CONFIG, 'bar', 2, 777), fenceBuys(CONFIG, 'product', 3, 1), courierFee(CONFIG, 33)]) {
    assert.ok(Number.isInteger(price));
  }
});

test('last call raises street prices on day 5, and again from 21:00', () => {
  assert.equal(lastCallPct(CONFIG, 47), 100);
  assert.equal(lastCallPct(CONFIG, 48), CONFIG.season.lastCallPricePct);
  assert.equal(lastCallPct(CONFIG, 57), CONFIG.season.lastCallLatePct);
  const base = streetUnitPrice(CONFIG, 'uptown', 3, FULL_DEMAND);
  assert.equal(streetUnitPrice(CONFIG, 'uptown', 3, FULL_DEMAND, { t: 59 }), Math.floor((base * CONFIG.season.lastCallLatePct) / 100));
  assert.equal(streetUnitPrice(CONFIG, 'uptown', 3, FULL_DEMAND, { t: 48 }), Math.floor((base * CONFIG.season.lastCallPricePct) / 100));
});

test('the fence always pays worse than a player and charges more', () => {
  assert.ok(fenceBuys(CONFIG, 'chems') < CONFIG.usual.chems && CONFIG.usual.chems < fenceSells(CONFIG, 'chems'));
  for (let q = 1; q <= 5; q++) assert.ok(fenceBuys(CONFIG, 'product', q) < usualProductPrice(CONFIG, q));
  assert.ok(usualProductPrice(CONFIG, 1) < fenceSells(CONFIG, 'product'));
});

test('contest bands add up to 100 and clamp between 10 and 90', () => {
  for (const P of [-40, 10, 37, 50, 62, 90, 140]) {
    const b = bands(CONFIG, P);
    assert.equal(b.clean + b.messy + b.fail + b.disaster, 100);
    assert.ok(b.P >= 10 && b.P <= 90);
  }
  assert.deepEqual(bands(CONFIG, 50), { P: 50, clean: 30, messy: 20, fail: 20, disaster: 30 });
});

test('the pay table: all five rules hold at the shipped numbers', () => {
  const table = payTable(CONFIG, CITY);
  for (const rule of table.rules) assert.ok(rule.ok, `rule ${rule.n} fails: ${rule.text} (${rule.detail})`);
  for (const cls of ['smuggler', 'cook', 'dealer', 'gunrunner', 'robber', 'muscle', 'informant']) {
    assert.ok(table.rows.some(r => r.cls === cls && r.kind === 'trade'), `${cls} has a trade line`);
    assert.ok(table.rows.some(r => r.cls === cls && r.kind === 'grind'), `${cls} has a safe-grind line`);
  }
});

test("the pay table catches the first draft's numbers", () => {
  // The spec's first draft: the chain netted about $40 a seat a day against rent of $25 to $55.
  const draft = withConfig({
    docks: { chems: { price: 8, stock: 36 }, parts: { price: 12, stock: 24 }, stepUnits: 6 },
    street: { price: { corner: 18, bar: 22, park: 24, uptown: 30 } },
    fence: { buys: { chems: 5, parts: 8, product: 8, gun: 40 }, sells: { chems: 16, parts: 24, product: 22 } },
    floors: { crimeTip: 25, patrolPay: 8 },
    usual: { chems: 12, parts: 16, product: 10, productPerQuality: 2, gun: 110, protectPerHour: 10 },
  });
  const failed = payTable(draft, CITY).rules.filter(r => !r.ok).map(r => r.n);
  assert.ok(failed.includes(1), 'rule 1 (the trade clears rent) should fail');
  assert.ok(failed.includes(3), 'rule 3 (the safe grind loses) should fail');
});

test('PAYTABLE.md is what the script writes from the config', () => {
  const onDisk = readFileSync(new URL('../PAYTABLE.md', import.meta.url), 'utf8');
  assert.equal(onDisk, payTableMarkdown(CONFIG, CITY), 'run `node scripts/paytable.mjs` after changing the numbers');
});
