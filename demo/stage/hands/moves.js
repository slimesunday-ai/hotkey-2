// HANDING THINGS OVER (anim-1). The owner: "i bought a carton and we dont see the item hand over, and every transaction
// with someone looks like rocks paper scissors shoot". A transaction here is staged from DATA: who has what, who gives
// it to whom with which hand, where it ends up. Each verb below is a small move with its own timing (anticipation, the
// reach, the moment, the settle), written as the path of a hand and what the body does behind it; the arms are solved
// to it (the fight's own rig arithmetic, demo/fight/puppet/rig.js). Nothing ever floats: every thing is, at every
// moment, in exactly one holder (a hand, a pocket, a store, a bin), and when it changes hands the two fists are at one
// point of the world at that moment, whatever the two bodies' sizes.
//
//   const S = stageHands({ people: { you: { x, z, yaw, scale }, earl: { ... } }, things: { cash: { kind: 'cash', in: 'you:pocket' }, ... }, cam: [cx, cz] })
//   S.ask('you', 'earl') · S.answer('earl', 'you', 'yes' | 'no') · S.fetch('earl', 'carton', 'R') · S.give('you', 'earl', 'cash')
//   S.pocket('earl', 'cash') · S.look('you', 'carton') · S.tuck('you', 'carton') · S.holdUp('you', 'find') · S.wipe('you')
//   S.nod(who) · S.leanIn / S.rummage / S.comeUp (the bins) · S.watch / S.lookOver / S.turnAway (who saw)
//   S.wait(seconds) · S.also(() => { … })   (what is written inside starts with the move before it, not after)
//   const T = S.done()   → { t1, people, things, at(t) → { bodies: { id: { P, x, y, z, yaw, scale } }, things: { id: { holder, at, dir, up, show } } },
//                           gives: [{ t, thing, from, to }], faults: [] }
//
// PEOPLE DIFFER (the named cast is drawn at its own scale, 0.90 to 1.25): a body's `scale` multiplies everything of
// its rig. A hand's place is told in the world and solved in the body's own unit rig, so a small buyer and a big
// seller meet at the point both can reach (meetOf), and where they cannot, they lean in until they can.
//
// THE RIG'S LIMITS that shape these: an arm reaches 0.44 m (× scale) and folds no shorter than 0.31, so a hand never
// goes to a chest pocket (too near its own shoulder): pockets are at the hip. The head is a metre wide over
// shoulders half a metre apart, and the game's camera looks 64 degrees down: a hand in front of the chest is UNDER
// the head and unseen. What is seen: a hand out past the head's edge, and whatever is in the gap between two heads.
// So two who deal stand SIDE BY SIDE facing the camera with 0.44 m between their heads (perform.js), each
// one's `offer` is its own edge of that gap, they sway in to meet in its middle, and a held thing is drawn pointing
// at the camera, out in front of the heads (things.js).
import { pose0, fk, armTo, chestTarget, toWorld, toBody, RIG } from '../../fight/puppet/rig.js';
import { E, track } from '../../fight/puppet/plan.js';
import { boxOf, offOf } from './things.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
/** A fist hanging at the side (chest frame, the R one; the L mirrored), and each named place a hand can go on its own body. */
const REST = [0.34, 0.4, 0.02];
const PLACES = {
  rest: REST,
  // the hip pocket, on the hand's own side: far enough out that what goes into it is beside the hip, not in it
  pocket: [0.3, 0.52, 0.12],
  // held out beside the head, to look at
  chest: [0.58, 0.72, 0.2],
  // out to its own side, palm up: an ask, an offer. BESIDE the head (the head is a metre wide and covers a hand in
  // front of the chest from above) and BELOW it: what is held here points forward under the head's edge
  offer: [0.56, 0.68, 0.2],
  // behind the hip: where a seller's goods come from (his truck, his bag: the thing appears in the hand there)
  store: [0.36, 0.5, -0.2],
  // held up beside the head, to show it
  high: [0.63, 1.0, 0.1],
  // flat on the thigh (a wipe)
  thigh: [0.24, 0.42, 0.12],
  // against the hip on the hand's own side: where a thing bought is carried in, and put away
  side: [0.37, 0.5, 0.08],
  // empty hands turned up, out to the sides
  empty: [0.52, 0.7, 0.2],
  // thrown out wide at shoulder height, as far as the arm goes: seen past both edges of the head from above
  wide: [0.66, 0.84, 0.06],
  // (stage 2 of anim-1) UNDER THE CHIN, a hand's width off the middle: as near the mouth as an arm of 0.44 m gets (the
  // mouth is on the front of a head a metre wide, 0.6 m from the shoulder). What goes to the mouth goes from here
  chin: [0.1, 0.94, 0.37],
  // just under the head's lower edge in front: where a thing is taken from the mouth or brought up to it (at the chin
  // itself, in a big man's fist it was in his face). The thing goes between here and the lips by itself
  take: [0.12, 0.84, 0.4],
  // the lighter held up under it, a little out in front and below the head, the flame at the cigarette
  light: [0.1, 0.84, 0.4],
};
/** The mouth on the head's own frame (the head at rest: its box x ±0.5, y 0.9 to 1.7, its face at z 0.45). */
const MOUTH = [0, 1.06, 0.43];
/** How far a cigarette in the mouth hangs down from straight out (rad). */
const DROOP = 0.3;
/** Seconds over which a thing passed from a hand to the mouth (or back) moves between the two. */
const BLEND = 0.12;
/** Where a thing put away is, by how it is held then (a place of PLACES, on the side of the hand that put it there). */
const AWAY = { tucked: 'side', store: 'store', pocket: 'pocket' };
/** Seconds a thing handed over takes to cross from the far side of the giver's fist to the far side of the taker's. */
const FLIP = 0.12;
/** How far under the smaller one's head two hands meet (m): lower, a big man leans in a long way to reach down to it and the heads close up; higher, what is handed over is in that head. The tests hold both. */
const MEET_UNDER = 0.14;
/** How much of the way the head goes round to a thing in its own hand: the thing is beside a head a metre wide, and turned to it squarely the head's corner is in it. */
const GLANCE = 0.3;
/** How far a fist reaches from its shoulder and how near it folds (m, unit rig; a little inside the rig's own). */
const REACH = 0.425;
const NEAR = 0.315;
const SIDE = { L: -1, R: 1 };
/** (hands-2) Where a thing to wear is taken to be put on (chest frame, the R hand's), how far the body bends to it, the chin, a shrug (putOn). */
const WEAR_AT = {
  hat: { at: [0.5, 1.08, 0.14], nod: -0.08 },
  eyewear: { at: [0.14, 0.86, 0.42], nod: -0.04 },
  top: { at: [0.3, 0.74, 0.3], nod: 0.18, shrug: true },
  bottom: { at: [0.36, 0.48, 0.16], nod: 0.22, bend: 0.25 },
  shoes: { at: [0.3, 0.38, 0.2], nod: 0.24, bend: 0.5 },
  acc: { at: [0.37, 0.5, 0.08], nod: 0.14 },
};

