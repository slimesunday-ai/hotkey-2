// PEOPLE'S EFFECTS (K0-looks, 2026-11-19) · how ONE person in the crowd is drawn, switched on demand: the groundwork a game's effects
// plug into (hotkey 2's crafting plan, B11: the skin and body channels, and the trail channel's echo). The crowd stays the same three
// batches (peds.js: near, mid, far BatchedMesh) and the same programs: every walker material carries this hook from the city's load, and
// a person's effect is a few numbers in a small float texture beside each batch (two texels per instance: colour and skin; rate, square
// size, phase and a packed code: the squares' second colour, the see-through), read in the vertex shader through the instance's own index
// (as walk2.js reads its gait). The skin's colour rides the vertex colour the body already has (vColor). The squares need the body's
// position in each pixel: on the near tier it rides the fine paint's own varying (vFine, free under a skin: fine.js reads x < 0 as
// unpainted), so the near tier, the one that fills the screen, has no new varying at all; mid and far have one vec4 (far one more float,
// the echo's stipple), and nothing that is not needed: measured with the bench (tools/looksshots.mjs bench, A/B with the code before,
// shots/k0-looks/ab-summary.txt), three new vec4 varyings on every tier cost the eye-level streets 0.7 ms of GPU, and flat varyings
// (a first try at fewer) cost every view 0.5–1.1 ms.
// Nothing compiles or rebuilds when a person is switched. With nobody switched, the hook is one uniform branch per vertex that is never
// taken (uFxOn.x = 0) and one compare per pixel (on near and mid, one more uniform branch per pixel, vhs's, never taken), the textures are
// never written or uploaded, and peds.js does no extra work per walker. vhs (K4) is the one skin worked per pixel: its static has to show
// on a head's one flat top, which a colour worked out at the corners only shades; it adds no varying (its code rides the vertex colour's
// alpha, its band the world position the tier material already carries).
//
// THE CALLS (peds.fx). `who` is a crowd walker's id (w.id, a number), a placed figure's agent id (the string it was put in with:
// sim.putAgent / sim.addAgent; hotkey 2's actors are 'hk2:<their id>'), or the walker object itself (or anything holding it as .w:
// hotkey 2's actor A, whose walker is A.w).
//   peds.fx.set(who, spec)      that person's effect, replacing any before → true, or false if nobody by that id is in the city now
//   peds.fx.change(who, patch)  merged into the effect it has (a key set to null switches that part off) → true / false
//   peds.fx.clear(who)          that person back as drawn today · peds.fx.clear() everybody · → true
//   peds.fx.get(who)            the spec it has now, or null
//   peds.fx.bursting(who)       true while that person's glitch is in a burst (at the time last drawn: a sound can follow it)
//   peds.fx.skins               the skins' names
//   peds.fx.stats()             { people, chunky, echoes (copies drawn last frame), copies (split's, aura's and glitch's bodies: [drawn last
//                               frame, wanted]), on: [near, mid, far] (each batch's shader switch) }
// spec (every key optional; an empty spec is a clear):
//   skin    'flat'     one colour over the whole person (color)
//           'rainbow'  one colour that turns through every hue: `speed` turns a second (default .5), `phase` 0–1 (default: from the
//                      walker's id, so a dressed crowd does not turn in step)
//           'checker'  squares of `size` m (default .15) on the body, in color and color2 (default pink #ff00ff and black), in place of
//                      the person's own colours; the squares ride the body's parts as they swing
//           mix        on flat and rainbow, 0–1 (default 1: the skin replaces the person's colours, as above). Below 1 the skin's
//                      hue is carried at the person's own light and dark (a dark jacket stays darker than a white shirt), blended
//                      over their own colours by mix, and on the near body the fine paint (faces, prints) stays on
//           band       on rainbow: hue turns per metre up the body (default 0: one colour for the whole person); the colour flows
//                      up the person in bands (per vertex: a tall face shades between its corners' hues)
//           'shift'    the person's OWN colours turning round the colour wheel, light and dark kept (a dark coat stays dark): `speed`
//                      turns a second (default .2), `sat` the colour's strength × (default 1.5), `floor` a tint even greys take (0–.3,
//                      default .05), `band` turns per metre up the body (default 0), `phase` (default from the id). Faces' fine paint stays
//           'glitch'   in short bursts the person tears: slices of the body (head · chest and arms · legs) knocked sideways at 15 steps
//                      a second, and two unlit copies in `color` (default #ff2a5a) and `color2` (default #19e6ff) flashed out to either
//                      side, each sliced its own way: `rate` bursts a second (default .9), `size` the knock in m (default .16), `phase` (default
//                      from the id: a crowd does not burst in step). Between bursts the person is as drawn
//           'split'    the person in their own colours, fringed by two unlit copies of themselves in `color` (default #ff2050) and
//                      `color2` (default #19e6ff), `size` m to either side (default .12) that drift round and pulse at `speed` (default .6)
//           'aura'     the person in their own colours inside an unlit contour in `color` (default #b4ff39), `size` m wide (default
//                      .15), breathing at `speed` (default .8)
//           'vhs'      (K4-vhs) the person as a worn tape recording of a person: static over them, at the screen's own pixels and a
//                      new draw 30 times a second (it crawls), their colour washed, every other row of pixels dimmed, a tracking band
//                      rolling up the picture through them, and two unlit copies (`color` default pink #ff2fa8, `color2` default green
//                      #2bff7a: slime 11-19, "the rgb glitch is great and would be better with pink and green") `size` m to either side
//                      across the picture (default .08: the tape's colour fringe), each row of them flickering, now and then torn
//                      sideways twice as far for a tenth of a second; the body is not moved. `static` 0–1 (default .5), `band` the
//                      tracking band 0–1 (default .5; 0 none), `wash` 0–1 (default .4; 1 black and white), `grain` the static's streak in
//                      pixels across, 1–4 (default 2), `size` 0 no copies. `burst` (bursts a second, e.g. .9): glitch's bursts instead of
//                      the steady fringe (the slices knocked sideways, the two copies flashed out to either side, `size` the knock,
//                      default .16; bursting() tells a game when), the static over it all the while. Near and mid tier (a far body: as drawn)
//                      split, aura, glitch and vhs copy the body: near and mid tier only (a far or chunky body has none), unlit (the city's lit
//                      flag: they glow in the night's bloom), drawn in the same batch (no extra draw), behind the person (depth pushed
//                      .3 m: their own colours stay in front); glitch's only in a burst; room for COPIES (peds.js: 72, 36 people split)
//                      on the near tier, then none
//   color, color2   any colour three.js reads (0xff1a1a, '#1f4dff', 'red'); color2 is kept at 5-6-5 bits on checker
//   body    'chunky'   the far-away body (three boxes in the look's main colours: peds.js farGeo) drawn at any distance; it takes the
//                      skin too. It has no shadow and no legs, as the far tier has none; a dog walked by it stays drawn
//   echo    { n, gap, alpha }   n (1–3, default 1) see-through copies of the chunky body where the person was gap, 2·gap, 3·gap s ago
//                      (gap default .35, up to 1; alpha default .45: the share of pixels drawn, a 4 × 4 stipple in 16ths, so no sorting and no
//                      extra drawing); in the person's skin if it has one. A copy within .35 m of the person is not drawn (standing still)
// A person who leaves the city (despawned, removed) loses the effect. Effects are display only: the sim never reads them.
const MODE = { own: 1, flat: 2, rainbow: 3, checker: 4, shift: 5, glitch: 6, split: 1, aura: 1, vhs: 8 }, SKINS = Object.keys(MODE).filter(k => k !== 'own');
// (the new skins' table: shift: colour = [band, floor, 0], rate = speed, size = sat · glitch: colour = the tint, rate = the burst's step,
// size = the knock · a copy (mode 7, its own instance): colour, rate = speed (glitch's: the step), size = kind (0, 1: split's two sides ·
// 2: aura · 3, 4: glitch's two sides (and vhs's with burst) · 5, 6: vhs's two sides) + 8 × the size in mm · vhs (mode 8; with burst,
// glitch's mode 6 and its table): the code is the tape's (below), on the person and on its copies)
// (vhs's code, the fragment stage's only input, carried in the vertex colour's alpha (vColor.a: 1 on every walker, read by nothing after
// the colour multiply: the material is opaque), as 2 + code: static × 15 + 16 × band × 7 + 128 × wash × 7 + 1024 × (grain − 1), + 32768
// on a copy. The fragment's test is the batch's switch (a uniform) first, so a batch with nobody switched never reads it)
// (the code, below 2^17 so it survives interpolation: 65536 + the squares' second colour in 5-6-5 sRGB, or 0 without squares; the
// stipple: the 16ths of pixels left out, 4 × 4 Bayer order; the table's code is code + 131072 × the 16ths. The size slot is the
// squares' size on checker, and on flat and rainbow the mix and the band: mix × 100 + 101 × (band × 100 + 5000))
const VPARS = tier => `uniform highp sampler2D uFx; uniform vec2 uFxOn;${tier ? ' varying vec4 vFx;' : ''}${tier === 2 ? ' varying float vFxS;' : ''}
vec3 fxHue( float h ) { return pow( clamp( abs( mod( h * 6. + vec3( 0., 4., 2. ), 6. ) - 3. ) - 1., 0., 1. ), vec3( 2.2 ) ); }`;
const VERT = tier => `
${tier ? '  vFx = vec4( 0. );' : ''}${tier === 2 ? ' vFxS = 0.;' : ''}
#ifdef USE_BATCHING
  if ( uFxOn.x > .5 ) { int fxI = int( getIndirectIndex( gl_DrawID ) ); vec4 f0 = texelFetch( uFx, ivec2( fxI, 0 ), 0 );
    if ( f0.a > .5 ) { vec4 f1 = texelFetch( uFx, ivec2( fxI, 1 ), 0 ); float fxs = floor( f1.w / 131072. ), fxc = f1.w - fxs * 131072.;
      vec4 fxv = vec4( fxc, ( position - normal * .004 ) / max( f1.y, .01 ) + .37 );
      if ( f0.a > 7.5 ) {${tier < 2 ? `
