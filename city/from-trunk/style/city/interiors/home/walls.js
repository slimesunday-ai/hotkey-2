// Home objects · rugs (free rotation) and the wall: framed prints, posters, a graffiti canvas, family photos, big art, wood panelling.
// Pictures are painted on the +z face; frames stand 1 cube proud. No real artworks, brands or marks: every image is invented.
import { def, K, pick, cyl, line, glow, LIT, shade, mix, rng, hash, txt, M3, M5, face, fsurf } from './lib.js';

// ── rugs (h = pile height)
export const rugShag = def({ id: 'rug-shag', name: 'Shag rug', cat: 'rugs', place: 'floor', foot: [8, 6], h: 0.1, rot: 45,
  tiers: ['trailer', 'apartment', 'house'], tags: ['70s', 'shag', 'cosy'], variants: 3, vnames: ['orange', 'green', 'pink'],
  grain: 0.025, shaped: 'a shag rug: deep pile in tufts, soft rounded edges',
  grain: 0.025, shaped: 'a shag rug: deep pile in tufts, soft rounded edges',
  build(V, { variant = 0, seed = 1 } = {}) {
    // THIRD PASS · deep pile: the backing, then tufts in clumps of a few strands, each clump its own height and tone, the tips
    // catching the light; the corners rounded and the pile lower at the edge, so it reads soft and deep, not a sponge
    const c = pick([K.orange, K.grass, K.pink], variant), W = 80, D = 60;
    const inRug = (x, z) => { const ex = Math.min(x, W - 1 - x), ez = Math.min(z, D - 1 - z); return ex >= 0 && ez >= 0 && !(ex < 5 && ez < 5 && Math.hypot(5 - ex, 5 - ez) > 5.2); };
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) { if (!inRug(x, z)) continue;
      const cx = Math.floor(x / 4), cz = Math.floor(z / 4), q = hash(cx, cz, seed), edge = Math.min(x, W - 1 - x, z, D - 1 - z);
      const h = edge < 2 ? 1 : edge < 4 ? 2 : 2 + (q > .5 ? 1 : 0), lean = hash(cx + 7, cz, seed) > .5;
      V.set(x, 0, z, shade(c, .72));
      for (let y = 1; y <= h; y++) V.set(x, y, z, y === h ? (q > .7 ? mix(c, K.white, .22) : q < .2 ? shade(c, .86) : c) : shade(c, .85));
      if (lean && h > 2 && (x % 4 === 1) && x + 1 < W && inRug(x + 1, z)) V.set(x + 1, h, z, mix(c, K.white, .12));   // a strand laid over
    }
  } });

export const rugPersian = def({ id: 'rug-persian', name: 'Persian-style rug', cat: 'rugs', place: 'floor', foot: [10, 7], h: 0.05, rot: 45,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['classic', 'heirloom', 'pattern'], variants: 3, vnames: ['red + navy', 'navy + red', 'emerald + gold'], far: true,
  build(V, { variant = 0 } = {}) {
    const [F, B, A, T] = pick([[0xb3202a, K.navy, K.gold, K.cream], [K.navy, 0xb3202a, K.cream, K.gold], [0x1f6a4a, K.gold, 0xb3202a, K.cream]], variant);
    for (let x = 0; x < 50; x++) for (let z = 0; z < 35; z++) {
      if (x < 2 || x > 47) { if (z % 2 === 0 && z > 0 && z < 34) V.set(x, 0, z, K.cream); continue; }                       // fringe
      const u = x - 2, w = z, d = Math.min(u, 45 - u, w, 34 - w); let c;
      if (d === 0) c = shade(B, .7);
      else if (d <= 4) { const along = (d === Math.min(u, 45 - u) ? w : u); c = ((along + d) % 4 === 0 || (along - d + 40) % 4 === 0) ? A : B; }   // the border, a zig-zag vine
      else if (d === 5) c = T;
      else { const m = Math.abs(u - 22.5) / 13 + Math.abs(w - 17) / 9, cu = Math.min(u - 6, 39 - u), cw = Math.min(w - 6, 28 - w);
        c = m < .28 ? (m < .12 ? T : B) : m < .42 ? A : m < .5 ? T : (cu / 7 + cw / 5 < 1) ? A : ((u % 6 === 3 && w % 5 === 2) || (u % 6 === 0 && w % 5 === 0)) ? T : F; }
      V.set(x, 0, z, c); }
  } });

