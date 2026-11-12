# Store objects: PASS

75 objects, 186 variant/state builds, 0.05 m, with a 0.1 m `far` (37% of near triangles). Shots: `shots/interiors-store/`.

## By shop
- **Bodega (19):** shelves, gondola, cooler, plexi counter, backbar, deli, slicer, ATM, coffee, papers, cat, ice cream, cases, register, lotto, scratch-offs, stockroom
- **Pawn (6):** gold case, guitars, TVs, cage, rack, WE BUY GOLD
- **Cards (4) and sneakers (5):** slabs, binders, play table, grading; shoe wall, bench, mirror, grail, boxes
- **Streetwear (4) and barber (5):** rack, mannequin, fitting room, table; chair, station, cart, poster, pole
- **Laundromat (5) and food (8):** washers, dryers, table, change machine, cart; oven, slice counter, menu, booth, stool, counter, pie case, pizza boxes
- **Cash (6) and anywhere (13):** check and liquor windows, form desk, bottles, 99¢, pharmacy; phones, checkout, chairs, camera, CCTV, tubes, fan, mop, signs, vending, claw

## Mapping
`tiers` holds gen.js `disp` kinds plus `bodega`. `index.js` exports `FITOUTS`, `TRADE_FITOUT` and `fitoutFor({ type, disp, trade })`.

## Review round
- `far` stock sits on whole 0.1 m cubes: long single-brand runs, one-row strips, a silhouette per kind (bag tops, bottle necks, can rims, banded boxes). Shoes and gold get their own far look.
- `states`: the cooler is shut or open (its footprint holds the door swing); vending, claw and pole are lit or dark. `seat` and `vnames` are set; `buildObject` takes ids and states.
- Names vary; people stand clear.

## Notes
- `tops` lists free surfaces only.
- Glass is air plus a glint.
- Interiors get only sky fill; the preview adds light.
- `sim`: ATM `safe`, cage `lock`, camera `alarm`.
