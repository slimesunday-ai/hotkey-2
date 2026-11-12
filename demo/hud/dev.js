// The HUD's dev page (demo/hud-dev.html): the HUD over the stand-in stage, plus two harnesses.
//
//   ?selftest=play|watch|coach   plays a whole season on auto through the real controls, checks nothing hidden reached
//                                the screen, and sets document.title to `hud-ok` or `hud-fail: <why>`
//   ?selftest=keys               a whole season in a seat with the keyboard alone
//   ?fit=<seat>                  a played season with the Moves drawer measured at every prompt (demo/tools/hud-fit.mjs)
//   ?time=play|watch             a season at real pace, hours timed (demo/tools/hud-time.mjs)
//   ?mode=play&seat=robber&seed=3   starts a season straight away; with none of these the start screen comes up
//
// Nothing here is part of the product.

import { mountHud } from './index.js';
import { createStubStage } from './stage-stub.js';

const Q = new URLSearchParams(location.search);
const stage = createStubStage(document.getElementById('stage'));
const host = document.getElementById('hud');

const errors = [];
addEventListener('error', e => errors.push(e.message || String(e)));
addEventListener('unhandledrejection', e => errors.push(String(e.reason?.stack ?? e.reason)));
const consoleError = console.error;
console.error = (...args) => {
  errors.push(args.map(a => a?.stack ?? String(a)).join(' '));
  consoleError(...args);
};

const seedOf = fallback => Number(Q.get('seed')) || fallback;
const click = (root, selector) => {
  const node = root.querySelector(selector);
  if (node) node.click();
  return !!node;
};

// ---------------------------------------------------------------------------------------------------------------
// The selftest

