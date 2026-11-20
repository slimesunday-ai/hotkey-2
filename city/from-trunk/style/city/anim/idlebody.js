// ANIM LAB · K3-IDLES (2026-11-19) · THE CITY'S OWN BODY, STANDING. The looks the crowd wears (cast.js rollLook from pedbake.js's seeds:
// the NPC pool, 0x5eed + k · 7919; or the agents' pool, THE RUN's people), baked by the city's own bake (anim/cast/bake.js bakeSegFull with
// the cast's elbow, as pedbake.js) and posed by the city's own vertex shader (anim/cast/walk2.js: the walk, the idles, the grips, the clips
// and the elbow, compiled as peds.js compiles it). ?ver=base loads every module from idlecheck.mjs serve's /@base/ (the code before).
//   __ib.sheet(o)  a contact sheet: rows of (idle, seed), columns of moments, each from the game's camera (24 m up, 64° down, 42° lens:
//                  the person at 1:1 of a 1600 × 1000 picture, scaled up, nearest pixel) and from close views
//   __ib.check(o)  THE ELBOW-AWARE CHECK. The lab's parts-meeting check (overlap-check.mjs) draws the lab's walk, which has no elbow; this
//                  runs the city's shader itself (WebGL2 transform feedback of anim2Glsl({ elbow }), no CPU copy of the pose, as the cast's
//                  own gate elbow/check.mjs does in ai-city-fresh) on each look, through every state asked for, and counts:
//                    torso · head · legs   the forearm's and hand's triangles (rest y < 0.65 m: what the elbow moves) passing through the
//                                          chest and pelvis inside the shoulders' width, the head, the thighs and shins (1.5 mm margin)
//                    arm                   one arm's triangles through the other's (arms crossed, rubbing the arms: they must stack)
//                    core                  forearm and hand vertices more than 3 mm deep inside the bare torso box or the head box
//                    folds                 arm triangles turned inside out (the posed triangle against the shader's own normal)
//                    crack                 the widest gap between arm vertices that share a rest point (the sleeve must stay closed)
//                  The arm's own crossings and coplanar faces depend on the bend alone (the bend is applied in the arm's rest frame, then
//                  the shoulder turns the arm whole): the cast's gate checked the bend 0–150° on every top, accessory and held thing.
const Q = new URLSearchParams(location.search), PFX = Q.get('ver') === 'base' ? '/@base' : '';
const THREE = await import('three');
const [CH, BK, W2, EL, GA] = await Promise.all(['cast.js', 'anim/cast/bake.js', 'anim/cast/walk2.js', 'anim/cast/elbow/styles.js', 'anim/cast/gait2.js'].map(p => import(`${PFX}/style/city/${p}`)));
const HELD = await import(`${PFX}/world/cast/fit/held.js`);   // (a hold's hands: the gripping arm is the hold's, grip.js)
const LOCK = { high: 24, down: 64, lens: 42, anchor: .82 * 1.75, W: 1600, H: 1000 };
// a look: pedbake.js's k-th roll from the pool ('npc' the crowd, 'agent' THE RUN's people), or pool 'trait': one trait on the mannequin, as
// the cast's own gate does (elbow/check.mjs --gate: 'top:<id>', 'held:<id>', 'acc:<id>', 'hair:<id>'…)
const lookOf = (k, pool = 'npc', seed = 0x5eed) => { if (pool !== 'trait') return CH.rollLook((seed + k * 7919) & 0xffffff, { pool });
  const L = CH.mannequin(); for (const kv of String(k).split(',')) { const [sl, id] = kv.split(':'); L[sl] = { id }; } return L; };
// every trait the crowd can wear on the slots that meet a posed arm (tops, held things; THE RUN's: tops, accessories, held things, hair, hats)
const traitKeys = which => { const C = which === 'npc' ? CH.NPC_CAST : CH.CAST, slots = which === 'npc' ? ['top', 'held'] : ['top', 'acc', 'held', 'hair', 'hat'];
  return slots.flatMap(sl => (C[sl] || []).map(t => `${sl}:${t.id}`)); };
