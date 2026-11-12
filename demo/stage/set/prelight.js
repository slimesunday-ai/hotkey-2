// Night in one page load needs ONE thing done before the city starts: its street-lamp light is a term the city
// compiles into every lit material, and it only does that on a night page or a live-sim page. Asked for a "grading"
// night once, on a stand-in scene, its own night module (render/night.js) puts that term into three's light chunk
// for this page too. It must run before the city's main.js makes its first material:
//
//   const { prelight } = await import('./stage/set/prelight.js');
//   await prelight(CITY);                       // CITY: the city folder's URL, the same string the page imports main.js by
//   await import(`${CITY}main.js`);
//
// The term is off until demo/stage/set/light.js turns it on at dusk, and costs nothing measurable while it is off
// (the city's own note: about 0.04 ms a frame). Without this call the set still goes dark and lights its own
// signs and windows, but no lamp lights the street: see city/MAP-PROPOSAL.md, "Night".
export async function prelight(CITY) {
  if (new URLSearchParams(location.search).get('tod') === 'night') return false;
  const N = await import(`${CITY}render/night.js`);
  N.createNight({ scene: { onBeforeRender() {}, onAfterRender() {} }, lampHeads: () => [], night: false, grade: true });
  return true;
}
