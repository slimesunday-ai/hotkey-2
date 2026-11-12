// What bots say (SPEC section 14). At least 15 lines per situation, and no bot uses the same line twice in a row.
// Bots only play the free tuning runs: any season meant to be watched has an AI in every seat, because canned lines
// are what made the last storyboard feel fake. These exist so the bot seasons read like something on the page.

import { rng } from './rng.mjs';

export const SITUATIONS = Object.freeze(['selling', 'robbed', 'robbing', 'guarding', 'broke', 'winning']);

export const LINES = Object.freeze({
  selling: [
    'Price is the price. Take it or walk.', 'Fresh today. You know where to find me.', "I'm open. Who's buying?", 'Same as yesterday, only better.',
    'Cash first, then we talk.', "Don't crowd me. One at a time.", 'You want the good stuff, you come to me.', 'Quick and quiet, that is how this works.',
    'I have what you need and I am not here long.', 'Tell your friends. Not the loud ones.', 'No credit. Not today, not for you.', 'Count it in front of me.',
    'Moving fast today. Keep up.', 'Last of this batch. After that you wait.', 'Business is business. Next.', 'Good hour. Keep them coming.',
  ],
  robbed: [
    'I know your face now.', 'Enjoy it. You will not have it long.', 'That was a mistake, and you made it with me.', 'Everybody saw that. Everybody.',
    'You just bought yourself a problem.', 'I will be seeing you. Soon.', 'Keep looking over your shoulder.', 'You think that was the end of it?',
    'Somebody is going to pay for that. Guess who.', 'I am not calling anyone. I am coming myself.', 'Spend it quick.', 'That one goes on your account.',
    'You picked the wrong pocket.', 'Fine. Now I know how you play.', 'I have a long memory and a short list.', 'Walk fast.',
  ],
  robbing: [
    'Empty your pockets. Slowly.', 'Nothing personal. Hand it over.', 'You carry too much. Let me help.', "Don't make this harder than it is.",
    'That is mine now.', 'Wrong block, wrong hour.', 'Easy. Nobody needs the clinic today.', 'I have been watching you all afternoon.',
    'You should have stashed it.', 'Look at me. Now look at your pockets.', 'I will take the lot.', 'Thanks for carrying it this far.',
    'Somebody told me you were holding.', 'Be smart about this.', 'Count to a hundred after I go.', 'You were always going to lose that.',
  ],
  guarding: [
    'Nobody touches my client.', 'Keep walking.', 'I am paid to stand here. Try me.', 'Eyes on me, hands where I can see them.',
    'Not today. Not on my hour.', 'You want them, you come through me.', 'Step back.', 'I see you looking. Stop looking.',
    'This block is quiet while I am on it.', 'Paid up till the hour. After that, ask again.', 'Wrong door.', 'I do not get tired.',
    'Go find someone softer.', 'Stay close to me and you get home rich.', 'Same price tomorrow. Think about it.', 'Move along.',
  ],
  broke: [
    'Rent is due and I have lint.', 'Anybody hiring?', 'I will work cheap today. Only today.', 'One good hour and I am back.',
    'Spot me till tonight?', 'Do not count me out yet.', 'I have had worse days. Not many.', 'Somebody owes me. I forget who.',
    'I need a break, or a loan.', 'Down to my last few dollars.', 'Ask me again tomorrow.', 'I am not proud. What is the job?',
    'Everybody starts somewhere. I keep starting.', 'This city eats cash.', 'Tonight the street, tomorrow we see.', 'I will remember who helped.',
  ],
  winning: [
    'Top of the board. Come and get it.', 'Feels good up here.', 'Everybody wants what I have.', 'I am not slowing down.',
    'Keep chasing.', 'Another good day. Thanks, all of you.', 'Stash is getting heavy.', 'You could have had this. You were busy.',
    'I buy the next round. I can afford it.', 'Careful who you rob. I hire well.', 'Numbers do not lie.', 'This is what a plan looks like.',
    'Try to keep up.', 'I like this city.', 'Second place is right behind me. Hello.', 'I am just getting started.',
  ],
});