const fulls = new Map(); function fullOf(k, pool) { const key = pool + ':' + k; if (!fulls.has(key)) fulls.set(key, BK.bakeSegFull(THREE, CH, lookOf(k, pool), { elbow: EL.ELBOW })); return fulls.get(key); }
const geoOf = t => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(t.P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(t.N, 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(t.C, 4, true)); g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(t.K), 1)); g.setIndex(new THREE.BufferAttribute(t.I, 1)); return g; };
// a standing person's gait state in one idle (the shader reads it from the animation texture: walk2.js writeGait2)
const stand = (v, seed, t, look = 0) => Object.assign(GA.gait2State({}), { idle: v, iw: 1, w: 0, v: 0, it: t, iseed: seed, look: v === 8 && !look ? -.9 : look, omega: 0, hp: 0, hr: 0, still: 9, wasStill: true });

// ── drawing: one BatchedMesh (a geometry per look asked for), up to CAP people, the city's material set-up (vertex colours, the cast's walk)
const CAP = 8, renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(LOCK.lens, LOCK.W / LOCK.H, .1, 400); scene.background = new THREE.Color(0x8d969f);
scene.add(new THREE.HemisphereLight(0xe4ecff, 0x5a544c, 1.1)); const sun = new THREE.DirectionalLight(0xfff2dc, 1.7); sun.position.set(-10.4, 14.8, 8.4); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x7d7d78, roughness: .9 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
const tex = W2.createAnimTexture2(CAP), [uni] = W2.animUniforms2(tex, W2.WALK2, { turnLean: .09 }), mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: 0 });
W2.installAnim2(mat, uni, { elbow: EL.ELBOW });
let batch = null; const geoIds = new Map(), M4 = new THREE.Matrix4(), Qy = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
function people(list) {   // list: [{ k, pool, x, z, yaw, g }]
  const need = [...new Set(list.map(p => (p.pool || 'npc') + ':' + p.k))].filter(key => !geoIds.has(key));
  if (need.length || !batch) { const all = [...geoIds.keys(), ...need], geos = all.map(key => { const [pool, k] = key.split(':'); return geoOf(fullOf(+k, pool)); });
    if (batch) { scene.remove(batch); batch.dispose(); } geoIds.clear();
    batch = new THREE.BatchedMesh(CAP, geos.reduce((n, g) => n + g.attributes.position.count, 0), geos.reduce((n, g) => n + g.index.count, 0), mat); batch.sortObjects = false; batch.perObjectFrustumCulled = false; batch.frustumCulled = false;
    all.forEach((key, i) => geoIds.set(key, batch.addGeometry(geos[i]))); for (let k = 0; k < CAP; k++) { batch.addInstance(geoIds.get(all[0])); batch.setVisibleAt(k, false); } scene.add(batch); }
  for (let k = 0; k < CAP; k++) { const p = list[k]; if (!p) { batch.setVisibleAt(k, false); continue; }
    batch.setGeometryIdAt(k, geoIds.get((p.pool || 'npc') + ':' + p.k)); Qy.setFromAxisAngle(Y, p.yaw || 0); V.set(p.x || 0, 0, p.z || 0); M4.compose(V, Qy, S1); batch.setMatrixAt(k, M4); batch.setVisibleAt(k, true);
    W2.writeGait2(tex.image.data, CAP, k, p.g); }
  tex.needsUpdate = true; }
// the views: 'game' (hotkey 2's camera on this person: a cw × ch cut of the 1600 × 1000 picture at 1:1, the camera at az round the
// person), 'close' (7.5 m, 22° down), 'front' / 'side' / 'back' (4.5 m, 6° down, round the person's own facing), 'top' (straight down)
function aim(view, p, cw, ch, az = 0) {
  camera.clearViewOffset(); camera.fov = LOCK.lens;
  const yawOf = { front: 0, side: Math.PI / 2, back: Math.PI, left: -Math.PI / 2, tq: Math.PI / 4 }, aroundBody = view in yawOf;
  const a = aroundBody ? (p.yaw || 0) + yawOf[view] : az, el = (view === 'game' ? LOCK.down : view === 'close' ? 22 : view === 'top' ? 89 : 6) * Math.PI / 180;
  const ty = view === 'game' ? LOCK.anchor : .85, d = view === 'game' ? LOCK.high / Math.sin(el) : view === 'close' ? 7.5 : view === 'top' ? 6 : 3;
  const tx = p.x || 0, tz = p.z || 0, dir = aroundBody ? [Math.sin(a), Math.cos(a)] : [Math.cos(a), Math.sin(a)];
  camera.position.set(tx + dir[0] * Math.cos(el) * d, ty + Math.sin(el) * d, tz + dir[1] * Math.cos(el) * d); camera.up.set(0, 1, 0); if (view === 'top') camera.up.set(-dir[0], 0, -dir[1]);
  camera.aspect = view === 'game' ? LOCK.W / LOCK.H : cw / ch; camera.updateProjectionMatrix(); camera.lookAt(tx, ty, tz); camera.updateMatrixWorld();
  if (view === 'game') { const c = new THREE.Vector3(tx, .85, tz).project(camera), cx = (c.x + 1) / 2 * LOCK.W, cy = (1 - c.y) / 2 * LOCK.H;
    camera.setViewOffset(LOCK.W, LOCK.H, Math.round(cx - cw / 2), Math.round(cy - ch / 2), cw, ch); camera.updateProjectionMatrix(); } }