function selftest(mode) {
  const seat = Q.get('seat') ?? (mode === 'coach' ? 'robber' : 'dealer');
  const seen = { hours: 0, sheets: 0, picked: 0, carded: 0, said: 0, yes: 0, held: 0, keys: 0, autoRuns: 0, drawers: 0, marks: 0, clear: 1, intro: false, resumed: false, leaks: [] };
  const key = (k, more = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...more }));
  let done = false;
  const finish = why => {
    if (done) return;
    done = true;
    document.title = why ? `hud-fail: ${why}` : 'hud-ok';
    window.__selftest = { ...seen, errors };
  };
  setTimeout(() => finish(`timed out in state ${hud?.state} after ${seen.hours} hours`), 90000);
  const on = (root, selector) => !!root.querySelector(selector);

  /** With every drawer closed, how much of the window is left to the game. Kept as the smallest share seen. */
  const measure = api => {
    api.drawer('left', null);
    api.drawer('right', null);
    seen.clear = Math.min(seen.clear, api.clear());
  };

  const pilot = {
    instant: true,
    // the real night screen: spend every point on the first card that still takes one, and set the coach's levers
    sheet(p, api) {
      seen.sheets += 1;
      for (let i = 0; i < p.sheet.points; i++) click(api.root, '.hk-skill:not([disabled])');
      if (mode === 'coach') {
        click(api.root, `[data-stance="${seen.sheets % 2 ? 'careful' : 'bold'}"]`);
        click(api.root, `[data-focus="${['target', 'avoid', 'none'][seen.sheets % 3]}"]`);
      }
      if (!click(api.root, '[data-act="day"]')) finish('the night screen has no way on');
      return undefined;
    },
    move(view, api) {
      const n = view.clock.t;
      const root = api.root;
      // once, mid-season: save, throw the session away, and carry on from the saved copy
      if (mode === 'play' && !seen.resumed && n === 30) {
        seen.resumed = true;
        const saved = JSON.parse(JSON.stringify(api.session.save()));
        setTimeout(() => api.start({ saved }), 0);
        return undefined;
      }
      if (on(root, '.hk-mark.is-on')) seen.marks += 1;
      if (!view.menu.length) {
        seen.held += 1;
        measure(api);
        // a held hour waits for Continue. Every other one, the player asks for the hours to pass on their own (the
        // card's toggle), and the ones after it in that stay do, a second each
        const hold = root.querySelector('[data-act="hold"]');
        if (!hold) finish('a held hour has no "Let the hours pass" on the card');
        if (!root.querySelector('[data-act="go"]')) finish('a held hour has no Continue on the card');
        if (seen.held % 2) {
          if (/Let/.test(hold.textContent)) hold.click();
          return undefined;
        }
        api.drawer('right', 'offers');
        click(root, '.hk-yes:not([disabled])');
        api.confirm();
        return undefined;
      }
      if (!on(root, '.hk-move[data-entry]')) finish(`hour ${n}: the move card has no move on it`);
      if (n % 5 === 0) measure(api);
      // twice a season: "skip ahead" carries the seat on by itself until something happens to it
      if (n === 7 || n === 40) {
        seen.autoRuns += 1;
        click(root, '[data-act="auto-until"]');
        return undefined;
      }
      // once: the keyboard alone. Space pauses and unpauses, M opens the menu and Esc closes it, a number picks its
      // move, Enter sends it.
      if (n === 13) {
        api.drawer('right', null);
        key(' ');
        const paused = on(root, '[data-act="pause"].is-on');
        key(' ');
        const running = !on(root, '[data-act="pause"].is-on');
        key('m');
        const opened = on(root, '.hk-drawer.is-right.is-on[data-drawer="moves"] .hk-row');
        key('Escape');
        const closed = !on(root, '.hk-drawer.is-right.is-on');
        key('2');
        const picked = root.querySelector('.hk-move.is-on kbd')?.textContent === '2' && on(root, '.hk-card-detail');
        if (!paused || !running || !opened || !closed || !picked) finish(`the keys did not work: paused ${paused}, running ${running}, menu ${opened}, closed ${closed}, picked ${picked}`);
        seen.keys += 1;
        key('Enter');
        const { session } = api;
        setTimeout(() => {
          if (session.game.state.t <= n) finish('Enter did not send the move');
        }, 100);
        return undefined;
      }
      // one hour in three goes through the full menu in its drawer, one through the move card, one to the seat's bot
      if (n % 3 === 0) {
        api.drawer('right', 'moves');
        const rows = api.groups.flatMap(g => g.shown).filter(r => r.n);
        const row = rows[(n / 3) % rows.length];
        api.select(row.entry.id);
        if (!on(root, `.is-on[data-entry="${row.entry.id}"]`) || !on(root, '.hk-card-detail')) finish(`picking ${row.entry.id} from the menu opened nothing`);
        // an offer's terms open into their controls
        if (click(root, '[data-act="terms"]') && !on(root, '.hk-card-detail .hk-fields .hk-field')) finish('"change" opened no controls');
        if (n % 6 === 0) {
          // an offer the HUD put first, or failing that one off the board
          api.drawer('right', 'offers');
          if (!on(root, '.hk-yes:not([disabled])')) click(root, '[data-more="board"]');
          if (click(root, '.hk-yes:not([disabled])')) seen.yes += 1;
        }
        if (n % 9 === 0) {
          click(root, '[data-act="say"]');
          if (click(root, '.hk-say-line')) seen.said += 1;
        }
        // and a drawer on each side, so that every drawer is built some hour
        api.drawer('left', ['you', 'here', 'ahead', 'plate'][(n / 3) % 4]);
        if (!on(root, '.hk-drawer.is-left.is-on .hk-drawer-body > *')) finish('a left drawer opened empty');
        api.drawer('right', ['rank', 'log', 'game'][(n / 3) % 3]);
        if (!on(root, '.hk-drawer.is-right.is-on .hk-drawer-body > *')) finish('a right drawer opened empty');
        seen.drawers += 2;
        seen.picked += 1;
        api.confirm();
        return undefined;
      }
      if (n % 3 === 1) {
        root.querySelector('.hk-move[data-entry]').click();
        if (!click(root, '[data-act="confirm"]')) finish('the move card has no "Do it" once a move is picked');
        seen.carded += 1;
        return undefined;
      }
      return 'auto';
    },
  };

  const hud = mountHud(host, {
    stage, mode, seat, seed: seedOf(4), storage: false, pilot, intro: true,
    onError: err => finish(err?.message ?? String(err)),
    onLine(line, api) {
      if (line.type !== 'hour') return;
      seen.hours += 1;
      // nothing the page prints should ever be an engine leftover
      const junk = /undefined|NaN|\[object/.exec(api.root.textContent);
      if (junk) seen.leaks.push(`t${line.t} the page printed "${junk[0]}"`);
      if (mode !== 'play' && line.t % 12 === 3) measure(api);
      if (mode === 'watch') return;
      // what must never be on a player's or a coach's screen: another seat's confessional
      const text = api.root.textContent;
      for (const [id, a] of Object.entries(line.agents)) {
        if (a.confessional && !(mode === 'coach' && id === api.session.you) && text.includes(a.confessional)) seen.leaks.push(`t${line.t} ${id}`);
      }
    },
    onState(state) {
      // the one-screen explainer comes first for a seat: read it, press Start
      if (state === 'how') {
        seen.intro = true;
        setTimeout(() => click(hud.root, '[data-act="start-game"]'), 0);
      }
      if (state !== 'end' || done) return;
      // the end: ten rows, then the reveal-all and back
      setTimeout(() => {
        const rows = hud.root.querySelectorAll('.hk-end .hk-standings li').length;
        if (errors.length) return finish(errors[0]);
        if (seen.leaks.length) return finish(`something reached the screen that should not have: ${seen.leaks[0]}`);
        if (seen.hours !== 60) return finish(`${seen.hours} hours played, not 60`);
        if (rows !== 10) return finish(`${rows} rows in the final standings`);
        if (seen.clear < 0.7) return finish(`with the drawers closed only ${Math.round(seen.clear * 100)}% of the window was left to the game`);
        if (mode !== 'watch' && !seen.intro) return finish('the explainer never came up');
        if (mode === 'play' && (!seen.resumed || !seen.picked || !seen.carded || !seen.keys || !seen.autoRuns || !seen.marks)) return finish(`the play run missed something: ${JSON.stringify(seen)}`);
        click(hud.root, '[data-act="reveal"]');
        const frame = hud.root.querySelector('.hk-reveal-frame');
        if (!frame || (frame.srcdoc ?? '').length < 5000) return finish('the reveal-all did not build');
        click(hud.root, '[data-act="close"]');
        if (hud.state !== 'end') return finish('the reveal-all did not close');
        finish(errors[0] ?? null);
      }, 50);
    },
  });
  return hud;
}

