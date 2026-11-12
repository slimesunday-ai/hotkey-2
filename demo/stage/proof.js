// THE PROOF that hotkey 2's agents can live in the 3D city (round 2, the spike). Not the game's stage: a handful of
// scripted scenes on the lower-level pieces of actors.js, each ending in a measurement or a picture.
//
//   /demo/?proof=all     plays every scene once, for a person watching
//   /demo/?proof=hold    builds the cast and waits: demo/tools/proof-shots.mjs drives the scenes and takes the pictures
//
// Scenes:  lineup (ten named agents, ten looks) · set (the ten on spots of the proposed blocks) · walk (one agent,
// the bar to the park along the sidewalk, timed) · rob (rob_lunge_grab with the victim's hit_stumble_back, bills) ·
// cook (cook_stir with its cook set) · pass (brush_pass, both hands in sync) · bubble (a line over a head)
import { createActors } from './actors.js';
// the proof was staged on the first proposal, the plaza ring, and stays there: the game's set is citymap.js
import { BLOCKS, LINKS, VIEWS } from './citymap-plaza.js';
import { agentNames, buildCast } from '../../src/cast.mjs';
import { CITY as GAME_MAP } from '../../src/map.mjs';

const SEED = 1;

/** Where the ten stand in the `set` scene: [block, spot, dx, dz] off the spot, so two on one block don't overlap. */
const STANDS = [
  ['bar', 'street', 0, 0], ['bar', 'street', -1.6, 0.3], ['market', 'street', 0, 0], ['projects', 'street', 0, 0],
  ['park', 'street', 0, 0], ['park', 'street', 2.2, -1.4], ['precinct', 'street', 0, 0], ['uptown', 'street', 0, 0],
  ['corner', 'street', 0, 0], ['docks', 'street', 0, 0],
];

