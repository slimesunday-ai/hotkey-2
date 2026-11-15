# Driving the 3D city from hotkey 2: notes for the stage builder

Written at the end of the round 2 spike (2026-11-11), against the pinned copy in `city/from-trunk/` (trunk `8b0b8df`).
Paths below are inside `city/from-trunk/style/city/` unless they start with `demo/` or `world/`.

**How sure each part is.** "Ran" means it ran in this repo's page and I looked at the picture
(`demo/shots/`). "Read" means it comes from reading the city's code and was not run here: treat it as a map, and
check it before building on it.

**The short version**
- Our agents live in the city as walkers of its own pedestrian system, in its own character rig. Making, moving,
  posing and following them all work from our own files, with no edit to the copy. (Ran.)
- The working code is `demo/stage/actors.js` (about 530 lines). Start from it.
- The city's record player cannot play hotkey 2. Build a thin director of our own (section 13).

## 1. The page and the three hooks

`demo/index.html` gives the city the one element it must have (`#stage`) plus `#loadin`, `#err` and `#modfail`, then
`demo/boot.js` imports the city's `main.js` unchanged. The page's query string goes straight to the city.

After `await demo.ready`, `window.__city` holds: `scene`, `camera`, `controls`, `renderer`, `THREE`, `peds`
(walkers), `traffic`, `cam` (the camera rig), `VIEWS`, `setView`, `goTo`, `stream`, `post`, `marks`, `tick(dt, n)`,
`pauseLoop(on)`.

Three hooks carry everything we do. All three are single slots, so **chain them, never overwrite**:

| Hook | When it runs | What we use it for |
|---|---|---|
| `peds.driver = (t, dt, …) => …` | every frame, before the crowd moves | moving our people |
| `peds.sim.animate` (wrap it) | per near walker, after its walk and idle are worked out | clips and their props |
| `__city.late = dt => …` | after walkers and cars moved, before the draw | anything that must follow this frame's positions. **The camera rig already owns it.** |

**Import city modules by the city's own URL.** `demo.CITY + 'cast.js'` gives the same module instance the city
uses. A different URL (a query string, another path) gives a second copy with its own clip registry and cast, and
things silently stop matching.

`?shot=1` builds everything on the main thread and draws one still: there is no loop and no camera rig. `tick(dt, n)`
then steps frames by hand. Our hooks run under it too.

## 2. An agent walker with a chosen look (ran)

```js
const actors = await createActors(demo);                          // demo/stage/actors.js
actors.add({ id: 'vee', name: 'Vee', x: 31, z: 4.6, ry: 0, look: { seed: 'vee' } });
```

Underneath, in three steps:
1. **The look.** `CH.rollLook(seed, { pool, wear })` from `cast.js` gives the same person for the same seed.
   A look is `{ skin, eyes, mouth, mark: 'id', hair, hat, top, bottom, shoes, eyewear, ears, acc, held: { id } }`.
   - `pool: 'agent'` is streetwear with marks and jewellery. `pool: 'npc'` is plainer: the crowd uses it, so agents
     read as agents.
   - `CH.wear(look, { top: 'corner_hoodie', hat: 'corner_rag' })` lays chosen pieces over the roll. An id the cast
     does not have is skipped without an error.
   - `CH.OUTFITS` are named uniforms: `officer` (precinct blues and cap), `county` (the orange jail issue).
   - There is no tint or recolour. A shared colour means the same piece.
2. **The bake.** `LOOKS.bake(CH, look)` from `simstate/looks.js` builds the body (5 to 20 ms), and
   `peds.addLook(baked)` adds it to the walker batches and returns its index.
3. **The walker.** `peds.sim.putAgent({ id, look: index, fix: [x, 0.2, z, ry] })` stands it off the lanes. The crowd
   walks round it.

Ten agents with ten looks cost nothing measurable: 60 fps before and after (`demo/shots/lineup.jpg`).

## 3. Walking (ran)

A walker is either **off the lanes** (it stands at `w.fix = [x, y, z, ry]`, and whoever owns it moves it) or
**on a lane** (the pedestrian sim walks it). `actors.walkTo(id, x, z, { v, how })` offers three ways:

| `how` | What happens | Measured |
|---|---|---|
| `'path'` (default) | The city's trip planner (`world/export/travel.mjs`, `createTravel(world).trip(from, to, 'walk')`) returns the way as points along sidewalks and crossings, either direction. We walk the points off the lanes. | bar → precinct: **31.5 m in 21.1 s** at 1.5 m/s (19 m straight) |
| `'lane'` | On the crowd's lanes, in the stream, waiting at the kerb for the light: `laneNear` → `onAgent` → `goAgent(w, wayTo(…), goal)` → wait for `w.halt` → `offAgent`. | precinct → bar: **165 m in 235 s** |
| `'straight'` | A straight line. For the plaza's paving, which is on no graph. | bar → park: 19.9 m in 13.3 s |

**The trap: the crowd's lanes run one way round each block.** A 9 m hop against the flow became a 169 m walk round
the block when measured on the lane graph. Use `'lane'` only when a walk should look like part of the crowd and time
does not matter. `actors.tripOf(ax, az, bx, bz)` gives a walk's metres and seconds without walking it.

**How long a walk takes:** the planner books 1.5 m/s. The city's own agents walk at 1.1 to 2.6 m/s
(`simstate/agents.js` `SPEED`). The table of every pair of our blocks is in `city/MAP-PROPOSAL.md`: linked walks are
14 to 44 s. None fits a 10-second hour.

(Superseded: `'path'` is now a walk on the city's own lane geometry. See "Moving on the city's own lanes" at the end.)
Known shortcuts in the spike's `'path'` mode: the walker did not wait for the lights, did not step round people, and
kept the sidewalk's height (0.2 m) while it crossed a road. The city's own stage steers its actors round bystanders
(`stage/index.js` `steer`): that is about 15 lines to port.

## 4. Holding a walker for a scene and giving it back

With our own actors there is nothing to borrow: an actor off the lanes is ours until we say otherwise, and
`walkTo` is the only thing that hands it to the sim for a while. (Ran.)

The city's own vocabulary, for reading its code (read):
- `agents.hold(id)` takes a sim agent's walker off its lane for a scene; `agents.release(id, { remove })` gives it
  back where it was taken (`simstate/agents.js`).
- `stage.ctx.actor(id, { standIn: { x, z, ry, look } })` returns a held walker or a stand-in;
  `ctx.free(A, { remove })` hands it back (`stage/index.js`). A removal waits until the camera cannot see the body:
  "nobody vanishes in view".
- A crowd walker can be pulled out and put back: `peds.sim.offWalker(w, fix)` and `onWalker(w)`.

## 5. Clips (ran)

The registry is `anim/cast/clips/index.js`: `CLIP[name]`, `playClip(g, name, { t, loop })`, `stopClip(g)`,
`stepClip(g, dt)`, `clearClip(g)`. `g` is the walker's gait state, `w.g`. All 140 names in `data/city-clips.json`
are there.

```js
await actors.play('hank', 'cook_stir');        // a loop: resolves after one length, keeps playing
actors.stop('hank');                           // blends out
await actors.play('wren', 'pat_pockets');      // a one-shot: resolves when it has ended
await actors.pair('wren', 'ozzie', 'rob_lunge_grab');
```

- **One-shot, hold, loop.** A one-shot ends by itself. `hold: true` keeps its last pose until `stopClip`. A loop runs
  until `stopClip`.
- **Chaining.** A clip's `next` field chains by itself (`fall_back` → `lie_hurt`). To chain your own, wait for one
  to end and play the next. Switching in the middle of a clip pops: the slot holds one clip and does not cross-fade.
- **Root motion.** A clip that ends somewhere else (`shift: [x, z]`) reports `shiftNow` on its last frame. The owner
  must move the walker by it on that frame. `actors.js` does.
- **Pairs.** The lead's entry says `pair: { with, gap, delay, face }`. The partner stands `gap` metres in front,
  facing the lead (or with its back to it, `face: 'away'`: the cuffing), and starts `with` after `delay` seconds.
  `rob_lunge_grab` → `hit_stumble_back`, 1.15 m, 0.34 s. `brush_pass` is its own partner, 1.02 m, no delay.
- **Standing clips need the walker stopped.** The hook sets the walk weight to 0 (`g.w = 0`) unless the clip is
  `moving`.

**The rule that will bite: clips play on the near tier only.** A walker has a gait state only while it is drawn in
full, which means within `charNear` of the camera: **46 m on the high preset, 34 m on medium, 24 m on low.** Beyond
that it is a coarse body in a fixed stride and its clip does not run. From the camera that holds the whole set
(about 100 m away) nobody plays a clip. `actors.js` keeps our people at the head of the walker list so they get near
slots first, as the city's stage does. Two ways out, neither tried:
- keep the working camera close (the follow camera is 5 m away);
- mark the walker as a priority: `peds.js` draws any walker with `w.cleaner` set on the near tier at any distance
  while it is in view. That flag belongs to another feature, so check what else reads it first.

Pictures: `demo/shots/rob-contact.jpg`, `rob-grab.jpg`, `cook.jpg`, `pass.jpg`.

## 6. Props

- **A clip's own prop (ran).** Many clips carry one: the cook's set (pot, paddle, bottle, vial, rack, stream), work
  tools, the pistol on the `aim_*` clips, the bike and the scooter. Two shapes exist: one mesh (`prop.geometry`,
  `prop.matrix(THREE, t, out, g)`), or parts (`prop.partGeometry`, `prop.partMatrices`). Both are in the walker's
  body frame. `actors.js` `drawProp` draws both. Show a prop only while the clip's weight is at least 0.6.
- **Bills (ran).** `createProps({ scene, mats: { tier: null }, night, layer: null })` from `stage/props.js` works on
  its own. `props.burst(x, y, z, n, dx, dz)` throws bills that flutter down and lie on the pavement;
  `props.litter(x, z)` leaves some. Call `props.frame(dt, camera)` every frame.
- **Also in `stage/props.js` (read):** `exclaim` (a voxel "?!" over a head), `chalk` (an outline where someone fell),
  `bang` and `bangText` (a muzzle flash and a "BANG!"), `gunAt` (the pistol posed from an aim clip), a baggie and a
  note for a deal.
- **Crates (read).** There is a crate clip family (`crate_lift`, `crate_run`, `crate_tug`, `carry_box`) whose props
  come with the clips, so they draw through the same path as the cook's set. Not run here.
- The props' car needs `mats.tier`, a material the city keeps private. See the cruiser.

## 7. The arrest cruiser (read, not run)

The whole arrest exists as one scene, `arrestScene` in `stage/vignettes.js`: a P9 cruiser drives in with its lights
going, a cop gets out, `cuff_apply`, `cuffed_walk`, the rear door opens, `get_in_car` with `guide_in_car`, the car
drives off.
- The pieces are `planStop` and `driveCar` in `stage/cruiser.js` (find a kerb, drive there through the real traffic,
  park, leave) and `props.car()` (the model, a light bar, doors that open).
- It needs the stage's context object: a top-down height map of the spot, the traffic sim, the actor functions.
  The stage itself is only created on `?sim=live` and record pages, and it wants the old sim's `agents` and `layer`.
- **Not known:** whether `createStage` runs with a small stand-in for `agents`. That is the first thing to try. If it
  does not, the cruiser is `planStop` + `driveCar` + our own actors, with `arrestScene` as the script to follow.
- Arrival time is not measured. From the code: it spawns 25 to 160 m up the street at up to 10 m/s, so 3 to 20 s plus
  any red light.
- A cheaper arrest: two cruisers are already parked at the precinct steps, 22 m from the bar.

## 8. Speech bubbles (ran)

`actors.say(id, text, { time })` puts a white bubble over the head and keeps it there as the speaker walks. It is a
page element placed each frame by projecting the point 2.95 m above the feet: the method of the city's own record
player (`simstate/record/bubbles.js`, head height 2.7 m). Page elements stay sharp at any distance.
`actors.tags(true)` shows name tags the same way. Pictures: `demo/shots/bubble.jpg`, `bubble-moved.jpg`.

At 1600 px wide the 15 px text is small in the picture. The HUD will want it bigger.

The lead's stage interface has `screenOf(agentId)`: it is the same projection (`actors.js` `place`).

## 9. The camera

`__city.cam` is the rig (`camera/rig.js`). It exists on a live page only.

- **Follow one agent (ran).** `cam.setMode('follow', { subject: actors.get(id).w })`. The subject is the walker
  object. It followed our walker over a crossing from 4.6 m behind (`demo/shots/follow.jpg`).
  `cam.setMode('orbit')` gives the camera back to the person.
- **Cut to a place (ran).** Put a pose in `VIEWS` and cut: `VIEWS.x = { pos, tgt, fov, sh }`,
  `cam.toOrbit({ instant: true })`, `setView('x')`. `demo/stage/proof.js` `view()` does this.
- **Ease to a place (read).** `cam.toOrbit({ view: { pos, tgt, fov } })` flies there. `cam.view('fitstreet')` eases
  to a named view. `__city.goTo(x, z)` jumps across the island behind the loading veil.
- **Frame two people (read).** `shotsFor(__city).go({ kind: 'two', actors: [{ x, y, z }, { x, y, z }], at })` from
  `camera/shots.js` picks an 8 to 14 m three-quarter view with a line-of-sight check. It is a still framing: nothing
  built in keeps two moving people in frame.
- **Other modes (read):** `lock` (rides with a person, walls in the way go see-through), `fly`, `photo`.
  `cam.register(name, controller)` takes a mode of our own.
- A person can always grab the camera: a drag, a click on a walker, Esc.
- `camera/director.js` is the record page's TV director. It needs a record. Not usable here.

**What the game's page does with it** (`demo/stage/camera.js`, rewritten 2026-11-11 after the owner flew through
buildings):

- **A person is watched with the rig's Lock, not its Follow.** `rig.setMode('lock', { subject: walker })`, first angle
  from due east, 24 m up, 64 degrees down, lens 42. Twenty-four metres clears every roof round the set (the highest is
  21.8 m). Follow keeps a 4.6 m arm at street level and never rests on these sidewalks.
- **Every move of ours is a cut.** Two poses on this set nearly always have a building on the line between them.
  The only travel is the Lock's own, above the roofs.
