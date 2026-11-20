#!/usr/bin/env node
// HOW FAR A BODY WITH A GUN TILTS THROUGH ITS SHOTS (anim-2). Reads the film.json of a steered gun fight filmed with
// --trace (demo/tools/fight-film.mjs wave:<gun> --trace [--dry]): a row a body a frame of how it was DRAWN, the cast
// shader's own roll into a turn included (gunner.js traceRow). Prints, for each shot of each body with a gun, the
// spine's tilt off upright (degrees) through the shot: the most in the 0.12 s before it, the most in the 0.7 s after,
// and what it was made of at that worst frame (the walker's roll into a turn, the pose's own lean back or forward,
// how fast the body was turning and going); then the worst and the middle of all of them.
//
//   node demo/tools/gun-lean.mjs <case dir> [<case dir> ...] [--who you|foes|all] [--rows <n>]   (--rows: the frames of the worst n shots)
//   [--max <deg>]   fail when any shot tilts a body further than that
import path from 'node:path';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};
const flags = new Set(['--who', '--rows', '--max']);
const dirs = args.filter((a, k) => !a.startsWith('--') && !flags.has(args[k - 1]));
const who = opt('--who', 'all');
const nRows = Number(opt('--rows', '0'));
const MAX = opt('--max', null) === null ? null : Number(opt('--max', null));
let fail = false;
for (const dir of dirs) {
  const film = JSON.parse(readFileSync(path.join(dir, 'film.json'), 'utf8'));
  const T = film.gunTrace ?? [];
  if (!T.length) {
    console.log(`${dir}: no trace in it (film with --trace)`);
    continue;
  }
  const by = new Map();
  for (const r of T) {
    if (!r.gun) continue;
    if (who === 'you' && r.id !== 'you') continue;
    if (who === 'foes' && r.id === 'you') continue;
    if (!by.has(r.id)) by.set(r.id, []);
    by.get(r.id).push(r);
  }
  const shots = [];
  for (const [id, rows] of by) {
    for (let k = 1; k < rows.length; k++) {
      // (a shot: the clock since the last one starts again)
      if (!(rows[k].since < rows[k - 1].since - 0.05 && rows[k].since < 0.1)) continue;
      const t0 = rows[k].t - rows[k].since;
      const win = rows.filter(r => r.t >= t0 - 0.12 && r.t <= t0 + 0.7);
      const before = win.filter(r => r.t < t0);
      const after = win.filter(r => r.t >= t0);
      const worst = after.reduce((a, b) => (b.tilt > a.tilt ? b : a), after[0]);
      const head = win.reduce((a, b) => Math.max(a, Math.abs(b.head)), 0);
      // (the head's fastest turn through it, degrees a second)
      let spin = 0;
      for (let i = 1; i < win.length; i++) {
        const dt = win[i].t - win[i - 1].t;
        if (dt > 1e-4) spin = Math.max(spin, Math.abs(win[i].head + win[i].yaw - win[i - 1].head - win[i - 1].yaw) > 180 ? 0 : Math.abs(win[i].head + win[i].yaw - win[i - 1].head - win[i - 1].yaw) / dt);
      }
      let turn = 0;
      for (let i = 1; i < win.length; i++) {
        const d = Math.abs(((win[i].yaw - win[i - 1].yaw + 540) % 360) - 180);
        turn = Math.max(turn, d);
      }
      shots.push({ id, gun: rows[k].gun, t0: +t0.toFixed(2), before: Math.max(0, ...before.map(r => r.tilt)), after: worst.tilt, at: +(worst.t - t0).toFixed(2), roll: worst.roll, fore: worst.fore, side: worst.side, om: worst.om, v: worst.v, head, spin: +spin.toFixed(0), jump: +turn.toFixed(0), sh: new Set(win.map(r => r.sh)).size > 1, win });
    }
  }
  // (over the whole fight, a body: how often it changed shoulder, how far its heading turned a second on the average
  // while it had its gun up, and the most its heading turned in one frame)
  const calm = [];
  for (const [id, rows] of by) {
    let [changes, travel, secs, jump, headTravel] = [0, 0, 0, 0, 0];
    for (let k = 1; k < rows.length; k++) {
      const dt = rows[k].t - rows[k - 1].t;
      if (!(dt > 0 && dt < 0.2)) continue;
      if (rows[k].sh !== rows[k - 1].sh) changes += 1;
      const d = Math.abs(((rows[k].yaw - rows[k - 1].yaw + 540) % 360) - 180);
      jump = Math.max(jump, d);
      if (rows[k].up > 0.5) {
        travel += d;
        headTravel += Math.abs(rows[k].head - rows[k - 1].head);
        secs += dt;
      }
    }
    calm.push(`${id}: ${changes} changes of shoulder, the heading turns ${(travel / Math.max(0.01, secs)).toFixed(0)} deg/s and the head ${(headTravel / Math.max(0.01, secs)).toFixed(0)} deg/s on the average over ${secs.toFixed(1)} s with the gun up, ${jump.toFixed(0)} deg the most in a frame`);
  }
  console.log(`  ${calm.join('\n  ')}`);
  shots.sort((a, b) => b.after - a.after);
  const tilts = shots.map(s => s.after).sort((a, b) => a - b);
  const mid = tilts.length ? tilts[Math.floor(tilts.length / 2)] : 0;
  console.log(`${path.basename(dir)}: ${shots.length} shots traced (${[...by.keys()].join(', ')}); the spine's tilt through a shot: the worst ${tilts[tilts.length - 1] ?? 0} deg, the middle one ${mid} deg; shots over 15 deg: ${tilts.filter(v => v > 15).length}; the most the body's heading jumps in one frame through a shot ${Math.max(0, ...shots.map(s => s.jump))} deg; shots through a change of shoulder ${shots.filter(s => s.sh).length}`);
  for (const s of shots.slice(0, 8)) console.log(`  ${s.id} ${s.gun} at ${s.t0} s: before ${s.before} deg, after ${s.after} deg at +${s.at} s (the walker's roll ${s.roll}, fore ${s.fore}, side ${s.side}; turning ${s.om} rad/s, going ${s.v} m/s); head off the chest up to ${s.head} deg, turning up to ${s.spin} deg/s; heading jump ${s.jump} deg${s.sh ? '; CHANGED SHOULDER' : ''}`);
  for (const s of shots.slice(0, nRows)) {
    console.log(`  — ${s.id} ${s.gun} at ${s.t0} s, frame by frame:`);
    for (const r of s.win) console.log(`     ${(r.t - s.t0).toFixed(3).padStart(7)}  tilt ${String(r.tilt).padStart(5)}  roll ${String(r.roll).padStart(6)}  fore ${String(r.fore).padStart(6)}  side ${String(r.side).padStart(6)}  om ${String(r.om).padStart(6)}  v ${String(r.v).padStart(5)}  yaw ${String(r.yaw).padStart(7)} → ${String(r.to).padStart(7)}  bear ${String(r.bear).padStart(7)}  sh ${r.sh} flip ${r.flip}  up ${r.up}  head ${String(r.head).padStart(6)}  tx ${r.tx} ty ${r.ty} tz ${r.tz}${r.hurt ? `  hurt ${r.hurt}` : ''}`);
  }
  if (MAX !== null && (tilts[tilts.length - 1] ?? 0) > MAX) fail = true;
}
if (MAX !== null) console.log(fail ? `lean-fail: a body tilts over ${MAX} deg through a shot` : `lean-ok: nobody tilts over ${MAX} deg through a shot`);
process.exit(fail ? 1 : 0);
