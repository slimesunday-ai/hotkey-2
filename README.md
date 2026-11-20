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

**The run** (the newest way to play: one player, one save): open http://127.0.0.1:5470/demo/?mode=run&seed=3

- The first load can take up to a minute while the city is built.
- Pick a card with 1, 2 or 3, then Enter. The button at the bottom right always says what Enter will do. The mouse
  works on everything too.
- B shop, T travel, H home, Z sleep, M map, C you, L the library of everything you can own, G the guide. Space skips
  a scene, Esc closes one thing, I makes the interface smaller.
- **Try the fight:** step out of your trailer, press T, and take the last line, "TRY-OUT · Behind the dead mall".
  Pick a loadout with 1 to 5, set how hard with the up and down arrows (Jumped, Easy, Real, Hard), Enter to fight.
  W A S D moves you and your weapon fires by itself. B builds your own: every weapon says its job, the Doorman (a rush,
  up close) and the Long-eye (the ones who hang back) among them, and with Cousin Earl, how he fights: out in front,
  goes hunting, one at a time. Esc goes back to your run. Nothing there counts.
- Your run is saved in the browser. "New run" at the top left starts over.

**The older ten-seat game:** open http://127.0.0.1:5470/demo/ and pick a seat.

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
the trailer park and, one subway ride from it each, the Jay St night market (where you get jumped), Low Tide Docks
(tougher people, honest money, a box off a semi that turns into a fight) and Glasswall Plaza (where the police are the
danger), carry it home before the city takes it (batch-1: RUN.md "Low Tide Docks", "Glasswall Plaza"; food and drink
are capped at two a day, every place's together; Fit Street's walk adds a barber and DROP's sneaker wall). Play it in the terminal with
`node scripts/run-play.mjs --seed 1` (one key per choice: the number, or i inside, o step out, `4=2` to step out with
$2 for the fare, t the subway, h head home, s sleep, m morning, q quit; `3@2` does option 3 to its second target, r
robs somebody passing, b digs the bins, d buys the drink, z sleeps rough, g gives and x refuses the regular at your
door); `--choices 4=2,5,2,h` replays a list of keys.
Every option names the person it is done to; whoever you work is out for the rest of the day with a mood the view
shows, so the trailer park runs dry and points you to the market (RUN.md, "People"). Rules-2 makes the world answer
(RUN.md, "The world answers"): each place has its own heat and police, robbing somebody passing heats the place, the
bins cost energy, a regular comes to your door, you can stay out and sleep rough, the market sells a drink, and each
place has a supply the day draws down. A place is data: one entry in `src/run/config.mjs` (RUN.md, "Adding a place").
`node scripts/run-marks.mjs` measures RUN.md's marks on the real engine, free (3,000 seeded six-day seasons per
cell, about ninety minutes now; `--seeds 500` for a quick look, about fifteen; `--places` the new places' four alone). In the 3D city it is `/demo/?mode=run&seed=3` (`demo/run/`):
one frame over the city (the top line, a dock down the left with you in it, a thin bar along the bottom: the danger of
one more hour as a line on its top edge, the options one line each with their pay and odds, one slim row of what just
happened and the ways to move), each hour acted out with the stage's own scenes, 1 2 3 and Enter to choose, H
home, Space to skip a scene (`&scenes=0` plays it with no acting out). C opens your character (your figure turning,
your stats, what you are wearing, the people), A every move there is, S everything to buy, M the map (the kit's paper
map of the island, `city/from-trunk/style/city/ui/map/`, fed from the run by `demo/run/map.js`: you on it, the
stops, a ride to each from the park's stairs, a click on a stop for what it pays, its danger and who is left): one panel at a time beside the dock,
Esc closes it, and the numbers still choose on the bar. D folds the dock to a rail, F the bar to its one row (where
the numbers still pick, every option's pay and odds still on it); both kept in this browser, and the dock starts
folded. Going into the crib is a walk to its real door, a fade
through black and the whole room alone on the ground of its place (grass at the trailer park); the wheel zooms in on
it and the camera then follows you (`demo/stage/inside.js`: one contract any place with an inside plugs into). `node demo/tools/run-stage.mjs --policy market --seed 3`
plays six days on auto with the stage's audit on and ends `run-ok` or `run-fail`. A new run opens over the trailer
park and comes down to your trailer before the first morning (`demo/stage/opening.js`; Space, Enter or a click skips
it). The crib is a starter pack in the city's own home format, 7 m by 3.5 m (`demo/stage/set/homes/`, checked with
`node demo/tools/crib-check.mjs`; `&crib=b` for the second arrangement); the real bed shows in it once bought.
`node demo/tools/run-crib-shots.mjs --out <dir>` takes its pictures. `node demo/tools/run-places2.mjs --out <dir>` rides
to the docks and the plaza and plays their jobs, the walk's two new cards and the food cap with real keys, and ends
`places2-ok` or `places2-fail`. The bar's meter is the risk of one more hour: "RISK 15% · could be jumped", "RISK 41% ·
police could stop you", or "SAFE HERE".
**Fights** (duel-1, RUN.md "Fights"): a debt or a lift that goes wrong in the trailer park, and the regular at your door
who swings when you shut it, are a fight there and then: a one-on-one of the fight's own simulation
(`src/fight/duel.mjs`, both brawling by `src/fight/brawl.mjs`), seeded from the run's dice and decided by what you own
(the box cutter) and your energy; it IS the outcome, headless and on screen alike. Each card says it before you choose
("fails: a fight, ~4 in 10"; picked, the bar's row says what each of you brings and what it costs), and the stage
plays it between the two of you where the job's scene left you, with two bars over the picture (`demo/run/duel.js`;
Space, Enter or Skip jumps to the same result). One config block, `duel`; a job fights by its flag `fight: 'fail'`.
`node scripts/duel-table.mjs` is its balance table and targets; `node demo/tools/run-duel.mjs --port <p> --out <dir>`
plays a won and a lost one and the door in the page, skips them by key and by mouse, and ends `duel-ok` or `duel-fail`.
**Every weapon its job** (fight-3, RUN.md "Every weapon its job"): the fight's simulation has the Doorman and the
Long-eye, three punch styles (quick hands, the haymaker, the throw), five opponent styles for one-on-ones, Cousin
Earl's three ways, the small street fights (jumped, the corner, a raid), "built" cut to +10 and ×1.1, and no gun in a
one-on-one; the try-out page offers the guns, Earl's ways and Jumped. `node src/fight/table.mjs` is the arena's table.
**Fights in the run: styles and getting jumped** (styles-1, RUN.md): everybody who can fight you one-on-one has a style
(Benny Two-Coats a plain brawler, Big Lou carries a blade, Nadia Petrakis, Shaky Dee and the woman at the bus stop are
quick ones), said on the card before you choose; quick hands, the haymaker and the throw are each taught at one place
(Pockets at the market, Cousin Earl at home, Mr. Haines on the docks), learned once and kept; what you fight with is one
standing choice of what you own (You, Fight; E; at home), and every card's odds use it. Getting jumped is a fight you
watch, two at once where you stand, ending as the dice did (a bad one, a scuffle, nothing) to within 3 points; a visit
from somebody not of your street is somebody they sent; after a fight lost, one line of what would have helped. The
Library's Fight kind lists the ways to fight and where each is had. `node demo/tools/run-styles.mjs --port <p> --out
<dir>` plays it in the page and ends `styles-ok` or `styles-fail`.

**People remember** (memory-1, RUN.md "People remember"): a fight won or lost, robbing somebody to their face and the
door shut on a regular are remembered for a week, whatever the day's mood. Whoever you beat or robbed fears you (a debt
paid without a fight, no swing at your door, nobody tells, never the one casing your crib; no sales, no
work), until you lose a fight where they are; on the eighth day they are at your door for another go, warned the evening
before: pay them off or fight them. One visit a morning at your door. The People tab says who remembers what and for how
long. One config block, `memory`; the scripted `shark` leans on its own street and uses it.
`node demo/tools/run-memory.mjs --port <p> --out <dir>` plays it in the page and ends `memory-ok` or `memory-fail`.

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
