# The run

The direction slime chose on 2026-11-13. This page is frozen until he has played it. New ideas go on the parked list at
the bottom; nothing parked is built.

## The game in one line

Leave the trailer park with what you dare to carry, make money in a part of the city you can survive, and get it home
before the city takes it.

## One run

1. **Wake at the crib.** An empty room in the trailer park, a mattress on the floor, $20. Your energy for the day
   depends on what you sleep on.
2. **Step out. Three options.** Every hour the place deals you three things to do, each with its pay, its odds and
   what failing costs. One of the three is always safe. You can also head home, or take the subway.
3. **Work it.** Each hour costs energy. Crime pays more than honest work and adds heat.
4. **The place notices you.** The longer you stay and the more you carry, the likelier you are jumped. With heat 3 or
   more, the police may stop you.
5. **Call it.** Push another hour, or head home. The hour you leave is still an hour there.
6. **Bank it.** Money carried through your own door is safe. Buy things. Sleep.

Then the next day. You can go out, come home, bank, and go out again in the same day if you have the energy.

## What can go wrong

- **Jumped, a bad one:** you lose everything you carry, the day ends in the clinic, and tomorrow starts tired.
- **Jumped, a scuffle:** you lose half of what you carry and carry on.
- **Stopped by the police:** what you carry is seized, the day ends in jail, and tomorrow starts tired.
- **Never lost:** the crib, what is banked, and what you own.

## Two places in the first test

- **The trailer park.** Safe and poor. Nobody acts on you here.
- **The flea market.** One stop away. About twice the pay, and people who will take it off you.
- **The corner** is on the subway map and locked: "held by the Sixes". It is the next goal, not part of this test.

## Three things to buy

| Thing | Price | What it does |
|---|---|---|
| An inside pocket | $40 | Whoever jumps you finds only half |
| A box cutter | $90 | You are harder to jump, and stick-ups appear among your options |
| A real bed | $150 | Energy 10 a day instead of 6 |

## The test

slime plays it himself, every call his own, no AI agent. The page counts the days it takes to own all three things.
What we are asking: is one run tense, and does he want to go again?

## Not in this test

Rent, raids on the crib, the safe and the lock (since built: "Home pressure"), crew, the agent playing for you, the
corner and the gang, other players, skills, a season and a wipe.

---

## The numbers

All in `src/run/config.mjs`. They started as the designer's; three were changed to meet the marks, each shown with
what it *was*. Built and measured 2026-11-13.

**Energy.** Mattress 6, bed 10. Every hour out costs 1, the subway included. At 2 or less you are tired: your odds
drop 15 points (a sure job stays sure) and you are 10 points easier to jump. The subway to the market needs 2 (there
and back). A night after the clinic starts 3 lower; after jail, 2 lower; never below 1. (*Until rules-2, at 1 in the
market you had to head home; now you may stay and sleep rough: "The world answers", below.*)

**Heat.** 0 to 5. It drops 1 each night at home (not after the clinic or jail). At 3 or more in the market, each hour
has a (heat − 2) × 20% chance of a stop (*was 15%*). After jail heat is 1. (*Since rules-2 this is your own heat;
each place has one too, and the heat on you where you stand is the higher of the two: "The world answers".*)

**The subway.** One hour and 1 energy each way. $2 out of what you carry, or hop the turnstile: free, 25% you are
caught, heat +1 (and you still ride). Carrying less than $2, you can only hop.

**Trailer park** (the first is always dealt, plus two of the rest that still have somebody to do them to: People,
below):

| Option | Odds | Pay | If it fails |
|---|---|---|---|
| An odd job for a neighbour | sure | $6–10 | |
| Sell loose cigarettes at the bus stop | 85% | $5–14 | nothing |
| Lift a wallet at the bus stop | 60% | $18–30 | heat +1 |
| Collect a debt for the park manager | 70% | $14–22 | energy −2 |

**Flea market** (the first is always dealt, plus two of the rest that still have somebody to do them to):

| Option | Odds | Pay | If it fails |
|---|---|---|---|
| Work a stall for the shopkeeper | sure | $22–30 (*was $20–28*) | |
| Sell to the crowd | 75% | $40–70 (*was $35–65*) | heat +1 |
| Lift a wallet in the crowd | 55% | $60–100 (*was $55–95*) | heat +1 |
| Grab a till | 40% | $120–190 (heat +1) (*was $110–180*) | heat +2 |
| A stick-up behind the stalls (needs the box cutter) | 60% | $100–160 (heat +1) (*was $90–150*) | heat +2 |

**Jumped at the market.** Each hour there, the leaving hour included (the arriving hour is not): 4% + 4% for every
hour already spent there this trip + 1% for every $10 carried (*was $20*), at most 45%. Then the city's one roll
formula (`src/contest.mjs`, its clamp and four bands): their strength 55, minus 15 for the box cutter, plus 10 if you
are tired. Their clean win: they take it all and you wake in the clinic. Their messy win: half. Otherwise nothing.
The inside pocket halves what they take, not what the police seize; what it kept through a bad one goes home with
you in the morning.

