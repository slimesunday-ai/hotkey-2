#!/usr/bin/env node
// THE RUN'S FIGHTS AT THE NAMED CAST'S SIZES, CHECKED WITHOUT A BROWSER (named-1). The fights are staged before their
// first frame (demo/fight/puppet/choreo.js) for bodies of the shared size; the named cast is drawn 0.9 to 1.25 times
// it. This stages the run's one-on-ones with the one you fight at a size (you at 1), works through every frame as the
// stage draws it (each body's rig points times its size, about its feet) and measures:
//   land    at every blow that lands, how far the fist that throws it is from the place it lands on (m)
//   heads   the nearest two standing heads' middles come, against their two half-depths (0.42 m each, times the size)
//   slide   how far a planted foot moves while it is down (m: it must not)
//   nan     any number that is not one
//
//   node demo/tools/fight-sizes.mjs [--sizes 0.9,1,1.08,1.25] [--seeds 6] [--arms hands,cutter,haymaker,throw] [--styles brawler,bigman,quick,knife,grabber]
// Prints a row a size and `sizes-ok` or `sizes-fail: <why>` (a blow that lands more than LAND m from its fist, heads
// nearer than HEADS of the two half-depths, a foot that slides more than SLIDE m, a number that is not one).
import { scriptOf, stageFight, stateAt } from '../fight/puppet/choreo.js';
import { fk, toWorld, RIG } from '../fight/puppet/rig.js';
import { duelInputs } from './fight-score.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};
const SIZES = opt('--sizes', '0.9,1,1.08,1.25').split(',').map(Number);
const SEEDS = Number(opt('--seeds', 6));
const ARMS = opt('--arms', 'hands,cutter,haymaker,throw').split(',');
const STYLES = opt('--styles', 'brawler,bigman,quick,knife,grabber').split(',');
/** The budgets: a landed blow's fist within LAND of its place; heads no nearer than HEADS of their two half-depths; no foot sliding over SLIDE. */
const LAND = 0.12;
const HEADS = 0.95;
const SLIDE = 0.005;
const HALF = 0.42;

function check(size, arm, style, seed) {
  const inputs = duelInputs(arm, style);
  const script = scriptOf(inputs, seed);
  const ids = script.people.map(p => p.id);
  const cast = Object.fromEntries(ids.map((id, k) => [id, { at: [k ? -1 : 1, 0], size: k ? size : 1 }]));
  const fight = stageFight({ script, ground: { c: [0, 0], r: 1.7 }, cam: [1, 0], seed, cast, firstHurt: inputs.firstHurt ?? 0 });
  const r = { lands: [], close: 0, frames: 0, heads: 9, slide: 0, nan: 0 };
  // (each fist as drawn: the rig's point times the body's size, about its feet)
  const fists = (F, t) => {
    const p = F.points(t);
    return [p.fistL, p.fistR];
  };
  for (const e of fight.fx) {
    // (a blow of the hands: a named blow, nothing held in the hand)
    if (e.kind !== 'hit' || typeof e.at !== 'function' || !e.blow || e.held) continue;
    const A = fight.byId[e.by];
    const at = e.at();
    if (!A || !at || !A.feet) continue;
    // (the nearest the fist comes to it round the moment it lands: a blow's own timing puts the fist there a frame or
    // two either side of the rules' tick)
    let d = 9;
    for (let t = e.t - 0.12; t <= e.t + 0.08; t += 1 / 120) d = Math.min(d, ...fists(A, t).map(f => Math.hypot(f[0] - at[0], f[1] - at[1], f[2] - at[2])));
    r.lands.push(d);
  }
  for (let t = fight.t0; t <= fight.t1; t += 1 / 60) {
    const S = stateAt(fight, t);
    S.forEach((s, k) => {
      if (!s.P || [s.x, s.z, s.yaw].some(v => !Number.isFinite(v))) r.nan += 1;
    });
    for (let i = 0; i < S.length; i++) {
      for (let j = i + 1; j < S.length; j++) {
        if (S[i].down || S[j].down) continue;
        const h = k => toWorld(fk(S[k].P).headC.map(v => v * fight.fighters[k].size), S[k].x, 0, S[k].z, S[k].yaw);
        const [a, b] = [h(i), h(j)];
        const most = HALF * (fight.fighters[i].size + fight.fighters[j].size);
        const q = Math.hypot(a[0] - b[0], a[2] - b[2]) / most;
        r.heads = Math.min(r.heads, q);
        r.frames += 1;
        if (q < HEADS) r.close += 1;
      }
    }
    // a planted foot (the one feet.js holds down, on the ground): drawn where the plan put it
    fight.fighters.forEach((F, k) => {
      const s = F.at(t);
      if (s.down) return;
      const ft = F.feet.at(F.clock(t), { L: [0, 0, 0, 0], R: [0, 0, 0, 0], yaw: 0, pin: -1 });
      const side = ft.pin;
      const plan = side < 0 ? ft.L : ft.R;
      if (plan[2] > 0.004) return;
      const z = side < 0 ? s.P.fL[0] : s.P.fR[0];
      const w = toWorld([side * RIG.hipX * F.size, 0, (RIG.hipZ + z) * F.size], s.x, 0, s.z, s.yaw);
      r.slide = Math.max(r.slide, Math.hypot(w[0] - plan[0], w[2] - plan[1]));
    });
  }
  return r;
}

