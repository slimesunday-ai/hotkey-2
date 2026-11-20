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
energy a day bought this way: since batch-1 a real rule, one count for the day across every food and drink of every
place (`food.perDay` in `src/run/config.mjs`, below). **Things**, cosmetic only (no number changes), owned for the run like the bed, bought on
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

**Food: one cap a day (batch-1).** Until batch-1 the "at most 2" held only because there were two food spots: each
food's own `perDay` was its only limit. Now `food: { perDay: 2 }` counts every food and drink bought anywhere that day
(a shop entry of `kind: 'food'` that gives energy), and at the cap every food's option says "you have eaten all you
can today" and is not open; the place card, the shop panel and the bar's tile say how many of the day's 2 are eaten. It
resets each morning. Measured (500 seeds, a park player that eats when spent, the run66 harness), three foods in the
park, uncapped: $73.3 a day against the market's $72.5 (the park as good as the market: what the cap is for); capped at
2: $68.4 (the market +6%); capped at 1: $62.5, as with one food (+16%). With bed: $112.5, $107.1, $101.2 against the
market's $103.5. 2 is RUN.md's own number and changes nothing today (the park and the market have one food each); a
city with more food spots and an eating park player would still put the market only 6% ahead of the park at 2
(mark 2 wants 15%), so 1 is the number if that matters: the owner's call.

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

## Fights (duel-1)

Added 2026-11-17, the owner's direction: when you cross somebody to their face and it goes wrong, they fight you there
and then. You do not steer: the fight drives itself and is decided by what you own and how much energy you have. You
see it, yourself getting beaten included; it is short and skippable. "What you own is actually helping you." The
decisions below were the owner's; the numbers are tuned with the table (below). Everything new is one block of
`src/run/config.mjs`, `duel`.

**When.** A job whose entry says `fight: 'fail'` is a fight when it goes wrong: the trailer park's debt (`collect`) and
its wallet (`wallet`, you were caught). And the regular at your door who swings when you refuse them (`duel.door`; the
60% that they swing is still the dice). The market's jobs, getting jumped and the attempt on your crib are the
contest's dice as before. More jobs are switched on by their flag alone (a test switches the market's wallet on that
way). Getting jumped (two of them) and the attempt on your crib are not built as fights; the door's mapping
(`rules.mjs duelBand`, below) is the shape they would take, a few lines each where they roll now.

**The fight decides it.** One run of the fight's own simulation (`src/fight/`: `createFight` with `duel`, one of them,
no waves, nothing dropped, nobody leaves), its seed drawn from the run's dice (`rng(seed, 'run-duel', day, hour,
place, job)`; the door's from the day, the regular and how the door was shut), IS the outcome: no other roll. Both
sides move by the brawl (`src/fight/brawl.mjs`): whoever has the next blow ready steps in to throw it; whoever is waiting
on theirs gives ground to just outside the other's reach and circles; so they come together, trade, part and circle.
In a one-on-one 45% of the blows thrown land (two thirds of that on one backing off fast). It lasts at most 20 s of
fight time; at the cap the one with more health left wins (a tie is theirs) and the other goes down. The same inputs
and the same seed are the same fight, headless (`runDuel`), stepped a tick at a time as the page steps it
(`startDuel` and `step(F, brawl(F))`), skipped (the rules' result stands) and with no acting out (`&scenes=0`); the
event carries the fight's inputs and seed (`duel`), so the page plays exactly that one.

**What each brings** (`rules.mjs duelOf`, every number in `duel`).

| | You | Them |
|---|---|---|
| Weapon | the box cutter if you own it (the fight's `blade`, its blows × 1.45), else bare hands (× 1.8) | fists (× 2.0) |
| Health | your energy before the hour, on a slope with a floor, measured against the bed's 10: a full bar (100) at 10, half (50) at 0, 5 a point; fresh on the mattress (6) 80, tired (2) 60 | their toughness: the role's base, give or take 5, seeded by the person's id (the same neighbour is always as tough): a debtor 64, a mark 52, a buyer 48, else the ordinary 55 |

The trailer park's: Benny Two-Coats 64 ("tough"), the man at the bus stop 56, the woman at the bus stop 55, Shaky Dee 43
("slight").

**What it costs and changes.** A fight costs energy: 1 won, 2 lost. It replaces a job's `failEnergy` (never both: the
debt's 2 is the fight's now) and is never the clinic. The "tired" rule for a job's odds is untouched.
- A job fight **lost** is today's failure as it was: no pay, the failure's heat, trust, pressure and mood, and the
  fight's 2 energy.
- A job fight **won** pays as a win (the same pay roll the win would have had), but their trust, the place's heat and
  the pressure at home move as for a failure, and the mood is the failure's: it was a fight in the street.
- The door: **lost** is their win as the contest had it: their clean win (energy −4) while they have more than half
  their health left, else the scuffle (−2); **won** is their losing (nothing). Sour and out either way, as before.
  `duel.doorClean` is that half.

**No hidden roll.** Each card says what going wrong means, from a sample of the very same fight at the same inputs
(`duelChance`: 200 fights of seeds of their own, cached by the inputs): the view's option carries `fight` (`pct`,
`in10`, `n`, what each side brings and why, the costs, `text`: "a fight: you win about 4 in 10") and so does each of its
targets (each person their own); its `ifFail` says it in words ("heat +1, a fight: you win about 5 in 10 (won: paid,
energy −1; lost: energy −2)"), and `failEnergy` is the fight's 2. Shutting the door says its swing as a fight
("Shut, 60% they swing: a fight: you win about 6 in 10."). Over 300 of the run's own fights the share won is within 10
points of the card's (a test).

**The table** (`node scripts/duel-table.mjs [--fights 2000] [--out dir] [--with json]`, free, 2,000 fights a cell, about
40 s): every park person who can fight you and an ordinary one, bare hands and the box cutter, at every energy.

```
who                       tough  kit           1   2   3   4   5   6   7   8   9  10
an ordinary one              55  bare hands   27  33  40  42  47  50  56  61  65  69
an ordinary one              55  box cutter   43  50  57  59  64  65  71  74  76  79
Shaky Dee                    43  bare hands   41  49  56  59  62  65  72  75  78  81
Shaky Dee                    43  box cutter   53  59  65  69  73  73  79  82  83  86
a man at the bus stop        56  bare hands   26  32  39  41  46  49  55  60  64  68
a man at the bus stop        56  box cutter   42  48  55  57  63  64  70  72  75  78
a woman at the bus stop      55  bare hands   27  33  40  42  47  50  56  61  65  69
a woman at the bus stop      55  box cutter   43  50  57  59  64  65  71  74  76  79
Benny Two-Coats              64  bare hands   19  24  31  32  36  40  45  49  54  58
Benny Two-Coats              64  box cutter   35  41  48  50  55  58  65  67  70  73
```

The targets, all passing: bare hands fresh on the mattress against an ordinary one 50.1% (40 to 55); the box cutter
65.3% (65 to 80, at its edge); energy 2 or less at least 15 points under fresh, the same kit (bare hands 33.0% against
50.1%, the box cutter 49.5% against 65.3%); the toughest of the park (Benny, 64) against the weakest (Dee, 43) at least
15 points apart fresh (bare hands 39.6% against 65.3%, the box cutter 57.8% against 73.5%); no kit and energy in the
park under 10% or over 90% (18.6% to 86.1%); the cells' median lengths 5.1 to 11.3 s of fight time (5 to 12), none over 20 s
(382 of 200,000 fights went to the cap). The tuning, in order: with the stop's own numbers and the brawl, health
decided it almost without fail (with the blows scaled up, bare hands against one man of 48: 23% at energy 1, 91% at
10; unscaled, the box cutter won 86% fresh against a man of 70, and bare hands 27%), so in a one-on-one a blow lands 45% of the time and each side's blows are scaled (yours
× 1.8 bare-handed and × 1.45 with the cutter, theirs × 2.0); then the toughness spread by role so that the toughest and the weakest are 15 points apart
with the cutter too, without the weakest at full health with the cutter going over 90.

**On the page** (`demo/run/duel.js`). At the spot the job's scene already uses, between the two already in frame: the
job's scene plays to the first move of it (a debt: he will not pay and shoves you off; a lift: the mark turns on you
and shoves you; the door: shut, and he shoves you), then both square up on the nearest open ground round them (a walk
of a few steps, nobody put anywhere: the brawl keeps both within 2.9 m of the middle, so the page looks for the nearest disc
of 3 m that is nine tenths open ground: level, nothing low, nothing solid, open sky over it, a stall's canopy hiding
whoever falls under it), and the fight is the rules' own, stepped a tick at a time on the stage's
clock: the stage's people moved by hand (`rides/kit.js own`), in the fight's own clips and effects (`demo/fight/anim.js`:
each blow's wind-up started before it lands, the flinch, the fall; its numbers off each hit, `fx.js`; the stage's blood,
`gore.js blow`). Both fall on their back (nobody is killed here: `anim.js` takes `falls`). Two bars with names over the
picture's top, in the run's tokens (`ui.css` `.rn-duel`): yours yellow, theirs pink, each with why it starts where it
does ("bare hands · energy 6: you start at 80%", "fists · tough"), and a Skip button. The end: the loser goes down
and we stay on it; the winner comes and stands over them; you beaten, they walk off and you get up; you the winner,
they get up and back off. Then the result card and the row with what it cost ("A fight: you won", +$16, −2 energy,
home risk +2, Benny against you; "won the fight" / "lost the fight" first of its chips). Space, Enter or a click on
Skip: under the stage's black, both stood where they are, the rest of the hour settled, the same result. No camera
or zoom is added or changed: it follows you as on any hour. The fight page (`?mode=fight`) and the try-out are as they
were (the fight's sim, anim and policies changed only by additions none of them use).
The frame check of the fight page (`demo/fight/watch.js`, `frame.js`) watches every picture while a fight is on; the
page keeps each fight's record for the tools (`hud.duel`: the rules' result, the one seen, skipped or not, the stage
seconds, the frame check's faults; a fight seen to end otherwise is said as an error).
`HK2_DEBUG_PORT=<port> node demo/tools/run-duel.mjs --port <p> --out <dir>` finds a won debt, a lost one and the door
headless, plays each in the page with real keys and pictures, skips the door with a real mouse press on Skip and the
debts with Space and Enter, plays one with no acting out, and ends `duel-ok` or `duel-fail`.

**Saves.** The state's shape is unchanged (state version 8): the fight rides on its event, not in the state, so a save
from before loads and its fights are the same before and after the save (a test).

### What the fights moved in the marks

Measured 2026-11-17. The full run before the fights (`node scripts/run-marks.mjs`, 3,000 seeds, at f5dc489) took 5,357 s
of one core, about 89 minutes (not the five minutes of the first test's twelve marks: the home marks' ten-day seasons are
most of it), and passed 26 of 28 (12 and 15 failing, as before). The full run after was stopped at 75 minutes; the two
were then run side by side at `--seeds 500`, the same seeds: before 909 s, after 944 s (+4%); 25 of 28 pass in both,
the same three failing (12, 13 and 15; 13 passes at 3,000 seeds before, fails at 500 by a hair either way: with the
bed the good neighbour and the burner 11% apart before, 10% after; with all three 10% and 9%). Every mark that passed
before passes after. What moved, before then after (500 seeds): mark 2 the market against the park +40% and +64% →
+42% and +66% (the park's best $55 either way on the mattress; with the cutter the park player banks $58 → $62: the
box cutter wins its fights); mark 9 the park with bins $35 → $41 against $55; mark 11 worst tenth of days leaning on Dee
−$36.4 → −$38.6, not leaning $6.3 → −$3.2 (still worse leaning; the regular at the door is a fight now, and Dee is slight);
mark 12 +10% and +9% → +11% and +10% (still failing); H2 the park's crime player loses 9.5% → 12.4% of what it earns
to attempts (8 to 25%); H5 the trailer park's player banking $51.9 against $33.9 carrying all → $50.3 against $41.2;
the rest within a dollar or exactly as before. No number older than the fights was changed.

**What a fight costs a season, headless.** One fight is about 0.15 ms of the simulator. The park's crime player fights
0.9 times a day (wins 39% bare-handed, 58% with the cutter); a six-day season of it is 7.8 ms before and 10.6 ms after
(about 5.5 fights, and the cards' sample of 200 fights the first time each case is seen in a process: 17.5 simulator
runs a season over 400 seasons, falling as the sample is kept); a season of the players who mostly work the market
6.7 to 7.5 ms before and 6.7 to 7.8 after. The card's estimate is kept per config and case (the cutter, the energy, the
person), so a view drawn every hour asks it once per case.

### Every weapon its job (fight-3)

Added 2026-11-18, the owner's direction: "more strategy play vs grinding". Every weapon has its own job, none is a
step up from another; the study that tuned the numbers was measured on a throwaway copy (run70, 600 seeds a cell) and
is landed here as it was. All of it is the fight's simulation (`src/fight/data.mjs`, the rules in `sim.mjs`), its
table and the try-out page. **The run reads none of it yet.** Its one-on-ones are as they were: `node
scripts/duel-table.mjs` prints the same table before and after, and every fight that existed before (every stop level
and preset, Earl's old way, the run's one-on-ones with bare hands and the box cutter) is the same fight, tick for tick,
for the same seed. The one thing changed on purpose is "built" (below).

**The guns' jobs** (`WEAPONS`; the build list says each in these words, `demo/fight/dock.js JOBS`):

| Gun | Its job | Numbers |
|---|---|---|
| six-shot (`pistol`) | for anything | as before |
| chopper (`chopper`) | strong, and hungry for rounds | as before |
| **Doorman** (`doorman`), a short double barrel | several at once, up close | a shell takes every one of them inside 22° either side of the one it is aimed at, out to 7 m, each hit rolled on its own; full damage (24 to 32) to 2.5 m, then less in a straight line to a fifth at 7 m, and it throws them back a metre up close, less as far as the damage is less; 2 shells, reload 1.8 s, 20 shells carried |
| **Long-eye** (`longeye`), a scoped rifle | one hard shot, from far off | 36 to 46 a shot, 0.75 a second, out to 20 m, 5 in it, reload 2.6 s, 15 rounds; with one of them within 1.6 m of you its hit chance is 0.55 of what it would be |

Backing away while firing (`policies.mjs kite`) keeps the ones who hit at a gun's own distance where it has one
(`stand`: the Doorman close, 2.6 m, and walks to the nearest when none is in its 7 m; the Long-eye far, 6 m). A dropped
pack of rounds gives a long gun half of it (`pick`: its own shells or cartridges). The tire iron is Cousin Earl's
alone: not on the build list.

**Punch styles** (`PUNCHES`: bare hands, each bought once and chosen before a fight; data only, the page does not
offer them yet):
- **quick hands** (`jab`): 5 to 8, 2.2 a second, light. Keeps a flinchy man staggered (its cycle stays over a heavy's
  stagger, so it never locks one).
- **the haymaker** (`haymaker`): 18 to 24, 0.6 a second, lands 0.85 as often (seen coming), throws them back a metre.
- **the throw** (`throw`): 7 to 10, and a throw that lands puts them down 1.6 s (no blows, no steps), 0.8 s more
  before they can be thrown again; you stay on your feet; the ground does the damage, so no soak takes any off.

**Opponent styles** (`RIVALS`, for one-on-ones; `rivalFoe(style, { hp })` gives a duel's `foe`). Fields new to a foe:
`reel` (how long a blow of yours staggers them), `heft` (the share of its throw back they take), `soak` (points off
every blow of yours, never under 1), `slip` (the share of a hold they take).

| Style | The card's words | Weapon | Hits ×, speed | reel | heft | soak | slip | Health as most |
|---|---|---|---|---|---|---|---|---|
| `brawler` | a plain brawler | fists | 2.0, 3.2 | 0.35 | 1 | 0 | 1 | 55 |
| `bigman` | big, slow, hits like a truck | big fists (`mauler`) 14 to 20 | 2.0, 2.6 | 0.12 | 0.35 | 7 | 1 | 70 |
| `quick` | quick and slippery | quick fists (`quickfists`) 5 to 8, 2 a second | 2.0, 4.0 | 0.45 | 1.2 | 0 | 0.3 | 45 |
| `knife` | carries a blade | box cutter | 1.6, 3.4 | 0.35 | 1 | 0 | 1 | 50 |
| `grabber` | grabs and won't let go | grabbing hands (`grab`) 8 to 11: it holds you 1 s, you cannot hit back and neither of you moves | 2.0, 3.0 | 0.30 | 0.8 | 5 | 1 | 60 |

The plain brawler is the run's opponent as he is now (the same fight, tick for tick, a test). The study's matchups,
fresh at 80 health against each style at its usual health (win %, 600 seeds): quick hands are the answer to the quick
one (94), the haymaker to the grabber (69), the throw to the big man (47), the box cutter to the knife (78), brass
knuckles to the plain brawler (75); each is worst against another style. **Who has which: nobody yet.** The
coordinator's call, with the owner: in the run the trailer park's people stay plain brawlers and the quick one; the
demanding styles are for people deeper in the city. So no person of `src/run/` has a style in this build (since styles-1 everybody does: "Fights in the run: styles and getting jumped").

**No gun in a one-on-one.** `createFight({ duel })` refuses a gun on either side ("no gun in a one-on-one"): a
one-on-one is a street fight, hands, a blade, knuckles.

**Cousin Earl's ways** (`EARL_WAYS`, a build's `earl`; the three the player is offered are `WAYS_OFFERED`):

| Way | Said | What he does |
|---|---|---|
| `side` (left out: his old way, the loadouts') | fights whoever comes at you | the nearest of them near you, else at your shoulder |
| `front` | Out in front: stands in front, takes the hits | a step (1.2 m) in front of you toward the nearest one who walks up to hit; fights what reaches him or you |
| `hunt` | Goes hunting: goes after the shooters | the ones who shoot, wherever they are; then the one furthest from you |
| `block` | One at a time: keeps the second one off you | with two or more who hit on their way to you, he stands 1.5 m out between you and the second nearest and fights him there |

When each is the call (the study): out in front when you fight with your hands and they walk up and hit; hunting when
someone shoots from the back and you cannot reach him (bare hands in the corner 22% against 1% at your side, the table
below); one at a time when you carry a gun and several come together, and it keeps Earl on his feet (the raid with the
six-shot: down in 16% of fights against 46% at your side).

**The small street fights** (`STREET`, levels of the stop's own simulation by name): `jumped`, two at once and one a
runner; `the corner`, two hang back and shoot and two come at you; `a raid`, four at once. And the Sixes at your door
(`sixes1`, `sixes4`, on `YARD`, 10 by 8 m): a first look, not tuned; a Six who gets past you to the door is not
counted yet.

**"Built"** (the gym's mark, `GEAR.strength`): +10 health and fists and blades × 1.1 (it was +30 and × 1.2, and the box
cutter built beat a plain six-shot).

**The table** (`node src/fight/table.mjs [--seeds 200] [--out dir]`, free): the five loadouts and the two long guns,
alone, on the stop's three levels and the three street fights, still and backing away; then Earl's ways against what you
carry. The new rows, 200 seeds (win %, still / kite):

```
loadout                 level     still  kite   secs  hp-left  dropped
Bare hands              jumped     62%  100%   13.4    80%     100%
Bare hands              corner      0%    0%   11.8     0%       3%
Bare hands              raid        0%   14%   15.2    13%      41%
Starter                 jumped    100%  100%    8.3    96%     100%
Starter                 corner      0%    0%   18.6     0%      46%
Starter                 raid        0%   51%   12.2    36%      71%
Handgun                 jumped    100%  100%    7.3    99%     100%
Handgun                 corner     63%   93%   14.9    52%      96%
Handgun                 raid       20%   78%   12.1    63%      87%
Handgun + vest          jumped    100%  100%    7.3    99%     100%
Handgun + vest          corner     85%   99%   15.1    63%      99%
Handgun + vest          raid       52%   86%   12.6    69%      92%
Chopper + vest + Earl   jumped    100%  100%    5.6   100%     100%
Chopper + vest + Earl   corner    100%  100%   11.8    85%     100%
Chopper + vest + Earl   raid      100%  100%    9.6    99%     100%
Doorman                 easy       99%  100%   20.7    89%     100%
Doorman                 real        0%   23%   33.0    21%      75%
Doorman                 hard        0%    0%   27.8     0%      57%
Doorman                 jumped    100%  100%    9.7    99%     100%
Doorman                 corner      0%   18%   21.2    27%      61%
Doorman                 raid       45%   86%   12.0    63%      92%
Long-eye                easy       97%  100%   16.9    98%     100%
Long-eye                real       33%   59%   29.6    59%      79%
Long-eye                hard        4%   13%   30.5    56%      60%
Long-eye                jumped     99%  100%    5.1    98%     100%
Long-eye                corner     74%   96%   13.3    73%      98%
Long-eye                raid       11%   57%   12.3    75%      70%
```

Cousin Earl's ways (win %, backing away; alone without him; * the best of his four within 2 points), and the share of
fights he goes down in:

```
              easy                          real                          hard                        
             alone  side front  hunt block alone  side front  hunt block alone  side front  hunt block