**How the engine reads the page** (slime's rulings of 2026-11-13, built as written). A day's clock starts at 12:00;
energy is the only limit. Going inside at the trailer park costs no hour and banks everything; you can go out again
and take any amount of banked cash with you (none unless you say). At the market each hour worked rolls after the
job: first the police (heat 3 or more), then the jumping; the hour you leave rolls both, then you pay or hop. The
chances are the ones the view showed at the start of that hour, so the odds shown are the odds rolled; what they
take is what you carry after the job. Of the dealt three the safe one is first and the other two are drawn by the
seeded dice from what you can do and who is left to do it to (People, below); the same state deals the same options
to the same people. Owning all three shows "done in N days" and play goes on. The corner is shown, locked: "held by
the Sixes".

## People

Added 2026-11-13 after slime played it ("actions don't have consequences": the same debt, the same man, again and
again, and he just goes back to what he was doing). The designer's fix, approved by slime: people react, it sticks
for the day, and it changes what comes next. Numbers in `src/run/config.mjs` (`people`, `moods`, each job's `role`).

**Who.** Every option is done to or with one person, and its label names them ("Collect a debt from Benny Two-Coats
for the park manager"). The stage's locals keep their ids and names where a role matches; the new people take the
same id pattern (*new* below).

| Place | Role: the job | People |
|---|---|---|
| Trailer park | neighbour: the odd job (the safe one) | Mrs. Alvarez; Mr. Pruitt, Gloria (*new*) |
| | buyer: loose cigarettes | Shaky Dee |
| | mark: a wallet | a man at the bus stop; a woman at the bus stop (*new*) |
| | debtor: a debt | Benny Two-Coats |
| Flea market | shopkeeper: the stall (the safe one) | Mrs. Bao; Mr. Ferraro (*new*) |
| | buyer: selling to the crowd | Lola, Pockets |
| | mark: a wallet | a woman in the crowd; a man with a camera (*new*) |
| | stallholder: a till, or a stick-up | a stallholder; Mr. Okafor, Mrs. Kowalski (*new*) |

**Once a day.** Whoever you work in an option that is not the safe one is out for the rest of the day, whether it
worked or not: a sale made or turned down, a wallet lifted or tried, a debt collected or refused, a till grabbed or
tried, a stick-up. An option with nobody left is not dealt, so an hour can deal two options, or only the safe one. A
till and a stick-up draw on the same stallholders, never the same one in one hour. The safe option is always dealt,
always has somebody, and goes round its people: a seeded start each day, one along each time you take it, so never
the same person twice running. Nobody in it is ever out.

**A mood for the day.** Five words: *calm* (not dealt with today), *friendly* (you worked for them, or they bought
from you), *sour* (they paid up, or you took it off them to their face: a debt, a till, a stick-up), *wary* (you
tried and it went wrong), *does not know yet* (a lift that worked). The view shows everyone's; the event that set it
says it ("Benny Two-Coats is sour; not again today."). Every morning, after home, the clinic or the jail, everyone
is calm again and nobody is out. The mood is the day's word for what just happened; since trust-1 there is a meter
that lasts across nights, trust ("Trust", below), and an option's person is also left out while they are against you.

**Dry, and the way on.** With nobody left but the safe option, the view says so and names the way on: from the
trailer park, the subway to the flea market (too tired for the ride there and back, it says so: go inside for
today); from the market, home. The park has four people to work, so a day there runs dry and sends you to the
market: the park-only policy sees it dry on 64% of mattress days, 91% with the bed. The market has seven, so it lasts:
the market policies, held back by heat, work 1.3 to 1.7 people there a day and never ran it dry; ignoring heat with
all three things, 3.8 a day and dry on 1% of days.

**Sizes, against the marks.** No pay or odds changed. With only the stage's three in the park (one of each), the
park's best day fell from $61 to $54 and ignoring heat with the pocket and the cutter ($56) was no longer the worst
way to play: mark 4 failed. A second mark at the bus stop brings the park back to $60 (a second debtor would lower
it: a refused debt costs 2 energy); a third stallholder gives heat-blind play its tills and stick-ups back, so it
sinks to $53 again. Measured below.

## Marks

(These are the numbers before trust-1; after it, see "Marks of trust" under "Trust".) Measured free with
`node scripts/run-marks.mjs`: 3,000 seeded six-day seasons per cell, scripted policies driving the
real engine (`src/run/policies.mjs`): go home when carrying $X (30 to 300) or at heat 3, never go home early,
trailer park only, stall only, heat-blind. A day's take is what got banked that day, less fares. The numbers in
brackets are this engine's at the numbers above, with the people; where the people moved one, what it was before
them follows "before people"; the designer's throwaway check is after "was".

1. **Pushing has a price.** With the bed, the best go-home amount beats never going home early by 10% or more
   [bed alone: $112 a day at $60 against $63, +78%] (before people +77%) (was $116 against $71). Pass.
2. **The market is worth the risk.** Its best policy beats the trailer park's best by 15% or more on the mattress
   [$74 against $60, +23%] (before people $61, +20%) (was $74 against $63), and by 30% or more with the box cutter
   [$87, +47%] (before people $88, +42%) (was $87). Pass.
3. **Losing is real.** At the market's best policy on the mattress, 15% to 35% of days bank nothing [23%, home at
   $120] (was 28%). Pass.
4. **Heat matters.** Ignoring heat is the worst policy in every kit [$33 a day on the mattress; worst in all six
   kits, by $7 or more: $53 against the park's $60 with the pocket and cutter] (before people by $8 or more) (was
   $40). Pass.
5. **Every purchase shows.** Each of the three things raises the best daily take by 8% or more [mattress $74, pocket
   $87, pocket and box cutter $100, all three $150: +18%, +15%, +50%] (before people $101: +16%, +49%) (was $74,
   $88, $101, $151). Pass.
6. **Length.** Owning all three takes a median of 4 to 6 days [4, going to the market and home at $90, buying each
   as soon as it can be paid for; p10 2, p90 6; trailer park only 5] (was 4). Pass.
7. **A first day has a call worth making** (the known weak spot). Measured as: on the mattress, the best go-home
   amount beats never going home early by 10% or more, mark 1's bar [$74 at $120 against $64, +14%; the amounts span
   $64 to $74] (was $72 to $74 across every amount; this engine at the starting numbers: $75 against $71, +6%). Pass.

## The world answers (rules-2)

Added 2026-11-14 after slime's "it doesn't feel alive ... the whole city having actions and consequences is
interesting to me". The three dealt cards stay the heart; everything new is a dealt option's detail, a move that is
there when its conditions hold (like going inside, the subway and sleeping), or a morning event. All numbers are in
`src/run/config.mjs`, measured with `node scripts/run-marks.mjs`. His worry ("if that changes the game mechanics let's
discuss"): the seven marks still pass and every market cell is as it was within a dollar; the park's best day rose
from $60 to $62 (Dee pays more as he gets hooked; $64 with the cutter, which now robs), so mark 2's margin on the
mattress fell from +22% to +19% (the bar is 15%). One rule did change: at energy 1 in the market you may stay.

**Heat belongs to a place.** Each place has a heat, 0 to 5. A job's heat goes on you *and* on the place it was done
in; robbing somebody passing heats only the place (nobody knows it was you); a regular's grudge heats where they
live. The heat on you where you stand is **the higher of your own and the place's**. Why the higher, not the sum: with
the sum every market crime counted twice and the seven marks moved; with the higher, playing the market alone is the
same game as before, and the place's heat only shows when it is above yours (after a robbery, or, later, when other
players have heated it). Your own heat still drops 1 a night at home; **a place cools 2 every night**, wherever you
slept, so a place's heat is about today ("the market is hot today, work the park"). The flea market is patrolled
(the police are about whatever its heat, as before); the trailer park only once it is hot itself (heat 3), so your own
heat alone is still nothing there. A stop clears the place it happened in (they got who they came for). The view says
it per place, plainly: "The flea market is hot today (heat 4): the police are about." / "The trailer park is quiet."

**Robbing somebody passing.** A move at any place whose entry has `strangers`, only with the box cutter (without it,
it is listed and says it needs the cutter). 70% to get $25–40 in the park, $50–80 at the market (× the tier's pay);
10 points less for each heat the place already has; tired −15. It heats the place: +2 on a win and +3 on a failure in
the quiet trailer park (one robbery there is news: a failure makes it hot at once), +1 and +2 at the market (a crowd
notices less; with +2/+3 there a single robbery cost a day's market work and robbing at the market never paid,
measured). No person remembers it, no mood. Strangers worth robbing are a supply of the place: 2 in the park (1 back
a morning), 3 at the market (2 back a morning). Measured (mark 10): one robbery in the park and one at the market
beat two in either place.

**Digging through the bins.** A move at any place whose entry has `bins`: an hour and an energy; 50% nothing, 45%
$1–4, 5% a real find of $12–20 (× the tier's pay, so double at the market). In the trailer park 35% a neighbour sees
you: their mood for the day is *thinks less of you*, and they skip their turn at the odd job while another neighbour
is left; since trust-1 their trust also drops 1, and one who is with you looks away (nothing at all). Bins worth digging are a supply: 3 in the park (2 back a morning), 4 at the market. Measured (mark 9): $1.9 an
energy in the park against the odd job's $8.0, $3.8 at the market against the stall's $26.0.

**Picking the target.** Every dealt option now lists `targets`: the person dealt first, then anyone else of its role
who is free and not in another option this hour (a till and a stick-up still never share a stallholder). The choice
may name one (`{ do: 'job', id, who }`); unnamed, it is the one dealt. Pay and odds do not change with the target. The
safe job is not targeted: it goes round its people, as before.

**Regulars.** A person with `regular: true` (Shaky Dee) keeps count of what you have sold them, across days, and pays
$3 more for every sale they have had (at most $12 more): selling to them stays tempting. From 3 sales on, each morning
at home has 40% + 20% for every sale past 3 (at most 90%) that they are at your door wanting $6–12, plus $5 for every
sale past 3. Give it (from banked): their count drops by 1, they go friendly, and they will be back. Refuse (or step
out or sleep past them): 60% they swing at you (strength 55, less the box cutter: a clean win of theirs costs 4 energy
today, a messy one 2), otherwise a grudge (not dealt for 2 days, and the trailer park +2 heat: they bring the police
round); either way their count drops by 1. (Since trust-1 the grudge is trust: "Trust", below.) Their custom is a supply of the place (2, 1 back a morning). Measured (mark
11): always selling to Dee banks a little more on average than never ($61 against $60) with a worse worst tenth of
days; refusing every time is the worst tail of all. Giving is the better answer on average, refusing a gamble that is
sometimes free.

**Energy with stakes.** At energy 1 in the market you may stay. At 0 away from home the day can only end where you are
("Out of energy at the flea market: sleep rough here ... or buy a drink if you can"); you may also choose to sleep
rough at any time away from home. A night on the street: the tier's chance they rob you in your sleep (60% at the
market, 25% in a quiet place, 80% in a mean one), at their strength +20 (you are asleep), less the box cutter, the
pocket hiding half as ever; no clinic; you wake there the next day at noon, 3 energy lower, still carrying what is
left, and your own heat has not cooled. Measured (mark 8): staying out when spent and sleeping rough banks $32 a day
on the mattress against $74 for paying the fare home; with the bed $68 against $101; survivable (nothing banked or owned
is lost). "Stay out too long" is not a clock: the first test's ruling stands, energy is the only limit.

**A place's shop.** A place's entry has `shop`: a list of { item, label, price, does, perDay, gives }. The view reads
it as `shopHere`; each item is bought with a move (`{ do: 'shop', item }`), from what you carry, no hour. `gives` is
read by name (`energy` is the one there is). The market's list has one entry: an energy drink, $5, energy +1 (not over
your day's full energy), one a day. Measured: drinking it at the end of a market trip is about even ($75 against $74:
the extra hour is the riskiest one); its use is the way home when you are stranded at 0. The three things stay the
crib's.

**Supply: what a place has to use up today** (slime: "in multiplayer with agents should resources have a limit?").
Every supply is a number on the place, in its entry (`supply: { what: { max, refill } }`), held in the state per place
(`state.supply[place]`), not per player, drawn down by what is done there and refilled by `refill` each morning up to
`max`, so a place can recover slowly and players sharing a city would share it. There are three: `strangers` (park 2,
refill 1; market 3, refill 2), `bins` (park 3, refill 2; market 4, refill 4), `custom` (a regular's: park 2, refill 1).
A place's heat is the city's too (`state.placeHeat`). The drink's one a day is the player's own.

**The scripted players** (`src/run/policies.mjs`) use all of it: with the cutter a crime player robs once a day as its
last act at a place where the place is cool (the park's last hour, before going in; the market on the way out, only if
even a failure leaves no police stop on the ride); it banks before working a hot park; it gives a regular what they
ask when it can. For the marks there are players that sleep rough, drink, dig instead of the odd job, rob by a plan,
always or never sell to a regular, always refuse, and play both places (`mixed`: the park when the market is too hot,
and after a trip with the energy left).

### Marks of rules-2

Measured as the others: 3,000 seeded seasons per cell on the real engine.

8. **Sleeping rough is worse than going home.** Home at $120, staying out when spent and sleeping rough against paying
   the fare home: mattress $32 against $74, bed $68 against $101; robbed on 60% of rough nights. Pass.
9. **The bins never beat the safe job.** Per energy, measured over 3,000 digs and shifts: park $1.9 against $8.0,
   market $3.8 against $26.0; the park player digging instead of odd jobs banks $51 against $60. Pass.
10. **Robbing twice in one place loses to moving on.** Box cutter, home at $120: one robbery in the park (before riding
    out) and one at the market (on the way out) $81 a day, against two at the market $73 and two in the park $68 (not
    robbing by plan at all: $87; a robbery by plan, ignoring how hot the place is, is a bet that loses on average,
    which is the point: the sensible players rob only where it is cool). Pass.
11. **Leaning on a regular has a tail.** Trailer park, ten-day seasons: always selling to Dee (and giving at the door)
    banks $61 a day against $59 never, but its worst tenth of days is $14.2 against $15.3; refusing every time, $60
    and $13.7, with 0.14 fights a day. Pass, by a modest margin (the door costs a park day $6 to $20 or a few hours'
    energy; a park day is small).
12. **Both places beat one.** (Passes since goods-1: "Marks of goods".) Playing both places against the better single place, by 10%+, neither single place under
    half of it: mattress $76 against the market's $74 (+3%) and the park's $60; with the cutter $91 against $87 (+4%).
    **Fail.** Why: the market pays three times the park an hour, and with 6 energy, 2 of them on the ride, what is left
    after a market trip is 0 to 2 hours of park work, so mixed play gains 3 to 4%. Heat per place does push you to the
    park (after a robbery, or a hot day), but the park is worth too little for that to show 10%. Mark 2 wants the market
    15%+ above the park, so making the park richer breaks mark 2. Passing it means more energy left over (or another
    place worth as much as the market): slime's call, not tuned here.

## Trust (trust-1)

Added 2026-11-14 after slime: upsetting people cost almost nothing ("they can tip off cops, snitch, higher chance they
refuse work, and there needs to be a way to circumvent consequences, gain their trust then you get away with more").
One number per person, kept across nights; everything hangs off it. Numbers in `src/run/config.mjs` (`trust`, and
each job's `trust`).

**The dial.** −3 to +3, everyone starting at 0. −2 or less is *against you*, +2 or more is *with you*, between is
neutral. It drifts back toward 0, so nothing is permanent: below 0, 1 every morning (bad blood fades); above 0, 1 on
a morning after a day you did not deal with them (good will holds while you keep it up, and fades when you stay away).

**What moves it.**

| | It worked | It went wrong |
|---|---|---|
| An odd job, a stall shift | +1 | |
| Loose cigarettes, selling to the crowd | +1 | 0 |
| A wallet | 0 (they do not know yet) | −2 |
| A debt | −1 | −2 |
| A till, a stick-up | −3 | −2 |

Seen in the bins −1. Giving at your door +1. Refusing them there −4.

**Against you.** Off your table: never dealt to you, as an option's person or as a target, while it lasts, and the
view counts the days ("won't deal with you, 2 days"). A till grabbed to someone's face is 2 days; a lift that went
wrong, the rest of today. If everyone a safe job needs is against you, it is still dealt, with nobody named. And they
tell on you. Each person is *about* at their place on 60% of hours (seeded on the hour; the view shows who). When
you do a crime at their place (any job that can heat it, whichever way it went), rob somebody passing there, or dig
its bins, each one against you who is about has 50% to see it and call it in: one roll, at the chance the card showed
before you chose. A call is heat +2 on that place, not on you.

**With you.** They see nothing: in the bins they look away (no mood, no trust lost), and only people against you ever
call anything in. A job with them pays $2 more, times the tier's pay ($2 in the park, $4 at the market).

**Local.** Each person belongs to one place. Being liked in the park does nothing at the market, and the other way
round: burning a place is a reason to move on.

**The grudge is trust now.** Refusing a regular at your door is −4. From neutral that is the bottom, against you: not
dealt for 2 days, not at your door while it lasts, and (if they do not swing at you) they call the police on where
they live, heat +2 there, as before. One who was with you (+3) only goes to −1: sore, no grudge, no heat. The 60%
swing is unchanged; one change: after a swing they are now against you for the 2 days as well (before, out for the
day only).

**The bins' "thinks less of you" stays** (`rotaSkips`): that neighbour still skips today's turn at the odd job. The
lasting part is the −1.

**Seen.** Every change is said where it happens. A job, the bins, giving and refusing at the door carry `trust` on
their event: who, `at` (their place), `from`, `to`, `change`, `band`, `bandWas`, `offDays`, `cause`, `why`, `text`.
New events: `witness` (someone against you saw a crime: `called` or kept quiet, who, `watchers`, the roll, the
chance, `heat`, `placeHeat`), `drift` (each morning, with every change), `sore` (refused at the door, no grudge). A
call at a place you are not standing in (the grudge, from your door) carries `notice`: `place`, `heat`, `hot`,
`text`, `suggest` (where to work instead). The view adds `trust` (per person: `trust`, `band`, `bandText`,
`offDays`, `offText`, `around`, `here`), `trustHere` (where you stand: `offTable`, `tellRisk`, `withYou`, `text`),
and on each option `trust` (their trust and how this job would move it), `withPay` and `tellRisk` (null for a job
that cannot heat the place); the robbing and bins moves have `tellRisk` too.

**Saves.** State version 4 adds `trust`. An older save loads with everyone at 0; a grudge it already holds runs out
as it would have.

**The scripted players** (`src/run/policies.mjs`, `trust`): all three play both places and go home at $120, as
`mixed`. The *good neighbour* only works for people and sells to them for its first two days; then it takes any
option except one done while someone against it is about, or one that could turn its person against it, always picks
the target who trusts it most, and robs only unwatched. The *burner* takes the best-paying option and ignores trust
(and shuts the door on a regular). The *farmer* does odd jobs in the park for three days, then plays the burner.
Every policy older than trust ignores it, so the marks above now measure players who burn people.

### Marks of trust

Measured 2026-11-14, 3,000 seeded six-day seasons per cell, as the others. Two tuning rounds: good will now holds
while you keep it up (with a nightly drift for everyone, nobody but a twice-a-day stall boss could ever be with you,
and the good neighbour never got its pay), and people are about on 60% of hours (was 50%) and call it in on 50% (was
40%).

13. **Trust is a real choice.** The good neighbour and the burner within 10% of each other, every kit: mattress $72
    against $76 (5%), pocket $86 against $87 (1%), cutter $82 against $89 (9%), pocket and cutter $96 against $98
    (2%), bed $112 against $110 (2%), all three $156 against $155 (1%). The marks' best policy beside them: $72, $85,
    $85, $97, $112, $149. Pass, the cutter narrowly (the burner's stick-ups are the gap).
14. **Farming trust then robbing is not the way.** The farmer banks $67, $72, $73, $78, $103, $126: last of the three in
    every kit (the park trust it builds is worth nothing at the market). Pass.

**What trust moved in the twelve marks** (before, then after): mark 1 $112 against $63 (+78%), now against $69
(+62%); mark 2 $74 (+19%) and $87 (+41%) against $62, now $72 (+22%) and $85 (+43%) against $59; mark 3 23%, now 25%;
mark 4 $33, now $27, still worst in all six kits; mark 5 $74, $87, $100, $150, now $72, $85, $97, $149 (+18%, +13%,
+54%); mark 6 4 days, unchanged; mark 7 +14%, now +13%; mark 8 $32 and $68 against $74 and $101, now $35 and $81
against $72 and $105; mark 9 the park with bins $52 against $62, now $44 against $59; mark 10 $81 against $73 and $68,
now $75 against $71 and $66. Ten still pass.

- **Mark 11 now fails**: worst tenth of days $12.3 leaning on Dee against $10.2 not (before $14.2 against $15.3). Why:
  not selling to Dee means more lifts in the park, and a mark who caught you lifting is against you and calls in the
  next one: the quiet park goes hot and the police stop you there (0.07 stops a day not leaning, 0.05 leaning; none
  before trust). The door's tail is still there; crime in the park now has a worse one. Not tuned away: it is the
  consequence slime asked for.
- **Mark 12 still fails**, by a little less: both places $76 against the market's $72 (+4%, was +3%), with the cutter
  $89 against $85 (+5%, was +4%). Trust being local nudges play toward moving on, not by 10%.

## Goods, the connect and errands (goods-1)

Added 2026-11-14 after slime: "how can I sell to the crowd if I don't have drugs yet? ... you should have to buy from a
connect to sell, and it doesn't have to be just drugs", and "little things like that don't cost a turn but add
character". Rules only: the page and its pictures are a later job. Numbers in `src/run/config.mjs` (`goods`, `connect`,
`things`, each place's `connect` and `shop`, each selling job's `goods`).

**Goods.** Bought by the pack from the connect of the place that sells them, from what you carry, no hour:

| Good | Connect, where | Pack | A sale costs | Sells to | Pays a sale |
|---|---|---|---|---|---|
| Loose cigarettes | Cousin Earl, his truck in the trailer park | a carton, $10, 5 sales | $2 | Shaky Dee at the bus stop; the crowd at the market | $8–17 in the park (*the old free sale was $5–14*); $60–92 at the market |
| Bootleg films on disc | Teo, the back row of the flea market | a stack, $26, 4 sales | $7 | the crowd at the market | $64–96 (*the old free sale was $40–70*) |

At most two packs a day from one connect. A selling job lists the goods it takes and what each pays there; with none
of them on you it is **not dealt** (the view's `selling` says so, and who sells what where); with them on you it is
**always one of the two** drawn options while a buyer is left there today (2026-11-15: a player carrying goods sold
nothing in two days when the dice chose). With more than one good on
you it uses the best margin (pay less what a sale cost); a choice may name another (`{ do: 'job', id, good }`). **A
sale uses one, win or lose**: one that goes wrong is lost (you ditched it, or they walked off with it). The crowd has
four buyers now (Tiny and a man with a shopping cart are new), so carrying more can sell more. The test place, the
docks, carries pills: $54 for 3 sales, $108–156 a sale there. Deeper places, dearer and better-paying goods.

**The connect** is a person of the place like any other for trust. Buying from them is dealing with them (+1, and
good will holds while you keep buying). Against you, they will not sell ("Cousin Earl won't sell to you: against you,
2 days"); with you, a pack is 20% cheaper ($8 a carton).

**At risk.** Goods on you are at risk like cash on you, and goods at the crib are safe like banked cash. A jump takes
them as it takes cash: a bad one all of them, a scuffle half; the inside pocket hides cash, not goods. Goods do not
make you likelier to be jumped (an earlier cut counted their worth in the jump chance: with that, and with goods taken
too, carrying anything was a double penalty and every seller lost money, measured). Sleeping rough, the same. **A
police stop** takes every good on you, your heat after jail is 2 instead of 1, and each connect whose goods they took is
pinched (trust −3): against you, so they will not sell to you tomorrow either. Going inside leaves your goods at the
crib (no hour); stepping out takes them all unless the choice says how many (`{ do: 'out', take, goods: { smokes: 2 } }`).

**The first day.** $20 banked buys a carton before any work (Cousin Earl is outside your door); discs ($26) need a day's
earnings first.

**Errands: money and no hour.** A place's `shop` is its errands, each with a keeper (a person of the place) and a spot:
food for energy, one a day, never over your day's full energy: a bologna sandwich, $4, from Gloria's kitchen window in
the trailer park; the energy drink, $5, from Mrs. Bao's cooler at the market (kept as the market's food). At most 2
energy a day bought this way. **Things**, cosmetic only (no number changes), owned for the run like the bed, bought on
the street from what you carry: to wear, from Mrs. Kowalski's clothes rail at the market, a casino visor (head, $6), a
bowling shirt (top, $12), a gold-tone chain (neck, $18), white high-tops (feet, $25); for the trailer, from Mr. Pruitt's
yard sale in the park, a lava lamp ($8), a box fan ($10), a beanbag ($20), a fish tank ($30), each with the spot in the
trailer it sits at. Something to wear goes on if its slot is free; at the crib you put things on and take them off for
nothing. Listed for the corner (locked, so not for sale yet): a camel overcoat ($140), a real gold chain ($220), a
leather recliner ($160), a home bar ($300).

**Seen.** New events: `pack` (who, at, spot, good, pack, price, off, sales, carried, home, left today, trust), `shop`
gains `kind`, `keeper`, `spot`, `perDay`, `left`, `used`; `thing` (item, label, kind, slot, inTrailer, price, keeper,
spot, worn), `wear` and `unwear` (item, slot, replaced, worn). A sale's `job` event carries `goods` (good, label, used,
left, home); `jumped` and `robbed` carry `goodsTaken` and `goodsLeft`; `stopped` carries `goodsSeized`, `heatAfter`, and
`trust`/`trusts` (the connects pinched); `bank` and `inside` carry `stashed` and `home`; `out` carries `tookGoods` and
`home`; a `hop` forced by being left short of the fare carries `forced`. The view adds `goods` (each good: carried,
home, perSale, worth, where and from whom, where it sells and for what), `connects` (each place's: who, spot, good,
price now and base, off, sales, left today, sells and why not, trust and band, here, key), `selling` (where you stand:
each selling job, dealt or not, what it takes, and where to buy), `atRisk` (on you, and what a bad jump, a scuffle or a
stop would take, with heat after), `errands` (every place's food and things: keeper, spot, price, perDay, left, owned,
buyable, why), `things` (owned, worn by slot, the trailer's), on each option `uses` (good, n, cost, carried, left,
home) and `goodsHere`, on the danger's jump `takesGoods`, on its stop `seizesGoods` and `heatAfter`, and on the step-out
move `takeGoods`. New choices: `pack`, `get`, `wear`, `unwear`.

**Saves.** State version 5 adds `goods`, `stash`, `things`, `worn` (and `books.goods`, `books.things`). An older save
loads with none of them.

**The scripted players** (`src/run/policies.mjs`). A crime player buys a pack from the connect of a place it plays
(the park only: Earl's; the market only: Teo's; both: both) when it has none left, and only of a good worth the risk:
where a sale of it beats an hour of the safe job by more than one bad jump could take there (the whole pack where
people jump you). The cartons pass (at the market, $29 a sale over the stall against $10 at stake); since run-18 the discs do
too ($27 over the stall against $26 at stake; at $60 they did not), so the players buy discs at the market (see the marks). On a market trip it
takes at most two of each good out and leaves the rest at the crib. The **dealer** plays both places, sells whenever
it is dealt a sale, and carries `carry` of each (1, 2 or 4); `noSell` is the same both-places player never buying in.
The measures count goods in hand at what they cost (a pack is money turned into stock).

### Marks of goods

Measured 2026-11-14, 3,000 seeded six-day seasons per cell, as the others (`node scripts/run-marks.mjs`, 23 minutes:
the view now carries more). Three tuning rounds of numbers, then a change to the players: (1) the cartons' park sale
$5–14 to $8–17 (at $5–14 less $2 a sale it lost to the odd job and nobody sold to Dee); (2) the crowd's pay up (a
sale at the old pay was worth no more than the wallet it pushed out of the deal, and stock unsold at the season's end
counted as money thrown away: the measures now count stock at cost); (3) the discs dearer ($40 to $60) and two more
buyers in the crowd. After each round every seller still lost money, because the players bought discs and the market's
jumps took them; the players then learned to buy only what is worth the risk (above), and from there:

15. **Buying in is a real choice.** The dealer (both places, home at $120, carry 2) against the best player who never
    buys a pack, every kit: mattress $84 against $75 (+12%), pocket $97 against $87 (+12%), cutter $99 against $89
    (+11%), pocket and cutter $109 against $98 (+12%), bed $123 against $111 (+11%), all three $169 against $154
    (+10%). Against the marks' best (the market alone): +16%, +16%, +17%, +14%, +11%, +14%. **Fail**, by 1 to 2 points
    in three kits on the second half: the dealer is the marks' best player plus both places (mark 12's +11–12%) plus
    selling. Not a trap, and not the only way: never buying banks 10–12% less.
16. **Carrying more is more risk, and more profit up to a trip's sales.** Goods lost a day at carry 1, 2, 4: mattress
    0.09, 0.28, 0.76; bed 0.26, 0.59, 1.42; the worst tenth of days falls as the carry rises (mattress −$4, −$6,
    −$10). The take: mattress $82, $84, $85; cutter $98, $99, $99; bed $117, $123, $122. Pass, narrowly: past two a
    trip, carrying more is only more risk.

**The discs' price, run-18 (2026-11-14): $60 to $26 a stack.** At $60 for 4 the whole stack rode the market's
jumps and a market player who bought discs banked less than one who did not, so Teo was a trap. Two rounds of the
quick probe (600 seeds, six days, home at $120; a scratch copy of the players made to buy discs at any price, since
their own rule above refuses them over $26): the market player buying discs against not, mattress and cutter, at $36
-2.6% and -1.5%, $42 -4.7% and -2.2%, $48 -6.6% and -3.7%, $24 +1.8% and +1.8%, $27 +0.6% and +1.0%, $30 -0.6% and
0.0%. Nothing from $36 to $48 pays; about half the discs bought are lost to the market's jumps and failed sales,
whatever the price. **$26** is the dearest stack the players' own rule buys and the cheapest that keeps the
cartons the crowd's best margin. Before ($60) and after ($26), the same 600 seeds, mattress then cutter:

| Player | $60 | $26 |
|---|---|---|
| The market only | $72.6, $86.6 (no discs bought) | $73.2 (+0.8%), $87.9 (+1.5%), buying 0.32 stacks a day |
| Both places (mixed) | $82.0, $94.8 | $79.7 (-2.8%), $92.8 (-2.1%) |
| The dealer | $84.6, $99.0 | $81.6 (-3.5%), $96.9 (-2.1%) |

Teo is now modestly worth it for a market player. **The cost**: the both-places players now buy discs too, and lose
by it, because the cartons they already carry sell to the same crowd and the crowd buys only twice a day; mixed at
$79.7 against the market's ~$73 puts mark 12 near +9%, under its 10% bar (not measured in full: the 23-minute marks
were not run). A fix, for slime to decide: the players buy a good only when no good they carry sells to that buyer.

**The sandwich**, measured (1,000 seeds, mattress): a park player who eats it when spent banks $65 against $60 (0.86
a day), both places $86 against $82. No mark's player eats, so the marks are unmoved; but a park player who eats would
put mark 2's margin at +13%, under its 15% bar.

**What goods moved in the fourteen marks** (before, then after): mark 1 +62%, the same; mark 2 $72 (+22%) and $85
(+43%), now $73 (+23%) and $84 (+43%); mark 3 25%, now 22%; mark 4 $27, now $22, still worst in all six kits; mark 5
$72, $85, $97, $149, now $73, $84, $96, $148 (+15%, +14%, +54%); mark 6 4 days, unchanged; mark 7 +13%, now +15%; mark 8
$35 and $81 against $72 and $105, now $34 and $80 against $72 and $103; mark 9 the park with bins $44 against $59, now
$41; mark 10 $75 against $71 and $66, now $75 against $70 and $67.

- **Mark 11 still fails**: worst tenth $8.7 leaning on Dee against $6.0 not (was $12.3 against $10.2), means $60 and
  $57. Selling to Dee now needs a carton; the park's crime tail is unchanged.
- **Mark 12 passes now**: both places $82 against the market's $73 and the park's $59 (+12%), with the cutter $94
  against $84 and $60 (+11%). The single-place players buy only from their own place's connect; the park's cheap
  cartons are worth carrying to the market's crowd, and that is what the park is for now.
- **Mark 13 now fails, narrowly**: with the bed the good neighbour banks $132 against the burner's $118 (11% apart; the
  bar is 10%); the other kits 1% to 8%. Selling is work that wins people over, and the neighbour does it more.

