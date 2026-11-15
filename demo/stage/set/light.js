// The time of day, in one page load. The game runs 12:00 to 23:00: day until 17:30, dusk to 20:00, night after.
//
// What turns: the city's own grader (render/grade.js: sun, sky, fog and exposure go day → blue hour → night, and a
// share of the window glass lights up) and the city's own street-lamp light (when prelight.js ran before the city
// started): the city puts it on ITS OWN lamps, the nearest to the camera (main.js placeLamps), wherever the game is.
// Nothing of ours is lit: the 3×3 set's own lamps, pools and signs went with the set (2026-11-12).
//
// What does not turn on a day page, because the city bakes it per build: its own lit sign letters, lamp heads and
// shop-interior glow. A page loaded with ?tod=night has all of that, and this module then grades it the other way
// (night → day) by the same clock.
const CITY = new URL('../../../city/from-trunk/style/city/', import.meta.url).href;

/** 0 by day, 1 by night, for an hour of the game's day (a fraction is fine). */
export function nightAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h < 6) return 1;
  if (h < 17.5) return 0;
  if (h >= 20) return 1;
  const t = (h - 17.5) / 2.5;
  return t * t * (3 - 2 * t);
}

export async function createLight(city) {
  const THREE = city.THREE;
  const LIGHT = window.__light;
  const NIGHT = new URLSearchParams(location.search).get('tod') === 'night';
  const G = await import(`${CITY}render/grade.js`);
  const grader = city.grade ?? G.createTodGrade({ LIGHT, post: city.post, water: null, NIGHT });
  let night = NIGHT ? 1 : 0;
  let extra = null;

  // ── the street-lamp light ─────────────────────────────────────────────────────────────────────────────────────
  // On a night page the city runs it by itself. On a day page it is there only when prelight.js ran first; then its
  // switch (flipped per draw by the scene it was installed on) is driven from here, and the city places its lamps.
  const U = THREE.ShaderLib.standard.uniforms;
  const term = !NIGHT && !!U.cityLampX;
  if (term) {
    const { scene } = city;
    const before = scene.onBeforeRender;
    const after = scene.onAfterRender;
    scene.onBeforeRender = function (...a) {
      before.apply(this, a);
      U.cityLampX.value.z = LIGHT.night.lit ? 1 : 0;
    };
    scene.onAfterRender = function (...a) {
      after.apply(this, a);
      U.cityLampX.value.z = 0;
    };
  }
  // (lamps of ours, in the last of the city's twelve slots: the open pad's, under its missing ceiling, and THE KEY
  // LAMPS over whoever the picture is about: setKeys below. The city's own are the nearest to the camera, placed
  // again whenever it has moved a metre; ours are put with them, and again whenever ours move)
  let keys = [];
  let cityPts = [];
  // (THE INSIDE VIEW's lamps, demo/stage/inside.js: while it is up, by night, the room's own lamp and a key over whoever
  // is in it are the only ones: the street lamps under it and the key lamps over people not in the picture light
  // nothing of it)
  let inner = null;
  const place0 = LIGHT.night.place.bind(LIGHT.night);
  const put = () => {
    if (inner && night > 0) return place0(inner);
    const ours = night > 0 ? [...keys, extra].filter(Boolean) : [];
    place0(ours.length ? [...cityPts.slice(0, 12 - ours.length), ...ours] : cityPts);
  };
  LIGHT.night.place = pts => {
    cityPts = pts;
    put();
  };

  function apply() {
    // the city's grader counts from the page's own build: 0 is the build as it is
    grader.set(NIGHT ? 1 - night : night);
  }
  apply();

  return {
    grader,
    term,
    build: NIGHT ? 'night' : 'day',
    get night() {
      return night;
    },
    /** Night as a number, 0 … 1, for looking at it. */
    setNight(k) {
      const was = night;
      night = Math.max(0, Math.min(1, +k || 0));
      apply();
      if ((was > 0) !== (night > 0)) put();
    },
    /** One more lamp, at a world point [x, y, z] (the open pad's ceiling), or null to take it away. */
    setExtra(point) {
      extra = point;
      put();
    },
    /** The inside view's lamps, world points [[x, y, z] …] (or null: the view is down). By night they are the only ones lit. */
    setInside(points) {
      inner = points?.length ? points.slice(0, 4) : null;
      put();
    },
    /**
     * THE KEY LAMPS: up to four world points [x, y, z] that are lit by night as the city's street lamps light (its
     * own lamp light: the same colour, strength, 15 m reach), wherever the city has no lamp. The stage keeps one
     * over the person the picture follows. [] takes them away.
     */
    setKeys(points) {
      const next = (points ?? []).slice(0, 4);
      // (moved less than a hand: left where they are)
      if (next.length === keys.length && next.every((p, k) => Math.hypot(p[0] - keys[k][0], p[1] - keys[k][1], p[2] - keys[k][2]) < 0.08)) return;
      keys = next;
      put();
    },
    setClock({ hour }) {
      this.setNight(nightAt(hour));
      return { night, build: NIGHT ? 'night' : 'day', lamps: term || NIGHT };
    },
  };
}
