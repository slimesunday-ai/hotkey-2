// WHAT A LOOK LEAVES AND WHAT IS OVER ITS HEAD (looks-1): the plan's trail and overhead channels (crafting plan B11).
// Built ONCE when the page loads, three drawings for every look on stage at once, whatever is on:
//   squares   little cubes with a velocity, gravity and a life, lit like the street (puke: thrown, landing, lying
//             flat as a spatter on the ground; anything else that falls)                      one InstancedMesh, SQUARES
//   glow      the same, unlit (steam pouring up off a body, sparks)                             one InstancedMesh, GLOWS
//   icons     one pixel picture over a head (z's rising off a sleeper, a note off a dancer, the vein of a temper),
//             always facing the camera, drawn from one small atlas                              one InstancedMesh, ICONS
// Nothing is made per frame and nothing when a look starts or ends: rings of slots, the oldest used again.
// With nothing alive a mesh is hidden (no drawing at all).
//
//   const bits = createBits({ THREE, scene, camera })
//   bits.throw(kind, n, at, dir, o)     n squares from `at` along `dir` (world), o: { speed, cone, size, life, colors, grav, owner, flat, up }
//   bits.icon(kind, at, o)              one picture at `at`, o: { rise, drift, size, life, color, owner }
//   bits.fade(owner, s)                 every square and icon of that owner gone within s seconds
//   bits.update(dt, groundAt)           once a frame
//   bits.stats() → { squares, glows, icons, drawings }
export const SQUARES = 600;
export const GLOWS = 400;
export const ICONS = 48;

/** The atlas's pictures (16 × 16 pixels each): '#' the ink, 'o' the outline. */
const ART = {
  z: [
    '................',
    '..oooooooooooo..',
    '..o##########o..',
    '..o##########o..',
    '..ooooooo###oo..',
    '.......oo###o...',
    '......oo###oo...',
    '.....oo###oo....',
    '....oo###oo.....',
    '...oo###oo......',
    '..oo###ooooooo..',
    '..o##########o..',
    '..o##########o..',
    '..oooooooooooo..',
    '................',
    '................',
  ],
  note: [
    '.......oooooo...',
    '.......o####oo..',
    '.......o#oo##oo.',
    '.......o#o.oo#o.',
    '.......o#o..o#o.',
    '.......o#o..ooo.',
    '.......o#o......',
    '.......o#o......',
    '..ooooo##o......',
    '.oo#####o.......',
    '.o######o.......',
    '.o######o.......',
    '.oo####oo.......',
    '..oooooo........',
    '................',
    '................',
  ],
  vein: [
    '................',
    '...oooo..oooo...',
    '..oo##o..o##oo..',
    '..o##oo..oo##o..',
    '..o#oo....oo#o..',
    '..ooo......ooo..',
    '................',
    '................',
    '..ooo......ooo..',
    '..o#oo....oo#o..',
    '..o##oo..oo##o..',
    '..oo##o..o##oo..',
    '...oooo..oooo...',
    '................',
    '................',
    '................',
  ],
  swirl: [
    '................',
    '....oooooooo....',
    '...oo######oo...',
    '..oo#oooooo#oo..',
    '..o#oo....oo#o..',
    '..o#o.oooo.o#o..',
    '..o#o.o##o.o#o..',
    '..o#o.o#oo.o#o..',
    '..o#o.o#o..o#o..',
    '..o#o.o#oooo#o..',
    '..o#o.oo####oo..',
    '..o#oo.ooooooo..',
    '..oo#oooooo.....',
    '...oo######o....',
    '....oooooooo....',
    '................',
  ],
};
const KINDS = Object.keys(ART);

