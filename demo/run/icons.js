// THE RUN'S ICONS FOR CATEGORIES AND ACTIONS (ui-3): one family on a 24-unit grid, a 2-unit round stroke in the words'
// colour, at most one filled accent. Things (clothes, furniture, the three to own) are not drawn here: they will show
// the game's own models. `icon(name)` → an <svg> element (aria-hidden), or null for a name it does not know.
const NS = 'http://www.w3.org/2000/svg';
const PATHS = {
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5.5 9.5v5M18.5 9.5v5"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20.5h18"/>',
  energy: '<path d="M13.5 2 5 14h6l-1 8 8.5-12.5h-6z"/>',
  heat: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-5 5-5 8-1-1-2-2-2-4-1.5 2-2 4.5-2 8 0 4 3 7 7 7z"/>',
  police: '<path d="M12 2.5 19.5 5v6.5c0 5-3.4 8.6-7.5 10.5-4.1-1.9-7.5-5.5-7.5-10.5V5z"/><path class="f" d="m12 8 1.3 2.6 2.9.4-2.1 2 .5 2.9L12 14.5l-2.6 1.4.5-2.9-2.1-2 2.9-.4z"/>',
  homerisk: '<path d="M3 11 12 3l9 8"/><path d="M5 9.5V21h14V9.5"/><path d="m12.5 9-2 4 3 2-1.5 4"/>',
  trust: '<path d="M12 20s-8-5-8-11a4 4 0 0 1 8-1.5A4 4 0 0 1 20 9c0 6-8 11-8 11z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  goods: '<rect x="6" y="7" width="12" height="14" rx="1.5"/><path d="M6 11h12"/><path d="M9 7V4h6v3"/>',
  shop: '<path d="M5 8h14l-1.2 13H6.2z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
  train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14"/><path d="m8 17-2.5 4.5M16 17l2.5 4.5"/>',
  walk: '<circle cx="13.5" cy="4" r="2"/><path d="m13 7.5-2 6 3 3 1 5.5M11 13.5 8 21M13 9.5l4 3M12 8.5 8 11.5"/>',
  home: '<path d="M3 11 12 3l9 8"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  bins: '<path d="M5 7h14l-1.2 14H6.2z"/><path d="M3 7h18M9 7V4h6v3M10 11v6M14 11v6"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  warn: '<path d="M12 3 2 20.5h20z"/><path d="M12 10v5M12 17.8v.2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  journal: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3.5"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  map: '<path d="M3 6.5 9 3.5l6 3 6-3V18l-6 3-6-3-6 3z"/><path d="M9 3.5V18M15 6.5V21"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
  rob: '<path d="M2.5 9c3.5-2.5 15.5-2.5 19 0v4c-3 3.4-6.4 3.4-9.5 1-3.1 2.4-6.5 2.4-9.5-1z"/><circle class="f" cx="8" cy="11" r="1.6"/><circle class="f" cx="16" cy="11" r="1.6"/>',
  frame: '<rect x="3.5" y="4.5" width="17" height="15" rx="1"/><path d="m3.5 16 5-5 4 4 2.5-2.5 5.5 5.5"/><circle cx="15.5" cy="9" r="1.6"/>',
  library: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.5"/>',
  // (the fight's, join-1: its meters and its result card; the same family)
  health: '<path d="M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z"/>',
  shield: '<path d="M12 2.5 19.5 5v6.5c0 5-3.4 8.6-7.5 10.5-4.1-1.9-7.5-5.5-7.5-10.5V5z"/><path d="M12 6v12"/>',
  ammo: '<path d="M5 21v-9.5L6.5 7 8 11.5V21zM10.5 21v-9.5L12 7l1.5 4.5V21zM16 21v-9.5L17.5 7l1.5 4.5V21z"/>',
  crowd: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20.5c0-3.4 2.7-6 6-6s6 2.6 6 6"/><path d="M15.5 5.1a3.2 3.2 0 1 1 0 5.8M17 14.8c2.4.6 4 2.9 4 5.7"/>',
  back: '<path d="M9.5 5 3 11.5 9.5 18"/><path d="M3.5 11.5H15a6 6 0 0 1 6 6V19"/>',
  fold: '<path d="m6 15 6-6 6 6"/>',
  unfold: '<path d="m6 9 6 6 6-6"/>',
};
export function icon(name, cls = '') {
  if (!PATHS[name]) return null;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `u-ico${cls ? ` ${cls}` : ''}`);
  svg.innerHTML = PATHS[name];
  return svg;
}
export const ICON_NAMES = Object.keys(PATHS);
