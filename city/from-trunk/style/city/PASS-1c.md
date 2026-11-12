# Pass 1c: the overhead view + the performance foundation

## What changed
- **Roofs are neutral.** Tar, gravel, concrete, greys and white, with neutral clutter.
- **Roof set pieces:** the colour now lives in 1–3 bold set pieces per block, 13 kinds: burger on a tank stand, billboard with a 4× character, pool, court, neon frame, garden, party, sneaker, boxing ring, grow-op, roof throw-up, pizza, cash stack.
- **Calm areas:** only set-piece roofs have people. 60% of blocks get a pocket plaza or green. Tower tops are neutral.
- **Side streets follow a rule.** Narrow streets are shot from an avenue mouth where one exists; otherwise the camera stands 3 m back from the crossing, centred.
- **Streaming and tiers:** near, mid and far block tiers in one cube grammar, plus three character tiers.
- **Workers and cache:** blocks, far tiers and characters are built in workers and cached in IndexedDB.
- **Tools:** presets with dynamic resolution, `?stress=1`, `?bench=1`. The overview is the default view; the old ring is now far-tier blocks.

## Numbers (1080p, medium)
- **Overview:** 96 calls, 2.0M tris, GPU 1.16 ms. Pass 1b was 265 calls, 16.5M tris, 4.1 ms.
- **Avenue:** 140 calls, 3.1M tris.
- **Stress fly-over:** 106 calls, 2.3M tris.
- **Load:** first view 1.5 s cold and 0.5 s warm; fully streamed 3.0 s (was 5.3 s).
- Details in `PERF.md`.

## Remaining gaps
- **The far-tier ring still reads busy.** One saturated mass per lot makes a field of small boxes, and the 30% haze mix leans pastel. Next: fewer, larger far masses and a lighter mix.
- **Walls stay saturated** per STYLE §2, so the overview is organised but not yet as calm as the references.
- **Stress-mode ground** only has the fine lane and zebra texture around section 1.
- **Frame p95 spikes** (21–33 ms) happen while streaming, from main-thread uploads.
- **Traffic is static.**
- **The laptop is untested.** Headless Chrome can't emulate a weak GPU.
- **Shots:** `shoot.sh` blanks past its 90 s cap under parallel load, so run at most two at once.
