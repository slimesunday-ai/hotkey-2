// The episode page (SPEC section 16): the one thing a person reads to watch a season.
// episodeHtml(game) returns one self-contained HTML file: no fonts, scripts, images or styles from anywhere else.
// It reads on a phone, in light and dark, and it also works for a season that is only part-way through, because
// the runner rewrites the page after every night when an owner is levelling up.
//
// Two rules shape everything here.
//  - The engine stays underneath (D67). A viewer sees people, places and words. Ids, chances and dice only appear
//    inside <x-engine> elements, which stay hidden until the viewer turns on "Show the engine".
//  - Everything an agent, an owner or a model wrote goes through esc() before it reaches the page, and is wrapped in
//    <span class="w"> so it is set apart from the page's own words.

import { describe, skillFlag, forecastWords, nameOf, money, blockName, clockOf, listOf, possessive, skillLevelAt } from './words.mjs';
import { SKILL_TEXT } from './skills.mjs';
import { rankAgents } from './night.mjs';
import { RIVAL_CREW_NAME, NPC_ROBBERS_NAME } from './cast.mjs';

// ---------------------------------------------------------------------------------------------------------------
// Small pieces

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Make any text safe to put inside HTML. */
export const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);

/** Text that an agent, an owner or a model wrote: escaped, and marked so the page sets it in its own type. */
const written = text => `<span class="w">${esc(text)}</span>`;

/** Something only the "Show the engine" switch reveals. */
const engine = html => (html ? `<x-engine>${html}</x-engine>` : '');

const isNum = x => typeof x === 'number' && Number.isFinite(x);
const cap = text => (text ? text[0].toUpperCase() + text.slice(1) : '');
const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const numberWord = n => NUMBER_WORDS[n] ?? String(n);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Ten hues that stay apart from each other, in an order that keeps neighbouring seats far apart. */
const HUES = [235, 55, 300, 130, 15, 195, 90, 335, 165, 270];
const hueOf = seat => (seat < HUES.length ? HUES[seat] : Math.round((HUES[0] + seat * 137.5) % 360));

/** Which role in an event is the agent whose own move it was. Used to find each agent's turn in an hour. */
const OWN_MOVE = [
  [/^move$/, 'mover'], [/^work:run/, 'smuggler'], [/^work:cook/, 'cook'], [/^(work:deal|work:claim|turf:)/, 'dealer'],
  [/^(work:build|work:gunsale)/, 'gunrunner'], [/^work:case/, 'robber'], [/^(work:guard|work:patrol)/, 'muscle'], [/^work:watch/, 'informant'],
  [/^(work:tipoff|offer:police|work:none|stash$|rest$|idle$|held:|offer:fence|offer:gunshop|crew:skim|crew:leave|quit$)/, 'agent'],
  [/^(offer:made|offer:board)/, 'from'], [/^job:posted/, 'poster'], [/^bail$/, 'payer'], [/^crew:(start|invite|cut|pay)/, 'boss'],
  [/^crew:coup/, 'challenger'], [/^(rob:|breakin:|door:)/, 'robber'], [/^fight:/, 'attacker'], [/^collect:/, 'collector'],
];
const ownRole = kind => OWN_MOVE.find(([test]) => test.test(kind))?.[1] ?? null;

/** Fields of an event's data that name an agent, besides the roles in `who`. */
const DATA_PEOPLE = ['leader', 'was', 'for', 'lender', 'saved', 'source', 'user', 'by', 'subject', 'short', 'to', 'bailedBy'];

// ---------------------------------------------------------------------------------------------------------------
// The page

/**
 * Build the episode page for a game: `{ cfg, map, state, feed }`, finished or not.
 * options: { title, seatModels: { agentId: 'model name' }, spend }, plus what the runner adds:
 *          { run, ai: { transport, spend: { cost } }, cut: { why } }
 */
