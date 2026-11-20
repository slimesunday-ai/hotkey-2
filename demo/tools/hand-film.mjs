#!/usr/bin/env node
// A DEAL, FILMED AS THE PLAYER SEES IT (anim-1): the run's page (demo/?mode=run), a state loaded where the choice is
// on the table, the choice made with a real key, and every picture the page presents from the key to control coming
// back (Chrome's own screencast, as demo/tools/fight-film.mjs). The cases:
//
//   buy                          a carton from Cousin Earl at the trailer park
//   dumpster:<nothing|little|find>   the alley dumpster on Fit Street (a stop's card on the walk to the market)
//   bins:<nothing|little|find>[:cold|away]   the trailer park's bins, each way the rules can have it come out, and
//                                with a neighbour who saw (cold) or saw and looked away (away: they are with you)
//   sell[:dry]                   (stage 2) a loose cigarette sold to Shaky Dee at the bus stop: paid, or not paid
//   crowd[:dry]                  a cigarette sold to a buyer in the Jay St market's crowd, who comes to you
//   home:<item>                  a piece for the trailer from Mr. Pruitt's swap meet (deadbolt, dogsign, boxfan …)
//   skip[:<case>]                the case (the purchase when none is named) SKIPPED in its first frames
//
//   HK2_DEBUG_PORT=5746 node demo/tools/hand-film.mjs --port 5495 --out <dir> --case buy [--case bins:find:cold …]
//          [--angle bearing,down,high]   the game's camera turned to that first (default: as the game has it)
//          [--old]                       the scenes as they were before the performed ones (the page's ?deals=old)
//          [--headless]                  only finds the states and says what the rules do with them
//          [--check]                     THE MEASURES, no pictures: the purchase, a dig of each ending (one seen cold,
//                                        one looked away from) and a purchase SKIPPED in its first frames with a real
//                                        mouse on the page's Skip; exits 1 when any measure fails (BUDGET, below)
//
// Writes <out>/<case>[-view-…]/f-*.jpg and film.json ({ frames, heads, marks, rec }: demo/tools/fight-film.py makes the
// clip and the strip), and prints THE PACE: seconds from the key to control back, and the deal's own length.
// ONE working set: make the strip, then delete the frames (the owner's disk).
import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { RUN_CONFIG as cfg, newRun, step, view } from '../../src/run/index.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};
const all = name => args.flatMap((a, k) => (a === name ? [args[k + 1]] : []));
const port = opt('--port', 5495);
const out = path.resolve(opt('--out', 'demo/shots/hand-film'));
const angle = opt('--angle', null)?.split(',').map(Number) ?? null;
const OLD = args.includes('--old');
const CHECK = args.includes('--check');
/** (named-1) `--who <name>`: a sale's seed whose buyer is that person (as the rules name them: Tiny, Pockets …). */
const WHO = opt('--who', null);
/** (named-1) `--qs <&a=b…>`: more of the page's query (`&named=0`: the people as they were before they were drawn). */
const QS = opt('--qs', '');
/** `--eval <js>`: asked of the page after each case, and printed (a look at the stage where a case left it). */
const EVAL = opt('--eval', null);
/**
 * `--cross` (hands-2): A WALKER SENT ACROSS THE DEAL. The moment the deal's quiet room is open, the city's crowd walker
 * whose own lane runs nearest its middle (and has no dog, nothing the city holds it by) is put 5 m back along that lane
 * from there, walking: its way crosses the deal. Its every position is kept, and after the case it is said how near
 * the middle it came, whether the room took it round (room.js quietCrowd: stats.round) and whether anybody stood on
 * the room's ground.
 */
const CROSS = args.includes('--cross');
const PUT = opt('--put', null)?.split(',').map(Number) ?? null;
/** `--audit`: the stage's audit on from the choice (actors.js audit: heads over each other, in furniture, …), and what it noted said after. */
const AUDIT = args.includes('--audit');
// THE BUDGETS a check fails on (seconds): the deal's own length; from the key to control back for a purchase made
// standing by the seller; at the bin, from reaching it to control back; a hand-over's two fists (m); how far anybody
// is left from where the deal stood them (m); from the Skip to control back.
// (stage 2) A SALE: from the deal's first frame to control back (the walk to the buyer is the director's, and is
// reported); a big piece bought; and how long the buyer may go on smoking after the player has the hour
const BUDGET = { buy: 3.2, buyAll: 4.2, dig: 4.0, digSeen: 4.8, atBin: 5.0, atBinSeen: 5.8, atDumpster: 5.8, apart: 0.03, moved: 0.05, offMark: 0.2, skip: 1.5, sell: 3.0, buyBig: 3.8, tail: 4.5,
  // (stage 2: each deal's own length, the player's part)
  deal: { sellDisc: 3.0, buyUse: 3.9, lesson: 3.8, haircut: 3.8, pay: 2.6, lift: 2.0, stickup: 3.4, refused: 1.8, buyWear: 3.9, swipe: 3.0 } };
const PLACE = 'park';

