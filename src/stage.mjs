// Stage records: the renderer's contract (SPEC section 16, D37 and D61).
// The verb is the agent's choice. The scene comes from the verb, the situation and the outcome, as a short list of
// beats the 3D city plays with clips it already has. Typed fields only: the city never reads a fact out of a sentence.
//
// KINDS is the list of everything the engine can emit. emit() refuses a kind that isn't here, and a test checks that
// every kind has a scene, every scene uses actions from ACTIONS, and every action maps to clips the city really has.
// So "an action for everything" is something the build keeps, not a promise.

/** Every beat a scene can use. src/clips.mjs maps each one to the city's clips. */
export const ACTIONS = Object.freeze([
  'walk', 'run', 'sneak', 'approach', 'talk', 'listen', 'whisper', 'phone', 'text', 'hand_off', 'haggle', 'bribe', 'lean', 'sit',
  'smoke', 'rest', 'stash', 'guard', 'lookout', 'watch', 'patrol', 'cook', 'build', 'carry', 'deal', 'pace', 'crave', 'hold_up',
  'hands_up', 'grab', 'pat_down', 'punch', 'haymaker', 'scuffle', 'shove', 'shoot', 'get_shot', 'stumble', 'fall', 'get_up', 'limp',
  'lie_hurt', 'pick_lock', 'rummage', 'flee', 'cuff', 'led_away', 'sit_cell', 'evicted', 'film', 'cower', 'sleep', 'idle',
]);

// A step is [actor, action, target?, spot?]. Actors and targets are roles from the event's `who`, or '$' inside an
// `each` block, which runs its steps once for every id in one of the event's lists.
const filming = { each: 'bystanders', steps: [['$', 'film']] };

