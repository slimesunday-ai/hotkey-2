# Where hotkey 2's map sits in the 3D city: Fit Street

> **Superseded on the `big-city` branch (2026-11-12).** The owner rejected the 3×3 set ("the city is already built we just need
> to wire our game into it"). The game now plays at the city's real places: SPEC section 25, `demo/stage/places.json`.
> What follows is the record of the set, kept for its measurements.


**Status:** the PLAYTEST MAP (2026-11-12) is the section just below and is what the game runs on. Everything under
"The second proposal" further down is the map before it: kept for the record, SUPERSEDED where the two differ (the
streets' widths, where the market, the projects, the corner, the docks and the clinic are, the standing spots).

## The playtest map (2026-11-12)

The same corner, DEAD AIR's, laid out for the play camera and for more room on the sidewalks. Data:
`demo/stage/citymap.js` (the map, `CHOICES`), `demo/stage/set/dress.js` (`SITES`, the dressing and the furniture),
`demo/stage/set/stands.json` (standing spots: `node demo/tools/set-stands.mjs`, then
`node demo/tools/set-table.mjs --prune`), `city/overlay/` (the street plan, made by `city/overlay/adapt.py`, and the
city's side-room table remade for it by `node demo/tools/set-room.mjs`: without that table nobody on a moved
sidewalk can step aside). `node demo/tools/set-table.mjs --md` prints the per-place table from the live page.

```
          Central Ave (avenue: 8 m road, 4 m sidewalks)
   ─────────[N] FIT ST subway stairs ── ✚ CLINIC: ambulance + tent in the kerb lane ── bay ──────
   ┌───────────────────────────┬─────┬──────────────────┐
   │ walk-up   DROP    LUCKY 7 │  I  │                  │
   │                   UPTOWN ●│  v  │                  │      uptown ── park
   │    (alley)          PARK ●│  y  │    (CARAT, the   │         │        │
   │ HOT     brown-            │     │   NEEDLE shop:   │   precinct ── bar ──── market
   │ SLICE   stone    DEAD AIR │  S  │   behind roofs)  │      │        │         │
   │   PRECINCT + LOCK-UP ●  BAR ●   │● MARKET  MAMI    │    docks ── corner ── projects
   ├───────────────────────────┼─────┼──────────────────┤
   │        Washington St  (4 m road, 4 m sidewalks)    │
   ├───────────────────────────┼─────┼──────────────────┤
   │ ● PROJECTS: WASHINGTON    │     │● CORNER          │
   │   HOUSES 1 · 2 · 3  DOCKS ●     │  LAST CALL       │
   │ ROYAL 24 · EBT · NAPOLI   │  St │                  │
```

### What changed, and why

1. **4 m sidewalks on Ivy St, Hazel St and Washington St** (they were 3 m), the same as Central Ave's. The street's
   right-of-way is unchanged and the road is one 4 m lane instead of 6 m, so no block moved: every building, lot id
   and registered flat is where the city has it. The walkers' line is now 2.4 m in from the kerb, which leaves a
   kerb strip to stand in with room to spare and a wall strip to lean in.
2. **Everybody stands where the play camera sees them.** The camera is 11.7 m due east of a person and 24 m up. On
   the east sidewalk of Ivy St the market's own buildings were between the lens and its people (0 of 96 points
   seen, measured over the city's collision world). The market's people now stand on its Washington St side; the
   projects, the corner and the docks are on Washington St and on Ivy St's west sidewalk. A standing spot the
   camera does not see is dropped (`set-table.mjs --prune`).
3. **The projects are the three tenements** on the south side of Washington St (city block −3,1: brick, six
   storeys, fire escapes), not the LAST CALL walk-ups. Their flats are the pads. Because a link has to stay a short
   walk, the corner moved to LAST CALL's corner and the docks to the Ivy St side of the NAPOLI tenement.
4. **The clinic is at the FIT ST subway stairs** on Central Ave: the tent and the ambulance in the avenue's kerb
   lane (the city parks cars in that lane).
5. **Furniture people really use**: 10 benches of the city's own kind (their seats are bench spots), two ledges to
   sit on (the docks' pallets, the park's flower bed), a chain-link yard to lean on at the projects.

### LOCAL or STAND-IN, and where each goes when the map grows

The working assumption (put to slime, his to change): the map grows by NEIGHBOURHOODS in different districts of the
real city, each with its own housing and its own local places, while the city-wide institutions exist once, are
shared, and are reached by subway (and by the city's boards and scooters for middle distances).

| Place | Here | Kind | When the map grows |
|---|---|---|---|
| bar | DEAD AIR, Ivy & Washington NW | LOCAL | stays: this neighbourhood's bar |
| corner | LAST CALL's corner, Ivy & Washington SE | LOCAL | stays; other neighbourhoods get one of the city's own dealing corners (DISTRICTS.md §6) |
| park | the alley mouth on Ivy St | LOCAL | stays as the pocket garden; a neighbourhood with a real park block uses that |
| projects | the Washington St tenements, WASHINGTON HOUSES | LOCAL | stays; the real slab projects are being brought into the city from the owner's other game and would replace the dressing |
| uptown | the LUCKY 7 deli corner on Central Ave | LOCAL | stays: Central Ave is the avenue, and it runs east into downtown's towers |
| market | the ATM LOTTO / MAMI GRILL corner, the fence's and the gun dealer's tables | STAND-IN for the city's main market | the fence → HONEST PAWN (block −5,−2) or the Heap's fence booth; a gun shop does not exist in the city yet; the shopkeeper's store stays |
| docks | the Ivy St side of the NAPOLI tenement | STAND-IN | Low Tide Docks (blocks 0…4, −8), TIDE line to LOW TIDE |
| precinct, lock-up | the brownstone on Washington St, a pen in its forecourt | STAND-IN | Precinct 9 (block 1,−1); the lock-up to the jail on Iron Island |
| clinic | the tent at the FIT ST stairs | STAND-IN | St. Mercy (blocks 4…5, −2…−1): NEON line, FIT ST → WASHINGTON → ST MERCY. "Cut to the hospital, take the subway back, it costs money": you come back up these stairs |

- **Where the stand-ins face.** The clinic is on the north edge, on the avenue that leads east to St. Mercy. The
  precinct and the docks are at the WEST and SOUTH ends, facing away from their real versions (east and north-east):
  accepted for the playtest, because the bar's corner fixes where its linked places can be.
- **The subway.** FIT ST (NEON line) is at (−89.5, −9.5), on the north sidewalk of Central Ave, mid-block. Its
  stairs are the city's own and already work for the city's riders. Nothing of ours rides yet.
- **Boards and scooters** (the city has the clips: `anim/cast/clips/skate.js`, `ride.js`): the place for a rack is
  the Central Ave sidewalk beside the FIT ST stairs, east of the clinic's bench, where the kerb is kept clear.
  Not built.
- **Through-streets.** Nothing of ours stands in a travel lane except the clinic's tent and ambulance (the
  avenue's parking lane) and the cruiser (Washington St's kerb). Hazel St, Ivy St north of Central and south of
  Washington, and both ends of Washington St are as the city has them.
- **More seats.** The registry has 13 flats on the projects' front (10 are pads) and 15 more in the same block;
  the clinic's own kerb has 17 standing spots made and kept in `stands.json` under `held` (the stage does not
  read them yet).

### Three choices slime reviews, and how each is reversed

| Choice | How it is reversed |
|---|---|
| The 4 m sidewalk made by narrowing the road to one lane | `python3 city/overlay/adapt.py --walk4-x= --walk4-z=` and delete `city/overlay/style/` (or serve with `--no-overlay`), then `set-stands.mjs` and `set-table.mjs --prune`. The 5 m variant is the `--wide-x/--wide-z` switch in the same script (built and looked at: it re-rolls every block along the line; see the script's header). |
| The projects at the tenements (and with them the corner and the docks) | `CHOICES.projects = 'lastcall'` in `demo/stage/citymap.js`: the old pads, the corner under NAPOLI's awning and the docks at ROYAL 24 come back (both sets of data are kept, in citymap.js and in dress.js). Then the two tools. Not re-audited in that position on the new streets. |
| The open lot at city block −4,0 | Not used. It is a car wash with a 4 m drive lane, 30 m and more from the bar: no linked walk to it is short. |

Forks left for slime (taste, not measured): whether the market's two sellers should be tables on Washington St (as
built) or stay at CARAT's and the NEEDLE shop's own doors, which the camera cannot see; the names WASHINGTON HOUSES
and LOW TIDE SUPPLY CO; whether LAST CALL (a liquor store's sign) is right for "the corner".

### What still looks wrong

1. **The projects are tenements with an estate's marks**, not slab projects: bright walls, shops under them (ROYAL
   24, an EBT grocery, NAPOLI). The marks are a steel canopy over each street door with its number painted on top,
   a HOUSES blade, the name on the wall, fenced tree lawns, a chain-link yard, a mailbox bank, a bench. No hoop:
   there is no honest open ground for one.
2. **A van or a cruiser driving a 4 m street passes within centimetres of the city's parked cars** (the city parks
   on one kerb and drives the other half, as it did before its streets were widened).
