// The episode page and the plain sentences it is built from (SPEC section 16).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.mjs';
import { createGame, advance, playBotSeason } from '../src/season.mjs';
import { buildLineup } from '../src/lineups.mjs';
import { KINDS, rolesOf } from '../src/stage.mjs';
import { describe, skillFlag, DESCRIBED } from '../src/words.mjs';
import { episodeHtml } from '../src/episode.mjs';

// ---- helpers

const SEEDS = [1, 2, 3];
const seasons = new Map();
/** A finished bot season, played once per seed and shared between tests. Tests that change a game copy it first. */
const season = seed => {
  if (!seasons.has(seed)) seasons.set(seed, playBotSeason({ seed }));
  return seasons.get(seed);
};

/** A season stopped part-way: after hour `untilHour` (24 is the morning after night 2). */
async function partSeason(seed, untilHour) {
  const game = createGame({ seed });
  assert.equal(await advance(game, { untilHour }), 'paused');
  return game;
}

const decode = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const withoutEngine = html => html.replace(/<x-engine>[\s\S]*?<\/x-engine>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script>[\s\S]*?<\/script>/g, '');
/** What a viewer can read with the engine switch off, as one run of text. */
const visible = html => decode(withoutEngine(html).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ');
/** The same, with a space where every tag was, so two words either side of a tag never join into something else. */
const visibleWords = html => decode(withoutEngine(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
/** The page's own words only: nothing an agent or an owner wrote. */
const pageWords = html => visibleWords(html.replace(/<span class="w">[^<]*<\/span>/g, ' '));

/** Ids the engine uses: agents (a3), NPCs (npc:fence), offers, pick-ups, jobs, contracts, loans, tips, crews, crimes, loot. */
const ENGINE_IDS = [/\ba\d+\b/, /npc:/, /\b[opjcltkxe]\d+\b/];
const BROKEN = [/\bundefined\b/, /\bnull\b/, /\bNaN\b/, /\[object/];

const eventsOf = game => game.feed.flatMap(line => line.events ?? []);

// ---- the page

test('the page renders for a finished bot season', () => {
  const game = season(3);
  const html = episodeHtml(game);
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.trimEnd().endsWith('</html>'));
  const text = visible(html);
  assert.match(text, /Final standings/);
  assert.match(text, /Final result/);
  const winner = game.state.agents[game.state.final[0].id];
  assert.ok(text.includes(`${winner.name} the ${winner.cls} won the season`), 'the winner has a story');
  for (let day = 1; day <= CONFIG.season.days; day++) assert.ok(html.includes(`id="day-${day}"`), `day ${day} has a section`);
  for (let night = 1; night < CONFIG.season.days; night++) assert.match(text, new RegExp(`Night ${night}`));
  assert.match(text, /The final bell/);
  for (const broken of BROKEN) assert.doesNotMatch(visibleWords(html), broken);
});

test('the page renders for a season stopped after night 2, and says how far it has got', async () => {
  const game = await partSeason(3, 24);
  assert.equal(game.state.final, undefined);
  const html = episodeHtml(game, { title: 'A season in progress' });
  const text = visible(html);
  assert.match(text, /A season in progress/);
  assert.match(text, /Standings so far/);
  assert.match(text, new RegExp(`Day 3 of ${CONFIG.season.days}`));
  assert.match(text, /Night 2/);
  assert.doesNotMatch(text, /Night 3/);
  assert.match(text, /Day 3 has not been played yet/);
  assert.doesNotMatch(text, /won the season/);
  for (const agent of Object.values(game.state.agents)) assert.ok(text.includes(agent.name));
  for (const broken of BROKEN) assert.doesNotMatch(visibleWords(html), broken);
});

test('the page renders at any stopping point: before the first hour, mid-day, and from saved JSON', async () => {
  // before hour 0, with an owner still to spend its starting points
  const lineup = buildLineup('default');
  lineup[0].owner = true;
  const waiting = createGame({ seed: 5, lineup });
  assert.equal(waiting.state.phase, 'pre');
  assert.match(visible(episodeHtml(waiting)), /not started yet/);

  // in the middle of day 3
  const midDay = await partSeason(2, 30);
  const text = visible(episodeHtml(midDay));
  assert.match(text, new RegExp(`Day 3 of ${CONFIG.season.days} · played up to 17:00`));
  assert.match(text, /still being played/);

  // a game read back from disk is plain JSON: the page must come out the same
  const game = season(1);
  const saved = JSON.parse(JSON.stringify({ cfg: game.cfg, map: game.map, state: game.state, feed: game.feed }));
  assert.equal(episodeHtml(saved), episodeHtml(game));
});

test('an owner seat: its note and its unspent points show on the page', async () => {
  const lineup = buildLineup('default');
  lineup[0].owner = true;
  const game = createGame({ seed: 4, lineup });
  const owned = game.state.agents.a1;
  const note = 'Stay off the corner until you have a gun.';
  assert.equal(await advance(game, { pauseNights: true, sheets: { a1: { buy: [], note } } }), 'paused');
  assert.equal(game.state.phase, 'night');
  const text = visible(episodeHtml(game, { seatModels: { a1: 'test-model-one' }, spend: 1.5 }));
  assert.ok(text.includes(note), "the owner's note is on the page");
  assert.match(text, /Notes from the owners/);
  assert.ok(text.includes(`${owned.name} earned`) && text.includes('Its owner has not spent'), 'the night shows points waiting for the owner');
  assert.ok(text.includes('test-model-one'), 'the seat shows its model');
  assert.match(text, /The models cost \$1\.50 to run/);
});

test('the page takes the options the runner passes: a list of seat models, the spend, a run cut short', async () => {
  const lineup = buildLineup('default');
  lineup[2].model = 'seat-three-model';
  const game = createGame({ seed: 6, lineup });
  await advance(game, { untilHour: 12 });
  const seatModels = [{ seat: 'cook', model: 'seat-three-model', api: 'local' }];
  const live = visible(episodeHtml(game, { run: 'run-name-here', seed: 6, lineup: 'default', seatModels, ai: { transport: 'live', spend: { cost: 2.345, calls: 9 } }, cut: { kind: 'cut', why: 'the spend cap was reached' }, partial: true }));
  assert.ok(live.includes('seat-three-model'), "a seat's model comes from the seat itself");
  assert.match(live, /The models cost \$2\.35 to run/);
  assert.match(live, /stopped before the season ended: the spend cap was reached/);
  assert.match(live, /run run-name-here/);
  const fake = visible(episodeHtml(game, { seatModels: null, ai: { transport: 'fake', spend: { cost: 0.4 } }, cut: null }));
  assert.match(fake, /nothing was billed/);
  assert.doesNotMatch(fake, /The models cost/);
});

test('the night job shows every night it happens, whether the robbers got in or not', () => {
  let nights = 0;
  for (const seed of SEEDS) {
    const game = season(seed);
    const text = visible(episodeHtml(game));
    for (const line of game.feed.filter(l => l.type === 'night')) {
      if (line.job) {
        nights += 1;
        const owner = game.state.agents[line.job.target].name;
        const got = line.events.find(e => /^night:(job|robbed)/.test(e.kind) && e.data.roll && e.who.agent === line.job.target);
        assert.ok(got ? text.includes(describe(got, game)) : text.includes(`tried ${owner}'s pad in the night`), `seed ${seed}, night ${line.day}: the night job is missing`);
      }
      for (const d of line.decided ?? []) assert.ok(text.includes(`Skill at work ${game.state.agents[d.agent].name}'s`), `seed ${seed}, night ${line.day}: a skill that decided the night is missing`);
    }
  }
  assert.ok(nights > 0, 'three seasons have at least one night job');

  // both kinds of beat, made by hand, with a guard at the door
  const game = season(1);
  const who = { agent: 'a3', owner: 'a3', robber1: 'npc:robber1', robber2: 'npc:robber2' };
  const owner = game.state.agents.a3.name;
  const guard = game.state.agents.a9.name;
  const off = describe({ kind: 'night:job:off', t: 11, block: 'projects', who: { ...who, guard: 'a9' }, lists: {}, data: { roll: { outcome: 'fail' }, guards: ['a9'] } }, game);
  assert.equal(off, `The Dunn brothers tried ${owner}'s pad in the night, and ${guard}, on guard, saw them off.`);
  const got = describe({ kind: 'night:job', t: 11, block: 'projects', who, lists: {}, data: { lost: 60, roll: { outcome: 'clean' }, guards: [] } }, game);
  assert.equal(got, `The Dunn brothers broke into ${owner}'s pad in the night and took $60 from the stash.`);

  // a feed written before the night job had a beat of its own: only `job` on the night entry
  const old = structuredClone(game);
  const night = old.feed.find(l => l.type === 'night');
  night.events = night.events.filter(e => !e.kind.startsWith('night:job'));
  night.decided = [];
  night.job = { target: 'a3', lost: 0, guards: ['a9'], outcome: 'fail' };
  assert.ok(visible(episodeHtml(old)).includes(`The Dunn brothers tried ${owner}'s pad in the night, and ${guard}, on guard, saw them off.`));
});

test('the page is self-contained: it asks the network for nothing', async () => {
  for (const html of [episodeHtml(season(1)), episodeHtml(await partSeason(1, 24))]) {
    for (const [, target] of html.matchAll(/\b(?:src|href|action|poster|data)\s*=\s*["']?([^"'\s>]*)/g)) assert.match(target, /^#/, `a link that leaves the page: ${target}`);
    for (const [, target] of html.matchAll(/url\(\s*["']?([^"')]*)/g)) assert.match(target, /^data:/, `a style that loads a file: ${target}`);
    assert.doesNotMatch(html, /@import/);
    assert.doesNotMatch(html, /<(link|img|iframe|object|embed|video|audio|source|base)\b/i);
    assert.doesNotMatch(html, /<script[^>]+src/i);
    assert.doesNotMatch(html, /https?:\/\//);
    assert.doesNotMatch(html, /["'(]\s*\/\//, 'no protocol-relative address');
    assert.doesNotMatch(html, /\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|import)\s*\(/);
  }
});

test('the engine stays underneath: no ids, chances or dice outside the engine switch', async () => {
  const games = [...SEEDS.map(season), await partSeason(2, 24)];
  for (const game of games) {
    const html = episodeHtml(game);
    assert.ok(html.includes('<x-engine>'), 'the engine record is on the page, behind its switch');
    assert.match(html, /x-engine\{[^}]*display:none/, 'and it starts hidden');
    const text = visibleWords(html);
    for (const id of ENGINE_IDS) assert.doesNotMatch(text, id, `seed ${game.state.seed}: an engine id is showing`);
    // agents may say "odds" or "roll" in their own words; the page itself never does
    const own = pageWords(html);
    assert.doesNotMatch(own, /\bodds\b/i, `seed ${game.state.seed}`);
    assert.doesNotMatch(own, /\broll(s|ed|ing)?\b/i, `seed ${game.state.seed}`);
    assert.doesNotMatch(own, /\b(modifier|band)s?\b/i, `seed ${game.state.seed}`);
  }
});

test("every agent's name, every night's journals, every big beat and every confessional are on the page", () => {
  for (const seed of SEEDS) {
    const game = season(seed);
    const text = visible(episodeHtml(game));
    const agents = Object.values(game.state.agents);
    for (const agent of agents) assert.ok(text.includes(agent.name), `seed ${seed}: ${agent.name} is missing`);

    let journals = 0;
    for (const agent of agents) {
      assert.equal(agent.journals.length, CONFIG.season.days, 'a bot writes a journal every night');
      for (const journal of agent.journals) {
        for (const line of journal.lines) assert.ok(text.includes(line), `seed ${seed}: a journal line of ${agent.name} is missing: ${line}`);
        assert.ok(text.includes(journal.ask), `seed ${seed}: ${agent.name}'s ask is missing`);
        journals += 1;
      }
    }
    assert.equal(journals, agents.length * CONFIG.season.days);

    const beats = eventsOf(game).filter(event => event.big);
    assert.ok(beats.length > 20, `seed ${seed}: a season has big beats`);
    for (const event of beats) assert.ok(text.includes(describe(event, game)), `seed ${seed}: a big beat is missing: ${describe(event, game)}`);

    let confessionals = 0;
    for (const line of game.feed) {
      for (const turn of Object.values(line.agents ?? {})) {
        if (!turn.confessional) continue;
        confessionals += 1;
        assert.ok(text.includes(turn.confessional), `seed ${seed}: a confessional is missing: ${turn.confessional}`);
        if (turn.say) assert.ok(text.includes(turn.say.text), `seed ${seed}: something said out loud is missing`);
        if (turn.message) assert.ok(text.includes(turn.message.text), `seed ${seed}: a message is missing`);
      }
    }
    assert.ok(confessionals > 50, `seed ${seed}: bots talk to the camera`);
  }
});

test('every turn of every hour is on the page, behind its switch, and quiet hours fold into one line', () => {
  const game = season(2);
  const html = episodeHtml(game);
  const hours = game.feed.filter(line => line.type === 'hour');
  assert.equal((html.match(/<li class="hour/g) ?? []).length, hours.length);
  assert.equal((html.match(/<div class="turns">/g) ?? []).length, hours.length);
  assert.match(html, /\.turns,x-engine\{display:none\}/);
  const quiet = hours.filter(line => !line.events.some(e => e.big) && !line.decided.length).length;
  assert.equal((html.match(/<li class="hour quiet"/g) ?? []).length, quiet);
  if (quiet) assert.match(visible(html), /quiet hours? of work/i);
  // one row per agent per hour
  const rows = (html.match(/<span class="purse">/g) ?? []).length;
  assert.equal(rows, hours.length * game.state.order.length);
});

test('everything agents write is escaped before it reaches the page', () => {
  const game = structuredClone(season(1));
  const attack = '<script>alert("x")</script><img src=//evil.example/x.png onerror=alert(1)>';
  const first = game.feed.find(line => line.type === 'hour');
  for (const turn of Object.values(first.agents)) {
    turn.say = { text: attack };
    turn.message = { to: 'a2', text: attack };
    turn.confessional = attack;
  }
  const agent = game.state.agents.a3;
  agent.name = 'Mal<b>ice';
  agent.persona = attack;
  agent.journals[0].lines = [attack, attack, attack];
  agent.journals[0].ask = attack;
  const night = game.feed.find(line => line.type === 'night');
  game.feed.splice(game.feed.indexOf(night) + 1, 0, { type: 'levelup', day: 1, t: night.t, owners: true, bought: [{ id: 'a3', skills: [], note: attack }] });
  const crewed = game.feed.flatMap(line => line.events ?? []).find(event => event.kind === 'crew:start');
  if (crewed) crewed.data.name = attack;

  const html = episodeHtml(game, { title: attack, seatModels: { a1: attack } });
  assert.equal((html.match(/<script/g) ?? []).length, 1, 'only the page’s own script');
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /<b>ice/);
  assert.ok(html.includes('Mal&lt;b&gt;ice'));
  assert.ok(visible(html).includes(attack), 'the words are still there to read');
});

test('a full season stays a light page', () => {
  for (const seed of SEEDS) {
    const bytes = Buffer.byteLength(episodeHtml(season(seed)));
    assert.ok(bytes < 1_500_000, `seed ${seed}: ${bytes} bytes`);
  }
});

// ---- plain sentences

/** A sentence a viewer can read: starts with a capital, ends properly, no leftovers from code, no ids. */
function assertPlain(sentence, label) {
  assert.equal(typeof sentence, 'string', label);
  assert.match(sentence, /^["“]?[A-Z$0-9]/, `${label}: ${sentence}`);
  assert.match(sentence, /[.!?]["”]?$/, `${label}: ${sentence}`);
  for (const bad of [...BROKEN, ...ENGINE_IDS, / {2}/, / [,.;:]/, /\.\./, /,\./]) assert.doesNotMatch(sentence, bad, `${label}: ${sentence}`);
}

test('describe has a plain sentence for every event of three whole seasons', () => {
  for (const seed of SEEDS) {
    const game = season(seed);
    for (const event of eventsOf(game)) assertPlain(describe(event, game), `seed ${seed}, ${event.kind}`);
  }
});

test('describe has words for every kind the engine can emit, with or without the optional parts', () => {
  assert.deepEqual(Object.keys(KINDS).filter(kind => !DESCRIBED.includes(kind)), [], 'a kind with no words');
  const game = season(1);
  const seen = new Set(SEEDS.flatMap(seed => eventsOf(season(seed)).map(event => event.kind)));
  const ids = game.state.order;
  for (const kind of Object.keys(KINDS)) {
    const { roles, lists } = rolesOf(kind);
    const who = Object.fromEntries(roles.map((role, i) => [role, ids[i % ids.length]]));
    // everyone in their role and nothing else known; then nobody at all; then no game to look names up in
    const full = { kind, t: 3, block: 'bar', spot: 'street', who, lists: Object.fromEntries(lists.map(list => [list, []])), data: {}, big: !!KINDS[kind].big };
    const bare = { kind, t: 3, block: null, who: {}, lists: {}, data: {} };
    assertPlain(describe(full, game), `${kind}${seen.has(kind) ? '' : ' (never seen in the seasons)'}, every role`);
    assertPlain(describe(bare, game), `${kind}, no roles`);
    assertPlain(describe(full, null), `${kind}, no game`);
    assert.doesNotMatch(describe(full, game), /\bsomeone\b/i, `${kind}: a role the sentence should have named`);
    // and every one of its roles is named, unless the scene uses the role only for an NPC the sentence leaves out
    if (!KINDS[kind].notice) assert.ok(roles.length === 0 || roles.some(role => describe(full, game).includes(game.state.agents[who[role]].name)), `${kind}: names nobody`);
  }
  assertPlain(describe({ kind: 'not-a-kind', who: {}, data: {} }, game), 'an unknown kind');
  assertPlain(describe(null, game), 'no event');
});

test('describe says what was posted, not what is left of a listing later', () => {
  for (const seed of SEEDS) {
    const game = season(seed);
    for (const line of game.feed) {
      for (const event of line.events ?? []) {
        if (event.kind !== 'offer:board' || !event.data.terms?.n) continue;
        const asked = line.agents[event.who.from].move.terms;
        if (asked.kind !== 'sell' && asked.kind !== 'buy') continue;
        const asPosted = { ...event, data: { ...event.data, terms: asked } };
        assert.equal(describe(event, game), describe(asPosted, game), `seed ${seed}`);
        if (asked.n > 1) assert.match(describe(event, game), new RegExp(`\\b${asked.n} `), `seed ${seed}: ${describe(event, game)}`);
      }
    }
  }
});

// ---- skills at work (D31)

test('a roll a skill decided is flagged in plain words next to its beat', () => {
  let flags = 0;
  for (const seed of SEEDS) {
    const game = season(seed);
    const text = visible(episodeHtml(game));
    for (const line of game.feed) {
      for (const event of line.events ?? []) {
        // every skill that decided this event's roll, in the engine's order, straight after the beat's sentence
        const decided = event.data?.roll?.decidedBy ?? [];
        if (!decided.length) continue;
        for (const d of decided) assertPlain(skillFlag(d, event, game), `seed ${seed}, a flag`);
        const beat = describe(event, game) + decided.map(d => `Skill at work ${skillFlag(d, event, game)}`).join('');
        assert.ok(text.includes(beat), `seed ${seed}: a flag is not next to its beat: ${beat}`);
        flags += decided.length;
      }
      // and nothing in the hour's own list of decided rolls is left off the page
      for (const d of line.decided ?? []) {
        const event = (line.events ?? []).find(e => (e.data?.roll?.decidedBy ?? []).some(x => x.agent === d.agent && x.skill === d.skill && x.without === d.without));
        if (event) assert.ok(text.includes(`Skill at work ${skillFlag(d, event, game)}`), `seed ${seed}: a decided roll is missing`);
        else assert.ok(text.includes(`Skill at work ${game.state.agents[d.agent].name}'s`), `seed ${seed}: a decided roll is missing`);
      }
    }
  }
  assert.ok(flags > 0, 'three seasons have at least one roll a skill decided');
});

test('a getaway that a skill bought shows as "turned an arrest into a getaway"', () => {
  const game = structuredClone(season(2));
  const robber = Object.values(game.state.agents).find(agent => agent.cls === 'robber');
  const target = Object.values(game.state.agents).find(agent => agent.cls === 'dealer');
  const line = game.feed.find(l => l.type === 'hour' && l.day === 2);
  const event = { kind: 'rob:disaster:getaway', t: line.t, block: 'bar', spot: 'street', who: { robber: robber.id, target: target.id, owner: target.id }, lists: {}, data: { armed: false, betrayed: false }, big: true };
  line.events.push(event);
  const decided = { agent: robber.id, skill: 'getaway', value: 20, without: 'arrest', side: 'a', what: 'turned an arrest into a getaway' };
  line.decided.push(decided);

  const flag = skillFlag(decided, event, game);
  assert.match(flag, new RegExp(`^${robber.name}'s Getaway( \\d)? turned an arrest into a getaway\\.$`));
  const html = episodeHtml(game);
  const text = visible(html);
  assert.ok(text.includes(`${describe(event, game)}Skill at work ${flag}`), 'the flag sits with its beat');
  // and it is not behind the engine switch
  assert.ok(withoutEngine(html).includes('<b>Skill at work</b>'));
});

test('a skill flag that has no beat of its own still shows, as a line in its hour', () => {
  const game = structuredClone(season(2));
  const smuggler = Object.values(game.state.agents).find(agent => agent.cls === 'smuggler');
  const line = game.feed.find(l => l.type === 'hour' && !l.events.some(e => e.big) && !l.decided.length);
  if (!line) return; // every hour of this season had a big beat: nothing to check
  line.decided.push({ agent: smuggler.id, skill: 'sneak', value: 8, without: 'hit', side: 'a', what: 'slipped past a docks bust' });
  const text = visible(episodeHtml(game));
  assert.match(text, new RegExp(`Skill at work ${smuggler.name}'s Sneak( \\d)? slipped a docks run past the police\\.`));
});

// ---- later additions to the feed

test('a stand-in taking over a seat shows as a line in its hour, and unknown feed entries are left out', () => {
  const game = structuredClone(season(2));
  const hours = game.feed.filter(l => l.type === 'hour');
  const kim = game.state.agents.a4;
  game.feed.splice(game.feed.indexOf(hours[5]), 0, { type: 'takeover', t: hours[5].t, agent: 'a4', on: true });
  game.feed.splice(game.feed.indexOf(hours[9]), 0, { type: 'takeover', t: hours[9].t, agent: 'a4', on: false });
  game.feed.push({ type: 'something-new', t: 3, anything: { at: 'all' } }, null, 'junk', { type: 'takeover', t: 2, agent: 'nobody', on: true });
  const html = episodeHtml(game);
  const text = visible(html);
  assert.ok(text.includes(`A stand-in is playing ${kim.name} until its model answers again.`));
  assert.ok(text.includes(`${kim.name}'s model is answering again and has its seat back.`));
  assert.doesNotMatch(text, /something-new|junk/);
  for (const id of ENGINE_IDS) assert.doesNotMatch(visibleWords(html), id);
  // the hour it happened in is never folded away as a quiet one
  const at = html.indexOf('A stand-in is playing');
  assert.doesNotMatch(html.slice(html.lastIndexOf('<li class="hour', at), at), /^<li class="hour quiet"/);
});

test('describe has a sentence for ready-made product off the docks and for a stake from the loan shark', () => {
  const game = season(1);
  const smuggler = Object.values(game.state.agents).find(agent => agent.cls === 'smuggler');
  const run = describe({ kind: 'work:run', t: 4, block: 'docks', spot: 'pier', who: { smuggler: smuggler.id, supplier: 'npc:supplier' }, lists: {}, data: { good: 'product', units: 3, cost: 90 } }, game);
  assertPlain(run, 'a product run');
  assert.ok(run.includes(smuggler.name) && run.includes('3 units of ready-made, low-grade product') && run.includes('$90'), run);
  const bust = describe({ kind: 'work:run:bust', t: 4, block: 'docks', who: { smuggler: smuggler.id, officer: 'npc:police1' }, lists: {}, data: { good: 'product', units: 1, hours: 2, fine: 0, seized: [] } }, game);
  assertPlain(bust, 'a product run that was busted');
  assert.match(bust, /1 unit of ready-made, low-grade product/);
  const stake = describe({ kind: 'offer:fence', t: 4, block: 'market', spot: 'counter:fence', who: { agent: smuggler.id, npc: 'npc:fence' }, lists: {}, data: { stake: 100, owed: 125 }, big: true }, game);
  assertPlain(stake, 'a stake');
  assert.ok(stake.includes(`${smuggler.name} was broke and took a $100 stake from the loan shark`) && stake.includes('owes $125'), stake);
});

// ---- the small lobby: a few owners' agents (players) among scripted locals

const PLAYER_SEATS = [3, 6]; // a dealer and a robber

function lobbyLineup() {
  const lineup = buildLineup('default');
  for (const seat of PLAYER_SEATS) Object.assign(lineup[seat], { player: true, kind: 'bot' });
  return lineup;
}

/** Mark a game as a small lobby by hand, the way the engine does, in case this engine doesn't do it yet. */
function markLobby(game) {
  const { state } = game;
  if (state.players?.length) return game;
  state.players = PLAYER_SEATS.map(seat => state.order[seat]);
  for (const agent of Object.values(state.agents)) {
    agent.player = state.players.includes(agent.id);
    agent.local = !agent.player;
    if (agent.local) agent.persona = 'Hunts whoever is richest.';
  }
  for (const line of game.feed) for (const [id, turn] of Object.entries(line.agents ?? {})) if (!state.players.includes(id)) delete turn.confessional;
  if (state.final) {
    for (const row of state.final) row.player = state.players.includes(row.id);
    state.winner = state.final.find(row => row.player).id;
  }
  return game;
}

let lobbyGame = null;
const lobbySeason = () => (lobbyGame ??= markLobby(playBotSeason({ seed: 2, lineup: lobbyLineup() })));

/** The folded "Elsewhere in the city" parts of a page, and the page without them. */
function splitElsewhere(html) {
  const folds = html.match(/<details class="elsewhere"[\s\S]*?<\/details>/g) ?? [];
  return { folds, inside: visible(folds.join(' ')), outside: visible(html.replace(/<details class="elsewhere"[\s\S]*?<\/details>/g, ' ')) };
}

test('a small-lobby season renders, and the winner at the top is the richest player', () => {
  const game = lobbySeason();
  const { state } = game;
  assert.equal(state.players.length, PLAYER_SEATS.length);
  const html = episodeHtml(game);
  const text = visible(html);
  const winner = state.agents[state.winner];
  assert.ok(state.players.includes(state.winner));
  assert.ok(text.includes(`${winner.name} the ${winner.cls} won the season with`), 'the story is about state.winner');
  const row = state.final.find(r => r.id === state.winner);
  const richer = state.final.filter(r => !state.players.includes(r.id) && r.rank < row.rank).length;
  if (richer) assert.match(text, new RegExp(`${richer === 1 ? 'One local' : '\\w+ locals'} ended richer: the house had the better week\\.`));
  else assert.doesNotMatch(text, /ended richer/);
  assert.ok(text.includes(`${winner.name} won with`) && text.includes(`the richest of the two players`), 'the final bell names the same winner');
  for (const broken of BROKEN) assert.doesNotMatch(visibleWords(html), broken);
  for (const id of ENGINE_IDS) assert.doesNotMatch(visibleWords(html), id);
  for (const event of eventsOf(game)) assertPlain(describe(event, game), `small lobby, ${event.kind}`);
  assert.equal(describe({ kind: 'final', who: {}, data: { rows: state.final } }, game), `The season is over. ${winner.name} won with $${row.worth.toLocaleString('en-US')}.`);
});

test('small-lobby standings and race tables show all ten, with players marked and locals called locals', () => {
  const game = lobbySeason();
  const { state } = game;
  const html = episodeHtml(game);
  const table = html.match(/<ol class="table">[\s\S]*?<\/ol>/)[0];
  assert.equal((table.match(/<li/g) ?? []).length, state.order.length);
  assert.equal((table.match(/class="tag">player</g) ?? []).length, state.players.length);
  const tableText = visible(table);
  for (const agent of Object.values(state.agents)) {
    if (state.players.includes(agent.id)) continue;
    assert.ok(tableText.includes(`the ${agent.cls} · local`), `${agent.name} is tagged local`);
    assert.ok(tableText.includes(agent.persona), `${agent.name}'s agenda is shown`);
  }
  assert.equal((tableText.match(/· bot/g) ?? []).length, state.players.length, 'no local is called a bot');
  const races = html.match(/<ol class="race[^"]*">[\s\S]*?<\/ol>/g);
  assert.equal(races.length, CONFIG.season.days);
  for (const race of races) {
    assert.equal((race.match(/<li/g) ?? []).length, state.order.length);
    assert.equal((race.match(/class="tag">player</g) ?? []).length, state.players.length);
  }
});

test('in a small lobby, beats with no player fold into "Elsewhere in the city", and a player\'s beats do not', () => {
  const game = lobbySeason();
  const players = game.state.players;
  const html = episodeHtml(game);
  const { folds, inside, outside } = splitElsewhere(html);
  assert.ok(folds.length > 5, 'locals get up to things among themselves');
  assert.match(inside, /Elsewhere in the city: (1 thing|\d+ things) happened/);
  let folded = 0;
  let shown = 0;
  for (const line of game.feed.filter(l => l.type === 'hour')) {
    for (const event of line.events.filter(e => e.big)) {
      const sentence = describe(event, game);
      if (Object.values(event.who).some(id => players.includes(id))) {
        assert.ok(outside.includes(sentence), `a player's beat is folded away: ${sentence}`);
        shown += 1;
      } else if (!players.some(id => JSON.stringify(event).includes(`"${id}"`))) {
        assert.ok(inside.includes(sentence), `a locals-only beat is not folded: ${sentence}`);
        folded += 1;
      }
    }
  }
  assert.ok(folded > 5 && shown > 5, `${folded} folded, ${shown} shown`);
  // every fold is closed until someone opens it, and "show every turn" still has every agent's row for every hour
  for (const fold of folds) assert.doesNotMatch(fold, /^<details[^>]*\sopen/);
  assert.equal((html.match(/<span class="purse">/g) ?? []).length, game.feed.filter(l => l.type === 'hour').length * game.state.order.length);
});

test('in a small lobby, players come first, and locals have a filter chip but no commentary track or journal', () => {
  const game = lobbySeason();
  const { state } = game;
  const html = episodeHtml(game);
  const chips = [...html.matchAll(/<input type="radio" name="f" id="f(\d+)"/g)].map(m => Number(m[1]));
  assert.equal(chips.length, state.order.length, 'everyone has a filter chip');
  assert.deepEqual(chips.slice(0, PLAYER_SEATS.length), PLAYER_SEATS, 'players first');
  for (const agent of Object.values(state.agents)) {
    const isPlayer = state.players.includes(agent.id);
    assert.equal(html.includes(`id="track-${agent.seat}"`), isPlayer, `${agent.name}: ${isPlayer ? 'a player has' : 'a local has no'} commentary track`);
  }
  assert.equal((html.match(/<article class="journal"/g) ?? []).length, state.players.length * CONFIG.season.days, "only the players' journals are in the night blocks");
  const text = visible(html);
  for (const id of state.players) for (const journal of state.agents[id].journals) for (const line of journal.lines) assert.ok(text.includes(line));
});

test('a small lobby part-way through tells the story of the leading player', async () => {
  const game = createGame({ seed: 2, lineup: lobbyLineup() });
  await advance(game, { untilHour: 24 });
  markLobby(game);
  const text = visible(episodeHtml(game));
  assert.match(text, /leads the players after day 2 with/);
  assert.doesNotMatch(text, /won the season/);
});

test('the house bounty reads right: an NPC crew posts it, and whoever does it collects', () => {
  const game = season(1);
  const [kim, rook] = [game.state.agents.a2, game.state.agents.a7];
  const data = { offer: 'o9', task: { type: 'rob', agent: kim.id }, pay: 75, to: 'anyone', house: true };
  assert.equal(describe({ kind: 'job:posted', t: 12, block: 'docks', who: { poster: 'npc:rival1' }, lists: {}, data, big: true }, game), `The Sixes put $75 on ${kim.name}'s head.`);
  assert.equal(describe({ kind: 'job:done', t: 15, block: 'bar', who: { worker: rook.id, poster: 'npc:rival1' }, lists: {}, data: { job: 'j1', task: data.task, pay: 75, paid: 75 }, big: true }, game), `${rook.name} collected the Sixes' $75 for robbing ${kim.name}.`);
  assertPlain(describe({ kind: 'job:taken', t: 13, who: { worker: rook.id, poster: 'npc:rival1' }, lists: {}, data: { job: 'j1', task: data.task, pay: 75 } }, game), 'a bounty taken');
  assertPlain(describe({ kind: 'job:lapsed', t: 18, who: { poster: 'npc:rival1' }, lists: {}, data: { job: 'j1', worker: rook.id } }, game), 'a bounty lapsed');
  // a job between two agents still reads as before
  assert.match(describe({ kind: 'job:done', t: 15, who: { worker: rook.id, poster: kim.id }, lists: {}, data: { task: { type: 'rob', agent: 'a3' }, pay: 60, paid: 60 } }, game), new RegExp(`^${rook.name} finished ${kim.name}'s job \\(rob `));
  // and the bounty posted at noon is on the page, with the forecast
  const posted = game.feed.filter(l => l.type === 'forecast').flatMap(l => l.events).filter(e => e.kind === 'job:posted');
  const text = visible(episodeHtml(game));
  for (const event of posted) assert.ok(text.includes(`At noon ${describe(event, game)}`), describe(event, game));
});

test('a season with no players renders exactly as it did before the small lobby', () => {
  const game = season(3);
  const plain = episodeHtml(game);
  const text = visible(plain);
  assert.doesNotMatch(text, /Elsewhere in the city/);
  assert.doesNotMatch(text, /· local\b/);
  assert.doesNotMatch(withoutEngine(plain), /class="tag"|class="sep"|data-local|<details class="elsewhere"/);
  assert.equal((plain.match(/class="track"/g) ?? []).length, game.state.order.length, 'everyone keeps a commentary track');
  assert.equal((plain.match(/<article class="journal"/g) ?? []).length, game.state.order.length * CONFIG.season.days);
  const winner = game.state.agents[game.state.final[0].id];
  assert.ok(text.includes(`${winner.name} the ${winner.cls} won the season`));
  // the same season with the lobby fields missing, empty or all false is the same page, byte for byte
  for (const strip of [s => { delete s.players; delete s.winner; }, s => { s.players = []; }, s => { for (const a of Object.values(s.agents)) { delete a.player; delete a.local; } delete s.players; }]) {
    const copy = structuredClone(game);
    strip(copy.state);
    assert.equal(episodeHtml(copy), plain);
  }
});
