// Every dollar that moves goes through here (SPEC section 7, "money in and out").
// Money enters the city only from NPCs and leaves only to NPCs. Between agents it only moves. The books keep a tally
// of both, and checkBooks() proves after every hour that nothing was made or lost on the way.
// Pattern from the original hotkey engine's rules/ledger.mjs: one conservation check, run after every step.

/** Money from an NPC into an agent's pocket. Pays off a clinic debt first, then the crew's cut, then the agent. */
export function earn(state, agent, amount, source, { block = agent.block, income = true } = {}) {
  if (!Number.isInteger(amount) || amount < 0) throw new Error(`bad amount earned: ${amount}`);
  if (amount === 0) return 0;
  state.books.in[source] = (state.books.in[source] ?? 0) + amount;
  agent.stats.earnedNpc += amount;
  agent.earned.today += amount;
  if (block) agent.earned.byBlock[block] = (agent.earned.byBlock[block] ?? 0) + amount;
  return pocket(state, agent, amount, income);
}

/**
 * Cash landing in an agent's pocket from anywhere: the clinic debt comes out first, then anything bought on credit
 * (paid as you earn, oldest first, straight to the seller), then the crew's cut.
 */
function pocket(state, agent, amount, income, depth = 0) {
  let left = amount;
  if (agent.clinicDebt > 0) {
    const paid = Math.min(agent.clinicDebt, left);
    agent.clinicDebt -= paid;
    left -= paid;
    state.books.out.clinic = (state.books.out.clinic ?? 0) + paid;
  }
  if (agent.docksDebt > 0 && left > 0) {
    const paid = Math.min(agent.docksDebt, left);
    agent.docksDebt -= paid;
    left -= paid;
    state.books.out.docks = (state.books.out.docks ?? 0) + paid;
  }
  if (agent.sharkDebt > 0 && left > 0) {
    const paid = Math.min(agent.sharkDebt, left);
    agent.sharkDebt -= paid;
    left -= paid;
    state.books.out['loan shark'] = (state.books.out['loan shark'] ?? 0) + paid;
  }
  if (left > 0 && depth < 4) {
    for (const loan of state.loans) {
      if (left <= 0) break;
      // credit is paid as you earn; so is anything overdue, so stashing each hour's income doesn't dodge a debt
      if (loan.borrower !== agent.id || loan.owed <= 0 || !((loan.credit && loan.status === 'open') || loan.status === 'overdue')) continue;
      const paid = Math.min(loan.owed, left);
      loan.owed -= paid;
      left -= paid;
      if (loan.owed === 0) {
        loan.paidEarly = loan.status === 'open';
        loan.status = 'repaid';
      }
      // the seller gets it at once, and it pays the seller's own suppliers in turn
      pocket(state, state.agents[loan.lender], paid, false, depth + 1);
    }
  }
  const crew = income && agent.crew ? state.crews[agent.crew] : null;
  if (crew && crew.members.length > 1 && crew.cut > 0 && left > 0) {
    const cut = Math.floor((left * crew.cut) / 100);
    crew.pot += cut;
    crew.paidIn[agent.id] = (crew.paidIn[agent.id] ?? 0) + cut;
    left -= cut;
  }
  agent.cash += left;
  return left;
}

/** An agent pays an NPC from the cash it carries. Throws when it can't: callers check first. */
export function spend(state, agent, amount, sink) {
  if (!Number.isInteger(amount) || amount < 0) throw new Error(`bad amount spent: ${amount}`);
  if (agent.cash < amount) throw new Error(`${agent.id} can't pay $${amount} to ${sink} with $${agent.cash}`);
  agent.cash -= amount;
  state.books.out[sink] = (state.books.out[sink] ?? 0) + amount;
  return amount;
}

/** An NPC takes up to `amount` from an agent: carried cash first, then the stash if `stash` is set. Returns what it got. */
export function take(state, agent, amount, sink, { stash = false } = {}) {
  let got = Math.min(agent.cash, amount);
  agent.cash -= got;
  if (stash && got < amount) {
    const more = Math.min(agent.stash, amount - got);
    agent.stash -= more;
    got += more;
  }
  if (got > 0) state.books.out[sink] = (state.books.out[sink] ?? 0) + got;
  return got;
}

