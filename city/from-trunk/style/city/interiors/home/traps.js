// Home objects · crime-world defences and traps (2026-11-17): what a hustler from a trailer park up to a kingpin would really rig. No
// spikes, tripwires, mines, bear traps, turrets, fire, shocks or anything rigged to shoot: each piece slows, marks, scares, wakes or
// fools whoever breaks in. Each one's `does` is a line on what it could do in a break-in (a proposal; the sim owns any rule).
// Invented looks and words, no brand. Every piece has a fine pass (../fine.js).
import { def, K, SAFE, pick, cyl, cylZ, line, LIT, shade, mix, hash, frect, fdisc, fline, ftxt, hbox, fsurf, fprint, inkOf, fcolour, billTex } from './lib.js';
import { g } from './bits.js';

const sec = (extra, rarity = 'common') => g('gear', rarity, 'store', extra);

// ── a decoy safe: a cheap tin box dressed as the real thing (sticker dial, painted pinstripe, a dent), empty inside
export const decoySafe = def({ id: 'decoy-safe', name: 'Decoy safe', cat: 'security', place: 'floor', foot: [2, 3], h: 0.55, sim: 'safe', states: ['closed', 'open'],
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['safe', 'decoy', 'trap'], variants: 1, vnames: ['tin green'],
  does: 'Looks like the real safe: a burglar burns minutes cracking an empty tin while the real stash sits somewhere else.',
  game: sec({ secure: 'safe', safeTake: -.2 }),
  build(V, { state = 'closed' } = {}) {
    const body = 0x2f7a5e, open = state === 'open';
    for (const x of [2, 7]) V.box(x, 0, 2, x + 1, 1, 6, K.ink);
    V.box(1, 1, 0, 10, 11, 7, body); V.box(1, 10, 0, 10, 11, 7, mix(body, 0xffffff, .15));
    if (!open) { V.box(2, 2, 7, 9, 10, 8, body); V.set(3, 7, 7, shade(body, .8)); V.set(4, 7, 7, shade(body, .8)); return; }
    V.box(2, 2, 1, 9, 10, 7, -1); V.box(2, 2, 1, 9, 3, 7, 0x3a3c44);
    V.box(1, 2, 7, 2, 10, 14, body);
  },
  // fine pass: a printed dial (a sticker: flat, slightly off-round), a pinstripe painted on, the dent's shadow, a rivet that's a dot;
  // open: the empty tin and a note left in it
  fine(P, { state = 'closed', V }) {
    if (state === 'open') { fsurf(P, V, '+y', 3, 2, 2, 7, 3, 5, (x, y, z, i, j) => (z === 3 && j === 1) || (z === 4 && j === 1 && x < 5) ? K.red : K.white); return; }
    fdisc(P, '+z', 5.5, 6.5, 1.6, (d, th) => d > 1.35 ? K.ink : d > 1 ? (Math.round(th * 4) % 2 ? K.white : 0xd8b040) : d < .4 ? K.ink : 0xd8b040);
    frect(P, '+z', 2.25, 2.25, 8.75, 2.5, 0xd8b040); frect(P, '+z', 2.25, 9.5, 8.75, 9.75, 0xd8b040); frect(P, '+z', 2.25, 2.25, 2.5, 9.75, 0xd8b040); frect(P, '+z', 8.5, 2.25, 8.75, 9.75, 0xd8b040);
    frect(P, '+z', 3, 6.75, 5, 7, shade(0x2f7a5e, .6)); frect(P, '+z', 6.5, 3.5, 7.5, 4, 0xb8bcc4);
  } });

