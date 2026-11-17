// THE TRY-OUT STOP (join-1; the owner's decision: TRY-OUT ONLY). A stop for the dead mall on the run's Travel list (T)
// and on its Map (M), wherever Travel is offered: you pick a loadout, fight, and nothing carries back to the run. It is
// a side trip of the PAGE's, not a move of the rules': it costs nothing (no fare, no hour, no energy, no heat), the run's
// state and its save are not touched, and the run's auto-play never takes it (it is no choice of the view's). The trip
// itself, under the stage's black: demo/run/trip.js.
//
// Pure, tested in node (test/run-tryout.test.mjs): the stop as data, the dock with it (dock.js's, plus one line on
// Travel's list), and its words.

/** The stop: its key on the dock (never one of the rules' choice keys, which are numbers), the fight's site, its words. */
export const TRYOUT = Object.freeze({
  key: 'tryout:mall',
  site: 'mall',
  name: 'Behind the dead mall',
  mark: 'TRY-OUT',
  says: 'nothing here counts',
  costs: 'free: no hour, no energy, no heat',
  // (the middle of the fight's arena there, demo/fight/sites.js MALL.center: where it stands on the map)
  at: Object.freeze([-227.5, 80.5]),
});

/** Is this dock key the try-out's? */
export const isTryout = key => key === TRYOUT.key;

/** The try-out as a choice the page's dock can show and pick (never sent to the rules: the page takes the trip). */
export const TRYOUT_CHOICE = Object.freeze({
  key: TRYOUT.key,
  label: `Try out the fight ${TRYOUT.name.toLowerCase()}: ${TRYOUT.says}`,
  available: true,
  why: null,
  price: 0,
  tryout: true,
  choice: Object.freeze({ do: 'tryout', site: TRYOUT.site }),
});

/** Travel is offered here: its verb has ways (dock.js: none at home, held, or where there is no way on). */
export const tryoutOffered = dock => (dock?.verbs?.find(v => v.id === 'travel')?.keys.length ?? 0) > 0;

/**
 * THE DOCK WITH THE TRY-OUT: dock.js's own, and wherever Travel is offered, the try-out last on its list. Travel's own
 * why (short of the fare, and so on) stays the rules' words for the rules' ways. Nothing else changes.
 */
export function withTryout(dock) {
  if (!tryoutOffered(dock)) return dock;
  return { ...dock, verbs: dock.verbs.map(v => (v.id === 'travel' ? { ...v, keys: [...v.keys.filter(k => !isTryout(k)), TRYOUT.key], tryout: TRYOUT.key } : v)) };
}

/** Its line on Travel's list: { name, small, price }. */
export const tryoutRow = () => ({ name: TRYOUT.name, mark: TRYOUT.mark, small: `${TRYOUT.says} · ${TRYOUT.costs}`, price: 0 });

/** What Enter does with it picked. */
export const tryoutGo = () => `Try-out: ${TRYOUT.name.toLowerCase()} · free`;

/** Why it cannot be taken now (the map's card says it), or null. */
export function tryoutWhy({ dock, phase, hold = false }) {
  if (phase !== 'choose' || hold) return 'not while something plays: when it is over';
  if (!tryoutOffered(dock)) {
    const t = dock?.verbs?.find(v => v.id === 'travel');
    return t?.why ? `${t.why}: it is on Travel's list wherever Travel is offered` : 'only where Travel is offered';
  }
  return null;
}