function draw(cw, ch) { if (renderer.domElement.width !== cw || renderer.domElement.height !== ch) renderer.setSize(cw, ch, false); renderer.render(scene, camera); return renderer.domElement; }
// the person in flat part ids (head · −x arm · +x arm · body · legs: idlecheck.mjs alike's colours) and lit, alone (no ground, no sky), into
// a buffer: idlecheck.mjs alike --body city measures how alike two motions look on the city's own body
const partMat = new THREE.MeshBasicMaterial();
partMat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vK3P;').replace('#include <begin_vertex>', '#include <begin_vertex>\n  vK3P = aPart;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vK3P;').replace(/}\s*$/, ' float p = floor(vK3P + .5); float c = p == 5. ? 1. : p == 3. ? 2. : p == 4. ? 3. : (p == 0. || p == 12.) ? 4. : 5.; gl_FragColor = vec4(c / 8., 0., 0., 1.);\n}'); };
partMat.customProgramCacheKey = () => 'k3part'; W2.installAnim2(partMat, uni, { elbow: EL.ELBOW });
let rtG = null;
function grab(part, buf, cw, ch) { if (!rtG || rtG.width !== cw || rtG.height !== ch) { rtG?.dispose(); rtG = new THREE.WebGLRenderTarget(cw, ch); }
  const bg = scene.background; scene.background = null; ground.visible = false; batch.material = part ? partMat : mat;
  renderer.setRenderTarget(rtG); renderer.setClearColor(0, 0); renderer.clear(); renderer.render(scene, camera); renderer.readRenderTargetPixels(rtG, 0, 0, cw, ch, buf); renderer.setRenderTarget(null);
  batch.material = mat; scene.background = bg; ground.visible = true; }
// a contact sheet. o: { pool, rows: [{ v, seed, look, k, label, two }], times, views (['game', 'close']), yaw, az, gs (the game view's
// upscale), cell ([w, h] of a close cell) } → a jpeg data URL. two: a second person facing the first, 0.9 m away (a pair talking:
// two = { v, seed, look })
function sheet(o) {
  const views = o.views || ['game', 'close'], times = o.times || [0, 2, 4, 6, 8, 10], gs = o.gs || 3, [cw, ch] = o.cell || [240, 300], gw = 100, gh = 110;
  const vw = views.map(v => v === 'game' ? gw * gs : cw), colW = vw.reduce((a, b) => a + b, 0) + 6, rowH = Math.max(ch, gh * gs) + 4, lab = 150;
  const cv = document.createElement('canvas'); cv.width = lab + times.length * colW; cv.height = 22 + o.rows.length * rowH; const g = cv.getContext('2d');
  g.fillStyle = '#16161a'; g.fillRect(0, 0, cv.width, cv.height); g.font = '12px sans-serif'; g.fillStyle = '#ddd';
  times.forEach((t, j) => g.fillText(`t ${t} s`, lab + j * colW + 4, 15));
  o.rows.forEach((r, i) => { const y0 = 22 + i * rowH; g.fillStyle = '#ffd25a'; g.font = '600 13px sans-serif'; g.fillText(r.label ?? `${r.v}`, 6, y0 + 16); g.fillStyle = '#bbb'; g.font = '11px sans-serif'; if (r.note) r.note.split('\n').forEach((l, q) => g.fillText(l, 6, y0 + 32 + q * 13));
    times.forEach((t, j) => { const P = { k: r.k ?? o.k ?? 0, pool: r.pool || o.pool || 'npc', x: 0, z: 0, yaw: r.yaw ?? o.yaw ?? .79, g: stand(r.v, r.seed ?? -1, t, r.look || 0) }, list = [P];
      if (r.two) list.push({ k: r.two.k ?? (P.k + 1), pool: P.pool, x: Math.sin(P.yaw) * .9, z: Math.cos(P.yaw) * .9, yaw: P.yaw + Math.PI, g: stand(r.two.v, r.two.seed ?? -1, t, r.two.look || 0) });
      people(list); let x = lab + j * colW;
      views.forEach((v, q) => { const two = list.length > 1, c = two ? { ...P, x: list[1].x / 2, z: list[1].z / 2 } : P;
        if (v === 'game') { aim('game', c, gw, gh, o.az || 0); const src = draw(gw, gh); g.imageSmoothingEnabled = false; g.drawImage(src, x, y0, gw * gs, gh * gs); }
        else { aim(v, c, cw, ch, o.az || 0); g.drawImage(draw(cw, ch), x, y0); }
        x += vw[q]; }); }); });
  return cv.toDataURL('image/jpeg', .88); }

