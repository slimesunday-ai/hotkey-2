// THE SIDE TRIP TO THE TRY-OUT STOP (join-1; tryout.js): from a run, to the fight behind the dead mall and back, IN
// THE PAGE (no reload), every change of place behind the stage's own fade to black, so nobody is seen to come or go.
//
//   GOING     the run's frame stays up while the picture fades; under the black its frame is put away and its keys
//             stand aside, the zone becomes the dead mall's (stage.enterZone: the run's people are away, as anyone is
//             whose place is not loaded), the Lock is put at its own angle and the light is its page's daylight (the
//             fight as on its own page, whatever the run's hour),
//             the fight is mounted on the same stage (demo/fight/index.js mountFight, with Back); then the picture.
//   BACK      under the black the fight takes itself off (its dispose), the zone is the run's again round where the
//             player stood, the camera is the run's again (its angle, on the player), and the run puts everyone where
//             its state has them at once (the run's own way of a state picked up: placeLine, an hour settled at
//             once); its frame comes back as it was (the list or panel that was open), then the picture.
//   NOTHING OF THE RUN'S IS TOUCHED: its state, its save and its hour are not read for anything but where to come
//   back to, and not written at all (demo/tools/run-tryout.mjs checks the save byte for byte, win or lose).
//
//   const trip = createTrip({ stage, demo, host, run })
//     run: { you, away(on), replace() → promise, seed(), where() }   (the run's page: demo/run/index.js)
//   trip.go() · trip.back() · trip.active · trip.busy · trip.fight (the fight's page api) · trip.log (seconds each way)
import { h } from '../hud/dom.js';
import { fightZone } from '../fight/zone.js';
import { TRYOUT } from './tryout.js';

const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const wait = ms => new Promise(r => setTimeout(r, ms));

