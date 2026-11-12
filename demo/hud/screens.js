// The HUD's full screens: the start, the night (rent, standings, the day's money, the level-up and the coach's
// levers), the end, and the reveal-all. Each builds a plate into the overlay and calls back when the person is done.

import { h, fill, face, clsTag } from './dom.js';
import { MODE_TEXT, SEAT_TEXT, MORE_SEATS, GOAL, LOOPS, TURN_FACTS, nightFor, ordinal, money, nameOf, clockOf, plainHours } from './logic.js';
import { HUMAN_SEATS, MODES } from '../../src/session.mjs';

const kbd = key => h('kbd', null, key);

/** A button that reads as one of a set: pressed or not. */
function option(label, sub, pressed, onclick, extra = {}) {
  return h('button', { type: 'button', class: `hk-option${pressed ? ' is-on' : ''}`, 'aria-pressed': pressed ? 'true' : 'false', onclick, ...extra },
    h('b', null, label), sub ? h('span', null, sub) : null);
}

// ---------------------------------------------------------------------------------------------------------------
// The start

export function startScreen(ctx, { seed, mode = 'play', seat = 'dealer', saved = null, onStart, onResume, onDiscard }) {
  const pick = { mode, seat, seed, more: MORE_SEATS.includes(seat) };
  const plate = h('div', { class: 'hk-plate hk-start' });

  function draw() {
    const seats = pick.more ? [...HUMAN_SEATS, ...MORE_SEATS] : HUMAN_SEATS;
    const seedBox = h('input', { class: 'hk-input', type: 'number', min: '1', max: '999999', value: String(pick.seed), 'aria-label': 'seed', oninput: e => { pick.seed = Math.max(1, Math.floor(Number(e.target.value) || 1)); } });
    fill(plate,
      h('header', { class: 'hk-start-head' },
        h('h1', null, 'Hotkey 2'),
        h('p', null, 'Five days in a small crime city. Ten people, one board. Whoever is worth the most at the final bell wins.')),
      saved ? h('div', { class: 'hk-resume' },
        h('div', null, h('b', null, 'A season is waiting.'), ` ${MODE_TEXT[saved.mode][0]}${saved.mode === 'watch' ? '' : ` as the ${saved.seat}`}, ${saved.where}, seed ${saved.seed}.`),
        h('button', { type: 'button', class: 'k-btn is-primary', onclick: onResume }, 'Carry on'),
        h('button', { type: 'button', class: 'k-btn', onclick: onDiscard }, 'Discard')) : null,
      h('h2', { class: 'k-h' }, 'How do you want to sit?'),
      h('div', { class: 'hk-options is-three' }, MODES.map(m => option(MODE_TEXT[m][0], MODE_TEXT[m][1], pick.mode === m, () => { pick.mode = m; draw(); }, { 'data-mode': m }))),
      pick.mode === 'watch' ? null : h('h2', { class: 'k-h' }, pick.mode === 'play' ? 'Your seat' : 'The seat you coach'),
      pick.mode === 'watch' ? null : h('div', { class: 'hk-options is-seats' },
        seats.map(s => option(SEAT_TEXT[s][0], SEAT_TEXT[s][1], pick.seat === s, () => { pick.seat = s; draw(); }, { 'data-seat': s, 'data-cls': s })),
        pick.more ? null : h('button', { type: 'button', class: 'hk-option is-more', onclick: () => { pick.more = true; draw(); } }, h('b', null, 'More seats'), h('span', null, 'Gunrunner, muscle, informant: the quieter jobs.'))),
      h('footer', { class: 'hk-start-foot' },
        h('label', { class: 'hk-seed' }, h('span', null, 'Seed'), seedBox,
          h('button', { type: 'button', class: 'k-btn', onclick: () => { pick.seed = 1 + Math.floor(Math.random() * 9999); draw(); } }, 'New'),
          h('em', null, 'The same seed deals the same city.')),
        h('button', { type: 'button', class: 'k-btn is-primary hk-go', 'data-act': 'start', onclick: go }, pick.mode === 'watch' ? 'Watch a season' : pick.mode === 'play' ? `Play the ${pick.seat}` : `Coach the ${pick.seat}`, kbd('Enter'))));
  }
  function go() {
    onStart({ mode: pick.mode, seat: pick.seat, seed: pick.seed });
  }
  draw();
  return { el: h('div', { class: 'hk-screen' }, plate), enter: go, key: () => false };
}

