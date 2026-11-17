// The view in plain words, for the terminal (scripts/run-play.mjs), and the keys a player types.

const money = ([lo, hi]) => (lo === hi ? `$${lo}` : `$${lo}–${hi}`);

function dangerLines(d) {
  if (!d.here) return [`Danger: none (${d.why}).`];
  const line = (label, x) => {
    const j = x.jump;
    const stop = x.stop.chance ? `; police stop ${x.stop.chance}% (all $${x.stop.seizes} seized, the day in jail)` : '; no police stop below heat 3';
    return `${label}: ${j.chance}% someone jumps you (${j.bad}% a bad one: $${j.takes.bad} and the clinic; ${j.scuffle}% a scuffle: $${j.takes.scuffle})${stop}`;
  };
  return [line('This hour, work or leave', d.thisHour), line('One hour more', d.oneMore)];
}

export function viewText(v) {
  const out = [];
  out.push(`Day ${v.day}, ${v.clock}, ${v.placeLabel}${v.done ? `   (${v.done.text})` : ''}`);
  const own = v.ownedLabels.length ? v.ownedLabels.join(', ').toLowerCase() : 'a mattress on the floor';
  const yours = v.heatYours !== undefined && v.heatYours !== v.heat ? ` (yours ${v.heatYours})` : '';
  out.push(`Energy ${v.energy}/${v.energyMax}${v.tired ? ' (tired)' : ''}   Heat here ${v.heat}/${v.heatMax}${yours}   Carried ${v.carried}   Banked ${v.banked}   You own: ${own}`);
  if (v.places?.length) out.push(`The city: ${v.places.map(p => p.text).join(' ')}`);
  if (v.place === 'market') out.push(`Hours here this trip: ${v.hoursThere}`);
  out.push(...dangerLines(v.danger));
  const here = (v.people ?? []).filter(p => p.here);
  if (here.length) out.push(`People here: ${here.map(p => `${p.name} (${p.mood}${p.outToday ? ', out today' : ''})`).join(', ')}`);
  const t = v.trustHere;
  if (t && (t.offTable.length || t.tellRisk.pct || t.withYou.length)) out.push(`Trust: ${t.text}`);
  // goods (goods-1): what you carry and have at home, what is at stake, and a selling job not dealt for want of goods
  const goods = (v.goods ?? []).filter(g => g.carried || g.home);
  if (goods.length) out.push(`Goods: ${goods.map(g => `${g.label} ${g.carried} on you, ${g.home} at home`).join('; ')}. ${v.atRisk?.here ? v.atRisk.text : ''}`.trim());
  for (const s of v.selling?.jobs ?? []) if (!s.dealt) out.push(s.text);
  if (v.dry) out.push(v.dry.text);
  if (v.door) out.push(v.door.text);
  if (v.stranded) out.push(v.stranded.text);
  const line = c => `  ${c.key.padStart(2)}) ${c.label}${c.extra ?? ''}${c.available ? '' : `   [${c.why}]`}`;
  if (v.options.length) {
    out.push('Options (1 energy each):');
    for (const o of v.options) {
      const odds = o.sure ? 'sure' : `${o.odds}%${o.oddsWhy.length ? ` (${o.oddsWhy.join(', ')})` : ''}`;
      const others = (o.targets ?? []).length > 1 ? ` [or: ${o.targets.slice(1).map((t, i) => `${o.key}@${i + 2} ${t.name}`).join(', ')}]` : '';
      const trust = `${o.withPay ? ` (with you: +$${o.withPay})` : ''}${o.tellRisk?.pct ? `; told on ${o.tellRisk.pct}%` : ''}`;
      const extra = `: ${odds}, ${money(o.pay)}${o.ifWin ? ` and ${o.ifWin}` : ''}${o.ifFail ? `; if it fails, ${o.ifFail}` : ''}${trust}${others}`;
      out.push(line({ ...o, extra, why: o.why }));
    }
  }
  const shop = v.choices.filter(c => c.kind === 'buy');
  if (shop.length) {
    out.push('Buy:');
    for (const c of shop) out.push(line({ ...c, extra: `: ${v.shop.find(s => s.key === c.key).does}` }));
  }
  const moves = v.choices.filter(c => !c.job && c.kind !== 'buy');
  if (moves.length) {
    out.push('Go:');
    for (const c of moves) out.push(line(c));
  }
  if (v.place === 'crib' && v.banked) out.push('  (step out with cash: type the number with =amount, like 4=2 for the fare)');
  return out.join('\n');
}

// (a trust change rides on the event that caused it, and a call elsewhere carries a notice: each its own line)
export const eventsText = events => events.flatMap(e => [`  - ${e.text}`, ...(e.trust ? [`    ${e.trust.text}`] : []), ...(e.notice ? [`    Notice: ${e.notice.text}`] : [])]).join('\n');

/**
 * The choice a key stands for: a number from the list, `N=amount` to step out with cash, `N@T` to do option N to
 * its T-th target (1 is the one dealt), or a letter: i go inside, o step out (o=2: with $2), t the subway to the
 * market, h head home (each pays the fare if it can, else hops), s sleep, m morning, r rob somebody passing, b dig
 * through the bins, d buy the place's first thing (the energy drink), z sleep rough, g give the regular at your door
 * what they ask, x shut the door on them. Returns { choice } or { error }.
 */
export function choiceForKey(v, raw) {
  const key = String(raw).trim();
  if (key.includes('@')) {
    const [n, t] = key.split('@');
    const c = v.choices.find(x => x.key === n);
    if (!c?.job) return { error: `no option ${n} here` };
    const who = c.job.targets?.[Number(t) - 1];
    if (!who) return { error: `${c.label}: no target ${t} (${c.job.targets.length} this hour)` };
    if (!c.available) return { error: `${c.label}: ${c.why}` };
    return { choice: { ...c.choice, who: who.id } };
  }
  const [head, amount] = key.split('=');
  const take = amount === undefined ? 0 : Number(amount);
  if (amount !== undefined && (!Number.isInteger(take) || take < 0)) return { error: `not an amount: ${amount}` };
  const pick = c => {
    if (!c) return { error: `no such choice here: ${key}` };
    if (!c.available) return { error: `${c.label}: ${c.why}` };
    return { choice: c.choice.do === 'out' ? { ...c.choice, take } : c.choice };
  };
  const find = pred => {
    const all = v.choices.filter(c => pred(c.choice));
    return all.find(c => c.available) ?? all[0];
  };
  switch (head.toLowerCase()) {
    case 'i': return pick(find(c => c.do === 'inside'));
    case 'o': return pick(find(c => c.do === 'out'));
    case 's': return pick(find(c => c.do === 'sleep'));
    case 'm': return pick(find(c => c.do === 'morning'));
    case 't': return pick(find(c => c.do === 'subway' && c.to === 'market'));
    case 'h': return pick(find(c => c.do === 'subway' && c.to === 'park'));
    case 'r': return pick(find(c => c.do === 'rob'));
    case 'b': return pick(find(c => c.do === 'bins'));
    case 'd': return pick(find(c => c.do === 'shop'));
    case 'z': return pick(find(c => c.do === 'rough'));
    case 'g': return pick(find(c => c.do === 'give'));
    case 'x': return pick(find(c => c.do === 'refuse'));
    default: return pick(v.choices.find(c => c.key === head));
  }
}