export const rugLogo = def({ id: 'rug-logo', name: 'Logo rug', cat: 'rugs', place: 'floor', foot: [6, 6], h: 0.1, rot: 45,
  tiers: ['apartment', 'penthouse'], tags: ['hypebeast', 'tufted', 'statement'], variants: 3, vnames: ['frown drip', 'coin', 'flame'],
  build(V, { variant = 0 } = {}) {
    const put = (x, z, c, raised) => { V.set(x, 0, z, c); if (raised) V.set(x, 1, z, c); };
    if (variant === 0) { for (let x = 0; x < 30; x++) for (let z = 0; z < 30; z++) { const r = Math.hypot(x + .5 - 15, z + .5 - 13.5);   // the NO VIBES face: a frown with a drip
        const drip = x >= 19 && x < 22 && z >= 20 && z < 28 + (x === 20 ? 1 : 0), drop = Math.hypot(x + .5 - 20.5, z + .5 - 27.5) < 2;
        if (r > 13 && !drip && !drop) continue;
        const eye = Math.hypot(x + .5 - 10.5, (z + .5 - 10) * .7) < 2 || Math.hypot(x + .5 - 19.5, (z + .5 - 10) * .7) < 2, fr = Math.hypot(x + .5 - 15, z + .5 - 22.5), frown = fr > 6.2 && fr < 8 && z < 19;
        put(x, z, eye || frown ? K.ink : K.yellow, eye || frown); } return; }
    if (variant === 1) { const M = M5('$'); for (let x = 0; x < 30; x++) for (let z = 0; z < 30; z++) { const r = Math.hypot(x + .5 - 15, z + .5 - 15); if (r > 14.2) continue;
        const i = Math.floor((x - 10) / 2), j = Math.floor((z - 8) / 2), g = i >= 0 && i < M.w && j >= 0 && j < 7 && M.at(i, j);
        put(x, z, r > 12.4 ? K.gold : g ? K.gold : r > 11.4 ? 0x1f6a3a : K.grass, r > 12.4 || g); } return; }
    for (let x = 0; x < 30; x++) for (let z = 0; z < 30; z++) {                                                                     // a flame, tip to the back
      const t = (z - 1) / 28; if (t < 0 || t > 1) continue; const wob = Math.sin(z * .9) * 1.2, half = 13 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), .9) * (t < .1 ? t * 10 : 1), dx = Math.abs(x + .5 - 15 - wob * (1 - t));
      if (dx > half) continue; const k = dx / Math.max(1, half); put(x, z, t > .45 && k < .38 ? K.yellow : k < .72 ? K.orange : K.red, k > .72 || (t > .45 && k < .38)); }
  } });

export const rugRag = def({ id: 'rug-rag', name: 'Rag rug', cat: 'rugs', place: 'floor', foot: [7, 5], h: 0.05, rot: 45,
  tiers: ['trailer', 'house', 'apartment'], tags: ['handmade', 'braided', 'oval'], variants: 3, vnames: ['warm', 'blues', 'mixed'],
  build(V, { variant = 0 } = {}) {
    const P = pick([[K.red, K.cream, K.mustard, 0x6e3e19, K.cobalt, K.cream], [K.cobalt, K.sky, K.white, K.navy, K.teal, K.white], [K.pink, K.grass, K.yellow, K.purple, K.orange, K.cream]], variant);
    for (let x = 0; x < 35; x++) for (let z = 0; z < 25; z++) { const dx = (x + .5 - 17.5) / 17.4, dz = (z + .5 - 12.5) / 12.4, e = Math.hypot(dx, dz); if (e > 1) continue;
      const k = Math.floor(e * 8), c = P[k % P.length], a = Math.round(Math.atan2(dz, dx) * (6 + k * 2)); V.set(x, 0, z, (a + k) & 1 ? c : shade(c, .84)); }
  } });