// ---------------------------------------------------------------------------------------------------------------
// The keyboard alone: a whole season in a seat with nothing but key presses. Enter starts, a number picks a move on
// the card, Enter sends it; at night a number spends a point and Enter starts the day; Enter carries on from a cell.

function keysOnly() {
  const seat = Q.get('seat') ?? 'robber';
  const seen = { hours: 0, sheets: 0, picked: 0, held: 0, intro: false, misses: [] };
  const key = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  let done = false;
  const finish = why => {
    if (done) return;
    done = true;
    document.title = why ? `hud-fail: ${why}` : 'hud-ok';
    window.__selftest = { ...seen, keysOnly: true, errors };
  };
  setTimeout(() => finish(`timed out in state ${hud?.state} after ${seen.hours} hours`), 90000);
  const pilot = {
    instant: true,
    sheet(p) {
      seen.sheets += 1;
      for (let i = 0; i < p.sheet.points; i++) key(String(1 + (i % p.sheet.canBuy.length)));
      key('Enter');
      return undefined;
    },
    move(view, api) {
      if (!view.menu.length) {
        seen.held += 1;
        key('Enter');
        return undefined;
      }
      // the card's moves in turn, so every number on it is pressed some hour
      const n = 1 + (view.clock.t % api.card.length);
      key(String(n));
      if (api.root.querySelector('.hk-move.is-on kbd')?.textContent !== String(n)) seen.misses.push(`hour ${view.clock.t}: ${n} picked nothing`);
      seen.picked += 1;
      key('Enter');
      return undefined;
    },
  };
  const hud = mountHud(host, {
    stage, mode: 'play', seat, seed: seedOf(6), storage: false, pilot, intro: true,
    onError: err => finish(err?.message ?? String(err)),
    onLine(line) {
      if (line.type === 'hour') seen.hours += 1;
    },
    onState(state) {
      if (state === 'how') {
        seen.intro = true;
        setTimeout(() => key('Enter'), 0);
      }
      if (state !== 'end' || done) return;
      setTimeout(() => {
        if (errors.length) return finish(errors[0]);
        if (seen.misses.length) return finish(seen.misses[0]);
        if (seen.hours !== 60) return finish(`${seen.hours} hours played, not 60`);
        if (!seen.intro || seen.sheets !== 5 || seen.picked + seen.held !== 60) return finish(`the keyboard run missed something: ${JSON.stringify(seen)}`);
        finish(null);
      }, 50);
    },
  });
  return hud;
}

// ---------------------------------------------------------------------------------------------------------------
// How long a season takes: a whole one at real pace (at `speed`), hours timed one by one

