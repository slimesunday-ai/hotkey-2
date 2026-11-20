// WHAT'S AHEAD (tree-1; the owner ticked: "The 'what's ahead' screen: every punch style, gun, home piece and place, what
// it unlocks and where to get it"; a playtester: "we need a deeper tech tree / gun tree / fight tree / things you can do
// tree"). Plain data for one screen of the page (demo/run/ahead.js), read from the config and the state and NOTHING
// else: no second list that could drift. Read only: nothing here changes play, and step() never calls it.
//
// FOUR BRANCHES, each a small tree (a node, what hangs off it, and the place each is had at):
//   fight   what you fight with: bare hands at the root; each punch style of `styles` and each thing of `shop` that is
//           something to fight with (`duel.you`: the box cutter), and what they open (a job that `needs` one)
//   gear    what you keep and carry that changes a number: the rest of `shop` (the pocket, the bed), each thing of
//           `things` with a use that is not the home's (`does` and no `defends`: the skateboard), and each good of
//           `goods`, by the pack, with the selling jobs it opens
//   home    each thing of `things` that `defends` your crib, and the guard (`guard`, Cousin Earl), grouped by the
//           visitor they answer (`against`: a sneak, a crew, both), in the order the pressure brings them
//   places  your street at the root, each place one link from it (`links`), each route (`routes`), a locked place
//           last: what each pays, how dangerous it is, how you get there, and what is only had there
// No guns: there are none in the run's rules. The fight branch says so in one quiet line, nothing more.
//
// EVERY NODE: { id, branch, kind, key, name, price, priceText, parent, state, here, stateText, short, does, facts,
// opens, where, needs, got, choice, piece, library, map, goal, vs }. `state` is one of three:
//   owned   yours (a style you know, a thing you own, Earl on your step, goods on you or at home, the place you stand)
//   now     you can get it today: nothing stands in the way but going there and the money you have (carried and banked
//           together); `here` when it can be had where you stand, this minute (`choice`: the rules' own move and key)
//   later   something first: the money (`short`: how much more), or a reason in the rules' own words (`why`: a locked
//           place, a person against you, a connect sold out today)
//
// THE FIGHT'S NUMBERS (`vs`): what you win, in 10, against each way of fighting of the run (src/fight/data.mjs RIVALS)
// with each thing you could fight with, rested, against one as tough as most (config duel.foe.ordinary): the same
// sample the fight cards use (rules.mjs duelChance, cached). They cost a few hundred simulated fights each, so they are
// not worked out here: the page asks for them one at a time when it is idle (aheadCells, aheadCell) and hands what it
// has back in (`odds`); a node without them says its config words instead.

import { RIVALS } from '../fight/data.mjs';
import {
  placeOf, tierOf, homeId, homeStreet, peopleOf, guardOf, connectOf, connectFor, goodsOn, goodsHome, knows, armOf, armsOf,
  armLabel, taughtAt, fullEnergy, pressureOf, sixesOf, routesFrom, wayHours, canGo, toughnessOf, duelChance, styleOf,
  binsFinds, robOdds, supplyLeft, cap,
} from './rules.mjs';

const money = n => `$${n}`;
const range = ([lo, hi]) => (lo === hi ? money(lo) : `$${lo}–${hi}`);
const a = s => String(s ?? '').replace(/^the /, 'a ');
const noArticle = s => String(s ?? '').replace(/^(a pair of|an?|the) /i, '');
const Name = s => cap(noArticle(s));
const in10 = p => Math.round(p / 10);
const sum = (o = {}) => Object.values(o).reduce((x, n) => x + (n > 0 ? n : 0), 0);

/** Where somebody stands to sell or teach, in words: "by the pier", "at his truck" (the config's spot, their pronoun). */
const SPOT_AT = { pier: 'by the pier', crowd: 'in the crowd', 'back-row': 'in the back row', step: 'on your step' };
const SPOT_WORD = { 'yard-sale': 'yard sale', 'kitchen-window': 'kitchen window', 'clothes-rail': 'clothes rail' };
function spotWords(spot, pronoun) {
  if (!spot) return null;
  if (SPOT_AT[spot]) return SPOT_AT[spot];
  const word = SPOT_WORD[spot] ?? (String(spot).startsWith('stall') ? 'stall' : String(spot).replace(/[-:]/g, ' ').replace(/\s*\d+$/, ''));
  return `at ${{ he: 'his', she: 'her' }[pronoun] ?? 'their'} ${word}`;
}
const personAt = (cfg, place, id) => (placeOf(cfg, place).people ?? []).find(p => p.id === id) ?? null;
const whereOf = (cfg, place) => placeOf(cfg, place).where ?? `at ${placeOf(cfg, place).label}`;

/**
 * Where a thing is had: { place, placeLabel, who, at, pays, text }. `verb` what the person does ('sells it', 'teaches
 * it'); `pays` where the money comes from ('carried' on the street, 'banked' at the crib).
 */
