// TRAIT CURATION HOOK (2026-09-29) · the trait studio's keep / kill decisions (world/traits-curation.json, written by
// style/city/studio/) as a filter rollLook can use later. NOT switched on: nothing imports this yet, NEW_TRAITS is untouched,
// and the city rolls exactly as before. Self-contained (no imports), so chars.js can import it without a cycle.
//
//   const allow = curationFilter(curation);            // curation: the parsed JSON ({ version: 1, traits: { 'slot/id': { status, note, cw } } })
//   allow(slot, id, isNew, newTraits) → may this trait roll?
//     killed → never · a NEW trait (Drop 02 and later) kept → always, even with NEW_TRAITS off · a new trait undecided → only with
//     NEW_TRAITS on (today's rule) · an original trait not killed → always (today's rule)
//   allow.colourways(slot, id, n) → the colourway indices (0…n−1) that may roll: all but the killed ones (all n if every one is killed)
//   allow.status(slot, id) → 'keep' | 'kill' | 'undecided'
//
// TO SWITCH IT ON (later, one session, with a roll-parity check): in chars.js rollLook, take o.curation, build
//   const allow = o.curation ? curationFilter(o.curation) : null;
// and change `keys` to
//   keys = s => Object.keys(NAMES[s]).filter(k => allow ? allow(s, k, isNewTrait(s, k), nt) : (nt || !isNewTrait(s, k)))
// then route the two hard-coded picks through it too: the ears list (['phones', 'studs', …NEWT.ears]) and the skin ladder (a
// killed rare skin falls through to pick(Object.keys(SKIN)) filtered the same way); and in the colourway pass, pick
// L[s].cw from allow.colourways(s, id, e.cw.length) instead of 0…n−1. Without o.curation every draw stays as it is today.
export function curationFilter(curation) {
  const T = (curation && curation.traits) || {};
  const status = (slot, id) => { const e = T[slot + '/' + id]; return e && (e.status === 'keep' || e.status === 'kill') ? e.status : 'undecided'; };
  const allow = (slot, id, isNew = false, newTraits = false) => {
    if (id === 'none') return true;
    const s = status(slot, id); if (s === 'kill') return false;
    return isNew ? (s === 'keep' || !!newTraits) : true; };
  allow.status = status;
  allow.colourways = (slot, id, n) => { const all = Array.from({ length: n }, (_, i) => i), cw = (T[slot + '/' + id] || {}).cw || {};
    const ok = all.filter(i => !(cw[i] && cw[i].status === 'kill')); return ok.length ? ok : all; };
  return allow;
}