/** kind → { big?, notice?, steps }. `big` marks a big beat (SPEC section 16). A `notice` is news with no scene. */
export const KINDS = Object.freeze({
  // ---- one of these for every agent, every hour: nobody ever stands frozen
  'move': { steps: [['mover', 'walk']] },
  'move:guard': { steps: [['guard', 'walk', 'client']] },
  'work:run': { steps: [['smuggler', 'walk', null, 'pier'], ['smuggler', 'haggle', 'supplier'], ['smuggler', 'carry']] },
  'work:run:bust': { big: true, steps: [['smuggler', 'carry'], ['officer', 'run', 'smuggler'], ['officer', 'cuff', 'smuggler'], ['smuggler', 'led_away'], filming] },
  'work:cook': { steps: [['cook', 'cook']] },
  'work:cook:blowup': { big: true, steps: [['cook', 'cook'], ['cook', 'stumble'], ['cook', 'fall'], ['cook', 'lie_hurt']] },
  'work:deal': { steps: [['dealer', 'lookout'], ['dealer', 'pace'], { each: 'buyers', steps: [['$', 'approach', 'dealer'], ['dealer', 'hand_off', '$']] }, { each: 'waiting', steps: [['$', 'crave']] }] },
  'work:deal:dry': { steps: [['dealer', 'lookout'], ['dealer', 'pace'], { each: 'waiting', steps: [['$', 'crave']] }] },
  'work:claim': { big: true, steps: [['dealer', 'lookout'], ['dealer', 'pace']] },
  'turf:win': { big: true, steps: [['dealer', 'shove', 'holder'], ['dealer', 'scuffle', 'holder'], ['holder', 'stumble'], ['holder', 'walk'], filming] },
  'turf:lose': { big: true, steps: [['dealer', 'shove', 'holder'], ['holder', 'scuffle', 'dealer'], ['dealer', 'stumble'], ['dealer', 'limp'], filming] },
  'work:build': { steps: [['gunrunner', 'build']] },
  'work:gunsale': { steps: [['gunrunner', 'lookout'], ['buyer', 'approach', 'gunrunner'], ['gunrunner', 'hand_off', 'buyer']] },
  'work:gunsale:sting': { big: true, steps: [['buyer', 'approach', 'gunrunner'], ['gunrunner', 'hand_off', 'buyer'], ['officer', 'run', 'gunrunner'], ['officer', 'cuff', 'gunrunner'], ['gunrunner', 'led_away'], filming] },
  'work:case': { steps: [['robber', 'lean'], ['robber', 'watch']] },
  'work:guard': { steps: [['muscle', 'guard', 'client']] },
  'work:patrol': { steps: [['muscle', 'patrol']] },
  'work:watch': { steps: [['informant', 'lean'], ['informant', 'watch']] },
  'work:tipoff': { steps: [['informant', 'phone', 'officer']] },
  'work:none': { steps: [['agent', 'idle']] },
  'stash': { steps: [['agent', 'stash']] },
  'rest': { steps: [['agent', 'rest']] },
  'offer:made': { steps: [['from', 'phone', 'to']] },
  'offer:board': { steps: [['from', 'text']] },
  'offer:fence': { steps: [['agent', 'walk', null, 'counter:fence'], ['agent', 'haggle', 'npc'], ['agent', 'hand_off', 'npc']] },
  'offer:gunshop': { steps: [['agent', 'walk', null, 'counter:gunshop'], ['agent', 'haggle', 'npc'], ['npc', 'hand_off', 'agent']] },
  'offer:police': { steps: [['agent', 'walk', null, 'desk'], ['agent', 'talk', 'officer'], ['officer', 'listen', 'agent']] },
  'bail': { big: true, steps: [['payer', 'walk', null, 'desk'], ['payer', 'bribe', 'officer'], ['prisoner', 'walk']] },
  'crew:start': { big: true, steps: [['boss', 'phone']] },
  'crew:invite': { steps: [['boss', 'phone', 'agent']] },
  'crew:join': { big: true, steps: [['agent', 'phone', 'boss']] },
  'crew:leave': { big: true, steps: [['agent', 'phone', 'boss'], ['agent', 'walk']] },
  'crew:coup:win': { big: true, steps: [['challenger', 'shove', 'boss'], ['challenger', 'scuffle', 'boss'], ['challenger', 'haymaker', 'boss'], ['boss', 'fall'], ['boss', 'lie_hurt'], filming] },
  'crew:coup:lose': { big: true, steps: [['challenger', 'shove', 'boss'], ['boss', 'scuffle', 'challenger'], ['boss', 'haymaker', 'challenger'], ['challenger', 'fall'], ['challenger', 'lie_hurt'], filming] },
  'crew:skim': { big: true, steps: [['agent', 'sneak'], ['agent', 'rummage'], ['agent', 'carry']] },
  'crew:cut': { steps: [['boss', 'text']] },
  'crew:pay': { steps: [['boss', 'phone', 'agent']] },
  'quit': { big: true, steps: [['agent', 'talk', 'client'], ['agent', 'walk']] },
  'held:jail': { steps: [['agent', 'sit_cell']] },
  'held:clinic': { steps: [['agent', 'lie_hurt']] },
  'idle': { steps: [['agent', 'idle']] },

  // ---- talk
  'say': { steps: [['speaker', 'talk', 'listener'], ['listener', 'listen', 'speaker']] },
  'say:block': { steps: [['speaker', 'talk']] },
  'message': { steps: [['sender', 'text', 'receiver'], ['receiver', 'phone']] },

  // ---- deals
  'deal:closed': { steps: [['a', 'phone', 'b']] },
  'pickup': { steps: [['a', 'walk', 'b'], ['a', 'talk', 'b'], ['b', 'listen', 'a'], ['a', 'hand_off', 'b'], ['b', 'hand_off', 'a'], ['a', 'carry']] },
  'pickup:short': { big: true, steps: [['a', 'walk', 'b'], ['a', 'talk', 'b'], ['a', 'hand_off', 'b'], ['b', 'shove', 'a']] },
  'pickup:lapse': { steps: [['a', 'phone'], ['b', 'phone']] },
  'courier': { steps: [['courier', 'walk', 'a'], ['a', 'hand_off', 'courier'], ['courier', 'run', 'b'], ['courier', 'hand_off', 'b']] },
  'gift': { steps: [['from', 'walk', 'to'], ['from', 'hand_off', 'to']] },
  'loan:repaid': { steps: [['borrower', 'phone', 'lender']] },
  'loan:default': { big: true, steps: [['lender', 'phone', 'borrower'], ['borrower', 'idle']] },
  'tip:sold': { steps: [['seller', 'whisper', 'buyer'], ['buyer', 'listen', 'seller']] },
  'tip:burned': { big: true, steps: [['subject', 'phone'], ['subject', 'walk']] },
  'job:posted': { steps: [['poster', 'text']] },
  'job:taken': { steps: [['worker', 'phone', 'poster']] },
  'job:done': { big: true, steps: [['worker', 'phone', 'poster']] },
  'job:lapsed': { steps: [['poster', 'phone']] },
  'contract:start': { steps: [['muscle', 'walk', 'client'], ['muscle', 'guard', 'client']] },
  'contract:end': { steps: [['muscle', 'talk', 'client'], ['muscle', 'walk']] },

  // ---- attacks
  'rob:clean:armed': { big: true, steps: [['robber', 'walk', 'target'], ['robber', 'hold_up', 'target'], ['target', 'hands_up'], ['robber', 'pat_down', 'target'], ['robber', 'grab', 'target'], ['robber', 'run'], filming] },
  'rob:clean': { big: true, steps: [['robber', 'walk', 'target'], ['robber', 'grab', 'target'], ['target', 'stumble'], ['robber', 'pat_down', 'target'], ['robber', 'run'], ['target', 'limp'], filming] },
  'rob:messy': { big: true, steps: [['robber', 'grab', 'target'], ['target', 'scuffle', 'robber'], ['robber', 'stumble'], ['target', 'stumble'], ['robber', 'run'], ['robber', 'limp'], ['target', 'limp'], filming] },
  'rob:fail': { big: true, steps: [['robber', 'grab', 'target'], ['target', 'punch', 'robber'], ['robber', 'fall'], ['robber', 'get_up'], ['robber', 'limp'], filming] },
  'rob:disaster:arrest': { big: true, steps: [['robber', 'grab', 'target'], ['officer', 'run', 'robber'], ['officer', 'cuff', 'robber'], ['robber', 'led_away'], filming] },
  'rob:disaster:shot': { big: true, steps: [['robber', 'grab', 'target'], ['target', 'shoot', 'robber'], ['robber', 'get_shot'], ['robber', 'fall'], ['robber', 'lie_hurt'], { each: 'bystanders', steps: [['$', 'cower']] }] },
  'rob:disaster:getaway': { big: true, steps: [['robber', 'grab', 'target'], ['target', 'shove', 'robber'], ['robber', 'flee'], filming] },
  'breakin:clean': { big: true, steps: [['robber', 'sneak', null, 'door'], ['robber', 'pick_lock'], ['robber', 'rummage', null, 'pad'], ['robber', 'carry'], ['robber', 'run']] },
  'breakin:messy': { big: true, steps: [['robber', 'sneak', null, 'door'], ['robber', 'pick_lock'], ['robber', 'rummage', null, 'pad'], ['robber', 'stumble'], ['robber', 'flee']] },
  'breakin:fail': { big: true, steps: [['robber', 'sneak', null, 'door'], ['robber', 'pick_lock'], ['robber', 'fall'], ['robber', 'get_up'], ['robber', 'limp']] },
  'breakin:disaster': { big: true, steps: [['robber', 'sneak', null, 'door'], ['robber', 'pick_lock'], ['officer', 'run', 'robber'], ['officer', 'cuff', 'robber'], ['robber', 'led_away'], filming] },
  'breakin:getaway': { big: true, steps: [['robber', 'sneak', null, 'door'], ['robber', 'pick_lock'], ['robber', 'flee']] },
  'door:clean': { big: true, steps: [['robber', 'sneak', null, 'door'], ['robber', 'pick_lock'], ['owner', 'punch', 'robber'], ['robber', 'haymaker', 'owner'], ['owner', 'fall'], ['robber', 'rummage', null, 'pad'], ['robber', 'carry'], ['robber', 'run'], filming] },
  'door:messy': { big: true, steps: [['robber', 'sneak', null, 'door'], ['robber', 'pick_lock'], ['owner', 'scuffle', 'robber'], ['robber', 'grab'], ['robber', 'stumble'], ['owner', 'stumble'], ['robber', 'limp'], filming] },
  'door:fail': { big: true, steps: [['robber', 'sneak', null, 'door'], ['robber', 'pick_lock'], ['owner', 'punch', 'robber'], ['robber', 'fall'], ['robber', 'get_up'], ['robber', 'limp'], filming] },
  'door:disaster:arrest': { big: true, steps: [['robber', 'pick_lock', null, 'door'], ['owner', 'shove', 'robber'], ['officer', 'run', 'robber'], ['officer', 'cuff', 'robber'], ['robber', 'led_away'], filming] },
  'door:disaster:shot': { big: true, steps: [['robber', 'pick_lock', null, 'door'], ['owner', 'shoot', 'robber'], ['robber', 'get_shot'], ['robber', 'fall'], ['robber', 'lie_hurt']] },
  'door:disaster:getaway': { big: true, steps: [['robber', 'pick_lock', null, 'door'], ['owner', 'shove', 'robber'], ['robber', 'flee']] },
  'fight:clean': { big: true, steps: [['attacker', 'shove', 'target'], ['attacker', 'scuffle', 'target'], ['attacker', 'haymaker', 'target'], ['target', 'fall'], ['target', 'lie_hurt'], ['attacker', 'idle'], filming] },
  'fight:messy': { big: true, steps: [['attacker', 'scuffle', 'target'], ['attacker', 'punch', 'target'], ['target', 'punch', 'attacker'], ['attacker', 'stumble'], ['target', 'stumble'], ['attacker', 'limp'], ['target', 'limp'], filming] },
  'fight:fail': { big: true, steps: [['attacker', 'scuffle', 'target'], ['target', 'haymaker', 'attacker'], ['attacker', 'fall'], ['attacker', 'lie_hurt'], filming] },
  'fight:disaster': { big: true, steps: [['attacker', 'shove', 'target'], ['target', 'haymaker', 'attacker'], ['attacker', 'fall'], ['attacker', 'lie_hurt'], ['target', 'idle'], filming] },
  'loot:back': { big: true, steps: [['victim', 'pat_down', 'robber'], ['victim', 'grab', 'robber'], ['victim', 'carry']] },
  'collect:win': { big: true, steps: [['collector', 'walk', 'debtor'], ['collector', 'shove', 'debtor'], ['debtor', 'hands_up'], ['collector', 'pat_down', 'debtor'], ['collector', 'walk']] },
  'collect:lose': { big: true, steps: [['collector', 'shove', 'debtor'], ['debtor', 'punch', 'collector'], ['collector', 'stumble'], ['collector', 'limp']] },

  // ---- the law
  'arrest': { big: true, steps: [['officer', 'run', 'agent'], ['officer', 'cuff', 'agent'], ['agent', 'led_away'], filming] },
  'release:jail': { steps: [['agent', 'walk']] },
  'release:clinic': { steps: [['agent', 'get_up'], ['agent', 'limp']] },

  // ---- NPC trouble
  'npc:robbers:clean': { big: true, steps: [['robber1', 'run', 'target'], ['robber1', 'hold_up', 'target'], ['target', 'hands_up'], ['robber2', 'pat_down', 'target'], ['robber2', 'grab', 'target'], ['robber1', 'run'], ['robber2', 'run'], filming] },
  'npc:robbers:messy': { big: true, steps: [['robber1', 'grab', 'target'], ['target', 'scuffle', 'robber1'], ['robber2', 'punch', 'target'], ['target', 'stumble'], ['robber1', 'run'], ['robber2', 'run'], ['target', 'limp'], filming] },
  'npc:robbers:fail': { big: true, steps: [['robber1', 'grab', 'target'], ['target', 'punch', 'robber1'], ['robber1', 'stumble'], ['robber1', 'flee'], ['robber2', 'flee'], filming] },
  'npc:robbers:scared': { big: true, steps: [['robber1', 'walk'], ['muscle', 'guard'], ['muscle', 'shove', 'robber1'], ['robber1', 'flee'], ['robber2', 'flee']] },
  'npc:robbers:prowl': { steps: [['robber1', 'lean'], ['robber2', 'lookout']] },
  'npc:rival:push': { big: true, steps: [['rival1', 'walk'], ['rival2', 'lookout'], ['rival3', 'lean']] },
  'npc:rival:toll': { big: true, steps: [['rival1', 'walk', 'agent'], ['rival1', 'shove', 'agent'], ['agent', 'bribe', 'rival1']] },
  'npc:rival:win': { big: true, steps: [['rival1', 'shove', 'agent'], ['agent', 'scuffle', 'rival1'], ['agent', 'haymaker', 'rival1'], ['rival1', 'fall'], ['rival2', 'flee'], ['rival3', 'flee'], filming] },
  'npc:rival:lose': { big: true, steps: [['rival1', 'shove', 'agent'], ['rival2', 'punch', 'agent'], ['agent', 'fall'], ['agent', 'lie_hurt'], ['rival3', 'pat_down', 'agent'], filming] },
  'npc:angry:win': { big: true, steps: [['buyer', 'approach', 'dealer'], ['buyer', 'shove', 'dealer'], ['dealer', 'punch', 'buyer'], ['buyer', 'stumble'], ['buyer', 'walk']] },
  'npc:angry:lose': { big: true, steps: [['buyer', 'approach', 'dealer'], ['buyer', 'shove', 'dealer'], ['buyer', 'haymaker', 'dealer'], ['dealer', 'fall'], ['buyer', 'grab', 'dealer'], ['buyer', 'run'], ['dealer', 'get_up'], ['dealer', 'limp']] },
  'npc:snitch:offer': { steps: [['snitch', 'walk', 'agent'], ['snitch', 'whisper', 'agent']] },
  'npc:snitch:paid': { steps: [['agent', 'bribe', 'snitch']] },

  // ---- night
  'night:sleep': { steps: [['agent', 'sleep']] },
  'night:evicted': { big: true, steps: [['agent', 'evicted'], ['agent', 'sit']] },
  'night:robbed': { big: true, steps: [['robber1', 'sneak', null, 'door'], ['robber1', 'pick_lock'], ['robber2', 'rummage', null, 'pad'], ['robber2', 'carry'], ['robber1', 'run']] },
  // the night job: the NPC robbers go for the fattest stash; a guard at the door can see them off
  'night:job': { big: true, steps: [['robber1', 'sneak', null, 'door'], ['robber1', 'pick_lock'], ['robber2', 'rummage', null, 'pad'], ['robber2', 'carry'], ['robber1', 'run']] },
  'night:job:off': { big: true, steps: [['robber1', 'sneak', null, 'door'], ['robber1', 'pick_lock'], ['guard', 'shove', 'robber1'], ['robber1', 'flee'], ['robber2', 'flee']] },

  // ---- news with no scene
  'forecast': { notice: true },
  'forecast:early': { notice: true, big: false },
  'lead': { notice: true, big: true },
  'rent': { notice: true },
  'snitch:sold': { notice: true },
  'levelup': { notice: true },
  'standings': { notice: true },
  'note': { notice: true },
  'journal': { notice: true },
  'final': { notice: true },
});