3. **Facades on Washington St face north and south, and the play camera looks along the street**: wall signs there
   are seen at a slant. What reads from the play camera is what stands across the sidewalk or lies flat: blades,
   the canopies' numbers, the tent's roof.
4. **market – uptown is 29 m** (the aim was 25): it is the long side of the Fit Street block.
5. Trees and fire escapes hide the wall strip on Washington St's south side: most wall spots there were dropped.

---

# The second proposal (2026-11-11): SUPERSEDED by the playtest map above where they differ

**Status:** the second proposal (2026-11-11), built and dressed. The layout is an art call for slime. Nothing in the
rules reads it. The map is data in `demo/stage/citymap.js`; the dressing, the rooms and the light are
`demo/stage/set/`. The first proposal (the plaza ring, 145 m east) is kept in `demo/stage/citymap-plaza.js` with its
pictures in `city/shots/plaza/`: it was set aside because slime asked for Fit Street.

**The set in one line:** Fit Street's south-east corner. DEAD AIR stands on the corner of Ivy St and Washington St,
and the eight blocks are the fronts on those two streets, one city block's length each way.

World frame: metres, +x east, +z south. Ivy St is x = −72, Hazel St x = −108, Central Ave z = 0, Washington St
z = 36. Fit Street is city block −3,0. The road is y 0 and a sidewalk y 0.2.

