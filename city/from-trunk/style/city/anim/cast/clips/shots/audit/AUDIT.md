# Clip audit: 20 visual bugs, ranked (2026-10-16)

The audit agent, on `anim/audit` (ai-city-fresh main `372e382`). This is a report only: no clip, prop, lab, check or doc file changed.

**The worst 5:**
- The robbery's lunge pushes the robber's head into the victim's head, and the grab never touches the victim.
- Hands sweep through the thighs whenever a clip blends in or out.
- The carry clips skid their feet and sink them into the ground.
- `hail_taxi`'s arm flips when the hail ends.
- The robbery victim's hand goes through its own head as it lands.

The findings are ranked by how much each one hurts in the game:
- **How visible it is** from the city camera (25 m, 38° down).
- **How often it plays.** That comes from GAME.md §20: the Hit and the Deal are nightly, the Collar, the travel and the Shift every day, the heist a few times a season. "Nobody dies", so the death clips are unused.
- **How bad it looks.**

Every number comes from the real walker shader, run by transform feedback. Each is measured on the bare mannequin unless a look is named. How it was measured is at the end.

Pictures and videos are in this folder. The city-distance filmstrips of every clip, one sheet per group, are in `25m/`.

---

## The ranking

### 1. The robbery: the heads meet, but the grab never lands
- **Clips:** `rob_lunge_grab` ⇄ `hit_stumble_back` (the Hit; every robbery, and the replays frame the victim).
- **What's wrong:**
  - The robber's head goes into the victim's head while the victim is still standing.
  - The robber's fists never reach the victim. The victim reels back from a grab that touched nothing.
