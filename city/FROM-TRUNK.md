# The copy of the 3D city

`city/from-trunk/` is the city from the `trunk` repo, copied from one pinned commit. It is never edited by hand.
A change the city needs goes in our own files (`demo/`), or upstream by slime.

## The pin

| | |
|---|---|
| Trunk commit | `d5a6e641f95df0c1312d3e18a6f54d031ebb4911` (`d5a6e64`, committed 2026-11-19: `e04d2bf` plus the cart man's cart, drawn and approved: `world/named/props/` (`cart.js`, `build.js`), `world/named/index.js` (`PROPS`, `propOf`, `propByKey`), its check, its preview and pictures, and one option of `style/city/studio/audit/chrome.mjs`. Nothing else of the city moved) |
| Pin before | `e04d2bf31a037c621aa84041230205ee70112e58` (`e04d2bf`, committed 2026-11-18: `c370dfb` plus `world/named/` only, 40 new files: the named cast's own pool, all 34 people drawn by name, each with a `scale`) |
| Pin before that | `c370dfb94e6ded26faf51c9c4482c8ff5dab7527` (`c370dfb`, committed 2026-11-18: trunk's `8b0b8df` plus the asset passes' lane `lane/H1-homekit`: the home kit's fine pass, its new pieces, the second pass's fine grain for small things and its redraws, and the third pass: the owner's shortlist and thirteen more redrawn shape first, gold that reads as gold, clear case lids, the Doorman and the Long-eye; then the owner's calls after it: the tiger rug back to its drawing from before the third pass, the bust with the chain taken out) |
| Copied | 2026-11-19, by `node scripts/bring-city.mjs --pin d5a6e641` (trunk at `~/Desktop/ai-city/trunk`) |
| Files | 1,061, 20.6 MB |
| Stamp | `city/from-trunk/PIN.json`, written by the script |

The script reads the committed tree only (`git -C <trunk> archive <commit> … | tar -x`). It never reads trunk's
working files (trunk has two uncommitted files of slime's), never changes directory into trunk and writes nothing
there.

- `node scripts/bring-city.mjs` replaces `city/from-trunk/` with the pinned commit.
- `node scripts/bring-city.mjs --check` compares every file on disk with the commit by its git hash. It passes today
  (1,061 files). Run it before a commit: it proves nobody edited the copy.
- To move the pin, change `PIN` at the top of the script, run it, then run the proof again (`demo/tools/proof-shots.mjs`).

## What was copied

Trunk's layout is kept, so the city's own `../../world/…` imports resolve inside the copy.

| Path | Size | Why |
|---|---|---|
| `style/city/` | 16.5 MB on disk, 878 files | The city: `index.html`, `main.js`, the block builders and their worker pool, walkers, traffic, camera, clips, stage, interiors, the record player and its panels. |
| `world/` | 4.4 MB, 168 files | The character kit (`world/cast/`), the named cast's pool (`world/named/`, 40 files: one file a person, their `scale`), the city plan (`world/city.js`) and the exported map (`world/export/world.json`, `travel.mjs`). The city imports all three. |
| `sim2/places.json` | 64 KB | The place list the city's go-to menu reads. |

The biggest parts of `style/city/`: `ui/` 3.9 MB, `simstate/` 1.7 MB, `mainland/` 1.6 MB, `anim/` 1.4 MB,
`districts/` 1.3 MB, `interiors/` 1.0 MB.

## What was left out

| Path | Size in trunk | Why |
|---|---|---|
| `style/city/baked/` | 1.6 GB | The pre-built city. It is not in git at all. Without it the page builds its blocks in workers (`?nobake=1`, which `demo/boot.js` adds for you). Cost: the first load takes 19 s instead of a few seconds; later loads take 4 s from the browser's own cache. |
| `style/city/shots/` | 863 MB | Trunk's screenshots. |
| `style/city/tools/` | 33.7 MB | Trunk's check and screenshot tools (31.6 MB of it is saved runs). Our own are `demo/tools/`. |
| `style/city/board-*.jpg`, `render-presets-sheet.jpg` | 41.5 MB | Review sheets. |
| The rest of trunk (`core/`, `sim/`, the rest of `sim2/`, `docs/` …) | | The city page imports none of it. |

**One thing this leaves us without:** the city's record player (`?sim=record`) needs a recorded season
(`core/runs/…/feed.jsonl` in trunk). None is in the copy, so the record player cannot be started here. See
`city/API-NOTES.md`, section 14.

## three.js, vendored

The city is written against **three.js 0.185.1** and its own page loads it from the jsdelivr CDN. Ours does not:
`city/vendor/three/` holds the module build and exactly the addons the city and the panels import, 13 files,
2.17 MB, MIT licence, fetched once by `node demo/tools/vendor-three.mjs`.

- `node demo/tools/vendor-three.mjs --check` compares the files on disk with the hashes below (they are also in
  `city/vendor/three/MANIFEST.json`).
- The import map in `demo/index.html` points `three` and `three/addons/` at this folder.
- **The city's build workers are the catch.** They cannot use an import map: the city sends them its sources as text
  and rewrites a bare `three` to a CDN address fixed in its own `srcmap.js`, which we may not edit. So `demo/boot.js`
  wraps `fetch` for the city's `.js` files and rewrites `from 'three'` to the vendored file's full address before the
  city bundles them. Checked: with the CDN's host pointed at a dead address
  (`node demo/tools/stage-run.mjs --offline`), the page loads, builds its blocks and plays.
- The panels' own dev page (`demo/hud-dev.html`) still names the CDN in its import map, and the panels' stylesheet
  asks Google Fonts for one face. Both are the panel builder's files.
- When the pin moves and trunk moves to another three.js, change `VERSION` in the script, run it, and change nothing
  else.

SHA-256 of each file:

| File | SHA-256 |
|---|---|
| `build/three.core.js` | `3718df126d69c125362a03340913204470d8c50238605150e57f808840fb7759` |
| `build/three.module.js` | `bbf5ed13fe4373f5bd38b14ea8e62e9f157327da5638edc6d3863e08b167c9c7` |
| `examples/jsm/controls/MapControls.js` | `5a686152c498914389d1503b60121f484d06f15cb4f7405c15fb6b8ddcc1bdb6` |
| `examples/jsm/controls/OrbitControls.js` | `faabb4e8dfd9235ee4a9fd7c9a3d75f90f1689dbd4944bd6fd32117dacec5f93` |
| `examples/jsm/environments/RoomEnvironment.js` | `55f466192cc84298755a424c5e040345006b2ee1455589b3b54126c2ea4123f4` |
| `examples/jsm/postprocessing/EffectComposer.js` | `4e079a5886152d7e529a59aef644e968ab4d32c6a33ce016b36bf29b2eac26f7` |
| `examples/jsm/postprocessing/MaskPass.js` | `7cd08eee9d5d6f5578beaddbdcbe9c384f6873810af27f22ab7db3ceeb127aa3` |
| `examples/jsm/postprocessing/OutputPass.js` | `02e4a261af34de71338185e9e87f0cbe5cba9115608d984363e1269dec1d2272` |
| `examples/jsm/postprocessing/Pass.js` | `444b409c235ead986893c472e720da1b779a56985c7d10b279c7944b52bd61c5` |
| `examples/jsm/postprocessing/RenderPass.js` | `817f6c3cdcd0fd41515d112359ea0532568eefb5aabd3b33903957ebca1b8a6a` |
| `examples/jsm/postprocessing/ShaderPass.js` | `e2500a5913b26bbf5148ceaae644c6edcff06a18b01494ee37bf856353d2ab9d` |
| `examples/jsm/shaders/CopyShader.js` | `a33057d5ac91c43304c186ac0e8816e62bb2ed471d3a00ff3018dfd5c0389718` |
| `examples/jsm/shaders/OutputShader.js` | `353479f77a8d7e2629d49ccac9fc2f5dbfdda5442e0adf867b00377a2fcb0cb2` |

## Is the copy committed?

Yes, since `00f929b` (the lead's call). `node scripts/bring-city.mjs --check` proves it still matches the pin.
