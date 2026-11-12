# demo/stage/rides: the two halves of a trip, round a cut

A person leaves one place by scooter, skateboard, cab, subway or on foot; the stage cuts; they arrive at the other. This module
plays both halves on the stage's own actors (`demo/stage/actors.js`) with the city's models and clips. Each file's
header says what of the city it plays and what is ours.

| File | What |
|---|---|
| `index.js` | `createRides({ city, CITY, actors, skaters })`: `leave`, `arrive`, `modeFor`, `skates`, `setSkaters`, `pairFor`, `station`, `cancel`, `between`, `stats` |
| `scooter.js` | on, off along the sidewalk; in, off, the scooter left on its stand |
| `skate.js` | a few running steps onto the board and push off; roll in, step off (the city's board and skate clips) |
| `cab.js` | the fleet's cab to the person: followed (the cut as it stops) or watched (all of it in view) |
| `subway.js` | the station's own flight, down and up (`subway/index.js` under(), called) |
| `foot.js` | walk off; walk in |
| `kit.js` | shared: one scene per person, a body moved by a scene, clips held to a scene's clock, marks kept apart |
| `dev.js`, `../../rides-dev.html` | the dev page on the whole city |
| `shots.mjs` | contact sheets from the game's camera distance and closer |

## Wiring it into the stage (`demo/stage/travel.js`)

```js
import { createRides } from './rides/index.js';
const rides = await createRides({ city, CITY, actors });   // after createActors; once. { skaters: [ids] } names who skates

const mode = rides.modeFor(from, to, { id });                // 'foot' | 'subway' | 'scooter' | 'skate'   ({ cab: true } → 'cab')
const followed = id === cameraPersonId;                      // the cab plays a short scene for the person the camera cuts with
const left = await rides.leave(id, { mode, from, toward: to, followed });
// … cut the camera to the arrival place …
const came = await rides.arrive(id, { mode, at: to, from, followed });
```

- `leave` resolves at the moment to cut (`{ cut }`: seconds into the scene). The scene plays on behind the cut and
  takes the person off the stage at its end (`actors.show(id, false)`): a scooter rides on, a cab drives off, the
  stairs are walked to the bottom. `arrive` takes the person over wherever they are, so it may be called at once.
- `arrive` starts AT THE CUT: the person is put where the scene starts (already riding, in the cab, under the stairs,
  a few steps back) and shown. It resolves when they stand at `at` (made fit to stand on: `actors.fitSpot`).
- `{ hurried: true }` on either finishes at once. `rides.cancel(id)` finishes a running scene at once (a held hour
  cut short): a leaver is off the stage, an arriver stands at `at`. Every vehicle and prop of the scene is cleared.
- **Who skates.** `modeFor(from, to, { id })` gives `'skate'` where it would give `'scooter'` when the person is a
  skater: the ids in `createRides({ skaters })` (or `rides.setSkaters(list)` later) when a list is given, else about
  one in three, stable by id (`rides.skates(id)`). Without an id it is as before. Foot and subway are unchanged.
- **The cab: `followed`.** `followed: true` says the camera cuts with this person (the player's own agent, or whoever
  the stage follows). Leave: the cab comes to them (the stop next to them: the kerb lane if it is free right there,
  else in its own lane beside the parked cars at a gap they can step through), they hail, and `leave` resolves a beat
  after it comes to rest; getting in and the drive away play on behind the cut. Arrive: at the cut the cab already
  stands at the kerb and they are beside it on the sidewalk; it drives off while they walk to their place (no getting
  out is played). Without `followed` (somebody else, seen by a camera that stays at the place) all of it plays in
  view: the cab drives in from where the camera cannot see, they get in or out with the city's clips, it drives off;
  `leave` resolves once it has driven out of the picture (or 1.5 s after it pulled away). Either way the cab comes to
  the person: the walk is the short straight one to the door, and a place set back from its street (the docks yard,
  the lots) is walked out of toward the street first. A stop next to them that cannot be had (no road there) falls
  back on the old kerb search.
- Several people leaving or arriving together need nothing more: their marks are kept apart, a flight is taken
  single file, each gets their own scooter and cab.
- Subway: `station` names the station (default: `pairFor(from, to)`, the pair on one line, else the nearest). The
  stairs are played only when they are within 14 m of walking of the place (in the place's picture). Farther off,
  the departure is the walk off toward the station and the arrival a walk in from its side, unless `stairs: true`
  asks for the station scene, which then starts at the station (the person is put 1.5 m short of the flight's walk
  in: cut the camera there first). `rides.station(x, z)` says where the stairs are.
- `rides.between(id, { from, to, seconds })`: for the person the camera follows, the city's carriage scene between
  the halves (opened over the city by subway/carriage.js, squeezed into `seconds`).
- Nothing in `city/from-trunk/` is edited. On a page without the subway module (the game's), `createRides` mounts
  the city's own `subway/index.js` for its stairs only (`?subway=stairs`: no demo ride, nothing built at load).
- The game's page runs no traffic (`cars=0`): the cab is driven here, in its lane. Its kerb check reads the city's
  parked cars (`city.parkedIn`).

## In the game (2026-11-12): what the wiring added here

The game's stage (`demo/stage/travel.js`, `useRides`) calls `leave` and `arrive` as above. These were added in
this folder for it; the dev page runs as it did (`haste` 1, nobody `rush`ed).

- `createRides({ haste })`: the pace of the scenes' walks (to a scooter, from a kerb, in from the lane), as a
  multiple of the city's 1.5 m/s stroll. The game asked for 1.45 for one round and asks for 1 again (the owner:
  "goes way too fast"): nothing is squeezed.
- `kit.walk`: a mark under 16 m off with open ground between is walked to over the ground (`actors.groundWay`), not
  out to the walkers' lane and round by it. At the dealing corner the walk to a scooter three metres away took ten
  seconds by the lanes.
- `foot.js`, places SET BACK from any sidewalk (no lane within 9 m: Sunny Acres' lane, the docks' yard, the middle
  of a park): the walk off is over the ground on the open heading nearest the way out, and the walk in is over the
  ground from the side they come from. Everywhere, whoever arrives while the camera stays starts far enough back to
  come in from out of the picture; the followed person a few steps back.
- `arrive(id, { rush: true })`: a scene is waiting for them. They start no farther back than 14 m and run in.
- `between(id, { from, to, slice })`: ONE LEG AT THE LINE'S OWN PACE. The program handed to the city's carriage is
  the ride's last run alone (into the station the person gets off at), in the seconds the line takes for it
  (`run.m / line.speed + 3`, net.js's own nominal), and the clock starts `slice` seconds (8) before its end and runs
  at the stage's 1×. It was the whole ride with the timetable's minutes read as seconds (`programOf(net, legs, 1)`)
  and then squeezed into six. Measured on Sunny Acres to Fit St: 127 m in 3.2 program seconds, 51 m/s² at the
  most, and carriage.js leans a standing rider 0.03 rad and tips the car 0.0015 rad for every m/s²: 87° and 4.4°,
  the riders on the floor. Now the same run is 10.9 s, 4.3 m/s² at the most: 7.3° and 0.4°.
  `closeBetween()` ends it (a skip); the result says `left: true` when it was closed before its last second (the
  carriage's own Esc or ×). The carriage's stage is made at load (`prewarmCarriage`). On the game's page the
  carriage takes the city's own `sbw-under` class, so the panels stay over it.

## Missing, for the owner (the city has no part for these; the scene does the best it can without)

- **Where a scooter is when nobody rides it.** No rental bays, no parked scooters, no "item" props in the street. A
  scooter stands on its stand beside the rider when a departure starts (a pop if the camera is on them then), unless
  they arrived on one: an arrival leaves it on its stand at the kerb side and the next departure from there takes it.
  It is taken away once the camera cannot see it.
- **Where a skateboard is when nobody rides it.** The board is the rider's own, but nobody carries it (no clip to
  hold it, no back to hang it on). Leaving, the rider takes a few quick steps and the board is drawn under them as the
  push comes in (the city's own hand-over from a walk to a skate leg). Arriving, they step off and the board is left
  lying where it stopped (taken away once the camera cannot see it, or ridden off again by them).
- **Picking up a board, stepping on and off it.** No clips: the push's blend lifts the body onto the deck, the ride's
  blend-out lets it down.
- **Getting on and off a scooter.** No clip for it. On: the stand folds, the scooter is pulled under the rider from
  beside them, `scooter_ride` blends in and lifts the body onto the deck. Off: the reverse.
- **Cab doors.** The fleet's cab is one shut body (vehicles/models.js `taxi`: a door line, no door). `car_get_in` and
  `car_get_out` are played at the closed door; the person goes into and comes out of the body's side.
- **Somebody in the cab.** Inside, the person is not drawn (the city's own rule: the cab is drawn). The driver is
  the model's own.
- **Traffic.** The game's page runs none, so the cab is the only car moving. Where the kerb by the person is lined
  with parked cars it stops in its own lane beside them, at a gap the person steps through to the door.
- **The stairs at downtown stations are inside a kiosk** (FIT ST, ST MERCY): seen from the game's height the person
  walks in under its roof; the treads are seen only from low and close.
- **Places far from their station.** The stairs are played only when they are in the place's picture (14 m of walk).

## Measured (1× unless said, the stage's clock, the dev page on the whole city, 2026-11-12)

| Trip | leave (to the cut) | arrive (to standing) |
|---|---|---|
| foot: Jay St & Washington St → DEAD AIR | 3.2 s | 4.1 s |
| scooter: DEAD AIR → Precinct 9 | 6.0 s (2.3 of it walking to the scooter) | 5.4 s |
| subway: DEAD AIR → St. Mercy (stations 42 m and 60 m off: walk off / walk in) | 3.2 s | 3.6 s |
| subway: Sunny Acres → Fit Street (same) | 3.2 s | 3.9 s |
| subway with `stairs: true` (the station scene) | 6.3 s | 27–71 s (the walk from the stairs to a far place) |
| the carriage (`between`, 8 s asked; the program is 12.2 s) | 8.3 s | |
| skate: DEAD AIR → Precinct 9 | 2.6 s | 5.5 s |
| skate: Jay St & Washington St → Jay St & 1st St | 2.6 s | 8.1 s (a longer walk from the lane to the place) |
| skate, two at once (0.5 s apart) | 3.1 s | 6.5 s |
| cab followed: Low Tide Docks → Precinct 9 | 3.5 s (3.2 the cab at rest) | 2.4 s |
| cab followed: DEAD AIR → Jay St & Washington St | 3.5 s | 4.7 s (the walk from the stop, 7 m short of the corner) |
| cab watched: Low Tide Docks → Precinct 9 | 9.0 s (the cab out of the picture) | 7.6 s |
| cab watched: DEAD AIR → Jay St & Washington St | 9.1 s | 10.4 s (the corner: the stop is 7 m short of the crossing) |
| at 2× and 4× (stage seconds; the wall clock half and a quarter; the cab before its last trim of about 0.5 s) | skate 2.6 / 2.7, cab followed (docks) 3.5 / 3.5, cab watched (bar) 9.9 / 10.2 | skate 5.6 / 5.6, cab followed 2.4 / 2.5, cab watched 11.4 / 11.5 |

Contact sheets: `node demo/stage/rides/shots.mjs` (the frames and an HTML sheet per scene; `--tight` for a close camera).
The dev page keeps the city's crowd off ±30 m round each half (`actors.setKeepOut`, as the game does on its set):
with the crowd there (`?crowd=1`) riders are held up by people waiting at the lights and crowd walkers pass close.

## Dev page

```
node demo/serve.mjs --port 5474
open http://127.0.0.1:5474/demo/rides-dev.html            # buttons: one per trip of dev.js TRIPS
     http://127.0.0.1:5474/demo/rides-dev.html?play=cab&followed=1
     http://127.0.0.1:5474/demo/rides-dev.html?play=cab&n=2
HK2_DEBUG_PORT=5483 node demo/stage/rides/shots.mjs --out <dir> [--scenes cab,skate] [--followed] [--stairs 1] [--n 2] [--tight]
```
