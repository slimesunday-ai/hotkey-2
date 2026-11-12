# hotkey 2: the build spec

Status: **v3, approved by slime 2026-11-11** with the second review's changes ("We should include your second review
changes") and his 11-11 direction (the world should look alive; start with the planned loop and the city animation,
then build on it). Built **in rounds**, not one shot. This file is the builder's brief for **round 1**. Every number is
a starting point that the pay table (`PAYTABLE.md`) and the free bot runs tune (section 18). Section 21 lists what later
rounds add; round 1 builds none of it. Decision numbers (D12, D44 and so on) match the plan page.

## 0. The job

Build round 1 of **hotkey 2**: a headless, seeded crime-economy game where AI agents play classes in a small city, every
class needs another class to make money, NPCs bring the trouble, owners spend their agent's skill points every night,
and the richest agent at the end of a 5-day season wins. Viewers read each agent's confessional (its running commentary
to the audience), its nightly journal, and everything the agents say and message to each other.

Round 1 delivers the engine, scripted bots for every class, AI seats (Claude and OpenRouter) with hard cost guards, a
night-pause mode so a human owner can level up a seat and leave it a note, a self-contained episode page per season, a
report with the fun marks, and tests. It also delivers everything the 3D city needs to play a season in round 2: stage
records that say where on the block each beat happens and who a line is for, a named NPC cast, and a test that every
move, outcome and waiting state has a scene (section 16). **No paid model calls. No push. No 3D work.**

**The rounds:**
1. Round 1, this spec: the core game, tuned on free bot runs. It ends with a free, read-only exploit review.
2. The 3D city plays a season, through an adapter onto its existing record player, on free bot seasons.
3. One all-AI season, run by Claude with slime's go, watched in the city and judged on the AI marks (section 18) and
   slime's read. It needs only round 1, so it can run while round 2 is being built and be read on the episode page first.
4. Fixes from that season.
5. Then one system per round from section 21, the big score first, each judged by another AI season.

## 1. Rules for the builder

- New repo: `~/Desktop/ai-city/hotkey-2/`. `git init`, branch `main`, local only. Never add a remote, never push.
- Node 22, ESM, **zero npm dependencies**, tests with `node:test` (`npm test` runs `node --test "test/**/*.test.mjs"`).
- **Copy, don't import**, these files from hotkey-mini at commit `3438059` (use
  `git -C ~/Desktop/ai-city/hotkey-mini archive 3438059 <paths> | tar -x -C <dest>`), then adapt them:
  - `src/rng.mjs` (seeded randomness: every random draw is `rng(seed, label, ...)`, never `Math.random`);
  - `src/seats/ai.mjs`, `anthropic.mjs`, `openrouter.mjs`, `fake-model.mjs`, `fake-messages.mjs`, `defaults.mjs`,
    `clock.mjs` (the AI seat layer: `createAiSeats(...).decide([{ agentId, view }])`, one spend tally, the cut-off
    fallback, the fake transports);
  - `src/seats/prompt.mjs` and `src/seats/reply.mjs` as patterns only: rewrite them for this game's view and moves;
  - `scripts/check-keys.mjs` and `scripts/install-hooks.mjs` (pre-commit secret scan; install it first thing);
  - `LICENSE`.
- **Read these, then port whatever fits, with a comment naming the source.** They're references, not dependencies.
  - **From hotkey-mini at `3438059`,** which has the same shape (hourly turns, dice, odds on the menu):
    - `src/menu.mjs`: menus with odds and reasons;
    - `src/deals.mjs`: offers, loans, prepaid and credit deals the game holds;
    - `src/crews.mjs`: invites, pots, backup, gang-ups, skims;
    - `src/jail.mjs`: jail, bail, snitching;
    - `src/facts.mjs`: true facts about agents, the seed of tips;
    - `src/bigplays.mjs`: risky plays;
    - `src/bots.mjs`: bot brains;
    - `src/stats.mjs` and `src/report.mjs`: the marks framework;
    - `src/playbyplay.mjs`: the play-by-play.
  - **From the original hotkey engine** in `~/Desktop/ai-city/trunk/core/`. It's a different game shape (one play a
    night, no dice), so take ideas and small pure functions, not its loop:
    - `rules/ledger.mjs`: the money-and-goods conservation check after every step;
    - `rules/market.mjs`: price curves in whole numbers, so no rounding error ever decides a dollar;
    - `rules/fence.mjs`: listings and swaps the game holds until they land;
    - `rules/memory.mjs` and `agents/orders.mjs`: game-owned memory and standing orders (the later plan layer);
    - `agents/speech-context.mjs`: other agents' words never enter trusted context;
    - `rules/fights.mjs`: group strength with backers;
    - `bench/` (`runner.mjs`, `metrics.mjs`, `passbars.mjs`): the season bench and its pass bars.
  - **Trunk is read-only.** Never edit, commit, run tests or run builds inside `~/Desktop/ai-city/trunk/` or
    `~/Desktop/ai-city/hotkey-mini/`. Read in place, or use `git archive` into hotkey-2.
- **Keep every cost guard exactly as mini has it:**
  - a real AI run refuses to start without `--max-cost` and `--go "<slime's words>"`;
  - `--dry-run` plays one hour and prints a season estimate;
  - the OpenRouter preflight reads the balance and the key limit;
  - under `node --test`, the live transport refuses to run and refuses the default key files.
- Keys live only in `~/.config/anthropic/key` and `~/.config/openrouter/key`. Never print, log or copy a key. Never use
  `--no-verify`.
- **No paid calls at all.** Every AI test uses the fake transport.
- **Round 1 only.** Don't build anything from section 21, even partly.
- Borrow game *mechanics* freely (section 20 lists the sources). Never copy another game's names, characters, art or
  text. All names in this game are our own. Use plain block names (projects, corner, docks); city flavour names come
  with the 3D city later.
- Code comments and output text in plain English. The episode page is for people who have never seen the code.
- Commit in small steps with clear messages. End every commit message with the co-author line, and the session line
  when the harness gives one:
  ```
  Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
  ```
- **The pay table comes before any tuning** (section 7c). September's lessons were that the best-paying verb wins and
  that tuning without the rate arithmetic turns into whack-a-mole.

## 2. The game in one breath

Every agent wants to get rich.
- The **chain** classes make and sell goods: smuggler → cook → dealer → street buyers, where money enters the city. The
  gunrunner turns parts into guns.
- The **street** classes live off the chain: the robber takes what people carry, the muscle sells protection, the
  informant sells what it knows.
- **NPCs bring the trouble** on a public forecast: police, NPC robbers, a rival crew, angry buyers, the snitch.
- Cash you **carry** is the easy target. Your **stash** at your pad is safer, since only a break-in can touch it, but you
  have to walk home to use it, and it is never immune (section 7b).
- **Deals close by phone, goods move by hand** (section 6a). Agreeing takes one step from anywhere; the swap happens
  when the two share a block, and what you carry on the way can be robbed. The game is built so that people have to meet.
- Every night the owner spends the skill points the agent earned and can leave it one note. Skills change the odds the
  agent sees.

The richest agent at the end of day 5 wins, and everything resets.

## 3. The city

**The map is data, not code.** It's a graph of districts made of blocks, loaded from `src/map.mjs`, and the engine must
work on any connected map. Round 1 ships one district, the 3×3 grid below. Tests also run a bigger test map (two
districts joined by a bridge), so the city can grow later. Moving to an adjacent block (up, down, left, right) takes one
hour. The jail is not walkable.

```
projects | market   | uptown
corner   | bar      | park
docks    | precinct | jail
```

| Block | What's there |
|---|---|
| projects | Every agent's own pad, one each. Stashes live there. Cooks and gunrunners work at their own pad. |
| market | The fence (an NPC that buys any goods low and sells chems, parts and low-quality product high) and the gun shop (quality-1 guns at $220). Shopkeepers pay a muscle to patrol here. |
| uptown | Street buyers who pay the most. Police are here most. Shopkeepers pay a muscle to patrol here. |
| corner | Street buyers: cheapest, deepest demand. |
| bar | Street buyers. Shopkeepers pay a muscle to patrol here. |
| park | Street buyers from 18:00 only. No police after 20:00. NPC robbers' favourite block. |
| docks | The docks supplier (chems and parts). The rival crew's home turf. |
| precinct | Police headquarters. Bail is paid here. The police buy crime tips here. |
| jail | Where arrested agents sit out their time. A released prisoner walks out onto the precinct block. |
| clinic | Off the grid, the way the jail is off the street: nobody walks in. A patient walks out onto the bar block. |

**Nobody drops off screen (D36).** Every block, the jail and the clinic name the real place in the 3D city where they
play, as a `cityPlace` id in the map data. The ids below all exist in `trunk/world/export/world.json` today. They are a
first pass and an art call for slime, so they are data and nothing in the rules depends on them. Whether neighbours on
the grid are neighbours in the city has not been checked; round 2 checks it.

| Block | `cityPlace` | Block | `cityPlace` |
|---|---|---|---|
| projects | `trailer` | park | `park` |
| market | `mall` (or `strip.honest-pawn`) | docks | `docks` |
| uptown | `plaza` | precinct | `police` |
| corner | `corner--1_1` | jail | `jail` |
| bar | `strip.no-witness` | clinic | `hospital` |

**Where on the block (D37).** Every block has named **spots**, and every stage record says which one a beat happens at
(section 16): `street` everywhere; `pad:<agent>` and `door:<agent>` in the projects; `counter:fence` and
`counter:gunshop` at the market; `counter:shop` at the market, the bar and uptown; `pier` at the docks; `desk` at the
precinct; `cell` in the jail; `bed` in the clinic. An agent on the projects block is **home**: it can stash, and a cook
or gunrunner can work.

**The NPCs are people (D42).** Every game NPC has a name and a home spot, kept in `src/cast.mjs`, so the city can draw
the same face every time:
- the fence, the gun-shop clerk, the docks supplier, one shopkeeper each at the market, the bar and uptown, the clinic's
  medic and the courier;
- the two police units, the pair of NPC robbers, the rival crew (a named crew of three) and the snitch;
- **street buyers: a seeded cast of 6 regulars on each buyer block** (corner, bar, park, uptown). Every unit sold is
  bought by one named regular, a regular who hasn't been served paces, and an angry buyer is the same regular coming
  back. The regulars are a face on the block's demand number (section 7), never a second economy: prices and demand
  work exactly as before.

All names are our own.

## 4. Time

