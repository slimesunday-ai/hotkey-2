# Merging the lab into the city

**Merged 2026-09-29** (slime approved the lab). What went where, and the numbers: `../PASS-anim.md`. The city imports the modules from
here (`gait2.js`, `walk2.js`, `turn.js`, `idle.js`, `bake.js`), so the lab and the city run the same code; `walk.js` (v1) stays lab-only.
Where the merge differs from the plan below: the gait and idles are stepped by `pedsim.js animate()` for the near walkers only, from the
distance the drawn walker actually moved; the heading is `pedsim.js face()` (turn.js `turnToward`), used by all three tiers; the arcs are
laid on the lanes (`pedsim.js where()`, the Bézier of `cornerPoint`); `bodyPart` stays copied in `bake.js` (chars.js untouched); the sim
agents' own looks are baked with `bakeSegFull` too (`simstate/looks.js`).

*The plan, as written before the merge:*

**What to merge:** v2 (`gait2.js`, `walk2.js`, `bake.js` `bakeSegLooks`), plus `idle.js` and `turn.js` as they are. v1 (`walk.js`, `bakeAnimLooks`) stays in the lab for the A/B; don't merge it.

**Bake: `pedbake.js`**
- Replace `bakeFull` with `bake.js` `bakeSegFull(THREE, CH, look)`. It builds from `CH.compose(look)`, not from the built meshes.
- It needs chars.js's `bodyPart`. bake.js has a verbatim copy; better, export it from chars.js and import it.
- Parts: 5 become 13 (pelvis, chest, head, and thigh, shin, foot, upper arm, forearm on each side). Each is meshed closed, with joint slabs. The output shape is the same, plus `count` and `slabN`.
- Run it in the worker (jobs.js `jobPeds`), like `bakePeds`. The lab bakes 16 looks in about 130 ms on the main thread.
- The mid and far tiers are unchanged.

**Drawing: `peds.js`**
- Replace `inject` with `installAnim2(nearMat, uni)` and `installAnim2(depthMat, uni)` from `walk2.js`.
- `[uni, G] = animUniforms2(tex, WALK2)`: the uniforms (80 key vec4s and 3 vec4s) and the gait `G`, which `stepGait2` needs.
- If the tunables change, call `setAnimUniforms2(uni, WALK2)` again; it returns the new `G`.
- `pedTex` becomes `createAnimTexture2(nearCap)`: three rows per walker, written by `writeGait2`.
- Drop the instance-matrix bob. The shader does it, and the pelvis height is in the texture.
- Draw the yaw from `pedsimHeading(w, dt)` (`turn.js`), not `w.p[3]`.

**Walking: `pedsim.js`**
- Give each walker `w.g = gait2State()`.
- Each step, call `stepGait2(w.g, ds, dt, WALK2, G, w.dyaw)`. It is sub-stepped at 1/120 s, so the same distance gives the same pose at any frame rate.
- Keep `w.ph` for the dogs.
- For walkers waiting or queued (`w.vc < .05`), call `stepIdle(w.g, …)` (idle.js, unchanged):
  - at a kerb: `IDLE.crossing`, with `w.g.look` aimed at the signal
  - elsewhere: a random pick from `IDLE_POOL`
- Optional corner arcs: in `where()`, use `cornerPoint()` within about 0.8 m of a node.

**Cost** (lab bench, 2,000 full bodies, shadow pass included)
- v2 against v1: +1.7 ms GPU (13.9 against 12.2 ms), mostly the 14.5 % more triangles; +0.4 ms CPU (0.9 against 0.5 ms).
- Near tier (≤128 walkers): about +0.1 ms.
- In the pixel gate, 0 of 1,680 frames show inside faces.

**Not touched:** `chars.js` (except exporting `bodyPart`, if you choose to), `charbake.js` (the kept people's idles), `stream.js`, `people.js`.

**Held + grip (2026-09-29): what changes in the city when it merges.** The city's own files are untouched. The change arrives through the modules it already imports.
- `bake.js` writes each vertex's part as `part + hold/64`. A look with nothing held stays a `Uint8Array`, byte for byte as before. A holder's `K` is a `Float32Array`, and `peds.js` already copies K into floats. Anything that rounds `aPart` still gets the part.
- `walk2.js` decodes the hold. `grip.js gripPose` then poses the holding arm: phone up, a hooked bag straight and out, a box in both hands, the vinyl shown off.
- `idle.js`: check phone uses the real phone. `gripIdle` swaps the idles a busy hand can't do.
- `compose()` returns `HX`: box voxels that sit where the legs are at rest. `bake.js` and `build()` add HX to the arms.

Walkers roll the same looks, drawn with better grips. There's no new texture row, attribute or per-walker state. The cost is about 4 bytes a vertex for holders' K, and a few ALU ops a vertex.