// ── THE CHECK (transform feedback of the city's shader). FIT: the same shader with a pose hook (walk2.js's ELBOW_LAB elbowLab, which runs
// after the idles, the grips and the clips): texture rows 3–5 set both arms outright (the +x arm's four angles, the −x arm's, then the
// two elbows and an on flag), so an arm pose can be searched on the real body before it is written into anim/idle.js
const ROWS = W2.ROWS2 + 3, FIT_GLSL = /* glsl */`
void elbowLab(inout Pose P, int id) { vec4 A = texelFetch(uAnim, ivec2(id, 3), 0), B = texelFetch(uAnim, ivec2(id, 4), 0), E = texelFetch(uAnim, ivec2(id, 5), 0);
  if (E.w < .5) return; P.armP = vec2(B.x, A.x); P.armR = vec2(B.y, A.y); P.ayaw = vec2(B.z, A.z); P.atw = vec2(B.w, A.w); P.elb = vec2(E.y, E.x); }`;
let TF = null;
function tfProgram() {
  if (TF) return TF; const gl = document.createElement('canvas').getContext('webgl2'); if (!gl) throw new Error('WebGL2 unavailable');
  const sh = (type, s) => { const x = gl.createShader(type); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const make = lab => { const src = `#version 300 es\nprecision highp float; precision highp int; in vec3 position; in vec3 normal; out vec3 resultPosition; out vec3 resultNormal;\n${W2.anim2Glsl({ elbow: EL.ELBOW, ...(lab ? { lab } : {}) }).replace(/attribute /g, 'in ')}\nvoid main(){ animCompute(); resultPosition = gR * position + gT; resultNormal = gR * normal; gl_Position = vec4(0.); }`;
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, src)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float; out vec4 c; void main(){ c = vec4(0.); }'));
    gl.transformFeedbackVaryings(prog, ['resultPosition', 'resultNormal'], gl.SEPARATE_ATTRIBS); gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog)); gl.useProgram(prog);
    gl.uniform1i(gl.getUniformLocation(prog, 'uAnim'), 0); gl.uniform4fv(gl.getUniformLocation(prog, 'uKeys2[0]'), new Float32Array(uni.uKeys2.value.flatMap(v => [v.x, v.y, v.z, v.w])));
    for (const n of ['uB0', 'uB1', 'uB2']) { const v = uni[n].value; gl.uniform4fv(gl.getUniformLocation(prog, n), [v.x, v.y, v.z, v.w]); } return prog; };
  const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, ROWS, 0, gl.RGBA, gl.FLOAT, null);
  const city = make(null), fit = make(FIT_GLSL); return TF = { gl, city, fit }; }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], len = a => Math.hypot(a[0], a[1], a[2]);
const pierce = (p, q, a, b, c, clearance) => { const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h); if (Math.abs(det) < 1e-12) return false;
  const s = sub(p, a), u = dot(s, h) / det; if (u <= 1e-5 || u >= 1 - 1e-5) return false; const r = cross(s, e1), v = dot(d, r) / det; if (v <= 1e-5 || u + v >= 1 - 1e-5) return false; const t = dot(e2, r) / det, m = clearance / len(d); return t > m && t < 1 - m; };
