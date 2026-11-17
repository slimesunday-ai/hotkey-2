// THE FIGHT'S INTERFACE, AS DATA (the run's frame on the fight page): what the dock offers while you choose, the
// meters while a round is on, and the result card after it. Pure: the fight's rules' data and a fight's state in,
// words and numbers out, no DOM, so it is tested in node (test/fight-dock.test.mjs). The page draws it in the run's
// own parts (demo/fight/index.js; demo/run/ui.css and skin.css).
//
//   dockOf({ pick, results, site })   → { cards: five loadouts (keys 1 to 5), levels: the three, go, label, custom }
//   metersOf(F)                       → { health, vest, ammo, left, time, ally }: every running risk, a meter
//   cardOf(R, F, site, { tryout })    → the result card: { tone, kicker, head, body, chips, advice, meta }
//   siteWords(site, text)             the rules' words said for a site (its level names, and no stairs where it has none)
import { PRESETS, WEAPONS, GEAR, ALLY, LEVELS, CAP, buildName, presetOf } from '../../src/fight/data.mjs';

/** The five loadouts, in the order of their keys (1 to 5). */
export const PRESET_KEYS = Object.keys(PRESETS);
/** The three levels of the stop, in the order the dock shows them (↑ ↓ step through them). */
export const LEVEL_KEYS = Object.keys(LEVELS);
export const LEVEL_WORD = Object.freeze({ easy: 'Easy', real: 'Real', hard: 'Hard' });

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** Seconds as the page says them: "38 s", "1:12". */
export const secs = s => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : `${Math.round(s)} s`);
/** A clock: "0:07". */
export const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** A level's name AT A SITE: its own (sites.js `levels`), else the rules'. */
export const levelName = (site, id) => site?.levels?.[id] ?? LEVELS[id]?.name ?? id;

/**
 * THE RULES' WORDS SAID FOR A SITE: a level's name as the site has it ("Elm St after dark" is the ELM ST stop's), and
 * where there are no stairs to walk down, the lot to back off across.
 */
export function siteWords(site, text) {
  let t = String(text ?? '');
  for (const id of LEVEL_KEYS) if (LEVELS[id].name !== levelName(site, id)) t = t.split(LEVELS[id].name).join(levelName(site, id));
  if (site?.stairs) return t;
  return t.replace(/went back down the stairs/g, 'backed off across the lot').replace(/walk back down the stairs/g, 'back off across the lot').replace(/come up the stairs/g, 'come in');
}

/** What a build carries, in a few words: "six-shot · stab vest · Cousin Earl". */
export function contentsOf(b) {
  // (Cousin Earl is Earl here, as over his head: the card has the room of about thirty letters at 1280)
  return [WEAPONS[b.weapon]?.name ?? b.weapon, ...(b.gear ?? []).map(g => GEAR[g]?.name ?? g), b.ally ? ALLY.name.replace(/^Cousin /, '') : null].filter(Boolean).join(' · ');
}
/** A build's name: a loadout's own ("Handgun + vest"), else what it carries. */
export const buildLabel = b => (presetOf(b) ? PRESETS[presetOf(b)].name : cap(buildName(b)));

/** How a build did the last time at a level, in a few words, with its tone (the run's: gain, loss, mute, news). */
export function lastWords(R, level = null) {
  if (!R) return { tone: 'none', text: level ? `not tried on ${LEVEL_WORD[level]}` : 'not tried yet' };
  if (R.result === 'won') return { tone: 'gain', text: `won in ${secs(R.seconds)} · ${R.hp} health left` };
  if (R.result === 'lost') return { tone: 'loss', text: `went down · ${R.dropped} of ${R.of} dropped` };
  if (R.result === 'left') return { tone: 'mute', text: `left at ${secs(R.seconds)}` };
  return { tone: 'news', text: `held out ${secs(R.seconds)} · they backed off` };
}

