#!/usr/bin/env node
// A FIGHT'S SCORE, CHECKED WITHOUT A BROWSER (anim-1). The fights the page plays are staged from the rules' own fight
// before their first frame (demo/fight/puppet/choreo.js), as plain functions of the fight's clock: so a whole fight can
// be worked through here, frame by frame, and measured.
//
//   node demo/tools/fight-score.mjs [--you hands] [--foe brawler] [--seed 7] [--jump] [--crew [--earl front|hunt|block|side|none]] [--all] [--beats]
//
// For each body: any number that is not a number, a planted foot that moved (it must not, to the millimetre), how fast
// the legs ever turn and the body ever goes, how often a foot is at the end of its reach (the hips held back), how far
// the chest is ever turned on the legs. --all: every way you fight against every style, a few seeds each, one line a
// fight and the worst of each at the end. --beats: the script (who throws what when) and what was staged for it.
// Prints `score-ok`, or `score-fail: <why>`.
import { RUN_CONFIG as cfg, newRun } from '../../src/run/index.mjs';
import { crewOf } from '../../src/run/rules.mjs';
import { rivalFoe } from '../../src/fight/index.mjs';
import { scriptOf, stageFight, stateAt } from '../fight/puppet/choreo.js';
import { fk, toWorld, RIG } from '../fight/puppet/rig.js';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};
const D = cfg.duel;

/** A one-on-one's inputs as the run's rules make them (src/run/rules.mjs duelOf), for a way to fight and a style. */
export function duelInputs(arm = 'hands', style = 'brawler', { hp = 80, foeHp = 60 } = {}) {
  const A = D.you[arm];
  return { you: { weapon: A.weapon, hp, max: D.hp.max, hits: A.hits }, foe: rivalFoe(style, { id: 'them', name: style, hp: foeHp }), cap: D.cap, hit: D.hit / 100, brawl: { ...D.brawl }, arena: { ...D.arena } };
}
/** Getting jumped, as the run's rules make it (jumpOf). */
export function jumpInputs(arm = 'hands', { tired = false } = {}) {
  const J = cfg.jumped;
  const A = D.you[arm];
  const foes = J.foes.map(f => ({ id: f.id, kind: f.kind, name: f.name, weapon: f.weapon, hp: f.hp, hits: f.hits, speed: f.speed, ...(f.reel !== undefined ? { reel: f.reel } : {}) }));
  return { you: { weapon: A.weapon, hp: tired ? J.you.tired : J.you.fresh, max: D.hp.max, hits: A.hits }, foe: foes[0], foes, cap: J.cap ?? D.cap, hit: D.hit / 100, brawl: { ...D.brawl }, arena: { ...D.arena, around: J.around.map(x => [...x]) } };
}

