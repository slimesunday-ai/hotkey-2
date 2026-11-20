// THE FIGHT'S STUDIO (anim-1): two or three of the stage's own people stood on open ground and posed from a fight's
// score at any moment asked for, for the picture tools (demo/tools/fight-sheet.mjs) and for looking at a move while it
// is being made. Not part of the game: a page loads it only when a tool asks (by its address under the page's own folder,
// demo/fight/puppet/studio.js, never from the server's root: the page may be served from a sub-folder).
//
//   const S = await createStudio({ stage, city })
//   S.cast(n)                  n of the stage's people (the player first) taken in hand, on a mark of open ground
//   S.play(fight)              a staged fight (choreo.js stageFight's): its bodies are these people from now on
//   S.seek(t)                  every body as the score has it at t (held: the stage's own clock may be stopped)
//   S.run(on)                  the score played on the stage's clock from where it is
//   S.view('game' | 'close' | 'top')   the game's own camera, or a picture view of the tool's
import { createPuppets } from './puppet.js';
import { stateAt } from './choreo.js';
import { createHeld } from './held.js';
import { installClips } from '../clips/index.js';
import { createKit } from '../../stage/rides/kit.js';

export async function createStudio({ stage, city }) {
  const AC = stage.actors;
  const kit = stage.rides?.kit ?? createKit({ city, actors: AC, CLIPS: AC.CLIPS });
  installClips({ CLIPS: AC.CLIPS, mats: [city.peds?.anim?.mat, city.peds?.anim?.batch?.customDepthMaterial], THREE: city.THREE });
  const puppets = createPuppets({ actors: AC, kit, city });
  const held = createHeld(city);
  const you = 'a1';
  let ids = [];
  let bodies = [];
  let at = null;
  let side = 1;
  let fight = null;
  let T = 0;
  let running = false;

  /** Open ground near the player with a clear line from the east or the west for the close view. */
  function findMark() {
    const me = AC.get(you);
    const people = AC.all().filter(a => a.id !== you && !a.w.hide).map(a => [a.x, a.z]);
    // (where the game's camera is from whoever it follows: it keeps that to them wherever they stand)
    const camOff = city.camera.position.clone().sub(new city.THREE.Vector3(me.x, me.y, me.z));
    for (let r = 0; r <= 70; r += 1) {
      for (let k = 0; k < Math.max(1, r * 6); k++) {
        const x = me.x + Math.sin((k * 2 * Math.PI) / Math.max(1, r * 6)) * r;
        const z = me.z + Math.cos((k * 2 * Math.PI) / Math.max(1, r * 6)) * r;
        let ok = AC.solidKnown(x, z) && !AC.onRoad?.(x, z);
        for (let rr = 0.5; ok && rr <= 3.5; rr += 0.5) for (let q = 0; q < 16 && ok; q++) if (AC.solidAt(x + Math.sin((q * Math.PI) / 8) * rr, z + Math.cos((q * Math.PI) / 8) * rr)) ok = false;
        if (!ok) continue;
        if (people.some(([px, pz]) => Math.hypot(px - x, pz - z) < 4.5)) continue;
        // (nothing between the game's own camera and the ground there: a string of flags over a street hides a fight)
        {
          const y = AC.groundAt(x, z);
          const R = new city.THREE.Raycaster();
          R.camera = city.camera;
          let clear = true;
          for (const [dx, dz] of [[0, 0], [0, 1.6], [0, -1.6], [1.2, 0], [-1.2, 0]]) {
            const to = new city.THREE.Vector3(x + dx, y + 1, z + dz);
            const from = new city.THREE.Vector3(x + dx + camOff.x, y + camOff.y, z + dz + camOff.z);
            R.set(from, to.clone().sub(from).normalize());
            R.far = from.distanceTo(to) - 2.2;
            if (R.intersectObject(city.scene, true).some(h => h.object.visible !== false)) {
              clear = false;
              break;
            }
          }
          if (!clear) continue;
        }
        // (the close view from the side the game's camera is on: the strong hands are kept on that side)
        for (const s of [camOff.x >= 0 ? 1 : -1]) {
          let line = true;
          for (let e = -1; line && e <= 9; e += 1) for (const dz of [-2, 0, 2]) if (city.peds.sim.laneNear(x + s * e, z + dz, 1.3)) line = false;
          if (line) {
            const y = AC.groundAt(x, z);
            const R = new city.THREE.Raycaster();
            const from = new city.THREE.Vector3(x + s * 8.5, y + 3, z);
            R.camera = city.camera;
            for (const [dz, dy] of [[-1.5, 0.3], [-1.5, 1.6], [0, 0.9], [1.5, 0.3], [1.5, 1.6], [0, 2.3]]) {
              const to = new city.THREE.Vector3(x, y + dy, z + dz);
              const d = from.distanceTo(to);
              R.set(from, to.clone().sub(from).normalize());
              R.far = d - 1.6;
              if (R.intersectObject(city.scene, true).some(h => h.object.visible !== false)) {
                line = false;
                break;
              }
            }
          }
          if (line) return { at: [x, z], side: s };
        }
      }
    }
    return { at: [me.x, me.z], side: 1 };
  }

  function cast(n = 2) {
    const me = AC.get(you);
    const others = AC.all().filter(a => a.id !== you && !a.w.hide && !/cart/.test(`${a.id} ${a.name}`)).sort((p, q) => Math.hypot(p.x - me.x, p.z - me.z) - Math.hypot(q.x - me.x, q.z - me.z));
    ids = [you, ...others.slice(0, n - 1).map(a => a.id)];
    ({ at, side } = findMark());
    const y = AC.groundAt(at[0], at[1]);
    ids.forEach((id, k) => {
      AC.place(id, at[0] + (k === 2 ? 1.4 : 0), at[1] + (k === 0 ? -0.9 : k === 1 ? 0.9 : 0), k === 1 ? Math.PI : 0, y);
      const A = AC.get(id);
      A.want = A.asked = null;
      if (A.w.g) AC.CLIPS.clearClip(A.w.g);
      AC.contact?.(id, 'duel');
    });
    for (const P of ids.map(id => stage.director?.people?.get(id)).filter(Boolean)) {
      P.busy += 1;
      stage.director.rest(P.id);
    }
    bodies = ids.map(id => puppets.take(id));
    return { ids, at, side, names: ids.map(id => AC.get(id).name) };
  }

  function apply() {
    if (!fight) return;
    const now = stateAt(fight, T);
    fight.fighters.forEach((F, k) => {
      const B = bodies[k];
      if (!B) return;
      const S = now[k];
      B.set(S.x, AC.groundAt(S.x, S.z), S.z, S.yaw, S.P);
      if (F.G.held) {
        const pts = F.points(T, S);
        const L = ((F.G.strong ?? 'R') === 'L') === (F.lead === -1);
        held.show(F.id, F.G.held, L ? pts.fistL : pts.fistR, L ? pts.elbL : pts.elbR);
      } else held.hide(F.id);
    });
  }
  AC.onFrame(dt => {
    if (running && fight) T = Math.min(fight.t1, T + dt);
    apply();
  });

  const V3 = (x, y, z) => new city.THREE.Vector3(x, y, z);
  return {
    cast,
    get at() {
      return at;
    },
    get ids() {
      return ids;
    },
    play(f) {
      fight = f;
      T = f.t0;
      apply();
    },
    seek(t) {
      T = t;
      apply();
      return T;
    },
    run(on = true) {
      running = on;
    },
    get t() {
      return T;
    },
    get fight() {
      return fight;
    },
    view(kind, o = {}) {
      const [x, z] = at;
      const y = AC.groundAt(x, z);
      if (kind === 'game') {
        stage.camera.focus(null);
        stage.focus(you);
        stage.camera.arrived();
        return;
      }
      const c = o.center ?? [x, z];
      const p = kind === 'top' ? [c[0] + side * 0.01, y + 9.5, c[1]] : kind === 'front' ? [c[0], y + 2.6, c[1] + 8.5] : [c[0] + side * 8.5, y + (o.high ?? 3.0), c[1]];
      const t = [c[0], y + (kind === 'top' ? 0 : 0.95), c[1]];
      city.VIEWS.hk2clip = { pos: p, tgt: t, fov: o.fov ?? 34, sh: [(p[0] + t[0]) / 2, (p[2] + t[2]) / 2, 12] };
      city.cam?.toOrbit({ instant: true });
      city.setView('hk2clip');
    },
    /** Where a world point is on the picture now (CSS px). */
    screen(p) {
      const v = V3(p[0], p[1], p[2]).project(city.camera);
      return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight];
    },
    /** The box on the picture round the fight's ground (its middle, r metres round it, up to over the heads). */
    box(r = 2.6, c = at) {
      const y = AC.groundAt(c[0], c[1]);
      const P = [];
      for (const dx of [-r, r]) for (const dz of [-r, r]) for (const dy of [-0.2, 2.2]) P.push(this.screen([c[0] + dx, y + dy, c[1] + dz]));
      return [Math.min(...P.map(p => p[0])), Math.min(...P.map(p => p[1])), Math.max(...P.map(p => p[0])), Math.max(...P.map(p => p[1]))];
    },
    puppets, bodies: () => bodies,
  };
}