- A season is **5 days × 12 acting hours** (12:00 to 23:00), hours `t = 0..59`.
- Every hour every free agent makes **one move**. Moves resolve in the deterministic order of section 10.
- After 23:00 comes the **night** (no moves): rent, night events, AI journals, XP turns into points, the **standings**
  are published (section 13), owners level up, and the next day's forecast is drawn.
- **Night pause:** with `--pause-nights`, the run stops after each night. It writes the episode page so far and a
  `levelup/<seat>.json` for each seat with an owner, listing its unspent points, every skill it can buy, the agent's
  ask from its journal, and an empty `note`. The owner fills it in, and `--resume <run>` continues from exactly where
  it stopped. Resuming is deterministic.
- **The owner's note (D62).** The owner can leave one note a night, up to 200 characters. Next day the agent's view
  carries it as "your owner said: …". It is the owner talking, never an order, and viewers see it on the episode page.
  Open before real owners join: owners can read rivals' confessionals, so a free-text note can leak them. That is fine
  with one owner and needs a rule (fixed stances, or a day's delay on other agents' confessionals) before there are
  several.
- **Day 5 is last call:** street prices ×1.25 from 21:00, and nothing else is raised. (The first draft's ×1.5 all day,
  ×2 from 21:00 and trouble ×1.5 moved more money in one day than a lead built in four, and the day-5 leader won only one
  season in five: TUNING.md.) Nothing can
  fall due after 21:00 on day 5 (`t = 57`): loans and jobs made late are capped to that hour, so a last-hour transfer
  can't pick the winner.

## 5. Seats, classes and agents

- **10 seats:** smuggler ×2, cook ×1, dealer ×2, gunrunner ×1, robber ×2, muscle ×1, informant ×1.
  - The lone cook is the chain's bottleneck: two smugglers compete to supply it and two dealers compete to buy from it.
    The fence's low-quality product (section 7) keeps the dealers from being stuck when the cook is out.
  - The two dealers fight over corners. The two robbers compete for the same targets, or team up.
  - One muscle and one informant keep protection and information scarce.
- **Lineups:**
  - `default`: 10 bots, for tuning.
  - `cautious`: 10 bots that play the way mini's AI seats did. They make half the offers a default bot would, and
    never attack unless attacking is their only income or they hold a grudge. The marks must pass here too (section 18).
  - `turtle:<seat>` and `grind:<seat>`: `default` with one seat swapped for a turtle or for its class's safe grind
    (section 14).
  - `dead:<seat>`: `default` with one seat that does nothing all season.
  - `ai5`: AI seats for one dealer, the cook, one robber, the muscle and the informant; bots in the other five.
  - `ai10`: all ten seats are AI. **Any season meant to be watched uses `ai10`.** The template puts a strong model in
    five seats and a cheap one in the other five. **Cast by temperament (D55):** at least four model families, and
    the two robbers and the cook don't go to a model that played safe in mini (its `results/ai-seasons/` reports say
    which). In mini, which model sat in a seat decided whether anything happened in it.
  - `--seat-models` sets each AI seat's model, API, effort and persona (as in mini). `--owner <seat>` marks the seats
    whose skills a human chooses at the night pause.