## Routes (routes-1)

Added 2026-11-15 after slime: "just going back and forth to the market to trailer park is pretty repetitive", "you
could walk or skateboard to the market if you have enough energy and along the way there are even more options", and
a skateboard to buy, "faster and less energy than walking". Rules only: the page and its pictures are a later job.
Numbers in `src/run/config.mjs` (`routes`, `ways`, `stops`, the `street` tier, `things.board`).

**The route is a place.** Beside the subway there is a way on foot between the trailer park and the flea market, both
directions: the walk by Fit Street. No fare, no turnstile. It passes one stop, **Fit Street, outside DEAD AIR**. Why
there: DEAD AIR's block (`bar` in `src/map.mjs`, the city block −3,0) is the one block of the map that lies between
the park's and the market's: about 4 m off the straight line from Sunny Acres to the Jay St lot, 176 m from the one
and 39 m from the other (`demo/stage/places.json`; `test/run-routes.test.mjs` checks it). The stop is `block: 'bar'`,
`spot: 'street'`; the barkeeper's errand plays at its `counter:shop`. No other block lies between, so one stop, not
two; a route may list more (the test adds a second, and they are passed in order, reversed coming back).

**What walking costs.** The way costs 1 energy, paid as you set out. You need 2 to set out from home (enough to get
back, as for the subway) and 1 to set out for home. Setting out is an hour where you were, and its danger rolls as the
subway's leaving hour does: nothing in the quiet trailer park; the market's jumpers, your hours there counted, on the
way home. That hour brings you to the stop. Going on is another hour, on Fit Street's ground, and its danger rolls
(your time at the stop counted). So a walk is 2 hours and 1 energy against the subway's 1 hour, 1 energy and $2. The
hour stays the clock: setting out and going on are steps, nothing is walked in real time, and at the stop the way on is
always open (it was paid), even at energy 0.