bare hands    100   100*  100*   99*  100*    0     0     0     0     0     0     0     0     0     0 
box cutter    100   100*  100*  100*  100*   18    37    52*   36    52*    0     0*    0*    0*    2*
six-shot      100   100*  100*  100*  100*   61    93    95    85    99*    2    19*   20*   11    17 
chopper       100   100*  100*  100*  100*   83    99*   96    98*   97*    2    19*   16    12    18*
Doorman       100   100*  100*  100*  100*   23    69    78    53    84*    0     1*    1*    1*    1*
Long-eye      100   100*  100*  100*  100*   59    91    95*   96*   97*   13    64*   59    51    61 

              jumped                        corner                        raid                        
             alone  side front  hunt block alone  side front  hunt block alone  side front  hunt block
bare hands    100   100*  100*  100*  100*    0     1     2    22*    0    14    59    71*    9    39 
box cutter    100   100*  100*  100*  100*    0    42    60    91*   69    51   100*  100*   97    99*
six-shot      100   100*  100*  100*  100*   93   100*  100*  100*  100*   78   100*  100*   99*  100*
chopper       100   100*  100*  100*  100*   97   100*  100*  100*  100*   93   100*  100*  100*  100*
Doorman       100   100*  100*  100*  100*   18    47    56    78*   69    86    99*  100*   98   100*
Long-eye      100   100*  100*  100*  100*   96   100*  100*  100*   99*   57    93*   89    94*   93*