// ── pictures. img(kind): a function (i, j, w, h) → colour, j = 0 at the bottom row
export function picture(kind, seed = 1) {
  const r = rng(seed * 13 + 1), sky = [];
  switch (kind) {
    case 'boat': return (i, j, w, h) => { const sun = Math.hypot(i - w * .74, j - h * .8) < 2.2, sea = j < h * .36, mast = i === Math.round(w * .45) && j >= h * .36 && j < h * .9;
      const hull = j >= h * .3 && j < h * .42 && i >= w * .2 + (h * .42 - j) && i < w * .75 - (h * .42 - j), sail = j >= h * .45 && j < h * .88 && i < w * .45 && i >= w * .45 - (h * .88 - j) * .6;
      return hull ? K.red : mast ? K.woodD : sail ? K.white : sun ? K.yellow : sea ? ((i + j * 3) % 7 === 0 ? K.white : K.cobalt) : K.sky; };
    case 'skyline': { for (let i = 0; i < 30; i++) sky.push(2 + ((r() * 6) | 0)); return (i, j, w, h) => j < sky[i] + (i % 3 === 0 ? 1 : 0) ? K.purple : (Math.hypot(i - w * .5, j - h * .28) < 3 ? K.yellow : j > h * .72 ? K.pink : j > h * .5 ? K.orange : K.amber); }
    case 'bananas': return (i, j, w, h) => { const b = (cx, cy, R) => { const d = Math.hypot(i - cx, j - cy); return d > R - 1.6 && d < R && j < cy; };
      return b(w * .45, h * .78, 5.5) || b(w * .58, h * .62, 5) ? (i < 2 || i > w - 3 ? 0x6e3e19 : K.yellow) : ((i + j) % 4 === 0 ? 0xc81f28 : K.red); };
    case 'field': return (i, j, w, h) => { const e = Math.round(Math.sin(i * 1.3 + seed) * .6); return j < h * .3 + e ? K.cobalt : j < h * .62 - e ? K.orange : K.pink; };
    default: return () => K.white;
  }
}
export function framed(V, w, h, img, frame, z0 = 0, l = 0) {   // a frame (1 cube, proud) and the picture set 1 cube back
  V.box(0, 0, z0, w, h, z0 + 2, frame, l); for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) { V.del(i, j, z0 + 1); V.set(i, j, z0, img(i - 1, j - 1, w - 2, h - 2)); }
}
export const artPrint = def({ id: 'art-print', name: 'Framed print', cat: 'wall', place: 'wall', foot: [3, 4], h: 0.1, mount: 1.1,
  tiers: ['trailer', 'apartment', 'house', 'penthouse'], tags: ['art', 'frame'], variants: 4, vnames: ['boat, gold frame', 'skyline, black frame', 'bananas, white frame', 'colour field, oak frame'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    framed(V, 15, 20, picture(pick(['boat', 'skyline', 'bananas', 'field'], variant), seed), pick([K.gold, K.ink, K.white, K.oak], variant), 0, variant === 0 ? 2 : 0);
  } });

export const poster = def({ id: 'poster', name: 'Poster', cat: 'wall', place: 'wall', foot: [4, 5], h: 0.1, mount: 1.0,
  tiers: ['apartment', 'house'], tags: ['posters', 'bedroom', 'taped'], variants: 4, vnames: ['KO fight night', 'LOOT the movie', 'LIVE gig', 'TAPE mixtape'],
  build(V, { variant = 0, seed = 1 } = {}) {
    const W = 20, H = 25, bg = pick([K.yellow, K.ink, K.pink, K.cyan], variant), fg = pick([K.ink, K.red, K.white, K.ink], variant);
    V.box(0, 0, 0, W, H, 1, bg);
    const word = pick(['KO', 'LOOT', 'LIVE', 'TAPE'], variant), M = M3(word), sc = variant === 0 ? 2 : 1; txt(V, M, Math.round((W - M.w * sc) / 2), H - 2, 0, fg, 0, sc);
    if (variant === 0) { for (const x0 of [3, 11]) { V.box(x0, 7, 0, x0 + 6, 12, 1, K.red); V.box(x0 + (x0 < 10 ? 5 : -1), 8, 0, x0 + (x0 < 10 ? 7 : 1), 11, 1, K.red); V.box(x0 + 1, 5, 0, x0 + 5, 7, 1, K.white); }
      V.box(2, 0, 0, 18, 6, 1, K.red); txt(V, M3('FRI'), 5, 5, 0, K.white); }
    if (variant === 1) { face(V, 5, 4, 0, 10, 11, { skin: 0x2a2a31, hair: 0x2a2a31, eye: K.white, mouth: K.red }); V.box(6, 9, 0, 14, 11, 1, K.skin[2]); V.set(7, 10, 0, K.ink); V.set(12, 10, 0, K.ink); V.box(8, 5, 0, 12, 7, 1, K.skin[2]); V.box(9, 5, 0, 11, 6, 1, K.red); }   // a balaclava
    if (variant === 2) { V.box(3, 3, 0, 8, 15, 1, K.ink); V.box(12, 3, 0, 17, 15, 1, K.ink); for (const x of [5.5, 14.5]) for (const y of [6, 11]) { V.set(Math.floor(x), y, 0, K.grey); V.set(Math.floor(x), y + 1, 0, K.grey); }
      V.box(9, 3, 0, 11, 13, 1, K.purple); V.box(8, 13, 0, 12, 16, 1, K.skin[3]); }                                                 // speaker stacks, a singer
    if (variant === 3) { V.box(2, 5, 0, 18, 15, 1, K.ink); V.box(4, 11, 0, 16, 14, 1, K.orange); for (const x of [6, 13]) { V.box(x, 7, 0, x + 2, 9, 1, K.white); V.set(x, 8, 0, K.ink); } V.box(8, 6, 0, 12, 7, 1, K.grey); }   // a cassette
    for (const [x, y] of [[0, 0], [W - 2, 0], [0, H - 2], [W - 2, H - 2]]) V.box(x, y, 1, x + 2, y + 2, 2, K.cream);                  // tape on the corners
  } });