const crosses = (A, B, m) => [0, 1, 2].some(k => pierce(A[k], A[(k + 1) % 3], B[0], B[1], B[2], m) || pierce(B[k], B[(k + 1) % 3], A[0], A[1], A[2], m));
// one look's buffers, triangles and crack groups on the transform-feedback context
function body(k, pool) {
  const { gl, city, fit } = tfProgram(), full = fullOf(k, pool || 'npc'), n = full.P.length / 3, partOf = i => Math.floor(full.K[i] + .5);
  // (the probes carry the look's hold code, as every vertex of the body does: the shader poses a holder's body by it, aGrip)
  const g0 = Math.round((full.K[0] - partOf(0)) * 64 - .3), probe = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]], extra = []; for (const part of [0, 5]) for (const p of probe) extra.push([...p, part + g0 / 64]);
  const N = n + extra.length, pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), prt = new Float32Array(N);
  pos.set(full.P); for (let i = 0; i < n * 3; i++) nor[i] = full.N[i] / 127; prt.set(full.K); extra.forEach((e, q) => { pos.set(e.slice(0, 3), (n + q) * 3); nor.set([0, 1, 0], (n + q) * 3); prt[n + q] = e[3]; });
  const vaos = {}, bufs = [];
  for (const [nm, prog] of [['city', city], ['fit', fit]]) { const vao = gl.createVertexArray(); gl.bindVertexArray(vao); vaos[nm] = vao;
    for (const [name, data, size] of [['position', pos, 3], ['normal', nor, 3], ['aPart', prt, 1]]) { const b = gl.createBuffer(); bufs.push(b); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); const loc = gl.getAttribLocation(prog, name); if (loc < 0) continue; gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); } }
  const outP = gl.createBuffer(), outN = gl.createBuffer(), TP = new Float32Array(N * 3), TN = new Float32Array(N * 3); bufs.push(outP, outN);
  for (const [b, i] of [[outP, 0], [outN, 1]]) { gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, b); gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, N * 12, gl.DYNAMIC_READ); }
  const arm = [[], []], torso = [], head = [], legs = [], I = full.I;
  for (let t = 0; t < I.length; t += 3) { const p = partOf(I[t]), tri = [I[t], I[t + 1], I[t + 2]];
    if (p === 3 || p === 4) arm[p - 3].push(tri); else if (p === 5) head.push(tri); else if (p === 1 || p === 2 || p === 6 || p === 7) legs.push(tri);
    else if ((p === 0 || p === 12) && Math.abs((full.P[tri[0] * 3] + full.P[tri[1] * 3] + full.P[tri[2] * 3]) / 3) < .25) torso.push(tri); }
  // (a holder: the gripping arm is posed by its hold (grip.js gripPose, after the idle: the idle never moves it), so it is counted as an
  // obstacle the other arm must not pass through, never for itself: what the hold does is the hold's, the same in every idle)
  const gripOf = p => { for (let i = 0; i < n; i++) if (partOf(i) === p) return Math.round((full.K[i] - p) * 64 - .3); return 0; }, g4 = gripOf(4), hold = g4 > 0 ? HELD.HOLDS.map(k => HELD.HOLD[k]).find(h => h.id === g4) || null : null;
  const held = [false, !!hold]; if (hold && hold.hands === 2) held[0] = true;
  const low = arm.map((L, s) => L.map(t => !held[s] && t.every(i => full.P[i * 3 + 1] < .6501)));
  const groups = new Map(); for (let i = 0; i < n; i++) { const p = partOf(i); if (p !== 3 && p !== 4) continue; const key = p + ':' + [0, 1, 2].map(a => Math.round(full.P[i * 3 + a] * 1e5)).join(','); (groups.get(key) || groups.set(key, []).get(key)).push(i); }
  // the hand (rest y < 0.475, below the cuff) and the elbow ring's vertices of each arm, for the fit's targets
  const hand = [[], []], ring = [[], []]; for (let i = 0; i < n; i++) { const p = partOf(i); if (p !== 3 && p !== 4) continue; const y = full.P[i * 3 + 1]; if (y < .43 && y > .33) hand[p - 3].push(i); if (Math.abs(y - .65) < .026) ring[p - 3].push(i); }
  return { full, n, N, vaos, bufs, outP, outN, TP, TN, arm, torso, head, legs, low, held, hold: hold ? HELD.HOLDS.find(k => HELD.HOLD[k] === hold) : null, crackGroups: [...groups.values()].filter(g => g.length > 1), hand, ring,
    free() { for (const b of bufs) gl.deleteBuffer(b); for (const v of Object.values(vaos)) gl.deleteVertexArray(v); } }; }
