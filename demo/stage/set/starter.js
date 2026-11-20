// THE RUN'S CRIB: THE STARTER PACK. The owner, 2026-11-13: "it needs to be modular for multiplayer and people should
// be allowed to arrange things with a starter pack, we have a whole home buildr we should bring that in" · "go with
// your suggestions on rebuilding the trailer to the lenght you specified, we need a better layout for multiplayer".
//
// The player's crib in THE RUN is not one of the city's three preset trailers (a room 5 m by 3.5 m, its boxes in front
// of the door) but a layout of our own, in the city's own assembly format (interiors/home FORMAT.md "Assemblies"), kept
// in the game's tree (homes/trailer-starter.json, and -b for the second arrangement): 7 m by 3.5 m, twice as wide as
// deep like a single-wide, the door in the middle of the long front side. It passes the kit's own homes check
// (demo/tools/crib-check.mjs runs the pinned check.mjs on it), so the city's home builder could edit it.
//
// What the inside view builds is the layout with two differences, both said here and nowhere else:
//   · the kit's `door-front` is left out of the room as built: the kit hangs a door on a side wall (its front is cut
//     away), and the inside view has its own doorway in the low front wall (set/crib.js). The layout keeps it: the
//     kit's rules want one, and the builder would show it.
//   · what the run owns shows: the real bed in the mattress's place (`owned.bed`), and the things bought for the
//     trailer (goods-1, `owned.things`), each at one fixed spot of each arrangement, as the kit's own pieces (THINGS
//     below). The layout's own box fan is the one bought: it shows from the day it is.
// The floorboard slot always shows its floorboard: that is where the cash goes (the stash beat is played beside it).
//
//   const starter = await createStarter({ base })     base: the URL of this folder
//   starter.use({ pad, owned })                        the run says which pad is the player's and what is owned now
//   starter.roomFor(key) → { name, A, fills, owner, wealth, key, starter: { door, stand, bed } } | null
//   starter.sig(key) → a string that changes whenever the room built for the pad must change, or null
//
// `?crib=b` builds the second arrangement (variant B) instead of the first (A, the default).

import { RUN_CONFIG } from '../../../src/run/config.mjs';
import { pieceOf } from '../../../src/run/library.mjs';

/** The pieces a starter crib is made of (the starter pack), for the report and the tools. */
export const PACK = ['mattress-floor', 'table-end', 'lamp-table', 'art-print', 'poster', 'tv-console', 'tv-crt', 'table-coffee', 'recliner', 'rug-rag', 'box-fan', 'kitchenette', 'plant-cactus', 'boxes-moving', 'window', 'door-front', 'stash-floorboard'];
/** The real bed that takes the mattress's place once it is owned (same corner, same turn, the kit's double bed). */
const BED = { id: 'bed-double', variant: 0 };
/**
 * THE THINGS FOR THE TRAILER (goods-1: src/run/config.mjs `things`, kind 'home'), by arrangement: the kit's own piece
 * and where it goes, in cells as the layout's items: an item (`x`, `z`; `top` names the item it stands on), the
 * layout's own slot it fills (`fill`), or a floor slot of its own (`slot`: a fish tank is a collectible, which the
 * kit's rules bring in through a slot). Clear of the bed, the walk from the door to where the player stands, and the
 * floorboard: the kit's own check passed on each arrangement with all of them in (run-18, demo/tools/crib-check.mjs
 * on the layouts as built). `own`: the layout's own box fan, left out until it is owned. `where` is said on the page.
 */