/** The crew at your door, as the run's rules make it (crewOf): with Cousin Earl told `way` (null: without him), the door bar or not. */
export function crewInputs(arm = 'hands', way = 'front', bar = true) {
  return crewOf(cfg, newRun({ seed: 3, cfg }), { arm, earl: !!way, way: way ?? 'side', bar: bar ? cfg.things?.bar?.def ?? 20 : 0, energy: 6 }).inputs;
}

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
export function measure(fight) {
  const out = [];
  for (const F of fight.fighters) {
    const m = { id: F.id, lead: F.lead, steps: F.feet.steps.filter(s => !s.cut).length, nan: 0, slide: 0, slideAt: null, speed: 0, turn: 0, turnAt: null, reach: 0, chest: 0, frames: 0, longest: 0, low: 9 };
    let prev = null;
    const foot = (S, side) => {
      // the foot's ground point in the world, as the rig draws it
      const z = side < 0 ? S.P.fL[0] : S.P.fR[0];
      return toWorld([side * RIG.hipX, 0, RIG.hipZ + z], S.x, 0, S.z, S.yaw);
    };
    for (let t = fight.t0; t <= fight.t1; t += 1 / 60) {
      const S = F.at(t);
      const P = S.P;
      m.frames += 1;
      if ([S.x, S.z, S.yaw, P.tx, P.ty, P.tz, P.hx, P.hy, P.hz, P.drop, P.bx, ...P.aL, ...P.aR, ...P.fL, ...P.fR, P.rx, P.ry, P.rz, P.mx, P.my, P.mz].some(v => !Number.isFinite(v))) m.nan += 1;
      const down = F.downs.some(d => S.t >= d.t0 && S.t < d.t1);
      const hip = toWorld(fk(P).hip, S.x, 0, S.z, S.yaw);
      const now = { t, x: S.x, z: S.z, hx: hip[0], hz: hip[2], yaw: S.yaw, L: foot(S, -1), R: foot(S, 1), lL: P.fL[1], lR: P.fR[1], down, st: S.t };
      // (the stage's own body, off its feet too: it must never be somewhere else from one frame to the next)
      if (prev) m.jump = Math.max(m.jump ?? 0, Math.hypot(now.x - prev.x, now.z - prev.z));
      if (prev && !down && !prev.down) {
        m.speed = Math.max(m.speed, Math.hypot(now.hx - prev.hx, now.hz - prev.hz) * 60);
        const w = Math.abs(wrap(now.yaw - prev.yaw)) * 60;
        if (w > m.turn) [m.turn, m.turnAt] = [w, t];
        // a foot down on both frames, and not the one a step of its own ends or begins on between them
        for (const k of ['L', 'R']) {
          const side = k === 'L' ? -1 : 1;
          const moving = F.feet.steps.some(s => (s.cut || s.side === side) && s.t0 <= now.st + 1e-9 && s.t1 >= prev.st - 1e-9);
          if (moving) continue;
          const d = Math.hypot(now[k][0] - prev[k][0], now[k][2] - prev[k][2]);
          if (d > m.slide) [m.slide, m.slideAt] = [d, t];
        }
      }
      // (LEFT BEHIND: how far a standing body is from where the fight's plan has its hips. A lunge and a lean are
      // part of it, a few tenths; more is feet that are not following, and blows thrown at nobody)
      if (!down) {
        const pl = F.pos.at(S.t);
        const d = Math.hypot(now.hx - pl[0], now.hz - pl[1]);
        // (once it is over they walk where they are sent, turning first: further behind for a moment, and it is
        // the end that waits for them)
        const k = t > fight.tOver + 0.45 ? 1 / 1.5 : 1;
        if (d * k > (m.behind ?? 0)) [m.behind, m.behindAt] = [d * k, t];
      }
      if (!down && (Math.abs(P.fL[0]) > 0.305 || Math.abs(P.fR[0]) > 0.305)) m.reach += 1;
      if (!down) m.chest = Math.max(m.chest, Math.abs(P.ty));
      prev = now;
    }
    for (const s of F.feet.steps) if (!s.cut) m.longest = Math.max(m.longest, Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1]));
    out.push(m);
  }
  // how near the two heads ever come (middle to middle, m), over the fight
  let near = 9;
  for (let t = fight.t0; t <= fight.t1; t += 1 / 30) {
    const S = stateAt(fight, t);
    const pts = S.map(q => toWorld(fk(q.P).headC, q.x, 0, q.z, q.yaw));
    // (two on their feet: a body thrown goes over the other's, and one stood over is under the winner's)
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (!S[i].down && !S[j].down) near = Math.min(near, Math.hypot(pts[i][0] - pts[j][0], pts[i][2] - pts[j][2]));
  }
  // WHERE EACH BLOW THAT LANDS, LANDS: at its tick, how far the nearer fist of whoever threw it is from the place on
  // the other body it is shown to land on
  const land = { n: 0, worst: 0, sum: 0, at: null };
  for (const e of fight.fx) {
    if (e.kind !== 'hit' || !e.blow) continue;
    const A = fight.byId[e.by];
    const q = e.at?.();
    if (!A || !q) continue;
    const pts = A.points(e.t);
    const d = Math.min(...[pts.fistL, pts.fistR].map(f => Math.hypot(f[0] - q[0], f[1] - q[1], f[2] - q[2])));
    land.n += 1;
    land.sum += d;
    if (d > land.worst) [land.worst, land.at] = [d, `${e.by} on ${e.to} at ${e.t.toFixed(2)} (${e.blow})`];
  }
  // HOW IT ENDS: everybody on their feet, nobody in anybody
  const last = stateAt(fight, fight.t1);
  let endNear = 9;
  for (let i = 0; i < last.length; i++) for (let j = i + 1; j < last.length; j++) endNear = Math.min(endNear, Math.hypot(last[i].x - last[j].x, last[i].z - last[j].z));
  return { bodies: out, headsNear: near, land, endNear, endDown: last.filter(q => q.down).length };
}