Earl down (%): side front hunt block, at easy, real, hard, jumped, corner, raid
bare hands   100  84 100 100   100 100 100 100   100 100 100 100    45   4  40  14   100 100 100 100    98 100 100 100
box cutter   100  13 100 100   100 100 100 100   100 100 100 100    20   0  40  34    92  88 100  71    53 100 100 100
six-shot       0   0   0   0    91  48  96  64   100  97 100 100     0   0   0   0    48  18  72  34    46  22  91  16
chopper        0   0   0   0    61  38  82  52   100  97 100 100     0   0   0   0    34  13  55  23    27   7  77   4
Doorman       41   0  51  46   100  85 100 100   100 100 100 100     1   1   8   4   100  34  99 100    98  28 100   9
Long-eye       0   0   0   0    44  22  46  33    95  89 100  94     0   0   0   0    12   3  17   5    38  27  38  31
```

The stop's own fifteen rows (the five loadouts on its three levels) are what they were, figure for figure; the long guns'
jobs show in them: the Doorman takes a raid alone (86%) and loses the corner (18%), the Long-eye takes the corner (96%) and
is the best gun alone on the bad night (13%, the chopper 2%, the six-shot 2%).

**The try-out page** (`?mode=fight`, and the run's try-out stop). Build your own (B) lists each weapon with its job
and its numbers ("Doorman: several at once, up close · 24–32 a shell · 2 in it · reload 1.8 s · 20 shells"), in two
columns; with Cousin Earl brought, his three ways under him, one at most (none: at your side). The five loadouts stay
on 1 to 5. How hard has a fourth, small level first: Jumped. In a round: the Doorman's shell is a spread of short
tracers through its cone with a heavier flash and smoke, sparks on each one it hits and a skid of dust where it threw
them; the Long-eye's shot is one long hard line that hangs a moment, slow between shots; both are held in both hands
(`demo/fight/clips/long.js`: drawn new for the fight, nothing in the game held a long gun; the lab shows them,
`?mode=fightlab`); Earl told a way shows it: a dashed line in his colour to the one he goes for, a small diamond on the
spot he holds, and his way on a plate under him. The losing card's advice tries the other guns and Earl's other ways
too ("Consider the Doorman. They rushed you: two of them on you at once. A shell of the Doorman hits every one of them
in front of you up close"). `demo/tools/fight-run.mjs --guns` plays the long guns and Earl's ways and takes their
pictures; `demo/tools/fight-clicks.mjs` presses each new choice with a real mouse.

**What is wired and what is not.** Wired: the simulation, its tests (`test/fight-jobs.test.mjs`), the table, the
try-out page. Not wired (the run-side job that follows): choosing a punch style at home, an opponent's style on a card
and in `rules.mjs duelOf` (the foe's `reel`, `heft`, `soak`, `slip` from `rivalFoe`), giving Earl an order in the run
(the guard), any gun bought in the run reaching the try-out, the Sixes' home fight and its rules (breaking in, what Earl
hurt costs), and the brass knuckles' one-on-one scale the study assumed (× 1.6, a run number).

## Low Tide Docks (batch-1)

Added 2026-11-17, the owner's first batch of places: a place must differ from the others in its danger, in what only
it offers and in who is there. The market is where you get jumped; **the docks are tougher people and honest money**;
no drugs ("I don't want drugs to be the only path to earn money": no connect, no good, no selling job here). Its whole
entry is `places.docks` in `src/run/config.mjs`; no rule changed for it.

**One ride from home, and only from there.** `links: { park }`, and the park's `links.docks` back (LOW TIDE station on
the stage, places.json `docks.ways.subway`). Measured in the review (run66): the same docks reached through the market,
two rides, banked $40.9 a day against $65.4 one ride away; on 6 energy a second ride eats the day. The park's ride to
the docks is `late` (listed after every older move), so no older move's key changed.

| Job | Odds | Pay | If it fails |
|---|---|---|---|
| Haul a shift for the foreman (the safe one; Mr. Haines, Rosa) | sure | $30–39 (base $10–13 × 3) | |
| Lift a box off a driver's semi (Big Lou, a big man; Nadia Petrakis, a plain brawler) | 60% | $84–141 (base $28–47 × 3) | trust −2, **a fight with the driver**: won, paid and heat +1; lost, heat +2 |

The `mean` tier: pay × 3, the jumpers 1.5 × as often and 10 stronger, patrolled (police × 1.25), a night rough 80%
robbed. Strangers 2 (1 back a morning), bins 2 (1 back). Two foremen, two drivers: at most two lifts a day.

**Its own character, the two calls asked for.** (1) A failed lift, done at the driver's own cab, **is a fight**
(`fight: 'fail'`, duel-1's): the driver turns on you. Drivers are tougher than the trailer park's people: `duel.foe.base.
driver` 62 (66 for part of a day in bigman-1, below; an ordinary one is 55, Benny Two-Coats 64): bare-handed, an hour
in (energy 5), you beat Nadia Petrakis about 4 in 10 and Big Lou under 1 in 10; with the throw about 6 and 5 in 10. A won fight pays the box and heats the
docks +1 (the lift's own `wonHeat`); a lost one heats them +2 and costs 2 energy (the fight's cost, as anywhere). (2) **Crossing a driver does not lose you
the foreman's shift.** Trust is one number per person and stays so: the driver you crossed is against you (off your
table, and about on 60% of hours to call in whatever you do on the docks next: heat +2 there), but the foremen's shift
is the honest money the place is for, and taking it away would be a new rule (one person's grudge moving another's);
nothing exists that does it, so it was not built.

**Measured** (500 seeded six-day seasons, the market's homeAt player at each place, `policies.mjs` `docks`): the fight
on a failed lift is worth money to the player who can win it, so it was tuned with the drivers' toughness and the pay:

| | mattress | box cutter | bed |
|---|---|---|---|
| The starting numbers (shift $30–42, lift $90–150, fight with an ordinary 55), home at $120 | −10.7% | −4.0% | −4.9% |
| The same, no fight | −16.4% | −11.5% | −17.2% |
| As first built (shift $30–39, lift $96–162, drivers 62), home at $120, 500 seasons | $67.5 against $76.6, −11.9% | $83.4 against $90.0, −7.4% | $105.8 against $112.8, −6.2% |
| The same at 3,000 seasons (the full marks run, with the fight build joined) | −14.9% | −9.0% | −9.9% |
| Shift $30–42 (2026-11-18, before the fights of styles-1), lift $96–162, drivers 62, home at $120, 3,000 seasons | $66 against $76, −13.4% | $82 against $89, −7.9% | $104 against $113, −7.3% |
| The same at 500 seasons | −10.3% | −5.9% | −3.8% |
| Shift $30–42 with the fights of styles-1 joined (the drivers a knife and a quick one), 3,000 seasons | −9.0% | −4.7% | −4.2% |
| The same at 500 seasons (under the 3% floor on the bed) | −10.4% | −4.0% | −2.6% |
| Shift $30–39 again, lift $96–162, the fights joined (Big Lou a quick one), home at $120, 3,000 seasons | **$67 against $74, −10.3%** | **$84 against $89, −6.1%** | **$105 against $113, −6.8%** |
| The same at 500 seasons | −11.8% | −5.3% | −5.1% |
| **Big Lou a big man** (bigman-1), the same numbers, the docks player lifting blind (as before) | −18.8% | −11.0% | −12.7% |
| Big Lou a big man (bigman-1), the careful player passes a fight it mostly loses (`FIGHT_MIN` 30), 3,000 seasons | **$66 against $74, −11.8%** | **$82 against $89, −8.2%** | **$101 against $113, −10.2%** |
| The same at 500 seasons | −12.1% | −7.2% | −10.6% |
| A fight won heats +1 (bigman-1, second part), the numbers as they were, 500 seasons | −10.4% | −2.9% | −7.8% |
| Bigman-1, second part: odds 75, $78–126, drivers 66, 3,000 seasons (kept for part of a day) | $66 against $74, −11.8% | $81 against $89, −8.6% | $106 against $113, −6.4% |
| The same at 500 seasons | −12.3% | −6.1% | −5.6% |
| Re-measured (2026-11-18, later): the lift back to 50%, $93–156 (base $31–52), drivers 62, 500 seasons; **not kept** (P5 misses) | −12.6% | −5.6% | −9.2% |
| The same at 3,000 seasons | −12.2% | −6.2% | −8.6% |
| **As it stands** (bigman-1, third part): the lift at 60%, $84–141 (base $28–47), drivers 62, 3,000 seasons | **$65 against $74, −12.4%** | **$82 against $89, −7.3%** | **$103 against $113, −8.4%** |
| The same at 500 seasons | −12.3% | −6.1% | −8.8% |
| As built, home at $90 | −11.2% | −7.4% | −6.6% |
| Days banking nothing, home at $120: docks against market | 29% against 23% | 22% against 17% | 38% against 32% |
| The shift alone (honest work), home at $120 | $52.6 | $66.3 | $83.7 |

**The lift at 60%, for more fights (bigman-1, third part, 2026-11-18; the coordinator's decision).** Odds 60, $84–141
(base 28–47), drivers 62 again; a fight won +1, lost +2; the shift ($30–39) and the throw ($80) unchanged. Why: the
docks are where what you bring to a fight decides your money (the throw taught there, Big Lou its big man, a fight won
only +1), and at 75% a lift became a fight 1 time in 4; now 2 in 5. Ten days, 500 seasons, a day: the plain mattress
player lifts 0.61 times and fights 0.24 times; the one who knows the throw lifts 0.85 times (Big Lou 0.24) and fights
0.33 times (it was 0.24 at 75%). Traded for it: the throw's income reading, +8.9% over ten days at 75% (3,000 seasons)
down to about +6%, so P5's bars are 4% and day 7 (two points and two days inside the 3,000-season reading). The card
shows the throw where the income mark does not: Big Lou from under 1 in 10 bare-handed to about 5 in 10.

**Re-measured with the lift at 1 in 2 (2026-11-18, later; the coordinator's ask: the lift at 75% makes the fight rare).
Not kept (the lift stayed at 75%, then went to 60%: above).** With the lift back at 50% and a fight won heating +1, the balance taken out of the
pay (and the drivers' toughness, the shift, tried), P1 holds but P5 does not, with the throw at $80. 500 seasons
(mattress / cutter / bed % under the market; P5 the mattress over ten days, lesson counted): drivers 62, base 31–52:
12.6 / 5.6 / 9.2, P5 +5.6% back on day 5 (3,000: 12.2 / 6.2 / 8.6, **P5 +4.7%**, day 6); drivers 60, base 30–50: 13.4 /
7.9 / 10.2, +6.7% (3,000: 13.5 / 7.9 / 9.4, **+5.0%**, day 6); drivers 62, base 30–51: 13.9 / 7.0 / 10.2, +6.8% (3,000:
13.7 / 7.5 / 9.7, **+4.9%**). 24 settings at 500 in all: base 28 to 38 low, drivers 60 to 70, the shift $21–30 to
$33–42; P5 at $80 was 4.1% to 6.8% at 500 across all of them, and reads 1 to 2 points lower at 3,000. The tougher the
drivers or the dearer the lift, the less the throw adds; a lower shift with a dearer lift took the box cutter to the
market. Why the 75% lift is worth more to the throw (500 seasons, ten days, a day): at 75% the throw player lifts Big
Lou 0.40 times (a lift that works heats nothing, so it goes on to his truck) and its lifts pay $92 against the plain
player's $56; at 50% it lifts him 0.14 times, $73 against $50. A lift becomes a fight 0.37 times a day for the throw
player at 50%, 0.24 at 75% (the plain one 0.28 and 0.17). The nearest to both: **the lift at 60%, base 28–47 ($84–141),
drivers 62**: P1 12.3 / 6.1 / 8.8 at 500 and 12.4 / 7.3 / 8.4 at 3,000 (inside the margins), P5 +8.5% back on day 3 at
500 and **+5.9%**, day 5 at 3,000: 0.1 under the bar of 6%. A fight in 2 lifts of 5.

**A fight won after a lift costs heat +1, not +2 (bigman-1, second part, 2026-11-18; the owner's yes).** The first
part found that a docks day held one lift (any lift gone wrong, +2, put the careful player at its limit), so no way to
fight could be worth much there. Now the lift has its own `wonHeat: 1` (`config.mjs`; read by `step.mjs` where a job's
fight is fought: gone wrong and the fight won, the heat is the job's `wonHeat` if it has one, else its `failHeat`, so
any later job can say the same). Lost, +2 as before. The card says both ways (`view.mjs`, the option's `wonHeat` and its
`ifFail`): "a fight: you win about 4 in 10 (won: paid, heat +1, energy −1; lost: heat +2, energy −2)". **The page still
says only "heat +2"**: the pill's tag and the bar's row ("If it goes wrong (heat +2), a fight with …") are written from
`failHeat` in `demo/run/index.js` (`fightPill`, `fightHint`), which this job did not touch: to be read from the
option's `wonHeat` there.

The scripted docks players are unchanged: they weigh a lift by the worst heat it can leave (+2), so at heat 1 after a
fight won they do not lift again that day (1 + 2 is over their limit of 2); the heat on you drops 1 a night, so they
lift again the next morning, where a fight lost (+2) left them at 1 and kept them off it a day more. (Tried and dropped:
weighing the heat by the likelier way the card says the fight goes. It let the box cutter lift on most mornings and put
it 0.5% under the market.) So the lever pays whoever wins fights: the throw, and the box cutter against Nadia.

Measured, the docks' numbers as they were (500 seasons, % under the market, mattress / cutter / bed): 10.4 / 2.9 /
7.8, the cutter under the band's floor. Retuned, docks numbers only: the lift surer and cheaper, so less of a docks day
is the fight, and the drivers tougher: **odds 75, $78–126 (base $26–42), drivers 66** (were 50, $96–162, 62). 18
settings at 500 seasons with the players as they are (odds 50 to 75, lift base 26 to 29 low, drivers 62 to 68, once
the shift $27–36; and 22 more while the likelier-heat reading was tried), four confirmed at 3,000: the cutter reads 1.3 to 2.9 points further under the market at 3,000 than at 500, so 500 is the binding size.
Kept (500 / 3,000): 12.3 / 6.1 / 5.6 and 11.8 / 8.6 / 6.4 (the bed 0.6 inside the 5-point line at 500, the
thinnest). The others at 500: odds 70, base 27–44, drivers 66: 11.4 / 5.4 /
6.7; odds 65, base 28–46, drivers 68: 12.6 / 5.6 / 8.7; odds 65, base 28–46, drivers 66: 12.4 / 5.1 / 8.2.

**The throw is $80 again, and P5's bars are raised.** With the lever the throw is worth about $9 a docks day to the
mattress player once learned (the days after the lesson; the plain player banks about $65): at $80, ten days with the
lesson counted, +11.1% and back on day 3 at 500 seasons, +8.9% and day 4 at 3,000; at $70 +11.5% / +10.2%, day 3 /
3; at $50 +13.1% / +11.9%, day 1 / 2. The bed gains less (+3.4% at $80, 3,000, back on day 6). So the owner's first
idea holds at $80 (8% or more over ten days, back within 4 to 6 days), and P5's bars are 6% and day 6, two points and
two days inside the smaller reading.

**Big Lou is a big man, and the throw is what opens his truck (bigman-1, 2026-11-18).** Styles-1 gave every person a
style and taught the throw on this very pier, but nobody who fought you was a big man, and Big Lou had been made a quick
one only because the scripted docks player lifted off him blind (a big man put P1 at 19% under the market). Now he is
the big man (`style: 'bigman'`), Nadia Petrakis stays a plain brawler (a new player still has a truck to lift from),
and the scripted docks player plays it as the card lets anyone: the lift's card says who is driving, how they fight
(Big Lou: "big, slow, hits like a truck"; on the page "fails: a big man, ~1 in 10"), the odds with what you fight with
and with each other thing you own, and offers the other driver (the card's ↑ ↓: "Who: Big Lou · Nadia Petrakis", each
with her own fight). Nothing was missing from the view. `policies.mjs`:

- **The careful player passes a fight it mostly loses** (`FIGHT_MIN` 30): a job whose going wrong is a fight the card
  says it wins less than 30 in 100 with what it fights with is passed by; of the drivers the card offers it takes the one
  it beats most often; never a fight that, lost (the hour and energy −2), would leave no energy for the ride home (a
  night on the docks is 80% robbed; before this part the throw player lifted Big Lou at energy 2, and banked 1.5% less
  than the plain one over ten days, 1.8% more after it: the lesson at $80, 500 seasons); and it counts a fight it can win in what a job is worth (gone
  wrong and won, it still pays). Bare-handed at the docks (energy 5) the card says Big Lou about 6 in 100, Nadia about
  42: it lifts from Nadia, passes Big Lou. On the rule's first form (500 seasons, % under the market, mattress / cutter /
  bed): 20: 14.6 / 5.2 / 10.6; 30: 12.1 / 7.7 / 10.6; 40: the same as 30 (bare-handed the lift is taken fresh, where
  Nadia is 36 to 43 in 100).
- **The docks player who learns the throw** (`docksThrow`): the same, learns the throw from Mr. Haines once it carries
  the price and the fare home (day 1.6 on average), and before each fight it can see coming fights with what the card
  says wins most: with the throw Big Lou is about 5 in 10 and Nadia 6, so it lifts from both trucks.

No docks number moved: P1 holds with every kit two points or more inside the band at both sizes (table above).

**The throw is worth about $5 a docks day, so it costs $50, not $80** (the first part; superseded the same day by
the second part, above: $80 again). Measured (the mattress, home at $120, ten days,
the lesson counted against its day): at $80 the throw player banked +0.3% over the plain one at 3,000 seasons, the
lesson back only on day 10; the bed −0.8%, never back. Once learned it banks about $5 a day more (7.5% of the
mattress's day): a docks day holds one lift (any lift gone wrong heats the docks +2, the careful player's limit, and a
lift that works takes it home at $120), so a better fight wins about a third of a fight more a day; and the docks'
jumpers take as much as the lifts bring (0.28 bad jumps a day, $33 a day taken). Tried, 500 to 3,000 seasons: lift odds
25 to 40 with the pay raised to match (more of each lift is the fight: the throw's edge per lift grows, but the plain
mattress fell to 15 to 17% under the market, and the gain a day did not grow); the drivers at 66; the throw's scale 2.0
and 2.2 (worse: the scripted player then meets a jump with the throw, the wrong tool against two); lesson prices $40,
$45, $50, $60. At $50, 3,000 seasons: the mattress +3.1% over ten days, back on day 6 (500 seasons: +4.4%, day 5); the
bed +1.2%, day 8; the box cutter −2% (the cutter already beats Nadia and is better jumped). Mark P5 (below) is set on the
mattress from these. **The brief's 8% over ten days is out of reach** with the docks' own numbers: it would need about
$13 a day more, three of today's throw. Note: against Nadia the haymaker (Cousin Earl, $80, on the way through the
park) wins as often as the throw (68 against 64 fresh), and against Big Lou nearly (54 against 61): the line of advice
after a lift lost at Big Lou can name either.

**With the fights joined the shift is $30–39 again (2026-11-18, later the same day).** Styles-1 gave the drivers styles
(a knife and a quick one) and made getting jumped a fight; both moved the docks two to three points toward the market
for the cutter and the bed, and with the shift at $30–42 the bed read 4.2% under at 3,000 seasons and 2.6% at 500, under
the band's floor. The shift back at its first pay puts every kit at least two points inside the band at both sizes
(table above). The band stays 3 to 15%. The paragraph below is the day's first retune, before the fights, kept for the
measurements in it.

**Retuned at 3,000 seasons (2026-11-18), and P1's band widened to 3 to 15%.** The first full marks run on the joined places (3,000 seeded seasons, not 500) put the mattress player 14.9% under the market, outside the 5 to 12% P1 was built on: the 500 seasons it was tuned on read about three points kinder to the docks than 3,000 do (mattress 3.1, cutter 1.8, bed 3.3). Five settings were measured at 3,000 (the mattress, the cutter, the bed, each % under): **shift $30–42 alone 13.4 / 7.9 / 7.3, the one kept**; shift $33–42 alone 11.5 / 6.5 / 4.8; shift $30–42 with lift $99–168 11.8 / 6.4 / 5.7 (inside 5 to 12 at 3,000, but 8.7 / 4.4 / 2.7 at 500: out at the bottom); with lift $102–171 11.0 / 5.5 / 4.7; with lift $108–180 9.0 / 3.5 / 2.6. Neither number favours the mattress: the mattress and the bed stay about six points apart whatever is paid (the unarmed player loses more to the docks' jumpers and to the driver), and with three more points between 500 and 3,000 seasons no setting sits inside a band seven wide at both sizes. So the band is 3 to 15% (still less than the market for every kit, still more days banking nothing), and the setting kept has 1.6 to spare at the top at 3,000 and 0.8 at the bottom at 500. The figures further down this section (best against best, per energy) were measured on the first numbers and were not measured again.

The first target (5 to 12% less; now 3 to 15%, see above; the same player, each kit; more days banking nothing; honest work less than work and the
lift) holds at home at $90 and at $120. **Best against best** it holds for the mattress (docks $68.7 at $90 against the
market's $77.4, −11%) and the cutter ($83.4 against $90.9, −8%), **not for the bed**: the docks player with the bed is
best making short trips (home at $60), $119.8 against the market's best $119.9: as good, not better. Every lever tried
on that (a dearer shift, a dearer fare, tougher drivers) took the mattress under −12% first (the mattress has two
hours a trip; the bed's extra hours all go to the shift). Per energy: the shift pays about $34, the market's
stall $26; the box $64 less what the fights cost.

**On the page.** The ride is the stage's own subway (park's ELM ST to LOW TIDE, the city's harbor line); the Travel
list and the bar name it ("To the docks"); the Map shows LOW TIDE and the ride to it from the park's stairs. The people
stand where their work is (`scenes.js`: the foremen at the cargo ring's quay side, the drivers by their cabs on its
land side, each with a small day in the city's own clips: the tally on a phone, a box shifted, a smoke, a drowse by the
cab), in looks the stage has (the foremen in the dock vest and beanie, the drivers in a delivery top). The shift is
acted as the walk's crates are (`acted.js` `shift`: up to the foreman, a word, a box lifted, carried down to the pier, a
nod); the lift is the box lifted off the driver's cab and carried off (`semi`: he finds it gone and watches), or, gone
wrong, the driver turning on you and shoving you off (`semiFight`), then the fight itself (duel-1). Auto-play:
`--policy docks` (`demo/tools/run-stage.mjs`).

## Glasswall Plaza (batch-1)

Added with the docks. **The plaza is where the police are the danger**: 22 m from Precinct 9, few who would jump you,
and a patrol that walks the plaza all day. Its entry is `places.plaza` in `src/run/config.mjs` and one new row in
`tiers`, `watched`; no rule changed.

**The tier** `watched`: pay × 1.5, jumping × 0.25 (a quarter of the market's), nobody stronger, patrolled, a stop × 2
(at heat 3 a stop is 40% an hour, the market's 20%), cools 2 a night, a night rough 50% robbed. Strangers 2, bins 2.
One ride from the trailer park (1ST ST station on the stage), `late` like the docks' ride.

| Job | Odds | Pay | If it fails |
|---|---|---|---|
| Hand out flyers (the safe one, for Vic Amato, who sells condos off a folding table) | sure | $15–20 | |
| Lift a wallet off an office worker | 55% | $45–75 | heat +1 |
| Snatch a phone on the plaza (heat +1 when it works) | 45% | $60–90 | heat +2 |

The office crowd are unnamed, as the design sheet has them: a man in a lanyard, a woman on two phones, a man with a
coffee. **Nobody on the plaza fights you**: a job gone wrong here brings the police (heat), not fists; that is the
place's difference from the docks.

**Measured** (500 seeds, the mattress): the careful player (the market's homeAt player on the plaza: heat 2 at most,
home at heat 3) at its best (home at $300: so few jumpers that carrying costs little) banks **$72.5 against the market's
best $77.4, −6.3%** (target: within 10%, and under it); stopped 0.06 times a day. The heat-blind player (`plazaBlind`)
banks **$23.6, 32% of the careful one** (target: under half), stopped 0.67 times a day: ignoring heat is mark 4 made into
a place. The review's tuning stands: at pay × 2 the plaza beat the market by 20–37%; at × 1.5 with jumping × 0.5 it fell
to $59.7. With the cutter the plaza is $75.9 against the market's $90.9 (the cutter protects against jumpers, who hardly
matter here: the market keeps the cutter player); with the bed $113.9 against $119.9.

**Felt before it bites** (the review's 3.7: below heat 3 the police never stop you, so a careful player hardly meets
them). The heat meter is on the bar and the place card, as everywhere; the place says "Glasswall Plaza is quiet; the
police patrol it."; the bar's meter puts the police first wherever a stop is the likelier risk ("RISK 41% · police
could stop you"), with POLICE beside it whenever they are about. **What exists for showing police**: before this batch,
police were seen only in the arrest (Officer Hale, an extra who walks in for the hour of a stop), nowhere before it, at
the market or anywhere; the stage could already walk a patrol (a person whose routine is `patrol` on a stand with a
`beat`: `director.js` lifeStep, the city's `patrol_walk`), unused by the run. The plaza now has its own patrol:
**Officer Dana Pell**, a person of the stage only (`scenes.js` PATROL), walking the plaza's beat all day; a stop on the
plaza is hers (the arrest, as at the market, with her in it).

**On the page.** The ride is the stage's own (the city's tide and neon lines); the bar names it ("To the plaza"); the
Map shows 1ST ST and the ride. Vic Amato at his table by the north bench, the office crowd on the plaza's edges with
their phones and coffee (`scenes.js` DAYS); the flyers are handed to somebody passing (`acted.js` `flyers`), the wallet
lift is the market's (`lift`), the phone snatched out of a hand and run with (`phone`), or, gone wrong, held onto, a
shove, and the call to the police (`phoneFail`). Auto-play: `--policy plaza`, `--policy plazablind`.

## Two cards on the walk (batch-1)

Fit Street's stop deals two more cards, each at its real shopfront on the block's Fit Street side (the city's own
FRESH CUTZ walk-up with the barber pole and DROP with its sneaker wall: `city/from-trunk/style/city/heroes/
fitstreet.js`), with a person of the stage's own at its door (`scenes.js` STOP_FOLK: the barber, the clerk at DROP).

| Card | Odds | Pay | If it fails |
|---|---|---|---|
| Get a cut at FRESH CUTZ, a new face for the police | sure | nothing: **your own heat −1** | |
| Lift a pair off the sneaker wall at DROP | 50% | $40–60 (base $20–30 × 2) | heat +1 (it was +2 until 2026-11-18) |

**The barber** is a way to cool heat, so it is capped like one (the review's 3.5): an hour and an energy, once a day,
and (`minHeat: 1`) there only when you have heat of your own to cool. **It is a shop on the walk (`beside: true`,
2026-11-18):** no part of the hand's draw, it stands beside the hand whenever it can be used and never takes one of the
hand's three places from a card that pays (`rules.mjs` dealHand). On the page it is under Shop (B), "cut · heat −1",
not one of the three cards (1 2 3): `dock.js`.
Measured at 3,000 seasons with the fights of styles-1 in, the walker who plays the stops against the one who passes
them (home at $90): dealt into the hand **+4.7%** (under mark R2's bar of 5%, though 500 seasons had read +5.2%);
beside the hand **+5.9%**; and with the sneaker wall's miss at heat +1, as it stands, **+7.9%** (before styles-1: +4.5%,
+5.9%, +7.7%; the stop before either new card existed, +7.3%). It lowers your own heat
(and the street's, which is 0 almost always). Its line says "heat −1" (`step.mjs` used to write a card's heat as
"heat +-1"). Measured: with the barber dealt at any heat it took a place in the hand for nothing at heat 0 and the
walker who plays the stops fell from +7% to +4.7% over passing them (mark R2's bar is 5%); dealt only with heat, +5.2%.
No scripted player plays it (it pays nothing an energy), so the marks cannot see what it is worth; the review's stand-in
(own heat cooling 2 a night) moved no mark.

**The sneaker wall** pays $24.9 an energy over 3,000 plays (500: $23.3) against the market's stall $26.0: under the
ceiling of mark R2 (no card above the stall), as the review set it. Nobody of the game is robbed: no trust, nobody
tells; the heat +1 on you carries into tomorrow's market. (A miss was heat +2 as first built: the same average pay as
carrying the crates, on a coin's toss, with twice the lookout's heat on a miss, was a worse deal than the honest card
beside it, and cost the walker who plays the stops 1.9 points. At +1 it is a fair gamble.)

**On the page.** At the stop the hand shows them as any card (1 2 3). The barber's: up to him at his door, a word, paid,
he sweeps up after (there is no clip of a cut: no new animation is made), and a look about; the sneaker wall's: to
DROP's door, a pair off the wall and away up the street while the clerk is on her phone, or, gone wrong, the clerk
pointing and shouting and you running for it.

### Marks of the new places (batch-1)

The scripted players knew only the park and the market, so no mark could see a new place. Now `policies.mjs` takes
the market's homeAt player to any place one ride from the park (`where: 'docks'` or `'plaza'`: the same rules of play),
and has `docks`, `plaza` (careful: heat 2 at most, home at heat 3), `docksBlind`, `plazaBlind` (heat-blind) and
`docksHonest`, `plazaHonest` (the safe job only); since bigman-1 also `docksThrow`. Five marks (P5 since bigman-1), `measurePlaces` / `judgePlaces` in `marks.mjs`, printed
last by `node scripts/run-marks.mjs` (`--places` alone, about 90 s at 500 seeds):

- **P1. The docks are not a better market.** The same player (home at $120) banks 3% to 15% less a day on the docks (first 5% to 12%; widened 2026-11-18, see "Low Tide Docks"),
  each kit, and banks nothing on more days. 500 seeds: mattress $67 against $77 (11.9% less; nothing banked 29% of days
  against 23%), cutter $83 against $90 (7.4%; 22% against 17%), bed $106 against $113 (6.2%; 38% against 32%). Pass
  (the mattress near its edge).
- **P2. Honest money, less of it.** The shift alone banks less than the shift and the lift: $53 against $67, $66 against
  $83, $84 against $106. Pass.
- **P3. The plaza is for the careful.** The careful player's best on the plaza is under the market's best by 10% at most,
  on the mattress: $73 (home at $300, stopped 0.06 a day) against $77 (home at $90), −6.3%. Pass.
- **P4. On the plaza the police are the danger.** Heat-blind there banks under half the careful best: $24 (stopped 0.67 a
  day), 32%. Pass.
- **P5. The throw opens the docks** (bigman-1, 2026-11-18). The careful docks player who learns the throw from Mr.
  Haines (`docksThrow`, the lesson counted against its day) against the one who does not (`docks`), the mattress, home at
  $120, ten days: banks at least 4% more a day, and has the lesson back (what it banked in all, from day 1, at least the
  plain one's from then on) by day 7, two points and two days inside the 3,000-season reading. The lift at 60% for more
  fights (see "Low Tide Docks", the third part); the bars were 1% and day 8 (the throw $50), then 6% and day 6 (the
  lift at 75%). 3,000 seeds: $69 against $65, +5.9%, back on day 5; 500: $71 against $66, +8.5%, day 3. Pass.

**As they stand (bigman-1, third part, 2026-11-18, the places' marks alone):** 3,000 seeds (950 s), P1 mattress $65
against $74 (12.4% less; nothing banked 26% of days against 25%), cutter $82 against $89 (7.3%; 18% against 17%), bed
$103 against $113 (8.4%; 35% against 32%); P2 $51 / $66 / $83 shift only against $65 / $82 / $103; P3 −3.5%; P4 31%;
P5 above. 500 seeds (174 s): P1 12.3 / 6.1 / 8.8% less (nothing banked 26 / 18 / 35% against 25 / 17 / 33%); P2 $50 /
$67 / $84 against $65 / $83 / $102; P3 −4.4%; P4 32%. P1 and P2 play the careful docks player who passes a fight it
mostly loses.

**What batch-1 moved in the older marks** (`node scripts/run-marks.mjs --seeds 500`, before at b245eee, 1015 s, and
after at 8a759d8, 1112 s, the same seeds): 25 of 28 pass before, 29 of 32 after; every mark that passed before passes
after, and the same three fail (12, 13, 15, as before batch-1). Every number of marks 1 to 8, 10 to 16, R4 and H1 to H8
is the same to the dollar (no older player goes to a new place; the food cap of 2 is never reached with one food a
place). Mark 9 now also checks the new places' bins: the docks $6.6 an energy against the shift's $34.6, the plaza $2.6
against the flyers' $17.4. **The walk's two new cards** moved three: R2 (playing the stops against passing them, home at
$90) +7% → +5% (the bar is 5%: 0.79 cards a day → 0.59, a hand of 3 now drawn from up to seven cards, the barber never
played by a scripted player and the sneaker wall only at heat 0); R1 (the best walker against the best rider) 7% → 5%
apart; R3 (the board) +33% → +39%. Only new numbers were tuned for it: the barber is dealt only with heat to cool
(`minHeat: 1`), which took R2 from +4.7% to +5.2%. It passes narrowly: the owner's call whether the stop's hand (3, an
older tuned number, not touched) should grow with its cards.

## People remember (memory-1)

Added 2026-11-18 after the owner: "people forget easily we should fix", and "being a saint can't be the only path, you
are a criminal so being a criminal should still matter". Before it each person had one number, trust, drifting back to
neutral every morning: a full grudge was gone in two days, a friend by the weekend; and a shark who worked its own street
banked about 40% less than a careful criminal, because the street cased its trailer. The design is run69's "People and
situations" sheet, its "Fear, from marks" (its rare moments and walk cards are a later job). Numbers in
`src/run/config.mjs` (`memory`, each job's `mark` and `feared`, each person's `pronoun`). The daily mood and trust, their
drift and every number of theirs are as they were.

**A mark.** A big act leaves a mark on a person for a week (`memory.days`, 7: the day it is made and the six after; gone
on the morning of the eighth), whatever the mood and trust do. One mark a person, the latest that counts: a fight always
makes a new one; anything else only when they hold none. What each kind does is data (`memory.kinds`), so later jobs
add theirs (named to the police, saved, a friend for a week) by an entry and the act that makes it:

| Kind | Made by | What it does |
|---|---|---|
| `beat` | you beat them in a fight: a debt or a lift gone wrong, the regular who swings at your door, the visit below | fear, hate, comes due |
| `robbed` | you took it off them to their face: a debt collected, a till grabbed, a stick-up (the job's `mark: { win: 'robbed' }`) | fear, but they still talk (`tells`: against you and about, they call in what you do), hate, comes due |
| `beaten` | they beat you in a fight | they will not give way to you for the week: no fear of you from them, whatever you take off them |
| `shut` | you shut the door on a regular (the grudge) | hate: no sales to them for the week (the grudge's two days, now seven) |

**Fear.** Somebody you beat or robbed to their face gives way for the week. A job with `feared: 'sure'` done to them is
sure and no fight (the debt: paid without a fight, tired or not); a lift is still a fight when it goes wrong (caught, even
the scared fight back: with lifts conceded, the docks paid within 3% of the market and mark P1 fell out, measured); they
never swing at your door; they never tell (left out of the witness
roll; robbed ones still talk, `tells`); they are never the one casing your crib (the next in line is, or a stranger). They hate you all the same: no
sales to them and no work from them (`hates`: a job whose mood on a win is friendly is never dealt with them), and they
still count against you at home. Each eases the pressure at home by `memory.fear.pressure` (**−1**, a new number: "the
lane keeps off your door"). **Lose a fight at a place** and every fear held by that place's people ends at once ("Benny
Two-Coats isn't scared of you any more: they saw you beaten"); your door is your own street's.

**It comes due.** When a fear mark runs out, that person is at your door that morning, the eighth day, for another go: a
one-on-one (duel-1's fight) with them rested and ready, their toughness + `memory.due.tougher` (**10**: Benny 74, about 4
in 10 bare-handed and fresh), unless you pay them `memory.due.price` (**$20**, from banked) to call it square. Warned the
evening before, from `memory.due.warnHour` (**18:00**), or in the night if the day ends first: "Benny Two-Coats says he
is coming by tomorrow: another go at your door, unless you pay him $20 to call it square." Won: beaten again, another week
of fear, and another visit on its eighth day. Lost: the door's band as the regular's (their clean win energy −4, the
scuffle −2), they hold a `beaten` mark, and every fear on your own street ends. Stepping out or sleeping past them is the
fight. Robbing them again while they fear you does not move the day (a debt paid out of fear is not a new act); only a
fight does.

**One visit a morning.** The regular who wants something and anybody coming due share your door (`state.visits`): one at
the door a morning, the earliest due first (at a tie, whoever was due before this morning's roll), the others wait a day
and say so ("Shaky Dee came by your door too, but Benny Two-Coats was there first: back tomorrow wanting more."); a
regular who waited comes the next morning wanting what he wanted, with no new roll; after a night on the street they wait.
An attempt on your crib while you are out is not a visit and is unchanged.

**Seen.** A job, a fight at the door and the door shut carry `mark` (who, kind, day, until, left, fear, due, did, words,
text). New events: `markEnd` (who, kind, why `broken` or `ran out`, comesDue), `coming` (who, visit, on, waited). The door's
`door` carries `due: true` for a visit come due, as do its `gave` (paid off) and `fight`; a job paid out of fear carries
`fear: true`, one gone wrong with no fight `gaveWay: true`, the grudge `scared` when fear stopped the swing. The view adds
`marks` (each live one: who, place, kind, day, left, until, fear, due, warned, did, words, text: "you beat him on day 2 ·
gives way for 6 more days", "she beat you on day 3 · won't give way to you for 7 more days"), each person's `mark`,
`coming` (who is coming to your door, and when), each option's `fear` ("fears you: pays up", "fears you: won't fight
back") and its targets' `fears`, and `door.due` with the fight's odds. The terminal prints "They remember: …" and each
event's "Remembered: …".

**On the page.** The You panel's People tab: under each person with a mark, a line in the run's words ("◆ you beat him on
day 1 · gives way for 6 more days"; ▲ one who beat you, ● a grudge), above the places who is coming to your door, and
below them what a mark does. A card done to somebody who fears you says "fears you: pays up" (the debt), else "fears you". The
notice slip says who is coming tomorrow ("Coming tomorrow") and whose fear ended ("Not scared any more"), and the night's
report says both. The visit is the regular's door (the player out on his porch, the visitor at the foot of the step)
without the craving: he says his piece and waits; the dock has "Pay Benny Two-Coats off · $20" and "Fight Benny
Two-Coats" (its odds, "rested and ready"), and the bar's button says it; paid, the regular's hand-over; fought, duel-1's
fight at the door ("fists · tough, rested and ready (+10)"), then the result card ("A fight: you won", "Benny Two-Coats:
fears you 7d"). No new camera, clip or animation. `node demo/tools/run-memory.mjs --port <p> --out <dir>` plays it with
real keys and mouse presses and ends `memory-ok` or `memory-fail`.

**Saves.** State version 9 adds `marks` and `visits`. `loadRun` reads a version-8 save as nobody marked and nobody coming
(the one version it reads besides its own; older ones are still refused), and the rules read an older state handed to
them the same way.

**The scripted players** (`src/run/policies.mjs`). `shark` (runtest=shark): the burner leaning on its own street and
using fear: the trailer park's crimes first, a sure debt from whoever gives way first, no crime there that could start a
fight while anybody there fears it, a regular at the door given what they ask; a visit come due fought when the card says
55 in 100 or better, else paid off. `sharkQuiet`: the same, never a crime at home that would take the pressure there to
the warning. Every older policy meets marks, fear and visits without knowing them (the burner fights every visit: it
shuts the door; the rest pay when they can).

### The ways to play, before and after

The design's five (run69's scripts, copied to the session's `run79/scripts/styles.mjs`): 500 ten-day seasons each, seeds
1 to 500 before (at ce83540) and after (at 3a9c944), both places, home at $120. $ a day; cased: warnings in ten days.

| Way | Mattress | Box cutter | Bed |
|---|---|---|---|
| Careful criminal (`neighbour`) | $87.5 → $87.5 | $104.4 → $104.4 | $138.5 → $138.5 |
| Thief (`mixed`, no job to a face) | $83.3 → $83.3 | $93.0 → $92.9 | $130.1 → $130.0 |
| Shark at the market (`burner`) | $84.9 → $85.0 (cased 0.25 → 0.20) | $99.2 → $98.1 | $126.8 → $127.1 |
| Shark on its own street: the old player (`burner`, `parkFirst`) | $52.4 → $55.6 (cased 2.79 → 2.67) | $61.1 → $64.9 | $86.6 → $92.9 |
| **Shark on its own street, using fear (`shark`)** | $52.4 → **$72.1** (cased 2.79 → **1.24**; with memory off $50.3) | $61.1 → **$81.4** (2.82 → 1.17) | $86.6 → **$115.7** (3.19 → 1.14) |
| Earner (`quiet`) | $60.8 → $60.8 | $73.6 → $73.6 | $92.4 → $92.4 |
| (beside: `sharkQuiet`, under the warning) | $82.9, never cased (memory off $80.9) | $91.0 ($89.6) | $133.7 ($128.8) |

The shark on its own street rises $20 to $29 a day and is cased less than half as often (attempts took $104 → $60 of its
bank in ten days on the mattress, $369 → $148 with the bed; 1.3 visits come due in ten days, 1.2 paid off on the
mattress). The careful criminal, the thief and the earner move by a dime or less; the shark at the market by +$0.1,
−$1.1, +$0.3. The careful criminal stays the best in every kit, by $2.5, $6.3 and $4.8 over the next (was $2.6, $5.2,
$8.4: with the box cutter $1.1 more, the market shark's −$1.1).

**Tuning, in order.** (1) `memory.fear.pressure`, with the shark leaning fully on its street: 0 left it at $68.8 and
cased 1.88 times in ten days; −1 $72.6 and 1.53 (300 seeds), −2 $73.5 and 1.26, −3 $74.3 and 1.08; −1 taken, because the
trailer park's crime player (mark H2: at least 8% of what it earns taken by attempts) came to 9.2% with it. (2) A mark of
somebody robbed to their face first silenced them as a beaten one does: the market shark rose $1.4, $3.1, $3.1 (the
stallholders it robbed stopped calling in its tills), and marks 6, R2 and P1 fell out (the market's careful player was
never stopped for its tills any more and banked $3 a day more); the visit's numbers could not move it (tougher 15 or 20:
$0.2). Robbed, they now give way but still talk (`memory.kinds.robbed.tells`). (3) A lift caught from somebody who fears
you was the failure without a fight; then conceded as a fight won (paid): with that the docks paid within 3% of the market
(P1 fell out, the other way). A lift is now a fight, fear or not; only the debt (`feared: 'sure'`) is paid without one.
The visit's `tougher` 10 and `price` $20 are the design's and were not tuned.

### What memory-1 moved in the marks

`node scripts/run-marks.mjs --seeds 500`, the same seeds, before at ce83540 (1,113 s) and after at 3a9c944 (1,245 s):
29 of 32 pass before, **31 of 32 after**. Every mark that passed before passes after; 12 and 13 now pass, 15 still fails.
Marks 1, 3 to 5, 7, 8, 10, R1 to R4, P1 to P4 read the same to the dollar (no fight, no debt and no visit in their six
days moves them, or the players never meet a mark). What moved:

- **Mark 2**: the trailer park's best $55 → $59 (its debts paid out of fear after the first), so the market's margin
  +42% and +66% → +32% and +55% (bars 15% and 30%).
- **Mark 6**: the park-only player owns all three in a median of 5 → 4 days (the measured player is unchanged: 4).
- **Mark 9**: the park with the bins $41 → $47, against the park's $55 → $59.
- **Mark 11**: worst tenth of days leaning on Dee −$38.6, not −$3.2 → −$38.7 and −$1.0 (means $49 and $56 → $53 and
  $60; refusing every time $49 → $54: the door shut is a week's grudge now, so fewer sales and less trouble at home).
- **Mark 12 now passes, by a hair**: both places $86 → $87 against the market's $77 (+11% → +12%), the park at 63% →
  68% of it; with the cutter $100 against $91 both times, shown +10% (under the bar before, at it after: the park's
  fear-paid debts after a trip).
- **Mark 13 now passes, by a hair**: the good neighbour and the burner $87 and $86 → $87 and $87; with the bed $139
  and $126 both times, shown 10% apart (over the bar before, under it after); with all three $188 against $172 → $174.
- **H2**: what attempts took of what was earned: the trailer park's crime player 12.4% → 11.6%, home-first 14.4% →
  13.0%, with the bed 23.7% → 23.2% (bar 8% to 25%). **H3**: the deadbolt +$10.0 → +$11.0 a day, the floor safe
  +$26.3 → +$27.0. **H5**: with the bed $83.5 against $16.2 → $87.9 against $17.7. **H7**: ignoring $83.5, racing
  $92.7, best defender $109.8 → $87.9, $98.0, $114.9. **H8**: never $83.5, every warning $94.0, only when worth it $95.2 →
  $87.9, $101.1, $101.7. All pass, as before.

## Fights in the run: styles and getting jumped (styles-1)

Added 2026-11-18, the owner's direction: "different opponents with different styles", "buy different punches for street
fights", "more strategy play vs grinding", and getting jumped at the market: "would love to see me get beaten up. And
that's why buying things helps, money has a purpose." One decision up front, what you bring; then the fight plays itself.
The fight's parts are fight-3's (`src/fight/data.mjs` `RIVALS`, `PUNCHES`, `rivalFoe`, the arena's `jumped`); this is
the run reading them. Numbers in `src/run/config.mjs`: each person's `style`, `duel.you` (the punch styles' scale),
`duel.sent`, `duel.advice`, `styles` (the lessons) and `jumped`.

**Opponents have styles.** Every person of the run has a `style` (a key of `RIVALS`; none: the plain brawler), and
`rules.mjs duelOf` builds the one you fight through `rivalFoe(style, { hp: their toughness })`: their toughness is the
run's as before (the role's, give or take 5); how they fight is the style's. The plain brawler is the old opponent, the
same fight tick for tick (a test). The card says it before you choose: "fails: a big man, ~1 in 10", and the
bar's row while it is picked "a fight with Big Lou (big, slow, hits like a truck): you win about 1 in 10 with bare
hands. With the throw: 5 in 10 …"; the fight's bar over the picture says it too.

| Who | Style | Why |
|---|---|---|
| Benny Two-Coats | plain brawler | decided |
| a man at the bus stop | plain brawler | an ordinary man |
| a woman at the bus stop | quick one | she turns and is gone: a lift caught by somebody quick |
| Shaky Dee | quick one | jittery, slight (43) and fast |
| Big Lou (driver) | big man | the docks' big man: the throw, taught on the same pier, is his answer (bigman-1; a quick one before, for mark P1: "Low Tide Docks") |
| Nadia Petrakis (driver) | plain brawler | the truck a new player can still lift from |
| Mrs. Alvarez, Gloria (neighbours) | plain brawler | they never fight you (the odd job is safe); data for later |
| Mr. Pruitt (neighbour) | grabber | a big neighbour; never fights you yet |
| the market: Lola, Pockets, a woman in the crowd | quick one | quick hands for a living |
| Tiny | big man | the name is the joke |
| Teo (connect) | knife | |
| Mr. Okafor (stallholder), Mr. Haines (foreman) | grabber | hold on to what is theirs; Haines teaches the throw |
| the rest (shopkeepers, stallholders, the plaza's) | plain brawler | |
| somebody sent (below) | rolled from the run's seed and who sent him, among all five | a stranger |

Cousin Earl has none: he never fights you (not in this job).

**Punch styles you learn.** Quick hands, the haymaker and the throw are each taught at one place, by one person of it
(`styles`), learned once for money from what you carry, no hour, and kept (`state.styles`). The city's real gym (KID
GLOVES BOXING, block −2,−4 on Market Ave and Jay St) stands on no street the run walks (the walk by Fit Street is block
−3,0; the market's lot −2,1, 160 m north), so each is taught by a person at a place that exists:

| Style | Taught by | Where | Price | What it does |
|---|---|---|---|---|
| quick hands (`jab`) | Pockets | the Jay St night market, in the crowd | $70 | fast light blows: a quick one never gets set; too light for a big man |
| the haymaker | Cousin Earl | the trailer park, at his truck | $80 | one big slow swing that knocks them back: hit a grabber before he gets hold of you; too slow for a quick one |
| the throw | Mr. Haines | Low Tide Docks, by the pier | $80 ($50 for a day in bigman-1: "Low Tide Docks") | puts them on the ground, and the ground doesn't care how big they are; a slippery one twists out of it |

The move is "Learn quick hands from Pockets ($70)", under Shop (B) where it is taught, after every older move (no key
changed). The Library (L) has a fourth kind, Fight: every way to fight (the three styles and the box cutter), what it
does, who teaches it where (or "sold at your crib"), and Learn when it is taught where you stand. The You panel's Fight
tab lists them too. A lesson counts against the day it is bought in the scripted players' take (`policies.mjs`, as the
guard's wages do; `books.lessons`).

**Fight with.** One standing choice (`state.fightWith`) among what you own: bare hands, a style you know, the box
cutter; unset, or no longer yours, it is the box cutter if you own it, else bare hands (as before). It is set with no
hour, any time you are not in a fight (`{ do: 'fightWith', with }`, listed only when you own two things or more, and
after every older move): the You panel's Fight tab (a button each), E (the next thing you own), and at home a button on
the bar's row ("fight with: bare hands E"). It is fought with one-on-one and when you are jumped. Every card's fight odds
use it, and each says the same fight with each other thing you own (`fight.byArm`: "With the throw: 5 in 10 (E changes
what you fight with)"); the risk line says "with bare hands", and its small print the jump's odds with each.

**Getting jumped is a fight you watch.** Two at once, a heavy and a runner (`jumped.foes`: fists and a shiv, the arena's
two), placed round you where you stand (`around`), on the one-on-one's terms (the run's `duel.hit`, the brawl for all
three, a cap of 20 s: at the cap you win with more health than both of them together). You bring what you fight with,
fresh or tired (`jumped.you`: 92, or 79 tired: jumped, there is no time to be rested, so only tired counts, as with the
dice). Each jumper is `perStrength` tougher for each point of the tier's strength (the docks' +10: the heavy 47, the
runner 23). The fight decides it, and what each ending costs is the dice's: **lost**, the bad one (all you carry, the
clinic); **a scrape**, the scuffle (half): won with your health at 17% or less, or lost with them at 15% or less of
theirs (you hurt them: they grab half and run); **won**, nothing. Its odds on the bar are a sample of 3,000 of the same
fight (`jumped.sample`, kept by the inputs). Sleeping rough is still the dice (robbed asleep is no fight). A test that
rigs a contest roll still gets the dice (`state.rig`).

Calibrated against the dice (the jumpers' numbers are all new; no older number changed): the share of jumps that end as
a bad one and as a scuffle, 12,000 fights a cell with random seeds, then the bar's own sample:

```
tier      kit             dice bad/scuffle   fight bad/scuffle   the bar's 3,000
rough     hands fresh     35 / 20            34.4 / 18.9         36.3 / 18.4
rough     hands tired     45 / 20            44.9 / 20.5         46.7 / 19.7
rough     cutter fresh    20 / 20            20.3 / 17.0         19.8 / 17.1
rough     cutter tired    30 / 20            28.0 / 21.3         27.6 / 21.2
mean      hands fresh     45 / 20            44.2 / 19.4         44.3 / 19.9
mean      hands tired     55 / 20            54.7 / 20.8         56.1 / 19.6
mean      cutter fresh    30 / 20            28.1 / 18.8         28.4 / 18.5
mean      cutter tired    40 / 20            38.5 / 21.2         37.6 / 21.5
```

The street and the plaza (strength 0) are the rough tier's. Worst 3.0 points (the box cutter's scuffle fresh, 17.0
against 20: at the edge). And the styles jumped (rough, fresh / tired, bad and scuffle): quick hands 24 / 21 and 36 /
25, the haymaker 34 / 14 and 40 / 17, the throw 47 / 17 and 56 / 17: against two at once the throw is the wrong tool (one held, the other hits you).
How it was tuned: a won fight alone as "nothing" and a narrow win as the scuffle left the box cutter's scuffle fresh at
15 and its tired gap at 6 points (the dice's 10), whatever the numbers; counting a close loss as a scrape too fitted all
eight. The tuning ran on arithmetic seed series (`a × k + b`), which turned out to read 1 to 2 points under the truth
(measured against random seeds, 20,000 fights); the table above is on random seeds.

**On the page.** The two who jump you are the market's own robbers (Mick and Lyle Dunn); they run up to you, the fight
is played where you stand (`demo/run/duel.js`, now for several: the ground round you, both bars, the frame check), you go
down or they do; beaten, they go off with it and you get up; seen off, they stay down while you stand over them. Space or
Skip goes to the same result. The result card's chip: "jumped: they beat you", "a scrape, half gone", "you saw them off".

**Somebody sent.** In "people remember", a visit come due from somebody not of your home street, or who keeps a shop or
a stall (`duel.sent.roles`), is not them at your door: "Mr. Okafor sent somebody round for another go: grabs and won't
let go." The same rule and the same numbers (their toughness + `memory.due.tougher`, the same $20 to call it square); a
plain tough whose style is rolled from the run's seed and who sent him. The mark goes on who sent him. People of your own
street come themselves, as built. On the page one of the stage's toughs stands at your door for him (Mick Dunn).

**After a loss, one line.** A fight lost (a job's, the door's, a visit's, a jump's) puts one line on the result card
(`rules.mjs fightAdvice`): the same fight (its inputs, a sample of 200 of its own) with each thing of the run that could
change it, one at a time (each other way to fight, known or taught somewhere; the box cutter; rested), the best one if it
wins at least `duel.advice.margin` (10) points more: "Quick hands wins this about 8 in 10 · Pockets teaches it at the
Jay St night market, $70"; "The box cutter sees them off about 6 in 10 · $90 at your crib"; "Rested you win this about 5
in 10 · full energy (6)"; else "Nothing you can get does much better here". Never a gun. Not part of a step (it plays a
few hundred fights): the page and `scripts/run-play.mjs` ask it.

**The scripted players.** `styled` (homeFirst, the trailer park's crimes first then the market) learns quick hands at
the market and, before every fight it can see coming (a card that fights, the door, an hour it can be jumped), fights
with what the card says wins most; `styledAll` learns every style where it is taught. Measured (300 seeds, home at
$120, the lesson counted against its day): over six days `styled` banks 17% less than homeFirst on the mattress
($52.6 against $63.0), 20% less with the cutter; over ten days 3% and 7% less ($55.1 against $57.0, $61.6 against $66.4):
quick hands at $70 does not pay for itself inside ten days for this player, and no scripted player who learns banks
above today's best for its kit (the dealer: $88.6 mattress, $110.0 cutter over ten days).

**The duel table** (`node scripts/duel-table.mjs`) prints its nine targets as before, on the plain brawler, figure for
figure; then every way to fight against an ordinary one (55) of each style, fresh / tired, every person who fights you
with their own style, and four targets more:

```
you fight with         brawler       big man     quick one         knife       grabber   mean
bare hands             50 / 33        10 / 4       64 / 48       53 / 36        14 / 6   38
box cutter             64 / 50       38 / 17       82 / 64       74 / 59       68 / 52   65
quick hands            61 / 42         6 / 2       89 / 75       59 / 41        12 / 6   46
the haymaker           69 / 56       57 / 36       56 / 44       54 / 39       68 / 56   61
the throw              71 / 55       62 / 39       42 / 28       54 / 40       65 / 46   59

