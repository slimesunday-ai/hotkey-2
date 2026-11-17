// WHAT YOU SEE OF THE FIGHT ON TOP OF THE CITY: one canvas over the picture, drawn every frame from the world's points
// through the city's own camera. Nothing here is a clip or a model: from the game's camera the figures' big heads
// cover the arms, so the fight is told with bars, numbers, streaks, flashes and the things on the ground.
//
//   bars over every head (you, Cousin Earl, them)   damage numbers that pop off a hit   the loot on the ground, and
//   "+$12" when it is walked over   your ammo and the reload at your feet   the stairs
//   A SHOT (fight-2): a blocky flash at the gun's muzzle (the clip's own muzzle, anim.js), a short tracer that runs
//   from it to where the shot went, and a puff there: a few hard sparks on whoever it hit, grey dust off the ground
//   where it missed. A HIT THE STAB VEST TOOK: a grey-blue puff off the chest and "vest −4" (what it took off). Small,
//   flat squares, in the city's blocky look; no glow.
//
// Every effect is timed on the FIGHT's clock (fx.now), so a paused fight holds its effects still for a picture.
//
// THE LABELS IN THE RUN'S LOOK (join-1): the run's type (its system face, nothing under 12.5 px) and the run's skin's
// colours, read off its tokens (demo/run/skin.css, var(--u-…)) on the page's own frame: one change to the skin changes
// these too. Names on small bone plates with an ink edge and a hard ink block (yellow for you, violet for Earl: the
// run's YOU and people's colours); health bars on an ink-edged track (yours lime, pink when low; Earl's violet; theirs
// pink, the run's risk). Less of it at the moment someone goes down: no DOWN over each of them (the meters count them),
// a pickup said small, beside you. The shots, the flashes and the blood are not labels: as they were.
const FONT = '-apple-system, "SF Pro Text", system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
/** The skin's values, for a page without the run's frame (the lab): skin.css's own. */
const SKIN = { ink: '#17171B', bone: '#F4F1EA', panel: '#E6E1D6', you: '#FFC21A', gain: '#6CFF4A', risk: '#FF4FA3', loss: '#E8232A', lossText: '#b0141a', heat: '#2F5BFF', trust: '#7A3CFF', trustOn: '#FFFFFF', mute: '#585B64' };
const TOKENS = { ink: '--u-ink', bone: '--u-inset', panel: '--u-panel', you: '--u-you', gain: '--u-gain', risk: '--u-risk', loss: '--u-loss', lossText: '--u-loss-text', heat: '--u-heat', trust: '--u-trust', trustOn: '--u-trust-on', mute: '--u-mute' };