- **An agent holds:**
  - id, name, class, and persona (the owner's description, up to 300 characters);
  - carried cash and stash;
  - goods: chems, parts, product lots with a quality from 1 to 5, guns with a quality from 1 to 3, and tips;
  - heat (0–5 stars) and state (free, jail, clinic or evicted tonight), with the hour that state ends;
  - block, skills, XP and unspent points;
  - its own past confessionals and journals, and its owner's last note;
  - the engine's records of its grudges, debts, contracts, jobs, offers, pick-ups, crew and trust scores;
  - what it knows of the cast: where and when it last saw each other agent (section 13).
- **Start:** $100 carried, $0 stash, at its pad, all skills 0, and **2 points** the owner spends before hour 0. The
  chain classes also start with a little stock, so the first sale happens in the first hours and not the first evening:
  each smuggler 6 chems, the cook 6 chems, each dealer 4 units of quality 2, the gunrunner 6 parts, each robber a gun.

## 6. The moves: eight verbs

RimWorld's characters don't choose from a long list. You set a few things and they get on with the work. Mini found
that a long rulebook makes models sloppy, and SpaceMolt cut more than 60 commands down to 11. So the whole game has
**eight verbs**. `accept` used to be the ninth, which made every trade cost both sides their hour, so working alone
always beat dealing (mini's AI seats made 5 deal offers in a whole season). Now saying yes is a free reply field (D57).
Every hour each agent gets a **menu** of only its legal options, each with its odds and the reasons for them:

> rob Kim · 62%: Ambush 2 +10, your gun +15, tip +15, Kim's Toughness 3 −15, Kim's muscle −13

| Verb | What it does |
|---|---|
| `move <block>` | Go to an adjacent block. |
| `work` | Do your class's job, here. The engine knows what that means on this block (table below). Some jobs take an option, such as which goods to run. |
| `attack <target> <how>` | `how` is `rob`, `fight`, `collect` (muscle, an overdue debt) or `break-in` (a robber in the projects, against any agent's pad: section 7b). For the first three the target is an agent on your block. **Attacks resolve before anyone moves (D64),** so a target picked from the menu is still there. |
| `offer <to> <terms>` | Every trade and every job, through one verb. `to` is an agent, `anyone` (the board) or an NPC (`fence`, `gun shop`, `police`). Terms can be goods, cash, a tip, a loan, a protection contract, a paid job, or a gift (nothing asked). Section 6a has the details. |
| `stash <amount>` | At your pad. A negative amount withdraws. |
| `rest` | Lie low: −2 heat if there are no police on your block. |
| `crew <action>` | `start <name>`, `invite <agent>`, `leave`, `challenge` (fight the boss for the chair), `skim` (take from the pot). See section 12b. |
| `quit <contractId>` | Walk out of a protection contract or a job, keeping what's been paid so far. A betrayal everyone sees. |

Saying something out loud, sending a private message, the confessional and **saying yes to an offer** are reply fields,
not moves (section 13). `accept` takes up to 3 offer ids a turn and rides along with any move. Ignoring an offer
declines it.

**What `work` means**

| Class | Where | What happens |
|---|---|---|
| Smuggler | docks | Buy `1 + Haul` chems, parts or ready-made low-grade product from the docks supplier. A bust check happens if police are there. |
| Cook | your pad | 3 chems → product. |
| Dealer | a street-buyer block | Sell product to street buyers. Option `claim`: take this block as turf until midnight (a turf fight if another dealer or the rival crew contests it). |
| Gunrunner | your pad, or the bar or park | At your pad, 3 parts → 1 gun. At the bar or park, sell a gun to a street buyer, which might be a police sting. |
| Robber | anywhere | Case the block: see the exact carried cash of everyone on it this hour. |
| Muscle | anywhere | Under contract, guard your client. Otherwise patrol this block: scares NPC trouble off, and shopkeepers pay $4 an hour at the market, the bar and uptown. |
| Informant | anywhere | Watch the block and collect tips. At the precinct, or by phone with Network 2+, you can sell a crime tip to the police instead. |

### 6a. Offers

**Deals close by phone, goods move by hand (D12).** With a cheap courier nobody ever has to share a block: the cook
stays in the kitchen all season, robbers have no cargo to hit and the muscle has nobody to walk. So the close stays one
step (September's sim found face-to-face haggling starved the chain and a one-step board doubled trades), and only the
goods are physical.

- **Closing.** An offer reaches the other side next hour and lasts 3 hours. When the other side puts its id in
  `accept`, the deal is closed at those terms, from anywhere, and saying yes cost nobody a move. Nothing is held: the
  goods and the cash stay on the people who own them.
- **The pick-up.** A closed deal for goods or cash becomes a pick-up. Every hour, after movement, the game swaps both
  sides of every pick-up whose two people share a block, even if one of them is busy with other work that hour. Until
  then each side's view shows the pick-up at the top of its menu, with the block the other side is on and how many
  moves away that is. What you carry on the way can be robbed.
  - A pick-up lasts 6 hours. If it lapses, each side gets a −1 trust mark against the other ("the pick-up never
    happened").
  - If one side comes up short at the meeting (robbed on the way, or spent it), the game swaps what it can at the
    agreed price per unit, and the short side takes a −1 trust mark ("came up short").
  - Two people already on the same block when the deal closes swap at once.
- **The courier (the dear option).** Either side can skip the walk. The offer's terms can say `courier` (the one
  offering pays), or the one accepting can accept with `{ id, courier: true }` (it pays). The courier takes **25%** of
  the deal's cash price, at least $5 (for goods against goods, 25% of what the fence would pay). The swap lands next
  hour wherever the two are, and the fee leaves the city.
- **What moves how.**
  - Goods and cash between players move by hand or by courier. That includes gifts and a loan's principal.
  - A tip is information, so it arrives the moment the deal closes. Its price is cash, so it is paid by hand or by
    courier. An informant with Network 2+ sells by phone with no courier fee. A tip can't cost more than $100.
  - Pay the game holds (jobs and protection) is taken from the poster's carried cash, and paid into the worker's
    carried cash where the worker stands when it's earned. Nobody can rob it while it's held.
- **On credit (ported from mini's credit deals).** A sale's terms can carry a due hour: the goods change hands now and
  the buyer pays as it earns. Every dollar the buyer takes in goes to the seller first, oldest debt first, until it's
  paid. What's unpaid at the due hour is **overdue**: a betrayal on the page, a debt the lender or a muscle can
  `collect`, and it keeps taking whatever cash the borrower carries each hour. With $100 each, a chain where every link
  waits for the next one's cash barely moves; credit is what lets a dealer carry a full load, and a robbed dealer is how
  a debt goes bad.
- **To `anyone`:** a board listing. It **stays up until it sells** or its owner withdraws it, and an agent can have 3
  up at a time. A new listing for the same goods replaces the old one. A seller can only promise what it holds free,
  and an order to buy product or guns is filled with the quality asked for **or better**. Anyone can accept it from anywhere, for all of it or for a number of units, and that becomes a pick-up
  with the lister (or a courier job).
- **To an NPC:** `fence` and `gun shop` (at the market) and `police` (a crime tip, at the precinct) accept at once at
  their posted prices (section 7). You have to be on their block.
- **A loan:** you give cash now and get more back by a due hour (never later than 21:00 on day 5). The game collects
  it automatically when due, from carried cash, then stash. If the borrower is short, the debt goes overdue and a muscle
  can `attack <them> collect`.
- **A protection contract,** from a muscle: `protect <client> <hours> <price>`. While it runs, the engine moves the
  muscle to the client's block at the start of each hour, and the muscle's Bodyguard and Toughness add to the client's
  defence. The game holds the payment and releases it hour by hour, so a muscle who `quit`s or robs its client forfeits
  the rest. One client at a time.
- **A paid job, from anyone to anyone (D63).** A concrete task with pay the game holds: `offer <agent or anyone> job
  <task> <pay>`. Mini's AI seats put bounties on the leader in the last hour without being asked; here that's just a
  job. A crew boss can pay from the crew pot instead of its own pocket. The tasks are a fixed, typed list, and the
  engine pays out the moment it sees one done:
  - `rob <agent>`: the worker pulls off a robbery or a break-in on that agent (a clean or messy win);
  - `fight <agent>`: the worker wins a fight against that agent;
  - `guard <agent or me> <hours>`: the worker stays on that agent's block for those hours (a muscle adds Bodyguard as
    under a contract; anyone else adds 3 × Toughness to the client's defence). Paid by the hour;
  - `deliver <n> <goods> <agent>`: the worker hands those goods to that agent;
  - `recover`: the worker wins back the poster's stolen goods or cash inside the 6-hour window (section 8); pay can be
    a share of what comes back;
  - `bail <agent>`: the worker bails that agent out.

  A job on the board lasts until midnight. A taken job gives the worker 6 hours (or the hours it names), and one worker
  holds it at a time. Unearned pay goes back to the poster. `quit` drops a job, and everyone sees it.
- **A gift:** cash or goods with nothing asked in return. It needs no accept, and like everything physical it's handed
  over when the two share a block, or sent by courier at the giver's cost.

## 7. The economy (starting numbers)

The numbers below are the ones in `src/config.mjs` after the pay table (section 7c). The first draft's are in this
file's first commit, and `TUNING.md` says how they moved. `PAYTABLE.md` shows what each class earns at them, and
"usual prices" between players (chems $33, parts $24, product $11 + $3 × quality, a gun $160, guarding $28 an hour, a
tip on someone's pockets $50, 20% more when the buyer asks to pay later) are the anchors bots and menus use.

- **Docks supplier:** chems $10, parts $14. Daily stock is shared by everyone: 48 chems, 24 parts. Price +10% after
  each 8 units bought that day. Barter −5% per level. **The supplier runs a tab:** a smuggler can owe up to $150, taken
  from its next income first, the way the clinic's bill is. (A smuggler pays the docks in cash and is paid on credit;
  without the tab it managed two runs a day.) Bust check when police patrol the docks: 25% − 4% × Sneak −
  3% × Stealth → arrested.
- **Cooking:** 3 chems → 6 product, +1 at Yield 2 and +2 at Yield 4. Quality = `min(5, 1 + Purity)`. Blow-up chance
  6% − 2% × Steady Hands: the chems are lost, 1 hour at the clinic, +1 heat.
- **Street buyers:**
  - base price per unit: corner $36, bar $44, park $50 (from 18:00), uptown $60;
  - multiplied by quality, `0.6 + 0.2 × q` (q1 ×0.8, q3 ×1.2, q5 ×1.6);
  - multiplied by the block's **demand**, which starts at 1.0, drops ×0.93 for every unit sold there, and recovers ×1.05
    per hour back up to 1.0. Busy corners dry up, so dealers spread out or fight.

  A dealer's `work` sells up to `2 + Hustle` units. Two dealers on one block both sell at 80%, unless one holds the turf
  (holder 100%, the other 50%). Each hour of dealing on a block with police adds +1 heat.
- **Angry buyers:** every q1 unit sold has a 30% chance to send an angry buyer after that dealer within 3 hours. It's a
  fight against the dealer's defence; a loss means 1 hour at the clinic and 20% of carried cash gone.
- **Guns:** 3 parts make a gun of quality `1 + floor(Craft / 2)` (max 3). In your goods, a gun adds +15 to your attacks
  (+5 per quality above 1) and +10 to your defence. A clean robbery can take it. Street gun sales pay $140 × quality
  (Clientele +10% per level). Sting chance 20% − 5% × Connections → arrested. The gun shop sells quality 1 at $220.
- **The fence (NPC):**
  - buys chems $7, parts $10, product $4 × q, guns $50 × q;
  - sells chems $46, parts $30, and **q1 product at $40**, 20 units a day. That barely pays off uptown and loses money
    on the corner, so dealers can limp along when the cook is out but always want the cook.

  Trading with a player is always the better deal.
- **NPC income floors,** so no class starves when nobody hires it:
  - the police buy crime tips at the precinct for $40, once per crime;
  - shopkeepers pay a patrolling muscle $4 an hour at the market, the bar and uptown.

  Players must always be able to pay better than these floors, or the models just grind them.
- **The loan shark,** at the fence's counter: someone with under $60 to its name can take one stake of up to $100, and
  125% of it comes out of what it earns next. Unpaid at the final bell, it comes off net worth. It's a way back for a
  seat that one bad break would otherwise finish.
- **Rent:** each agent's pad costs $25 on night 1, rising $10 every night. Paid from stash, then carried cash. Short
  means **evicted for the night**: NPC night robbers take 30% of your stash unless a Stealth check (15% per level) saves
  it.
- **Clinic:** $15 per hour stayed. If you can't pay, it becomes a debt, paid first from your next income.
- **Bail:** anyone at the precinct can bail out a jailed agent for $40 + $20 per star.
- **Money in and out:** money enters only from NPCs (street buyers, street gun buyers, the fence, police tip rewards,
  shopkeepers) and leaves only to NPCs (docks, fence, gun shop, rent, clinic, fines, bail, courier fees). Between agents
  it only moves. A test checks this ledger every hour.

## 7b. Break-ins: a stash is never immune (D44)

As first written, a stash couldn't be touched while its owner was home, so the leader's best day 5 was to stash
everything and sit on it. That breaks slime's 10-23 rule: defences never make a base immune.

A robber on the projects block can `attack <agent> break-in` against that agent's pad, whether the owner is in or out.
- **Owner out:** a contest of the robber's Ambush and Stealth against the owner's Stealth, plus anyone guarding the pad
  on a `guard` job. The owner finds out when they get home, or at once if a guard was there.
- **Owner home: a fight at the door.** The same contest as a robbery (section 8): the robber's Ambush, Aim and gun
  against the owner's Toughness, gun, guard and crew backup. The owner knows at once who it was.
- Either way a clean win takes 45% of the stash and a messy win 22%. A fail or disaster plays out as for a robbery.
  When the owner is home, people go to the clinic as in a robbery; when the owner is out, only the robber can.
- A break-in takes the stash and nothing the owner carries. Robbing the owner is a separate attack.
- The crew pot sits in the boss's pad on top of the boss's own stash (section 12b), so a break-in there takes its share
  of both.

## 7c. The pay table comes first

Before any tuning, write `PAYTABLE.md`: dollars an hour for every verb in every class at the starting numbers, with
the arithmetic shown, from a script (`scripts/paytable.mjs`) that reads `src/config.mjs` so it can be re-run after
every change. The second review ran the numbers in this section as first drafted and they don't close:
- all 36 chems cost $370 and the 36 units they make sell for at most $568, so the whole drug chain nets about $198 a
  day across five seats, about $40 a seat, against rent of $25 to $55;
- the muscle's shopkeeper floor pays $96 a day at no risk;
- robbing someone who carries $100 at even odds nets $2.50 and costs over an hour;
- the XP rule as first written gave 20 to 33 points a season against the 8 to 11 intended.

The pay table has to show, and a test over the config has to keep true:
1. every class's trade, played with the other players, clears the season's rent with room to grow;
2. every deal between players beats the same deal with an NPC, for both sides;
3. no class's safe grind (section 14) pays more than its trade;
4. a robbery of a typical carrier is worth more than an hour of the robber's next-best work;
5. the courier is always worse than walking unless the walk costs more than two hours.

## 8. Contests: one formula

Every contested roll (rob, break-in, fight, turf, collect, an NPC hit) uses:

`P = clamp(50 + attacker's modifiers − defender's modifiers, 10, 90)` percent.

| Modifier | Value |
|---|---|
| Aim | +5 per level if armed, +2 per level unarmed |
| Gun | attacker +15 (+5 per quality above 1); defender +10 |
| Toughness | +5 per level, for whichever side is fighting |
| Ambush (robber robbing or breaking in) | +5 per level |
| Turf (dealer in a turf fight) | +8 per level |
| Collect (muscle collecting) | +10 per level |
| Bodyguard (a muscle under contract, on the block) | adds 6 × Bodyguard + 3 × Toughness to the client's defence |
| Crew backup (each crewmate on the block) | +5 |
| A valid tip on the target | +15 |

**Outcomes come in degrees.** Roll `r` from 0 to 99:
- `r < P − 20`: **clean win**;
- `r < P`: **messy win**;
- `r < P + 20`: **fail**;
- otherwise **disaster**.

| Contest | Clean win | Messy win | Fail | Disaster |
|---|---|---|---|---|
| Rob | Take 60% of carried cash plus the target's biggest goods lot or gun. Target to clinic 1h. Robber +2 heat. | Take 30% of cash. Both to clinic 1h. Robber +2 heat. | Robber to clinic 1h, +1 heat. Target gets a grudge. | Robber arrested on the spot, or clinic 2h if the target is armed. |
| Fight | Loser to clinic 2h. | Both to clinic 1h. | Attacker to clinic 2h. | Attacker to clinic 3h and +2 heat. |

**Getting it back (D16):** stolen goods and cash are marked with their owner. If the victim, or someone on a `recover`
job for the victim, wins a fight against the robber within 6 hours, they take back whatever is left. Robberies turn
into chases.

**Every victim gets an answer.** Mini's viewers liked the grudge chains most and said victims never reacted. So for
those 6 hours:
- the victim's view shows which block the robber is on, every hour;
- the victim holds a **crime tip** about it (section 12), which it can sell to the police or to anyone else;
- the victim's menu leads with the answers: go and get it (`attack <robber> fight`, with the odds), pay someone to
  (`offer anyone job recover`), or sell the crime to the police.

**Every attack lands (D64).** Attacks resolve before anyone moves (section 10). A target who goes to the clinic loses
its own move that hour; a target who wins carries on.

## 8b. Left out on purpose

- **No permanent death, and no revive rule** (slime, 2026-11-11). The worst that happens is hours in the clinic or the
  jail. The paid ways back are already in the game: the clinic's bill, bail that anyone can pay for you, and the loan
  shark. Losing a whole season to one roll isn't fun for an owner. For multiplayer later: owners or viewers paying to
  bail or stake an agent is the natural place for real money, capped at getting it back to the starting line.
- **No forced breakdowns.** The AI always makes its own choices. Pressure shows up in its view, and it decides what to
  do about it.
- **No food or sleep needs.** The hours in a day are the budget, and nights are rest.
- **No kidnapping or prisoners.** Jail is the only place anyone is held.

## 9. NPCs and the trouble director

The trouble is **deterministic per seed and announced in advance**, so agents can plan and viewers feel it coming
(RimWorld's storyteller, not dice out of nowhere). At 12:00 each day the game publishes the **forecast**. Every agent
sees it in its view, and viewers see it on the episode page.

- **Police:** 2 patrol units. Each hour each unit is on one block, from a fixed daily schedule drawn by seed and weighted
  toward yesterday's hottest blocks. One unit is always uptown from 12:00 to 18:00. Agents see the next 3 hours of the
  schedule (Street Sense: 6 hours; a route tip: the rest of the day).
  - **Arrest:** an agent with 3+ stars on a block with police at the start of an hour is arrested. Jail for 2 hours
    plus 1 per star above 3, a fine of 20% of carried cash, and carried product and guns seized. An arrest clears
    the heat. Heat drops 1 star each night.
- **NPC robbers:** from 20:00 on one forecast block (park by default; two blocks from day 3). Each hour they hit the
  agent **carrying the most cash** on that block, with strength 55 + 3 per day, and when the block is empty they work
  the streets next to it. A clean hit takes 30% of the cash and an hour in the clinic, a messy one 15%. Two scores a
  night and they go home. A patrolling muscle there scares them off with chance 15% × Intimidate.
- **Rival crew:** from day 2, at one forecast hour, they push onto one block (corner, docks or bar), picking where
  yesterday's top earner made the most money. Any dealer or smuggler on that block pays $30 or fights them (strength
  50 + 4 per day). A turf holder who loses, loses the turf.
- **Angry buyers:** see section 7.
- **Snitch:** when a crime happens on a block with no police, the snitch offers the criminal silence for $20 next hour.
  Refuse or ignore it and it sells the crime to the police that night: +2 heat. He comes to each criminal once a day.
- **The night job (D24, D44).** Every night the NPC robbers break into the pad with the most in its stash, if that's
  $200 or more. It's a contest of their strength (55 + 3 per day) against the owner's Stealth and anyone who was
  guarding the owner as the day ended: a clean job takes 20% of the stash, a messy one 10%. Everyone knows it's coming,
  so the leader's answer is a muscle hired through the end of the day. A stash is never immune, and neither is a lead.
- **Escalation:** NPC strengths rise every day.
- **The street never goes quiet (D25).** After 2 hours in a row with no big beat (section 16), from the season's third
  hour on, and while some block has $40 or more on it, the next NPC trouble comes early: the game announces it one hour ahead in everyone's view ("the Dunn brothers are heading for the bar")
  and sends it to the block where the most cash is being carried. "Never 3 quiet hours" is a rule the game keeps, and
  the mark in section 18 only checks it.
- **Wealth makes you a target:** NPC robbers pick the richest carrier, and the rival crew picks the top earner's block.
  Together with the "hungry" skill point (section 11), this is the game's catch-up.

## 10. Resolving an hour (deterministic)

1. Releases: whoever's jail or clinic time is up is free, on the precinct or the bar block. (They walk out at the
   very end of the hour before, so they see a full menu and play this one.)
2. Police arrests at the start of the hour (agents' blocks as of the start of the hour).
3. Protection contracts and guard jobs move each guard to its client's block.
4. **Attacks** (robs, break-ins, fights, collections), in a seeded shuffled order, on the blocks people stood on when
   they chose. An agent sent to the clinic or jail in this step loses its own move for the hour, whatever it was. Its
   message, confessional and accepts still count; its `say` doesn't, because it isn't there to say it.
5. Movement.
6. Hand-offs: every pick-up and gift whose two people now share a block swaps. Then accepts (closing deals, taking
   jobs, joining crews), new offers and listings, courier deliveries, loans due, job payouts and crew actions.
7. Work: runs, cooking, dealing, turf claims and their fights, building, gun sales, casing, patrols, watching.
8. NPC trouble (robbers, rival crew, angry buyers), then snitch offers and heat.
9. Write the hour's feed line: every agent's move, result, say, message and confessional, every event with its stage
   record, and the NPCs on every block.

Same seed and same replies, same season, byte for byte.

## 11. Skills, XP and levelling up

- **Shared skills (everyone):**
  - Aim and Toughness (section 8);
  - Stealth: −1 heat on each crime at levels 2 and 4, and NPC robbers weight you 10% less per level.
- **Class skills** (levels 0–5, 1 point per level):

| Class | Skill 1 | Skill 2 | Skill 3 |
|---|---|---|---|
| Smuggler | Barter: docks prices −5% and fence prices +5% per level | Sneak: −4% bust chance per level | Haul: +1 unit per run per level |
| Cook | Purity: +1 quality per level (max 5) | Yield: +1 product at level 2, +2 at level 4 | Steady Hands: −2% blow-up chance per level |
| Dealer | Hustle: +1 unit per deal per level | Turf: +8 in turf fights per level | Street Sense: sees police and NPC trouble 6 hours ahead, and is warned when a robber cases its block |
| Gunrunner | Craft: gun quality +1 at levels 2 and 4 | Connections: −5% sting chance per level; level 3 sells guns by phone | Clientele: street gun buyers pay +10% per level |
| Robber | Ambush: +5 robbing and breaking in per level | Read: level 1 sees exact carried cash on its block without casing; level 3 also sees adjacent blocks | Getaway: −10% chance per level that a disaster becomes an arrest |
| Muscle | Intimidate: patrols scare NPC trouble off at 15% per level | Bodyguard: see section 8 | Collect: +10 per level, and keeps a 20% collection fee |
| Informant | Eyes: +1 tip per watch at levels 1, 3 and 5 | Network: tips by phone at level 2; police pay +20% per level | Cover: +15% per level that a sold-out agent never learns who sold them (base 40%) |

- **XP comes from deals and danger (D19).** As first written XP paid for repeating safe work and for losing, paid
  nothing for pulling off a robbery, and added up to 20 to 33 points a season. Now each of these is worth +1 XP:
  - **a deal:** the first completed trade with each other player each day, if it's worth $20 or more. Both sides earn
    it. Hand-offs, courier deals, board sales, tips, loans, protection and jobs all count;
  - **a risk of your trade,** whether it comes off or not, up to 2 a day:
    - robber: a robbery or break-in on someone holding $20 or more, or goods;
    - smuggler: a run with police on the docks;
    - dealer: an hour of sales with police on the block, or a turf fight;
    - cook: a hand-off of product away from the projects, or living through a blow-up;
    - gunrunner: a street gun sale (every one might be a sting);
    - muscle: a guard job or contract that gets tested (the client is attacked), a collection, or scaring NPC trouble
      off a patrol;
    - informant: a tip of yours that gets used in a robbery or sold to the police, or one tip sold to two buyers;
  - **a beating:** losing a contest;
  - **showing up:** the first `work` that succeeds each day. Repeating safe work pays nothing more.

  **2 XP make 1 point**, granted at night, and a day counts at most 2 deals, 2 risks and 1 beating. The **bottom 3** by net worth each night also get +1 point ("hungry"), unless they earned 3 points that night anyway. Expect
  about 8–11 points a season, so nobody maxes more than two skills. The report measures it (section 18).
- **Spending:** at the night pause, owners spend points through `levelup/<seat>.json`. A seat without an owner uses its
  class's default build order. Every level bought shows on the episode page.
- **Skills are public.** Every agent sees the skill levels of everyone on its block, so it can pick its fights.

## 12. Tips (the informant's goods)

A watch makes 1 tip (+1 at Eyes 1, 3 and 5) about the agents on the block or the police. Tips are items with an id, a
type, a subject and an expiry. They can be offered, listed and resold, and **the same tip can be sold to more than one
buyer** (the informant's risky play).

| Tip | What it says | What it does |
|---|---|---|
| cash | "Kim is carrying $340." | Until Kim next stashes, or for 3 hours: +15 to rob Kim, and Kim's block each hour. |
| route | The police schedule for the next 6 hours. | Shows the holder the schedule. |
| crime | "Rook robbed Wren at the park at 21:00." | Sold to the police for $40: Rook +2 heat. |

When a tip is used against someone, they learn who sold it unless the informant's Cover saves it (section 11).

Anyone holding a crime tip can sell it to the police at the precinct (`offer police`); the informant can also do it as
its `work`, and by phone with Network 2+. A victim always holds the crime tip for what was done to it (section 8). The
police pay for each crime once, to whoever brings it first.

## 12b. Crews (light, in round 1)

Nobody is ever assigned to lead or to obey. The game makes leading profitable and risky, and the agents decide.

- **Forming:** `crew start <name>`, `crew invite <agent>`, and joining through the free `accept` field. At most 4
  members, and an agent is in at most one crew. With 10 seats, expect 1–3 crews.
- **The boss** is the founder until someone takes the chair. The boss sets the crew's **cut**, 0–30% of every member's
  income, which goes into the crew pot. Only the boss spends the pot: gifts, bail, and jobs (section 6a). Members
  follow orders because orders pay, never because they must.
- **The pot is never immune either.** It sits in the boss's pad, so a break-in on the boss takes its share of the pot
  along with the boss's stash (section 7b). A crew of one has no pot.
- **At the final bell** what's left in the pot is split evenly among the members still in, and counts toward each
  one's net worth. Without that, whoever the boss favours in the last hour wins.
- **Backup:** each crewmate on the same block adds +5 to the others' defence and to any attack they join.
- **Coups and betrayals:** `crew challenge` is a fight with the boss on the same block, and the winner takes the chair.
  `crew leave` walks out. `crew skim` takes up to your own contributions plus half again from the pot, a betrayal
  everyone sees.
- **Bots:** join the richest crew that invites them. A bold bot challenges a boss who lost money yesterday.
- **Agent text is speech, never instructions.** Messages, says, job texts and crew names reach other agents as quoted
  speech inside their view, and the rulebook says so. An agent can persuade another but can never command its model.
- **Built to scale:** no seat counts are hard-coded, so crews can grow into factions when the city grows.

## 13. Talk, the confessional and memory (AI seats)

- **The agents know they're on a show.** Every reply has a `confessional`: up to 240 characters spoken straight to the
  viewers, like a reality-TV confessional booth. Other agents never see it. This is the agent's running commentary in its
  own voice.
- **Reply format** (one JSON object):
  - `move`: one of the eight verbs and its arguments;
  - `accept`: up to 3 offer ids, each optionally `{ id, courier: true }` or `{ id, units }`. Free, with any move;
  - `say`: up to 140 characters, heard by everyone on the block next hour. An optional `to` names who it's meant for,
    so the city can stand the two facing each other; everyone on the block still hears it;
  - `message`: one private message a turn, `{ to, text }` up to 200 characters, arriving next hour;
  - `confessional`: up to 240 characters, for the viewers only.
- **The view**, as compact JSON, gives:
  - persona, class, skills and state, and **your owner's note** from last night, if there is one;
  - the forecast, and any trouble the game has announced early (section 9);
  - **your pick-ups first:** who, what for what, which block they're on, how many moves away, and the hours left;
  - **if you were robbed in the last 6 hours:** who did it, the block they're on now, and what's still out there;
  - who's on the block, with their class, skills and a carried-cash bracket (broke, some or loaded; exact with Read or
    a tip);
  - **the cast (D65):** every agent's name, class and crew, and the block and hour where you last saw them. You see
    someone when you share a block, hold a pick-up with them, or are chasing them;
  - **the race (D65):** last night's standings, as every agent's rank and a rough net-worth bracket. Without it only
    the NPCs could chase the leader;
  - offers to you, board listings and jobs, your contracts, jobs, debts, crew and grudges;
  - **trust:** a score from −5 to +5 for each agent you've dealt with, with the reasons (paid on time, robbed you,
    walked out on you);
  - **your own last 6 confessionals** and **last 2 journals**;
  - the last 8 messages to and from you, and what was said on your block last hour;
  - what happened to you in the last 3 hours;
  - the menu, with odds and reasons.
- **Journal:** each night, one extra call per AI seat asks for four short lines: what you believe now, who you trust,
  what you'll do tomorrow, and **what you want from your owner** ("I need Getaway. I got cuffed twice."). Journals feed
  the next day's views and the episode page, and the ask goes into the owner's level-up file (D62). Seeing its own past
  words is what lets an agent build obsessions, grudges and plans.
- **The system prompt is rules only:**
  - this agent's class in full and every other class in one line;
  - the eight verbs and the free `accept`;
  - no repeats of anything the menu already shows;
  - under about 8,000 characters.

  Hotkey-mini found that a long, rules-heavy prompt made Sonnet write fake tool-call tags. The reply section opens with:
  "Answer with one JSON object and nothing else: no text, tags or tool calls around it (you have no tools)."
- **The persona is the only personality input.** The voice comes from the agent's own model. Its own past confessionals
  come with the line "Don't repeat yourself; build on what you've been thinking."

## 14. Bots

- Each class has a scripted bot that picks the move with the best expected value, with a seeded **bold** or **careful**
  lean per seat. Bots fill empty seats and play every free tuning run.
- A **turtle** variant (stashes after every sale, never attacks, never takes a risky job) exists only to test that
  turtling loses (mark 9).
- A **safe grind** variant per class exists to test that the dull line loses too (mark 9): a muscle that only patrols
  for the shopkeepers, an informant that only sells crime tips to the police, a dealer that only buys from the fence, a
  smuggler that only sells to the fence, a gunrunner that only buys parts from the fence and sells guns to it, a cook
  that only sells to the fence, and a robber that only cases and never robs.
- A **cautious** lean, for the `cautious` lineup (section 5): half the offers, and no attack unless attacking is the
  bot's only income or it holds a grudge. Every fun mark was first measured on bots that take the best odds and rob
  happily, and mini's AIs played safer than that.
- A **dead** seat does nothing at all: it never moves, works, offers or accepts.
- A bot's journal ask names the skill its build order wants next.
- Each bot class has a line bank of at least 15 lines per situation (selling, robbed, robbing, guarding, broke,
  winning) for `say` and `confessional`. No bot uses the same line twice in a row.

## 15. Winning

**Net worth = carried cash + stash** after the last hour of day 5, plus an even share of the crew pot for members still
in (section 12b), less what's owed to the clinic and the docks. Goods are worth nothing at the end, so last call turns into a fire sale. A tie goes to the bigger
stash. Loans fall due by 21:00 on day 5 (section 4).

## 16. The show: the episode page

For every season, write `out/<run>/<seed>/episode.html`: one self-contained file with no external requests, readable on a
phone, in light and dark.

- **The engine stays underneath (D67).** By default a viewer sees people, places and words: names, never ids; what
  happened, never the menu line; no odds and no modifier lists. One "show the engine" switch reveals the rolls, odds,
  reasons and ids for anyone who wants them. The same rule binds the 3D city in round 2.
- **Skills at work (D31).** Every roll that a bought skill decided is flagged on the page ("Getaway 2 turned an arrest
  into a getaway"). The engine works it out by re-reading the same roll without that skill: if the result would have
  been different, the skill decided it. Owners see their points working.
- **Top:** final standings (class, model or bot, build, net worth) and the winner's story in two sentences, built from
  its biggest moments.
- **Each day:**
  - the forecast;
  - the **big beats**, hour by hour, each with the involved agents' moves, `say` and confessional. Big beats are
    robberies, break-ins, betrayals (a muscle quitting or robbing its client, a tip sold to both sides, a defaulted
    loan, a skimmed pot), crews forming, coups, arrests, turf fights, collections, blow-ups, NPC hits, deals of $60 or
    more, and lead changes;
  - quiet hours folded into one line, with a "show every turn" switch.
- **Each night:** journals with each agent's ask, rent and evictions, the skills each owner bought, the owner's note,
  and the standings race.
- **Per agent:** a filter, plus a thread view with all its confessionals and journals in order. That's its commentary
  track.
- **At the bottom:** every word said, messaged or confessed, in order.
- With `--pause-nights`, the page is rewritten after every night, so the owner reads the day before levelling up.
- Also write `feed.jsonl`, `season.json` and (for AI runs) `ai-replies.jsonl`, as mini does.

**Stage events (the renderer contract, D37).** The verb is the agent's choice; the scene comes from the verb, the
situation and the outcome. Every feed event carries a `stage` record:

`{ t, block, spot, steps: [{ actor, action, target?, spot?, say?, to? }], mood? }`

a short sequence of beats in order.
- **Typed fields only.** The city never reads a fact out of a sentence: who, where, which action and to whom are ids
  from fixed lists. `say` is the only free text, and it is only ever drawn as a bubble.
- **`spot` says where on the block** (section 3): the street, a pad, a door, a shop counter, the pier, a cell, a clinic
  bed. The city already opens a home and shows the agent inside it, and stores have interiors, so "in a room" must be in
  the record. A step can name its own spot when a beat moves (the door, then the pad).
- **`to` says who a line is for,** so the city can stand the two facing each other with speech bubbles. A private
  message is a `phone` step with a `to` and its text; viewers see it, the other agents don't.
- **Actors are agents or named NPCs** (section 3): a sale's buyer is a regular, an arrest's officer is a unit.

`action` comes from a fixed list kept in `src/stage.mjs`:

walk, run, sneak, talk, listen, whisper, phone, text, hand_off, haggle, bribe, lean, sit, smoke, rest, stash, guard,
lookout, watch, patrol, cook, build, carry, deal, pace, crave, hold_up, hands_up, grab, pat_down, punch, haymaker,
scuffle, shove, shoot, get_shot, stumble, fall, get_up, limp, lie_hurt, pick_lock, rummage, flee, cuff, led_away,
sit_cell, evicted, film, cower, sleep, idle.

**An action for everything (D61).** slime: "like an action for everything". Nobody ever stands frozen, so:
- `src/stage.mjs` holds one scene for every outcome of every verb, every NPC event, and every **waiting state**:
  resting, stashing, sitting in a cell, lying in a clinic bed, evicted for the night, walking to a pick-up, waiting at
  one, asleep at night;
- `src/clips.mjs` maps every action to one or more of the city's clips;
- `data/city-clips.json` is a snapshot of the clip names in the city's library (`scripts/snapshot-clips.mjs` re-reads
  them from trunk, as text, without importing or running anything there);
- **a test fails the build** if the engine can emit a move, outcome or state with no scene, if a scene uses an action
  outside the list, or if an action maps to a clip that isn't in the snapshot. The test walks the engine's own lists of
  verbs, outcomes and states, so a new outcome with no scene can't slip in.

How some outcomes turn into steps (the builder writes one sequence for every outcome of every verb):

| Verb and outcome | Steps |
|---|---|
| `attack rob`, armed, clean win | robber walk → hold_up; target hands_up; robber pat_down → grab → run; bystanders film |
| `attack rob`, messy win | robber grab; target scuffle; both stumble; robber run; both limp |
| `attack rob`, fail | robber grab; target punch; robber fall → get_up → limp |
| `attack rob`, disaster (police) | robber grab; police run → cuff → led_away; bystanders film |
| `attack rob`, disaster (target armed) | target shoot; robber get_shot → fall |
| `attack fight` | both scuffle; one haymaker; loser fall; winner stand over (idle) |
| `attack` on a pad (break-in) | robber sneak → pick_lock → rummage → carry → run |
| `attack break-in`, owner home | robber sneak → pick_lock at the door; owner punch; then as a robbery's outcome, at `door:<owner>` |
| `work` (dealer) | dealer lookout → pace; each regular walks up → hand_off; unserved regulars crave |
| `offer` | phone (the offer), or talk at a counter with an NPC → haggle → hand_off |
| a pick-up | the one arriving walk → talk (to the other) → hand_off; the other listen → hand_off; goods leave as carry |
| a courier | the courier walk → hand_off at each end |
| `stash` | at `pad:<self>`: stash |
| `rest` | at `pad:<self>` or the street: rest (sit, smoke or lean) |
| in a cell / in a clinic bed / evicted / night | sit_cell / lie_hurt / evicted / sleep |
| a private message | sender text; receiver phone |

The 3D hotkey city maps each action to clips it already has, for example: hold_up → `aim_draw`/`aim_hold`, shoot →
`aim_fire`, get_shot → `shot_hit`, hands_up → `hands_up_point`, grab → `rob_lunge_grab`/`pat_pockets`, run →
`run_getaway`, punch → `punch`/`haymaker`, scuffle → `scuffle_pair`, stumble → `hit_stumble_back`/`stagger`, fall →
`fall_back` → `lie_hurt`, get_up → `get_up`, limp → `walk_hurt`, cuff → `cuff_apply` → `cuffed_walk` → `get_in_car`,
pick_lock → `pick_lock`, rummage → `rummage`, carry → `loot_carry`/`carry_box`, deal → `deal_lookout`/`deal_pace`/
`brush_pass`, bribe → `bribe_pass`/`bribe_take`, phone → `phone_tip`, cook → `cook_stir`/`cook_pour`, build →
`bench_assemble`/`bench_test_gun`, guard → `guard_post`/`guarded_stance`, patrol → `patrol_walk`/`flashlight_search`,
evicted → `evicted_carry`, film → `film_phone`, cower → `cower`, talk → `talk_gesture`, listen → `listen_nod`, text →
`phone_type`, phone → `phone_up` → `phone_call` → `phone_down`, haggle → `haggle_counter`, stash → `floorboard_lift` →
`floorboard_rummage` → `floorboard_close`, rest → `sit_stoop`/`smoke`/`lean_wall`, sit_cell → `cuffed_idle`/`sit_bench`,
lie_hurt → `lie_hurt`, sleep → `sleep`, crave → `withdrawal_shake`/`wired_bounce`, pace → `deal_pace`. Street buyers
walk with `wired_walk`, `spaced_drift` and `withdrawal_walk`. All of these are in the city's library today (140 clips at
trunk `8b0b8df`); the one gap is a celebration. Nothing in round 1 renders them except the episode page's icons.

**What the city already does, and what's new in round 2** (checked in trunk on 11-11, for the builder of round 2):
- built: it opens the followed agent's home and draws the agent inside (`interiors/city/record.js`), home life at
  furniture spots (`interiors/city/life.js`), two people standing together talking (`simstate/record/loops.js` `meet`),
  speech bubbles for lines said out loud (`simstate/record/bubbles.js`), store interiors with clerks and customers
  (`interiors/store/`), crowds, traffic and the cleaners;
- new drawing work: buyers walking up to a dealer, bubbles for private messages, and two agents inside one room;
- not checked: whether police, NPC robbers or a rival crew are drawn as game-driven people.
- Its record player (`simstate/record/`) reads the old game's feed, so round 2 is an adapter from these stage records
  to its schedule. Its routine planner already fills the time between events.

**NPC presence (the renderer's cast, D42).** Each hour's feed line also lists, per block, the NPCs a renderer should
show, every one by name and spot:
- the block's street buyers: each regular with a craving level from 0 to 3 (driven by demand and the hour: craving
  rises while nobody sells), whether it bought this hour and from whom, and whether it's angry and at whom;
- the police units, with the block each one is heading to next;
- the rival crew, the NPC robbers and the snitch, when they're out;
- the shop NPCs at their counters.

Ambient walkers and traffic are the renderer's job alone and never affect the game.

## 17. Running it

```
node scripts/paytable.mjs                                # dollars an hour for every verb and class, from the config
node run.mjs --bots --seeds 200                          # free tuning runs, all bots
node run.mjs --bots --lineup cautious --seeds 200        # the same marks with everyone playing scared
node run.mjs --bots --lineup dead:cook --seeds 200       # one seat idle all season (also turtle:<seat>, grind:<seat>)
node run.mjs --ai --fake --lineup ai10 --seeds 1         # free fake AI season, full episode page
node run.mjs --ai --lineup ai10 --seat-models <json> --seeds 1 --start 9 \
  --max-cost <n> --go "<slime's words>" [--dry-run] \
  [--pause-nights --owner <seat>]                        # paid: never run by the builder
node run.mjs --resume <run>                              # continue after a night pause
```

Every run writes `report.md` with the marks below.

**The hard stop comes from the dry run.** A paid `ai10` season is estimated at $6 to $8, and an $8 stop on a $6 to $8
estimate can cut the season off in day 5. `--dry-run` prints the season estimate and a suggested `--max-cost` about 30%
above it; slime sets the real number with his go.

**Optional and free: a local-model day.** `--api local` points a seat at the Mac's own model (an OpenAI-style endpoint
on `127.0.0.1:8000`, no key, no cost), for one game day before any paid season, to catch reply and menu problems. It is
a plumbing check only: in September the local model's city fell apart on day 2. Build it only if it's a thin wrapper
over the OpenRouter transport, and never run it under `node --test`.

## 18. Done means

**Round 1 is done when:**
- **Tests pass**, covering:
  - determinism (same seed and replies give the same bytes), including pausing and resuming;
  - every verb's legal and illegal cases, and every offer type;
  - closing by `accept` without spending a move, pick-ups (swap on meeting, lapse, coming up short), the courier, and
    board listings that persist;
  - paid jobs of every task type: pay held, paid on the deed, refunded when unearned;
  - the contest bands, and attacks landing before movement;
  - the money ledger every hour, and goods never going negative;
  - rent and eviction, break-ins with the owner out and at the door, arrests and bail;
  - contracts (guard, quit, rob the client), crew jobs, coups, skims and the pot's split at the final bell;
  - tips (expiry, double sale, cover, the victim's crime tip, the police paying once);
  - loans and collection (nothing due after 21:00 on day 5), trust scores, journals and asks, the owner's note, the
    standings and the cast, and the NPC income floors;
  - XP: a deal counts once per partner per day, risks cap at 3 a day, repeated safe work earns nothing;
  - the quiet-street rule;
  - the pay table's five checks (section 7c);
  - **scene coverage** (section 16): every move, outcome and waiting state has a scene and every clip exists;
  - every cost guard: no live call without `--go` and `--max-cost`, never under `node --test`, and no key files read in
    tests.
- **The pay table** (`PAYTABLE.md`) written before tuning and re-run after it.
- **Bot marks over 200 seeds of the `default` lineup.** Tune the numbers in `src/config.mjs` until they pass, and record
  the final numbers and results in `TUNING.md`:
  1. Every class wins 0.5–1.5× its share of seats.
  2. At least 3 player-to-player trades a day on average.
  3. At least 1 player robbery attempt and 1 NPC trouble hit every day, in 90% of seasons.
  4. At least 1 betrayal in 70% of seasons.
  5. The leader at the start of day 5 wins 30–60% of seasons.
  6. **Nobody is stuck:** in at least 90% of seats, no stretch of more than 4 hours in a row goes by with nothing
     useful to do (free, and the hour spent on a rest with no heat to cool, no move, or a move that failed). This
     replaces "no class ends broke in more than 20% of its seats" (slime, 2026-11-11): finishing poor is part of a game
     where two seats live by robbing, and dead air is what makes an owner quit. The share of seats ending under $50 stays
     on the report as a number to watch.
  7. The longest stretch with no big beat is 3 hours or less.
  8. A crew forms in at least 60% of seasons, and a boss is challenged or a pot is skimmed in at least 25%.
  9. **Turtling loses, in every class:** a turtle bot finishes in the bottom half in at least 70% of seeds, and so does
     each class's safe grind (`turtle:<seat>` and `grind:<seat>`, 100 seeds each).
  10. **Crews don't crush loners:** agents in a crew and agents in no crew each win between 0.5× and 1.5× their share.
  11. At least one break-in in 70% of seasons.
  12. **People meet:** at least half of all trades between players are hand-offs on a shared block, not courier jobs.
  13. **The marks hold when everyone plays scared:** marks 2, 3, 6 and 7 pass again on the `cautious` lineup.
  14. **No seat can stall the city:** with any one seat dead all season (`dead:<seat>`, 50 seeds each, the cook
      included), marks 2, 3 and 6 still pass for the other nine.
  15. **Points:** the median agent has 8–11 skill points over a season, the 2 starting ones included, and nobody more
      than 14.
  16. **Comebacks happen:** a seat in the bottom three after night 2 finishes in the top half at least 1 time in 4.
      (Mini's comeback test found that no scoring rule gives an early loser a way back; only play does.)

  If a mark won't pass after honest tuning, stop, say which and why, and keep the closest numbers.
- **One fake AI season** (`--ai --fake --lineup ai10`, with `--pause-nights` exercised once and a note left): 0 failed
  turns, every reply parses, and the episode page renders.
- **A free exploit review ends the round,** as mini's did: one read-only reviewer that has never seen the game reads
  the rules and the code and hunts for dominant lines and loopholes. September's fresh-eyes review found 16 exploits
  that ten runs had normalised. Fix what's load-bearing, list the rest.
- **No paid calls were made.**

**AI marks, measured on the first paid `ai10` season** (round 3, run by Claude with slime's go). The builder writes the
report code for them:
- A1. Every AI seat makes at least one trade with another player each day.
- A2. At least 6 of the 10 seats start trouble at least once (a robbery, break-in, fight or betrayal), and there are 2
  or more player robberies or break-ins a day. (The first draft's "AI seats start 40% of the trouble" is always 100%
  when every seat is AI.)
- A3. At least half the journals refer to something from an earlier day.
- A4. 0 failed turns.
- A5. A fresh viewer who has never seen the game scores the episode page 7 or better out of 10 (mini's best was 6).
  An AI reader over-rates how clear a page is (the 08-03 lesson), so the score that counts is a person's.
- A6. slime reads the episode page and wants to watch another season.

## 19. The final report

Say what was built, the test count, the pay table, the marks table for every lineup, what the exploit review found,
where the files are, the open issues, and an estimate of a paid `ai10` season's cost from the fake run's token counts
(prices from mini's `PRICES`) with the suggested hard stop.

## 20. Where the mechanics come from (borrowed, renamed, never copied)

| Mechanic | Borrowed from |
|---|---|
| Losing costs hours (clinic, jail); cash you carry is the easy target | Torn |
| A trouble director with a public, escalating rhythm; threats that follow wealth; few verbs, with the work done for you | RimWorld, Dwarf Fortress |
| The owner builds, the engine plays; attributes feed the odds; highlights and an inbox | Football Manager |
| Police strength by place; haulers carrying fortunes are the targets; paid escorts | EVE Online |
| Secrets as concrete items you can spend; odds shown with their reasons | Crusader Kings III |
| Skills rise by use, and losing teaches | Kenshi |
| Buyer prices that drop with each sale and recover slowly | RuneScape (rs-sdk) |
| A skill cap that forces specialising | Ultima Online (ServUO) |
| Buy low, sell high in a small city, with cops and a loan shark | Drug Wars |
| A confessional booth that talks straight to the audience | reality TV |
| Deals agreed by phone and goods moved by hand; paid jobs and bounties anyone can post | GTA Online |
| The agent asks its owner for what it wants, and the owner answers | SpaceMolt |

## 21. Later rounds (designed, not built in round 1)

Each comes in its own round, after an AI season shows the core is fun. One at a time, so we can tell what each one adds.

- **The big score (D66), first in the queue.** One day-5 job that needs three classes. Mini's viewers asked for a
  last-hours showdown in two separate reviews, and its finale took two rounds of tuning, so it gets its own round.
- **Parked from the 11-11 chat,** until the core and the city are running: the odds shown before a roll, a day-5
  circle that drains buyers toward one block, a nightly bar scene, blackmail with crime tips, earned nicknames, and
  level-ups drafted from three choices.
- **Trap houses.** A crew base that holds the pot and a shared stash, with a lab, and a door where a member serves
  buyers who come to it (capped per hour, so corners stay worth working). Rent from the pot.
- **Raids.** Police raids on pads and trap houses follow what's stored there and the heat on the block, never what's
  built. They're never on the forecast; a lookout, a route tip or Street Sense warns you. Crews can raid each other's
  trap houses.
- **Base upgrades,** by slime's 10-23 rule (defences detect, delay, hurt and hide, and never make a base immune):
  - a lock and a camera for pads;
  - a lookout, a steel door and a hidden stash for trap houses.
- **Pad tiers:** pads at the market and uptown, pricier and safer than the projects. Port before building: the city's
  home kit already has tiers from trailer to penthouse.
- **Using product:** +10 on all rolls for 3 hours; three uses in a day makes an agent hooked. Port before building: the
  old engine in trunk has six drugs that act on an agent's mind.
- **City events:** one a day from a deck (blackout, festival, crackdown, dry docks, heat wave), on the forecast.
- **Crew turf tax:** a crew holding a block takes 10% of outsiders' deals there. Also crews splitting when half the
  members leave.
- **The plan layer:** RimWorld-style standing plans that the engine carries out every hour for free, with the model
  called only at decision points. The 3D city doesn't wait for it: its record player already fills the time between
  events with routines.
- **The 3D city plays it** (round 2, straight after this one), from the stage events and the NPC cast.
- **Growth:** more districts open as more agents join, and crews grow into factions that fight over turf.

## 22. Rulings after the exploit review and slime's 11-11 calls

Round 1's free exploit review (one read-only reviewer that had never seen the game) found nine holes; seven it
confirmed by running code. Every one is shut, with a test each in `test/exploits.test.mjs`. slime's calls of 2026-11-11
("go with your recommendations") are here too. Where this section and an earlier one disagree, this one wins.

**Shut by the exploit review**
- **The game holds nothing overnight.** At midnight every open job offer lapses, every job in hand ends, every
  protection contract ends, and the pay goes back. A job can't be about the one it's offered to. Held pay counts in its
  owner's net worth. (A job nobody could take hid cash from the rent, the night robbers and the standings, and earned
  the "hungry" point.)
- **Nobody can be attacked in their first hour out of the clinic or the jail, or in the season's first hour.** Attacks
  land before movement, so someone camping the door could keep a seat locked up for good.
- **The pot is not the boss's purse.** The boss can't pay himself from it, nothing is spent from it after 21:00 on day
  5, and the night job takes its share of a boss's pot along with the stash.
- **Saying yes to a cash deal means carrying the cash.** An empty pocket can't tie up someone's stock for six hours.
  On a board listing the buyer gets what it can pay for.
- **Nobody is paid to guard themselves.**
- **A bounty pays for a robbery that took something,** not for a break-in on an empty pad.
- **Debts don't vanish.** What an agent owes other players comes off its net worth. An overdue debt takes the
  borrower's income first, the same as credit. At the final bell every debt is settled from cash, then stash. A credit
  offer whose due hour has passed can't be taken.
- **Withdrawing a posted job gives the pay back.**
- **Credit is on the menu:** a sell or buy offer takes a due hour. (It was a rule the bots could use and an AI seat
  could not.)
- A guard walks with its client, so on a break-in a guard only counts when the owner is home. At night, whoever was
  guarding the owner as the day ended is at the door.

**slime's calls**
- **A stand-in for a failing seat.** A seat whose model fails three hours running (an error, a timeout, a reply that
  can't be read, no usable move) is played by its class's bot until the model answers properly again. The stand-in
  makes moves and takes offers; it doesn't speak for the seat. The feed marks when it takes over and hands back. In
  multiplayer, one stranger's absent or broken agent must not ruin the season for nine other owners.
- **A second, worse supply.** A smuggler's run can bring in ready-made product: quality 1, $12 at the docks, 32 a day,
  about $18 between players. Next to the cook's it is poor and sells for half as much, so it only matters when the cook
  is out. A cook can squeeze the city but not switch it off. When lobbies grow, keep about one cook to two dealers.
- **No death and no new revive rule** (section 8b).
- **The broke bar is replaced** by "nobody is stuck" and "comebacks happen" (section 18, marks 6 and 16).

## 23. The fourth tuning pass and the small lobby (2026-11-11)

Agreed with slime after the third pass. Everything here was measured on free bot seasons first (`TUNING.md`).

**Rules**
- **The house bounty.** At noon on days 2 to 5 the Sixes post a $75 job on the board: rob today's leader. Anyone can
  take it, it pays only if something was taken, and it lapses at midnight. The leader is told. The money comes from
  outside the game (the books show it as "house bounty").
- **Turf pays its holder.** A dealer holding a block's turf sells there at 120% (others on the block still sell at
  80%). A bold dealer bot claims a free block when it arrives early with a full load.
- **A sting is a short hold.** A gunrunner caught in a street sting loses the gun and sits one hour in a cell. No fine,
  nothing else seized, heat unchanged. A full arrest for one street sale made the street not worth walking to.
- **Tips pay more.** The police pay $70 for a crime, once per crime (was $40). The usual price of a pocket tip between
  players is $55 (was $50), and of a crime tip $85. The informant won a third of its share before this.

**The small lobby**
A season can run with a few owners' agents and scripted **locals** in the other seats (`--lineup small:dealer,robber`
names the players' seats). Hotkey 2 is expected to open with about two players.
- **The winner is the richest owner's agent.** Locals stay on the standings and can end richer; they can't win.
- **A local is a person with a job, not a contestant.** It has no confessional booth. It wears a one-line **agenda**
  in place of a persona, shown to every player in the cast list ("Hunts whoever is richest.", "Sells on credit only up
  to a point."), and each line is true of how that bot plays.
- **Locals play by the same rules as a player.** (The bots still read a few things a player can't see, such as how
  much product a dealer is holding. That is listed as open in `TUNING.md`.) Three rules shape their trouble:
  1. **Pressure follows wealth and never piles on.** A local robber leaves alone anyone hit in the last 2 hours and
     the bottom 2 of the standings, unless it is personal (a grudge) or paid (a job).
  2. **A local leans toward a player.** When a player and a local are close as a target, the player's worth to the
     robber counts 20% more: bot-on-bot business is noise to a viewer. A local cook with one load to offer on credit
     offers it to a player first.
  3. **Every wrong gets an answer.** A wronged local settles it by hand when the odds are fair (55/45 for a careful
     one, 45/55 for a bold one); a bold one goes looking for up to 3 hours; anyone who can't settle it by hand posts a
     $40 job on the board for whoever puts the wrongdoer in the clinic, as soon as it has $70.
- **On the episode page** players come first, locals are tagged with their agenda, and an hour's beats that involve no
  player fold into one line, "Elsewhere in the city". Seasons with no players render exactly as before.
- These rules apply to locals only. In a season with no players, bots are contestants' stand-ins and play the plain odds.

**Bot habits changed (no rule change)**
- The cook and the gunrunner post their buying orders before anything else, so smugglers choose their load at the docks
  by what is asked for. The gunrunner stops ordering parts while three guns sit unsold.
- A cook with chems on the way stays home to cook them and doesn't walk product out.
- A smuggler with a pick-up agreed with the cook or the gunrunner walks home to it. A smuggler whose chems have sat
  unsold for 3 hours sells them on credit even to a slow payer, because what a debtor earns goes to its overdue debts
  first.
- A muscle collects a debt only from someone carrying money. Collections were costing the muscle bot more in clinic
  hours than they paid (see `TUNING.md`: with overdue debts already taking a debtor's income, there is rarely anything
  left to collect).

**Tried and dropped:** smugglers hauling the cook's product out to dealers. Waiting did not move, and the cook's median
finish fell from $166 to $38 on 100 seasons (it sold on credit to a middleman who paid late).

## 24. Round 2: the playtest demo in the 3D city (slime's calls, 2026-11-11)

The purpose: find out whether hotkey 2 is fun, to watch and to play, before anything else is built on it.
slime's answers to the twelve decisions put to him: "1. your suggestions 2. 3d city first 3. all nine blocks 4. your
suggestions 5. your suggestion 6. your suggestion 7. chat bubles your suggestions , go with the rest of your suggestions
for everything else". What that settles:

1. **Three ways to sit, one shell.** *Watch*: bots play every seat. *Play*: the human picks every move for one seat,
   from the same menu an AI seat gets. *Coach*: the human's agent (a bot here) makes the moves, and each night the human
   picks its skills, its stance (bold or careful) and one chip (go after someone, or stay away from a block). Play is
   built first.
2. **The 3D city first.** No flat-map stand-in is built as a product. The demo is the city with panels over it.
3. **All nine blocks sit downtown**, in the city's section 1 around Fit Street, so one camera can hold several agents
   and walks are short. The docks and the pads need a home there. The rules don't change: `cityPlace` and spots are for
   the renderer.
4. **The jail and the clinic are rooms you can see into**, not extra walking: the jail inside Precinct 9, a small ER
   front on the set, St. Mercy as the establishing shot. No walkable block is added.
5. **What you see.** Watching shows everything: private messages, confessionals, every roll. Playing or coaching shows
   only what your agent's view holds. After the final bell there is a reveal-all replay.
6. **Odds.** Every risky move shows one bar split into its outcomes (clean, messy, fail, disaster), with up to three
   reason chips under it. When the roll happens a needle lands on the bar.
7. **Chat bubbles, three kinds.** Out loud: a white bubble over the head. A private message: a phone chip between the
   two agents, readable only by who may see it. A confessional: a lower-third caption with a portrait. A human player
   speaks by picking from line banks.
8. **Level-ups stay at night,** one card per point, each skill shown by what it does to the player's real odds.
9. **Pacing.** One hour is one turn. The human chooses, then the hour plays out in about 10 seconds. Pause, speed, and
   "skip to my next beat". A season should take 20 to 30 minutes.
10. **Seats offered to a human first:** dealer, robber, smuggler, cook. The muscle and the informant are quiet seats.
11. **The city's code is copied into this repo,** pinned to a trunk commit, and never edited in place. Trunk stays
    read-only.
12. **The fun test:** slime plays two seasons and watches one, then answers: would you start another right now, do you
    have a story to tell, was there a dull stretch over two minutes.

**Layout**
- `city/from-trunk/`: the copy of the city (and what it imports), made by `scripts/bring-city.mjs` from a pinned trunk
  commit. Never edited by hand: a fix goes in our own files, or upstream by slime.
- `demo/`: our page. `demo/index.html`, `demo/serve.mjs` (a static server, port 5470), `demo/stage/` (hotkey 2's stage
  records played as scenes in the city), `demo/hud/` (the panels).
- `src/session.mjs`: the game run one hour at a time inside the page, with a seat a human or the HUD can answer for.
  The rules files don't use Node, so the same engine that plays the bot seasons runs in the browser.

Everything here is free: bots only. An AI seat in the demo is a paid run and needs slime's go and an estimate.

**The stage contract** (what the panels call on the 3D side; `demo/hud/stage-stub.js` is a stand-in that honours it)
- `stage.begin({ game, you, mode })`: a season starts or is carried on. Place the cast where the state has them.
- `stage.playHour(line, { seen, speed })` → a promise that settles when the hour's scenes have played. Only the events
  in `seen` are staged (all of them when watching; when playing, what `witnessed()` gives). Everyone still ends the
  hour where the line says they are. A speed of 1000 means skip: settle everyone at once and don't wait.
- `stage.setSpeed(n)`: 1, 2 or 4; 0 pauses the scenes.
- `stage.screenOf(agentId)` → `{ x, y, visible }`: where that agent's head is on screen, for bubbles and chips.
- `stage.focus(target)`: an agent id or a block id. Point the camera there.
- `stage.onPick(fn)`: `fn(agentId)` when a person is clicked.
- `stage.setClock({ day, hour })`: the time of day, for the light.
- `stage.portraitOf(agentId)` → a promise of an image URL, or null.

**What a bystander may read.** Someone who only stood near private business (a message, a deal closed by phone, a tip
sale, a sale at a counter, a stash, a direct offer, a snitch) gets who did something and where, and nothing else: no
words, no price, no other party (`SEALED` in `src/stage.mjs`; `witnessed()` in `src/session.mjs` applies it). Everything
else that happens on a block is public to whoever stands on it.

**The set is approved for testing only** (slime, 2026-11-11, on the Fit Street layout and its night picture: "Yeah this
is fine for testing. When we get to the real build, we need to actual docks and places"). The pen, the tent, the
sidewalk park and the dressed supplier front are stand-ins. The real build gets real places: actual docks, a real
park, a jail and a hospital you can go into, each as its own location.

**slime's first play (2026-11-11), and what it changes.** His words: "menu is taking up a lot of screen realestate, we
need better ui arrangment, collapsable panels"; "overall the colors are great on ui, things are just a bit bulky and i
cant see any of the game definetly need collapasable panels like a thin vertical bar on the right an left side with
menu buttons that you can open things up"; "it's also hard to understand how to play for a first time user"; "as soon as
i start … my guy and the npcs are glitching like crazy"; "super glitchy with lots of intersecting people npcs and
agents"; "i dont think we need the surrounding city right now, it's huge, just a few extra blocks around the main
area, the rest of the city will come later".
- **The panels become thin rails.** A thin vertical rail on each side with buttons that open a drawer; everything
  starts closed. With the drawers closed, at least 70% of the window is the game: a slim top line, one compact move
  card at the bottom centre, one line of ticker. The skin and the colours stay.
- **A first-time player is taught.** One screen before hour one (the goal, and the seat's loop in three steps), then one
  coach mark at a time through the first day, pointing at the thing to click.
- **Nobody stands inside anybody.** Every person has their own standing place; the city's background crowd keeps off
  the set; an NPC is on stage only when a scene needs it; the player's own agent is marked.
- **A small city.** The set and a ring of one or two blocks. The rest of the city comes later.

## 25. The big city: the game at the city's real places (slime's calls, 2026-11-12)

The 3×3 set round Fit Street is gone. slime, after playing it: "i want to go back to my original city, the 3x3 block is
hurting us, the city is already built we just need to wire our game into it"; "we already have a massive hospital called
st mercy"; "i already have a trailer park"; "it doesnt feel tripple a"; on travel, "we can use cut scenes, like he gets
on the scooter rides for a bit, then it cuts to the location with the agent arriving, subway already has a cut scene";
on loading, "do we have to load the whole city at once, what if for distant places the cut scenes act as loading scenes
but it doesnt feel like it? so we just load what's needed for the location youre at?". What that settles:

1. **Every place is the city's own.** Nothing is built, dressed or stood in: no pen, no tent, no market tables, no
   lamps of ours. The overlay that narrowed three streets is off (`node demo/serve.mjs --overlay` puts it back, to
   measure against). The rules do not change and nothing in `src/` changed: `cityPlace` was always only a label.

   | Game place | The real place | Where its people are |
   |---|---|---|
   | projects | Sunny Acres trailer park | the swap-meet lane through the middle; ten trailers are the ten pads |
   | market | the Jay St night market (the city block −2,1) | the picnic yard among its eight stalls |
   | uptown | Glasswall Plaza | the ring round the fountain and the plaza's benches |
   | corner | Jay St & Washington St | the city's own dealing-corner spots, on the night market's corner apron |
   | bar | DEAD AIR, on Fit Street's block | its Washington St front and Ivy St side |
   | park | Pleasantview Park | the walks round the bandstand, its benches |
   | docks | Low Tide Docks | the cargo ring behind the quay; the pier is the quay's edge at a mooring |
   | precinct | Precinct 9 | its Kent St front: the steps, the two cruisers |
   | jail (held) | Iron Island | the exercise yard, in the open |
   | clinic (held) | St. Mercy | the forecourt by the main entrance, in the open |

2. **The place table is made from the city's data** (`demo/stage/places.json`, by `node demo/tools/place-table.mjs`;
   `demo/stage/citymap.js` reads it). No coordinate is typed. Ours is a small table of ids: which city place each game
   place is, and which of the pieces the city's builds stamp is the counter, the desk, the pier, the cell, the bed and
   the front the camera faces. Read from the city: where the place is, the pieces' boxes, where people stand (its
   published stand spots, then its own stand-spot maker), the nearest sidewalk point, kerb point and subway stairs,
   and the ten trailer pads with their doors.

3. **Only the zone the followed person is in is loaded** (`demo/stage/loader.js`). A zone is a place's own city blocks
   and two blocks round them, with haze beyond; places within 45 m of one another load together (bar + market +
   corner; uptown + precinct). Everyone at a place that is not loaded is **away**: kept account of, never drawn, and
   the hour's scenes there are not staged (the panels still tell them).

4. **A trip is a departure, a cut and an arrival** (`demo/stage/travel.js`, the one seam):
   `leave(actor, { from, to, mode })` and `arrive(actor, { at, from, mode })`. On foot, the stand-in until the scooter,
   the subway and the cab are slotted in (`travel.ride(mode, { leave, arrive })`, `travel.choose`): the leaver walks
   3.2 s toward the way out on the destination's side, the picture fades for the followed person, and they arrive on
   the walkers' lane a few steps from the new place, already walking in. A hop under 15 s on foot at the city's own
   walking pace (1.5 m/s) between two places loaded together is walked in full.

5. **The followed person drives the camera and the loading.** Playing or coaching: the player's agent. Watching:
   whoever the panels or a click ask for, else the first seat; the camera then holds each place's own shot. When
   their hour takes them to another zone it starts building as they set off (in the city's own workers and block
   cache) and the cut waits, black, until it stands. They travel at the top of the hour when they have no business
   where they are, and after the hour's scenes when they have (an arrest is played, then they are taken away).

6. **What the real places lack is listed, not built**: a gun counter and a fence's counter at the night market, a shop
   at Glasswall Plaza, a way into the bar, a desk at Precinct 9, a cell at Iron Island, a bed at St. Mercy. Each is
   staged at the best real spot and written in the place table (`missing`).

7. **The rides are the trip's two halves** (`demo/stage/rides/`, through the same seam: `travel.useRides`). Which one
   is the rides' own rule (`rides.modeFor`): on foot when the walk is 110 m or less, the subway when a station is
   within 80 m of each end on one line, else the scooter (the skateboard for whoever skates); a wheeled ride at a
   place set back from its street (no walkers' lane within 9 m: the docks yard, the trailer lane) is made on foot.
   The followed person on the subway gets the city's carriage scene between the halves (item 11). Somebody else's departure and arrival play in view and nothing waits for them. Out of the
   jail is a plain cut and a walk in at the precinct (Iron Island has no street to ride from); out of the clinic is
   an ordinary ride. `?rides=0` is the walk-and-cut of item 4, `?cab=1` lets the cab be chosen, `?carriage=0` drops
   the carriage scene.

8. **Taken to the jail or the clinic: a press, not a jump** (slime, playing it: "the cut scene to the hospital or
   location shouldnt just jump, you should have to press continue or something, it just skips"). The hour that gets
   the player arrested or hurt ends where it happened, with the card up: "You are under arrest" / "You are hurt",
   "Continue takes you to the jail." The cut is made on the press (`stage.take`). Every held hour after it waits for
   a press too ("Continue for the next hour."), unless "Let the hours pass" is on. A trip the player chose gets no
   press: they asked for it.

9. **An attack gets room** (slime: "still intersections on people when im getting robbed, shouldnt the crowd or other
   agents step back or something"). Whoever an attack is done to stands on open ground for it: the nearest standing
   ground of the place with nothing solid within 2.8 m, off the walkers' lane where there is other ground. They walk
   there at the top of the hour (set down there when they arrive that hour), everybody with no part in it clears a
   ring round the two and turns to watch, and the one who comes for them steps straight in from the gun's distance.

10. **One camera bearing everywhere** (slime: "the camera fixes dont seem to be in the new game and feel a bit
    wonky"). The Lock looks from the same side at every place (the viewer's own turn is kept), every cut the loader
    makes goes through the camera, and each arrival puts it back on the player.

11. **Nothing is time-squeezed, and the player's own trip can be skipped** (slime, on the first subway trip of the
    joined build: "on the subway our guys just fall over sideways", "goes way too fast", "either that or we need to
    make the game hours longer and players can skip cut scene if they want", "right before he got on the subway the
    gamef froze"). The rides and their walks play at the pace they were built at, and the carriage at the city's
    own: ONE SLICE of the ride at 1×, the last eight seconds of the run into the station the person gets off at (on
    the train, running, braking, the doors, cut). No stops on the way, no change of line. An hour is as long as its
    scenes: there is no ten-second target. The picture is black from the end of the departure until the new place
    stands, the carriage riding over the black, and the zone is changed after the carriage has closed.
    **Skip**: while the player's own trip is on the picture (the departure, the carriage, the arrival) one press
    puts them at the place they were going to: the card's "Skip" button, Space or Enter when no menu is up, or the
    carriage's own Esc. Nothing that is not travel is skipped.

Measured loads, hour lengths and the audit are in `city/API-NOTES.md`, "The big city".
