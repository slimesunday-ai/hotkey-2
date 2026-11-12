# Tuning notes

Where the numbers stand after four tuning passes, the exploit review's fixes and slime's 11-11 calls (2026-11-11),
measured on free bot seasons. Nothing here cost money. The numbers themselves live in `src/config.mjs`; `PAYTABLE.md`
shows what they offer each class on paper.

**The short version:** 11 of the 13 bot marks pass on the default lineup, and class balance is the best it has been:
on 1,000 seasons every class wins between 0.89 and 1.23 times its share of seats. Two marks do not pass. Too many seats
still have a long idle stretch (77% of seats are clear of one, against 90% wanted; it was 73%). And the leader at the
start of day 5 wins 28.5% of 1,000 seasons, just under the 30% floor, where it has sat since the third pass.

## The marks, default lineup, 200 seasons

| # | Mark | Measured | Wanted | |
|---:|---|---|---|---|
| 1 | every class wins 0.5–1.5× its share of seats | smuggler 0.9, cook 1, dealer 0.93, gunrunner 1.4, robber 0.95, muscle 1.05, informant 1 | 0.5–1.5 each | PASS |
| 2 | trades between players a day | 9.4 | at least 3 | PASS |
| 3 | a player robbery attempt and an NPC hit every day | 94.5% of seasons | 90% | PASS |
| 4 | at least one betrayal | 100% of seasons | 70% | PASS |
| 5 | the leader at the start of day 5 wins | 25.5% of seasons (28.5% on 1,000) | 30–60% | **FAIL** (just under) |
| 6 | nobody is stuck: no stretch over 4 hours with nothing useful to do | 77.4% of seats (stuck longer: smuggler 48.5%, cook 45%, gunrunner 35%, dealer 24.5%, the rest 0%) | 90% of seats | **FAIL** |
| 7 | never more than 3 hours without a big beat | 100% of seasons | 3 hours or less | PASS |
| 8 | a crew forms; a boss is challenged or a pot skimmed | 96.5% and 30.5% of seasons | 60% and 25% | PASS |
| 10 | crews don't crush loners | in a crew 1.01× their share, in none 0.99× | 0.5–1.5 each | PASS |
| 11 | at least one break-in | 95% of seasons | 70% | PASS |
| 12 | people meet: trades that are hand-offs on a shared block | 74.7% | at least half | PASS |
| 15 | skill points over a season, the 2 starting ones included | median 9, most 14 | median 8–11, nobody over 14 | PASS |
| 16 | comebacks happen: bottom three after night 2 finishing in the top half | 45.8% of them (8.5% go on to win) | at least 1 in 4 | PASS |

**200 seasons is too few to read marks 1 and 5 to the point.** A class's wins move by about a quarter of its share
between one set of 200 seeds and the next, and mark 5 by about 3 points. The third pass's "30.5%, pass" for mark 5 was
that noise: the same build measures 27.4% on 1,000 seasons. On 1,000 seasons the current build gives: smuggler 0.89,
cook 0.93, dealer 1.23, gunrunner 1.09, robber 0.96, muscle 0.91, informant 0.93; mark 5 at 28.5%; the mean finish $245
(it was $199).

Watched, not a pass or fail: seats ending under $50: smuggler 9%, cook 39%, dealer 30%, gunrunner 40%, robber 25%,
muscle 1%, informant 6%.

Mark 6 used to be "no class ends broke in more than 20% of its seats". slime replaced it on 2026-11-11 with marks 6 and
16: finishing poor is part of a game where two seats live by robbing; having nothing to do is what makes an owner quit.

## The other lineups

- **Cautious (mark 13), 200 seasons:** trades 9.3 a day (pass), never 3 quiet hours (pass), a robbery attempt and an NPC
  hit every day in 91.5% of seasons (pass; it was 86%, and the house bounty is what moved it), nobody stuck 80.6% of
  seats (**fail**).
- **Each class's safe grind (mark 9), 100 seeds each:** every one loses. Bottom half in 91% to 99% of seeds. **Pass.**
- **The turtle (mark 9), 100 seeds each:** loses as a robber (100%), smuggler (85%) and informant (72%), and all but
  loses as a cook (69%). **It still wins as a muscle (bottom half in only 17% of seeds), a dealer (38%) and a gunrunner
  (49%). Fail** for those three.
- **One seat absent all season (mark 14), 50 seeds each:** trades hold at 6.7 to 9.9 a day whichever seat is gone. The
  daily-trouble mark fails with a robber, one of the dealers or the cook gone, and the stuck mark fails as it does on
  the default lineup. The stand-in rule is what covers an absent owner or a broken model; this lineup tests the case
  with no stand-in.

## The small lobby, 100 seasons for each pair of seats

Two seats are owners' agents (played here by the same bots, standing in for the models) and eight are locals
(SPEC section 23). Measured with `scratch-lobby.mjs`, against the same two seats in a ten-contestant season.