function whereHad(cfg, place, keeperId, spot, verb, pays = 'carried') {
  const p = personAt(cfg, place, keeperId);
  const at = spotWords(spot, p?.pronoun);
  const crib = !!placeOf(cfg, place).home;
  const text = crib ? `At ${placeOf(cfg, place).label}, from banked money`
    : `${p ? `${cap(p.name)} ${verb}` : cap(verb)}${at ? ` ${at}` : ''}, ${whereOf(cfg, place)}`;
  return { place, placeLabel: placeOf(cfg, place).label, who: p ? { id: p.id, name: p.name } : null, at, pays, text: `${text}.`, payText: pays === 'banked' ? 'from banked money' : 'from what you carry, no hour' };
}

/** The rules' own move for it where you stand now, if there is one: { key, available, why, label }. */
function choiceFor(choices, test) {
  const c = (choices ?? []).find(x => test(x.choice ?? {}));
  return c ? { key: c.key, available: !!c.available, why: c.why ?? null, label: c.label, choice: { ...c.choice } } : null;
}

/** The three states, from what stands in the way: owned; now (here: the move is open where you stand); later. */
function stateOf({ owned = false, price = 0, have, why = null, here = false }) {
  if (owned) return { state: 'owned', here: false, toGo: 0, why: null };
  if (why) return { state: 'later', here: false, toGo: 0, why };
  const toGo = Math.max(0, (price ?? 0) - have);
  if (toGo) return { state: 'later', here: false, toGo, why: null };
  return { state: 'now', here: !!here, toGo: 0, why: null };
}
/** The state as the node says it in a word or three. */
function stateText(n, cfg) {
  if (n.state === 'owned') return n.ownedText ?? 'yours';
  if (n.why) return n.why;
  if (n.toGo) return `${money(n.toGo)} to go`;
  if (n.here) return n.kind === 'place' ? 'you are here' : 'here, now';
  if (n.sayNow) return n.sayNow;
  return n.where ? whereOf(cfg, n.where.place) : 'within reach';
}

// ── who fights each way: the run's one-on-ones ────────────────────────────────────────────────────────────────────────
/**
 * For each way of fighting (RIVALS), who of the run fights you that way, one-on-one: the people of a job that is a fight
 * when it goes wrong (`fight: 'fail'`, by its role), the regulars at your door when the door is a fight, and somebody
 * sent to your door (config duel.sent). → { style: [{ name, what }] }
 */
export function whoFights(cfg) {
  const out = Object.fromEntries(Object.keys(RIVALS).map(s => [s, []]));
  for (const [pl, P] of Object.entries(cfg.places)) {
    if (P.locked) continue;
    for (const j of Object.values(P.jobs ?? {})) {
      if (j.fight !== 'fail') continue;
      for (const p of (P.people ?? []).filter(x => x.role === j.role)) {
        out[styleOf(cfg, p)]?.push({ name: p.name, place: pl, what: `${j.label.toLowerCase()} goes wrong` });
      }
    }
    if (cfg.duel?.door) for (const p of (P.people ?? []).filter(x => x.regular)) out[styleOf(cfg, p)]?.push({ name: p.name, place: pl, what: 'you shut your door on them' });
  }
  for (const s of cfg.duel?.sent?.styles ?? []) out[s]?.push({ name: 'somebody sent to your door', place: null, what: 'a visit comes due' });
  return out;
}

// ── the fight's numbers, asked one at a time by the page ──────────────────────────────────────────────────────────────
/** What you could fight with, in the tree's order: bare hands, each punch style, then each thing of the shop to fight with. */
export const fightArms = cfg => ['hands', ...Object.keys(cfg.styles ?? {}).filter(s => cfg.duel?.you?.[s]), ...Object.keys(cfg.shop ?? {}).filter(k => cfg.duel?.you?.[k])];
/** The key a fight's number is kept under: your rested energy (a bed changes it), what you fight with, their way. */
export const oddsKey = (cfg, state, arm, style) => `${fullEnergy(cfg, state)}|${arm}|${style}`;
/** Every number the fight branch shows: [{ key, arm, style }]. */
export const aheadCells = (cfg, state) => (cfg.duel ? fightArms(cfg).flatMap(arm => Object.keys(RIVALS).map(style => ({ key: oddsKey(cfg, state, arm, style), arm, style }))) : []);
/**
 * One of them: the percent you win, rested, with `arm` against one who fights `style` and is as tough as most (the
 * config's ordinary toughness). The fight cards' own sample (rules.mjs duelChance), so the same fight says the same.
 */
export function aheadCell(cfg, state, arm, style) {
  const who = { id: `ahead:${style}`, name: RIVALS[style].name, role: null, style };
  const plus = cfg.duel.foe.ordinary - toughnessOf(cfg, who);
  return duelChance(cfg, state, who, fullEnergy(cfg, state), plus, { arm }).pct;
}

// ── the tree ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The tree for `state`. `choices`: the view's (listChoices), for what can be had where you stand now. `odds`: the fight
 * numbers the page has so far ({ [oddsKey]: pct }), or none.
 */
