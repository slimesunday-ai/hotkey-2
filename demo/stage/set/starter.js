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
//   · what the run owns shows: the real bed in the mattress's place (`owned.bed`).
// The floorboard slot always shows its floorboard: that is where the cash goes (the stash beat is played beside it).
//
//   const starter = await createStarter({ base })     base: the URL of this folder
//   starter.use({ pad, owned })                        the run says which pad is the player's and what is owned now
//   starter.roomFor(key) → { name, A, fills, owner, wealth, key, starter: { door, stand, bed } } | null
//   starter.sig(key) → a string that changes whenever the room built for the pad must change, or null
//
// `?crib=b` builds the second arrangement (variant B) instead of the first (A, the default).

/** The pieces a starter crib is made of (the starter pack), for the report and the tools. */
export const PACK = ['mattress-floor', 'table-end', 'lamp-table', 'art-print', 'poster', 'tv-console', 'tv-crt', 'table-coffee', 'recliner', 'rug-rag', 'box-fan', 'kitchenette', 'plant-cactus', 'boxes-moving', 'window', 'door-front', 'stash-floorboard'];
/** The real bed that takes the mattress's place once it is owned (same corner, same turn, the kit's double bed). */
const BED = { id: 'bed-double', variant: 0 };
/** Where the player stands at home (room cells, the walker's node: its middle at the cells' shared corner): on the door's line, 1.25 m in. */
const STAND_IN = 9;

export async function createStarter({ base = new URL('./', import.meta.url).href } = {}) {
  const Q = new URLSearchParams(location.search);
  const variant = (Q.get('crib') ?? 'a').toLowerCase() === 'b' ? 'b' : 'a';
  const file = variant === 'b' ? 'trailer-starter-b.json' : 'trailer-starter.json';
  const layout = await fetch(new URL(`homes/${file}`, base)).then(r => (r.ok ? r.json() : null)).catch(() => null);
  let pad = null;
  let owned = () => ({});

  /** The layout as the inside view builds it: no kit door (ours is in the front wall), the bed when it is owned. */
  function built(has) {
    const A = structuredClone(layout);
    // (`on: { top }` and a surface slot's `on` are indices into the item list: re-pointed past the door taken out)
    const keep = A.items.map(it => it.id !== 'door-front');
    const at = [];
    let n = 0;
    for (const k of keep) at.push(k ? n++ : -1);
    A.items = A.items.filter((_, i) => keep[i]).map(it => (it.on?.top !== undefined ? { ...it, on: { top: at[it.on.top] } } : it));
    A.slots = A.slots.map(s => (s.place === 'surface' ? { ...s, on: at[s.on] } : s));
    if (has.bed) A.items = A.items.map(it => (it.id === 'mattress-floor' ? { ...it, ...BED } : it));
    A.name = `${layout.name}${has.bed ? '-bed' : ''}`;
    return A;
  }
  /** What of the run's things the room shows now (the bed only: the pocket and the box cutter are carried, not kept). */
  const shows = () => {
    const o = owned() ?? {};
    return { bed: !!o.bed };
  };

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
      return `starter-${variant}${s.bed ? '|bed' : ''}`;
    },
    roomFor(key) {
      if (!pad || key !== pad) return null;
      const s = shows();
      const A = built(s);
      // the slots: the floorboard shows its floorboard (where the cash goes); the rest are empty, a starter's
      const fills = A.slots.map(sl => (sl.fits.includes('stash') ? { id: sl.demo, variant: sl.variant ?? 0 } : null));
      const bed = A.items.find(it => it.id === BED.id || it.id === 'mattress-floor');
      // (an owner: the homes runtime builds a home nobody lives in as its FOR RENT `vacant` set)
      return {
        name: `trailer-${A.name}`, A, fills, owner: key, wealth: 0.1, key: `hk2-starter-${variant}${s.bed ? '-bed' : ''}`,
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
