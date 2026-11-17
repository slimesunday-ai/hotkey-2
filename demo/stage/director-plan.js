// The director's plan for one hour: PURE (no three, no page), so node can test it (test/stage.test.mjs).
//
// An hour line of the feed (src/season.mjs) plus the events this viewer may see become:
//   scenes     one per staged event, in feed order, each with the moment it starts and its steps made ready to play
//   ends       where every agent is when the hour is over: its block, the spot it keeps, and whether it is held
//   routines   what each agent does while it has no scene of its own (nobody stands frozen)
//   npcs       where each named NPC stands this hour and what it is doing
//   rate       per block, how much faster than life its scenes must run to fit the hour
// demo/stage/director.js plays the plan on the city's walkers.
import { ACTION_CLIPS, NATIVE } from '../../src/clips.mjs';

/** An hour at 1×, as the panels count it (demo/hud/logic.js HOUR_MS): the ticker and the stage keep one clock. */
export const HOUR_MS = 10000;
const LEAD = 300;
const TAIL = 900;
/**
 * A scene starts this far ahead of its ticker row: the action first, then the row and the roll's needle that say how
 * it came out. It also leaves the back half of the hour for the scenes to finish in.
 */
const AHEAD = 0.55;

// How long an event holds the floor at 1×, mirroring the panels' ticker (demo/hud/logic.js WEIGHT), so a scene and
// its ticker row (and the roll's needle over it) come up together. An event the ticker skips takes no time.
const WEIGHT = { roll: 2800, big: 1500, talk: 1100, plain: 650, sealed: 320, quiet: 0 };
const QUIET = new Set(['move', 'move:guard', 'rest', 'idle', 'held:jail', 'held:clinic', 'work:none', 'night:sleep']);
const TALK = new Set(['say', 'say:block', 'message']);

export function weightOf(event) {
  if (event.sealed) return WEIGHT.sealed;
  if (event.data?.roll) return WEIGHT.roll;
  if (QUIET.has(event.kind)) return WEIGHT.quiet;
  if (event.big) return WEIGHT.big;
  if (TALK.has(event.kind)) return WEIGHT.talk;
  return WEIGHT.plain;
}

// ── steps ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Actions that are a way of getting somewhere. Their clips, when they have one, play over the walk. */
export const GOING = new Set(['walk', 'run', 'sneak', 'approach', 'flee', 'limp', 'carry', 'led_away', 'evicted', 'patrol']);
/** Actions someone does in the background of a scene: they start and the scene moves on. */
export const AMBIENT = new Set(['film', 'cower', 'crave', 'idle', 'lookout', 'listen']);
/** Actions that leave the actor on the ground or in place until the hour is over. */
export const LASTING = new Set(['lie_hurt', 'sit_cell', 'sleep', 'sit']);

/** Metres a second for a way of going (the city walks its own agents at 1.1 to 2.6). */
export const PACE = { walk: 2.6, approach: 2.2, sneak: 1.3, run: 4.2, flee: 4.6, limp: 1.2, carry: 1.6, led_away: 1.4, evicted: 1.2, patrol: 1.05 };
/** The hurry of a trip between blocks: the top of the city's own walking range. */
export const HURRY = 2.6;

/**
 * About how long a step holds its scene at 1×, in ms: measured on the page (a walk up to someone, the clip, the turn
 * to face). Only used to tell how much faster a busy block must play to fit the hour; the page plays real lengths.
 */
const NOMINAL = {
  walk: 1800, approach: 2000, run: 2000, flee: 2000, sneak: 2200, limp: 2500, carry: 2500, led_away: 2500, evicted: 2500, patrol: 2500,
  talk: 1800, whisper: 1800, phone: 2400, text: 1500, hand_off: 1300, haggle: 1600, bribe: 2200, stash: 3600, cook: 1500, build: 1500,
  hold_up: 2100, hands_up: 1000, grab: 2000, pat_down: 1500, punch: 1500, haymaker: 1600, scuffle: 1700, shove: 1200, shoot: 2200,
  get_shot: 1400, stumble: 1000, fall: 1500, get_up: 3400, pick_lock: 1500, rummage: 1500, cuff: 3500,
};
const nominalOf = step => (AMBIENT.has(step.action) ? 0 : NOMINAL[step.action] ?? 1300);

