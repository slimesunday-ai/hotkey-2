# PASS · streaming (systems agent, 2026-09-28)

**Root cause:** full data dropped past 2.2 × near was never re-requested (blocks stayed mid). Fixed.

**Flythrough** (`tools/flythrough.mjs`, cold): mean pop debt (visible blocks below wanted tier); Go-to = time to clean:

| | walk | drive | fly | zoom | Go-to |
|---|---|---|---|---|---|
| medium before | 2.52 | 3.74 | 1.23 | 2.51 | 0.92 s |
| medium after | 0.03 | 0.04 | 0.01 | 0.05 | 0.08 s |
| high before | 3.17 | 6.21 | 1.86 | 1.67 | 3/6 never |
| high after | 0.01 | 0.01 | 0.04 | 0.03 | 0.07 s |

- Empty in view ≤ 0.02; full detail within 150 m (high) 0–34 % → 100 %; frames p95 16.7 ms, no hitches; 0 people popping.

**First view** (`loadtime.mjs`, medium, cold / cached):
- before 2.06–2.25 / 1.14–1.37 s
- baked 0.85–1.48 / 0.52–0.79 s
- unbaked 2.06–2.30 / 0.97–1.28 s

Load-in released: medium 1.1 s, high 1.5 s (unbaked 6.3 / 17 s).

**Bake:** `node style/city/tools/bake.mjs`, 26 s, 371 MB (far 7, mid 102, full 230, people 32; day and night).
- Built in the page's workers (node lacks the signage fonts); every record round-trip checked.
- 1,064/1,064 tiers hash-identical to live builds; my job changes alter none.
- Stale bakes are ignored: rebake after build-code edits.

**Presets:** high (M Max/Ultra, discrete): 64 full blocks to 150 m, 400 mid to 460 m, everything preloaded. Medium/low: budgets kept, far + mid preloaded. M Pro → medium.

**Memory:** high 0.8–1.3 GB CPU, 0.7–1.0 GB GPU; medium 0.35–0.75 / ≤ 0.27 GB.

**Woods:** 38 % of the bake, 11 % of build time, 16–19 % of triangles, 12–21 % of GPU memory in view. Instanced trees would shrink the bake, not frame time or pop-in: not yet.

**Research:**
- Took: dither fades (also per woods chunk: 289 far jobs/draws → 34), wider hysteresis, frustum-first priority, travel prefetch, meshopt + gzip regions.
- Skipped: glTF, brotli, Cache API, benchmark tiers.

**Left:**
- A build memo ignores day/night: mixed workers alter night blocks (the bake runs one page per time of day).
- A cold high Go-to may drop one 66–100 ms frame behind the overlay.
- The designed loading screen hooks `city:loading`.