// EVERY CASE BEGINS WITH A CARTON BOUGHT, unfilmed: the state is loaded with the player wherever the page had him,
// and the first hour walks him across the park. The purchase stands him by Cousin Earl, and what is filmed after it
// is the choice made from there: a second carton standing beside the seller (the pace a check holds: the deal and
// nothing of a walk), a dig with its walk to the bins. An hour always starts from wherever the last one left him.
const WARM = { do: 'pack', good: 'smokes' };
function stateFor(name) {
  // (throwhook: the carton bought with a frame hook of the stage's throwing every frame from before the choice: the
  // deal's clock and the hour must go on all the same (actors.js, the frame loop: a hook that throws stops no other))
  if (name === 'throwhook') return { ...stateFor('buy'), name, throwHook: true };
  // (skip:<case>: that case, skipped)
  if (name.startsWith('skip:')) return { ...stateFor(name.slice(5)), name };
  const [kind0, find = null, seen = null] = name.split(':');
  const kind = kind0 === 'skip' ? 'buy' : kind0;
  const neighbours = (cfg.places[PLACE]?.people ?? []).map(p => p.id);
  // (stage 2) A SALE at the bus stop, or to the market's crowd; A PIECE from the swap meet. Money on you (the books
  // say where it came from), a carton bought first (the warm-up below: the smokes to sell)
  // (stage 2) THE REST, each a choice of the rules at the park after the carton (job:<id>[:dry], shop:<item>,
  // lesson:<style>, get:<item>), or at the market after the subway (disc[:dry], market:shop:<item>), or a card of the
  // stop on Fit Street on the walk there (card:<id>)
  if (['job', 'shop', 'lesson', 'get', 'disc', 'market', 'card'].includes(kind)) return stage2(name);
  // (hands-2) DUTCH'S FIFTH (tax:<paid|refused>): at the market with the day's takings made and her tax asked, answered
  if (kind === 'tax') {
    for (let seed = 1; seed < 400; seed++) {
      const s0 = newRun({ seed, cfg });
      const s = { ...s0, place: PLACE, hour: 14, energy: 6, carried: s0.carried + 200, books: { ...s0.books, earned: s0.books.earned + 200 } };
      let s1;
      try {
        s1 = step(cfg, step(cfg, s, WARM).state, { do: 'subway', to: 'market', hop: false }).state;
      } catch {
        continue;
      }
      const day = s1.day;
      const st = { ...s1, sixes: { marks: [{ why: 'sell', n: cfg.sixes.tax, day, text: 'hand-film: sold to all day' }], word: day, did: day, made: 60, madeDay: day, tax: { wants: 12, made: 60, day, value: cfg.sixes.tax } } };
      const choice = { do: 'tax', pay: find !== 'refused' };
      if (!view(cfg, st).choices.some(c => c.choice.do === 'tax' && c.choice.pay === choice.pay && !c.why)) continue;
      const r = step(cfg, st, choice);
      if (!r.events.some(e => e.type === 'sixes' && e.what === (choice.pay ? 'paid' : 'refused'))) continue;
      return { name, seed, state: st, warm: false, choice, said: r.events.map(e => e.text).filter(Boolean).join(' ').slice(0, 200) };
    }
    throw new Error(`no seed for ${name}`);
  }
  if (kind === 'sell' || kind === 'crowd' || kind === 'home') {
    const paid = find !== 'dry';
    for (let seed = 1; seed < 4000; seed++) {
      const s0 = newRun({ seed, cfg });
      // (energy short of full at the market: the warm-up there is a drink, which a full day will not take)
      const s = { ...s0, place: PLACE, hour: 14, energy: kind === 'crowd' ? 5 : 8, carried: s0.carried + 200, books: { ...s0.books, earned: s0.books.earned + 200 } };
      let s1 = step(cfg, s, WARM).state;
      if (kind === 'home') {
        const choice = { do: 'get', item: find };
        if (!view(cfg, s1).choices.some(c => c.choice.do === 'get' && c.choice.item === find)) throw new Error(`nothing called ${find} at the swap meet`);
        const r = step(cfg, s1, choice);
        return { name, seed, state: s, choice, said: r.events.filter(e => e.text).map(e => e.text).join(' ').slice(0, 200) };
      }
      if (kind === 'sell') {
        const choice = { do: 'job', id: 'loosies' };
        const e = step(cfg, s1, choice).events.find(x => x.type === 'job');
        if (!e || (e.outcome === 'win') !== paid || e.duel || (WHO && !e.text.includes(WHO))) continue;
        // (sell:then, sell:thenskip: THE NEXT MOVE MADE WHILE HE IS STILL SMOKING, as a player makes it: another carton
        // from Cousin Earl the moment control is back; and that one Skipped at once. Nothing may be left held or
        // drawn after, and the page must go on answering: the check for what a stage-1 run once met)
        const then = find === 'then' || find === 'thenskip' ? { do: 'pack', good: 'smokes' } : null;
        return { name, seed, state: s, choice, ...(then ? { then, thenSkip: find === 'thenskip' } : {}), said: e.text.slice(0, 220) };
      }
      // (the market: the subway there, unfilmed, and something bought from Mrs. Bao to stand him somewhere first)
      try {
        s1 = step(cfg, s1, { do: 'subway', to: 'market', hop: false }).state;
      } catch {
        continue;
      }
      // (hands-2: crowd[:dry]:word, the sale that raises the Sixes to Dutch's word, so she comes over in the same hour
      // while the buyer still smokes beside you: the dealer run's hour 18, where the two heads went one over the other.
      // tax:<paid|refused>, her fifth asked on the kerb and answered: the meter at the tax, the day's takings made)
      const word = name.split(':').includes('word');
      if (word) s1 = { ...s1, sixes: { marks: [{ why: 'sell', n: cfg.sixes.word - 1, day: s1.day - 1, text: 'hand-film: the market sold to before' }] } };
      const job = view(cfg, s1).choices.find(c => c.choice.do === 'job' && c.choice.id === 'crowd' && (c.choice.good ?? 'smokes') === 'smokes');
      if (!job) continue;
      const warm = { do: 'shop', item: 'drink' };
      const s2 = step(cfg, s1, warm).state;
      const evs = step(cfg, s2, job.choice).events;
      const e = evs.find(x => x.type === 'job');
      if (!e || (e.outcome === 'win') !== paid || e.goods?.good !== 'smokes' || e.duel || (WHO && !e.text.includes(WHO))) continue;
      if (word && !evs.some(x => x.type === 'sixes' && x.what === 'word')) continue;
      return { name, seed, state: s1, warm, choice: job.choice, said: `${e.text.slice(0, 160)}${word ? ' + Dutch\'s word' : ''}` };
    }
    throw new Error(`no seed for ${name}`);
  }
  // THE ALLEY DUMPSTER (dumpster:<nothing|little|find>): a card of the stop on Fit Street, on the walk from the
  // trailer park to the market. The walk there is what is done first, unfilmed; then the card is played
  if (kind === 'dumpster') {
    const walk = { do: 'walk', to: 'market' };
    for (let seed = 1; seed < 4000; seed++) {
      const s0 = newRun({ seed, cfg });
      const s = { ...s0, place: PLACE, hour: 10, energy: 8 };
      let st = null;
      try {
        st = step(cfg, s, walk).state;
      } catch {
        continue;
      }
      if (!st.route?.hand?.includes('dumpster')) continue;
      const e = step(cfg, st, { do: 'card', id: 'dumpster' }).events.find(x => x.type === 'bins');
      if (!e || e.find !== find || e.seen) continue;
      // (loaded AT the stop: played from the park, the page walks on through the stop to the market)
      return { name, seed, state: st, warm: false, choice: { do: 'card', id: 'dumpster' }, said: e.text.slice(0, 220) };
    }
    throw new Error(`no seed digs the dumpster to ${find}`);
  }
  for (let seed = kind === 'buy' ? 3 : 1; seed < 4000; seed++) {
    const s0 = newRun({ seed, cfg });
    // (money on you, and the books say where it came from: the page checks they balance)
    const s = { ...s0, place: PLACE, hour: 10, energy: 8, carried: s0.carried + 40, books: { ...s0.books, earned: s0.books.earned + 40 }, ...(seen === 'away' ? { trust: Object.fromEntries(neighbours.map(id => [id, cfg.trust.max])) } : {}) };
    if (!view(cfg, s).choices.some(c => c.choice.do === 'pack')) throw new Error('nobody sells a pack here');
    const s1 = step(cfg, s, WARM).state;
    if (kind === 'buy') {
      const r = step(cfg, s1, WARM);
      return { name, seed, state: s, choice: WARM, said: r.events.filter(e => e.text).map(e => e.text).join(' ').slice(0, 200) };
    }
    // THE BINS: the seed whose dig comes out as asked (the rules' own rolls; whoever saw is with you only when trusted)
    const r = step(cfg, s1, { do: 'bins' });
    const e = r.events.find(x => x.type === 'bins');
    if (!e || e.find !== find) continue;
    const how = e.seen ? (e.lookedAway ? 'away' : 'cold') : null;
    if (how !== seen) continue;
    return { name, seed, state: s, choice: { do: 'bins' }, said: e.text.slice(0, 220) };
  }
  throw new Error(`no seed digs the bins to ${find}${seen ? `, ${seen}` : ''}`);
}
function stage2(name) {
  const parts = name.split(':');
  const dry = parts[parts.length - 1] === 'dry';
  for (let seed = 1; seed < 4000; seed++) {
    const s0 = newRun({ seed, cfg });
    const s = { ...s0, place: PLACE, hour: 14, energy: ['market', 'disc', 'shop'].includes(parts[0]) ? 5 : 7, carried: s0.carried + 300, books: { ...s0.books, earned: s0.books.earned + 300 } };
    // (hands-2: what the rules ask before they deal these at all. A stick-up needs the box cutter on you; the barber's
    // card is dealt only to somebody with heat of their own to cool. Without them no seed ever reached either)
    if (parts.includes('stickup')) s.owned = { ...s0.owned, cutter: true };
    if (parts[0] === 'card' && parts[1] === 'barber') s.heat = Math.max(1, s0.heat ?? 0);
    // (no carton for a disc's case: carrying smokes too, the crowd's buyer is dealt the smokes)
    let s1 = parts[0] === 'disc' ? s : step(cfg, s, WARM).state;
    let warm;
    let choice;
    if (parts[0] === 'card') {
      let st = null;
      try {
        st = step(cfg, { ...s1, hour: 10 }, { do: 'walk', to: 'market' }).state;
      } catch {
        continue;
      }
      if (!st.route?.hand?.includes(parts[1])) continue;
      choice = { do: 'card', id: parts[1] };
      const e = step(cfg, st, choice).events.find(x => x.type === 'card');
      if (!e || (e.outcome === 'win') === dry) continue;
      return { name, seed, state: st, warm: false, choice, said: e.text.slice(0, 200) };
    }
    if (parts[0] === 'market' || parts[0] === 'disc') {
      try {
        s1 = step(cfg, s1, { do: 'subway', to: 'market', hop: false }).state;
      } catch {
        continue;
      }
      warm = { do: 'pack', good: 'discs' };
      if (!view(cfg, s1).choices.some(c => c.choice.do === 'pack' && c.choice.good === 'discs')) continue;
      const s2 = step(cfg, s1, warm).state;
      if (parts[0] === 'disc') {
        const job = view(cfg, s2).choices.find(c => c.choice.do === 'job' && c.choice.id === 'crowd');
        if (!job) continue;
        // (the page's choice names no good: the rules deal the good, and the seed is one that deals discs)
        choice = job.choice;
        let e;
        try {
          e = step(cfg, s2, choice).events.find(x => x.type === 'job');
        } catch {
          continue;
        }
        if (!e || (e.outcome === 'win') === dry || e.goods?.good !== 'discs' || e.duel) continue;
        return { name, seed, state: s1, warm, choice, said: e.text.slice(0, 200) };
      }
      if (parts[1] === 'job') {
        choice = { do: 'job', id: parts[2] };
        let e;
        try {
          e = step(cfg, s2, choice).events.find(x => x.type === 'job');
        } catch {
          continue;
        }
        if (!e || (e.outcome === 'win') === dry || e.duel) continue;
        return { name, seed, state: s1, warm, choice, said: e.text.slice(0, 200) };
      }
      // (hands-2: market:get:<item>, a thing to wear off the clothes rail, put on there and then)
      choice = { do: parts[1] === 'get' ? 'get' : 'shop', item: parts[2] };
      if (!view(cfg, s2).choices.some(c => c.choice.do === choice.do && c.choice.item === parts[2] && !c.why)) continue;
      return { name, seed, state: s1, warm, choice, said: step(cfg, s2, choice).events.map(e => e.text).filter(Boolean).join(' ').slice(0, 200) };
    }
    if (parts[0] === 'job') {
      choice = { do: 'job', id: parts[1] };
      let e;
      try {
        e = step(cfg, s1, choice).events.find(x => x.type === 'job');
      } catch {
        continue;
      }
      if (!e || (e.outcome === 'win') === dry || e.duel) continue;
      return { name, seed, state: s, choice, said: e.text.slice(0, 200) };
    }
    choice = parts[0] === 'shop' ? { do: 'shop', item: parts[1] } : parts[0] === 'lesson' ? { do: 'learn', style: parts[1] } : { do: 'get', item: parts[1] };
    // (the dog: and then home, to see him follow you there: the next choice, filmed too)
    if (parts[1] === 'dog') return { name, seed, state: s, choice, then: { do: 'inside' }, said: step(cfg, s1, choice).events.map(e => e.text).filter(Boolean).join(' ').slice(0, 200) };
    if (!view(cfg, s1).choices.some(c => Object.entries(choice).every(([k, v]) => c.choice[k] === v))) throw new Error(`no ${JSON.stringify(choice)} at the park`);
    return { name, seed, state: s, choice, said: step(cfg, s1, choice).events.map(e => e.text).filter(Boolean).join(' ').slice(0, 200) };
  }
  throw new Error(`no seed for ${name}`);
}
const cases = (CHECK && !all('--case').length ? ['buy', 'bins:nothing', 'bins:little:away', 'bins:find:cold', 'dumpster:find', 'skip', 'sell', 'sell:dry', 'crowd', 'home:deadbolt', 'home:boxfan', 'skip:sell', 'get:dog', 'job:wallet', 'job:odd', 'shop:sandwich', 'lesson:haymaker', 'market:shop:drink', 'sell:then', 'sell:thenskip', 'throwhook', 'market:get:visor', 'tax:paid'] : all('--case')).map(stateFor);
for (const c of cases) console.log(`headless ${c.name}: ${c.said}`);
if (args.includes('--headless') || !cases.length) process.exit(0);
const failures = [];