// src/clips.mjs lists an action's clips without saying how they go together. Most lists are ALTERNATIVES (three ways
// to gesture while talking): one is picked per step, by the actor, so two people don't move alike. These few are
// played IN ORDER instead: the first starts the action (and chains by itself into its loop, where the city's clip
// says so: a phone coming up into a call), the second ends it.
export const IN_ORDER = Object.freeze({
  phone: ['phone_up'],
  stash: ['floorboard_lift', 'floorboard_close'],
  hold_up: ['aim_draw'],
  haymaker: ['haymaker'],
  shove: ['shove_walk'],
  bribe: ['bribe_pass'],
  scuffle: ['scuffle_pair'],
  led_away: ['cuffed_walk'],
  deal: ['deal_pace'],
});
/** What the one on the receiving end does when the city's clip names no partner of its own. */
export const REACTION = Object.freeze({ shove: 'hit_stumble_back' });

const hashOf = text => {
  let h = 2166136261;
  for (let k = 0; k < text.length; k++) h = Math.imul(h ^ text.charCodeAt(k), 16777619);
  return h >>> 0;
};

/** One stage step made ready: its clips by name, in the order to play them, and how the director should treat it. */
export function stepPlan(step, salt = 0) {
  const all = ACTION_CLIPS[step.action];
  if (!all) throw new Error(`no clips for the action ${step.action}`);
  // (`step.clip`: a clip of the city's own named outright by whoever made the step, the run's work: a broom, a hammer, a
  // shelf. The action still says how it is played: a going, a thing done, or the background)
  const clips = step.clip ? [step.clip] : IN_ORDER[step.action] ?? (all.length > 1 ? [all[hashOf(`${step.actor}/${step.action}/${salt}`) % all.length]] : [...all]);
  const mode = GOING.has(step.action) ? 'go' : AMBIENT.has(step.action) ? 'ambient' : 'act';
  const out = { actor: step.actor, action: step.action, mode, clips, native: NATIVE.includes(step.action) };
  if (REACTION[step.action]) out.reaction = REACTION[step.action];
  if (step.target) out.target = step.target;
  if (step.spot) out.spot = step.spot;
  if (step.say) out.say = step.say;
  if (LASTING.has(step.action)) out.lasting = true;
  // (a fist that draws blood: the scene's author asks for it on the step, gore.js; nothing bleeds unasked)
  if (step.blood) out.blood = true;
  return out;
}

// ── where everyone ends ───────────────────────────────────────────────────────────────────────────────────────────
/**
 * Who this event puts away or lets out: [[agentId, 'jail' | 'clinic' | null]]. Read off the scene itself, so it holds
 * for every kind the engine has or gets: whoever is led away goes to jail, whoever is left lying hurt goes to the
 * clinic, and a held or release event says so outright.
 */
function heldBy(event) {
  const who = event.who?.agent;
  if (event.kind === 'held:jail') return [[who, 'jail']];
  if (event.kind === 'held:clinic') return [[who, 'clinic']];
  if (event.kind === 'release:jail' || event.kind === 'release:clinic') return [[who, null]];
  const out = [];
  for (const step of event.stage?.steps ?? []) {
    if (step.action === 'led_away') out.push([step.actor, 'jail']);
    else if (step.action === 'lie_hurt') out.push([step.actor, 'clinic']);
  }
  return out;
}