/** `skin()`: an element under the run's frame to read the tokens off (panels.js's root), or null (the skin's own values). */
export function createFx({ city, skin = null }) {
  const THREE = city.THREE;
  const cv = document.createElement('canvas');
  cv.className = 'fx-layer';
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '5' });
  document.body.append(cv);
  const g = cv.getContext('2d');
  const V = new THREE.Vector3();
  let dpr = 1;
  // THE SKIN'S COLOURS, read once the frame is up (and again if it was not)
  let C = null;
  function colours() {
    if (C) return C;
    const el = skin?.() ?? null;
    if (!el) return SKIN;
    const cs = getComputedStyle(el);
    const got = Object.fromEntries(Object.entries(TOKENS).map(([k, t]) => [k, cs.getPropertyValue(t).trim() || SKIN[k]]));
    if (cs.getPropertyValue('--u-ink').trim()) C = got;
    return got;
  }
  const pops = [];
  const streaks = [];
  const flashes = [];
  const puffs = [];
  let now = 0;
  /** A few squares thrown out from a point (seeded per puff, so a held picture holds still). */
  function squares(k, age, life, s, colors, size, reach) {
    let seed = k.seed;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const f = age / life;
    for (let j = 0; j < k.n; j++) {
      const a = rnd() * Math.PI * 2;
      const r = reach * (0.35 + 0.65 * rnd()) * Math.sqrt(f);
      const q = Math.round(size * (1 - 0.6 * f));
      if (q < 1) continue;
      g.fillStyle = colors[j % colors.length];
      g.globalAlpha = f > 0.6 ? 1 - (f - 0.6) / 0.4 : 1;
      g.fillRect(Math.round(s[0] + Math.cos(a) * r - q / 2), Math.round(s[1] + Math.sin(a) * r * 0.7 - q / 2 - (k.rise ?? 0) * f), q, q);
    }
    g.globalAlpha = 1;
  }

  /** A world point on the page (CSS px), or null when behind the camera. */
  function scr(x, y, z) {
    V.set(x, y, z).project(city.camera);
    if (V.z > 1) return null;
    return [(V.x * 0.5 + 0.5) * innerWidth, (-V.y * 0.5 + 0.5) * innerHeight];
  }
  function fit() {
    dpr = Math.min(2, devicePixelRatio || 1);
    const [w, h] = [Math.round(innerWidth * dpr), Math.round(innerHeight * dpr)];
    if (cv.width !== w || cv.height !== h) [cv.width, cv.height] = [w, h];
  }

  function text(s, x, y, { size = 16, color = '#fff', weight = 800, align = 'center', outline = 'rgba(10,8,6,0.9)', lw = 4 } = {}) {
    size = Math.max(13, size);
    g.font = `${weight} ${size}px ${FONT}`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = lw;
    g.strokeStyle = outline;
    g.strokeText(s, x, y);
    g.fillStyle = color;
    g.fillText(s, x, y);
  }
  function round(x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /**
   * A LABEL ON A PLATE (the run's: a bone plate, an ink edge, a hard ink block under it): `fill` the plate, `ink` the
   * words. Centred on (x, y). → its width.
   */
  function plate(str, x0, y, { size = 13, fill, ink, weight = 700, right = false } = {}) {
    const K = colours();
    g.font = `${weight} ${size}px ${FONT}`;
    const w = Math.ceil(g.measureText(str).width) + 10;
    const hh = size + 6;
    // (`right`: x is its right edge, not its middle)
    const x = right ? x0 - w / 2 : x0;
    const [bx, by] = [Math.round(x - w / 2), Math.round(y - hh / 2)];
    g.fillStyle = K.ink;
    round(bx + 2, by + 2, w, hh, 4);
    g.fill();
    g.fillStyle = fill ?? K.bone;
    round(bx, by, w, hh, 4);
    g.fill();
    g.strokeStyle = K.ink;
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = ink ?? K.ink;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(str, x, y + 0.5);
    return w;
  }
  /** A health bar under a name: `who` 'you' | 'ally' | 'foe' | 'boss'. */
  function bar(x, y, frac, who, label = null, hp = null) {
    const K = colours();
    const W = who === 'you' ? 64 : who === 'boss' ? 64 : 48;
    const H = who === 'you' ? 8 : 6;
    const [bx, by] = [Math.round(x - W / 2), Math.round(y - H / 2)];
    // (the track: bone, in an ink edge, with the hard block under it)
    g.fillStyle = K.ink;
    g.fillRect(bx - 1 + 2, by - 1 + 2, W + 2, H + 2);
    g.fillRect(bx - 1, by - 1, W + 2, H + 2);
    g.fillStyle = K.bone;
    g.fillRect(bx, by, W, H);
    const low = frac <= 0.35;
    g.fillStyle = who === 'you' ? (low ? K.risk : K.gain) : who === 'ally' ? K.trust : K.risk;
    g.fillRect(bx, by, Math.max(0, Math.round(W * frac)), H);
    if (label) {
      const L = who === 'you' ? { fill: K.you, ink: K.ink } : who === 'ally' ? { fill: K.trust, ink: K.trustOn } : { fill: K.bone, ink: K.ink };
      const ly = by - 13;
      if (hp !== null) {
        // (yours with the number in it: "you 72")
        plate(`${label} ${hp}`, x, ly, { size: 13, weight: 800, ...L });
      } else plate(label, x, ly, { size: 13, ...L });
    }
  }

  return {
    get canvas() {
      return cv;
    },
    set now(t) {
      now = t;
    },
    get now() {
      return now;
    },
    scr,
    /** A number that pops off a head: `kind` 'you' (you were hit), 'them', 'ally', 'gain' (a pickup), 'note'. */
    pop(p, s, kind = 'them') {
      pops.push({ p, s, kind, t0: now, dx: kind === 'gain' ? 34 : (Math.random() - 0.5) * 26 });
      if (pops.length > 60) pops.shift();
    },
    /** A shot: a flash at the muzzle, a tracer to where it went, a puff there (sparks on a body, dust off the ground). */
    shot(from, to, hit, who) {
      streaks.push({ from, to, hit, who, t0: now });
      flashes.push({ p: from, who, t0: now, seed: 1 + Math.floor(Math.random() * 1e6) });
      puffs.push({ p: to, kind: hit ? 'hit' : 'dust', t0: now, seed: 1 + Math.floor(Math.random() * 1e6), n: hit ? 5 : 6 });
      if (streaks.length > 40) streaks.shift();
      if (flashes.length > 40) flashes.shift();
      if (puffs.length > 60) puffs.shift();
    },
    /** A hit the stab vest took a share of (`took`, points): a grey-blue puff off the chest, and the share said. */
    vest(p, took) {
      puffs.push({ p, kind: 'vest', took, t0: now, seed: 1 + Math.floor(Math.random() * 1e6), n: 7, rise: 6 });
      if (puffs.length > 60) puffs.shift();
    },
    clear() {
      pops.length = 0;
      streaks.length = 0;
      flashes.length = 0;
      puffs.length = 0;
    },
    /**
     * Draws one frame. `S`: { people: [{ id, who: 'you'|'ally'|'foe'|'boss', p: [x, y, z], head: y of the bar, frac,
     * name, down }], loot: [{ kind, p, label }], me: { p, ammo: { gun, mag, max, rounds, reload, reloadOf, dry } },
     * exit: { p, near }, outline: [[x, y, z] × 4] }.
     */
    draw(S) {
      fit();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, innerWidth, innerHeight);
      if (!S) return;
      // the arena's corners, faint, so its edges are known
      if (S.outline) {
        g.strokeStyle = colours().bone;
        g.globalAlpha = 0.5;
        g.lineWidth = 2.5;
        g.setLineDash([10, 12]);
        g.beginPath();
        S.outline.forEach((q, k) => {
          const s = scr(...q);
          if (!s) return;
          if (k) g.lineTo(...s);
          else g.moveTo(...s);
        });
        g.closePath();
        g.stroke();
        g.setLineDash([]);
        g.globalAlpha = 1;
      }
      // the stairs: the way out (a ring on the ground and its word on a plate; yours, yellow, once you are near it)
      if (S.exit) {
        const s = scr(...S.exit.p);
        if (s) {
          const K = colours();
          g.globalAlpha = S.exit.near ? 1 : 0.85;
          g.strokeStyle = K.ink;
          g.lineWidth = 5;
          g.beginPath();
          g.ellipse(s[0], s[1], 30, 15, 0, 0, Math.PI * 2);
          g.stroke();
          g.strokeStyle = S.exit.near ? K.you : K.bone;
          g.lineWidth = 2.5;
          g.stroke();
          // (near it, you stand at it with your name over you: its words beside the ring, on its left, not on your name)
          if (S.exit.near) plate(S.exit.nearText ?? 'STAIRS: walk on to leave', s[0] - 36, s[1], { size: 13, weight: 800, fill: K.you, right: true });
          else plate(S.exit.mark ?? 'STAIRS', s[0], s[1] - 28, { size: 13, weight: 800 });
          g.globalAlpha = 1;
        }
      }
      // the loot on the ground
      for (const L of S.loot ?? []) {
        const s = scr(...L.p);
        if (!s) continue;
        const bob = Math.sin(now * 4 + L.p[0] * 3) * 2.5;
        const [x, y] = [s[0], s[1] - 8 + bob];
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath();
        g.ellipse(s[0], s[1] + 2, 12, 5, 0, 0, Math.PI * 2);
        g.fill();
        // (the skin's: cash on lime, rounds on bone with ink rounds in it, a thing a bone disc; ink edges)
        const K = colours();
        if (L.kind === 'cash') {
          g.fillStyle = K.ink;
          round(x - 13 + 2, y - 9 + 2, 26, 18, 4);
          g.fill();
          g.fillStyle = K.gain;
          round(x - 13, y - 9, 26, 18, 4);
          g.fill();
          g.strokeStyle = K.ink;
          g.lineWidth = 1.5;
          g.stroke();
          text('$', x, y + 1, { size: 14, color: K.ink, lw: 0 });
        } else if (L.kind === 'rounds') {
          g.fillStyle = K.ink;
          round(x - 12 + 2, y - 8 + 2, 24, 16, 3);
          g.fill();
          g.fillStyle = K.bone;
          round(x - 12, y - 8, 24, 16, 3);
          g.fill();
          g.strokeStyle = K.ink;
          g.lineWidth = 1.5;
          g.stroke();
          g.fillStyle = K.ink;
          for (let k = -1; k <= 1; k++) g.fillRect(x + k * 6 - 1.5, y - 5, 3, 10);
        } else {
          g.fillStyle = K.bone;
          g.beginPath();
          g.arc(x, y, 10, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = K.ink;
          g.lineWidth = 1.5;
          g.stroke();
          text('?', x, y + 1, { size: 13, color: K.ink, lw: 0 });
        }
      }
      // THE SHOTS, all on the frame the rules fire it (a shot is no slower than the picture): the tracer (from the muzzle
      // to where it went, its tail running in after it over 0.07 s), the flash at the muzzle (a few hard squares,
      // 0.06 s), the puff where it landed (sparks on a body, dust off the ground)
      for (const k of [...streaks]) {
        const age = now - k.t0;
        if (age > 0.1 || age < -0.5) {
          streaks.splice(streaks.indexOf(k), 1);
          continue;
        }
        const [a, b] = [scr(...k.from), scr(...k.to)];
        if (!a || !b) continue;
        const f = Math.min(1, age / 0.07);
        // (the dash: its head at the target from the first frame, its tail running in after it)
        const [h, tl] = [1, 0.25 + 0.75 * f];
        const P = u => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
        g.lineCap = 'butt';
        g.strokeStyle = k.who !== 'foe' ? 'rgba(255,236,150,0.95)' : 'rgba(255,170,120,0.95)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(...P(tl));
        g.lineTo(...P(h));
        g.stroke();
      }
      for (const k of [...flashes]) {
        const age = now - k.t0;
        if (age > 0.06 || age < -0.5) {
          flashes.splice(flashes.indexOf(k), 1);
          continue;
        }
        const s = scr(...k.p);
        if (!s) continue;
        const q = age < 0.03 ? 1 : 0.6;
        // (a blocky star: a white core and four yellow arms, and four short diagonal ones)
        g.fillStyle = '#ffb21f';
        for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.fillRect(Math.round(s[0] + dx * 7 * q - 2), Math.round(s[1] + dy * 7 * q - 2), 4, 4);
        g.fillStyle = '#ffd23f';
        g.fillRect(Math.round(s[0] - 13 * q), Math.round(s[1] - 2.5), Math.round(26 * q), 5);
        g.fillRect(Math.round(s[0] - 2.5), Math.round(s[1] - 13 * q), 5, Math.round(26 * q));
        g.fillStyle = '#fffbe6';
        g.fillRect(Math.round(s[0] - 4), Math.round(s[1] - 4), 8, 8);
      }
      for (const k of [...puffs]) {
        const age = now - k.t0;
        const life = k.kind === 'vest' ? 0.5 : k.kind === 'hit' ? 0.22 : 0.4;
        if (age > life || age < -0.5) {
          if (age > life) puffs.splice(puffs.indexOf(k), 1);
          continue;
        }
        const s = scr(...k.p);
        if (!s || age < 0) continue;
        if (k.kind === 'hit') squares(k, age, life, s, ['#fff4c2', '#ffb347', '#ffffff'], 4, 13);
        else if (k.kind === 'dust') squares(k, age, life, s, ['#c9c2b4', '#a59d8f', '#e3ddd0'], 5, 11);
        else {
          squares(k, age, life, s, ['#b7c4d6', '#8e9db3', '#dfe6ef'], 6, 18);
          if (k.took > 0) {
            g.globalAlpha = age / life > 0.6 ? 1 - (age / life - 0.6) / 0.4 : 1;
            plate(`vest −${k.took}`, s[0] + 34, s[1] - 6 - 14 * (age / life), { size: 13, weight: 800 });
            g.globalAlpha = 1;
          }
        }
      }
      // the bars over the heads (the ones further off first)
      const order = (S.people ?? []).filter(P => !P.down).map(P => ({ P, s: scr(P.p[0], P.head, P.p[2]) })).filter(q => q.s).sort((a, b) => a.s[1] - b.s[1]);
      for (const { P, s } of order) bar(s[0], s[1], P.frac, P.who, P.label, P.who === 'you' ? P.hp : null);
      // your ammo and the reload, at your feet
      const M = S.me;
      if (M?.ammo?.gun) {
        const s = scr(...M.p);
        if (s) {
          const [x, y] = [s[0], s[1] + 22];
          const A = M.ammo;
          const K = colours();
          if (A.reload > 0) {
            const f = 1 - A.reload / A.reloadOf;
            g.strokeStyle = K.ink;
            g.lineWidth = 6;
            g.beginPath();
            g.arc(x, y, 13, 0, Math.PI * 2);
            g.stroke();
            g.strokeStyle = K.you;
            g.lineWidth = 4;
            g.beginPath();
            g.arc(x, y, 13, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
            g.stroke();
            plate('RELOADING', x, y + 28, { size: 13, weight: 800, fill: K.you });
          } else if (A.dry) {
            plate('NO ROUNDS: FISTS', x, y + 6, { size: 13, weight: 800, fill: K.risk });
          } else {
            // (the rounds in it, yours in yellow on an ink strip; the count is the meters')
            const n = A.max;
            const w = Math.min(7, 90 / n);
            const x0 = x - (n * w) / 2;
            g.fillStyle = K.ink;
            round(x0 - 4, y - 8, n * w + 8, 16, 4);
            g.fill();
            for (let k = 0; k < n; k++) {
              g.fillStyle = k < A.mag ? K.you : 'rgba(244,241,234,0.22)';
              g.fillRect(x0 + k * w + 1, y - 5, w - 2, 10);
            }
          }
        }
      }
      // the numbers that pop
      for (const q of [...pops]) {
        const age = now - q.t0;
        const life = q.kind === 'gain' ? 1.5 : 0.95;
        if (age > life || age < -0.5) {
          pops.splice(pops.indexOf(q), 1);
          continue;
        }
        const s = scr(...q.p);
        if (!s) continue;
        const f = age / life;
        const rise = q.kind === 'gain' ? 46 * f : 34 * Math.sqrt(f);
        const size = q.kind === 'gain' ? 16 : q.kind === 'note' ? 13 : q.kind === 'you' ? 22 : 19;
        const scale = age < 0.08 ? 1.35 - age * 4 : 1;
        const K = colours();
        g.globalAlpha = f > 0.7 ? 1 - (f - 0.7) / 0.3 : 1;
        // (a word on a plate: a pickup on lime, a note on bone; a number hit off somebody in the skin's colours, an
        // ink outline round it: off you red, off Earl violet, off them bone)
        if (q.kind === 'gain' || q.kind === 'note') plate(q.s, s[0] + q.dx, s[1] - rise, { size, weight: 800, fill: q.kind === 'gain' ? K.gain : K.bone });
        else text(q.s, s[0] + q.dx * f, s[1] - rise, { size: Math.round(size * scale), color: q.kind === 'you' ? K.loss : q.kind === 'ally' ? K.trust : K.bone, outline: K.ink, lw: 5 });
        g.globalAlpha = 1;
      }
    },
    remove() {
      cv.remove();
    },
  };
}
