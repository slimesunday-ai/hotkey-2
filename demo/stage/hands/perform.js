// A DEAL PLAYED ON THE STAGE (anim-1): the two (or one, at a bin) taken from the stage as the fights take theirs
// (demo/fight/puppet/puppet.js: a body posed by hand every frame), stood where the deal needs them, the staged deal
// (deals.js) played on them at the stage's clock, the things drawn in their hands (things.js), and handed back
// standing where they stood. The director calls it for a scene step that carries `perform` (director.js runStep0;
// the run's scenes name it: demo/run/acted.js).
//
// WHERE THEY STAND. Two who deal stand SIDE BY SIDE, facing the camera, 0.44 m between their heads, and the
// things pass in that gap. Facing each other, their hands are under their own heads (a metre wide, over shoulders
// half a metre apart) and nothing of it shows from above: seen 2026-11-18, the first take, two heads and nothing
// else. Whoever keeps the place (the seller) stays where they are and only turns; the other steps to their side.
// At a bin: half a step off its near edge, facing it.
//
//   const hands = createHands({ actors, city, map })
//   await hands.perform({ deal, roles, told, block, alive })     deal: 'buy' | 'bins' | … (deals.js); roles: { buyer: id, seller: id } …
//   hands.state → { active, deal, t, length, log: [{ deal, length, set, seconds, meets, faults }] }
import { stageDeal, STAND } from './deals.js';
import { measureHands } from './moves.js';
import { createThings } from './things.js';
import { createPuppets } from '../../fight/puppet/puppet.js';
import { installClips } from '../../fight/clips/index.js';
import { createKit } from '../rides/kit.js';