// pose it: a gait state (the idle at its moment) and, for the fit, both arms outright ([P, R, Y, T, e] the +x arm, the −x arm)
function pose(Bd, g, arms) {
  const { gl, city, fit } = tfProgram(), prog = arms ? fit : city, row = new Float32Array(ROWS * 4); W2.writeGait2(row, 1, 0, g);
  if (arms) { const [a, b] = arms; row.set([a[0], a[1], a[2], a[3]], 12); row.set([b[0], b[1], b[2], b[3]], 16); row.set([a[4], b[4], 0, 1], 20); }
  gl.useProgram(prog); gl.bindVertexArray(Bd.vaos[arms ? 'fit' : 'city']); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, Bd.outP); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, Bd.outN);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, ROWS, gl.RGBA, gl.FLOAT, row);
  gl.enable(gl.RASTERIZER_DISCARD); gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, Bd.N); gl.endTransformFeedback(); gl.disable(gl.RASTERIZER_DISCARD);
  gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);
  gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, Bd.outP); gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, Bd.TP); gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, Bd.outN); gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, Bd.TN); }
// count what the posed body shows (the kinds above); c accumulates, note(kind) marks the first
function measure(Bd, c, note = () => {}) {
  const { full, n, TP, TN, arm, low } = Bd, at = i => [TP[i * 3], TP[i * 3 + 1], TP[i * 3 + 2]], C = 20;   // (bucket cells of 1 / C m = 5 cm)
  const box = T => [[0, 1, 2].map(a => Math.min(T[0][a], T[1][a], T[2][a])), [0, 1, 2].map(a => Math.max(T[0][a], T[1][a], T[2][a]))];
  const cellsOf = ([lo, hi], f) => { for (let x = Math.floor(lo[0] * C); x <= Math.floor(hi[0] * C); x++) for (let y = Math.floor(lo[1] * C); y <= Math.floor(hi[1] * C); y++) for (let z = Math.floor(lo[2] * C); z <= Math.floor(hi[2] * C); z++) f((x + 500) * 1e6 + (y + 500) * 1e3 + (z + 500)); };
  const ov = (a, b) => a[0].every((v, i) => v <= b[1][i] + 1e-6) && b[0].every((v, i) => v <= a[1][i] + 1e-6);
  for (const ids of Bd.crackGroups) { const a = at(ids[0]); let m = 0; for (const j of ids) m = Math.max(m, len(sub(at(j), a))); if (m > c.crack) c.crack = m; if (m > 1e-5) note('crack'); }
  const frame = q => { const o0 = at(n + q * 4), ax = [1, 2, 3].map(j => sub(at(n + q * 4 + j), o0)); return p => { const dd = sub(p, o0); return ax.map(v => dot(dd, v)); }; };
  const inTorso = frame(0), inHead = frame(1), S20 = .05, mg = .003;
  const obs = {}; for (const [name, list] of [['torso', Bd.torso], ['head', Bd.head], ['legs', Bd.legs], ['arm0', arm[0]], ['arm1', arm[1]]]) { const T = list.map(t => t.map(at)), B = T.map(box), G = new Map(); T.forEach((t, q) => cellsOf(B[q], key => (G.get(key) || G.set(key, []).get(key)).push(q))); obs[name] = { T, B, G }; }
  for (let side = 0; side < 2; side++) {
    const A = obs['arm' + side];
    A.T.forEach((T, q) => { const nn = cross(sub(T[1], T[0]), sub(T[2], T[0])), m = len(nn), e = Math.max(len(sub(T[1], T[0])), len(sub(T[2], T[1])), len(sub(T[0], T[2]))); if (m < 1e-12 || m / e < 2e-4) return;
      const i0 = arm[side][q][0], sn = [TN[i0 * 3], TN[i0 * 3 + 1], TN[i0 * 3 + 2]]; if (dot(nn, sn) / (m * len(sn)) < -.05) { c.folds++; note('folds'); } });
    for (const L of arm[side]) for (const i of L) { if (full.P[i * 3 + 1] > .6499 || Bd.held[side]) continue; const p = at(i), t = inTorso(p), h = inHead(p);
      if (t[0] > -5 * S20 + mg && t[0] < 5 * S20 - mg && t[1] > 10 * S20 + mg && t[1] < 18 * S20 - mg && t[2] > -2 * S20 + mg && t[2] < 3 * S20 - mg) { c.core++; note('core'); }
      if (h[0] > -8 * S20 + mg && h[0] < 8 * S20 - mg && h[1] > 19 * S20 + mg && h[1] < 34 * S20 - mg && h[2] > -7 * S20 + mg && h[2] < 8 * S20 - mg) { c.core++; note('core'); } }
    for (const name of ['torso', 'head', 'legs', ...(side === 0 ? ['arm1'] : [])]) { const O = obs[name], hit = new Set(), kind = name === 'arm1' ? 'arm' : name;
      A.T.forEach((T, a) => { if (kind !== 'arm' && !low[side][a]) return; cellsOf(A.B[a], key => { for (const b of O.G.get(key) || []) { const kk = a * 1e6 + b; if (hit.has(kk)) continue; hit.add(kk); if (!ov(A.B[a], O.B[b])) continue; if (crosses(T, O.T[b], .0015)) { c[kind]++; note(kind); } } }); }); }
  }
  return c; }