export const THINGS = {
  a: {
    lavalamp: { id: 'lava-lamp', fill: 'on-the-counter', where: 'on the kitchen counter' },
    fishtank: { id: 'fish-tank', slot: { x: 13, z: 0, rot: 0, foot: [4, 2] }, where: 'against the back wall, by the counter' },
    beanbag: { id: 'beanbag', x: 2, z: 9, where: 'on the rug at the foot of the mattress' },
    boxfan: { id: 'box-fan', own: true, where: 'by the moving boxes' },
    // (home-1: the floor safe, the kit's own small safe, a 'gear' piece, so through a floor slot of its own; a trailer
    // marks four slots at most, so the empty trophy slot over the counter, which the run never fills, makes way for it)
    floorsafe: { id: 'safe-small', slot: { x: 23, z: 3, rot: 0, foot: [2, 3] }, fits: ['gear'], frees: 'over-the-counter', where: 'on the floor at the end of the counter, by the boxes' },
    // (sixes-1: the slice's pieces, the kit's own: the dog's bed and bowls on the floor by the front (the dog sits by it:
    // set/crib.js), the camera and the dog sign on the back wall. The door bar goes on the door: set/crib.js)
    dog: { id: 'dog-bed', x: 21, z: 10, where: 'on the floor by the front, his bed and bowls' },
    camera: { id: 'cctv-camera', x: 6, z: 0, wall: 'N', where: 'high on the back wall, looking at the door' },
    dogsign: { id: 'dog-sign', x: 13, z: 0, wall: 'N', where: 'on the back wall by the poster' },
  },
  b: {
    lavalamp: { id: 'lava-lamp', x: 12, z: 0, top: 'dresser', where: 'on the dresser, by the TV' },
    fishtank: { id: 'fish-tank', slot: { x: 0, z: 6, rot: 90, foot: [4, 2] }, where: 'against the side wall, by the boxes' },
    beanbag: { id: 'beanbag', x: 13, z: 3, where: 'on the floor beside the recliner' },
    boxfan: { id: 'box-fan', own: true, where: 'by the mattress' },
    floorsafe: { id: 'safe-small', slot: { x: 3, z: 3, rot: 0, foot: [2, 3] }, fits: ['gear'], frees: 'over-the-counter', where: 'on the floor under the end of the counter, by the boxes' },
    dog: { id: 'dog-bed', x: 21, z: 10, where: 'on the floor by the front, his bed and bowls' },
    camera: { id: 'cctv-camera', x: 11, z: 0, wall: 'E', where: 'high on the side wall, looking at the door' },
    dogsign: { id: 'dog-sign', x: 24, z: 0, wall: 'N', where: 'on the back wall by the bed' },
  },
};
/** Where the player stands at home (room cells, the walker's node: its middle at the cells' shared corner): on the door's line, 1.25 m in. */
const STAND_IN = 9;