## The pictures (`city/shots/`)

| File | What |
|---|---|
| `overhead.jpg` | straight down, with the legend |
| `set.jpg`, `set-night.jpg`, `set-clean.jpg` | the one camera that holds the set, ten named agents on their spots, by day, at 21:00, and without labels |
| `block-<id>.jpg`, `block-<id>-night.jpg` | one street-level picture per block and held place, by day and at 21:00 (no crowd, no traffic) |
| `room-jail.jpg`, `room-jail-above.jpg`, `room-clinic.jpg`, `room-pad.jpg`, `room-set.jpg` and `-night` | four people in the lock-up, four in the ER, a tenant in an open pad, and the set camera with the rooms open |
| `set-night-without-prelight.jpg` | night when the page skips the one step night needs (see "Night") |

They are made by `demo/tools/set-shots.mjs` (the commands are at its top). `/demo/set-dev.html?map=1&cast=1` shows the
same thing live.

## The map

```
                 Central Ave
     ┌───────────────────────┬───┬──────────┐
     │ DROP        LUCKY 7   │ I │ ATM LOTTO│
     │             uptown ●  │ v │          │        uptown ─────────────── market
     │   (alley)   park   ●  │ y │ ● market │           │                     │  │
     │ HOT   brown-          │   │   CARAT  │         park                    │  │
     │ SLICE stone  DEAD AIR │ S │   OPEN   │           │                     │  │
     │      precinct ●  bar ●│ t │ (the ER) │  precinct ── bar ───────────────┘  │
     ├───────────────────────┼───┼──────────┤     │        │                     │
     │      Washington St    │   │          │   docks ── corner ───────────── projects
     ├───────────────────────┼───┼──────────┤
     │ ● docks      corner ● │   │● projects│
     │ ROYAL 24     NAPOLI   │   │ LAST CALL│
```

