// The pay table (SPEC section 7c): dollars an hour for every class's trade and every class's safe grind, worked out
// from the config with the arithmetic shown. It is written before any tuning and re-run after every change, because
// September's lesson was that the best-paying verb wins and tuning without the rate arithmetic is whack-a-mole.
//
// This is arithmetic, not a simulation: one agent of each class playing a plain, competent day with the other classes
// trading at the usual prices. The bot runs measure what really happens; this says what the numbers offer.

import { distance, theBlock, blocksWith } from './map.mjs';
import {
  FULL_DEMAND, docksBuy, streetUnitPrice, demandAfterSale, demandAfterHour, fenceBuys, fenceSells,
  streetGunPrice, gunQuality, cookQuality, cookUnits, usualProductPrice, rentOn, courierFee,
} from './market.mjs';

const round1 = x => Math.round(x * 10) / 10;

/** The outcome bands of a contest at P percent (SPEC section 8), as chances out of 100. */
export function bands(cfg, P) {
  const p = Math.max(cfg.contest.min, Math.min(cfg.contest.max, P));
  const clamp = x => Math.max(0, Math.min(100, x));
  const clean = clamp(p - cfg.contest.band);
  const messy = clamp(p) - clean;
  const fail = clamp(p + cfg.contest.band) - clamp(p);
  return { P: p, clean, messy, fail, disaster: 100 - clean - messy - fail };
}

/** The best day's street selling for one dealer: which blocks, how long on each, ending back home. */
export function bestDealerDay(cfg, map, { units, quality, hustle = 0, blocks, sharePct = 100, startDemand = {} }) {
  const home = theBlock(map, 'pads');
  const hours = cfg.season.hoursPerDay;
  const perHour = cfg.street.unitsPerHour + hustle;
  const buyerBlocks = (blocks ?? blocksWith(map, 'buyers'));
  let best = { cash: -1 };

  const orders = [];
  const permute = (left, picked) => {
    if (picked.length) orders.push(picked);
    if (picked.length === 3) return;
    for (const b of left) permute(left.filter(x => x !== b), [...picked, b]);
  };
  permute(buyerBlocks, []);

  for (const order of orders) {
    const stints = order.map(() => 1);
    const tryStints = i => {
      if (i === order.length) {
        const result = sellRoute(order, stints);
        if (result && result.cash > best.cash) best = result;
        return;
      }
      for (let h = 1; h <= 8; h++) {
        stints[i] = h;
        tryStints(i + 1);
      }
    };
    tryStints(0);
  }
  return best;

  function sellRoute(order, stints) {
    const demand = Object.fromEntries(buyerBlocks.map(b => [b, startDemand[b] ?? FULL_DEMAND]));
    let t = 0;
    let at = home;
    let left = units;
    let cash = 0;
    let sold = 0;
    const legs = [];
    const tick = () => {
      t++;
      for (const b of buyerBlocks) demand[b] = demandAfterHour(cfg, demand[b]);
    };
    for (let i = 0; i < order.length; i++) {
      const block = order[i];
      for (let m = distance(map, at, block); m > 0; m--) tick();
      at = block;
      let legCash = 0;
      let legUnits = 0;
      for (let h = 0; h < stints[i]; h++) {
        const from = map.blocks[block].buyers.from;
        if (t >= from) {
          for (let u = 0; u < perHour && left > 0; u++) {
            legCash += streetUnitPrice(cfg, map.blocks[block].buyers.price, quality, demand[block], { sharePct });
            demand[block] = demandAfterSale(cfg, demand[block]);
            left--;
            legUnits++;
          }
        }
        tick();
      }
      cash += legCash;
      sold += legUnits;
      legs.push({ block, hours: stints[i], units: legUnits, cash: legCash });
    }
    for (let m = distance(map, at, home); m > 0; m--) tick();
    if (t > hours) return null;
    return { cash, sold, hoursUsed: t, legs, demand };
  }
}

