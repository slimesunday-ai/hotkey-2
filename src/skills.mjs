// Skills, XP and levelling up (SPEC section 11). Three shared skills plus three per class, each 0 to 5.
// Skills are public: every agent sees the skill levels of everyone on its block.

export const SHARED_SKILLS = ['aim', 'toughness', 'stealth'];

export const CLASS_SKILLS = Object.freeze({
  smuggler: ['barter', 'sneak', 'haul'],
  cook: ['purity', 'yield', 'steady'],
  dealer: ['hustle', 'turf', 'streetSense'],
  gunrunner: ['craft', 'connections', 'clientele'],
  robber: ['ambush', 'read', 'getaway'],
  muscle: ['intimidate', 'bodyguard', 'collect'],
  informant: ['eyes', 'network', 'cover'],
});

export const CLASSES = Object.freeze(Object.keys(CLASS_SKILLS));

/** What each skill is called and does, in plain words, for menus, the rulebook and the episode page. */
export const SKILL_TEXT = Object.freeze({
  aim: ['Aim', '+5 in any fight or robbery per level with a gun, +2 without'],
  toughness: ['Toughness', '+5 per level in any fight or robbery, attacking or defending'],
  stealth: ['Stealth', 'less heat from crimes at levels 2 and 4, and NPC robbers pick you less'],
  barter: ['Barter', 'docks prices 5% lower and fence prices 5% better per level'],
  sneak: ['Sneak', '4% less chance of a bust on a docks run per level'],
  haul: ['Haul', '+1 unit on every docks run per level'],
  purity: ['Purity', '+1 product quality per level, up to 5'],
  yield: ['Yield', '+1 unit per batch at level 2, +2 at level 4'],
  steady: ['Steady Hands', '2% less chance of a blow-up per level'],
  hustle: ['Hustle', '+1 unit sold per hour per level'],
  turf: ['Turf', '+8 in turf fights per level'],
  streetSense: ['Street Sense', 'see police and NPC trouble 6 hours ahead, and know when a robber cases your block'],
  craft: ['Craft', 'gun quality +1 at levels 2 and 4'],
  connections: ['Connections', '5% less chance of a sting per level; at level 3, sell guns by phone'],
  clientele: ['Clientele', 'street gun buyers pay 10% more per level'],
  ambush: ['Ambush', '+5 on robberies and break-ins per level'],
  read: ['Read', 'level 1: see exact cash on your block without casing; level 3: adjacent blocks too'],
  getaway: ['Getaway', '10% per level that a disaster ends in a getaway, not an arrest'],
  intimidate: ['Intimidate', 'a patrol scares NPC trouble off at 15% per level'],
  bodyguard: ['Bodyguard', "+6 to a client's defence per level while you guard them"],
  collect: ['Collect', '+10 per level collecting a debt, and you keep a 20% fee'],
  eyes: ['Eyes', '+1 tip per watch at levels 1, 3 and 5'],
  network: ['Network', 'sell tips by phone at level 2; the police pay 20% more per level'],
  cover: ['Cover', '15% more per level that nobody learns you sold them out'],
});

/** The order a seat without an owner buys skills in. The first two are bought with the starting points. */
export const DEFAULT_BUILD = Object.freeze({
  smuggler: ['haul', 'haul', 'sneak', 'barter', 'haul', 'toughness', 'sneak', 'barter', 'haul', 'stealth', 'sneak', 'toughness'],
  cook: ['purity', 'purity', 'yield', 'yield', 'purity', 'steady', 'purity', 'yield', 'yield', 'toughness', 'steady', 'stealth'],
  dealer: ['hustle', 'hustle', 'streetSense', 'toughness', 'hustle', 'turf', 'toughness', 'hustle', 'turf', 'aim', 'stealth', 'turf'],
  gunrunner: ['connections', 'craft', 'craft', 'connections', 'clientele', 'connections', 'craft', 'craft', 'clientele', 'toughness', 'aim', 'stealth'],
  robber: ['ambush', 'ambush', 'stealth', 'stealth', 'getaway', 'ambush', 'read', 'getaway', 'ambush', 'aim', 'toughness', 'ambush'],
  muscle: ['bodyguard', 'toughness', 'bodyguard', 'intimidate', 'collect', 'toughness', 'bodyguard', 'intimidate', 'toughness', 'collect', 'aim', 'bodyguard'],
  informant: ['eyes', 'network', 'network', 'cover', 'eyes', 'cover', 'eyes', 'stealth', 'network', 'toughness', 'cover', 'eyes'],
});

