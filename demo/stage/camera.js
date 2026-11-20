// The stage's camera: what to look at when nobody is steering (SPEC section 24).
//
//   watching   the place's own shot (the place table's `look`: it faces the place's front) of wherever the followed
//              person is; a cut-in for a big beat, then back out; a person, once the panels ask for one
//              (stage.focus) or one is clicked, until they ask for nobody (focus(null), Esc)
//   playing    on the player, and still while the menu waits; a glance at whoever is clicked, or at whoever or
//              wherever a line of the menu the player picks points at when that is out of the picture, until the
//              hour plays; the player's own pad, the pen or the tent while they are in it
//
// A PERSON IS WATCHED WITH THE CITY'S OWN LOCK (camera/lock.js in the pinned city): the viewer's angle and zoom, fixed
// to the world and carried with the person, and what stands in the way goes see-through. We give it its first angle
// (raised, looking down), with a cut; after that a drag or the wheel turns and zooms it and it stays as they left it,
// for this person and the next. Lock, not Follow: Follow keeps a 4.6 m arm at street level behind one shoulder and
// swings, pulls in and cuts to keep walls off that arm, which on these narrow sidewalks is a camera that never
// rests and shows one back instead of a scene.
//
// INDOORS IS OURS. A person in the pen, the tent or a pad stands inside what the city's collision world knows as a
// solid building, where neither of the rig's person cameras has room (Follow's arm is crushed to half a metre: the
// camera "sits on their head"). The city has an answer for its own agents at home (it shows the room from the
// room's own pose) and we use it both ways: the stage cuts to the set's pose for the room while the watched person
// is in it and cuts back when they come out, and the rig's Follow is told the same through the hook it reads
// (city.recordHomes.cutaway), for whoever switches to it by hand.
//
// EVERY MOVE OF OURS IS A CUT. Two poses on this set nearly always have a building on the line between them. The
// only travel is the Lock's own: it rides with the person, above the roofs.
//
// THE RULE: the person at the screen outranks all of it. A drag or the wheel on a free camera, or one of the rig's
// own mode keys, and this file stops moving it, until they ask for someone or somewhere (stage.focus).

/** Seconds a cut-in lingers after its scene ends. */
const LINGER = 0.7;
/**
 * The first angle of the Lock: metres up, degrees down, and the bearing from the person to the camera (0 is due
 * south of them, 90 due east). From the east, the set camera's side of the set, looking west:
 *   - along Washington St, so both of its sidewalks are seen from over the street, and from over Ivy St for its
 *     west sidewalk. Only the east sidewalk of Ivy St (the market) is seen through a roof. From the south-east,
 *     where the set camera itself stands, the projects and the docks are behind their own buildings as well.
 *   - twenty-four metres clears every roof round the set (the highest is 21.8 m). The one thing taller is the
 *     tower in the middle of the block east of Ivy St (48 m), and at sixty-four degrees down the camera stays
 *     11.7 m out: short of it from every sidewalk of the set (measured over the city's own collision columns).
 */
const HIGH = 24;
const DOWN = 64;
const BEARING = 90;
/** The lens for a person and for a place, in degrees: the set shot's own. */
const LENS = 42;

