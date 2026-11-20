// THE MAP'S STOP LABELS (tree-1; demo/run/maplabels.js): wherever the stops lie on the sheet, no two labels meet, none
// leaves the box or covers an obstacle, each sits beside its stop when it can and gets a leader when it cannot, and one
// laid before stays where it was while that still works.
import test from 'node:test';
import assert from 'node:assert/strict';
import { placeLabels } from '../demo/run/maplabels.js';

const meets = (a, b) => a.left < b.left + b.w && b.left < a.left + a.w && a.top < b.top + b.h && b.top < a.top + a.h;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function check(items, box, obstacles = []) {
  const at = placeLabels({ items, box, obstacles });
  const shown = items.map(it => [it, at.get(it.id)]).filter(([, p]) => p);
  for (const [it, p] of shown) {
    assert.ok(p.left >= box.left && p.top >= box.top && p.left + p.w <= box.right && p.top + p.h <= box.bottom, `${it.id} inside the box`);
    for (const o of obstacles) assert.ok(!(p.left < o.right && o.left < p.left + p.w && p.top < o.bottom && o.top < p.top + p.h), `${it.id} clear of an obstacle`);
    // (its leader starts at its own stop)
    if (p.lead) assert.deepEqual(p.lead.slice(0, 2), [it.x, it.y]);
  }
  for (let i = 0; i < shown.length; i++) for (let j = 0; j < i; j++) assert.ok(!meets(shown[i][1], shown[j][1]), `${shown[i][0].id} and ${shown[j][0].id} apart`);
  return at;
}

test('six labels of a crowded map never meet, never leave it, and each is laid', () => {
  const box = { left: 22, top: 22, right: 700, bottom: 420 };
  for (let n = 0; n < 200; n++) {
    // (the run's six stops bunched within 160 px of each other somewhere on the sheet, as the island zoomed out)
    const cx = 40 + rnd() * 640;
    const cy = 40 + rnd() * 360;
    const items = ['park', 'market', 'docks', 'plaza', 'corner', 'tryout'].map((id, k) => ({ id, x: cx + (rnd() - 0.5) * 160, y: cy + (rnd() - 0.5) * 160, w: 90 + rnd() * 70, h: 22, prio: k === 0 ? 2 : 0 }))
      .filter(it => it.x > box.left && it.y > box.top && it.x < box.right && it.y < box.bottom);
    const obstacles = items.map(it => ({ left: it.x - 9, top: it.y - 9, right: it.x + 9, bottom: it.y + 9 }));
    const at = check(items, box, obstacles);
    assert.equal(items.filter(it => !at.get(it.id)).length, 0, `try ${n}: every stop has its label`);
  }
});

test('a lone stop by the left edge has its label on its right, beside it, no leader', () => {
  const at = check([{ id: 'park', x: 40, y: 200, w: 120, h: 22 }], { left: 22, top: 22, right: 700, bottom: 420 });
  const p = at.get('park');
  assert.ok(p.left > 40, 'to the right of its stop');
  assert.equal(p.lead, null);
});

test('a label laid before stays where it was while that still works', () => {
  const box = { left: 0, top: 0, right: 800, bottom: 500 };
  const items = [{ id: 'a', x: 300, y: 200, w: 120, h: 22 }, { id: 'b', x: 330, y: 205, w: 120, h: 22 }];
  const first = placeLabels({ items, box });
  const keep = new Map([...first].map(([id, p]) => [id, p.key]));
  const moved = items.map(it => ({ ...it, x: it.x + 30, y: it.y + 10 }));
  const again = placeLabels({ items: moved, box, keep });
  for (const id of ['a', 'b']) assert.equal(again.get(id).key, first.get(id).key);
});
