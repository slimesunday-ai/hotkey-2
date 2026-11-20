// THE ROOM A FIGHT IS GIVEN, CHECKED (room-1; demo/stage/room.js, THE MEASURE). Every fight's record carries the
// room's own measure of it (rec.anim.crowd), taken from one second after the fight was called to its end, of
// everybody not in it (the city's crowd and its dogs, and ours): frames, `on` (frames with somebody on its ground),
// `near` (frames with somebody within a step of its edge), `lingers` (times somebody stayed within that step for more
// than three quarters of a second (a moment)), `nearest` (m past the ground's edge the nearest came; negative: on it), `most` at once.
// run-duel, run-sixes and run-styles print it for every fight and fail one over these limits. Set from the fights
// measured with the room off (?room=0: the market's jumped fight 481 of 658 frames with somebody on its ground, a
// walker 1.55 m into it; the kerb fight 409 of 764, a walker standing 0.19 m off its edge for 7.6 s) and on.
//   --qs '&room=0' on those tools plays the fights with the room off, to see them fail.
// (on: 6 frames, a tenth of a second past the first: the most ever measured with the room on was 6, a walker caught in
// it at the call on its way out (run-styles, 2026-11-18); after its work was bounded (room-2) the market and kerb
// fights measured 0 in six runs and in the forced worst case (demo/tools/room-load.mjs))
export const ROOM_LIMITS = { on: 6, lingers: 0, nearest: 0 };

/** Prints a fight's room figures and fails it over the limits. Returns the figures (or null). */
export function roomCheck(name, rec, fail) {
  const f = rec?.anim?.crowd ?? null;
  if (!f) {
    fail(`${name}: the fight's record has no measure of its room`);
    return null;
  }
  const L = ROOM_LIMITS;
  console.log(`  ${name}: the room (r ${f.r} m): ${f.frames} frames, ${f.on} with somebody on its ground, ${f.near} with somebody within a step of its edge, ${f.lingers} who stayed there, nearest ${f.nearest} m past its edge, at most ${f.most} at once${f.who?.length ? `; who: ${JSON.stringify(f.who)}` : ""}`);
  if (f.on > L.on) fail(`${name}: somebody not in the fight was on its ground for ${f.on} frames (at most ${L.on})`);
  if (f.lingers > L.lingers) fail(`${name}: ${f.lingers} not in the fight stayed within a step of its edge for more than three quarters of a second (a moment) (at most ${L.lingers})`);
  if (f.nearest < L.nearest) fail(`${name}: somebody not in the fight came ${f.nearest} m past its edge (no nearer than ${L.nearest})`);
  return f;
}