export function skillsOf(cls) {
  const own = CLASS_SKILLS[cls];
  if (!own) throw new Error(`no such class: ${cls}`);
  return [...SHARED_SKILLS, ...own];
}

/** A fresh agent's skills: every skill it can have, at 0. */
export function blankSkills(cls) {
  return Object.fromEntries(skillsOf(cls).map(s => [s, 0]));
}

export const level = (agent, skill) => agent.skills[skill] ?? 0;

/** Skills an agent can still raise. */
export function buyable(cfg, agent) {
  return skillsOf(agent.cls).filter(s => level(agent, s) < cfg.skills.max);
}

/** Spend one point. Returns false (and changes nothing) when it can't be bought. */
export function buySkill(cfg, agent, skill) {
  if (agent.points < 1 || !buyable(cfg, agent).includes(skill)) return false;
  agent.skills[skill] += 1;
  agent.points -= 1;
  agent.bought.push(skill);
  return true;
}

/** Spend every point a seat has, down its class's build order (or one it was given). */
export function spendDefault(cfg, agent, order = DEFAULT_BUILD[agent.cls]) {
  const bought = [];
  while (agent.points > 0) {
    // the next skill in the order that this agent hasn't yet bought as many times as the order asks by this point
    let next = null;
    const counts = {};
    for (const skill of order) {
      counts[skill] = (counts[skill] ?? 0) + 1;
      if (level(agent, skill) < counts[skill] && level(agent, skill) < cfg.skills.max) {
        next = skill;
        break;
      }
    }
    next ??= buyable(cfg, agent)[0];
    if (!next || !buySkill(cfg, agent, next)) break;
    bought.push(next);
  }
  return bought;
}

/** The skill a seat's build order wants next: what a bot's journal asks its owner for. */
export function nextWanted(cfg, agent, order = DEFAULT_BUILD[agent.cls]) {
  const counts = {};
  for (const skill of order) {
    counts[skill] = (counts[skill] ?? 0) + 1;
    if (level(agent, skill) < counts[skill] && level(agent, skill) < cfg.skills.max) return skill;
  }
  return buyable(cfg, agent)[0] ?? null;
}

// ---- XP (D19): deals and danger, not repeated safe work.

/** +1 XP for a class risk, whether it came off or not. At most `risksPerDay` a day. Returns true when it counted. */
export function xpRisk(cfg, agent, why) {
  if (agent.xpDay.risks >= cfg.xp.risksPerDay) return false;
  agent.xpDay.risks += 1;
  agent.xp += 1;
  agent.xpLog.push(why);
  return true;
}

/** +1 XP for the first completed deal with each other player each day, if it's worth enough. */
export function xpDeal(cfg, agent, partnerId, value) {
  if (value < cfg.deals.xpDealMin || agent.xpDay.partners.includes(partnerId) || agent.xpDay.partners.length >= cfg.xp.dealsPerDay) return false;
  agent.xpDay.partners.push(partnerId);
  agent.xp += 1;
  agent.xpLog.push(`a deal with ${partnerId}`);
  return true;
}

/** +1 XP for losing a contest. */
export function xpBeating(cfg, agent) {
  if (agent.xpDay.beaten) return false; // once a day: nobody farms beatings
  agent.xpDay.beaten = true;
  agent.xp += 1;
  agent.xpLog.push('a beating');
  return true;
}

/** +1 XP for the day's first work that succeeds. Repeating it earns nothing more. */
export function xpWork(cfg, agent) {
  if (agent.xpDay.worked) return false;
  agent.xpDay.worked = true;
  agent.xp += 1;
  agent.xpLog.push('showing up');
  return true;
}

/** At night: XP turns into points. Returns how many points were granted. */
export function xpToPoints(cfg, agent) {
  const points = Math.floor(agent.xp / cfg.xp.perPoint);
  agent.xp -= points * cfg.xp.perPoint;
  agent.points += points;
  agent.pointsEarned += points;
  agent.xpDay = { partners: [], risks: 0, worked: false };
  agent.xpLog = [];
  return points;
}