export function aheadOf(cfg, state, choices = [], odds = null) {
  const have = (state.carried ?? 0) + (state.banked ?? 0);
  const nodes = {};
  const add = n => {
    if (nodes[n.id]) throw new Error(`ahead: two nodes ${n.id}`);
    Object.assign(n, n.forceState ?? stateOf({ owned: n.owned, price: n.price, have, why: n.why, here: !!n.choice }));
    delete n.forceState;
    n.stateText = stateText(n, cfg);
    nodes[n.id] = n;
    return n.id;
  };
  const crib = homeId(cfg);
  const street = homeStreet(cfg);
  const placeNode = pl => (placeOf(cfg, pl).home ? `place:${street}` : `place:${pl}`);

  // ── FIGHT ──
  const fights = whoFights(cfg);
  const arms = fightArms(cfg);
  const own = new Set(armsOf(cfg, state));
  const now = armOf(cfg, state);
  const oddsOf = (arm, style) => odds?.[oddsKey(cfg, state, arm, style)] ?? null;
  const vsOf = arm => Object.entries(RIVALS).map(([style, R]) => ({
    style, name: a(R.name), says: R.says, who: fights[style] ?? [], pct: oddsOf(arm, style), hands: oddsOf('hands', style),
  }));
  const fightShort = (arm, vs, fallback) => {
    if (vs.some(x => x.pct === null || x.hands === null)) return fallback;
    if (arm === 'hands') {
      const worst = vs.reduce((p, x) => (x.pct < p.pct ? x : p));
      return `weakest vs ${worst.name}: ${in10(worst.pct)} in 10`;
    }
    // (the two ways of fighting it helps most against, by what it wins over bare hands: both named, so a style the config's
    // words call the answer to one is never hidden behind a close second; each also marked `best` for the card's table)
    const best = vs.slice().sort((x, y) => y.pct - y.hands - (x.pct - x.hands) || y.pct - x.pct).slice(0, 2).filter(x => x.pct > x.hands);
    for (const x of best) x.best = true;
    if (!best.length) return fallback;
    return `best vs ${best.map(x => x.name).join(' and ')}: wins ${best.map(x => in10(x.pct)).join(' and ')} in 10 (bare hands: ${best.map(x => in10(x.hands)).join(' and ')})`;
  };
  const fightGroup = [];
  for (const arm of arms) {
    const A = cfg.duel.you[arm];
    const vs = vsOf(arm);
    const fw = choiceFor(choices, c => c.do === 'fightWith' && c.with === arm);
    const base = { branch: 'fight', key: arm, vs, fightWith: own.has(arm) && arms.length > 1 ? { chosen: now === arm, choice: fw } : null, ownedText: now === arm ? 'yours · fighting with it' : 'yours' };
    if (arm === 'hands') {
      fightGroup.push(add({ ...base, id: 'arm:hands', kind: 'arm', name: cap(A.label), price: null, priceText: '', parent: null, owned: true,
        short: fightShort(arm, vs, 'what you start with'), does: 'What you were born with: what you fight with until you learn or buy something better.', facts: [], opens: [], where: null, needs: [] }));
    } else if (cfg.styles?.[arm]) {
      const S = cfg.styles[arm];
      const t = taughtAt(cfg, arm);
      const where = whereHad(cfg, S.at, S.keeper, S.spot, 'teaches it');
      fightGroup.push(add({ ...base, id: `style:${arm}`, kind: 'style', name: cap(S.label), price: S.price, priceText: money(S.price), parent: 'arm:hands', owned: knows(state, arm),
        short: fightShort(arm, vs, S.does.split(/[.:]/)[0]), does: S.does, facts: [`Learned once and kept, ${where.payText}.`], opens: [], where, needs: [placeNode(S.at)],
        choice: choiceFor(choices, c => c.do === 'learn' && c.style === arm), teacher: t.keeper }));
    } else if (cfg.shop?.[arm]) {
      const it = cfg.shop[arm];
      const opens = opensBy(cfg, state, arm);
      const where = whereHad(cfg, crib, null, null, 'sold', 'banked');
      fightGroup.push(add({ ...base, id: `shop:${arm}`, kind: 'shop', name: Name(it.label), price: it.price, priceText: money(it.price), parent: 'arm:hands', owned: !!state.owned?.[arm],
        short: opens.length ? `opens ${[...new Set(opens.slice().reverse().map(o => o.short))].join(' and ')}` : fightShort(arm, vs, it.does), does: `${it.does}.`, facts: [`A blade in a one-on-one. Kept for the run.`], opens, where, needs: [placeNode(crib)],
        choice: choiceFor(choices, c => c.do === 'buy' && c.item === arm), goal: true }));
    }
  }

  // ── GEAR ──
  const kept = [];
  for (const [k, it] of Object.entries(cfg.shop ?? {})) {
    if (cfg.duel?.you?.[k]) continue;
    const where = whereHad(cfg, crib, null, null, 'sold', 'banked');
    kept.push(add({ id: `shop:${k}`, branch: 'gear', kind: 'shop', key: k, name: Name(it.label), price: it.price, priceText: money(it.price), parent: null, owned: !!state.owned?.[k],
      short: shopShort(cfg, k, it), does: `${it.does}.`, facts: shopFacts(cfg, k), opens: [], where, needs: [placeNode(crib)],
      choice: choiceFor(choices, c => c.do === 'buy' && c.item === k), goal: true }));
  }
  for (const [k, t] of Object.entries(cfg.things ?? {})) {
    if (!t.does || t.defends) continue;
    const opens = opensBy(cfg, state, k);
    const locked = placeOf(cfg, t.at).locked;
    const where = whereHad(cfg, t.at, t.keeper, t.spot, 'sells it');
    kept.push(add({ id: `thing:${k}`, branch: 'gear', kind: 'thing', key: k, name: Name(t.label), price: t.price, priceText: money(t.price), parent: null, owned: !!state.things?.[k],
      why: locked ? `${placeOf(cfg, t.at).label}: ${locked}` : null,
      short: opens.length ? `opens ${opens.map(o => o.short).join(', ')}` : t.does, does: `${t.does}.`, facts: ['Kept for the run.'], opens, where, needs: [placeNode(t.at)],
      choice: choiceFor(choices, c => c.do === 'get' && c.item === k), piece: t.piece ?? null, library: t.piece ? k : null }));
  }
  const goods = [];
  for (const [g, G] of Object.entries(cfg.goods ?? {})) {
    // (pot-1: the goods bought from a connect; what you make is the view's `make`, the Make tree's for the screens)
    if (G.made || G.making) continue;
    const c = connectFor(cfg, g);
    const cn = connectOf(cfg, state, c.place);
    const opens = sellsOf(cfg, g);
    const n = goodsOn(state, g) + goodsHome(state, g);
    const where = whereHad(cfg, c.place, c.who?.id, cfg.places[c.place]?.connect?.spot, 'sells it');
    goods.push(add({ id: `good:${g}`, branch: 'gear', kind: 'good', key: g, name: cap(G.pack.replace(/^an? /, '')), price: G.price, priceText: `${money(G.price)} a pack`, parent: null,
      owned: n > 0, ownedText: `${goodsOn(state, g)} on you · ${goodsHome(state, g)} at home`,
      why: cn && !cn.sells ? cn.why : null,
      short: `${G.sales} sales · opens ${opens.length} selling job${opens.length === 1 ? '' : 's'}`,
      does: `${cap(G.pack)}: ${G.sales} sales of ${G.label}, ${money(Math.round(G.price / G.sales))} a sale. A selling job is only dealt with some on you.`,
      facts: [`At most ${G.perDay} packs a day from ${c.who?.name ?? 'the connect'}.`, `With you (trust), ${cfg.connect.withOffPct}% off; against you, ${c.who?.name ?? 'they'} won't sell.`, 'On you they are at risk like cash: a jump takes them, a police stop takes them all. Left at your crib, safe.'],
      opens, where, needs: [placeNode(c.place)], choice: choiceFor(choices, x => x.do === 'pack' && x.good === g) }));
  }

  // ── HOME ──
  const P = cfg.pressure;
  const pv = pressureOf(cfg, state);
  const visitors = [
    { id: 'sneak', label: 'Against a sneak', short: P ? `pressure ${P.warnAt}+` : null, note: P ? `From home pressure ${P.warnAt}, somebody may be seen casing your crib: the next day a sneak tries it while you are out. Nothing on your side, they get in ${cfg.raid.pct}% of the time and take ${cfg.raid.share}% of what you banked (never goods or things). Home in time, you meet them at the door.` : null },
    { id: 'both', label: 'Against both', short: null, note: 'A sneak by day and a crew after dark: these answer either.' },
    { id: 'crew', label: 'Against a crew', short: cfg.crew ? `pressure ${cfg.crew.at}+` : null, note: cfg.crew ? `From home pressure ${cfg.crew.at}, it is a crew of two heavies instead, after dark. Home that night, a fight at your door; out for the night, they kick it in (${cfg.crew.kickPct}% of the time) and take ${cfg.crew.share}% of what you banked.` : null },
    // (raid-1) the Sixes' raid on your home: the guns and the raid's pieces
    ...(cfg.sixesRaid && cfg.sixes ? [{ id: 'sixes', label: 'Against the Sixes', short: `their meter ${cfg.sixes.raid}`, note: `From ${cfg.sixes.raid} on the Sixes' meter, two to five of them (more when your home is worth more) come for your crib at night. Home, you meet them with what you hold and every piece does its job; out, your door decides it.` }] : []),
  ];
  // (raid-1: a piece that answers the Sixes and not both a sneak and a crew is theirs)
  const kindOf = against => (against?.includes('sneak') && against?.includes('crew') ? 'both' : against?.includes('sixes') ? 'sixes' : against?.includes('crew') ? 'crew' : 'sneak');
  const homeBy = Object.fromEntries(visitors.map(x => [x.id, []]));
  const homeThings = Object.entries(cfg.things ?? {}).filter(([, t]) => t.defends).sort(([, x], [, y]) => x.price - y.price);
  for (const [k, t] of homeThings) {
    const locked = placeOf(cfg, t.at).locked;
    const where = whereHad(cfg, t.at, t.keeper, t.spot, 'sells it');
    const facts = [t.job ? `${t.job}.` : null, k === 'dog' && cfg.dog ? `Fed ${money(cfg.dog.feed)} every morning from banked; ${cfg.dog.hungryDays} days unfed and it guards nothing.` : null, `Stands in the trailer${t.inTrailer ? ` (${String(t.inTrailer).replace(/-/g, ' ')})` : ''}.`].filter(Boolean);
    homeBy[kindOf(t.against)].push(add({ id: `thing:${k}`, branch: 'home', kind: 'thing', key: k, name: Name(t.label), price: t.price, priceText: k === 'dog' && cfg.dog ? `${money(t.price)} + ${money(cfg.dog.feed)}/day` : money(t.price), parent: null,
      owned: !!state.things?.[k], why: locked ? `${placeOf(cfg, t.at).label}: ${locked}` : null,
      short: t.gun ? `held at your door: ${t.does.toLowerCase()}` : defendsShort(cfg, t.defends), does: `${t.does}.`, facts: t.gun ? [...facts, `Rounds: ${t.ammo.label}, $${t.ammo.price}, from the same seller. Firing it: heat +${t.loud}.`] : facts, opens: [], against: [...(t.against ?? [])], where, needs: [placeNode(t.at)],
      choice: choiceFor(choices, c => c.do === 'get' && c.item === k), piece: t.piece ?? null, library: t.piece ? k : null }));
  }
  const g = guardOf(cfg, state);
  if (cfg.guard) {
    const G = cfg.guard;
    const who = personAt(cfg, street, G.who);
    const where = { ...whereHad(cfg, crib, null, null, 'hired', 'banked'), who: who ? { id: who.id, name: who.name } : null };
    where.text = `Hired at ${placeOf(cfg, crib).label}, from banked money: ${G.label ?? 'he watches your door'}.`;
    const beaten = g?.beatenPct ?? null;
    homeBy[cfg.crew ? 'both' : 'sneak'].push(add({ id: 'guard', branch: 'home', kind: 'guard', key: G.who, name: cap(who?.name ?? 'the guard'), price: G.price, priceText: `${money(G.price)} / ${G.days} days`, parent: null,
      owned: !!g?.on, ownedText: g?.on ? (g.lastDay ? 'on your step: his last day' : `on your step through day ${g.until}`) : 'yours',
      why: g?.why ?? null,
      short: beaten !== null ? `on your step: sees a sneak off ${100 - beaten}%` : 'watches your door',
      does: `A person, not a thing: ${cap(who?.name ?? 'he')} parks his truck by your door for ${G.days} days.`,
      facts: [beaten !== null ? `Whoever tries your door has to get past him first: they beat him ${beaten}% of the time (beaten, he is off ${G.hurtDays} days and the rest of his days are lost).` : null,
        cfg.crew ? `When a crew comes and you are home, he fights beside you at your door (tell him how: front, hunt or block); down, he is off ${G.doorHurtDays ?? 1} day.` : null,
        `${money(G.price)} for ${G.days} days, paid up front; on his last day you can keep him on. Against you, he won't take the job.`].filter(Boolean),
      opens: [], against: cfg.crew ? ['sneak', 'crew'] : ['sneak'], where, needs: [placeNode(crib)], choice: choiceFor(choices, c => c.do === 'guard') }));
  }

  // ── PLACES ──
  const placeIds = [];
  const atOf = pl => (pl === crib ? street : pl);
  const gotAt = pl => Object.values(nodes).filter(n => n.kind !== 'place' && n.kind !== 'route' && n.where && atOf(n.where.place) === pl).map(n => n.id);
  const streetId = add(placeEntry(cfg, state, street, { root: true, here: atOf(state.place) === street || placeOf(cfg, state.place).inside === street }));
  placeIds.push(streetId);
  const links = Object.entries(placeOf(cfg, street).links ?? {}).sort(([x], [y]) => Number(!!placeOf(cfg, x).locked) - Number(!!placeOf(cfg, y).locked));
  for (const [pl, link] of links) {
    placeIds.push(add(placeEntry(cfg, state, pl, { parent: streetId, link, here: state.place === pl })));
    for (const r of routesFrom(cfg, street).filter(r => r.to === pl)) placeIds.push(add(routeEntry(cfg, state, r, streetId)));
  }
  for (const id of placeIds) nodes[id].got = gotAt(nodes[id].key);
  // (what the Sixes' ground means to you: on the place's node)
  const sx = sixesOf(cfg, state);
  for (const pl of cfg.sixes?.ground ?? []) {
    const n = nodes[`place:${pl}`];
    if (!n || !sx) continue;
    const X = cfg.sixes;
    n.facts.push(`The Sixes' ground (their meter ${sx.value} of ${sx.max}): selling here +${X.raise.sell} once a day, a till or a stick-up +${X.raise.grab}. At ${X.word} Dutch has a word; at ${X.tax}, the tax (${X.taxPct}% of what you made here); at ${X.jump}, two of them on the kerb.`);
  }

  // ── the branches, the next thing, the counts ──
  const ids = list => list.filter(Boolean);
  const branches = [
    { id: 'fight', label: 'Fight', icon: 'fight', note: 'What you fight with, one-on-one and jumped (E changes it).',
      groups: [{ id: 'arms', label: null, nodes: ids(fightGroup) }], quiet: cfg.sixesRaid ? 'Guns: never in a one-on-one. They are held at your door when the Sixes come (Home).' : 'Guns: not in the run yet.' },
    { id: 'gear', label: 'Gear', icon: 'goods', note: 'Kept for the run, or carried to sell.',
      groups: [{ id: 'kept', label: 'Kept for the run', nodes: kept }, { id: 'goods', label: 'Goods, by the pack', nodes: goods }] },
    { id: 'home', label: 'Home', icon: 'home', note: pv && P ? `Home pressure now ${pv.value} of ${pv.max}: visitors from ${P.warnAt}.` : null,
      groups: visitors.map(x => ({ id: x.id, label: x.label, short: x.short, note: x.note, nodes: homeBy[x.id] })).filter(x => x.nodes.length) },
    { id: 'places', label: 'Places', icon: 'map', note: 'Each one ride from your street.',
      groups: [{ id: 'places', label: null, nodes: placeIds }] },
  ];
  for (const b of branches) {
    const all = b.groups.flatMap(x => x.nodes).map(id => nodes[id]);
    const counted = all.filter(n => n.kind !== 'place' && n.kind !== 'route' && n.kind !== 'good');
    b.count = b.id === 'places' ? { owned: all.filter(n => n.state !== 'later').length, of: all.length, word: 'open' } : { owned: counted.filter(n => n.state === 'owned').length, of: counted.length, word: 'yours' };
  }
  const order = branches.flatMap(b => b.groups.flatMap(x => x.nodes));
  const wants = order.map(id => nodes[id]).filter(n => n.state !== 'owned' && n.price && !['good', 'place', 'route'].includes(n.kind));
  const reach = wants.filter(n => n.state === 'now').sort((x, y) => Number(y.here) - Number(x.here) || x.price - y.price)[0] ?? null;
  const near = wants.filter(n => n.toGo).sort((x, y) => x.toGo - y.toGo)[0] ?? null;
  const next = reach ? { id: reach.id, now: true, text: `Within reach: ${reach.name}, ${reach.priceText}${reach.here ? ', here' : reach.where ? `, ${whereOf(cfg, reach.where.place)}` : ''}.` }
    : near ? { id: near.id, now: false, text: `Nearest: ${near.name}, ${money(near.toGo)} to go.` } : null;
  return { have, carried: state.carried ?? 0, banked: state.banked ?? 0, branches, nodes, order, next };
}