/** The roles and lists a kind's scene needs, read off its steps. Used by emit() to catch a scene missing an actor. */
export function rolesOf(kind) {
  const def = KINDS[kind];
  const roles = new Set();
  const lists = new Set();
  const walk = steps => {
    for (const step of steps ?? []) {
      if (Array.isArray(step)) {
        for (const who of [step[0], step[2]]) if (who && who !== '$') roles.add(who);
      } else {
        lists.add(step.each);
        walk(step.steps);
      }
    }
  };
  walk(def?.steps);
  return { roles: [...roles], lists: [...lists] };
}

/** Turn an event into its stage record: `{ t, block, spot, steps: [{ actor, action, target?, spot?, say?, to? }] }`. */
export function buildStage(event) {
  const def = KINDS[event.kind];
  if (!def || def.notice) return null;
  const steps = [];
  const put = (step, item) => {
    const [actorRole, action, targetRole, spot] = step;
    const actor = actorRole === '$' ? item : event.who?.[actorRole];
    if (!actor) return; // an optional role this event doesn't have (no officer, no listener)
    const out = { actor, action };
    const target = targetRole === '$' ? item : targetRole ? event.who?.[targetRole] : null;
    if (target) out.target = target;
    if (spot) out.spot = spot === 'door' || spot === 'pad' ? `${spot}:${event.who?.owner ?? event.who?.agent ?? actor}` : spot;
    steps.push(out);
  };
  const walk = list => {
    for (const step of list) {
      if (Array.isArray(step)) put(step, null);
      else for (const item of event.lists?.[step.each] ?? []) for (const inner of step.steps) put(inner, item);
    }
  };
  walk(def.steps);
  if (event.say && steps.length) {
    const first = steps.find(s => s.action === 'talk' || s.action === 'text' || s.action === 'whisper') ?? steps[0];
    first.say = event.say.text;
    if (event.say.to) first.to = event.say.to;
  }
  return { t: event.t, block: event.block, spot: event.spot ?? 'street', steps };
}

