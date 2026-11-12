// The HUD's rules with no page in them (demo/hud/logic.js): what a seat may be shown, the odds bar, the reason chips,
// the menu's groups and controls, the forecast strip, the hour's timing, and the night's figures.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/config.mjs';
import { createSession } from '../src/session.mjs';
import { chances, bandOf } from '../src/contest.mjs';
import { chooseFromMenu } from '../src/menu.mjs';
import {
  seenOf, rollsOf, talkOf, tickerOf, barOf, riskBarOf, needleOf, segmentAt, marginOf, chipsOf, splitLabel, groupOf, groupMenu, rowByNumber,
  argSpec, choiceOf, forecastStrip, forecastStripAll, comingFor, scheduleOf, HOUR_MS, stopReason, dayLedger, nightFor, liveStandings, ordinal,
  linesFor, guideFor, GUIDE_HOURS, SEAT_TEXT, MODE_TEXT, plainHours, plainMove, bestMoves, numberMoves, clearShare, walkToward, LOOPS, GOAL, TURN_FACTS, risksOf, riskNeedleOf, riskMarginOf, sealedLine, isNews, isStaple,
  stapleValues, errandsOf, sortOffers, tradeDone, weightOf, TIGHTEST, leadMax, termsLine,
} from '../demo/hud/logic.js';
import { SEALED } from '../src/stage.mjs';

const HUD = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'demo', 'hud');

/** Play a session on auto to the end, calling `each(pending, session)` before every step and `after(result)` after. */
async function playOut(session, each = () => {}, after = () => {}) {
  for (let guard = 0; guard < 200; guard++) {
    const p = session.pending();
    if (p.kind === 'over') return p;
    each(p, session);
    after(p.kind === 'move' ? await session.auto() : await session.step({}), session);
  }
  throw new Error('the session never ended');
}

/** An hour line made by hand: `you` stands on the block while two others text each other and a third robs a fourth. */
function madeUpLine() {
  const roll = { P: 62, roll: 60, outcome: 'messy', why: ['a gun +15', 'Ambush 1 +5', "Rook's Toughness 2 −10"], decidedBy: [] };
  return {
    t: 5, day: 1, hour: 17,
    agents: {
      you: { text: 'rested', ok: true, block: 'bar', cash: 10, stash: 0, heat: 0, worth: 10 },
      kim: { block: 'bar', cash: 999, stash: 0, heat: 0, worth: 999, confessional: 'I am going to rob the new one tonight.', message: { to: 'wren', text: 'The newcomer is carrying. Meet me at the bar.' } },
      wren: { block: 'bar', cash: 1, stash: 0, heat: 0, worth: 1, confessional: 'Kim thinks I work for free.' },
      rook: { block: 'bar', cash: 5, stash: 0, heat: 0, worth: 5 },
    },
    events: [
      { kind: 'message', t: 5, block: 'bar', who: { sender: 'kim', receiver: 'wren' }, lists: { bystanders: ['you', 'rook'] }, data: {}, say: { text: 'The newcomer is carrying. Meet me at the bar.', to: 'wren' }, big: false },
      { kind: 'rob:messy', t: 5, block: 'bar', who: { robber: 'kim', target: 'rook' }, lists: { bystanders: ['you', 'wren'] }, data: { roll, cash: 40 }, big: true },
      { kind: 'say', t: 5, block: 'bar', who: { speaker: 'rook', listener: 'you' }, lists: { bystanders: ['kim', 'wren'] }, data: {}, say: { text: 'You saw that.', to: 'you' }, big: false },
      { kind: 'message', t: 5, block: 'docks', who: { sender: 'wren', receiver: 'you' }, lists: { bystanders: [] }, data: {}, say: { text: 'Watch Kim.', to: 'you' }, big: false },
      { kind: 'rob:clean', t: 5, block: 'docks', who: { robber: 'wren', target: 'kim' }, lists: { bystanders: [] }, data: { roll: { ...roll, roll: 3, outcome: 'clean' } }, big: true },
    ],
    rolls: [{ kind: 'rob', attacker: 'kim', defender: 'rook', ...roll }, { kind: 'rob', attacker: 'wren', defender: 'kim', ...roll, roll: 3, outcome: 'clean' }],
  };
}
const madeUpGame = { cfg: CONFIG, map: { blocks: { bar: { name: 'the bar' }, docks: { name: 'the docks' } } }, state: { agents: { you: { name: 'Juno' }, kim: { name: 'Kim' }, wren: { name: 'Wren' }, rook: { name: 'Rook' } }, npcs: {} }, feed: [] };

// ---------------------------------------------------------------------------------------------------------------
// What may be seen

test('watching shows the whole hour: every event, every roll, every confessional', () => {
  const line = madeUpLine();
  assert.deepEqual(seenOf(line, null, 'watch'), line.events);
  assert.equal(rollsOf(line, null, 'watch').length, 2);
  assert.equal(talkOf(line, null, 'watch').confessionals.length, 2);
  assert.equal(talkOf(line, null, 'watch').messages[0].text, 'The newcomer is carrying. Meet me at the bar.');
});

test('playing: a stranger\'s private message keeps its place and loses its words and who it went to', () => {
  const line = madeUpLine();
  const seen = seenOf(line, 'you', 'play');
  const sealed = seen.find(e => e.kind === 'message' && e.who.sender === 'kim');
  assert.ok(sealed, 'you stood on the block: you can see Kim is on the phone');
  assert.equal(sealed.sealed, true);
  assert.equal(sealed.say, undefined);
  assert.deepEqual(sealed.who, { sender: 'kim' });
  // nothing made from that hour, for a player or a coach, holds the words
  for (const mode of ['play', 'coach']) {
    const made = JSON.stringify([seenOf(line, 'you', mode), talkOf(line, 'you', mode), tickerOf(line, madeUpGame, { you: 'you', mode })]);
    assert.equal(made.includes('The newcomer is carrying'), false, `${mode} never sees the message`);
    assert.equal(made.includes('wren') && /"receiver":"wren"/.test(made), false);
  }
  // a message to you is yours to read
  const mine = talkOf(line, 'you', 'play').messages.find(m => m.to === 'you');
  assert.equal(mine.text, 'Watch Kim.');
  assert.deepEqual(talkOf(line, 'you', 'play').messages.find(m => m.from === 'kim'), { from: 'kim', to: null, text: null });
});

test('playing: no other seat\'s confessional, and a coach hears only their own agent\'s', () => {
  const line = madeUpLine();
  assert.deepEqual(talkOf(line, 'you', 'play').confessionals, []);
  assert.deepEqual(talkOf(line, 'wren', 'coach').confessionals, [{ from: 'wren', text: 'Kim thinks I work for free.' }]);
  assert.deepEqual(talkOf(line, 'you', 'coach').confessionals, []);
});