- **Measured:**
  - **The heads:** they overlap from 0.27 s to 0.35 s into the lunge, up to 14 cm one way and 16 cm the other (1,116 and 1,048 head vertices). The victim only starts its stumble at 0.34 s (`pair.delay`), so for most of that it is standing still.
  - **The fists:** the closest they come to the victim's chest or head is 16 cm (at 0.35 s into the lunge). After that the gap only grows.
  - (Times here are the lunge's own clock. The pictures' captions also give the lab's time, which runs 1/60–1/30 s behind it.)
  - **With caps:** a fitted cap or `precinct_cap` makes the head overlap 35–37 cm.
  - **The docs disagree:** heist.md says the robbery's heads stay 1.9 cm apart. They don't.
- **Pictures:**
  - `01-robbery-heads-meet-grab-misses.jpg`: side, front quarter, and a cut through both heads at 1.40 m, where the white band is the overlap.
  - `01-robbery.webm` and `01-robbery-quarter-speed.webm`.
- **Likely fix:** the robber has to stop short with its head while its fists go on.
  - Pitch the lunge less, or shorten the root's lunge.
  - Or offset the pair sideways, so the heads pass beside each other and the fists land on the victim's shoulder.
  - Then re-time the victim's reaction to the contact.
  - The pair contract has only a straight gap (errands.md asked for an offset too).
- **Size:** medium. **Kind:** clip (pair staging).

### 2. Hands sweep through the thighs whenever a clip blends in or out
- **Clips:** 18 clips put a hand or forearm more than 1 cm inside a leg during a blend (on the bare legs).
  - The worst, taking the deepest of the bare legs, `ash_sweats` and `old_denim_turnup`: `sweep` 7.5 cm (226 vertices), `bench_stamp` 7.2, `dig_pick` 6.6, `patrol_walk` 5.9, `cuffed_walk` 5.8, `cuffed_idle` (and so `cuff_apply`'s suspect) 5.4, `flashlight_search` 4.9, `get_in_car` 4.8, `cower` 3.9.
  - Then `vault_drill`, `bench_hammer`, `bench_test_gun`, `bench_assemble`, `walk_hurt`, `hail_taxi`, `dig_shovel`, `carry_box` and `loot_carry` (1–5 cm).
  - The pocket clips (`deal_lookout`, `guarded_stance`, `brush_pass`, `listen_nod`) stay clear.
- **What's wrong:**
  - The blend mixes the arm angles straight from the plain stand to the clip's pose.
  - When the target is behind the back (the cuffs, the patrol's clasped hands) or in front of the thighs (a broom, a pick, a stamp), the hands pass through the legs on the way. The worst frames are at weight 0.2–0.6.
- **Why nothing caught it:** the hand gate (`lower-motion-check --clips`) only checks clips at full weight.
- **Measured:** depth inside the leg mesh, found by ray parity and the distance to the nearest leg triangle, every 1/30 s through every blend.
- **Pictures:**
  - `02-blends-hands-through-thighs.jpg`: the `cuffed_idle` blend-in from behind, the `sweep` and `patrol_walk` blend-outs, and a cut through the hips.
  - `02-cuffed_idle-blend-in.webm` and its quarter-speed copy.
- **Likely fix:**
  - Route the blend's arms round the outside: a short authored entry and exit for the behind-the-back and two-hands-in-front poses, or an IK target carried along a clear path, as `get_up` does for its hand.
  - Add blend weights 0.25, 0.5 and 0.75 at each clip's first and last pose to the hand gate.
- **Size:** medium. **Kind:** clip, plus the check.

### 3. The carry clips skid and sink their feet
- **Clips:**
  - `carry_box`: warehouse shifts and smuggling, every day.
  - `crate_run`: grab nights. `crate_lift`, `crate_tug` and `crate_ram` chain into it.
  - `loot_carry`: heists.
- **What's wrong:**
  - Each heel lands and skids forward before the foot plants.
  - The planted sole sits under the pavement.
- **Measured** (the lowest sole point while it touches the ground, every 1/60 s; skid = how far one contact point slides in one stance):

  | clip | skid per heel strike | how far the sole goes under the ground |
  |---|---|---|
  | the plain walk | ≤ 2.5 cm | 0.7 cm |
  | `carry_box` | 14–15 cm | 1.4 cm |
  | `loot_carry` | 26–29 cm | 4.9 cm |
  | `crate_run` | 28 cm | 4.6 cm |

  The runs are fine: `run_getaway` skids 7 cm, `flee_run` 4 cm, and `evicted_carry` and `walk_hurt` ≤ 3.3 cm.
- **Why:**
  - These clips lower the pelvis (`P.drop`) on the walk's keyed legs, which are never re-solved, so the feet go under the ground and each heel lands early.
  - `crate_run` and `loot_carry` also lengthen the cycle (`stride` 1.25 and 1.15) more than they scale the legs (`cLegK` 1.12 and 1.06).
- **Pictures:** `03-carry-skid-and-sink.jpg`.
  - The top is a footprint plot from above: a planted point is one dot, a skid is a line.
  - The bottom shows the feet at ground level.
- **Likely fix:**
  - No pelvis drop while the walk's legs carry the body. Put the heavy dip in the chest and the knees instead.
  - Match `cLegK`'s hip scale to `stride`.
  - Or give the carries their own planted legs, as `evicted_carry` has.
- **Size:** medium. **Kind:** clip.

### 4. `hail_taxi`: the arm flips when the hail ends
- **Clip:** `hail_taxi` (cabs: getting around).
- **What's wrong:** while the hail blends out, the +x arm jumps from out at the side to in front of the crotch in one frame, stays there for 0.1 s, and jumps back.
- **Measured:**
  - 63 cm in one frame (at weight 0.37), then 37 cm back (at 0.16).
  - A normal blend-out frame moves the hand 8 cm.
  - It happens when the stop falls between 0.1 s before and 0.5 s into one of the hold's waves. They come every 1.3 s, so it is about half of all hails, and every play in the lab.
- **Why:** the IK's angle decomposition switches branch as the wave moves the target.
  - At full weight both branches are the same arm, so it never showed.
  - The blend mixes the plain stand's angles with whichever branch is current.
- **Pictures:**
  - `04-hail_taxi-blendout-flip.jpg` (the +x side, then the front, every 1/60 s).
  - `04-hail_taxi-blend-out.webm` and its quarter-speed copy.
- **Likely fix:** fade the wave by the clip's weight, or stop it once the clip blends out. Better, keep the IK's angles on one branch (`transit.js` `ik()`, the `abs(ka) > π/2` flip). The same `ik()` is copied into other files.
- **Size:** small. **Kind:** clip.

### 5. Knockdowns: the hand goes through the head as the body lands
- **Clips:**
  - `fall_back`: `shot_hit` chains into it.
  - `shove_fall`: every robbery victim, and the end of `guard_bowled` and `crate_rammed`.
- **What's wrong:** the +x hand travels from the chest to the side of the head straight through the head's lower corner.
- **Measured:**
  - Up to 15 cm deep, 96 hand vertices, for 0.08 s: `fall_back` 0.97–1.05 s, `shove_fall` 1.27–1.35 s.
  - Seen from above as the fist sinking into the head and coming out under it.
- **Pictures:**
  - `05-fall_back-hand-through-head.jpg` (the +x side from above, every 0.033 s).
  - `05-fall_back.webm` and its quarter-speed copy.
- **Likely fix:** bring the hand to the head on a curve out at the side (as `get_up` brings its hand down), or reach the head pose after the landing.
- **Size:** small. **Kind:** clip.

### 6. The deal's hand-off doesn't show at the city's distance
- **Clip:** `brush_pass`. GAME.md §20: "Deal: hand to hand on a corner".
- **What's wrong:** from the city camera the two heads cover the hand-off. Seen from front or back it is two people standing with their heads together.
- **Measured** (25 m, 38° down, four angles):
  - The hands meet (≤ 9 mm apart at 0.2 s), but under the heads.
  - Side on, the hand-off is a few pixels between the bodies at belt height.
  - From the front or back it can't be seen at all.
  - This is the bribe's known speck, on the clip that plays far more often.
- **Picture:** `06-brush_pass-hand-off-at-25m.jpg`.
- **Likely fix:** a pop at the contact (0.2–0.35 s): a glint, a "$" or the packet flashing. Or the sideways pair offset (finding 1).
- **Size:** small (city). **Kind:** city staging.

### 7. Raised hands vanish when the walker is seen from the side
- **Clips:**
  - `hands_up_point`: the robbery victim's surrender.
  - `hail_taxi`.
- **What's wrong:**
  - From the front and the back at 25 m the raised hands show beside the head.
  - From either side (the walker's ±x) the head hides them, so the surrender reads as a head tipping back and the hail as a lean.
- **Measured:** 4 sides × 4 times at the city's pixel size. The hands are visible in 2 of 4 quarters.
- **Picture:** `07-raised-arms-from-four-sides-25m.jpg` (`cower`'s crouch reads from all four).
- **Likely fix:**
  - The replay already frames the victim: face it.
  - Or blade the body 30–45° during the gesture so one hand clears the head from the sides.
- **Size:** small (city) or medium (clip). **Kind:** city staging, or clip.

### 8. The vault shove never touches the guard
- **Clips:** `vault_shove` ⇄ `guard_bowled` (the heist's fight; a few a season).
- **What's wrong:**
  - At the shove the jobber's hands push air 23 cm short of the guard's chest.
  - Meanwhile their faces press together, so the guard is thrown back from the face.
- **Measured:**
  - **The hands:** 23 cm from the guard's chest or head at the contact (1.72 s). The closest any time from 1.55 s on is 23 cm; the clinch earlier is fine (the hands meet the guard's hands at 3 mm).
  - **The faces:** 1.4–2 cm into each other for two frames.
  - **The docs disagree:** heist.md says the heads stay 6.5 cm apart.
- **Picture:** `08-vault_shove-hands-never-touch.jpg` (side on and the guard's quarter, 1.55–1.85 s).
- **Likely fix:** reach the guard's chest at the contact: the guard leans in during the clinch, or the jobber's push target moves forward. Or own it as a head-butt.
- **Size:** medium. **Kind:** clip (pair).

### 9. A foot pops at every `deal_pace` loop, and two smaller loop pops
- **Clips:**
  - `deal_pace`: dealers on every corner, all day.
  - `sit_ride` and `pat_pockets`.
- **What's wrong:** at the wrap (every 6 s) the −x foot snaps from flat to heel-up in one frame.
- **Measured:**
  - `deal_pace`: 9.4 cm at the wrap. Its first heel lift, `cBump(ws, -.04, .2)`, starts before 0, so frame 0 already has the heel half up while the loop's end has it flat.
  - `sit_ride`: the head moves 2.5 cm at its 6 s wrap.
  - `pat_pockets`: the head moves 1.0 cm.
  - Every other loop is within 2 mm.
- **Picture:** `09-deal_pace-loop-wrap-pop.jpg` (the −x foot across the wrap, two cameras).
- **Likely fix:** start the bump at 0 (`cBump(ws, 0., .24)`), and key `sit_ride`'s and `pat_pockets`' heads back to their start.
- **Size:** small. **Kind:** clip.

### 10. Feet glide into a clip's stance and back out of it
- **Clips:** every standing clip whose stance isn't the plain stand's, plus clips that end mid-stride. How far the feet glide:

  | clip | glide | over |
  |---|---|---|
  | `walk_hurt` | 18 cm | 0.3 s |
  | `wired_bounce` | 17 cm | 0.25 s |
  | `vault_drill` | 14 cm | |
  | `lean_wall` | 13 cm | |
  | `cower` | 12 cm | |
  | `scuffle_pair` and its partner | 12 cm | |
  | `stand_rail`, `dig_pick`, `pick_lock`, `door_give` | 10 cm | |
  | `turnstile` (its last pose has a foot 30 cm forward) | 30 cm | its 0.3 s blend-out |
  | `rob_lunge_grab` (held) | 18 cm | |
  | `car_get_out` | 15 cm | |

- **What's wrong:** the blend slides the planted feet along the ground into the clip's stance, and back.
- **Measured:** each clip's first and last foot positions against the plain stand's. The blend makes this a slide, not a step.
- **Picture:** `10-feet-glide-on-blends.jpg`.
  - `wired_bounce` blending in, from above with the body cut away.
  - `turnstile`'s end, side on.
- **Likely fix:**
  - A short authored step in and out (`cStep`) for the wide stances, or plant the feet in world space while a blend runs.
  - `turnstile` should end with its feet together.
- **Size:** medium (one for `turnstile`: small). **Kind:** clip.
- `turnstile`'s glide is hidden if the walker walks straight on; the city decides that.

### 11. `shot_hit` spins on a turntable
- **Clips:** `shot_hit`, and `shot_hit_dead`, which is unused.
- **What's wrong:** the note says "one full spin on the right foot", but the whole body turns about its centre, so both feet slide round a circle.
- **Measured:** the right foot's contact point travels 1.46 m in 0.2 s (10–17 cm a frame).
- **Picture:** `11-shot_hit-turntable-feet.jpg` (from above, the body cut away at 0.42 m).
- **Likely fix:** pivot the spin about the right foot's ground point (`cPiv`).
- **Size:** small. **Kind:** clip.

### 12. Hands parked inside the bottom of the head, and blends through it
- **Clips:**
  - **Fists held under the chin:**
    - `crate_tug_lose`'s fists: 11 cm deep for 2.3 s (1.32–3.65 s).
    - `dig_shovel`'s hand on the shovel's top: 8.5 cm, most of the loop.
    - `sweep`'s broom-top hand: 5.1 cm, the whole loop.
    - `lean_wall`'s chin rub: 6.8 cm.
  - **Blends through the head:**
    - `cower` blending in (the forearm 5.7 cm at weight 0.7).
    - `loot_carry` blending out (the sack fist 9.3 cm at weight 0.5).
- **What's wrong:** the hands sit inside the head's underside, or cross it during a blend.
- **Measured:** hand vertices in the head's volume, every 1/60 s.
  - The head hides most of it from above.
  - From the side or front, the fist's top is cut off by the chin.
- **Picture:** `12-hands-inside-the-head.jpg` (the tug's loser alone from its front, `dig_shovel`, and the `cower` and `loot_carry` blends).
- **Likely fix:** hold those hands 5–10 cm lower, and route those two blends outside the head.
- **Size:** small. **Kind:** clip.

### 13. Hands and the phone pass through long hair and big ear items
- **Looks:** `hair:old_long`, `ears:old_phones` and `ears:door_knockers`.
- **What's wrong:** long hair and big ear items stick out past the head's box, so the clips' head clearances don't cover them.
- **Measured** (how far the hand, forearm or phone goes into the hair or ear item):

  | look | clip | depth |
  |---|---|---|
  | `hair:old_long` | `loot_carry` (the fist) | 9.9 cm |
  | | `sit_bench` and `skate_ride` (the forearm) | 7.5 cm |
  | | `flee_run` | 6.2 cm |
  | | `hands_up_point` | 6.1 cm |
  | | `spaced_walk`, `wired_walk`, `wired_bounce` | 5 cm |
  | `ears:old_phones` (the headphone cups) | `phone_tip` (the phone) | 11 cm, so the phone vanishes inside the cup |
  | | `lie_hurt`'s head-holding hand | 10.5 cm |
  | | `withdrawal_*` | 10 cm |
  | | `cower` | 7.3 cm |
  | | `hands_up_point` | 6.8 cm |
  | `ears:door_knockers` | `phone_tip`, `lie_hurt`, `hands_up_point`, `withdrawal_*` | about 5 cm |

  The withdrawal hand in long hair is known; these are the other clips.
- **Picture:** `13-hands-through-hair-and-ear-items.jpg`.
- **Likely fix:**
  - Look side: the long hair's side panels stop at the shoulders.
  - Hide the big ear items during `phone_tip` and the head-holding clips.
- **Size:** medium. **Kind:** look.

### 14. Lying heads push hair, tails and hats into the ground
- **Clips:** `fall_back` and `shove_fall` → `lie_hurt`, `get_up`, `shot_hit`'s chain.
- **What's wrong:** hair and hats are rigid with the head, so when the body lies on its back, whatever sticks out behind the head goes under the ground.
- **Measured** (the clips in use only):

  | look | how far into the ground |
  |---|---|
  | bare head | 4.8 cm |
  | `hat:old_silkrag` (the tail) | 45 cm |
  | `hair:old_long` | 35 cm |
  | `hair:sleek_pony` | 32 cm |
  | `hat:mack_brim` | 24 cm |
  | `hair:old_afro` | 20 cm |
  | `hat:pink_mink` | 17.5 cm |
  | `hair:fro`, `hat:block_bucket` | 15 cm |
  | `hair:box_braids` | 13 cm |
  | `hair:locs` | 12 cm |
  | `hair:old_opus_softserve` | 7.5 cm |
  | `hair:gilded_pineapple` | 5.8 cm |

  - The others tested (the caps, `high_top`, the ear items, the coats, the backpacks) stay at the bare head's 4.8 cm.
  - The unused `lie_still` adds `old_fitted` (12.5 cm), `high_top` (12) and `old_phones` (18).
  - From above it mostly looks like hair under the head. The brims plunge visibly into the pavement from low angles.
- **Picture:** `14-lying-hair-and-hats-in-the-ground.jpg` (`old_long` from above and low; `mack_brim` low).
- **Likely fix:** lift the lying head by the look's back extent (a per-look offset), or let the city accept it.
- **Size:** medium. **Kind:** look, or clip.

### 15. Forearms sink into the torso at a few moments
- **Clips:**
  - `bench_test_gun`'s slide rack: 12.4 cm (1.05–1.1 s).
  - `vault_heave`'s second heave: 8.2 cm.
  - `dig_pick`'s hand: 8.1 cm (2.0 s).
  - `vault_drill`: 6.2 cm.
  - `bench_assemble`: 5.7 cm.
  - `bench_stamp`: 5.6 cm.
- **What's wrong:** the forearm goes deep into the chest, past the normal "inner column graze", which is ≤ 3 cm on most clips.
- **Measured:** forearm and hand vertices inside the chest volume.
- **Picture:** `15-forearms-into-torso.jpg`.
- **Likely fix:** move the IK target or pole at those moments.
- **Size:** small. **Kind:** clip.

### 16. The lab: kickturns snap back 90°
- **Clips:** `skate_kickturn` and `skate_kickturn_r` → `skate_ride`, in the lab only.
- **What's wrong:**
  - `lab.js`'s `clipStep` moves the walker by `shiftNow` but never adds the entry's `turn` (CLIPS.md says the owner must).
  - So every kickturn in the lab ends with the rider snapping back to face the old way.
  - The city is fine if it follows CLIPS.md.
- **Picture:** `16-lab-kickturn-snaps-back.jpg`.
- **Likely fix:** in `clipStep`, add the finished clip's `turn` to `a.yaw` on its end frame. The state after a chain is the next clip's, so keep the previous one.
- **Size:** small. **Kind:** lab.

### 17. `deal_lookout`'s double-take snaps the head in one frame
- **Clip:** `deal_lookout` (dealers).
- **What's wrong:** the double-take turns the head about 0.5 rad between two frames.
- **Measured:**
  - `cBack(t, 4., 4.12)` × 0.8 rad starts at about 31 rad/s.
  - The head's corner moves 26 cm in one frame, 5× the frames around it.
- **Picture:** `17-deal_lookout-head-snap.jpg`.
- **Likely fix:** lengthen the ease to 0.2–0.25 s.
- **Size:** small. **Kind:** clip.

### 18. Padded coats' shoulders, and raised shoulders, push into the head
- **Looks and clips:**
  - `bubble_goose`, `old_furcoat`, `old_opus_snorkel` and `pawn_shearling`: their upper sleeves go 10–22 cm into the head's lower corners whenever an arm lifts. `skate_ride` 22 cm, `sit_bench` 21.6, `shot_hit` 20.7, `get_up` 19, `lean_wall` 18.7, `lookout_wave` 17.4, `dose_take` 16.8.
  - Bare: `shot_hit` 8.7 cm, `skate_ride` 8.1, `flee_run` 7.4.
- **What's wrong:** the head hides it. It reads as the head sitting low in a high collar.
- **Picture:** `18-padded-shoulders-into-head.jpg`.
- **Likely fix:** none needed for the game. If ever: narrow the padding at the shoulder cap.
- **Size:** medium. **Kind:** look.

### 19. The lab: lying loops blend out to standing
- **Clips:** `lie_hurt`, and in the lab every chain ending in it (`fall_back`, `shove_fall`, `shot_hit`, `guard_bowled`, `crate_rammed`).
- **What's wrong:**
  - The lab's cycle stops `lie_hurt` after 3 loops and blends it to the plain stand.
  - The body swings up off the ground like a plank in 0.4 s, the feet sliding and a hand 7 cm through the head.
  - The city goes through `get_up` instead, so this is the lab's only.
- **Picture:** `19-lab-lying-blends-out-standing.jpg`.
- **Likely fix:** the lab ends lying loops through `get_up`, or holds them.
- **Size:** small. **Kind:** lab.

### 20. Knockdowns put a foot under the ground mid-fall
- **Clips:** `fall_back`, `shove_fall`, `lie_hurt`.
- **What's wrong:** a foot sinks under the ground during the fall, and the bare head's corner digs into it while lying.
- **Measured:**
  - A foot 5.3 cm under the ground at `fall_back` 0.3 s, and 4.7 cm at `shove_fall` 0.57 s.
  - `lie_hurt`: a foot 4.3 cm under, and the bare head's corner 4.8 cm into the ground (0.37 and 1.37 s).
- **Picture:** `20-fall_back-foot-under-the-ground.jpg`.
- **Likely fix:** small key changes.
- **Size:** small. **Kind:** clip.

---

## At the city's distance

`25m/<group>.jpg`: every clip of each group at 25 m, 38° down, fov 22° on 640 × 360, cropped and shown 2×, 12 frames from the front quarter. They are new for the groups that never had one: robbery, falls, arrest, skate, ride, transit, deal-hang, talk-patrol and work.

Apart from findings 6 and 7:
- **Reads well:** the falls, the runs, the bike and scooter, the dig and carry clips, the cook, the drill.
- **Look alike:**
  - `talk_gesture`, `talk_gesture_b` and `talk_gesture_c` are nearly the same at 25 m. That's fine for variety.
  - `aim_fire` is `aim_hold` without the city's muzzle flash: the flash carries it.
  - `bike_coast` and `bike_pedal` look alike.
  - The stills of `crash_slump` and `withdrawal_shake` look alike; the motion tells them apart (the drugs agent's webms).
  - `cuffed_idle` is close to `guarded_stance`, but a cop is always beside it.
- **Read wrongly without their sets:** `car_get_in`, `get_in_car` and the sits (no seat) read oddly, as falling over or standing. That's city staging, not a bug.
- **Shading:** I rendered 36 hair and hat tops at 4 azimuths with `spaced_drift`'s rolling head (`25m/hair-and-hat-tops-az60.jpg`, `25m/hair-tops-az{150,240,330}.jpg`). None turns white the way `waves` does.

## What came out clean
- **Chains:** within 2.1 mm, every one. The 13 cm on `crate_*` → `crate_run` is the walk weight coming up as the carrier starts moving, not a pop.
- **Shifts:** none jumps the root. Every shift frame moves ≤ 9 cm, in line with its neighbours.
- **Props:** every held prop stays on its hand at full weight. Each prop "pop" the probe flagged (the phone, the lockpick, the cook stream, the stock item) was a hidden prop's collapsed point moving; I checked each by eye.
- **Elbows:** none folds backwards on a hanging arm, apart from these:
  - The cuffs' and the patrol's blends, where the hands go behind the back. That's natural.
  - One moment of `hail_taxi`'s rising arm (0.35 s), only a 31 % backward lean in the fold.
- **The other pairs:**
  - `scuffle_pair`, `brush_pass`, `cuff_apply` and `get_in_car` meet where they should: hands within 4–9 mm.
  - `crate_ram`'s crate stops 5 cm short of the rival at the ram. That's fine at 25 m.
  - The talks keep their heads ≥ 28 cm apart.

## What I couldn't check, and why
- **The full clip gates** (`check.mjs clips` without `--quick`) were not run.
  - They are now 882 hand shards plus 50 see-through shards for 104 clips. At the moods run's rate (556 jobs, 2 h 05 min at 12 jobs) that is about 7 hours at `--jobs 6`.
  - The quick gates already pass on main.
- **The city's stage itself** isn't in this tree.
  - My probe re-runs the lab's clip cycle with the city's rules from CLIPS.md: travel at `speed`, the shift and turn on the end frame, props at weight ≥ 0.6.
  - Each clip was played from a stand and from a walk.
- **Hands against the legs** were checked on 3 leg shapes (bare, `ash_sweats`, `old_denim_turnup`), not every bottom.
- **Looks:**
  - 30 looks (12 hair, 8 hats, 4 tops, 3 accessories, 2 ear items, 1 eyewear) on the 59 clips that move the head or arms most, plus the mannequin on all 104.
  - Not every trait on every clip.
- **Props** were tested against the walker's head, chest, pelvis and the ground, not against the legs or arms.
- **Elbows:** only the "hanging upper arm folding backward" test, not a full range-of-motion check.
- **Frequencies** come from GAME.md §20's plays, not from per-season counts, except where a group note gives them (evictions 14 a season, tips about 3).

## Known (in the brief; not ranked)
- **Props at weight 0.6:** the hand is 16–27 cm short (the sack 52 cm), and a bike or board pops in under a rider who is partway on.
  - My numbers: the `loot_carry` blend-out fist 36 cm from the sack at weight 0.61, the bike's bars 3.9 cm from the hands.
- **The gun and the hammer:** the gun shows on the hip at `aim_draw`'s start and goes at `aim_lower`'s end. `bench_hammer` still sweeps in at chest height.
- **The crate:**
  - No set-down, and it is hidden from behind.
  - Padded tops press 4–7.5 cm into it.
  - The tug's loser never wins.
  - Cap brims cross in face-to-face pairs. My numbers for the older pairs, with both walkers in a fitted cap: `scuffle_pair` 33 cm into the other's head (`nines_fitted` 23), `brush_pass` 24 (15), `rob_lunge_grab` 37 (bare 14), `cuff_apply` 15 (7.8), the talks 10.8 (5).
- **The bribe:** chins up, and the envelope is a speck at 25 m.
- **`waves`:** the top turns near-white at 25 m when the head rolls.
- **Errands:**
  - The gangway is one slope, up only.
  - Travelling clips run straight.
  - The eviction bundle has no pick-up or put-down: it appears in one frame, 79 cm of motion.
  - The guard's thumbs are in its belt.
  - `old_furcoat`'s cuff grazes the head by 2 mm in `evicted_carry`.
- **Drugs:**
  - The fist can't reach the mouth.
  - Long hair swallows the withdrawal's hand (I measured `old_long` 8.5 cm).
  - The puffer swallows the clutched hands.
  - There is no wall or kerb slump.
- **`phone_tip`** reads only from the front and the +x side.
- **Stale sheets:** heist's and bench's `filmstrip-25m-*.jpg`, and `heist/looks.jpg`.

## How it was measured (scratch tools, not in the repo)
- **The shader:** walk2.js `ANIM2_GLSL`, the cast's elbow, by WebGL transform feedback in headless Chrome. It runs on whole baked looks (12,352 vertices for the mannequin), plus reference points that give each rigid part's frame.
- **Playback:** the lab's clip cycle at 60 fps (`playClip`/`stepClip`, the pair's partner at its gap and delay).
  - The walker moves as the city moves it.
  - Each clip was played from a standing start and from a walk (1.2 m/s). Loops ran twice.
- **Overlaps:** a point's depth inside a part is measured against that part's rest voxels (head, chest, pelvis, feet; hollows filled), in the part's own frame. Hands inside the legs use ray parity against the posed leg mesh, then the distance to the nearest leg triangle.
- **Skids:** the lowest of three sole points (heel, mid, toe) while it touches the ground, and that point's world travel frame to frame.
- **Pairs:** minimum distances between one walker's hands and the other's chest, head and hands.
- **Pops:** a vertex moving more than 2.5× the median of its neighbouring frames.
- **Pictures:** the lab over CDP. Cut views use a clipping plane with inside faces drawn magenta. The two-colour overlap cuts render each walker alone and composite them.