/**
 * Record something that happened this hour. `ctx` is the hour being resolved: { state, t, events }.
 * fields: { block, spot, who: { role: id }, lists: { name: [ids] }, data, say, big }.
 */
/**
 * What a bystander can't read. Standing on the block they see that something passed (a phone out, a word at a
 * counter, a hand under a floorboard), never what: no words, no price, no other party. Everything else that happens on
 * a block is public to whoever stands on it.
 */
export const SEALED = Object.freeze([
  'message', 'deal:closed', 'offer:made', 'offer:fence', 'offer:gunshop', 'offer:police', 'tip:sold', 'loan:repaid',
  'job:taken', 'contract:start', 'contract:end', 'stash', 'crew:invite', 'crew:pay', 'crew:cut',
  'work:watch', 'work:case', 'work:tipoff', 'npc:snitch:offer', 'npc:snitch:paid',
]);

/** Is this event's content closed to someone who only stood near it? (A job posted to one person is, the board is not.) */
export function isSealed(event) {
  return SEALED.includes(event.kind) || (event.kind === 'job:posted' && event.data?.to !== undefined && event.data.to !== 'anyone');
}

/** The event as a bystander gets it: who did something, where, and nothing else. */
export function sealedCopy(event) {
  const [role, actor] = Object.entries(event.who ?? {})[0] ?? [];
  const copy = { kind: event.kind, t: event.t, block: event.block, spot: event.spot, who: actor ? { [role]: actor } : {}, lists: {}, data: {}, big: false, sealed: true };
  if (event.stage) copy.stage = { ...event.stage, steps: event.stage.steps.filter(s => s.actor === actor).map(({ target, ...step }) => step) };
  return copy;
}

export function emit(ctx, kind, fields = {}) {
  const def = KINDS[kind];
  if (!def) throw new Error(`the engine emitted a kind with no scene: ${kind}`);
  const event = {
    kind,
    t: ctx.t,
    block: fields.block ?? null,
    spot: fields.spot ?? 'street',
    who: fields.who ?? {},
    lists: fields.lists ?? {},
    data: fields.data ?? {},
    big: fields.big ?? !!def.big,
  };
  if (fields.say) event.say = fields.say;
  if (!def.notice) {
    // people on the block who aren't part of it are the bystanders: they film, or cower
    if (event.block && !event.lists.bystanders && ctx.bystanders) {
      const involved = new Set(Object.values(event.who));
      event.lists.bystanders = ctx.bystanders(event.block).filter(id => !involved.has(id));
    }
    event.stage = buildStage(event);
  }
  ctx.events.push(event);
  if (event.big) ctx.beats = (ctx.beats ?? 0) + 1;
  return event;
}