/** Everything the pay table says, as data. `scripts/paytable.mjs` prints it; a test checks its five rules. */
export function payTable(cfg, map) {
  const H = cfg.season.hoursPerDay;
  const home = theBlock(map, 'pads');
  const docks = theBlock(map, 'supplier');
  const market = theBlock(map, 'fence');
  const u = cfg.usual;
  const rows = [];
  const notes = [];
  const nights = cfg.season.days - 1; // rent is paid on the nights between days
  const seasonRent = Array.from({ length: nights }, (_, i) => rentOn(cfg, i + 1)).reduce((a, b) => a + b, 0);

  // ---- smuggler: run at the docks, walk the load home, hand it off, walk back
  const smuggler = (haul, label) => {
    const perRun = cfg.docks.unitsPerRun + haul;
    const walk = distance(map, docks, home);
    // k runs then the round trip; pick the k that moves the most units in a 12-hour day
    let bestDay = { units: 0 };
    for (let k = 1; k + 2 * walk <= H; k++) {
      const loop = k + 2 * walk;
      const loops = Math.floor(H / loop);
      const units = loops * k * perRun;
      if (units > bestDay.units) bestDay = { units, k, loop };
    }
    const mine = Math.min(bestDay.units, Math.floor((cfg.docks.chems.stock + cfg.docks.parts.stock) / 2));
    const chems = Math.min(mine, Math.floor(cfg.docks.chems.stock / 2));
    const { cost } = docksBuy(cfg, 'chems', chems, chems); // priced as the second half of the day's stock: the dear half
    const income = chems * u.chems;
    const net = income - cost;
    rows.push({
      cls: 'smuggler', line: label, kind: 'trade', perDay: net, perHour: round1(net / H),
      how: `${bestDay.k} runs of ${perRun}, ${walk} moves home, ${walk} back: ${chems} chems a day. Sold to the cook at $${u.chems}, ` +
        `bought at the docks for $${cost} (the dearer half of the day's stock).`,
    });
    return { chems, net };
  };
  const smug0 = smuggler(0, 'run chems to the cook, Haul 0');
  const smug2 = smuggler(2, 'run chems to the cook, Haul 2');
  {
    // the grind: sell to the fence instead
    const walk = distance(map, docks, market);
    const perRun = cfg.docks.unitsPerRun + 2;
    let bestUnits = 0;
    for (let k = 1; k + 2 * walk <= H; k++) bestUnits = Math.max(bestUnits, Math.floor(H / (k + 2 * walk)) * k * perRun);
    const { cost } = docksBuy(cfg, 'chems', 0, bestUnits);
    const net = bestUnits * fenceBuys(cfg, 'chems') - cost;
    rows.push({
      cls: 'smuggler', line: 'safe grind: sell chems to the fence', kind: 'grind', perDay: net, perHour: round1(net / H),
      how: `${bestUnits} chems a day at the fence's $${fenceBuys(cfg, 'chems')}, bought for $${cost}.`,
    });
  }

  // ---- the chain's volume: what two smugglers bring, what one cook can cook
  // (every seat starts with 2 points; a smuggler's go on Haul, as the cook's go on Purity and the dealer's on Hustle)
  const chemsIn = Math.min(cfg.docks.chems.stock, smug2.chems * 2);
  const purity = 2; // the cook's first two points
  const quality = cookQuality(cfg, purity);
  const batches = Math.min(Math.floor(chemsIn / cfg.cook.chemsPerBatch), H);
  const unitsOut = batches * cookUnits(cfg, 0);
  const productPrice = usualProductPrice(cfg, quality);
  {
    const blowUp = cfg.cook.blowUpPct / 100;
    const good = unitsOut * (1 - blowUp);
    const net = Math.round(good * productPrice - batches * cfg.cook.chemsPerBatch * u.chems - batches * blowUp * cfg.cook.blowUpClinicHours * cfg.clinic.perHour);
    rows.push({
      cls: 'cook', line: `cook quality ${quality} for the dealers`, kind: 'trade', perDay: net, perHour: round1(net / H),
      how: `${batches} batches from the ${chemsIn} chems two Haul 2 smugglers bring: ${unitsOut} units, less ${cfg.cook.blowUpPct}% blown up. ` +
        `Chems at $${u.chems}, product sold at $${productPrice}.`,
    });
    const grind = Math.round(good * fenceBuys(cfg, 'product', quality) - batches * cfg.cook.chemsPerBatch * u.chems);
    rows.push({
      cls: 'cook', line: 'safe grind: sell everything to the fence', kind: 'grind', perDay: grind, perHour: round1(grind / H),
      how: `The same ${unitsOut} units at the fence's $${fenceBuys(cfg, 'product', quality)}.`,
    });
  }

  // ---- dealers: two of them split the cook's output and the city
  const each = Math.floor((unitsOut * (100 - cfg.cook.blowUpPct)) / 100 / 2);
  const buyerBlocks = blocksWith(map, 'buyers');
  const alone = bestDealerDay(cfg, map, { units: each, quality, hustle: 2 });
  const second = bestDealerDay(cfg, map, { units: each, quality, hustle: 2, startDemand: alone.demand });
  const dealerNet = d => d.cash - d.sold * productPrice;
  const route = d => d.legs.map(l => `${l.block} ${l.hours}h (${l.units} for $${l.cash})`).join(', ');
  rows.push({
    cls: 'dealer', line: `sell the cook's quality ${quality}, first pick of the blocks`, kind: 'trade',
    perDay: dealerNet(alone), perHour: round1(dealerNet(alone) / H),
    how: `${alone.sold} units bought at $${productPrice}: ${route(alone)}. $${round1(alone.cash / Math.max(1, alone.sold))} a unit on the street.`,
  });
  rows.push({
    cls: 'dealer', line: `sell the cook's quality ${quality}, after the other dealer`, kind: 'trade',
    perDay: dealerNet(second), perHour: round1(dealerNet(second) / H),
    how: `${second.sold} units on the demand the first dealer left: ${route(second)}. $${round1(second.cash / Math.max(1, second.sold))} a unit.`,
  });
  {
    const fenceUnits = Math.min(cfg.fence.productPerDay, each);
    const g = bestDealerDay(cfg, map, { units: fenceUnits, quality: 1, hustle: 2 });
    const net = g.cash - g.sold * fenceSells(cfg, 'product');
    rows.push({
      cls: 'dealer', line: 'safe grind: buy quality 1 from the fence', kind: 'grind', perDay: net, perHour: round1(net / H),
      how: `${g.sold} units at the fence's $${fenceSells(cfg, 'product')}: ${route(g)}. Each one has a ${cfg.street.angryPct}% chance of an angry buyer.`,
    });
  }
  const streetTake = alone.cash + second.cash;

  // ---- gunrunner: build, sell to players, sell the rest on the street
  const gq = gunQuality(cfg, 0);
  const partsCost = cfg.guns.partsPerGun * u.parts;
  const gunPlayers = u.gun * gq;
  const gunStreet = streetGunPrice(cfg, gq, 0);
  const sting = (cfg.guns.stingPct - cfg.guns.stingPerConnections * 1) / 100; // one point in Connections
  {
    // a day: build 4 (4 hours), two go to players at the door, two to the street (walk out, two sales, walk back)
    const built = 4;
    const toPlayers = 2;
    const toStreet = built - toPlayers;
    const gunBlock = blocksWith(map, 'gunBuyers').sort((a, b) => distance(map, home, a) - distance(map, home, b))[0];
    const walk = distance(map, home, gunBlock);
    const arrestCost = cfg.arrest.baseHours * 20 + gunStreet; // two hours gone and the gun in hand seized
    const net = Math.round(toPlayers * (gunPlayers - partsCost) + toStreet * ((1 - sting) * gunStreet - partsCost - sting * arrestCost));
    const hoursUsed = built + toStreet + 2 * walk;
    rows.push({
      cls: 'gunrunner', line: 'build guns, sell to players and the street', kind: 'trade', perDay: net, perHour: round1(net / H),
      how: `${built} guns from ${built * cfg.guns.partsPerGun} parts at $${u.parts}. ${toPlayers} to players at $${gunPlayers}, ${toStreet} at the ${gunBlock} for $${gunStreet} ` +
        `with a ${Math.round(sting * 100)}% sting each. ${hoursUsed} hours.`,
    });
    const grindNet = built * (fenceBuys(cfg, 'gun', gq) - cfg.guns.partsPerGun * fenceSells(cfg, 'parts'));
    rows.push({
      cls: 'gunrunner', line: 'safe grind: fence parts in, fence guns out', kind: 'grind', perDay: grindNet, perHour: round1(grindNet / H),
      how: `${built} guns at the fence's $${fenceBuys(cfg, 'gun', gq)}, parts at the fence's $${fenceSells(cfg, 'parts')}.`,
    });
  }
  {
    const parts = Math.min(smug0.chems, Math.floor(cfg.docks.parts.stock / 2));
    const { cost } = docksBuy(cfg, 'parts', parts, parts);
    notes.push(`A smuggler running parts instead: ${parts} a day sold at $${u.parts} is $${parts * u.parts - cost} a day, against $${smug0.net} for chems.`);
  }

  // ---- robber: what one attempt is worth
  const carriers = [
    { who: 'a dealer mid-shift', cash: Math.round(alone.cash / 2), lot: Math.floor(each / 2) * productPrice, lotFence: Math.floor(each / 2) * fenceBuys(cfg, 'product', quality) },
    { who: 'a smuggler walking a load', cash: 60, lot: Math.floor(smug0.chems / 2) * u.chems, lotFence: Math.floor(smug0.chems / 2) * fenceBuys(cfg, 'chems') },
    { who: 'someone carrying $100 and no goods', cash: 100, lot: 0, lotFence: 0 },
  ];
  const robEv = (P, target, own = 80) => {
    const b = bands(cfg, P);
    const resale = Math.round((target.lot * 0.75 + target.lotFence) / 2); // stolen goods sell between the fence's price and 75% of usual
    const clean = Math.round((target.cash * cfg.rob.cleanCashPct) / 100) + resale;
    const messy = Math.round((target.cash * cfg.rob.messyCashPct) / 100) - cfg.rob.messyClinic * cfg.clinic.perHour;
    const fail = -cfg.rob.failClinic * cfg.clinic.perHour;
    const disaster = -Math.round((own * cfg.arrest.finePct) / 100) - cfg.arrest.baseHours * 5;
    const ev = (b.clean * clean + b.messy * messy + b.fail * fail + b.disaster * disaster) / 100;
    const lost = (b.messy * cfg.rob.messyClinic + b.fail * cfg.rob.failClinic + b.disaster * cfg.arrest.baseHours) / 100;
    return { ...b, ev: Math.round(ev), lost: round1(lost), clean$: clean };
  };
  const robRows = [];
  for (const [label, P] of [['Ambush 2, bare hands', 60], ['Ambush 2 and a gun', 75], ['Ambush 2, a gun and a tip', 90]]) {
    for (const target of carriers) robRows.push({ label, target: target.who, ...robEv(P, target) });
  }
  {
    // a robber's day: each attempt costs the hour, the hours lost, about two hours finding the target and two lying low
    // (a robbery is 2 stars of heat and an arrest comes at 3). The targets are a mix: one juicy, one ordinary.
    for (const [P, label] of [[60, 'rob carriers, Ambush 2, bare hands'], [75, 'rob carriers, Ambush 2 and a gun']]) {
      const juicy = robEv(P, carriers[0]);
      const plain = robEv(P, carriers[1]);
      const ev = (juicy.ev + plain.ev) / 2;
      const lost = (juicy.lost + plain.lost) / 2;
      const attempts = H / (1 + lost + 4);
      rows.push({
        cls: 'robber', line: label, kind: 'trade', perDay: Math.round(attempts * ev), perHour: round1((attempts * ev) / H),
        how: `${round1(attempts)} attempts a day at P ${juicy.P} (clean ${juicy.clean}%, messy ${juicy.messy}%, fail ${juicy.fail}%, disaster ${juicy.disaster}%): ` +
          `half on a dealer mid-shift ($${juicy.ev} each), half on a smuggler with a load ($${plain.ev}). Each costs the hour, ${round1(lost)} hours lost, two finding the target and two lying low.`,
      });
    }
    rows.push({ cls: 'robber', line: 'safe grind: case and never rob', kind: 'grind', perDay: 0, perHour: 0, how: 'Casing pays nothing by itself.' });
  }

  // ---- muscle
  {
    const contractHours = 7;
    const net = contractHours * u.protectPerHour + (H - contractHours - 1) * cfg.floors.patrolPay;
    rows.push({
      cls: 'muscle', line: 'protect a client, patrol in between', kind: 'trade', perDay: net, perHour: round1(net / H),
      how: `${contractHours} hours under contract at $${u.protectPerHour}, ${H - contractHours - 1} on patrol at $${cfg.floors.patrolPay}, one walking. Collections (a ${cfg.collectFeePct}% fee) and bounties come on top.`,
    });
    const grind = (H - 1) * cfg.floors.patrolPay;
    rows.push({
      cls: 'muscle', line: 'safe grind: patrol for the shopkeepers', kind: 'grind', perDay: grind, perHour: round1(grind / H),
      how: `${H - 1} hours at $${cfg.floors.patrolPay}.`,
    });
  }

  // ---- informant
  {
    const watches = 8;
    const tips = watches * 2; // Eyes 1: two tips a watch
    const sold = 4;
    const net = sold * u.cashTip + 1 * cfg.floors.crimeTip;
    rows.push({
      cls: 'informant', line: 'watch, and sell tips to players', kind: 'trade', perDay: net, perHour: round1(net / H),
      how: `${watches} watches make ${tips} tips; ${sold} sell at $${u.cashTip} and one crime goes to the police for $${cfg.floors.crimeTip}. Selling one tip twice doubles it.`,
    });
    const grind = 2 * cfg.floors.crimeTip;
    rows.push({
      cls: 'informant', line: 'safe grind: only sell crimes to the police', kind: 'grind', perDay: grind, perHour: round1(grind / H),
      how: `About 2 crimes a day witnessed and unsold, at $${cfg.floors.crimeTip}. The police pay for each crime once.`,
    });
  }

  // ---- the city's books for one day at these volumes
  const chemBill = docksBuy(cfg, 'chems', 0, chemsIn).cost;
  const books = {
    streetTake,
    chemBill,
    chainNet: streetTake - chemBill,
    chainSeats: 5,
    rentNights: Array.from({ length: nights }, (_, i) => rentOn(cfg, i + 1)),
    seasonRent,
  };

  // ---- the five rules (SPEC section 7c)
  const trades = rows.filter(r => r.kind === 'trade');
  const grinds = rows.filter(r => r.kind === 'grind');
  const bestTrade = cls => Math.max(...trades.filter(r => r.cls === cls).map(r => r.perDay));
  const worstTrade = cls => Math.min(...trades.filter(r => r.cls === cls).map(r => r.perDay));
  const classes = [...new Set(rows.map(r => r.cls))];
  const lastRent = rentOn(cfg, nights);
  const courierDeal = each * productPrice; // a dealer's usual buy
  const hourOfWork = Math.round(dealerNet(second) / H);
  const rules = [
    {
      n: 1, text: `Every class's trade clears the dearest night's rent ($${lastRent}) with room to grow (at least twice over).`,
      ok: classes.every(c => worstTrade(c) >= 2 * lastRent),
      detail: classes.map(c => `${c} $${worstTrade(c)}`).join(', '),
    },
    {
      n: 2, text: 'Every deal between players beats the same deal with an NPC, for both sides.',
      ok: u.chems > fenceBuys(cfg, 'chems') && u.chems < fenceSells(cfg, 'chems')
        && u.parts > fenceBuys(cfg, 'parts') && u.parts < fenceSells(cfg, 'parts')
        && [1, 2, 3, 4, 5].every(q => usualProductPrice(cfg, q) > fenceBuys(cfg, 'product', q))
        && usualProductPrice(cfg, 1) < fenceSells(cfg, 'product')
        && u.gun > fenceBuys(cfg, 'gun', 1) && u.gun > gunStreet && u.gun < cfg.gunshop.price
        && u.protectPerHour > cfg.floors.patrolPay && u.crimeTip > cfg.floors.crimeTip,
      detail: `chems: fence pays $${fenceBuys(cfg, 'chems')}, players $${u.chems}, fence charges $${fenceSells(cfg, 'chems')}. ` +
        `q1 product: fence pays $${fenceBuys(cfg, 'product', 1)}, players $${usualProductPrice(cfg, 1)}, fence charges $${fenceSells(cfg, 'product')}. ` +
        `guns: fence pays $${fenceBuys(cfg, 'gun', 1)}, the street $${gunStreet}, players $${u.gun}, the shop charges $${cfg.gunshop.price}. ` +
        `guarding: shopkeepers $${cfg.floors.patrolPay} an hour, players $${u.protectPerHour}. crimes: police $${cfg.floors.crimeTip}, players $${u.crimeTip}.`,
    },
    {
      n: 3, text: "No class's safe grind pays more than half its trade.",
      ok: grinds.every(g => g.perDay * 2 <= worstTrade(g.cls)),
      detail: grinds.map(g => `${g.cls} grind $${g.perDay} against $${worstTrade(g.cls)}`).join(', '),
    },
    {
      n: 4, text: "A robbery of a typical carrier is worth more than an hour of the robber's next-best work.",
      ok: robRows.filter(r => r.target !== carriers[2].who).every(r => r.ev > cfg.floors.patrolPay * 2),
      detail: robRows.filter(r => r.target === carriers[0].who).map(r => `${r.label}: $${r.ev}`).join(', '),
    },
    {
      n: 5, text: 'The courier is worse than walking unless the walk costs more than two hours.',
      ok: courierFee(cfg, courierDeal) >= 2 * hourOfWork,
      detail: `The courier takes $${courierFee(cfg, courierDeal)} on a dealer's usual $${courierDeal} buy; an hour of a dealer's work is worth about $${hourOfWork}.`,
    },
  ];

  return { rows, robRows, books, rules, notes, quality, unitsOut, chemsIn, buyerBlocks, bestTrade };
}