/**
 * Where every agent is at the end of the hour: { id: { block, spot, held } }. The block is the line's own. `held`
 * is read off the WHOLE line's events (not only the ones this viewer saw), carried over from `prev` when the hour says
 * nothing. `spot` is where the agent's own business put it (its pad, a counter), else the street.
 *
 * The events do not always say it: a robbed agent can end the hour in the clinic with no step that shows it. So when
 * the caller has the season's state at the end of this hour, it passes `truth` ({ id: 'jail' | 'clinic' | null }) and
 * that wins.
 */
export function endsOf(line, prev = {}, truth = null) {
  const ends = {};
  const said = {};
  for (const [id, a] of Object.entries(line.agents ?? {})) {
    // the line says who is held, since the engine began writing `state` on it (older lines do not: the events and
    // the caller's `truth` stand in)
    if (a.state === 'jail' || a.state === 'clinic' || a.state === 'free') said[id] = a.state === 'free' ? null : a.state;
    // (a held agent's block on the line is the place itself: it keeps the block it was held from, for the walk out)
    const block = a.block === 'jail' || a.block === 'clinic' ? prev[id]?.block ?? a.block : a.block;
    ends[id] = { block, spot: 'street', held: prev[id]?.held ?? null };
  }
  for (const event of line.events ?? []) {
    for (const [who, held] of heldBy(event)) if (who && ends[who]) ends[who].held = held;
    // the spot an agent's own event names is where it stays (the first role of an event is the one acting)
    const actor = Object.values(event.who ?? {})[0];
    if (actor && ends[actor] && event.spot && event.spot !== 'street' && event.block === ends[actor].block) ends[actor].spot = event.spot;
  }
  for (const [id, held] of Object.entries({ ...said, ...(truth ?? {}) })) if (ends[id] && held !== undefined) ends[id].held = held;
  return ends;
}

// ── routines ──────────────────────────────────────────────────────────────────────────────────────────────────────
const WORK_ROUTINE = { cook: 'cook', dealer: 'pace', gunrunner: 'build', smuggler: 'smoke', robber: 'lean', muscle: 'guard', informant: 'watch' };
const AFTER_MOVE = { cook: 'idle', dealer: 'lookout', gunrunner: 'idle', smuggler: 'smoke', robber: 'lean', muscle: 'guard', informant: 'watch' };

/**
 * What an agent does while no scene has it: an ACTION name. By where it is held, else by its move this hour and its
 * class, so a resting cook, a muscle on guard and a dealer on a corner don't stand the same way.
 */
export function routineOf(cls, entry, held = null) {
  if (held === 'jail') return 'sit_cell';
  if (held === 'clinic') return 'lie_hurt';
  const verb = entry?.move?.verb ?? 'rest';
  if (verb === 'rest') return 'rest';
  if (verb === 'work') return entry.ok === false ? 'idle' : WORK_ROUTINE[cls] ?? 'idle';
  if (verb === 'offer') return 'text';
  if (verb === 'stash') return 'idle';
  if (verb === 'attack') return 'lean';
  return AFTER_MOVE[cls] ?? 'idle';
}

// ── the plan ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** Scenes that are only somebody getting somewhere or staying put: they are set going and nothing waits for them. */
const PASSIVE = /^(move|held:|release:|night:sleep)/;

/** The block a scene plays on. A held agent's hour plays in its room. */
const sceneBlock = event => event.block ?? (event.kind === 'held:jail' ? 'jail' : event.kind === 'held:clinic' ? 'clinic' : null);

/**
 * The hour as a plan. `seen` is what this viewer may be shown (the whole line's events when watching); `classes` is
 * { agentId: cls } for the routines; `prev` is the last hour's `ends`; `held` is the season's own word on who is
 * held as the hour ends ({ id: 'jail' | 'clinic' | null }), when the caller has it.
 */