/** How far each of two dealing is turned in toward the other from facing the camera (rad). */
const TOE = 0.14;
/** At a bin: how near its edge and how far from it (m, of his size) he can lean in from where he stands. */
const BIN_REACH = [0.3, 0.62];
/** Who saw the dig: how far from the bin they come to stand, how far off they are still waited for a second, and the furthest they are played from (m). */
const SEEN_FROM = [3.4, 5.5, 7];
/** How fast he goes in by a gate to a bin shut behind it, and comes back out (m/s, over the whole of it). */
const GATE_V = 2;
/** Seconds the picture stays black at a cut by the gate, for the camera to be on him where he is put. */
const CUT_HOLD = 0.12;
/** How fast whoever saw comes over (m/s), and the latest into the dig they can still arrive and be seen to look (s). */
const COME = 2.9;
const SEEN_BY = 2.6;
/** Seconds over which a body taken for a deal finishes turning to how the deal stands it. */
const TURN = 0.3;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export function createHands({ actors, city, camera = null, map = null, rides = null, fade = null, director = null, room = null }) {
  let serial = 0;
  /** What solid a body at (x, z) stands in, the deals' and fights' own rooms aside (room.js: a solid only to a walk being planned). */
  const solidName = (x, z) => {
    const n = actors.solidAt?.(x, z);
    return n && !/fight's ground/.test(n) ? n : null;
  };
  const skips = [];
  let kit = null;
  let puppets = null;
  let things = null;
  let cur = null;
  const log = [];
  /** whoever is walking over to watch a dig: id → { q: where to, v } (prepare) */
  const coming = new Map();
  const scaleOf = id => actors.scaleOf?.(id) ?? actors.get(id)?.w?.scale ?? 1;
  // (the things' materials are made, and warmed, when the stage is: not at the first deal)
  try {
    things = createThings(city);
  } catch {
    things = null;
  }
  function ensure() {
    installClips({ CLIPS: actors.CLIPS, mats: [city.peds?.anim?.mat, city.peds?.anim?.batch?.customDepthMaterial], THREE: city.THREE });
    kit ??= rides?.kit ?? createKit({ city, actors, CLIPS: actors.CLIPS });
    puppets ??= createPuppets({ actors, kit, city });
    things ??= createThings(city);
  }
  // MADE READY AT ONCE, not at the first deal: the hand-posed clips installed on the people's material, the bodies' kit,
  // and one of each thing drawn once out of sight. Done at the first deal, the page went 2 s without answering in the
  // middle of play (demo/tools/room-load.mjs, the dealer's run, 14 s in; not with ?deals=old)
  const warm = () => {
    try {
      ensure();
      for (const k of ['cash', 'carton', 'cig', 'lighter', 'coins']) {
        things.show(`warm:${k}`, { kind: k, at: [0, -50, 0], dir: [0, 0, 1], up: [0, 1, 0], show: true, since: 1, scale: 1 });
      }
      things.fx('warm:', [{ kind: 'puff', i: 0, k: 0.5, n: 3, at: [0, -50, 0] }, { kind: 'flame', i: 1, k: 0.5, at: [0, -50, 0] }]);
      const off = actors.onFrame?.(() => {
        things.clear('warm:');
        off?.();
      });
    } catch (err) {
      console.warn('[hands] could not be made ready ahead:', err);
    }
  };
  setTimeout(warm, 0);
  /** Where the camera is over the ground (the picture's own: whatever view the player has turned it to). */
  const camFrom = () => [city.camera.position.x, city.camera.position.z];
  const drawn = A => A.w?.yawS ?? A.ry;
  /**
   * THE STANCE of two who deal, a at (ax, az) and b at (bx, bz): both face the side of the line between them that the
   * camera is on, each toed in to the other. → [a's heading, b's]. Their inner shoulders are then toward each other,
   * whatever the line's own bearing (along the camera's, they stand in profile, one further up the picture).
   */
  function openYaws(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az) || 1;
    const u = [(bx - ax) / d, (bz - az) / d];
    const cam = camFrom();
    const c = [cam[0] - (ax + bx) / 2, cam[1] - (az + bz) / 2];
    const p = -u[1] * c[0] + u[0] * c[1] >= 0 ? [-u[1], u[0]] : [u[1], -u[0]];
    const face = Math.atan2(p[0], p[1]);
    const sg = Math.sign(wrap(Math.atan2(u[0], u[1]) - face)) || 1;
    return [face + TOE * sg, face - TOE * sg];
  }
  /** The bin nearest a point: the near edge of its box (a point of its rim) and one down inside it. */
  function binBy(block, x, z, scale) {
    const all = (map?.TABLE?.places?.[block]?.near?.things ?? []).filter(t => /^(trashcan|dumpster)$/.test(t.what) && t.box);
    let best = null;
    for (const t of all) {
      const [x0, y0, z0, x1, y1, z1] = t.box;
      const [px, pz] = [Math.min(x1, Math.max(x0, x)), Math.min(z1, Math.max(z0, z))];
      const d = Math.hypot(px - x, pz - z);
      if (!best || d < best.d) best = { d, box: t.box, edge: [px, pz], mid: [(x0 + x1) / 2, (z0 + z1) / 2], top: y1, floor: y0 };
    }
    if (!best || best.d > 4) return null;
    const g = actors.groundAt(best.edge[0], best.edge[1]);
    const [dx, dz] = [best.mid[0] - best.edge[0], best.mid[1] - best.edge[1]];
    const n = Math.hypot(dx, dz) || 1;
    // (the rim no higher than the ribs of whoever digs: a dumpster's lip is reached up to, not vaulted)
    const h = Math.min(Math.max(0.55, best.top - g), 0.92 * scale);
    return { edge: best.edge, in: [dx / n, dz / n], rim: [best.edge[0], g + h, best.edge[1]], inside: [best.edge[0] + (dx / n) * 0.3 * scale, g + h - 0.28 * scale, best.edge[1] + (dz / n) * 0.3 * scale] };
  }

  /** Stands the people of a deal where it needs them (the stage's own steps and turns), and says where that is. */
  async function setUp(deal, roles, block, told = {}) {
    const P = {};
    const at = id => actors.get(id);
    if (roles.buyer && roles.seller) {
      const [B, S] = [at(roles.buyer), at(roles.seller)];
      const [sb, ss] = [scaleOf(roles.buyer), scaleOf(roles.seller)];
      // SIDE BY SIDE, 0.44 m between their heads: STAND of each one's size from its own middle to the gap's.
      // The director's walk up has stood them so already (director.js meet, `open`: the step's `gap`); here only
      // what is left: a step in or back along their line when the distance is off (sizes the director does not
      // know, a walk that gave out short), and the turn
      const want = (told.stand ?? STAND) * (sb + ss);
      const d = Math.hypot(B.x - S.x, B.z - S.z);
      // (stage 2: whoever came steps; who keeps the place (`keeps`, the seller unless told) only turns)
      const [mover, keeper, M0, K0] = told.keeps === 'buyer' ? [roles.seller, roles.buyer, S, B] : [roles.buyer, roles.seller, B, S];
      if (Math.abs(d - want) > 0.12 && d > 0.2) {
        const m = [K0.x + ((M0.x - K0.x) / d) * want, K0.z + ((M0.z - K0.z) / d) * want];
        if (!actors.solidAt?.(m[0], m[1])) await Promise.race([actors.stepTo(mover, m[0], m[1], { exact: true }).catch(() => {}), actors.seconds(0.9)]);
        // (that step blocked, by somebody standing in it at a bus stop: the other way round, the one who keeps the
        // place steps. Seen 2026-11-19: the pair 0.46 m too far apart, and the hands 25 cm short of each other)
        const d2 = Math.hypot(B.x - S.x, B.z - S.z);
        if (Math.abs(d2 - want) > 0.15 && d2 > 0.2) {
          const m2 = [M0.x + ((K0.x - M0.x) / d2) * want, M0.z + ((K0.z - M0.z) / d2) * want];
          if (!actors.solidAt?.(m2[0], m2[1])) await Promise.race([actors.stepTo(keeper, m2[0], m2[1], { exact: true }).catch(() => {}), actors.seconds(0.9)]);
        }
      }
      // (hands-2: STILL NOT AT ITS DISTANCE, both steps blocked: the nearest free ground round whoever keeps the place,
      // at the deal's distance, and a step there. The barber's buyer was left 0.24 m from him, the money through a
      // chest and the scissors through a head. Nowhere to stand: the deal is not played (the step's own clips are))
      // (what each deal stands, measured: a little near is no harm to most (every deal clean at 0.6 of the two sizes,
      // 0.72 its own), but the barber's scissors at the side of a head are in it at 0.66; and 0.8 is too far for any
      // (the energy drink went through two heads at 0.79 in the page))
      // (and never nearer than the check's own mark, 0.15 m in: a can held at the gap's edge went into the other head
      // at 0.2 m near, the full check, hands-2)
      const [lo, hi] = [Math.max(want - 0.15, want * (deal === 'haircut' ? 0.95 : 0.83)), want + 0.08];
      // (AND ON ONE LEVEL, within 0.1 m: a kerb's 0.15 m between them and the money went through a head in every other
      // deal, measured; the energy drink through the drinker's own, in the page)
      const LEVEL = 0.1;
      const lvl = () => Math.abs(actors.groundAt(B.x, B.z) - actors.groundAt(S.x, S.z));
      const d3 = Math.hypot(B.x - S.x, B.z - S.z);
      if (d3 > hi || d3 < lo || lvl() > LEVEL) {
        const [M1, K1] = [at(mover), at(keeper)];
        // (round `C`, at the deal's distance, starting from the bearing to `F`: the nearest free ground to F)
        const freeRound = (C, F) => {
          const a0 = Math.atan2(F.x - C.x, F.z - C.z);
          let best = null;
          for (let k = 0; k < 16; k++) {
            const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
            const q = [C.x + Math.sin(a) * want, C.z + Math.cos(a) * want];
            if (actors.solidAt?.(q[0], q[1]) || actors.lowNear?.(q[0], q[1], 0.3) || (actors.free && !actors.free(q[0], q[1], 0.5, [mover, keeper])) || Math.abs(actors.groundAt(q[0], q[1]) - actors.groundAt(C.x, C.z)) > LEVEL * 0.8) continue;
            const dq = Math.hypot(q[0] - F.x, q[1] - F.z);
            if (!best || dq < best.d) best = { q, d: dq };
          }
          return best;
        };
        const best = freeRound(K1, M1);
        // (none round whoever keeps the place (the barber in his walk-up, its pole and its step at a hand's width): the
        // other way round, he steps out to stand beside the one who came)
        const other = best ? null : freeRound(M1, K1);
        if (best) await Promise.race([actors.stepTo(mover, best.q[0], best.q[1], { exact: true }).catch(() => {}), actors.seconds(1.4)]);
        else if (other) await Promise.race([actors.stepTo(keeper, other.q[0], other.q[1], { exact: true }).catch(() => {}), actors.seconds(1.4)]);
      }
      const d4 = Math.hypot(B.x - S.x, B.z - S.z);
      if (d4 > hi || d4 < lo || lvl() > LEVEL) return null;
      const [yawB, yawS] = openYaws(B.x, B.z, S.x, S.z);
      for (const [role, A, yaw, s] of [['buyer', B, yawB, sb], ['seller', S, yawS, ss]]) P[role] = { x: A.x, y: actors.groundAt(A.x, A.z), z: A.z, yaw, from: drawn(A), scale: s };
      return { people: P, cam: camFrom(), told: {}, off: +Math.abs(Math.hypot(B.x - S.x, B.z - S.z) - want).toFixed(3) };
    }
    // (hands-2) A WALL TO REACH TO (deals.js swipe: the sneaker wall at DROP): the nearest solid round where he stands,
    // within a step and a half. He is stood half a step off it, facing it, and his hand goes to it at the chest
    if (deal === 'swipe' && roles.you) {
      const Y = at(roles.you);
      const s = scaleOf(roles.you);
      // (as high as a shop's wall or a rack: no lower than the chest. A planter's lip half a metre high was the
      // nearest solid where the walk to DROP gives out, and he reached into that)
      const high = n => +((/([\d.]+) m high/.exec(n ?? '') ?? [])[1] ?? (n ? 9 : 0)) >= 0.9;
      let wall = null;
      for (let k = 0; k < 24; k++) {
        const a = (k * Math.PI) / 12;
        for (let d = 0.2; d <= 3; d += 0.08) {
          const n = solidName(Y.x + Math.sin(a) * d, Y.z + Math.cos(a) * d);
          if (!n) continue;
          if (high(n) && (!wall || d < wall.d)) wall = { d, a };
          break;
        }
      }
      if (!wall) return null;
      const u = [Math.sin(wall.a), Math.cos(wall.a)];
      const face = [Y.x + u[0] * wall.d, Y.z + u[1] * wall.d];
      const stand = [face[0] - u[0] * 0.5 * s, face[1] - u[1] * 0.5 * s];
      if (Math.hypot(stand[0] - Y.x, stand[1] - Y.z) > 0.12 && !solidName(stand[0], stand[1])) await Promise.race([actors.stepTo(roles.you, stand[0], stand[1], { exact: true }).catch(() => {}), actors.seconds(1.8)]);
      // (not there: nothing is reached across a gap)
      if (Math.hypot(stand[0] - Y.x, stand[1] - Y.z) > 0.3) return null;
      const g = actors.groundAt(Y.x, Y.z);
      P.you = { x: Y.x, y: g, z: Y.z, yaw: wall.a, from: drawn(Y), scale: s };
      const rim = [face[0] - u[0] * 0.05, g + 0.95 * s, face[1] - u[1] * 0.05];
      return { people: P, cam: camFrom(), told: { rim, inside: [face[0] + u[0] * 0.04, g + 0.95 * s, face[1] + u[1] * 0.04] }, off: +Math.hypot(Y.x - stand[0], Y.z - stand[1]).toFixed(3) };
    }
    // THE BINS: you, half a step off the bin's near edge and facing it; whoever saw, from where they stand (walked a
    // little nearer first if they are far off, so that they are in the picture)
    const Y = at(roles.you);
    const s = scaleOf(roles.you);
    const bin = binBy(block, Y.x, Y.z, s);
    if (!bin) return null;
    // (the director's walk has stood him a step out from the bin: he leans in from there. Only out of reach of its
    // edge, or right up against it, does he take a step first)
    const reach = Math.hypot(Y.x - bin.edge[0], Y.z - bin.edge[1]) / s;
    let off = 0;
    let via = null;
    if (reach > BIN_REACH[1] || reach < BIN_REACH[0]) {
      const stand = [bin.edge[0] - bin.in[0] * 0.45 * s, bin.edge[1] - bin.in[1] * 0.45 * s];
      const far = Math.hypot(stand[0] - Y.x, stand[1] - Y.z);
      // (SHUT IN: something thin and solid between him and the bin, the service alley's chain-link gate with the
      // dumpster a step inside it. The director's walk gives out at the gate. The body is taken there and walked
      // in by it in hand (perform, `via`: a staged step of the stage's own took 1.5 s each way, most of it
      // starting and stopping), and walked back out when the dig is done: left inside, the next hour would find
      // him shut in the alley)
      let shut = false;
      for (let k = 1; k * 0.1 < far && !shut; k++) shut = !!actors.solidAt(Y.x + ((stand[0] - Y.x) * k * 0.1) / far, Y.z + ((stand[1] - Y.z) * k * 0.1) / far);
      if (shut && far > 0.8) via = { from: [Y.x, Y.z], to: [bin.edge[0] - bin.in[0] * 0.58 * s, bin.edge[1] - bin.in[1] * 0.58 * s] };
      else {
        await Promise.race([actors.stepTo(roles.you, stand[0], stand[1], { exact: true }).catch(() => {}), actors.seconds(1.2)]);
        off = +Math.hypot(Y.x - stand[0], Y.z - stand[1]).toFixed(3);
      }
    }
    const [px, pz] = via ? via.to : [Y.x, Y.z];
    const yaw = Math.atan2(bin.edge[0] - px, bin.edge[1] - pz);
    P.you = { x: px, y: actors.groundAt(px, pz), z: pz, yaw, from: via ? yaw : drawn(Y), scale: s };
    // WHOEVER SAW: where they have got to (prepare, below, set them walking over when the scene began). Still on
    // their way and near enough to be in the picture, they are stopped where they are; too far off to be seen with
    // him, they are no part of what is played (the record says so: `unseen`)
    const N = roles.neighbour && actors.has(roles.neighbour) ? at(roles.neighbour) : null;
    const late = {};
    let seenAt = 0.7;
    if (N) {
      const c = coming.get(roles.neighbour);
      const goal = N.route && c ? c.q : null;
      const eta = goal ? Math.hypot(N.x - goal[0], N.z - goal[1]) / c.v : 0;
      // (on their way and soon there: the dig is staged with them where they are going to stand, watching from when
      // they get there, and their own walk brings them; standing near already: as they stand)
      const [nx, nz] = goal && eta <= SEEN_BY ? goal : [N.x, N.z];
      if (Math.hypot(nx - px, nz - pz) <= SEEN_FROM[2]) {
        if (goal && eta <= SEEN_BY) {
          late.neighbour = { at: goal };
          seenAt = Math.max(0.5, eta + 0.2);
        } else if (N.route) await Promise.race([actors.stepTo(roles.neighbour, N.x, N.z).catch(() => {}), actors.seconds(0.5)]);
        P.neighbour = { x: nx, y: actors.groundAt(nx, nz), z: nz, yaw: Math.atan2(px - nx, pz - nz), from: drawn(N), scale: scaleOf(roles.neighbour) };
      }
    }
    return { people: P, cam: camFrom(), told: { rim: bin.rim, inside: bin.inside, seenAt }, late, unseen: !!N && !P.neighbour, off, via };
  }

  /** A body in hand walked from a to b ([x, z]) on the city's own legs, its heading turned from yaw0 to yaw1 as it sets off. */
  const walkBody = (B, a, b, yaw0, yaw1, alive) => new Promise(resolve => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const len = Math.max(0.45, d / GATE_V);
    let [u, last] = [0, 0];
    const off = actors.onFrame(dt => {
      u = alive() ? Math.min(len, u + dt) : len;
      const k = u / len;
      const e = k * k * (3 - 2 * k);
      const [x, z] = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
      const ky = Math.min(1, u / 0.22);
      B.walk(x, actors.groundAt(x, z), z, yaw0 + wrap(yaw1 - yaw0) * ky * ky * (3 - 2 * ky), dt > 0 ? ((e - last) * d) / dt : 0);
      last = e;
      if (u >= len) {
        off();
        resolve();
      }
    });
  });
  /**
   * IN BY A GATE THAT CANNOT OPEN (the alley's on Fit Street): A CUT, the stage's own black (travel.js fade): black at
   * once, the body put down at the other side of the gate, a beat for the camera to be on him there, and the picture
   * back. Walked through, he went through the chain-link: the owner saw it. Without the fade (a tool's page), walked.
   */
  async function cutBody(B, a, b, yaw0, yaw1, alive) {
    if (!fade?.blackNow) return walkBody(B, a, b, yaw0, yaw1, alive);
    fade.blackNow();
    try {
      B.walk(b[0], actors.groundAt(b[0], b[1]), b[1], yaw1, 0);
      await actors.seconds(CUT_HOLD);
    } finally {
      fade.in();
    }
  }

  // ── GLORIA'S DOG (stage 2; the owner: "dog should follow you home") ──────────────────────────────────────────────
  // He is no piece to be put away: bought (deals.js pay, `dog`), he comes out from behind her and round to sit in front
  // of the two of you while the money passes; then he FOLLOWS YOU, along the way you walk (a trail of where you have
  // been, so never through a fence you went round), a metre behind, sitting when you stop. When you go in at your door
  // he goes in after you (the trailer has him by his bed: demo/stage/set/crib.js); when you leave the trailer park, or
  // the picture goes black, he goes home unseen. The older game's chain dog: demo/stage/props/dog.js
  const CITY = new URL('../../../city/from-trunk/style/city/', import.meta.url).href;
  let dogMods = null;
  let pet = null;
  const makeDog = () => {
    dogMods ??= Promise.all([import(`${CITY}vox.js`), import(`${CITY}glue.js`), import('../props/dog.js')]);
    return dogMods.then(([V, G, D]) => {
      const dog = D.createDog(city.THREE, V, G, { coat: 'fawn', mode: 'sit' });
      dog.root.visible = false;
      city.scene.add(dog.root);
      return dog;
    });
  };
  const VIEW = { F: new city.THREE.Frustum(), M: new city.THREE.Matrix4(), S: new city.THREE.Sphere() };
  const inPicture = (x, y, z) => {
    const cam = city.camera;
    cam.updateMatrixWorld();
    VIEW.F.setFromProjectionMatrix(VIEW.M.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    VIEW.S.center.set(x, y + 0.3, z);
    VIEW.S.radius = 0.5;
    return VIEW.F.intersectsSphere(VIEW.S);
  };
  /** The dog put down at (x, z) facing `yaw`, going at `v` (m/s), in `mode`. */
  const putDog = (dog, x, z, yaw, v, mode) => {
    dog.root.visible = true;
    dog.root.position.set(x, actors.groundAt(x, z), z);
    dog.root.rotation.y = yaw;
    dog.speed = v;
    if (dog.mode !== mode) dog.setMode(mode);
  };
  /** From where he sits after the purchase, he follows `id` until home (above). */
  function follow(dog, id, block) {
    pet?.stop();
    const at = [dog.root.position.x, dog.root.position.z];
    const trail = [at.slice()];
    let yaw = dog.root.rotation.y;
    let homeBound = false;
    const stop = () => {
      off();
      dog.dispose();
      if (pet?.dog === dog) pet = null;
    };
    const off = actors.onFrame(dt => {
      try {
        step(dt);
      } catch (err) {
        console.warn('[hands] the dog went home: he threw', err);
        stop();
      }
    });
    const step = dt => {
      if (!actors.has(id)) return stop();
      const A = actors.get(id);
      const P = director?.people?.get(id);
      homeBound ||= !!(P?.inside || (P?.block && P.block !== block));
      // (gone home unseen: the picture black, or him out of it with nobody to follow)
      if (fade?.dark || (homeBound && !inPicture(at[0], actors.groundAt(at[0], at[1]), at[1]))) return stop();
      const last = trail[trail.length - 1];
      if (!homeBound && Math.hypot(A.x - last[0], A.z - last[1]) > 0.25) trail.push([A.x, A.z]);
      // the way left to him along the trail, and how far behind he keeps
      let left = 0;
      for (let k = 0; k < trail.length; k++) left += Math.hypot(trail[k][0] - (k ? trail[k - 1][0] : at[0]), trail[k][1] - (k ? trail[k - 1][1] : at[1]));
      left += homeBound ? 0 : Math.hypot(A.x - last[0], A.z - last[1]);
      const keep = homeBound ? 0 : 1.1;
      const v = left - keep > 0.05 ? Math.min(4.5, 0.8 + (left - keep) * 2.2) : 0;
      let go = v * Math.min(0.1, dt);
      while (go > 1e-4 && trail.length) {
        const q = trail[0];
        const d = Math.hypot(q[0] - at[0], q[1] - at[1]);
        if (d <= go) {
          at[0] = q[0];
          at[1] = q[1];
          go -= d;
          if (trail.length > 1 || homeBound) trail.shift();
          else break;
        } else {
          at[0] += ((q[0] - at[0]) / d) * go;
          at[1] += ((q[1] - at[1]) / d) * go;
          yaw = Math.atan2(q[0] - at[0], q[1] - at[1]);
          go = 0;
        }
      }
      // (at the end of the way home: in at the door after him)
      if (homeBound && !trail.length) return stop();
      // (stopped: he sits, turned to you)
      if (!v) yaw += wrap(Math.atan2(A.x - at[0], A.z - at[1]) - yaw) * Math.min(1, dt * 4);
      putDog(dog, at[0], at[1], yaw, v, v ? 'walk' : 'sit');
      dog.tick(Math.min(0.1, dt));
    };
    pet = { dog, stop };
  }

  /**
   * (hands-2) THE FIGURE DRESSED IN A PIECE PUT ON (deals.js buyWear): what they wear now with `wear` ({ slot, id }:
   * a slot of the cast and a piece of it) over it (actors.js dress, baked once each; `prepare` bakes it ahead). With
   * `ahead`, baked only: dressed in it and back again in the same moment, nothing drawn in between.
   */
  function wearOn(id, wear, ahead = false) {
    try {
      const A = id && actors.has(id) ? actors.get(id) : null;
      if (!A || !actors.dress || !wear?.slot || !wear?.id) return;
      const was = JSON.parse(A.dressed ?? '{}');
      actors.dress(id, { ...was, [wear.slot]: wear.id });
      if (ahead) actors.dress(id, was);
    } catch (err) {
      console.warn('[hands] could not dress for a thing put on:', err);
    }
  }
  async function perform({ deal, roles, told = {}, block = null, alive = () => true }) {
    ensure();
    const began = actors.clock;
    const tag = `${++serial}:`;
    const ids = Object.values(roles).filter(id => id && actors.has(id));
    // (a home piece is built the first time it is bought: made ready while they stand, a moment at the most)
    const kinds = [told.goods].filter(k => typeof k === 'string' && k.startsWith('kit:'));
    if (kinds.length) await Promise.race([Promise.all(kinds.map(k => things.ready(k))), actors.seconds(0.6)]);
    const dogP = told.dog ? makeDog().catch(err => (console.warn('[hands] the dog did not load:', err), null)) : null;
    const set = await setUp(deal, roles, block, told);
    if (!set || !alive()) {
      // (for the tools: why a performed step was not played)
      skips.push({ deal, roles: Object.keys(roles), set: !!set, alive: alive() });
      return { skipped: true };
    }
    const dog = dogP ? await Promise.race([dogP, actors.seconds(0.6).then(() => null)]) : null;
    /** The dog during the purchase: out from behind her, round her outer side, to sit in front of the two of you, turned to you. */
    const dogAt = (() => {
      if (!dog) return null;
      const [Bp, Sp] = [set.people.buyer, set.people.seller];
      const L = Math.hypot(Bp.x - Sp.x, Bp.z - Sp.z) || 1;
      const out = [(Sp.x - Bp.x) / L, (Sp.z - Bp.z) / L];
      const yawM = Sp.yaw + wrap(Bp.yaw - Sp.yaw) / 2;
      const f = [Math.sin(yawM), Math.cos(yawM)];
      const R = 0.75 * Sp.scale;
      const round = th => [Sp.x + R * (Math.cos(th) * out[0] + Math.sin(th) * f[0]), Sp.z + R * (Math.cos(th) * out[1] + Math.sin(th) * f[1])];
      const G = [Bp.x + f[0] * 0.75, Bp.z + f[1] * 0.75];
      // (round her from behind over [0.15, 1.0] s, then on to in front of you by 1.5 s, at a trot; sitting after)
      const [a, b, e] = [0.15, 1.0, 1.5];
      const pos = t => {
        if (t <= b) return round(-1.3 + (Math.PI / 2 + 1.3) * Math.max(0, Math.min(1, (t - a) / (b - a))));
        const p0 = round(Math.PI / 2);
        const k = Math.min(1, (t - b) / (e - b));
        return [p0[0] + (G[0] - p0[0]) * k, p0[1] + (G[1] - p0[1]) * k];
      };
      return t => {
        const [p, q] = [pos(t), pos(t + 0.05)];
        const moving = t > a && t < e;
        return { p, yaw: moving ? Math.atan2(q[0] - p[0], q[1] - p[1]) : Math.atan2(Bp.x - G[0], Bp.z - G[1]), v: moving ? 2.2 : 0 };
      };
    })();
    const seen = told.seen && set.people.neighbour ? told.seen : null;
    // (hands-2: A STICK-UP GONE WRONG knocks him back along the line away from her: how far it is free behind him,
    // nothing solid or low, nobody standing, no roadway when he is not on one (deals.js stickup `room`))
    if (deal === 'stickup' && told.win === false && set.people.buyer && set.people.seller) {
      const [Bp, Sp] = [set.people.buyer, set.people.seller];
      const L = Math.hypot(Bp.x - Sp.x, Bp.z - Sp.z) || 1;
      const a0 = Math.atan2(Bp.x - Sp.x, Bp.z - Sp.z);
      const kerb = !actors.onRoad?.(Bp.x, Bp.z);
      const freeTo = a => {
        let room = 0;
        for (let d = 0.1; d <= 1.9 + 1e-9; d += 0.1) {
          const [x, z] = [Bp.x + Math.sin(a) * d, Bp.z + Math.cos(a) * d];
          if (solidName(x, z) || actors.lowNear?.(x, z, 0.3) || (kerb && actors.onRoad?.(x, z)) || (actors.free && !actors.free(x, z, 0.5, ids))) break;
          room = d;
        }
        return room;
      };
      // (straight away from her when it is free; else the freest way within a little over a right angle of it: behind
      // the stalls the straight way had 0.4 m, and a shove of 0.4 m is no shove)
      let best = { a: a0, room: freeTo(a0) };
      if (best.room < 1.6) for (const da of [0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4]) {
        const r = freeTo(a0 + da);
        if (r - 0.25 * Math.abs(da) > best.room - 0.25 * Math.abs(best.a - a0) + 0.05) best = { a: a0 + da, room: r };
      }
      void L;
      set.told = { ...set.told, room: best.room, dir: [Math.sin(best.a), Math.cos(best.a)] };
    }
    const T = stageDeal(deal, { people: set.people, cam: set.cam, ...told, ...set.told, seen });
    // (where the deal leaves each one: where it stood them, unless it moved them (a shove that lands))
    const fin = T.at(T.t1).bodies;
    const cast = Object.entries(roles).filter(([role, id]) => set.people[role] && actors.has(id));
    // (whoever is still walking to their place in it is taken when they get there: `late`. Until then they are the
    // stage's own walker, on their own feet)
    const late = set.late ?? {};
    const bodies = {};
    const took = {};
    const takeBody = (role, id, t) => {
      const A = actors.get(id);
      set.people[role].from = drawn(A);
      // (stood where the walk left them, a hand's width from the place it was staged for)
      set.people[role].stood = [A.x, actors.groundAt(A.x, A.z), A.z];
      bodies[role] = puppets.take(id);
      took[role] = t;
    };
    // THE DEAL IS OVER FOR THE PLAYER BEFORE IT IS OVER (`back`: deals.js sell): from then he has the next hour, and
    // what is left of it (the buyer smoking what he bought) plays on without him. Cut by anything (the next hour, a
    // Skip), it is over at once for everybody
    // A DEAL IS GIVEN A LITTLE ROOM (room.js, quiet): the city's walkers step round the two of them, not through them.
    // Nobody stops, watches or runs for it. Not while a fight has the room; `?room=0` turns it off
    let ring = null;
    const R0 = typeof room === 'function' ? room() : room;
    const inRing = Object.entries(set.people).filter(([role]) => role !== 'neighbour').map(([, q]) => q);
    if (R0?.open && !R0.state?.on && inRing.length) {
      const c = [inRing.reduce((m, q) => m + q.x, 0) / inRing.length, inRing.reduce((m, q) => m + q.z, 0) / inRing.length];
      ring = R0.open({ c, r: Math.max(0.6, ...inRing.map(q => Math.hypot(q.x - c[0], q.z - c[1]) + 0.45 * (q.scale ?? 1))), keep: ids, quiet: true });
    }
    const backAt = T.back ? T.back.t : T.t1;
    const st = { active: true, tail: false, deal, t: 0, length: +(backAt - T.t0).toFixed(2), things: [] };
    cur = st;
    let t = T.t0;
    // (NOTHING LEFT HELD IF THIS FAILS: a body taken and then a throw (no body slot left, a cut with no fade) left the
    // bodies hand-posed and the deal `active` for good: whatever was taken is let go and the deal is over)
    try {
      for (const [role, id] of cast) if (!late[role]) takeBody(role, id, t);
    } catch (err) {
      for (const B of Object.values(bodies)) B.release();
      ring?.close();
      st.active = false;
      if (cur === st) cur = null;
      skips.push({ deal, threw: String(err?.message ?? err).slice(0, 120) });
      console.warn('[hands] a deal could not take its people:', err);
      return { skipped: true };
    }
    // (in by the gate: setUp `via`)
    if (set.via) await cutBody(bodies.you, set.via.from, set.via.to, drawn(actors.get(roles.you)), set.people.you.yaw, alive).catch(err => console.warn('[hands] the cut by the gate failed:', err));
    /** Where each one is left, how far from where the deal stood them and whether that is inside anything; and let go. */
    const ends = {};
    const endOf = role => {
      if (!bodies[role] || ends[role]) return;
      const A = actors.get(roles[role]);
      const p = late[role] && set.people[role].stood ? { ...set.people[role], x: set.people[role].stood[0], z: set.people[role].stood[2] } : set.people[role];
      const q = late[role] || !fin[role] ? p : fin[role];
      ends[role] = { x: +A.x.toFixed(2), z: +A.z.toFixed(2), yaw: +p.yaw.toFixed(2), moved: +Math.hypot(A.x - q.x, A.z - q.z).toFixed(3), inside: !!solidName(A.x, A.z) };
    };
    const letGo = role => {
      const B = bodies[role];
      if (!B) return;
      endOf(role);
      const A = actors.get(roles[role]);
      B.release(actors.groundAt(A.x, A.z));
      delete bodies[role];
    };
    const M = measureHands(T);
    const rec = { deal, told: { ...told, seen }, length: st.length, tail: +(T.t1 - backAt).toFixed(2), set: 0, seconds: 0, skipped: false, meets: M.meets, faults: M.faults, far: M.far, lost: M.lost, jump: M.jump, people: ids.length, ends, offMark: set.off ?? 0 };
    log.push(rec);
    let toBack = null;
    const backed = new Promise(resolve => (toBack = resolve));
    let isBack = false;
    const goBack = done => {
      if (isBack) return;
      isBack = true;
      rec.set = +(actors.clock - began - (done ? st.length : 0)).toFixed(2);
      rec.seconds = +(actors.clock - began).toFixed(2);
      rec.skipped = !done;
      st.active = false;
      st.tail = !!T.back && done;
    };
    // WHAT PLAYS ON AFTER HE IS LET GO is not cut by the next hour unless that hour wants whoever is in it: they are
    // the director's `busy` meanwhile (it leaves them be, as it leaves a fight's people), and the play is cut when the
    // director asks for them all the same (a scene of theirs, a walk, a skipped hour settling everybody)
    const busied = [];
    const dressed = new Set();
    const shouted = new Set();
    const claimed = () => !director?.people || cast.some(([role, id]) => {
      if (!bodies[role]) return false;
      const P = director.people.get(id);
      return !P || (P.busy ?? 0) < 1 || P.scenes?.length > 0 || !!actors.get(id)?.route || P.going || P.down || P.inside || P.held || P.transit || P.off || P.away;
    });
    const playing = new Promise(resolve => {
      // (a deal that throws ends there, everything let go: thrown every frame, it would also stop every frame hook of
      // the stage's after it)
      const off = actors.onFrame(dt => {
        try {
          frame(dt);
        } catch (err) {
          console.warn('[hands] a deal stopped: it threw', err?.stack ?? err);
          off();
          resolve(false);
        }
      });
      const frame = dt => {
        const over = isBack ? !alive() && claimed() : !alive();
        t = over ? T.t1 : Math.min(T.t1, t + dt);
        st.t = +t.toFixed(2);
        const S = T.at(t);
        for (const [role, id] of cast) {
          if (bodies[role] || !late[role] || took[role] !== undefined) continue;
          const A = actors.get(id);
          // (there: the walk over, or as good as; or it is the last moment they could still be seen to look)
          const d = Math.hypot(A.x - late[role].at[0], A.z - late[role].at[1]);
          if (!over && ((!A.route && d < 0.8) || (d < 1.6 && t - T.t0 > (set.told.seenAt ?? 0) + 0.35))) takeBody(role, id, t);
        }
        // (whoever had not finished turning to the deal's stance when it took them finishes as it begins)
        for (const [role] of cast) {
          if (!bodies[role]) continue;
          const B = S.bodies[role];
          const k = Math.min(1, (t - took[role]) / TURN);
          const e = k * k * (3 - 2 * k);
          const { from, stood } = set.people[role];
          const p0 = set.people[role];
          // (pushed off the place it stood them: on the ground where it is now)
          const [x, y, z] = late[role] ? stood : B.x !== p0.x || B.z !== p0.z ? [B.x, actors.groundAt(B.x, B.z), B.z] : [B.x, B.y, B.z];
          bodies[role].set(x, y, z, from === undefined ? B.yaw : from + wrap(B.yaw - from) * e, B.P);
        }
        for (const [id, X] of Object.entries(S.things)) things.show(tag + id, X);
        if (dogAt && !over) {
          const D = dogAt(t - T.t0);
          putDog(dog, D.p[0], D.p[1], D.yaw, D.v, D.v ? 'walk' : 'sit');
          dog.tick(Math.min(0.1, dt));
        }
        things.fx(tag, S.fx);
        // (hands-2: a thing to wear put on: the figure wears it from this moment. Cut short, the hour dresses him after)
        // (hands-2: a shout: whoever of ours is near and free turns to look (director.js look))
        for (const [k, X] of (T.shouts ?? []).entries()) {
          if (shouted.has(k) || t < X.t - 1e-9 || over) continue;
          shouted.add(k);
          const W = S.bodies[X.who];
          if (W) director?.look?.(W.x, W.z, { skip: ids });
        }
        for (const [k, D] of (T.dresses ?? []).entries()) {
          if (dressed.has(k) || t < D.t - 1e-9 || !told.wear || over) continue;
          dressed.add(k);
          wearOn(roles[D.who], told.wear);
        }
        st.things = Object.entries(S.things).map(([id, X]) => ({ id, holder: X.holder, show: X.show, at: X.at.map(v => +v.toFixed(3)) }));
        // (his part done: he is let go, and the hour is his)
        if (!isBack && !over && T.back && t >= backAt - 1e-9) {
          for (const role of T.back.who) letGo(role);
          // (the room shrinks to whoever is still at it: the player's next walk does not start inside it)
          if (ring) {
            rec.room = ring.figures?.() ?? null;
            ring.close();
            ring = null;
            const rest = cast.filter(([role]) => bodies[role]).map(([role]) => set.people[role]);
            if (rest.length && R0?.open && !R0.state?.on) ring = R0.open({ c: [rest[0].x, rest[0].z], r: 0.45 * (rest[0].scale ?? 1) + 0.2, keep: ids, quiet: true });
          }
          for (const [role, id] of cast) {
            const P = bodies[role] ? director?.people?.get(id) : null;
            if (!P) continue;
            P.busy = (P.busy ?? 0) + 1;
            busied.push(P);
          }
          goBack(true);
          toBack(rec);
        }
        if (t >= T.t1 - 1e-9) {
          off();
          resolve(!over);
        }
      };
    });
    // (what is left of it after he is let go plays on: the rest is done when it is over, whoever is waiting)
    (async () => {
      const done = await playing;
      things.clear(tag);
      // (where the deal left them, before anybody is taken back out by a gate)
      for (const [role] of cast) endOf(role);
      // (out again by the way he went in. A deal cut short puts him there at once)
      if (set.via) {
        const { from, to } = set.via;
        const yawOut = Math.atan2(from[0] - to[0], from[1] - to[1]);
        if (done) await cutBody(bodies.you, to, from, set.people.you.yaw, yawOut, alive);
        else bodies.you.walk(from[0], actors.groundAt(from[0], from[1]), from[1], yawOut, 0);
        rec.out = { x: +from[0].toFixed(2), z: +from[1].toFixed(2), inside: !!solidName(from[0], from[1]) };
      }
      for (const [role] of cast) letGo(role);
      for (const P of busied) P.busy = Math.max(0, (P.busy ?? 1) - 1);
      // (the dog bought: his now, at your heels. Cut short, he is yours all the same, from where he got to)
      if (dog) follow(dog, roles.buyer, block);
      if (ring) {
        rec.room ??= ring.figures?.() ?? null;
        ring.close();
      }
      for (const id of Object.values(roles)) coming.delete(id);
      const missed = Object.keys(late).filter(role => took[role] === undefined);
      if (set.unseen || missed.length) rec.unseen = true;
      if (Object.keys(late).length) rec.joined = Object.fromEntries(Object.keys(late).map(role => [role, took[role] === undefined ? null : +(took[role] - T.t0).toFixed(2)]));
      goBack(done);
      st.tail = false;
      if (cur === st) cur = null;
      toBack(rec);
    })().catch(err => {
      console.warn('[hands] a deal did not finish cleanly:', err);
      things.clear(tag);
      ring?.close();
      for (const P of busied) P.busy = Math.max(0, (P.busy ?? 1) - 1);
      for (const [role] of cast) bodies[role]?.release();
      if (cur === st) cur = null;
      toBack(rec);
    });
    return backed;
  }
  return {
    perform,
    /**
     * A performed step's scene has begun (the director's hooks.prepare): whoever it needs from further off starts
     * coming. THE BINS: the neighbour who saw walks to a place a few steps from the bin, on open ground, the nearest
     * such to where they are, and faces it; by the time he has walked to the bin they are standing there.
     */
    prepare({ deal, roles, told = {}, block = null, alive = () => true }) {
      // (a home piece to be bought is built now, while he walks over: things.js kitKind)
      if (typeof told.goods === 'string' && told.goods.startsWith('kit:')) {
        ensure();
        things.ready(told.goods);
      }
      // (a thing to wear to be put on: the figure in it baked now, while he walks over, not at the moment it goes on)
      if (told.wear && roles.buyer) wearOn(roles.buyer, told.wear, true);
      if (deal !== 'bins' || !roles.neighbour || !actors.has(roles.neighbour) || !actors.has(roles.you)) return;
      const spot = map?.BLOCKS?.[block]?.spots?.[told.spot];
      const [N, Y] = [actors.get(roles.neighbour), actors.get(roles.you)];
      coming.delete(roles.neighbour);
      if (!Array.isArray(spot) || Math.hypot(N.x - spot[0], N.z - spot[1]) <= SEEN_FROM[0] + 0.6) return;
      // (NOT BEFORE HE HAS PASSED THEM: sent over at once, the neighbour walked the lane to the bins ahead of him,
      // slower, and he was held up behind them for three seconds and never got to the bin: seen 2026-11-18)
      const [dy, dn] = [() => Math.hypot(Y.x - spot[0], Y.z - spot[1]), () => Math.hypot(N.x - spot[0], N.z - spot[1])];
      actors.until(() => !alive() || dy() < 6 || dy() < dn() - 3).then(() => {
        if (!alive()) return;
        let best = null;
        for (let k = 0; k < 12; k++) {
          const a = (k * Math.PI) / 6;
          const q = [spot[0] + Math.sin(a) * SEEN_FROM[0], spot[1] + Math.cos(a) * SEEN_FROM[0]];
          if (actors.solidAt?.(q[0], q[1]) || actors.onRoad?.(q[0], q[1]) || actors.lowNear?.(q[0], q[1], 0.4) || (actors.free && !actors.free(q[0], q[1], 0.6, [roles.neighbour, roles.you]))) continue;
          const d = Math.hypot(N.x - q[0], N.z - q[1]);
          if (!best || d < best.d) best = { q, d };
        }
        if (!best) return;
        coming.set(roles.neighbour, { q: best.q, v: COME });
        actors.walkTo(roles.neighbour, best.q[0], best.q[1], { v: COME, how: best.d < 16 ? 'straight' : 'path', yaw: Math.atan2(spot[0] - best.q[0], spot[1] - best.q[1]) }).catch(() => {});
      });
    },
    /** For the director's walk up to somebody a deal is done with: the headings the two stand at (hooks.stance). */
    stance({ at: a, centreAt: c }) {
      const [mover, centre] = openYaws(a[0], a[1], c[0], c[1]);
      return { mover, centre };
    },
    /**
     * For the tools: what is playing (`active` while the player is in it; `tail` while it plays on after he is let go),
     * every deal played (`log`), and what is left on stage of them (`shown` things, `bodies` still hand-posed: both
     * nothing once a deal is over).
     */
    get state() {
      return { ...(cur ?? { active: false, tail: false }), log, skips, shown: things?.shown ?? [], bodies: puppets?.live?.size ?? 0 };
    },
  };
}