const line = m => `${m.id.padEnd(5)} lead ${m.lead > 0 ? 'R' : 'L'}  steps ${String(m.steps).padStart(3)} (longest ${m.longest.toFixed(2)} m)  planted foot moved ${(m.slide * 1000).toFixed(1)} mm${m.slide > 0.002 ? ` at ${m.slideAt.toFixed(2)}` : ''}  hips' top speed ${m.speed.toFixed(1)} m/s, most moved in a frame ${((m.jump ?? 0) * 100).toFixed(0)} cm  legs turn ${(m.turn * 57.3).toFixed(0)}°/s${m.turnAt !== null ? ` at ${m.turnAt.toFixed(2)}` : ''}  at reach ${m.reach}/${m.frames} frames  chest on legs ${(m.chest * 57.3).toFixed(0)}°${m.nan ? `  NOT NUMBERS ${m.nan}` : ''}`;
const faults = [];
const total = { landN: 0, landSum: 0, landWorst: 0, landAt: '', behind: 0, behindAt: '', endNear: 9 };
function check(name, inputs, seed, say = true) {
  const t0 = performance.now();
  const script = scriptOf(inputs, seed);
  const fight = stageFight({ script, ground: { c: [0, 0], r: script.people.length > 3 ? 2.4 : script.people.length > 2 ? 2.0 : 1.7 }, cam: [1, 0], seed, firstHurt: inputs.firstHurt ?? 0 });
  const ms = performance.now() - t0;
  const M = measure(fight);
  if (say) {
    console.log(`${name}: ${script.over.result} in ${script.seconds.toFixed(1)} s, ${script.beats.length} blows thrown, ${script.beats.filter(b => b.hit).length} landed; staged in ${ms.toFixed(0)} ms; heads never nearer than ${M.headsNear.toFixed(2)} m`);
    for (const m of M.bodies) console.log(`  ${line(m)}`);
  }
  if (say) console.log(`  the blows that land: ${M.land.n}, a fist from its place on the other ${(M.land.sum / Math.max(1, M.land.n)).toFixed(2)} m on the average, ${M.land.worst.toFixed(2)} m at the worst (${M.land.at}); at the end the nearest two stand ${M.endNear.toFixed(2)} m apart, ${M.endDown} still down; the furthest a body was left behind its plan ${Math.max(...M.bodies.map(m => m.behind ?? 0)).toFixed(2)} m`);
  total.landN += M.land.n;
  total.landSum += M.land.sum;
  if (M.land.worst > total.landWorst) [total.landWorst, total.landAt] = [M.land.worst, `${name}: ${M.land.at}`];
  for (const m of M.bodies) if ((m.behind ?? 0) > total.behind) [total.behind, total.behindAt] = [m.behind, `${name}: ${m.id} at ${m.behindAt.toFixed(2)}`];
  total.endNear = Math.min(total.endNear, M.endNear);
  // (WHAT FOLLOWS THE LAST BLOW: the score's own length after the rules' end; the page hands control back when it is
  // played out. Over 3.8 s here is over the 4 s the page is allowed, demo/run/duel.js PACE)
  const after = fight.t1 - fight.tOver;
  total.after = Math.max(total.after ?? 0, after);
  total.afterSum = (total.afterSum ?? 0) + after;
  total.n = (total.n ?? 0) + 1;
  if (after > 3.8) faults.push(`${name}: ${after.toFixed(2)} s follow the last blow`);
  if (say) console.log(`  ${after.toFixed(2)} s follow the last blow`);
  if (M.endDown) faults.push(`${name}: ${M.endDown} still on the ground when it is handed back`);
  // (a body and a half: the stage eases two standing bodies apart from there, demo/stage/actors.js separate)
  if (M.endNear < 0.85) faults.push(`${name}: two stand ${M.endNear.toFixed(2)} m apart when it is handed back`);
  for (const m of M.bodies) {
    // (four in it: a body turning from one to another across the ground is further behind for a moment)
    if ((m.behind ?? 0) > (M.bodies.length > 3 ? 1.7 : 1.3)) faults.push(`${name}: ${m.id} was left ${m.behind.toFixed(2)} m behind its plan at ${m.behindAt.toFixed(2)} s`);
    if (m.nan) faults.push(`${name}: ${m.id} has ${m.nan} frames with a number that is not one`);
    if (m.slide > 0.004) faults.push(`${name}: ${m.id}'s planted foot moved ${(m.slide * 1000).toFixed(1)} mm at ${m.slideAt.toFixed(2)} s`);
  }
  return { script, fight, M, ms };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const seed = Number(opt('--seed', '7'));
  if (args.includes('--all')) {
    const worst = { slide: 0, turn: 0, speed: 0, reach: 0, ms: 0, near: 9 };
    let n = 0;
    for (const arm of Object.keys(D.you)) {
      for (const style of ['brawler', 'bigman', 'quick', 'knife', 'grabber']) {
        for (const s of [1, 2, 3]) {
          const r = check(`${arm} v ${style} #${s}`, duelInputs(arm, style), 1000 + s * 77, false);
          n += 1;
          for (const m of r.M.bodies) {
            worst.slide = Math.max(worst.slide, m.slide);
            worst.turn = Math.max(worst.turn, m.turn);
            worst.speed = Math.max(worst.speed, m.speed);
            worst.jump = Math.max(worst.jump ?? 0, m.jump ?? 0);
            worst.reach = Math.max(worst.reach, m.reach / m.frames);
          }
          worst.ms = Math.max(worst.ms, r.ms);
          worst.near = Math.min(worst.near, r.M.headsNear);
          if (args.includes('--worst') && (r.M.headsNear < 0.7 || r.M.bodies.some(m => m.speed > 8 || m.turn > 9))) console.log(`  ${arm} v ${style} #${s} (seed ${1000 + s * 77}): heads ${r.M.headsNear.toFixed(2)}; ${r.M.bodies.map(m => `${m.id} ${m.speed.toFixed(1)} m/s ${(m.turn * 57.3).toFixed(0)}°/s at ${m.turnAt?.toFixed(2)}`).join('; ')}`);
        }
      }
    }
    for (const arm of Object.keys(D.you)) for (const s of [1, 2]) { check(`jumped, ${arm} #${s}`, jumpInputs(arm), 2000 + s * 31, false); n += 1; }
    // (sixes-1: the crew at your door, with Cousin Earl each way he is told and without him)
    for (const way of ['front', 'hunt', 'block', 'side', null]) for (const s of [1, 2, 3]) { check(`the crew at the door, Earl ${way ?? 'not there'} #${s}`, crewInputs('hands', way), 3000 + s * 17, false); n += 1; }
    console.log(`after the last blow: ${(total.afterSum / total.n).toFixed(2)} s on the average, ${total.after.toFixed(2)} s at the most`);
    console.log(`${total.landN} blows land: a fist from its place on the other ${(total.landSum / Math.max(1, total.landN)).toFixed(3)} m on the average, ${total.landWorst.toFixed(2)} m at the worst (${total.landAt}); nobody left further behind their plan than ${total.behind.toFixed(2)} m (${total.behindAt}); at the end no two nearer than ${total.endNear.toFixed(2)} m`);
    console.log(`${n} fights staged: a planted foot never moved more than ${(worst.slide * 1000).toFixed(1)} mm; legs never turned faster than ${(worst.turn * 57.3).toFixed(0)}°/s; no hips faster than ${worst.speed.toFixed(1)} m/s; the stage's body never moved more than ${(worst.jump * 100).toFixed(0)} cm in a frame; a foot at its reach at most ${(worst.reach * 100).toFixed(0)}% of a fight; heads never nearer than ${worst.near.toFixed(2)} m; the slowest staging ${worst.ms.toFixed(0)} ms`);
  } else {
    const crew = args.includes('--crew');
    const inputs = crew ? crewInputs(opt('--you', 'hands'), opt('--earl', 'front') === 'none' ? null : opt('--earl', 'front')) : args.includes('--jump') ? jumpInputs(opt('--you', 'hands')) : duelInputs(opt('--you', 'hands'), opt('--foe', 'brawler'));
    const r = check(crew ? `the crew at the door, ${opt('--you', 'hands')}, Earl ${opt('--earl', 'front')}` : args.includes('--jump') ? `jumped, ${opt('--you', 'hands')}` : `${opt('--you', 'hands')} v ${opt('--foe', 'brawler')}`, inputs, seed);
    if (args.includes('--beats')) for (const b of r.script.beats) console.log(`  ${b.t.toFixed(2)}  ${b.by} → ${b.to}  ${b.spent ? 'spent' : b.hit ? `LANDS ${b.dmg}` : 'misses'}${b.down ? '  DOWN' : ''}  ${b.staged ?? ''}`);
  }
  if (args.includes('--faults')) for (const f of faults) console.log(`  ${f}`);
  console.log(faults.length ? `score-fail: ${faults[0]}${faults.length > 1 ? ` (and ${faults.length - 1} more)` : ''}` : 'score-ok');
  process.exitCode = faults.length ? 1 : 0;
}
