// THE MAP'S STOP LABELS, LAID OUT (tree-1, the owner 11-18: "the text on this part of the map is a bit buggy": with every
// place on the map their labels lay on top of one another, ran off the panel's edge, sat far from their stops). Pure: no
// page, no map, so node can test it (test/run-map-labels.test.mjs).
//
//   placeLabels({ items, box, obstacles, keep }) → Map(id → { left, top, w, h, lead: [x1, y1, x2, y2] | null, key })
//     items      [{ id, x, y, w, h, prio }]: each stop's point on the sheet and its label's size; the higher `prio`
//                first (the place you are at, then the one picked), then from the top down
//     box        { left, top, right, bottom }: where a label may lie (inside the map, off its rulers)
//     obstacles  [{ left, top, right, bottom }]: what no label may cover (the stops' squares, the stations, the legend)
//     keep       Map(id → key) of the last layout: a label stays where it was while that still works (no jumping
//                about as the map is dragged)
//
// Each label tries places round its stop, nearest first: beside it (left or right, the old place), then above and below,
// then further out along sixteen directions; the first that lies inside the box and covers no other label and no
// obstacle is its place. One that sits off its stop gets a leader, from the stop to the label's nearest point. A label
// with no room anywhere (the map zoomed far out) is left out (null) rather than laid over another: its stop's square
// still shows, and a click on it opens its card.
const RADII = [10, 22, 38, 58, 82, 110, 145, 185, 230, 290];
const DIRS = 16;
const MARGIN = 3;

const meets = (a, b, m = 0) => a.left < b.right + m && b.left < a.right + m && a.top < b.bottom + m && b.top < a.bottom + m;
const inside = (r, box) => r.left >= box.left && r.top >= box.top && r.right <= box.right && r.bottom <= box.bottom;

/** The candidate places round a stop, nearest first (a side's place first at each distance): [{ key, left, top, dist }]. */
function candidates(it) {
  const out = [];
  for (let ri = 0; ri < RADII.length; ri++) {
    const r = RADII[ri];
    for (let k = 0; k < DIRS; k++) {
      const a = (Math.PI * 2 * k) / DIRS + Math.PI; // the first: straight left (the old place), then round
      const [ux, uy] = [Math.cos(a), Math.sin(a)];
      // (the label's nearest edge `r` from the stop along the direction: its centre out by its own half-size along it)
      const cx = it.x + ux * (r + (Math.abs(ux) * it.w) / 2 + (Math.abs(uy) * it.h) / 2);
      const cy = it.y + uy * (r + (Math.abs(ux) * it.w) / 2 + (Math.abs(uy) * it.h) / 2);
      // (beside first, then above and below: a level label reads best)
      const dist = r + Math.abs(uy) * 14 + (k === 0 ? 0 : k === DIRS / 2 ? 2 : 4);
      out.push({ key: `${ri}:${k}`, left: Math.round(cx - it.w / 2), top: Math.round(cy - it.h / 2), dist });
    }
  }
  return out.sort((p, q) => p.dist - q.dist);
}

function lay(order, box, obstacles, keep) {
  const placed = new Map();
  const rects = [];
  let missing = 0;
  for (const it of order) {
    const all = candidates(it);
    const was = keep?.get(it.id);
    const tries = was ? [...all.filter(c => c.key === was), ...all] : all;
    let got = null;
    for (const c of tries) {
      const r = { left: c.left, top: c.top, right: c.left + it.w, bottom: c.top + it.h };
      if (!inside(r, box)) continue;
      if (rects.some(q => meets(q, r, MARGIN))) continue;
      if (obstacles.some(q => meets(q, r))) continue;
      got = { ...r, c };
      break;
    }
    if (!got) {
      placed.set(it.id, null);
      missing += 1;
      continue;
    }
    rects.push(got);
    // (a leader when it sits off its stop: from the stop to the label's nearest point)
    const nx = Math.max(got.left, Math.min(it.x, got.right));
    const ny = Math.max(got.top, Math.min(it.y, got.bottom));
    const far = Math.hypot(nx - it.x, ny - it.y) > 14;
    placed.set(it.id, { left: got.left, top: got.top, w: it.w, h: it.h, key: got.c.key, lead: far ? [it.x, it.y, nx, ny] : null });
  }
  return { placed, missing };
}

export function placeLabels({ items, box, obstacles = [], keep = null }) {
  let order = items.slice().sort((a, b) => (b.prio ?? 0) - (a.prio ?? 0) || a.y - b.y || a.x - b.x);
  let best = lay(order, box, obstacles, keep);
  // (one left out: try again with it earlier, a few times, and keep the layout that leaves out fewest)
  for (let n = 0; n < items.length && best.missing; n++) {
    const out = order.filter(it => !best.placed.get(it.id));
    const top = order.filter(it => (it.prio ?? 0) > 0);
    order = [...top, ...out.filter(it => !top.includes(it)), ...order.filter(it => !top.includes(it) && !out.includes(it))];
    const again = lay(order, box, obstacles, null);
    if (again.missing < best.missing) best = again;
  }
  return best.placed;
}