**Fit Street's ground** is a new tier, `street`: it pays like the market (× 2), has a quarter of the market's jumping
(× 0.25 on the chances, no stronger), the police come only once it is hot (heat 3), and it cools 2 a night. Walking
home with $90 on you is the market's leaving hour, as on the subway, and then 3% on Fit Street (4%, and 9% for the $90,
× 0.25); with nothing on you, 1%. The view says it before you choose. (*At × 1, the market's own tier, walking home
lost $8 a day to the jumpers and playing the stop on the way home lost more than it paid; at × 0.5 still both:
measured, 300 seeds.*)

**The stop's cards.** Arriving, you are dealt 3 of the cards the stop can deal you now (the seeded dice, on the day,
the hour and the stop: the same state deals the same hand). Play any of them, each an hour and an energy like a job,
or pass them by. Each at most once a day there.

| Card | Odds | Pay | If it fails |
|---|---|---|---|
| Carry crates down to the cellar for the barkeeper | sure | $20–26 | |
| Keep a lookout at the alley mouth for a stranger | 75% | $26–36 | heat +1 (on you and on the street) |
| Walk a stranger who had one too many to the FIT ST stairs, for a tip | 90% | $18–28 | nothing |
| Sell a smoke to a stranger outside DEAD AIR (dealt only with cigarettes on you) | 80% | $24–34 | the smoke is lost |
| Dig through the dumpster in the alley | the street's bins, × 2 | 50% nothing, 45% $2–8, 5% $24–40 | |

Nobody on Fit Street is a person of the game: no trust, no mood, nobody to tell on you. Tired is −15 here as anywhere.
An hour at the stop rolls the street's danger, the hours there counting as at a place. The dumpster draws on the stop's
own bins (2, both back each morning).

**The skateboard.** $100, from Mr. Okafor's stall at the flea market (`stall:6`), from what you carry. Owned for the
run like the things to wear (`things.board`, kind `ride`); not one of the three things of the goal. On the board a way
is one hour and no energy (you still need 1 to push off, and 2 to go out, as on foot). The hour you set out rolls where
you are, as on foot; then nobody catches you between the stops: going on from a stop takes no hour and rolls nothing.
You can still stop and play a card, an hour and an energy as on foot. On the mattress it turns four hours of market work
into six.