/** What Enter does while you choose: "Fight · Handgun + vest · Real". */
export const goWords = (pick, again = false) => `${again ? 'Again' : 'Fight'} · ${buildLabel(pick)} · ${LEVEL_WORD[pick.level] ?? pick.level}`;

/** THE DOCK WHILE YOU CHOOSE: the five loadouts on 1 to 5, the three levels, what Enter will do. */
export function dockOf({ pick, results = {}, site = null, again = false }) {
  const cur = presetOf(pick);
  const cards = PRESET_KEYS.map((id, k) => ({
    n: k + 1, id, name: PRESETS[id].name, contents: contentsOf(PRESETS[id]),
    last: lastWords(results[id]?.[pick.level], pick.level), on: cur === id,
  }));
  const levels = LEVEL_KEYS.map(id => ({ id, word: LEVEL_WORD[id], name: levelName(site, id), says: LEVELS[id].says, on: pick.level === id }));
  return { cards, levels, custom: !cur, label: buildLabel(pick), contents: contentsOf(pick), go: goWords(pick, again), last: lastWords((results[cur ?? 'custom'] ?? {})[pick.level], pick.level) };
}

/** The next level up or down the three (↑ ↓), kept at the ends. */
export function stepLevel(level, dir) {
  const i = LEVEL_KEYS.indexOf(level);
  return LEVEL_KEYS[Math.max(0, Math.min(LEVEL_KEYS.length - 1, (i < 0 ? 1 : i) + dir))];
}
/** The next loadout along the five (← →), round the ends; from a build of your own, the first or the last. */
export function stepPreset(pick, dir) {
  const i = PRESET_KEYS.indexOf(presetOf(pick));
  return PRESET_KEYS[i < 0 ? (dir > 0 ? 0 : PRESET_KEYS.length - 1) : (i + dir + PRESET_KEYS.length) % PRESET_KEYS.length];
}

/** What the stab vest has taken off the hits on you so far (points): the share the page shows on each hit. */
export function vestTook(F) {
  const me = F.people[0];
  if (!me?.cut) return 0;
  let n = 0;
  for (const e of F.events) if (e.type === 'hit' && e.id === me.id) n += Math.round((e.dmg * me.cut) / (1 - me.cut));
  return n;
}

/**
 * THE METERS WHILE A ROUND IS ON (the standing rule: every running risk is a meter): your health, the vest, your ammo,
 * how many of them are left, the time; Earl's health when he is with you.
 */
export function metersOf(F) {
  const me = F.people[0];
  const frac = me.max ? Math.max(0, me.hp) / me.max : 0;
  const left = F.people.filter(p => p.side === 'foe' && !p.down).length + (LEVELS[F.level].waves.length - F.wave);
  const G = me.gun ? WEAPONS[me.gun] : null;
  const ally = F.people.find(p => p.side === 'ally') ?? null;
  const t = Math.max(0, F.t);
  return {
    health: { hp: Math.max(0, me.hp), max: me.max, frac, low: frac <= 0.35 },
    vest: me.cut > 0 ? { cut: Math.round(me.cut * 100), took: vestTook(F) } : null,
    ammo: G ? { gun: true, name: G.name, mag: me.mag, max: G.mag, rounds: me.rounds, reload: me.reload > 0, dry: me.arm !== me.gun && me.mag <= 0, low: me.mag <= 1 } : { gun: false, name: WEAPONS[me.arm]?.name ?? me.arm },
    left: { n: left, of: F.stats.foes, dropped: F.stats.drops.length },
    time: { s: Math.floor(t), text: clock(t), cap: CAP, late: CAP - t <= 15 },
    ally: ally ? { name: ALLY.name, hp: Math.max(0, ally.hp), max: ally.max, down: ally.down } : null,
  };
}