export const artGraffiti = def({ id: 'art-graffiti', name: 'Graffiti canvas', cat: 'wall', place: 'wall', foot: [6, 4], h: 0.1, mount: 1.1,
  tiers: ['apartment', 'house', 'penthouse'], tags: ['art', 'street', 'spray paint'], variants: 3, vnames: ['BAD on white', 'ICE on black', 'YO! on brick'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    // THIRD PASS · no loose cubes: the canvas, and on it, flat, a tag in fat letters with an outline, a drop shadow and long drips;
    // the spray mist, the shines and a star painted (fine)
    const [word, bg, fill, shd] = pick([['BAD', K.white, K.pink, K.purple], ['ICE', 0x1f1f24, K.cyan, K.cobalt], ['YO!', K.brick, K.yellow, K.red]], variant), r = rng(seed * 7 + variant);
    V.box(0, 0, 0, 30, 20, 1, bg);                                                                                        // the canvas
    const M = M5(word), sc = Math.min(2, 26 / M.w), X0 = Math.round((30 - M.w * sc) / 2), Y = 17, on = (x, y) => { const i = Math.floor((x - X0) / sc), j = Math.floor((Y - y) / 2); return i >= 0 && i < M.w && j >= 0 && j < 7 && M.at(i, j); };
    const fat = (x, y) => on(x, y) || on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1), rim = (x, y) => !fat(x, y) && (fat(x - 1, y) || fat(x + 1, y) || fat(x, y - 1) || fat(x, y + 1));
    for (let x = 0; x < 30; x++) for (let y = 0; y < 20; y++) { if (rim(x, y) || fat(x, y)) V.set(x, y, 1, fat(x, y) ? fill : K.ink); else if (fat(x - 1, y + 1)) V.set(x, y, 1, shd); }   // letters, outline, shadow
    for (let x = 1; x < 29; x++) if (fat(x, 4) && !fat(x, 3) && r() < .5) { const n = 2 + ((r() * 3) | 0); for (let k = 1; k <= n && 4 - k >= 0; k++) V.set(x, 4 - k, 1, fill); }   // drips, flat on the canvas
  },
  fine(P, { variant = 0, seed = 1, V } = {}) {
    // the spray mist round the letters, white shines on them, a little star
    const [bg, fill] = pick([[K.white, K.pink], [0x1f1f24, K.cyan], [K.brick, K.yellow]], variant);
    fsurf(P, V, '+z', 0, 0, 0, 30, 20, 2, (x, y, z, i, j) => { const h = hash(x * 4 + i, y * 4 + j, seed);
      if (z === 0 && h > .95 && (x + y) % 2) return mix(bg, fill, .45);                                                                 // mist on the bare canvas
      if (z === 1 && V.pal[V.d[x + z * V.nx + y * V.sxz]] === fill && i === 1 && j >= 2 && (x + y) % 4 === 0) return K.white;   // shines
      return null; });
  } });