// ── a dye pack in a cash bundle: a banded stack with one corner cut away to show the red pack in it
export const dyePack = def({ id: 'dye-pack', name: 'Dye-pack bundle', cat: 'security', place: 'surface', foot: [1, 1], h: 0.15,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['cash', 'dye pack', 'trap'], variants: 1, vnames: ['banded'],
  does: 'Grab it and it bursts: red dye all over the cash and the hands that took it, so the thief is marked for days.',
  game: sec({ idBurglar: true }, 'rare'),
  build(V) {
    V.box(0, 0, 1, 5, 2, 4, K.cash); V.box(2, 0, 1, 3, 2, 4, K.white);
    V.box(3, 1, 3, 5, 2, 4, -1); V.box(3, 1, 3, 5, 2, 4, K.red); V.set(4, 1, 3, 0x7a1010);
  },
  // fine pass: the notes' paper edges and faces, the band's print, the pack's wire and its tiny armed light (lit)
  fine(P, { V }) {
    fcolour(P, V, K.cash, ['+y', '+z', '+x'], billTex);
    frect(P, '+y', 2, 1.5, 3, 1.75, K.cashD); frect(P, '+y', 2, 3, 3, 3.25, K.cashD);
    frect(P, '+y', 3.25, 3.25, 4.75, 3.5, K.ink); P.half(9, 4, 7, 0xff3a3a, LIT);
  } });

// ── a door bar: a heavy steel bar dropped into two brackets across the door, a brace from it to a plate on the floor
export const doorBar = def({ id: 'door-bar', name: 'Door bar', cat: 'security', place: 'wall', foot: [5, 8], h: 0.3, mount: 0, sim: 'door',
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['door', 'bar', 'brace'], variants: 2, vnames: ['black steel', 'red steel'],
  does: 'Barred and braced from inside: the door takes a ram, not a kick, and the noise wakes the house.',
  game: sec({ secure: 'door', burgleOdds: -15 }),
  build(V, { variant = 0 } = {}) {
    const m = pick([0x2a2c32, 0xb8282e], variant);
    for (const x of [1, 22]) { V.box(x, 17, 0, x + 2, 23, 3, K.steelD, 2); V.box(x, 17, 3, x + 2, 18, 5, K.steelD, 2); }
    V.box(0, 19, 2, 25, 22, 5, m, m === 0x2a2c32 ? 2 : 1);
    line(V, 12, 18, 4, 12, 1, 4, m); line(V, 13, 18, 4, 13, 1, 4, m); line(V, 12, 18, 3, 12, 1, 3, m); line(V, 13, 18, 3, 13, 1, 3, m);
    V.box(9, 0, 1, 16, 1, 6, K.steelD, 2);
  },
  // fine pass: the brackets' bolt heads, a worn line along the bar where it's lifted, the floor plate's screws, a hazard band on the brace
  fine(P, { variant = 0 }) {
    for (const x of [1, 22]) for (const y of [17.5, 21.75]) frect(P, '+z', x + .75, y, x + 1.25, y + .5, 0x9aa0aa);
    frect(P, '+z', 3, 21.5, 22, 21.75, variant ? 0xff6a6a : 0x6a6e78);
    for (const y of [3, 5, 7, 9]) frect(P, '+z', 12, y, 14, y + 1, (qa, qb) => (qa + qb) % 4 < 2 ? K.yellow : K.ink);
    for (const x of [9.5, 15]) frect(P, '+y', x, 2, x + .5, 2.5, 0x9aa0aa);
  } });