/** PAYTABLE.md, as text. */
export function payTableMarkdown(cfg, map, stamp = '') {
  const t = payTable(cfg, map);
  const out = [];
  out.push('# The pay table');
  out.push('');
  out.push('Dollars an hour for every class, worked out from `src/config.mjs` by `node scripts/paytable.mjs`. Re-run it after every change to the numbers.');
  out.push('It is arithmetic, not a simulation: one agent of each class playing a plain, competent day, trading with the others at the usual prices.');
  if (stamp) out.push(`\n${stamp}`);
  out.push('');
  out.push('## What each class earns');
  out.push('');
  out.push('| Class | Line | A day | An hour | How |');
  out.push('|---|---|---:|---:|---|');
  for (const r of t.rows) out.push(`| ${r.cls} | ${r.kind === 'grind' ? '*' + r.line + '*' : r.line} | $${r.perDay} | $${r.perHour} | ${r.how} |`);
  out.push('');
  for (const n of t.notes) out.push(`- ${n}`);
  out.push('');
  out.push("## The city's books for one day");
  out.push('');
  out.push(`- Street buyers pay the two dealers **$${t.books.streetTake}** for ${t.unitsOut} units cooked from ${t.chemsIn} chems.`);
  out.push(`- The docks take **$${t.books.chemBill}** for the chems.`);
  out.push(`- That leaves **$${t.books.chainNet}** for the five chain seats, about $${Math.round(t.books.chainNet / t.books.chainSeats)} each. The robbers, the muscle and the informant live off it.`);
  out.push(`- Rent is $${t.books.rentNights.join(', $')} over the ${t.books.rentNights.length} nights: $${t.books.seasonRent} a seat for the season.`);
  out.push('');
  out.push('## What one robbery is worth');
  out.push('');
  out.push('| Robber | Target | P | Clean | Messy | Fail | Disaster | A clean win takes | Worth | Hours lost |');
  out.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of t.robRows) out.push(`| ${r.label} | ${r.target} | ${r.P} | ${r.clean}% | ${r.messy}% | ${r.fail}% | ${r.disaster}% | $${r.clean$} | $${r.ev} | ${r.lost} |`);
  out.push('');
  out.push('## The five rules');
  out.push('');
  for (const r of t.rules) out.push(`${r.n}. ${r.ok ? 'PASS' : '**FAIL**'}: ${r.text}\n   ${r.detail}`);
  out.push('');
  return out.join('\n');
}