- **Indoors is ours.** A person in the pen, the tent or a pad stands inside what the collision world holds as a solid
  building, and Follow's arm is crushed to half a metre there (this, not the narrow streets, was the camera "sitting
  on their head"). The stage cuts to the set's pose for the room, and gives the rig the hook the city fills for its own
  agents at home: `city.recordHomes.cutaway(aid)` → `{ inside, door, room, frame() }`.
- **The rig's own click picker is off** on this page (`rig.people.pick = () => null`): it also picks the hidden crowd
  and swallows the release the panels listen for. Clicks on people are the stage's.
- **Our cuts act after the frame.** A cut made between the rig's update and its late step threw
  `Cannot read properties of null (reading 'update')` at `camera/rig.js:138`.
- **Playing:** a `stage.focus` on somebody else while the menu waits is ignored unless a key or a press came in the
  last 400 ms (the panels call `focus` for the menu line they preselect). One the player did pick is a glance, and
  only when its target is out of the frame; the next hour brings the camera back.
- **Measure it:** `node demo/tools/camera-check.mjs --part clicks | views | season` counts, every frame, the frames
  the camera is under a roof (the collision world's `topAt`), the frames the watched person is off screen, and the
  largest move that was not a declared cut.

**For the whole set:** `demo/stage/citymap.js` `VIEWS.set` (from the north, 66 m up) holds every block
(`city/shots/set.jpg`). At that distance agents are small and no clip plays (section 5).

## 10. Rooms you can see into (read)

- **Homes work today.** `await __city.homesLoad(); await __city.homes.open('apt:-1_-1·L0·1')` cuts a registered
  flat or house open and shows its room. The registry has 985 flats; `world/export/world.json` lists them with their
  street doors. The room's group is reachable (`homes.cache`), so our own figures can be put in it. Switching the
  camera to follow closes the home.
- **Shops are seen through their glass only.** Each generated shop has a stocked room and a still clerk baked into the
  block. They cannot be addressed or animated.
- **Precinct 9 has no interior.** It is a solid block with a door recess. Nothing in the city draws a cell, a desk or
  a booking room. The jail on Iron Island is exteriors only.
- **The hospital has no interior.** St. Mercy's ER court has ambulances, a gurney and a wheelchair outside.
- **A cell or an ER room can be built from the city's kit:** `interiors/city/room.js` `buildRoom(assembly, …)`
  takes a room as data (walls, floor, items in 0.25 m cells) and uses the home catalogue, which has a platform bed,
  a toilet, a sink, a desk, a medicine cabinet and a CCTV camera. The store kit adds a cage counter and waiting
  chairs.
- **Showing it inside the building** means cutting Precinct 9 open with the one global cut the home cutaway uses
  (`gpu.js` `CUT`). It is one cut for the whole page, so it cannot be open with a home at the same time. Not tried.
- **The cheap way:** stand the room on its own as a dollhouse (the city's interior preview does this) and cut the
  camera to it. That needs no cut and no edit, and it is what "a room you can see into" costs least.

## 11. NPCs that already have drawings (read, except where noted)

| Game NPC | What the city has | Verdict |
|---|---|---|
| Officers Hale and Okafor | `OUTFITS.officer` over any roll; the `patrol_walk` clip (hands behind the back, head scanning); `guard_post` | Ready. Not run here, but it is the same `add()` with `look: { outfit: 'officer' }`. |
| The cruiser | section 7; two parked at the precinct; patrol cars in the traffic | Exists, needs the stage. |
| Shopkeepers | a clerk behind the counter in every generated shop, behind glass; the `haggle_counter` clip (forearms on a 0.74 m counter) for the agent's side | A still figure only. A live shopkeeper is one more actor at the door. |
| Fence | a pawn fit-out exists (cage counter, gold cases) but no pawn shop stands on the ring | Needs a sign and an actor. |
| Gun shop clerk | nothing: no gun shop trade, sign or fit-out anywhere | Needs everything. The gunrunner's bench props and the pistol exist. |
| Street buyers | the city's deal scene grabs whoever walks past the dealer within 1.9 m and plays `brush_pass` with them; `offWalker` / `onWalker` take a crowd walker out and put it back | Nobody walks up on purpose yet. A named regular is one of our actors with an `npc`-pool look. |
| The Dunn brothers | no family notion. Share the skin and hair with `wear`; `rob_lunge_grab`, `aim_*`, `run_getaway` exist | Two actors. |
| The Sixes | no crew look. Share pieces: `corner_rag` (a green bandana), `corner_hoodie` | Three actors. Note `OUTFITS.hooded` names pieces the cast does not have, so it does nothing. |
| Docks supplier | pieces `dock_vest`, `dockhand_beanie` | One actor. |
| Medic | pieces `npc_top_scrubs`, `npc_pants_scrubs` | One actor. |
| Courier | piece `npc_top_delivery`; `bike_pedal` and `scooter_ride` clips bring their own bike and scooter | One actor. |
| Snitch | the `phone_tip` clip (6 s: phone out, a glance round, the call) | One actor. |

## 12. Day turning into night in one page load

The game runs 12:00 to 23:00. The city decides day or night when the page loads (`?tod=night`), because lit windows,
signs and neon are baked into each block as it is built.

- **A real night page looks very good** (`demo/shots/fitstreet-night.jpg`): 22 s to load, 60 fps. (Ran.)
- **A ramp on a day page works but looks flat.** `window.__light.grade.set(k)`, k from 0 to 1, turns the sun, sky,
  fog and fill from day through blue to night on any page (ran: `demo/shots/dusk-half.jpg`, `dusk-night.jpg`).
  At k = 1 the picture is a dark blue wash: **no window lights up, no lamp throws light, no neon glows.**
- **The city's own grader does more (read).** `render/grade.js` `createTodGrade({ LIGHT: window.__light,
  post: __city.post, water: null, NIGHT: false })` also lights a share of the windows and lifts the exposure. It is
  only created on `?sim=live` pages. Building it ourselves on a plain page should work and was not tried. Lamp light
  on the street will still be missing: that part is compiled into the materials only on a live or night page.
- **`?sim=live&ui=0` (read)** gets the full grader, at the price of the old sim's layer and a red "sim offline"
  badge, because it polls a sim server that is not there.
- **The honest options:** (a) try `createTodGrade` on our page and judge the picture; (b) reload into `?tod=night` at
  20:00, behind the loading veil, which takes 4 s from the browser's cache and costs the page its state unless the
  game is saved across it; (c) play in permanent day or permanent night.

## 13. Performance and risks

**Measured** (headless Chrome 157, 1600 × 1000, Apple M3 Ultra, the "high" preset the city picked by itself):

| | |
|---|---|
| First load, no bake, empty cache | 18.7 to 19.0 s to a settled view (first picture at 4.0 s, behind the loading veil) |
| Reload, blocks in the browser's cache | 3.9 s |
| Night page, first load | 22 s |
| Frame rate | 60 fps in every case: overview, Fit Street, the plaza with ten agents and scenes playing, graded dusk, night |
| Overview | 148 draw calls, 5.8 M triangles a frame |
| Crowd | about 2,300 walkers alive at the overview |

60 fps is the screen's cap, so the headroom is not known. No frame times were taken. Nothing was measured on a
laptop, and the city's own notes put the low preset's near tier at 24 m.

**Risks**
1. **The network.** three.js comes from a CDN. No network, no page.
2. **The near tier** (section 5). A wide camera shows no clips.
3. **Private fields.** `actors.js` writes the walkers' own fields (`w.fix`, `w.vc`, `w.ph`, `w.yawS`) and calls
   `putAgent`, `onAgent`, `goAgent`, `offAgent`. None is a promised interface. Moving the pin can break them:
   `node demo/tools/proof-shots.mjs` is the check.
4. **The crowd walks into frame.** A bystander's head filled the foreground of two proof pictures. The city's stage
   keeps a room clear round a scene (`stage/crowd.js` `createRoom`). We have nothing like it yet.
5. **The record player's rules leak into the stage.** `stage/index.js` plays at most three scenes at once and only
   within 85 m of the camera. Ten agents acting every hour would be throttled if we used it as it is.
6. **Screenshots.** A PNG of this picture is several MB and Node's WebSocket drops a message that size (the DevTools
   socket closes with code 1006). `demo/tools/` saves JPEGs.
7. **Memory.** Not measured. The machine also runs a large local model: one browser at a time.

## 14. Recommendation: a thin director of our own

**Do not adapt hotkey 2's feed to the city's record player.** Build the stage as a thin director on the lower-level
pieces, growing `demo/stage/actors.js`.

Why the record player does not fit (read, by a full pass over `simstate/record/` and `stage/record.js`):
- **It cannot be started here at all.** It needs a recorded season from trunk's `core/runs/`, and none is in the copy.
- **It decides where agents stand.** By day it invents each agent's place from a hash of the seed, the day and the
  hour. The feed cannot say "this agent is on this block this hour", which is the whole of hotkey 2.
- **Its clock is fixed.** Three speeds only, the fastest 60 s per game hour, against our 10 s. One crime show a night
  at 21:05. A 14-night season with a ferry finale.
- **It reloads the page at nightfall.** A game running in the page would lose its state.
- **It hides robbers.** Attackers are always hooded and unnamed. Ours are the main characters.
- **It plays a finished file.** It cannot be fed hour by hour.
- **Its panels are the old game's.** About 70 event types of the old game are wired in. Ours would show nothing.
- Making it right means changing at least seven files of the copy, which SPEC 24.11 rules out.

| Path | Rough size | What you get |
|---|---|---|
| Adapter to the record format | 600 to 1,200 lines to make the parser accept a feed; several weeks and a fork of the copy to make the picture right | The old game's show with our names on it |
| Thin director (recommended) | 1 to 2 weeks; about 1,500 to 2,500 lines of our own on top of the 530 that exist | Our hour, our blocks, our scenes, our clock |

**What the thin director still needs**, largest first:
1. A scene runner: one stage record (`{ t, block, spot, steps: [{ actor, action, target }] }`) → walks, clips, pairs
   and bubbles on our actors, using `src/clips.mjs` for the clip names. Most of the work.
2. NPC actors with looks (section 11), and the six regulars a buyer block.
3. An hour clock we own, with pause and speed, and the rule for moves that outlast the hour.
4. The camera's choices: who to follow, when to cut, the near-tier limit.
5. The jail and clinic rooms, and the pads (section 10).
6. The cruiser (section 7).
7. Day into night (section 12).
8. Steering and a clear room round a scene (sections 3 and 13).

**Worth reusing from the city as it is:** the cast and its outfits, the clip registry and every clip's prop, the
trip planner, `stage/props.js`, the camera rig, the home cutaways, and `arrestScene` as a script to copy.

---

# Phase 2: the stage that was built (2026-11-11)

The sections above are the spike's findings. This is what stands on them now, and what changed on the way.

## The files

| File | What it is |
|---|---|
| `demo/stage/index.js` | `createStage({ city, CITY })` → the contract of SPEC 24: `begin`, `playHour`, `setSpeed`, `screenOf`, `focus`, `onPick`, `setClock`, `portraitOf`. Also who wears what (`LOOKS`). |
| `demo/stage/director-plan.js` | Pure, tested in node: an hour line → scenes in feed order with their moments, where everyone ends, routines, NPC places. |
| `demo/stage/director.js` | Plays a plan on the walkers: trips, waiting for late walkers, scenes, routines, held places. |
| `demo/stage/camera.js` | The wide shot, cut-ins, following, and standing down when the person takes the camera. |
| `demo/stage/actors.js` | The walkers themselves (section 2 to 8 above), plus time scale, portraits, picking, two-way trips. |
| `demo/stage/director-test.js`, `demo/tools/stage-run.mjs` | A season on auto over the real stage, in headless Chrome. |
| `test/stage.test.mjs` | The plan's tests. |

## What changed since the spike's notes

- **Clips at any distance (section 5's rule is solved).** Every walker of ours is marked the way the city marks its
  own priority walkers (`w.cleaner`), so it is drawn on the full-detail tier whenever it is in view. Clips play from
  the set camera. The flag is read in three places of the city (`peds.js`, `traffic/accident.js`,
  `traffic/cleaners.js`), all of which only skip such a walker, which is what we want.
- **Trips go either way over a crosswalk.** The trip planner's crosswalks are one-way. `walkTo` now takes the shorter
  of the trip there and the trip back reversed (the set builder's measurement: 33 to 45 m became 16 to 27 m).
- **A scene's block is not where everyone is.** A call, a text or a deal closed by phone names people on other
  blocks. The director walks nobody across the set for those: each plays their half where they stand.
- **The line does not say who is held.** A robbed agent can end the hour in the clinic with no step showing it. The
  stage reads the session's state (`game.state.agents[id].state`), which stands at the end of the hour the panels
  are playing. A `state` field on `line.agents[id]` would let a replayed line stand alone.
- **`src/clips.mjs` lists clips without saying how they combine.** Most lists are alternatives; a few are a sequence.
  `director-plan.js` `IN_ORDER` says which, and a test keeps it honest.
- **Many of the city's clips chain by themselves** (`fall_back` → `lie_hurt`, `phone_up` → `phone_call`,
  `aim_draw` → `aim_hold`). Waiting for such a "one-shot" to end waits forever: the director waits its own length.
- **The picture is slid into the gap between the panels** with a view offset on the camera, measured off the page.
  `screenOf` and picking go through the same projection, so they stay right.
- **The keyboard belongs to the panels on the game's page.** `demo/boot.js` stops every key at the window before the
  city's own listeners (the mouse still moves the camera; `?camkeys=1` gives the keys back).

## What is not done

- **The cruiser.** An arrest is on foot: the officer runs up, cuffs (the city's own two-person clip), and the
  prisoner walks cuffed to the jail's door. `stage/cruiser.js` still needs the city's stage context, untried.
- **Rooms.** The director calls `rooms.anchor(key)` and `rooms.show(key, on)` for `jail`, `clinic` and `pad:<id>`
  when `demo/stage/set/index.js` exports them. Without it, held agents stand at the place's exit.
- **Walkers ignore the lights** on a trip. (They no longer ignore each other, the kerbs or the corners: see "Moving on
  the city's own lanes" at the end.)
- **A clear room round a scene** (section 13, risk 4): not built. The director puts name tags on a scene's people
  instead, so they can be found in a crowd.
- **The camera goes through the city's rig everywhere now** (section 9). What it does not do: make signal heads and
  posts beside a person see-through, or show the market's east sidewalk except through a see-through patch of roof.

## Measured on the dressed Fit Street set (seed 4, 1×, headless Chrome, 1600 × 1000)

| | Watch | Play on auto |
|---|---|---|
| Verdict | `stage-ok`, 60 hours, no console errors | `stage-ok`, 60 hours, no console errors |
| Wall clock for the season | 946 s (15.8 min) | 804 s (13.4 min) |
| Frames a second | 59.9 mean (the worst single second: 1.7) | 59.9 mean (worst second: 1.6) |
| One hour, page to page | median 15.6 s, longest 25.8 s | median 15.3 s, longest 24.4 s |
| One hour, the stage's scenes alone | median 15.2 s, nine in ten under 19.2 s | median 15.3 s, nine in ten under 20.8 s |
| Our people on the full-detail tier | 50 of 50, from the set camera | 50 of 50 |

**An hour is 15 seconds, not 10.** A scene waits up to 8 s for someone still walking in (13 s into the hour nobody is
waited for any more), and a scene starts no earlier than 55 % of the way to its ticker row. Shorter means one of:
walkers that run more, scenes that start before their people arrive, or a shorter wait.

## After the owner played it (2026-11-11, later)

- **Moving traffic is off on the game's page** (`demo/boot.js` sets `cars=0` before the city loads; `?cars=1` turns
  it back on). Parked cars are part of the blocks and stay; so does the set's ambulance.
- **Why the traffic stood still on our page: NOT FOUND. I did not look.** The time went on the people. Two guesses,
  neither checked: the traffic sim holds cars for walkers at zebras and in the road (`pedsim.js` `setCars`,
  `walkOK`, `inRoad`), and our people cross off the city's lanes where it cannot see them clear; or a set piece
  (the ambulance in the Ivy St kerb lane, the pen) stands in a driving lane and the queue behind it backs up through
  the one intersection. The first thing to try in the real build: `?cars=1&oldstage=1` with nobody on stage.
- **The city is small on the game's page:** the stream's universe is cut to the blocks within two of the set's
  middle as soon as `main.js` returns, and the preset's draw distance is pulled in so the haze hides the edge.
  `?ring=3` builds one more ring; `?oldstage=1` builds everything.
- **The audit** (`node demo/tools/stage-run.mjs --audit`): jumps, cuts, clip hand-overs, clip flips, people standing
  in each other, and anyone travelling while lying or sitting, counted every frame (`demo/stage/actors.js`).

## After the camera merge (2026-11-11, evening)

- **No scene played at 7796db9 or 2f50dd5.** `director.js` `playHour` declared a second `mine` inside its scene loop
  (the "one scene at a time on the player's block" flag). It hid the hour's own number of that name, so
  `epoch !== mine` was always true and `runScene` was never reached: people walked and nothing else. Renamed to `own`.
  **The audit figures written at 7796db9 (jumps 4 → 0, close pairs 22 → 1) were taken with no scene playing.**
- **The audit with scenes playing** (seed 4, 1×, 13 hours, headless, `stage-run.mjs --audit`):

| | Play on auto | Watch |
|---|---|---|
| Jumps (over 0.5 m in a frame, not on purpose) | 0 | 0 |
| Travelling while lying or sitting | 0 | 0 |
| Pairs standing in each other (under 0.6 m for over half a second) | 11 | 22 |
| Clip flips (more than two changes of clip in a second) | 20 | 43 |
| One hour, median and longest | 15.3 s, 25.3 s | 18.1 s, 23.9 s |

- **The camera, three clicks with real pointer events** (`camera-check.mjs --part clicks`): watching 1,127 frames,
  playing 2,432 and 927 frames. Frames inside a building 0, frames with the watched person off screen 0, undeclared
  jump 0 m.
- **By hand in a real Chrome, 1869 × 882:** four hours played as the dealer with two clicks on other people, then a
  watch season with a click from the wide shot and Esc. Every move was a cut, the camera was back on the player when
  the hour played, and the page logged no error. Over those played hours the audit counted 1 jump (0.6 m), 1 close
  pair and 1 flip.
- **Seen and not fixed:**
  - six people start the season in a row on a zebra;
  - a robbery's two people stand head to head, and from above the heads overlap;
  - four people at the deli stood in one knot with their name tags on top of each other;
  - a cut-in's frame can be two-fifths roof;
  - in the wide shot a person is about ten pixels and hard to click;
  - an hour held in the clinic goes by in 3 s and the player is next seen on another block;
  - an hour with nothing to show ends in 0.2 s while its people are still walking.
- **Why our people do not move like the city's.** The city's lane walkers have a walk driven by distance (feet
  plant), 2.5 m/s² of acceleration, eased turns, rounded corners, kerb waits and a step round whoever stands in the
  way (`pedsim.js`, `anim/gait2.js`, `anim/turn.js`). Ours walk off the lanes (`actors.js` `moveFree`): straight
  lines between a path's points at one speed, started and stopped in a frame, no lights, nobody stepped round (a
  push apart afterwards), at the sidewalk's height across a road. Section 3 says why they are off the lanes.

## Moving on the city's own lanes (2026-11-11, night)

The owner, after being told the stage walked round the city's movement code: "a lot of stuff is already built like I
said so you should do it right from the start". Our people now move on the city's lane geometry, turn with its turn
code, read its body map and stand on spots made by its stand-spot rules. Sections 3 and 4 above describe the old
straight-line walker and are history.

**What is called, what is ported, what is ours** (`demo/stage/actors.js`, the "travel" section)

| Piece | The city's | How we use it |
|---|---|---|
| The line a walk follows | `simstate/movement.js` `createMovement({ peds })` → `geomOf(path)`, `at(G, d)` | Called. A path of points on the sidewalks' node lines becomes lane geometry in either direction: the lane's own distance from the curb, the arc at a corner walked with the ring, the join where two pieces miss, the road's height on a crossing. The module's trip runner (`run`) is never started, so its cab fleet is never made. |
| A corner walked against the ring, or on to a straight step | `anim/turn.js` `cornerPoint` | Called. `geomOf` leaves those corners sharp; the same arc (`ARC.r`, `ARC.max` of `pedsim.js`) is laid over them. |
| The drawn heading | `pedsim.js` `face(w)` → `turnToward` | Fed, not copied. We only set the heading a walker should have (`w.fix[3]`); the city eases the drawn one (3.2 rad/s, the lean, the shuffle of a turn on the spot). `actors.turned()` waits for it. |
| The gait | `pedsim.js` `animate` → `gait2` | Unchanged: driven by the distance the walker really moved. `w.ph` (the stride of a body drawn small) and `w.vc` are fed the real speed. |
| Who is in the way | `sim.grid`, `sim.near` (the body map), `sim.bodies`, `sim.movers` | Called. Everyone of ours is on the map by being a walker off the lanes. A body on the ground also publishes the city's own footprint (`stage/crowd.js` `FOOT`); a walker on its way is published as a mover, so the crowd outside the set steps aside. |
| The room to step aside in | `sim.roomSpan`, `laneC`, `sideU`, `sideDir` (the side room table) | Called. |
| The brake behind a body, the step round it | `movement.js` `lagStep`, `weave` | **Ported** (about 150 lines). They are closures inside `createMovement`, written against the record page's booked trips (a leg's minutes, its lag behind the booking) and cannot be reached. Same figures (`MOVE.lag`, `MOVE.weave`), same reading of the body map. |
| Telling the crowd where we are | `stage/crowd.js` `createRoom().step` | **Ported** (the mover and the footprint, 20 lines): `step` also holds crowd walkers for an arrest and wants the city's stage actors. |
| The way from A to B | `world/export/travel.mjs` `trip` | **Ours** (`wayBetween`, 45 lines: shortest way over `sim.nodes` and `sim.edges`, both directions). The planner keeps its rings one way after the first stretch, starts and ends a walk 2.1 m or more from a corner (a walker near a corner went back up the sidewalk first) and may cut its access stretch straight across a road. `actors.tripOf` still asks it, for the proof page. |
| Standing spots | `simstate/stands.js` `makeStands` | Called, offline: `node demo/tools/set-stands.mjs` runs it for our blocks on a `?shot=1` page and writes `demo/stage/set/stands.json`. The city's own `stands.json` has no spot at our places. |

**How a walk goes.** `actors.walkTo(id, x, z, { v, entry, yaw, clip, clipFrom })`: off the standing spot by a step to the
lane (the spot's checked entry, or a slanting step a metre or two along the way when the room table says it is clear),
along the lanes over the shortest way, off the lane the same way at the other end. The route is walked once at 5 cm
when it is made and written down as a table; the walker moves along that table by drawn metres, so its speed is the
speed asked for and a seam in the geometry is a slant, not a hop. Speed: up at 2.5 m/s² (`PED.acc`; 4 for a run),
down at 4 (`MOVE.lag.brake`) for the end, for a corner (no faster than the body turns; a runner half as fast again)
and for the first body it would touch. Height: the geometry's, eased, down a kerb a moment early.
`stepTo` is one straight step with the same starts, stops and brake. `routeOf` lays a walk out without walking it.

**Standing.** `demo/stage/stands.js` hands out the spots: a block's own first (nearest its `street` point, or nearest
the person the newcomer has come to see), then the nearest of its neighbours'. A counter, a desk or a door somebody
stands at is moved 0.75 m off the lane's line (`actors.fitSpot`). Nobody is stood on a roadway.

**What it found on the way**
- **The city builds what its camera sees.** The stage came up with the set's own two blocks unbuilt (the opening view
  is elsewhere), so their lanes were the plain sidewalk middle and moved 0.6 m when the blocks arrived a second into
  the season. `createStage` now shows the city the set and waits for those lanes (about 1.5 s, behind the veil).
- **A lane's corner arc does not keep its speed**: 0.056 m then 0.035 m of body for the same 0.05 m along the edge. The
  city's own walkers do this too. Ours do not, because of the table.
- **Far from the camera the city moves a walker every other frame** (`peds.js`, beyond `charMid`: 140 m on high, 100 on
  medium, 70 on low). Ours write their own place every frame.
- **The city's rules leave few spots on a 3 m sidewalk**: its lane runs down the middle (1.8 m from the curb) and a
  spot must be 0.95 m off it, so people stand in the kerb strip. Per block of ours: projects 19, market 10, uptown 23, corner 13, bar 6, park 8, docks 3, precinct 10 (after
  the spots inside our own dressing are dropped). A full block spills on to its neighbours' nearest free spots.

**Measured** (seed 4, 1×, 13 hours, headless Chrome, `stage-run.mjs --audit`; "before" is the stage at 8486463 with the
same audit ported on to it). A count is only worth its proof: the scene starts are the same before and after.

| | Watch before | Watch after | Play before | Play after |
|---|---|---|---|---|
| Scene starts (the proof) | 123 | 123 | 42 | 42 |
| Walks arrived · straight steps arrived | 182 · 482 | 239 · 73 | 110 · 282 | 121 · 14 |
| Jumps · travelling while lying | 0 · 0 | 0 · 0 | 0 · 0 | 0 · 0 |
| Speed steps (over 0.6 m/s in a frame) | 1,209 | 0 | 703 | 1 |
| Heading snaps (over 25° in a frame) | 41 | 0 | 14 | 0 |
| Floating over a road (frames) | 19,153 | 7 | 17,494 | 6 |
| Standing in the road over 2 s (spells) | 12 | 0 | 11 | 0 |
| On foot inside a solid (frames) | 3,466 | 33 | 3,095 | 13 |
| Frames `separate()` pushed somebody | 7,618 | 38 | 4,228 | 33 |
| Pairs under 0.6 m for over half a second | 24 | 30 | 14 | 22 |
| Walked through somebody after 2 s held up | (none: nobody was ever held up) | 15 | (none) | 12 |
| Clip flips | 51 | 35 | 20 | 21 |
| One hour, median · longest | 17.3 · 24.0 s | 23.5 · 33.6 s | 15.3 · 25.3 s | 18.6 · 31.1 s |

What the table says against the build: people still end up inside each other about as often as before, now because
a walker held up for 2 s on a sidewalk with a metre of clear strip walks through whoever stands across it (before,
they stood in a knot and were pushed apart); and an hour is 3 to 6 s longer, because a walk between two blocks is
15 to 35 m by the sidewalks and crossings where it was 7 to 28 m in a straight line, and a run that brakes for its
corners averages about 3.4 m/s where it was 5.2 the instant it started.

**Not done**
- **The lights.** A walker does not wait at a red. Moving traffic is off on the game's page, so it would cost the hour
  seconds and show nothing. It goes in `actors.js` `advance()`: hold the walker at the kerb spot (`pedsim.js` `STEP`,
  1 m on to a crossing) while `sim.walkOK(crossing)` is false.
- **Nobody walks through objects** (the owner, playing: "we shouldn't be able to walk through objects"). The audit's
  `through` counts frames somebody on foot is inside a solid: the city's collision world (`camera/world.js`, asked
  with a ball at waist height) and the set's own pieces, whose footprint `demo/stage/solids.js` reads off their
  meshes. A step on or off the lane that would cross a solid is not taken, the last steps to any place stop 30 cm
  short of one, and whoever is indoors comes out by the door (a cut) before any walk. A place that IS inside a solid
  (the map's `pad` point, behind a wall) is walked up to, not into.
- **Where a body falls.** A robbed person falls back from wherever they stood; across the sidewalk they block it and
  walkers step over their legs. Staging the fall along the kerb is the scene builder's.
- **The run's clip** only plays from 3.2 m/s up (`clipFrom`), so nobody runs on the spot while gathering speed. How a
  walk blends into a run is the animation builder's.

## No pops, scenes with room, nobody walked through (2026-11-11, late)

The owner's second item after the lanes: no pops between clips, and scenes staged with room. Same rule as before: the
city's own version first, CALLED; ported only where it cannot be reached; ours only where neither works.

**What is called, what is ported, what is ours**

| Piece | The city's | How we use it |
|---|---|---|
| The clip slot | `anim/cast/clips/index.js` `playClip`, `stopClip`, `stepClip`, `clearClip`, each clip's `blendIn` / `blendOut` / `next` | Called, as before. What changed is WHEN: see below. |
| The seam and the queue | `stage/index.js` `applyPose` (`A.seam`, `A.next`, `leadsTo`) | **Ported** into `actors.js` (`reconcile`, the seam switch in `pose`, `leadsTo`, about 60 lines). `applyPose` is a closure inside `createStage` and works on the stage's own borrowed actors; the page does not build that stage. Same order of checks, same switch (the new clip started at the old clock mod P, on the frame the clock crosses the seam). |
| Which clips meet at a seam | `anim/cast/clips/CLIPS.md` (prose) and the seams written out in `stage/vignettes.js` (`getUp`, `{ from: 'aim_hold', P: .8 }`, the cuffed state) | **Ported as data** (`actors.js` `SEAMS`, seven rows). The registry holds `next` but no seam table. |
| Where a pair stands, where a body falls | `stage/vignettes.js` `pickAxis`, `placeFor`, `fallHits`, `around`, `BACK_FP`, `SIDE_FP` | **Ported** into `demo/stage/staging.js` (pure, 190 lines). They are private to their module (only `VIGNETTES`, `cowerNear`, `stepCowers`, `leaveOnFoot`, `arrestMode`, `aftermath` are exported). Figures and order of checks kept. |
| The height map those checks read | `stage/index.js` `ctx.occ` (a picture of the scene from above, read back) | **Ours** (`staging.js` `grid`): the same map in 0.2 m cells, asked of the collision world and the set's pieces through `actors.solidAt`. `occ` is a closure of the stage. 3 to 10 ms a mark. |
| The vignettes themselves (robbery, shooting, knockdown, arrest) | `stage/vignettes.js` `VIGNETTES[kind].start(ctx, ev, at)` | **Not run.** Each takes the stage's context (`ctx.actor`, `ctx.free`, `ctx.occ`, `ctx.props`, `ctx.agents`, borrowed walkers) and plays its own fixed script; ours are the feed's steps (`src/stage.mjs`). Their pieces are used from our director instead. |
| Bystanders | `stage/vignettes.js` `cowerNear`, `stepCowers` (exported), `anim/cast/clips/react.js` (`film_phone`), `falls.js` (`cower`) | The clips are **called**. `cowerNear` is **not called**: it picks the city's own crowd walkers (`!w.agent && w.E && !w.fix`), which are hidden inside the set, and hangs a `w.stagePose` on them that only the city's stage runs. Its figures (three within 9 m, turned to it 0.35 rad off, a beat apart, 3.2 s and half a second more each) are **ported** (`staging.js` `COWER`, `reactors`; `director.js` `react`, `reactNear`). |
| The camera's side of a mark | `vignettes.js` `camView`, `unseenAt`, `followMarks` | Not ported: our camera cuts to a scene after it has started. Only the preference for an axis across the camera's view is kept (`side`). |
| The cruiser, the props (bills, the muzzle flash, the chalk) | `stage/cruiser.js`, `stage/props.js` | Not used: both want the stage's context. An arrest is still on foot. |

**How a clip changes now** (`actors.js`, "the gait hook"). A request is never played the frame it is made:
- nothing on the body: it starts and blends in from the walker's own stand or walk;
- the clip on the body is the one asked for: it plays on (a routine asked for twice is not started twice);
- the clip on the body chains into it by itself (`next`): the chain is left to get there;
- a declared seam joins the two: the switch is made on the frame the playing clip's clock crosses it;
- anything else: the playing clip blends out to the base pose, and the next starts when its weight is under 0.08.

Also: a body lying hurt that is told to walk gets up first (`get_up` at `lie_hurt`'s 2 s wrap, then the walk), where it
used to be snapped upright in one frame; a clip that stands, sits or lies is not started on a body that still has a
route (it waits for the stop); a walker that comes back into view (the city gives it a new gait state) is put back in
the loop it was left in at full weight on that first frame; two people starting a two-person clip are both blended
out to the plain stand first; a one-shot is over for whoever waits for it when it has run out, not when its blend out
is done; a partner's looping half holds a pair only as long as the lead's clip (a cuffing waited six seconds for
`cuffed_idle`'s loop). The audit counts `pops` (a clip at over 0.2 weight replaced by one it does not chain to, off
any seam) and `drops` (the same, replaced by nothing). Every `playClip` and `clearClip` of `actors.js` goes through
the one function that counts.

**How a pair is staged** (`director.js` `meet`, `markFor`). The one a step is done TO stays; the other comes to a mark
at the clip's own gap (1.15 m a grab, 1.22 m the cuffing, 1.3 m talk, 3.5 m a gun, the city's figure), on the axis
`placeFor` picks: standing ground on a sidewalk, nobody within 1.3 m, a clear line for a gun, and whoever goes down in
the scene falls on open ground. Ours on top: a mark on the walkers' lane, or a fall across it, costs a little, so a
scene lies along the kerb or the wall where it can. The one who stays steps to clearer ground first when the rule says
so. The comer walks straight to the mark from wherever they are, round the other when it is on their far side, backing
off when it is a gun taking its distance. Nothing two-handed is played with the two more than 0.8 m off their gap.
The gun comes up with `aim_draw`, fires at `aim_hold`'s seam, and comes down with `aim_lower`. When a gun comes out
the three nearest people within 9 m who are no part of it cower; the feed's own bystanders turn to the scene before
they film it; and whoever stands in a big scene's room (3.6 m, 5 m for a gun) is walked out of it first.

**Nobody is walked through** (`actors.js` `advance`, `giveWay`, `stepRound`, `replan`). The 2-second walk-through is
gone. In order: two of ours walking at each other each lean to one side from five metres off (`keptRight`); a walker
held up by somebody BESIDE its way passes on the bare radii, then leans off them (`brushes` counts the times there
was nothing to lean into and it went by on a shoulder's width, 0.45 m, never nearer); held up by somebody ON its way,
that person makes way when they are free to (a stander steps aside and back; of two walkers, or a ring of them, the
one who came on stage last steps out and takes up its walk after), and where they cannot (in a scene, sitting, lying)
the walker lays its walk again or steps round them; else it waits (`waits`: over 2 s). Two more things at the source:
`actors.free` and `place` count where people are GOING, not only where they are (two people sent to one place a
moment apart both found it free; several cut out of one door landed on one point), and a block's people leave it a
third of a second apart at the top of the hour instead of in one frame.

**Nobody sits on air** (the owner, playing: a man in `sit_stoop` on a bare sidewalk; "why is dude in a weird pose").
`routineClip` picked among an action's clips by a hash of the person, wherever they stood. Now a clip that needs
something under, behind or round the body plays only where that thing is (`actors.js` `FURNITURE`, from the city's
clip notes: `lean_wall` a wall, `sit_stoop` a ledge, `sit_bench` a bench seat; the cook's and the gunsmith's bench
loops, the floorboard and `sleep` indoors; `deal_pace` on a checked strip; `haggle_counter` only at a `counter:` spot,
else the two talk).

| Piece | The city's | How we use it |
|---|---|---|
| What a spot has | `simstate/stands.js` `makeStands`: each spot's `kind` and its `lean` / `sit` / `pace` point | Called, offline, as before (`demo/tools/set-stands.mjs`). The tool kept the kind and DROPPED the points; it keeps them now, and prints what the maker made and what was left out, by kind. |
| The plan of a standing person | `simstate/life.js` `createLife` | **Followed, not run** (`director.js` "routines": `lifeStep`, `live`). Its figures are read from the module (`LIFE`, `NAMES`); its weights and rules are ported: furniture loops only on a spot of that kind at the spot's own point; by role (deal, patrol, hang); never the same thing twice running; whole loops, ended at a wrap; out of a loop a blend to the stand (`LIFE.settle`) before the next; everyone's own first wait (`LIFE.start`). |

Why life.js is not run through an adapter (the first choice): its runner MOVES a standing person itself, by writing
the walker's place at a fixed pace that starts and stops in a frame (its strolls, beats and the walk to a sit or lean
point), which is the walk the lanes work replaced: the audit would count every one as a speed step, and it sees
nobody in its way. And it plays its clips through `simstate/movement.js`'s own gait hook (`w.mv`), a second hand on
the one clip slot beside ours, with direct `playClip` switches of its own. With both of those taken out by its `plan`
option what is left of it is the plan, which is what was ported.

What the set has (the tool's own report, 65 points asked): the maker made 248 open spots, 52 at a wall, 1 at a ledge
and no bench seat (no bench of the city's stands inside any of our places' radius; the park's bench is our own
dressing). Kept: 87 open, 4 wall (all on the deli's front, uptown), 1 ledge (the station house). Of the 48 walls
left out, 38 have no clear step from a lane (back courts, the far side of a planter), 9 are on a sidewalk that is no
block of ours, 1 is inside the pen. So on this set almost everyone stands, and that is what they now do: they look
about (`deal_lookout`, the city's own stand-in), stand in the walkers' own idles, text, listen to an earpiece, keep
a guard's stance, or stroll their spot's beat. The audit counts `unseated`: frames a furniture clip plays more than
0.3 m from its spot's point (or outdoors, for the indoor ones).

**Measured** (seed 4, 1×, 13 hours, headless Chrome, `stage-run.mjs --audit`). "Before" is the stage at 07bbafb with
the new counters added in a way that changes nothing (`pops`, `drops`, `unseated`); it was run twice, and the second
run is in brackets where it differs: that is the size of the noise. "After" is one run of the final build; in brackets,
the range over the four builds before it, which differ only in details. Scene starts are the proof that scenes played.

| | Watch before | Watch after | Play before | Play after |
|---|---|---|---|---|
| Scene starts (the proof) | 123 | 123 | 42 | 42 |
| Pops (a clip at over 0.2 weight replaced by one it does not chain to, off a seam) | 96 | 0 | 40 (41) | 0 |
| Drops (the same, replaced by nothing in one frame) | 113 (114) | 0 | 55 | 0 |
| Clip flips (over two changes of clip in a second) | 33 (35) | 16 (13 to 19) | 18 (19) | 3 (1 to 4) |
| Unseated (frames in a furniture clip with no furniture) | 30,299 | 0 | 17,659 | 0 |
| Pairs under 0.6 m for over half a second | 37 (34) | 17 (15 to 23) | 19 (20) | 17 (5 to 20) |
| Walked through somebody (squeezes) | 17 (15) | 0 (0 to 2) | 10 (14) | 2 (0 to 1) |
| Went by on a shoulder's width (`brushes`, new) | none counted | 19 | none counted | 14 |
| Waits of over 2 s behind somebody (`waits`, new) | none: it walked through at 2 s | 4 | none | 10 |
| On foot inside a solid (frames) | 34 (33) | 19 (0 to 41) | 13 | 0 (0 to 55) |
| Floating over a road (frames) | 9 (7) | 0 (0 to 1) | 6 | 0 |
| Jumps · slides · heading snaps | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 | 0 · 0 · 0 |
| Speed steps · standing in the road over 2 s | 0 · 0 | 2 · 0 (0 to 3 · 0 to 1) | 0 · 0 | 1 · 0 (0 to 6 · 0 to 1) |
| One hour, median · longest, as the tool prints them | 23.6 · 33.6 | 19.4 · 28.5 | 18.6 · 31.1 | 16.0 · 28.6 |
| The stage's own longest hour | 33.0 | 26.8 | 31.1 | 28.6 |
| The player still walking when their hour ended | n/a | n/a | the owner saw about 6 s | 0 of 13 hours |

What the table says against the build:
- **Pairs under 0.6 m are not down to 2.** Watching they are halved; playing they are anywhere between 5 and 20 from
  run to run. They are no longer people stood in a knot or walked through: every one in the audit's examples is two
  WALKERS who stopped for each other chest to chest, at the projects' corner or by a counter, and took over half a
  second to sort it out (one leans, one makes way). Ten people live on that one corner. What would take it down:
  stopping further off for anybody converging, not only head-on, and fewer front doors on one square.
- **Watching, an hour's median is 19.4 s, not 18** (19.2 to 20.2 over the last builds). The longest as the tool
  prints it is an hour of 19.5 s plus the 9 s the night sheet stands before it (the tool times hour line to hour
  line; the baseline's 33.6 s was 24.6 + 9 the same way, beside a real hour of 33.0).
- **Clip flips are not down to 2 watching.** What is left is not a routine thrashing: each is a hand-off
  (`brush_pass`, 0.6 s) or a stumble (0.8 s) between two bare stands, in a scene the plan runs at up to 1.8×, which is
  three changes of clip inside a second by the counter's rule.
- **Speed steps came back, one to three a run** (0 before): a walker given a new order while it leans sideways, or
  taking the kink where a step meets the lane. Each is one frame of about a centimetre.
- **One or two walk-throughs are left on some runs**, as a counted last resort: two walkers dead in line in the
  corridor between a counter's keeper and the wall, neither with anywhere to step, held for six seconds.
- **Inside a solid** is noisy: zero on some runs, forty frames on others. The fixed ones of the baseline remain
  (the lane's own arc through a post at the projects' corner, the edge of the docks' hatch beside the lane, the AMMO
  board); the new ones are a lean or a step aside carried into the edge of something.


**A hold-up as one action** (the owner: it should read as one move; he counted about 8 s between the scene starting
and the hands going up). The feed lists walk, hold_up, hands_up, pat_down, grab, run as six steps; the city's own
robbery (`stage/vignettes.js` `robSeen`, `shotScene`) plays them as beats of one. Followed in `director.js`:
- a scene whose first step is somebody coming to somebody STARTS (names up, the camera's cut) when the two are within
  7 m, not while the comer is a street away. The comer walks in on their own trip meanwhile; the hour is no longer;
- the hands go up 0.45 s into the draw (the city's figure), not after the hold-up has been held; the gun is held one
  beat of `aim_hold`, to its first seam, comes down by `aim_lower` there, and the robber steps in at 3.2 m/s (the
  city's robber) for the grab;
- the pat-down just before a grab by the same hand IS the grab: it is not a pause of its own;
- the getaway is set going and the scene is over (trade e).

**The hour's length: what each trade bought** (`director.js` `TRADES`, each on or off by a letter of `?trades=`).
One watch run each at 2× (13 hours, seed 4, the stage's own seconds), every trade on, then one switched off at a
time. The same build run four times at 1× gave medians from 19.2 to 20.2 s, so a difference under about a second
here is not a finding. "Bought" is how much longer the mean hour is without it.

| Trade | What it is | Bought (mean hour · longest hour) | Kept |
|---|---|---|---|
| a | nobody's hour waits for someone still walking in to do a thing ALONE (a rest, a text): it is played when they arrive. Never the player's own | 0.5 s · none | yes: it is also why someone going home to sit no longer runs there |
| b | a newcomer goes straight to the person they came to see, not to a spot of their own first | nothing measurable (−0.8 s) | yes, for the look of it: one walk, not a walk and a shuffle |
| c | an extra comes on from 6 m up the sidewalk, not 11 to 15 | 0.6 s · none | yes |
| d | the run at 6 m/s, not 5.2 | nothing (+0.3 s the wrong way) | NO: a third faster to look at, for nothing |
| e (found) | the walk OFF at the end of a scene (the getaway, the limp home, the box carried off) is set going and not waited for | 4.6 s · 14 s | yes: by far the largest |
| f (found) | whoever is only NAMED in a scene from another block (the far end of a call) is not held by it, and their own scenes do not queue behind it | 1.1 s · none | yes |
| g (found) | the next buyer walks up while the one before is served | 1.6 s · none | yes |

The player's own walk: paced to arrive in about 8 s (a walk when that is enough, up to a run), and the hour does not
end while they are on their way (`director.js` `ownWalk`, and the wait at the end of `playHour`). Measured in play:
the player was still walking at the end of 0 of 13 hours. Someone bound for the clinic or the pen is not waited for.

**Not done**
- The cruiser, the muzzle flash, the bills (the city's `stage/props.js`, `stage/cruiser.js`): they want its stage's
  context.
- The camera's side of a mark. A cut-in still looks down from high up, through a signal's arm as often as not.
- A second robber who is still walking in when the hour's 13 s are up never takes part (`CURFEW`, as before).
- Someone bound for the clinic still lies down where they stand at the scene's end and limps there after: the
  staged pick-up is another builder's.

## The big city (2026-11-12): real places, loading by place, travel as a cut

The game left the 3×3 set and plays at the city's own places (SPEC section 25). What that leans on in the pinned city,
and what had to be written beside it.

**Read from the city, never typed** (`demo/tools/place-table.mjs` → `demo/stage/places.json`):

| What | From |
|---|---|
| where a place is | `sim2/places.json` (`trailer`, `plaza`, `corner--1_1`, `park`, `docks`, `police`, `jail`, `hospital`) |
| a fixture's box | the city's own audit build of the block: `jobs.js` `jobBlock({ i, j, audit: true })` → `res.audit.list`, every piece by id (`-2_1·market·stall·4`, `4_-1·forecourt·bench·0`, `2_-8·quay·mooring·0`, `1_-1·precinct·structure·0` …) with its box |
| where people stand | the published spots of `simstate/stands.json`, then `simstate/stands.js` `makeStands()` asked at our points (kind `hangout`), as `demo/tools/set-stands.mjs` did for the set |
| the ways in and out | `world/export/world.json`: `graph.walk` (the nearest sidewalk edge with `side` 1), `graph.road.lanes` and `kerb` (the kerb point), `transit.stations` (the nearest stairs) |
| the ten homes | `sim2/places.json` `lots` with `tier: 'trailer'` (x, z is the front door), framed by `interiors/city/frame.js` `lotEntry()` from the block's `anchors.lots` |

The hospital has no published stand spots and neither the night market nor the bar is a place of the city's list: the
maker is asked there. The city's own spots for `corner--1_1` are ON the night market's corner apron (`strip-jay.js`:
"the corner apron stays open: the sim's corner hotspot stands there"), so the game's corner and its market are one
lot, eight metres apart.

**The pads are trailers.** `interiors/city/index.js` `createHomes()` already opens a lot (`kind: 'lot'`, tier
`trailer`: layouts `trailer-fresh-start`, `trailer-trap`, `trailer-nans-place`) with the same cutaway it opens a
walk-up flat with. `demo/stage/set/pads.js` asks for the layout by the home's own tier; nothing else changed.

**Loading by place** (`demo/stage/loader.js`). `stream.setUniverse(blocks, 'section')` may be called again and again:
it frees every block that is not in the new list (`hide(r, true); blocks.delete(k)`) and keeps the ones that are.
Two things the stream cannot do by itself:
- *Build somewhere the camera is not.* It builds by distance from its one camera. `loader.prepare(zone)` therefore
  repeats two pieces of `stream.js` for blocks the camera is nowhere near: `build()`'s job
  (`pool.exec({ type: 'block', i, j, night, audit: false, flags })`, with `main.js`'s `FLAGS` read off the page's own
  query) and `store()`'s cache records (`<d|n>:far|mid|full|cm:<i>,<j>` through `city.cache().put`). When the camera
  cuts over, the stream's own `runBlock()` finds them in the cache. If the pinned stream changes its records, this is
  the one place to change with it.
- *Say that a place can be walked.* `stream.settled()` says the picture is whole. The walkers' lanes arrive with a
  block's mid tier (`peds.sim.lanes`), and the collision world (`camera/world.js`) builds its 0.25 m columns a block
  at a time in a worker AFTER the block: `world.ready(x, z)`. A walk planned before that goes through walls, so the
  cut waits for both (`loader.standing`, `loader.solid`).
- A ring round a place on the shore reaches over open sea, which is no block: a universe is always filtered by
  `main.js` `worldBlocks()`. Without that the city reports every such block as a failed module, in red, on the page.

**Walking where there are no lanes.** The pedestrian lanes run round blocks. Sunny Acres, the night market's lot, the
park, the plaza, the docks' ring and the island's yard have none inside, and the city's own stand spots there have
`entry: null`. `actors.js` `findWay()` finds the way over the ground (a 0.4 m grid of the collision world, shortest
way, pulled straight), for the steps on to and off a lane and for a walk with no lane at all. And a lane stretch the
city's geometry returns broken by a metre or more (`movement.geomOf` on a stretch walked against the ring past a
dealing corner's ramps: 8.7 m at the night market) is not walked: the way is found over the ground.

**The time of day.** With the set gone nothing of ours is lit. The city places its own lamp light on its own lamps
(`main.js` `placeLamps`) wherever the camera is, once `prelight.js` has compiled the term in.

**What the cut waits for, and what was done about it.** With every block of the night market's zone already in the
cache the cut still waited 2.3 s. Three things, each measured apart:
- the stream's own `settled()` also waits for the full bodies of the city's standing figures (the roof party, the
  yard's lifters), re-baked in a worker on every visit: 0.7 s there. `loader.standing()` asks the block records
  instead (`want`, `shown`): the figures come in a moment after the cut.
- the collision world copies a block's quads to its worker 8,000 a frame (`world.cfg.copyQuads`): 1.4 s for that zone's
  three blocks. The picture is black, so the budget is lifted for the wait and put back.
- the stream uploads 2 M vertices and 6 ms a frame (`R.uploadVerts`, `R.uploadMs`): lifted the same way.
After that: 0.3 to 0.5 s.

**Measured loads** (`node demo/tools/place-loads.mjs`, headless Chrome 1600 × 1000, this Mac Studio, 2026-11-12).
Seconds. "ahead" is the build `loader.prepare()` does while a departure plays (it has 3.2 s on foot); "cut" is what
the picture then waits, black. The first row is the page's own start.

| Zone (places) | blocks | 8 workers: cold at the cut | warm at the cut | cold: ahead + cut | 3 workers: cold at the cut | warm at the cut | cold: ahead + cut | MB data / GPU |
|---|---|---|---|---|---|---|---|---|
| projects (the start) | 35 | 5.3 | 2.1 | | 7.0 | 1.9 | | 187 / 178 |
| market, corner, bar | 34 | (see below) | 0.41 | 3.03 + 0.52 | 4.31 | 1.61 | 6.70 + 1.14 | 291 / 311 |
| uptown, precinct | 30 | 3.08 | 0.26 | 2.38 + 0.26 | 5.55 | 0.44 | 5.02 + 0.42 | 287 / 283 |
| park | 25 | 1.01 | 0.17 | 0.71 + 0.18 | 1.78 | 0.22 | 1.65 + 0.21 | 81 / 89 |
| docks | 15 | 0.87 | 0.11 | 0.71 + 0.10 | 1.38 | 0.14 | 1.41 + 0.14 | 42 / 48 |
| jail | 12 | 0.42 | 0.09 | 0.29 + 0.10 | 0.57 | 0.14 | 0.53 + 0.13 | 27 / 35 |
| clinic | 25 | 1.99 | 0.32 | 1.59 + 0.31 | 3.50 | 0.69 | 3.25 + 0.65 | 202 / 206 |

- The market zone's "cold at the cut" at 8 workers was not measured clean: the season's own first trip goes there and
  had built it ahead before the tool's pass began (the 0.41 it printed is a cut after a build ahead). At 3 workers the
  same trip's build was not done when the departure ended, and the 4.31 s is the whole wait.
- At 8 workers a 3.2 s departure covers every zone's build. At 3 workers it does not cover the two downtown zones
  the first time (5.0 and 6.7 s): the cut waits two to three and a half seconds, black, once per zone per browser
  profile. A ride of seven seconds or more would cover it.
- Memory: the city's own count for its stream (`stream.memory()`), after each cut. Round the zones a second time it
  is the same to within a few MB (market 271 / 320 → 269 / 303, uptown 238 / 286 → 236 / 274, the rest unchanged):
  nothing is left behind. The whole city, loaded at once, was 1,263 / 671 MB on this machine.

**A season on the real city** (`node demo/tools/stage-run.mjs --mode watch|play --seed 4 --speed 1 --hours 13 --audit`,
headless Chrome 1600 × 1000, 2026-11-12, the head of `big-city`). Both end `stage-ok` with no page error, at 59.6
frames a second on average (the worst single second: 4 watching, 2 playing; which second that was is not recorded: a cut's load is the likely one).

| | watching | playing (the dealer's seat, on auto) |
|---|---|---|
| the run on the wall, 13 hours | 185.7 s | 198.7 s |
| each hour on the stage's own clock, s | 11.3 11.8 9.1 11.7 5.1 19.0 4.7 11.1 14.5 22.9 19.5 7.4 9.0 (157.1) | 11.3 18.7 18.6 2.9 9.2 15.7 18.2 10.8 17.6 28.7 17.2 8.8 1.8 (179.5) |
| last night, on the 3×3 set | 265 s | 222 s |
| the followed person's trips by cut | 11: 3.2 s of departure, 0.10 to 0.48 s black, then walking in | 7: the same, 0.28 to 0.48 s black; and one jump of 2.0 s (below) |
| scenes staged, and started | 28, 28 | 39, 39 |
| scenes at a place that was not loaded (not staged) | 95 | 3 |
| people standing in a road (`inRoad`) | 0 | 0 |
| frames somebody on foot was inside a solid (`through`) | 0 | 0 |
| somebody walked through somebody (`squeezes`) | 0 | 0 |
| pairs within 0.6 m for half a second (`close`) | 2 | 5 |
| furniture clips off their furniture (`unseated`, frames) | 0 | 0 |
| jumps, pops, seams in a route | 0, 0, 0 | 0, 0, 0 |

- The 2.0 s jump: the player is robbed at home and taken to St. Mercy, and the panels hurry the held hour by half a
  second later. The zone they are let out into (the bar's) started building when they were taken away, 5.5 s of work
  beside St. Mercy's own on a cold cache, and was not done.
- Watching follows ONE person, the first seat until another is asked for, and only their zone is staged. Of 123
  scenes in thirteen hours 95 were somewhere else: told by the panels, not seen. Playing, the panels only pass what
  the player's agent witnessed, and 3 of 42 were somewhere not loaded.
- What is still slow inside an hour is not the travel. The robber's grab after a hold-up takes 4.4 to 6.9 s at Sunny
  Acres and the night market (2.6 s at the corner): not looked into. A row of street buyers at Glasswall Plaza queue
  behind each other on the one lane they come on by (an hour of 28.7 s playing). At the docks the pier is behind a
  row of solids, a 17 m walk round from the ring, and the smuggler's hour waits its eight seconds for it.

## The big city, round 2 (2026-11-12, afternoon): the rides wired in, a press, room for an attack

SPEC section 25, items 7 to 10. What it leans on, and what it measured.

**The rides go through the one seam** (`demo/stage/travel.js` `useRides(rides, { cab })`; the scenes are
`demo/stage/rides/`, whose README has their own notes). `travel.choose(actor, from, to)` asks `rides.modeFor` and
changes its answer in three cases: somebody taken away (to the jail or the clinic) goes by the plain cut; somebody let
out of the jail walks off and arrives at the precinct on foot (Iron Island has no street, no stairs and no lane of the
city's to ride from); and a wheeled ride at an end with no walkers' lane within 9 m is made on foot at that end.
- *Leaving.* The followed person's departure is the ride's own `leave`: the picture fades as it resolves (`{ cut }`).
  Somebody else's plays in view; the hour does not wait for it past 14 s.
- *Between.* For the followed person on the subway, the city's carriage scene (`rides.between`, `subway/carriage.js`
  opened over the city, six seconds) while the new zone builds under it; then a beat of black and the walk in.
- *Arriving.* The person's spot is claimed first and handed to the ride (`spot`), so two arrivals never get one mark.
  A bench seat is arrived at 0.75 m in front of it and sat on from there. `rush`: a scene is waiting for them (they
  start no farther back than 14 m, and run where the way is a straight one).
- *Cut short.* `travel.cancel(id)` (a held hour, a scene that takes them, a new trip) ends a running scene: the
  ride's `cancel` clears its vehicle and props.
- The city's pieces the rides call are listed in each ride's header. Added on the actors' side for them and for the
  scenes: `actors.groundWay` (the length of a way over the ground), `wayRound` (its points, or null when the straight
  line is free), `nextTo` (who stands within a radius), `passing(id, ids)` (bodies a walk does not wait behind: the
  neighbours of the spot it is going to, or of the one it is leaving), `meeting(id, other)` (the one a scene's walk is
  TO).

**A walk does not wait behind the neighbour of its own destination.** The city's rule for a walker is to stand
behind a body in its way, and after two seconds pass it on a shoulder's width. On a bench with somebody on the next
seat, or leaving a spot between two stall keepers, the "body in the way" is the person next to where the walk ends or
starts: an arrival at Pleasantview Park took 17.6 s, and 10.1 s in a second run with three seconds stood 0.7 m behind its
bench neighbour (the rides' walk gives up after its length plus six seconds and sets the person down). After:
7.3 s. `actors.passing` names those bodies for the walk (director `walkLeg`, `toOpen`;
rides `kit.walk`).

**An attack gets room** (director.js, "an attack gets room"):
- `brief(plan)` reads the hour's scenes before any trip: who an attack (`hold_up`, `shoot`, `grab`, `punch`,
  `haymaker`, `shove`, `scuffle`) is done to, and where. `openGround(x, z)` is the nearest standing spot of the zone
  within 14 m with nothing solid within 2.8 m (`clearAt`: the collision world asked every 0.4 m round rings out to
  4 m; twelve samples a ring looked past a lamp post), not on the walkers' lane where there is other ground, and not
  behind somebody standing in the straight way to it.
- Whoever is there walks to it at the top of the hour (`toOpen`); whoever arrives that hour is set down on it. The
  attacker sets off after them at once (`after`), to a few steps short of where it will happen.
- `clearRoom` moves everybody with no part in it out of a ring (3.6 m; a gun's distance and 1.5 m more for a
  hold-up or a shot) to a free spot outside it, or straight out, and turns them to watch.
- The grab after a hold-up is on the axis the two already stand on when the ground allows it (`markFor`: the second
  mark of a pair is not turned side-on to the camera). Before, it was a walk round the very person held up.
- A scene whose first step is somebody coming to somebody waited until the two were within 7 m, for up to its whole
  patience (8 s). On a set of nine blocks two people on one place were never that far apart; at the night market two
  who both stand in the yard are. The wait is now only for somebody who is on their way.

**The press** (`demo/hud/index.js` `askMove`, `confirm`; `demo/stage/index.js` `take`, `cutLead`). The hour that gets
the player arrested or hurt no longer travels: the stage leaves them at the scene and prepares both the held place's
zone and the zone they will be let out into. The panels' card stands until Continue; the press calls
`stage.take(id, 'jail' | 'clinic')`, a cut through `cutLead` (fade, zone, settle, camera, fade in). Words added to the
panels: "You are under arrest", "You are hurt", "Continue takes you to the jail.", "Continue takes you to the
clinic.", "Continue for the next hour."; the button "Carry on" is now "Continue" and the toggle "Hold here" is now
"Stop at each hour" (its other state, "Let the hours pass", is unchanged).

**One bearing** (`demo/stage/camera.js`). The Lock's bearing is 90° at every place; a place's own front is still
what its wide shot faces. `camera.cutTo(view)` is the one way the loader's cuts move the camera, and
`camera.arrived()` (after every zone change and arrival) drops a glance and the viewer's hold and puts the Lock back
on the followed person. The see-through block is untouched.

**Measured, round 2** (headless Chrome 1600 × 1000, this Mac Studio, 2026-11-12 afternoon, seed 4, 1×; the seasons
by `node demo/tools/stage-run.mjs --mode watch|play --hours 13 --audit`, the code of commit `4030256`). Both seasons
end `stage-ok` with no page error at 59.5 frames a second on average (the worst single second: 5 watching, 4
playing).

*The robbery the owner played* (seed 4, the dealer's seat: walk to the market, walk again, Bea holds you up; a
scratch probe that clicks the panels and reads the stage every half second):

| | before (the coordinator's run of the round-1 head) | now |
|---|---|---|
| the hour of the hold-up, on the stage's clock | 23.5 s | 11.1 s (three runs: 11.1, 11.2, 11.2) |
| its steps | | the walk up 2.3 to 2.8 s, the gun 1.3, the pat-down 0.9, the grab 3.1 to 3.4 |
| who is within 2 m of the two while it plays | it was played in the picnic yard among the tables (the coordinator's frames; not counted) | nobody (a bystander 1.4 m off is walked out at second 3) |
| pairs within 0.6 m (`close`), frames in a solid (`through`) | | 0, 0 |
| the clinic on screen before the next menu | about 1 s | until Continue is pressed, twice: at the market, then at the clinic |
| the camera after the clinic | held by the viewer (`user: true`), the player off centre | on the player, centred, bearing 90° in every frame |

*A season, against round 1* (the same tool and seed):

| | watching: round 1 | now | playing: round 1 | now |
|---|---|---|---|---|
| the run on the wall, 13 hours | 185.7 s | 214.6 s | 198.7 s | 212.9 s |
| the 13 hours on the stage's own clock | 157.1 s | 191.2 s | 179.5 s | 185.5 s |
| each hour, s | | 16.8 14.3 14.7 16.1 11.3 23.5 4.7 9.1 15.8 19.5 22.9 13.5 9.0 | | 11.2 18.6 12.7 1.6 6.0 22.3 22.8 15.5 16.1 23.7 20.0 13.2 1.8 |
| scenes staged / at a place not loaded | 28 / 95 | 28 / 95 | 39 / 3 | 39 / 3 |
| pairs within 0.6 m for half a second (`close`) | 2 | 1 | 5 | 3 |
| frames somebody on foot was inside a solid (`through`) | 0 | 0 | 0 | 0 |
| somebody walked through somebody (`squeezes`) | 0 | 0 | 0 | 0 |
| people standing in a road (`inRoad`) | 0 | 1 | 0 | 1 |
| furniture clips off their furniture (`unseated`, frames) | 0 | 0 | 0 | 13 |
| jumps, pops | 0, 0 | 0, 0 | 0, 0 | 0, 0 |
| seams in a route (`seams`) | 0 | 21 | 0 | 9 |
| frames somebody floated over a road (`floating`) | 4 | 20 | 0 | 8 |

- The watched season is 34 s longer on the stage's clock: the followed person's six subway trips each carry six
  seconds of carriage, and their arrivals are walked to the spot before the hour's scenes start.
- `inRoad`, `floating` and nearly all `seams` are at the dealing corner (−40 to −42, 33 to 40), whose walkers' lane
  dips into the roadway on its ramps. The audit's examples: the followed person rolling in on a skateboard 0.16 m
  over the road at (−40.2, 33.3); a2 standing once at (−42.1, 34.3), which the city's map calls roadway; and lane
  routes of 110 to 116 m that leave the corner with a break of 0.4 to 0.5 m in the city's own geometry 3 to 10 m in
  (a walk off toward a way out). One seam of 1.2 m is at uptown (−31.2, −13.8). No jump was counted at any of them.
  Whose arrival put a2 there was not traced. Not fixed.
- `unseated`: 13 frames, one example: a street buyer at Glasswall Plaza in the sitting clip at (12.5, −6.4), on no
  bench spot. When in the season, and what moved them, was not traced.

*The followed person's trips* (the two seasons above; seconds):

| | 8 workers | `?workers=3` |
|---|---|---|
| black at the cut, the zone built under the ride | 0.12 to 0.54 (0.90 once: corner to docks at the top of an hour with no departure) | 0.14 to 1.60 |
| black at the plain cut to the clinic (taken away: no ride covers it) | 0.35 | 3.73 |
| the carriage: from the cut to the car on screen | 1.1 the first time, 0.33 to 0.38 after | 3.9 the first time, 0.33 to 0.37 after |
| a subway trip, setting off to standing at the new place | 8.4 to 15.5 (eleven trips) | 8.4 to 15.1 |
| a skateboard trip | 7.4, 13.4 | 7.4, 14.3 |
| a hop on foot inside one zone (bar to market) | 6.0 | 6.1 |

*Halves of trips played, by ride* (leaves + arrivals; "followed" is the person the camera cuts with):

| | watching | playing |
|---|---|---|
| subway, followed | 6 + 6 | 6 + 5 |
| subway, somebody else in view | 10 + 11 | 14 + 14 |
| scooter | 1 + 3 | 1 + 0 |
| skateboard | 2 + 3 (all followed) | 0 + 1 |
| on foot | 2 + 2 | 5 + 4 |
| the plain cut (taken away, or let out of the jail) | 4 | 2 |
| scenes cut short (`rides.cancel`) | 15 | 12 |

- By `rides.modeFor`, asked for every pair of places: the subway between the projects and the market or the corner,
  the market and uptown, uptown and the park, the docks and the precinct, the bar and the precinct, and from the
  clinic to the bar; the scooter or the skateboard only between the corner and the docks and between the bar and
  the park; the bar, the market and the corner are hops on foot. Nobody takes a cab unless `?cab=1` asks for it.
- One trip at a time, the stage's clock (`stage.trip`, seed 4, bar to park or precinct, others standing at both
  ends): subway 12.1 s (off 3.2, carriage 6, in 2.4); scooter 15.9 (to the kerb and off 5.7, in and to the spot
  8.5); skateboard 11.5 (2.6, 7.1); cab 10.6 (3.5, 5.3); at 2× the subway trip is 6.3 s on the wall, at 4× the
  skateboard trip 3.7 s. Somebody else arriving by scooter while the camera stays at the bar: 15.3 s, the first eight
  of them out of the picture.
- A skater who rode in leaves on the board they left lying (it is theirs: no second board appears, one lies where
  they arrive). A ride cut short by the jail (`stage.take` in the middle of a skateboard departure) leaves no board,
  scooter or cab behind.
- The attacks of the two seasons: the armed robbery at the corner 9.3 s (6.8 in round 1; the walk up is 5.0 s
  where it was 2.7), at Sunny Acres 12.3 s (14.6), the unarmed one at Sunny Acres 14.9 s (14.3; traced: the first
  four seconds are the victim's walk to open ground 6.5 m down the lane, and the two people of a pick-up played at
  the same time stand 2.2 to 2.6 m from it), the shot at the night market 13.7 s (17.0).

## The big city, round 3 (2026-11-12, later): nothing squeezed, the carriage as the city drew it, a Skip

SPEC section 25, item 11. The owner, on the first subway trip of the joined build: "on the subway our guys just fall
over sideways", "goes way too fast", "right before he got on the subway the gamef froze", "the game glitched out on
the cut scene".

**Why the riders fell.** The carriage is the city's own (`subway/carriage.js`), driven by a ride program
(`subway/net.js` `programOf(net, legs, spm)`, `spm` the page's real seconds for a game minute: "2.5 live, 60 on the
record") and a clock. It leans each standing rider 0.03 rad and tips its car 0.0015 rad for every m/s² of the car's
acceleration (carriage.js `e.lean`, `car.rotation.z`), and `stateAt()` gives a run whatever acceleration covers its
metres in its seconds. The wiring asked for the program at `spm` 1 and then ran it 4× to fit six seconds. Computed
for the owner's trip (Sunny Acres' stairs to the night market's, the same modules in the page):

| | the program | hardest acceleration | a standing rider leans | the car tips |
|---|---|---|---|---|
| before | ELM ST 8.9 s, ELM ST to SUNNY ACRES 60 m in 3.0 s, SUNNY ACRES 9.1 s (a change of line), SUNNY ACRES to FIT ST 127 m in 3.2 s: 24.2 s, played in 6 | 51 m/s² | 87° | 4.4° |
| now | SUNNY ACRES to FIT ST alone, 127 m in 10.9 s (`m / line.speed + 3`, net.js's own nominal for a run); its last 8 s are shown, at 1× | 4.3 m/s² | 7.3° | 0.4° |

Nothing of the city's is changed or held upright from our side: at its own pace the scene is calm (frames every
quarter second through the braking: everybody on their feet, the car level).

**What a followed subway trip is now** (`demo/stage/index.js` `voyage`, `demo/stage/travel.js`, `rides.between`):
the departure at the rides' own pace (`haste` 1); black (0.35 s of fade); the carriage opens OVER the black
(`fade.under`: the veil goes to z 6, under the carriage's z 7) and plays its eight seconds with nothing else going
on; it closes on to black; the zone is changed under the black; the arrival, and the picture comes up on it. The
place they left is never under anything that opens.
- *The freeze*: one frame of 333 to 350 ms as the carriage first opened and the zone changed under it, with the
  loader's budgets lifted or not (`?slowcut=1`: the same 333 ms). Two things were changed together and it is gone:
  the carriage's stage (its renderer, car and shaders) is made at load by the city's own `prewarmCarriage()`, and
  the zone change no longer runs under a moving carriage. Which of the two it was, was not measured apart.
- *The old place coming back*: the city draws nothing while the carriage covers it, so when the carriage closed the
  canvas still held the last frame of the place they left, and the fade to black started from it.

**Skip** (`stage.skipTravel()`, `stage.onTravel(fn)`, `stage.travelling`; director `skipTrip`, `riding`). Each trip's
`actor` carries `skipping`, a promise the skip resolves: `travel.leave` and `travel.arrive` race their ride against
it, the stage closes the carriage on it, and an arrival not yet begun is asked for `hurried`. The panels show a
"Skip" button on the card's top line while the player's own trip is on the picture; Space or Enter skip it when no
menu is up (with a menu up they are the menu's, and Space is the pause again once the trip is over); the carriage's
own Esc or × counts as a skip. Words added to the panels: "Skip" (the button), "Skip the trip: you are there at
once" (its tooltip).

**Measured, round 3** (headless Chrome 1600 × 1000, this Mac Studio, seed 4, 1×).

*The owner's trip* (the dealer's seat, the first move "walk to the market": by subway from Sunny Acres; a frame
every quarter second and every gap between frames over 50 ms):

| | before (`b3dedee`) | now, 8 workers | now, `?workers=3` |
|---|---|---|---|
| from the press to the next menu | 15.5 s | 18.6 s | 21.3 s |
| the departure, to black | no black: the car opened over the trailer park, and the zone changed 4.75 s in | 3.55 s | 3.54 s |
| black before the car is on screen | none | 0.35 s | 2.75 s (the city bakes the riders in the page's build workers; what held them was not traced) |
| the carriage | 6 s of a 24 s program at 4× | 8.5 s at 1× | 8.5 s at 1× |
| black after it | about half a second (9.75 to 10.25 s), after the trailer park had shown again at 9.5 s | 0.54 s, the zone changing | 0.86 s |
| gaps between frames over 50 ms | one: 350 ms at 4.56 s | none | none |

In a real window (the same Chrome, not headless, its own throwaway profile: `HK2_WINDOW=1`), 8 workers: 4,316
frames in 18.5 s, no gap over 50 ms.

*Skipped* (the same trip; "standing" is the person at the market, on stage, the picture up, the Lock on them at the
middle of the screen, and the next menu was then answered with a real Enter each time):

| skipped during | by | standing after |
|---|---|---|
| the departure, 1.5 s in | Space | 2.0 s (the fade and the zone, which was still being built) |
| the carriage, 6.5 s in | the carriage's Esc | 0.6 s |
| the carriage, 6.5 s in | the Skip button | 0.7 s |
| the arrival, 14.5 s in | Enter | 0.1 s |

*One trip each at the new pace* (`stage.trip`, bar to park, others standing at both ends): scooter 18.4 s (to the
kerb and off 6.1, in and to the spot 10.5; it was 15.9 s at `haste` 1.45); skateboard 14.3 s (2.6, 9.9; it was 11.5).

*The seasons* (13 hours, `--audit`; both `stage-ok`, no page error, 59.4 and 59.5 frames a second on average, the
worst single second 1.9 and 1.8):

| | watching: round 2 | now | playing: round 2 | now |
|---|---|---|---|---|
| the run on the wall | 214.6 s | 242.5 s | 212.9 s | 229.5 s |
| the 13 hours on the stage's own clock | 191.2 s | 219.0 s | 185.5 s | 198.5 s |
| each hour, s | | 20.6 17.6 17.7 16.8 14.4 28.3 4.7 11.4 18.3 17.8 25.8 16.6 9.0 | | 11.3 18.5 12.7 1.6 6.7 26.2 26.5 19.5 16.1 22.8 18.6 16.2 1.8 |
| a followed subway trip, setting off to standing | 8.4 to 15.4 s | 11.5 to 19.5 s | 12.7 to 15.5 s | 15.7 to 19.5 s |
| black at the zone change | 0.12 to 0.54 s | 0.13 to 0.52 s (0.94 once) | 0.27 to 0.48 s | 0.28 to 0.45 s |
| `close` | 1 | 1 | 3 | 5 |
| `through` (frames) | 0 | 9 | 0 | 0 |
| `squeezes` | 0 | 0 | 0 | 0 |
| `inRoad` | 1 | 1 | 1 | 1 |
| `unseated` (frames) | 0 | 0 | 13 | 13 |
| jumps, pops | 0, 0 | 0, 0 | 0, 0 | 0, 0 |
| `seams` | 21 | 21 | 9 | 9 |
| `floating` (frames) | 20 | 17 | 8 | 8 |
| watched departures taken off after 14 s (`capped`) | 2 | 2 | 0 | 4 |

- The watched season is 27.8 s longer on the stage's clock and the played one 13.0 s: the carriage is 8.5 s where it
  was 6, and every ride's walks are at 1.5 m/s where they were at 2.2.
- `through`, 9 frames watching: the robber at Sunny Acres (hour 6, the unarmed robbery) in a solid 1.2 m high at
  (−232.5, −55.4). Traced: their last walk ends at (−232.3, −55.4) and the next order finds them at (−232.5, −55.4),
  with only the punch and the fall between. Not fixed.
- `close` 5 playing: three of them are the street buyers at Glasswall Plaza queueing on one lane (round 1's note).

## The big city, round 4 (2026-11-12, night): after the first whole season played

SPEC section 25, item 12. The coordinator played sixty hours on the published build
(`node demo/tools/stage-run.mjs --mode play --speed 2 --seed 4 --hours 60 --audit`): `stage-ok`, and seven things to
fix. What each leaned on in the city, and what was done.

**Night.** The city lights its night with the lamp light of the twelve street lamps nearest the camera
(`render/night.js`: `LIGHT.night.place(points)`, one colour and strength for all, 15 m reach, decay 1.4, lamps
5.4 m up; `main.js placeLamps`). Glasswall Plaza's middle, the night market's yard and all of Sunny Acres have no
lamp, and people there were dark shapes. `demo/stage/set/light.js` already took the last slot for the open pad's
lamp; `setKeys(points)` now takes up to four for KEY LAMPS, put with the city's own whenever either moves. The stage
(`demo/stage/index.js`, "by night, whoever the picture is about stands in lamp light") keeps one over the followed
person, or over the middle of the scene they are in when its people are within 4 m, and one over each other scene
playing on stage: 4.2 m over the ground, 2.4 m toward the camera. Nothing of the city's light is changed: the same
lamp light, in places the city has not put a lamp. The city's ONE SPOT (`LIGHT.night.spot`, Fit Street's billboard)
is left alone. The other builder's see-through was not looked at by night.

**Water.** The city's collision world keeps a body out of what is at its waist. The plaza's basin is a step of
0.3 m (paving 0.3, water 0.6, rim 0.8 by `world.topAt`), the pond is level with its lawn, and the city's surfaces
call both walkable; neither is a piece of its audit build (the plaza and the park are one `placeholder·structure`
each) and its water field (`water.js`) is the sea's. A rule on heights alone was tried and taken out: "a low island"
took every standing spot of Pleasantview Park (its walks are 0.3 m over the lawn), and "a basin" came out different
from one page load to the next. So `citymap.js` `WET` is three measured boxes, handed to `actors.addSolid`: no
spot, no mark of a scene and no way over the ground is in them. The hero file's own numbers for the pond
(`heroes/suburbs-park.js`) are in another frame: a person put at them stands on the sidewalk by the playground.

**The street sale.** Every extra with a scene was brought on at the top of the hour and SENT, at a run, to the free
spot nearest whoever its scene is with: four buyers at arm's length round the seller. Now (`director.js` `queueUp`,
`served`, `wings`): each buyer comes on at their own point (by their number: alternate sides, 1.6 m further out
each pair), the first goes to the seller as before, the others to a mark 2.6 m from the seller and 1.25 m more for
each place in the line, facing them; the scene's own "the next one comes up while this one is served" brings each
to the seller at their turn; and a buyer with nothing more to do that hour walks off along the sidewalk as soon as
their hand-off is done. And a bench seat within 1.6 m of a named counter spot is nobody's (`stands.js`): Glasswall
Plaza has no shop, its shopkeeper stands at a bench, and the dealer was given that bench's seat.

**Walked through.** Two causes found. A step to a person's own seat or lean point is `exact` (walked to as it is,
0.2 m off its wall), and was asked for from wherever they stood: eight metres through a stall and a building's
corner at the night market. `actors.stepTo` now finds the way round for an exact point more than 1.2 m off whose
line is not free, and only its end is exact. And somebody who is SITTING was asked to "step to clearer ground" for
another's mark (`markFor`), and slid along the bench still sitting: the audit's `slide` and `unseated`.

**The dealing corner's lane.** `movement.geomOf` returns the lane past the corner's ramps with a break of 0.4 to
0.5 m (the lane dips into the roadway there). `routeTo` already refused a lane route broken by a metre; it now
refuses one broken by 0.2 m, or one nearly twice as long as the straight line (`> straight × 1.8 + 12`), when the
two ends are within 60 m, and lays the walk over the ground (`findWay`, where a roadway costs double). The walks
that left the corner were 107 m of lane round the block to somewhere 45 m off. And a walk in (`rides/foot.js`)
never starts on a roadway.

**A watched departure at its cap.** Somebody leaving while the camera stays was taken off stage after 14 s
wherever they were: at the rides' own pace a walk toward a station 80 m off is still in the picture then, and they
vanished in plain sight. They now walk on until they are out of the picture (30 s more at the most);
`travel.count.capped` counts only those cut while the camera could still see them.

**What else was found on the way** (each from the audit of a sixty-hour run; `through` now says which way the body
was on, with its legs):
- *A walk taken up again after giving way was one straight line to its end* (`stepYield`): somebody who had stepped
  aside for a walker went straight to where their way over the ground ended, through what the way had gone round:
  eight metres through a stall and a building's corner at the night market. It is laid again as a way.
- *A way over the ground was pulled straight through thin things on its middle legs* (`findWay`'s tail of 0.45 m,
  meant for the place at the END of a way, was left out on every leg): a served buyer walked off through a bench's
  end. And the way-finder kept its open cells in a plain list: one search across a street's width of ground held
  the page for over a second (the worst second of one run: 0.8 frames). It is a heap now.
- *The step aside for somebody* (`weave`) went into a mailbox post at Sunny Acres, where no sidewalk's edge holds
  it. It stops where the body's middle would be in a solid.
- *Open ground was handed to two people*, and at the kerb: two robbed in one hour at the bar stood in each other.
  It is nobody else's spot, 2.4 m from open ground somebody else has, 1.6 m from a roadway.
- *A big scene's room filled up again*: somebody set down by a ride after `clearRoom` had run stood 1.4 m from a
  hold-up. The room is looked over before each step of the scene, and no spot in it is handed out while it plays.
- *A robbery was not played*: late in a long hour (`CURFEW`, 13 s) `present()` gave up on anyone still walking, and
  the Dunn brothers' victim was three steps from his spot. A step of an ATTACK done to somebody who is at the place
  waits two and a half seconds for them whatever the hour. A street sale's hand-offs past the curfew are still not
  played, as before ("approach 0.0, hand_off 0.0" in the hour's notes): played, a seller on a bench slid to the
  late buyers and the season was no shorter.
- `stage.debug().notes` keeps eighty hours, so a sixty-hour run has every hour's.

**Measured, round 4** (headless Chrome 1600 × 1000, this Mac Studio; the same command; before: the coordinator's
run of `a692892`; after: `dff57a2`, the head but for the fountain's box, made 0.2 m smaller afterwards):

| | before | after |
|---|---|---|
| the run | `stage-ok`, 0 page errors | `stage-ok`, 0 page errors |
| the sixty hours on the stage's clock | 1,118.7 s | 1,062.9 s |
| frames, and the worst single second | 33,855, 5.9 | 32,206, 2.0 |
| jumps, pops, drops, squeezes, headingSnaps | 0 | 0 |
| `unseated` (frames) | 80 | 0 |
| `slides` | 20 | 0 |
| `pushes` | 49 | 0 |
| `close` | 28 | 6 |
| `through` (frames) | 55 | 15 |
| `seams` | 63 | 0 |
| `inRoad` | 3 | 2 |
| `floating` (frames) | 45 | 39 |
| `waits` (2 s behind somebody) | 50 | 20 |
| `speedSteps` | 4 | 6 |
| `blind` (walked where the collision world was not in) | 277 | 0 |
| watched departures cut in the picture (`capped`) | 13 | 0 |
| `shifts`, `flips`, `brushes`, `dodges`, `rounds`, `gaveWay`, `replans`, `short`, `ways` | 7, 79, 14, 19, 28, 54, 20, 94, 399 | 8, 69, 9, 28, 14, 27, 3, 130, 380 |

- `through` is not zero and differs from run to run of the same season (2, 2, 0, 2 and then 15 frames in the last
  five runs, each a commit or two apart). The five places of the last run: one is the fountain's box itself (0.2 m of paving at
  its corner counted as fountain: the box was then made the rim's size); two are a step aside into a mailbox post
  at Sunny Acres, 2 or 3 frames each; two are somebody knocked back 0.3 m past the end of their step into DEAD
  AIR's front wall.
- `inRoad` and `floating` are still the dealing corner (people and street buyers on its ramps: (−42.4, 35.3),
  (−41.8, 38.7), a skateboard rolling in at (−40.2, 33.3)) and, once, somebody at the bar's kerb (−87.3, 33.4).
- `seams` is 0 because the count is now of routes WALKED: `routeTo` lays a lane route, finds its break and throws it
  away, and those were counted. Walked with a break in the other runs: three routes at uptown, 0.7 to 1.2 m.

*The eight hours over thirty seconds* (the stage's clock; what the time is spent on now, from the hour's notes):

| hour | before | after | what it is |
|---|---|---|---|
| 11 | 37.5 | 28.3 | uptown, two street sales and a guard job. Sale 14.4 (one buyer four times: hand-offs 0.9, 5.2, 2.6), guard 3.1, sale 9.1. The before is not in the log (the tool kept forty hours) |
| 33 | 32.3 | 26.1 | the bar: an unarmed robbery 16.9 (the grab 11.2, was 15.4: the robber's own arrival and walk up), a crew joined 1.6, the Dunn brothers 6.2 (8.2) |
| 35 | 45.5 | 36.8 | the bar: an unarmed robbery 15.7 (grab 9.0, was 7.6), a tip 2.2, a street sale 6.8 (17.2: its hand-offs were 1.7, 3.2, 3.0, 4.7 and are 1.5, 1.5, 3.0, 0.8), a second sale 11.8 (13.5) |
| 37 | 30.7 | 31.8 | the park to uptown: the trip is 23.5 s and the walk to the spot 8. Nothing waits |
| 45 | 36.7 | 33.6 | uptown to the market: the trip 13.9, then a deal closed on the phone 12.8 (the phone step 10.2 s: not looked into), the Dunn brothers 4.8 |
| 48 | 44.8 | 44.9 | the market to Sunny Acres: the trip 13.9, then four pick-ups one after another (9.9, 5.7, 1.9, 6.9), a stash 3.1. All of it is played, one scene at a time on the player's block |
| 55 | 51.4 | 38.4 | the park, two street sales: 27.0 (28.6: the first buyer's walk in 5.3, was 12.8; hand-offs of 4.2 and 7.5 s still wait) and 11.2 (21.6) |
| 57 | 39.1 | 46.9 | the bar: LONGER. A guard job 8.4 (12.3), the Dunn brothers 7.8 (2.1: it had hardly played), a rival's push 4.1 (2.0), two tolls 11.0 and 7.7 (7.6 and 9.3: a bribe of 6.3 s) |

Six hours are over thirty seconds now (35, 37, 45, 48, 55, 57), eight before. What is left in them is the trips,
scenes played one after another on the player's block, the unarmed robber's walk up at the bar, and the hand-offs
of a street sale that wait for a buyer.

## Nobody in anybody, the county orange, blood (2026-11-12/13, branch `jail-1`)

SPEC section 25, item 13. Three things the owner asked for after an arrest and a robbery. What each leaned on in
the city, what was done, what was measured.

**The city's own people.** slime was cut to the jail and sat in an inmate. The cause, measured on the build
before (`6d7be18`): the place table read Iron Island's waiting bench as furniture, "a bench: two seats"
(`place-table.mjs` `seats`), at (289.93, −383.02) and (289.93, −382.18); the yard's hero file
(`heroes/jail-yard.js`) seats the city's own two inmates on that bench, drawn at (289.5, −383.05) and
(289.5, −382.0); the first person held was given the first seat, 0.41 m from an inmate's middle. The stage knew
nothing of such people: they are baked into each block's build (`jobs.js` `castOf` → `charbake.js` `bakeCast`),
are no walker of `pedsim.js` (the crowd our box keeps off the set is the WALKERS) and are not in the collision
world (`camera/world.js` is the blocks' boxes). There are many: 174 in the zone round Sunny Acres, 28 on Iron
Island's.

- *Where they are is read from what is drawn.* Every streamed block keeps its people's far tier on the page
  (`stream.js` `blocks`, `data.cm.far`: per person up to four boxes, feet to hat, eleven numbers each).
  `demo/stage/figures.js` makes one figure of each run of boxes (its middle, feet, top; a giant's body is as much
  wider as it is taller) and keeps them in 2 m cells. Nothing is typed and nothing comes from the place table, so
  a place the table gets wrong, a new room or a re-pinned city is covered the same way.
- *They are solid to the stage* (`actors.addSolid`, the way `WET` is): a body's middle keeps 0.62 m from a
  figure's (0.3 m of its body and `PASS`), so no mark of a scene, no open ground for an attack, no queue mark, no
  fitted counter point and no way over the ground is in one, and the audit's `through` counts a body whose middle
  is in one. A test now gets `(x, z, y, sure)`: somebody on a roof, a fire escape or a bleacher's top plank is
  over nobody's head.
- *No place is given within a body's width of one* (`stands.js` `crowd`, 0.9 m between the two middles: `SPOT`).
  Asked EVERY TIME a place is given, of the blocks as they are streamed at that moment (the first try looked the
  blocks over three times a second at the most, and the place given in the moment after the island's build came
  in was given blind: the same seat again). Also when the zone's spots are looked over (`vet`, which now waits until
  the block's people are known), for the named places (a counter: its taker stands at the nearest free spot),
  and once more when an hour begins for whoever stands still on a place (`director.js` `reseat`, counted:
  `tally.reseated`, 0 in every run below; tried by hand, with the figures hidden for the cut to the jail and
  shown again: the bench seat given blind was taken back at the hour's start, with a `[stage]` warning, which
  fails a `stage-run`).
- *A place that runs out hands out free ground.* Iron Island has ten places and two are the inmates' bench: the
  ninth person held, and every one after, was put on the place's own point, all in one another. `stands.js`
  `spare`: the nearest ground round that point that is 1.3 m from everybody's place and from the city's people
  and that `vet` does not refuse. The same for a block and its neighbours full.
- *And nobody's place is in another's, whichever list each came from* (`stands.js` `clash`, 0.7 m: two seats of
  one bench are 0.84 m apart, everything else 1.25 m and more). Found while proving the above with all ten seats
  held at once (`stage-scene.mjs jail --held 10 --place clinic`): a block's spots, a held place's own and the named
  places are three lists, each a body's width apart in itself and not from one another. St. Mercy's medic stands
  at the forecourt's own point, which is also the first open spot of its patients: the seventh patient was stood
  in the medic (it takes six on the benches first, so no season had shown it). Every place is asked against
  everybody's before it is given.
- *And a place of the director's own making is somebody's place too* (`stands.js` `hold`). Open ground for an
  attack and a mark in a queue were put on a person without a word to the stands; open ground IS one of the
  place's spots by its coordinates, and by the book it was nobody's. Found in the robber's seed 5, hour 23, at
  Precinct 9: a10 was stood on open ground at (41.8, −30.0) to be robbed, the robber who came for a10 was given
  the spot (41.8, −30.0), and the two were pushed apart for 39 frames and stood 0.3 m apart (`pushes` 39, a `close`
  of two standing). It was there before this branch (nothing in `6d7be18` tells the stands); the solid figures
  only changed which ground a10 was sent to.
- *What it costs the picture*: a held person at Iron Island stands cuffed in the yard (`cuffed_idle`), never sits:
  the one bench is the inmates'. St. Mercy's forecourt benches are free of the city's people (the nearest is 2.2 m
  from a seat), so patients sit as before. Glasswall Plaza loses six spots to the people on its benches and
  Precinct 9 one (`stage.debug().unfit`).

**The audit counts them** (`actors.js`, `--audit`): `overlaps`, times somebody of ours was in one of the city's
people for more than half a second (two middles under 0.6 m apart, as `close` is for two of ours), `overlapFrames`,
every frame of it, and `byFigure`, frames somebody of ours was within 1.5 m of one: the proof they were looked for.
`stage.debug().figures` is how many are known. `?figures=0` plays the stage as it was (blind to them) with the
audit still counting: the "before" below. AFTER A RE-PIN, LOOK AT `byFigure`: the figures are read from the
stream's own records (`stream.blocks`, `data.cm.far`), which is not a published contract; if the city moves them
`figures` reads 0, nobody is kept off anybody, and `overlaps` is 0 because nothing was looked for. `byFigure` 0
over a season says so.

**The county orange.** `actors.wear(id, outfit)` lays one of the cast's named outfits (`cast.js` `OUTFITS`) over a
person's own look, bakes it once (`simstate/looks.js` `bake`, `peds.addLook`) and points the walker's `look` at it:
the city reads a walker's look every frame, so the change is at once and needs no new walker. `citymap.js` `HELD`
says what a held place issues (`jail: 'county'`, top `iron_island`, bottom `iron_island_issue`: what the yard's
inmates wear); `director.js` `garb` puts it on wherever `inside` changes: on at the cut into the jail (`enter`),
off when they are let go (`comeOut`, `settle`). Face, hair and hat stay their own, as the city's inmates keep
theirs. The portrait in the panels is still their own clothes (`demo/hud/` was not touched).

**Blood.** The city's own (`stage/gorefx.js`, made for `traffic/accident.js`): `createGoreFx(scene)` gives a spray
of drops with a mist, splats, splats that ride a car, a pool that spreads and dries. `demo/stage/gore.js` makes one
of its own and only says when and where. The director tells the shot (`'shot'`: who fired, at whom, and `hit`,
whether the one fired at is shot, falls or lies hurt in what follows: the two scenes that fire today are
`rob:disaster:shot` and `door:disaster:shot`; a hold-up fires nothing).
- at the shot: `fx.spray` from the chest the way the bullet went, seven splats where the drops come down, and a
  wound on the chest front and back that rides the body while it reels (`fx.carSplat`, the body as the "car");
- as they go down (`fall_back` on): the wound is laid on the chest where the body lies, the pool spreads under it;
- while they lie: pool and wound are kept (the city's pool dries after 95 s; a player lies hurt until Continue);
- up, taken away or gone: the wound goes, the pool dries over the city's six seconds.
What had to be worked round: the city's blood lands on the PLAN's ground (`groundY`: the sidewalk's top or the
road's), and a yard's lane, a plaza's paving and a park's walk are a step higher (Sunny Acres' lane is 0.3 m, the
feet of a body on it at 0.2): there the drops' own splats and `fx.pool` are under the paving. So what we lay on
the ground is laid at the collision world's top (`world.topAt`) and the pool is `fx.splat` with the pool's own
figures. The drops' own splats still land at the plan's height: seen on a street, lost in a yard.
A seat that is not the player's is up and limping to the clinic about two seconds after it lands (the scene's own
`lie_hurt` beat is that long), so its pool is short-lived; the player's stays until they press Continue.

`node demo/tools/stage-scene.mjs jail|shot` stages either on purpose in a played game and takes the pictures
(a season shows a shot about once, and seed 4's dealer is never jailed: three hours at St. Mercy, none on the
island). `stage-run.mjs --shots` takes `shot`, `shot-down` and `jail` when a season has them.

**What it moved, and one cap.** With the plaza's bench seats gone to the city's sitters, seed 4's hour 17 gives a5 a
spot seven metres into Glasswall Plaza from the lane. A watched arrival on foot starts as far as 26 m back
(`rides/foot.js` `BACK_LANE`) at 1.5 m/s: 35.9 m, 24.4 s, and `travel.js` put an arrival in its place after 24
(`ARRIVING`): a5 was put there two metres short, in the picture (`capped` 1, was 0). At 30 the dealer's seed 7 still
capped one in one run of two (hour 52, a7 walking in to the plaza stood behind one of the city's walkers on the
lane at (5.3, 4.9) with 28.5 m to go). `ARRIVING` is 36.

**Measured** (headless Chrome 1600 × 1000, this Mac Studio, the round 4 command:
`node demo/tools/stage-run.mjs --mode play --speed 2 --seed 4 --hours 60 --audit`; before: `6d7be18`; "blind": this
build with `?figures=0`, the stage as it was with the new counts on; after: this build):

| | before | blind | after |
|---|---|---|---|
| the run | `stage-ok`, 0 page errors | `stage-ok`, 0 page errors | `stage-ok`, 0 page errors |
| `overlaps` (somebody of ours in one of the city's people) | not counted | 22 | 0 |
| `overlapFrames`, `byFigure` | not counted | 6,547, 22,503 | 0, 12,337 |
| jumps, pops, drops, squeezes, headingSnaps | 0, 0, 0, 0, 0 | 0, 0, 0, 0, 0 | 0, 0, 0, 0, 0 |
| `unseated`, `slides`, `pushes`, `seams`, `blind` | 0, 0, 0, 0, 0 | 0, 0, 0, 0, 0 | 0, 0, 0, 0, 0 |
| `close` (two of ours) | 6 | 5 | 6 |
| `through` (frames) | 2 | 4 | 15 |
| `inRoad`, `floating` (frames) | 1, 39 | 1, 40 | 2, 33 |
| `waits`, `speedSteps` | 15, 7 | 18, 8 | 11, 6 |
| trips cut in the picture (`capped`) | 0 | 0 | 0 |
| `tally.reseated` | 0 | 0 | 0 |
| frames, the season on the wall clock | 32,613, 546 s | 32,727, 550 s | 31,567, 528 s |
| spots found unfit: uptown, precinct, jail | 2, 0, 0 | 2, 0, 0 | 8, 1, 0 |

- The 22 were all at Glasswall Plaza: the dealer, a5 and a9 given bench seats 0.56 m from the city's own sitters at
  (13.6, −19.0) and (19.0, −24.4), and buyers stood in the sitter to deal with them. Seed 4's dealer is never
  jailed, so the jail's seat is not among them: that one is the staged picture, and the other seeds below.
- `close` is two of OURS within 0.6 m for half a second, and every one in every run is somebody walking up to or
  past somebody (a buyer held up beside the seller, two walkers on one step): none is a shared place. The one at
  Glasswall Plaza (a buyer beside the dealer on that bench) is gone; one at Pleasantview Park (a buyer held up
  beside a5) is new. 5 or 6 in five runs of this build.
- `through` and `inRoad` differ from run to run, as round 4 found (its own after run had 15 and 2). Five runs of
  this build: `through` 1, 4, 15, 3, 15 and `inRoad` 1, 1, 2, 1, 2. The 15 and the second `inRoad` are one moment at
  the bar that some runs have and some do not, both in round 4's list: the player knocked back past the end of a
  step into DEAD AIR's front wall (−85.6, 30.2), and a7 at the bar's kerb (−87.3, 33.4). The rest are the city's
  solids at Sunny Acres (−241.5, −53.7 and a run past −232.7, −55.4). None is a person. Whether the solid figures
  make the bar's moment likelier was not settled: it was in two of five runs here and in none of the two without
  them (before, blind).
- `capped` was 1 in the first runs of this build (above) and is 0 with `ARRIVING` at 36.

**Two other seeds, for the jail and the clinic** (the same command with `--seed 5 --query "seat=robber"`, whose
robber is taken to the jail four times and to St. Mercy nine, and `--seed 7`, whose dealer is taken to St. Mercy
three times and to the jail once; "blind" is `figures=0`):

| | robber, seed 5, blind | robber, seed 5 | dealer, seed 7 |
|---|---|---|---|
| the run | `stage-ok`, 0 page errors | `stage-ok`, 0 page errors | `stage-ok`, 0 page errors |
| `overlaps` (somebody of ours in one of the city's people) | 10 | 0 | 0 |
| `overlapFrames`, `byFigure` | 1,728, 6,876 | 0, 5,341 | 0, 10,667 |
| jumps, pops, drops, squeezes, headingSnaps | 0, 0, 0, 0, 0 | 0, 0, 0, 0, 0 | 0, 0, 0, 0, 0 |
| `unseated`, `slides`, `pushes`, `seams`, `blind` | 0, 0, 0, 0, 0 | 0, 0, 0, 0, 0 | 0, 0, 0, 0, 0 |
| `close` (two of ours) | 6 | 7 | 3 |
| `through` (frames) | 0 | 0 | 0 |
| `inRoad`, `floating` (frames) | 1, 35 | 1, 30 | 2, 26 |
| `waits`, `speedSteps` | 20, 0 | 22, 0 | 18, 4 |
| trips cut in the picture (`capped`) | 0 | 0 | 0 |
| `tally.reseated` | 0 | 0 | 0 |
| frames, the season on the wall clock | 22,995, 386 s | 22,882, 384 s | 30,409, 509 s |
| spots found unfit: uptown, precinct, jail | 2, 0, 0 | 8, 1, 2 | 8, 1, 2 |

- Blind, the robber's ten were the owner's own bug (the player on the waiting bench 0.41 m from the inmate at
  (289.5, −383.0): three of the eight the audit kept word of) and the plaza's bench sitters. After: the player
  stands cuffed at (291.5, −383.5), 2.03 m from the nearest inmate, in the county orange (watched through the
  first two stays of a played season).
- Staged, all ten seats held at once (`stage-scene.mjs jail --held 10`, and `--place clinic`): at Iron Island
  nobody nearer than 1.37 m to one of the city's people or 1.41 m to one of ours (the ninth and tenth on spare
  ground); at St. Mercy 2.17 m and 0.84 m (two on one bench, as the bench has it), the medic 1.41 m from anybody.