const debugPort = Number(process.env.HK2_DEBUG_PORT ?? 9222);
// (EACH CASE IN A BROWSER OF ITS OWN for the check (--same-browser: one for all, as a film run has it). Twelve page
// loads in one tab, the page stopped answering in the seventh or the ninth case, two runs of three, 2026-11-19; each
// case alone, never. A player loads the page once: what builds up over page loads is the tool's, not the game's)
const FRESH = CHECK && !args.includes('--same-browser');
let browser = await launch({ width: 1600, height: 1000 });
let failed = null;
try {
  const base = `http://127.0.0.1:${port}/demo/?mode=run&seed=3&speed=1&new=1${OLD ? '&deals=old' : ''}${QS}`;
  let page = await browser.open(base);
  const ev = (js, ms = 30000) => page.evaluate(js, ms);
  const KEYS = { Enter: ['Enter', 13], ' ': ['Space', 32] };
  async function key(k) {
    const [code, vk] = KEYS[k] ?? (/^\d$/.test(k) ? [`Digit${k}`, 48 + Number(k)] : [`Key${k.toUpperCase()}`, k.toUpperCase().charCodeAt(0)]);
    for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(type === 'keyDown' && k.length === 1 ? { text: k } : {}) });
  }
  let targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r => r.json());
  let ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('film: no second DevTools socket'));
  });
  /** A browser of its own for the next case (FRESH, above): the old one closed, a new one launched and opened. */
  const fresh = async () => {
    ws.close();
    await browser.close();
    browser = await launch({ width: 1600, height: 1000 });
    page = await browser.open(base);
    targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r => r.json());
    ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('film: no second DevTools socket'));
    });
    ws.onmessage = onShot;
  };
  let id = 0;
  const cast = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));
  /** A page that does not answer: paused from a socket of its own and its stack said (where it is stuck), then let go. */
  const stackNow = async () => {
    const S = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((res, rej) => ((S.onopen = res), (S.onerror = rej)));
    const got = new Promise(res => {
      S.onmessage = e => {
        const m = JSON.parse(e.data);
        if (m.method === 'Debugger.paused') res(m.params.callFrames.slice(0, 14).map(f => `${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/')}:${f.location.lineNumber + 1}`));
      };
    });
    S.send(JSON.stringify({ id: 1, method: 'Debugger.enable' }));
    S.send(JSON.stringify({ id: 2, method: 'Debugger.pause' }));
    const frames = await Promise.race([got, new Promise(res => setTimeout(() => res(['(no pause in 5 s)']), 5000))]);
    S.send(JSON.stringify({ id: 3, method: 'Debugger.resume' }));
    S.send(JSON.stringify({ id: 4, method: 'Debugger.disable' }));
    setTimeout(() => S.close(), 200);
    return frames;
  };
  let sink = null;
  const onShot = m => {
    const msg = JSON.parse(m.data);
    if (msg.method !== 'Page.screencastFrame') return;
    cast('Page.screencastFrameAck', { sessionId: msg.params.sessionId });
    sink?.(msg.params);
  };
  ws.onmessage = onShot;
  for (const c of cases) {
    if (FRESH && c !== cases[0]) await fresh();
    const dir = path.join(out, c.name.replace(/:/g, '-') + (OLD ? '-old' : '') + (angle ? `-view-${angle.join('-')}` : ''));
    if (!CHECK) mkdirSync(dir, { recursive: true });
    await page.send('Page.navigate', { url: base });
    await page.sleep(1500);
    await page.waitFor('window.__demo && window.__demo.hud && window.__demo.hud.phase === "choose"', 180000);
    await page.sleep(1200);
    if (!(await ev(`window.__demo.hud.load(${JSON.stringify(c.state)})`, 60000))) throw new Error('the page would not load the state');
    await page.waitFor('window.__demo.hud.phase === "choose"', 60000, 100);
    await page.sleep(1500);
    const pickOf = async choice => {
      const v = await ev('window.__demo.hud.view');
      const want = v.choices.find(x => Object.entries(choice).every(([k, val]) => x.choice[k] === val));
      if (!want) throw new Error(`no ${JSON.stringify(choice)} in the page's choices (${JSON.stringify(v.choices.map(x => x.choice)).slice(0, 400)}; at ${v.place ?? v.placeLabel})`);
      return want;
    };
    const take = async want => {
      // (picked, then taken with Enter: the choice is the Enter, and the clock runs from it)
      // (a verb's letter opens its list at its first line: only a card's own number is the choice itself)
      const k = await ev(`window.__demo.hud.keyFor(${JSON.stringify(want.key)})`);
      if (k && /^\d$/.test(k)) await key(k);
      else await ev(`window.__demo.hud.pick(${JSON.stringify(want.key)})`);
      await page.sleep(350);
      await ev('window.__film && (window.__film.pressed = performance.timeOrigin + performance.now())');
      await key('Enter');
    };
    // (the carton bought first, unfilmed: WARM, above)
    if (c.warm !== false) {
      await take(await pickOf(c.warm ?? WARM));
      await page.sleep(1500);
      await page.waitFor('window.__demo.hud.phase === "choose" && !(window.__demo.stage.hands && window.__demo.stage.hands.state.active)', 60000, 100);
      // (and he has walked back to his own spot, when the hour left him off it: the walk off is not waited for by the page)
      await page.sleep(600);
      await page.waitFor('!window.__demo.stage.actors.get("a1").route', 40000, 200).catch(async err => {
        // (what he is doing that never ends: said, then the case goes on from where he is)
        const why = await ev(`(() => { const d = window.__demo.stage, A = d.actors.get('a1'), P = d.director && d.director.people && d.director.people.get('a1'); const R = A.route; return { at: [A.x, A.z].map(v => +v.toFixed(2)), mode: A.mode, clip: A.clipName, goal: R && (R.goal || null), left: R && +(R.len - R.d).toFixed(2), held: R && R.held, blocker: R && R.blocker && (R.blocker.id || String(R.blocker)), P: P && { block: P.block, spot: P.spot, going: !!P.going, busy: P.busy }, room: d.room && d.room.state && { on: d.room.state.on, taken: d.room.state.taken } }; })()`).catch(e => String(e));
        console.log(`  his walk after the warm-up never ended in 40 s (${String(err.message).slice(0, 60)}): ${JSON.stringify(why).slice(0, 600)}`);
        if (/timed out/.test(String(why))) console.log(`  the page is stuck: ${(await stackNow().catch(e => [String(e)])).join(' < ')}`);
      });
      await page.sleep(1000);
    }
    // (`--put x,z`, hands-2: he is put there first, standing, under no cut: for a card of a stop whose shop is far
    // along the block from where the state leaves him (DROP, 26 m round the corner: the walk took the hour's every second
    // and the scene was cut before the lift). What is filmed is the scene, not the walk)
    if (PUT) {
      await ev(`(d => { d.actors.place('a1', ${PUT[0]}, ${PUT[1]}); return true; })(window.__demo.stage)`);
      await page.sleep(800);
    }
    if (angle) await ev(`window.__demo.stage.camera.setAngle({ bearing: ${angle[0]}, down: ${angle[1]}, high: ${angle[2]} })`);
    await page.sleep(600);
    const want = await pickOf(c.choice);
    const frames = [];
    let n = 0;
    sink = p => {
      const file = `f-${String(n).padStart(5, '0')}.jpg`;
      n += 1;
      if (!CHECK) writeFileSync(path.join(dir, file), Buffer.from(p.data, 'base64'));
      frames.push({ file, t: p.metadata.timestamp });
    };
    await ev(`(() => { const F = (window.__film = { frames: [], marks: [], on: true, pressed: null }); let last = performance.now();
      const tick = now => { if (!F.on) return; requestAnimationFrame(tick); F.frames.push(+(now - last).toFixed(2)); last = now;
        const d = window.__demo, h = d.stage.hands ? d.stage.hands.state : { active: false };
        F.marks.push([+(performance.timeOrigin + now).toFixed(1), h.active ? 'fight' : d.hud.phase, h.active ? h.t : null]); };
      requestAnimationFrame(tick); })()`);
    if (!CHECK) cast('Page.startScreencast', { format: 'jpeg', quality: 80, everyNthFrame: 2 });
    await page.sleep(500);
    if (AUDIT) await ev('(window.__demo.stage.actors.audit(true), true)');
    if (c.throwHook) await ev(`(window.__demo.stage.actors.onFrame(() => { throw new Error('a frame hook that throws, on purpose (hand-film throwhook)'); }), true)`);
    await take(want);
    // SKIPPED IN ITS FIRST FRAMES: the page's own Skip, pressed with a real mouse the moment the deal is on
    let skipped = null;
    if (CROSS) {
      await page.waitFor('window.__demo.stage.hands.state.active && window.__demo.stage.room.state.on', 40000, 16);
      const sent = await ev(`(() => {
        const d = window.__demo.stage, R = d.room.state, S = window.__demo.city.peds.sim, P = [0, 0, 0, 0];
        const round0 = R.stats.round ?? 0;
        let best = null;
        for (const w of S.walkers) {
          if (w.hk2 || w.agent || w.gone || w.hide || w.off || w.fix || !w.E || w.dog >= 0 || w.stagePose || w.gore || w.cleaner) continue;
          if (Math.hypot(w.p[0] - R.c[0], w.p[2] - R.c[1]) > 60) continue;
          // (along its own lane from its start: the point nearest the deal's middle)
          for (let s = 0; s < w.E.len; s += 0.3) {
            S.ahead({ E: w.E, s, next: null, lat: w.lat || 0, kx: 0, pE: null }, 0, P);
            const m = Math.hypot(P[0] - R.c[0], P[2] - R.c[1]);
            if (s >= 5 && (!best || m < best.m)) best = { w, s, m };
          }
        }
        if (!best) return { none: true, walkers: S.walkers.length };
        // (NO LANE COMES NEAR THE DEAL: the stage stands a deal off the walkers' lanes, 4.5 m at the market's crowd. Then
        // a ring as the deal's (r 0.9) is opened ON the lane at its nearest point to the deal, in the deal's stead, and
        // the walker is sent across that: the walk-round itself, seen in the page)
        let moved = null;
        if (best.m > R.edge) {
          S.ahead({ E: best.w.E, s: best.s, next: null, lat: best.w.lat || 0, kx: 0, pE: null }, 0, P);
          moved = [+P[0].toFixed(2), +P[2].toFixed(2)];
          window.__crossRing = d.room.open({ c: moved, r: 0.9, keep: ['a1'], quiet: true });
        }
        const R2 = d.room.state;
        const w = best.w;
        w.s = best.s - 5;
        w.halt = false;
        S.ahead({ E: w.E, s: w.s, next: null, lat: w.lat || 0, kx: 0, pE: null }, 0, P);
        w.p[0] = P[0]; w.p[2] = P[2];
        const X = (window.__cross = { id: w.id, c: R2.c, edge: R2.edge, r: R2.r, round0, least: 99, track: [], moved });
        const tick = () => { if (!X.on) return; requestAnimationFrame(tick); const q = w.p; const m = Math.hypot(q[0] - X.c[0], q[2] - X.c[1]); X.least = Math.min(X.least, m); if (X.track.length < 400) X.track.push([+q[0].toFixed(2), +q[2].toFixed(2), w.off ? 1 : 0]); };
        X.on = true; requestAnimationFrame(tick);
        return { id: w.id, lane: +best.m.toFixed(2), edge: +R2.edge.toFixed(2), from: 5, ringOnLane: moved };
      })()`);
      console.log(`  a walker sent across the deal: ${JSON.stringify(sent)}`);
    }
    if (c.name.startsWith('skip')) {
      await page.waitFor('window.__demo.stage.hands.state.active', 40000, 16);
      const r = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => /^\\s*skip/i.test(x.textContent) && x.getClientRects().length); if (!b) return null; const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, t: window.__demo.stage.hands.state.t }; })()`);
      if (!r) throw new Error('no Skip on the page while the deal plays');
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 });
      skipped = { at: Date.now(), dealT: r.t };
    }
    const heads = [];
    const t0 = Date.now();
    let left = false;
    for (;;) {
      const h = await ev(`(() => { const d = window.__demo; return { phase: d.hud.phase, active: !!(d.stage.hands && d.stage.hands.state.active), you: d.stage.screenOf('a1') }; })()`).catch(() => null);
      if (h) {
        heads.push({ at: Date.now() / 1000, you: h.you, st: { phase: h.active ? 'fight' : h.phase }, all: [] });
        if (h.phase !== 'choose' || h.active) left = true;
        if (left && !h.active && ['choose', 'report', 'held'].includes(h.phase) && (skipped || Date.now() - t0 > 900)) break;
      }
      if (Date.now() - t0 > 60000) {
        const dbg = await ev(`(() => { const d = window.__demo; return { phase: d.hud.phase, hands: d.stage.hands ? d.stage.hands.state : 'none' }; })()`).catch(e => String(e));
        throw new Error(`the scene never gave control back: ${JSON.stringify(dbg).slice(0, 400)}; the page said: ${page.logs.slice(-6).join(' | ').slice(0, 900)}`);
      }
      await page.sleep(80);
    }
    if (skipped) skipped.back = (Date.now() - skipped.at) / 1000;
    // (a case with a next choice to see (the dog going home with you): taken as soon as control is back, and filmed)
    if (c.then) {
      await page.sleep(400);
      const p0 = await ev('window.__film.pressed');
      await take(await pickOf(c.then));
      // (the pace is the first choice's: its key kept)
      await ev(`window.__film.pressed = ${p0}`);
      if (c.thenSkip) {
        await page.sleep(300);
        const r = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(x => /^\\s*skip/i.test(x.textContent) && x.getClientRects().length); if (!b) return null; const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; })()`);
        if (r) for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 });
        console.log(`  then Skipped ${r ? 'with the page\'s button' : '(no Skip on the page then)'}`);
      }
      const t1 = Date.now();
      await page.sleep(1500);
      await page.waitFor('window.__demo.hud.phase === "choose"', 60000, 200).catch(() => {});
      console.log(`  then ${JSON.stringify(c.then)}: control back ${((Date.now() - t1) / 1000).toFixed(1)} s after it`);
    }
    // (a sale plays on after control is back, the buyer smoking: filmed, and waited out before anything is checked)
    const tail0 = Date.now();
    await page.waitFor('!(window.__demo.stage.hands && window.__demo.stage.hands.state.tail)', 12000, 100).catch(() => {});
    const tailWall = (Date.now() - tail0) / 1000;
    await page.sleep(700);
    if (!CHECK) cast('Page.stopScreencast');
    sink = null;
    // (asked twice when the page is slow to answer: one check under load timed out here once. Said when it happens)
    const filmJs = '(() => { const F = window.__film; F.on = false; return { frames: F.frames.slice(-3000), marks: F.marks.slice(-3000), pressed: F.pressed }; })()';
    const asked = Date.now();
    const film = await ev(filmJs, 60000).catch(async err => {
      console.log(`  the page did not hand the film back in ${((Date.now() - asked) / 1000).toFixed(1)} s (${String(err.message ?? err).slice(0, 120)}); its stack: ${(await stackNow().catch(e => [String(e)])).join(' < ')}; asking again`);
      return ev(filmJs, 60000);
    });
    if (Date.now() - asked > 5000) console.log(`  the page took ${((Date.now() - asked) / 1000).toFixed(1)} s to hand the film back`);
    const log = await ev('(L => L[L.length - 1] ?? null)(window.__demo.stage.hands ? window.__demo.stage.hands.state.log : [])');
    const note = await ev('(N => N[N.length - 1] ?? null)(window.__demo.stage.debug().notes)').catch(() => null);
    if (note) console.log(`  the hour: ${note.len} s${note.held ? `, held ${note.held} s for its ticker` : ''}; scenes ${JSON.stringify(note.log)} steps ${JSON.stringify(note.steps)}; your walks ${JSON.stringify(note.walks)}`);
    if (CROSS) {
      const X = await ev('(X => X && (X.on = false, window.__crossRing?.close(), { id: X.id, ringOnLane: X.moved, least: +X.least.toFixed(2), edge: +X.edge.toFixed(2), r: +X.r.toFixed(2), takenRound: (window.__demo.stage.room.stats.round ?? 0) - X.round0, whyNot: window.__demo.stage.room.stats.quietWhy, dog: window.__demo.city.peds.sim.walkers.find(w => w.id === X.id)?.dog, offLane: X.track.some(p => p[2]), track: X.track.filter((p, k) => k % 10 === 0) }))(window.__cross)').catch(e => String(e));
      console.log(`  the walker sent across: ${String(JSON.stringify(X ?? null)).slice(0, 1500)}`);
    }
    if (AUDIT) {
      const A = await ev('(A => ({ heads: A.heads, furniture: A.furniture, overlaps: A.overlaps, feet: A.feet, notes: A.examples.filter(e => /^(heads|furniture|overlap|room|feet|meet) /.test(e)).slice(0, 12), spells: (A.spells ?? []).slice(0, 4).map(s => `${s.key} ${s.game.toFixed(2)} s ${(100 * s.max).toFixed(0)}% (${s.how})`) }))(window.__demo.stage.actors.audit())').catch(e => String(e));
      console.log(`  audit: ${JSON.stringify(A, null, 1).slice(0, 4000)}`);
    }
    if (EVAL) console.log(`  eval: ${String(JSON.stringify(await ev(EVAL).catch(e => String(e)))).slice(0, 9000)}`);
    if (angle) await ev('window.__demo.stage.camera.setAngle()');
    // THE PACE: from the key to control back (the first picture after it on which the page waits for the player again)
    const after = film.marks.filter(m => m[0] >= film.pressed);
    const gone = after.findIndex(m => m[1] !== 'choose');
    const back = gone < 0 ? null : after.slice(gone).find(m => ['choose', 'report', 'held'].includes(m[1]));
    const first = after.find(m => m[1] === 'fight');
    const pace = { toBack: back ? +((back[0] - film.pressed) / 1000).toFixed(2) : null, toFirst: first ? +((first[0] - film.pressed) / 1000).toFixed(2) : null, deal: log?.length ?? null, set: log?.set ?? null, tail: log?.tail ?? null, tailWall: +tailWall.toFixed(2) };
    if (!CHECK) writeFileSync(path.join(dir, 'film.json'), `${JSON.stringify({ name: c.name, frames, heads, pageFrames: film.frames, marks: film.marks, trace: [], rec: { ...(log ?? {}), pace }, pressed: film.pressed })}\n`);
    const T0 = frames[0]?.t ?? 0;
    console.log(`${c.name}${OLD ? ' (as it was)' : ''}: ${frames.length} pictures → ${dir}; THE PACE: control back ${pace.toBack} s after the key${log ? `; the deal began ${pace.toFirst} s after it and is ${pace.deal} s long${pace.tail ? ` (and plays on ${pace.tail} s after)` : ''} (${log.set} s standing them first); hand-overs ${JSON.stringify(log.meets)}; faults ${JSON.stringify(log.faults)}${log.joined ? `; joined ${JSON.stringify(log.joined)}` : ''}${log.unseen ? '; WHOEVER SAW WAS NOT SEEN' : ''}${log.out ? `; out again at ${JSON.stringify(log.out)}` : ''}; left ${JSON.stringify(log.ends)}, the one who came ${log.offMark} m off the mark` : ' (no performed deal)'}; in the film the key is at ${(film.pressed / 1000 - T0).toFixed(1)} s`);
    const said = page.logs.filter(l => /performed step|\[stage\] a /.test(l));
    if (said.length) console.log(`  the stage said: ${[...new Set(said)].slice(-4).join(' | ').slice(0, 900)}`);
    // THE MEASURES (--check)
    if (CHECK) {
      const st = await ev('(s => ({ active: s.active, shown: s.shown, bodies: s.bodies }))(window.__demo.stage.hands.state)');
      const F = [];
      const seenWanted = c.name.startsWith('bins:') && c.name.split(':').length > 2;
      if (!log) F.push('no performed deal was played');
      else if (c.name.startsWith('skip')) {
        if (!log.skipped) F.push('the deal played to its end: the Skip did not cut it');
        if (!(skipped.back <= BUDGET.skip)) F.push(`control back ${skipped.back.toFixed(2)} s after the Skip (over ${BUDGET.skip})`);
      } else {
        const dig = log.deal === 'bins';
        if (log.skipped) F.push('the deal was cut short');
        if (log.faults.length) F.push(`faults: ${log.faults.join(' | ')}`);
        for (const m of log.meets) if (!(m.apart <= BUDGET.apart)) F.push(`${m.thing} handed over with the fists ${(m.apart * 100).toFixed(1)} cm apart`);
        const sale = log.deal === 'sell';
        const big = log.deal === 'buyBig';
        const wantMeets = sale ? (log.told.paid === false ? 1 : 2) : big ? 1 : 2;
        if (!dig && ['sell', 'buyBig', 'buy'].includes(log.deal) && log.meets.length !== wantMeets) F.push(`${log.meets.length} hand-overs, not ${wantMeets}`);
        if (sale && !(log.tail <= BUDGET.tail)) F.push(`the buyer goes on ${log.tail} s after control is back (over ${BUDGET.tail})`);
        if (log.lost || !(log.far <= 0.9)) F.push(`a thing lost (${log.lost}) or ${log.far} of a body's size from its holder`);
        const most = dig ? (seenWanted ? BUDGET.digSeen : BUDGET.dig) : sale ? BUDGET.sell : big ? BUDGET.buyBig : BUDGET.deal[log.deal] ?? BUDGET.buy;
        if (!(log.length <= most)) F.push(`the deal is ${log.length} s long (over ${most})`);
        const atBin = c.name.startsWith('dumpster') ? BUDGET.atDumpster : seenWanted ? BUDGET.atBinSeen : BUDGET.atBin;
        if (dig && !(log.set + log.length <= atBin)) F.push(`${(log.set + log.length).toFixed(2)} s at the bin (over ${atBin})`);
        if (c.name.startsWith('dumpster') && !log.out) F.push('he was not brought back out of the alley');
        if (log.out?.inside) F.push('he is left standing in something on his way out');
        // (a purchase made standing by the seller, key to control back; any other, from the deal's first frame)
        if ((c.name === 'buy' || c.name === 'throwhook') && !(pace.toBack <= BUDGET.buyAll)) F.push(`control back ${pace.toBack} s after the key (over ${BUDGET.buyAll})`);
        // (a deal that ends a longer scene, a job's pay, is followed by the scene's own last steps: not timed here)
        if (!dig && c.name !== 'buy' && !c.name.split(':').includes('job') && pace.toFirst !== null && !(pace.toBack - pace.toFirst <= (sale || log.deal === 'sellDisc' ? BUDGET.sell : BUDGET.buyAll) + 0.25)) F.push(`control back ${(pace.toBack - pace.toFirst).toFixed(2)} s after the deal began`);
        if (seenWanted && (log.unseen || !log.ends.neighbour)) F.push('whoever saw was not there to be seen looking');
        for (const [role, e] of Object.entries(log.ends)) {
          if (e.inside) F.push(`${role} is left standing in something`);
          if (!(e.moved <= BUDGET.moved)) F.push(`${role} slid ${e.moved} m while it played`);
        }
        if (!(log.offMark <= BUDGET.offMark)) F.push(`stood ${log.offMark} m off the mark`);
        // (the deal's room, reported: how near anybody not in it came, m past its edge, negative inside it)
        if (log.room) console.log(`  its room: nearest ${log.room.nearest} m, frames with somebody on it ${log.room.on} of ${log.room.frames}, its work ${log.room.msMax} ms at most`);
      }
      if (st.active || st.shown.length || st.bodies) F.push(`left on stage after it: ${JSON.stringify(st)}`);
      console.log(`  ${F.length ? 'FAIL' : 'ok'} ${c.name}${skipped ? `: skipped ${skipped.dealT} s into the deal, control back ${skipped.back.toFixed(2)} s after` : ''}${F.length ? `: ${F.join('; ')}` : ''}`);
      failures.push(...F.map(x => `${c.name}: ${x}`));
    }
    // (and any frame hook of the stage's that threw, said with its error: actors.js catches it now, so a fault that once
    // froze the hour shows here instead. Not the one thrown on purpose: throwhook)
    const hookThrew = page.logs.filter(l => /a frame hook threw|\[room\] (closed|a walker could not)|\[hands\] a deal stopped/.test(l) && !/on purpose/.test(l));
    const bad = [...page.logs.filter(l => l.startsWith('[error]') || l.startsWith('[exception]')), ...said.filter(l => /performed step/.test(l)), ...hookThrew];
    if (bad.length) throw new Error(`page errors: ${[...new Set(bad)].slice(0, 3).join(' | ').slice(0, 700)}`);
  }
  ws.close();
} catch (err) {
  failed = err;
  console.error(String(err?.stack ?? err).slice(0, 900));
} finally {
  await browser.close();
  if (CHECK) console.log(failed || failures.length ? `hand-check FAIL: ${failed ? failed.message : failures.join(' || ')}` : `hand-check ok: ${cases.length} cases (the purchase, the digs, the alley dumpster, the Skip), every measure inside its budget`);
  else console.log(failed ? `film-fail: ${failed.message}` : 'film-ok');
  process.exit(failed || failures.length ? 1 : 0);
}
