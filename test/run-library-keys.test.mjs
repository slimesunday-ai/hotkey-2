// THE LIBRARY KEEPS THE ARROWS (join-1, part D; demo/run/dock.js arrowsTo): found by hand in real Chrome, the Library
// opened while a scene played, then the scene ended: the arrows drove the dock instead of the Library's grid until the
// Library was shut and opened again. Whenever the Library is open and the game is choosing, the grid has them, wherever
// the focus went; an open map pans with them; else the dock; while something plays, nobody's. (In the page, with real
// keys over a real scene: demo/tools/run-library-keys.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { arrowsTo } from '../demo/run/dock.js';

test('the Library open and the game choosing: the arrows are the grid\'s, whatever has the focus', () => {
  assert.equal(arrowsTo({ sheet: 'library', phase: 'choose' }), 'library');
  assert.equal(arrowsTo({ sheet: 'library', phase: 'choose', hold: false }), 'library');
});
test('nothing open, or another panel: the dock\'s; the map: its own', () => {
  assert.equal(arrowsTo({ sheet: null, phase: 'choose' }), 'dock');
  for (const sheet of ['character', 'moves', 'stuff']) assert.equal(arrowsTo({ sheet, phase: 'choose' }), 'dock');
  assert.equal(arrowsTo({ sheet: 'map', phase: 'choose' }), 'map');
});
test('while a scene plays or an hour holds: not the run\'s to give', () => {
  for (const phase of ['playing', 'held', 'report', 'start']) assert.equal(arrowsTo({ sheet: 'library', phase }), null);
  assert.equal(arrowsTo({ sheet: 'library', phase: 'choose', hold: true }), 'dock');
});
