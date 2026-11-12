// A stand-in for the 3D stage, for the HUD's own dev page (demo/hud-dev.html). A development harness, never a
// product: a loud flat plate with the city's blocks as labelled areas and the agents as named tokens, behind the same
// five calls the real stage answers. The plate is busy on purpose, so a panel that lets the scene through shows it.
//
//   stage.playHour(line, { seen, speed }) → Promise
//   stage.screenOf(agentId) → { x, y, visible }
//   stage.focus(target)
//   stage.onPick(fn)
//   stage.setClock({ day, hour })
// and three the HUD calls when a stage has them:
//   stage.begin({ game, you, mode })     a season starts or is carried on: who is in it and where they stand
//   stage.setSpeed(n)                    0 is paused
//   stage.portraitOf(agentId)            → Promise of an image URL, or null

const GRID = [['projects', 'market', 'uptown'], ['corner', 'bar', 'park'], ['docks', 'precinct', 'held']];

const CSS = `
.stub { position: absolute; inset: 0; overflow: hidden; font: 700 13px/1.2 ui-monospace, Menlo, monospace; color: #17171b;
  background: repeating-linear-gradient(45deg, #2b6cb0 0 22px, #f6ad55 22px 44px, #276749 44px 66px, #e53e3e 66px 88px, #faf089 88px 110px); }
.stub-night { position: absolute; inset: 0; background: #0b1026; opacity: 0; transition: opacity .6s linear; pointer-events: none; }
.stub-grid { position: absolute; left: clamp(300px, 24.5vw, 356px); right: clamp(392px, 31vw, 460px); top: 136px; bottom: 168px; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); gap: 10px; }
.stub-block { position: relative; background: rgba(255, 255, 255, .78); outline: 3px solid #17171b; padding: 22px 4px 4px; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 3px; min-width: 0; }
.stub-block.is-focus { outline-color: #ff4fa3; outline-width: 6px; }
.stub-block.is-hot { background: #fff; }
.stub-block > b { position: absolute; left: 5px; top: 3px; text-transform: uppercase; letter-spacing: .04em; }
.stub-block > i { position: absolute; right: 5px; top: 3px; font-style: normal; background: #2f5bff; color: #fff; padding: 0 4px; display: none; }
.stub-block.has-police > i { display: block; }
.stub-held { display: grid; grid-template-rows: 1fr 1fr; gap: 6px; }
.stub-token { border: 0; padding: 2px 5px; background: #17171b; color: #fff; font: inherit; cursor: pointer; white-space: nowrap; }
.stub-token.is-you { background: #ffc21a; color: #17171b; }
.stub-token.is-focus { box-shadow: 0 0 0 3px #ff4fa3; }
.stub-token.is-acting { background: #ff4fa3; color: #17171b; }
`;

export function createStubStage(el) {
  if (!document.querySelector('style[data-stub-stage]')) {
    const style = document.createElement('style');
    style.setAttribute('data-stub-stage', '');
    style.textContent = CSS;
    document.head.append(style);
  }
  el.replaceChildren();
  const plate = document.createElement('div');
  plate.className = 'stub';
  const night = document.createElement('div');
  night.className = 'stub-night';
  const grid = document.createElement('div');
  grid.className = 'stub-grid';
  plate.append(grid, night);
  el.append(plate);

  const blocks = {};
  const tokens = {};
  let picked = () => {};
  let speed = 1;

  const cell = (id, label) => {
    const box = document.createElement('div');
    box.className = 'stub-block';
    box.dataset.block = id;
    const name = document.createElement('b');
    name.textContent = label;
    const police = document.createElement('i');
    police.textContent = 'police';
    box.append(name, police);
    blocks[id] = box;
    return box;
  };
  for (const row of GRID) {
    for (const id of row) {
      if (id !== 'held') {
        grid.append(cell(id, id));
        continue;
      }
      const held = document.createElement('div');
      held.className = 'stub-held';
      held.append(cell('jail', 'jail'), cell('clinic', 'clinic'));
      grid.append(held);
    }
  }

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function place(id, block, animate) {
    const token = tokens[id];
    const home = blocks[block] ?? blocks.projects;
    if (!token || token.parentNode === home) return;
    const from = token.getBoundingClientRect();
    home.append(token);
    if (!animate) return;
    const to = token.getBoundingClientRect();
    token.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` }, { transform: 'none' }], { duration: 700 / Math.max(speed, 0.25), easing: 'ease-in-out' });
  }

  return {
    begin({ game, you }) {
      for (const token of Object.values(tokens)) token.remove();
      for (const id of game.state.order) {
        const agent = game.state.agents[id];
        const token = document.createElement('button');
        token.type = 'button';
        token.className = `stub-token${id === you ? ' is-you' : ''}`;
        token.textContent = agent.name;
        token.title = agent.cls;
        token.addEventListener('click', () => picked(id));
        tokens[id] = token;
        place(id, agent.state === 'free' ? agent.block : agent.state, false);
      }
    },

    async playHour(line, { seen = line.events ?? [], speed: s = 1 } = {}) {
      speed = s;
      const instant = !(s < 50);
      for (const [id, box] of Object.entries(blocks)) box.classList.toggle('has-police', (line.police ?? []).includes(id));
      for (const [id, a] of Object.entries(line.agents ?? {})) place(id, a.block, !instant);
      if (instant) return;
      const big = seen.filter(e => e.big && e.block).slice(0, 8);
      await sleep(700 / s);
      for (const event of big) {
        const actors = Object.values(event.who ?? {}).map(id => tokens[id]).filter(Boolean);
        blocks[event.block]?.classList.add('is-hot');
        for (const t of actors) t.classList.add('is-acting');
        await sleep(650 / s);
        blocks[event.block]?.classList.remove('is-hot');
        for (const t of actors) t.classList.remove('is-acting');
      }
    },

    screenOf(agentId) {
      const token = tokens[agentId];
      if (!token || !token.isConnected) return { x: 0, y: 0, visible: false };
      const r = token.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top, visible: r.width > 0 };
    },

    focus(target) {
      for (const box of Object.values(blocks)) box.classList.toggle('is-focus', box.dataset.block === target);
      for (const [id, token] of Object.entries(tokens)) token.classList.toggle('is-focus', id === target);
    },

    onPick(fn) {
      picked = typeof fn === 'function' ? fn : () => {};
    },

    setClock({ hour }) {
      // noon is bright, 23:00 is dark
      night.style.opacity = String(Math.max(0, Math.min(0.55, (hour - 17) * 0.09)));
    },

    setSpeed(n) {
      speed = n;
    },

    portraitOf() {
      return Promise.resolve(null);
    },
  };
}
