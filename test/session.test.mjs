// The session the page plays through: watch, play and coach (SPEC section 24).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.mjs';
import { createSession, witnessed, skillPreview, MODES, HUMAN_SEATS } from '../src/session.mjs';
import { playBotSeason } from '../src/season.mjs';
import { checkBooks } from '../src/ledger.mjs';

/** Play a session to the end. `answer(pending, session)` returns the input for each thing it waits on. */
async function playOut(session, answer = () => ({}), onStep = () => {}) {
  let guard = 0;
  for (;;) {
    const p = session.pending();
    if (p.kind === 'over') return p;
    if (++guard > 200) throw new Error('the session never ended');
    const input = answer(p, session);
    const result = input === 'auto' ? await session.auto() : await session.step(input);
    onStep(result, p);
  }
}

test('watch: stepping an hour at a time plays the same season as the bot runner', async () => {
  const session = createSession({ seed: 5, mode: 'watch' });
  assert.equal(session.you, null);
  let hours = 0;
  const over = await playOut(session, () => ({}), result => { hours += result.lines.filter(l => l.type === 'hour').length; });
  assert.equal(hours, CONFIG.season.days * CONFIG.season.hoursPerDay);
  const straight = playBotSeason({ seed: 5 });
  assert.deepEqual(over.final, straight.state.final);
  assert.equal(session.game.feed.length, straight.feed.length);
});

test('watch: one step is one hour, and a day\'s last step also brings the night and the next forecast', async () => {
  const session = createSession({ seed: 2, mode: 'watch' });
  const first = await session.step();
  assert.deepEqual(first.lines.map(l => l.type), ['hour']);
  for (let h = 1; h < CONFIG.season.hoursPerDay - 1; h++) await session.step();
  const last = await session.step();
  assert.deepEqual(last.lines.map(l => l.type), ['hour', 'night', 'forecast']);
  assert.equal(session.pending().kind, 'hour');
});

test('play: the human spends the starting points, then gets a view with a menu every hour', async () => {
  const session = createSession({ seed: 3, mode: 'play', seat: 'dealer' });
  const you = session.game.state.agents[session.you];
  assert.equal(you.cls, 'dealer');
  assert.equal(you.player, true);
  // everyone else is a local
  for (const id of session.game.state.order) if (id !== session.you) assert.equal(session.game.state.agents[id].local, true);

  const pre = session.pending();
  assert.equal(pre.kind, 'sheet');
  assert.equal(pre.sheet.points, CONFIG.skills?.startPoints ?? pre.sheet.points);
  assert.ok(pre.sheet.points >= 1);
  const skill = pre.sheet.canBuy[0].skill;
  await session.step({ sheet: { ...pre.sheet, buy: [skill] } });
  assert.equal(you.skills[skill], 1);

  const p = session.pending();
  assert.equal(p.kind, 'move');
  assert.equal(p.view.you.id, session.you);
  assert.ok(p.view.menu.length > 0);
  // taking a menu line by its id plays the hour
  const rest = p.view.menu.find(m => m.verb === 'rest') ?? p.view.menu[0];
  const result = await session.step({ reply: { move: rest.id } });
  assert.equal(result.lines[0].type, 'hour');
  assert.equal(result.lines[0].agents[session.you].ok, true);
  assert.equal(session.game.state.t, 1);
});

test('play: reading what the session waits on changes nothing', async () => {
  const run = async peeks => {
    const session = createSession({ seed: 7, mode: 'play', seat: 'robber' });
    const over = await playOut(session, p => {
      for (let k = 0; k < peeks; k++) session.pending();
      return p.kind === 'move' ? 'auto' : {};
    });
    return { final: over.final, books: checkBooks(session.game.state).ok };
  };
  const once = await run(0);
  const often = await run(3);
  assert.deepEqual(once.final, often.final);
  assert.equal(once.books, true);
});

test('play: a whole season on the auto button ends with a winner and balanced books, with a sheet every night', async () => {
  const session = createSession({ seed: 4, mode: 'play', seat: 'smuggler' });
  let sheets = 0;
  const over = await playOut(session, p => {
    if (p.kind === 'sheet') sheets += 1;
    return p.kind === 'move' ? 'auto' : {};
  });
  // before hour 0, and after each of the first four days
  assert.equal(sheets, CONFIG.season.days);
  assert.equal(over.winner, session.you);
  assert.equal(over.final.length, 10);
  assert.equal(checkBooks(session.game.state).ok, true);
});

