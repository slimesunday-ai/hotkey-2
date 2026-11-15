// THE CITY TAKEN DOWN TO ITS GROUND, BLOCK BY BLOCK. The owner, 2026-11-13, of an opening whose last picture of the
// city broke into flat squares: "the dissolve is not what I meant, kind of like the buildings disassemble in reverse
// around the trailer ... like Tetris blocks or something, like a block is removed kinda like a pixel and the trailers
// reverse grow, like voxel away. Kinda like reverse stacking blocks. And the trailer ground is still grass it should
// be the actual ground the trailer is on, just the other trailers around reverse voxel build/stack away".
//
// HOW. Every material the city draws its blocks, its pieces and its walkers with is a "tier" material (the pinned
// city's gpu.js tierize): its fragment shader knows the world position of what it draws (vWinP), which is how the
// city's own cutaway opens a home. Chained onto that (never a change to the pinned files, as set/pads.js spares the
// walkers the cut), each gets one more test: over a metre-square column, everything above a height is not drawn, and
// that height comes down half a metre at a time as the clock runs, each column starting a little later the further
// it is from a middle (and a little ragged); until a column's own clock starts nothing of it is touched. So a building is unstacked from its top, column by column, the nearest
// first, down to `keep`: just over the lot's own ground, whose lawns, paths and slabs are pieces of the same blocks
// and stay. One box (the player's own trailer) can be held back and unstacked last, on a clock of its own. The
// walkers are taken down with everything else, right to the ground (they have no ground of their own to leave).
//
// The buildings' sun shadows are drawn from their whole shapes whatever is not drawn of them, so the sun's shadow is
// faded away with them (three's light.shadow.intensity): bare ground with the shadows of what is gone reads wrong.
//
//   const fall = createFallaway({ city })
//   fall.scan()                 chains onto any tier material not yet chained (new blocks bring clones); the count
//   fall.ok                     true once something is chained
//   fall.set({ on, t, top, keep, at: [x, z], pace, ragged, own: { box: [cx, cz, hx, hz], ax: [x, z], t } | null })
//                               on: the test is live · t: the clock (s; Infinity: everything is down) · top: the
//                               height it starts from (m, over the tallest thing near) · keep: what is left (m) ·
//                               at: the middle it spreads from · pace: seconds a metre · ragged: seconds of scatter
//   fall.shadows(k)             the sun's shadows, 1 as they are … 0 gone (given back with fall.shadows(1))
//   fall.span(top, keep, far, pace, ragged)   how long until everything within `far` metres is down (s)
//   fall.under(fn)              runs fn with everything down and the sun's shadows off, then puts both back: one
//                               picture of the bare ground (inside.js draws the ground under a place's inside with it)

/** A column's side (m), a step's height (m), steps a second. */
const CELL = 1;
const STEP = 0.5;
const RATE = 12;
/** What is left standing: the lots' slabs are 0.2 m over the road (the city's ground.js); their lawns and paths lie on them. */
export const KEEP = 0.3;

