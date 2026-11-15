// Every dollar of the run, accounted for. src/ledger.mjs is built around the ten seats (agents, crews, loans, the
// clinic's debt), so this is its small equivalent with the same rule: money comes in only as pay, leaves only to
// whoever jumped or robbed you, the police, the subway, a shop or somebody at your door, and checkRunBooks() proves
// nothing was made or lost.

const whole = (n, what) => {
  if (!Number.isInteger(n) || n < 0) throw new Error(`bad amount ${what}: ${n}`);
};

/** Pay for a job, into what you carry. */
export function earn(state, amount) {
  whole(amount, 'earned');
  state.books.earned += amount;
  state.carried += amount;
  return { amount, from: 'pay', to: 'carried' };
}

/** Out of what you carry, to whoever takes it: 'jumped', 'seized' or 'fares'. */
export function lose(state, amount, sink) {
  whole(amount, sink);
  if (amount > state.carried) throw new Error(`can't lose $${amount} carrying $${state.carried}`);
  state.carried -= amount;
  state.books[sink] += amount;
  return { amount, from: 'carried', to: sink };
}

/**
 * Out of what is banked (or, on the street, what you carry), to the shop or to somebody: all of it is `spent`, and
 * `on` ('street' for a drink, 'door' for a regular at your door) also counts it in that part of `spent`.
 */
export function spend(state, amount, { from = 'banked', on = null } = {}) {
  whole(amount, 'spent');
  if (amount > state[from]) throw new Error(`can't spend $${amount} with $${state[from]} ${from}`);
  state[from] -= amount;
  state.books.spent += amount;
  if (on) state.books[on] = (state.books[on] ?? 0) + amount;
  return { amount, from, to: 'spent', ...(on ? { on } : {}) };
}

/** Between your pocket and your crib. */
export function bank(state, amount) {
  whole(amount, 'banked');
  state.carried -= amount;
  state.banked += amount;
  return { amount, from: 'carried', to: 'banked' };
}

export function withdraw(state, amount) {
  whole(amount, 'taken out');
  if (amount > state.banked) throw new Error(`can't take $${amount} out with $${state.banked} banked`);
  state.banked -= amount;
  state.carried += amount;
  return { amount, from: 'banked', to: 'carried' };
}

/** The conservation check. */
export function checkRunBooks(state) {
  const b = state.books;
  const expected = b.start + b.earned - b.jumped - b.seized - b.fares - b.spent;
  const actual = state.carried + state.banked;
  const ok = expected === actual && state.carried >= 0 && state.banked >= 0;
  return { ok, expected, actual };
}