export const photosFamily = def({ id: 'photos-family', name: 'Family photos', cat: 'wall', place: 'wall', foot: [4, 3], h: 0.1, mount: 1.2,
  tiers: ['trailer', 'apartment', 'house'], tags: ['family', 'frames', 'memories'], variants: 2, vnames: ['gold frames', 'mixed frames'],
  build(V, { variant = 0, seed = 1 } = {}) {
    const r = rng(seed * 29 + 3), F = variant ? [K.ink, K.oak, K.white, K.red, K.gold] : [K.gold, K.gold, K.oak, K.gold, K.gold];
    [[0, 7, 7, 8, 1], [8, 8, 5, 6, 1], [14, 7, 6, 8, 1], [1, 0, 6, 6, 1], [8, 0, 11, 7, 3]].forEach(([x0, y0, w, h, n], k) => {
      V.box(x0, y0, 0, x0 + w, y0 + h, 2, F[k], F[k] === K.gold ? 2 : 0); const bg = pick([K.sky, K.cream, K.pink, K.grass, K.amber], (r() * 5) | 0);
      for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) { V.del(x0 + i, y0 + j, 1); V.set(x0 + i, y0 + j, 0, bg); }
      const fw = Math.max(3, Math.floor((w - 2) / n)); for (let q = 0; q < n; q++) { const hw = Math.min(fw, 5), hh = Math.min(h - 3, 5);
        face(V, x0 + 1 + q * fw + ((fw - hw) >> 1), y0 + 1, 0, hw, hh, { skin: pick(K.skin, (r() * 5) | 0), hair: pick([K.ink, K.woodD, K.amber, K.red, K.white], (r() * 5) | 0) }); } });
  } });

export const artBig = def({ id: 'art-big', name: 'Big canvas', cat: 'wall', place: 'wall', foot: [8, 6], h: 0.1, mount: 0.8,
  tiers: ['house', 'penthouse'], tags: ['art', 'statement', 'collector'], variants: 3, vnames: ['pink field', 'cobalt field', 'yellow field'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const [bg, skin, hair, top] = pick([[K.pink, K.skin[3], K.ink, K.yellow], [K.cobalt, K.skin[5], K.red, K.white], [K.yellow, K.skin[1], K.purple, K.ink]], variant);
    V.box(0, 0, 0, 40, 30, 2, bg); const z = 1;
    V.box(9, 0, z, 31, 6, z + 1, top); V.box(17, 5, z, 23, 8, z + 1, skin);                                   // shoulders, neck
    V.box(11, 7, z, 29, 27, z + 1, skin); V.box(10, 9, z, 11, 25, z + 1, skin); V.box(29, 9, z, 30, 25, z + 1, skin);   // the big head
    V.box(10, 22, z, 30, 29, z + 1, hair); V.box(9, 20, z, 12, 26, z + 1, hair); V.box(28, 20, z, 31, 26, z + 1, hair);   // hair
    for (const x of [14, 22]) { V.box(x, 15, z, x + 5, 18, z + 1, K.white); V.box(x + 2, 15, z, x + 4, 17, z + 1, K.ink); V.box(x, 17, z, x + 5, 19, z + 1, shade(skin, .8)); }   // bored eyes, heavy lids
    V.box(16, 10, z, 25, 12, z + 1, K.gold, 2); for (let x = 17; x < 25; x += 2) V.set(x, 10, z, shade(K.gold, .7));    // a gold grill
    for (let x = 31; x < 38; x++) V.set(x, 3 + ((x * 7 + seed) % 3 === 0 ? 1 : 0), z, K.ink);                   // the artist's signature
  } });

export const panelling = def({ id: 'wall-panelling', name: 'Wood panelling', cat: 'wall', place: 'wall', foot: [4, 10], h: 0.1, mount: 0,
  tiers: ['trailer', 'house'], tags: ['trailer', '70s', 'wood'], variants: 2, vnames: ['honey', 'dark'], far: true,
  build(V, { variant = 0, seed = 1 } = {}) {
    const c = pick([K.woodL, 0x8b5a2b], variant), d = shade(c, .74);
    V.box(0, 0, 0, 20, 50, 1, (x, y) => x % 5 === 0 ? d : (hash(x, (y / 4) | 0, seed) > .86 ? shade(c, .88) : c));   // grooves every 0.25 m, grain
    V.box(0, 0, 1, 20, 3, 2, shade(c, .6));                                                                         // baseboard
  } });

export const WALLS = [rugShag, rugPersian, rugLogo, rugRag, artPrint, poster, artGraffiti, photosFamily, artBig, panelling];