#ifdef USE_COLOR_ALPHA
        vColor.a = 2. + fxc;
#endif
       ` : ''} }
      else if ( f0.a > 4.5 ) {${NEW(tier)} }
      else if ( f0.a > 3.5 ) { vColor.rgb = f0.rgb;${tier ? '' : ' vFine = vec4( -2. - fxc, fxv.yzw );'} }
      else if ( f0.a > 1.5 ) { float fbq = floor( ( f1.y + .5 ) / 101. ), fm = ( f1.y - fbq * 101. ) / 100.;
        vec3 sk = f0.a > 2.5 ? fxHue( fract( f1.x * uFxOn.y + f1.z + ( fbq - 5000. ) * .01 * position.y ) ) : f0.rgb;
        vColor.rgb = fm > .995 ? sk : mix( vColor.rgb, sk * mix( .3 + 1.6 * sqrt( dot( vColor.rgb, vec3( .2126, .7152, .0722 ) ) ), 1., fm ), fm );${tier ? '' : ' if ( fm > .995 ) vFine = vec4( -1. );'} }
${tier ? '      vFx = fxv;' : ''}${tier === 2 ? ' vFxS = fxs;' : ''} } }
#endif`;
// (the new modes, in the vertex stage only: the fragment stage is as it was. A copy: moved in view space (split: to one side, drifting
// round ±.5 rad and pulsing .4–1 × size; aura: out along the view-space normal, .5–1 × size; glitch: to one side .35–1.25 × size and up
// or down, anew each step), its depth pushed .3 m back so the person stays in front, unlit (vLit, near and mid). Glitch: the rate slot is
// the burst's step (0: none; pedfx's burst() decides it each frame); in a burst each slice (head · chest and arms · legs), at every step,
// is knocked sideways (65 %), the person's and each copy's their own way, and a fifth of the person's slices tinted in a channel colour at the
// person's own light. Shift: a hue turn in YIQ on the colour's square root, Y kept)
// (a copy or a glitch person with a tape code (vhs's: a code is 0 on every other skin) carries it to the fragment stage)
const TAPE = `
#ifdef USE_COLOR_ALPHA
          if ( fxc > .5 ) vColor.a = 2. + fxc;
#endif
         `;
