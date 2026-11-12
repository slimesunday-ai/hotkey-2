# PASS · Blackpine Woods (forest) · batch 4

**Built.** `districts/forest.js` and `districts/forest/` cover the island's 289 non-urban land blocks: a coast 90–200 m out, the plan's LAKE, ponds, a sand rim on the bay. Pines and spruces make the dark ring; oaks, birches and maple groves line the city and water. Crowns are coarse 0.4 m cubes, no two alike.

Edge roads get a woods-side sidewalk (the city's furniture stands on it), then a wall, fence, hedge or guardrail per side. Five dirt tracks and six trails start at trailheads: the BLACKPINE WOODS sign and bus stop 14 on Birch St, a chain at Grand Ave's dead end, a pipe gate off Route 9. Plus a campsite, stand, dead car, log deck, dump.

**Heroes** (lazy, `far: 'kit'`):
- **lab-north:** a blacked-out RV; at night one dim light and glowing vents.
- **lab-west:** a log cabin.
- **lab-south:** a tin shack with a turbine vent.
- **the lookout:** a fire tower ending Central Ave's axis.
- **the leaf clearing:** crop beds, racks, lanterns; the sim's pile sits in a dug pit.

**Performance.** Full: a 0.4 volume and a 0.2 floor per block (20–90K tris). Mid: the same cubes at 0.8 (7–20K). Far: boxes (1.8K tris, 5 ms). At 1080p medium, cold:
- **First view:** overview 1.86 s (1.51 s without woods), other views 1.70–1.86 s, cached about 1.1 s.
- **Draw calls:** woods street views 81–136; bench avenue 237 p50 / 260 max (163 / 198 without); stress fly-over 155 / 234.

**Review fixes** done. **Audit:** 289 blocks, 0 issues, walk check 0. **Smoke:** modules load; forest passes through the preview; suburbs' issues aren't mine.

**Requests (systems agent).**
1. Apply `forest-core.patch`: `worldBlocks()` in main.js adds kits' non-urban `built` blocks to the universe; a kit `ground()` hook in ground.js paints their ground. Until then the woods don't stream. `forest-preview.html` shows them now; delete it, `forest-plan.js` and `forest-ground.js` afterwards.
2. Optional: merge adjacent woods far tiers (about +70 calls on long axes).
3. Route 9 runs off the south coast into the sea; the ground plane ends at z 448.