**Seen.** New choices: `{ do: 'walk', to }` and `{ do: 'skate', to }` at a place a route leaves from (listed after
every older move, so their keys are unchanged); at a stop `{ do: 'card', id }` and `{ do: 'onward' }`, and nothing else.
New events: `walk` (you set out: `way`, `route`, `from`, `toPlace`, `via`, `energy`, `hours`), `stop` (you are at a
stop: `stop`, `spot`, `hand`, `next`, `toPlace`), `card` (a card played: `card`, `stop`, `label`, `with`, `roll`,
`chance`, `outcome`, `pay`, `heat`, `placeHeat`, `goods`), `onward` (going on: `passed`, `next`, `hours`), `arrive` (at
the end: `way`, `route`, `from`). Every event on a route carries `route` and `way`; the dumpster's is a `bins` event
with `card`; a jump or a stop on the way is the usual `jumped` or `stopped`, at the stop (`place: 'fitst'`, `block:
'bar'`). At a stop the view's `place` is the stop, `block` its block, `danger` its hour's. The view adds `route` (where
you are on one: the ends, the way, the stop and its block and spot, passed, ahead, next, the hand, text), `hand` (the
cards dealt you: odds, pay or finds, what a sale uses, energy, `perEnergy`, choice), `routes` (every route: its stops
with block, spot, tier and the cards they can deal; its ways with energy, hours and whether you own what they need),
and on each way's move (`what: 'route'` or `'onward'`) `danger`: each leg ahead (`from`, `to`, `hours`, `rolls`, its
jump and stop chances and what they take) and the whole (`jump`: `chance`, `bad`, `scuffle`, `takes`, `takesGoods`;
`stop`: `chance`; `atStake`: cash, goods, worth; `text`). That is the page's meter.

**Saves.** State version 6 adds `route` (null at a place). An older save loads on no route; a stop's supply it has
never drawn on reads as full.

**The scripted players** (`src/run/policies.mjs`). The *walker* is the market player home at $X (`homeAt`) on foot:
both ways, or out only (the subway home); passing every stop, or playing them: on the way home the best card of the
hand while it pays more an energy than the trailer park's odd job, less what an hour there could cost (the view's
danger: what a bad one or a scuffle would take of what it carries), and never one whose failure takes its heat over its
bar; 'all' plays every card it can both ways. On the way home is where a card is worth it: the energy left would go to
a short second trip (two of its energy on the rides) or to the park. The *skater* goes every way on the board and plays
the stops as the walker does. Every older player never walks.

**On the page** (2026-11-16, `demo/run/`). The bar: Walk (W) beside the subway at the park and the market, "no fare ·
2h", and Skate (Q) once the board is yours (till then in All moves; the Stuff panel sells it at Mr. Okafor's); keys of
every older move unchanged. Picked, a way turns the bar's danger line into THE WAY'S: its % jumped, the bad one and
scuffle fills, police, what is at stake, each leg in its small print, read before Go. At the stop the hand is the
hour's options (1 2 3) and Walk on / Skate on (W / Q) the one move; the top line puts FIT ST between PARK and MARKET on
a dashed line while you are on the way. The stage: every leg is the rides' `foot` or `skate` (a few steps off, the cut,
the walk or roll in; home lands up the lane and walks in, as from the subway); what the hour brought where you were is
played there first. The stop's people are the stage's own (`scenes.js` STOP_FOLK: the barkeeper, a stranger at the
alley mouth, one who had one too many, one who wants a smoke) with small days on DEAD AIR's block at the place table's
stands; each card is played with its person (`acted.js`). Auto-play: `--policy walker`, `--policy skater --kit board`
(`demo/tools/run-stage.mjs`); pictures: `demo/tools/run-route-shots.mjs`.

### Marks of routes

Measured 2026-11-15, 600 seeded six-day seasons per cell (`node scripts/run-marks.mjs --seeds 600`, 381 s for all
twenty marks). The market, home at $X, on the mattress, unless said. Three rounds of tuning: (1) Fit Street started
on the market's own tier (`rough`): walking home lost $8 a day to the jumpers, a walker who played the stops banked $63
against $70 passing them, and every card on the way home cost more in what was taken than it paid; (2) half the
market's jumping (× 0.5): walking home still lost to the subway ($75 against $78), and playing the stops gained −1%,
then +2% once the cards paid nearer the stall ($14–20 for the errand became $20–26); (3) a quarter (× 0.25), and a
hand of 3 with a fifth card (the stranger to the stairs): with a hand of 2 playing the stops was +6%, barely over the bar.