export function createFallaway({ city }) {
  const T = city.THREE;
  const U = {
    city: { value: new T.Vector4(0, KEEP, 0, 8) },
    peds: { value: new T.Vector4(0, -100, 0, 8) },
    at: { value: new T.Vector4(0, 0, 0.035, 0.45) },
    own: { value: new T.Vector4(0, 0, 0, 0) },
    own2: { value: new T.Vector4(1, 0, 0, 0) },
  };
  const SNIP = `
  if ( uHkFall.x > 0. ) { vec2 hkC = floor( vWinP.xz / ${CELL.toFixed(2)} ); float hkN = fract( sin( dot( hkC, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );
    float hkT = uHkFall.z - length( ( hkC + .5 ) * ${CELL.toFixed(2)} - uHkAt.xy ) * uHkAt.z;
    if ( uHkOwn.z > 0. ) { vec2 hkO = vWinP.xz - uHkOwn.xy; vec2 hkQ = abs( vec2( dot( hkO, uHkOwn2.xy ), dot( hkO, vec2( -uHkOwn2.y, uHkOwn2.x ) ) ) ) - uHkOwn.zw; if ( max( hkQ.x, hkQ.y ) < 0. ) hkT = uHkOwn2.z; }
    float hkU = ( hkT - hkN * uHkAt.w ) * ${RATE.toFixed(1)};
    if ( hkU > 0. && vWinP.y > max( uHkFall.y, uHkFall.w - floor( hkU ) * ${STEP.toFixed(2)} ) ) discard; }`;
  const chained = new Set();
  const walkers = () => {
    const A = city.peds?.anim;
    return new Set([A?.batch, A?.mid, A?.far, A?.dog].map(m => m?.material).flat().filter(Boolean));
  };
  function chain(mat, fallU) {
    if (chained.has(mat)) return false;
    chained.add(mat);
    const prev = mat.onBeforeCompile;
    const key = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh, r) => {
      prev?.call(mat, sh, r);
      if (!sh.fragmentShader?.includes('vWinP')) return;
      sh.uniforms.uHkFall = fallU;
      sh.uniforms.uHkAt = U.at;
      sh.uniforms.uHkOwn = U.own;
      sh.uniforms.uHkOwn2 = U.own2;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec4 uHkFall; uniform vec4 uHkAt; uniform vec4 uHkOwn; uniform vec4 uHkOwn2;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + SNIP);
    };
    mat.customProgramCacheKey = () => (key ? key.call(mat) : mat.type) + '|hk2fall';
    mat.needsUpdate = true;
    return true;
  }
  function scan() {
    const W = walkers();
    let n = 0;
    city.scene.traverse(o => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) if (m._tierOpts && chain(m, W.has(m) ? U.peds : U.city)) n += 1;
    });
    // (the walkers' own, should a batch not be in the scene's tree when asked)
    for (const m of W) if (m._tierOpts && chain(m, U.peds)) n += 1;
    return n;
  }
  const suns = [];
  const findSuns = () => {
    if (!suns.length) city.scene.traverse(o => o.isDirectionalLight && o.castShadow && o.shadow && suns.push([o, o.shadow.intensity ?? 1]));
  };
  function shadows(k) {
    findSuns();
    for (const [sun, was] of suns) sun.shadow.intensity = was * Math.max(0, Math.min(1, k));
  }
  function set({ on = true, t = 0, top = 8, keep = KEEP, at = null, pace = null, ragged = null, own = undefined } = {}) {
    const tt = Number.isFinite(t) ? t : 1e6;
    U.city.value.set(on ? 1 : 0, keep, tt, top);
    U.peds.value.set(on ? 1 : 0, -100, tt, top);
    if (at) {
      U.at.value.x = at[0];
      U.at.value.y = at[1];
    }
    if (pace !== null) U.at.value.z = pace;
    if (ragged !== null) U.at.value.w = ragged;
    if (own === null) U.own.value.set(0, 0, 0, 0);
    else if (own) {
      U.own.value.set(own.box[0], own.box[1], own.box[2], own.box[3]);
      U.own2.value.set(own.ax[0], own.ax[1], Number.isFinite(own.t) ? own.t : 1e6, 0);
    }
  }
  return {
    scan,
    get ok() {
      return chained.size > 0;
    },
    set,
    shadows,
    /** Seconds until everything within `far` metres of the middle is down to `keep`. */
    span: (top, keep = KEEP, far = 60, pace = U.at.value.z, ragged = U.at.value.w) => far * pace + ragged + Math.ceil((top - keep) / STEP) / RATE,
    under(fn) {
      findSuns();
      const was = [U.city.value.clone(), U.peds.value.clone(), U.own.value.clone(), U.own2.value.clone(), suns.map(([sun]) => sun.shadow.intensity)];
      set({ on: true, t: Infinity, own: null });
      shadows(0);
      try {
        return fn();
      } finally {
        U.city.value.copy(was[0]);
        U.peds.value.copy(was[1]);
        U.own.value.copy(was[2]);
        U.own2.value.copy(was[3]);
        suns.forEach(([sun], k) => {
          sun.shadow.intensity = was[4][k] ?? sun.shadow.intensity;
        });
      }
    },
    debug: () => ({ chained: chained.size, city: U.city.value.toArray(), at: U.at.value.toArray(), own: U.own.value.toArray() }),
  };
}