const NEW = tier => `
        float fT = uFxOn.y * f1.x + f1.z, fK = 0.; bool fCp = f0.a > 6.5; float fk = mod( f1.y, 8. ), fg = floor( f1.y / 8. ) * .001;
        if ( fCp ? fk > 2.5 && fk < 4.5 : f0.a > 5.5 && f1.x > .5 ) {${tier ? ' float fgp = position.y > 1.45 ? 2. : position.y > .85 ? 1. : 0.;' : ' int fp = int( aPart + .5 ); float fgp = fp == 5 ? 2. : fp == 0 || fp == 3 || fp == 4 ? 1. : 0.;'}
          float fr = fract( sin( f1.x * 12.9898 + fgp * 78.233 + f1.z * 7. + ( fCp ? fk * 4.1 : 0. ) ) * 43758.55 ); if ( fr > .35 ) fK = ( fract( fr * 91.3 ) * 2. - 1. ) * ( fCp ? fg : f1.y );
          if ( !fCp && fr > .8 ) vColor.rgb = ( mod( f1.x + fgp, 2. ) < 1. ? f0.rgb : 1. - f0.rgb ) * ( .25 + 1.5 * sqrt( dot( vColor.rgb, vec3( .2126, .7152, .0722 ) ) ) ); }
        if ( fCp ) { vec2 fd; float fa = 6.2832 * fT;
          if ( fk < 1.5 ) { float fr = .5 * sin( fa * .31 + 1.7 ); fd = ( fk < .5 ? -fg : fg ) * ( .7 + .3 * sin( fa ) ) * vec2( cos( fr ), sin( fr ) ); }
          else if ( fk < 2.5 ) fd = transformedNormal.xy * fg * ( .75 + .25 * sin( fa ) );
          else if ( fk > 4.5 ) { float ft = floor( uFxOn.y * 10. ); fd = vec2( ( fk < 5.5 ? -fg : fg ) * ( .85 + .15 * sin( fa ) ) * ( fract( sin( ft * 12.9898 + f1.z * 78.233 ) * 43758.55 ) > .96 ? 2. : 1. ), 0. ); }
          else { float fr = fract( sin( f1.x * 7.31 + fk * 39.3 + f1.z * 7. ) * 43758.55 ); fd = vec2( ( fk < 3.5 ? -fg : fg ) * ( .35 + .9 * fr ), ( fract( fr * 53.7 ) - .5 ) * fg * .6 ); }
          fd.x += fK; vec4 fz = projectionMatrix * vec4( mvPosition.xy + fd, mvPosition.z - .3, 1. ); gl_Position.xy += ( projectionMatrix * vec4( fd, 0., 0. ) ).xy; gl_Position.z = fz.z / fz.w * gl_Position.w;
          vColor.rgb = f0.rgb;${tier < 2 ? ' vLit = 1.;' + TAPE : ''}${tier ? '' : ' vFine = vec4( -1. );'} }
        else if ( f0.a > 5.5 ) { gl_Position.xy += ( projectionMatrix * vec4( fK, 0., 0., 0. ) ).xy;${tier < 2 ? TAPE : ''} }
        else { float fa = 6.2832 * ( fT + f0.r * position.y ), fc = cos( fa ), fn = sin( fa ); vec3 fcl = sqrt( max( vColor.rgb, 0. ) );
          float fY = dot( fcl, vec3( .299, .587, .114 ) ), fI = dot( fcl, vec3( .596, -.274, -.322 ) ), fQ = dot( fcl, vec3( .211, -.523, .312 ) );
          float fI2 = ( fI * fc - fQ * fn ) * f1.y + f0.g * fc, fQ2 = ( fI * fn + fQ * fc ) * f1.y + f0.g * fn;
          fcl = max( vec3( fY + .956 * fI2 + .621 * fQ2, fY - .272 * fI2 - .647 * fQ2, fY - 1.106 * fI2 + 1.703 * fQ2 ), 0. ); vColor.rgb = fcl * fcl; }`;
