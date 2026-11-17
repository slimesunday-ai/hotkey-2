// THE RUN ON AUTO over the real stage, for /demo/?mode=run&runtest=<policy> (demo/tools/run-stage.mjs reads it).
// The player's every choice is a scripted policy's (src/run/policies.mjs, the same ones the marks are measured with),
// the cards are pressed on, and every hour plays at the speed asked for (&speed=1|2|4): the wall clock is the real
// one. &days=N (default 6) is how many days; &skip=K presses Space one second into every K-th step's scene.
//
//   runtest=market   to the market, home at $90 or heat 3, buying each thing as soon as it can be paid for (mark 6)
//   runtest=park     the trailer park only, buying the same way
// The rules' policies choose the street's moves themselves (src/run/policies.mjs, rules-2): with the box cutter a
// crime player robs once a day where the place is cool, gives a regular at the door what they ask, and so on. The
// marks' other scripted players are here too, buying the same way, so every new move is played by one of them:
//   runtest=rough    to the market, home at $120, but spent there it stays and sleeps rough (mark 8)
//   runtest=drink    the same, buying the day's energy drink when spent (mark 8, beside it)
//   runtest=bins     the trailer park, digging the bins wherever the odd job would have been (mark 9)
//   runtest=lean     the trailer park, selling to the regular whenever dealt (mark 11): he comes to the door
//   runtest=refuse   the same, shutting the door on him every time (mark 11)
//   runtest=mixed    both places (mark 12)
//   runtest=neighbour  both places, the good neighbour: trust built, nobody turned against it (marks 13, 14)
//   runtest=burner     both places, the best pay whoever it burns, the door shut on a regular (marks 13, 14)
//   runtest=dealer     both places, home at $120, buying packs from both connects, selling whenever dealt one, and
//                      carrying two of each good between them (goods-1, marks 15 and 16)
//   runtest=walker     to the market, home at $90, ON FOOT both ways by Fit Street, playing the stop's best card on the
//                      way home (routes-1, mark R2)
//   runtest=skater     the same on the skateboard, every way (routes-1, mark R3): give it &kit=board, or it walks
//                      nowhere until it has bought one (it takes the subway till then)
//   runtest=homefirst  both places, the trailer park's crimes first, home at $120: it brings pressure on at home and
//                      is away when they come, and ignores it all (home-1, marks H2, H5)
//   runtest=guard      the same, hiring Cousin Earl for three days, $75 up front, the morning an attempt is due unless
//                      he is on through it (home-1, mark H3; save-1, mark H8)
//   runtest=racer      the same, heading home on a notice by the quickest way in time when it pays (home-1, mark H7)
// &kit=pocket,cutter,bed,board starts the run owning those (for the street's robbing early on; the board as a thing).
//
// When it is over the title is `run-ok` or `run-fail: <why>`, and window.__runtest holds the numbers, with `moves`:
// how many times each choice was played (job, rob, bins, shop, rough, give, refuse, …) and `picked`, targets named.
import { RUN_CONFIG } from '../../src/run/index.mjs';
import { POLICIES, decide } from '../../src/run/policies.mjs';

const POLICY = {
  market: { ...POLICIES.homeAt(90), buy: true },
  park: { ...POLICIES.park, buy: true },
  rough: { ...POLICIES.homeAt(120), rough: true, buy: true },
  drink: { ...POLICIES.homeAt(120), drink: true, buy: true },
  bins: { ...POLICIES.park, bins: true, buy: true },
  lean: { ...POLICIES.park, regular: 'lean', buy: true },
  refuse: { ...POLICIES.park, regular: 'lean', door: 'refuse', buy: true },
  mixed: { ...POLICIES.mixed(120), buy: true },
  // trust (RUN.md "Trust", marks 13 and 14): both places, home at $120; the good neighbour builds trust and never turns
  // anyone against it, the burner takes the best pay and shuts the door on a regular
  neighbour: { ...POLICIES.neighbour(120), buy: true },
  burner: { ...POLICIES.burner(120), buy: true },
  dealer: { ...POLICIES.dealer(120), buy: true },
  // routes-1 (RUN.md "Routes", marks R2 and R3): on foot both ways, the stop's best card on the way home; on the board
  walker: { ...POLICIES.walker(90, 'play'), buy: true },
  skater: { ...POLICIES.skater(90), buy: true },
  // home-1 (RUN.md "Home pressure", marks H3 and H7): the pressured player, the home-first one (the trailer park's
  // crimes first, then the market, home at $120), meeting the attempts its pressure brings three ways: ignoring them,
  // Cousin Earl hired for three days the morning one is due, racing home on a notice when it pays
  homefirst: { ...POLICIES.homeFirst(120), buy: true },
  guard: { ...POLICIES.homeFirst(120), defend: 'guard', buy: true },
  racer: { ...POLICIES.homeFirst(120), race: true, buy: true },
};

