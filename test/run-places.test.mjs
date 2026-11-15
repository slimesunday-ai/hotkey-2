// A place is data (RUN.md, "Adding a place"): a third place, the docks, written here as an entry in the config and
// nothing else, is played by the same rules as the trailer park and the flea market, and passes the same per-place
// checks. It is not in the real game.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rng, pick } from '../src/rng.mjs';
import { KINDS, ACTIONS } from '../src/stage.mjs';
import { CITY } from '../src/map.mjs';
import { RUN_CONFIG, withRunConfig, newRun, view, step, checkRunBooks, deal, danger } from '../src/run/index.mjs';
import { streetPlaces, robOdds, binsFinds } from '../src/run/rules.mjs';

// THE WHOLE OF THE DOCKS: what RUN.md's "Adding a place" says to write. A tier, its jobs (base pay, × the tier's),
// its people by role, what it has to use up, its shop, its links; and a link to it from the market.
const DOCKS = {
  label: 'the docks', where: 'on the docks', block: 'docks', spot: 'street', tier: 'mean', onlySafe: 'only the loading',
  links: { market: { via: 'subway' } },
  supply: { strangers: { max: 2, refill: 1 }, bins: { max: 2, refill: 1 } },
  shop: [],
  jobs: {
    load: { label: 'Load a truck', named: 'Load a truck for {who}', role: 'foreman', with: 'a foreman', safe: true, odds: 100, base: [10, 14], mood: { win: 'friendly' }, scene: { win: { action: 'carry' } } },
    crate: { label: 'Lift a crate', named: "Lift a crate off {who}'s truck", role: 'driver', with: 'a driver', odds: 50, base: [30, 50], failHeat: 2, mood: { win: 'unaware', fail: 'wary' }, scene: { win: { action: 'grab' }, fail: { action: 'grab' } } },
    sell: { label: 'Sell to the night shift', named: 'Sell to {who} on the night shift', role: 'buyer', with: 'the night shift', odds: 70, base: [15, 25], failHeat: 1, mood: { win: 'friendly', fail: 'wary' }, scene: { win: { kind: 'work:deal' }, fail: { kind: 'work:deal:dry' } } },
  },
  people: [
    { id: 'npc:foreman:docks', name: 'Mr. Haines', role: 'foreman' },
    { id: 'npc:foreman:docks:2', name: 'Rosa', role: 'foreman' },
    { id: 'npc:driver:docks', name: 'a driver', role: 'driver' },
    { id: 'npc:driver:docks:2', name: 'Big Lou', role: 'driver' },
    { id: 'npc:buyer:docks', name: 'Nails', role: 'buyer', regular: true },
  ],
};
const cfg = withRunConfig({ places: { docks: DOCKS, market: { links: { docks: { via: 'subway' } } } }, subwayStops: [...RUN_CONFIG.subwayStops, 'docks'] });
const CALM = withRunConfig({ jump: { basePct: 0, perHourPct: 0, perStepPct: 0 }, police: { perHeat: 0 } }, cfg);
const bytes = x => JSON.stringify(x);
const at = (place, extra = {}, seed = 1, c = cfg) => {
  const s = newRun({ seed, cfg: c });
  return { ...s, place, ...extra, owned: { ...s.owned, ...(extra.owned ?? {}) } };
};

test('places: the docks are added by data alone, priced by their tier, and leave the real game untouched', () => {
  assert.ok(!('docks' in RUN_CONFIG.places));
  assert.deepEqual(streetPlaces(cfg), ['park', 'market', 'docks']);
  // the tier sets the level: pay × 3, jumping × 1.5 and 10 stronger, the police 1.25 ×
  assert.deepEqual(cfg.jobs.docks.crate.pay, [90, 150]);
  assert.deepEqual(cfg.places.docks.jobs.load.pay, [30, 42]);
  assert.deepEqual(robOdds(cfg, at('docks')).pay, [75, 120]);
  assert.deepEqual(binsFinds(cfg, 'docks').at(-1).pay, [36, 60]);
  const d = danger(cfg, { ...at('docks', { hoursThere: 2 }), carried: 50, books: { ...at('docks').books, earned: 50 } });
  assert.equal(d.jump.chance, Math.round((4 + 4 * 2 + 5) * 1.5));
  assert.equal(d.jump.strength, 55 + 10);
  assert.equal(danger(cfg, at('docks', { heat: 4 })).stop.chance, Math.round(2 * 20 * 1.25));
  // the market's and the park's numbers are what they were
  assert.equal(bytes(cfg.places.market.jobs), bytes(RUN_CONFIG.places.market.jobs));
  assert.equal(bytes(cfg.places.park), bytes(RUN_CONFIG.places.park));
});