export function stageHands({ people, things = {}, cam = null, t0 = 0 }) {
  /** each person: where they stand, their size, and their tracks */
  const who = {};
  for (const [id, p] of Object.entries(people)) {
    who[id] = {
      id, x: p.x, y: p.y ?? 0, z: p.z, yaw: p.yaw, s: p.scale ?? 1,
      tx: track(0), ty: track(0), tz: track(0), hx: track(0), hy: track(0), hz: track(0), drop: track(0), bx: track(0),
      // (hands-2: where the whole body has been pushed to from where it was stood, in the world (m): a shove that lands)
      rx: track(0), rz: track(0),
      // the head turned to a point of the world, by a share
      gaze: track(0), gazeAt: [],
      hands: { L: [{ t0: -9, t1: -9, to: { c: 'rest' }, ease: E.s }], R: [{ t0: -9, t1: -9, to: { c: 'rest' }, ease: E.s }] },
      ph: Object.keys(who).length * 1.7,
      turn: 1.15, nodMax: 0.6, cap: 9,
      // (the last moment anything of this body is written to move: a deal's `back` is when its player is done)
      until: t0,
    };
  }
  const held = {};
  for (const [id, T] of Object.entries(things)) {
    const [w, where] = String(T.in).split(':');
    // (`lit`, `glow`, `burn`: a cigarette's, lit, drawn on, smoked down; nothing else uses them)
    held[id] = { id, kind: T.kind, holds: [{ t: -9, who: w, where, side: T.side ?? null }], at: T.at ?? null, lit: track(0), glow: track(0), burn: track(0) };
  }
  const gives = [];
  /** (hands-2) the moments a thing to wear is put on: { t, who, slot } (putOn) */
  const dresses = [];
  /** (hands-2) a shout heard round about: { t, who, at } (shoveOff; perform.js has whoever is near look) */
  const shouts = [];
  const faults = [];
  /** what is drawn that nobody holds: smoke breathed out, a lighter's flame ({ kind, t, life, who | on }) */
  const fx = [];
  /** when the deal is over for whoever it lets go first (`back`), and who that is */
  let back = null;
  /** written: what is asked of it from now on is final (what is worked out once may be kept) */
  let sealed = false;
  let now = t0;
  let last = t0;
  /** the hand of `id` on the side `other` stands on: two who deal stand side by side, and things pass between them */
  const innerOf = (id, other) => {
    const [P, T] = [who[id], who[other]];
    return Math.cos(P.yaw) * (T.x - P.x) - Math.sin(P.yaw) * (T.z - P.z) >= 0 ? 'R' : 'L';
  };
  /** whoever `id` deals with: the one other person, when there is one near */
  const partnerOf = id => Object.keys(who).find(k => k !== id && Math.hypot(who[k].x - who[id].x, who[k].z - who[id].z) < 2.2) ?? null;
  // (two heads a metre wide with half a metre between them: turned or nodded further, their corners meet)
  for (const P of Object.values(who)) if (partnerOf(P.id)) [P.turn, P.nodMax, P.cap] = [0.2, 0.24, (0.9 * who[partnerOf(P.id)].s - 0.19) / P.s];
  /** the camera's side of the ground, for which hand is the one seen */
  const camOf = P => (cam ? Math.cos(P.yaw) * (cam[0] - P.x) - Math.sin(P.yaw) * (cam[1] - P.z) >= 0 ? 'R' : 'L' : 'R');

  // ── a body's pose at t, without its hands: what the hands are then solved on ──
  function bodyAt(P, t) {
    const Q = pose0();
    const br = Math.sin((TAU * (t + P.ph)) / 3.4);
    Q.tx = P.tx.at(t) + 0.012 * br;
    Q.ty = P.ty.at(t);
    Q.tz = P.tz.at(t);
    Q.hx = P.hx.at(t);
    Q.hy = P.hy.at(t);
    Q.hz = P.hz.at(t);
    Q.drop = P.drop.at(t);
    Q.bx = P.bx.at(t);
    return Q;
  }
  /** (hands-2) The moment the world is asked about (poseAt, headOf, at): a body pushed off its place is where it is then. */
  let clockT = t0;
  /** A world point in a body's own unit rig. */
  const unitOf = (P, w) => {
    const b = toBody(w, P.x + P.rx.at(clockT), P.y, P.z + P.rz.at(clockT), P.yaw);
    return [b[0] / P.s, b[1] / P.s, b[2] / P.s];
  };
  /** A unit-rig body point in the world. */
  const worldOf = (P, b) => toWorld([b[0] * P.s, b[1] * P.s, b[2] * P.s], P.x + P.rx.at(clockT), P.y, P.z + P.rz.at(clockT), P.yaw);
  /** The same at a moment of its own (a hand on somebody who moves, asked of the deal at another moment than the pose's). */
  const worldAt = (P, b, t) => toWorld([b[0] * P.s, b[1] * P.s, b[2] * P.s], P.x + P.rx.at(t), P.y, P.z + P.rz.at(t), P.yaw);
  /** A hand target → the chest's frame of pose Q. `{ c: name | [x, y, z] }` the body's own place (told for the R hand), `{ w }` a world point. */
  function targetIn(P, Q, side, to, t = now) {
    // (`w` a function of the time: a hand on something that moves, a big piece slid along the ground)
    if (to.w) return chestTarget(Q, unitOf(P, typeof to.w === 'function' ? to.w(t) : to.w));
    const c = typeof to.c === 'string' ? PLACES[to.c] : to.c;
    // (HELD OUT BESIDE SOMEBODY SMALLER, no higher than under their head: a big seller's held-out hand is at the
    // height of a small buyer's chin, and what is in it reaches toward them)
    return [c[0] * SIDE[side], c[2] > 0.1 && c[0] > 0.45 ? Math.min(c[1], P.cap) : c[1], c[2]];
  }
  /** A hand's place at t (chest frame of Q): its moves in the order of their starts, each from wherever the hand was when it began. */
  function handAt(P, Q, side, t) {
    const segs = P.hands[side];
    let k = 0;
    for (let i = 0; i < segs.length; i++) if (segs[i].t0 <= t) k = i;
    const value = (i, at) => {
      const s = segs[i];
      const to = targetIn(P, Q, side, s.to, at);
      // (`stick`: ON something that moves, all the way: the move before it brought the hand there)
      if (i === 0 || at >= s.t1 || s.stick) return to;
      const from = value(i - 1, s.t0);
      const u = s.ease(Math.max(0, at - s.t0) / Math.max(1e-6, s.t1 - s.t0));
      // (a hand does not go through the body between two places: it bows a little out in front)
      const m = mix3(from, to, u);
      m[2] += 0.07 * Math.sin(Math.PI * u) * (s.bow ?? 1);
      return m;
    };
    return value(k, t);
  }
  function poseAt(P, t) {
    const keep = clockT;
    clockT = t;
    try {
      return poseAt0(P, t);
    } finally {
      clockT = keep;
    }
  }
  function poseAt0(P, t) {
    const Q = bodyAt(P, t);
    // THE HEAD to what it is looking at (a share of the way: the chest is not turned for it)
    const g = P.gaze.at(t);
    if (g > 0.001) {
      let at = null;
      for (const G of P.gazeAt) if (G.t <= t) at = G.at;
      if (at) {
        const c = chestTarget(Q, unitOf(P, typeof at === 'function' ? at(t) : at));
        const d = [c[0], c[1] - 1.3, c[2]];
        // (two heads a metre wide, side by side with a hand's width between them: turned further, their corners meet)
        Q.hy += clamp(Math.atan2(d[0], Math.max(0.05, d[2])), -P.turn, P.turn) * g;
        Q.hx += clamp(Math.atan2(-d[1], Math.hypot(d[0], d[2])), -0.3, P.nodMax) * g;
      }
    }
    Q.hL = handAt(P, Q, 'L', t);
    Q.hR = handAt(P, Q, 'R', t);
    Q.pL = [-1, -0.6, -0.25];
    Q.pR = [1, -0.6, -0.25];
    const a = armTo(Q.hL, -1, Q.pL, 2.1);
    const b = armTo(Q.hR, 1, Q.pR, 2.1);
    for (let i = 0; i < 5; i++) {
      Q.aL[i] = a[i];
      Q.aR[i] = b[i];
    }
    return Q;
  }
  const go = (id, side, a, b, to, ease = E.s, bow = 1, stick = false) => {
    const segs = who[id].hands[side];
    // (a move that starts before one already written takes its place: a hand coming back to rest that is sent
    // somewhere else first never goes back)
    while (segs.length > 1 && segs[segs.length - 1].t0 >= a) segs.pop();
    segs.push({ t0: a, t1: b, to, ease, bow, stick });
    last = Math.max(last, b);
    who[id].until = Math.max(who[id].until, b);
  };
  const body = (id, key, a, b, v, ease = E.s) => {
    who[id][key].to(a, b, v, ease);
    last = Math.max(last, b);
    who[id].until = Math.max(who[id].until, b);
  };
  const lookAt = (id, a, b, at, share = 1) => {
    who[id].gazeAt.push({ t: a, at });
    who[id].gaze.to(a, a + 0.22, share, E.s);
    who[id].gaze.to(b, b + 0.25, 0, E.s);
    last = Math.max(last, b + 0.25);
  };
  const holder = (thing, t) => {
    let h = held[thing].holds[0];
    for (const x of held[thing].holds) if (x.t <= t) h = x;
    return h;
  };
  /**
   * `side`: which hand put it away (a pocket, a tuck: it is on that side of the body, and stays there). `extra`: for a
   * thing nobody holds, `path(t)` → { at, dir } (on the ground, in the air) and whether it is drawn (`show`).
   */
  const hold = (thing, t, w, where, side = null, extra = null) => {
    held[thing].holds.push({ t, who: w, where, side, ...(extra ?? {}) });
    last = Math.max(last, t);
  };
  /** which hand of `id` has `thing` at t, or null */
  const handOf = (id, thing, t) => {
    const h = holder(thing, t);
    return h.who === id && (h.where === 'L' || h.where === 'R') ? h.where : null;
  };
  /** the hand of `id` that is free at t (the one the camera sees first) */
  const freeHand = (id, t, want = null) => {
    const busy = new Set(Object.keys(held).map(k => handOf(id, k, t)).filter(Boolean));
    const mate = partnerOf(id);
    const first = want ?? (mate ? innerOf(id, mate) : camOf(who[id]));
    return !busy.has(first) ? first : first === 'L' ? 'R' : 'L';
  };

  /**
   * WHERE TWO HANDS MEET: the point of the world both fists can be at, and how far each body has to lean and turn its
   * giving shoulder forward to reach it. The least lean that does it; sizes as they are.
   */
  function meetOf(a, sa, b, sb) {
    const [A, B] = [who[a], who[b]];
    // (which way each one's own roll and sway bring its shoulder toward the other: asked of the rig, not assumed)
    // (THE TALLER ONE STOOPS to the other: down by most of the difference between their shoulders. Standing
    // straight, a big man reached a long way down to a small one's level and had to lean in until their heads met)
    const stoop = (P, T) => clamp((0.6 * 0.825 * (P.s - T.s)) / P.s, 0, 0.16);
    const shoulder = (P, side, k, sg, drop = 0) => {
      const Q = pose0();
      Q.drop = drop;
      // (the chest is NOT rolled toward the other: the head is on it, a metre wide, and went into the other's head.
      // The arm does the reaching; what little more it takes is the hips swayed over, the whole body a hand's width)
      Q.tz = 0;
      Q.bx = sg * 0.012 * k;
      Q.tx = 0;
      // (THE HEAD STAYS LEVEL: the sway leans the whole body over its feet, the head with it, and at the top of a
      // lean the corner of a metre of head was in the other's: seen in the low film, 2026-11-18. The head is rolled
      // back by the lean, whichever way the rig's roll goes: asked of it)
      const leanOf = hz => {
        Q.hz = hz;
        const g = fk(Q);
        return Math.atan2(g.crown[0] - g.headC[0], g.crown[1] - g.headC[1]);
      };
      const lean = leanOf(0);
      const hz = Math.abs(leanOf(-lean)) <= Math.abs(leanOf(lean)) ? -lean : lean;
      Q.hz = hz;
      const f = fk(Q);
      return { w: worldOf(P, side === 'L' ? f.shL : f.shR), tz: Q.tz, bx: Q.bx, tx: Q.tx, hz, drop };
    };
    const toward = (P, side, T) => {
      const t = [T.x, P.y + 0.8 * P.s, T.z];
      return dist(shoulder(P, side, 6, 1).w, t) <= dist(shoulder(P, side, 6, -1).w, t) ? 1 : -1;
    };
    const [ga, gb] = [toward(A, sa, B), toward(B, sb, A)];
    let last = null;
    for (let k = 0; k <= 12; k++) {
      const [pa, pb] = [shoulder(A, sa, k, ga, stoop(A, B)), shoulder(B, sb, k, gb, stoop(B, A))];
      const [ra, rb] = [REACH * A.s, REACH * B.s];
      const d = dist(pa.w, pb.w);
      const M = mix3(pa.w, pb.w, ra / (ra + rb));
      // THE HEIGHT FIRST: under the shoulders' line (hands meet at the ribs), and under the SMALLER one's head by
      // the height of what is held (a small buyer beside a big seller had the money pass through the bottom of his
      // own head on its way up to a point between their shoulders)
      M[1] = Math.min(M[1] - 0.12 * Math.min(A.s, B.s), Math.max(A.y, B.y) + 0.9 * Math.min(A.s, B.s) - MEET_UNDER);
      // THEN ALONG the level line between the shoulders, by what each arm has left over at that height: a big man
      // reaching down to a small one's level has less of his arm left to reach across
      const [la, lb] = [Math.sqrt(Math.max(0.0004, ra * ra - (M[1] - pa.w[1]) ** 2)), Math.sqrt(Math.max(0.0004, rb * rb - (M[1] - pb.w[1]) ** 2))];
      M[0] = pa.w[0] + ((pb.w[0] - pa.w[0]) * la) / (la + lb);
      M[2] = pa.w[2] + ((pb.w[2] - pa.w[2]) * la) / (la + lb);
      last = { M, a: pa, b: pb, d };
      if (dist(M, pa.w) <= ra && dist(M, pb.w) <= rb && dist(M, pa.w) >= NEAR * A.s && dist(M, pb.w) >= NEAR * B.s) return { ...last, ok: true };
    }
    return { ...last, ok: false };
  }

  /** The way `id` faces in a deal (beside somebody: the way the two face, between their headings), level: [x, z]. */
  const facingOf = id => {
    const P = who[id];
    const mate = partnerOf(id);
    const y = mate ? P.yaw + wrap(who[mate].yaw - P.yaw) / 2 : P.yaw;
    return [Math.sin(y), Math.cos(y)];
  };
  /** A thing's drawn size as it stands: [across, up, deep] (m). */
  const dimsOf = thing => {
    const b = boxOf(held[thing].kind);
    return [b[1] - b[0], b[3] - b[2], b[5] - b[4]];
  };
  /** Where a thing on the ground (a big piece) is at t: its middle. */
  const pieceAt = (thing, t) => {
    const h = holder(thing, t);
    return h.path ? h.path(t).at : null;
  };
  /** The near edge of a big piece's top, toward `id`, at t: where a hand goes on it. */
  const topNear = (thing, id, t) => {
    const c = pieceAt(thing, t);
    const P = who[id];
    const [w, h, d] = dimsOf(thing);
    const [dx, dz] = [P.x - c[0], P.z - c[2]];
    const n = Math.hypot(dx, dz) || 1;
    // (a piece as high as the chest is taken by its near side, at the chest, not reached up to over the top)
    const tall = h > 0.75 * P.s;
    const k = Math.min(w, d) * (tall ? 0.5 : 0.3);
    return [c[0] + (dx / n) * k, Math.min(c[1] + h / 2 + 0.03, P.y + 0.75 * P.s), c[2] + (dz / n) * k];
  };
  /** How far `id` bends to put a hand on a big piece (the chest's pitch): none to a tall one (bent, the head went into it). */
  const bendTo = (thing, id) => {
    const P = who[id];
    const [, h] = dimsOf(thing);
    return 0.34 * clamp((0.78 * P.s - h) / (0.3 * P.s), 0, 1);
  };
  /**
   * A BIG PIECE SLID ROUND A BODY on the ground: its middle at `r` from the body's own, at angle `th` from the side
   * `out` (a level direction) toward the way the body faces (+π/2 in front, −π/2 behind). How far out a piece goes
   * round somebody: clear of the legs, and of the head (a metre wide) when it is tall enough to reach it.
   */
  const round = (P, out, f, th, r) => [P.x + r * (Math.cos(th) * out[0] + Math.sin(th) * f[0]), P.z + r * (Math.cos(th) * out[1] + Math.sin(th) * f[1])];
  const clearOf = (P, thing) => {
    const [w, h, d] = dimsOf(thing);
    // (the head's corner, turned a little as heads are, is 0.67 of a size from the middle)
    return (h > 0.85 * P.s ? 0.74 : 0.3) * P.s + Math.hypot(w, d) / 2;
  };

  const api = {
    get t() {
      return now;
    },
    wait(s) {
      now = Math.max(t0, now + s);
      last = Math.max(last, now);
      return api;
    },
    /** What is written inside starts `back` s before now (overlap: two things at once), and does not hold up what follows. */
    also(fn, back = null) {
      const keep = now;
      if (back !== null) now = Math.max(t0, now - back);
      fn();
      now = keep;
      return api;
    },
    /** The hand of `id` on the side away from `other`. */
    outerHand(id, other) {
      return innerOf(id, other) === 'L' ? 'R' : 'L';
    },
    /** The hand of `id` on the side away from the camera. */
    farHand(id) {
      return camOf(who[id]) === 'L' ? 'R' : 'L';
    },
    // ── TALK: an ask is one open hand and the chin; an answer is the head. No fists pumped at anybody. ──
    ask(id, to, side = null) {
      const P = who[id];
      const h = freeHand(id, now, side);
      go(id, h, now, now + 0.26, { c: 'offer' }, E.out);
      go(id, h, now + 0.5, now + 0.82, { c: 'rest' }, E.s);
      body(id, 'tx', now, now + 0.25, 0.06, E.out);
      body(id, 'tx', now + 0.5, now + 0.8, 0, E.s);
      body(id, 'hx', now, now + 0.16, -0.12, E.out);
      body(id, 'hx', now + 0.2, now + 0.42, 0.06, E.s);
      body(id, 'hx', now + 0.5, now + 0.7, 0, E.s);
      lookAt(id, now, now + 0.6, () => api.headOf(to));
      void P;
      now += 0.42;
      return api;
    },
    answer(id, to, how = 'yes') {
      lookAt(id, now, now + 0.5, () => api.headOf(to));
      if (how === 'yes') {
        // a nod: down, and up a little past level
        // (a nod with the head turned to somebody beside you carries it toward them: no deeper than the gap has room for)
        body(id, 'hx', now + 0.04, now + 0.18, Math.min(0.3, who[id].nodMax), E.out);
        body(id, 'hx', now + 0.2, now + 0.4, -0.04, E.s);
        body(id, 'hx', now + 0.42, now + 0.55, 0, E.s);
      } else {
        // no: the head goes one way, the other, and stays turned off; a hand comes up flat between them
        const h = freeHand(id, now);
        body(id, 'hy', now + 0.04, now + 0.2, 0.34, E.out);
        body(id, 'hy', now + 0.22, now + 0.42, -0.34, E.s);
        body(id, 'hy', now + 0.44, now + 0.62, 0.18, E.s);
        body(id, 'hy', now + 0.9, now + 1.1, 0, E.s);
        go(id, h, now + 0.05, now + 0.3, { c: [0.16, 0.8, 0.36] }, E.out);
        go(id, h, now + 0.75, now + 1.05, { c: 'rest' }, E.s);
        body(id, 'tx', now + 0.05, now + 0.3, -0.06, E.out);
        body(id, 'tx', now + 0.8, now + 1.05, 0, E.s);
      }
      now += how === 'yes' ? 0.3 : 0.7;
      return api;
    },
    nod(id) {
      body(id, 'hx', now, now + 0.14, Math.min(0.24, who[id].nodMax - 0.03), E.out);
      body(id, 'hx', now + 0.16, now + 0.36, 0, E.s);
      now += 0.3;
      return api;
    },
    // ── A THING INTO A HAND from where it is kept (a pocket, a seller's store): the hand goes there, comes back with it ──
    fetch(id, thing, side = null, shown = 'offer') {
      const h0 = holder(thing, now);
      const h = side ?? freeHand(id, now);
      const from = h0.where === 'store' ? 'store' : 'pocket';
      // (it was on this hand's side all along: the pocket the hand goes into)
      h0.side ??= h;
      go(id, h, now, now + 0.2, { c: from }, E.s, 0.4);
      hold(thing, now + 0.2, id, h);
      go(id, h, now + 0.24, now + 0.46, { c: shown }, E.out);
      lookAt(id, now + 0.15, now + 0.5, () => api.thingAt(thing), GLANCE);
      now += 0.46;
      return api;
    },
    // ── THE HAND-OVER: both hands to one point of the world; it changes hands there; both come away ──
    give(a, b, thing, { to = null, lead = 0.3, away = 0.26 } = {}) {
      const sa = handOf(a, thing, now);
      if (!sa) {
        faults.push(`${a} gives ${thing} at ${now.toFixed(2)} without it in a hand`);
        return api;
      }
      const sb = to ?? freeHand(b, now);
      const m = meetOf(a, sa, b, sb);
      if (!m.ok) faults.push(`${a} and ${b} stand too far apart to hand ${thing} over (their shoulders ${m.d.toFixed(2)} m apart)`);
      const tm = now + lead;
      // the giver goes first and holds it out; the taker's hand comes to it a beat later and closes on it
      for (const [id, side, L, start] of [[a, sa, m.a, now], [b, sb, m.b, now + 0.07]]) {
        body(id, 'tx', start, tm, L.tx, E.s);
        body(id, 'tz', start, tm, L.tz, E.s);
        body(id, 'bx', start, tm, L.bx, E.s);
        body(id, 'hz', start, tm, L.hz, E.s);
        if (L.drop) body(id, 'drop', start, tm, L.drop, E.s);
        go(id, side, start, tm, { w: m.M }, E.s, 0.3);
        // (a glance down at it, hardly a turn: turned to it, the two heads' near corners met over the hands)
        lookAt(id, start, tm + 0.1, m.M, 0.45);
      }
      hold(thing, tm, b, sb);
      gives.push({ t: tm, thing, from: a, to: b, hands: [sa, sb], at: m.M });
      // a moment on it together, then apart: the taker draws it in, the giver's hand opens and falls
      const t2 = tm + 0.09;
      for (const [id, side, where] of [[a, sa, 'rest'], [b, sb, 'offer']]) {
        go(id, side, t2, t2 + away, { c: where }, E.s);
        body(id, 'tx', t2, t2 + away + 0.1, 0, E.s);
        body(id, 'tz', t2, t2 + away + 0.1, 0, E.s);
        body(id, 'bx', t2, t2 + away + 0.1, 0, E.s);
        body(id, 'hz', t2, t2 + away + 0.1, 0, E.s);
        body(id, 'drop', t2, t2 + away + 0.1, 0, E.s);
      }
      now = t2 + away * 0.6;
      return api;
    },
    /** Into the hip pocket, and the hand out again empty. */
    pocket(id, thing) {
      const h = handOf(id, thing, now);
      if (!h) return api;
      go(id, h, now, now + 0.24, { c: 'pocket' }, E.s, 0.5);
      hold(thing, now + 0.24, id, 'pocket', h);
      go(id, h, now + 0.34, now + 0.56, { c: 'rest' }, E.s, 0.3);
      body(id, 'hx', now, now + 0.2, 0.16, E.s);
      body(id, 'hx', now + 0.3, now + 0.5, 0, E.s);
      now += 0.42;
      return api;
    },
    /** Held up in front of the chest and looked at. */
    look(id, thing, s = 0.45) {
      const h = handOf(id, thing, now);
      if (!h) return api;
      go(id, h, now, now + 0.2, { c: 'chest' }, E.s);
      lookAt(id, now, now + s, () => api.thingAt(thing), GLANCE);
      // (turned over once in the hand: the wrist is the body's roll for a beat)
      body(id, 'tz', now + 0.12, now + 0.3, SIDE[h] * 0.05, E.s);
      body(id, 'tz', now + s - 0.1, now + s + 0.1, 0, E.s);
      now += s;
      return api;
    },
    /**
     * Put away at the side: the hand that has it brings it in against its own hip, the way an arm goes (down and in,
     * outside the body all the way), and it is gone from there. (It was carried across the chest to the other arm:
     * through the body, and out of the far side of it. The owner, 2026-11-18.)
     */
    tuck(id, thing) {
      const h = handOf(id, thing, now);
      if (!h) return api;
      go(id, h, now, now + 0.26, { c: 'side' }, E.s, 0.3);
      hold(thing, now + 0.26, id, 'tucked', h);
      go(id, h, now + 0.32, now + 0.5, { c: 'rest' }, E.s, 0.2);
      body(id, 'hx', now, now + 0.2, 0.14, E.s);
      body(id, 'hx', now + 0.3, now + 0.5, 0, E.s);
      now += 0.4;
      return api;
    },
    /** Held up high and shown. */
    holdUp(id, thing, s = 0.7) {
      const h = handOf(id, thing, now);
      if (!h) return api;
      go(id, h, now, now + 0.24, { c: 'high' }, E.out);
      body(id, 'tx', now, now + 0.22, -0.1, E.out);
      body(id, 'drop', now + 0.02, now + 0.14, 0.03, E.s);
      body(id, 'drop', now + 0.14, now + 0.3, -0.01, E.out);
      body(id, 'drop', now + 0.3, now + 0.5, 0, E.s);
      lookAt(id, now, now + s, () => api.thingAt(thing), GLANCE);
      // (a small shake of it: got one)
      go(id, h, now + 0.3, now + 0.4, { c: [0.63, 1.05, 0.1] }, E.s, 0);
      go(id, h, now + 0.4, now + 0.5, { c: 'high' }, E.s, 0);
      go(id, h, now + s, now + s + 0.3, { c: 'offer' }, E.s, 0.3);
      body(id, 'tx', now + s, now + s + 0.3, 0, E.s);
      now += s + 0.2;
      return api;
    },
    /**
     * Nothing: both arms thrown out wide, empty, and the head shaken at it (from above that is the whole of it: the
     * arms past both edges of the head, and the head going one way and the other); then the hands wiped down the
     * trousers, twice, the shoulders let fall.
     */
    wipe(id) {
      for (const h of ['L', 'R']) {
        go(id, h, now, now + 0.18, { c: 'wide' }, E.out);
        go(id, h, now + 0.5, now + 0.68, { c: 'thigh' }, E.s);
        go(id, h, now + 0.68, now + 0.8, { c: [0.25, 0.34, 0.1] }, E.s, 0);
        go(id, h, now + 0.8, now + 0.9, { c: 'thigh' }, E.s, 0);
        go(id, h, now + 0.9, now + 1.02, { c: [0.25, 0.34, 0.1] }, E.s, 0);
        go(id, h, now + 1.04, now + 1.2, { c: 'rest' }, E.s, 0.2);
      }
      body(id, 'tx', now, now + 0.16, -0.08, E.out);
      body(id, 'hy', now + 0.1, now + 0.22, 0.36, E.s);
      body(id, 'hy', now + 0.22, now + 0.38, -0.36, E.s);
      body(id, 'hy', now + 0.38, now + 0.5, 0.2, E.s);
      body(id, 'hy', now + 0.5, now + 0.62, 0, E.s);
      body(id, 'hx', now + 0.5, now + 0.7, 0.26, E.s);
      body(id, 'tx', now + 0.5, now + 0.7, 0.14, E.s);
      body(id, 'drop', now + 0.5, now + 0.7, 0.03, E.s);
      body(id, 'hx', now + 0.98, now + 1.18, 0, E.s);
      body(id, 'tx', now + 0.98, now + 1.2, 0, E.s);
      body(id, 'drop', now + 0.98, now + 1.2, 0, E.s);
      now += 1.12;
      return api;
    },
    // ── THE BINS. `rim`: a point of the world on the bin's near edge, at its top; `inside`: one down in it. ──
    leanIn(id, rim, inside, { s = 0.5 } = {}) {
      const P = who[id];
      // which way along the rim is the body's own R: the hands go a hand's width either side of the point
      const [rx, rz] = [Math.cos(P.yaw), -Math.sin(P.yaw)];
      const at = side => [rim[0] + rx * 0.2 * P.s * SIDE[side], rim[1], rim[2] + rz * 0.2 * P.s * SIDE[side]];
      P.bin = { rim, inside, at };
      // both hands to the rim, the weight after them; then the head and the shoulders over and in
      go(id, 'L', now, now + 0.24, { w: at('L') }, E.out);
      go(id, 'R', now + 0.05, now + 0.3, { w: at('R') }, E.out);
      body(id, 'tx', now + 0.05, now + s, 0.62, E.s);
      body(id, 'drop', now + 0.1, now + s, 0.05, E.s);
      body(id, 'hx', now + 0.15, now + s, 0.42, E.s);
      now += s;
      return api;
    },
    /** One arm down in it, working; the other takes the weight on the rim; the body shifts after the arm. `n` strokes. */
    rummage(id, { n = 3, s = 0.46 } = {}) {
      const P = who[id];
      const B = P.bin;
      const [rx, rz] = [Math.cos(P.yaw), -Math.sin(P.yaw)];
      for (let k = 0; k < n; k++) {
        const side = k % 2 ? 'L' : 'R';
        const other = side === 'L' ? 'R' : 'L';
        const sw = (k % 2 ? -1 : 1) * 0.16 * P.s;
        const deep = [B.inside[0] + rx * sw, B.inside[1] - 0.05 * (k % 3) * P.s, B.inside[2] + rz * sw];
        const a = now + k * s;
        go(id, other, a, a + 0.16, { w: B.at(other) }, E.s, 0.3);
        go(id, side, a + 0.04, a + s * 0.55, { w: deep }, E.s, 0.2);
        go(id, side, a + s * 0.6, a + s * 0.95, { w: [deep[0] - rx * sw * 1.6, deep[1] + 0.06 * P.s, deep[2] - rz * sw * 1.6] }, E.s, 0);
        // the shoulders go after the working arm, the hips the other way, the head with the hand
        body(id, 'ty', a, a + s * 0.6, -SIDE[side] * 0.36, E.s);
        body(id, 'bx', a, a + s * 0.6, -SIDE[side] * 0.06, E.s);
        // (down after the hand, and half up between strokes: the back is seen working from above)
        body(id, 'tx', a, a + s * 0.5, 0.78 + 0.06 * (k % 2), E.s);
        body(id, 'tx', a + s * 0.55, a + s * 0.95, 0.56, E.s);
        body(id, 'hy', a, a + s * 0.6, SIDE[side] * 0.34, E.s);
      }
      now += n * s;
      return api;
    },
    /** Up out of it: `thing` (in the bin till now) comes up in the hand, or the hands come up with nothing. */
    comeUp(id, thing = null) {
      const P = who[id];
      const h = camOf(P);
      const o = h === 'L' ? 'R' : 'L';
      // (in the hand once the hand is out from under his own bowed head: drawn sooner, it stuck through it)
      if (thing) hold(thing, now + 0.4, id, h);
      body(id, 'tx', now, now + 0.42, 0.05, E.s);
      body(id, 'ty', now, now + 0.4, 0, E.s);
      body(id, 'bx', now, now + 0.4, 0, E.s);
      body(id, 'drop', now, now + 0.4, 0, E.s);
      body(id, 'hx', now, now + 0.4, thing ? 0.25 : 0.1, E.s);
      body(id, 'hy', now, now + 0.3, 0, E.s);
      go(id, h, now + 0.02, now + 0.42, { c: thing ? 'offer' : 'empty' }, E.s, 1.4);
      go(id, o, now + 0.1, now + 0.46, { c: thing ? 'rest' : 'empty' }, E.s);
      void P;
      now += 0.44;
      return api;
    },
    /** A few coins looked at in the palm (the thing is already in the hand). */
    count(id, thing, s = 0.5) {
      const h = handOf(id, thing, now) ?? 'R';
      go(id, h, now, now + 0.16, { c: 'offer' }, E.s, 0);
      lookAt(id, now, now + s, () => api.thingAt(thing), GLANCE);
      // (weighed in the palm: up a little and down, twice)
      go(id, h, now + 0.18, now + 0.27, { c: [0.56, 0.73, 0.2] }, E.s, 0);
      go(id, h, now + 0.27, now + 0.36, { c: 'offer' }, E.s, 0);
      go(id, h, now + 0.36, now + 0.43, { c: [0.56, 0.72, 0.2] }, E.s, 0);
      go(id, h, now + 0.43, now + 0.5, { c: 'offer' }, E.s, 0);
      now += s;
      return api;
    },
    // ── WHO SAW. ──
    /** `id` watches `whom`: the head and a share of the chest round to them, the arms folded low. */
    watch(id, whom, s = 1.2) {
      const P = who[id];
      const T = who[whom];
      const b = clamp(wrap(Math.atan2(T.x - P.x, T.z - P.z) - P.yaw), -1.5, 1.5);
      body(id, 'ty', now, now + 0.35, b * 0.45, E.s);
      body(id, 'hy', now, now + 0.28, clamp(b * 0.55, -1, 1), E.s);
      body(id, 'hx', now + 0.1, now + 0.4, 0.1, E.s);
      go(id, 'L', now + 0.1, now + 0.42, { c: [0.1, 0.62, 0.3] }, E.s);
      go(id, 'R', now + 0.14, now + 0.46, { c: [0.1, 0.56, 0.32] }, E.s);
      P.watching = b;
      now += s;
      return api;
    },
    /** `id` turns away from what they watched: a shake of the head first (`cold`), or at once and a hand to the neck (`away`: they saw nothing). */
    turnAway(id, how = 'cold') {
      const P = who[id];
      const b = P.watching ?? 0;
      const off = -Math.sign(b || 1);
      if (how === 'cold') {
        body(id, 'hy', now, now + 0.14, clamp(b * 0.55, -1, 1) + 0.2, E.s);
        body(id, 'hy', now + 0.14, now + 0.3, clamp(b * 0.55, -1, 1) - 0.2, E.s);
        now += 0.32;
      }
      body(id, 'ty', now, now + 0.42, off * 0.5, E.s);
      body(id, 'hy', now, now + 0.3, off * 0.7, E.s);
      body(id, 'hx', now, now + 0.3, how === 'cold' ? -0.08 : 0.12, E.s);
      go(id, 'L', now, now + 0.3, { c: 'rest' }, E.s);
      if (how === 'away') {
        // (looking anywhere else: a hand up to the back of the neck)
        go(id, 'R', now + 0.05, now + 0.4, { c: [0.3, 1.02, -0.02] }, E.s);
        go(id, 'R', now + 0.95, now + 1.25, { c: 'rest' }, E.s);
      } else go(id, 'R', now, now + 0.3, { c: 'rest' }, E.s);
      now += 0.5;
      return api;
    },
    /** `id` looks over the shoulder at `whom`: the head first, the shoulders after; and back. */
    lookOver(id, whom, s = 0.6) {
      const P = who[id];
      const T = who[whom];
      const b = wrap(Math.atan2(T.x - P.x, T.z - P.z) - P.yaw);
      body(id, 'hy', now, now + 0.16, clamp(b, -1.15, 1.15), E.out);
      body(id, 'ty', now + 0.06, now + 0.3, clamp(b * 0.4, -0.7, 0.7), E.s);
      body(id, 'hx', now, now + 0.16, -0.06, E.s);
      body(id, 'hy', now + s, now + s + 0.25, 0, E.s);
      body(id, 'ty', now + s, now + s + 0.3, 0, E.s);
      body(id, 'hx', now + s, now + s + 0.25, 0.14, E.s);
      body(id, 'hx', now + s + 0.3, now + s + 0.55, 0, E.s);
      now += s + 0.2;
      return api;
    },
    /** Everything let go: hands to the sides, the body straight. */
    settle(id, s = 0.3) {
      for (const h of ['L', 'R']) if (!Object.keys(held).some(k => handOf(id, k, now) === h)) go(id, h, now, now + s, { c: 'rest' }, E.s, 0.3);
      for (const k of ['tx', 'ty', 'tz', 'hx', 'hy', 'hz', 'drop', 'bx']) body(id, k, now, now + s, 0, E.s);
      return api;
    },
    // ── A SALE (stage 2 of anim-1): what is bought is USED, and seen used ──
    /** Up to the mouth with the hand that has it, and left there; the hand comes down. */
    mouth(id, thing, { s = 0.34 } = {}) {
      const h = handOf(id, thing, now);
      if (!h) return api;
      go(id, h, now, now + 0.2, { c: 'take' }, E.s, 0.6);
      hold(thing, now + 0.2, id, 'mouth', h);
      go(id, h, now + 0.24, now + 0.46, { c: 'rest' }, E.s, 0.3);
      // (the chin comes up to meet it)
      body(id, 'hx', now + 0.04, now + 0.2, -0.05, E.s);
      body(id, 'hx', now + 0.26, now + 0.42, 0, E.s);
      now += s;
      return api;
    },
    /** The hand on `to`'s side held out, palm up, with a twitch of the fingers: pay up. */
    holdOut(id, to, s = 0.42) {
      const h = freeHand(id, now, innerOf(id, to));
      go(id, h, now, now + 0.2, { c: 'offer' }, E.out);
      go(id, h, now + 0.24, now + 0.31, { c: [0.56, 0.74, 0.2] }, E.s, 0);
      go(id, h, now + 0.31, now + 0.38, { c: 'offer' }, E.s, 0);
      lookAt(id, now, now + s, () => api.headOf(to), 1);
      now += s;
      return api;
    },
    /** A lighter out of the pocket and up under the chin, a flame; the thing in the mouth is lit, and the lighter goes back. */
    light(id, thing, lighter, { s = 0.9 } = {}) {
      const h = freeHand(id, now, held[thing].holds[held[thing].holds.length - 1].side ?? null);
      // (the head straight on the shoulders for it: turned on them, a corner of it is where the hand comes up)
      body(id, 'hy', now, now + 0.2, 0, E.s);
      go(id, h, now, now + 0.18, { c: 'pocket' }, E.s, 0.4);
      hold(lighter, now + 0.18, id, h);
      go(id, h, now + 0.22, now + 0.44, { c: 'light' }, E.out, 0.6);
      body(id, 'hx', now + 0.26, now + 0.44, 0.08, E.s);
      fx.push({ kind: 'flame', t: now + 0.42, life: 0.34, on: lighter });
      held[thing].lit.to(now + 0.56, now + 0.58, 1, E.lin);
      held[thing].glow.to(now + 0.56, now + 0.66, 1, E.s);
      held[thing].glow.to(now + 0.72, now + 0.95, 0.3, E.s);
      // (the first pull, the chin up; out with it)
      body(id, 'hx', now + 0.58, now + 0.74, -0.08, E.s);
      go(id, h, now + 0.66, now + 0.86, { c: 'pocket' }, E.s, 0.5);
      hold(lighter, now + 0.86, id, 'pocket', h);
      go(id, h, now + 0.9, now + 1.1, { c: 'rest' }, E.s, 0.3);
      fx.push({ kind: 'puff', t: now + 0.8, life: 1.3, who: id, n: 2 });
      body(id, 'hx', now + 0.8, now + 0.96, 0, E.s);
      now += s;
      return api;
    },
    /** Drawn on: the chin up a touch, the end glowing and burning down; then breathed out, a cloud from the mouth. */
    drag(id, thing, { s = 0.82, by = 0.3 } = {}) {
      body(id, 'hx', now, now + 0.22, -0.1, E.s);
      body(id, 'tx', now, now + 0.22, -0.04, E.s);
      held[thing].glow.to(now, now + 0.18, 1, E.s);
      held[thing].burn.to(now, now + 0.3, Math.min(1, held[thing].burn.at(now) + by), E.s);
      held[thing].glow.to(now + 0.3, now + 0.55, 0.3, E.s);
      body(id, 'hx', now + 0.32, now + 0.5, 0.05, E.s);
      body(id, 'tx', now + 0.32, now + 0.5, 0, E.s);
      fx.push({ kind: 'puff', t: now + 0.34, life: 1.5, who: id, n: 3 });
      body(id, 'hx', now + 0.62, now + 0.8, 0, E.s);
      now += s;
      return api;
    },
    /** Out of the mouth and flicked away: over in an arc to the ground, out to the side; it lies there glowing, and goes out. */
    flick(id, thing) {
      const P = who[id];
      // (with the hand away from whoever is beside him: it goes out that way, not at them)
      const mate = partnerOf(id);
      const h = freeHand(id, now, mate ? api.outerHand(id, mate) : null);
      body(id, 'hy', now, now + 0.2, 0, E.s);
      go(id, h, now, now + 0.2, { c: 'take' }, E.s, 0.6);
      hold(thing, now + 0.2, id, h);
      go(id, h, now + 0.24, now + 0.44, { c: 'offer' }, E.s, 0.4);
      // (the flick: a snap of the wrist out and forward)
      go(id, h, now + 0.44, now + 0.52, { c: [0.6, 0.75, 0.3] }, E.out, 0);
      const tf = now + 0.5;
      // (where it leaves the hand, asked of the deal as written: and it lands further out the same way, and forward)
      const X0 = api.at(tf).things[thing];
      const [ox, oz] = [X0.fist[0] - P.x, X0.fist[2] - P.z];
      const n = Math.hypot(ox, oz) || 1;
      const o = [ox / n, oz / n];
      const f = facingOf(id);
      const land = [X0.at[0] + o[0] * 0.8 + f[0] * 0.35, P.y + 0.025, X0.at[2] + o[1] * 0.8 + f[1] * 0.35];
      const fly = 0.42;
      const flat = [o[0], 0, o[1]];
      hold(thing, tf, 'air', 'flick', null, {
        path: t => {
          const k = clamp((t - tf) / fly, 0, 1);
          const a = 7 * k;
          return { at: [X0.at[0] + (land[0] - X0.at[0]) * k, X0.at[1] + (land[1] - X0.at[1]) * k + 0.4 * 4 * k * (1 - k), X0.at[2] + (land[2] - X0.at[2]) * k], dir: [X0.dir[0] * Math.cos(a) + flat[0] * Math.sin(a) * 0.3, -Math.sin(a), X0.dir[2] * Math.cos(a) + flat[2] * Math.sin(a) * 0.3] };
        },
      });
      const lying = () => ({ at: land, dir: flat });
      hold(thing, tf + fly, 'ground', 'butt', null, { path: lying });
      held[thing].glow.to(tf + fly, tf + fly + 0.6, 0, E.s);
      hold(thing, tf + fly + 0.7, 'ground', 'out', null, { path: lying, show: false });
      go(id, h, now + 0.56, now + 0.8, { c: 'rest' }, E.s, 0.3);
      lookAt(id, tf, tf + 0.5, land, 0.4);
      now += 0.6;
      return api;
    },
    /** Turned away from `from`: the shoulders and the head, and kept so. */
    snub(id, from) {
      const away = innerOf(id, from) === 'R' ? -1 : 1;
      body(id, 'ty', now, now + 0.35, away * 0.45, E.s);
      body(id, 'hy', now, now + 0.3, away * 0.4, E.s);
      body(id, 'hx', now + 0.05, now + 0.3, -0.05, E.s);
      now += 0.4;
      return api;
    },
    /** Both hands thrown up and out, empty, the head back and shaken: well, that's that. */
    throwUp(id) {
      for (const h of ['L', 'R']) {
        go(id, h, now, now + 0.2, { c: 'wide' }, E.out);
        go(id, h, now + 0.62, now + 0.85, { c: 'rest' }, E.s, 0.2);
      }
      body(id, 'tx', now, now + 0.18, -0.08, E.out);
      body(id, 'hx', now, now + 0.18, -0.12, E.out);
      body(id, 'hy', now + 0.18, now + 0.32, 0.16, E.s);
      body(id, 'hy', now + 0.32, now + 0.46, -0.16, E.s);
      body(id, 'hy', now + 0.46, now + 0.6, 0, E.s);
      body(id, 'tx', now + 0.6, now + 0.8, 0, E.s);
      body(id, 'hx', now + 0.6, now + 0.8, 0, E.s);
      now += 0.62;
      return api;
    },
    /** The deal is over for these (the player): from when the last of their moves is done, they are let go, and it plays on for the rest. */
    back(...ids) {
      back = { t: Math.max(now, ...ids.map(id => who[id].until)), who: ids };
      return api;
    },

    // ── A PIECE TOO BIG FOR A HAND (stage 2 of anim-1): it never leaves the ground ──
    /**
     * `id` brings it out: the outer hand back to the store, and the piece slid out from behind that hip (out of the
     * picture under the head, from the game's camera), round the outer side and in front, and pushed on to stand in
     * front of the gap between the two, where every camera sees it whole.
     */
    bringOut(id, thing, to, { s = 0.88 } = {}) {
      const [P, Q] = [who[id], who[to]];
      const [, h, d] = dimsOf(thing);
      const f = facingOf(id);
      const L = Math.hypot(Q.x - P.x, Q.z - P.z) || 1;
      const out = [(P.x - Q.x) / L, (P.z - Q.z) / L];
      const R = clearOf(P, thing);
      const fwd = (h > 0.85 * Math.min(P.s, Q.s) ? 0.58 : 0.44) * Math.min(P.s, Q.s) + d / 2;
      const G = [(P.x + Q.x) / 2 + f[0] * fwd, (P.z + Q.z) / 2 + f[1] * fwd];
      const [th0, th1] = [-1.2, Math.PI / 2];
      const front = round(P, out, f, th1, R);
      const arc = R * (th1 - th0);
      const total = arc + Math.hypot(G[0] - front[0], G[1] - front[1]);
      const a = now + 0.2;
      const e = a + s;
      const along = t => E.s((t - a) / (e - a)) * total;
      const path = t => {
        const q = along(t);
        const xz = q <= arc ? round(P, out, f, th0 + q / R, R) : [front[0] + ((G[0] - front[0]) * (q - arc)) / (total - arc), front[1] + ((G[1] - front[1]) * (q - arc)) / (total - arc)];
        return { at: [xz[0], P.y + h / 2, xz[1]], dir: [f[0], 0, f[1]] };
      };
      // (when it is round in front of him: he lets it go there, pushed, and it slides on to its place)
      let tPush = a;
      while (tPush < e && along(tPush) < arc) tPush += 1 / 120;
      const ho = api.outerHand(id, to);
      go(id, ho, now, a, { c: 'store' }, E.s, 0.4);
      hold(thing, a, 'ground', 'slide', null, { path });
      go(id, ho, a, a + 0.08, { w: t => topNear(thing, id, t) }, E.s, 0);
      go(id, ho, a + 0.08, tPush, { w: t => topNear(thing, id, t) }, E.lin, 0, true);
      go(id, ho, tPush, tPush + 0.28, { c: 'rest' }, E.s, 0.3);
      // (bent to it while the hand is on it: the hips back, the shoulders over)
      const bend = bendTo(thing, id);
      body(id, 'tx', now, a + 0.1, bend, E.s);
      body(id, 'drop', now, a + 0.1, bend * 0.15, E.s);
      body(id, 'tx', tPush, tPush + 0.24, 0, E.s);
      body(id, 'drop', tPush, tPush + 0.24, 0, E.s);
      lookAt(id, a, tPush, t => pieceAt(thing, t ?? a) ?? G, 0.5);
      now = e;
      return api;
    },
    /** Patted twice by `id`, the near hand: shown, or said to be yours. */
    pat(id, thing, to) {
      const h = innerOf(id, to);
      const on = () => topNear(thing, id, now);
      const t0 = now;
      go(id, h, t0, t0 + 0.2, { w: on }, E.s, 0.3);
      go(id, h, t0 + 0.2, t0 + 0.28, { w: () => { const p = topNear(thing, id, t0); return [p[0], p[1] + 0.07, p[2]]; } }, E.s, 0);
      go(id, h, t0 + 0.28, t0 + 0.36, { w: on }, E.s, 0);
      go(id, h, t0 + 0.4, t0 + 0.62, { c: 'rest' }, E.s, 0.3);
      body(id, 'tx', t0, t0 + 0.2, bendTo(thing, id) * 0.8, E.s);
      body(id, 'drop', t0, t0 + 0.2, bendTo(thing, id) * 0.12, E.s);
      body(id, 'tx', t0 + 0.38, t0 + 0.6, 0, E.s);
      body(id, 'drop', t0 + 0.38, t0 + 0.6, 0, E.s);
      now += 0.4;
      return api;
    },
    /**
     * `id` takes it: the near hand onto it and drawing it over in front of him, the other hand taking it from there
     * round his outer side and behind him, and it is put away there (as the carton is put away at the hip).
     */
    claim(id, thing, { s = 0.92 } = {}) {
      const P = who[id];
      const mate = partnerOf(id);
      const f = facingOf(id);
      const c0 = pieceAt(thing, now);
      const L = mate ? Math.hypot(P.x - who[mate].x, P.z - who[mate].z) || 1 : 1;
      const out = mate ? [(P.x - who[mate].x) / L, (P.z - who[mate].z) / L] : [Math.cos(P.yaw), -Math.sin(P.yaw)];
      const rel = [c0[0] - P.x, c0[2] - P.z];
      const th0 = Math.atan2(rel[0] * f[0] + rel[1] * f[1], rel[0] * out[0] + rel[1] * out[1]);
      const r0 = Math.hypot(...rel);
      const [th1, r1] = [-1.2, clearOf(P, thing)];
      const a = now + 0.26;
      const e = a + s;
      const at = t => {
        const k = E.s((t - a) / (e - a));
        const th = th0 + (th1 - th0) * k;
        const xz = round(P, out, f, th, r0 + (r1 - r0) * k);
        return { at: [xz[0], c0[1], xz[1]], dir: [f[0], 0, f[1]], th };
      };
      // (the near hand has it to his front, the other hand from there)
      let tSwap = a;
      while (tSwap < e && at(tSwap).th > Math.PI / 2 - 0.15) tSwap += 1 / 120;
      const hi = mate ? innerOf(id, mate) : 'R';
      const ho = hi === 'L' ? 'R' : 'L';
      go(id, hi, now, a, { w: () => topNear(thing, id, a) }, E.s, 0.3);
      hold(thing, a, 'ground', 'slide', null, { path: at });
      go(id, hi, a, tSwap, { w: t => topNear(thing, id, t) }, E.lin, 0, true);
      go(id, hi, tSwap + 0.04, tSwap + 0.3, { c: 'rest' }, E.s, 0.3);
      go(id, ho, tSwap - 0.22, tSwap, { w: () => topNear(thing, id, tSwap) }, E.s, 0.3);
      go(id, ho, tSwap, e, { w: t => topNear(thing, id, t) }, E.lin, 0, true);
      go(id, ho, e + 0.04, e + 0.3, { c: 'rest' }, E.s, 0.3);
      const end = at(e);
      hold(thing, e, 'ground', 'stowed', null, { path: () => end, show: false });
      const bend = bendTo(thing, id);
      body(id, 'tx', now, a, bend * 0.9, E.s);
      body(id, 'drop', now, a, bend * 0.15, E.s);
      body(id, 'tx', e, e + 0.3, 0, E.s);
      body(id, 'drop', e, e + 0.3, 0, E.s);
      lookAt(id, now, tSwap, t => pieceAt(thing, t ?? a) ?? c0, 0.5);
      now = e + 0.08;
      return api;
    },

    // ── STAGE 2 OF THE HANDS: food and drink used, a pocket picked, a threat, a lesson, a haircut ──
    /** A bite (or a swig, a can): up to the lips and back to the hand, smaller each time (`burn`: what is gone). */
    bite(id, thing, { n = 2, by = 0.3, s = 0.62 } = {}) {
      const h = handOf(id, thing, now);
      if (!h) return api;
      const can = held[thing].kind === 'can';
      // (first in and down in front of him, out of the gap between the two heads, and up to the mouth from there: from
      // the gap's edge straight up to the mouth a can went through the other's head when they stood a little near)
      go(id, h, now, now + 0.12, { c: [0.3, 0.72, 0.36] }, E.s, 0.2);
      now += 0.12;
      for (let k = 0; k < n; k++) {
        const a = now + k * s;
        go(id, h, a, a + 0.18, { c: 'take' }, E.s, 0.5);
        hold(thing, a + 0.18, id, 'mouth', h);
        body(id, 'hx', a + 0.1, a + 0.28, can ? -0.2 : -0.06, E.s);
        held[thing].burn.to(a + 0.24, a + 0.36, Math.min(0.95, held[thing].burn.at(a) + by), E.s);
        hold(thing, a + 0.38, id, h);
        // (down in front of him between bites, under the head's edge: not out to the side and back)
        go(id, h, a + 0.4, a + 0.58, { c: [0.3, 0.72, 0.36] }, E.s, 0.2);
        // (chewing, or swallowing: the head goes with it)
        body(id, 'hx', a + 0.38, a + 0.48, 0.06, E.s);
        body(id, 'hx', a + 0.48, a + 0.58, 0, E.s);
      }
      now += n * s;
      return api;
    },
    /**
     * A POCKET PICKED: `a` looks off the other way while the hand on `b`'s side goes to `b`'s near hip pocket, and
     * comes away with what was in it, to `a`'s own pocket. `b` does not move (it worked) unless `felt` (lift fails).
     */
    dip(a, b, thing, { felt = false } = {}) {
      const [A, B] = [who[a], who[b]];
      const h = innerOf(a, b);
      const hb = innerOf(b, a);
      // (b's near hip pocket, in the world, at the moment)
      const at = t => {
        const f = fk(bodyAt(B, t));
        return worldOf(B, f.chestAt([PLACES.pocket[0] * SIDE[hb], PLACES.pocket[1], PLACES.pocket[2]]));
      };
      held[thing].holds[0].side = hb;
      // (looking anywhere else: down, at nothing. Not turned: a head beside his, closer than a deal stands, turned
      // even a little has a corner in his)
      body(a, 'hx', now, now + 0.24, 0.16, E.s);
      go(a, h, now + 0.08, now + 0.42, { w: at }, E.s, 0.2);
      hold(thing, now + 0.42, a, h);
      go(a, h, now + 0.48, now + 0.72, { c: 'pocket' }, E.s, 0.4);
      now += 0.48;
      if (felt) {
        // FELT: his head snaps round to you and his hand comes down on yours; you let go, he has it back
        // (his head jerks up and back; his shoulders square to you)
        body(b, 'hx', now - 0.1, now + 0.04, -0.16, E.out);
        body(b, 'bx', now - 0.1, now + 0.04, innerOf(b, a) === 'R' ? 0.02 : -0.02, E.out);
        body(a, 'hx', now - 0.06, now + 0.1, -0.05, E.out);
        const t1 = now + 0.12;
        go(b, hb, now - 0.08, t1, { w: () => api.fistOf(a, h, t1) }, E.out, 0.2);
        hold(thing, t1, b, hb);
        gives.push({ t: t1, thing, from: a, to: b, hands: [h, hb], at: api.fistOf(a, h, t1) });
        go(a, h, t1 + 0.04, t1 + 0.24, { c: 'empty' }, E.out, 0.3);
        go(a, h === 'L' ? 'R' : 'L', t1 + 0.04, t1 + 0.24, { c: 'empty' }, E.out, 0.3);
        body(a, 'tx', t1, t1 + 0.18, -0.08, E.out);
        go(b, hb, t1 + 0.1, t1 + 0.34, { c: 'pocket' }, E.s, 0.4);
        hold(thing, t1 + 0.34, b, 'pocket', hb);
        go(b, hb, t1 + 0.4, t1 + 0.6, { c: 'offer' }, E.s, 0.3);
        body(b, 'hx', t1 + 0.5, t1 + 0.7, 0, E.s);
        body(b, 'bx', t1 + 0.5, t1 + 0.7, 0, E.s);
        body(a, 'hx', t1 + 0.4, t1 + 0.6, 0, E.s);
        now = t1 + 0.62;
        return api;
      }
      hold(thing, now + 0.24, a, 'pocket', h);
      body(a, 'hx', now + 0.3, now + 0.5, 0, E.s);
      now += 0.3;
      return api;
    },
    /** Both hands up and open beside the head, the head back: don't. */
    handsUp(id, s = 0.9) {
      for (const h of ['L', 'R']) {
        go(id, h, now, now + 0.18, { c: [0.58, 1.0, 0.08] }, E.out);
        go(id, h, now + s, now + s + 0.25, { c: 'rest' }, E.s, 0.2);
      }
      body(id, 'tx', now, now + 0.18, -0.1, E.out);
      body(id, 'hx', now, now + 0.18, -0.12, E.out);
      body(id, 'tx', now + s, now + s + 0.25, 0, E.s);
      body(id, 'hx', now + s, now + s + 0.25, 0, E.s);
      now += 0.22;
      return api;
    },
    /** The thing held up and out at `b` (beside the head, on the outer side: shown), the body leant at them. */
    threat(a, b, thing, s = 0.5) {
      const h = handOf(a, thing, now);
      if (!h) return api;
      go(a, h, now, now + 0.18, { c: [0.55, 0.9, 0.25] }, E.out);
      // (a jab of it at them)
      go(a, h, now + 0.2, now + 0.28, { c: [0.52, 0.9, 0.33] }, E.out, 0);
      go(a, h, now + 0.28, now + 0.38, { c: [0.55, 0.9, 0.25] }, E.s, 0);
      body(a, 'bx', now, now + 0.2, innerOf(a, b) === 'R' ? 0.03 : -0.03, E.out);
      lookAt(a, now, now + s + 0.4, () => api.headOf(b), 1);
      now += s;
      return api;
    },
    /** Shoved off by `b`: both of `b`'s hands at `a`'s near shoulder, `a` rocked back; `b` stays leant at them. */
    shove(b, a) {
      const hb = innerOf(b, a);
      const A = who[a];
      const at = t => worldOf(A, fk(bodyAt(A, t)).chestAt([0.3 * SIDE[innerOf(a, b)], 0.78, 0.05]));
      go(b, hb, now, now + 0.16, { w: at }, E.out, 0.2);
      go(b, hb, now + 0.3, now + 0.5, { c: 'rest' }, E.s, 0.3);
      body(b, 'bx', now, now + 0.16, hb === 'R' ? 0.04 : -0.04, E.out);
      body(b, 'bx', now + 0.3, now + 0.5, 0, E.s);
      body(a, 'bx', now + 0.12, now + 0.26, hb === 'R' ? 0.05 : -0.05, E.out);
      body(a, 'tx', now + 0.12, now + 0.26, -0.12, E.out);
      body(a, 'bx', now + 0.5, now + 0.75, 0, E.s);
      body(a, 'tx', now + 0.5, now + 0.75, 0, E.s);
      lookAt(b, now, now + 0.9, () => api.headOf(a), 1);
      now += 0.5;
      return api;
    },
    /**
     * (hands-2) A STICK-UP GONE WRONG LANDS ON HIM (the owner: "nothing happens to our agent"). `b` shoves `a` hard, her
     * hand at his near shoulder and her weight behind it, and he is knocked back along the line away from her (`room`:
     * metres free behind him), rocked back, the hand with the blade thrown wide and the other out for balance; he
     * nearly goes down (a dip, bent over, a hand to his knee) and catches himself. She points after him and shouts
     * (`shouts`: perform.js has whoever is near turn to look: it was SEEN, which is the heat). Nothing that hurts him:
     * the rules take nothing from his health.
     */
    shoveOff(b, a, { room = 1.9, dir = null } = {}) {
      const [A, B] = [who[a], who[b]];
      const hb = innerOf(b, a);
      const ob = hb === 'L' ? 'R' : 'L';
      const ha = handOf(a, 'cutter', now) ?? (innerOf(a, b) === 'L' ? 'R' : 'L');
      const oa = ha === 'L' ? 'R' : 'L';
      const L = Math.hypot(A.x - B.x, A.z - B.z) || 1;
      // (`dir`: the way that is free behind him, told by the stage; else straight away from her)
      const u = dir ?? [(A.x - B.x) / L, (A.z - B.z) / L];
      const K = clamp(room - 0.75, 0.35, 1.15);
      // (away from her is which way for his own hips and for hers: asked of their headings)
      const awayA = Math.sign(Math.cos(A.yaw) * u[0] - Math.sin(A.yaw) * u[1]) || 1;
      const toward = -(Math.sign(Math.cos(B.yaw) * -u[0] - Math.sin(B.yaw) * -u[1]) || 1);
      const shoulder = t => worldAt(A, fk(bodyAt(A, t)).chestAt([0.28 * SIDE[innerOf(a, b)], 0.8, 0.06]), t);
      go(b, hb, now, now + 0.14, { w: shoulder }, E.out, 0.2);
      go(b, ob, now + 0.02, now + 0.14, { c: [0.3, 0.8, 0.42] }, E.out, 0.4);
      body(b, 'bx', now, now + 0.14, -toward * 0.05, E.out);
      body(b, 'tx', now, now + 0.14, 0.1, E.out);
      const t1 = now + 0.12;
      // KNOCKED BACK: the whole body a metre and more, fast and slowing, rocked back, the head snapped back
      body(a, 'rx', t1, t1 + 0.44, A.rx.at(t1) + u[0] * K, E.out);
      body(a, 'rz', t1, t1 + 0.44, A.rz.at(t1) + u[1] * K, E.out);
      body(a, 'tx', t1, t1 + 0.16, -0.24, E.out);
      body(a, 'bx', t1, t1 + 0.16, awayA * 0.06, E.out);
      body(a, 'hx', t1, t1 + 0.14, -0.2, E.out);
      go(a, ha, t1, t1 + 0.22, { c: 'wide' }, E.s, 0.3);
      go(a, oa, t1 + 0.02, t1 + 0.18, { c: [0.52, 0.9, 0.0] }, E.out, 0.3);
      // NEARLY DOWN, and caught: a dip, bent over, the free hand to his knee; and up
      const t2 = t1 + 0.4;
      body(a, 'drop', t2 - 0.08, t2 + 0.12, 0.12, E.s);
      body(a, 'tx', t2 - 0.06, t2 + 0.16, 0.3, E.s);
      body(a, 'hx', t2 - 0.06, t2 + 0.16, 0.1, E.s);
      body(a, 'bx', t2 - 0.06, t2 + 0.16, 0, E.s);
      go(a, oa, t2 - 0.06, t2 + 0.14, { c: 'thigh' }, E.s, 0.2);
      go(a, ha, t2 - 0.06, t2 + 0.14, { c: [0.56, 0.62, 0.12] }, E.s, 0.2);
      body(a, 'drop', t2 + 0.22, t2 + 0.44, 0, E.s);
      body(a, 'tx', t2 + 0.22, t2 + 0.44, 0, E.s);
      body(a, 'hx', t2 + 0.22, t2 + 0.44, 0, E.s);
      // SHE POINTS AFTER HIM AND SHOUTS: the arm out at him (as far as it goes: pointing), the chin up, two jabs of it
      const at = (up = 0) => t => {
        const h = api.headOf(a, t);
        return [h[0], B.y + (1.0 + up) * B.s, h[2]];
      };
      go(b, hb, t1 + 0.2, t1 + 0.42, { w: at() }, E.out, 0.2);
      for (const k of [0, 1]) {
        const a0 = t1 + 0.6 + k * 0.32;
        go(b, hb, a0, a0 + 0.08, { w: at(0.1) }, E.out, 0);
        go(b, hb, a0 + 0.08, a0 + 0.2, { w: at() }, E.s, 0);
      }
      body(b, 'tx', t1 + 0.18, t1 + 0.36, -0.04, E.s);
      body(b, 'bx', t1 + 0.18, t1 + 0.36, 0, E.s);
      body(b, 'hx', t1 + 0.2, t1 + 0.32, -0.16, E.out);
      body(b, 'hx', t1 + 0.56, t1 + 0.64, -0.08, E.s);
      body(b, 'hx', t1 + 0.66, t1 + 0.74, -0.16, E.out);
      go(b, ob, t1 + 0.2, t1 + 0.45, { c: 'rest' }, E.s, 0.3);
      lookAt(b, t1, t1 + 1.5, () => api.headOf(a), 1);
      shouts.push({ t: t1 + 0.24, who: b, at: a });
      go(b, hb, t1 + 1.4, t1 + 1.65, { c: 'rest' }, E.s, 0.3);
      body(b, 'hx', t1 + 1.4, t1 + 1.6, 0, E.s);
      body(b, 'tx', t1 + 1.4, t1 + 1.6, 0, E.s);
      now = t2 + 0.3;
      return api;
    },
    /**
     * (hands-2) BACKED OFF: the blade away in his pocket, both hands half up and open (no trouble), and two steps back
     * along the same line, away from `b` (`room`: metres free behind him in all, the shove's share taken first).
     */
    backOff(a, b, thing, { room = 1.9, dir = null } = {}) {
      const [A, B] = [who[a], who[b]];
      const L = Math.hypot(A.x + A.rx.at(now) - B.x, A.z + A.rz.at(now) - B.z) || 1;
      const u = dir ?? [(A.x + A.rx.at(now) - B.x) / L, (A.z + A.rz.at(now) - B.z) / L];
      const K = clamp(room - 0.75, 0.35, 1.15);
      const back = clamp(room - K - 0.2, 0, 0.6);
      const h = handOf(a, thing, now);
      if (h) {
        go(a, h, now, now + 0.22, { c: 'pocket' }, E.s, 0.5);
        hold(thing, now + 0.22, a, 'pocket', h);
      }
      const t0b = now + (h ? 0.26 : 0);
      for (const s of ['L', 'R']) go(a, s, t0b, t0b + 0.2, { c: [0.44, 0.92, 0.18] }, E.out, 0.3);
      body(a, 'hx', t0b, t0b + 0.2, -0.06, E.s);
      for (const k of [0, 1]) {
        const s0 = now + 0.1 + k * 0.36;
        body(a, 'rx', s0, s0 + 0.32, A.rx.at(s0) + (u[0] * back) / 2, E.s);
        body(a, 'rz', s0, s0 + 0.32, A.rz.at(s0) + (u[1] * back) / 2, E.s);
        body(a, 'drop', s0, s0 + 0.14, 0.035, E.s);
        body(a, 'drop', s0 + 0.16, s0 + 0.3, 0, E.s);
        body(a, 'bx', s0, s0 + 0.16, (k ? -1 : 1) * 0.025, E.s);
      }
      body(a, 'bx', now + 0.82, now + 0.95, 0, E.s);
      now = Math.max(t0b + 0.4, now + 0.84);
      return api;
    },
    /**
     * A PUNCH SHOWN (`style`: jab, haymaker, throw), out in front at the air, the body after it: the jab twice and
     * fast; the haymaker wound back and round, the hips turning; the throw both hands out, a grip, and down and round.
     */
    show(id, style = 'jab') {
      const h = camOf(who[id]);
      const o = h === 'L' ? 'R' : 'L';
      const guard = { c: [0.16, 0.86, 0.3] };
      if (style === 'jab') {
        go(id, o, now, now + 0.14, guard, E.s, 0);
        for (const k of [0, 1]) {
          const a = now + 0.12 + k * 0.3;
          go(id, h, a, a + 0.1, { c: [0.08, 0.95, 0.44] }, E.out, 0);
          go(id, h, a + 0.12, a + 0.26, guard, E.s, 0);
          body(id, 'ty', a, a + 0.1, -SIDE[h] * 0.12, E.out);
          body(id, 'ty', a + 0.12, a + 0.26, 0, E.s);
        }
        now += 0.75;
      } else if (style === 'haymaker') {
        go(id, h, now, now + 0.22, { c: [0.5, 0.95, -0.08] }, E.s, 0.2);
        body(id, 'ty', now, now + 0.22, SIDE[h] * 0.35, E.s);
        go(id, h, now + 0.26, now + 0.48, { c: [-0.06, 0.95, 0.42] }, E.in, 1.6);
        body(id, 'ty', now + 0.26, now + 0.48, -SIDE[h] * 0.4, E.in);
        body(id, 'drop', now + 0.26, now + 0.48, 0.04, E.in);
        go(id, h, now + 0.6, now + 0.8, { c: 'rest' }, E.s, 0.3);
        body(id, 'ty', now + 0.6, now + 0.8, 0, E.s);
        body(id, 'drop', now + 0.6, now + 0.8, 0, E.s);
        now += 0.85;
      } else {
        for (const x of ['L', 'R']) go(id, x, now, now + 0.2, { c: [0.14, 0.9, 0.42] }, E.out, 0.3);
        for (const x of ['L', 'R']) go(id, x, now + 0.32, now + 0.6, { c: [x === h ? 0.32 : -0.05, 0.62, 0.3] }, E.in, 0.6);
        body(id, 'ty', now + 0.32, now + 0.6, -SIDE[h] * 0.45, E.in);
        body(id, 'drop', now + 0.32, now + 0.6, 0.08, E.in);
        body(id, 'tx', now + 0.32, now + 0.6, 0.18, E.in);
        for (const x of ['L', 'R']) go(id, x, now + 0.72, now + 0.92, { c: 'rest' }, E.s, 0.3);
        for (const k of ['ty', 'drop', 'tx']) body(id, k, now + 0.72, now + 0.92, 0, E.s);
        now += 0.95;
      }
      return api;
    },
    /** The barber at work: scissors up at the head beside him, snipping, the bits falling; his head bent to it. */
    cut(id, to, thing, { s = 1.2 } = {}) {
      const h = handOf(id, thing, now) ?? innerOf(id, to);
      const T = who[to];
      const ho = innerOf(to, id);
      // (at the side of the other's head, the gap side, as high as an arm goes)
      const at = (dy, dz) => t => worldOf(T, fk(bodyAt(T, t ?? now)).chestAt([0.52 * SIDE[ho], 1.02 + dy, 0.22 + dz]));
      go(id, h, now, now + 0.2, { w: at(0, 0) }, E.s, 0.4);
      for (let k = 0; k < 4; k++) {
        const a = now + 0.22 + k * 0.24;
        go(id, h, a, a + 0.1, { w: at(0.04 * (k % 2), 0.05 * ((k + 1) % 2)) }, E.s, 0);
        go(id, h, a + 0.1, a + 0.22, { w: at(0, 0) }, E.s, 0);
        fx.push({ kind: 'hair', t: a + 0.1, life: 0.6, at: at(0, 0.05)() });
      }
      body(id, 'hx', now, now + 0.2, Math.min(0.2, who[id].nodMax), E.s);
      body(to, 'hx', now, now + 0.2, 0.1, E.s);
      go(id, h, now + s, now + s + 0.22, { c: 'offer' }, E.s, 0.3);
      body(id, 'hx', now + s, now + s + 0.2, 0, E.s);
      body(to, 'hx', now + s, now + s + 0.2, 0, E.s);
      now += s;
      return api;
    },
    /** A hand run over the new cut, the head turned one way and the other: looks all right. */
    preen(id, side = null) {
      const h = side ?? camOf(who[id]);
      go(id, h, now, now + 0.2, { c: [0.48, 1.08, 0.12] }, E.s, 0.4);
      go(id, h, now + 0.2, now + 0.4, { c: [0.46, 1.12, -0.05] }, E.s, 0);
      go(id, h, now + 0.48, now + 0.7, { c: 'rest' }, E.s, 0.3);
      body(id, 'hy', now + 0.1, now + 0.3, 0.15, E.s);
      body(id, 'hy', now + 0.3, now + 0.5, -0.1, E.s);
      body(id, 'hy', now + 0.5, now + 0.65, 0, E.s);
      now += 0.6;
      return api;
    },

    // ── HANDS-2: a thing to wear, put on where it was bought ──
    /**
     * PUT ON: the hand that has it takes it to where it goes on him, and it is ON: from that moment the figure is drawn
     * wearing it (`dresses`: perform.js dresses the body there and then) and the thing in the hand is gone. A hat or
     * glasses: up beside the head, as high as an arm of 0.44 m reaches (it cannot reach the top of a head a metre
     * wide), the chin lifted to it; a top: held flat against his front, the shoulders shrugged into it; for the feet:
     * bent down to the shin; anything else at the hip. `slot`: the cast's slot (hat, eyewear, top, bottom, shoes, acc).
     */
    putOn(id, thing, slot = 'top') {
      const h = handOf(id, thing, now);
      if (!h) return api;
      const W = WEAR_AT[slot] ?? WEAR_AT.top;
      go(id, h, now, now + 0.26, { c: W.at }, E.s, 0.5);
      if (W.bend) {
        body(id, 'tx', now, now + 0.26, W.bend, E.s);
        body(id, 'drop', now, now + 0.26, 0.06, E.s);
      }
      if (W.shrug) body(id, 'drop', now + 0.18, now + 0.3, -0.02, E.out);
      body(id, 'hx', now + 0.04, now + 0.24, W.nod, E.s);
      const t = now + 0.3;
      hold(thing, t, id, 'worn', h);
      dresses.push({ t, who: id, slot });
      go(id, h, t + 0.06, t + 0.32, { c: 'rest' }, E.s, 0.3);
      if (W.bend) {
        body(id, 'tx', t + 0.06, t + 0.4, 0, E.s);
        body(id, 'drop', t + 0.06, t + 0.4, 0, E.s);
      }
      if (W.shrug) body(id, 'drop', t + 0.02, t + 0.2, 0, E.s);
      body(id, 'hx', t + 0.04, t + 0.26, 0, E.s);
      now = t + 0.24;
      return api;
    },
    /**
     * (hands-2) OFF A WALL: the hand the camera sees goes to `at` (a point of the world, on a shop's wall in front of
     * him), the body after it a little, and comes away with `thing` (there till then, unseen), out beside the head and
     * looked at.
     */
    reach(id, at, thing, { s = 0.36 } = {}) {
      const P = who[id];
      const h = camOf(P);
      // (a hand's width toward that hand's own side: straight ahead of the chest is past an arm's reach from a shoulder)
      const [rx, rz] = [Math.cos(P.yaw), -Math.sin(P.yaw)];
      const w = [at[0] + rx * 0.16 * P.s * SIDE[h], at[1], at[2] + rz * 0.16 * P.s * SIDE[h]];
      go(id, h, now, now + 0.28, { w }, E.out, 0.6);
      body(id, 'tx', now + 0.04, now + 0.28, 0.16, E.s);
      body(id, 'hx', now + 0.04, now + 0.28, 0.12, E.s);
      // (in the hand once it is out beside the head: drawn at the wall, it pointed back through his own head when the
      // camera was behind him. The hand closes on the wall, and what it took is seen as it comes away)
      hold(thing, now + 0.5, id, h);
      go(id, h, now + 0.32, now + 0.62, { c: 'chest' }, E.s, 0.8);
      body(id, 'tx', now + 0.36, now + 0.62, 0, E.s);
      body(id, 'hx', now + 0.36, now + 0.62, 0, E.s);
      lookAt(id, now + 0.4, now + 0.62 + s, () => api.thingAt(thing), GLANCE);
      now += 0.62 + s;
      return api;
    },
    /** A look back over the shoulder (nobody to look at: whoever might be watching), and round again. */
    glance(id, s = 0.45) {
      const sg = camOf(who[id]) === 'R' ? -1 : 1;
      body(id, 'hy', now, now + 0.16, sg * 1.05, E.out);
      body(id, 'ty', now + 0.04, now + 0.26, sg * 0.3, E.s);
      body(id, 'hy', now + s, now + s + 0.2, 0, E.s);
      body(id, 'ty', now + s, now + s + 0.24, 0, E.s);
      now += s + 0.16;
      return api;
    },
    /** Put back where it came from (`at`, the wall), the hand out empty. */
    putBack(id, thing, at) {
      const h = handOf(id, thing, now);
      if (!h) return api;
      go(id, h, now, now + 0.24, { w: at }, E.s, 0.6);
      // (gone from the hand as it goes in to the wall, as it came: carried there it points back through his own head)
      hold(thing, now + 0.1, 'bin', 'in');
      go(id, h, now + 0.3, now + 0.5, { c: 'rest' }, E.s, 0.3);
      now += 0.4;
      return api;
    },
    /** Looked at, on him: a hand run over a hat (preen), the head down at a top or the feet and up again, a turn of the shoulders. */
    admire(id, slot = 'top') {
      if (slot === 'hat' || slot === 'eyewear') return api.preen(id);
      body(id, 'hx', now, now + 0.2, Math.min(0.3, who[id].nodMax + 0.06), E.s);
      body(id, 'ty', now + 0.1, now + 0.3, 0.12, E.s);
      body(id, 'ty', now + 0.3, now + 0.5, -0.1, E.s);
      body(id, 'ty', now + 0.5, now + 0.62, 0, E.s);
      body(id, 'hx', now + 0.42, now + 0.62, 0, E.s);
      now += 0.6;
      return api;
    },

    // ── asked of it while it is written, and after ──
    headOf(id, t = now) {
      const P = who[id];
      return worldAt(P, fk(bodyAt(P, t)).headC, t);
    },
    fistOf(id, side, t) {
      const P = who[id];
      const f = fk(poseAt(P, t));
      return worldAt(P, side === 'L' ? f.fistL : f.fistR, t);
    },
    thingAt(thing, t = now) {
      return api.at(t).things[thing].at;
    },
    /** Everybody and everything at t. */
    at(t) {
      const keep = clockT;
      clockT = t;
      try {
        return api.at0(t);
      } finally {
        clockT = keep;
      }
    },
    at0(t) {
      const bodies = {};
      const F = {};
      for (const P of Object.values(who)) {
        const Q = poseAt(P, t);
        bodies[P.id] = { P: Q, x: P.x + P.rx.at(t), y: P.y, z: P.z + P.rz.at(t), yaw: P.yaw, scale: P.s };
        F[P.id] = fk(Q);
      }
      const out = {};
      // (a held thing points AT THE CAMERA, level: out in front of the heads, where it is seen whole from above. Along
      // the forearm it lay under its holder's own head. No camera told: the way its holder faces. Beside somebody: the
      // way the two of them face, between their two headings: square to the line between them, so it never points
      // into the other. At the camera it did, when they stood along its bearing)
      const lineOf2 = (Q, w) => {
        const mate = partnerOf(Q.id);
        if (mate) return toWorld([0, 0, 1], 0, 0, 0, Q.yaw + wrap(who[mate].yaw - Q.yaw) / 2);
        if (!cam) return toWorld([0, 0, 1], 0, 0, 0, Q.yaw);
        const [cx, cz] = [cam[0] - w[0], cam[1] - w[2]];
        const n = Math.hypot(cx, cz) || 1;
        return [cx / n, 0, cz / n];
      };
      // (and it is BESIDE the fist, on the side away from its holder's body: `out`, level, from the body's own middle
      // through the hand. In the fist's own place it was half in the hip at a pocket and half under the head when it
      // was looked at)
      const outOf2 = (Q, w) => {
        const [dx, dz] = [w[0] - Q.x, w[2] - Q.z];
        const n = Math.hypot(dx, dz) || 1;
        return [dx / n, dz / n];
      };
      /** A thing in somebody's mouth: at the front of the face, pointing out of it and hanging a little. */
      const mouthOf = (Q, f) => {
        const [a, b] = [worldOf(Q, f.headAt(MOUTH)), worldOf(Q, f.headAt([MOUTH[0], MOUTH[1], MOUTH[2] + 1]))];
        const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const lv = Math.hypot(d[0], d[2]) || 1;
        // (a can is tipped up at the lips; anything else hangs a little)
        const tip = kindNow === 'can' ? -0.75 : DROOP;
        const dir = [(d[0] / lv) * Math.cos(tip), Math.min(0, d[1]) - Math.sin(tip), (d[2] / lv) * Math.cos(tip)];
        // (tipped, a thick thing's back edge leans into the face: out from the lips by that much)
        const bx = boxOf(kindNow ?? 'cig');
        const back = Math.max(Math.abs(bx[2]), Math.abs(bx[3])) * Math.abs(Math.sin(tip));
        return { at: [a[0] + (d[0] / lv) * back, a[1], a[2] + (d[2] / lv) * back], dir };
      };
      let kindNow = null;
      for (const T of Object.values(held)) {
        kindNow = T.kind;
        const h = holder(T.id, t);
        const P = who[h.who];
        const burns = { lit: T.lit.at(t), glow: T.glow.at(t), burn: T.burn.at(t) };
        if (!P) {
          // (not anybody's: where it lies or goes, a place of the world given with it: in a bin, on a counter; or a
          // way it goes, `path`: slid along the ground, flicked through the air)
          if (h.path) {
            const p = h.path(t);
            out[T.id] = { kind: T.kind, holder: `${h.who}:${h.where}`, at: p.at, dir: p.dir, up: [0, 1, 0], show: h.show ?? true, since: t - h.t, scale: 1, ...burns };
          } else out[T.id] = { kind: T.kind, holder: `${h.who}:${h.where}`, at: T.at ?? [0, 0, 0], dir: [0, 0, 1], up: [0, 1, 0], show: h.who === 'surface', since: t - h.t };
          continue;
        }
        const f = F[P.id];
        if (h.where === 'mouth') {
          const m = mouthOf(P, f);
          let [at2, dir] = [m.at, m.dir];
          // (from the hand that put it there, over an eighth of a second; and back to the one that takes it, below)
          const k0 = T.holds.indexOf(h);
          const was = k0 > 0 ? T.holds[k0 - 1] : null;
          if (was?.who === P.id && (was.where === 'L' || was.where === 'R') && t - h.t < BLEND) {
            const fist = worldOf(P, was.where === 'L' ? f.fistL : f.fistR);
            const o = outOf2(P, fist);
            const off = offOf(T.kind);
            const e = E.s((t - h.t) / BLEND);
            const from = [fist[0] + o[0] * off, fist[1], fist[2] + o[1] * off];
            at2 = mix3(from, at2, e);
            dir = mix3(lineOf2(P, fist), dir, e);
          }
          out[T.id] = { kind: T.kind, holder: `${P.id}:mouth`, fist: m.at, at: at2, dir, up: [0, 1, 0], show: true, since: t - h.t, scale: 1, ...burns };
          continue;
        }
        const away = hh => PLACES[AWAY[hh.where] ?? 'pocket'];
        const where = (Q, fq, hh) => (hh.where === 'L' || hh.where === 'R' ? worldOf(Q, hh.where === 'L' ? fq.fistL : fq.fistR) : worldOf(Q, fq.chestAt([away(hh)[0] * SIDE[hh.side ?? 'R'], away(hh)[1], away(hh)[2]])));
        const fist = where(P, f, h);
        let o = outOf2(P, fist);
        // (handed over: it crosses the two joined fists from the giver's far side to the taker's in an eighth of a second)
        const k = T.holds.indexOf(h);
        const was = k > 0 ? T.holds[k - 1] : null;
        if (was && who[was.who] && was.who !== h.who && t - h.t < FLIP) {
          const o0 = outOf2(who[was.who], where(who[was.who], F[was.who], was));
          const e = E.s((t - h.t) / FLIP);
          o = [o0[0] + (o[0] - o0[0]) * e, o0[1] + (o[1] - o0[1]) * e];
        }
        const off = offOf(T.kind);
        let at2 = [fist[0] + o[0] * off, fist[1], fist[2] + o[1] * off];
        let dir = lineOf2(P, fist);
        // (taken back out of the mouth: from there to the hand over an eighth of a second)
        if (was?.who === P.id && was.where === 'mouth' && t - h.t < BLEND) {
          const m = mouthOf(P, f);
          const e = E.s((t - h.t) / BLEND);
          at2 = mix3(m.at, at2, e);
          dir = mix3(m.dir, dir, e);
        }
        out[T.id] = { kind: T.kind, holder: `${P.id}:${h.where}`, fist, at: at2, dir, up: [0, 1, 0], show: h.where === 'L' || h.where === 'R', since: t - h.t, scale: 1, ...burns };
      }
      // WHAT NOBODY HOLDS: breath out (a cloud from the mouth where it was breathed, rising and spreading as it goes),
      // a lighter's flame (on the lighter, at its top)
      const air = [];
      for (const [i, X] of fx.entries()) {
        const k = (t - X.t) / X.life;
        if (k < 0 || k > 1) continue;
        if (X.kind === 'flame') {
          const L = out[X.on];
          if (L?.show) air.push({ kind: 'flame', i, k, at: [L.at[0], L.at[1] + boxOf(L.kind)[3], L.at[2]], dir: L.dir });
          continue;
        }
        if (X.kind === 'hair') {
          // (cut hair: a few dark bits dropping from beside the head, to the ground)
          air.push({ kind: 'hair', i, k, n: 3, at: [X.at[0], X.at[1] - 1.1 * k * k, X.at[2]], dir: [0, 0, 1] });
          continue;
        }
        const Q = who[X.who];
        // (where the mouth was at the breath: asked once of the deal as written)
        const m = X.from ?? mouthOf(Q, fk(poseAt(Q, X.t)));
        if (sealed) X.from = m;
        const rise = 0.6 * Q.s * (1 - (1 - k) * (1 - k));
        air.push({ kind: 'puff', i, k, n: X.n ?? 3, at: [m.at[0] + m.dir[0] * 0.25 * k, m.at[1] + rise, m.at[2] + m.dir[2] * 0.25 * k], dir: m.dir });
      }
      return { bodies, things: out, fx: air };
    },
    done() {
      sealed = true;
      const t1 = last + 0.05;
      return { t0, t1, back: back ? { t: Math.min(back.t, t1), who: back.who } : null, people: who, things: held, gives, dresses, shouts, faults, at: api.at, fistOf: api.fistOf };
    },
  };
  return api;
}

