// A PLACE TO PLAY TWO PEOPLE WHERE A CLOSE SIDE VIEW CAN SEE THEM (clip-sheet.mjs, blood-punch.mjs): a page expression
// that defines window.__spot(from, keep, clear) → { at: [x, z], side } or null. Open ground near `from` ([x, z]):
// nothing solid within `clear` metres, off the walkers' lanes (a walker of the city's stood in front of the pair), and
// a camera 8.5 m to the east (side 1) or west (side -1) of it that sees both bodies: no lane, none of the place's
// people (but `keep`, the two) and nothing drawn (a stall's awning, a sign) on the line from it to them. The two
// stand on a north-south line from `at` (up to 2.2 m north of it).
export const SPOT_JS = `window.__spot = (from, keep = [], clear = 2.5) => {
  const st = window.__demo.stage, AC = st.actors, city = window.__city;
  const people = [...AC.all().filter(a => !keep.includes(a.id) && !a.w.hide).map(a => [a.x, a.z]), ...(st.figures?.all?.() ?? []).map(F => [F.x, F.z])];
  for (let r = 0; r <= 70; r += 1) for (let k = 0; k < Math.max(1, r * 6); k++) {
    const x = from[0] + Math.sin(k * 2 * Math.PI / Math.max(1, r * 6)) * r, z = from[1] + Math.cos(k * 2 * Math.PI / Math.max(1, r * 6)) * r;
    let ok = AC.solidKnown(x, z) && !AC.onRoad?.(x, z);
    for (let rr = 0.5; ok && rr <= clear; rr += 0.5) for (let q = 0; q < 16 && ok; q++) if (AC.solidAt(x + Math.sin(q * Math.PI / 8) * rr, z + Math.cos(q * Math.PI / 8) * rr)) ok = false;
    if (!ok) continue;
    for (const s of [1, -1]) {
      let line = true;
      for (let e = -1; line && e <= 9; e += 1) for (const dz of [-1, 0.6, 2.2]) if (city.peds.sim.laneNear(x + s * e, z + dz, 1.3)) line = false;
      if (line && people.some(([px, pz]) => (px - x) * s > -1.5 && (px - x) * s < 9 && pz > z - 1.5 && pz < z + 3)) line = false;
      if (line) {
        const y = AC.groundAt(x, z), R = new city.THREE.Raycaster(), from3 = new city.THREE.Vector3(x + s * 8.5, y + 3, z + 0.6);
        R.camera = city.camera;
        for (const [dz, dy] of [[-0.6, 0.3], [-0.6, 1.6], [0.6, 0.9], [1.8, 0.3], [1.8, 1.6], [0.6, 2.3]]) {
          const to = new city.THREE.Vector3(x, y + dy, z + dz), d = from3.distanceTo(to);
          R.set(from3, to.clone().sub(from3).normalize());
          R.far = d - 1.3;
          if (R.intersectObject(city.scene, true).some(h => h.object.visible !== false)) { line = false; break; }
        }
      }
      if (line) return { at: [x, z], side: s };
    }
  }
  return null;
};`;
