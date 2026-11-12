// The set's map drawn over the city (?map=1): a pole at every block's street spot, a small peg at every other spot,
// a label that follows each pole, the game's links as lines, and a legend. For looking at city/MAP-PROPOSAL.md in
// the real place. The set builder's pictures (demo/tools/set-shots.mjs) are taken through it.
//
//   createMapMarks({ city }, { big, spots, only }) → { show(on), legend(on), only(id | null) }
//     big     larger labels, for pictures a person reads at a glance
//     spots   a small label on every spot too ("counter:fence", "desk" …)
//     only    one block or held place: the others' poles, labels and links are hidden (also a method, to change it)
//     flat    for a picture from straight above: short poles and labels at the ground, the legend in a column on the right
//     thin    for a street-level picture: hair-thin stems instead of poles, and the largest labels
import { BLOCKS, HELD, LINKS } from './citymap.js';

export const COLOURS = { projects: 0xff7a1a, market: 0xffc21a, uptown: 0xb07cff, corner: 0xff4fa3, bar: 0xe8232a, park: 0x14a83b, docks: 0x12b3a0, precinct: 0x2f5bff, jail: 0x8b8b95, clinic: 0xffffff };
const ORDER = ['projects', 'market', 'uptown', 'corner', 'bar', 'park', 'docks', 'precinct'];
// from straight above the labels would sit on each other: each is drawn this many metres [east, south] of its spot
const FLAT = { projects: [-6.0, 4.6], market: [7.0, -3.0], uptown: [-6.0, -2.4], corner: [7.0, 4.0], bar: [-5.0, -4.0], park: [-5.4, 0], docks: [1.5, 7.0], precinct: [-5.6, 3.8], jail: [-2.4, -5.6], clinic: [6.0, 3.0] };