export function createTrip({ stage, demo, host, run }) {
  const map = stage.map;
  const fade = stage.travel?.fade ?? null;
  const city = demo?.city ?? window.__city;
  // (the words in the middle of the black, the run's own: ui.css .u-dark-say)
  const say = h('p', { class: 'u-dark-say', hidden: true, 'aria-hidden': 'true' });
  const kit = host.querySelector?.('#k') ?? host;
  const layer = h('div', { class: 'hk rn fg-trip' }, say);
  kit.append(layer);
  let fight = null;
  let busy = false;
  let was = null;
  const log = [];
  const zone = () => fightZone(map, TRYOUT.site);
  /** The stage's slide of the picture into the panels' gap (stage/index.js fitToPanels), now. */
  const offset = () => (city?.camera?.view?.enabled ? [city.camera.view.offsetX, city.camera.view.offsetY] : [0, 0]);
  /** Waits (a little) for the stage to have measured the panels anew: the picture slid as `want` says. */
  async function slid(want, ms = 1600) {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      const [x, y] = offset();
      if (x === want[0] && y === want[1]) return true;
      await wait(50);
    }
    return false;
  }
  const words = text => {
    say.hidden = !text;
    say.textContent = text ?? '';
  };

  /**
   * The dead mall's blocks built ahead, while the run is still on the picture (the stage's loader.prepare: into the
   * city's own block cache, which keeps them). Once a page is enough: the stop's line and card ask it each time drawn.
   */
  let asked = false;
  function prepare() {
    if (asked) return;
    asked = true;
    try {
      stage.loader?.prepare?.(zone());
    } catch (err) {
      console.warn('[trip] the dead mall could not be built ahead:', err);
    }
  }

  async function go() {
    if (busy || fight || !fade) return false;
    busy = true;
    const t0 = performance.now();
    const note = { way: 'go', t0: Date.now(), black: null, zone: null, mount: null, seconds: null };
    try {
      const A = stage.camera.state().angle;
      was = { zone: stage.loader.zone, place: stage.director.placeOf(run.you), angle: A, speed: stage.actors.speed || 1, offset: offset() };
      prepare();
      await fade.out();
      // (said in the middle of the black once it is black: over the fading picture it could not be read)
      words('Off to the dead mall: a try-out');
      note.black = +((performance.now() - t0) / 1000).toFixed(2);
      // (under the black: the run's frame away and its keys aside, then the place)
      run.away(true);
      const z = zone();
      const t1 = performance.now();
      const entry = await stage.enterZone(z, map.viewOf(z));
      note.zone = +((performance.now() - t1) / 1000).toFixed(2);
      note.built = entry?.built ?? null;
      // (the fight's camera, as on its own page: the Lock at its own angle, whatever the run's had been turned to; and
      // its light, its page's daylight, whatever the run's hour: the run's comes back with its hour on the way back)
      stage.camera.setAngle({});
      stage.setClock?.({ day: 1, hour: 12 });
      const t2 = performance.now();
      const { mountFight } = await import('../fight/index.js');
      fight = await mountFight(host, { stage, demo, seed: run.seed?.() ?? 1, site: TRYOUT.site, tryout: { back: 'Back to the run', onBack: () => back() } });
      if (demo) demo.fight = fight;
      note.mount = +((performance.now() - t2) / 1000).toFixed(2);
      // (the picture without the run's slide: no panel the stage makes way for is up now)
      await slid([0, 0]);
      for (let k = 0; k < 3; k++) await nextFrame();
      words(null);
      await fade.in();
      note.seconds = +((performance.now() - t0) / 1000).toFixed(2);
      return true;
    } catch (err) {
      console.error('[trip] the try-out did not open:', err);
      // (whatever happened, back to the run under the black)
      await home().catch(e => console.error('[trip] and the way back failed:', e));
      words(null);
      if (fade.dark) await fade.in();
      return false;
    } finally {
      log.push(note);
      busy = false;
    }
  }

  /** The run's place again, under a black already held. */
  async function home() {
    if (fight) {
      fight.dispose();
      fight = null;
      if (demo) demo.fight = null;
    }
    const w = was ?? { zone: stage.loader.zone, place: stage.director.placeOf(run.you), angle: null, speed: 1, offset: [0, 0] };
    const at = map.PLACES[w.place]?.at ?? map.ZONES[w.zone]?.at ?? null;
    const view = at ? { pos: [at[0] + 12, 24, at[1] + 4], tgt: [at[0], 1, at[1]], fov: 42 } : null;
    const entry = await stage.enterZone(w.zone, view);
    if (w.angle) stage.camera.setAngle({ bearing: w.angle.bearing, down: w.angle.down, high: w.angle.metres * Math.sin((w.angle.down * Math.PI) / 180) });
    stage.camera.begin({ you: run.you, mode: 'play' });
    stage.markPlayer?.(run.you);
    stage.setSpeed(w.speed);
    // (everyone where the run's state has them, at once: an hour settled under the black)
    await run.replace();
    run.away(false);
    stage.camera.arrived();
    return entry;
  }

  async function back() {
    if (busy || !fight || !fade) return false;
    busy = true;
    const t0 = performance.now();
    const note = { way: 'back', t0: Date.now(), black: null, zone: null, seconds: null };
    try {
      await fade.out();
      words(`Back to ${run.where?.() ?? 'the run'}`);
      note.black = +((performance.now() - t0) / 1000).toFixed(2);
      const t1 = performance.now();
      const entry = await home();
      note.zone = +((performance.now() - t1) / 1000).toFixed(2);
      note.built = entry?.built ?? null;
      // (the run's slide of the picture again, as it was before the trip)
      note.slid = await slid(was?.offset ?? [0, 0]);
      for (let k = 0; k < 3; k++) await nextFrame();
      words(null);
      await fade.in();
      note.seconds = +((performance.now() - t0) / 1000).toFixed(2);
      was = null;
      return true;
    } catch (err) {
      console.error('[trip] the way back failed:', err);
      words(null);
      if (fade.dark) await fade.in();
      return false;
    } finally {
      log.push(note);
      busy = false;
    }
  }

  return {
    go,
    back,
    prepare,
    get active() {
      return !!fight || busy;
    },
    get busy() {
      return busy;
    },
    get fight() {
      return fight;
    },
    log,
  };
}
