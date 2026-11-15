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

Rent, raids on the crib, the safe and the lock, crew, the agent playing for you, the corner and the gang, other
players, skills, a season and a wipe.

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
12. **Both places beat one.** Playing both places against the better single place, by 10%+, neither single place under
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
6. `shop`: [] or items { item, label, price, does, perDay, gives }.
7. `links`: { otherPlace: { via: 'subway' } } (a link may give its own `fare`, `hours`, `energy`), and the same link
   back in the other place's entry. `door: 'crib'` only for the place your crib opens onto (then you go inside there
   and do not sleep rough); `onlySafe` for the worked-dry line; `locked: 'why'` to show it shut.
8. Add it to `subwayStops` if the map should show it on the line.

Nothing else: the deal, the people, the danger, heat, police, the street moves, sleeping rough, the dry line and the way
on, the view and the terminal all read the entry.

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

The old rules (`src/*.mjs`, the ten seats and their classes) are untouched and still run.

## Names

Nothing here is named after Rust's items. "Mattress" stands in for "sleeping bag", which is one of Rust's own item
names; slime's call whether that matters for an everyday word. The people have everyday names, none from Rust.

## Parked

Co-op. Raiding other players' cribs. Skills that rise by use (three at most). A talk verb beyond "ask for work",
"haggle" and "talk your way out". Night raids, rent, the safe, the lock. Hired crew (three at most). The agent
running trips by your rule. The corner and the Sixes. A week-long season and what survives a wipe.
