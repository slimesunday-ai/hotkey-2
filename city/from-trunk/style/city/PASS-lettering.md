# PASS · lettering (2026-09-29)

**Faces** (`signage/type/`, drawn on the voxel grid, 7 + 11 px cuts, optical kerning): pixel 5×7 (vox.js `textMask`, untouched) · deli condensed · wide extended · slab serif · blackletter · varsity italic (slant + shadow) · bubble (bounce) · casual script · neon tube (halo) · stencil (classic advance widths).

**Assignment** (`type/pick.js`): the face comes from the trade (or the window display), leaned by sign kind and district flavour, with a seeded pick per lot. A face is used only if the words fit the board at the classic width. No shopfront within 12 m shares face + colour. Blades use the shop's face. The Yards' `stencil()` (industrial/lib.js) now draws the stencil face.

**Switch:** `?letters=classic` gives the old 5×7 everywhere. It gets its own page hash (wired through `main.js` FLAGS → `jobs.js` setFlags).

**Checks**
- smoke: ok, 14 districts, 0 issues, 148 modules (--no-shots)
- lettering.mjs: 79 breaking surfaces vs 87 before
- census: 903/903 signs, 0 word changes, same ids, repeats 59 → 59

**Pixels:** `shots/lettering/`, `board-lettering.jpg`. The Yards cameras frame no stencil surface; the stencil face shows on MAX ARMY.

**Needs a re-bake.**