export function createMapMarks({ city }, { big = false, spots = false, only = null, flat = false, thin = false } = {}) {
  const THREE = city.THREE;
  const group = new THREE.Group();
  group.name = 'hk2:mapmarks';
  city.scene.add(group);

  const style = document.createElement('style');
  style.textContent = `
    .hk2-marks { position: fixed; inset: 0; pointer-events: none; z-index: 11; overflow: hidden; }
    .hk2-mark { position: absolute; left: 0; top: 0; padding: 3px 7px 2px; color: #17171b; font: 800 13px/1.2 "Arial Black", Impact, sans-serif;
      text-transform: uppercase; letter-spacing: .02em; white-space: nowrap; box-shadow: 2px 2px 0 #17171b; transform: translate(-50%, -100%); }
    .hk2-marks.big .hk2-mark { font-size: 22px; padding: 5px 11px 3px; box-shadow: 3px 3px 0 #17171b; }
    .hk2-mark.spot { font-size: 11px; padding: 2px 5px 1px; box-shadow: 1px 1px 0 #17171b; background: #f7f7f2 !important; }
    .hk2-marks.big .hk2-mark.spot { font-size: 15px; padding: 3px 7px 2px; }
    .hk2-marks.thin .hk2-mark { font-size: 34px; padding: 7px 14px 4px; box-shadow: 4px 4px 0 #17171b; }
    .hk2-marks.thin .hk2-mark.spot { font-size: 20px; padding: 4px 9px 2px; box-shadow: 2px 2px 0 #17171b; }
    .hk2-marks.flat .hk2-mark { font-size: 19px; padding: 4px 9px 2px; }
    .hk2-legend { position: fixed; left: 14px; bottom: 14px; z-index: 12; background: rgba(23, 23, 27, .94); color: #f7f7f2; padding: 10px 12px;
      font: 600 13px/1.55 ui-monospace, Menlo, monospace; max-width: 640px; }
    .hk2-legend b { font: 800 13px/1.5 "Arial Black", Impact, sans-serif; text-transform: uppercase; padding: 0 5px; color: #17171b; margin-right: 6px; }
    .hk2-legend i { font-style: normal; color: #b9b9c2; }
    .hk2-legend.side { left: auto; right: 14px; bottom: auto; top: 14px; width: 400px; font-size: 14px; }
    .hk2-legend.side div { margin-bottom: 7px; }
    .hk2-legend.side b { font-size: 15px; display: inline-block; margin-bottom: 1px; }`;
  document.head.append(style);
  const layer = document.createElement('div');
  layer.className = 'hk2-marks' + (big ? ' big' : '') + (thin ? ' thin' : '') + (flat ? ' flat' : '');
  const legend = document.createElement('div');
  legend.className = 'hk2-legend' + (flat ? ' side' : '');
  document.body.append(layer, legend);

  const hex = c => '#' + c.toString(16).padStart(6, '0');
  const labels = [];
  const links = [];
  // which block or held place the next poles and labels belong to, so one place can be shown alone
  let owner = null;
  const pole = (x, z, h, r, colour) => {
    if (thin) r = 0.07;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(r, h, r), new THREE.MeshBasicMaterial({ color: colour, toneMapped: false }));
    mesh.position.set(x, 0.2 + h / 2, z);
    mesh.userData.owner = owner;
    group.add(mesh);
  };
  const label = (text, x, y, z, colour, cls = '') => {
    const el = document.createElement('div');
    el.className = 'hk2-mark' + (cls ? ' ' + cls : '');
    el.textContent = text;
    el.style.background = hex(colour);
    layer.append(el);
    labels.push({ el, at: new THREE.Vector3(x, y, z), owner });
  };
  const row = (n, id, text) => {
    const line = document.createElement('div');
    const tag = document.createElement('b');
    tag.textContent = `${n} ${id}`;
    tag.style.background = hex(COLOURS[id]);
    line.append(tag, text);
    legend.append(line);
  };
  // the short name of a place for the legend: the long text up to its first colon or comma
  const short = text => text.split(/[:,(]/)[0].trim();

  ORDER.forEach((id, k) => {
    const block = BLOCKS[id];
    row(k + 1, id, short(block.place));
    owner = id;
    const [x, z] = block.spots.street;
    pole(x, z, flat ? 1 : thin ? 4.4 : 10, flat ? 1.1 : 0.3, COLOURS[id]);
    if (flat) label(`${k + 1} ${id}`, x + FLAT[id][0], 1.4, z + FLAT[id][1] + 1.2, COLOURS[id]);
    else label(`${k + 1} ${id}`, x, thin ? 5.2 : 10.6, z, COLOURS[id]);
    for (const [spot, [sx, sz]] of Object.entries(block.spots)) {
      if (spot === 'street') continue;
      pole(sx, sz, flat ? 0.8 : 3, flat ? 0.6 : 0.25, COLOURS[id]);
      if (spots) label(spot, sx, flat ? 1 : 3.5, sz, COLOURS[id], 'spot');
    }
  });
  ['jail', 'clinic'].forEach((id, k) => {
    row('JC'[k], id, short(HELD[id].place));
    owner = id;
    const [x, z] = HELD[id].at;
    // the jail stands beside the precinct's pole: its own goes higher, so the two labels don't sit on each other
    const h = flat ? 1 : thin ? 3.6 : id === 'jail' ? 14 : 6;
    pole(x, z, h, flat ? 1.1 : 0.4, COLOURS[id]);
    if (flat) label(`${'JC'[k]} ${id}`, x + FLAT[id][0], 1.4, z + FLAT[id][1] + 1.2, COLOURS[id]);
    else label(`${'JC'[k]} ${id}`, x, h + 0.8, z, COLOURS[id]);
    const [ex, ez] = HELD[id].exit;
    pole(ex, ez, flat ? 0.8 : 2.4, flat ? 0.6 : 0.25, COLOURS[id]);
    if (spots) label('exit', ex, flat ? 1 : 2.9, ez, COLOURS[id], 'spot');
  });
  const note = document.createElement('div');
  const dim = document.createElement('i');
  dim.textContent = 'black lines: the game\'s links · thin pegs: counters, doors and exits';
  note.append(dim);
  legend.append(note);
  // the game's links, as flat ribbons on the ground between the street spots (every link runs along or over a street)
  {
    const mat = new THREE.MeshBasicMaterial({ color: 0x17171b, toneMapped: false });
    for (const [a, b] of LINKS) {
      const [ax, az] = BLOCKS[a].spots.street;
      const [bx, bz] = BLOCKS[b].spots.street;
      const len = Math.hypot(bx - ax, bz - az);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, len), mat);
      bar.position.set((ax + bx) / 2, 0.36, (az + bz) / 2);
      bar.rotation.y = Math.atan2(bx - ax, bz - az);
      group.add(bar);
      links.push(bar);
    }
  }
  let alone = null;
  const setOnly = id => {
    alone = id || null;
    for (const mesh of group.children) if (mesh.userData.owner) mesh.visible = !alone || mesh.userData.owner === alone;
    for (const bar of links) bar.visible = !alone;
  };
  setOnly(only);

  const V = new THREE.Vector3();
  const place = () => {
    city.camera.updateMatrixWorld();
    for (const { el, at, owner } of labels) {
      V.copy(at).project(city.camera);
      const off = V.z > 1 || Math.abs(V.x) > 1.1 || Math.abs(V.y) > 1.1 || (alone && owner !== alone);
      el.style.display = off ? 'none' : '';
      if (!off) el.style.transform = `translate(-50%, -100%) translate(${((V.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-V.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px)`;
    }
    requestAnimationFrame(place);
  };
  place();

  return {
    group,
    show(on) {
      group.visible = on;
      layer.style.display = legend.style.display = on ? '' : 'none';
    },
    legend(on) {
      legend.style.display = on ? '' : 'none';
    },
    only: setOnly,
  };
}