const zero = () => ({ n: 0, torso: 0, head: 0, legs: 0, arm: 0, core: 0, folds: 0, crack: 0, first: {} });
// o: { pool, looks: [k…], states: [{ v, seed, t, look, key }], dedupe } → { looks: { k: { tris, states: { key: counts } } }, same }; key groups
// states (an idle and its variant): the counts are summed per key, with the first moment that showed each kind
function check(o) {
  const out = { looks: {}, same: {} }, shapes = new Map();
  for (const k of o.looks) {
    const full = fullOf(k, o.pool || 'npc');
    // (looks of one shape, the same body in other colours, are checked once: the pose reads aPart and the rest positions, not the colours)
    let hs = 2166136261 >>> 0; const PK = new Uint32Array(full.P.buffer, full.P.byteOffset, full.P.length), KK = new Uint32Array(new Float32Array(full.K).buffer);
    for (const A of [PK, KK]) for (let i = 0; i < A.length; i++) hs = Math.imul(hs ^ A[i], 16777619) >>> 0;
    const hk = hs + ':' + full.P.length; if (o.dedupe && shapes.has(hk)) { out.same[k] = shapes.get(hk); continue; } shapes.set(hk, k);
    const Bd = body(k, o.pool), res = out.looks[k] = { hold: Bd.hold, tris: { arm: Bd.arm[0].length + Bd.arm[1].length, torso: Bd.torso.length, head: Bd.head.length, legs: Bd.legs.length }, states: {} };
    for (const S of o.states) { const c = res.states[S.key] ||= zero(); c.n++; pose(Bd, stand(S.v, S.seed, S.t, S.look || 0)); measure(Bd, c, kind => { if (!(kind in c.first)) c.first[kind] = +S.t.toFixed(2); }); }
    Bd.free(); }
  return out; }