/**
 * THE MEASURES of a staged hand-over (what the checks fail on): at each hand-over the two fists' distance (m); every
 * thing in exactly one holder at every frame, and no further from a body that holds it than a hand reaches; how far any
 * fist is from where it was told to be (an arm that cannot reach); the length.
 */
export function measureHands(T, { step = 1 / 60 } = {}) {
  const out = { length: +(T.t1 - T.t0).toFixed(2), meets: [], apart: 0, lost: 0, far: 0, nan: 0, jump: 0, frames: 0, through: [], faults: [...T.faults] };
  const went = new Set();
  for (const g of T.gives) {
    const [a, b] = [T.fistOf(g.from, g.hands[0], g.t), T.fistOf(g.to, g.hands[1], g.t)];
    const d = dist(a, b);
    out.meets.push({ thing: g.thing, t: +g.t.toFixed(2), apart: +d.toFixed(3), offPoint: +Math.max(dist(a, g.at), dist(b, g.at)).toFixed(3) });
    out.apart = Math.max(out.apart, d);
  }
  let prev = null;
  for (let t = T.t0; t <= T.t1 + 1e-9; t += step) {
    const S = T.at(t);
    out.frames += 1;
    for (const B of Object.values(S.bodies)) if ([B.P.tx, B.P.ty, B.P.hx, B.P.hy, ...B.P.aL, ...B.P.aR].some(v => !Number.isFinite(v))) out.nan += 1;
    for (const [id, X] of Object.entries(S.things)) {
      const [w] = X.holder.split(':');
      if (!X.holder || X.at.some(v => !Number.isFinite(v))) out.lost += 1;
      const B = S.bodies[w];
      if (B) {
        // (from the body's own middle at chest height: a held or pocketed thing is within its reach)
        const c = toWorld([0, 0.8 * B.scale, 0], B.x, B.y, B.z, B.yaw);
        out.far = Math.max(out.far, dist(X.fist ?? X.at, c) / B.scale);
      }
      // NOTHING HELD GOES THROUGH A BODY: the thing's own box, as drawn, against every body's torso and head
      if (X.show) for (const [who, B2] of Object.entries(S.bodies)) {
        const part = throughOf(X, B2);
        if (part && !went.has(`${id} ${who} ${part}`)) {
          went.add(`${id} ${who} ${part}`);
          out.through.push({ thing: id, who, part, t: +(t - T.t0).toFixed(2), held: X.holder });
        }
      }
      // (a thing never moves further in a frame than a hand does: it did not jump from one place to another)
      if (prev?.things[id] && X.show && prev.things[id].show) out.jump = Math.max(out.jump, dist(X.at, prev.things[id].at));
    }
    prev = S;
  }
  for (const g of out.through) out.faults.push(`${g.thing} (${g.held}) goes through ${g.who}'s ${g.part} at ${g.t} s`);
  out.apart = +out.apart.toFixed(3);
  out.far = +out.far.toFixed(2);
  out.jump = +out.jump.toFixed(3);
  return out;
}
void RIG;