// ---------------------------------------------------------------------------------------------------------------
// How to play: one screen for the chosen seat. The goal in a sentence, the seat's loop in three steps.

const PICS = {
  home: 'M12 3l9 8h-2.500v9h-5v-6h-3v6h-5v-9H3z',
  corner: 'M2.500 6h19v12h-19zM12 8.500a3.500 3.500 0 1 0 0 7 3.500 3.500 0 0 0 0-7zM5 8v2h2V8zM17 14v2h2v-2z',
  order: 'M4 6h11V3l5 4.500-5 4.500V9H4zM20 15H9v-3l-5 4.500L9 21v-3h11z',
  eye: 'M12 5c5 0 9 4.500 10 7-1 2.500-5 7-10 7S3 14.500 2 12c1-2.500 5-7 10-7zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2.200a1.800 1.800 0 1 1 0 3.600 1.800 1.800 0 0 1 0-3.600z',
  hit: 'M12 1.500l2.400 6.300L21 5.500l-3.800 5.800L22.500 16l-6.900.300L14 23l-3.400-5.800L4 19l3.200-6L1.500 8.300l7 .500z',
  cool: 'M14 2a10 10 0 1 0 8 14.500A8.500 8.500 0 0 1 14 2z',
  docks: 'M11 2h2v8.500l6 2-2.300 6.500H7.300L5 12.500l6-2zM3 20.500h18V23H3z',
  cook: 'M9 2h6v2h-1v5l5.600 9.600A2 2 0 0 1 17.900 21.600H6.100A2 2 0 0 1 4.400 18.600L10 9V4H9zm1.900 9.500L8 16.500h8l-2.900-5z',
};
const pic = id => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<path fill-rule="evenodd" d="${PICS[id] ?? PICS.order}"/>`;
  return svg;
};
const COACH_FACTS = ['Your agent plays every hour by itself. You see what it sees.', 'Each night you pick its skills, its stance and one order.', TURN_FACTS[1], TURN_FACTS[2]];

/**
 * The explainer. `first` is the showing before hour one (its button says Start); afterwards it is behind Help.
 */
export function howScreen(ctx, { first = false, onDone }) {
  const agent = ctx.game.state.agents[ctx.you];
  const coach = ctx.mode === 'coach';
  const plate = h('div', { class: 'hk-plate hk-how' },
    h('header', { class: 'hk-how-head' }, face(ctx, ctx.you, 'is-big'),
      h('div', null, h('span', { class: 'hk-kicker' }, coach ? 'You coach' : 'You are'), h('h1', null, `${agent.name}, the ${agent.cls}`))),
    h('p', { class: 'hk-how-goal' }, h('b', null, 'The goal: '), GOAL.replace(/^Be /, 'be ')),
    h('ol', { class: 'hk-how-loop' }, (LOOPS[agent.cls] ?? []).map(([id, text], i) => h('li', null, pic(id), h('b', null, `Step ${i + 1}`), h('span', null, text)))),
    h('ul', { class: 'hk-how-facts' }, (coach ? COACH_FACTS : TURN_FACTS).map(text => h('li', null, text))),
    h('footer', { class: 'hk-night-foot' }, h('span', { class: 'hk-fine' }, first ? 'This screen is under Help, on the right edge, any time.' : ''),
      h('button', { type: 'button', class: 'k-btn is-primary hk-go', 'data-act': 'start-game', onclick: onDone }, first ? 'Start' : 'Back to the game', kbd('Enter'))));
  return { el: h('div', { class: 'hk-screen' }, plate), enter: onDone, key: () => false, esc: onDone };
}

// ---------------------------------------------------------------------------------------------------------------
// The night

function standingsEl(ctx, rows, { money: showMoney = true } = {}) {
  return h('ol', { class: 'hk-standings' }, rows.map(r => {
    const agent = ctx.game.state.agents[r.id];
    return h('li', { class: r.id === ctx.you ? 'is-you' : '' },
      h('span', { class: 'hk-rank' }, String(r.rank)), face(ctx, r.id), h('b', null, agent.name), clsTag(agent.cls),
      h('span', { class: 'hk-worth' }, r.worth !== undefined && showMoney ? money(r.worth) : r.bracket ?? ''));
  }));
}

/** The sentences for "tonight": the rent, the night job, the day's money, the points. */
function tonightEl(ctx, seen, ledger, pending) {
  const out = [];
  const name = id => nameOf(ctx.game, id);
  const mine = seen.yours;
  if (mine?.evicted) out.push(h('p', { class: 'is-bad' }, h('b', null, `You couldn’t make the ${money(seen.rent)} rent.`), ` A night on the street${mine.evicted.lost ? `, and night robbers took ${money(mine.evicted.lost)} from your stash` : mine.evicted.saved ? ', but your stash stayed hidden' : ''}.`));
  else if (mine?.paid) out.push(h('p', null, h('b', null, `Rent paid: ${money(seen.rent)}.`), ' It comes out of your stash first, then your pocket.'));
  else if (seen.rent !== null) out.push(h('p', null, h('b', null, `Rent tonight was ${money(seen.rent)}.`)));
  for (const e of seen.evicted) if (e.id !== ctx.you) out.push(h('p', null, `${name(e.id)} couldn’t make rent and slept on the street${e.lost ? `, losing ${money(e.lost)}` : ''}.`));
  if (seen.job) {
    const who = seen.job.target === ctx.you ? 'your pad' : `${name(seen.job.target)}’s pad`;
    out.push(seen.job.off
      ? h('p', null, h('b', null, `The Dunn brothers tried ${who} in the night and got nowhere.`), seen.job.guards.length ? ` ${name(seen.job.guards[0])} was at the door.` : '')
      : h('p', { class: 'is-bad' }, h('b', null, `The Dunn brothers broke into ${who} and took ${money(seen.job.lost)}.`), ' They go for the fattest stash every night. A guard at the door stands in their way.'));
  }
  if (ledger) {
    out.push(h('div', { class: 'hk-ledger' },
      h('div', null, h('span', null, 'Noon'), h('b', null, money(ledger.start))),
      h('div', { class: 'is-good' }, h('span', null, 'Earned'), h('b', null, `+${money(ledger.earned)}`)),
      h('div', { class: 'is-bad' }, h('span', null, 'Lost'), h('b', null, `−${money(ledger.lost)}`)),
      h('div', null, h('span', null, 'Midnight'), h('b', null, money(ledger.end)))));
    if (ledger.best) out.push(h('p', null, h('b', null, `Best hour, ${ledger.best.hour}:00 (+${money(ledger.best.delta)}): `), plainHours(ledger.best.text, ctx.game)));
    if (ledger.worst) out.push(h('p', null, h('b', null, `Worst hour, ${ledger.worst.hour}:00 (−${money(-ledger.worst.delta)}): `), plainHours(ledger.worst.text, ctx.game)));
  }
  const pts = seen.points.find(p => p.id === ctx.you);
  if (pts && pending) {
    const from = [...new Set(pts.from.map(f => String(f).replace(/\ba\d+\b/g, id => name(id))))];
    out.push(h('p', null, h('b', null, `${pts.points} skill point${pts.points === 1 ? '' : 's'} earned`), from.length ? ` for ${from.slice(0, 4).join(', ')}` : '', pts.hungry ? '. One of them is the extra point the bottom three get.' : '.'));
  }
  return h('div', { class: 'hk-tonight' }, out);
}

/**
 * The night screen for a seat with an owner: what the night cost, the standings, and the sheet.
 *   pending   { sheet, previews } from the session
 *   night     the feed's night line, or null before the first hour
 *   preview   (skill, picks) → [{ label, before, after }], the odds one more level moves, given the picks so far
 *   usual     skills picked for the player to begin with (they can take them back)
 * Calls onDone(sheet) with `buy`, and for a coach `stance` and `focus`, filled in.
 */
export function nightScreen(ctx, { pending, night, ledger, preview, usual = [], onDone }) {
  const { sheet } = pending;
  const coach = ctx.mode === 'coach';
  const max = ctx.game.cfg.skills.max;
  // `usual`: the picks already made for the player (before the first hour, the seat's own first build)
  const buy = usual.filter(skill => sheet.canBuy.some(c => c.skill === skill)).slice(0, sheet.points);
  let stance = sheet.stance;
  let focus = sheet.focus ?? null;
  const seen = night ? nightFor(night, ctx.you, ctx.mode) : null;
  const plate = h('div', { class: `hk-plate hk-night${night ? '' : ' is-first'}` });
  const left = () => sheet.points - buy.length;
  const picked = skill => buy.filter(s => s === skill).length;

  function spend(skill) {
    const s = sheet.canBuy.find(x => x.skill === skill);
    if (!s || left() < 1 || s.level + picked(skill) >= max) return;
    buy.push(skill);
    draw();
  }

  function cards() {
    return h('div', { class: 'hk-skills' }, sheet.canBuy.map((s, i) => {
      const got = picked(s.skill);
      const level = s.level + got;
      const full = level >= max;
      const rows = full ? [] : preview(s.skill, buy);
      return h('button', { type: 'button', class: `hk-skill${got ? ' is-picked' : ''}`, 'data-skill': s.skill, disabled: left() < 1 || full, onclick: () => spend(s.skill) },
        h('div', { class: 'hk-skill-head' }, kbd(String(i + 1)), h('b', null, s.name)),
        h('div', { class: 'hk-skill-level' }, h('span', { class: 'hk-pips', 'aria-label': `level ${level} of ${max}` }, Array.from({ length: max }, (_, k) => h('i', { class: k < s.level ? 'is-on' : k < level ? 'is-new' : '' }))),
          h('span', null, got ? `level ${s.level} → ${level}` : `level ${level}`)),
        h('p', null, s.does),
        rows.length ? h('ul', { class: 'hk-preview' }, rows.slice(0, 3).map(r => h('li', null, h('span', null, r.label), h('span', { class: 'hk-preview-odds' }, `${r.before}% → `, h('b', { class: r.after > r.before === !/robbing you/.test(r.label) ? 'is-good' : 'is-bad' }, `${r.after}%`)))))
          : h('p', { class: 'hk-preview is-none' }, full ? 'At its top level.' : 'Moves no contest: it does what it says above.'));
    }));
  }

  function levers() {
    const others = ctx.game.state.order.filter(id => id !== ctx.you);
    const blocks = Object.keys(ctx.game.map.blocks);
    const kind = focus?.target ? 'target' : focus?.avoid ? 'avoid' : 'none';
    const select = (options, value, onchange) => h('select', { class: 'hk-input', onchange: e => onchange(e.target.value) }, options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));
    return h('div', { class: 'hk-levers' },
      h('h2', { class: 'k-h' }, `${nameOf(ctx.game, ctx.you)}’s stance`),
      h('div', { class: 'hk-options is-two' },
        option('Bold', 'Takes the richer, riskier play.', stance === 'bold', () => { stance = 'bold'; draw(); }, { 'data-stance': 'bold' }),
        option('Careful', 'Protects what it has.', stance === 'careful', () => { stance = 'careful'; draw(); }, { 'data-stance': 'careful' })),
      h('h2', { class: 'k-h' }, 'One order for tomorrow'),
      h('div', { class: 'hk-options is-three' },
        option('None', null, kind === 'none', () => { focus = null; draw(); }, { 'data-focus': 'none', title: 'It follows its own nose' }),
        option('Go after', null, kind === 'target', () => { focus = { target: focus?.target ?? others[0] }; draw(); }, { 'data-focus': 'target', title: 'Someone to chase' }),
        option('Stay off', null, kind === 'avoid', () => { focus = { avoid: focus?.avoid ?? blocks[0] }; draw(); }, { 'data-focus': 'avoid', title: 'A block to keep away from' })),
      kind === 'target' ? select(others.map(id => [id, `${nameOf(ctx.game, id)}, the ${ctx.game.state.agents[id].cls}`]), focus.target, v => { focus = { target: v }; }) : null,
      kind === 'avoid' ? select(blocks.map(b => [b, ctx.game.map.blocks[b].name]), focus.avoid, v => { focus = { avoid: v }; }) : null);
  }

  function draw() {
    const slots = Array.from({ length: sheet.points }, (_, i) => {
      const skill = buy[i];
      const s = skill && sheet.canBuy.find(x => x.skill === skill);
      return h('button', { type: 'button', class: `hk-slot${s ? ' is-filled' : i === buy.length ? ' is-next' : ''}`, disabled: !s, title: s ? 'take this point back' : null, onclick: () => { buy.splice(i, 1); draw(); } },
        h('span', null, `Point ${i + 1}`), h('b', null, s ? s.name : i === buy.length ? 'pick a skill' : '—'));
    });
    const agent = ctx.game.state.agents[ctx.you];
    fill(plate,
      h('header', { class: 'hk-night-head' },
        h('h1', null, night ? `Night ${night.day}` : 'Before the first hour'),
        h('p', null, night ? `Day ${night.day} is over. ${ctx.game.cfg.season.days - night.day} to go.` : coach
          ? `You coach ${agent.name}, the ${agent.cls}. Give it its first skills, a stance and, if you like, one order.`
          : `You start with ${money(agent.cash)} and ${sheet.points} skill points.${usual.length ? ' The usual first picks are in: change them if you like, or just start.' : ''}`)),
      h('div', { class: 'hk-night-body' },
        night ? h('section', { class: 'hk-night-col' }, h('h2', { class: 'k-h' }, 'Tonight'), tonightEl(ctx, seen, ledger, pending),
          coach && sheet.journal?.length ? h('div', { class: 'hk-journal' }, h('h2', { class: 'k-h' }, `${agent.name}’s journal`), sheet.journal.map(l => h('p', null, l)), sheet.ask ? h('p', { class: 'hk-ask' }, h('b', null, 'It asks: '), sheet.ask) : null) : null) : null,
        night || coach ? h('section', { class: 'hk-night-col is-narrow' },
          night ? [h('h2', { class: 'k-h' }, 'Standings'), standingsEl(ctx, seen.standings), h('p', { class: 'hk-fine' }, 'Everyone sees rank and a rough bracket. Only your own figure is exact.')] : null,
          coach ? levers() : null) : null,
        h('section', { class: 'hk-night-col is-wide' },
          h('h2', { class: 'k-h' }, sheet.points ? `Level up: ${left()} of ${sheet.points} point${sheet.points === 1 ? '' : 's'} left` : 'Level up: no points tonight'),
          sheet.points ? h('div', { class: 'hk-slots' }, slots) : h('p', { class: 'hk-fine' }, 'Points come from risks taken, deals closed and beatings survived. Two XP make a point.'),
          cards())),
      h('footer', { class: 'hk-night-foot' },
        left() > 0 && sheet.points ? h('span', { class: 'hk-fine' }, 'Unspent points wait for tomorrow night.') : null,
        h('button', { type: 'button', class: 'k-btn is-primary hk-go', 'data-act': 'day', onclick: done }, night ? `Start day ${night.day + 1}` : 'Start day 1', kbd('Enter'))));
  }
  function done() {
    onDone({ ...sheet, buy: buy.slice(), ...(coach ? { stance, focus } : {}) });
  }
  draw();
  return {
    el: h('div', { class: 'hk-screen' }, plate),
    enter: done,
    key(e) {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= sheet.canBuy.length) {
        spend(sheet.canBuy[n - 1].skill);
        return true;
      }
      if (e.key === 'Backspace' && buy.length) {
        buy.pop();
        draw();
        return true;
      }
      return false;
    },
  };
}

/** The night for a watcher: a short card between two days. Everything is shown. */
export function nightBrief(ctx, { night, onDone }) {
  const seen = nightFor(night, null, 'watch');
  const plate = h('div', { class: 'hk-plate hk-night is-brief' },
    h('header', { class: 'hk-night-head' }, h('h1', null, `Night ${night.day}`), h('p', null, `Day ${night.day} is over. ${ctx.game.cfg.season.days - night.day} to go.`)),
    h('div', { class: 'hk-night-body' },
      h('section', { class: 'hk-night-col' }, h('h2', { class: 'k-h' }, 'Tonight'), tonightEl(ctx, seen, null, null),
        (night.bought ?? []).length ? h('p', null, h('b', null, 'Bought overnight: '), night.bought.map(b => `${nameOf(ctx.game, b.id)} ${b.skills.map(s => ctx.skillName(s)).join(' + ')}`).join('; '), '.') : null),
      h('section', { class: 'hk-night-col' }, h('h2', { class: 'k-h' }, 'Standings'), standingsEl(ctx, seen.standings))),
    h('footer', { class: 'hk-night-foot' }, h('button', { type: 'button', class: 'k-btn is-primary hk-go', 'data-act': 'day', onclick: onDone }, `Day ${night.day + 1}`, kbd('Enter'))));
  return { el: h('div', { class: 'hk-screen' }, plate), enter: onDone, key: () => false };
}

// ---------------------------------------------------------------------------------------------------------------
// The end, and the reveal-all

export function endScreen(ctx, { final, rank, top, onReveal, onAgain }) {
  const first = final.find(r => r.id === top);
  const mine = rank ? final.find(r => r.id === ctx.you) : null;
  const name = id => nameOf(ctx.game, id);
  const headline = mine
    ? rank === 1 ? `${name(ctx.you)} finished on top` : `${name(ctx.you)} finished ${ordinal(rank)} of ${final.length}`
    : `${name(top)} wins the season`;
  const sub = mine
    ? rank === 1 ? `Worth ${money(mine.worth)} at the final bell. Nobody in the city had more.` : `Worth ${money(mine.worth)} at the final bell. ${name(top)}, the ${ctx.game.state.agents[top].cls}, took the city with ${money(first.worth)}.`
    : `Worth ${money(first.worth)} at the final bell.`;
  const plate = h('div', { class: 'hk-plate hk-end' },
    h('header', { class: 'hk-night-head' }, h('span', { class: 'hk-kicker' }, `The final bell · ${clockOf(ctx.game, ctx.game.state.t - 1)}`), h('h1', null, headline), h('p', null, sub)),
    h('div', { class: 'hk-night-body' },
      h('section', { class: 'hk-night-col' }, h('h2', { class: 'k-h' }, 'Final standings'), standingsEl(ctx, final)),
      h('section', { class: 'hk-night-col is-narrow hk-end-side' },
        h('h2', { class: 'k-h' }, 'Now see what you couldn’t'),
        h('p', null, ctx.mode === 'watch' ? 'The whole season on one page: every day, every big moment, every seat’s money.' : 'While you played you saw only what your character saw. The whole season is on one page: every message, every confessional, every roll.'),
        h('button', { type: 'button', class: 'k-btn is-primary hk-go', 'data-act': 'reveal', onclick: onReveal }, 'See everything', kbd('Enter')),
        h('button', { type: 'button', class: 'k-btn', 'data-act': 'again', onclick: onAgain }, 'Another season'))));
  return { el: h('div', { class: 'hk-screen' }, plate), enter: onReveal, key: () => false };
}

/** The reveal-all: the episode page for the finished season, in a frame of its own. */
export function revealScreen(ctx, { html, onClose }) {
  const frame = h('iframe', { class: 'hk-reveal-frame', title: 'The whole season', sandbox: 'allow-scripts' });
  frame.srcdoc = html;
  const el = h('div', { class: 'hk-screen is-reveal' },
    h('div', { class: 'hk-reveal-bar' }, h('b', null, 'The whole season'), h('span', null, 'Nothing is hidden here.'), h('button', { type: 'button', class: 'k-btn', 'data-act': 'close', onclick: onClose }, 'Back', kbd('Esc'))),
    frame);
  return { el, enter: () => {}, key: () => false, esc: onClose };
}