export function planHour(line, { seen = line.events ?? [], classes = {}, prev = {}, held = null } = {}) {
  const staged = seen.filter(e => e.stage && e.stage.steps?.length && sceneBlock(e));
  // the ticker's clock: every seen event in feed order takes its weight, squeezed to fit the hour
  const weights = seen.map(weightOf);
  const sum = weights.reduce((a, b) => a + b, 0);
  const room = HOUR_MS - LEAD - TAIL;
  const k = sum > room ? room / sum : 1;
  const at = new Map();
  let t = LEAD;
  seen.forEach((event, i) => {
    at.set(event, Math.round(t));
    t += weights[i] * k;
  });

  const scenes = staged.map((event, index) => {
    const steps = event.stage.steps.map(step => stepPlan(step, `${line.t}/${index}`));
    const actors = [...new Set(steps.flatMap(s => (s.mode === 'ambient' ? [] : [s.actor, s.target])).filter(Boolean))];
    const everyone = [...new Set(steps.flatMap(s => [s.actor, s.target]).filter(Boolean))];
    return {
      index, kind: event.kind, block: sceneBlock(event), spot: event.stage.spot ?? event.spot ?? 'street', big: !!event.big, sealed: !!event.sealed,
      passive: PASSIVE.test(event.kind),
      at: Math.round(at.get(event) * AHEAD), steps, actors, everyone, nominal: steps.reduce((ms, s) => ms + nominalOf(s), 0),
    };
  });

  // One person's scenes play one after another. When the busiest person on a block has more to do than the hour
  // holds (at nominal lengths), that block's scenes run faster.
  const load = {};
  for (const scene of scenes) {
    if (scene.passive) continue;
    for (const id of scene.actors) {
      const key = `${scene.block}|${id}`;
      load[key] = (load[key] ?? 0) + scene.nominal;
    }
  }
  const rate = {};
  for (const [key, ms] of Object.entries(load)) {
    const block = key.slice(0, key.indexOf('|'));
    rate[block] = Math.min(1.8, Math.max(rate[block] ?? 1, ms / (HOUR_MS - LEAD - TAIL)));
  }

  // and a scene that would run past the end of the hour at its own pace plays faster by as much as it needs
  for (const scene of scenes) {
    const left = Math.max(1500, HOUR_MS - TAIL - scene.at);
    // (never faster than 1.8×: past that a scene's clips change more than twice a second and it reads as twitching)
    scene.rate = scene.passive ? 1 : +Math.min(1.8, Math.max(rate[scene.block] ?? 1, scene.nominal / left)).toFixed(2);
  }

  const ends = endsOf(line, prev, held);
  const busy = new Set(scenes.filter(s => !s.passive).flatMap(s => s.actors));
  const routines = {};
  // (a routine is what someone does BEFORE and between their scenes. Whoever is only put away this hour is not lying
  // hurt or sitting in a cell from its first second: the scene that does it comes first. It used to be: the robbed
  // player lay down, got up for the hold-up, and went down again. Once they are in, the director's own rule for a
  // held person takes over, whatever the routine says)
  for (const [id, end] of Object.entries(ends)) routines[id] = { action: routineOf(classes[id], line.agents[id], prev[id]?.held ? end.held : null), hasScene: busy.has(id) };

  const npcs = {};
  // (`clips`: the city's clips this person's routine plays, named outright: a neighbour's sweeping, a stall's
  // stocking. `face`: whom they keep their face to, or their back to (`back`): the run's moods)
  for (const [block, list] of Object.entries(line.npcs ?? {})) for (const n of list) npcs[n.id] = { block, spot: n.spot ?? 'street', action: n.action ?? 'idle', role: n.role, clips: n.clips ?? null, face: n.face ?? null, back: n.back ?? null };

  return { t: line.t, day: line.day, hour: line.hour, scenes, ends, routines, npcs, rate, police: line.police ?? [] };
}

/** Every action a plan can ask for, with its clips: for the test that nothing is left without one. */
export function actionsWithoutClips(actions) {
  return actions.filter(a => !ACTION_CLIPS[a] || (!NATIVE.includes(a) && ACTION_CLIPS[a].length === 0));
}