/** A body's torso and head as boxes in their own frames (m, unit rig): what a held thing must stay out of. */
const TORSO = [-0.2, 0.2, 0.5, 0.9, -0.12, 0.14];
const HEAD = [-RIG.head.x, RIG.head.x, RIG.head.y0, RIG.head.y1, RIG.head.z0, RIG.head.z1];
/** How far inside a box a thing's own corner may be before it is through it (m): the hand that holds it is at the body. */
const SKIN = 0.035;
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** A frame given as its own point → body point: the inverse, a body point → its own. */
const into = fn => {
  const o = fn([0, 0, 0]);
  const [ex, ey, ez] = [sub3(fn([1, 0, 0]), o), sub3(fn([0, 1, 0]), o), sub3(fn([0, 0, 1]), o)];
  return p => {
    const d = sub3(p, o);
    return [dot3(d, ex), dot3(d, ey), dot3(d, ez)];
  };
};
const inside = (p, B) => p[0] > B[0] + SKIN && p[0] < B[1] - SKIN && p[1] > B[2] + SKIN && p[1] < B[3] - SKIN && p[2] > B[4] + SKIN && p[2] < B[5] - SKIN;
/**
 * Is a held thing (one of at(t).things, as drawn: things.js boxOf) through a body (one of at(t).bodies)? → 'torso' |
 * 'head' | null. Points of the thing's box, a grid of them, against the body's two boxes in their own frames.
 */
