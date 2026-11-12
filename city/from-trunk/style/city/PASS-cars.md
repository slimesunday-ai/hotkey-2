# PASS · cars (2026-09-28)

**Fleet** (`vehicles/`): 12 models in `index.js` `VEHICLES`, with invented brands:
- Kubo Pixel sedan, Pixel Cab taxi, Sable Regent livery, Qwik Kargo bodega van, Haulr box truck, Ramrod pickup
- Bajito Deville lowrider, Kubo Nubbin beater, P9 Interceptor, Kool Kone ice cream truck, Vanta Stiletto (Gatehill)
- Metro 9 bus (never parked)

Cabins are solid, with drivers painted on the glass.

**Wheels:** separate 0.05 m voxel cylinders with a spoke and hubcap pattern. `wheels: [{x, y, z, r}]`; spin with `rotation.x += d / r`. Brake plates are a separate lit part.

**Helpers:**
- `vehicleProp` (stampable); `vehicleParts` and `vehicleTiers` (worker-safe).
- `three.js` has `vehicleGeometries` and `vehicleMesh` (`mats.tier`, scale 0.01).

**props.js:** `carVol` is gone. `car`, `taxi`, `copCar` and `carOnBlocks` use the registry, with the same signatures and no bigger footprint.

**Parked cars** (street.js `traffic()`):
- One-way streets park on the right-hand kerb. Avenues park in both kerb lanes (±3).
- They stay clear of crossings, hydrants (±1.6 m), stops (±2.2 m), crew-corner detours and anything already placed.
- Every parked car has kind `car`, so the old `taxi·0` overrides in −1_0 and −3_0 no longer match anything.

**Traffic agent:** avenue lane 3 in `lanesOf` is the parking lane. Drive avenues in lane 1 only.

**Cost:** ~3.5k tris per parked car.

**Shots:** `shots/cars/`.

**Gate:** smoke has 0 car issues, but it still fails on other agents' work in progress:
- 36 `prop-in-facade` on `street·sign`
- walker-overlap
- walkers on crossings running into newsboxes