export function createBits({ THREE, scene, camera }) {
  const M4 = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const V = new THREE.Vector3();
  const S = new THREE.Vector3();
  const E = new THREE.Euler();
  const C = new THREE.Color();

  // ── squares: lit and unlit, one cube each, coloured per instance
  function pool(n, material) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.visible = false;
    mesh.setColorAt(0, C.set(0xffffff));
    mesh.name = 'looks:bits';
    scene.add(mesh);
    const P = Array.from({ length: n }, () => ({ on: false }));
    return { mesh, P, head: 0, n };
  }
  const lit = pool(SQUARES, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 }));
  const glow = pool(GLOWS, new THREE.MeshBasicMaterial({ toneMapped: false }));

  // ── icons: camera-facing quads from one atlas
  const CELL = 16;
  const cv = document.createElement('canvas');
  cv.width = CELL * KINDS.length;
  cv.height = CELL;
  const g2 = cv.getContext('2d');
  KINDS.forEach((k, n) => ART[k].forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    g2.fillStyle = ch === '#' ? '#ffffff' : '#101014';
    g2.fillRect(n * CELL + x, y, 1, 1);
  })));
  const atlas = new THREE.CanvasTexture(cv);
  atlas.magFilter = atlas.minFilter = THREE.NearestFilter;
  atlas.generateMipmaps = false;
  atlas.colorSpace = THREE.SRGBColorSpace;
  const iconMat = new THREE.MeshBasicMaterial({ map: atlas, alphaTest: 0.5, toneMapped: false, side: THREE.DoubleSide });
  const cellAttr = new THREE.InstancedBufferAttribute(new Float32Array(ICONS), 1);
  const iconGeo = new THREE.PlaneGeometry(1, 1);
  iconGeo.setAttribute('aCell', cellAttr);
  iconMat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCell;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n  vMapUv = vec2( ( uv.x + aCell ) / ${KINDS.length.toFixed(1)}, uv.y );`);
  };
  iconMat.customProgramCacheKey = () => 'looks-icons';
  const icons = new THREE.InstancedMesh(iconGeo, iconMat, ICONS);
  icons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  icons.count = 0;
  icons.frustumCulled = false;
  icons.castShadow = false;
  icons.visible = false;
  icons.renderOrder = 3;
  icons.setColorAt(0, C.set(0xffffff));
  icons.name = 'looks:icons';
  scene.add(icons);
  const I = Array.from({ length: ICONS }, () => ({ on: false }));
  let iHead = 0;

  const pick = list => list[(Math.random() * list.length) | 0];
  const rnd = (a, b) => a + Math.random() * (b - a);

  /**
   * n squares from `at` along `dir`. o: speed (m/s), cone (spread, share of the speed), size [a, b] (m), life [a, b] (s),
   * colors, grav (m/s², negative rises), drag, glow (unlit pool), flat (lands and lies as a flat square), grow (×/s while
   * flying), owner (a key for fade), delay [a, b] (s before it shows).
   */
  function toss(n, at, dir, o = {}) {
    const B = o.glow ? glow : lit;
    for (let k = 0; k < n; k++) {
      const p = B.P[B.head];
      B.head = (B.head + 1) % B.n;
      const sp = o.speed ?? 2;
      const cone = o.cone ?? 0.3;
      const f = rnd(0.55, 1.15);
      p.on = true;
      p.x = at[0] + rnd(-1, 1) * (o.spread ?? 0);
      p.y = at[1];
      p.z = at[2] + rnd(-1, 1) * (o.spread ?? 0);
      p.vx = dir[0] * sp * f + rnd(-0.5, 0.5) * sp * cone;
      p.vy = dir[1] * sp * f + rnd(-0.5, 0.5) * sp * cone;
      p.vz = dir[2] * sp * f + rnd(-0.5, 0.5) * sp * cone;
      p.size = rnd(...(o.size ?? [0.05, 0.1]));
      p.life = rnd(...(o.life ?? [1, 2]));
      p.age = -(o.delay ? rnd(...o.delay) : 0);
      p.grav = o.grav ?? 9.8;
      p.drag = o.drag ?? 0.4;
      p.grow = o.grow ?? 0;
      p.flat = !!o.flat;
      p.down = false;
      p.rx = Math.random() * 6.28;
      p.ry = Math.random() * 6.28;
      p.spin = o.spin ?? 6;
      p.color = pick(o.colors ?? [0xffffff]);
      p.owner = o.owner ?? null;
      p.end = Infinity;
    }
  }

  function icon(kind, at, o = {}) {
    const p = I[iHead];
    iHead = (iHead + 1) % ICONS;
    p.on = true;
    p.cell = Math.max(0, KINDS.indexOf(kind));
    p.x = at[0];
    p.y = at[1];
    p.z = at[2];
    p.rise = o.rise ?? 0.45;
    p.drift = o.drift ?? 0.25;
    p.dir = o.dir ?? Math.random() * 6.28;
    p.size = o.size ?? 0.5;
    p.grow = o.grow ?? 0.6;
    p.life = o.life ?? 2.2;
    p.age = 0;
    p.color = o.color ?? 0xffffff;
    p.owner = o.owner ?? null;
    p.end = Infinity;
    p.wob = Math.random() * 6.28;
    // (a straight drift instead of a rise: the z's going up and off to one side, "z Z Z")
    p.vel = o.vel ?? null;
  }

  /** Every square and picture of `owner` gone within s seconds (shrinking out). */
  function fade(owner, s = 1) {
    const end = s;
    for (const B of [lit, glow]) for (const p of B.P) if (p.on && p.owner === owner) p.end = Math.min(p.end, Math.max(0, p.life - p.age > end ? p.age + end : p.life));
    for (const p of I) if (p.on && p.owner === owner) p.end = Math.min(p.end, p.age + end);
  }

  let lastDrawn = 0;
  function update(dt, groundAt = () => 0) {
    dt = Math.min(dt, 0.1);
    let drawn = 0;
    for (const B of [lit, glow]) {
      let n = 0;
      for (const p of B.P) {
        if (!p.on) continue;
        p.age += dt;
        if (p.age < 0) continue;
        const stop = Math.min(p.life, p.end);
        if (p.age >= stop) {
          p.on = false;
          continue;
        }
        if (!p.down) {
          p.vy -= p.grav * dt;
          const k = Math.exp(-p.drag * dt);
          p.vx *= k;
          p.vy *= k;
          p.vz *= k;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.rx += p.spin * dt;
          p.ry += p.spin * 0.7 * dt;
          if (p.grow) p.size *= 1 + p.grow * dt;
          if (p.grav > 0) {
            const gy = groundAt(p.x, p.z);
            if (p.y <= gy + p.size * 0.15) {
              p.y = gy + 0.004 + (n % 7) * 0.0012;
              if (p.flat) {
                p.down = true;
                p.rx = 0;
                p.ry = Math.random() * 6.28;
                // (a drop spreads a little where it lands)
                p.size *= rnd(1.2, 1.8);
              } else p.vy = Math.abs(p.vy) * 0.2;
            }
          }
        }
        // (the last third of its life, or a fade asked for, it shrinks out: no transparency, no sorting)
        const left = stop - p.age;
        const shrink = Math.min(1, left / Math.min(0.6, stop * 0.35));
        const s = p.size * shrink;
        if (p.down) {
          Q.setFromEuler(E.set(0, p.ry, 0));
          S.set(s, s * 0.12, s);
        } else {
          Q.setFromEuler(E.set(p.rx, p.ry, 0));
          S.set(s, s, s);
        }
        M4.compose(V.set(p.x, p.y, p.z), Q, S);
        B.mesh.setMatrixAt(n, M4);
        B.mesh.setColorAt(n, C.setHex(p.color));
        n++;
      }
      B.mesh.count = n;
      B.mesh.visible = n > 0;
      if (n) {
        B.mesh.instanceMatrix.needsUpdate = true;
        B.mesh.instanceColor.needsUpdate = true;
        drawn++;
      }
    }
    // icons, facing the camera
    let n = 0;
    camera.getWorldQuaternion(Q);
    for (const p of I) {
      if (!p.on) continue;
      p.age += dt;
      const stop = Math.min(p.life, p.end);
      if (p.age >= stop) {
        p.on = false;
        continue;
      }
      const u = p.age / p.life;
      const sway = Math.sin(p.wob + p.age * 2.4) * p.drift;
      let x = p.x + Math.cos(p.dir) * sway * u;
      let z = p.z + Math.sin(p.dir) * sway * u;
      let y = p.y + p.rise * p.age;
      if (p.vel) {
        x = p.x + p.vel[0] * p.age + Math.cos(p.dir) * sway * 0.4;
        y = p.y + p.vel[1] * p.age + Math.abs(Math.sin(p.wob + p.age * 2.4)) * 0.05;
        z = p.z + p.vel[2] * p.age + Math.sin(p.dir) * sway * 0.4;
      }
      // (pops in, grows as it rises, shrinks out at the end)
      const pop = Math.min(1, p.age / 0.18);
      const out = Math.min(1, (stop - p.age) / 0.35);
      const s = p.size * (0.6 + p.grow * u) * pop * out;
      M4.compose(V.set(x, y, z), Q, S.set(s, s, s));
      icons.setMatrixAt(n, M4);
      icons.setColorAt(n, C.setHex(p.color));
      cellAttr.array[n] = p.cell;
      n++;
    }
    icons.count = n;
    icons.visible = n > 0;
    if (n) {
      icons.instanceMatrix.needsUpdate = true;
      icons.instanceColor.needsUpdate = true;
      cellAttr.needsUpdate = true;
      drawn++;
    }
    lastDrawn = drawn;
  }

  /** Make every material's program now (at load), so the first look never compiles one mid-scene. */
  function warm(renderer) {
    for (const m of [lit.mesh, glow.mesh, icons]) m.visible = true;
    lit.mesh.count = glow.mesh.count = icons.count = 1;
    for (const m of [lit.mesh, glow.mesh, icons]) m.setMatrixAt(0, M4.compose(V.set(0, -60, 0), Q.identity(), S.set(0.01, 0.01, 0.01)));
    try {
      renderer?.compile?.(scene, camera);
    } catch {
      /* the first frame compiles them */
    }
  }

  return {
    throw: toss,
    icon,
    fade,
    update,
    warm,
    stats: () => ({ squares: lit.mesh.count, glows: glow.mesh.count, icons: icons.count, drawings: lastDrawn }),
    meshes: [lit.mesh, glow.mesh, icons],
  };
}