/** What a thing opens: the jobs that need it (a place's `needs`), robbing somebody passing (street.rob.needs), a way. */
function opensBy(cfg, state, key) {
  const out = [];
  for (const [pl, P] of Object.entries(cfg.places)) {
    if (P.locked) continue;
    for (const [id, j] of Object.entries(P.jobs ?? {})) if (j.needs === key) out.push({ kind: 'job', place: pl, id, text: `${j.label}, ${whereOf(cfg, pl)}: ${j.odds}% for ${range(j.pay)}`, short: j.label.toLowerCase() });
  }
  if (cfg.street?.rob?.needs === key) {
    const at = Object.entries(cfg.places).filter(([, P]) => !P.locked && P.supply?.[cfg.street.rob.draws]).map(([pl]) => pl);
    if (at.length) {
      const o = robOdds(cfg, { ...state, placeHeat: {}, energy: cfg.energy.mattress }, at[0]);
      out.push({ kind: 'rob', places: at, text: `${cfg.street.rob.label}, ${at.map(pl => noArticle(placeOf(cfg, pl).label)).join(', ')}: ${o.pct}% on a cool street, ${at.map(pl => range(robOdds(cfg, { ...state, placeHeat: {} }, pl).pay)).join(' / ')}; heat +${cfg.street.rob.winHeat}`, short: 'robbing' });
    }
  }
  for (const [w, W] of Object.entries(cfg.ways ?? {})) {
    if (W.needs !== key) continue;
    for (const [rid, r] of Object.entries(cfg.routes ?? {})) {
      const foot = Object.entries(cfg.ways).find(([, x]) => !x.needs);
      const fh = foot ? wayHours(cfg, foot[0], r.stops.length) : null;
      out.push({ kind: 'way', route: rid, text: `${W.label} ${r.label}: ${wayHours(cfg, w, r.stops.length)} hour${wayHours(cfg, w, r.stops.length) > 1 ? 's' : ''}, energy ${W.energy}${foot ? ` (on foot ${fh} hours, energy ${foot[1].energy})` : ''}`, short: `${W.label.toLowerCase()} ${r.label}`.replace(/^(\w+?)e? the /, '$1ing the ') });
    }
  }
  return out;
}
/** Where a good sells: each place's job and each stop's card that takes it, with what it pays there. */
function sellsOf(cfg, g) {
  const out = [];
  for (const [pl, P] of Object.entries(cfg.places)) {
    if (P.locked) continue;
    for (const [id, j] of Object.entries(P.jobs ?? {})) if (j.goods?.[g]) out.push({ kind: 'job', place: pl, id, text: `${j.label}, ${whereOf(cfg, pl)}: ${j.odds}% for ${range(j.goodsPay[g])} a sale`, short: noArticle(placeOf(cfg, pl).label) });
  }
  for (const [st, S] of Object.entries(cfg.stops ?? {})) {
    for (const [id, c] of Object.entries(S.cards ?? {})) if (c.goods?.[g]) out.push({ kind: 'card', stop: st, id, text: `${c.label}, on the walk: ${c.odds}% for ${range(c.goodsPay?.[g] ?? c.pay)} a sale`, short: S.label });
  }
  return out;
}
function shopShort(cfg, k, it) {
  if (k === 'bed') return `energy ${cfg.energy.bed} a day, not ${cfg.energy.mattress}`;
  if (k === 'pocket') return `a jump finds ${cfg.jump.pocketFinds}% of your cash`;
  return it.does;
}
function shopFacts(cfg, k) {
  if (k === 'bed') return [`${cfg.energy.bed - cfg.energy.mattress} more hours a day: every hour out costs energy ${cfg.energy.perHour}.`, 'Kept for the run.'];
  if (k === 'pocket') return ['It hides cash, not goods.', 'Kept for the run.'];
  return ['Kept for the run.'];
}
/** A home piece's one job in a line, from its numbers (config `defends`, against the raid's, the crew's). */
function defendsShort(cfg, d = {}) {
  const parts = [];
  if (d.pct != null) parts.push(`a sneak gets in ${d.pct}%, not ${cfg.raid.pct}%`);
  if (d.share != null) parts.push(`a sneak takes ${d.share}%, not ${cfg.raid.share}%`);
  if (d.bar != null) parts.push(`the first one through −${d.bar} health`);
  if (d.sneakOff != null) parts.push(`a sneak gives up ${d.sneakOff}%`);
  if (d.lead != null) parts.push(`warned ${d.lead} day${d.lead > 1 ? 's' : ''} sooner`);
  if (d.warn != null) parts.push(`−${d.warn} points a sneak cases you`);
  if (!parts.length && d.kick != null) parts.push(`a crew's kick ${d.kick}%`);
  // (raid-1)
  if (d.blind != null) parts.push(`they come in blind ${d.blind} s`);
  if (d.cut != null) parts.push(`every hit on you −${d.cut}%`);
  if (d.stash != null) parts.push(`$${d.stash} never found`);
  if (d.hideGoods != null) parts.push('goods and two guns never found');
  if (d.quiet != null) parts.push(`gunfire heat −${d.quiet}%`);
  if (d.decoy != null) parts.push(`beaten at home, they take ${d.decoy}% less`);
  return parts.join('; ');
}

