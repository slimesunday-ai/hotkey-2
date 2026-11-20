// THE THINGS CRAFTING NAMES (craft-art-1; the owner, 2026-11-19, of the approved crafting plan: "we also need the extra
// game assets for crafting"). What you buy, cook with, pack and carry, drawn before the rules that will use them, so
// that wiring one in is one line: a config thing's `piece: 'prop:<id>'` (src/run/config.mjs), or a deal's
// `goods: '<id>'` (demo/stage/hands/things.js KINDS has every one of these as a held thing). Nothing here is a rule,
// a price or a card. The plan: docs/design/crafting-plan*.json in the hotkey-2-craft copy (its `content`, by build step).
//
// THE FORMAT is props/goods.js's (it lists these beside its own): cells of GRAIN (0.025 m), each [x, y, z, colour,
// layer] (0 matte · 1 gloss; no metal: the game draws a held thing in one material, and the tiles' metal mirrors their
// blue sky, so a tin's silver came out navy), the origin on the ground under the middle, +z the front, twice a real one.
// Every thing is ours: no maker, no logo, no real lettering; a mark is a picture of what the thing does.
//
// THE CAMERA IS 24 m UP AND 64° DOWN: held, a thing lies in the fist pointing at the camera, so what is seen is its
// TOP (or, for a can or a bottle held lying, its side) and little of its end. Each thing reads first by its colour and
// its outline from there (a rainbow of sticks, a can with a red cap, a sack, a brick of red tubes), its mark second,
// close up.
//
//   by build step (the addendum's order: 1 the pot, 2 the bench and the bottle, 3 the door, 4 the hit, 5 the book,
//   6 rounds, 7 a drink and the Sixes, 9 the woods):
//   1  tea-tin, rave-sticks, bag (and bag-<product> for every named product), foil-tray
//   2  dog-spray, paint-tin, bottle (and bottle-<filling>)
//   3  dock-red
//   4  rock-salt, rounds-box (and rounds-<filling>; shells-<family>, the plan's packed shells: salt and a bag)
//   5  syrup-bottle, blotter, cartridge, lou-tub
//   6  bangers, lighter-fluid
//   7  three-bean, gel-caps
//   9  black-root
// CRAFT (below) lists every one with its plain name, its step and its piece string.