test('coach: the bot plays the seat; the night sheet sets its skills, its stance and one chip', async () => {
  const session = createSession({ seed: 6, mode: 'coach', seat: 'robber' });
  const { state } = session.game;
  const you = state.agents[session.you];
  assert.equal(you.kind, 'bot');
  const target = state.order.find(id => state.agents[id].cls === 'dealer');

  const pre = session.pending();
  assert.equal(pre.kind, 'sheet');
  assert.ok(['bold', 'careful'].includes(pre.sheet.stance));
  await session.step({ sheet: { ...pre.sheet, buy: [], stance: 'careful', focus: { target } } });
  assert.equal(you.lean, 'careful');
  assert.deepEqual(you.focus, { target });

  // no answer is needed during the day, and the coach is shown what the agent sees
  const p = session.pending();
  assert.equal(p.kind, 'hour');
  assert.equal(p.view.you.id, session.you);
  for (let h = 0; h < CONFIG.season.hoursPerDay; h++) await session.step();
  const night = session.pending();
  assert.equal(night.kind, 'sheet');
  // a chip that names nobody real is dropped; a block to stay off is kept
  await session.step({ sheet: { ...night.sheet, stance: 'bold', focus: { avoid: 'bar' } } });
  assert.equal(you.lean, 'bold');
  assert.deepEqual(you.focus, { avoid: 'bar' });
  for (let h = 0; h < CONFIG.season.hoursPerDay; h++) await session.step();
  await session.step({ sheet: { focus: { target: 'nobody' } } });
  assert.equal(you.focus, null);
});

test('coach: a bot told to stay off a block never sells there', async () => {
  const session = createSession({ seed: 9, mode: 'coach', seat: 'dealer' });
  const sold = [];
  await playOut(session, p => (p.kind === 'sheet' ? { sheet: { ...p.sheet, focus: { avoid: 'uptown' } } } : {}), result => {
    for (const line of result.lines) {
      if (line.type !== 'hour') continue;
      const mine = line.agents[session.you];
      if (mine.move?.verb === 'work' && mine.move.option !== 'claim' && mine.ok) sold.push(mine.block);
    }
  });
  assert.ok(sold.length > 0, 'the dealer sold somewhere');
  assert.equal(sold.includes('uptown'), false);
});

test('the menu carries what the odds bar draws: four outcomes that add up to 100, and the plain risks of work', async () => {
  let contested = 0;
  let risky = 0;
  for (const seat of ['robber', 'cook']) {
    const session = createSession({ seed: 2, mode: 'play', seat });
    await playOut(session, p => {
      if (p.kind !== 'move') return {};
      for (const entry of p.view.menu) {
        if (typeof entry.odds === 'number') {
          contested += 1;
          const b = entry.bands;
          assert.equal(b.clean + b.messy + b.fail + b.disaster, 100);
          assert.equal(b.clean + b.messy, entry.odds);
          assert.ok(Array.isArray(entry.why));
        }
        if (entry.risk) {
          risky += 1;
          assert.ok(entry.risk.pct >= 0 && entry.risk.pct <= 100);
          assert.ok(entry.label.includes(`${entry.risk.pct}%`), `${entry.label} states its ${entry.risk.pct}%`);
        }
      }
      return 'auto';
    });
  }
  assert.ok(contested > 0, 'some menu had a contested move');
  assert.ok(risky > 0, 'some menu had a risky hour of work');
});

test('witnessed: a seat sees the events it was in or stood on the block for, and no others', async () => {
  const session = createSession({ seed: 3, mode: 'play', seat: 'dealer' });
  let seen = 0;
  let hidden = 0;
  let sealed = 0;
  await playOut(session, p => (p.kind === 'move' ? 'auto' : {}), result => {
    for (const line of result.lines) {
      if (line.type !== 'hour') continue;
      const mine = witnessed(line, session.you);
      seen += mine.length;
      hidden += line.events.length - mine.length;
      for (const e of mine) {
        if (e.sealed) {
          // private business seen from the kerb: who and where, and nothing else
          sealed += 1;
          assert.deepEqual(e.data, {});
          assert.equal(e.say, undefined);
          assert.equal(Object.keys(e.who).length <= 1, true);
          assert.equal(Object.values(e.who).includes(session.you), false);
          for (const step of e.stage?.steps ?? []) assert.equal(step.target, undefined);
          continue;
        }
        const ids = [...Object.values(e.who ?? {}), ...Object.values(e.lists ?? {}).flat()];
        assert.ok(ids.includes(session.you));
      }
    }
  });
  assert.ok(seen > 0);
  assert.ok(hidden > 0);
  assert.ok(sealed > 0, 'the season had private business done within sight');
});