export function createCamera({ city, actors, map, director, rooms = null, home = () => null, inside = null }) {
  const rig = city.cam;
  // WHAT GOES SEE-THROUGH, AND HOW, is seethrough.js's: the whole building, roof or stall that hides the watched
  // person fades evenly, people on the line stay whole, and the city's own cone (the Lock's round patch) is kept
  // shut but for what that file cannot cover. Nothing of it is set here.
  const world = rig?.world ?? null;
  const THREE = city.THREE;
  const HELD = map.HELD ?? {};
  const rad = deg => (deg * Math.PI) / 180;

  let mode = 'watch';
  let you = null;
  // the person at the screen has the camera
  let user = false;
  // the person the panels asked for (not the player, who is watched by default when playing)
  let following = null;
  // a block or a held place the panels asked for
  let place = null;
  // playing: what is watched now is a glance (the menu pointed at it), and the next hour brings the player back
  let glance = false;
  // the scene a cut-in is on
  let beat = null;
  // a pad opened for a scene that the watched person is part of
  let sceneRoom = null;
  // a pad this file asked the set to open, to see the person it watches at home
  let opened = null;
  // what the camera is on now: 'wide', 'lock:<id>', 'room:<key>:<id>', 'place:<id>', 'beat'
  let on = '';
  // a change of `on` is on its way (it happens after the frame: see `after`)
  let pending = false;
  // the Lock's angle: ours at first, then whatever the person at the screen made of it
  // ONE BEARING EVERYWHERE (the owner, of a bearing that changed with the place: "what you had was better i think").
  // A place's own side is for its own still shot (showPlace), never for the Lock: walking from the bar to the
  // market does not swing the view, and the viewer's turn and zoom stay theirs at every place.
  const angle = { az: rad(BEARING), el: rad(DOWN), d: HIGH / Math.sin(rad(DOWN)) };
  // the picture has been cut somewhere for a zone to be taken in (cutTo): nothing here moves it until whoever
  // asked says the followed person is there (arrived) or asks for something (focus)
  let away = false;
  let asks = 0;
  // for the tools: every cut is counted, so a jump of the camera can be told from a cut
  const count = { cuts: 0, locks: 0, rooms: 0, beats: 0 };

  // The rig's own settings, for this page (config, not code: the rig reads them every frame, and none of these is
  // among the ones it keeps in the browser). The lens of its person cameras is the set shot's.
  if (rig?.config?.follow) rig.config.follow.fov = LENS;

  // THE CLICK IS THE STAGE'S. The rig has its own picker for a click on the city: it would put its Follow on
  // whichever walker is nearest the pointer, the city's own crowd included (and the ones we keep undrawn on the
  // set), without a word to the panels. Who was clicked is decided in one place, actors.pickAt, and comes here
  // through stage.focus.
  if (rig?.people) rig.people.pick = () => null;

  // FOLLOW, AT HOME. What the rig's Follow reads to know that the agent it is on is indoors, and from where the room
  // is seen (camera/rig.js: api.recordHomes.cutaway(aid) → { inside, door, room, frame() }). The city fills it on its
  // record page only; here the stage knows who is in which room.
  if (rig && !city.recordHomes) {
    city.recordHomes = {
      cutaway(aid) {
        const id = String(aid).replace(/^hk2:/, '');
        const key = director.people.get(id)?.inside;
        const view = key && actors.has(id) ? roomView(key, id) : null;
        if (!view) return null;
        return { inside: true, door: 0, room: key, frame: () => ({ pos: new THREE.Vector3(...view.pos), tgt: new THREE.Vector3(...view.tgt) }) };
      },
    };
  }

  /**
   * After the frame. The city's frame is: the rig's update, the walkers (and our hooks with them), the rig's late
   * step, the render. The rig keeps what it began in its update for its late step, so a change of mode from inside
   * a hook lands between the two and the late step finds no controller ("Cannot read properties of null (reading
   * 'update')"). Everything that touches the rig from a hook or from the director's news is put off to here.
   */
  const after = fn => queueMicrotask(fn);

  /** A CUT to a pose of ours: the camera is free there (the map's controls have it). */
  function cut({ pos, tgt, fov = LENS }, key) {
    count.cuts += 1;
    on = key;
    // (an inside view draws its own layer alone, inside.js; every other shot the city)
    inside?.cut?.(key);
    city.clearFixedShadow?.();
    if (rig) rig.toOrbit({ instant: true });
    city.VIEWS.hk2 = { pos, tgt, fov, sh: [(pos[0] + tgt[0]) / 2, (pos[2] + tgt[2]) / 2, Math.max(16, Math.hypot(pos[0] - tgt[0], pos[2] - tgt[2]) * 0.8)] };
    city.setView('hk2');
    city.clearFixedShadow?.();
  }

  /** Whether a camera at `pos` is in the open: over every roof and crown within a metre and a half of it. */
  function open(pos) {
    if (!world) return true;
    for (const [dx, dz] of [[0, 0], [1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) if (world.topAt(pos[0] + dx, pos[2] + dz) > pos[1] - 1) return false;
    return true;
  }
  /** Whether nothing solid stands between two points (posts and trunks included). */
  const clear = (a, b) => !world || !world.ray({ x: a[0], y: a[1], z: a[2] }, { x: b[0], y: b[1], z: b[2] });

  /** The point `d` metres from `at`, on bearing `az`, `el` up. */
  const out = (at, az, el, d) => [at[0] + Math.sin(az) * Math.cos(el) * d, at[1] + Math.sin(el) * d, at[2] + Math.cos(az) * Math.cos(el) * d];

  /**
   * A still view of a point on the ground: the first of a few raised poses that stands in the open and sees the
   * point. `first` is a bearing to try before the others (a block's own front). The picture is aimed `past` metres
   * beyond the point, so that the people sit below the middle, under the roll card the panels put at the top.
   */
  function still(x, z, { first = null, high = [16, 20, HIGH], past = 0.12, down = DOWN - 8 } = {}) {
    const bearings = [first, angle.az, rad(BEARING), 0, Math.PI / 2, -Math.PI / 2, Math.PI, rad(-45), rad(135), rad(-135)].filter(a => a !== null);
    const at = [x, 1.3, z];
    let fallback = null;
    for (const h of high) {
      for (const az of bearings) {
        const el = rad(down);
        const pos = out(at, az, el, h / Math.sin(el));
        if (!open(pos)) continue;
        const shift = h * past;
        const view = { pos, tgt: [x - Math.sin(az) * shift, 1.3, z - Math.cos(az) * shift], fov: LENS };
        fallback ??= view;
        if (clear(pos, at)) return view;
      }
    }
    return fallback;
  }
  /** The bearing a block's own `look` camera stands on: the open air in front of its fronts. */
  function frontOf(id) {
    const look = (map.BLOCKS[id] ?? HELD[id])?.look;
    return look ? Math.atan2(look[0][0] - look[1][0], look[0][2] - look[1][2]) : null;
  }

  /** The set's pose for a room, for the person in it: the pen and the tent slid over to where they sit or lie. */
  function roomView(key, id) {
    let view = rooms?.view?.(key) ?? null;
    if (!view) return null;
    const A = actors.get(id);
    if (HELD[key] && A) {
      const dx = A.x - view.tgt[0];
      const dz = A.z - view.tgt[2];
      view = { ...view, pos: [view.pos[0] + dx, view.pos[1], view.pos[2] + dz], tgt: [A.x, view.tgt[1], A.z] };
    }
    return view;
  }
  /** Opens the pad the camera looks into when nobody else has (the director opens only the player's own). */
  function openPad(key) {
    const want = key && !HELD[key] && rooms?.show ? key : null;
    if (want === opened) return;
    if (opened) Promise.resolve(rooms.show(opened, false)).catch(() => {});
    opened = want;
    if (opened) Promise.resolve(rooms.show(opened, true)).catch(() => {});
  }

  /** Who the camera is with when nothing else has it: the person asked for, else the player. */
  const watched = () => {
    const id = following ?? (mode === 'watch' ? null : you);
    return id && actors.has(id) ? id : null;
  };
  /** What the camera should be on for a watched person: the room they are in, else the Lock on them. */
  function wantFor(id) {
    const P = director.people.get(id);
    // A PLACE'S INSIDE VIEW, OR ITS DOOR OUTSIDE (inside.js): the room alone while they are in it; a low shot of the
    // door while they go in or come out of it
    const io = inside?.shot?.(id);
    if (io) return `${io.kind}:${io.key}:${id}`;
    if (sceneRoom && rooms?.view?.(sceneRoom)) return `room:${sceneRoom}:${id}`;
    if (P?.inside && rooms?.view?.(P.inside)) return `room:${P.inside}:${id}`;
    return `lock:${id}`;
  }

  /** Puts the camera on a watched person: a cut to their room, or a cut to the Lock's angle on them and the Lock. */
  function watch(id) {
    const want = wantFor(id);
    const A = actors.get(id);
    if (/^(inside|door):/.test(want)) {
      const view = inside.shot(id)?.view();
      if (view) {
        openPad(null);
        count.rooms += 1;
        cut(view, want);
        return;
      }
    }
    if (want.startsWith('room:')) {
      const key = want.slice(5, want.length - id.length - 1);
      const P = director.people.get(id);
      // a pad that nobody opened is opened to be looked into; the player's own is the director's
      openPad(key === P?.inside && !P.shown ? key : null);
      const view = roomView(key, id);
      if (view) {
        count.rooms += 1;
        cut(view, want);
        return;
      }
    }
    openPad(null);
    // the Lock's own pivot: the shoulders (camera/lock.js anchor), so that entering it changes nothing on screen
    const height = rig?.people?.heightOf?.(A.w) ?? 1.75;
    const pivot = [A.w.p[0], Math.max(A.w.p[1], rig?.config?.follow?.floorY ?? 0) + (rig?.config?.lock?.anchorH ?? 0.82) * height, A.w.p[2]];
    cut({ pos: out(pivot, angle.az, angle.el, angle.d), tgt: pivot, fov: LENS }, want);
    if (!rig) return;
    try {
      rig.setMode('lock', { subject: A.w });
      count.locks += 1;
    } catch (err) {
      console.warn('[stage] the camera could not lock on', id, err);
    }
  }

  /** The wide shot: the shot of the place the followed person is at. */
  const wide = () => {
    const id = home();
    if (id && showPlace(id, `wide:${id}`)) return;
    openPad(null);
    cut(map.VIEWS?.set ?? { pos: [0, 80, 80], tgt: [0, 0, 0], fov: 46 }, 'wide');
  };
  /** A block or a held place on its own: its own shot, from the side its front is seen from. */
  function showPlace(id, key = `place:${id}`) {
    openPad(null);
    const at = map.BLOCKS[id]?.spots.street ?? HELD[id]?.at;
    // (steeper than a cut-in: a place's shot stands over the roofs across its street, and looks down past them)
    const view = at ? still(at[0], at[1], { first: frontOf(id), high: [26, 30, 22], down: 61 }) : null;
    if (view) cut(view, key);
    return !!view;
  }
  /** Back to what this mode looks at by default. */
  function rest() {
    away = false;
    if (user) return;
    if (place && showPlace(place)) return;
    const id = watched();
    if (id) watch(id);
    else wide();
  }

  // EVERY FRAME: nothing is moved here. The Lock carries the camera; this only notices that the watched person went
  // into a room or came out of one (once: `on` says what the camera is on), and keeps the angle the viewer set.
  actors.onFrame(() => {
    if (!rig) return;
    if (rig.mode === 'lock' && on.startsWith('lock:')) {
      const a = rig.lock.angles;
      angle.az = a.az;
      angle.el = a.el;
      angle.d = a.d;
    } else if (!pending && !user && !away && (on.startsWith('lock:') || (rig.mode !== 'orbit' && rig.mode !== 'lock'))) {
      // the rig was taken somewhere else by one of its own keys (Esc, a mode digit): that is the viewer's hand
      user = true;
      return;
    }
    if (user || beat || place || pending || away) return;
    const id = watched();
    if (!id) return;
    if (wantFor(id) === on) return;
    pending = true;
    after(() => {
      pending = false;
      if (!user && !beat && !place && watched() === id) watch(id);
    });
  });

  // THE VIEWER'S HAND. While the Lock has a person, a drag turns it and the wheel zooms it: that is the rig's own
  // business and the stage goes on deciding only whom it is on. On a free camera (the wide shot, a room, a cut-in) a
  // drag or the wheel takes it: the stage stands down until it is asked for someone or somewhere.
  const canvas = city.renderer.domElement;
  const took = () => {
    if (rig && rig.mode === 'lock') return;
    user = true;
    beat = null;
  };
  let press = null;
  // the fingers on the picture now (touch-1): pointer id → where it was last, and whether it is the city's move stick
  const fingers = new Map();
  canvas.addEventListener('pointerdown', e => {
    press = [e.clientX, e.clientY];
    if (e.pointerType !== 'touch') return;
    // (the city's input, camera/input.js touchDown, makes the first finger on the left 40 % a move stick while the
    // rig's input is on: the same test, read here after it)
    const stick = !!rig?.input?.active && fingers.size === 0 && e.clientX < innerWidth * 0.4;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, stick });
  });
  // when the person at the screen last pressed anything (a key, a button of the panels, the city)
  let handAt = -1e9;
  for (const type of ['pointerdown', 'keydown']) {
    addEventListener(type, () => {
      handAt = performance.now();
    }, true);
  }
  const byHand = () => performance.now() - handAt < 400;
  // the person who was clicked in the city just now: asked for by name, so the camera goes to them wherever they are
  let clicked = null;
  /** Whether a point of the world is in the open middle of the picture now (not at its edges, not low under the move card). */
  const V = new THREE.Vector3();
  function inFrame(x, y, z) {
    V.set(x, y, z).project(city.camera);
    return V.z < 1 && Math.abs(V.x) < 0.75 && V.y > -0.3 && V.y < 0.8;
  }
  addEventListener('pointermove', e => {
    if (press && e.buttons && Math.hypot(e.clientX - press[0], e.clientY - press[1]) > 6) {
      press = null;
      took();
      // A FINGER'S DRAG ON A ROOM (touch-1). The inside view tells a hand on the camera from its own slide by the
      // target moving more than 6 cm in a frame (inside.js followLead), and the map's controls hand a drag over a
      // twentieth a frame (their damping): a finger's drag on a phone's close room never showed 6 cm and was undone
      // frame by frame, while the wheel's zoom was kept. One finger is a drag: the view is told so. (Two are a pinch,
      // which it reads as the zoom it is. The mouse is left to the 6 cm, as it was.)
      if (e.pointerType === 'touch' && fingers.size === 1) inside?.hand?.();
    }
    const f = fingers.get(e.pointerId);
    if (!f) return;
    // THE LEFT 40 % IN THE LOCK (touch-1). The city's input takes a lone finger that landed there as a move stick
    // (for its fly and photo cameras), which the Lock never reads: a drag there did nothing. While the Lock has the
    // camera, that finger turns it as a finger anywhere else does (camera/input.js touchMove's look, its multiplier
    // too), handed to the Lock with the rest of the frame's intent (below). Two fingers are the city's pinch.
    if (f.stick && fingers.size === 1 && rig?.mode === 'lock' && rig.input.active) {
      const k = rig.config?.touch?.look ?? 1;
      stickLook.x += (e.clientX - f.x) * k;
      stickLook.y += (e.clientY - f.y) * k;
    }
    f.x = e.clientX;
    f.y = e.clientY;
  }, true);
  // (on the window, on the way down: the city's rig stops a release at the canvas when it takes it as a click)
  const lift = e => {
    press = null;
    fingers.delete(e.pointerId);
  };
  addEventListener('pointerup', lift, true);
  addEventListener('pointercancel', lift, true);
  addEventListener('blur', () => fingers.clear());
  // the stick finger's turn, onto the intent the rig takes once a frame (camera/rig.js step: input.take())
  const stickLook = { x: 0, y: 0 };
  if (rig?.input?.take) {
    const take0 = rig.input.take;
    rig.input.take = () => {
      const I = take0();
      if (stickLook.x || stickLook.y) {
        if (rig.mode === 'lock') {
          I.look.x += stickLook.x;
          I.look.y += stickLook.y;
        }
        stickLook.x = stickLook.y = 0;
      }
      return I;
    };
  }
  canvas.addEventListener('wheel', took, { passive: true });
  // Esc gives the camera back to the mode's own picture: the wide shot when watching, the player when playing.
  // (On the way down, at the window: demo/boot.js stops every key there on the way up, before the city hears it.)
  addEventListener('keydown', e => {
    if (e.key !== 'Escape' || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName ?? '')) return;
    if (!user && !following && !place && !beat) return;
    api.focus(null);
  }, true);

  // a pad that is broken into opens for the scene: while it is open and the watched person is part of the scene,
  // the camera is on that room
  director.on((what, info) => {
    if (what !== 'room' && what !== 'room-shut') return;
    if (!info.scene || !info.key.startsWith('pad:')) return;
    const id = watched();
    if (what === 'room' && id && (info.id === id || info.scene.everyone.includes(id))) sceneRoom = info.key;
    else if (what === 'room-shut' && sceneRoom === info.key) sceneRoom = null;
  });
  // a big beat, watching, with nobody asked for: a cut in on it, and a cut back out when it is over. Playing, the
  // camera stays with the player: a scene on their block plays inside the frame they already have.
  director.on((what, scene) => {
    if (what !== 'start' && what !== 'end') return;
    if (what === 'start') {
      if (user || beat || place || mode !== 'watch' || !scene.big || following) return;
      beat = scene;
      after(() => {
        if (beat !== scene || user) return;
        if (!cutIn(scene)) beat = null;
      });
    } else if (beat === scene) {
      actors.seconds(LINGER).then(() => {
        if (beat !== scene) return;
        beat = null;
        after(rest);
      });
    }
  });
  /** A cut-in on a scene: the set's pose for its room, else a raised still of the people in it, from their front. */
  function cutIn(scene) {
    const [cx, cz] = director.centre(scene);
    const view = (HELD[scene.block] ? rooms?.view?.(scene.block) : null) ?? still(cx, cz, { first: frontOf(scene.block), high: [13, 16, 20, HIGH], past: 0.14 });
    if (!view) return false;
    count.beats += 1;
    cut(view, 'beat');
    return true;
  }

  const api = {
    get user() {
      return user;
    },
    get following() {
      return following;
    },
    /** The block or held place the panels asked for, while they have. */
    get place() {
      return place;
    },
    /** Back to what the mode looks at (the zone changed under the camera). */
    rest,
    /**
     * A CUT OF THE STAGE'S, for a zone to be taken in round the place the followed person is going to (loader.js):
     * the picture is behind the fade or the carriage. The camera is held there, and is nobody's hand (it is not
     * "the viewer took it"), until arrived() or focus().
     */
    cutTo(view) {
      away = true;
      beat = null;
      openPad(null);
      cut(view, 'load');
    },
    /** The followed person stands at a new place and the picture is about to come back: the camera is put on them (or on the place, watching). */
    arrived() {
      user = false;
      beat = null;
      glance = false;
      rest();
    },
    /** How many times the camera has been asked for something (stage.focus): the stage reads it round a click. */
    get asks() {
      return asks;
    },
    /** For the tools: what the camera is on, how often it cut, and the Lock's angle. */
    state() {
      return { on, mode, user, following, place, glance, beat: !!beat, rig: rig?.mode ?? null, ...count, angle: { bearing: +((angle.az * 180) / Math.PI).toFixed(1), down: +((angle.el * 180) / Math.PI).toFixed(1), metres: +angle.d.toFixed(1) } };
    },
    /**
     * Where the Lock would put the camera on this person now (the pose watch() cuts to), or null: the run's opening
     * comes down to it and hands the camera back with arrived(), so nothing is seen to change at the hand-over.
     */
    lockPose(id) {
      const A = id && actors.has(id) ? actors.get(id) : null;
      if (!A) return null;
      const height = rig?.people?.heightOf?.(A.w) ?? 1.75;
      const pivot = [A.w.p[0], Math.max(A.w.p[1], rig?.config?.follow?.floorY ?? 0) + (rig?.config?.lock?.anchorH ?? 0.82) * height, A.w.p[2]];
      return { pos: out(pivot, angle.az, angle.el, angle.d), tgt: pivot, fov: LENS, az: angle.az, el: angle.el, d: angle.d };
    },
    /** For the tools: another first angle for the Lock (degrees and metres), taken at once and at every later cut. */
    setAngle({ bearing = BEARING, down = DOWN, high = HIGH } = {}) {
      angle.az = rad(bearing);
      angle.el = rad(down);
      angle.d = high / Math.sin(rad(down));
      const id = watched();
      if (id && on.startsWith('lock:')) watch(id);
    },
    /** A season starts: who the player is, and the mode's default picture. */
    begin({ you: id = null, mode: m = 'watch' }) {
      you = id;
      mode = m;
      user = false;
      following = null;
      place = null;
      glance = false;
      beat = null;
      sceneRoom = null;
      rest();
    },
    /**
     * An hour starts to play. Playing: the hour is the player's own move, so the camera is with them again, whether
     * it was on a glance or on a view the viewer had dragged or wheeled away (which used to keep it for good: nothing
     * on screen said Esc gives it back). Coaching, the hours roll by themselves: only a glance ends, and a view the
     * viewer took stays theirs.
     */
    hour() {
      if (mode === 'watch') {
        // (the followed person is at another place of the zone now: the wide shot is that place's)
        if (!user && !beat && !place && !following && !pending && on.startsWith('wide') && on !== `wide:${home()}`) rest();
        return;
      }
      if (mode === 'play' ? !user && !glance && !place && !following : user || !glance) return;
      user = false;
      beat = null;
      glance = false;
      following = null;
      place = null;
      rest();
    },
    /** A person was clicked in the city (the stage tells us before it tells the panels, who then ask for them). */
    picked(id) {
      clicked = id;
      after(() => {
        clicked = null;
      });
    },
    /** Cuts in on a scene that is playing, whatever the mode (the tools' pictures). It rests when the scene ends. */
    show(scene) {
      user = false;
      place = null;
      beat = scene;
      if (!cutIn(scene)) beat = null;
    },
    /** The panels (or a click) ask for a person, a block, or nothing: the camera is ours again and goes there. */
    focus(target) {
      asks += 1;
      // PLAYING, WHILE THE MENU WAITS, THE CAMERA DOES NOT MOVE ON ITS OWN. The panels point it at the target of
      // whichever line of the menu is picked, and they pick one themselves each time the menu comes up: that one
      // is not the player's doing and is left alone. One the player picked (a key or a press just before) is a
      // glance, and only when it is needed: a person or a block already in the picture is looked at where it is.
      if (mode !== 'watch' && target && target !== you && !director.running) {
        if (!byHand()) return;
        if (!user && rig?.mode === 'lock' && clicked !== target) {
          const A = actors.has(target) ? actors.get(target) : null;
          const at = A ? [A.w.p[0], A.w.p[2]] : map.BLOCKS[target]?.spots.street ?? HELD[target]?.at;
          if (at && inFrame(at[0], A ? A.w.p[1] + 1.2 : 1.2, at[1])) return;
        }
      }
      clicked = null;
      user = false;
      beat = null;
      away = false;
      if (target && actors.has(target)) {
        place = null;
        following = target === you && mode !== 'watch' ? null : target;
        glance = mode !== 'watch' && !!following;
        // (asked for the person it is already on: nothing to do, and no cut)
        if (wantFor(target) === on && (!rig || /^(room|inside|door):/.test(on) || rig.mode === 'lock')) return;
        watch(target);
      } else if (target && (map.BLOCKS[target] || HELD[target])) {
        following = null;
        place = target;
        glance = mode !== 'watch';
        if (on === `place:${target}`) return;
        if (!showPlace(target)) {
          place = null;
          rest();
        }
      } else {
        following = null;
        place = null;
        glance = false;
        rest();
      }
    },
  };
  return api;
}
