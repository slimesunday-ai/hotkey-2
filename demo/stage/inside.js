// THE INSIDE VIEW. The owner, 2026-11-13: "the door in and out exit is pretty janky, what would a game dev doo here
// with the inside the home, like is it better to leave the map completely and actually change the whole map to inside
// the location instead of the cutaway? that way it's more realestate?" · "yeah let's go seperate inside view, and we
// will need to make this work for other locations inside the city as well."
//
// Going into a place that has an inside: the walk to its real door outside, the door opens, the step in, the picture
// goes through black (travel.js fade, a third of a second), and then the room ALONE fills the picture over a plain
// backdrop of ours: nothing of the city is drawn. Out is the reverse, and the building outside was never cut,
// ghosted or swapped.
//
// HOW THE CITY IS LEFT OUT. A place builds its inside AWAY from the city (set/crib.js: the pad's room LIFT metres over
// its own lot, so no walker on the ground is anywhere near it), and while the camera is on an inside view it draws one
// render layer only (three.js Layers, LAYER below): the room, our backdrop, the walkers' three batches (the player is
// one of the city's walkers: actors.js) and the lights. Nothing of the city is on that layer (its blocks, its sky,
// its figures, its crowd's contact shadows), so nothing of it is drawn, nor casts a shadow (three's shadow pass asks
// the same layers): whatever stands round the place, however tall. The walkers on the ground are below the backdrop's
// floor. The city's cutaway is not used at all.
//
// THE VIEW FOLLOWS THE BODY. It is up exactly while the person the picture is about (the stage's lead) stands in a
// place's inside (its floor's box, at its floor's height): however they got there, walked through the door
// (doorway.js), put there by a settled or skipped hour, or taken out by a scene. A change nobody walked is a cut to
// black at once (fade.blackNow) and a fade back; a walked one is already black.
//
//   const inside = createInside({ city, actors, fade, lead, who, gap, people })
//                                       lead() the followed person's id · who(id) the director's person (where they
//                                       are going) · gap() the stage's free part of the picture · people(x, z, r)
//                                       [[x, y, z] …] everybody but the lead within r m (the door shot keeps clear)
//                                       · walks(id) is this person's own door walked (the director's player's)
//                                       · night() 0 by day … 1 by night (the ground goes dark with it)
//                                       · fall: fallaway.js, the city taken down to its ground (the real ground
//                                       under a place's inside is drawn with it; without it, the made-up ground)
//   inside.register(place)              a place with an inside (THE CONTRACT, below)
//   inside.has(key) · inside.place(key)
//   inside.up                           the key whose inside view is up, or null
//   await inside.ready()                once the view matches where the lead stands (a switch under way is done)
//   inside.shot(id)                     for camera.js: { kind: 'inside' | 'door', key, view() } or null
//   inside.cut(key)                     camera.js, at every cut of its own: the layers for what it cut to
//   inside.door(id, key, phase)         doorway.js: at the door going in ('in'), just out of it ('out'), done (null)
//   inside.debug()                      for the tools
//
// ── THE CONTRACT: what a place with an inside gives (set/crib.js is the first; the rooms of the pieces branch would
// give it through an adapter). World metres; y up; ry a body's heading (0 faces +z).
//
//   place.key                            'pad:a1', 'room:store'
//   place.door()        → { outside: { step: [x, z]       where a person stands outside, off its doorstep (ground)
//                                      stoop: [x, y, z]    on the doorstep, in front of the door
//                                      sill: [x, y, z]     the doorway's middle, in the building's wall, at its floor
//                                      face: [fx, fz],     the way the door faces, out
//                                      swing?: [[x, z], [x, z]] },  its leaf open, hinge to edge (the door's
//                                                          shot keeps from looking through it)
//                           inside:  { sill: [x, y, z]     the doorway in the inside view
//                                      at: [x, y, z],      the first free step inside it
//                                      ry } }              facing in
//                         or null while it cannot be known (its block is not built)
//   place.open()        → Promise<boolean>   builds its inside where it stands (away from the city: the y of
//                                            inside.sill and of every spot says where) and shows it. Everything it
//                                            draws is on LAYER alone, so nothing of it is ever drawn outside
//   place.close()                            takes it away
//   place.bounds()      → { corners: [[x, z] × 4] its floor, y: the floor's height, h: its walls' height,
//                           look: [dx, dz] the side it is seen from (its open side, out) } or null
//   place.frame?(fit)   → { pos, tgt, fov }  its own camera, if it wants one; else fitFrame(bounds, fit) (below)
//   place.spots(role)   → [{ x, y, z, ry, clip?, stand? }]  by role: 'stand' (where its tenant stands), 'bed'
//                                            (at: lying on it, `stand`: the foot of it, `clip`), 'stash', 'door' …
//   place.way(a, b)     → [[x, y, z] …] or null   a way between two points inside ([x, z] each), round what stands
//                                            in it, ending at b
//   place.solidAt(x, z) → what a body there stands in ('wall', a piece's name), or null: for the audit
//   place.leaf?(side, k, { way, alpha })     its door leaf, 'out' (the building's real door) or 'in' (the inside
//                                            view's), open by k: 0 shut … 1 open, swinging `way` ('in' into the
//                                            building, 'out' out of it: away from whoever walks through, doorway.js)
//   place.leafAt?(side) → { hinge, y, reach, boxes }   where a leaf hangs and what of it is shown (doorway.js measures
//                                            bodies against it)
//   place.ground?()     → 'grass' | 'dirt' | 'concrete'   what its inside stands on (GROUNDS, below; concrete if unsaid)
//   place.lamp?()       → [x, y, z] or null  a lamp inside by night (set/light.js, the city's own lamp light; the
//                                            controller adds a key over the lead, toward the camera)
//
// What the controller does for every place alike: the backdrop, the layers, the black, the camera's frame (fitted
// into the gap the panels leave) and the low shot at the door outside, the audit inside (place.solidAt).

/** The render layer of the inside view (0 is everything of the city's; the city's own shots use 30). */
export const LAYER = 7;
/**
 * Going in: the camera is at the door from this far from its step (m), on the way there. Near: the walk up to the
 * place is the game's own picture, and the cut is to somebody already at their door, in front of the lens (from 4.2 m
 * they were still behind it: the cut was to an empty door, and they came on past the lens).
 */
const NEAR_IN = 2.2;
/** Coming out: it stays at the door until they are this far from the step (m), or stand. */
const NEAR_OUT = 3.6;
/** How much the door's shot may miss of holding a scene's people (doorView `holds`) before the Lock is the picture instead. */
const HOLDS_AT_MOST = 100;
/** The inside view's lens (degrees). */
const FOV = 38;
/** How steeply it looks down into the room (degrees), and how far round from straight on (toward the door). */
const DOWN = 57;
const ROUND = 9;
/** How much of its back walls' height must be in the free part of the picture (the rest may go under the top line). */
const WALLS = 0.5;
/**
 * THE WHOLE ROOM, AND A ZOOM THAT IS THE PLAYER'S. The owner, 2026-11-13, of the first inside view (the whole room in
 * the gap the panels leave): "isn't inside the house the same exact size it was when you could see the city lol?
 * What's the point? I was assuming it would be like a full screen inside the house". Then, of the room fitted to
 * the whole window with the view locked on the player (the back wall cropped, the room sliding): "ok maybe how we had
 * it before was better but maybe you can zoom in on the house instead of locking it at full screen?"
 *
 * So: the frame is the whole room in the free part of the picture, nothing of it cropped. The wheel zooms in on it
 * (the city's own camera controls dolly; ZOOM is how far, as a share of the whole room's distance), the view then
 * slides over the floor by the least that keeps the lead clear of the panels (panFor, below), and the zoom is kept
 * for the next time in (and the next load). Stepping in, the camera comes PUSH nearer as the black lifts.
 */
const ZOOM = { min: 0.45, max: 1.06, key: 'hk2.inside.zoom' };
const PUSH = 0.14;
const PUSH_RATE = 3.2;
/** A person's height with their hat (m), and how fast the view comes round to them (1/s). */
const TALL = 1.9;
const FOLLOW = 5;
/**
 * THE GROUND a place's inside stands on (the owner: "instead of black background, should it just be like a grass
 * plane, concrete plane, etc... depending on the location you are in?"): by the place's own word (place.ground?.()),
 * two tones of it in half-metre squares as the city's lawns and lots are, slabs' joints where it has slabs, and its
 * colour far off, where it falls away so the room is the middle of the picture (sRGB).
 *
 * AND SOME CHARACTER (the owner, of the first plain lawn: "i think the grass needs a bit more character instead of just
 * the flat plane. it looks quite boring"): broad lusher and drier patches, a worn way out from the door with a trodden
 * patch at it (`way`: its two tones; none on concrete), and tufts and a few blooms standing in it (their colours),
 * placed by the place's own name so a place's ground is the same every time. No props: nothing that would have to be
 * dressed again for every place.
 */
const GROUNDS = {
  grass: { a: 0x7db25b, b: 0x75aa54, lush: 0x97cf6c, dry: 0xb4ba68, far: 0x4a783f, slab: 0, way: [0xb7946a, 0xa98759], tufts: [0x4f8f3f, 0x5b9a46, 0x68a850], blooms: [0xf4f0e6, 0xf2c84b, 0xe77fa8] },
  dirt: { a: 0xcdb48c, b: 0xc3a87e, lush: 0xd3bd97, dry: 0xb89c70, far: 0x86714f, slab: 0, way: [0xb7946a, 0xa98759], tufts: [0x8a9a55, 0x7d8f4c], blooms: [] },
  concrete: { a: 0xb7bac1, b: 0xacafb7, lush: 0xbfc2c8, dry: 0xa4a7af, far: 0x6a6e78, slab: 2.5, way: null, tufts: [], blooms: [] },
};
/** The plain backdrop: its sky, its horizon, its floor (sRGB). */
const SKY = 0x2b2830;
const MID = 0x1e1c22;
const FLOOR = 0x151418;