test('an hour of risky work records its roll, and the season\'s end gives the human\'s rank', async () => {
  const session = createSession({ seed: 2, mode: 'play', seat: 'cook' });
  const risks = [];
  const over = await playOut(session, p => (p.kind === 'move' ? 'auto' : {}), result => {
    for (const line of result.lines) if (line.type === 'hour') risks.push(...line.risks);
  });
  assert.ok(risks.length > 0);
  for (const r of risks) {
    assert.ok(['a bust', 'a blow-up', 'a sting'].includes(r.what));
    assert.equal(r.hit, r.roll < r.chance);
    assert.ok(session.game.state.agents[r.agent]);
  }
  assert.equal(over.rank, over.final.find(r => r.id === session.you).rank);
  assert.equal(over.top, over.final[0].id);
});

test('a skill is shown by what it does to the agent\'s real odds', () => {
  const session = createSession({ seed: 3, mode: 'play', seat: 'robber' });
  const you = session.game.state.agents[session.you];
  const pre = session.pending();
  assert.equal(pre.kind, 'sheet');
  const moved = pre.sheet.canBuy.filter(s => pre.previews[s.skill].length);
  assert.ok(moved.length > 0, 'at least one of a robber\'s skills moves a contest');
  for (const s of moved) {
    for (const row of skillPreview(session.game, you, s.skill)) {
      assert.notEqual(row.before, row.after);
      assert.ok(row.label.length > 0);
    }
  }
  // the preview doesn't touch the agent
  assert.equal(Object.values(you.skills).reduce((a, b) => a + b, 0), 0);
});

test('the modes and the seats offered to a human', () => {
  assert.deepEqual([...MODES], ['watch', 'play', 'coach']);
  assert.deepEqual([...HUMAN_SEATS], ['dealer', 'robber', 'smuggler', 'cook']);
  assert.throws(() => createSession({ mode: 'spectate' }));
});

test('everything the session imports can run in a browser: relative imports only, nothing from Node', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const src = path.dirname(fileURLToPath(new URL('../src/session.mjs', import.meta.url)));
  const seen = new Set();
  const bad = [];
  const walk = file => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/^\s*(?:import|export)\b[^'"\n]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (!spec.startsWith('.')) bad.push(`${path.basename(file)} imports ${spec}`);
      else if (spec.endsWith('.mjs')) walk(path.resolve(path.dirname(file), spec));
      else bad.push(`${path.basename(file)} imports ${spec} (not a module the page can load plainly)`);
    }
  };
  walk(path.join(src, 'session.mjs'));
  assert.deepEqual(bad, []);
  assert.ok(seen.size > 10, 'the walk reached the engine');
  // and the words and the reveal-all page the HUD uses
  for (const extra of ['words.mjs', 'episode.mjs', 'lines.mjs']) walk(path.join(src, extra));
  assert.deepEqual(bad, []);
});

test('a session saved mid-day and restored plays out the same season', async () => {
  const { restoreSession } = await import('../src/session.mjs');
  const straight = createSession({ seed: 8, mode: 'play', seat: 'cook' });
  const overStraight = await playOut(straight, p => (p.kind === 'move' ? 'auto' : {}));

  let session = createSession({ seed: 8, mode: 'play', seat: 'cook' });
  let steps = 0;
  for (;;) {
    const p = session.pending();
    if (p.kind === 'over') break;
    if (p.kind === 'move') await session.auto();
    else await session.step({});
    // a reload every seven steps: through JSON and back
    if (++steps % 7 === 0) session = restoreSession(JSON.parse(JSON.stringify(session.save())));
  }
  assert.ok(steps > 60);
  assert.deepEqual(session.pending().final, overStraight.final);
  assert.equal(session.game.feed.length, straight.game.feed.length);
  assert.throws(() => restoreSession({ v: 2 }));
});