function timing(mode) {
  const speed = Number(Q.get('speed')) || 4;
  const marks = [performance.now()];
  const nights = [];
  const held = [];
  let heldAt = 0;
  let nightAt = 0;
  const pilot = {
    instant: false,
    sheet(p, api) {
      for (let i = 0; i < p.sheet.points; i++) click(api.root, '.hk-skill:not([disabled])');
      click(api.root, '[data-act="day"]');
    },
    // a free hour is answered at once by the seat's bot; a held hour is left to the HUD's own countdown, which the
    // player asks for once a stay ("Let the hours pass": a held hour waits for Continue until then)
    move(view, api) {
      if (view.menu.length) return 'auto';
      heldAt = performance.now();
      const { session } = api;
      const t = view.clock.t;
      const hold = api.root.querySelector('[data-act="hold"]');
      if (hold && /Let/.test(hold.textContent)) setTimeout(() => api.session === session && session.game.state.t === t && hold.isConnected && hold.click(), 0);
      setTimeout(() => {
        if (api.session === session && session.game.state.t === t) api.confirm();
      }, 6000 / speed);
      return undefined;
    },
  };
  return mountHud(host, {
    stage, mode, seat: Q.get('seat') ?? 'dealer', seed: seedOf(3), storage: false, pilot, speed,
    onError: err => { document.title = `time-fail: ${err?.message ?? err}`; },
    onLine(line) {
      if (line.type !== 'hour') return;
      marks.push(performance.now());
      if (heldAt) held.push((performance.now() - heldAt) * speed / 1000);
      heldAt = 0;
    },
    onState(state) {
      if (state === 'night') nightAt = performance.now();
      else if (nightAt) {
        nights.push(performance.now() - nightAt);
        nightAt = 0;
      }
      if (state !== 'end') return;
      const hours = marks.slice(1).map((t, i) => (t - marks[i]) * speed / 1000);
      const waits = nights.reduce((a, b) => a + b, 0) * speed / 1000;
      const sum = hours.reduce((a, b) => a + b, 0) - waits;
      window.__timing = { mode, speed, hours: hours.length, seasonSecondsAt1x: Math.round(sum), nightSecondsAt1x: Math.round(waits), meanHour: +(sum / hours.length).toFixed(2), longestHour: +Math.max(...hours.map((h, i) => (i % 12 === 0 && i ? 0 : h))).toFixed(2), shortestHour: +Math.min(...hours).toFixed(2),
        heldHours: held.length, meanHeldHour: held.length ? +(held.reduce((a, b) => a + b, 0) / held.length).toFixed(2) : null, longestHeldHour: held.length ? +Math.max(...held).toFixed(2) : null };
      document.title = 'time-done';
    },
  });
}

// ---------------------------------------------------------------------------------------------------------------

function fit(seat) {
  const out = { seat, seed: seedOf(5), size: `${innerWidth}x${innerHeight}`, prompts: 0, overflowed: 0, worst: 0, worstAt: null, tight: [0, 0, 0, 0, 0], errands: 0, held: 0, clear: 1 };
  const pilot = {
    instant: true,
    sheet(p, api) {
      for (let i = 0; i < p.sheet.points; i++) click(api.root, '.hk-skill:not([disabled])');
      click(api.root, '[data-act="day"]');
    },
    move(view, api) {
      if (!view.menu.length) {
        out.held += 1;
        return 'auto';
      }
      api.drawer('right', 'moves');
      const body = api.root.querySelector('.hk-drawer.is-right .hk-drawer-body');
      const over = body.scrollHeight - body.clientHeight;
      out.tight[api.tight] += 1;
      api.drawer('right', null);
      out.clear = Math.min(out.clear, api.clear());
      out.prompts += 1;
      out.errands += view.pickups.length;
      if (over > 1) {
        out.overflowed += 1;
        if (over > out.worst) Object.assign(out, { worst: over, worstAt: `day ${view.clock.day}, ${view.clock.hour}:00 (${view.pickups.length} pick-ups, ${view.offers.length} offers, ${view.menu.length} menu lines)` });
      }
      return 'auto';
    },
  };
  return mountHud(host, {
    stage, mode: 'play', seat, seed: out.seed, storage: false, pilot,
    onError: err => { document.title = `fit-fail: ${err?.message ?? err}`; },
    onState(state) {
      if (state !== 'end') return;
      window.__fit = out;
      document.title = 'fit-done';
    },
  });
}

if (Q.get('fit')) window.hud = fit(Q.get('fit'));
else if (Q.get('time')) window.hud = timing(Q.get('time'));
else if (Q.get('selftest') === 'keys') window.hud = keysOnly();
else if (Q.get('selftest')) window.hud = selftest(Q.get('selftest'));
else window.hud = mountHud(host, { stage, ...(Q.get('mode') ? { mode: Q.get('mode'), seat: Q.get('seat') ?? 'dealer' } : {}), ...(Q.get('seed') ? { seed: Number(Q.get('seed')) } : {}) });