/** Lines for the confessional booth: the bot talking to the viewers about what it's up to. */
const CONFESS = Object.freeze({
  selling: ['Good hour. The street was hungry.', 'I move it, I count it, I go home.', 'The trick is leaving before they remember your face.', 'More where that came from, if my supplier holds up.',
    'Demand is dropping here. Time to find a new corner.', 'I should stash this. I will, after one more hour.', 'Easy money is never as easy as it looks.', 'Selling is the calm part. Getting home is the job.',
    'Every sale is someone who knows where I stand.', 'The price was fair. For me.', 'I keep it moving. Standing still gets you robbed.', 'One more block, one more hour.',
    'I am carrying too much and I know it.', 'They always come back.', 'The corner pays, as long as nobody else wants it.', 'Good numbers. Quiet street. I do not trust it.'],
  robbed: ['I did not see it coming. I will next time.', 'They took it right off me. I know who.', 'Six hours to get it back. I am counting.', 'That hurt more than the clinic bill.',
    'I should have stashed. I always say that after.', 'I am not angry. I am making a list.', 'Somebody told them I was holding. I want that name too.', 'Lesson learned, paid in full.',
    'They think I will let it go.', 'Next time I hire the muscle.', 'It is not the money. It is the money, and also the principle.', 'I looked weak out there. That costs more than cash.',
    'I am going to need a gun.', 'Everyone watched and nobody moved.', 'I will get it back or I will make it expensive.', 'Bad hour. Bad, bad hour.'],
  robbing: ['Went the way I planned it.', 'You pick the one who is carrying and not looking.', 'Messy, but it paid.', 'They will come for me now. Let them.',
    'I need to cool off. Too many eyes.', 'It is honest work if you squint.', 'I do not like the odds, I like the payout.', 'The heat is on me. Worth it.',
    'Could have gone worse. Has gone worse.', 'A tip makes all the difference.', 'I take from the ones who can afford it. Mostly.', 'One more and I lie low. I mean it this time.',
    'That is rent sorted.', 'I felt bad for a second. Then I counted it.', 'You do not get rich asking nicely.', 'They looked surprised. They always do.'],
  guarding: ['Paid to stand here and look like a bad idea.', 'Nothing happened. That is the job.', 'My client walks home rich, I walk home paid.', 'Somebody thought about it. I saw them think.',
    'Steady money. Not exciting, but steady.', 'I could rob him myself. I am not going to. Probably.', 'The quiet hours pay the same as the loud ones.', 'They need me more than they like to say.',
    'A reputation is worth more than a punch.', 'One more contract and I can stash something.', 'I watch everything. I say nothing. Mostly.', 'If trouble comes, it comes through me first.',
    'Standing guard gives you time to think.', 'The shopkeepers pay small. The dealers pay better.', 'I keep count of who owes who.', 'Easy shift. I will take it.'],
  broke: ['I am one bad night from the street.', 'Nobody is buying what I am selling.', 'Rent went up again. I did not.', 'I need a deal, any deal.',
    'This is the bottom. It has to be.', 'I am watching everyone else get rich.', 'Tomorrow I change something.', 'I have been too careful. Careful is expensive.',
    'Somebody throw me a job.', 'I have skills and no customers.', 'I am learning who my friends are.', 'The fence is laughing at me.',
    'I will take the risk now. I have nothing to lose.', 'It turns around tomorrow. It has to.', 'Counting coins in the dark.', 'I should have joined a crew.'],
  winning: ['I am ahead and everybody knows it.', 'First place paints a target on you.', 'The plan is working. That worries me.', 'I need to stash more and carry less.',
    'They are all looking at my pockets now.', 'One bad hour could undo this.', 'I can afford muscle. I should use it.', 'Keep doing what works.',
    'I am not greedy. I am thorough.', 'Being rich here is a full-time job.', 'They talk about me. Good.', 'Four more days like this one.',
    'I see them watching the standings.', 'Do not get comfortable.', 'The trick now is not losing it.', 'It is lonely at the top. It is also paid for.'],
});

/** Which situation a bot is in this hour. */
export function situationOf(ctx, agent, view, move) {
  if (view.robbed.length || view.happened.some(h => h.hoursAgo <= 1 && /robbed you|took \$|broke into/.test(h.text))) return 'robbed';
  if (move?.verb === 'attack') return 'robbing';
  if (view.duties.contracts.some(c => c.muscle === agent.id) || (agent.cls === 'muscle' && move?.verb === 'work')) return 'guarding';
  if (view.race?.rows[0]?.id === agent.id) return 'winning';
  if (agent.cash + agent.stash < 50) return 'broke';
  return 'selling';
}

/** A bot's say and confessional for the hour, or nothing. Never the same line twice in a row. */
export function botLine(ctx, agent, view, move, mem) {
  const r = rng(ctx.state.seed, 'line', ctx.t, agent.id);
  const out = {};
  const situation = situationOf(ctx, agent, view, move);
  const pick = (bank, last) => {
    let line = bank[Math.floor(r() * bank.length)];
    if (line === last) line = bank[(bank.indexOf(line) + 1) % bank.length];
    return line;
  };
  const loud = situation === 'robbing' || situation === 'robbed' ? 0.7 : 0.18;
  if (view.here?.others.length && r() < loud) {
    out.say = { text: pick(LINES[situation], mem.lastLine) };
    const target = move?.verb === 'attack' ? move.target : view.here.others[0]?.id;
    if (target && view.here.others.some(o => o.id === target)) out.say.to = target;
    mem.lastLine = out.say.text;
  }
  // a local has no confessional booth: it's a person with a job, not a contestant
  if (!agent.local && (r() < 0.3 || situation === 'robbing' || situation === 'robbed')) {
    out.confessional = pick(CONFESS[situation], mem.lastConfess);
    mem.lastConfess = out.confessional;
  }
  return out;
}