const FPARS = tier => (tier ? 'varying vec4 vFx;' + (tier === 2 ? ' varying float vFxS;' : '') : '') + (tier < 2 ? `
uniform vec2 uFxOn;
float fxN( uvec3 v ) { v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; return float( v.x & 65535u ) / 65535.; }` : '');
// (vhs, the fragment stage: on the lit colour, just before it is written (outgoingLight, after the lit flag's mix), so the static reads by
// night as by day: it is drawn at the person's own brightness or a floor, not shaded by the street's light. The noise is a hash of the
// screen pixel (the streak: grain px across, each row offset its own way) and the tape's frame (30 a second); the band is the pixel's
// height in the view (from vWinP, the world position the tier material already carries), so it rolls up the picture and through a head
// top's one flat face row by row; a copy's rows flicker)
const VHSF = `
#ifdef USE_COLOR_ALPHA
  if ( uFxOn.x > .5 && vColor.a > 1.5 ) { float vc = floor( vColor.a - 1.5 ); uint vF = uint( max( uFxOn.y, 0. ) * 30. ); ivec2 vp = ivec2( gl_FragCoord.xy );
    float vr = fxN( uvec3( uint( vp.y ), vF, 7u ) );
    if ( vc > 32767.5 ) outgoingLight *= .35 + 1.3 * vr;
    else { float vs = mod( vc, 16. ) / 15., vb = mod( floor( vc / 16. ), 8. ) / 7., vw = mod( floor( vc / 128. ), 8. ) / 7., vg = mod( floor( vc / 1024. ), 4. ) + 1.;
      float vL = dot( outgoingLight, vec3( .2126, .7152, .0722 ) ), vl = max( vL * 1.3, .16 );
      uvec3 vh = uvec3( uint( ( float( vp.x ) + vr * 61. ) / vg ), uint( vp.y ), vF ); float vn = fxN( vh ), vm = fxN( vh + uvec3( 0u, 0u, 7919u ) );
      float vy = ( viewMatrix * vec4( vWinP, 1. ) ).y, vq = fract( vy * .55 - uFxOn.y * .45 ), vk = vb * ( 1. - smoothstep( .05, .09, abs( vq - .5 ) ) );
      vec3 c = mix( outgoingLight, vec3( vL ) * vec3( 1.04, 1., .93 ), vw ) * ( 1. - .2 * vw ) + vl * .06 * vw;
      if ( vm < clamp( vs * .8 + vk, 0., 1. ) ) c = vec3( vl ) * ( .04 + 2. * vn );
      if ( vk > .25 && vn > .78 ) c = vec3( vl * 3.2 );
      if ( ( vp.y & 1 ) == 1 ) c *= 1. - .3 * vs;
      outgoingLight = c; } }
#endif`;
const FRAG = tier => `
  ${tier ? 'vec4 fxv = vFx;' : 'vec4 fxv = vec4( -vFine.x - 2., vFine.yzw );'}
  if ( fxv.x > 65535.5 ) { vec3 fq = floor( fxv.yzw ); if ( mod( fq.x + fq.y + fq.z, 2. ) > .5 ) { float fb = floor( fxv.x + .5 ) - 65536.;
    diffuseColor.rgb = pow( vec3( floor( fb / 2048. ) / 31., mod( floor( fb / 32. ), 64. ) / 63., mod( fb, 32. ) / 31. ), vec3( 2.2 ) ); } }${tier === 2 ? `
  if ( vFxS > .5 ) { ivec2 fp = ivec2( mod( floor( gl_FragCoord.xy ), 4. ) ); int fv = fp.x ^ fp.y;
    if ( float( ( fv & 1 ) << 3 | ( fp.y & 1 ) << 2 | ( fv & 2 ) | ( fp.y & 2 ) >> 1 ) < vFxS - .5 ) discard; }` : ''}`;