export function throughOf(X, B) {
  const box = boxOf(X.kind).map(v => v * (X.scale ?? 1));
  const n = Math.hypot(...X.dir) || 1;
  const Z = X.dir.map(v => v / n);
  let Xa = cross3(X.up, Z);
  const m = Math.hypot(...Xa) || 1;
  Xa = Xa.map(v => v / m);
  const Ya = cross3(Z, Xa);
  const f = fk(B.P);
  const [chest, head] = [into(f.chestAt), into(f.headAt)];
  for (const u of [0.08, 0.5, 0.92]) for (const v of [0.08, 0.5, 0.92]) for (const w of [0.04, 0.25, 0.5, 0.75, 0.96]) {
    const l = [box[0] + (box[1] - box[0]) * u, box[2] + (box[3] - box[2]) * v, box[4] + (box[5] - box[4]) * w];
    const p = [X.at[0] + Xa[0] * l[0] + Ya[0] * l[1] + Z[0] * l[2], X.at[1] + Xa[1] * l[0] + Ya[1] * l[1] + Z[1] * l[2], X.at[2] + Xa[2] * l[0] + Ya[2] * l[1] + Z[2] * l[2]];
    const b = toBody(p, B.x, B.y, B.z, B.yaw).map(q => q / B.scale);
    if (inside(chest(b), TORSO)) return 'torso';
    if (inside(head(b), HEAD)) return 'head';
  }
  return null;
}