let failed = [];
const pct = (list, p) => (list.length ? [...list].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(p * list.length))] : 0);
const rows = [];
for (const size of SIZES) {
  const W = { lands: [], close: 0, frames: 0, heads: 9, slide: 0, nan: 0, fights: 0 };
  for (const arm of ARMS) {
    for (const style of STYLES) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        let r;
        try {
          r = check(size, arm, style, seed);
        } catch (err) {
          failed.push(`size ${size} ${arm} v ${style} seed ${seed}: ${err.message}`);
          continue;
        }
        W.fights += 1;
        W.lands.push(...r.lands);
        W.close += r.close;
        W.frames += r.frames;
        W.heads = Math.min(W.heads, r.heads);
        W.slide = Math.max(W.slide, r.slide);
        W.nan += r.nan;
      }
    }
  }
  const row = { size, fights: W.fights, blows: W.lands.length, median: pct(W.lands, 0.5), p90: pct(W.lands, 0.9), close: W.close / Math.max(1, W.frames), heads: W.heads, slide: W.slide, nan: W.nan };
  rows.push(row);
  console.log(`size ${size}: ${row.fights} fights, ${row.blows} blows of the hands landed: the fist at its nearest to its place ${row.median.toFixed(3)} m (median), ${row.p90.toFixed(3)} m (9 in 10); two heads nearer than ${HEADS} of their half-depths in ${(100 * row.close).toFixed(2)}% of frames (the nearest ${row.heads.toFixed(2)}); a planted foot off its place ${row.slide.toFixed(4)} m at most; not-a-number ${row.nan}`);
}
// against the shared size: no worse than it, by a margin
const base = rows.find(r => r.size === 1) ?? rows[0];
for (const r of rows) {
  if (r.p90 > base.p90 + 0.04) failed.push(`size ${r.size}: 9 in 10 landed blows within ${r.p90.toFixed(3)} m of their place (at 1: ${base.p90.toFixed(3)})`);
  if (r.close > base.close + 0.005) failed.push(`size ${r.size}: heads too near in ${(100 * r.close).toFixed(2)}% of frames (at 1: ${(100 * base.close).toFixed(2)}%)`);
  if (r.slide > SLIDE) failed.push(`size ${r.size}: a planted foot ${r.slide.toFixed(4)} m off its place`);
  if (r.nan) failed.push(`size ${r.size}: ${r.nan} numbers that are not`);
}
console.log(failed.length ? `sizes-fail: ${failed.slice(0, 6).join(' · ')}` : 'sizes-ok');
process.exit(failed.length ? 1 : 0);