// ── drawing: a cell set (the last colour written to a cell wins; null clears it), so no cell is ever drawn twice
function canvas() {
  const M = new Map();
  const k = (x, y, z) => `${x},${y},${z}`;
  const f = {
    set(x, y, z, c, l = 0) {
      if (c === null || c === undefined) M.delete(k(x, y, z));
      else M.set(k(x, y, z), [x, y, z, c, l]);
      return f;
    },
    has: (x, y, z) => M.has(k(x, y, z)),
    /** [x0, x1) × [y0, y1) × [z0, z1); c a colour or (x, y, z) => colour (null: leave it) */
    box(x0, y0, z0, x1, y1, z1, c, l = 0) {
      for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
        const v = typeof c === 'function' ? c(x, y, z) : c;
        if (v !== null && v !== undefined) f.set(x, y, z, v, l);
      }
      return f;
    },
    /** A cylinder standing up, its axis through (cx, cz) (cell corners: 0 is between cells -1 and 0), radius r(y) or r. */
    col(cx, cz, r, y0, y1, c, l = 0) {
      for (let y = y0; y < y1; y++) {
        const R = typeof r === 'function' ? r(y) : r;
        for (let x = Math.floor(cx - R - 1); x <= cx + R; x++) for (let z = Math.floor(cz - R - 1); z <= cz + R; z++) {
          const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
          if (d > R) continue;
          const v = typeof c === 'function' ? c(x, y, z, d, R) : c;
          if (v !== null && v !== undefined) f.set(x, y, z, v, l);
        }
      }
      return f;
    },
    /** A cylinder lying along z, its axis through (cx, cy). */
    colZ(cx, cy, r, z0, z1, c, l = 0) {
      for (let z = z0; z < z1; z++) for (let x = Math.floor(cx - r - 1); x <= cx + r; x++) for (let y = Math.floor(cy - r - 1); y <= cy + r; y++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r || y < 0) continue;
        const v = typeof c === 'function' ? c(x, y, z, d) : c;
        if (v !== null && v !== undefined) f.set(x, y, z, v, l);
      }
      return f;
    },
    /** The outermost cell on a line: '+z' the front-most at (a, b) = (x, y), '+y' the top-most at (x, z). */
    outer(face, a, b) {
      for (let d = 40; d >= -40; d--) if (face === '+z' ? f.has(a, b, d) : f.has(a, d, b)) return d;
      return null;
    },
    /** Recolours the outermost cell (the thing's skin) at (a, b) on a face. */
    paint(face, a, b, c, l = 0) {
      const d = f.outer(face, a, b);
      if (d !== null) (face === '+z' ? f.set(a, b, d, c, l) : f.set(a, d, b, c, l));
      return f;
    },
    /**
     * A 5 × 5 mark (MARKS) on a face: '+y' (read from the front: its top row at the back) at height d, '+z' (its top row
     * up) at depth d; d 'skin' paints it onto the outermost cells instead (nothing proud).
     */
    mark(name, face, x0, a0, d, c, l = 0) {
      const G = MARKS[name] ?? MARKS.dot;
      G.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch !== '#') return;
        const [a, b] = face === '+y' ? [x0 + i, a0 + j] : [x0 + i, a0 - j];
        if (d === 'skin') f.paint(face, a, b, c, l);
        else if (face === '+y') f.set(a, d, b, c, l);
        else f.set(a, b, d, c, l);
      }));
      return f;
    },
    out: () => [...M.values()],
  };
  return f;
}
const mixc = (a, b, t) => { const m = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const h3 = (x, y, z) => ((((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0) % 1000) / 1000;

// ── THE MARKS: a picture of what a thing does, 5 × 5, on a bag's sticker, a tin's lid, a box's band
export const MARKS = {
  dot: ['.....', '.###.', '.###.', '.###.', '.....'],
  z: ['#####', '...#.', '..#..', '.#...', '#####'],
  moon: ['.###.', '##...', '#....', '##...', '.###.'],
  spark: ['..#..', '.###.', '#####', '.###.', '..#..'],
  flame: ['.#...', '.##.#', '.####', '#####', '.###.'],
  drop: ['..#..', '.###.', '.###.', '#####', '.###.'],
  spiral: ['#####', '....#', '###.#', '#...#', '#####'],
  checker: ['#.#.#', '.#.#.', '#.#.#', '.#.#.', '#.#.#'],
  dumbbell: ['.....', '#...#', '#####', '#...#', '.....'],
  cloud: ['.....', '..##.', '.####', '#####', '.....'],
  clock: ['.###.', '#.#.#', '#.###', '#...#', '.###.'],
  eye: ['.....', '.###.', '#.#.#', '.###.', '.....'],
  cross: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  star: ['..#..', '..#..', '#####', '.#.#.', '#...#'],
  back: ['..#..', '.#...', '#####', '.#...', '..#..'],
  what: ['.###.', '#...#', '..##.', '.....', '..#..'],
  balloon: ['.###.', '#####', '.###.', '..#..', '..#..'],
  lips: ['.....', '##.##', '#####', '.###.', '.....'],
  dog: ['#...#', '#####', '#.#.#', '#####', '.###.'],
  anchor: ['..#..', '.###.', '..#..', '#.#.#', '.###.'],
  bang: ['#.#.#', '.###.', '##.##', '.###.', '#.#.#'],
  grain: ['#..#.', '.#..#', '#..#.', '.#..#', '#..#.'],
};

// ── the colours (the city's toon palette: saturated, no pastels but on materials)
const C = {
  ink: 0x17171b, white: 0xf7f7f2, cream: 0xfff0d0, paper: 0xf2ece0, card: 0xc8a06a, cardD: 0x9c7a4c, kraft: 0xb98a55,
  tin: 0xc9ced6, tinD: 0x8e939c, tinL: 0xe8ecf2, brass: 0xd8b04a, brassD: 0xa8862e, gold: 0xe7bd4a,
  glass: 0xcfeee6, glassD: 0x9ccfc0, cork: 0xb07a48, film: 0xe6f2f6, zip: 0xd8e6ee,
  red: 0xe8232a, redD: 0xa8161c, orange: 0xff7a1a, yellow: 0xffd21a, green: 0x25b84c, greenD: 0x1a7a36, lime: 0x8fd630,
  blue: 0x2f5bff, blueD: 0x1f3fb8, navy: 0x1f2f6e, sky: 0x5ec8ff, violet: 0x8c52ff, violetD: 0x5a2eb8, pink: 0xff4fa3,
  black: 0x26262c, grey: 0x8a8f96, greyD: 0x55595f, brown: 0x6b4428, brownL: 0x9a6a40, bean: 0x7a3b22, beanR: 0xb8322c, beanW: 0xf2e6c8,
};

// ── WHAT THE POT MAKES, by name: each a colour (the bag's contents) and a mark (its sticker). Singles are the family's
// colour (downers blue, uppers red, trips violet, mutagens green, the grail black), each its own shade so six bags on a
// shelf are six colours; a reaction (two that became something new) has a GOLD sticker and its own colour or pattern.
// The names are the plan's (the player renames what he finds: the art keys stay these).
export const PRODUCTS = {
  zonk: { name: 'Zonk', fill: [0x2a4bd8], mark: 'z', from: 'night tea' },
  syrup: { name: 'Syrup', fill: [0x55c2ff], mark: 'drop', from: 'grape syrup' },
  cooked: { name: 'Cooked', fill: [0xe8232a], mark: 'flame', from: 'dock red' },
  'disco-rash': { name: 'Disco Rash', fill: [0xff3a3a, 0xffd21a, 0x25b84c, 0x2f5bff, 0x8c52ff], stripes: true, mark: 'spark', from: 'rave sticks' },
  blotto: { name: 'Blotto', fill: [0x8c52ff], mark: 'spiral', from: 'blotter' },
  'low-res': { name: 'Low Res', fill: [0xff4fa3, 0xb02a72], checker: true, mark: 'checker', from: 'a cracked cartridge' },
  swole: { name: 'Swole', fill: [0x25b84c], mark: 'dumbbell', from: 'Lou\'s powder' },
  'crop-duster': { name: 'Crop Duster', fill: [0xb6d23a], mark: 'cloud', from: 'three-bean' },
  'tick-tock': { name: 'Tick-Tock', fill: [0xffc21a], mark: 'clock', from: 'gel caps' },
  'simon-says': { name: 'Simon Says', fill: [0x26262c, 0x8c52ff], speck: true, mark: 'eye', from: 'a black root' },
  // the reactions (the plan's and the addendum's; the last two parked)
  'disco-coma': { name: 'Disco Coma', fill: [0x2a4bd8, 0xff3a3a, 0xffd21a, 0x8c52ff], stripes: true, mark: 'moon', gold: true, from: 'night tea + rave sticks' },
  'mosh-pit': { name: 'Mosh Pit', fill: [0xe8232a, 0x8c52ff], stripes: true, mark: 'cross', gold: true, from: 'Cooked + Disco Rash' },
  pinata: { name: 'Piñata', fill: [0xf7f7f2, 0xff3a3a, 0x25b84c, 0x2f5bff, 0xffd21a], speck: true, mark: 'star', gold: true, from: 'Cooked + Swole' },
  lag: { name: 'Lag', fill: [0x55c2ff, 0xff4fa3], checker: true, mark: 'back', gold: true, from: 'Low Res + Syrup' },
  'missing-texture': { name: 'Missing Texture', fill: [0xff2fd0, 0x17171b], checker: true, mark: 'what', gold: true, from: 'Blotto + Low Res' },
  'sky-high': { name: 'Sky High', fill: [0x8fd8ff, 0x25b84c], stripes: true, mark: 'balloon', gold: true, from: 'Swole + Crop Duster' },
  'loose-lips': { name: 'Loose Lips', fill: [0xff6a9a], mark: 'lips', gold: true, parked: true, from: 'Blotto + Syrup' },
  sleepwalker: { name: 'Sleepwalker', fill: [0x2a4bd8, 0x26262c], speck: true, mark: 'moon', gold: true, parked: true, from: 'Simon Says + Zonk' },
};
/**
 * A bag of two (or three) things that do not react: the contents in each one's colour, side by side, and the first
 * one's mark. (A look for the rules to come; the named products above are what is drawn ahead.)
 */
export function mixLook(...ids) {
  const P = ids.map(id => PRODUCTS[id]).filter(Boolean);
  return { fill: P.map(p => p.fill[0]), stripes: true, mark: P[0]?.mark ?? 'dot' };
}

// ── WHAT THE BENCH PACKS: each filling a colour (the cloud's, the bottle's, the rounds' tips) and a mark
export const FILLINGS = {
  'dog-spray': { name: 'dog spray', fill: [0xf4f2ea], mark: 'dog' },
  paint: { name: 'blue paint', fill: [0x2f5bff], mark: 'drop' },
  'spray-paint': { name: 'dog spray and paint', fill: [0x9fc4ff], mark: 'drop', pair: true },
  salt: { name: 'rock salt', fill: [0xf4f6fa, 0xcfe0f0], speck: true, mark: 'grain' },
  bangers: { name: 'bangers', fill: [0xffd21a], mark: 'bang' },
  'lighter-fluid': { name: 'lighter fluid', fill: [0xff7a1a], mark: 'flame', waits: 'fire' },
  'gender-reveal': { name: 'Gender Reveal (paint and bangers)', fill: [0x2f5bff, 0xffd21a], speck: true, mark: 'bang', pair: true },
  'onion-funeral': { name: 'Onion Funeral (dog spray and bangers)', fill: [0xf4f2ea, 0xffd21a], speck: true, mark: 'drop', pair: true },
  seasoning: { name: 'Seasoning (rock salt and dog spray)', fill: [0xf4f6fa, 0xe8232a], speck: true, mark: 'grain', pair: true },
};
// the families' colours (the plan's: downers blue, uppers red, trips violet, mutagens green, the grail black)
const SHELLS = [['downer', 0x2a4bd8], ['upper', 0xe8232a], ['trip', 0x8c52ff], ['mutagen', 0x25b84c], ['grail', 0x26262c]];
// which carrier takes which (the addendum's C2 table: dog spray in a bottle only, salt and lead in rounds only)
const BOTTLE_TAKES = ['dog-spray', 'paint', 'spray-paint', 'bangers', 'lighter-fluid', 'gender-reveal', 'onion-funeral'];
const ROUNDS_TAKE = ['salt', 'paint', 'bangers', 'lighter-fluid', 'seasoning'];

/** A fill's colour at a cell: plain, in stripes along x, a checker, or specks of the others over the first. */
function fillAt(F, x, y, z) {
  const c = F.fill;
  if (c.length === 1) return c[0];
  if (F.checker) return c[(((x >> 1) + (z >> 1) + y) % c.length + c.length) % c.length];
  if (F.stripes) return c[((Math.floor((x + z * 0.5) / 2) % c.length) + c.length) % c.length];
  if (F.speck) return h3(x, y, z) < 0.3 ? c[1 + Math.floor(h3(z, x, y) * (c.length - 1))] : c[0];
  return c[0];
}

// ── THE MODELS. K is the thing's scheme (SCHEMES, below, or a look laid over it). HELD THINGS ARE LONG AND NARROW (the
// carton's shape: hands/things.js draws a held thing no wider than 0.29 m across, so a fat thing is drawn small): each
// is at most 6 cells (0.15 m) the way it lies across the fist where it can be, and as long as the thing allows.
const MODELS = {
  // 1 · A TIN OF NIGHT TEA (Zonk: they fold up where they stand, z's over them): a tall navy canister, gold rims, a cream
  // crescent moon on its front and on its lid
  'tea-tin'(K) {
    const f = canvas();
    f.col(0, 0, 2.6, 0, 12, (x, y) => (y === 0 || y === 11 ? K.rim : y === 1 ? K.rimD : K.body), 1);
    f.col(0, 0, 2.9, 12, 14, (x, y) => (y === 12 ? K.rim : K.lid), 1);
    f.col(0, 0, 1.0, 14, 15, K.rim, 1);
    f.mark('moon', '+z', -2, 8, 'skin', K.moon, 1);
    for (const [x, y] of [[1, 3], [2, 4], [1, 4], [1, 5], [2, 5]]) f.paint('+z', x - 1, y, K.zee, 1);
    for (const [x, z] of [[-1, -1], [-2, 0], [-1, 1], [0, 1], [0, -1]]) f.set(x, 13, z, K.moon);
    return f.out();
  },
  // 1 · A BOX OF RAVE STICKS (Disco Rash: skin cycling every colour, dancing): a black box, a pink star on its front, and
  // six sticks out of the top in six colours (from above: a rainbow of dots)
  'rave-sticks'(K) {
    const f = canvas();
    f.box(-3, 0, -2, 3, 7, 1, (x, y) => (y === 6 ? K.rim : K.box));
    f.mark('spark', '+z', -2, 5, 'skin', K.burst, 1);
    const hues = [0xff3a3a, 0xff9a1a, 0xffe23a, 0x5ae04a, 0x2de2e6, 0xc04aff];
    hues.forEach((c, i) => {
      const x = -3 + i, z = i % 2 ? -1 : -2, top = 10 + ((i * 5) % 3);
      f.box(x, 7, z, x + 1, top, z + 1, c, 1);
      f.set(x, top, z, 0xffffff, 1);
    });
    return f.out();
  },
  // 1 · A BAG (what the pot makes): a long zip bag lying flat, its contents puffed up in the product's colour, the zip
  // across its far end, the product's mark on top (white on a dark fill, ink on a light one); a reaction's zip is gold,
  // with a gold star in the front corner
  bag(K) {
    const f = canvas();
    const F = K.look ?? { fill: [K.fill], mark: K.mark };
    const c0 = F.fill[0], lum = 0.3 * ((c0 >> 16) & 255) + 0.59 * ((c0 >> 8) & 255) + 0.11 * (c0 & 255);
    const ink = lum > 150 ? C.ink : C.white;
    const fill = (x, y, z) => fillAt(F, x, y, z);
    f.box(-3, 0, -6, 4, 1, 7, (x, y, z) => (x === -3 || x === 3 || z === 6 ? K.film : fill(x, y, z)), 1);
    f.box(-2, 1, -5, 3, 3, 6, (x, y, z) => (y === 2 && (z === -5 || z === 5) ? null : fill(x, y, z)), 1);
    f.box(-3, 0, -7, 4, 2, -6, (x, y) => (K.gold ? (y === 1 ? C.brassD : C.gold) : y === 1 ? K.zipD : K.zip), 1);
    if (K.gold) f.box(1, 3, 3, 3, 4, 5, C.gold, 1);
    f.mark(F.mark, '+y', -2, -3, 2, ink, 1);
    return f.out();
  },
  // 1 · A FOIL TRAY (plates for the pier): an aluminium tray with a crimped rim, half yellow rice and half red stew,
  // green bits on it (the dock shift's lunch)
  'foil-tray'(K) {
    const f = canvas();
    f.box(-4, 0, -7, 4, 3, 7, (x, y, z) => {
      const edge = x === -4 || x === 3 || z === -7 || z === 6;
      if (!edge && y > 0) return null;
      return y === 2 ? (((x + z) & 1) ? K.foil : K.foilL) : K.foilD;
    }, 1);
    f.box(-3, 1, -6, 3, 2, 6, (x, y, z) => (z < 0 ? (h3(x, 1, z) < 0.12 ? K.rice2 : K.rice) : h3(x, 2, z) < 0.18 ? K.bit : h3(x, 3, z) < 0.2 ? K.stewD : K.stew));
    for (const [x, z] of [[-2, 2], [1, 3], [2, -3], [-1, -4], [0, 4]]) f.set(x, 2, z, K.green);
    return f.out();
  },
  // 2 · A CAN OF DOG SPRAY (Blind): an aerosol can, white, a red cap and its nozzle, a black band with a white dog's head
  'dog-spray'(K) {
    const f = canvas();
    f.col(0, 0, 2.6, 0, 13, (x, y) => (y === 0 ? K.rimD : y >= 4 && y <= 9 ? K.band : K.body), 1);
    f.col(0, 0, 2.0, 13, 14, K.rim, 1);
    f.col(0, 0, 2.0, 14, 17, (x, y) => (y === 16 ? K.capD : K.cap), 1);
    f.box(0, 15, 2, 1, 16, 3, K.ink);
    f.mark('dog', '+z', -2, 9, 'skin', K.dog, 1);
    return f.out();
  },
  // 2 · A TIN OF BLUE PAINT (Tagged): a paint tin, its wire handle lying over the lid, the blue run over the rim and
  // down its side, a blue band with a white drop, the lid ringed with blue
  'paint-tin'(K) {
    const f = canvas();
    f.col(0, 0, 3.0, 0, 9, (x, y, z) => {
      if (y === 8) return K.rim;
      if (y >= 2 && y <= 6) return K.paint;
      const a = Math.atan2(z + 0.5, x + 0.5);
      return Math.floor((a + Math.PI) * 3) % 3 === 0 && y === 7 ? K.paint : y === 0 ? K.tinD : K.tin;
    }, 1);
    f.col(0, 0, 3.0, 9, 10, (x, y, z, d) => (d > 2.0 ? K.paint : K.lid), 1);
    f.mark('drop', '+z', -2, 6, 'skin', K.white, 1);
    // the wire handle: its ears on the tin's sides, the wire lying across the lid
    for (const x of [-3, 2]) f.paint('+z', x, 7, K.wire, 1);
    for (let x = -3; x <= 2; x++) f.set(x, 10, 0, K.wire, 1);
    return f.out();
  },
  // 2 · A BOTTLE (the bench's: thrown, a cloud of what it holds): a tall bottle of clear glass, a cork, a strip of
  // masking tape round its middle; filled to its shoulder in the filling's colour (empty: just the glass)
  bottle(K) {
    const f = canvas();
    const F = K.look ?? null;
    // (voxels are not glass: what it holds is the colour of its skin up to its shoulder, the glass's own colour above)
    const tint = (x, y, z) => (F ? mixc(fillAt(F, x, y, z), K.glass, 0.12) : K.glassIn);
    f.col(0, 0, 2.6, 0, 12, (x, y, z) => (y === 0 ? K.glassD : y >= 5 && y <= 6 ? K.tape : y <= 10 ? tint(x, y, z) : K.glass), 1);
    f.col(0, 0, 1.8, 12, 13, K.glass, 1);
    f.col(0, 0, 1.2, 13, 17, K.glass, 1);
    f.col(0, 0, 1.0, 17, 19, K.cork);
    return f.out();
  },
  // 3 · A TIN OF DOCK RED (Cooked: a red figure pouring steam): a long red tin from the pier, its key lid rolled back to
  // the far end, red flakes in it, a white anchor on its side, a wisp of steam off the flakes
  'dock-red'(K) {
    const f = canvas();
    f.box(-3, 0, -5, 3, 4, 5, (x, y, z) => {
      const edge = x === -3 || x === 2 || z === -5 || z === 4;
      if (!edge && y > 0) return null;
      return y === 0 ? K.tinD : y === 3 ? K.tin : K.body;
    }, 1);
    f.box(-2, 1, -4, 2, 3, 4, (x, y, z) => (h3(x, y, z) < 0.25 ? K.flakeD : h3(x, z, y) < 0.15 ? K.flakeL : K.flake));
    // the lid rolled up on its key at the far end
    for (let x = -3; x < 3; x++) { f.set(x, 4, -5, K.tin, 1).set(x, 5, -5, K.body, 1).set(x, 4, -6, K.body, 1); }
    f.set(3, 4, -5, K.tinD, 1).set(4, 4, -5, K.tinD, 1).set(4, 5, -5, K.tinD, 1);
    // an anchor on the side that faces up when it is held, and the steam
    f.mark('anchor', '+y', -2, -2, 'skin', K.white, 1);
    for (const [x, y, z] of [[0, 3, 2], [0, 4, 2], [-1, 5, 1], [-1, 6, 2], [0, 7, 2]]) f.set(x, y, z, K.steam, 1);
    return f.out();
  },
  // 4 · A BAG OF ROCK SALT (Stung): a paper sack, its top rolled open on a heap of crystals, a blue band with a white
  // crystal mark
  'rock-salt'(K) {
    const f = canvas();
    f.box(-3, 0, -2, 3, 11, 3, (x, y) => (y >= 3 && y <= 7 ? K.band : (x + y) % 5 === 0 && y > 7 ? K.sackD : K.sack));
    // the rolled top (a lip round the open mouth) and the crystals heaped in it
    f.box(-3, 11, -2, 3, 12, 3, (x, y, z) => (x === -3 || x === 2 || z === -2 || z === 2 ? K.sackD : (x + z) & 1 ? K.crystal : K.crystalB), 1);
    f.box(-2, 12, -1, 2, 13, 2, (x, y, z) => ((x + z) & 1 ? K.crystalB : K.crystal), 1);
    f.mark('grain', '+z', -2, 7, 'skin', K.white, 1);
    return f.out();
  },
  // 4 · A BOX OF ROUNDS (the bench packs them: two boxes an hour): a long card box, its lid stood up behind, the rounds
  // standing in it every other place (each tip its own dot from above); marked, a band of the filling's colour round the
  // box and the lid, and the tips dipped in it (plain: an ink band, brass and copper: lead)
  'rounds-box'(K) {
    const f = canvas();
    const F = K.look ?? null;
    f.box(-5, 0, -2, 5, 3, 3, (x, y, z) => {
      const edge = x === -5 || x === 4 || z === -2 || z === 2;
      if (!edge && y > 0) return null;
      if (y === 0 && !edge) return K.floor;
      return y === 1 ? (F ? fillAt(F, x, y, z) : K.band) : y === 0 ? K.boxD : K.box;
    });
    f.box(-5, 3, -2, 5, 7, -1, (x, y) => (y === 5 ? (F ? fillAt(F, x, y, -2) : K.band) : K.box));
    for (let x = -4; x < 4; x++) for (let z = -1; z < 2; z++) {
      if ((x + z) & 1) continue;
      f.set(x, 1, z, K.case, 1).set(x, 2, z, K.case, 1);
      f.set(x, 3, z, F ? fillAt(F, x, 3, z) : K.tip, 1);
    }
    return f.out();
  },
  // 5 · A BOTTLE OF GRAPE SYRUP (Syrup: half speed, see-through copies): a squat purple bottle, a white measuring cup for
  // a cap, a cream label with a bunch of grapes
  'syrup-bottle'(K) {
    const f = canvas();
    f.col(0, 0, 2.7, 0, 8, (x, y) => (y >= 2 && y <= 6 ? K.label : K.body), 1);
    f.col(0, 0, 2.0, 8, 9, K.body, 1);
    f.col(0, 0, 1.3, 9, 10, K.body, 1);
    f.col(0, 0, 1.8, 10, 13, (x, y) => (y === 12 ? K.capD : K.cap), 1);
    for (const [x, y] of [[-1, 5], [0, 5], [1, 5], [-1, 4], [0, 4], [0, 3], [1, 4]]) f.paint('+z', x, y, K.grape, 1);
    f.paint('+z', 1, 6, K.leaf, 1);
    return f.out();
  },
  // 5 · A STRIP OF BLOTTER (Blotto: two spirals over the head, wandering in loops): a sheet lying flat, printed with a
  // violet spiral on yellow, the tear lines in a grid, one corner torn off
  blotter(K) {
    const f = canvas();
    for (let x = -4; x < 4; x++) for (let z = -6; z < 6; z++) {
      if (x >= 2 && z >= 4 && x + z >= 7) continue;
      const u = (x + 0.5) * 1.2, v = z + 0.5, r = Math.hypot(u, v), a = Math.atan2(v, u);
      const arm = ((r * 0.9 - (a / (Math.PI * 2)) * 2.4) % 2.4 + 2.4) % 2.4 < 1.15;
      const tear = (x + 4) % 3 === 0 && (z + 6) % 3 === 0;
      f.set(x, 0, z, tear ? K.tear : arm ? K.ink : K.ground);
    }
    return f.out();
  },
  // 5 · A CRACKED GAME CARTRIDGE (Low Res: the far-away blocky body, close up): grey plastic, ridges at its top end, a
  // label of big pixels, a crack across it and a corner broken off
  cartridge(K) {
    const f = canvas();
    f.box(-3, 0, -5, 3, 2, 5, (x, y, z) => (x >= 1 && z <= -4 && y === 1 ? null : z === -5 && (x & 1) ? K.ridge : K.body), 1);
    const S = 0x5ec8ff, Y = 0xffd21a, G = 0x25b84c, B = 0x8a5a2a;
    const px = [[S, S, Y, S], [S, G, S, S], [G, G, G, S], [B, B, B, B]];
    f.box(-3, 2, -2, 3, 3, 4, (x, y, z) => (x === -3 || x === 2 || z === -2 || z === 3 ? K.frame : px[z + 1][x + 2]), 1);
    for (const [x, z] of [[-3, 0], [-2, 1], [-1, 1], [0, 2], [1, 2], [2, 3]]) f.set(x, 2, z, K.crack);
    for (const [x, z] of [[2, 4]]) f.set(x, 1, z, K.crack);
    return f.out();
  },
  // 5 · A TUB OF LOU'S POWDER (Swole: a third bigger, stomping): a fat black tub, a green lid, a yellow flexed arm on its
  // front, a green band
  'lou-tub'(K) {
    const f = canvas();
    f.col(0, 0, 3.6, 0, 12, (x, y) => (y === 0 ? K.bodyD : y >= 9 ? K.band : K.body), 1);
    f.col(0, 0, 3.9, 12, 14, (x, y) => (y === 12 ? K.lidD : K.lid), 1);
    f.box(-1, 14, -1, 1, 15, 1, K.lidD, 1);
    for (const [x, y] of [[-3, 3], [-2, 3], [-1, 3], [0, 3], [1, 3], [1, 4], [1, 5], [1, 6], [2, 6], [2, 7], [0, 7], [-2, 4], [-1, 4], [-1, 5], [0, 4], [0, 5]]) f.paint('+z', x, y, K.arm, 1);
    return f.out();
  },
  // 6 · A BOX OF BANGERS (Bang): a brick of red tubes along its length in a yellow paper band with a red burst, the
  // tubes' ends capped dark, their fuses out of the front, the main one long and braided
  bangers(K) {
    const f = canvas();
    for (let x = -3; x < 3; x++) for (let y = 0; y < 4; y++) for (let z = -6; z < 6; z++) {
      const band = z >= -3 && z <= 1;
      const end = z === -6 || z === 5;
      const tube = ((x + 3) >> 1) % 2;
      f.set(x, y, z, band ? K.band : end ? ((x & 1) ^ (y & 1) ? K.cap : K.capD) : tube ? K.tube : K.tubeD, band ? 0 : 1);
    }
    f.mark('bang', '+y', -3, -3, 3, K.burst, 1);
    for (let i = 0; i < 3; i++) f.set(-3 + i * 2, 3, 6, K.fuse);
    for (let z = 6; z < 10; z++) f.set(0, 1, z, (z & 1) ? K.fuse : K.fuseD);
    return f.out();
  },
  // 6 · A CAN OF LIGHTER FLUID (Lit: waits until fire is drawn): a flat oblong can, yellow, a red spout on its shoulder,
  // a black band with an orange flame
  'lighter-fluid'(K) {
    const f = canvas();
    f.box(-3, 0, -1, 3, 13, 2, (x, y) => (y >= 4 && y <= 9 ? K.band : y === 0 ? K.canD : K.can), 1);
    f.box(-3, 13, -1, 3, 14, 2, K.canD, 1);
    f.box(1, 14, 0, 2, 16, 1, K.spout, 1);
    f.mark('flame', '+z', -2, 9, 'skin', K.flame, 1);
    return f.out();
  },
  // 7 · A POT OF THREE-BEAN (Crop Duster: a green cloud out the back): a brown bean crock, a cream rim; open:
  // brown, red and white beans, a green wisp off them
  'three-bean'(K) {
    const f = canvas();
    f.col(0, 0, y => (y < 2 ? 2.2 : y < 6 ? 2.9 : 2.6), 0, 8, (x, y, z, d, R) => {
      if (y >= 2 && d < R - 1) return null;
      return y >= 6 ? K.rim : y === 0 ? K.potD : K.pot;
    }, 1);
    f.col(0, 0, 2.0, 6, 7, (x, y, z) => { const k = h3(x, y, z); return k < 0.33 ? K.bean : k < 0.66 ? K.beanR : K.beanW; });
    for (const [x, y, z] of [[0, 7, -1], [-1, 8, -1], [-1, 9, -2], [0, 9, -2]]) f.set(x, y, z, K.stink, 1);
    return f.out();
  },
  // 7 · A STRIP OF GEL CAPS (Tick-Tock: a small clock over the head): a foil card lying flat, ten capsules in two rows,
  // half red and half white, a clock face printed at its end
  'gel-caps'(K) {
    const f = canvas();
    f.box(-3, 0, -8, 3, 1, 8, (x, y, z) => (z >= 2 ? K.card : K.foil), 1);
    for (const x of [-2, 0]) for (let k = 0; k < 5; k++) {
      const z0 = -8 + k * 2;
      f.set(x, 1, z0, K.capA, 1).set(x + 1, 1, z0, K.capA, 1);
      f.set(x, 1, z0 + 1, K.capB, 1).set(x + 1, 1, z0 + 1, K.capB, 1);
    }
    f.mark('clock', '+y', -3, 3, 0, K.ink);
    return f.out();
  },
  // 9 · A BLACK ROOT (Simon Says: they follow you in a line): a knotted black root lying on its side, thick at its cut
  // crown (glowing violet) and thin and curling at its tail, rootlets off it, twine round its middle
  'black-root'(K) {
    const f = canvas();
    for (let z = -8; z < 7; z++) {
      const t = (z + 8) / 14, r = 0.7 + 1.6 * t + 0.25 * Math.sin(z * 1.3);
      const cx = Math.round(1.2 * Math.sin((1 - t) * 2.2));
      f.colZ(cx, Math.max(r, 1.2), r, z, z + 1, (x, y) => (h3(x, y, z) < 0.2 ? K.rootL : K.root));
    }
    for (const [x0, z0, dx] of [[2, -1, 1], [-2, 2, -1], [-3, -5, -1]]) for (let k = 0; k < 2; k++) f.set(x0 + dx * k, 0, z0 + k, K.root);
    for (const x of [-1, 0, 1]) f.set(x, 4, 5 - Math.abs(x), K.rootL);
    for (let x = -3; x <= 3; x++) for (let y = 0; y <= 4; y++) if (f.has(x, y, 0)) f.set(x, y, 0, K.twine);
    f.colZ(0, 2.4, 1.6, 7, 8, K.cut, 1);
    return f.out();
  },
};

// ── the schemes: each thing's own colours (a look laid over the bag, the bottle and the box of rounds)
const SCHEMES = {
  'tea-tin': { body: C.navy, lid: 0x2a3f8e, rim: C.gold, rimD: 0xb08a2a, moon: C.cream, zee: 0x9fb4ff },
  'rave-sticks': { box: C.black, rim: 0x3a3a44, burst: C.pink },
  bag: { film: C.film, zip: C.zip, zipD: 0xb8c8d2, fill: 0xd8d8d8, mark: 'dot' },
  'foil-tray': { foil: 0xc9ced6, foilL: 0xe0e4ea, foilD: 0x9aa0aa, rice: 0xf2c94c, rice2: 0xe0a830, stew: 0xc8402a, stewD: 0x8e2a1c, bit: 0xf2e6c8, green: 0x2fbf55 },
  'dog-spray': { body: C.white, band: C.ink, dog: C.white, cap: C.red, capD: C.redD, rim: C.tin, rimD: C.tinD },
  'paint-tin': { tin: C.tin, tinD: C.tinD, rim: C.tinL, lid: 0xb8bcc4, paint: C.blue, wire: C.greyD },
  bottle: { glass: 0xa8dcbc, glassD: 0x6aa88a, glassIn: 0x9fd6b4, tape: 0xe8d9a8, cork: C.cork },
  'dock-red': { body: C.red, tin: C.tin, tinD: C.tinD, flake: 0xd8301c, flakeD: 0x9a1a10, flakeL: 0xff6a3a, white: C.white, steam: 0xf4f6fa },
  'rock-salt': { sack: 0xf2ece0, sackD: 0xd8ccb4, band: C.blue, white: C.white, crystal: 0xf4f6fa, crystalB: 0xcfe0f0 },
  'rounds-box': { box: C.kraft, boxD: 0x8e6a3e, floor: 0x3a2a18, band: C.ink, case: C.brass, tip: 0xc8743a },
  'syrup-bottle': { body: 0x6a2ab0, label: C.cream, grape: 0x7a3cff, leaf: C.green, cap: C.white, capD: 0xd8dce4 },
  blotter: { ground: C.yellow, ink: C.violet, tear: 0xd8b41a },
  cartridge: { body: 0x9a9ca6, ridge: 0x7a7c86, frame: C.white, crack: C.ink },
  'lou-tub': { body: C.black, bodyD: 0x17171b, band: C.green, lid: C.green, lidD: C.greenD, arm: C.yellow },
  bangers: { tube: C.red, tubeD: 0xc81a20, cap: 0x7a1014, capD: C.redD, band: C.yellow, burst: C.red, fuse: 0x6a4a2a, fuseD: 0x3a2a18 },
  'lighter-fluid': { can: C.yellow, canD: 0xc8a018, band: C.ink, spout: C.red, flame: C.orange },
  'three-bean': { pot: 0x8a4a22, potD: 0x5a3018, rim: C.cream, bean: C.bean, beanR: C.beanR, beanW: C.beanW, stink: 0x7ad630 },
  'gel-caps': { foil: 0xd8dce4, card: C.white, capA: C.red, capB: C.white, ink: C.ink },
  'black-root': { root: 0x1d1a1e, rootL: 0x3a2e40, twine: 0xc8a86a, cut: C.violet },
};

// ── the looks: one id for each product's bag, each filling's bottle and each filling's box of rounds
const LOOKS = [];
for (const [p, P] of Object.entries(PRODUCTS)) LOOKS.push([`bag-${p}`, 'bag', { look: P, gold: !!P.gold }, P]);
for (const b of BOTTLE_TAKES) LOOKS.push([`bottle-${b}`, 'bottle', { look: FILLINGS[b] }, FILLINGS[b]]);
for (const r of ROUNDS_TAKE) LOOKS.push([`rounds-${r}`, 'rounds-box', { look: FILLINGS[r] }, FILLINGS[r]]);
// the plan's packed shells (rock salt and one bag, the Doorman's: "a white burst in the product's colour"), one a family
for (const [fam, c] of SHELLS) LOOKS.push([`shells-${fam}`, 'rounds-box', { look: { fill: [0xf4f6fa, c], speck: true } }, null]);
export const CRAFT_MODELS = { ...MODELS };
export const CRAFT_SCHEMES = { ...SCHEMES };
/** A look's own id → the thing it is a look of ('bag-zonk' → 'bag'): its held shape is that thing's. */
export const CRAFT_BASE = {};
for (const [id, base, over] of LOOKS) {
  CRAFT_MODELS[id] = MODELS[base];
  CRAFT_SCHEMES[id] = { ...SCHEMES[base], ...over };
  CRAFT_BASE[id] = base;
}

// ── THE LIST: every thing, its plain name, the build step it belongs to, and how it is held. `piece` is what a config
// thing would name (src/run/config.mjs `piece: 'prop:<id>'`); `held` how it lies in the fist (things.js KINDS):
// 'flat' as drawn (its top up), 'side' lying on its side with its front up (a can, a bottle, a tub: the label seen from
// above); `size` the most it is drawn at in a hand (3.2, the hand-over document's largest: "keep it big for now"), less
// where the hand's own limits say (things.js).
const step = (n, rows) => rows.map(([id, name, held, size, note]) => ({ id, name, step: n, piece: `prop:${id}`, base: CRAFT_BASE[id] ?? id, held, size, note: note ?? null }));
export const CRAFT = [
  ...step(1, [
    ['tea-tin', 'A tin of night tea', 'side', 3.2],
    ['rave-sticks', 'A box of rave sticks', 'side', 3.2],
    ['bag', 'A bag (empty)', 'flat', 3.2],
    ...Object.entries(PRODUCTS).map(([p, P]) => [`bag-${p}`, `A bag of ${P.name}`, 'flat', 3.2, P.parked ? 'a parked reaction' : P.gold ? `a reaction: ${P.from}` : `from ${P.from}`]),
    ['foil-tray', 'A foil tray (plates for the pier)', 'flat', 3.2],
  ]),
  ...step(2, [
    ['dog-spray', 'A can of dog spray', 'side', 3.2],
    ['paint-tin', 'A tin of blue paint', 'side', 3.2],
    ['bottle', 'A bottle (empty)', 'side', 3.2],
    ...BOTTLE_TAKES.map(b => [`bottle-${b}`, `A bottle of ${FILLINGS[b].name}`, 'side', 3.2, FILLINGS[b].waits ? `waits on ${FILLINGS[b].waits}` : null]),
  ]),
  ...step(3, [['dock-red', 'A tin of dock red', 'flat', 3.2]]),
  ...step(4, [
    ['rock-salt', 'A bag of rock salt', 'side', 3.2],
    ['rounds-box', 'A box of rounds (plain: lead)', 'flat', 3.2],
    ...ROUNDS_TAKE.map(r => [`rounds-${r}`, `A box of rounds with ${FILLINGS[r].name}`, 'flat', 3.2, FILLINGS[r].waits ? `waits on ${FILLINGS[r].waits}` : null]),
    ...SHELLS.map(([fam]) => [`shells-${fam}`, `Packed shells: rock salt and a bag (a ${fam})`, 'flat', 3.2, 'the plan\'s shells for the Doorman']),
  ]),
  ...step(5, [
    ['syrup-bottle', 'A bottle of grape syrup', 'side', 3.2],
    ['blotter', 'A sheet of blotter', 'flat', 3.2],
    ['cartridge', 'A cracked game cartridge', 'flat', 3.2],
    ['lou-tub', 'A tub of Lou\'s powder', 'side', 3.2],
  ]),
  ...step(6, [
    ['bangers', 'A box of bangers', 'flat', 3.2],
    ['lighter-fluid', 'A can of lighter fluid', 'side', 3.2, 'waits on fire'],
  ]),
  ...step(7, [
    ['three-bean', 'A pot of three-bean', 'flat', 3.2],
    ['gel-caps', 'A strip of gel caps', 'flat', 3.2],
  ]),
  ...step(9, [['black-root', 'A black root', 'flat', 3.2]]),
];
