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

**The run** (`RUN.md`, slime's 11-13 direction) is a new way to play beside the old rules, in `src/run/`: one player,
the trailer park and the flea market, carry it home before the city takes it. Play it in the terminal with
`node scripts/run-play.mjs --seed 1` (one key per choice: the number, or i inside, o step out, `4=2` to step out with
$2 for the fare, t the subway, h head home, s sleep, m morning, q quit; `3@2` does option 3 to its second target, r
robs somebody passing, b digs the bins, d buys the drink, z sleeps rough, g gives and x refuses the regular at your
door); `--choices 4=2,5,2,h` replays a list of keys.
Every option names the person it is done to; whoever you work is out for the rest of the day with a mood the view
shows, so the trailer park runs dry and points you to the market (RUN.md, "People"). Rules-2 makes the world answer
(RUN.md, "The world answers"): each place has its own heat and police, robbing somebody passing heats the place, the
bins cost energy, a regular comes to your door, you can stay out and sleep rough, the market sells a drink, and each
place has a supply the day draws down. A place is data: one entry in `src/run/config.mjs` (RUN.md, "Adding a place").
`node scripts/run-marks.mjs` measures RUN.md's twelve marks on the real engine, free (3,000 seeded six-day seasons per
cell, about five minutes; `--seeds 500` for a quick look). In the 3D city it is `/demo/?mode=run&seed=3` (`demo/run/`):
one frame over the city (the top line, a dock down the left with you in it, a thin bar along the bottom: the danger of
one more hour as a line on its top edge, the options one line each with their pay and odds, one slim row of what just
happened and the ways to move), each hour acted out with the stage's own scenes, 1 2 3 and Enter to choose, H
home, Space to skip a scene (`&scenes=0` plays it with no acting out). C opens your character (your figure turning,
your stats, what you are wearing, the people), A every move there is, S everything to buy, M the map (the kit's paper
map of the island, `city/from-trunk/style/city/ui/map/`, fed from the run by `demo/run/map.js`: you on it, the three
stops, the line, a click on a stop for what it pays, its danger and who is left): one panel at a time beside the dock,
Esc closes it, and the numbers still choose on the bar. D folds the dock to a rail, F the bar to its one row (where
the numbers still pick, every option's pay and odds still on it); both kept in this browser, and the dock starts
folded. Going into the crib is a walk to its real door, a fade
through black and the whole room alone on the ground of its place (grass at the trailer park); the wheel zooms in on
it and the camera then follows you (`demo/stage/inside.js`: one contract any place with an inside plugs into). `node demo/tools/run-stage.mjs --policy market --seed 3`
plays six days on auto with the stage's audit on and ends `run-ok` or `run-fail`. A new run opens over the trailer
park and comes down to your trailer before the first morning (`demo/stage/opening.js`; Space, Enter or a click skips
it). The crib is a starter pack in the city's own home format, 7 m by 3.5 m (`demo/stage/set/homes/`, checked with
`node demo/tools/crib-check.mjs`; `&crib=b` for the second arrangement); the real bed shows in it once bought.
`node demo/tools/run-crib-shots.mjs --out <dir>` takes its pictures.

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
