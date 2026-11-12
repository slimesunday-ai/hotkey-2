// Prices, in whole dollars (SPEC section 7). Pure functions of the config, shared by the engine, the menus, the bots
// and the pay table, so the pay table can never drift from what the game charges.
// Pattern from the original hotkey engine's rules/market.mjs: price curves in whole numbers, always rounded the same
// way (down for what you're paid, up for what you pay), so no rounding error ever decides a dollar.

export const FULL_DEMAND = 1000; // demand is kept in per-mille: 1000 is a fresh block

const floorDiv = (a, b) => Math.floor(a / b);
const ceilDiv = (a, b) => Math.ceil(a / b);

/** What the docks charge for the next unit, after `boughtToday` units of that good were bought today by anyone. */
export function docksUnitPrice(cfg, good, boughtToday, barter = 0) {
  const d = cfg.docks;
  const steps = floorDiv(boughtToday, d.stepUnits);
  const pct = (100 + d.stepPct * steps) * (100 - d.barterPct * barter);
  return Math.max(1, ceilDiv(d[good].price * pct, 100 * 100));
}

/** The total for `units` more units, and how many the day's stock still allows. */
export function docksBuy(cfg, good, boughtToday, units, barter = 0) {
  const left = Math.max(0, cfg.docks[good].stock - boughtToday);
  const n = Math.min(units, left);
  let cost = 0;
  for (let i = 0; i < n; i++) cost += docksUnitPrice(cfg, good, boughtToday + i, barter);
  return { units: n, cost };
}

/** Quality's share of a street price, in percent: q1 80, q3 120, q5 160. */
export function qualityPct(cfg, quality) {
  return cfg.street.qualityBasePct + cfg.street.qualityStepPct * quality;
}

/** The season's price multiplier at hour `t`, in percent: 100, or more at last call. */
export function lastCallPct(cfg, t) {
  const s = cfg.season;
  const day = floorDiv(t, s.hoursPerDay) + 1;
  if (day < s.lastCallDay) return 100;
  return t % s.hoursPerDay >= s.lastCallLateFrom ? s.lastCallLatePct : s.lastCallPricePct;
}

/**
 * What a street buyer pays for one unit, right now.
 * `sharePct` is the dealer's share of the block: 100 alone or on its own turf, 80 sharing, 50 on someone else's turf.
 */
export function streetUnitPrice(cfg, priceKey, quality, demand, { t = 0, sharePct = 100 } = {}) {
  const base = cfg.street.price[priceKey];
  if (base === undefined) throw new Error(`no street price for ${priceKey}`);
  return floorDiv(base * qualityPct(cfg, quality) * demand * lastCallPct(cfg, t) * sharePct, 100 * FULL_DEMAND * 100 * 100);
}

/** A block's demand after one more unit is sold there. */
export function demandAfterSale(cfg, demand) {
  return floorDiv(demand * cfg.street.demandDropPct, 100);
}

/** A block's demand an hour later. It always creeps back, up to full. */
export function demandAfterHour(cfg, demand) {
  if (demand >= FULL_DEMAND) return FULL_DEMAND;
  return Math.min(FULL_DEMAND, Math.max(demand + 1, floorDiv(demand * cfg.street.demandRecoverPct, 100)));
}

/** Sell up to `units` of one quality on a block. Returns what was earned and the demand left behind. */
export function streetSell(cfg, priceKey, quality, demand, units, opts) {
  let cash = 0;
  let d = demand;
  for (let i = 0; i < units; i++) {
    cash += streetUnitPrice(cfg, priceKey, quality, d, opts);
    d = demandAfterSale(cfg, d);
  }
  return { cash, demand: d };
}

/** What the fence pays for goods. `barter` is a smuggler's Barter level. */
export function fenceBuys(cfg, good, quality = 1, barter = 0) {
  const each = cfg.fence.buys[good];
  if (each === undefined) throw new Error(`the fence doesn't buy ${good}`);
  const scaled = good === 'product' || good === 'gun' ? each * quality : each;
  return floorDiv(scaled * (100 + cfg.fence.barterPct * barter), 100);
}

/** What the fence charges. It only ever has quality 1 product. */
export function fenceSells(cfg, good) {
  const each = cfg.fence.sells[good];
  if (each === undefined) throw new Error(`the fence doesn't sell ${good}`);
  return each;
}

/** What a street gun buyer pays. */
export function streetGunPrice(cfg, quality, clientele = 0) {
  return floorDiv(cfg.guns.streetPrice * quality * (100 + cfg.guns.clientelePct * clientele), 100);
}

/** A gun's quality from the gunrunner's Craft. */
export function gunQuality(cfg, craft = 0) {
  return Math.min(cfg.guns.maxQuality, 1 + floorDiv(craft, 2));
}

/** Product quality from the cook's Purity, and units per batch from its Yield. */
export function cookQuality(cfg, purity = 0) {
  return Math.min(cfg.cook.maxQuality, 1 + purity);
}
export function cookUnits(cfg, yieldLevel = 0) {
  return cfg.cook.unitsPerBatch + (yieldLevel >= 4 ? 2 : yieldLevel >= 2 ? 1 : 0);
}

/** The usual price between players for one unit of product of a quality (the anchor bots and menus use). */
export function usualProductPrice(cfg, quality) {
  return cfg.usual.product + cfg.usual.productPerQuality * quality;
}

/** Rent on night `n` (1 is the first night). */
export function rentOn(cfg, night) {
  return cfg.rent.first + cfg.rent.step * (night - 1);
}

/** The courier's fee on a deal's cash price. */
export function courierFee(cfg, cashPrice) {
  return Math.max(cfg.deals.courierMin, ceilDiv(cashPrice * cfg.deals.courierPct, 100));
}

/** Bail for someone with `stars` of heat. */
export function bailFor(cfg, stars) {
  return cfg.bail.base + cfg.bail.perStar * stars;
}