// ── a PEPPER FOGGER over the door, at the fine grain (lib.js SMALL: 0.025): a pressurised can held upside down in two clamps on a wall
// plate, its cap and nozzle pointing down at the doorway, a trigger box on the cap with a lit armed light, and a yellow cord from the
// trigger down to the door. The can's own label: hazard stripes, a warning diamond, a red chili, HOT FOG (our design, no maker)
export const pepperFogger = def({ id: 'pepper-fogger', name: 'Pepper fogger', cat: 'security', place: 'wall', foot: [2, 2], h: 0.3, mount: 2.0, sim: 'alarm', grain: 0.025,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['alarm', 'fogger', 'door'], variants: 1, vnames: ['orange canister'],
  does: 'Trips when the door opens: a cloud of pepper fills the doorway and whoever came in backs out coughing.',
  game: sec({ secure: 'alarm', burgleOdds: -15 }, 'rare'),
  // (`can`: the can's colour; the fogger as bought is orange. craft.js door-can is the same fogger loaded, its can in the load's colour)
  build(V, { can = 0xf2621f } = {}) {
    const cx = 9, cz = 5;
    V.box(4, 6, 0, 15, 19, 1, K.steelD, 1);                                                                       // the wall plate
    for (let y = 5; y < 18; y++) for (let z = 1; z < 10; z++) for (let x = 5; x < 14; x++) { const r = Math.hypot(x + .5 - cx, z + .5 - cz);
      const R = y >= 17 ? 3.2 : y === 5 ? 3.1 : 3.8; if (r > R) continue;
      V.set(x, y, z, y >= 17 || y === 5 ? 0xc8ccd2 : can, y >= 17 || y === 5 ? 1 : 0); }                              // the can, its silver bottom up top, its shoulder
    for (const y of [6, 16]) for (let z = 1; z < 10; z++) for (let x = 4; x < 15; x++) { const r = Math.hypot(x + .5 - cx, z + .5 - cz); if (r > 3.8 && r <= 4.8) V.set(x, y, z, K.steelD, 1); }   // two clamps
    for (let y = 2; y < 5; y++) for (let z = 3; z < 8; z++) for (let x = 7; x < 12; x++) if (Math.hypot(x + .5 - cx, z + .5 - cz) <= 2.3) V.set(x, y, z, K.ink);   // the cap
    V.box(9, 0, 6, 10, 2, 8, K.ink); V.set(9, 0, 8, K.ink);                                                       // the nozzle, down and out at the doorway
    V.box(12, 2, 3, 16, 6, 7, 0x2a2b30, 1); V.set(15, 5, 7, K.red, LIT);                                          // the trigger box, its armed light
    for (let y = 0; y < 2; y++) V.set(15, y, 5, K.yellow); V.set(15, 0, 6, K.yellow);                             // the cord, down to the door
  },
  // fine pass: the label on the can's front (hazard stripes, a warning diamond with its mark, a red chili, HOT FOG), the plate's screws,
  // the nozzle's mouth, the trigger box's lever
  fine(P, { V }) {
    const hot = inkOf('HOT', 6.75, 9.5), fog = inkOf('FOG', 10, 9.5);
    fprint(P, V, 7, 16, (X, Y) => {
      if (X < 6.25 || X > 13 || Y < 7.75 || Y > 15.5) return null;
      if (Y > 14.5) return ((X * 4 + Y * 4) | 0) % 4 < 2 ? K.yellow : K.ink;                                     // hazard stripes
      if (hot(X, Y)) return K.red; if (fog(X, Y)) return K.ink;                                                  // HOT FOG
      const dx = X - 8.5, dy = Y - 12.1, dd = Math.abs(dx) + Math.abs(dy);
      if (dd < 2) return dd > 1.6 ? K.ink : Math.abs(dx) < .25 && (dy > -.1 || (dy < -.55 && dy > -1)) && dy < 1.1 ? K.ink : K.yellow;   // the warning diamond and its mark
      const u = X - 11.4, v = Y - 12.1;
      if (u > -1.4 && u < 1.2 && Math.abs(v + u * .45) < .55 - Math.max(0, -u - .6) * .35) return K.red;          // a red chili
      if (u >= 1.1 && u < 1.6 && v > -.9 && v < -.3) return K.green;                                             // its stem
      return K.white; });
    for (const [x, y] of [[4.25, 18.25], [14.25, 18.25], [4.25, 6.25], [14.25, 6.25]]) frect(P, '+z', x, y, x + .5, y + .5, K.chrome);
    frect(P, '-y', 9.25, 8.25, 9.75, 8.75, 0x5a1a10);
    frect(P, '+z', 12.5, 3, 15.5, 3.5, K.chrome);
  } });