export async function createStarter({ base = new URL('./', import.meta.url).href } = {}) {
  const Q = new URLSearchParams(location.search);
  const variant = (Q.get('crib') ?? 'a').toLowerCase() === 'b' ? 'b' : 'a';
  const file = variant === 'b' ? 'trailer-starter-b.json' : 'trailer-starter.json';
  const layout = await fetch(new URL(`homes/${file}`, base)).then(r => (r.ok ? r.json() : null)).catch(() => null);
  let pad = null;
  let owned = () => ({});

  /**
   * The layout in the kit's own format for what `has` says is owned, each piece at its own spot: the kit's door kept
   * (the kit's check wants it), the bed in the mattress's place, the things for the trailer added (or the layout's
   * box fan kept) where THINGS puts them. Every piece carries a `key` that names it whatever moves (`i<n>`: the n-th
   * item of the layout file; `t:<thing>`: a thing for the trailer, an item or its own floor slot), and every slot its
   * piece as `fill` (the builder's saved format: the floorboard, a thing's slot, the counter's lava lamp) or null.
   * The run's arrangement (set/arrange.js) starts from this, and the inside view builds what that makes of it.
   */
  function kitWith(has) {
    const A = structuredClone(layout);
    A.items.forEach((it, k) => (it.key = `i${k}`));
    if (has.bed) A.items = A.items.map(it => (it.id === 'mattress-floor' ? { ...it, ...BED } : it));
    // (the things for the trailer: the box fan of the layout only once owned, the others added where THINGS puts them;
    // a `top` is re-pointed to its item's index)
    const put = THINGS[variant] ?? {};
    for (const [item, t] of Object.entries(put)) {
      const k = t.own ? A.items.findIndex(it => it.id === t.id) : -1;
      if (k < 0) continue;
      if (has.things?.[item]) {
        A.items[k].key = `t:${item}`;
        continue;
      }
      A.items.splice(k, 1);
      A.items = A.items.map(it => (it.on?.top !== undefined && it.on.top > k ? { ...it, on: { top: it.on.top - 1 } } : it));
      A.slots = A.slots.map(sl => (sl.place === 'surface' && sl.on > k ? { ...sl, on: sl.on - 1 } : sl));
    }
    A.slots = A.slots.map(sl => ({ ...sl, fill: sl.fits.includes('stash') ? { id: sl.demo, variant: sl.variant ?? 0 } : null }));
    for (const [item, t] of Object.entries(put)) {
      if (t.own || !has.things?.[item]) continue;
      if (t.fill) {
        const sl = A.slots.find(s => s.id === t.fill);
        if (sl) sl.fill = { id: t.id, variant: 0, key: `t:${item}` };
        continue;
      }
      if (t.slot) {
        // (`frees`: an empty slot of the layout that makes way, so the room keeps to the kit's count of slots)
        if (t.frees) A.slots = A.slots.filter(s => s.id !== t.frees || s.fill);
        A.slots.push({ id: `thing-${item}`, label: t.where, place: 'floor', ...t.slot, demo: t.id, variant: 0, fits: t.fits ?? ['collectible'], key: `t:${item}`, fill: { id: t.id, variant: 0 } });
        continue;
      }
      const under = t.top ? A.items.findIndex(it => it.id === t.top) : -1;
      if (t.top && under < 0) continue;
      A.items.push({ id: t.id, x: t.x, z: t.z, rot: 0, variant: 0, on: t.top ? { top: under } : t.wall ? { wall: t.wall } : 'floor', key: `t:${item}` });
    }
    // (part D: the layout's empty wall slot, the trophy shelf over the counter the run never fills, is not kept: the
    // kit's check would hold that stretch of wall for it, empty, and no picture could hang there)
    A.slots = A.slots.filter(sl => sl.place !== 'wall' || sl.fill);
    // (lib-1: every other home thing owned that is a kit piece, the library's too: in the tray until the player puts it
    // down (set/arrange.js: a key `L:<thing>` is away unless it has been put somewhere). Its true footprint, the kit's)
    for (const [item, id] of has.tray ?? []) A.items.push({ id, x: 0, z: 0, rot: 0, variant: 0, on: 'floor', key: `L:${item}` });
    return A;
  }
  /** The kit's layout as the inside view builds it: no kit door (ours is in the front wall). */
  function withoutDoor(K) {
    const A = structuredClone(K);
    // (`on: { top }` and a surface slot's `on` are indices into the item list: re-pointed past the door taken out)
    const keep = A.items.map(it => it.id !== 'door-front');
    const at = [];
    let n = 0;
    for (const k of keep) at.push(k ? n++ : -1);
    A.items = A.items.filter((_, i) => keep[i]).map(it => (it.on?.top !== undefined ? { ...it, on: { top: at[it.on.top] } } : it));
    A.slots = A.slots.map(s => (s.place === 'surface' ? { ...s, on: at[s.on] } : s));
    return A;
  }
  /** The layout as the inside view builds it: what is owned, as the run has arranged it (set/arrange.js), no kit door. */
  function built(has) {
    const K = kitWith(has);
    const A = withoutDoor(arranger?.apply(K, has) ?? K);
    A.name = `${layout.name}${has.bed ? '-bed' : ''}${thingsSig(has)}${arranger?.sig(has) ?? ''}`;
    return A;
  }
  /** THE RUN'S ARRANGEMENT (set/arrange.js): `apply(kit, has)` → the kit's layout as arranged; `sig(has)` → '' when untouched. */
  let arranger = null;
  /** What of the run's things the room shows now: the bed, and the things for the trailer (the pocket and the box cutter are carried, not kept). */
  const shows = () => {
    const o = owned() ?? {};
    const own = Object.keys(o.things ?? {}).filter(k => o.things[k]);
    return {
      bed: !!o.bed,
      things: Object.fromEntries(Object.keys(THINGS[variant] ?? {}).filter(k => o.things?.[k]).map(k => [k, true])),
      // (lib-1) the tray's: [thing, kit id], every home thing owned with a kit piece and no spot of its own above
      tray: own.filter(k => !THINGS[variant]?.[k]).map(k => [k, trayId(k)]).filter(([, id]) => id).sort((a, b) => (a[0] < b[0] ? -1 : 1)),
      // (the deadbolt: the kit's door chain and locks, on the door's leaves: set/crib.js)
      door: !!o.things?.deadbolt,
      // (sixes-1: the door bar, across the inside of the door: set/crib.js)
      bar: !!o.things?.doorbar,
    };
  };
  /** The kit piece a home thing is, if it goes in the room (the deadbolt's locks go on the door instead). */
  const trayId = k => {
    const piece = pieceOf(RUN_CONFIG, k);
    if (!piece?.startsWith('kit:') || piece === 'kit:door-locks' || piece === 'kit:door-bar') return null;
    if (RUN_CONFIG.things[k] && RUN_CONFIG.things[k].kind !== 'home') return null;
    return piece.slice(4);
  };
  const thingsSig = has => `${Object.keys(has.things ?? {}).sort().map(k => `+${k}`).join('')}${(has.tray ?? []).map(([k]) => `+${k}`).join('')}${has.door ? '+door' : ''}${has.bar ? '+bar' : ''}`;

  return {
    variant,
    layout,
    get pad() {
      return pad;
    },
    use({ pad: key = null, owned: fn = null } = {}) {
      pad = layout ? key : null;
      if (typeof fn === 'function') owned = fn;
    },
    sig(key) {
      if (!pad || key !== pad) return null;
      const s = shows();
      return `starter-${variant}${s.bed ? '|bed' : ''}${thingsSig(s)}${arranger?.sig(s) ?? ''}`;
    },
    /** What the run owns now, as the room shows it ({ bed, things: { lavalamp: true, … } }). */
    shows: () => shows(),
    /** The room's own marks (cells): the doorway's middle along the front, where the player stands. */
    marks: () => (layout ? { door: layout.room.w / 2, stand: [layout.room.w / 2, STAND_IN] } : null),
    /** The kit's layout (door kept) for what `has` owns, every piece at its own spot: what the run's arrangement starts from. */
    kitWith: has => (layout ? kitWith(has) : null),
    /** The kit's layout as the inside view builds it, door taken out (set/arrange.js checks the room's walks on it). */
    withoutDoor,
    /** The room's arrangement (set/arrange.js): { apply(kit, has), sig(has) }, or null for the layout as it is. */
    arrangeBy(a) {
      arranger = a ?? null;
    },
    /** The room as built with what `has` says is owned ({ bed, things: { lavalamp: true, … } }): for the crib check. */
    builtWith: has => (layout ? built(has) : null),
    roomFor(key) {
      if (!pad || key !== pad) return null;
      const s = shows();
      const A = built(s);
      // the slots: the floorboard shows its floorboard (where the cash goes); the rest are empty, a starter's
      // (and a thing for the trailer that goes in a slot: its own, or the layout's that it fills). kitWith says which
      const fills = A.slots.map(sl => (sl.fill ? { id: sl.fill.id, variant: sl.fill.variant ?? 0 } : null));
      const bed = A.items.find(it => it.id === BED.id || it.id === 'mattress-floor');
      // (an owner: the homes runtime builds a home nobody lives in as its FOR RENT `vacant` set)
      return {
        name: `trailer-${A.name}`, A, fills, owner: key, wealth: 0.1, key: `hk2-starter-${variant}${s.bed ? '-bed' : ''}${thingsSig(s)}${arranger?.sig(s) ?? ''}`,
        starter: {
          // the doorway's middle along the front (cells) and where the player stands (cells: the walker's node corner)
          door: A.room.w / 2,
          stand: [A.room.w / 2, STAND_IN],
          bed: bed ? { id: bed.id, x: bed.x, z: bed.z, rot: bed.rot ?? 0 } : null,
        },
      };
    },
  };
}