| Players' seats | Big beats with a player in them, a day | Hits on a player by locals, per seat a day (locals on each other) | Trades, per seat a day | A wronged local answers within 12 hours | Best player's finish | A local ends richer than both |
|---|---:|---:|---:|---:|---:|---:|
| dealer, robber | 7.7 | 0.72 (0.33) | 0.9 | 53% | 3.6 | 77% |
| cook, smuggler | 7.4 | 0.46 (0.62) | 2.3 | (no wrongs done) | 3.8 | 85% |
| dealer, dealer | 6.5 | 0.74 (0.59) | 1.4 | (no wrongs done) | 3.5 | 75% |
| muscle, informant | 2.8 | 0.88 (0.51) | 0.1 | (no wrongs done) | 3.0 | 83% |
| gunrunner, robber | 7.1 | 0.63 (0.34) | 1.1 | 56% | 3.9 | 80% |

What it shows:
- **Locals do lean on players**, about half again as often as the same seats are hit in a ten-contestant season (0.72
  against 0.47 a day for dealer and robber), without piling on: a player is hit again within 2 hours about once every
  two seasons, the same as in a ten-contestant season (a muscle or an informant about 1.4 times a season, also the
  same).
- **A wronged local answers about half the time.** The rest of the time it is too weak to win the fight and too broke
  to post the $40 (it has just been robbed). Before the bounty rule it was 29%.
- **A local ends richer than both players in about 4 seasons out of 5.** That is what equal play gives: two seats in
  ten. Whether real models beat the locals is not something bots can tell us.
- **The muscle and the informant are quiet seats to own**: under 3 big beats a day with them in it, and up to 13 hours
  without one. Guarding and watching are not big beats. This is the same in a ten-contestant season.
- Not measured, because bots can't: whether a model learns to farm the locals, and what a season with two AI seats
  reads like. That needs a paid run.

## Still failing, and what the runs showed

1. **Idle stretches for smugglers, the cook and the gunrunner.** The fourth pass cut seats with a long idle stretch
   from 26% to 23%, all of it by fixing how the bots trade:
   - the cook and the gunrunner now post their orders first. Before, both smugglers set out with no order on the board,
     both fetched chems, and the gunrunner sat without parts for a day;
   - the cook stays home when chems are on their way to it. It used to walk product out to a dealer while a smuggler
     stood at its door with the chems it needed;
   - a smuggler sells stale chems on credit even to a cook that is behind on its debts. Otherwise a robbed cook, two
     smugglers who won't lend and a street with no product lock each other up for days.

   **Hauling was tried and dropped:** smugglers carrying the cook's product to the dealers left the waiting where it
   was and cut the cook's median finish from $166 to $38. So was a third dealer or a second cook in a smuggler's seat
   (the lone smuggler then wins four times its share). What is left: a smuggler home with a load nobody is buying
   (0.9 times a season), a dealer waiting for product (0.6), a gunrunner with no parts (0.6), a cook with no chems
   (0.6). The season traced after these fixes was a chain that had run out of money, not out of goods: by day 4 the cook
   and the gunrunner were both in debt and nobody on the block had $30. Seats ending under $50 are still 39% of cooks
   and 40% of gunrunners.
2. **The day-5 leader wins 28.5% of the time**, against a floor of 30%. Neither the house bounty (29.4% without it) nor
   the late-night price lift (29.1% without it) is what holds it down.
3. **A turtle beats a normal muscle, and edges a normal dealer and gunrunner.** Paying a turf holder 120% moved the
   dealer's turtle from 42% to 38–48% of seeds in the bottom half, which is nothing. For the muscle, guarding is the
   safe line and the trade at once; its safe grind (patrolling for shopkeepers) does lose, in 94% of seeds.
4. **Debt collection never pays.** An overdue debt already takes everything its debtor earns, so by the time a muscle
   can collect there is nothing in the debtor's pockets. The muscle bot was trying twice a season and losing clinic
   hours for it; it won half as often as now. It now collects only from someone carrying money, which in 300 bot
   seasons never happened. The verb works; the rule around it leaves it nothing to do.
5. **The bots read a few things a player can't see** (how much product a dealer holds, what the cook has cooked).
   That is fine for tuning and not for locals sharing a season with owners' agents. Not yet closed.

## For slime

- **The stuck bar.** 90% of seats is a guess at a fair bar, and four passes have moved it from 63% to 77%. The first
  paid AI season will show whether models wait the way bots do; they may fill idle hours with talk and schemes that
  the bots can't.
- **Collections.** Either let a collection take from the stash, or accept that the muscle's income is guarding and
  bounties. His call.
- **The turtle.** For the dealer and the gunrunner the careful line is close to the trade itself. Making it lose would
  take a rule that punishes not fighting, which may not be a game he wants.

## What changed from the spec's first draft, and why

The pay table came first (SPEC section 7c). The first draft's numbers did not close: the drug chain netted about $40 a
seat a day against rent of $25 to $55. Then the bot runs showed three things the arithmetic could not:

- **Cash, not margin, was the limit.** With $100 each, every link of the chain waited for the next one's money. The cook
  sat idle and dealers carried one to six units a trip. Three changes fixed that:
  - a **starting kit** for the chain classes (6 chems for each smuggler and the cook, 4 units for each dealer, 6 parts
    for the gunrunner, a gun for each robber), so the first sale happens in the first hours;
  - **sale on credit**, ported from mini's credit deals: goods now, and every dollar the buyer takes in goes to the
    seller first. Unpaid at the due hour it is overdue: a betrayal, and a debt a muscle can collect. This is also where
    most betrayals and collections now come from;
  - **a tab at the docks**: the supplier fronts a smuggler up to $150, taken from its next income.
- **Dealers' walking time is the real bottleneck,** not the cook and not street demand. A dealer spends about half its
  hours walking between the cook's door and uptown. Bots now carry full loads on a standing order and stay on a block
  unless somewhere else pays far better.
- **Blind price changes between players move wins around but not the total.** Raising what the cook or the smugglers
  charge shrinks the economy unless credit can carry it.

Numbers that moved (first draft → now):

| | First draft | Now |
|---|---|---|
| Docks: chems, parts, daily stock | $8, $12, 36 and 24 | $10, $14, 48 and 24, with a $150 tab |
| One batch | 3 chems → 3 units | 3 chems → 6 units |
| Blow-up | 10%, 2 hours | 6%, 1 hour |
| Street base prices (corner, bar, park, uptown) | $18, $22, $24, $30 | $36, $44, $50, $60 |
| Fence buys (chems, parts, product, gun) | $5, $8, $8×q, $40×q | $7, $10, $4×q, $50×q |
| Fence sells (chems, parts, q1 product) | $16, $24, $22 | $46, $30, $40 (20 a day) |
| Street gun, sting, gun shop | $90×q, 25%, $150 | $140×q, 20%, $220 |
| A robbery takes (clean, messy) | 40%, 20% | 60%, 30% |
| A break-in takes (clean, messy) | 30%, 15% | 45%, 22% |
| Last call (prices all day, from 21:00, trouble) | ×1.5, ×2, ×1.5 | no lift, ×1.25, no lift |
| A docks run | 2 units + Haul | 1 unit + Haul (same goods, more hours of smuggling) |
| Resting | −1 heat | −2 heat |
| A failed robbery, a disaster | 2 hours, 3 hours in the clinic | 1 hour, 2 hours |
| An arrest's fine | 30% of carried cash | 20% |
| NPC robbers take (clean, messy) | 40%, 20%, every hour | 30%, 15%, two scores a night |
| Police pay for a crime | $25 | $70, once per crime |
| A turf holder's street price | 100% | 120% |
| A street sting | a full arrest | the gun and 1 hour in a cell |
| The house bounty | (none) | $75 on the leader, each noon from day 2 |
| Shopkeepers pay a patrol | $8 an hour | $4 an hour |
| XP | 3 XP a point | 2 XP a point; a day counts 2 deals, 2 risks, 1 beating |
| Listings per agent | (not set) | 3; a new one for the same goods replaces the old |
| Usual prices between players | (not set) | chems $33, parts $24, product $11 + $3×q, gun $160, guarding $28 an hour, a pocket tip $55, a crime tip $85, +20% on credit |

Rent ($25 rising $10 a night), start cash ($100), the contest formula, the clinic ($15 an hour), bail and the courier
(25%) are as approved.

Rules added while tuning, all in SPEC.md: **the night job** (every night the NPC robbers break into the pad with the
fattest stash, and a guard hired through the end of the day stands in the way: wealth draws fire, and the muscle gets
night work); **the loan shark** (one $100 stake for a seat with under $60, 125% back out of what it earns); credit
sales; the docks tab; an order to buy is filled with the quality asked
for or better; a new listing replaces the old one for the same goods; NPC robbers work the streets next to an empty
block; the police count as NPC trouble for the daily mark; net worth takes off what is owed to the clinic and docks;
the quiet-street rule starts in the season's third hour and needs $40 on a block. The fourth pass's rules (the house
bounty, turf paying its holder, the short sting, the small lobby) are in SPEC.md section 23.

## How to re-measure

```
node scripts/paytable.mjs          # the pay table, after any change to the numbers
node run.mjs --bots --seeds 200    # the default lineup's marks
node run.mjs --bots --seeds 200 --all-marks   # every lineup
node run.mjs --bots --seeds 20 --lineup small:dealer,robber   # a small lobby: two players' seats, eight locals
```

The pay table is one agent's plain, competent day on paper. Bots earn well under it (a dealer about a third), mostly
because of walking, the clinic and jail. Read it as what the numbers offer, not what a seat will make.

## After the exploit review

The review's nine findings and their fixes are in SPEC.md section 22 and `test/exploits.test.mjs`. Two of them changed
the bot numbers above: the season's first hour and the first hour out of the clinic or jail are now safe from attack
(robbers lost their easy opening on the projects), and saying yes to a cash deal now needs the cash (fewer stock
lock-ups, fewer short pick-ups). The review also confirmed what holds: the books balance every hour, no goods are
duplicated, the daily XP caps hold the ceiling at 14 points, and the courier fee and the 21:00 day-5 cap can't be dodged.