// ── a motion floodlight on its own pole in a bucket of concrete, a car battery taped at its foot (the older game's yard light)
export const motionFlood = def({ id: 'motion-flood', name: 'Motion floodlight', cat: 'security', place: 'floor', foot: [2, 2], h: 2.3,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['light', 'yard', 'motion'], variants: 1, vnames: ['bucket and battery'], far: true,
  does: 'Snaps on at the first step: whoever is in the yard stands lit up for the street to see, and most turn round.',
  game: sec({ burgleOdds: -10, idBurglar: true }),
  build(V) {
    cyl(V, 5, 5, 3, 0, 6, 0xd8d4c8, 1); cyl(V, 5, 5, 2.3, 5, 6, 0x9a968c);
    V.box(4, 5, 4, 6, 44, 6, 0xa8adb6, 2);
    V.box(7, 0, 7, 10, 4, 10, K.ink); V.set(7, 4, 7, K.red); V.set(9, 4, 7, K.ink);
    V.box(2, 43, 4, 8, 44, 6, K.steelD, 2);
    for (const x of [1, 6]) { V.box(x, 40, 4, x + 3, 44, 9, 0x2a2c32); V.box(x, 41, 9, x + 3, 43, 10, 0xfff6d0, 1); }
    V.box(4, 38, 6, 6, 40, 8, 0x2a2c32); V.set(4, 38, 8, 0x9a2a2a, 1);
  },
  // fine pass: the lamps' reflectors and glass, the motion eye's lens, the battery's lead into the pole, the tape round the battery
  fine(P) {
    for (const x of [1, 6]) frect(P, '+z', x, 41, x + 3, 43, (qa, qb) => (qa + qb) % 3 === 0 ? 0xfffbe8 : null);
    fdisc(P, '+z', 4.5, 38.5, .45, d => d < .2 ? K.white : 0x5a1a1a);
    hbox(P, 7, 5, 7, 7.5, 6, 7.5, K.red);
    frect(P, '+z', 7, 2, 10, 2.5, 0xb8b8b0); frect(P, '+y', 7.25, 8.25, 9.75, 8.5, 0xb8b8b0);
  } });

// ── a BEWARE OF DOG sign with nobody behind it: a weathered tin sign, a snarling head, two screws
export const dogSign = def({ id: 'dog-sign', name: 'Beware of dog sign', cat: 'security', place: 'wall', foot: [2, 2], h: 0.05, mount: 1.3,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['sign', 'dog', 'bluff'], variants: 2, vnames: ['red on white', 'yellow on black'],
  does: 'A bluff: there is no dog, but a careful burglar reads the sign and picks the next door.',
  game: sec({ burgleOdds: -5 }),
  build(V, { variant = 0 } = {}) { V.box(0, 1, 0, 10, 9, 1, variant ? K.ink : K.white); },
  // fine pass: BEWARE OF DOG, a dog's head with its teeth, a red border, rust at the screw holes
  fine(P, { variant = 0 }) {
    const ink = variant ? K.yellow : K.red, bg = variant ? K.ink : K.white;
    frect(P, '+z', 0, 1, 10, 9, (qa, qb) => qa < 2 || qa > 37 || qb < 6 || qb > 33 ? ink : null);
    ftxt(P, '+z', 'BEWARE', 1.25, 8.25, ink); ftxt(P, '+z', 'OF DOG', 1.25, 3.25, ink);
    fdisc(P, '+z', 5, 5, 1.1, (d, th) => d < 1.1 ? (Math.abs(th + 1.57) < .5 && d > .5 ? K.white : variant ? K.yellow : K.ink) : null);
    for (const x of [.5, 9]) { frect(P, '+z', x, 7.75, x + .5, 8.25, 0x8a4a2a); frect(P, '+z', x, 7.25, x + .5, 7.75, 0xb06a3a); }
  } });