export function runRunTest({ demo, mountRun, host, opts }) {
  const { stage, Q } = demo;
  const name = POLICY[Q.get('runtest')] ? Q.get('runtest') : 'market';
  const policy = POLICY[name];
  const days = Number(Q.get('days')) || 6;
  const skipEvery = Number(Q.get('skip')) || 0;
  const errors = [];
  addEventListener('error', e => errors.push(e.message || String(e)));
  addEventListener('unhandledrejection', e => errors.push(String(e.reason?.stack ?? e.reason)));
  for (const level of ['error', 'warn']) {
    const real = console[level];
    console[level] = (...args) => {
      const text = args.map(a => a?.stack ?? String(a)).join(' ');
      if (level === 'error' || /\[stage\]|\[run\]/.test(text)) errors.push(text);
      real(...args);
    };
  }
  const fps = [];
  let frames = 0;
  let second = performance.now();
  const count = now => {
    frames += 1;
    if (now - second >= 1000) {
      fps.push((frames * 1000) / (now - second));
      frames = 0;
      second = now;
    }
    requestAnimationFrame(count);
  };
  requestAnimationFrame(count);

  const started = performance.now();
  const seen = { policy: name, seed: opts.seed, days: 0, steps: 0, kinds: {}, moves: {}, picked: 0, daySeconds: [], stepSeconds: [], skipped: 0, done: null, troubles: { jumped: 0, bad: 0, stopped: 0, clinic: 0, jail: 0 },
    // (trust-1: witnesses who called it in or kept quiet, who was turned against you or won over, looked away, sore, notices)
    trust: { called: 0, quiet: 0, against: [], with: [], lookedAway: 0, sore: 0, notices: 0, end: null },
    // (goods-1: packs bought by place, sales that used a good by place and good, rides taken with goods on you, the
    // goods a jump or a stop took, errands and things)
    goods: { packs: {}, sold: {}, carriedRides: 0, lost: 0, seized: 0, errands: 0, things: 0, worn: 0 },
    // (routes-1: the ways set out on, on foot and on the board, the legs on from a stop, the cards played by card, and
    // what the way's ground took: jumped or stopped at the stop or on a leg from it)
    routes: { walks: 0, skates: 0, onward: 0, cards: {}, jumped: 0, stopped: 0 },
    // (home-1: warnings (seen casing your crib), notices (somebody at your door), attempts met at the door (home in time,
    // or in the night) and settled while you were out, how each went, Cousin Earl's stretches (save-1: each hire paid up
    // front, `hires`; of them kept on from his last day, `kept`; his last-day notices and his going), ones called off)
    home: { warnings: 0, notices: 0, met: 0, settled: 0, taken: 0, held: 0, hires: 0, kept: 0, lastDays: 0, gone: 0, calledOff: 0, raced: 0, outcomes: [] } };
  let dayAt = started;
  let stepAt = started;
  let lastStep = null;
  let finished = false;
  const finish = why => {
    if (finished) return;
    finished = true;
    const mean = fps.length ? fps.reduce((a, b) => a + b, 0) / fps.length : 0;
    const S = stage.debug();
    // (who is not neutral at the end: name, band, trust)
    seen.trust.end = (hud?.view?.trust ?? []).filter(t => t.band !== 'neutral').map(t => `${t.name} ${t.band} ${t.trust}`);
    window.__runtest = {
      ...seen, ok: !why, why: why ?? null, seconds: +((performance.now() - started) / 1000).toFixed(1),
      fpsMean: +mean.toFixed(1), fpsWorst: +(fps.length ? Math.min(...fps) : 0).toFixed(1), errors: errors.slice(0, 8),
      state: hud?.state, lengths: S.lengths, audit: S.audit, tally: S.tally, travel: S.travel, notes: S.notes, voyages: S.voyages,
    };
    document.title = why ? `run-fail: ${why}` : 'run-ok';
  };
  setTimeout(() => finish(`timed out after ${seen.days} days`), Number(Q.get('limit') || 3000) * 1000);
  // nothing for two minutes is a stuck run
  setInterval(() => {
    if (!finished && performance.now() - stepAt > 120000) finish(`stuck after ${seen.steps} steps at ${hud?.state.place}, ${hud?.phase}`);
  }, 5000);

  const kit = Object.fromEntries((Q.get('kit') ?? '').split(',').filter(k => ['pocket', 'cutter', 'bed', 'board'].includes(k)).map(k => [k, true]));
  const hud = mountRun(host, {
    ...opts,
    kit,
    // (save-1: &save=1, the tool asks for the save: the run is saved after every step and picked up after a reload
    // (demo/tools/run-stage.mjs --reload-at); &new=1 on the first load starts it fresh. Otherwise none is read or written)
    save: Q.get('save') === '1',
    pilot: (v, state) => decide(RUN_CONFIG, state, policy, v),
    onError: err => finish(String(err?.message ?? err)),
    onStep({ choice, events, state, before }) {
      const now = performance.now();
      if (lastStep) seen.stepSeconds.push({ what: lastStep, s: +((now - stepAt) / 1000).toFixed(1) });
      stepAt = now;
      lastStep = choice.do === 'job' ? `job:${choice.id}@${before.place}` : choice.do === 'subway' ? `subway>${choice.to}` : ['rob', 'bins', 'shop', 'rough', 'pack', 'get'].includes(choice.do) ? `${choice.do}@${before.place}`
        : choice.do === 'walk' || choice.do === 'skate' ? `${choice.do}>${choice.to}` : choice.do === 'onward' ? `onward>${before.route?.to}` : choice.do === 'card' ? `card:${choice.id}` : choice.do;
      const Rt = seen.routes;
      if (choice.do === 'walk') Rt.walks += 1;
      if (choice.do === 'skate') Rt.skates += 1;
      if (choice.do === 'onward') Rt.onward += 1;
      if (choice.do === 'card') Rt.cards[choice.id] = (Rt.cards[choice.id] ?? 0) + 1;
      for (const e of events) if (e.route && (e.type === 'jumped' || e.type === 'stopped')) Rt[e.type] += 1;
      const Hm = seen.home;
      if (before.home?.raid?.started && (choice.do === 'subway' || choice.do === 'walk' || choice.do === 'skate' || choice.do === 'onward') && (choice.to === 'park' || before.route?.to === 'park')) Hm.raced += 1;
      for (const e of events) {
        if (e.type === 'casing') Hm.warnings += 1;
        if (e.type === 'alarm') Hm.notices += 1;
        if (e.type === 'calledOff') Hm.calledOff += 1;
        if (e.type === 'guard' && e.paid) Hm.hires += 1;
        if (e.type === 'guard' && e.paid && e.kept) Hm.kept += 1;
        if (e.type === 'guard' && e.lastDay) Hm.lastDays += 1;
        if (e.type === 'guard' && !e.on && e.why === 'done') Hm.gone += 1;
        if (e.type === 'raid') {
          const met = (e.place === 'crib' || e.place === 'park') && (!!e.fight || e.how === 'guard');
          Hm[met ? 'met' : 'settled'] += 1;
          Hm[e.taken ? 'taken' : 'held'] += 1;
          Hm.outcomes.push(`d${e.day} ${met ? 'met' : 'settled'} ${e.how}${e.night ? ' night' : ''}${e.fight ? ` fight:${e.fight.outcome}` : ''}${e.guard ? ` earl:${e.guard.beaten ? 'beaten' : 'held'}` : ''} ${e.taken ? `$${e.taken} taken` : 'held'}`);
        }
      }
      const G = seen.goods;
      if (choice.do === 'subway' && Object.values(before.goods ?? {}).some(n => n > 0)) G.carriedRides += 1;
      seen.steps += 1;
      seen.moves[choice.do] = (seen.moves[choice.do] ?? 0) + 1;
      if (choice.who) seen.picked += 1;
      for (const e of events) {
        seen.kinds[e.type] = (seen.kinds[e.type] ?? 0) + 1;
        if (e.type === 'jumped') {
          seen.troubles.jumped += 1;
          if (e.outcome === 'clean') seen.troubles.bad += 1;
        }
        if (e.type === 'stopped') seen.troubles.stopped += 1;
        if (e.type === 'jail' || e.type === 'clinic') seen.troubles[e.type] += 1;
        if (e.type === 'witness') seen.trust[e.called ? 'called' : 'quiet'] += 1;
        if (e.type === 'sore') seen.trust.sore += 1;
        if (e.notice) seen.trust.notices += 1;
        if (e.type === 'bins' && e.lookedAway) seen.trust.lookedAway += 1;
        if (e.type === 'pack') G.packs[`${e.good}@${e.at}`] = (G.packs[`${e.good}@${e.at}`] ?? 0) + 1;
        if (e.type === 'job' && e.goods) G.sold[`${e.goods.good}@${e.place}`] = (G.sold[`${e.goods.good}@${e.place}`] ?? 0) + 1;
        if (e.type === 'jumped' || e.type === 'robbed') G.lost += Object.values(e.goodsTaken ?? {}).reduce((a, n) => a + n, 0);
        if (e.type === 'stopped') G.seized += Object.values(e.goodsSeized ?? {}).reduce((a, n) => a + n, 0);
        if (e.type === 'shop') G.errands += 1;
        if (e.type === 'thing') G.things += 1;
        if (e.type === 'wear') G.worn += 1;
        for (const t of [e.trust, ...(e.type === 'drift' ? e.changes ?? [] : [])]) if (t && t.band !== t.bandWas && t.band !== 'neutral') seen.trust[t.band].push(`${t.who.name} d${state.day}`);
      }
      if (state.doneDay && !seen.done) seen.done = state.doneDay;
      if (skipEvery && seen.steps % skipEvery === 0) setTimeout(() => hud.skip().then(() => (seen.skipped += 1)), 1000);
      if (state.day !== before.day) {
        seen.daySeconds.push(+((now - dayAt) / 1000).toFixed(1));
        dayAt = now;
        seen.days = state.day - 1;
        // (the state at the step that ended the last day asked for: the same whatever the wall clock did after it, so a
        // run cut by a reload and picked up can be compared with an unbroken one: run-stage.mjs --compare)
        if (seen.days >= days && !seen.endState) seen.endState = JSON.parse(JSON.stringify(state));
        if (seen.days >= days) setTimeout(() => finish(errors.length ? errors[0].slice(0, 200) : null), 4000);
      }
    },
  });
  return hud;
}