/** A place: its tier in plain words and numbers, its jobs' pay, how you get there, what you need. */
function placeEntry(cfg, state, pl, { root = false, parent = null, link = null, here = false }) {
  const P = placeOf(cfg, pl);
  const T = tierOf(cfg, pl);
  const jobs = Object.entries(P.jobs ?? {}).map(([id, j]) => ({ id, label: j.label, pay: j.pay, odds: j.odds, needs: j.needs ?? null, goods: j.goods ? Object.keys(j.goods) : null, fight: j.fight === 'fail' }));
  const pays = jobs.length ? [Math.min(...jobs.map(j => j.pay[0])), Math.max(...jobs.map(j => j.pay[1]))] : null;
  const park = tierOf(cfg, homeStreet(cfg))?.pay ?? 1;
  const danger = !T ? null : [
    T.pay !== park ? `pays ${+(T.pay / park).toFixed(2)}× your street` : 'pays as your street',
    !T.jump ? 'nobody jumps you' : T.jump < 1 ? `jumped seldom (${T.jump}× as often)` : `you can be jumped${T.jump > 1 ? ` ${T.jump}× as often` : ''}${T.strength ? `, by tougher people (+${T.strength})` : ''}`,
    T.patrol ? `the police patrol${T.police > 1 ? ` (a stop ${T.police}× as likely)` : ''}` : 'the police only once it is hot',
  ];
  const s = cfg.subway;
  const ride = link?.via === 'subway' ? `One subway ride from ${placeOf(cfg, homeStreet(cfg)).label}: ${money(s.fare)} (or hop the turnstile, ${s.hopCaughtPct}% seen: heat +${s.hopHeat}), ${s.hours} hour, energy ${cfg.energy.perHour}; you need energy ${cfg.energy.perHour + cfg.energy.rideBack} to get there and back.` : null;
  const extra = [];
  if (P.supply?.[cfg.street?.rob?.draws]) extra.push(`Somebody passing to rob (with ${cfg.shop?.[cfg.street.rob.needs]?.label?.toLowerCase() ?? 'a blade'}): ${range(robOdds(cfg, { ...state, placeHeat: {} }, pl).pay)}.`);
  if (P.supply?.[cfg.street?.bins?.draws]) extra.push(`Bins: ${binsFinds(cfg, pl).map(f => `${f.pct}% ${range(f.pay)}`).join(', ')}.`);
  const sold = [...(P.shop ?? []).map(it => `${it.label} ${money(it.price)} (${it.does.toLowerCase()})`)];
  const locked = P.locked ?? null;
  const cosmetic = Object.values(cfg.things ?? {}).filter(t => t.at === pl && !t.does);
  return {
    id: `place:${pl}`, branch: 'places', kind: 'place', key: pl, name: Name(P.label), price: null, priceText: '', parent: root ? null : parent,
    owned: false, forceState: locked ? { state: 'later', here: false, toGo: 0, why: `locked: ${locked}` } : { state: 'now', here, toGo: 0, why: null }, sayNow: root ? 'your street' : link?.via === 'subway' ? 'one ride' : 'open',
    ownedText: null,
    short: locked ? `locked: ${locked}` : [pays ? `pays ${range(pays)}` : null, !T ? null : T.police >= 1.5 ? `police ×${T.police}` : !T.jump ? 'safe' : `jumpers${T.jump !== 1 ? ` ×${T.jump}` : ''}${T.strength ? ', tougher' : ''}`].filter(Boolean).join(', '),
    does: locked ? `${cap(P.label)} is ${locked}: nothing can be done there yet.` : root ? `Your street: your crib's door opens onto it. ${T ? `Quiet: ${danger.join(', ')}.` : ''}` : `${cap(P.label)}: ${danger.join(', ')}.`,
    tier: P.tier ?? null, danger, jobs, pays,
    facts: [...(locked ? (cosmetic.length ? [`Sold there later (looks only): ${cosmetic.map(t => `${noArticle(t.label)} ${money(t.price)}`).join(', ')}.`] : []) : extra), ...(sold.length && !locked ? [`Food here: ${sold.join('; ')}.`] : [])],
    opens: [], where: { place: pl, placeLabel: P.label, who: null, at: null, pays: null, text: root ? 'You live here.' : locked ? `Locked: ${locked}.` : ride ?? `${cap(P.label)}.` }, needs: root ? [] : [parent],
    got: [], choice: null, map: (cfg.subwayStops ?? []).includes(pl) ? pl : null, people: (P.people ?? []).length,
  };
}
/** A route: its stops' cards, how long each way takes, the way that needs a thing. */
function routeEntry(cfg, state, r, parent) {
  const R = cfg.routes[r.id];
  const ways = Object.entries(cfg.ways ?? {}).map(([w, W]) => ({ way: w, label: W.label, hours: wayHours(cfg, w, r.stops.length), energy: W.energy, needs: W.needs ?? null, can: canGo(cfg, state, w) }));
  const cards = r.stops.flatMap(st => Object.entries(placeOf(cfg, st).cards ?? {}).map(([id, c]) => ({ stop: st, id, label: c.label, odds: c.street ? null : c.odds, pay: c.pay ?? null, heat: c.winHeat ?? 0 })));
  const foot = ways.find(w => !w.needs);
  return {
    id: `route:${r.id}`, branch: 'places', kind: 'route', key: r.id, name: Name(R.label), price: null, priceText: '', parent, owned: false,
    forceState: { state: 'now', here: false, toGo: 0, why: null }, sayNow: 'on foot, no fare',
    short: `${foot ? `${foot.hours} hours on foot, ` : ''}no fare, ${cards.length} cards`,
    does: `A way on foot between ${R.between.map(p => placeOf(cfg, p).label).join(' and ')}, no fare, passing ${r.stops.map(st => placeOf(cfg, st).label).join(', ')}: each stop deals a hand of cards to play or pass by.`,
    ways, cards, facts: ways.map(w => `${w.label}: ${w.hours} hour${w.hours > 1 ? 's' : ''}, energy ${w.energy}${w.needs ? ` (needs ${cfg.things?.[w.needs]?.label ?? w.needs})` : ''}.`),
    opens: [], where: { place: R.between[1], placeLabel: placeOf(cfg, R.between[1]).label, who: null, at: null, pays: null, text: `From ${R.between.map(p => placeOf(cfg, p).label).join(' or ')}: Travel (T).` },
    needs: [parent, ...ways.filter(w => w.needs).map(w => `thing:${w.needs}`)], got: [], choice: null, map: null,
  };
}