// ── a panic button: a red mushroom button in a yellow box, a wire away to the phone line
export const panicButton = def({ id: 'panic-button', name: 'Panic button', cat: 'security', place: 'wall', foot: [1, 2], h: 0.15, mount: 0.9, sim: 'alarm',
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['alarm', 'button', 'muscle'], variants: 1, vnames: ['red on yellow'],
  does: 'One press and your hired help gets the call: they are on the way while the burglar is still inside.',
  game: sec({ secure: 'alarm', burgleOdds: -15 }, 'rare'),
  build(V) {
    V.box(0, 2, 0, 5, 8, 1, K.yellow, 1);
    for (let x = 0; x < 5; x++) for (let y = 3; y < 8; y++) if (Math.hypot(x + .5 - 2.5, y + .5 - 5.5) <= 1.9) V.set(x, y, 1, K.red, 1);
    for (let x = 1; x < 4; x++) for (let y = 4; y < 7; y++) if (Math.hypot(x + .5 - 2.5, y + .5 - 5.5) <= 1.2) V.set(x, y, 2, K.red, 1);
  },
  // fine pass: PUSH under the button, the box's screws, a shine on the dome, the wire running down the wall
  fine(P) {
    ftxt(P, '+z', 'SOS', .5, 3.5, K.ink);
    for (const [x, y] of [[.25, 7.5], [4.25, 7.5]]) frect(P, '+z', x, y, x + .5, y + .25, K.ink);
    frect(P, '+z', 1.5, 6, 2.25, 6.5, 0xff9a9a);
    hbox(P, 2, 0, 0, 2.5, 2, .5, K.ink);
  } });

// ── a false wall: a run of panelling like the rest, one panel on a hidden runner; open, slid over its neighbour, a dark slot with the
// stash on its shelves
export const falseWall = def({ id: 'false-wall', name: 'False wall', cat: 'stash', place: 'wall', foot: [6, 9], h: 0.25, mount: 0, sim: 'stash', states: ['closed', 'open'],
  tiers: ['apartment', 'house', 'penthouse'], tags: ['stash', 'hidden', 'room'], variants: 2, vnames: ['wood panel', 'white panel'],
  does: 'A panel that looks like the rest of the wall: the room behind it never gets searched, so the stash rides out the break-in.',
  game: g('gear', 'epic', 'craft', { stashTake: -.4 }),
  build(V, { variant = 0, state = 'closed' } = {}) {
    const c = pick([K.wood, K.bone], variant), dk = shade(c, .78), open = state === 'open';
    V.box(0, 0, 0, 30, 45, 2, c); V.box(0, 0, 2, 30, 2, 3, dk); V.box(0, 43, 2, 30, 45, 3, dk);
    for (const x of [0, 10, 20, 29]) V.box(x, 2, 2, x + 1, 43, 3, dk);
    if (!open) return;
    V.box(10, 2, 0, 20, 43, 2, 0x15120f);
    for (const y of [10, 22, 34]) V.box(11, y, 0, 19, y + 1, 2, K.ply);
    V.box(12, 11, 0, 16, 13, 2, K.cash); V.box(13, 11, 0, 14, 13, 2, K.white); V.box(12, 23, 0, 18, 27, 2, 0x26262c); V.box(14, 35, 0, 17, 37, 2, K.gold, 2);
    V.box(20, 2, 3, 30, 43, 5, c); V.box(20, 2, 3, 21, 43, 5, dk); V.box(29, 2, 3, 30, 43, 5, dk);
  },
  // fine pass: the panels' grain and their seams (the hinged one's seams as tight as the rest), the hinge's tell (one screw bright);
  // open, the notes' faces
  fine(P, { variant = 0, state = 'closed', V }) {
    const c = pick([K.wood, K.bone], variant);
    fsurf(P, V, '+z', 1, 2, 0, 29, 43, 2, (x, y, z, i, j) => variant === 0 && (x % 5 === 2 && i === 1 && hash(x, y >> 2, 3) > .55) ? shade(c, .86) : null);
    if (state !== 'open') { frect(P, '+z', 19.5, 21.25, 19.75, 21.5, 0xd8dce4); return; }
    fcolour(P, V, K.cash, ['+z', '+y'], billTex);
  } });

export const TRAPS = [decoySafe, dyePack, doorBar, pepperFogger, motionFlood, dogSign, panicButton, falseWall];