export function createInside({ city, actors, fade, lead = () => null, who = () => null, gap = () => null, people = () => [], walks = () => true, night = () => 0, fall = null }) {
  const THREE = city.THREE;
  const cam = city.camera;
  const places = new Map();
  /** The inside view that is up: { key, place, t } or null. */
  let up = null;
  let switching = null;
  /** Who is at a door now: id → { key, phase }. */
  const doors = new Map();
  /** THE PEOPLE THE DOOR'S SHOT MUST HOLD WHOLE, while the page asks (keep): ids, or null; its last view, and how well it held them. */
  let kept = null;
  let keptAlso = null;
  let keptView = null;
  /** The camera's layers outside (what the city draws). */
  let mask0 = null;
  let onInside = false;
  const stats = { switches: 0, blacks: 0, lastMs: 0, furniture: 0, furnitureFrames: 0, examples: [], frames: 0 };
  // (what the page draws over people's heads follows them on screen: in the inside view, nobody's over the ground)
  const css = document.createElement('style');
  css.textContent = 'body.hk2-inside .hk2-bubbles { visibility: hidden; }';
  document.head.append(css);

  // ── THE BACKDROP: a dome and a floor of ours round the place, on LAYER alone ────────────────────────────────────
  const backdrop = new THREE.Group();
  {
    const c = v => new THREE.Color(v);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: true, fog: false, toneMapped: false,
      uniforms: { uSky: { value: c(SKY) }, uMid: { value: c(MID) }, uFloor: { value: c(FLOOR) } },
      vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform vec3 uSky, uMid, uFloor; varying vec3 vD; void main() { float h = vD.y; vec3 col = h > 0. ? mix(uMid, uSky, smoothstep(0., .7, h)) : mix(uMid, uFloor, smoothstep(0., .25, -h)); gl_FragColor = vec4(col, 1.);\n#include <colorspace_fragment>\n}',
    }));
    // (the floor: everything below the room's floor, the walkers on the ground among them, is behind it)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(420, 48), new THREE.ShaderMaterial({
      fog: false, toneMapped: false,
      uniforms: {
        uA: { value: c(GROUNDS.concrete.a) }, uB: { value: c(GROUNDS.concrete.b) }, uFar: { value: c(GROUNDS.concrete.far) }, uSlab: { value: 0 },
        uC: { value: new THREE.Vector2() }, uAx: { value: new THREE.Vector2(1, 0) }, uHalf: { value: new THREE.Vector2(3, 3) }, uNight: { value: 0 },
        uLush: { value: c(GROUNDS.concrete.lush) }, uDry: { value: c(GROUNDS.concrete.dry) }, uWayA: { value: c(0) }, uWayB: { value: c(0) }, uWay: { value: 0 },
        uDoor: { value: new THREE.Vector2() }, uOut: { value: new THREE.Vector2(0, 1) },
      },
      vertexShader: 'varying vec2 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform vec3 uA, uB, uFar, uLush, uDry, uWayA, uWayB; uniform float uSlab, uNight, uWay; uniform vec2 uC, uAx, uHalf, uDoor, uOut; varying vec2 vW;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
        void main() {
          // (quarter-metre cells, the city's voxel: every patch and edge below is cut on them)
          vec2 cell = floor(vW * 4.);
          vec2 q = (cell + .5) / 4.;
          // (two tones in half-metre squares, in patches: the city's lawns and lots)
          float t = step(.5, hash(floor(vW * 2.)) * .55 + hash(floor(vW * .5) + 7.) * .45);
          vec3 col = mix(uA, uB, t);
          // (broad patches, lusher and drier, and a dark speck here and there)
          col = mix(col, uLush, step(.56, vn(q * .34 + 3.1) + (hash(cell + 31.) - .5) * .12) * .9);
          col = mix(col, uDry, step(.66, vn(q * .19 - 9.4) + (hash(cell + 47.) - .5) * .12) * .85);
          // (and darker clumps, a cell here and there)
          col *= 1. - .13 * step(.72, vn(q * 1.3 + 40.)) * step(.45, hash(cell + 2.));
          if (uSlab > 0.) { vec2 f = fract(vW / uSlab) * uSlab; col *= (f.x < .07 || f.y < .07) ? .86 : 1.; }
          // (the worn way out from the door, wandering a little, ragged at its edges, and the trodden patch at the door)
          if (uWay > 0.) {
            vec2 dd = q - uDoor;
            float along = dot(dd, uOut);
            float across = dot(dd, vec2(-uOut.y, uOut.x));
            float wob = (vn(vec2(along * .55, 4.2)) - .5) * 1.3 * smoothstep(.5, 4., along);
            float w = .55 + .3 * vn(vec2(along * 1.1, 9.7));
            float m = (1. - smoothstep(w, w + .45, abs(across - wob))) * smoothstep(-.3, .2, along) * (1. - smoothstep(5.5, 9.5, along));
            m = max(m, 1. - smoothstep(1., 1.7, length(dd - uOut * .7)));
            m = step(.5, m + (hash(cell + 5.) - .5) * .55);
            col = mix(col, mix(uWayA, uWayB, step(.5, hash(floor(vW * 2.) + 13.))), m * uWay);
          }
          // (the place's own floor: how far outside its box this point is)
          vec2 d = vW - uC;
          vec2 o = abs(vec2(dot(d, uAx), dot(d, vec2(-uAx.y, uAx.x)))) - uHalf;
          float sd = length(max(o, 0.)) + min(max(o.x, o.y), 0.);
          // (it stands ON the ground: darker close in under its walls; and the ground falls away far off)
          col *= mix(.66, 1., smoothstep(0., 1.5, sd));
          col = mix(col, uFar, smoothstep(5., 26., sd));
          col = mix(col, col * vec3(.15, .18, .3), uNight);
          gl_FragColor = vec4(col, 1.);
          #include <colorspace_fragment>
        }`,
    }));
    floor.rotation.x = -Math.PI / 2;
    for (const m of [dome, floor]) {
      m.frustumCulled = false;
      m.castShadow = false;
      m.receiveShadow = false;
      m.layers.set(LAYER);
    }
    dome.renderOrder = -2;
    backdrop.add(dome, floor);
    backdrop.visible = false;
    backdrop.userData.floor = floor;
    backdrop.userData.dome = dome;
    // (what stands in the ground: tufts and a few blooms, small boxes as everything here is; placed in ground())
    const tufts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ fog: false, toneMapped: false }), 420);
    tufts.count = 0;
    tufts.frustumCulled = false;
    tufts.castShadow = false;
    tufts.receiveShadow = false;
    tufts.layers.set(LAYER);
    backdrop.add(tufts);
    backdrop.userData.tufts = tufts;
    backdrop.userData.own = [dome, floor, tufts];
    city.scene.add(backdrop);
  }
  // ── THE GROUND UNDER A PLACE IS THE CITY'S OWN. The owner, 2026-11-13: "the trailer ground is still grass it should be
  // the actual ground the trailer is on, just the other trailers around reverse voxel build/stack away". A place's
  // inside stands `lift` metres over its own lot, so a camera that much LOWER than the inside view's sees the lot's
  // own ground exactly where the inside view has the place's floor. Every frame the view is up, the city is drawn
  // once more from that lower camera, taken down to its ground (fallaway.js: nothing over the lot's slabs, lawns and
  // paths drawn, nobody on them, no shadow of what is not there), into a picture that is the back of the inside
  // view. So the room stands on its real lot, by day and by night, at any zoom. The made-up ground (above) stays for
  // a place with no lift, or a page with no fallaway; its floor is kept, unseen, as what hides the walkers below.
  // NOT THE DEFAULT (the owner, 2026-11-14, having played it: "we need to go back to the grass surface with plants, the
  // concrete surface is super glitchy. let's just use the grass for now that you made"). The lot's own ground is
  // drawn only when the page asks for it, ?ground=real; otherwise the made-up ground with its patches, its worn way
  // and its tufts.
  const REAL_GROUND = new URLSearchParams(location.search).get('ground') === 'real';
  const real = { rt: null, quad: null, cam: null, size: new THREE.Vector2(), on: false, frames: 0 };
  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { uC: backdrop.userData.floor.material.uniforms.uC, uAx: backdrop.userData.floor.material.uniforms.uAx, uHalf: backdrop.userData.floor.material.uniforms.uHalf },
    vertexShader: 'varying vec2 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec2 uC, uAx, uHalf; varying vec2 vW; void main() { vec2 d = vW - uC; vec2 o = abs(vec2(dot(d, uAx), dot(d, vec2(-uAx.y, uAx.x)))) - uHalf; float sd = length(max(o, 0.)) + min(max(o.x, o.y), 0.); gl_FragColor = vec4(0., 0., 0., .3 * (1. - smoothstep(0., 1.4, sd))); }',
  }));
  skirt.rotation.x = -Math.PI / 2;
  skirt.position.y = 0.02;
  skirt.frustumCulled = false;
  skirt.renderOrder = -900;
  skirt.layers.set(LAYER);
  skirt.visible = false;
  backdrop.add(skirt);
  // (what is ours on the inside's layer, not a place's: never stacked up, below)
  const ours = new Set([...backdrop.userData.own, skirt]);
  /** Draws the lot's own ground for this frame (true), or says the made-up ground must do (false). */
  function realGround() {
    const lift = Number(up?.place?.lift) || 0;
    const can = REAL_GROUND && !!fall?.ok && onInside && !!up && lift > 0 && mask0 !== null;
    if (can !== real.on) {
      real.on = can;
      const F = backdrop.userData.floor;
      F.material.colorWrite = !can;
      F.renderOrder = can ? -950 : 0;
      backdrop.userData.dome.visible = !can;
      backdrop.userData.tufts.visible = !can;
      skirt.visible = can;
      if (real.quad) real.quad.visible = can;
    }
    if (!can) return false;
    const R = city.renderer;
    R.getDrawingBufferSize(real.size);
    const [w, h] = [Math.max(2, real.size.x), Math.max(2, real.size.y)];
    if (!real.rt) {
      // (as the city's own scene target, render/post.js: the materials tone-map and encode into it as on the canvas)
      real.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, samples: Math.min(4, R.capabilities.maxSamples || 0) });
      real.rt.texture.internalFormat = 'RGBA8';
      real.rt.isXRRenderTarget = true;
      real.rt.texture.colorSpace = THREE.SRGBColorSpace;
      real.cam = new THREE.PerspectiveCamera();
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
      real.quad = new THREE.Mesh(g, new THREE.ShaderMaterial({
        depthTest: false, depthWrite: false, fog: false, toneMapped: false, uniforms: { tBg: { value: real.rt.texture } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 1., 1.); }',
        fragmentShader: 'uniform sampler2D tBg; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(tBg, vUv).rgb, 1.); }',
      }));
      real.quad.frustumCulled = false;
      real.quad.renderOrder = -1000;
      real.quad.layers.set(LAYER);
      city.scene.add(real.quad);
    } else if (real.rt.width !== w || real.rt.height !== h) real.rt.setSize(w, h);
    const C = real.cam;
    C.copy(cam, false);
    C.position.y -= lift;
    C.layers.mask = mask0;
    C.updateMatrixWorld(true);
    fall.under(() => {
      const was = R.getRenderTarget();
      R.setRenderTarget(real.rt);
      R.clear();
      R.render(city.scene, C);
      R.setRenderTarget(was);
    });
    real.frames += 1;
    return true;
  }

  // ── A PLACE'S INSIDE CAN STACK ITSELF UP (the opening: the city unstacks, and the room is built where the trailer
  // stood). Whatever is drawn on the inside's layer alone and is not ours here gets one more test, chained onto its
  // material as fallaway.js chains onto the city's: over a half-metre column, nothing above a height is drawn, and
  // the height goes up a quarter of a metre at a time from the floor as the clock runs, a little ragged.
  const RISE = { value: new THREE.Vector4(0, 0, 0, 0.3) };
  const risen = new Set();
  function riseize(mat) {
    if (risen.has(mat) || !mat || mat.isShaderMaterial) return;
    risen.add(mat);
    const prev = mat.onBeforeCompile;
    const key = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh, r) => {
      prev?.call(mat, sh, r);
      if (!sh.fragmentShader?.includes('#include <clipping_planes_fragment>') || !sh.vertexShader?.includes('#include <project_vertex>')) return;
      sh.uniforms.uHkRise = RISE;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHkW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n  { vec4 hkW = vec4( transformed, 1. );\n#ifdef USE_INSTANCING\n  hkW = instanceMatrix * hkW;\n#endif\n  vHkW = ( modelMatrix * hkW ).xyz; }');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vHkW; uniform vec4 uHkRise;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if ( uHkRise.x > 0. ) { vec2 hkC = floor( vHkW.xz * 2. ); float hkN = fract( sin( dot( hkC, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); if ( vHkW.y > uHkRise.y + floor( max( ( uHkRise.z - hkN * uHkRise.w ) * 16., 0. ) ) * .25 ) discard; }');
    };
    mat.customProgramCacheKey = () => (key ? key.call(mat) : mat.type) + '|hk2rise';
    mat.needsUpdate = true;
  }
  /** Chains the rise onto everything of a place's inside that is on the scene now. */
  function riseScan() {
    city.scene.traverse(o => {
      if (!o.isMesh || ours.has(o) || !(o.layers.mask & (1 << LAYER)) || (o.layers.mask & 1)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) riseize(m);
    });
  }

  /** The ground under a place: its kind's colours, and where its floor is (the ground is darker close under it). */
  function ground(place, b) {
    // (the city's materials are asked to take the fall whenever a view goes up, under its black: new blocks bring
    // new ones, and nothing else asks when the opening is the walk in)
    if (REAL_GROUND) fall?.scan?.();
    const G = GROUNDS[place.ground?.()] ?? GROUNDS.concrete;
    const U = backdrop.userData.floor.material.uniforms;
    U.uA.value.set(G.a);
    U.uB.value.set(G.b);
    U.uFar.value.set(G.far);
    U.uSlab.value = G.slab;
    const Q = b.corners;
    const [cx, cz] = [Q.reduce((s, q) => s + q[0], 0) / 4, Q.reduce((s, q) => s + q[1], 0) / 4];
    const [ex, ez] = [Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]];
    const el = Math.hypot(ex, ez) || 1;
    U.uC.value.set(cx, cz);
    U.uAx.value.set(ex / el, ez / el);
    U.uHalf.value.set(el / 2, Math.hypot(Q[2][0] - Q[1][0], Q[2][1] - Q[1][1]) / 2);
    U.uLush.value.set(G.lush);
    U.uDry.value.set(G.dry);
    // (the way out: from the inside's doorway, the way the place is seen from)
    const sill = place.door?.()?.inside?.sill ?? null;
    const ll = Math.hypot(b.look?.[0] ?? 0, b.look?.[1] ?? 0);
    const out = ll ? [b.look[0] / ll, b.look[1] / ll] : null;
    const way = !!(G.way && sill && out);
    U.uWay.value = way ? 1 : 0;
    if (way) {
      U.uWayA.value.set(G.way[0]);
      U.uWayB.value.set(G.way[1]);
      U.uDoor.value.set(sill[0], sill[2]);
      U.uOut.value.set(out[0], out[1]);
    }
    // (tufts and blooms: by the place's name, on the quarter-metre grid, clear of the floor's box and of the way)
    const T = backdrop.userData.tufts;
    let seed = 2166136261;
    for (const ch of String(place.key)) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let v = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
      return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
    };
    const M4 = new THREE.Matrix4();
    const col = new THREE.Color();
    const [ax, az] = [ex / el, ez / el];
    const [hx, hz] = [el / 2, Math.hypot(Q[2][0] - Q[1][0], Q[2][1] - Q[1][1]) / 2];
    let n = 0;
    const put = (x, z, w, h, y, hex) => {
      if (n >= T.instanceMatrix.count) return;
      M4.makeScale(w, h, w).setPosition(x - cx, y + h / 2, z - cz);
      T.setMatrixAt(n, M4);
      T.setColorAt(n, col.set(hex));
      n += 1;
    };
    for (let k = 0; k < 1400 && G.tufts.length && n < 400; k++) {
      const [x, z] = [Math.round((cx + (rnd() * 2 - 1) * (hx + 9)) * 4) / 4 + 0.125, Math.round((cz + (rnd() * 2 - 1) * (hz + 9)) * 4) / 4 + 0.125];
      const [dx, dz] = [x - cx, z - cz];
      const [u, v] = [Math.abs(dx * ax + dz * az) - hx, Math.abs(-dx * az + dz * ax) - hz];
      // (not in the place or under its walls; thinner further off)
      if (Math.max(u, v) < 0.9 || rnd() < Math.max(0, Math.max(u, v) - 3.5) / 6.5) continue;
      if (way) {
        const [wx, wz] = [x - sill[0], z - sill[2]];
        const along = wx * out[0] + wz * out[1];
        if (along > -0.6 && along < 10 && Math.abs(-wx * out[1] + wz * out[0]) < 1.5) continue;
      }
      const tone = G.tufts[Math.floor(rnd() * G.tufts.length)];
      const h = 0.14 + rnd() * 0.22;
      put(x, z, 0.2 + rnd() * 0.08, h, 0, tone);
      if (G.blooms.length && rnd() < 0.16) put(x, z, 0.14, 0.14, h + 0.04, G.blooms[Math.floor(rnd() * G.blooms.length)]);
    }
    T.count = n;
    T.instanceMatrix.needsUpdate = true;
    if (T.instanceColor) T.instanceColor.needsUpdate = true;
    // (the dome, seen only if a hand turns the camera up: the ground's far colour to the horizon, a plain sky over it)
    const D = backdrop.userData.dome.material.uniforms;
    D.uFloor.value.set(G.far);
    D.uMid.value.set(G.far);
    D.uSky.value.set(0x9cc0e4);
  }
  // (a soft shadow under whoever stands in the room: the city's contact shadows are on the ground, not here)
  const blob = (() => {
    const can = document.createElement('canvas');
    can.width = can.height = 64;
    const g = can.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grad.addColorStop(0, 'rgba(0,0,0,0.42)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.18)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(can), transparent: true, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2;
    m.layers.set(LAYER);
    m.renderOrder = 1;
    m.visible = false;
    city.scene.add(m);
    return m;
  })();
  ours.add(blob);

  // ── where a body is: in a place's inside, or not ────────────────────────────────────────────────────────────────
  /** Is (x, z) in the quad, grown by `pad` metres? */
  function inQuad(Q, x, z, pad = 0) {
    let inside = true;
    for (let k = 0; k < 4; k++) {
      const [ax, az] = Q[k];
      const [bx, bz] = Q[(k + 1) % 4];
      const [ex, ez] = [bx - ax, bz - az];
      const len = Math.hypot(ex, ez) || 1;
      // (the quad's winding either way: the sign of the cross product against its middle's)
      const s = (ex * (z - az) - ez * (x - ax)) / len;
      const mx = (Q[0][0] + Q[2][0]) / 2;
      const mz = (Q[0][1] + Q[2][1]) / 2;
      const sm = ex * (mz - az) - ez * (mx - ax);
      if ((sm > 0 ? s : -s) < -pad) inside = false;
    }
    return inside;
  }
  function holds(place, x, y, z) {
    const b = place.bounds?.();
    if (!b) return false;
    return y > b.y - 0.7 && y < b.y + (b.h ?? 2.6) + 0.5 && inQuad(b.corners, x, z, 0.7);
  }
  /** The place whose inside the lead stands in, or null. */
  function wanted() {
    const id = lead();
    if (!id || !actors.has(id)) return null;
    const A = actors.get(id);
    if (A.w.hide) return null;
    if (up && holds(up.place, A.x, A.y, A.z)) return up.key;
    for (const [key, place] of places) if (holds(place, A.x, A.y, A.z)) return key;
    return null;
  }

  // ── the switch: under black, the room, the backdrop; the camera is told, and the picture comes back ─────────────
  const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
  let hooks = { switched: null };
  async function switchTo(key) {
    const t0 = performance.now();
    stats.switches += 1;
    // (black at once unless it is black already: a walked door faded it out, and this hold changes nothing)
    if (!fade.dark) stats.blacks += 1;
    fade.blackNow();
    try {
      if (up) {
        const was = up;
        up = null;
        try {
          was.place.close();
        } catch (err) {
          console.warn('[inside] the place did not close:', was.key, err);
        }
        backdrop.visible = false;
        blob.visible = false;
        if (real.quad) real.quad.visible = false;
        real.on = false;
        backdrop.userData.floor.material.colorWrite = true;
        backdrop.userData.dome.visible = true;
        backdrop.userData.tufts.visible = true;
        skirt.visible = false;
        document.body.classList.remove('hk2-inside');
        lampHook?.(null);
      }
      if (key) {
        const place = places.get(key);
        let ok = false;
        try {
          ok = await place.open();
        } catch (err) {
          console.warn('[inside] the place did not open:', key, err);
        }
        // (the lead walked out again while it was being built: it is not shown)
        if (ok && wanted() === key) {
          up = { key, place, t: performance.now() };
          const b = place.bounds();
          const [cx, cz] = [b.corners.reduce((s, q) => s + q[0], 0) / 4, b.corners.reduce((s, q) => s + q[1], 0) / 4];
          backdrop.position.set(cx, b.y - 0.06, cz);
          backdrop.visible = true;
          document.body.classList.add('hk2-inside');
          follow.push = PUSH;
          ground(place, b);
          lamps.room = place.lamp?.() ?? null;
          lamps.key = null;
          lampHook?.(lamps.room ? [lamps.room] : null);
          frames.delete(key);
        } else if (ok) place.close();
      }
      // the camera is put on it (or back on the lead), and has cut before the picture comes back; and again if the
      // panels were laid out meanwhile (a settled hour's first paint comes after the stage has put everyone)
      hooks.switched?.(up?.key ?? null);
      for (let k = 0; k < 4; k++) {
        await frame();
        if (!!up === onInside && k >= 1) break;
      }
      for (let k = 0; k < 3 && up; k++) {
        await frame();
        await frame();
        if (!stale()) break;
        hooks.switched?.(up.key);
      }
    } finally {
      stats.lastMs = Math.round(performance.now() - t0);
      switching = null;
      fade.in();
    }
  }
  let lampHook = null;
  // the lamps by night: the place's own, and a key over the lead toward the camera (the stage keeps one over the
  // lead outside: index.js KEY), so a face turned to the picture is lit
  const lamps = { room: null, key: null };

  // ── every frame: the view follows the lead; the audit inside; the blob ─────────────────────────────────────────
  const low = new Set(['sleep', 'sit_bench', 'lie_hurt', 'lie_still']);
  actors.onFrame(dt => {
    stats.frames += 1;
    if (!switching) {
      const want = wanted();
      if (want !== (up?.key ?? null)) switching = switchTo(want);
    }
    if (!up) return;
    // (the panels were laid out again, or the stage slid the picture: the room is framed afresh)
    if (!switching && onInside && stats.frames % 30 === 0 && stale()) hooks.switched?.(up.key);
    followLead(dt);
    realGround();
    const dusk = Math.max(0, Math.min(1, night() || 0));
    backdrop.userData.floor.material.uniforms.uNight.value = dusk;
    backdrop.userData.tufts.material.color.setRGB(1 - dusk * 0.85, 1 - dusk * 0.82, 1 - dusk * 0.7);
    // a soft shadow under the lead
    const id = lead();
    const L = id && actors.has(id) ? actors.get(id) : null;
    const b = up.place.bounds();
    if (L && b && !L.w.hide && holds(up.place, L.x, L.y, L.z) && !low.has(L.clipName) && Math.abs(L.y - b.y) < 0.2) {
      blob.visible = true;
      blob.position.set(L.x, b.y + 0.012, L.z);
    } else blob.visible = false;
    if (L && b && lamps.room && holds(up.place, L.x, L.y, L.z)) {
      const cp = cam.position;
      const d = Math.hypot(cp.x - L.x, cp.z - L.z) || 1;
      const key = [L.x + ((cp.x - L.x) / d) * 1.1, b.y + 2.1, L.z + ((cp.z - L.z) / d) * 1.1];
      if (!lamps.key || Math.hypot(key[0] - lamps.key[0], key[2] - lamps.key[2]) > 0.08) {
        lamps.key = key;
        lampHook?.([lamps.room, key]);
      }
    }
    // THE AUDIT INSIDE (actors.js leaves anybody in a room to the room): standing or walking in what is solid in it
    // (place.solidAt: a piece of furniture, a wall), not lying or sitting in what is theirs to, for half a second
    for (const A of actors.all()) {
      if (A.w.hide || !holds(up.place, A.x, A.y, A.z)) continue;
      const lying = low.has(A.clipName) || /^(sit|lie|sleep)/.test(A.clipName ?? '');
      const what = lying ? null : up.place.solidAt(A.x, A.z);
      if (what) {
        stats.furnitureFrames += 1;
        const t = (A.inRoomSolid ?? 0) + dt;
        if (t > 0.5 && (A.inRoomSolid ?? 0) <= 0.5) {
          stats.furniture += 1;
          actors.count('furniture');
          if (stats.examples.length < 20) stats.examples.push(`furniture ${A.id} in ${what} inside ${up.key} at ${A.x.toFixed(2)}, ${A.z.toFixed(2)}${A.clipName ? ', ' + A.clipName : ''}${A.path ? ', walking' : ''}`);
        }
        A.inRoomSolid = t;
      } else A.inRoomSolid = 0;
    }
  });

  // ── the camera ──────────────────────────────────────────────────────────────────────────────────────────────────
  /** The free part of the picture: the stage's gap between the panels, less any panel across it (phone width). */
  let tallest = 0;
  let tallUnder = null;
  let tallFit = '';
  function freeRect(all = false) {
    const W = innerWidth;
    const H = innerHeight;
    const g = gap() ?? { left: 0, top: 0, right: W, bottom: H };
    let [l, t, r, b] = [g.left, g.top, g.right, g.bottom];
    let card = 0;
    for (const el of document.querySelectorAll('.hk-panel, .hk-top, .hk-left > *, .hk-right > *')) {
      const q = el.getBoundingClientRect();
      // (the map, opened on demand over everything, is not a panel the room makes way for)
      // (`all`: panels laid out but kept out of the picture count too: the opening frames the room for them before they show)
      if (!(q.width > 0 && q.height > 0) || (!all && getComputedStyle(el).visibility === 'hidden') || el.classList.contains('rn-map')) continue;
      if (q.right <= l || q.left >= r || q.bottom <= t || q.top >= b) continue;
      if (el.classList.contains('hk-move-card')) {
        // (the card at the place itself: the shop's at the crib, not the market's)
        if (up) card = H - q.top;
        continue;
      }
      // (across the picture at phone width: the cards stacked under the top line)
      if (q.width > (r - l) * 0.6) {
        if (q.top < (t + b) / 2) t = Math.max(t, q.bottom);
        else b = Math.min(b, q.top);
      } else if (q.left - l < r - q.right) l = Math.max(l, q.right);
      else r = Math.min(r, q.left);
    }
    // (the move card: the tallest seen, so the room does not ride up and down with it; at least what the crib's
    // shop takes. Kept under the same top: when a panel across the top opens or folds, the run's dock at phone
    // width, the card is sized to what that leaves, and the tallest seen under the other top no longer holds)
    // (and a card that changes its size on purpose says so, `data-fit`: the run's bar folded or open, measured anew)
    const fit = document.querySelector('.hk-move-card')?.dataset.fit ?? '';
    if (tallUnder === null || Math.abs(t - tallUnder) > 24 || fit !== tallFit) [tallest, tallUnder, tallFit] = [0, t, fit];
    tallest = Math.max(tallest, card);
    // (the least: what the crib's card takes. The run's thin bar, 11-13, says how it is (`data-fit`): open, less than
    // the old card; folded, one row playing or choosing, so the measure alone holds. Any other card as before)
    const least = fit === 'folded' ? 0 : fit === 'open' ? (W <= 720 ? H * 0.3 : H * 0.12) : W <= 720 ? H * 0.42 : H * 0.17;
    b = Math.min(b, H - Math.max(tallest, least) - 6);
    return { left: l + 8, top: t + 8, right: r - 8, bottom: Math.max(t + 60, b - 4), W, H };
  }
  const frames = new Map();
  // (the free part of the picture as the panels really leave it, kept for the next load of the same window: the
  // opening frames the room before the panels are painted, and an empty dock and card leave nearly the whole window)
  const RECT_KEY = 'hk2.inside.rect';
  const remember = q => {
    if (!q || !(q.left > 0 || q.top > 0)) return;
    try {
      localStorage.setItem(RECT_KEY, JSON.stringify({ W: q.W, H: q.H, left: q.left, top: q.top, right: q.right, bottom: q.bottom, off: offNow() }));
    } catch { /* (no storage: the estimate next time) */ }
  };
  const recall = () => {
    try {
      const q = JSON.parse(localStorage.getItem(RECT_KEY) || 'null');
      return q && q.W === innerWidth && q.H === innerHeight && q.right > q.left + 80 && q.bottom > q.top + 60 ? q : null;
    } catch {
      return null;
    }
  };
  /** The camera that fills the free part of the picture with the place's floor (and its back walls' tops). */
  function frameOf(place) {
    const rect = freeRect();
    const had = frames.get(place.key);
    if (had && !moved(had.rect, rect)) return had.view;
    const view = place.frame?.(rect) ?? fitFrame(place.bounds(), rect, place.door?.()?.inside?.sill ?? null);
    frames.set(place.key, { rect: { ...rect, off: offNow() }, view });
    if (up && !held && !document.body.classList.contains('hk2-opening')) remember(rect);
    return view;
  }
  /** Has the free part of the picture changed enough to frame the room again? */
  const moved = (a, b) => a.W !== b.W || a.H !== b.H || ['left', 'top', 'right', 'bottom'].some(k => Math.abs(a[k] - b[k]) > 24) || (a.off ?? '') !== (b.off ?? offNow());
  /** The stage's slide of the picture into the panels' gap (stage/index.js fitToPanels: the camera's view offset). */
  const offNow = () => (cam.view?.enabled ? `${cam.view.offsetX},${cam.view.offsetY}` : '0,0');
  /** The inside view's frame was made for other panels than these (the page laid them out after the cut). */
  const stale = () => !!up && moved(frames.get(up.key)?.rect ?? { W: 0 }, freeRect());
  const V3 = new THREE.Vector3();
  /**
   * THE FRAME: from the place's open side, DOWN degrees down and ROUND round toward the door, as far off as makes
   * the floor fill the free part of the picture (and the backs of its walls fit in it), aimed so it sits in the
   * middle of that part. Measured with the page's own camera (its view offset: the stage slides the picture's middle
   * into the gap the panels leave).
   */
  function fitFrame(b, rect, sill = null) {
    if (!b) return null;
    const C = new THREE.PerspectiveCamera();
    C.copy(cam);
    C.fov = FOV;
    C.aspect = rect.W / rect.H;
    C.updateProjectionMatrix();
    const [cx, cz] = [b.corners.reduce((s, q) => s + q[0], 0) / 4, b.corners.reduce((s, q) => s + q[1], 0) / 4];
    // (round toward the door's side, so the door is seen a little from its front)
    let [lx, lz] = b.look;
    const ll = Math.hypot(lx, lz) || 1;
    [lx, lz] = [lx / ll, lz / ll];
    let turn = ROUND * Math.PI / 180;
    if (sill) {
      const side = (sill[0] - cx) * lz - (sill[2] - cz) * lx;
      if (side > 0) turn = -turn;
    }
    [lx, lz] = [lx * Math.cos(turn) + lz * Math.sin(turn), -lx * Math.sin(turn) + lz * Math.cos(turn)];
    const el = (DOWN * Math.PI) / 180;
    const dir = new THREE.Vector3(lx * Math.cos(el), Math.sin(el), lz * Math.cos(el));
    // what must be in the picture: the floor, and the walls at its back (the side away from the look) to WALLS of
    // their height: the floor is what fills the picture
    const pts = b.corners.map(([x, z]) => new THREE.Vector3(x, b.y, z));
    const back = b.corners.map(([x, z]) => [x, z, (x - cx) * lx + (z - cz) * lz]).sort((p, q) => p[2] - q[2]).slice(0, 2);
    for (const [x, z] of back) pts.push(new THREE.Vector3(x, b.y + b.h * WALLS, z));
    const tgt = new THREE.Vector3(cx, b.y + 0.4, cz);
    const right = new THREE.Vector3();
    const upv = new THREE.Vector3();
    const W = rect.W;
    const H = rect.H;
    const rw = Math.max(80, rect.right - rect.left);
    const rh = Math.max(60, rect.bottom - rect.top);
    const span = Math.max(4, ...b.corners.map(([x, z]) => Math.hypot(x - cx, z - cz) * 2));
    let d = span * 2;
    for (let it = 0; it < 24; it++) {
      C.position.copy(tgt).addScaledVector(dir, d);
      C.lookAt(tgt);
      C.updateMatrixWorld();
      let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
      let behind = false;
      for (const p of pts) {
        V3.copy(p).project(C);
        if (!(V3.z < 1)) behind = true;
        const px = ((V3.x + 1) / 2) * W;
        const py = ((1 - V3.y) / 2) * H;
        [x0, x1, y0, y1] = [Math.min(x0, px), Math.max(x1, px), Math.min(y0, py), Math.max(y1, py)];
      }
      if (behind || !Number.isFinite(x0 + x1 + y0 + y1)) {
        d *= 1.4;
        continue;
      }
      let s = Math.max((x1 - x0) / (rw * 0.97), (y1 - y0) / (rh * 0.97));
      // (a phone's free part is a strip between the stacked cards, 60 px of 860: the whole room in it is a stamp.
      // There the room is fitted to the window's width, until a person in it is 0.6 of the strip's height, and the
      // view follows them: the floor 93 px wide becomes about 320)
      if (W <= 720) {
        const sWin = Math.max((x1 - x0) / (W * 0.98), (y1 - y0) / (H * 0.98));
        V3.set(cx, b.y, cz).project(C);
        const feet = ((1 - V3.y) / 2) * H;
        V3.set(cx, b.y + TALL, cz).project(C);
        s = Math.min(s, Math.max(sWin, Math.abs(feet - ((1 - V3.y) / 2) * H) / (rh * 0.6)));
      }
      // (the box's middle onto the free part's middle: world metres per pixel at the target's distance)
      const wpp = (2 * d * Math.tan((FOV * Math.PI) / 360)) / H;
      const [ex, ey] = [((rect.left + rect.right) / 2 - (x0 + x1) / 2) * wpp, ((rect.top + rect.bottom) / 2 - (y0 + y1) / 2) * wpp];
      right.setFromMatrixColumn(C.matrixWorld, 0);
      upv.setFromMatrixColumn(C.matrixWorld, 1);
      tgt.addScaledVector(right, -ex * 0.8).addScaledVector(upv, ey * 0.8);
      d = Math.max(span * 0.8, Math.min(span * 12, d * Math.pow(s, 0.8)));
    }
    C.position.copy(tgt).addScaledVector(dir, d);
    stats.fit = { rect: [rect.left, rect.top, rect.right, rect.bottom].map(Math.round), d: +d.toFixed(2) };
    return { pos: C.position.toArray(), tgt: tgt.toArray(), fov: FOV };
  }

  // ── THE VIEW, ZOOMED AND FOLLOWING: the frame is the whole room; from nearer (the player's wheel, or the push in at
  // the door) the room is bigger than the free part of the picture, and the camera slides over its floor (never
  // turning) by the least that puts the lead, hat to shoes, in the clear between the panels. From the whole room's
  // distance, with them anywhere on its floor, it does not move at all.
  const follow = { key: null, pan: [0, 0], set: null, m: 1, free: false, zoom: 1, push: 0 };
  try {
    const z = Number(localStorage.getItem(ZOOM.key));
    if (z >= ZOOM.min && z <= ZOOM.max) follow.zoom = z;
  } catch { /* (no storage: the whole room) */ }
  const mult = () => Math.max(ZOOM.min, Math.min(ZOOM.max, follow.zoom)) * (1 + follow.push);
  const FC = new THREE.PerspectiveCamera();
  /** The frame `v` from m times as far (1: the whole room), slid by `pan` over the floor. */
  const panned = (v, pan, m = 1) => ({
    pos: [v.tgt[0] + (v.pos[0] - v.tgt[0]) * m + pan[0], v.tgt[1] + (v.pos[1] - v.tgt[1]) * m, v.tgt[2] + (v.pos[2] - v.tgt[2]) * m + pan[1]],
    tgt: [v.tgt[0] + pan[0], v.tgt[1], v.tgt[2] + pan[1]], fov: v.fov,
  });
  /** How far over the floor ([dx, dz], m) the frame `view0`, from m times as far, must slide for the lead to be in the clear of `rect`. */
  function panFor(place, view0, rect, m = 1) {
    const id = lead();
    const L = id && actors.has(id) ? actors.get(id) : null;
    const b = place.bounds();
    if (!L || !b || !rect || !holds(place, L.x, L.y, L.z)) return [0, 0];
    const view = panned(view0, [0, 0], m);
    FC.copy(cam);
    FC.fov = view.fov;
    FC.aspect = rect.W / rect.H;
    FC.updateProjectionMatrix();
    const [bx, by, bz] = view.pos;
    const [tx, ty, tz] = view.tgt;
    // (the look's way over the ground, and its right)
    let [gx, gz] = [tx - bx, tz - bz];
    const gl = Math.hypot(gx, gz) || 1;
    [gx, gz] = [gx / gl, gz / gl];
    const [rx, rz] = [-gz, gx];
    const sinEl = Math.max(0.25, (by - ty) / (Math.hypot(bx - tx, by - ty, bz - tz) || 1));
    const tall = low.has(L.clipName) ? 0.7 : TALL;
    const span = Math.max(4, ...b.corners.map(([x, z]) => Math.hypot(x - b.corners[0][0], z - b.corners[0][1])));
    // (how far a box lo…hi must move to be inside a…c; a box too big for it, to its middle)
    const need = (lo, hi, a, c) => (hi - lo <= c - a ? (lo < a ? a - lo : hi > c ? c - hi : 0) : (a + c) / 2 - (lo + hi) / 2);
    let pan = [0, 0];
    for (let it = 0; it < 4; it++) {
      FC.position.set(bx + pan[0], by, bz + pan[1]);
      FC.lookAt(tx + pan[0], ty, tz + pan[1]);
      FC.updateMatrixWorld();
      V3.set(L.x, L.y, L.z).project(FC);
      const [fx, fy] = [((V3.x + 1) / 2) * rect.W, ((1 - V3.y) / 2) * rect.H];
      V3.set(L.x, L.y + tall, L.z).project(FC);
      const [hx, hy] = [((V3.x + 1) / 2) * rect.W, ((1 - V3.y) / 2) * rect.H];
      const ph = Math.abs(fy - hy);
      const half = Math.max(20, ph * 0.32);
      const dx = need(Math.min(fx, hx) - half, Math.max(fx, hx) + half, rect.left + 6, rect.right - 6);
      const dy = need(Math.min(fy, hy) - ph * 0.1, Math.max(fy, hy) + 12, rect.top + 6, rect.bottom - 6);
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) break;
      // (metres a pixel at the lead's own distance; a slide along the look's way moves the picture by its sine)
      const depth = Math.hypot(L.x - FC.position.x, L.y + tall / 2 - FC.position.y, L.z - FC.position.z);
      const wpp = (2 * depth * Math.tan((view.fov * Math.PI) / 360)) / rect.H;
      pan = [pan[0] - dx * wpp * rx + ((dy * wpp) / sinEl) * gx, pan[1] - dx * wpp * rz + ((dy * wpp) / sinEl) * gz];
      const pl = Math.hypot(pan[0], pan[1]);
      if (pl > span) pan = [(pan[0] / pl) * span, (pan[1] / pl) * span];
    }
    return pan;
  }
  // ── A FRAME HELD FOR AN ENTRANCE (opening.js: the city falls away round the room, so the room must be exactly where
  // the city's picture had the trailer). While held, every cut is to that frame and the view stays on it; let go, the
  // camera eases from it to its own frame (the panels' real gap, the zoom kept, the slide to the lead).
  let held = null;
  let pin = null;
  const mixPose = (a, b, k) => ({ pos: a.pos.map((q, i) => q + (b.pos[i] - q) * k), tgt: a.tgt.map((q, i) => q + (b.tgt[i] - q) * k), fov: b.fov });
  /** The frame to CUT to: the place's, from the zoom kept, slid to where the lead is now (no easing across a cut). */
  function cutFrame(place) {
    const v = frameOf(place);
    if (!v) return v;
    if (held && held.key === place.key && !held.from) {
      follow.key = place.key;
      follow.pan = [0, 0];
      follow.m = 1;
      follow.push = 0;
      follow.set = null;
      follow.free = false;
      return held.view;
    }
    follow.key = place.key;
    follow.m = mult();
    follow.pan = panFor(place, v, frames.get(place.key)?.rect, follow.m);
    follow.set = null;
    follow.free = false;
    stats.pan = follow.pan.map(q => +q.toFixed(2));
    stats.zoom = +follow.zoom.toFixed(3);
    return panned(v, follow.pan, follow.m);
  }
  /**
   * Every frame the inside view is up. A hand on the camera first: the wheel (nearer or further on the same line) is
   * the zoom, taken and kept; a drag (the target moved, or the look turned) and the camera is left alone until the
   * next cut. Then the push in runs out, and the slide eases to where the lead is.
   */
  function followLead(dt) {
    if (switching || !onInside || !up || follow.key !== up.key || follow.free) return;
    const had = frames.get(up.key);
    const ctl = city.controls;
    if (!had?.view || !ctl) return;
    const cp = cam.position;
    const ct = ctl.target;
    if (held && held.key === up.key && !held.from) {
      cp.set(...held.view.pos);
      ct.set(...held.view.tgt);
      return;
    }
    const S = follow.set;
    if (S && !held) {
      if (Math.hypot(ct.x - S[0], ct.y - S[1], ct.z - S[2]) > 0.06) return void (follow.free = true);
      const b = [had.view.pos[0] - had.view.tgt[0], had.view.pos[1] - had.view.tgt[1], had.view.pos[2] - had.view.tgt[2]];
      const o = [cp.x - ct.x, cp.y - ct.y, cp.z - ct.z];
      const [bl, ol] = [Math.hypot(...b) || 1, Math.hypot(...o) || 1];
      if ((b[0] * o[0] + b[1] * o[1] + b[2] * o[2]) / (bl * ol) < 0.99994) return void (follow.free = true);
      const cur = ol / bl;
      if (Math.abs(cur - follow.m) > follow.m * 0.002) {
        follow.zoom = Math.max(ZOOM.min, Math.min(ZOOM.max, cur / (1 + follow.push)));
        stats.zoom = +follow.zoom.toFixed(3);
        try {
          localStorage.setItem(ZOOM.key, String(stats.zoom));
        } catch { /* (no storage: kept for this load) */ }
      }
    }
    follow.push *= Math.exp(-Math.min(0.1, dt) * PUSH_RATE);
    if (follow.push < 0.002) follow.push = 0;
    follow.m = mult();
    const want = panFor(up.place, had.view, had.rect, follow.m);
    const k = 1 - Math.exp(-Math.min(0.1, dt) * FOLLOW);
    follow.pan = [follow.pan[0] + (want[0] - follow.pan[0]) * k, follow.pan[1] + (want[1] - follow.pan[1]) * k];
    let v = panned(had.view, follow.pan, follow.m);
    if (held?.from) {
      const u = Math.min(1, (performance.now() - held.from) / held.over);
      if (u >= 1) {
        held = null;
        remember(had.rect);
      }
      else v = mixPose(held.view, v, u * u * (3 - 2 * u));
    }
    cp.set(...v.pos);
    ct.set(...v.tgt);
    follow.set = v.tgt.slice();
    stats.pan = follow.pan.map(q => +q.toFixed(2));
  }

  /**
   * THE DOOR, OUTSIDE: a low shot from the open ground in front of it, under its porch roof or awning if it has one,
   * so the door, its step and whoever is at it are seen whole and nothing of the building need fade. Of the places in
   * front of it that stand clear and see the doorway, the stoop and the step (the city's collision world), the one
   * with nobody between it and the door, the lead's way not past it and the open leaf not across it; else a higher
   * one. Asked at every cut: people move.
   */
  function doorView(place) {
    const o = place.door?.()?.outside;
    if (!o) return null;
    const W = city.cam?.world;
    const g = o.stoop[1];
    const [fx, fz] = o.face;
    const at = (p, k, y) => [p[0] + fx * k, y, p[2] + fz * k];
    // what must be seen: the doorway (low and middle: its head may be under a porch roof's edge from a lens a little
    // up), the stoop and the step, each a little in front of it
    const sees = [at(o.sill, 0.3, o.sill[1] + 0.35), at(o.sill, 0.3, o.sill[1] + 1.2), [o.stoop[0], g + 1.0, o.stoop[2]], [o.step[0], g + 1.0, o.step[1]]];
    const tgt = [(o.sill[0] + o.step[0]) / 2, g + 1.05, (o.sill[2] + o.step[1]) / 2];
    const free = p => !W || W.topAt(p[0], p[2]) < p[1] - 0.5;
    const clearTo = (a, b) => {
      if (!W) return true;
      const [dx, dy, dz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const L = Math.hypot(dx, dy, dz) || 1;
      const e = [b[0] - (dx / L) * 0.3, b[1] - (dy / L) * 0.3, b[2] - (dz / L) * 0.3];
      return !W.ray({ x: a[0], y: a[1], z: a[2] }, { x: e[0], y: e[1], z: e[2] });
    };
    // (and NOBODY near the lens or on its line to the door: somebody two metres off it fills a third of the picture.
    // Nor on the lead's own way to the door, which they would walk through the lens on. Asked at every cut: people
    // move)
    const others = people(o.step[0], o.step[1], 16);
    const id = lead();
    const L = id && actors.has(id) ? actors.get(id) : null;
    const way = L && L.y < g + 2 ? [[L.x, L.z], o.step] : null;
    const offSeg = (p, a, b) => {
      const [ex, ez] = [b[0] - a[0], b[1] - a[1]];
      const l2 = ex * ex + ez * ez || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / l2));
      return Math.hypot(p[0] - a[0] - ex * t, p[1] - a[1] - ez * t);
    };
    // the open leaf's footprint, hinge to edge (the place's, when it says): the lens never looks through it
    const swing = o.swing ?? null;
    const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const segSeg = (a, b, c, d) => {
      if (Math.sign(cross(a, b, c)) !== Math.sign(cross(a, b, d)) && Math.sign(cross(c, d, a)) !== Math.sign(cross(c, d, b))) return 0;
      return Math.min(offSeg(a, c, d), offSeg(b, c, d), offSeg(c, a, b), offSeg(d, a, b));
    };
    const door2 = [o.sill[0] + fx * 0.3, o.sill[2] + fz * 0.3];
    // (each place the lens can stand is weighed: anybody between it and the door in the picture weighs most, the
    // nearer the more; then the lead's way passing by the lens, the open leaf in front of the doorway, and how far
    // it is from the plain shot straight on)
    const cost = (pos, a, d, hgt, fov) => {
      const [vx, vz] = [tgt[0] - pos[0], tgt[2] - pos[2]];
      const vl = Math.hypot(vx, vz) || 1;
      // (the picture's half width, as a slope: the page's aspect through the lens)
      const wide = (innerWidth / innerHeight) * Math.tan((fov * Math.PI) / 360);
      let c = Math.abs(a) * 6 + Math.abs(d - 7.5) * 1.2 + Math.abs(hgt - 2.6) * 1.5;
      for (const q of othersNow) {
        const [qx, qz] = [q[0] - pos[0], q[2] - pos[2]];
        const f = (qx * vx + qz * vz) / vl;
        const side = Math.abs((qx * vz - qz * vx) / vl);
        if (Math.hypot(qx, qz) < 1.4) c += 300;
        // (in the picture and nearer than the door: the nearer, the bigger; at its edges, less)
        else if (f > 0 && f < vl + 0.4 && side < 0.4 + f * wide) c += (side < 0.4 + f * wide * 0.6 ? 60 : 25) + (vl + 0.4 - f) * 14;
        if (offSeg([q[0], q[2]], [pos[0], pos[2]], door2) < 0.55) c += 60;
      }
      if (way) c += Math.max(0, 2.4 - offSeg([pos[0], pos[2]], way[0], way[1])) * 40;
      // (going in, the cut is TO the lead: they are in the picture as it cuts, well in front of the lens, never coming
      // on from behind it with their head filling a corner. Seen played by hand, 2026-11-13: two seconds of an empty
      // door, then a hat a quarter of the picture wide walking past)
      if (way) {
        const [qx, qz] = [L.x - pos[0], L.z - pos[2]];
        const f = (qx * vx + qz * vz) / vl;
        const side = Math.abs((qx * vz - qz * vx) / vl);
        if (f < 3 || side > f * wide * 0.75) c += 110;
        // (and nobody stands between the lens and them: a neighbour two metres off the lens hid them whole)
        for (const q of others) if (offSeg([q[0], q[2]], [pos[0], pos[2]], [L.x, L.z]) < 1.1) c += 250;
      }
      if (swing && segSeg([pos[0], pos[2]], door2, swing[0], swing[1]) < 0.3) c += 120;
      return c;
    };
    // THE PEOPLE OF A SCENE AT THE DOOR, WHOLE (the run's visitor at the trailer door: demo/run/index.js keep, the one
    // camera change the owner allowed, 2026-11-16). While the page names who the scene is about, the same low shot is
    // aimed at the middle of them and stands back as far as it must for every one of them, feet to head, to be inside
    // the stage's free part of the picture (gap: under the top line, beside the dock, over the bar), and none of them
    // nearer the lens than 6.5 m (filling the foreground). They are not the people it keeps out of the picture; anybody
    // else still is. Otherwise the shot is as it was. Those asked for only if the frame allows (keep's `also`: Cousin
    // Earl) count a little: the shot is aimed at the others and is never kept from them for him
    // (where each stands for it: the lead, coming out of the door, at the foot of the step he comes out to)
    const held = [...(kept ?? []).map(k => [k, false]), ...(keptAlso ?? []).map(k => [k, true])].filter(([k]) => actors.has(k)).map(([k, opt]) => [k, opt, actors.get(k)])
      .filter(([, , A]) => !A.w?.hide && A.y < g + 2 && Math.hypot(A.x - o.step[0], A.z - o.step[1]) < 12)
      .map(([k, opt, A]) => (k === id && Math.hypot(A.x - o.sill[0], A.z - o.sill[2]) < 2.5 ? { id: k, opt, x: o.step[0], z: o.step[1] } : { id: k, opt, x: A.x, z: A.z }));
    const whole = held.filter(A => !A.opt).length >= 2 ? held : null;
    if (whole) {
      const must = whole.filter(A => !A.opt);
      const mx = must.reduce((n, A) => n + A.x, 0) / must.length;
      const mz = must.reduce((n, A) => n + A.z, 0) / must.length;
      tgt.splice(0, 3, mx, g + 0.95, mz);
    }
    const heldIds = new Set(whole?.map(A => A.id) ?? []);
    const othersNow = whole ? others.filter(q => !whole.some(A => actors.has(A.id) && Math.hypot(actors.get(A.id).x - q[0], actors.get(A.id).z - q[2]) < 0.05)) : others;
    /** How a lens at `pos` with `fov` holds the scene's people: 0 whole and clear of the foreground, more the worse. */
    const holds = (pos, fov) => {
      if (!whole) return 0;
      const f = [tgt[0] - pos[0], tgt[1] - pos[1], tgt[2] - pos[2]];
      const fl = Math.hypot(...f) || 1;
      f[0] /= fl; f[1] /= fl; f[2] /= fl;
      const rl = Math.hypot(f[2], f[0]) || 1;
      const r = [-f[2] / rl, 0, f[0] / rl];
      const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
      const Wd = innerWidth;
      const Ht = innerHeight;
      const G = gap() ?? { left: 0, top: 0, right: Wd, bottom: Ht };
      // (the free part, as the picture's -1…1, less a margin: a name over a head, a hand out)
      const box = { l: (2 * (G.left + 18)) / Wd - 1, r: (2 * (G.right - 18)) / Wd - 1, t: 1 - (2 * (G.top + 30)) / Ht, b: 1 - (2 * (G.bottom - 14)) / Ht };
      const ty = Math.tan((fov * Math.PI) / 360);
      const tx = ty * (Wd / Ht);
      let c = 0;
      const seen = [];
      for (const A of whole) {
        // (each one's misses, counted whole for those the scene is about, a little for one asked for if it allows)
        let p = 0;
        const near = Math.hypot(A.x - pos[0], A.z - pos[2]);
        if (near < 6.5) p += 200 + (6.5 - near) * 60;
        const ys = [];
        for (const [dx, dy, dz] of [[0, 0, 0], [0, 2.3, 0], [0.5, 1.6, 0], [-0.5, 1.6, 0], [0, 1.6, 0.5], [0, 1.6, -0.5]]) {
          const v = [A.x + dx - pos[0], g + dy - pos[1], A.z + dz - pos[2]];
          const z = v[0] * f[0] + v[1] * f[1] + v[2] * f[2];
          if (z < 0.5) {
            p += 400;
            continue;
          }
          const x = (v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) / (z * tx);
          const y = (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / (z * ty);
          ys.push(y);
          p += 90 * (Math.max(0, box.l - x) + Math.max(0, x - box.r) + Math.max(0, box.b - y) + Math.max(0, y - box.t)) + (x < box.l || x > box.r || y < box.b || y > box.t ? 120 : 0);
        }
        // (and not behind anything of the city's: a stall, a sign, a mailbox between the lens and their head or body)
        if (!clearTo(pos, [A.x, g + 1.7, A.z])) p += 160;
        if (!clearTo(pos, [A.x, g + 1.2, A.z])) p += 120;
        if (!clearTo(pos, [A.x, g + 0.6, A.z])) p += 60;
        // (none of them a giant: feet to head at most a third of the picture's height)
        if (ys.length > 1) p += Math.max(0, ys[1] - ys[0] - 0.66) * 400;
        c += A.opt ? p * 0.15 : p;
        // (where they stand across the picture, and how wide, head and a step either way: for one in front of another)
        const v = [A.x - pos[0], g + 1.2 - pos[1], A.z - pos[2]];
        const z = v[0] * f[0] + v[1] * f[1] + v[2] * f[2];
        if (z > 0.5 && ys.length > 1) seen.push({ x: (v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) / (z * tx), w: 0.6 / (z * tx), lo: ys[0], hi: ys[1], opt: A.opt });
      }
      // (and nobody of them in front of another in the picture: how much of the smaller one's box the other covers)
      for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++) {
        const [P, Q] = [seen[i], seen[j]];
        const ox = Math.max(0, Math.min(P.x + P.w, Q.x + Q.w) - Math.max(P.x - P.w, Q.x - Q.w));
        const oy = Math.max(0, Math.min(P.hi, Q.hi) - Math.max(P.lo, Q.lo));
        const share = (ox * oy) / Math.min(2 * P.w * (P.hi - P.lo), 2 * Q.w * (Q.hi - Q.lo));
        if (share > 0.1) c += (100 + share * 400) * (P.opt || Q.opt ? 0.3 : 1);
      }
      return c;
    };
    let view = null;
    let best = Infinity;
    let tried = 0;
    let held1 = 0;
    for (const hgt of whole ? [2.6, 3.2, 3.8, 4.5, 5.5, 6.5, 8] : [2.6, 2.1, 3.2, 1.75, 3.8]) {
      for (const d of whole ? [8.8, 10, 11.5, 13, 7.5] : [7.5, 6.4, 8.8, 5.4, 10]) {
        for (const a of [0, 0.2, -0.2, 0.4, -0.4, 0.6, -0.6, 0.8, -0.8]) {
          const [ux, uz] = [fx * Math.cos(a) + fz * Math.sin(a), -fx * Math.sin(a) + fz * Math.cos(a)];
          const pos = [o.sill[0] + ux * d, g + hgt, o.sill[2] + uz * d];
          if (!free(pos) || !free([pos[0] + ux * 0.6, pos[1], pos[2] + uz * 0.6])) continue;
          if (!sees.every(p => clearTo(pos, p))) continue;
          tried += 1;
          // (a lens further off sees as much through a longer lens; holding the scene's people, the first of a few that
          // holds them whole)
          const fov0 = Math.max(30, Math.min(44, 44 * (6.4 / d)));
          const fovs = whole ? [fov0, fov0 + 5, fov0 + 10, 50].filter(x => x <= 50) : [fov0];
          for (const fov of fovs) {
            const h = holds(pos, fov);
            // (holding them, a raised lens: at eye height heads line up one behind another)
            const c = cost(pos, a, d, hgt, fov) + h + (whole ? (fov - fov0) * 1.5 + Math.max(0, 3.8 - hgt) * 25 : 0);
            if (c < best) [best, view, held1] = [c, { pos, tgt: tgt.slice(), fov }, h];
            if (!h) break;
          }
        }
      }
    }
    // (nowhere low stands clear: from higher up, in front of it)
    view ??= { pos: [o.sill[0] + fx * 8, g + 6, o.sill[2] + fz * 8], tgt, fov: 44 };
    stats.doorShot = { key: place.key, pos: view.pos.map(v => +v.toFixed(2)), cost: +best.toFixed(1), tried, people: others.length, held: [...heldIds], holds: +held1.toFixed(1), fov: +view.fov.toFixed(1) };
    return view;
  }
  /** Who is at a place's door (doorway.js), or on the way to their own and near it. */
  function doorOf(id) {
    const d = doors.get(id);
    if (d) {
      const place = places.get(d.key);
      const o = place?.door?.()?.outside;
      if (!o || !actors.has(id)) return null;
      if (d.phase === 'in') return d;
      // (out of it: until they are a few steps off, or stand)
      const A = actors.get(id);
      const P = who(id);
      const off = Math.hypot(A.x - o.step[0], A.z - o.step[1]);
      if (d.phase === 'out' && (off > NEAR_OUT || (!P?.going && !d.walking) || P?.transit)) {
        doors.delete(id);
        return null;
      }
      return d;
    }
    // (on the way to their own place's door, and nearly there: whoever's door is walked)
    const P = who(id);
    if (!walks(id) || !P?.going || P.inside || P.transit || !places.has(P.spot) || !actors.has(id)) return null;
    const o = places.get(P.spot).door?.()?.outside;
    const A = actors.get(id);
    if (!o || A.y > o.stoop[1] + 2) return null;
    return Math.hypot(A.x - o.step[0], A.z - o.step[1]) < NEAR_IN ? { key: P.spot, phase: 'in' } : null;
  }

  return {
    LAYER,
    register(place) {
      places.set(place.key, place);
      return place;
    },
    has: key => places.has(key),
    place: key => places.get(key) ?? null,
    get up() {
      return up?.key ?? null;
    },
    /** Resolves once the view matches where the lead stands (after a frame, for a body just put somewhere). */
    async ready() {
      await frame();
      for (let k = 0; k < 600 && (switching || wanted() !== (up?.key ?? null)); k++) {
        if (switching) await switching;
        else await frame();
      }
    },
    /** For camera.js wantFor(): what the camera should be on for this person, if it is ours to say. */
    shot(id) {
      if (up && lead() === id) return { kind: 'inside', key: up.key, view: () => cutFrame(up.place) };
      if (lead() !== id) return null;
      const d = doorOf(id);
      if (!d) return null;
      // (holding a scene's people: when no low lens there holds them whole, none, and the camera keeps the Lock on the
      // player, which does. Asked of a view made at most a second before: the cut takes that one)
      if (kept) {
        const now = performance.now();
        if (!keptView || keptView.key !== d.key || now - keptView.at > 1000) keptView = { key: d.key, at: now, view: doorView(places.get(d.key)), holds: stats.doorShot?.holds ?? 0 };
        if (keptView.holds > HOLDS_AT_MOST) return null;
        const v = keptView.view;
        return { kind: 'door', key: d.key, view: () => v };
      }
      return { kind: 'door', key: d.key, view: () => doorView(places.get(d.key)) };
    },
    /**
     * The people the door's low shot must hold whole while a scene at the door plays (ids; null: nobody), as the run
     * asks for the one who comes for the crib and the player, and `also` those to hold only if the frame allows (Cousin
     * Earl): doorView. Asked again at every cut; when no low lens holds the first ones, the camera keeps the Lock.
     */
    keep(ids, also = null) {
      kept = ids?.length ? ids.slice() : null;
      keptAlso = kept && also?.length ? also.slice() : null;
      keptView = null;
    },
    /**
     * camera.js (touch-1): a finger is dragging the picture. The camera is left alone until the next cut, as when
     * followLead sees a drag itself (a finger's drag on a phone never shows it the 6 cm a frame it looks for).
     */
    hand() {
      if (onInside && up && follow.key === up.key && !(held && held.key === up.key && !held.from)) follow.free = true;
    },
    /** camera.js, at every cut: the inside view draws its layer alone; any other shot, the city. */
    cut(key) {
      if (mask0 === null) mask0 = cam.layers.mask;
      const on = String(key).startsWith('inside:') && !!up;
      if (on === onInside) return;
      onInside = on;
      if (on) {
        cam.layers.set(LAYER);
        // (the people and the light: the city's walkers' batches and every light, on the inside layer too)
        const A = city.peds?.anim;
        for (const m of [A?.batch, A?.mid, A?.far, A?.dog]) m?.layers?.enable(LAYER);
        city.scene.traverse(o => o.isLight && o.layers.enable(LAYER));
      } else cam.layers.mask = mask0;
      city.renderer.shadowMap.needsUpdate = true;
    },
    /** doorway.js: `id` is at `key`'s door, going in ('in') or just out ('out'); null: no longer. */
    door(id, key, phase, { walking = false } = {}) {
      if (!phase) doors.delete(id);
      else doors.set(id, { key, phase, walking });
    },
    onSwitch(fn) {
      hooks.switched = fn;
    },
    /** set/light.js: the lamp inside by night (or null). */
    onLamp(fn) {
      lampHook = fn;
    },
    fitFrame,
    /**
     * opening.js: the frame the place's inside will be CUT to and held on (the whole room, in the gap the panels will
     * leave, counted though they are not showing yet), or null while the place cannot say its bounds.
     */
    hold(key) {
      const place = places.get(key);
      const b = place?.bounds?.();
      // (the gap as the panels left it the last time this window was played in, else as they are laid out now; and
      // with it the slide of the picture into that gap, stage/index.js fitToPanels, which the stage keeps while the
      // opening plays: the city's last picture and the room must be drawn with the same slide, or the room is not
      // where the trailer was)
      const mem = recall();
      const rect = mem ?? freeRect(true);
      pin = typeof mem?.off === 'string' ? mem.off.split(',').map(Number) : null;
      if (pin && pin.every(Number.isFinite)) {
        if (pin[0] || pin[1]) cam.setViewOffset(innerWidth, innerHeight, pin[0], pin[1], innerWidth, innerHeight);
        else if (cam.view?.enabled) cam.clearViewOffset();
      } else pin = null;
      const view = b ? place.frame?.(rect) ?? fitFrame(b, rect, place.door?.()?.inside?.sill ?? null) : null;
      held = view ? { key, view } : null;
      return view;
    },
    /**
     * opening.js: the inside that is up stacks itself up from its floor. rise({ on: true, t }) with t the clock (s; 0:
     * nothing but the floor); rise({ on: false }): whole, as ever. riseSpan(): seconds until it is whole.
     */
    rise({ on = true, t = 0 } = {}) {
      if (on) {
        riseScan();
        const b = up?.place?.bounds?.();
        // (from a little under the floor: at 0 nothing of it is drawn, the floor comes with the second step)
        RISE.value.set(1, (b?.y ?? 0) - 0.3, t, 0.3);
      } else RISE.value.x = 0;
    },
    riseSpan: () => 0.3 + Math.ceil(3.1 / 0.25) / 16,
    /** Whether the page asked for the lot's own ground (?ground=real). */
    realWanted: REAL_GROUND,
    /** Whether the lot's own ground is being drawn under the inside (else the made-up one). */
    get realGround() {
      return real.on;
    },
    /** stage/index.js fitToPanels: the slide of the picture ([dx, dy] px) kept while a frame is held for the opening, or null. */
    pinned: () => (held ? pin : null),
    /** The held frame is let go: the camera eases from it to its own frame over `seconds` (0: at once). */
    letGo(seconds = 0.7) {
      if (!held) return;
      if (!(seconds > 0)) held = null;
      else if (!held.from) Object.assign(held, { from: performance.now(), over: seconds * 1000 });
    },
    holds: (key, x, y, z) => (places.has(key) ? holds(places.get(key), x, y, z) : false),
    /** For the tools: the inside view's floor on screen now, px (its corners' box), or null. */
    floorPx() {
      const b = up?.place.bounds();
      if (!b) return null;
      cam.updateMatrixWorld();
      const P = b.corners.map(([x, z]) => {
        V3.set(x, b.y, z).project(cam);
        return [((V3.x + 1) / 2) * innerWidth, ((1 - V3.y) / 2) * innerHeight];
      });
      const xs = P.map(p => p[0]);
      const ys = P.map(p => p[1]);
      return { corners: P.map(p => p.map(Math.round)), x: [Math.round(Math.min(...xs)), Math.round(Math.max(...xs))], y: [Math.round(Math.min(...ys)), Math.round(Math.max(...ys))], span: Math.round(Math.max(...xs) - Math.min(...xs)), share: +((Math.max(...xs) - Math.min(...xs)) / innerWidth).toFixed(3) };
    },
    debug() {
      const id = lead();
      return {
        up: up?.key ?? null, onInside, switching: !!switching, places: [...places.keys()], doors: [...doors].map(([k, d]) => ({ id: k, ...d })),
        shot: id ? (s => s && { kind: s.kind, key: s.key })(this.shot(id)) : null, mask: cam.layers.mask,
        ...stats, examples: stats.examples.slice(), rect: freeRect(),
      };
    },
  };
}