who                       tough  style            bare hands  box cutter quick hands    haymaker       throw
Shaky Dee                    43  quick one                78          88          94          56          58
a man at the bus stop        56  brawler                  49          63          60          69          71
a woman at the bus stop      55  quick one                64          82          89          56          42
Benny Two-Coats              64  brawler                  40          57          51          67          62
Big Lou                      57  big man                   9          36           6          54          61
Nadia Petrakis               63  brawler                  41          58          52          68          64
```

Against each style something you can own wins 15 points or more over bare hands (the throw 71 against 50 and 62 against
10, quick hands 89 against 64, the box cutter 75 against 53 and 68 against 14); no one way is best against all five; the
box cutter wins the most on average (65; the haymaker 61, the throw 59, quick hands 46). **Not met:** nothing you can own
under 10% or over 90% fresh: quick hands against a big man win 6% (and bare hands 10%). The punch styles fight at bare
hands' scale (1.8, the study's) but quick hands at 1.6 (at 1.8 they won 92% against a quick one) and the haymaker at 1.7
(at 1.8 it won as much on average as the box cutter, for less). Quick hands cannot be under 90 against a quick one and
over 10 against a big man at any one scale (1.6: 89 and 5; 1.7: 91 and 10): the big man's soak takes all of a light
blow, as fight-3 meant ("useless against a big man"). Looked at again in bigman-1 (4,000 fights a cell, fresh, against
an ordinary one of 55): 1.60 to 1.64 read 88 and 6, 1.66 and 1.68 89 and 7, 1.70 90 and 9; the big man's odds jump
between 1.68 and 1.70 just as the quick one's reach 90. No scale meets both; the target's floor is the owner's call
(bare hands against a big man read 9.8%, under it too). Big Lou in the table above, a big man now: the throw 61, the
haymaker 54, the box cutter 36, bare hands 9, quick hands 6 (the drivers at 62; at 66, since bigman-1's second part, the
rows above: Big Lou 61, the throw 57, the haymaker 47; Nadia 67, the haymaker 64, the throw 60; back at 62 since the third part).

**Saves.** State version 10 adds `styles` and `fightWith`; `loadRun` reads a version-9 save (and an 8, through 9) as
none learned and unset. `books.lessons` is new in the books.

`node demo/tools/run-styles.mjs --port <p> --out <dir>` plays it in the page with real keys and mouse presses (quick
hands learned from Pockets, the Library's Fight kind, the throw learned on the docks and fought with from the You panel (bigman-1; quick hands before) and a card's odds
changing, the lift gone wrong at Big Lou, jumped at the market once seen off and once beaten, the line of advice,
somebody sent at the door, paid off) and ends `styles-ok` or `styles-fail`.

### What styles-1 moved in the marks

`node scripts/run-marks.mjs --seeds 500`, the same seeds, before at bca2cbc (1,313 s) and after at 78d22b5 (1,530 s): 31 of
32 pass before, **29 of 32 after**. 15 fails as before. **Two marks moved out, each by less than a point**: 12, both
places with the box cutter $100 against the market's $91, +9.9% (the bar 10%; before it was the same $100 against $91,
just over); R2, playing the stops +4.9% (home at $120, $79 against $76; before +5% at $90, the bar 5%). Both sit on
their bars and moved with the noise of getting jumped as a fight (the same shares, other draws). Tuned for them, new
numbers only: the jumpers' fresh health 90, 91, 92 (92 taken: P1 11.8% against 12.0% at 91) and the drivers' styles; at
none of them did 12 or R2 come back, and no older number was touched. What moved, before then after:

- **Getting jumped**: in play the bad ones per jump are the dice's within a point and a half (the market's careful
  player: the bar's own sample 41.1% against the dice's 39.7% on the same jumps, measured), but each bad one is a
  morning in the clinic, so a few more of them carry on into the next day: the market's best on the mattress $77 → $75,
  with the cutter $91 → $91, with the bed $120 → $118 (home at $60 now, $90 before).
- **Mark 2**: +32% and +55% → +22% and +49% (the park $59 → $61: the bus-stop woman and Shaky Dee are quick ones now,
  easier to see off bare-handed; bars 15% and 30%).
- **P1**: mattress 11.9% → 11.8% less, cutter 7.4% → 5.3%, bed 6.2% → 5.1% (bar 5 to 12%). The drivers set it: Big Lou
  a big man put the docks 19% under the market on the mattress, a knife and a quick one left the cutter 3.6% under;
  measured at 500 seeds each.
- **Mark 11** (Dee at the door): worst tenth −$38.7 leaning against −$1.0 not → −$36.9 and +$1.6.
- **H2, H5**: the trailer park's crime player loses 11.6% → 10.5% to attempts (8 to 25%); banks $54.2 → $56.6.
- The rest within a few dollars, every mark that passed still passing but 12 and R2.

**The two at 3,000 seasons, on the joined branch (2026-11-18).** Mark 12 passes there: the mattress +15.3% ($85.85
against the market's best $74.49) and the cutter +11.6% ($100.46 against $89.99, home at $160). Its +9.9% at 500 seasons
was the short run's noise: 12 is judged at 3,000, and a 500-season run can read it a point and a half either way. R2 is
a true miss at 3,000 (+4.7%, home at $90), and was put right on the walk's own two cards, not on the fights ("Two cards
on the walk": the barber beside the hand and the sneaker wall's miss at heat +1, **+7.9%**).


## The Sixes and a home that scales: the first slice (sixes-1)

Added 2026-11-18 after the owner: "sixes first" · "when you get an apartment in later game we need more stuff to defend,
guard dog isn't enough, we need more things to buy that have purpose. A deadbolt isn't enough. So we need to scale" · "I
just really like how in rimworld you see the raids happening, and i want it to feel like what you own is actually helping
you" · "being a saint can't be the only path, you are a criminal so being a criminal should still matter". The design is
run75's sheet "The Sixes, and a home that scales"; this is its section 7, the first slice, all in the trailer, with the
lead's changes (the crew a step up, Earl hurt one day, a jump by the Sixes as a fight, refusing with an upside). Numbers
in `src/run/config.mjs`: `crew`, `guard.way` / `ways` / `doorHurtDays` / `fight`, `dog`, `sixes`, the things `doorbar`,
`dog`, `camera`, `dogsign`, the `kick` and `crewShare` of `deadbolt` and `floorsafe`, `memory.kinds.seenOff`.

The design's six things hold: trouble comes from what you do, never from what you own; anything that takes from your
home is warned the day before (two days with the camera), takes a share and never all, and a choice can stop it;
pressure comes in waves; every running risk has a meter (HOME, and now SIXES); what happens elsewhere sends a notice;
there is no safe bank.

**A crew, HOME's second line.** From pressure `crew.at` (**7**) the morning's warning is of a crew, not a sneak: whoever
would have cased it "and a friend", two heavies, coming after dark the next night. Home that night (the bed or the
mattress at the crib), it is **the door fight you watch**: the fight of several of getting jumped (`src/fight/duel.mjs`,
`foes`), you with what you fight with at the health a night's sleep gives (`rules.mjs crewOf`), Cousin Earl beside you if
he is on (the duel's new `ally`, the fight study's Earl told his way: `earlsWay`), the door bar's head start
(`firstHurt`); the same bar, the same Skip on the page. Won: they run, energy −1 off the morning. Lost: in, energy −4,
and they make you open it: 30% of what is banked (the safe does not help when you are there to open it), and half the
goods left at home (`crew.stockPct`). Out for the night (the jail, the clinic, the street): Earl on the step first (the
contest at `crew.strength` 60 less his 10), then the door, a kick, **90%** (the chain and locks **75%**); in, 30% (the
floor safe **20%**). The sneak (HOME 3 to 6, by day while you are out) is today's burglar, unchanged but for the dog and
the sign.

**Six pieces, each one job** (`things`, `against`, `job`; sold where they are, listed after every older move so no older
key moves):

| Piece | Where, from whom | Price | Its one job | Against |
|---|---|---|---|---|
| Chain and locks (`deadbolt`) | the trailer park, Mr. Pruitt's yard sale | $25 | a sneak gets in 50%, not 75%; a crew's kick while you are out 75%, not 90% | sneak, crew (out) |
| Floor safe | the flea market, Mr. Okafor's stall | $100 | a sneak takes 8%, not 30%; a crew while you are out 20% | sneak, crew (out) |
| Door bar | Low Tide Docks, Mr. Haines by the pier | $40 | home, the first of a crew through the door is **20** health down | crew (home) |
| Guard dog | the trailer park, Gloria at her kitchen window | $40 + $2 a day | while you are out, a sneak who hears it gives up 50%; fed $2 every morning from banked, two days unfed it sulks and guards nothing; shut in the back for a crew | sneak |
| CCTV camera | the flea market, Mr. Okafor's stall | $120 | whoever cases it is seen a day sooner: two days to answer; attempts come no more often (the quiet days count from the attempt) | both, if you answer |
| Beware of the dog sign | the trailer park, Mr. Pruitt's yard sale | $5 | 10 points off each morning's chance a sneak cases you; a crew laughs at it | sneak |

Each is seen in the trailer once bought (`demo/stage/set/starter.js` THINGS, `set/crib.js`): the dog's bed and bowls on
the floor by the front with the dog sitting by it (the older game's chain dog, `demo/stage/props/dog.js`), the camera and
the sign on the back wall, the door bar across the room's side of the door leaves (with the chain and locks). Their
keepers keep no library shelf (`library.mjs`: a keeper of only `late` pieces).

**Tell Earl how to fight.** One standing choice, `state.earlWay`, among `guard.ways` (**front, hunt, block**:
`WAYS_OFFERED`; unset, `guard.way` **front**), set with no hour any time he is on your step (`{ do: 'earlWay', way }`,
after every older move). His fight at your door: health **50**, the tire iron at **1.0** (`guard.fight`). The door fight's
card (the crew warning, the HOME slip, K) says the odds with each way and with what else changes it (each thing you own
to fight with, the door bar, Earl hired), and the slip's buttons tell him. Down in a door fight he is off **one** day (the
day after) and his paid stretch goes on (`guard.doorHurtDays`); beaten alone on the step while you are out, as before
(three days, the stretch lost).

**The Sixes' meter** (`sixes`, `state.sixes`), 0 to 10 beside HOME on your numbers, with its slip (what holds it up,
what raises it, what brings it down, the steps built). What you do on their ground (`sixes.ground`: the flea market)
moves it, never what you own: a sale there **+1** once a day; a till or a stick-up **+1** (the design's +2 until the second pass: mark 13, below); refusing the tax **+2**;
beating the two by the steps **+2**. A day with nothing done there **−1** the next morning; paying the tax **−1**, and
that day's selling no longer counts. Three steps are built:

- **3, a word.** The first time it reaches 3 (again after it has fallen under 3), Dutch comes up to you at the market:
  "Nice stall work. Shame if it turned into till work." Nothing is taken; a scene and a notice, and the slip says what
  comes at 5.
- **5, the tax.** On a day you sold or grabbed there, Dutch is waiting on the market's kerb, on your way to the subway, when you leave (the ride or
  the walk out is stopped; you choose again): a fifth of what you made there today, at least **$10**. Two cards: pay
  (from what you carry) or refuse. Nothing else is open until it is answered.
- **7, two of them on the kerb.** Warned the morning before (a notice: "they'll be looking for you at the market
  tomorrow"). That day, leaving the market, two of the Sixes are waiting on the kerb: the jumped fight, their two, their
  own look on the page (the stage's `rival`). **Won: you keep what you carry, the two fear you for a week**
  (`memory.kinds.seenOff`: nobody waits for you while it lasts) and the meter goes up 2. Lost: what a jump takes (all you
  carry and the clinic; a scrape, half), and the meter drops to **6**: they made their point. Stay away that day and the
  two go home.
- **Held at 8.** Nothing above 8 is built in this slice (the raid at 9, the siege at 10), so the meter stops at
  `sixes.cap` **8** and the slip says so.

Dutch is one of the market's people (`npc:sixes:dutch`, a knife), and the two by the steps (`npc:sixes:heavy`,
`npc:sixes:runner`) are of the market too; no job is done to them (their role `sixes` is no job's), and on the stage the
two are extras like the Dunn brothers.

**Seen.** New events: `casing` gains `kind` ('sneak' | 'crew'), `lead`, `sign`; `raid` with `kind: 'crew'` carries the
fight (`duel`, `crew: true`, its `earl`: way, down), `energyLost`, `goodsTaken`, `shareBy`; `dogFed`; `earlWay`;
`sixes` (`what`: 'word', 'tax', 'paid', 'refused', 'ease', 'jumpWarned', 'jumpOff'); `jumped` with `sixes: true` (who,
marks, the meter after). A job on their ground carries `sixes` (the meter's move). The view adds `sixes` (the meter's
slip, the tax waiting with its keys, the two waiting), `earl` (his ways, each with the door fight's odds), `home.crew`
(from when, the door fight's odds and what changes them, out: the kick and the share), `home.dog`; each piece's `job`
and `against`.

**Saves.** State version **11** adds `sixes`, `earlWay`, `home.dog`, `books.dog` and `books.sixes`. `loadRun` reads a
version-10 save as the Sixes never having heard of you, Earl told nothing, no dog (and a 9 or an 8 through 10).

**The scripted players** (`src/run/policies.mjs`): `layLow` (the home-first player who, warned of an attempt, does no
crime at home until it has come, and tells Earl the way the door card says wins most: `pickWay`); `taxPayer` and
`taxRefuser` (the market's crime player, `mixed`, home at $120, paying Dutch or refusing). Every older player pays the
tax when it carries the price, else refuses (`tax` unset). The pieces are a kit (owned from the start), as H3's.
Auto-play: `runtest=slice` (with `&kit=deadbolt,floorsafe,doorbar,dog,camera,dogsign`), `taxpay`, `taxrefuse`; its
numbers under `sixes`.

**Tuning, in order.** (1) The crew: the design's two study heavies on the study's yard gave 72 / 87 / 100 (bare hands, the
bar, the box cutter); on the run's own terms (the jumped fight's brawl, a blow lands 45%) two heavies at **45** health
hitting **1.15** read 51 / 72 / 80 at 2,000 fights (hp 44 hits 1.3 gave 44 / 63 / 74; hp 46 hits 1.12, 54 / 74 / 83).
(2) The door bar: 15 health gave 64 with bare hands, **20** gives 72. (3) Earl: the study's 65 health at the run's 1.6
made every door fight with him 97 to 99% whatever his way; **50** and **1.0** give 92 / 95 / 94 with him down 76 / 51 /
56% (front, hunt, block): his way is mostly how hard he is hit. (4) The meter, the tax and the jump's numbers are the
design's, not tuned: S3 met them as they are.

### Marks of the first slice

`node scripts/run-marks.mjs --sixes` (ten-day seasons, as the home marks; the door fight's own sample, one fight a seed).

- **S1. Against a crew, today's two are not enough and the slice is.** The pressured player (home-first, the bed): what
  crews take in ten days, today's two cut it by less than 15%, the slice by 30% or more, and all attempts take a third
  less with the slice than with today's two.
- **S2. No single piece covers every visitor.** Each piece alone, for the same player: none cuts what both the sneaks and
  the crews take by a quarter or more.
- **S3. The tax is a real choice.** The market's crime player paying and refusing bank within 10% of each other in each
  kit (mattress, box cutter, bed), by different roads: the payer pays the tax, the refuser meets two of the Sixes by the
  steps.
- **S4. The crew is a step up.** Rested and alone at your door: about 50 in 100 with bare hands, 70 with the door bar, 80
  with the box cutter, each within 5.

Measured 2026-11-18 (`--sixes`), 500 seasons (368 s) then 3,000 (2,180 s); the door fight's sample is as many fights:

| Mark | 500 | 3,000 |
|---|---|---|
| S1 crews' take, nothing / today's two / the slice (ten days, bed) | $194 / $179 (−8%) / $107 (−45%); all attempts $329 / $205 / $119 (−42% on today's two) | $200 / $184 (−8%) / $104 (−48%); all $329 / $208 / $116 (−44%) |
| S1 a day, nothing / two / slice / slice and laying low | $90 / $103 / $110 / $114 | $89 / $101 / $109 / $112 |
| S2 each piece alone, sneaks' take / crews' take | deadbolt −30% / −2%; safe −73% / −5%; bar 0 / −23%; dog −44% / +2%; camera +7% / −15%; sign −13% / +5% | deadbolt −31% / −3%; safe −73% / −5%; bar +1% / −27%; dog −50% / +2%; camera +6% / −17%; sign −12% / +3% |
| S3 pays / refuses (mattress, cutter, bed) | $77 / $76, $89 / $92, $119 / $119 (0.7%, 3.5%, 0.0%) | $77 / $77, $89 / $93, $119 / $119 (0.5%, 4.2%, 0.0%) |
| S4 bare hands / door bar / box cutter | 49 / 71 / 82 | 51 / 72 / 80 |

All four pass at both sizes. Beside S4: on the mattress (80% health) bare hands 34; with Earl beside you, bare hands,
out in front 92 (Earl down 76%), hunting 95 (50%), one at a time 94 (55%). The tax payer pays $63 to $114 in ten days;
the refuser meets two of the Sixes by the steps 0.74 to 1.19 times in ten days and sees them off 58 to 69% of the time
(with the box cutter refusing banks 4% more: being a criminal still pays).

**What the slice moved in the home marks** (`--home`, 500 seasons, before at 3b1200d in run91's full run, then after):
H1, H4, H5, H6 pass as before. **H2** still passes, higher: the trailer park's player 10.5% → 16.8%, home-first 13.3%
→ 21.6%, with the bed 22.7% → 20.4% (the bar 8 to 25%): a crew takes more than a sneak from a player who is home and
loses the door fight; the trailer park's player banks $56.6 → $51.3 a day, home-first on the mattress $56.5 → $48.3, with
the bed $89.5 → $90.2. **H3 fails, because of the slice, as the design says it would**: for the pressured player with
the bed the floor safe now pays back in 9.3 days (was 3.8; +$10.8 a day, was +$26.7), the deadbolt in 5.6 (was 2.4): he sits at pressure 9 to 10,
so most of what comes for him is a crew, at night, while he is home, and against a crew at home the deadbolt and the
safe do nothing (beaten, they make you open it). That is the slice's own point ("today's two pieces barely touch a
crew", S1); the target was not moved. **H7** passes with a smaller race (racing $93.3 against ignoring $90.2, was $98.5 against $89.5: crews
send no notice to race home on). **H8** passes, narrowly: only when worth it $100.6 against every warning $100.3.
At 3,000 seasons (3,271 s) the same: 7 of 8, H3 failing (the floor safe 9.7 days, +$10.4 a day; the deadbolt 5.6
days), H2 16.5% / 20.5% / 20.5%, H7 ignoring $88.8, racing $91.5, best $99.2, H8 $99.1 against $99.5 (narrow).


**What the slice moved in the older marks** (`node scripts/run-marks.mjs --seeds 500`, 2,610 s, against run91's run of
3b1200d, the same seeds): 31 of 33 passed before, **32 of 37 after** (S1 to S4 pass). Every market player who sells or
grabs there now meets Dutch (the older players pay when they carry the price), and every pressured player at home meets
crews: the market's best on the mattress $75 → $71, with the cutter $91 → $84, with the bed $112 → $106. What that did:

- **Mark 12 now passes** (both places +13% and +11%, was +13% and +10%).
- **P1 fails**: the docks player is no longer under the market with the box cutter (−1.2%, the bar 3 to 15%; mattress 6.6%,
  bed 5.5% still in): the market got dearer and the docks did not. **P3 fails**: the plaza's careful best $71 against the
  market's $71 (+1.2%; the bar: under it). Both are the tax on the market, not a change at the docks or the plaza.
- **Mark 13 fails**: with the pocket and the cutter the good neighbour banks 11% more than the burner (the bar 10%):
  the burner's crimes at home bring crews now.
- **Mark 15 still fails**, as before. **Mark 11** passes with a deeper tail (−$36.9 → −$67.0 leaning on Dee: his custom
  brings crews). H2, H3, H7, H8: above.

No older number was moved for them. The choices are the owner's: make the tax lighter for a player who only sells there
(the design's own numbers are kept here), or move P1 and P3's market reference, or the docks' and the plaza's pay.

### The second pass (sixes-1, after the join)

The coordinator's calls on the marks the slice moved, and four things on the page.

**P1 to P5 compare a place with a place, with the Sixes at rest.** The Sixes tax only the market, so with them on every
other place reads better against it: that is the Sixes working (S6), not the docks or the plaza being wrong. The trial
holds the meter at 0 (`config sixes.rest`, a trial's switch only: `marks.mjs atRest`); the players are the same and no
place was retuned. Each P target says so. At 500 / 3,000 seasons: P1 the docks 12.3 / 12.4% less on the mattress, 6.1 /
7.3% with the cutter, 8.8 / 8.4% with the bed (the join's own baseline: 12.4 / 7.3 / 8.4 at 3,000); P3 the plaza −4.4 /
−3.5% under the market; P2, P4, P5 pass (P5 +8.5 / +5.9%, back on day 3 / 5). 5 of 5 at both sizes.

**S5, the tax bites, it does not gut.** The market's best player (homeAt, the best of $60 / $90 / $120 / $160, six-day
seasons as marks 1 to 7) with the Sixes on against the same with them at rest. At a fifth and a grab at +2 (the first
pass) the bite was 5.6 / 7.9 / 4.0% (mattress, cutter, bed; 500): inside 3 to 8, but the cutter at its edge, and mark 13
out (below). With a grab at +1 it is **2.9 / 3.7 / 2.4%** (500) and **3.1 / 4.4 / 2.1%** (3,000). The owner's 3 to 8 cannot hold at a
fifth with mark 13 in: to put every kit 2 points inside it the tax would have to be about 40% (at 25% the bite is 3.9 /
5.2 / 2.7, at 30% 4.5 / 6.5 / 3.3; 500 seasons). So the tax stays a fifth and **the band is the 3,000 readings, 2 points each
side: 0.1% to 6.4%** (`BITE_MARK`). What it costs: $3 to $5 a day of the market player's take, paid on about one market day
in two.

**S6, the Sixes make other ground worth working.** The split player (`POLICIES.split`, the market and another place by
turns, a day each; the docks' or the plaza's) against the market only, both with the Sixes on. Measured: **the plaza by
turns comes out level with the taxed market, not above it**: +0.1 / −4.3 / −0.9% (mattress, cutter, bed; the docks by
turns −10 / −7 / −15%; 500), −0.1 / −1.5 / −0.9% at 3,000. The upside said out loud is "as good as", not "better". The bar proposed: **no more than 7% under** (`SPLIT_MARK`), the readings 2 or more
inside it.

**H3 by the visitor each piece is for.** The chain and locks, the floor safe, the dog and its sign are judged against
sneaks: the same pressured player (the bed), out when they come, with crews held off (crew.at past the meter's top); the
door bar against crews, the game as it is (he is home at night when they come). **The dog is judged against sneaks, not
crews**: its one job is a sneak while you are out, and for a crew it is shut in the back (against crews it pays back in
11 days, all of it from the sneaks he still meets). At 500 / 3,000: the deadbolt 2.4 / 2.3 days, the floor safe 3.8 /
3.9, the dog 2.7 / 2.7, the sign 2.4 / 2.2 (bar **8 days**, kept); the door bar against crews **7.2** / 6.4 days
(bar proposed **10 days**: at 8 it would sit inside the 2-point margin); Cousin Earl +$10.0 / +$10.3 a day over his hire;
none worth buying for the quiet player (the dog −$2.0 a day: its food). The old reading (the floor safe against every
visitor: 9.2 days at 500, 9.7 at 3,000) is in "Marks of the first slice" above, as history.

**Mark 13** (the good neighbour against the burner, within 10%) read at 3,000 seasons: **10.4%** with the pocket and the
cutter (a fail). It is not the crews: crew.at 8, the crew's share 20% and its stock 0 each left it to the cent (500). It is
the Sixes: with them at rest it is 7%. The burner grabs tills and does stick-ups at the market, so he meets the tax and the
two on the kerb far more than the neighbour. The least painful new number: **a grab at their market +1, not +2**
(`sixes.raise.grab`): 13 is **8%** at 500 and at 3,000 (+pocket+cutter $113 against $105; every kit 1 to 8%). A lighter tax
(15%) did not do it (10%). S1 to S4 hold (they do not read the grab), S3 holds (0.5 / 3.0 / 0.1% apart). The older trust
numbers and mark 13's bar are untouched.

**S4's mattress row.** On the mattress (80% health) the door fight reads **30 / 55 / 63** (bare hands, the door bar, the
box cutter; 500) and 34 / 57 / 64 at 3,000, beside the rested 49 / 71 / 82 and 51 / 72 / 80. The door bar leaves the mattress player
above 45%: not retuned.

**The camera** was no rule bug. In ten-day seasons a camera with no laying low cut what crews took 17% because the
attempt it warns of lands a day later and the last of them fall past day 10; over twenty-day seasons it cuts nothing
($369 against $369 a ten days, 1.91 against 1.80 crews; 500). Its one job now says so: "It keeps nobody away and they
come as often: it is worth it only if you answer the warning." S2's camera reading is that ten-day window.

**On the page.** (1) Dutch's word: the hour's scene first, then the notice (`S.noticeAfter`, index.js). (2) The tax stop
and the two who wait for you are on the **market's kerb**, its way out to the subway (`kerb`, the place table's own spot:
places.json market ways.kerb), you walking there and staying there for the answer; the words say "on the kerb, on your way
to the subway". The market's own stairs are FIT ST's, 72 m off on Fit Street's block (places.json market ways.subway): a
scene there would be another block's, so the kerb stands for them. (3) The night's door fight is still shown the next
morning in daylight (the stage's time of day is the page's `tod`, set once on load: no night without new machinery); the
card says "Last night (day N), at your door" and the raid's line "Last night … came for your crib". (4) The texts: no step
above 8 is named anywhere (the config's unused `later` list is gone), "by the steps" is "on the kerb".

**The stage's `furniture` fault** (intermittent: a1 at Fit Street in run-places2, npc:buyer:market:4 at the flea market's
crate in the dealer's stage check). The common thread: an "open" spot given out on ground the city's collision world does
not hold yet. Arriving by the subway, the far place's columns load after its spots are given, so the test for something
low there (`lowNear`, `lowAt`) saw nothing, and the crate or the planter appeared under somebody already standing. Two
places in `demo/stage` now treat ground not loaded yet as not free: `director.js openGround` skips a spot whose ground (and
0.9 m round it) is not known; `index.js` stands' `blocked` answers 'unknown' there, and `stands.js spare` gives such ground
only when no known free ground is in reach. The dealer's stage check ran five times in a row clean (furniture 0 each).

**The furniture fault, third pass (it came back after join-2 d893d94, at the same spot).** It was not the spot. Logged
in the page: the buyer's stand was the market's `table:1` at (-45.5, 51.65), made on full-tier ground with nothing low
there, in every hour of every run, clean or failing. In the failing run her walk to it ended with its route's end at
(-45.5, 51.65) and no step aside on her (`wx`, `wz` 0), yet her body stood at (-45.78, 51.93): 0.4 m on past the mark
along her heading, the walk's **run-out** (`R.out`, actors.js: a walk is never stopped dead; in a frame it loses at
most half a metre a second). A long frame as she came up to the mark, at speed 4, ran her on into crate·1's column, and
the run-out is kept on the body for as long as it stands there: the whole drink scene. One run in several, because it
takes a long frame at that moment. The coordinator's lead was the other way a walker arrives beside its mark: a step
aside still on it (a lean held off somebody, sideways speed 0, so the "finish the step aside first" test, which looked
at the speed, let it arrive). Caught in the first run with the new count: `offLine npc:buyer:market:3 arrived 0.72 m
off its mark at -45.64, 38.73 (sideways 0.00, -0.72; its speed 0.00; aside 0.00, -0.72; lean true; settled 0.00 s; off
the lanes)`. Now, in actors.js's walk: a run-out stops where the next of it would be in something solid or low; at the
mark, a run-out and any step aside still on the walker are walked back on to the line before it arrives (`ending`:
weave gives no new step aside then), up to 4 s; a step back towards the line is never held by the solid/low test (it
was the one way a walker in a crate's edge could not get out). The audit's new `offLine` counts arrivals more than 5 cm
off the mark; run-stage prints it and fails on it. The lane case of the step-aside test (`!R.part?.G`) is left as it
was: the fault was never a step aside on a lane, and a low test there changes every sidewalk walker's weave. Proof:
the dealer's stage check 12 times in a row, run-ok, furniture 0, heads 0, offLine 0. Left open, not this change's:
`run-stage --policy park --seed 3 --days 3 --speed 4` fails on `heads a1|npc:mark:projects:2` (a mark `headRoom` steps
to half a metre from the player); it fails the same on d893d94 without this change.

**The full marks at 500 seasons** (3,429 s) with the second pass: **37 of 39 pass**. 12 fails, with the box cutter: both
places +9% against the bar's 10% (mattress +12%); the grab at +1 makes the taxed market a little better, and 12 has read
a point and a half either way at 500 before (it passed at 3,000 at +11.6%: "What styles-1 moved in the marks"). 15 fails
as before. Every other mark passes, P1, P3, 13 and H3 again, and S1 to S6.

**Out of this slice** (not built): the raid on your home at 9 and the siege at 10; the camps, the corners, turning Dutch,
the parley; guns at home and the gun rack; the apartment and every piece for it; a stash at home; the police with a
warrant; the panic button, the floodlight, the decoy, the dye pack, the fogger, the false wall and the big safe. The
paying of what you owe on the day of the jump (the design's third answer) is not built either: stay away, or go and win.


## The raid on your home (raid-1)

Added 2026-11-18 after the owner: "raids should play out like this too, like live action style and just resolves for
agents and it depends on what you have in/on your base ... maybe you get one decision up front and you pick your loadout
from inventory" · "i want it to feel like what you own is actually helping you" · "we need more things to buy that have
purpose ... So we need to scale" · "more crime related traps" · "differnt guns should do different things too" · "i dont
like safe bank, you should have to protect your assets at home" · "being a saint can't be the only path". And, while it
was built, "crafting is coming", and the owner's ruling on it: HOW OFTEN a raid comes follows what you DO (the rule the
game already has: trouble from what you do, never from what you own); HOW MANY come and WHAT THEY TAKE follow what you
HOLD at home, ONE sum over everything kept there, a table a later holding is added to. A crew that wins can knock a
station or a big piece out for a day or two (seen smashed, mended later), never take it; money, goods and stock can be
taken. Rules only; the page is a later job. The code: `src/run/raid.mjs` (the
rules), `src/fight/raid.mjs` (the fight), new blocks at the end of `step.mjs` and `view.mjs`, the marks' block at the end
of `marks.mjs`. Numbers in `src/run/config.mjs`: `sixes.raid`, `sixes.cap`, `sixes.push`, `sixesRaid`, `worth`, the
guns and the five pieces in `things` (`late: 'raid'`).

**What brings it.** The Sixes' meter, as before: what you do on their ground, never what you own. It now goes to **9**
(`sixes.cap`; the siege at 10 is not built). At their raid step the morning brings word: "the Sixes are coming for your
crib tomorrow night". The step is **9**, whatever your home is worth (how often follows what you do; while it was built a
home worth $1,400 or more was raided a step sooner, at 8: the owner ruled it out, and the 3,000-season readings below were
taken with it, the 500-season ones after it without). The meter gets there by defiance: refusing the tax (+2) and beating the two on the kerb (+2),
or grabbing tills there day after day. A player who pays, or who never works their market, is never raided (mark D1).
Not while a truce stands, not while one is due, not within `rest` (3) mornings of the last.

**What your home is worth (the WORTH meter).** `raid.mjs homeWorth`: one sum over `config.worth.entries`, each a kind
of holding and where the rules find it (`of`): cash banked, the goods kept at the crib at cost, and every thing a raid
can carry off or wreck (its `worth`, else its price: in this slice the guns). A workstation, ingredients, product or a
modified gun is one more row (and one line in `HOLDINGS` naming where it lives): the raid's logic does not change.
Hidden or not, it all counts: what they case is what they think is there. It decides how big a crew comes
(`worth.steps`: under $600 the small one, from $600 the bigger, from $1,400 the biggest) and what is at stake; never
whether or when they come. Shown as a third meter beside HOME and SIXES, **WORTH $1,240** with its slip: each row and its dollars, the crew
it would bring now and the next step ("At $1,400 the Sixes would send their biggest crew"), the things at risk and what
is hidden (the view's `worth`).

**Who comes.** Set the morning of the word: the size by worth, the crew by the run's dice among four (`sixesRaid.crews`),
told on the word's card ("4 of them: 3 heavies, a runner... heavies, all of them at once, straight at the door"), so the
loadout can answer it:

| Crew | Who, small / bigger / biggest | Where they come from | The gun that answers it |
|---|---|---|---|
| a rush at your door | 2 / 3 / 4 heavies (45 health, fists) | all at once, 6 to 8 m off, straight at the door | the Doorman |
| the quick ones | 3 / 4 / 5 runners (22 health, blades, fast) | strung out from every side, 7 to 15 m | the Chopper |
| shooters at the back | 1 / 1 / 2 heavies and 1 / 2 / 2 shooters (38 health, a junk pistol) | the heavies at the door, the shooters hang back by the fence | the Six-shot or the Chopper |
| big men | 1 / 2 / 3 big men (70 health, heavy jackets: 12 off every blow and shot) | walking across the lot, 14 to 20 m | the Long-eye |

**The one decision up front: the loadout.** From the word to the night you choose, with no hour, what is in your hands
(`state.holdWith`: a gun you own with rounds, or what you fight with; unset, the first gun you own with rounds, else what
you fight with), and the card says what each wins (`raid.mjs raidOdds`: each thing you could hold, Earl told each way or
hired, each piece you do not own); who stands with you (Cousin Earl, hired at the crib as ever, told his way); and whether
you are home: where you sleep that night (the crib: home; sleeping rough, the jail, the clinic: out). Then it plays itself.

**Home that night: the raid fight.** The crew's door fight made bigger (`src/fight/raid.mjs`, on `duel.mjs`'s fight of
several: why below): you at your door with what you hold, at the health a night's sleep gives (80% on the mattress, full
on the bed), Earl beside you if he is on, and each thing you own doing its own job, in the fight's own numbers:

- **the gun in your hands** fires by itself (its numbers are the fight's: `data.mjs WEAPONS`, untouched), its rounds all
  you own of them; run dry, you fight on with what you fight with;
- **the door bar**: the first one through is 20 down; **the pepper fogger**: they come in blind 3 s (slowed, no blow, no
  shot); **the stab vest**: every hit on you 30% less; **the guard dog** (fed) takes one on: the last of them, the one who
  hangs back if any, is 20 down before he is in it; **Cousin Earl** fights beside you, his way told.

Held: nothing taken; energy −1 off the morning (**held but hurt**, won with 30% of your health or less: −3); you go
through the pockets of each of them you put down ($10 to $25 each, banked); and **they leave you be for 7 days** (no tax,
nobody on the kerb, no raid: `sixes.truce`), the meter down to 4. **Knocked out and cleaned out**: you wake in the clinic
(its morning); they make you open up: 50% of what is banked (the floor safe does not help; the cereal box does, and the
decoy safe halves it), half the goods
at the crib (the false wall keeps them), the gun in your hands and its rounds, and each thing at risk by its own roll;
the meter down to 3 (their point made). **Not home**: Earl on the step first (the crew's contest), then the door (the
crew's kick: 90%, the chain and locks 75%); in, 30% of what is banked (the floor safe 20%), half the goods, each thing at
risk; the meter to 5. The door held: nothing taken, the meter stays, and they come again after the quiet mornings.

**Why the duel's fight of several, not the stop's waves.** The crew's door fight (S4: 50 / 70 / 80) is on the run's
terms: a blow lands 45% of the time, blows scaled by what you fight with, the brawl; fists, the box cutter and the punch
styles are calibrated there. The stop's waves (`createFight` with a level) land 93% of blows unscaled and would have made
a second, different scale for fights at your door. What the raid needed of the stop (a gun, its magazine and reload,
running dry, Earl's ways, the Doorman's cone, a shooter who keeps back) the sim already had; it is switched on in the
duel by fields that are absent from every older fight, so `node src/fight/table.mjs --seeds 200` and `node
scripts/duel-table.mjs` print exactly what they printed at 7ac5df7 (diffed). The additions to `src/fight/`: `duel.guns`
(a gun in your hands; a shooter of theirs, who keeps back as the stop's shooters do), `you.rounds`, `you.dry`,
`you.holdFire`, `you.cut`, `duel.blind`; in `brawl.mjs` a gun's reach is a fist's (it had none: the brawl could not stand
off a gun); `src/fight/raid.mjs` (your move: hold your door while any of them who hit with their hands is up, then go at
the shooters; with fists, the brawl).

**The guns** (`things`, each with `gun`: the fight's weapon; `ammo`: a box; `loud`; `holdFire`; `raid: { take: 50 }`):
every job is a table field, so a later bench can change a gun's job by changing its fields.

| Gun | Sold by, where | Price | Rounds | Its job | Loud |
|---|---|---|---|---|---|
| the Six-shot | Teo, the Jay St night market's back row | $150 | 12 for $12 | for anything: never bad, the best against nothing | +1 |
| the Doorman | Cousin Earl, at his truck in the trailer park | $220 | 6 shells for $15 | waits until they are on you (3.5 m), then each shell takes every one in front of it; no use against those who hang back | +1 |
| the Chopper | Big Lou, Low Tide Docks | $230 | 30 for $24 | fifteen at a pull: the quick ones from every side; hungry (about 17 rounds a night) | +2 |
| the Long-eye | Nadia Petrakis, Low Tide Docks | $200 | 5 for $15 | one hard shot after another as they cross the lot, through any jacket; poor once one is on you | +2 |

A gun is never in a one-on-one (the owner's call): it is held at your door when the Sixes come, nowhere else. Firing it
puts its `loud` on your own heat and on the trailer park's after the night's cooling ("it's loud so it draws cops"). Out
of rounds it is your fists. Beaten while holding it, it goes with them.

**Five more pieces, each one job** (`late: 'raid'`, listed after every older move: no older key moves; the art exists:
each is a drawn piece of the home kit that had no job):

| Piece | Sold by, where | Price | Its one job |
|---|---|---|---|
| a pepper fogger (`kit:pepper-fogger`) | Mr. Okafor, the market | $50 | home, they come through the door blind for 3 s |
| a stab vest (`kit:stab-vest`) | Mrs. Kowalski, the market's clothes rail | $40 | home, every hit on you 30% less |
| a cereal-box stash (`kit:stash-cereal`) | Gloria, the trailer park | $20 | the first $150 you bank is never found, by a sneak, a crew or the Sixes, even when they make you open up |
| a false wall (`kit:false-wall`) | Rosa, Low Tide Docks | $25 | the goods at the crib and two of the things at risk (the dearest) are never found, by a crew or the Sixes |
| a decoy safe (`kit:decoy-safe`) | Mr. Pruitt, the yard sale | $60 | home and beaten by the Sixes, you open the decoy: they take half what they would have |

(A police scanner, halving the heat of gunfire, was the fifth at first: a night of firing is one or two heat a season and
halving it paid nothing measurable, −$1.1 a day at 500 seasons. The decoy safe took its place. The fogger was 2 s and $70,
the vest $80, the false wall $150, the Chopper $300 and the Long-eye $260 at first: tuned on marks D2 and D4, below. The
false wall does not pay for itself in this slice and is not judged by D4: what it hides today, a few sales of stock and
the guns you are not holding, is little (the pressured home-first player with the bed loses 5.4 sales of stock in
fourteen days without it, 4.2 with it: +$0.1 a day; the armed player with all four guns +$0.8). It is the hiding place
for what crafting will bring home: product, ingredients, a modified gun.)

**Things in a raid, by one rule.** Three ways: a thing's `raid: { take: pct }` (carried off that often by whoever gets
in; its `worth`, else its price, counts in WORTH), `raid: { out: days, pct }` (knocked out that often for that many days:
`state.home.out`, its last day out; it does nothing until mended, `rules.mjs isOut`, and is never taken: stations and big
pieces), or no `raid` (neither). In this slice the guns are taken; the door bar (a day) and the camera (two days) are
knocked out, each half the time they get in. A hiding place's `hides: { cash, goods, things }`:
dollars never found, the goods never taken, that many things at risk never found (the dearest first; never the one in
your hands). Only what can be taken can be hidden. Only the cereal box and the false wall hide; a workstation (knocked out) or a batch
of product (taken) is a table entry. The first slice's pieces are unchanged; the crew and the sneak also never find the
cereal box's cash, and the crew never takes what is behind the false wall.

**The Sixes push** (`sixes.push`). The longer you keep working their market, the bigger their cut: a fifth the first day
they stop you for it, **10 points more each day in a row** they stop you, at most **half**; a day they do not starts it
again. Dutch says so ("Two fifths: 3 days running you've worked my market"). The slip shows the run of days and
tomorrow's cut. Paying stays a road (it costs more the longer you stay), refusing is the other (it brings the raid), and
working other ground is the way out of both.

**Seen** (the page, later; the rules' notes to it): the word (`sixes` event `what: 'raidWarned'`: the night, the crew and
how many of each, the worth they saw, `scene: { notice: true, sixesRaid: true }`); the view's `raid` (the raid due, what
you hold and its odds, each thing you could hold with its key, your guns and rounds and where each is sold, the pieces,
the truce, the raids so far) and `worth` (the meter); the moves `{ do: 'get', item }` for the guns and pieces where they
are sold, `{ do: 'ammo', item }` for a box, `{ do: 'holdWith', with }` (kind 'set', no hour); the night (`raid` event with
`kind: 'sixes'`: `home`, `how` door / guard / away, `outcome` held / hurt / beaten / taken, the fight `duel` with its
inputs and seed to play it again, `spent`, `taken`, `goodsTaken`, `thingsTaken`, `thingsOut` (each with its days and last day out), `lostGun`, `hidden`,
`spoils`, `heat`, `truce`; the scene `fight:fail` / `fight:clean` with `sixesRaid: true`, or a break-in); the tax's `pct`
and `streak`.

**Saves.** State version **12** adds `ammo` (gun → rounds), `holdWith`, in `sixes` the push (`streak`, `streakDay`), the
raid due (`raid`), the raids so far (`raids`), the truce (`truce`) and the last raid's night (`raidLast`), and
`books.ammo`. `loadRun` reads a version-11 save (and 10, 9, 8 through it) as no rounds, nothing held, nothing begun.

**The scripted players** (`policies.mjs`): `armed` (the market's crime player who refuses the tax, holds whatever the
raid card says wins most, buys rounds where they are sold when under a box), `handsOnly` (refuses, meets it with what it
fights with and its pieces, hires Earl the day a raid is due), `moved` (works Glasswall Plaza while the Sixes are at 5 or
more, their market otherwise), and the payer (`taxPayer`). The kits: guns with three boxes of rounds; the hands-only
player's door bar, fogger, vest and cereal box.

**The odds the card shows** (`raid.mjs raidChance`, a sample of `sixesRaid.sample` (200) fights at the same inputs, kept
by the inputs; `raidOdds` the comparisons). The view carries only what you hold now; the comparisons are a call the page
makes when the card opens. Both are for the background path the other sampled odds are moving to.

### Marks of the raid (raid-1)

`node scripts/run-marks.mjs --raid` (fourteen-day seasons: the raid comes to a refuser about once in one; every player
the market's crime player, home at $120, with the box cutter; pieces and guns are kits, owned from the start with three
boxes of rounds, their price in the payback, not in the day). The bars were set from the 3,000-season readings with
margin: the payback bar was 14 days and is **16** (the Chopper read 12.0 / 12.7 days and the fogger 11.6 / 13.4 at 500 /
3,000: within 2 of 14). The 3,000 readings were taken while a home worth $1,400 or more was raided a step sooner (8); the
owner ruled that out (how often follows what you do) and the 500 readings after it are the same to within a dollar
(rarely did that step decide anything).

| Mark | 500 (final rules) | 3,000 (the step sooner still in) |
|---|---|---|
| D1 the raid comes for the defiant, not the quiet: a refuser 0.5+ raids in 14 days, the payer under 0.25, the mover, the stall, the quiet none | refuser 1.36 (held 0.14 of 1.15 at home, $495 taken), payer 0.10, the rest 0 | 1.33 (0.15 of 1.14, $480), 0.09, 0 |
| D2 each gun pays back within 16 days for the armed refuser (against the same with no gun, $53.4 / $54.8 a day) | Six-shot 8.7 days, Doorman 9.1, Chopper 12.0, Long-eye 10.3 | 8.7, 9.5, 12.7, 11.7 |
| D3 no gun the answer to everything: of four crews (middle size, the mattress, nothing else) 3+ guns are each the best against one, every gun within 5 of the best against one | rush: Doorman 93; quick ones: Chopper 90; shooters: Chopper 97 (Six-shot 93); big men: Long-eye 93 | the same within 2 |
| D4 each piece pays back within 16 days as the hands-only player's first buy (bare: $62.5 / $63.7) | fogger 11.6, vest 10.7, cereal box 5.6, decoy safe 6.2; the false wall not judged (39 days) | 13.4, 10.7, 5.8, 6.3; (81) |
| D5 what you own helps (a rush of three, the box cutter, the mattress): each piece +3 or more, all +30 or more | nothing 16; bar +14, fogger +10, vest +26, dog +10, Earl +49; all 98 | 16; +16, +9, +26, +9, +48; 98 |
| D6 several ways to play within 25% a day: payer, armed (his best gun), hands-only (four pieces), moved away | $83.7, $80.8 (Doorman), $73.8, $88.3: 16.5% | $84.6, $81.0, $75.1, $89.5: 16.1% |

Beside them: the refuser who does nothing about it $53.4 a day (−36% on the payer: refusing without answering the raid is
the poor road; S3, restated below); the hands-only player with no piece $62.5. The armed players hold their raids 53 to
65% of the time (each gun lost 0.26 to 0.42 times a season), fire 5 to 17 rounds a season and take +0.9 to +1.8 heat.

**What the raid moved in the older marks** (`node scripts/run-marks.mjs --seeds 500`, the full set, 6,667 s; against
the second pass's 37 of 39, the same three failing before this slice's fix to the tally, H4, below): **42 of 45 pass**
(D1 to D6 pass). 12 fails at 500 as it did in the second pass (both places with the box cutter +9%, the bar 10%; it
passes at 3,000), 15 fails as before. **H4** read one pair of attempts on the same day: a home-pressure attempt and the
Sixes' raid on one night, counted in one tally; the Sixes' raids are tallied apart now (`playSeason`), and `--home` at
500 reads 8 of 8 (H4: 14,649 attempts in 10,000 runs, the closest two 3 days apart; 1,352 s). **S3 is restated**: refusing now brings the raid, so the refuser who never answers it banks under
the payer, 31.0 / 30.8 / 17.9% (mattress, cutter, bed; it was 0.5 / 3.0 / 0.1%): the bar was "within 10%", it is now
"under the payer, by no more than 40%" (`S3_UNDER`), and the refuser who defends is D6's. **S5 and S6 with the push**:
S5 3.2 / 4.8 / 2.5% (was 2.9 / 3.7 / 2.4), S6 +0.4 / −3.2 / −0.9% (was +0.1 / −4.3 / −0.9): the market's best player,
home at $60 to $160 in six-day seasons, is stopped by Dutch on one market day in two and rarely two days running, so the
push hardly reaches him; it is the player who keeps at their market who pays it, and the player who moves away (D6) banks
5% more than the payer. P1 to P5, H1 to H3 and H5 to H8, R1 to R4, S1, S2, S4 and 1 to 11, 13, 14, 16 pass, within a
dollar or two of the second pass.

### On the page (raid-page)

Added 2026-11-19: the raid seen and played, the rules untouched (nothing in `src/` decides anything new: the raid's odds
moved to the background path, `src/run/odds.mjs` counting a raid's fight by the very loop `raidChance` played, the same
seeds, and "3 heavys" is "3 heavies"). The page's parts are `demo/run/raid.js`; the wiring is `demo/run/index.js`.

- **The word.** The morning the Sixes send word, a notice: "The Sixes come tomorrow night", how many and of what
  ("3 of them: 3 heavies"), how they come, what that crew is weak to in plain words (`raid.js WEAK`: the rush the
  Doorman, the quick ones the Chopper, the shooters the Six-shot or the Chopper, the big men the Long-eye) and the worth
  they saw; its button **Your door (Y)**. A press on it opens the card of the one decision. While a raid is due a
  chip on your numbers says when ("The Sixes come tonight: 3 of them") and opens the card.
- **The WORTH meter**, beside HOME and SIXES on your numbers, once the Sixes care about you or a raid is due:
  **Worth $1,232**, under it the crew it brings or "they come tonight". A press opens its slip: each row and its
  dollars, who it brings at each step (under $600, from $600, from $1,400, the step it is at now marked), the things
  they can carry off (hidden ones said hidden), and what the cereal box and the false wall keep.
- **The card of the one decision** (Y, the notice's button, the chip). (raidfight-5: titles first. The owner's rule for
  screens, "can just be the title, then once you click it, it brings up the info", and a friend who played: the
  interface "still lacks clarity".) **Up front, only what decides the night:** who comes and how many, how they come,
  and what that crew is weak to; **in your hands**, a button for each thing you could hold (your hands, a blade, each
  gun you own with rounds) with its rounds and its odds "N in 10", the one held marked (a press holds it: the rules'
  `holdWith`, or `fightWith` with no gun); **home or out**, a line each with its odds (home: you hold them, sleep at your
  crib; out: your door holds, sleep anywhere else); **who stands with you**: Earl told his way (a button each, with its
  odds), or alone with what Earl beside you would make it and Hire Earl. **Everything else is kept, folded under a
  short title** that a press opens (or Tab to it and Enter), and that is shut again each time the card is opened:
  **If they beat you** (at home: every loss in dollars and chances, the clinic, the share of what is banked after the
  cereal box and the decoy safe, the goods at the crib, the gun in your hands, each thing at risk at its own chance,
  each door piece's chance of being smashed; out and they get in: what they take, and Earl on the step first), **If you
  hold them** (their pockets and the truce), **What would help, and where to get it** (each piece for the night you do
  not own, its odds, price and seller; guns you own with no rounds and where a box is sold; guns not yours, their
  price and seller; what Earl costs, or why he cannot be hired). One way of saying a chance on the whole card: "N in 10"
  (a thing at risk was "25 in 100": now "3 in 10"; the rules' figures are the same, only said one way). Every figure is
  `raid.mjs raidOdds`, sampled by the page's odds workers; "…" until it arrives; the card is only up while you choose
  (never over a scene). Esc or × folds it.
- **The night.** Asleep at your crib on the night, the scene comes first, then the night's report. Under the black
  you are put out on your porch at the hour you went to bed (the stage's night light; while the raid plays, the night
  look the owner chose, raidfight-5: the porch lamp over your door and the stage's clock set back to 19:00 for a dusk
  light over the whole yard, put back however the scene ends; your numbers keep the run's own hour) and the raid is played at your
  door by the fight page's scene (`demo/run/raidfight.js`, `docs/animation/raid-fight.md`): the rules' own raid (the
  event's `duel`, `src/fight/raid.mjs startRaid`, `raidMove`) stepped tick for tick and drawn, the crew's bodies its
  own (made and taken off under the black), every loadout (each gun, bare hands, a blade; Cousin Earl beside you or
  not) and every crew; a raid seen to end otherwise than the rules said is a fault in its record. Space, Enter or its
  Skip end it at once, to the same result. While it plays your numbers, the journal and the bottom row still say the
  evening (the reveal waits for the scene). It ends under the black, and over it
  - **the night's card**: held or beaten, and each thing it cost or won, a line each (the fight and the rounds
    fired, Earl, their pockets and banked now, the truce and its last day, the energy, the clinic, the dollars taken and
    banked now, the goods, the gun in your hands with its rounds, each thing taken, each piece smashed and the day it
    works again, what they never found, the heat of the shots, the meter). Then each where it lives: the money and the
    goods at home on your numbers; beaten, the cut to the clinic under the report (the rules have you out of it and
    home by the morning); the gun gone from the card's hands and back on its list of guns to buy, with its seller; a
    smashed piece off its place in the trailer (the door bar off the door, the camera off the wall) and "smashed: no
    use until day N" on the HOME slip; held, **a notice of the week's truce and its last day**, and "truce till day N"
    on the Sixes' meter. Out for the night, the notice says at once how it went and the same card is seen when you next
    come home.
- **The shops.** The four guns and the five pieces are the rules' `get` moves where each is sold: Shop (B) there, each
  on the shelf with its picture from the run's library (`kit:six-shot`, `kit:double-barrel`, `kit:chopper`,
  `kit:long-rifle`, `kit:pepper-fogger`, `kit:stab-vest`, `kit:stash-cereal`, `kit:false-wall`, `kit:decoy-safe`: all
  drawn already), a gun "held at your door"; a box of rounds for a gun you own (`ammo`) in the same list where its
  seller stands. Bought, each is placed in the trailer (the tray). The Library (L) and Ahead (U) list each with its
  seller and place.
- **Dutch's cut** on every job card at their market while they tax you: "Dutch's cut 40% · a day away: 20%" (the first
  day "Dutch's cut 20% · +10 each day running"), the whole of it in its tooltip.
- **Saves.** A version-11 save (the code before the raid) loads as version 12 by the rules' own reading
  (`loadRun`): no rounds, nothing held, nothing begun; `test/fixtures/run-save-v11.json` is one, made by the code of
  cf99e40^, and the check loads it in the page.

**The raid scene, wired in** (it was a seam for the gun fight until the fight page's raid landed, raid-fight 056d230,
merged): `index.js raidNight` makes nothing of its own; it calls, once per night at home,

    const raidFight = createRaidFight({ stage, root });                 // once, beside the fights'
    await raidFight.play({ raid: e.duel, you: YOU, ally: e.duel.earl ? GUARD : null, pad: YOU, dark: true });

under the black it has put up, and lifts the black itself after the card (and the clinic's cut). Space and Enter go to
`raidFight.skip()` while `raidFight.active`. The plain beat and the duel-based staging that stood in for it before are
gone: the scene plays every loadout and every crew (`raid.js staging` answers 'scene', or 'none' when you were out).

**The check:** `node demo/serve.mjs --port 5505 --quiet`, then `HK2_DEBUG_PORT=5770 node demo/tools/run-raid.mjs
--port 5505 --out <dir>` (`--only rush,…`, `--headless`). It finds with the engine the evening before the word and a
night the raid is due for each of the four crews, loads each in the page and plays it with real keys and a real mouse:
a gun bought from its seller and its rounds, a piece bought and seen placed, the Library and Ahead saying where each is
had; the word's notice (who, how many, weak to) and the card opened from its button with its odds; a press on WORTH and its slip;
on each night every thing you could hold pressed and its odds arriving (first with the workers held: "…" drawn, nothing
waits), the card's folds shut at first and what they hold not shown, then each opened with a real mouse press and read
(raidfight-5), to bed, the raid at your door (bare hands, the Six-shot, the Long-eye with Earl), its card and each consequence
where it lives; Dutch's cut on a job
card; a version-11 save loaded. It fails on a page error, a card that never gets its odds, a frame over 100 ms while
the card is open, a raid seen to end otherwise than the rules said (the scene's `mismatch`) or with a frame fault,
control not back within 5 s of the scene's end, a state not the headless one, a consequence not on screen. Pictures: `docs/shots/raid/`.

### The apartment (proposed, not built)

A second home, on paper: what the owner approved as "the apartment as a second home with two ways in". Numbers
proposed, nothing built.

- **Where.** The city's own apartment block on the market's side of the line (a block of `src/map.mjs` to be picked with
  the owner: the page shows it), one subway ride from the trailer park and from the market. A second `home: true` place
  with its own street (`inside`): the rules already read a home from the config, so the work is a second home, not new
  rules for the first.
- **What unlocks it.** WORTH at $1,400 or more on three mornings (you have outgrown the trailer: the owner's "run out of
  space"), and nobody of the building against you (its super is a person with trust, as Earl is).
- **What it costs.** $400 to get in (a month up front and a deposit, from banked) and $25 a day rent, from banked every
  morning (two days unpaid and you are out, the deposit kept). The trailer stays yours: rent is the price of a second
  door.
- **What it gives over the trailer.** Space: the full library's bigger pieces fit (the lock-up, the big safe, the gilded
  frame are NOFIT in the trailer today); a home pressure of its own, starting at 0 (a new street, new neighbours); the
  market's side of the line, an hour nearer the docks and the plaza. A bed comes with it.
- **Two ways in: the front door and the fire escape.** A raid on the apartment comes from both: the crew is split in two
  groups (the fight's `around` already places each of them; a second door is a second group at another angle). What it does
  to the guns: the Doorman covers one way only; the Long-eye has the long hall; the Chopper and the Six-shot have to turn.
  What it does to the pieces: the door bar and the fogger work on one way each (one of each per door, so two to cover
  both); the vest, the dog and Earl go where you are; Earl told "one at a time" holds the second way. A sneak while you are
  out tries the easier way: the chain and locks on both, or the fire escape is his.
- **New pieces it would want** (each one job, crime-flavoured, drawn already): a scissor gate (`kit:gate-scissor`) on the
  fire escape, the second way's door bar; a motion floodlight (`kit:motion-flood`) on the fire escape, they come in lit
  (your guns' far shots true); a big safe (`kit:safe-big`, too big for the trailer): its share while you are home and
  beaten too (the only safe that does not open when they make you); a safe behind a painting (`kit:safe-painting`): a
  hiding place for one thing at risk and $300; a decoy safe (`kit:decoy-safe`): whoever gets in takes the decoy and leaves
  (one roll: the share halved).
- **What moves with you.** Banked cash (you carry it over: the subway's danger on the way, or it moves in the night for
  $20, a man with a van); goods; guns and their rounds; the punch styles; Earl's stretch (he will watch one door, not two:
  his step is the trailer's unless hired for the apartment). Pieces bolted in (the floor safe, the door bar, the camera, the
  false wall) stay where they are: a second set for the second home. WORTH is each home's own: the Sixes raid the richer.


## Adding a place

A place is one entry under `places` in `src/run/config.mjs`; no rule names a place (`test/run-places.test.mjs` adds the
docks this way, plays a three-place city on them and checks that `rules.mjs`, `step.mjs`, `view.mjs`, `state.mjs` and
`ledger.mjs` name no place). Write:

1. `label`, `where` ("on the docks": how sentences say you are there), `block` and `spot` (a block of `src/map.mjs`,
   for the stage).
2. `tier`: `quiet`, `rough`, `mean` or (batch-1) `watched`, the plaza's (or a new row in `tiers`). The tier sets the level of everything: pay (× 1, 2,
   3: jobs, robbing, the bins), jumping (× 0, 1, 1.5 on the chances, +0/+0/+10 strength), whether the police patrol it
   or come only when it is hot, how much a robbery heats it, how fast it cools, and the chance of being robbed asleep.
3. `jobs`: one `safe: true` (always dealt, goes round its people) and the rest; each with `label`, `named` ("{who}"),
   `role`, `with`, `odds`, `base` pay (before the tier), `winHeat`/`failHeat`/`failEnergy`, `needs` (an item), `mood`
   and `trust` on win and fail (how it moves its person's trust: "Trust"), and `scene` (how it plays: a kind or an action
   the stage has).
4. `people`: { id, name, role } for every role a job needs, and `regular: true` for an easy sale who keeps count;
   since styles-1 a `style` (a key of `src/fight/data.mjs` RIVALS: how they fight you one-on-one; none, the plain brawler).
5. `supply`: any of `strangers` (robbing somebody passing is there), `bins` (the bins are there), `custom` (a regular's),
   each { max, refill }. `binsSeen` if someone there minds you in the bins.
6. `shop`: [] or errands { item, label, kind: 'food', price, does, perDay, gives, keeper (a person's id), spot }.
   Since goods-1 also: `connect: { who, spot }` (a person of the place with `role: 'connect'`), an entry under the
   top-level `goods` with `at` this place, a selling job's `goods: { good: base pay }`, and any `things` with `at` this
   place ("Goods, the connect and errands").
7. `links`: { otherPlace: { via: 'subway' } } (a link may give its own `fare`, `hours`, `energy`), and the same link
   back in the other place's entry. Since batch-1: link a new place to the place your crib opens onto (two rides is a
   dead place on 6 energy, measured), and mark that link `late: true` so its ride is listed after every older move and
   no older key changes. `door: 'crib'` only for the place your crib opens onto (then you go inside there
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

## The named cast on stage (named-1)

The city's own pool of its named people (`city/from-trunk/world/named/`, pinned at trunk `d5a6e64`: each person's own
face, hair, clothes, the thing they carry and their `scale`, 0.85 to 1.3) dresses the game's named people by name. Nothing
of the rules changed: who is who is the stage's (`demo/run/scenes.js` `NAMED`, by the people's ids).

- **By name**: a named person wears their own pieces only, nothing of their role's (`demo/stage/index.js` begin; the fight
  page's Cousin Earl and Big Moss, the raid's Cousin Earl). Everyone else keeps their role's look. `?named=0` shows the
  game as it was (the stand-ins, all at size 1), for before and after.
- **At their size**: the size goes into each walker's instance as the city writes it every frame (`actors.js`
  `sizeBatch`: the matrix times the size about the feet, near, mid and far, the shadow with it); the gait strides by
  the distance over the size (no slide); the head, the name tag, the bubble, a clip's prop at the size; a seated body
  lifted or lowered onto its seat, a leaning one stood off its wall.
- **Two bodies at their sizes**: the director's gap for two is the mean of their sizes; the hand-overs were written for
  sizes (`hands/perform.js` reads `actors.scaleOf`); the run's fights are staged at each body's size (`fight/puppet/`
  `choreo.js` reach, heads and distances, `body.js` and `feet.js` the pose over the planted feet, `fighter.js` its points);
  the gunner's points (the raid, the fight page) at the size.
- **What goes about with them**: `demo/stage/props/along.js`, the one place a named person's own thing is put beside them
  each frame (the cart man's cart: pushed ahead in both fists on a walk of his own, parked beside him otherwise).
- **Looks baked before play**: at the stage's begin (and the fight page's mount for Big Moss and Earl: `actors.prebake`).
- Tools: `demo/tools/cast-lineup.mjs` (the lineup at the game's camera), `cart-shots.mjs`, `cast-frames.mjs` (their first
  frames on screen), `fight-sizes.mjs` (the run's fights staged at 0.9 to 1.25, headless), `fight-film.mjs lift:…` (Big
  Lou's fight), `hand-film.mjs --who --qs`. Pictures: `docs/shots/cast/`.

## Names

**Called by the buildings they are (batch-1, text only).** The flea market is the city's own Jay St night market (the
stage's `market` block is that lot): the player reads "the Jay St night market" (`places.market.label`, the map's
"Jay St night market"). Mr. Pruitt's yard sale is the swap meet (the stalls in the yards of Sunny Acres): "swap meet"
where the page names the spot. The debt job's park manager works out of the park's office and has a name, Darlene: "Collect
a debt from Benny Two-Coats for Darlene at the office". Ids, keys, spots (`market`, `yard-sale`, `collect`) and saves
are as they were; the earlier sections of this page keep the words they were written with.

Nothing here is named after Rust's items. "Mattress" stands in for "sleeping bag", which is one of Rust's own item
names; slime's call whether that matters for an everyday word. The people have everyday names, none from Rust. The
things that defend your home (home-1) are a deadbolt, a floor safe and a neighbour on your step: hardware-store words,
not a game's ("code lock", "tool cupboard", "turret" are not used).

## Parked

Co-op. Raiding other players' cribs. Skills that rise by use (three at most). A talk verb beyond "ask for work",
"haggle" and "talk your way out". Rent. Hired crew (three at most; the guard of home-1 is one hire, no more). Moving to a
bigger home, which pushes you deeper into the city (slime's "run out of space": it needs a second home on the map). The agent
running trips by your rule. The corner and the Sixes. A week-long season and what survives a wipe.