- **R1. Walking is a real choice.** The best walker $83 (on foot both ways, playing the stops, home at $90) against the
  best subway rider $77 (home at $90): 8% apart, the bar 15%. Neither way is simply better: on foot both ways, passing
  the stops, $77, $77, $74 at $90, $120, $160 (what you carry home rides Fit Street's ground); on foot out and the
  subway home $78, $77, $74. Pass.
- **R2. Stops are worth it, never the point.** Home at $90: playing the stops $83 (0.79 cards a day, $16.5) against
  passing them $77: +8%. Playing every card it can, both ways: $81 (2.53 cards a day), less than playing them only
  on the way home. An energy, on the real engine: the errand $23.0, the lookout $23.2, the stranger to the stairs
  $21.1, the sale $21.4 (less the smoke's cost), the dumpster $3.5, against the market's stall $25.8. Pass.
- **R3. The skateboard shows.** On the board $110 (home at $90, both ways, playing the stops) against the best without
  it $83 (the best walker): +32%; its $100 earned back in 3.8 days. Pass. (*It is strong: no energy for a way is two
  more hours of work a round trip. The bar was 8%+; the price was set from the gain: at the first $60 it was earned
  back in under 2 days. slime's call whether a thing this strong belongs before the three.*)
- **R4. Carrying on foot is a readable risk.** The dealer (both places, home at $120) on foot both ways, carrying 1, 2,
  4 sales of each good out: lost a day on the route's ground (jumped or stopped there: cash, and goods at cost) $1.52,
  $2.16, $2.96 on the mattress; $2.49, $4.05, $4.41 with the bed. Pass. (*Measured on the dealer, not on walkers home
  at rising amounts: a walker home at $30 walks twice as often as one home at $160, so what it loses a day hardly moves
  ($1.66 at $30, $1.85 at $90, $1.76 at $160, $2.39 at $300); the view's meter (rising with what you carry, the test
  checks it) is the per-walk answer.*)

**What routes moved in the sixteen marks: nothing.** Every older player never walks, and the new dice are their own
(`run-hand`, `run-card`), so the 600-seed table is the same to the dollar as before routes: 1 to 10, 13, 14 and 16 pass;
11, 12 and 15 fail as they did (11: worst tenth $10.4 leaning on Dee against $6.5 not; 12: both places +12% on the
mattress, +10% with the cutter, just under; 15: the dealer +14% to +22% over never buying). Mark 12 was not made to
pass: a both-places player on foot playing the stops banks $92 (home at $90) against the subway's $88, but the market
player on foot gains as much ($83 against $77), so "both places beat one" stays where it was. Measured aside, not a
mark.

## Home pressure (home-1)

Added 2026-11-16 after slime: "you know how in rimworld as you progress you get raided, like we need something that
feels fun, like the trailer park where you start needs to get tougher to hold or something and neighbors could start
getting mad, so maybe you need to hire guards to defend off angry addicts or something, then eventually you run out of
space so need to get something bigger which forces you deeper into the city". This is the part before "run out of
space": what you do at home builds a pressure, somebody comes for what you have banked, and you can defend it. Moving
to a bigger home is not built (it needs a second home on the map); no rule names a place, so the home is whatever the
crib's `inside` says. Rules only: the page is a later job. Numbers in `src/run/config.mjs` (`pressure`, `raid`,
`guard`, each job's `pressure`, `street.rob.pressure`, `things.deadbolt`, `things.floorsafe`).

Three conditions hold, each a test (`test/run-home.test.mjs`): **banking stays the point** (an attempt is warned of the
day before, takes a share and never all, and a choice can stop it); **pressure is what you do at home, never what you
have** (the same lift with $0 or $100,000 banked moves it the same); **it comes in waves** (never two days running, two
quiet days at least after each).

**Pressure.** One number, 0 to 10, made of reasons the view lists in words. What you did on the street your crib opens
onto (the trailer park), each still holding it up:

| Done at home | Pressure |
|---|---|
| A sale (loose cigarettes to Shaky Dee) | +1, win or lose |
| A wallet | +1; caught +2 |
| A debt | +1 |
| A till, a stick-up (if a home street had them) | +2 |
| Robbing somebody passing | +1; failed +2 (at +2 and +3, robbing once in the park and once at the market lost to robbing twice at the market: mark 10) |
| Seen in the bins (not by somebody with you) | +1 |
| Somebody against you calls the police on you there | +1 |
| Shutting the door on a regular (or walking out past them) | +2 |
| An odd job for a neighbour | −1 |
| Giving a regular what they ask at your door | −1 |

The same at the flea market counts nothing. These points fade every morning, the oldest first: 1 after a day you
added to them, 2 after a quiet day. And who lives there, while it lasts: each person of the trailer park against you
+1 (Benny after a debt that went wrong, a mark who caught you, Dee with a grudge), each with you −1 (they look out for
your door; a regular never does: they want more from you), the trailer park hot +1. Nothing you bank, own or carry
counts. There is always a move that brings it down: a quiet day, an odd job, giving at the door.

**The warning.** From pressure 3, each morning (wherever you woke) has 30% + 15% for every point past 3 (at most 85%)
that somebody is seen casing your crib: Shaky Dee if he holds a grudge; else whoever of the trailer park is most
against you; else a regular you have hooked; else somebody nobody here knows. The event names them, what is at stake
(30% of what you have banked now), and what you could do: a deadbolt, a floor safe, Cousin Earl on your step, be home
when they come, or lay low. The attempt is the next day. Laid low (the pressure down to 1 by that morning), they think
better of it (`calledOff`). No warning while an attempt is due, nor on the morning after one: with the warning's day,
two quiet days at least between two attempts.

**The attempt.** They wait for you to be gone: it starts the first time, from a seeded hour between 13:00 and 16:00, that
you are away from home (the crib, or the trailer park). A notice reaches you wherever you are (word from somebody there who
is with you, if anyone is), with the ways home and their hours: the subway 1, the board 1, walking 2. Home inside 2 hours and
you meet them at the door: the regular's fight (the city's roll and its four bands) at strength 45, less 15 for the box
cutter. Their clean win: in past you, the share taken, energy −4; a scuffle: half the share, energy −2; otherwise you see
them off. (Strength 45, not the regular's 55: they came for an empty trailer and found you. At 55, meeting them saved
too little for racing home ever to pay, measured.) Home all day, they come in the night and you meet them at the door
(what it costs you comes off the morning's energy). Not home in time, or held in the jail or the clinic, your defences
settle it: Cousin Earl on your step first, then the door, 75% they get in. In, they take 30% of what is banked (whole
dollars, rounded down: never all of it), never goods, never things. The notice is a step in time, not real time: the
window is checked after every move, so a ride home that lands inside it is met at the door. (The timed window held up:
it is shipped, not the fallback.)

**Defences.** Each does one thing.

| Defence | Where, from whom | Price | What it does |
|---|---|---|---|
| A deadbolt | Mr. Pruitt's yard sale, the trailer park | $25 | They get in 50% of the time, not 75% (nobody home, nobody on the step) |
| A floor safe | Mr. Okafor's stall, the flea market | $100 | In, they take 8% of what is banked, not 30% |
| Cousin Earl on your step | at the crib (he sells cartons from his truck in the park) | $75 for three days, up front (*was $25 a day*) | An attempt fails unless he is beaten (their clean win: 15%); beaten, he is hurt and off 3 days, the rest of his stretch is lost, and the door decides it |

The deadbolt and the floor safe are things for the trailer like the lava lamp (`kind: 'home'`, `inTrailer`: by the
door, under the counter), bought on the street from what you carry, with `defends` saying what they change. The guard is
the game's first hire: hired at the crib for three days, paid from banked up front ("Cousin Earl by the stretch",
below; until save-1 he was put on or off by the day at $25). Against you (a police stop took his cartons off you: −3),
he will not take the job. One guard, no upgrades. (Benny Two-Coats was the first pick; a player who collects his debts
has him against you on most of the days he is needed, measured.)

**Seen.** A job, robbing, the bins, a call to the police, refusing and giving at the door carry `pressure` on their event
(`from`, `to`, `change`, `n`, `why`, `value`, `max`, `text`). New events: `casing` (who, why, at, the attempt's day, the
roll and chance, the pressure and its reasons, the stake, `could`: each defence with its price, keeper and place, the
guard, being home, laying low), `alarm` (the notice: who, the teller, when it started and until when, the window, each
way home with its hours and whether it is in time, the stake, the defences), `raid` (who, how: `door`, `guard` or
`away`; outcome `held` or `taken`, taken, share, banked before and after, the guard's fight, the door's fight, the
door's roll, the defences, night, held), `calledOff`, `guard` (on, off, paid, why). The view adds `pressure` (value,
max, warnAt, level, every reason with its points and who, what eases it, and `leadsTo`: tomorrow's value, the chance
of a warning then, or why none) and `home` (`warning`, `notice` with its ways and what decides it if you stay,
`defences`: the things and the guard with their moves, `odds`: how an attempt would go now, away and at the door, and
the attempts so far); on each option at home `pressure` (how it would move it); the moves `get` for the deadbolt and
the safe (after every older move, so older keys are unchanged) and `{ do: 'guard', on }` at the crib.

**Saves.** State version 7 adds `home` (`marks`: what you did, still holding the pressure up; `raid`: the attempt you
were warned of; `last`: the day of the last one; `guard`; `raids`) and `books.burgled` (taken from what was banked,
in the ledger's check) and `books.guard` (his wages, part of spent). An older save loads calm: nothing done, nothing
due, nobody on the step.

**The scripted players** (`src/run/policies.mjs`). The *quiet* player plays both places but only the safe jobs (odd
jobs, the stall). The *home-first* player (`homeFirst`) does the trailer park's crimes first, then the market, home at
$120: it brings pressure on and is away when they come. Beside them, every older player meets attempts without knowing
they exist (the trailer park's crime player, `mixed`, the dealer, the burner). `defend: 'guard'` hires Earl on the
morning an attempt is due (since save-1 a three-day stretch; `guardWhen: 'worth'` only when what the attempt stands to
take is more than his price); the deadbolt and the floor safe are owned from the start, as kits; `race` heads home on a notice
by the quickest way in time, when what meeting them would save is worth the hours it has left (and not when its own
trip ends in time anyway); `carryAll` takes everything banked out every time it steps out.

**On the page** (2026-11-16, `demo/run/`). The meter: HOME on the dock under heat and energy at every place (0 to 10, the
warning's line marked, "· tomorrow", "· today", "· now" beside it while something is due); a click or L opens its slip
beside the dock: what holds it up (the view's reasons), what brings it down, what it leads to (tomorrow's value and the
chance of a warning), how an attempt would go now, out and at the door, and the three defences. In the trailer park each
option carries "home +1" (or "+1/+2", "home −1") on its small line as heat's "+1" is shown; Rob and the door's answers
say it too. The warning: the morning after the night it rolls, the player comes out to his porch and whoever it is
stands south-west of his step looking his door over, then walks off (`casing` in
`acted.js`; a stranger is one of ours in the crowd's clothes, `npc:caser` in `scenes.js`); then its card (who, why
them, what is at stake, what you could do), and while it stands one red line on the top line ("… will try your crib
tomorrow"). Called off: the notice slip. The notice: wherever you are, the phone (`phone`) and then a panel over the
picture's top that stays until it is over: who is at your door, the hours left, every way home with its hours, its fare
and "in time" or "too late", each one pressable there, and what happens if you stay. Once the notice is up they wait by the
lane south-west of the trailer, off your way home; the panel folds to its line on the top line while any scene plays. The attempt: home in time, up
the lane at a run to the door, in (what you carried banked) and out to them on the porch, the picture with you, and the
regular's fight there (`fight:*`'s steps less a beat, won or lost), then in again; Cousin Earl on the
step facing them (`guard`, a shove, or beaten: down, up, limping off); in the night, the same at the morning's porch.
Not there: at once the same panel says how it went (the deadbolt held, $X gone, Earl saw them off, Earl beaten), and
coming home you stop at your door and look round, Earl tells you if he was there, and inside at the floorboard what is
missing; then its card. Defences: the deadbolt (at Mr. Pruitt's, K on the bar) and the floor safe (Mr. Okafor's) in
the Stuff panel's "Defending your crib" with what each does; the floor safe stands in the room as the kit's small safe
(`safe-small`, a floor slot of its own in `demo/stage/set/starter.js`); Earl hired at the crib (on the bar; by the stretch since save-1), and
while on he keeps his post east of your door, his back to it, the one Earl (buying his cartons walks you to him there).
Auto-play: `--policy homefirst`, `guard`, `racer` (`demo/tools/run-stage.mjs`, its line `home:`); pictures:
`demo/tools/run-home-shots.mjs`. The porch has its own places, apart (`demo/run/index.js` porch: the visitor
south-west of the step, the waiting place by the lane, Earl's post east of the door), so nobody stands in anybody
outside a fight or a hand-over; the picture tool measures it. The picture (save-1, the one camera change the owner allowed): while somebody cases the trailer, or is
met at the door (coming home in time, going in past them and out to them, or in the night), the page names who the
scene is about (the player and them; Cousin Earl, when he is on, only if the frame allows: `stage.inside.keep(ids,
also)`) and the door's low shot (`demo/stage/inside.js` doorView) aims at the middle of them and stands back and up as
far as it must for each to be whole inside the free part of the picture: none nearer the lens than 6.5 m nor taller
than a third of the picture, none in front of another, none behind the city's own things. When no low lens there can
hold them, the picture keeps the Lock on the player, as it is a moment later anyway once he stands. Nothing else about
the camera changes. Measured (guard and racer, seed 8): without Earl both are whole in every door shot; Earl at his
post is behind his own yard stall from every low lens (seen in the Lock after), and on his side of the door whoever
came shows head and shoulders over that stall's counter. The top line says where he is seen ("your crib") while he
is home, not where the ride came from. Stand-ins (no new clips): the casing is `deal_lookout` and `smoke`; the door is
`deal_lookout` at the step (not `pick_lock`, which wants a door to stand at); the coming home is `deal_lookout`, `talk`,
`floorboard_rummage`, `hands_up`.

### Marks of home pressure

Measured 2026-11-16, 600 seeded **ten-day** seasons per cell (`node scripts/run-marks.mjs --seeds 600`, 543 s for all
twenty-seven marks; `--home` for these seven alone): pressure builds over days, and the bank worth taking grows with
them. The quiet players: the stall only, and both places doing only the safe jobs (mattress and bed). The pressured
players, never defending: the trailer park's crime player, and the home-first player on the mattress and with the bed.
**The home-first player with the bed is the pressured player of H3, H5 and H7**: with the bed its market trips are long
enough that it is away when they come; on the mattress it is usually home again inside the window, so the door decides
it (shown beside).

Tuning, in order: (1) at first an attempt started at its hour wherever you were, and a player who lingers at home met
nearly every one at the door, so the deadbolt and racing hardly counted: now they wait for you to be gone; (2) racing
home on every notice lost money ($49 against $53 a day): the regular's strength at the door (55) made meeting them save
too little, and most notices came as the player arrived at the market, so it turned straight round; the door is now 45,
and the racer races only when it pays and not when its own trip ends in time; (3) the share 20% to 30% and the floor safe
5% to 8% (H2 and H3); (4) the guard was Benny Two-Coats: the home-first player collects his debts and had him against it
on most days it needed him (net +$2.8 a day); Cousin Earl now; his wage $10 to $25 (at $10 he was worth it to anyone
warned); (5) laid low, called off at pressure 2 left the trailer park's player at 7.9% (H2): called off now at 1, and
warnings from 3, not 4; (6) robbing at home +2/+3 to +1/+2 (mark 10, below).

- **H1. A quiet player is left alone.** Attempts in 0.0% of runs: the stall, both places quiet, both places quiet with
  the bed (no warning ever: nothing they do counts, however much they bank). Pass.
- **H2. It matters, it is not ruin.** What attempts took of what was earned: the trailer park's crime player 9.6% (1.42
  attempts in ten days, 1.31 met at the door), home-first on the mattress 14.6% (2.39, 2.04 at the door), with the bed
  22.4% (2.63, 0.25 at the door). Pass.
- **H3. Defences are choices, not a tax.** For the pressured player (bed): the deadbolt ($25) +$10.2 a day, paid back
  in 2.4 days; the floor safe ($100) +$25.0 a day, 4.0 days; Cousin Earl ($25 a day, put on the day it is due) +$18.3 a
  day after his wages ($50 a week); since save-1 ($75 for three days, hired the morning it is due) +$8.9 a day after
  his hire ($124 a week), on the mattress −$7.2 a day. For the quiet player with the bed: +$0.0 for each, never worth it. Pass. (On the
  mattress the home-first player is mostly home when they come: the deadbolt +$0.8 a day, 31 days; the floor safe +$7.8,
  13 days; Earl +$1.8. For a player who is home, a deadbolt is a poor buy: a choice.)
- **H4. Waves.** 19,622 attempts in 12,000 runs: none on the day after another, none with fewer than two quiet days
  between; the closest two are three days apart. Pass.
- **H5. Banking still wins.** The pressured player banking $79.5 a day against $13.6 carrying it all (+487%: the market
  takes a carried bank in a day); on the mattress $52.0 against $13.4; the trailer park's player $51.5 against $33.9 (a
  quiet park with nobody to jump you still has the police once it is hot). Pass.
- **H6. Never without warning.** 19,622 of 19,622 attempts came the day after their warning. Pass.
- **H7. Racing home is worth it sometimes.** With the bed: ignoring $79.5, racing $88.0 (it raced on 0.14 of 0.25
  notices a day), the best defender $104.5 (the floor safe). On the mattress racing $52.0, the same as ignoring (it raced
  on 0.02 of 0.19: its trips end in time anyway). Pass.

**What home pressure moved in the older marks** (600 seeds, before then after; `run41/marks-before.txt` and
`marks-after.txt` in the session's scratch). Every player who never does anything at home is unchanged to the dollar:
every market cell, the stall, heat-blind play, the walkers and skaters, the good neighbour. So marks 1, 3, 4, 5, 6, 7,
8, 14 and R1 to R3 read exactly as before. The players who do crime at home now meet attempts:

- The trailer park's player: $59, $59, $60, $60 → $55, $55, $57, $57 (mattress, pocket, cutter, pocket and cutter).
  **Mark 2** still passes, by more: +30% and +53% → +40% and +65%. **Mark 9**: the park with bins $40 → $35, still under
  the park's $55.
- **Mark 10**: moving $75 → $74, twice in the park $65 → $64; twice at the market $71 unchanged. Still passes (at +2/+3
  for robbing at home it failed: $68 against $71).
- **Mark 11 now passes**, for a new reason: always selling to Dee brings attempts, and a day one takes from is a bad
  day: worst tenth −$36.0 leaning against $6.0 not (before $10.4 against $6.5); means $60 → $51 and $57 unchanged.
- **Mark 12 still fails**, by more: both places +12% → +10% on the mattress ($86 → $84), +10% → +9% with the cutter
  ($99 → $99 against $91).
- **Mark 13 now fails, by a hair**: with the bed the good neighbour $139 against the burner $126, 10.1% apart (it was
  just under 10% before: $139 against $126 too); with all three $188 against $172 (was $173). The burner does crime in
  the park after its trips. Not tuned: making refusing at the door +1 instead of +2 did not move it.
- **Mark 15 still fails**, closer: the dealer's margin over never buying +21%, +17%, +22%, +18%, +14%, +20% → +17%, +13%,
  +21%, +17%, +14%, +19% (it sells cartons to Dee at home).
- Mark 16 and R4 pass; the dealers bank $1 to $4 a day less.

## Cousin Earl by the stretch (save-1)

Added 2026-11-16. By the day at $25, the obvious move was to put Earl on only on the day somebody was coming, so a
warning was a $25 fee. The owner's ruling: three-day stretches, $75 up front. Numbers in `src/run/config.mjs`
(`guard: { price: 75, days: 3, ... }`; `wage` is gone from the config, and the view's `wage` is now price ÷ days).

**The rule.** At the crib, hire him: $75 from banked at once, and he stands on your step for three days, the day you
hire him and the two after (`home.guard.until`, his last day). No refund, and no sending him off: the old "take him
off" choice is gone. On the morning of his last day a notice says so; that day the same move keeps him three more days
for another $75, from the next day, no gap. Otherwise he is gone the next morning (said). Beaten at the door (their
clean win, 15%): hurt and off three days as before, and what was left of the stretch is lost (no money back). Against
you, he will not take the job; turned against you during a stretch, he finishes what was paid for (he is on, and
fights at your step) and will not be kept on (the two choices left open, built this way: it was also the simpler code).
Keeping him on is offered only on his last day, not before.

**Seen.** The hire is a `guard` event (`on`, `kept`, `paid`, `price`, `days`, `until`, `daysLeft`, `wage`); the
last-day notice a `guard` event with `lastDay: true`, `paid: 0`, `canKeep`, `why`, `scene: { notice: true }`; his going
a `guard` event with `on: false`, `why: 'done'`. A raid's `guard` gains `until` and `lostDays`. The view's
`home.defences.guard` (from `guardOf`) and the guard move gain `price`, `days`, `until`, `daysLeft`, `lastDay` (and the
move `keep`; `guardOf` a `text`); every older field is kept. The move stays the last at the crib (older keys unchanged)
and is always `{ do: 'guard', on: true }`: "Hire Cousin Earl for your step, three days ($75, paid now)", or, while he
is on, "Keep Cousin Earl on your step three more days ($75, paid now): through day N", available only on his last day.

**Saves.** State version 8 adds `home.guard.until`. A version-7 state handed to the rules with Earl on reads as him paid
through that day; `loadRun` refuses a version-7 save (`why: 'version'`).

**The scripted players.** `defend: 'guard'` hires him the morning an attempt is due (unless he is on through it);
`guardWhen: 'worth'` only when what stands to be lost (the view's `home.odds`: what an attempt takes × the chance they
get in, the defences owned) is more than his price.

**H8. Hiring Earl is a decision, not a reflex.** 600 ten-day seasons, the pressured player with the bed (home-first,
home at $120), three ways otherwise the same: never hires $79.5 a day; hires on every warning $88.4 (2.36 hires a run);
hires only when worth it $89.6 (2.00 hires a run). Pass, narrowly (+1.4% over every warning). With the deadbolt $89.8,
$90.9, $94.2; with the floor safe $104.5, $94.7, $104.5 (0.13 hires: he is hardly ever worth it); with both $107.7,
$95.4, $107.7 (none). The bank at which hiring starts to pay, by the rule (30% of it × 75% = $75): **$333**; with the
deadbolt $500, the floor safe $1,250, both $1,875. Counting that they beat him 15% of the time: $392, $588, $1,471,
$2,206. Measured aside (600 seeds, hiring when the stake × chance is over T): the best T is about $100 with no defences
($90.1 a day; a bank of about $444), $75 to $100 with the deadbolt ($94.2), and never with the floor safe.

**What moved.** Only H3's guard row (above): +$18.3 a day → +$8.9; on the mattress +$1.8 → −$7.2. Every other mark is
the same to the dollar (no older player hires him); 25 of 28 pass, 12, 13 and 15 failing as before.

**On the page** (save-1, `demo/run/`). Off, the crib's row has "Hire Earl · 3 days · $75" (its tooltip: paid from banked
now, no refund, what he does); hired, the hire's scene (out on the porch, the money handed over, his post) and, any other
day he is on, no button: a quiet tag "Earl on · N days left" in its place; on his last day the button "Keep Earl 3 more
days · $75". The Stuff panel's "Defending your crib" and the HOME slip say the price for the days, up front, and while
he is on the days left and his last day (the slip's mark "2d left"). The top line says "Earl's last day: keep him at the
crib" on his last day, and "Earl has gone: his days are up" the day after (in the quiet ink, not the danger's). The
morning report shows both by their `text`, his going in the trust line's quiet look, not as a loss. A keep plays nothing
and the player stays in. Auto-play counts `hires` (and `kept`, `lastDays`, `gone`; its line `home:` "Earl hired N").

**What the page had to follow** (the rules' notes to the page, all done above):
- The "Take him off" button and `{ do: 'guard', on: false }` are gone (pressing it throws "not a choice here").
- The guard move's `on: true` now means he is on and the move would keep him on (`keep: true`); the bar's label code
  (`m.on ? 'Earl off' ...`, `index.js` near "home-1: Cousin Earl on your step") and the panel's
  `g.on ? 'Take him off' : 'Put him on'` (`panels.js`) must read it as "Keep him on" (available only when `lastDay`).
- "$25 a day" (`money(m.wage)`, `money(g.wage)`) and "paid from banked now and every morning he stays on" are wrong:
  show `price` for `days` days, up front, and `daysLeft` / `until` while he is on.
- The morning report shows the last-day notice and the "days are up" event by their `text` (type `guard`); the
  latter has `on: false`, so the report marks it bad.
- A keep's event has `scene: { action: 'hand_off' }`, not `guard` (he is already on the step): `acted.js` stages
  nothing for it, as intended.
- Its auto-play counts `guardDays` by `guard` events with `paid` (`autoplay.js`): now hires, not days.
- The "Putting him on / Taking him off your step…" line (`index.js`) has no "off" case any more.

## Saving (save-1)

Added 2026-11-16: a reload of the page started the run again from day 1. The rules first; the page's side is its
"On the page", below.
`src/run/save.mjs`, exported from `src/run/index.mjs`:

- **`saveRun(state)`** → text: `{ "kind": "the-run", "v": <state version>, "state": <the state as it is> }`.
- **`loadRun(text, cfg?)`** → `{ ok: true, state }`, or `{ ok: false, why, text }`. It never throws. `why` is
  `'version'` when the text is a run saved by another state version (with `found` and `wants`; there is no migration:
  an older save is refused, not read), and `'broken'` for anything else: not JSON, not a saved run, a field missing or
  of the wrong kind, books that do not add up, a place that is not one, a state the rules cannot draw. (The "Saves."
  lines of the sections above say how the rules read an older state handed to them directly; `loadRun` refuses one.)

**What is saved: everything the rules hold.** The state is the whole game: the day, the hour, where you are (a place, a
stop on a route, the jail or the clinic), energy, heat (yours and every place's), what you carry and what is banked,
goods on you and at the crib, the three things and the things to wear and for the trailer, today's people and moods,
trust, regulars and anyone at your door, what each place has left today, the home's pressure (what you did there, an
attempt you were warned of or one under way, the last ones, Cousin Earl and his stretch), the books, and the seed. The
dice are not a generator held anywhere: every draw is `rng(seed, purpose, day, hour, ...)`, so a loaded state deals
the same hands and rolls the same rolls. Nothing in the state needed fixing for plain JSON: no Map, Set, function,
`undefined`, `NaN` or ±Infinity in it at any step of any player or of a random one (checked, and kept by the tests).
A run saved at ANY choice point and loaded goes on exactly as if it had never stopped: `test/run-save.test.mjs` cuts
fourteen scripted players over twenty seeds each once at a random step, and four runs at every step, plays each on
to the end of day 10 and compares the state, its view and every event after the cut with the uncut run; the cuts hold
a warning, a notice, an attempt, Earl on the step, a debt, goods carried, a route, a regular at the door, the jail or
the clinic, and a run done (all three owned).

**Size.** A new run is 677 bytes; after ten days 0.7 to 3.0 KB (median 1.2 KB over 800 runs of eight players; the
most for a player who brings attempts on, since every attempt adds a line to `home.raids`).

**What the page must keep for itself** (the rules do not hold it; a player would miss it after a reload):

- **What just happened.** Events are not state. The last step's events (the job's pay, a jump, the morning's report:
  the drift, the guard's last day, an attempt in the night, a regular at the door's text) are gone after a reload;
  what lasts is in the view (`home.warning`, `home.notice`, `door`, `home.raids`: day, who, how, outcome, taken).
  An attempt you missed while out (the page's `S.after`: coming home, the look round at the door, Earl's word, the
  card) is the page's: the state keeps only its line in `home.raids`. The log of the run so far is the page's.
- **Today's take.** The page's start-of-day ledger (`S.dayStart`), for the day's banked total.
- **A choice half made.** How much to take out, which goods, a way picked before Go, a selling option's good.
- **The crib as arranged** (already kept by the page in `localStorage`, per seed: `demo/run/arrange.js`).
- **The numbers.** A save is a state, not the rules: it loads into whatever `RUN_CONFIG` the page runs. The state
  version guards the state's shape, not the numbers, so a save made before a tuning change loads and plays on the new
  numbers.
- Where the stage's people stand, a scene mid-play, the speed and the pilot: the page's.

**On the page** (save-1, `demo/run/save.js` and `index.js`). ONE SLOT in the browser's `localStorage`
(`hk2.run.save`): the run in progress, whatever its seed, as `{ kind: 'the-run-page', v: 1, at, run: <saveRun text>,
page }`. `page` is what the page keeps for itself (`PAGE_KEYS`): the last step's result line, the morning's report until
it is put away, the log (the last 80 steps' lines: kept, no panel shows it yet), the coming-home card after a missed
attempt (`S.after`), the "they got in" notice (`S.raidNote`), a notice from elsewhere, the day's opening ledger, the heat
that just landed, Earl's going. A choice half made is never in it: a reload comes back to the choice with nothing picked.

- **When.** Right after every step (the state after a step is a choice point), before its hour plays, so a reload in
  the middle of a scene comes back to the next choice with what just happened (and the report, if the step ended the
  day), never to the same choice again; and again at every choice point, once the hour has played and its cards are put
  away. A state the tools hand the page (`load`) is saved too.
- **Picking up.** The play link (`/demo/?mode=run&seed=3`) with a save in the slot plays that run, whatever the link's
  seed (the link is rewritten to its seed, so the crib's arrangement, kept per seed, is the run's own): no opening, the
  player put where the state has them under the stage's cut, with everyone the view says is there (a regular at the
  door, Earl at his post, whoever waits by the lane while a notice is up); then what it had left to show (the report
  not yet put away, coming home after a missed attempt, the regular asking). One line says so ("Picked up where you
  left off: day 3, 14:00, the flea market."), in the notice's slip, or on the notice at your door when that is up. With
  no save, a new run on the link's seed. `&new=1` starts a new run on the link's seed and replaces the save (and is
  taken off the link at once, so a reload picks that run up).
- **Seen.** A small mark on the top line: "saved · day 3 14:00" (the game's time of the save), or "not saving" when the
  browser refuses its storage (the game plays on). Every read and write of the storage is in try/catch.
- **Refused.** A save the rules refuse (`version`, `broken`) is said plainly in the notice's slip ("Your saved run is
  from an older build and cannot be continued. A new run has started."), kept under `hk2.run.save.refused`, not deleted,
  and a new run starts on the link's seed.
- **NEW RUN** asks twice; the second ask is a slip under the button saying what it ends ("This ends your run: day 3,
  $240 banked."). It replaces the save (`&new=1`) and forgets the crib's arrangement of the run it ends and of the new
  seed.
- **Tools.** A page run by a tool (`runtest=`) never reads or writes the slot unless it asks (`&save=1`). The proof:
  `node demo/tools/run-stage.mjs --policy <p> --seed <n> --days 4 --reload-at <step|notice|warning|door|guard>
  --compare <an unbroken run's --json>` plays with the save on, reloads the page once at the cut, lets it pick up and
  plays on; the state at the step that ended the last day must be the unbroken run's (`--arranged`: a thing put away
  just before the reload, the link naming another seed, and the arrangement must come back). The node tests:
  `test/run-page-save.test.mjs`.

## Adding a place

A place is one entry under `places` in `src/run/config.mjs`; no rule names a place (`test/run-places.test.mjs` adds the
docks this way, plays a three-place city on them and checks that `rules.mjs`, `step.mjs`, `view.mjs`, `state.mjs` and
`ledger.mjs` name no place). Write:

1. `label`, `where` ("on the docks": how sentences say you are there), `block` and `spot` (a block of `src/map.mjs`,
   for the stage).
2. `tier`: `quiet`, `rough` or `mean` (or a new row in `tiers`). The tier sets the level of everything: pay (× 1, 2,
   3: jobs, robbing, the bins), jumping (× 0, 1, 1.5 on the chances, +0/+0/+10 strength), whether the police patrol it
   or come only when it is hot, how much a robbery heats it, how fast it cools, and the chance of being robbed asleep.
3. `jobs`: one `safe: true` (always dealt, goes round its people) and the rest; each with `label`, `named` ("{who}"),
   `role`, `with`, `odds`, `base` pay (before the tier), `winHeat`/`failHeat`/`failEnergy`, `needs` (an item), `mood`
   and `trust` on win and fail (how it moves its person's trust: "Trust"), and `scene` (how it plays: a kind or an action
   the stage has).
4. `people`: { id, name, role } for every role a job needs, and `regular: true` for an easy sale who keeps count.
5. `supply`: any of `strangers` (robbing somebody passing is there), `bins` (the bins are there), `custom` (a regular's),
   each { max, refill }. `binsSeen` if someone there minds you in the bins.
6. `shop`: [] or errands { item, label, kind: 'food', price, does, perDay, gives, keeper (a person's id), spot }.
   Since goods-1 also: `connect: { who, spot }` (a person of the place with `role: 'connect'`), an entry under the
   top-level `goods` with `at` this place, a selling job's `goods: { good: base pay }`, and any `things` with `at` this
   place ("Goods, the connect and errands").
7. `links`: { otherPlace: { via: 'subway' } } (a link may give its own `fare`, `hours`, `energy`), and the same link
   back in the other place's entry. `door: 'crib'` only for the place your crib opens onto (then you go inside there
   and do not sleep rough); `onlySafe` for the worked-dry line; `locked: 'why'` to show it shut.
8. Add it to `subwayStops` if the map should show it on the line.
9. Since routes-1, a way on foot to it, if there is one: an entry under `routes` ({ label, between: [one, other],
   stops: [...] }, both directions) and each stop under `stops` (`label`, `where`, `block` and `spot` on ground that
   lies between the two, `tier`, `hand`, `supply`, `cards`: "Routes"). A route to a locked place is shown, locked.
10. Since home-1, each job's `pressure` ({ win, fail }: how it moves the pressure at home, counted only when this is
   the street your crib opens onto: "Home pressure"). For the place your crib opens onto (`door`), its people are the
   ones who case your crib, and the guard (`guard.who`) is one of them.

Nothing else: the deal, the people, the danger, heat, police, the street moves, sleeping rough, the dry line and the way
on, the routes and their stops, the view and the terminal all read the entry.

## What it reuses

- The roll formula and its four bands (`src/contest.mjs`: `bandOf`, `chances`, `rollChance` and its clamp), the
  seeded dice (`src/rng.mjs`), the ledger's rule that every dollar is accounted for (`src/ledger.mjs` is built round
  the ten seats, so `src/run/ledger.mjs` is its small equivalent: earned, jumped, seized, fares, spent).
- The map's blocks: `projects` (the trailer park, with the pads), `market`, and `corner` (already marked as rival turf).
- The stage's existing scenes, so the animations carry over:

| In the run | Plays as |
|---|---|
| An odd job | `carry` |
| Loose cigarettes, selling to the crowd | the street sale (`work:deal`) |
| Lifting a wallet | `pickpocket_dip` once the city is re-pinned; `hand_off` until then |
| Collecting a debt | the collect and fight scenes |
| A stall shift | `haggle` at the shop counter |
| Grabbing a till | `till_grab` once re-pinned; `grab` at the counter until then |
| A stick-up | the robbery scenes (`rob:*`) |
| Jumped | the NPC robbers' scenes (`npc:robbers:*`) |
| Stopped by the police | the arrest, then the jail in orange |
| A bad one | the clinic |
| Banking | `stash` at the pad |
| Sleeping | `night:sleep` |
| The subway, the turnstile | the rides; `turnstile_hop` once re-pinned |
| Walking a route, the skateboard (routes-1) | the rides' `foot` and `skate` (`demo/stage/rides`) |
| The stop's cards: the barkeeper's crates, the lookout, the stranger to the stairs, the sale, the dumpster | `carry` at DEAD AIR's `counter:shop`; `lookout` (`flee` if it goes wrong); `walk` (`shove`); `work:deal`; `rummage` |
| Home pressure (home-1): seen casing your crib; the notice; met at the door; settled while you are out; Earl on your step | `watch`; `phone`; the fight scenes (`fight:*`); the break-in scenes (`breakin:clean`, `breakin:fail`); `guard` |

The old rules (`src/*.mjs`, the ten seats and their classes) are untouched and still run.

## Names

Nothing here is named after Rust's items. "Mattress" stands in for "sleeping bag", which is one of Rust's own item
names; slime's call whether that matters for an everyday word. The people have everyday names, none from Rust. The
things that defend your home (home-1) are a deadbolt, a floor safe and a neighbour on your step: hardware-store words,
not a game's ("code lock", "tool cupboard", "turret" are not used).

## Parked

Co-op. Raiding other players' cribs. Skills that rise by use (three at most). A talk verb beyond "ask for work",
"haggle" and "talk your way out". Rent. Hired crew (three at most; the guard of home-1 is one hire, no more). Moving to a
bigger home, which pushes you deeper into the city (slime's "run out of space": it needs a second home on the map). The agent
running trips by your rule. The corner and the Sixes. A week-long season and what survives a wipe.