export async function startProof(demo, mode) {
  const { city, CITY } = demo;
  const actors = await createActors(demo);
  // (the map's pins, mapmarks.js, mark the game's set now: Fit Street. This proof stands on the plaza, without them)
  const marks = { show() {} };
  const names = agentNames(SEED, 10);
  const cast = buildCast(SEED, GAME_MAP, { street: { regularsPerBlock: 6 } });
  const ids = names.map(n => n.toLowerCase());

  // the city's own stage props (bills, the "?!"): made on their own, without the city's stage or sim
  const { createProps } = await import(`${CITY}stage/props.js`);
  const props = createProps({ scene: city.scene, mats: { tier: null }, night: demo.Q.get('tod') === 'night', layer: null });
  actors.onFrame(dt => props.frame(dt, city.camera));

  const proof = { actors, marks, names, ids, cast, props, results: {}, waiting: null, driven: mode === 'hold', log: [] };
  const note = text => {
    proof.log.push(`[${actors.clock.toFixed(1)}s] ${text}`);
    console.log('proof:', text);
  };

  /** Cuts the camera to a pose (orbit mode, so a person can still drag it). */
  function view({ pos, tgt, fov = 50, fog = null }) {
    const sh = [(pos[0] + tgt[0]) / 2, (pos[2] + tgt[2]) / 2, Math.max(16, Math.hypot(pos[0] - tgt[0], pos[2] - tgt[2]) * 0.8)];
    city.VIEWS.hk2 = { pos, tgt, fov, sh, ...(fog ? { fog } : {}) };
    city.cam?.toOrbit({ instant: true });
    city.setView('hk2');
  }

  /**
   * A picture point. Driven by the screenshot tool, the city's loop stops here until the tool has its picture and
   * calls proof.release(); with a person watching it is a short pause.
   */
  async function shot(name) {
    if (!proof.driven) {
      await actors.seconds(0.6);
      return;
    }
    await new Promise(resolve => {
      city.pauseLoop?.(true);
      proof.waiting = name;
      proof.release = () => {
        proof.waiting = null;
        city.pauseLoop?.(false);
        resolve();
      };
    });
  }

  const spot = (block, name = 'street') => BLOCKS[block].spots[name];
  /** Everyone back on their spots of the set, out of the way of a close scene. */
  const toSet = () => STANDS.forEach(([block, name, dx, dz], k) => {
    const [x, z] = spot(block, name);
    actors.place(ids[k], x + dx, z + dz, Math.atan2(18 - x, -18 - z));
  });
  const scenes = {
    /** Ten named agents, each in the city's own character rig, each look rolled from its name. */
    async lineup() {
      const [px, pz] = [18, -10.8];
      ids.forEach((id, k) => {
        const x = px + (k - 4.5) * 1.35;
        if (!actors.all().some(A => A.id === id)) actors.add({ id, name: names[k], x, z: pz, ry: 0 });
        else actors.place(id, x, pz, 0);
      });
      actors.tags(true);
      view({ pos: [18, 2.3, -4.7], tgt: [18, 1.5, -10.8], fov: 72 });
      await actors.seconds(1.5);
      proof.results.lineup = ids.map(id => ({ id, look: actors.get(id).look }));
      await shot('lineup');
      view({ pos: [14.2, 2.0, -7.2], tgt: [14.6, 1.5, -10.8], fov: 50 });
      await actors.seconds(0.8);
      await shot('lineup-close');
    },

    /** The ten standing on spots of the proposed blocks, seen by the one camera that holds the set. */
    async set() {
      toSet();
      proof.results.set = STANDS.map(([block, name], k) => ({ agent: names[k], block, spot: name, sidewalk: +actors.laneDistance(...spot(block, name)).toFixed(2) }));
      marks.show(true);
      view(VIEWS.set);
      await actors.seconds(1.5);
      await shot('set');
      view(VIEWS.overhead);
      await actors.seconds(1.5);
      await shot('overhead');
      marks.show(false);
    },

    /** One agent walks from the bar's street spot to the precinct's, along the sidewalk and over Central Ave. Timed. */
    async walk() {
      const id = ids[0];
      const A = actors.get(id);
      toSet();
      actors.place(id, ...spot('bar'), 0);
      actors.tags(true);
      view({ pos: [22, 13, -2], tgt: [38, 1, -6], fov: 58 });
      await actors.seconds(1);
      const going = actors.walkTo(id, ...spot('precinct'), { v: 1.5 });
      await actors.seconds(2.5);
      await shot('walk-start');
      await actors.until(() => A.z < -2.5);
      await shot('walk-mid');
      const out = await going;
      const straight = +Math.hypot(spot('bar')[0] - spot('precinct')[0], spot('bar')[1] - spot('precinct')[1]).toFixed(1);
      proof.results.walk = { from: 'bar', to: 'precinct', straight, seconds: +out.seconds.toFixed(1), metres: +out.metres.toFixed(1), how: out.how, speed: 1.5 };
      note(`walk bar → precinct (${out.how}): ${out.seconds.toFixed(1)} s, ${out.metres.toFixed(1)} m`);
      await shot('walk-end');
      // a straight walk over the plaza's paving, which is on no sidewalk graph
      actors.place(id, ...spot('bar'), 0);
      const over = await actors.walkTo(id, ...spot('park'), { v: 1.5, how: 'straight' });
      proof.results.walkPlaza = { from: 'bar', to: 'park', seconds: +over.seconds.toFixed(1), metres: +over.metres.toFixed(1), how: over.how, speed: 1.5 };
    },

    /** The same hop back on the crowd's one-way lanes: slow (minutes), so it is not in the default run. */
    async lane() {
      const id = ids[0];
      actors.place(id, ...spot('precinct'), 0);
      view({ pos: [22, 30, -2], tgt: [38, 1, -6], fov: 58 });
      const lane = await actors.walkTo(id, ...spot('bar'), { v: 1.5, how: 'lane' });
      proof.results.walkLane = { from: 'precinct', to: 'bar', seconds: +lane.seconds.toFixed(1), metres: +lane.metres.toFixed(1), how: lane.how, speed: 1.5 };
      note(`walk precinct → bar (${lane.how}): ${lane.seconds.toFixed(1)} s, ${lane.metres.toFixed(1)} m`);
    },

    /** A pair clip: the robber's lunge and grab, the victim's stumble 0.34 s later, bills out of the pocket. */
    async rob() {
      const [robber, victim] = [ids[8], ids[3]];
      const [x, z] = spot('corner');
      // on the plaza's paving inside the corner, the robber facing south at the victim, seen from the side
      toSet();
      actors.place(robber, x - 2.3, z + 7.0, 0);
      actors.place(victim, x - 2.3, z + 7.0 + 1.15, Math.PI);
      view({ pos: [x - 9.8, 4.4, z + 9.6], tgt: [x - 2.3, 1.2, z + 7.6], fov: 32 });
      await actors.seconds(1.2);
      await shot('rob-before');
      const playing = actors.pair(robber, victim, 'rob_lunge_grab');
      const R = actors.get(robber);
      await actors.until(() => R.clipName === 'rob_lunge_grab' && R.clipT >= 0.44);
      const V = actors.get(victim);
      props.burst(V.x, 1.1, V.z, 10, 0, 1.2);
      await shot('rob-contact');
      await actors.until(() => R.clipT >= 0.8);
      await shot('rob-grab');
      const out = await playing;
      proof.results.rob = { ...out, robber: names[8], victim: names[3], victimClipSeen: V.clipName };
      await actors.seconds(0.6);
      actors.stop(robber);
      await actors.play(robber, 'run_getaway').catch(() => {});
      actors.stop(robber);
    },

    /** A single clip with the clip's own prop: the cook at the pot. */
    async cook() {
      const id = ids[5];
      const [x, z] = spot('park');
      toSet();
      actors.place(id, x - 6, z + 2.5, Math.PI / 2);
      view({ pos: [x - 3.2, 2.4, z + 7.6], tgt: [x - 5.5, 1.1, z + 2.5], fov: 36 });
      await actors.seconds(0.8);
      const A = actors.get(id);
      actors.play(id, 'cook_stir');
      await actors.until(() => A.clipName === 'cook_stir' && A.clipT >= 1.3);
      proof.results.cook = { clip: 'cook_stir', prop: [...A.props.keys()] };
      await shot('cook');
      await actors.seconds(1.2);
      await shot('cook-2');
      actors.stop(id);
    },

    /** The deal's hand-off: brush_pass is its own partner, both started on the same frame. */
    async pass() {
      const [dealer, buyer] = [ids[1], ids[6]];
      // on the plaza, clear of the cars, seen from the side
      const [x, z] = [25, -6];
      toSet();
      actors.place(dealer, x, z, Math.PI / 2);
      actors.place(buyer, x + 1.02, z, -Math.PI / 2);
      view({ pos: [x + 0.5, 2.3, z + 6.5], tgt: [x + 0.5, 1.3, z], fov: 34 });
      await actors.seconds(1.0);
      const D = actors.get(dealer);
      const playing = actors.pair(dealer, buyer, 'brush_pass');
      await actors.until(() => D.clipName === 'brush_pass' && D.clipT >= 0.3);
      await shot('pass');
      proof.results.pass = await playing;
    },

    /** An out-loud line: a white bubble that follows the head while the speaker walks. */
    async bubble() {
      const id = ids[2];
      const [x, z] = spot('market');
      actors.place(id, x, z, Math.PI / 2);
      actors.tags(false);
      toSet();
      actors.place(id, x, z, Math.PI / 2);
      view({ pos: [x + 9, 4.2, z - 1.4], tgt: [x + 1.5, 2.2, z], fov: 44 });
      await actors.seconds(0.8);
      actors.play(id, 'talk_gesture');
      actors.say(id, 'Two blocks over they pay double. Who told you to sell here?', { time: 9 });
      await actors.seconds(1.4);
      await shot('bubble');
      actors.stop(id);
      actors.stepTo(id, x + 4, z, { v: 1.2 });
      await actors.seconds(2.2);
      await shot('bubble-moved');
      proof.results.bubble = { speaker: names[2], follows: true };
    },
  };

  /** The walk between every pair of blocks, from the city's trip planner (either way) and on its one-way lanes. */
  proof.measure = async () => {
    const linked = new Set(LINKS.flatMap(([a, b]) => [`${a}>${b}`, `${b}>${a}`]));
    const rows = [];
    const blocks = Object.keys(BLOCKS);
    for (const a of blocks) for (const b of blocks) {
      if (a === b) continue;
      const [ax, az] = spot(a);
      const [bx, bz] = spot(b);
      const trip = await actors.tripOf(ax, az, bx, bz);
      const lane = actors.routeMetres(ax, az, bx, bz);
      rows.push({ from: a, to: b, linked: linked.has(`${a}>${b}`), straight: +Math.hypot(ax - bx, az - bz).toFixed(1),
        trip: trip ? +trip.metres.toFixed(1) : null, tripSeconds: trip ? +trip.seconds.toFixed(1) : null, lane: lane === null ? null : +lane.toFixed(1) });
    }
    return rows;
  };

  proof.run = async list => {
    for (const name of list) {
      note(`scene ${name}`);
      await scenes[name]();
    }
    proof.done = true;
    note('done');
  };
  proof.scenes = Object.keys(scenes);
  proof.view = view;

  // the ten are there from the start, whichever scene comes first
  ids.forEach((id, k) => actors.add({ id, name: names[k], x: 18 + (k - 4.5) * 1.35, z: -10.8, ry: 0 }));
  if (mode === 'all') proof.run(proof.scenes.filter(name => name !== 'lane'));
  else if (scenes[mode]) proof.run([mode]);
  return proof;
}