export function episodeHtml(game, options = {}) {
  const { cfg, state } = game;
  const feed = Array.isArray(game.feed) ? game.feed : [];
  const perDay = cfg?.season?.hoursPerDay ?? 12;
  const totalDays = cfg?.season?.days ?? 5;
  const seated = (state.order ?? Object.keys(state.agents)).map(id => state.agents[id]);
  const isAgent = id => typeof id === 'string' && Object.hasOwn(state.agents, id);
  // A small lobby: a few owners' agents (the players) among scripted locals. With no players, every seat is shown
  // the same way, as it always was.
  const players = new Set((Array.isArray(state.players) ? state.players : seated.filter(a => a.player).map(a => a.id)).filter(isAgent));
  const lobby = players.size > 0;
  const isPlayer = id => players.has(id);
  const agents = lobby ? [...seated.filter(a => isPlayer(a.id)), ...seated.filter(a => !isPlayer(a.id))] : seated; // players first
  const playerTag = id => (lobby && isPlayer(id) ? ' <span class="tag">player</span>' : '');
  const token = id => `s${state.agents[id].seat}`;
  const name = id => nameOf(game, id);
  const chip = id => (isAgent(id) ? `<b class="n ${token(id)}">${esc(name(id))}</b>` : esc(name(id)));
  /** The same chip with "'s" inside it, so a possessive doesn't hang off the edge of the chip. */
  const chipOwn = id => (isAgent(id) ? `<b class="n ${token(id)}">${esc(possessive(name(id)))}</b>` : esc(possessive(name(id))));

  // A sentence from words.mjs, escaped, with every agent's name turned into its colour chip.
  const seatByName = new Map(agents.map(a => [esc(a.name), a.seat]));
  const nameFinder = seatByName.size
    ? new RegExp(`(?<![\\w&#])(${[...seatByName.keys()].sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(&#39;s?)?(?![\\w;])`, 'g')
    : null;
  const told = text => (nameFinder ? esc(text).replace(nameFinder, (found, who) => `<b class="n s${seatByName.get(who)}">${found}</b>`) : esc(text));

  /** The agents an event is about, for the per-agent filter. Bystanders don't count. */
  const peopleIn = event => {
    const ids = new Set();
    for (const id of Object.values(event.who ?? {})) if (isAgent(id)) ids.add(id);
    for (const key of DATA_PEOPLE) if (isAgent(event.data?.[key])) ids.add(event.data[key]);
    for (const list of [event.data?.evicted, event.data?.guards]) for (const id of Array.isArray(list) ? list : []) if (isAgent(id)) ids.add(id);
    if (isAgent(event.data?.task?.agent)) ids.add(event.data.task.agent); // a job names who it is aimed at
    return [...ids];
  };
  /** In a small lobby: is a player part of this beat, or standing on the block when it happened? */
  const hasPlayer = event => peopleIn(event).some(isPlayer) || Object.values(event.lists ?? {}).some(list => Array.isArray(list) && list.some(isPlayer));
  const whoAttr = ids => (ids.length ? ` data-who="${ids.map(token).join(' ')}"` : '');

  // ---- the feed, sorted into days
  const days = new Map();
  const dayOf = n => {
    if (!days.has(n)) days.set(n, { n, forecast: null, hours: [], night: null, final: null });
    return days.get(n);
  };
  const levelUps = new Map(); // night number (0 is before the first hour) → what owners bought and said
  const standIns = []; // a bot took over a seat whose model stopped answering, or handed it back
  for (const line of feed) {
    if (!line || typeof line !== 'object') continue;
    if (line.type === 'forecast') dayOf(line.day).forecast = line;
    else if (line.type === 'hour') dayOf(line.day).hours.push(line);
    else if (line.type === 'night') dayOf(line.day).night = line;
    else if (line.type === 'final') dayOf(line.day).final = line;
    else if (line.type === 'levelup') levelUps.set(line.day, [...(levelUps.get(line.day) ?? []), ...(line.bought ?? [])]);
    else if (line.type === 'takeover' && isAgent(line.agent)) standIns.push(line);
    // any other kind of entry is one this page doesn't know yet: leave it out rather than fail
  }
  const dayList = [...days.values()].sort((a, b) => a.n - b.n);
  const hourLines = dayList.flatMap(d => d.hours);
  // each stand-in notice goes with the hour it names, or the next hour played after it, or the last hour there is
  const standInsAt = new Map();
  for (const entry of standIns) {
    const hour = hourLines.find(line => line.t >= entry.t) ?? hourLines[hourLines.length - 1];
    if (hour) standInsAt.set(hour, [...(standInsAt.get(hour) ?? []), entry]);
  }
  const over =state.phase === 'over' || Array.isArray(state.final);
  const when = line => `Day ${line.day} · ${line.hour}:00`;

  // ---- skills at work: tie every roll a skill decided to the event it belongs to
  const sameFlag = (a, b) => a.agent === b.agent && a.skill === b.skill && a.without === b.without && a.side === b.side;
  const NOTE_HOME = [
    [/getaway/, e => e.kind.endsWith(':getaway'), 'robber'], [/^scared /, e => e.kind === 'npc:robbers:scared', 'muscle'],
    [/docks bust/, e => e.kind === 'work:run', 'smuggler'], [/blowing up/, e => e.kind === 'work:cook', 'cook'],
    [/sting/, e => e.kind === 'work:gunsale', 'gunrunner'], [/evicted/, e => e.kind === 'night:evicted', 'agent'],
  ];
  function flagsOf(line) {
    const byEvent = new Map();
    const loose = [];
    const events = line.events ?? [];
    const put = (event, flag) => byEvent.set(event, [...(byEvent.get(event) ?? []), flag]);
    for (const event of events) for (const flag of event.data?.roll?.decidedBy ?? []) put(event, flag);
    for (const flag of line.decided ?? []) {
      if (events.some(e => (e.data?.roll?.decidedBy ?? []).some(f => sameFlag(f, flag)))) continue;
      const home = NOTE_HOME.find(([test]) => test.test(flag.what ?? ''));
      const event = home ? events.find(e => home[1](e) && e.who?.[home[2]] === flag.agent) : null;
      if (event) put(event, flag);
      else loose.push(flag);
    }
    return { byEvent, loose };
  }
  const flagHtml = (flag, event) => `<p class="flag"><b>Skill at work</b> ${told(skillFlag(flag, event, game))}</p>`;

  // ---- what agents said, messaged and confessed
  function voicesOf(line, id) {
    const a = line.agents?.[id];
    if (!a) return [];
    const out = [];
    if (a.say?.text) out.push({ id, type: 'say', to: isAgent(a.say.to) ? a.say.to : null, text: a.say.text });
    if (a.message?.text) out.push({ id, type: 'msg', to: isAgent(a.message.to) ? a.message.to : null, text: a.message.text });
    if (a.confessional) out.push({ id, type: 'conf', to: null, text: a.confessional });
    return out;
  }
  const voiceLabel = v => (v.type === 'conf' ? 'to the camera' : v.type === 'msg' ? `in a private message to ${v.to ? esc(name(v.to)) : 'someone'}` : v.to ? `out loud, to ${esc(name(v.to))}` : 'out loud');
  const voiceHtml = (v, time = '') => (time
    ? `<p class="v ${v.type}"${whoAttr([...new Set([v.id, v.to].filter(Boolean))])}>${time}<span>${chip(v.id)} <i>${voiceLabel(v)}</i> ${written(v.text)}</span></p>`
    : `<p class="v ${v.type}">${chip(v.id)} <i>${voiceLabel(v)}</i> ${written(v.text)}</p>`);

  // ---- the engine's own record of a beat, for the switch
  const rollText = roll => `chance ${roll.P}% · rolled ${roll.roll} · band ${esc(roll.outcome)}${roll.why?.length ? ` · reasons: ${roll.why.map(esc).join(', ')}` : ' · no modifiers'}`
    + (roll.decidedBy?.length ? ` · decided by ${roll.decidedBy.map(d => `${esc(d.agent)} ${esc(d.skill)} (${d.side === 'a' ? '+' : '−'}${d.value}, ${esc(d.without)} without it)`).join(', ')}` : '');
  function beatEngine(event) {
    const { roll, ...rest } = event.data ?? {};
    const who = Object.entries(event.who ?? {}).filter(([, id]) => id).map(([role, id]) => `${esc(role)} ${esc(id)}`).join(' · ');
    const parts = [`${esc(event.kind)} · t ${event.t}${event.block ? ` · ${esc(event.block)}` : ''}${event.spot ? ` · ${esc(event.spot)}` : ''}`];
    if (who) parts.push(who);
    if (roll) parts.push(rollText(roll));
    if (Object.keys(rest).length) parts.push(esc(JSON.stringify(rest)));
    return engine(parts.join('<br>'));
  }

  // ---- one hour
  function failedTurn(id, move) {
    const who = name(id);
    const target = move?.target ? name(move.target) : 'someone';
    switch (move?.verb) {
      case 'attack': {
        const plan = { rob: `rob ${target}`, fight: `fight ${target}`, collect: `collect a debt from ${target}`, 'break-in': `break into ${possessive(target)} pad` }[move.how] ?? `go after ${target}`;
        return `${who} set out to ${plan}, but it could not be done.`;
      }
      case 'move': return `${who} tried to walk somewhere that is not next door.`;
      case 'offer': return `${who} tried to make an offer that could not stand.`;
      case 'work': return `${who} found no work to do here.`;
      case 'stash': return `${who} went to the stash and came away with nothing changed.`;
      case 'crew': return `${who} tried a crew move that could not be made.`;
      case 'quit': return `${who} tried to walk out on a job it does not hold.`;
      default: return `${who} stood around.`;
    }
  }

  function turnRow(line, id, own) {
    const a = line.agents[id];
    let text;
    if (own && own.kind !== 'idle') text = describe(own, game);
    else if (own?.data?.why || a.ok === false) text = failedTurn(id, a.move);
    else if (own) text = describe(own, game);
    else text = typeof a.text === 'string' && a.text ? `${name(id)} ${a.text}.` : `${name(id)} stood around.`;
    const gone = (a.accepts ?? []).filter(t => typeof t === 'string' && t.startsWith("couldn't")).length;
    if (gone) text += ` It also said yes to ${gone === 1 ? 'an offer' : `${gone} offers`} that could no longer be taken.`;
    const purse = [`${money(a.cash) ?? '$0'} carried`, a.stash ? `${money(a.stash)} stashed` : null, a.heat ? `heat ${a.heat}` : null].filter(Boolean).join(' · ');
    const raw = engine(`${esc(id)} · ${esc(JSON.stringify(a.move ?? null))} · ${a.ok === false ? 'failed' : 'ok'}: ${esc(a.text ?? '')}${a.accepts?.length ? ` · accepts: ${a.accepts.map(esc).join('; ')}` : ''} · at ${esc(a.block)} · worth ${a.worth}`);
    return `<li${whoAttr([id])}><span class="did">${told(text)}</span><span class="purse">${purse}</span>${raw}</li>`;
  }

  function hourHtml(line) {
    const events = line.events ?? [];
    const { byEvent, loose } = flagsOf(line);
    const beats = events.filter(e => e.big || byEvent.has(e));
    const notices = standInsAt.get(line) ?? [];
    const quiet = beats.length === 0 && loose.length === 0 && notices.length === 0;

    // In a small lobby, beats with no player in them fold into one line for the hour, after the players' beats.
    const away = new Set(lobby ? beats.filter(event => !hasPlayer(event)) : []);
    const awayLoose = lobby ? loose.filter(flag => !isPlayer(flag.agent)) : [];

    // each agent speaks once an hour, next to the first beat it is part of
    const spoke = new Set();
    const beatOf = event => {
      const people = peopleIn(event);
      const voices = [];
      for (const id of people) {
        if (spoke.has(id)) continue;
        spoke.add(id);
        voices.push(...voicesOf(line, id));
      }
      const flags = (byEvent.get(event) ?? []).map(flag => flagHtml(flag, event)).join('');
      const kind = event.kind === 'lead' ? ' lead' : event.big ? '' : ' minor';
      return `<article class="beat${kind}"${whoAttr(people)}><div class="tell"><p class="what">${told(describe(event, game))}</p>${flags}${beatEngine(event)}</div>`
        + (voices.length ? `<div class="voices">${voices.map(v => voiceHtml(v)).join('')}</div>` : '') + '</article>';
    };
    const looseOf = flag => `<article class="beat minor"${whoAttr(isAgent(flag.agent) ? [flag.agent] : [])}><div class="tell">${flagHtml(flag, null)}</div></article>`;
    const beatHtml = beats.filter(event => !away.has(event)).map(beatOf);
    for (const flag of loose) if (!awayLoose.includes(flag)) beatHtml.push(looseOf(flag));
    for (const entry of notices) {
      const words = entry.on ? `A stand-in is playing ${chip(entry.agent)} until its model answers again.` : `${chipOwn(entry.agent)} model is answering again and has its seat back.`;
      beatHtml.push(`<article class="beat minor"${whoAttr([entry.agent])}><div class="tell"><p class="what">${words}</p>${engine(`takeover · t ${esc(entry.t)} · ${esc(entry.agent)} · ${entry.on ? 'on' : 'off'}`)}</div></article>`);
    }
    const things = away.size + awayLoose.length;
    if (things) {
      // the fold follows the filter: it shows for a local who is in it, and steps aside when a player is followed
      const locals = [...new Set([...away].flatMap(peopleIn).concat(awayLoose.map(f => f.agent).filter(isAgent)))];
      const everyoneNamed = [...away].every(event => peopleIn(event).length > 0);
      beatHtml.push(`<details class="elsewhere"${everyoneNamed ? whoAttr(locals) : ''}><summary>Elsewhere in the city: ${things === 1 ? '1 thing' : `${things} things`} happened</summary>${[...away].map(beatOf).join('')}${awayLoose.map(looseOf).join('')}</details>`);
    }

    // every turn: each agent's own move, then whatever else happened that wasn't anyone's move and isn't a beat
    const ownEvents = new Map();
    for (const event of events) {
      const role = ownRole(event.kind);
      const id = role ? event.who?.[role] : null;
      if (id && !ownEvents.has(id)) ownEvents.set(id, event);
    }
    const rows = Object.keys(line.agents ?? {}).filter(isAgent).map(id => turnRow(line, id, ownEvents.get(id)));
    const own = new Set(ownEvents.values());
    const also = events.filter(e => !e.big && !byEvent.has(e) && !own.has(e) && !/^(say|message|idle|held:)/.test(e.kind))
      .map(e => `<li class="also"${whoAttr(peopleIn(e))}><span class="did"><i>Also</i> ${told(describe(e, game))}</span></li>`);
    const turns = `<div class="turns"><h4>Every turn</h4><ul>${rows.join('')}${also.join('')}</ul></div>`;

    const tally = Object.entries(line.tally ?? {}).filter(([, n]) => n).map(([k, n]) => `${esc(k)} ${n}`).join(', ');
    const rolls = (line.rolls ?? []).map(r => `${esc(r.kind)}: ${esc(r.attacker)} against ${esc(r.defender)} · ${rollText(r)}`);
    const under = engine([`hour t ${line.t} · police on ${(line.police ?? []).map(esc).join(', ') || 'no block'}${tally ? ` · tally: ${tally}` : ''}`, ...rolls].join('<br>'));

    const involved = [...new Set(beats.flatMap(peopleIn).concat(loose.map(f => f.agent).filter(isAgent), notices.map(n => n.agent)))];
    const html = `<li class="hour${quiet ? ' quiet' : ''}"${quiet || !involved.length ? '' : ` data-hw="${involved.map(token).join(' ')}"`}><div class="clock">${line.hour}:00</div><div class="body">${beatHtml.join('')}${turns}${under}</div></li>`;
    return { quiet, html };
  }

  function hoursHtml(day) {
    const out = [];
    let run = [];
    const flush = () => {
      if (!run.length) return;
      const span = run.length === 1 ? `${run[0].line.hour}:00` : `${run[0].line.hour}:00 to ${run[run.length - 1].line.hour}:00`;
      out.push(`<li class="fold"><div class="clock">${span}</div><div class="body">${run.length === 1 ? 'A quiet hour of work.' : `${cap(numberWord(run.length))} quiet hours of work.`}</div></li>`);
      for (const r of run) out.push(r.html);
      run = [];
    };
    for (const line of day.hours) {
      const hour = hourHtml(line);
      if (hour.quiet) run.push({ line, html: hour.html });
      else {
        flush();
        out.push(hour.html);
      }
    }
    flush();
    return out.length ? `<ol class="hours">${out.join('')}</ol>` : '';
  }

  // ---- nights
  const skillName = skill => SKILL_TEXT[skill]?.[0] ?? skill;
  const journalOf = (id, day, line) => state.agents[id].journals?.find(j => j.day === day) ?? (line?.journals?.[id]?.day === day ? line.journals[id] : null);

  function raceHtml(rows, before) {
    const top = Math.max(1, ...rows.map(r => r.worth));
    const was = new Map((before ?? []).map(r => [r.id, r.rank]));
    return `<ol class="race${lobby ? ' lobby' : ''}">${rows.filter(r => isAgent(r.id)).map(r => {
      const step = was.has(r.id) ? was.get(r.id) - r.rank : 0;
      const moved = !was.has(r.id) ? '' : step > 0 ? `<span class="up">up ${step}</span>` : step < 0 ? `<span class="down">down ${-step}</span>` : '<span class="same">no change</span>';
      return `<li><span class="rank">${r.rank}</span><span class="who"><span class="nm">${chip(r.id)}${playerTag(r.id)}</span><span class="lane"><span class="meter ${token(r.id)}" style="width:${Math.max(0, Math.round((r.worth / top) * 100))}%"></span></span></span><span class="worth">${money(r.worth)}</span><span class="moved">${moved}</span></li>`;
    }).join('')}</ol>`;
  }

  function journalsHtml(day, line) {
    const cards = agents.map(agent => {
      // in a small lobby the journals are the players': a local's is a script talking to nobody
      const j = lobby && !isPlayer(agent.id) ? null : journalOf(agent.id, day, line);
      if (!j) return '';
      const lines = (Array.isArray(j.lines) ? j.lines : []).filter(l => typeof l === 'string' && l).map(l => `<li>${written(l)}</li>`).join('');
      const ask = typeof j.ask === 'string' && j.ask ? `<p class="ask"><i>Asks its owner</i> ${written(j.ask)}</p>` : '';
      if (!lines && !ask) return '';
      return `<article class="journal"${whoAttr([agent.id])}><h5>${chip(agent.id)} <span>the ${esc(agent.cls)}</span></h5>${lines ? `<ul>${lines}</ul>` : ''}${ask}</article>`;
    }).filter(Boolean);
    return cards.length ? `<h4>Journals</h4><div class="journals">${cards.join('')}</div>` : '';
  }

  /** What every seat bought on a night, and what its owner said. `after` is the first hour of the next day. */
  function boughtHtml(night, rows, points, after) {
    const pointsOf = new Map((points ?? []).map(p => [p.id, p]));
    const items = [];
    const notes = [];
    const seen = new Set();
    for (const row of rows) {
      if (!isAgent(row.id)) continue;
      seen.add(row.id);
      const counts = new Map();
      for (const skill of row.skills ?? []) counts.set(skill, (counts.get(skill) ?? 0) + 1);
      const skills = [...counts.keys()].map(skill => `${esc(skillName(skill))} ${skillLevelAt(game, row.id, skill, after) || ''}`.trim());
      const p = pointsOf.get(row.id);
      const earned = p ? ` earned ${plural(p.points, 'point')}${p.hungry ? ' (one for being in the bottom three)' : ''} and` : '';
      if (skills.length) items.push(`<li${whoAttr([row.id])}>${chip(row.id)}${earned} bought ${listOf(skills)}.</li>`);
      else if (p?.points) items.push(`<li${whoAttr([row.id])}>${chip(row.id)} earned ${plural(p.points, 'point')} and kept ${p.points === 1 ? 'it' : 'them'}.</li>`);
      if (typeof row.note === 'string' && row.note) notes.push(`<li${whoAttr([row.id])}>${chipOwn(row.id)} owner: ${written(row.note)}</li>`);
    }
    for (const p of points ?? []) {
      if (seen.has(p.id) || !isAgent(p.id) || !p.points) continue;
      items.push(`<li${whoAttr([p.id])}>${chip(p.id)} earned ${plural(p.points, 'point')}${p.hungry ? ' (one for being in the bottom three)' : ''}. Its owner has not spent ${p.points === 1 ? 'it' : 'them'} yet.</li>`);
    }
    const raw = points?.length ? engine(points.map(p => `${esc(p.id)}: ${p.points} from ${(p.from ?? []).map(esc).join(', ') || 'nothing'}`).join('<br>')) : '';
    return (items.length ? `<h4>${night === 0 ? 'Starting skills' : 'Skills bought'}</h4><ul class="plain">${items.join('')}</ul>${raw}` : '')
      + (notes.length ? `<h4>Notes from the owners</h4><ul class="plain">${notes.join('')}</ul>` : '');
  }

  function nightHtml(day, before) {
    const line = day.night;
    const out = [`<section class="night" id="night-${day.n}"><h3>Night ${day.n}</h3>`];
    // rent first, then what the night did to anyone who couldn't pay it: the night's own big beats
    const rent = line.rent?.[0]?.paid ?? line.evicted?.[0]?.rent;
    const beats = (line.events ?? []).filter(e => e.big);
    const paid = (line.rent ?? []).length;
    out.push(`<p>${isNum(rent) ? `Rent was ${money(rent)}.` : 'Rent fell due.'} ${beats.some(e => e.kind === 'night:evicted') ? `${cap(numberWord(paid))} of ${numberWord(paid + (line.evicted ?? []).length)} paid and slept at home.` : 'Everyone paid and slept at home.'}</p>`);
    // each beat, with the skills that decided it straight after it
    const { byEvent, loose } = flagsOf(line);
    for (const event of beats) {
      const flags = (byEvent.get(event) ?? []).map(flag => flagHtml(flag, event)).join('');
      out.push(`<div${whoAttr(peopleIn(event))}><p>${told(describe(event, game))}</p>${flags}${beatEngine(event)}</div>`);
    }
    // The night job: the NPC robbers try the biggest stash. The engine records it as a beat of its own; a feed
    // written before it did only has `job` on the night entry, so say it here when there is no beat.
    const job = line.job && isAgent(line.job.target) ? line.job : null;
    const jobBeat = job ? beats.find(e => /^night:(job|robbed)/.test(e.kind) && e.data?.roll && e.who?.agent === job.target) : null;
    const jobEvent = jobBeat ?? (job ? { kind: 'night:job', t: line.t - 1, who: { agent: job.target }, data: { roll: { outcome: job.outcome } } } : null);
    if (job && !jobBeat) {
      const guards = (job.guards ?? []).filter(isAgent);
      out.push(`<p${whoAttr([job.target, ...guards])}>${esc(cap(NPC_ROBBERS_NAME))} tried ${chipOwn(job.target)} pad in the night${guards.length ? `, and ${listOf(guards.map(chip))}, on guard, saw them off` : ' and could not get in'}.</p>`);
    }
    for (const flag of loose) {
      const event = /night robbers/.test(flag.what ?? '') ? jobEvent : null;
      out.push(`<div${whoAttr(isAgent(flag.agent) ? [flag.agent] : [])}>${flagHtml(flag, event)}</div>`);
    }
    for (const s of line.snitch ?? []) {
      if (isAgent(s.by)) out.push(`<p${whoAttr([s.by])}>${told(describe({ kind: 'snitch:sold', data: s }, game))}</p>`);
    }
    if (line.standings?.length) out.push('<h4>The race</h4>', raceHtml(line.standings, before));
    out.push(boughtHtml(day.n, [...(line.bought ?? []), ...(levelUps.get(day.n) ?? [])], line.points, day.n * perDay));
    out.push(journalsHtml(day.n, line));
    const rolls = (line.rolls ?? []).map(r => `${esc(r.kind)}: ${esc(r.attacker)} against ${esc(r.defender)} · ${rollText(r)}`);
    out.push(engine([`night after day ${day.n} · t ${line.t}`, esc(JSON.stringify({ rent: line.rent, evicted: line.evicted, snitch: line.snitch, job: line.job ?? null })), ...rolls].join('<br>')));
    out.push('</section>');
    return out.join('');
  }

  function finalHtml(day, before) {
    const rows = (day.final.final ?? state.final ?? []).filter(r => isAgent(r.id));
    const winner = lobby ? rows.find(r => r.id === winnerRow?.id) ?? rows[0] : rows[0];
    const among = lobby ? `, the richest of the ${numberWord(players.size)} players${richerWords ? `. ${richerWords}` : '.'}` : '.';
    return `<section class="night" id="night-${day.n}"><h3>The final bell</h3>`
      + `<p>${winner ? `The season is over. ${chip(winner.id)} won with ${money(winner.worth)}${among} Goods count for nothing now: only cash carried and cash stashed.` : 'The season is over.'}</p>`
      + (rows.length ? `<h4>The race</h4>${raceHtml(rows, before)}` : '')
      + journalsHtml(day.n, day.final) + '</section>';
  }

  // ---- the top: standings and the leader's story
  const standing = (Array.isArray(state.final) ? state.final : rankAgents(state)).filter(r => isAgent(r.id));
  const buildOf = agent => Object.entries(agent.skills ?? {}).filter(([, level]) => level > 0).sort((a, b) => b[1] - a[1]).map(([skill, level]) => `${esc(skillName(skill))} ${level}`).join(', ');
  // Who the story at the top is about: in a small lobby the richest player, otherwise whoever is on top.
  const winnerRow = lobby
    ? (over ? standing.find(r => r.id === state.winner && isPlayer(r.id)) : null) ?? standing.find(r => isPlayer(r.id)) ?? standing[0]
    : standing[0];
  const richer = lobby && winnerRow ? standing.filter(r => !isPlayer(r.id) && r.rank < winnerRow.rank).length : 0;
  const richerWords = !richer ? '' : over
    ? `${cap(numberWord(richer))} ${richer === 1 ? 'local' : 'locals'} ended richer: the house had the better week.`
    : `${cap(numberWord(richer))} ${richer === 1 ? 'local is' : 'locals are'} richer so far.`;
  const playedBy = agent => {
    if (lobby && !isPlayer(agent.id)) return 'local';
    // the brief's shape is { agentId: 'model name' }; the runner passes a list, and the seat's own record has the model
    const named = options.seatModels && !Array.isArray(options.seatModels) ? options.seatModels[agent.id] : null;
    const model = (typeof named === 'string' ? named : named?.model) ?? agent.model;
    if (model) return esc(model);
    if (agent.kind === 'ai') return 'an AI model';
    return agent.variant ? `bot (${esc(agent.variant)})` : 'bot';
  };
  /** The line under a seat's name: an owner's description of its agent, or a local's one-line agenda. */
  const aboutOf = agent => agent.persona || (lobby && !isPlayer(agent.id) ? agent.agenda : '') || '';
  const standingsHtml = `<ol class="table">${standing.map(r => {
    const agent = state.agents[r.id];
    return `<li${lobby ? ` class="${isPlayer(r.id) ? 'player' : 'local'}"` : ''}><span class="rank">${r.rank}</span><span class="who">${chip(r.id)}${playerTag(r.id)}<span class="meta">the ${esc(agent.cls)} · ${playedBy(agent)}</span></span>`
      + `<span class="build">${buildOf(agent) || 'no skills yet'}</span><span class="worth">${money(r.worth)}</span>${aboutOf(agent) ? `<span class="persona">${written(aboutOf(agent))}</span>` : ''}${engine(esc(r.id))}</li>`;
  }).join('')}</ol>`;

  const playedHours = hourLines.length;
  const lastHour = hourLines[hourLines.length - 1] ?? null;
  const dayNow = Math.min(totalDays, Math.floor((state.t ?? 0) / perDay) + 1);
  let status;
  if (over) status = `Final result · ${plural(totalDays, 'day')}, ${plural(playedHours, 'hour')}`;
  else if (!lastHour) status = `Day 1 of ${totalDays} · not started yet`;
  else if (state.t % perDay === 0) status = `Day ${dayNow} of ${totalDays} · ${numberWord(dayNow - 1)} ${dayNow - 1 === 1 ? 'day' : 'days'} played, day ${dayNow} starts next`;
  else status = `Day ${dayNow} of ${totalDays} · played up to ${lastHour.hour}:00`;

  // ---- the days
  const dayHtml = [];
  let before = null;
  for (const day of dayList) {
    const out = [`<section class="day" id="day-${day.n}"><h2>Day ${day.n}${day.n >= (cfg?.season?.lastCallDay ?? Infinity) ? ' <small>last call</small>' : ''}</h2>`];
    if (day.n === 1 && levelUps.has(0)) out.push(`<div class="pre">${boughtHtml(0, levelUps.get(0), null, 0)}</div>`);
    if (day.forecast) out.push(`<p class="forecast"><b>Forecast</b> ${esc(forecastWords(day.forecast.forecast ?? day.forecast, game))}${day.n >= (cfg?.season?.lastCallDay ?? Infinity) ? ' It is the last day: street prices are up and trouble hits harder.' : ''}</p>`);
    // what was posted at noon with the forecast: the rival crew's bounty on whoever leads
    for (const event of (day.forecast?.events ?? []).filter(e => e.big)) out.push(`<p class="forecast noon"${whoAttr(peopleIn(event))}><b>At noon</b> ${told(describe(event, game))}</p>${beatEngine(event)}`);
    out.push(hoursHtml(day));
    if (day.night) {
      out.push(nightHtml(day, before));
      before = day.night.standings ?? before;
    } else if (day.final) out.push(finalHtml(day, before));
    else if (!day.hours.length) out.push(`<p class="more">Day ${day.n} has not been played yet.</p>`);
    else out.push(`<p class="more">The season is still being played. This page is rewritten as it goes.</p>`);
    out.push('</section>');
    dayHtml.push(out.join(''));
  }
  if (!dayList.length) dayHtml.push('<p class="more">The season has not started yet.</p>');

  // ---- per agent: its commentary track
  // (locals in a small lobby never talk to the camera, so they have no track)
  const tracks = agents.filter(agent => !lobby || isPlayer(agent.id)).map(agent => {
    const items = [];
    let confessionals = 0;
    let journals = 0;
    for (const day of dayList) {
      for (const line of day.hours) {
        const text = line.agents?.[agent.id]?.confessional;
        if (!text) continue;
        confessionals += 1;
        items.push(`<li><time>${when(line)}</time>${written(text)}</li>`);
      }
      const j = journalOf(agent.id, day.n, day.night ?? day.final);
      if (!j || (!day.night && !day.final)) continue;
      const lines = (Array.isArray(j.lines) ? j.lines : []).filter(l => typeof l === 'string' && l).map(l => `<p>${written(l)}</p>`).join('');
      if (!lines && !j.ask) continue;
      journals += 1;
      items.push(`<li class="j"><time>Night ${day.n} · journal</time><div>${lines}${typeof j.ask === 'string' && j.ask ? `<p><i>Asks its owner</i> ${written(j.ask)}</p>` : ''}</div></li>`);
    }
    return `<details class="track" id="track-${agent.seat}"${whoAttr([agent.id])}><summary>${chip(agent.id)} <span>the ${esc(agent.cls)} · ${plural(confessionals, 'confessional')}, ${plural(journals, 'journal')}</span></summary>`
      + (items.length ? `<ol class="lines">${items.join('')}</ol>` : '<p class="more">Nothing yet.</p>') + '</details>';
  });

  // ---- every word, in order
  const wordDays = dayList.filter(day => day.hours.length).map(day => {
    const items = [];
    for (const line of day.hours) for (const id of Object.keys(line.agents ?? {})) if (isAgent(id)) for (const v of voicesOf(line, id)) items.push(voiceHtml(v, `<time>${line.hour}:00</time>`));
    return `<details class="said"><summary>Day ${day.n} <span>${plural(items.length, 'line')}</span></summary>${items.length ? `<div class="lines">${items.join('')}</div>` : '<p class="more">Nobody said a word.</p>'}</details>`;
  });

  // ---- the page around it
  const title = options.title ?? `hotkey 2 · season ${state.seed ?? ''}`.trim();
  const story = storyOf(game, winnerRow, { over, hourLines, dayNow, amongPlayers: lobby });
  if (richerWords && hourLines.length) story.push(richerWords);
  // what the season cost: the brief's `spend`, or the runner's `ai.spend.cost`. A fake run is a rehearsal and bills nothing.
  const spendOf = given => (isNum(given) ? given : [given?.total, given?.usd, given?.cost, given?.spent].find(isNum));
  const spend = spendOf(options.spend) ?? spendOf(options.ai?.spend);
  const cost = options.ai?.transport === 'fake' ? ' The AI seats were played by stand-ins for a rehearsal, so nothing was billed.' : isNum(spend) ? ` The models cost $${spend.toFixed(2)} to run.` : '';
  const cutShort = options.cut ? `<p class="note">This run was stopped before the season ended${typeof options.cut.why === 'string' && options.cut.why ? `: ${esc(options.cut.why)}` : ''}.</p>` : '';
  const npcNamed = role => Object.values(state.npcs ?? {}).filter(n => n.role === role).map(n => n.name);
  const police = npcNamed('police');
  const guide = `<details class="guide"><summary>New here? How the game works</summary>
<p>${cap(numberWord(agents.length))} agents each hold one job in a small city. A season is ${plural(totalDays, 'day')} of ${perDay} hours, and every hour each agent makes one move. Whoever has the most money at the end wins: cash carried plus cash stashed at home.</p>
<ul>
<li><b>The chain.</b> A smuggler buys chems and parts at the docks. The cook turns chems into product. Dealers sell product to street buyers, which is where money enters the city. The gunrunner turns parts into guns.</li>
<li><b>The street.</b> Robbers take what people carry, or break into a pad for the stash. The muscle sells protection. The informant sells what it sees.</li>
<li><b>Trouble.</b> ${police.length ? `${esc(listOf(police))} are the police: they arrest anyone with too much heat. ` : ''}${esc(cap(NPC_ROBBERS_NAME))} rob whoever carries the most cash in the evening, and every night they try the pad with the biggest stash. ${esc(cap(RIVAL_CREW_NAME))} are a rival crew that pushes onto a block once a day.${npcNamed('snitch').length ? ` ${esc(npcNamed('snitch')[0])} the snitch sells crimes to the police unless he is paid.` : ''}</li>
<li><b>Skills.</b> Every night each agent's owner spends the skill points it earned. A line marked <i>Skill at work</i> shows a moment where a bought skill changed what happened.</li>
<li><b>Words.</b> Agents can speak out loud to their block, send private messages, and talk to the camera. Nobody in the game hears what is said to the camera. Every night each agent also writes a short journal.</li>${lobby ? `
<li><b>Players and locals.</b> ${cap(numberWord(players.size))} of the agents ${players.size === 1 ? 'belongs to an owner and is' : 'belong to owners and are'} marked <i>player</i>: the season is theirs to win. The other ${numberWord(agents.length - players.size)} are locals, scripted characters who live in the city, each with one agenda. What the locals do among themselves is folded away under "Elsewhere in the city".</li>` : ''}
</ul></details>`;

  const filters = `<input type="radio" name="f" id="f-all" checked><label for="f-all">Everyone</label>`
    + agents.map((a, i) => `${lobby && i === players.size ? '<span class="sep">locals</span>' : ''}<input type="radio" name="f" id="f${a.seat}"${lobby && !isPlayer(a.id) ? ' data-local' : ''}><label for="f${a.seat}" class="n s${a.seat}">${esc(a.name)}</label>`).join('');
  const jumps = dayList.map(day => `<a href="#day-${day.n}">Day ${day.n}</a>`).join('') + '<a href="#tracks">Commentary</a><a href="#words">Every word</a>';
  const trackLinks = agents.map(a => (lobby && !isPlayer(a.id)
    ? `<p class="tl" id="tl${a.seat}">Showing only what involves ${chip(a.id)}, the ${esc(a.cls)}, one of the locals.</p>`
    : `<p class="tl" id="tl${a.seat}">Showing only what involves ${chip(a.id)}, the ${esc(a.cls)}. <a href="#track-${a.seat}" data-track>Read ${esc(possessive(a.name))} commentary track</a></p>`)).join('');

  const seatCss = agents.map(a => `.s${a.seat}{--h:${hueOf(a.seat)}}`
    + `body:has(#f${a.seat}:checked) [data-who]:not([data-who~="s${a.seat}"]){display:none!important}`
    + `body:has(#f${a.seat}:checked):not(:has(#sw-turns:checked)) .hour[data-hw]:not([data-hw~="s${a.seat}"]){display:none}`
    + `body:has(#f${a.seat}:checked) #tl${a.seat}{display:block}`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<style>
${CSS}
${seatCss}
</style>
</head>
<body>
<header class="top"><div class="wrap">
<p class="kicker">${esc(status)}</p>
<h1>${esc(title)}</h1>
<p class="lede">${story.map(told).join(' ')}</p>
${cutShort}
<h2 class="quiet-h">${over ? 'Final standings' : 'Standings so far'}</h2>
${standingsHtml}
${guide}
</div></header>
<nav class="bar" aria-label="What to show"><div class="wrap">
<div class="who" role="radiogroup" aria-label="Follow one agent">${filters}</div>
<div class="tools"><label class="sw"><input type="checkbox" id="sw-turns"><span>Show every turn</span></label><label class="sw"><input type="checkbox" id="sw-engine"><span>Show the engine</span></label><span class="jump">${jumps}</span></div>
</div></nav>
<main class="wrap">
<p class="jump jump-top">${jumps}</p>
${trackLinks}
${dayHtml.join('\n')}
<section id="tracks"><h2>Commentary tracks</h2>
<p class="note">Everything each agent said to the camera, and its journal from every night, in order.</p>
${tracks.join('\n')}
</section>
<section id="words"><h2>Every word</h2>
<p class="note">Everything said out loud, sent in private or told to the camera, hour by hour.</p>
${wordDays.join('\n') || '<p class="more">Nobody has said a word yet.</p>'}
</section>
</main>
<footer class="wrap"><p>Season ${esc(state.seed ?? '')} of hotkey 2${state.run ?? options.run ? `, run ${esc(state.run ?? options.run)}` : ''}.${cost} This page is one file and loads nothing from anywhere else.</p>${engine(`seed ${esc(state.seed)} · t ${esc(state.t)} · phase ${esc(state.phase)}`)}</footer>
<script>
document.addEventListener('click', function (e) {
  var link = e.target.closest && e.target.closest('a[data-track]');
  if (!link) return;
  var track = document.getElementById(link.getAttribute('href').slice(1));
  if (track) track.open = true;
});
document.addEventListener('change', function (e) {
  if (e.target.name !== 'f') return;
  var open = e.target.hasAttribute('data-local');
  document.querySelectorAll('details.elsewhere').forEach(function (fold) { fold.open = open; });
});
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------------------------------------------
// The leader's story: two sentences built from its biggest moments.

/** Where an agent's money came from, as the event that paid it and the name of that kind of income. */
function incomeOf(event, id) {
  const { kind, who = {}, data = {} } = event;
  if (kind === 'work:deal' && who.dealer === id) return ['selling on the street', data.cash];
  if (kind === 'work:gunsale' && who.gunrunner === id) return ['selling guns on the street', data.price];
  if ((kind === 'pickup' || kind === 'pickup:short') && !data.loan && who.b === id) return ['deals with other agents', data.cash];
  if (kind === 'courier' && !data.loan && data.good && who.a === id) return ['deals with other agents', data.cash];
  if (/^rob:(clean|messy)/.test(kind) && who.robber === id) return ['robberies', data.cash];
  if (/^(breakin|door):(clean|messy)/.test(kind) && who.robber === id) return ['break-ins', data.cash];
  if (kind === 'offer:fence' && data.sold && who.agent === id) return ['selling to the fence', data.cash];
  if ((kind === 'work:tipoff' || kind === 'offer:police') && who.agent === id) return ['selling crimes to the police', data.pay];
  if (kind === 'tip:sold' && who.seller === id) return ['selling tips', data.price];
  if (kind === 'contract:start' && who.muscle === id) return ['guard work', data.price];
  if (kind === 'work:patrol' && who.muscle === id) return ['patrols for the shopkeepers', data.pay];
  if (kind === 'job:done' && who.worker === id) return ['paid jobs', data.paid];
  if (kind === 'collect:win' && who.collector === id) return ['collecting debts', data.lender === id ? data.got : data.fee];
  return null;
}

/** What an event cost an agent in cash, or 0. */
function lossOf(event, id) {
  const { kind, who = {}, data = {} } = event;
  if (/^rob:(clean|messy)/.test(kind) && who.target === id) return data.cash ?? 0;
  if (/^(breakin|door):(clean|messy)/.test(kind) && who.owner === id) return data.cash ?? 0;
  if (/^npc:robbers:(clean|messy)/.test(kind) && who.target === id) return data.lost ?? 0;
  if (kind === 'npc:angry:lose' && who.dealer === id) return data.lost ?? 0;
  if (kind === 'night:robbed' && who.agent === id) return data.lost ?? 0;
  if (isNum(data.fine) && (who.agent === id || who.robber === id || who.smuggler === id || who.gunrunner === id) && /arrest|bust|sting|disaster/.test(kind)) return data.fine + 1;
  return 0;
}

function storyOf(game, top, { over, hourLines, dayNow, amongPlayers = false }) {
  if (!top) return ['Nobody is in the race yet.'];
  const { state } = game;
  const agent = state.agents[top.id];
  const who = agent.name;
  if (!hourLines.length) return [`The season has not started. Every agent begins with the same cash, and ${who} the ${agent.cls} holds the first seat.`];

  const sources = new Map();
  let best = null;
  let worst = null;
  let ledSince = null;
  for (const line of hourLines) {
    for (const event of line.events ?? []) {
      const income = incomeOf(event, top.id);
      if (income && isNum(income[1]) && income[1] > 0) {
        sources.set(income[0], (sources.get(income[0]) ?? 0) + income[1]);
        if (!best || income[1] > best.amount) best = { amount: income[1], event, line };
      }
      const loss = lossOf(event, top.id);
      if (loss > 0 && (!worst || loss > worst.amount)) worst = { amount: loss, event, line };
      if (event.kind === 'lead') ledSince = event.data?.leader === top.id ? line : null;
    }
  }
  const source = [...sources].sort((a, b) => b[1] - a[1])[0];
  const first = [`${who} the ${agent.cls} ${over ? 'won the season' : dayNow > 1 && state.t % (game.cfg?.season?.hoursPerDay ?? 12) === 0 ? `leads${amongPlayers ? ' the players' : ''} after day ${dayNow - 1}` : `leads${amongPlayers ? ' the players' : ''}`} with ${money(top.worth)}`];
  if (source) first.push(`, earning the most from ${source[0]} (${money(source[1])} ${over ? 'over the season' : 'so far'})`);
  // (the lead the engine tracks is the whole city's: it only belongs in the story of whoever is on top of everyone)
  if (ledSince && (top.rank ?? 1) === 1) first.push(over ? `, and took the lead for good on ${clockOf(game, ledSince.t).replace(',', ' at')}` : `, and has been in front since ${clockOf(game, ledSince.t)}`);
  const inner = moment => describe(moment.event, game).replace(/[.!?]$/, '').replace(/^The /, 'the ');
  const at = moment => clockOf(game, moment.line.t);
  let second;
  if (best && worst) second = `Its best hour was ${at(best)} (${inner(best)}); its worst was ${at(worst)} (${inner(worst)}).`;
  else if (best) second = `Its best hour was ${at(best)} (${inner(best)}), and nothing went badly wrong for it.`;
  else if (worst) second = `It got there without one big score, and its worst hour was ${at(worst)} (${inner(worst)}).`;
  else second = 'It got there quietly: no single hour stands out.';
  return [`${first.join('')}.`, second];
}

// ---------------------------------------------------------------------------------------------------------------
// The look: a match report. System fonts only, one accent colour, and a colour chip per agent that works in both
// themes (each chip is a pale tint of the agent's hue behind the name, with a solid bar of the hue beside it).

const CSS = `
:root{color-scheme:light dark;--bg:#f6f3ec;--card:#fffdf8;--ink:#1c1a16;--mute:#6a655a;--rule:#dad4c6;--acc:#b0381d;--good:#2f6b3a;
--chip:.925 .045;--dot:.6 .15;--sans:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
--serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#151412;--card:#1d1b18;--ink:#ebe6da;--mute:#a59e8f;--rule:#393630;--acc:#ff8c6b;--good:#8fcf9a;--chip:.33 .06;--dot:.76 .13}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 var(--sans)}
.wrap{max-width:64rem;margin:0 auto;padding:0 1.25rem}
a{color:var(--acc)}
h1,h2,h3{font-family:var(--serif);font-weight:700;line-height:1.12;letter-spacing:-.012em;margin:0}
h1{font-size:clamp(2.1rem,7vw,3.5rem);margin:.2rem 0 1rem}
h2{font-size:clamp(1.7rem,5vw,2.4rem);border-top:3px solid var(--ink);padding-top:.7rem;margin:4rem 0 .75rem;scroll-margin-top:6.5rem}
h2 small{font:600 .8rem/1 var(--sans);letter-spacing:.08em;text-transform:uppercase;color:var(--acc);vertical-align:middle;margin-left:.6rem}
h2.quiet-h{font:700 .8rem/1 var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--mute);border:0;margin:2.25rem 0 .5rem;padding:0}
h3{font-size:1.45rem;margin:0 0 .6rem}
h4{font:700 .75rem/1.2 var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--mute);margin:1.6rem 0 .55rem}
h5{font:600 1rem/1.3 var(--sans);margin:0 0 .4rem}
h5 span,summary span{font-weight:400;color:var(--mute);font-size:.875rem}
p{margin:0 0 .75rem}
section{scroll-margin-top:6.5rem}
.top{padding:2.5rem 0 1.5rem}
.kicker{font:700 .8rem/1.3 var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--acc);margin:0}
.lede{font:1.2rem/1.5 var(--serif);max-width:46rem;margin:0}
.note,.more{color:var(--mute);font-size:.95rem}
.more{padding:1rem 0}
.w{font-family:var(--serif);font-size:1.04em}
.n{font-weight:650;white-space:nowrap;padding:.05em .24em .05em .42em;border-radius:3px;background:oklch(var(--chip) var(--h,90));box-shadow:inset 3px 0 0 oklch(var(--dot) var(--h,90))}
.rank,.worth,.clock,.purse,time,.moved{font-variant-numeric:tabular-nums}

.table,.race,.hours,.lines,.plain,.turns ul{list-style:none;margin:0;padding:0}
.table li{display:grid;grid-template-columns:1.6rem minmax(9rem,21rem) minmax(0,1fr) auto;gap:.15rem 1rem;align-items:baseline;padding:.6rem 0;border-top:1px solid var(--rule)}
.table li:last-child{border-bottom:1px solid var(--rule)}
.table .rank,.race .rank{color:var(--mute);font-weight:700}
.table .who{display:flex;flex-wrap:wrap;gap:.1rem .5rem;align-items:baseline}
.meta{color:var(--mute);font-size:.875rem}
.tag{font:700 .66rem/1 var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--acc);border:1px solid currentColor;border-radius:2px;padding:.12rem .3rem;margin-left:.1rem;white-space:nowrap}
.bar .sep{flex:none;align-self:center;font:700 .66rem/1 var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--mute);margin:0 .15rem 0 .5rem}
.elsewhere summary{color:var(--mute);font-size:.95rem}
.elsewhere[open] summary{margin-bottom:.9rem}
.beat+.elsewhere{margin-top:1.1rem}
.elsewhere+.turns{margin-top:1.1rem}
.persona{grid-column:2 / -1;color:var(--mute);font-size:.875rem;max-width:46rem}
.build{font-size:.9rem;color:var(--mute)}
.table .worth{font-weight:700;font-size:1.1rem;text-align:right}
.table x-engine{grid-column:2 / -1}
.guide{margin-top:1.5rem;font-size:.95rem;max-width:46rem}
.guide ul{padding-left:1.1rem;margin:.5rem 0 0}
.guide li{margin-bottom:.35rem}
summary{cursor:pointer}
.guide summary{color:var(--acc);font-weight:600}
.guide p{margin-top:.6rem}

.bar{position:sticky;top:0;z-index:5;background:var(--bg);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.bar .wrap{padding-top:.5rem;padding-bottom:.5rem;display:grid;gap:.45rem}
.bar .who{display:flex;gap:.4rem;overflow-x:auto;scrollbar-width:none;padding:2px 0}
.bar .who::-webkit-scrollbar{display:none}
.bar input{position:absolute;opacity:0;width:1px;height:1px}
.bar .who label{flex:none;cursor:pointer;font-size:.875rem;line-height:1.5;padding:.1rem .6rem;border-radius:3px;border:1px solid var(--rule);opacity:.72}
.bar .who label.n{border-color:transparent;padding-left:.7rem}
.bar .who input:checked+label{opacity:1;outline:2px solid var(--ink);outline-offset:1px}
.bar input:focus-visible+label,.sw input:focus-visible+span{outline:2px solid var(--acc);outline-offset:2px}
.tools{display:flex;flex-wrap:wrap;gap:.35rem 1.1rem;align-items:center;font-size:.875rem}
.sw{cursor:pointer;display:inline-flex;align-items:center}
.sw span{display:inline-flex;align-items:center;gap:.45rem}
.sw span::before{content:"";width:1.9rem;height:1.05rem;border-radius:1rem;border:1px solid var(--mute);background:radial-gradient(circle at .5rem 50%,var(--mute) .32rem,transparent .36rem)}
.sw input:checked+span::before{border-color:var(--acc);background:radial-gradient(circle at 1.34rem 50%,var(--bg) .32rem,transparent .36rem),var(--acc)}
.jump{display:flex;gap:.9rem;margin-left:auto;overflow-x:auto;white-space:nowrap}
.jump a{color:var(--mute);text-decoration:none}
.jump a:hover{color:var(--acc)}
.jump-top{display:none}
.tl{display:none;margin:1.25rem 0 0;padding:.6rem .8rem;border:1px solid var(--rule);border-radius:4px;background:var(--card);font-size:.95rem}

.forecast{max-width:46rem;color:var(--mute)}
.noon{color:var(--ink)}
.forecast>b:first-child,.flag>b:first-child{font:700 .72rem/1 var(--sans);letter-spacing:.09em;text-transform:uppercase;color:var(--acc);margin-right:.35rem}
.hours{margin-top:1.25rem}
.hour,.fold{display:grid;grid-template-columns:4.5rem minmax(0,1fr);gap:0 1rem;padding:.95rem 0;border-top:1px solid var(--rule)}
.clock{font-weight:700;color:var(--mute);font-size:.95rem;padding-top:.12rem}
.fold{color:var(--mute);font-size:.95rem;padding:.55rem 0}
.fold .clock{font-weight:400;font-size:.875rem;padding-top:.06rem}
.hour.quiet,.turns,x-engine{display:none}
.beat{display:grid;grid-template-columns:minmax(0,1fr);gap:.5rem 2rem}
.beat+.beat{margin-top:1.35rem}
.what{font-size:1.08rem;line-height:1.45;margin:0;text-wrap:pretty}
.beat.minor .what{font-size:1rem;color:var(--mute)}
.beat.lead .what{font-family:var(--serif);font-style:italic}
.beat.lead .what::before{content:"New leader";font:700 .72rem/1 var(--sans);font-style:normal;letter-spacing:.09em;text-transform:uppercase;color:var(--acc);margin-right:.5rem}
.flag{font-size:.9rem;margin:.4rem 0 0}
.voices{display:grid;gap:.5rem;align-content:start;border-left:2px solid var(--rule);padding-left:.9rem}
.v{margin:0;font-size:.9rem;line-height:1.45}
.v i,.ask i,.lines i{font-style:normal;color:var(--mute);font-size:.8rem;margin:0 .15rem}
.v.conf .w{font-style:italic}
.v.say .w::before,.v.msg .w::before{content:"\\201C"}
.v.say .w::after,.v.msg .w::after{content:"\\201D"}
.turns{margin-top:.25rem}
.beat+.turns{margin-top:1.1rem}
.turns h4{margin-top:0}
.turns .also{color:var(--mute)}
.turns .also i{font:700 .7rem/1 var(--sans);letter-spacing:.09em;text-transform:uppercase;margin-right:.35rem}
.turns li{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.1rem 1rem;padding:.3rem 0;border-top:1px solid var(--rule);font-size:.92rem}
.turns .did{flex:1 1 20rem}
.purse{color:var(--mute);font-size:.8rem;white-space:nowrap}
.turns x-engine{flex-basis:100%}
x-engine{font:12px/1.5 var(--mono);color:var(--mute);border:1px dashed var(--rule);border-radius:4px;padding:.35rem .55rem;margin:.45rem 0 0;overflow-wrap:anywhere}
body:has(#sw-turns:checked) .hour.quiet{display:grid}
body:has(#sw-turns:checked) .turns,body:has(#sw-engine:checked) x-engine{display:block}
body:has(#sw-turns:checked) .fold{display:none}

.night{background:var(--card);border:1px solid var(--rule);border-radius:6px;padding:1.4rem 1.4rem 1.5rem;margin-top:1.5rem}
.night>p{max-width:46rem}
.race li{display:grid;grid-template-columns:1.6rem minmax(0,1fr) 5.5rem 5.5rem;gap:0 .9rem;align-items:center;padding:.32rem 0;border-top:1px solid var(--rule)}
.race .who{display:flex;align-items:center;gap:.7rem;min-width:0}
.race .nm{flex:0 0 auto;min-width:5.5rem;display:flex;align-items:center;gap:.4rem}
.race.lobby .nm{min-width:10rem}
.lane{flex:1 1 auto;min-width:0;display:flex}
.meter{height:.5rem;border-radius:1px;background:oklch(var(--dot) var(--h,90));flex:0 0 auto;min-width:2px}
.race .worth{text-align:right;font-weight:650}
.moved{font-size:.8rem;color:var(--mute);text-align:right}
.up{color:var(--good);font-weight:650}
.down{color:var(--acc);font-weight:650}
.plain li{padding:.25rem 0;font-size:.95rem}
.journals{display:grid;grid-template-columns:repeat(auto-fill,minmax(17rem,1fr));gap:1.1rem 1.75rem}
.journal{border-top:1px solid var(--rule);padding-top:.7rem;font-size:.92rem}
.journal ul{margin:0;padding-left:1rem}
.journal li{margin-bottom:.2rem}
.ask{margin:.45rem 0 0}
.pre{margin-bottom:1rem}

.track,.said{border-top:1px solid var(--rule);padding:.65rem 0}
.track summary,.said summary{font-weight:600}
.lines{margin-top:.6rem}
.lines li{display:grid;grid-template-columns:7.5rem minmax(0,1fr);gap:0 1rem;padding:.4rem 0;border-top:1px dotted var(--rule);font-size:.95rem}
.said .v{display:grid;grid-template-columns:3.5rem minmax(0,1fr);gap:0 1rem;font-size:.95rem;padding:.4rem 0;border-top:1px dotted var(--rule)}
time{color:var(--mute);font-size:.8rem;padding-top:.15rem}
.lines .j{background:var(--card)}
.lines .j p{margin:0 0 .15rem}
footer{color:var(--mute);font-size:.85rem;padding-top:3rem;padding-bottom:3rem;margin-top:3rem;border-top:1px solid var(--rule)}

@media (min-width:58rem){
.beat{grid-template-columns:minmax(0,11fr) minmax(0,9fr)}
.beat.minor,.beat.lead{grid-template-columns:minmax(0,1fr)}
}
@media (max-width:40rem){
.wrap{padding:0 1rem}
.hour,.fold{grid-template-columns:minmax(0,1fr);gap:.3rem}
.fold{grid-template-columns:auto minmax(0,1fr);gap:.6rem}
.table li{grid-template-columns:1.4rem minmax(0,1fr) auto}
.table .build{grid-column:2 / -1;grid-row:2}
.table .worth{grid-column:3;grid-row:1}
.race li{grid-template-columns:1.4rem minmax(0,1fr) auto;row-gap:.1rem}
.race .moved{grid-column:2 / -1;text-align:left}
.race.lobby .nm{min-width:8.5rem}
.night{padding:1.1rem 1rem 1.2rem;margin-left:-.25rem;margin-right:-.25rem}
.lines li{grid-template-columns:minmax(0,1fr);gap:.1rem}
.tools .jump{display:none}
.jump-top{display:flex;margin:1rem 0 0;font-size:.9rem}
}
@media print{.bar{position:static}}
`;