| Block | Place | Street spot (x, z) | Other spots | What we added |
|---|---|---|---|---|
| bar | DEAD AIR, on the north-west corner of Ivy St & Washington St | −76.6, 31.4 | `counter:shop` −85.9, 31.0 (its door) | nothing: it reads as a bar from both streets |
| park | the gated alley between the deli and DEAD AIR, under the roof party | −76.6, 18.0 | | a PARK blade on the bar's wall, an arch over the gate, a bench, strings of bulbs out to the street tree, a boombox, crates to sit on |
| uptown | the LUCKY 7 DELI corner at Central Ave: the DROP and its queue next door, the HUSH MONEY tower across the avenue | −76.8, 6.6 | `counter:shop` −79.2, 7.1 (the deli's door) | nothing |
| market | the east side of Ivy St, across from the bar | −67.6, 21.0 | `counter:fence` −67.3, 17.4 (CARAT) · `counter:gunshop` −67.3, 21.2 (the OPEN shop) · `counter:shop` −67.3, 26.2 (ATM LOTTO) | blade signs GOLD and GUNS beside the city's NEEDLE and DELI blades, and WE BUY and AMMO boards on the sidewalk |
| corner | the south-west corner of Ivy St & Washington St, under NAPOLI's awning | −76.4, 40.5 | | nothing |
| projects | the LAST CALL walk-up on the south-east corner, and the two walk-ups beside it | −67.6, 40.5 | `door` −64.95, 40.9 · `pad` −64.95, 43.6 | a ROOMS blade; the pads are ten registered flats (below) |
| precinct | the brownstone two doors west of the bar | −91.0, 31.5 | `desk` −93.2, 30.7 (the foot of its stoop) | a POLICE board and blade, green lamps at the steps, a cruiser at the kerb, the lock-up |
| docks | ROYAL 24 ("WE DELIVER") at Hazel St | −100.5, 40.6 | `pier` −98.7, 40.55 (the cellar hatch) | open steel cellar doors, stencilled crates, a wrapped pallet, a loaded hand truck, drums, a SUPPLY blade and the plate LOW TIDE SUPPLY CO · NO RECEIPTS |

| Held place | What it is | Room at (x, z) | Door (`exit`) | Walk out |
|---|---|---|---|---|
| jail | the lock-up: a barred pen in the station house's forecourt, open to the sky | −89.15, 28.8 | −90.2, 30.7 | 2 m to the precinct's street spot |
| clinic | St. Mercy's street ER: one of the hospital's own ambulances backed up to a four-cot tent, in the kerb lane on Ivy St | −69.95, 23.55 | −68.2, 23.6 | 20.9 m to the bar's corner, over the Ivy St crossing |

**The pads** (`citymap.js` `PADS`): one registered flat per seat, so the city's own rooms open.
`a1`–`a3` `apt:-2_1·L0·3 … 1` (door −64.95, 41.55) · `a4`–`a7` `apt:-2_1·L1·4 … 1` (door −57.95, 41.55) ·
`a8`–`a10` `apt:-2_1·L7·3 … 1` (door −66.45, 57.75, round the corner on Ivy St).

## Why the bar's corner, and why the market is across the street

The game's graph is three squares that share the bar: [projects, market, bar, corner], [market, uptown, park, bar]
and [corner, bar, precinct, docks]. A square only has four short sides where the streets make one: the four corners
of a crossing, or the two sidewalks of one street between two crossings. Round DEAD AIR's corner there are exactly
three of those: the Ivy St & Washington St crossing, Ivy St up to Central Ave, and Washington St along to Hazel St.
The middle square must be the crossing, because it shares a side with each of the other two. That puts the market
and the corner across a street from the bar and the projects on the fourth corner. Nothing else lays the graph flat
with short walks.

**What it costs:** the DROP and the deli are uptown, not the market. Putting the market on the deli (the bar's own
sidewalk) forces the square [projects, market, bar, corner] round the back of the Fit Street block: the projects on
its north-west corner, 27 m from everything, out of sight of any camera that sees DEAD AIR's signs.

## The walks

Measured with the city's own trip planner (`world/export/travel.mjs`, the one the actors walk by):
`node demo/tools/set-walks.mjs --spots`. "There / back" are the two directions.

| Pair | Linked | Straight (m) | Trip there / back (m) | Shorter way (m) | At 2.6 m/s (s) |
|---|---|---|---|---|---|
| uptown – park | yes | 11.4 | 12.0 / 12.0 | 12.0 | 4.6 |
| bar – park | yes | 13.4 | 13.8 / 13.8 | 13.8 | 5.3 |
| bar – precinct | yes | 14.4 | 14.8 / 14.8 | 14.8 | 5.7 |
| corner – bar | yes | 9.1 | 33.0 / 16.2 | 16.2 | 6.2 |
| projects – corner | yes | 8.8 | 33.0 / 16.2 | 16.2 | 6.2 |
| market – bar | yes | 13.8 | 23.3 / 40.0 | 23.3 | 8.9 |
| projects – market | yes | 19.5 | 23.3 / 40.1 | 23.3 | 9.0 |
| corner – docks | yes | 24.1 | 24.5 / 24.5 | 24.5 | 9.4 |
| docks – precinct | yes | 13.2 | 25.2 / 42.0 | 25.2 | 9.7 |
| market – uptown | yes | 17.1 | 44.8 / 27.4 | 27.4 | 10.5 |
| projects – bar | no | 12.8 | 24.6 / 24.6 | 24.6 | 9.4 |
| uptown – bar | no | 24.8 | 25.1 / 25.1 | 25.1 | 9.6 |
| corner – park | no | 22.5 | 43.3 / 26.5 | 26.5 | 10.2 |
| corner – precinct | no | 17.2 | 44.2 / 27.4 | 27.4 | 10.5 |
| the other 14 unlinked pairs | no | 9.5 to 41.4 | | 29.3 to 58.5 | 11.3 to 22.5 |

- **A crossing is one-way in the planner.** The crowd's lanes circulate round each crossing, so the planner sends the
  "back" direction round three crosswalks (33 to 45 m). A person may walk a crosswalk either way: the lead ruled that
  `walkTo` takes the shorter of the two, and the numbers below are for that.
- **Linked walks:** 12.0 to 27.4 m, mean 19.7 (4.6 to 10.5 s at 2.6 m/s). One is over 26 m: market – uptown, 27.4.
- **Unlinked walks:** 24.6 to 58.5 m, mean 36.7.
- **Linked closer than unlinked?** In 174 of 180 comparisons. The six that fail are the four unlinked pairs in the
  table: the bar and the projects face each other across the crossing, and uptown shares the bar's sidewalk.
- **As the planner stands today** (the longer direction of each): linked 12.0 to 44.8 m, mean 29.8; six links over
  26 m; 136 of 180 comparisons.
- **Every spot inside a block** is under 6 m from its street spot, except the bar's door (10.2 m).

## The set's camera

`VIEWS.set`: from 70 m above the projects, looking north-west up both streets (`pos` −56.5, 70, 46.5 · `tgt`
−82, 0, 25.5 · `fov` 42). It sees all four sidewalks because it looks along the two near ones. The fronts it reads
are the ones that face south and east: DEAD AIR, the station house, the park, the deli, the bail-bonds board, the
roof party. The market's, the corner's, the projects' and the docks' fronts face away from it; their sidewalks and
the people on them are in view. 7 m further south the docks' sidewalk goes behind its own roofs.

Each block's `look` is a camera over a roadway that sees its front; the stage's camera reads only its direction.

## The rooms (`demo/stage/set/index.js` `rooms`)

- **`rooms.anchor(id, who?)` → `[x, y, z, ry]`**, or null when the set has no room for the id.
  - `'jail'`: six places. The first four are on the bench (its seat is 0.5 m up, as the city's `sit_bench` wants);
    the last two stand.
  - `'clinic'`: four places, the four stretchers. A person lies with the feet to the street (checked with
    `lie_hurt`).
  - `'pad:a1'` … `'pad:a10'` (`padOf(agentId)`): one place, a step inside the flat's front wall.
  - Without `who` the places are handed out in turn. With `who` one person keeps one place until
    `rooms.leave(id, who)`.
- **`rooms.view(id)` → `{ pos, tgt, fov }`**: a camera that sees into the room.
- **`rooms.show(id, on)`**. The lock-up and the ER are open to the sky: showing them lifts the pen's lid of bars and
  the tent's canopy, and it is counted (two in, one out: still open). **The pads share the city's one cutaway**
  (`gpu.js` `CUT` is one cut for the whole page): the pad asked for last is the open one, and when it closes the one
  before it opens again.
- **A pad is cut from above, over head height.** The city's own cut for a walk-up takes the front wall and
  everything inside the storey, which would also cut our walkers away (their material carries the same cut). So the
  set moves the cut: everything more than 2.2 m over the room's floor goes, nothing below it does.

## Night (`setClock`)

**It works in one page load, on one condition.** `setClock({ day, hour })` is day until 17:30, dusk to 20:00 and
night after. What turns:
- the city's own grader (`render/grade.js`): sun, sky, fog and exposure, and 42% of the window glass lit;
- the city's street-lamp light, on eleven lamps of our own along both streets, plus one in the open pad;
- everything the set lights itself: sign letters, lamp heads, the cruiser's and the ambulance's lamps.

**The condition:** the lamp light is a term the city compiles into its materials only on a night page or a live-sim
page. `demo/stage/set/prelight.js` puts it in, and must run before the city starts:

```js
const { prelight } = await import('./stage/set/prelight.js');
await prelight(CITY);
await import(`${CITY}main.js`);
```

`demo/set-dev.html` does this. **`demo/boot.js` does not yet** (it is the city builder's file). Without it the set
still goes dark, lights its windows and signs and gets warm pools on the ground, but nothing lights the people or
the walls: `set-night-without-prelight.jpg` against `set-night.jpg`.

**What a day page still lacks at night**, because the city bakes it per build: its own sign letters (DEAD AIR, the
DROP, BAIL BONDS, shop names stay unlit, though they read under the lamps), its lamp heads' glow and the glow of
its shop interiors. A page loaded with `?tod=night` has all of that, and the same clock then grades it the other way
by day. If slime wants the full neon, the reload at 20:00 is still open; it was not built because this passed.

## Performance

Headless Chrome, 1600 × 1000, Apple M3 Ultra, the set's camera, ten agents (`demo/tools/set-perf.mjs`):

| | Frame rate | Frame time, cap off (median / 95th) | Draw calls |
|---|---|---|---|
| the page without the set | 60 fps | 4.1 / 4.8 ms | 135 |
| the set dressed, rooms shut | 60 fps | 4.1 / 4.7 ms | 154 |
| lock-up, ER and one pad open | 60 fps | 4.5 / 5.2 ms | 154 |
| night at 21:00, rooms open | 60 fps | 4.4 / 5.1 ms | 155 |

The set is 16 meshes and 37,000 triangles against the city's 6.1 million. Nothing was measured on a laptop.

## What looks wrong or thin

1. **The park is a sidewalk.** The alley behind the gate holds the deli's dumpster, so the park is a sign, a bench,
   bulbs and a tree in front of a locked gate. It reads as a place to hang out at night; it does not read as a park.
2. **The docks have no truck.** Washington St has no kerb lane on that side. The cellar hatch, crates, drums and the
   plate say "supplier"; nothing says "docks".
3. **The ER is a tent.** The city has no free lot here. It reads at a glance (ER letters, red cross, an ambulance,
   four stretchers) and it is not a hospital.
4. **The lock-up is a pen in a forecourt**, not a cell inside a building, and a street tree stands in front of it.
5. **The market's signs face away from the set's camera.** GOLD and GUNS read from the street and in the block
   picture, not from above.
6. **The corner has nothing of ours.** It is NAPOLI's corner as the city built it.
7. **A pad's cutaway is a hole in a roof.** One at a time, and a flat on a lower floor is seen down a shaft.
8. **The city's own figures stay where they were**: a man sits on the station house's stoop, and the LAST CALL
   building's second roof party dances on beside the hole when its top flat (`pad:a1`) is opened.
9. **The pads are not in the set camera's frame.** They stand under and behind it (two of the three buildings are
   south and east of its bottom edge). `rooms.view(id)` gives a camera that sees into a pad; the set's one camera
   shows a tenant going in at the door and no more.
10. **At night the city's own names are unlit** on a day page (see "Night").

## Decisions

**slime's (art)**
1. The layout: Fit Street's south-east corner, with the DROP and the deli as uptown.
2. The park as the alley, the docks without a truck, the ER as a tent, the lock-up as a pen.
3. Night in one page load without the city's own neon, or a reload into the night build at 20:00.

**The lead's (engineering)**
1. `demo/boot.js` needs the three lines of `prelight` above, before the city's `main.js`.
2. `walkTo` taking the shorter direction of a crossing (already ruled).
3. The director calls `rooms.anchor(key)` with no second argument, so people in one room are placed in turn. Passing
   the person's id, and calling `rooms.leave`, keeps each on their own place.
4. One pad open at a time is a limit of the city's cutaway, not of the set. A pad's inside needs the camera to go to
   `rooms.view(key)`: the set's camera does not hold the pads.