export function createPedFx(THREE, sim) {
  const people = new Map(), tables = [], C = new THREE.Color(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
  let time = 0, echoN = 0, echoes = 0, copyN = 0, copies = 0; const chunkyNow = [], wantCopy = [[], []];
  // ── a batch's table: 2 rows × cap columns of RGBA floats; it grows (rows copied) when its batch grows
  function table(cap) { const data = new Float32Array(cap * 2 * 4), tex = new THREE.DataTexture(data, cap, 2, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
    return { cap, data, tex, U: { uFx: { value: tex }, uFxOn: { value: new THREE.Vector2(0, 0) } }, now: [], was: [] }; }
  function grow(T, need) { const cap = Math.max(need, Math.ceil(T.cap * 1.5)), data = new Float32Array(cap * 2 * 4);
    for (let r = 0; r < 2; r++) data.set(T.data.subarray(r * T.cap * 4, (r + 1) * T.cap * 4), r * cap * 4);
    T.tex.dispose(); const tex = new THREE.DataTexture(data, cap, 2, THREE.RGBAFormat, THREE.FloatType); tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
    Object.assign(T, { cap, data, tex }); T.U.uFx.value = tex; }
  // (alpha: the share of pixels drawn → the 16ths left out, packed over the code)
  function write(T, k, e, alpha) { if (k >= T.cap) grow(T, k + 1); const d = T.data, a = k * 4, b = (T.cap + k) * 4, out = Math.max(0, Math.min(15, Math.round((1 - alpha) * 16)));
    d[a] = e.A[0]; d[a + 1] = e.A[1]; d[a + 2] = e.A[2]; d[a + 3] = e.mode; d[b] = e.speed; d[b + 1] = e.size; d[b + 2] = e.phase;
    d[b + 3] = e.code + out * 131072; T.now.push(k); }
  // ── a material of a batch: the hook, chained after the material's own (tierize, the fine paint, walk v2, the camera fade), compiled
  // with the city like the rest of it
  // (b: 0 near, which has the fine paint's varying to ride · 1 mid · 2 far, which draws the echoes' stipple)
  function install(b, mat, cap) { const T = tables[b] = table(cap), prev = mat.onBeforeCompile, key = mat.customProgramCacheKey?.bind(mat);
    mat.onBeforeCompile = (sh, r) => { prev?.call(mat, sh, r); sh.uniforms.uFx = T.U.uFx; sh.uniforms.uFxOn = T.U.uFxOn; const t = b === 0 && sh.vertexShader.includes('vFine') ? 0 : b || 1;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VPARS(t)).replace('#include <fog_vertex>', VERT(t) + '\n#include <fog_vertex>');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + FPARS(t)).replace('#include <alphamap_fragment>', FRAG(t) + '\n#include <alphamap_fragment>');
      if (t < 2) sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', VHSF + '\n#include <opaque_fragment>'); };
    mat.customProgramCacheKey = () => (key ? key() : '') + '|pedfx'; }
  // ── the calls
  const find = who => { if (who && typeof who === 'object') { const w = who.p ? who : who.w; return w?.p && !w.gone ? w : null; } if (typeof who === 'number') return sim.walkers.find(w => w.id === who) || null;
    if (typeof who === 'string') return sim.agents.find(w => w.aid === who && !w.gone) || null; return null; };
  const lin = (v, d) => { C.set(v ?? d); return [C.r, C.g, C.b]; };
  const b565 = (v, d) => { C.set(v ?? d); const [r, g, b] = [C.r, C.g, C.b].map(x => x <= .0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - .055); return Math.round(r * 31) << 11 | Math.round(g * 63) << 5 | Math.round(b * 31); };
  function entry(w, spec) { const s = Object.fromEntries(Object.entries(spec || {}).filter(([, v]) => v !== null && v !== undefined)); if (!Object.keys(s).length) return null;
    if (s.skin !== undefined && !SKINS.includes(s.skin)) throw new Error(`peds.fx: no skin '${s.skin}' (${SKINS.join(', ')})`);
    if (s.body !== undefined && s.body !== 'chunky') throw new Error(`peds.fx: no body '${s.body}' (chunky)`);
    const E = s.echo ? { n: Math.max(1, Math.min(3, Math.round(s.echo.n ?? 1))), gap: Math.max(.05, Math.min(1, s.echo.gap ?? .35)), alpha: Math.max(.05, Math.min(1, s.echo.alpha ?? .45)) } : null;
    const ch = s.skin === 'checker', sk = s.skin, cl = (v, a, b) => Math.max(a, Math.min(b, v)), phase = s.phase ?? (w.id * .618034) % 1;
    let code = ch ? 65536 + b565(s.color2, 0x000000) : 0;
    let size = ch ? s.size ?? .15 : Math.round(Math.max(0, Math.min(1, s.mix ?? 1)) * 100) + 101 * (Math.round(Math.max(-40, Math.min(40, s.band ?? 0)) * 100) + 5000);
    let A = lin(s.color, ch ? 0xff00ff : 0xffffff), speed = s.speed ?? .5, cp = null, bu = 0;
    if (sk === 'shift') { A = [cl(s.band ?? 0, -4, 4), cl(s.floor ?? .05, 0, .3), 0]; speed = s.speed ?? .2; size = cl(s.sat ?? 1.5, 0, 4); }
    else if (sk === 'split' || sk === 'aura' || sk === 'glitch') { const mm = Math.round(cl(s.size ?? (sk === 'split' ? .12 : sk === 'aura' ? .15 : .16), 0, .5) * 1000), sp = s.speed ?? (sk === 'split' ? .6 : .8);
      const one = (kind, c) => ({ A: c, mode: 7, speed: sp, size: kind + 8 * mm, phase, code: 0 });
      cp = sk === 'split' ? [one(0, lin(s.color, 0xff2050)), one(1, lin(s.color2, 0x19e6ff))] : sk === 'aura' ? [one(2, lin(s.color, 0xb4ff39))] : [one(3, lin(s.color, 0xff2a5a)), one(4, lin(s.color2, 0x19e6ff))];
      if (sk === 'glitch') { A = lin(s.color, 0xff2a5a); speed = 0; size = mm / 1000; } }
    // (vhs with `burst`: glitch's machinery (mode 6: the bursts decided on the CPU, the slices and two copies kinds 3 and 4) carrying the tape's
    // code; without: the steady fringe, kinds 5 and 6)
    else if (sk === 'vhs') { bu = s.burst ? cl(s.burst, .05, 8) : 0; const mm = Math.round(cl(s.size ?? (bu ? .16 : .08), 0, .5) * 1000), sp = s.speed ?? .5;
      const vc = Math.round(cl(s.static ?? .5, 0, 1) * 15) + 16 * Math.round(cl(s.band ?? .5, 0, 1) * 7) + 128 * Math.round(cl(s.wash ?? .4, 0, 1) * 7) + 1024 * (Math.round(cl(s.grain ?? 2, 1, 4)) - 1);
      const one = (kind, c) => ({ A: c, mode: 7, speed: sp, size: kind + 8 * mm, phase, code: 32768 + vc }), c1 = lin(s.color, 0xff2fa8), c2 = lin(s.color2, 0x2bff7a);
      if (bu) { cp = [one(3, c1), one(4, c2)]; A = c1; speed = 0; } else { cp = mm > 0 ? [one(5, c1), one(6, c2)] : null; A = [0, 0, 0]; speed = sp; }
      size = mm / 1000; code = vc; }
    return { spec: s, mode: bu ? MODE.glitch : MODE[s.skin] || MODE.own, A, code, speed, size, phase, cp, rate: bu || Math.max(.05, Math.min(8, s.rate ?? .9)),
      chunky: s.body === 'chunky', echo: E, h: E ? { t: new Float64Array(128), p: new Float32Array(128 * 4), i: 0, n: 0 } : null }; }
  const count = () => { echoN = 0; copyN = 0; for (const e of people.values()) { if (e.echo) echoN += e.echo.n; if (e.cp) copyN += e.cp.length; } };
  function set(who, spec) { const w = find(who); if (!w) return false; const e = entry(w, spec); if (e) people.set(w, e); else people.delete(w); count(); return true; }
  const api = {
    set,
    change(who, patch) { const w = find(who); if (!w) return false; return set(w, { ...(people.get(w)?.spec || {}), ...(patch || {}) }); },
    clear(who) { if (who === undefined) people.clear(); else { const w = find(who); if (w) people.delete(w); } count(); return true; },
    get(who) { const w = find(who), e = w && people.get(w); return e ? { ...e.spec } : null; },
    bursting(who) { const w = find(who), e = w && people.get(w); return !!(e && e.mode === 6 && burst(e)); },
    stats: () => ({ people: people.size, chunky: [...people.values()].filter(e => e.chunky).length, echoes, copies: [copies, copyN], on: tables.map(T => T.U.uFxOn.value.x) }),
    skins: SKINS.slice(),
  };
  // ── per frame (peds.js update): begin → put per drawn instance → echoes → end. With nobody switched and nothing to clear: begin is false
  function begin(t) { let dirty = false; for (const T of tables) if (T.was.length) { dirty = true; break; }
    chunkyNow.length = 0; if (!people.size && !dirty) return false;
    for (const w of people.keys()) if (w.gone) { people.delete(w); count(); }
    for (const T of tables) { for (const k of T.was) T.data[k * 4 + 3] = 0; } time = t; wantCopy[0].length = wantCopy[1].length = 0; copies = 0; return true; }
  const chunky = w => { const e = people.get(w); if (!e?.chunky) return false; chunkyNow.push(w); return true; };
  // glitch's bursts, decided here (the same each run for a time and a phase): in each window of 1/rate s, a burst .1–.3 of it long from a
  // place in its first .7; in a burst the step (15 a second, 1–997) goes in the rate slot, else 0
  const hash = x => { const v = Math.sin(x) * 43758.5453; return v - Math.floor(v); };
  const burst = e => { const ft = time * e.rate + e.phase, fw = Math.floor(ft), fu = ft - fw, h = hash(fw * 12.9898 + e.phase * 78.233), fs = .7 * h;
    return fu > fs && fu < fs + .1 + .2 * hash(h * 91.7 + 3.1) ? 1 + Math.floor(time * 15) % 997 : 0; };
  const put = (b, k, w) => { const e = people.get(w); if (!e) return; if (e.mode === 6) e.speed = burst(e); write(tables[b], k, e, 1); if (e.cp && b < 2) wantCopy[b].push(k, w); };
  // split's, aura's and glitch's (in a burst) copies of the near (b 0) or mid (1) bodies put this frame: each in an instance from k0 while there is room (cap);
  // place(k, j, w) sets instance k as the person's instance j (look, matrix, gait) → the instances in use
  function copy(b, k0, cap, place) { const L = wantCopy[b]; let k = k0;
    for (let i = 0; i < L.length; i += 2) { const e = people.get(L[i + 1]); if (e.mode === 6 && !e.speed) continue;
      for (const c of e.cp) { if (k >= cap) return k; if (e.mode === 6) c.speed = e.speed; place(k, L[i], L[i + 1]); write(tables[b], k, c, 1); k++; copies++; } }
    return k; }
  // the echoes: each echoing person drawn this frame keeps its last 128 places (one each 1/40 s at most); its copies go in the far batch
  // after the far walkers, from instance k0, while there is room (cap) → the instances in use
  function echo(farM, k0, cap, geoOf) { let k = k0; echoes = 0;
    for (const [w, e] of people) { if (!e.echo) continue; const h = e.h; if (!(w.tier > 0)) { h.n = 0; continue; }
      const last = h.n ? h.t[(h.i + 127) % 128] : -1e9;
      if (time - last >= .025 || time < last) { if (time < last) h.n = 0; const j = h.i * 4; h.t[h.i] = time; h.p[j] = w.p[0]; h.p[j + 1] = w.p[1]; h.p[j + 2] = w.p[2]; h.p[j + 3] = w.yawS ?? w.p[3]; h.i = (h.i + 1) % 128; h.n = Math.min(128, h.n + 1); }
      for (let c = 1; c <= e.echo.n && k < cap; c++) { const at = time - c * e.echo.gap; let s = -1;
        for (let q = 1; q <= h.n; q++) { const i = (h.i - q + 128) % 128; if (h.t[i] <= at) { s = i; break; } }
        if (s < 0) continue; const j = s * 4; if (Math.hypot(h.p[j] - w.p[0], h.p[j + 2] - w.p[2]) < .35) continue;
        V.set(h.p[j], h.p[j + 1], h.p[j + 2]); Q.setFromAxisAngle(Y, h.p[j + 3]); M4.compose(V, Q, S1);
        farM.setGeometryIdAt(k, geoOf(w)); farM.setMatrixAt(k, M4); farM.setVisibleAt(k, true); write(tables[2], k, e, e.echo.alpha); k++; echoes++; } }
    return k; }
  function end() { for (const T of tables) { if (T.was.length || T.now.length) T.tex.needsUpdate = true; const was = T.was; T.was = T.now; T.now = was; T.now.length = 0;
      T.U.uFxOn.value.set(T.was.length ? 1 : 0, time); } }
  return { api, install, begin, chunky, chunkyNow, put, copy, echo, end, get echoN() { return echoN; }, get copyN() { return copyN; } };
}
