// MOVEMENT POLICIES: the player's hands, for a fight run headless (an AI player, the balance table, the advice's
// "what if"). A policy reads the fight and returns the move for this tick, { x, y } in the arena's frame.
//
//   still   stands where they came up, and lets the weapon do it
//   kite    BACKS AWAY WHILE FIRING: with a gun, keeps the ones who hit out of reach (further while reloading) and
//           stands to shoot when they are far; with fists or a blade, steps in to strike and out while the next
//           blow comes up. Either way it walks over what is dropped when nobody is close, and never onto the stairs.
import { BODY, WEAPONS } from './data.mjs';
import { you } from './sim.mjs';

export const still = () => ({ x: 0, y: 0 });

const DIRS = Array.from({ length: 16 }, (_, k) => [Math.cos((k * Math.PI) / 8), Math.sin((k * Math.PI) / 8)]);

export function kite(F) {
  const m = kite0(F);
  // (never onto the stairs: a step that would end on them goes round them)
  const me = you(F);
  const [ex, ey] = F.arena.exit;
  const [nx, ny] = [me.x + m.x * 0.5, me.y + m.y * 0.5];
  const d = Math.hypot(nx - ex, ny - ey);
  if (d < F.arena.exitR + 0.4 && d > 1e-6) {
    const [ux, uy] = [(nx - ex) / d, (ny - ey) / d];
    const out = m.x * ux + m.y * uy;
    if (out < 0) return { x: m.x - out * ux, y: m.y - out * uy };
  }
  return m;
}

function kite0(F) {
  const me = you(F);
  const W = WEAPONS[me.arm];
  const gun = W.kind === 'gun';
  const { w, h, exit, exitR } = F.arena;
  const them = F.people.filter(p => p.side === 'foe' && !p.down);
  const hitters = them.filter(p => WEAPONS[p.arm].kind !== 'gun');
  const near = hitters.reduce((m, p) => Math.min(m, Math.hypot(p.x - me.x, p.y - me.y)), Infinity);
  /** How good a place is: far from the ones who hit, off the walls, off the stairs. */
  const score = (x, y) => {
    let s = 0;
    for (const p of them) {
      const d = Math.hypot(p.x - x, p.y - y);
      const k = WEAPONS[p.arm].kind === 'gun' ? 0.25 : p.kind === 'runner' ? 1.3 : 1;
      s += k * Math.min(d, 7) - (d < 1.6 ? 4 * k : 0);
    }
    const wall = Math.min(x, w - x, y, h - y);
    if (wall < 1.6) s -= (1.6 - wall) * 3;
    if (Math.hypot(x - exit[0], y - exit[1]) < exitR + 0.9) s -= 30;
    return s;
  };
  const away = () => {
    const look = me.speed * 0.45;
    let best = [0, 0];
    let bestS = score(me.x, me.y);
    for (const [dx, dy] of DIRS) {
      const [x, y] = [Math.max(BODY, Math.min(w - BODY, me.x + dx * look)), Math.max(BODY, Math.min(h - BODY, me.y + dy * look))];
      const s = score(x, y);
      if (s > bestS + 0.05) [best, bestS] = [[dx, dy], s];
    }
    return { x: best[0], y: best[1] };
  };
  const loot = () => {
    const L = F.loot.slice().sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
    if (!L) return null;
    const d = Math.hypot(L.x - me.x, L.y - me.y);
    if (d > 6 || Math.hypot(L.x - exit[0], L.y - exit[1]) < exitR + 0.5) return null;
    return { x: (L.x - me.x) / d, y: (L.y - me.y) / d };
  };
  if (gun) {
    const safe = me.reload > 0 || me.mag <= 1 ? 7 : 4.2;
    if (near < safe) return away();
    return (near > safe + 2.5 && loot()) || { x: 0, y: 0 };
  }
  // fists or a blade: in to strike, out while the next blow comes up
  const target = hitters.concat(them).filter(p => p.in).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
  if (!target) return loot() ?? { x: 0, y: 0 };
  const d = Math.hypot(target.x - me.x, target.y - me.y);
  // (only a shooter left: it is run down)
  if (!hitters.some(p => p.in)) return d > reachOf(W) - 0.1 ? { x: (target.x - me.x) / d, y: (target.y - me.y) / d } : { x: 0, y: 0 };
  const reach = reachOf(W);
  if (me.cd > 0.12 && near < reach + 1.1) return away();
  if (d > reach - 0.1 && d < 4) return { x: (target.x - me.x) / d, y: (target.y - me.y) / d };
  if (d >= 4) return loot() ?? { x: 0, y: 0 };
  return { x: 0, y: 0 };
}

const reachOf = W => W.reach + 2 * BODY;

export const POLICIES = { still, kite };