/** What was picked up, in words: "$34, 8 rounds and a bandage", or null. */
function pickedOf(O) {
  const parts = [O.picked.cash ? `$${O.picked.cash}` : null, O.picked.rounds ? `${O.picked.rounds} rounds` : null, ...O.picked.things].filter(Boolean);
  if (!parts.length) return null;
  return parts.length < 2 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * THE RESULT CARD (the run's, news.js's shape): won or lost, what happened in plain numbers, the one line of advice.
 * `R`: src/fight/report.mjs report(F). `tryout`: a stop of a run's, where nothing carries back.
 */
export function cardOf(R, F, site = null, { tryout = false } = {}) {
  const O = R.outcome;
  const tone = { won: 'win', lost: 'loss', left: 'quiet', timeout: 'news' }[R.result] ?? 'quiet';
  const kicker = { won: 'You won', lost: 'You went down', left: 'You left', timeout: 'They backed off' }[R.result] ?? 'Over';
  const where = site?.stairs ? 'the stop' : 'the lot';
  const head = R.result === 'won' ? `Cleared ${where} in ${secs(O.seconds)}`
    : R.result === 'lost' ? `Down at ${secs(O.seconds)}`
      : R.result === 'left' ? `${site?.exit?.left ?? 'You left'} at ${secs(O.seconds)}`
        : `They backed off at ${secs(O.seconds)}`;
  const body = R.result === 'won' ? `All ${O.of} of them dropped, with ${O.hp} of your ${O.max} health left.`
    : R.result === 'lost' ? `You dropped ${O.dropped} of ${O.of} before they put you down.`
      : R.result === 'left' ? `You walked off with ${O.hp} of ${O.max} health; ${O.dropped} of ${O.of} dropped.`
        : `You held out with ${O.hp} of ${O.max} health; ${O.dropped} of ${O.of} dropped, ${where} not cleared.`;
  const got = pickedOf(O);
  const chips = [
    { tone: R.result === 'lost' ? 'loss' : O.hp / O.max <= 0.35 ? 'risk' : 'gain', icon: 'health', text: `${O.hp}/${O.max} health` },
    { tone: O.dropped === O.of ? 'gain' : 'mute', icon: 'crowd', text: `${O.dropped} of ${O.of} dropped` },
    { tone: 'mute', icon: 'clock', text: secs(O.seconds) },
    got ? { tone: 'mute', icon: 'cash', text: `picked up ${got}` } : null,
    O.allyDown ? { tone: 'loss', icon: 'person', text: 'Earl went down' } : null,
  ].filter(Boolean);
  const A = R.advice;
  return {
    tone, kicker, head, body, chips,
    advice: A ? { head: `${cap(A.consider)}.`, line: siteWords(site, A.line) } : null,
    meta: `${buildLabel(F.build)} · ${LEVEL_WORD[F.level]}: ${levelName(site, F.level)}`,
    note: tryout ? 'Try-out: nothing here counts' : null,
    result: R.result,
  };
}

/** THE RESULTS SIDE BY SIDE: each loadout (and your own build, once fought), its last result at each level. */
export function tableOf(results = {}, pick = null) {
  const rows = [...PRESET_KEYS, ...(results.custom ? ['custom'] : [])];
  const cur = pick ? presetOf(pick) ?? 'custom' : null;
  return {
    levels: LEVEL_KEYS.map(id => ({ id, word: LEVEL_WORD[id], on: pick?.level === id })),
    rows: rows.map(id => ({ id, name: id === 'custom' ? 'Your own' : PRESETS[id].name, on: cur === id, cells: LEVEL_KEYS.map(l => (results[id]?.[l] ? { ...lastWords(results[id][l]), result: results[id][l].result, short: shortOf(results[id][l]) } : null)) })),
  };
}
/** A cell of the table: "won 38 s", "down 3/9", "left 9 s", "held". */
function shortOf(R) {
  if (R.result === 'won') return `won ${secs(R.seconds)}`;
  if (R.result === 'lost') return `down ${R.dropped}/${R.of}`;
  if (R.result === 'left') return `left ${secs(R.seconds)}`;
  return `held ${secs(R.seconds)}`;
}