/** Cash from one agent's pocket to another's. `income` makes it count for the receiver's crew cut (pay, not a swap). */
export function transfer(state, from, to, amount, { income = false } = {}) {
  if (!Number.isInteger(amount) || amount < 0) throw new Error(`bad transfer: ${amount}`);
  if (from.cash < amount) throw new Error(`${from.id} can't hand over $${amount} with $${from.cash}`);
  from.cash -= amount;
  return pocket(state, to, amount, income);
}

/** Take cash out of an agent's pocket into something the game holds (a job's pay, a contract's pay). */
export function hold(state, agent, amount, holder) {
  if (agent.cash < amount) throw new Error(`${agent.id} can't put up $${amount}`);
  agent.cash -= amount;
  holder.held = (holder.held ?? 0) + amount;
}

/** Pay out of something the game holds, into an agent's pocket. */
export function release(state, holder, agent, amount, { income = true } = {}) {
  const paid = Math.min(holder.held ?? 0, amount);
  holder.held -= paid;
  return pocket(state, agent, paid, income);
}

/** Give back whatever is still held. It isn't income. */
export function refund(state, holder, agent) {
  const back = holder.held ?? 0;
  holder.held = 0;
  if (back > 0) pocket(state, agent, back, false);
  return back;
}

/** The clinic's bill: paid from the pocket, and whatever can't be paid becomes a debt taken from the next income. */
export function clinicBill(state, agent, hours, cfg) {
  const bill = hours * cfg.clinic.perHour;
  const paid = Math.min(agent.cash, bill);
  agent.cash -= paid;
  if (paid > 0) state.books.out.clinic = (state.books.out.clinic ?? 0) + paid;
  agent.clinicDebt += bill - paid;
  return bill;
}

/** Every dollar the city holds right now. */
export function cityCash(state) {
  let total = 0;
  for (const id of state.order) total += state.agents[id].cash + state.agents[id].stash;
  for (const offer of state.offers) total += offer.held ?? 0; // the pay of a job nobody has taken yet
  for (const job of state.jobs) total += job.held ?? 0;
  for (const contract of state.contracts) total += contract.held ?? 0;
  for (const crew of Object.values(state.crews)) total += crew.pot;
  return total;
}

/** The conservation check: what the city holds equals what it started with, plus what came in, less what went out. */
export function checkBooks(state) {
  const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
  const expected = state.books.start + sum(state.books.in) - sum(state.books.out);
  const actual = cityCash(state);
  const negative = state.order.filter(id => {
    const a = state.agents[id];
    return a.cash < 0 || a.stash < 0 || a.clinicDebt < 0 || a.docksDebt < 0 || a.goods.chems < 0 || a.goods.parts < 0
      || Object.values(a.goods.product).some(n => n < 0) || Object.values(a.goods.guns).some(n => n < 0);
  });
  return { ok: expected === actual && negative.length === 0, expected, actual, negative };
}

// ---- trust: the engine's score between every pair, with the reasons (SPEC section 13, D50)

/** `a` now trusts `b` a little more or less, and remembers why. */
export function trustMark(state, cfg, a, b, delta, why, t) {
  if (a === b || !state.trust[a]) return;
  const entry = (state.trust[a][b] ??= { score: 0, reasons: [] });
  entry.score = Math.max(cfg.trust.min, Math.min(cfg.trust.max, entry.score + delta));
  entry.reasons.push({ t, delta, why });
  if (entry.reasons.length > 6) entry.reasons.shift();
}

/** A grudge: `agent` has a score to settle with `against`. */
export function grudge(state, agent, against, why, t) {
  agent.grudges = agent.grudges.filter(g => g.against !== against);
  agent.grudges.push({ against, why, t });
  if (agent.grudges.length > 5) agent.grudges.shift();
}

/** Something that happened to an agent, for its view over the next few hours. */
export function tell(state, id, t, text) {
  const box = state.inbox[id];
  if (!box) return;
  box.happened.push({ t, text });
  if (box.happened.length > 12) box.happened.shift();
}