// FIT an arm pose on the real body: o: { looks: [[k, pool]…], v, seed, t, look, arms: [[P, R, Y, T, e] +x, −x], targets: [{ hand, elbow }
// +x, −x] (body metres, null: free), fix: [indices 0–9 not to move], lo / hi bounds } → the best arms and what they show. Coordinate
// descent: each angle ± step, kept when the cost falls; the step halves when nothing helps. Cost: crossings and core points (heavy),
// then the distance of each hand and elbow from its target (per cm)
function fit(o) {
  // (o.states: [{ v, seed, t, look }], the moments the pose must hold in: the idle's own body moves under the arms; default one moment)
  const bodies = (o.looks || [[0, 'npc']]).map(([k, pool]) => body(k, pool)), gs = (o.states || [o]).map(S => stand(S.v ?? 0, S.seed ?? -1, S.t ?? 0, S.look || 0)), fix = new Set(o.fix || []);
  const lo = o.lo || [-1.6, -.4, -.6, -2.2, 0, -1.6, -.4, -.6, -2.2, 0], hi = o.hi || [1.6, 1.8, .9, 2.2, 2.4, 1.6, 1.8, .9, 2.2, 2.4];
  const cen = (Bd, ids) => { const s = [0, 0, 0]; for (const i of ids) for (let a = 0; a < 3; a++) s[a] += Bd.TP[i * 3 + a]; return s.map(v => v / Math.max(1, ids.length)); };
  // (sym: the −x arm is the +x arm's mirror, the same angles: aArmRot mirrors by side)
  if (o.sym) for (let i = 5; i < 10; i++) fix.add(i);
  let evals = 0; const cost = x => { evals++; if (o.sym) for (let i = 0; i < 5; i++) x[i + 5] = x[i]; const arms = [x.slice(0, 5), x.slice(5, 10)]; let c = 0; const info = [];
    for (const Bd of bodies) for (const g of gs) { pose(Bd, g, arms); const m = measure(Bd, zero()); c += 10 * (m.torso + m.head + m.legs + m.arm + m.folds) + 3 * m.core;
      const where = [1, 0].map(s => ({ hand: cen(Bd, Bd.hand[s]), elbow: cen(Bd, Bd.ring[s]) }));
      (o.targets || []).forEach((T, s) => { if (!T) return; for (const kk of ['hand', 'elbow']) if (T[kk]) c += (T.w?.[kk] ?? 1) * 100 * len(sub(where[s][kk], T[kk])); });
      info.push({ m, where }); }
    return { c, info }; };
  let x = [...o.arms[0], ...o.arms[1]].map(Number), best = cost(x), step = o.step || .16;
  while (step > (o.minStep || .01) && evals < (o.maxEvals || 3000)) { let better = false;
    for (let i = 0; i < 10; i++) { if (fix.has(i)) continue; for (const d of [step, -step]) { const y = x.slice(); y[i] = Math.max(lo[i], Math.min(hi[i], y[i] + d)); if (y[i] === x[i]) continue; const r = cost(y); if (r.c < best.c - 1e-9) { x = y; best = r; better = true; } } }
    if (!better) step /= 2; }
  for (const Bd of bodies) Bd.free();
  const r3 = v => Array.isArray(v) ? v.map(r3) : typeof v === 'number' ? +v.toFixed(3) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, w]) => [k, r3(w)])) : v;
  return r3({ arms: [x.slice(0, 5), x.slice(5, 10)], cost: best.c, evals, info: best.info.map(i => ({ ...i.m, first: undefined, n: undefined, where: i.where })) }); }
// EVERY FRAME of a filmed idle (idlecheck.mjs elbowfilm): o: { k, pool, states: [{ v, seed, t, look }] } → per state [what the check counts
// in all, the largest move of any vertex since the state before (m: a snap shows as one big step)]
function steps(o) { const Bd = body(o.k ?? 0, o.pool), out = []; let prev = null;
  for (const S of o.states) { pose(Bd, stand(S.v, S.seed ?? -1, S.t, S.look || 0)); const c = measure(Bd, zero()); let mx = 0;
    if (prev) for (let i = 0; i < Bd.n * 3; i += 3) mx = Math.max(mx, Math.hypot(Bd.TP[i] - prev[i], Bd.TP[i + 1] - prev[i + 1], Bd.TP[i + 2] - prev[i + 2]));
    prev = Bd.TP.slice(); out.push([c.torso + c.head + c.legs + c.arm + c.core + c.folds, +mx.toFixed(4)]); }
  Bd.free(); return out; }
// what an arm pose shows (no search): o as fit's
function probe(o) { return fit({ ...o, maxEvals: 1 }); }
// which idle the city's shader plays for a seed at a crossing, and the seed's traits (anim/idle.js idleTraits, when the version has it)
const IDM = await import(`${PFX}/style/city/anim/idle.js`);
window.__ib = { sheet, check, fit, probe, steps, traitKeys, grab, people, aim, draw, stand, lookOf, fullOf, idle: IDM, version: PFX ? 'base' : 'after', looks: o => Array.from({ length: o.n }, (_, k) => { const L = lookOf(k, o.pool || 'npc'); return { k, top: L.top?.id, held: L.held?.id, acc: L.acc?.id }; }) };
document.title = 'ready';