test('playing: a contest you only stood near keeps its outcome and loses its dice; your own keeps them', () => {
  const line = madeUpLine();
  const near = seenOf(line, 'you', 'play').find(e => e.kind === 'rob:messy');
  assert.equal(near.data.roll, undefined);
  assert.equal(near.data.cash, 40);
  assert.equal(line.events[1].data.roll.P, 62, 'the feed itself is not touched');
  assert.deepEqual(rollsOf(line, 'you', 'play'), []);
  assert.equal(tickerOf(line, madeUpGame, { you: 'you', mode: 'play' }).some(r => r.roll), false);
  // the one being robbed sees the roll that was made against them
  assert.equal(rollsOf(line, 'rook', 'play').length, 1);
  assert.equal(seenOf(line, 'rook', 'play').find(e => e.kind === 'rob:messy').data.roll.roll, 60);
  assert.equal(tickerOf(line, madeUpGame, { you: 'rook', mode: 'play' }).filter(r => r.roll).length, 1);
  // and nothing from a block you were not on
  assert.equal(seenOf(line, 'you', 'play').some(e => e.kind === 'rob:clean'), false);
});

test('a whole season played and coached: every event shown involved the seat, with no stranger\'s words or dice', async () => {
  for (const [mode, seat] of [['play', 'dealer'], ['coach', 'robber']]) {
    const session = createSession({ seed: 3, mode, seat });
    const you = session.you;
    let shown = 0;
    let hidden = 0;
    await playOut(session, () => {}, result => {
      for (const line of result.lines) {
        if (line.type !== 'hour') continue;
        const seen = seenOf(line, you, mode);
        shown += seen.length;
        hidden += line.events.length - seen.length;
        for (const e of seen) {
          const ids = [...Object.values(e.who ?? {}), ...Object.values(e.lists ?? {}).flat()];
          const part = Object.values(e.who ?? {}).includes(you);
          assert.ok(part || ids.includes(you) || e.sealed, `${e.kind} was shown to a seat that wasn't there`);
          if (!part) assert.equal(e.data?.roll, undefined, `${e.kind}: a stranger's dice`);
          if (e.kind === 'message' && !part) assert.equal(e.say, undefined);
        }
        for (const r of rollsOf(line, you, mode)) assert.ok(r.attacker === you || r.defender === you);
        const talk = talkOf(line, you, mode);
        for (const c of talk.confessionals) assert.equal(c.from, you);
        if (mode === 'play') assert.equal(talk.confessionals.length, 0);
        // the ticker's sentences never quote another seat's confessional
        const text = tickerOf(line, session.game, { you, mode }).map(r => r.text).join('\n');
        for (const [id, a] of Object.entries(line.agents)) if (a.confessional && id !== you) assert.equal(text.includes(a.confessional), false);
      }
    });
    assert.ok(shown > 0 && hidden > 0, `${mode}: some of the season was shown and some was not`);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// The odds bar

test('the bar\'s four segments add up to 100 and sit end to end, for every chance the engine can give', () => {
  for (let P = CONFIG.contest.min; P <= CONFIG.contest.max; P++) {
    const segments = barOf(chances(CONFIG, P));
    assert.deepEqual(segments.map(s => s.key), ['clean', 'messy', 'fail', 'disaster']);
    assert.equal(segments.reduce((sum, s) => sum + s.pct, 0), 100);
    assert.equal(segments[0].from, 0);
    assert.equal(segments[3].to, 100);
    for (let i = 1; i < 4; i++) assert.equal(segments[i].from, segments[i - 1].to);
    assert.equal(segments[0].pct + segments[1].pct, P, 'clean and messy together are the win chance');
  }
  // numbers that don't add up are scaled, never drawn past the end
  const odd = barOf({ clean: 30, messy: 30, fail: 30, disaster: 30 });
  assert.equal(Math.round(odd.reduce((sum, s) => sum + s.pct, 0)), 100);
  assert.equal(barOf(null).reduce((sum, s) => sum + s.pct, 0), 100);
});

test('the needle lands inside the band the engine gave the roll, for every roll at every chance', () => {
  for (let P = CONFIG.contest.min; P <= CONFIG.contest.max; P += 1) {
    const segments = barOf(chances(CONFIG, P));
    for (let roll = 0; roll < 100; roll++) {
      assert.equal(segmentAt(segments, needleOf(roll)).key, bandOf(CONFIG, P, roll), `P ${P}, roll ${roll}`);
    }
  }
  assert.ok(needleOf(0) > 0 && needleOf(99) < 100);
});

test('a close call reads as close: the margin is the distance from the win line', () => {
  assert.deepEqual(marginOf({ P: 62, roll: 61 }), { won: true, by: 1 });
  assert.deepEqual(marginOf({ P: 62, roll: 62 }), { won: false, by: 1 });
  assert.deepEqual(marginOf({ P: 62, roll: 5 }), { won: true, by: 57 });
  assert.deepEqual(marginOf({ P: 62, roll: 90 }), { won: false, by: 29 });
});

test('risky work draws the same bar in two parts', () => {
  const bar = riskBarOf({ what: 'a blow-up', pct: 6 });
  assert.equal(bar[0].pct + bar[1].pct, 100);
  assert.equal(bar[1].pct, 6);
  assert.equal(bar[1].label, 'a blow-up');
  assert.equal(bar[1].from, 94);
});

test('reason chips: at most three, the biggest first, ties in the engine\'s order', () => {
  const { chips, more } = chipsOf(['Aim 1 +5', 'a gun +15', "Kim's Toughness 3 −15", 'a tip +15', "Kim's muscle −13"]);
  assert.deepEqual(chips, [{ label: 'a gun', value: 15, good: true }, { label: "Kim's Toughness 3", value: 15, good: false }, { label: 'a tip', value: 15, good: true }]);
  assert.equal(more, 2);
  assert.deepEqual(chipsOf(['Ambush 2 +10', 'a gun +15']).chips.map(c => c.label), ['a gun', 'Ambush 2']);
  assert.deepEqual(chipsOf([]), { chips: [], more: 0 });
  assert.deepEqual(chipsOf(undefined), { chips: [], more: 0 });
  // a plain hyphen is read as a minus too
  assert.equal(chipsOf(["Dax's gun -10"]).chips[0].good, false);
});

// ---------------------------------------------------------------------------------------------------------------
// The menu

test('menu labels are cut into the move and its small print', () => {
  assert.deepEqual(splitLabel('walk to the market (the fence and the gun shop)'), { main: 'walk to the market', note: 'the fence and the gun shop' });
  assert.deepEqual(splitLabel('cook a batch: 3 chems into product (6% blow-up)'), { main: 'cook a batch', note: '3 chems into product (6% blow-up)' });
  assert.deepEqual(splitLabel("break into Juno's pad (they are home: a fight at the door)"), { main: "break into Juno's pad", note: 'they are home: a fight at the door' });
  assert.deepEqual(splitLabel('rob Kim'), { main: 'rob Kim', note: '' });
  assert.deepEqual(splitLabel('offer to sell your 6 product (quality 3) (usual price 20 each; add a due hour to make it on credit: goods now, paid from what the buyer earns)'),
    { main: 'offer to sell your 6 product (quality 3)', note: 'usual price 20 each' });
});

test('every menu of a season groups cleanly at every tightness: each entry once, number keys 1 to 9 in reading order', async () => {
  let menus = 0;
  let staples = 0;
  for (const seat of ['dealer', 'robber', 'smuggler', 'cook', 'gunrunner', 'muscle', 'informant']) {
    const session = createSession({ seed: 5, mode: 'play', seat });
    await playOut(session, p => {
      if (p.kind !== 'move' || !p.view.menu.length) return;
      menus += 1;
      const cls = p.view.you.cls;
      let rowsBefore = Infinity;
      for (const tight of [0, 1, 2, 3, TIGHTEST]) {
        const groups = groupMenu(p.view.menu, cls, { tight });
        const rows = groups.flatMap(g => [...g.shown, ...g.more]);
        assert.deepEqual(rows.map(r => r.entry.id).sort(), p.view.menu.map(m => m.id).sort(), 'every entry is in exactly one group');
        for (const g of groups) for (const r of [...g.shown, ...g.more]) assert.equal(groupOf(r.entry), g.id);
        const numbered = groups.flatMap(g => g.shown).map(r => r.n).filter(Boolean);
        assert.deepEqual(numbered, numbered.map((_, i) => i + 1), 'numbers run 1, 2, 3 with no gap');
        assert.ok(numbered.length >= 1 && numbered.length <= 9);
        for (const g of groups) for (const r of g.more) assert.equal(r.n, null, 'a line behind "more" has no number key');
        assert.equal(rowByNumber(groups, 1).n, 1);
        // a tighter menu never shows more lines than a looser one
        const onScreen = groups.flatMap(g => g.shown).length;
        assert.ok(onScreen <= rowsBefore);
        rowsBefore = onScreen;
        // what waits on the seat comes first: the walk to a pick-up, then the answers to a robbery
        if (p.view.menu.some(m => m.pickup)) assert.equal(groups[0].id, 'errand');
        else if (p.view.menu.some(m => m.answer)) assert.equal(groups[0].id, 'now');
        const hit = groups.find(g => g.id === 'hit');
        if (hit) {
          const odds = [...hit.shown, ...hit.more].map(r => r.entry.odds ?? 0);
          assert.deepEqual(odds, odds.slice().sort((a, b) => b - a), 'attacks run best odds first');
          if (cls === 'robber') assert.ok(groups.findIndex(g => g.id === 'hit') < groups.findIndex(g => g.id === 'go'));
          if (cls === 'robber') assert.ok(hit.shown.length >= Math.min(2, odds.length), 'a robber always has attacks on screen');
        }
        // the everyday moves are on screen at every tightness, and the walks and lie-low lines have a tile name
        for (const id of ['work', 'go', 'home']) for (const g of groups.filter(x => x.id === id)) assert.ok(g.shown.length > 0);
        for (const g of groups.filter(x => x.id === 'go' || x.id === 'home')) for (const r of g.shown) assert.ok(r.tile && r.tile.length <= 16, r.tile);
        // "make an offer" opens on the offers this class lives on: up to three, first, and on screen only when loose
        const deal = groups.find(g => g.id === 'deal');
        if (deal) {
          const all = [...deal.shown, ...deal.more];
          const first = all.filter(r => r.staple);
          assert.ok(first.length <= 3);
          assert.deepEqual(all.slice(0, first.length), first, 'the staples lead the group');
          for (const r of first) assert.ok(isStaple(r.entry, cls) && r.entry.move.to === 'anyone');
          assert.deepEqual(deal.shown, tight === 0 ? first : []);
          if (tight === 0) staples += first.length;
        }
      }
    });
  }
  assert.ok(menus > 300);
  assert.ok(staples > 100, 'the season offered staple lines');
});

test('the offers a seat lives on: a cook sells product and buys chems, and nobody is told to sell their only gun', async () => {
  const cook = createSession({ seed: 2, mode: 'play', seat: 'cook' });
  await cook.step({});
  await cook.step({ reply: { move: { id: cook.pending().view.menu.find(m => m.verb === 'work').id } } });
  const { view } = cook.pending();
  assert.ok(Object.values(view.you.goods.product).some(n => n > 0) && view.you.goods.chems > 0, 'the cook holds a batch and has chems left');
  const kinds = view.menu.filter(m => isStaple(m, 'cook')).map(m => `${m.move.terms.kind} ${m.move.terms.good}`).sort();
  assert.deepEqual(kinds, ['buy chems', 'sell product']);
  const robber = createSession({ seed: 2, mode: 'play', seat: 'robber' });
  await robber.step({});
  const menu = robber.pending().view.menu;
  assert.ok(menu.some(m => m.move.terms?.kind === 'sell' && m.move.terms.good === 'gun'), 'the robber could list its gun');
  assert.equal(menu.some(m => isStaple(m, 'robber')), false);
  // a staple the seat can pay for keeps the engine's own numbers; one it can't goes on credit for a real load
  const buy = view.menu.find(m => isStaple(m, 'cook') && m.move.terms.kind === 'buy');
  assert.deepEqual(stapleValues(buy, view), view.you.cash >= buy.move.terms.each * 3 ? {} : { n: 6, due: Math.min(buy.args.due.max, view.clock.t + 12) });
  const broke = structuredClone(view);
  broke.you.cash = 5;
  const onCredit = stapleValues(buy, broke);
  assert.equal(onCredit.n, 6);
  assert.ok(onCredit.due >= buy.args.due.min && onCredit.due <= buy.args.due.max);
  const move = chooseFromMenu(view.menu, choiceOf(buy, onCredit));
  assert.deepEqual({ n: move.terms.n, due: move.terms.due, each: move.terms.each }, { n: 6, due: onCredit.due, each: buy.move.terms.each });
});

test('pick-ups become errands, and the offers that match what a seat holds or needs come first', async () => {
  let errands = 0;
  let leads = 0;
  for (const seat of ['dealer', 'smuggler', 'cook', 'robber']) {
    const session = createSession({ seed: 5, mode: 'play', seat });
    await playOut(session, p => {
      if (p.kind !== 'move') return;
      const view = p.view;
      const list = errandsOf(view);
      assert.equal(list.length, view.pickups.length);
      for (const e of list) {
        errands += 1;
        assert.equal(e.here, e.moves === 0);
        assert.ok(e.withName && e.youGive && e.youGet && typeof e.hoursLeft === 'number');
        // the walk button is the menu's own walk line for that pick-up; nothing to press when they already share a block
        if (e.moves > 0 && view.menu.length) assert.equal(e.entry?.pickup, e.id);
        else assert.equal(e.entry, null);
      }
      const { lead, rest } = sortOffers(view);
      assert.equal(lead.length + rest.length, view.offers.length);
      assert.ok(lead.length <= 3);
      for (const o of lead) {
        leads += 1;
        assert.ok(view.offers.some(x => x.id === o.id));
        if (o.why === 'you hold this') {
          const held = o.terms.good === 'product' ? view.you.goods.product : o.terms.good === 'gun' ? view.you.goods.guns : null;
          const best = held ? Math.max(0, ...Object.entries(held).filter(([, n]) => n > 0).map(([q]) => Number(q))) : view.you.goods[o.terms.good] > 0 ? 1 : 0;
          assert.ok(best >= (o.terms.q ?? 1), `${o.text}: the seat can really fill it`);
        }
        if (o.why === 'you need this') assert.ok({ cook: 'chems', dealer: 'product', gunrunner: 'parts' }[view.you.cls] === o.terms.good);
        if (o.why === 'to you') assert.equal(o.board, false);
      }
      for (const o of rest) assert.equal(o.why, undefined);
      // an offer made to the seat itself is never pushed behind the board
      for (const o of view.offers.filter(x => !x.board).slice(0, 3)) assert.ok(lead.some(l => l.id === o.id));
      assert.equal(sortOffers(view, { max: leadMax(3) }).lead.length, Math.min(2, lead.length));
      assert.equal(sortOffers(view, { max: leadMax(TIGHTEST) }).lead.length, Math.min(1, lead.length));
    });
  }
  assert.ok(errands > 20 && leads > 50, `${errands} errands and ${leads} leading offers in four seasons`);
});

test('every argument shape the engine\'s menu builds has a control, and its default choice is the engine\'s own move', async () => {
  const kinds = new Set();
  const keys = new Set();
  for (const seat of ['dealer', 'robber', 'smuggler', 'cook', 'gunrunner', 'muscle', 'informant']) {
    const session = createSession({ seed: 2, mode: 'play', seat });
    await playOut(session, p => {
      if (p.kind !== 'move') return;
      const names = Object.fromEntries(p.view.cast.map(c => [c.id, c.name]));
      for (const entry of p.view.menu) {
        const controls = argSpec(entry, names);
        assert.deepEqual(controls.map(c => c.key).sort(), Object.keys(entry.args ?? {}).sort(), `${entry.label}: one control per argument`);
        for (const c of controls) {
          kinds.add(c.type);
          keys.add(c.key);
          if (c.type === 'pick') assert.ok(c.options.length > 0 && c.options.every(o => typeof o.label === 'string' && !/^a\d+$/.test(o.label)), 'people are offered by name');
          if (c.type === 'number') assert.ok(c.min <= c.value && c.value <= c.max, `${entry.label}: ${c.key} starts inside its range`);
          if (c.type === 'due') assert.ok(c.min <= c.max);
        }
        // the controls' starting values, sent as they are, are the move the engine wrote on the entry
        const values = Object.fromEntries(controls.filter(c => c.type !== 'task').map(c => [c.key, c.value]));
        const move = chooseFromMenu(p.view.menu, choiceOf(entry, values));
        assert.deepEqual(move, entry.move, entry.label);
      }
    });
  }
  assert.deepEqual([...kinds].sort(), ['due', 'number', 'pick', 'task', 'text', 'toggle']);
  for (const key of ['to', 'n', 'each', 'amount', 'repay', 'due', 'courier', 'task', 'pay', 'cash', 'name']) assert.ok(keys.has(key), `the season built a "${key}" argument`);
});

test('the controls\' values reach the engine: who, how many, on credit, by courier, a job', async () => {
  const session = createSession({ seed: 2, mode: 'play', seat: 'cook' });
  await session.step({});
  const { view } = session.pending();
  const sell = view.menu.find(m => m.verb === 'offer' && m.move.terms?.kind === 'sell' && m.move.to === 'anyone');
  const other = view.cast[0].id;
  const move = chooseFromMenu(view.menu, choiceOf(sell, { to: other, n: 2, each: 31, courier: true, due: sell.args.due.min }));
  assert.equal(move.to, other);
  assert.deepEqual({ n: move.terms.n, each: move.terms.each, courier: move.terms.courier, due: move.terms.due }, { n: 2, each: 31, courier: true, due: sell.args.due.min });
  // the terms in one line, as the move card shows them before anyone asks to change them
  const names = Object.fromEntries(view.cast.map(c => [c.id, c.name]));
  const line = termsLine(argSpec(sell, names), { to: other, n: 2, each: 31, courier: true, due: null }, t => `hour ${t}`);
  assert.equal(line, `to ${view.cast[0].name} \u00b7 2 units \u00b7 price each $31 \u00b7 by courier \u00b7 paid on the spot`);
  assert.match(termsLine(argSpec(sell, names), {}), /^to anyone \(the board\) \u00b7 \d+ units? \u00b7 price each \$\d+ \u00b7 paid on the spot$/);
  // left alone, "on credit" stays off
  assert.equal(chooseFromMenu(view.menu, choiceOf(sell, { due: null, courier: false })).terms.due, undefined);
  const job = view.menu.find(m => m.move.terms?.kind === 'job');
  const posted = chooseFromMenu(view.menu, choiceOf(job, { to: 'anyone', pay: 20, task: { type: 'rob', agent: other, hours: 9 } }));
  assert.deepEqual(posted.terms.task, { type: 'rob', agent: other });
  assert.equal(posted.terms.pay, 20);
  assert.deepEqual(chooseFromMenu(view.menu, choiceOf(job, { task: { type: 'guard', hours: 40 } })).terms.task, { type: 'guard', hours: 12 });
  // and the engine takes the job as posted
  const result = await session.step({ reply: { move: choiceOf(job, { to: 'anyone', pay: 20, task: { type: 'rob', agent: other } }) } });
  assert.equal(result.lines[0].agents[session.you].ok, true, result.lines[0].agents[session.you].text);
});

// ---------------------------------------------------------------------------------------------------------------
// What is coming

test('the forecast strip is the seat\'s own knowledge: twelve hours, police only as far as it can see', async () => {
  const session = createSession({ seed: 3, mode: 'play', seat: 'dealer' });
  await session.step({});
  const { view } = session.pending();
  const strip = forecastStrip(view, CONFIG);
  assert.equal(strip.length, CONFIG.season.hoursPerDay);
  assert.deepEqual(strip.map(c => c.hour), Array.from({ length: 12 }, (_, i) => 12 + i));
  assert.equal(strip.filter(c => c.now).length, 1);
  const known = strip.filter(c => c.police !== null).map(c => c.hour);
  assert.deepEqual(known, view.forecast.police.map(p => p.hour), 'no police cell past what the view holds');
  assert.ok(known.length < 12);
  for (const c of strip) {
    assert.equal(c.dunn.length > 0, c.hour >= view.forecast.robbers.fromHour);
    assert.equal(c.here.police, !!c.police?.includes(view.here.block));
  }
  // a watcher is given the whole day
  const all = forecastStripAll(session.game.feed.find(l => l.type === 'forecast').forecast, CONFIG, 12, 'uptown');
  assert.equal(all.filter(c => c.police.length > 0).length, 12);
  assert.deepEqual(all.slice(0, known.length).map(c => c.police), strip.slice(0, known.length).map(c => c.police));
});

test('"what is coming for me" is one or two plain lines, the worst first', async () => {
  const session = createSession({ seed: 3, mode: 'play', seat: 'dealer' });
  await session.step({});
  const { view } = session.pending();
  const calm = comingFor(view, CONFIG);
  assert.ok(calm.length >= 1 && calm.length <= 2);
  const hot = structuredClone(view);
  hot.here.police = true;
  hot.you.heat = CONFIG.heat.arrestAt;
  hot.forecast.robbers = { who: 'the Dunn brothers', fromHour: view.clock.hour, blocks: [view.here.block] };
  const lines = comingFor(hot, CONFIG);
  assert.equal(lines.length, 2);
  assert.ok(lines[0].bad && /arrest/.test(lines[0].text));
  assert.ok(/Dunn brothers/.test(lines[1].text));
});

// ---------------------------------------------------------------------------------------------------------------
// The hour playing back

test('an hour is fitted to ten seconds: a busy one is squeezed, a thin one ends early', () => {
  const row = (kind, extra = {}) => ({ kind, big: false, roll: null, ...extra });
  const busy = Array.from({ length: 27 }, (_, i) => row(i % 5 === 0 ? 'rob:clean' : 'offer:board', i % 5 === 0 ? { big: true, roll: { P: 50, roll: 10 } } : {}));
  const fit = scheduleOf(busy);
  assert.ok(fit.total <= HOUR_MS);
  assert.equal(fit.at.length, busy.length);
  for (let i = 1; i < fit.at.length; i++) assert.ok(fit.at[i] > fit.at[i - 1]);
  assert.ok(fit.at[fit.at.length - 1] < fit.total);
  const thin = scheduleOf([row('quiet')]);
  assert.ok(thin.total >= 2400 && thin.total < 5000);
  // a roll is given more room than a walk
  const mixed = scheduleOf([row('rob:clean', { big: true, roll: { P: 50, roll: 10 } }), row('move'), row('move')]);
  assert.ok(mixed.at[1] - mixed.at[0] > (mixed.at[2] - mixed.at[1]) * 3);
});

test('the ticker of a played season is plain sentences: no "undefined", no "$NaN", no agent id, and it knows when to stop auto', async () => {
  for (const seat of ['robber', 'dealer', 'smuggler', 'cook']) {
    const session = createSession({ seed: 3, mode: 'play', seat });
    const you = session.you;
    const stops = [];
    const seenKinds = { sealed: 0, news: 0, plain: 0 };
    await playOut(session, () => {}, result => {
      for (const line of result.lines) {
        if (line.type !== 'hour') continue;
        const ticker = tickerOf(line, session.game, { you, mode: 'play' });
        assert.ok(ticker.length >= 1);
        for (const r of ticker) {
          assert.ok(r.text.length > 3, r.kind);
          assert.equal(/undefined|NaN|\bnull\b|\[object|\ba\d+\b|npc:|\bo\d+\b|  /.test(r.text), false, `${r.kind}: ${r.text}`);
          assert.ok(/[.!?”"]$/.test(r.text), r.text);
          if (r.roll) assert.ok(r.roll.attacker === you || r.roll.defender === you);
          if (r.risk) assert.equal(r.risk.agent, you);
          seenKinds[r.kind === 'sealed' || r.kind === 'news' ? r.kind : 'plain'] += 1;
          assert.ok(weightOf(r) > 0);
        }
        const why = stopReason(line, you);
        if (why) stops.push(why);
        if (['jail', 'clinic'].includes(line.agents[you].block)) assert.ok(why, 'being held always stops the auto run');
      }
    });
    assert.ok(seenKinds.sealed > 0 && seenKinds.news > 0 && seenKinds.plain > 30, `${seat}: ${JSON.stringify(seenKinds)}`);
    assert.ok(stops.length > 3 && stops.length < 60, `${seat}: ${stops.length} stops in 60 hours`);
  }
  assert.equal(stopReason({ agents: { x: { ok: true, block: 'bar' } }, events: [] }, 'x'), null);
});

test('private business seen from outside is one short line a family, and is never put through describe()', async () => {
  assert.equal(sealedLine('phone', ['Ansel']), 'Ansel is on the phone.');
  assert.equal(sealedLine('phone', ['Ansel', 'Kim']), 'Ansel and Kim are on their phones.');
  assert.equal(sealedLine('counter', ['Ansel']), 'Ansel did some business at the counter.');
  assert.equal(sealedLine('floor', ['Ansel']), 'Ansel was at the floorboards.');
  assert.equal(sealedLine('watch', ['Ansel', 'Silas', 'Kim']), 'Ansel, Silas and Kim are watching the block.');
  assert.equal(sealedLine('anything else', []), 'Someone had a quiet word with someone.');
  const session = createSession({ seed: 3, mode: 'play', seat: 'dealer' });
  const you = session.you;
  const families = new Set();
  let phones = 0;
  await playOut(session, () => {}, result => {
    for (const line of result.lines) {
      if (line.type !== 'hour') continue;
      const seen = seenOf(line, you, 'play');
      const ticker = tickerOf(line, session.game, { you, mode: 'play' });
      const sealedRows = ticker.filter(r => r.kind === 'sealed');
      // every sealed event the seat stood near is in exactly one sealed row, and in no other row
      const sealed = seen.filter(e => e.sealed);
      for (const e of sealed) {
        assert.ok(SEALED.includes(e.kind) || e.kind === 'job:posted');
        assert.deepEqual(e.data, {});
        assert.equal(Object.keys(e.who).length <= 1, true);
        assert.equal(ticker.some(r => r.event === e), false, 'a sealed event carries no sentence of its own');
      }
      assert.equal(new Set(sealedRows.map(r => r.family)).size, sealedRows.length, 'one row a family');
      const actors = new Set(sealed.map(e => Object.values(e.who)[0]).filter(Boolean));
      assert.deepEqual(new Set(sealedRows.flatMap(r => r.who)), actors);
      for (const r of sealedRows) {
        families.add(r.family);
        phones += r.texting.length;
        assert.equal(r.event, null);
        assert.equal(r.roll, null);
        assert.ok(/^[A-Z][\w. ,'-]+ (is|are|was|were|did|had) /.test(r.text), r.text);
        assert.equal(/\$|\d/.test(r.text), false, `no price and no number in "${r.text}"`);
      }
    }
  });
  assert.ok(families.has('watch') && families.size >= 2, [...families].join(', '));
  // (bots send no private messages, so a played season has no sealed phone chip of its own: the made-up hour has one)
  const made = tickerOf(madeUpLine(), madeUpGame, { you: 'you', mode: 'play' }).find(r => r.kind === 'sealed');
  assert.deepEqual(made.texting, ['kim']);
  assert.equal(made.text, 'Kim is on the phone.');
  assert.equal(phones, 0);
});

test('the city\'s public news reaches a player\'s ticker, and nothing private rides in with it', async () => {
  assert.equal(isNews({ kind: 'lead' }), true);
  assert.equal(isNews({ kind: 'offer:board' }), true);
  assert.equal(isNews({ kind: 'job:posted', data: { to: 'anyone' } }), true);
  assert.equal(isNews({ kind: 'job:posted', data: { to: 'a3' } }), false);
  for (const kind of SEALED) assert.equal(isNews({ kind, data: {} }), false, `${kind} is private business, never news`);
  for (const kind of ['rob:clean', 'move', 'work:deal', 'say', 'pickup', 'arrest']) assert.equal(isNews({ kind }), false);
  const session = createSession({ seed: 3, mode: 'play', seat: 'dealer' });
  const you = session.you;
  let news = 0;
  let leads = 0;
  await playOut(session, () => {}, result => {
    for (const line of result.lines) {
      if (line.type !== 'hour') continue;
      const rows = tickerOf(line, session.game, { you, mode: 'play' }).filter(r => r.kind === 'news');
      assert.ok(rows.length <= 5, 'at most four items and a count of the rest');
      for (const r of rows) {
        news += 1;
        if (r.news === 'lead') leads += 1;
        if (!r.event) continue;
        assert.ok(isNews(r.event));
        assert.equal(r.roll, null);
        // it happened where the seat was not: what the seat saw itself is told once, by the seat's own rows
        const ids = [...Object.values(r.event.who ?? {}), ...Object.values(r.event.lists ?? {}).flat()];
        assert.equal(ids.includes(you), false);
      }
      // a watcher's ticker has no news rows: it already has everything
      assert.equal(tickerOf(line, session.game, { mode: 'watch' }).some(r => r.kind === 'news'), false);
    }
  });
  assert.ok(news > 20 && leads > 0, `${news} news rows, ${leads} lead changes`);
});

test('the risk needle: a seat sees its own risky hours, a watcher sees them all, and the needle lands on the right side', async () => {
  // the bar draws "goes fine" first, so the low rolls (the engine's trouble) are mirrored onto its right end
  for (let chance = 1; chance <= 60; chance++) {
    const bar = riskBarOf({ pct: chance, what: 'a bust' });
    for (let roll = 0; roll < 100; roll++) {
      const hit = roll < chance;
      assert.equal(segmentAt(bar, riskNeedleOf(roll)).key, hit ? 'disaster' : 'clean', `chance ${chance}, roll ${roll}`);
      const m = riskMarginOf({ chance, roll, hit });
      assert.equal(m.hit, hit);
      assert.ok(m.by >= 1);
    }
  }
  assert.deepEqual(riskMarginOf({ chance: 6, roll: 5, hit: true }), { hit: true, by: 1 });
  assert.deepEqual(riskMarginOf({ chance: 6, roll: 6, hit: false }), { hit: false, by: 1 });
  const line = { risks: [{ what: 'a blow-up', agent: 'a3', chance: 6, roll: 41, hit: false }, { what: 'a bust', agent: 'a1', chance: 25, roll: 3, hit: true }, { what: 'a sting', agent: 'a6', chance: 0, roll: 9, hit: false }] };
  assert.deepEqual(risksOf(line, 'a3', 'play').map(r => r.agent), ['a3']);
  assert.deepEqual(risksOf(line, 'a3', 'coach').map(r => r.agent), ['a3']);
  assert.deepEqual(risksOf(line, 'a9', 'play'), []);
  assert.deepEqual(risksOf(line, null, 'watch').map(r => r.agent), ['a3', 'a1'], 'a chance of nothing has no needle');
  // a cook's season: every batch cooked carries its own roll on its own row, and nobody else's work does
  const session = createSession({ seed: 5, mode: 'play', seat: 'cook' });
  const you = session.you;
  let mine = 0;
  let all = 0;
  await playOut(session, () => {}, result => {
    for (const hour of result.lines.filter(l => l.type === 'hour')) {
      const rows = tickerOf(hour, session.game, { you, mode: 'play' }).filter(r => r.risk);
      for (const r of rows) {
        mine += 1;
        assert.equal(r.risk.agent, you);
        assert.ok(/^work:cook/.test(r.kind));
        assert.equal(r.risk.hit, r.kind === 'work:cook:blowup');
        assert.equal(r.risk.hit, r.risk.roll < r.risk.chance);
      }
      assert.equal(rows.length, hour.risks.filter(r => r.agent === you && r.chance > 0).length);
      all += tickerOf(hour, session.game, { mode: 'watch' }).filter(r => r.risk).length;
    }
  });
  assert.ok(mine >= 5, `${mine} batches with a needle`);
  assert.ok(all >= mine);
  // a watcher gets every risk rolled in the city, each on the row of the work it belongs to
  const watch = createSession({ seed: 3, mode: 'watch' });
  const agents = new Set();
  await playOut(watch, () => {}, result => {
    for (const hour of result.lines.filter(l => l.type === 'hour')) {
      const rows = tickerOf(hour, watch.game, { mode: 'watch' }).filter(r => r.risk);
      assert.equal(rows.length, hour.risks.filter(r => r.chance > 0).length);
      for (const r of rows) agents.add(r.risk.agent);
    }
  });
  // (in bot seasons the cook is nearly always the only one who takes a plain chance: smugglers stay off a policed dock)
  assert.ok(agents.size >= 1, `risks from ${agents.size} seats in a watched season`);
});

test('hours counted from the season\'s start are said as a clock time', () => {
  assert.equal(plainHours('Indy buys 32 product for $24 each, on credit: paid by hour 16', { cfg: CONFIG }), 'Indy buys 32 product for $24 each, on credit: paid by day 2, 16:00');
  assert.equal(plainHours('rested for an hour', { cfg: CONFIG }), 'rested for an hour');
});

// ---------------------------------------------------------------------------------------------------------------
// The night and the standings

test('the night screen shows a player their own night and the public standings, and a watcher everything', async () => {
  const session = createSession({ seed: 3, mode: 'play', seat: 'dealer' });
  let checked = 0;
  await playOut(session, () => {}, result => {
    for (const night of result.lines.filter(l => l.type === 'night')) {
      checked += 1;
      const mine = nightFor(night, session.you, 'play');
      assert.equal(mine.standings.length, 10);
      for (const row of mine.standings) {
        assert.equal(row.worth !== undefined, row.id === session.you, 'an exact figure only on your own row');
        assert.ok(row.bracket && row.rank >= 1);
      }
      assert.ok(mine.points.every(p => p.id === session.you));
      assert.ok(mine.evicted.length === 0);
      if (mine.job) assert.equal(mine.job.target, session.you);
      assert.equal(mine.yours.paid || !!mine.yours.evicted, true);
      const all = nightFor(night, null, 'watch');
      assert.ok(all.standings.every(r => typeof r.worth === 'number'));
      assert.equal(all.points.length, 10);
      // the day's money adds up
      const ledger = dayLedger(session.game.feed, session.you, night.day);
      assert.equal(ledger.start + ledger.earned - ledger.lost, ledger.end);
      assert.equal(ledger.rows.length, CONFIG.season.hoursPerDay);
    }
  });
  assert.equal(checked, CONFIG.season.days - 1);
});

test('a watcher\'s live standings rank all ten by worth', async () => {
  const session = createSession({ seed: 1, mode: 'watch' });
  const { lines } = await session.step();
  const rows = liveStandings(lines[0], session.game.state.order);
  assert.equal(rows.length, 10);
  assert.deepEqual(rows.map(r => r.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].worth >= rows[i].worth);
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd']);
});

// ---------------------------------------------------------------------------------------------------------------
// Speaking, the guide, the words

test('a human speaks from the banks, the one that fits the hour first', async () => {
  const session = createSession({ seed: 3, mode: 'play', seat: 'dealer' });
  await session.step({});
  const { view } = session.pending();
  const { situation, banks } = linesFor(view, null);
  assert.equal(banks[0][0], situation);
  assert.equal(banks.length, 6);
  for (const [, lines] of banks) assert.ok(lines.length >= 15);
  assert.equal(linesFor(view, { verb: 'attack', target: 'a1', how: 'rob' }).situation, 'robbing');
});

test('the guide is one mark an hour: one short line, a line that is really on the menu, an offer that is really there', async () => {
  for (const seat of Object.keys(SEAT_TEXT)) {
    const session = createSession({ seed: 4, mode: 'play', seat });
    const { map } = session.game;
    await session.step({});
    let pointed = 0;
    for (let t = 0; t < 4; t++) {
      const { view } = session.pending();
      if (!view.menu.length) {
        assert.equal(guideFor(view, {}, map), null, 'no mark for a seat with no move to make');
        await session.auto();
        continue;
      }
      const mark = guideFor(view, {}, map);
      assert.ok(mark.say.length > 15 && mark.say.length <= 80, `${seat}: "${mark.say}" is one short line`);
      assert.equal(/undefined|NaN|\ba\d+\b/.test(mark.say), false, mark.say);
      if (mark.entry) {
        pointed += 1;
        assert.ok(view.menu.includes(mark.entry));
        // the line the mark points at leads the move card
        assert.equal(bestMoves(view, { pin: mark.entry })[0], mark.entry);
      }
      if (mark.offer) {
        assert.ok(view.offers.some(o => o.id === mark.offer.id));
        // once the player has said yes, the mark moves on from the offer
        assert.notEqual(guideFor(view, { accepted: [mark.offer.id] }, map)?.offer?.id, mark.offer.id);
      }
      await session.step({ reply: { move: { id: (mark.entry ?? view.menu.find(m => m.verb === 'rest')).id }, accept: mark.offer ? [mark.offer.id] : [] } });
    }
    assert.ok(pointed >= 3, `${seat}: the guide pointed at a real line in ${pointed} of 4 hours`);
  }
});

test('the guide follows what the seat holds and has done, not the clock', async () => {
  const session = createSession({ seed: 4, mode: 'play', seat: 'cook' });
  const { map } = session.game;
  await session.step({});
  const view = session.pending().view;
  // chems in the bag at home: cook. The same hour with the bag empty: order chems.
  assert.equal(guideFor(view, {}, map).entry.verb, 'work');
  const dry = structuredClone(view);
  dry.you.goods.chems = 0;
  dry.menu = view.menu.filter(m => m.verb !== 'work');
  const order = guideFor(dry, {}, map);
  assert.deepEqual([order.entry.move.terms.kind, order.entry.move.terms.good], ['buy', 'chems']);
  // the same state at a later hour gives the same mark: nothing in it reads the clock but the day's end
  const later = structuredClone(view);
  later.clock.t = 7;
  assert.equal(guideFor(later, {}, map).say, guideFor(view, {}, map).say);
  // a walk toward a place takes the first step of the shortest way there
  const dealer = createSession({ seed: 4, mode: 'play', seat: 'smuggler' });
  await dealer.step({});
  const home = dealer.pending().view;
  assert.equal(walkToward(home, map, 'docks').move.to, 'corner');
  assert.equal(walkToward(home, map, home.here.block), null);
});

test('the guide walks each of the four offered seats through one whole first trade, then says so once and goes quiet', async () => {
  const tally = {};
  for (const seat of ['dealer', 'robber', 'smuggler', 'cook']) {
    const doneAt = [];
    for (let seed = 1; seed <= 12; seed++) {
      const session = createSession({ seed, mode: 'play', seat });
      const { map } = session.game;
      await session.step({});
      const memo = { traded: false, closed: false };
      let at = null;
      for (let h = 0; h < GUIDE_HOURS && session.pending().kind === 'move'; h++) {
        const { view } = session.pending();
        const mark = guideFor(view, memo, map);
        let result;
        if (!view.menu.length || !mark) result = await session.auto();
        else {
          // do exactly what the marks say, as a first-timer would: the yes first when there is one, then the move the
          // mark points at next (a staple offer goes out with the HUD's own starting values)
          const accept = mark.offer ? [mark.offer.id] : [];
          const next = mark.offer ? guideFor(view, { ...memo, accepted: accept }, map) : mark;
          const entry = next?.entry ?? mark.entry ?? view.menu.find(m => m.verb === 'rest');
          const move = isStaple(entry, view.you.cls) ? choiceOf(entry, stapleValues(entry, view)) : { id: entry.id };
          result = await session.step({ reply: { move, accept } });
        }
        if (!memo.traded && tradeDone(result.lines.find(l => l.type === 'hour'), session.you)) {
          memo.traded = true;
          at = h;
          // the hour after: one line that names what just happened, then nothing more
          const after = session.pending();
          if (after.kind === 'move' && after.view.menu.length) {
            assert.match(guideFor(after.view, memo, map).say, /whole trade/);
            assert.equal(guideFor(after.view, { traded: true, closed: true }, map), null);
          }
        }
      }
      doneAt.push(at);
    }
    const done = doneAt.filter(h => h !== null);
    tally[seat] = `${done.length}/12 (${doneAt.map(h => h ?? '-').join(' ')})`;
    assert.ok(done.length >= 9, `${seat}: following the guide finished a trade in ${done.length} of 12 seasons (${doneAt.join(' ')})`);
    assert.ok(done.slice().sort((a, b) => a - b)[Math.floor(done.length / 2)] <= 5, `${seat}: the median first trade is done by 17:00 (${doneAt.join(' ')})`);
  }
  if (process.env.HUD_GUIDE_TALLY) console.log(tally);
  // past the first day the guide is over, traded or not
  const session = createSession({ seed: 1, mode: 'play', seat: 'dealer' });
  await session.step({});
  const late = structuredClone(session.pending().view);
  late.clock.t = GUIDE_HOURS;
  assert.equal(guideFor(late, {}, session.game.map), null);
});

test('the move card: plain words for every move, the best three on one numbering with the full menu', async () => {
  let moves = 0;
  let priced = 0;
  for (const seat of ['dealer', 'robber', 'smuggler', 'cook', 'gunrunner', 'muscle', 'informant']) {
    const session = createSession({ seed: 5, mode: 'play', seat });
    await playOut(session, p => {
      if (p.kind !== 'move' || !p.view.menu.length) return;
      const view = p.view;
      for (const entry of view.menu) {
        moves += 1;
        const words = plainMove(entry, view, session.game);
        assert.ok(words.title.length >= 4 && words.title.length <= 60, `${entry.label} → "${words.title}"`);
        assert.ok(words.title[0] === words.title[0].toUpperCase());
        assert.ok(typeof words.gain === 'string' && words.gain.length <= 110, `${entry.label} → "${words.gain}"`);
        assert.equal(/undefined|NaN|null|\ba\d+\b|\[object/.test(`${words.title} ${words.gain}`), false, `${entry.label} → ${words.title}: ${words.gain}`);
        if (seat === 'dealer' && entry.verb === 'work' && entry.move.option !== 'claim') {
          priced += 1;
          assert.match(words.gain, /^about \$\d+ a unit, \d units?$/);
        }
      }
      // the card: at most three, the pinned line first, what waits on the seat next
      const best = bestMoves(view);
      assert.ok(best.length >= 1 && best.length <= 3);
      assert.equal(new Set(best).size, best.length);
      for (const e of best) assert.ok(view.menu.includes(e));
      const walk = view.menu.find(m => m.pickup);
      if (walk) assert.equal(best[0], walk, 'a pick-up to walk to leads the card');
      const pin = view.menu[view.menu.length - 1];
      assert.equal(bestMoves(view, { pin })[0], pin);
      // one numbering: the card is 1, 2, 3 and the menu carries on, with no number used twice
      const groups = groupMenu(view.menu, view.you.cls);
      const card = numberMoves(groups, best);
      assert.deepEqual(card.map(r => r.n), best.map((_, i) => i + 1));
      assert.deepEqual(card.map(r => r.entry), best);
      const numbered = groups.flatMap(g => [...g.shown, ...g.more]).filter(r => r.n).map(r => r.n).sort((a, b) => a - b);
      assert.deepEqual(numbered, numbered.map((_, i) => i + 1));
      assert.ok(numbered.length <= 9);
      for (const n of numbered) assert.equal(rowByNumber(groups, n).n, n);
    });
  }
  assert.ok(moves > 5000 && priced >= 3, `${moves} moves put into words, ${priced} street sales priced`);
});

test('a dealer\'s "about $X a unit" is what the street then pays', async () => {
  const session = createSession({ seed: 5, mode: 'play', seat: 'dealer' });
  let checked = 0;
  for (let guard = 0; guard < 200 && session.pending().kind !== 'over'; guard++) {
    const p = session.pending();
    if (p.kind !== 'move') {
      await session.step({});
      continue;
    }
    const sell = p.view.menu.find(m => m.verb === 'work' && m.move.option !== 'claim');
    if (!sell || p.view.here.buyers?.turf) {
      await session.auto();
      continue;
    }
    const said = Number(/about \$(\d+)/.exec(plainMove(sell, p.view, session.game).gain)[1]);
    const before = p.view.you.cash;
    const { lines } = await session.step({ reply: { move: { id: sell.id } } });
    const deal = lines[0].events.find(e => e.kind === 'work:deal' && e.who.dealer === session.you);
    if (!deal || !deal.data?.sold || deal.data.sharePct !== 100) continue;
    checked += 1;
    // the first unit sells at the price shown; the next ones a little under it as demand drops
    const each = deal.data.cash / deal.data.sold;
    assert.ok(each <= said * 1.05 && each >= said * 0.6, `said about $${said}, got $${each.toFixed(1)} a unit (cash ${before} → ${lines[0].agents[session.you].cash})`);
  }
  assert.ok(checked >= 3, `${checked} street sales checked against their button`);
});

test('the seat\'s loop in three steps, and the goal in a sentence', () => {
  assert.ok(GOAL.length < 50);
  assert.deepEqual(Object.keys(LOOPS).sort(), Object.keys(SEAT_TEXT).sort());
  for (const steps of Object.values(LOOPS)) {
    assert.equal(steps.length, 3);
    for (const [icon, text] of steps) assert.ok(icon && text.length > 10 && text.length <= 52, text);
  }
  assert.ok(TURN_FACTS.length <= 3 && TURN_FACTS.every(t => t.length < 90));
});

test('the window left to the game: the union of the plates, overlaps counted once', () => {
  assert.equal(clearShare([], 1000, 500), 1);
  assert.equal(clearShare([{ x: 0, y: 0, w: 1000, h: 500 }], 1000, 500), 0);
  assert.equal(clearShare([{ x: 0, y: 0, w: 500, h: 500 }], 1000, 500), 0.5);
  // two plates that overlap by half cover three quarters of what two apart would
  assert.equal(clearShare([{ x: 0, y: 0, w: 200, h: 100 }, { x: 100, y: 0, w: 200, h: 100 }], 1000, 100), 0.7);
  assert.equal(clearShare([{ x: 0, y: 0, w: 200, h: 100 }, { x: 300, y: 0, w: 200, h: 100 }], 1000, 100), 0.6);
  // a plate hanging off the edge only counts for what is on screen; one inside another counts once
  assert.equal(clearShare([{ x: -50, y: -50, w: 100, h: 100 }], 100, 100), 0.75);
  assert.equal(clearShare([{ x: 0, y: 0, w: 100, h: 100 }, { x: 20, y: 20, w: 10, h: 10 }], 200, 100), 0.5);
  // a cross: 3 + 3 − 1 cells of a 3 × 3 grid
  assert.ok(Math.abs(clearShare([{ x: 0, y: 1, w: 3, h: 1 }, { x: 1, y: 0, w: 1, h: 3 }], 3, 3) - 4 / 9) < 1e-9);
});

test('one sentence for every seat and every way to sit', () => {
  assert.deepEqual(Object.keys(SEAT_TEXT).sort(), [...new Set(CONFIG.seats)].sort());
  for (const [, text] of [...Object.values(SEAT_TEXT), ...Object.values(MODE_TEXT)]) {
    assert.ok(text.length > 20 && text.length < 110, text);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// The files themselves

test('the HUD runs in a browser: relative imports only, and nothing from Node', () => {
  const bad = [];
  let reachedEngine = 0;
  for (const file of fs.readdirSync(HUD).filter(f => f.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(HUD, file), 'utf8');
    for (const m of text.matchAll(/^\s*(?:import|export)\b[^'"\n]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm)) {
      const spec = m[1] ?? m[2];
      if (!spec.startsWith('.')) bad.push(`${file} imports ${spec}`);
      else if (!fs.existsSync(path.resolve(HUD, spec))) bad.push(`${file} imports ${spec}, which is not there`);
      if (spec.includes('/src/')) reachedEngine += 1;
    }
    if (/\bprocess\.|require\(/.test(text)) bad.push(`${file} uses Node`);
  }
  assert.deepEqual(bad, []);
  assert.ok(reachedEngine > 3);
});

test('the HUD\'s stylesheet names no colour of its own and no text under 12.5 px', () => {
  const css = fs.readFileSync(path.join(HUD, 'hud.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepEqual(css.match(/#[0-9a-fA-F]{3,8}\b(?![\w-])|\brgba?\(|\bhsla?\(/g) ?? [], [], 'every colour is one of the kit\'s tokens');
  // sizes are the kit's tokens, or a whole number of kit pixels: never a bare px size, never under 12.5
  for (const rule of css.match(/font(?:-size)?:[^;}]+/g) ?? []) {
    assert.equal(/\d(?:\.\d+)?px/.test(rule.replace(/\/[\d.]+/, '')), false, `${rule}: a bare px size`);
    for (const m of rule.matchAll(/calc\((\d+(?:\.\d+)?) \* var\(--k-px\)\)/g)) assert.ok(Number(m[1]) >= 12.5, rule);
  }
});
