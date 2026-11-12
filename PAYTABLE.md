# The pay table

Dollars an hour for every class, worked out from `src/config.mjs` by `node scripts/paytable.mjs`. Re-run it after every change to the numbers.
It is arithmetic, not a simulation: one agent of each class playing a plain, competent day, trading with the others at the usual prices.

## What each class earns

| Class | Line | A day | An hour | How |
|---|---|---:|---:|---|
| smuggler | run chems to the cook, Haul 0 | $176 | $14.7 | 8 runs of 1, 2 moves home, 2 back: 8 chems a day. Sold to the cook at $33, bought at the docks for $88 (the dearer half of the day's stock). |
| smuggler | run chems to the cook, Haul 2 | $456 | $38 | 8 runs of 3, 2 moves home, 2 back: 24 chems a day. Sold to the cook at $33, bought at the docks for $336 (the dearer half of the day's stock). |
| smuggler | *safe grind: sell chems to the fence* | $-66 | $-5.5 | 18 chems a day at the fence's $7, bought for $192. |
| cook | cook quality 3 for the dealers | $155 | $12.9 | 12 batches from the 48 chems two Haul 2 smugglers bring: 72 units, less 6% blown up. Chems at $33, product sold at $20. |
| cook | *safe grind: sell everything to the fence* | $-376 | $-31.3 | The same 72 units at the fence's $12. |
| dealer | sell the cook's quality 3, first pick of the blocks | $704 | $58.7 | 24 units bought at $20: uptown 3h (12 for $616), park 2h (8 for $380), bar 1h (4 for $188). $49.3 a unit on the street. |
| dealer | sell the cook's quality 3, after the other dealer | $607 | $50.6 | 24 units on the demand the first dealer left: bar 3h (12 for $426), park 1h (4 for $212), uptown 2h (8 for $449). $45.3 a unit. |
| dealer | *safe grind: buy quality 1 from the fence* | $-116 | $-9.7 | 20 units at the fence's $40: uptown 2h (8 for $304), park 3h (8 for $255), bar 1h (4 for $125). Each one has a 30% chance of an angry buyer. |
| gunrunner | build guns, sell to players and the street | $216 | $18 | 4 guns from 12 parts at $24. 2 to players at $160, 2 at the bar for $140 with a 15% sting each. 10 hours. |
| gunrunner | *safe grind: fence parts in, fence guns out* | $-160 | $-13.3 | 4 guns at the fence's $50, parts at the fence's $30. |
| robber | rob carriers, Ambush 2, bare hands | $295 | $24.6 | 2.1 attempts a day at P 60 (clean 40%, messy 20%, fail 20%, disaster 20%): half on a dealer mid-shift ($253 each), half on a smuggler with a load ($32). Each costs the hour, 0.8 hours lost, two finding the target and two lying low. |
| robber | rob carriers, Ambush 2 and a gun | $429 | $35.7 | 2.2 attempts a day at P 75 (clean 55%, messy 20%, fail 20%, disaster 5%): half on a dealer mid-shift ($342 each), half on a smuggler with a load ($51). Each costs the hour, 0.5 hours lost, two finding the target and two lying low. |
| robber | *safe grind: case and never rob* | $0 | $0 | Casing pays nothing by itself. |
| muscle | protect a client, patrol in between | $212 | $17.7 | 7 hours under contract at $28, 4 on patrol at $4, one walking. Collections (a 20% fee) and bounties come on top. |
| muscle | *safe grind: patrol for the shopkeepers* | $44 | $3.7 | 11 hours at $4. |
| informant | watch, and sell tips to players | $290 | $24.2 | 8 watches make 16 tips; 4 sell at $55 and one crime goes to the police for $70. Selling one tip twice doubles it. |
| informant | *safe grind: only sell crimes to the police* | $140 | $11.7 | About 2 crimes a day witnessed and unsold, at $70. The police pay for each crime once. |

- A smuggler running parts instead: 8 a day sold at $24 is $64 a day, against $176 for chems.

## The city's books for one day

- Street buyers pay the two dealers **$2271** for 72 units cooked from 48 chems.
- The docks take **$600** for the chems.
- That leaves **$1671** for the five chain seats, about $334 each. The robbers, the muscle and the informant live off it.
- Rent is $25, $35, $45, $55 over the 4 nights: $160 a seat for the season.

## What one robbery is worth

| Robber | Target | P | Clean | Messy | Fail | Disaster | A clean win takes | Worth | Hours lost |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Ambush 2, bare hands | a dealer mid-shift | 60 | 40% | 20% | 20% | 20% | $571 | $253 | 0.8 |
| Ambush 2, bare hands | a smuggler walking a load | 60 | 40% | 20% | 20% | 20% | $100 | $32 | 0.8 |
| Ambush 2, bare hands | someone carrying $100 and no goods | 60 | 40% | 20% | 20% | 20% | $60 | $19 | 0.8 |
| Ambush 2 and a gun | a dealer mid-shift | 75 | 55% | 20% | 20% | 5% | $571 | $342 | 0.5 |
| Ambush 2 and a gun | a smuggler walking a load | 75 | 55% | 20% | 20% | 5% | $100 | $51 | 0.5 |
| Ambush 2 and a gun | someone carrying $100 and no goods | 75 | 55% | 20% | 20% | 5% | $60 | $32 | 0.5 |
| Ambush 2, a gun and a tip | a dealer mid-shift | 90 | 70% | 20% | 10% | 0% | $571 | $431 | 0.3 |
| Ambush 2, a gun and a tip | a smuggler walking a load | 90 | 70% | 20% | 10% | 0% | $100 | $69 | 0.3 |
| Ambush 2, a gun and a tip | someone carrying $100 and no goods | 90 | 70% | 20% | 10% | 0% | $60 | $44 | 0.3 |

## The five rules

1. PASS: Every class's trade clears the dearest night's rent ($55) with room to grow (at least twice over).
   smuggler $176, cook $155, dealer $607, gunrunner $216, robber $295, muscle $212, informant $290
2. PASS: Every deal between players beats the same deal with an NPC, for both sides.
   chems: fence pays $7, players $33, fence charges $46. q1 product: fence pays $4, players $14, fence charges $40. guns: fence pays $50, the street $140, players $160, the shop charges $220. guarding: shopkeepers $4 an hour, players $28. crimes: police $70, players $85.
3. PASS: No class's safe grind pays more than half its trade.
   smuggler grind $-66 against $176, cook grind $-376 against $155, dealer grind $-116 against $607, gunrunner grind $-160 against $216, robber grind $0 against $295, muscle grind $44 against $212, informant grind $140 against $290
4. PASS: A robbery of a typical carrier is worth more than an hour of the robber's next-best work.
   Ambush 2, bare hands: $253, Ambush 2 and a gun: $342, Ambush 2, a gun and a tip: $431
5. PASS: The courier is worse than walking unless the walk costs more than two hours.
   The courier takes $165 on a dealer's usual $660 buy; an hour of a dealer's work is worth about $51.
