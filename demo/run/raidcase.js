// A RAID TO LOOK AT (raidfight-1): the rules' own raid fight (src/run/raid.mjs raidOf, src/fight/raid.mjs runRaid) for
// a crew, a size, what is in your hands and Cousin Earl or not, as the fight page plays it and the film tool finds it.
// Nothing of the run is kept: a fresh run's state with that gun and three boxes of its rounds (the marks' kit, RUN.md
// "Marks of the raid"), at the health a night on the mattress gives, no pieces.
//
//   raidCase({ crew, size, hold, earl, way, seed }) → { inputs, seed, result, seconds, you, them, earl, ... } (raidOut's shape)
//   findRaid({ crew, size, hold, earl, way, result }) → the first such raid (seeds 1, 2, ...) that ends `result`
//   RAID_HOLDS    what may be in your hands: [key, label]
import { RUN_CONFIG as cfg, newRun } from '../../src/run/index.mjs';
import { raidOf } from '../../src/run/raid.mjs';
import { runRaid } from '../../src/fight/raid.mjs';

export const RAID_HOLDS = [['hands', 'Bare hands'], ['cutter', 'Box cutter'], ['sixshot', 'Six-shot'], ['doorman', 'Doorman'], ['chopper', 'Chopper'], ['longeye', 'Long-eye']];
export const RAID_CREWS = Object.keys(cfg.sixesRaid.crews);
/** The loose names the tools take for a gun (the fight's: pistol, chopper, doorman, longeye) → the run's things. */
const HOLD_OF = { pistol: 'sixshot', six: 'sixshot', 'six-shot': 'sixshot', 'long-eye': 'longeye', blade: 'cutter', fists: 'hands' };

export function raidCase({ crew = 'rush', size = 1, hold = 'doorman', earl = false, way = 'side', seed = 1 } = {}) {
  const h = HOLD_OF[hold] ?? hold;
  const s0 = newRun({ seed: 3, cfg });
  const gun = cfg.things[h]?.gun ? h : null;
  const state = {
    ...s0,
    owned: { ...s0.owned, cutter: h === 'cutter' },
    fightWith: h === 'cutter' ? 'cutter' : s0.fightWith,
    things: { ...(s0.things ?? {}), ...(gun ? { [gun]: true } : {}) },
    ammo: { ...(s0.ammo ?? {}), ...(gun ? { [gun]: (cfg.things[gun].ammo?.n ?? cfg.things[gun].ammo ?? 6) * 3 } : {}) },
  };
  const d = raidOf(cfg, state, { hold: gun ?? h, crew, size, earl, way, pieces: { bar: 0, blind: 0, cut: 0, dog: false } });
  const F = runRaid(d.inputs, seed);
  return { sixesRaid: true, result: F.over.result, seed, seconds: F.over.t, capped: !!F.capped, inputs: d.inputs, hold: d.hold, gun: d.gun, spent: F.spent ?? 0, you: d.you, them: d.them, earl: d.earl, pieces: d.pieces };
}

export function findRaid({ result = null, ...o } = {}) {
  for (let seed = 1; seed < 4000; seed++) {
    const c = raidCase({ ...o, seed });
    if (!result || c.result === result) return c;
  }
  throw new Error(`no raid of ${JSON.stringify(o)} that is ${result}`);
}
