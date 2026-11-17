// HOW MUCH OF THE PICTURE THE INTERFACE COVERS NOW (join-1): a page expression for the tools (chrome.mjs evaluate).
// Every box of the frame that is drawn (the HUD's root and everything in it that is not display: none, not hidden, not
// faded out, and has a size), clipped to the window, unioned on a 4 px grid, as a share of the window. The black of a
// cut, the world's labels (a canvas) and the picture itself are not the interface. → { pct, px, boxes }
export const COVERED = `(() => {
  const W = innerWidth, H = innerHeight, G = 4;
  const cols = Math.ceil(W / G), rows = Math.ceil(H / G);
  const on = new Uint8Array(cols * rows);
  const shown = el => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
    }
    return true;
  };
  let boxes = 0;
  // (the panels: whatever under the HUD's root paints a box of its own, a background or an edge)
  for (const el of document.querySelectorAll('#hud #k .hk *')) {
    const cs = getComputedStyle(el);
    const paints = (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0;
    if (!paints) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || !shown(el)) continue;
    const [x0, y0, x1, y1] = [Math.max(0, r.left), Math.max(0, r.top), Math.min(W, r.right), Math.min(H, r.bottom)];
    if (x1 <= x0 || y1 <= y0) continue;
    boxes += 1;
    for (let j = Math.floor(y0 / G); j < Math.ceil(y1 / G); j++) for (let i = Math.floor(x0 / G); i < Math.ceil(x1 / G); i++) on[j * cols + i] = 1;
  }
  let n = 0;
  for (const v of on) n += v;
  return { pct: +((100 * n) / on.length).toFixed(1), px: n * G * G, boxes };
})()`;
