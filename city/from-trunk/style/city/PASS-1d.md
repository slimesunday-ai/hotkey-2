# Pass 1d: the distant fade, the audit, the handover

## What changed

**The fade is back at every height.** Street level uses the first example's `Fog(horizon, 90, 380)` exactly. Overhead the band tightens to 150 → 340, because from 150 m up the camera only sees about 260 m of depth. It blends between the two with camera height and always closes at 0.92 × the draw distance. New blocks and tier swaps dissolve in over 0.5 s with complementary dithers, so nothing pops. `?blur=1` is optional: nothing within 120 m, up to 2.4 px at 480 m.

**The audit.** `?audit=1` shows red boxes with labels, and `tools/audit.mjs` writes `AUDIT.md` and `audit.json`. Every item has a stable id, `block·group·kind·n`.

**Systemic fixes, each made once in shared code:**
- Placement checks masses, facades, doors and items, and slides or skips (logged).
- Props and people snap onto surfaces.
- Lots are clipped against their neighbours.
- The tower corner no longer overlaps the corner lot across from it.
- Boards cover their text.
- Display windows are unsealed.
- Stairs are continuous.
- Set pieces are fixed.

**The handover.** The heroes are split into `heroes/*.js`. Each block has an override file, `blocks/<i>_<j>.js`, verified end to end. Ownership is in `LOCATIONS.md`, and the rules are in STYLE §4 and §10.

## Audit (24 blocks)

| | before | after |
|---|---:|---:|
| floating voxels | 1579 | 8 |
| props sunk, in facades or buildings, overlapping, in doorways | 603 | 1 |
| text off its board or hidden | 186 | 3 |
| z-fighting | 54 | 3 |
| people inside geometry or floating | 41 | 0 |
| **total** | **2463** | **15** |

The 15 that remain are in heroes and one corner. 67 placements were refused rather than forced (see `LOCATIONS.md`).

## Bench (medium, 1080p, cold)

| | calls | tris | GPU p50 |
|---|---:|---:|---:|
| overview | 96 | 1.98M | 1.16 ms |
| avenue | 141 | 2.88M | 1.01 ms |
| side street | 126 | 2.91M | 0.88 ms |
| stress | 118 | 3.17M | 0.94 ms |

First view appears in 1.56 s and the section is fully streamed in 3.23 s. There are 471 people and 1622 items.
