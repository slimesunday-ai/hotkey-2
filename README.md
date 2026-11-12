# hotkey 2

A headless, seeded crime-economy game played by AI agents. Ten seats in a small city, five days of twelve hours, one
move an hour. Every class needs another class to make money, NPCs bring the trouble, owners spend their agent's skill
points every night, and the richest agent at the end wins.

This repo is the core game, tuned on free bot runs, and a playtest of it in a 3D city. It is a work in progress.

## Play it

You need Node 22 or newer and Chrome.

```
node demo/serve.mjs
```

Then open http://127.0.0.1:5470/demo/ and pick a seat.

- Nothing is installed and nothing costs anything: the rules, the other nine players (bots) and the city all run in
  the page. No account, no model calls. The page asks Google Fonts for one font and works without it.
- The first load takes several seconds while the part of the city you start in is built. After that each place
  loads during the trip to it.
- You pick one move an hour. Enter confirms. Space pauses. While your own trip is on screen, Skip (or Space, Enter,
  Esc) puts you at the destination.
- If you are hurt or arrested, the game waits for Continue before it takes you to the clinic or the jail.
- Known rough spots: people still move stiffly between actions, a trip takes 15 to 20 seconds if you watch it all,
  and buyers queue in one line at the plaza.

## The documents

- `SPEC.md` is the build spec, with the second review and slime's 11-11 direction folded in. Decision numbers (D12, D44…)
  match the plan page.
- `PAYTABLE.md` is what each class earns an hour at the current numbers, on paper. `TUNING.md` is what the bot seasons
  measured, which marks pass, and what is still failing.

## Run it

```
npm test                                   # the tests (node:test, no dependencies)
node scripts/paytable.mjs                  # rewrite PAYTABLE.md after changing a number
node run.mjs --bots --seeds 200            # free bot seasons and their marks
node run.mjs --bots --seeds 200 --all-marks  # every lineup: cautious, turtles, safe grinds, dead seats
node run.mjs --bots --seeds 20 --lineup small:dealer,robber  # a small lobby: two players' seats, eight locals
node run.mjs --ai --fake --lineup ai10 --seeds 1   # a free season with fake AI seats and a full episode page
```

A real AI season costs money and is never run by a builder. It refuses to start without `--max-cost` and `--go`.

## The demo: watch it, play it, coach it, in the 3D city

```
node demo/serve.mjs                      # then open http://localhost:5470/demo/
```

- The game plays at the city's REAL places (Sunny Acres, the Jay St night market, Glasswall Plaza, DEAD AIR,
  Pleasantview Park, Low Tide Docks, Precinct 9, Iron Island, St. Mercy) and loads only the one you are at: a few
  seconds the first time, about a second after that. A trip between places is a departure, a cut and an arrival.
- `/demo/?mode=watch&seed=4` goes straight into a season (`mode=play&seat=dealer`, `mode=coach&seat=robber`).
- Everything runs in the page: the rules, the bots, the stage. No model calls, no network (the panels' font falls
  back if Google Fonts can't be reached).
- `city/from-trunk/` is a pinned copy of the city (`node scripts/bring-city.mjs --check`), never edited by hand, and
  served as it is (`--overlay` puts last night's narrowed streets back). `demo/stage/` plays the game in it;
  `demo/hud/` is the panels. Nothing is built or dressed in the city: `demo/stage/set/` is only the pads' rooms and
  the time of day.
- Where the places are is data made from the city's own: `node demo/tools/place-table.mjs` writes
  `demo/stage/places.json` (re-run it when the pinned city changes); `node demo/tools/place-loads.mjs` measures
  the loads.
- A trip is a ride (`demo/stage/rides/`): the subway with the city's carriage scene, a scooter, a skateboard, or on
  foot, all at their own pace. Your own trip can be skipped: the card's Skip, Space or Enter, Esc in the carriage. `?rides=0` goes back to the plain walk and cut, `?cab=1` lets the cab be chosen, `?carriage=0` drops the
  carriage scene. `/demo/rides-dev.html` is the rides' own dev page.
- Arrested or hurt, the hour ends where it happened and the card waits: Continue takes you to the jail or the clinic,
  and each held hour waits for Continue unless "Let the hours pass" is on.
- SPEC.md section 24 has the decisions, the stage contract and what a bystander may see; section 25 is the big city:
  the real places, loading by place, travel as a cut, the rides, the press, room for an attack.

## Where things are

| File | What it holds |
|---|---|
| `src/config.mjs` | Every number in the game. |
| `src/map.mjs` | The city as data: blocks, links, spots, and the 3D city's place for each. |
| `src/state.mjs`, `src/ledger.mjs` | The season as plain JSON, and every dollar that moves, with a conservation check each hour. |
| `src/resolve.mjs` | One hour, in nine steps. Attacks land before anyone moves. |
| `src/deals.mjs` | Offers, the free accept, pick-ups, the courier, credit, loans, protection, paid jobs, gifts, the loan shark. |
| `src/attacks.mjs`, `src/contest.mjs` | Robbery, break-ins, fights, collecting, and the one formula behind every roll. |
| `src/work.mjs`, `src/tips.mjs`, `src/crews.mjs` | Each class's job, the informant's goods, and crews. |
| `src/npc.mjs`, `src/night.mjs`, `src/held.mjs` | The forecast and NPC trouble, the night, the clinic and the jail. |
| `src/view.mjs`, `src/menu.mjs` | What an agent sees, and its legal options with odds and reasons. |
| `src/stage.mjs`, `src/clips.mjs`, `data/city-clips.json` | A scene for every event, mapped to clips the 3D city already has. |
| `src/bots.mjs`, `src/lines.mjs`, `src/lineups.mjs` | Scripted players for the free runs. |
| `src/season.mjs` | The season loop, the night pause and resume. |
| `src/stats.mjs`, `src/report.mjs`, `src/paytable.mjs` | The marks, the report, the pay table. |
| `src/seats/`, `src/cli.mjs`, `run.mjs` | AI seats (Claude and OpenRouter) with the cost guards, and the runner. |
| `src/episode.mjs`, `src/words.mjs` | The episode page a person reads. |

`scripts/snapshot-clips.mjs` re-reads the 3D city's clip names from trunk as text. It never runs or edits anything there.