test('places: the per-place checks pass on every place, the docks included', () => {
  for (const place of streetPlaces(cfg)) {
    const p = cfg.places[place];
    const safeRole = Object.values(p.jobs).find(j => j.safe).role;
    for (const seed of [1, 2, 3]) {
      // work it dry: nobody worked twice, the safe job first and always there, dry only when everyone is worked
      let s = at(place, { energy: 40, owned: { cutter: true } }, seed, CALM);
      const worked = [];
      for (let i = 0; i < 40; i++) {
        const v = view(CALM, s);
        assert.ok(v.options[0].safe && v.options[0].who && v.options[0].available, `${place}: the safe one first`);
        const o = v.options.find(x => !x.safe && x.available);
        if (!o) break;
        worked.push(o.who.id);
        s = step(CALM, s, o.choice).state;
        assert.ok(checkRunBooks(s).ok);
      }
      assert.equal(new Set(worked).size, worked.length, `${place}: nobody worked twice`);
      assert.deepEqual([...worked].sort(), p.people.filter(x => x.role !== safeRole).map(x => x.id).sort(), `${place}: everyone else worked once before it runs dry`);
      const v = view(CALM, s);
      assert.ok(v.dry, `${place}: worked dry says so`);
      assert.match(v.dry.text, new RegExp(`^Nobody left to work ${p.where} today, ${p.onlySafe}\\.`));
      // the same state deals the same
      assert.equal(bytes(deal(CALM, s)), bytes(deal(CALM, { ...s })));
    }
    // heat goes to the place; the street moves read its supply
    const v = view(cfg, at(place, { owned: { cutter: true } }));
    assert.equal(v.places.find(x => x.place === place).here, true);
    for (const what of ['rob', 'bins']) assert.equal(!!v.choices.find(c => c.choice.do === what), !!p.supply?.[what === 'rob' ? 'strangers' : 'bins'], `${place} ${what}`);
    // away from home, sleeping rough is there; at home's door, going inside
    assert.equal(!!v.choices.find(c => c.choice.do === 'rough'), !p.door);
    assert.equal(!!v.choices.find(c => c.choice.do === 'inside'), !!p.door);
  }
});

test('places: the three-place city plays: rides along the links, every event staged, every dollar accounted for', () => {
  const seen = new Set();
  for (const seed of [1, 2, 3, 4]) {
    let s = newRun({ seed, cfg });
    s.owned = { ...s.owned, cutter: seed % 2 === 0, bed: seed > 2 };
    const r = rng(seed, 'docks-monkey');
    for (let i = 0; i < 700; i++) {
      const v = view(cfg, s);
      const legal = v.choices.filter(c => c.available);
      assert.ok(legal.length, `no legal choice at ${s.place}`);
      // lean towards the docks so the monkey spends time there
      const toDocks = legal.find(c => c.choice.do === 'subway' && c.choice.to === 'docks');
      const c = toDocks && r() < 0.6 ? toDocks.choice : pick(r, legal).choice;
      const choice = c.do === 'out' ? { ...c, take: Math.min(s.banked, 2) } : c;
      const out = step(cfg, s, choice);
      for (const e of out.events) {
        assert.ok(e.scene && (e.scene.kind || e.scene.action || e.scene.ride || e.scene.notice), `${e.type}: a scene`);
        if (e.scene.kind) assert.ok(KINDS[e.scene.kind], `unknown kind ${e.scene.kind}`);
        if (e.scene.action) assert.ok(ACTIONS.includes(e.scene.action), `unknown action ${e.scene.action}`);
        if (e.block) assert.ok(CITY.blocks[e.block], `unknown block ${e.block}`);
        if (e.place === 'docks') seen.add(e.type);
      }
      s = out.state;
      assert.ok(checkRunBooks(s).ok, `books off at step ${i}`);
    }
  }
  for (const type of ['ride', 'job']) assert.ok(seen.has(type), `nothing of type ${type} happened on the docks: ${[...seen]}`);
  // from the market the docks are a ride away; from the docks, the market
  const v = view(cfg, at('market', { energy: 6 }));
  assert.ok(v.choices.some(c => c.choice.do === 'subway' && c.choice.to === 'docks' && c.available));
  assert.ok(view(cfg, at('docks', { energy: 6 })).choices.some(c => c.choice.do === 'subway' && c.choice.to === 'market'));
});

test('places: no rule names a place: the rules, the engine and the view read the places\' entries', () => {
  const here = new URL('../src/run/', import.meta.url);
  for (const file of ['rules.mjs', 'step.mjs', 'view.mjs', 'state.mjs', 'ledger.mjs']) {
    const code = readFileSync(new URL(file, here), 'utf8').split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
    for (const name of ['park', 'market', 'crib', 'corner', 'docks']) assert.ok(!code.includes(`'${name}'`), `${file} names '${name}'`);
  }
});
